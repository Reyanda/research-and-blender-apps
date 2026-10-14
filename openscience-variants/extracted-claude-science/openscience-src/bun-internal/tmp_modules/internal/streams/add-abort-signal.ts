(function (){"use strict";// build/release/tmp_modules/internal/streams/add-abort-signal.ts
var $, { isNodeStream, isWebStream, kControllerErrorFunction } = @getInternalField(@internalModuleRegistry, 58) || @createInternalModuleById(58), eos = @getInternalField(@internalModuleRegistry, 47) || @createInternalModuleById(47), SymbolDispose = Symbol.dispose, addAbortListener, validateAbortSignal = (signal, name) => {
  if (typeof signal !== "object" || !("aborted" in signal))
    throw @makeErrorWithCode(118, name, "AbortSignal", signal);
};
function addAbortSignal(signal, stream) {
  if (validateAbortSignal(signal, "signal"), !isNodeStream(stream) && !isWebStream(stream))
    throw @makeErrorWithCode(118, "stream", ["ReadableStream", "WritableStream", "Stream"], stream);
  return addAbortSignalNoValidate(signal, stream);
}
function addAbortSignalNoValidate(signal, stream) {
  if (typeof signal !== "object" || !("aborted" in signal))
    return stream;
  let onAbort = isNodeStream(stream) ? () => {
    stream.destroy(@makeAbortError(@undefined, { cause: signal.reason }));
  } : () => {
    stream[kControllerErrorFunction](@makeAbortError(@undefined, { cause: signal.reason }));
  };
  if (signal.aborted)
    onAbort();
  else {
    addAbortListener ??= (@getInternalField(@internalModuleRegistry, 3) || @createInternalModuleById(3)).addAbortListener;
    let disposable = addAbortListener(signal, onAbort);
    eos(stream, disposable[SymbolDispose]);
  }
  return stream;
}
$ = {
  addAbortSignal,
  addAbortSignalNoValidate
};
return $})

