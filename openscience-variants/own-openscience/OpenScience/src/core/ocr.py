"""Explicit page-bounded OCR with word boxes and source version provenance."""
import csv
import hashlib
import io
import json
import shutil
import tempfile
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from . import workspace
from .providers import cli_process

router = APIRouter()

class Request(BaseModel):
    version_id: str | None = None
    first_page: int = Field(default=1, ge=1)
    last_page: int = Field(default=1, ge=1)
    language: str = Field(default='eng', pattern=r'^[a-z]{3}(\+[a-z]{3})*$')

@router.post('/api/projects/{pid}/artifacts/{aid}/ocr')
async def extract(pid: str, aid: str, req: Request):
    if req.last_page < req.first_page or req.last_page - req.first_page >= 20:
        raise HTTPException(400, 'Choose between one and twenty consecutive pages')
    p = workspace.project(pid)
    artifact = next((a for a in p['artifacts'] if a['id'] == aid), None)
    if artifact is None:
        raise HTTPException(404, 'Artifact not found')
    version = req.version_id or artifact['current_version_id']
    workspace.version(artifact, version)
    source = workspace.artifact_path(pid, aid, version)
    if not source.is_file():
        raise HTTPException(410, 'Source PDF bytes are missing')
    content = source.read_bytes()
    if not content.startswith(b'%PDF-'):
        raise HTTPException(400, 'OCR requires a PDF source')
    if not shutil.which('pdftoppm') or not shutil.which('tesseract'):
        raise HTTPException(503, 'Install Poppler and Tesseract for local OCR')
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(content))
    if reader.is_encrypted or req.last_page > len(reader.pages):
        raise HTTPException(400, 'Requested pages are unavailable or encrypted')
    pages = []
    with tempfile.TemporaryDirectory(prefix='science-ocr-') as folder:
        leaf = Path(folder) / 'source.pdf'; leaf.write_bytes(content)
        for number in range(req.first_page, req.last_page + 1):
            prefix = Path(folder) / 'page'
            await cli_process([shutil.which('pdftoppm'), '-f', str(number), '-l', str(number), '-singlefile', '-r', '200', '-png', str(leaf), str(prefix)], '', timeout=90)
            output = await cli_process([shutil.which('tesseract'), str(prefix)+'.png', 'stdout', '-l', req.language, 'tsv'], '', timeout=90)
            words = []
            for row in csv.DictReader(io.StringIO(output), delimiter='\t'):
                if row.get('text', '').strip() and row.get('level') == '5':
                    words.append({'text': row['text'], 'confidence': float(row['conf']),
                                  'box_pixels': [int(row[k]) for k in ('left','top','width','height')],
                                  'line': [int(row[k]) for k in ('block_num','par_num','line_num')]})
            lines, last = [], None
            for word in words:
                if word['line'] != last:
                    lines.append([]); last = word['line']
                lines[-1].append(word['text'])
            pages.append({'page': number, 'render_dpi': 200, 'text': '\n'.join(' '.join(line) for line in lines), 'words': words})
    record = {'source_artifact_id': aid, 'source_version_id': version, 'source_sha256': hashlib.sha256(content).hexdigest(),
              'engine': 'tesseract', 'engine_version': (await cli_process([shutil.which('tesseract'), '--version'], '', timeout=10)).splitlines()[0],
              'language': req.language, 'pages': pages, 'status': 'ocr_extracted', 'requires_source_verification': True}
    saved = await workspace.save_artifact(pid, artifact['filename']+'.ocr.json', json.dumps(record, ensure_ascii=False).encode(), 'application/json', {'origin': 'ocr', 'source_artifact_id': aid, 'source_version_id': version, 'source_sha256': record['source_sha256']})
    return {'artifact': saved, 'extraction': record}
