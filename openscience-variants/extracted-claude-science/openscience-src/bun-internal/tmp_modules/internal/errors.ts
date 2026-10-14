(function (){"use strict";// build/release/tmp_modules/internal/errors.ts
var $, { SafeArrayIterator } = @getInternalField(@internalModuleRegistry, 30) || @createInternalModuleById(30), ArrayIsArray = @Array.isArray, ArrayPrototypePush = @Array.prototype.push;
function aggregateTwoErrors(innerError, outerError) {
  if (innerError && outerError && innerError !== outerError) {
    if (ArrayIsArray(outerError.errors))
      return ArrayPrototypePush.@call(outerError.errors, innerError), outerError;
    let err = AggregateError(new SafeArrayIterator([outerError, innerError]), outerError.message);
    return err.code = outerError.code, err;
  }
  return innerError || outerError;
}
$ = {
  aggregateTwoErrors
};
return $})

