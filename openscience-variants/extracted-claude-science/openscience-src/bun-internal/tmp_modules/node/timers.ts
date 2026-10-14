(function (){"use strict";// build/release/tmp_modules/node/timers.ts
var $, { throwNotImplemented } = @getInternalField(@internalModuleRegistry, 32) || @createInternalModuleById(32), timersPromisesValue;
$ = {
  setTimeout,
  clearTimeout,
  setInterval,
  setImmediate,
  clearInterval,
  clearImmediate,
  get promises() {
    return timersPromisesValue ??= @getInternalField(@internalModuleRegistry, 120) || @createInternalModuleById(120);
  },
  set promises(value) {
    timersPromisesValue = value;
  },
  active(timer) {
    if (@isCallable(timer?.refresh))
      timer.refresh();
    else
      throwNotImplemented("'timers.active'");
  },
  unenroll(timer) {
    if (@isCallable(timer?.refresh)) {
      clearTimeout(timer);
      return;
    }
    throwNotImplemented("'timers.unenroll'");
  },
  enroll(timer, _msecs) {
    if (@isCallable(timer?.refresh)) {
      timer.refresh();
      return;
    }
    throwNotImplemented("'timers.enroll'");
  }
};
return $})

