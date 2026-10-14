import asyncio
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
from core import server, sessions, providers
from fastapi.testclient import TestClient

class SessionTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.storage = patch.object(server, 'DATA', Path(self.temporary.name))
        self.storage.start()
        self.client = TestClient(server.app)
        self.pid = self.client.post('/api/projects', json={'name': 'Study'}).json()['id']

    def tearDown(self):
        self.storage.stop()
        self.temporary.cleanup()

    def frame(self):
        response = self.client.post('/api/frames', json={'project_id': self.pid})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()['id']

    def test_independent_provider_history_and_selected_model(self):
        first, second = self.frame(), self.frame()
        calls = []
        async def provider(messages, tools=None, model=None, **kwargs):
            calls.append((messages, model))
            return {'content': 'Result', 'tool_calls': None}
        with patch.object(server, 'llm_chat', side_effect=provider):
            self.assertEqual(self.client.post(f'/api/frames/{first}/message', json={'input_data': 'first topic', 'model': server._models[0]}).status_code, 200)
            self.client.post(f'/api/frames/{second}/message', json={'input_data': 'second topic'})
        self.assertEqual(calls[0][1], server._models[0])
        self.assertNotIn('first topic', str(calls[1][0]))
        self.assertEqual(self.client.get(f'/api/frames/{first}').json()['status'], 'completed')
        self.assertEqual(server.get_proj(self.pid)['messages'], [])

    def test_cli_provider_switch_and_actual_artifact_handoff(self):
        fid = self.frame()
        async def api_model(*args, **kwargs): return {'content': 'API result', 'tool_calls': None}
        with patch.object(server, 'llm_chat', side_effect=api_model):
            self.client.post(f'/api/frames/{fid}/message', json={'input_data': 'First', 'model': 'api-only-model'})
        replies = [json.dumps({'text': json.dumps({'content': '', 'tool_calls': [{'name': 'write_artifact', 'arguments': {'filename': 'answer.txt', 'content': 'Exact CLI artifact'}}]})}),
                   json.dumps({'text': '{"content":"Saved answer.txt","tool_calls":[]}'})]
        cli = AsyncMock(side_effect=replies)
        with patch.object(providers.shutil, 'which', return_value='/fixture/grok'), patch.object(providers, 'cli_process', cli):
            response = self.client.post(f'/api/frames/{fid}/message', json={'input_data': 'Save an artifact', 'provider_id': 'grok-cli'})
        self.assertEqual(response.status_code, 200, response.text)
        command = cli.call_args_list[0].args[0]
        self.assertNotIn('api-only-model', command)
        frame = sessions.find(fid)
        self.assertEqual(frame['provider_id'], 'grok-cli')
        self.assertEqual(frame['messages'][-1]['content'], 'Saved answer.txt')
        self.assertIn('API result', cli.call_args_list[0].args[1])
        self.assertIn('tool_call_id', cli.call_args_list[1].args[1])
        artifacts = server.get_proj(self.pid)['artifacts']
        self.assertTrue(artifacts)
        result = asyncio.run(server.run_tool('read_artifact', {'artifact_id': artifacts[0]['id']}, self.pid))
        self.assertEqual(result['content'], 'Exact CLI artifact')

    def test_model_cell_uses_session_kernel_and_exports_exact_notebook(self):
        fid = self.frame()
        provider = AsyncMock(side_effect=[
            {'content': '', 'model': 'resolved-provider-model', 'tool_calls': [{'id': 'code', 'name': 'run_r', 'arguments': {'code': 'x <- 42; print(x)'}}]},
            {'content': 'Result from execution', 'model': 'resolved-provider-model', 'tool_calls': None}])
        kernel = AsyncMock(return_value={'success': True, 'stdout': '[1] 42', 'docker_image_id': 'sha256:fixture'})
        with patch.object(server, 'llm_chat', provider), patch('core.kernels.execute', kernel):
            response = self.client.post(f'/api/frames/{fid}/message', json={'input_data': 'Analyse'})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(kernel.call_args.args, (fid, self.pid, 'x <- 42; print(x)'))
        self.assertEqual(kernel.call_args.kwargs['language'], 'r')
        frame = sessions.find(fid)
        self.assertEqual(frame['provider_model'], 'resolved-provider-model')
        self.assertEqual(frame['executions'][0]['status'], 'completed')
        notebook = self.client.get(f'/api/frames/{fid}/notebook?language=r').json()
        self.assertEqual(notebook['cells'][0]['source'], 'x <- 42; print(x)')
        self.assertEqual(notebook['cells'][0]['outputs'][0]['text'], '[1] 42')
        self.assertEqual(notebook['cells'][0]['metadata']['openscience']['result']['docker_image_id'], 'sha256:fixture')
        self.assertEqual(self.client.get(f'/api/frames/{fid}/notebook').json()['cells'], [])

    def test_agent_document_versions_require_current_parent(self):
        async def run():
            created = await server.run_tool('write_artifact', {'filename': 'analysis.md', 'content': 'Supported observation'}, self.pid)
            source = await server.run_tool('read_artifact', {'artifact_id': created['artifact_id']}, self.pid)
            self.assertEqual(source['content'], 'Supported observation')
            self.assertEqual(len(source['sha256']), 64)
            revised = await server.run_tool('write_artifact', {'artifact_id': created['artifact_id'], 'parent_version_id': source['version_id'], 'content': 'Revised observation'}, self.pid)
            self.assertNotEqual(revised['version_id'], source['version_id'])
            with self.assertRaises(server.HTTPException) as error:
                await server.run_tool('write_artifact', {'artifact_id': created['artifact_id'], 'parent_version_id': source['version_id'], 'content': 'Stale overwrite'}, self.pid)
            self.assertEqual(error.exception.status_code, 409)
            original = await server.run_tool('read_artifact', {'artifact_id': created['artifact_id'], 'version_id': source['version_id']}, self.pid)
            self.assertEqual(original['content'], 'Supported observation')
        asyncio.run(run())

    def test_first_session_preserves_legacy_history(self):
        project = server.get_proj(self.pid)
        project['messages'] = [{'role': 'user', 'content': 'Existing research'}, {'role': 'assistant', 'content': 'Existing answer'}]
        server.save_proj(self.pid, project)
        first, second = self.frame(), self.frame()
        self.assertEqual(sessions.find(first)['messages'], project['messages'])
        self.assertEqual(sessions.find(second)['messages'], [])

    def test_plan_does_not_execute_until_approval(self):
        fid = self.frame()
        provider = AsyncMock(side_effect=[{'content': 'Analyse measurements', 'tool_calls': None}, {'content': 'Done', 'tool_calls': None}])
        with patch.object(server, 'llm_chat', provider), patch.object(server, 'run_tool', AsyncMock()) as tool:
            response = self.client.post(f'/api/frames/{fid}/message', json={'input_data': 'Plan study', 'plan_mode': True})
            self.assertEqual(response.json()['status'], 'awaiting_approval')
            self.assertEqual(provider.call_args.args[1:] , ())
            tool.assert_not_called()
            self.assertEqual(self.client.post(f'/api/frames/{fid}/message', json={'input_data': 'Other'}).status_code, 409)
            response = self.client.post(f'/api/frames/{fid}/approve-plan', json={'edited_plan': 'Analyse revised measurements'})
            self.assertEqual(response.json()['status'], 'completed')
            self.assertIn('Analyse revised measurements', str(provider.call_args.args[0]))

    def test_branch_completes_tool_group_and_preserves_source(self):
        fid = self.frame()
        frame = sessions.find(fid)
        frame['messages'] = [{'role': 'user', 'content': 'Research'}, {'role': 'assistant', 'content': None, 'tool_calls': [{'id': 'one'}, {'id': 'two'}]}, {'role': 'tool', 'tool_call_id': 'one', 'content': '{}'}, {'role': 'tool', 'tool_call_id': 'two', 'content': '{}'}, {'role': 'assistant', 'content': 'Answer'}]
        sessions.write(frame)
        branch = self.client.post(f'/api/frames/{fid}/fork', json={'message_index': 1}).json()
        self.assertEqual(len(branch['messages']), 4)
        self.assertEqual(len(sessions.find(fid)['messages']), 5)
        self.assertEqual(self.client.post(f'/api/frames/{fid}/fork', json={'message_index': 1, 'edited_content': 'Invalid'}).status_code, 400)

    def test_failed_execution_is_retained(self):
        fid = self.frame()
        with patch('core.kernels.execute', AsyncMock(return_value={'success': False, 'error': 'Docker unavailable'})):
            result = self.client.post(f'/api/frames/{fid}/execute', json={'code': 'print(2)'}).json()
        self.assertEqual(result['status'], 'failed')
        self.assertEqual(self.client.get(f'/api/frames/{fid}/executions').json()['executions'][0]['result']['error'], 'Docker unavailable')
        r = self.client.post(f'/api/frames/{fid}/execute', json={'language': 'unsupported', 'code': '1+1'}).json()
        self.assertEqual(r['status'], 'failed')
        self.assertIn('unavailable', r['result']['error'])

    def test_provider_error_marks_session_failed(self):
        fid = self.frame()
        with patch.object(server, 'llm_chat', AsyncMock(side_effect=server.HTTPException(503, 'No provider credential'))):
            self.assertEqual(self.client.post(f'/api/frames/{fid}/message', json={'input_data': 'Study'}).status_code, 503)
        self.assertEqual(sessions.find(fid)['status'], 'failed')

    def test_cancellation_owns_task_and_removes_partial_tool_calls(self):
        fid = self.frame()
        async def run():
            started = asyncio.Event()
            async def provider(*args, **kwargs):
                started.set()
                await asyncio.Event().wait()
            with patch.object(server, 'llm_chat', side_effect=provider):
                pending = asyncio.create_task(sessions.message(fid, sessions.Message(input_data='Study')))
                await started.wait()
                self.assertEqual((await sessions.cancel(fid))['status'], 'cancelled')
                self.assertEqual((await pending)['status'], 'cancelled')
                self.assertEqual(sessions.find(fid)['status'], 'cancelled')
        asyncio.run(run())
        self.assertEqual(sessions.complete_history([{'role': 'assistant', 'tool_calls': [{'id': 'a'}]}, {'role': 'user', 'content': 'Continue'}]), [{'role': 'user', 'content': 'Continue'}])

if __name__ == '__main__':
    unittest.main()
