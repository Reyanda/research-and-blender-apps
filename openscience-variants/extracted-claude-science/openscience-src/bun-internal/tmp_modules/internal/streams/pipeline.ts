(function (){"use strict";// build/release/tmp_modules/internal/streams/pipeline.ts
var $, eos = @getInternalField(@internalModuleRegistry, 47) || @createInternalModuleById(47), { once } = @getInternalField(@internalModuleRegistry, 32) || @createInternalModuleById(32), destroyImpl = @getInternalField(@internalModuleRegistry, 43) || @createInternalModuleById(43), Duplex = @getInternalField(@internalModuleRegistry, 44) || @createInternalModuleById(44), { aggregateTwoErrors } = @getInternalField(@internalModuleRegistry, 16) || @createInternalModuleById(16), { validateFunction, validateAbortSignal } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), {
  isIterable,
  isReadable,
  isReadableNodeStream,
  isNodeStream,
  isTransformStream,
  isWebStream,
  isReadableStream,
  isReadableFinished
} = @getInternalField(@internalModuleRegistry, 58) || @createInternalModuleById(58), SymbolAsyncIterator = Symbol.asyncIterator, ArrayIsArray = @Array.isArray, SymbolDispose = Symbol.dispose, PassThrough, Readable, addAbortListener;
function destroyer(stream, reading, writing) {
  let finished = !1;
  stream.on("close", () => {
    finished = !0;
  });
  let cleanup = eos(stream, { readable: reading, writable: writing }, (err) => {
    finished = !err;
  });
  return {
    destroy: (err) => {
      if (finished)
        return;
      finished = !0, destroyImpl.destroyer(stream, err || @makeErrorWithCode(228, "pipe"));
    },
    cleanup
  };
}
function popCallback(streams) {
  return validateFunction(streams[streams.length - 1], "streams[stream.length - 1]"), streams.pop();
}
function makeAsyncIterable(val) {
  if (isIterable(val))
    return val;
  else if (isReadableNodeStream(val))
    return fromReadable(val);
  throw @makeErrorWithCode(118, "val", ["Readable", "Iterable", "AsyncIterable"], val);
}
async function* fromReadable(val) {
  Readable ??= @getInternalField(@internalModuleRegistry, 55) || @createInternalModuleById(55), yield* Readable.prototype[SymbolAsyncIterator].@call(val);
}
async function pumpToNode(iterable, writable, finish, { end }) {
  let error, onresolve = null, resume = (err) => {
    if (err)
      error = err;
    if (onresolve) {
      let callback = onresolve;
      onresolve = null, callback();
    }
  }, wait = () => new @Promise((resolve, reject) => {
    if (error)
      reject(error);
    else
      onresolve = () => {
        if (error)
          reject(error);
        else
          resolve();
      };
  });
  writable.on("drain", resume);
  let cleanup = eos(writable, { readable: !1 }, resume);
  try {
    if (writable.writableNeedDrain)
      await wait();
    for await (let chunk of iterable)
      if (!writable.write(chunk))
        await wait();
    if (end)
      writable.end(), await wait();
    finish();
  } catch (err) {
    finish(error !== err ? aggregateTwoErrors(error, err) : err);
  } finally {
    cleanup(), writable.off("drain", resume);
  }
}
async function pumpToWeb(readable, writable, finish, { end }) {
  if (isTransformStream(writable))
    writable = writable.writable;
  let writer = writable.getWriter();
  try {
    for await (let chunk of readable)
      await writer.ready, writer.write(chunk).catch(() => {});
    if (await writer.ready, end)
      await writer.close();
    finish();
  } catch (err) {
    try {
      await writer.abort(err), finish(err);
    } catch (err2) {
      finish(err2);
    }
  }
}
function pipeline(...streams) {
  return pipelineImpl(streams, once(popCallback(streams)));
}
function pipelineImpl(streams, callback, opts) {
  if (streams.length === 1 && ArrayIsArray(streams[0]))
    streams = streams[0];
  if (streams.length < 2)
    throw @makeErrorWithCode(150, "streams");
  let ac = new AbortController, signal = ac.signal, outerSignal = opts?.signal, lastStreamCleanup = [];
  validateAbortSignal(outerSignal, "options.signal");
  function abort() {
    finishImpl(@makeAbortError(@undefined, { cause: outerSignal?.reason }));
  }
  addAbortListener ??= (@getInternalField(@internalModuleRegistry, 3) || @createInternalModuleById(3)).addAbortListener;
  let disposable;
  if (outerSignal)
    disposable = addAbortListener(outerSignal, abort);
  let error, value, destroys = [], finishCount = 0;
  function finish(err) {
    finishImpl(err, --finishCount === 0);
  }
  function finishOnlyHandleError(err) {
    finishImpl(err, !1);
  }
  function finishImpl(err, final) {
    if (err && (!error || error.code === "ERR_STREAM_PREMATURE_CLOSE"))
      error = err;
    if (!error && !final)
      return;
    while (destroys.length)
      destroys.shift()?.(error);
    if (disposable?.[SymbolDispose](), ac.abort(), final) {
      if (!error)
        lastStreamCleanup.forEach((fn) => fn());
      process.nextTick(callback, error, value);
    }
  }
  let ret;
  for (let i = 0;i < streams.length; i++) {
    let stream = streams[i], reading = i < streams.length - 1, writing = i > 0, next = i + 1 < streams.length ? streams[i + 1] : null, end = reading || opts?.end !== !1, isLastStream = i === streams.length - 1;
    if (isNodeStream(stream)) {
      let onError2 = function(err) {
        if (err && err.name !== "AbortError" && err.code !== "ERR_STREAM_PREMATURE_CLOSE")
          finishOnlyHandleError(err);
      };
      var onError = onError2;
      if (next !== null && (next?.closed || next?.destroyed))
        throw @makeErrorWithCode(233);
      if (end) {
        let { destroy, cleanup } = destroyer(stream, reading, writing);
        if (destroys.push(destroy), isReadable(stream) && isLastStream)
          lastStreamCleanup.push(cleanup);
      }
      if (stream.on("error", onError2), isReadable(stream) && isLastStream)
        lastStreamCleanup.push(() => {
          stream.removeListener("error", onError2);
        });
    }
    if (i === 0)
      if (typeof stream === "function") {
        if (ret = stream({ signal }), !isIterable(ret))
          throw @makeErrorWithCode(134, "Iterable, AsyncIterable or Stream", "source", ret);
      } else if (isIterable(stream) || isReadableNodeStream(stream) || isTransformStream(stream))
        ret = stream;
      else
        ret = Duplex.from(stream);
    else if (typeof stream === "function") {
      if (isTransformStream(ret))
        ret = makeAsyncIterable(ret?.readable);
      else
        ret = makeAsyncIterable(ret);
      if (ret = stream(ret, { signal }), reading) {
        if (!isIterable(ret, !0))
          throw @makeErrorWithCode(134, "AsyncIterable", `transform[${i - 1}]`, ret);
      } else {
        PassThrough ??= @getInternalField(@internalModuleRegistry, 53) || @createInternalModuleById(53);
        let pt = new PassThrough({
          objectMode: !0
        }), then = ret?.then;
        if (typeof then === "function")
          finishCount++, then.@call(ret, (val) => {
            if (value = val, val != null)
              pt.write(val);
            if (end)
              pt.end();
            process.nextTick(finish);
          }, (err) => {
            pt.destroy(err), process.nextTick(finish, err);
          });
        else if (isIterable(ret, !0))
          finishCount++, pumpToNode(ret, pt, finish, { end });
        else if (isReadableStream(ret) || isTransformStream(ret)) {
          let toRead = ret.readable || ret;
          finishCount++, pumpToNode(toRead, pt, finish, { end });
        } else
          throw @makeErrorWithCode(134, "AsyncIterable or Promise", "destination", ret);
        ret = pt;
        let { destroy, cleanup } = destroyer(ret, !1, !0);
        if (destroys.push(destroy), isLastStream)
          lastStreamCleanup.push(cleanup);
      }
    } else if (isNodeStream(stream)) {
      if (isReadableNodeStream(ret)) {
        finishCount += 2;
        let cleanup = pipe(ret, stream, finish, finishOnlyHandleError, { end });
        if (isReadable(stream) && isLastStream)
          lastStreamCleanup.push(cleanup);
      } else if (isTransformStream(ret) || isReadableStream(ret)) {
        let toRead = ret.readable || ret;
        finishCount++, pumpToNode(toRead, stream, finish, { end });
      } else if (isIterable(ret))
        finishCount++, pumpToNode(ret, stream, finish, { end });
      else
        throw @makeErrorWithCode(118, "val", ["Readable", "Iterable", "AsyncIterable", "ReadableStream", "TransformStream"], ret);
      ret = stream;
    } else if (isWebStream(stream)) {
      if (isReadableNodeStream(ret))
        finishCount++, pumpToWeb(makeAsyncIterable(ret), stream, finish, { end });
      else if (isReadableStream(ret) || isIterable(ret))
        finishCount++, pumpToWeb(ret, stream, finish, { end });
      else if (isTransformStream(ret))
        finishCount++, pumpToWeb(ret.readable, stream, finish, { end });
      else
        throw @makeErrorWithCode(118, "val", ["Readable", "Iterable", "AsyncIterable", "ReadableStream", "TransformStream"], ret);
      ret = stream;
    } else
      ret = Duplex.from(stream);
  }
  if (signal?.aborted || outerSignal?.aborted)
    process.nextTick(abort);
  return ret;
}
function pipe(src, dst, finish, finishOnlyHandleError, { end }) {
  let ended = !1;
  if (dst.on("close", () => {
    if (!ended)
      finishOnlyHandleError(@makeErrorWithCode(230));
  }), src.pipe(dst, { end: !1 }), end) {
    let endFn2 = function() {
      ended = !0, dst.end();
    };
    var endFn = endFn2;
    if (isReadableFinished(src))
      process.nextTick(endFn2);
    else
      src.once("end", endFn2);
  } else
    finish();
  return eos(src, { readable: !0, writable: !1 }, (err) => {
    let rState = src._readableState;
    if (err && err.code === "ERR_STREAM_PREMATURE_CLOSE" && rState?.ended && !rState.errored && !rState.errorEmitted)
      src.once("end", finish).once("error", finish);
    else
      finish(err);
  }), eos(dst, { readable: !1, writable: !0 }, finish);
}
$ = { pipelineImpl, pipeline };
return $})

