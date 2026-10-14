#!/usr/bin/env python3
"""Compatibility entry point for the maintained Bun extraction CLI.

Extraction is heuristic inspection; reconstructing native executables from
fragmented modules is unsupported. See the maintained tool's --help.
"""
from pathlib import Path
import runpy

if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).resolve().parent.parent / "bun-decompiler" / "decompile.py"), run_name="__main__")
