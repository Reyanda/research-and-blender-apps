(function (){"use strict";// build/release/tmp_modules/node/v8.ts
var $, { hideFromStack, throwNotImplemented } = @getInternalField(@internalModuleRegistry, 32) || @createInternalModuleById(32), jsc = @getInternalField(@internalModuleRegistry, 139) || @createInternalModuleById(139);
function notimpl(message) {
  throwNotImplemented("node:v8 " + message);
}

class Deserializer {
  constructor() {
    notimpl("Deserializer");
  }
}

class Serializer {
  constructor() {
    notimpl("Serializer");
  }
}

class DefaultDeserializer extends Deserializer {
}

class DefaultSerializer extends Serializer {
}

class GCProfiler {
  constructor() {
    notimpl("GCProfiler");
  }
}
function cachedDataVersionTag() {
  notimpl("cachedDataVersionTag");
}
var HeapSnapshotReadable_;
function getHeapSnapshot() {
  if (!HeapSnapshotReadable_) {
    let Readable = (@getInternalField(@internalModuleRegistry, 117) || @createInternalModuleById(117)).Readable;

    class HeapSnapshotReadable extends Readable {
      constructor() {
        super();
        this.push(Bun.generateHeapSnapshot("v8")), this.push(null);
      }
    }
    HeapSnapshotReadable_ = HeapSnapshotReadable;
  }
  return new HeapSnapshotReadable_;
}
var totalmem_ = -1;
function totalmem() {
  if (totalmem_ === -1)
    totalmem_ = (@getInternalField(@internalModuleRegistry, 105) || @createInternalModuleById(105)).totalmem();
  return totalmem_;
}
function getHeapStatistics() {
  let stats = jsc.heapStats(), memory = jsc.memoryUsage();
  return {
    total_heap_size: stats.heapSize,
    total_heap_size_executable: stats.heapSize >> 1,
    total_physical_size: memory.peak,
    total_available_size: totalmem() - stats.heapSize,
    used_heap_size: stats.heapSize,
    heap_size_limit: Math.min(memory.peak * 10, totalmem()),
    malloced_memory: stats.heapSize,
    peak_malloced_memory: memory.peak,
    does_zap_garbage: 0,
    number_of_native_contexts: stats.globalObjectCount,
    number_of_detached_contexts: 0,
    total_global_handles_size: 8192,
    used_global_handles_size: 2208,
    external_memory: stats.extraMemorySize
  };
}
function getHeapSpaceStatistics() {
  notimpl("getHeapSpaceStatistics");
}
function getHeapCodeStatistics() {
  notimpl("getHeapCodeStatistics");
}
function setFlagsFromString() {
  notimpl("setFlagsFromString");
}
function deserialize(value) {
  return jsc.deserialize(value);
}
function takeCoverage() {
  notimpl("takeCoverage");
}
function stopCoverage() {
  notimpl("stopCoverage");
}
function serialize(arg1) {
  return jsc.serialize(arg1, { binaryType: "nodebuffer" });
}
function getDefaultHeapSnapshotPath() {
  let date = /* @__PURE__ */ new Date, thread_id = (@getInternalField(@internalModuleRegistry, 130) || @createInternalModuleById(130)).threadId, yyyy = date.getFullYear(), mm = date.getMonth().toString().padStart(2, "0"), dd = date.getDate().toString().padStart(2, "0"), hh = date.getHours().toString().padStart(2, "0"), MM = date.getMinutes().toString().padStart(2, "0"), ss = date.getSeconds().toString().padStart(2, "0");
  return `Heap-${yyyy}${mm}${dd}-${hh}${MM}${ss}-${process.pid}-${thread_id}.heapsnapshot`;
}
var fs;
function writeHeapSnapshot(path, _options) {
  if (path !== @undefined) {
    if (typeof path !== "string")
      throw @makeErrorWithCode(118, "path", "string", path);
    if (!path)
      throw @makeErrorWithCode(119, "path", path, "must be a non-empty string");
  } else
    path = getDefaultHeapSnapshotPath();
  if (!fs)
    fs = @getInternalField(@internalModuleRegistry, 98) || @createInternalModuleById(98);
  return fs.writeFileSync(path, Bun.generateHeapSnapshot("v8"), "utf-8"), path;
}
function setHeapSnapshotNearHeapLimit() {
  notimpl("setHeapSnapshotNearHeapLimit");
}
var promiseHooks = {
  createHook: () => {
    notimpl("createHook");
  },
  onInit: () => {
    notimpl("onInit");
  },
  onBefore: () => {
    notimpl("onBefore");
  },
  onAfter: () => {
    notimpl("onAfter");
  },
  onSettled: () => {
    notimpl("onSettled");
  }
}, startupSnapshot = {
  addDeserializeCallback: () => notimpl("addDeserializeCallback"),
  addSerializeCallback: () => notimpl("addSerializeCallback"),
  setDeserializeMainFunction: () => notimpl("setDeserializeMainFunction"),
  isBuildingSnapshot: () => notimpl("isBuildingSnapshot")
};
$ = {
  cachedDataVersionTag,
  getHeapSnapshot,
  getHeapStatistics,
  getHeapSpaceStatistics,
  getHeapCodeStatistics,
  setFlagsFromString,
  deserialize,
  takeCoverage,
  stopCoverage,
  serialize,
  writeHeapSnapshot,
  setHeapSnapshotNearHeapLimit,
  promiseHooks,
  startupSnapshot,
  Deserializer,
  Serializer,
  DefaultDeserializer,
  DefaultSerializer
};
hideFromStack(notimpl, cachedDataVersionTag, getHeapSnapshot, getHeapStatistics, getHeapSpaceStatistics, getHeapCodeStatistics, setFlagsFromString, deserialize, takeCoverage, stopCoverage, serialize, writeHeapSnapshot, setHeapSnapshotNearHeapLimit, Deserializer, Serializer, DefaultDeserializer, DefaultSerializer, GCProfiler, DefaultDeserializer, DefaultSerializer);
return $})

