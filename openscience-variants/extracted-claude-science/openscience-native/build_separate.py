#!/usr/bin/env python3
"""
OpenScience — Truly Separate Standalone Build

Architecture:
  openscience start   →   proxy on :8766  →  api.deepseek.com
                          daemon on 8000   (ANTHROPIC_BASE_URL → proxy)

The binary is a standalone COPY — separate file, separate identity.
Never modifies the original Claude Science installation.
"""

# Retained experimental implementation. Native reconstruction requires the original
# complete Bun executable layout and metadata; header + JS concatenation is invalid.
if __name__ == "__main__":
    raise SystemExit("Native rebuild/install is unavailable: complete original Bun metadata is missing. Use ../ClaudeScience-patched/launch.sh with an original executable.")

import os, sys, json, shutil, hashlib
from pathlib import Path

HOME = Path.home()
ORIG_BIN = HOME / ".claude-science" / "bin" / "claude-science"
INSTALL_DIR = HOME / ".openscience"
BIN_DIR = INSTALL_DIR / "bin"
APPS_DIR = HOME / "Applications"
VERSION = "0.1.0"

PROXY_SRC = r'''#!/usr/bin/env python3
"""OpenScience Proxy — api.anthropic.com → api.deepseek.com"""
import os, json, httpx
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
import uvicorn

def cfg():
    p = os.path.expanduser("~/.openscience/config/config.toml")
    try:
        with open(p) as f:
            for l in f:
                if l.strip().startswith("api_key"):
                    return l.split("=",1)[1].strip().strip('"').strip("'")
    except: pass
    return os.environ.get("DEEPSEEK_API_KEY") or ""

API_KEY = cfg()
DS_URL = "https://api.deepseek.com/v1"
M = {"claude-sonnet-4-6":"deepseek-chat","claude-opus-4-8":"deepseek-reasoner","claude-haiku-4-5":"deepseek-chat","claude-3-5-sonnet":"deepseek-chat","claude-3-opus":"deepseek-reasoner","claude-3-haiku":"deepseek-chat"}

app = FastAPI(title="OpenScience")

def a2o(b):
    msgs = []
    if b.get("system"):
        t = b["system"]
        if isinstance(t, list): t = " ".join(x.get("text","") for x in t if x.get("type")=="text")
        if t: msgs.append({"role":"system","content":t})
    for m in b.get("messages",[]):
        r = m.get("role","user"); c = m.get("content","")
        if isinstance(c, str): msgs.append({"role":r,"content":c})
        elif isinstance(c, list):
            txt = ""; tr = []
            for x in c:
                if x.get("type")=="text": txt += x.get("text","")+"\n"
                elif x.get("type")=="tool_use": txt += f"\n[CALL:{x.get('name')}({json.dumps(x.get('input',{}))})]\n"
                elif x.get("type")=="tool_result": tr.append(("\n[RESULT:"+str(x.get("content",""))+"]\n"))
            msgs.append({"role":r,"content":txt+"".join(tr)})
    tools = [{"type":"function","function":{"name":t.get("name",""),"description":t.get("description",""),"parameters":t.get("input_schema",{})}} for t in b.get("tools",[])]
    return {"model":M.get(b.get("model",""),"deepseek-chat"),"messages":msgs,"max_tokens":b.get("max_tokens",4096),"temperature":b.get("temperature",0.7),"stream":b.get("stream",False),**(tools and {"tools":tools} or {})}

def o2a(r,m):
    c = r.get("choices",[{}])[0]; msg = c.get("message",{}); co = []
    if msg.get("reasoning_content"): co.append({"type":"thinking","thinking":msg["reasoning_content"]})
    if msg.get("content"): co.append({"type":"text","text":msg["content"]})
    for tc in msg.get("tool_calls",[]):
        f = tc.get("function",{})
        try: a = json.loads(f.get("arguments","{}"))
        except: a = {}
        co.append({"type":"tool_use","id":tc.get("id",""),"name":f.get("name",""),"input":a})
    u = r.get("usage",{})
    return {"id":"msg_"+os.urandom(12).hex(),"type":"message","role":"assistant","content":co,"model":m,"stop_reason":"end_turn"if c.get("finish_reason")=="stop"else"tool_use","usage":{"input_tokens":u.get("prompt_tokens",0),"output_tokens":u.get("completion_tokens",0)}}

@app.post("/v1/messages")
async def proxy_post(r: Request):
    body = await r.json(); s = body.get("stream",False); o = a2o(body)
    h = {"Authorization":f"Bearer {API_KEY}","Content-Type":"application/json"}
    async with httpx.AsyncClient() as cl:
        if s:
            o["stream"] = True
            async def gen():
                async with cl.stream("POST",DS_URL+"/chat/completions",headers=h,json=o,timeout=120) as resp:
                    ub = {}; sid = "msg_"+os.urandom(12).hex()
                    yield json.dumps({"type":"message_start","message":{"id":sid,"type":"message","role":"assistant","content":[],"model":o["model"],"usage":{"input_tokens":0,"output_tokens":0}}})+"\n"
                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "): continue
                        d = line[6:]
                        if d == "[DONE]": break
                        try: ch = json.loads(d)
                        except: continue
                        dl = ch.get("choices",[{}])[0].get("delta",{}); ub = ch.get("usage",{})
                        if dl.get("content"): yield json.dumps({"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":dl["content"]}})+"\n"
                        if dl.get("reasoning_content"): yield json.dumps({"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":dl["reasoning_content"]}})+"\n"
                        if dl.get("tool_calls"):
                            for t in dl["tool_calls"]:
                                if t.get("function",{}).get("name"): pass
                    yield json.dumps({"type":"message_delta","delta":{"stop_reason":"end_turn","usage":{"input_tokens":ub.get("prompt_tokens",0),"output_tokens":ub.get("completion_tokens",0)}}})+"\n"
                    yield json.dumps({"type":"message_stop"})+"\n"
            return StreamingResponse(gen(), media_type="text/event-stream")
        else:
            resp = await cl.post(DS_URL+"/chat/completions",headers=h,json=o,timeout=120)
            resp.raise_for_status()
            return JSONResponse(o2a(resp.json(),o["model"]))

@app.get("/v1/models")
async def models():
    return {"data":[{"id":"deepseek-chat","object":"model"},{"id":"deepseek-reasoner","object":"model"}]}

@app.get("/v1/health")
async def health():
    return {"status":"ok"}

def run():
    port = int(os.environ.get("PROXY_PORT","8766"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")

if __name__ == "__main__":
    run()
'''


def build():
    print("=" * 56)
    print("  OpenScience — Standalone Build")
    print("=" * 56)
    print()

    # Check original exists
    if not ORIG_BIN.exists():
        print(f"  ERROR: {ORIG_BIN} not found — install Claude Science first")
        sys.exit(1)

    # Create directories
    print("[1/5] Creating directories...")
    for d in [BIN_DIR, INSTALL_DIR / "config", INSTALL_DIR / "data", INSTALL_DIR / "logs"]:
        d.mkdir(parents=True, exist_ok=True)
    print("  Done")

    # Copy binary as standalone
    print("\n[2/5] Copying binary (standalone)...")
    bin_target = BIN_DIR / "_openscience"
    if bin_target.exists():
        bin_target.unlink()
    shutil.copy2(ORIG_BIN, bin_target)
    bin_target.chmod(0o755)
    print(f"  Copied: {bin_target}")
    print(f"  Size: {bin_target.stat().st_size:,} bytes")
    print(f"  SHA256: {hashlib.sha256(bin_target.read_bytes()).hexdigest()[:12]}")
    print(f"  Original SHA256: {hashlib.sha256(ORIG_BIN.read_bytes()).hexdigest()[:12]}")
    print(f"  Is separate file: {bin_target.stat().st_ino != ORIG_BIN.stat().st_ino}")

    # Write proxy
    print("\n[3/5] Writing proxy...")
    proxy_target = BIN_DIR / "_proxy.py"
    proxy_target.write_text(PROXY_SRC)
    proxy_target.chmod(0o755)
    print(f"  Proxy: {proxy_target}")

    # Write launcher
    print("\n[4/5] Writing launcher...")
    launcher = INSTALL_DIR / "start.sh"
    launcher.write_text('''#!/bin/bash
# OpenScience Start — Run with: openscience start
DIR="$(cd "$(dirname "$0")" && pwd)"
BINARY="$DIR/bin/_openscience"
PROXY="$DIR/bin/_proxy.py"
CONFIG_FILE="$DIR/config/config.toml"
PID_FILE="$DIR/.pid"

# Read API key
API="${DEEPSEEK_API_KEY:-}"
if [ -z "$API" ] && [ -f "$CONFIG_FILE" ]; then
  while IFS="=" read -r k v; do
    if [ "$k" = "api_key" ]; then
      v="${v# }"; v="${v% }"; v="${v%\\"}"; v="${v#\\"}"
      API="$v"
    fi
  done < "$CONFIG_FILE"
fi
if [ -z "$API" ]; then
  echo "OpenScience needs a DeepSeek API key."
  echo "Set DEEPSEEK_API_KEY env var or add to $CONFIG_FILE"
  exit 1
fi

echo "============================================"
echo "  OpenScience v''' + VERSION + r'''"
echo "  Standalone — DeepSeek-native"
echo "============================================"

# Kill existing
kill "$(head -1 "$PID_FILE" 2>/dev/null)" 2>/dev/null; sleep 1

# Start proxy
export DEEPSEEK_API_KEY="$API"
python3 "$PROXY" &
P1=$!
sleep 2

# Start daemon (unpatched binary + proxy env vars)
ANTHROPIC_BASE_URL="http://127.0.0.1:8766" ANTHROPIC_API_KEY="placeholder" "$BINARY" serve &
P2=$!

echo "$P1" > "$PID_FILE"; echo "$P2" >> "$PID_FILE"
sleep 5

echo ""
echo "  Open: http://localhost:8000"
echo ""
"$BINARY" url 2>/dev/null | head -1
echo ""
echo "  Stop: kill $P1 $P2"

trap "kill $P1 $P2 2>/dev/null; exit 0" INT TERM
wait
''')
    launcher.chmod(0o755)
    print(f"  Launcher: {launcher}")

    # App bundle
    app_dir = APPS_DIR / "OpenScience.app"
    if app_dir.exists():
        shutil.rmtree(app_dir)
    (app_dir / "Contents/MacOS").mkdir(parents=True)
    (app_dir / "Contents/Resources").mkdir()

    plist = '''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>OpenScience</string>
<key>CFBundleDisplayName</key><string>OpenScience</string>
<key>CFBundleIdentifier</key><string>org.openscience.app</string>
<key>CFBundleVersion</key><string>''' + VERSION + '''</string>
<key>CFBundleShortVersionString</key><string>''' + VERSION + '''</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleExecutable</key><string>openscience</string>
<key>LSMinimumSystemVersion</key><string>13.0</string>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>'''
    (app_dir / "Contents/Info.plist").write_text(plist)

    # App binary is a small script
    app_main = app_dir / "Contents/MacOS/openscience"
    app_main.write_text('''#!/bin/bash
exec ~/.openscience/bin/_openscience "$@"
''')
    app_main.chmod(0o755)
    shutil.copy2(bin_target, app_dir / "Contents/Resources/_openscience")

    print("  App bundle: {0}".format(app_dir))

    # Config
    print("\n[5/5] Config...")
    config = INSTALL_DIR / "config" / "config.toml"
    if not config.exists():
        config.write_text('# OpenScience\napi_key = "sk-..."\n')

    # Write CLI entry point
    cli = INSTALL_DIR / "openscience"
    cli.write_text('''#!/bin/bash
# OpenScience CLI
case "$1" in
  start|serve)
    exec "$(dirname "$0")/start.sh"
    ;;
  stop)
    kill "$(head -1 "$(dirname "$0")/.pid" 2>/dev/null)" 2>/dev/null
    kill "$(tail -1 "$(dirname "$0")/.pid" 2>/dev/null)" 2>/dev/null
    echo "Stopped."
    ;;
  url)
    exec "$(dirname "$0")/bin/_openscience" url
    ;;
  *)
    exec "$(dirname "$0")/bin/_openscience" "$@"
    ;;
esac
''')
    cli.chmod(0o755)

    # Shell alias
    zshrc = HOME / ".zshrc"
    alias_line = '\n# OpenScience CLI\nalias openscience="' + str(cli) + '"\n'
    if zshrc.exists():
        existing = zshrc.read_text()
        if '# OpenScience CLI' not in existing:
            zshrc.write_text(existing + alias_line)
            print("  Alias added to .zshrc")

    print(f"\n{'=' * 56}")
    print("  Build Complete")
    print(f"{'=' * 56}")
    print(f"  Binary:     {bin_target}")
    print(f"  Proxy:      {proxy_target}")
    print(f"  Launcher:   {launcher}")
    print(f"  CLI:        openscience start|stop|url")
    print(f"  Config:     {config}")
    print(f"  App:        {app_dir}")
    print()
    print(f"  Usage:  openscience start")
    print(f"  Or:     DEEPSEEK_API_KEY=sk-xxx openscience start")
    print(f"  Or:     open ~/Applications/OpenScience.app")


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'build'
    if cmd == 'build':
        build()
    else:
        print(f"Usage: {sys.argv[0]} [build]")
