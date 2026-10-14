(function (){"use strict";// build/release/tmp_modules/internal/webstreams_adapters.ts
var $, {
  SafePromiseAll,
  SafeSet,
  TypedArrayPrototypeGetBuffer,
  TypedArrayPrototypeGetByteOffset,
  TypedArrayPrototypeGetByteLength
} = @getInternalField(@internalModuleRegistry, 30) || @createInternalModuleById(30), Writable = @getInternalField(@internalModuleRegistry, 59) || @createInternalModuleById(59), Readable = @getInternalField(@internalModuleRegistry, 55) || @createInternalModuleById(55), Duplex = @getInternalField(@internalModuleRegistry, 44) || @createInternalModuleById(44), { destroyer } = @getInternalField(@internalModuleRegistry, 43) || @createInternalModuleById(43), { isDestroyed, isReadable, isWritable, isWritableEnded } = @getInternalField(@internalModuleRegistry, 58) || @createInternalModuleById(58), { kEmptyObject } = @getInternalField(@internalModuleRegistry, 32) || @createInternalModuleById(32), { validateBoolean, validateObject } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), finished = @getInternalField(@internalModuleRegistry, 47) || @createInternalModuleById(47), normalizeEncoding = @lazy(37), ArrayPrototypeFilter = @Array.prototype.filter, ArrayPrototypeMap = @Array.prototype.map, ObjectEntries = Object.entries, PromiseWithResolvers = @Promise.withResolvers.bind(@Promise), PromiseResolve = @Promise.@resolve.bind(@Promise), PromisePrototypeThen = @Promise.prototype.@then, SafePromisePrototypeFinally = @Promise.prototype.finally, constants_zlib = @processBindingConstants.zlib;
function tryTransferToNativeReadable(stream, options) {
  let ptr = stream.@bunNativePtr;
  if (!ptr || ptr === -1)
    return @undefined;
  return (@getInternalField(@internalModuleRegistry, 51) || @createInternalModuleById(51)).constructNativeReadable(stream, options);
}

class ReadableFromWeb extends Readable {
  #reader;
  #closed;
  #pendingChunks;
  #stream;
  constructor(options, stream) {
    let { objectMode, highWaterMark, encoding, signal } = options;
    super({
      objectMode,
      highWaterMark,
      encoding,
      signal
    });
    this.#pendingChunks = [], this.#reader = @undefined, this.#stream = stream, this.#closed = !1;
  }
  #drainPending() {
    var pendingChunks = this.#pendingChunks, pendingChunksI = 0, pendingChunksCount = pendingChunks.length;
    for (;pendingChunksI < pendingChunksCount; pendingChunksI++) {
      let chunk = pendingChunks[pendingChunksI];
      if (pendingChunks[pendingChunksI] = @undefined, !this.push(chunk, @undefined))
        return this.#pendingChunks = pendingChunks.slice(pendingChunksI + 1), !0;
    }
    if (pendingChunksCount > 0)
      this.#pendingChunks = [];
    return !1;
  }
  #handleDone(reader) {
    reader.releaseLock(), this.#reader = @undefined, this.#closed = !0, this.push(null);
    return;
  }
  async _read() {
    var stream = this.#stream, reader = this.#reader;
    if (stream)
      reader = this.#reader = stream.getReader(), this.#stream = @undefined;
    else if (this.#drainPending())
      return;
    var deferredError;
    try {
      do {
        var done = !1, value;
        let firstResult = reader.readMany();
        if (@isPromise(firstResult)) {
          if ({ done, value } = await firstResult, this.#closed) {
            this.#pendingChunks.push(...value);
            return;
          }
        } else
          ({ done, value } = firstResult);
        if (done) {
          this.#handleDone(reader);
          return;
        }
        if (!this.push(value[0])) {
          this.#pendingChunks = value.slice(1);
          return;
        }
        for (let i = 1, count = value.length;i < count; i++)
          if (!this.push(value[i])) {
            this.#pendingChunks = value.slice(i + 1);
            return;
          }
      } while (!this.#closed);
    } catch (e) {
      deferredError = e;
    }
    if (deferredError)
      throw deferredError;
  }
  _destroy(error, callback) {
    if (!this.#closed) {
      var reader = this.#reader;
      if (reader)
        this.#reader = @undefined, reader.cancel(error).finally(() => {
          this.#closed = !0, callback(error);
        });
      return;
    }
    try {
      callback(error);
    } catch (error2) {
      globalThis.reportError(error2);
    }
  }
}
var encoder = /* @__PURE__ */ new TextEncoder, ZLIB_FAILURES = new SafeSet([
  ...ArrayPrototypeFilter.@call(ArrayPrototypeMap.@call(ObjectEntries(constants_zlib), ({ 0: code, 1: value }) => value < 0 ? code : null), Boolean),
  "Z_NEED_DICT"
]);
function handleKnownInternalErrors(cause) {
  switch (!0) {
    case cause?.code === "ERR_STREAM_PREMATURE_CLOSE":
      return @makeAbortError(@undefined, { cause });
    case ZLIB_FAILURES.has(cause?.code): {
      let error = @makeTypeError(@undefined, { cause });
      return error.code = cause.code, error;
    }
    default:
      return cause;
  }
}
function newWritableStreamFromStreamWritable(streamWritable) {
  if (!(streamWritable && typeof streamWritable?.write === "function" && typeof streamWritable?.on === "function"))
    throw @makeErrorWithCode(118, "streamWritable", "stream.Writable", streamWritable);
  if (isDestroyed(streamWritable) || !isWritable(streamWritable)) {
    let writable = new @WritableStream;
    return writable.close(), writable;
  }
  let highWaterMark = streamWritable.writableHighWaterMark, strategy = streamWritable.writableObjectMode ? new CountQueuingStrategy({ highWaterMark }) : { highWaterMark }, controller, backpressurePromise, closed;
  function onDrain() {
    if (backpressurePromise !== @undefined)
      backpressurePromise.resolve();
  }
  let cleanup = finished(streamWritable, (error) => {
    if (error = handleKnownInternalErrors(error), cleanup(), streamWritable.on("error", () => {}), error != null) {
      if (backpressurePromise !== @undefined)
        backpressurePromise.reject(error);
      if (closed !== @undefined)
        closed.reject(error), closed = @undefined;
      controller.error(error), controller = @undefined;
      return;
    }
    if (closed !== @undefined) {
      closed.resolve(), closed = @undefined;
      return;
    }
    controller.error(@makeAbortError()), controller = @undefined;
  });
  return streamWritable.on("drain", onDrain), new @WritableStream({
    start(c) {
      controller = c;
    },
    write(chunk) {
      if (streamWritable.writableNeedDrain || !streamWritable.write(chunk))
        return backpressurePromise = PromiseWithResolvers(), SafePromisePrototypeFinally.@call(backpressurePromise.promise, () => {
          backpressurePromise = @undefined;
        });
    },
    abort(reason) {
      destroyer(streamWritable, reason);
    },
    close() {
      if (closed === @undefined && !isWritableEnded(streamWritable))
        return closed = PromiseWithResolvers(), streamWritable.end(), closed.promise;
      return controller = @undefined, PromiseResolve();
    }
  }, strategy);
}
function newStreamWritableFromWritableStream(writableStream, options = kEmptyObject) {
  if (!@inherits(2, writableStream))
    throw @makeErrorWithCode(118, "writableStream", "WritableStream", writableStream);
  validateObject(options, "options");
  let { highWaterMark, decodeStrings = !0, objectMode = !1, signal } = options;
  validateBoolean(objectMode, "options.objectMode"), validateBoolean(decodeStrings, "options.decodeStrings");
  let writer = writableStream.getWriter(), closed = !1, writable = new Writable({
    highWaterMark,
    objectMode,
    decodeStrings,
    signal,
    writev(chunks, callback) {
      function done(error) {
        error = error.filter((e) => e);
        try {
          callback(error.length === 0 ? @undefined : error);
        } catch (error2) {
          process.nextTick(() => destroyer(writable, error2));
        }
      }
      PromisePrototypeThen.@call(writer.ready, () => {
        return PromisePrototypeThen.@call(SafePromiseAll(chunks, (data) => writer.write(data.chunk)), done, done);
      }, done);
    },
    write(chunk, encoding, callback) {
      if (typeof chunk === "string" && decodeStrings && !objectMode)
        if (normalizeEncoding(encoding) === "utf8")
          chunk = encoder.encode(chunk);
        else
          chunk = @Buffer.from(chunk, encoding), chunk = new @Uint8Array(TypedArrayPrototypeGetBuffer(chunk), TypedArrayPrototypeGetByteOffset(chunk), TypedArrayPrototypeGetByteLength(chunk));
      function done(error) {
        try {
          callback(error);
        } catch (error2) {
          destroyer(writable, error2);
        }
      }
      PromisePrototypeThen.@call(writer.ready, () => {
        return PromisePrototypeThen.@call(writer.write(chunk), done, done);
      }, done);
    },
    destroy(error, callback) {
      function done() {
        try {
          callback(error);
        } catch (error2) {
          process.nextTick(() => {
            throw error2;
          });
        }
      }
      if (!closed) {
        if (error != null)
          PromisePrototypeThen.@call(writer.abort(error), done, done);
        else
          PromisePrototypeThen.@call(writer.close(), done, done);
        return;
      }
      done();
    },
    final(callback) {
      function done(error) {
        try {
          callback(error);
        } catch (error2) {
          process.nextTick(() => destroyer(writable, error2));
        }
      }
      if (!closed)
        PromisePrototypeThen.@call(writer.close(), done, done);
    }
  });
  return PromisePrototypeThen.@call(writer.closed, () => {
    if (closed = !0, !isWritableEnded(writable))
      destroyer(writable, @makeErrorWithCode(230));
  }, (error) => {
    closed = !0, destroyer(writable, error);
  }), writable;
}
function newReadableStreamFromStreamReadable(streamReadable, options = kEmptyObject) {
  if (typeof streamReadable?._readableState !== "object")
    throw @makeErrorWithCode(118, "streamReadable", "stream.Readable", streamReadable);
  if (isDestroyed(streamReadable) || !isReadable(streamReadable)) {
    let readable = new @ReadableStream;
    return readable.cancel(), readable;
  }
  let { readableObjectMode: objectMode, readableHighWaterMark: highWaterMark } = streamReadable, strategy = ((strategy2) => {
    if (strategy2)
      return strategy2;
    if (objectMode)
      return new CountQueuingStrategy({ highWaterMark });
    return new ByteLengthQueuingStrategy({ highWaterMark });
  })(options?.strategy), controller, wasCanceled = !1;
  function onData(chunk) {
    if (@Buffer.isBuffer(chunk) && !objectMode)
      chunk = new @Uint8Array(chunk);
    if (controller.enqueue(chunk), controller.desiredSize <= 0)
      streamReadable.pause();
  }
  streamReadable.pause();
  let cleanup = finished(streamReadable, (error) => {
    if (error = handleKnownInternalErrors(error), cleanup(), streamReadable.on("error", () => {}), error)
      return controller.error(error);
    if (wasCanceled)
      return;
    controller.close();
  });
  return streamReadable.on("data", onData), new @ReadableStream({
    start(c) {
      controller = c;
    },
    pull() {
      streamReadable.resume();
    },
    cancel(reason) {
      wasCanceled = !0, destroyer(streamReadable, reason);
    }
  }, strategy);
}
function newStreamReadableFromReadableStream(readableStream, options = kEmptyObject) {
  if (!@inherits(1, readableStream))
    throw @makeErrorWithCode(118, "readableStream", "ReadableStream", readableStream);
  validateObject(options, "options");
  let { highWaterMark, encoding, objectMode = !1, signal } = options;
  if (encoding !== @undefined && !@Buffer.isEncoding(encoding))
    throw @makeErrorWithCode(119, "options.encoding", encoding);
  return validateBoolean(objectMode, "options.objectMode"), tryTransferToNativeReadable(readableStream, options) || new ReadableFromWeb({
    highWaterMark,
    encoding,
    objectMode,
    signal
  }, readableStream);
}
function newReadableWritablePairFromDuplex(duplex) {
  if (typeof duplex?._writableState !== "object" || typeof duplex?._readableState !== "object")
    throw @makeErrorWithCode(118, "duplex", "stream.Duplex", duplex);
  if (isDestroyed(duplex)) {
    let writable2 = new @WritableStream, readable2 = new @ReadableStream;
    return writable2.close(), readable2.cancel(), { readable: readable2, writable: writable2 };
  }
  let writable = isWritable(duplex) ? newWritableStreamFromStreamWritable(duplex) : new @WritableStream;
  if (!isWritable(duplex))
    writable.close();
  let readable = isReadable(duplex) ? newReadableStreamFromStreamReadable(duplex) : new @ReadableStream;
  if (!isReadable(duplex))
    readable.cancel();
  return { writable, readable };
}
function newStreamDuplexFromReadableWritablePair(pair = kEmptyObject, options = kEmptyObject) {
  validateObject(pair, "pair");
  let { readable: readableStream, writable: writableStream } = pair;
  if (!@inherits(1, readableStream))
    throw @makeErrorWithCode(118, "pair.readable", "ReadableStream", readableStream);
  if (!@inherits(2, writableStream))
    throw @makeErrorWithCode(118, "pair.writable", "WritableStream", writableStream);
  validateObject(options, "options");
  let { allowHalfOpen = !1, objectMode = !1, encoding, decodeStrings = !0, highWaterMark, signal } = options;
  if (validateBoolean(objectMode, "options.objectMode"), encoding !== @undefined && !@Buffer.isEncoding(encoding))
    throw @makeErrorWithCode(119, encoding, "options.encoding");
  let writer = writableStream.getWriter(), reader = readableStream.getReader(), writableClosed = !1, readableClosed = !1, duplex = new Duplex({
    allowHalfOpen,
    highWaterMark,
    objectMode,
    encoding,
    decodeStrings,
    signal,
    writev(chunks, callback) {
      function done(error) {
        error = error.filter((e) => e);
        try {
          callback(error.length === 0 ? @undefined : error);
        } catch (error2) {
          process.nextTick(() => destroyer(duplex, error2));
        }
      }
      PromisePrototypeThen.@call(writer.ready, () => {
        return PromisePrototypeThen.@call(SafePromiseAll(chunks, (data) => writer.write(data.chunk)), done, done);
      }, done);
    },
    write(chunk, encoding2, callback) {
      if (typeof chunk === "string" && decodeStrings && !objectMode)
        if (normalizeEncoding(encoding2) === "utf8")
          chunk = encoder.encode(chunk);
        else
          chunk = @Buffer.from(chunk, encoding2), chunk = new @Uint8Array(TypedArrayPrototypeGetBuffer(chunk), TypedArrayPrototypeGetByteOffset(chunk), TypedArrayPrototypeGetByteLength(chunk));
      function done(error) {
        try {
          callback(error);
        } catch (error2) {
          destroyer(duplex, error2);
        }
      }
      PromisePrototypeThen.@call(writer.ready, () => {
        return PromisePrototypeThen.@call(writer.write(chunk), done, done);
      }, done);
    },
    final(callback) {
      function done(error) {
        try {
          callback(error);
        } catch (error2) {
          process.nextTick(() => destroyer(duplex, error2));
        }
      }
      if (!writableClosed)
        PromisePrototypeThen.@call(writer.close(), done, done);
    },
    read() {
      PromisePrototypeThen.@call(reader.read(), (chunk) => {
        if (chunk.done)
          duplex.push(null);
        else
          duplex.push(chunk.value);
      }, (error) => destroyer(duplex, error));
    },
    destroy(error, callback) {
      function done() {
        try {
          callback(error);
        } catch (error2) {
          process.nextTick(() => {
            throw error2;
          });
        }
      }
      async function closeWriter() {
        if (!writableClosed)
          await writer.abort(error);
      }
      async function closeReader() {
        if (!readableClosed)
          await reader.cancel(error);
      }
      if (!writableClosed || !readableClosed) {
        PromisePrototypeThen.@call(SafePromiseAll([closeWriter(), closeReader()]), done, done);
        return;
      }
      done();
    }
  });
  return PromisePrototypeThen.@call(writer.closed, () => {
    if (writableClosed = !0, !isWritableEnded(duplex))
      destroyer(duplex, @makeErrorWithCode(230));
  }, (error) => {
    writableClosed = !0, readableClosed = !0, destroyer(duplex, error);
  }), PromisePrototypeThen.@call(reader.closed, () => {
    readableClosed = !0;
  }, (error) => {
    writableClosed = !0, readableClosed = !0, destroyer(duplex, error);
  }), duplex;
}
$ = {
  newWritableStreamFromStreamWritable,
  newReadableStreamFromStreamReadable,
  newStreamWritableFromWritableStream,
  newStreamReadableFromReadableStream,
  newReadableWritablePairFromDuplex,
  newStreamDuplexFromReadableWritablePair,
  _ReadableFromWeb: ReadableFromWeb
};
return $})

