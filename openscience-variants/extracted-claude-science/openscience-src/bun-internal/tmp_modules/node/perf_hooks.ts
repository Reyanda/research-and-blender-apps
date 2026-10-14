(function (){"use strict";// build/release/tmp_modules/node/perf_hooks.ts
var $, { throwNotImplemented } = @getInternalField(@internalModuleRegistry, 32) || @createInternalModuleById(32), cppCreateHistogram = @lazy(74), {
  Performance,
  PerformanceEntry,
  PerformanceMark,
  PerformanceMeasure,
  PerformanceObserver,
  PerformanceObserverEntryList
} = globalThis, constants = {
  NODE_PERFORMANCE_ENTRY_TYPE_DNS: 4,
  NODE_PERFORMANCE_ENTRY_TYPE_GC: 0,
  NODE_PERFORMANCE_ENTRY_TYPE_HTTP: 1,
  NODE_PERFORMANCE_ENTRY_TYPE_HTTP2: 2,
  NODE_PERFORMANCE_ENTRY_TYPE_NET: 3,
  NODE_PERFORMANCE_GC_FLAGS_ALL_AVAILABLE_GARBAGE: 16,
  NODE_PERFORMANCE_GC_FLAGS_ALL_EXTERNAL_MEMORY: 32,
  NODE_PERFORMANCE_GC_FLAGS_CONSTRUCT_RETAINED: 2,
  NODE_PERFORMANCE_GC_FLAGS_FORCED: 4,
  NODE_PERFORMANCE_GC_FLAGS_NO: 0,
  NODE_PERFORMANCE_GC_FLAGS_SCHEDULE_IDLE: 64,
  NODE_PERFORMANCE_GC_FLAGS_SYNCHRONOUS_PHANTOM_PROCESSING: 8,
  NODE_PERFORMANCE_GC_INCREMENTAL: 8,
  NODE_PERFORMANCE_GC_MAJOR: 4,
  NODE_PERFORMANCE_GC_MINOR: 1,
  NODE_PERFORMANCE_GC_WEAKCB: 16,
  NODE_PERFORMANCE_MILESTONE_BOOTSTRAP_COMPLETE: 7,
  NODE_PERFORMANCE_MILESTONE_ENVIRONMENT: 2,
  NODE_PERFORMANCE_MILESTONE_LOOP_EXIT: 6,
  NODE_PERFORMANCE_MILESTONE_LOOP_START: 5,
  NODE_PERFORMANCE_MILESTONE_NODE_START: 3,
  NODE_PERFORMANCE_MILESTONE_TIME_ORIGIN_TIMESTAMP: 0,
  NODE_PERFORMANCE_MILESTONE_TIME_ORIGIN: 1,
  NODE_PERFORMANCE_MILESTONE_V8_START: 4
};

class PerformanceNodeTiming {
  bootstrapComplete = 0;
  environment = 0;
  idleTime = 0;
  loopExit = 0;
  loopStart = 0;
  nodeStart = 0;
  v8Start = 0;
  get name() {
    return "node";
  }
  get entryType() {
    return "node";
  }
  get startTime() {
    return this.nodeStart;
  }
  get duration() {
    return performance.now();
  }
  toJSON() {
    return {
      name: this.name,
      entryType: this.entryType,
      startTime: this.startTime,
      duration: this.duration,
      bootstrapComplete: this.bootstrapComplete,
      environment: this.environment,
      idleTime: this.idleTime,
      loopExit: this.loopExit,
      loopStart: this.loopStart,
      nodeStart: this.nodeStart,
      v8Start: this.v8Start
    };
  }
}
@toClass(PerformanceNodeTiming, "PerformanceNodeTiming", PerformanceEntry);
function createPerformanceNodeTiming() {
  let object = Object.create(PerformanceNodeTiming.prototype);
  return object.bootstrapComplete = object.environment = object.nodeStart = object.v8Start = performance.timeOrigin, object.loopStart = object.idleTime = 1, object.loopExit = -1, object;
}
function eventLoopUtilization(_utilization1, _utilization2) {
  return {
    idle: 0,
    active: 0,
    utilization: 0
  };
}

class PerformanceResourceTiming {
  constructor() {
    throwNotImplemented("PerformanceResourceTiming");
  }
}
@toClass(PerformanceResourceTiming, "PerformanceResourceTiming", PerformanceEntry);
$ = {
  performance: {
    mark(_) {
      return performance.mark(...arguments);
    },
    measure(_) {
      return performance.measure(...arguments);
    },
    clearMarks(_) {
      return performance.clearMarks(...arguments);
    },
    clearMeasures(_) {
      return performance.clearMeasures(...arguments);
    },
    getEntries(_) {
      return performance.getEntries(...arguments);
    },
    getEntriesByName(_) {
      return performance.getEntriesByName(...arguments);
    },
    getEntriesByType(_) {
      return performance.getEntriesByType(...arguments);
    },
    setResourceTimingBufferSize(_) {
      return performance.setResourceTimingBufferSize(...arguments);
    },
    timeOrigin: performance.timeOrigin,
    toJSON(_) {
      return performance.toJSON(...arguments);
    },
    onresourcetimingbufferfull: performance.onresourcetimingbufferfull,
    nodeTiming: createPerformanceNodeTiming(),
    now: () => performance.now(),
    eventLoopUtilization,
    clearResourceTimings: function() {}
  },
  constants,
  Performance,
  PerformanceEntry,
  PerformanceMark,
  PerformanceMeasure,
  PerformanceObserver,
  PerformanceObserverEntryList,
  PerformanceNodeTiming,
  monitorEventLoopDelay: function monitorEventLoopDelay(options) {
    return (@getInternalField(@internalModuleRegistry, 29) || @createInternalModuleById(29))(options);
  },
  createHistogram: function createHistogram(options) {
    let opts = options || {}, lowest = 1, highest = Number.MAX_SAFE_INTEGER, figures = 3;
    if (opts.lowest !== @undefined)
      if (typeof opts.lowest === "bigint")
        lowest = Number(opts.lowest);
      else if (typeof opts.lowest === "number")
        lowest = opts.lowest;
      else
        throw @makeErrorWithCode(118, "options.lowest", ["number", "bigint"], opts.lowest);
    if (opts.highest !== @undefined)
      if (typeof opts.highest === "bigint")
        highest = Number(opts.highest);
      else if (typeof opts.highest === "number")
        highest = opts.highest;
      else
        throw @makeErrorWithCode(118, "options.highest", ["number", "bigint"], opts.highest);
    if (opts.figures !== @undefined) {
      if (typeof opts.figures !== "number")
        throw @makeErrorWithCode(118, "options.figures", "number", opts.figures);
      if (opts.figures < 1 || opts.figures > 5)
        throw @makeErrorWithCode(156, "options.figures", ">= 1 && <= 5", opts.figures);
      figures = opts.figures;
    }
    if (lowest < 1)
      throw @makeErrorWithCode(156, "options.lowest", ">= 1 && <= 9007199254740991", lowest);
    if (highest < 2 * lowest)
      throw @makeErrorWithCode(156, "options.highest", `>= ${2 * lowest} && <= 9007199254740991`, highest);
    return cppCreateHistogram(lowest, highest, figures);
  },
  PerformanceResourceTiming
};
return $})

