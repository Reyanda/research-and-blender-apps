"""Request-local events and provider-reported usage, shared by all adapters."""
import json
import uuid
from contextvars import ContextVar
from fastapi import APIRouter
from . import workspace

router = APIRouter()
SINK = ContextVar('response_events', default=None)

def emit(kind, **value):
    sink = SINK.get()
    if sink is not None:
        sink.put_nowait({'type': kind, **value})

def record(profile, result):
    from .sessions import ACTIVE_FRAME
    frame = ACTIVE_FRAME.get() or {}
    row = {'id': uuid.uuid4().hex, 'created_at': workspace.now(),
           'provider_id': profile['id'], 'model': result.get('model'),
           'frame_id': frame.get('id'), 'project_id': frame.get('project_id'),
           'usage': result.get('usage') or {}, 'basis': 'provider_reported',
           'cost': None}
    path = workspace.srv().DATA / 'usage' / (row['id'] + '.json')
    workspace.srv().atomic_json(path, row)
    emit('usage', receipt=row)

@router.get('/api/usage')
async def usage():
    rows = [json.loads(p.read_text()) for p in (workspace.srv().DATA / 'usage').glob('*.json')]
    totals = {}
    for row in rows:
        summary = totals.setdefault(row['provider_id'], {'requests': 0, 'input_tokens': 0, 'output_tokens': 0, 'unreported_requests': 0})
        summary['requests'] += 1
        value = row['usage']
        incoming = value.get('input_tokens', value.get('prompt_tokens'))
        outgoing = value.get('output_tokens', value.get('completion_tokens'))
        if incoming is None or outgoing is None:
            summary['unreported_requests'] += 1
        for key, count in [('input_tokens', incoming), ('output_tokens', outgoing)]:
            if isinstance(count, int) and count >= 0:
                summary[key] += count
    return {'providers': totals, 'receipts': sorted(rows, key=lambda r: r['created_at'], reverse=True), 'billing': 'Provider invoice and account limits are external; no cost is inferred.'}
