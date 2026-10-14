(function (){"use strict";// build/release/tmp_modules/internal/assert/utils.ts
var $, AssertionError;
function loadAssertionError() {
  if (AssertionError === @undefined)
    AssertionError = @getInternalField(@internalModuleRegistry, 4) || @createInternalModuleById(4);
}
function getErrMessage(_message, _value, _fn) {}
function innerOk(fn, argLen, value, message) {
  if (!value) {
    let generatedMessage = !1;
    if (argLen === 0)
      generatedMessage = !0, message = "No value argument passed to `assert.ok()`";
    else if (message == null)
      generatedMessage = !0, message = getErrMessage(message, value, fn);
    else if (Error.isError(message))
      throw message;
    if (AssertionError === @undefined)
      loadAssertionError();
    let err = new AssertionError({
      actual: value,
      expected: !0,
      message,
      operator: "==",
      stackStartFn: fn
    });
    throw err.generatedMessage = generatedMessage, err;
  }
}
return{
  innerOk
};})

