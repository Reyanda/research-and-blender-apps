# Native OpenScience host

The macOS AppKit/WebKit host starts the public research workspace and its Python daemon. It also exposes the retained Blender bridge.

## Build

Install Python 3.11+, the Xcode command-line tools and the project dependencies. From the repository root:

```sh
pip install -r openscience-variants/own-openscience/OpenScience/requirements.txt
python3 desktop/build-app.py
open "$HOME/Applications/OpenScience.app"
```

The builder records the selected Python executable and copies application resources without API keys. It applies an ad-hoc signature; the local build is not Apple-notarized. That external Python runtime and its dependencies must remain installed. Use --python /absolute/path/to/python3 or --output /absolute/path/to/App.app to override the defaults.

The host chooses a local port and verifies its daemon with an instance token. External links open in the default browser. File selection and naming dialogs use native macOS controls. Closing the app stops its own daemon and analysis kernels. Blender remains open to preserve scene work.

## Blender

Install Blender 4.2 or later. Blender scene → Open Blender starts a fresh factory scene with the retained extension. Existing compatible bridges can be inspected. Refresh lists objects, Inspect shows details, and the permission checkbox enables Python scene commands.

The bridge forwards POST /v1/blender requests to 127.0.0.1:9875. Supported commands are get_blender_info, get_scene_info, get_scene_graph, get_object_info, get_mesh_stats, get_viewport_screenshot and execute_code. Python commands begin disabled. HTTP clients and hosts must be local; browser mutations require the same origin. Bodies, replies and waits are bounded.

Blender discovery checks BLENDER_BINARY, the user Applications folder and /Applications.

## Standalone daemon

```sh
python3 desktop/server.py serve
python3 desktop/server.py url
python3 desktop/server.py --version
```

The standalone listener defaults to 127.0.0.1:1337. Override it with --port or OPENSCIENCE_PORT. Standalone Blender operators can use --allow-blender-code. Research runtime and connection settings are documented in the OpenScience README.

## Integration checks

```sh
python3 desktop/test-bridge.py
BLENDER_BINARY="$HOME/Applications/Blender.app/Contents/MacOS/Blender" python3 desktop/test-blender-bridge.py
python3 desktop/test-native.py
BLENDER_BINARY="$HOME/Applications/Blender.app/Contents/MacOS/Blender" python3 desktop/test-ui.py
```

The actual WebKit test exercises uploaded files and versions, annotations, notes, memories, CSV, sequence, equation, genomic and molecular previews, a real generated chart, provider-fixture conversations, plan approval, agents and skills and reviewer controls. Set OPENSCIENCE_UI_CODE_TEST=1 on a host with the Colima analysis image to include actual Python/R cells.

The Blender harness owns a disposable factory scene and refuses an occupied bridge port. Background mode pumps timers explicitly; BLENDER_TEST_GUI=1 uses normal timers and verifies actual PNG viewport capture. Native checks verify signature preservation after execution and daemon ownership.
