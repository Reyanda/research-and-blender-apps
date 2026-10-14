#!/usr/bin/env python3
"""Test the installed host's actual backend lifecycle without a visible window."""
import argparse, os, pathlib, plistlib, subprocess
parser = argparse.ArgumentParser(); parser.add_argument('--app', default='~/Applications/OpenScience.app'); args = parser.parse_args()
app = pathlib.Path(args.app).expanduser(); info = plistlib.loads((app / 'Contents/Info.plist').read_bytes())
assert info['CFBundleIdentifier'] == 'org.reyanda.openscience'
resources = app / 'Contents/Resources'
assert not list(resources.rglob('.env'))
assert 'api_key = ""' in next(resources.rglob('config.toml')).read_text()
subprocess.run(['codesign', '--verify', '--deep', '--strict', str(app)], check=True)
result = subprocess.run([str(app / 'Contents/MacOS' / info['CFBundleExecutable']), '--self-test'], text=True, capture_output=True, timeout=45)
print(result.stdout, end='')
if result.returncode: print(result.stderr, end=''); raise SystemExit(result.returncode)
assert 'Native self-test passed' in result.stdout
subprocess.run(['codesign', '--verify', '--deep', '--strict', str(app)], check=True)
assert not list(resources.rglob('__pycache__'))

env = dict(os.environ, OPENSCIENCE_PYTHON="/nonexistent/research-blender-python")
failure = subprocess.run([str(app / "Contents/MacOS" / info["CFBundleExecutable"]), "--self-test"], env=env, capture_output=True, text=True, timeout=10)
assert failure.returncode == 1 and "Python runtime missing" in failure.stderr
print("Missing runtime reports an actionable error.")
