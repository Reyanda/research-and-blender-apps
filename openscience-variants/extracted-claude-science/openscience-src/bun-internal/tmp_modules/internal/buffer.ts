(function (){"use strict";// build/release/tmp_modules/internal/buffer.ts
var $, { validateNumber } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68);
function boundsError(value, length, type) {
  if (Math.floor(value) !== value)
    throw validateNumber(value, type), @makeErrorWithCode(156, type || "offset", "an integer", value);
  if (length < 0)
    throw @makeErrorWithCode(12);
  throw @makeErrorWithCode(156, type || "offset", `>= ${type ? 1 : 0} and <= ${length}`, value);
}
function checkBounds(buf, offset, byteLength) {
  if (validateNumber(offset, "offset"), buf[offset] === @undefined || buf[offset + byteLength - 1] === @undefined)
    boundsError(offset, buf.length - byteLength);
}
function checkInt(buf, value, offset, min, max, byteLength) {
  if (value > max || value < min) {
    let n = typeof min === "bigint" ? "n" : "", range;
    if (byteLength > 4)
      if (min === 0 || min === 0n)
        range = `>= 0${n} and < 2${n} ** ${byteLength * 8}${n}`;
      else
        range = `>= -(2${n} ** ${byteLength * 8 - 1}${n}) and < 2${n} ** ${byteLength * 8 - 1}${n}`;
    else
      range = `>= ${min}${n} and <= ${max}${n}`;
    throw @makeErrorWithCode(156, "value", range, value);
  }
  checkBounds(buf, offset, byteLength);
}
function writeU_Int8(buf, value, offset, min, max) {
  if (validateNumber(offset, "offset"), value > max || value < min)
    throw @makeErrorWithCode(156, "value", `>= ${min} and <= ${max}`, value);
  if (buf[offset] === @undefined)
    boundsError(offset, buf.length - 1);
}
$ = {
  boundsError,
  checkBounds,
  checkInt,
  writeU_Int8
};
return $})

