"""Exercise the installed WebKit app against a disposable real Blender scene."""
import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('bridge_integration', ROOT / 'test-blender-bridge.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
case = module.BlenderIntegration
try:
    case.setUpClass()
    with tempfile.TemporaryDirectory(prefix='desktop-ui-data-') as data:
        env = dict(os.environ, OPENSCIENCE_DATA_DIR=data, DEEPSEEK_BASE_URL='http://127.0.0.1:1/v1')
        executable = Path.home() / 'Applications/Research and Blender.app/Contents/MacOS/ResearchAndBlender'
        subprocess.run([str(executable), '--ui-self-test'], env=env, check=True, timeout=90)
        subprocess.run(['codesign', '--verify', '--deep', '--strict', str(executable.parents[2])], check=True)
finally:
    case.doClassCleanups()
