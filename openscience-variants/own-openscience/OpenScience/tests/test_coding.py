import hashlib
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'src'))
from core import server,workspace
from fastapi.testclient import TestClient
class CodingTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name);self.repo=self.root/'repo';self.repo.mkdir()
        subprocess.run(['git','init','-q',str(self.repo)],check=True)
        (self.repo/'analysis.py').write_text('print(1)\n')
        subprocess.run(['git','add','analysis.py'],cwd=self.repo,check=True)
        subprocess.run(['git','-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','source'],cwd=self.repo,check=True)
        self.storage=patch.object(server,'DATA',self.root/'data');self.storage.start();self.client=TestClient(server.app)
        self.pid=self.client.post('/api/projects',json={'name':'Study'}).json()['id'];self.url=f'/api/projects/{self.pid}/repository'
        self.client.put(self.url,json={'path':str(self.repo)})
    def tearDown(self):self.storage.stop();self.temp.cleanup()
    def test_permissions_stale_bytes_and_git_diff(self):
        value=self.client.get(self.url+'/file',params={'path':'analysis.py'}).json()
        change={'path':'analysis.py','content':'print(2)\n','previous_sha256':value['sha256']}
        self.assertEqual(self.client.put(self.url+'/file',json=change).status_code,403)
        self.client.put(self.url,json={'path':str(self.repo),'write_enabled':True})
        self.assertEqual(self.client.put(self.url+'/file',json=change).status_code,200)
        self.assertEqual((self.repo/'analysis.py').read_bytes(),b'print(2)\n')
        self.assertEqual(self.client.put(self.url+'/file',json=change).status_code,409)
        diff=self.client.get(self.url+'/git').json();self.assertIn('+print(2)',diff['diff'])
    def test_science_exchange_and_path_boundaries(self):
        imported=self.client.post(self.url+'/import',json={'path':'analysis.py'}).json()['artifact']
        self.assertEqual(imported['versions'][0]['sha256'],hashlib.sha256(b'print(1)\n').hexdigest())
        self.client.put(self.url,json={'path':str(self.repo),'write_enabled':True})
        self.assertEqual(self.client.post(self.url+'/export',json={'artifact_id':imported['id'],'path':'result.py'}).status_code,200)
        self.assertEqual((self.repo/'result.py').read_bytes(),b'print(1)\n')
        self.assertEqual(self.client.post(self.url+'/export',json={'artifact_id':imported['id'],'path':'result.py'}).status_code,409)
        (self.repo/'escape').symlink_to(self.root/'data',target_is_directory=True)
        for name in ['../outside','.git/config','escape/config']:
            self.assertIn(self.client.get(self.url+'/file',params={'path':name}).status_code,[400,404])
if __name__=='__main__':unittest.main()
