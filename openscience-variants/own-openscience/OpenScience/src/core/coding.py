"""Project-bound repository editing and scientific artifact exchange."""
import asyncio
from contextlib import contextmanager
import hashlib
import mimetypes
import os
from pathlib import Path, PurePosixPath
import re
import stat
import uuid
from fastapi import APIRouter, HTTPException, Request
from . import workspace

router = APIRouter()
MAX_TEXT_BYTES = 2 * 1024 * 1024
MAX_GIT_BYTES = 2 * 1024 * 1024
EXCLUDED_DIRECTORIES = {'.git', 'node_modules', '.venv', 'venv', '__pycache__', 'dist', 'build'}


def configured(pid, write=False):
    config = workspace.project(pid).get('repository')
    if not isinstance(config, dict) or not config.get('path'):
        raise HTTPException(409, 'Choose a repository directory in project settings')
    root = Path(config['path'])
    if not root.is_absolute() or root.is_symlink() or not root.is_dir():
        raise HTTPException(410, 'Configured repository directory is unavailable')
    if write and not config.get('write_enabled', False):
        raise HTTPException(403, 'Repository editing is disabled; enable it in project settings')
    return root, config


def relative(value):
    if not isinstance(value, str) or not value or len(value) > 1000 or '\\' in value or any(c in value for c in '\x00\r\n'):
        raise HTTPException(400, 'Repository path must be a relative file path')
    path = PurePosixPath(value)
    if path.is_absolute() or any(p in ('.', '..', '.git') for p in value.split('/')) or any(not p for p in value.split('/')):
        raise HTTPException(400, 'Repository path cannot escape its directory or address Git internals')
    return path


@contextmanager
def parent_fd(root, name):
    parts = relative(name).parts
    descriptors = []
    try:
        flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
        fd = os.open(root, flags); descriptors.append(fd)
        for part in parts[:-1]:
            fd = os.open(part, flags, dir_fd=fd); descriptors.append(fd)
        yield fd, parts[-1]
    except FileNotFoundError:
        raise HTTPException(404, 'Repository file or parent directory not found')
    except OSError:
        raise HTTPException(400, 'Repository path must not contain symlinks or unsupported filesystem entries')
    finally:
        for fd in reversed(descriptors):
            os.close(fd)


def read_bytes(root, name, limit=MAX_TEXT_BYTES):
    with parent_fd(root, name) as (parent, leaf):
        try:
            fd = os.open(leaf, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
        except FileNotFoundError:
            raise HTTPException(404, 'Repository file not found')
        except OSError:
            raise HTTPException(400, 'Repository file must not be a symlink')
        with os.fdopen(fd, 'rb') as stream:
            info = os.fstat(stream.fileno())
            if not stat.S_ISREG(info.st_mode):
                raise HTTPException(400, 'Repository source must be a regular file')
            if info.st_size > limit:
                raise HTTPException(413, 'Repository file exceeds size limit')
            content = stream.read(limit + 1)
            if len(content) > limit:
                raise HTTPException(413, 'Repository file exceeds size limit')
            return content


def sha(content):
    return hashlib.sha256(content).hexdigest()


def write_bytes(root, name, content, previous_sha256=None, require_existing=False):
    if len(content) > workspace.MAX_FILE:
        raise HTTPException(413, 'Repository output exceeds 16 MB')
    with parent_fd(root, name) as (parent, leaf):
        mode = 0o644
        try:
            fd = os.open(leaf, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
        except FileNotFoundError:
            if require_existing or previous_sha256 is not None:
                raise HTTPException(409, 'Repository file no longer exists; reload before saving')
            existed = False
        except OSError:
            raise HTTPException(400, 'Repository output must not replace a symlink')
        else:
            existed = True
            with os.fdopen(fd, 'rb') as source:
                info = os.fstat(source.fileno())
                if not stat.S_ISREG(info.st_mode):
                    raise HTTPException(400, 'Repository output must be a regular file')
                if info.st_size > workspace.MAX_FILE:
                    raise HTTPException(413, 'Existing repository file exceeds 16 MB')
                existing = source.read(workspace.MAX_FILE + 1)
                if not previous_sha256 or sha(existing) != previous_sha256:
                    raise HTTPException(409, 'Repository file changed or would be overwritten; reload and supply its current SHA')
                mode = stat.S_IMODE(info.st_mode)
        temporary = '.science-write-' + uuid.uuid4().hex
        try:
            descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode, dir_fd=parent)
            with os.fdopen(descriptor, 'wb') as output:
                output.write(content); output.flush(); os.fsync(output.fileno())
            # New files use an exclusive hard-link admission rather than replace, avoiding accidental overwrite.
            if not existed:
                try:
                    os.link(temporary, leaf, src_dir_fd=parent, dst_dir_fd=parent, follow_symlinks=False)
                except FileExistsError:
                    raise HTTPException(409, 'Repository output appeared during saving; no file was overwritten')
            else:
                # Recheck immediately before atomic replacement to detect external editors changing bytes.
                current = os.open(leaf, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
                with os.fdopen(current, 'rb') as source:
                    if not stat.S_ISREG(os.fstat(source.fileno()).st_mode) or sha(source.read(workspace.MAX_FILE + 1)) != previous_sha256:
                        raise HTTPException(409, 'Repository file changed during saving')
                os.replace(temporary, leaf, src_dir_fd=parent, dst_dir_fd=parent)
        finally:
            try:
                os.unlink(temporary, dir_fd=parent)
            except FileNotFoundError:
                pass
    return {'path': str(relative(name)), 'sha256': sha(content), 'size': len(content)}


@router.get('/api/projects/{pid}/repository')
async def repository_settings(pid: str):
    return {'repository': workspace.project(pid).get('repository'), 'file_limit': 1000, 'text_size_limit': MAX_TEXT_BYTES}


@router.put('/api/projects/{pid}/repository')
async def configure(pid: str, request: Request):
    data = await workspace.body(request)
    value = data.get('path')
    if not isinstance(value, str) or not Path(value).is_absolute() or Path(value).is_symlink() or not Path(value).is_dir():
        raise HTTPException(400, 'Repository path must be an existing absolute directory')
    permission = data.get('write_enabled', False)
    if not isinstance(permission, bool):
        raise HTTPException(400, 'write_enabled must be boolean')
    async with workspace._lock:
        project = workspace.project(pid)
        project['repository'] = {'path': str(Path(value).resolve()), 'write_enabled': permission}
        workspace.persist(pid, project)
        return {'repository': project['repository']}


@router.get('/api/projects/{pid}/repository/files')
async def files(pid: str, limit: int = 500):
    root, config = configured(pid)
    if limit < 1 or limit > 1000:
        raise HTTPException(400, 'File list limit must be between 1 and 1000')
    entries = []
    pending = ['']
    visited = 0
    truncated = False
    while pending:
        directory = pending.pop()
        sentinel = directory + '/.science-list' if directory else '.science-list'
        with parent_fd(root, sentinel) as (directory_fd, _):
            with os.scandir(directory_fd) as children:
                for entry in children:
                    visited += 1
                    if visited > 10000 or len(entries) >= limit:
                        truncated = True
                        pending.clear(); break
                    if entry.is_symlink():
                        continue
                    name = directory + '/' + entry.name if directory else entry.name
                    if entry.is_dir(follow_symlinks=False):
                        if entry.name not in EXCLUDED_DIRECTORIES:
                            pending.append(name)
                    elif entry.is_file(follow_symlinks=False):
                        entries.append({'path': name, 'size': entry.stat(follow_symlinks=False).st_size})
    return {'files': sorted(entries, key=lambda x: x['path']), 'truncated': truncated, 'write_enabled': config['write_enabled']}


@router.get('/api/projects/{pid}/repository/file')
async def read_file(pid: str, path: str):
    root, _ = configured(pid)
    content = read_bytes(root, path)
    try:
        value = content.decode('utf-8')
    except UnicodeDecodeError:
        raise HTTPException(415, 'Repository editor supports UTF-8 text; import binary files as artifacts')
    return {'path': str(relative(path)), 'content': value, 'sha256': sha(content), 'size': len(content)}


@router.put('/api/projects/{pid}/repository/file')
async def save_file(pid: str, request: Request):
    data = await workspace.body(request)
    content = workspace.text(data.get('content'), 'File content', MAX_TEXT_BYTES, empty=True).encode('utf-8')
    if len(content) > MAX_TEXT_BYTES:
        raise HTTPException(413, 'Repository text exceeds 2 MB')
    previous = data.get('previous_sha256')
    if not isinstance(previous, str) or not re.fullmatch('[a-f0-9]{64}', previous):
        raise HTTPException(400, 'Saving requires the SHA of the version you read')
    async with workspace._lock:
        root, _ = configured(pid, write=True)
        return write_bytes(root, data.get('path'), content, previous, require_existing=True)


async def git_command(root, *args):
    env = {**{k: v for k, v in os.environ.items() if not k.startswith('GIT_')}, 'GIT_OPTIONAL_LOCKS': '0', 'GIT_TERMINAL_PROMPT': '0',
           'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': os.devnull}
    process = await asyncio.create_subprocess_exec('git', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=' + os.devnull,
                 *args, cwd=root, env=env, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    async def capture(stream):
        data = bytearray(); truncated = False
        while chunk := await stream.read(65536):
            if len(data) + len(chunk) > MAX_GIT_BYTES:
                truncated = True
            data.extend(chunk[:max(0, MAX_GIT_BYTES - len(data))])
        return bytes(data), truncated
    try:
        (stdout, truncated), (stderr, _) = await asyncio.wait_for(asyncio.gather(capture(process.stdout), capture(process.stderr)), 15)
        await process.wait()
        return process.returncode, stdout.decode('utf-8', errors='replace'), stderr.decode('utf-8', errors='replace'), truncated
    except (asyncio.TimeoutError, asyncio.CancelledError):
        if process.returncode is None:
            process.kill()
        await process.wait()
        raise


@router.get('/api/projects/{pid}/repository/git')
async def git_status(pid: str):
    root, _ = configured(pid)
    try:
        rc, top, error, _ = await git_command(root, 'rev-parse', '--show-toplevel')
        if rc or Path(top.strip()).resolve() != root:
            return {'available': False, 'error': 'Choose the root directory of a Git repository for Git inspection', 'status': '', 'diff': '', 'staged_diff': ''}
        rc, status_text, error, truncated = await git_command(root, 'status', '--porcelain=v1', '--untracked-files=normal')
        if rc:
            return {'available': False, 'error': error[:1000], 'status': '', 'diff': '', 'staged_diff': ''}
        _, diff, error, td = await git_command(root, 'diff', '--no-ext-diff', '--no-textconv', '--')
        _, staged, error, ts = await git_command(root, 'diff', '--cached', '--no-ext-diff', '--no-textconv', '--')
        return {'available': True, 'status': status_text, 'diff': diff, 'staged_diff': staged, 'truncated': truncated or td or ts}
    except FileNotFoundError:
        raise HTTPException(503, 'Git is unavailable')
    except asyncio.TimeoutError:
        raise HTTPException(504, 'Git inspection exceeded 15 seconds')


@router.post('/api/projects/{pid}/repository/import', status_code=201)
async def import_artifact(pid: str, request: Request):
    data = await workspace.body(request)
    root, _ = configured(pid)
    name = data.get('path')
    content = read_bytes(root, name, workspace.MAX_FILE)
    path = relative(name)
    artifact = await workspace.save_artifact(pid, path.name, content,
           mimetypes.guess_type(path.name)[0] or 'application/octet-stream',
           {'origin': 'repository-import', 'repository_path': str(root), 'relative_path': str(path), 'source_sha256': sha(content)})
    return {'artifact': artifact}


@router.post('/api/projects/{pid}/repository/export')
async def export_artifact(pid: str, request: Request):
    data = await workspace.body(request)
    async with workspace._lock:
        root, _ = configured(pid, write=True)
        project = workspace.project(pid)
        artifact = workspace.item(project, 'artifacts', data.get('artifact_id'))
        version = workspace.version(artifact, data.get('version_id'))
        source = workspace.artifact_path(pid, artifact['id'], version['id'])
        if not source.is_file():
            raise HTTPException(410, 'Artifact source bytes are missing')
        result = write_bytes(root, data.get('path'), source.read_bytes(), data.get('previous_sha256'))
        return {**result, 'artifact_id': artifact['id'], 'version_id': version['id']}
