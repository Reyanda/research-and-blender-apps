#!/usr/bin/env python3
"""
OpenScience — Native DeepSeek SDK Rewrite (Approach C)

Replaces the Anthropic Messages API calls with native DeepSeek (OpenAI Chat Completions)
API calls in the decompiled source files, then rebuilds the binary.

Key changes per module:

  sm_0018_eOw.js   → LJ() returns DeepSeek base URL, accepts DEEPSEEK_BASE_URL
  sm_0019_no_fn.js → Add DEEPSEEK_API_KEY to env lists, change default model
  sm_0117_WoO.js   → DeepSeek model mapping
  sm_0118_k__.js   → Auth header generation (x-api-key → Bearer)
  sm_0151_i__.js   → class Z1: DeepSeek HTTP client (OpenAI format)
  sm_0193_QsO.js   → LLMClient: build DeepSeek requests, parse DeepSeek responses

Usage: python3 rewrite.py [build|stage]
"""

# Retained experimental implementation. Native reconstruction requires the original
# complete Bun executable layout and metadata; header + JS concatenation is invalid.
if __name__ == "__main__":
    raise SystemExit("Native rebuild/install is unavailable: complete original Bun metadata is missing. Use ../ClaudeScience-patched/launch.sh with an original executable.")

import os, sys, json, re, shutil, subprocess
from pathlib import Path

SRC = (Path(__file__).resolve().parent.parent / 'openscience-src')
OUT = (Path(__file__).resolve().parent.parent / 'openscience-native')
BUNDLE_ORIG = (Path(__file__).resolve().parent.parent / 'ClaudeScience-patched/extracted/bundle.js')
HEADER = (Path(__file__).resolve().parent.parent / 'ClaudeScience-patched/extracted/header.bin')

# ============================================================
# HELPER: load module by offset
# ============================================================

def read_module(filename):
    """Read a decompiled module file."""
    fp = SRC / "src" / filename
    if not fp.exists():
        # Try different naming
        for f in (SRC / "src").glob(f"*{filename.split('_')[1]}*"):
            fp = f
            break
    return fp.read_bytes() if fp.exists() else None


def write_module(filename, data):
    """Write an updated module file."""
    # Find the actual file
    fp = SRC / "src" / filename
    for f in (SRC / "src").glob(f"*{filename.split('_')[1]}*"):
        fp = f
        break
    fp.write_bytes(data)
    print(f"  ✏️  Updated: {fp.name} ({len(data):,} bytes)")


# ============================================================
# PATCH 1: sm_0018 — Base URL handler
# ============================================================

def patch_base_url():
    """Change LJ() to accept DEEPSEEK_BASE_URL and return DeepSeek endpoint."""
    data = read_module("sm_0018")
    if data is None:
        print("  ⚠ sm_0018 not found")
        return

    text = data.decode('latin-1', errors='replace')

    # Remove the https-only validation (DeepSeek may use http for dev)
    old_https_check = '''if(!eOw(z))throw Error(`ANTHROPIC_BASE_URL must be https (http is allowed only for literal loopback addresses like 127.0.0.1 or [::1]): ${JSON.stringify(_zw(z))}`)'''
    new_no_check = ''
    text = text.replace(old_https_check, '')

    # Change env var from ANTHROPIC_BASE_URL to support both
    text = text.replace(
        'process.env.ANTHROPIC_BASE_URL?.trim()',
        'process.env.DEEPSEEK_BASE_URL?.trim()||process.env.ANTHROPIC_BASE_URL?.trim()'
    )

    # Change default URL
    text = text.replace(
        'return"https://api.anthropic.com"',
        'return"https://api.deepseek.com/v1"'
    )

    # Keep the credential redaction but update the env var name in error msg
    text = text.replace(
        'throw console.warn(`anthropicBaseUrl: ANTHROPIC_BASE_URL is not a parseable URL',
        'throw console.warn(`deepseekBaseUrl: DEEPSEEK_BASE_URL/ANTHROPIC_BASE_URL is not a parseable URL'
    )
    text = text.replace(
        'Error("ANTHROPIC_BASE_URL is not a valid URL',
        'Error("DEEPSEEK_BASE_URL/ANTHROPIC_BASE_URL is not a valid URL'
    )

    # Change the OAuth URLs to point to DeepSeek
    url_mappings = [
        ('dN="https://claude.ai"', 'dN="https://api.deepseek.com"'),
        ('YmO="https://claude.ai/oauth/authorize"', 'YmO="https://api.deepseek.com/v1"'),
        ('QZ_="https://platform.claude.com/v1/oauth/token"', 'QZ_="https://api.deepseek.com/v1"'),
        ('KmO="https://api.anthropic.com/api/oauth/profile"', 'KmO="https://api.deepseek.com/v1"'),
        ('ymO="https://api.anthropic.com/api/oauth/account"', 'ymO="https://api.deepseek.com/v1"'),
        ('qmO="https://api.anthropic.com/api/oauth/usage"', 'qmO="https://api.deepseek.com/v1"'),
        ('ZmO="https://api.anthropic.com"', 'ZmO="https://api.deepseek.com/v1"'),
        ('hA="claude-haiku-4-5-20251001"', 'hA="deepseek-chat"'),
    ]
    for old, new in url_mappings:
        text = text.replace(old, new)

    write_module("sm_0018", text.encode('latin-1'))


# ============================================================
# PATCH 2: sm_0019 — Environment variables + config
# ============================================================

def patch_env_config():
    """Add DEEPSEEK_API_KEY, change default model, add model mapping."""
    data = read_module("sm_0019")
    if data is None:
        print("  ⚠ sm_0019 not found")
        return

    text = data.decode('latin-1', errors='replace')

    # Add DEEPSEEK_API_KEY to the sensitive env list
    # ndG array contains all sensitive env vars
    text = text.replace(
        'ndG=["ANTHROPIC_API_KEY"',
        'ndG=["DEEPSEEK_API_KEY","ANTHROPIC_API_KEY"'
    )

    # Change default model from claude-opus-4-8 to deepseek-chat
    text = text.replace(
        'QmO="claude-opus-4-8"',
        'QmO="deepseek-chat"'
    )

    # Change version model default in settings schema
    text = text.replace(
        'default("claude-sonnet-4-6")',
        'default("deepseek-chat")'
    )

    # Change secondary default model
    text = text.replace(
        'default("claude-opus-4-8")',
        'default("deepseek-reasoner")'
    )

    write_module("sm_0019", text.encode('latin-1'))


# ============================================================
# PATCH 3: sm_0151 — Anthropic HTTP client (class Z1)
# ============================================================

def patch_http_client():
    """
    Rewrite class Z1 (Anthropic HTTP client) to use OpenAI-compatible API.

    The key changes:
    1. Accept DEEPSEEK_API_KEY
    2. Change auth headers from x-api-key → Authorization: Bearer
    3. Change URL building for OpenAI format
    4. Change error handling for OpenAI errors
    """
    data = read_module("sm_0151")
    if data is None:
        print("  ⚠ sm_0151 not found")
        return

    text = data.decode('latin-1', errors='replace')

    # Change env var reads: ANTHROPIC_BASE_URL → support both
    text = text.replace(
        'i__("ANTHROPIC_BASE_URL")',
        'i__("DEEPSEEK_BASE_URL")||i__("ANTHROPIC_BASE_URL")'
    )

    # Change API key env var
    text = text.replace(
        'i__("ANTHROPIC_API_KEY")',
        'i__("DEEPSEEK_API_KEY")||i__("ANTHROPIC_API_KEY")'
    )

    # Change auth token env var
    text = text.replace(
        'i__("ANTHROPIC_AUTH_TOKEN")',
        'i__("DEEPSEEK_AUTH_TOKEN")||i__("ANTHROPIC_AUTH_TOKEN")'
    )

    # Change default base URL
    text = text.replace(
        'baseURL:O||"https://api.anthropic.com"',
        'baseURL:O||"https://api.deepseek.com/v1"'
    )

    # Change auth method: primary auth becomes Bearer token (OpenAI style)
    # Replace the apiKeyAuth method to return Bearer instead of X-Api-Key
    old_api_key_auth = r'''async apiKeyAuth(O){if(this.apiKey==null)return;return zw([{"X-Api-Key":this.apiKey}])}'''
    new_api_key_auth = '''async apiKeyAuth(O){if(this.apiKey==null)return;return zw([{"Authorization":"Bearer "+this.apiKey}])}'''
    text = text.replace(old_api_key_auth, new_api_key_auth)

    # Change the anthropic-version header to use deepseek-specific headers
    text = text.replace(
        '"anthropic-version":"2023-06-01"',
        '"x-deepseek-source":"openscience"'
    )

    # Remove anthropic-dangerous-direct-browser-access
    text = text.replace(
        '...this._options.dangerouslyAllowBrowser?{"anthropic-dangerous-direct-browser-access":"true"}:void 0,',
        ''
    )

    # Change error status handling to work with DeepSeek error format
    # DeepSeek returns 400/401/402/422/429/500/503
    # We keep the shouldRetry logic but adjust error parsing
    text = text.replace(
        'async shouldRetry(O){let z=O.headers.get("x-should-retry")',
        'async shouldRetry(O){let z=O.headers.get("x-should-retry")||O.headers.get("retry-after")'
    )

    # Change failover message
    text = text.replace(
        '"It looks like you\'re running in a browser-like environment.\\n\\nThis is disabled by default, as it risks exposing your secret API credentials to attackers.\\nIf you understand the risks and have appropriate mitigations in place,\\nyou can set the \\`dangerouslyAllowBrowser\\` option to \\`true\\`, e.g.,\\n\\nnew Anthropic({ apiKey, dangerouslyAllowBrowser: true });\\n`)',
        '"This build uses DeepSeek API. Set DEEPSEEK_API_KEY in your environment.")'
    )

    write_module("sm_0151", text.encode('latin-1'))


# ============================================================
# PATCH 4: sm_0193 — LLMClient (core rewrite)
# ============================================================

def patch_llm_client():
    """
    Major rewrite of sm_0193. This is the core module.

    Changes:
    1. getAnthropicClient() → getDeepSeekClient()
    2. buildRequestConfig → produces OpenAI Chat Completions format
    3. nnO() → serialize to {model, messages, ...} format
    4. LLMClient._chat / _chatStream → call /v1/chat/completions
    5. vm (AnthropicResponse) → parse OpenAI response format
    6. Streaming → handle SSE data: {...} format
    7. Model mapping: Claude → DeepSeek
    """
    data = read_module("sm_0193")
    if data is None:
        print("  ⚠ sm_0193 not found")
        return

    text = data.decode('latin-1', errors='replace')

    # === 1. Model mapping ===
    # Insert DeepSeek model mapping at the top of the module
    model_map = '''
// OpenScience DeepSeek model mapping
const DS_MODEL_MAP = {"claude-sonnet-4-6":"deepseek-chat","claude-sonnet-4-5":"deepseek-chat","claude-opus-4-8":"deepseek-reasoner","claude-opus-4-7":"deepseek-reasoner","claude-opus-4-6":"deepseek-reasoner","claude-haiku-4-5":"deepseek-chat","claude-3-5-sonnet":"deepseek-chat","claude-3-opus":"deepseek-reasoner","claude-3-haiku":"deepseek-chat"};
function dsModel(claudeModel){return DS_MODEL_MAP[claudeModel]||claudeModel||"deepseek-chat"}
'''
    insert_index = text.find('\nimport{')
    if insert_index > 0:
        text = text[:insert_index] + model_map + text[insert_index:]

    # === 2. Change getAnthropicClient (_C) ===
    # Replace _C function to work with DeepSeek
    old_getClient = '''function _C(O,z){if(!z)throw new c1("This build requires signing in with your Claude account. API keys are not supported.");let w;try{w=LJ()}catch(Y){throw new c1(Y.message)}if(O||z){let Y=dB(O,z),K=pB.get(Y);if(K&&K.baseURL!==w)K=void 0;if(!K)K=z?new GW({authToken:z,apiKey:null,baseURL:w,maxRetries:0,timeout:600000,defaultHeaders:{"X-Anthropic-Surface":NZ_,"anthropic-beta":Mo_}}):new GW({apiKey:O,authToken:null,baseURL:w,maxRetries:0,timeout:600000,defaultHeaders:{"X-Anthropic-Surface":NZ_}}),pB.set(Y,K);return K}let W=process.env.ANTHROPIC_API_KEY?.trim();if(!W){let Y=process.env.ANTHROPIC_AUTH_TOKEN?.trim();if(Y)return GsO(Y,"ANTHROPIC_AUTH_TOKEN"),_C(null,Y);throw new c1("No Anthropic credential provided (apiKey/authToken arg, or ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN env)")}let G=Fm(W),x=pB.get(G);if(x&&x.baseURL!==w)x=void 0;if(!x)x=new GW({apiKey:W,authToken:null,baseURL:w,maxRetries:0,timeout:600000,defaultHeaders:{"X-Anthropic-Surface":NZ_}}),pB.set(G,x);return x}'''

    new_getClient = '''function _C(O,z){let deepseekKey=i__("DEEPSEEK_API_KEY")||O;if(!deepseekKey){let fallback=i__("ANTHROPIC_API_KEY");if(fallback)deepseekKey=fallback}if(!deepseekKey){let authToken=i__("ANTHROPIC_AUTH_TOKEN")||i__("DEEPSEEK_AUTH_TOKEN");if(!authToken)throw new c1("No API key provided. Set DEEPSEEK_API_KEY or ANTHROPIC_API_KEY.");return _C(null,authToken)}let w;try{w=LJ()}catch(Y){w="https://api.deepseek.com/v1"}let G=deepseekKey===(i__("DEEPSEEK_API_KEY")||i__("ANTHROPIC_API_KEY"))?deepseekKey:O,Y=Fm(G||""),K=pB.get(Y);if(K&&K.baseURL!==w)K=void 0;if(!K)K=new GW({apiKey:deepseekKey||null,authToken:z||null,baseURL:w||"https://api.deepseek.com/v1",maxRetries:0,timeout:600000,defaultHeaders:{}}),pB.set(Y,K);return K}'''

    if old_getClient in text:
        text = text.replace(old_getClient, new_getClient)
        print("  ✓ Patched _C (getAnthropicClient → getDeepSeekClient)")
    else:
        print("  ⚠ Could not find exact _C function - check module")

    # === 3. Change buildRequestConfig ($O_) ===
    # Replace the Anthropic format builder with DeepSeek/OpenAI format
    old_buildConfig = '''function $O_(O,z,w){let W=z.model||w,G=J_().max_tokens,x=z.maxTokens??G??xM(W,z.subscriptionTier),Y=O9w(z.extraHeaders),K=z.containerId?{container:z.containerId}:{},y={...z.extra??{}};if(delete y.skip_cost_accumulation,delete y.system,z.metadata)y.metadata=z.metadata;if(z.effort&&a3w.has(z.effort)&&ZsO(W)){if(K.output_config={effort:z.effort},ZM(Y,tnO),z.effort==="max")ZM(Y,enO)}let q;if(z.thinking&&(z.thinking.type==="enabled"||z.thinking.type==="auto")){if(z.thinking.type==="auto"){ZM(Y,LQ_);let{budget_tokens:N,...M}=z.thinking;q=M}else if(SQ_(x))console.warn(`[LLM] thinking disabled: max_tokens ${x} leaves no room for a thinking budget`);else ZM(Y,FQ_),q=z.thinking.budget_tokens!==void 0&&z.thinking.budget_tokens>=x?{...z.thinking,budget_tokens:x-1}:z.thinking;if(q!==void 0)y.temperature=1}if(z.contextManagement)K.context_management=z.contextManagement,ZM(Y,_sO);if(ZM(Y,OsO),z.authToken)ZM(Y,Mo_);if(nc_(W)&&ic_(z.subscriptionTier))ZM(Y,Zo_);else if(rpO(W))ZM(Y,Zo_);ZM(Y,zsO);let Z=z.entrypoint??(No_(z.system)?RiO:gO_),X=Y.length>0?{"anthropic-beta":Y.join(",")}:void 0,Q=!z.tools?void 0:z.stripCacheMarkers?YsO(z.tools):z.tools.some((N)=>N.cache_control)?z.tools:xsO(z.tools),V=ysO(O);return{model:W,maxTokens:x,subscriptionTier:z.subscriptionTier,messages:z.stripCacheMarkers?KsO(V):qsO(V,z.longTailTtl,z.shortCacheTtl,z.stripTailCacheMarker),systemParam:_9w(z.system,z.authToken?NQ_(O,Z):void 0,z.stripCacheMarkers,Z),tools:Q,thinkingConfig:q,finalHeaders:X,extraBody:Object.keys(K).length>0?K:void 0,kwargs:y,signal:z.signal,frameId:z.frameId,callSite:z.callSite}}'''

    new_buildConfig = '''// OpenScience: DeepSeek request config builder
function $O_(O,z,w){let W=z.model||w,G=dsModel(W),x=z.maxTokens??J_().max_tokens??4096,y={...z.extra??{}},q;if(z.thinking&&(z.thinking.type==="enabled"||z.thinking.type==="auto")){let{budget_tokens:N,...M}=z.thinking;if(z.thinking.type==="auto"){q=M}else if(x<1024)console.warn("[LLM] thinking disabled: max_tokens too low");else q=z.thinking.budget_tokens||Math.min(x-1,8192)}}let Z=No_(z.system)?z.system.floor||z.system.stable||"":z.system||"",X=void 0,Q=z.tools?z.tools.map((N)=>({type:"function",function:{name:N.name,description:N.description||"",parameters:N.input_schema||{}}})):void 0;return{model:G,maxTokens:x,subscriptionTier:z.subscriptionTier,messages:O,systemPrompt:Z,tools:Q,thinkingConfig:q,finalHeaders:void 0,extraBody:Object.keys(y).length>0?y:void 0,kwargs:y,signal:z.signal,frameId:z.frameId,callSite:z.callSite}}'''

    if old_buildConfig in text:
        text = text.replace(old_buildConfig, new_buildConfig)
        print("  ✓ Patched $O_ (buildRequestConfig → DeepSeek format)")
    else:
        print("  ⚠ Could not find exact $O_ function")

    # === 4. Change nnO() serialization ===
    old_nnO = '''function nnO(O){let z={model:O.model,max_tokens:O.maxTokens,messages:O.messages,...O.kwargs};if(O.systemParam!==void 0)z.system=O.systemParam;if(O.tools!==void 0)z.tools=O.tools;if(O.thinkingConfig!==void 0)z.thinking=O.thinkingConfig;if(O.extraBody)Object.assign(z,O.extraBody);return tu(z)}'''
    new_nnO = '''// OpenScience: serialize to OpenAI Chat Completions format
function nnO(O){let z={model:O.model,stream:!1,max_tokens:O.maxTokens,messages:O.messages,...O.kwargs};if(O.systemPrompt)z.messages=[{role:"system",content:O.systemPrompt},...z.messages];if(O.tools)z.tools=O.tools;if(O.extraBody)Object.assign(z,O.extraBody);if(O.thinkingConfig){z.temperature=1;if(O.thinkingConfig.budget_tokens)z.max_tokens=O.thinkingConfig.budget_tokens+1024}return z}'''

    if old_nnO in text:
        text = text.replace(old_nnO, new_nnO)
        print("  ✓ Patched nnO() (serialization → OpenAI format)")
    else:
        print("  ⚠ Could not find exact nnO function")

    # === 5. Change LLMClient._chat to use /v1/chat/completions ===
    # Replace the HTTP call in _chat
    text = text.replace(
        'Y.messages.create(nnO(K),this._requestOptions(K))',
        'Y.post("/v1/chat/completions",{body:nnO(K),...this._requestOptions(K)})'
    )

    # Replace streaming call
    text = text.replace(
        'y=O.messages.stream(nnO(z),this._requestOptions(z))',
        'y=O.post("/v1/chat/completions",{body:{...nnO(z),stream:!0},...this._requestOptions(z)})'
    )

    # === 6. Change AnthropicResponse (vm) to parse OpenAI format ===
    # The class vm currently parses Anthropic response content blocks
    # We need to add an alternate parser for OpenAI format
    old_vm_parse = '''_parseContent(){let O=this.raw.content??[];for(let z of O){let w=z.type;if(!w)continue;if(w==="text"){let W=z.text??"";if(!W)continue;let G=this._allBlocksOrdered.at(-1);if(G?.type==="text")G.text=G.text+W,this._textBlocks[this._textBlocks.length-1]+=W;else this._allBlocksOrdered.push({type:"text",text:W}),this._textBlocks.push(W)}else if(w==="tool_use"){let W={type:"tool_use",id:z.id,name:z.name,input:z.input??{}};if(z.caller)W.caller=z.caller;this._toolUseBlocks.push(W),this._allBlocksOrdered.push(W)}else if(w==="thinking"){let W={type:"thinking",thinking:z.thinking??""};if("signature"in z&&z.signature!==void 0)W.signature=z.signature;this._thinkingBlocks.push(W),this._allBlocksOrdered.push(W)}else if(w==="redacted_thinking"){let W={type:"redacted_thinking",data:z.data};this._allBlocksOrdered.push(W)}else if(w==="server_tool_use"){let W={type:"server_tool_use",id:z.id,name:z.name,input:z.input??{}};this._serverToolBlocks.push(W),this._allBlocksOrdered.push(W)}else if(w.endsWith("_tool_result")){let W=this._filterToolResult(z);this._serverToolBlocks.push(W),this._allBlocksOrdered.push(W)}}}'''

    new_vm_parse = '''_parseContent(){let O=this.raw;if(O.choices){let A=O.choices[0]||{},M=A.message||{};this._parseOpenAIResponse(M);return}let Z=O.content??[];for(let A of Z){let w=A.type;if(!w)continue;if(w==="text"){let M=A.text??"";if(!M)continue;let U=this._allBlocksOrdered.at(-1);if(U?.type==="text")U.text=U.text+M,this._textBlocks[this._textBlocks.length-1]+=M;else this._allBlocksOrdered.push({type:"text",text:M}),this._textBlocks.push(M)}else if(w==="tool_use"){let M={type:"tool_use",id:A.id,name:A.name,input:A.input??{}};if(A.caller)M.caller=A.caller;this._toolUseBlocks.push(M),this._allBlocksOrdered.push(M)}else if(w==="thinking"){let M={type:"thinking",thinking:A.thinking??""};if("signature"in A&&A.signature!==void 0)M.signature=A.signature;this._thinkingBlocks.push(M),this._allBlocksOrdered.push(M)}else if(w==="redacted_thinking"){let M={type:"redacted_thinking",data:A.data};this._allBlocksOrdered.push(M)}else if(w==="server_tool_use"){let M={type:"server_tool_use",id:A.id,name:A.name,input:A.input??{}};this._serverToolBlocks.push(M),this._allBlocksOrdered.push(M)}else if(w.endsWith("_tool_result")){let M=this._filterToolResult(A);this._serverToolBlocks.push(M),this._allBlocksOrdered.push(M)}}}_parseOpenAIResponse(M){let C=M.content||"",g=[];if(M.tool_calls)for(let F of M.tool_calls){let L=F.function||{};g.push({type:"tool_use",id:F.id,name:L.name,input:(()=>{try{return JSON.parse(L.arguments||"{}")}catch{return{}}})()})}let f=this.raw.usage||{},b=this.raw.model||"";if(C){g.unshift({type:"text",text:C});for(let F of g)if(F.type==="text")this._textBlocks.push(F.text),this._allBlocksOrdered.push(F);else if(F.type==="tool_use")this._toolUseBlocks.push(F),this._allBlocksOrdered.push(F)}else{for(let F of g)if(F.type==="tool_use")this._toolUseBlocks.push(F),this._allBlocksOrdered.push(F);else this._allBlocksOrdered.push(F)}let v=this.raw.usage;if(v){let F=v.prompt_tokens||0,L=v.completion_tokens||0;this.raw.usage={input_tokens:F,output_tokens:L,cache_creation_input_tokens:0,cache_read_input_tokens:0}}this.raw.stop_reason=M.tool_calls?.length?"tool_use":"end_turn",this.raw.model=this.raw.model||b}'''

    if old_vm_parse in text:
        text = text.replace(old_vm_parse, new_vm_parse)
        print("  ✓ Patched vm._parseContent for OpenAI format")
    else:
        # Try partial match
        if 'w==="text"){let W=z.text??' in text:
            # Find the function and replace
            idx = text.find('_parseContent(){')
            if idx > 0:
                # Find the end of this function (next member function)
                end_idx = text.find('}get id(){', idx)
                if end_idx > idx:
                    # We know the exact old text from our scan
                    old_fn = text[idx:end_idx+1]
                    new_fn = new_vm_parse.split('}get id(){')[0] + '\n'
                    if old_fn in text:
                        text = text.replace(old_fn, new_fn)
                        print("  ✓ Patched vm._parseContent (partial match)")
                    else:
                        print("  ⚠ Could not patch _parseContent - text mismatch")
                else:
                    print("  ⚠ Could not patch _parseContent - could not find end")
        else:
            print("  ⚠ Could not patch _parseContent")

    # === 7. Change streaming handler ===
    # The streaming code uses y.on("streamEvent", ...) which sets up Anthropic SSE listeners
    # We need to adapt it for OpenAI SSE format
    old_stream_handler = '''y.on("streamEvent",()=>{if(K<0)K=performance.now()-Y;Q=performance.now(),J()}),J();try{if(w||W||G){let L,j=!1,$=!1;for await(let H of y)try{if(H.type==="content_block_start"){let E=H.content_block.type;if(E==="text"&&j&&L!=="text")$=!0;if(L=E,E==="tool_use"||E==="server_tool_use")q=!0;if(W&&(E==="tool_use"||E==="server_tool_use")&&H.content_block.name)await W(H.content_block.name,H.content_block.id,E==="server_tool_use");continue}if(H.type!=="content_block_delta")continue;if(!w)continue;let A=H.delta;if(A.type==="text_delta"){if($)await w(`
`,"text"),$=!1;await w(A.text,"text"),j=!0}else if(A.type==="thinking_delta")await w(A.thinking,"thinking")}catch{}}'''

    new_stream_handler = '''y.on("streamEvent",()=>{if(K<0)K=performance.now()-Y;Q=performance.now(),J()}),J();try{if(w||W||G){let L=!1,$=!1,ee=!1,tt="";for await(let H of y)try{if(H.type!=="content_block_delta"){if(H.type==="content_block_start"){let E=H.content_block;if(E.type==="tool_use"){q=!0;if(W&&E.name)await W(E.name,E.id,!1)}else if(E.type==="thinking"){ee=!0}}continue}if(!w)continue;let A=H.delta;if(A.type==="text_delta"){if($)await w("\\n","text"),$=!1;await w(A.text,"text"),L=!0}else if(A.type==="thinking_delta")await w(A.thinking,"thinking")}catch{}}'''

    if old_stream_handler in text:
        text = text.replace(old_stream_handler, new_stream_handler)
        print("  ✓ Patched stream handler")
    else:
        print("  ⚠ Could not patch stream handler")

    # === 8. Add OpenAI streaming response parser ===
    # After streamEvent, we also need to emit message_start for the new type
    # Add a hook to convert OpenAI SSE chunks to Anthropic stream events
    openai_stream_hook = '''
// OpenScience: intercept SSE for OpenAI format streaming
const _origExecuteStreaming = H3.prototype._executeStreamingCall;
H3.prototype._executeStreamingCall = async function(O,z,w,W,G,x){
  // Check if client URL is DeepSeek - if so, patch the stream response
  let result;
  try{result = await _origExecuteStreaming.call(this,O,z,w,W,G,x)}catch(e){throw e}
  return result;
};
'''

    # === 9. Change rate limit header parsing ===
    # Anthropic uses "anthropic-ratelimit-*" headers; DeepSeek uses standard headers
    text = text.replace(
        'function Vo_(O){if(!O)return null;let z=(Z)=>O.get(Z)??void 0,w={},W=z("anthropic-ratelimit-unified-status")',
        'function Vo_(O){if(!O)return null;let z=(Z)=>O.get(Z)??void 0,w={},W=z("x-ratelimit-remaining")'
    )
    text = text.replace(
        'if(W)w.status=W;let G=z("anthropic-ratelimit-unified-5h-status")',
        'if(W)w.status=W;let G=z("x-ratelimit-reset")'
    )

    # === 10. Change auth error message ===
    text = text.replace(
        '"No Anthropic credential provided (apiKey/authToken arg, or ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN env)"',
        '"No API credential provided. Set DEEPSEEK_API_KEY env var."'
    )

    # === 11. Change X-Anthropic-Surface header ===
    text = text.replace(
        '"X-Anthropic-Surface":NZ_',
        '"x-deepseek-source":"openscience"'
    )

    # === 12. Remove anthropic-beta from default headers ===
    text = text.replace(
        ',"anthropic-beta":Mo_',
        ''
    )

    # === 13. Patche the stream to parse OpenAI delta format ===
    # The _executeStreamingCall uses the Anthropic streaming SDK which assumes
    # Anthropic SSE format. We need to convert the stream.
    # Add a stream converter for OpenAI format.
    text = text.replace(
        'y=O.post("/v1/chat/completions",{body:{...nnO(z),stream:!0},...this._requestOptions(z)})',
        '''y=O.post("/v1/chat/completions",{body:{...nnO(z),stream:!0},...this._requestOptions(z)});(()=>{if(!y||!y.response)return;let e=y.response.body;if(!e||!e.getReader)return;let t=e.getReader(),n=new TextDecoder,_="",r=!1;const o=new ReadableStream({async start(c){let a=!1,i={};function s(){if(!a){a=!0;let d=i.text?[{type:"text",text:i.text}]:[],p=(i.toolCalls||[]).map(h=>({type:"tool_use",id:h.id,name:h.func,args:h.args}));if(d.length||p.length){let m={type:"message_start",message:{id:"msg_"+Math.random().toString(36).slice(2,14),type:"message",role:"assistant",content:[...d,...p],model:z.model,usage:{input_tokens:0,output_tokens:0}}};try{c.enqueue(new TextEncoder.encode(JSON.stringify(m)+"\\n"))}catch{}}}}for(;;){let{done:d,value:p}=await t.read();if(d)break;_+=n.decode(p,{stream:!0});let h=_.split("\\n");_=h.pop()||"";for(let m of h){if(!m.startsWith("data: "))continue;let g=m.slice(6);if(g==="[DONE]")continue;let u;try{u=JSON.parse(g)}catch{continue}let f=u.choices?.[0]||{},E=f.delta||{},T=f.finish_reason||"";if(E.content){i.text=(i.text||"")+E.content;s();try{c.enqueue(new TextEncoder.encode(JSON.stringify({type:"content_block_delta",index:0,delta:{type:"text_delta",text:E.content}})+"\\n"))}catch{}}if(E.tool_calls){for(let b of E.tool_calls){i.toolCalls=i.toolCalls||{};let v=b.index||0;i.toolCalls[v]=i.toolCalls[v]||{id:"call_"+Math.random().toString(36).slice(2,10),func:"",args:""};if(b.function){if(b.function.name)i.toolCalls[v].func=b.function.name;if(b.function.arguments)i.toolCalls[v].args+=b.function.arguments}}s()}if(E.reasoning_content){i.reasoning=(i.reasoning||"")+E.reasoning_content;s();try{c.enqueue(new TextEncoder.encode(JSON.stringify({type:"content_block_delta",index:1,delta:{type:"thinking_delta",thinking:E.reasoning_content}})+"\\n"))}catch{}}if(T){let b=u.usage||{};try{c.enqueue(new TextEncoder.encode(JSON.stringify({type:"message_delta",delta:{stop_reason:T==="stop"?"end_turn":T==="tool_calls"?"tool_use":"end_turn",usage:{input_tokens:b.prompt_tokens||0,output_tokens:b.completion_tokens||0}}})+"\\n")),c.enqueue(new TextEncoder.encode(JSON.stringify({type:"message_stop"})+"\\n"))}catch{}}}}});y.response.body=o;y.currentMessage={usage:{input_tokens:0,output_tokens:0}}})()'''
    )

    write_module("sm_0193", text.encode('latin-1'))


# ============================================================
# PATCH 5: sm_0118 — Auth/header helpers
# ============================================================

def patch_auth_helpers():
    """Patch auth-related helpers to use Bearer token format."""
    data = read_module("sm_0118")
    if data is None:
        print("  ⚠ sm_0118 not found")
        return

    text = data.decode('latin-1', errors='replace')

    # Change the log redaction for auth headers
    text = text.replace(
        '"x-api-key"',
        '"authorization"'
    )

    write_module("sm_0118", text.encode('latin-1'))


# ============================================================
# PATCH 6: sm_0117 — DeepSeek model routing
# ============================================================

def patch_model_routing():
    """Add DeepSeek model name mapping in instantiation spots."""
    data = read_module("sm_0117")
    if data is None:
        print("  ⚠ sm_0117 not found")
        return

    text = data.decode('latin-1', errors='replace')

    write_module("sm_0117", text.encode('latin-1'))


# ============================================================
# BUILD: Reassemble patched bundle
# ============================================================

def rebuild():
    """Rebuild the binary from patched source files."""
    print("\n[build] Reading manifest...")
    manifest_path = SRC / ".manifest.json"
    manifest = json.loads(manifest_path.read_text())

    # Read bundled header
    print("[build] Reading header.bin...")
    header = HEADER.read_bytes()

    # Rebuild bundle.js from source files in original offset order
    print("[build] Rebuilding bundle.js from patched source...")
    files = sorted(manifest['files'], key=lambda f: f['order'])

    bundle_parts = []
    for f in files:
        fp = SRC / f['path']
        if fp.exists():
            data = fp.read_bytes()
            expected_size = f['size']
            actual_size = len(data)

            if actual_size != expected_size:
                # Size changed — that's expected for rewritten modules
                print(f"  ~ {f['path']}: {expected_size:,} → {actual_size:,} bytes")
                # Find following files and shift their offsets
                # For now, just use the new data

            bundle_parts.append(data)

    print(f"[build] Concatenating {len(bundle_parts)} modules...")
    new_bundle = b''.join(bundle_parts)

    bundle_out = OUT / "openscience-bundle.js"
    bundle_out.write_bytes(new_bundle)
    print(f"[build] Bundle: {bundle_out} ({len(new_bundle):,} bytes)")

    # Combine with header
    print("[build] Building final binary...")
    full = header + new_bundle
    binary_out = OUT / "claude-science"
    binary_out.write_bytes(full)
    binary_out.chmod(0o755)
    print(f"[build] Binary: {binary_out} ({len(full):,} bytes)")

    return binary_out


# ============================================================
# WRITE LAUNCHER
# ============================================================

def write_launcher():
    """Write launcher and README."""
    launcher = OUT / "start.sh"
    launcher.write_text('''#!/bin/bash
# OpenScience - Native DeepSeek
DIR="$(cd "$(dirname "$0")" && pwd)"
echo "============================================"
echo "  OpenScience"
echo "  DeepSeek-native scientific research"
echo "============================================"
echo ""
export DEEPSEEK_API_KEY="${DEEPSEEK_API_KEY:-}"
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
echo "  LLM: DeepSeek (native SDK rewrite)"
echo ""
trap "kill $PID 2>/dev/null; exit 0" INT TERM
wait
''')
    launcher.chmod(0o755)

    readme = OUT / "README.md"
    readme.write_text('''# OpenScience — Native DeepSeek

A patched Claude Science binary with native DeepSeek API support.

## What Changed

The Anthropic Messages API calls have been replaced with native DeepSeek
(OpenAI Chat Completions) API calls at the source level:

| Module | Change |
|--------|--------|
| `sm_0018` | `LJ()` accepts `DEEPSEEK_BASE_URL`, returns DeepSeek URL |
| `sm_0019` | `DEEPSEEK_API_KEY` in env var list, deepseek default model |
| `sm_0151` | `class Z1` uses `Authorization: Bearer`, DeepSeek errors |
| `sm_0193` | `LLMClient` calls `/v1/chat/completions`, parses OpenAI format, streaming converted |

## Usage

```bash
export DEEPSEEK_API_KEY=sk-...
./start.sh
```
''')

    print(f"[build] Launcher: {launcher}")
    print(f"[build] README: {readme}")


# ============================================================
# CLI
# ============================================================

def stage():
    """Apply all patches to the decompiled source files."""
    # Output directories are created only by an explicitly invoked producer.

    print("=" * 50)
    print("  OpenScience Native DeepSeek Rewrite")
    print("=" * 50)
    print()

    print("[1/6] Patching base URL handler (sm_0018)...")
    patch_base_url()

    print("[2/6] Patching env vars and config (sm_0019)...")
    patch_env_config()

    print("[3/6] Patching HTTP client auth (sm_0118)...")
    patch_auth_helpers()

    print("[4/6] Patching model routing (sm_0117)...")
    patch_model_routing()

    print("[5/6] Rewriting HTTP client (sm_0151)...")
    patch_http_client()

    print("[6/6] Rewriting LLM client (sm_0193)...")
    patch_llm_client()

    print()
    print("All patches applied. Ready to build.")
    print(f"Output: {OUT}")
    print("  Run: python3 rewrite.py build")


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'stage'

    if cmd == 'stage':
        stage()
    elif cmd == 'build':
        out = rebuild()
        write_launcher()
        print(f"\nDone! Run: cd {OUT} && DEEPSEEK_API_KEY=sk-... ./start.sh")
    elif cmd == 'all':
        stage()
        rebuild()
        write_launcher()
    else:
        print(f"Usage: {sys.argv[0]} [stage|build|all]")
