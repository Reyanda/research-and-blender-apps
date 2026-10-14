import base64
import io
import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
from core import server, workspace
from fastapi import FastAPI
from fastapi.testclient import TestClient


class WorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.storage = patch.object(server, 'DATA', Path(self.temp.name))
        self.storage.start()
        app = FastAPI(); app.include_router(workspace.router)
        self.client = TestClient(app)
        self.pid, self.other = 'a' * 16, 'b' * 16
        for pid in (self.pid, self.other):
            p = {'id': pid, 'name': 'Science', 'description': '', 'messages': []}
            server.save_proj(pid, p)
        self.prefix = '/api/projects/' + self.pid

    def tearDown(self):
        self.client.close(); self.storage.stop(); self.temp.cleanup()

    def upload(self, data=b'original', **fields):
        response = self.client.post(self.prefix + '/attachments', json={
            'filename': 'evidence.txt', 'content_base64': base64.b64encode(data).decode(),
            'content_type': 'text/plain', **fields})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def test_bytes_versions_annotations_export_and_isolation(self):
        a = self.upload(b'original\x00bytes'); aid = a['id']; vid = a['current_version_id']
        url = self.prefix + '/artifacts/' + aid
        self.assertEqual(self.client.get(url).content, b'original\x00bytes')
        self.assertEqual(self.client.get('/api/projects/' + self.other + '/artifacts/' + aid).status_code, 404)
        self.assertEqual(self.client.patch(url, json={'filename': '../escape'}).status_code, 400)
        v2 = self.client.post(url + '/versions', json={'content': 'edited'}).json()['id']
        self.assertEqual(self.client.post(url + '/versions', json={'content': 'stale', 'parent_version_id': vid}).status_code, 409)
        self.assertEqual(self.client.get(url).content, b'edited')
        self.assertEqual(self.client.get(url, params={'version_id': vid}).content, b'original\x00bytes')
        annurl = url + '/versions/' + vid + '/annotations'
        annotation = self.client.post(annurl, json={'content': 'Check method', 'selected_text': 'original'}).json()
        self.assertEqual(len(self.client.get(annurl).json()['annotations']), 1)
        self.assertEqual(self.client.get(url + '/versions/' + v2 + '/annotations').json()['annotations'], [])
        self.assertEqual(self.client.patch(annurl + '/' + annotation['id'], json={'content': 'Verified'}).status_code, 200)
        self.assertEqual(self.client.delete(annurl + '/' + annotation['id']).status_code, 200)
        session_bytes = json.dumps({'id': 'c' * 16, 'cells': [{'code': 'x=40', 'language': 'python'}], 'executions': [{'stdout': '42'}]}).encode()
        session_path = server.DATA / 'projects' / self.pid / 'sessions' / ('c' * 16 + '.json')
        session_path.parent.mkdir(parents=True); session_path.write_bytes(session_bytes)
        archive = zipfile.ZipFile(io.BytesIO(self.client.get(self.prefix + '/export').content))
        self.assertEqual(archive.read('sessions/' + 'c' * 16 + '.json'), session_bytes)
        self.assertEqual(archive.read(f'artifacts/{aid}/{vid}/evidence.txt'), b'original\x00bytes')
        self.assertEqual(archive.read(f'artifacts/{aid}/{v2}/evidence.txt'), b'edited')
        self.assertEqual(json.loads(archive.read('project.json'))['artifacts'][0]['current_version_id'], v2)
        stored = json.loads((server.DATA / 'projects' / self.pid / 'project.json').read_text())
        self.assertEqual(len(stored['artifacts'][0]['versions']), 2)
        self.assertEqual(self.client.delete(url).status_code, 200)
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertFalse((server.DATA / 'projects' / self.pid / 'artifacts' / aid).exists())

    def test_folders_notes_memories_context_persistence(self):
        import asyncio
        f1 = self.client.post(self.prefix + '/folders', json={'name': 'Sources'}).json()['id']
        f2 = self.client.post(self.prefix + '/folders', json={'name': 'Child', 'parent_id': f1}).json()['id']
        self.assertEqual(self.client.patch(self.prefix + '/folders/' + f1, json={'parent_id': f2}).status_code, 400)
        a = self.upload(b'credible source', folder_id=f2)
        note = self.client.post(self.prefix + '/notes', json={'content': 'Important method'}).json()
        self.assertEqual(len(self.client.get(self.prefix + '/notes?q=METHOD').json()['notes']), 1)
        self.assertEqual(self.client.patch(self.prefix + '/notes/' + note['id'], json={'content': 'Revised'}).status_code, 200)
        m = self.client.post(self.prefix + '/memories', json={'content': 'Remember cohort', 'category': 'research'}).json()
        self.client.patch(self.prefix, json={'context': 'Study context'})
        context = asyncio.run(workspace.project_context(self.pid))
        self.assertIn('Study context', context); self.assertIn('credible source', context)
        self.assertNotIn('Remember cohort', context)
        self.client.patch(self.prefix, json={'memory_enabled': True})
        self.assertIn('Remember cohort', asyncio.run(workspace.project_context(self.pid)))
        self.assertNotIn('Remember cohort', asyncio.run(workspace.project_context(self.other)))
        self.assertEqual(self.client.patch(self.prefix + '/memories/' + m['id'], json={'content': 'New cohort'}).status_code, 200)
        self.assertEqual(self.client.delete(self.prefix + '/folders/' + f1).status_code, 200)
        self.assertEqual(self.client.get(self.prefix + '/folders').json()['folders'], [])
        self.assertIsNone(self.client.get(self.prefix + '/artifacts').json()['artifacts'][0]['folder_id'])
        self.assertEqual(self.client.get(self.prefix + '/artifacts/' + a['id']).content, b'credible source')
        self.assertEqual(self.client.delete(self.prefix + '/memories/' + m['id']).status_code, 200)
        self.assertEqual(self.client.delete(self.prefix + '/notes/' + note['id']).status_code, 200)

    def test_direct_tool_provenance_and_honest_failure(self):
        with patch.object(server, 'run_tool', new=AsyncMock(return_value={'results': [{'pmid': '123'}]})) as tool:
            r = self.client.post(self.prefix + '/tools', json={'name': 'search_mcp', 'arguments': {'connector': 'pubmed', 'query': 'cohort'}})
        self.assertEqual(r.status_code, 200, r.text)
        tool.assert_awaited_once_with('search_mcp', {'connector': 'pubmed', 'query': 'cohort'}, self.pid)
        a = r.json()['artifact']
        self.assertEqual(a['versions'][0]['metadata']['arguments']['query'], 'cohort')
        self.assertEqual(self.client.get(self.prefix + '/artifacts/' + a['id']).json()['results'][0]['pmid'], '123')
        with patch.object(server, 'run_tool', new=AsyncMock(return_value={'error': 'Provider unavailable'})):
            r = self.client.post(self.prefix + '/tools', json={'name': 'search_mcp', 'arguments': {}})
        self.assertEqual(r.status_code, 502)
        self.assertEqual(len(self.client.get(self.prefix + '/artifacts').json()['artifacts']), 1)
        self.assertEqual(self.client.post(self.prefix + '/tools', json={'name': 'invented', 'arguments': {}}).status_code, 400)

    def test_concurrent_artifact_admission_and_size_limits(self):
        import asyncio
        async def admission():
            return await asyncio.gather(*(workspace.save_artifact(self.pid, f'result-{n}.txt', str(n).encode(), 'text/plain') for n in range(12)))
        admitted = asyncio.run(admission())
        self.assertEqual(len({a['id'] for a in admitted}), 12)
        self.assertEqual(len(self.client.get(self.prefix + '/artifacts').json()['artifacts']), 12)
        with patch.object(workspace, 'MAX_FILE', 4):
            response = self.client.post(self.prefix + '/attachments', json={'filename': 'large', 'content_base64': base64.b64encode(b'12345').decode()})
            self.assertEqual(response.status_code, 413)
        self.assertEqual(self.client.post(self.prefix + '/attachments', json={'filename': 'x', 'content': 'x', 'content_type': 'text/plain\r\nBad: header'}).status_code, 400)

    def test_image_byte_parity_and_memory_individual_toggle(self):
        png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNy8AAAAASUVORK5CYII=')
        with patch.object(server, 'run_tool', new=AsyncMock(return_value={'image_base64': base64.b64encode(png).decode()})):
            result = self.client.post(self.prefix + '/tools', json={'name': 'create_visualization', 'arguments': {'data': [1]}}).json()
        image = next(a for a in result['artifacts'] if a['content_type'] == 'image/png')
        self.assertEqual(self.client.get(self.prefix + '/artifacts/' + image['id']).content, png)
        self.assertEqual(self.client.get(self.prefix + '/artifacts/' + image['id'] + '/versions/' + image['current_version_id']).content, png)
        import asyncio
        m = self.client.post(self.prefix + '/memories', json={'content': 'disabled knowledge', 'enabled': False}).json()
        self.assertEqual(self.client.put(self.prefix + '/memory/enabled', json={'enabled': True}).status_code, 200)
        self.assertNotIn('disabled knowledge', asyncio.run(workspace.project_context(self.pid)))
        self.client.patch(self.prefix + '/memories/' + m['id'], json={'enabled': True})
        self.assertIn('disabled knowledge', asyncio.run(workspace.project_context(self.pid)))
        self.assertEqual(self.client.put(self.prefix + '/memory/enabled', json={'enabled': 'yes'}).status_code, 400)

    def test_pdf_text_pages_and_empty_pdf_status(self):
        try:
            from pypdf import PdfWriter
            from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject
        except ImportError:
            self.skipTest('pypdf dependency not installed')
        writer = PdfWriter(); page = writer.add_blank_page(width=300, height=300)
        font = DictionaryObject({NameObject('/Type'): NameObject('/Font'), NameObject('/Subtype'): NameObject('/Type1'), NameObject('/BaseFont'): NameObject('/Helvetica')})
        page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'): DictionaryObject({NameObject('/F1'): writer._add_object(font)})})
        stream = DecodedStreamObject(); stream.set_data(b'BT /F1 12 Tf 20 100 Td (Measured cohort evidence) Tj ET')
        page[NameObject('/Contents')] = writer._add_object(stream)
        output = io.BytesIO(); writer.write(output)
        pdf = self.upload(output.getvalue(), filename='paper.pdf', content_type='application/pdf')
        self.assertEqual(pdf['text_extraction']['status'], 'extracted')
        import asyncio
        context = asyncio.run(workspace.project_context(self.pid))
        self.assertIn('paper.pdf', context); self.assertIn('[Page 1]', context); self.assertIn('Measured cohort evidence', context)
        writer = PdfWriter(); writer.add_blank_page(width=300, height=300)
        output = io.BytesIO(); writer.write(output)
        blank = self.upload(output.getvalue(), filename='blank.pdf', content_type='application/pdf')
        self.assertEqual(blank['text_extraction']['status'], 'no_text')
        self.assertIn('PDF text unavailable (no_text)', asyncio.run(workspace.project_context(self.pid)))

    def test_validation_and_missing_bytes(self):
        self.assertEqual(self.client.post(self.prefix + '/attachments', json={'filename': 'x', 'content_base64': '?!'}).status_code, 400)
        self.assertEqual(self.client.post(self.prefix + '/attachments', json={'filename': 'x', 'content': 'x', 'folder_id': 'c' * 16}).status_code, 404)
        self.assertEqual(self.client.get('/api/projects/../artifacts').status_code, 404)
        self.assertEqual(self.client.patch(self.prefix, json={'memory_enabled': 'true'}).status_code, 400)
        a = self.upload()
        workspace.artifact_path(self.pid, a['id'], a['current_version_id']).unlink()
        self.assertEqual(self.client.get(self.prefix + '/artifacts/' + a['id']).status_code, 410)
        self.assertEqual(self.client.get(self.prefix + '/export').status_code, 410)


if __name__ == '__main__':
    unittest.main()
