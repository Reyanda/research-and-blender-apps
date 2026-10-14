import asyncio
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from core import server
from connectors import mcp
from fastapi.testclient import TestClient


class ServerTests(unittest.TestCase):
    def test_startup_does_not_wait_for_provider_discovery(self):
        async def check():
            gate = asyncio.Event()
            async def discovery():
                await gate.wait()
            with patch.object(server, "discover", side_effect=discovery):
                await asyncio.wait_for(server.start(), timeout=1)
                self.assertIsNotNone(server._discovery_task)
                self.assertFalse(server._discovery_task.done())
                await server.stop()
                self.assertIsNone(server._discovery_task)
        asyncio.run(check())

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.storage = patch.object(server, "DATA", Path(self.temporary.name))
        self.storage.start()
        self.client = TestClient(server.app)
        self.project = self.client.post("/api/projects", json={"name": "Research"}).json()

    def tearDown(self):
        self.client.close()
        self.storage.stop()
        self.temporary.cleanup()

    def test_project_persistence_and_validation(self):
        pid = self.project["id"]
        self.assertEqual(self.client.get(f"/api/projects/{pid}").json()["name"], "Research")
        self.assertEqual(len(self.client.get("/api/projects").json()["projects"]), 1)
        self.assertEqual(self.client.get("/api/projects/not-valid").status_code, 400)
        self.assertEqual(self.client.post("/api/chat", json={"project_id": "../escape", "message": "x"}).status_code, 422)
        self.assertEqual(self.client.post("/api/projects", json={"name": ""}).status_code, 422)

    def test_cross_origin_and_homepage(self):
        self.assertEqual(self.client.post("/api/projects", json={"name": "x"}, headers={"Origin": "https://evil.example"}).status_code, 403)
        self.assertIn("OpenScience", self.client.get("/").text)

    def test_tool_roundtrip_and_history(self):
        seen = []
        async def provider(messages, *args, **kwargs):
            seen.append(json.loads(json.dumps(messages)))
            if len(seen) == 1:
                return {"content": "", "tool_calls": [{"id": "call_1", "name": "search_mcp", "arguments": {"connector": "pubmed", "query": "test"}}]}
            return {"content": "Found PMID 123", "tool_calls": None}
        with patch.object(server, "llm_chat", side_effect=provider), patch.object(server, "run_tool", new=AsyncMock(return_value={"results": [{"pmid": "123"}]})):
            response = self.client.post("/api/chat", json={"project_id": self.project["id"], "message": "Search"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["response"], "Found PMID 123")
        self.assertEqual(response.json()["tool_results"][0]["tool"], "search_mcp")
        self.assertEqual(seen[1][-1]["role"], "tool")
        saved = server.get_proj(self.project["id"])["messages"]
        self.assertEqual([m["role"] for m in saved], ["user", "assistant", "tool", "assistant"])
        self.assertEqual(saved[1]["tool_calls"][0]["id"], saved[2]["tool_call_id"])

    def test_sse_and_missing_key(self):
        with patch.object(server, "llm_chat", new=AsyncMock(return_value={"content": "answer", "tool_calls": None})):
            response = self.client.post("/api/chat/stream", json={"project_id": self.project["id"], "message": "hello"})
        self.assertIn('data: {"t": "text", "c": "answer"}\n\n', response.text)
        self.assertTrue(response.text.endswith('data: {"t": "done"}\n\n'))
        with patch.object(server, "API_KEY", ""):
            self.assertEqual(self.client.post("/api/chat", json={"project_id": self.project["id"], "message": "hi"}).status_code, 503)

    def test_python_requires_opt_in(self):
        with patch.dict(server.os.environ, {"OPENSCIENCE_ENABLE_PYTHON": "0"}), patch.object(server.asyncio, "create_subprocess_exec") as process:
            result = asyncio.run(server.run_tool("run_python", {"code": "raise Exception()"}, self.project["id"]))
        self.assertFalse(result["success"])
        process.assert_not_called()

    def test_alphafold_array_response(self):
        import httpx
        transport = httpx.MockTransport(lambda request: httpx.Response(200, json=[{"pdbUrl": "https://example.org/p.pdb", "gene": "TP53"}]))
        real_client = httpx.AsyncClient
        with patch.object(httpx, "AsyncClient", side_effect=lambda **kwargs: real_client(transport=transport)):
            result = asyncio.run(mcp.mcp_search("alphafold", "P04637"))
        self.assertEqual(result["results"][0]["gene"], "TP53")

    def test_python_container_restrictions(self):
        class Stream:
            def __init__(self):
                self.used = False
            async def read(self, size):
                if self.used: return b""
                self.used = True
                return b"analysis output"
        process = AsyncMock()
        process.stdout = Stream()
        process.stderr = Stream()
        process.returncode = 0
        with patch.dict(server.os.environ, {"OPENSCIENCE_ENABLE_PYTHON": "1"}), patch.object(server.shutil, "which", return_value="/usr/bin/docker"), patch.object(server.asyncio, "create_subprocess_exec", new=AsyncMock(return_value=process)) as launch:
            result = asyncio.run(server.run_tool("run_python", {"code": "print(2 + 2)"}, self.project["id"]))
        self.assertTrue(result["success"])
        command = launch.call_args.args
        for flag in ("--network=none", "--read-only", "--memory=512m", "--cap-drop=ALL", "--user=65534:65534", "--pull=never"):
            self.assertIn(flag, command)
        mounted_script = next(arg for arg in command if str(arg).startswith("type=bind"))
        self.assertNotIn(str(server.DATA), mounted_script)

    def test_provider_failure_is_controlled(self):
        import httpx
        with patch.object(server, "llm_chat", new=AsyncMock(side_effect=httpx.ConnectError("offline"))):
            response = self.client.post("/api/chat", json={"project_id": self.project["id"], "message": "hello"})
        self.assertEqual(response.status_code, 502)
        self.assertIn("unavailable", response.json()["detail"])

    def test_connector_limit(self):
        self.assertIn("error", asyncio.run(mcp.mcp_search("pubmed", "x", {"max_results": "oops"})))


if __name__ == "__main__":
    unittest.main()
