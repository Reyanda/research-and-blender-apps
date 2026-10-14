import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, AsyncMock
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
from core import server, profiles
from fastapi.testclient import TestClient

class ProfileTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.storage = patch.object(server, 'DATA', Path(self.temp.name))
        self.storage.start()
        self.client = TestClient(server.app)
    def tearDown(self):
        self.storage.stop()
        self.temp.cleanup()
    def agent(self, **changes):
        response = self.client.post('/api/agents', json={'name': 'Methods researcher', 'system_prompt': 'Check denominators.', **changes})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()
    def test_selected_skills_and_disabled_skill_isolation(self):
        self.client.post('/api/skills/catalog', json={'name': 'methods', 'content': 'Report confidence intervals.'})
        self.client.post('/api/skills/catalog', json={'name': 'private', 'content': 'Unselected material.'})
        agent = self.agent(skill_names=['methods'])
        text = profiles.agent_context(agent['id'])
        self.assertIn('Check denominators.', text)
        self.assertIn('Report confidence intervals.', text)
        self.assertNotIn('Unselected', text)
        self.client.put('/api/skills/catalog/methods/enabled', json={'enabled': False})
        self.assertNotIn('confidence intervals', profiles.agent_context(agent['id']))
        self.assertIsNone(profiles.agent_context(None))
    def test_tool_and_connector_restrictions_are_independent(self):
        agent = self.agent(excluded_tools=['run_python'], connector_ids=['pubmed'])
        self.assertNotIn('run_python', [t['name'] for t in profiles.agent_tools(agent['id'], server.TOOLS)])
        self.assertIn('run_python', [t['name'] for t in profiles.agent_tools(None, server.TOOLS)])
        self.assertTrue(profiles.connector_allowed(agent['id'], 'pubmed'))
        self.assertFalse(profiles.connector_allowed(agent['id'], 'arxiv'))
        self.assertTrue(profiles.connector_allowed(None, 'arxiv'))
    def test_agent_crud_and_skill_delete_updates_assignments(self):
        self.client.post('/api/skills/catalog', json={'name': 'methods', 'content': 'Use sources.'})
        agent = self.agent(skill_names=['methods'])
        self.assertEqual(self.client.post('/api/agents', json={'name': agent['name']}).status_code, 409)
        self.client.patch('/api/agents/' + agent['id'], json={'system_prompt': 'Updated instructions.'})
        self.assertIn('Updated', profiles.agent_context(agent['id']))
        self.client.delete('/api/skills/catalog/methods')
        self.assertEqual(profiles.selected(agent['id'])['skill_names'], [])
        self.client.delete('/api/agents/' + agent['id'])
        self.assertEqual(self.client.get('/api/agents').json()['agents'], [])
    def test_selected_agent_prompt_reaches_real_conversation_loop(self):
        agent = self.agent()
        pid = self.client.post('/api/projects', json={'name': 'Study'}).json()['id']
        fid = self.client.post('/api/frames', json={'project_id': pid}).json()['id']
        provider = AsyncMock(return_value={'content': 'Result', 'tool_calls': None})
        with patch.object(server, 'llm_chat', provider):
            response = self.client.post(f'/api/frames/{fid}/message', json={'input_data': 'Analyse', 'target_agent': agent['id']})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertIn('Check denominators.', str(provider.call_args.args[0]))
        self.assertEqual(self.client.get(f'/api/frames/{fid}').json()['agent_id'], agent['id'])
    def test_provider_cannot_bypass_excluded_tool(self):
        agent = self.agent(excluded_tools=['run_python'])
        pid = self.client.post('/api/projects', json={'name': 'Study'}).json()['id']
        fid = self.client.post('/api/frames', json={'project_id': pid}).json()['id']
        provider = AsyncMock(side_effect=[{'content': '', 'tool_calls': [{'id': 'x', 'name': 'run_python', 'arguments': {'code': 'print(1)'}}]}, {'content': 'Tool unavailable', 'tool_calls': None}])
        with patch.object(server, 'llm_chat', provider), patch.object(server, 'run_tool', AsyncMock()) as tool:
            result = self.client.post(f'/api/frames/{fid}/message', json={'input_data': 'Analyse', 'target_agent': agent['id']})
            self.assertEqual(result.status_code, 200, result.text)
            tool.assert_not_called()
            self.assertIn('error', result.json()['tool_results'][0]['result'])

    def test_provider_cannot_bypass_connector_or_cell_restriction(self):
        agent = self.agent(connector_ids=['pubmed'], excluded_tools=['run_python'])
        pid = self.client.post('/api/projects', json={'name': 'Study'}).json()['id']
        fid = self.client.post('/api/frames', json={'project_id': pid}).json()['id']
        provider = AsyncMock(side_effect=[{'content': '', 'tool_calls': [{'id': 'x', 'name': 'search_mcp', 'arguments': {'connector': 'arxiv', 'query': 'test'}}]}, {'content': 'Connector unavailable', 'tool_calls': None}])
        with patch.object(server, 'llm_chat', provider), patch.object(server, 'run_tool', AsyncMock()) as tool:
            result = self.client.post(f'/api/frames/{fid}/message', json={'input_data': 'Analyse', 'target_agent': agent['id']})
            self.assertEqual(result.status_code, 200, result.text)
            tool.assert_not_called()
            self.assertIn('error', result.json()['tool_results'][0]['result'])
            cell = self.client.post(f'/api/frames/{fid}/execute', json={'code': 'print(1)'}).json()
            self.assertEqual(cell['status'], 'failed')
            self.assertIn('excluded', cell['result']['error'])
            tool.assert_not_called()

if __name__ == '__main__':
    unittest.main()
