"""Approved SSH and Modal research jobs with verified host keys and retained execution records."""
import asyncio
from datetime import datetime
import json
from pathlib import Path
import re
import time
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
router = APIRouter()
_active = {}

def backend():
    from . import server
    return server

def path():
    return backend().DATA / 'config/compute.json'

def load():
    from .profiles import read_private
    return read_private(path()) if path().exists() else {'hosts': {}, 'jobs': {}}

def save(data):
    from .profiles import write_private
    write_private(path(), data)

def now():
    return datetime.now().isoformat()

def job(identifier):
    value = load()['jobs'].get(identifier)
    if value is None:
        raise HTTPException(404, 'Compute job not found')
    return value

def put(value):
    data = load(); data['jobs'][value['id']] = value; save(data)

def host(identifier):
    value = load()['hosts'].get(identifier)
    if value is None:
        raise HTTPException(404, 'Compute host not found')
    return value

class Host(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    hostname: str = Field(min_length=1, max_length=253, pattern=r'^[A-Za-z0-9:.\-]+$')
    port: int = Field(default=22, ge=1, le=65535)
    username: str = Field(min_length=1, max_length=100, pattern=r'^[A-Za-z0-9_.\-]+$')
    key_file: str | None = None
    known_hosts_file: str | None = None

@router.get('/api/compute/providers')
async def providers():
    return {'providers': [public_provider(v) for v in load()['hosts'].values()]}

def public_provider(value):
    return {k: v for k, v in value.items() if k not in ('token_id', 'token_secret')}

class ModalProvider(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    token_id: str = Field(min_length=1, max_length=1000)
    token_secret: str = Field(min_length=1, max_length=1000)

@router.post('/api/compute/modal-provider')
async def create_modal(req: ModalProvider):
    value = {'id': uuid.uuid4().hex[:16], 'transport': 'modal', **req.model_dump()}
    data = load(); data['hosts'][value['id']] = value; save(data)
    return public_provider(value)

@router.post('/api/compute/ssh-hosts')
async def create_host(req: Host):
    value = {'id': uuid.uuid4().hex[:16], 'transport': 'ssh', **req.model_dump()}
    for key in ('key_file', 'known_hosts_file'):
        if value[key] and (not Path(value[key]).is_absolute() or not Path(value[key]).is_file()):
            raise HTTPException(400, key + ' requires an existing absolute file path')
    data = load(); data['hosts'][value['id']] = value; save(data)
    return value

@router.delete('/api/compute/providers/{identifier}')
async def delete_host(identifier: str):
    host(identifier)
    if any(j['host_id'] == identifier and j['status'] in ('running', 'submitted') for j in load()['jobs'].values()):
        raise HTTPException(409, 'Host has an active job')
    data = load(); del data['hosts'][identifier]; save(data)
    return {'deleted': identifier}

class NewJob(BaseModel):
    project_id: str
    host_id: str
    script: str = Field(min_length=1, max_length=100000)
    mode: str = 'shell'

@router.post('/api/compute/jobs')
async def create_job(req: NewJob):
    if not backend().get_proj(req.project_id):
        raise HTTPException(404, 'Project not found')
    provider = host(req.host_id)
    if req.mode not in ('shell', 'slurm', 'modal'):
        raise HTTPException(400, 'Mode must be shell, slurm or modal')
    if (req.mode == 'modal') != (provider.get('transport') == 'modal'):
        raise HTTPException(400, 'Job mode does not match provider transport')
    value = {'id': uuid.uuid4().hex[:16], **req.model_dump(), 'created_at': now(), 'status': 'awaiting_approval'}
    put(value)
    return value

def connect(value):
    import paramiko
    client = paramiko.SSHClient()
    client.load_system_host_keys()
    if value.get('known_hosts_file'):
        client.load_host_keys(value['known_hosts_file'])
    client.set_missing_host_key_policy(paramiko.RejectPolicy())
    try:
        client.connect(value['hostname'], port=value['port'], username=value['username'], key_filename=value.get('key_file'), timeout=10, auth_timeout=10, banner_timeout=10, look_for_keys=False, allow_agent=not bool(value.get('key_file')))
        return client
    except Exception:
        client.close()
        raise

def execute(identifier, config, command, script=None):
    client = connect(config)
    channel = None
    try:
        channel = client.get_transport().open_session(timeout=10)
        channel.settimeout(10)
        _active[identifier] = channel
        channel.exec_command(command)
        if script is not None:
            channel.sendall(script.encode())
        channel.shutdown_write()
        output, errors = bytearray(), bytearray()
        deadline = time.monotonic() + 60
        while not channel.exit_status_ready():
            if channel.closed:
                raise RuntimeError('SSH channel closed')
            if time.monotonic() > deadline:
                raise TimeoutError('SSH operation timed out')
            if channel.recv_ready():
                data = channel.recv(4096); output.extend(data[:max(0, 100000 - len(output))])
            if channel.recv_stderr_ready():
                data = channel.recv_stderr(4096); errors.extend(data[:max(0, 100000 - len(errors))])
            time.sleep(.01)
        while channel.recv_ready():
            data = channel.recv(4096); output.extend(data[:max(0, 100000 - len(output))])
        while channel.recv_stderr_ready():
            data = channel.recv_stderr(4096); errors.extend(data[:max(0, 100000 - len(errors))])
        return {'stdout': output.decode(errors='replace'), 'stderr': errors.decode(errors='replace'), 'exit_code': channel.recv_exit_status()}
    finally:
        _active.pop(identifier, None)
        if channel:
            channel.close()
        client.close()

def execute_modal(identifier, config, script):
    import modal
    client = modal.Client.from_credentials(config['token_id'], config['token_secret'])
    sandbox = None
    try:
        app = modal.App.lookup('openscience-research-jobs', client=client, create_if_missing=True)
        sandbox = modal.Sandbox.create('python', '-c', script, app=app,
            image=modal.Image.debian_slim(python_version='3.12'),
            cpu=1, memory=512, timeout=60, block_network=True, client=client)
        _active[identifier] = sandbox
        sandbox.wait()
        def retained(stream):
            chunks = []
            remaining = 100000
            for chunk in stream:
                chunks.append(chunk[:remaining])
                remaining = max(0, remaining - len(chunk))
            return ''.join(chunks)
        return {'stdout': retained(sandbox.stdout), 'stderr': retained(sandbox.stderr),
                'exit_code': sandbox.returncode, 'sandbox_id': sandbox.object_id}
    finally:
        _active.pop(identifier, None)
        try:
            if sandbox is not None:
                sandbox.terminate(wait=True)
        finally:
            client.__exit__(None, None, None)

async def receipt(value):
    from .workspace import save_artifact
    artifact = await save_artifact(value['project_id'], 'compute-' + value['id'] + '.json', json.dumps(value).encode(), 'application/json', metadata={'compute_job_id': value['id'], 'host_id': value['host_id'], 'transport': 'modal' if value['mode'] == 'modal' else 'ssh', 'script': value['script']})
    value['artifact_id'] = artifact['id']
    put(value)

@router.post('/api/compute/jobs/{identifier}/approve')
async def approve(identifier: str):
    value = job(identifier)
    if value['status'] != 'awaiting_approval':
        raise HTTPException(409, 'Job is not awaiting approval')
    value.update(status='running', approved_at=now()); put(value)
    try:
        if value['mode'] == 'modal':
            result = await asyncio.to_thread(execute_modal, identifier, host(value['host_id']), value['script'])
        else:
            result = await asyncio.to_thread(execute, identifier, host(value['host_id']), 'bash -s' if value['mode'] == 'shell' else 'sbatch --parsable', value['script'])
        value.update(result)
        if value['mode'] == 'slurm' and result['exit_code'] == 0:
            returned = result['stdout'].strip().split(';')[0]
            if not re.fullmatch(r'[0-9]+', returned):
                raise ValueError('Invalid scheduler job ID')
            value.update(status='submitted', scheduler_id=returned)
        else:
            value['status'] = 'completed' if result['exit_code'] == 0 else 'failed'
    except Exception:
        value.update(status='failed', error='Modal job failed; verify credentials and account availability' if value['mode'] == 'modal' else 'SSH job failed; verify host key, authentication and service availability')
    current = job(identifier)
    if current['status'] == 'cancelled':
        value['status'] = 'cancelled'
        for key in ('remote_termination_confirmed', 'cancellation_scope'):
            if key in current:
                value[key] = current[key]
    value['finished_at'] = now(); put(value)
    await receipt(value)
    return value

@router.get('/api/compute/jobs')
async def jobs(project_id: str | None = None):
    return {'jobs': [j for j in load()['jobs'].values() if project_id is None or j['project_id'] == project_id]}

@router.get('/api/compute/jobs/{identifier}')
async def status(identifier: str):
    value = job(identifier)
    if value['status'] == 'submitted':
        try:
            result = await asyncio.to_thread(execute, identifier, host(value['host_id']), 'squeue --noheader --format=%T --jobs=' + value['scheduler_id'])
            value['scheduler_state'] = result['stdout'].strip() if result['exit_code'] == 0 else 'unavailable'
            value['scheduler_status_error'] = result['stderr'] if result['exit_code'] else None
        except Exception:
            value['scheduler_state'] = 'unavailable'
            value['scheduler_status_error'] = 'SSH scheduler status unavailable'
        put(value)
    return value

@router.post('/api/compute/jobs/{identifier}/cancel')
async def cancel(identifier: str):
    value = job(identifier)
    if value['status'] == 'submitted':
        result = await asyncio.to_thread(execute, identifier, host(value['host_id']), 'scancel ' + value['scheduler_id'])
        if result['exit_code']:
            raise HTTPException(502, 'Scheduler refused cancellation')
    elif value['status'] == 'running':
        channel = _active.get(identifier)
        if not channel:
            raise HTTPException(409, 'SSH channel not yet available; retry cancellation')
        if value['mode'] == 'modal':
            await asyncio.to_thread(channel.terminate, wait=True)
            value['remote_termination_confirmed'] = True
            value['cancellation_scope'] = 'Owned Modal sandbox terminated'
        else:
            channel.close()
            value['remote_termination_confirmed'] = False
            value['cancellation_scope'] = 'Owned SSH channel closed; remote process termination is not confirmed'
    elif value['status'] != 'awaiting_approval':
        raise HTTPException(409, 'Job is no longer active')
    value['status'] = 'cancelled'; put(value)
    return value
