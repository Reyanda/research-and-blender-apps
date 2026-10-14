(function (){"use strict";// build/release/tmp_modules/node/repl.ts
var $, { throwNotImplemented } = @getInternalField(@internalModuleRegistry, 32) || @createInternalModuleById(32), builtinModules = [
  "bun",
  "ffi",
  "assert",
  "assert/strict",
  "async_hooks",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "constants",
  "crypto",
  "dgram",
  "diagnostics_channel",
  "dns",
  "dns/promises",
  "domain",
  "events",
  "fs",
  "fs/promises",
  "http",
  "http2",
  "https",
  "inspector",
  "inspector/promises",
  "module",
  "net",
  "os",
  "path",
  "path/posix",
  "path/win32",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "readline/promises",
  "repl",
  "stream",
  "stream/consumers",
  "stream/promises",
  "stream/web",
  "string_decoder",
  "sys",
  "timers",
  "timers/promises",
  "tls",
  "trace_events",
  "tty",
  "url",
  "util",
  "util/types",
  "v8",
  "vm",
  "wasi",
  "worker_threads",
  "zlib",
  "node:test"
];
$ = {
  lines: [],
  context: globalThis,
  historyIndex: -1,
  cursor: 0,
  historySize: 1000,
  removeHistoryDuplicates: !1,
  crlfDelay: 100,
  completer: () => {
    throwNotImplemented("node:repl");
  },
  history: [],
  _initialPrompt: "> ",
  terminal: !0,
  input: new Proxy({}, {
    get() {
      throwNotImplemented("node:repl");
    },
    has: () => !1,
    ownKeys: () => [],
    getOwnPropertyDescriptor: () => @undefined,
    set() {
      throwNotImplemented("node:repl");
    }
  }),
  line: "",
  eval: () => {
    throwNotImplemented("node:repl");
  },
  isCompletionEnabled: !0,
  escapeCodeTimeout: 500,
  tabSize: 8,
  breakEvalOnSigint: !0,
  useGlobal: !0,
  underscoreAssigned: !1,
  last: @undefined,
  _domain: @undefined,
  allowBlockingCompletions: !1,
  useColors: !0,
  output: new Proxy({}, {
    get() {
      throwNotImplemented("node:repl");
    },
    has: () => !1,
    ownKeys: () => [],
    getOwnPropertyDescriptor: () => @undefined,
    set() {
      throwNotImplemented("node:repl");
    }
  }),
  _builtinLibs: builtinModules,
  builtinModules
};
return $})

