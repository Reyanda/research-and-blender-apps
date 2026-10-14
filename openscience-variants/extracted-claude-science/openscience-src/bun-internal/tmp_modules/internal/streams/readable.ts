(function (){"use strict";// build/release/tmp_modules/internal/streams/readable.ts
var $, EE = @getInternalField(@internalModuleRegistry, 96) || @createInternalModuleById(96), { Stream, prependListener } = @getInternalField(@internalModuleRegistry, 50) || @createInternalModuleById(50), { addAbortSignal } = @getInternalField(@internalModuleRegistry, 41) || @createInternalModuleById(41), eos = @getInternalField(@internalModuleRegistry, 47) || @createInternalModuleById(47), destroyImpl = @getInternalField(@internalModuleRegistry, 43) || @createInternalModuleById(43), { getHighWaterMark, getDefaultHighWaterMark } = @getInternalField(@internalModuleRegistry, 56) || @createInternalModuleById(56), {
  kOnConstructed,
  kState,
  kObjectMode,
  kErrorEmitted,
  kAutoDestroy,
  kEmitClose,
  kDestroyed,
  kClosed,
  kCloseEmitted,
  kErrored,
  kConstructed
} = @getInternalField(@internalModuleRegistry, 58) || @createInternalModuleById(58), { aggregateTwoErrors } = @getInternalField(@internalModuleRegistry, 16) || @createInternalModuleById(16), { validateObject } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), { StringDecoder } = @getInternalField(@internalModuleRegistry, 143) || @createInternalModuleById(143), from = @getInternalField(@internalModuleRegistry, 48) || @createInternalModuleById(48), { SafeSet } = @getInternalField(@internalModuleRegistry, 30) || @createInternalModuleById(30), { kAutoDestroyed } = @getInternalField(@internalModuleRegistry, 32) || @createInternalModuleById(32), ObjectDefineProperties = Object.defineProperties, SymbolAsyncDispose = Symbol.asyncDispose, NumberIsNaN = Number.isNaN, NumberIsInteger = Number.isInteger, NumberParseInt = Number.parseInt, ArrayPrototypeIndexOf = @Array.prototype.indexOf, ObjectKeys = Object.keys, SymbolAsyncIterator = Symbol.asyncIterator, TypedArrayPrototypeSet = @Uint8Array.prototype.set, { errorOrDestroy } = destroyImpl, nop = () => {}, kErroredValue = Symbol("kErroredValue"), kDefaultEncodingValue = Symbol("kDefaultEncodingValue"), kDecoderValue = Symbol("kDecoderValue"), kEncodingValue = Symbol("kEncodingValue"), kEnded = 512, kEndEmitted = 1024, kReading = 2048, kSync = 4096, kNeedReadable = 8192, kEmittedReadable = 16384, kReadableListening = 32768, kResumeScheduled = 65536, kMultiAwaitDrain = 131072, kReadingMore = 262144, kDataEmitted = 524288, kDefaultUTF8Encoding = 1048576, kDecoder = 2097152, kEncoding = 4194304, kHasFlowing = 8388608, kFlowing = 16777216, kHasPaused = 33554432, kPaused = 67108864, kDataListening = 134217728;
function makeBitMapDescriptor(bit) {
  return {
    enumerable: !1,
    get() {
      return (this[kState] & bit) !== 0;
    },
    set(value) {
      if (value)
        this[kState] |= bit;
      else
        this[kState] &= ~bit;
    }
  };
}
function ReadableState(options, stream, isDuplex) {
  if (this[kState] = kEmitClose | kAutoDestroy | kConstructed | kSync, options?.objectMode)
    this[kState] |= kObjectMode;
  if (isDuplex && options?.readableObjectMode)
    this[kState] |= kObjectMode;
  if (this.highWaterMark = options ? getHighWaterMark(this, options, "readableHighWaterMark", isDuplex) : getDefaultHighWaterMark(!1), this.buffer = [], this.bufferIndex = 0, this.length = 0, this.pipes = [], options && options.emitClose === !1)
    this[kState] &= ~kEmitClose;
  if (options && options.autoDestroy === !1)
    this[kState] &= ~kAutoDestroy;
  let defaultEncoding = options?.defaultEncoding;
  if (defaultEncoding == null || defaultEncoding === "utf8" || defaultEncoding === "utf-8")
    this[kState] |= kDefaultUTF8Encoding;
  else if (@Buffer.isEncoding(defaultEncoding))
    this.defaultEncoding = defaultEncoding;
  else
    throw @makeErrorWithCode(254, defaultEncoding);
  if (this.awaitDrainWriters = null, options?.encoding)
    this.decoder = new StringDecoder(options.encoding), this.encoding = options.encoding;
}
ReadableState.prototype = {};
ObjectDefineProperties(ReadableState.prototype, {
  objectMode: makeBitMapDescriptor(kObjectMode),
  ended: makeBitMapDescriptor(kEnded),
  endEmitted: makeBitMapDescriptor(kEndEmitted),
  reading: makeBitMapDescriptor(kReading),
  constructed: makeBitMapDescriptor(kConstructed),
  sync: makeBitMapDescriptor(kSync),
  needReadable: makeBitMapDescriptor(kNeedReadable),
  emittedReadable: makeBitMapDescriptor(kEmittedReadable),
  readableListening: makeBitMapDescriptor(kReadableListening),
  resumeScheduled: makeBitMapDescriptor(kResumeScheduled),
  errorEmitted: makeBitMapDescriptor(kErrorEmitted),
  emitClose: makeBitMapDescriptor(kEmitClose),
  autoDestroy: makeBitMapDescriptor(kAutoDestroy),
  destroyed: makeBitMapDescriptor(kDestroyed),
  closed: makeBitMapDescriptor(kClosed),
  closeEmitted: makeBitMapDescriptor(kCloseEmitted),
  multiAwaitDrain: makeBitMapDescriptor(kMultiAwaitDrain),
  readingMore: makeBitMapDescriptor(kReadingMore),
  dataEmitted: makeBitMapDescriptor(kDataEmitted),
  errored: {
    __proto__: null,
    enumerable: !1,
    get() {
      return (this[kState] & kErrored) !== 0 ? this[kErroredValue] : null;
    },
    set(value) {
      if (value)
        this[kErroredValue] = value, this[kState] |= kErrored;
      else
        this[kState] &= ~kErrored;
    }
  },
  defaultEncoding: {
    __proto__: null,
    enumerable: !1,
    get() {
      return (this[kState] & kDefaultUTF8Encoding) !== 0 ? "utf8" : this[kDefaultEncodingValue];
    },
    set(value) {
      if (value === "utf8" || value === "utf-8")
        this[kState] |= kDefaultUTF8Encoding;
      else
        this[kState] &= ~kDefaultUTF8Encoding, this[kDefaultEncodingValue] = value;
    }
  },
  decoder: {
    __proto__: null,
    enumerable: !1,
    get() {
      return (this[kState] & kDecoder) !== 0 ? this[kDecoderValue] : null;
    },
    set(value) {
      if (value)
        this[kDecoderValue] = value, this[kState] |= kDecoder;
      else
        this[kState] &= ~kDecoder;
    }
  },
  encoding: {
    __proto__: null,
    enumerable: !1,
    get() {
      return (this[kState] & kEncoding) !== 0 ? this[kEncodingValue] : null;
    },
    set(value) {
      if (value)
        this[kEncodingValue] = value, this[kState] |= kEncoding;
      else
        this[kState] &= ~kEncoding;
    }
  },
  flowing: {
    __proto__: null,
    enumerable: !1,
    get() {
      return (this[kState] & kHasFlowing) !== 0 ? (this[kState] & kFlowing) !== 0 : null;
    },
    set(value) {
      if (value == null)
        this[kState] &= ~(kHasFlowing | kFlowing);
      else if (value)
        this[kState] |= kHasFlowing | kFlowing;
      else
        this[kState] |= kHasFlowing, this[kState] &= ~kFlowing;
    }
  }
});
ReadableState.prototype[kOnConstructed] = function onConstructed(stream) {
  if ((this[kState] & kNeedReadable) !== 0)
    maybeReadMore(stream, this);
};
function Readable(options) {
  if (!(this instanceof Readable))
    return new Readable(options);
  if (this._events ??= {
    close: @undefined,
    error: @undefined,
    data: @undefined,
    end: @undefined,
    readable: @undefined
  }, this._readableState = new ReadableState(options, this, !1), options) {
    if (typeof options.read === "function")
      this._read = options.read;
    if (typeof options.destroy === "function")
      this._destroy = options.destroy;
    if (typeof options.construct === "function")
      this._construct = options.construct;
    if (options.signal)
      addAbortSignal(options.signal, this);
  }
  if (Stream.@call(this, options), this._construct != null)
    destroyImpl.construct(this, () => {
      this._readableState[kOnConstructed](this);
    });
}
@toClass(Readable, "Readable", Stream);
Readable.ReadableState = ReadableState;
Readable.prototype.destroy = destroyImpl.destroy;
Readable.prototype._undestroy = destroyImpl.undestroy;
Readable.prototype._destroy = function(err, cb) {
  cb(err);
};
Readable.prototype[EE.captureRejectionSymbol] = function(err) {
  this.destroy(err);
};
Readable.prototype[SymbolAsyncDispose] = function() {
  let error;
  if (!this.destroyed)
    error = this.readableEnded ? null : @makeAbortError(), this.destroy(error);
  return new @Promise((resolve, reject) => eos(this, (err) => err && err !== error ? reject(err) : resolve(null)));
};
Readable.prototype.push = function(chunk, encoding) {
  let state = this._readableState;
  return (state[kState] & kObjectMode) === 0 ? readableAddChunkPushByteMode(this, state, chunk, encoding) : readableAddChunkPushObjectMode(this, state, chunk, encoding);
};
Readable.prototype.unshift = function(chunk, encoding) {
  let state = this._readableState;
  return (state[kState] & kObjectMode) === 0 ? readableAddChunkUnshiftByteMode(this, state, chunk, encoding) : readableAddChunkUnshiftObjectMode(this, state, chunk);
};
function readableAddChunkUnshiftByteMode(stream, state, chunk, encoding) {
  if (chunk === null)
    return state[kState] &= ~kReading, onEofChunk(stream, state), !1;
  if (typeof chunk === "string") {
    if (encoding ||= state.defaultEncoding, state.encoding !== encoding)
      if (state.encoding)
        chunk = @Buffer.from(chunk, encoding).toString(state.encoding);
      else
        chunk = @Buffer.from(chunk, encoding);
  } else if (Stream._isArrayBufferView(chunk))
    chunk = Stream._uint8ArrayToBuffer(chunk);
  else if (chunk !== @undefined && !(chunk instanceof @Buffer))
    return errorOrDestroy(stream, @makeErrorWithCode(118, "chunk", ["string", "Buffer", "TypedArray", "DataView"], chunk)), !1;
  if (!(chunk && chunk.length > 0))
    return canPushMore(state);
  return readableAddChunkUnshiftValue(stream, state, chunk);
}
function readableAddChunkUnshiftObjectMode(stream, state, chunk) {
  if (chunk === null)
    return state[kState] &= ~kReading, onEofChunk(stream, state), !1;
  return readableAddChunkUnshiftValue(stream, state, chunk);
}
function readableAddChunkUnshiftValue(stream, state, chunk) {
  if ((state[kState] & kEndEmitted) !== 0)
    errorOrDestroy(stream, @makeErrorWithCode(234));
  else if ((state[kState] & (kDestroyed | kErrored)) !== 0)
    return !1;
  else
    addChunk(stream, state, chunk, !0);
  return canPushMore(state);
}
function readableAddChunkPushByteMode(stream, state, chunk, encoding) {
  if (chunk === null)
    return state[kState] &= ~kReading, onEofChunk(stream, state), !1;
  if (typeof chunk === "string") {
    if (encoding ||= state.defaultEncoding, state.encoding !== encoding)
      chunk = @Buffer.from(chunk, encoding), encoding = "";
  } else if (chunk instanceof @Buffer)
    encoding = "";
  else if (Stream._isArrayBufferView(chunk))
    chunk = Stream._uint8ArrayToBuffer(chunk), encoding = "";
  else if (chunk !== @undefined)
    return errorOrDestroy(stream, @makeErrorWithCode(118, "chunk", ["string", "Buffer", "TypedArray", "DataView"], chunk)), !1;
  if (!chunk || chunk.length <= 0)
    return state[kState] &= ~kReading, maybeReadMore(stream, state), canPushMore(state);
  if ((state[kState] & kEnded) !== 0)
    return errorOrDestroy(stream, @makeErrorWithCode(231)), !1;
  if ((state[kState] & (kDestroyed | kErrored)) !== 0)
    return !1;
  if (state[kState] &= ~kReading, (state[kState] & kDecoder) !== 0 && !encoding) {
    if (chunk = state[kDecoderValue].write(chunk), chunk.length === 0)
      return maybeReadMore(stream, state), canPushMore(state);
  }
  return addChunk(stream, state, chunk, !1), canPushMore(state);
}
function readableAddChunkPushObjectMode(stream, state, chunk, encoding) {
  if (chunk === null)
    return state[kState] &= ~kReading, onEofChunk(stream, state), !1;
  if ((state[kState] & kEnded) !== 0)
    return errorOrDestroy(stream, @makeErrorWithCode(231)), !1;
  if ((state[kState] & (kDestroyed | kErrored)) !== 0)
    return !1;
  if (state[kState] &= ~kReading, (state[kState] & kDecoder) !== 0 && !encoding)
    chunk = state[kDecoderValue].write(chunk);
  return addChunk(stream, state, chunk, !1), canPushMore(state);
}
function canPushMore(state) {
  return (state[kState] & kEnded) === 0 && (state.length < state.highWaterMark || state.length === 0);
}
function addChunk(stream, state, chunk, addToFront) {
  if ((state[kState] & (kFlowing | kSync | kDataListening)) === (kFlowing | kDataListening) && state.length === 0) {
    if ((state[kState] & kMultiAwaitDrain) !== 0)
      state.awaitDrainWriters.clear();
    else
      state.awaitDrainWriters = null;
    state[kState] |= kDataEmitted, stream.emit("data", chunk);
  } else {
    if (state.length += (state[kState] & kObjectMode) !== 0 ? 1 : chunk.length, addToFront)
      if (state.bufferIndex > 0)
        state.buffer[--state.bufferIndex] = chunk;
      else
        state.buffer.unshift(chunk);
    else
      state.buffer.push(chunk);
    if ((state[kState] & kNeedReadable) !== 0)
      emitReadable(stream);
  }
  maybeReadMore(stream, state);
}
Readable.prototype.isPaused = function() {
  let state = this._readableState;
  return (state[kState] & kPaused) !== 0 || (state[kState] & (kHasFlowing | kFlowing)) === kHasFlowing;
};
Readable.prototype.setEncoding = function(enc) {
  let state = this._readableState, decoder = new StringDecoder(enc);
  state.decoder = decoder, state.encoding = state.decoder.encoding;
  let content = "";
  for (let data of state.buffer.slice(state.bufferIndex))
    content += decoder.write(data);
  if (state.buffer.length = 0, state.bufferIndex = 0, content !== "")
    state.buffer.push(content);
  return state.length = content.length, this;
};
var MAX_HWM = 1073741824;
function computeNewHighWaterMark(n) {
  if (n > MAX_HWM)
    throw @makeErrorWithCode(156, "size", "<= 1GiB", n);
  else
    n--, n |= n >>> 1, n |= n >>> 2, n |= n >>> 4, n |= n >>> 8, n |= n >>> 16, n++;
  return n;
}
function howMuchToRead(n, state) {
  if (n <= 0 || state.length === 0 && (state[kState] & kEnded) !== 0)
    return 0;
  if ((state[kState] & kObjectMode) !== 0)
    return 1;
  if (NumberIsNaN(n)) {
    if ((state[kState] & kFlowing) !== 0 && state.length)
      return state.buffer[state.bufferIndex].length;
    return state.length;
  }
  if (n <= state.length)
    return n;
  return (state[kState] & kEnded) !== 0 ? state.length : 0;
}
Readable.prototype.read = function(n) {
  if (n === @undefined)
    n = NaN;
  else if (!NumberIsInteger(n))
    n = NumberParseInt(n, 10);
  let state = this._readableState, nOrig = n;
  if (n > state.highWaterMark)
    state.highWaterMark = computeNewHighWaterMark(n);
  if (n !== 0)
    state[kState] &= ~kEmittedReadable;
  if (n === 0 && (state[kState] & kNeedReadable) !== 0 && ((state.highWaterMark !== 0 ? state.length >= state.highWaterMark : state.length > 0) || (state[kState] & kEnded) !== 0)) {
    if (state.length === 0 && (state[kState] & kEnded) !== 0)
      endReadable(this);
    else
      emitReadable(this);
    return null;
  }
  if (n = howMuchToRead(n, state), n === 0 && (state[kState] & kEnded) !== 0) {
    if (state.length === 0)
      endReadable(this);
    return null;
  }
  let doRead = (state[kState] & kNeedReadable) !== 0;
  if (state.length === 0 || state.length - n < state.highWaterMark)
    doRead = !0;
  if ((state[kState] & (kReading | kEnded | kDestroyed | kErrored | kConstructed)) !== kConstructed)
    doRead = !1;
  else if (doRead) {
    if (state[kState] |= kReading | kSync, state.length === 0)
      state[kState] |= kNeedReadable;
    try {
      this._read(state.highWaterMark);
    } catch (err) {
      errorOrDestroy(this, err);
    }
    if (state[kState] &= ~kSync, (state[kState] & kReading) === 0)
      n = howMuchToRead(nOrig, state);
  }
  let ret;
  if (n > 0)
    ret = fromList(n, state);
  else
    ret = null;
  if (ret === null)
    state[kState] |= state.length <= state.highWaterMark ? kNeedReadable : 0, n = 0;
  else if (state.length -= n, (state[kState] & kMultiAwaitDrain) !== 0)
    state.awaitDrainWriters.clear();
  else
    state.awaitDrainWriters = null;
  if (state.length === 0) {
    if ((state[kState] & kEnded) === 0)
      state[kState] |= kNeedReadable;
    if (nOrig !== n && (state[kState] & kEnded) !== 0)
      endReadable(this);
  }
  if (ret !== null && (state[kState] & (kErrorEmitted | kCloseEmitted)) === 0)
    state[kState] |= kDataEmitted, this.emit("data", ret);
  return ret;
};
function onEofChunk(stream, state) {
  if ((state[kState] & kEnded) !== 0)
    return;
  let decoder = (state[kState] & kDecoder) !== 0 ? state[kDecoderValue] : null;
  if (decoder) {
    let chunk = decoder.end();
    if (chunk?.length)
      state.buffer.push(chunk), state.length += (state[kState] & kObjectMode) !== 0 ? 1 : chunk.length;
  }
  if (state[kState] |= kEnded, (state[kState] & kSync) !== 0)
    emitReadable(stream);
  else
    state[kState] &= ~kNeedReadable, state[kState] |= kEmittedReadable, emitReadable_(stream);
}
function emitReadable(stream) {
  let state = stream._readableState;
  if (state[kState] &= ~kNeedReadable, (state[kState] & kEmittedReadable) === 0)
    state[kState] |= kEmittedReadable, process.nextTick(emitReadable_, stream);
}
function emitReadable_(stream) {
  let state = stream._readableState;
  if ((state[kState] & (kDestroyed | kErrored)) === 0 && (state.length || (state[kState] & kEnded) !== 0))
    stream.emit("readable"), state[kState] &= ~kEmittedReadable;
  state[kState] |= (state[kState] & (kFlowing | kEnded)) === 0 && state.length <= state.highWaterMark ? kNeedReadable : 0, flow(stream);
}
function maybeReadMore(stream, state) {
  if ((state[kState] & (kReadingMore | kConstructed)) === kConstructed)
    state[kState] |= kReadingMore, process.nextTick(maybeReadMore_, stream, state);
}
function maybeReadMore_(stream, state) {
  while ((state[kState] & (kReading | kEnded)) === 0 && (state.length < state.highWaterMark || (state[kState] & kFlowing) !== 0 && state.length === 0)) {
    let len = state.length;
    if (stream.read(0), len === state.length)
      break;
  }
  state[kState] &= ~kReadingMore;
}
Readable.prototype._read = function(_n) {
  throw @makeErrorWithCode(149, "_read()");
};
Readable.prototype.pipe = function(dest, pipeOpts) {
  let src = this, state = this._readableState;
  if (state.pipes.length === 1) {
    if ((state[kState] & kMultiAwaitDrain) === 0)
      state[kState] |= kMultiAwaitDrain, state.awaitDrainWriters = new SafeSet(state.awaitDrainWriters ? [state.awaitDrainWriters] : []);
  }
  state.pipes.push(dest);
  let endFn = (!pipeOpts || pipeOpts.end !== !1) && dest !== process.stdout && dest !== process.stderr ? onend : unpipe;
  if ((state[kState] & kEndEmitted) !== 0)
    process.nextTick(endFn);
  else
    src.once("end", endFn);
  dest.on("unpipe", onunpipe);
  function onunpipe(readable, unpipeInfo) {
    if (readable === src) {
      if (unpipeInfo && unpipeInfo.hasUnpiped === !1)
        unpipeInfo.hasUnpiped = !0, cleanup();
    }
  }
  function onend() {
    dest.end();
  }
  let ondrain, cleanedUp = !1;
  function cleanup() {
    if (dest.removeListener("close", onclose), dest.removeListener("finish", onfinish), ondrain)
      dest.removeListener("drain", ondrain);
    if (dest.removeListener("error", onerror), dest.removeListener("unpipe", onunpipe), src.removeListener("end", onend), src.removeListener("end", unpipe), src.removeListener("data", ondata), cleanedUp = !0, ondrain && state.awaitDrainWriters && (!dest._writableState || dest._writableState.needDrain))
      ondrain();
  }
  function pause() {
    if (!cleanedUp) {
      if (state.pipes.length === 1 && state.pipes[0] === dest)
        state.awaitDrainWriters = dest, state[kState] &= ~kMultiAwaitDrain;
      else if (state.pipes.length > 1 && state.pipes.includes(dest))
        state.awaitDrainWriters.add(dest);
      src.pause();
    }
    if (!ondrain)
      ondrain = pipeOnDrain(src, dest), dest.on("drain", ondrain);
  }
  src.on("data", ondata);
  function ondata(chunk) {
    try {
      if (dest.write(chunk) === !1)
        pause();
    } catch (err) {
      dest.destroy(err);
    }
  }
  function onerror(er) {
    if (unpipe(), dest.removeListener("error", onerror), dest.listenerCount("error") === 0) {
      let s = dest._writableState || dest._readableState;
      if (s && !s.errorEmitted)
        errorOrDestroy(dest, er);
      else
        dest.emit("error", er);
    }
  }
  prependListener(dest, "error", onerror);
  function onclose() {
    dest.removeListener("finish", onfinish), unpipe();
  }
  dest.once("close", onclose);
  function onfinish() {
    dest.removeListener("close", onclose), unpipe();
  }
  dest.once("finish", onfinish);
  function unpipe() {
    src.unpipe(dest);
  }
  if (dest.emit("pipe", src), dest.writableNeedDrain === !0)
    pause();
  else if ((state[kState] & kFlowing) === 0)
    src.resume();
  return dest;
};
function pipeOnDrain(src, dest) {
  return function pipeOnDrainFunctionResult() {
    let state = src._readableState;
    if (state.awaitDrainWriters === dest)
      state.awaitDrainWriters = null;
    else if ((state[kState] & kMultiAwaitDrain) !== 0)
      state.awaitDrainWriters.delete(dest);
    if ((!state.awaitDrainWriters || state.awaitDrainWriters.size === 0) && (state[kState] & kDataListening) !== 0)
      src.resume();
  };
}
Readable.prototype.unpipe = function(dest) {
  let state = this._readableState, unpipeInfo = { hasUnpiped: !1 };
  if (state.pipes.length === 0)
    return this;
  if (!dest) {
    let dests = state.pipes;
    state.pipes = [], this.pause();
    for (let i = 0;i < dests.length; i++)
      dests[i].emit("unpipe", this, { hasUnpiped: !1 });
    return this;
  }
  let index = ArrayPrototypeIndexOf.@call(state.pipes, dest);
  if (index === -1)
    return this;
  if (state.pipes.splice(index, 1), state.pipes.length === 0)
    this.pause();
  return dest.emit("unpipe", this, unpipeInfo), this;
};
Readable.prototype.on = function(ev, fn) {
  let res = Stream.prototype.on.@call(this, ev, fn), state = this._readableState;
  if (ev === "data") {
    if (state[kState] |= kDataListening, state[kState] |= this.listenerCount("readable") > 0 ? kReadableListening : 0, (state[kState] & (kHasFlowing | kFlowing)) !== kHasFlowing)
      this.resume();
  } else if (ev === "readable") {
    if ((state[kState] & (kEndEmitted | kReadableListening)) === 0) {
      if (state[kState] |= kReadableListening | kNeedReadable | kHasFlowing, state[kState] &= ~(kFlowing | kEmittedReadable), state.length)
        emitReadable(this);
      else if ((state[kState] & kReading) === 0)
        process.nextTick(nReadingNextTick, this);
    }
  }
  return res;
};
Readable.prototype.addListener = Readable.prototype.on;
Readable.prototype.removeListener = function(ev, fn) {
  let state = this._readableState, res = Stream.prototype.removeListener.@call(this, ev, fn);
  if (ev === "readable")
    process.nextTick(updateReadableListening, this);
  else if (ev === "data" && this.listenerCount("data") === 0)
    state[kState] &= ~kDataListening;
  return res;
};
Readable.prototype.off = Readable.prototype.removeListener;
Readable.prototype.removeAllListeners = function(ev) {
  let res = Stream.prototype.removeAllListeners.@apply(this, arguments);
  if (ev === "readable" || ev === @undefined)
    process.nextTick(updateReadableListening, this);
  return res;
};
function updateReadableListening(self) {
  let state = self._readableState;
  if (self.listenerCount("readable") > 0)
    state[kState] |= kReadableListening;
  else
    state[kState] &= ~kReadableListening;
  if ((state[kState] & (kHasPaused | kPaused | kResumeScheduled)) === (kHasPaused | kResumeScheduled))
    state[kState] |= kHasFlowing | kFlowing;
  else if ((state[kState] & kDataListening) !== 0)
    self.resume();
  else if ((state[kState] & kReadableListening) === 0)
    state[kState] &= ~(kHasFlowing | kFlowing);
}
function nReadingNextTick(self) {
  self.read(0);
}
Readable.prototype.resume = function() {
  let state = this._readableState;
  if ((state[kState] & kFlowing) === 0) {
    if (state[kState] |= kHasFlowing, (state[kState] & kReadableListening) === 0)
      state[kState] |= kFlowing;
    else
      state[kState] &= ~kFlowing;
    resume(this, state);
  }
  return state[kState] |= kHasPaused, state[kState] &= ~kPaused, this;
};
function resume(stream, state) {
  if ((state[kState] & kResumeScheduled) === 0)
    state[kState] |= kResumeScheduled, process.nextTick(resume_, stream, state);
}
function resume_(stream, state) {
  if ((state[kState] & kReading) === 0)
    stream.read(0);
  if (state[kState] &= ~kResumeScheduled, stream.emit("resume"), flow(stream), (state[kState] & (kFlowing | kReading)) === kFlowing)
    stream.read(0);
}
Readable.prototype.pause = function() {
  let state = this._readableState;
  if ((state[kState] & (kHasFlowing | kFlowing)) !== kHasFlowing)
    state[kState] |= kHasFlowing, state[kState] &= ~kFlowing, this.emit("pause");
  return state[kState] |= kHasPaused | kPaused, this;
};
function flow(stream) {
  let state = stream._readableState;
  while ((state[kState] & kFlowing) !== 0 && stream.read() !== null)
    ;
}
Readable.prototype.wrap = function(stream) {
  let paused = !1;
  stream.on("data", (chunk) => {
    if (!this.push(chunk) && stream.pause)
      paused = !0, stream.pause();
  }), stream.on("end", () => {
    this.push(null);
  }), stream.on("error", (err) => {
    errorOrDestroy(this, err);
  }), stream.on("close", () => {
    this.destroy();
  }), stream.on("destroy", () => {
    this.destroy();
  }), this._read = () => {
    if (paused && stream.resume)
      paused = !1, stream.resume();
  };
  let streamKeys = ObjectKeys(stream);
  for (let j = 1;j < streamKeys.length; j++) {
    let i = streamKeys[j];
    if (this[i] === @undefined && typeof stream[i] === "function")
      this[i] = stream[i].bind(stream);
  }
  return this;
};
Readable.prototype[SymbolAsyncIterator] = function() {
  return streamToAsyncIterator(this);
};
Readable.prototype.iterator = function(options) {
  if (options !== @undefined)
    validateObject(options, "options");
  return streamToAsyncIterator(this, options);
};
function streamToAsyncIterator(stream, options) {
  if (typeof stream.read !== "function")
    stream = Readable.wrap(stream, { objectMode: !0 });
  let iter = createAsyncIterator(stream, options);
  return iter.stream = stream, iter;
}
async function* createAsyncIterator(stream, options) {
  let callback = nop;
  function next(resolve) {
    if (this === stream)
      callback(), callback = nop;
    else
      callback = resolve;
  }
  stream.on("readable", next);
  let error, cleanup = eos(stream, { writable: !1 }, (err) => {
    error = err ? aggregateTwoErrors(error, err) : null, callback(), callback = nop;
  });
  try {
    while (!0) {
      let chunk = stream.destroyed ? null : stream.read();
      if (chunk !== null)
        yield chunk;
      else if (error)
        throw error;
      else if (error === null)
        return;
      else
        await new @Promise(next);
    }
  } catch (err) {
    throw error = aggregateTwoErrors(error, err), error;
  } finally {
    if ((error || options?.destroyOnReturn !== !1) && (error === @undefined || stream._readableState.autoDestroy))
      destroyImpl.destroyer(stream, null);
    else
      stream.off("readable", next), cleanup();
  }
}
ObjectDefineProperties(Readable.prototype, {
  readable: {
    __proto__: null,
    get() {
      let r = this._readableState;
      return !!r && r.readable !== !1 && !r.destroyed && !r.errorEmitted && !r.endEmitted;
    },
    set(val) {
      if (this._readableState)
        this._readableState.readable = !!val;
    }
  },
  readableDidRead: {
    __proto__: null,
    enumerable: !1,
    get: function() {
      return this._readableState.dataEmitted;
    }
  },
  readableAborted: {
    __proto__: null,
    enumerable: !1,
    get: function() {
      return !!(this._readableState.readable !== !1 && (this._readableState.destroyed || this._readableState.errored) && !this._readableState.endEmitted);
    }
  },
  readableHighWaterMark: {
    __proto__: null,
    enumerable: !1,
    get: function() {
      return this._readableState.highWaterMark;
    }
  },
  readableBuffer: {
    __proto__: null,
    enumerable: !1,
    get: function() {
      return this._readableState?.buffer;
    }
  },
  readableFlowing: {
    __proto__: null,
    enumerable: !1,
    get: function() {
      return this._readableState.flowing;
    },
    set: function(state) {
      if (this._readableState)
        this._readableState.flowing = state;
    }
  },
  readableLength: {
    __proto__: null,
    enumerable: !1,
    get() {
      return this._readableState.length;
    }
  },
  readableObjectMode: {
    __proto__: null,
    enumerable: !1,
    get() {
      return this._readableState ? this._readableState.objectMode : !1;
    }
  },
  readableEncoding: {
    __proto__: null,
    enumerable: !1,
    get() {
      return this._readableState ? this._readableState.encoding : null;
    }
  },
  errored: {
    __proto__: null,
    enumerable: !1,
    get() {
      return this._readableState ? this._readableState.errored : null;
    }
  },
  closed: {
    __proto__: null,
    get() {
      return this._readableState ? this._readableState.closed : !1;
    }
  },
  destroyed: {
    __proto__: null,
    enumerable: !1,
    get() {
      return this._readableState ? this._readableState.destroyed : !1;
    },
    set(value) {
      if (!this._readableState)
        return;
      this._readableState.destroyed = value;
    }
  },
  readableEnded: {
    __proto__: null,
    enumerable: !1,
    get() {
      return this._readableState ? this._readableState.endEmitted : !1;
    }
  }
});
ObjectDefineProperties(ReadableState.prototype, {
  pipesCount: {
    __proto__: null,
    get() {
      return this.pipes.length;
    }
  },
  paused: {
    __proto__: null,
    get() {
      return (this[kState] & kPaused) !== 0;
    },
    set(value) {
      if (this[kState] |= kHasPaused, value)
        this[kState] |= kPaused;
      else
        this[kState] &= ~kPaused;
    }
  }
});
Readable._fromList = fromList;
function fromList(n, state) {
  if (state.length === 0)
    return null;
  let idx = state.bufferIndex, ret, buf = state.buffer, len = buf.length;
  if ((state[kState] & kObjectMode) !== 0)
    ret = buf[idx], buf[idx++] = null;
  else if (!n || n >= state.length)
    if ((state[kState] & kDecoder) !== 0) {
      ret = "";
      while (idx < len)
        ret += buf[idx], buf[idx++] = null;
    } else if (len - idx === 0)
      ret = @Buffer.alloc(0);
    else if (len - idx === 1)
      ret = buf[idx], buf[idx++] = null;
    else {
      ret = @Buffer.allocUnsafe(state.length);
      let i = 0;
      while (idx < len)
        TypedArrayPrototypeSet.@call(ret, buf[idx], i), i += buf[idx].length, buf[idx++] = null;
    }
  else if (n < buf[idx].length)
    ret = buf[idx].slice(0, n), buf[idx] = buf[idx].slice(n);
  else if (n === buf[idx].length)
    ret = buf[idx], buf[idx++] = null;
  else if ((state[kState] & kDecoder) !== 0) {
    ret = "";
    while (idx < len) {
      let str = buf[idx];
      if (n > str.length)
        ret += str, n -= str.length, buf[idx++] = null;
      else {
        if (n === buf.length)
          ret += str, buf[idx++] = null;
        else
          ret += str.slice(0, n), buf[idx] = str.slice(n);
        break;
      }
    }
  } else {
    ret = @Buffer.allocUnsafe(n);
    let retLen = n;
    while (idx < len) {
      let data = buf[idx];
      if (n > data.length)
        TypedArrayPrototypeSet.@call(ret, data, retLen - n), n -= data.length, buf[idx++] = null;
      else {
        if (n === data.length)
          TypedArrayPrototypeSet.@call(ret, data, retLen - n), buf[idx++] = null;
        else
          TypedArrayPrototypeSet.@call(ret, new @Buffer(data.buffer, data.byteOffset, n), retLen - n), buf[idx] = new @Buffer(data.buffer, data.byteOffset + n, data.length - n);
        break;
      }
    }
  }
  if (idx === len)
    state.buffer.length = 0, state.bufferIndex = 0;
  else if (idx > 1024)
    state.buffer.splice(0, idx), state.bufferIndex = 0;
  else
    state.bufferIndex = idx;
  return ret;
}
function endReadable(stream) {
  let state = stream._readableState;
  if ((state[kState] & kEndEmitted) === 0)
    state[kState] |= kEnded, process.nextTick(endReadableNT, state, stream);
}
function endReadableNT(state, stream) {
  if ((state[kState] & (kErrored | kCloseEmitted | kEndEmitted)) === 0 && state.length === 0) {
    if (state[kState] |= kEndEmitted, stream.emit("end"), stream.writable && stream.allowHalfOpen === !1)
      process.nextTick(endWritableNT, stream);
    else if (state.autoDestroy) {
      let wState = stream._writableState;
      if (!wState || wState.autoDestroy && (wState.finished || wState.writable === !1))
        stream[kAutoDestroyed] = !0, stream.destroy();
    }
  }
}
function endWritableNT(stream) {
  if (stream.writable && !stream.writableEnded && !stream.destroyed)
    stream.end();
}
Readable.from = function(iterable, opts) {
  return from(Readable, iterable, opts);
};
var webStreamsAdapters;
function lazyWebStreams() {
  if (webStreamsAdapters === @undefined)
    webStreamsAdapters = @getInternalField(@internalModuleRegistry, 69) || @createInternalModuleById(69);
  return webStreamsAdapters;
}
Readable.fromWeb = function(readableStream, options) {
  return lazyWebStreams().newStreamReadableFromReadableStream(readableStream, options);
};
Readable.toWeb = function(streamReadable, options) {
  return lazyWebStreams().newReadableStreamFromStreamReadable(streamReadable, options);
};
Readable.wrap = function(src, options) {
  return new Readable({
    objectMode: src.readableObjectMode ?? src.objectMode ?? !0,
    ...options,
    destroy(err, callback) {
      destroyImpl.destroyer(src, err), callback(err);
    }
  }).wrap(src);
};
$ = Readable;
return $})

