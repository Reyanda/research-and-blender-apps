#!/usr/bin/env python3
"""Local Anthropic Messages adapter for a DeepSeek Chat Completions backend.

Text and function tools are supported. Unsupported content is rejected rather
than silently losing it. Streaming clients receive a valid event sequence after
the upstream response completes; this adapter does not promise token latency.
"""
import json
import os
import secrets
import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
import uvicorn

DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1").rstrip("/")
DEEPSEEK_MODEL = os.environ.get("LLM_MODEL", "deepseek-chat")


def text_content(content):
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        raise ValueError("Content must be text or a list of text blocks")
    if any(not isinstance(b, dict) or b.get("type") != "text" for b in content):
        raise ValueError("Only text content is supported in this context")
    return "\n".join(b["text"] for b in content)


def convert_anthropic_to_openai(body):
    messages = []
    if "system" in body:
        messages.append({"role": "system", "content": text_content(body["system"])})
    for msg in body.get("messages", []):
        role, content = msg["role"], msg["content"]
        if role not in ("user", "assistant"):
            raise ValueError("Unsupported message role")
        if isinstance(content, str):
            messages.append({"role": role, "content": content})
            continue
        texts, calls, results = [], [], []
        for block in content:
            kind = block["type"]
            if kind == "text":
                texts.append(block["text"])
            elif kind == "tool_use" and role == "assistant":
                calls.append({"id": block["id"], "type": "function", "function": {
                    "name": block["name"], "arguments": json.dumps(block["input"])}})
            elif kind == "tool_result" and role == "user":
                results.append({"role": "tool", "tool_call_id": block["tool_use_id"],
                                "content": text_content(block.get("content", ""))})
            else:
                raise ValueError("Unsupported content block: " + kind)
        messages.extend(results)
        if texts or calls or not results:
            message = {"role": role, "content": "\n".join(texts) or None}
            if calls:
                message["tool_calls"] = calls
            messages.append(message)
    result = {"model": DEEPSEEK_MODEL, "messages": messages, "max_tokens": body.get("max_tokens", 4096)}
    for field in ("temperature", "top_p"):
        if field in body:
            result[field] = body[field]
    if "stop_sequences" in body:
        result["stop"] = body["stop_sequences"]
    if body.get("tools"):
        result["tools"] = [{"type": "function", "function": {
            "name": t["name"], "description": t.get("description", ""),
            "parameters": t["input_schema"]}} for t in body["tools"]]
    if "tool_choice" in body:
        choice = body["tool_choice"]
        kind = choice["type"]
        if kind == "tool":
            result["tool_choice"] = {"type": "function", "function": {"name": choice["name"]}}
        elif kind in ("auto", "none", "any"):
            result["tool_choice"] = {"any": "required"}.get(kind, kind)
        else:
            raise ValueError("Unsupported tool choice")
    return result


def convert_openai_to_anthropic(response, model):
    choice = response["choices"][0]
    message = choice["message"]
    content = []
    if message.get("content"):
        content.append({"type": "text", "text": message["content"]})
    for call in message.get("tool_calls", []):
        function = call["function"]
        arguments = json.loads(function.get("arguments", "{}"))
        if not isinstance(arguments, dict):
            raise ValueError("Tool arguments must be an object")
        content.append({"type": "tool_use", "id": call["id"], "name": function["name"], "input": arguments})
    usage = response.get("usage", {})
    return {"id": "msg_" + secrets.token_hex(12), "type": "message", "role": "assistant",
            "model": model, "content": content, "stop_sequence": None,
            "stop_reason": {"stop": "end_turn", "length": "max_tokens", "tool_calls": "tool_use"}.get(choice.get("finish_reason"), "end_turn"),
            "usage": {"input_tokens": usage.get("prompt_tokens", 0), "output_tokens": usage.get("completion_tokens", 0)}}


async def handle_messages(body):
    if not DEEPSEEK_API_KEY:
        raise ValueError("Set DEEPSEEK_API_KEY before sending requests")
    payload = convert_anthropic_to_openai(body)
    async with httpx.AsyncClient() as client:
        response = await client.post(DEEPSEEK_BASE_URL + "/chat/completions",
            headers={"Authorization": "Bearer " + DEEPSEEK_API_KEY}, json=payload, timeout=120)
        response.raise_for_status()
    return convert_openai_to_anthropic(response.json(), body.get("model", DEEPSEEK_MODEL))


def stream_events(message):
    def event(data):
        return "event: " + data["type"] + "\ndata: " + json.dumps(data) + "\n\n"
    start = dict(message, content=[], stop_reason=None)
    start["usage"] = dict(message["usage"], output_tokens=0)
    yield event({"type": "message_start", "message": start})
    for index, block in enumerate(message["content"]):
        initial = dict(block)
        if block["type"] == "text":
            initial["text"] = ""
            delta = {"type": "text_delta", "text": block["text"]}
        else:
            initial["input"] = {}
            delta = {"type": "input_json_delta", "partial_json": json.dumps(block["input"])}
        yield event({"type": "content_block_start", "index": index, "content_block": initial})
        yield event({"type": "content_block_delta", "index": index, "delta": delta})
        yield event({"type": "content_block_stop", "index": index})
    yield event({"type": "message_delta", "delta": {"stop_reason": message["stop_reason"], "stop_sequence": None},
                 "usage": {"output_tokens": message["usage"]["output_tokens"]}})
    yield event({"type": "message_stop"})


app = FastAPI(title="Messages adapter")

@app.post("/v1/messages")
async def proxy_messages(request: Request):
    try:
        body = await request.json()
        result = await handle_messages(body)
        if body.get("stream"):
            return StreamingResponse(stream_events(result), media_type="text/event-stream")
        return JSONResponse(result)
    except (ValueError, KeyError, TypeError) as exc:
        return JSONResponse({"type": "error", "error": {"type": "invalid_request_error", "message": str(exc)}}, status_code=400)
    except httpx.HTTPError:
        return JSONResponse({"type": "error", "error": {"type": "api_error", "message": "Upstream request failed"}}, status_code=502)

@app.get("/v1/health")
async def health():
    return {"status": "ok", "configured": bool(DEEPSEEK_API_KEY)}


def run_proxy(port=8766):
    if not DEEPSEEK_API_KEY:
        raise SystemExit("Set DEEPSEEK_API_KEY before starting the adapter")
    uvicorn.run(app, host="127.0.0.1", port=port)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("port", nargs="?", type=int, default=8766)
    run_proxy(parser.parse_args().port)
