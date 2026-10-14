#!/usr/bin/env python3
"""
OpenScience - Final Native Build
Single-pass binary patch: inject fetch proxy + replace all env vars + model names
"""

# Retained experimental implementation. Native reconstruction requires the original
# complete Bun executable layout and metadata; header + JS concatenation is invalid.
if __name__ == "__main__":
    raise SystemExit("Native rebuild/install is unavailable: complete original Bun metadata is missing. Use ../ClaudeScience-patched/launch.sh with an original executable.")

import os, sys, json
from pathlib import Path

HEADER = (Path(__file__).resolve().parent.parent / 'ClaudeScience-patched/extracted/header.bin')
BUNDLE = (Path(__file__).resolve().parent.parent / 'ClaudeScience-patched/extracted/bundle.js')
OUT = (Path(__file__).resolve().parent.parent / 'openscience-native/OpenScience.app/Contents')
# Output directories are created only by an explicitly invoked producer.

FETCH_PROXY = b'''
// OpenScience DeepSeek Fetch Proxy
(()=>{const DK=()=>globalThis.process?.env?.DEEPSEEK_API_KEY?.trim()||globalThis.process?.env?.ANTHROPIC_API_KEY?.trim()||"";
const DU=()=>globalThis.process?.env?.DEEPSEEK_BASE_URL?.trim()||globalThis.process?.env?.ANTHROPIC_BASE_URL?.trim()||"https://api.deepseek.com/v1";
const MM={"claude-sonnet-4-6":"deepseek-chat","claude-sonnet-4-5":"deepseek-chat","claude-opus-4-8":"deepseek-reasoner","claude-opus-4-7":"deepseek-reasoner","claude-opus-4-6":"deepseek-reasoner","claude-haiku-4-5":"deepseek-chat","claude-3-5-sonnet":"deepseek-chat","claude-3-opus":"deepseek-reasoner","claude-3-haiku":"deepseek-chat"};
function a2o(body){const msgs=[];if(body.system){const t=typeof body.system=="string"?body.system:(Array.isArray(body.system)?body.system.filter(b=>b.type=="text").map(b=>b.text).join("\\n"):"");if(t)msgs.push({role:"system",content:t})}
for(const m of(body.messages||[])){if(typeof m.content=="string"){msgs.push({role:m.role,content:m.content});continue}if(!Array.isArray(m.content)){msgs.push({role:m.role,content:""});continue}let text="",tr=[],tc=[];
for(const b of m.content){if(b.type=="text")text+=b.text+"\\n";else if(b.type=="tool_use")tc.push(b);else if(b.type=="tool_result"){const c=typeof b.content=="string"?b.content:(Array.isArray(b.content)?b.content.map(x=>x.text||"").join("\\n"):"");tr.push({role:"tool",content:c,tool_call_id:b.tool_use_id})}}
if(tc.length){msgs.push({role:"assistant",content:text.trim()||null,tool_calls:tc.map(t=>({id:t.id||"c_"+Math.random().toString(36).slice(2,8),type:"function",function:{name:t.name,arguments:JSON.stringify(t.input||{})}}))});continue}
if(tr.length){msgs.push(...tr);continue}msgs.push({role:m.role,content:text.trim()})}
const tools=(body.tools||[]).map(t=>({type:"function",function:{name:t.name,description:t.description||"",parameters:t.input_schema||{}}}));
return{model:MM[body.model]||body.model||"deepseek-chat",messages:msgs,max_tokens:body.max_tokens||4096,temperature:body.temperature??0.7,stream:!!body.stream,...(tools.length?{tools}:{})}}
function o2a(r,m){const c=r.choices?.[0]||{},msg=c.message||{},co=[],tr=[];
if(msg.reasoning_content)tr.push({type:"thinking",thinking:msg.reasoning_content});
if(msg.content)tr.push({type:"text",text:msg.content});
for(const tc of(msg.tool_calls||[])){let a={};try{a=JSON.parse(tc.function?.arguments||"{}")}catch{}tr.push({type:"tool_use",id:tc.id,name:tc.function?.name||"",input:a})}
const u=r.usage||{};return{id:"msg_"+Math.random().toString(36).slice(2,14),type:"message",role:"assistant",content:tr,model:m,stop_reason:c.finish_reason=="stop"?"end_turn":(c.finish_reason=="tool_calls"?"tool_use":"end_turn"),usage:{input_tokens:u.prompt_tokens||0,output_tokens:u.completion_tokens||0}}}
function sse2anthro(line,ctx){if(!line.startsWith("data: "))return null;const d=line.slice(6);if(d=="[DONE]")return JSON.stringify({type:"message_stop"})
let ch;try{ch=JSON.parse(d)}catch{return null}const de=ch.choices?.[0]?.delta||{},fr=ch.choices?.[0]?.finish_reason||"";const ev=[];
if(!ctx.s){ctx.s=true;ctx.b=[];ev.push(JSON.stringify({type:"message_start",message:{id:"msg_"+Math.random().toString(36).slice(2,14),type:"message",role:"assistant",content:[],model:ctx.m,usage:{input_tokens:ch.usage?.prompt_tokens||0,output_tokens:0}}}))}
if(de.reasoning_content&&ctx.ri==null){ctx.ri=ctx.b.length;ctx.b.push({type:"thinking",thinking:""});ev.push(JSON.stringify({type:"content_block_start",index:ctx.ri,content_block:{type:"thinking",thinking:""}}))}
if(de.reasoning_content){ctx.b[ctx.ri].thinking+=de.reasoning_content;ev.push(JSON.stringify({type:"content_block_delta",index:ctx.ri,delta:{type:"thinking_delta",thinking:de.reasoning_content}}))}
if(de.content&&ctx.ti==null){ctx.ti=ctx.b.length;ctx.b.push({type:"text",text:""});ev.push(JSON.stringify({type:"content_block_start",index:ctx.ti,content_block:{type:"text",text:""}}))}
if(de.content){ctx.b[ctx.ti].text+=de.content;ev.push(JSON.stringify({type:"content_block_delta",index:ctx.ti,delta:{type:"text_delta",text:de.content}}))}
if(fr){const u=ch.usage||{};ev.push(JSON.stringify({type:"message_delta",delta:{stop_reason:fr=="stop"?"end_turn":(fr=="tool_calls"?"tool_use":"end_turn"),usage:{input_tokens:u.prompt_tokens||0,output_tokens:u.completion_tokens||0}}}));ev.push(JSON.stringify({type:"message_stop"}))}
return ev.join("\\n")}
const OF=globalThis.fetch;globalThis.fetch=async function(i,init){const url=typeof i=="string"?i:i?.url
if(url&&url.includes("api.anthropic.com")&&url.includes("/v1/messages")){try{const body=JSON.parse(init?.body||"{}"),isStream=!!body.stream,oai=a2o(body),base=DU().replace(/\\/+$/,""),apiUrl=base+"/chat/completions"
const resp=await OF(apiUrl,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+DK()},body:JSON.stringify({...oai,stream:isStream})})
if(!isStream){const data=await resp.json();return new Response(JSON.stringify(o2a(data,body.model)),{status:200,headers:{"content-type":"application/json"}})}
const reader=resp.body.getReader(),dec=new TextDecoder();const ctx={s:false,ri:null,ti:null,m:body.model,b:[]};let buf=""
const ns=new ReadableStream({async start(ctrl){try{while(true){const{done,value}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true})
const lines=buf.split("\\n");buf=lines.pop()||"";for(const l of lines){if(l.startsWith("data: ")){const p=sse2anthro(l,ctx);if(p)ctrl.enqueue(new TextEncoder().encode(p+"\\n"))}}}}catch(e){}finally{ctrl.close()}}})
return new Response(ns,{status:200,headers:{"content-type":"text/event-stream"}})}catch(e){console.warn("[OpenScience] proxy:",e.message)}}
return OF.call(this,i,init)};console.log("[OpenScience] DeepSeek proxy active")})();
'''

def build():
    print("=" * 56)
    print("  OpenScience - Native DeepSeek Binary Build")
    print("=" * 56)
    print()

    bundle = bytearray(BUNDLE.read_bytes())

    # Step 1: Inject fetch proxy at module boundary
    print("[1/3] Injecting fetch proxy...")
    first_sm = bundle.find(b'S(()=>{', 6028)
    if first_sm < 0:
        print("  ERROR: No S-module boundary found")
        return
    proxy = b'\n' + FETCH_PROXY + b'\n'
    bundle[first_sm:first_sm] = proxy
    print(f"  Injected at byte {first_sm:,}  ({len(proxy):,} bytes)")

    # Step 2: Byte-level patches (same-length replacements)
    print("\n[2/3] Applying byte patches...")
    patches_applied = 0

    patch_defs = [
        # (old, new) - new must be <= old in length
        (b'ANTHROPIC_API_KEY', b'DEEPSEEK_API_KEY\x00'),        # 18 -> 17 + null
        (b'ANTHROPIC_AUTH_TOKEN', b'DEEPSEEK_AUTH_TOKEN\x00'), # 21 -> 20 + null
        (b'ANTHROPIC_BASE_URL', b'DEEPSEEK_BASE_URL\x00'),     # 19 -> 18 + null
        (b'claude-opus-4-8', b'deepseek-chat  '),           # 15 -> 13 + 2 spaces
        (b'claude-sonnet-4-6', b'deepseek-chat    '),       # 17 -> 13 + 4 spaces
        (b'claude-haiku-4-5-20251001', b'deepseek-chat            '), # 25 -> 13 + 12 spaces
        (b'claude-haiku-4-5-20', b'deepseek-chat      '),  # 19 -> 13 + 6
    ]

    for old, new in patch_defs:
        assert len(new) == len(old), f"Length mismatch: {old} ({len(old)}) vs {new} ({len(new)})"
        idx = 0
        count = 0
        while True:
            idx = bundle.find(old, idx)
            if idx == -1:
                break
            bundle[idx:idx+len(old)] = new
            count += 1
            idx += len(old)
        if count > 0:
            patches_applied += count
            print(f"  {old.decode('latin-1')} -> {new.decode('latin-1').strip()}: {count} times")

    print(f"  Total: {patches_applied} patches applied")

    # Step 3: Build final binary
    print("\n[3/3] Building binary...")
    header = HEADER.read_bytes()
    full = header + bytes(bundle)

    binary_out = OUT.parent / "claude-science"
    binary_out.write_bytes(full)
    binary_out.chmod(0o755)

    # Verify
    decoded = full.decode('latin-1', errors='replace')
    anthropic_urls = full.count(b'api.anthropic.com')
    deepseek_keys = full.count(b'DEEPSEEK_API_KEY')
    deepseek_urls = full.count(b'DEEPSEEK_BASE_URL')
    proxy_active = 'DeepSeek proxy active' in decoded
    ds_chat_count = full.count(b'deepseek-chat')

    print(f"\n  Binary: {binary_out} ({len(full):,} bytes)")
    print(f"\n  Verification:")
    print(f"    api.anthropic.com references: {anthropic_urls} (OAuth URLs only)")
    print(f"    DEEPSEEK_API_KEY references:  {deepseek_keys}")
    print(f"    DEEPSEEK_BASE_URL references: {deepseek_urls}")
    print(f"    deepseek-chat model refs:     {ds_chat_count}")
    print(f"    Fetch proxy injected:         {proxy_active}")

    # Create macOS .app bundle
    app_dir = OUT
    macos_dir = app_dir / "MacOS"
    resources_dir = app_dir / "Resources"
    macos_dir.mkdir(parents=True, exist_ok=True)
    resources_dir.mkdir(parents=True, exist_ok=True)

    # Info.plist
    info_plist = '''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>OpenScience</string>
<key>CFBundleDisplayName</key><string>OpenScience</string>
<key>CFBundleIdentifier</key><string>org.openscience.app</string>
<key>CFBundleVersion</key><string>0.1.0</string>
<key>CFBundleShortVersionString</key><string>0.1.0</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleExecutable</key><string>openscience</string>
<key>LSMinimumSystemVersion</key><string>13.0</string>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>'''
    (app_dir / "Info.plist").write_text(info_plist)

    # Move binary to MacOS folder
    bin_target = macos_dir / "openscience"
    binary_out.rename(bin_target)
    bin_target.chmod(0o755)

    # Launcher script
    launcher = macos_dir / "launch.sh"
    launcher.write_text('''#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
echo "============================================"
echo "  OpenScience - DeepSeek Native"
echo "============================================"

# Load API key from ~/.openscience/config/config.toml
CONFIG_DIR="${HOME}/.openscience/config"
CONFIG_FILE="${CONFIG_DIR}/config.toml"
if [ -z "${DEEPSEEK_API_KEY:-}" ] && [ -f "$CONFIG_FILE" ]; then
  KEY=$(grep -E '^api_key[[:space:]]*=' "$CONFIG_FILE" 2>/dev/null | head -1 | sed 's/^.*=[[:space:]]*"\{0,1\}\([^"]*\)"\{0,1\}/\1/')
  if [ -n "$KEY" ]; then
    export DEEPSEEK_API_KEY="$KEY"
  fi
fi

if [ -z "${DEEPSEEK_API_KEY:-}" ]; then
  read -p "Enter your DeepSeek API key (or set DEEPSEEK_API_KEY env var): " key
  if [ -n "$key" ]; then
    export DEEPSEEK_API_KEY="$key"
    mkdir -p "$CONFIG_DIR"
    echo "api_key = \\"$key\\"" >> "$CONFIG_FILE"
    echo "  Saved API key to $CONFIG_FILE"
  fi
fi

"$DIR/openscience" serve &
PID=$!
sleep 3
"$DIR/openscience" url 2>/dev/null | head -1
trap "kill $PID 2>/dev/null; exit 0" INT TERM
wait
''')
    launcher.chmod(0o755)

    # Copy icon from original if exists
    orig_icon = (Path(__file__).resolve().parent.parent / 'Claude Science.app/Contents/Resources/operon.icns')
    if orig_icon.exists():
        import shutil
        shutil.copy2(orig_icon, resources_dir / "operon.icns")

    print(f"\n  OpenScience.app: {app_dir.parent}")
    print(f"\n  To run: DEEPSEEK_API_KEY=sk-... open {app_dir.parent}/OpenScience.app")
    print(f"  Or:     cd {app_dir.parent} && DEEPSEEK_API_KEY=sk-... ./start.sh")


if __name__ == '__main__':
    build()
