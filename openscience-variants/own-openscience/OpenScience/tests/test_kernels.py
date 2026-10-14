import asyncio
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
from core import server, sessions, workspace, kernels
from fastapi import HTTPException


def docker_available():
    if not shutil.which('docker'):
        return False
    try:
        return subprocess.run(kernels.docker_args('image', 'inspect', 'openscience-python'),
                              capture_output=True, timeout=15).returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


class KernelPolicyTests(unittest.TestCase):
    def test_explicit_permission_and_context_args(self):
        with patch.dict(os.environ, {'OPENSCIENCE_ENABLE_PYTHON': '0'}):
            with self.assertRaises(HTTPException) as error:
                kernels.enabled()
            self.assertEqual(error.exception.status_code, 403)
        with patch.dict(os.environ, {'OPENSCIENCE_DOCKER_CONTEXT': 'colima'}):
            self.assertEqual(kernels.docker_args('rm', '-f', 'owned'), ['docker', '--context', 'colima', 'rm', '-f', 'owned'])


@unittest.skipUnless(docker_available(), 'Docker runtime or openscience-python image unavailable')
class RealKernelTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.storage = patch.object(server, 'DATA', Path(self.temp.name)); self.storage.start()
        self.permission = patch.dict(os.environ, {'OPENSCIENCE_ENABLE_PYTHON': '1'}); self.permission.start()
        self.pid, self.fid = 'e' * 16, 'f' * 16
        server.atomic_json(server.DATA / 'projects' / self.pid / 'project.json', {'id': self.pid, 'name': 'Cells', 'messages': []})
        sessions.write({'id': self.fid, 'project_id': self.pid, 'status': 'idle', 'messages': []})

    async def asyncTearDown(self):
        await kernels.shutdown_all()
        self.permission.stop(); self.storage.stop(); self.temp.cleanup()

    async def test_model_tool_loop_analyzes_uploaded_data_in_persistent_kernel(self):
        from unittest.mock import AsyncMock
        await workspace.save_artifact(self.pid, 'measurements.csv', b'value\n2\n4\n6\n', 'text/csv')
        frame = sessions.find(self.fid)
        frame['executions'] = []
        token = sessions.ACTIVE_FRAME.set(frame)
        provider = AsyncMock(side_effect=[
            {'content': '', 'tool_calls': [{'id': 'first', 'name': 'run_python', 'arguments': {'code': "import pandas as pd\nmean = pd.read_csv('/inputs/measurements.csv')['value'].mean()\nprint(mean)"}}]},
            {'content': '', 'tool_calls': [{'id': 'second', 'name': 'run_python', 'arguments': {'code': 'print(mean + 2)'}}]},
            {'content': 'Execution complete', 'tool_calls': None}])
        try:
            with patch.object(server, 'llm_chat', provider):
                result = await server.converse(self.pid, 'Analyze the uploaded measurements')
            self.assertEqual(result['tool_results'][0]['result']['stdout'].strip(), '4.0')
            self.assertEqual(result['tool_results'][1]['result']['stdout'].strip(), '6.0')
            self.assertEqual(len(frame['executions']), 2)
            self.assertTrue(all(e['status'] == 'completed' for e in frame['executions']))
            self.assertEqual(frame['executions'][0]['result']['kernel_id'], frame['executions'][1]['result']['kernel_id'])
        finally:
            sessions.ACTIVE_FRAME.reset(token)

    async def test_persistence_uploaded_csv_and_real_output(self):
        await workspace.save_artifact(self.pid, 'measurements.csv', b'value\n2\n4\n6\n', 'text/csv')
        first = await kernels.execute(self.fid, self.pid, 'x = 40\nprint("first")')
        self.assertTrue(first['success'], first)
        code = "import pandas as pd\nprint(x + 2)\nprint(pd.read_csv('/inputs/measurements.csv')['value'].mean())\nfrom pathlib import Path\nPath('/outputs/result.txt').write_bytes(b'actual bytes\\x00')"
        second = await kernels.execute(self.fid, self.pid, code, execution_id='a' * 16)
        self.assertTrue(second['success'], second)
        self.assertEqual(second['kernel_id'], first['kernel_id'])
        self.assertIn('42', second['stdout']); self.assertIn('4.0', second['stdout'])
        self.assertEqual(len(second['artifacts']), 1)
        a = second['artifacts'][0]
        self.assertEqual(workspace.artifact_path(self.pid, a['id'], a['current_version_id']).read_bytes(), b'actual bytes\x00')
        self.assertEqual(a['versions'][0]['metadata']['frame_id'], self.fid)
        provenance = a['versions'][0]['metadata']
        self.assertEqual(provenance['code'], code)
        self.assertEqual(provenance['execution_id'], 'a' * 16)
        image = subprocess.run(kernels.docker_args('inspect', kernels._kernels[self.fid].container, '--format', '{{.Image}}'), capture_output=True, check=True).stdout.decode().strip()
        self.assertEqual(provenance['docker_image_id'], image)
        self.assertEqual(provenance['language'], 'python')
        third = await kernels.execute(self.fid, self.pid, 'print(x)')
        self.assertEqual(third['artifacts'], [])
        kernel = kernels._kernels[self.fid]
        inspect = subprocess.run(kernels.docker_args('inspect', kernel.container), capture_output=True, check=True)
        spec = json.loads(inspect.stdout)[0]['HostConfig']
        self.assertEqual(spec['NetworkMode'], 'none'); self.assertTrue(spec['ReadonlyRootfs'])
        self.assertEqual(spec['Memory'], 512 * 1024 * 1024)
        self.assertEqual(spec['PidsLimit'], 64)
        self.assertIn('size=32m', spec['Tmpfs']['/outputs'])
        self.assertEqual(json.loads(inspect.stdout)[0]['Config']['User'], '65534:65534')
        self.assertEqual(len(kernels._kernels), 1)

    async def test_persistent_r_upload_analysis_and_output(self):
        await workspace.save_artifact(self.pid, 'measurements.csv', b'value\n2\n4\n6\n', 'text/csv')
        first = await kernels.execute(self.fid, self.pid, 'x <- 40; print("first")', language='r')
        self.assertTrue(first['success'], first)
        second = await kernels.execute(self.fid, self.pid, 'print(x + 2); print(mean(read.csv("/inputs/measurements.csv")$value)); writeBin(charToRaw("R bytes"), "/outputs/r-result.bin")', language='r')
        self.assertTrue(second['success'], second)
        self.assertEqual(first['kernel_id'], second['kernel_id'])
        self.assertIn('42', second['stdout']); self.assertIn('4', second['stdout'])
        artifact = next(a for a in second['artifacts'] if a['filename'] == 'r-result.bin')
        self.assertEqual(workspace.artifact_path(self.pid, artifact['id'], artifact['current_version_id']).read_bytes(), b'R bytes')
        self.assertEqual(artifact['versions'][0]['metadata']['language'], 'r')
        python = await kernels.execute(self.fid, self.pid, 'print("python separate")')
        self.assertNotEqual(first['kernel_id'], python['kernel_id'])
        await kernels.interrupt(self.fid)
        self.assertFalse(any(k.frame_id == self.fid for k in kernels._kernels.values()))
        with self.assertRaises(HTTPException) as error:
            await kernels.execute(self.fid, self.pid, 'anything', language='unknown')
        self.assertEqual(error.exception.status_code, 400)

    async def test_timeout_output_bound_and_project_isolation(self):
        result = await kernels.execute(self.fid, self.pid, "print('x' * 100000)")
        self.assertLessEqual(len(result['stdout']), kernels.MAX_OUTPUT)
        other = 'd' * 16
        server.atomic_json(server.DATA / 'projects' / other / 'project.json', {'id': other, 'name': 'Other'})
        with self.assertRaises(HTTPException) as error:
            await kernels.execute(self.fid, other, 'print("cross project")')
        self.assertEqual(error.exception.status_code, 404)
        kernel = kernels._kernels[self.fid]
        with patch.object(kernels, 'TIMEOUT', 0.2):
            with self.assertRaises(HTTPException) as error:
                await kernels.execute(self.fid, self.pid, 'import time; time.sleep(10)')
        self.assertEqual(error.exception.status_code, 408)
        self.assertTrue(kernel.dead)
        self.assertFalse(kernel.root.exists())

    async def test_interrupt_cleans_own_container_and_resets_namespace(self):
        await kernels.execute(self.fid, self.pid, 'x = 40')
        kernel = kernels._kernels[self.fid]; root = kernel.root; name = kernel.container
        running = asyncio.create_task(kernels.execute(self.fid, self.pid, 'import time\ntime.sleep(50)'))
        await asyncio.sleep(0.2)
        result = await kernels.interrupt(self.fid)
        self.assertTrue(result['interrupted'])
        with self.assertRaises(HTTPException):
            await running
        self.assertFalse(root.exists())
        self.assertNotEqual(subprocess.run(kernels.docker_args('inspect', name), capture_output=True).returncode, 0)
        fresh = await kernels.execute(self.fid, self.pid, 'print(x)')
        self.assertFalse(fresh['success']); self.assertIn('NameError', fresh['stderr'])
        self.assertNotEqual(fresh['kernel_id'], kernel.id)


if __name__ == '__main__':
    unittest.main()
