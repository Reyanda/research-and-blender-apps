(function (){"use strict";// build/release/tmp_modules/internal/timers.ts
var $, { validateNumber } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), NumberIsFinite = Number.isFinite;
function getTimerDuration(msecs, name) {
  if (validateNumber(msecs, name), msecs < 0 || !NumberIsFinite(msecs))
    throw @makeErrorWithCode(156, name, "a non-negative finite number", msecs);
  if (msecs > 2147483647)
    return process.emitWarning(`${msecs} does not fit into a 32-bit signed integer.
Timer duration was truncated to 2147483647.`, "TimeoutOverflowWarning"), 2147483647;
  return msecs;
}
$ = {
  kTimeout: Symbol("timeout"),
  getTimerDuration
};
return $})

