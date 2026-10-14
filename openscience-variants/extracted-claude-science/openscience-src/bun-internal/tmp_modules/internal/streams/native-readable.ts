(function (){"use strict";// build/release/tmp_modules/internal/streams/native-readable.ts
var $, Readable = @getInternalField(@internalModuleRegistry, 55) || @createInternalModuleById(55), transferToNativeReadable = @lazy(18), { errorOrDestroy } = @getInternalField(@internalModuleRegistry, 43) || @createInternalModuleById(43), kRefCount = Symbol("refCount"), kCloseState = Symbol("closeState"), kConstructed = Symbol("constructed"), kHighWaterMark = Symbol("highWaterMark"), kPendingRead = Symbol("pendingRead"), kHasResized = Symbol("hasResized"), kRemainingChunk = Symbol("remainingChunk");
var dynamicallyAdjustChunkSize = (_) => (_ = process.env.BUN_DISABLE_DYNAMIC_CHUNK_SIZE !== "1", dynamicallyAdjustChunkSize = () => _);
function constructNativeReadable(readableStream, options) {
  let bunNativePtr = readableStream.@bunNativePtr, stream = new Readable(options);
  if (stream._read = read, stream._destroy = destroy, stream.@bunNativePtr = bunNativePtr, stream[kRefCount] = 0, stream[kConstructed] = !1, stream[kPendingRead] = !1, stream[kHasResized] = !dynamicallyAdjustChunkSize(), stream[kCloseState] = [!1], typeof options.highWaterMark === "number")
    stream[kHighWaterMark] = options.highWaterMark;
  else
    stream[kHighWaterMark] = 262144;
  return stream.ref = ref, stream.unref = unref, transferToNativeReadable(readableStream), stream;
}
function getRemainingChunk(stream, maxToRead) {
  maxToRead ??= stream[kHighWaterMark];
  var chunk = stream[kRemainingChunk];
  if ((chunk?.byteLength ?? 0) < 512) {
    var size = maxToRead > 512 ? maxToRead : 512;
    stream[kRemainingChunk] = chunk = @Buffer.alloc(size);
  }
  return chunk;
}
function read(maxToRead) {
  if (this[kPendingRead])
    return;
  var ptr = this.@bunNativePtr;
  if (!ptr) {
    this.push(null);
    return;
  }
  if (!this[kConstructed]) {
    let result2 = ptr.start(this[kHighWaterMark]);
    if (typeof result2 === "number" && result2 > 1)
      this[kHasResized] = !0, this[kHighWaterMark] = Math.min(this[kHighWaterMark], result2);
    if (@isTypedArrayView(result2) && result2.byteLength > 0)
      this.push(result2);
    let drainResult = ptr.drain();
    if (this[kConstructed] = !0, (drainResult?.byteLength ?? 0) > 0)
      this.push(drainResult);
  }
  let chunk = getRemainingChunk(this, maxToRead);
  var result = ptr.pull(chunk, this[kCloseState]);
  if (@isPromise(result))
    return this[kPendingRead] = !0, result.then((result2) => {
      this[kPendingRead] = !1, this[kRemainingChunk] = handleResult(this, result2, chunk, this[kCloseState][0]);
    }, (reason) => {
      errorOrDestroy(this, reason);
    });
  else
    this[kRemainingChunk] = handleResult(this, result, chunk, this[kCloseState][0]);
}
function handleResult(stream, result, chunk, isClosed) {
  if (typeof result === "number") {
    if (result >= stream[kHighWaterMark] && !stream[kHasResized] && !isClosed)
      adjustHighWaterMark(stream);
    return handleNumberResult(stream, result, chunk, isClosed);
  } else if (typeof result === "boolean")
    return process.nextTick(() => {
      stream.push(null);
    }), (chunk?.byteLength ?? 0) > 0 ? chunk : @undefined;
  else if (@isTypedArrayView(result)) {
    if (result.byteLength >= stream[kHighWaterMark] && !stream[kHasResized] && !isClosed)
      adjustHighWaterMark(stream);
    return handleArrayBufferViewResult(stream, result, chunk, isClosed);
  }
}
function handleNumberResult(stream, result, chunk, isClosed) {
  if (result > 0) {
    let slice = chunk.subarray(0, result);
    if (chunk = slice.byteLength < chunk.byteLength ? chunk.subarray(result) : @undefined, slice.byteLength > 0)
      stream.push(slice);
  }
  if (isClosed)
    process.nextTick(() => {
      stream.push(null);
    });
  return chunk;
}
function handleArrayBufferViewResult(stream, result, chunk, isClosed) {
  if (result.byteLength > 0)
    stream.push(result);
  if (isClosed)
    process.nextTick(() => {
      stream.push(null);
    });
  return chunk;
}
function adjustHighWaterMark(stream) {
  stream[kHighWaterMark] = @min(stream[kHighWaterMark] * 2, 2097152), stream[kHasResized] = !0;
}
function destroy(error, cb) {
  let ptr = this.@bunNativePtr;
  if (ptr)
    ptr.cancel(error);
  if (cb)
    process.nextTick(cb);
}
function ref() {
  let ptr = this.@bunNativePtr;
  if (ptr === @undefined)
    return;
  if (this[kRefCount]++ === 0)
    ptr.updateRef(!0);
}
function unref() {
  let ptr = this.@bunNativePtr;
  if (ptr === @undefined)
    return;
  if (this[kRefCount]-- === 1)
    ptr.updateRef(!1);
}
$ = { constructNativeReadable };
return $})

