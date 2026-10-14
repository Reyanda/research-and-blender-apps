(function (){"use strict";// build/release/tmp_modules/internal/streams/lazy_transform.ts
var $, Transform = @getInternalField(@internalModuleRegistry, 57) || @createInternalModuleById(57), ObjectDefineProperty = Object.defineProperty, ObjectDefineProperties = Object.defineProperties;
function LazyTransform(options) {
  this._options = options;
}
@toClass(LazyTransform, "LazyTransform", Transform);
function makeGetter(name) {
  return function() {
    return Transform.@call(this, this._options), this._writableState.decodeStrings = !1, this[name];
  };
}
function makeSetter(name) {
  return function(val) {
    ObjectDefineProperty(this, name, {
      __proto__: null,
      value: val,
      enumerable: !0,
      configurable: !0,
      writable: !0
    });
  };
}
ObjectDefineProperties(LazyTransform.prototype, {
  _readableState: {
    __proto__: null,
    get: makeGetter("_readableState"),
    set: makeSetter("_readableState"),
    configurable: !0,
    enumerable: !0
  },
  _writableState: {
    __proto__: null,
    get: makeGetter("_writableState"),
    set: makeSetter("_writableState"),
    configurable: !0,
    enumerable: !0
  }
});
$ = LazyTransform;
return $})

