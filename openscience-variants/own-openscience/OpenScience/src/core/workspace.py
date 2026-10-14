"""Persistent research workspace, reimplemented from recovered Science route contracts."""
import asyncio
import base64
import binascii
import io
import hashlib
import json
import re
import shutil
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

router = APIRouter()
_lock = asyncio.Lock()
MAX_FILE = 16 * 1024 * 1024
MAX_JSON = 23 * 1024 * 1024
MAX_TEXT = 100000


def srv():
    from core import server
    return server


def now():
    return datetime.now(timezone.utc).isoformat()


def ident(value):
    if not isinstance(value, str) or not re.fullmatch(r'[a-f0-9]{16}', value):
        raise HTTPException(400, 'Invalid workspace ID')
    return value


def project(pid):
    ident(pid)
    path = srv().DATA / "projects" / pid / "project.json"
    p = json.loads(path.read_text()) if path.is_file() else None
    if p is None:
        raise HTTPException(404, 'Project not found')
    for key in ('artifacts', 'folders', 'notes', 'memories'):
        p.setdefault(key, [])
    return p


def persist(pid, p):
    p['updated_at'] = now()
    srv().atomic_json(srv().DATA / "projects" / pid / "project.json", p)


def item(p, collection, iid):
    ident(iid)
    for value in p[collection]:
        if value['id'] == iid:
            return value
    raise HTTPException(404, f'{collection.rstrip("s").capitalize()} not found in project')


def text(value, label, limit=MAX_TEXT, empty=False):
    if not isinstance(value, str) or len(value) > limit or (not empty and not value.strip()):
        raise HTTPException(400, f'{label} must be text between {0 if empty else 1} and {limit} characters')
    return value


def filename(value):
    value = text(value, 'Filename', 200)
    if value in ('.', '..') or any(c in value for c in '/\\\x00\r\n'):
        raise HTTPException(400, 'Filename must be a single file name')
    return value


async def body(request):
    method = getattr(request, 'method', 'GET')
    route = getattr(request, 'scope', {}).get('path', '')
    match = re.match(r'^/api/projects/([a-f0-9]{16})(/.*)?$', route)
    if match and method in ('POST', 'PUT', 'PATCH', 'DELETE') and not (method == 'DELETE' and not match[2]):
        require_active(match[1])
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > MAX_JSON:
            raise HTTPException(413, 'Request exceeds workspace size limit')
    try:
        value = json.loads(data)
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(400, 'Invalid JSON request')
    if not isinstance(value, dict):
        raise HTTPException(400, 'Request must be an object')
    return value


def payload(d):
    if 'content_base64' in d:
        if not isinstance(d['content_base64'], str):
            raise HTTPException(400, 'content_base64 must be text')
        try:
            content = base64.b64decode(d['content_base64'], validate=True)
        except (binascii.Error, ValueError):
            raise HTTPException(400, 'Invalid base64 content')
    else:
        content = text(d.get('content'), 'Content', MAX_FILE, empty=True).encode('utf-8')
    if len(content) > MAX_FILE:
        raise HTTPException(413, 'Artifact exceeds 16 MB limit')
    return content


def artifact_path(pid, aid, vid):
    ident(pid); ident(aid); ident(vid)
    root = (srv().DATA / 'projects' / pid / 'artifacts').resolve()
    path = root / aid / vid
    if not path.resolve().is_relative_to(root):
        raise HTTPException(400, 'Invalid artifact storage path')
    return path


def version(a, vid=None):
    vid = vid or a['current_version_id']
    ident(vid)
    for v in a['versions']:
        if v['id'] == vid:
            return v
    raise HTTPException(404, 'Artifact version not found')


def add_version(pid, a, content, metadata):
    vid = uuid.uuid4().hex[:16]
    path = artifact_path(pid, a['id'], vid)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    v = {'id': vid, 'created_at': now(), 'size': len(content), 'sha256': hashlib.sha256(content).hexdigest(), 'metadata': metadata, 'annotations': []}
    a['versions'].append(v)
    a['current_version_id'] = vid
    a['size'] = len(content)
    a['updated_at'] = now()
    return v


async def save_artifact(pid, filename_value, content, content_type='application/octet-stream', metadata=None, folder_id=None):
    require_active(pid)
    name = filename(filename_value)
    if not isinstance(content, bytes) or len(content) > MAX_FILE:
        raise HTTPException(413, 'Artifact exceeds 16 MB limit')
    content_type = text(content_type, 'Content type', 200)
    if not re.fullmatch(r'[A-Za-z0-9!#$&^_.+\-]+/[A-Za-z0-9!#$&^_.+\-]+(?:; charset=[A-Za-z0-9\-]+)?', content_type):
        raise HTTPException(400, 'Invalid content type')
    async with _lock:
        p = require_active(pid)
        if folder_id is not None:
            item(p, 'folders', folder_id)
        extraction = extract_pdf(content) if content_type == 'application/pdf' else None
        a = {'id': uuid.uuid4().hex[:16], 'project_id': pid, 'filename': name, 'content_type': content_type,
             'folder_id': folder_id, 'created_at': now(), 'versions': []}
        if extraction is not None:
            a['text_extraction'] = extraction
        add_version(pid, a, content, metadata or {})
        p['artifacts'].append(a)
        persist(pid, p)
        return a


@router.patch('/api/projects/{pid}')
async def patch_project(pid: str, request: Request):
    d = await body(request)
    if set(d) - {'name', 'description', 'context', 'memory_enabled', 'reviewer_enabled'}:
        raise HTTPException(400, 'Unsupported project field')
    async with _lock:
        p = project(pid)
        for key in ('name', 'description', 'context'):
            if key in d:
                p[key] = text(d[key], key, 200 if key == 'name' else MAX_TEXT, empty=key != 'name')
        if 'memory_enabled' in d:
            if not isinstance(d['memory_enabled'], bool):
                raise HTTPException(400, 'memory_enabled must be boolean')
            p['memory_enabled'] = d['memory_enabled']
        if 'reviewer_enabled' in d:
            if not isinstance(d['reviewer_enabled'], bool):
                raise HTTPException(400, 'reviewer_enabled must be boolean')
            p['reviewer_enabled'] = d['reviewer_enabled']
        persist(pid, p)
        index = srv().load()
        if pid in index.get('projects', {}):
            index['projects'][pid].update({k: p[k] for k in ('name', 'description', 'updated_at')})
            srv().save(index)
        return p


@router.get('/api/projects/{pid}/artifacts')
async def artifacts(pid: str):
    return {'artifacts': project(pid)['artifacts']}


@router.post('/api/projects/{pid}/attachments', status_code=201)
async def attachment(pid: str, request: Request):
    d = await body(request)
    return await save_artifact(pid, d.get('filename'), payload(d), d.get('content_type', 'application/octet-stream'),
                               {'origin': 'upload'}, d.get('folder_id'))


@router.get('/api/projects/{pid}/artifacts/{aid}')
@router.get('/api/projects/{pid}/artifacts/{aid}/download')
async def download(pid: str, aid: str, version_id: str | None = None, inline: bool = False):
    a = item(project(pid), 'artifacts', aid)
    v = version(a, version_id)
    path = artifact_path(pid, aid, v['id'])
    if not path.is_file():
        raise HTTPException(410, 'Stored artifact bytes are missing')
    from urllib.parse import quote
    response_headers = {'X-Content-Type-Options': 'nosniff'}
    if a['content_type'] == 'image/svg+xml':
        response_headers['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'; sandbox"
    return Response(path.read_bytes(), media_type=a['content_type'],
                    headers={**response_headers, 'Content-Disposition': ("inline" if inline and (a["content_type"] == "application/pdf" or a["content_type"].startswith("image/")) else "attachment") + "; filename*=UTF-8''" + quote(a['filename'])})


@router.get('/api/projects/{pid}/artifacts/{aid}/versions/{vid}')
async def download_version(pid: str, aid: str, vid: str):
    return await download(pid, aid, vid)


@router.get('/api/projects/{pid}/artifacts/{aid}/versions')
async def versions(pid: str, aid: str):
    return {'versions': item(project(pid), 'artifacts', aid)['versions']}


@router.post('/api/projects/{pid}/artifacts/{aid}/versions', status_code=201)
async def new_version(pid: str, aid: str, request: Request):
    d = await body(request)
    content = payload(d)
    async with _lock:
        p = project(pid)
        a = item(p, 'artifacts', aid)
        if d.get('parent_version_id') is not None and d['parent_version_id'] != a['current_version_id']:
            raise HTTPException(409, 'Artifact changed; reload its latest version before saving')
        if a['content_type'] == 'application/pdf':
            a['text_extraction'] = extract_pdf(content)
        v = add_version(pid, a, content, {'origin': 'edit'})
        persist(pid, p)
        return v


@router.patch('/api/projects/{pid}/artifacts/{aid}')
@router.patch('/api/projects/{pid}/artifacts/{aid}/rename')
@router.patch('/api/projects/{pid}/artifacts/{aid}/folder')
async def patch_artifact(pid: str, aid: str, request: Request):
    d = await body(request)
    if set(d) - {'filename', 'folder_id'}:
        raise HTTPException(400, 'Unsupported artifact field')
    async with _lock:
        p = project(pid); a = item(p, 'artifacts', aid)
        if 'filename' in d:
            a['filename'] = filename(d['filename'])
        if 'folder_id' in d:
            if d['folder_id'] is not None:
                item(p, 'folders', d['folder_id'])
            a['folder_id'] = d['folder_id']
        persist(pid, p)
        return a


@router.delete('/api/projects/{pid}/artifacts/{aid}')
async def delete_artifact(pid: str, aid: str):
    async with _lock:
        p = project(pid); a = item(p, 'artifacts', aid)
        p['artifacts'].remove(a)
        persist(pid, p)
        shutil.rmtree(artifact_path(pid, aid, a['current_version_id']).parent, ignore_errors=True)
        return {'deleted': aid}


@router.get('/api/projects/{pid}/folders')
async def folders(pid: str):
    return {'folders': project(pid)['folders']}


@router.post('/api/projects/{pid}/folders', status_code=201)
async def create_folder(pid: str, request: Request):
    d = await body(request)
    async with _lock:
        p = project(pid)
        parent = d.get('parent_id')
        if parent is not None:
            item(p, 'folders', parent)
        f = {'id': uuid.uuid4().hex[:16], 'name': text(d.get('name'), 'Folder name', 200), 'parent_id': parent}
        p['folders'].append(f); persist(pid, p)
        return f


@router.patch('/api/projects/{pid}/folders/{fid}')
async def update_folder(pid: str, fid: str, request: Request):
    d = await body(request)
    async with _lock:
        p = project(pid); f = item(p, 'folders', fid)
        if 'name' in d:
            f['name'] = text(d['name'], 'Folder name', 200)
        if 'parent_id' in d:
            parent = d['parent_id']; visited = {fid}
            while parent is not None:
                if parent in visited:
                    raise HTTPException(400, 'Folder hierarchy cannot contain a cycle')
                visited.add(parent); parent = item(p, 'folders', parent)['parent_id']
            f['parent_id'] = d['parent_id']
        persist(pid, p); return f


@router.delete('/api/projects/{pid}/folders/{fid}')
async def delete_folder(pid: str, fid: str):
    async with _lock:
        p = project(pid); item(p, 'folders', fid)
        descendants = {fid}
        while True:
            added = {f['id'] for f in p['folders'] if f['parent_id'] in descendants}
            if added.issubset(descendants):
                break
            descendants |= added
        p['folders'] = [f for f in p['folders'] if f['id'] not in descendants]
        for a in p['artifacts']:
            if a['folder_id'] in descendants:
                a['folder_id'] = None
        persist(pid, p); return {'deleted': sorted(descendants), 'artifacts_preserved': True}


@router.get('/api/projects/{pid}/notes')
async def notes(pid: str, q: str = ''):
    return {'notes': [n for n in project(pid)['notes'] if q.casefold() in n['content'].casefold()]}


@router.post('/api/projects/{pid}/notes', status_code=201)
async def create_note(pid: str, request: Request):
    d = await body(request)
    async with _lock:
        p = project(pid)
        if d.get('target_artifact_id'):
            item(p, 'artifacts', d['target_artifact_id'])
        n = {'id': uuid.uuid4().hex[:16], 'content': text(d.get('content'), 'Note'), 'created_at': now(),
             'target_artifact_id': d.get('target_artifact_id')}
        p['notes'].append(n); persist(pid, p); return n


@router.patch('/api/projects/{pid}/notes/{nid}')
async def update_note(pid: str, nid: str, request: Request):
    d = await body(request)
    async with _lock:
        p = project(pid); n = item(p, 'notes', nid)
        n['content'] = text(d.get('content'), 'Note'); n['updated_at'] = now()
        persist(pid, p); return n


@router.delete('/api/projects/{pid}/notes/{nid}')
async def delete_note(pid: str, nid: str):
    async with _lock:
        p = project(pid); p['notes'].remove(item(p, 'notes', nid)); persist(pid, p)
        return {'deleted': nid}


@router.get('/api/projects/{pid}/artifacts/{aid}/versions/{vid}/annotations')
async def annotations(pid: str, aid: str, vid: str):
    return {'annotations': version(item(project(pid), 'artifacts', aid), vid)['annotations']}


@router.post('/api/projects/{pid}/artifacts/{aid}/versions/{vid}/annotations', status_code=201)
async def create_annotation(pid: str, aid: str, vid: str, request: Request):
    d = await body(request)
    async with _lock:
        p = project(pid); v = version(item(p, 'artifacts', aid), vid)
        n = {'id': uuid.uuid4().hex[:16], 'content': text(d.get('content', d.get('text')), 'Annotation'),
             'created_at': now()}
        if 'selected_text' in d:
            n['selected_text'] = text(d['selected_text'], 'Selected text', 10000, empty=True)
        if 'selector' in d:
            if len(json.dumps(d['selector'])) > 10000:
                raise HTTPException(400, 'Annotation selector exceeds limit')
            n['selector'] = d['selector']
        v['annotations'].append(n); persist(pid, p); return n


@router.patch('/api/projects/{pid}/artifacts/{aid}/versions/{vid}/annotations/{nid}')
async def update_annotation(pid: str, aid: str, vid: str, nid: str, request: Request):
    d = await body(request)
    async with _lock:
        p = project(pid); v = version(item(p, 'artifacts', aid), vid)
        n = item({'annotations': v['annotations']}, 'annotations', nid)
        n['content'] = text(d.get('content', d.get('text')), 'Annotation')
        persist(pid, p); return n


@router.delete('/api/projects/{pid}/artifacts/{aid}/versions/{vid}/annotations/{nid}')
async def delete_annotation(pid: str, aid: str, vid: str, nid: str):
    async with _lock:
        p = project(pid); v = version(item(p, 'artifacts', aid), vid)
        v['annotations'].remove(item({'annotations': v['annotations']}, 'annotations', nid))
        persist(pid, p); return {'deleted': nid}


@router.get('/api/projects/{pid}/memories')
async def memories(pid: str):
    p = project(pid)
    return {'memories': p['memories'], 'enabled': p.get('memory_enabled', False)}


@router.get('/api/memories')
async def global_memories(project_id: str):
    return await memories(project_id)


@router.post('/api/projects/{pid}/memories', status_code=201)
async def create_memory(pid: str, request: Request):
    d = await body(request)
    return await memory_create(pid, d)


async def memory_create(pid, d):
    async with _lock:
        p = project(pid)
        m = {'id': uuid.uuid4().hex[:16], 'project_id': pid, 'text': text(d.get('text', d.get('content')), 'Memory', 20000),
             'created_at': now(), 'category': text(d.get('category', 'research'), 'Category', 100),
             'enabled': memory_enabled(d.get('enabled', True))}
        p['memories'].append(m); persist(pid, p); return m


@router.post('/api/memories', status_code=201)
async def global_memory_create(request: Request):
    d = await body(request)
    return await memory_create(ident(d.get('project_id')), d)


@router.patch('/api/projects/{pid}/memories/{mid}')
async def update_memory(pid: str, mid: str, request: Request):
    d = await body(request)
    async with _lock:
        p = project(pid); m = item(p, 'memories', mid)
        if 'text' in d or 'content' in d:
            m['text'] = text(d.get('text', d.get('content')), 'Memory', 20000)
        if 'enabled' in d:
            m['enabled'] = memory_enabled(d['enabled'])
        if 'category' in d:
            m['category'] = text(d['category'], 'Category', 100)
        persist(pid, p); return m


@router.delete('/api/projects/{pid}/memories/{mid}')
async def delete_memory(pid: str, mid: str):
    async with _lock:
        p = project(pid); p['memories'].remove(item(p, 'memories', mid)); persist(pid, p)
        return {'deleted': mid}


@router.get('/api/tools')
async def tools():
    return {'tools': srv().TOOLS}


@router.post('/api/projects/{pid}/tools')
async def direct_tool(pid: str, request: Request):
    d = await body(request); project(pid)
    name = d.get('name'); arguments = d.get('arguments')
    if name not in {t['name'] for t in srv().TOOLS} or not isinstance(arguments, dict):
        raise HTTPException(400, 'Choose an available tool and provide an arguments object')
    from . import sessions
    if d.get('frame_id'):
        frame = sessions.find(d['frame_id'])
        if frame['project_id'] != pid:
            raise HTTPException(404, 'Session not found in project')
        if frame['id'] in sessions._tasks:
            raise HTTPException(409, 'Session is running')
    else:
        frame = await sessions.create(sessions.NewFrame(project_id=pid, name='Direct science tools'))
    from .profiles import agent_tools
    if name not in {t['name'] for t in agent_tools(frame.get('agent_id'), srv().TOOLS)}:
        raise HTTPException(403, 'Tool is excluded for this research agent')
    execution = {'id':uuid.uuid4().hex[:16], 'kind':'tool', 'tool':name, 'arguments':arguments, 'status':'running', 'started_at':now()}
    frame['executions'].append(execution); sessions.write(frame)
    token = sessions.ACTIVE_FRAME.set(frame)
    try:
        result = await srv().run_tool(name, arguments, pid)
        if isinstance(result, dict) and (result.get('error') or result.get('success') is False):
            raise HTTPException(502, str(result.get('error', 'Scientific tool failed'))[:1000])
    except HTTPException as error:
        execution.update(status='failed', result={'success':False,'error':error.detail}); frame['status']='failed'; sessions.write(frame)
        raise
    except Exception:
        execution.update(status='failed', result={'success':False,'error':'Scientific service failed'}); frame['status']='failed'; sessions.write(frame)
        raise HTTPException(502, 'Scientific service failed to return a result')
    finally:
        sessions.ACTIVE_FRAME.reset(token)
    import sys, hashlib, importlib.metadata
    provenance = {'origin':'tool','tool':name,'arguments':arguments,'executed_at':now(),'frame_id':frame['id'],'execution_id':execution['id'],
                  'producer_source':srv().TOOL_PRODUCER_SOURCE,'producer_sha256':hashlib.sha256(srv().TOOL_PRODUCER_SOURCE.encode()).hexdigest(),'python_version':sys.version,
                  'packages':{name:importlib.metadata.version(name) for name in ('httpx','numpy','matplotlib','pandas')}}
    image = None
    image_name = re.sub(r'[^A-Za-z0-9._-]+', '-', str(arguments.get('title') or 'research-figure')).strip('-')[:120] or 'research-figure'
    if isinstance(result, dict) and result.get('image_base64'):
        try:
            image_bytes = base64.b64decode(result['image_base64'], validate=True)
        except (binascii.Error, ValueError, TypeError):
            raise HTTPException(502, 'Scientific tool returned invalid image bytes')
        if not image_bytes.startswith(b'\x89PNG\r\n\x1a\n'):
            raise HTTPException(502, 'Scientific tool returned an unsupported image format')
        image = await save_artifact(pid, image_name + '.png', image_bytes, 'image/png',
                                    provenance)
    content = json.dumps(result, ensure_ascii=False, indent=2, default=str).encode('utf-8')
    a = await save_artifact(pid, name + '-result.json', content, 'application/json',
                            provenance)
    execution.update(status='completed',finished_at=now(),result={'success':True,'artifact_id':a['id']}); frame['status']='completed'; sessions.write(frame)
    return {'result': result, 'artifact': a, 'artifacts': [a] + ([image] if image else [])}


@router.get('/api/projects/{pid}/export')
async def export_project(pid: str):
    async with _lock:
        p = project(pid); output = io.BytesIO(); total = 0
        with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
            archive.writestr('project.json', json.dumps(p, indent=2, ensure_ascii=False))
            session_root = srv().DATA / 'projects' / pid / 'sessions'
            for session in sorted(session_root.glob('*.json')):
                if not re.fullmatch(r'[a-f0-9]{16}\.json', session.name) or session.is_symlink():
                    continue
                data = session.read_bytes()
                total += len(data)
                if total > 128 * 1024 * 1024:
                    raise HTTPException(413, 'Project exceeds 128 MB export limit')
                archive.writestr('sessions/' + session.name, data)
            for a in p['artifacts']:
                for v in a['versions']:
                    path = artifact_path(pid, a['id'], v['id'])
                    if not path.is_file():
                        raise HTTPException(410, 'Export cannot include missing artifact bytes')
                    total += path.stat().st_size
                    if total > 128 * 1024 * 1024:
                        raise HTTPException(413, 'Project exceeds 128 MB export limit')
                    archive.write(path, f"artifacts/{a['id']}/{v['id']}/{a['filename']}")
        return Response(output.getvalue(), media_type='application/zip',
                        headers={'Content-Disposition': f'attachment; filename="project-{pid}.zip"'})


async def project_context(pid):
    async with _lock:
        p = project(pid)
        parts = ['Project context:\n' + p.get('context', '')]
        if p.get('memory_enabled', False):
            parts.append('Project memories:\n' + '\n'.join(m['text'] for m in p['memories'] if m.get('enabled', True)))
        for a in p['artifacts']:
            if a['content_type'] == 'application/pdf':
                extraction = a.get('text_extraction', {})
                if extraction.get('status') == 'extracted':
                    parts.append(f"Attachment {a['filename']} (PDF text):\n{extraction['text']}")
                else:
                    parts.append(f"Attachment {a['filename']}: PDF text unavailable ({extraction.get('status', 'not extracted')})")
                if sum(map(len, parts)) >= 40000:
                    break
                continue
            if not (a['content_type'].startswith('text/') or a['content_type'] == 'application/json'):
                continue
            path = artifact_path(pid, a['id'], a['current_version_id'])
            if path.is_file():
                with path.open('rb') as source:
                    content = source.read(12000).decode('utf-8', errors='replace')
                parts.append(f"Attachment {a['filename']}:\n{content}")
            if sum(map(len, parts)) >= 40000:
                break
        return '\n\n'.join(parts)[:40000]


@router.patch('/api/memories/{mid}')
@router.put('/api/memories/{mid}')
async def global_memory_update(mid: str, request: Request, project_id: str):
    return await update_memory(project_id, mid, request)


@router.delete('/api/memories/{mid}')
async def global_memory_delete(mid: str, project_id: str):
    return await delete_memory(project_id, mid)


def memory_enabled(value):
    if not isinstance(value, bool):
        raise HTTPException(400, 'enabled must be boolean')
    return value


@router.put('/api/projects/{pid}/memory/enabled')
async def enable_project_memory(pid: str, request: Request):
    d = await body(request)
    enabled = memory_enabled(d.get('enabled'))
    async with _lock:
        p = project(pid); p['memory_enabled'] = enabled; persist(pid, p)
        return {'enabled': enabled}


def extract_pdf(content):
    try:
        from pypdf import PdfReader
    except ImportError:
        return {'status': 'unavailable', 'reason': 'PDF text extraction requires pypdf'}
    try:
        reader = PdfReader(io.BytesIO(content))
        if reader.is_encrypted:
            return {'status': 'encrypted'}
        parts = []
        for index, page in enumerate(reader.pages[:50], start=1):
            page_text = (page.extract_text() or '')[:12000]
            if page_text.strip():
                parts.append(f'[Page {index}]\n{page_text}')
            if sum(map(len, parts)) >= 30000:
                break
        value = '\n'.join(parts)[:30000]
        return {'status': 'extracted' if value.strip() else 'no_text', 'text': value,
                'page_limit': 50, 'character_limit': 30000}
    except Exception:
        return {'status': 'invalid', 'reason': 'PDF text could not be extracted'}


def require_active(pid):
    value = project(pid)
    if value.get('status', 'active') != 'active':
        raise HTTPException(409, 'Reopen the project before changing its contents')
    return value

def project_busy(pid):
    from . import sessions, reviewer
    return any((srv().DATA / 'projects' / pid / 'sessions' / (fid + '.json')).exists()
               for fid in set(sessions._tasks) | set(reviewer._tasks))

async def stop_project_kernels(pid):
    from .kernels import interrupt
    for file in (srv().DATA / 'projects' / pid / 'sessions').glob('*.json'):
        await interrupt(file.stem)

def index_project(value):
    index = srv().load()
    index['projects'][value['id']] = {key: value.get(key) for key in
                                    ('id', 'name', 'description', 'created_at', 'updated_at', 'status', 'closed_at')}
    srv().save(index)

@router.post('/api/projects/{pid}/close')
async def close_project(pid: str):
    async with _lock:
        value = project(pid)
        if project_busy(pid):
            raise HTTPException(409, 'Stop the running session before closing the project')
        value.update(status='closed', closed_at=now()); persist(pid, value); index_project(value)
        await stop_project_kernels(pid)
        return {'id': pid, 'status': 'closed'}

@router.post('/api/projects/{pid}/reopen')
async def reopen_project(pid: str):
    async with _lock:
        value = project(pid); value.update(status='active', closed_at=None)
        persist(pid, value); index_project(value)
        return {'id': pid, 'status': 'active'}

@router.delete('/api/projects/{pid}')
async def delete_project(pid: str, request: Request):
    data = await body(request)
    async with _lock:
        value = project(pid)
        if data.get('confirm_name') != value['name']:
            raise HTTPException(400, 'Confirm deletion with the exact project name')
        if project_busy(pid):
            raise HTTPException(409, 'Stop the running session before deleting the project')
        destination = srv().DATA / 'trash/projects' / pid
        if destination.exists():
            raise HTTPException(409, 'A deleted project with this identity already exists')
        value.update(status='deleted', deleted_at=now()); persist(pid, value)
        await stop_project_kernels(pid)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(srv().DATA / 'projects' / pid), destination)
        index = srv().load(); index['projects'].pop(pid, None); srv().save(index)
        return {'id': pid, 'deleted': True, 'recoverable': True}

@router.get('/api/deleted-projects')
async def deleted_projects():
    rows = [json.loads(p.read_text()) for p in (srv().DATA / 'trash/projects').glob('*/project.json')]
    return {'projects': [{k: value.get(k) for k in ('id', 'name', 'deleted_at')} for value in rows]}

@router.post('/api/deleted-projects/{pid}/restore')
async def restore_project(pid: str):
    ident(pid)
    async with _lock:
        source = srv().DATA / 'trash/projects' / pid
        target = srv().DATA / 'projects' / pid
        if not (source / 'project.json').is_file():
            raise HTTPException(404, 'Deleted project not found')
        if target.exists():
            raise HTTPException(409, 'Project identity is already present')
        shutil.move(str(source), target)
        value = project(pid); value.update(status='active', closed_at=None); value.pop('deleted_at', None)
        persist(pid, value); index_project(value)
        return value
