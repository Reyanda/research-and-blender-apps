"""Incremental OpenAI-compatible and Anthropic events with tool assembly."""
import json
from fastapi import HTTPException
from .events import emit

async def response(client, url, headers, payload, anthropic=False):
    payload = {**payload, 'stream': True}
    if not anthropic:
        payload['stream_options'] = {'include_usage': True}
    text, calls, usage, model, finish = [], {}, {}, payload['model'], None
    received = 0
    async with client.stream('POST', url, headers=headers, json=payload, timeout=300) as reply:
        if reply.status_code != 200:
            raise HTTPException(502, f'Model provider returned HTTP {reply.status_code}')
        async for line in reply.aiter_lines():
            if not line.startswith('data:'):
                continue
            data = line[5:].strip()
            received += len(data)
            if received > 4 * 1024 * 1024:
                raise HTTPException(502, 'Provider stream exceeded 4 MB')
            if data == '[DONE]':
                break
            try:
                value = json.loads(data)
                if value.get('error') or value.get('type') == 'error':
                    raise HTTPException(502, 'Model stream reported an error')
                delta = ''
                if anthropic:
                    kind = value.get('type')
                    index = value.get('index', 0)
                    if kind == 'message_start':
                        msg = value['message']; model = msg.get('model', model); usage.update(msg.get('usage', {}))
                    elif kind == 'content_block_start' and value['content_block']['type'] == 'tool_use':
                        block = value['content_block']
                        calls[index] = {'id': block['id'], 'name': block['name'], 'json': ''}
                    elif kind == 'content_block_delta':
                        block = value['delta']; delta = block.get('text', '')
                        if block.get('type') == 'input_json_delta':
                            calls[index]['json'] += block['partial_json']
                    elif kind == 'message_delta':
                        usage.update(value.get('usage', {})); finish = value['delta'].get('stop_reason')
                else:
                    model = value.get('model', model)
                    if value.get('usage'):
                        usage.update(value['usage'])
                    for choice in value.get('choices', []):
                        if choice.get('finish_reason'):
                            finish = choice['finish_reason']
                        part = choice.get('delta', {}); delta += part.get('content') or ''
                        for call in part.get('tool_calls', []):
                            target = calls.setdefault(call['index'], {'id': '', 'name': '', 'json': ''})
                            target['id'] += call.get('id') or ''
                            target['name'] += call.get('function', {}).get('name') or ''
                            target['json'] += call.get('function', {}).get('arguments') or ''
                if delta:
                    text.append(delta); emit('text_delta', text=delta)
            except (ValueError, KeyError, TypeError) as error:
                raise HTTPException(502, 'Invalid incremental provider response') from error
    assembled = []
    for call in calls.values():
        try:
            args = json.loads(call['json'] or '{}')
            if not call['id'] or not call['name'] or not isinstance(args, dict):
                raise ValueError()
            assembled.append({'id': call['id'], 'name': call['name'], 'arguments': args})
        except ValueError as error:
            raise HTTPException(502, 'Incomplete streamed tool arguments') from error
    if not finish:
        raise HTTPException(502, 'Provider stream ended without a completion receipt')
    return {'content': ''.join(text), 'tool_calls': assembled or None, 'usage': usage, 'model': model, 'finish_reason': finish}
