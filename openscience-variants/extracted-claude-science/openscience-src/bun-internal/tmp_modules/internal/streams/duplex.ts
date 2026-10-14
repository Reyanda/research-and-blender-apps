(function (){"use strict";// build/release/tmp_modules/internal/streams/duplex.ts
var $, Stream = (@getInternalField(@internalModuleRegistry, 50) || @createInternalModuleById(50)).Stream, Readable = @getInternalField(@internalModuleRegistry, 55) || @createInternalModuleById(55), Writable = @getInternalField(@internalModuleRegistry, 59) || @createInternalModuleById(59), { addAbortSignal } = @getInternalField(@internalModuleRegistry, 41) || @createInternalModuleById(41), destroyImpl = @getInternalField(@internalModuleRegistry, 43) || @createInternalModuleById(43), { kOnConstructed } = @getInternalField(@internalModuleRegistry, 58) || @createInternalModuleById(58), ObjectKeys = Object.keys, ObjectDefineProperties = Object.defineProperties, ObjectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
function Duplex(options) {
  if (!(this instanceof Duplex))
    return new Duplex(options);
  if (this._events ??= {
    close: @undefined,
    error: @undefined,
    prefinish: @undefined,
    finish: @undefined,
    drain: @undefined,
    data: @undefined,
    end: @undefined,
    readable: @undefined
  }, this._readableState = new Readable.ReadableState(options, this, !0), this._writableState = new Writable.WritableState(options, this, !0), options) {
    if (this.allowHalfOpen = options.allowHalfOpen !== !1, options.readable === !1)
      this._readableState.readable = !1, this._readableState.ended = !0, this._readableState.endEmitted = !0;
    if (options.writable === !1)
      this._writableState.writable = !1, this._writableState.ending = !0, this._writableState.ended = !0, this._writableState.finished = !0;
    if (typeof options.read === "function")
      this._read = options.read;
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
  } else
    this.allowHalfOpen = !0;
  if (Stream.@call(this, options), this._construct != null)
    destroyImpl.construct(this, () => {
      this._readableState[kOnConstructed](this), this._writableState[kOnConstructed](this);
    });
}
@toClass(Duplex, "Duplex", Readable);
Duplex.prototype.destroy = Writable.prototype.destroy;
{
  let keys = ObjectKeys(Writable.prototype);
  for (let i = 0;i < keys.length; i++) {
    let method = keys[i];
    Duplex.prototype[method] ||= Writable.prototype[method];
  }
}
ObjectDefineProperties(Duplex.prototype, {
  writable: { __proto__: null, ...ObjectGetOwnPropertyDescriptor(Writable.prototype, "writable") },
  writableHighWaterMark: {
    __proto__: null,
    ...ObjectGetOwnPropertyDescriptor(Writable.prototype, "writableHighWaterMark")
  },
  writableObjectMode: { __proto__: null, ...ObjectGetOwnPropertyDescriptor(Writable.prototype, "writableObjectMode") },
  writableBuffer: { __proto__: null, ...ObjectGetOwnPropertyDescriptor(Writable.prototype, "writableBuffer") },
  writableLength: { __proto__: null, ...ObjectGetOwnPropertyDescriptor(Writable.prototype, "writableLength") },
  writableFinished: { __proto__: null, ...ObjectGetOwnPropertyDescriptor(Writable.prototype, "writableFinished") },
  writableCorked: { __proto__: null, ...ObjectGetOwnPropertyDescriptor(Writable.prototype, "writableCorked") },
  writableEnded: { __proto__: null, ...ObjectGetOwnPropertyDescriptor(Writable.prototype, "writableEnded") },
  writableNeedDrain: { __proto__: null, ...ObjectGetOwnPropertyDescriptor(Writable.prototype, "writableNeedDrain") },
  destroyed: {
    __proto__: null,
    get() {
      if (this._readableState === @undefined || this._writableState === @undefined)
        return !1;
      return this._readableState.destroyed && this._writableState.destroyed;
    },
    set(value) {
      if (this._readableState && this._writableState)
        this._readableState.destroyed = value, this._writableState.destroyed = value;
    }
  }
});
var webStreamsAdapters;
function lazyWebStreams() {
  if (webStreamsAdapters === @undefined)
    webStreamsAdapters = @getInternalField(@internalModuleRegistry, 69) || @createInternalModuleById(69);
  return webStreamsAdapters;
}
Duplex.fromWeb = function(pair, options) {
  return lazyWebStreams().newStreamDuplexFromReadableWritablePair(pair, options);
};
Duplex.toWeb = function(duplex) {
  return lazyWebStreams().newReadableWritablePairFromDuplex(duplex);
};
var duplexify;
Duplex.from = function(body) {
  return duplexify ??= @getInternalField(@internalModuleRegistry, 45) || @createInternalModuleById(45), duplexify(body, "body");
};
$ = Duplex;
return $})

