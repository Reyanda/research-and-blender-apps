(function (){"use strict";// build/release/tmp_modules/internal/assert/calltracker.ts
var $, { SafeSet, SafeWeakMap } = @getInternalField(@internalModuleRegistry, 30) || @createInternalModuleById(30), AssertionError = @getInternalField(@internalModuleRegistry, 4) || @createInternalModuleById(4), { validateUint32 } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), ObjectFreeze = Object.freeze, ArrayPrototypePush = @Array.prototype.push, ArrayPrototypeSlice = @Array.prototype.slice, noop = () => {};

class CallTrackerContext {
  #expected;
  #calls;
  #name;
  #stackTrace;
  constructor({ expected, stackTrace, name }) {
    this.#calls = [], this.#expected = expected, this.#stackTrace = stackTrace, this.#name = name;
  }
  track(thisArg, args) {
    let argsClone = ObjectFreeze(ArrayPrototypeSlice.@call(args));
    ArrayPrototypePush.@call(this.#calls, ObjectFreeze({ thisArg, arguments: argsClone }));
  }
  get delta() {
    return this.#calls.length - this.#expected;
  }
  reset() {
    this.#calls = [];
  }
  getCalls() {
    return ObjectFreeze(ArrayPrototypeSlice.@call(this.#calls));
  }
  report() {
    if (this.delta !== 0)
      return {
        message: `Expected the ${this.#name} function to be executed ${this.#expected} time(s) but was executed ${this.#calls.length} time(s).`,
        actual: this.#calls.length,
        expected: this.#expected,
        operator: this.#name,
        stack: this.#stackTrace
      };
  }
}

class CallTracker {
  #callChecks = new SafeSet;
  #trackedFunctions = new SafeWeakMap;
  #getTrackedFunction(tracked) {
    if (!this.#trackedFunctions.has(tracked))
      throw @makeErrorWithCode(119, "tracked", tracked, "is not a tracked function");
    return this.#trackedFunctions.get(tracked);
  }
  reset(tracked) {
    if (tracked === @undefined) {
      this.#callChecks.forEach((check) => check.reset());
      return;
    }
    this.#getTrackedFunction(tracked).reset();
  }
  getCalls(tracked) {
    return this.#getTrackedFunction(tracked).getCalls();
  }
  calls(fn, expected = 1) {
    if (process._exiting)
      throw @makeErrorWithCode(249);
    if (typeof fn === "number")
      expected = fn, fn = noop;
    else if (fn === @undefined)
      fn = noop;
    validateUint32(expected, "expected", !0);
    let context = new CallTrackerContext({
      expected,
      stackTrace: Error(),
      name: fn.name || "calls"
    }), tracked = new Proxy(fn, {
      __proto__: null,
      apply(fn2, thisArg, argList) {
        return context.track(thisArg, argList), fn2.@apply(thisArg, argList);
      }
    });
    return this.#callChecks.add(context), this.#trackedFunctions.set(tracked, context), tracked;
  }
  report() {
    let errors = [];
    for (let context of this.#callChecks) {
      let message = context.report();
      if (message !== @undefined)
        ArrayPrototypePush.@call(errors, message);
    }
    return errors;
  }
  verify() {
    let errors = this.report();
    if (errors.length === 0)
      return;
    let message = errors.length === 1 ? errors[0].message : "Functions were not called the expected number of times";
    throw new AssertionError({
      message,
      details: errors
    });
  }
}
$ = CallTracker;
return $})

