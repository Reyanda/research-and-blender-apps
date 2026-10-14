import asyncio
import json
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch, MagicMock
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
from core import server, compute
from fastapi.testclient import TestClient
import paramiko

class SSHFixture(paramiko.ServerInterface):
    def __init__(self, key):
        self.key = key
        self.command = None
        self.ready = threading.Event()
    def check_auth_publickey(self, username, key):
        return paramiko.AUTH_SUCCESSFUL if username == 'research' and key == self.key else paramiko.AUTH_FAILED
    def get_allowed_auths(self, username):
        return 'publickey'
    def check_channel_request(self, kind, chanid):
        return paramiko.OPEN_SUCCEEDED if kind == 'session' else paramiko.OPEN_FAILED_ADMINISTRATIVELY_PROHIBITED
    def check_channel_exec_request(self, channel, command):
        self.command = command
        self.ready.set()
        return True

class ComputeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.storage = patch.object(server, 'DATA', Path(self.temp.name) / 'data'); self.storage.start()
        self.web = TestClient(server.app)
        self.pid = self.web.post('/api/projects', json={'name': 'Compute'}).json()['id']
        self.server_key = paramiko.RSAKey.generate(2048)
        self.client_key = paramiko.RSAKey.generate(2048)
        self.key_file = Path(self.temp.name) / 'client_key'
        self.client_key.write_private_key_file(str(self.key_file)); self.key_file.chmod(0o600)
        self.listener = socket.socket(); self.listener.bind(('127.0.0.1', 0)); self.listener.listen(); self.listener.settimeout(.2)
        self.port = self.listener.getsockname()[1]
        self.known = Path(self.temp.name) / 'known_hosts'
        self.known.write_text(f'[127.0.0.1]:{self.port} {self.server_key.get_name()} {self.server_key.get_base64()}\n')
        self.stop = threading.Event(); self.commands = []; self.transports = []
        self.thread = threading.Thread(target=self.serve, daemon=True); self.thread.start()
        self.config = {'id': 'a' * 16, 'name': 'Owned SSH fixture', 'hostname': '127.0.0.1', 'port': self.port, 'username': 'research', 'key_file': str(self.key_file), 'known_hosts_file': str(self.known)}
        compute.save({'hosts': {self.config['id']: self.config}, 'jobs': {}})
    def serve(self):
        while not self.stop.is_set():
            try:
                connection, _ = self.listener.accept()
            except socket.timeout:
                continue
            except OSError:
                return
            threading.Thread(target=self.handle, args=(connection,), daemon=True).start()
    def handle(self, connection):
        transport = paramiko.Transport(connection); self.transports.append(transport)
        try:
            transport.add_server_key(self.server_key)
            handler = SSHFixture(self.client_key)
            transport.start_server(server=handler)
            channel = transport.accept(5)
            if channel is None or not handler.ready.wait(5):
                return
            self.commands.append(handler.command)
            script = bytearray()
            while chunk := channel.recv(4096):
                script.extend(chunk)
            fixture_replies = {b'sbatch --parsable': b'123;owned-fixture\n', b'squeue --noheader --format=%T --jobs=123': b'RUNNING\n', b'scancel 123': b''}
            if handler.command in fixture_replies:
                if fixture_replies[handler.command]: channel.sendall(fixture_replies[handler.command])
                channel.send_exit_status(0)
                return
            if handler.command != b'bash -s':
                channel.send_stderr(b'Unsupported owned fixture command'); channel.send_exit_status(1); return
            result = subprocess.run(['/bin/bash', '-s'], input=bytes(script), stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=5)
            if result.stdout: channel.sendall(result.stdout)
            if result.stderr: channel.sendall_stderr(result.stderr)
            channel.send_exit_status(result.returncode)
        except (EOFError, OSError, paramiko.SSHException):
            pass
        finally:
            transport.close()
    def tearDown(self):
        self.stop.set(); self.listener.close()
        for transport in self.transports: transport.close()
        self.thread.join(timeout=2)
        self.storage.stop(); self.temp.cleanup()
    def test_approval_gate_and_real_verified_ssh_result(self):
        value = asyncio.run(compute.create_job(compute.NewJob(project_id=self.pid, host_id=self.config['id'], script='echo $((2+3))')))
        self.assertEqual(value['status'], 'awaiting_approval'); self.assertEqual(self.commands, [])
        result = asyncio.run(compute.approve(value['id']))
        self.assertEqual(result['status'], 'completed', result)
        self.assertEqual(result['stdout'].strip(), '5')
        self.assertEqual(result['exit_code'], 0)
        self.assertTrue(result['artifact_id'])
        self.assertEqual(self.commands, [b'bash -s'])
        self.assertEqual(compute.job(value['id'])['script'], 'echo $((2+3))')
        with self.assertRaises(server.HTTPException): asyncio.run(compute.approve(value['id']))
    def test_slurm_wire_submission_status_and_exact_job_cancel(self):
        value = asyncio.run(compute.create_job(compute.NewJob(project_id=self.pid, host_id=self.config['id'], script='echo 5', mode='slurm')))
        self.assertEqual(self.commands, [])
        result = asyncio.run(compute.approve(value['id']))
        self.assertEqual(result['status'], 'submitted', result)
        self.assertEqual(result['scheduler_id'], '123')
        self.assertEqual(asyncio.run(compute.status(value['id']))['scheduler_state'], 'RUNNING')
        self.assertEqual(asyncio.run(compute.cancel(value['id']))['status'], 'cancelled')
        self.assertEqual(self.commands, [b'sbatch --parsable', b'squeue --noheader --format=%T --jobs=123', b'scancel 123'])

    def test_modal_proposal_credentials_and_exact_sdk_request(self):
        import modal
        provider = asyncio.run(compute.create_modal(compute.ModalProvider(name='Owned Modal', token_id='test-id', token_secret='test-secret')))
        self.assertNotIn('token', json.dumps(provider))
        self.assertNotIn('test-secret', compute.path().read_text())
        self.assertNotIn('test-secret', json.dumps(asyncio.run(compute.providers())))
        saved = asyncio.run(compute.create_job(compute.NewJob(project_id=self.pid, host_id=provider['id'], script='print(2+3)', mode='modal')))
        sandbox = MagicMock()
        sandbox.stdout = iter(['5\n']); sandbox.stderr = iter([])
        sandbox.returncode = 0; sandbox.object_id = 'owned-sandbox'
        sdk_client = MagicMock()
        with patch.object(modal.Client, 'from_credentials', return_value=sdk_client) as credentials, patch.object(modal.App, 'lookup', return_value=MagicMock()) as app, patch.object(modal.Sandbox, 'create', return_value=sandbox) as create:
            credentials.assert_not_called(); create.assert_not_called()
            result = asyncio.run(compute.approve(saved['id']))
            self.assertEqual(result['status'], 'completed', result)
            self.assertEqual(result['stdout'], '5\n')
            credentials.assert_called_once_with('test-id', 'test-secret')
            self.assertEqual(create.call_args.args, ('python', '-c', 'print(2+3)'))
            self.assertEqual(create.call_args.kwargs['timeout'], 60)
            self.assertTrue(create.call_args.kwargs['block_network'])
            self.assertIs(create.call_args.kwargs['client'], sdk_client)
            sandbox.terminate.assert_called_once_with(wait=True)
            sdk_client.__exit__.assert_called_once_with(None, None, None)
            self.assertTrue(result['artifact_id'])
            self.assertNotIn('test-secret', json.dumps(result))

    def test_modal_failure_retains_truthful_receipt(self):
        import modal
        provider = asyncio.run(compute.create_modal(compute.ModalProvider(name='Unavailable Modal', token_id='test-id', token_secret='test-secret')))
        saved = asyncio.run(compute.create_job(compute.NewJob(project_id=self.pid, host_id=provider['id'], script='print(5)', mode='modal')))
        with patch.object(modal.Client, 'from_credentials', side_effect=RuntimeError('fixture account unavailable')):
            result = asyncio.run(compute.approve(saved['id']))
        self.assertEqual(result['status'], 'failed')
        self.assertTrue(result['artifact_id'])
        self.assertIn('account', result['error'])

    def test_unverified_host_never_executes(self):
        self.known.write_text('')
        value = asyncio.run(compute.create_job(compute.NewJob(project_id=self.pid, host_id=self.config['id'], script='echo 5')))
        result = asyncio.run(compute.approve(value['id']))
        self.assertEqual(result['status'], 'failed')
        self.assertEqual(self.commands, [])
        self.assertTrue(result['artifact_id'])
    def test_cancel_unapproved_job_never_executes(self):
        value = asyncio.run(compute.create_job(compute.NewJob(project_id=self.pid, host_id=self.config['id'], script='echo 5')))
        result = asyncio.run(compute.cancel(value['id']))
        self.assertEqual(result['status'], 'cancelled'); self.assertEqual(self.commands, [])
        with self.assertRaises(server.HTTPException): asyncio.run(compute.approve(value['id']))

if __name__ == '__main__': unittest.main()
