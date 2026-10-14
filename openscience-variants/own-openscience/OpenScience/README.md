# OpenScience

A local research chat app using a DeepSeek-compatible Chat Completions service. Projects and messages are stored on your computer; chat prompts and tool queries are sent to the configured online services.

## Run

Requires Python 3.11 or newer.

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
export DEEPSEEK_API_KEY="your-key"
python run.py
```

Open http://127.0.0.1:8000. The environment key takes precedence over `config.toml` and `~/.openscience/config/config.toml`. Set `DEEPSEEK_BASE_URL` for a compatible service, `HOST` and `PORT` for the listener, and `OPENSCIENCE_DATA_DIR` for project storage. Keep the listener private: this app has no multi-user authentication. Container deployment must also restrict access to the published port.

## Python analysis

Python tool execution is disabled by default. Enabling it requires Docker and a locally built `openscience-python` image:

```sh
docker build -t openscience-python .
OPENSCIENCE_ENABLE_PYTHON=1 python run.py
```

Execution runs as an unprivileged container user with no network, no host data mount, a read-only filesystem, resource limits and a 30-second timeout. Only the submitted script is mounted. Install analysis dependencies in the image through `requirements.txt`; imports in submitted code must be explicit. Docker must be running. Output is text; charts can be generated with the separate visualization tool.

## API

`GET /health`, `GET /api/status`, `GET /api/models`, `GET /api/connectors`, `GET /api/projects`, `POST /api/projects`, `GET /api/projects/{id}` and `POST /api/chat` support the browser interface. `POST /api/chat/stream` emits SSE after the complete tool-aware response is ready; it does not stream incremental provider tokens.

The connector registry includes historical database entries. Some entries lack search implementations, some services require credentials, and external API versions may change. A registry entry does not establish live connectivity. Tool failures are returned to the model as errors rather than substituted research results. AlphaFold retrieves existing structures; BLAST returns a submitted job identifier rather than a completed alignment.

## Tests

```sh
python -m unittest discover -s tests -v
```

Tests use temporary storage and mocked provider/database responses without paid API calls.
