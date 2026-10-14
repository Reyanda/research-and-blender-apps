(function (){"use strict";// build/release/tmp_modules/node/vm.ts
var $, { SafePromiseAllReturnArrayLike } = @getInternalField(@internalModuleRegistry, 30) || @createInternalModuleById(30), { throwNotImplemented } = @getInternalField(@internalModuleRegistry, 32) || @createInternalModuleById(32), {
  validateObject,
  validateString,
  validateUint32,
  validateBoolean,
  validateInt32,
  validateBuffer,
  validateFunction
} = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), util = @getInternalField(@internalModuleRegistry, 126) || @createInternalModuleById(126), vm = @lazy(88), ObjectFreeze = Object.freeze, ObjectDefineProperty = Object.defineProperty, ArrayPrototypeMap = @Array.prototype.map, PromisePrototypeThen = @Promise.prototype.@then, PromiseResolve = @Promise.@resolve.bind(@Promise), ObjectPrototypeHasOwnProperty = Object.prototype.hasOwnProperty, ObjectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor, ObjectSetPrototypeOf = Object.setPrototypeOf, ObjectGetPrototypeOf = Object.getPrototypeOf, SymbolToStringTag = Symbol.toStringTag, ArrayIsArray = @Array.isArray, ArrayPrototypeSome = @Array.prototype.some, ArrayPrototypeForEach = @Array.prototype.forEach, ArrayPrototypeIndexOf = @Array.prototype.indexOf, kPerContextModuleId = Symbol("kPerContextModuleId"), kNative = Symbol("kNative"), kContext = Symbol("kContext"), kLink = Symbol("kLink"), kDependencySpecifiers = Symbol("kDependencySpecifiers"), kNoError = Symbol("kNoError"), kEmptyObject = Object.freeze(Object.create(null)), {
  Script,
  Module: ModuleNative,
  createContext,
  isContext,
  compileFunction,
  isModuleNamespaceObject,
  kUnlinked,
  kLinked,
  kEvaluated,
  kErrored,
  DONT_CONTEXTIFY,
  USE_MAIN_CONTEXT_DEFAULT_LOADER
} = vm;
function runInContext(code, context, options) {
  if (validateContext(context), typeof options === "string")
    options = { filename: options };
  return new Script(code, options).runInContext(context, options);
}
function runInThisContext(code, options) {
  if (typeof options === "string")
    options = { filename: options };
  return new Script(code, options).runInThisContext(options);
}
function runInNewContext(code, context, options) {
  if (context !== @undefined && (typeof context !== "object" || context === null))
    validateContext(context);
  if (typeof options === "string")
    options = { filename: options };
  return context = createContext(context, options), createScript(code, options).runInNewContext(context, options);
}
function createScript(code, options) {
  return new Script(code, options);
}
function measureMemory() {
  throwNotImplemented("node:vm measureMemory");
}
function validateContext(contextifiedObject) {
  if (contextifiedObject !== constants.DONT_CONTEXTIFY && !isContext(contextifiedObject)) {
    let error = Error('The "contextifiedObject" argument must be an vm.Context');
    throw error.code = "ERR_INVALID_ARG_TYPE", error.name = "TypeError", error;
  }
}
function validateModule(module, typename = "Module") {
  if (!isModule(module)) {
    let error = Error('The "this" argument must be an instance of ' + typename);
    throw error.code = "ERR_INVALID_ARG_TYPE", error.name = "TypeError", error;
  }
}
var globalModuleId = 0, defaultModuleName = "vm:module";

class Module {
  constructor(options) {
    if (new.target === Module)
      @throwTypeError("Module is not a constructor");
    let { context, sourceText, syntheticExportNames, syntheticEvaluationSteps } = options;
    if (context !== @undefined) {
      if (validateObject(context, "context"), !isContext(context))
        throw @makeErrorWithCode(118, "options.context", "vm.Context", context);
    }
    let { identifier } = options;
    if (identifier !== @undefined)
      validateString(identifier, "options.identifier");
    else if (context === @undefined)
      identifier = `${defaultModuleName}(${globalModuleId++})`;
    else if (context[kPerContextModuleId] !== @undefined) {
      let curId = context[kPerContextModuleId];
      identifier = `${defaultModuleName}(${curId})`, context[kPerContextModuleId] += 1;
    } else
      identifier = `${defaultModuleName}(0)`, ObjectDefineProperty(context, kPerContextModuleId, {
        __proto__: null,
        value: 1,
        writable: !0,
        enumerable: !1,
        configurable: !0
      });
    if (sourceText !== @undefined)
      this[kNative] = new ModuleNative(identifier, context, sourceText, options.lineOffset, options.columnOffset, options.cachedData, options.initializeImportMeta, this, options.importModuleDynamically ? importModuleDynamicallyWrap(options.importModuleDynamically) : @undefined);
    else
      this[kNative] = new ModuleNative(identifier, context, syntheticExportNames, syntheticEvaluationSteps, this);
    this[kContext] = context;
  }
  get identifier() {
    return validateModule(this), this[kNative].identifier;
  }
  get context() {
    return validateModule(this), this[kContext];
  }
  get status() {
    return validateModule(this), this[kNative].getStatus();
  }
  get namespace() {
    if (validateModule(this), this[kNative].getStatusCode() < kLinked)
      throw @makeErrorWithCode(292, "must not be unlinked or linking");
    return this[kNative].getNamespace();
  }
  get error() {
    if (validateModule(this), this[kNative].getStatusCode() !== kErrored)
      throw @makeErrorWithCode(292, "must be errored");
    return this[kNative].getError();
  }
  async link(linker) {
    if (validateModule(this), validateFunction(linker, "linker"), this[kNative].getStatusCode() === kLinked)
      throw @makeErrorWithCode(293);
    if (this[kNative].getStatusCode() !== kUnlinked)
      throw @makeErrorWithCode(292, "must be unlinked");
    await this[kLink](linker), this[kNative].instantiate();
  }
  async evaluate(options = kEmptyObject) {
    validateModule(this), validateObject(options, "options");
    let timeout = options.timeout;
    if (timeout === @undefined)
      timeout = -1;
    else
      validateUint32(timeout, "options.timeout", !0);
    let { breakOnSigint = !1 } = options;
    validateBoolean(breakOnSigint, "options.breakOnSigint");
    let status = this[kNative].getStatusCode();
    if (status !== kLinked && status !== kEvaluated && status !== kErrored)
      throw @makeErrorWithCode(292, "must be one of linked, evaluated, or errored");
    await this[kNative].evaluate(timeout, breakOnSigint);
  }
  [util.inspect.custom](depth, options) {
    if (validateModule(this), typeof depth === "number" && depth < 0)
      return this;
    let constructor = getConstructorOf(this) || Module, o = { __proto__: { constructor } };
    return o.status = this.status, o.identifier = this.identifier, o.context = this.context, ObjectSetPrototypeOf(o, ObjectGetPrototypeOf(this)), ObjectDefineProperty(o, SymbolToStringTag, {
      __proto__: null,
      value: constructor.name,
      configurable: !0
    }), util.inspect(o, { ...options, customInspect: !1 });
  }
}

class SourceTextModule extends Module {
  #error = kNoError;
  #statusOverride;
  constructor(sourceText, options = kEmptyObject) {
    validateString(sourceText, "sourceText"), validateObject(options, "options");
    let {
      lineOffset = 0,
      columnOffset = 0,
      initializeImportMeta,
      importModuleDynamically,
      context,
      identifier,
      cachedData
    } = options;
    if (validateInt32(lineOffset, "options.lineOffset"), validateInt32(columnOffset, "options.columnOffset"), initializeImportMeta !== @undefined)
      validateFunction(initializeImportMeta, "options.initializeImportMeta");
    if (importModuleDynamically !== @undefined)
      validateFunction(importModuleDynamically, "options.importModuleDynamically");
    if (cachedData !== @undefined)
      validateBuffer(cachedData, "options.cachedData");
    super({
      sourceText,
      context,
      identifier,
      lineOffset,
      columnOffset,
      cachedData,
      initializeImportMeta,
      importModuleDynamically
    });
    this[kDependencySpecifiers] = @undefined;
  }
  async[kLink](linker) {
    if (validateModule(this, "SourceTextModule"), this[kNative].getStatusCode() >= kLinked)
      throw @makeErrorWithCode(293);
    this.#statusOverride = "linking";
    let moduleRequests = this[kNative].createModuleRecord(), specifiers = @Array(moduleRequests.length), modulePromises = @Array(moduleRequests.length);
    for (let idx = 0;idx < moduleRequests.length; idx++) {
      let { specifier, attributes } = moduleRequests[idx], linkerResult = linker(specifier, this, {
        attributes,
        assert: attributes
      }), modulePromise = PromisePrototypeThen.@call(PromiseResolve(linkerResult), async (mod) => {
        if (!isModule(mod))
          throw @makeErrorWithCode(295);
        if (mod.context !== this.context)
          throw @makeErrorWithCode(296);
        if (mod.status === "errored")
          throw @makeErrorWithCode(297, `request for '${specifier}' resolved to an errored mod`, mod.error);
        if (mod.status === "unlinked")
          await mod[kLink](linker);
        return mod[kNative];
      });
      modulePromises[idx] = modulePromise, specifiers[idx] = specifier;
    }
    try {
      let moduleNatives = await SafePromiseAllReturnArrayLike(modulePromises);
      this[kNative].link(specifiers, moduleNatives, 0);
    } catch (e) {
      throw this.#error = e, e;
    } finally {
      this.#statusOverride = @undefined;
    }
  }
  get dependencySpecifiers() {
    return validateModule(this, "SourceTextModule"), this[kDependencySpecifiers] ??= ObjectFreeze(ArrayPrototypeMap.@call(this[kNative].getModuleRequests(), (request) => request[0])), this[kDependencySpecifiers];
  }
  get status() {
    if (validateModule(this, "SourceTextModule"), this.#error !== kNoError)
      return "errored";
    if (this.#statusOverride)
      return this.#statusOverride;
    return super.status;
  }
  get error() {
    if (validateModule(this, "SourceTextModule"), this.#error !== kNoError)
      return this.#error;
    return super.error;
  }
  createCachedData() {
    validateModule(this, "SourceTextModule");
    let { status } = this;
    if (status === "evaluating" || status === "evaluated" || status === "errored")
      throw @makeErrorWithCode(294);
    return this[kNative].createCachedData();
  }
}

class SyntheticModule extends Module {
  constructor(exportNames, evaluateCallback, options = kEmptyObject) {
    if (!ArrayIsArray(exportNames) || ArrayPrototypeSome.@call(exportNames, (e) => typeof e !== "string"))
      throw @makeErrorWithCode(118, "exportNames", "Array of unique strings", exportNames);
    else
      ArrayPrototypeForEach.@call(exportNames, (name, i) => {
        if (ArrayPrototypeIndexOf.@call(exportNames, name, i + 1) !== -1)
          throw @makeErrorWithCode(119, `exportNames.${name}`, name, "is duplicated");
      });
    validateFunction(evaluateCallback, "evaluateCallback"), validateObject(options, "options");
    let { context, identifier } = options;
    super({
      syntheticExportNames: exportNames,
      syntheticEvaluationSteps: evaluateCallback,
      context,
      identifier
    });
  }
  [kLink]() {}
  setExport(name, value) {
    if (validateModule(this, "SyntheticModule"), validateString(name, "name"), this[kNative].getStatusCode() < kLinked)
      throw @makeErrorWithCode(292, "must be linked");
    this[kNative].setExport(name, value);
  }
}
var constants = {
  __proto__: null,
  USE_MAIN_CONTEXT_DEFAULT_LOADER,
  DONT_CONTEXTIFY
};
function isModule(object) {
  return typeof object === "object" && object !== null && ObjectPrototypeHasOwnProperty.@call(object, kNative);
}
function importModuleDynamicallyWrap(importModuleDynamically) {
  return async (...args) => {
    let m = await importModuleDynamically.@apply(this, args);
    if (isModuleNamespaceObject(m))
      return m;
    if (!isModule(m))
      throw @makeErrorWithCode(295);
    if (m.status === "errored")
      throw m.error;
    return m.namespace;
  };
}
function getConstructorOf(obj) {
  while (obj) {
    let descriptor = ObjectGetOwnPropertyDescriptor(obj, "constructor");
    if (descriptor !== @undefined && typeof descriptor.value === "function" && descriptor.value.name !== "")
      return descriptor.value;
    obj = ObjectGetPrototypeOf(obj);
  }
}
$ = {
  createContext,
  runInContext,
  runInNewContext,
  runInThisContext,
  isContext,
  compileFunction,
  measureMemory,
  Script,
  Module,
  SourceTextModule,
  SyntheticModule,
  createScript,
  constants: ObjectFreeze(constants)
};
return $})

