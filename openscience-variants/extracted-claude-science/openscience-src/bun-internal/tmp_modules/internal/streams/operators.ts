(function (){"use strict";// build/release/tmp_modules/internal/streams/operators.ts
var $, { validateAbortSignal, validateInteger, validateObject } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), { kWeakHandler, kResistStopPropagation } = @getInternalField(@internalModuleRegistry, 32) || @createInternalModuleById(32), { finished } = @getInternalField(@internalModuleRegistry, 47) || @createInternalModuleById(47), staticCompose = @getInternalField(@internalModuleRegistry, 42) || @createInternalModuleById(42), { addAbortSignalNoValidate } = @getInternalField(@internalModuleRegistry, 41) || @createInternalModuleById(41), { isWritable, isNodeStream } = @getInternalField(@internalModuleRegistry, 58) || @createInternalModuleById(58), MathFloor = Math.floor, PromiseResolve = @Promise.@resolve.bind(@Promise), PromiseReject = @Promise.@reject.bind(@Promise), PromisePrototypeThen = @Promise.prototype.@then, ArrayPrototypePush = @Array.prototype.push, NumberIsNaN = Number.isNaN, ObjectDefineProperty = Object.defineProperty, kEmpty = Symbol("kEmpty"), kEof = Symbol("kEof");
function compose(stream, options) {
  if (options != null)
    validateObject(options, "options");
  if (options?.signal != null)
    validateAbortSignal(options.signal, "options.signal");
  if (isNodeStream(stream) && !isWritable(stream))
    throw @makeErrorWithCode(119, "stream", stream, "must be writable");
  let composedStream = staticCompose(this, stream);
  if (options?.signal)
    addAbortSignalNoValidate(options.signal, composedStream);
  return composedStream;
}
function map(fn, options) {
  if (typeof fn !== "function")
    throw @makeErrorWithCode(118, "fn", ["Function", "AsyncFunction"], fn);
  if (options != null)
    validateObject(options, "options");
  if (options?.signal != null)
    validateAbortSignal(options.signal, "options.signal");
  let concurrency = 1;
  if (options?.concurrency != null)
    concurrency = MathFloor(options.concurrency);
  let highWaterMark = concurrency - 1;
  if (options?.highWaterMark != null)
    highWaterMark = MathFloor(options.highWaterMark);
  return validateInteger(concurrency, "options.concurrency", 1), validateInteger(highWaterMark, "options.highWaterMark", 0), highWaterMark += concurrency, async function* map() {
    let signal = @AbortSignal.any([options?.signal].filter(Boolean)), stream = this, queue = [], signalOpt = { signal }, next, resume, done = !1, cnt = 0;
    function onCatch() {
      done = !0, afterItemProcessed();
    }
    function afterItemProcessed() {
      cnt -= 1, maybeResume();
    }
    function maybeResume() {
      if (resume && !done && cnt < concurrency && queue.length < highWaterMark)
        resume(), resume = null;
    }
    async function pump() {
      try {
        for await (let val of stream) {
          if (done)
            return;
          if (signal.aborted)
            throw @makeAbortError();
          try {
            if (val = fn(val, signalOpt), val === kEmpty)
              continue;
            val = PromiseResolve(val);
          } catch (err) {
            val = PromiseReject(err);
          }
          if (cnt += 1, PromisePrototypeThen.@call(val, afterItemProcessed, onCatch), queue.push(val), next)
            next(), next = null;
          if (!done && (queue.length >= highWaterMark || cnt >= concurrency))
            await new @Promise((resolve) => {
              resume = resolve;
            });
        }
        queue.push(kEof);
      } catch (err) {
        let val = PromiseReject(err);
        PromisePrototypeThen.@call(val, afterItemProcessed, onCatch), queue.push(val);
      } finally {
        if (done = !0, next)
          next(), next = null;
      }
    }
    pump();
    try {
      while (!0) {
        while (queue.length > 0) {
          let val = await queue[0];
          if (val === kEof)
            return;
          if (signal.aborted)
            throw @makeAbortError();
          if (val !== kEmpty)
            yield val;
          queue.shift(), maybeResume();
        }
        await new @Promise((resolve) => {
          next = resolve;
        });
      }
    } finally {
      if (done = !0, resume)
        resume(), resume = null;
    }
  }.@call(this);
}
async function some(fn, options = @undefined) {
  for await (let unused of filter.@call(this, fn, options))
    return !0;
  return !1;
}
async function every(fn, options = @undefined) {
  if (typeof fn !== "function")
    throw @makeErrorWithCode(118, "fn", ["Function", "AsyncFunction"], fn);
  return !await some.@call(this, async (...args) => {
    return !await fn(...args);
  }, options);
}
async function find(fn, options) {
  for await (let result of filter.@call(this, fn, options))
    return result;
  return @undefined;
}
async function forEach(fn, options) {
  if (typeof fn !== "function")
    throw @makeErrorWithCode(118, "fn", ["Function", "AsyncFunction"], fn);
  async function forEachFn(value, options2) {
    return await fn(value, options2), kEmpty;
  }
  for await (let unused of map.@call(this, forEachFn, options))
    ;
}
function filter(fn, options) {
  if (typeof fn !== "function")
    throw @makeErrorWithCode(118, "fn", ["Function", "AsyncFunction"], fn);
  async function filterFn(value, options2) {
    if (await fn(value, options2))
      return value;
    return kEmpty;
  }
  return map.@call(this, filterFn, options);
}

class ReduceAwareErrMissingArgs extends TypeError {
  constructor() {
    super("reduce");
    this.code = "ERR_MISSING_ARGS", this.message = "Reduce of an empty stream requires an initial value";
  }
}
async function reduce(reducer, initialValue, options) {
  if (typeof reducer !== "function")
    throw @makeErrorWithCode(118, "reducer", ["Function", "AsyncFunction"], reducer);
  if (options != null)
    validateObject(options, "options");
  if (options?.signal != null)
    validateAbortSignal(options.signal, "options.signal");
  let hasInitialValue = arguments.length > 1;
  if (options?.signal?.aborted) {
    let err = @makeAbortError(@undefined, { cause: options.signal.reason });
    throw this.once("error", () => {}), await finished(this.destroy(err)), err;
  }
  let ac = new AbortController, signal = ac.signal;
  if (options?.signal) {
    let opts = { once: !0, [kWeakHandler]: this, [kResistStopPropagation]: !0 };
    options.signal.addEventListener("abort", () => ac.abort(), opts);
  }
  let gotAnyItemFromStream = !1;
  try {
    for await (let value of this) {
      if (gotAnyItemFromStream = !0, options?.signal?.aborted)
        throw @makeAbortError();
      if (!hasInitialValue)
        initialValue = value, hasInitialValue = !0;
      else
        initialValue = await reducer(initialValue, value, { signal });
    }
    if (!gotAnyItemFromStream && !hasInitialValue)
      throw new ReduceAwareErrMissingArgs;
  } finally {
    ac.abort();
  }
  return initialValue;
}
async function toArray(options) {
  if (options != null)
    validateObject(options, "options");
  if (options?.signal != null)
    validateAbortSignal(options.signal, "options.signal");
  let result = [];
  for await (let val of this) {
    if (options?.signal?.aborted)
      throw @makeAbortError(@undefined, { cause: options.signal.reason });
    ArrayPrototypePush.@call(result, val);
  }
  return result;
}
function flatMap(fn, options) {
  let values = map.@call(this, fn, options);
  async function* flatMapInner() {
    for await (let val of values)
      yield* val;
  }
  return flatMapInner.@call(this);
}
function toIntegerOrInfinity(number) {
  if (number = Number(number), NumberIsNaN(number))
    return 0;
  if (number < 0)
    throw @makeErrorWithCode(156, "number", ">= 0", number);
  return number;
}
function drop(number, options) {
  if (options != null)
    validateObject(options, "options");
  if (options?.signal != null)
    validateAbortSignal(options.signal, "options.signal");
  return number = toIntegerOrInfinity(number), async function* drop() {
    if (options?.signal?.aborted)
      throw @makeAbortError();
    for await (let val of this) {
      if (options?.signal?.aborted)
        throw @makeAbortError();
      if (number-- <= 0)
        yield val;
    }
  }.@call(this);
}
ObjectDefineProperty(drop, "length", { value: 1 });
function take(number, options) {
  if (options != null)
    validateObject(options, "options");
  if (options?.signal != null)
    validateAbortSignal(options.signal, "options.signal");
  return number = toIntegerOrInfinity(number), async function* take() {
    if (options?.signal?.aborted)
      throw @makeAbortError();
    for await (let val of this) {
      if (options?.signal?.aborted)
        throw @makeAbortError();
      if (number-- > 0)
        yield val;
      if (number <= 0)
        return;
    }
  }.@call(this);
}
ObjectDefineProperty(take, "length", { value: 1 });
$ = {
  streamReturningOperators: {
    drop,
    filter,
    flatMap,
    map,
    take,
    compose
  },
  promiseReturningOperators: {
    every,
    forEach,
    reduce,
    toArray,
    some,
    find
  }
};
return $})

