import asyncio
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import httpx
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
from core import server, providers, events, streaming, coding

class IntegrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.storage = patch.object(server, 'DATA', Path(self.tmp.name)); self.storage.start()
    def tearDown(self):
        self.storage.stop(); self.tmp.cleanup()
    def stream(self, rows, anthropic=False):
        async def run():
            queue=asyncio.Queue(); token=events.SINK.set(queue)
            try:
                data=''.join('data: '+json.dumps(r)+'\n\n' for r in rows)
                async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request:httpx.Response(200,text=data))) as client:
                    result=await streaming.response(client,'http://fixture.invalid',{}, {'model':'fixture'}, anthropic)
                return result, list(queue._queue)
            finally:events.SINK.reset(token)
        return asyncio.run(run())
    def test_openai_fragmented_arguments_and_incremental_text(self):
        result, rows=self.stream([
            {'choices':[{'delta':{'content':'First ','tool_calls':[{'index':0,'id':'call','function':{'name':'sum','arguments':'{"n":'}}]}}]},
            {'choices':[{'delta':{'content':'second','tool_calls':[{'index':0,'function':{'arguments':'3}'}}]},'finish_reason':'tool_calls'}]},
            {'choices':[], 'usage':{'prompt_tokens':8,'completion_tokens':9}}])
        self.assertEqual(result['tool_calls'][0]['arguments'],{'n':3})
        self.assertEqual(result['content'],'First second')
        self.assertEqual([r['text'] for r in rows],['First ','second'])
        self.assertEqual(result['usage']['completion_tokens'],9)
    def test_truncated_stream_is_failure(self):
        with self.assertRaises(Exception):self.stream([{'choices':[{'delta':{'content':'partial'}}]}])
    def test_anthropic_usage_and_tool_fragments(self):
        result, _=self.stream([
            {'type':'message_start','message':{'model':'fixture','usage':{'input_tokens':8}}},
            {'type':'content_block_start','index':1,'content_block':{'type':'tool_use','id':'x','name':'sum'}},
            {'type':'content_block_delta','index':1,'delta':{'type':'input_json_delta','partial_json':'{"n":4}'}},
            {'type':'message_delta','delta':{'stop_reason':'tool_use'},'usage':{'output_tokens':3}}],True)
        self.assertEqual(result['tool_calls'][0]['arguments'],{'n':4})
        self.assertEqual(result['usage'],{'input_tokens':8,'output_tokens':3})
    def test_usage_unknown_counts_are_not_zero_claims(self):
        events.record({'id':'one'},{'model':'x','usage':{}})
        events.record({'id':'one'},{'model':'x','usage':{'input_tokens':8,'output_tokens':3}})
        value=asyncio.run(events.usage())['providers']['one']
        self.assertEqual(value['unreported_requests'],1)
        self.assertEqual(value['input_tokens'],8)
    def test_pubmed_retains_identifiers_and_search_interpretation(self):
        from connectors import mcp
        factory=httpx.AsyncClient
        def handler(request):
            if request.url.path.endswith('esearch.fcgi'):
                return httpx.Response(200,json={'esearchresult': {'idlist':['123'], 'count':'7', 'querytranslation':'translated query', 'warninglist':{'outputmessages':['fixture warning']}}})
            return httpx.Response(200,json={'result':{'uids':['123'],'123':{'title':'Fixture paper','authors':[{'name':'Example A'}],'articleids':[{'idtype':'doi','value':'10.1000/fixture'},{'idtype':'pmc','value':'PMC123'}]}}})
        with patch.object(httpx,'AsyncClient',lambda:factory(transport=httpx.MockTransport(handler))):
            result=asyncio.run(mcp.mcp_search('pubmed','fixture query',{'max_results':1}))
        self.assertEqual(result['results'][0]['doi'],'10.1000/fixture')
        self.assertEqual(result['results'][0]['pmcid'],'PMC123')
        self.assertEqual(result['query_translation'],'translated query')
        self.assertEqual(result['total'],7)
        self.assertEqual(result['warnings']['outputmessages'],['fixture warning'])
        with patch.object(httpx,'AsyncClient',lambda:factory(transport=httpx.MockTransport(lambda r:httpx.Response(429,json={'error':'rate limited'})))):
            result=asyncio.run(mcp.mcp_search('pubmed','fixture query',{}))
        self.assertIn('error',result)
        self.assertNotIn('results',result)

    def test_provider_can_discover_without_guessed_model(self):
        async def run():
            profile=await providers.create(providers.Provider(name='Automatic',kind='custom',base_url='http://fixture.invalid/v1'))
            transport=httpx.MockTransport(lambda request:httpx.Response(200,json={'data':[{'id':'live-one'},{'id':'live-two'}]}))
            with patch.object(providers,'http_client',lambda:httpx.AsyncClient(transport=transport)):
                result=await providers.discover(profile['id'])
            self.assertEqual(result['models'],['live-one','live-two'])
            self.assertEqual(providers.selected(profile['id'])['model'],'live-one')
        asyncio.run(run())

    def test_clis_share_host_tool_contract(self):
        payload=json.dumps({'content':'','tool_calls':[{'name':'read_artifact','arguments':{'artifact_id':'x'}}]})
        for kind, output in [('codex-cli',json.dumps({'type':'item.completed','item':{'type':'agent_message','text':payload}})),('claude-cli',json.dumps({'result':payload}))]:
            result=providers.cli_response(output,kind,[{'name':'read_artifact'}],None)
            self.assertEqual(result['tool_calls'][0]['name'],'read_artifact')
            with self.assertRaises(Exception):providers.cli_response(output,kind,[],None)

if __name__=='__main__':unittest.main()
