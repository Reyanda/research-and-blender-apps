(function (){"use strict";// build/release/tmp_modules/node/child_process.ts
var $, EventEmitter = @getInternalField(@internalModuleRegistry, 96) || @createInternalModuleById(96), OsModule = @getInternalField(@internalModuleRegistry, 105) || @createInternalModuleById(105), { kHandle } = @getInternalField(@internalModuleRegistry, 32) || @createInternalModuleById(32), {
  validateBoolean,
  validateFunction,
  validateString,
  validateAbortSignal,
  validateArray,
  validateObject,
  validateOneOf
} = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), NetModule, ObjectCreate = Object.create, ObjectAssign = Object.assign, BufferConcat = @Buffer.concat, BufferIsEncoding = @Buffer.isEncoding, kEmptyObject = ObjectCreate(null), signals = OsModule.constants.signals, ArrayPrototypeJoin = @Array.prototype.join, ArrayPrototypeIncludes = @Array.prototype.includes, ArrayPrototypeSlice = @Array.prototype.slice, ArrayPrototypeUnshift = @Array.prototype.unshift, ArrayPrototypeFilter = @Array.prototype.filter, ArrayPrototypeSort = @Array.prototype.sort, StringPrototypeToUpperCase = @String.prototype.toUpperCase, ArrayPrototypePush = @Array.prototype.push, ArrayPrototypeLastIndexOf = @Array.prototype.lastIndexOf, ArrayPrototypeSplice = @Array.prototype.splice, ArrayBufferIsView = @ArrayBuffer.isView, NumberIsInteger = Number.isInteger, StringPrototypeIncludes = @String.prototype.includes, Uint8ArrayPrototypeIncludes = @Uint8Array.prototype.includes, MAX_BUFFER = 1048576, kFromNode = Symbol("kFromNode");
function spawn(file, args, options) {
  options = normalizeSpawnArguments(file, args, options), validateTimeout(options.timeout), validateAbortSignal(options.signal, "options.signal");
  let killSignal = sanitizeKillSignal(options.killSignal), child = new ChildProcess;
  options[kFromNode] = !0, child.spawn(options);
  let timeout = options.timeout;
  if (timeout && timeout > 0) {
    let timeoutId = setTimeout(() => {
      if (timeoutId) {
        timeoutId = null;
        try {
          child.kill(killSignal);
        } catch (err) {
          child.emit("error", err);
        }
      }
    }, timeout).unref();
    child.once("exit", () => {
      if (timeoutId)
        clearTimeout(timeoutId), timeoutId = null;
    });
  }
  let signal = options.signal;
  if (signal) {
    let onAbortListener2 = function() {
      abortChildProcess(child, killSignal, signal.reason);
    };
    var onAbortListener = onAbortListener2;
    if (signal.aborted)
      process.nextTick(onAbortListener2);
    else
      signal.addEventListener("abort", onAbortListener2, { once: !0 }), child.once("exit", () => signal.removeEventListener("abort", onAbortListener2));
  }
  return child;
}
function execFile(file, args, options, callback) {
  ({ file, args, options, callback } = normalizeExecFileArgs(file, args, options, callback)), options = {
    __proto__: null,
    encoding: "utf8",
    timeout: 0,
    maxBuffer: MAX_BUFFER,
    killSignal: "SIGTERM",
    cwd: null,
    env: null,
    shell: !1,
    ...options
  };
  let maxBuffer = options.maxBuffer;
  validateTimeout(options.timeout), validateMaxBuffer(maxBuffer), options.killSignal = sanitizeKillSignal(options.killSignal);
  let child = spawn(file, args, {
    cwd: options.cwd,
    env: options.env,
    timeout: options.timeout,
    killSignal: options.killSignal,
    uid: options.uid,
    gid: options.gid,
    windowsHide: options.windowsHide,
    windowsVerbatimArguments: options.windowsVerbatimArguments,
    shell: options.shell,
    signal: options.signal
  }), encoding, _stdout = [], _stderr = [];
  if (options.encoding !== "buffer" && BufferIsEncoding(options.encoding))
    encoding = options.encoding;
  else
    encoding = null;
  let killed = !1, exited = !1, timeoutId, ex = null, cmd = file;
  function exitHandler(code = 0, signal) {
    if (exited)
      return;
    if (exited = !0, timeoutId)
      clearTimeout(timeoutId), timeoutId = null;
    if (!callback)
      return;
    let stdout, stderr;
    if (encoding || child.stdout?.readableEncoding)
      stdout = ArrayPrototypeJoin.@call(_stdout, "");
    else
      stdout = BufferConcat(_stdout);
    if (encoding || child.stderr?.readableEncoding)
      stderr = ArrayPrototypeJoin.@call(_stderr, "");
    else
      stderr = BufferConcat(_stderr);
    if (!ex && code === 0 && signal === null) {
      callback(null, stdout, stderr);
      return;
    }
    if (args?.length)
      cmd += ` ${ArrayPrototypeJoin.@call(args, " ")}`;
    if (!ex) {
      let { getSystemErrorName } = @getInternalField(@internalModuleRegistry, 126) || @createInternalModuleById(126), message = `Command failed: ${cmd}`;
      if (stderr)
        message += `
${stderr}`;
      ex = genericNodeError(message, {
        code: code < 0 ? getSystemErrorName(code) : code,
        killed: child.killed || killed,
        signal
      });
    }
    ex.cmd = cmd, callback(ex, stdout, stderr);
  }
  function errorHandler(e) {
    ex = e;
    let { stdout, stderr } = child;
    if (stdout)
      stdout.destroy();
    if (stderr)
      stderr.destroy();
    exitHandler();
  }
  function kill() {
    let { stdout, stderr } = child;
    if (stdout)
      stdout.destroy();
    if (stderr)
      stderr.destroy();
    killed = !0;
    try {
      child.kill(options.killSignal);
    } catch (e) {
      ex = e, exitHandler();
    }
  }
  if (options.timeout > 0)
    timeoutId = setTimeout(function delayedKill() {
      timeoutId = null, kill();
    }, options.timeout).unref();
  function addOnDataListener(child_buffer, _buffer, kind) {
    if (encoding)
      child_buffer.setEncoding(encoding);
    let totalLen = 0;
    if (maxBuffer === @Infinity) {
      child_buffer.on("data", function onDataNoMaxBuf(chunk) {
        @arrayPush(_buffer, chunk);
      });
      return;
    }
    child_buffer.on("data", function onData(chunk) {
      let encoding2 = child_buffer.readableEncoding;
      if (encoding2) {
        let length = @Buffer.byteLength(chunk, encoding2);
        if (totalLen += length, totalLen > maxBuffer) {
          let truncatedLen = maxBuffer - (totalLen - length);
          @arrayPush(_buffer, @String.prototype.slice.@call(chunk, 0, truncatedLen)), ex = @makeErrorWithCode(15, kind), kill();
        } else
          @arrayPush(_buffer, chunk);
      } else {
        let length = chunk.length;
        if (totalLen += length, totalLen > maxBuffer) {
          let truncatedLen = maxBuffer - (totalLen - length);
          @arrayPush(_buffer, chunk.slice(0, truncatedLen)), ex = @makeErrorWithCode(15, kind), kill();
        } else
          @arrayPush(_buffer, chunk);
      }
    });
  }
  if (child.stdout)
    addOnDataListener(child.stdout, _stdout, "stdout");
  if (child.stderr)
    addOnDataListener(child.stderr, _stderr, "stderr");
  return child.addListener("close", exitHandler), child.addListener("error", errorHandler), child;
}
function exec(command, options, callback) {
  let opts = normalizeExecArgs(command, options, callback);
  return execFile(opts.file, opts.options, opts.callback);
}
var kCustomPromisifySymbol = Symbol.for("nodejs.util.promisify.custom"), customPromiseExecFunction = (orig) => {
  return (...args) => {
    let { resolve, reject, promise } = @Promise.withResolvers();
    return promise.child = orig(...args, (err, stdout, stderr) => {
      if (err !== null)
        err.stdout = stdout, err.stderr = stderr, reject(err);
      else
        resolve({ stdout, stderr });
    }), promise;
  };
};
Object.defineProperty(exec, kCustomPromisifySymbol, {
  __proto__: null,
  configurable: !0,
  value: customPromiseExecFunction(exec)
});
exec[kCustomPromisifySymbol][kCustomPromisifySymbol] = exec[kCustomPromisifySymbol];
Object.defineProperty(execFile, kCustomPromisifySymbol, {
  __proto__: null,
  configurable: !0,
  value: customPromiseExecFunction(execFile)
});
execFile[kCustomPromisifySymbol][kCustomPromisifySymbol] = execFile[kCustomPromisifySymbol];
function spawnSync(file, args, options) {
  options = {
    __proto__: null,
    maxBuffer: MAX_BUFFER,
    ...normalizeSpawnArguments(file, args, options)
  };
  let { maxBuffer, encoding } = options;
  validateTimeout(options.timeout), validateMaxBuffer(maxBuffer), options.killSignal = sanitizeKillSignal(options.killSignal);
  let stdio = options.stdio || "pipe", bunStdio = getBunStdioFromOptions(stdio);
  var { input } = options;
  if (input)
    if (ArrayBufferIsView(input))
      bunStdio[0] = input;
    else if (typeof input === "string")
      bunStdio[0] = @Buffer.from(input, encoding || "utf8");
    else
      throw @makeErrorWithCode(118, "options.stdio[0]", ["string", "Buffer", "TypedArray", "DataView"], input);
  var error;
  try {
    var {
      stdout = null,
      stderr = null,
      exitCode,
      signalCode,
      exitedDueToTimeout,
      exitedDueToMaxBuffer,
      pid
    } = Bun.spawnSync({
      cmd: [options.file, ...@Array.prototype.slice.@call(options.args, 1)],
      env: options.env || @undefined,
      cwd: options.cwd || @undefined,
      stdio: bunStdio,
      windowsVerbatimArguments: options.windowsVerbatimArguments,
      windowsHide: options.windowsHide,
      argv0: options.args[0],
      timeout: options.timeout,
      killSignal: options.killSignal,
      maxBuffer: options.maxBuffer
    });
  } catch (err) {
    error = err, stdout = null, stderr = null;
  }
  let outputStdout = typeof stdout === "number" ? null : stdout, outputStderr = typeof stderr === "number" ? null : stderr, result = {
    signal: signalCode ?? null,
    status: exitCode,
    output: [null, outputStdout, outputStderr],
    pid
  };
  if (error)
    result.error = error;
  if (outputStdout && encoding && encoding !== "buffer")
    result.output[1] = result.output[1]?.toString(encoding);
  if (outputStderr && encoding && encoding !== "buffer")
    result.output[2] = result.output[2]?.toString(encoding);
  if (result.stdout = result.output[1], result.stderr = result.output[2], exitedDueToTimeout && error == null)
    result.error = new SystemError("spawnSync " + options.file + " ETIMEDOUT", options.file, "spawnSync " + options.file, etimedoutErrorCode(), "ETIMEDOUT");
  if (exitedDueToMaxBuffer && error == null)
    result.error = new SystemError("spawnSync " + options.file + " ENOBUFS (stdout or stderr buffer reached maxBuffer size limit)", options.file, "spawnSync " + options.file, enobufsErrorCode(), "ENOBUFS");
  if (result.error)
    result.error.syscall = "spawnSync " + options.file, result.error.spawnargs = ArrayPrototypeSlice.@call(options.args, 1);
  return result;
}
var etimedoutErrorCode = @lazy(43), enobufsErrorCode = @lazy(44);
function execFileSync(file, args, options) {
  ({ file, args, options } = normalizeExecFileArgs(file, args, options));
  let inheritStderr = !options.stdio, ret = spawnSync(file, args, options);
  if (inheritStderr && ret.stderr)
    process.stderr.write(ret.stderr);
  let errArgs = [options.argv0 || file];
  ArrayPrototypePush.@apply(errArgs, args);
  let err = checkExecSyncError(ret, errArgs);
  if (err)
    throw err;
  return ret.stdout;
}
function execSync(command, options) {
  let opts = normalizeExecArgs(command, options, null), inheritStderr = !opts.options.stdio, ret = spawnSync(opts.file, opts.options);
  if (inheritStderr && ret.stderr)
    process.stderr.write(ret.stderr);
  let err = checkExecSyncError(ret, @undefined, command);
  if (err)
    throw err;
  return ret.stdout;
}
function stdioStringToArray(stdio, channel) {
  let options;
  switch (stdio) {
    case "ignore":
    case "overlapped":
    case "pipe":
      options = [stdio, stdio, stdio];
      break;
    case "inherit":
      options = [0, 1, 2];
      break;
    default:
      throw @makeErrorWithCode(119, "stdio", stdio);
  }
  if (channel)
    @arrayPush(options, channel);
  return options;
}
function fork(modulePath, args = [], options) {
  if (modulePath = getValidatedPath(modulePath, "modulePath"), args == null)
    args = [];
  else if (typeof args === "object" && !@isJSArray(args))
    options = args, args = [];
  else
    validateArray(args, "args");
  if (options != null)
    validateObject(options, "options");
  options = { __proto__: null, ...options, shell: !1 }, options.execPath = options.execPath || process.execPath, validateArgumentNullCheck(options.execPath, "options.execPath");
  let execArgv = options.execArgv || process.execArgv;
  if (validateArgumentsNullCheck(execArgv, "options.execArgv"), execArgv === process.execArgv && process._eval != null) {
    let index = ArrayPrototypeLastIndexOf.@call(execArgv, process._eval);
    if (index > 0)
      execArgv = ArrayPrototypeSlice.@call(execArgv), ArrayPrototypeSplice.@call(execArgv, index - 1, 2);
  }
  if (args = [...execArgv, modulePath, ...args], typeof options.stdio === "string")
    options.stdio = stdioStringToArray(options.stdio, "ipc");
  else if (!@isJSArray(options.stdio))
    options.stdio = stdioStringToArray(options.silent ? "pipe" : "inherit", "ipc");
  else if (!ArrayPrototypeIncludes.@call(options.stdio, "ipc"))
    throw @makeErrorWithCode(14, "options.stdio");
  return spawn(options.execPath, args, options);
}
function convertToValidSignal(signal) {
  if (typeof signal === "number" && getSignalsToNamesMapping()[signal])
    return signal;
  if (typeof signal === "string") {
    let signalName = signals[StringPrototypeToUpperCase.@call(signal)];
    if (signalName)
      return signalName;
  }
  throw ERR_UNKNOWN_SIGNAL(signal);
}
function sanitizeKillSignal(killSignal) {
  if (typeof killSignal === "string" || typeof killSignal === "number")
    return convertToValidSignal(killSignal);
  else if (killSignal != null)
    throw @makeErrorWithCode(118, "options.killSignal", ["string", "number"], killSignal);
}
var signalsToNamesMapping;
function getSignalsToNamesMapping() {
  if (signalsToNamesMapping !== @undefined)
    return signalsToNamesMapping;
  signalsToNamesMapping = ObjectCreate(null);
  for (let key in signals)
    signalsToNamesMapping[signals[key]] = key;
  return signalsToNamesMapping;
}
function normalizeExecFileArgs(file, args, options, callback) {
  if (@isJSArray(args))
    args = ArrayPrototypeSlice.@call(args);
  else if (args != null && typeof args === "object")
    callback = options, options = args, args = null;
  else if (typeof args === "function")
    callback = args, options = null, args = null;
  if (args == null)
    args = [];
  if (typeof options === "function")
    callback = options;
  else if (options != null)
    validateObject(options, "options");
  if (options == null)
    options = kEmptyObject;
  if (callback != null)
    validateFunction(callback, "callback");
  if (options.argv0 != null)
    validateString(options.argv0, "options.argv0"), validateArgumentNullCheck(options.argv0, "options.argv0");
  return { file, args, options, callback };
}
function normalizeExecArgs(command, options, callback) {
  if (validateString(command, "command"), validateArgumentNullCheck(command, "command"), typeof options === "function")
    callback = options, options = @undefined;
  return options = { __proto__: null, ...options }, options.shell = typeof options.shell === "string" ? options.shell : !0, {
    file: command,
    options,
    callback
  };
}
var kBunEnv = Symbol("bunEnv");
function normalizeSpawnArguments(file, args, options) {
  if (validateString(file, "file"), validateArgumentNullCheck(file, "file"), file.length === 0)
    throw @makeErrorWithCode(119, "file", file, "cannot be empty");
  if (@isJSArray(args))
    args = ArrayPrototypeSlice.@call(args);
  else if (args == null)
    args = [];
  else if (typeof args !== "object")
    throw @makeErrorWithCode(118, "args", "object", args);
  else
    options = args, args = [];
  if (validateArgumentsNullCheck(args, "args"), options === @undefined)
    options = {};
  else
    validateObject(options, "options");
  options = { __proto__: null, ...options };
  let cwd = options.cwd;
  if (cwd != null)
    cwd = getValidatedPath(cwd, "options.cwd");
  if (options.detached != null)
    validateBoolean(options.detached, "options.detached");
  if (options.uid != null && !isInt32(options.uid))
    throw @makeErrorWithCode(118, "options.uid", "int32", options.uid);
  if (options.gid != null && !isInt32(options.gid))
    throw @makeErrorWithCode(118, "options.gid", "int32", options.gid);
  if (options.shell != null && typeof options.shell !== "boolean" && typeof options.shell !== "string")
    throw @makeErrorWithCode(118, "options.shell", ["boolean", "string"], options.shell);
  if (options.argv0 != null)
    validateString(options.argv0, "options.argv0"), validateArgumentNullCheck(options.argv0, "options.argv0");
  if (options.windowsHide != null)
    validateBoolean(options.windowsHide, "options.windowsHide");
  let { windowsVerbatimArguments } = options;
  if (windowsVerbatimArguments != null)
    validateBoolean(windowsVerbatimArguments, "options.windowsVerbatimArguments");
  if (options.shell) {
    validateArgumentNullCheck(options.shell, "options.shell");
    let command = ArrayPrototypeJoin.@call([file, ...args], " ");
    if (typeof options.shell === "string")
      file = options.shell;
    else
      file = "/bin/sh";
    args = ["-c", command];
  }
  if (typeof options.argv0 === "string")
    ArrayPrototypeUnshift.@call(args, options.argv0);
  else
    ArrayPrototypeUnshift.@call(args, file);
  let env = options.env || process.env, bunEnv = {}, envKeys = [];
  for (let key in env)
    ArrayPrototypePush.@call(envKeys, key);
  for (let key of envKeys) {
    let value = env[key];
    if (value !== @undefined)
      validateArgumentNullCheck(key, `options.env['${key}']`), validateArgumentNullCheck(value, `options.env['${key}']`), bunEnv[key] = value;
  }
  return {
    __proto__: null,
    ...options,
    args,
    cwd,
    detached: !!options.detached,
    [kBunEnv]: bunEnv,
    file,
    windowsHide: !!options.windowsHide,
    windowsVerbatimArguments: !!windowsVerbatimArguments,
    argv0: options.argv0
  };
}
function checkExecSyncError(ret, args, cmd) {
  let err;
  if (ret.error)
    err = ret.error, ObjectAssign(err, ret), delete err.error;
  else if (ret.status !== 0) {
    let msg = "Command failed: ";
    if (msg += cmd || ArrayPrototypeJoin.@call(args, " "), ret.stderr && ret.stderr.length > 0)
      msg += `
${ret.stderr.toString()}`;
    err = genericNodeError(msg, ret);
  }
  return err;
}
function parseEnvPairs(envPairs) {
  if (!envPairs)
    return @undefined;
  let resEnv = {};
  for (let line of envPairs) {
    let [key, ...value] = line.split("=", 2);
    resEnv[key] = value.join("=");
  }
  return resEnv;
}

class ChildProcess extends EventEmitter {
  #handle;
  #closesNeeded = 1;
  #closesGot = 0;
  signalCode = null;
  exitCode = null;
  spawnfile;
  spawnargs;
  pid;
  channel;
  killed = !1;
  [Symbol.dispose]() {
    if (!this.killed)
      this.kill();
  }
  #handleOnExit(exitCode, signalCode, err) {
    if (signalCode)
      this.signalCode = signalCode;
    else
      this.exitCode = exitCode;
    {
      if (this.#stdin)
        this.#stdin.destroy();
      else
        this.#stdioOptions[0] = "destroyed";
      if (err)
        this.#stdioOptions[1] = this.#stdioOptions[2] = "destroyed";
      let stdout = this.#stdout, stderr = this.#stderr;
      if (stdout === @undefined)
        this.#stdout = this.#getBunSpawnIo(1, this.#encoding, !0);
      else if (stdout && this.#stdioOptions[1] === "pipe" && !stdout?.destroyed)
        stdout.resume?.();
      if (stderr === @undefined)
        this.#stderr = this.#getBunSpawnIo(2, this.#encoding, !0);
      else if (stderr && this.#stdioOptions[2] === "pipe" && !stderr?.destroyed)
        stderr.resume?.();
    }
    if (err) {
      if (this.spawnfile)
        err.path = this.spawnfile;
      err.spawnargs = ArrayPrototypeSlice.@call(this.spawnargs, 1), err.pid = this.pid, this.emit("error", err);
    } else if (exitCode < 0) {
      let err2 = new SystemError(`Spawned process exited with error code: ${exitCode}`, @undefined, "spawn", "EUNKNOWN", "ERR_CHILD_PROCESS_UNKNOWN_ERROR");
      if (err2.pid = this.pid, this.spawnfile)
        err2.path = this.spawnfile;
      err2.spawnargs = ArrayPrototypeSlice.@call(this.spawnargs, 1), this.emit("error", err2);
    }
    this.emit("exit", this.exitCode, this.signalCode), this.#maybeClose();
  }
  #getBunSpawnIo(i, encoding, autoResume = !1) {
    let handle = this.#handle, io = this.#stdioOptions[i];
    switch (i) {
      case 0:
        switch (io) {
          case "pipe": {
            let stdin = handle?.stdin;
            if (!stdin) {
              let stream = new (@getInternalField(@internalModuleRegistry, 59) || @createInternalModuleById(59))({
                write(chunk, encoding2, callback) {
                  if (callback)
                    callback();
                  return !1;
                }
              });
              return stream.destroy(), stream;
            }
            let result = (@getInternalField(@internalModuleRegistry, 23) || @createInternalModuleById(23)).writableFromFileSink(stdin);
            return result.readable = !1, result;
          }
          case "inherit":
            return null;
          case "destroyed": {
            let stream = new (@getInternalField(@internalModuleRegistry, 59) || @createInternalModuleById(59))({
              write(chunk, encoding2, callback) {
                if (callback)
                  callback();
                return !1;
              }
            });
            return stream.destroy(), stream;
          }
          case "undefined":
            return @undefined;
          default:
            return null;
        }
      case 2:
      case 1:
        switch (io) {
          case "pipe": {
            let value = handle?.[fdToStdioName(i)];
            if (!value) {
              let stream = new (@getInternalField(@internalModuleRegistry, 55) || @createInternalModuleById(55))({ read() {} });
              return stream.destroy(), stream;
            }
            let pipe = (@getInternalField(@internalModuleRegistry, 51) || @createInternalModuleById(51)).constructNativeReadable(value, { encoding });
            if (this.#closesNeeded++, pipe.once("close", () => this.#maybeClose()), autoResume)
              pipe.resume();
            return pipe;
          }
          case "destroyed": {
            let stream = new (@getInternalField(@internalModuleRegistry, 55) || @createInternalModuleById(55))({ read() {} });
            return stream.destroy(), stream;
          }
          case "undefined":
            return @undefined;
          default:
            return null;
        }
      default:
        switch (io) {
          case "pipe":
            if (!NetModule)
              NetModule = @getInternalField(@internalModuleRegistry, 104) || @createInternalModuleById(104);
            let fd = handle && handle.stdio[i];
            if (!fd)
              return null;
            return NetModule.connect({ fd });
        }
        return null;
    }
  }
  #stdin;
  #stdout;
  #stderr;
  #stdioObject;
  #encoding;
  #stdioOptions;
  #createStdioObject() {
    let opts = this.#stdioOptions, length = opts.length, result = new @Array(length);
    for (let i = 0;i < length; i++) {
      let element = opts[i];
      if (element === "undefined")
        return @undefined;
      if (element !== "pipe") {
        result[i] = null;
        continue;
      }
      switch (i) {
        case 0:
          result[i] = this.stdin;
          continue;
        case 1:
          result[i] = this.stdout;
          continue;
        case 2:
          result[i] = this.stderr;
          continue;
        default:
          result[i] = this.#getBunSpawnIo(i, this.#encoding, !1);
          continue;
      }
    }
    return result;
  }
  get stdin() {
    return this.#stdin ??= this.#getBunSpawnIo(0, this.#encoding, !1);
  }
  get stdout() {
    return this.#stdout ??= this.#getBunSpawnIo(1, this.#encoding, !1);
  }
  get stderr() {
    return this.#stderr ??= this.#getBunSpawnIo(2, this.#encoding, !1);
  }
  get stdio() {
    return this.#stdioObject ??= this.#createStdioObject();
  }
  get connected() {
    let handle = this.#handle;
    if (handle === null)
      return !1;
    return handle.connected ?? !1;
  }
  get [kHandle]() {
    return this.#handle;
  }
  spawn(options) {
    validateObject(options, "options"), validateOneOf(options.serialization, "options.serialization", [@undefined, "json", "advanced"]);
    let serialization = options.serialization || "json", stdio = options.stdio || ["pipe", "pipe", "pipe"], bunStdio = getBunStdioFromOptions(stdio), has_ipc = @isJSArray(stdio) && stdio.includes("ipc");
    if (has_ipc) {
      if (options.envPairs !== @undefined)
        validateArray(options.envPairs, "options.envPairs");
    }
    var env = options[kBunEnv] || parseEnvPairs(options.envPairs) || process.env;
    let detachedOption = options.detached;
    this.#encoding = options.encoding || @undefined, this.#stdioOptions = bunStdio;
    let hasSocketsToEagerlyLoad = stdio.length >= 3;
    validateString(options.file, "options.file");
    var file = this.spawnfile = options.file, spawnargs;
    if (options.args === @undefined)
      spawnargs = this.spawnargs = [];
    else
      validateArray(options.args, "options.args"), spawnargs = this.spawnargs = options.args;
    try {
      if (this.#handle = Bun.spawn({
        cmd: [file, ...@Array.prototype.slice.@call(spawnargs, 1)],
        stdio: bunStdio,
        cwd: options.cwd || @undefined,
        env,
        detached: typeof detachedOption < "u" ? !!detachedOption : !1,
        onExit: (handle, exitCode, signalCode, err) => {
          if (this.#handle = handle, this.pid = this.#handle.pid, hasSocketsToEagerlyLoad)
            process.nextTick(() => {
              this.stdio;
            });
          process.nextTick((exitCode2, signalCode2, err2) => this.#handleOnExit(exitCode2, signalCode2, err2), exitCode, signalCode, err);
        },
        lazy: !0,
        ipc: has_ipc ? this.#emitIpcMessage.bind(this) : @undefined,
        onDisconnect: has_ipc ? (ok) => this.#onDisconnect(ok) : @undefined,
        serialization,
        argv0: spawnargs[0],
        windowsHide: !!options.windowsHide,
        windowsVerbatimArguments: !!options.windowsVerbatimArguments
      }), this.pid = this.#handle.pid, process.nextTick(() => {
        this.emit("spawn");
      }), has_ipc) {
        if (this.send = this.#send, this.disconnect = this.#disconnect, this.channel = new Control, Object.defineProperty(this, "_channel", {
          get() {
            return this.channel;
          },
          set(value) {
            this.channel = value;
          }
        }), options[kFromNode])
          this.#closesNeeded += 1;
      }
      if (hasSocketsToEagerlyLoad)
        for (let item of this.stdio)
          item?.ref?.();
    } catch (ex) {
      if (ex != null && typeof ex === "object" && Object.hasOwn(ex, "code") && (ex.code === "EACCES" || ex.code === "EAGAIN" || ex.code === "EMFILE" || ex.code === "ENFILE" || ex.code === "ENOENT")) {
        if (this.#handle = null, ex.syscall = "spawn " + this.spawnfile, ex.spawnargs = @Array.prototype.slice.@call(this.spawnargs, 1), process.nextTick(() => {
          this.emit("error", ex), this.emit("close", ex.errno ?? -1);
        }), ex.code === "EMFILE" || ex.code === "ENFILE")
          this.#stdioOptions[0] = "undefined", this.#stdioOptions[1] = "undefined", this.#stdioOptions[2] = "undefined";
      } else
        throw ex;
    }
  }
  #emitIpcMessage(message, _, handle) {
    this.emit("message", message, handle);
  }
  #send(message, handle, options, callback) {
    if (typeof handle === "function")
      callback = handle, handle = @undefined, options = @undefined;
    else if (typeof options === "function")
      callback = options, options = @undefined;
    else if (options !== @undefined) {
      if (typeof options !== "object" || options === null)
        throw @makeErrorWithCode(118, "options", "object", options);
    }
    if (!this.#handle) {
      if (callback)
        process.nextTick(callback, @makeTypeError("Process was closed while trying to send message"));
      else
        this.emit("error", @makeTypeError("Process was closed while trying to send message"));
      return !1;
    }
    return this.#handle.send(message, handle, options, (err) => {
      if (callback)
        callback(err);
      else if (err)
        this.emit("error", err);
    });
  }
  #onDisconnect(firstTime) {
    if (!firstTime)
      return;
    process.nextTick(() => this.emit("disconnect")), process.nextTick(() => this.#maybeClose());
  }
  #disconnect() {
    if (!this.connected) {
      this.emit("error", @makeErrorWithCode(144));
      return;
    }
    this.#handle.disconnect(), this.channel = null;
  }
  kill(sig) {
    let signal = sig === 0 ? sig : convertToValidSignal(sig === @undefined ? "SIGTERM" : sig), handle = this.#handle;
    if (handle) {
      if (handle.killed)
        return this.killed = !0, !0;
      try {
        return handle.kill(signal), this.killed = !0, !0;
      } catch (e) {
        this.emit("error", e);
      }
    }
    return !1;
  }
  #maybeClose() {
    if (this.#closesGot++, this.#closesGot === this.#closesNeeded)
      this.emit("close", this.exitCode, this.signalCode);
  }
  ref() {
    if (this.#handle)
      this.#handle.ref();
  }
  unref() {
    if (this.#handle)
      this.#handle.unref();
  }
  static {
    Object.defineProperties(this.prototype, {
      stdin: {
        get: function() {
          let value = this.#stdin ??= this.#getBunSpawnIo(0, this.#encoding, !1);
          return Object.defineProperty(this, "stdin", {
            value,
            enumerable: !0,
            configurable: !0,
            writable: !0
          }), value;
        },
        enumerable: !0,
        configurable: !0
      },
      stdout: {
        get: function() {
          let value = this.#stdout ??= this.#getBunSpawnIo(1, this.#encoding, !1);
          return Object.defineProperty(this, "stdout", {
            value,
            enumerable: !0,
            configurable: !0,
            writable: !0
          }), value;
        },
        enumerable: !0,
        configurable: !0
      },
      stderr: {
        get: function() {
          let value = this.#stderr ??= this.#getBunSpawnIo(2, this.#encoding, !1);
          return Object.defineProperty(this, "stderr", {
            value,
            enumerable: !0,
            configurable: !0,
            writable: !0
          }), value;
        },
        enumerable: !0,
        configurable: !0
      },
      stdio: {
        get: function() {
          let value = this.#stdioObject ??= this.#createStdioObject();
          return Object.defineProperty(this, "stdio", {
            value,
            enumerable: !0,
            configurable: !0,
            writable: !0
          }), value;
        },
        enumerable: !0,
        configurable: !0
      }
    });
  }
}
var nodeToBunLookup = {
  ignore: null,
  pipe: "pipe",
  overlapped: "pipe",
  inherit: "inherit",
  ipc: "ipc"
};
function nodeToBun(item, index) {
  if (item == null)
    return index > 2 ? "ignore" : "pipe";
  if (typeof item === "number")
    return item;
  if (isNodeStreamReadable(item)) {
    if (Object.hasOwn(item, "fd") && typeof item.fd === "number")
      return item.fd;
    if (item._handle && typeof item._handle.fd === "number")
      return item._handle.fd;
    throw new Error(`TODO: stream.Readable stdio @ ${index}`);
  }
  if (isNodeStreamWritable(item)) {
    if (Object.hasOwn(item, "fd") && typeof item.fd === "number")
      return item.fd;
    if (item._handle && typeof item._handle.fd === "number")
      return item._handle.fd;
    throw new Error(`TODO: stream.Writable stdio @ ${index}`);
  }
  let result = nodeToBunLookup[item];
  if (result === @undefined)
    throw new Error(`Invalid stdio option[${index}] "${item}"`);
  return result;
}
function isNodeStreamReadable(item) {
  if (typeof item !== "object")
    return !1;
  if (!item)
    return !1;
  if (typeof item.on !== "function")
    return !1;
  if (typeof item.pipe !== "function")
    return !1;
  return !0;
}
function isNodeStreamWritable(item) {
  if (typeof item !== "object")
    return !1;
  if (!item)
    return !1;
  if (typeof item.on !== "function")
    return !1;
  if (typeof item.write !== "function")
    return !1;
  return !0;
}
function fdToStdioName(fd) {
  switch (fd) {
    case 0:
      return "stdin";
    case 1:
      return "stdout";
    case 2:
      return "stderr";
    default:
      return null;
  }
}
function getBunStdioFromOptions(stdio) {
  let normalizedStdio = normalizeStdio(stdio);
  if (normalizedStdio.filter((v) => v === "ipc").length > 1)
    throw @makeErrorWithCode(145);
  return normalizedStdio.map(nodeToBun);
}
function normalizeStdio(stdio) {
  if (typeof stdio === "string")
    switch (stdio) {
      case "ignore":
        return ["ignore", "ignore", "ignore"];
      case "pipe":
        return ["pipe", "pipe", "pipe"];
      case "inherit":
        return ["inherit", "inherit", "inherit"];
      default:
        throw ERR_INVALID_OPT_VALUE("stdio", stdio);
    }
  else if (@isJSArray(stdio)) {
    let processedStdio;
    if (stdio.length === 0)
      processedStdio = ["pipe", "pipe", "pipe"];
    else if (stdio.length === 1)
      processedStdio = [stdio[0], "pipe", "pipe"];
    else if (stdio.length === 2)
      processedStdio = [stdio[0], stdio[1], "pipe"];
    else if (stdio.length >= 3)
      processedStdio = stdio;
    return processedStdio;
  } else
    throw ERR_INVALID_OPT_VALUE("stdio", stdio);
}
function abortChildProcess(child, killSignal, reason) {
  if (!child)
    return;
  try {
    if (child.kill(killSignal))
      child.emit("error", @makeAbortError(@undefined, { cause: reason }));
  } catch (err) {
    child.emit("error", err);
  }
}

class Control extends EventEmitter {
  constructor() {
    super();
  }
}
function validateMaxBuffer(maxBuffer) {
  if (maxBuffer != null && !(typeof maxBuffer === "number" && maxBuffer >= 0))
    throw @makeErrorWithCode(156, "options.maxBuffer", "a positive number", maxBuffer);
}
function validateArgumentNullCheck(arg, propName) {
  if (typeof arg === "string" && StringPrototypeIncludes.@call(arg, "\x00"))
    throw @makeErrorWithCode(119, propName, arg, "must be a string without null bytes");
}
function validateArgumentsNullCheck(args, propName) {
  for (let i = 0;i < args.length; ++i)
    validateArgumentNullCheck(args[i], `${propName}[${i}]`);
}
function validateTimeout(timeout) {
  if (timeout != null && !(NumberIsInteger(timeout) && timeout >= 0))
    throw @makeErrorWithCode(156, "timeout", "an unsigned integer", timeout);
}
function isInt32(value) {
  return value === (value | 0);
}
function nullCheck(path, propName, throwError = !0) {
  let pathIsString = typeof path === "string", pathIsUint8Array = isUint8Array(path);
  if (!pathIsString && !pathIsUint8Array || pathIsString && !StringPrototypeIncludes.@call(path, "\x00") || pathIsUint8Array && !Uint8ArrayPrototypeIncludes.@call(path, 0))
    return;
  let err = @makeErrorWithCode(119, propName, path, "must be a string or Uint8Array without null bytes");
  if (throwError)
    throw err;
  return err;
}
function validatePath(path, propName = "path") {
  if (typeof path !== "string" && !isUint8Array(path))
    throw @makeErrorWithCode(118, propName, ["string", "Buffer", "URL"], path);
  let err = nullCheck(path, propName, !1);
  if (err !== @undefined)
    throw err;
}
function getValidatedPath(fileURLOrPath, propName = "path") {
  let path = toPathIfFileURL(fileURLOrPath);
  return validatePath(path, propName), path;
}
function isUint8Array(value) {
  return typeof value === "object" && value !== null && value instanceof @Uint8Array;
}
function isURLInstance(fileURLOrPath) {
  return fileURLOrPath != null && fileURLOrPath.href && fileURLOrPath.origin;
}
function toPathIfFileURL(fileURLOrPath) {
  if (!isURLInstance(fileURLOrPath))
    return fileURLOrPath;
  return Bun.fileURLToPath(fileURLOrPath);
}
var { Error, TypeError } = globalThis;
function genericNodeError(message, errorProperties) {
  let err = new Error(message);
  return ObjectAssign(err, errorProperties), err;
}
function ERR_UNKNOWN_SIGNAL(name) {
  let err = @makeTypeError(`Unknown signal: ${name}`);
  return err.code = "ERR_UNKNOWN_SIGNAL", err;
}
function ERR_INVALID_OPT_VALUE(name, value) {
  let err = @makeTypeError(`The value "${value}" is invalid for option "${name}"`);
  return err.code = "ERR_INVALID_OPT_VALUE", err;
}

class SystemError extends Error {
  path;
  syscall;
  errno;
  code;
  constructor(message, path, syscall, errno, code) {
    super(message);
    this.path = path, this.syscall = syscall, this.errno = errno, this.code = code;
  }
  get name() {
    return "SystemError";
  }
}
$ = {
  ChildProcess,
  spawn,
  execFile,
  exec,
  fork,
  spawnSync,
  execFileSync,
  execSync
};
return $})

