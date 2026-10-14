# Claude Science Messages adapter

`proxy.py` translates text and function-tool requests from Anthropic Messages
format to DeepSeek Chat Completions. Set `DEEPSEEK_API_KEY`; optionally set
`DEEPSEEK_BASE_URL` and `LLM_MODEL`. Install Python dependencies with
`python3 -m pip install fastapi httpx uvicorn` in a virtual environment.

Start only the adapter with `python3 proxy.py 8766`. To launch it with an
existing daemon, set `CLAUDE_SCIENCE_BIN` to that executable and run `./launch.sh`.
The launcher stops only children it starts. The daemon must actually support
`ANTHROPIC_BASE_URL`; daemon integration is not established by adapter tests.

Streaming returns valid Messages SSE events after the upstream completion is
received. It currently buffers responses rather than providing token latency.
Images, thinking blocks and other unsupported content are rejected. Credentials
are supplied by the operator and request bodies are not logged.

The compressed bundle and header are retained original evidence. They are not a
buildable source distribution or proof of a reconstructed native executable.
