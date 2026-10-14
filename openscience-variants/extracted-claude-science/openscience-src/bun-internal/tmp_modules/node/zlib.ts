(function (){"use strict";// build/release/tmp_modules/node/zlib.ts
var $, BufferModule = @getInternalField(@internalModuleRegistry, 141) || @createInternalModuleById(141), crc32 = @lazy(91), NativeZlib = @lazy(92), NativeBrotli = @lazy(93), NativeZstd = @lazy(94), ObjectKeys = Object.keys, ArrayPrototypePush = @Array.prototype.push, ObjectDefineProperty = Object.defineProperty, ObjectDefineProperties = Object.defineProperties, ObjectFreeze = Object.freeze, TypedArrayPrototypeFill = @Uint8Array.prototype.fill, ArrayPrototypeForEach = @Array.prototype.forEach, NumberIsNaN = Number.isNaN, MathMax = Math.max, ArrayBufferIsView = @ArrayBuffer.isView, isArrayBufferView = ArrayBufferIsView, isAnyArrayBuffer = (b) => b instanceof @ArrayBuffer || b instanceof SharedArrayBuffer, kMaxLength = @requireMap.@get("buffer")?.exports.kMaxLength ?? BufferModule.kMaxLength, { Transform, finished } = @getInternalField(@internalModuleRegistry, 117) || @createInternalModuleById(117), owner_symbol = Symbol("owner_symbol"), { checkRangesOrGetDefault, validateFunction, validateFiniteNumber } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), kFlushFlag = Symbol("kFlushFlag"), kError = Symbol("kError"), { zlib: constants } = process.binding("constants"), {
  Z_NO_FLUSH,
  Z_BLOCK,
  Z_PARTIAL_FLUSH,
  Z_SYNC_FLUSH,
  Z_FULL_FLUSH,
  Z_FINISH,
  Z_MIN_CHUNK,
  Z_MIN_WINDOWBITS,
  Z_MAX_WINDOWBITS,
  Z_MIN_LEVEL,
  Z_MAX_LEVEL,
  Z_MIN_MEMLEVEL,
  Z_MAX_MEMLEVEL,
  Z_DEFAULT_CHUNK,
  Z_DEFAULT_COMPRESSION,
  Z_DEFAULT_STRATEGY,
  Z_DEFAULT_WINDOWBITS,
  Z_DEFAULT_MEMLEVEL,
  Z_FIXED,
  DEFLATE,
  DEFLATERAW,
  INFLATE,
  INFLATERAW,
  GZIP,
  GUNZIP,
  UNZIP,
  BROTLI_DECODE,
  BROTLI_ENCODE,
  ZSTD_COMPRESS,
  ZSTD_DECOMPRESS,
  BROTLI_OPERATION_PROCESS,
  BROTLI_OPERATION_FLUSH,
  BROTLI_OPERATION_FINISH,
  BROTLI_OPERATION_EMIT_METADATA,
  ZSTD_e_continue,
  ZSTD_e_flush,
  ZSTD_e_end
} = constants, codes = {
  Z_OK: constants.Z_OK,
  Z_STREAM_END: constants.Z_STREAM_END,
  Z_NEED_DICT: constants.Z_NEED_DICT,
  Z_ERRNO: constants.Z_ERRNO,
  Z_STREAM_ERROR: constants.Z_STREAM_ERROR,
  Z_DATA_ERROR: constants.Z_DATA_ERROR,
  Z_MEM_ERROR: constants.Z_MEM_ERROR,
  Z_BUF_ERROR: constants.Z_BUF_ERROR,
  Z_VERSION_ERROR: constants.Z_VERSION_ERROR
};
for (let ckey of ObjectKeys(codes))
  codes[codes[ckey]] = ckey;
function zlibBuffer(engine, buffer, callback) {
  if (validateFunction(callback, "callback"), isArrayBufferView(buffer))
    buffer = @Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  else if (isAnyArrayBuffer(buffer))
    buffer = @Buffer.from(buffer);
  engine.buffers = null, engine.nread = 0, engine.cb = callback, engine.on("data", zlibBufferOnData), engine.on("error", zlibBufferOnError), engine.on("end", zlibBufferOnEnd), engine.end(buffer);
}
function zlibBufferOnData(chunk) {
  if (!this.buffers)
    this.buffers = [chunk];
  else
    ArrayPrototypePush.@call(this.buffers, chunk);
  if (this.nread += chunk.length, this.nread > this._maxOutputLength)
    this.close(), this.removeAllListeners("end"), this.cb(@makeErrorWithCode(13, this._maxOutputLength));
}
function zlibBufferOnError(err) {
  this.removeAllListeners("end"), this.cb(err);
}
function zlibBufferOnEnd() {
  let buf;
  if (this.nread === 0)
    buf = @Buffer.alloc(0);
  else {
    let bufs = this.buffers;
    buf = bufs.length === 1 ? bufs[0] : @Buffer.concat(bufs, this.nread);
  }
  if (this.close(), this._info)
    this.cb(null, { buffer: buf, engine: this });
  else
    this.cb(null, buf);
}
function zlibBufferSync(engine, buffer) {
  if (typeof buffer === "string")
    buffer = @Buffer.from(buffer);
  else if (!isArrayBufferView(buffer))
    if (isAnyArrayBuffer(buffer))
      buffer = @Buffer.from(buffer);
    else
      throw @makeErrorWithCode(118, "buffer", "string, Buffer, TypedArray, DataView, or ArrayBuffer", buffer);
  if (buffer = processChunkSync(engine, buffer, engine._finishFlushFlag), engine._info)
    return { buffer, engine };
  return buffer;
}
function zlibOnError(message, errno, code) {
  let self = this[owner_symbol], error = Error(message);
  error.errno = errno, error.code = code, self.destroy(error), self[kError] = error;
}
var FLUSH_BOUND = [
  [Z_NO_FLUSH, Z_BLOCK],
  [BROTLI_OPERATION_PROCESS, BROTLI_OPERATION_EMIT_METADATA],
  [ZSTD_e_continue, ZSTD_e_end]
], FLUSH_BOUND_IDX_NORMAL = 0, FLUSH_BOUND_IDX_BROTLI = 1, FLUSH_BOUND_IDX_ZSTD = 2;
function ZlibBase(opts, mode, handle, { flush, finishFlush, fullFlush }) {
  let chunkSize = Z_DEFAULT_CHUNK, maxOutputLength = kMaxLength, flushBoundIdx;
  if (mode === BROTLI_ENCODE || mode === BROTLI_DECODE)
    flushBoundIdx = FLUSH_BOUND_IDX_BROTLI;
  else if (mode === ZSTD_COMPRESS || mode === ZSTD_DECOMPRESS)
    flushBoundIdx = FLUSH_BOUND_IDX_ZSTD;
  else
    flushBoundIdx = FLUSH_BOUND_IDX_NORMAL;
  if (opts) {
    if (chunkSize = opts.chunkSize, !validateFiniteNumber(chunkSize, "options.chunkSize"))
      chunkSize = Z_DEFAULT_CHUNK;
    else if (chunkSize < Z_MIN_CHUNK)
      throw @makeErrorWithCode(156, "options.chunkSize", `>= ${Z_MIN_CHUNK}`, chunkSize);
    if (flush = checkRangesOrGetDefault(opts.flush, "options.flush", FLUSH_BOUND[flushBoundIdx][0], FLUSH_BOUND[flushBoundIdx][1], flush), finishFlush = checkRangesOrGetDefault(opts.finishFlush, "options.finishFlush", FLUSH_BOUND[flushBoundIdx][0], FLUSH_BOUND[flushBoundIdx][1], finishFlush), maxOutputLength = checkRangesOrGetDefault(opts.maxOutputLength, "options.maxOutputLength", 1, kMaxLength, kMaxLength), opts.encoding || opts.objectMode || opts.writableObjectMode)
      opts = { ...opts }, opts.encoding = null, opts.objectMode = !1, opts.writableObjectMode = !1;
  }
  Transform.@apply(this, [{ autoDestroy: !0, ...opts }]), this[kError] = null, this.bytesWritten = 0, this._handle = handle, handle[owner_symbol] = this, handle.onerror = zlibOnError, this._outBuffer = @Buffer.allocUnsafe(chunkSize), this._outOffset = 0, this._chunkSize = chunkSize, this._defaultFlushFlag = flush, this._finishFlushFlag = finishFlush, this._defaultFullFlushFlag = fullFlush, this._info = opts && opts.info, this._maxOutputLength = maxOutputLength;
}
@toClass(ZlibBase, "ZlibBase", Transform);
ObjectDefineProperty(ZlibBase.prototype, "_closed", {
  configurable: !0,
  enumerable: !0,
  get() {
    return !this._handle;
  }
});
ObjectDefineProperty(ZlibBase.prototype, "bytesRead", {
  configurable: !0,
  get: function() {
    return this.bytesWritten;
  },
  set: function(value) {
    this.bytesWritten = value;
  }
});
ZlibBase.prototype.reset = function() {
  return this._handle.reset();
};
ZlibBase.prototype._flush = function(callback) {
  this._transform(@Buffer.alloc(0), "", callback);
};
ZlibBase.prototype._final = function(callback) {
  callback();
};
var flushiness = [], kFlushFlagList = [Z_NO_FLUSH, Z_BLOCK, Z_PARTIAL_FLUSH, Z_SYNC_FLUSH, Z_FULL_FLUSH, Z_FINISH];
for (let i = 0;i < kFlushFlagList.length; i++)
  flushiness[kFlushFlagList[i]] = i;
function maxFlush(a, b) {
  return flushiness[a] > flushiness[b] ? a : b;
}
var kFlushBuffers = [];
{
  let dummyArrayBuffer = new @ArrayBuffer;
  for (let flushFlag of kFlushFlagList)
    kFlushBuffers[flushFlag] = @Buffer.from(dummyArrayBuffer), kFlushBuffers[flushFlag][kFlushFlag] = flushFlag;
}
ZlibBase.prototype.flush = function(kind, callback) {
  if (typeof kind === "function" || kind === @undefined && !callback)
    callback = kind, kind = this._defaultFullFlushFlag;
  if (this.writableFinished) {
    if (callback)
      process.nextTick(callback);
  } else if (this.writableEnded) {
    if (callback)
      this.once("end", callback);
  } else
    this.write(kFlushBuffers[kind], "", callback);
};
ZlibBase.prototype.close = function(callback) {
  if (callback)
    finished(this, callback);
  this.destroy();
};
ZlibBase.prototype._destroy = function(err, callback) {
  _close(this), callback(err);
};
ZlibBase.prototype._transform = function(chunk, encoding, cb) {
  let flushFlag = this._defaultFlushFlag;
  if (typeof chunk[kFlushFlag] === "number")
    flushFlag = chunk[kFlushFlag];
  if (this.writableEnded && this.writableLength === chunk.byteLength)
    flushFlag = maxFlush(flushFlag, this._finishFlushFlag);
  processChunk(this, chunk, flushFlag, cb);
};
ZlibBase.prototype._processChunk = function(chunk, flushFlag, cb) {
  if (typeof cb === "function")
    processChunk(this, chunk, flushFlag, cb);
  else
    return processChunkSync(this, chunk, flushFlag);
};
function processChunkSync(self, chunk, flushFlag) {
  let availInBefore = chunk.byteLength, availOutBefore = self._chunkSize - self._outOffset, inOff = 0, availOutAfter, availInAfter, buffers = [], nread = 0, inputRead = 0, state = self._writeState, handle = self._handle, buffer = self._outBuffer, offset = self._outOffset, chunkSize = self._chunkSize, error;
  self.on("error", function onError(er) {
    error = er;
  });
  while (!0) {
    if (handle.writeSync(flushFlag, chunk, inOff, availInBefore, buffer, offset, availOutBefore), error) {
      if (typeof error === "string")
        error = Error(error);
      else if (!Error.isError(error))
        error = Error(@String(error));
      throw error;
    } else if (self[kError])
      throw self[kError];
    availOutAfter = state[0], availInAfter = state[1];
    let inDelta = availInBefore - availInAfter;
    inputRead += inDelta;
    let have = availOutBefore - availOutAfter;
    if (have > 0) {
      let out = buffer.slice(offset, offset + have);
      if (offset += have, ArrayPrototypePush.@call(buffers, out), nread += out.byteLength, nread > self._maxOutputLength)
        throw _close(self), @makeErrorWithCode(13, self._maxOutputLength);
    }
    if (availOutAfter === 0 || offset >= chunkSize)
      availOutBefore = chunkSize, offset = 0, buffer = @Buffer.allocUnsafe(chunkSize);
    if (availOutAfter === 0)
      inOff += inDelta, availInBefore = availInAfter;
    else
      break;
  }
  if (self.bytesWritten = inputRead, _close(self), nread === 0)
    return @Buffer.alloc(0);
  return buffers.length === 1 ? buffers[0] : @Buffer.concat(buffers, nread);
}
function processChunk(self, chunk, flushFlag, cb) {
  let handle = self._handle;
  if (!handle)
    return process.nextTick(cb);
  handle.buffer = chunk, handle.cb = cb, handle.availOutBefore = self._chunkSize - self._outOffset, handle.availInBefore = chunk.byteLength, handle.inOff = 0, handle.flushFlag = flushFlag, handle.write(flushFlag, chunk, 0, handle.availInBefore, self._outBuffer, self._outOffset, handle.availOutBefore);
}
function processCallback() {
  let handle = this, self = this[owner_symbol], state = self._writeState;
  if (self.destroyed) {
    this.buffer = null, this.cb();
    return;
  }
  let availOutAfter = state[0], availInAfter = state[1], inDelta = handle.availInBefore - availInAfter;
  self.bytesWritten += inDelta;
  let have = handle.availOutBefore - availOutAfter, streamBufferIsFull = !1;
  if (have > 0) {
    let out = self._outBuffer.slice(self._outOffset, self._outOffset + have);
    self._outOffset += have, streamBufferIsFull = !self.push(out);
  }
  if (self.destroyed) {
    this.cb();
    return;
  }
  if (availOutAfter === 0 || self._outOffset >= self._chunkSize)
    handle.availOutBefore = self._chunkSize, self._outOffset = 0, self._outBuffer = @Buffer.allocUnsafe(self._chunkSize);
  if (availOutAfter === 0) {
    if (handle.inOff += inDelta, handle.availInBefore = availInAfter, !streamBufferIsFull)
      this.write(handle.flushFlag, this.buffer, handle.inOff, handle.availInBefore, self._outBuffer, self._outOffset, self._chunkSize);
    else {
      let oldRead = self._read;
      self._read = (n) => {
        self._read = oldRead, this.write(handle.flushFlag, this.buffer, handle.inOff, handle.availInBefore, self._outBuffer, self._outOffset, self._chunkSize), self._read(n);
      };
    }
    return;
  }
  if (availInAfter > 0)
    self.push(null);
  this.buffer = null, this.cb();
}
function _close(engine) {
  engine._handle?.close(), engine._handle = null;
}
var zlibDefaultOpts = {
  flush: Z_NO_FLUSH,
  finishFlush: Z_FINISH,
  fullFlush: Z_FULL_FLUSH
};
function Zlib(opts, mode) {
  let windowBits = Z_DEFAULT_WINDOWBITS, level = Z_DEFAULT_COMPRESSION, memLevel = Z_DEFAULT_MEMLEVEL, strategy = Z_DEFAULT_STRATEGY, dictionary;
  if (opts) {
    if ((opts.windowBits == null || opts.windowBits === 0) && (mode === INFLATE || mode === GUNZIP || mode === UNZIP))
      windowBits = 0;
    else {
      let min = Z_MIN_WINDOWBITS + (mode === GZIP ? 1 : 0);
      windowBits = checkRangesOrGetDefault(opts.windowBits, "options.windowBits", min, Z_MAX_WINDOWBITS, Z_DEFAULT_WINDOWBITS);
    }
    if (level = checkRangesOrGetDefault(opts.level, "options.level", Z_MIN_LEVEL, Z_MAX_LEVEL, Z_DEFAULT_COMPRESSION), memLevel = checkRangesOrGetDefault(opts.memLevel, "options.memLevel", Z_MIN_MEMLEVEL, Z_MAX_MEMLEVEL, Z_DEFAULT_MEMLEVEL), strategy = checkRangesOrGetDefault(opts.strategy, "options.strategy", Z_DEFAULT_STRATEGY, Z_FIXED, Z_DEFAULT_STRATEGY), dictionary = opts.dictionary, dictionary !== @undefined && !isArrayBufferView(dictionary))
      if (isAnyArrayBuffer(dictionary))
        dictionary = @Buffer.from(dictionary);
      else
        throw @makeErrorWithCode(118, "options.dictionary", "Buffer, TypedArray, DataView, or ArrayBuffer", dictionary);
  }
  let handle = new NativeZlib(mode);
  this._writeState = new Uint32Array(2), handle.init(windowBits, level, memLevel, strategy, this._writeState, processCallback, dictionary), ZlibBase.@apply(this, [opts, mode, handle, zlibDefaultOpts]), this._level = level, this._strategy = strategy;
}
@toClass(Zlib, "Zlib", ZlibBase);
function paramsAfterFlushCallback(level, strategy, callback) {
  if (this._handle.params(level, strategy), !this.destroyed) {
    if (this._level = level, this._strategy = strategy, callback)
      callback();
  }
}
Zlib.prototype.params = function params(level, strategy, callback) {
  if (checkRangesOrGetDefault(level, "level", Z_MIN_LEVEL, Z_MAX_LEVEL), checkRangesOrGetDefault(strategy, "strategy", Z_DEFAULT_STRATEGY, Z_FIXED), this._level !== level || this._strategy !== strategy)
    this.flush(Z_SYNC_FLUSH, paramsAfterFlushCallback.bind(this, level, strategy, callback));
  else
    process.nextTick(callback);
};
function Deflate(opts) {
  if (!(this instanceof Deflate))
    return new Deflate(opts);
  Zlib.@apply(this, [opts, DEFLATE]);
}
@toClass(Deflate, "Deflate", Zlib);
function Inflate(opts) {
  if (!(this instanceof Inflate))
    return new Inflate(opts);
  Zlib.@apply(this, [opts, INFLATE]);
}
@toClass(Inflate, "Inflate", Zlib);
function Gzip(opts) {
  if (!(this instanceof Gzip))
    return new Gzip(opts);
  Zlib.@apply(this, [opts, GZIP]);
}
@toClass(Gzip, "Gzip", Zlib);
function Gunzip(opts) {
  if (!(this instanceof Gunzip))
    return new Gunzip(opts);
  Zlib.@apply(this, [opts, GUNZIP]);
}
@toClass(Gunzip, "Gunzip", Zlib);
function DeflateRaw(opts) {
  if (opts && opts.windowBits === 8)
    opts.windowBits = 9;
  if (!(this instanceof DeflateRaw))
    return new DeflateRaw(opts);
  Zlib.@apply(this, [opts, DEFLATERAW]);
}
@toClass(DeflateRaw, "DeflateRaw", Zlib);
function InflateRaw(opts) {
  if (!(this instanceof InflateRaw))
    return new InflateRaw(opts);
  Zlib.@apply(this, [opts, INFLATERAW]);
}
@toClass(InflateRaw, "InflateRaw", Zlib);
function Unzip(opts) {
  if (!(this instanceof Unzip))
    return new Unzip(opts);
  Zlib.@apply(this, [opts, UNZIP]);
}
@toClass(Unzip, "Unzip", Zlib);
function createConvenienceMethod(ctor, sync, methodName, isZstd) {
  if (sync) {
    let fn = function(buffer, opts) {
      return zlibBufferSync(new ctor(opts), buffer);
    };
    return ObjectDefineProperty(fn, "name", { value: methodName }), fn;
  } else {
    let fn = function(buffer, opts, callback) {
      if (typeof opts === "function")
        callback = opts, opts = {};
      if (isZstd) {
        let bufferSize;
        if (typeof buffer === "string")
          bufferSize = @Buffer.byteLength(buffer);
        else if (isArrayBufferView(buffer))
          bufferSize = buffer.byteLength;
        else if (isAnyArrayBuffer(buffer))
          bufferSize = buffer.byteLength;
        else
          bufferSize = 0;
        if (!opts.pledgedSrcSize && bufferSize > 0)
          opts = { ...opts, pledgedSrcSize: bufferSize };
      }
      return zlibBuffer(new ctor(opts), buffer, callback);
    };
    return ObjectDefineProperty(fn, "name", { value: methodName }), fn;
  }
}
var kMaxBrotliParam = 9, brotliInitParamsArray = new Uint32Array(kMaxBrotliParam + 1), brotliDefaultOpts = {
  flush: BROTLI_OPERATION_PROCESS,
  finishFlush: BROTLI_OPERATION_FINISH,
  fullFlush: BROTLI_OPERATION_FLUSH
};
function Brotli(opts, mode) {
  if (TypedArrayPrototypeFill.@call(brotliInitParamsArray, -1), opts?.params)
    ArrayPrototypeForEach.@call(ObjectKeys(opts.params), (origKey) => {
      let key = +origKey;
      if (NumberIsNaN(key) || key < 0 || key > kMaxBrotliParam || (brotliInitParamsArray[key] | 0) !== -1)
        throw @makeErrorWithCode(10, origKey);
      let value = opts.params[origKey];
      if (typeof value !== "number" && typeof value !== "boolean")
        throw @makeErrorWithCode(118, "options.params[key]", "number", opts.params[origKey]);
      brotliInitParamsArray[key] = value;
    });
  let handle = new NativeBrotli(mode);
  if (this._writeState = new Uint32Array(2), !handle.init(brotliInitParamsArray, this._writeState, processCallback))
    throw @makeErrorWithCode(262);
  ZlibBase.@apply(this, [opts, mode, handle, brotliDefaultOpts]);
}
@toClass(Brotli, "Brotli", Zlib);
function BrotliCompress(opts) {
  if (!(this instanceof BrotliCompress))
    return new BrotliCompress(opts);
  Brotli.@apply(this, [opts, BROTLI_ENCODE]);
}
@toClass(BrotliCompress, "BrotliCompress", Brotli);
function BrotliDecompress(opts) {
  if (!(this instanceof BrotliDecompress))
    return new BrotliDecompress(opts);
  Brotli.@apply(this, [opts, BROTLI_DECODE]);
}
@toClass(BrotliDecompress, "BrotliDecompress", Brotli);
var zstdDefaultOpts = {
  flush: ZSTD_e_continue,
  finishFlush: ZSTD_e_end,
  fullFlush: ZSTD_e_flush
};

class Zstd extends ZlibBase {
  constructor(opts, mode, initParamsArray, maxParam) {
    if (initParamsArray.fill(-1), opts?.params)
      ObjectKeys(opts.params).forEach((origKey) => {
        let key = +origKey;
        if (NumberIsNaN(key) || key < 0 || key > maxParam || (initParamsArray[key] | 0) !== -1)
          throw @makeErrorWithCode(256, origKey);
        let value = opts.params[origKey];
        if (typeof value !== "number" && typeof value !== "boolean")
          throw @makeErrorWithCode(118, "options.params[key]", "number", opts.params[origKey]);
        initParamsArray[key] = value;
      });
    let handle = new NativeZstd(mode), pledgedSrcSize = opts?.pledgedSrcSize ?? @undefined, writeState = new Uint32Array(2);
    handle.init(initParamsArray, pledgedSrcSize, writeState, processCallback);
    super(opts, mode, handle, zstdDefaultOpts);
    this._writeState = writeState;
  }
}
var kMaxZstdCParam = MathMax(...ObjectKeys(constants).map((key) => key.startsWith("ZSTD_c_") ? constants[key] : 0)), zstdInitCParamsArray = new Uint32Array(kMaxZstdCParam + 1);

class ZstdCompress extends Zstd {
  constructor(opts) {
    super(opts, ZSTD_COMPRESS, zstdInitCParamsArray, kMaxZstdCParam);
  }
}
var kMaxZstdDParam = MathMax(...ObjectKeys(constants).map((key) => key.startsWith("ZSTD_d_") ? constants[key] : 0)), zstdInitDParamsArray = new Uint32Array(kMaxZstdDParam + 1);

class ZstdDecompress extends Zstd {
  constructor(opts) {
    super(opts, ZSTD_DECOMPRESS, zstdInitDParamsArray, kMaxZstdDParam);
  }
}
ObjectDefineProperty(NativeZlib.prototype, "jsref", {
  __proto__: null,
  get() {
    return this[owner_symbol];
  },
  set(v) {
    return this[owner_symbol] = v;
  }
});
var zlib = {
  crc32,
  Deflate,
  Inflate,
  Gzip,
  Gunzip,
  DeflateRaw,
  InflateRaw,
  Unzip,
  BrotliCompress,
  BrotliDecompress,
  ZstdCompress,
  ZstdDecompress,
  deflate: createConvenienceMethod(Deflate, !1, "deflate"),
  deflateSync: createConvenienceMethod(Deflate, !0, "deflateSync"),
  gzip: createConvenienceMethod(Gzip, !1, "gzip"),
  gzipSync: createConvenienceMethod(Gzip, !0, "gzipSync"),
  deflateRaw: createConvenienceMethod(DeflateRaw, !1, "deflateRaw"),
  deflateRawSync: createConvenienceMethod(DeflateRaw, !0, "deflateRawSync"),
  unzip: createConvenienceMethod(Unzip, !1, "unzip"),
  unzipSync: createConvenienceMethod(Unzip, !0, "unzipSync"),
  inflate: createConvenienceMethod(Inflate, !1, "inflate"),
  inflateSync: createConvenienceMethod(Inflate, !0, "inflateSync"),
  gunzip: createConvenienceMethod(Gunzip, !1, "gunzip"),
  gunzipSync: createConvenienceMethod(Gunzip, !0, "gunzipSync"),
  inflateRaw: createConvenienceMethod(InflateRaw, !1, "inflateRaw"),
  inflateRawSync: createConvenienceMethod(InflateRaw, !0, "inflateRawSync"),
  brotliCompress: createConvenienceMethod(BrotliCompress, !1, "brotliCompress"),
  brotliCompressSync: createConvenienceMethod(BrotliCompress, !0, "brotliCompressSync"),
  brotliDecompress: createConvenienceMethod(BrotliDecompress, !1, "brotliDecompress"),
  brotliDecompressSync: createConvenienceMethod(BrotliDecompress, !0, "brotliDecompressSync"),
  zstdCompress: createConvenienceMethod(ZstdCompress, !1, "zstdCompress", !0),
  zstdCompressSync: createConvenienceMethod(ZstdCompress, !0, "zstdCompressSync"),
  zstdDecompress: createConvenienceMethod(ZstdDecompress, !1, "zstdDecompress"),
  zstdDecompressSync: createConvenienceMethod(ZstdDecompress, !0, "zstdDecompressSync"),
  createDeflate: function(options) {
    return new Deflate(options);
  },
  createInflate: function(options) {
    return new Inflate(options);
  },
  createDeflateRaw: function(options) {
    return new DeflateRaw(options);
  },
  createInflateRaw: function(options) {
    return new InflateRaw(options);
  },
  createGzip: function(options) {
    return new Gzip(options);
  },
  createGunzip: function(options) {
    return new Gunzip(options);
  },
  createUnzip: function(options) {
    return new Unzip(options);
  },
  createBrotliCompress: function(options) {
    return new BrotliCompress(options);
  },
  createBrotliDecompress: function(options) {
    return new BrotliDecompress(options);
  },
  createZstdCompress: function(options) {
    return new ZstdCompress(options);
  },
  createZstdDecompress: function(options) {
    return new ZstdDecompress(options);
  }
};
ObjectDefineProperties(zlib, {
  constants: {
    enumerable: !0,
    value: ObjectFreeze(constants)
  },
  codes: {
    enumerable: !0,
    value: ObjectFreeze(codes)
  }
});
{
  let { Z_OK, Z_STREAM_END, Z_NEED_DICT, Z_ERRNO, Z_STREAM_ERROR, Z_DATA_ERROR, Z_MEM_ERROR, Z_BUF_ERROR, Z_VERSION_ERROR, Z_NO_COMPRESSION, Z_BEST_SPEED, Z_BEST_COMPRESSION, Z_DEFAULT_COMPRESSION: Z_DEFAULT_COMPRESSION2, Z_FILTERED, Z_HUFFMAN_ONLY, Z_RLE, ZLIB_VERNUM, Z_MAX_CHUNK, Z_DEFAULT_LEVEL } = constants;
  ObjectDefineProperty(zlib, "Z_NO_FLUSH", { value: Z_NO_FLUSH }), ObjectDefineProperty(zlib, "Z_PARTIAL_FLUSH", { value: Z_PARTIAL_FLUSH }), ObjectDefineProperty(zlib, "Z_SYNC_FLUSH", { value: Z_SYNC_FLUSH }), ObjectDefineProperty(zlib, "Z_FULL_FLUSH", { value: Z_FULL_FLUSH }), ObjectDefineProperty(zlib, "Z_FINISH", { value: Z_FINISH }), ObjectDefineProperty(zlib, "Z_BLOCK", { value: Z_BLOCK }), ObjectDefineProperty(zlib, "Z_OK", { value: Z_OK }), ObjectDefineProperty(zlib, "Z_STREAM_END", { value: Z_STREAM_END }), ObjectDefineProperty(zlib, "Z_NEED_DICT", { value: Z_NEED_DICT }), ObjectDefineProperty(zlib, "Z_ERRNO", { value: Z_ERRNO }), ObjectDefineProperty(zlib, "Z_STREAM_ERROR", { value: Z_STREAM_ERROR }), ObjectDefineProperty(zlib, "Z_DATA_ERROR", { value: Z_DATA_ERROR }), ObjectDefineProperty(zlib, "Z_MEM_ERROR", { value: Z_MEM_ERROR }), ObjectDefineProperty(zlib, "Z_BUF_ERROR", { value: Z_BUF_ERROR }), ObjectDefineProperty(zlib, "Z_VERSION_ERROR", { value: Z_VERSION_ERROR }), ObjectDefineProperty(zlib, "Z_NO_COMPRESSION", { value: Z_NO_COMPRESSION }), ObjectDefineProperty(zlib, "Z_BEST_SPEED", { value: Z_BEST_SPEED }), ObjectDefineProperty(zlib, "Z_BEST_COMPRESSION", { value: Z_BEST_COMPRESSION }), ObjectDefineProperty(zlib, "Z_DEFAULT_COMPRESSION", { value: Z_DEFAULT_COMPRESSION2 }), ObjectDefineProperty(zlib, "Z_FILTERED", { value: Z_FILTERED }), ObjectDefineProperty(zlib, "Z_HUFFMAN_ONLY", { value: Z_HUFFMAN_ONLY }), ObjectDefineProperty(zlib, "Z_RLE", { value: Z_RLE }), ObjectDefineProperty(zlib, "Z_FIXED", { value: Z_FIXED }), ObjectDefineProperty(zlib, "Z_DEFAULT_STRATEGY", { value: Z_DEFAULT_STRATEGY }), ObjectDefineProperty(zlib, "ZLIB_VERNUM", { value: ZLIB_VERNUM }), ObjectDefineProperty(zlib, "DEFLATE", { value: DEFLATE }), ObjectDefineProperty(zlib, "INFLATE", { value: INFLATE }), ObjectDefineProperty(zlib, "GZIP", { value: GZIP }), ObjectDefineProperty(zlib, "GUNZIP", { value: GUNZIP }), ObjectDefineProperty(zlib, "DEFLATERAW", { value: DEFLATERAW }), ObjectDefineProperty(zlib, "INFLATERAW", { value: INFLATERAW }), ObjectDefineProperty(zlib, "UNZIP", { value: UNZIP }), ObjectDefineProperty(zlib, "Z_MIN_WINDOWBITS", { value: Z_MIN_WINDOWBITS }), ObjectDefineProperty(zlib, "Z_MAX_WINDOWBITS", { value: Z_MAX_WINDOWBITS }), ObjectDefineProperty(zlib, "Z_DEFAULT_WINDOWBITS", { value: Z_DEFAULT_WINDOWBITS }), ObjectDefineProperty(zlib, "Z_MIN_CHUNK", { value: Z_MIN_CHUNK }), ObjectDefineProperty(zlib, "Z_MAX_CHUNK", { value: Z_MAX_CHUNK }), ObjectDefineProperty(zlib, "Z_DEFAULT_CHUNK", { value: Z_DEFAULT_CHUNK }), ObjectDefineProperty(zlib, "Z_MIN_MEMLEVEL", { value: Z_MIN_MEMLEVEL }), ObjectDefineProperty(zlib, "Z_MAX_MEMLEVEL", { value: Z_MAX_MEMLEVEL }), ObjectDefineProperty(zlib, "Z_DEFAULT_MEMLEVEL", { value: Z_DEFAULT_MEMLEVEL }), ObjectDefineProperty(zlib, "Z_MIN_LEVEL", { value: Z_MIN_LEVEL }), ObjectDefineProperty(zlib, "Z_MAX_LEVEL", { value: Z_MAX_LEVEL }), ObjectDefineProperty(zlib, "Z_DEFAULT_LEVEL", { value: Z_DEFAULT_LEVEL });
}
$ = zlib;
return $})

