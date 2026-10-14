#!/usr/bin/env python3
"""Recover inert JavaScript using parser-validated boundaries, never guess executable layouts."""
import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import sys
import tempfile

MAX_BYTES = 256 * 1024 * 1024
HELPER = Path(__file__).with_name("javascript-extract.mjs")


def read_bundle(path):
    path = Path(path)
    opener = gzip.open if path.suffix == ".gz" else open
    with opener(path, "rb") as handle:
        data = handle.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError("Input exceeds 256 MiB extraction limit")
    return data, None


def find_modules(bundle):
    # The parser recognizes real source member boundaries and complete statements.
    with tempfile.TemporaryDirectory(prefix="bun-source-") as tmp:
        source = Path(tmp) / "input.bin"
        source.write_bytes(bundle)
        result = subprocess.run(["node", "--max-old-space-size=4096", str(HELPER), str(source)],
                                capture_output=True, text=True, timeout=300)
        if result.returncode:
            raise ValueError("JavaScript parser rejected the container: " + result.stderr[-1000:])
        ranges = json.loads(result.stdout)
    modules = []
    for index, item in enumerate(ranges.get("internal", []) + ranges["modules"]):
        start, end = item["start_offset"], item["end_offset"]
        if not 0 <= start < end <= len(bundle):
            raise ValueError("Invalid source range")
        data = bundle[start:end]
        modules.append({**item, "path": item.get("path", f"src/sm_{len(modules)-len(ranges.get('internal', [])):04d}_module.js"),
                        "source": data, "size": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    return modules


def safe_relative(value):
    relative = PurePosixPath(value)
    if relative.is_absolute() or ".." in relative.parts or not relative.parts:
        raise ValueError("Unsafe module path")
    return Path(*relative.parts)


def write_modules(modules, output_dir, *, repair=False, container_sha256=None):
    output_dir = Path(output_dir)
    if output_dir.is_symlink():
        raise ValueError("Symlink output root is unsupported")
    if output_dir.exists() and not repair:
        raise FileExistsError("Output exists; use --repair only for a preserved extraction tree")
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = output_dir / ".manifest.json"
    old_files = sorted((output_dir / "src").glob("sm_*.js")) if repair else []
    records, used = [], set()
    app_index = 0
    for mod in modules:
        if mod["type"] == "function":
            relative = Path("bun-internal") / safe_relative(mod["path"])
        else:
            relative = old_files[app_index].relative_to(output_dir) if app_index < len(old_files) else safe_relative(mod["path"])
            app_index += 1
        target = output_dir / relative
        if target.is_symlink() or not target.resolve().is_relative_to(output_dir.resolve()):
            raise ValueError("Symlink output is unsupported")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(mod["source"])
        used.add(target)
        records.append({k:v for k,v in mod.items() if k not in ("source", "path")} | {"path":relative.as_posix(),"order":len(records)})
    # Old source bytes are retained in the local source-inputs Git branch.
    for path in old_files:
        if path not in used:
            path.unlink()
    manifest = {"schema": "parser-validated-bun-source-v1", "container_sha256": container_sha256,
                "parser": "@babel/parser 8.0.4", "total_modules":len(records),
                "function_modules":sum(m["type"]=="function" for m in records),
                "s_modules":sum(m["type"]=="smodule" for m in records), "files":records,
                "semantics":"ordered program partitions, not independent runtime packages"}
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    return manifest


def rebuild(manifest_path, source_dir, output_bundle, header=None):
    if header is not None:
        raise ValueError("Native executable rebuilding requires original Bun metadata; source concatenation cannot replace it")
    manifest = json.loads(Path(manifest_path).read_text())
    if manifest.get("schema") != "parser-validated-bun-source-v1":
        raise ValueError("Unsupported legacy manifest; re-extract from the original container")
    parts = []
    for item in sorted(manifest["files"], key=lambda item:item["order"]):
        if item["type"] != "smodule": continue
        path = Path(source_dir) / safe_relative(item["path"])
        if not path.is_file(): raise ValueError("Required source partition is missing: " + str(path))
        parts.append(path.read_bytes())
    data = b"".join(parts)
    # Validate the entire assembled program before writing any output.
    with tempfile.TemporaryDirectory(prefix="bun-validate-") as tmp:
        candidate = Path(tmp)/"candidate.js"; candidate.write_bytes(data)
        subprocess.run(["node", "--max-old-space-size=4096",str(HELPER),str(candidate),"--validate"],check=True,capture_output=True,timeout=300)
    output_bundle = Path(output_bundle)
    if output_bundle.exists(): raise FileExistsError("Refusing to overwrite output")
    output_bundle.write_bytes(data)
    return output_bundle


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    extract = commands.add_parser("extract")
    extract.add_argument("input", type=Path); extract.add_argument("output", type=Path)
    extract.add_argument("--repair", action="store_true")
    info = commands.add_parser("info"); info.add_argument("input", type=Path)
    assemble = commands.add_parser("rebuild")
    assemble.add_argument("source",type=Path); assemble.add_argument("header",nargs="?")
    assemble.add_argument("--no-header",action="store_true"); assemble.add_argument("-o","--output",type=Path,required=True)
    args = parser.parse_args()
    try:
        if args.command == "rebuild":
            if not args.no_header or args.header:
                raise ValueError("Use --no-header to assemble JavaScript only; native executable reconstruction is unsupported")
            print(rebuild(args.source/".manifest.json",args.source,args.output))
        else:
            data,_ = read_bundle(args.input); modules = find_modules(data)
            if args.command == "info":
                print(json.dumps({"source_partitions":len(modules),"source_bytes":sum(m["size"] for m in modules)}))
            else:
                result = write_modules(modules,args.output,repair=args.repair,container_sha256=hashlib.sha256(data).hexdigest())
                print(json.dumps({"modules":result["total_modules"],"builtins":result["function_modules"],"program_partitions":result["s_modules"]}))
    except (ValueError,OSError,subprocess.SubprocessError) as error:
        parser.exit(1,str(error)+"\n")

if __name__ == "__main__": main()
