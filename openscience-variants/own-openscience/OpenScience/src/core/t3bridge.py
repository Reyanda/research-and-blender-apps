"""Local T3 runtime connection; coding accounts remain managed by T3."""
import asyncio
import os
import shutil
from urllib.parse import urlsplit
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
router = APIRouter()
_owned = None

def backend():
    from . import server
    return server

def load():
    from .profiles import read_private
    path = backend().DATA / 'config/workbench.json'
    return read_private(path) if path.exists() else {'t3_url': 'http://127.0.0.1:8420', 'appearance': 'system', 'density': 'compact'}

class Settings(BaseModel):
    t3_url: str = 'http://127.0.0.1:8420'
    appearance: str = 'system'
    density: str = 'compact'

@router.get('/api/settings/workbench')
async def settings():
    return load()

@router.put('/api/settings/workbench')
async def update(req: Settings):
    url = urlsplit(req.t3_url)
    if url.scheme != 'http' or url.hostname not in ('127.0.0.1','localhost','::1') or url.username or url.password or url.query or url.fragment or url.path not in ('','/'):
        raise HTTPException(400, 'Choose a local T3 HTTP origin')
    if req.appearance not in ('light','dark','system') or req.density not in ('compact','comfortable'):
        raise HTTPException(400, 'Unsupported appearance or density')
    from .profiles import write_private
    value=req.model_dump();value['t3_url']=value['t3_url'].rstrip('/')
    write_private(backend().DATA / 'config/workbench.json', value)
    return value

@router.get('/api/coding/runtime')
async def status():
    config=load()
    try:
        async with httpx.AsyncClient() as client:
            response=await client.get(config['t3_url']+'/.well-known/t3/environment',timeout=3)
        descriptor=response.json() if response.status_code==200 else None
        connected=isinstance(descriptor,dict) and isinstance(descriptor.get('environmentId'),str) and isinstance(descriptor.get('serverVersion'),str)
    except (httpx.HTTPError,ValueError):
        descriptor=None;connected=False
    return {'url':config['t3_url'],'connected':connected,'descriptor':descriptor,'installed':bool(shutil.which('t3')),
            'providers':['Codex','Claude','Cursor','Grok Build','OpenCode','Antigravity'],
            'settings_url':config['t3_url']+'/settings/providers','owned':_owned is not None and _owned.returncode is None}

@router.post('/api/coding/runtime/start')
async def start():
    global _owned
    current=await status()
    if current['connected']:return current
    command=shutil.which('t3')
    if not command:raise HTTPException(503,'Install T3 Code before starting coding agents')
    url=urlsplit(load()['t3_url'])
    _owned=await asyncio.create_subprocess_exec(command,'start','--mode','desktop','--host','127.0.0.1','--port',str(url.port or 8420),'--no-browser',stdout=asyncio.subprocess.DEVNULL,stderr=asyncio.subprocess.DEVNULL)
    for _ in range(60):
        if _owned.returncode is not None:raise HTTPException(502,'T3 exited during startup; inspect its account configuration')
        await asyncio.sleep(.25)
        current=await status()
        if current['connected']:return current
    raise HTTPException(504,'T3 startup did not become ready')

async def shutdown():
    global _owned
    if _owned and _owned.returncode is None:
        _owned.terminate()
        try:await asyncio.wait_for(_owned.wait(),10)
        except asyncio.TimeoutError:_owned.kill();await _owned.wait()
    _owned=None

@router.post('/api/coding/runtime/pair')
async def pair():
    import re
    command=shutil.which('t3')
    if not command:raise HTTPException(503,'T3 CLI is unavailable')
    process=await asyncio.create_subprocess_exec(command,'pair','--ttl','5m','--label','Science workspace',stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
    try:
        out,err=await asyncio.wait_for(process.communicate(),30)
    except asyncio.TimeoutError:
        process.kill();await process.wait();raise HTTPException(504,'T3 pairing timed out')
    value=re.sub(r'\x1b\[[0-9;]*m','',out.decode(errors='replace'))
    candidates=re.findall(r'https?://[^\s\x1b]+',value)
    origin=load()['t3_url']
    for candidate in candidates:
        parsed=urlsplit(candidate)
        if candidate.startswith(origin+'/') and parsed.path=='/pair' and parsed.fragment.startswith('token='):
            return {'pairing_url':candidate,'expires_in_seconds':300}
    raise HTTPException(502,'T3 did not issue a pairing link for this configured local runtime')
