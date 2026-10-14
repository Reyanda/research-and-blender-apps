"""User-authored research agent prompts, skills and tool restrictions."""
import json
import re
import uuid
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
router = APIRouter()

def private_key(path, create=False):
    from cryptography.fernet import Fernet
    key = path.parent / 'vault.key'
    if not key.exists():
        if not create:
            raise RuntimeError('Credential vault key is missing; restore its original key')
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        try:
            descriptor = os.open(key, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError:
            pass
        else:
            with os.fdopen(descriptor, 'wb') as handle:
                handle.write(Fernet.generate_key())
    return Fernet(key.read_bytes())

def read_private(path):
    value = json.loads(path.read_text())
    if value.get('encryption') == 'fernet-v1':
        return json.loads(private_key(path).decrypt(value['ciphertext'].encode()))
    return value

def write_private(path, value):
    token = private_key(path, create=True).encrypt(json.dumps(value).encode()).decode()
    server().atomic_json(path, {'encryption':'fernet-v1', 'ciphertext':token})

def server():
    from . import server as backend
    return backend

def load():
    path = server().DATA / 'config/profiles.json'
    return json.loads(path.read_text()) if path.exists() else {'agents': {}, 'skills': {}}

def save(value):
    server().atomic_json(server().DATA / 'config/profiles.json', value)

def selected(identifier):
    if not identifier:
        return None
    data = load()
    agent = data['agents'].get(identifier) or next((a for a in data['agents'].values() if a['name'] == identifier), None)
    if not agent:
        raise HTTPException(404, 'Research agent not found')
    return agent

def agent_context(identifier):
    agent = selected(identifier)
    if agent is None:
        return None
    skills = load()['skills']
    text = [agent['system_prompt']]
    for name in agent['skill_names']:
        skill = skills.get(name)
        if skill and skill['enabled']:
            text.append('Research skill: ' + name + '\n' + skill['content'])
    return '\n\n'.join(text)

def agent_tools(identifier, tools):
    agent = selected(identifier)
    return [dict(t) for t in tools if agent is None or t['name'] not in agent['excluded_tools']]

def connector_allowed(identifier, connector):
    agent = selected(identifier)
    return agent is None or not agent['connector_ids'] or connector in agent['connector_ids']

class Agent(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    system_prompt: str = Field(default='', max_length=50000)
    skill_names: list[str] = Field(default_factory=list, max_length=100)
    connector_ids: list[str] = Field(default_factory=list, max_length=100)
    excluded_tools: list[str] = Field(default_factory=list, max_length=100)

class AgentPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    system_prompt: str | None = Field(default=None, max_length=50000)
    skill_names: list[str] | None = Field(default=None, max_length=100)
    connector_ids: list[str] | None = Field(default=None, max_length=100)
    excluded_tools: list[str] | None = Field(default=None, max_length=100)

class Skill(BaseModel):
    name: str = Field(min_length=1, max_length=100, pattern=r'^[A-Za-z0-9][A-Za-z0-9_-]*$')
    content: str = Field(min_length=1, max_length=100000)
    enabled: bool = True

class Toggle(BaseModel):
    enabled: bool

@router.get('/api/agents')
async def agents():
    return {'agents': list(load()['agents'].values())}

@router.post('/api/agents')
async def create_agent(req: Agent):
    data = load()
    if any(a['name'] == req.name for a in data['agents'].values()):
        raise HTTPException(409, 'An agent with this name already exists')
    value = {'id': uuid.uuid4().hex[:16], **req.model_dump()}
    data['agents'][value['id']] = value
    save(data)
    return value

@router.patch('/api/agents/{identifier}')
async def update_agent(identifier: str, req: AgentPatch):
    agent = selected(identifier)
    data = load()
    changes = req.model_dump(exclude_none=True)
    if 'name' in changes and any(a['name'] == changes['name'] and a['id'] != agent['id'] for a in data['agents'].values()):
        raise HTTPException(409, 'An agent with this name already exists')
    agent.update(changes)
    data['agents'][agent['id']] = agent
    save(data)
    return agent

@router.delete('/api/agents/{identifier}')
async def delete_agent(identifier: str):
    agent = selected(identifier)
    data = load()
    del data['agents'][agent['id']]
    save(data)
    return {'deleted': agent['id']}

@router.get('/api/skills/catalog')
async def skills():
    return {'skills': list(load()['skills'].values())}

@router.post('/api/skills/catalog')
async def create_skill(req: Skill):
    data = load()
    data['skills'][req.name] = req.model_dump()
    save(data)
    return data['skills'][req.name]

def skill(name):
    value = load()['skills'].get(name)
    if value is None:
        raise HTTPException(404, 'Skill not found')
    return value

@router.get('/api/skills/catalog/{name}/content')
async def skill_content(name: str):
    return skill(name)

@router.get('/api/skills/catalog/{name}/files')
async def skill_files(name: str):
    value = skill(name)
    return {'files': [{'name': 'SKILL.md', 'content': value['content']}]}

@router.put('/api/skills/catalog/{name}/enabled')
async def enable_skill(name: str, req: Toggle):
    value = skill(name)
    value['enabled'] = req.enabled
    data = load()
    data['skills'][name] = value
    save(data)
    return value

@router.delete('/api/skills/catalog/{name}')
async def delete_skill(name: str):
    skill(name)
    data = load()
    del data['skills'][name]
    for agent in data['agents'].values():
        agent['skill_names'] = [n for n in agent['skill_names'] if n != name]
    save(data)
    return {'deleted': name}
