(function (){"use strict";// build/release/tmp_modules/internal/perf_hooks/monitorEventLoopDelay.ts
var $, { validateObject, validateInteger } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), cppMonitorEventLoopDelay = @lazy(13), cppEnableEventLoopDelay = @lazy(14), cppDisableEventLoopDelay = @lazy(15), eventLoopDelayHistogram, enabled = !1, resolution = 10;
function enable() {
  if (enabled)
    return !1;
  return enabled = !0, cppEnableEventLoopDelay(eventLoopDelayHistogram, resolution), !0;
}
function disable() {
  if (!enabled)
    return !1;
  return enabled = !1, cppDisableEventLoopDelay(eventLoopDelayHistogram), !0;
}
function monitorEventLoopDelay(options) {
  if (options !== @undefined)
    validateObject(options, "options");
  resolution = 10;
  let resolutionOption = options?.resolution;
  if (typeof resolutionOption < "u")
    validateInteger(resolutionOption, "options.resolution", 1), resolution = resolutionOption;
  if (!eventLoopDelayHistogram)
    eventLoopDelayHistogram = cppMonitorEventLoopDelay(resolution), @putByValDirect(eventLoopDelayHistogram, "enable", enable), @putByValDirect(eventLoopDelayHistogram, "disable", disable), @putByValDirect(eventLoopDelayHistogram, Symbol.dispose, disable);
  return eventLoopDelayHistogram;
}
$ = monitorEventLoopDelay;
return $})

