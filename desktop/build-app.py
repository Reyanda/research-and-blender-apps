#!/usr/bin/env python3
"""Build replacement AppKit shell using an explicit external Python runtime."""
import argparse, os, pathlib, plistlib, shutil, subprocess, sys, tempfile
ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'openscience-variants/own-openscience/OpenScience'
def build(destination, python):
    python = pathlib.Path(python).resolve()
    subprocess.run([str(python), '-c', 'import sys; assert sys.version_info >= (3,11); import fastapi, httpx, uvicorn, pypdf, mcp, paramiko, markdown_it, Bio, rdkit, latex2mathml, modal'], check=True)
    destination = pathlib.Path(destination).expanduser().resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='research-blender-build-') as temporary:
        bundle = pathlib.Path(temporary) / destination.name
        contents = bundle / 'Contents'; executable = contents / 'MacOS/OpenScience'
        executable.parent.mkdir(parents=True)
        resources = contents / 'Resources'
        target = resources / 'openscience-variants/own-openscience/OpenScience'; target.mkdir(parents=True)
        for name in ('run.py', 'requirements.txt'): shutil.copy2(SOURCE / name, target / name)
        shutil.copytree(SOURCE / 'src', target / 'src', ignore=shutil.ignore_patterns('__pycache__', '*.pyc', '.env', '.env.*'))
        (target / 'config.toml').write_text('api_key = ""\n[server]\nhost = "127.0.0.1"\nport = 1337\n[llm]\nmodel = ""\n')
        (resources / 'desktop').mkdir(); shutil.copy2(ROOT / 'desktop/server.py', resources / 'desktop/server.py')
        for notice in ('LICENSE', 'THIRD-PARTY-NOTICES.md'):
            shutil.copy2(ROOT / notice, resources / notice)
        extension = ROOT / '3d-agent/3d-agent-community/decompiled_bundles/blender-extension'
        if extension.exists():
            target_extension = resources / 'blender-extension'; target_extension.mkdir()
            for name in ('__init__.py', 'blender_manifest.toml', 'README.md'):
                if (extension / name).exists(): shutil.copy2(extension / name, target_extension / name)
        with (contents / 'Info.plist').open('wb') as stream:
            plistlib.dump({'CFBundleName': 'OpenScience', 'CFBundleExecutable': executable.name, 'CFBundleIdentifier': 'org.reyanda.openscience', 'CFBundleVersion': '3', 'CFBundleShortVersionString': '0.3.0', 'CFBundlePackageType': 'APPL', 'NSHighResolutionCapable': True, 'OpenSciencePython': str(python)}, stream)
        subprocess.run(['xcrun', 'swiftc', str(ROOT / 'desktop/native.swift'), '-o', str(executable), '-framework', 'AppKit', '-framework', 'WebKit'], check=True)
        subprocess.run(['codesign', '--force', '--deep', '--sign', '-', str(bundle)], check=True)
        if destination.exists():
            info = destination / 'Contents/Info.plist'
            if not info.exists() or plistlib.loads(info.read_bytes()).get('CFBundleIdentifier') != 'org.reyanda.openscience': raise RuntimeError('Refusing to replace unrelated destination')
            shutil.rmtree(destination)
        shutil.copytree(bundle, destination)
    print(destination)
if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--output', default='~/Applications/OpenScience.app'); parser.add_argument('--python', default=os.environ.get('OPENSCIENCE_PYTHON', sys.executable)); args = parser.parse_args(); build(args.output, args.python)
