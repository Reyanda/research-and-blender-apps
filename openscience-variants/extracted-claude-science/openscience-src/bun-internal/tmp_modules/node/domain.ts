(function (){"use strict";// build/release/tmp_modules/node/domain.ts
var $, EventEmitter, ObjectDefineProperty = Object.defineProperty, domain = {};
domain.createDomain = domain.create = function() {
  if (!EventEmitter)
    EventEmitter = @getInternalField(@internalModuleRegistry, 96) || @createInternalModuleById(96);
  var d = new EventEmitter;
  function emitError(e) {
    if (e ||= @makeErrorWithCode(252), typeof e === "object")
      e.domainEmitter = this, ObjectDefineProperty(e, "domain", {
        __proto__: null,
        configurable: !0,
        enumerable: !1,
        value: domain,
        writable: !0
      }), e.domainThrown = !1;
    d.emit("error", e);
  }
  return d.add = function(emitter) {
    emitter.on("error", emitError);
  }, d.remove = function(emitter) {
    emitter.removeListener("error", emitError);
  }, d.bind = function(fn) {
    return function() {
      var args = @Array.prototype.slice.@call(arguments);
      try {
        fn.@apply(null, args);
      } catch (err) {
        emitError(err);
      }
    };
  }, d.intercept = function(fn) {
    return function(err) {
      if (err)
        emitError(err);
      else {
        var args = @Array.prototype.slice.@call(arguments, 1);
        try {
          fn.@apply(null, args);
        } catch (err2) {
          emitError(err2);
        }
      }
    };
  }, d.run = function(fn) {
    try {
      fn();
    } catch (err) {
      emitError(err);
    }
    return this;
  }, d.dispose = function() {
    return this.removeAllListeners(), this;
  }, d.enter = d.exit = function() {
    return this;
  }, d;
};
$ = domain;
return $})

