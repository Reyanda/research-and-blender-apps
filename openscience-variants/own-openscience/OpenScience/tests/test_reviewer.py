import asyncio
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, AsyncMock
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
from core import server, sessions, workspace, reviewer
from fastapi import FastAPI
from fastapi.testclient import TestClient

class ReviewerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.storage = patch.object(server, 'DATA', Path(self.tmp.name)); self.storage.start()
        self.client = TestClient(server.app)
        self.pid = self.client.post('/api/projects', json={'name': 'Study'}).json()['id']
        self.fid = self.client.post('/api/frames', json={'project_id': self.pid}).json()['id']
        app = FastAPI(); app.include_router(reviewer.router)
        self.review_client = TestClient(app)

    def tearDown(self):
        self.storage.stop(); self.tmp.cleanup()

    def artifact(self, metadata=None):
        return asyncio.run(workspace.save_artifact(self.pid, 'result.txt', b'mean = 7', 'text/plain', metadata or {'origin': 'upload'}))

    def audit(self, model=False):
        response = self.review_client.post(f'/api/frames/{self.fid}/audit', json={'use_model': model})
        self.assertEqual(response.status_code, 202, response.text)
        return response.json()

    def test_changed_and_missing_actual_bytes(self):
        a = self.artifact(); path = workspace.artifact_path(self.pid, a['id'], a['current_version_id'])
        path.write_bytes(b'mean = 999')
        report = self.audit()
        self.assertIn('artifact-integrity', [f['criterion'] for f in report['findings']])
        self.assertEqual(report['scientific_correctness'], 'not_established')
        path.unlink()
        report = self.audit()
        self.assertIn('artifact-bytes', [f['criterion'] for f in report['findings']])
        self.assertEqual(self.review_client.get(f'/api/frames/{self.fid}/verification').json()['report_artifact_id'], report['report_artifact_id'])

    def test_generation_and_failed_execution(self):
        self.artifact({'origin': 'python-kernel', 'frame_id': self.fid, 'code': 'print(7)', 'execution_id': 'absent'})
        f = sessions.find(self.fid)
        f['executions'] = [{'id': 'failed', 'code': '1/0', 'status': 'failed', 'result': {'success': False, 'error': 'ZeroDivisionError'}}]
        sessions.write(f)
        report = self.audit()
        criteria = {v['criterion'] for v in report['findings']}
        self.assertTrue({'execution-success', 'generation-reproducibility', 'generation-execution'} <= criteria)

    def test_model_gets_actual_code_output_and_is_separate(self):
        a = self.artifact({'origin': 'python-kernel', 'frame_id': self.fid, 'code': 'mean = 7', 'execution_id': 'cell', 'docker_image_id': 'sha256:image'})
        f = sessions.find(self.fid)
        f['executions'] = [{'id': 'cell', 'code': 'mean = 7', 'status': 'completed', 'result': {'success': True, 'stdout': '7'}}]
        sessions.write(f)
        provider = AsyncMock(return_value={'content': 'The conclusion needs evidence.', 'model': 'provider-model-version'})
        with patch.object(server, 'llm_chat', provider):
            report = self.audit(True)
        prompt = provider.call_args.args[0][1]['content']
        self.assertIn('mean = 7', prompt); self.assertIn('stdout', prompt); self.assertIn(a['id'], prompt)
        self.assertEqual(report['model_review']['commentary'], 'The conclusion needs evidence.')
        self.assertEqual(report['scientific_correctness'], 'not_established')
        self.assertEqual(report['model_review']['model'], 'provider-model-version')
        self.assertEqual(report['model_review']['requested_model'], provider.call_args.kwargs['model'])

    def test_invalid_citation_and_no_false_correctness(self):
        f = sessions.find(self.fid)
        f['messages'] = [{'role': 'assistant', 'content': 'See https://doi.org/not-a-doi'}]
        sessions.write(f)
        self.assertIn('citation-identifier', [v['criterion'] for v in self.audit()['findings']])
        f['messages'] = []; sessions.write(f)
        report = self.audit()
        self.assertEqual(report['status'], 'no_structural_findings')
        self.assertEqual(report['scientific_correctness'], 'not_established')

    def test_background_review_requires_project_opt_in(self):
        async def check():
            reviewer.schedule(self.fid)
            self.assertNotIn(self.fid, reviewer._tasks)
            p = workspace.project(self.pid); p['reviewer_enabled'] = True; workspace.persist(self.pid, p)
            reviewer.schedule(self.fid)
            await reviewer._tasks[self.fid]
        asyncio.run(check())
        self.assertIn('verification', sessions.find(self.fid))

    def test_successful_search_is_not_a_failed_code_cell(self):
        f = sessions.find(self.fid)
        f['executions'] = [{'id': 'search', 'tool': 'search_mcp', 'status': 'completed', 'result': {'results': [{'pmid': '123'}]}}]
        sessions.write(f)
        self.assertEqual(self.audit()['findings'], [])

    def test_reproduction_skips_search_and_replays_both_languages(self):
        f = sessions.find(self.fid)
        f['executions'] = [
            {'id': 'search', 'tool': 'search_mcp', 'status': 'completed', 'result': {'results': []}},
            {'id': 'python', 'language': 'python', 'code': 'print(2)', 'result': {'success': True, 'stdout': '2', 'stderr': ''}},
            {'id': 'r', 'language': 'r', 'code': 'cat(2)', 'result': {'success': True, 'stdout': '2', 'stderr': ''}}]
        sessions.write(f)
        calls=[]
        async def execute(frame, code, language):
            calls.append(language);frame['executions'].append({'id': language, 'code': code, 'language': language})
            return {'success': True, 'stdout': '2', 'stderr': ''}
        with patch.object(sessions, 'execute_tool_cell', execute), patch('core.kernels.interrupt', AsyncMock()):
            result=asyncio.run(reviewer.reproduce(self.fid))
        self.assertEqual(calls, ['python', 'r'])
        self.assertTrue(result['all_matched'])


if __name__ == '__main__':
    unittest.main()
