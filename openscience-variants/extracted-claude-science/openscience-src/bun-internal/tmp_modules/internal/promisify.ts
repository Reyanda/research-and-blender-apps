(function (){"use strict";// build/release/tmp_modules/internal/promisify.ts
var $, kCustomPromisifiedSymbol = Symbol.for("nodejs.util.promisify.custom"), kCustomPromisifyArgsSymbol = Symbol("customPromisifyArgs"), { validateFunction } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68);
function defineCustomPromisify(target, callback) {
  return Object.defineProperty(target, kCustomPromisifiedSymbol, {
    value: callback,
    configurable: !0
  }), callback;
}
function defineCustomPromisifyArgs(target, args) {
  return Object.defineProperty(target, kCustomPromisifyArgsSymbol, {
    value: args,
    enumerable: !1
  }), args;
}
var promisify = function promisify2(original) {
  validateFunction(original, "original");
  let custom = original[kCustomPromisifiedSymbol];
  if (custom)
    return validateFunction(custom, "custom"), defineCustomPromisify(custom, custom);
  let callbackArgs = original[kCustomPromisifyArgsSymbol];
  function fn(...originalArgs) {
    let { promise, resolve, reject } = @Promise.withResolvers();
    try {
      let maybePromise = original.@apply(this, [
        ...originalArgs,
        function(err, ...values) {
          if (err)
            return reject(err);
          if (callbackArgs !== @undefined) {
            let result = {};
            for (let i = 0;i < callbackArgs.length; i++)
              result[callbackArgs[i]] = values[i];
            resolve(result);
          } else
            resolve(values[0]);
        }
      ]);
      if (@isPromise(maybePromise))
        process.emitWarning("Calling promisify on a function that returns a Promise is likely a mistake.", "DeprecationWarning", "DEP0174");
    } catch (err) {
      reject(err);
    }
    return promise;
  }
  return Object.setPrototypeOf(fn, Object.getPrototypeOf(original)), defineCustomPromisify(fn, fn), Object.defineProperties(fn, Object.getOwnPropertyDescriptors(original));
};
promisify.custom = kCustomPromisifiedSymbol;
{
  let { setTimeout: timeout, setImmediate: immediate, setInterval: interval } = globalThis, {
    setTimeout: timeoutPromise,
    setImmediate: immediatePromise,
    setInterval: intervalPromise
  } = @getInternalField(@internalModuleRegistry, 120) || @createInternalModuleById(120);
  if (timeout && @isCallable(timeout))
    defineCustomPromisify(timeout, timeoutPromise);
  if (immediate && @isCallable(immediate))
    defineCustomPromisify(immediate, immediatePromise);
  if (interval && @isCallable(interval))
    defineCustomPromisify(interval, intervalPromise);
}
$ = {
  defineCustomPromisify,
  defineCustomPromisifyArgs,
  promisify
};
return $})

