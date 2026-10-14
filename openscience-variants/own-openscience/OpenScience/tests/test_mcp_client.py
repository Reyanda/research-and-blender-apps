import asyncio
import json
import os
from pathlib import Path
import sys
import tempfile
import socket
import subprocess
import time
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
from core import server, profiles
from connectors import client
from fastapi.testclient import TestClient

FIXTURE = '''from mcp.server import MCPServer
app = MCPServer('Owned math fixture')
@app.tool()
def add(a: int, b: int) -> int:
    return a + b
if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        app.run(transport='streamable-http', port=int(sys.argv[1]))
    else:
        app.run()
'''

class MCPClientTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.storage = patch.object(server, 'DATA', Path(self.temp.name) / 'data')
        self.storage.start()
        self.web = TestClient(server.app)
        self.pid = self.web.post('/api/projects', json={'name': 'Fixture'}).json()['id']
        self.fixture = Path(self.temp.name) / 'math_server.py'
        self.fixture.write_text(FIXTURE)
        value = {'id': 'a' * 16, 'name': 'Owned math fixture', 'transport': 'stdio', 'command': sys.executable, 'args': [str(self.fixture)], 'headers': {'Authorization': 'secret'}, 'env': {'PRIVATE_TOKEN': 'secret'}, 'enabled': True, 'allowed_tools': ['add']}
        client.save({value['id']: value})
        self.config = value
    def tearDown(self):
        self.storage.stop(); self.temp.cleanup()
    def test_real_sdk_stdio_catalog_schema_and_call(self):
        async def check():
            tools = await client.listed(self.config)
            self.assertEqual(tools[0]['name'], 'add')
            self.assertEqual(tools[0]['inputSchema']['properties']['a']['type'], 'integer')
            result = await client.invoke(self.config, 'add', {'a': 2, 'b': 3}, self.pid)
            self.assertIn('5', json.dumps(result['result']))
            self.assertTrue(result['artifact_id'])
            descriptors = await client.model_tools()
            self.assertEqual(descriptors[0]['input_schema']['properties']['b']['type'], 'integer')
            self.assertLessEqual(len(descriptors[0]['name']), 64)
        asyncio.run(check())
    def test_real_sdk_owned_http_transport(self):
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        process = subprocess.Popen([sys.executable, str(self.fixture), str(port)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            deadline = time.monotonic() + 30
            while time.monotonic() < deadline:
                try:
                    with socket.create_connection(('127.0.0.1', port), timeout=.2):
                        break
                except OSError:
                    if process.poll() is not None:
                        self.fail('Owned HTTP MCP server failed to start')
                    time.sleep(.1)
            else:
                self.fail('Owned HTTP MCP server startup timed out')
            async def check():
                config = {**self.config, 'transport': 'http', 'url': f'http://127.0.0.1:{port}/mcp'}
                self.assertEqual((await client.listed(config))[0]['name'], 'add')
                result = await client.invoke(config, 'add', {'a': 4, 'b': 6}, self.pid)
                self.assertIn('10', json.dumps(result['result']))
            asyncio.run(check())
        finally:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill(); process.wait()

    def test_grants_agent_exclusions_and_secret_masking(self):
        self.assertNotIn('secret', json.dumps(client.public(self.config)))
        self.assertEqual((server.DATA / 'config/mcp.json').stat().st_mode & 0o777, 0o600)
        async def check():
            with self.assertRaises(server.HTTPException) as denied:
                await client.invoke({**self.config, 'allowed_tools': []}, 'add', {}, self.pid)
            self.assertEqual(denied.exception.status_code, 403)
            profiles.save({'agents': {'x': {'id': 'x', 'name': 'Restricted', 'system_prompt': '', 'skill_names': [], 'connector_ids': ['other'], 'excluded_tools': []}}, 'skills': {}})
            self.assertEqual(await client.model_tools('x'), [])
            with self.assertRaises(server.HTTPException):
                await client.run(client.tool_name(self.config['id'], 'add'), {}, self.pid, 'x')
        asyncio.run(check())
    def test_transport_validation(self):
        for changes in [{'command': 'python'}, {'transport': 'http', 'url': 'https://user:secret@example.com/mcp'}, {'transport': 'ftp', 'url': 'ftp://example.com'}]:
            with self.assertRaises(server.HTTPException):
                client.validate({**self.config, **changes})
        client.validate(self.config)

if __name__ == '__main__':
    unittest.main()
