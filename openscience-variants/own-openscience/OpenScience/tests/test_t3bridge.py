import sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch,AsyncMock
import httpx
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'src'))
from core import server,t3bridge
from fastapi.testclient import TestClient
class BridgeTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.storage=patch.object(server,'DATA',Path(self.temp.name));self.storage.start();self.client=TestClient(server.app)
 def tearDown(self):self.storage.stop();self.temp.cleanup()
 def test_local_only_configuration_and_persistence(self):
  for url in ['https://example.org','http://user:secret@localhost:8420','http://localhost:8420/path']:
   self.assertEqual(self.client.put('/api/settings/workbench',json={'t3_url':url}).status_code,400)
  value={'t3_url':'http://127.0.0.1:8420','appearance':'dark','density':'comfortable'}
  self.assertEqual(self.client.put('/api/settings/workbench',json=value).status_code,200)
  self.assertEqual(self.client.get('/api/settings/workbench').json(),value)
 def test_readiness_requires_descriptor_not_html(self):
  client=AsyncMock();client.__aenter__.return_value=client
  with patch.object(t3bridge.httpx,'AsyncClient',return_value=client):
   client.get.return_value=httpx.Response(200,text='<html>Not a runtime</html>')
   self.assertFalse(self.client.get('/api/coding/runtime').json()['connected'])
   client.get.return_value=httpx.Response(200,json={'environmentId':'owned','serverVersion':'0.0.45'})
   self.assertTrue(self.client.get('/api/coding/runtime').json()['connected'])
if __name__=='__main__':unittest.main()
