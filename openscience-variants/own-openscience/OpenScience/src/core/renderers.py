"""Source-derived scientific file previews; source bytes remain downloadable."""
import csv
import hashlib
import html
import io
import json
import math
import re
import uuid
import xml.etree.ElementTree as ET
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request
from . import workspace

router = APIRouter()

@router.post('/api/render/markdown')
async def render_message(request: Request):
    data = await workspace.body(request)
    source = workspace.text(data.get('content'), 'Message', 100000, empty=True)
    return markdown_preview(source)


def csv_preview(content, delimiter=','):
    reader = csv.reader(io.StringIO(content), delimiter=delimiter)
    try:
        columns = next(reader, [])
        if len(columns) > 200:
            raise HTTPException(413, 'CSV preview exceeds 200 columns')
        rows = []
        truncated = False
        for row in reader:
            if len(row) > 200:
                raise HTTPException(413, 'CSV preview exceeds 200 columns')
            if len(rows) == 200:
                truncated = True
                break
            rows.append(row)
        return {'kind': 'csv', 'columns': columns, 'rows': rows, 'truncated': truncated, 'row_limit': 200}
    except csv.Error:
        raise HTTPException(422, 'CSV source could not be parsed')


def pdb_preview(content):
    atoms, backbone = [], []
    models = set()
    model = 1
    invalid = 0
    truncated = False
    for line in content.splitlines():
        record = line[:6].strip()
        if record == 'MODEL':
            try:
                model = int(line[10:14].strip())
                models.add(model)
            except ValueError:
                invalid += 1
        if record not in ('ATOM', 'HETATM'):
            continue
        models.add(model)
        if len(atoms) >= 50000:
            truncated = True
            continue
        try:
            x, y, z = (float(line[start:end]) for start, end in ((30, 38), (38, 46), (46, 54)))
            if not all(math.isfinite(v) for v in (x, y, z)):
                raise ValueError('Nonfinite coordinate')
            atom = {'serial': int(line[6:11]), 'name': line[12:16].strip(), 'altloc': line[16:17].strip(),
                    'residue': line[17:20].strip(), 'chain': line[21:22].strip(),
                    'residue_position': int(line[22:26]), 'insertion_code': line[26:27].strip(),
                    'x': x, 'y': y, 'z': z, 'element': line[76:78].strip(), 'model': model, 'record': record}
            atoms.append(atom)
            if record == 'ATOM' and atom['name'] == 'CA':
                backbone.append(atom)
        except (ValueError, IndexError):
            invalid += 1
    if not atoms:
        raise HTTPException(422, 'PDB source contains no readable atom coordinates')
    return {'kind': 'pdb', 'atoms': atoms, 'backbone': backbone, 'models': sorted(models),
            'model_count': len(models), 'invalid_records': invalid, 'truncated': truncated, 'atom_limit': 50000}


def fasta_preview(content):
    sequences = []
    current = None
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith(';'):
            continue
        if line.startswith('>'):
            if len(sequences) >= 200:
                raise HTTPException(413, 'FASTA preview exceeds 200 sequences')
            current = {'label': line[1:], 'sequence': ''}
            sequences.append(current)
        else:
            if current is None:
                raise HTTPException(422, 'FASTA sequence must follow a header')
            value = ''.join(line.split())
            if any(not (c.isascii() and (c.isalpha() or c in '*-.?')) for c in value):
                raise HTTPException(422, 'FASTA source contains invalid sequence characters')
            current['sequence'] += value
            if sum(len(s['sequence']) for s in sequences) > 200000:
                raise HTTPException(413, 'FASTA preview exceeds 200000 sequence characters')
    if not sequences or any(not s['sequence'] for s in sequences):
        raise HTTPException(422, 'FASTA source contains an empty or missing sequence')
    for index, sequence in enumerate(sequences):
        position = 0
        positions = []
        for column, char in enumerate(sequence['sequence'], start=1):
            if char not in '-.':
                position += 1
                residue = position
            else:
                residue = None
            positions.append({'column': column, 'residue_position': residue, 'character': char})
        sequence.update({'id': index + 1, 'positions': positions, 'length': position})
    aligned = len({len(s['sequence']) for s in sequences}) == 1
    return {'kind': 'fasta', 'sequences': sequences, 'aligned': aligned,
            'alignment_columns': len(sequences[0]['sequence']) if aligned else None}


def markdown_preview(content):
    try:
        from markdown_it import MarkdownIt
        source, math_blocks, math_available = markdown_math(content)
        renderer = MarkdownIt('commonmark', {'html': False}).enable('table')
        tokens = renderer.parse(source)
        for token in tokens:
            if token.type == 'fence' and token.info.strip().lower() == 'json':
                try:
                    token.content = json.dumps(json.loads(token.content), indent=2, ensure_ascii=False) + '\n'
                except (ValueError, RecursionError):
                    pass
        rendered = renderer.renderer.render(tokens, renderer.options, {})
        for marker, mathml in math_blocks.items():
            rendered = rendered.replace(marker, mathml)
        return {'kind': 'markdown', 'html': rendered, 'math_renderer': 'latex2mathml' if math_available else None,
                'renderer': 'markdown-it-py', 'truncated': False}
    except ImportError:
        return {'kind': 'text', 'content': content, 'html': '<pre>' + html.escape(content) + '</pre>',
                'renderer_unavailable': True, 'reason': 'Markdown rendering requires markdown-it-py'}


@router.get('/api/projects/{pid}/artifacts/{aid}/preview')
async def preview(pid: str, aid: str, version_id: str | None = None):
    a = workspace.item(workspace.project(pid), 'artifacts', aid)
    v = workspace.version(a, version_id)
    path = workspace.artifact_path(pid, aid, v['id'])
    if not path.is_file():
        raise HTTPException(410, 'Stored artifact bytes are missing')
    content = path.read_bytes()
    common = {'filename': a['filename'], 'artifact_id': aid, 'version_id': v['id'],
              'sha256': hashlib.sha256(content).hexdigest(), 'size': len(content)}
    extension = Path(a['filename']).suffix.lower()
    if a['content_type'] == 'application/pdf' or extension == '.pdf':
        return {**common, 'kind': 'pdf', 'text_extraction': workspace.extract_pdf(content)}
    if a['content_type'].startswith('image/'):
        return {**common, 'kind': 'image', 'content_type': a['content_type']}
    if len(content) > 2 * 1024 * 1024 and extension not in ('.pdb', '.ent', '.cif', '.mmcif'):
        raise HTTPException(413, 'Text preview exceeds 2 MB; download the source file')
    try:
        source = content.decode('utf-8')
    except UnicodeDecodeError:
        return {**common, 'kind': 'binary', 'reason': 'Source is not UTF-8 text'}
    if extension in ('.csv', '.tsv') or a['content_type'] in ('text/csv', 'text/tab-separated-values'):
        value = csv_preview(source, '\t' if extension == '.tsv' or a['content_type'] == 'text/tab-separated-values' else ',')
    elif extension in ('.pdb', '.ent') or a['content_type'] in ('chemical/x-pdb', 'chemical/pdb'):
        value = pdb_preview(source)
    elif extension in ('.cif', '.mmcif'):
        value = mmcif_preview(source)
    elif extension in ('.sdf', '.mol', '.smi', '.smiles'):
        value = molecule_preview(source, {'.sdf': 'sdf', '.mol': 'mol'}.get(extension, 'smiles'))
    elif extension in ('.bed', '.bedgraph', '.gff', '.gff3', '.gtf'):
        value = genome_preview(source, extension[1:])
    elif extension in ('.fasta', '.fa', '.faa', '.fna', '.aln'):
        value = fasta_preview(source)
    elif extension in ('.md', '.markdown') or a['content_type'] == 'text/markdown':
        value = markdown_preview(source)
    elif extension == '.json' or a['content_type'] == 'application/json':
        try:
            value = {'kind': 'json', 'value': json.loads(source), 'truncated': False}
        except ValueError:
            value = {'kind': 'text', 'content': source, 'truncated': False}
    else:
        value = {'kind': 'text', 'content': source[:200000], 'truncated': len(source) > 200000}
    return {**common, **value}


def mmcif_preview(content):
    try:
        from Bio.PDB.MMCIF2Dict import MMCIF2Dict
    except ImportError:
        raise HTTPException(503, 'mmCIF previews require Biopython')
    try:
        data = MMCIF2Dict(io.StringIO(content))
        xs, ys, zs = (data['_atom_site.Cartn_' + axis] for axis in 'xyz')
        if not (len(xs) == len(ys) == len(zs)):
            raise ValueError('Coordinate column lengths differ')
        def field(key, index, default=''):
            values = data.get('_atom_site.' + key)
            value = values[index] if values else default
            return '' if value in ('.', '?') else value
        atoms, backbone, models = [], [], set()
        invalid = 0
        for index in range(len(xs)):
            try:
                model = int(field('pdbx_PDB_model_num', index, '1'))
                models.add(model)
                if len(atoms) >= 50000:
                    continue
                xyz = [float(v[index]) for v in (xs, ys, zs)]
                if not all(math.isfinite(v) for v in xyz):
                    raise ValueError('Nonfinite coordinate')
                atom = {'serial': int(field('id', index, str(index + 1))),
                        'name': field('auth_atom_id', index) or field('label_atom_id', index),
                        'altloc': field('label_alt_id', index),
                        'residue': field('auth_comp_id', index) or field('label_comp_id', index),
                        'chain': field('auth_asym_id', index) or field('label_asym_id', index),
                        'residue_position': int(field('auth_seq_id', index) or field('label_seq_id', index)),
                        'insertion_code': field('pdbx_PDB_ins_code', index), 'x': xyz[0], 'y': xyz[1], 'z': xyz[2],
                        'element': field('type_symbol', index), 'model': model,
                        'record': field('group_PDB', index, 'ATOM')}
                atoms.append(atom)
                if atom['record'] == 'ATOM' and atom['name'] == 'CA':
                    backbone.append(atom)
            except (ValueError, IndexError):
                invalid += 1
        if not atoms:
            raise ValueError('No atom coordinates')
        return {'kind': 'pdb', 'source_format': 'mmcif', 'atoms': atoms, 'backbone': backbone,
                'models': sorted(models), 'model_count': len(models), 'invalid_records': invalid,
                'truncated': len(xs) > 50000, 'atom_limit': 50000}
    except (ValueError, KeyError, IndexError, TypeError):
        raise HTTPException(422, 'mmCIF source contains no readable atom coordinate table')


def molecule_preview(content, source_format='smiles'):
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(413, 'Molecule preview exceeds 2 MB')
    try:
        from rdkit import Chem, rdBase
        from rdkit.Chem import rdDepictor
        from rdkit.Chem.Draw import rdMolDraw2D
    except ImportError:
        raise HTTPException(503, 'Chemical structure previews require RDKit')
    try:
        if source_format == 'smiles':
            lines = [line.strip() for line in content.splitlines() if line.strip() and not line.startswith('#')]
            if len(lines) != 1:
                raise HTTPException(422, 'SMILES preview requires one structure per artifact')
            mol = Chem.MolFromSmiles(lines[0].split()[0])
        elif source_format == 'sdf':
            molecules = list(Chem.ForwardSDMolSupplier(io.BytesIO(content.encode()), removeHs=False))
            if len(molecules) != 1:
                raise HTTPException(422, 'SDF preview requires one structure per artifact')
            mol = molecules[0]
        else:
            mol = Chem.MolFromMolBlock(content, removeHs=False)
        if mol is None or mol.GetNumAtoms() == 0:
            raise HTTPException(422, 'Chemical source could not be parsed as a molecule')
        if mol.GetNumAtoms() > 2000:
            raise HTTPException(413, 'Chemical preview exceeds 2000 atoms')
        rdDepictor.Compute2DCoords(mol)
        drawer = rdMolDraw2D.MolDraw2DSVG(600, 400)
        drawer.DrawMolecule(mol); drawer.FinishDrawing()
        return {'kind': 'molecule', 'svg': drawer.GetDrawingText(), 'atom_count': mol.GetNumAtoms(),
                'bond_count': mol.GetNumBonds(), 'canonical_smiles': Chem.MolToSmiles(mol),
                'source_format': source_format, 'renderer': 'RDKit', 'renderer_version': rdBase.rdkitVersion}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(422, 'Chemical source could not be parsed as a molecule')


def genome_preview(content, source_format='bed'):
    features = []
    truncated = False
    coordinate_system = '1-based inclusive' if source_format in ('gff', 'gff3', 'gtf') else '0-based half-open'
    for line in content.splitlines():
        if not line.strip() or line.startswith(('#', 'track ', 'browser ')):
            continue
        if len(features) >= 10000:
            truncated = True
            break
        fields = line.split('\t')
        try:
            if source_format in ('gff', 'gff3', 'gtf'):
                if len(fields) < 9:
                    raise ValueError('GFF needs nine columns')
                chrom, start, end = fields[0], int(fields[3]), int(fields[4])
                if start < 1 or end < start:
                    raise ValueError('Invalid inclusive interval')
                name = fields[2]
                # Retain attributes and source; never relabel an interval using synthetic sequence.
                feature = {'chrom': chrom, 'start': start, 'end': end, 'name': name,
                           'axis_start0': start - 1, 'axis_end0': end,
                           'attributes': fields[8], 'source': fields[1], 'strand': fields[6]}
                score = fields[5]
            else:
                if len(fields) < 3:
                    raise ValueError('BED needs three columns')
                chrom, start, end = fields[0], int(fields[1]), int(fields[2])
                if start < 0 or end < start:
                    raise ValueError('Invalid half-open interval')
                if source_format == 'bedgraph' and len(fields) < 4:
                    raise ValueError('bedGraph needs a value')
                name = fields[3] if len(fields) > 3 and source_format != 'bedgraph' else ''
                feature = {'chrom': chrom, 'start': start, 'end': end, 'name': name,
                           'axis_start0': start, 'axis_end0': end}
                score = fields[3] if source_format == 'bedgraph' else fields[4] if len(fields) > 4 else '.'
            if not chrom:
                raise ValueError('Missing chromosome')
            if score != '.':
                value = float(score)
                if not math.isfinite(value):
                    raise ValueError('Nonfinite value')
                feature['value'] = value
            features.append(feature)
        except (ValueError, IndexError):
            raise HTTPException(422, 'Genomic source contains an invalid interval or score')
    if not features:
        raise HTTPException(422, 'Genomic source contains no intervals')
    return {'kind': 'genome', 'features': features, 'coordinate_system': coordinate_system,
            'axis_coordinate_system': '0-based half-open', 'source_format': source_format,
            'truncated': truncated, 'feature_limit': 10000}


@router.post('/api/projects/{pid}/chemistry/sketch', status_code=201)
async def chemical_sketch(pid: str, request: 'Request'):
    workspace.project(pid)
    d = await workspace.body(request)
    smiles = workspace.text(d.get('smiles'), 'SMILES', 100000)
    molecule = molecule_preview(smiles)
    name = workspace.filename(d.get('filename', 'structure.svg'))
    if not name.lower().endswith('.svg'):
        raise HTTPException(400, 'Chemical sketch filename must end in .svg')
    artifact = await workspace.save_artifact(pid, name, molecule['svg'].encode(), 'image/svg+xml',
              {'origin': 'chemical-sketch', 'source_smiles': smiles, 'tool': 'RDKit',
               'tool_version': molecule['renderer_version'], 'canonical_smiles': molecule['canonical_smiles'],
               'atom_count': molecule['atom_count'], 'bond_count': molecule['bond_count']})
    return {'artifact': artifact, 'preview': molecule}


def markdown_math(content):
    try:
        from latex2mathml.converter import convert
    except ImportError:
        return content, {}, False
    allowed_tags = {'math','mi','mn','mo','mrow','mfrac','msqrt','mroot','msup','msub','msubsup','mtable','mtr','mtd',
                    'mover','munder','munderover','mtext','mspace','menclose','mpadded','mphantom','mstyle','mfenced'}
    allowed_attrs = {'display','mathvariant','mathsize','mathcolor','mathbackground','stretchy','fence','separator',
                     'form','lspace','rspace','width','height','depth','rowalign','columnalign','rowspacing',
                     'columnspacing','columnlines','rowlines','frame','notation','accent','accentunder','movablelimits',
                     'displaystyle','scriptlevel','linethickness','bevelled','open','close','separators'}
    blocks = {}
    nonce = 'SCIENCEMATH' + uuid.uuid4().hex
    # Preserve fenced/inline code verbatim, and never interpret escaped currency delimiters.
    protected = {}
    def protect(match):
        marker = nonce + 'CODE' + str(len(protected))
        protected[marker] = match.group(0)
        return marker
    source = re.sub(r'```[\s\S]*?```|~~~[\s\S]*?~~~|(?P<tick>`+)(?!`)[^\n]*?(?<!`)(?P=tick)(?!`)|^(?: {4}|\t).*$', protect, content, flags=re.MULTILINE)
    def render(match, block=False):
        expression = match.group(1)
        # A currency phrase such as $5 and $10 must remain literal text.
        if not block and re.match(r'^\d+(?:\.\d+)?\s+[A-Za-z]+\s*$', expression):
            return match.group(0)
        if len(expression) > 10000:
            return match.group(0)
        try:
            value = convert(expression, display='block' if block else 'inline')
            root = ET.fromstring(value)
            for node in root.iter():
                if node.tag.split('}')[-1] not in allowed_tags or any(k.split('}')[-1] not in allowed_attrs for k in node.attrib):
                    raise ValueError('Unsupported MathML element')
            marker = nonce + 'BLOCK' + str(len(blocks))
            blocks[marker] = value
            return marker
        except Exception:
            return match.group(0)
    source = re.sub(r'(?<!\\)\$\$([\s\S]+?)(?<!\\)\$\$', lambda m: render(m, True), source)
    source = re.sub(r'(?<![\\$])\$(?!\$)([^$\n]+?)(?<!\\)\$(?!\$)', render, source)
    for marker, original in protected.items():
        source = source.replace(marker, original)
    return source, blocks, True
