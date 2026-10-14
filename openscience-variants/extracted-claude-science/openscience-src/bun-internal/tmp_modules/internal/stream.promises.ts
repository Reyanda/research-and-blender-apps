(function (){"use strict";// build/release/tmp_modules/internal/stream.promises.ts
var $, ArrayPrototypePop = @Array.prototype.pop, { isIterable, isNodeStream, isWebStream } = @getInternalField(@internalModuleRegistry, 58) || @createInternalModuleById(58), { pipelineImpl: pl } = @getInternalField(@internalModuleRegistry, 54) || @createInternalModuleById(54), { finished } = @getInternalField(@internalModuleRegistry, 47) || @createInternalModuleById(47);
function pipeline(...streams) {
  return new @Promise((resolve, reject) => {
    let signal, end, lastArg = streams[streams.length - 1];
    if (lastArg && typeof lastArg === "object" && !isNodeStream(lastArg) && !isIterable(lastArg) && !isWebStream(lastArg)) {
      let options = ArrayPrototypePop.@call(streams);
      signal = options.signal, end = options.end;
    }
    pl(streams, (err, value) => {
      if (err)
        reject(err);
      else
        resolve(value);
    }, { signal, end });
  });
}
$ = {
  finished,
  pipeline
};
return $})

