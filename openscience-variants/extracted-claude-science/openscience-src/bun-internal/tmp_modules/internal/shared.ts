(function (){"use strict";// build/release/tmp_modules/internal/shared.ts
var $, { SafeArrayIterator } = @getInternalField(@internalModuleRegistry, 30) || @createInternalModuleById(30), ObjectFreeze = Object.freeze;

class NotImplementedError extends Error {
  code;
  constructor(feature, issue, extra) {
    super(feature + " is not yet implemented in Bun." + (issue ? " Track the status & thumbs up the issue: https://github.com/oven-sh/bun/issues/" + issue : "") + (extra ? ". " + extra : ""));
    this.name = "NotImplementedError", this.code = "ERR_NOT_IMPLEMENTED", hideFromStack(NotImplementedError);
  }
  get ["constructor"]() {
    return Error;
  }
}
function throwNotImplemented(feature, issue, extra) {
  throw hideFromStack(throwNotImplemented), new NotImplementedError(feature, issue, extra);
}
function hideFromStack(...fns) {
  for (let fn of fns)
    Object.defineProperty(fn, "name", {
      value: "::bunternal::"
    });
}
var warned;
function warnNotImplementedOnce(feature, issue) {
  if (!warned)
    warned = /* @__PURE__ */ new Set;
  if (warned.has(feature))
    return;
  warned.add(feature), console.warn(new NotImplementedError(feature, issue));
}
var util;

class ExceptionWithHostPort extends Error {
  errno;
  syscall;
  port;
  address;
  constructor(err, syscall, address, port) {
    util ??= @getInternalField(@internalModuleRegistry, 126) || @createInternalModuleById(126);
    let code = util.getSystemErrorName(err), details = "";
    if (port && port > 0)
      details = ` ${address}:${port}`;
    else if (address)
      details = ` ${address}`;
    super(`${syscall} ${code}${details}`);
    if (this.errno = err, this.code = code, this.syscall = syscall, this.address = address, port)
      this.port = port;
  }
  get ["constructor"]() {
    return Error;
  }
}

class NodeAggregateError extends AggregateError {
  constructor(errors, message) {
    super(new SafeArrayIterator(errors), message);
    this.code = errors[0]?.code;
  }
  get ["constructor"]() {
    return AggregateError;
  }
}

class ConnResetException extends Error {
  constructor(msg) {
    super(msg);
    this.code = "ECONNRESET";
  }
  get ["constructor"]() {
    return Error;
  }
}

class ErrnoException extends Error {
  errno;
  syscall;
  constructor(err, syscall, original) {
    util ??= @getInternalField(@internalModuleRegistry, 126) || @createInternalModuleById(126);
    let code = util.getSystemErrorName(err), message = original ? `${syscall} ${code} ${original}` : `${syscall} ${code}`;
    super(message);
    this.errno = err, this.code = code, this.syscall = syscall;
  }
  get ["constructor"]() {
    return Error;
  }
}
function once(callback, { preserveReturnValue = !1 } = kEmptyObject) {
  let called = !1, returnValue;
  return function(...args) {
    if (called)
      return returnValue;
    called = !0;
    let result = callback.@apply(this, args);
    return returnValue = preserveReturnValue ? result : @undefined, result;
  };
}
var kEmptyObject = ObjectFreeze(Object.create(null));
function getLazy(initializer) {
  let value, initialized = !1;
  return function() {
    if (initialized)
      return value;
    return value = initializer(), initialized = !0, value;
  };
}
$ = {
  NotImplementedError,
  throwNotImplemented,
  hideFromStack,
  warnNotImplementedOnce,
  ExceptionWithHostPort,
  NodeAggregateError,
  ConnResetException,
  ErrnoException,
  once,
  getLazy,
  kHandle: Symbol("kHandle"),
  kAutoDestroyed: Symbol("kAutoDestroyed"),
  kResistStopPropagation: Symbol("kResistStopPropagation"),
  kWeakHandler: Symbol("kWeak"),
  kGetNativeReadableProto: Symbol("kGetNativeReadableProto"),
  kEmptyObject
};
return $})

