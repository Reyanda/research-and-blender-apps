"""Explicitly configured MCP clients; only granted tools are callable."""
import asyncio
from contextlib import asynccontextmanager
import hashlib
import json
import os
from pathlib import Path
import re
import uuid
from urllib.parse import urlsplit
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
router = APIRouter()

def backend():
    from core import server
    return server

def load():
    path = backend().DATA / 'config/mcp.json'
    from core.profiles import read_private
    return read_private(path) if path.exists() else {}

def save(data):
    path = backend().DATA / 'config/mcp.json'
    from core.profiles import write_private
    write_private(path, data)

def get(identifier):
    value = load().get(identifier)
    if value is None:
        raise HTTPException(404, 'MCP connector not found')
    return value

def public(value):
    return {k: v for k, v in value.items() if k not in ('headers', 'env')} | {'header_names': list(value.get('headers', {})), 'environment_names': list(value.get('env', {}))}

class Config(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    transport: str
    url: str | None = None
    command: str | None = None
    args: list[str] = Field(default_factory=list, max_length=100)
    headers: dict[str, str] = Field(default_factory=dict)
    env: dict[str, str] = Field(default_factory=dict)
    enabled: bool = False
    allowed_tools: list[str] = Field(default_factory=list, max_length=200)

def validate(value):
    if value['transport'] == 'stdio':
        command = value.get('command') or ''
        if not Path(command).is_absolute() or not Path(command).is_file() or not os.access(command, os.X_OK):
            raise HTTPException(400, 'Stdio requires an existing absolute executable path')
    elif value['transport'] == 'http':
        url = urlsplit(value.get('url') or '')
        if url.scheme not in ('http', 'https') or not url.hostname or url.username or url.password:
            raise HTTPException(400, 'HTTP requires a URL without embedded credentials')
    else:
        raise HTTPException(400, 'Transport must be http or stdio')
    if any(len(v) > 100000 for v in [*value['headers'].values(), *value['env'].values(), *value['args']]):
        raise HTTPException(400, 'Configuration value is too large')

@router.get('/api/mcp/connectors')
async def connectors():
    return {'connectors': [public(v) for v in load().values()]}

@router.post('/api/mcp/connectors')
async def create(req: Config):
    value = {'id': uuid.uuid4().hex[:16], **req.model_dump()}
    validate(value)
    data = load(); data[value['id']] = value; save(data)
    return public(value)

@router.patch('/api/mcp/connectors/{identifier}')
async def update(identifier: str, body: dict):
    value = get(identifier)
    if set(body) - set(Config.model_fields):
        raise HTTPException(400, 'Unknown connector fields')
    value = {'id': identifier, **Config(**{**value, **body}).model_dump()}
    validate(value)
    data = load(); data[identifier] = value; save(data)
    return public(value)

@router.delete('/api/mcp/connectors/{identifier}')
async def delete(identifier: str):
    get(identifier)
    data = load(); del data[identifier]; save(data)
    return {'deleted': identifier}

@asynccontextmanager
async def connection(config):
    from mcp import Client
    if config['transport'] == 'stdio':
        from mcp.client.stdio import stdio_client, StdioServerParameters
        transport = stdio_client(StdioServerParameters(command=config['command'], args=config['args'], env=config['env']))
        async with transport as streams:
            @asynccontextmanager
            async def adapted():
                yield streams
            async with Client(adapted(), read_timeout_seconds=15) as client:
                yield client
    else:
        import httpx2
        from mcp.client.streamable_http import streamable_http_client
        async with httpx2.AsyncClient(headers=config['headers'], timeout=15) as http:
            async with streamable_http_client(config['url'], http_client=http) as streams:
                @asynccontextmanager
                async def adapted():
                    yield streams
                async with Client(adapted(), read_timeout_seconds=15) as client:
                    yield client

async def listed(config):
    if not config['enabled']:
        raise HTTPException(403, 'Connector is disabled')
    try:
        async with asyncio.timeout(20):
            async with connection(config) as client:
                result = await client.list_tools()
                tools = [t.model_dump(by_alias=True) for t in result.tools]
                cursor = result.next_cursor
                while cursor:
                    page = await client.list_tools(cursor=cursor)
                    tools.extend(t.model_dump(by_alias=True) for t in page.tools)
                    cursor = page.next_cursor
                    if len(tools) > 1000:
                        raise HTTPException(502, 'Connector tool catalog exceeds limit')
                return tools
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(502, 'MCP connector discovery failed')

@router.get('/api/mcp/connectors/{identifier}/tools')
async def tools(identifier: str):
    value = get(identifier)
    return {'tools': await listed(value)}

class Call(BaseModel):
    tool: str = Field(min_length=1, max_length=200)
    arguments: dict = Field(default_factory=dict)
    project_id: str

async def invoke(config, tool, arguments, pid):
    if not config['enabled'] or tool not in config['allowed_tools']:
        raise HTTPException(403, 'Tool has no explicit connector grant')
    if not backend().get_proj(pid):
        raise HTTPException(404, 'Project not found')
    if len(json.dumps(arguments).encode()) > 256000:
        raise HTTPException(413, 'Tool arguments exceed limit')
    try:
        async with asyncio.timeout(30):
            async with connection(config) as client:
                result = (await client.call_tool(tool, arguments)).model_dump(by_alias=True)
        from core.workspace import save_artifact
        artifact = await save_artifact(pid, 'mcp-' + hashlib.sha256(tool.encode()).hexdigest()[:12] + '.json', json.dumps(result).encode(), 'application/json', metadata={'connector_id': config['id'], 'tool': tool})
        return {'result': result, 'artifact_id': artifact['id']}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(502, 'MCP tool call failed')

@router.post('/api/mcp/connectors/{identifier}/call')
async def call(identifier: str, req: Call):
    return await invoke(get(identifier), req.tool, req.arguments, req.project_id)

def tool_name(identifier, name):
    return 'mcp_' + identifier + '_' + hashlib.sha256(name.encode()).hexdigest()[:20]

async def model_tools(agent_id=None):
    from core import profiles
    agent = profiles.selected(agent_id)
    result = []
    for config in load().values():
        if not config['enabled'] or not config['allowed_tools'] or not profiles.connector_allowed(agent_id, config['id']):
            continue
        try:
            for tool in await listed(config):
                name = tool_name(config['id'], tool['name'])
                if tool['name'] not in config['allowed_tools'] or agent and name in agent['excluded_tools']:
                    continue
                result.append({'name': name, 'description': config['name'] + ': ' + (tool.get('description') or tool['name']), 'input_schema': tool['inputSchema']})
        except HTTPException:
            continue
    return result

async def run(name, args, pid, agent_id=None):
    from core import profiles
    agent = profiles.selected(agent_id)
    if agent and name in agent['excluded_tools']:
        raise HTTPException(403, 'Tool excluded for research agent')
    for config in load().values():
        for original in config['allowed_tools']:
            if tool_name(config['id'], original) == name:
                if not profiles.connector_allowed(agent_id, config['id']):
                    raise HTTPException(403, 'Connector excluded for research agent')
                return await invoke(config, original, args, pid)
    raise HTTPException(404, 'MCP tool not found')
