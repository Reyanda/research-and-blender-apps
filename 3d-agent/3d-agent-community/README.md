# 3D Agent Blender addon

A community Blender 3.6+ sidebar addon with deterministic scene commands and optional AI chat. This folder builds an addon ZIP, not the original desktop application or a DMG.

## Installation

Run `bash scripts/build-dmg.sh /absolute/output/3d-agent-addon.zip` with an existing output directory and unused filename. The historical script name is retained; it packages only the addon, README and MIT licence, without installing dependencies or deleting builds.

In Blender 3.6–4.1, use Edit → Preferences → Add-ons → Install and select the ZIP, then enable 3D Agent. In Blender 4.2+, use Install from Disk in Preferences. Press N in the 3D Viewport and select the 3D Agent tab.

## Commands

Commands work immediately without an API key. Supported examples:

- `create cube`, `create sphere`, `create cylinder`, `create cone`, `create torus`, `create plane`, `add monkey`
- `move to 1 2 3` sets selected objects' local locations; AI translate commands use relative offsets
- `rotate 45 degrees` or `rotate 1.57` (radians)
- `scale 2`, `subdivide 2`, `smooth`, `extrude 1`
- `scene info`, `render`, `undo`, `redo`, `delete`

Transforms use Blender's current selection and context. Mesh operations require an active mesh and preserve its previous mode. Render uses the scene's configured camera and output path. Undo and redo require a Blender context that supports them. Commands must match the complete input; explanatory prose is not treated as a deterministic command.

## Optional AI

Select OpenAI, Anthropic, Groq or DeepSeek in Settings and enter a key and model identifier supported by that provider. Detect API Keys reads `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY` and `DEEPSEEK_API_KEY` from Blender's process environment. Model availability depends on the provider; edit the model field if its default is unavailable.

API keys are masked and excluded from saved blend files. Re-enter a key or detect it after loading a file. Chat history and object names are sent to the chosen provider. Requests run on a background thread with a 30-second socket timeout; scene changes run on Blender's main thread. AI responses may automatically perform supported scene operations, including deleting selected objects and rendering; save your work before use. Unsupported commands and malformed parameters are rejected. Arbitrary generated Python is never evaluated.

This addon supports listed primitives and transforms; it does not implement material editing, red objects, or house generation as distinct features.

## Tests

Run `blender --background --factory-startup --python tests/test-addon.py`. Tests use Blender and mocked HTTP transport; they make no paid API requests.

## License

MIT. See LICENSE.
