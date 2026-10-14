# Research and Blender apps

A local research assistant, a Blender add-on, an API adapter and recovered application source.

| Component | Location | Use |
|---|---|---|
| OpenScience | `openscience-variants/own-openscience/OpenScience` | Local research chat and database tools |
| Blender add-on | `3d-agent/3d-agent-community/3d_agent` | Scene commands and optional LLM chat |
| API adapter | `openscience-variants/extracted-claude-science/ClaudeScience-patched` | Translate Messages requests to DeepSeek |
| Source extractor | `openscience-variants/extracted-claude-science/bun-decompiler` | Recover inert source with parser-validated boundaries |
| Recovered source | `decompiled_bundles` and `openscience-src` inside the component folders | Inspect JavaScript and Bun runtime sources |

## OpenScience

Requires Python 3.11 or later.

```sh
cd openscience-variants/own-openscience/OpenScience
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
export DEEPSEEK_API_KEY='your-key'
python3 run.py
```

Open http://127.0.0.1:8000. The app README documents provider settings and project storage. Python execution requires explicit Docker opt-in and runs in a restricted container.

## Blender

Create an installable ZIP:

```sh
bash 3d-agent/3d-agent-community/scripts/build-dmg.sh /tmp/research-blender-addon.zip
```

The historical script name is retained for compatibility. It packages a Blender add-on ZIP. Install the ZIP through Blender's add-on preferences; the component README lists commands and provider settings.

## API adapter

```sh
pip install fastapi uvicorn httpx
export DEEPSEEK_API_KEY='your-key'
python3 openscience-variants/extracted-claude-science/ClaudeScience-patched/proxy.py 8766
```

The adapter runs independently. Its daemon launcher also requires `CLAUDE_SCIENCE_BIN` pointing to an original executable. Streaming buffers the provider response before emitting Messages SSE events. No compiled daemon is distributed.

## Source recovery

Use Node 22.18 or Node 24.11 and later.

```sh
npm ci --ignore-scripts
python3 openscience-variants/extracted-claude-science/bun-decompiler/decompile.py extract /path/to/bundle.js.gz /path/to/new-source
```

The extractor parses complete statements and records exact source byte ranges and hashes. Program partitions share bindings and assemble in their recorded order. Bun builtin sources containing host intrinsics are marked separately. JavaScript assembly validates the whole program and rejects missing partitions.

The recovered frontend contains 417 JavaScript bundles. Rebuilding the original desktop app still requires the Tauri native project, HTML entry point and native sidecar sources. The extracted provider packages retain unresolved `workspace:*` dependencies. Reconstructing a native Bun executable also requires its complete original layout and metadata. OpenScience and the community Blender add-on provide the runnable implementations.

## Tests

```sh
pip install -r openscience-variants/own-openscience/OpenScience/requirements.txt
npm ci --ignore-scripts
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s openscience-variants/own-openscience/OpenScience/tests
PYTHONDONTWRITEBYTECODE=1 python3 openscience-variants/extracted-claude-science/ClaudeScience-patched/test_proxy.py
PYTHONDONTWRITEBYTECODE=1 python3 openscience-variants/extracted-claude-science/bun-decompiler/test-decompile.py
PYTHONDONTWRITEBYTECODE=1 python3 3d-agent/3d-agent-community/tests/test-addon.py
```

Offline tests mock provider responses and require no API credits. Scene integration tests require an actual Blender installation.

## Licence

GPL-3.0-or-later applies to released code without a more specific licence. Existing upstream notices remain applicable to their respective files. See `THIRD-PARTY-NOTICES.md` and the component licences.
