"""Local research sessions using the existing provider and restricted tool loop."""
import asyncio
from contextvars import ContextVar
from datetime import datetime
import json
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()
ACTIVE_FRAME = ContextVar('science_frame', default=None)
_tasks = {}

def backend():
    from . import server
    return server

def now():
    return datetime.now().isoformat()

def frame_path(pid, fid):
    backend().validate_pid(pid)
    backend().validate_pid(fid)
    return backend().DATA / 'projects' / pid / 'sessions' / (fid + '.json')

def write(frame):
    frame['updated_at'] = now()
    backend().atomic_json(frame_path(frame['project_id'], frame['id']), frame)

def find(fid):
    backend().validate_pid(fid)
    for p in (backend().DATA / 'projects').glob('*/sessions/' + fid + '.json'):
        frame = json.loads(p.read_text())
        if frame['status'] == 'running' and fid not in _tasks:
            frame['status'] = 'interrupted'
            write(frame)
        return frame
    raise HTTPException(404, 'Session not found')

def context_project(pid):
    frame = ACTIVE_FRAME.get()
    if frame is None or frame['project_id'] != pid:
        return None
    path = backend().DATA / 'projects' / pid / 'project.json'
    project = json.loads(path.read_text())
    return {**project, **frame, 'description': frame.get('context', '')}

def context_save(pid, project):
    frame = ACTIVE_FRAME.get()
    if frame is None or frame['project_id'] != pid:
        return False
    frame['messages'] = project['messages']
    write(frame)
    return True

def complete_history(messages):
    """Drop unfinished tool groups before sending history back to a provider."""
    complete = []
    index = 0
    while index < len(messages):
        item = messages[index]
        calls = item.get('tool_calls')
        if calls:
            ids = {call['id'] for call in calls}
            end = index + 1
            results = set()
            while end < len(messages) and messages[end]['role'] == 'tool':
                results.add(messages[end].get('tool_call_id'))
                end += 1
            if results == ids:
                complete.extend(messages[index:end])
            index = end
        else:
            if item['role'] != 'tool':
                complete.append(item)
            index += 1
    return complete

class NewFrame(BaseModel):
    project_id: str
    name: str = Field(default='New session', min_length=1, max_length=200)

class Message(BaseModel):
    input_data: str = Field(min_length=1, max_length=100000)
    model: str | None = None
    plan_mode: bool = False
    target_agent: str | None = None
    provider_id: str | None = None

class Rename(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    task_summary: str | None = None

class Fork(BaseModel):
    message_index: int = Field(ge=0)
    name: str = Field(default='Branch', min_length=1, max_length=200)
    edited_content: str | None = None

class Approval(BaseModel):
    edited_plan: str | None = Field(default=None, max_length=100000)

class Cell(BaseModel):
    language: str = 'python'
    code: str = Field(min_length=1, max_length=100000)

@router.post('/api/frames')
async def create(req: NewFrame):
    project = backend().get_proj(req.project_id)
    if not project:
        raise HTTPException(404, 'Project not found')
    existing = list((backend().DATA / 'projects' / req.project_id / 'sessions').glob('*.json'))
    history = complete_history(json.loads(json.dumps(project.get('messages', [])))) if not existing else []
    frame = {'id': uuid.uuid4().hex[:16], 'project_id': req.project_id,
             'name': req.name, 'context': project.get('context', project.get('description', '')),
             'messages': history, 'executions': [], 'status': 'idle', 'created_at': now()}
    write(frame)
    return frame

@router.get('/api/projects/{pid}/benches')
async def benches(pid: str):
    if not backend().get_proj(pid):
        raise HTTPException(404, 'Project not found')
    frames = [find(p.stem) for p in (backend().DATA / 'projects' / pid / 'sessions').glob('*.json')]
    return {'benches': sorted(frames, key=lambda f: f['updated_at'], reverse=True)}

@router.get('/api/frames/{fid}')
async def get(fid: str):
    return find(fid)

@router.get('/api/frames/{fid}/messages')
async def messages(fid: str):
    return {'messages': find(fid)['messages']}

async def operation(frame, req):
    token = ACTIVE_FRAME.set(frame)
    try:
        from . import profiles
        chosen = req.target_agent if req.target_agent is not None else frame.get('agent_id')
        agent = profiles.selected(chosen)
        frame['agent_id'] = agent['id'] if agent else None
        extra_system = profiles.agent_context(frame['agent_id'])
        if req.provider_id is not None:
            frame['provider_id'] = req.provider_id
        from .providers import selected
        provider = selected(frame.get('provider_id'))
        frame['model'] = req.model or frame.get('model') or provider['model']
        frame['messages'] = complete_history(frame['messages'])
        frame['last_request'] = req.input_data
        frame['last_plan_mode'] = req.plan_mode
        frame['status'] = 'running'
        write(frame)
        if req.plan_mode:
            response = await backend().llm_chat([
                {'role': 'system', 'content': 'Write a concrete research plan. Do not perform tools or execute code. Explain needed inputs and outputs.' + ('\n' + extra_system if extra_system else '')},
                {'role': 'user', 'content': req.input_data}], model=frame['model'])
            if response.get('tool_calls'):
                raise HTTPException(502, 'Planning response attempted tool execution')
            frame['plan'] = response.get('content') or ''
            if not frame['plan'].strip():
                raise HTTPException(502, 'Planning response was empty')
            frame['messages'].extend([{'role': 'user', 'content': req.input_data}, {'role': 'assistant', 'content': frame['plan'], 'kind': 'plan'}])
            frame['status'] = 'awaiting_approval'
            return {'response': frame['plan'], 'tool_results': [], 'status': frame['status']}
        result = await backend().converse(frame['project_id'], req.input_data, model=frame['model'], extra_system=extra_system)
        frame['status'] = 'completed'
        return {**result, 'status': frame['status']}
    except asyncio.CancelledError:
        frame['status'] = 'cancelled'
        raise
    except Exception as error:
        frame['status'] = 'failed'
        frame['error'] = error.detail if isinstance(error, HTTPException) else 'Research operation failed'
        raise
    finally:
        write(frame)
        ACTIVE_FRAME.reset(token)

async def start(frame, req):
    fid = frame['id']
    if fid in _tasks:
        raise HTTPException(409, 'Session already running')
    task = asyncio.create_task(operation(frame, req))
    _tasks[fid] = task
    try:
        return await task
    except asyncio.CancelledError:
        return {'status': 'cancelled', 'response': '', 'tool_results': []}
    finally:
        _tasks.pop(fid, None)
        if find(fid)['status'] == 'completed':
            from .reviewer import schedule
            schedule(fid)

@router.post('/api/frames/{fid}/message')
async def message(fid: str, req: Message):
    frame = find(fid)
    if frame['status'] == 'awaiting_approval':
        raise HTTPException(409, 'Approve or discard the pending plan first')
    return await start(frame, req)

@router.post('/api/frames/{fid}/cancel')
async def cancel(fid: str):
    frame = find(fid)
    task = _tasks.get(fid)
    if task:
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
    else:
        frame['status'] = 'cancelled'
        write(frame)
    from .kernels import interrupt
    await interrupt(fid)
    return {'status': 'cancelled'}

@router.post('/api/frames/{fid}/resume')
async def resume(fid: str):
    frame = find(fid)
    if frame['status'] not in ('cancelled', 'failed', 'interrupted') or not frame.get('last_request'):
        raise HTTPException(409, 'Session has no interrupted request to resume')
    return await start(frame, Message(input_data='Continue the interrupted research request: ' + frame['last_request'], model=frame.get('model'), plan_mode=frame.get('last_plan_mode', False)))

@router.post('/api/frames/{fid}/approve-plan')
async def approve(fid: str, req: Approval):
    frame = find(fid)
    if frame['status'] != 'awaiting_approval':
        raise HTTPException(409, 'No plan awaits approval')
    plan = req.edited_plan if req.edited_plan is not None else frame['plan']
    if not plan.strip():
        raise HTTPException(400, 'Plan cannot be empty')
    frame['approved_plan'] = plan
    return await start(frame, Message(input_data='Execute this approved research plan:\n' + plan, model=frame.get('model')))

@router.post('/api/frames/{fid}/discard-plan')
async def discard(fid: str):
    frame = find(fid)
    if frame['status'] != 'awaiting_approval':
        raise HTTPException(409, 'No plan awaits approval')
    frame['status'] = 'idle'
    frame.pop('plan', None)
    write(frame)
    return frame

@router.patch('/api/frames/{fid}')
@router.patch('/api/benches/{fid}')
async def rename(fid: str, req: Rename):
    frame = find(fid)
    if fid in _tasks:
        raise HTTPException(409, 'Session is running')
    frame.update(req.model_dump(exclude_none=True))
    write(frame)
    return frame

@router.post('/api/frames/{fid}/fork')
async def fork(fid: str, req: Fork):
    source = find(fid)
    if fid in _tasks:
        raise HTTPException(409, 'Wait for session to finish before branching')
    history = source['messages']
    if req.message_index >= len(history):
        raise HTTPException(400, 'Message index is outside transcript')
    stop = req.message_index + 1
    while stop < len(history) and (history[stop - 1].get('tool_calls') or history[stop]['role'] == 'tool'):
        stop += 1
    selected = json.loads(json.dumps(history[:stop]))
    if req.edited_content is not None:
        if history[req.message_index]['role'] != 'user':
            raise HTTPException(400, 'Only user messages may be edited when branching')
        selected = selected[:req.message_index + 1]
        selected[-1]['content'] = req.edited_content
    frame = {**source, 'id': uuid.uuid4().hex[:16], 'name': req.name, 'messages': selected,
             'executions': [], 'status': 'idle', 'parent_frame_id': fid, 'created_at': now()}
    for key in ('plan', 'approved_plan', 'last_request', 'error'):
        frame.pop(key, None)
    write(frame)
    return frame

async def execute_tool_cell(frame, code, language):
    """Run a model-requested cell in the same persistent session kernel."""
    from .kernels import execute as kernel_execute
    entry = {'id': uuid.uuid4().hex[:16], 'language': language, 'code': code,
             'started_at': now(), 'status': 'running', 'origin': 'agent-tool'}
    frame['executions'].append(entry)
    write(frame)
    try:
        result = await kernel_execute(frame['id'], frame['project_id'], code,
                                      language=language, execution_id=entry['id'])
        entry.update(result=result, status='completed' if result.get('success') else 'failed')
        return result
    except asyncio.CancelledError:
        entry.update(status='cancelled', result={'success': False, 'error': 'Execution cancelled'})
        raise
    except Exception as error:
        entry.update(status='failed', result={'success': False, 'error': error.detail if isinstance(error, HTTPException) else 'Execution service failed'})
        raise
    finally:
        entry['finished_at'] = now()
        write(frame)

@router.get('/api/frames/{fid}/notebook')
async def notebook(fid: str, language: str = 'python'):
    from fastapi.responses import Response
    if language not in {'python', 'r'}:
        raise HTTPException(400, 'Choose Python or R')
    frame = find(fid)
    cells = []
    for index, entry in enumerate(e for e in frame['executions'] if e.get('language') == language):
        result = entry.get('result', {})
        outputs = []
        for stream in ('stdout', 'stderr'):
            if result.get(stream):
                outputs.append({'output_type': 'stream', 'name': stream, 'text': result[stream]})
        if result.get('error'):
            outputs.append({'output_type': 'error', 'ename': entry.get('status', 'failed'), 'evalue': str(result['error']), 'traceback': []})
        cells.append({'id': entry['id'], 'cell_type': 'code', 'execution_count': index + 1,
                      'metadata': {'openscience': entry}, 'source': entry['code'], 'outputs': outputs})
    value = {'nbformat': 4, 'nbformat_minor': 5, 'cells': cells,
             'metadata': {'kernelspec': {'name': 'python3' if language == 'python' else 'ir',
                          'display_name': 'Python 3' if language == 'python' else 'R', 'language': language},
                          'openscience': {'frame_id': fid, 'project_id': frame['project_id']}}}
    return Response(json.dumps(value), media_type='application/x-ipynb+json',
                    headers={'Content-Disposition': 'attachment; filename="session-' + language + '.ipynb"'})

@router.post('/api/frames/{fid}/execute')
@router.post('/api/frames/{fid}/kernel-exec')
async def execute(fid: str, req: Cell):
    frame = find(fid)
    if fid in _tasks:
        raise HTTPException(409, 'Session is running')
    entry = {'id': uuid.uuid4().hex[:16], 'language': req.language, 'code': req.code, 'started_at': now(), 'status': 'running'}
    frame['executions'].append(entry)
    write(frame)
    async def run_cell():
        frame['status'] = 'running'
        write(frame)
        try:
            from . import profiles
            allowed = {tool['name'] for tool in profiles.agent_tools(frame.get('agent_id'), backend().TOOLS)}
            if req.language.lower() not in {'python', 'r'}:
                result = {'success': False, 'error': 'This language is unavailable; choose Python or R'}
            elif ('run_r' if req.language.lower() == 'r' else 'run_python') not in allowed:
                result = {'success': False, 'error': 'Python execution is excluded for this research agent'}
            else:
                from .kernels import execute as kernel_execute
                result = await kernel_execute(fid, frame['project_id'], req.code, language=req.language.lower(), execution_id=entry['id'])
            entry.update(result=result, status='completed' if result.get('success') else 'failed', finished_at=now())
        except asyncio.CancelledError:
            entry.update(result={'success': False, 'error': 'Execution cancelled'}, status='cancelled', finished_at=now())
        except HTTPException as error:
            entry.update(result={'success': False, 'error': error.detail}, status='failed', finished_at=now())
        except Exception:
            entry.update(result={'success': False, 'error': 'Execution service failed'}, status='failed', finished_at=now())
        finally:
            frame['status'] = entry['status']
            write(frame)
        return entry
    task = asyncio.create_task(run_cell())
    _tasks[fid] = task
    try:
        return await task
    finally:
        _tasks.pop(fid, None)

@router.get('/api/frames/{fid}/execution-log')
@router.get('/api/frames/{fid}/executions')
async def executions(fid: str):
    return {'executions': find(fid)['executions']}
