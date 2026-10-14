bl_info = {
    "name": "3D Agent",
    "author": "3D-Agent Community",
    "version": (1, 0, 0),
    "blender": (3, 6, 0),
    "location": "View3D > Sidebar > 3D Agent",
    "description": "AI-powered 3D creation assistant - chat with Blender",
    "category": "3D View",
}

import bpy
import json
import os
import threading
import http.client
import queue
import math
from types import SimpleNamespace
from bpy.props import (
    StringProperty,
    BoolProperty,
    EnumProperty,
    IntProperty,
    FloatProperty,
    CollectionProperty,
    PointerProperty,
)
from bpy.types import (
    Panel,
    Operator,
    PropertyGroup,
    UIList,
)


# ──────────────────────────────────────────────
# LLM Provider Detection & Communication
# ──────────────────────────────────────────────

class LLMConfig:
    """Auto-detect and manage LLM API keys"""

    PROVIDERS = {
        "openai": {
            "env": "OPENAI_API_KEY",
            "host": "api.openai.com",
            "path": "/v1/chat/completions",
            "model": "gpt-4o-mini",
        },
        "anthropic": {
            "env": "ANTHROPIC_API_KEY",
            "host": "api.anthropic.com",
            "path": "/v1/messages",
            "model": "claude-3-haiku-20240307",
        },
        "groq": {
            "env": "GROQ_API_KEY",
            "host": "api.groq.com",
            "path": "/openai/v1/chat/completions",
            "model": "llama-3.1-8b-instant",
        },
        "deepseek": {
            "env": "DEEPSEEK_API_KEY",
            "host": "api.deepseek.com",
            "path": "/v1/chat/completions",
            "model": "deepseek-chat",
        },
    }

    @staticmethod
    def detect_keys():
        detected = {}
        for name, cfg in LLMConfig.PROVIDERS.items():
            key = os.environ.get(cfg["env"], "")
            if key:
                detected[name] = key
        return detected

    @staticmethod
    def call_openai(api_key, messages, model="gpt-4o-mini"):
        return LLMConfig._call_openai_compatible(
            "api.openai.com", "/v1/chat/completions", api_key, messages, model
        )

    @staticmethod
    def call_anthropic(api_key, messages, model="claude-3-haiku-20240307"):
        system_msg = ""
        user_msgs = []
        for m in messages:
            if m["role"] == "system":
                system_msg = m["content"]
            else:
                user_msgs.append(m)

        body = json.dumps({
            "model": model,
            "max_tokens": 1024,
            "system": system_msg,
            "messages": user_msgs,
        })

        conn = http.client.HTTPSConnection("api.anthropic.com", timeout=30)
        headers = {
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        }
        data = LLMConfig._request(conn, "/v1/messages", body, headers)
        content = data.get("content", [])
        text = "\n".join(item["text"] for item in content if item.get("type") == "text")
        if not text:
            raise ValueError("Provider returned no text")
        return text

    @staticmethod
    def call_groq(api_key, messages, model="llama-3.1-8b-instant"):
        return LLMConfig._call_openai_compatible(
            "api.groq.com", "/openai/v1/chat/completions", api_key, messages, model
        )

    @staticmethod
    def call_deepseek(api_key, messages, model="deepseek-chat"):
        return LLMConfig._call_openai_compatible(
            "api.deepseek.com", "/v1/chat/completions", api_key, messages, model
        )

    @staticmethod
    def _call_openai_compatible(host, path, api_key, messages, model):
        body = json.dumps({
            "model": model,
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 1024,
        })

        conn = http.client.HTTPSConnection(host, timeout=30)
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        }
        data = LLMConfig._request(conn, path, body, headers)
        try:
            text = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            raise ValueError("Provider returned no text") from None
        if not isinstance(text, str) or not text.strip():
            raise ValueError("Provider returned no text")
        return text

    @staticmethod
    def _request(conn, path, body, headers):
        try:
            conn.request("POST", path, body, headers)
            response = conn.getresponse()
            raw = response.read(1024 * 1024 + 1)
            if not 200 <= response.status < 300:
                raise ValueError(f"Provider HTTP error {response.status}")
            if len(raw) > 1024 * 1024:
                raise ValueError("Provider response exceeds 1 MiB")
            try:
                data = json.loads(raw.decode("utf-8"))
            except (ValueError, UnicodeError):
                raise ValueError("Provider returned invalid JSON") from None
            if not isinstance(data, dict) or "error" in data:
                raise ValueError("Provider rejected the request")
            return data
        finally:
            conn.close()


# ──────────────────────────────────────────────
# Command Parser (Deterministic)
# ──────────────────────────────────────────────

import re

COMMAND_PATTERNS = [
    (r"create\s+(?:a\s+)?cube",       "create", {"type": "CUBE"}),
    (r"create\s+(?:a\s+)?sphere",     "create", {"type": "SPHERE"}),
    (r"create\s+(?:a\s+)?cylinder",   "create", {"type": "CYLINDER"}),
    (r"create\s+(?:a\s+)?cone",       "create", {"type": "CONE"}),
    (r"create\s+(?:a\s+)?torus",      "create", {"type": "TORUS"}),
    (r"create\s+(?:a\s+)?plane",      "create", {"type": "PLANE"}),
    (r"add\s+(?:a\s+)?(?:suzanne|monkey)", "create", {"type": "MONKEY"}),
    (r"move\s+(?:it|selected|object)?\s*(?:to)?\s*\(?([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)\)?", "translate", None),
    (r"rotate\s+(?:it|selected|object)?\s*(?:by)?\s*([-\d.]+)\s*(?:degrees?|deg)?", "rotate", None),
    (r"scale\s+(?:it|selected|object)?\s*(?:by)?\s*([-\d.]+)", "scale", None),
    (r"(?:subdivide|sub)\s*(\d+)?", "subdivide", None),
    (r"smooth|shade\s+smooth", "smooth", None),
    (r"extrude\s*(?:by)?\s*([-\d.]+)?", "extrude", None),
    (r"render|render\s+it", "render", None),
    (r"^undo$", "undo", None),
    (r"^redo$", "redo", None),
    (r"delete|remove\s+(?:it|selected|object)", "delete", None),
    (r"what'?s?\s+(?:in\s+)?the\s+scene|scene\s+(?:info|objects)", "get_scene", None),
]


def parse_command(text):
    """Try to match text to a deterministic Blender command"""
    lower = text.lower().strip()

    for pattern, action, defaults in COMMAND_PATTERNS:
        m = re.fullmatch(pattern, lower)
        if m:
            return action, m, defaults

    return None, None, None


def execute_deterministic(action, match, defaults, text):
    """Convert matched commands to the same validated operation path as AI."""
    cmd = {"action": action}
    if defaults:
        cmd.update(defaults)
    if action == "translate":
        cmd.update(zip(("x", "y", "z"), map(float, match.groups())))
        validate_command(cmd)
        if not bpy.context.selected_objects:
            raise ValueError("Select an object first")
        for obj in bpy.context.selected_objects:
            obj.location = (cmd["x"], cmd["y"], cmd["z"])
        return f"Moved to ({cmd['x']}, {cmd['y']}, {cmd['z']})"
    if action == "rotate":
        angle = float(match.group(1))
        cmd["angle"] = math.radians(angle) if "deg" in text.lower() else angle
    elif action == "scale":
        cmd.update(dict.fromkeys(("x", "y", "z"), float(match.group(1))))
    elif action == "subdivide":
        cmd["cuts"] = int(match.group(1) or 1)
    elif action == "extrude":
        cmd["distance"] = float(match.group(1) or 1)
    return execute_llm_command(cmd)


# ──────────────────────────────────────────────
# Blender Properties
# ──────────────────────────────────────────────

class ChatMessage(PropertyGroup):
    role: StringProperty(name="Role")
    content: StringProperty(name="Content")


class AgentSettings(PropertyGroup):
    api_provider: EnumProperty(
        name="AI Provider",
        items=[
            ("none", "None (Deterministic Only)", "No AI - only regex commands"),
            ("openai", "OpenAI", "Use OpenAI API"),
            ("anthropic", "Anthropic", "Use Anthropic API"),
            ("groq", "Groq", "Use Groq API"),
            ("deepseek", "DeepSeek", "Use DeepSeek API"),
        ],
        default="none",
    )
    api_key: StringProperty(name="API Key", default="", subtype="PASSWORD", options={'SKIP_SAVE'})
    model: StringProperty(name="Model", default="")
    chat_history: CollectionProperty(type=ChatMessage)
    input_text: StringProperty(name="Input", default="")
    is_processing: BoolProperty(default=False)
    show_settings: BoolProperty(default=False)
    setup_complete: BoolProperty(default=True)
    detected_providers: StringProperty(default="")


# ──────────────────────────────────────────────
# Chat Engine
# ──────────────────────────────────────────────

SYSTEM_PROMPT = """You are 3D Agent, an AI assistant embedded in Blender.

You help users create and modify 3D scenes using natural language.

When the user asks you to perform a Blender action, respond with BOTH:
1. A natural explanation of what you're doing
2. A JSON command block on its own line starting with !CMD!

Available commands:
!CMD!{"action":"create","type":"cube|sphere|cylinder|cone|torus|plane|monkey"}
!CMD!{"action":"translate","x":0,"y":0,"z":1}
!CMD!{"action":"rotate","angle":1.57}
!CMD!{"action":"scale","x":1,"y":1,"z":1}
!CMD!{"action":"subdivide","cuts":2}
!CMD!{"action":"smooth"}
!CMD!{"action":"extrude","distance":1}
!CMD!{"action":"render"}
!CMD!{"action":"undo"}
!CMD!{"action":"redo"}
!CMD!{"action":"delete"}
!CMD!{"action":"get_scene"}

Example:
User: "Make a red sphere"
You: "Creating a sphere for you.\n!CMD!{"action":"create","type":"sphere"}"

If it's just a question (not a Blender action), respond normally without !CMD!."""


def chat_with_llm(settings, user_text, scene_context=""):
    """Send message to LLM and get response"""
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT + f"\n\nCurrent scene: {scene_context}"}
    ]

    # Add recent history
    for msg in list(settings.chat_history)[-10:]:
        messages.append({"role": msg.role, "content": msg.content})

    messages.append({"role": "user", "content": user_text})

    provider = settings.api_provider
    key = settings.api_key
    print(f"[3D Agent] Calling {provider} with model {settings.model}")

    try:
        if provider == "openai":
            return LLMConfig.call_openai(key, messages, settings.model or "gpt-4o-mini")
        elif provider == "anthropic":
            return LLMConfig.call_anthropic(key, messages, settings.model or "claude-3-haiku-20240307")
        elif provider == "groq":
            return LLMConfig.call_groq(key, messages, settings.model or "llama-3.1-8b-instant")
        elif provider == "deepseek":
            return LLMConfig.call_deepseek(key, messages, settings.model or "deepseek-chat")
    except Exception:
        return "AI request failed. Check the provider, model, key and network connection."
    return "No AI provider configured."


def get_scene_context():
    """Get current scene info for LLM context"""
    scene = bpy.context.scene
    objs = [(o.name, o.type) for o in scene.objects]
    return f"Scene '{scene.name}' with {len(objs)} objects: {[o[0] for o in objs]}"


def process_llm_response(response_text):
    """Validate every command before changing the scene; never evaluate Python."""
    commands = []
    lines = []
    for line in response_text.splitlines():
        if line.lstrip().startswith("!CMD!"):
            command = json.loads(line.lstrip()[5:].strip())
            validate_command(command)
            commands.append(command)
        else:
            lines.append(line)
    if len(commands) > 20:
        raise ValueError("A response may contain at most 20 commands")
    return "\n".join(lines).strip(), [execute_llm_command(cmd) for cmd in commands]


def validate_command(cmd):
    if not isinstance(cmd, dict):
        raise ValueError("Command must be an object")
    action = cmd.get("action")
    allowed = {"create", "translate", "rotate", "scale", "subdivide", "smooth",
               "extrude", "render", "undo", "redo", "delete", "get_scene"}
    if action not in allowed:
        raise ValueError("Unsupported command")
    if action == "create" and str(cmd.get("type", "cube")).lower() not in {
            "cube", "sphere", "cylinder", "cone", "torus", "plane", "monkey"}:
        raise ValueError("Unsupported primitive")
    for key in ("x", "y", "z", "angle", "distance"):
        if key in cmd and (isinstance(cmd[key], bool) or not isinstance(cmd[key], (int, float))
                           or not math.isfinite(cmd[key]) or abs(cmd[key]) > 10000):
            raise ValueError(f"Invalid numeric value: {key}")
    loc = cmd.get("location", [0, 0, 0])
    if not isinstance(loc, (list, tuple)) or len(loc) != 3:
        raise ValueError("Location must have three coordinates")
    for value in loc:
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or abs(value) > 10000:
            raise ValueError("Invalid location")
    cuts = cmd.get("cuts", 1)
    if isinstance(cuts, bool) or not isinstance(cuts, int) or not 1 <= cuts <= 10:
        raise ValueError("Subdivision cuts must be an integer from 1 to 10")


def execute_llm_command(cmd):
    """Execute a command dict from LLM"""
    validate_command(cmd)
    action = cmd.get("action")

    if action == "create":
        t = cmd.get("type", "cube").upper()
        loc = cmd.get("location", [0, 0, 0])
        ops = {
            "CUBE":     lambda: bpy.ops.mesh.primitive_cube_add(size=1, location=loc),
            "SPHERE":   lambda: bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=32, location=loc),
            "CYLINDER": lambda: bpy.ops.mesh.primitive_cylinder_add(radius=1, depth=2, location=loc),
            "CONE":     lambda: bpy.ops.mesh.primitive_cone_add(radius1=1, depth=2, location=loc),
            "TORUS":    lambda: bpy.ops.mesh.primitive_torus_add(major_radius=1, minor_radius=0.25, location=loc),
            "PLANE":    lambda: bpy.ops.mesh.primitive_plane_add(size=2, location=loc),
            "MONKEY":   lambda: bpy.ops.mesh.primitive_monkey_add(location=loc),
        }
        if t in ops:
            ops[t]()
            return f"Created {t.lower()}"

    elif action == "translate":
        x, y, z = cmd.get("x", 0), cmd.get("y", 0), cmd.get("z", 0)
        bpy.ops.transform.translate(value=(x, y, z))
        return f"Translated ({x}, {y}, {z})"

    elif action == "rotate":
        angle = cmd.get("angle", 0)
        bpy.ops.transform.rotate(value=angle, orient_axis='Z')
        return f"Rotated {angle:.2f} rad"

    elif action == "scale":
        x, y, z = cmd.get("x", 1), cmd.get("y", 1), cmd.get("z", 1)
        bpy.ops.transform.resize(value=(x, y, z))
        return f"Scaled ({x}, {y}, {z})"

    elif action in {"subdivide", "extrude"}:
        obj = bpy.context.active_object
        if obj is None or obj.type != "MESH":
            raise ValueError("Select an active mesh first")
        original_mode = obj.mode
        try:
            if original_mode != "EDIT":
                bpy.ops.object.mode_set(mode='EDIT')
            if action == "subdivide":
                cuts = cmd.get("cuts", 1)
                bpy.ops.mesh.subdivide(number_cuts=cuts)
                return f"Subdivided {cuts}x"
            distance = cmd.get("distance", 1)
            bpy.ops.mesh.extrude_region_move(TRANSFORM_OT_translate={"value": (0, 0, distance)})
            return f"Extruded {distance}"
        finally:
            if obj.mode != original_mode:
                bpy.ops.object.mode_set(mode=original_mode)

    elif action == "smooth":
        bpy.ops.object.shade_smooth()
        return "Smooth shading applied"

    elif action == "render":
        bpy.ops.render.render(write_still=True)
        return "Rendered"

    elif action == "undo":
        bpy.ops.ed.undo()
        return "Undone"

    elif action == "redo":
        bpy.ops.ed.redo()
        return "Redone"

    elif action == "delete":
        bpy.ops.object.delete(use_global=False)
        return "Deleted"

    elif action == "get_scene":
        return get_scene_context()

    return f"Unknown action: {action}"


# ──────────────────────────────────────────────
# Operators
# ──────────────────────────────────────────────

class AGENT_OT_send_message(Operator):
    """Send message to 3D Agent"""
    bl_idname = "agent.send_message"
    bl_label = "Send"

    def execute(self, context):
        settings = context.scene.agent_settings
        text = settings.input_text.strip()
        if not text or settings.is_processing:
            return {'CANCELLED'}

        # Add user message
        msg = settings.chat_history.add()
        msg.role = "user"
        msg.content = text
        settings.input_text = ""

        # Process
        settings.is_processing = True

        try:
            # Try deterministic first
            action, match, defaults = parse_command(text)

            if action:
                result = execute_deterministic(action, match, defaults, text)
                response = result
            elif settings.api_provider != "none" and settings.api_key:
                scene_ctx = get_scene_context()
                snapshot = SimpleNamespace(api_provider=settings.api_provider,
                    api_key=settings.api_key, model=settings.model,
                    chat_history=[SimpleNamespace(role=m.role, content=m.content)
                                  for m in list(settings.chat_history)[:-1][-10:]])
                scene = context.scene
                results = queue.Queue()
                def request():
                    try:
                        result = chat_with_llm(snapshot, text, scene_ctx)
                    except Exception:
                        result = "AI request failed. Check the provider, model, key and network connection."
                    results.put(result)
                threading.Thread(target=request, daemon=True).start()
                def finish():
                    if results.empty():
                        return 0.1
                    try:
                        if not hasattr(scene, "agent_settings"):
                            return None
                        current = scene.agent_settings
                        if bpy.context.scene != scene:
                            response = "Scene changed during the request; no commands executed."
                        else:
                            response, executed = process_llm_response(results.get_nowait())
                            if executed:
                                response += "\n\nExecuted: " + ", ".join(executed)
                        msg = current.chat_history.add()
                        msg.role, msg.content = "assistant", response
                    except Exception as exc:
                        if hasattr(scene, "agent_settings"):
                            msg = scene.agent_settings.chat_history.add()
                            msg.role, msg.content = "assistant", f"Command failed: {exc}"
                    finally:
                        if hasattr(scene, "agent_settings"):
                            scene.agent_settings.is_processing = False
                    return None
                bpy.app.timers.register(finish)
                return {'FINISHED'}
            else:
                response = (
                    f"Received: \"{text}\"\n\n"
                    "Try: create cube, move to 1 2 3, rotate 45 degrees, scale 2\n"
                    "Or configure an AI provider in Settings for natural language."
                )

            # Add response
            msg = settings.chat_history.add()
            msg.role = "assistant"
            msg.content = response

        except Exception as e:
            msg = settings.chat_history.add()
            msg.role = "assistant"
            msg.content = f"Error: {str(e)}"

        settings.is_processing = False
        return {'FINISHED'}


class AGENT_OT_clear_chat(Operator):
    """Clear chat history"""
    bl_idname = "agent.clear_chat"
    bl_label = "Clear Chat"

    def execute(self, context):
        if context.scene.agent_settings.is_processing:
            return {'CANCELLED'}
        context.scene.agent_settings.chat_history.clear()
        return {'FINISHED'}


class AGENT_OT_toggle_settings(Operator):
    """Toggle settings panel"""
    bl_idname = "agent.toggle_settings"
    bl_label = "Settings"

    def execute(self, context):
        settings = context.scene.agent_settings
        settings.show_settings = not settings.show_settings
        return {'FINISHED'}


class AGENT_OT_detect_keys(Operator):
    """Auto-detect API keys from environment"""
    bl_idname = "agent.detect_keys"
    bl_label = "Detect API Keys"

    def execute(self, context):
        settings = context.scene.agent_settings
        detected = LLMConfig.detect_keys()

        if detected:
            provider = list(detected.keys())[0]
            settings.api_provider = provider
            settings.api_key = detected[provider]
            settings.setup_complete = True
            self.report({'INFO'}, f"Detected {provider} key")
        else:
            self.report({'WARNING'}, "No API keys found in environment")

        return {'FINISHED'}


class AGENT_OT_quick_setup(Operator):
    """Quick setup - auto-detect and configure AI provider"""
    bl_idname = "agent.quick_setup"
    bl_label = "Quick Setup"
    bl_description = "Auto-detect API keys and configure AI provider"

    def execute(self, context):
        settings = context.scene.agent_settings

        # Auto-detect from environment
        detected = LLMConfig.detect_keys()

        if detected:
            # Use first detected provider
            provider = list(detected.keys())[0]
            settings.api_provider = provider
            settings.api_key = detected[provider]
            settings.setup_complete = True
            self.report({'INFO'}, f"Auto-configured {provider}")
        else:
            # Show hint to user
            settings.show_settings = True
            self.report({'INFO'}, "No keys found - please enter API key in settings")

        return {'FINISHED'}


class AGENT_OT_save_api_key(Operator):
    """Save API key and complete setup"""
    bl_idname = "agent.save_api_key"
    bl_label = "Save & Activate"

    def execute(self, context):
        settings = context.scene.agent_settings
        if settings.api_key and settings.api_provider != "none":
            settings.setup_complete = True
            self.report({'INFO'}, f"Activated {settings.api_provider}")
        else:
            self.report({'WARNING'}, "Please select provider and enter key")
        return {'FINISHED'}


# ──────────────────────────────────────────────
# UI Panels
# ──────────────────────────────────────────────

class AGENT_PT_main_panel(Panel):
    """Main 3D Agent panel in sidebar"""
    bl_label = "3D Agent"
    bl_idname = "AGENT_PT_main"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = '3D Agent'

    def draw(self, context):
        layout = self.layout
        settings = context.scene.agent_settings

        # Composer setup wizard (first launch)
        if not settings.setup_complete:
            box = layout.box()
            box.label(text="3D Agent Setup", icon='PREFERENCES')
            box.separator()

            row = box.row()
            row.scale_y = 1.5
            row.operator("agent.quick_setup", icon='VIEWZOOM')

            box.separator()
            box.label(text="Or configure manually:")
            box.operator("agent.toggle_settings", icon='PREFERENCES')
            return

        # Status row
        row = layout.row(align=True)
        if settings.api_provider != "none" and settings.api_key:
            row.label(text=f"AI: {settings.api_provider}")
        else:
            row.label(text="AI: None (commands only)")
        row.operator("agent.toggle_settings", text="", icon='PREFERENCES')

        # Chat messages area
        box = layout.box()
        col = box.column(align=True)

        if len(settings.chat_history) == 0:
            col.label(text="Type a command below:")
            col.label(text="  create cube")
            col.label(text="  move to 1 2 3")
            col.label(text="  rotate 45 degrees")
        else:
            msgs = list(settings.chat_history)[-15:]
            for msg in msgs:
                if msg.role == "user":
                    row = col.row()
                    row.label(text=f"You: {msg.content[:50]}")
                else:
                    row = col.row()
                    text = msg.content[:60].replace('\n', ' ')
                    row.label(text=f"AI: {text}")

        # Input row
        layout.separator()
        row = layout.row(align=True)
        row.prop(settings, "input_text", text="")
        row.operator("agent.send_message", text="Send", icon='PLAY')

        # Buttons row
        row = layout.row(align=True)
        row.operator("agent.clear_chat", text="Clear", icon='TRASH')


class AGENT_PT_settings_panel(Panel):
    """Settings sub-panel"""
    bl_label = "AI Settings"
    bl_idname = "AGENT_PT_settings"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = '3D Agent'
    bl_parent_id = "AGENT_PT_main"
    bl_options = {'DEFAULT_CLOSED'}

    @classmethod
    def poll(cls, context):
        return context.scene.agent_settings.show_settings

    def draw(self, context):
        layout = self.layout
        settings = context.scene.agent_settings

        layout.prop(settings, "api_provider")

        if settings.api_provider != "none":
            layout.prop(settings, "api_key")
            layout.prop(settings, "model")

            row = layout.row()
            row.scale_y = 1.5
            row.operator("agent.save_api_key", icon='CHECKMARK')

        layout.operator("agent.detect_keys", icon='VIEWZOOM')

        # Quick help
        box = layout.box()
        box.label(text="Quick Commands:", icon='INFO')
        col = box.column(align=True)
        col.scale_y = 0.8
        col.label(text="create cube/sphere/cylinder")
        col.label(text="move to x, y, z")
        col.label(text="rotate by degrees")
        col.label(text="scale by factor")
        col.label(text="subdivide / smooth")
        col.label(text="extrude / render")
        col.label(text="undo / redo / delete")


# ──────────────────────────────────────────────
# Registration
# ──────────────────────────────────────────────

classes = (
    ChatMessage,
    AgentSettings,
    AGENT_OT_send_message,
    AGENT_OT_clear_chat,
    AGENT_OT_toggle_settings,
    AGENT_OT_detect_keys,
    AGENT_OT_quick_setup,
    AGENT_OT_save_api_key,
    AGENT_PT_main_panel,
    AGENT_PT_settings_panel,
)


def register():
    for cls in classes:
        bpy.utils.register_class(cls)

    bpy.types.Scene.agent_settings = PointerProperty(type=AgentSettings)
    print("[3D Agent] Registered - type commands in sidebar")


def unregister():
    del bpy.types.Scene.agent_settings
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)
    print("[3D Agent] Unregistered")


if __name__ == "__main__":
    register()
