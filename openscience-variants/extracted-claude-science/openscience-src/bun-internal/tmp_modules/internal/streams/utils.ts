(function (){"use strict";// build/release/tmp_modules/internal/streams/utils.ts
var $, SymbolFor = Symbol.for, SymbolIterator = Symbol.iterator, SymbolAsyncIterator = Symbol.asyncIterator, kIsDestroyed = SymbolFor("nodejs.stream.destroyed"), kIsErrored = SymbolFor("nodejs.stream.errored"), kIsReadable = SymbolFor("nodejs.stream.readable"), kIsWritable = SymbolFor("nodejs.stream.writable"), kIsDisturbed = SymbolFor("nodejs.stream.disturbed"), kOnConstructed = Symbol("kOnConstructed"), kIsClosedPromise = SymbolFor("nodejs.webstream.isClosedPromise"), kControllerErrorFunction = SymbolFor("nodejs.webstream.controllerErrorFunction"), kState = Symbol("kState"), kObjectMode = 1, kErrorEmitted = 2, kAutoDestroy = 4, kEmitClose = 8, kDestroyed = 16, kClosed = 32, kCloseEmitted = 64, kErrored = 128, kConstructed = 256;
function isReadableNodeStream(obj, strict = !1) {
  return !!(obj && typeof obj.pipe === "function" && typeof obj.on === "function" && (!strict || typeof obj.pause === "function" && typeof obj.resume === "function") && (!obj._writableState || obj._readableState?.readable !== !1) && (!obj._writableState || obj._readableState));
}
function isWritableNodeStream(obj) {
  return !!(obj && typeof obj.write === "function" && typeof obj.on === "function" && (!obj._readableState || obj._writableState?.writable !== !1));
}
function isDuplexNodeStream(obj) {
  return !!(obj && typeof obj.pipe === "function" && obj._readableState && typeof obj.on === "function" && typeof obj.write === "function");
}
function isNodeStream(obj) {
  return obj && (obj._readableState || obj._writableState || typeof obj.write === "function" && typeof obj.on === "function" || typeof obj.pipe === "function" && typeof obj.on === "function");
}
function isReadableStream(obj) {
  return @inherits(1, obj);
}
function isWritableStream(obj) {
  return @inherits(2, obj);
}
function isTransformStream(obj) {
  return @inherits(3, obj);
}
function isWebStream(obj) {
  return isReadableStream(obj) || isWritableStream(obj) || isTransformStream(obj);
}
function isIterable(obj, isAsync) {
  if (obj == null)
    return !1;
  if (isAsync === !0)
    return typeof obj[SymbolAsyncIterator] === "function";
  if (isAsync === !1)
    return typeof obj[SymbolIterator] === "function";
  return typeof obj[SymbolAsyncIterator] === "function" || typeof obj[SymbolIterator] === "function";
}
function isDestroyed(stream) {
  if (!isNodeStream(stream))
    return null;
  let { _writableState: wState, _readableState: rState } = stream, state = wState || rState;
  return !!(stream.destroyed || stream[kIsDestroyed] || state?.destroyed);
}
function isWritableEnded(stream) {
  if (!isWritableNodeStream(stream))
    return null;
  if (stream.writableEnded === !0)
    return !0;
  let wState = stream._writableState;
  if (wState?.errored)
    return !1;
  if (typeof wState?.ended !== "boolean")
    return null;
  return wState.ended;
}
function isWritableFinished(stream, strict) {
  if (!isWritableNodeStream(stream))
    return null;
  if (stream.writableFinished === !0)
    return !0;
  let wState = stream._writableState;
  if (wState?.errored)
    return !1;
  if (typeof wState?.finished !== "boolean")
    return null;
  return !!(wState.finished || strict === !1 && wState.ended === !0 && wState.length === 0);
}
function isReadableEnded(stream) {
  if (!isReadableNodeStream(stream))
    return null;
  if (stream.readableEnded === !0)
    return !0;
  let rState = stream._readableState;
  if (!rState || rState.errored)
    return !1;
  if (typeof rState?.ended !== "boolean")
    return null;
  return rState.ended;
}
function isReadableFinished(stream, strict) {
  if (!isReadableNodeStream(stream))
    return null;
  let rState = stream._readableState;
  if (rState?.errored)
    return !1;
  if (typeof rState?.endEmitted !== "boolean")
    return null;
  return !!(rState.endEmitted || strict === !1 && rState.ended === !0 && rState.length === 0);
}
function isReadable(stream) {
  if (stream && stream[kIsReadable] != null)
    return stream[kIsReadable];
  if (typeof stream?.readable !== "boolean")
    return null;
  if (isDestroyed(stream))
    return !1;
  return isReadableNodeStream(stream) && stream.readable && !isReadableFinished(stream);
}
function isWritable(stream) {
  if (stream && stream[kIsWritable] != null)
    return stream[kIsWritable];
  if (typeof stream?.writable !== "boolean")
    return null;
  if (isDestroyed(stream))
    return !1;
  return isWritableNodeStream(stream) && stream.writable && !isWritableEnded(stream);
}
function isFinished(stream, opts) {
  if (!isNodeStream(stream))
    return null;
  if (isDestroyed(stream))
    return !0;
  if (opts?.readable !== !1 && isReadable(stream))
    return !1;
  if (opts?.writable !== !1 && isWritable(stream))
    return !1;
  return !0;
}
function isWritableErrored(stream) {
  if (!isNodeStream(stream))
    return null;
  if (stream.writableErrored)
    return stream.writableErrored;
  return stream._writableState?.errored ?? null;
}
function isReadableErrored(stream) {
  if (!isNodeStream(stream))
    return null;
  if (stream.readableErrored)
    return stream.readableErrored;
  return stream._readableState?.errored ?? null;
}
function isClosed(stream) {
  if (!isNodeStream(stream))
    return null;
  if (typeof stream.closed === "boolean")
    return stream.closed;
  let { _writableState: wState, _readableState: rState } = stream;
  if (typeof wState?.closed === "boolean" || typeof rState?.closed === "boolean")
    return wState?.closed || rState?.closed;
  if (typeof stream._closed === "boolean" && isOutgoingMessage(stream))
    return stream._closed;
  return null;
}
function isOutgoingMessage(stream) {
  return typeof stream._closed === "boolean" && typeof stream._defaultKeepAlive === "boolean" && typeof stream._removedConnection === "boolean" && typeof stream._removedContLen === "boolean";
}
function isServerResponse(stream) {
  return typeof stream._sent100 === "boolean" && isOutgoingMessage(stream);
}
function isServerRequest(stream) {
  return typeof stream._consuming === "boolean" && typeof stream._dumped === "boolean" && stream.req?.upgradeOrConnect === @undefined;
}
function willEmitClose(stream) {
  if (!isNodeStream(stream))
    return null;
  let { _writableState: wState, _readableState: rState } = stream, state = wState || rState;
  return !state && isServerResponse(stream) || !!(state?.autoDestroy && state.emitClose && state.closed === !1);
}
function isDisturbed(stream) {
  return !!(stream && (stream[kIsDisturbed] ?? (stream.readableDidRead || stream.readableAborted)));
}
function isErrored(stream) {
  return !!(stream && (stream[kIsErrored] ?? stream.readableErrored ?? stream.writableErrored ?? stream._readableState?.errorEmitted ?? stream._writableState?.errorEmitted ?? stream._readableState?.errored ?? stream._writableState?.errored));
}
$ = {
  kOnConstructed,
  isDestroyed,
  kIsDestroyed,
  isDisturbed,
  kIsDisturbed,
  isErrored,
  kIsErrored,
  isReadable,
  kIsReadable,
  kIsClosedPromise,
  kControllerErrorFunction,
  kIsWritable,
  isClosed,
  isDuplexNodeStream,
  isFinished,
  isIterable,
  isReadableNodeStream,
  isReadableStream,
  isReadableEnded,
  isReadableFinished,
  isReadableErrored,
  isNodeStream,
  isWebStream,
  isWritable,
  isWritableNodeStream,
  isWritableStream,
  isWritableEnded,
  isWritableFinished,
  isWritableErrored,
  isServerRequest,
  isServerResponse,
  willEmitClose,
  isTransformStream,
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
};
return $})

