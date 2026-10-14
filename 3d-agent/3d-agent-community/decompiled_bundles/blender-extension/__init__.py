"""3D Agent — Blender 4.2+ Extension.

TCP server bound to 127.0.0.1:9875 implementing the seven-command bridge
contract from arch/prds/product/03-agent-subsystem.md §14:

    get_blender_info, get_scene_info, get_scene_graph, get_object_info,
    get_mesh_stats, get_viewport_screenshot, execute_code

The 3D Agent desktop app's Tauri layer (packages/app-tauri/src/core/blender/)
opens a long-lived TCP connection here and forwards JSON command frames from
the Bun sidecar's blender_bridge.ts CLI. UTF-8 end-to-end (`ensure_ascii=
False`); newline-terminated frames; one command per round-trip.

Threading model (mirrors the legacy 3d-agent-app addon, which proved out the
shape over a year of production use):

    accept-loop thread (daemon)
      └─ per-client thread (daemon) — reads JSON frames
           └─ schedules the actual bpy work via bpy.app.timers.register
              (bpy operators MUST run on Blender's main thread)
"""

import json
import os
import py_compile
import socket
import sys
import threading
import traceback
from contextlib import suppress

import bpy

bl_info = {
    "name": "3D Agent",
    "version": (0, 1, 0),
    "blender": (4, 2, 0),
    "category": "Development",
}

# Wire-protocol version. Bumped when the JSON command/response shape
# changes in a way that requires a coordinated sidecar update.
PROTOCOL_VERSION = "1.0.0"
# Derived once here; used in handshake + get_blender_info to avoid repeating
# the join expression.
_EXTENSION_VERSION = ".".join(str(n) for n in bl_info["version"])

# Set when an in-place hot reload fails (issue #1117): the previous module stays
# loaded in Blender's memory. We flag it here and surface it on the handshake /
# get_blender_info reply so the Tauri bridge can forward it to Sentry — Blender's
# own console output is otherwise invisible to the desktop app.
_RELOAD_FAILED = False
_RELOAD_ERROR = ""

# Match the Tauri-side BlenderConfig defaults
# (packages/app-tauri/src/core/blender/types.rs).
HOST = "127.0.0.1"
PORT = 9875

# Per-client recv buffer. JSON frames usually fit comfortably; large
# scene-graph dumps may run into the high tens of KB.
RECV_CHUNK = 8192

# Server thread polls accept() with this timeout so it can notice unregister().
ACCEPT_TIMEOUT_SECS = 1.0

# How often the hot-reload watcher polls __init__.py for an mtime change.
# At ~20µs per stat() this is well under any user-perceptible cost (issue #252).
WATCH_INTERVAL_SECS = 3.0
# When a change has been detected but a command is in flight (or the file is
# still being written), recheck this often so the reload fires promptly once
# the queue drains.
WATCH_BUSY_INTERVAL_SECS = 0.5

# Module path used for self-reload via Blender's addon machinery. `__package__`
# is the real value at runtime under Blender (`bl_ext.user_default.agent_3d`);
# the literal fallback only kicks in for direct test imports where Python sets
# `__package__` to `""`.
_RELOAD_MODULE = __package__ or "bl_ext.user_default.agent_3d"

# State for the watcher. Module-globals so they survive across timer ticks
# without needing a wrapper class. `_LAST_MTIME` is captured in register()
# and only advances when we actually schedule a reload — that way a busy/
# debounced tick doesn't lose the change we still need to act on.
_LAST_MTIME = 0.0
_IN_FLIGHT = 0
_IN_FLIGHT_LOCK = threading.Lock()


def _bump_in_flight(delta):
    """Adjust the in-flight command counter under the GIL-and-lock combo.

    Called by the dispatch path to bracket each command. The watcher reads
    `_IN_FLIGHT` without locking — the GIL makes a single int read atomic on
    CPython, and a stale read just defers reload by one extra tick.
    """
    global _IN_FLIGHT
    with _IN_FLIGHT_LOCK:
        _IN_FLIGHT += delta


# --------------------------------------------------------------------------
# TCP server
# --------------------------------------------------------------------------


class _BridgeServer:
    """Single-instance TCP listener. Started in `register()`, stopped in
    `unregister()`. Concurrency model documented in the module docstring.
    """

    def __init__(self):
        self._socket = None
        self._thread = None
        self._running = False

    def start(self):
        if self._running:
            return
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            # SO_REUSEADDR so a Blender restart doesn't TIME_WAIT us out.
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind((HOST, PORT))
            sock.listen(4)
            sock.settimeout(ACCEPT_TIMEOUT_SECS)
            self._socket = sock
            self._running = True
            self._thread = threading.Thread(
                target=self._accept_loop, name="agent_3d.accept", daemon=True
            )
            self._thread.start()
            print(f"[agent_3d] listening on {HOST}:{PORT}")
        except OSError as exc:
            # Port collision (a second Blender already running, an old
            # legacy addon still bound, etc.). Don't crash extension load —
            # the user gets visible feedback in the system console.
            print(f"[agent_3d] cannot bind {HOST}:{PORT}: {exc}")
            self._running = False
            with suppress(Exception):
                if self._socket:
                    self._socket.close()
            self._socket = None

    def stop(self):
        self._running = False
        if self._socket is not None:
            with suppress(Exception):
                self._socket.close()
            self._socket = None
        if self._thread is not None:
            with suppress(Exception):
                self._thread.join(timeout=2.0)
            self._thread = None
        print("[agent_3d] stopped")

    def _accept_loop(self):
        while self._running:
            try:
                client, _addr = self._socket.accept()
            except TimeoutError:
                continue
            except OSError:
                # Socket closed during shutdown — exit cleanly.
                return
            client_thread = threading.Thread(
                target=self._handle_client,
                args=(client,),
                name="agent_3d.client",
                daemon=True,
            )
            client_thread.start()

    def _handle_client(self, client):
        """Receive one or more JSON frames from a single connection.

        The Tauri bridge layer uses one persistent TCP connection across
        many bridge invocations, so we don't close after the first frame —
        we keep reading until the peer EOFs.

        Wire framing per `03-agent-subsystem.md §14`: newline-delimited JSON.
        We split the buffer on `\n` and json.loads each complete line; any
        trailing partial line stays in the buffer until the next chunk fills it.
        """
        client.settimeout(None)
        buffer = bytearray()
        try:
            while self._running:
                try:
                    chunk = client.recv(RECV_CHUNK)
                except OSError:
                    break
                if not chunk:
                    break
                buffer.extend(chunk)

                # Split on newline; the last element is whatever's after the
                # final `\n` and stays buffered for the next read.
                parts = buffer.split(b"\n")
                buffer = bytearray(parts[-1])
                for raw in parts[:-1]:
                    if not raw:
                        continue
                    try:
                        text = raw.decode("utf-8")
                    except UnicodeDecodeError:
                        # Frame had invalid UTF-8 — drop it; the bridge will
                        # surface a connection_lost error and reconnect.
                        continue
                    try:
                        command = json.loads(text)
                    except json.JSONDecodeError:
                        # Malformed frame — drop and keep reading.
                        continue
                    _dispatch_on_main(command, client)
        finally:
            with suppress(Exception):
                client.close()


_server = _BridgeServer()


# --------------------------------------------------------------------------
# Main-thread dispatch — every command runs in a bpy.app.timer
# --------------------------------------------------------------------------


def _dispatch_on_main(command, client):
    """Schedule command execution on Blender's main thread, then send the
    response back from a worker thread so socket I/O never blocks Blender's UI.

    A slow or stalled TCP peer can hold `sendall` for arbitrary time on the
    rare path where the kernel buffer fills (large screenshots, etc.). We
    keep the bpy work on the main thread (mandatory) and hand the encoded
    response off to a daemon thread for the actual send.
    """

    _bump_in_flight(1)

    def run():
        try:
            try:
                response = _execute(command)
            except Exception as exc:  # pragma: no cover — last-resort safety net
                response = {
                    "status": "error",
                    "message": str(exc),
                    "error": str(exc),
                }
            # Newline-terminated frame to match the read path's split-on-`\n`.
            payload = json.dumps(response, ensure_ascii=False).encode("utf-8") + b"\n"
        finally:
            # Decrement once bpy work is done — `_IN_FLIGHT` gates hot-reload
            # against in-progress bpy execution, not socket delivery. Doing it
            # in `_send_payload`'s finally would let a wedged `sendall` (full
            # kernel buffer on a screenshot, dead peer) keep the counter
            # elevated and starve the reload watcher.
            _bump_in_flight(-1)
        threading.Thread(
            target=_send_payload,
            args=(client, payload),
            name="agent_3d.send",
            daemon=True,
        ).start()
        return None  # Don't re-fire the timer.

    bpy.app.timers.register(run, first_interval=0.0)


def _send_payload(client, payload):
    """Off-main-thread sender. Survives peer disconnects silently — by the
    time we get here, the dispatch already completed, so a failed send is
    nothing actionable for the agent."""
    try:
        client.sendall(payload)
    except OSError:
        # Peer hung up between command + response.
        pass


# --------------------------------------------------------------------------
# Command handlers — one per spec entry in §14.4
# --------------------------------------------------------------------------


def _execute(command):
    cmd_type = command.get("type")
    params = command.get("params", {}) or {}

    handler = _HANDLERS.get(cmd_type)
    if handler is None:
        return _error(f"Unknown command type: {cmd_type}")
    try:
        result = handler(**params)
    except TypeError as exc:
        # Bad params shape (missing required arg, etc.) — surface as user error.
        return _error(f"{cmd_type}: {exc}")
    except Exception as exc:
        return _error(str(exc), traceback=traceback.format_exc())
    if isinstance(result, dict) and "error" in result and "status" not in result:
        # Handler returned an error envelope directly. Preserve the FULL
        # envelope — `execute_code` returns rich diagnostic fields
        # (`error_code`, `line`, `offset`, `stdout`, `stderr`, `traceback`,
        # `returncode`) that the agent's error-recovery rules in
        # `system-prompt.md` depend on. Just stamp the missing top-level
        # `status`/`message` fields and pass the rest through.
        envelope = dict(result)
        envelope["status"] = "error"
        envelope.setdefault("message", str(result["error"]))
        return envelope
    return _success(result)


def _success(result):
    return {"status": "success", "result": result}


def _error(message, *, traceback=None):
    # Populate both `message` and `error` so consumers can read either field
    # (matches packages/app-tauri/src/core/blender/types.rs `BlenderResponse`).
    payload = {"status": "error", "message": message, "error": message}
    if traceback is not None:
        payload["traceback"] = traceback
    return payload


# --------------------------------------------------------------------------
# handshake — first frame on every new TCP connection (§14.2 / Rule C1)
# --------------------------------------------------------------------------


def _h_handshake(bridge_protocol=None, client_version=None):
    """Rule C1 (bugs.md §21.9): error envelope must name both versions so the
    user knows which side to upgrade. No silent degradation."""
    if bridge_protocol is not None and bridge_protocol != PROTOCOL_VERSION:
        # Name both versions (Rule C1, bugs.md §21.9) but lead with a restart:
        # the common cause is an older extension still loaded in memory after
        # the app updated, not a too-new app (issue #1117).
        return {
            "error": (
                f"Bridge protocol {bridge_protocol!r} does not match the 3D Agent extension "
                f"loaded in Blender (protocol {PROTOCOL_VERSION!r}). Blender is running an older "
                f"copy of the extension in memory — close and reopen Blender to load the installed "
                f"extension. If it still does not match, make sure the 3D-Agent app finished updating."
            )
        }
    return {
        "blender_version": bpy.app.version_string,
        "server_version": _EXTENSION_VERSION,
        "protocol": PROTOCOL_VERSION,
        "reload_failed": _RELOAD_FAILED,
        "reload_error": _RELOAD_ERROR,
    }


# --------------------------------------------------------------------------
# get_blender_info
# --------------------------------------------------------------------------


def _h_get_blender_info():
    return {
        "blender_version": list(bpy.app.version),
        "blender_version_string": bpy.app.version_string,
        "python_version": (
            f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
        ),
        "addon_version": _EXTENSION_VERSION,
        "protocol_version": PROTOCOL_VERSION,
        "reload_failed": _RELOAD_FAILED,
        "reload_error": _RELOAD_ERROR,
        "os": sys.platform,
        "render_engine": bpy.context.scene.render.engine,
        "blend_filepath": bpy.data.filepath,
        "blend_file_exists": bool(bpy.data.filepath),
        "is_saved": bool(bpy.data.filepath) and not bpy.data.is_dirty,
    }


# --------------------------------------------------------------------------
# get_scene_info
# --------------------------------------------------------------------------


def _h_get_scene_info():
    scene = bpy.context.scene
    objects = []
    for obj in scene.objects:
        objects.append(
            {
                "name": obj.name,
                "type": obj.type,
                "location": [
                    round(float(obj.location.x), 4),
                    round(float(obj.location.y), 4),
                    round(float(obj.location.z), 4),
                ],
            }
        )
    cameras = [o.name for o in scene.objects if o.type == "CAMERA"]
    lights = [o.name for o in scene.objects if o.type == "LIGHT"]
    return {
        "name": scene.name,
        "objects": objects,
        "object_count": len(scene.objects),
        "materials": [m.name for m in bpy.data.materials],
        "cameras": cameras,
        "lights": lights,
        "units": scene.unit_settings.system,
        # FR-154: agent reads filepath from bpy.data.filepath, never from prompts.
        "filepath": bpy.data.filepath,
    }


# --------------------------------------------------------------------------
# get_scene_graph — Scene Collection root special-cased per §7.7
# --------------------------------------------------------------------------


def _h_get_scene_graph(max_objects=0):
    scene = bpy.context.scene
    depsgraph = bpy.context.evaluated_depsgraph_get()

    out = {
        "scene": {
            "name": scene.name,
            "frame_current": int(scene.frame_current),
            "unit_scale": float(scene.unit_settings.scale_length),
            "camera": scene.camera.name if scene.camera else None,
        },
        "objects": [],
    }

    for i, obj in enumerate(scene.objects):
        if max_objects and i >= max_objects:
            break
        obj_eval = obj.evaluated_get(depsgraph)
        info = {
            "name": obj.name,
            "type": obj.type,
            "parent": obj.parent.name if obj.parent else None,
            # §7.7 — exclude the read-only Scene Collection root from the
            # collections list. Other collections are reported as-is.
            "collections": [c.name for c in obj.users_collection if c.name != "Scene Collection"],
            "visible": bool(obj.visible_get()),
            "location": _vec3(obj.location),
            "rotation_euler": _vec3(obj.rotation_euler),
            "scale": _vec3(obj.scale),
            "dimensions": _vec3(obj.dimensions),
        }
        if obj.type == "MESH":
            with suppress(Exception):
                mesh = obj_eval.to_mesh()
                try:
                    info["mesh"] = {
                        "vertices": len(mesh.vertices),
                        "edges": len(mesh.edges),
                        "polygons": len(mesh.polygons),
                    }
                finally:
                    with suppress(Exception):
                        obj_eval.to_mesh_clear()
        out["objects"].append(info)
    return out


# --------------------------------------------------------------------------
# get_object_info — Scene Collection root rejected per §7.7
# --------------------------------------------------------------------------


def _h_get_object_info(name):
    if name == "Scene Collection":
        return {
            "error": (
                "Scene Collection is the root collection and is read-only. "
                "Query a child collection or an object instead."
            )
        }
    obj = bpy.data.objects.get(name)
    if obj is None:
        return {"error": f"Object not found: {name}"}

    matrix_world = [list(row) for row in obj.matrix_world]
    info = {
        "name": obj.name,
        "type": obj.type,
        "location": _vec3(obj.location),
        "rotation_euler": _vec3(obj.rotation_euler),
        "scale": _vec3(obj.scale),
        "matrix_world": matrix_world,
        "mesh_id": obj.data.name if obj.data else None,
        "materials": [slot.material.name for slot in obj.material_slots if slot.material],
        "custom_properties": _custom_props(obj),
    }
    return info


# --------------------------------------------------------------------------
# get_mesh_stats
# --------------------------------------------------------------------------


def _h_get_mesh_stats(name):
    obj = bpy.data.objects.get(name)
    if obj is None:
        return {"error": f"Object not found: {name}"}
    if obj.type != "MESH":
        return {"error": f"Object {name!r} is not a mesh"}

    depsgraph = bpy.context.evaluated_depsgraph_get()
    obj_eval = obj.evaluated_get(depsgraph)
    mesh = obj_eval.to_mesh()
    try:
        return {
            "name": obj.name,
            "vertices": len(mesh.vertices),
            "edges": len(mesh.edges),
            "faces": len(mesh.polygons),
            "uv_maps": [layer.name for layer in mesh.uv_layers],
            "material_slots": [
                slot.material.name if slot.material else None for slot in obj.material_slots
            ],
        }
    finally:
        with suppress(Exception):
            obj_eval.to_mesh_clear()


# --------------------------------------------------------------------------
# get_viewport_screenshot
# --------------------------------------------------------------------------


def _h_get_viewport_screenshot(filepath, max_size=800, **_extra):
    import os

    if not filepath:
        return {"error": "filepath is required"}

    area = next(
        (a for a in bpy.context.screen.areas if a.type == "VIEW_3D"),
        None,
    )
    if area is None:
        return {"error": "No 3D viewport found in the active screen"}

    os.makedirs(os.path.dirname(filepath) or ".", exist_ok=True)
    with bpy.context.temp_override(area=area):
        bpy.ops.screen.screenshot_area(filepath=filepath)

    if not os.path.exists(filepath):
        return {"error": "Screenshot file was not created"}

    width = -1
    height = -1
    resized = False
    if max_size and max_size > 0:
        with suppress(Exception):
            img = bpy.data.images.load(filepath)
            try:
                w, h = img.size
                width, height = w, h
                if max(w, h) > max_size:
                    scale = max_size / float(max(w, h))
                    new_w, new_h = int(w * scale), int(h * scale)
                    img.scale(new_w, new_h)
                    img.file_format = "PNG"
                    img.filepath_raw = filepath
                    img.save()
                    width, height = new_w, new_h
                    resized = True
            finally:
                with suppress(Exception):
                    bpy.data.images.remove(img)

    # RUN-158 byte-diet instrumentation: `resized` lets the app-side embed log
    # record whether this capture went through the max_size downscale. The
    # on-wire byte count is measured app-side from the actual file read — no
    # duplicate (and separately fallible) getsize here.
    return {
        "path": filepath,
        "width": width,
        "height": height,
        "resized": resized,
    }


# --------------------------------------------------------------------------
# execute_code — the agent's primary write path
# --------------------------------------------------------------------------


def _h_execute_code(code, **_extra):
    if not isinstance(code, str):
        return {"error": "code must be a string"}

    # Compile-check first — surfaces SyntaxError at the right line without
    # half-executing a broken script.
    try:
        compile(code, "<agent_3d>", "exec")
    except SyntaxError as exc:
        return {
            "error_code": "syntax_error",
            "error": exc.msg,
            "message": exc.msg,
            "line": exc.lineno,
            "offset": exc.offset,
        }

    import io

    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()
    namespace = {"bpy": bpy, "__name__": "__agent_3d__"}
    real_stdout, real_stderr = sys.stdout, sys.stderr
    try:
        sys.stdout, sys.stderr = stdout_buf, stderr_buf
        exec(code, namespace)
        return {
            "stdout": stdout_buf.getvalue(),
            "stderr": stderr_buf.getvalue(),
            "returncode": 0,
        }
    except Exception as exc:
        return {
            "error_code": "runtime_error",
            "error": str(exc),
            "message": str(exc),
            "traceback": traceback.format_exc(),
            "stdout": stdout_buf.getvalue(),
            "stderr": stderr_buf.getvalue(),
            "returncode": 1,
        }
    finally:
        sys.stdout, sys.stderr = real_stdout, real_stderr


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------


def _vec3(v):
    return [float(v[0]), float(v[1]), float(v[2])]


def _custom_props(obj):
    """Return user-set custom properties, skipping Blender-internal `_RNA_UI`
    and renderer-specific noise.
    """
    out = {}
    for key in obj.keys():
        if key in ("_RNA_UI", "cycles", "cycles_visibility"):
            continue
        try:
            value = obj[key]
            json.dumps(value)  # JSON-safety check
            out[key] = value
        except (TypeError, ValueError):
            out[key] = str(obj[key])
    return out


_HANDLERS = {
    "handshake": _h_handshake,
    "get_blender_info": _h_get_blender_info,
    "get_scene_info": _h_get_scene_info,
    "get_scene_graph": _h_get_scene_graph,
    "get_object_info": _h_get_object_info,
    "get_mesh_stats": _h_get_mesh_stats,
    "get_viewport_screenshot": _h_get_viewport_screenshot,
    "execute_code": _h_execute_code,
}


# --------------------------------------------------------------------------
# Hot reload — issue #252
#
# When the desktop app updates `__init__.py` on disk while Blender is already
# running, Python's import cache keeps serving the previously-imported module
# and any new dispatch entries (handshake, new handlers) come back as
# "Unknown command type" errors. The watcher polls the source mtime and, when
# it changes, re-runs the addon disable/enable cycle so Blender re-imports
# the module from disk. No user-visible Blender restart required.
# --------------------------------------------------------------------------


def _watch_for_updates():
    """Tick the mtime watcher. Returns the next interval to reschedule, or
    `None` to stop (when reload has been scheduled).

    Three-way decision:
      - mtime unchanged                       → reschedule at steady interval
      - mtime changed but command in flight   → reschedule at busy interval
      - mtime changed and queue idle          → schedule reload, stop self
    """
    global _LAST_MTIME
    try:
        mtime = os.path.getmtime(__file__)
    except OSError:
        # Source got moved/deleted — keep polling, the file may reappear.
        return WATCH_INTERVAL_SECS
    if mtime == _LAST_MTIME:
        return WATCH_INTERVAL_SECS
    if _IN_FLIGHT > 0:
        # Don't reload mid-command. Recheck soon; do NOT advance _LAST_MTIME
        # yet, otherwise the next idle tick would think we already handled it.
        return WATCH_BUSY_INTERVAL_SECS
    _LAST_MTIME = mtime
    print("[agent_3d] source changed; scheduling reload")
    bpy.app.timers.register(_trigger_reload, first_interval=0.0)
    return None  # Stop this timer; the reloaded module will start its own.


def _trigger_reload():
    """One-shot reload via Blender's addon machinery. Runs as a separate
    main-thread timer so the watcher's stack frame is fully unwound before
    we disable+re-enable our own module.

    If the new source has a syntax error, py_compile raises and we keep the
    existing in-memory version running rather than leaving Blender with no
    extension at all. In that case we re-arm the watcher so a subsequent
    file change (e.g. the user fixing the syntax error) is still picked up.
    """
    global _RELOAD_FAILED, _RELOAD_ERROR
    try:
        # `addon_utils` is Blender-only; lazy-imported so the test harness can
        # exercise this module under a stub `bpy` without it.
        import addon_utils

        py_compile.compile(__file__, doraise=True)
        addon_utils.disable(_RELOAD_MODULE, default_set=False)
        addon_utils.enable(_RELOAD_MODULE, default_set=False)
        print("[agent_3d] reloaded from disk")
    except Exception as exc:
        # Flag the stale state so the bridge can report it (issue #1117).
        _RELOAD_FAILED = True
        _RELOAD_ERROR = str(exc)
        print(f"[agent_3d] hot reload failed; staying on previous version: {exc}")
        # Watcher was stopped when it scheduled this reload; on success the
        # re-imported module's `register()` rearms it, but on failure we have
        # to do it ourselves or the extension goes deaf to future changes.
        with suppress(Exception):
            if not bpy.app.timers.is_registered(_watch_for_updates):
                bpy.app.timers.register(_watch_for_updates, first_interval=WATCH_INTERVAL_SECS)
    return None  # One-shot.


# --------------------------------------------------------------------------
# Extension lifecycle
# --------------------------------------------------------------------------


def register():
    global _LAST_MTIME
    try:
        _LAST_MTIME = os.path.getmtime(__file__)
    except OSError:
        _LAST_MTIME = 0.0
    _server.start()
    bpy.app.timers.register(_watch_for_updates, first_interval=WATCH_INTERVAL_SECS)


def unregister():
    # Tear down the watcher first — once Blender starts reimporting us, any
    # surviving timer reference would still fire on the dead module.
    with suppress(Exception):
        if bpy.app.timers.is_registered(_watch_for_updates):
            bpy.app.timers.unregister(_watch_for_updates)
    _server.stop()
