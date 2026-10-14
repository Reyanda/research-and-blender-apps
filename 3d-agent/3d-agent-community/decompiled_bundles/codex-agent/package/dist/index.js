import { AIEngine, EngineManager, fs, getJanDataFolderPath, joinPath } from "@janhq/core";

//#region rolldown:runtime
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function() {
	return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
};

//#endregion
//#region src/chat-id.ts
function ephemeralChatId() {
	const c = globalThis.crypto;
	if (typeof c?.randomUUID === "function") return `ephemeral-${c.randomUUID()}`;
	return `ephemeral-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

//#endregion
//#region src/codex-app-server/build-env.ts
const getCodexAppServerRuntimeFlagCommand = "get_codex_app_server_runtime_flag";
const getCodexResponsesWebsocketsFlagCommand = "get_codex_responses_websockets_flag";
const getCodexReasoningSummaryFlagCommand = "get_codex_reasoning_summary_flag";
let cachedInvoke$2 = null;
async function resolveCodexAppServerRuntimeFlagValue(runtimeValue, opts = {}) {
	const runtime = nonEmpty(runtimeValue);
	if (runtime) return runtime;
	return readTauriFlag(getCodexAppServerRuntimeFlagCommand, opts);
}
async function resolveCodexResponsesWebsocketsFlagValue(runtimeValue, opts = {}) {
	const runtime = nonEmpty(runtimeValue);
	if (runtime) return runtime;
	return readTauriFlag(getCodexResponsesWebsocketsFlagCommand, opts);
}
async function resolveCodexReasoningSummaryFlagValue(runtimeValue, opts = {}) {
	const runtime = nonEmpty(runtimeValue);
	if (runtime) return runtime;
	return readTauriFlag(getCodexReasoningSummaryFlagCommand, opts);
}
/** Reads one app-owned non-secret flag command from the Tauri IPC bridge. */
async function readTauriFlag(command, opts) {
	const invoke$2 = opts.invoke !== undefined ? opts.invoke : opts.loadInvoke ? await opts.loadInvoke() : await loadInvoke$2();
	if (!invoke$2) return undefined;
	try {
		const value = await invoke$2(command);
		return typeof value === "string" ? nonEmpty(value) : undefined;
	} catch {
		return undefined;
	}
}
/** Lazily loads the Tauri invoke binding when the extension runs inside the webview. */
async function loadInvoke$2() {
	if (cachedInvoke$2) return cachedInvoke$2;
	try {
		const mod = await Promise.resolve().then(function() {
			return init_core$1(), core_exports;
		});
		cachedInvoke$2 = mod.invoke;
		return cachedInvoke$2;
	} catch {
		return null;
	}
}
/** Normalizes empty runtime flag values to an absent selector value. */
function nonEmpty(value) {
	return value ? value : undefined;
}

//#endregion
//#region ../../shared-utils/src/logger.ts
function serializeRule83(value, seen) {
	if (value instanceof Error) return value.stack ?? `${value.name}: ${value.message}`;
	if (value === null || typeof value !== "object") return value;
	if (seen.has(value)) return "[Circular]";
	seen.add(value);
	if (Array.isArray(value)) return value.map((entry) => serializeRule83(entry, seen));
	const out = {};
	for (const [k, v] of Object.entries(value)) out[k] = serializeRule83(v, seen);
	return out;
}
function write(level, msg, extra) {
	const safeExtra = extra ? serializeRule83(extra, new WeakSet()) : undefined;
	const payload = {
		level,
		msg,
		ts: new Date().toISOString(),
		...safeExtra ?? {}
	};
	const serialized = JSON.stringify(payload);
	if (level === "error" || level === "warn") console.error(serialized);
else console.log(serialized);
	forwardToHostLog(level, serialized);
}
function forwardToHostLog(level, serialized) {
	const invoke$2 = globalThis.__TAURI_INTERNALS__?.invoke;
	if (!invoke$2) return;
	const message = boundedHostLog(redactHostLog(`[shared-utils] ${serialized}`));
	void invoke$2("plugin:log|log", {
		level: hostLogLevel(level),
		message
	}).catch(() => {});
}
function hostLogLevel(level) {
	switch (level) {
		case "debug": return 2;
		case "info": return 3;
		case "warn": return 4;
		case "error": return 5;
	}
}
function redactHostLog(input) {
	let out = input;
	for (const [pattern, replacement] of HOST_LOG_REDACTIONS) out = out.replace(pattern, replacement);
	return out;
}
function boundedHostLog(input) {
	if (input.length <= HOST_LOG_MAX_CHARS) return input;
	return `${input.slice(0, HOST_LOG_MAX_CHARS)}...[truncated]`;
}
var HOST_LOG_MAX_CHARS, HOST_LOG_REDACTIONS, logger;
var init_logger = __esm({ "../../shared-utils/src/logger.ts"() {
	HOST_LOG_MAX_CHARS = 4e3;
	HOST_LOG_REDACTIONS = [
		[/authorization:\s*bearer\s+\S+/gi, "[REDACTED:bearer]"],
		[/\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED:jwt]"],
		[/\bsk-proj-[A-Za-z0-9_-]+/g, "[REDACTED:openai-project]"],
		[/\bsk-ant-[A-Za-z0-9_-]+/g, "[REDACTED:anthropic]"],
		[/\bsk-[A-Za-z0-9_-]+/g, "[REDACTED:openai-legacy]"],
		[/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[REDACTED:email]"]
	];
	logger = {
		debug: (msg, extra) => write("debug", msg, extra),
		info: (msg, extra) => write("info", msg, extra),
		warn: (msg, extra) => write("warn", msg, extra),
		error: (msg, extra) => write("error", msg, extra)
	};
} });

//#endregion
//#region ../../shared-utils/src/index.ts
var init_src = __esm({ "../../shared-utils/src/index.ts"() {
	init_logger();
} });

//#endregion
//#region src/prompt-payload.ts
var AgentPromptPayloadError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "AgentPromptPayloadError";
	}
};
const SUPPORTED_IMAGE_MEDIA_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/webp"
]);
const MAX_AGENT_PROMPT_IMAGES = 4;
const MAX_AGENT_PROMPT_IMAGE_DECODED_BYTES = 921600;
const MAX_AGENT_PROMPT_TOTAL_IMAGE_DECODED_BYTES = 1228800;
function dataUrlToImageBlock(value) {
	const url = typeof value === "string" ? value : value && typeof value === "object" && "url" in value && typeof value.url === "string" ? value.url : "";
	const match = url.match(/^data:([^;,]+);base64,(.*)$/s);
	if (!match) return null;
	const [, rawMediaType, rawData] = match;
	if (!rawData) return null;
	const mediaType = normalizeImageMediaType(rawMediaType);
	const data = rawData.replace(/\s+/g, "");
	if (!mediaType || !data) return null;
	if (!SUPPORTED_IMAGE_MEDIA_TYPES.has(mediaType)) return null;
	if (!isValidBase64(data)) return null;
	const decodedBytes = decodedBase64Length(data);
	if (decodedBytes <= 0 || decodedBytes > MAX_AGENT_PROMPT_IMAGE_DECODED_BYTES) return null;
	if (!matchesImageMagicBytes(mediaType, data)) return null;
	return {
		decodedBytes,
		image: {
			type: "image",
			source: {
				type: "base64",
				media_type: mediaType,
				data
			}
		}
	};
}
function normalizeImageMediaType(value) {
	const mediaType = value?.trim().toLowerCase();
	if (!mediaType) return null;
	if (mediaType === "image/jpg") return "image/jpeg";
	return mediaType;
}
function isValidBase64(value) {
	if (value.length % 4 === 1) return false;
	if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return false;
	const firstPadding = value.indexOf("=");
	return firstPadding === -1 || /^[A-Za-z0-9+/]+={1,2}$/.test(value);
}
function decodedBase64Length(value) {
	const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
	return Math.floor(value.length * 3 / 4) - padding;
}
function matchesImageMagicBytes(mediaType, base64) {
	const header = decodeBase64Header(base64);
	if (!header) return false;
	if (mediaType === "image/png") return [
		137,
		80,
		78,
		71,
		13,
		10,
		26,
		10
	].every((byte, index) => header[index] === byte);
	if (mediaType === "image/jpeg") return header[0] === 255 && header[1] === 216;
	if (mediaType === "image/webp") return header[0] === 82 && header[1] === 73 && header[2] === 70 && header[3] === 70 && header[8] === 87 && header[9] === 69 && header[10] === 66 && header[11] === 80;
	return false;
}
function decodeBase64Header(base64) {
	try {
		const prefix = base64.slice(0, 24);
		const decoded = atob(prefix);
		return Array.from(decoded, (char) => char.charCodeAt(0));
	} catch {
		return null;
	}
}
function extractUserPromptPayload(messages) {
	if (!messages || messages.length === 0) return null;
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i];
		if (!message || message.role !== "user") continue;
		if (typeof message.content === "string") return {
			prompt: message.content,
			images: undefined
		};
		if (!Array.isArray(message.content)) continue;
		const text = message.content.filter((part) => part.type === "text" && typeof part.text === "string").map((part) => part.text).join("\n");
		const images = [];
		let totalDecodedBytes = 0;
		for (const part of message.content) {
			if (part.type !== "image_url") continue;
			if (images.length >= MAX_AGENT_PROMPT_IMAGES) throw new AgentPromptPayloadError("Too many image attachments for 3D-Agent.");
			const decoded = dataUrlToImageBlock(part.image_url);
			if (!decoded) throw new AgentPromptPayloadError("Image attachments must be PNG, JPEG, or WebP data URLs under the 3D-Agent image limit.");
			if (totalDecodedBytes + decoded.decodedBytes > MAX_AGENT_PROMPT_TOTAL_IMAGE_DECODED_BYTES) throw new AgentPromptPayloadError("Image attachments exceed the 3D-Agent image limit.");
			totalDecodedBytes += decoded.decodedBytes;
			images.push(decoded.image);
		}
		if (text || images.length > 0) return {
			prompt: text,
			images: images.length > 0 ? images : undefined
		};
	}
	return null;
}

//#endregion
//#region src/streaming.ts
function chunkWithDelta(chunkId, delta, finishReason = null) {
	return {
		id: chunkId,
		object: "chat.completion.chunk",
		created: Math.floor(Date.now() / 1e3),
		model: "3d-agent",
		choices: [{
			index: 0,
			delta,
			finish_reason: finishReason
		}]
	};
}
function makeReasoningChunk(chunkId, reasoning) {
	return chunkWithDelta(chunkId, {
		role: "assistant",
		reasoning_content: reasoning
	});
}
function makeChunk(chunkId, content, finishReason = null) {
	return chunkWithDelta(chunkId, content ? {
		content,
		role: "assistant"
	} : {}, finishReason);
}
var init_streaming$1 = __esm({ "src/streaming.ts"() {} });

//#endregion
//#region src/codex-app-server/account-scope-resolver.ts
const MAX_ACCOUNT_SCOPE_LENGTH = 256;
const SAFE_ACCOUNT_SCOPE = /^[A-Za-z0-9._:-]+$/;
const jwtLikeIdentifier$1 = /(?:^|[_.:-])[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}(?:$|[_.:-])/;
var CodexAppServerAccountScopeResolverError = class extends Error {
	constructor(code) {
		super(`Codex app-server account scope resolver failed: ${code}`);
		this.code = code;
		this.name = "CodexAppServerAccountScopeResolverError";
	}
};
function createResolvedCodexAppServerAccountScopeResolver(accountScope, source) {
	return { async resolve() {
		return {
			accountScope: normalizeCodexAppServerAccountScope(accountScope),
			source
		};
	} };
}
function normalizeCodexAppServerAccountScope(value) {
	if (typeof value !== "string") throw new CodexAppServerAccountScopeResolverError("missing_account_scope");
	const trimmed = value.trim();
	if (!trimmed) throw new CodexAppServerAccountScopeResolverError("missing_account_scope");
	if (trimmed !== value || trimmed.length > MAX_ACCOUNT_SCOPE_LENGTH || !SAFE_ACCOUNT_SCOPE.test(trimmed) || isSensitiveIdentifier(trimmed)) throw new CodexAppServerAccountScopeResolverError("invalid_account_scope");
	return trimmed;
}
function isSensitiveIdentifier(value) {
	return /OPENAI_API_KEY/i.test(value) || /refresh[_-]?token/i.test(value) || /access[_-]?token/i.test(value) || /authorization/i.test(value) || /\bBearer\b/i.test(value) || /(?:^|[_.:-])(?:sk|rk|sb_secret)-[A-Za-z0-9]/i.test(value) || jwtLikeIdentifier$1.test(value);
}

//#endregion
//#region src/codex-app-server/runtime-selector.ts
const CODEX_APP_SERVER_RUNTIME_FLAG = "THREEDAGENT_CODEX_APP_SERVER";
function selectCodexAgentRuntime(_rawValue) {
	return {
		flag: CODEX_APP_SERVER_RUNTIME_FLAG,
		reason: "default-codex-app-server",
		runtime: "codex-app-server"
	};
}

//#endregion
//#region src/codex-app-server/tauri-account-scope.ts
const MAX_SESSION_TOKEN_LENGTH = 8192;
const JWT_SEGMENT = /^[A-Za-z0-9_-]+$/;
const JWT_PARTS = 3;
const SESSION_TOKEN_TIMEOUT_MS = 5e3;
const SESSION_TOKEN_TIMEOUT = Symbol("session-token-timeout");
const SUPABASE_USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let cachedInvoke$1 = null;
async function resolveTauriCodexAppServerAccountScope(opts = {}) {
	const token = await withTimeout$1((opts.getSessionToken ?? getTauriSessionToken)(), SESSION_TOKEN_TIMEOUT_MS);
	const payload = parseSessionJwt(token);
	const nowSeconds = Math.floor((opts.nowMs?.() ?? Date.now()) / 1e3);
	if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp) || payload.exp <= nowSeconds) throw invalidAccountScope();
	if (typeof payload.sub !== "string" || !SUPABASE_USER_ID.test(payload.sub)) throw invalidAccountScope();
	return normalizeCodexAppServerAccountScope(`user:${payload.sub}`);
}
async function withTimeout$1(promise, timeoutMs) {
	let timeout;
	try {
		const result = await Promise.race([promise, new Promise((resolve$1) => {
			timeout = setTimeout(() => resolve$1(SESSION_TOKEN_TIMEOUT), timeoutMs);
		})]);
		if (result === SESSION_TOKEN_TIMEOUT) throw invalidAccountScope();
		return result;
	} finally {
		if (timeout) clearTimeout(timeout);
	}
}
async function getTauriSessionToken() {
	const invoke$2 = await loadInvoke$1();
	if (!invoke$2) return undefined;
	try {
		return await invoke$2("get_session_token");
	} catch {
		return undefined;
	}
}
async function loadInvoke$1() {
	if (cachedInvoke$1) return cachedInvoke$1;
	try {
		const mod = await Promise.resolve().then(function() {
			return init_core$1(), core_exports;
		});
		cachedInvoke$1 = mod.invoke;
		return cachedInvoke$1;
	} catch {
		return null;
	}
}
function parseSessionJwt(token) {
	if (typeof token !== "string") throw new CodexAppServerAccountScopeResolverError("missing_account_scope");
	if (token.trim() !== token || token.length === 0 || token.length > MAX_SESSION_TOKEN_LENGTH || /[\s\x00-\x1f\x7f]/.test(token)) throw invalidAccountScope();
	const parts = token.split(".");
	if (parts.length !== JWT_PARTS || parts.some((part) => !JWT_SEGMENT.test(part))) throw invalidAccountScope();
	try {
		const payloadSegment = parts[1];
		if (!payloadSegment) throw invalidAccountScope();
		const payload = JSON.parse(decodeBase64Url(payloadSegment));
		if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw invalidAccountScope();
		return payload;
	} catch (error) {
		if (error instanceof CodexAppServerAccountScopeResolverError) throw error;
		throw invalidAccountScope();
	}
}
function decodeBase64Url(value) {
	const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
	const binary = globalThis.atob(padded);
	const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
	return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
function invalidAccountScope() {
	return new CodexAppServerAccountScopeResolverError("invalid_account_scope");
}

//#endregion
//#region src/codex-app-server/tauri-runtime.ts
function createTauriCodexAppServerAdapters(commandModule, fsDeps = {}, opts = {}) {
	return {
		allowPathFallback: opts.allowPathFallback ?? false,
		exec: createTauriCodexExec(commandModule),
		fs: createTauriCodexHomeFS(fsDeps),
		spawner: createTauriCodexProcessSpawner(commandModule)
	};
}
function createTauriCodexExec(commandModule) {
	return async (program, args, options) => {
		assertCodexCommandShape(program, args, TAURI_CODEX_VERSION_ARGS, "codex version probe");
		const command = commandModule.sidecar(TAURI_CODEX_COMMAND, [...TAURI_CODEX_VERSION_ARGS], { env: options?.env });
		const output = await withTimeout(command.execute(), options?.timeoutMs, "codex --version timed out");
		return normalizeShellOutput(output);
	};
}
function createTauriCodexProcessSpawner(commandModule) {
	return { async spawn(program, args, options) {
		assertCodexCommandShape(program, args, TAURI_CODEX_APP_SERVER_ARGS, "codex app-server");
		const command = commandModule.sidecar(TAURI_CODEX_COMMAND, [...TAURI_CODEX_APP_SERVER_ARGS], {
			encoding: "raw",
			env: options.env
		});
		const stdout = shellOutputToAsyncIterable(command, command.stdout);
		const stderr = shellOutputToAsyncIterable(command, command.stderr);
		const child = await command.spawn();
		return {
			kill: () => child.kill(),
			pid: child.pid,
			stderr,
			stdin: { write: (line) => child.write(line) },
			stdout
		};
	} };
}
function createTauriCodexHomeFS(deps = {}) {
	const fs$1 = deps.fs ?? fs;
	const getDataDir = deps.getDataDir ?? getJanDataFolderPath;
	const joinPath$1 = deps.joinPath ?? joinPath;
	return {
		getDataDir,
		joinPath: joinPath$1,
		mkdir: (path) => fs$1.mkdir(path),
		writeTextFile: (path, contents) => fs$1.writeFileSync(path, contents)
	};
}
function createTauriCodexThreadMapStoreFS(deps = {}) {
	const fs$1 = deps.fs ?? fs;
	const getDataDir = deps.getDataDir ?? getJanDataFolderPath;
	const joinPath$1 = deps.joinPath ?? joinPath;
	async function fileExists(path) {
		const exists = await fs$1.existsSync(path);
		if (typeof exists !== "boolean") throw new Error("Tauri core bridge unavailable for thread map filesystem access");
		return exists;
	}
	return {
		getDataDir,
		async getFileSize(path) {
			if (!await fileExists(path)) throw missingFileError();
			const stat = await fs$1.fileStat(path);
			if (!stat) throw missingFileError();
			return stat.size;
		},
		joinPath: joinPath$1,
		mkdir: (path) => fs$1.mkdir(path),
		async readTextFile(path) {
			if (!await fileExists(path)) throw missingFileError();
			const contents = await fs$1.readFileSync(path);
			if (typeof contents !== "string") throw new Error("Tauri filesystem returned non-text thread map contents");
			return contents;
		},
		writeTextFile: (path, contents) => fs$1.writeFileSync(path, contents)
	};
}
function assertCodexCommandShape(program, args, expectedArgs, label) {
	if (program !== TAURI_CODEX_COMMAND || !sameArgs(args, expectedArgs)) throw new Error(`Refusing unsupported Tauri Codex ${label} command: ${JSON.stringify({
		args,
		program
	})}`);
}
function sameArgs(actual, expected) {
	return actual.length === expected.length && actual.every((arg, index) => arg === expected[index]);
}
function normalizeShellOutput(output) {
	return {
		code: output.code,
		stderr: output.stderr ? outputToString(output.stderr) : "",
		stdout: outputToString(output.stdout)
	};
}
function outputToString(value) {
	if (typeof value === "string") return value;
	return new TextDecoder("utf-8", { fatal: false }).decode(value);
}
function missingFileError() {
	const error = new Error("Codex app-server thread map file is missing");
	error.code = "ENOENT";
	return error;
}
async function withTimeout(promise, timeoutMs, message) {
	if (!timeoutMs || timeoutMs <= 0) return promise;
	let timeout;
	try {
		return await Promise.race([promise, new Promise((_resolve, reject) => {
			timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
		})]);
	} finally {
		if (timeout) clearTimeout(timeout);
	}
}
function shellOutputToAsyncIterable(command, emitter) {
	const queue = [];
	const waiters = [];
	let closed = false;
	const push = (result) => {
		if (result.kind !== "value") {
			const pending$1 = waiters.splice(0);
			if (pending$1.length > 0) {
				for (const waiter$1 of pending$1) waiter$1(result);
				return;
			}
		}
		const waiter = waiters.shift();
		if (waiter) {
			waiter(result);
			return;
		}
		queue.push(result);
	};
	emitter.on("data", (payload) => {
		if (!closed) push({
			kind: "value",
			value: payload
		});
	});
	command.on("error", (payload) => {
		if (!closed) {
			closed = true;
			push({
				error: new Error(String(payload)),
				kind: "error"
			});
		}
	});
	command.on("close", () => {
		if (!closed) {
			closed = true;
			push({ kind: "done" });
		}
	});
	const toIteratorResult = (item) => {
		if (item.kind === "value") return {
			done: false,
			value: item.value
		};
		if (item.kind === "error") throw item.error;
		return {
			done: true,
			value: undefined
		};
	};
	return { [Symbol.asyncIterator]() {
		return { next: async () => {
			const queued = queue.shift();
			if (queued) return toIteratorResult(queued);
			if (closed) return {
				done: true,
				value: undefined
			};
			const queuedItem = await new Promise((resolve$1) => waiters.push(resolve$1));
			return toIteratorResult(queuedItem);
		} };
	} };
}
var TAURI_CODEX_COMMAND, TAURI_CODEX_VERSION_ARGS, TAURI_CODEX_APP_SERVER_ARGS;
var init_tauri_runtime = __esm({ "src/codex-app-server/tauri-runtime.ts"() {
	TAURI_CODEX_COMMAND = "resources/bin/codex";
	TAURI_CODEX_VERSION_ARGS = ["--version"];
	TAURI_CODEX_APP_SERVER_ARGS = [
		"app-server",
		"--listen",
		"stdio://"
	];
} });

//#endregion
//#region src/handled-sentry.ts
function setSentryCodexVersion(version) {
	if (typeof version === "string" && version.length > 0) resolvedCodexVersion = version;
}
async function loadTauriInvoke$1() {
	try {
		const mod = await Promise.resolve().then(function() {
			return init_core$1(), core_exports;
		});
		return mod.invoke;
	} catch {
		return null;
	}
}
async function capturePromptFailure(failure, opts = {}) {
	const invoke$2 = opts.invoke ?? await loadTauriInvoke$1();
	if (!invoke$2) return;
	const extras = definedContext(opts.extras);
	const tags = definedContext({
		codex_version: resolvedCodexVersion,
		...opts.tags
	});
	try {
		await invoke$2("capture_handled_sentry_error", { input: {
			area: "prompt",
			failure,
			level: opts.level ?? "error",
			...opts.detail ? { detail: opts.detail } : {},
			...Object.keys(extras).length > 0 ? { extras } : {},
			...Object.keys(tags).length > 0 ? { tags } : {}
		} });
	} catch {}
}
function definedContext(context) {
	const out = {};
	for (const [key, value] of Object.entries(context ?? {})) if (value !== undefined) out[key] = value;
	return out;
}
function markPromptFailureCaptured(err) {
	if (!err || typeof err !== "object") return;
	try {
		Object.defineProperty(err, PROMPT_FAILURE_CAPTURED_FLAG, {
			value: true,
			enumerable: false,
			writable: false,
			configurable: false
		});
	} catch {}
}
function isPromptFailureCaptured(err) {
	if (typeof err !== "object" || err === null) return false;
	try {
		return err[PROMPT_FAILURE_CAPTURED_FLAG] === true;
	} catch {
		return false;
	}
}
var resolvedCodexVersion, PROMPT_FAILURE_CAPTURED_FLAG;
var init_handled_sentry = __esm({ "src/handled-sentry.ts"() {
	PROMPT_FAILURE_CAPTURED_FLAG = "__threedagentPromptFailureCaptured";
} });

//#endregion
//#region src/codex-app-server/runtime.ts
async function ensureCodexAppServerRuntime(opts) {
	const minVersion = opts.expectedVersion ?? CODEX_CLI_MIN_VERSION;
	const candidate = selectCandidate(opts);
	if (!candidate) {
		const failure = new CodexAppServerRuntimeError("codex app-server binary not configured", {
			allowPathFallback: String(Boolean(opts.allowPathFallback)),
			minVersion
		});
		captureRuntimeFailure("codex_binary_missing", failure);
		throw failure;
	}
	let version;
	try {
		version = await readCodexVersion({
			codexBin: candidate.codexBin,
			exec: opts.exec,
			timeoutMs: opts.timeoutMs
		});
		if (!meetsFloor(version, minVersion)) throw new CodexAppServerRuntimeError("codex app-server binary version too old", {
			actualVersion: version,
			codexBin: candidate.codexBin,
			minVersion,
			source: candidate.source
		});
	} catch (err) {
		if (err instanceof CodexAppServerRuntimeError) captureRuntimeFailure("codex_version_probe_failed", err);
		throw err;
	}
	return {
		codexBin: candidate.codexBin,
		expectedVersion: minVersion,
		source: candidate.source,
		version
	};
}
function promptFailureDetail(err) {
	return `${err.message} ${JSON.stringify(err.diagnostics)}`.slice(0, 1e3);
}
/**
* Fire-and-forget Sentry capture for a prompt-blocking runtime preflight
* failure. Marks the error so the handoff envelope does not double-report
* it. Never throws (capturePromptFailure and markPromptFailureCaptured both
* swallow internally) and never changes what the user sees; the Rust sink
* redacts and truncates `detail` again (diagnostics are already redacted by
* the CodexAppServerRuntimeError constructor).
*/
function captureRuntimeFailure(failure, err) {
	void capturePromptFailure(failure, { detail: promptFailureDetail(err) });
	markPromptFailureCaptured(err);
}
/** Parses "codex-cli X.Y.Z" → [X,Y,Z]; throws on any other shape. */
function parseCodexCliVersionTuple(banner) {
	const match = /^codex-cli (\d+)\.(\d+)\.(\d+)/.exec(banner.trim());
	if (!match) throw new CodexAppServerRuntimeError("unparseable codex version banner", { banner });
	return [
		Number(match[1]),
		Number(match[2]),
		Number(match[3])
	];
}
/** True when `actual` is at or above the `floor` banner (numeric semver compare). */
function meetsFloor(actual, floor) {
	const [aMajor, aMinor, aPatch] = parseCodexCliVersionTuple(actual);
	const [fMajor, fMinor, fPatch] = parseCodexCliVersionTuple(floor);
	if (aMajor !== fMajor) return aMajor > fMajor;
	if (aMinor !== fMinor) return aMinor > fMinor;
	return aPatch >= fPatch;
}
function parseCodexCliVersion(stdout) {
	return stdout.split(/\r?\n/).map((line) => line.trim()).find((line) => line.length > 0) ?? "";
}
function redactDiagnostics(input) {
	const out = {};
	for (const [key, value] of Object.entries(input)) out[key] = redactSensitiveText(value);
	return out;
}
function containsSensitiveText(value) {
	return sensitiveTextPatterns.some((pattern) => pattern.test(value));
}
function redactSensitiveText(value) {
	return value.replace(/data:image\/[A-Za-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi, "[redacted-image]").replace(/(authorization:\s*bearer\s+)[^\s]+/gi, "$1[redacted]").replace(/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret)=)[^\s]+/gi, "$1[redacted]").replace(/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|token)["']?\s*:\s*["']?)[^"',}\s]+/gi, "$1[redacted]").replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[redacted]").replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[redacted]").replace(/\b(?:sk|rk)-[A-Za-z0-9._-]+/gi, "[redacted]").replace(/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9._-]+/gi, "[redacted]").replace(/\bsb_secret_[A-Za-z0-9._-]+/gi, "[redacted]");
}
function selectCandidate(opts) {
	if (opts.bundledCodexBin) return {
		codexBin: opts.bundledCodexBin,
		source: "bundled"
	};
	if (opts.envCodexBin) return {
		codexBin: opts.envCodexBin,
		source: "env"
	};
	if (opts.allowPathFallback) return {
		codexBin: "codex",
		source: "path"
	};
	return null;
}
async function readCodexVersion(opts) {
	let result;
	try {
		result = await opts.exec(opts.codexBin, ["--version"], { timeoutMs: opts.timeoutMs });
	} catch (err) {
		throw new CodexAppServerRuntimeError("codex --version failed", {
			codexBin: opts.codexBin,
			error: err instanceof Error ? err.message : String(err)
		});
	}
	const version = parseCodexCliVersion(result.stdout);
	if (result.code !== 0 || !version) throw new CodexAppServerRuntimeError("codex --version returned no usable version", {
		codexBin: opts.codexBin,
		exitCode: String(result.code),
		stderr: result.stderr ?? "",
		stdout: result.stdout
	});
	return version;
}
var CODEX_CLI_MIN_VERSION, CodexAppServerRuntimeError, sensitiveTextPatterns;
var init_runtime = __esm({ "src/codex-app-server/runtime.ts"() {
	init_handled_sentry();
	CODEX_CLI_MIN_VERSION = "codex-cli 0.130.0";
	CodexAppServerRuntimeError = class extends Error {
		diagnostics;
		constructor(message, diagnostics = {}) {
			super(message);
			this.name = "CodexAppServerRuntimeError";
			this.diagnostics = redactDiagnostics(diagnostics);
		}
	};
	sensitiveTextPatterns = [
		/OPENAI_API_KEY/i,
		/(?:api[_-]?key|access[_-]?token|refresh[_-]?token|oauth[_-]?token|secret)\s*[:=]/i,
		/data:image\/[A-Za-z0-9.+-]+;base64,/i,
		/authorization:\s*bearer\s+/i,
		/\bBearer\s+[A-Za-z0-9._~+/=-]+/i,
		/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
		/\b(?:sk|rk)-[A-Za-z0-9._-]+/i,
		/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9._-]+/i,
		/\bsb_secret_[A-Za-z0-9._-]+/i
	];
} });

//#endregion
//#region src/codex-app-server/jsonrpc.ts
function makeJsonRpcRequest(id, method, params) {
	if (!method) throw new Error("JSON-RPC method is required");
	return params === undefined ? {
		jsonrpc: "2.0",
		id,
		method
	} : {
		jsonrpc: "2.0",
		id,
		method,
		params
	};
}
function makeJsonRpcNotification(method, params) {
	if (!method) throw new Error("JSON-RPC method is required");
	return params === undefined ? {
		jsonrpc: "2.0",
		method
	} : {
		jsonrpc: "2.0",
		method,
		params
	};
}
function jsonRpcResult(id, result) {
	return {
		jsonrpc: "2.0",
		id,
		result
	};
}
function encodeJsonRpcLine(message) {
	return `${JSON.stringify(jsonRpcMessageToWire(message))}\n`;
}
function parseJsonRpcLine(line) {
	const trimmed = line.trim();
	if (!trimmed) return null;
	let parsed;
	try {
		parsed = JSON.parse(trimmed);
	} catch {
		return null;
	}
	if (!isRecord$2(parsed)) return null;
	if (Object.hasOwn(parsed, "jsonrpc") && parsed.jsonrpc !== "2.0") return null;
	const normalized = Object.hasOwn(parsed, "jsonrpc") ? parsed : {
		jsonrpc: "2.0",
		...parsed
	};
	const id = normalized.id;
	const method = normalized.method;
	if ((typeof id === "string" || typeof id === "number") && typeof method === "string") return normalized;
	if (id === undefined && typeof method === "string") return normalized;
	if ((typeof id === "string" || typeof id === "number") && (Object.hasOwn(normalized, "result") || Object.hasOwn(normalized, "error"))) return normalized;
	return null;
}
function isJsonRpcRequest(message) {
	return Object.hasOwn(message, "id") && Object.hasOwn(message, "method");
}
function isJsonRpcResponse(message) {
	return Object.hasOwn(message, "id") && (Object.hasOwn(message, "result") || Object.hasOwn(message, "error")) && !Object.hasOwn(message, "method");
}
function isRecord$2(value) {
	return typeof value === "object" && value !== null;
}
function jsonRpcMessageToWire(message) {
	const wireMessage = {};
	for (const [key, value] of Object.entries(message)) if (key !== "jsonrpc") wireMessage[key] = value;
	return wireMessage;
}
var init_jsonrpc = __esm({ "src/codex-app-server/jsonrpc.ts"() {} });

//#endregion
//#region src/codex-app-server/events.ts
function classifyCodexAppServerMessage(message) {
	if (isJsonRpcResponse(message)) return classifyResponse(message);
	if (isJsonRpcRequest(message)) return classifyServerRequest(message);
	return classifyNotification(message);
}
/** Summarizes JSON-RPC responses without retaining result or error payload data. */
function classifyResponse(message) {
	const error = asRecord$3(message.error);
	return {
		kind: "response",
		id: message.id,
		ok: !error,
		errorCode: typeof error?.code === "number" ? error.code : undefined,
		stopReason: stopReasonFromError(error),
		hasErrorData: Boolean(error && Object.hasOwn(error, "data"))
	};
}
/** Routes app-server notifications into lifecycle, delta, patch, or unknown events. */
function classifyNotification(message) {
	const params = asRecord$3(message.params);
	if (message.method === "account/login/completed") {
		if (typeof params?.success !== "boolean") return unknown(message, "notification", "malformed-params");
		return {
			kind: "account-login-completed",
			method: message.method,
			success: params.success,
			hasError: typeof params.error === "string" && params.error.length > 0
		};
	}
	if (message.method === "error") return classifyTurnErrorNotification(params);
	if (LIFECYCLE_METHODS.has(message.method)) return {
		kind: "lifecycle",
		method: message.method,
		threadId: params ? lifecycleThreadId(params) : undefined,
		turnId: params ? lifecycleTurnId(params) : undefined,
		turnStatus: params ? lifecycleTurnStatus(params) : undefined
	};
	if (ITEM_METHODS.has(message.method)) {
		if (!params) return unknown(message, "notification", "malformed-params");
		return classifyItemNotification(message.method, params);
	}
	if (NATIVE_METADATA_METHODS.has(message.method)) return nativeCodexEvent(message.method, params ?? {});
	if (message.method === "item/agentMessage/delta") {
		const delta = params ? firstString$2(params, ["delta", "text"]) : undefined;
		if (delta === undefined) return unknown(message, "notification", "malformed-params");
		return {
			kind: "agent-text-delta",
			method: message.method,
			delta,
			itemId: params ? firstString$2(params, ["itemId", "item_id"]) : undefined,
			threadId: params ? firstString$2(params, ["threadId", "thread_id"]) : undefined
		};
	}
	if (REASONING_METHODS.has(message.method)) {
		const delta = params ? firstString$2(params, ["delta", "text"]) : undefined;
		if (delta === undefined) return unknown(message, "notification", "malformed-params");
		return {
			kind: "reasoning-delta",
			method: message.method,
			delta,
			itemId: params ? firstString$2(params, ["itemId", "item_id"]) : undefined,
			summary: message.method === "item/reasoning/summaryTextDelta",
			threadId: params ? firstString$2(params, ["threadId", "thread_id"]) : undefined
		};
	}
	if (PLAN_DELTA_METHODS.has(message.method)) {
		const delta = params ? firstString$2(params, ["delta", "text"]) : undefined;
		if (delta === undefined) return unknown(message, "notification", "malformed-params");
		return {
			kind: "plan-delta",
			method: message.method,
			delta,
			itemId: params ? firstString$2(params, ["itemId", "item_id"]) : undefined,
			threadId: params ? firstString$2(params, ["threadId", "thread_id"]) : undefined
		};
	}
	if (message.method === "command/exec/outputDelta") {
		const deltaBase64 = params ? firstString$2(params, ["deltaBase64"]) : undefined;
		if (deltaBase64 === undefined) return unknown(message, "notification", "malformed-params");
		return {
			kind: "command-output-delta",
			method: message.method,
			processId: params ? firstString$2(params, ["processId", "process_id"]) : undefined,
			stream: params ? streamName(params.stream) : undefined,
			deltaBase64Length: deltaBase64.length,
			capReached: typeof params?.capReached === "boolean" ? params.capReached : undefined
		};
	}
	if (message.method === "serverRequest/resolved") {
		if (!params) return unknown(message, "notification", "malformed-params");
		return {
			kind: "server-request-resolved",
			method: message.method,
			requestId: firstString$2(params, [
				"requestId",
				"request_id",
				"serverRequestId"
			]),
			threadId: firstString$2(params, ["threadId", "thread_id"])
		};
	}
	if (message.method === "item/fileChange/patchUpdated") return {
		kind: "file-change-patch-updated",
		method: message.method,
		itemId: params ? firstString$2(params, ["itemId", "item_id"]) : undefined
	};
	return unknown(message, "notification", "unrecognized-method");
}
/** Routes app-server requests into approval, auth refresh, tool-call, or unknown events. */
function classifyServerRequest(message) {
	if (APPROVAL_METHODS.has(message.method)) return {
		kind: "approval-request",
		method: message.method,
		requestId: message.id,
		approvalKind: approvalKind(message.method)
	};
	if (message.method === "account/chatgptAuthTokens/refresh") return {
		kind: "auth-refresh-request",
		method: message.method,
		requestId: message.id
	};
	if (message.method === "item/tool/call") {
		const params = asRecord$3(message.params);
		return {
			kind: "tool-call-request",
			method: message.method,
			requestId: message.id,
			toolName: params ? firstString$2(params, [
				"tool",
				"toolName",
				"name"
			]) : undefined
		};
	}
	if (message.method === "item/tool/requestUserInput") {
		const params = asRecord$3(message.params);
		const questions = params ? userInputQuestions(params.questions) : undefined;
		return {
			kind: "user-input-request",
			method: message.method,
			requestId: message.id,
			itemId: params ? firstString$2(params, ["itemId", "item_id"]) : undefined,
			questionCount: Array.isArray(params?.questions) ? params.questions.length : undefined,
			questions,
			threadId: params ? firstString$2(params, ["threadId", "thread_id"]) : undefined,
			turnId: params ? firstString$2(params, ["turnId", "turn_id"]) : undefined
		};
	}
	if (message.method === "mcpServer/elicitation/request") {
		const params = asRecord$3(message.params);
		return {
			kind: "elicitation-request",
			method: message.method,
			requestId: message.id,
			mode: params ? elicitationMode(params.mode) : undefined,
			serverName: params ? firstString$2(params, ["serverName", "server_name"]) : undefined,
			threadId: params ? firstString$2(params, ["threadId", "thread_id"]) : undefined,
			turnId: params ? firstString$2(params, ["turnId", "turn_id"]) : undefined
		};
	}
	return unknown(message, "server-request", "unrecognized-method");
}
/** Keeps native item/subagent progress visible without copying raw item payloads. */
function classifyItemNotification(method, params) {
	const item = asRecord$3(params.item) ?? params;
	const itemType = firstString$2(item, ["type"]);
	const itemId = firstString$2(item, [
		"id",
		"itemId",
		"item_id"
	]);
	const itemStatus = firstString$2(item, ["status"]);
	const threadId = lifecycleThreadId(params);
	const turnId = lifecycleTurnId(params);
	if (hasNativeSubagentItemMetadata(item, itemType)) {
		const agentsStates = asRecord$3(item.agentsStates) ?? asRecord$3(item.agents_states);
		return nativeCodexEvent(method, params, {
			isSubagent: true,
			agentStateCount: agentsStates ? Object.keys(agentsStates).length : undefined,
			itemId,
			itemStatus,
			itemType,
			receiverThreadIds: firstStringArray(item, ["receiverThreadIds", "receiver_thread_ids"]),
			senderThreadId: firstString$2(item, ["senderThreadId", "sender_thread_id"]),
			subagentPrompt: firstString$2(item, ["prompt"]),
			threadId,
			tool: firstString$2(item, [
				"tool",
				"toolName",
				"name"
			]),
			turnId
		});
	}
	const answerText = method === "item/completed" && itemType !== undefined && ANSWER_ITEM_TYPES.has(itemType.toLowerCase()) ? firstString$2(item, ["text"]) : undefined;
	return {
		kind: "item-status",
		method,
		itemId,
		itemStatus,
		itemType,
		threadId,
		turnId,
		...answerText ? { answerText } : {}
	};
}
function nativeCodexEvent(method, params, overrides = {}) {
	const item = asRecord$3(params.item) ?? params;
	return {
		kind: "native-codex-event",
		method,
		agentNickname: firstString$2(item, ["agentNickname", "agent_nickname"]),
		agentRole: firstString$2(item, ["agentRole", "agent_role"]),
		itemCount: Array.isArray(params.data) ? params.data.length : undefined,
		itemId: firstString$2(item, [
			"id",
			"itemId",
			"item_id"
		]),
		itemStatus: firstString$2(item, ["status"]),
		itemType: firstString$2(item, ["type"]),
		receiverThreadIds: firstStringArray(item, ["receiverThreadIds", "receiver_thread_ids"]),
		senderThreadId: firstString$2(item, ["senderThreadId", "sender_thread_id"]),
		serverName: firstString$2(params, [
			"serverName",
			"server_name",
			"name"
		]),
		status: firstString$2(params, ["status"]),
		threadId: lifecycleThreadId(params),
		threadSource: firstString$2(item, ["threadSource", "thread_source"]),
		threadSourceKind: firstString$2(item, ["threadSourceKind", "thread_source_kind"]),
		tool: firstString$2(item, [
			"tool",
			"toolName",
			"name"
		]),
		turnId: lifecycleTurnId(params),
		...overrides
	};
}
function subagentToolPhase(tool) {
	return tool && Object.hasOwn(SUBAGENT_TOOL_PHASES, tool) ? SUBAGENT_TOOL_PHASES[tool] : undefined;
}
/** Detects native Codex child-agent markers without retaining the raw item payload. */
function hasNativeSubagentItemMetadata(item, itemType) {
	if (itemType === "collabAgentToolCall") return true;
	if (subagentToolPhase(firstString$2(item, [
		"tool",
		"toolName",
		"name"
	]))) return true;
	if (firstString$2(item, ["threadSource", "thread_source"]) === "subagent") return true;
	const threadSourceKind = firstString$2(item, ["threadSourceKind", "thread_source_kind"]);
	if (threadSourceKind?.startsWith("subAgent")) return true;
	if (firstString$2(item, ["agentNickname", "agent_nickname"])) return true;
	if (firstString$2(item, ["agentRole", "agent_role"])) return true;
	if (firstString$2(item, ["senderThreadId", "sender_thread_id"])) return true;
	if (firstStringArray(item, ["receiverThreadIds", "receiver_thread_ids"]).length > 0) return true;
	return asRecord$3(item.agentsStates) !== null || asRecord$3(item.agents_states) !== null;
}
/** Maps each app-server approval method to the adapter-facing approval family. */
function approvalKind(method) {
	if (method === "item/commandExecution/requestApproval" || method === "execCommandApproval") return "command-execution";
	if (method === "item/fileChange/requestApproval" || method === "applyPatchApproval") return "file-change";
	return "permissions";
}
/** Narrows MCP elicitation modes to the generated schema values. */
function elicitationMode(value) {
	if (value === "form" || value === "url") return value;
	return undefined;
}
function userInputQuestions(value) {
	if (!Array.isArray(value)) return undefined;
	const questions = value.map(userInputQuestion).filter((question) => question !== null);
	return questions.length > 0 ? questions : undefined;
}
function userInputQuestion(value) {
	const question = asRecord$3(value);
	if (!question) return null;
	const id = firstString$2(question, ["id"]);
	const header = firstString$2(question, ["header"]);
	const text = firstString$2(question, ["question"]);
	if (id === undefined || header === undefined || text === undefined) return null;
	const options = userInputQuestionOptions(question.options);
	return {
		id,
		header,
		question: text,
		isOther: question.isOther === true || question.is_other === true,
		isSecret: question.isSecret === true || question.is_secret === true,
		...options ? { options } : {}
	};
}
function userInputQuestionOptions(value) {
	if (!Array.isArray(value)) return undefined;
	const options = value.map((item) => {
		const option = asRecord$3(item);
		const label = option ? firstString$2(option, ["label"]) : undefined;
		if (label === undefined) return null;
		const description = option ? firstString$2(option, ["description"]) : undefined;
		return {
			label,
			...description !== undefined ? { description } : {}
		};
	}).filter((option) => option !== null);
	return options.length > 0 ? options : undefined;
}
/**
* Classifies the codex app-server `error` notification — the protocol's
* turn-failure surface (`{error: {message, codexErrorInfo}, willRetry}`).
* Dropping it is what produced the blank "3D-Agent produced no output."
* terminal (issue #1063): the turn died (gateway unreachable, 401, …) and the
* only message naming the cause never became a chunk.
*/
function classifyTurnErrorNotification(params) {
	const error = params ? asRecord$3(params.error) : null;
	const message = error ? firstString$2(error, ["message"]) : undefined;
	const base = {
		kind: "turn-error",
		method: "error",
		willRetry: params?.willRetry === true,
		threadId: params ? firstString$2(params, ["threadId", "thread_id"]) : undefined,
		turnId: params ? firstString$2(params, ["turnId", "turn_id"]) : undefined
	};
	if (message === undefined) return {
		...base,
		message: ""
	};
	const info = normalizeCodexErrorInfo(error?.codexErrorInfo);
	return {
		...base,
		message: message.slice(0, TURN_ERROR_MESSAGE_MAX_CHARS),
		codexErrorInfo: info?.code,
		httpStatusCode: info?.httpStatusCode,
		stopReason: stopReasonFromCodexErrorInfo(info)
	};
}
/**
* Normalizes `codexErrorInfo` (a string enum like "unauthorized" OR a
* single-key object variant like `{httpConnectionFailed: {httpStatusCode}}`)
* into one bounded discriminant plus the optional upstream HTTP status.
*/
function normalizeCodexErrorInfo(value) {
	if (typeof value === "string" && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(value)) return { code: value };
	const record = asRecord$3(value);
	if (!record) return undefined;
	const key = Object.keys(record)[0];
	if (!key || !/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(key)) return undefined;
	const variant = asRecord$3(record[key]);
	const status = variant?.httpStatusCode;
	return {
		code: key,
		httpStatusCode: typeof status === "number" && Number.isInteger(status) ? status : undefined
	};
}
/**
* Maps codex turn-error discriminants onto the existing friendly stop-reason
* buckets so the chat copy stays single-sourced in `appServerFailureText`.
* Unknown discriminants return undefined and surface their own `(codex_*)`
* reason code instead.
*/
function stopReasonFromCodexErrorInfo(info) {
	if (!info) return undefined;
	switch (info.code) {
		case "unauthorized": return "auth_expired";
		case "usageLimitExceeded": return "quota_exhausted";
		case "serverOverloaded": return "service_unavailable";
		case "httpConnectionFailed": break;
		default: return undefined;
	}
	const status = info.httpStatusCode;
	if (status === 401) return "auth_expired";
	if (status === 402) return "quota_exhausted";
	if (status === 429) return "rate_limited";
	if (status !== undefined && status >= 500) return "service_unavailable";
	return "connection_failed";
}
function lifecycleTurnStatus(params) {
	const turn = asRecord$3(params.turn);
	const status = turn ? firstString$2(turn, ["status"]) : undefined;
	return status && /^[A-Za-z][A-Za-z0-9]{0,31}$/.test(status) ? status : undefined;
}
/** Builds a bounded diagnostic event without copying raw params, results, or errors. */
function unknown(message, direction, reason) {
	return {
		kind: "unknown",
		direction,
		reason,
		id: "id" in message ? message.id : undefined,
		method: "method" in message ? message.method : undefined
	};
}
/** Returns the first string value found under the accepted protocol field names. */
function firstString$2(params, keys) {
	for (const key of keys) {
		const value = params[key];
		if (typeof value === "string") return value;
	}
	return undefined;
}
function isVisibleThread(threadId, activeThreadId) {
	if (!threadId) return true;
	if (!activeThreadId) return true;
	return threadId === activeThreadId;
}
/** Returns only string array members, with no coercion of nested objects. */
function stringArray(value) {
	return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
/** Returns the first non-empty string array under the accepted protocol field names. */
function firstStringArray(params, keys) {
	for (const key of keys) {
		const value = stringArray(params[key]);
		if (value.length > 0) return value;
	}
	return [];
}
/**
* Classifies a JSON-RPC error into a friendly stop-reason bucket using the
* HTTP status on `error.code` plus the nested `error_code` string. Unknown
* status/code pairs return undefined so the generic fallback copy is preserved.
*/
function stopReasonFromError(error) {
	if (!error || typeof error.code !== "number") return undefined;
	const status = error.code;
	const data = asRecord$3(error.data);
	const nestedError = asRecord$3(data?.error);
	const codes = new Set([
		firstString$2(error, ["error_code", "errorCode"]),
		data ? firstString$2(data, ["error_code", "errorCode"]) : undefined,
		nestedError ? firstString$2(nestedError, ["error_code", "errorCode"]) : undefined
	].filter((value) => value !== undefined));
	for (const rule of STOP_REASON_RULES) {
		if (rule.status !== status) continue;
		if (rule.code === undefined || codes.has(rule.code)) return rule.reason;
	}
	return undefined;
}
function lifecycleThreadId(params) {
	const thread = asRecord$3(params.thread);
	const turn = asRecord$3(params.turn);
	return firstString$2(params, ["threadId", "thread_id"]) ?? firstString$2(thread ?? {}, [
		"id",
		"threadId",
		"thread_id"
	]) ?? firstString$2(turn ?? {}, ["threadId", "thread_id"]);
}
function lifecycleTurnId(params) {
	const turn = asRecord$3(params.turn);
	return firstString$2(params, ["turnId", "turn_id"]) ?? firstString$2(turn ?? {}, [
		"id",
		"turnId",
		"turn_id"
	]);
}
/** Narrows command output stream names to the values the adapter can safely expose. */
function streamName(value) {
	if (value === "stdout" || value === "stderr") return value;
	return undefined;
}
/** Treats object params as records while rejecting null and primitive payloads. */
function asRecord$3(value) {
	return typeof value === "object" && value !== null ? value : null;
}
var LIFECYCLE_METHODS, REASONING_METHODS, PLAN_DELTA_METHODS, ITEM_METHODS, NATIVE_METADATA_METHODS, APPROVAL_METHODS, STOP_REASON_RULES, ANSWER_ITEM_TYPES, SUBAGENT_TOOL_PHASES, TURN_ERROR_MESSAGE_MAX_CHARS;
var init_events = __esm({ "src/codex-app-server/events.ts"() {
	init_jsonrpc();
	LIFECYCLE_METHODS = new Set([
		"thread/started",
		"turn/started",
		"turn/completed",
		"thread/compacted"
	]);
	REASONING_METHODS = new Set(["item/reasoning/textDelta", "item/reasoning/summaryTextDelta"]);
	PLAN_DELTA_METHODS = new Set(["item/plan/delta"]);
	ITEM_METHODS = new Set(["item/started", "item/completed"]);
	NATIVE_METADATA_METHODS = new Set([
		"app/list/updated",
		"item/mcpToolCall/progress",
		"mcpServer/oauthLogin/completed",
		"mcpServer/startupStatus/updated",
		"skills/changed",
		"thread/status/changed",
		"turn/plan/updated"
	]);
	APPROVAL_METHODS = new Set([
		"item/commandExecution/requestApproval",
		"item/fileChange/requestApproval",
		"item/permissions/requestApproval",
		"applyPatchApproval",
		"execCommandApproval"
	]);
	STOP_REASON_RULES = [
		{
			status: 429,
			code: "turn_budget_exceeded",
			reason: "turn_budget_exceeded"
		},
		{
			status: 429,
			code: "rate_limited",
			reason: "rate_limited"
		},
		{
			status: 402,
			reason: "quota_exhausted"
		},
		{
			status: 401,
			reason: "auth_expired"
		},
		{
			status: 409,
			code: "turn_in_flight",
			reason: "turn_in_flight"
		},
		{
			status: 503,
			code: "gateway_stream_failed",
			reason: "gateway_stream_failed"
		},
		{
			status: 503,
			reason: "service_unavailable"
		}
	];
	ANSWER_ITEM_TYPES = new Set(["plan"]);
	SUBAGENT_TOOL_PHASES = {
		spawn_agent: "dispatch",
		wait_agent: "gather",
		close_agent: "manage",
		resume_agent: "manage",
		spawnAgent: "dispatch",
		waitAgent: "gather",
		closeAgent: "manage",
		resumeAgent: "manage"
	};
	TURN_ERROR_MESSAGE_MAX_CHARS = 200;
} });

//#endregion
//#region src/codex-app-server/adapter.ts
function buildCodexResponsesRequest(call) {
	const model = call.model.trim();
	if (!model) throw new Error("Codex Responses model is required");
	const request = {
		input: call.input,
		model,
		store: false,
		stream: true
	};
	if (call.previousResponseId?.trim()) request.previous_response_id = call.previousResponseId.trim();
	return request;
}
function summarizeResponsesRequestForDiagnostics(request) {
	return {
		hasPreviousResponseId: Boolean(request.previous_response_id),
		inputItemCount: request.input.length,
		model: request.model,
		store: request.store,
		stream: request.stream
	};
}
function buildCodexResponsesHeaders(opts) {
	const turnId = requireTurnId(opts.turnId);
	const headers = {
		accept: "text/event-stream",
		"content-type": "application/json",
		"x-3dagent-turn-id": turnId,
		"x-api-key": requireToken(opts.scopedToken)
	};
	if (opts.requestId?.trim()) headers["x-request-id"] = opts.requestId.trim();
	return headers;
}
function summarizeCodexClientRequest(request) {
	if (!CLIENT_REQUEST_METHODS.has(request.method)) throw new Error(`Unsupported Codex client request: ${request.method}`);
	const params = asRecord$2(request.params);
	const summary = {
		hasDeveloperInstructions: typeof params.developerInstructions === "string",
		hasSandbox: typeof params.sandbox === "string" || isRecord$1(params.sandboxPolicy),
		method: request.method,
		rawEventsEnabled: params.experimentalRawEvents === true || params.experimental_raw_events === true
	};
	const approvalPolicy = firstString$1(params, ["approvalPolicy", "approval_policy"]);
	if (approvalPolicy !== undefined) summary.approvalPolicy = approvalPolicy;
	const names = dynamicToolNames(params.dynamicTools);
	if (names !== undefined) summary.dynamicToolNames = names;
	const effort = firstString$1(params, [
		"effort",
		"model_reasoning_effort",
		"reasoningEffort"
	]);
	if (effort !== undefined) summary.effort = effort;
	const model = firstString$1(params, ["model"]);
	if (model !== undefined) summary.model = model;
	const modelProvider = firstString$1(params, ["modelProvider", "model_provider"]);
	if (modelProvider !== undefined) summary.modelProvider = modelProvider;
	const threadId = firstString$1(params, ["threadId", "thread_id"]);
	if (threadId !== undefined) summary.threadId = threadId;
	const turnId = firstString$1(params, ["turnId", "turn_id"]);
	if (turnId !== undefined) summary.turnId = turnId;
	return summary;
}
function approvalDecisionForKind(kind, decision) {
	if (decision === "approved" || decision === "rejected" || decision === "skipped") return decision;
	throw new Error(`Unsupported ${kind} approval decision`);
}
function unsupportedDynamicToolResponse(code) {
	return {
		contentItems: [{
			text: `3D-Agent refused Blender tool call: ${code}`,
			type: "inputText"
		}],
		success: false
	};
}
function codexAuthRefreshResult(scoped) {
	const result = {
		accessToken: scoped.token,
		chatgptAccountId: scoped.chatgptAccountId
	};
	if (scoped.chatgptPlanType !== undefined) result.chatgptPlanType = scoped.chatgptPlanType;
	return result;
}
function codexAuthTokensLoginParams(scoped) {
	const params = {
		accessToken: scoped.token,
		chatgptAccountId: scoped.chatgptAccountId,
		type: "chatgptAuthTokens"
	};
	if (scoped.chatgptPlanType !== undefined) params.chatgptPlanType = scoped.chatgptPlanType;
	return params;
}
function approvalResponseForEvent(event, result) {
	const approval = normalizeApprovalResult(event.approvalKind, result);
	if (event.method === "execCommandApproval" || event.method === "applyPatchApproval") return { decision: legacyReviewDecision(approval.decision) };
	if (event.method === "item/permissions/requestApproval") return permissionsApprovalResponse(approval);
	if (event.method === "item/commandExecution/requestApproval") return { decision: commandOrFileApprovalDecision(approval.decision) };
	if (event.method === "item/fileChange/requestApproval") return { decision: commandOrFileApprovalDecision(approval.decision) };
	throw new Error(`Unsupported approval method: ${event.method}`);
}
function normalizeApprovalResult(kind, result) {
	if (typeof result === "string") return { decision: approvalDecisionForKind(kind, result) };
	const decision = approvalDecisionForKind(kind, result.decision);
	return {
		decision,
		permissions: result.permissions === undefined ? undefined : validatePermissionGrant(result.permissions),
		strictAutoReview: typeof result.strictAutoReview === "boolean" ? result.strictAutoReview : undefined
	};
}
function commandOrFileApprovalDecision(decision) {
	if (decision === "approved") return "accept";
	if (decision === "skipped") return "decline";
	return "cancel";
}
function legacyReviewDecision(decision) {
	if (decision === "approved") return "approved";
	if (decision === "skipped") return "denied";
	return "abort";
}
function permissionsApprovalResponse(approval) {
	return {
		permissions: approval.decision === "approved" ? approval.permissions ?? {} : {},
		scope: "turn",
		strictAutoReview: approval.strictAutoReview ?? approval.decision !== "approved"
	};
}
function validatePermissionGrant(value) {
	if (!isRecord$1(value)) throw new Error("Codex permissions approval grant must be an object");
	const grant = {};
	if (value.fileSystem !== undefined) grant.fileSystem = validateNullableObject(value.fileSystem);
	if (value.network !== undefined) grant.network = validateNullableObject(value.network);
	return grant;
}
function validateNullableObject(value) {
	if (value === null) return null;
	if (isRecord$1(value)) return value;
	throw new Error("Codex permissions approval entries must be objects or null");
}
function redactHeadersForDiagnostics(headers) {
	return {
		...headers,
		"x-api-key": "[redacted]"
	};
}
function requireTurnId(value) {
	const trimmed = value.trim();
	if (!TURN_ID_PATTERN.test(trimmed)) throw new Error("Invalid x-3dagent-turn-id");
	return trimmed;
}
function requireToken(value) {
	if (typeof value !== "string") throw new Error("Scoped services/api token is required");
	const trimmed = value.trim();
	if (!trimmed) throw new Error("Scoped services/api token is required");
	if (/[\s\u0000-\u001f\u007f]/.test(trimmed)) throw new Error("Scoped services/api token must not contain whitespace/control characters");
	return trimmed;
}
function validateScopedServicesApiToken(scoped) {
	const token = requireToken(scoped.token);
	const chatgptAccountId = requireChatgptAccountId(scoped.chatgptAccountId);
	if (typeof scoped.expiresInSeconds !== "number") throw new Error("Scoped services/api token expiresInSeconds is required");
	if (scoped.expiresInSeconds <= 0 || scoped.expiresInSeconds > MAX_SCOPED_TOKEN_TTL_SECONDS) throw new Error(`Scoped services/api token TTL must be between 1 and ${MAX_SCOPED_TOKEN_TTL_SECONDS} seconds`);
	return {
		chatgptAccountId,
		chatgptPlanType: normalizePlanType(scoped.chatgptPlanType),
		expiresInSeconds: scoped.expiresInSeconds,
		token
	};
}
function requireChatgptAccountId(value) {
	if (typeof value !== "string") throw new Error("Codex auth refresh chatgptAccountId is required");
	const trimmed = value.trim();
	if (!trimmed) throw new Error("Codex auth refresh chatgptAccountId is required");
	return trimmed;
}
function normalizePlanType(value) {
	if (value === undefined || value === null) return value;
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}
function firstString$1(params, keys) {
	for (const key of keys) {
		const value = params[key];
		if (typeof value === "string") return value;
	}
	return undefined;
}
function asRecord$2(value) {
	return isRecord$1(value) ? value : {};
}
function isRecord$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function dynamicToolNames(value) {
	if (!Array.isArray(value)) return undefined;
	return value.map((item) => asRecord$2(item).name).filter((name) => typeof name === "string");
}
var MAX_SCOPED_TOKEN_TTL_SECONDS, TURN_ID_PATTERN, CLIENT_REQUEST_METHODS, CodexAppServerContractAdapter;
var init_adapter = __esm({ "src/codex-app-server/adapter.ts"() {
	init_events();
	init_jsonrpc();
	MAX_SCOPED_TOKEN_TTL_SECONDS = 900;
	TURN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
	CLIENT_REQUEST_METHODS = new Set([
		"thread/start",
		"thread/resume",
		"turn/start"
	]);
	CodexAppServerContractAdapter = class {
		constructor(tokens, transport) {
			this.tokens = tokens;
			this.transport = transport;
		}
		/** Send one fake-provider Responses call through the local proxy contract. */
		async sendResponsesCall(call) {
			const scoped = await this.tokens.current();
			const scopedToken = validateScopedServicesApiToken(scoped).token;
			const request = buildCodexResponsesRequest(call);
			const headers = buildCodexResponsesHeaders({
				requestId: call.requestId,
				scopedToken,
				turnId: call.turnId
			});
			await this.transport.postResponses(request, headers);
			return {
				headers: redactHeadersForDiagnostics(headers),
				request: summarizeResponsesRequestForDiagnostics(request)
			};
		}
		/** Build the in-memory ChatGPT auth-token login payload for app-server. */
		async buildAccountLoginStartParams() {
			let scoped;
			try {
				scoped = await this.tokens.current();
			} catch {
				throw new Error("Codex app-server account login token unavailable");
			}
			return codexAuthTokensLoginParams(validateScopedServicesApiToken(scoped));
		}
		/** Resolve app-server server requests using scoped-token refresh or approvals. */
		async resolveServerRequest(request, handlers, context) {
			const event = classifyCodexAppServerMessage(request);
			if (event.kind === "auth-refresh-request") {
				const scoped = await this.tokens.refresh();
				const scopedToken = validateScopedServicesApiToken(scoped);
				return jsonRpcResult(event.requestId, codexAuthRefreshResult(scopedToken));
			}
			if (event.kind === "approval-request") return jsonRpcResult(event.requestId, approvalResponseForEvent(event, handlers.approve(event)));
			if (event.kind === "tool-call-request") {
				if (!handlers.callDynamicTool || !context) return jsonRpcResult(event.requestId, unsupportedDynamicToolResponse("dynamic_tools_unconfigured"));
				return jsonRpcResult(event.requestId, await handlers.callDynamicTool(request.params, context));
			}
			throw new Error(`Unsupported Codex app-server request: ${event.kind}`);
		}
	};
} });

//#endregion
//#region src/codex-app-server/token-command.ts
function normalizeCodexScopedTokenCommandSpec(spec) {
	const command = stripWindowsExtendedLengthPrefix(requireCommand(spec.command));
	if (isKnownShellOrNetworkTool(command)) throw new CodexScopedTokenCommandError("Codex scoped-token command must be app-owned", { command });
	if (isNetworkCommandPath(command) || hasTraversalSegment(command)) throw new CodexScopedTokenCommandError("Codex scoped-token command path is not app-owned", { command });
	if (!isAbsoluteCommandPath(command)) throw new CodexScopedTokenCommandError("Codex scoped-token command must be an absolute app-owned path", { command });
	assertSafeCommandText("command", command);
	const args = normalizeArgs(spec.args ?? []);
	const timeoutMs = normalizeOptionalMs("timeoutMs", spec.timeoutMs, 3e4);
	const refreshIntervalMs = normalizeOptionalMs("refreshIntervalMs", spec.refreshIntervalMs, 9e5);
	return {
		command,
		...args.length > 0 ? { args } : {},
		...refreshIntervalMs !== undefined ? { refreshIntervalMs } : {},
		...timeoutMs !== undefined ? { timeoutMs } : {}
	};
}
/** Require a non-empty helper command path without control characters. */
function requireCommand(command) {
	if (hasControl$1(command)) throw new CodexScopedTokenCommandError("Codex scoped-token command must not contain control characters");
	const trimmed = command.trim();
	if (!trimmed) throw new CodexScopedTokenCommandError("Codex scoped-token command is required");
	return trimmed;
}
/** Normalize bounded non-secret helper arguments. */
function normalizeArgs(args) {
	if (!Array.isArray(args)) throw new CodexScopedTokenCommandError("Codex scoped-token command args must be an array");
	if (args.length > 16) throw new CodexScopedTokenCommandError("Codex scoped-token command has too many args", { argCount: String(args.length) });
	return args.map((arg, index) => {
		if (typeof arg !== "string") throw new CodexScopedTokenCommandError("Codex scoped-token command arg must be a string", { index: String(index) });
		if (arg.length > 2048 || hasControl$1(arg)) throw new CodexScopedTokenCommandError("Codex scoped-token command arg is invalid", { index: String(index) });
		assertSafeCommandText(`args[${index}]`, arg);
		return arg;
	});
}
/** Normalize an optional positive millisecond value with an upper bound. */
function normalizeOptionalMs(label, value, max) {
	if (value === undefined) return undefined;
	if (!Number.isInteger(value) || value <= 0 || value > max) throw new CodexScopedTokenCommandError(`Codex scoped-token command ${label} is invalid`, { [label]: String(value) });
	return value;
}
/**
* Removes the Windows extended-length ("verbatim") prefix that path resolvers
* such as Tauri `resourceDir()` and `std::fs::canonicalize` hand back on
* Windows (e.g. `\\?\C:\dir\codex-scoped-token.exe`).
*
* `\\?\C:\…` is a LOCAL absolute path and `\\?\UNC\server\share` is a UNC path;
* both must be de-verbatim'd before the network/absolute classification below,
* or a legitimate local helper path is misread as a network share — its `//`
* prefix (after backslash normalization) trips `isNetworkCommandPath`, which is
* what surfaced as `scoped_token_command_invalid` for Windows users. A bare
* `\\server\share` (no verbatim prefix) is intentionally left untouched: it is
* a real UNC network path and must keep being rejected.
*/
function stripWindowsExtendedLengthPrefix(command) {
	if (/^\\\\\?\\UNC\\/i.test(command)) return `\\\\${command.slice("\\\\?\\UNC\\".length)}`;
	if (command.startsWith("\\\\?\\")) return command.slice("\\\\?\\".length);
	return command;
}
/** Reject helper commands that resolve to generic shell, runtime, or network tools. */
function isKnownShellOrNetworkTool(command) {
	const basename$1 = command.replace(/\\/g, "/").split("/").pop()?.toLowerCase() ?? command;
	const normalized = basename$1.replace(/\.(exe|cmd|bat|ps1)$/i, "");
	return forbiddenCommandBasenames.has(normalized);
}
/** Detect network-style command paths that cannot be app-owned executables. */
function isNetworkCommandPath(command) {
	const normalized = command.replace(/\\/g, "/");
	return normalized.startsWith("//") || /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(normalized);
}
/** Detect path traversal segments before command metadata reaches Codex config. */
function hasTraversalSegment(command) {
	return command.replace(/\\/g, "/").split("/").some((segment) => segment === "." || segment === "..");
}
/** Check for Unix or Windows absolute helper command paths. */
function isAbsoluteCommandPath(command) {
	const normalized = command.replace(/\\/g, "/");
	return normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized);
}
/** Reject command metadata that looks like it contains token material. */
function assertSafeCommandText(label, value) {
	if (containsSensitiveText(value)) throw new CodexScopedTokenCommandError(`Codex scoped-token command ${label} must not contain sensitive material`, { [label]: value });
}
/** Detect ASCII control characters in command metadata. */
function hasControl$1(value) {
	for (let index = 0; index < value.length; index += 1) {
		const code = value.charCodeAt(index);
		if (code <= 31 || code === 127) return true;
	}
	return false;
}
var forbiddenCommandBasenames, CodexScopedTokenCommandError;
var init_token_command = __esm({ "src/codex-app-server/token-command.ts"() {
	init_adapter();
	init_runtime();
	forbiddenCommandBasenames = new Set([
		"bash",
		"bun",
		"cmd",
		"curl",
		"deno",
		"env",
		"node",
		"npx",
		"osascript",
		"perl",
		"php",
		"powershell",
		"pwsh",
		"python",
		"python3",
		"ruby",
		"sh",
		"wget",
		"zsh"
	]);
	CodexScopedTokenCommandError = class extends Error {
		/** Redacted diagnostic metadata safe for setup-failure messages and logs. */
		diagnostics;
		constructor(message, diagnostics = {}) {
			super(message);
			this.name = "CodexScopedTokenCommandError";
			this.diagnostics = redactDiagnostics(diagnostics);
		}
	};
} });

//#endregion
//#region src/codex-app-server/home.ts
function isKnownReasoningEffort(value) {
	return CODEX_KNOWN_REASONING_EFFORTS.has(value);
}
function normalizeModelReasoningEffort(value) {
	return value !== undefined && isKnownReasoningEffort(value) ? value : CODEX_APP_SERVER_MODEL_REASONING_EFFORT;
}
async function ensureIsolatedCodexHome(opts) {
	assertSafeProbeId(opts.probeId);
	const dataDir$1 = await opts.fs.getDataDir();
	const versionSegment = codexVersionToPathSegment(opts.version);
	const codexHome = await opts.fs.joinPath([
		dataDir$1,
		CODEX_APP_SERVER_HOME_ROOT,
		versionSegment,
		opts.probeId
	]);
	if (looksLikeDefaultCodexHome(codexHome)) throw new Error(`Refusing to use default Codex home: ${codexHome}`);
	await opts.fs.mkdir(codexHome);
	return {
		codexHome,
		probeId: opts.probeId,
		versionSegment
	};
}
async function ensureConfiguredCodexHome(opts) {
	const home = await ensureIsolatedCodexHome({
		fs: opts.fs,
		probeId: opts.probeId,
		version: opts.version
	});
	const configPath = await opts.fs.joinPath([home.codexHome, "config.toml"]);
	if (looksLikeDefaultCodexHome(configPath)) throw new Error(`Refusing to write Codex config under default home: ${configPath}`);
	await opts.fs.writeTextFile(configPath, build3DAgentCodexConfig(opts.providerConfig, opts.subagentCap, opts.modelReasoningEffort));
	return {
		...home,
		configPath
	};
}
function build3DAgentCodexConfig(opts, subagentCap, modelReasoningEffort) {
	const providerId = normalizeProviderId(opts.providerId ?? "3dagent");
	const baseUrl = requireNonSecretString("baseUrl", opts.baseUrl);
	const lines = [
		`model = ${tomlString(CODEX_APP_SERVER_MODEL)}`,
		`model_reasoning_effort = ${tomlString(normalizeModelReasoningEffort(modelReasoningEffort))}`,
		...opts.reasoningSummaryEnabled !== false ? ["model_reasoning_summary = \"auto\""] : [],
		`model_provider = ${tomlString(providerId)}`,
		"",
		...subagentFeatureConfig(subagentCap),
		`[model_providers.${providerId}]`,
		"name = \"3D-Agent Gateway\"",
		`base_url = ${tomlString(baseUrl)}`,
		"wire_api = \"responses\"",
		...opts.supportsWebsockets ? ["supports_websockets = true"] : [],
		"",
		`[model_providers.${providerId}.env_http_headers]`,
		`${tomlString(CODEX_APP_SERVER_TURN_ID_HEADER)} = ${tomlString(CODEX_APP_SERVER_TURN_ID_ENV)}`,
		""
	];
	if (opts.auth) {
		const auth = normalizeCodexScopedTokenCommandSpec(opts.auth);
		const command = auth.command;
		const args = auth.args ?? [];
		const refreshIntervalMs = normalizePositiveInteger("auth.refreshIntervalMs", auth.refreshIntervalMs ?? 3e5);
		const timeoutMs = normalizePositiveInteger("auth.timeoutMs", auth.timeoutMs ?? 5e3);
		lines.push(`[model_providers.${providerId}.auth]`, `command = ${tomlString(command)}`, `args = [${args.map(tomlString).join(", ")}]`, `refresh_interval_ms = ${refreshIntervalMs}`, `timeout_ms = ${timeoutMs}`, "");
	}
	const config = lines.join("\n");
	assertNoSensitiveText("config.toml", config);
	return config;
}
function summarizeCodexProviderConfigForDiagnostics(opts) {
	const auth = opts.auth ? normalizeCodexScopedTokenCommandSpec(opts.auth) : undefined;
	return {
		authArgCount: auth?.args?.length ?? 0,
		authCommandConfigured: Boolean(auth?.command),
		authRefreshIntervalMs: normalizePositiveInteger("auth.refreshIntervalMs", auth?.refreshIntervalMs ?? 3e5),
		authTimeoutMs: normalizePositiveInteger("auth.timeoutMs", auth?.timeoutMs ?? 5e3),
		baseUrl: requireNonSecretString("baseUrl", opts.baseUrl),
		model: CODEX_APP_SERVER_MODEL,
		modelProvider: normalizeProviderId(opts.providerId ?? "3dagent"),
		modelReasoningEffort: CODEX_APP_SERVER_MODEL_REASONING_EFFORT,
		reasoningSummaryEnabled: opts.reasoningSummaryEnabled !== false,
		responsesWebsocketsEnabled: opts.supportsWebsockets === true,
		wireApi: "responses"
	};
}
/** TOML lines enabling the multi_agent_v2 runtime with a hard thread cap (#1073).
*
* `max_concurrent_threads_per_session` counts the root thread plus subagents,
* and codex requires it to be ≥ 1 — so a cap of N subagents maps to N+1, and
* "no subagents" maps to 1 (codex itself rejects the spawn and answers inline).
* The v1 runtime's `agents.max_threads`/`max_depth` knobs were proven inert for
* first-level spawns live, so the v2 runtime is the only native enforcement
* point. Long wait windows keep allowed spawns to a single wait call instead of
* repeated "no reply yet, checking again" narration rounds. Undefined cap →
* no section → codex's native default runtime, with the server-side turn
* ledger still bounding concurrency.
*/
function subagentFeatureConfig(cap) {
	if (cap === undefined || !Number.isFinite(cap)) return [];
	const bounded = Math.max(0, Math.min(Math.trunc(cap), MAX_SUBAGENT_CAP));
	return [
		"[features.multi_agent_v2]",
		"enabled = true",
		`max_concurrent_threads_per_session = ${bounded + 1}`,
		"default_wait_timeout_ms = 120000",
		"max_wait_timeout_ms = 300000",
		"hide_spawn_agent_metadata = false",
		""
	];
}
function buildCodexProbeEnv(baseEnv, codexHome) {
	const out = {};
	for (const key of [
		"PATH",
		"PATHEXT",
		"SYSTEMROOT",
		"COMSPEC",
		"TEMP",
		"TMP",
		"TMPDIR",
		"USERPROFILE",
		"HOME",
		"LANG",
		"LC_ALL"
	]) {
		const value = baseEnv[key];
		if (value) out[key] = value;
	}
	out.CODEX_HOME = codexHome;
	return out;
}
function assertSafeProbeId(probeId) {
	if (!probeId || probeId === "." || probeId === "..") throw new Error(`Invalid Codex app-server probe id: ${JSON.stringify(probeId)}`);
	if (probeId.length > 128 || /[\\/]/.test(probeId) || !/^[A-Za-z0-9._-]+$/.test(probeId)) throw new Error(`Invalid Codex app-server probe id: ${JSON.stringify(probeId)}`);
}
function codexVersionToPathSegment(version) {
	const segment = version.trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
	if (!segment) throw new Error(`Invalid Codex version: ${JSON.stringify(version)}`);
	return segment;
}
function looksLikeDefaultCodexHome(path) {
	return /(^|[/\\])\.codex($|[/\\])/.test(path);
}
function normalizeProviderId(providerId) {
	const trimmed = providerId.trim();
	if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) throw new Error(`Invalid Codex provider id: ${JSON.stringify(providerId)}`);
	return trimmed;
}
function requireNonSecretString(label, value) {
	const trimmed = value.trim();
	if (!trimmed) throw new Error(`Codex provider config ${label} is required`);
	assertNoSensitiveText(label, trimmed);
	return trimmed;
}
function normalizePositiveInteger(label, value) {
	if (!Number.isInteger(value) || value <= 0) throw new Error(`Codex provider config ${label} must be a positive integer`);
	return value;
}
function tomlString(value) {
	return JSON.stringify(value);
}
function assertNoSensitiveText(label, value) {
	if (containsSensitiveText(value)) throw new Error(`Codex provider config ${label} must not contain sensitive material`);
}
var CODEX_APP_SERVER_HOME_ROOT, CODEX_APP_SERVER_MODEL, CODEX_APP_SERVER_MODEL_REASONING_EFFORT, CODEX_KNOWN_REASONING_EFFORTS, CODEX_APP_SERVER_TURN_ID_ENV, CODEX_APP_SERVER_TURN_ID_HEADER, MAX_SUBAGENT_CAP;
var init_home = __esm({ "src/codex-app-server/home.ts"() {
	init_runtime();
	init_token_command();
	CODEX_APP_SERVER_HOME_ROOT = "codex-app-server";
	CODEX_APP_SERVER_MODEL = "gpt-5.5";
	CODEX_APP_SERVER_MODEL_REASONING_EFFORT = "high";
	CODEX_KNOWN_REASONING_EFFORTS = new Set([
		"none",
		"minimal",
		"low",
		"medium",
		"high",
		"xhigh"
	]);
	CODEX_APP_SERVER_TURN_ID_ENV = "THREEDAGENT_CODEX_TURN_ID";
	CODEX_APP_SERVER_TURN_ID_HEADER = "x-3dagent-turn-id";
	MAX_SUBAGENT_CAP = 16;
} });

//#endregion
//#region src/codex-app-server/thread-map-store.ts
init_home();
const CODEX_APP_SERVER_THREAD_MAP_FILE = "thread-map.v1.json";
const CODEX_APP_SERVER_THREAD_MAP_VERSION = 1;
const MAX_THREAD_MAP_BYTES = 1e6;
const MAX_THREAD_MAP_ID_LENGTH = 256;
const SAFE_THREAD_MAP_ID = /^[A-Za-z0-9._:-]+$/;
const jwtLikeIdentifier = /(?:^|[_.:-])[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}(?:$|[_.:-])/;
var CodexAppServerThreadMapStoreError = class extends Error {
	constructor(code, operation) {
		super(`Codex app-server thread map ${operation} failed: ${code}`);
		this.code = code;
		this.operation = operation;
		this.name = "CodexAppServerThreadMapStoreError";
	}
};
function createCodexAppServerThreadMapStore(opts) {
	const nowMs = opts.nowMs ?? Date.now;
	let writeQueue = Promise.resolve();
	async function serializeWrite(write$1) {
		const previousWrite = writeQueue;
		let releaseWrite = () => undefined;
		writeQueue = new Promise((resolve$1) => {
			releaseWrite = resolve$1;
		});
		await previousWrite;
		try {
			return await write$1();
		} finally {
			releaseWrite();
		}
	}
	return {
		async get(key) {
			const safeKey = normalizeKey(key, "get");
			const map = await readMapOrEmpty(opts.fs, "get");
			return findRecord(map, safeKey, "get");
		},
		async set(record) {
			return serializeWrite(async () => {
				const safeRecord = normalizeRecord({
					...record,
					updatedAtMs: nowMs()
				}, "set");
				const current = await readMapOrEmpty(opts.fs, "set");
				const next = {
					mappings: [...current.mappings.filter((mapping) => !sameKey(mapping, safeRecord)), safeRecord].sort(compareRecords),
					version: CODEX_APP_SERVER_THREAD_MAP_VERSION
				};
				await writeMap(opts.fs, next);
				return safeRecord;
			});
		}
	};
}
async function readMapOrEmpty(fs$1, operation) {
	let path;
	let contents;
	try {
		path = await threadMapPath(fs$1);
	} catch {
		throw new CodexAppServerThreadMapStoreError("read_failed", operation);
	}
	const existingFileSize = await getExistingThreadMapSize(fs$1, path.filePath, operation);
	if (existingFileSize === undefined) return {
		mappings: [],
		version: CODEX_APP_SERVER_THREAD_MAP_VERSION
	};
	if (existingFileSize > MAX_THREAD_MAP_BYTES) throw new CodexAppServerThreadMapStoreError("invalid_json", operation);
	try {
		contents = await fs$1.readTextFile(path.filePath);
	} catch (error) {
		if (isMissingFileError(error)) return {
			mappings: [],
			version: CODEX_APP_SERVER_THREAD_MAP_VERSION
		};
		throw new CodexAppServerThreadMapStoreError("read_failed", operation);
	}
	return parseThreadMap(contents, operation);
}
async function getExistingThreadMapSize(fs$1, filePath, operation) {
	try {
		return await fs$1.getFileSize(filePath);
	} catch (error) {
		if (isMissingFileError(error)) return undefined;
		throw new CodexAppServerThreadMapStoreError("read_failed", operation);
	}
}
async function writeMap(fs$1, map) {
	try {
		const path = await threadMapPath(fs$1);
		await fs$1.mkdir(path.rootPath);
		await fs$1.writeTextFile(path.filePath, `${JSON.stringify(map, null, 2)}\n`);
	} catch {
		throw new CodexAppServerThreadMapStoreError("write_failed", "write");
	}
}
async function threadMapPath(fs$1) {
	const dataDir$1 = await fs$1.getDataDir();
	const rootPath = await fs$1.joinPath([dataDir$1, CODEX_APP_SERVER_HOME_ROOT]);
	const filePath = await fs$1.joinPath([rootPath, CODEX_APP_SERVER_THREAD_MAP_FILE]);
	return {
		filePath,
		rootPath
	};
}
function parseThreadMap(contents, operation) {
	if (contents.length > MAX_THREAD_MAP_BYTES) throw new CodexAppServerThreadMapStoreError("invalid_json", operation);
	let parsed;
	try {
		parsed = JSON.parse(contents);
	} catch {
		throw new CodexAppServerThreadMapStoreError("invalid_json", operation);
	}
	if (!isRecord(parsed) || parsed.version !== CODEX_APP_SERVER_THREAD_MAP_VERSION) throw new CodexAppServerThreadMapStoreError("unsupported_version", operation);
	if (!Array.isArray(parsed.mappings)) throw new CodexAppServerThreadMapStoreError("invalid_record", operation);
	const mappings = parsed.mappings.map((mapping) => normalizeRecord(mapping, operation));
	assertNoDuplicateKeys(mappings, operation);
	return {
		mappings,
		version: CODEX_APP_SERVER_THREAD_MAP_VERSION
	};
}
function normalizeRecord(value, operation) {
	if (!isRecord(value)) throw new CodexAppServerThreadMapStoreError("invalid_record", operation);
	const updatedAtMs = value.updatedAtMs;
	if (typeof updatedAtMs !== "number" || !Number.isSafeInteger(updatedAtMs) || updatedAtMs < 0) throw new CodexAppServerThreadMapStoreError("invalid_record", operation);
	const record = {
		...normalizeKey(value, operation),
		codexThreadId: normalizeId("codexThreadId", value.codexThreadId, operation),
		updatedAtMs
	};
	const toolManifestFingerprint = normalizeOptionalId("toolManifestFingerprint", value.toolManifestFingerprint, operation);
	if (toolManifestFingerprint !== undefined) record.toolManifestFingerprint = toolManifestFingerprint;
	return record;
}
function normalizeKey(value, operation) {
	if (!isRecord(value)) throw new CodexAppServerThreadMapStoreError("invalid_record", operation);
	return {
		accountScope: normalizeId("accountScope", value.accountScope, operation),
		chatId: normalizeId("chatId", value.chatId, operation)
	};
}
function normalizeId(_label, value, operation) {
	if (typeof value !== "string") throw new CodexAppServerThreadMapStoreError("invalid_identifier", operation);
	const trimmed = value.trim();
	if (!trimmed || trimmed !== value || trimmed.length > MAX_THREAD_MAP_ID_LENGTH || !SAFE_THREAD_MAP_ID.test(trimmed)) throw new CodexAppServerThreadMapStoreError("invalid_identifier", operation);
	assertNoSensitiveIdentifier(trimmed, operation);
	return trimmed;
}
function normalizeOptionalId(label, value, operation) {
	if (value === undefined) return undefined;
	return normalizeId(label, value, operation);
}
function assertNoSensitiveIdentifier(value, operation) {
	if (/OPENAI_API_KEY/i.test(value) || /refresh[_-]?token/i.test(value) || /access[_-]?token/i.test(value) || /authorization/i.test(value) || /\bBearer\b/i.test(value) || /(?:^|[_.:-])(?:sk|rk|sb_secret)-[A-Za-z0-9]/i.test(value) || jwtLikeIdentifier.test(value)) throw new CodexAppServerThreadMapStoreError("invalid_identifier", operation);
}
function findRecord(map, key, operation) {
	const matches = map.mappings.filter((mapping) => sameKey(mapping, key));
	if (matches.length > 1) throw new CodexAppServerThreadMapStoreError("duplicate_mapping", operation);
	return matches[0] ? { ...matches[0] } : undefined;
}
function sameKey(left, right) {
	return left.accountScope === right.accountScope && left.chatId === right.chatId;
}
function assertNoDuplicateKeys(mappings, operation) {
	const seen = new Set();
	for (const mapping of mappings) {
		const key = `${mapping.accountScope}\u0000${mapping.chatId}`;
		if (seen.has(key)) throw new CodexAppServerThreadMapStoreError("duplicate_mapping", operation);
		seen.add(key);
	}
}
function compareRecords(left, right) {
	return left.accountScope.localeCompare(right.accountScope, "en") || left.chatId.localeCompare(right.chatId, "en");
}
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isMissingFileError(error) {
	if (!isRecord(error)) return false;
	const code = error.code;
	return code === "ENOENT" || code === "NotFound" || code === "not_found";
}

//#endregion
//#region src/codex-app-server/turn-id.ts
function createCodexAppServerTurnId(entropy = globalThis.crypto) {
	const uuid = entropy?.randomUUID?.();
	if (uuid && SAFE_UUID.test(uuid)) return `${CODEX_APP_SERVER_TURN_ID_PREFIX}${uuid.toLowerCase()}`;
	if (entropy?.getRandomValues) {
		const bytes = entropy.getRandomValues(new Uint8Array(TURN_ID_RANDOM_BYTES));
		if (bytes.some((byte) => byte !== 0)) return `${CODEX_APP_SERVER_TURN_ID_PREFIX}${bytesToHex(bytes)}`;
	}
	throw new CodexAppServerTurnIdError();
}
function normalizeCodexAppServerTurnId(value) {
	if (typeof value !== "string" || !SAFE_TURN_ID.test(value)) throw new CodexAppServerTurnIdError("invalid_turn_id");
	return value.toLowerCase();
}
function bytesToHex(bytes) {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
var CODEX_APP_SERVER_TURN_ID_PREFIX, SAFE_UUID_PATTERN, SAFE_UUID, SAFE_TURN_ID, TURN_ID_RANDOM_BYTES, CodexAppServerTurnIdError;
var init_turn_id = __esm({ "src/codex-app-server/turn-id.ts"() {
	CODEX_APP_SERVER_TURN_ID_PREFIX = "jan-turn-";
	SAFE_UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
	SAFE_UUID = new RegExp(`^${SAFE_UUID_PATTERN}$`, "i");
	SAFE_TURN_ID = new RegExp(`^${CODEX_APP_SERVER_TURN_ID_PREFIX}(?:${SAFE_UUID_PATTERN}|[0-9a-f]{32})$`, "i");
	TURN_ID_RANDOM_BYTES = 16;
	CodexAppServerTurnIdError = class extends Error {
		code;
		constructor(code = "entropy_unavailable") {
			super(`Codex app-server turn id generation failed: ${code}`);
			this.name = "CodexAppServerTurnIdError";
			this.code = code;
		}
	};
} });

//#endregion
//#region src/codex-app-server/chat-dependencies.ts
init_tauri_runtime();
init_turn_id();
function buildTauriCodexAppServerChatDependencies(opts = {}) {
	const selection = selectCodexAgentRuntime(opts.runtimeFlagValue);
	return buildCodexAppServerChatDependencies(opts, selection);
}
async function buildCodexAppServerChatDependencies(opts, selection) {
	const accountScope = await resolveBuilderAccountScope(opts);
	if (!accountScope.ok) return {
		kind: "unavailable",
		reason: accountScope.reason,
		selection
	};
	const storeSource = opts.store ? "injected" : "tauri";
	const store = opts.store ?? createCodexAppServerThreadMapStore({
		fs: opts.threadMapFS ?? createTauriCodexThreadMapStoreFS(opts.tauriFSDeps),
		nowMs: opts.nowMs
	});
	return {
		dependencies: {
			accountScopeResolver: createResolvedCodexAppServerAccountScopeResolver(accountScope.value, accountScope.source),
			createTurnId: opts.createTurnId ?? (() => createCodexAppServerTurnId()),
			runner: opts.runner,
			store,
			workspaceResolver: opts.workspaceResolver
		},
		diagnostics: {
			accountScopeSource: accountScope.source,
			hasCreateTurnId: Boolean(opts.createTurnId),
			hasRunner: Boolean(opts.runner),
			storeSource
		},
		kind: "codex-app-server",
		selection
	};
}
async function resolveBuilderAccountScope(opts) {
	try {
		if (opts.accountScope !== undefined) return {
			ok: true,
			source: "injected",
			value: normalizeCodexAppServerAccountScope(opts.accountScope)
		};
		return {
			ok: true,
			source: "tauri-session",
			value: await resolveTauriCodexAppServerAccountScope({
				getSessionToken: opts.getSessionToken,
				nowMs: opts.nowMs
			})
		};
	} catch (error) {
		if (error instanceof CodexAppServerAccountScopeResolverError && error.code === "missing_account_scope") return {
			ok: false,
			reason: "account_scope_missing"
		};
		return {
			ok: false,
			reason: "account_scope_invalid"
		};
	}
}

//#endregion
//#region src/anthropic-config.ts
function localAgentProxyBaseUrl(port) {
	return `http://127.0.0.1:${port}`;
}
var ANTHROPIC_BASE_URL;
var init_anthropic_config = __esm({ "src/anthropic-config.ts"() {
	ANTHROPIC_BASE_URL = "http://127.0.0.1:1337";
} });

//#endregion
//#region src/blender-system-prompt.ts
function buildSystemPrompt(_sidecarDir, opts = {}) {
	const isCodex = opts.agentName === "Codex";
	const agentIdentity = isCodex ? "You are Codex running inside 3D-Agent; Jan is only the wrapper. Keep Codex's normal agentic workflow" : "You are a 3D-Agent local agent running inside Jan. Keep your normal agentic workflow";
	const workspaceGuidance = isCodex ? "use your native sandboxed workspace and shell tools when they help you think, draft, inspect, or iterate, and use the Blender function tools" : "use the available Blender function tools";
	const nativeToolGuidance = isCodex ? " You may also use your native Codex workspace and shell tools inside the configured sandbox for scratch files, script drafting, searches, and local verification. Do not ask the user to run commands; do the work yourself." : "";
	const actGuidance = isCodex ? "For small changes, call `blender_exec` directly. For complex scenes, first draft a real `.py` script in your native Codex workspace, inspect/revise it there, then call `blender_exec` with the final script source." : "Call `blender_exec` to run Python (bpy) code that creates or mutates objects.";
	const fileFirstSection = isCodex ? `
## Codex-Native File-First Scripting

For complex objects, detailed geometry, or large procedural scenes, behave like direct Codex with a Blender bridge:

1. Create a scratch \`.py\` script in the native Codex workspace.
2. Inspect and revise that file before execution.
3. Execute it by passing the final source to \`blender_exec\`.
4. Use traceback/tool results to revise the workspace script, then rerun the corrected source.

This file-first loop is for quality and iteration. Prefer clear, debuggable scripts over cramped inline snippets when the scene is complex.
` : "";
	const complexSceneGuidance = isCodex ? "For complex scenes, prefer a workspace-script drafting loop: create a coherent `.py` file, inspect/revise it, then call `blender_exec` with the final source. Use follow-up calls for measured corrections after verification." : "For complex scenes, prefer a complete, coherent Blender Python script in one `blender_exec` call, then use follow-up calls for measured corrections after verification.";
	return `${agentIdentity}: ${workspaceGuidance} to inspect and mutate the live Blender scene. For Blender inspection or mutation tasks, call tools instead of describing manual steps. For meta/debug questions that can be answered from existing context, answer directly without forcing a Blender call.

## Workflow: PRAV (Perceive-Reason-Act-Verify)

Follow this cycle for every Blender inspection or mutation task:

1. **Perceive**: Call \`blender_scene_info\` FIRST to understand the current scene.
2. **Reason**: Break complex tasks into small steps (one object at a time). Plan briefly, then commit to action.
3. **Act**: ${actGuidance}
4. **Verify**: Call \`blender_viewport_screenshot\` after significant changes to visually verify the result. Fix issues before moving on.

**Hard rules — these are non-negotiable:**

- **If the turn requires Blender inspection or mutation, it MUST result in at least one tool call** until the user's task is fully done.
- **Do not emit user-visible narration before tool calls on tool-needed turns.** If the user asks a meta/debug question that can be answered from existing context, answer directly instead of forcing a Blender call.
- **Never delete or re-create objects you (or an earlier turn of this same task) already created.** If \`blender_scene_info\` shows objects whose names match what you were going to add, treat the task as already partially done — measure them and ADJUST, do not start over. Delete only when the user explicitly asks you to remove or replace something.
- **PRAV's Verify step is QUERY-ONLY.** Use \`blender_object_info\`, \`blender_mesh_stats\`, or another \`blender_scene_info\` to MEASURE, then \`blender_exec\` to NUDGE. Do NOT \`bpy.data.objects.remove(...)\` your own previous output as part of Verify.
- **Phase 2 of two-phase positioning means "measure and adjust", not "rebuild".** Modify \`obj.location\`, \`obj.rotation_euler\`, \`obj.scale\` of the EXISTING object. Don't delete it and add a new primitive.
- **Treat the scene as cumulative across turns.** Each \`blender_exec\` call adds to a running scene; do not assume the scene is empty at the start of each turn.

## Scene Safety

- NEVER delete, replace, rename, hide, or move user objects unless the user explicitly asks for that exact change.
- Be careful with destructive scene, file, or session operations. Use them only when they match the user's explicit request.
- When the task says "add", ADD to the scene — do not clear it first.
- If you need a clean starting area, place new objects away from existing objects and cameras.
- Preserve user materials, lights, cameras, collections, object names, and animation unless the user asks to change them.

## Tools

These Blender tools control the running Blender instance. Call them by emitting a function_call.${nativeToolGuidance}

| Tool | When to use |
|------|-------------|
| \`blender_scene_info\` | Scene overview: objects, materials, cameras, frame range. Always your first call. |
| \`blender_exec\` | Run Blender Python via \`bpy\`. Use for ALL scene mutation, inspection code, materials, lights, cameras, and other Blender-side operations. \`code\` param is the full Python source. |
| \`blender_viewport_screenshot\` | Capture the active 3D viewport as a PNG. Use after every significant change. Leave \`filepath\` omitted/null so the bridge chooses a safe temporary path. |
| \`blender_info\` | Blender version + runtime metadata. Use only when version-specific behavior is needed. |
| \`blender_scene_graph\` | Flat object list with parents + visibility. Use when you need exact object names before editing. |
| \`blender_object_info\` | Location, rotation, scale, dimensions, parent for a single named object. |
| \`blender_mesh_stats\` | Vertex / edge / face / modifier counts for a mesh object. Size operations before editing. |
${fileFirstSection}
## Positioning: Two-Phase Approach (CRITICAL)

Objects cannot be measured before they exist. The AI timing problem means you MUST use a two-phase approach:

### Phase 1 — call \`blender_exec\` to create the object at an approximate position
\`\`\`python
import bpy
bpy.ops.mesh.primitive_cube_add(location=(0, 0, 2.5))
roof = bpy.context.active_object
roof.name = "Roof"
\`\`\`

### Phase 2 — call \`blender_exec\` again to query and adjust
\`\`\`python
import bpy, mathutils
house = bpy.data.objects.get("House")
if house:
    bbox = [house.matrix_world @ mathutils.Vector(c) for c in house.bound_box]
    house_top_z = max(v.z for v in bbox)
    roof = bpy.data.objects.get("Roof")
    if roof:
        roof.location.z = house_top_z
\`\`\`

### Positioning Rules
- NEVER hardcode coordinates without querying existing objects first.
- ALWAYS use \`bpy.data.objects.get("Name")\` — never assume objects exist.
- Use \`matrix_world\` for world-space positions (not \`location\` which is local).
- When parenting: \`bpy.ops.object.parent_set(type='OBJECT', keep_transform=True)\` to preserve world position.
- After parenting, \`child.location\` is LOCAL to parent — use \`matrix_world.translation\` for world position.

## Verification Checklist

Before declaring a task done, verify ALL of these:

1. **Visual check**: Call \`blender_viewport_screenshot\` and confirm the image matches the request.
2. **Object check**: Call \`blender_scene_info\` or \`blender_scene_graph\` and confirm expected objects exist.
3. **Position check**: For positioned objects, query \`blender_object_info\` or compute world-space bounds before adjusting.
4. **Material check**: If materials changed, verify they are assigned and visible in the screenshot.
5. **Clean-state check**: Leave no accidental hidden objects, wrong selections, edit-mode leftovers, or floating disconnected parts.

## Code Rules

- Always start \`blender_exec\` code with \`import bpy\` (and \`import mathutils\` when doing geometry math).
- Access objects with \`bpy.data.objects.get("name")\` and handle None.
- Name every object you create: \`obj.name = "DescriptiveName"\`.
- ${complexSceneGuidance}
- Available in the Blender Python namespace: \`bpy\`, \`mathutils\`, \`json\`.
- Use normal Blender Python patterns when they help you inspect, build, debug, and verify the scene. Prefer reliable, readable code over brittle shortcuts.

## Error Recovery

When a \`blender_exec\` call returns \`status: "error"\`:

1. Read the \`message\` / \`error\` field — it contains the Python traceback or operator hint.
2. **syntax_error**: Fix the Python and call \`blender_exec\` again.
3. **api_error**: Check operator spelling — use the API suggestion the error provides.
4. **runtime_error**: The scene was rolled back. Call \`blender_scene_info\` to see current state, then retry with corrected code.
5. Never retry the same code blindly — fix it first.

### Viewport Recovery

If the screenshot is empty, too zoomed out, blocked, or from a bad angle, use \`blender_exec\` to frame the scene, then call \`blender_viewport_screenshot\` again:

\`\`\`python
import bpy
for area in bpy.context.screen.areas:
    if area.type == "VIEW_3D":
        for region in area.regions:
            if region.type == "WINDOW":
                override = bpy.context.copy()
                override["area"] = area
                override["region"] = region
                with bpy.context.temp_override(**override):
                    bpy.ops.view3d.view_all()
                break
\`\`\`

## User Communication

- The user is usually asking for the visual result, not implementation details.
- Do NOT mention code, scripts, Python, bpy, vertices, faces, or internal tool mechanics in the final user-facing message.
- Do say what you created, adjusted, or verified in plain visual language.
- Ask for clarification only when the user's desired visual outcome is genuinely ambiguous.

## Completion Criteria

A task is done only when:

- All requested objects or modifications are in place.
- Screenshot verification confirms the result matches the request.
- Scene/object checks confirm the expected objects, positions, and materials.
- No tool error is pending.
- The final user-facing message briefly describes the visible result and does not expose implementation details.

## Response Format

1. If no tool is needed, answer directly and briefly from context.
2. For tool-needed tasks, start with the tool call. Do not send a preliminary text sentence.
3. Execute steps with PRAV — perceive, reason, act, verify — by calling tools.
4. After significant changes, ALWAYS call \`blender_viewport_screenshot\`.
5. If something looks wrong in the screenshot, fix it before declaring done.
6. Send exactly one final user-facing text answer after the final Verify step.
7. NEVER give manual instructions (keyboard shortcuts, UI clicks, menu navigation) — always execute the action yourself by calling a tool.`;
}
var init_blender_system_prompt = __esm({ "src/blender-system-prompt.ts"() {} });

//#endregion
//#region src/codex-app-server/blender-dynamic-tools.ts
function buildCodexBlenderThreadStartParams() {
	return {
		developerInstructions: buildSystemPrompt("", { agentName: "Codex" }),
		dynamicTools: buildCodexBlenderDynamicTools(),
		effort: CODEX_APP_SERVER_MODEL_REASONING_EFFORT,
		model: CODEX_APP_SERVER_MODEL,
		modelProvider: "3dagent"
	};
}
function buildCodexBlenderDynamicTools() {
	return [
		{
			description: "Execute Blender Python inside the running Blender instance. Use this for object creation, mesh edits, scene mutation, materials, lights, cameras, file-first scripts, and other bpy operations.",
			inputSchema: objectSchema({ code: {
				description: "Python source to run inside Blender. Multi-line allowed.",
				type: "string"
			} }, ["code"]),
			name: "blender_exec"
		},
		{
			description: "Return a summary of the current Blender scene: active object, selected objects, frame range, render engine, and world settings. Use this before scene edits.",
			inputSchema: objectSchema({}),
			name: "blender_scene_info"
		},
		{
			description: "Return Blender runtime metadata: version, build hash, platform, and Python version. Use only for compatibility checks.",
			inputSchema: objectSchema({}),
			name: "blender_info"
		},
		{
			description: "Return a flat list of scene objects with name, type, parent, and visibility. Use this when exact object names matter.",
			inputSchema: objectSchema({ max_objects: {
				default: 0,
				description: "Cap the returned list size. 0 means no cap.",
				minimum: 0,
				type: "integer"
			} }),
			name: "blender_scene_graph"
		},
		{
			description: "Return location, rotation, scale, dimensions, and parent for a single named object.",
			inputSchema: objectSchema({ name: {
				description: "Exact object name as shown in the outliner.",
				type: "string"
			} }, ["name"]),
			name: "blender_object_info"
		},
		{
			description: "Return vertex, edge, face counts, and modifier list for a mesh object. Use this before size-sensitive mesh edits.",
			inputSchema: objectSchema({ name: {
				description: "Exact mesh object name.",
				type: "string"
			} }, ["name"]),
			name: "blender_mesh_stats"
		},
		{
			description: "Capture the active 3D viewport and return an image for visual inspection. Use after significant scene changes.",
			inputSchema: objectSchema({
				filepath: {
					default: null,
					description: "Must be null or omitted. The bridge chooses a safe temporary file.",
					type: "null"
				},
				lossless: {
					default: false,
					description: "Set true only when you need pixel-exact detail (dense wireframe topology, very small text). The default compressed image is best for general viewport checks and keeps the conversation fast.",
					type: "boolean"
				},
				max_size: {
					default: 800,
					description: "Longest-side pixel size for the screenshot.",
					maximum: MAX_SCREENSHOT_SIZE,
					minimum: 1,
					type: "integer"
				}
			}),
			name: "blender_viewport_screenshot"
		}
	];
}
function createCodexBlenderBridgeTransport(proxyUrl = CODEX_BLENDER_PROXY_URL, opts = {}) {
	const capturePromptFailure$1 = opts.capturePromptFailure ?? capturePromptFailure;
	return { async postBlenderCommand(command) {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), CODEX_BLENDER_BRIDGE_TIMEOUT_MS);
		try {
			const response = await fetch(proxyUrl, {
				body: JSON.stringify(command),
				headers: { "content-type": "application/json" },
				method: "POST",
				signal: controller.signal
			});
			if (!response.ok) {
				captureBlenderBridgeTransportFailure(capturePromptFailure$1, "blender_bridge_http_error", {
					detail: `HTTP ${response.status}`,
					extras: { status: response.status }
				});
				return {
					message: `HTTP ${response.status}`,
					status: "error"
				};
			}
			try {
				return await response.json();
			} catch {
				captureBlenderBridgeTransportFailure(capturePromptFailure$1, "blender_bridge_invalid_json", { detail: "Invalid Blender bridge JSON response" });
				return {
					message: "Invalid Blender bridge JSON response",
					status: "error"
				};
			}
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") {
				captureBlenderBridgeTransportFailure(capturePromptFailure$1, "blender_bridge_timeout", { detail: "Request timed out" });
				return {
					message: "Request timed out",
					status: "error"
				};
			}
			captureBlenderBridgeTransportFailure(capturePromptFailure$1, "blender_bridge_fetch_failed", { detail: describeTransportError(error) });
			return {
				message: "Blender bridge unavailable",
				status: "error"
			};
		} finally {
			clearTimeout(timeout);
		}
	} };
}
function captureBlenderBridgeTransportFailure(capturePromptFailure$1, failure, opts) {
	void capturePromptFailure$1(failure, {
		detail: opts.detail,
		extras: {
			surface: "codex_blender_dynamic_tool",
			...opts.extras ?? {}
		},
		level: "error"
	});
}
function describeTransportError(error) {
	if (error instanceof Error) {
		const name = error.name.trim() || "Error";
		const message = error.message.trim();
		return message ? `${name}: ${message}` : name;
	}
	return typeof error === "string" && error.trim() ? error.trim() : "fetch failed";
}
function createCodexBlenderDynamicToolHandler(transport = createCodexBlenderBridgeTransport()) {
	return (params, context) => {
		if (context.toolManifestFingerprint !== CODEX_BLENDER_TOOL_MANIFEST_FINGERPRINT) return rejected("manifest_mismatch");
		return resolveCodexBlenderDynamicToolCall(params, {
			context,
			transport
		});
	};
}
async function resolveCodexBlenderDynamicToolCall(params, opts) {
	const parsed = parseDynamicToolCallParams(params, opts.context);
	if (!parsed.ok) return rejected(parsed.code);
	const command = buildBlenderCommand(parsed.tool, parsed.arguments);
	if (!command.ok) return rejected(command.code);
	try {
		const result = await opts.transport.postBlenderCommand(command.command);
		return {
			contentItems: codexToolResultContentItems(parsed.tool, result),
			success: !isBridgeErrorResult(result)
		};
	} catch {
		return rejected("bridge_unavailable");
	}
}
function parseDynamicToolCallParams(params, context) {
	const value = asRecord$1(params);
	if (!value) return {
		code: "malformed_params",
		ok: false
	};
	const tool = value.tool;
	const callId = value.callId;
	const threadId = value.threadId;
	const turnId = value.turnId;
	const args = asRecord$1(value.arguments);
	if (typeof tool !== "string" || typeof callId !== "string" || typeof threadId !== "string" || typeof turnId !== "string" || !args) return {
		code: "malformed_params",
		ok: false
	};
	if (value.namespace !== undefined && value.namespace !== null) return {
		code: "unsupported_namespace",
		ok: false
	};
	if (!SAFE_CALL_ID.test(callId)) return {
		code: "invalid_call_id",
		ok: false
	};
	if (!TOOL_NAME_SET.has(tool)) return {
		code: "unsupported_tool",
		ok: false
	};
	if (context.turnCompleted) return {
		code: "turn_already_completed",
		ok: false
	};
	const liveTurns = context.liveTurnThreads?.get(threadId);
	const isActiveThread = Boolean(context.activeThreadId) && threadId === context.activeThreadId;
	if (!isActiveThread && liveTurns === undefined) return {
		code: "thread_mismatch",
		ok: false
	};
	const isActiveTurn = isActiveThread && Boolean(context.activeTurnId) && turnId === context.activeTurnId;
	if (!isActiveTurn && !liveTurns?.has(turnId)) return {
		code: "turn_mismatch",
		ok: false
	};
	if (context.completedToolCallIds.has(callId)) return {
		code: "duplicate_call_id",
		ok: false
	};
	context.completedToolCallIds.add(callId);
	return {
		arguments: args,
		callId,
		ok: true,
		tool
	};
}
function buildBlenderCommand(tool, args) {
	switch (tool) {
		case "blender_exec": {
			const extra = rejectExtraKeys(args, ["code"]);
			if (extra) return extra;
			if (typeof args.code !== "string" || args.code.length === 0) return {
				code: "invalid_arguments",
				ok: false
			};
			const invalid = rejectInvalidBlenderExecCode(args.code);
			if (invalid) return invalid;
			return {
				command: {
					params: { code: args.code },
					type: "execute_code"
				},
				ok: true
			};
		}
		case "blender_scene_info": {
			const extra = rejectExtraKeys(args, []);
			if (extra) return extra;
			return {
				command: {
					params: {},
					type: "get_scene_info"
				},
				ok: true
			};
		}
		case "blender_info": {
			const extra = rejectExtraKeys(args, []);
			if (extra) return extra;
			return {
				command: {
					params: {},
					type: "get_blender_info"
				},
				ok: true
			};
		}
		case "blender_scene_graph": {
			const extra = rejectExtraKeys(args, ["max_objects"]);
			if (extra) return extra;
			const maxObjects = args.max_objects ?? 0;
			if (!isNonNegativeInteger(maxObjects)) return {
				code: "invalid_arguments",
				ok: false
			};
			return {
				command: {
					params: { max_objects: maxObjects },
					type: "get_scene_graph"
				},
				ok: true
			};
		}
		case "blender_object_info": {
			const extra = rejectExtraKeys(args, ["name"]);
			if (extra) return extra;
			if (typeof args.name !== "string" || args.name.length === 0) return {
				code: "invalid_arguments",
				ok: false
			};
			return {
				command: {
					params: { name: args.name },
					type: "get_object_info"
				},
				ok: true
			};
		}
		case "blender_mesh_stats": {
			const extra = rejectExtraKeys(args, ["name"]);
			if (extra) return extra;
			if (typeof args.name !== "string" || args.name.length === 0) return {
				code: "invalid_arguments",
				ok: false
			};
			return {
				command: {
					params: { name: args.name },
					type: "get_mesh_stats"
				},
				ok: true
			};
		}
		case "blender_viewport_screenshot": {
			const extra = rejectExtraKeys(args, [
				"filepath",
				"lossless",
				"max_size"
			]);
			if (extra) return extra;
			const maxSize = args.max_size ?? 800;
			const filepath = args.filepath ?? null;
			const lossless = args.lossless === undefined ? false : args.lossless;
			if (!isScreenshotSize(maxSize)) return {
				code: "invalid_arguments",
				ok: false
			};
			if (typeof lossless !== "boolean") return {
				code: "invalid_arguments",
				ok: false
			};
			if (filepath !== null && typeof filepath !== "string") return {
				code: "invalid_arguments",
				ok: false
			};
			if (typeof filepath === "string") return {
				code: "unsafe_screenshot_path",
				ok: false
			};
			return {
				command: {
					params: {
						filepath,
						lossless,
						max_size: maxSize
					},
					type: "get_viewport_screenshot"
				},
				ok: true
			};
		}
	}
}
function rejected(code) {
	return {
		contentItems: [{
			text: `3D-Agent refused Blender tool call: ${code}`,
			type: "inputText"
		}],
		success: false
	};
}
function isBridgeErrorResult(result) {
	return asRecord$1(result)?.status === "error";
}
function codexToolResultContentItems(tool, result) {
	const imageUrl = tool === "blender_viewport_screenshot" ? screenshotImageDataUrl(result) : null;
	const contentItems = [{
		text: JSON.stringify(textSafeToolResult(result, Boolean(imageUrl))),
		type: "inputText"
	}];
	if (imageUrl) contentItems.push({
		imageUrl,
		type: "inputImage"
	});
	return contentItems;
}
function screenshotImageDataUrl(result) {
	if (isBridgeErrorResult(result)) return null;
	const payload = asRecord$1(asRecord$1(result)?.result);
	const imageUrl = payload?.image_data_url;
	if (typeof imageUrl !== "string") return null;
	const prefix = SCREENSHOT_DATA_URL_PREFIXES.find((candidate) => imageUrl.startsWith(candidate));
	if (!prefix) return null;
	const base64 = imageUrl.slice(prefix.length).replace(/\s+/g, "");
	return /^[A-Za-z0-9+/=]+$/.test(base64) ? `${prefix}${base64}` : null;
}
function textSafeToolResult(result, imageEmbedded) {
	const top = asRecord$1(result);
	const payload = asRecord$1(top?.result);
	if (!top || !payload || typeof payload.image_data_url !== "string") return result;
	const safePayload = {};
	for (const [key, value] of Object.entries(payload)) if (key !== "image_data_url") safePayload[key] = value;
	safePayload.image_embedded = imageEmbedded;
	return {
		...top,
		result: safePayload
	};
}
function objectSchema(properties, required = []) {
	return {
		additionalProperties: false,
		properties,
		required,
		type: "object"
	};
}
function rejectExtraKeys(value, allowed) {
	const allowedSet = new Set(allowed);
	return Object.keys(value).some((key) => !allowedSet.has(key)) ? {
		code: "unexpected_arguments",
		ok: false
	} : undefined;
}
function rejectInvalidBlenderExecCode(code) {
	if (new TextEncoder().encode(code).byteLength > MAX_BLENDER_EXEC_CODE_BYTES) return {
		code: "exec_code_too_large",
		ok: false
	};
	return undefined;
}
function isScreenshotSize(value) {
	return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= MAX_SCREENSHOT_SIZE;
}
function isNonNegativeInteger(value) {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function asRecord$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? value : undefined;
}
var CODEX_BLENDER_TOOL_MANIFEST_FINGERPRINT, CODEX_BLENDER_PROXY_URL, TOOL_NAMES, TOOL_NAME_SET, SAFE_CALL_ID, CODEX_BLENDER_BRIDGE_TIMEOUT_MS, MAX_BLENDER_EXEC_CODE_BYTES, MAX_SCREENSHOT_SIZE, SCREENSHOT_DATA_URL_PREFIXES;
var init_blender_dynamic_tools = __esm({ "src/codex-app-server/blender-dynamic-tools.ts"() {
	init_anthropic_config();
	init_blender_system_prompt();
	init_handled_sentry();
	init_home();
	CODEX_BLENDER_TOOL_MANIFEST_FINGERPRINT = "codex-blender-prav-v1:7-tools:2026-07-10-viewport-jpeg-lossless-param";
	CODEX_BLENDER_PROXY_URL = `${ANTHROPIC_BASE_URL}/v1/blender`;
	TOOL_NAMES = [
		"blender_exec",
		"blender_scene_info",
		"blender_info",
		"blender_scene_graph",
		"blender_object_info",
		"blender_mesh_stats",
		"blender_viewport_screenshot"
	];
	TOOL_NAME_SET = new Set(TOOL_NAMES);
	SAFE_CALL_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
	CODEX_BLENDER_BRIDGE_TIMEOUT_MS = 12e4;
	MAX_BLENDER_EXEC_CODE_BYTES = 5e4;
	MAX_SCREENSHOT_SIZE = 4096;
	SCREENSHOT_DATA_URL_PREFIXES = ["data:image/jpeg;base64,", "data:image/png;base64,"];
} });

//#endregion
//#region src/codex-app-server/friendly-errors.ts
function friendlyReasonText(code, detail) {
	const sentence = FRIENDLY[code] ?? GENERIC;
	const middle = detail ? ` ${detail}` : "";
	return `${sentence}${middle} (${code})`;
}
var FRIENDLY, GENERIC;
var init_friendly_errors = __esm({ "src/codex-app-server/friendly-errors.ts"() {
	FRIENDLY = Object.freeze({
		workspace_unavailable: "Your 3D-Agent workspace couldn't be opened. Check it exists and you have access, then try again.",
		account_scope_missing: "Your account couldn't be found. Try signing out and back in.",
		account_scope_invalid: "Your account couldn't be verified. Try signing out and back in.",
		account_scope_resolve_failed: "Your account info couldn't be loaded. Check your connection and try again.",
		codex_chat_dependencies_unconfigured: "3D-Agent isn't fully set up yet. Please restart the app and try again.",
		turn_id_invalid: "This request couldn't be started. Please try again.",
		turn_id_unavailable: "A new session couldn't be created. Please try again.",
		handoff_runner_unconfigured: "3D-Agent isn't ready yet. Please restart the app and try again.",
		handoff_failed: "Something went wrong while preparing your session.",
		thread_map_write_failed: "Your session couldn't be saved. Your next prompt will start fresh.",
		thread_map_invalid_identifier: "This chat session is invalid. A new one will be started.",
		thread_map_scope_mismatch: "This session belongs to a different account. A new one will be started.",
		thread_map_invalid_json: "Your saved session was corrupted. A new one will be started.",
		thread_map_invalid_record: "Your saved session was corrupted. A new one will be started.",
		thread_map_read_failed: "Your previous session couldn't be loaded. A new one will be started.",
		thread_map_duplicate_mapping: "Your saved sessions clashed. A fresh one will be started for this chat.",
		thread_map_unsupported_version: "Your saved session is from an older version. A new one will be started."
	});
	GENERIC = "Something went wrong starting 3D-Agent. Please try again.";
} });

//#endregion
//#region src/codex-app-server/prompt-failure-capture.ts
async function captureCodexPromptFailure(capturePromptFailure$1, failure, opts = {}) {
	try {
		const captureOpts = { ...opts };
		if (captureOpts.detail) captureOpts.detail = redactSensitiveText(captureOpts.detail);
		await (capturePromptFailure$1 ?? capturePromptFailure)(failure, captureOpts);
	} catch {}
}
var init_prompt_failure_capture = __esm({ "src/codex-app-server/prompt-failure-capture.ts"() {
	init_handled_sentry();
	init_runtime();
} });

//#endregion
//#region src/codex-app-server/handoff.ts
function selectCodexAppServerHandoff(opts) {
	return {
		kind: "codex-app-server",
		selection: opts.selection,
		stream: streamCodexAppServerHandoff(opts),
		turn: summarizeHandoffTurn(opts.turn)
	};
}
/** Wraps the injected Codex runner so app-server failures become Jan chunks. */
async function* streamCodexAppServerHandoff(opts) {
	const chunkId = `${opts.chunkIdPrefix ?? "codex-app-server-handoff"}-${opts.turn.turnId}`;
	if (!opts.runner) {
		await captureCodexPromptFailure(opts.capturePromptFailure, "handoff_runner_unconfigured");
		yield handoffFailureChunk(chunkId, friendlyReasonText("handoff_runner_unconfigured"));
		return;
	}
	try {
		yield* opts.runner.run(opts.turn, opts.signal);
	} catch (err) {
		const detail = errorMessage(err);
		if (!isPromptFailureCaptured(err)) void captureCodexPromptFailure(opts.capturePromptFailure, "handoff_failed", { detail });
		yield handoffFailureChunk(chunkId, friendlyReasonText("handoff_failed", detail));
	}
}
/** Builds a prompt-free handoff summary for safe diagnostics. */
function summarizeHandoffTurn(turn) {
	return {
		chatId: turn.chatId,
		hasCodexThreadId: Boolean(turn.threadId?.trim()),
		turnId: turn.turnId
	};
}
/** Converts an app-server failure into a redacted terminal Jan chunk. */
function handoffFailureChunk(chunkId, message) {
	return makeChunk(chunkId, redactSensitiveText(message), "stop");
}
function errorMessage(err) {
	if (err instanceof Error) return err.message;
	return String(err);
}
var init_handoff = __esm({ "src/codex-app-server/handoff.ts"() {
	init_handled_sentry();
	init_streaming$1();
	init_friendly_errors();
	init_prompt_failure_capture();
	init_runtime();
} });

//#endregion
//#region src/codex-app-server/thread-resume-coordinator.ts
init_streaming$1();
init_friendly_errors();
init_handoff();
init_prompt_failure_capture();
init_runtime();
async function selectCodexAppServerThreadResumeHandoff(opts) {
	try {
		const mapping = await opts.store.get({
			accountScope: opts.accountScope,
			chatId: opts.turn.chatId
		});
		if (mapping && !sameThreadMapScope(mapping, opts)) return threadResumeFailureDecision(opts, "thread_map_scope_mismatch");
		const runnerState = trackRunnerCompletion(opts.runner);
		const resume = trustedResumeTurn(opts.turn, mapping?.codexThreadId, mapping?.toolManifestFingerprint);
		if (resume.decision === "resumed_fingerprint_mismatch") await captureCodexPromptFailure(opts.capturePromptFailure, "thread_resume_fingerprint_mismatch", {
			level: "warning",
			tags: {
				area: "codex_thread_map",
				resume_decision: resume.decision
			}
		});
		const decision = selectCodexAppServerHandoff({
			capturePromptFailure: opts.capturePromptFailure,
			chunkIdPrefix: opts.chunkIdPrefix,
			runner: runnerState.runner,
			selection: opts.selection,
			signal: opts.signal,
			turn: resume.turn
		});
		return {
			...decision,
			stream: streamWithThreadWriteback(opts, decision.stream, runnerState)
		};
	} catch (error) {
		return threadResumeFailureDecision(opts, safeStoreFailureReason(error));
	}
}
function trackRunnerCompletion(runner) {
	let completedSuccessfully = false;
	if (!runner) return {
		getResolvedCodexThreadId: () => undefined,
		wasCompletedSuccessfully: () => false
	};
	return {
		getResolvedCodexThreadId: () => runner.getResolvedCodexThreadId?.(),
		runner: {
			getResolvedCodexThreadId: () => runner.getResolvedCodexThreadId?.(),
			run: async function* (turn, signal) {
				yield* runner.run(turn, signal);
				completedSuccessfully = true;
			}
		},
		wasCompletedSuccessfully: () => completedSuccessfully
	};
}
function trustedResumeTurn(turn, codexThreadId, toolManifestFingerprint) {
	const { threadId: _untrustedThreadId,...baseTurn } = turn;
	if (!codexThreadId) return {
		decision: "fresh_first",
		turn: baseTurn
	};
	if (!turn.toolManifestFingerprint || toolManifestFingerprint !== turn.toolManifestFingerprint) return {
		decision: "resumed_fingerprint_mismatch",
		turn: {
			...baseTurn,
			threadId: codexThreadId
		}
	};
	return {
		decision: "resumed",
		turn: {
			...baseTurn,
			threadId: codexThreadId
		}
	};
}
function sameThreadMapScope(mapping, opts) {
	return mapping.accountScope === opts.accountScope && mapping.chatId === opts.turn.chatId;
}
async function* streamWithThreadWriteback(opts, stream, runnerState) {
	const terminalChunks = [];
	for await (const chunk of stream) if (isTerminalChunk(chunk)) terminalChunks.push(chunk);
else yield chunk;
	if (runnerState.wasCompletedSuccessfully()) {
		const codexThreadId = runnerState.getResolvedCodexThreadId();
		if (codexThreadId) try {
			const record = {
				accountScope: opts.accountScope,
				chatId: opts.turn.chatId,
				codexThreadId
			};
			await opts.store.set(opts.turn.toolManifestFingerprint ? {
				...record,
				toolManifestFingerprint: opts.turn.toolManifestFingerprint
			} : record);
		} catch (error) {
			yield* threadResumeFailureStream(opts, safeWritebackFailureReason(error));
			return;
		}
else await captureCodexPromptFailure(opts.capturePromptFailure, "thread_map_writeback_skipped_no_thread_id", {
			level: "warning",
			tags: {
				area: "codex_thread_map",
				resume_decision: "writeback_skipped"
			}
		});
	}
	yield* terminalChunks;
}
function isTerminalChunk(chunk) {
	return chunk.choices.some((choice) => Boolean(choice.finish_reason));
}
function threadResumeFailureDecision(opts, reason) {
	return {
		kind: "codex-app-server",
		selection: opts.selection,
		stream: threadResumeFailureStream(opts, reason),
		turn: {
			chatId: opts.turn.chatId,
			hasCodexThreadId: false,
			turnId: opts.turn.turnId
		}
	};
}
async function* threadResumeFailureStream(opts, reason) {
	const chunkId = `${opts.chunkIdPrefix ?? "codex-app-server-thread-resume"}-${opts.turn.turnId}`;
	await captureCodexPromptFailure(opts.capturePromptFailure, reason);
	yield makeChunk(chunkId, redactSensitiveText(friendlyReasonText(reason)), "stop");
}
function safeStoreFailureReason(error) {
	if (error instanceof CodexAppServerThreadMapStoreError) return `thread_map_${error.code}`;
	return "thread_map_read_failed";
}
function safeWritebackFailureReason(error) {
	if (error instanceof CodexAppServerThreadMapStoreError) return `thread_map_${error.code}`;
	return "thread_map_write_failed";
}

//#endregion
//#region src/codex-app-server/chat-handoff.ts
init_streaming$1();
init_blender_dynamic_tools();
init_friendly_errors();
init_prompt_failure_capture();
async function selectCodexAppServerChatHandoff(opts) {
	const accountScope = await resolveAccountScope(opts);
	if (!accountScope.ok) return chatHandoffFailureDecision(opts, accountScope.reason);
	const workspaceDir = opts.workspaceDir?.trim();
	if (!workspaceDir) return chatHandoffFailureDecision(opts, "workspace_unavailable");
	return selectCodexAppServerThreadResumeHandoff({
		accountScope: accountScope.value,
		capturePromptFailure: opts.capturePromptFailure,
		chunkIdPrefix: opts.chunkIdPrefix,
		runner: opts.runner,
		selection: opts.selection,
		signal: opts.signal,
		store: opts.store,
		turn: {
			chatId: opts.chatId,
			...buildCodexBlenderThreadStartParams(),
			...codexNativeWorkspaceParams(workspaceDir),
			images: opts.images,
			prompt: opts.prompt,
			...opts.subagentCap !== undefined ? { subagentCap: opts.subagentCap } : {},
			...opts.modelReasoningEffort !== undefined ? {
				modelReasoningEffort: opts.modelReasoningEffort,
				effort: opts.modelReasoningEffort
			} : {},
			...opts.planMode === true || opts.planMode === false ? { planMode: opts.planMode } : {},
			toolManifestFingerprint: CODEX_BLENDER_TOOL_MANIFEST_FINGERPRINT,
			turnId: opts.turnId
		}
	});
}
function chatHandoffFailureDecision(opts, reason) {
	return {
		kind: "codex-app-server",
		selection: opts.selection,
		stream: chatHandoffFailureStream(opts, reason),
		turn: {
			chatId: opts.chatId,
			hasCodexThreadId: false,
			turnId: opts.turnId
		}
	};
}
function codexNativeWorkspaceParams(cwd) {
	return {
		approvalPolicy: "never",
		cwd,
		sandbox: "workspace-write",
		sandboxPolicy: {
			excludeSlashTmp: true,
			excludeTmpdirEnvVar: true,
			networkAccess: false,
			type: "workspaceWrite",
			writableRoots: [cwd]
		}
	};
}
async function resolveAccountScope(opts) {
	if (!opts.accountScopeResolver) return {
		ok: false,
		reason: "account_scope_invalid"
	};
	try {
		const resolved = await opts.accountScopeResolver.resolve();
		return {
			ok: true,
			value: normalizeCodexAppServerAccountScope(resolved.accountScope)
		};
	} catch (error) {
		if (error instanceof CodexAppServerAccountScopeResolverError) return {
			ok: false,
			reason: "account_scope_invalid"
		};
		return {
			ok: false,
			reason: "account_scope_resolve_failed"
		};
	}
}
async function* chatHandoffFailureStream(opts, reason) {
	const chunkId = `${opts.chunkIdPrefix ?? "codex-app-server-chat-handoff"}-${opts.turnId}`;
	await captureCodexPromptFailure(opts.capturePromptFailure, reason);
	yield makeChunk(chunkId, friendlyReasonText(reason), "stop");
}

//#endregion
//#region src/codex-app-server/chat-routing.ts
init_streaming$1();
init_friendly_errors();
init_prompt_failure_capture();
async function selectCodexAppServerChatRouting(opts) {
	if (!opts.store) return chatRoutingFailureDecision(opts, "codex_chat_dependencies_unconfigured");
	return selectCodexAppServerChatHandoff({
		accountScopeResolver: opts.accountScopeResolver,
		capturePromptFailure: opts.capturePromptFailure,
		chatId: opts.chatId,
		chunkIdPrefix: opts.chunkIdPrefix,
		images: opts.images,
		prompt: opts.prompt,
		runner: opts.runner,
		selection: opts.selection,
		signal: opts.signal,
		store: opts.store,
		subagentCap: opts.subagentCap,
		modelReasoningEffort: opts.modelReasoningEffort,
		planMode: opts.planMode,
		turnId: opts.turnId,
		workspaceDir: opts.workspaceDir
	});
}
function chatRoutingFailureDecision(opts, reason) {
	return {
		kind: "codex-app-server",
		selection: opts.selection,
		stream: chatRoutingFailureStream(opts, reason),
		turn: {
			chatId: opts.chatId,
			hasCodexThreadId: false,
			turnId: opts.turnId
		}
	};
}
async function* chatRoutingFailureStream(opts, reason) {
	const chunkId = `${opts.chunkIdPrefix ?? "codex-app-server-chat-routing"}-${opts.turnId}`;
	await captureCodexPromptFailure(opts.capturePromptFailure, reason);
	yield makeChunk(chunkId, friendlyReasonText(reason), "stop");
}

//#endregion
//#region src/codex-app-server/engine-chat-routing.ts
init_src();
init_streaming$1();
init_friendly_errors();
init_home();
init_prompt_failure_capture();
init_turn_id();
async function selectCodexAgentEngineChatRoute(opts) {
	const chatId = opts.request.thread_id || ephemeralChatId();
	const payload = extractUserPromptPayload(opts.request.messages);
	if (!payload || !payload.prompt && !payload.images?.length) throw new Error("No user message in chatCompletionRequest");
	if (payload.images?.length) logger.info("codex user prompt images", {
		diagnosticSchema: "payload_bytes_v1",
		provenance: "user_upload",
		imageCount: payload.images.length,
		imageDecodedBytes: payload.images.reduce((total, image) => total + decodedBase64Length(image.source.data), 0)
	});
	const runtimeSelection = selectCodexAgentRuntime(opts.runtimeFlagValue);
	const codexAppServer = await resolveCodexAppServerDependencies(opts);
	if (codexAppServer.kind === "unavailable") return {
		kind: "codex-app-server",
		stream: codexAppServerRoutingSetupFailureStream(codexAppServer.reason)
	};
	let turnId;
	try {
		turnId = resolveCodexAppServerTurnId(codexAppServer.dependencies);
	} catch (error) {
		if (error instanceof CodexAppServerTurnIdError) return {
			kind: "codex-app-server",
			stream: codexAppServerRoutingSetupFailureStream(error.code === "invalid_turn_id" ? "turn_id_invalid" : "turn_id_unavailable", codexAppServer.dependencies?.capturePromptFailure)
		};
		throw error;
	}
	const workspaceDir = await resolveCodexWorkspaceDir(chatId, codexAppServer.dependencies);
	if (workspaceDir.kind === "unavailable") return {
		kind: "codex-app-server",
		stream: codexAppServerRoutingSetupFailureStream("workspace_unavailable", codexAppServer.dependencies?.capturePromptFailure)
	};
	const codexDecision = await selectCodexAppServerChatRouting({
		accountScopeResolver: codexAppServer.dependencies?.accountScopeResolver,
		capturePromptFailure: codexAppServer.dependencies?.capturePromptFailure,
		chatId,
		images: payload.images,
		prompt: payload.prompt,
		runner: codexAppServer.dependencies?.runner,
		selection: runtimeSelection,
		signal: opts.abortController?.signal,
		store: codexAppServer.dependencies?.store,
		subagentCap: readSubagentCap(opts.request),
		modelReasoningEffort: readModelReasoningEffort(opts.request),
		planMode: readPlanMode(opts.request),
		turnId,
		workspaceDir: workspaceDir.value
	});
	return {
		kind: "codex-app-server",
		stream: codexDecision.stream
	};
}
async function resolveCodexWorkspaceDir(chatId, deps) {
	const resolver = deps?.workspaceResolver;
	if (!resolver) return { kind: "unavailable" };
	try {
		const workspaceDir = await resolver.resolve(chatId);
		const trimmedWorkspaceDir = workspaceDir.trim();
		return trimmedWorkspaceDir ? {
			kind: "available",
			value: trimmedWorkspaceDir
		} : { kind: "unavailable" };
	} catch {
		return { kind: "unavailable" };
	}
}
async function resolveCodexAppServerDependencies(opts) {
	if (opts.codexAppServer) return {
		dependencies: opts.codexAppServer,
		kind: "available"
	};
	const result = await buildTauriCodexAppServerChatDependencies({
		...opts.codexAppServerBuilder,
		runtimeFlagValue: opts.runtimeFlagValue
	});
	if (result.kind === "unavailable") return {
		kind: "unavailable",
		reason: result.reason
	};
	return {
		dependencies: result.dependencies,
		kind: "available"
	};
}
function resolveCodexAppServerTurnId(deps) {
	const raw = deps?.createTurnId ? deps.createTurnId() : createCodexAppServerTurnId();
	return normalizeCodexAppServerTurnId(raw);
}
async function* codexAppServerRoutingSetupFailureStream(reason, capturePromptFailure$1) {
	await captureCodexPromptFailure(capturePromptFailure$1, reason);
	yield makeChunk("codex-app-server-chat-routing-setup", friendlyReasonText(reason), "stop");
}
/**
* The composer subagent ceiling (#1073) rides on the chat request as
* `subagent_cap` (an app-web extension field on chatCompletionRequest). Read it
* defensively: a non-finite/negative value means "unset" (Codex's own default).
*/
function readSubagentCap(request) {
	const raw = request.subagent_cap;
	if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return undefined;
	return Math.trunc(raw);
}
/**
* The composer reasoning-effort choice (#1097) rides on the chat request as
* `model_reasoning_effort` (an app-web extension field on chatCompletionRequest,
* already tier-clamped client-side). Read it defensively: a non-string or
* unknown reasoning level means "unset", and the per-turn config.toml falls back
* to Codex's default ("high"). The server still bounds abuse by token budget.
*/
function readModelReasoningEffort(request) {
	const raw = request.model_reasoning_effort;
	if (typeof raw !== "string") return undefined;
	const normalized = raw.trim().toLowerCase();
	return isKnownReasoningEffort(normalized) ? normalized : undefined;
}
/**
* The composer plan-mode toggle (#1099) rides on the chat request as
* `plan_mode` (an app-web extension field, already tier-gated client-side).
*
* TRI-STATE (RUN-14): `true` enters plan mode, `false` is an explicit EXIT, and
* absent stays `undefined` (a vanilla never-entered-plan turn). The distinction
* is load-bearing: Codex persists a thread's `collaborationMode` across turns
* and its plan preset only ends "when a developer message explicitly ends it",
* so an exit turn must send `collaborationMode {mode:"default"}` — omitting it
* (the old `false → undefined` collapse) left the thread stuck in plan mode.
*/
function readPlanMode(request) {
	const raw = request.plan_mode;
	if (raw === true) return true;
	if (raw === false) return false;
	return undefined;
}

//#endregion
//#region src/turn-trace.ts
async function startTurnTrace(turnId, invoke$2, opts = {}) {
	const resolved = invoke$2 ?? await (opts.loadInvoke ?? loadTauriInvoke$1)();
	if (!resolved) return null;
	try {
		await resolved("start_turn_trace", { turnId });
	} catch {}
	const events = [];
	let finished = false;
	return {
		record(name) {
			if (!finished) events.push({
				name,
				epochMs: Date.now()
			});
		},
		async finish(status) {
			if (finished) return;
			finished = true;
			events.push({
				name: "turn_completed",
				epochMs: Date.now()
			});
			try {
				await resolved("finish_turn_trace", { input: {
					turnId,
					status,
					events
				} });
			} catch {}
		}
	};
}
var init_turn_trace = __esm({ "src/turn-trace.ts"() {
	init_handled_sentry();
} });

//#endregion
//#region src/codex-app-server/collaboration-mode-instructions.ts
var CODEX_DEFAULT_MODE_DEVELOPER_INSTRUCTIONS;
var init_collaboration_mode_instructions = __esm({ "src/codex-app-server/collaboration-mode-instructions.ts"() {
	CODEX_DEFAULT_MODE_DEVELOPER_INSTRUCTIONS = `# Collaboration Mode: Default

You are now in Default mode. Any previous instructions for other modes (e.g. Plan mode) are no longer active.

Your active mode changes only when new developer instructions with a different \`<collaboration_mode>...</collaboration_mode>\` change it; user requests or tool descriptions do not change mode by themselves. Known mode names are Default and Plan.

## request_user_input availability

Use the \`request_user_input\` tool only when it is listed in the available tools for this turn.

In Default mode, strongly prefer making reasonable assumptions and executing the user's request rather than stopping to ask questions. If you absolutely must ask a question because the answer cannot be discovered from local context and a reasonable assumption would be risky, ask the user directly with a concise plain-text question. Never write a multiple choice question as a textual assistant message.
`;
} });

//#endregion
//#region src/codex-app-server/streaming.ts
/**
* The parent's brief is shown verbatim only when it's human text. An
* image-only spawn carries a `local_image://…`/temp-file reference (or JSON
* items) as its prompt — never surface that raw path as the brief.
*/
function cleanSubagentBrief(prompt) {
	const text = prompt?.trim();
	if (!text) return undefined;
	if (/^[[{]/.test(text)) return undefined;
	if (/\b(local_image|file:|data:|\/var\/folders\/)/i.test(text)) return undefined;
	if (/\.(png|jpe?g|gif|webp|bmp)\b/i.test(text)) return undefined;
	return text.slice(0, 280);
}
function progressToolCallForEvent(event, safeId) {
	if (event.kind === "tool-call-request") {
		const subagentPhase = subagentToolPhase(event.toolName);
		if (subagentPhase) return {
			input: {
				source: "codex-app-server",
				subagentPhase
			},
			toolCallId: prefixedId("codex-subagent", event.requestId, safeId),
			toolName: "CodexSubagent"
		};
		const toolName = normalizeProviderExecutedToolName(event.toolName);
		return {
			input: {
				source: "codex-app-server",
				...toolName ? {} : { toolName: safeDiagnosticText(event.toolName) }
			},
			toolCallId: prefixedId("codex-tool", event.requestId, safeId),
			toolName: toolName ?? "CodexTool"
		};
	}
	if (event.kind === "approval-request") return {
		input: approvalProgressInput(event.approvalKind),
		toolCallId: prefixedId("codex-approval", event.requestId, safeId),
		toolName: event.approvalKind === "file-change" ? "Edit" : "Bash"
	};
	if (event.kind === "user-input-request" && event.questions && event.questions.length > 0) return {
		input: {
			questions: event.questions,
			requestId: String(event.requestId)
		},
		toolCallId: prefixedId("codex-user-input", event.requestId, safeId),
		toolName: "CodexUserInput"
	};
	if (event.kind === "command-output-delta") return {
		input: {
			outputBytesBase64: event.deltaBase64Length,
			source: "codex-app-server",
			stream: event.stream ?? "unknown"
		},
		toolCallId: `codex-command-${safeId(event.processId ?? "unknown")}`,
		toolName: "Bash"
	};
	if (event.kind === "file-change-patch-updated") return {
		input: {
			patch: "[redacted]",
			source: "codex-app-server"
		},
		toolCallId: `codex-file-change-${safeId(event.itemId ?? "unknown")}`,
		toolName: "Edit"
	};
	if (event.kind === "native-codex-event" && event.isSubagent) {
		const identity = event.itemId ?? event.senderThreadId ?? event.receiverThreadIds?.[0] ?? "unknown";
		const subagentPhase = subagentToolPhase(event.tool);
		if (subagentPhase === "dispatch" && !isTerminalItemStatus(event.itemStatus)) return null;
		const brief = cleanSubagentBrief(event.subagentPrompt);
		return {
			input: {
				source: "codex-app-server",
				...event.agentNickname ? { agentNickname: event.agentNickname } : {},
				...event.agentRole ? { agentRole: event.agentRole } : {},
				...event.itemStatus ? { itemStatus: event.itemStatus } : {},
				...subagentPhase ? { subagentPhase } : {},
				...brief ? { subagentPrompt: brief } : {}
			},
			toolCallId: prefixedId("codex-subagent", identity, safeId),
			toolName: "CodexSubagent"
		};
	}
	return null;
}
/** Terminal collab item statuses observed on the live wire. */
function isTerminalItemStatus(status) {
	if (!status) return false;
	const normalized = status.toLowerCase();
	return normalized === "completed" || normalized === "failed" || normalized === "errored";
}
function approvalProgressInput(kind) {
	return {
		approvalKind: kind,
		source: "codex-app-server"
	};
}
function appServerFailureText(errorCode, stopReason) {
	switch (stopReason) {
		case "turn_budget_exceeded": return "This request hit its step budget. Start a new prompt to continue. (turn_budget_exceeded)";
		case "gateway_stream_failed": return "AI gateway stream failed before completion. (gateway_stream_failed)";
		case "rate_limited": return "3D-Agent is busy right now. Please try again in a moment. (rate_limited)";
		case "quota_exhausted": return "You've used all your prompts. Upgrade your plan or wait for the monthly reset. (quota_exhausted)";
		case "auth_expired": return "Your session expired. Please sign in again to continue. (auth_expired)";
		case "turn_in_flight": return "A request is already running for this chat. Wait for it to finish. (turn_in_flight)";
		case "service_unavailable": return "3D-Agent is temporarily unavailable. Please try again shortly. (service_unavailable)";
		case "connection_failed": return "Couldn't reach the 3D-Agent service. Check your internet connection and try again. (connection_failed)";
		default: return errorCode === undefined ? "Codex app-server request failed." : `Codex app-server request failed with code ${errorCode}.`;
	}
}
function turnErrorFailureText(event) {
	if (event.stopReason) return appServerFailureText(event.httpStatusCode, event.stopReason);
	const code = event.codexErrorInfo ? `codex_${event.codexErrorInfo.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()}` : "codex_turn_error";
	const status = event.httpStatusCode !== undefined ? ` (HTTP ${event.httpStatusCode})` : "";
	return `The agent run failed before producing a response${status}. Please try again. (${code})`;
}
function normalizeProviderExecutedToolName(toolName) {
	const trimmed = toolName?.trim();
	if (!trimmed) return null;
	if (!PROVIDER_EXECUTED_TOOL_NAMES.has(trimmed)) return null;
	return trimmed;
}
function prefixedId(prefix, id, safeId) {
	return `${prefix}-${safeId(String(id))}`;
}
function safeDiagnosticText(value) {
	const trimmed = value?.trim();
	if (!trimmed) return "unknown";
	return trimmed.replace(/[^\w.:-]+/g, "-").slice(0, 128);
}
function makeToolCallChunk(chunkId, call) {
	return {
		id: chunkId,
		object: "chat.completion.chunk",
		created: Math.floor(Date.now() / 1e3),
		model: "3d-agent",
		choices: [{
			index: 0,
			delta: {
				role: "assistant",
				tool_calls: [{
					id: call.toolCallId,
					type: "function",
					function: {
						name: call.toolName,
						arguments: JSON.stringify(call.input)
					}
				}]
			},
			finish_reason: null
		}]
	};
}
var DEFAULT_OPTIONS, ENVELOPE_SUPPRESS_BUDGET, ENVELOPE_MARKER, InterAgentEnvelopeFilter, PROVIDER_EXECUTED_TOOL_NAMES, CodexAppServerStreamAdapter;
var init_streaming = __esm({ "src/codex-app-server/streaming.ts"() {
	init_streaming$1();
	init_events();
	DEFAULT_OPTIONS = { emitProgressToolCalls: true };
	ENVELOPE_SUPPRESS_BUDGET = 2e3;
	ENVELOPE_MARKER = "{\"author\":\"";
	InterAgentEnvelopeFilter = class {
		pending = "";
		depth = -1;
		inString = false;
		escaped = false;
		used = 0;
		/** Filters a delta, returning the text safe to emit now. */
		push(delta) {
			if (this.depth < 0 && this.pending.length === 0 && !delta.includes("{")) return delta;
			const s = this.pending + delta;
			this.pending = "";
			let out = "";
			let i = 0;
			while (i < s.length) {
				if (this.depth >= 0) {
					if (this.used >= ENVELOPE_SUPPRESS_BUDGET) {
						this.depth = -1;
						continue;
					}
					const ch = s[i];
					i += 1;
					this.used += 1;
					if (this.escaped) {
						this.escaped = false;
						continue;
					}
					if (ch === "\\") {
						this.escaped = true;
						continue;
					}
					if (ch === "\"") {
						this.inString = !this.inString;
						continue;
					}
					if (this.inString) continue;
					if (ch === "{") this.depth += 1;
					if (ch === "}") {
						this.depth -= 1;
						if (this.depth === 0) this.depth = -1;
					}
					continue;
				}
				const start = s.indexOf(ENVELOPE_MARKER, i);
				if (start !== -1) {
					out += s.slice(i, start);
					this.depth = 1;
					this.inString = false;
					this.escaped = false;
					this.used = 1;
					i = start + 1;
					continue;
				}
				const rest = s.slice(i);
				let hold = 0;
				const maxHold = Math.min(rest.length, ENVELOPE_MARKER.length - 1);
				for (let k = maxHold; k >= 1; k -= 1) {
					let matches = true;
					for (let j = 0; j < k; j += 1) if (rest.charCodeAt(rest.length - k + j) !== ENVELOPE_MARKER.charCodeAt(j)) {
						matches = false;
						break;
					}
					if (matches) {
						hold = k;
						break;
					}
				}
				out += rest.slice(0, rest.length - hold);
				this.pending = rest.slice(rest.length - hold);
				break;
			}
			return out;
		}
		/** Returns held-back text at end of turn (a partial marker is real text). */
		flush() {
			const out = this.depth >= 0 ? "" : this.pending;
			this.pending = "";
			this.depth = -1;
			this.inString = false;
			this.escaped = false;
			this.used = 0;
			return out;
		}
	};
	PROVIDER_EXECUTED_TOOL_NAMES = new Set([
		"CodexTool",
		"CodexPlan",
		"CodexUserInput",
		"Bash",
		"Read",
		"Write",
		"Edit",
		"Glob",
		"Grep",
		"blender_exec",
		"blender_scene_info",
		"blender_info",
		"blender_scene_graph",
		"blender_object_info",
		"blender_mesh_stats",
		"blender_viewport_screenshot"
	]);
	CodexAppServerStreamAdapter = class {
		options;
		emittedProgressToolCalls = new Set();
		unknownIdCounter = 0;
		lastReasoningItemId;
		reasoningSummarySeen = false;
		activeThreadId;
		visibleOutputEmitted = false;
		visibleTextEmitted = false;
		lastTurnErrorText;
		childTextByThread = new Map();
		bufferedAnswerItemText = "";
		bufferedAnswerItemTextByItemId = new Map();
		bufferedAnswerIsPlan = false;
		planMarkerEmitted = false;
		streamedPlanTextByItemId = new Map();
		envelopeFilters = new Map();
		constructor(options = {}) {
			this.options = {
				...DEFAULT_OPTIONS,
				...options
			};
		}
		/** The visible (parent) thread — set by the session whenever it changes. */
		setActiveThreadId(threadId) {
			this.activeThreadId = threadId;
		}
		toChunks(event, chunkId) {
			if (event.kind === "agent-text-delta") {
				const text = this.envelopeFilter(event.threadId).push(event.delta);
				if (text.length === 0) return [];
				if (this.isForeignThread(event.threadId)) {
					this.appendChildText(event.threadId ?? "", text);
					return [];
				}
				this.visibleOutputEmitted = true;
				this.visibleTextEmitted = true;
				return [makeChunk(chunkId, text)];
			}
			if (event.kind === "reasoning-delta") return this.reasoningChunks(event, chunkId);
			if (event.kind === "plan-delta") return this.planDeltaChunks(event, chunkId);
			if (event.kind === "turn-error") {
				this.lastTurnErrorText = turnErrorFailureText(event);
				if (event.willRetry) return [];
				const text = this.lastTurnErrorText;
				this.resetTurnState();
				return [makeChunk(chunkId, text, "stop")];
			}
			if (event.kind === "lifecycle" && event.method === "turn/completed") {
				if (this.isForeignThread(event.threadId)) return [];
				const failed = event.turnStatus === "failed";
				let parentTail = "";
				for (const [threadId, filter] of this.envelopeFilters) {
					const tail = filter.flush();
					if (tail.length === 0) continue;
					if (this.isForeignThread(threadId || undefined)) this.appendChildText(threadId, tail);
else parentTail += tail;
				}
				const answerItemText = this.bufferedAnswerItemText.trim();
				const answerIsPlan = this.bufferedAnswerIsPlan;
				const streamedPlanDeltasSeen = this.streamedPlanTextByItemId.size > 0;
				const streamedPlanRemainder = answerIsPlan && streamedPlanDeltasSeen ? this.streamedPlanRemainder() : "";
				const empty = !this.visibleOutputEmitted && parentTail.length === 0 && answerItemText.length === 0;
				const parentSpoke = this.visibleTextEmitted || parentTail.length > 0;
				const bufferedChildText = [...this.childTextByThread.values()].map((text) => text.trim()).filter((text) => text.length > 0).join("\n\n");
				const lastError = this.lastTurnErrorText;
				this.resetTurnState();
				if (failed) return [makeChunk(chunkId, lastError ?? appServerFailureText(undefined, undefined), "stop")];
				if (answerItemText.length > 0) {
					if (answerIsPlan && streamedPlanDeltasSeen) return [makeChunk(chunkId, streamedPlanRemainder, "stop")];
					if (answerIsPlan) return [this.planMarkerChunk(chunkId), makeChunk(chunkId, answerItemText, "stop")];
					return [makeChunk(chunkId, answerItemText, "stop")];
				}
				if (!parentSpoke && bufferedChildText.length > 0) return [makeChunk(chunkId, bufferedChildText, "stop")];
				if (parentTail.length > 0) return [makeChunk(chunkId, parentTail, "stop")];
				if (empty) return [makeChunk(chunkId, lastError ?? "The agent finished without producing a response. Please try again. (turn_completed_no_output)", "stop")];
				return [makeChunk(chunkId, "", "stop")];
			}
			if (event.kind === "response" && !event.ok) return [makeChunk(chunkId, appServerFailureText(event.errorCode, event.stopReason), "stop")];
			if (event.kind === "item-status" && event.answerText && !this.isForeignThread(event.threadId)) {
				this.bufferedAnswerItemText += event.answerText;
				const itemKey = event.itemId ?? "";
				this.bufferedAnswerItemTextByItemId.set(itemKey, (this.bufferedAnswerItemTextByItemId.get(itemKey) ?? "") + event.answerText);
				if (event.itemType?.toLowerCase() === "plan") this.bufferedAnswerIsPlan = true;
			}
			if (!this.options.emitProgressToolCalls) return [];
			const progress = progressToolCallForEvent(event, (value) => this.safeId(value));
			if (!progress) return [];
			if (this.emittedProgressToolCalls.has(progress.toolCallId)) return [];
			this.emittedProgressToolCalls.add(progress.toolCallId);
			this.visibleOutputEmitted = true;
			return [makeToolCallChunk(chunkId, progress)];
		}
		resetTurnState() {
			this.emittedProgressToolCalls.clear();
			this.lastReasoningItemId = undefined;
			this.reasoningSummarySeen = false;
			this.visibleOutputEmitted = false;
			this.visibleTextEmitted = false;
			this.lastTurnErrorText = undefined;
			this.childTextByThread.clear();
			this.bufferedAnswerItemText = "";
			this.bufferedAnswerItemTextByItemId.clear();
			this.bufferedAnswerIsPlan = false;
			this.planMarkerEmitted = false;
			this.streamedPlanTextByItemId.clear();
			this.envelopeFilters.clear();
		}
		envelopeFilter(threadId) {
			const key = threadId ?? "";
			let filter = this.envelopeFilters.get(key);
			if (!filter) {
				filter = new InterAgentEnvelopeFilter();
				this.envelopeFilters.set(key, filter);
			}
			return filter;
		}
		appendChildText(threadId, text) {
			this.childTextByThread.set(threadId, (this.childTextByThread.get(threadId) ?? "") + text);
		}
		planDeltaChunks(event, chunkId) {
			if (this.isForeignThread(event.threadId)) return [];
			const itemKey = event.itemId ?? "";
			this.streamedPlanTextByItemId.set(itemKey, (this.streamedPlanTextByItemId.get(itemKey) ?? "") + event.delta);
			const chunks = [];
			if (!this.planMarkerEmitted) {
				chunks.push(this.planMarkerChunk(chunkId));
				this.planMarkerEmitted = true;
				this.visibleOutputEmitted = true;
			}
			if (event.delta.length > 0) {
				chunks.push(makeChunk(chunkId, event.delta));
				this.visibleOutputEmitted = true;
				this.visibleTextEmitted = true;
			}
			return chunks;
		}
		streamedPlanRemainder() {
			if (this.bufferedAnswerItemTextByItemId.size > 0) {
				let remainder = "";
				for (const [itemId, fullText] of this.bufferedAnswerItemTextByItemId) {
					const streamed = this.streamedPlanTextByItemId.get(itemId);
					if (streamed === undefined) remainder += fullText;
else if (fullText.startsWith(streamed)) remainder += fullText.slice(streamed.length);
				}
				return remainder;
			}
			if (this.streamedPlanTextByItemId.size === 1) {
				const streamed = [...this.streamedPlanTextByItemId.values()][0] ?? "";
				return this.bufferedAnswerItemText.startsWith(streamed) ? this.bufferedAnswerItemText.slice(streamed.length) : "";
			}
			return "";
		}
		planMarkerChunk(chunkId) {
			return makeToolCallChunk(chunkId, {
				input: { source: "codex-app-server" },
				toolCallId: `codex-plan-${this.safeId(chunkId)}`,
				toolName: "CodexPlan"
			});
		}
		/**
		* Streams reasoning deltas through, preferring summary text: once a summary
		* delta is seen this turn, raw chain-of-thought deltas are dropped so the
		* two variants never interleave in one thought stream. A new reasoning item
		* becomes a paragraph break.
		*/
		reasoningChunks(event, chunkId) {
			if (this.isForeignThread(event.threadId)) return [];
			if (event.summary) this.reasoningSummarySeen = true;
else if (this.reasoningSummarySeen) return [];
			if (event.delta.length === 0) return [];
			const isNewItem = event.itemId !== undefined && this.lastReasoningItemId !== undefined && event.itemId !== this.lastReasoningItemId;
			this.lastReasoningItemId = event.itemId ?? this.lastReasoningItemId;
			return [makeReasoningChunk(chunkId, isNewItem ? `\n\n${event.delta}` : event.delta)];
		}
		/** True for events from a thread other than the visible (parent) thread. */
		isForeignThread(threadId) {
			return !isVisibleThread(threadId, this.activeThreadId);
		}
		safeId(value) {
			const sanitized = value.trim().replace(/[^A-Za-z0-9._:-]+/g, "-");
			if (sanitized.length > 0) return sanitized.slice(0, 128);
			this.unknownIdCounter = (this.unknownIdCounter + 1) % 1e6;
			return `unknown-${this.unknownIdCounter}`;
		}
	};
} });

//#endregion
//#region src/codex-app-server/user-input-requests.ts
function registerPendingUserInputRequest(requestId) {
	const key = String(requestId);
	cancelUserInputRequest(key);
	return new Promise((resolve$1) => {
		pending.set(key, { resolve: resolve$1 });
	});
}
function resolveUserInputRequest(requestId, answers) {
	const key = String(requestId);
	const request = pending.get(key);
	if (!request) return false;
	pending.delete(key);
	request.resolve({
		type: "answered",
		answers: normalizeAnswers(answers)
	});
	return true;
}
function cancelUserInputRequest(requestId) {
	const key = String(requestId);
	const request = pending.get(key);
	if (!request) return false;
	pending.delete(key);
	request.resolve({ type: "cancelled" });
	return true;
}
function normalizeAnswers(answers) {
	const out = {};
	for (const [questionId, values] of Object.entries(answers)) out[questionId] = { answers: Array.isArray(values) ? values.filter((value) => typeof value === "string") : [] };
	return out;
}
var pending;
var init_user_input_requests = __esm({ "src/codex-app-server/user-input-requests.ts"() {
	pending = new Map();
} });

//#endregion
//#region src/codex-app-server/session.ts
function unsupportedServerRequestResponse(id) {
	return {
		jsonrpc: "2.0",
		id,
		error: {
			code: -32601,
			message: "Unsupported Codex app-server request."
		}
	};
}
function errorClass(err) {
	if (err instanceof Error && err.name.trim()) return err.name.slice(0, 80);
	return typeof err;
}
function requireSessionTurnId(value) {
	const trimmed = value.trim();
	if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(trimmed)) throw new Error("Invalid Codex app-server turn id");
	return trimmed;
}
function buildTurnStartParams(opts, threadId, reasoningSummaryEnabled) {
	const params = {
		input: buildTurnInput(opts),
		threadId
	};
	if (opts.approvalPolicy !== undefined) params.approvalPolicy = opts.approvalPolicy;
	if (opts.approvalsReviewer !== undefined) params.approvalsReviewer = opts.approvalsReviewer;
	if (opts.cwd !== undefined) params.cwd = opts.cwd;
	if (opts.planMode === true || opts.planMode === false) params.collaborationMode = {
		mode: opts.planMode ? "plan" : "default",
		settings: {
			model: opts.model ?? CODEX_APP_SERVER_MODEL,
			...opts.effort !== undefined ? { reasoning_effort: opts.effort } : {},
			...opts.planMode === false ? { developer_instructions: CODEX_DEFAULT_MODE_DEVELOPER_INSTRUCTIONS } : {}
		}
	};
else if (opts.effort !== undefined) params.effort = opts.effort;
	if (reasoningSummaryEnabled) params.summary = "auto";
	if (opts.experimentalRawEvents === true) params.experimentalRawEvents = true;
	if (opts.model !== undefined) params.model = opts.model;
	if (opts.sandboxPolicy !== undefined && opts.sandboxPolicy !== null) params.sandboxPolicy = opts.sandboxPolicy;
	return params;
}
function buildTurnInput(opts) {
	const input = [];
	if (opts.prompt.length > 0) input.push({
		type: "text",
		text: opts.prompt
	});
	for (const image of opts.images ?? []) input.push({
		type: "image",
		url: `data:${image.source.media_type};base64,${image.source.data.replace(/\s+/g, "")}`
	});
	return input;
}
function buildThreadStartParams(opts) {
	const params = {};
	if (opts.approvalPolicy !== undefined) params.approvalPolicy = opts.approvalPolicy;
	if (opts.approvalsReviewer !== undefined) params.approvalsReviewer = opts.approvalsReviewer;
	if (opts.cwd !== undefined) params.cwd = opts.cwd;
	if (opts.developerInstructions !== undefined) params.developerInstructions = opts.developerInstructions;
	if (opts.dynamicTools !== undefined) params.dynamicTools = [...opts.dynamicTools];
	if (opts.model !== undefined) params.model = opts.model;
	if (opts.modelProvider !== undefined) params.modelProvider = opts.modelProvider;
	if (opts.sandbox !== undefined) params.sandbox = opts.sandbox;
	return params;
}
function threadIdFromThreadStartResult(value) {
	const result = asRecord(value);
	const thread = asRecord(result.thread);
	return firstString(thread, [
		"id",
		"threadId",
		"thread_id"
	]) ?? firstString(result, ["threadId", "thread_id"]);
}
function accountLoginResolution(message, pendingRequestId) {
	if (isJsonRpcResponse(message) && message.id === pendingRequestId) return accountLoginResponseResolution(message);
	if (isAccountLoginCompletedNotification(message)) {
		const params = asRecord(message.params);
		return params.success === true ? "completed" : "failed";
	}
	return "ignore";
}
function accountLoginResponseResolution(message) {
	if (message.error) return "failed";
	const result = asRecord(message.result);
	if (result.type === "chatgptAuthTokens") return "completed";
	return "failed";
}
function isAccountLoginCompletedNotification(message) {
	return !isJsonRpcResponse(message) && !isJsonRpcRequest(message) && "method" in message ? message.method === "account/login/completed" : false;
}
function firstString(params, keys) {
	for (const key of keys) {
		const value = params[key];
		if (typeof value === "string") return value;
	}
	return undefined;
}
function asRecord(value) {
	return typeof value === "object" && value !== null ? value : {};
}
var nextUserInputScopeNumber, CodexAppServerSession;
var init_session = __esm({ "src/codex-app-server/session.ts"() {
	init_src();
	init_adapter();
	init_collaboration_mode_instructions();
	init_events();
	init_handoff();
	init_home();
	init_jsonrpc();
	init_prompt_failure_capture();
	init_streaming();
	init_user_input_requests();
	nextUserInputScopeNumber = 1;
	CodexAppServerSession = class {
		streamAdapter;
		initialized = false;
		closed = false;
		nextRequestNumber = 1;
		accountLoginState = "not-started";
		accountLoginStarted = false;
		activeBillingTurnId;
		activeThreadId;
		activeToolManifestFingerprint;
		activeTurnId;
		/** Thread→turn ids announced via turn/started this turn (root + children). */
		liveTurnThreads = new Map();
		agentTextDeltaChars = 0;
		answerItemTextChars = 0;
		chunksEmitted = 0;
		eventCount = 0;
		eventKindCounts = {};
		eventMethodCounts = {};
		lastEventKind;
		lastTurnErrorCode;
		lastTurnErrorHttpStatus;
		lastTurnErrorMessage;
		lastTurnStatus;
		turnErrorCount = 0;
		pendingAccountLoginRequestId;
		pendingLoginTurn;
		pendingThreadStartRequestId;
		pendingThreadResumeRequestId;
		pendingResumeTurnStartRequestId;
		resumeFallbackTurn;
		threadResumeFallbacks = 0;
		pendingTurnStart;
		serverRequestsResolved = 0;
		serverRequestsFailed = 0;
		userInputRequestsAnswered = 0;
		userInputRequestsCancelled = 0;
		turnCompleted = false;
		dynamicToolCallIds = new Set();
		/**
		* User-input requests are held in a process-wide registry shared with the
		* engine's UI bridge, but JSON-RPC ids are only unique per app-server
		* process — two concurrent sessions can both ask with id 1. Every key that
		* leaves this session (registry, marker chunk, handler event) is therefore
		* prefixed with a per-session scope; only the wire response uses the raw id.
		*/
		userInputScope = `uis${nextUserInputScopeNumber++}`;
		/** Raw request id → scoped registry key, for this session's pending asks. */
		pendingUserInputRequestIds = new Map();
		/** In-flight deferred response sends, awaited before the transport closes. */
		pendingUserInputSends = new Set();
		sentClientRequests = [];
		sentMethods = [];
		accountLoginMode;
		reasoningSummaryEnabled;
		constructor(opts) {
			this.opts = opts;
			this.accountLoginMode = opts.accountLoginMode ?? "required";
			this.reasoningSummaryEnabled = opts.reasoningSummaryEnabled !== false;
			this.streamAdapter = opts.streamAdapter ?? new CodexAppServerStreamAdapter();
		}
		async startTurn(opts) {
			this.requireOpen();
			this.activeBillingTurnId = requireSessionTurnId(opts.turnId);
			if (!this.initialized) {
				await this.sendClientRequest("initialize", {
					capabilities: { experimentalApi: true },
					clientInfo: {
						name: "3d_agent",
						title: "3D-Agent",
						version: "0.1.0"
					}
				}, false);
				await this.sendClientNotification("initialized", {});
				this.initialized = true;
			}
			if (this.accountLoginMode === "disabled") {
				await this.startThreadWork(opts);
				return;
			}
			if (!this.accountLoginStarted) await this.sendAccountLoginStart();
			if (this.accountLoginState === "failed") throw new Error("Codex app-server account login failed");
			if (this.accountLoginState !== "completed") {
				this.queueTurnUntilAccountLogin(opts);
				return;
			}
			await this.startThreadWork(opts);
		}
		async startThreadWork(opts) {
			this.pendingLoginTurn = undefined;
			this.turnCompleted = false;
			this.lastTurnStatus = undefined;
			this.lastTurnErrorCode = undefined;
			this.lastTurnErrorHttpStatus = undefined;
			this.lastTurnErrorMessage = undefined;
			this.turnErrorCount = 0;
			this.answerItemTextChars = 0;
			this.dynamicToolCallIds.clear();
			this.liveTurnThreads.clear();
			this.activeToolManifestFingerprint = opts.toolManifestFingerprint;
			this.pendingThreadResumeRequestId = undefined;
			this.pendingResumeTurnStartRequestId = undefined;
			this.resumeFallbackTurn = undefined;
			if (opts.threadId?.trim()) {
				const threadId = opts.threadId.trim();
				this.pendingThreadStartRequestId = undefined;
				this.pendingTurnStart = undefined;
				this.activeTurnId = undefined;
				const resumeRequest = await this.sendClientRequest("thread/resume", { threadId });
				this.pendingThreadResumeRequestId = resumeRequest.id;
				this.resumeFallbackTurn = opts;
				this.activeThreadId = threadId;
				this.pendingResumeTurnStartRequestId = await this.sendTurnStart(opts, threadId);
			} else await this.startFreshThread(opts);
		}
		/**
		* Start a brand-new codex thread for `opts` — the shared sequence behind
		* both a fresh chat and the resume-failure self-heal (#1456). Codex
		* app-server accepts an empty params object for a new thread; the generated
		* ThreadStartParams schema remains the source of truth for optional versus
		* required fields as the pinned binary evolves.
		*/
		async startFreshThread(opts) {
			this.activeThreadId = undefined;
			this.activeTurnId = undefined;
			const request = await this.sendClientRequest("thread/start", buildThreadStartParams(opts));
			this.pendingThreadStartRequestId = request.id;
			this.pendingTurnStart = opts;
		}
		async processMessage(message, chunkId) {
			this.requireOpen();
			const event = classifyCodexAppServerMessage(message);
			this.recordEvent(event);
			this.lastEventKind = event.kind;
			if (await this.handleResumeOutcome(message)) return {
				chunks: [],
				event,
				serverResponseSent: false
			};
			await this.updateAccountLoginFromMessage(message);
			const threadStartResolved = this.updateActiveThreadFromResponse(message);
			this.updateActiveIds(event);
			this.cancelResolvedUserInputRequest(event);
			await this.startPendingTurnIfReady(threadStartResolved);
			let serverResponseSent = false;
			if (isJsonRpcRequest(message)) {
				serverResponseSent = true;
				await this.resolveServerRequest(message, event);
			}
			this.streamAdapter.setActiveThreadId(this.activeThreadId);
			const streamEvent = event.kind === "user-input-request" ? {
				...event,
				requestId: this.scopedUserInputRequestId(event.requestId)
			} : event;
			const chunks = this.streamAdapter.toChunks(streamEvent, chunkId);
			this.chunksEmitted += chunks.length;
			return {
				chunks,
				event,
				serverResponseSent
			};
		}
		/**
		* True when a lifecycle event belongs to the visible (parent) thread.
		* Spawned children emit turn lifecycles on their own thread ids — a child's
		* `turn/completed` must never read as the visible turn finishing (#1073:
		* the runner ended multi-subagent turns at the FIRST child completion,
		* cutting off the other children and the parent's final answer).
		*/
		isVisibleThreadEvent(threadId) {
			return isVisibleThread(threadId, this.activeThreadId);
		}
		async interrupt() {
			this.requireOpen();
			const turnId = this.activeTurnId;
			if (this.activeThreadId && turnId) await this.sendClientRequest("turn/interrupt", {
				threadId: this.activeThreadId,
				turnId
			}, false);
			await this.cancelPendingUserInputRequests();
			this.closed = true;
			await this.opts.transport.close();
		}
		diagnostics() {
			return {
				accountLoginState: this.accountLoginState,
				accountLoginStarted: this.accountLoginStarted,
				activeBillingTurnId: this.activeBillingTurnId,
				activeThreadId: this.activeThreadId,
				activeTurnId: this.activeTurnId,
				agentTextDeltaChars: this.agentTextDeltaChars,
				answerItemTextChars: this.answerItemTextChars,
				chunksEmitted: this.chunksEmitted,
				closed: this.closed,
				eventCount: this.eventCount,
				eventKindCounts: { ...this.eventKindCounts },
				eventMethodCounts: { ...this.eventMethodCounts },
				initialized: this.initialized,
				lastEventKind: this.lastEventKind,
				lastTurnErrorCode: this.lastTurnErrorCode,
				lastTurnErrorHttpStatus: this.lastTurnErrorHttpStatus,
				lastTurnErrorMessage: this.lastTurnErrorMessage,
				lastTurnStatus: this.lastTurnStatus,
				turnErrorCount: this.turnErrorCount,
				sentClientRequests: this.sentClientRequests.map((request) => ({ ...request })),
				sentMethods: [...this.sentMethods],
				serverRequestsFailed: this.serverRequestsFailed,
				serverRequestsResolved: this.serverRequestsResolved,
				threadResumeFallbacks: this.threadResumeFallbacks,
				turnCompleted: this.turnCompleted,
				userInputRequestsAnswered: this.userInputRequestsAnswered,
				userInputRequestsCancelled: this.userInputRequestsCancelled
			};
		}
		async sendClientRequest(method, params, summarize = true) {
			const request = makeJsonRpcRequest(`client-${this.nextRequestNumber++}`, method, params);
			this.sentMethods.push(method);
			if (summarize) this.sentClientRequests.push(summarizeCodexClientRequest(request));
			await this.opts.transport.send(request);
			return request;
		}
		async sendClientNotification(method, params) {
			const notification = makeJsonRpcNotification(method, params);
			this.sentMethods.push(method);
			await this.opts.transport.send(notification);
			return notification;
		}
		async sendAccountLoginStart() {
			const params = await this.opts.contractAdapter.buildAccountLoginStartParams();
			const request = await this.sendClientRequest("account/login/start", params, false);
			this.pendingAccountLoginRequestId = request.id;
			this.accountLoginState = "pending";
			this.accountLoginStarted = true;
		}
		recordEvent(event) {
			this.eventCount += 1;
			this.eventKindCounts[event.kind] = (this.eventKindCounts[event.kind] ?? 0) + 1;
			const method = "method" in event ? event.method : undefined;
			if (typeof method === "string" && method.length > 0) this.eventMethodCounts[method] = (this.eventMethodCounts[method] ?? 0) + 1;
			if (event.kind === "agent-text-delta") this.agentTextDeltaChars += event.delta.length;
			if (event.kind === "item-status" && event.answerText) this.answerItemTextChars += event.answerText.length;
			if (event.kind === "turn-error") {
				this.turnErrorCount += 1;
				this.lastTurnErrorCode = event.codexErrorInfo ?? this.lastTurnErrorCode;
				this.lastTurnErrorHttpStatus = event.httpStatusCode ?? this.lastTurnErrorHttpStatus;
				this.lastTurnErrorMessage = event.message ?? this.lastTurnErrorMessage;
			}
		}
		queueTurnUntilAccountLogin(opts) {
			this.activeThreadId = undefined;
			this.activeTurnId = undefined;
			this.activeToolManifestFingerprint = undefined;
			this.pendingThreadStartRequestId = undefined;
			this.pendingTurnStart = undefined;
			this.pendingLoginTurn = opts;
		}
		async updateAccountLoginFromMessage(message) {
			if (this.accountLoginState !== "pending") return;
			const resolution = accountLoginResolution(message, this.pendingAccountLoginRequestId);
			if (resolution === "ignore" || resolution === "pending") return;
			this.pendingAccountLoginRequestId = undefined;
			if (resolution === "failed") {
				this.accountLoginState = "failed";
				this.pendingLoginTurn = undefined;
				this.pendingThreadStartRequestId = undefined;
				this.pendingTurnStart = undefined;
				this.activeThreadId = undefined;
				this.activeTurnId = undefined;
				this.activeToolManifestFingerprint = undefined;
				this.turnCompleted = false;
				return;
			}
			this.accountLoginState = "completed";
			const pendingTurn = this.pendingLoginTurn;
			this.pendingLoginTurn = undefined;
			if (pendingTurn) await this.startThreadWork(pendingTurn);
		}
		async sendTurnStart(opts, threadId) {
			this.pendingThreadStartRequestId = undefined;
			this.pendingTurnStart = undefined;
			const params = buildTurnStartParams(opts, threadId, this.reasoningSummaryEnabled);
			const cm = params.collaborationMode;
			if (cm) logger.info("codex turn/start collaboration mode", {
				diagnosticSchema: "codex_turn_lifecycle_v1",
				phase: "codex.turn_lifecycle.collaboration_mode_sent",
				mode: cm.mode,
				developerInstructionsChars: cm.settings?.developer_instructions?.length ?? null
			});
			const request = await this.sendClientRequest("turn/start", params);
			return request.id;
		}
		/**
		* Self-healing thread resume (issue #1456). A chat whose saved codex thread
		* can no longer be resumed (damaged/missing rollout) must not dead-end the
		* user's message: when codex rejects the pipelined thread/resume or its
		* turn/start, swallow the doomed pair's error responses, start a fresh
		* thread for the same turn, and let the coordinator's success writeback
		* re-point the chat map. Only the first failure self-heals — a failure on
		* the fresh thread surfaces normally, so this can never loop.
		*
		* Returns true when the message was consumed (no chunks may be emitted).
		*/
		async handleResumeOutcome(message) {
			if (this.pendingThreadResumeRequestId === undefined && this.pendingResumeTurnStartRequestId === undefined) return false;
			if (!isJsonRpcResponse(message)) return false;
			const isResume = this.pendingThreadResumeRequestId !== undefined && message.id === this.pendingThreadResumeRequestId;
			const isResumeTurnStart = this.pendingResumeTurnStartRequestId !== undefined && message.id === this.pendingResumeTurnStartRequestId;
			if (!isResume && !isResumeTurnStart) return false;
			if (isResume) this.pendingThreadResumeRequestId = undefined;
			if (isResumeTurnStart) this.pendingResumeTurnStartRequestId = undefined;
			const error = "error" in message ? message.error : undefined;
			if (!error) {
				this.pendingResumeTurnStartRequestId = isResume ? undefined : this.pendingResumeTurnStartRequestId;
				this.resumeFallbackTurn = undefined;
				return false;
			}
			const fallbackTurn = this.resumeFallbackTurn;
			if (!fallbackTurn) return true;
			this.resumeFallbackTurn = undefined;
			this.threadResumeFallbacks += 1;
			logger.warn("codex thread resume failed — starting a fresh thread", {
				diagnosticSchema: "codex_turn_lifecycle_v1",
				event: "thread_resume_fallback",
				phase: "codex.turn_lifecycle.thread_resume_fallback",
				rejectedRequest: isResume ? "thread/resume" : "turn/start",
				codexErrorCode: typeof error.code === "number" ? error.code : "(none)",
				codexErrorMessage: String(error.message ?? "").slice(0, 200)
			});
			await this.startFreshThread(fallbackTurn);
			return true;
		}
		async resolveServerRequest(request, event) {
			if (event.kind === "user-input-request" && this.opts.handlers.requestUserInput && event.questions && event.questions.length > 0) {
				const scopedEvent = {
					...event,
					requestId: this.scopedUserInputRequestId(request.id)
				};
				const requestUserInput = this.opts.handlers.requestUserInput;
				this.deferUserInputResponse(request.id, scopedEvent.requestId, Promise.resolve().then(() => requestUserInput(scopedEvent)));
				return;
			}
			let response;
			try {
				response = await this.opts.contractAdapter.resolveServerRequest(request, this.opts.handlers, {
					activeThreadId: this.activeThreadId,
					activeTurnId: this.activeTurnId,
					completedToolCallIds: this.dynamicToolCallIds,
					liveTurnThreads: this.liveTurnThreads,
					toolManifestFingerprint: this.activeToolManifestFingerprint,
					turnCompleted: this.turnCompleted
				});
			} catch {
				this.serverRequestsFailed += 1;
				await this.opts.transport.send(unsupportedServerRequestResponse(request.id));
				return;
			}
			this.serverRequestsResolved += 1;
			await this.opts.transport.send(response);
		}
		scopedUserInputRequestId(requestId) {
			return `${this.userInputScope}:${String(requestId)}`;
		}
		deferUserInputResponse(rawRequestId, scopedRequestId, outcomePromise) {
			const rawId = String(rawRequestId);
			this.pendingUserInputRequestIds.set(rawId, scopedRequestId);
			const send = outcomePromise.then((outcome) => this.sendDeferredUserInputResponse(rawRequestId, outcome)).catch(() => this.sendDeferredUserInputResponse(rawRequestId, { type: "cancelled" })).finally(() => {
				this.pendingUserInputRequestIds.delete(rawId);
				this.pendingUserInputSends.delete(send);
			});
			this.pendingUserInputSends.add(send);
		}
		async sendDeferredUserInputResponse(requestId, outcome) {
			if (this.closed) return;
			const requestIdString = String(requestId);
			const response = outcome.type === "answered" ? jsonRpcResult(requestId, { answers: outcome.answers }) : unsupportedServerRequestResponse(requestId);
			try {
				await this.opts.transport.send(response);
				if (outcome.type === "answered") {
					this.serverRequestsResolved += 1;
					this.userInputRequestsAnswered += 1;
				} else {
					this.serverRequestsFailed += 1;
					this.userInputRequestsCancelled += 1;
				}
			} catch (err) {
				this.serverRequestsFailed += 1;
				await captureCodexPromptFailure(undefined, "codex_user_input_response_send_failed", { extras: {
					errorClass: errorClass(err),
					errorMessage: errorMessage(err).slice(0, 200),
					requestId: requestIdString
				} });
			}
		}
		cancelResolvedUserInputRequest(event) {
			if (event.kind !== "server-request-resolved" || !event.requestId) return;
			const scoped = this.pendingUserInputRequestIds.get(event.requestId);
			if (scoped) cancelUserInputRequest(scoped);
		}
		async cancelPendingUserInputRequests() {
			for (const scoped of [...this.pendingUserInputRequestIds.values()]) cancelUserInputRequest(scoped);
			await Promise.allSettled([...this.pendingUserInputSends]);
		}
		updateActiveIds(event) {
			if (event.kind !== "lifecycle") return;
			const threadId = event.threadId?.trim();
			if (event.method === "turn/started" && threadId && event.turnId?.trim()) {
				const turns = this.liveTurnThreads.get(threadId) ?? new Set();
				turns.add(event.turnId.trim());
				this.liveTurnThreads.set(threadId, turns);
			}
			if (threadId && (event.method === "thread/started" || !this.activeThreadId)) this.activeThreadId = threadId;
			if (threadId && this.activeThreadId && threadId !== this.activeThreadId) return;
			if (event.turnId?.trim()) this.activeTurnId = event.turnId.trim();
			if (event.method === "turn/completed") {
				this.turnCompleted = true;
				this.lastTurnStatus = event.turnStatus;
			}
		}
		updateActiveThreadFromResponse(message) {
			if (!isJsonRpcResponse(message)) return false;
			if (message.id !== this.pendingThreadStartRequestId) return false;
			const threadId = threadIdFromThreadStartResult(message.result);
			if (!threadId) return false;
			this.activeThreadId = threadId;
			return true;
		}
		async startPendingTurnIfReady(threadStartResolved) {
			if (!this.pendingTurnStart || !this.activeThreadId) return;
			if (this.pendingThreadStartRequestId !== undefined && !threadStartResolved) return;
			await this.sendTurnStart(this.pendingTurnStart, this.activeThreadId);
		}
		requireOpen() {
			if (this.closed) throw new Error("Codex app-server session is closed");
		}
	};
} });

//#endregion
//#region src/codex-app-server/stdio-transport.ts
function isAbortedNext(result) {
	return "aborted" in result;
}
function nextWithAbort$1(iterator, ...signals) {
	const activeSignals = signals.filter((signal) => signal !== undefined);
	if (activeSignals.some((signal) => signal.aborted)) return Promise.resolve({ aborted: true });
	return new Promise((resolve$1, reject) => {
		let settled = false;
		const cleanup = () => {
			for (const signal of activeSignals) signal.removeEventListener("abort", onAbort);
		};
		const settle = (value) => {
			if (settled) return;
			settled = true;
			cleanup();
			resolve$1(value);
		};
		const fail = (error) => {
			if (settled) return;
			settled = true;
			cleanup();
			reject(error);
		};
		const onAbort = () => settle({ aborted: true });
		for (const signal of activeSignals) signal.addEventListener("abort", onAbort, { once: true });
		iterator.next().then(settle, fail);
	});
}
function requirePositiveByteLimit(value) {
	if (!Number.isSafeInteger(value) || value < 1) throw new CodexAppServerStdioTransportError("Codex app-server stdio max buffered bytes must be a positive integer");
	return value;
}
var DEFAULT_CODEX_APP_SERVER_STDIO_MAX_BUFFERED_BYTES, CodexAppServerStdioTransportError, CodexAppServerStdioTransport, BoundedJsonRpcLineDecoder;
var init_stdio_transport = __esm({ "src/codex-app-server/stdio-transport.ts"() {
	init_jsonrpc();
	DEFAULT_CODEX_APP_SERVER_STDIO_MAX_BUFFERED_BYTES = 33554432;
	CodexAppServerStdioTransportError = class extends Error {
		name = "CodexAppServerStdioTransportError";
	};
	CodexAppServerStdioTransport = class {
		activeIterator;
		closeController = new AbortController();
		closePromise;
		closed = false;
		maxBufferedBytes;
		constructor(opts) {
			this.opts = opts;
			this.maxBufferedBytes = requirePositiveByteLimit(opts.maxBufferedBytes ?? DEFAULT_CODEX_APP_SERVER_STDIO_MAX_BUFFERED_BYTES);
		}
		[Symbol.asyncIterator]() {
			return this.readMessages();
		}
		async send(message) {
			this.requireOpen();
			await this.opts.stdin.write(encodeJsonRpcLine(message));
		}
		async close() {
			if (this.closePromise) return this.closePromise;
			this.closed = true;
			this.closeController.abort();
			this.closePromise = (async () => {
				await this.activeIterator?.return?.();
				await this.opts.close?.();
			})();
			return this.closePromise;
		}
		async *readMessages(opts = {}) {
			if (this.activeIterator) throw new CodexAppServerStdioTransportError("Codex app-server stdio transport does not support concurrent readers");
			if (opts.signal?.aborted) {
				await this.close();
				return;
			}
			const iterator = this.opts.stdout[Symbol.asyncIterator]();
			this.activeIterator = iterator;
			const decoder = new BoundedJsonRpcLineDecoder(this.maxBufferedBytes);
			let endedNaturally = false;
			try {
				while (!this.closed) {
					const next = await nextWithAbort$1(iterator, this.closeController.signal, opts.signal);
					if (isAbortedNext(next)) break;
					if (next.done) {
						endedNaturally = true;
						break;
					}
					for (const line of decoder.feed(next.value)) {
						const message = parseJsonRpcLine(line);
						if (message) yield message;
					}
				}
				if (endedNaturally && !this.closed) for (const line of decoder.flush()) {
					const message = parseJsonRpcLine(line);
					if (message) yield message;
				}
			} finally {
				await this.close();
				if (this.activeIterator === iterator) this.activeIterator = undefined;
			}
		}
		isClosed() {
			return this.closed;
		}
		requireOpen() {
			if (this.closed) throw new CodexAppServerStdioTransportError("Codex app-server stdio transport is closed");
		}
	};
	BoundedJsonRpcLineDecoder = class {
		buffer = "";
		decoder = new TextDecoder("utf-8", { fatal: false });
		encoder = new TextEncoder();
		constructor(maxBufferedBytes) {
			this.maxBufferedBytes = maxBufferedBytes;
		}
		feed(chunk) {
			this.buffer += typeof chunk === "string" ? chunk : this.decoder.decode(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk), { stream: true });
			const parts = this.buffer.split("\n");
			this.buffer = parts.pop() ?? "";
			this.requireLineWithinLimit(this.buffer);
			for (const line of parts) this.requireLineWithinLimit(line);
			return parts;
		}
		flush() {
			this.buffer += this.decoder.decode();
			this.requireLineWithinLimit(this.buffer);
			if (!this.buffer) return [];
			const out = [this.buffer];
			this.buffer = "";
			return out;
		}
		requireLineWithinLimit(line) {
			if (this.encoder.encode(line).byteLength > this.maxBufferedBytes) throw new CodexAppServerStdioTransportError("Codex app-server stdio line exceeded maximum buffered bytes");
		}
	};
} });

//#endregion
//#region src/codex-app-server/turn-runner.ts
async function* runCodexAppServerTurn(opts) {
	const chunkIdPrefix = opts.chunkIdPrefix ?? "codex-app-server";
	const turnIdHash = stableDiagnosticHash$1(opts.turn.turnId);
	let messageIndex = 0;
	let completed = false;
	let answerTextEmitted = false;
	if (opts.signal?.aborted) {
		logTurnLifecycle("turn_aborted_before_start", { turnIdHash });
		await opts.session.interrupt();
		return;
	}
	logTurnLifecycle("turn_start", {
		turnIdHash,
		hasThreadId: Boolean(opts.turn.threadId),
		promptChars: opts.turn.prompt.length,
		planMode: opts.turn.planMode === true,
		model: opts.turn.model ?? "(config)",
		effort: opts.turn.effort ?? opts.turn.modelReasoningEffort ?? "(config-default)"
	});
	await opts.session.startTurn(opts.turn);
	if (opts.signal?.aborted) {
		logTurnLifecycle("turn_aborted_after_start", { turnIdHash });
		await opts.session.interrupt();
		return;
	}
	const iterator = toAsyncIterable(opts.messages)[Symbol.asyncIterator]();
	while (true) {
		const next = await nextWithAbort(iterator, opts.signal);
		if (next === ABORTED) {
			logTurnLifecycle("message_read_aborted", {
				turnIdHash,
				messageIndex,
				answerTextEmitted
			});
			await opts.session.interrupt();
			void iterator.return?.().catch(() => undefined);
			return;
		}
		if (next.done) break;
		if (opts.signal?.aborted) {
			logTurnLifecycle("turn_aborted_before_process", {
				turnIdHash,
				messageIndex,
				answerTextEmitted
			});
			await opts.session.interrupt();
			void iterator.return?.().catch(() => undefined);
			return;
		}
		const result = await opts.session.processMessage(next.value, `${chunkIdPrefix}-${++messageIndex}`);
		const resultHasAnswerText = chunksHaveAnswerText(result.chunks);
		logTurnLifecycle("message_processed", {
			turnIdHash,
			messageIndex,
			eventKind: result.event.kind,
			eventMethod: "method" in result.event ? result.event.method : "(none)",
			resultHasAnswerText,
			answerTextEmitted,
			chunks: result.chunks.length,
			visibleThreadEvent: "threadId" in result.event ? opts.session.isVisibleThreadEvent(result.event.threadId) : true
		});
		const visibleTurnCompleted = result.event.kind === "lifecycle" && result.event.method === "turn/completed" && opts.session.isVisibleThreadEvent(result.event.threadId);
		if (result.event.kind === "turn-error" && !result.event.willRetry) {
			const interruption = resolveTerminalInterruption(result.event, await takeRecordedTurnInterruption(opts));
			if (interruption) {
				logTurnLifecycle("terminal_turn_error_interruption", {
					turnIdHash,
					messageIndex,
					interruption,
					answerTextEmitted,
					resultHasAnswerText
				}, "warn");
				yield makeChunk(`${chunkIdPrefix}-${++messageIndex}`, appServerFailureText(undefined, interruption), "stop");
				completed = true;
				break;
			}
		}
		if (visibleTurnCompleted) {
			const turnStatus = result.event.kind === "lifecycle" ? result.event.turnStatus : undefined;
			const interruption = await takeRecordedTurnInterruption(opts);
			const recoveredGatewayFailure = interruption === "gateway_stream_failed" && isSuccessfulTurnCompletion(turnStatus) && (answerTextEmitted || resultHasAnswerText);
			if (interruption === "gateway_stream_failed") logTurnLifecycle("gateway_stream_interruption_resolved", {
				answerTextEmitted,
				interruptionOutcome: recoveredGatewayFailure ? "recovered" : "terminal",
				resultHasAnswerText,
				turnIdHash,
				turnStatus: turnStatus ?? "(none)"
			});
			if (interruption && !recoveredGatewayFailure) {
				logTurnLifecycle("visible_turn_completed_with_interruption", {
					turnIdHash,
					messageIndex,
					interruption,
					turnStatus: turnStatus ?? "(none)",
					answerTextEmitted,
					resultHasAnswerText
				}, "warn");
				yield makeChunk(
					`${chunkIdPrefix}-${++messageIndex}`,
					// Single-sourced with the JSON-RPC error-classification path so the
					// interruption message reads identically on both surfaces.
					appServerFailureText(undefined, interruption),
					"stop"
);
				completed = true;
				break;
			}
		}
		if (resultHasAnswerText) answerTextEmitted = true;
		yield* result.chunks;
		if (result.event.kind === "response" && !result.event.ok) {
			logTurnLifecycle("response_event_not_ok", {
				turnIdHash,
				messageIndex,
				answerTextEmitted,
				resultHasAnswerText
			}, "warn");
			completed = true;
			break;
		}
		if (result.event.kind === "turn-error" && !result.event.willRetry) {
			logTurnLifecycle("terminal_turn_error", {
				turnIdHash,
				messageIndex,
				answerTextEmitted,
				resultHasAnswerText
			}, "warn");
			completed = true;
			break;
		}
		if (visibleTurnCompleted) {
			logTurnLifecycle("visible_turn_completed", {
				turnIdHash,
				messageIndex,
				answerTextEmitted,
				resultHasAnswerText
			});
			completed = true;
			break;
		}
		if (opts.signal?.aborted) {
			logTurnLifecycle("turn_aborted_after_process", {
				turnIdHash,
				messageIndex,
				answerTextEmitted
			});
			await opts.session.interrupt();
			void iterator.return?.().catch(() => undefined);
			return;
		}
	}
	if (opts.signal?.aborted) {
		logTurnLifecycle("turn_aborted_after_loop", {
			turnIdHash,
			messageIndex,
			answerTextEmitted
		});
		await opts.session.interrupt();
		return;
	}
	if (!completed) {
		const interruption = await takeRecordedTurnInterruption(opts);
		if (interruption) {
			logTurnLifecycle("stream_ended_with_interruption", {
				turnIdHash,
				messageIndex,
				interruption,
				answerTextEmitted
			}, "warn");
			yield makeChunk(`${chunkIdPrefix}-${++messageIndex}`, appServerFailureText(undefined, interruption), "stop");
			return;
		}
		throw new CodexAppServerTurnRunnerError("Codex app-server message stream ended before turn/completed", opts.session.diagnostics());
	}
}
function resolveTerminalInterruption(event, recorded) {
	if (recorded === "turn_budget_exceeded") return recorded;
	if (event.codexErrorInfo?.toLowerCase() === "responsetoomanyfailedattempts") return null;
	return recorded ?? null;
}
function isSuccessfulTurnCompletion(turnStatus) {
	return turnStatus === undefined || turnStatus === "completed";
}
function chunksHaveAnswerText(chunks) {
	return chunks.some((chunk) => chunk.choices.some((choice) => {
		const content = choice.delta.content;
		return typeof content === "string" && content.trim().length > 0 && !terminalFailureChunkText(content);
	}));
}
function terminalFailureChunkText(content) {
	return /\((?:turn_completed_no_output|turn_budget_exceeded|gateway_stream_failed|rate_limited|quota_exhausted|auth_expired|turn_in_flight|service_unavailable|connection_failed|codex_response_too_many_failed_attempts)\)/i.test(content) || /codex app-server request failed/i.test(content);
}
function logTurnLifecycle(event, fields = {}, level = "info") {
	logger[level]("codex app-server turn lifecycle", {
		diagnosticSchema: "codex_turn_lifecycle_v1",
		event,
		phase: `codex.turn_lifecycle.${event}`,
		...fields
	});
}
function stableDiagnosticHash$1(value) {
	let hash = 2166136261;
	for (let i = 0; i < value.length; i += 1) {
		hash ^= value.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(16).padStart(8, "0");
}
async function takeRecordedTurnInterruption(opts) {
	try {
		return await opts.takeTurnInterruption?.(opts.turn.turnId);
	} catch {
		return null;
	}
}
async function* toAsyncIterable(items) {
	for await (const item of items) yield item;
}
async function nextWithAbort(iterator, signal) {
	if (!signal) return iterator.next();
	if (signal.aborted) return ABORTED;
	let cleanupAbortListener = () => undefined;
	const abort = new Promise((resolve$1) => {
		const onAbort = () => resolve$1(ABORTED);
		cleanupAbortListener = () => signal.removeEventListener("abort", onAbort);
		signal.addEventListener("abort", onAbort, { once: true });
	});
	try {
		return await Promise.race([iterator.next(), abort]);
	} finally {
		cleanupAbortListener();
	}
}
var CodexAppServerTurnRunnerError, ABORTED;
var init_turn_runner = __esm({ "src/codex-app-server/turn-runner.ts"() {
	init_src();
	init_streaming$1();
	init_streaming();
	CodexAppServerTurnRunnerError = class extends Error {
		diagnostics;
		constructor(message, diagnostics) {
			super(message);
			this.name = "CodexAppServerTurnRunnerError";
			this.diagnostics = diagnostics;
		}
	};
	ABORTED = Symbol("codex-app-server-turn-aborted");
} });

//#endregion
//#region src/codex-app-server/supervisor.ts
async function killBestEffort(child) {
	try {
		await child.kill();
	} catch {}
}
function requireChildStdio(child) {
	const stdout = child.stdout;
	if (!child.stdin || typeof child.stdin.write !== "function" || !stdout || typeof stdout[Symbol.asyncIterator] !== "function") throw new CodexAppServerSupervisorError("codex app-server process started without stdio pipes");
}
function normalizeChildPid(pid) {
	if (typeof pid !== "number" || !Number.isSafeInteger(pid) || pid <= 0 || pid > 4294967295) return undefined;
	return pid;
}
function safeScopedTokenListenerStartupCode(error) {
	const code = error.split(":").pop()?.trim() ?? "";
	return /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(code) ? code : "listener_start_failed";
}
/**
* Fire-and-forget Sentry capture for a turn that ended before
* turn/completed (the E-6004 successor class), carrying a compact
* diagnostics summary plus the redacted child stderr tail — the only
* evidence of why codex died. Never throws and never delays the
* user-visible failure chunk.
*/
function captureTurnRunnerFailure(err, stderr, localServerHealthProbe) {
	markPromptFailureCaptured(err);
	const d = err.diagnostics;
	captureCodexFailure("codex_stream_ended_empty", err.message, stderr, localServerHealthProbe, (ctx) => ({
		accountLoginState: d.accountLoginState,
		chunksEmitted: d.chunksEmitted,
		eventCount: d.eventCount,
		eventKindCounts: diagnosticJson(d.eventKindCounts),
		eventMethodCounts: diagnosticJson(d.eventMethodCounts),
		failureStage: "stream_ended",
		initialized: d.initialized,
		lastEventKind: d.lastEventKind ?? "(none)",
		localServerHealth: ctx.localServerHealth,
		sentClientRequests: diagnosticJson(d.sentClientRequests),
		sentMethods: d.sentMethods.slice(0, 8),
		serverRequestsFailed: d.serverRequestsFailed,
		serverRequestsResolved: d.serverRequestsResolved,
		stderrTail: ctx.stderrTail,
		turnCompleted: d.turnCompleted
	}));
}
/**
* Shared fire-and-forget tail of both turn-failure captures: gather the
* redacted child stderr tail (waiting at most STDERR_WAIT_MS — the finally
* block kills the child right after, which closes the stream) and the local
* server /health verdict (#1078) concurrently, then send the scrubber-safe
* detail. Diagnostic only — never throws into the turn path.
*/
function captureCodexFailure(reason, fallbackDetail, stderr, localServerHealthProbe, buildDetail) {
	void (async () => {
		const [stderrTail, localServerHealth] = await Promise.all([Promise.race([stderr, new Promise((resolve$1) => setTimeout(() => resolve$1(""), STDERR_WAIT_MS))]).catch(() => ""), resolveLocalServerHealth(localServerHealthProbe)]);
		let detail;
		let diagnostics;
		try {
			diagnostics = buildDetail({
				localServerHealth,
				stderrTail: scrubberSafeText(stderrTail.slice(-STDERR_TAIL_CHARS))
			});
			detail = JSON.stringify(diagnostics);
		} catch {
			diagnostics = {};
			detail = fallbackDetail;
		}
		const safeDetail = scrubberSafeDetail(detail);
		logger.warn("codex app-server prompt failure diagnostics", {
			detail: safeDetail,
			localServerHealth,
			phase: "codex.prompt_failure",
			reason,
			stderrTailChars: stderrTail.length,
			stderrTailHash: stderrTail ? stableDiagnosticHash(stderrTail) : "(none)"
		});
		await capturePromptFailure(reason, {
			detail: safeDetail,
			extras: promptFailureExtras(diagnostics),
			tags: promptFailureTags(reason, diagnostics)
		});
	})();
}
/**
* Resolves the local-server /health verdict for a failure capture without
* ever letting the probe throw into the capture path.
*/
async function resolveLocalServerHealth(probe) {
	if (!probe) return "(no probe)";
	try {
		return await probe();
	} catch {
		return "probe_failed";
	}
}
function scrubberSafeDetail(detail) {
	return scrubberSafeText(detail);
}
function scrubberSafeText(text) {
	return text.replace(/authorization/gi, (match) => match[0] === "A" ? "Authz" : "authz").replace(/bearer/gi, (match) => match[0] === "B" ? "Brr" : "brr").replace(/token/gi, (match) => match[0] === "T" ? "Tkn" : "tkn");
}
/**
* Fire-and-forget Sentry capture for a turn that ran to a terminal state but
* failed in artist terms: a codex `error` notification killed it, the turn
* completed with status "failed", or it "completed" without visible output.
* Plan answers can arrive as completed items rather than text deltas, so
* visibility is classified from the full turn diagnostics. These previously
* looked like successes to every diagnostic surface while the user saw
* "3D-Agent produced no output." (issue #1063).
*/
function captureCompletedTurnFailure(d, stderr, localServerHealthProbe) {
	const classification = classifyCodexTurnDiagnostics(d);
	if (classification.outcome === "recovered_after_error") return;
	const failed = classification.failed;
	const silent = classification.silent;
	if (!failed && !silent) return;
	const reason = failed ? "codex_turn_failed" : "codex_turn_no_output";
	captureCodexFailure(reason, reason, stderr, localServerHealthProbe, (ctx) => ({
		agentTextDeltaChars: d.agentTextDeltaChars,
		accountLoginState: d.accountLoginState,
		answerItemTextChars: d.answerItemTextChars,
		chunksEmitted: d.chunksEmitted,
		diagnosticSchema: "codex_turn_failure_v2",
		eventCount: d.eventCount,
		eventKindCounts: diagnosticJson(d.eventKindCounts),
		eventMethodCounts: diagnosticJson(d.eventMethodCounts),
		failureStage: d.turnCompleted ? "turn_completed" : "turn_terminal",
		lastEventKind: d.lastEventKind ?? "(none)",
		lastTurnErrorCode: d.lastTurnErrorCode ?? "(none)",
		lastTurnErrorHttpStatus: d.lastTurnErrorHttpStatus ?? "(none)",
		...lastErrorMessageDiagnostics(d.lastTurnErrorMessage),
		lastTurnStatus: d.lastTurnStatus ?? "(none)",
		localServerHealth: ctx.localServerHealth,
		planDeltaCount: classification.planDeltaCount,
		sentClientRequests: diagnosticJson(d.sentClientRequests),
		sentMethods: diagnosticJson(d.sentMethods),
		serverRequestsFailed: d.serverRequestsFailed,
		serverRequestsResolved: d.serverRequestsResolved,
		stderrTail: ctx.stderrTail,
		turnErrorCount: d.turnErrorCount,
		visibleTurnOutput: classification.visibleOutput
	}));
}
function logCodexTurnDiagnostics(d, phase) {
	const classification = classifyCodexTurnDiagnostics(d);
	const payload = {
		accountLoginState: d.accountLoginState,
		agentTextDeltaChars: d.agentTextDeltaChars,
		answerItemTextChars: d.answerItemTextChars,
		chunksEmitted: d.chunksEmitted,
		eventCount: d.eventCount,
		eventKindCounts: d.eventKindCounts,
		eventMethodCounts: d.eventMethodCounts,
		failed: classification.failed,
		initialized: d.initialized,
		lastEventKind: d.lastEventKind ?? "(none)",
		lastTurnErrorCode: d.lastTurnErrorCode ?? "(none)",
		lastTurnErrorHttpStatus: d.lastTurnErrorHttpStatus ?? "(none)",
		...lastErrorMessageDiagnostics(d.lastTurnErrorMessage),
		lastTurnStatus: d.lastTurnStatus ?? "(none)",
		phase: `codex.turn_${phase}`,
		sentClientRequests: diagnosticJson(d.sentClientRequests),
		sentMethods: diagnosticJson(d.sentMethods),
		serverRequestsFailed: d.serverRequestsFailed,
		serverRequestsResolved: d.serverRequestsResolved,
		planDeltaCount: classification.planDeltaCount,
		silent: classification.silent,
		turnDiagnosticOutcome: classification.outcome,
		turnCompleted: d.turnCompleted,
		turnErrorCount: d.turnErrorCount,
		visibleTurnOutput: classification.visibleOutput
	};
	if (classification.failed || classification.silent || phase === "runner_error") logger.warn("codex app-server turn diagnostic summary", payload);
else logger.info("codex app-server turn diagnostic summary", payload);
}
function classifyCodexTurnDiagnostics(d) {
	const planDeltaCount = d.eventMethodCounts["item/plan/delta"] ?? 0;
	const planDeltaOutput = planDeltaCount > 0 && d.chunksEmitted > 1;
	const visibleOutput = d.agentTextDeltaChars > 0 || d.answerItemTextChars > 0 || planDeltaOutput;
	const completedSuccessfully = d.turnCompleted && (d.lastTurnStatus === undefined || d.lastTurnStatus === "completed");
	const recoveredAfterError = completedSuccessfully && visibleOutput && d.turnErrorCount > 0;
	const failed = d.lastTurnStatus === "failed" || !recoveredAfterError && d.turnErrorCount > 0;
	const silent = completedSuccessfully && !visibleOutput;
	let outcome = "ok";
	if (failed) outcome = "failed";
else if (silent) outcome = "silent";
else if (recoveredAfterError) outcome = "recovered_after_error";
	return {
		failed,
		outcome,
		planDeltaCount,
		silent,
		visibleOutput
	};
}
function promptFailureTags(reason, diagnostics) {
	return {
		account_login_state: diagnosticTag(diagnostics.accountLoginState),
		codex_error_code: diagnosticTag(diagnostics.lastTurnErrorCode),
		diagnostic_schema: diagnosticTag(diagnostics.diagnosticSchema ?? "codex_turn_failure_v2"),
		failure_stage: diagnosticTag(diagnostics.failureStage),
		last_event_kind: diagnosticTag(diagnostics.lastEventKind),
		last_turn_status: diagnosticTag(diagnostics.lastTurnStatus),
		local_server_health: diagnosticTag(diagnostics.localServerHealth),
		prompt_failure: reason,
		visible_turn_output: diagnosticTag(diagnostics.visibleTurnOutput)
	};
}
function promptFailureExtras(diagnostics) {
	const out = {};
	for (const [key, value] of Object.entries(diagnostics)) {
		const normalizedKey = key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
		out[normalizedKey] = diagnosticExtraValue(value);
	}
	return out;
}
function diagnosticTag(value) {
	if (value === undefined || value === null || value === "") return "none";
	return scrubberSafeText(String(value)).trim().replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 120) || "none";
}
function diagnosticExtraValue(value) {
	if (value === undefined) return null;
	if (value === null || typeof value === "boolean" || typeof value === "number") return value;
	if (typeof value === "string") return scrubberSafeText(value);
	return diagnosticJson(value);
}
function diagnosticJson(value) {
	try {
		return scrubberSafeText(JSON.stringify(value));
	} catch {
		return "(unserializable)";
	}
}
function lastErrorMessageDiagnostics(message) {
	if (!message) return {
		lastErrorMessageChars: 0,
		lastErrorMessageHash: "(none)",
		lastErrorMessageTail: "(none)"
	};
	const redacted = redactDiagnostics({ message }).message ?? "";
	return {
		lastErrorMessageChars: message.length,
		lastErrorMessageHash: stableDiagnosticHash(message),
		lastErrorMessageTail: scrubberSafeText(redacted.slice(-LAST_ERROR_TAIL_CHARS))
	};
}
function stableDiagnosticHash(value) {
	let hash = 2166136261;
	for (let i = 0; i < value.length; i += 1) {
		hash ^= value.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(16).padStart(8, "0");
}
function buildCodexProcessEnv(baseEnv, codexHome, turnId) {
	return {
		...buildCodexProbeEnv(baseEnv, codexHome),
		[CODEX_APP_SERVER_TURN_ID_ENV]: turnId,
		HOME: codexHome,
		USERPROFILE: codexHome
	};
}
function aiTraceEnabled(env) {
	return [
		"1",
		"true",
		"TRUE",
		"yes",
		"YES"
	].includes(env[AI_TRACE_ENV] ?? "");
}
function logCodexTurnTrace(turn, runtime) {
	logger.info("codex app-server AI trace", {
		approvalPolicy: turn.approvalPolicy ?? "(missing)",
		developerInstructionsChars: turn.developerInstructions?.length ?? 0,
		dynamicToolNames: summarizeDynamicToolNames(turn.dynamicTools),
		dynamicTools: turn.dynamicTools?.length ?? 0,
		experimentalRawEvents: turn.experimentalRawEvents === true,
		hasSandboxPolicy: turn.sandboxPolicy !== undefined && turn.sandboxPolicy !== null,
		hasThreadId: Boolean(turn.threadId),
		model: turn.model ?? "(config)",
		modelReasoningEffort: turn.effort ?? turn.modelReasoningEffort ?? "(config-default)",
		planMode: turn.planMode === true,
		modelProvider: turn.modelProvider ?? "(default)",
		phase: "codex.thread_turn",
		promptChars: turn.prompt.length,
		providerConfigured: runtime.providerConfigured,
		runtimeVersion: runtime.runtimeVersion,
		scopedTokenCommandConfigured: runtime.scopedTokenCommandConfigured,
		toolManifestFingerprint: turn.toolManifestFingerprint ?? "(missing)"
	});
}
function logCodexTurnResultTrace(diagnostics, status) {
	logger.info("codex app-server AI trace", {
		accountLoginState: diagnostics.accountLoginState,
		agentTextDeltaChars: diagnostics.agentTextDeltaChars,
		chunksEmitted: diagnostics.chunksEmitted,
		eventCount: diagnostics.eventCount,
		eventKindCounts: diagnostics.eventKindCounts,
		eventMethodCounts: diagnostics.eventMethodCounts,
		lastEventKind: diagnostics.lastEventKind ?? "(none)",
		phase: "codex.turn_result",
		sentMethods: diagnostics.sentMethods,
		serverRequestsFailed: diagnostics.serverRequestsFailed,
		serverRequestsResolved: diagnostics.serverRequestsResolved,
		status,
		turnCompleted: diagnostics.turnCompleted
	});
}
function summarizeDynamicToolNames(tools) {
	return (tools ?? []).map((tool) => {
		const name = tool.name;
		return typeof name === "string" ? name : undefined;
	}).filter((name) => Boolean(name)).slice(0, 20);
}
function hasWriteTextFile(fs$1) {
	return typeof fs$1.writeTextFile === "function";
}
async function collectRedactedStderr(stderr) {
	if (!stderr) return "";
	const decoder = new TextDecoder("utf-8", { fatal: false });
	let text = "";
	try {
		for await (const chunk of stderr) {
			text += typeof chunk === "string" ? chunk : decoder.decode(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk), { stream: true });
			if (text.length > 4096) text = text.slice(-4096);
		}
		text += decoder.decode();
	} catch {
		return "";
	}
	return redactDiagnostics({ stderr: text }).stderr ?? "";
}
var AI_TRACE_ENV, STDERR_TAIL_CHARS, STDERR_WAIT_MS, LAST_ERROR_TAIL_CHARS, CodexAppServerSupervisorError, CodexAppServerProcessSupervisor;
var init_supervisor = __esm({ "src/codex-app-server/supervisor.ts"() {
	init_src();
	init_handled_sentry();
	init_turn_trace();
	init_adapter();
	init_home();
	init_runtime();
	init_session();
	init_stdio_transport();
	init_turn_runner();
	AI_TRACE_ENV = "THREEDAGENT_AI_TRACE";
	STDERR_TAIL_CHARS = 600;
	STDERR_WAIT_MS = 1500;
	LAST_ERROR_TAIL_CHARS = 400;
	CodexAppServerSupervisorError = class extends Error {
		diagnostics;
		constructor(message, diagnostics = {}) {
			super(message);
			this.name = "CodexAppServerSupervisorError";
			this.diagnostics = redactDiagnostics(diagnostics);
		}
	};
	CodexAppServerProcessSupervisor = class {
		resolvedCodexThreadId;
		constructor(opts) {
			this.opts = opts;
		}
		getResolvedCodexThreadId() {
			return this.resolvedCodexThreadId;
		}
		async *runTurn(opts) {
			const turnTrace = await startTurnTrace(opts.turn.turnId);
			try {
				yield* this.runTurnInner(opts, turnTrace);
			} finally {
				await turnTrace?.finish("error");
			}
		}
		async *runTurnInner(opts, turnTrace) {
			this.resolvedCodexThreadId = undefined;
			const runtime = await ensureCodexAppServerRuntime({
				allowPathFallback: this.opts.allowPathFallback,
				bundledCodexBin: this.opts.bundledCodexBin,
				envCodexBin: this.opts.envCodexBin,
				exec: this.opts.exec,
				expectedVersion: this.opts.expectedVersion,
				timeoutMs: this.opts.versionTimeoutMs
			});
			logger.info("codex app-server runtime resolved", {
				binarySource: runtime.source,
				phase: "codex.runtime_resolved",
				version: runtime.version
			});
			setSentryCodexVersion(runtime.version);
			const home = await this.ensureCodexHome({
				fs: this.opts.fs,
				providerConfig: this.opts.providerConfig,
				probeId: this.opts.probeId,
				scopedTokenCommand: this.opts.scopedTokenCommand,
				subagentCap: opts.turn.subagentCap,
				modelReasoningEffort: opts.turn.modelReasoningEffort,
				version: runtime.version
			});
			logger.info("codex app-server home ready", {
				hasProviderConfig: Boolean(this.opts.providerConfig),
				phase: "codex.home_ready",
				probeId: this.opts.probeId,
				scopedTokenCommandConfigured: Boolean(this.opts.scopedTokenCommand)
			});
			const traceEnabled = aiTraceEnabled(this.opts.baseEnv ?? {});
			if (traceEnabled) logCodexTurnTrace(opts.turn, {
				providerConfigured: Boolean(this.opts.providerConfig),
				runtimeVersion: runtime.version,
				scopedTokenCommandConfigured: Boolean(this.opts.scopedTokenCommand)
			});
			const env = buildCodexProcessEnv(this.opts.baseEnv ?? {}, home.codexHome, opts.turn.turnId);
			logger.info("codex app-server spawning", {
				hasTurnEnv: Boolean(env[CODEX_APP_SERVER_TURN_ID_ENV]),
				phase: "codex.spawn_start",
				programSource: runtime.source
			});
			turnTrace?.record("sidecar.turn_started");
			const child = await this.spawn(runtime.codexBin, env);
			logger.info("codex app-server spawned", {
				hasPid: typeof child.pid === "number",
				phase: "codex.spawned",
				pid: child.pid ?? "(none)"
			});
			const stderr = collectRedactedStderr(child.stderr).catch(() => "");
			let scopedTokenListener;
			let transport;
			try {
				requireChildStdio(child);
				scopedTokenListener = await this.startScopedTokenListener(child, home.codexHome);
				logger.info("codex app-server scoped-token listener ready", {
					phase: "codex.scoped_token_listener_ready",
					scopedTokenCommandConfigured: Boolean(this.opts.scopedTokenCommand),
					scopedTokenListenerStarted: Boolean(scopedTokenListener)
				});
				transport = new CodexAppServerStdioTransport({
					close: () => killBestEffort(child),
					stdin: child.stdin,
					stdout: child.stdout
				});
				const accountLoginMode = this.opts.providerConfig && this.opts.scopedTokenCommand ? "disabled" : "required";
				logger.info("codex app-server session starting", {
					accountLoginMode,
					phase: "codex.session_start",
					providerConfigured: Boolean(this.opts.providerConfig),
					scopedTokenCommandConfigured: Boolean(this.opts.scopedTokenCommand)
				});
				const session = new CodexAppServerSession({
					accountLoginMode,
					contractAdapter: new CodexAppServerContractAdapter(this.opts.tokens, this.opts.responsesTransport),
					handlers: this.opts.handlers,
					reasoningSummaryEnabled: this.opts.providerConfig?.reasoningSummaryEnabled !== false,
					transport
				});
				let diagnostics;
				const takeTurnInterruption = this.opts.takeTurnInterruption;
				try {
					let sawFirstDelta = false;
					for await (const chunk of runCodexAppServerTurn({
						chunkIdPrefix: opts.chunkIdPrefix,
						messages: transport,
						session,
						signal: opts.signal,
						...takeTurnInterruption ? { takeTurnInterruption } : {},
						turn: opts.turn
					})) {
						if (!sawFirstDelta) {
							sawFirstDelta = true;
							turnTrace?.record("first_delta_received");
						}
						yield chunk;
					}
					diagnostics = session.diagnostics();
				} catch (err) {
					diagnostics = err instanceof CodexAppServerTurnRunnerError ? err.diagnostics : session.diagnostics();
					logCodexTurnDiagnostics(diagnostics, "runner_error");
					if (traceEnabled) logCodexTurnResultTrace(diagnostics, "error");
					if (err instanceof CodexAppServerTurnRunnerError) captureTurnRunnerFailure(err, stderr, this.opts.localServerHealthProbe);
					await turnTrace?.finish("error");
					throw err;
				}
				if (traceEnabled) logCodexTurnResultTrace(diagnostics, "completed");
				if (diagnostics.activeThreadId) this.resolvedCodexThreadId = diagnostics.activeThreadId;
				logCodexTurnDiagnostics(diagnostics, "completed");
				captureCompletedTurnFailure(diagnostics, stderr, this.opts.localServerHealthProbe);
				await turnTrace?.finish("ok");
			} finally {
				if (scopedTokenListener) try {
					await scopedTokenListener.close();
				} catch {}
				if (transport) await transport.close().catch(() => undefined);
else await killBestEffort(child);
			}
		}
		async spawn(program, env) {
			try {
				return await this.opts.spawner.spawn(program, [
					"app-server",
					"--listen",
					"stdio://"
				], { env });
			} catch (err) {
				const failure = new CodexAppServerSupervisorError("codex app-server process failed to start", {
					error: err instanceof Error ? err.message : String(err),
					program
				});
				void capturePromptFailure("codex_spawn_failed", { detail: promptFailureDetail(failure) });
				markPromptFailureCaptured(failure);
				throw failure;
			}
		}
		async ensureCodexHome(opts) {
			if (opts.scopedTokenCommand && !opts.providerConfig) throw new CodexAppServerSupervisorError("codex app-server scoped-token command requires provider config");
			if (opts.providerConfig) {
				if (!hasWriteTextFile(opts.fs)) throw new CodexAppServerSupervisorError("codex app-server provider config requires writeTextFile support");
				return ensureConfiguredCodexHome({
					fs: opts.fs,
					probeId: opts.probeId,
					providerConfig: opts.scopedTokenCommand ? {
						...opts.providerConfig,
						auth: opts.scopedTokenCommand
					} : opts.providerConfig,
					...opts.subagentCap !== undefined ? { subagentCap: opts.subagentCap } : {},
					...opts.modelReasoningEffort !== undefined ? { modelReasoningEffort: opts.modelReasoningEffort } : {},
					version: opts.version
				});
			}
			return ensureIsolatedCodexHome({
				fs: opts.fs,
				probeId: opts.probeId,
				version: opts.version
			});
		}
		async startScopedTokenListener(child, codexHome) {
			if (!this.opts.scopedTokenListenerStarter) return undefined;
			if (!this.opts.scopedTokenCommand) throw new CodexAppServerSupervisorError("codex scoped-token listener requires a scoped-token command");
			const codexPid = normalizeChildPid(child.pid);
			if (codexPid === undefined) throw new CodexAppServerSupervisorError("codex scoped-token listener requires a valid supervised Codex process id", {
				hasPid: child.pid === undefined ? "false" : "true",
				pidType: typeof child.pid
			});
			try {
				return await this.opts.scopedTokenListenerStarter({
					codexHome,
					codexPid,
					scopedTokenCommand: this.opts.scopedTokenCommand
				});
			} catch (err) {
				const error = err instanceof Error ? err.message : String(err);
				const safeError = redactDiagnostics({ error }).error ?? "";
				throw new CodexAppServerSupervisorError(`codex scoped-token listener failed to start: ${safeScopedTokenListenerStartupCode(safeError)}`, { error });
			}
		}
	};
} });

//#endregion
//#region src/codex-app-server/factory.ts
function createCodexAppServerSupervisorFactory(opts) {
	const probeId = opts.probeId ?? CODEX_APP_SERVER_RUNTIME_PROBE_ID;
	const providerConfig = {
		baseUrl: opts.providerBaseUrl ?? CODEX_APP_SERVER_LOCAL_RESPONSES_BASE_URL,
		providerId: opts.providerId,
		reasoningSummaryEnabled: codexReasoningSummaryEnabled(opts.baseEnv ?? {}),
		supportsWebsockets: codexResponsesWebsocketsEnabled(opts.baseEnv ?? {})
	};
	const diagnostics = {
		approvalMode: opts.handlers ? "custom" : "skip",
		probeId,
		provider: summarizeCodexProviderConfigForDiagnostics(opts.scopedTokenCommand ? {
			...providerConfig,
			auth: opts.scopedTokenCommand
		} : providerConfig)
	};
	const createSupervisor = () => new CodexAppServerProcessSupervisor({
		...opts.adapters,
		baseEnv: opts.baseEnv,
		bundledCodexBin: opts.bundledCodexBin,
		envCodexBin: opts.envCodexBin,
		expectedVersion: opts.expectedVersion,
		handlers: opts.handlers ?? defaultCodexAppServerHandlers(opts.blenderProxyUrl),
		localServerHealthProbe: opts.localServerHealthProbe,
		probeId,
		providerConfig,
		responsesTransport: opts.responsesTransport,
		scopedTokenCommand: opts.scopedTokenCommand,
		scopedTokenListenerStarter: opts.scopedTokenListenerStarter,
		...opts.takeTurnInterruption ? { takeTurnInterruption: opts.takeTurnInterruption } : {},
		tokens: opts.tokens,
		versionTimeoutMs: opts.versionTimeoutMs
	});
	return {
		diagnostics,
		createHandoffRunner: () => new CodexAppServerSupervisorHandoffRunner(createSupervisor(), probeId),
		createSupervisor
	};
}
function codexResponsesWebsocketsEnabled(env) {
	return !isExplicitEnvOptOut(env[CODEX_APP_SERVER_RESPONSES_WEBSOCKETS_ENV]);
}
function codexReasoningSummaryEnabled(env) {
	return !isExplicitEnvOptOut(env[CODEX_APP_SERVER_REASONING_SUMMARY_ENV]);
}
function isExplicitEnvOptOut(value) {
	const normalized = value?.trim().toLowerCase();
	return normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off";
}
function createTauriCodexAppServerSupervisorFactory(commandModule, opts) {
	const { fsDeps, allowPathFallback,...factoryOpts } = opts;
	return createCodexAppServerSupervisorFactory({
		...factoryOpts,
		adapters: createTauriCodexAppServerAdapters(commandModule, fsDeps, { allowPathFallback })
	});
}
/** Default handlers route Blender tool calls to the (possibly fallback-port) proxy. */
function defaultCodexAppServerHandlers(blenderProxyUrl) {
	return {
		approve: () => "skipped",
		callDynamicTool: createCodexBlenderDynamicToolHandler(createCodexBlenderBridgeTransport(blenderProxyUrl)),
		requestUserInput: (event) => registerPendingUserInputRequest(String(event.requestId))
	};
}
function toSupervisorTurn(turn) {
	const out = {
		prompt: turn.prompt,
		turnId: turn.turnId
	};
	if (turn.approvalPolicy !== undefined) out.approvalPolicy = turn.approvalPolicy;
	if (turn.approvalsReviewer !== undefined) out.approvalsReviewer = turn.approvalsReviewer;
	if (turn.cwd !== undefined) out.cwd = turn.cwd;
	if (turn.developerInstructions !== undefined) out.developerInstructions = turn.developerInstructions;
	if (turn.dynamicTools !== undefined) out.dynamicTools = turn.dynamicTools;
	if (turn.effort !== undefined) out.effort = turn.effort;
	if (turn.experimentalRawEvents !== undefined) out.experimentalRawEvents = turn.experimentalRawEvents;
	if (turn.images !== undefined) out.images = turn.images;
	if (turn.model !== undefined) out.model = turn.model;
	if (turn.modelProvider !== undefined) out.modelProvider = turn.modelProvider;
	if (turn.subagentCap !== undefined) out.subagentCap = turn.subagentCap;
	if (turn.modelReasoningEffort !== undefined) out.modelReasoningEffort = turn.modelReasoningEffort;
	if (turn.planMode !== undefined) out.planMode = turn.planMode;
	if (turn.sandbox !== undefined) out.sandbox = turn.sandbox;
	if (turn.sandboxPolicy !== undefined) out.sandboxPolicy = turn.sandboxPolicy;
	if (turn.threadId !== undefined) out.threadId = turn.threadId;
	if (turn.toolManifestFingerprint !== undefined) out.toolManifestFingerprint = turn.toolManifestFingerprint;
	return out;
}
function safeChunkIdPart(value) {
	const safe = value.trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
	return safe || "unknown";
}
var CODEX_APP_SERVER_LOCAL_RESPONSES_BASE_URL, CODEX_APP_SERVER_RUNTIME_PROBE_ID, CODEX_APP_SERVER_RESPONSES_WEBSOCKETS_ENV, CODEX_APP_SERVER_REASONING_SUMMARY_ENV, CodexAppServerSupervisorHandoffRunner;
var init_factory = __esm({ "src/codex-app-server/factory.ts"() {
	init_anthropic_config();
	init_blender_dynamic_tools();
	init_home();
	init_supervisor();
	init_tauri_runtime();
	init_user_input_requests();
	CODEX_APP_SERVER_LOCAL_RESPONSES_BASE_URL = `${ANTHROPIC_BASE_URL}/v1`;
	CODEX_APP_SERVER_RUNTIME_PROBE_ID = "jan-runtime";
	CODEX_APP_SERVER_RESPONSES_WEBSOCKETS_ENV = "THREEDAGENT_CODEX_RESPONSES_WEBSOCKETS";
	CODEX_APP_SERVER_REASONING_SUMMARY_ENV = "THREEDAGENT_CODEX_REASONING_SUMMARY";
	CodexAppServerSupervisorHandoffRunner = class {
		constructor(supervisor, probeId) {
			this.supervisor = supervisor;
			this.probeId = probeId;
		}
		getResolvedCodexThreadId() {
			return this.supervisor.getResolvedCodexThreadId();
		}
		run(turn, signal) {
			return this.supervisor.runTurn({
				chunkIdPrefix: `codex-app-server-${safeChunkIdPart(this.probeId)}-${safeChunkIdPart(turn.chatId)}`,
				signal,
				turn: toSupervisorTurn(turn)
			});
		}
	};
} });

//#endregion
//#region src/codex-app-server/platform.ts
function detectCodexHostPlatform() {
	if (typeof navigator !== "undefined") {
		const ua = navigator.userAgent || "";
		if (/Win/.test(ua)) return "windows";
		if (/Mac/.test(ua)) return "macos";
	}
	if (typeof process !== "undefined") {
		if (process.platform === "win32") return "windows";
		if (process.platform === "darwin") return "macos";
	}
	return "linux";
}
var init_platform = __esm({ "src/codex-app-server/platform.ts"() {} });

//#endregion
//#region src/workspace.ts
const WORKSPACE_ROOT = "sdk-workspaces";
async function ensureWorkspace(chatId, fs$1) {
	if (!chatId || /[\\/]/.test(chatId)) throw new Error(`Invalid chatId: ${JSON.stringify(chatId)}`);
	const dataDir$1 = await fs$1.getDataDir();
	const workspaceDir = await fs$1.joinPath([
		dataDir$1,
		WORKSPACE_ROOT,
		chatId
	]);
	try {
		await fs$1.mkdir(workspaceDir);
	} catch (err) {
		if (!isAlreadyExistsError(err)) throw err;
	}
	return workspaceDir;
}
function isAlreadyExistsError(err) {
	const msg = err instanceof Error ? err.message : String(err);
	return /already exists|EEXIST/i.test(msg);
}
function createTauriFS() {
	return {
		getDataDir: () => getJanDataFolderPath(),
		joinPath: (parts) => joinPath(parts),
		mkdir: (path) => fs.mkdir(path),
		rmDir: (path) => fs.rm(path)
	};
}

//#endregion
//#region src/index.ts
init_factory();
init_platform();
init_prompt_failure_capture();
init_user_input_requests();
const CODEX_AGENT_PROVIDER_ID = "3dagent-codex-agent";
const LEGACY_CLAUDE_AGENT_PROVIDER_ID = "3dagent-claude-sdk";
const CODEX_AGENT_MODEL_ID = "3d-agent";
const STUB_MODEL = {
	id: CODEX_AGENT_MODEL_ID,
	name: "3D-Agent",
	providerId: CODEX_AGENT_PROVIDER_ID,
	port: 0,
	sizeBytes: 0
};
const STUB_SESSION = {
	pid: 0,
	port: 0,
	model_id: CODEX_AGENT_MODEL_ID,
	model_path: "",
	is_embedding: false,
	api_key: ""
};
let cachedCodexRuntimeDependencies = null;
async function loadCodexRuntimeDependencies() {
	if (!cachedCodexRuntimeDependencies) cachedCodexRuntimeDependencies = await Promise.resolve().then(function() {
		return init_tauri_runtime_dependencies(), tauri_runtime_dependencies_exports;
	});
	return cachedCodexRuntimeDependencies;
}
var CodexAgentEngine = class extends AIEngine {
	provider = CODEX_AGENT_PROVIDER_ID;
	codexAppServer;
	codexAppServerBuilder;
	platform = "linux";
	constructor(url, name, productName, active, description, version, options) {
		super(url ?? "", name ?? "", productName, active, description, version);
		this.codexAppServer = options?.codexAppServer;
		this.codexAppServerBuilder = options?.codexAppServerBuilder;
	}
	async onLoad() {
		super.onLoad();
		EngineManager.instance().registerAlias(LEGACY_CLAUDE_AGENT_PROVIDER_ID, CODEX_AGENT_PROVIDER_ID);
		this.platform = detectCodexHostPlatform();
	}
	onUnload() {}
	async get(_modelId) {
		return STUB_MODEL;
	}
	async list() {
		return [STUB_MODEL];
	}
	async load() {
		return STUB_SESSION;
	}
	async unload() {
		return { success: true };
	}
	async chat(opts, abortController) {
		const runtimeFlagValue = await resolveCodexAppServerRuntimeFlagValue(readEnv$1(CODEX_APP_SERVER_RUNTIME_FLAG));
		const defaultCodexAppServerBuilder = this.codexAppServer || this.codexAppServerBuilder ? undefined : await this.buildDefaultCodexAppServerBuilder(runtimeFlagValue);
		const route = await selectCodexAgentEngineChatRoute({
			abortController,
			codexAppServer: this.codexAppServer,
			codexAppServerBuilder: this.codexAppServerBuilder ?? defaultCodexAppServerBuilder,
			request: opts,
			runtimeFlagValue
		});
		return route.stream;
	}
	resolveUserInputRequest(requestId, answers) {
		const resolved = resolveUserInputRequest(requestId, answers);
		if (!resolved) this.captureUserInputOrphan("codex_user_input_orphan_answer", requestId);
		return resolved;
	}
	cancelUserInputRequest(requestId) {
		const cancelled = cancelUserInputRequest(requestId);
		if (!cancelled) this.captureUserInputOrphan("codex_user_input_orphan_cancel", requestId);
		return cancelled;
	}
	captureUserInputOrphan(failure, requestId) {
		void captureCodexPromptFailure(undefined, failure, {
			extras: { requestId },
			level: "warning"
		});
	}
	async buildDefaultCodexAppServerBuilder(runtimeFlagValue) {
		const runtimeDependencies = await loadCodexRuntimeDependencies();
		const workspaceFS = createTauriFS();
		const responsesWebsocketsFlagValue = await resolveCodexResponsesWebsocketsFlagValue(readEnv$1(CODEX_APP_SERVER_RESPONSES_WEBSOCKETS_ENV));
		const reasoningSummaryFlagValue = await resolveCodexReasoningSummaryFlagValue(readEnv$1(CODEX_APP_SERVER_REASONING_SUMMARY_ENV));
		return runtimeDependencies.buildTauriCodexAppServerRuntimeDependencies({
			env: readEnv$1,
			reasoningSummaryFlagValue,
			responsesWebsocketsFlagValue,
			runtimeFlagValue,
			workspaceResolver: { resolve: (chatId) => ensureWorkspace(chatId, workspaceFS) }
		});
	}
	async delete() {}
	async update() {}
	async import(_modelId, _opts) {
		throw new Error("Import not supported by 3D-Agent provider");
	}
	async abortImport() {}
	async getLoadedModels() {
		return [CODEX_AGENT_MODEL_ID];
	}
	async isToolSupported() {
		return true;
	}
};
function readEnv$1(key) {
	if (typeof process === "undefined" || !process.env) return undefined;
	const v = process.env[key];
	return v && v.length > 0 ? v : undefined;
}

//#endregion
//#region src/codex-app-server/tauri-runtime-dependencies.ts
var tauri_runtime_dependencies_exports = {};
__export(tauri_runtime_dependencies_exports, {
	CODEX_APP_SERVER_BIN_OVERRIDE_FLAG: () => CODEX_APP_SERVER_BIN_OVERRIDE_FLAG,
	CODEX_APP_SERVER_LOCAL_SERVER_PORT_COMMAND: () => CODEX_APP_SERVER_LOCAL_SERVER_PORT_COMMAND,
	CODEX_APP_SERVER_SCOPED_TOKEN_COMMAND_FLAG: () => CODEX_APP_SERVER_SCOPED_TOKEN_COMMAND_FLAG,
	CODEX_APP_SERVER_SCOPED_TOKEN_COMMAND_TIMEOUT_MS_FLAG: () => CODEX_APP_SERVER_SCOPED_TOKEN_COMMAND_TIMEOUT_MS_FLAG,
	CODEX_APP_SERVER_SCOPED_TOKEN_ENDPOINT_DIR_PREFIX: () => CODEX_APP_SERVER_SCOPED_TOKEN_ENDPOINT_DIR_PREFIX,
	CODEX_APP_SERVER_SCOPED_TOKEN_HELPER_FILENAME: () => CODEX_APP_SERVER_SCOPED_TOKEN_HELPER_FILENAME,
	CODEX_APP_SERVER_SCOPED_TOKEN_HELPER_WINDOWS_FILENAME: () => CODEX_APP_SERVER_SCOPED_TOKEN_HELPER_WINDOWS_FILENAME,
	CODEX_APP_SERVER_SCOPED_TOKEN_SHORT_RUNTIME_ROOT: () => CODEX_APP_SERVER_SCOPED_TOKEN_SHORT_RUNTIME_ROOT,
	CODEX_APP_SERVER_SCOPED_TOKEN_UNIX_SOCKET_FILENAME: () => CODEX_APP_SERVER_SCOPED_TOKEN_UNIX_SOCKET_FILENAME,
	CODEX_APP_SERVER_SCOPED_TOKEN_WINDOWS_PIPE_PREFIX: () => CODEX_APP_SERVER_SCOPED_TOKEN_WINDOWS_PIPE_PREFIX,
	CODEX_APP_SERVER_START_SCOPED_TOKEN_LISTENER_COMMAND: () => CODEX_APP_SERVER_START_SCOPED_TOKEN_LISTENER_COMMAND,
	CODEX_APP_SERVER_STOP_SCOPED_TOKEN_LISTENER_COMMAND: () => CODEX_APP_SERVER_STOP_SCOPED_TOKEN_LISTENER_COMMAND,
	CODEX_APP_SERVER_TAKE_TURN_INTERRUPTION_COMMAND: () => CODEX_APP_SERVER_TAKE_TURN_INTERRUPTION_COMMAND,
	buildTauriCodexAppServerRuntimeDependencies: () => buildTauriCodexAppServerRuntimeDependencies,
	resolveCodexBinarySelection: () => resolveCodexBinarySelection
});
async function buildTauriCodexAppServerRuntimeDependencies(opts = {}) {
	const platform = opts.platform ?? detectCodexHostPlatform();
	let scopedTokenCommand;
	let scopedTokenListenerStarter;
	if (shouldUseCommandBackedScopedTokenAuth(opts, platform)) {
		const resolvedScopedTokenCommand = await resolveScopedTokenCommand({
			...opts,
			platform
		});
		if (!resolvedScopedTokenCommand.ok) return builderWithSetupFailure(opts, resolvedScopedTokenCommand.reason);
		scopedTokenCommand = resolvedScopedTokenCommand.value;
		scopedTokenListenerStarter = await resolveScopedTokenListenerStarter(opts);
		if (!scopedTokenListenerStarter) return builderWithSetupFailure(opts, "scoped_token_listener_unavailable");
	}
	const commandModule = opts.commandModule ?? await loadCommandModule(opts);
	if (!commandModule) return builderWithSetupFailure(opts, "tauri_shell_unavailable");
	const localServer = await resolveLocalServerOrigin(opts);
	if (!localServer.ok) return builderWithSetupFailure(opts, "local_server_unavailable");
	const createFactory = opts.createSupervisorFactory ?? createTauriCodexAppServerSupervisorFactory;
	const takeTurnInterruption = await resolveTurnInterruptionConsumer(opts);
	const codexSelection = resolveCodexBinarySelection((key) => readEnv(opts.env, key));
	const factory = createFactory(commandModule, {
		allowPathFallback: codexSelection.allowPathFallback,
		baseEnv: {
			...collectCodexProcessBaseEnv(opts.env),
			...opts.reasoningSummaryFlagValue !== undefined ? { [CODEX_APP_SERVER_REASONING_SUMMARY_ENV]: opts.reasoningSummaryFlagValue } : {},
			...opts.responsesWebsocketsFlagValue !== undefined ? { [CODEX_APP_SERVER_RESPONSES_WEBSOCKETS_ENV]: opts.responsesWebsocketsFlagValue } : {}
		},
		blenderProxyUrl: `${localServer.origin}/v1/blender`,
		bundledCodexBin: codexSelection.bundledCodexBin,
		envCodexBin: codexSelection.envCodexBin,
		fsDeps: opts.fsDeps,
		localServerHealthProbe: createLocalServerHealthProbe(localServer.origin),
		providerBaseUrl: `${localServer.origin}/v1`,
		responsesTransport: opts.responsesTransport ?? disabledResponsesTransport(),
		...scopedTokenCommand ? { scopedTokenCommand } : {},
		...scopedTokenListenerStarter ? { scopedTokenListenerStarter } : {},
		...takeTurnInterruption ? { takeTurnInterruption } : {},
		tokens: opts.tokens ?? createTauriCodexScopedTokenProvider({
			envOverride: readEnv(opts.env, "CODEX_AGENT_TOKEN") ?? readEnv(opts.env, "CLAUDE_AGENT_TOKEN"),
			fetchToken: opts.fetchToken
		})
	});
	return {
		...chatBuilderPassthrough(opts),
		createTurnId: opts.createTurnId ?? (() => createCodexAppServerTurnId()),
		runner: factory.createHandoffRunner()
	};
}
function shouldUseCommandBackedScopedTokenAuth(opts, platform) {
	if (opts.scopedTokenCommand) return true;
	if (readEnv(opts.env, CODEX_APP_SERVER_SCOPED_TOKEN_COMMAND_FLAG)?.trim()) return true;
	return platform !== "windows";
}
/**
* Returns a chat builder that fails before spawning Codex when setup is unsafe.
*/
function builderWithSetupFailure(opts, reason) {
	return {
		...chatBuilderPassthrough(opts),
		createTurnId: opts.createTurnId ?? (() => createCodexAppServerTurnId()),
		runner: new CodexAppServerRuntimeSetupFailureRunner(reason)
	};
}
/**
* Carries through the shared chat builder dependencies that are independent of
* the selected desktop agent runtime.
*/
function chatBuilderPassthrough(opts) {
	return {
		accountScope: opts.accountScope,
		getSessionToken: opts.getSessionToken,
		nowMs: opts.nowMs,
		store: opts.store,
		tauriFSDeps: opts.tauriFSDeps,
		threadMapFS: opts.threadMapFS,
		workspaceResolver: opts.workspaceResolver
	};
}
/**
* Resolves and validates the command Codex will call for scoped-token refresh.
*/
async function resolveScopedTokenCommand(opts) {
	let command;
	if (opts.scopedTokenCommand) {
		const { args,...commandMetadata } = opts.scopedTokenCommand;
		command = normalizeScopedTokenCommand(commandMetadata);
		if (!command.ok) return command;
		return ensureScopedTokenCommandHasEndpointArg(opts, {
			...command.value,
			...args !== undefined ? { args } : {}
		});
	}
	const commandOverride = readEnv(opts.env, CODEX_APP_SERVER_SCOPED_TOKEN_COMMAND_FLAG);
	if (!commandOverride?.trim()) command = await resolveBundledScopedTokenCommand(opts);
else {
		const timeoutMs = parseOptionalTimeoutMs(readEnv(opts.env, CODEX_APP_SERVER_SCOPED_TOKEN_COMMAND_TIMEOUT_MS_FLAG));
		if (timeoutMs === "invalid") return {
			ok: false,
			reason: "scoped_token_command_invalid"
		};
		const auth = { command: commandOverride };
		if (timeoutMs !== undefined) auth.timeoutMs = timeoutMs;
		command = normalizeScopedTokenCommand(auth);
	}
	if (!command.ok) return command;
	return ensureScopedTokenCommandHasEndpointArg(opts, command.value);
}
/**
* Ensures the auth command has exactly one safe endpoint argument.
*/
async function ensureScopedTokenCommandHasEndpointArg(opts, auth) {
	const platform = opts.platform ?? detectCodexHostPlatform();
	const existingArgs = auth.args ?? [];
	if (existingArgs.length > 0) {
		if (existingArgs.length !== 1) return {
			ok: false,
			reason: "scoped_token_endpoint_invalid"
		};
		const [existingEndpointArg] = existingArgs;
		if (existingEndpointArg === undefined) return {
			ok: false,
			reason: "scoped_token_endpoint_invalid"
		};
		const endpoint$1 = platform === "windows" ? normalizeWindowsNamedPipeEndpointArg(existingEndpointArg) : normalizeUnixScopedTokenEndpointArg(existingEndpointArg);
		if (!endpoint$1.ok) return endpoint$1;
		return normalizeScopedTokenCommand({
			...auth,
			args: [endpoint$1.value]
		});
	}
	const endpoint = platform === "windows" ? resolveWindowsNamedPipeEndpointArg() : await resolveScopedTokenEndpointArg(opts);
	if (!endpoint.ok) return endpoint;
	return normalizeScopedTokenCommand({
		...auth,
		args: [endpoint.value]
	});
}
/**
* Finds the bundled helper inside the Tauri resources without accepting a
* missing or malformed command path.
*/
async function resolveBundledScopedTokenCommand(opts) {
	const resolver = opts.helperPathResolver ?? defaultScopedTokenHelperPathResolver();
	const resourceDir$1 = (await resolver.resourceDir())?.trim();
	if (!resourceDir$1) return {
		ok: false,
		reason: "scoped_token_command_missing"
	};
	let sawInvalidCandidate = false;
	for (const command of await bundledHelperCandidates(resourceDir$1, resolver.joinPath)) {
		const normalized = normalizeScopedTokenCommand({ command });
		if (!normalized.ok) {
			sawInvalidCandidate = true;
			continue;
		}
		if (await resolver.exists(normalized.value.command)) return normalized;
	}
	return {
		ok: false,
		reason: sawInvalidCandidate ? "scoped_token_command_invalid" : "scoped_token_command_missing"
	};
}
/**
* Lists helper command candidates in the order expected by packaged Tauri apps.
*/
async function bundledHelperCandidates(resourceDir$1, joinPath$1) {
	const candidates = [];
	const macContentsDir = macContentsDirFromResourceDir(resourceDir$1);
	if (macContentsDir) candidates.push(await joinPath$1([
		macContentsDir,
		"MacOS",
		CODEX_APP_SERVER_SCOPED_TOKEN_HELPER_FILENAME
	]));
	candidates.push(await joinPath$1([resourceDir$1, CODEX_APP_SERVER_SCOPED_TOKEN_HELPER_FILENAME]));
	candidates.push(await joinPath$1([resourceDir$1, CODEX_APP_SERVER_SCOPED_TOKEN_HELPER_WINDOWS_FILENAME]));
	return [...new Set(candidates)];
}
/**
* Resolves the Unix socket path passed to the scoped-token helper.
*/
async function resolveScopedTokenEndpointArg(opts) {
	const resolver = opts.helperEndpointResolver ?? defaultScopedTokenEndpointResolver();
	const endpointDirName = createScopedTokenEndpointDirName();
	const runtimeDir$1 = (await resolver.runtimeDir())?.trim();
	if (runtimeDir$1) {
		const endpoint = normalizeUnixScopedTokenEndpointShape(await resolver.joinPath([
			runtimeDir$1,
			endpointDirName,
			CODEX_APP_SERVER_SCOPED_TOKEN_UNIX_SOCKET_FILENAME
		]));
		if (!endpoint.ok) return endpoint;
		if (isUnixSocketPathWithinPlatformLimit(endpoint.value)) return endpoint;
	}
	return normalizeUnixScopedTokenEndpointArg(await resolver.joinPath([
		CODEX_APP_SERVER_SCOPED_TOKEN_SHORT_RUNTIME_ROOT,
		endpointDirName,
		CODEX_APP_SERVER_SCOPED_TOKEN_UNIX_SOCKET_FILENAME
	]));
}
/**
* Uses a per-run endpoint directory so stale sockets from a crashed dev app or
* parallel Codex attempts cannot block the next scoped-token listener startup.
*/
function createScopedTokenEndpointDirName() {
	return `${CODEX_APP_SERVER_SCOPED_TOKEN_ENDPOINT_DIR_PREFIX}${createScopedTokenSessionNonce()}`;
}
/**
* Builds a socket/pipe-safe per-run nonce (`[A-Za-z0-9_-]`, ≤24 chars) so a
* stale endpoint from a crashed dev app or a parallel Codex attempt cannot
* block the next scoped-token listener startup.
*/
function createScopedTokenSessionNonce() {
	const randomUuid = globalThis.crypto?.randomUUID?.().replace(/-/g, "").slice(0, 16);
	const nonce = randomUuid ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
	const safeNonce = nonce.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24);
	return safeNonce || "runtime";
}
/**
* Builds the Windows named-pipe endpoint the helper and Rust listener share.
*
* Named pipes are kernel objects rather than filesystem paths, so there is no
* runtime directory to resolve — the per-session nonce alone yields a fresh
* pipe each run.
*/
function resolveWindowsNamedPipeEndpointArg() {
	return normalizeWindowsNamedPipeEndpointArg(`${CODEX_APP_SERVER_SCOPED_TOKEN_WINDOWS_PIPE_PREFIX}${createScopedTokenSessionNonce()}`);
}
/**
* Constrains the Codex helper endpoint to one canonical Windows named-pipe name
* (fixed prefix + `[A-Za-z0-9_-]` nonce), mirroring the Rust
* `windows_named_pipe_from_name` contract so the broker accepts what we mint.
*/
function normalizeWindowsNamedPipeEndpointArg(endpoint) {
	if (!endpoint || endpoint !== endpoint.trim() || hasControl(endpoint) || !endpoint.startsWith(CODEX_APP_SERVER_SCOPED_TOKEN_WINDOWS_PIPE_PREFIX)) return {
		ok: false,
		reason: "scoped_token_endpoint_invalid"
	};
	const nonce = endpoint.slice(CODEX_APP_SERVER_SCOPED_TOKEN_WINDOWS_PIPE_PREFIX.length);
	if (nonce.length === 0 || nonce.length > CODEX_APP_SERVER_MAX_WINDOWS_SESSION_NONCE_LEN || !/^[A-Za-z0-9_-]+$/.test(nonce)) return {
		ok: false,
		reason: "scoped_token_endpoint_invalid"
	};
	return {
		ok: true,
		value: endpoint
	};
}
/**
* Keeps the Codex helper endpoint constrained to one absolute Unix socket path.
*/
function normalizeUnixScopedTokenEndpointArg(endpoint) {
	const normalized = normalizeUnixScopedTokenEndpointShape(endpoint);
	if (!normalized.ok) return normalized;
	return isUnixSocketPathWithinPlatformLimit(normalized.value) ? normalized : {
		ok: false,
		reason: "scoped_token_endpoint_invalid"
	};
}
function normalizeUnixScopedTokenEndpointShape(endpoint) {
	const normalized = endpoint.replace(/\\/g, "/");
	const segments = normalized.split("/");
	if (!endpoint || endpoint !== endpoint.trim() || endpoint.length > 4096 || hasControl(endpoint) || normalized.includes("://") || normalized.startsWith("//") || !normalized.startsWith("/") || segments.some((segment) => segment === "." || segment === "..") || segments.at(-1) !== CODEX_APP_SERVER_SCOPED_TOKEN_UNIX_SOCKET_FILENAME) return {
		ok: false,
		reason: "scoped_token_endpoint_invalid"
	};
	return {
		ok: true,
		value: endpoint
	};
}
function isUnixSocketPathWithinPlatformLimit(endpoint) {
	return new TextEncoder().encode(endpoint).length <= CODEX_APP_SERVER_MAX_UNIX_SOCKET_PATH_BYTES;
}
/**
* Detects characters that cannot safely appear in command or endpoint values.
*/
function hasControl(value) {
	return [...value].some((char) => {
		const code = char.charCodeAt(0);
		return code <= 31 || code === 127;
	});
}
/**
* Converts a macOS resource directory into the sibling Contents directory.
*/
function macContentsDirFromResourceDir(resourceDir$1) {
	const normalized = resourceDir$1.replace(/\\/g, "/").replace(/\/+$/g, "");
	const suffix = "/Contents/Resources";
	if (!normalized.endsWith(suffix)) return undefined;
	return normalized.slice(0, -"/Resources".length);
}
/**
* Reads helper command paths from the Tauri bundle resource directory.
*/
function defaultScopedTokenHelperPathResolver() {
	return {
		async exists(path) {
			try {
				return Boolean(await fs.existsSync(path));
			} catch {
				return false;
			}
		},
		joinPath,
		async resourceDir() {
			try {
				const mod = await Promise.resolve().then(function() {
					return init_path(), path_exports;
				});
				return await mod.resourceDir();
			} catch {
				return undefined;
			}
		}
	};
}
/**
* Resolves endpoint paths through Tauri first, then Jan app data for dev hosts
* where Tauri cannot provide a runtime directory.
*/
function defaultScopedTokenEndpointResolver() {
	return {
		dataDir: getJanDataFolderPath,
		joinPath,
		async runtimeDir() {
			try {
				const mod = await Promise.resolve().then(function() {
					return init_path(), path_exports;
				});
				return await mod.runtimeDir();
			} catch {
				return undefined;
			}
		}
	};
}
/**
* Parses an optional helper command timeout from env or explicit options.
*/
function parseOptionalTimeoutMs(value) {
	if (value === undefined) return undefined;
	const parsed = typeof value === "number" ? value : Number(value.trim());
	if (typeof value === "string" && !value.trim()) return undefined;
	if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 3e4) return "invalid";
	return parsed;
}
/**
* Normalizes the provider auth command while mapping unsafe inputs to setup
* failure reasons.
*/
function normalizeScopedTokenCommand(auth) {
	try {
		return {
			ok: true,
			value: normalizeCodexScopedTokenCommandSpec(auth)
		};
	} catch (error) {
		if (error instanceof CodexScopedTokenCommandError) return {
			ok: false,
			reason: auth.command.trim() ? "scoped_token_command_invalid" : "scoped_token_command_missing"
		};
		throw error;
	}
}
/**
* Loads the Tauri shell Command module when running inside the desktop app.
*/
async function loadTauriShellCommandModule() {
	try {
		const mod = await Promise.resolve().then(function() {
			return init_dist_js(), dist_js_exports;
		});
		return mod.Command;
	} catch {
		return undefined;
	}
}
/**
* Allows tests to inject the command module while production loads Tauri.
*/
function loadCommandModule(opts) {
	return opts.loadCommandModule ? opts.loadCommandModule() : loadTauriShellCommandModule();
}
/**
* Resolves the listener starter, defaulting to the app-owned Tauri IPC command.
*/
async function resolveScopedTokenListenerStarter(opts) {
	if (opts.scopedTokenListenerStarter) return opts.scopedTokenListenerStarter;
	const invoke$2 = opts.invoke ?? await loadTauriInvoke(opts);
	return invoke$2 ? createTauriScopedTokenListenerStarter(invoke$2) : undefined;
}
/**
* Asks the Rust core which port the local proxy actually bound (issue #1078:
* 1337 is only the default — Razer Chroma SDK and Windows excluded port
* ranges force an ephemeral fallback). Three outcomes:
* - a valid port → build every local URL from it;
* - explicit `null` → the Rust side failed both binds, so refuse to spawn
*   Codex against a dead port (setup failure, not a misleading turn error);
* - command missing/throwing or no Tauri IPC → legacy fixed 1337, preserving
*   behavior on cores that predate `local_server_port` and in unit tests.
*/
async function resolveLocalServerOrigin(opts) {
	const invoke$2 = opts.invoke ?? await loadTauriInvoke(opts);
	if (!invoke$2) return {
		ok: true,
		origin: ANTHROPIC_BASE_URL
	};
	let port;
	try {
		port = await invoke$2(CODEX_APP_SERVER_LOCAL_SERVER_PORT_COMMAND);
	} catch {
		return {
			ok: true,
			origin: ANTHROPIC_BASE_URL
		};
	}
	if (port === null) return { ok: false };
	if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535) {
		void capturePromptFailure("local_server_port_invalid", { detail: typeof port });
		return {
			ok: true,
			origin: ANTHROPIC_BASE_URL
		};
	}
	return {
		ok: true,
		origin: localAgentProxyBaseUrl(port)
	};
}
async function resolveTurnInterruptionConsumer(opts) {
	const invoke$2 = opts.invoke ?? await loadTauriInvoke(opts);
	return invoke$2 ? createTauriTurnInterruptionConsumer(invoke$2) : undefined;
}
/**
* Loads Tauri invoke only in contexts where the desktop IPC bridge is present.
*/
async function loadTauriInvoke(opts) {
	if (opts.loadInvoke) return opts.loadInvoke();
	try {
		const mod = await Promise.resolve().then(function() {
			return init_core$1(), core_exports;
		});
		return mod.invoke;
	} catch {
		return undefined;
	}
}
/**
* Starts and stops the Rust scoped-token listener through Tauri IPC.
*/
function createTauriScopedTokenListenerStarter(invoke$2) {
	return async ({ codexHome, codexPid, scopedTokenCommand }) => {
		const endpoint = scopedTokenCommand.args?.[0];
		if (!endpoint || scopedTokenCommand.args?.length !== 1) throw new Error("codex scoped-token listener requires one endpoint argument");
		const result = await invoke$2(CODEX_APP_SERVER_START_SCOPED_TOKEN_LISTENER_COMMAND, {
			codexHome,
			codexPid,
			scopedTokenCommand: {
				args: scopedTokenCommand.args,
				command: scopedTokenCommand.command,
				refreshIntervalMs: scopedTokenCommand.refreshIntervalMs,
				timeoutMs: scopedTokenCommand.timeoutMs
			}
		});
		if (!result?.ok || !isSafeListenerId(result.listenerId)) throw new Error(`codex scoped-token listener failed to start: ${safeListenerErrorCode(result?.error)}`);
		let closed = false;
		return { async close() {
			if (closed) return;
			closed = true;
			await invoke$2(CODEX_APP_SERVER_STOP_SCOPED_TOKEN_LISTENER_COMMAND, { listenerId: result.listenerId }).catch(() => undefined);
		} };
	};
}
function createTauriTurnInterruptionConsumer(invoke$2) {
	return async (turnId) => {
		try {
			const reason = await invoke$2(CODEX_APP_SERVER_TAKE_TURN_INTERRUPTION_COMMAND, { turnId });
			return reason === "turn_budget_exceeded" || reason === "gateway_stream_failed" ? reason : null;
		} catch {
			return null;
		}
	};
}
/**
* Validates listener ids before sending them back through stop IPC.
*/
function isSafeListenerId(value) {
	return Boolean(value && /^[A-Za-z0-9._:-]{1,128}$/.test(value));
}
/**
* Redacts listener startup errors to bounded diagnostic codes.
*/
function safeListenerErrorCode(value) {
	if (!value) return "listener_start_failed";
	return /^[A-Za-z0-9._:-]{1,128}$/.test(value) ? value : "listener_start_failed";
}
/**
* Passes only benign process environment variables to the Codex child process.
*/
function collectCodexProcessBaseEnv(env) {
	const out = {};
	for (const key of [
		"PATH",
		"PATHEXT",
		"SYSTEMROOT",
		"COMSPEC",
		"TEMP",
		"TMP",
		"TMPDIR",
		"USERPROFILE",
		"HOME",
		"LANG",
		"THREEDAGENT_AI_TRACE",
		CODEX_APP_SERVER_REASONING_SUMMARY_ENV,
		CODEX_APP_SERVER_RESPONSES_WEBSOCKETS_ENV
	]) {
		const value = readEnv(env, key);
		if (value !== undefined) out[key] = value;
	}
	return out;
}
/**
* Reads non-empty environment values from an injectable environment source.
*/
function readEnv(env, key) {
	const value = env?.(key);
	return value && value.length > 0 ? value : undefined;
}
function resolveCodexBinarySelection(env) {
	const override = env(CODEX_APP_SERVER_BIN_OVERRIDE_FLAG);
	if (override) return {
		bundledCodexBin: undefined,
		envCodexBin: override,
		allowPathFallback: false
	};
	return {
		bundledCodexBin: "resources/bin/codex",
		envCodexBin: undefined,
		allowPathFallback: false
	};
}
/**
* Fails closed until production wires a real Responses transport.
*/
function disabledResponsesTransport() {
	return { postResponses(_request) {
		return Promise.reject(new Error("Codex Responses transport is not configured"));
	} };
}
var CODEX_APP_SERVER_SCOPED_TOKEN_COMMAND_FLAG, CODEX_APP_SERVER_SCOPED_TOKEN_COMMAND_TIMEOUT_MS_FLAG, CODEX_APP_SERVER_SCOPED_TOKEN_HELPER_FILENAME, CODEX_APP_SERVER_SCOPED_TOKEN_HELPER_WINDOWS_FILENAME, CODEX_APP_SERVER_SCOPED_TOKEN_UNIX_SOCKET_FILENAME, CODEX_APP_SERVER_SCOPED_TOKEN_ENDPOINT_DIR_PREFIX, CODEX_APP_SERVER_SCOPED_TOKEN_SHORT_RUNTIME_ROOT, CODEX_APP_SERVER_SCOPED_TOKEN_WINDOWS_PIPE_PREFIX, CODEX_APP_SERVER_MAX_WINDOWS_SESSION_NONCE_LEN, CODEX_APP_SERVER_START_SCOPED_TOKEN_LISTENER_COMMAND, CODEX_APP_SERVER_STOP_SCOPED_TOKEN_LISTENER_COMMAND, CODEX_APP_SERVER_TAKE_TURN_INTERRUPTION_COMMAND, CODEX_APP_SERVER_LOCAL_SERVER_PORT_COMMAND, CODEX_APP_SERVER_MAX_UNIX_SOCKET_PATH_BYTES, CodexAppServerRuntimeSetupFailureRunner, CODEX_APP_SERVER_BIN_OVERRIDE_FLAG;
var init_tauri_runtime_dependencies = __esm({ "src/codex-app-server/tauri-runtime-dependencies.ts"() {
	init_anthropic_config();
	init_handled_sentry();
	init_streaming$1();
	init_factory();
	init_local_server_health();
	init_platform();
	init_scoped_token_provider();
	init_token_command();
	init_turn_id();
	CODEX_APP_SERVER_SCOPED_TOKEN_COMMAND_FLAG = "THREEDAGENT_CODEX_SCOPED_TOKEN_COMMAND";
	CODEX_APP_SERVER_SCOPED_TOKEN_COMMAND_TIMEOUT_MS_FLAG = "THREEDAGENT_CODEX_SCOPED_TOKEN_COMMAND_TIMEOUT_MS";
	CODEX_APP_SERVER_SCOPED_TOKEN_HELPER_FILENAME = "codex-scoped-token";
	CODEX_APP_SERVER_SCOPED_TOKEN_HELPER_WINDOWS_FILENAME = "codex-scoped-token.exe";
	CODEX_APP_SERVER_SCOPED_TOKEN_UNIX_SOCKET_FILENAME = "codex-scoped-token.sock";
	CODEX_APP_SERVER_SCOPED_TOKEN_ENDPOINT_DIR_PREFIX = "3da-codex-";
	CODEX_APP_SERVER_SCOPED_TOKEN_SHORT_RUNTIME_ROOT = "/tmp";
	CODEX_APP_SERVER_SCOPED_TOKEN_WINDOWS_PIPE_PREFIX = "\\\\.\\pipe\\3d-agent-codex-scoped-token-";
	CODEX_APP_SERVER_MAX_WINDOWS_SESSION_NONCE_LEN = 96;
	CODEX_APP_SERVER_START_SCOPED_TOKEN_LISTENER_COMMAND = "start_codex_scoped_token_listener";
	CODEX_APP_SERVER_STOP_SCOPED_TOKEN_LISTENER_COMMAND = "stop_codex_scoped_token_listener";
	CODEX_APP_SERVER_TAKE_TURN_INTERRUPTION_COMMAND = "take_recorded_agent_turn_interruption";
	CODEX_APP_SERVER_LOCAL_SERVER_PORT_COMMAND = "local_server_port";
	CODEX_APP_SERVER_MAX_UNIX_SOCKET_PATH_BYTES = 100;
	CodexAppServerRuntimeSetupFailureRunner = class {
		constructor(reason) {
			this.reason = reason;
		}
		/**
		* Reports only the setup failure code, never the prompt or token material.
		*/
		async *run(turn) {
			void capturePromptFailure("codex_setup_failed", { detail: this.reason });
			yield makeChunk(`codex-app-server-runtime-setup-${turn.turnId}`, `Codex app-server runtime setup failed: ${this.reason}`, "stop");
		}
	};
	CODEX_APP_SERVER_BIN_OVERRIDE_FLAG = "CODEX_APP_SERVER_BIN";
} });

//#endregion
//#region ../../../node_modules/.pnpm/@tauri-apps+api@2.8.0/node_modules/@tauri-apps/api/core.js
var core_exports = {};
__export(core_exports, {
	Channel: () => Channel$1,
	PluginListener: () => PluginListener,
	Resource: () => Resource,
	SERIALIZE_TO_IPC_FN: () => SERIALIZE_TO_IPC_FN$1,
	addPluginListener: () => addPluginListener,
	checkPermissions: () => checkPermissions,
	convertFileSrc: () => convertFileSrc,
	invoke: () => invoke$1,
	isTauri: () => isTauri,
	requestPermissions: () => requestPermissions,
	transformCallback: () => transformCallback$1
});
/**
* Stores the callback in a known location, and returns an identifier that can be passed to the backend.
* The backend uses the identifier to `eval()` the callback.
*
* @return An unique identifier associated with the callback function.
*
* @since 1.0.0
*/
function transformCallback$1(callback, once = false) {
	return window.__TAURI_INTERNALS__.transformCallback(callback, once);
}
/**
* Adds a listener to a plugin event.
*
* @returns The listener object to stop listening to the events.
*
* @since 2.0.0
*/
async function addPluginListener(plugin, event, cb) {
	const handler = new Channel$1(cb);
	return invoke$1(`plugin:${plugin}|registerListener`, {
		event,
		handler
	}).then(() => new PluginListener(plugin, event, handler.id));
}
/**
* Get permission state for a plugin.
*
* This should be used by plugin authors to wrap their actual implementation.
*/
async function checkPermissions(plugin) {
	return invoke$1(`plugin:${plugin}|check_permissions`);
}
/**
* Request permissions.
*
* This should be used by plugin authors to wrap their actual implementation.
*/
async function requestPermissions(plugin) {
	return invoke$1(`plugin:${plugin}|request_permissions`);
}
/**
* Sends a message to the backend.
* @example
* ```typescript
* import { invoke } from '@tauri-apps/api/core';
* await invoke('login', { user: 'tauri', password: 'poiwe3h4r5ip3yrhtew9ty' });
* ```
*
* @param cmd The command name.
* @param args The optional arguments to pass to the command.
* @param options The request options.
* @return A promise resolving or rejecting to the backend response.
*
* @since 1.0.0
*/
async function invoke$1(cmd, args = {}, options) {
	return window.__TAURI_INTERNALS__.invoke(cmd, args, options);
}
/**
* Convert a device file path to an URL that can be loaded by the webview.
* Note that `asset:` and `http://asset.localhost` must be added to [`app.security.csp`](https://v2.tauri.app/reference/config/#csp-1) in `tauri.conf.json`.
* Example CSP value: `"csp": "default-src 'self' ipc: http://ipc.localhost; img-src 'self' asset: http://asset.localhost"` to use the asset protocol on image sources.
*
* Additionally, `"enable" : "true"` must be added to [`app.security.assetProtocol`](https://v2.tauri.app/reference/config/#assetprotocolconfig)
* in `tauri.conf.json` and its access scope must be defined on the `scope` array on the same `assetProtocol` object.
*
* @param  filePath The file path.
* @param  protocol The protocol to use. Defaults to `asset`. You only need to set this when using a custom protocol.
* @example
* ```typescript
* import { appDataDir, join } from '@tauri-apps/api/path';
* import { convertFileSrc } from '@tauri-apps/api/core';
* const appDataDirPath = await appDataDir();
* const filePath = await join(appDataDirPath, 'assets/video.mp4');
* const assetUrl = convertFileSrc(filePath);
*
* const video = document.getElementById('my-video');
* const source = document.createElement('source');
* source.type = 'video/mp4';
* source.src = assetUrl;
* video.appendChild(source);
* video.load();
* ```
*
* @return the URL that can be used as source on the webview.
*
* @since 1.0.0
*/
function convertFileSrc(filePath, protocol = "asset") {
	return window.__TAURI_INTERNALS__.convertFileSrc(filePath, protocol);
}
function isTauri() {
	return !!(globalThis || window).isTauri;
}
var _Channel_onmessage$1, _Channel_nextMessageIndex$1, _Channel_pendingMessages$1, _Channel_messageEndIndex$1, _Resource_rid$1, SERIALIZE_TO_IPC_FN$1, Channel$1, PluginListener, Resource;
var init_core$1 = __esm({ "../../../node_modules/.pnpm/@tauri-apps+api@2.8.0/node_modules/@tauri-apps/api/core.js"() {
	init_tslib_es6$1();
	SERIALIZE_TO_IPC_FN$1 = "__TAURI_TO_IPC_KEY__";
	Channel$1 = class {
		constructor(onmessage) {
			_Channel_onmessage$1.set(this, void 0);
			_Channel_nextMessageIndex$1.set(this, 0);
			_Channel_pendingMessages$1.set(this, []);
			_Channel_messageEndIndex$1.set(this, void 0);
			__classPrivateFieldSet$1(this, _Channel_onmessage$1, onmessage || (() => {}), "f");
			this.id = transformCallback$1((rawMessage) => {
				const index = rawMessage.index;
				if ("end" in rawMessage) {
					if (index == __classPrivateFieldGet$1(this, _Channel_nextMessageIndex$1, "f")) this.cleanupCallback();
else __classPrivateFieldSet$1(this, _Channel_messageEndIndex$1, index, "f");
					return;
				}
				const message = rawMessage.message;
				if (index == __classPrivateFieldGet$1(this, _Channel_nextMessageIndex$1, "f")) {
					__classPrivateFieldGet$1(this, _Channel_onmessage$1, "f").call(this, message);
					__classPrivateFieldSet$1(this, _Channel_nextMessageIndex$1, __classPrivateFieldGet$1(this, _Channel_nextMessageIndex$1, "f") + 1, "f");
					while (__classPrivateFieldGet$1(this, _Channel_nextMessageIndex$1, "f") in __classPrivateFieldGet$1(this, _Channel_pendingMessages$1, "f")) {
						const message$1 = __classPrivateFieldGet$1(this, _Channel_pendingMessages$1, "f")[__classPrivateFieldGet$1(this, _Channel_nextMessageIndex$1, "f")];
						__classPrivateFieldGet$1(this, _Channel_onmessage$1, "f").call(this, message$1);
						delete __classPrivateFieldGet$1(this, _Channel_pendingMessages$1, "f")[__classPrivateFieldGet$1(this, _Channel_nextMessageIndex$1, "f")];
						__classPrivateFieldSet$1(this, _Channel_nextMessageIndex$1, __classPrivateFieldGet$1(this, _Channel_nextMessageIndex$1, "f") + 1, "f");
					}
					if (__classPrivateFieldGet$1(this, _Channel_nextMessageIndex$1, "f") === __classPrivateFieldGet$1(this, _Channel_messageEndIndex$1, "f")) this.cleanupCallback();
				} else __classPrivateFieldGet$1(this, _Channel_pendingMessages$1, "f")[index] = message;
			});
		}
		cleanupCallback() {
			window.__TAURI_INTERNALS__.unregisterCallback(this.id);
		}
		set onmessage(handler) {
			__classPrivateFieldSet$1(this, _Channel_onmessage$1, handler, "f");
		}
		get onmessage() {
			return __classPrivateFieldGet$1(this, _Channel_onmessage$1, "f");
		}
		[(_Channel_onmessage$1 = new WeakMap(), _Channel_nextMessageIndex$1 = new WeakMap(), _Channel_pendingMessages$1 = new WeakMap(), _Channel_messageEndIndex$1 = new WeakMap(), SERIALIZE_TO_IPC_FN$1)]() {
			return `__CHANNEL__:${this.id}`;
		}
		toJSON() {
			return this[SERIALIZE_TO_IPC_FN$1]();
		}
	};
	PluginListener = class {
		constructor(plugin, event, channelId) {
			this.plugin = plugin;
			this.event = event;
			this.channelId = channelId;
		}
		async unregister() {
			return invoke$1(`plugin:${this.plugin}|remove_listener`, {
				event: this.event,
				channelId: this.channelId
			});
		}
	};
	Resource = class {
		get rid() {
			return __classPrivateFieldGet$1(this, _Resource_rid$1, "f");
		}
		constructor(rid) {
			_Resource_rid$1.set(this, void 0);
			__classPrivateFieldSet$1(this, _Resource_rid$1, rid, "f");
		}
		/**
		* Destroys and cleans up this resource from memory.
		* **You should not call any method on this object anymore and should drop any reference to it.**
		*/
		async close() {
			return invoke$1("plugin:resources|close", { rid: this.rid });
		}
	};
	_Resource_rid$1 = new WeakMap();
} });

//#endregion
//#region ../../../node_modules/.pnpm/@tauri-apps+api@2.8.0/node_modules/@tauri-apps/api/external/tslib/tslib.es6.js
/******************************************************************************

Copyright (c) Microsoft Corporation.



Permission to use, copy, modify, and/or distribute this software for any

purpose with or without fee is hereby granted.



THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH

REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY

AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,

INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM

LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR

OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR

PERFORMANCE OF THIS SOFTWARE.

***************************************************************************** */
function __classPrivateFieldGet$1(receiver, state, kind, f) {
	if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
	if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
	return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
}
function __classPrivateFieldSet$1(receiver, state, value, kind, f) {
	if (kind === "m") throw new TypeError("Private method is not writable");
	if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
	if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
	return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
}
var init_tslib_es6$1 = __esm({ "../../../node_modules/.pnpm/@tauri-apps+api@2.8.0/node_modules/@tauri-apps/api/external/tslib/tslib.es6.js"() {} });

//#endregion
//#region src/codex-app-server/local-server-health.ts
function createLocalServerHealthProbe(origin, fetchImpl = fetch) {
	const healthUrl = `${origin}${LOCAL_SERVER_HEALTH_PATH}`;
	return async () => {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
		try {
			const response = await fetchImpl(healthUrl, { signal: controller.signal });
			const body = await response.text();
			return response.ok && body.includes(LOCAL_SERVER_HEALTH_MARKER) ? "ok" : `unexpected_responder status=${response.status}`;
		} catch (error) {
			return error instanceof Error && error.name === "AbortError" ? "probe_timeout" : "unreachable";
		} finally {
			clearTimeout(timeout);
		}
	};
}
var LOCAL_SERVER_HEALTH_MARKER, LOCAL_SERVER_HEALTH_PATH, PROBE_TIMEOUT_MS;
var init_local_server_health = __esm({ "src/codex-app-server/local-server-health.ts"() {
	LOCAL_SERVER_HEALTH_MARKER = "3dagent-local";
	LOCAL_SERVER_HEALTH_PATH = "/health";
	PROBE_TIMEOUT_MS = 1500;
} });

//#endregion
//#region src/codex-app-server/scoped-token-provider.ts
function createTauriCodexScopedTokenProvider(opts = {}) {
	const fetchToken = opts.fetchToken ?? fetchAgentToken;
	const chatgptAccountId = normalizeAccountId(opts.chatgptAccountId ?? CODEX_APP_SERVER_SCOPED_ACCOUNT_ID);
	return {
		current: () => mintScopedToken(fetchToken, opts.envOverride, chatgptAccountId),
		refresh: () => mintScopedToken(fetchToken, opts.envOverride, chatgptAccountId)
	};
}
async function mintScopedToken(fetchToken, envOverride, chatgptAccountId) {
	let result;
	try {
		result = await fetchToken(envOverride);
	} catch (error) {
		throw new CodexScopedTokenProviderError("mint_failed", { error: error instanceof Error ? error.message : String(error) });
	}
	if (result.error) throw new CodexScopedTokenProviderError("mint_failed", { error: result.error });
	const token = validateToken(result.token);
	const expiresInSeconds = validateExpiresInSeconds(result.expiresInSeconds);
	return {
		chatgptAccountId,
		expiresInSeconds,
		token
	};
}
function normalizeAccountId(value) {
	const trimmed = value.trim();
	if (!trimmed || /[\s\u0000-\u001f\u007f]/.test(trimmed)) throw new CodexScopedTokenProviderError("invalid_account_id");
	return trimmed;
}
function validateToken(value) {
	const token = value.trim();
	if (!token || /[\s\u0000-\u001f\u007f]/.test(token)) throw new CodexScopedTokenProviderError("invalid_token");
	return token;
}
function validateExpiresInSeconds(value) {
	if (value === undefined || !Number.isInteger(value) || value <= 0 || value > MAX_SCOPED_TOKEN_TTL_SECONDS) throw new CodexScopedTokenProviderError("invalid_token", { expiresInSeconds: String(value) });
	return value;
}
var CODEX_APP_SERVER_SCOPED_ACCOUNT_ID, CodexScopedTokenProviderError;
var init_scoped_token_provider = __esm({ "src/codex-app-server/scoped-token-provider.ts"() {
	init_agent_token();
	init_adapter();
	init_runtime();
	CODEX_APP_SERVER_SCOPED_ACCOUNT_ID = "3dagent";
	CodexScopedTokenProviderError = class extends Error {
		code;
		diagnostics;
		constructor(code, diagnostics = {}) {
			super(`Codex scoped token provider failed: ${code}`);
			this.name = "CodexScopedTokenProviderError";
			this.code = code;
			this.diagnostics = redactDiagnostics(diagnostics);
		}
	};
} });

//#endregion
//#region src/agent-token.ts
async function loadInvoke() {
	if (cachedInvoke) return cachedInvoke;
	try {
		const mod = await Promise.resolve().then(function() {
			return init_core$1(), core_exports;
		});
		cachedInvoke = mod.invoke;
		return cachedInvoke;
	} catch {
		return null;
	}
}
async function fetchAgentToken(envOverride) {
	const trimmed = envOverride?.trim();
	if (trimmed) return {
		expiresInSeconds: AGENT_TOKEN_TTL_SECONDS,
		token: trimmed,
		source: "env"
	};
	const invoke$2 = await loadInvoke();
	if (!invoke$2) return {
		token: "",
		error: "Tauri IPC unavailable — cannot mint a scoped agent token outside the desktop app."
	};
	try {
		const result = await invoke$2("mint_agent_token");
		const token = typeof result?.token === "string" ? result.token.trim() : "";
		if (result?.ok && token.length > 0) {
			if (validExpiresInSeconds(result.expires_in_seconds)) return {
				expiresInSeconds: result.expires_in_seconds,
				token,
				source: "mint"
			};
			return {
				token: "",
				error: "Failed to mint a scoped agent token: services/api returned invalid TTL metadata."
			};
		}
		return {
			token: "",
			error: result?.error ?? "Failed to mint a scoped agent token: services/api returned no token."
		};
	} catch (err) {
		return {
			token: "",
			error: `Failed to mint a scoped agent token: ${stringifyError(err)}`
		};
	}
}
function stringifyError(err) {
	if (err instanceof Error) return err.message;
	return String(err);
}
function validExpiresInSeconds(value) {
	return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= AGENT_TOKEN_TTL_SECONDS;
}
var cachedInvoke, AGENT_TOKEN_TTL_SECONDS;
var init_agent_token = __esm({ "src/agent-token.ts"() {
	cachedInvoke = null;
	AGENT_TOKEN_TTL_SECONDS = 900;
} });

//#endregion
//#region ../../../node_modules/.pnpm/@tauri-apps+plugin-shell@2.3.5/node_modules/@tauri-apps/plugin-shell/dist-js/index.js
var dist_js_exports = {};
__export(dist_js_exports, {
	Child: () => Child,
	Command: () => Command,
	EventEmitter: () => EventEmitter,
	open: () => open
});
/**
* Opens a path or URL with the system's default app,
* or the one specified with `openWith`.
*
* The `openWith` value must be one of `firefox`, `google chrome`, `chromium` `safari`,
* `open`, `start`, `xdg-open`, `gio`, `gnome-open`, `kde-open` or `wslview`.
*
* @example
* ```typescript
* import { open } from '@tauri-apps/plugin-shell';
* // opens the given URL on the default browser:
* await open('https://github.com/tauri-apps/tauri');
* // opens the given URL using `firefox`:
* await open('https://github.com/tauri-apps/tauri', 'firefox');
* // opens a file using the default program:
* await open('/path/to/file');
* ```
*
* @param path The path or URL to open.
* This value is matched against the string regex defined on `tauri.conf.json > plugins > shell > open`,
* which defaults to `^((mailto:\w+)|(tel:\w+)|(https?://\w+)).+`.
* @param openWith The app to open the file or URL with.
* Defaults to the system default application for the specified path type.
*
* @since 2.0.0
*/
async function open(path, openWith) {
	await invoke("plugin:shell|open", {
		path,
		with: openWith
	});
}
var EventEmitter, Child, Command;
var init_dist_js = __esm({ "../../../node_modules/.pnpm/@tauri-apps+plugin-shell@2.3.5/node_modules/@tauri-apps/plugin-shell/dist-js/index.js"() {
	init_core();
	EventEmitter = class {
		constructor() {
			/** @ignore */
			this.eventListeners = Object.create(null);
		}
		/**
		* Alias for `emitter.on(eventName, listener)`.
		*
		* @since 2.0.0
		*/
		addListener(eventName, listener) {
			return this.on(eventName, listener);
		}
		/**
		* Alias for `emitter.off(eventName, listener)`.
		*
		* @since 2.0.0
		*/
		removeListener(eventName, listener) {
			return this.off(eventName, listener);
		}
		/**
		* Adds the `listener` function to the end of the listeners array for the
		* event named `eventName`. No checks are made to see if the `listener` has
		* already been added. Multiple calls passing the same combination of `eventName`and `listener` will result in the `listener` being added, and called, multiple
		* times.
		*
		* Returns a reference to the `EventEmitter`, so that calls can be chained.
		*
		* @since 2.0.0
		*/
		on(eventName, listener) {
			if (eventName in this.eventListeners) this.eventListeners[eventName].push(listener);
else this.eventListeners[eventName] = [listener];
			return this;
		}
		/**
		* Adds a **one-time**`listener` function for the event named `eventName`. The
		* next time `eventName` is triggered, this listener is removed and then invoked.
		*
		* Returns a reference to the `EventEmitter`, so that calls can be chained.
		*
		* @since 2.0.0
		*/
		once(eventName, listener) {
			const wrapper = (arg) => {
				this.removeListener(eventName, wrapper);
				listener(arg);
			};
			return this.addListener(eventName, wrapper);
		}
		/**
		* Removes the all specified listener from the listener array for the event eventName
		* Returns a reference to the `EventEmitter`, so that calls can be chained.
		*
		* @since 2.0.0
		*/
		off(eventName, listener) {
			if (eventName in this.eventListeners) this.eventListeners[eventName] = this.eventListeners[eventName].filter((l) => l !== listener);
			return this;
		}
		/**
		* Removes all listeners, or those of the specified eventName.
		*
		* Returns a reference to the `EventEmitter`, so that calls can be chained.
		*
		* @since 2.0.0
		*/
		removeAllListeners(event) {
			if (event) delete this.eventListeners[event];
else this.eventListeners = Object.create(null);
			return this;
		}
		/**
		* @ignore
		* Synchronously calls each of the listeners registered for the event named`eventName`, in the order they were registered, passing the supplied arguments
		* to each.
		*
		* @returns `true` if the event had listeners, `false` otherwise.
		*
		* @since 2.0.0
		*/
		emit(eventName, arg) {
			if (eventName in this.eventListeners) {
				const listeners = this.eventListeners[eventName];
				for (const listener of listeners) listener(arg);
				return true;
			}
			return false;
		}
		/**
		* Returns the number of listeners listening to the event named `eventName`.
		*
		* @since 2.0.0
		*/
		listenerCount(eventName) {
			if (eventName in this.eventListeners) return this.eventListeners[eventName].length;
			return 0;
		}
		/**
		* Adds the `listener` function to the _beginning_ of the listeners array for the
		* event named `eventName`. No checks are made to see if the `listener` has
		* already been added. Multiple calls passing the same combination of `eventName`and `listener` will result in the `listener` being added, and called, multiple
		* times.
		*
		* Returns a reference to the `EventEmitter`, so that calls can be chained.
		*
		* @since 2.0.0
		*/
		prependListener(eventName, listener) {
			if (eventName in this.eventListeners) this.eventListeners[eventName].unshift(listener);
else this.eventListeners[eventName] = [listener];
			return this;
		}
		/**
		* Adds a **one-time**`listener` function for the event named `eventName` to the_beginning_ of the listeners array. The next time `eventName` is triggered, this
		* listener is removed, and then invoked.
		*
		* Returns a reference to the `EventEmitter`, so that calls can be chained.
		*
		* @since 2.0.0
		*/
		prependOnceListener(eventName, listener) {
			const wrapper = (arg) => {
				this.removeListener(eventName, wrapper);
				listener(arg);
			};
			return this.prependListener(eventName, wrapper);
		}
	};
	Child = class {
		constructor(pid) {
			this.pid = pid;
		}
		/**
		* Writes `data` to the `stdin`.
		*
		* @param data The message to write, either a string or a byte array.
		* @example
		* ```typescript
		* import { Command } from '@tauri-apps/plugin-shell';
		* const command = Command.create('node');
		* const child = await command.spawn();
		* await child.write('message');
		* await child.write([0, 1, 2, 3, 4, 5]);
		* ```
		*
		* @returns A promise indicating the success or failure of the operation.
		*
		* @since 2.0.0
		*/
		async write(data) {
			await invoke("plugin:shell|stdin_write", {
				pid: this.pid,
				buffer: data
			});
		}
		/**
		* Kills the child process.
		*
		* @returns A promise indicating the success or failure of the operation.
		*
		* @since 2.0.0
		*/
		async kill() {
			await invoke("plugin:shell|kill", {
				cmd: "killChild",
				pid: this.pid
			});
		}
	};
	Command = class Command extends EventEmitter {
		/**
		* @ignore
		* Creates a new `Command` instance.
		*
		* @param program The program name to execute.
		* It must be configured in your project's capabilities.
		* @param args Program arguments.
		* @param options Spawn options.
		*/
		constructor(program, args = [], options) {
			super();
			/** Event emitter for the `stdout`. Emits the `data` event. */
			this.stdout = new EventEmitter();
			/** Event emitter for the `stderr`. Emits the `data` event. */
			this.stderr = new EventEmitter();
			this.program = program;
			this.args = typeof args === "string" ? [args] : args;
			this.options = options ?? {};
		}
		/**
		* Creates a command to execute the given program.
		* @example
		* ```typescript
		* import { Command } from '@tauri-apps/plugin-shell';
		* const command = Command.create('my-app', ['run', 'tauri']);
		* const output = await command.execute();
		* ```
		*
		* @param program The program to execute.
		* It must be configured in your project's capabilities.
		*/
		static create(program, args = [], options) {
			return new Command(program, args, options);
		}
		/**
		* Creates a command to execute the given sidecar program.
		* @example
		* ```typescript
		* import { Command } from '@tauri-apps/plugin-shell';
		* const command = Command.sidecar('my-sidecar');
		* const output = await command.execute();
		* ```
		*
		* @param program The program to execute.
		* It must be configured in your project's capabilities.
		*/
		static sidecar(program, args = [], options) {
			const instance = new Command(program, args, options);
			instance.options.sidecar = true;
			return instance;
		}
		/**
		* Executes the command as a child process, returning a handle to it.
		*
		* @returns A promise resolving to the child process handle.
		*
		* @since 2.0.0
		*/
		async spawn() {
			const program = this.program;
			const args = this.args;
			const options = this.options;
			if (typeof args === "object") Object.freeze(args);
			const onEvent = new Channel();
			onEvent.onmessage = (event) => {
				switch (event.event) {
					case "Error":
						this.emit("error", event.payload);
						break;
					case "Terminated":
						this.emit("close", event.payload);
						break;
					case "Stdout":
						this.stdout.emit("data", event.payload);
						break;
					case "Stderr":
						this.stderr.emit("data", event.payload);
						break;
				}
			};
			return await invoke("plugin:shell|spawn", {
				program,
				args,
				options,
				onEvent
			}).then((pid) => new Child(pid));
		}
		/**
		* Executes the command as a child process, waiting for it to finish and collecting all of its output.
		* @example
		* ```typescript
		* import { Command } from '@tauri-apps/plugin-shell';
		* const output = await Command.create('echo', 'message').execute();
		* assert(output.code === 0);
		* assert(output.signal === null);
		* assert(output.stdout === 'message');
		* assert(output.stderr === '');
		* ```
		*
		* @returns A promise resolving to the child process output.
		*
		* @since 2.0.0
		*/
		async execute() {
			const program = this.program;
			const args = this.args;
			const options = this.options;
			if (typeof args === "object") Object.freeze(args);
			return await invoke("plugin:shell|execute", {
				program,
				args,
				options
			});
		}
	};
} });

//#endregion
//#region ../../../node_modules/.pnpm/@tauri-apps+api@2.8.0/node_modules/@tauri-apps/api/path.js
var path_exports = {};
__export(path_exports, {
	BaseDirectory: () => BaseDirectory,
	appCacheDir: () => appCacheDir,
	appConfigDir: () => appConfigDir,
	appDataDir: () => appDataDir,
	appLocalDataDir: () => appLocalDataDir,
	appLogDir: () => appLogDir,
	audioDir: () => audioDir,
	basename: () => basename,
	cacheDir: () => cacheDir,
	configDir: () => configDir,
	dataDir: () => dataDir,
	delimiter: () => delimiter,
	desktopDir: () => desktopDir,
	dirname: () => dirname,
	documentDir: () => documentDir,
	downloadDir: () => downloadDir,
	executableDir: () => executableDir,
	extname: () => extname,
	fontDir: () => fontDir,
	homeDir: () => homeDir,
	isAbsolute: () => isAbsolute,
	join: () => join,
	localDataDir: () => localDataDir,
	normalize: () => normalize,
	pictureDir: () => pictureDir,
	publicDir: () => publicDir,
	resolve: () => resolve,
	resolveResource: () => resolveResource,
	resourceDir: () => resourceDir,
	runtimeDir: () => runtimeDir,
	sep: () => sep,
	tempDir: () => tempDir,
	templateDir: () => templateDir,
	videoDir: () => videoDir
});
/**
* Returns the path to the suggested directory for your app's config files.
* Resolves to `${configDir}/${bundleIdentifier}`, where `bundleIdentifier` is the [`identifier`](https://v2.tauri.app/reference/config/#identifier) value configured in `tauri.conf.json`.
* @example
* ```typescript
* import { appConfigDir } from '@tauri-apps/api/path';
* const appConfigDirPath = await appConfigDir();
* ```
*
* @since 1.2.0
*/
async function appConfigDir() {
	return invoke$1("plugin:path|resolve_directory", { directory: BaseDirectory.AppConfig });
}
/**
* Returns the path to the suggested directory for your app's data files.
* Resolves to `${dataDir}/${bundleIdentifier}`, where `bundleIdentifier` is the [`identifier`](https://v2.tauri.app/reference/config/#identifier) value configured in `tauri.conf.json`.
* @example
* ```typescript
* import { appDataDir } from '@tauri-apps/api/path';
* const appDataDirPath = await appDataDir();
* ```
*
* @since 1.2.0
*/
async function appDataDir() {
	return invoke$1("plugin:path|resolve_directory", { directory: BaseDirectory.AppData });
}
/**
* Returns the path to the suggested directory for your app's local data files.
* Resolves to `${localDataDir}/${bundleIdentifier}`, where `bundleIdentifier` is the [`identifier`](https://v2.tauri.app/reference/config/#identifier) value configured in `tauri.conf.json`.
* @example
* ```typescript
* import { appLocalDataDir } from '@tauri-apps/api/path';
* const appLocalDataDirPath = await appLocalDataDir();
* ```
*
* @since 1.2.0
*/
async function appLocalDataDir() {
	return invoke$1("plugin:path|resolve_directory", { directory: BaseDirectory.AppLocalData });
}
/**
* Returns the path to the suggested directory for your app's cache files.
* Resolves to `${cacheDir}/${bundleIdentifier}`, where `bundleIdentifier` is the [`identifier`](https://v2.tauri.app/reference/config/#identifier) value configured in `tauri.conf.json`.
* @example
* ```typescript
* import { appCacheDir } from '@tauri-apps/api/path';
* const appCacheDirPath = await appCacheDir();
* ```
*
* @since 1.2.0
*/
async function appCacheDir() {
	return invoke$1("plugin:path|resolve_directory", { directory: BaseDirectory.AppCache });
}
/**
* Returns the path to the user's audio directory.
*
* #### Platform-specific
*
* - **Linux:** Resolves to [`xdg-user-dirs`](https://www.freedesktop.org/wiki/Software/xdg-user-dirs/)' `XDG_MUSIC_DIR`.
* - **macOS:** Resolves to `$HOME/Music`.
* - **Windows:** Resolves to `{FOLDERID_Music}`.
* @example
* ```typescript
* import { audioDir } from '@tauri-apps/api/path';
* const audioDirPath = await audioDir();
* ```
*
* @since 1.0.0
*/
async function audioDir() {
	return invoke$1("plugin:path|resolve_directory", { directory: BaseDirectory.Audio });
}
/**
* Returns the path to the user's cache directory.
*
* #### Platform-specific
*
* - **Linux:** Resolves to `$XDG_CACHE_HOME` or `$HOME/.cache`.
* - **macOS:** Resolves to `$HOME/Library/Caches`.
* - **Windows:** Resolves to `{FOLDERID_LocalAppData}`.
* @example
* ```typescript
* import { cacheDir } from '@tauri-apps/api/path';
* const cacheDirPath = await cacheDir();
* ```
*
* @since 1.0.0
*/
async function cacheDir() {
	return invoke$1("plugin:path|resolve_directory", { directory: BaseDirectory.Cache });
}
/**
* Returns the path to the user's config directory.
*
* #### Platform-specific
*
* - **Linux:** Resolves to `$XDG_CONFIG_HOME` or `$HOME/.config`.
* - **macOS:** Resolves to `$HOME/Library/Application Support`.
* - **Windows:** Resolves to `{FOLDERID_RoamingAppData}`.
* @example
* ```typescript
* import { configDir } from '@tauri-apps/api/path';
* const configDirPath = await configDir();
* ```
*
* @since 1.0.0
*/
async function configDir() {
	return invoke$1("plugin:path|resolve_directory", { directory: BaseDirectory.Config });
}
/**
* Returns the path to the user's data directory.
*
* #### Platform-specific
*
* - **Linux:** Resolves to `$XDG_DATA_HOME` or `$HOME/.local/share`.
* - **macOS:** Resolves to `$HOME/Library/Application Support`.
* - **Windows:** Resolves to `{FOLDERID_RoamingAppData}`.
* @example
* ```typescript
* import { dataDir } from '@tauri-apps/api/path';
* const dataDirPath = await dataDir();
* ```
*
* @since 1.0.0
*/
async function dataDir() {
	return invoke$1("plugin:path|resolve_directory", { directory: BaseDirectory.Data });
}
/**
* Returns the path to the user's desktop directory.
*
* #### Platform-specific
*
* - **Linux:** Resolves to [`xdg-user-dirs`](https://www.freedesktop.org/wiki/Software/xdg-user-dirs/)' `XDG_DESKTOP_DIR`.
* - **macOS:** Resolves to `$HOME/Desktop`.
* - **Windows:** Resolves to `{FOLDERID_Desktop}`.
* @example
* ```typescript
* import { desktopDir } from '@tauri-apps/api/path';
* const desktopPath = await desktopDir();
* ```
*
* @since 1.0.0
*/
async function desktopDir() {
	return invoke$1("plugin:path|resolve_directory", { directory: BaseDirectory.Desktop });
}
/**
* Returns the path to the user's document directory.
* @example
* ```typescript
* import { documentDir } from '@tauri-apps/api/path';
* const documentDirPath = await documentDir();
* ```
*
* #### Platform-specific
*
* - **Linux:** Resolves to [`xdg-user-dirs`](https://www.freedesktop.org/wiki/Software/xdg-user-dirs/)' `XDG_DOCUMENTS_DIR`.
* - **macOS:** Resolves to `$HOME/Documents`.
* - **Windows:** Resolves to `{FOLDERID_Documents}`.
*
* @since 1.0.0
*/
async function documentDir() {
	return invoke$1("plugin:path|resolve_directory", { directory: BaseDirectory.Document });
}
/**
* Returns the path to the user's download directory.
*
* #### Platform-specific
*
* - **Linux**: Resolves to [`xdg-user-dirs`](https://www.freedesktop.org/wiki/Software/xdg-user-dirs/)' `XDG_DOWNLOAD_DIR`.
* - **macOS**: Resolves to `$HOME/Downloads`.
* - **Windows**: Resolves to `{FOLDERID_Downloads}`.
* @example
* ```typescript
* import { downloadDir } from '@tauri-apps/api/path';
* const downloadDirPath = await downloadDir();
* ```
*
* @since 1.0.0
*/
async function downloadDir() {
	return invoke$1("plugin:path|resolve_directory", { directory: BaseDirectory.Download });
}
/**
* Returns the path to the user's executable directory.
*
* #### Platform-specific
*
* - **Linux:** Resolves to `$XDG_BIN_HOME/../bin` or `$XDG_DATA_HOME/../bin` or `$HOME/.local/bin`.
* - **macOS:** Not supported.
* - **Windows:** Not supported.
* @example
* ```typescript
* import { executableDir } from '@tauri-apps/api/path';
* const executableDirPath = await executableDir();
* ```
*
* @since 1.0.0
*/
async function executableDir() {
	return invoke$1("plugin:path|resolve_directory", { directory: BaseDirectory.Executable });
}
/**
* Returns the path to the user's font directory.
*
* #### Platform-specific
*
* - **Linux:** Resolves to `$XDG_DATA_HOME/fonts` or `$HOME/.local/share/fonts`.
* - **macOS:** Resolves to `$HOME/Library/Fonts`.
* - **Windows:** Not supported.
* @example
* ```typescript
* import { fontDir } from '@tauri-apps/api/path';
* const fontDirPath = await fontDir();
* ```
*
* @since 1.0.0
*/
async function fontDir() {
	return invoke$1("plugin:path|resolve_directory", { directory: BaseDirectory.Font });
}
/**
* Returns the path to the user's home directory.
*
* #### Platform-specific
*
* - **Linux:** Resolves to `$HOME`.
* - **macOS:** Resolves to `$HOME`.
* - **Windows:** Resolves to `{FOLDERID_Profile}`.
* @example
* ```typescript
* import { homeDir } from '@tauri-apps/api/path';
* const homeDirPath = await homeDir();
* ```
*
* @since 1.0.0
*/
async function homeDir() {
	return invoke$1("plugin:path|resolve_directory", { directory: BaseDirectory.Home });
}
/**
* Returns the path to the user's local data directory.
*
* #### Platform-specific
*
* - **Linux:** Resolves to `$XDG_DATA_HOME` or `$HOME/.local/share`.
* - **macOS:** Resolves to `$HOME/Library/Application Support`.
* - **Windows:** Resolves to `{FOLDERID_LocalAppData}`.
* @example
* ```typescript
* import { localDataDir } from '@tauri-apps/api/path';
* const localDataDirPath = await localDataDir();
* ```
*
* @since 1.0.0
*/
async function localDataDir() {
	return invoke$1("plugin:path|resolve_directory", { directory: BaseDirectory.LocalData });
}
/**
* Returns the path to the user's picture directory.
*
* #### Platform-specific
*
* - **Linux:** Resolves to [`xdg-user-dirs`](https://www.freedesktop.org/wiki/Software/xdg-user-dirs/)' `XDG_PICTURES_DIR`.
* - **macOS:** Resolves to `$HOME/Pictures`.
* - **Windows:** Resolves to `{FOLDERID_Pictures}`.
* @example
* ```typescript
* import { pictureDir } from '@tauri-apps/api/path';
* const pictureDirPath = await pictureDir();
* ```
*
* @since 1.0.0
*/
async function pictureDir() {
	return invoke$1("plugin:path|resolve_directory", { directory: BaseDirectory.Picture });
}
/**
* Returns the path to the user's public directory.
*
* #### Platform-specific
*
* - **Linux:** Resolves to [`xdg-user-dirs`](https://www.freedesktop.org/wiki/Software/xdg-user-dirs/)' `XDG_PUBLICSHARE_DIR`.
* - **macOS:** Resolves to `$HOME/Public`.
* - **Windows:** Resolves to `{FOLDERID_Public}`.
* @example
* ```typescript
* import { publicDir } from '@tauri-apps/api/path';
* const publicDirPath = await publicDir();
* ```
*
* @since 1.0.0
*/
async function publicDir() {
	return invoke$1("plugin:path|resolve_directory", { directory: BaseDirectory.Public });
}
/**
* Returns the path to the application's resource directory.
* To resolve a resource path, see {@linkcode resolveResource}.
*
* ## Platform-specific
*
* Although we provide the exact path where this function resolves to,
* this is not a contract and things might change in the future
*
* - **Windows:** Resolves to the directory that contains the main executable.
* - **Linux:** When running in an AppImage, the `APPDIR` variable will be set to
*   the mounted location of the app, and the resource dir will be `${APPDIR}/usr/lib/${exe_name}`.
*   If not running in an AppImage, the path is `/usr/lib/${exe_name}`.
*   When running the app from `src-tauri/target/(debug|release)/`, the path is `${exe_dir}/../lib/${exe_name}`.
* - **macOS:** Resolves to `${exe_dir}/../Resources` (inside .app).
* - **iOS:** Resolves to `${exe_dir}/assets`.
* - **Android:** Currently the resources are stored in the APK as assets so it's not a normal file system path,
*   we return a special URI prefix `asset://localhost/` here that can be used with the [file system plugin](https://tauri.app/plugin/file-system/),
*
* @example
* ```typescript
* import { resourceDir } from '@tauri-apps/api/path';
* const resourceDirPath = await resourceDir();
* ```
*
* @since 1.0.0
*/
async function resourceDir() {
	return invoke$1("plugin:path|resolve_directory", { directory: BaseDirectory.Resource });
}
/**
* Resolve the path to a resource file.
* @example
* ```typescript
* import { resolveResource } from '@tauri-apps/api/path';
* const resourcePath = await resolveResource('script.sh');
* ```
*
* @param resourcePath The path to the resource.
* Must follow the same syntax as defined in `tauri.conf.json > bundle > resources`, i.e. keeping subfolders and parent dir components (`../`).
* @returns The full path to the resource.
*
* @since 1.0.0
*/
async function resolveResource(resourcePath) {
	return invoke$1("plugin:path|resolve_directory", {
		directory: BaseDirectory.Resource,
		path: resourcePath
	});
}
/**
* Returns the path to the user's runtime directory.
*
* #### Platform-specific
*
* - **Linux:** Resolves to `$XDG_RUNTIME_DIR`.
* - **macOS:** Not supported.
* - **Windows:** Not supported.
* @example
* ```typescript
* import { runtimeDir } from '@tauri-apps/api/path';
* const runtimeDirPath = await runtimeDir();
* ```
*
* @since 1.0.0
*/
async function runtimeDir() {
	return invoke$1("plugin:path|resolve_directory", { directory: BaseDirectory.Runtime });
}
/**
* Returns the path to the user's template directory.
*
* #### Platform-specific
*
* - **Linux:** Resolves to [`xdg-user-dirs`](https://www.freedesktop.org/wiki/Software/xdg-user-dirs/)' `XDG_TEMPLATES_DIR`.
* - **macOS:** Not supported.
* - **Windows:** Resolves to `{FOLDERID_Templates}`.
* @example
* ```typescript
* import { templateDir } from '@tauri-apps/api/path';
* const templateDirPath = await templateDir();
* ```
*
* @since 1.0.0
*/
async function templateDir() {
	return invoke$1("plugin:path|resolve_directory", { directory: BaseDirectory.Template });
}
/**
* Returns the path to the user's video directory.
*
* #### Platform-specific
*
* - **Linux:** Resolves to [`xdg-user-dirs`](https://www.freedesktop.org/wiki/Software/xdg-user-dirs/)' `XDG_VIDEOS_DIR`.
* - **macOS:** Resolves to `$HOME/Movies`.
* - **Windows:** Resolves to `{FOLDERID_Videos}`.
* @example
* ```typescript
* import { videoDir } from '@tauri-apps/api/path';
* const videoDirPath = await videoDir();
* ```
*
* @since 1.0.0
*/
async function videoDir() {
	return invoke$1("plugin:path|resolve_directory", { directory: BaseDirectory.Video });
}
/**
* Returns the path to the suggested directory for your app's log files.
*
* #### Platform-specific
*
* - **Linux:** Resolves to `${configDir}/${bundleIdentifier}/logs`.
* - **macOS:** Resolves to `${homeDir}/Library/Logs/{bundleIdentifier}`
* - **Windows:** Resolves to `${configDir}/${bundleIdentifier}/logs`.
* @example
* ```typescript
* import { appLogDir } from '@tauri-apps/api/path';
* const appLogDirPath = await appLogDir();
* ```
*
* @since 1.2.0
*/
async function appLogDir() {
	return invoke$1("plugin:path|resolve_directory", { directory: BaseDirectory.AppLog });
}
/**
* Returns a temporary directory.
* @example
* ```typescript
* import { tempDir } from '@tauri-apps/api/path';
* const temp = await tempDir();
* ```
*
* @since 2.0.0
*/
async function tempDir() {
	return invoke$1("plugin:path|resolve_directory", { directory: BaseDirectory.Temp });
}
/**
* Returns the platform-specific path segment separator:
* - `\` on Windows
* - `/` on POSIX
*
* @since 2.0.0
*/
function sep() {
	return window.__TAURI_INTERNALS__.plugins.path.sep;
}
/**
* Returns the platform-specific path segment delimiter:
* - `;` on Windows
* - `:` on POSIX
*
* @since 2.0.0
*/
function delimiter() {
	return window.__TAURI_INTERNALS__.plugins.path.delimiter;
}
/**
* Resolves a sequence of `paths` or `path` segments into an absolute path.
* @example
* ```typescript
* import { resolve, appDataDir } from '@tauri-apps/api/path';
* const appDataDirPath = await appDataDir();
* const path = await resolve(appDataDirPath, '..', 'users', 'tauri', 'avatar.png');
* ```
*
* @since 1.0.0
*/
async function resolve(...paths) {
	return invoke$1("plugin:path|resolve", { paths });
}
/**
* Normalizes the given `path`, resolving `'..'` and `'.'` segments and resolve symbolic links.
* @example
* ```typescript
* import { normalize, appDataDir } from '@tauri-apps/api/path';
* const appDataDirPath = await appDataDir();
* const path = await normalize(`${appDataDirPath}/../users/tauri/avatar.png`);
* ```
*
* @since 1.0.0
*/
async function normalize(path) {
	return invoke$1("plugin:path|normalize", { path });
}
/**
*  Joins all given `path` segments together using the platform-specific separator as a delimiter, then normalizes the resulting path.
* @example
* ```typescript
* import { join, appDataDir } from '@tauri-apps/api/path';
* const appDataDirPath = await appDataDir();
* const path = await join(appDataDirPath, 'users', 'tauri', 'avatar.png');
* ```
*
* @since 1.0.0
*/
async function join(...paths) {
	return invoke$1("plugin:path|join", { paths });
}
/**
* Returns the parent directory of a given `path`. Trailing directory separators are ignored.
* @example
* ```typescript
* import { dirname } from '@tauri-apps/api/path';
* const dir = await dirname('/path/to/somedir/');
* assert(dir === '/path/to');
* ```
*
* @since 1.0.0
*/
async function dirname(path) {
	return invoke$1("plugin:path|dirname", { path });
}
/**
* Returns the extension of the `path`.
* @example
* ```typescript
* import { extname } from '@tauri-apps/api/path';
* const ext = await extname('/path/to/file.html');
* assert(ext === 'html');
* ```
*
* @since 1.0.0
*/
async function extname(path) {
	return invoke$1("plugin:path|extname", { path });
}
/**
* Returns the last portion of a `path`. Trailing directory separators are ignored.
* @example
* ```typescript
* import { basename } from '@tauri-apps/api/path';
* const base = await basename('path/to/app.conf');
* assert(base === 'app.conf');
* ```
* @param ext An optional file extension to be removed from the returned path.
*
* @since 1.0.0
*/
async function basename(path, ext) {
	return invoke$1("plugin:path|basename", {
		path,
		ext
	});
}
/**
* Returns whether the path is absolute or not.
* @example
* ```typescript
* import { isAbsolute } from '@tauri-apps/api/path';
* assert(await isAbsolute('/home/tauri'));
* ```
*
* @since 1.0.0
*/
async function isAbsolute(path) {
	return invoke$1("plugin:path|is_absolute", { path });
}
var BaseDirectory;
var init_path = __esm({ "../../../node_modules/.pnpm/@tauri-apps+api@2.8.0/node_modules/@tauri-apps/api/path.js"() {
	init_core$1();
	(function(BaseDirectory$1) {
		/**
		* @see {@link audioDir} for more information.
		*/
		BaseDirectory$1[BaseDirectory$1["Audio"] = 1] = "Audio";
		/**
		* @see {@link cacheDir} for more information.
		*/
		BaseDirectory$1[BaseDirectory$1["Cache"] = 2] = "Cache";
		/**
		* @see {@link configDir} for more information.
		*/
		BaseDirectory$1[BaseDirectory$1["Config"] = 3] = "Config";
		/**
		* @see {@link dataDir} for more information.
		*/
		BaseDirectory$1[BaseDirectory$1["Data"] = 4] = "Data";
		/**
		* @see {@link localDataDir} for more information.
		*/
		BaseDirectory$1[BaseDirectory$1["LocalData"] = 5] = "LocalData";
		/**
		* @see {@link documentDir} for more information.
		*/
		BaseDirectory$1[BaseDirectory$1["Document"] = 6] = "Document";
		/**
		* @see {@link downloadDir} for more information.
		*/
		BaseDirectory$1[BaseDirectory$1["Download"] = 7] = "Download";
		/**
		* @see {@link pictureDir} for more information.
		*/
		BaseDirectory$1[BaseDirectory$1["Picture"] = 8] = "Picture";
		/**
		* @see {@link publicDir} for more information.
		*/
		BaseDirectory$1[BaseDirectory$1["Public"] = 9] = "Public";
		/**
		* @see {@link videoDir} for more information.
		*/
		BaseDirectory$1[BaseDirectory$1["Video"] = 10] = "Video";
		/**
		* @see {@link resourceDir} for more information.
		*/
		BaseDirectory$1[BaseDirectory$1["Resource"] = 11] = "Resource";
		/**
		* @see {@link tempDir} for more information.
		*/
		BaseDirectory$1[BaseDirectory$1["Temp"] = 12] = "Temp";
		/**
		* @see {@link appConfigDir} for more information.
		*/
		BaseDirectory$1[BaseDirectory$1["AppConfig"] = 13] = "AppConfig";
		/**
		* @see {@link appDataDir} for more information.
		*/
		BaseDirectory$1[BaseDirectory$1["AppData"] = 14] = "AppData";
		/**
		* @see {@link appLocalDataDir} for more information.
		*/
		BaseDirectory$1[BaseDirectory$1["AppLocalData"] = 15] = "AppLocalData";
		/**
		* @see {@link appCacheDir} for more information.
		*/
		BaseDirectory$1[BaseDirectory$1["AppCache"] = 16] = "AppCache";
		/**
		* @see {@link appLogDir} for more information.
		*/
		BaseDirectory$1[BaseDirectory$1["AppLog"] = 17] = "AppLog";
		/**
		* @see {@link desktopDir} for more information.
		*/
		BaseDirectory$1[BaseDirectory$1["Desktop"] = 18] = "Desktop";
		/**
		* @see {@link executableDir} for more information.
		*/
		BaseDirectory$1[BaseDirectory$1["Executable"] = 19] = "Executable";
		/**
		* @see {@link fontDir} for more information.
		*/
		BaseDirectory$1[BaseDirectory$1["Font"] = 20] = "Font";
		/**
		* @see {@link homeDir} for more information.
		*/
		BaseDirectory$1[BaseDirectory$1["Home"] = 21] = "Home";
		/**
		* @see {@link runtimeDir} for more information.
		*/
		BaseDirectory$1[BaseDirectory$1["Runtime"] = 22] = "Runtime";
		/**
		* @see {@link templateDir} for more information.
		*/
		BaseDirectory$1[BaseDirectory$1["Template"] = 23] = "Template";
	})(BaseDirectory || (BaseDirectory = {}));
} });

//#endregion
//#region ../../../node_modules/.pnpm/@tauri-apps+api@2.10.1/node_modules/@tauri-apps/api/core.js
/**
* Stores the callback in a known location, and returns an identifier that can be passed to the backend.
* The backend uses the identifier to `eval()` the callback.
*
* @return An unique identifier associated with the callback function.
*
* @since 1.0.0
*/
function transformCallback(callback, once = false) {
	return window.__TAURI_INTERNALS__.transformCallback(callback, once);
}
/**
* Sends a message to the backend.
* @example
* ```typescript
* import { invoke } from '@tauri-apps/api/core';
* await invoke('login', { user: 'tauri', password: 'poiwe3h4r5ip3yrhtew9ty' });
* ```
*
* @param cmd The command name.
* @param args The optional arguments to pass to the command.
* @param options The request options.
* @return A promise resolving or rejecting to the backend response.
*
* @since 1.0.0
*/
async function invoke(cmd, args = {}, options) {
	return window.__TAURI_INTERNALS__.invoke(cmd, args, options);
}
var _Channel_onmessage, _Channel_nextMessageIndex, _Channel_pendingMessages, _Channel_messageEndIndex, _Resource_rid, SERIALIZE_TO_IPC_FN, Channel;
var init_core = __esm({ "../../../node_modules/.pnpm/@tauri-apps+api@2.10.1/node_modules/@tauri-apps/api/core.js"() {
	init_tslib_es6();
	SERIALIZE_TO_IPC_FN = "__TAURI_TO_IPC_KEY__";
	Channel = class {
		constructor(onmessage) {
			_Channel_onmessage.set(this, void 0);
			_Channel_nextMessageIndex.set(this, 0);
			_Channel_pendingMessages.set(this, []);
			_Channel_messageEndIndex.set(this, void 0);
			__classPrivateFieldSet(this, _Channel_onmessage, onmessage || (() => {}), "f");
			this.id = transformCallback((rawMessage) => {
				const index = rawMessage.index;
				if ("end" in rawMessage) {
					if (index == __classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")) this.cleanupCallback();
else __classPrivateFieldSet(this, _Channel_messageEndIndex, index, "f");
					return;
				}
				const message = rawMessage.message;
				if (index == __classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")) {
					__classPrivateFieldGet(this, _Channel_onmessage, "f").call(this, message);
					__classPrivateFieldSet(this, _Channel_nextMessageIndex, __classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") + 1, "f");
					while (__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") in __classPrivateFieldGet(this, _Channel_pendingMessages, "f")) {
						const message$1 = __classPrivateFieldGet(this, _Channel_pendingMessages, "f")[__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")];
						__classPrivateFieldGet(this, _Channel_onmessage, "f").call(this, message$1);
						delete __classPrivateFieldGet(this, _Channel_pendingMessages, "f")[__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")];
						__classPrivateFieldSet(this, _Channel_nextMessageIndex, __classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") + 1, "f");
					}
					if (__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") === __classPrivateFieldGet(this, _Channel_messageEndIndex, "f")) this.cleanupCallback();
				} else __classPrivateFieldGet(this, _Channel_pendingMessages, "f")[index] = message;
			});
		}
		cleanupCallback() {
			window.__TAURI_INTERNALS__.unregisterCallback(this.id);
		}
		set onmessage(handler) {
			__classPrivateFieldSet(this, _Channel_onmessage, handler, "f");
		}
		get onmessage() {
			return __classPrivateFieldGet(this, _Channel_onmessage, "f");
		}
		[(_Channel_onmessage = new WeakMap(), _Channel_nextMessageIndex = new WeakMap(), _Channel_pendingMessages = new WeakMap(), _Channel_messageEndIndex = new WeakMap(), SERIALIZE_TO_IPC_FN)]() {
			return `__CHANNEL__:${this.id}`;
		}
		toJSON() {
			return this[SERIALIZE_TO_IPC_FN]();
		}
	};
	_Resource_rid = new WeakMap();
} });

//#endregion
//#region ../../../node_modules/.pnpm/@tauri-apps+api@2.10.1/node_modules/@tauri-apps/api/external/tslib/tslib.es6.js
/******************************************************************************

Copyright (c) Microsoft Corporation.



Permission to use, copy, modify, and/or distribute this software for any

purpose with or without fee is hereby granted.



THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH

REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY

AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,

INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM

LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR

OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR

PERFORMANCE OF THIS SOFTWARE.

***************************************************************************** */
function __classPrivateFieldGet(receiver, state, kind, f) {
	if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
	if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
	return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
}
function __classPrivateFieldSet(receiver, state, value, kind, f) {
	if (kind === "m") throw new TypeError("Private method is not writable");
	if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
	if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
	return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
}
var init_tslib_es6 = __esm({ "../../../node_modules/.pnpm/@tauri-apps+api@2.10.1/node_modules/@tauri-apps/api/external/tslib/tslib.es6.js"() {} });

//#endregion
export { CODEX_AGENT_MODEL_ID, CODEX_AGENT_PROVIDER_ID, LEGACY_CLAUDE_AGENT_PROVIDER_ID, CodexAgentEngine as default, ephemeralChatId };