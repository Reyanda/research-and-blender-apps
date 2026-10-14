#!/usr/bin/env python3
"""Authored replacement daemon joining OpenScience and the retained Blender protocol."""
import argparse
import asyncio
import ipaddress
import json
import os
from pathlib import Path
import sys
import subprocess
import tempfile
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
RESOURCE_ROOT = HERE.parent
SCIENCE = RESOURCE_ROOT / 'openscience'
if not (SCIENCE / 'src/core/server.py').exists():
    SCIENCE = RESOURCE_ROOT / 'openscience-variants/own-openscience/OpenScience'
sys.path.insert(0, str(SCIENCE / 'src'))
from core.server import app
from fastapi import Request
from fastapi.responses import JSONResponse

VERSION = '0.3.0'
MAX_BODY = 256 * 1024
MAX_FRAME = 8 * 1024 * 1024
TIMEOUT = 15.0
BLENDER_PORT = 9875
ALLOW_CODE = os.environ.get('OPENSCIENCE_ALLOW_EXECUTION', os.environ.get('ALLOW_BLENDER_CODE', '')).lower() in {'1', 'true', 'yes'}
BLENDER_CANDIDATES = [Path.home() / 'Applications/Blender.app/Contents/MacOS/Blender',
                      Path('/Applications/Blender.app/Contents/MacOS/Blender')]
COMMANDS = {'get_blender_info', 'get_scene_info', 'get_scene_graph', 'get_object_info',
            'get_mesh_stats', 'get_viewport_screenshot', 'execute_code'}


def error(message):
    return {'status': 'error', 'error': message, 'message': message}


def validate(command):
    if not isinstance(command, dict) or set(command) - {'type', 'params'}:
        raise ValueError('Expected {type, params} command')
    kind = command.get('type')
    if not isinstance(kind, str) or kind not in COMMANDS:
        raise ValueError('Unknown Blender command')
    params = command.get('params', {})
    if not isinstance(params, dict):
        raise ValueError('params must be an object')
    allowed = {'get_scene_graph': {'max_objects'}, 'get_object_info': {'name'},
               'get_mesh_stats': {'name'}, 'get_viewport_screenshot': {'filepath', 'max_size'},
               'execute_code': {'code'}}.get(kind, set())
    if set(params) - allowed:
        raise ValueError('Unsupported command parameter')
    for field in {'get_object_info': ['name'], 'get_mesh_stats': ['name'],
                  'get_viewport_screenshot': ['filepath'], 'execute_code': ['code']}.get(kind, []):
        if not isinstance(params.get(field), str) or not params[field].strip():
            raise ValueError(f'{field} must be a nonempty string')
    for field, minimum, maximum in [('max_objects', 0, 100000), ('max_size', 1, 4096)]:
        if field in params and (type(params[field]) is not int or not minimum <= params[field] <= maximum):
            raise ValueError(f'{field} must be an integer between {minimum} and {maximum}')
    if kind == 'execute_code' and not ALLOW_CODE:
        raise PermissionError('Python commands in Blender are disabled')
    return {'type': kind, 'params': params}


async def exchange(command):
    """One connection per request avoids cross-request response interleaving."""
    writer = None
    try:
        async with asyncio.timeout(TIMEOUT):
            reader, writer = await asyncio.open_connection('127.0.0.1', BLENDER_PORT, limit=MAX_FRAME)
            writer.write(json.dumps(command, ensure_ascii=False, allow_nan=False).encode() + b'\n')
            await writer.drain()
            frame = await reader.readline()
            if not frame.endswith(b'\n') or len(frame) > MAX_FRAME:
                raise ValueError('Invalid or oversized Blender response frame')
            response = json.loads(frame)
            if not isinstance(response, dict) or response.get('status') not in {'success', 'error'}:
                raise ValueError('Invalid Blender response envelope')
            if response['status'] == 'success' and 'result' not in response:
                raise ValueError('Blender success response has no result')
            if response['status'] == 'error' and not ('error' in response or 'message' in response):
                raise ValueError('Blender error response has no explanation')
            return response
    finally:
        if writer is not None:
            writer.close()
            await writer.wait_closed()


@app.middleware('http')
async def local_requests(request, call_next):
    try:
        local = request.client is not None and ipaddress.ip_address(request.client.host).is_loopback
    except ValueError:
        local = False
    host = urlsplit('http://' + request.headers.get('host', '')).hostname
    if not local or host not in {'127.0.0.1', 'localhost', '::1'}:
        return JSONResponse(error('Only loopback clients and hosts are accepted'), status_code=403)
    return await call_next(request)


# Replace only the health handler; research routes remain the imported app.
for route in app.routes:
    if getattr(route, 'path', None) == '/health':
        app.routes.remove(route)
        break


@app.get('/health')
async def health():
    result = {'status': 'ok'}
    if os.environ.get('OPENSCIENCE_INSTANCE'):
        result['instance'] = os.environ['OPENSCIENCE_INSTANCE']
    return result


@app.post('/v1/blender')
async def blender(request: Request):
    try:
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > MAX_BODY:
                return JSONResponse(error('Command body exceeds limit'), status_code=413)
        command = validate(json.loads(body, parse_constant=lambda value: (_ for _ in ()).throw(ValueError('Invalid JSON number'))))
    except PermissionError as exc:
        return JSONResponse(error(str(exc)), status_code=403)
    except (ValueError, UnicodeDecodeError) as exc:
        return JSONResponse(error(str(exc)), status_code=400)
    try:
        return await exchange(command)
    except TimeoutError:
        return JSONResponse(error('Blender response timed out'), status_code=504)
    except (OSError, ValueError, asyncio.LimitOverrunError) as exc:
        return JSONResponse(error(f'Blender bridge: {exc}'), status_code=502)


BLENDER_CHILD = None
BOOT_PATH = None


def retire_boot_script():
    global BOOT_PATH
    if BOOT_PATH:
        Path(BOOT_PATH).unlink(missing_ok=True)
        BOOT_PATH = None


@app.get('/api/blender/status')
async def blender_status():
    try:
        info = await exchange({'type': 'get_blender_info', 'params': {}})
    except (OSError, ValueError, TimeoutError):
        info = None
    return {'running': bool(info and info.get('status') == 'success'),
            'owned_process': bool(BLENDER_CHILD and BLENDER_CHILD.poll() is None),
            'code_execution_enabled': ALLOW_CODE, 'host': '127.0.0.1', 'port': BLENDER_PORT,
            'info': info}


@app.post('/api/blender/start')
async def start_blender():
    global BLENDER_CHILD, BOOT_PATH
    if BLENDER_CHILD and BLENDER_CHILD.poll() is None:
        return {'status': 'success', 'result': {'pid': BLENDER_CHILD.pid}}
    # Refuse to commandeer another session bound to the retained fixed TCP port.
    try:
        reader, writer = await asyncio.wait_for(asyncio.open_connection('127.0.0.1', BLENDER_PORT), 1)
    except OSError:
        pass
    else:
        writer.close()
        await writer.wait_closed()
        return JSONResponse(error('A Blender bridge already owns port 9875'), status_code=409)
    configured = os.environ.get('BLENDER_BINARY')
    binary = Path(configured) if configured else next((candidate for candidate in BLENDER_CANDIDATES if candidate.is_file()), BLENDER_CANDIDATES[-1])
    extension = RESOURCE_ROOT / 'blender-extension/__init__.py'
    if not extension.exists():
        extension = RESOURCE_ROOT / '3d-agent/3d-agent-community/decompiled_bundles/blender-extension/__init__.py'
    if not binary.is_absolute() or not binary.is_file() or not extension.is_file():
        return JSONResponse(error('Blender binary or retained extension is unavailable'), status_code=503)
    retire_boot_script()
    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', prefix='research-blender-', delete=False) as boot:
            BOOT_PATH = boot.name
            boot.write('import importlib.util, sys\n')
            boot.write(f'spec = importlib.util.spec_from_file_location("research_bridge_extension", {str(extension)!r})\n')
            boot.write('module = importlib.util.module_from_spec(spec)\nsys.modules[spec.name] = module\nspec.loader.exec_module(module)\nmodule.register()\nimport os\nos.unlink(__file__)\n')
        BLENDER_CHILD = subprocess.Popen([str(binary), '--factory-startup', '--python', BOOT_PATH],
                                         stdin=subprocess.DEVNULL)
    except OSError as exc:
        retire_boot_script()
        return JSONResponse(error(str(exc)), status_code=503)
    return {'status': 'success', 'result': {'pid': BLENDER_CHILD.pid}}


@app.post('/api/blender/permission')
async def blender_permission(request: Request):
    global ALLOW_CODE
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > 1024:
            return JSONResponse(error('Permission body exceeds limit'), status_code=413)
        data.extend(chunk)
    try:
        body = json.loads(data)
        if not isinstance(body, dict) or set(body) != {'enabled'} or type(body['enabled']) is not bool:
            raise ValueError('Expected a boolean enabled field')
    except (ValueError, UnicodeDecodeError):
        return JSONResponse(error('Expected {enabled: boolean}'), status_code=400)
    ALLOW_CODE = body['enabled']
    return {'code_execution_enabled': ALLOW_CODE}


@app.on_event('shutdown')
async def retire_launch_script():
    # Blender may contain unsaved work after launch; never terminate it here.
    # Keep a pending startup script until the child exits to avoid a launch race.
    if BLENDER_CHILD is None or BLENDER_CHILD.poll() is not None:
        retire_boot_script()


def main():
    global ALLOW_CODE
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', nargs='?', choices=['serve', 'url'], default='serve')
    parser.add_argument('--port', type=int, default=int(os.environ.get('OPENSCIENCE_PORT', '1337')))
    parser.add_argument('--allow-blender-code', action='store_true')
    parser.add_argument('--version', action='version', version=VERSION)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error('port must be between 1 and 65535')
    if args.command == 'url':
        print(f'http://127.0.0.1:{args.port}')
        return
    ALLOW_CODE = ALLOW_CODE or args.allow_blender_code
    os.environ['PORT'] = str(args.port)
    import uvicorn
    host = os.environ.get('OPENSCIENCE_HOST', '127.0.0.1')
    if host not in {'127.0.0.1', '::1', 'localhost'}:
        parser.error('host must be loopback')
    uvicorn.run(app, host=host, port=args.port, proxy_headers=False, timeout_graceful_shutdown=5)


if __name__ == '__main__':
    main()
