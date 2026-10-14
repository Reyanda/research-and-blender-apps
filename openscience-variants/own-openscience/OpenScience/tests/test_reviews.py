import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch
import httpx
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
from core import server, reviews
from fastapi.testclient import TestClient

class ReviewBridgeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.storage = patch.object(server, 'DATA', Path(self.temp.name)); self.storage.start()
        self.client = TestClient(server.app)
        self.pid = self.client.post('/api/projects', json={'name': 'Review project'}).json()['id']
    def tearDown(self):
        self.storage.stop(); self.temp.cleanup()
    def test_request_preserves_human_review_and_project_binding(self):
        upstream = AsyncMock(return_value={'runId': 'run-one', 'stages': {}, 'artifacts': {}})
        with patch.object(reviews, 'upstream', upstream):
            response = self.client.post(f'/api/projects/{self.pid}/reviews', json={'question': 'Does exercise improve wellbeing?', 'review_type': 'intervention'})
            self.assertEqual(response.status_code, 202, response.text)
            rid = response.json()['review']['id']
            request = upstream.call_args.args[3]
            self.assertFalse(request['autoApproveHumanGates'])
            self.assertFalse(request['registration']['enabled'])
            self.assertTrue(request['humanVerification']['enabled'])
            self.assertTrue(request['protocolDevelopment']['searchPeerReviewRequired'])
            other = self.client.post('/api/projects', json={'name': 'Other'}).json()['id']
            self.assertEqual(self.client.get(f'/api/projects/{other}/reviews/{rid}').status_code, 404)
            self.assertEqual(self.client.post(f'/api/projects/{self.pid}/reviews/{rid}/handoff/delete', json={}).status_code, 400)
            snapshot = self.client.post(f'/api/projects/{self.pid}/reviews/{rid}/snapshot')
            self.assertEqual(snapshot.status_code, 200, snapshot.text)
            self.assertEqual(snapshot.json()['artifact']['versions'][-1]['metadata']['origin'], 'medantir-review')
    def test_upstream_uses_private_bearer_and_does_not_follow_redirects(self):
        def handler(request):
            self.assertEqual(request.headers['authorization'], 'Bearer private-token')
            self.assertEqual(request.headers['x-actiora-project'], self.pid)
            return httpx.Response(200, json={'runId': 'run-one'})
        real_client = httpx.AsyncClient
        def client(**kwargs):
            self.assertFalse(kwargs['follow_redirects'])
            return real_client(transport=httpx.MockTransport(handler), **kwargs)
        import asyncio
        with patch.object(reviews, 'start', AsyncMock()), patch.object(reviews, '_origin', 'http://localhost:9999'), patch.object(reviews, '_token', 'private-token'), patch.object(reviews.httpx, 'AsyncClient', client):
            self.assertEqual(asyncio.run(reviews.upstream(self.pid, 'GET', '/runs/one'))['runId'], 'run-one')
    def test_invalid_family_does_not_start_runtime(self):
        with patch.object(reviews, 'start', AsyncMock()) as start:
            response = self.client.post(f'/api/projects/{self.pid}/reviews', json={'question': 'Does exercise improve wellbeing?', 'review_type': 'invented'})
            self.assertEqual(response.status_code, 400)
            start.assert_not_called()

if __name__ == '__main__': unittest.main()
