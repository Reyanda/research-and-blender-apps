import asyncio
import hashlib
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
from core import server, workspace, renderers
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient


class RendererTests(unittest.TestCase):
    def test_csv_quotes_and_preview_limit(self):
        result = renderers.csv_preview('name,value\n"Smith, Jane",2\n"line\nbreak",4\n')
        self.assertEqual(result['columns'], ['name', 'value'])
        self.assertEqual(result['rows'], [['Smith, Jane', '2'], ['line\nbreak', '4']])
        self.assertTrue(renderers.csv_preview('x\n' + '1\n' * 201)['truncated'])
        self.assertEqual(len(renderers.csv_preview('x\n' + '1\n' * 201)['rows']), 200)

    def test_pdb_exact_coordinates_and_residue_identity(self):
        source = ('MODEL        1\n'
                  'ATOM      1  CA  ALA A  12A     11.104  13.207  -2.100  1.00 20.00           C  \n'
                  'ATOM      2  N   ALA A  12A     10.000  12.000  -1.000  1.00 20.00           N  \n'
                  'ENDMDL\nMODEL        2\n'
                  'ATOM      3  CA  GLY B   7      21.000  22.000  23.000  1.00 20.00           C  \n')
        result = renderers.pdb_preview(source)
        self.assertEqual(result['model_count'], 2)
        self.assertEqual(len(result['atoms']), 3); self.assertEqual(len(result['backbone']), 2)
        first = result['atoms'][0]
        self.assertEqual((first['x'], first['y'], first['z']), (11.104, 13.207, -2.1))
        self.assertEqual((first['chain'], first['residue_position'], first['insertion_code']), ('A', 12, 'A'))
        self.assertEqual(result['backbone'][1]['model'], 2)
        with self.assertRaises(HTTPException):
            renderers.pdb_preview('no coordinates')

    def test_fasta_source_characters_and_gap_positions(self):
        result = renderers.fasta_preview('>sample one\nAc-G.\n>sample two\nATCG-\n')
        self.assertTrue(result['aligned']); self.assertEqual(result['alignment_columns'], 5)
        row = result['sequences'][0]
        self.assertEqual(row['sequence'], 'Ac-G.')
        self.assertEqual([p['residue_position'] for p in row['positions']], [1, 2, None, 3, None])
        self.assertEqual([p['character'] for p in row['positions']], list('Ac-G.'))
        with self.assertRaises(HTTPException):
            renderers.fasta_preview('>a\nAC2')

    def test_markdown_safe_source_render(self):
        result = renderers.markdown_preview('# Methods\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))')
        self.assertIn('Methods', result['html'])
        self.assertNotIn('<script>', result['html'])
        self.assertNotIn('href="javascript:', result['html'])

    def test_version_bound_sha_and_project_isolation(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(server, 'DATA', Path(tmp)):
            pid, other = 'a'*16, 'b'*16
            for p in (pid, other):
                server.atomic_json(server.DATA / 'projects' / p / 'project.json', {'id': p})
            a = asyncio.run(workspace.save_artifact(pid, 'source.csv', b'x,y\n1,2\n', 'text/csv'))
            app = FastAPI(); app.include_router(workspace.router); app.include_router(renderers.router)
            with TestClient(app) as client:
                url = f"/api/projects/{pid}/artifacts/{a['id']}"
                original = a['current_version_id']
                client.post(url + '/versions', json={'content': 'x,y\n3,4\n'})
                preview = client.get(url + '/preview', params={'version_id': original}).json()
                self.assertEqual(preview['rows'], [['1', '2']])
                self.assertEqual(preview['sha256'], hashlib.sha256(b'x,y\n1,2\n').hexdigest())
                self.assertEqual(client.get(url + '/preview').json()['rows'], [['3', '4']])
                self.assertEqual(client.get(f"/api/projects/{other}/artifacts/{a['id']}/preview").status_code, 404)
                image = asyncio.run(workspace.save_artifact(pid, 'plot.svg', b'<svg xmlns="http://www.w3.org/2000/svg"><script>bad()</script></svg>', 'image/svg+xml'))
                response = client.get(f"/api/projects/{pid}/artifacts/{image['id']}?inline=true")
                self.assertTrue(response.headers['content-disposition'].startswith('inline'))
                self.assertIn('sandbox', response.headers['content-security-policy'])
                self.assertEqual(response.headers['x-content-type-options'], 'nosniff')




class AdditionalScienceRendererTests(unittest.TestCase):
    def test_mmcif_exact_coordinates(self):
        source = '''data_actual
loop_
_atom_site.group_PDB
_atom_site.id
_atom_site.type_symbol
_atom_site.label_atom_id
_atom_site.label_comp_id
_atom_site.label_asym_id
_atom_site.label_seq_id
_atom_site.Cartn_x
_atom_site.Cartn_y
_atom_site.Cartn_z
_atom_site.pdbx_PDB_model_num
ATOM 1 C CA ALA A 12 11.104 13.207 -2.100 1
ATOM 2 N N ALA A 12 10.000 12.000 -1.000 1
#
'''
        result = renderers.mmcif_preview(source)
        self.assertEqual(len(result['atoms']), 2)
        self.assertEqual((result['atoms'][0]['x'], result['atoms'][0]['y'], result['atoms'][0]['z']), (11.104, 13.207, -2.1))
        self.assertEqual(result['atoms'][0]['residue_position'], 12)
        self.assertEqual(len(result['backbone']), 1)

    def test_ethanol_actual_topology_and_sketch_artifact(self):
        result = renderers.molecule_preview('CCO')
        self.assertEqual((result['atom_count'], result['bond_count']), (3, 2))
        self.assertIn('<svg', result['svg'])
        with self.assertRaises(HTTPException):
            renderers.molecule_preview('not a molecule')
        from rdkit import Chem
        molecule = Chem.MolFromSmiles('CCO')
        mol = renderers.molecule_preview(Chem.MolToMolBlock(molecule), 'mol')
        sdf = renderers.molecule_preview(Chem.MolToMolBlock(molecule) + '\n$$$$\n', 'sdf')
        self.assertEqual((mol['atom_count'], sdf['bond_count']), (3, 2))
        with tempfile.TemporaryDirectory() as tmp, patch.object(server, 'DATA', Path(tmp)):
            pid = 'a' * 16
            server.atomic_json(server.DATA / 'projects' / pid / 'project.json', {'id': pid})
            app = FastAPI(); app.include_router(renderers.router)
            with TestClient(app) as client:
                response = client.post(f'/api/projects/{pid}/chemistry/sketch', json={'smiles': 'CCO'})
                self.assertEqual(response.status_code, 201, response.text)
                artifact = response.json()['artifact']
                meta = artifact['versions'][0]['metadata']
                self.assertEqual(meta['source_smiles'], 'CCO'); self.assertEqual(meta['atom_count'], 3)
                self.assertIn(b'<svg', workspace.artifact_path(pid, artifact['id'], artifact['current_version_id']).read_bytes())

    def test_genome_coordinates_are_not_shifted_or_invented(self):
        bed = renderers.genome_preview('chr7\t10\t20\tpeak\n', 'bed')
        self.assertEqual((bed['features'][0]['start'], bed['features'][0]['end']), (10, 20))
        self.assertEqual(bed['coordinate_system'], '0-based half-open')
        gff = renderers.genome_preview('chr7\tmeasured\texon\t11\t20\t.\t+\t.\tID=gene1\n', 'gff')
        self.assertEqual((gff['features'][0]['start'], gff['features'][0]['end']), (11, 20))
        self.assertEqual((gff['features'][0]['axis_start0'], gff['features'][0]['axis_end0']), (10, 20))
        self.assertEqual(gff['coordinate_system'], '1-based inclusive')
        graph = renderers.genome_preview('chr7\t10\t20\t2.5\n', 'bedgraph')
        self.assertEqual(graph['features'][0]['value'], 2.5)
        with self.assertRaises(HTTPException):
            renderers.genome_preview('chr7\t-1\t20\n', 'bed')

    def test_markdown_math_preserves_code_currency_and_safe_html(self):
        value = renderers.markdown_preview(r'Measured $\frac{1}{2}$ and $$x^2$$. Cost \$5. `<script>` $5 and $10.' + '\n\n<script>alert(1)</script>')
        self.assertIn('<mfrac>', value['html'])
        self.assertIn('<msup>', value['html'])
        self.assertIn('$5', value['html'])
        self.assertNotIn('<script>', value['html'])
        self.assertNotIn('SCIENCEMATH', value['html'])
        code = renderers.markdown_preview('```python\nprint("$x$")\n```')
        self.assertNotIn('<math', code['html'])
        for source in ('``print("$x$")``', '    print("$x$")'):
            self.assertNotIn('<math', renderers.markdown_preview(source)['html'])


if __name__ == '__main__':
    unittest.main()
