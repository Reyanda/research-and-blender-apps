import asyncio,json,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'src'))
from core import server,sessions,workspace
from fastapi.testclient import TestClient

class LifecycleTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.storage=patch.object(server,'DATA',Path(self.tmp.name));self.storage.start();self.client=TestClient(server.app)
        self.pid=self.client.post('/api/projects',json={'name':'Disposable project'}).json()['id']
        self.fid=self.client.post('/api/frames',json={'project_id':self.pid}).json()['id']
        self.artifact=self.client.post('/api/projects/'+self.pid+'/attachments',json={'filename':'source.txt','content':'Preserve these bytes','content_type':'text/plain'}).json()
    def tearDown(self):self.storage.stop();self.tmp.cleanup()
    def test_close_reopen_delete_restore_preserve_files(self):
        root='/api/projects/'+self.pid
        self.assertEqual(self.client.post(root+'/close').json()['status'],'closed')
        self.assertEqual(self.client.post('/api/frames',json={'project_id':self.pid}).status_code,409)
        self.assertEqual(self.client.post(root+'/notes',json={'content':'Forbidden while closed'}).status_code,409)
        self.assertEqual(self.client.get(root+'/artifacts/'+self.artifact['id']).text,'Preserve these bytes')
        self.assertEqual(self.client.post(root+'/reopen').status_code,200)
        self.assertEqual(self.client.request('DELETE',root,json={'confirm_name':'wrong'}).status_code,400)
        deleted=self.client.request('DELETE',root,json={'confirm_name':'Disposable project'}).json()
        self.assertTrue(deleted['recoverable']);self.assertEqual(self.client.get(root).status_code,404)
        self.assertEqual(self.client.get('/api/deleted-projects').json()['projects'][0]['id'],self.pid)
        self.assertEqual(self.client.post('/api/deleted-projects/'+self.pid+'/restore').status_code,200)
        self.assertEqual(self.client.get(root+'/artifacts/'+self.artifact['id']).text,'Preserve these bytes')
        self.assertEqual(self.client.get('/api/frames/'+self.fid).status_code,200)
    def test_running_project_cannot_be_closed_or_deleted(self):
        with patch.dict(sessions._tasks,{self.fid:object()}):
            self.assertEqual(self.client.post('/api/projects/'+self.pid+'/close').status_code,409)
            self.assertEqual(self.client.request('DELETE','/api/projects/'+self.pid,json={'confirm_name':'Disposable project'}).status_code,409)
    def test_response_markdown_tables_and_code_are_safe(self):
        text='**Results**\n\n| Group | Mean |\n|---|---|\n| A | 13 |\n\n```json\n{"mean":13}\n```\n\n<script>window.exploited=true</script>\n\n[Bad](javascript:alert(1))'
        response=self.client.post('/api/render/markdown',json={'content':text});self.assertEqual(response.status_code,200)
        html=response.json()['html'];self.assertIn('<strong>Results</strong>',html);self.assertIn('<table>',html);self.assertIn('<pre><code class="language-json">',html);self.assertNotIn('<script>',html);self.assertNotIn('href="javascript:',html)
        f=sessions.find(self.fid);f['messages']=[{'role':'assistant','content':text}];sessions.write(f)
        self.assertIn('<table>',self.client.get('/api/frames/'+self.fid).json()['messages'][0]['rendered_html'])
    def test_json_artifact_has_structured_preview(self):
        a=self.client.post('/api/projects/'+self.pid+'/attachments',json={'filename':'results.json','content':'{"mean":13}','content_type':'application/json'}).json()
        result=self.client.get('/api/projects/'+self.pid+'/artifacts/'+a['id']+'/preview').json()
        self.assertEqual(result['kind'],'json');self.assertEqual(result['value'],{'mean':13})

if __name__=='__main__':unittest.main()
