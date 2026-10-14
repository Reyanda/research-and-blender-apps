#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROXY_PORT="${PROXY_PORT:-8766}"
: "${DEEPSEEK_API_KEY:?Set DEEPSEEK_API_KEY}"
: "${CLAUDE_SCIENCE_BIN:?Set CLAUDE_SCIENCE_BIN to an original executable}"
[[ -x "$CLAUDE_SCIENCE_BIN" ]] || { echo "Daemon executable missing" >&2; exit 1; }
PROXY_PID=""
DAEMON_PID=""
cleanup() {
  [[ -z "$DAEMON_PID" ]] || kill "$DAEMON_PID" 2>/dev/null || true
  [[ -z "$PROXY_PID" ]] || kill "$PROXY_PID" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
python3 "$SCRIPT_DIR/proxy.py" "$PROXY_PORT" &
PROXY_PID=$!
for attempt in {1..30}; do
  kill -0 "$PROXY_PID" 2>/dev/null || { echo "Proxy exited" >&2; exit 1; }
  if curl --fail --silent "http://127.0.0.1:$PROXY_PORT/v1/health" >/dev/null; then break; fi
  sleep 0.2
done
kill -0 "$PROXY_PID" 2>/dev/null || exit 1
curl --fail --silent "http://127.0.0.1:$PROXY_PORT/v1/health" >/dev/null
export ANTHROPIC_BASE_URL="http://127.0.0.1:$PROXY_PORT"
export ANTHROPIC_API_KEY="local-adapter"
"$CLAUDE_SCIENCE_BIN" serve &
DAEMON_PID=$!
wait "$DAEMON_PID"
