(function (){"use strict";// build/release/tmp_modules/internal/streams/from.ts
var $, SymbolIterator = Symbol.iterator, SymbolAsyncIterator = Symbol.asyncIterator, PromisePrototypeThen = @Promise.prototype.@then;
function from(Readable, iterable, opts) {
  let iterator;
  if (typeof iterable === "string" || iterable instanceof @Buffer)
    return new Readable({
      objectMode: !0,
      ...opts,
      read() {
        this.push(iterable), this.push(null);
      }
    });
  let isAsync;
  if (iterable?.[SymbolAsyncIterator])
    isAsync = !0, iterator = iterable[SymbolAsyncIterator]();
  else if (iterable?.[SymbolIterator])
    isAsync = !1, iterator = iterable[SymbolIterator]();
  else
    throw @makeErrorWithCode(118, "iterable", ["Iterable"], iterable);
  let readable = new Readable({
    objectMode: !0,
    highWaterMark: 1,
    ...opts
  }), reading = !1, isAsyncValues = !1;
  readable._read = function() {
    if (!reading)
      if (reading = !0, isAsync)
        nextAsync();
      else if (isAsyncValues)
        nextSyncWithAsyncValues();
      else
        nextSyncWithSyncValues();
  }, readable._destroy = function(error, cb) {
    PromisePrototypeThen.@call(close(error), @isCallable(cb) ? () => process.nextTick(cb, error) : () => {}, @isCallable(cb) ? (e) => process.nextTick(cb, e || error) : () => {});
  };
  async function close(error) {
    let hadError = error !== @undefined && error !== null, hasThrow = typeof iterator.throw === "function";
    if (hadError && hasThrow) {
      let { value, done } = await iterator.throw(error);
      if (await value, done)
        return;
    }
    if (typeof iterator.return === "function") {
      let { value } = await iterator.return();
      await value;
    }
  }
  function nextSyncWithSyncValues() {
    for (;; ) {
      try {
        let { value, done } = iterator.next();
        if (done) {
          readable.push(null);
          return;
        }
        if (value && typeof value.then === "function")
          return changeToAsyncValues(value);
        if (value === null)
          throw reading = !1, @makeErrorWithCode(229);
        if (readable.push(value))
          continue;
        reading = !1;
      } catch (err) {
        readable.destroy(err);
      }
      break;
    }
  }
  async function changeToAsyncValues(value) {
    isAsyncValues = !0;
    try {
      let res = await value;
      if (res === null)
        throw reading = !1, @makeErrorWithCode(229);
      if (readable.push(res)) {
        nextSyncWithAsyncValues();
        return;
      }
      reading = !1;
    } catch (err) {
      readable.destroy(err);
    }
  }
  async function nextSyncWithAsyncValues() {
    for (;; ) {
      try {
        let { value, done } = iterator.next();
        if (done) {
          readable.push(null);
          return;
        }
        let res = value && typeof value.then === "function" ? await value : value;
        if (res === null)
          throw reading = !1, @makeErrorWithCode(229);
        if (readable.push(res))
          continue;
        reading = !1;
      } catch (err) {
        readable.destroy(err);
      }
      break;
    }
  }
  async function nextAsync() {
    for (;; ) {
      try {
        let { value, done } = await iterator.next();
        if (done) {
          readable.push(null);
          return;
        }
        if (value === null)
          throw reading = !1, @makeErrorWithCode(229);
        if (readable.push(value))
          continue;
        reading = !1;
      } catch (err) {
        readable.destroy(err);
      }
      break;
    }
  }
  return readable;
}
$ = from;
return $})

