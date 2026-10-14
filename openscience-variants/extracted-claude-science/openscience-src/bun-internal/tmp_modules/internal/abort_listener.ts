(function (){"use strict";// build/release/tmp_modules/internal/abort_listener.ts
var $, { validateAbortSignal, validateFunction } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), { kResistStopPropagation } = @getInternalField(@internalModuleRegistry, 32) || @createInternalModuleById(32);
function addAbortListener(signal, listener) {
  if (signal === @undefined)
    throw @makeErrorWithCode(118, "signal", "AbortSignal", signal);
  validateAbortSignal(signal, "signal"), validateFunction(listener, "listener");
  let removeEventListener;
  if (signal.aborted)
    queueMicrotask(() => listener());
  else
    signal.addEventListener("abort", listener, { once: !0, [kResistStopPropagation]: !0 }), removeEventListener = () => {
      signal.removeEventListener("abort", listener);
    };
  return {
    [Symbol.dispose]() {
      removeEventListener?.();
    }
  };
}
$ = {
  addAbortListener
};
return $})

