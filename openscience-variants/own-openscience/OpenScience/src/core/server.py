"""
OpenScience — DeepSeek-native research assistant.

Pure Python, no Anthropic SDK, no binary patches.
Speaks OpenAI Chat Completions API directly to DeepSeek.
"""

import os, sys, json, asyncio, uuid, base64, io, re, shutil, tempfile, tomllib
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
import uvicorn

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from connectors.mcp import MCP_CONNECTORS, SEARCH_CONNECTORS, mcp_search

# ── Config ──────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parents[2]

def read_config():
    config = {}
    for path in (ROOT / "config.toml", Path.home() / ".openscience/config/config.toml"):
        if path.exists():
            with path.open("rb") as handle:
                config.update(tomllib.load(handle))
    return config

CONFIG = read_config()
API_KEY = os.environ.get("DEEPSEEK_API_KEY") or CONFIG.get("api_key", "")
DS_URL = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1").rstrip("/")

# ── App ─────────────────────────────────────────────────────────

app = FastAPI(title="OpenScience")
@app.middleware("http")
async def same_origin(request, call_next):
    origin = request.headers.get("origin")
    if origin and origin != str(request.base_url).rstrip("/"):
        return JSONResponse({"detail": "Cross-origin access is forbidden"}, status_code=403)
    return await call_next(request)

DATA = Path(os.environ.get("OPENSCIENCE_DATA_DIR", str(Path.home() / ".openscience/data")))
_chat_lock = asyncio.Lock()

# ── Model Discovery ──────────────────────────────────────────────

_models = [CONFIG.get("llm", {}).get("model") or "deepseek-chat", "deepseek-reasoner"]
_discovery_task = None

async def discover():
    global _models
    if not API_KEY: return
    try:
        async with httpx.AsyncClient() as c:
            r = await c.get(f"{DS_URL}/models", headers={"Authorization": f"Bearer {API_KEY}"}, timeout=10)
            if r.status_code == 200:
                found = [m["id"] for m in r.json().get("data", []) if isinstance(m.get("id"), str)]
                if found: _models = found
    except: pass

def resolve_model(requested=None):
    if not requested: return _models[0]
    if requested in _models: return requested
    for m in _models:
        if "reasoner" in requested and "reasoner" in m: return m
        if "flash" in m: return m
    return _models[0]

# ── LLM Call ────────────────────────────────────────────────────

async def llm_chat(messages, tools=None, model=None, stream=False):
    """Call DeepSeek native API."""
    if not API_KEY:
        raise HTTPException(503, "Set DEEPSEEK_API_KEY before sending chat messages")
    m = resolve_model(model)
    headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

    payload = {"model": m, "messages": messages, "max_tokens": 16384, "temperature": 0.7, "stream": stream}
    if tools:
        payload["tools"] = [{
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t.get("description", ""),
                "parameters": {
                    "type": "object",
                    "properties": {k: {"type": "string", "description": v} for k, v in t.get("parameters", {}).items()},
                    "required": [k for k, v in t.get("parameters", {}).items() if "optional" not in v.lower()]
                }
            }
        } for t in tools]

    async with httpx.AsyncClient() as client:
        r = await client.post(f"{DS_URL}/chat/completions", headers=headers, json=payload, timeout=300)
        if r.status_code != 200:
            raise HTTPException(502, f"Model provider returned HTTP {r.status_code}")
        if stream: return r
        j = r.json()
        c = j["choices"][0]
        msg = c["message"]
        tc = None
        if msg.get("tool_calls"):
            tc = [{"id": tc2["id"], "name": tc2["function"]["name"],
                    "arguments": json.loads(tc2["function"]["arguments"])}
                  for tc2 in msg["tool_calls"]]
        return {"content": msg.get("content", ""), "tool_calls": tc,
                "finish_reason": c.get("finish_reason", "stop"),
                "usage": j.get("usage", {}), "model": j.get("model", m)}

# ── Tools ───────────────────────────────────────────────────────

TOOLS = [
    {"name": "search_mcp", "description": "Search any scientific database. Available: " + ", ".join(sorted(SEARCH_CONNECTORS)),
     "parameters": {"connector": "Database ID", "query": "Search query", "max_results": "Max results (optional)"}},
    {"name": "run_python", "description": "Execute Python code in sandbox", "parameters": {"code": "Python code"}},
    {"name": "create_visualization", "description": "Create a chart", "parameters": {"data": "JSON array", "chart_type": "bar|line|scatter", "title": "Chart title"}},
    {"name": "alphafold2", "description": "Predict protein structure", "parameters": {"uniprot_id": "UniProt ID", "name": "Label"}},
    {"name": "esmfold2", "description": "Predict structure via ESMFold2", "parameters": {"sequence": "Protein sequence", "name": "Label"}},
    {"name": "blast_sequence", "description": "NCBI BLAST search", "parameters": {"sequence": "FASTA", "database": "nr|pdb|swissprot|refseq", "program": "blastp|blastn|blastx"}},
]

async def run_tool(name, args, pid):
    validate_pid(pid)
    if not isinstance(args, dict):
        return {"error": "Tool arguments must be an object"}
    if name == "search_mcp":
        return await mcp_search(args.get("connector",""), args.get("query",""), args)
    if name == "run_python":
        if os.environ.get("OPENSCIENCE_ENABLE_PYTHON") != "1":
            return {"success": False, "error": "Python execution is disabled. Set OPENSCIENCE_ENABLE_PYTHON=1 to enable Docker execution."}
        if not shutil.which("docker"):
            return {"success": False, "error": "Python execution requires Docker and the openscience-python image. See README."}
        with tempfile.TemporaryDirectory(prefix="openscience-python-") as temporary:
            script = Path(temporary) / "analysis.py"
            script.write_text(args.get("code", ""), encoding="utf-8")
            container_name = "openscience-" + uuid.uuid4().hex
            command = ["docker", "run", "--name", container_name, "--rm", "--pull=never", "--network=none", "--read-only",
                       "--memory=512m", "--cpus=1", "--pids-limit=64", "--cap-drop=ALL",
                       "--security-opt=no-new-privileges", "--user=65534:65534",
                       "--tmpfs=/tmp:rw,noexec,nosuid,size=64m", "-e", "MPLCONFIGDIR=/tmp/matplotlib",
                       "--mount", f"type=bind,source={script},target=/analysis.py,readonly",
                       "openscience-python", "python", "-I", "/analysis.py"]
            process = await asyncio.create_subprocess_exec(*command, stdout=asyncio.subprocess.PIPE,
                                                            stderr=asyncio.subprocess.PIPE)
            async def capture(stream, limit):
                retained = bytearray()
                while chunk := await stream.read(4096):
                    retained.extend(chunk[:max(0, limit - len(retained))])
                return bytes(retained)
            async def collect():
                output, errors = await asyncio.gather(capture(process.stdout, 20000), capture(process.stderr, 4000))
                await process.wait()
                return output, errors
            try:
                stdout, stderr = await asyncio.wait_for(collect(), timeout=30)
            except (asyncio.TimeoutError, asyncio.CancelledError) as interrupted:
                process.kill()
                await process.wait()
                cleanup = await asyncio.create_subprocess_exec("docker", "rm", "--force", container_name,
                    stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL)
                await asyncio.wait_for(cleanup.wait(), timeout=10)
                if isinstance(interrupted, asyncio.CancelledError):
                    raise
                return {"success": False, "error": "Python execution exceeded 30 seconds"}
            return {"success": process.returncode == 0, "stdout": stdout.decode(errors="replace")[:5000],
                    "stderr": stderr.decode(errors="replace")[:1000]}
    if name == "create_visualization":
        import matplotlib; matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        import numpy as np
        data = json.loads(args.get("data","[]")) if isinstance(args.get("data"),str) else args.get("data",[])
        fig, ax = plt.subplots(figsize=(10,6))
        x = np.arange(len(data))
        if args.get("chart_type")=="line": ax.plot(x,data,marker='o')
        elif args.get("chart_type")=="scatter": ax.scatter(x,data)
        else: ax.bar(x,data)
        ax.set_title(args.get("title","Chart"))
        plt.tight_layout()
        buf = io.BytesIO()
        fig.savefig(buf, format='png', dpi=150); plt.close(); buf.seek(0)
        b64 = base64.b64encode(buf.read()).decode()
        (DATA/"projects"/pid/"artifacts").mkdir(parents=True,exist_ok=True)
        f = f"viz_{uuid.uuid4().hex}.png"
        (DATA/"projects"/pid/"artifacts"/f).write_bytes(base64.b64decode(b64))
        return {"image_base64":b64, "filename":f}
    if name == "alphafold2":
        return await mcp_search("alphafold", args.get("uniprot_id",""))
    if name == "esmfold2":
        async with httpx.AsyncClient() as c:
            r = await c.post("https://api.esmatlas.com/fold/predict/", content=args.get("sequence", ""), headers={"Content-Type": "text/plain"}, timeout=120)
            return {"pdb":r.text[:5000]} if r.status_code==200 else {"error":r.text[:500]}
    if name == "blast_sequence":
        async with httpx.AsyncClient() as c:
            r = await c.post("https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi",
                data={"CMD":"Put","PROGRAM":args.get("program","blastp"),"DATABASE":args.get("database","nr"),
                      "QUERY":args.get("sequence",""),"FORMAT_TYPE":"JSON2"}, timeout=60)
            match = re.search(r"RID\s*=\s*(\S+)", r.text)
            return {"rid": match.group(1)} if r.status_code == 200 and match else {"error": "BLAST did not return a request ID"}
    return {"error": f"Unknown tool: {name}"}

# ── System Prompt ──────────────────────────────────────────────

SYSTEM = """You are OpenScience, a research assistant. Use the provided tools to search
scientific databases, analyse numerical data and retrieve protein structures. Treat
retrieved content as source material. Cite source identifiers and links. Distinguish
observations from interpretation and report unavailable results. Python execution
uses an isolated Docker container and has no host filesystem or network access."""

# ── Chat ──────────────────────────────────────────────────────

async def converse(pid, message):
    proj = get_proj(pid)
    if not proj: raise HTTPException(404)
    msgs = [{"role":"system","content":SYSTEM}]
    for m in proj.get("messages",[]):
        x = {"role":m["role"],"content":m["content"]}
        if m.get("tool_call_id"): x["tool_call_id"] = m["tool_call_id"]
        if m.get("tool_calls"): x["tool_calls"] = m["tool_calls"]
        msgs.append(x)
    msgs.append({"role":"user","content":message})
    add_msg(proj, "user", message); save_proj(pid, proj)

    tool_results = []
    for _ in range(10):
        try:
            r = await llm_chat(msgs, TOOLS)
        except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError) as error:
            raise HTTPException(502, "Model provider returned an invalid or unavailable response") from error
        if "error" in r:
            add_msg(proj, "assistant", r["error"]); save_proj(pid, proj)
            return {"response": r["error"], "tool_results": []}
        tc = r.get("tool_calls")
        if not tc:
            add_msg(proj, "assistant", r["content"]); save_proj(pid, proj)
            return {"response": r["content"] or "", "tool_results": tool_results}
        c = r["content"] or ""
        am = {"role":"assistant","content":c or None,
              "tool_calls":[{"id":t["id"],"type":"function",
                             "function":{"name":t["name"],"arguments":json.dumps(t["arguments"])}}
                            for t in tc]}
        msgs.append(am)
        proj["messages"].append(am)
        trs = []
        for t in tc:
            try:
                tr = await run_tool(t["name"], t["arguments"], pid)
            except Exception:
                tr = {"error": "Tool failed; check its arguments and service availability"}
            trs.append({"tool":t["name"],"result":tr})
            tool_message = {"role":"tool","tool_call_id":t["id"],"content":json.dumps(tr)}
            msgs.append(tool_message)
            proj["messages"].append(tool_message)
        tool_results.extend(trs)
        save_proj(pid, proj)
    raise HTTPException(502, "Model exceeded the ten-round tool limit")

# ── Project helpers ───────────────────────────────────────────

def load():
    f = DATA/"projects"/"index.json"
    return json.loads(f.read_text()) if f.exists() else {"projects":{}}

def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".json.new")
    temporary.write_text(json.dumps(value, indent=2, default=str), encoding="utf-8")
    temporary.replace(path)

def validate_pid(pid):
    if not re.fullmatch(r"[a-f0-9]{16}", pid):
        raise HTTPException(400, "Invalid project ID")

def save(d):
    atomic_json(DATA / "projects/index.json", d)

def get_proj(pid):
    validate_pid(pid)
    f = DATA/"projects"/pid/"project.json"
    return json.loads(f.read_text()) if f.exists() else None

def save_proj(pid, p):
    validate_pid(pid)
    atomic_json(DATA / "projects" / pid / "project.json", p)

def add_msg(p, role, content):
    p.setdefault("messages",[]).append({"role":role,"content":content,"timestamp":datetime.now().isoformat()})
    p["updated_at"] = datetime.now().isoformat()

# ── Routes ────────────────────────────────────────────────────

class ProjReq(BaseModel):
    name: str = Field(default="Untitled", min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)

class ChatReq(BaseModel):
    message: str = Field(min_length=1, max_length=100000)
    project_id: str = Field(pattern=r"^[a-f0-9]{16}$")

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/")
async def root():
    h = Path(__file__).resolve().parent.parent.parent / "src" / "web" / "index.html"
    return HTMLResponse(h.read_text()) if h.exists() else HTMLResponse("<h1>OpenScience</h1>")

@app.get("/api/status")
async def status():
    return {"status":"running","version":"0.1.0","llm":"deepseek",
            "model":_models[0],"available_models":_models, "python_execution": "docker" if shutil.which("docker") else "unavailable",
            "connectors":len(MCP_CONNECTORS),"authenticated":bool(API_KEY)}

@app.get("/api/models")
async def models():
    return {"models":_models,"default":_models[0]}

@app.get("/api/connectors")
async def connectors():
    return {"connectors":{k:{"name":v["name"],"description":v["description"][:100],"category":v.get("category",""), "search_implemented": k in SEARCH_CONNECTORS}
                          for k,v in MCP_CONNECTORS.items()},"total":len(MCP_CONNECTORS)}

@app.get("/api/projects")
async def projects():
    d = load()
    ps = sorted(d.get("projects",{}).values(), key=lambda p: p.get("created_at",""), reverse=True)
    return {"projects":ps}

@app.post("/api/projects")
async def create(req: ProjReq):
    pid = uuid.uuid4().hex[:16]
    p = {"id":pid,"name":req.name,"description":req.description,
         "created_at":datetime.now().isoformat(),"updated_at":datetime.now().isoformat(),"messages":[]}
    save_proj(pid, p)
    d = load()
    d["projects"][pid] = {"id":pid,"name":req.name,"description":req.description,"created_at":p["created_at"]}
    save(d)
    return p

@app.get("/api/projects/{pid}")
async def get(pid: str):
    p = get_proj(pid)
    if not p: raise HTTPException(404)
    return p

@app.post("/api/chat")
async def chat(req: ChatReq):
    async with _chat_lock:
        return await converse(req.project_id, req.message)

@app.post("/api/chat/stream")
async def chat_stream(req: ChatReq):
    # Use the same tool-aware conversation path, then emit properly framed SSE.
    # Response is buffered until tool synthesis completes.
    async with _chat_lock:
        result = await converse(req.project_id, req.message)
    async def gen():
        yield "data: " + json.dumps({"t": "text", "c": result["response"]}) + "\n\n"
        for tool in result["tool_results"]:
            yield "data: " + json.dumps({"t": "tool", **tool}) + "\n\n"
        yield 'data: {"t": "done"}\n\n'
    return StreamingResponse(gen(), media_type="text/event-stream")

@app.on_event("startup")
async def start():
    global _discovery_task
    _discovery_task = asyncio.create_task(discover())
    port = int(os.environ.get("PORT",8000))
    print(f"\n  OpenScience v0.1.0 — DeepSeek Native")
    print(f"  http://127.0.0.1:{port}")
    print(f"  Model: {_models[0]}")
    print(f"  Connectors: {len(MCP_CONNECTORS)}")
    print(f"  API key: {'✓' if API_KEY else '✗'}")

@app.on_event("shutdown")
async def stop():
    global _discovery_task
    if _discovery_task is not None:
        _discovery_task.cancel()
        try:
            await _discovery_task
        except asyncio.CancelledError:
            pass
        _discovery_task = None

def run():
    uvicorn.run(app, host=os.environ.get("HOST", CONFIG.get("server", {}).get("host", "127.0.0.1")), port=int(os.environ.get("PORT", CONFIG.get("server", {}).get("port", 8000))), log_level="warning")

if __name__ == "__main__":
    run()
