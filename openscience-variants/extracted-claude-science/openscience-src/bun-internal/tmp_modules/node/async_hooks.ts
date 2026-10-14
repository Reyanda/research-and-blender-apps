(function (){"use strict";// build/release/tmp_modules/node/async_hooks.ts
var $, setAsyncHooksEnabled = @lazy(41), cleanupLater = @lazy(42), { validateFunction, validateString, validateObject } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68);
function get() {
  return @getInternalField(@asyncContext, 0);
}
function set(contextValue) {
  return @putInternalField(@asyncContext, 0, contextValue);
}

class AsyncLocalStorage {
  #disabled = !1;
  constructor() {
    setAsyncHooksEnabled(!0);
  }
  static bind(fn, ...args) {
    return validateFunction(fn), this.snapshot().bind(null, fn, ...args);
  }
  static snapshot() {
    var context = get();
    return (fn, ...args) => {
      var prev = get();
      set(context);
      try {
        return fn(...args);
      } finally {
        set(prev);
      }
    };
  }
  enterWith(store) {
    cleanupLater(), this.#disabled = !1;
    var context = get();
    if (!context) {
      set([this, store]);
      return;
    }
    var { length } = context;
    for (var i = 0;i < length; i += 2)
      if (context[i] === this) {
        let clone = context.slice();
        clone[i + 1] = store, set(clone);
        return;
      }
    set(context.concat(this, store));
  }
  exit(cb, ...args) {
    return this.run(@undefined, cb, ...args);
  }
  run(store_value, callback, ...args) {
    var context = get(), hasPrevious = !1, previous_value, i = 0, contextWasAlreadyInit = !context;
    let wasDisabled = this.#disabled;
    if (this.#disabled = !1, contextWasAlreadyInit)
      set(context = [this, store_value]);
    else {
      if (context = context.slice(), i = context.indexOf(this), i > -1)
        hasPrevious = !0, previous_value = context[i + 1], context[i + 1] = store_value;
      else
        i = context.length, context.push(this, store_value);
      set(context);
    }
    try {
      return callback(...args);
    } finally {
      if (!wasDisabled) {
        var context2 = get();
        if (context2 === context && contextWasAlreadyInit)
          set(@undefined);
        else if (context2 = context2.slice(), hasPrevious)
          context2[i + 1] = previous_value, set(context2);
        else
          context2.splice(i, 2), set(context2.length ? context2 : @undefined);
      }
    }
  }
  disable() {
    if (this.#disabled)
      return;
    this.#disabled = !0;
    var context = get();
    if (context) {
      var { length } = context;
      for (var i = 0;i < length; i += 2)
        if (context[i] === this) {
          context.splice(i, 2), set(context.length ? context : @undefined);
          break;
        }
    }
  }
  getStore() {
    if (this.#disabled)
      return;
    var context = get();
    if (!context)
      return;
    var { length } = context;
    for (var i = 0;i < length; i += 2)
      if (context[i] === this)
        return context[i + 1];
  }
  _enable() {}
  _propagate(_resource, _triggerResource, _type) {}
}

class AsyncResource {
  type;
  #snapshot;
  constructor(type, opts) {
    validateString(type, "type");
    let triggerAsyncId = opts;
    if (opts != null) {
      if (typeof opts !== "number")
        triggerAsyncId = opts.triggerAsyncId === @undefined ? 1 : opts.triggerAsyncId;
      if (!Number.isSafeInteger(triggerAsyncId) || triggerAsyncId < -1)
        throw @makeErrorWithCode(120, "triggerAsyncId", triggerAsyncId);
    }
    if (hasEnabledCreateHook && type.length === 0)
      throw @makeErrorWithCode(6, type);
    setAsyncHooksEnabled(!0), this.type = type, this.#snapshot = get();
  }
  emitBefore() {
    return !0;
  }
  emitAfter() {
    return !0;
  }
  asyncId() {
    return 0;
  }
  triggerAsyncId() {
    return 0;
  }
  emitDestroy() {}
  runInAsyncScope(fn, thisArg, ...args) {
    var prev = get();
    set(this.#snapshot);
    try {
      return fn.@apply(thisArg, args);
    } finally {
      set(prev);
    }
  }
  bind(fn, thisArg) {
    return validateFunction(fn, "fn"), this.runInAsyncScope.bind(this, fn, thisArg ?? this);
  }
  static bind(fn, type, thisArg) {
    return type = type || fn.name, new AsyncResource(type || "bound-anonymous-fn").bind(fn, thisArg);
  }
}
function createWarning(message, isCreateHook) {
  let warned = !1;
  var wrapped = function(arg1) {
    if (warned || !Bun.env.BUN_FEATURE_FLAG_VERBOSE_WARNINGS && (warned = !0))
      return;
    let known_supported_modules = [
      "zx/build/core.js",
      "datadog-core/src/storage/async_resource.js"
    ], e = Error().stack;
    if (known_supported_modules.some((m) => e.includes(m)))
      return;
    if (isCreateHook && arg1) {
      if (typeof arg1 === "object") {
        let { init, promiseResolve, destroy } = arg1;
        if (init && promiseResolve && destroy) {
          if (isEmptyFunction(init) && isEmptyFunction(destroy))
            return;
        }
      }
    }
    warned = !0, console.warn("[bun] Warning:", message);
  };
  return wrapped;
}
function isEmptyFunction(f) {
  let str = f.toString();
  if (!str.startsWith("function()"))
    return !1;
  return str = str.slice(10).trim(), /^{\s*}$/.test(str);
}
var createHookNotImpl = createWarning("async_hooks.createHook is not implemented in Bun. Hooks can still be created but will never be called.", !0), hasEnabledCreateHook = !1;
function createHook(hook) {
  validateObject(hook, "hook");
  let { init, before, after, destroy, promiseResolve } = hook;
  if (init !== @undefined && typeof init !== "function")
    throw @makeErrorWithCode(5, "hook.init");
  if (before !== @undefined && typeof before !== "function")
    throw @makeErrorWithCode(5, "hook.before");
  if (after !== @undefined && typeof after !== "function")
    throw @makeErrorWithCode(5, "hook.after");
  if (destroy !== @undefined && typeof destroy !== "function")
    throw @makeErrorWithCode(5, "hook.destroy");
  if (promiseResolve !== @undefined && typeof promiseResolve !== "function")
    throw @makeErrorWithCode(5, "hook.promiseResolve");
  return {
    enable() {
      return createHookNotImpl(hook), hasEnabledCreateHook = !0, this;
    },
    disable() {
      return createHookNotImpl(), this;
    }
  };
}
var executionAsyncIdNotImpl = createWarning("async_hooks.executionAsyncId/triggerAsyncId are not implemented in Bun. It will return 0 every time.");
function executionAsyncId() {
  return executionAsyncIdNotImpl(), 0;
}
function triggerAsyncId() {
  return 0;
}
var executionAsyncResourceWarning = createWarning("async_hooks.executionAsyncResource is not implemented in Bun. It returns a reference to process.stdin every time.");
function executionAsyncResource() {
  return executionAsyncResourceWarning(), process.stdin;
}
var asyncWrapProviders = {
  NONE: 0,
  DIRHANDLE: 1,
  DNSCHANNEL: 2,
  ELDHISTOGRAM: 3,
  FILEHANDLE: 4,
  FILEHANDLECLOSEREQ: 5,
  FIXEDSIZEBLOBCOPY: 6,
  FSEVENTWRAP: 7,
  FSREQCALLBACK: 8,
  FSREQPROMISE: 9,
  GETADDRINFOREQWRAP: 10,
  GETNAMEINFOREQWRAP: 11,
  HEAPSNAPSHOT: 12,
  HTTP2SESSION: 13,
  HTTP2STREAM: 14,
  HTTP2PING: 15,
  HTTP2SETTINGS: 16,
  HTTPINCOMINGMESSAGE: 17,
  HTTPCLIENTREQUEST: 18,
  JSSTREAM: 19,
  JSUDPWRAP: 20,
  MESSAGEPORT: 21,
  PIPECONNECTWRAP: 22,
  PIPESERVERWRAP: 23,
  PIPEWRAP: 24,
  PROCESSWRAP: 25,
  PROMISE: 26,
  QUERYWRAP: 27,
  SHUTDOWNWRAP: 28,
  SIGNALWRAP: 29,
  STATWATCHER: 30,
  STREAMPIPE: 31,
  TCPCONNECTWRAP: 32,
  TCPSERVERWRAP: 33,
  TCPWRAP: 34,
  TTYWRAP: 35,
  UDPSENDWRAP: 36,
  UDPWRAP: 37,
  SIGINTWATCHDOG: 38,
  WORKER: 39,
  WORKERHEAPSNAPSHOT: 40,
  WRITEWRAP: 41,
  ZLIB: 42,
  CHECKPRIMEREQUEST: 43,
  PBKDF2REQUEST: 44,
  KEYPAIRGENREQUEST: 45,
  KEYGENREQUEST: 46,
  KEYEXPORTREQUEST: 47,
  CIPHERREQUEST: 48,
  DERIVEBITSREQUEST: 49,
  HASHREQUEST: 50,
  RANDOMBYTESREQUEST: 51,
  RANDOMPRIMEREQUEST: 52,
  SCRYPTREQUEST: 53,
  SIGNREQUEST: 54,
  TLSWRAP: 55,
  VERIFYREQUEST: 56,
  INSPECTORJSBINDING: 57
};
$ = {
  AsyncLocalStorage,
  createHook,
  executionAsyncId,
  triggerAsyncId,
  executionAsyncResource,
  asyncWrapProviders,
  AsyncResource
};
return $})

