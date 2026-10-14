#!/bin/bash
# Historical entry point; this community project ships a Blender addon ZIP.
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /absolute/output/3d-agent-addon.zip" >&2
  exit 2
fi
python3 - "$project_dir" "$1" <<'PYTHON'
import pathlib, sys, zipfile
source = pathlib.Path(sys.argv[1])
output = pathlib.Path(sys.argv[2]).expanduser().resolve()
if output.exists():
    raise SystemExit("Output exists; choose an unused output path")
if not output.parent.is_dir():
    raise SystemExit("Output directory does not exist")
with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
    archive.write(source / "3d_agent" / "__init__.py", "3d_agent/__init__.py")
    for name in ("LICENSE", "README.md"):
        archive.write(source / name, "3d_agent/" + name)
print(f"Created Blender addon: {output}")
PYTHON
