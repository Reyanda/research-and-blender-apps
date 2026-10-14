"""Owned persistent Python kernels inside opt-in restricted Docker containers."""
import asyncio
import io
import json
import os
import shutil
import tarfile
import tempfile
import uuid
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request
from . import workspace

router = APIRouter()
TIMEOUT = 60
MAX_OUTPUT = 65536
MAX_FILES = 32
MAX_OUTPUT_BYTES = 32 * 1024 * 1024
_kernels = {}
_start_lock = asyncio.Lock()

# User namespace stays persistent; protocol writes to the original output stream.
WORKER = r'''
import contextlib, io, json, sys, traceback
namespace = {'__name__': '__main__'}
protocol = sys.stdout
class Capture(io.StringIO):
    def write(self, value):
        remaining = 65536 - self.tell()
        if remaining > 0:
            super().write(value[:remaining])
        return len(value)
for line in sys.stdin:
    try:
        request = json.loads(line)
        stdout, stderr = Capture(), Capture()
        success = True
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            try:
                exec(compile(request['code'], '<science-cell>', 'exec'), namespace, namespace)
            except BaseException:
                success = False
                traceback.print_exc(limit=10)
        protocol.write(json.dumps({'success': success, 'stdout': stdout.getvalue(), 'stderr': stderr.getvalue()}) + '\n')
        protocol.flush()
    except BaseException:
        break
'''


R_WORKER = r'''
namespace <- new.env(parent=globalenv())
input <- file("stdin", open="r")
repeat {
    line <- readLines(input, n=1, warn=FALSE)
    if (length(line) == 0) break
    request <- tryCatch(jsonlite::fromJSON(line), error=function(e) NULL)
    if (is.null(request)) break
    errors <- character(); success <- TRUE
    output <- capture.output(
        tryCatch(withCallingHandlers(
            eval(parse(text=request$code), envir=namespace),
            message=function(e) { errors <<- c(errors, conditionMessage(e)); invokeRestart("muffleMessage") },
            warning=function(e) { errors <<- c(errors, conditionMessage(e)); invokeRestart("muffleWarning") }
        ), error=function(e) { success <<- FALSE; errors <<- c(errors, conditionMessage(e)) })
    )
    result <- list(success=success, stdout=substr(paste(output, collapse="\n"),1,65536),
                   stderr=substr(paste(errors, collapse="\n"),1,65536))
    cat(jsonlite::toJSON(result, auto_unbox=TRUE), "\n", sep="")
    flush(stdout())
}
'''


def docker_args(*args):
    context = os.environ.get('OPENSCIENCE_DOCKER_CONTEXT')
    return ['docker'] + (['--context', context] if context else []) + list(args)


def validate_frame(fid, pid):
    workspace.ident(fid)
    workspace.project(pid)
    from . import sessions
    frame = sessions.find(fid)
    if frame['project_id'] != pid:
        raise HTTPException(404, 'Session not found in project')
    return frame


def enabled():
    if os.environ.get('OPENSCIENCE_ENABLE_PYTHON') != '1':
        raise HTTPException(403, 'Code execution is disabled. Enable the isolated runtime to run cells.')
    if not shutil.which('docker'):
        raise HTTPException(503, 'Code cells require Docker and the openscience-python image')


async def command(*args, timeout=15, limit=65536):
    process = await asyncio.create_subprocess_exec(*docker_args(*args), stdout=asyncio.subprocess.PIPE,
                                                  stderr=asyncio.subprocess.PIPE)
    async def collect(stream):
        output = bytearray()
        while chunk := await stream.read(65536):
            output.extend(chunk[:max(0, limit - len(output))])
        return bytes(output)
    try:
        out, err = await asyncio.wait_for(asyncio.gather(collect(process.stdout), collect(process.stderr)), timeout)
        await process.wait()
        return process.returncode, out, err
    except (asyncio.TimeoutError, asyncio.CancelledError):
        if process.returncode is None:
            process.kill()
        await process.wait()
        raise


class Kernel:
    def __init__(self, fid, pid, language="python"):
        self.frame_id, self.project_id = fid, pid
        self.language = language
        self.id = uuid.uuid4().hex[:16]
        self.container = 'science-kernel-' + uuid.uuid4().hex
        runtime = Path.home() / '.openscience' / 'runtime'
        runtime.mkdir(parents=True, exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(prefix='science-kernel-', dir=runtime)
        self.root = Path(self.temporary.name)
        self.inputs = self.root / 'inputs'; self.inputs.mkdir(mode=0o755)
        self.worker = self.root / ('worker.R' if language == 'r' else 'worker.py')
        self.worker.write_text(R_WORKER if language == 'r' else WORKER); self.worker.chmod(0o644)
        self.root.chmod(0o755)
        self.process = None
        self.lock = asyncio.Lock()
        self.dead = False
        self.output_hashes = {}

    def metadata(self):
        return {'id': self.id, 'frame_id': self.frame_id, 'project_id': self.project_id,
                'language': self.language, 'status': 'stopped' if self.dead else 'running',
                'input_directory': '/inputs', 'output_directory': '/outputs'}

    def snapshot(self):
        for path in self.inputs.iterdir():
            path.unlink()
        p = workspace.project(self.project_id)
        total = 0
        names = set()
        manifest = []
        for a in p['artifacts']:
            name = workspace.filename(a['filename'])
            if name in names:
                name = a['id'] + '-' + name
            names.add(name)
            source = workspace.artifact_path(self.project_id, a['id'], a['current_version_id'])
            if not source.is_file():
                raise HTTPException(410, 'Kernel input artifact bytes are missing')
            total += source.stat().st_size
            if total > 64 * 1024 * 1024:
                raise HTTPException(413, 'Kernel input snapshot exceeds 64 MB')
            destination = self.inputs / name
            shutil.copyfile(source, destination); destination.chmod(0o444)
            manifest.append({'artifact_id': a['id'], 'version_id': a['current_version_id'], 'path': '/inputs/' + name})
        self.input_manifest = manifest

    async def start(self):
        self.snapshot()
        rc, image, error = await command('image', 'inspect', '--format', '{{.Id}}', 'openscience-python')
        self.image_id = image.decode().strip()
        if rc or not self.image_id.startswith('sha256:'):
            raise HTTPException(503, 'The openscience-python runtime image is unavailable')
        args = ['run', '--name', self.container, '--rm', '-i', '--pull=never', '--network=none', '--read-only',
                '--memory=512m', '--cpus=1', '--pids-limit=64', '--cap-drop=ALL',
                '--security-opt=no-new-privileges', '--user=65534:65534',
                '--tmpfs=/tmp:rw,noexec,nosuid,size=32m',
                '--tmpfs=/outputs:rw,noexec,nosuid,size=32m,mode=1777',
                '-e', 'MPLCONFIGDIR=/tmp/matplotlib', '-e', 'PYTHONUNBUFFERED=1',
                '--mount', f'type=bind,source={self.inputs},target=/inputs,readonly',
                '--mount', f'type=bind,source={self.worker},target=/{self.worker.name},readonly',
                '--workdir=/outputs', self.image_id]
        args += (['Rscript', '--vanilla', '/worker.R'] if self.language == 'r' else ['python', '-I', '-u', '/worker.py'])
        self.process = await asyncio.create_subprocess_exec(*docker_args(*args), stdin=asyncio.subprocess.PIPE,
                            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, limit=200000)

    async def stop(self):
        if self.dead:
            return
        self.dead = True
        try:
            await command('rm', '-f', self.container, timeout=10)
        except (OSError, asyncio.TimeoutError):
            pass
        if self.process and self.process.returncode is None:
            self.process.kill()
            await self.process.wait()
        self.temporary.cleanup()

    async def outputs(self, code, execution_id=None):
        # Copy a bounded tar stream, then admit only regular files; never extract archive paths.
        exporter = "import pathlib,sys,tarfile; root=pathlib.Path('/outputs'); archive=tarfile.open(fileobj=sys.stdout.buffer,mode='w|'); [(archive.add(p,arcname=str(p.relative_to(root)),recursive=False)) for p in root.rglob('*') if p.is_file() and not p.is_symlink()]; archive.close()"
        rc, data, errors = await command('exec', '--user', '65534:65534', self.container, 'python', '-I', '-c', exporter,
                                         limit=MAX_OUTPUT_BYTES + 1024 * 1024)
        if rc:
            raise HTTPException(502, 'Could not retrieve isolated Python outputs')
        artifacts = []
        total = 0
        try:
            with tarfile.open(fileobj=io.BytesIO(data), mode='r:*') as archive:
                members = [m for m in archive.getmembers() if m.isfile()]
                if len(members) > MAX_FILES:
                    raise HTTPException(413, 'Python output exceeds 32-file limit')
                for member in members:
                    rel = Path(member.name)
                    if rel.is_absolute() or '..' in rel.parts or member.size > workspace.MAX_FILE:
                        raise HTTPException(413, 'Python output path or file size exceeds limits')
                    total += member.size
                    if total > MAX_OUTPUT_BYTES:
                        raise HTTPException(413, 'Python outputs exceed 32 MB')
                    content = archive.extractfile(member).read(workspace.MAX_FILE + 1)
                    import hashlib
                    digest = hashlib.sha256(content).hexdigest()
                    if self.output_hashes.get(member.name) == digest:
                        continue
                    # Include subdirectory labels without allowing host path components.
                    name = '-'.join(p for p in rel.parts if p not in ('.', ''))
                    name = workspace.filename(name[:200])
                    import mimetypes
                    kind = mimetypes.guess_type(name)[0] or 'application/octet-stream'
                    a = await workspace.save_artifact(self.project_id, name, content, kind,
                         {'origin': self.language + '-kernel', 'language': self.language, 'frame_id': self.frame_id, 'kernel_id': self.id,
                          'inputs': self.input_manifest, 'output_path': str(rel), 'code': code,
                          'docker_image_id': self.image_id, 'execution_id': execution_id})
                    artifacts.append(a)
                    self.output_hashes[member.name] = digest
        except (tarfile.TarError, ValueError, OSError):
            raise HTTPException(502, 'Python output archive was incomplete or invalid')
        return artifacts

    async def run(self, code, execution_id=None):
        async with self.lock:
            if self.dead:
                raise HTTPException(409, 'Kernel was interrupted; run the cell again in a fresh kernel')
            self.snapshot()
            self.process.stdin.write((json.dumps({'code': code}) + '\n').encode())
            await self.process.stdin.drain()
            try:
                line = await asyncio.wait_for(self.process.stdout.readline(), TIMEOUT)
                if not line:
                    await self.stop()
                    raise HTTPException(503, 'Isolated kernel exited. Check Docker and the openscience-python image language dependencies.')
                result = json.loads(line)
                if not isinstance(result, dict) or not all(k in result for k in ('stdout', 'stderr', 'success')):
                    raise ValueError('Invalid kernel protocol')
                result['stdout'] = str(result['stdout'])[:MAX_OUTPUT]
                result['stderr'] = str(result['stderr'])[:MAX_OUTPUT]
                result['kernel_id'] = self.id
                result['artifacts'] = await self.outputs(code, execution_id)
                result['docker_image_id'] = self.image_id
                return result
            except asyncio.TimeoutError:
                await self.stop()
                raise HTTPException(408, 'Code cell exceeded 60 seconds; its kernel was reset')
            except asyncio.CancelledError:
                await self.stop()
                raise
            except (ValueError, BrokenPipeError, ConnectionResetError):
                await self.stop()
                raise HTTPException(502, 'Kernel protocol failed; its kernel was reset')


async def execute(frame_id, pid, code, language="python", execution_id=None):
    enabled(); validate_frame(frame_id, pid)
    if language not in ('python', 'r'):
        raise HTTPException(400, 'Kernel language must be python or r')
    key = frame_id if language == 'python' else frame_id + ':r'
    code = workspace.text(code, language.upper() + ' code', 100000)
    async with _start_lock:
        kernel = _kernels.get(key)
        if kernel is not None and kernel.project_id != pid:
            raise HTTPException(404, 'Kernel not found in project')
        if kernel is None or kernel.dead:
            kernel = Kernel(frame_id, pid, language)
            try:
                await kernel.start()
            except BaseException:
                await kernel.stop()
                raise
            _kernels[key] = kernel
    return await kernel.run(code, execution_id)


async def interrupt(frame_id):
    owned = [(key, k) for key, k in _kernels.items() if k.frame_id == frame_id]
    for key, kernel in owned:
        _kernels.pop(key, None)
        await kernel.stop()
    return {'interrupted': bool(owned), 'frame_id': frame_id}


async def shutdown_all():
    for fid in {k.frame_id for k in _kernels.values()}:
        await interrupt(fid)


@router.get('/api/frames/{fid}/kernels')
async def list_kernels(fid: str, project_id: str):
    validate_frame(fid, project_id)
    return {'kernels': [k.metadata() for k in _kernels.values() if k.frame_id == fid and not k.dead]}


@router.post('/api/frames/{fid}/kernels/execute')
async def execute_route(fid: str, request: Request):
    d = await workspace.body(request)
    return await execute(fid, d.get('project_id'), d.get('code'), d.get('language', 'python'), d.get('execution_id'))


@router.post('/api/frames/{fid}/kernels/restart')
async def restart_kernel(fid: str, request: Request):
    d = await workspace.body(request)
    validate_frame(fid, d.get('project_id')); enabled()
    await interrupt(fid)
    return {'restarted': True, 'frame_id': fid}


@router.delete('/api/frames/{fid}/kernels/{kid}')
async def delete_kernel(fid: str, kid: str, project_id: str):
    validate_frame(fid, project_id); workspace.ident(kid)
    entry = next(((key, k) for key, k in _kernels.items() if k.frame_id == fid and k.id == kid), None)
    if entry is None:
        raise HTTPException(404, 'Kernel not found')
    key, kernel = entry
    _kernels.pop(key, None)
    await kernel.stop()
    return {'deleted': kid}
