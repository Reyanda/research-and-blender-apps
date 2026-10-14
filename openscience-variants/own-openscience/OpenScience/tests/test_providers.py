import asyncio
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch, AsyncMock
import httpx
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
from core import server, providers

class ProviderTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.storage = patch.object(server, 'DATA', Path(self.temp.name)); self.storage.start()
    def tearDown(self):
        self.storage.stop(); self.temp.cleanup()
    def profile(self, kind='custom', name='Fixture', key='secret-one', model='fixture-model'):
        return asyncio.run(providers.create(providers.Provider(name=name, kind=kind, base_url='http://fixture.invalid/v1', api_key=key, model=model)))['id']
    def transport(self, handler):
        return patch.object(providers, 'http_client', lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    def test_profiles_keep_credentials_private_and_isolated(self):
        first = self.profile(); second = self.profile(name='Other', key='secret-two', model='other-model')
        self.assertNotIn('secret', providers.path().read_text())
        self.assertNotIn('secret', json.dumps(asyncio.run(providers.providers())))
        observed = []
        def handler(request):
            observed.append((request.headers['authorization'], json.loads(request.content)['model']))
            return httpx.Response(200, json={'choices': [{'message': {'content': 'Done'}}]})
        with self.transport(handler):
            asyncio.run(providers.chat([{'role': 'user', 'content': 'One'}], provider_id=first))
            asyncio.run(providers.chat([{'role': 'user', 'content': 'Two'}], provider_id=second))
        self.assertEqual(observed, [('Bearer secret-one', 'fixture-model'), ('Bearer secret-two', 'other-model')])
    def test_openai_tool_schema_and_result_contract(self):
        identifier = self.profile()
        def handler(request):
            payload = json.loads(request.content)
            self.assertEqual(request.url.path, '/v1/chat/completions')
            self.assertEqual(payload['tools'][0]['function']['parameters']['properties']['n']['type'], 'integer')
            return httpx.Response(200, json={'model': 'fixture-model', 'usage': {'total_tokens': 5}, 'choices': [{'message': {'content': None, 'tool_calls': [{'id': 'call', 'function': {'name': 'sum', 'arguments': '{"n":3}'}}]}, 'finish_reason': 'tool_calls'}]})
        with self.transport(handler):
            result = asyncio.run(providers.chat([{'role': 'user', 'content': 'Calculate'}], [{'name': 'sum', 'input_schema': {'type': 'object', 'properties': {'n': {'type': 'integer'}}}}], provider_id=identifier))
        self.assertEqual(result['tool_calls'][0]['arguments'], {'n': 3})
        self.assertEqual(result['usage']['total_tokens'], 5)
    def test_anthropic_parallel_tool_history_translation(self):
        identifier = self.profile(kind='anthropic')
        history = [{'role': 'system', 'content': 'Research methods'}, {'role': 'user', 'content': 'Calculate'}, {'role': 'assistant', 'content': None, 'tool_calls': [{'id': 'one', 'function': {'name': 'sum', 'arguments': '{"n":1}'}}, {'id': 'two', 'function': {'name': 'sum', 'arguments': '{"n":2}'}}]}, {'role': 'tool', 'tool_call_id': 'one', 'content': '1'}, {'role': 'tool', 'tool_call_id': 'two', 'content': '2'}]
        def handler(request):
            payload = json.loads(request.content)
            self.assertEqual(request.url.path, '/v1/messages')
            self.assertEqual(request.headers['x-api-key'], 'secret-one')
            self.assertNotIn('authorization', request.headers)
            self.assertEqual(payload['system'], 'Research methods')
            self.assertEqual(payload['messages'][1]['content'][0]['type'], 'tool_use')
            self.assertEqual([b['tool_use_id'] for b in payload['messages'][2]['content']], ['one', 'two'])
            return httpx.Response(200, json={'content': [{'type': 'text', 'text': 'Result'}, {'type': 'tool_use', 'id': 'next', 'name': 'sum', 'input': {'n': 3}}], 'stop_reason': 'tool_use', 'model': 'claude-fixture', 'usage': {'input_tokens': 4}})
        with self.transport(handler): result = asyncio.run(providers.chat(history, provider_id=identifier))
        self.assertEqual(result['content'], 'Result')
        self.assertEqual(result['tool_calls'][0]['arguments'], {'n': 3})
        self.assertEqual(result['model'], 'claude-fixture')
    def test_discovery_test_is_get_only_and_default_persists(self):
        identifier = self.profile()
        def handler(request):
            self.assertEqual(request.method, 'GET')
            return httpx.Response(200, json={'data': [{'id': 'discovered-model'}]})
        with self.transport(handler): result = asyncio.run(providers.test(identifier))
        self.assertTrue(result['connected'])
        asyncio.run(providers.choose_default(identifier))
        self.assertEqual(providers.selected()['id'], identifier)
        self.assertIn('discovered-model', providers.selected()['models'])
    def test_disabled_and_invalid_provider_errors_hide_remote_secrets(self):
        identifier = self.profile()
        asyncio.run(providers.update(identifier, providers.ProviderPatch(enabled=False)))
        with self.assertRaises(server.HTTPException) as denied: providers.selected(identifier)
        self.assertEqual(denied.exception.status_code, 403)
        asyncio.run(providers.update(identifier, providers.ProviderPatch(enabled=True)))
        with self.transport(lambda _: httpx.Response(401, json={'error': 'secret-one'})):
            with self.assertRaises(server.HTTPException) as failed:
                asyncio.run(providers.chat([{'role': 'user', 'content': 'Test'}], provider_id=identifier))
        self.assertNotIn('secret', failed.exception.detail)
    def test_legacy_seed_keeps_existing_runtime_configuration(self):
        with patch.object(server, 'API_KEY', 'legacy-secret'), patch.object(server, 'DS_URL', 'http://legacy.invalid/v1'):
            value = providers.selected()
            self.assertEqual(value['api_key'], 'legacy-secret')
            self.assertEqual(value['base_url'], 'http://legacy.invalid/v1')
            self.assertNotIn('legacy-secret', json.dumps(asyncio.run(providers.providers())))

    def test_installed_cli_profiles_and_default_survive_reload(self):
        with patch.object(providers.shutil, 'which', return_value='/fixture/cli'):
            data = asyncio.run(providers.providers())
            self.assertEqual({p['id'] for p in data['providers'] if p.get('transport') == 'local-cli'}, set(providers.CLI))
            self.assertIsNone(next(p for p in data['providers'] if p['id'] == 'grok-cli')['authenticated'])
            asyncio.run(providers.choose_default('grok-cli'))
            self.assertEqual(providers.selected()['kind'], 'grok-cli')
        with patch.object(providers.shutil, 'which', return_value=None):
            with self.assertRaises(server.HTTPException): providers.selected('grok-cli')

    def test_cli_models_and_host_tool_contract(self):
        tool = {'name': 'run_python', 'parameters': {'code': 'Python code'}}
        reply = json.dumps({'text': json.dumps({'content': '', 'tool_calls': [{'name': 'run_python', 'arguments': {'code': 'print(4)'}}]}), 'usage': {'output_tokens': 10}})
        process = AsyncMock(side_effect=['Available models:\n * grok-4.7 (default)\n - grok-4.6', reply])
        with patch.object(providers.shutil, 'which', return_value='/fixture/grok'), patch.object(providers, 'cli_process', process):
            self.assertEqual(asyncio.run(providers.discover('grok-cli'))['models'], ['grok-4.7', 'grok-4.6'])
            result = asyncio.run(providers.chat([{'role': 'user', 'content': 'Compute'}], [tool], provider_id='grok-cli'))
        command, prompt = process.call_args.args
        self.assertEqual(command[command.index('--tools') + 1], '')
        self.assertIn('run_python', prompt)
        self.assertEqual(result['tool_calls'][0]['arguments'], {'code': 'print(4)'})
        self.assertEqual(result['usage']['output_tokens'], 10)
        invalid = json.dumps({'text': '{"content":"","tool_calls":[{"name":"shell","arguments":{}}]}'})
        with self.assertRaises(server.HTTPException): providers.cli_response(invalid, 'grok-cli', [tool], '')

    def test_opencode_event_parser_and_failures(self):
        output = json.dumps({'type': 'text', 'part': {'text': '{"content":"Result","tool_calls":[]}'}})
        self.assertEqual(providers.cli_response(output, 'opencode-cli', [], '')['content'], 'Result')
        for output in ['{"type":"error","error":{"message":"secret"}}', '{"type":"text","part":{"text":"invalid"}}']:
            with self.assertRaises(server.HTTPException) as error: providers.cli_response(output, 'opencode-cli', [], '')
            self.assertNotIn('secret', error.exception.detail)

    def test_owned_cli_timeout_kills_process(self):
        async def run():
            with self.assertRaises(server.HTTPException) as error:
                await providers.cli_process([sys.executable, '-c', 'import time; time.sleep(60)'], '', timeout=.1)
            self.assertEqual(error.exception.status_code, 504)
        asyncio.run(run())

if __name__ == '__main__': unittest.main()
