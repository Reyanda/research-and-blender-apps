(function (){"use strict";// build/release/tmp_modules/internal/util/inspect.ts
var $, { pathToFileURL } = @getInternalField(@internalModuleRegistry, 125) || @createInternalModuleById(125), BufferModule, primordials = @getInternalField(@internalModuleRegistry, 30) || @createInternalModuleById(30), { uncurryThis } = primordials, {
  MapPrototypeGetSize,
  SafeMap,
  SafeSet,
  SetPrototypeGetSize,
  TypedArrayPrototypeGetLength,
  TypedArrayPrototypeGetSymbolToStringTag
} = primordials, ArrayFrom = @Array.from, ArrayPrototypeFilter = uncurryThis(@Array.prototype.filter), ArrayPrototypeFlat = uncurryThis(@Array.prototype.flat), ArrayPrototypeForEach = uncurryThis(@Array.prototype.forEach), ArrayPrototypeIncludes = uncurryThis(@Array.prototype.includes), ArrayPrototypeIndexOf = uncurryThis(@Array.prototype.indexOf), ArrayPrototypeJoin = uncurryThis(@Array.prototype.join), ArrayPrototypeMap = uncurryThis(@Array.prototype.map), ArrayPrototypePop = uncurryThis(@Array.prototype.pop), ArrayPrototypePush = @Array.prototype.push, ArrayPrototypeSlice = uncurryThis(@Array.prototype.slice), ArrayPrototypeSplice = uncurryThis(@Array.prototype.splice), ArrayPrototypeSort = uncurryThis(@Array.prototype.sort), ArrayPrototypeUnshift = uncurryThis(@Array.prototype.unshift), BigIntPrototypeValueOf = uncurryThis(BigInt.prototype.valueOf), BooleanPrototypeValueOf = uncurryThis(Boolean.prototype.valueOf), DatePrototypeGetTime = uncurryThis(Date.prototype.getTime), DatePrototypeToISOString = uncurryThis(Date.prototype.toISOString), DatePrototypeToString = uncurryThis(Date.prototype.toString), ErrorCaptureStackTrace = Error.captureStackTrace, ErrorPrototypeToString = uncurryThis(Error.prototype.toString), FunctionPrototypeBind = uncurryThis(Function.prototype.bind), FunctionPrototypeToString = uncurryThis(Function.prototype.toString), JSONStringify = JSON.stringify, MapPrototypeEntries = uncurryThis(Map.prototype.entries), MapPrototypeValues = uncurryThis(Map.prototype.values), MapPrototypeKeys = uncurryThis(Map.prototype.keys), MathFloor = Math.floor, MathMax = Math.max, MathRound = Math.round, MathSqrt = Math.sqrt, MathTrunc = Math.trunc, NumberIsFinite = Number.isFinite, NumberIsNaN = Number.isNaN, NumberParseFloat = Number.parseFloat, NumberParseInt = Number.parseInt, NumberPrototypeToString = uncurryThis(Number.prototype.toString), NumberPrototypeValueOf = uncurryThis(Number.prototype.valueOf), ObjectAssign = Object.assign, ObjectDefineProperty = Object.defineProperty, ObjectEntries = Object.entries, ObjectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor, ObjectGetOwnPropertyDescriptors = Object.getOwnPropertyDescriptors, ObjectGetOwnPropertyNames = Object.getOwnPropertyNames, ObjectGetOwnPropertySymbols = Object.getOwnPropertySymbols, ObjectGetPrototypeOf = Object.getPrototypeOf, ObjectIs = Object.is, ObjectKeys = Object.keys, ObjectPrototypeHasOwnProperty = uncurryThis(Object.prototype.hasOwnProperty), ObjectPrototypePropertyIsEnumerable = uncurryThis(Object.prototype.propertyIsEnumerable), ObjectPrototypeToString = uncurryThis(Object.prototype.toString), ObjectSeal = Object.seal, ObjectSetPrototypeOf = Object.setPrototypeOf, ReflectOwnKeys = Reflect.ownKeys, RegExpPrototypeExec = uncurryThis(@RegExp.prototype.exec), RegExpPrototypeSymbolReplace = uncurryThis(@RegExp.prototype[Symbol.replace]), RegExpPrototypeSymbolSplit = uncurryThis(@RegExp.prototype[Symbol.split]), RegExpPrototypeTest = uncurryThis(@RegExp.prototype.test), RegExpPrototypeToString = uncurryThis(@RegExp.prototype.toString), SetPrototypeEntries = uncurryThis(Set.prototype.entries), SetPrototypeValues = uncurryThis(Set.prototype.values), StringPrototypeCharCodeAt = uncurryThis(@String.prototype.charCodeAt), StringPrototypeIncludes = uncurryThis(@String.prototype.includes), StringPrototypeIndexOf = uncurryThis(@String.prototype.indexOf), StringPrototypeLastIndexOf = uncurryThis(@String.prototype.lastIndexOf), StringPrototypeMatch = uncurryThis(@String.prototype.match), StringPrototypeNormalize = uncurryThis(@String.prototype.normalize), StringPrototypePadEnd = uncurryThis(@String.prototype.padEnd), StringPrototypePadStart = uncurryThis(@String.prototype.padStart), StringPrototypeRepeat = uncurryThis(@String.prototype.repeat), StringPrototypeReplaceAll = uncurryThis(@String.prototype.replaceAll), StringPrototypeSlice = uncurryThis(@String.prototype.slice), StringPrototypeSplit = uncurryThis(@String.prototype.split), StringPrototypeEndsWith = uncurryThis(@String.prototype.endsWith), StringPrototypeStartsWith = uncurryThis(@String.prototype.startsWith), StringPrototypeToLowerCase = uncurryThis(@String.prototype.toLowerCase), StringPrototypeTrim = uncurryThis(@String.prototype.trim), StringPrototypeValueOf = uncurryThis(@String.prototype.valueOf), SymbolPrototypeToString = uncurryThis(Symbol.prototype.toString), SymbolPrototypeValueOf = uncurryThis(Symbol.prototype.valueOf), SymbolIterator = Symbol.iterator, SymbolToStringTag = Symbol.toStringTag, customInspectSymbol = Symbol.for("nodejs.util.inspect.custom"), kPending = Symbol("kPending"), kFulfilled = Symbol("kFulfilled"), kRejected = Symbol("kRejected");
var extractedSplitNewLinesFastPathStringsOnly = @lazy(19), isAsyncFunction = (v) => typeof v === "function" && StringPrototypeStartsWith(FunctionPrototypeToString(v), "async"), isGeneratorFunction = (v) => typeof v === "function" && StringPrototypeMatch(FunctionPrototypeToString(v), /^(async\s+)?function *\*/);
function vmSafeInstanceof(val, ctor) {
  if (val instanceof ctor)
    return !0;
  while (val) {
    if (typeof val !== "object")
      return !1;
    if (ctor.name === internalGetConstructorName(val))
      return !0;
    val = ObjectGetPrototypeOf(val);
  }
  return !1;
}
function checkBox(ctor) {
  return (val) => {
    if (!vmSafeInstanceof(val, ctor))
      return !1;
    try {
      ctor.prototype.valueOf.@call(val);
    } catch {
      return !1;
    }
    return !0;
  };
}
var isBigIntObject = checkBox(BigInt), isSymbolObject = checkBox(Symbol), {
  isAnyArrayBuffer,
  isArrayBuffer,
  isArgumentsObject,
  isBoxedPrimitive: _native_isBoxedPrimitive,
  isDataView,
  isExternal,
  isMap,
  isMapIterator,
  isModuleNamespaceObject,
  isNativeError,
  isPromise,
  isSet,
  isSetIterator,
  isWeakMap,
  isWeakSet,
  isRegExp,
  isDate,
  isTypedArray,
  isStringObject,
  isNumberObject,
  isBooleanObject
} = @getInternalField(@internalModuleRegistry, 144) || @createInternalModuleById(144);
//! The native versions of the commented out functions are currently buggy, so we use the polyfills above for now.
//! temp workaround to apply is{BigInt,Symbol}Object fix
var isBoxedPrimitive = (val) => isBigIntObject(val) || isSymbolObject(val) || _native_isBoxedPrimitive(val);

class AssertionError extends Error {
  constructor(message, isForced = !1) {
    super(message);
    this.name = "AssertionError", this.code = "ERR_ASSERTION", this.operator = "==", this.generatedMessage = !isForced, this.actual = isForced && @undefined, this.expected = !isForced || @undefined;
  }
}
function assert(p, message) {
  if (!p)
    throw new AssertionError(message);
}
var codes = {};
{
  let kTypes = [
    "string",
    "function",
    "number",
    "object",
    "Function",
    "Object",
    "boolean",
    "bigint",
    "symbol"
  ], classRegExp = /^([A-Z][a-z0-9]*)+$/, messages = new SafeMap, sym = "ERR_INVALID_ARG_TYPE";
  messages.set("ERR_INVALID_ARG_TYPE", (name, expected, actual) => {
    if (assert(typeof name === "string", "'name' must be a string"), !@isJSArray(expected))
      expected = [expected];
    let msg = "The ";
    if (StringPrototypeEndsWith(name, " argument"))
      msg += `${name} `;
    else
      msg += `"${name}" ${StringPrototypeIncludes(name, ".") ? "property" : "argument"} `;
    msg += "must be ";
    let types = [], instances = [], other = [];
    for (let value of expected)
      if (assert(typeof value === "string", "All expected entries have to be of type string"), ArrayPrototypeIncludes(kTypes, value))
        ArrayPrototypePush.@call(types, StringPrototypeToLowerCase(value));
      else if (RegExpPrototypeTest(classRegExp, value))
        ArrayPrototypePush.@call(instances, value);
      else
        assert(value !== "object", 'The value "object" should be written as "Object"'), ArrayPrototypePush.@call(other, value);
    if (instances.length > 0) {
      let pos = ArrayPrototypeIndexOf(types, "object");
      if (pos !== -1)
        ArrayPrototypeSplice(types, pos, 1), ArrayPrototypePush.@call(instances, "Object");
    }
    if (types.length > 0) {
      if (types.length > 2)
        msg += `one of type ${ArrayPrototypeJoin(types, ", ")}, or ${ArrayPrototypePop(types)}`;
      else if (types.length === 2)
        msg += `one of type ${types[0]} or ${types[1]}`;
      else
        msg += `of type ${types[0]}`;
      if (instances.length > 0 || other.length > 0)
        msg += " or ";
    }
    if (instances.length > 0) {
      if (instances.length > 2)
        msg += `an instance of ${ArrayPrototypeJoin(instances, ", ")}, or ${ArrayPrototypePop(instances)}`;
      else
        msg += `an instance of ${instances[0]}` + (instances.length === 2 ? ` or ${instances[1]}` : "");
      if (other.length > 0)
        msg += " or ";
    }
    if (other.length > 0)
      if (other.length > 2) {
        let last = ArrayPrototypePop(other);
        msg += `one of ${ArrayPrototypeJoin(other, ", ")}, or ${last}`;
      } else if (other.length === 2)
        msg += `one of ${other[0]} or ${other[1]}`;
      else {
        if (StringPrototypeToLowerCase(other[0]) !== other[0])
          msg += "an ";
        msg += `${other[0]}`;
      }
    if (actual == null)
      msg += `. Received ${actual}`;
    else if (typeof actual === "function" && actual.name)
      msg += `. Received function ${actual.name}`;
    else if (typeof actual === "object")
      if (actual.constructor && actual.constructor.name)
        msg += `. Received an instance of ${actual.constructor.name}`;
      else
        msg += `. Received ${inspect(actual, { depth: -1 })}`;
    else {
      let inspected = inspect(actual, { colors: !1 });
      if (inspected.length > 25)
        inspected = `${StringPrototypeSlice(inspected, 0, 25)}...`;
      msg += `. Received type ${typeof actual} (${inspected})`;
    }
    return msg;
  }), codes.ERR_INVALID_ARG_TYPE = function NodeError(...args) {
    let limit = Error.stackTraceLimit;
    Error.stackTraceLimit = 0;
    let error = @makeTypeError();
    Error.stackTraceLimit = limit;
    let msg = messages.get("ERR_INVALID_ARG_TYPE");
    assert(typeof msg === "function"), assert(msg.length <= args.length, `Code: ERR_INVALID_ARG_TYPE; The provided arguments length (${args.length}) does not match the required ones (${msg.length}).`);
    let message = msg.@apply(error, args);
    ObjectDefineProperty(error, "message", { value: message, enumerable: !1, writable: !0, configurable: !0 }), ObjectDefineProperty(error, "toString", {
      value() {
        return `${this.name} [ERR_INVALID_ARG_TYPE]: ${this.message}`;
      },
      enumerable: !1,
      writable: !0,
      configurable: !0
    });
    let err = error, userStackTraceLimit = Error.stackTraceLimit;
    return Error.stackTraceLimit = @Infinity, ErrorCaptureStackTrace(err), Error.stackTraceLimit = userStackTraceLimit, err.name = `${TypeError.name} [ERR_INVALID_ARG_TYPE]`, err.stack, delete err.name, error.code = "ERR_INVALID_ARG_TYPE", error;
  };
}
var validateObject = (value, name, allowArray = !1) => {
  if (value === null || !allowArray && @isJSArray(value) || typeof value !== "object" && typeof value !== "function")
    throw new codes.ERR_INVALID_ARG_TYPE(name, "Object", value);
};
function isURL(value) {
  return typeof value.href === "string" && value instanceof URL;
}
var builtInObjects = new SafeSet(ArrayPrototypeFilter(ObjectGetOwnPropertyNames(globalThis), (e) => RegExpPrototypeExec(/^[A-Z][a-zA-Z0-9]+$/, e) !== null)), isUndetectableObject = (v) => typeof v > "u" && v !== @undefined, ERROR_STACK_OVERFLOW_MSG = "Maximum call stack size exceeded.", inspectDefaultOptions = ObjectSeal({
  showHidden: !1,
  depth: 2,
  colors: !1,
  customInspect: !0,
  showProxy: !1,
  maxArrayLength: 100,
  maxStringLength: 1e4,
  breakLength: 80,
  compact: 3,
  sorted: !1,
  getters: !1,
  numericSeparator: !1
}), inspectReplDefaults = ObjectSeal({
  ...inspectDefaultOptions,
  colors: Bun.enableANSIColors,
  showProxy: !0
}), kObjectType = 0, kArrayType = 1, kArrayExtrasType = 2, strEscapeSequencesRegExp, strEscapeSequencesReplacer, strEscapeSequencesRegExpSingle, strEscapeSequencesReplacerSingle, extractedSplitNewLinesSlow;
try {
  strEscapeSequencesRegExp = new @RegExp("[\\x00-\\x1f\\x27\\x5c\\x7f-\\x9f]|[\\ud800-\\udbff](?![\\udc00-\\udfff])|(?<![\\ud800-\\udbff])[\\udc00-\\udfff]"), strEscapeSequencesReplacer = new @RegExp("[\x00-\\x1f\\x27\\x5c\\x7f-\\x9f]|[\\ud800-\\udbff](?![\\udc00-\\udfff])|(?<![\\ud800-\\udbff])[\\udc00-\\udfff]", "g"), strEscapeSequencesRegExpSingle = new @RegExp("[\\x00-\\x1f\\x5c\\x7f-\\x9f]|[\\ud800-\\udbff](?![\\udc00-\\udfff])|(?<![\\ud800-\\udbff])[\\udc00-\\udfff]"), strEscapeSequencesReplacerSingle = new @RegExp("[\\x00-\\x1f\\x5c\\x7f-\\x9f]|[\\ud800-\\udbff](?![\\udc00-\\udfff])|(?<![\\ud800-\\udbff])[\\udc00-\\udfff]", "g");
  let extractedNewLineRe = new @RegExp("(?<=\\n)");
  extractedSplitNewLinesSlow = (value) => RegExpPrototypeSymbolSplit(extractedNewLineRe, value);
} catch {
  strEscapeSequencesRegExp = /[\x00-\x1f\x27\x5c\x7f-\x9f]/, strEscapeSequencesReplacer = /[\x00-\x1f\x27\x5c\x7f-\x9f]/g, strEscapeSequencesRegExpSingle = /[\x00-\x1f\x5c\x7f-\x9f]/, strEscapeSequencesReplacerSingle = /[\x00-\x1f\x5c\x7f-\x9f]/g, extractedSplitNewLinesSlow = (value) => {
    let lines = RegExpPrototypeSymbolSplit(/\n/, value), last = ArrayPrototypePop(lines), nlLines = ArrayPrototypeMap(lines, (line) => line + `
`);
    if (last !== "")
      nlLines.push(last);
    return nlLines;
  };
}
var extractedSplitNewLines = (value) => {
  if (typeof value === "string")
    return extractedSplitNewLinesFastPathStringsOnly(value) || extractedSplitNewLinesSlow(value);
  return extractedSplitNewLinesSlow(value);
}, keyStrRegExp = /^[a-zA-Z_][a-zA-Z_0-9]*$/, numberRegExp = /^(0|[1-9][0-9]*)$/, coreModuleRegExp = /^ {4}at (?:[^/\\(]+ \(|)node:(.+):\d+:\d+\)?$/, nodeModulesRegExp = /[/\\]node_modules[/\\](.+?)(?=[/\\])/g, classRegExp = /^(\s+[^(]*?)\s*{/, stripCommentsRegExp = /(\/\/.*?\n)|(\/\*(.|\n)*?\*\/)/g, kMinLineLength = 16, kWeak = 0, kIterator = 1, kMapEntries = 2, meta = [
  "\\x00",
  "\\x01",
  "\\x02",
  "\\x03",
  "\\x04",
  "\\x05",
  "\\x06",
  "\\x07",
  "\\b",
  "\\t",
  "\\n",
  "\\x0B",
  "\\f",
  "\\r",
  "\\x0E",
  "\\x0F",
  "\\x10",
  "\\x11",
  "\\x12",
  "\\x13",
  "\\x14",
  "\\x15",
  "\\x16",
  "\\x17",
  "\\x18",
  "\\x19",
  "\\x1A",
  "\\x1B",
  "\\x1C",
  "\\x1D",
  "\\x1E",
  "\\x1F",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "\\'",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "\\\\",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "\\x7F",
  "\\x80",
  "\\x81",
  "\\x82",
  "\\x83",
  "\\x84",
  "\\x85",
  "\\x86",
  "\\x87",
  "\\x88",
  "\\x89",
  "\\x8A",
  "\\x8B",
  "\\x8C",
  "\\x8D",
  "\\x8E",
  "\\x8F",
  "\\x90",
  "\\x91",
  "\\x92",
  "\\x93",
  "\\x94",
  "\\x95",
  "\\x96",
  "\\x97",
  "\\x98",
  "\\x99",
  "\\x9A",
  "\\x9B",
  "\\x9C",
  "\\x9D",
  "\\x9E",
  "\\x9F"
];
function getUserOptions(ctx, isCrossContext) {
  let ret = {
    stylize: ctx.stylize,
    showHidden: ctx.showHidden,
    depth: ctx.depth,
    colors: ctx.colors,
    customInspect: ctx.customInspect,
    showProxy: ctx.showProxy,
    maxArrayLength: ctx.maxArrayLength,
    maxStringLength: ctx.maxStringLength,
    breakLength: ctx.breakLength,
    compact: ctx.compact,
    sorted: ctx.sorted,
    getters: ctx.getters,
    numericSeparator: ctx.numericSeparator,
    ...ctx.userOptions
  };
  if (isCrossContext) {
    ObjectSetPrototypeOf(ret, null);
    for (let key of ObjectKeys(ret))
      if ((typeof ret[key] === "object" || typeof ret[key] === "function") && ret[key] !== null)
        delete ret[key];
    ret.stylize = ObjectSetPrototypeOf((value, flavour) => {
      let stylized;
      try {
        stylized = `${ctx.stylize(value, flavour)}`;
      } catch {}
      if (typeof stylized !== "string")
        return value;
      return stylized;
    }, null);
  }
  return ret;
}
function inspect(value, opts) {
  let ctx = {
    budget: {},
    indentationLvl: 0,
    seen: [],
    currentDepth: 0,
    stylize: stylizeNoColor,
    showHidden: inspectDefaultOptions.showHidden,
    depth: inspectDefaultOptions.depth,
    colors: inspectDefaultOptions.colors,
    customInspect: inspectDefaultOptions.customInspect,
    showProxy: inspectDefaultOptions.showProxy,
    maxArrayLength: inspectDefaultOptions.maxArrayLength,
    maxStringLength: inspectDefaultOptions.maxStringLength,
    breakLength: inspectDefaultOptions.breakLength,
    compact: inspectDefaultOptions.compact,
    sorted: inspectDefaultOptions.sorted,
    getters: inspectDefaultOptions.getters,
    numericSeparator: inspectDefaultOptions.numericSeparator
  };
  if (arguments.length > 1) {
    if (arguments.length > 2) {
      if (arguments[2] !== @undefined)
        ctx.depth = arguments[2];
      if (arguments.length > 3 && arguments[3] !== @undefined)
        ctx.colors = arguments[3];
    }
    if (typeof opts === "boolean")
      ctx.showHidden = opts;
    else if (opts) {
      let optKeys = ObjectKeys(opts);
      for (let i = 0;i < optKeys.length; ++i) {
        let key = optKeys[i];
        if (ObjectPrototypeHasOwnProperty(inspectDefaultOptions, key) || key === "stylize")
          ctx[key] = opts[key];
        else if (ctx.userOptions === @undefined)
          ctx.userOptions = opts;
      }
    }
  }
  if (ctx.colors)
    ctx.stylize = stylizeWithColor;
  if (ctx.maxArrayLength === null)
    ctx.maxArrayLength = @Infinity;
  if (ctx.maxStringLength === null)
    ctx.maxStringLength = @Infinity;
  return formatValue(ctx, value, 0);
}
inspect.custom = customInspectSymbol;
ObjectDefineProperty(inspect, "defaultOptions", {
  __proto__: null,
  get() {
    return inspectDefaultOptions;
  },
  set(options) {
    return validateObject(options, "options"), ObjectAssign(inspectDefaultOptions, options);
  }
});
ObjectDefineProperty(inspect, "replDefaults", {
  __proto__: null,
  get() {
    return inspectReplDefaults;
  },
  set(options) {
    return validateObject(options, "options"), ObjectAssign(inspectReplDefaults, options);
  }
});
var defaultFG = 39, defaultBG = 49;
inspect.colors = {
  __proto__: null,
  reset: [0, 0],
  bold: [1, 22],
  dim: [2, 22],
  italic: [3, 23],
  underline: [4, 24],
  blink: [5, 25],
  inverse: [7, 27],
  hidden: [8, 28],
  strikethrough: [9, 29],
  doubleunderline: [21, 24],
  black: [30, defaultFG],
  red: [31, defaultFG],
  green: [32, defaultFG],
  yellow: [33, defaultFG],
  blue: [34, defaultFG],
  magenta: [35, defaultFG],
  cyan: [36, defaultFG],
  white: [37, defaultFG],
  bgBlack: [40, defaultBG],
  bgRed: [41, defaultBG],
  bgGreen: [42, defaultBG],
  bgYellow: [43, defaultBG],
  bgBlue: [44, defaultBG],
  bgMagenta: [45, defaultBG],
  bgCyan: [46, defaultBG],
  bgWhite: [47, defaultBG],
  framed: [51, 54],
  overlined: [53, 55],
  gray: [90, defaultFG],
  redBright: [91, defaultFG],
  greenBright: [92, defaultFG],
  yellowBright: [93, defaultFG],
  blueBright: [94, defaultFG],
  magentaBright: [95, defaultFG],
  cyanBright: [96, defaultFG],
  whiteBright: [97, defaultFG],
  bgGray: [100, defaultBG],
  bgRedBright: [101, defaultBG],
  bgGreenBright: [102, defaultBG],
  bgYellowBright: [103, defaultBG],
  bgBlueBright: [104, defaultBG],
  bgMagentaBright: [105, defaultBG],
  bgCyanBright: [106, defaultBG],
  bgWhiteBright: [107, defaultBG]
};
function defineColorAlias(target, alias) {
  ObjectDefineProperty(inspect.colors, alias, {
    __proto__: null,
    get() {
      return this[target];
    },
    set(value) {
      this[target] = value;
    },
    configurable: !0,
    enumerable: !1
  });
}
defineColorAlias("gray", "grey");
defineColorAlias("gray", "blackBright");
defineColorAlias("bgGray", "bgGrey");
defineColorAlias("bgGray", "bgBlackBright");
defineColorAlias("dim", "faint");
defineColorAlias("strikethrough", "crossedout");
defineColorAlias("strikethrough", "strikeThrough");
defineColorAlias("strikethrough", "crossedOut");
defineColorAlias("hidden", "conceal");
defineColorAlias("inverse", "swapColors");
defineColorAlias("inverse", "swapcolors");
defineColorAlias("doubleunderline", "doubleUnderline");
inspect.styles = {
  __proto__: null,
  special: "cyan",
  number: "yellow",
  bigint: "yellow",
  boolean: "yellow",
  undefined: "grey",
  null: "bold",
  string: "green",
  symbol: "green",
  date: "magenta",
  regexp: "red",
  module: "underline"
};
function addQuotes(str, quotes) {
  if (quotes === -1)
    return `"${str}"`;
  if (quotes === -2)
    return `\`${str}\``;
  return `'${str}'`;
}
function escapeFn(str) {
  let charCode = StringPrototypeCharCodeAt(str);
  return meta.length > charCode ? meta[charCode] : `\\u${NumberPrototypeToString(charCode, 16)}`;
}
function strEscape(str) {
  let escapeTest = strEscapeSequencesRegExp, escapeReplace = strEscapeSequencesReplacer, singleQuote = 39;
  if (StringPrototypeIncludes(str, "'")) {
    if (!StringPrototypeIncludes(str, '"'))
      singleQuote = -1;
    else if (!StringPrototypeIncludes(str, "`") && !StringPrototypeIncludes(str, "${"))
      singleQuote = -2;
    if (singleQuote !== 39)
      escapeTest = strEscapeSequencesRegExpSingle, escapeReplace = strEscapeSequencesReplacerSingle;
  }
  if (str.length < 5000 && RegExpPrototypeExec(escapeTest, str) === null)
    return addQuotes(str, singleQuote);
  if (str.length > 100)
    return str = RegExpPrototypeSymbolReplace(escapeReplace, str, escapeFn), addQuotes(str, singleQuote);
  let result = "", last = 0;
  for (let i = 0;i < str.length; i++) {
    let point = StringPrototypeCharCodeAt(str, i);
    if (point === singleQuote || point === 92 || point < 32 || point > 126 && point < 160) {
      if (last === i)
        result += meta[point];
      else
        result += `${StringPrototypeSlice(str, last, i)}${meta[point]}`;
      last = i + 1;
    } else if (point >= 55296 && point <= 57343) {
      if (point <= 56319 && i + 1 < str.length) {
        let point2 = StringPrototypeCharCodeAt(str, i + 1);
        if (point2 >= 56320 && point2 <= 57343) {
          i++;
          continue;
        }
      }
      result += `${StringPrototypeSlice(str, last, i)}\\u${NumberPrototypeToString(point, 16)}`, last = i + 1;
    }
  }
  if (last !== str.length)
    result += StringPrototypeSlice(str, last);
  return addQuotes(result, singleQuote);
}
function stylizeWithColor(str, styleType) {
  let style = inspect.styles[styleType];
  if (style !== @undefined) {
    let color = inspect.colors[style];
    if (color !== @undefined)
      return `\x1B[${color[0]}m${str}\x1B[${color[1]}m`;
  }
  return str;
}
function stylizeNoColor(str) {
  return str;
}
function getEmptyFormatArray() {
  return [];
}
function isInstanceof(object, proto) {
  try {
    return object instanceof proto;
  } catch {
    return !1;
  }
}
var wellKnownPrototypes;
function initializeWellKnownPrototypes() {
  wellKnownPrototypes = new SafeMap, wellKnownPrototypes.set(@Array.prototype, { name: "Array", constructor: @Array }), wellKnownPrototypes.set(@ArrayBuffer.prototype, { name: "ArrayBuffer", constructor: @ArrayBuffer }), wellKnownPrototypes.set(Function.prototype, { name: "Function", constructor: Function }), wellKnownPrototypes.set(Map.prototype, { name: "Map", constructor: Map }), wellKnownPrototypes.set(Object.prototype, { name: "Object", constructor: Object }), wellKnownPrototypes.set(Set.prototype, { name: "Set", constructor: Set });
}
function getConstructorName(obj, ctx, recurseTimes, protoProps) {
  let firstProto, tmp = obj;
  if (!wellKnownPrototypes)
    initializeWellKnownPrototypes();
  while (obj || isUndetectableObject(obj)) {
    let wellKnownPrototypeNameAndConstructor = wellKnownPrototypes.get(obj);
    if (wellKnownPrototypeNameAndConstructor != null) {
      let { name, constructor } = wellKnownPrototypeNameAndConstructor;
      if (tmp instanceof constructor) {
        if (protoProps !== @undefined && firstProto !== obj)
          addPrototypeProperties(ctx, tmp, firstProto || tmp, recurseTimes, protoProps);
        return name;
      }
    }
    let descriptor = ObjectGetOwnPropertyDescriptor(obj, "constructor");
    if (descriptor !== @undefined && typeof descriptor.value === "function" && descriptor.value.name !== "" && isInstanceof(tmp, descriptor.value)) {
      if (protoProps !== @undefined && (firstProto !== obj || !builtInObjects.has(descriptor.value.name)))
        addPrototypeProperties(ctx, tmp, firstProto || tmp, recurseTimes, protoProps);
      return @String(descriptor.value.name);
    }
    if (obj = ObjectGetPrototypeOf(obj), firstProto === @undefined)
      firstProto = obj;
  }
  if (firstProto === null)
    return null;
  let res = internalGetConstructorName(tmp);
  if (recurseTimes > ctx.depth && ctx.depth !== null)
    return `${res} <Complex prototype>`;
  let protoConstr = getConstructorName(firstProto, ctx, recurseTimes + 1, protoProps);
  if (protoConstr === null)
    return `${res} <${inspect(firstProto, {
      ...ctx,
      customInspect: !1,
      depth: -1
    })}>`;
  return `${res} <${protoConstr}>`;
}
function addPrototypeProperties(ctx, main, obj, recurseTimes, output) {
  let depth = 0, keys, keySet;
  do {
    if (depth !== 0 || main === obj) {
      if (obj = ObjectGetPrototypeOf(obj), obj === null)
        return;
      let descriptor = ObjectGetOwnPropertyDescriptor(obj, "constructor");
      if (descriptor !== @undefined && typeof descriptor.value === "function" && builtInObjects.has(descriptor.value.name))
        return;
    }
    if (depth === 0)
      keySet = new SafeSet;
    else
      ArrayPrototypeForEach(keys, (key) => keySet.add(key));
    keys = ReflectOwnKeys(obj), ArrayPrototypePush.@call(ctx.seen, main);
    for (let key of keys) {
      if (key === "constructor" || ObjectPrototypeHasOwnProperty(main, key) || depth !== 0 && keySet.has(key))
        continue;
      let desc = ObjectGetOwnPropertyDescriptor(obj, key);
      if (typeof desc.value === "function")
        continue;
      let value = formatProperty(ctx, obj, recurseTimes, key, kObjectType, desc, main);
      if (ctx.colors)
        ArrayPrototypePush.@call(output, `\x1B[2m${value}\x1B[22m`);
      else
        ArrayPrototypePush.@call(output, value);
    }
    ArrayPrototypePop(ctx.seen);
  } while (++depth !== 3);
}
function getPrefix(constructor, tag, fallback, size = "") {
  if (constructor === null) {
    if (tag !== "" && fallback !== tag)
      return `[${fallback}${size}: null prototype] [${tag}] `;
    return `[${fallback}${size}: null prototype] `;
  }
  if (tag !== "" && constructor !== tag)
    return `${constructor}${size} [${tag}] `;
  return `${constructor}${size} `;
}
function getKeys(value, showHidden) {
  let keys, symbols = ObjectGetOwnPropertySymbols(value);
  if (showHidden) {
    if (keys = ObjectGetOwnPropertyNames(value), symbols.length !== 0)
      ArrayPrototypePush.@apply(keys, symbols);
  } else {
    try {
      keys = ObjectKeys(value);
    } catch (err) {
      assert(isNativeError(err) && err.name === "ReferenceError" && isModuleNamespaceObject(value)), keys = ObjectGetOwnPropertyNames(value);
    }
    if (symbols.length !== 0) {
      let filter = (key) => ObjectPrototypePropertyIsEnumerable(value, key);
      ArrayPrototypePush.@apply(keys, ArrayPrototypeFilter(symbols, filter));
    }
  }
  return keys;
}
function getCtxStyle(value, constructor, tag) {
  let fallback = "";
  if (constructor === null) {
    if (fallback = internalGetConstructorName(value), fallback === tag)
      fallback = "Object";
  }
  return getPrefix(constructor, tag, fallback);
}
function formatProxy(ctx, proxy, recurseTimes) {
  if (recurseTimes > ctx.depth && ctx.depth !== null)
    return ctx.stylize("Proxy [Array]", "special");
  recurseTimes += 1, ctx.indentationLvl += 2;
  let res = [formatValue(ctx, proxy[0], recurseTimes), formatValue(ctx, proxy[1], recurseTimes)];
  return ctx.indentationLvl -= 2, reduceToSingleString(ctx, res, "", ["Proxy [", "]"], kArrayExtrasType, recurseTimes);
}
function formatValue(ctx, value, recurseTimes, typedArray) {
  if (typeof value !== "object" && typeof value !== "function" && !isUndetectableObject(value))
    return formatPrimitive(ctx.stylize, value, ctx);
  if (value === null)
    return ctx.stylize("null", "null");
  let context = value, proxy = getProxyDetails(value, !!ctx.showProxy);
  if (proxy !== @undefined) {
    if (proxy === null || proxy[0] === null)
      return ctx.stylize("<Revoked Proxy>", "special");
    if (ctx.showProxy)
      return formatProxy(ctx, proxy, recurseTimes);
    value = proxy;
  }
  if (ctx.customInspect) {
    let maybeCustom = value[customInspectSymbol];
    if (typeof maybeCustom === "function" && maybeCustom !== inspect && Object.getOwnPropertyDescriptor(value, "constructor")?.value?.prototype !== value) {
      let depth = ctx.depth === null ? null : ctx.depth - recurseTimes, isCrossContext = proxy !== @undefined || !(context instanceof Object), ret = maybeCustom.@call(context, depth, getUserOptions(ctx, isCrossContext), inspect);
      if (ret !== context) {
        if (typeof ret !== "string")
          return formatValue(ctx, ret, recurseTimes);
        return StringPrototypeReplaceAll(ret, `
`, `
${StringPrototypeRepeat(" ", ctx.indentationLvl)}`);
      }
    }
  }
  if (ctx.seen.includes(value)) {
    let index = 1;
    if (ctx.circular === @undefined)
      ctx.circular = new SafeMap, ctx.circular.set(value, index);
    else if (index = ctx.circular.get(value), index === @undefined)
      index = ctx.circular.size + 1, ctx.circular.set(value, index);
    return ctx.stylize(`[Circular *${index}]`, "special");
  }
  return formatRaw(ctx, value, recurseTimes, typedArray);
}
function formatRaw(ctx, value, recurseTimes, typedArray) {
  let keys, protoProps;
  if (ctx.showHidden && (recurseTimes <= ctx.depth || ctx.depth === null))
    protoProps = [];
  let constructor = getConstructorName(value, ctx, recurseTimes, protoProps);
  if (protoProps !== @undefined && protoProps.length === 0)
    protoProps = @undefined;
  let tag = value[SymbolToStringTag];
  if (typeof tag !== "string" || tag !== "" && (ctx.showHidden ? ObjectPrototypeHasOwnProperty : ObjectPrototypePropertyIsEnumerable)(value, SymbolToStringTag))
    tag = "";
  let base = "", formatter = getEmptyFormatArray, braces, noIterator = !0, i = 0, filter = ctx.showHidden ? 0 : 2, extrasType = kObjectType;
  if (SymbolIterator in value || constructor === null)
    if (noIterator = !1, @isJSArray(value)) {
      let prefix = constructor !== "Array" || tag !== "" ? getPrefix(constructor, tag, "Array", `(${value.length})`) : "";
      if (keys = getOwnNonIndexProperties(value, filter), braces = [`${prefix}[`, "]"], value.length === 0 && keys.length === 0 && protoProps === @undefined)
        return `${braces[0]}]`;
      extrasType = kArrayExtrasType, formatter = formatArray;
    } else if (isSet(value)) {
      let size = SetPrototypeGetSize(value), prefix = getPrefix(constructor, tag, "Set", `(${size})`);
      if (keys = getKeys(value, ctx.showHidden), formatter = constructor !== null ? FunctionPrototypeBind(formatSet, null, value) : FunctionPrototypeBind(formatSet, null, SetPrototypeValues(value)), size === 0 && keys.length === 0 && protoProps === @undefined)
        return `${prefix}{}`;
      braces = [`${prefix}{`, "}"];
    } else if (isMap(value)) {
      let size = MapPrototypeGetSize(value), prefix = getPrefix(constructor, tag, "Map", `(${size})`);
      if (keys = getKeys(value, ctx.showHidden), formatter = constructor !== null ? FunctionPrototypeBind(formatMap, null, value) : FunctionPrototypeBind(formatMap, null, MapPrototypeEntries(value)), size === 0 && keys.length === 0 && protoProps === @undefined)
        return `${prefix}{}`;
      braces = [`${prefix}{`, "}"];
    } else if (isTypedArray(value)) {
      keys = getOwnNonIndexProperties(value, filter);
      let bound = value, fallback = "";
      if (constructor === null)
        fallback = TypedArrayPrototypeGetSymbolToStringTag(value), bound = new primordials[fallback](value);
      let size = TypedArrayPrototypeGetLength(value);
      if (braces = [`${getPrefix(constructor, tag, fallback, `(${size})`)}[`, "]"], value.length === 0 && keys.length === 0 && !ctx.showHidden)
        return `${braces[0]}]`;
      formatter = FunctionPrototypeBind(formatTypedArray, null, bound, size), extrasType = kArrayExtrasType;
    } else if (isMapIterator(value))
      keys = getKeys(value, ctx.showHidden), braces = getIteratorBraces("Map", tag), formatter = FunctionPrototypeBind(formatIterator, null, braces);
    else if (isSetIterator(value))
      keys = getKeys(value, ctx.showHidden), braces = getIteratorBraces("Set", tag), formatter = FunctionPrototypeBind(formatIterator, null, braces);
    else
      noIterator = !0;
  if (noIterator)
    if (keys = getKeys(value, ctx.showHidden), braces = ["{", "}"], typeof value === "function") {
      if (base = getFunctionBase(ctx, value, constructor, tag), keys.length === 0 && protoProps === @undefined)
        return ctx.stylize(base, "special");
    } else if (constructor === "Object") {
      if (isArgumentsObject(value))
        braces[0] = "[Arguments] {";
      else if (tag !== "")
        braces[0] = `${getPrefix(constructor, tag, "Object")}{`;
      if (keys.length === 0 && protoProps === @undefined)
        return `${braces[0]}}`;
    } else if (isRegExp(value)) {
      base = RegExpPrototypeToString(constructor !== null ? value : new @RegExp(value));
      let prefix = getPrefix(constructor, tag, "RegExp");
      if (prefix !== "RegExp ")
        base = `${prefix}${base}`;
      if (keys.length === 0 && protoProps === @undefined || recurseTimes > ctx.depth && ctx.depth !== null)
        return ctx.stylize(base, "regexp");
    } else if (isDate(value)) {
      base = NumberIsNaN(DatePrototypeGetTime(value)) ? DatePrototypeToString(value) : DatePrototypeToISOString(value);
      let prefix = getPrefix(constructor, tag, "Date");
      if (prefix !== "Date ")
        base = `${prefix}${base}`;
      if (keys.length === 0 && protoProps === @undefined)
        return ctx.stylize(base, "date");
    } else if (value instanceof Error) {
      if (base = formatError(value, constructor, tag, ctx, keys), keys.length === 0 && protoProps === @undefined)
        return base;
    } else if (isAnyArrayBuffer(value)) {
      let arrayType = isArrayBuffer(value) ? "ArrayBuffer" : "SharedArrayBuffer", prefix = getPrefix(constructor, tag, arrayType);
      if (typedArray === @undefined)
        formatter = formatArrayBuffer;
      else if (keys.length === 0 && protoProps === @undefined)
        return prefix + `{ byteLength: ${formatNumber(ctx.stylize, value.byteLength, !1)} }`;
      braces[0] = `${prefix}{`, ArrayPrototypeUnshift(keys, "byteLength");
    } else if (isDataView(value))
      braces[0] = `${getPrefix(constructor, tag, "DataView")}{`, ArrayPrototypeUnshift(keys, "byteLength", "byteOffset", "buffer");
    else if (isPromise(value))
      braces[0] = `${getPrefix(constructor, tag, "Promise")}{`, formatter = formatPromise;
    else if (isWeakSet(value))
      braces[0] = `${getPrefix(constructor, tag, "WeakSet")}{`, formatter = ctx.showHidden ? formatWeakSet : formatWeakCollection;
    else if (isWeakMap(value))
      braces[0] = `${getPrefix(constructor, tag, "WeakMap")}{`, formatter = ctx.showHidden ? formatWeakMap : formatWeakCollection;
    else if (isModuleNamespaceObject(value))
      braces[0] = `${getPrefix(constructor, tag, "Module")}{`, formatter = formatNamespaceObject.bind(null, keys);
    else if (isBoxedPrimitive(value)) {
      if (base = getBoxedBase(value, ctx, keys, constructor, tag), keys.length === 0 && protoProps === @undefined)
        return base;
    } else if (isURL(value) && !(recurseTimes > ctx.depth && ctx.depth !== null)) {
      if (base = value.href, keys.length === 0 && protoProps === @undefined)
        return base;
    } else {
      if (keys.length === 0 && protoProps === @undefined) {
        if (isExternal(value))
          return ctx.stylize("[External: 0]", "special");
        return `${getCtxStyle(value, constructor, tag)}{}`;
      }
      braces[0] = `${getCtxStyle(value, constructor, tag)}{`;
    }
  if (recurseTimes > ctx.depth && ctx.depth !== null) {
    let constructorName = StringPrototypeSlice(getCtxStyle(value, constructor, tag), 0, -1);
    if (constructor !== null)
      constructorName = `[${constructorName}]`;
    return ctx.stylize(constructorName, "special");
  }
  recurseTimes += 1, ctx.seen.push(value), ctx.currentDepth = recurseTimes;
  let output, indentationLvl = ctx.indentationLvl;
  try {
    if (ctx.currentDepth > 1000)
      @throwRangeError(ERROR_STACK_OVERFLOW_MSG);
    output = formatter(ctx, value, recurseTimes);
    for (i = 0;i < keys.length; i++)
      ArrayPrototypePush.@call(output, formatProperty(ctx, value, recurseTimes, keys[i], extrasType));
    if (protoProps !== @undefined)
      ArrayPrototypePush.@apply(output, protoProps);
  } catch (err) {
    if (err instanceof RangeError && err.message === ERROR_STACK_OVERFLOW_MSG) {
      let constructorName = StringPrototypeSlice(getCtxStyle(value, constructor, tag), 0, -1);
      return ctx.seen.pop(), ctx.indentationLvl = indentationLvl, ctx.stylize(`[${constructorName}: Inspection interrupted prematurely. Maximum call stack size exceeded.]`, "special");
    }
    throw new AssertionError("handleMaxCallStackSize assertion failed: " + @String(err), !0);
  }
  if (ctx.circular !== @undefined) {
    let index = ctx.circular.get(value);
    if (index !== @undefined)
      if (ctx.seenRefs ??= /* @__PURE__ */ new Set, !ctx.seenRefs.has(index)) {
        ctx.seenRefs.add(index);
        let reference = ctx.stylize(`<ref *${index}>`, "special");
        if (ctx.compact !== !0)
          base = base === "" ? reference : `${reference} ${base}`;
        else
          braces[0] = `${reference} ${braces[0]}`;
      } else {
        //! this is a non-standard behavior compared to Node's implementation
        return ctx.stylize(`[Circular *${index}]`, "special");
      }
  }
  if (ctx.seen.pop(), ctx.sorted) {
    let comparator = ctx.sorted === !0 ? @undefined : ctx.sorted;
    if (extrasType === kObjectType)
      ArrayPrototypeSort(output, comparator);
    else if (keys.length > 1) {
      let sorted = ArrayPrototypeSort(ArrayPrototypeSlice(output, output.length - keys.length), comparator);
      ArrayPrototypeUnshift(sorted, output, output.length - keys.length, keys.length), ArrayPrototypeSplice.@apply(null, sorted);
    }
  }
  let res = reduceToSingleString(ctx, output, base, braces, extrasType, recurseTimes, value), newLength = (ctx.budget[ctx.indentationLvl] || 0) + res.length;
  if (ctx.budget[ctx.indentationLvl] = newLength, newLength > 134217728)
    ctx.depth = -1;
  return res;
}
function getIteratorBraces(type, tag) {
  if (tag !== `${type} Iterator`) {
    if (tag !== "")
      tag += "] [";
    tag += `${type} Iterator`;
  }
  return [`[${tag}] {`, "}"];
}
function getBoxedBase(value, ctx, keys, constructor, tag) {
  let fn, type;
  if (isNumberObject(value))
    fn = NumberPrototypeValueOf, type = "Number";
  else if (isStringObject(value))
    fn = StringPrototypeValueOf, type = "String", keys.splice(0, value.length);
  else if (isBooleanObject(value))
    fn = BooleanPrototypeValueOf, type = "Boolean";
  else if (isBigIntObject(value))
    fn = BigIntPrototypeValueOf, type = "BigInt";
  else
    fn = SymbolPrototypeValueOf, type = "Symbol";
  let base = `[${type}`;
  if (type !== constructor)
    if (constructor === null)
      base += " (null prototype)";
    else
      base += ` (${constructor})`;
  if (base += `: ${formatPrimitive(stylizeNoColor, fn(value), ctx)}]`, tag !== "" && tag !== constructor)
    base += ` [${tag}]`;
  if (keys.length !== 0 || ctx.stylize === stylizeNoColor)
    return base;
  return ctx.stylize(base, StringPrototypeToLowerCase(type));
}
function getClassBase(value, constructor, tag) {
  let base = `class ${ObjectPrototypeHasOwnProperty(value, "name") && value.name || "(anonymous)"}`;
  if (constructor !== "Function" && constructor !== null)
    base += ` [${constructor}]`;
  if (tag !== "" && constructor !== tag)
    base += ` [${tag}]`;
  if (constructor !== null) {
    let superName = ObjectGetPrototypeOf(value).name;
    if (superName)
      base += ` extends ${superName}`;
  } else
    base += " extends [null prototype]";
  return `[${base}]`;
}
function getFunctionBase(ctx, value, constructor, tag) {
  let stringified = FunctionPrototypeToString(value);
  if (StringPrototypeStartsWith(stringified, "class") && stringified[stringified.length - 1] === "}") {
    let slice = StringPrototypeSlice(stringified, 5, -1), bracketIndex = StringPrototypeIndexOf(slice, "{");
    if (bracketIndex !== -1 && (!StringPrototypeIncludes(StringPrototypeSlice(slice, 0, bracketIndex), "(") || RegExpPrototypeExec(classRegExp, RegExpPrototypeSymbolReplace(stripCommentsRegExp, slice)) !== null))
      return getClassBase(value, constructor, tag);
  }
  let type = "Function";
  if (isGeneratorFunction(value))
    type = `Generator${type}`;
  if (isAsyncFunction(value))
    type = `Async${type}`;
  let base = `[${type}`;
  if (constructor === null)
    base += " (null prototype)";
  if (value.name === "")
    base += " (anonymous)";
  else
    base += `: ${typeof value.name === "string" ? value.name : formatValue(ctx, value.name)}`;
  if (base += "]", constructor !== type && constructor !== null)
    base += ` ${constructor}`;
  if (tag !== "" && constructor !== tag)
    base += ` [${tag}]`;
  return base;
}
function identicalSequenceRange(a, b) {
  for (let i = 0;i < a.length - 3; i++) {
    let pos = ArrayPrototypeIndexOf.@call(b, a[i]);
    if (pos !== -1) {
      let rest = b.length - pos;
      if (rest > 3) {
        let len = 1, maxLen = @min(a.length - i, rest);
        while (maxLen > len && a[i + len] === b[pos + len])
          len++;
        if (len > 3)
          return { len, offset: i };
      }
    }
  }
  return { len: 0, offset: 0 };
}
function getStackString(error) {
  return error.stack ? @String(error.stack) : ErrorPrototypeToString(error);
}
function getStackFrames(ctx, err, stack) {
  let frames = StringPrototypeSplit(stack, `
`), cause;
  try {
    ({ cause } = err);
  } catch {}
  if (cause != null && cause instanceof Error) {
    let causeStack = getStackString(cause), causeStackStart = StringPrototypeIndexOf(causeStack, `
    at`);
    if (causeStackStart !== -1) {
      let causeFrames = StringPrototypeSplit(StringPrototypeSlice(causeStack, causeStackStart + 1), `
`), { len, offset } = identicalSequenceRange(frames, causeFrames);
      if (len > 0) {
        let skipped = len - 2, msg = `    ... ${skipped} lines matching cause stack trace ...`;
        frames.splice(offset + 1, skipped, ctx.stylize(msg, "undefined"));
      }
    }
  }
  return frames;
}
function improveStack(stack, constructor, name, tag) {
  let len = name.length;
  if (constructor === null || StringPrototypeEndsWith(name, "Error") && StringPrototypeStartsWith(stack, name) && (stack.length === len || stack[len] === ":" || stack[len] === `
`)) {
    let fallback = "Error";
    if (constructor === null)
      fallback = (RegExpPrototypeExec(/^([A-Z][a-z_ A-Z0-9[\]()-]+)(?::|\n {4}at)/, stack) || RegExpPrototypeExec(/^([a-z_A-Z0-9-]*Error)$/, stack))?.[1] || "", len = fallback.length, fallback ||= "Error";
    let prefix = StringPrototypeSlice(getPrefix(constructor, tag, fallback), 0, -1);
    if (name !== prefix)
      if (StringPrototypeIncludes(prefix, name))
        if (len === 0)
          stack = `${prefix}: ${stack}`;
        else
          stack = `${prefix}${StringPrototypeSlice(stack, len)}`;
      else
        stack = `${prefix} [${name}]${StringPrototypeSlice(stack, len)}`;
  }
  return stack;
}
function removeDuplicateErrorKeys(ctx, keys, err, stack) {
  if (!ctx.showHidden && keys.length !== 0)
    for (let name of ["name", "message", "stack"]) {
      let index = ArrayPrototypeIndexOf(keys, name);
      if (index !== -1 && StringPrototypeIncludes(stack, err[name]))
        ArrayPrototypeSplice(keys, index, 1);
    }
}
function markNodeModules(ctx, line) {
  let tempLine = "", nodeModule, pos = 0;
  while ((nodeModule = nodeModulesRegExp.exec(line)) !== null)
    tempLine += StringPrototypeSlice(line, pos, nodeModule.index + 14), tempLine += ctx.stylize(nodeModule[1], "module"), pos = nodeModule.index + nodeModule[0].length;
  if (pos !== 0)
    line = tempLine + StringPrototypeSlice(line, pos);
  return line;
}
function markCwd(ctx, line, workingDirectory) {
  let cwdStartPos = StringPrototypeIndexOf(line, workingDirectory), tempLine = "", cwdLength = workingDirectory.length;
  if (cwdStartPos !== -1) {
    if (StringPrototypeSlice(line, cwdStartPos - 7, cwdStartPos) === "file://")
      cwdLength += 7, cwdStartPos -= 7;
    let start = line[cwdStartPos - 1] === "(" ? cwdStartPos - 1 : cwdStartPos, end = start !== cwdStartPos && StringPrototypeEndsWith(line, ")") ? -1 : line.length, workingDirectoryEndPos = cwdStartPos + cwdLength + 1, cwdSlice = StringPrototypeSlice(line, start, workingDirectoryEndPos);
    if (tempLine += StringPrototypeSlice(line, 0, start), tempLine += ctx.stylize(cwdSlice, "undefined"), tempLine += StringPrototypeSlice(line, workingDirectoryEndPos, end), end === -1)
      tempLine += ctx.stylize(")", "undefined");
  } else
    tempLine += line;
  return tempLine;
}
function safeGetCWD() {
  let workingDirectory;
  try {
    workingDirectory = process.cwd();
  } catch {
    return;
  }
  return workingDirectory;
}
function formatError(err, constructor, tag, ctx, keys) {
  let name = err.name != null ? @String(err.name) : "Error", stack = getStackString(err);
  //! temp fix for Bun losing the error name from inherited errors + extraneous ": " with no message
  if (stack = stack.replace(/^Error: /, `${name}${err.message ? ": " : ""}`), removeDuplicateErrorKeys(ctx, keys, err, stack), "cause" in err && (keys.length === 0 || !ArrayPrototypeIncludes(keys, "cause")))
    ArrayPrototypePush.@call(keys, "cause");
  if (@isJSArray(err.errors) && (keys.length === 0 || !ArrayPrototypeIncludes(keys, "errors")))
    ArrayPrototypePush.@call(keys, "errors");
  stack = improveStack(stack, constructor, name, tag);
  let pos = err.message && StringPrototypeIndexOf(stack, err.message) || -1;
  if (pos !== -1)
    pos += err.message.length;
  let stackStart = StringPrototypeIndexOf(stack, `
    at`, pos);
  if (stackStart === -1)
    stack = `[${stack}]`;
  else {
    let newStack = StringPrototypeSlice(stack, 0, stackStart), stackFramePart = StringPrototypeSlice(stack, stackStart + 1), lines = getStackFrames(ctx, err, stackFramePart);
    if (ctx.colors) {
      let workingDirectory = safeGetCWD(), esmWorkingDirectory;
      for (let line of lines) {
        let core = RegExpPrototypeExec(coreModuleRegExp, line);
        if (core !== null && (StringPrototypeStartsWith(core[1], "internal/") || ArrayPrototypeIncludes((@getInternalField(@internalModuleRegistry, 147) || @createInternalModuleById(147)).builtinModules, core[1])))
          newStack += `
${ctx.stylize(line, "undefined")}`;
        else {
          if (newStack += `
`, line = markNodeModules(ctx, line), workingDirectory !== @undefined) {
            let newLine = markCwd(ctx, line, workingDirectory);
            if (newLine === line)
              esmWorkingDirectory ??= pathToFileURL(workingDirectory).href, newLine = markCwd(ctx, line, esmWorkingDirectory);
            line = newLine;
          }
          newStack += line;
        }
      }
    } else
      newStack += `
${ArrayPrototypeJoin(lines, `
`)}`;
    stack = newStack;
  }
  if (ctx.indentationLvl !== 0) {
    let indentation = StringPrototypeRepeat(" ", ctx.indentationLvl);
    stack = StringPrototypeReplaceAll(stack, `
`, `
${indentation}`);
  }
  return stack;
}
function groupArrayElements(ctx, output, value) {
  let totalLength = 0, maxLength = 0, i = 0, outputLength = output.length;
  if (ctx.maxArrayLength < output.length)
    outputLength--;
  let separatorSpace = 2, dataLen = new @Array(outputLength);
  for (;i < outputLength; i++) {
    let len = getStringWidth(output[i], ctx.colors);
    if (dataLen[i] = len, totalLength += len + separatorSpace, maxLength < len)
      maxLength = len;
  }
  let actualMax = maxLength + separatorSpace;
  if (actualMax * 3 + ctx.indentationLvl < ctx.breakLength && (totalLength / actualMax > 5 || maxLength <= 6)) {
    let averageBias = MathSqrt(actualMax - totalLength / output.length), biasedMax = MathMax(actualMax - 3 - averageBias, 1), columns = @min(MathRound(MathSqrt(2.5 * biasedMax * outputLength) / biasedMax), MathFloor((ctx.breakLength - ctx.indentationLvl) / actualMax), ctx.compact * 4, 15);
    if (columns <= 1)
      return output;
    let tmp = [], maxLineLength = [];
    for (let i2 = 0;i2 < columns; i2++) {
      let lineMaxLength = 0;
      for (let j = i2;j < output.length; j += columns)
        if (dataLen[j] > lineMaxLength)
          lineMaxLength = dataLen[j];
      lineMaxLength += separatorSpace, maxLineLength[i2] = lineMaxLength;
    }
    let order = StringPrototypePadStart;
    if (value !== @undefined) {
      for (let i2 = 0;i2 < output.length; i2++)
        if (typeof value[i2] !== "number" && typeof value[i2] !== "bigint") {
          order = StringPrototypePadEnd;
          break;
        }
    }
    for (let i2 = 0;i2 < outputLength; i2 += columns) {
      let max = @min(i2 + columns, outputLength), str = "", j = i2;
      for (;j < max - 1; j++) {
        let padding = maxLineLength[j - i2] + output[j].length - dataLen[j];
        str += order(`${output[j]}, `, padding, " ");
      }
      if (order === StringPrototypePadStart) {
        let padding = maxLineLength[j - i2] + output[j].length - dataLen[j] - separatorSpace;
        str += StringPrototypePadStart(output[j], padding, " ");
      } else
        str += output[j];
      ArrayPrototypePush.@call(tmp, str);
    }
    if (ctx.maxArrayLength < output.length)
      ArrayPrototypePush.@call(tmp, output[outputLength]);
    output = tmp;
  }
  return output;
}
function addNumericSeparator(integerString) {
  let result = "", i = integerString.length, start = integerString[0] === "-" ? 1 : 0;
  for (;i >= start + 4; i -= 3)
    result = `_${StringPrototypeSlice(integerString, i - 3, i)}${result}`;
  return i === integerString.length ? integerString : `${StringPrototypeSlice(integerString, 0, i)}${result}`;
}
function addNumericSeparatorEnd(integerString) {
  let result = "", i = 0;
  for (;i < integerString.length - 3; i += 3)
    result += `${StringPrototypeSlice(integerString, i, i + 3)}_`;
  return i === 0 ? integerString : `${result}${StringPrototypeSlice(integerString, i)}`;
}
var remainingText = (remaining) => `... ${remaining} more item${remaining > 1 ? "s" : ""}`;
function formatNumber(fn, number, numericSeparator) {
  if (!numericSeparator) {
    if (ObjectIs(number, -0))
      return fn("-0", "number");
    return fn(`${number}`, "number");
  }
  let integer = MathTrunc(number), string = @String(integer);
  if (integer === number) {
    if (!NumberIsFinite(number) || StringPrototypeIncludes(string, "e"))
      return fn(string, "number");
    return fn(`${addNumericSeparator(string)}`, "number");
  }
  if (NumberIsNaN(number))
    return fn(string, "number");
  return fn(`${addNumericSeparator(string)}.${addNumericSeparatorEnd(StringPrototypeSlice(@String(number), string.length + 1))}`, "number");
}
function formatBigInt(fn, bigint, numericSeparator) {
  let string = @String(bigint);
  if (!numericSeparator)
    return fn(`${string}n`, "bigint");
  return fn(`${addNumericSeparator(string)}n`, "bigint");
}
function formatPrimitive(fn, value, ctx) {
  if (typeof value === "string") {
    let trailer = "";
    if (value.length > ctx.maxStringLength) {
      let remaining = value.length - ctx.maxStringLength;
      value = StringPrototypeSlice(value, 0, ctx.maxStringLength), trailer = `... ${remaining} more character${remaining > 1 ? "s" : ""}`;
    }
    if (ctx.compact !== !0 && value.length > kMinLineLength && value.length > ctx.breakLength - ctx.indentationLvl - 4)
      return ArrayPrototypeJoin(ArrayPrototypeMap(extractedSplitNewLines(value), (line) => fn(strEscape(line), "string")), ` +
${StringPrototypeRepeat(" ", ctx.indentationLvl + 2)}`) + trailer;
    return fn(strEscape(value), "string") + trailer;
  }
  if (typeof value === "number")
    return formatNumber(fn, value, ctx.numericSeparator);
  if (typeof value === "bigint")
    return formatBigInt(fn, value, ctx.numericSeparator);
  if (typeof value === "boolean")
    return fn(`${value}`, "boolean");
  if (typeof value > "u")
    return fn("undefined", "undefined");
  return fn(SymbolPrototypeToString(value), "symbol");
}
function formatNamespaceObject(keys, ctx, value, recurseTimes) {
  let output = new @Array(keys.length);
  for (let i = 0;i < keys.length; i++)
    try {
      output[i] = formatProperty(ctx, value, recurseTimes, keys[i], kObjectType);
    } catch (err) {
      assert(isNativeError(err) && err.name === "ReferenceError");
      let tmp = { [keys[i]]: "" };
      output[i] = formatProperty(ctx, tmp, recurseTimes, keys[i], kObjectType);
      let pos = StringPrototypeLastIndexOf(output[i], " ");
      output[i] = StringPrototypeSlice(output[i], 0, pos + 1) + ctx.stylize("<uninitialized>", "special");
    }
  return keys.length = 0, output;
}
function formatSpecialArray(ctx, value, recurseTimes, maxLength, output, i) {
  let keys = ObjectKeys(value), index = i;
  for (;i < keys.length && output.length < maxLength; i++) {
    let key = keys[i], tmp = +key;
    if (tmp > 4294967294)
      break;
    if (`${index}` !== key) {
      if (RegExpPrototypeExec(numberRegExp, key) === null)
        break;
      let emptyItems = tmp - index, ending = emptyItems > 1 ? "s" : "", message = `<${emptyItems} empty item${ending}>`;
      if (ArrayPrototypePush.@call(output, ctx.stylize(message, "undefined")), index = tmp, output.length === maxLength)
        break;
    }
    ArrayPrototypePush.@call(output, formatProperty(ctx, value, recurseTimes, key, kArrayType)), index++;
  }
  let remaining = value.length - index;
  if (output.length !== maxLength) {
    if (remaining > 0) {
      let ending = remaining > 1 ? "s" : "", message = `<${remaining} empty item${ending}>`;
      ArrayPrototypePush.@call(output, ctx.stylize(message, "undefined"));
    }
  } else if (remaining > 0)
    ArrayPrototypePush.@call(output, remainingText(remaining));
  return output;
}
function hexSlice(buf, start = 0, end) {
  return ArrayPrototypeJoin(ArrayPrototypeMap(buf.slice(start, end), (x) => ("00" + x.toString(16)).slice(-2)), "");
}
function formatArrayBuffer(ctx, value) {
  let buffer;
  try {
    buffer = new @Uint8Array(value);
  } catch {
    return [ctx.stylize("(detached)", "special")];
  }
  let str = StringPrototypeTrim(RegExpPrototypeSymbolReplace(/(.{2})/g, hexSlice(buffer, 0, @min(ctx.maxArrayLength, buffer.length)), "$1 ")), remaining = buffer.length - ctx.maxArrayLength;
  if (remaining > 0)
    str += ` ... ${remaining} more byte${remaining > 1 ? "s" : ""}`;
  return [`${ctx.stylize("[Uint8Contents]", "special")}: <${str}>`];
}
function formatArray(ctx, value, recurseTimes) {
  let valLen = value.length, len = @min(MathMax(0, ctx.maxArrayLength), valLen), remaining = valLen - len, output = [];
  for (let i = 0;i < len; i++) {
    if (!ObjectPrototypeHasOwnProperty(value, i))
      return formatSpecialArray(ctx, value, recurseTimes, len, output, i);
    ArrayPrototypePush.@call(output, formatProperty(ctx, value, recurseTimes, i, kArrayType));
  }
  if (remaining > 0)
    ArrayPrototypePush.@call(output, remainingText(remaining));
  return output;
}
function formatTypedArray(value, length, ctx, ignored, recurseTimes) {
  if (@Buffer.isBuffer(value)) {
    BufferModule ??= @getInternalField(@internalModuleRegistry, 141) || @createInternalModuleById(141);
    let INSPECT_MAX_BYTES = @requireMap.@get("buffer")?.exports.INSPECT_MAX_BYTES ?? BufferModule.INSPECT_MAX_BYTES;
    ctx.maxArrayLength = @min(ctx.maxArrayLength, INSPECT_MAX_BYTES);
  }
  let maxLength = @min(MathMax(0, ctx.maxArrayLength), length), remaining = value.length - maxLength, output = new @Array(maxLength), elementFormatter = value.length > 0 && typeof value[0] === "number" ? formatNumber : formatBigInt;
  for (let i = 0;i < maxLength; ++i)
    output[i] = elementFormatter(ctx.stylize, value[i], ctx.numericSeparator);
  if (remaining > 0)
    output[maxLength] = remainingText(remaining);
  if (ctx.showHidden) {
    ctx.indentationLvl += 2;
    for (let key of ["BYTES_PER_ELEMENT", "length", "byteLength", "byteOffset", "buffer"]) {
      let str = formatValue(ctx, value[key], recurseTimes, !0);
      ArrayPrototypePush.@call(output, `[${key}]: ${str}`);
    }
    ctx.indentationLvl -= 2;
  }
  return output;
}
function formatSet(value, ctx, ignored, recurseTimes) {
  let length = value.size, maxLength = @min(MathMax(0, ctx.maxArrayLength), length), remaining = length - maxLength, output = [];
  ctx.indentationLvl += 2;
  let i = 0;
  for (let v of value) {
    if (i >= maxLength)
      break;
    ArrayPrototypePush.@call(output, formatValue(ctx, v, recurseTimes)), i++;
  }
  if (remaining > 0)
    ArrayPrototypePush.@call(output, remainingText(remaining));
  return ctx.indentationLvl -= 2, output;
}
function formatMap(value, ctx, ignored, recurseTimes) {
  let length = value.size, maxLength = @min(MathMax(0, ctx.maxArrayLength), length), remaining = length - maxLength, output = [];
  ctx.indentationLvl += 2;
  let i = 0;
  for (let { 0: k, 1: v } of value) {
    if (i >= maxLength)
      break;
    ArrayPrototypePush.@call(output, `${formatValue(ctx, k, recurseTimes)} => ${formatValue(ctx, v, recurseTimes)}`), i++;
  }
  if (remaining > 0)
    ArrayPrototypePush.@call(output, remainingText(remaining));
  return ctx.indentationLvl -= 2, output;
}
function formatSetIterInner(ctx, recurseTimes, entries, state) {
  let maxArrayLength = MathMax(ctx.maxArrayLength, 0), maxLength = @min(maxArrayLength, entries.length), output = new @Array(maxLength);
  ctx.indentationLvl += 2;
  for (let i = 0;i < maxLength; i++)
    output[i] = formatValue(ctx, entries[i], recurseTimes);
  if (ctx.indentationLvl -= 2, state === kWeak && !ctx.sorted)
    ArrayPrototypeSort(output);
  let remaining = entries.length - maxLength;
  if (remaining > 0)
    ArrayPrototypePush.@call(output, remainingText(remaining));
  return output;
}
function formatMapIterInner(ctx, recurseTimes, entries, state) {
  let maxArrayLength = MathMax(ctx.maxArrayLength, 0), len = entries.length / 2, remaining = len - maxArrayLength, maxLength = @min(maxArrayLength, len), output = new @Array(maxLength), i = 0;
  if (ctx.indentationLvl += 2, state === kWeak) {
    for (;i < maxLength; i++) {
      let pos = i * 2;
      output[i] = `${formatValue(ctx, entries[pos], recurseTimes)} => ${formatValue(ctx, entries[pos + 1], recurseTimes)}`;
    }
    if (!ctx.sorted)
      ArrayPrototypeSort(output);
  } else
    for (;i < maxLength; i++) {
      let pos = i * 2, res = [formatValue(ctx, entries[pos], recurseTimes), formatValue(ctx, entries[pos + 1], recurseTimes)];
      output[i] = reduceToSingleString(ctx, res, "", ["[", "]"], kArrayExtrasType, recurseTimes);
    }
  if (ctx.indentationLvl -= 2, remaining > 0)
    ArrayPrototypePush.@call(output, remainingText(remaining));
  return output;
}
function formatWeakCollection(ctx) {
  return [ctx.stylize("<items unknown>", "special")];
}
function formatWeakSet(ctx, value, recurseTimes) {
  let entries = previewEntries(value);
  return formatSetIterInner(ctx, recurseTimes, entries, kWeak);
}
function formatWeakMap(ctx, value, recurseTimes) {
  let entries = previewEntries(value);
  return formatMapIterInner(ctx, recurseTimes, entries, kWeak);
}
function formatIterator(braces, ctx, value, recurseTimes) {
  let { 0: entries, 1: isKeyValue } = previewEntries(value, !0);
  if (isKeyValue)
    return braces[0] = RegExpPrototypeSymbolReplace(/ Iterator] {$/, braces[0], " Entries] {"), formatMapIterInner(ctx, recurseTimes, entries, kMapEntries);
  return formatSetIterInner(ctx, recurseTimes, entries, kIterator);
}
function formatPromise(ctx, value, recurseTimes) {
  let output, { 0: state, 1: result } = getPromiseDetails(value);
  if (state === kPending)
    output = [ctx.stylize("<pending>", "special")];
  else {
    ctx.indentationLvl += 2;
    let str = formatValue(ctx, result, recurseTimes);
    ctx.indentationLvl -= 2, output = [state === kRejected ? `${ctx.stylize("<rejected>", "special")} ${str}` : str];
  }
  return output;
}
function formatProperty(ctx, value, recurseTimes, key, type, desc, original = value) {
  let name, str, extra = " ";
  if (desc ||= ObjectGetOwnPropertyDescriptor(value, key) || { value: value[key], enumerable: !0 }, desc.value !== @undefined) {
    let diff = ctx.compact !== !0 || type !== kObjectType ? 2 : 3;
    if (ctx.indentationLvl += diff, str = formatValue(ctx, desc.value, recurseTimes), diff === 3 && ctx.breakLength < getStringWidth(str, ctx.colors))
      extra = `
${StringPrototypeRepeat(" ", ctx.indentationLvl)}`;
    ctx.indentationLvl -= diff;
  } else if (desc.get !== @undefined) {
    let label = desc.set !== @undefined ? "Getter/Setter" : "Getter", s = ctx.stylize, sp = "special";
    if (ctx.getters && (ctx.getters === !0 || ctx.getters === "get" && desc.set === @undefined || ctx.getters === "set" && desc.set !== @undefined))
      try {
        let tmp = desc.get.@call(original);
        if (ctx.indentationLvl += 2, tmp === null)
          str = `${s(`[${label}:`, "special")} ${s("null", "null")}${s("]", "special")}`;
        else if (typeof tmp === "object")
          str = `${s(`[${label}]`, "special")} ${formatValue(ctx, tmp, recurseTimes)}`;
        else {
          let primitive = formatPrimitive(s, tmp, ctx);
          str = `${s(`[${label}:`, "special")} ${primitive}${s("]", "special")}`;
        }
        ctx.indentationLvl -= 2;
      } catch (err) {
        let message = `<Inspection threw (${err.message})>`;
        str = `${s(`[${label}:`, "special")} ${message}${s("]", "special")}`;
      }
    else
      str = ctx.stylize(`[${label}]`, "special");
  } else if (desc.set !== @undefined)
    str = ctx.stylize("[Setter]", "special");
  else
    str = ctx.stylize("undefined", "undefined");
  if (type === kArrayType)
    return str;
  if (typeof key === "symbol") {
    let tmp = RegExpPrototypeSymbolReplace(strEscapeSequencesReplacer, SymbolPrototypeToString(key), escapeFn);
    name = ctx.stylize(tmp, "symbol");
  } else if (RegExpPrototypeExec(keyStrRegExp, key) !== null)
    name = key === "__proto__" ? "['__proto__']" : ctx.stylize(key, "name");
  else
    name = ctx.stylize(strEscape(key), "string");
  if (desc.enumerable === !1)
    name = `[${name}]`;
  return `${name}:${extra}${str}`;
}
function isBelowBreakLength(ctx, output, start, base) {
  let totalLength = output.length + start;
  if (totalLength + output.length > ctx.breakLength)
    return !1;
  for (let i = 0;i < output.length; i++) {
    if (ctx.colors)
      totalLength += StringPrototypeReplaceAll(output[i], /\u001B\[\d\d?m/g, "").length;
    else
      totalLength += output[i].length;
    if (totalLength > ctx.breakLength)
      return !1;
  }
  return base === "" || !StringPrototypeIncludes(base, `
`);
}
function reduceToSingleString(ctx, output, base, braces, extrasType, recurseTimes, value) {
  if (ctx.compact !== !0) {
    if (typeof ctx.compact === "number" && ctx.compact >= 1) {
      let entries = output.length;
      if (extrasType === kArrayExtrasType && entries > 6)
        output = groupArrayElements(ctx, output, value);
      if (ctx.currentDepth - recurseTimes < ctx.compact && entries === output.length) {
        let start = output.length + ctx.indentationLvl + braces[0].length + base.length + 10;
        if (isBelowBreakLength(ctx, output, start, base)) {
          let joinedOutput = ArrayPrototypeJoin(output, ", ");
          if (!StringPrototypeIncludes(joinedOutput, `
`))
            return `${base ? `${base} ` : ""}${braces[0]} ${joinedOutput} ${braces[1]}`;
        }
      }
    }
    let indentation2 = `
${StringPrototypeRepeat(" ", ctx.indentationLvl)}`;
    return `${base ? `${base} ` : ""}${braces[0]}${indentation2}  ${ArrayPrototypeJoin(output, `,${indentation2}  `)}${indentation2}${braces[1]}`;
  }
  if (isBelowBreakLength(ctx, output, 0, base))
    return `${braces[0]}${base ? ` ${base}` : ""} ${ArrayPrototypeJoin(output, ", ")} ` + braces[1];
  let indentation = StringPrototypeRepeat(" ", ctx.indentationLvl), ln = base === "" && braces[0].length === 1 ? " " : `${base ? ` ${base}` : ""}
${indentation}  `;
  return `${braces[0]}${ln}${ArrayPrototypeJoin(output, `,
${indentation}  `)} ${braces[1]}`;
}
function hasBuiltInToString(value) {
  let proxyTarget = getProxyDetails(value, !1);
  if (proxyTarget !== @undefined) {
    if (proxyTarget === null)
      return !0;
    value = proxyTarget;
  }
  if (typeof value[Symbol.toPrimitive] === "function")
    return !1;
  if (typeof value.toString !== "function")
    return !0;
  if (ObjectPrototypeHasOwnProperty(value, "toString"))
    return !1;
  let pointer = value;
  do
    pointer = ObjectGetPrototypeOf(pointer);
  while (!ObjectPrototypeHasOwnProperty(pointer, "toString"));
  let descriptor = ObjectGetOwnPropertyDescriptor(pointer, "constructor");
  return descriptor !== @undefined && typeof descriptor.value === "function" && builtInObjects.has(descriptor.value.name);
}
var firstErrorLine = (error) => StringPrototypeSplit(error.message, `
`, 1)[0], CIRCULAR_ERROR_MESSAGE;
function tryStringify(arg) {
  try {
    return JSONStringify(arg);
  } catch (err) {
    if (!CIRCULAR_ERROR_MESSAGE)
      try {
        let a = {};
        a.a = a, JSONStringify(a);
      } catch (circularError) {
        CIRCULAR_ERROR_MESSAGE = firstErrorLine(circularError);
      }
    if (err.name === "TypeError" && firstErrorLine(err) === CIRCULAR_ERROR_MESSAGE)
      return "[Circular]";
    throw err;
  }
}
function format(...args) {
  return formatWithOptionsInternal(@undefined, args);
}
function formatWithOptions(inspectOptions, ...args) {
  return validateObject(inspectOptions, "inspectOptions", { allowArray: !0 }), formatWithOptionsInternal(inspectOptions, args);
}
function formatNumberNoColor(number, options) {
  return formatNumber(stylizeNoColor, number, options?.numericSeparator ?? inspectDefaultOptions.numericSeparator);
}
function formatBigIntNoColor(bigint, options) {
  return formatBigInt(stylizeNoColor, bigint, options?.numericSeparator ?? inspectDefaultOptions.numericSeparator);
}
function formatWithOptionsInternal(inspectOptions, args) {
  let first = args[0], a = 0, str = "", join = "";
  if (typeof first === "string") {
    if (args.length === 1)
      return first;
    let tempStr, lastPos = 0;
    for (let i = 0;i < first.length - 1; i++)
      if (StringPrototypeCharCodeAt(first, i) === 37) {
        let nextChar = StringPrototypeCharCodeAt(first, ++i);
        if (a + 1 !== args.length) {
          switch (nextChar) {
            case 115: {
              let tempArg = args[++a];
              if (typeof tempArg === "number")
                tempStr = formatNumberNoColor(tempArg, inspectOptions);
              else if (typeof tempArg === "bigint")
                tempStr = formatBigIntNoColor(tempArg, inspectOptions);
              else if (typeof tempArg !== "object" || tempArg === null || !hasBuiltInToString(tempArg))
                tempStr = @String(tempArg);
              else
                tempStr = inspect(tempArg, {
                  ...inspectOptions,
                  compact: 3,
                  colors: !1,
                  depth: 0
                });
              break;
            }
            case 106:
              tempStr = tryStringify(args[++a]);
              break;
            case 100: {
              let tempNum = args[++a];
              if (typeof tempNum === "bigint")
                tempStr = formatBigIntNoColor(tempNum, inspectOptions);
              else if (typeof tempNum === "symbol")
                tempStr = "NaN";
              else
                tempStr = formatNumberNoColor(Number(tempNum), inspectOptions);
              break;
            }
            case 79:
              tempStr = inspect(args[++a], inspectOptions);
              break;
            case 111:
              tempStr = inspect(args[++a], {
                ...inspectOptions,
                showHidden: !0,
                showProxy: !0,
                depth: 4
              });
              break;
            case 105: {
              let tempInteger = args[++a];
              if (typeof tempInteger === "bigint")
                tempStr = formatBigIntNoColor(tempInteger, inspectOptions);
              else if (typeof tempInteger === "symbol")
                tempStr = "NaN";
              else
                tempStr = formatNumberNoColor(NumberParseInt(tempInteger), inspectOptions);
              break;
            }
            case 102: {
              let tempFloat = args[++a];
              if (typeof tempFloat === "symbol")
                tempStr = "NaN";
              else
                tempStr = formatNumberNoColor(NumberParseFloat(tempFloat), inspectOptions);
              break;
            }
            case 99:
              a += 1, tempStr = "";
              break;
            case 37:
              str += StringPrototypeSlice(first, lastPos, i), lastPos = i + 1;
              continue;
            default:
              continue;
          }
          if (lastPos !== i - 1)
            str += StringPrototypeSlice(first, lastPos, i - 1);
          str += tempStr, lastPos = i + 1;
        } else if (nextChar === 37)
          str += StringPrototypeSlice(first, lastPos, i), lastPos = i + 1;
      }
    if (lastPos !== 0) {
      if (a++, join = " ", lastPos < first.length)
        str += StringPrototypeSlice(first, lastPos);
    }
  }
  while (a < args.length) {
    let value = args[a];
    str += join, str += typeof value !== "string" ? inspect(value, inspectOptions) : value, join = " ", a++;
  }
  return str;
}
var stripANSI = Bun.stripANSI, internalGetStringWidth = @lazy(20);
function getStringWidth(str, removeControlChars = !0) {
  if (removeControlChars)
    str = stripVTControlCharacters(str);
  return str = StringPrototypeNormalize(str, "NFC"), internalGetStringWidth(str);
}
function stripVTControlCharacters(str) {
  if (typeof str !== "string")
    throw new codes.ERR_INVALID_ARG_TYPE("str", "string", str);
  return stripANSI(str);
}
function getOwnNonIndexProperties(a, filter = 2) {
  let desc = ObjectGetOwnPropertyDescriptors(a), ret = [];
  for (let [k, v] of ObjectEntries(desc))
    if (!RegExpPrototypeTest(/^(0|[1-9][0-9]*)$/, k) || NumberParseInt(k, 10) >= 4294967295)
      if (filter === 2 && !v.enumerable)
        continue;
      else
        ArrayPrototypePush.@call(ret, k);
  for (let s of ObjectGetOwnPropertySymbols(a)) {
    let v = ObjectGetOwnPropertyDescriptor(a, s);
    if (filter === 2 && !v.enumerable)
      continue;
    ArrayPrototypePush.@call(ret, s);
  }
  return ret;
}
function getPromiseDetails(promise) {
  let state = @getPromiseInternalField(promise, @promiseFieldFlags) & @promiseStateMask;
  if (state !== @promiseStatePending)
    return [
      state === @promiseStateRejected ? kRejected : kFulfilled,
      @getPromiseInternalField(promise, @promiseFieldReactionsOrResult)
    ];
  return [kPending, @undefined];
}
function getProxyDetails(proxy, withHandler = !0) {
  if (!@isProxyObject(proxy))
    return @undefined;
  let handler = @getProxyInternalField(proxy, @proxyFieldHandler), target = handler === null ? null : @getProxyInternalField(proxy, @proxyFieldTarget);
  if (withHandler)
    return [target, handler];
  else
    return target;
}
function previewEntries(val, isIterator = !1) {
  if (isIterator) {
    let iteratedObject = @getInternalField(val, 1), kind = @getInternalField(val, 3), isEntries = kind === 2;
    if (@isMap(iteratedObject))
      if (isEntries)
        return [ArrayPrototypeFlat(ArrayFrom(iteratedObject)), !0];
      else if (kind === 1)
        return [ArrayFrom(MapPrototypeValues(iteratedObject)), !1];
      else
        return [ArrayFrom(MapPrototypeKeys(iteratedObject)), !1];
    else if (@isSet(iteratedObject))
      if (isEntries)
        return [ArrayPrototypeFlat(ArrayFrom(SetPrototypeEntries(iteratedObject))), !0];
      else
        return [ArrayFrom(iteratedObject), !1];
    else
      throw Error("previewEntries(): Invalid iterator received");
  }
  if (isWeakMap(val))
    return [];
  if (isWeakSet(val))
    return [];
  else
    throw Error("previewEntries(): Invalid object received");
}
function internalGetConstructorName(val) {
  if (!val || typeof val !== "object")
    throw Error("Invalid object");
  if (val.constructor?.name)
    return val.constructor.name;
  let str = ObjectPrototypeToString(val), m = StringPrototypeMatch(str, /^\[object ([^\]]+)\]/);
  return m ? m[1] : "Object";
}
$ = {
  inspect,
  format,
  formatWithOptions,
  stripVTControlCharacters
};
//! non-standard properties, should these be kept? (not currently exposed)
return $})

