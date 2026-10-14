"""Encrypted model profiles and explicit provider protocol adapters."""
import json
import uuid
from urllib.parse import urlsplit
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
router = APIRouter()
PRESETS = {
    'openai': 'https://api.openai.com/v1',
    'deepseek': 'https://api.deepseek.com/v1',
    'openrouter': 'https://openrouter.ai/api/v1',
    'gemini': 'https://generativelanguage.googleapis.com/v1beta/openai',
    'ollama': 'http://127.0.0.1:11434/v1',
    'anthropic': 'https://api.anthropic.com/v1',
}

def backend():
    from . import server
    return server

def path():
    return backend().DATA / 'config/providers.json'

def legacy():
    server = backend()
    return {'id': 'legacy-deepseek', 'name': 'DeepSeek', 'kind': 'deepseek', 'base_url': server.DS_URL,
            'api_key': server.API_KEY, 'model': server._models[0], 'models': list(server._models), 'enabled': True}

def load():
    from .profiles import read_private
    if path().exists():
        return read_private(path())
    value = legacy()
    return {'profiles': {value['id']: value}, 'default_id': value['id']}

def save(data):
    from .profiles import write_private
    write_private(path(), data)

def public(profile):
    return {k: v for k, v in profile.items() if k != 'api_key'} | {'authenticated': bool(profile.get('api_key'))}

def selected(provider_id=None):
    data = load()
    value = data['profiles'].get(provider_id or data.get('default_id'))
    if not value:
        raise HTTPException(404, 'Model provider not found')
    if not value['enabled']:
        raise HTTPException(403, 'Model provider is disabled')
    return value

class Provider(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    kind: str = 'custom'
    base_url: str | None = None
    api_key: str = Field(default='', max_length=10000)
    model: str = Field(min_length=1, max_length=200)
    models: list[str] = Field(default_factory=list, max_length=1000)
    enabled: bool = True

class ProviderPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    kind: str | None = None
    base_url: str | None = None
    api_key: str | None = Field(default=None, max_length=10000)
    model: str | None = Field(default=None, min_length=1, max_length=200)
    models: list[str] | None = Field(default=None, max_length=1000)
    enabled: bool | None = None

def normalize(value):
    if value['kind'] not in (*PRESETS, 'custom', 'openai-compatible'):
        raise HTTPException(400, 'Unsupported model provider protocol')
    value['base_url'] = (value.get('base_url') or PRESETS.get(value['kind']) or '').rstrip('/')
    url = urlsplit(value['base_url'])
    if url.scheme not in ('http', 'https') or not url.hostname or url.username or url.password or url.query or url.fragment:
        raise HTTPException(400, 'Provider requires an HTTP URL without embedded credentials')
    value['models'] = list(dict.fromkeys([value['model'], *value['models']]))
    return value

@router.get('/api/providers')
async def providers():
    data = load()
    return {'providers': [public(v) for v in data['profiles'].values()], 'default_id': data.get('default_id'), 'kinds': list(PRESETS) + ['custom']}

@router.post('/api/providers')
async def create(req: Provider):
    value = normalize({'id': uuid.uuid4().hex[:16], **req.model_dump()})
    data = load(); data['profiles'][value['id']] = value; save(data)
    return public(value)

@router.patch('/api/providers/{identifier}')
async def update(identifier: str, req: ProviderPatch):
    data = load()
    value = data['profiles'].get(identifier)
    if not value:
        raise HTTPException(404, 'Model provider not found')
    changes = req.model_dump(exclude_none=True)
    if 'kind' in changes and 'base_url' not in changes:
        changes['base_url'] = PRESETS.get(changes['kind'])
    value = normalize({**value, **changes}); data['profiles'][identifier] = value; save(data)
    return public(value)

@router.delete('/api/providers/{identifier}')
async def delete(identifier: str):
    data = load()
    if identifier not in data['profiles']:
        raise HTTPException(404, 'Model provider not found')
    del data['profiles'][identifier]
    if data.get('default_id') == identifier:
        data['default_id'] = next(iter(data['profiles']), None)
    save(data)
    return {'deleted': identifier, 'default_id': data['default_id']}

@router.put('/api/providers/{identifier}/default')
async def choose_default(identifier: str):
    selected(identifier)
    data = load(); data['default_id'] = identifier; save(data)
    return {'default_id': identifier}

def http_client():
    return httpx.AsyncClient(follow_redirects=False)

def headers(profile):
    if profile['kind'] == 'anthropic':
        return {'x-api-key': profile['api_key'], 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json'}
    return {'Content-Type': 'application/json', **({'Authorization': 'Bearer ' + profile['api_key']} if profile['api_key'] else {})}

async def discover(identifier):
    profile = selected(identifier)
    try:
        async with http_client() as client:
            result = await client.get(profile['base_url'] + '/models', headers=headers(profile), timeout=15)
        if result.status_code != 200:
            raise HTTPException(502, f'Model discovery returned HTTP {result.status_code}')
        found = [v['id'] for v in result.json()['data'] if isinstance(v.get('id'), str)]
        if not found:
            raise HTTPException(502, 'Provider returned no model identifiers')
        data = load(); data['profiles'][profile['id']]['models'] = list(dict.fromkeys([profile['model'], *found])); save(data)
        return {'models': found, 'provider_id': profile['id']}
    except HTTPException:
        raise
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        raise HTTPException(502, 'Model discovery unavailable or invalid')

@router.get('/api/providers/{identifier}/models')
async def models(identifier: str):
    return await discover(identifier)

@router.post('/api/providers/{identifier}/test')
async def test(identifier: str):
    return {'connected': True, **await discover(identifier)}

def schema(tool):
    return tool.get('input_schema') or {'type': 'object', 'properties': {k: {'type': 'string', 'description': v} for k, v in tool.get('parameters', {}).items()}, 'required': [k for k, v in tool.get('parameters', {}).items() if 'optional' not in v.lower()]}

def anthropic_messages(messages):
    system, history = [], []
    for message in messages:
        role, content = message['role'], message.get('content')
        if role == 'system':
            system.append(content or '')
            continue
        if role == 'tool':
            role = 'user'
            blocks = [{'type': 'tool_result', 'tool_use_id': message['tool_call_id'], 'content': content or ''}]
        else:
            blocks = [{'type': 'text', 'text': content}] if content else []
            for call in message.get('tool_calls', []):
                function = call['function']
                arguments = function['arguments']
                blocks.append({'type': 'tool_use', 'id': call['id'], 'name': function['name'], 'input': json.loads(arguments) if isinstance(arguments, str) else arguments})
        if not blocks:
            continue
        if history and history[-1]['role'] == role:
            history[-1]['content'].extend(blocks)
        else:
            history.append({'role': role, 'content': blocks})
    return '\n\n'.join(system), history

async def chat(messages, tools=None, model=None, provider_id=None):
    profile = selected(provider_id)
    chosen = model or profile['model']
    if not profile['api_key'] and profile['kind'] not in ('ollama', 'custom', 'openai-compatible'):
        raise HTTPException(503, 'Configure an API key for the selected model provider')
    try:
        if profile['kind'] == 'anthropic':
            system, history = anthropic_messages(messages)
            payload = {'model': chosen, 'messages': history, 'max_tokens': 16384}
            if system: payload['system'] = system
            if tools: payload['tools'] = [{'name': t['name'], 'description': t.get('description', ''), 'input_schema': schema(t)} for t in tools]
            endpoint = '/messages'
        else:
            payload = {'model': chosen, 'messages': messages, 'max_tokens': 16384, 'temperature': 0.7, 'stream': False}
            if tools: payload['tools'] = [{'type': 'function', 'function': {'name': t['name'], 'description': t.get('description', ''), 'parameters': schema(t)}} for t in tools]
            endpoint = '/chat/completions'
        async with http_client() as client:
            response = await client.post(profile['base_url'] + endpoint, headers=headers(profile), json=payload, timeout=300)
        if response.status_code != 200:
            raise HTTPException(502, f'Model provider returned HTTP {response.status_code}')
        body = response.json()
        if profile['kind'] == 'anthropic':
            content = ''.join(v['text'] for v in body['content'] if v['type'] == 'text')
            calls = [{'id': v['id'], 'name': v['name'], 'arguments': v['input']} for v in body['content'] if v['type'] == 'tool_use']
            return {'content': content, 'tool_calls': calls or None, 'usage': body.get('usage', {}), 'model': body.get('model', chosen), 'finish_reason': body.get('stop_reason')}
        choice = body['choices'][0]
        message = choice['message']
        calls = [{'id': t['id'], 'name': t['function']['name'], 'arguments': json.loads(t['function']['arguments'])} for t in message.get('tool_calls', [])]
        return {'content': message.get('content') or '', 'tool_calls': calls or None, 'usage': body.get('usage', {}), 'model': body.get('model', chosen), 'finish_reason': choice.get('finish_reason', 'stop')}
    except HTTPException:
        raise
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError):
        raise HTTPException(502, 'Model provider returned an invalid or unavailable response')
