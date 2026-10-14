# `agent_3d` — 3D Agent Blender Extension

Bridge for the 3D Agent desktop app. TCP server bound to `127.0.0.1:9875`
implementing the seven-command bridge contract from
`arch/prds/product/03-agent-subsystem.md §14`.

## Architecture

```text
3D Agent app
  └─ Bun sidecar
       └─ blender_bridge.ts (POST http://127.0.0.1:1337/v1/blender)
            └─ Tauri Rust HTTP server (Phase 5.5a)
                 └─ TCP socket to 127.0.0.1:9875
                      └─ THIS EXTENSION
```

Per ADR 0013: the user opens Blender from anywhere; the extension auto-loads
on Blender startup; the Tauri layer reconnects on the next bridge call.

## Manual install (today)

The Tauri-side auto-installer ships in Phase 5.5b-2. Until then:

```bash
# From this directory:
zip -r agent_3d.zip blender_manifest.toml __init__.py README.md
blender --command extension install-file -r user_default --enable agent_3d.zip
```

After install the extension lives at:

- macOS: `~/Library/Application Support/Blender/<ver>/extensions/user_default/agent_3d/`
- Windows: `%APPDATA%\Blender Foundation\Blender\<ver>\extensions\user_default\agent_3d\`
- Linux: `~/.config/blender/<ver>/extensions/user_default/agent_3d/`

## Verifying the install

1. Launch Blender 4.2+. The system console should print `[agent_3d] listening on 127.0.0.1:9875`.
2. Launch the 3D Agent app (Phase 5.5a HTTP server runs on `127.0.0.1:1337`).
3. From any terminal:
   ```bash
   curl -X POST -H 'Content-Type: application/json' \
        -d '{"type":"get_blender_info","params":{}}' \
        http://127.0.0.1:1337/v1/blender
   ```
   Expected response shape:
   ```json
   {
     "status": "success",
     "result": {
       "blender_version": [4, 2, 0],
       "blender_version_string": "4.2.0",
       "addon_version": "0.1.0",
       "protocol_version": "1.0.0",
       "reload_failed": false,
       "reload_error": "",
       …
     }
   }
   ```
   `reload_failed` is `true` only when an in-place hot reload failed and Blender
   is still running the previous extension copy in memory (issue #1117). The
   Tauri bridge forwards it to Sentry; the user-facing fix is to restart Blender.

If you get `{"status":"error","message":"Cannot reach Blender at 127.0.0.1:9875…"}`,
Blender isn't running or the extension isn't enabled — check `Edit → Preferences → Get Extensions → Installed`.

## Threading

`bpy` operators must run on Blender's main thread. The TCP accept loop runs
on a daemon thread; per-client read loops run on their own daemon threads;
each command is dispatched onto the main thread via
`bpy.app.timers.register(…, first_interval=0.0)` before any `bpy.*` call.

## Wire protocol (`§14`)

- TCP `127.0.0.1:9875`, newline-terminated JSON frames, UTF-8.
- Request: `{"type": "<cmd>", "params": {...}}`
- Response (success): `{"status": "success", "result": {...}}`
- Response (error): `{"status": "error", "message": "...", "error": "..."}`
- Seven commands per `§14.4`: `get_blender_info`, `get_scene_info`, `get_scene_graph`, `get_object_info`, `get_mesh_stats`, `get_viewport_screenshot`, `execute_code`.

## Special cases preserved from §7.7 / §14.8

- **Scene Collection root** — `get_scene_graph` excludes it from each object's `collections` list; `get_object_info` returns a specific error envelope when asked about it. Scene Collection is read-only in Blender, and renaming or deleting it crashes Blender.
