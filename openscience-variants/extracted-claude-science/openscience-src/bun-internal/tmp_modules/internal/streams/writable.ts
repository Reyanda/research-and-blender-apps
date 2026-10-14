(function (){"use strict";// build/release/tmp_modules/internal/streams/writable.ts
var $, EE = @getInternalField(@internalModuleRegistry, 96) || @createInternalModuleById(96), { Stream } = @getInternalField(@internalModuleRegistry, 50) || @createInternalModuleById(50), destroyImpl = @getInternalField(@internalModuleRegistry, 43) || @createInternalModuleById(43), eos = @getInternalField(@internalModuleRegistry, 47) || @createInternalModuleById(47), { addAbortSignal } = @getInternalField(@internalModuleRegistry, 41) || @createInternalModuleById(41), { getHighWaterMark, getDefaultHighWaterMark } = @getInternalField(@internalModuleRegistry, 56) || @createInternalModuleById(56), {
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
} = @getInternalField(@internalModuleRegistry, 58) || @createInternalModuleById(58), ObjectDefineProperties = Object.defineProperties, ArrayPrototypeSlice = @Array.prototype.slice, ObjectDefineProperty = Object.defineProperty, SymbolHasInstance = Symbol.hasInstance, FunctionPrototypeSymbolHasInstance = Function.prototype[Symbol.hasInstance], StringPrototypeToLowerCase = @String.prototype.toLowerCase, SymbolAsyncDispose = Symbol.asyncDispose, { errorOrDestroy } = destroyImpl;
function nop() {}
var kOnFinishedValue = Symbol("kOnFinishedValue"), kErroredValue = Symbol("kErroredValue"), kDefaultEncodingValue = Symbol("kDefaultEncodingValue"), kWriteCbValue = Symbol("kWriteCbValue"), kAfterWriteTickInfoValue = Symbol("kAfterWriteTickInfoValue"), kBufferedValue = Symbol("kBufferedValue"), kSync = 512, kFinalCalled = 1024, kNeedDrain = 2048, kEnding = 4096, kFinished = 8192, kDecodeStrings = 16384, kWriting = 32768, kBufferProcessing = 65536, kPrefinished = 131072, kAllBuffers = 262144, kAllNoop = 524288, kOnFinished = 1048576, kHasWritable = 2097152, kWritable = 4194304, kCorked = 8388608, kDefaultUTF8Encoding = 16777216, kWriteCb = 33554432, kExpectWriteCb = 67108864, kAfterWriteTickInfo = 134217728, kAfterWritePending = 268435456, kBuffered = 536870912, kEnded = 1073741824;
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
WritableState.prototype = {};
ObjectDefineProperties(WritableState.prototype, {
  objectMode: makeBitMapDescriptor(kObjectMode),
  finalCalled: makeBitMapDescriptor(kFinalCalled),
  needDrain: makeBitMapDescriptor(kNeedDrain),
  ending: makeBitMapDescriptor(kEnding),
  ended: makeBitMapDescriptor(kEnded),
  finished: makeBitMapDescriptor(kFinished),
  destroyed: makeBitMapDescriptor(kDestroyed),
  decodeStrings: makeBitMapDescriptor(kDecodeStrings),
  writing: makeBitMapDescriptor(kWriting),
  sync: makeBitMapDescriptor(kSync),
  bufferProcessing: makeBitMapDescriptor(kBufferProcessing),
  constructed: makeBitMapDescriptor(kConstructed),
  prefinished: makeBitMapDescriptor(kPrefinished),
  errorEmitted: makeBitMapDescriptor(kErrorEmitted),
  emitClose: makeBitMapDescriptor(kEmitClose),
  autoDestroy: makeBitMapDescriptor(kAutoDestroy),
  closed: makeBitMapDescriptor(kClosed),
  closeEmitted: makeBitMapDescriptor(kCloseEmitted),
  allBuffers: makeBitMapDescriptor(kAllBuffers),
  allNoop: makeBitMapDescriptor(kAllNoop),
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
  writable: {
    __proto__: null,
    enumerable: !1,
    get() {
      return (this[kState] & kHasWritable) !== 0 ? (this[kState] & kWritable) !== 0 : @undefined;
    },
    set(value) {
      if (value == null)
        this[kState] &= ~(kHasWritable | kWritable);
      else if (value)
        this[kState] |= kHasWritable | kWritable;
      else
        this[kState] |= kHasWritable, this[kState] &= ~kWritable;
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
  writecb: {
    __proto__: null,
    enumerable: !1,
    get() {
      return (this[kState] & kWriteCb) !== 0 ? this[kWriteCbValue] : nop;
    },
    set(value) {
      if (this[kWriteCbValue] = value, value)
        this[kState] |= kWriteCb;
      else
        this[kState] &= ~kWriteCb;
    }
  },
  afterWriteTickInfo: {
    __proto__: null,
    enumerable: !1,
    get() {
      return (this[kState] & kAfterWriteTickInfo) !== 0 ? this[kAfterWriteTickInfoValue] : null;
    },
    set(value) {
      if (this[kAfterWriteTickInfoValue] = value, value)
        this[kState] |= kAfterWriteTickInfo;
      else
        this[kState] &= ~kAfterWriteTickInfo;
    }
  },
  buffered: {
    __proto__: null,
    enumerable: !1,
    get() {
      return (this[kState] & kBuffered) !== 0 ? this[kBufferedValue] : [];
    },
    set(value) {
      if (this[kBufferedValue] = value, value)
        this[kState] |= kBuffered;
      else
        this[kState] &= ~kBuffered;
    }
  }
});
function WritableState(options, stream, isDuplex) {
  if (this[kState] = kSync | kConstructed | kEmitClose | kAutoDestroy, options?.objectMode)
    this[kState] |= kObjectMode;
  if (isDuplex && options?.writableObjectMode)
    this[kState] |= kObjectMode;
  if (this.highWaterMark = options ? getHighWaterMark(this, options, "writableHighWaterMark", isDuplex) : getDefaultHighWaterMark(!1), !options || options.decodeStrings !== !1)
    this[kState] |= kDecodeStrings;
  if (options && options.emitClose === !1)
    this[kState] &= ~kEmitClose;
  if (options && options.autoDestroy === !1)
    this[kState] &= ~kAutoDestroy;
  let defaultEncoding = options ? options.defaultEncoding : null;
  if (defaultEncoding == null || defaultEncoding === "utf8" || defaultEncoding === "utf-8")
    this[kState] |= kDefaultUTF8Encoding;
  else if (@Buffer.isEncoding(defaultEncoding))
    this[kState] &= ~kDefaultUTF8Encoding, this[kDefaultEncodingValue] = defaultEncoding;
  else
    throw @makeErrorWithCode(254, defaultEncoding);
  this.length = 0, this.corked = 0, this.onwrite = onwrite.bind(@undefined, stream), this.writelen = 0, resetBuffer(this), this.pendingcb = 0;
}
function resetBuffer(state) {
  state[kBufferedValue] = null, state.bufferedIndex = 0, state[kState] |= kAllBuffers | kAllNoop, state[kState] &= ~kBuffered;
}
WritableState.prototype.getBuffer = function getBuffer() {
  return (this[kState] & kBuffered) === 0 ? [] : ArrayPrototypeSlice.@call(this.buffered, this.bufferedIndex);
};
ObjectDefineProperty(WritableState.prototype, "bufferedRequestCount", {
  __proto__: null,
  get() {
    return (this[kState] & kBuffered) === 0 ? 0 : this[kBufferedValue].length - this.bufferedIndex;
  }
});
WritableState.prototype[kOnConstructed] = function onConstructed(stream) {
  if ((this[kState] & kWriting) === 0)
    clearBuffer(stream, this);
  if ((this[kState] & kEnding) !== 0)
    finishMaybe(stream, this);
};
function Writable(options) {
  if (!(this instanceof Writable))
    return new Writable(options);
  if (this._events ??= {
    close: @undefined,
    error: @undefined,
    prefinish: @undefined,
    finish: @undefined,
    drain: @undefined
  }, this._writableState = new WritableState(options, this, !1), options) {
    if (typeof options.write === "function")
      this._write = options.write;
    if (typeof options.writev === "function")
      this._writev = options.writev;
    if (typeof options.destroy === "function")
      this._destroy = options.destroy;
    if (typeof options.final === "function")
      this._final = options.final;
    if (typeof options.construct === "function")
      this._construct = options.construct;
    if (options.signal)
      addAbortSignal(options.signal, this);
  }
  if (Stream.@call(this, options), this._construct != null)
    destroyImpl.construct(this, () => {
      this._writableState[kOnConstructed](this);
    });
}
@toClass(Writable, "Writable", Stream);
Writable.WritableState = WritableState;
ObjectDefineProperty(Writable, SymbolHasInstance, {
  __proto__: null,
  value: function(object) {
    if (FunctionPrototypeSymbolHasInstance.@call(this, object))
      return !0;
    if (this !== Writable)
      return !1;
    return object && object._writableState instanceof WritableState;
  }
});
Writable.prototype.pipe = function() {
  errorOrDestroy(this, @makeErrorWithCode(227));
};
function _write(stream, chunk, encoding, cb) {
  let state = stream._writableState;
  if (cb == null || typeof cb !== "function")
    cb = nop;
  if (chunk === null)
    throw @makeErrorWithCode(229);
  if ((state[kState] & kObjectMode) === 0) {
    if (!encoding)
      encoding = (state[kState] & kDefaultUTF8Encoding) !== 0 ? "utf8" : state.defaultEncoding;
    else if (encoding !== "buffer" && !@Buffer.isEncoding(encoding))
      throw @makeErrorWithCode(254, encoding);
    if (typeof chunk === "string") {
      if ((state[kState] & kDecodeStrings) !== 0)
        chunk = @Buffer.from(chunk, encoding), encoding = "buffer";
    } else if (chunk instanceof @Buffer)
      encoding = "buffer";
    else if (Stream._isArrayBufferView(chunk))
      chunk = Stream._uint8ArrayToBuffer(chunk), encoding = "buffer";
    else
      throw @makeErrorWithCode(118, "chunk", ["string", "Buffer", "TypedArray", "DataView"], chunk);
  }
  let err;
  if ((state[kState] & kEnding) !== 0)
    err = @makeErrorWithCode(236);
  else if ((state[kState] & kDestroyed) !== 0)
    err = @makeErrorWithCode(228, "write");
  if (err)
    return process.nextTick(cb, err), errorOrDestroy(stream, err, !0), err;
  return state.pendingcb++, writeOrBuffer(stream, state, chunk, encoding, cb);
}
Writable.prototype.write = function(chunk, encoding, cb) {
  if (encoding != null && typeof encoding === "function")
    cb = encoding, encoding = null;
  return _write(this, chunk, encoding, cb) === !0;
};
Writable.prototype.cork = function() {
  let state = this._writableState;
  state[kState] |= kCorked, state.corked++;
};
Writable.prototype.uncork = function() {
  let state = this._writableState;
  if (state.corked) {
    if (state.corked--, !state.corked)
      state[kState] &= ~kCorked;
    if ((state[kState] & kWriting) === 0)
      clearBuffer(this, state);
  }
};
Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
  if (typeof encoding === "string")
    encoding = StringPrototypeToLowerCase.@call(encoding);
  if (!@Buffer.isEncoding(encoding))
    throw @makeErrorWithCode(254, encoding);
  return this._writableState.defaultEncoding = encoding, this;
};
function writeOrBuffer(stream, state, chunk, encoding, callback) {
  let len = (state[kState] & kObjectMode) !== 0 ? 1 : chunk.length;
  if (state.length += len, (state[kState] & (kWriting | kErrored | kCorked | kConstructed)) !== kConstructed) {
    if ((state[kState] & kBuffered) === 0)
      state[kState] |= kBuffered, state[kBufferedValue] = [];
    if (state[kBufferedValue].push({ chunk, encoding, callback }), (state[kState] & kAllBuffers) !== 0 && encoding !== "buffer")
      state[kState] &= ~kAllBuffers;
    if ((state[kState] & kAllNoop) !== 0 && callback !== nop)
      state[kState] &= ~kAllNoop;
  } else {
    if (state.writelen = len, callback !== nop)
      state.writecb = callback;
    state[kState] |= kWriting | kSync | kExpectWriteCb, stream._write(chunk, encoding, state.onwrite), state[kState] &= ~kSync;
  }
  let ret = state.length < state.highWaterMark || state.length === 0;
  if (!ret)
    state[kState] |= kNeedDrain;
  return ret && (state[kState] & (kDestroyed | kErrored)) === 0;
}
function doWrite(stream, state, writev, len, chunk, encoding, cb) {
  if (state.writelen = len, cb !== nop)
    state.writecb = cb;
  if (state[kState] |= kWriting | kSync | kExpectWriteCb, (state[kState] & kDestroyed) !== 0)
    state.onwrite(@makeErrorWithCode(228, "write"));
  else if (writev)
    stream._writev(chunk, state.onwrite);
  else
    stream._write(chunk, encoding, state.onwrite);
  state[kState] &= ~kSync;
}
function onwriteError(stream, state, er, cb) {
  --state.pendingcb, cb(er), errorBuffer(state), errorOrDestroy(stream, er);
}
function onwrite(stream, er) {
  let state = stream._writableState;
  if ((state[kState] & kExpectWriteCb) === 0) {
    errorOrDestroy(stream, @makeErrorWithCode(154));
    return;
  }
  let sync = (state[kState] & kSync) !== 0, cb = (state[kState] & kWriteCb) !== 0 ? state[kWriteCbValue] : nop;
  if (state.writecb = null, state[kState] &= ~(kWriting | kExpectWriteCb), state.length -= state.writelen, state.writelen = 0, er) {
    if (er.stack, (state[kState] & kErrored) === 0)
      state[kErroredValue] = er, state[kState] |= kErrored;
    if (stream._readableState && !stream._readableState.errored)
      stream._readableState.errored = er;
    if (sync)
      process.nextTick(onwriteError, stream, state, er, cb);
    else
      onwriteError(stream, state, er, cb);
  } else {
    if ((state[kState] & kBuffered) !== 0)
      clearBuffer(stream, state);
    if (sync) {
      let needTick = (state[kState] & kNeedDrain) !== 0 && state.length === 0 || state[kState] & Number(kDestroyed !== 0) || cb !== nop;
      if (cb === nop) {
        if ((state[kState] & kAfterWritePending) === 0 && needTick)
          process.nextTick(afterWrite, stream, state, 1, cb), state[kState] |= kAfterWritePending;
        else if (state.pendingcb--, (state[kState] & kEnding) !== 0)
          finishMaybe(stream, state, !0);
      } else if ((state[kState] & kAfterWriteTickInfo) !== 0 && state[kAfterWriteTickInfoValue].cb === cb)
        state[kAfterWriteTickInfoValue].count++;
      else if (needTick)
        state[kAfterWriteTickInfoValue] = { count: 1, cb, stream, state }, process.nextTick(afterWriteTick, state[kAfterWriteTickInfoValue]), state[kState] |= kAfterWritePending | kAfterWriteTickInfo;
      else if (state.pendingcb--, (state[kState] & kEnding) !== 0)
        finishMaybe(stream, state, !0);
    } else
      afterWrite(stream, state, 1, cb);
  }
}
function afterWriteTick({ stream, state, count, cb }) {
  return state[kState] &= ~kAfterWriteTickInfo, state[kAfterWriteTickInfoValue] = null, afterWrite(stream, state, count, cb);
}
function afterWrite(stream, state, count, cb) {
  if (state[kState] &= ~kAfterWritePending, (state[kState] & (kEnding | kNeedDrain | kDestroyed)) === kNeedDrain && state.length === 0)
    state[kState] &= ~kNeedDrain, stream.emit("drain");
  while (count-- > 0)
    state.pendingcb--, cb(null);
  if ((state[kState] & kDestroyed) !== 0)
    errorBuffer(state);
  if ((state[kState] & kEnding) !== 0)
    finishMaybe(stream, state, !0);
}
function errorBuffer(state) {
  if ((state[kState] & kWriting) !== 0)
    return;
  if ((state[kState] & kBuffered) !== 0)
    for (let n = state.bufferedIndex;n < state.buffered.length; ++n) {
      let { chunk, callback } = state[kBufferedValue][n], len = (state[kState] & kObjectMode) !== 0 ? 1 : chunk.length;
      state.length -= len, callback(state.errored ?? @makeErrorWithCode(228, "write"));
    }
  callFinishedCallbacks(state, state.errored ?? @makeErrorWithCode(228, "end")), resetBuffer(state);
}
function clearBuffer(stream, state) {
  if ((state[kState] & (kDestroyed | kBufferProcessing | kCorked | kBuffered | kConstructed)) !== (kBuffered | kConstructed))
    return;
  let objectMode = (state[kState] & kObjectMode) !== 0, { [kBufferedValue]: buffered, bufferedIndex } = state, bufferedLength = buffered.length - bufferedIndex;
  if (!bufferedLength)
    return;
  let i = bufferedIndex;
  if (state[kState] |= kBufferProcessing, bufferedLength > 1 && stream._writev) {
    state.pendingcb -= bufferedLength - 1;
    let callback = (state[kState] & kAllNoop) !== 0 ? nop : (err) => {
      for (let n = i;n < buffered.length; ++n)
        buffered[n].callback(err);
    }, chunks = (state[kState] & kAllNoop) !== 0 && i === 0 ? buffered : ArrayPrototypeSlice.@call(buffered, i);
    chunks.allBuffers = (state[kState] & kAllBuffers) !== 0, doWrite(stream, state, !0, state.length, chunks, "", callback), resetBuffer(state);
  } else {
    do {
      let { chunk, encoding, callback } = buffered[i];
      buffered[i++] = null;
      let len = objectMode ? 1 : chunk.length;
      doWrite(stream, state, !1, len, chunk, encoding, callback);
    } while (i < buffered.length && (state[kState] & kWriting) === 0);
    if (i === buffered.length)
      resetBuffer(state);
    else if (i > 256)
      buffered.splice(0, i), state.bufferedIndex = 0;
    else
      state.bufferedIndex = i;
  }
  state[kState] &= ~kBufferProcessing;
}
Writable.prototype._write = function(chunk, encoding, cb) {
  if (this._writev)
    this._writev([{ chunk, encoding }], cb);
  else
    throw @makeErrorWithCode(149, "_write()");
};
Writable.prototype._writev = null;
Writable.prototype.end = function(chunk, encoding, cb) {
  let state = this._writableState;
  if (typeof chunk === "function")
    cb = chunk, chunk = null, encoding = null;
  else if (typeof encoding === "function")
    cb = encoding, encoding = null;
  let err;
  if (chunk != null) {
    let ret = _write(this, chunk, encoding);
    if (Error.isError(ret))
      err = ret;
  }
  if ((state[kState] & kCorked) !== 0)
    state.corked = 1, this.uncork();
  if (err)
    ;
  else if ((state[kState] & (kEnding | kErrored)) === 0)
    state[kState] |= kEnding, finishMaybe(this, state, !0), state[kState] |= kEnded;
  else if ((state[kState] & kFinished) !== 0)
    err = @makeErrorWithCode(226, "end");
  else if ((state[kState] & kDestroyed) !== 0)
    err = @makeErrorWithCode(228, "end");
  if (typeof cb === "function")
    if (err)
      process.nextTick(cb, err);
    else if ((state[kState] & kErrored) !== 0)
      process.nextTick(cb, state[kErroredValue]);
    else if ((state[kState] & kFinished) !== 0)
      process.nextTick(cb, null);
    else
      state[kState] |= kOnFinished, state[kOnFinishedValue] ??= [], state[kOnFinishedValue].push(cb);
  return this;
};
function needFinish(state) {
  return (state[kState] & (kEnding | kDestroyed | kConstructed | kFinished | kWriting | kErrorEmitted | kCloseEmitted | kErrored | kBuffered)) === (kEnding | kConstructed) && state.length === 0;
}
function onFinish(stream, state, err) {
  if ((state[kState] & kPrefinished) !== 0) {
    errorOrDestroy(stream, err ?? @makeErrorWithCode(154));
    return;
  }
  if (state.pendingcb--, err)
    callFinishedCallbacks(state, err), errorOrDestroy(stream, err, (state[kState] & kSync) !== 0);
  else if (needFinish(state))
    state[kState] |= kPrefinished, stream.emit("prefinish"), state.pendingcb++, process.nextTick(finish, stream, state);
}
function prefinish(stream, state) {
  if ((state[kState] & (kPrefinished | kFinalCalled)) !== 0)
    return;
  if (typeof stream._final === "function" && (state[kState] & kDestroyed) === 0) {
    state[kState] |= kFinalCalled | kSync, state.pendingcb++;
    try {
      stream._final((err) => onFinish(stream, state, err));
    } catch (err) {
      onFinish(stream, state, err);
    }
    state[kState] &= ~kSync;
  } else
    state[kState] |= kFinalCalled | kPrefinished, stream.emit("prefinish");
}
function finishMaybe(stream, state, sync) {
  if (needFinish(state)) {
    if (prefinish(stream, state), state.pendingcb === 0) {
      if (sync)
        state.pendingcb++, process.nextTick((stream2, state2) => {
          if (needFinish(state2))
            finish(stream2, state2);
          else
            state2.pendingcb--;
        }, stream, state);
      else if (needFinish(state))
        state.pendingcb++, finish(stream, state);
    }
  }
}
function finish(stream, state) {
  if (state.pendingcb--, state[kState] |= kFinished, callFinishedCallbacks(state, null), stream.emit("finish"), (state[kState] & kAutoDestroy) !== 0) {
    let rState = stream._readableState;
    if (!rState || rState.autoDestroy && (rState.endEmitted || rState.readable === !1))
      stream.destroy();
  }
}
function callFinishedCallbacks(state, err) {
  if ((state[kState] & kOnFinished) === 0)
    return;
  let onfinishCallbacks = state[kOnFinishedValue];
  state[kOnFinishedValue] = null, state[kState] &= ~kOnFinished;
  for (let i = 0;i < onfinishCallbacks.length; i++)
    onfinishCallbacks[i](err);
}
ObjectDefineProperties(Writable.prototype, {
  closed: {
    __proto__: null,
    get() {
      return this._writableState ? (this._writableState[kState] & kClosed) !== 0 : !1;
    }
  },
  destroyed: {
    __proto__: null,
    get() {
      return this._writableState ? (this._writableState[kState] & kDestroyed) !== 0 : !1;
    },
    set(value) {
      if (!this._writableState)
        return;
      if (value)
        this._writableState[kState] |= kDestroyed;
      else
        this._writableState[kState] &= ~kDestroyed;
    }
  },
  writable: {
    __proto__: null,
    get() {
      let w = this._writableState;
      return !!w && w.writable !== !1 && (w[kState] & (kEnding | kEnded | kDestroyed | kErrored)) === 0;
    },
    set(val) {
      if (this._writableState)
        this._writableState.writable = !!val;
    }
  },
  writableFinished: {
    __proto__: null,
    get() {
      let state = this._writableState;
      return state ? (state[kState] & kFinished) !== 0 : !1;
    }
  },
  writableObjectMode: {
    __proto__: null,
    get() {
      let state = this._writableState;
      return state ? (state[kState] & kObjectMode) !== 0 : !1;
    }
  },
  writableBuffer: {
    __proto__: null,
    get() {
      let state = this._writableState;
      return state && state.getBuffer();
    }
  },
  writableEnded: {
    __proto__: null,
    get() {
      let state = this._writableState;
      return state ? (state[kState] & kEnding) !== 0 : !1;
    }
  },
  writableNeedDrain: {
    __proto__: null,
    get() {
      let state = this._writableState;
      return state ? (state[kState] & (kDestroyed | kEnding | kNeedDrain)) === kNeedDrain : !1;
    }
  },
  writableHighWaterMark: {
    __proto__: null,
    get() {
      return this._writableState?.highWaterMark;
    }
  },
  writableCorked: {
    __proto__: null,
    get() {
      let state = this._writableState;
      return state ? state.corked : 0;
    }
  },
  writableLength: {
    __proto__: null,
    get() {
      return this._writableState?.length;
    }
  },
  errored: {
    __proto__: null,
    enumerable: !1,
    get() {
      let state = this._writableState;
      return state ? state.errored : null;
    }
  },
  writableAborted: {
    __proto__: null,
    get: function() {
      let state = this._writableState;
      return (state[kState] & (kHasWritable | kWritable)) !== kHasWritable && (state[kState] & (kDestroyed | kErrored)) !== 0 && (state[kState] & kFinished) === 0;
    }
  }
});
var destroy = destroyImpl.destroy;
Writable.prototype.destroy = function(err, cb) {
  let state = this._writableState;
  if ((state[kState] & (kBuffered | kOnFinished)) !== 0 && (state[kState] & kDestroyed) === 0)
    process.nextTick(errorBuffer, state);
  return destroy.@call(this, err, cb), this;
};
Writable.prototype._undestroy = destroyImpl.undestroy;
Writable.prototype._destroy = function(err, cb) {
  cb(err);
};
Writable.prototype[EE.captureRejectionSymbol] = function(err) {
  this.destroy(err);
};
var webStreamsAdapters;
function lazyWebStreams() {
  if (webStreamsAdapters === @undefined)
    webStreamsAdapters = @getInternalField(@internalModuleRegistry, 69) || @createInternalModuleById(69);
  return webStreamsAdapters;
}
Writable.fromWeb = function(writableStream, options) {
  return lazyWebStreams().newStreamWritableFromWritableStream(writableStream, options);
};
Writable.toWeb = function(streamWritable) {
  return lazyWebStreams().newWritableStreamFromStreamWritable(streamWritable);
};
Writable.prototype[SymbolAsyncDispose] = function() {
  let error;
  if (!this.destroyed)
    error = this.writableFinished ? null : @makeAbortError(), this.destroy(error);
  return new @Promise((resolve, reject) => eos(this, (err) => err && err.name !== "AbortError" ? reject(err) : resolve(null)));
};
$ = Writable;
return $})

