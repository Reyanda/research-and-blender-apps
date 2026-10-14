#!/usr/bin/env python3
"""
OpenScience — Standalone Build
Completely independent binary. Copies the original binary, bundles
proxy.py INSIDE it, and uses only ~/.openscience/ paths.

The proxy intercepts api.anthropic.com calls → api.deepseek.com
The binary is COPIED and NEITHER linked to nor sharing state with Claude Science.
"""

# Retained experimental implementation. Native reconstruction requires the original
# complete Bun executable layout and metadata; header + JS concatenation is invalid.
if __name__ == "__main__":
    raise SystemExit("Native rebuild/install is unavailable: complete original Bun metadata is missing. Use ../ClaudeScience-patched/launch.sh with an original executable.")

import os, sys, json, shutil, hashlib, subprocess
from pathlib import Path

HOME = Path.home()
WORK = (Path(__file__).resolve().parent.parent / 'openscience-native')
HEADER = (Path(__file__).resolve().parent.parent / 'ClaudeScience-patched/extracted/header.bin')
BUNDLE = (Path(__file__).resolve().parent.parent / 'ClaudeScience-patched/extracted/bundle.js')
ORIG_BIN = HOME / ".claude-science" / "bin" / "claude-science"

INSTALL_DIR = HOME / ".openscience"
BIN_DIR = INSTALL_DIR / "bin"
CONFIG_DIR = INSTALL_DIR / "config"
APPS_DIR = HOME / "Applications"

VERSION = "0.1.0"

PROXY_SRC = r'''#!/usr/bin/env python3
"""OpenScience Proxy — intercepts api.anthropic.com → api.deepseek.com"""
import os, sys, json, asyncio, httpx, signal
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
import uvicorn

def read_config():
    cfg_path = os.path.expanduser("~/.openscience/config/config.toml")
    try:
        with open(cfg_path) as f:
            for line in f:
                if line.strip().startswith("api_key"):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    except: pass
    return os.environ.get("DEEPSEEK_API_KEY") or os.environ.get("ANTHROPIC_API_KEY") or ""

API_KEY = read_config()
DS_URL = "https://api.deepseek.com/v1"
DS_MODEL = os.environ.get("LLM_MODEL", "deepseek-chat")

MODEL_MAP = {
    "claude-sonnet-4-6": DS_MODEL, "claude-opus-4-8": "deepseek-reasoner",
    "claude-haiku-4-5": DS_MODEL, "claude-3-5-sonnet": DS_MODEL,
    "claude-3-opus": "deepseek-reasoner", "claude-3-haiku": DS_MODEL,
}

app = FastAPI(title="OpenScience Proxy")

def a2o(body):
    msgs = []
    if body.get("system"):
        t = body["system"]
        if isinstance(t, list): t = " ".join(b.get("text","") for b in t if b.get("type")=="text")
        if t: msgs.append({"role":"system","content":t})
    for m in body.get("messages",[]):
        r = m.get("role","user")
        c = m.get("content","")
        if isinstance(c, str): msgs.append({"role":r,"content":c})
        elif isinstance(c, list):
            txt = ""; tr = []
            for b in c:
                if b.get("type")=="text": txt += b.get("text","")+"\n"
                elif b.get("type")=="tool_use": txt += f"\n[CALL:{b.get('name')}({json.dumps(b.get('input',{}))})]\n"
                elif b.get("type")=="tool_result": tr.append(("\n[RESULT:"+str(b.get("content",""))+"]\n"))
            msgs.append({"role":r,"content":txt+"".join(tr)})
    tools = []
    for t in body.get("tools",[]):
        tools.append({"type":"function","function":{"name":t.get("name",""),"description":t.get("description",""),"parameters":t.get("input_schema",{})}})
    return {"model":MODEL_MAP.get(body.get("model",""),DS_MODEL),"messages":msgs,"max_tokens":body.get("max_tokens",4096),"temperature":body.get("temperature",0.7),"stream":body.get("stream",False),**({"tools":tools} if tools else {})}

def o2a(r, m):
    c = r.get("choices",[{}])[0]
    msg = c.get("message",{})
    co = []
    if msg.get("reasoning_content"): co.append({"type":"thinking","thinking":msg["reasoning_content"]})
    if msg.get("content"): co.append({"type":"text","text":msg["content"]})
    for tc in msg.get("tool_calls",[]):
        f = tc.get("function",{})
        try: args = json.loads(f.get("arguments","{}"))
        except: args = {}
        co.append({"type":"tool_use","id":tc.get("id",""),"name":f.get("name",""),"input":args})
    u = r.get("usage",{})
    return {"id":"msg_"+os.urandom(12).hex(),"type":"message","role":"assistant","content":co,"model":m,"stop_reason":"end_turn" if c.get("finish_reason")=="stop" else "tool_use","usage":{"input_tokens":u.get("prompt_tokens",0),"output_tokens":u.get("completion_tokens",0)}}

@app.post("/v1/messages")
async def proxy(request: Request):
    body = await request.json()
    stream = body.get("stream", False)
    openai = a2o(body)
    headers = {"Authorization": f"Bearer {API_KEY}","Content-Type":"application/json"}
    async with httpx.AsyncClient() as client:
        if stream:
            openai["stream"] = True
            async def stream_gen():
                async with client.stream("POST", DS_URL+"/chat/completions", headers=headers, json=openai, timeout=120) as resp:
                    text_buf = ""; tc = {}; sent_start = False
                    yield json.dumps({"type":"message_start","message":{"id":"msg_"+os.urandom(12).hex(),"type":"message","role":"assistant","content":[],"model":m,"usage":{"input_tokens":0,"output_tokens":0}}})+"\n"
                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "): continue
                        d = line[6:]
                        if d == "[DONE]": break
                        try: chunk = json.loads(d)
                        except: continue
                        delta = chunk.get("choices",[{}])[0].get("delta",{})
                        usage = chunk.get("usage",{})
                        if delta.get("content"):
                            text_buf += delta["content"]
                            yield json.dumps({"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":delta["content"]}})+"\n"
                        if delta.get("reasoning_content"):
                            yield json.dumps({"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":delta["reasoning_content"]}})+"\n"
                        if delta.get("tool_calls"):
                            for t in delta["tool_calls"]:
                                i = t.get("index",0)
                                if i not in tc:
                                    tc[i] = {"type":"tool_use","id":"toolu_"+os.urandom(12).hex(),"name":"","input":""}
                                if t.get("function",{}).get("name"): tc[i]["name"] = t["function"]["name"]
                                if t.get("function",{}).get("arguments"): tc[i]["input"] += t["function"]["arguments"]
                    yield json.dumps({"type":"message_delta","delta":{"stop_reason":"end_turn","usage":{"input_tokens":usage.get("prompt_tokens",0),"output_tokens":usage.get("completion_tokens",0)}}})+"\n"
                    yield json.dumps({"type":"message_stop"})+"\n"
            return StreamingResponse(stream_gen(), media_type="text/event-stream")
        else:
            resp = await client.post(DS_URL+"/chat/completions", headers=headers, json=openai, timeout=120)
            resp.raise_for_status()
            return JSONResponse(o2a(resp.json(), openai["model"]))

@app.get("/v1/models")
async def list_models():
    return {"data":[{"id":DS_MODEL,"object":"model"},{"id":"deepseek-reasoner","object":"model"}]}

@app.get("/v1/health")
async def health():
    return {"status":"ok"}

def start():
    proxy_port = int(os.environ.get("PROXY_PORT", "8766"))
    print(f"OpenScience proxy on :{proxy_port} -> api.deepseek.com")
    uvicorn.run(app, host="127.0.0.1", port=proxy_port, log_level="warning")

if __name__ == "__main__":
    start()
'''

LAUNCHER = '''#!/bin/bash
# OpenScience Standalone Launcher
set -e

INSTALL_DIR="$(cd "$(dirname "$0")" && cd .. && pwd)"
BINARY="$INSTALL_DIR/bin/_openscience"
PROXY="$INSTALL_DIR/bin/_proxy.py"
CONFIG_DIR="$INSTALL_DIR/config"
CONFIG_FILE="$CONFIG_DIR/config.toml"
PID_FILE="$OS_DIR/.pid"
PROXY_PORT=8766

mkdir -p "$CONFIG_DIR"

# Read API key
API_KEY="${DEEPSEEK_API_KEY:-}"
if [ -z "$API_KEY" ] && [ -f "$CONFIG_FILE" ]; then
  while IFS="=" read -r key val; do
    if [ "$key" = "api_key" ]; then
      val=${val# }; val=${val% }; val=${val%\\"}; val=${val#\\"}
      API_KEY="$val"
    fi
  done < "$CONFIG_FILE"
fi

if [ -z "$API_KEY" ]; then
  read -p "Enter DeepSeek API key: " key
  if [ -n "$key" ]; then
    API_KEY="$key"
    echo "api_key = \\"$key\\"" > "$CONFIG_FILE"
    echo "  Saved to $CONFIG_FILE"
  else
    echo "No key. Exiting."
    exit 1
  fi
fi

echo "============================================"
echo "  OpenScience v{version}"
echo "  DeepSeek-native research assistant"
echo "============================================"
echo ""

# Kill any existing
kill "$(cat "$PID_FILE" 2>/dev/null)" 2>/dev/null || true

# Start proxy
export DEEPSEEK_API_KEY="$API_KEY"
python3 "$PROXY" &
PROXY_PID=$!
sleep 2

# Start daemon with proxy
export ANTHROPIC_BASE_URL="http://127.0.0.1:$PROXY_PORT"
export ANTHROPIC_API_KEY="placeholder"
ANTHROPIC_BASE_URL="http://127.0.0.1:$PROXY_PORT" ANTHROPIC_API_KEY="placeholder" "$BINARY" serve &
DAEMON_PID=$!

echo "$PROXY_PID" > "$PID_FILE"
echo "$DAEMON_PID" >> "$PID_FILE"

sleep 4
echo "  Proxy:  http://127.0.0.1:$PROXY_PORT"
echo "  Daemon: http://127.0.0.1:8000"
echo ""
"$BINARY" url 2>/dev/null | head -1
echo ""

cleanup() { kill $PROXY_PID $DAEMON_PID 2>/dev/null; exit 0; }
trap cleanup INT TERM
wait
'''


def build():
    print("=" * 56)
    print("  OpenScience — Standalone Build")
    print("=" * 56)
    print()

    # 1. Copy original binary
    print("[1/5] Copying original binary...")
    if not ORIG_BIN.exists():
        print(f"  ERROR: {ORIG_BIN} not found")
        sys.exit(1)
    bin_target = BIN_DIR / "_openscience"
    BIN_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ORIG_BIN, bin_target)
    bin_target.chmod(0o755)

    # Apply env var patches directly to the copied binary (same-length swaps)
    data = bytearray(bin_target.read_bytes())
    patches = [
        (b'ANTHROPIC_API_KEY', b'DEEPSEEK_API_KEY\x00'),
        (b'ANTHROPIC_AUTH_TOKEN', b'DEEPSEEK_AUTH_TOKEN\x00'),
        (b'ANTHROPIC_BASE_URL', b'DEEPSEEK_BASE_URL\x00'),
    ]
    for old, new in patches:
        assert len(old) == len(new), f"len mismatch: {old} ({len(old)}) vs {new} ({len(new)})"
        count = 0
        idx = 0
        while True:
            idx = data.find(old, idx)
            if idx == -1: break
            data[idx:idx+len(old)] = new
            count += 1
            idx += len(old)
        print(f"  Patched {old.decode()}: {count}x")
    bin_target.write_bytes(bytes(data))
    print(f"  Copied: {bin_target} ({bin_target.stat().st_size:,} bytes)")

    # 2. Write proxy
    print("\n[2/5] Writing proxy...")
    proxy_target = BIN_DIR / "_proxy.py"
    proxy_target.write_text(PROXY_SRC)
    proxy_target.chmod(0o755)
    print(f"  Proxy: {proxy_target}")

    # 3. Write launcher
    print("\n[3/5] Writing launcher...")
    launcher = INSTALL_DIR / "start.sh"
    launcher.write_text(LAUNCHER.replace("{version}", VERSION))
    launcher.chmod(0o755)
    print(f"  Launcher: {launcher}")

    # 4. Copy .app bundle
    print("\n[4/5] Creating app bundle...")
    app_dir = APPS_DIR / "OpenScience.app"
    if app_dir.exists():
        shutil.rmtree(app_dir)
    (app_dir / "Contents/MacOS").mkdir(parents=True)
    (app_dir / "Contents/Resources").mkdir()

    # Info.plist
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

    # App launcher — paths relative to app bundle
    icon = (Path(__file__).resolve().parent.parent / 'Claude Science.app/Contents/Resources/operon.icns')
    if icon.exists():
        shutil.copy2(icon, app_dir / "Contents/Resources/operon.icns")

    # Copy binary + proxy into app bundle Resources (not bin)
    resources_dir = app_dir / "Contents/Resources"
    shutil.copy2(bin_target, resources_dir / "_openscience")
    shutil.copy2(proxy_target, resources_dir / "_proxy.py")

    app_launcher = app_dir / "Contents/MacOS/openscience"
    app_lines = LAUNCHER.replace("{version}", VERSION).split('\n')
    # Rewrite paths for app bundle layout
    fixed = []
    for line in app_lines:
        line = line.replace('INSTALL_DIR="$(cd "$(dirname "$0")" && cd .. && pwd)"',
                          'INSTALL_DIR="$(cd "$(dirname "$0")"/../Resources && pwd)"')
        line = line.replace('CONFIG_DIR="$INSTALL_DIR/config"',
                          'CONFIG_DIR="$HOME/.openscience/config"')
        fixed.append(line)
    app_launcher.write_text('\n'.join(fixed))
    app_launcher.chmod(0o755)
    print(f"  App: {app_dir}")

    # 5. Write config
    print("\n[5/5] Creating config...")
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    config = CONFIG_DIR / "config.toml"
    if not config.exists():
        config.write_text('''# OpenScience Configuration
# Set your DeepSeek API key here or use DEEPSEEK_API_KEY env var
api_key = "sk-..."
''')
    print(f"  Config: {config}")

    # Shell alias
    zshrc = HOME / ".zshrc"
    alias_line = '\n# OpenScience\nalias openscience="' + str(launcher) + '"\n'
    if zshrc.exists() and '# OpenScience' not in zshrc.read_text():
        zshrc.write_text(zshrc.read_text() + alias_line)
        print(f"  Alias added to {zshrc}")

    # Verify
    print(f"\n{'=' * 56}")
    print(f"  Standalone Build Complete")
    print(f"{'=' * 56}")
    print(f"  Binary: {bin_target}")
    verified = data.count(b'ANTHROPIC_API_KEY') + data.count(b'ANTHROPIC_AUTH_TOKEN') + data.count(b'ANTHROPIC_BASE_URL')
    print(f"  Anthropic env refs remaining: {verified}")
    print(f"  Proxy:        {proxy_target}")
    print(f"  Launcher:     {launcher}")
    print(f"  App:          {app_dir}")
    print(f"  Config:       {config}")
    print()
    print(f"  To run:  {launcher}")
    print(f"  Or:      open ~/Applications/OpenScience.app")
    print(f"  Or:      DEEPSEEK_API_KEY=sk-... {launcher}")
    print()
    print(f"  The binary is a standalone copy. Deletes ~/.openscience/.")
    print(f"  Never touches ~/.claude-science/, ~/.claude-bioscience/, or ~/.operon/.")


def uninstall():
    """Full removal — no traces left."""
    print("Removing OpenScience...")
    for p in [INSTALL_DIR, APPS_DIR / "OpenScience.app"]:
        if p.exists():
            shutil.rmtree(p)
            print(f"  Removed: {p}")
    zshrc = HOME / ".zshrc"
    if zshrc.exists():
        content = zshrc.read_text().split('\n')
        content = [l for l in content if '# OpenScience' not in l and 'openscience' not in l or 'source' in l]
        zshrc.write_text('\n'.join(content))
    # Remove generated files from work dir
    work_app = WORK / "OpenScience.app"
    if work_app.exists():
        shutil.rmtree(work_app)
    print("Done.")


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'build'
    if cmd == 'build':
        build()
    elif cmd == 'uninstall':
        uninstall()
    else:
        print(f"Usage: {sys.argv[0]} [build|uninstall]")
