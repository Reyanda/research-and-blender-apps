# Desktop replacement patch

This patch fills the missing native host, daemon and HTTP bridge using the retained Blender protocol and maintained OpenScience core. These are newly authored replacements. The recovered JavaScript and Bun sources remain available for inspection.

## Build on macOS

Install Blender 4.2 or later, Python 3.11 or later, and the Xcode command-line tools. From the repository root:

```sh
pip install -r openscience-variants/own-openscience/OpenScience/requirements.txt
python3 desktop/build-app.py
open "$HOME/Applications/Research and Blender.app"
```

The builder records the current Python executable, copies the application resources without API keys, and applies an ad-hoc code signature. It requires that Python runtime and its dependencies to remain installed. This is a local build, without Apple notarization. Use `--python /absolute/path/to/python3` to select another runtime or `--output /absolute/path/to/App.app` to change the destination.

## Use

Research projects use the existing OpenScience backend. Set `DEEPSEEK_API_KEY` before launching from Terminal to enable provider chat. Project storage follows the OpenScience settings; `OPENSCIENCE_DATA_DIR` selects another directory.

Choose Blender scene, then Open Blender to launch a fresh factory scene with the retained extension. An existing compatible bridge can also be queried. Refresh lists objects; Inspect shows object or mesh details. Enable Allow Python commands in Blender before creating a cube. This permission allows Python to execute in the connected Blender process. The checkbox can revoke it again. Closing the research app stops its own daemon and leaves Blender open to preserve scene work.

Blender discovery checks `BLENDER_BINARY`, then the user Applications folder and `/Applications`. The native host chooses a local port and verifies its own daemon with an instance token. External links open in the default browser.

## Daemon and protocol

```sh
python3 desktop/server.py serve
python3 desktop/server.py url
python3 desktop/server.py --version
```

The standalone daemon defaults to `127.0.0.1:1337`. Use `--port` or `OPENSCIENCE_PORT` to change it. `POST /v1/blender` accepts `{ "type": "get_scene_info", "params": {} }` and forwards newline-framed JSON to `127.0.0.1:9875`. Replies retain the extension's status and result or error.

Supported commands: `get_blender_info`, `get_scene_info`, `get_scene_graph`, `get_object_info`, `get_mesh_stats`, `get_viewport_screenshot`, and `execute_code`. Python execution is disabled initially. Standalone operators can use `--allow-blender-code`; the native app exposes the permission checkbox. HTTP requests require a loopback client and host; browser mutations require the same origin. Bodies, replies and waits are bounded.

## Tests

```sh
python3 desktop/test-bridge.py
BLENDER_BINARY="$HOME/Applications/Blender.app/Contents/MacOS/Blender" python3 desktop/test-blender-bridge.py
python3 desktop/test-native.py
BLENDER_BINARY="$HOME/Applications/Blender.app/Contents/MacOS/Blender" python3 desktop/test-ui.py
```

The Blender integration owns a disposable factory scene and refuses to reuse an occupied bridge port. Background Blender requires an explicit main-thread timer pump in this test harness. It exercises actual scene operations and HTTP/TCP serialization. Viewport screenshot requests correctly return an error without a viewport in background mode; a separate run with `BLENDER_TEST_GUI=1` uses Blender's normal timers and verifies a real PNG viewport capture.

The native tests verify daemon ownership, runtime errors, HTML loading and signature preservation after execution. The UI test uses actual WKWebView APIs to create a research project, query the scene, show permission denial, enable Python, create a cube and inspect its eight vertices. Provider responses and paid LLM execution are outside these tests.
