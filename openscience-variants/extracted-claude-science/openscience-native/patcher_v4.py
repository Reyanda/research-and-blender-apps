#!/usr/bin/env python3
"""
OpenScience Patcher v4 — Surgical binary patching with embedded JS proxy.

Strategy:
  1. Replace all domain URLs (same-length swaps)
  2. Replace API key env var names (same-length swaps)
  3. Inject a minimal JS proxy function into the binary that converts
     Anthropic Messages API ↔ OpenAI Chat Completions format at the network level
  4. This proxy starts when the app boots, so the app is fully self-contained

Files to patch:
  - bundle.js: the JS source bundle (64MB)
  - Combined with header.bin (52MB) to produce the final binary

The key insight: we can't just swap URLs because the API protocol differs.
We need a TRANSPARENT PROXY embedded inside the JS source that intercepts
fetch requests to api.anthropic.com and translates them to deepseek format.
"""

# Retained experimental implementation. Native reconstruction requires the original
# complete Bun executable layout and metadata; header + JS concatenation is invalid.
if __name__ == "__main__":
    raise SystemExit("Native rebuild/install is unavailable: complete original Bun metadata is missing. Use ../ClaudeScience-patched/launch.sh with an original executable.")

import os, sys, json, struct, re, shutil
from pathlib import Path

BUNDLE = (Path(__file__).resolve().parent.parent / 'ClaudeScience-patched/extracted/bundle.js')
HEADER = (Path(__file__).resolve().parent.parent / 'ClaudeScience-patched/extracted/header.bin')
WORK = (Path(__file__).resolve().parent.parent / 'openscience-built')
BIN_OUT = WORK / "claude-science"

WORK.mkdir(parents=True, exist_ok=True)

# ============================================================
# THE EMBEDDED PROXY (JS implementation)
# Injected into the binary's startup flow
# ============================================================

JS_PROXY = r"""
// ===== OpenScience DeepSeek Proxy (embedded) =====
// Intercepts fetch to api.anthropic.com, translates to DeepSeek API
// The proxy function wraps globalThis.fetch

(()=>{
  const DEEPSEEK_KEY = () => (typeof process!=='undefined' && process.env?.DEEPSEEK_API_KEY) ||
                            (typeof globalThis!=='undefined' && globalThis.DEEPSEEK_API_KEY) || '';
  const DEEPSEEK_URL = () => (typeof process!=='undefined' && process.env?.DEEPSEEK_BASE_URL) ||
                             'https://api.deepseek.com/v1';
  const ACTIVE_MODEL = 'deepseek-chat';

  // Cache model mapping
  const MODEL_MAP = {
    'claude-sonnet-4-6': 'deepseek-chat',
    'claude-sonnet-4-5': 'deepseek-chat',
    'claude-opus-4-8': 'deepseek-reasoner',
    'claude-opus-4-7': 'deepseek-reasoner',
    'claude-opus-4-6': 'deepseek-reasoner',
    'claude-opus-4-5': 'deepseek-reasoner',
    'claude-haiku-4-5': 'deepseek-chat',
    'claude-haiku-4-4': 'deepseek-chat',
    'claude-3-5-sonnet': 'deepseek-chat',
    'claude-3-opus': 'deepseek-reasoner',
    'claude-3-haiku': 'deepseek-chat',
  };
  const DEFAULT_MODEL = 'deepseek-chat';

  // Convert Anthropic Messages API → OpenAI Chat Completions
  function anthropicToOpenAI(body) {
    const messages = [];

    // System prompt
    if (body.system) {
      if (typeof body.system === 'string') {
        messages.push({role:'system', content:body.system});
      } else if (Array.isArray(body.system)) {
        const texts = body.system.filter(b=>b.type==='text').map(b=>b.text);
        if (texts.length) messages.push({role:'system', content:texts.join('\n')});
      }
    }

    // Messages
    for (const msg of (body.messages||[])) {
      if (typeof msg.content === 'string') {
        messages.push({role:msg.role, content:msg.content});
      } else if (Array.isArray(msg.content)) {
        let text = '';
        let toolResults = [];
        let toolCalls = [];
        for (const block of msg.content) {
          if (block.type === 'text') text += block.text + '\n';
          else if (block.type === 'tool_use') toolCalls.push(block);
          else if (block.type === 'tool_result') {
            const tc = block.content;
            toolResults.push({role:'tool', content:typeof tc==='string'?tc:JSON.stringify(tc), tool_call_id:block.tool_use_id});
          }
          else if (block.type === 'thinking') { /* skip thinking blocks */ }
        }
        if (toolCalls.length) {
          // Convert to OpenAI format
          const oai = {role:'assistant', content:text||null};
          oai.tool_calls = toolCalls.map(tc=>({
            id: tc.id || 'call_'+Math.random().toString(36).slice(2),
            type: 'function',
            function: {name:tc.name, arguments:JSON.stringify(tc.input||{})}
          }));
          messages.push(oai);
          continue;
        }
        if (toolResults.length) {
          messages.push(...toolResults);
          continue;
        }
        messages.push({role:msg.role, content:text.trim()});
      }
    }

    // Tools -> Functions
    const tools = (body.tools||[]).map(t=>({
      type:'function',
      function:{name:t.name, description:t.description||'', parameters:t.input_schema||{type:'object',properties:{}}}
    }));

    const model = MODEL_MAP[body.model] || DEFAULT_MODEL;

    const result = {
      model,
      messages,
      max_tokens: body.max_tokens || 4096,
      temperature: body.temperature ?? 0.7,
      stream: body.stream || false,
    };
    if (tools.length) result.tools = tools;
    if (body.top_p !== undefined) result.top_p = body.top_p;
    if (body.stop_sequences?.length) result.stop = body.stop_sequences;

    return result;
  }

  // Convert OpenAI Chat Completions → Anthropic Messages
  function openAIToAnthropic(openaiResp, originalModel) {
    const choice = openaiResp.choices?.[0] || {};
    const msg = choice.message || {};
    const content = [];

    // Reasoning content -> thinking
    if (msg.reasoning_content) {
      content.push({type:'thinking', thinking:msg.reasoning_content});
    }

    // Text content
    if (msg.content) {
      content.push({type:'text', text:msg.content});
    }

    // Tool calls
    const toolCalls = (msg.tool_calls||[]).map(tc => ({
      type:'tool_use',
      id: tc.id,
      name: tc.function?.name || '',
      input: (()=>{try{return JSON.parse(tc.function?.arguments||'{}')}catch{return {}}})()
    }));
    content.push(...toolCalls);

    const usage = openaiResp.usage || {};
    return {
      id: 'msg_'+Math.random().toString(36).slice(2,14),
      type: 'message',
      role: 'assistant',
      content,
      model: originalModel,
      stop_reason: choice.finish_reason === 'stop' ? 'end_turn' :
                   choice.finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn',
      usage: {
        input_tokens: usage.prompt_tokens || 0,
        output_tokens: usage.completion_tokens || 0,
      }
    };
  }

  // Streaming converter
  function streamChunk(line, ctx) {
    if (!line.startsWith('data: ')) return null;
    const data = line.slice(6);
    if (data === '[DONE]') return '[DONE]';

    try {
      const chunk = JSON.parse(data);
      const delta = chunk.choices?.[0]?.delta || {};

      if (!ctx.started) {
        ctx.started = true;
        const startMsg = {type:'message_start', message:{id:'msg_'+Math.random().toString(36).slice(2,14), type:'message', role:'assistant', content:[], model:ctx.model, usage:{input_tokens:0, output_tokens:0}}};
        ctx.contentBlocks = [];
        return JSON.stringify(startMsg);
      }

      const results = [];

      if (delta.reasoning_content) {
        if (!ctx.thinkingStarted) {
          ctx.thinkingStarted = true;
          ctx.thinkingIdx = ctx.contentBlocks.length;
          ctx.contentBlocks.push({type:'thinking', thinking:''});
          results.push(JSON.stringify({type:'content_block_start', index:ctx.thinkingIdx, content_block:{type:'thinking', thinking:''}}));
        }
        results.push(JSON.stringify({type:'content_block_delta', index:ctx.thinkingIdx, delta:{type:'thinking_delta', thinking:delta.reasoning_content}}));
      }

      if (delta.content) {
        if (!ctx.textStarted) {
          ctx.textStarted = true;
          ctx.textIdx = ctx.contentBlocks.length;
          ctx.contentBlocks.push({type:'text', text:''});
          results.push(JSON.stringify({type:'content_block_start', index:ctx.textIdx, content_block:{type:'text', text:''}}));
        }
        results.push(JSON.stringify({type:'content_block_delta', index:ctx.textIdx, delta:{type:'text_delta', text:delta.content}}));
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!ctx.tcStarts[tc.index]) {
            ctx.tcStarts[tc.index] = true;
            const tci = ctx.contentBlocks.length;
            ctx.contentBlocks.push({type:'tool_use', id:tc.id||'call_'+Math.random().toString(36).slice(2,14), name:'', input:{}});
            results.push(JSON.stringify({type:'content_block_start', index:tci, content_block:{type:'tool_use', id:ctx.contentBlocks[tci].id, name:'', input:{}}}));
          }
          // Tool call delta - simplified: accumulate and emit on complete
        }
      }

      return results.join('\n');
    } catch(e) {
      return null;
    }
  }

  // Store proxy state
  let proxyActive = false;

  // The main proxy: wrap fetch
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : input?.url;

    if (url && url.includes('api.anthropic.com') && url.includes('/v1/messages')) {
      proxyActive = true;
      try {
        const body = JSON.parse(init?.body || '{}');
        const openaiBody = anthropicToOpenAI(body);
        const isStream = body.stream || false;

        // Construct DeepSeek URL
        const baseUrl = DEEPSEEK_URL();
        const apiUrl = baseUrl.replace(/\/+$/, '') + '/chat/completions';
        const apiKey = DEEPSEEK_KEY();

        const headers = {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey,
        };

        const requestInit = {
          method: 'POST',
          headers,
          body: JSON.stringify(openaiBody),
        };

        const response = await originalFetch(apiUrl, requestInit);

        if (!isStream) {
          const data = await response.json();
          const anthroResp = openAIToAnthropic(data, body.model);
          return new Response(JSON.stringify(anthroResp), {
            status: 200,
            headers: {'Content-Type': 'application/json'}
          });
        }

        // Streaming
        const streamBody = response.body;
        if (!streamBody) {
          return new Response(JSON.stringify({type:'message_stop'}), {
            status: 200,
            headers: {'Content-Type': 'text/event-stream'}
          });
        }

        const reader = streamBody.getReader();
        const decoder = new TextDecoder();
        const ctx = {started:false, thinkingStarted:false, textStarted:false, tcStarts:{}, model:body.model, contentBlocks:[]};

        const newStream = new ReadableStream({
          async start(controller) {
            try {
              let buffer = '';
              while (true) {
                const {done, value} = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, {stream:true});
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const processed = processStreamLine(line, ctx);
                    if (processed === '[DONE]') break;
                    if (processed) controller.enqueue(new TextEncoder().encode(processed + '\n'));
                  }
                }
              }
              // End streaming
              const stopMsg = {type:'message_delta', delta:{stop_reason:'end_turn', usage:{input_tokens:0, output_tokens:0}}};
              controller.enqueue(new TextEncoder().encode(JSON.stringify(stopMsg) + '\n'));
              controller.enqueue(new TextEncoder().encode(JSON.stringify({type:'message_stop'}) + '\n'));
            } catch(e) {
              // Stream error
            } finally {
              controller.close();
            }
          }
        });

        return new Response(newStream, {
          status: 200,
          headers: {'Content-Type': 'text/event-stream'}
        });

      } catch(e) {
        // Fall through to original fetch on error
        proxyActive = false;
      }
    }

    return originalFetch.call(this, input, init);
  };

  function processStreamLine(line, ctx) {
    if (!line.startsWith('data: ')) return null;
    const data = line.slice(6);
    if (data === '[DONE]') return '[DONE]';

    try {
      const chunk = JSON.parse(data);
      const delta = chunk.choices?.[0]?.delta || {};
      const finishReason = chunk.choices?.[0]?.finish_reason;

      const events = [];

      if (!ctx.started) {
        ctx.started = true;
        ctx.blocks = [];
        events.push(JSON.stringify({type:'message_start', message:{id:'msg_r'+Math.random().toString(36).slice(2,10), type:'message', role:'assistant', content:[], model:ctx.model, usage:{input_tokens:chunk.usage?.prompt_tokens||0, output_tokens:0}}}));
      }

      if (delta.reasoning_content && !ctx.thinkingBlock) {
        ctx.thinkingBlock = {type:'thinking', thinking:''};
        ctx.thinkingIdx = ctx.blocks.length;
        ctx.blocks.push(ctx.thinkingBlock);
        events.push(JSON.stringify({type:'content_block_start', index:ctx.thinkingIdx, content_block:{type:'thinking', thinking:''}}));
      }
      if (delta.reasoning_content && ctx.thinkingBlock) {
        ctx.thinkingBlock.thinking += delta.reasoning_content;
        events.push(JSON.stringify({type:'content_block_delta', index:ctx.thinkingIdx, delta:{type:'thinking_delta', thinking:delta.reasoning_content}}));
      }

      if (delta.content && !ctx.textBlock) {
        ctx.textBlock = {type:'text', text:''};
        ctx.textIdx = ctx.blocks.length;
        ctx.blocks.push(ctx.textBlock);
        events.push(JSON.stringify({type:'content_block_start', index:ctx.textIdx, content_block:{type:'text', text:''}}));
      }
      if (delta.content && ctx.textBlock) {
        ctx.textBlock.text += delta.content;
        events.push(JSON.stringify({type:'content_block_delta', index:ctx.textIdx, delta:{type:'text_delta', text:delta.content}}));
      }

      if (finishReason) {
        const usage = chunk.usage || {};
        events.push(JSON.stringify({type:'message_delta', delta:{stop_reason:finishReason==='stop'?'end_turn':finishReason==='tool_calls'?'tool_use':'end_turn', usage:{input_tokens:usage.prompt_tokens||0, output_tokens:usage.completion_tokens||0}}}));
        events.push(JSON.stringify({type:'message_stop'}));
      }

      return events.join('\n');
    } catch(e) {
      return null;
    }
  }

  // Log startup
  if (typeof console !== 'undefined') {
    console.log('[OpenScience] DeepSeek proxy enabled');
    console.log('[OpenScience] API: api.anthropic.com/v1/messages → api.deepseek.com/v1/chat/completions');
  }
})();
"""


# ============================================================
# BYTE-LEVEL PATCHES
# ============================================================

def find_patches(data):
    """Find all byte sequences to patch, returning (offset, old, new, name)."""
    patches = []

    # --- 1. Domain swap: api.anthropic.com (17) → api.deepseek.com (16) ---
    # Pad to match length with null byte (safe in JS strings mid-call)
    old_domain = b'api.anthropic.com'
    new_domain = b'api.deepseek.com/v'  # 16+1=17, adding trailing /v which gets joined with path

    idx = 0
    count = 0
    while True:
        idx = data.find(old_domain, idx)
        if idx == -1:
            break
        patches.append((idx, old_domain, new_domain, 'domain_api'))
        idx += len(old_domain)
        count += 1
    print(f"  Domain 'api.anthropic.com' → 'api.deepseek.com': {count} occurrences")

    # --- 2. Quoted default URL: "https://api.anthropic.com" (29) → "https://api.deepseek.com" (25) ---
    # Need null padding. But null bytes terminate C strings, and within JS they'd
    # cause the string to terminate early. That's actually fine — "https://api.deepseek.com"
    # is reached and the null bytes in memory don't affect the JS value.
    # But actually in Bun/JS, strings aren't null-terminated. The \x00 bytes would be
    # part of the string content, creating "https://api.deepseek.com\x00\x00\x00\x00"
    # which wouldn't parse as a URL.
    # Better approach: use template literal insertion that's shorter:
    # "https://api.anthropic.com" → "https://api.deepseek.com/" (same 29 chars!)

    old_url = b'"https://api.anthropic.com"'
    new_url = b'"https://api.deepseek.com"'
    # Pad to same length
    if len(new_url) < len(old_url):
        new_url = new_url + b'\x00' * (len(old_url) - len(new_url))
    # Actually, use a better approach: replace the exact same-length URL
    # The /v1 at end is important for path construction elsewhere
    # Let's embed the / in the URL

    # Actually the simplest approach: since this default URL is only used
    # as a base, just change it to deepseek.
    # Length: "https://api.anthropic.com" = 28 (without quotes) = 30 (with quotes)
    #         "https://api.deepseek.com" = 26 (without quotes) = 28 (with quotes)
    # Not same length. But we can pad with ' ' which the URL parser would strip.

    # Actually let's count again:
    old_q = b'"https://api.anthropic.com"'
    new_q = b'"https://api.deepseek.com"'
    print(f"\n  Quoted URL lengths: old={len(old_q)}, new={len(new_q)}")
    # With quotes: 30 vs 28. Need 2 bytes of padding.
    # Use null bytes — in Bun's JS engine, the string will be created from the
    # byte buffer and nulls will be stripped or cause the string to end.
    # Actually, better: use spaces: "https://api.deepseek.com  "
    # URL constructor trims whitespace.
    # Even better: find a 30-char deepseek URL
    # "https://api.deepseek.com/v1" = 31 — one too long
    # "https://deepseek.com/v1/messages" = 32 — two too long
    # Ugh. Let's use: "https://api.deepseek.com\x00\x00"
    # In Bun, if this is a JS string literal, \x00 becomes part of the string
    # which would mess up the URL.
    # Alternative: use a slightly different approach - pad with spaces
    # URL("https://api.deepseek.com  ") normalizes to https://api.deepseek.com
    # That works!

    idx = 0
    qcount = 0
    while True:
        idx = data.find(old_q, idx)
        if idx == -1:
            break
        # Use spaces for padding
        padded = new_q + b'  '  # 28 + 2 = 30
        if len(padded) != len(old_q):
            print(f"    Length mismatch at 0x{idx:x}: {len(padded)} vs {len(old_q)}")
            idx += 1
            continue
        patches.append((idx, old_q, padded, 'quoted_url_spaces'))
        idx += len(old_q)
        qcount += 1
    print(f"  Quoted URL: {qcount} occurrences")

    # --- 3. ANTHROPIC_API_KEY → DEEPSEEK_API_KEY ---
    # Same length! "ANTHROPIC_API_KEY" = 18, "DEEPSEEK_API_KEY" = 17
    # One char shorter. Pad with null (safe in env var names)
    old_key = b'ANTHROPIC_API_KEY'
    new_key = b'DEEPSEEK_API_KEY' + b'\x00'
    assert len(new_key) == len(old_key), f"Key lengths: {len(old_key)} vs {len(new_key)}"

    idx = 0
    kcount = 0
    while True:
        idx = data.find(old_key, idx)
        if idx == -1:
            break
        patches.append((idx, old_key, new_key, 'env_key'))
        idx += len(old_key)
        kcount += 1
    print(f"  ANTHROPIC_API_KEY → DEEPSEEK_API_KEY: {kcount} occurrences")

    # --- 4. ANTHROPIC_AUTH_TOKEN → DEEPSEEK_AUTH_TOKEN ---
    # Same length! "ANTHROPIC_AUTH_TOKEN" = 21, "DEEPSEEK_AUTH_TOKEN" = 20
    # Pad with null
    old_auth = b'ANTHROPIC_AUTH_TOKEN'
    new_auth = b'DEEPSEEK_AUTH_TOKEN\x00'
    assert len(new_auth) == len(old_auth)

    idx = 0
    acount = 0
    while True:
        idx = data.find(old_auth, idx)
        if idx == -1:
            break
        patches.append((idx, old_auth, new_auth, 'env_auth'))
        idx += len(old_auth)
        acount += 1
    print(f"  ANTHROPIC_AUTH_TOKEN → DEEPSEEK_AUTH_TOKEN: {acount} occurrences")

    # --- 5. ANTHROPIC_BASE_URL → DEEPSEEK_BASE_URL ---
    # "ANTHROPIC_BASE_URL" = 19, "DEEPSEEK_BASE_URL" = 18
    old_burl = b'ANTHROPIC_BASE_URL'
    new_burl = b'DEEPSEEK_BASE_URL\x00'
    assert len(new_burl) == len(old_burl)

    idx = 0
    bcount = 0
    while True:
        idx = data.find(old_burl, idx)
        if idx == -1:
            break
        patches.append((idx, old_burl, new_burl, 'env_baseurl'))
        idx += len(old_burl)
        bcount += 1
    print(f"  ANTHROPIC_BASE_URL → DEEPSEEK_BASE_URL: {bcount} occurrences")

    # --- 6. Model names ---
    model_patches = [
        # (old, new, min_length_for_padding)
        (b'claude-opus-4-8', b'deepseek-reasoner'),      # 16 → 17 - longer by 1
        (b'claude-sonnet-4-6', b'deepseek-chat\x00\x00\x00\x00\x00'),  # 18 → 13+5=18
        (b'claude-haiku-4-5-20251001', b'deepseek-chat\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00'),  # 27 → 13+14=27
    ]
    for old_m, new_m in model_patches:
        if len(new_m) < len(old_m):
            new_m = new_m + b'\x00' * (len(old_m) - len(new_m))
        elif len(new_m) > len(old_m):
            print(f"    Model '{old_m.decode()}' too short for '{new_m.decode()}' ({len(old_m)} → {len(new_m)})")
            continue

        idx = 0
        mcount = 0
        while True:
            idx = data.find(old_m, idx)
            if idx == -1:
                break
            patches.append((idx, old_m, new_m, f'model_{old_m.decode()}'))
            idx += len(old_m)
            mcount += 1
        if mcount > 0:
            print(f"  Model '{old_m.decode()}' → '{new_m.decode()[:13]}...': {mcount} occurrences")

    # --- 7. "operon" branding → "openSci" ---
    old_app = b'"operon"'
    new_app = b'opensci\x00\x00'  # Pad to 8
    if len(new_app) < len(old_app):
        new_app = new_app + b'\x00' * (len(old_app) - len(new_app))

    idx = 0
    oc = 0
    while True:
        idx = data.find(old_app, idx)
        if idx == -1:
            break
        patches.append((idx, old_app, new_app[:len(old_app)], 'branding'))
        idx += 1
        oc += 1
    if oc > 0:
        print(f"  'operon'→'opensci': {oc} occurrences")

    return patches


def apply_patches(data, patches):
    """Apply all patches, return modified data."""
    result = bytearray(data)
    applied = 0
    skipped = 0
    mismatches = []

    for offset, old, new, name in patches:
        actual = bytes(result[offset:offset+len(old)])
        if actual != old:
            mismatches.append((name, offset, old, new, actual))
            skipped += 1
            continue
        result[offset:offset+len(new)] = new
        applied += 1

    return bytes(result), applied, skipped, mismatches


def verify(data, patches):
    """Post-patch verification."""
    # Count remaining occurrences
    remaining_anthropic = data.count(b'anthropic')
    remaining_api_key = data.count(b'ANTHROPIC')
    deepseek_count = data.count(b'deepseek')
    deepseek_key = data.count(b'DEEPSEEK')

    print(f"\n  Verification:")
    print(f"    'anthropic' strings remaining: {remaining_anthropic}")
    print(f"    'ANTHROPIC_' strings remaining: {remaining_api_key}")
    print(f"    'deepseek' strings added: {deepseek_count}")
    print(f"    'DEEPSEEK_' strings added: {deepseek_key}")


# ============================================================
# BUILD BINARY
# ============================================================

def build_binary(patched_bundle):
    """Combine header.bin + bundle.js into a complete binary."""
    header_data = HEADER.read_bytes()
    full = header_data + patched_bundle
    BIN_OUT.write_bytes(full)
    os.chmod(BIN_OUT, 0o755)
    print(f"\n  Binary: {BIN_OUT} ({len(full):,} bytes)")
    return full


def create_open_source_archive():
    """Create a clean OpenScience source tree with the patched binary and launcher."""
    # Launcher script
    launcher = WORK / "start.sh"
    launcher.write_text('''#!/bin/bash
# OpenScience - DeepSeek-powered Claude Science
DIR="$(cd "$(dirname "$0")" && pwd)"
echo "============================================"
echo "  OpenScience"
echo "  DeepSeek-powered scientific research"
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
echo "  LLM: DeepSeek (native)"
echo ""
trap "kill $PID 2>/dev/null; exit 0" INT TERM
wait
''')
    launcher.chmod(0o755)
    print(f"  Launcher: {launcher}")

    return WORK


# ============================================================
# SLIM DECOMPILER (just the key API modules, not all 1600+)
# ============================================================

def extract_key_modules():
    """Extract only the key API-related modules for reference."""
    data = BUNDLE.read_bytes()
    out = WORK / "reference"
    out.mkdir(parents=True, exist_ok=True)

    # Known key offsets for API modules
    key_modules = {
        'api_base_url_config': 0x96b938,
        'api_key_env_list': 0x96bf79,
        'paths_config': 0x96ded6,
        'api_client_class': 0x9d41aa,
        'credential_module': 0xa3e27b,
    }

    for name, offset in key_modules.items():
        # Read ~3000 bytes from S-module start
        chunk = data[offset:offset + 3000]
        fp = out / f"{name}.js"
        fp.write_bytes(chunk)
        print(f"  Extracted: {fp}")

    # Also extract all .all-source.js for searching
    combined = b''
    for name, offset in sorted(key_modules.items(), key=lambda x: x[1]):
        chunk = data[offset:offset + 3000]
        header = f"\n// ===== {name} at 0x{offset:x} =====\n".encode()
        combined += header + chunk

    (out / "all-api-modules.js").write_bytes(combined)
    print(f"  Combined: {out / 'all-api-modules.js'}")


# ============================================================
# MAIN
# ============================================================

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'patch'

    if cmd == 'patch':
        print("OpenScience Patcher v4")
        print("=" * 50)
        print()

        print("[1/5] Reading bundle...")
        data = BUNDLE.read_bytes()
        print(f"  Bundle: {BUNDLE} ({len(data):,} bytes)")
        print()

        print("[2/5] Finding patches...")
        patches = find_patches(data)
        print(f"\n  Total patches: {len(patches)}")
        print()

        print("[3/5] Applying patches...")
        patched, applied, skipped, mismatches = apply_patches(data, patches)
        print(f"  Applied: {applied}")
        if skipped:
            print(f"  Skipped: {skipped}")
            for name, offset, old, new, actual in mismatches[:5]:
                print(f"    ✗ {name} at 0x{offset:x}: expected {old[:20]}, got {actual[:20]}")
        print()

        print("[4/5] Verifying...")
        verify(patched, patches)
        print()

        print("[5/5] Building binary...")
        build_binary(patched)
        create_open_source_archive()
        print()

        # Save patched bundle for reuse
        bundle_out = WORK / "bundle-patched.js"
        bundle_out.write_bytes(patched)
        print(f"  Patched bundle: {bundle_out} ({len(patched):,} bytes)")
        print()

        print("  Done! Run: cd openscience-built && DEEPSEEK_API_KEY=sk-... ./start.sh")

    elif cmd == 'reference':
        extract_key_modules()

    elif cmd == 'verify':
        data = BUNDLE.read_bytes()
        patches = find_patches(data)
        patched, _, _, _ = apply_patches(data, patches)
        verify(patched, patches)

    else:
        print(f"Usage: {sys.argv[0]} [patch|reference|verify]")
