"""Offline regression checks for the retained Messages adapter."""
import json
import unittest
import proxy
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch

class AdapterTests(unittest.TestCase):
    def test_tool_roundtrip_and_mixed_result_text(self):
        body = {"messages": [{"role": "assistant", "content": [
            {"type": "tool_use", "id": "call1", "name": "search", "input": {"q": "x"}}]},
            {"role": "user", "content": [{"type": "tool_result", "tool_use_id": "call1", "content": "found"},
                {"type": "text", "text": "continue"}]}], "temperature": 0}
        out = proxy.convert_anthropic_to_openai(body)
        self.assertEqual(json.loads(out["messages"][0]["tool_calls"][0]["function"]["arguments"]), {"q": "x"})
        self.assertEqual(out["messages"][1], {"role": "tool", "tool_call_id": "call1", "content": "found"})
        self.assertEqual(out["messages"][2]["content"], "continue")
        self.assertEqual(out["temperature"], 0)

    def test_unsupported_content_rejected(self):
        with self.assertRaises(ValueError):
            proxy.convert_anthropic_to_openai({"messages": [{"role": "user", "content": [{"type": "image"}]}]})

    def test_stop_reason_and_tool_arguments(self):
        for finish, expected in [("length", "max_tokens"), ("stop", "end_turn"), ("tool_calls", "tool_use")]:
            result = proxy.convert_openai_to_anthropic({"choices": [{"finish_reason": finish, "message": {
                "tool_calls": [{"id": "call1", "function": {"name": "f", "arguments": '{"n":1}'}}]}}]}, "requested-model")
            self.assertEqual(result["stop_reason"], expected)
            self.assertEqual(result["content"][0]["input"], {"n": 1})
            self.assertEqual(result["model"], "requested-model")
        with self.assertRaises(ValueError):
            proxy.convert_openai_to_anthropic({"choices": [{"message": {"tool_calls": [{"id": "a", "function": {"arguments": "bad"}}]}}]}, "m")

    def test_http_and_sse_lifecycle(self):
        result = {"id": "msg1", "type": "message", "role": "assistant", "model": "m", "stop_reason": "tool_use",
                  "stop_sequence": None, "usage": {"input_tokens": 4, "output_tokens": 8}, "content": [
                  {"type": "text", "text": "hello"}, {"type": "tool_use", "id": "call1", "name": "f", "input": {"n": 1}}]}
        with patch.object(proxy, "handle_messages", AsyncMock(return_value=result)):
            client = TestClient(proxy.app)
            self.assertEqual(client.post("/v1/messages", json={}).json(), result)
            response = client.post("/v1/messages", json={"stream": True})
        records = [json.loads(event.split("data: ", 1)[1]) for event in response.text.strip().split("\n\n")]
        self.assertEqual([x["type"] for x in records], ["message_start", "content_block_start", "content_block_delta", "content_block_stop", "content_block_start", "content_block_delta", "content_block_stop", "message_delta", "message_stop"])
        self.assertEqual(records[4]["content_block"]["name"], "f")
        self.assertEqual(records[7]["usage"], {"output_tokens": 8})

    def test_missing_credential_does_not_send(self):
        with patch.object(proxy, "DEEPSEEK_API_KEY", ""):
            response = TestClient(proxy.app).post("/v1/messages", json={"messages": []})
        self.assertEqual(response.status_code, 400)

if __name__ == "__main__":
    unittest.main()
