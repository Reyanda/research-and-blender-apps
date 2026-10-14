import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('decompile', Path(__file__).with_name('decompile.py'))
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)

class ExtractionTests(unittest.TestCase):
    def test_complete_statements_and_round_trip(self):
        source = b'#!/usr/bin/env bun\n// @bun\nvar S=(fn)=>fn;var first=S(()=>{let text="S(()=>{";return /[{}]/.test(text)});function other(){return `x${1}`};var second=S(()=>other());export{second};\n'
        container = b'\x00metadata\x00' + source + b'\x00ignored binary tail\xff'
        modules = tool.find_modules(container)
        self.assertEqual(b''.join(m['source'] for m in modules), source)
        self.assertEqual(len(modules), 2)
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)/'source'
            tool.write_modules(modules,output)
            rebuilt = tool.rebuild(output/'.manifest.json',output,Path(tmp)/'app.js')
            self.assertEqual(rebuilt.read_bytes(),source)

    def test_malformed_input_rejected(self):
        with self.assertRaises(ValueError):tool.find_modules(b'var x=')

    def test_native_rebuild_rejected_before_write(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp)/'program'
            with self.assertRaises(ValueError):tool.rebuild(Path(tmp)/'missing.json',tmp,target,header=b'header')
            self.assertFalse(target.exists())

    def test_path_traversal_rejected(self):
        for path in ['../escape.js','/absolute.js']:
            with self.assertRaises(ValueError):tool.safe_relative(path)

    def test_missing_partition_is_not_filled_with_zeroes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);manifest=root/'manifest.json'
            manifest.write_text(json.dumps({'schema':'parser-validated-bun-source-v1','files':[{'path':'missing.js','order':0,'type':'smodule'}]}))
            with self.assertRaises(ValueError):tool.rebuild(manifest,root,root/'app.js')
            self.assertFalse((root/'app.js').exists())

if __name__ == '__main__':unittest.main()
