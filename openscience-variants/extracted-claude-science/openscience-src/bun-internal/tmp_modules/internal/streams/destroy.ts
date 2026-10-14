(function (){"use strict";// build/release/tmp_modules/internal/streams/destroy.ts
var $, { aggregateTwoErrors } = @getInternalField(@internalModuleRegistry, 16) || @createInternalModuleById(16), {
  kIsDestroyed,
  isDestroyed,
  isFinished,
  isServerRequest,
  kState,
  kErrorEmitted,
  kEmitClose,
  kClosed,
  kCloseEmitted,
  kConstructed,
  kDestroyed,
  kAutoDestroy,
  kErrored
} = @getInternalField(@internalModuleRegistry, 58) || @createInternalModuleById(58), ProcessNextTick = process.nextTick, kDestroy = Symbol("kDestroy"), kConstruct = Symbol("kConstruct");
function checkError(err, w, r) {
  if (err) {
    if (err.stack, w && !w.errored)
      w.errored = err;
    if (r && !r.errored)
      r.errored = err;
  }
}
function destroy(err, cb) {
  let r = this._readableState, w = this._writableState, s = w || r;
  if (w && (w[kState] & kDestroyed) !== 0 || r && (r[kState] & kDestroyed) !== 0) {
    if (typeof cb === "function")
      cb();
    return this;
  }
  if (checkError(err, w, r), w)
    w[kState] |= kDestroyed;
  if (r)
    r[kState] |= kDestroyed;
  if ((s[kState] & kConstructed) === 0)
    this.once(kDestroy, function(er) {
      _destroy(this, aggregateTwoErrors(er, err), cb);
    });
  else
    _destroy(this, err, cb);
  return this;
}
function _destroy(self, err, cb) {
  let called = !1;
  function onDestroy(err2) {
    if (called)
      return;
    called = !0;
    let { _readableState: r, _writableState: w } = self;
    if (checkError(err2, w, r), w)
      w[kState] |= kClosed;
    if (r)
      r[kState] |= kClosed;
    if (typeof cb === "function")
      cb(err2);
    if (err2)
      ProcessNextTick(emitErrorCloseNT, self, err2);
    else
      ProcessNextTick(emitCloseNT, self);
  }
  try {
    self._destroy(err || null, onDestroy);
  } catch (err2) {
    onDestroy(err2);
  }
}
function emitErrorCloseNT(self, err) {
  emitErrorNT(self, err), emitCloseNT(self);
}
function emitCloseNT(self) {
  let { _readableState: r, _writableState: w } = self;
  if (w)
    w[kState] |= kCloseEmitted;
  if (r)
    r[kState] |= kCloseEmitted;
  if (w && (w[kState] & kEmitClose) !== 0 || r && (r[kState] & kEmitClose) !== 0)
    self.emit("close");
}
function emitErrorNT(self, err) {
  let { _readableState: r, _writableState: w } = self;
  if (w && (w[kState] & kErrorEmitted) !== 0 || r && (r[kState] & kErrorEmitted) !== 0)
    return;
  if (w)
    w[kState] |= kErrorEmitted;
  if (r)
    r[kState] |= kErrorEmitted;
  self.emit("error", err);
}
function undestroy() {
  let r = this._readableState, w = this._writableState;
  if (r)
    r.constructed = !0, r.closed = !1, r.closeEmitted = !1, r.destroyed = !1, r.errored = null, r.errorEmitted = !1, r.reading = !1, r.ended = r.readable === !1, r.endEmitted = r.readable === !1;
  if (w)
    w.constructed = !0, w.destroyed = !1, w.closed = !1, w.closeEmitted = !1, w.errored = null, w.errorEmitted = !1, w.finalCalled = !1, w.prefinished = !1, w.ended = w.writable === !1, w.ending = w.writable === !1, w.finished = w.writable === !1;
}
function errorOrDestroy(stream, err, sync) {
  let { _readableState: r, _writableState: w } = stream;
  if (w && (w[kState] ? (w[kState] & kDestroyed) !== 0 : w.destroyed) || r && (r[kState] ? (r[kState] & kDestroyed) !== 0 : r.destroyed))
    return this;
  if (r && (r[kState] & kAutoDestroy) !== 0 || w && (w[kState] & kAutoDestroy) !== 0)
    stream.destroy(err);
  else if (err) {
    if (err.stack, w && (w[kState] & kErrored) === 0)
      w.errored = err;
    if (r && (r[kState] & kErrored) === 0)
      r.errored = err;
    if (sync)
      ProcessNextTick(emitErrorNT, stream, err);
    else
      emitErrorNT(stream, err);
  }
}
function construct(stream, cb) {
  if (typeof stream._construct !== "function")
    return;
  let { _readableState: r, _writableState: w } = stream;
  if (r)
    r[kState] &= ~kConstructed;
  if (w)
    w[kState] &= ~kConstructed;
  if (stream.once(kConstruct, cb), stream.listenerCount(kConstruct) > 1)
    return;
  ProcessNextTick(constructNT, stream);
}
function constructNT(stream) {
  let called = !1;
  function onConstruct(err) {
    if (called) {
      errorOrDestroy(stream, err ?? @makeErrorWithCode(154));
      return;
    }
    called = !0;
    let { _readableState: r, _writableState: w } = stream, s = w || r;
    if (r)
      r[kState] |= kConstructed;
    if (w)
      w[kState] |= kConstructed;
    if (s.destroyed)
      stream.emit(kDestroy, err);
    else if (err)
      errorOrDestroy(stream, err, !0);
    else
      stream.emit(kConstruct);
  }
  try {
    stream._construct((err) => {
      ProcessNextTick(onConstruct, err);
    });
  } catch (err) {
    ProcessNextTick(onConstruct, err);
  }
}
function isRequest(stream) {
  return stream?.setHeader && typeof stream.abort === "function";
}
function emitCloseLegacy(stream) {
  stream.emit("close");
}
function emitErrorCloseLegacy(stream, err) {
  stream.emit("error", err), ProcessNextTick(emitCloseLegacy, stream);
}
function destroyer(stream, err) {
  if (!stream || isDestroyed(stream))
    return;
  if (!err && !isFinished(stream))
    err = @makeAbortError();
  if (isServerRequest(stream))
    stream.socket = null, stream.destroy(err);
  else if (isRequest(stream))
    stream.abort();
  else if (isRequest(stream.req))
    stream.req.abort();
  else if (typeof stream.destroy === "function")
    stream.destroy(err);
  else if (typeof stream.close === "function")
    stream.close();
  else if (err)
    ProcessNextTick(emitErrorCloseLegacy, stream, err);
  else
    ProcessNextTick(emitCloseLegacy, stream);
  if (!stream.destroyed)
    stream[kIsDestroyed] = !0;
}
$ = {
  construct,
  destroyer,
  destroy,
  undestroy,
  errorOrDestroy
};
return $})

