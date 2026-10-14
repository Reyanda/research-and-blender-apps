"""Project-scoped bridge to the user's maintained Medantir review engine."""
import asyncio
import json
import os
from pathlib import Path
import secrets
import shutil
import uuid
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()
_process = None
_origin = None
_token = None
_lock = asyncio.Lock()
FAMILIES = ['systematic', 'intervention', 'diagnostic-accuracy', 'overall-prognosis',
            'prognostic-factor', 'prediction-model', 'prevalence-incidence', 'qualitative',
            'mixed-methods', 'scoping', 'rapid', 'umbrella', 'living', 'network-meta-analysis',
            'adverse-effects', 'economic', 'implementation', 'mechanistic', 'animal',
            'environmental', 'evidence-map']

def backend():
    from . import server
    return server

def engine_path():
    default = Path.home() / 'Documents/SWE/apps/medantir/medantir-review/dist/src/server.js'
    return Path(os.environ.get('OPENSCIENCE_MEDANTIR_ENGINE', str(default))).expanduser().resolve()

def index_path(pid):
    backend().validate_pid(pid)
    if not backend().get_proj(pid):
        raise HTTPException(404, 'Project not found')
    return backend().DATA / 'projects' / pid / 'medantir-runs.json'

def index(pid):
    path = index_path(pid)
    return json.loads(path.read_text()) if path.exists() else []

@router.get('/api/reviews/runtime')
async def runtime():
    return {'installed': engine_path().is_file() and bool(shutil.which('node')),
            'running': _process is not None and _process.returncode is None,
            'engine': 'Medantir', 'mode': 'live', 'families': FAMILIES}

async def start():
    global _process, _origin, _token
    async with _lock:
        if _process is not None and _process.returncode is None:
            return
        path = engine_path()
        node = shutil.which('node')
        if not node or not path.is_file():
            raise HTTPException(503, 'Build Medantir review engine with npm ci and npm run build, or set OPENSCIENCE_MEDANTIR_ENGINE to its built server.js')
        _token = secrets.token_urlsafe(32)
        data = backend().DATA / 'review-engine'
        data.mkdir(parents=True, exist_ok=True, mode=0o700)
        program = '''
const {startServer} = await import(process.env.SCIENCE_REVIEW_MODULE);
const identityProvider = { async authenticate(req) {
  const projectId = req.headers['x-actiora-project'];
  if(req.headers.authorization !== 'Bearer '+process.env.SCIENCE_REVIEW_TOKEN ||
     typeof projectId !== 'string' || !/^[a-f0-9]{16}$/.test(projectId))
    throw Object.assign(new Error('Authenticated Science project required'),{status:401});
  return {sub:'openscience-local', projectId};
}};
const server = await startServer(0,{identityProvider,runsFile:process.env.SCIENCE_REVIEW_RUNS});
console.log(JSON.stringify({scienceReviewPort:server.port}));
'''
        env = {**os.environ, 'REVIEW_LIVE': '1', 'HOST': '127.0.0.1',
               'SCIENCE_REVIEW_MODULE': path.as_uri(), 'SCIENCE_REVIEW_TOKEN': _token,
               'SCIENCE_REVIEW_RUNS': str(data / 'runs.json')}
        _process = await asyncio.create_subprocess_exec(node, '--input-type=module', '-e', program,
                    env=env, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL)
        try:
            async def ready():
                for _ in range(50):
                    line = await _process.stdout.readline()
                    if not line: break
                    try:
                        port = json.loads(line).get('scienceReviewPort')
                    except ValueError:
                        continue
                    if isinstance(port, int) and 0 < port < 65536:
                        return 'http://127.0.0.1:' + str(port)
                raise HTTPException(502, 'Medantir did not report readiness')
            _origin = await asyncio.wait_for(ready(), 20)
            # Drain the owned child's logs without retaining potentially sensitive output.
            asyncio.create_task(drain(_process.stdout))
        except BaseException:
            await shutdown()
            raise

async def drain(stream):
    while await stream.read(65536):
        pass

async def shutdown():
    global _process, _origin, _token
    if _process is not None and _process.returncode is None:
        _process.terminate()
        try: await asyncio.wait_for(_process.wait(), 10)
        except asyncio.TimeoutError: _process.kill(); await _process.wait()
    _process = _origin = _token = None

async def upstream(pid, method, path, body=None):
    index_path(pid)
    await start()
    try:
        async with httpx.AsyncClient(follow_redirects=False) as client:
            response = await client.request(method, _origin + path, json=body,
                headers={'Authorization': 'Bearer ' + _token, 'X-Actiora-Project': pid}, timeout=45)
        result = response.json()
    except (httpx.HTTPError, ValueError):
        raise HTTPException(502, 'Medantir review service is unavailable')
    if response.status_code >= 400:
        raise HTTPException(response.status_code, 'Medantir rejected the action; inspect the run stage and required submission')
    return result

class Review(BaseModel):
    question: str = Field(min_length=10, max_length=10000)
    review_type: str = 'systematic'
    databases: list[str] = Field(default_factory=lambda: ['europepmc', 'openalex'], max_length=10)

@router.get('/api/projects/{pid}/reviews')
async def listing(pid: str):
    return {'reviews': index(pid)}

@router.post('/api/projects/{pid}/reviews', status_code=202)
async def create(pid: str, req: Review):
    if req.review_type not in FAMILIES or not req.databases or any(d not in ['europepmc', 'openalex', 'pubmed', 'crossref'] for d in req.databases):
        raise HTTPException(400, 'Choose a supported review family and database')
    request = {'question': {'title': req.question[:140], 'objective': req.question, 'concepts': [req.question]},
               'reviewType': req.review_type, 'databases': req.databases,
               'autoApproveHumanGates': False, 'dualScreening': True,
               'humanVerification': {'enabled': True, 'mode': 'blinded'},
               'protocolDevelopment': {'searchPeerReviewRequired': True, 'searchPeerReviewCompleted': False},
               'registration': {'enabled': False}}
    result = await upstream(pid, 'POST', '/runs', request)
    if not isinstance(result.get('runId'), str):
        raise HTTPException(502, 'Medantir returned no run identity')
    async with _lock:
        values = index(pid)
        values.append({'id': uuid.uuid4().hex[:16], 'run_id': result['runId'],
                       'question': req.question, 'review_type': req.review_type})
        backend().atomic_json(index_path(pid), values)
    return {'review': values[-1], 'state': result}

def bound(pid, rid):
    backend().validate_pid(rid)
    value = next((v for v in index(pid) if v['id'] == rid), None)
    if value is None: raise HTTPException(404, 'Review not found in this project')
    return value

@router.get('/api/projects/{pid}/reviews/{rid}')
async def get(pid: str, rid: str):
    value = bound(pid, rid)
    return {'review': value, 'state': await upstream(pid, 'GET', '/runs/' + value['run_id'])}

@router.post('/api/projects/{pid}/reviews/{rid}/snapshot')
async def snapshot(pid: str, rid: str):
    from .workspace import save_artifact
    data = await get(pid, rid)
    artifact = await save_artifact(pid, 'review-' + rid + '.json', json.dumps(data, indent=2).encode(),
        'application/json', {'origin': 'medantir-review', 'run_id': data['review']['run_id'],
                             'engine': str(engine_path()), 'mode': 'live'})
    return {'artifact': artifact}

@router.post('/api/projects/{pid}/reviews/{rid}/handoff/{action}')
async def handoff(pid: str, rid: str, action: str, submission: dict):
    if action not in ['clarification', 'risk-of-bias', 'grade', 'verification']:
        raise HTTPException(400, 'Unsupported review handoff')
    value = bound(pid, rid)
    return await upstream(pid, 'POST', '/runs/' + value['run_id'] + '/' + action, submission)
