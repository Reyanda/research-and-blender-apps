(function (){"use strict";// build/release/tmp_modules/node/test.ts
var $, { jest } = Bun, { kEmptyObject, throwNotImplemented } = @getInternalField(@internalModuleRegistry, 32) || @createInternalModuleById(32);
var kDefaultFunction = () => {}, kDefaultOptions = kEmptyObject;
function run() {
  throwNotImplemented("run()", 5090, "Use `bun:test` in the interim.");
}
function mock() {
  throwNotImplemented("mock()", 5090, "Use `bun:test` in the interim.");
}
function fileSnapshot(_value, _path, _options = kEmptyObject) {
  throwNotImplemented("fileSnapshot()", 5090, "Use `bun:test` in the interim.");
}
function snapshot(_value, _options = kEmptyObject) {
  throwNotImplemented("snapshot()", 5090, "Use `bun:test` in the interim.");
}
var assert = {
  ...@getInternalField(@internalModuleRegistry, 85) || @createInternalModuleById(85),
  fileSnapshot,
  snapshot
};
delete assert.AssertionError;
delete assert.CallTracker;
delete assert.strict;
var checkNotInsideTest;

class TestContext {
  #insideTest;
  #name;
  #filePath;
  #parent;
  #abortController;
  constructor(insideTest, name, filePath, parent) {
    this.#insideTest = insideTest, this.#name = name, this.#filePath = filePath || parent?.filePath || kDefaultFilePath, this.#parent = parent;
  }
  get signal() {
    if (this.#abortController === @undefined)
      this.#abortController = new AbortController;
    return this.#abortController.signal;
  }
  get name() {
    return this.#name;
  }
  get fullName() {
    let fullName = this.#name, parent = this.#parent;
    while (parent && parent.name)
      fullName = `${parent.name} > ${fullName}`, parent = parent.#parent;
    return fullName;
  }
  get filePath() {
    return this.#filePath;
  }
  diagnostic(message) {
    console.log(message);
  }
  plan(_count, _options = kEmptyObject) {
    throwNotImplemented("plan()", 5090, "Use `bun:test` in the interim.");
  }
  get assert() {
    return assert;
  }
  get mock() {
    return throwNotImplemented("mock", 5090, "Use `bun:test` in the interim."), @undefined;
  }
  runOnly(_value) {
    throwNotImplemented("runOnly()", 5090, "Use `bun:test` in the interim.");
  }
  skip(_message) {
    throwNotImplemented("skip()", 5090, "Use `bun:test` in the interim.");
  }
  todo(_message) {
    throwNotImplemented("todo()", 5090, "Use `bun:test` in the interim.");
  }
  before(arg0, arg1) {
    let { fn } = createHook(arg0, arg1), { beforeAll } = bunTest();
    beforeAll(fn);
  }
  after(arg0, arg1) {
    let { fn } = createHook(arg0, arg1), { afterAll } = bunTest();
    afterAll(fn);
  }
  beforeEach(arg0, arg1) {
    let { fn } = createHook(arg0, arg1), { beforeEach } = bunTest();
    beforeEach(fn);
  }
  afterEach(arg0, arg1) {
    let { fn } = createHook(arg0, arg1), { afterEach } = bunTest();
    afterEach(fn);
  }
  waitFor(_condition, _options = kEmptyObject) {
    throwNotImplemented("waitFor()", 5090, "Use `bun:test` in the interim.");
  }
  test(arg0, arg1, arg2) {
    let { name, fn, options } = createTest(arg0, arg1, arg2);
    this.#checkNotInsideTest("test");
    let { test } = bunTest();
    if (options.only)
      test.only(name, fn);
    else if (options.todo)
      test.todo(name, fn);
    else if (options.skip)
      test.skip(name, fn);
    else
      test(name, fn);
  }
  describe(arg0, arg1, arg2) {
    let { name, fn } = createDescribe(arg0, arg1, arg2);
    this.#checkNotInsideTest("describe");
    let { describe } = bunTest();
    describe(name, fn);
  }
  #checkNotInsideTest(fn) {
    if (this.#insideTest)
      throwNotImplemented(`${fn}() inside another test()`, 5090, "Use `bun:test` in the interim.");
  }
  static {
    checkNotInsideTest = (ctx, fn) => {
      if (ctx)
        ctx.#checkNotInsideTest(fn);
    };
  }
}
function bunTest() {
  return jest(Bun.main);
}
var ctx = @undefined;
function describe(arg0, arg1, arg2) {
  let { name, fn } = createDescribe(arg0, arg1, arg2), { describe: describe2 } = bunTest();
  describe2(name, fn);
}
describe.skip = function(arg0, arg1, arg2) {
  let { name, fn } = createDescribe(arg0, arg1, arg2), { describe: describe2 } = bunTest();
  describe2.skip(name, fn);
};
describe.todo = function(arg0, arg1, arg2) {
  let { name, fn } = createDescribe(arg0, arg1, arg2), { describe: describe2 } = bunTest();
  describe2.todo(name, fn);
};
describe.only = function(arg0, arg1, arg2) {
  let { name, fn } = createDescribe(arg0, arg1, arg2), { describe: describe2 } = bunTest();
  describe2.only(name, fn);
};
function test(arg0, arg1, arg2) {
  let { name, fn, options } = createTest(arg0, arg1, arg2), { test: test2 } = bunTest();
  test2(name, fn, options);
}
test.skip = function(arg0, arg1, arg2) {
  let { name, fn, options } = createTest(arg0, arg1, arg2), { test: test2 } = bunTest();
  test2.skip(name, fn, options);
};
test.todo = function(arg0, arg1, arg2) {
  let { name, fn, options } = createTest(arg0, arg1, arg2), { test: test2 } = bunTest();
  test2.todo(name, fn, options);
};
test.only = function(arg0, arg1, arg2) {
  let { name, fn, options } = createTest(arg0, arg1, arg2), { test: test2 } = bunTest();
  test2.only(name, fn, options);
};
function before(arg0, arg1) {
  let { fn } = createHook(arg0, arg1), { beforeAll } = bunTest();
  beforeAll(fn);
}
function after(arg0, arg1) {
  let { fn } = createHook(arg0, arg1), { afterAll } = bunTest();
  afterAll(fn);
}
function beforeEach(arg0, arg1) {
  let { fn } = createHook(arg0, arg1), { beforeEach: beforeEach2 } = bunTest();
  beforeEach2(fn);
}
function afterEach(arg0, arg1) {
  let { fn } = createHook(arg0, arg1), { afterEach: afterEach2 } = bunTest();
  afterEach2(fn);
}
function parseTestOptions(arg0, arg1, arg2) {
  let name, options, fn;
  if (typeof arg0 === "function")
    if (name = arg0.name || "<anonymous>", fn = arg0, typeof arg1 === "object")
      options = arg1;
    else
      options = kDefaultOptions;
  else if (typeof arg0 === "string")
    if (name = arg0, typeof arg1 === "object")
      if (options = arg1, typeof arg2 === "function")
        fn = arg2;
      else
        fn = kDefaultFunction;
    else if (typeof arg1 === "function")
      fn = arg1, options = kDefaultOptions;
    else
      fn = kDefaultFunction, options = kDefaultOptions;
  else
    name = "<anonymous>", fn = kDefaultFunction, options = kDefaultOptions;
  return { name, options, fn };
}
function createTest(arg0, arg1, arg2) {
  let { name, options, fn } = parseTestOptions(arg0, arg1, arg2);
  checkNotInsideTest(ctx, "test");
  let context = new TestContext(!0, name, Bun.main, ctx);
  return { name, options, fn: (done) => {
    let originalContext = ctx;
    ctx = context;
    let endTest = (error) => {
      try {
        done(error);
      } finally {
        ctx = originalContext;
      }
    }, result;
    try {
      result = fn(context);
    } catch (error) {
      endTest(error);
      return;
    }
    if (result instanceof @Promise)
      result.then(() => endTest()).catch((error) => endTest(error));
    else
      endTest();
  } };
}
function createDescribe(arg0, arg1, arg2) {
  let { name, fn, options } = parseTestOptions(arg0, arg1, arg2);
  checkNotInsideTest(ctx, "describe");
  let context = new TestContext(!1, name, Bun.main, ctx);
  return { name, options, fn: () => {
    let originalContext = ctx;
    ctx = context;
    let endDescribe = () => {
      ctx = originalContext;
    };
    try {
      return fn(context);
    } finally {
      endDescribe();
    }
  } };
}
function parseHookOptions(arg0, arg1) {
  let fn, options;
  if (typeof arg0 === "function")
    fn = arg0;
  else
    fn = kDefaultFunction;
  if (typeof arg1 === "object")
    options = arg1;
  else
    options = kDefaultOptions;
  return { fn, options };
}
function createHook(arg0, arg1) {
  let { fn, options } = parseHookOptions(arg0, arg1);
  return { options, fn: (done) => {
    let result;
    try {
      result = fn();
    } catch (error) {
      done(error);
      return;
    }
    if (result instanceof @Promise)
      result.then(() => done()).catch((error) => done(error));
    else
      done();
  } };
}
function setDefaultSnapshotSerializer(_serializers) {
  throwNotImplemented("setDefaultSnapshotSerializer()", 5090, "Use `bun:test` in the interim.");
}
function setResolveSnapshotPath(_fn) {
  throwNotImplemented("setResolveSnapshotPath()", 5090, "Use `bun:test` in the interim.");
}
test.describe = describe;
test.suite = describe;
test.test = test;
test.it = test;
test.before = before;
test.after = after;
test.beforeEach = beforeEach;
test.afterEach = afterEach;
test.assert = assert;
test.snapshot = {
  setDefaultSnapshotSerializer,
  setResolveSnapshotPath
};
test.run = run;
test.mock = mock;
$ = test;
return $})

