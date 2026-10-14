(function (){"use strict";// build/release/tmp_modules/internal/streams/legacy.ts
var $, EE = @getInternalField(@internalModuleRegistry, 96) || @createInternalModuleById(96), { isArrayBufferView, isUint8Array } = @getInternalField(@internalModuleRegistry, 144) || @createInternalModuleById(144), ReflectOwnKeys = Reflect.ownKeys, ArrayIsArray = @Array.isArray;
function Stream(opts) {
  EE.@call(this, opts);
}
@toClass(Stream, "Stream", EE);
Stream.prototype.pipe = function(dest, options) {
  let source = this;
  function ondata(chunk) {
    if (dest.writable && dest.write(chunk) === !1 && source.pause)
      source.pause();
  }
  source.on("data", ondata);
  function ondrain() {
    if (source.readable && source.resume)
      source.resume();
  }
  if (dest.on("drain", ondrain), !dest._isStdio && (!options || options.end !== !1))
    source.on("end", onend), source.on("close", onclose);
  let didOnEnd = !1;
  function onend() {
    if (didOnEnd)
      return;
    didOnEnd = !0, dest.end();
  }
  function onclose() {
    if (didOnEnd)
      return;
    if (didOnEnd = !0, typeof dest.destroy === "function")
      dest.destroy();
  }
  function onerror(er) {
    if (cleanup(), EE.listenerCount(this, "error") === 0)
      this.emit("error", er);
  }
  prependListener(source, "error", onerror), prependListener(dest, "error", onerror);
  function cleanup() {
    source.removeListener("data", ondata), dest.removeListener("drain", ondrain), source.removeListener("end", onend), source.removeListener("close", onclose), source.removeListener("error", onerror), dest.removeListener("error", onerror), source.removeListener("end", cleanup), source.removeListener("close", cleanup), dest.removeListener("close", cleanup);
  }
  return source.on("end", cleanup), source.on("close", cleanup), dest.on("close", cleanup), dest.emit("pipe", source), dest;
};
Stream.prototype.eventNames = function eventNames() {
  let names = [];
  for (let key of ReflectOwnKeys(this._events))
    if (typeof this._events[key] === "function" || ArrayIsArray(this._events[key]) && this._events[key].length > 0)
      names.push(key);
  return names;
};
function prependListener(emitter, event, fn) {
  if (typeof emitter.prependListener === "function")
    return emitter.prependListener(event, fn);
  if (!emitter._events || !emitter._events[event])
    emitter.on(event, fn);
  else if (ArrayIsArray(emitter._events[event]))
    emitter._events[event].unshift(fn);
  else
    emitter._events[event] = [fn, emitter._events[event]];
}
Stream._isArrayBufferView = isArrayBufferView;
Stream._isUint8Array = isUint8Array;
Stream._uint8ArrayToBuffer = function _uint8ArrayToBuffer(chunk) {
  return new @Buffer(chunk.buffer, chunk.byteOffset, chunk.byteLength);
};
$ = { Stream, prependListener };
return $})

