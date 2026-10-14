"""Actual HTTP -> TCP -> retained extension -> factory Blender scene test."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BLENDER = os.environ.get('BLENDER_BINARY', '/Applications/Blender.app/Contents/MacOS/Blender')
GUI = os.environ.get('BLENDER_TEST_GUI') == '1'
EXTENSION = ROOT / '3d-agent/3d-agent-community/decompiled_bundles/blender-extension/__init__.py'


class BlenderIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not Path(BLENDER).is_file():
            raise RuntimeError('Install Blender or set BLENDER_BINARY; integration is required')
        # A pre-existing fixed-port bridge belongs to the user, never the test.
        with socket.socket() as probe:
            if probe.connect_ex(('127.0.0.1', 9875)) == 0:
                raise RuntimeError('Port 9875 already occupied; close the existing bridge before integration')
        cls.temp = tempfile.TemporaryDirectory(prefix='blender-bridge-test-')
        cls.addClassCleanup(cls.temp.cleanup)
        boot = Path(cls.temp.name) / 'boot.py'
        boot.write_text(f'''import bpy, importlib.util, sys, time
spec = importlib.util.spec_from_file_location('integration_extension', {str(EXTENSION)!r})
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
# Retain the timer API while making main-thread pumping explicit in background mode.
pending = []
original_register = bpy.app.timers.register
original_unregister = bpy.app.timers.unregister
original_is_registered = bpy.app.timers.is_registered
def register(callback, first_interval=0, **kwargs):
    pending.append([time.monotonic() + first_interval, callback])
def unregister(callback):
    pending[:] = [item for item in pending if item[1] is not callback]
bpy.app.timers.register = register
bpy.app.timers.unregister = unregister
bpy.app.timers.is_registered = lambda callback: any(item[1] is callback for item in pending)
module.register()
deadline = time.monotonic() + 120
while time.monotonic() < deadline:
    for item in list(pending):
        if item[0] <= time.monotonic():
            pending.remove(item)
            delay = item[1]()
            if delay is not None:
                pending.append([time.monotonic() + delay, item[1]])
    time.sleep(0.005)
module.unregister()
''')
        if GUI:
            boot.write_text(f'''import bpy, importlib.util, sys
spec = importlib.util.spec_from_file_location('integration_extension', {str(EXTENSION)!r})
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
module.register()
''')
        cls.log = open(Path(cls.temp.name) / 'blender.log', 'w+')
        cls.addClassCleanup(cls.log.close)
        cls.blender = subprocess.Popen([BLENDER, *([] if GUI else ['--background']), '--factory-startup', '--python', str(boot)], stdout=cls.log, stderr=subprocess.STDOUT)
        cls.addClassCleanup(cls.kill, cls.blender)
        with socket.socket() as allocator:
            allocator.bind(('127.0.0.1', 0))
            cls.port = allocator.getsockname()[1]
        env = dict(os.environ, OPENSCIENCE_ALLOW_EXECUTION='1', OPENSCIENCE_PORT=str(cls.port))
        cls.daemon = subprocess.Popen([sys.executable, str(ROOT / 'desktop/server.py'), 'serve'], env=env, stdout=cls.log, stderr=subprocess.STDOUT)
        cls.addClassCleanup(cls.kill, cls.daemon)
        cls.url = f'http://127.0.0.1:{cls.port}'
        deadline = time.monotonic() + 45
        while time.monotonic() < deadline:
            if cls.blender.poll() is not None or cls.daemon.poll() is not None:
                cls.log.flush(); cls.log.seek(0)
                raise RuntimeError(cls.log.read())
            try:
                with urllib.request.urlopen(cls.url + '/api/blender/status', timeout=1) as response:
                    if json.load(response)['running']:
                        return
            except (OSError, ValueError):
                pass
            time.sleep(0.2)
        cls.log.flush(); cls.log.seek(0)
        raise RuntimeError('Bridge startup timed out: ' + cls.log.read())

    @staticmethod
    def kill(process):
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill(); process.wait()

    def command(self, kind, **params):
        request = urllib.request.Request(self.url + '/v1/blender', data=json.dumps({'type': kind, 'params': params}).encode(), headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.load(response)

    def test_real_scene_creation_queries_and_errors(self):
        self.assertEqual(self.command('get_blender_info')['status'], 'success')
        self.assertEqual(self.command('get_scene_info')['result']['object_count'], 3)
        created = self.command('execute_code', code="bpy.ops.mesh.primitive_cube_add(size=2, location=(1,2,3))\nbpy.context.object.name='BridgeTestCube'\nprint('created')")
        self.assertEqual(created['status'], 'success', created)
        self.assertIn('created', created['result']['stdout'])
        scene = self.command('get_scene_info')['result']
        self.assertEqual(scene['object_count'], 4)
        info = self.command('get_object_info', name='BridgeTestCube')
        self.assertEqual(info['status'], 'success', info)
        self.assertEqual(info['result']['name'], 'BridgeTestCube')
        mesh = self.command('get_mesh_stats', name='BridgeTestCube')['result']
        self.assertEqual(mesh['vertices'], 8)
        self.assertEqual(mesh['faces'], 6)
        self.assertEqual(self.command('get_scene_graph')['status'], 'success')
        missing = self.command('get_object_info', name='MissingObject')
        self.assertEqual(missing['status'], 'error')
        screenshot = self.command('get_viewport_screenshot', filepath=str(Path(self.temp.name) / 'viewport.png'))
        if GUI:
            self.assertEqual(screenshot['status'], 'success', screenshot)
            self.assertEqual((Path(self.temp.name) / 'viewport.png').read_bytes()[:8], b'\x89PNG\r\n\x1a\n')
            return
        self.assertEqual(screenshot['status'], 'error', screenshot)
        self.assertTrue(any(term in screenshot['error'].lower() for term in ('viewport', 'screen', 'areas', 'screenshot')), screenshot)
        self.assertFalse((Path(self.temp.name) / 'viewport.png').exists())


if __name__ == '__main__':
    unittest.main()
