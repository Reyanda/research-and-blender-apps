(function (){"use strict";// build/release/tmp_modules/node/cluster.ts
var $, { isPrimary } = @getInternalField(@internalModuleRegistry, 12) || @createInternalModuleById(12), cluster = isPrimary ? @getInternalField(@internalModuleRegistry, 13) || @createInternalModuleById(13) : @getInternalField(@internalModuleRegistry, 11) || @createInternalModuleById(11);
$ = cluster;
function initializeClusterIPC() {
  if (process.argv[1] && process.env.NODE_UNIQUE_ID)
    cluster._setupWorker(), delete process.env.NODE_UNIQUE_ID;
}
if (Bun.isMainThread)
  initializeClusterIPC();
return $})

