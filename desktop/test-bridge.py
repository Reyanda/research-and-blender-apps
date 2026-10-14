"""Offline HTTP and wire contract checks for the authored replacement."""
import asyncio
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parent))
import server
import httpx


class BridgeTests(unittest.IsolatedAsyncioTestCase):
    async def test_explicit_permission_switch(self):
        transport = httpx.ASGITransport(app=server.app, client=('127.0.0.1', 1234))
        async with httpx.AsyncClient(transport=transport, base_url='http://127.0.0.1:1337') as client:
            with patch.object(server, 'ALLOW_CODE', False):
                self.assertEqual((await client.post('/api/blender/permission', json={'enabled': True})).json(), {'code_execution_enabled': True})
                self.assertTrue(server.ALLOW_CODE)
                self.assertEqual((await client.post('/api/blender/permission', json={'enabled': False})).status_code, 200)
                self.assertFalse(server.ALLOW_CODE)
                self.assertEqual((await client.post('/api/blender/permission', json={'enabled': 'yes'})).status_code, 400)
                self.assertEqual((await client.post('/api/blender/permission', json={'enabled': True}, headers={'Origin': 'https://evil.example'})).status_code, 403)

    async def request(self, payload, origin=None, address='127.0.0.1'):
        transport = httpx.ASGITransport(app=server.app, client=(address, 1234))
        async with httpx.AsyncClient(transport=transport, base_url='http://127.0.0.1:1337') as client:
            return await client.post('/v1/blender', json=payload, headers={'Origin': origin} if origin else {})

    async def test_input_and_opt_in(self):
        for command in [{'type': 'nope'}, {'type': 'get_scene_info', 'params': []},
                        {'type': 'get_object_info', 'params': {}},
                        {'type': 'get_scene_graph', 'params': {'max_objects': True}}]:
            self.assertEqual((await self.request(command)).status_code, 400)
        with patch.object(server, 'ALLOW_CODE', False):
            self.assertEqual((await self.request({'type': 'execute_code', 'params': {'code': 'x=1'}})).status_code, 403)

    async def test_access_and_body_cap(self):
        self.assertEqual((await self.request({'type': 'get_scene_info'}, origin='https://evil.example')).status_code, 403)
        self.assertEqual((await self.request({'type': 'get_scene_info'}, address='192.0.2.1')).status_code, 403)
        self.assertEqual((await self.request({'type': 'execute_code', 'params': {'code': 'x' * server.MAX_BODY}})).status_code, 413)

    async def wire(self, reply, command=None, delay=0):
        received = []
        async def peer(reader, writer):
            received.append(json.loads(await reader.readline()))
            await asyncio.sleep(delay)
            writer.write(reply)
            await writer.drain()
            writer.close()
            await writer.wait_closed()
        listener = await asyncio.start_server(peer, '127.0.0.1', 0)
        try:
            with patch.object(server, 'BLENDER_PORT', listener.sockets[0].getsockname()[1]):
                result = await self.request(command or {'type': 'get_scene_info'})
            return result, received
        finally:
            listener.close()
            await listener.wait_closed()

    async def test_preserved_provider_envelopes(self):
        for envelope in [{'status': 'success', 'result': {'name': 'Scène'}},
                         {'status': 'error', 'error': 'runtime error', 'stdout': 'hello', 'line': 3}]:
            result, seen = await self.wire(json.dumps(envelope).encode() + b'\n')
            self.assertEqual(result.json(), envelope)
            self.assertEqual(seen, [{'type': 'get_scene_info', 'params': {}}])
        with patch.object(server, 'ALLOW_CODE', True):
            result, seen = await self.wire(b'{"status":"success","result":{}}\n', {'type': 'execute_code', 'params': {'code': 'print("hi")'}})
            self.assertEqual(result.status_code, 200)
            self.assertEqual(seen[0]['type'], 'execute_code')

    async def test_bad_frames_and_timeout(self):
        for reply in [b'{}\n', b'{"status":"success"}\n', b'{"status":"error"}\n', b'\xff\n', b'{}']:
            result, _ = await self.wire(reply)
            self.assertEqual(result.status_code, 502)
        with patch.object(server, 'MAX_FRAME', 16):
            result, _ = await self.wire(b'x' * 100 + b'\n')
            self.assertEqual(result.status_code, 502)
        with patch.object(server, 'TIMEOUT', 0.01):
            result, _ = await self.wire(b'{}\n', delay=0.1)
            self.assertEqual(result.status_code, 504)

    async def test_health_and_capabilities(self):
        transport = httpx.ASGITransport(app=server.app, client=('127.0.0.1', 1))
        async with httpx.AsyncClient(transport=transport, base_url='http://127.0.0.1:1337') as client:
            self.assertEqual((await client.get('/health')).json(), {'status': 'ok'})
            with patch.object(server, 'exchange', side_effect=ConnectionRefusedError):
                status = (await client.get('/api/blender/status')).json()
                self.assertFalse(status['running'])
                self.assertIn('code_execution_enabled', status)

    async def test_explicit_launch_only_and_child_preserved(self):
        from unittest.mock import Mock
        child = Mock()
        child.poll.return_value = None
        child.pid = 42
        transport = httpx.ASGITransport(app=server.app, client=('127.0.0.1', 1))
        async with httpx.AsyncClient(transport=transport, base_url='http://127.0.0.1:1337') as client:
            with patch.object(server, 'BLENDER_CHILD', child):
                response = await client.post('/api/blender/start')
                self.assertEqual(response.json()['result']['pid'], 42)
                await server.retire_launch_script()
                child.terminate.assert_not_called()
                child.kill.assert_not_called()
            with patch.object(server, 'BLENDER_CHILD', None), patch.object(server.asyncio, 'open_connection', side_effect=ConnectionRefusedError), patch.dict(server.os.environ, {'BLENDER_BINARY': '/missing/blender'}):
                self.assertEqual((await client.post('/api/blender/start')).status_code, 503)


if __name__ == '__main__':
    unittest.main()
