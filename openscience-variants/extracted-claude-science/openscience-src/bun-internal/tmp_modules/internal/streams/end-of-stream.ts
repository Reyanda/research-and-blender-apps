(function (){"use strict";// build/release/tmp_modules/internal/streams/end-of-stream.ts
var $, { kEmptyObject, once } = @getInternalField(@internalModuleRegistry, 32) || @createInternalModuleById(32), { validateAbortSignal, validateFunction, validateObject, validateBoolean } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), {
  isClosed,
  isReadable,
  isReadableNodeStream,
  isReadableStream,
  isReadableFinished,
  isReadableErrored,
  isWritable,
  isWritableNodeStream,
  isWritableStream,
  isWritableFinished,
  isWritableErrored,
  isNodeStream,
  willEmitClose: _willEmitClose,
  kIsClosedPromise
} = @getInternalField(@internalModuleRegistry, 58) || @createInternalModuleById(58), SymbolDispose = Symbol.dispose, PromisePrototypeThen = @Promise.prototype.@then, addAbortListener, AsyncLocalStorage;
function isRequest(stream) {
  return stream.setHeader && typeof stream.abort === "function";
}
var nop = () => {};
function eos(stream, options, callback) {
  if (arguments.length === 2)
    callback = options, options = kEmptyObject;
  else if (options == null)
    options = kEmptyObject;
  else
    validateObject(options, "options");
  if (validateFunction(callback, "callback"), validateAbortSignal(options.signal, "options.signal"), AsyncLocalStorage ??= (@getInternalField(@internalModuleRegistry, 86) || @createInternalModuleById(86)).AsyncLocalStorage, callback = once(AsyncLocalStorage.bind(callback)), isReadableStream(stream) || isWritableStream(stream))
    return eosWeb(stream, options, callback);
  if (!isNodeStream(stream))
    throw @makeErrorWithCode(118, "stream", ["ReadableStream", "WritableStream", "Stream"], stream);
  let readable = options.readable ?? isReadableNodeStream(stream), writable = options.writable ?? isWritableNodeStream(stream), wState = stream._writableState, rState = stream._readableState, onlegacyfinish = () => {
    if (!stream.writable)
      onfinish();
  }, willEmitClose = _willEmitClose(stream) && isReadableNodeStream(stream) === readable && isWritableNodeStream(stream) === writable, writableFinished = isWritableFinished(stream, !1), onfinish = () => {
    if (writableFinished = !0, stream.destroyed)
      willEmitClose = !1;
    if (willEmitClose && (!stream.readable || readable))
      return;
    if (!readable || readableFinished)
      callback.@call(stream);
  }, readableFinished = isReadableFinished(stream, !1), onend = () => {
    if (readableFinished = !0, stream.destroyed)
      willEmitClose = !1;
    if (willEmitClose && (!stream.writable || writable))
      return;
    if (!writable || writableFinished)
      callback.@call(stream);
  }, onerror = (err) => {
    callback.@call(stream, err);
  }, closed = isClosed(stream), onclose = () => {
    closed = !0;
    let errored = isWritableErrored(stream) || isReadableErrored(stream);
    if (errored && typeof errored !== "boolean")
      return callback.@call(stream, errored);
    if (readable && !readableFinished && isReadableNodeStream(stream, !0)) {
      if (!isReadableFinished(stream, !1))
        return callback.@call(stream, @makeErrorWithCode(230));
    }
    if (writable && !writableFinished) {
      if (!isWritableFinished(stream, !1))
        return callback.@call(stream, @makeErrorWithCode(230));
    }
    callback.@call(stream);
  }, onclosed = () => {
    closed = !0;
    let errored = isWritableErrored(stream) || isReadableErrored(stream);
    if (errored && typeof errored !== "boolean")
      return callback.@call(stream, errored);
    callback.@call(stream);
  }, onrequest = () => {
    stream.req.on("finish", onfinish);
  };
  if (isRequest(stream)) {
    if (stream.on("complete", onfinish), !willEmitClose)
      stream.on("abort", onclose);
    if (stream.req)
      onrequest();
    else
      stream.on("request", onrequest);
  } else if (writable && !wState)
    stream.on("end", onlegacyfinish), stream.on("close", onlegacyfinish);
  if (!willEmitClose && typeof stream.aborted === "boolean")
    stream.on("aborted", onclose);
  if (stream.on("end", onend), stream.on("finish", onfinish), options.error !== !1)
    stream.on("error", onerror);
  if (stream.on("close", onclose), closed)
    process.nextTick(onclose);
  else if (wState?.errorEmitted || rState?.errorEmitted) {
    if (!willEmitClose)
      process.nextTick(onclosed);
  } else if (!readable && (!willEmitClose || isReadable(stream)) && (writableFinished || isWritable(stream) === !1) && (wState == null || wState.pendingcb === @undefined || wState.pendingcb === 0))
    process.nextTick(onclosed);
  else if (!writable && (!willEmitClose || isWritable(stream)) && (readableFinished || isReadable(stream) === !1))
    process.nextTick(onclosed);
  else if (rState && stream.req && stream.aborted)
    process.nextTick(onclosed);
  let cleanup = () => {
    if (callback = nop, stream.removeListener("aborted", onclose), stream.removeListener("complete", onfinish), stream.removeListener("abort", onclose), stream.removeListener("request", onrequest), stream.req)
      stream.req.removeListener("finish", onfinish);
    stream.removeListener("end", onlegacyfinish), stream.removeListener("close", onlegacyfinish), stream.removeListener("finish", onfinish), stream.removeListener("end", onend), stream.removeListener("error", onerror), stream.removeListener("close", onclose);
  };
  if (options.signal && !closed) {
    let abort = () => {
      let endCallback = callback;
      cleanup(), endCallback.@call(stream, @makeAbortError(@undefined, { cause: options.signal.reason }));
    };
    if (options.signal.aborted)
      process.nextTick(abort);
    else {
      addAbortListener ??= (@getInternalField(@internalModuleRegistry, 3) || @createInternalModuleById(3)).addAbortListener;
      let disposable = addAbortListener(options.signal, abort), originalCallback = callback;
      callback = once((...args) => {
        disposable[SymbolDispose](), originalCallback.@apply(stream, args);
      });
    }
  }
  return cleanup;
}
function eosWeb(stream, options, callback) {
  let isAborted = !1, abort = nop;
  if (options.signal)
    if (abort = () => {
      isAborted = !0, callback.@call(stream, @makeAbortError(@undefined, { cause: options.signal.reason }));
    }, options.signal.aborted)
      process.nextTick(abort);
    else {
      addAbortListener ??= (@getInternalField(@internalModuleRegistry, 3) || @createInternalModuleById(3)).addAbortListener;
      let disposable = addAbortListener(options.signal, abort), originalCallback = callback;
      callback = once((...args) => {
        disposable[SymbolDispose](), originalCallback.@apply(stream, args);
      });
    }
  let resolverFn = (...args) => {
    if (!isAborted)
      process.nextTick(() => callback.@apply(stream, args));
  };
  return PromisePrototypeThen.@call(stream[kIsClosedPromise].promise, resolverFn, resolverFn), nop;
}
function finished(stream, opts) {
  let autoCleanup = !1;
  if (opts === null)
    opts = kEmptyObject;
  if (opts?.cleanup)
    validateBoolean(opts.cleanup, "cleanup"), autoCleanup = opts.cleanup;
  return new @Promise((resolve, reject) => {
    let cleanup = eos(stream, opts, (err) => {
      if (autoCleanup)
        cleanup();
      if (err)
        reject(err);
      else
        resolve();
    });
  });
}
eos.finished = finished;
$ = eos;
return $})

