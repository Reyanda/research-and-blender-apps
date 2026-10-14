"""Exercise the installed WebKit app against a disposable real Blender scene."""
import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread

class ProviderFixture(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass
    def do_GET(self):
        self.reply({'data': [{'id': 'integration-model'}]})
    def do_POST(self):
        request = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        self.reply({'choices': [{'message': {'role': 'assistant', 'content': 'Integration response'}, 'finish_reason': 'stop'}], 'model': request['model']})
    def reply(self, data):
        body = json.dumps(data).encode(); self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('bridge_integration', ROOT / 'test-blender-bridge.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
case = module.BlenderIntegration
provider = ThreadingHTTPServer(('127.0.0.1', 0), ProviderFixture)
Thread(target=provider.serve_forever, daemon=True).start()
try:
    case.setUpClass()
    with tempfile.TemporaryDirectory(prefix='desktop-ui-data-') as data:
        env = dict(os.environ, OPENSCIENCE_DATA_DIR=data, DEEPSEEK_BASE_URL='http://127.0.0.1:'+str(provider.server_port)+'/v1', DEEPSEEK_API_KEY='integration-fixture')
        executable = Path.home() / 'Applications/OpenScience.app/Contents/MacOS/OpenScience'
        subprocess.run([str(executable), '--ui-self-test'], env=env, check=True, timeout=180)
        subprocess.run(['codesign', '--verify', '--deep', '--strict', str(executable.parents[2])], check=True)
finally:
    case.doClassCleanups()
    provider.shutdown(); provider.server_close()
