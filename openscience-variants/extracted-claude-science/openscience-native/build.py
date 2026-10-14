#!/usr/bin/env python3
"""
OpenScience -- Native Fetch Proxy Injection (Approach C)

Strategy: Inject a globalThis.fetch wrapper into the binary's startup that
transparently converts Anthropic Messages API <-> OpenAI Chat Completions API.

This IS approach C -- the Anthropic SDK calls are replaced at the fetch level,
which is the single entry point for all network API calls. No external proxy needed.

After injection: binary is fully self-contained, talks directly to api.deepseek.com
"""

# Retained experimental implementation. Native reconstruction requires the original
# complete Bun executable layout and metadata; header + JS concatenation is invalid.
if __name__ == "__main__":
    raise SystemExit("Native rebuild/install is unavailable: complete original Bun metadata is missing. Use ../ClaudeScience-patched/launch.sh with an original executable.")

import os, sys, json, re
from pathlib import Path

SRC = (Path(__file__).resolve().parent.parent / 'openscience-src')
OUT = (Path(__file__).resolve().parent.parent / 'openscience-native')
HEADER = (Path(__file__).resolve().parent.parent / 'ClaudeScience-patched/extracted/header.bin')
BUNDLE = (Path(__file__).resolve().parent.parent / 'ClaudeScience-patched/extracted/bundle.js')

# Output directories are created only by an explicitly invoked producer.

# ============================================================
# THE EMBEDDED FETCH PROXY
# Injected at binary startup
# ============================================================

FETCH_PROXY = r'''
// ===== OpenScience DeepSeek Fetch Proxy =====
// Intercepts all fetch() calls to api.anthropic.com and translates
// Anthropic Messages API <-> OpenAI Chat Completions API
(()=>{
  const DS_KEY = ()=>globalThis.process?.env?.DEEPSEEK_API_KEY?.trim()||
                   globalThis.process?.env?.ANTHROPIC_API_KEY?.trim()||"";
  const DS_URL = ()=>globalThis.process?.env?.DEEPSEEK_BASE_URL?.trim()||
                   globalThis.process?.env?.ANTHROPIC_BASE_URL?.trim()||
                   "https://api.deepseek.com/v1";

  const MODEL_MAP = {
    "claude-sonnet-4-6":"deepseek-chat","claude-sonnet-4-5":"deepseek-chat",
    "claude-opus-4-8":"deepseek-reasoner","claude-opus-4-7":"deepseek-reasoner",
    "claude-opus-4-6":"deepseek-reasoner","claude-haiku-4-5":"deepseek-chat",
    "claude-3-5-sonnet":"deepseek-chat","claude-3-opus":"deepseek-reasoner",
    "claude-3-haiku":"deepseek-chat",
  };

  function anthro2openai(body){
    const msgs=[];
    if(body.system){
      const t=typeof body.system==="string"?body.system:
        (Array.isArray(body.system)?body.system.filter(b=>b.type==="text").map(b=>b.text).join("\n"):"");
      if(t) msgs.push({role:"system",content:t});
    }
    for(const m of(body.messages||[])){
      if(typeof m.content==="string"){msgs.push({role:m.role,content:m.content});continue}
      if(!Array.isArray(m.content)){msgs.push({role:m.role,content:""});continue}
      let text="",toolResults=[],toolCalls=[];
      for(const b of m.content){
        if(b.type==="text") text+=b.text+"\n";
        else if(b.type==="tool_use") toolCalls.push(b);
        else if(b.type==="tool_result"){
          const c=typeof b.content==="string"?b.content:
            Array.isArray(b.content)?b.content.map(x=>x.text||"").join("\n"):"";
          toolResults.push({role:"tool",content:c,tool_call_id:b.tool_use_id});
        }
      }
      if(toolCalls.length){
        msgs.push({role:"assistant",content:text.trim()||null,
          tool_calls:toolCalls.map(t=>({id:t.id||"call_"+Math.random().toString(36).slice(2),
            type:"function",function:{name:t.name,arguments:JSON.stringify(t.input||{})}}))});
        continue;
      }
      if(toolResults.length){msgs.push(...toolResults);continue}
      msgs.push({role:m.role,content:text.trim()});
    }
    const tools=(body.tools||[]).map(t=>({type:"function",
      function:{name:t.name,description:t.description||"",parameters:t.input_schema||{}}}));
    return {
      model:MODEL_MAP[body.model]||"deepseek-chat",
      messages:msgs,
      max_tokens:body.max_tokens||4096,
      temperature:body.temperature??0.7,
      stream:!!body.stream,
      ...(tools.length?{tools}:{}),
    };
  }

  function openai2anthro(resp,origModel){
    const c=resp.choices?.[0]||{},m=c.message||{},content=[];
    if(m.reasoning_content) content.push({type:"thinking",thinking:m.reasoning_content});
    if(m.content) content.push({type:"text",text:m.content});
    for(const tc of(m.tool_calls||[])){
      let args={};
      try{args=JSON.parse(tc.function?.arguments||"{}")}catch{}
      content.push({type:"tool_use",id:tc.id,name:tc.function?.name||"",input:args});
    }
    const u=resp.usage||{};
    return {
      id:"msg_"+Math.random().toString(36).slice(2,14),type:"message",role:"assistant",
      content,model:origModel,
      stop_reason:c.finish_reason==="stop"?"end_turn":
        c.finish_reason==="tool_calls"?"tool_use":"end_turn",
      usage:{input_tokens:u.prompt_tokens||0,output_tokens:u.completion_tokens||0},
    };
  }

  function openaiSSE2anthroSSE(line,ctx){
    if(!line.startsWith("data: ")) return null;
    const d=line.slice(6);
    if(d==="[DONE]") return '\n{"type":"message_stop"}\n';
    let chunk;
    try{chunk=JSON.parse(d)}catch{return null}
    const delta=chunk.choices?.[0]?.delta||{},fr=chunk.choices?.[0]?.finish_reason||"";
    const events=[];
    if(!ctx.started){
      ctx.started=true,ctx.blocks=[];
      events.push(JSON.stringify({type:"message_start",message:{
        id:"msg_"+Math.random().toString(36).slice(2,14),type:"message",role:"assistant",
        content:[],model:ctx.model,
        usage:{input_tokens:chunk.usage?.prompt_tokens||0,output_tokens:0}
      }}));
    }
    if(delta.reasoning_content&&!ctx.rIdx){
      ctx.rIdx=ctx.blocks.length;
      ctx.blocks.push({type:"thinking",thinking:""});
      events.push(JSON.stringify({type:"content_block_start",index:ctx.rIdx,
        content_block:{type:"thinking",thinking:""}}));
    }
    if(delta.reasoning_content){
      ctx.blocks[ctx.rIdx].thinking+=delta.reasoning_content;
      events.push(JSON.stringify({type:"content_block_delta",index:ctx.rIdx,
        delta:{type:"thinking_delta",thinking:delta.reasoning_content}}));
    }
    if(delta.content&&!ctx.tIdx){
      ctx.tIdx=ctx.blocks.length;
      ctx.blocks.push({type:"text",text:""});
      events.push(JSON.stringify({type:"content_block_start",index:ctx.tIdx,
        content_block:{type:"text",text:""}}));
    }
    if(delta.content){
      ctx.blocks[ctx.tIdx].text+=delta.content;
      events.push(JSON.stringify({type:"content_block_delta",index:ctx.tIdx,
        delta:{type:"text_delta",text:delta.content}}));
    }
    if(delta.tool_calls){
      for(const tc of delta.tool_calls){
        if(!ctx.tcStarts[tc.index]){
          ctx.tcStarts[tc.index]=true;
          const tci=ctx.blocks.length;
          const id=tc.id||"call_"+Math.random().toString(36).slice(2,10);
          ctx.blocks.push({type:"tool_use",id,name:"",input:{}});
          ctx.tcIds[tc.index]=id;
          events.push(JSON.stringify({type:"content_block_start",index:tci,
            content_block:{type:"tool_use",id,name:"",input:{}}}));
        }
      }
    }
    if(fr){
      const u=chunk.usage||{};
      events.push(JSON.stringify({type:"message_delta",delta:{
        stop_reason:fr==="stop"?"end_turn":fr==="tool_calls"?"tool_use":"end_turn",
        usage:{input_tokens:u.prompt_tokens||0,output_tokens:u.completion_tokens||0}
      }}));
      events.push(JSON.stringify({type:"message_stop"}));
    }
    return events.join("\n");
  }

  const origFetch=globalThis.fetch;
  globalThis.fetch=async function(input,init){
    const url=typeof input==="string"?input:input?.url;
    if(url&&url.includes("/v1/messages")&&(url.includes("anthropic.com")||init?.body?.includes?.("anthropic"))){
      try{
        const body=JSON.parse((typeof init?.body==="string"?init?.body:init?.body?.toString())||"{}");
        const isStream=!!body.stream;
        const openaiBody=anthro2openai(body);
        const base=DS_URL().replace(/\/+$/,"");
        const apiUrl=base+"/chat/completions";
        const resp=await origFetch(apiUrl,{
          method:"POST",
          headers:{"Content-Type":"application/json","Authorization":"Bearer "+DS_KEY()},
          body:JSON.stringify(openaiBody),
        });
        if(!isStream){
          const data=await resp.json();
          return new Response(JSON.stringify(openai2anthro(data,body.model)),{
            status:200,headers:{"content-type":"application/json"},
          });
        }
        // Streaming: convert OpenAI SSE -> Anthropic SSE
        const reader=resp.body.getReader(),dec=new TextDecoder();
        const ctx={started:false,rIdx:null,tIdx:null,tcStarts:{},tcIds:{},model:body.model,blocks:[]};
        let buf="";
        const newStream=new ReadableStream({
          async start(ctrl){
            try{
              while(true){
                const{done,value}=await reader.read();
                if(done)break;
                buf+=dec.decode(value,{stream:true});
                const lines=buf.split("\n");buf=lines.pop()||"";
                for(const l of lines){
                  if(l.startsWith("data: ")){
                    const processed=openaiSSE2anthroSSE(l,ctx);
                    if(processed) ctrl.enqueue(new TextEncoder().encode(processed+"\n"));
                  }
                }
              }
            }catch(e){}finally{ctrl.close()}
          }
        });
        return new Response(newStream,{
          status:200,headers:{"content-type":"text/event-stream"},
        });
      }catch(e){
        // On proxy error, fall through to original fetch (may cause auth error but won't break)
        console.warn("[OpenScience] proxy error:",e.message);
      }
    }
    return origFetch.call(this,input,init);
  };
})();
'''


# ============================================================
# INJECTION
# ============================================================

def inject_proxy(bundle_data):
    """Inject the fetch proxy into the bundle at the right location."""
    # Find a good injection point: after all function-wrapped modules but
    # before S-module 0 (the first app module)
    # S-module 0 starts at the first S(()=>{ after the function-wrapped modules
    first_sm = bundle_data.find(b'S(()=>{', 6028)
    if first_sm < 0:
        print("  X Could not find S-module start!")
        return None

    # We inject right BEFORE the first S(()=>{ so the proxy is available
    # when any module tries to make API calls
    # Also, let's first strip any existing fetch proxy injection attempts
    # Then insert at module 0 boundary

    # Strip non-ASCII chars from proxy string
    proxy_clean = FETCH_PROXY.encode('ascii', errors='replace').decode('ascii')
    proxy_clean = proxy_clean.replace('?', '-')
    proxy_bytes = proxy_clean.encode('latin-1')

    # Insert after the last function-wrapped module
    # The last function module ends at 'first_sm'
    # We need to insert at 'first_sm', shifting everything after

    before = bundle_data[:first_sm]
    after = bundle_data[first_sm:]

    # Add a small comment and the proxy
    marker = b'\n// [OpenScience DeepSeek Proxy]\n'
    new_bundle = before + marker + proxy_bytes + marker + after

    print(f"  Injected proxy at byte {first_sm:,}")
    print(f"  Proxy size: {len(proxy_bytes):,} bytes")
    print(f"  New bundle size: {len(new_bundle):,} bytes (delta: {len(new_bundle)-len(bundle_data):,})")

    return new_bundle


def patch_env_vars(bundle):
    """Also do simple env var patches in the binary."""
    result = bytearray(bundle)

    # Patch 1: ANTHROPIC_API_KEY -> DEEPSEEK_API_KEY in key code paths
    # Only in specific locations to avoid breaking config
    patches = [
        # In the env var list (ndG array) -- add DEEPSEEK_API_KEY
        (b'ndG=["ANTHROPIC_API_KEY"', b'ndG=["DEEPSEEK_API_KEY","ANTHROPIC_API_KEY"'),
        (b'nJ=["ANTHROPIC_API_KEY"', b'nJ=["DEEPSEEK_API_KEY","ANTHROPIC_API_KEY"'),
        (b'q4=["ANTHROPIC_API_KEY"', b'q4=["DEEPSEEK_API_KEY","ANTHROPIC_API_KEY"'),

        # Default model names
        (b'QmO="claude-opus-4-8"', b'QmO="deepseek-reasoner"'),
        (b'hA="claude-haiku-4-5-20251001"', b'hA="deepseek-chat"'),

        # ENV var reads in client
        (b'i__("ANTHROPIC_API_KEY")', b'i__("DEEPSEEK_API_KEY")||i__("ANTHROPIC_API_KEY")'),
    ]

    applied = 0
    for old, new in patches:
        if len(new) <= len(old):
            # Pad with spaces to match length
            new_padded = new + b' ' * (len(old) - len(new))
            idx = result.find(old)
            if idx >= 0:
                result[idx:idx+len(old)] = new_padded
                applied += 1
                print(f"  v Patched env var at 0x{idx:x}: {old[:30].decode('latin-1', errors='replace')}")
        else:
            # Replacement is longer -- must use the proxy approach instead
            print(f"  ~ Skipped (too long): {old[:30].decode('latin-1', errors='replace')}")

    print(f"  Applied {applied} env var patches")
    return bytes(result)


# ============================================================
# BUILD
# ============================================================

def build():
    print("=" * 50)
    print("  OpenScience -- Native DeepSeek Binary")
    print("=" * 50)
    print()

    # Read original bundle
    print("[1/4] Reading original bundle...")
    bundle = BUNDLE.read_bytes()
    print(f"  Size: {len(bundle):,} bytes")

    # Inject fetch proxy
    print("\n[2/4] Injecting DeepSeek fetch proxy...")
    bundle = inject_proxy(bundle)
    if bundle is None:
        return

    # Apply env var patches
    print("\n[3/4] Applying env var patches...")
    bundle = patch_env_vars(bundle)

    # Build final binary
    print("\n[4/4] Building final binary...")
    header = HEADER.read_bytes()
    full = header + bundle

    binary_out = OUT / "claude-science"
    binary_out.write_bytes(full)
    binary_out.chmod(0o755)
    print(f"  Binary: {binary_out} ({len(full):,} bytes)")

    # Verification
    total_anthropic = bundle.count(b'api.anthropic.com')
    print(f"\n  Verification:")
    print(f"    api.anthropic.com refs: {total_anthropic}")
    print(f"    Fetch proxy injected: {'OpenScience DeepSeek' in bundle.decode('latin-1', errors='replace')}")
    print(f"    DEEPSEEK_API_KEY added: {bundle.count(b'DEEPSEEK_API_KEY')}")

    # Launcher
    launcher = OUT / "start.sh"
    launcher.write_text(f'''#!/bin/bash
# OpenScience - Native DeepSeek (fetch proxy)
DIR="$(cd "$(dirname "$0")" && pwd)"
echo "============================================"
echo "  OpenScience"
echo "  DeepSeek Native (fetch proxy)"
echo "============================================"
export DEEPSEEK_API_KEY="${{DEEPSEEK_API_KEY:-}}"
if [ -z "$DEEPSEEK_API_KEY" ]; then
  echo "  ERROR: DEEPSEEK_API_KEY not set"
  echo "  Usage: DEEPSEEK_API_KEY=sk-... ./start.sh"
  exit 1
fi
"$DIR/claude-science" serve &
PID=$!
sleep 3
URL=$("$DIR/claude-science" url 2>/dev/null | head -1)
echo "  Open: $URL"
echo "  LLM: DeepSeek (fetch proxy, no external dependencies)"
trap "kill $PID 2>/dev/null; exit 0" INT TERM
wait
''')
    launcher.chmod(0o755)
    print(f"\n  Launcher: {launcher}")
    print(f"\n  Run: DEEPSEEK_API_KEY=sk-... {launcher}")


if __name__ == '__main__':
    build()
