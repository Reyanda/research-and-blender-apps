(function (){"use strict";// build/release/tmp_modules/internal/validators.ts
var $, { hideFromStack } = @getInternalField(@internalModuleRegistry, 32) || @createInternalModuleById(32), RegExpPrototypeExec = @RegExp.prototype.exec, ArrayIsArray = @Array.isArray, ObjectPrototypeHasOwnProperty = Object.prototype.hasOwnProperty, tokenRegExp = /^[\^_`a-zA-Z\-0-9!#$%&'*+.|~]+$/;
function checkIsHttpToken(val) {
  return RegExpPrototypeExec.@call(tokenRegExp, val) !== null;
}
var linkValueRegExp = /^(?:<[^>]*>)(?:\s*;\s*[^;"\s]+(?:=(")?[^;"\s]*\1)?)*$/;
function validateLinkHeaderFormat(value, name) {
  if (typeof value > "u" || !RegExpPrototypeExec.@call(linkValueRegExp, value))
    throw @makeErrorWithCode(119, name, value, 'must be an array or string of format "</styles.css>; rel=preload; as=style"');
}
function validateLinkHeaderValue(hints) {
  if (typeof hints === "string")
    return validateLinkHeaderFormat(hints, "hints"), hints;
  else if (ArrayIsArray(hints)) {
    let hintsLength = hints.length, result = "";
    if (hintsLength === 0)
      return result;
    for (let i = 0;i < hintsLength; i++) {
      let link = hints[i];
      if (validateLinkHeaderFormat(link, "hints"), result += link, i !== hintsLength - 1)
        result += ", ";
    }
    return result;
  }
  throw @makeErrorWithCode(119, "hints", hints, 'must be an array or string of format "</styles.css>; rel=preload; as=style"');
}
function validateString(value, name) {
  if (typeof value !== "string")
    throw @makeErrorWithCode(118, name, "string", value);
}
function validateFunction(value, name) {
  if (typeof value !== "function")
    throw @makeErrorWithCode(118, name, "function", value);
}
function validateBoolean(value, name) {
  if (typeof value !== "boolean")
    throw @makeErrorWithCode(118, name, "boolean", value);
}
function validateUndefined(value, name) {
  if (value !== @undefined)
    throw @makeErrorWithCode(118, name, "undefined", value);
}
function validateInternalField(object, fieldKey, className) {
  if (typeof object !== "object" || object === null || !ObjectPrototypeHasOwnProperty.@call(object, fieldKey))
    throw @makeErrorWithCode(118, "this", className, object);
}
hideFromStack(validateLinkHeaderValue, validateInternalField);
hideFromStack(validateString, validateFunction, validateBoolean, validateUndefined);
$ = {
  validateObject: @lazy(22),
  validateLinkHeaderValue,
  checkIsHttpToken,
  validateInteger: @lazy(23),
  validateNumber: @lazy(24),
  validateString,
  validateFiniteNumber: @lazy(25),
  checkRangesOrGetDefault: @lazy(26),
  validateFunction,
  validateBoolean,
  validatePort: @lazy(27),
  validateAbortSignal: @lazy(28),
  validateArray: @lazy(29),
  validateInt32: @lazy(30),
  validateUint32: @lazy(31),
  validateSignalName: @lazy(32),
  validateEncoding: @lazy(33),
  validatePlainFunction: @lazy(34),
  validateUndefined,
  validateBuffer: @lazy(35),
  validateOneOf: @lazy(36),
  isUint8Array: (value) => value instanceof @Uint8Array,
  validateInternalField
};
return $})

