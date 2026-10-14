#!/bin/bash
set -euo pipefail
exec "$(cd "$(dirname "$0")" && pwd)/../ClaudeScience-patched/launch.sh" "$@"
