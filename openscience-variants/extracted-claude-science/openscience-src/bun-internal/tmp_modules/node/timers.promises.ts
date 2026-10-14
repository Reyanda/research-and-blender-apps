(function (){"use strict";// build/release/tmp_modules/node/timers.promises.ts
var $, { validateBoolean, validateAbortSignal, validateObject, validateNumber } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), symbolAsyncIterator = Symbol.asyncIterator, setImmediateGlobal = globalThis.setImmediate, setTimeoutGlobal = globalThis.setTimeout, setIntervalGlobal = globalThis.setInterval;
function asyncIterator({ next: nextFunction, return: returnFunction }) {
  let result = {};
  if (typeof nextFunction === "function")
    result.next = nextFunction;
  if (typeof returnFunction === "function")
    result.return = returnFunction;
  return result[symbolAsyncIterator] = function() {
    return this;
  }, result;
}
function setTimeout(after = 1, value, options = {}) {
  let arguments_ = [].concat(value ?? []);
  try {
    if (typeof after != "number")
      validateNumber(after, "delay");
  } catch (error) {
    return @Promise.@reject(error);
  }
  try {
    validateObject(options, "options");
  } catch (error) {
    return @Promise.@reject(error);
  }
  let { signal, ref: reference = !0 } = options;
  try {
    validateAbortSignal(signal, "options.signal");
  } catch (error) {
    return @Promise.@reject(error);
  }
  try {
    validateBoolean(reference, "options.ref");
  } catch (error) {
    return @Promise.@reject(error);
  }
  if (signal?.aborted)
    return @Promise.@reject(@makeAbortError(@undefined, { cause: signal.reason }));
  let onCancel, returnValue = new @Promise((resolve, reject) => {
    let timeout = setTimeoutGlobal(() => resolve(value), after, ...arguments_);
    if (!reference)
      timeout?.unref?.();
    if (signal)
      onCancel = () => {
        clearTimeout(timeout), reject(@makeAbortError(@undefined, { cause: signal.reason }));
      }, signal.addEventListener("abort", onCancel);
  });
  return typeof onCancel < "u" ? returnValue.finally(() => signal.removeEventListener("abort", onCancel)) : returnValue;
}
function setImmediate(value, options = {}) {
  try {
    validateObject(options, "options");
  } catch (error) {
    return @Promise.@reject(error);
  }
  let { signal, ref: reference = !0 } = options;
  try {
    validateAbortSignal(signal, "options.signal");
  } catch (error) {
    return @Promise.@reject(error);
  }
  try {
    validateBoolean(reference, "options.ref");
  } catch (error) {
    return @Promise.@reject(error);
  }
  if (signal?.aborted)
    return @Promise.@reject(@makeAbortError(@undefined, { cause: signal.reason }));
  let onCancel, returnValue = new @Promise((resolve, reject) => {
    let immediate = setImmediateGlobal(() => resolve(value));
    if (!reference)
      immediate?.unref?.();
    if (signal)
      onCancel = () => {
        clearImmediate(immediate), reject(@makeAbortError(@undefined, { cause: signal.reason }));
      }, signal.addEventListener("abort", onCancel);
  });
  return typeof onCancel < "u" ? returnValue.finally(() => signal.removeEventListener("abort", onCancel)) : returnValue;
}
function setInterval(after = 1, value, options = {}) {
  try {
    if (typeof after != "number")
      validateNumber(after, "delay");
  } catch (error) {
    return asyncIterator({
      next: function() {
        return @Promise.@reject(error);
      }
    });
  }
  try {
    validateObject(options, "options");
  } catch (error) {
    return asyncIterator({
      next: function() {
        return @Promise.@reject(error);
      }
    });
  }
  let { signal, ref: reference = !0 } = options;
  try {
    validateAbortSignal(signal, "options.signal");
  } catch (error) {
    return asyncIterator({
      next: function() {
        return @Promise.@reject(error);
      }
    });
  }
  try {
    validateBoolean(reference, "options.ref");
  } catch (error) {
    return asyncIterator({
      next: function() {
        return @Promise.@reject(error);
      }
    });
  }
  if (signal?.aborted)
    return asyncIterator({
      next: function() {
        return @Promise.@reject(@makeAbortError(@undefined, { cause: signal.reason }));
      }
    });
  let onCancel, interval;
  try {
    let notYielded = 0, callback;
    if (interval = setIntervalGlobal(() => {
      if (notYielded++, callback)
        callback(), callback = @undefined;
    }, after), !reference)
      interval?.unref?.();
    if (signal)
      onCancel = () => {
        if (clearInterval(interval), callback)
          callback(), callback = @undefined;
      }, signal.addEventListener("abort", onCancel);
    return asyncIterator({
      next: function() {
        return new @Promise((resolve, reject) => {
          if (!signal?.aborted)
            if (notYielded === 0)
              callback = resolve;
            else
              resolve();
          else if (notYielded === 0)
            reject(@makeAbortError(@undefined, { cause: signal.reason }));
          else
            resolve();
        }).then(() => {
          if (notYielded > 0)
            return notYielded = notYielded - 1, { done: !1, value };
          else if (signal?.aborted)
            throw @makeAbortError(@undefined, { cause: signal.reason });
          return { done: !0 };
        });
      },
      return: function() {
        return clearInterval(interval), signal?.removeEventListener("abort", onCancel), @Promise.@resolve({});
      }
    });
  } catch {
    return asyncIterator({
      next: function() {
        clearInterval(interval), signal?.removeEventListener("abort", onCancel);
      }
    });
  }
}
$ = {
  setTimeout,
  setImmediate,
  setInterval,
  scheduler: {
    wait: (delay, options) => setTimeout(delay, @undefined, options),
    yield: setImmediate
  }
};
return $})

