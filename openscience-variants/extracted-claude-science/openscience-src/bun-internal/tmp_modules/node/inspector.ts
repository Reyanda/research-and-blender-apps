(function (){"use strict";// build/release/tmp_modules/node/inspector.ts
var $, { hideFromStack, throwNotImplemented } = @getInternalField(@internalModuleRegistry, 32) || @createInternalModuleById(32), EventEmitter = @getInternalField(@internalModuleRegistry, 96) || @createInternalModuleById(96), startCPUProfiler = @lazy(57), stopCPUProfiler = @lazy(58), setCPUSamplingInterval = @lazy(59), isCPUProfilerRunning = @lazy(60);
function open() {
  throwNotImplemented("node:inspector", 2445);
}
function close() {
  throwNotImplemented("node:inspector", 2445);
}
function url() {
  return @undefined;
}
function waitForDebugger() {
  throwNotImplemented("node:inspector", 2445);
}

class Session extends EventEmitter {
  #connected = !1;
  #profilerEnabled = !1;
  connect() {
    if (this.#connected)
      throw Error("Session is already connected");
    this.#connected = !0;
  }
  connectToMainThread() {
    this.connect();
  }
  disconnect() {
    if (!this.#connected)
      return;
    if (isCPUProfilerRunning())
      stopCPUProfiler();
    this.#profilerEnabled = !1, this.#connected = !1;
  }
  post(method, params, callback) {
    if (typeof params === "function")
      callback = params, params = @undefined;
    if (!this.#connected) {
      let error = Error("Session is not connected");
      if (callback) {
        queueMicrotask(() => callback(error));
        return;
      }
      throw error;
    }
    let result = this.#handleMethod(method, params);
    if (callback)
      queueMicrotask(() => {
        if (result instanceof Error)
          callback(result, @undefined);
        else
          callback(null, result);
      });
    else {
      if (result instanceof Error)
        throw result;
      return result;
    }
  }
  #handleMethod(method, params) {
    switch (method) {
      case "Profiler.enable":
        return this.#profilerEnabled = !0, {};
      case "Profiler.disable":
        if (isCPUProfilerRunning())
          stopCPUProfiler();
        return this.#profilerEnabled = !1, {};
      case "Profiler.start":
        if (!this.#profilerEnabled)
          return Error("Profiler is not enabled. Call Profiler.enable first.");
        if (!isCPUProfilerRunning())
          startCPUProfiler();
        return {};
      case "Profiler.stop":
        if (!isCPUProfilerRunning())
          return Error("Profiler is not started. Call Profiler.start first.");
        try {
          return { profile: JSON.parse(stopCPUProfiler()) };
        } catch (e) {
          return Error(`Failed to parse profile JSON: ${e}`);
        }
      case "Profiler.setSamplingInterval": {
        if (isCPUProfilerRunning())
          return Error("Cannot change sampling interval while profiler is running");
        let interval = params?.interval;
        if (typeof interval !== "number" || interval <= 0)
          return Error("interval must be a positive number");
        return setCPUSamplingInterval(interval), {};
      }
      case "Profiler.getBestEffortCoverage":
      case "Profiler.startPreciseCoverage":
      case "Profiler.stopPreciseCoverage":
      case "Profiler.takePreciseCoverage":
        return Error("Coverage APIs are not supported");
      default:
        return Error(`Inspector method "${method}" is not supported`);
    }
  }
}
var console = {
  ...globalThis.console,
  context: {
    console: globalThis.console
  }
};
$ = {
  console,
  open,
  close,
  url,
  waitForDebugger,
  Session
};
hideFromStack(open, close, url, waitForDebugger, Session.prototype.constructor);
return $})

