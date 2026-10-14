(function (){"use strict";// build/release/tmp_modules/internal/util/deprecate.ts
var $, { validateString } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), codesWarned = /* @__PURE__ */ new Set;
function getDeprecationWarningEmitter(code, msg, deprecated, shouldEmitWarning = () => !0) {
  let warned = !1;
  return function() {
    if (!warned && shouldEmitWarning())
      if (warned = !0, code !== @undefined) {
        if (!codesWarned.has(code))
          process.emitWarning(msg, "DeprecationWarning", code, deprecated), codesWarned.add(code);
      } else
        process.emitWarning(msg, "DeprecationWarning", deprecated);
  };
}
function deprecate(fn, msg, code) {
  if (code !== @undefined)
    validateString(code, "code");
  let emitDeprecationWarning = getDeprecationWarningEmitter(code, msg, deprecated);
  function deprecated(...args) {
    if (!process.noDeprecation)
      emitDeprecationWarning();
    if (new.target)
      return Reflect.construct(fn, args, new.target);
    return fn.@apply(this, args);
  }
  return Object.setPrototypeOf(deprecated, fn), deprecated;
}
$ = {
  deprecate
};
return $})

