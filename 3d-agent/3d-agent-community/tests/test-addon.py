"""Run with Blender --background --factory-startup --python this-file."""
import contextlib
import sys
sys.dont_write_bytecode = True
import importlib.util
import io
import json
import math
from pathlib import Path
import tempfile
import subprocess
import unittest
from unittest.mock import patch
try:
    import bpy
    HAS_BLENDER = True
except ImportError:
    import sys
    from types import ModuleType, SimpleNamespace
    HAS_BLENDER = False
    bpy = ModuleType('bpy')
    props = ModuleType('bpy.props')
    for name in ('StringProperty', 'BoolProperty', 'EnumProperty', 'IntProperty',
                 'FloatProperty', 'CollectionProperty', 'PointerProperty'):
        setattr(props, name, lambda **kwargs: kwargs)
    types = ModuleType('bpy.types')
    for name in ('Panel', 'Operator', 'PropertyGroup', 'UIList'):
        setattr(types, name, type(name, (), {}))
    bpy.props, bpy.types = props, types
    sys.modules.update({'bpy': bpy, 'bpy.props': props, 'bpy.types': types})

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('community_agent', root / '3d_agent/__init__.py')
addon = importlib.util.module_from_spec(spec)
spec.loader.exec_module(addon)


class AddonTests(unittest.TestCase):
    def setUp(self):
        if HAS_BLENDER:
            bpy.ops.object.select_all(action='SELECT')
            bpy.ops.object.delete(use_global=False)

    def command(self, text):
        action, match, defaults = addon.parse_command(text)
        self.assertIsNotNone(action)
        return addon.execute_deterministic(action, match, defaults, text)

    @unittest.skipUnless(HAS_BLENDER, "Blender runtime is not installed")
    def test_scene_operations(self):
        self.command('create cube')
        obj = bpy.context.active_object
        obj.location = (5, 5, 5)
        self.command('move to 1 2 3')
        self.assertEqual(tuple(obj.location), (1, 2, 3))
        self.command('rotate 90 degrees')
        self.assertAlmostEqual(obj.rotation_euler.z, math.pi / 2, places=5)
        before = len(obj.data.vertices)
        self.command('subdivide 2')
        self.assertGreater(len(obj.data.vertices), before)
        self.assertEqual(obj.mode, 'OBJECT')
        self.command('smooth')
        self.assertTrue(all(face.use_smooth for face in obj.data.polygons))
        bpy.ops.object.mode_set(mode='EDIT')
        self.command('extrude 1')
        self.assertEqual(obj.mode, 'EDIT')
        bpy.ops.object.mode_set(mode='OBJECT')
        self.command('delete')
        self.assertEqual(len(bpy.context.scene.objects), 0)

    def test_parsing_and_validation(self):
        for text in ('please do not delete', 'rendering is slow', 'create cube later'):
            self.assertIsNone(addon.parse_command(text)[0])
        self.assertEqual(addon.parse_command('subdivide 3')[1].group(1), '3')
        for command in ({'action': 'exec'}, {'action': 'subdivide', 'cuts': 100},
                        {'action': 'scale', 'x': float('nan')}, {'action': 'create', 'location': [1]}):
            with self.assertRaises(ValueError):
                addon.execute_llm_command(command)
        with self.assertRaises(ValueError):
            addon.process_llm_response('!CMD!{"action":"create"}\n!CMD!{"action":"exec"}')
        if not HAS_BLENDER:
            return
        self.assertEqual(len(bpy.context.scene.objects), 0)
        clean, executed = addon.process_llm_response('Creating\n!CMD!  {"action":"create","type":"sphere"}')
        self.assertEqual(clean, 'Creating')
        self.assertEqual(len(executed), 1)
        self.assertEqual(bpy.context.active_object.type, 'MESH')

    def test_http_cleanup_and_redaction(self):
        class Response:
            status = 401
            def read(self, limit): return b'{"error":"SECRET-TEST"}'
        class Connection:
            closed = False
            def request(self, *args): pass
            def getresponse(self): return Response()
            def close(self): self.closed = True
        conn = Connection()
        with self.assertRaisesRegex(ValueError, '401') as err:
            addon.LLMConfig._request(conn, '/', '{}', {})
        self.assertNotIn('SECRET-TEST', str(err.exception))
        self.assertTrue(conn.closed)
        stream = io.StringIO()
        with patch.object(addon.LLMConfig, '_call_openai_compatible', return_value='ok'), contextlib.redirect_stdout(stream):
            self.assertEqual(addon.LLMConfig.call_deepseek('SECRET-TEST', []), 'ok')
        self.assertNotIn('SECRET', stream.getvalue())
        with patch.object(addon.http.client, 'HTTPSConnection', return_value=conn) as constructor:
            with self.assertRaises(ValueError): addon.LLMConfig.call_openai('test', [])
            self.assertEqual(constructor.call_args.kwargs['timeout'], 30)

    @unittest.skipUnless(HAS_BLENDER, "Blender runtime is not installed")
    def test_registration_and_command_mode(self):
        addon.register()
        try:
            settings = bpy.context.scene.agent_settings
            self.assertTrue(settings.setup_complete)
            self.assertTrue(settings.bl_rna.properties['api_key'].is_skip_save)
            settings.input_text = 'create plane'
            self.assertEqual(bpy.ops.agent.send_message(), {'FINISHED'})
            self.assertEqual(len(settings.chat_history), 2)
            self.assertFalse(settings.is_processing)
            self.assertEqual(bpy.context.active_object.type, 'MESH')
        finally:
            addon.unregister()
        self.assertFalse(hasattr(bpy.types.Scene, 'agent_settings'))

    @unittest.skipIf(HAS_BLENDER, "Stub boundary test runs outside Blender")
    def test_background_snapshot_and_main_thread_delivery(self):
        from types import SimpleNamespace
        import threading
        import time
        class History(list):
            def add(self):
                message = SimpleNamespace(role="", content="")
                self.append(message)
                return message
        settings = SimpleNamespace(input_text="Tell me about modeling", is_processing=False,
            chat_history=History(), api_provider="openai", api_key="test", model="custom")
        scene = SimpleNamespace(agent_settings=settings)
        context = SimpleNamespace(scene=scene)
        callbacks = []
        main_thread = threading.get_ident()
        worker_calls = []
        executed_threads = []
        def network(snapshot, text, scene_context):
            worker_calls.append((threading.get_ident(), snapshot, text))
            return 'Advice\n!CMD!{"action":"create","type":"cube"}'
        def execute(command):
            executed_threads.append(threading.get_ident())
            return 'Created cube'
        with patch.object(bpy, 'context', context, create=True), \
             patch.object(bpy, 'app', SimpleNamespace(timers=SimpleNamespace(register=callbacks.append)), create=True), \
             patch.object(addon, 'get_scene_context', return_value='scene'), \
             patch.object(addon, 'chat_with_llm', side_effect=network), \
             patch.object(addon, 'execute_llm_command', side_effect=execute):
            operator = addon.AGENT_OT_send_message()
            self.assertEqual(operator.execute(context), {'FINISHED'})
            self.assertTrue(settings.is_processing)
            self.assertEqual(operator.execute(context), {'CANCELLED'})
            self.assertEqual(len(callbacks), 1)
            for _ in range(100):
                if callbacks[0]() is None:
                    break
                time.sleep(0.01)
            else:
                self.fail('Worker did not deliver a result')
        self.assertFalse(settings.is_processing)
        self.assertNotEqual(worker_calls[0][0], main_thread)
        self.assertEqual(worker_calls[0][1].chat_history, [])
        self.assertEqual(executed_threads, [main_thread])
        self.assertEqual([message.role for message in settings.chat_history], ['user', 'assistant'])
        self.assertIn('Created cube', settings.chat_history[-1].content)

    def test_package(self):
        import zipfile
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'addon.zip'
            subprocess.run(['bash', str(root / 'scripts/build-dmg.sh'), str(output)], check=True)
            with zipfile.ZipFile(output) as archive:
                self.assertEqual(set(archive.namelist()), {'3d_agent/__init__.py', '3d_agent/LICENSE', '3d_agent/README.md'})
                self.assertIsNone(archive.testzip())


suite = unittest.defaultTestLoader.loadTestsFromTestCase(AddonTests)
result = unittest.TextTestRunner(verbosity=2).run(suite)
if not result.wasSuccessful():
    raise SystemExit(1)
