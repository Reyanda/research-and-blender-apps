(function (){"use strict";// build/release/tmp_modules/internal/tls.ts
var $, { isTypedArray, isArrayBuffer } = @getInternalField(@internalModuleRegistry, 144) || @createInternalModuleById(144);
function isPemObject(obj) {
  return @isObject(obj) && "pem" in obj;
}
function isPemArray(obj) {
  return @isArray(obj) && obj.every(isPemObject);
}
function isValidTLSItem(obj) {
  if (typeof obj === "string" || isTypedArray(obj) || isArrayBuffer(obj) || @inherits(0, obj) || isPemArray(obj))
    return !0;
  return !1;
}
function findInvalidTLSItem(obj) {
  if (@isArray(obj))
    for (var i = 0, length = obj.length;i < length; i++) {
      let item = obj[i];
      if (!isValidTLSItem(item))
        return item;
    }
  return obj;
}
function throwOnInvalidTLSArray(name, value) {
  if (!isValidTLSArray(value))
    throw @makeErrorWithCode(118, name, VALID_TLS_ERROR_MESSAGE_TYPES, findInvalidTLSItem(value));
}
function isValidTLSArray(obj) {
  if (isValidTLSItem(obj))
    return !0;
  if (@isArray(obj)) {
    for (var i = 0, length = obj.length;i < length; i++) {
      let item = obj[i];
      if (!isValidTLSItem(item))
        return !1;
    }
    return !0;
  }
  return !1;
}
var VALID_TLS_ERROR_MESSAGE_TYPES = "string or an instance of Buffer, TypedArray, DataView, or BunFile";
return{
  throwOnInvalidTLSArray,
  isValidTLSItem,
  isValidTLSArray,
  VALID_TLS_ERROR_MESSAGE_TYPES
};})

