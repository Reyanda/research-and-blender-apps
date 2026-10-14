(function (){"use strict";// build/release/tmp_modules/internal/primordials.ts
var $, ObjectSetPrototypeOf = Object.setPrototypeOf, ObjectFreeze = Object.freeze, createSafeIterator = (factory, next_) => {
  class SafeIterator {
    constructor(iterable) {
      this._iterator = factory(iterable);
    }
    next() {
      return next_(this._iterator);
    }
    [Symbol.iterator]() {
      return this;
    }
  }
  return ObjectSetPrototypeOf(SafeIterator.prototype, null), ObjectFreeze(SafeIterator.prototype), ObjectFreeze(SafeIterator), SafeIterator;
}, FunctionPrototypeCall = @getByIdDirect(Function.prototype, "call");
function getGetter(cls, getter) {
  return FunctionPrototypeCall.bind(cls.prototype.__lookupGetter__(getter));
}
function uncurryThis(func) {
  return FunctionPrototypeCall.bind(func);
}
var copyProps = (src, dest) => {
  ArrayPrototypeForEach(Reflect.ownKeys(src), (key) => {
    if (!Reflect.getOwnPropertyDescriptor(dest, key))
      Reflect.defineProperty(dest, key, Reflect.getOwnPropertyDescriptor(src, key));
  });
}, makeSafe = (unsafe, safe) => {
  if (Symbol.iterator in unsafe.prototype) {
    let dummy = new unsafe, next;
    ArrayPrototypeForEach(Reflect.ownKeys(unsafe.prototype), (key) => {
      if (!Reflect.getOwnPropertyDescriptor(safe.prototype, key)) {
        let desc = Reflect.getOwnPropertyDescriptor(unsafe.prototype, key);
        if (typeof desc.value === "function" && desc.value.length === 0) {
          let called = desc.value.@call(dummy) || {};
          if (Symbol.iterator in (typeof called === "object" ? called : {})) {
            let createIterator = uncurryThis(desc.value);
            next ??= uncurryThis(createIterator(dummy).next);
            let SafeIterator = createSafeIterator(createIterator, next);
            desc.value = function() {
              return new SafeIterator(this);
            };
          }
        }
        Reflect.defineProperty(safe.prototype, key, desc);
      }
    });
  } else
    copyProps(unsafe.prototype, safe.prototype);
  return copyProps(unsafe, safe), Object.setPrototypeOf(safe.prototype, null), Object.freeze(safe.prototype), Object.freeze(safe), safe;
}, StringIterator = uncurryThis(@String.prototype[Symbol.iterator]), StringIteratorPrototype = Reflect.getPrototypeOf(StringIterator("")), ArrayPrototypeForEach = uncurryThis(@Array.prototype.forEach), ArrayPrototypeSymbolIterator = uncurryThis(@Array.prototype[Symbol.iterator]), ArrayIteratorPrototypeNext = uncurryThis(@Array.prototype[Symbol.iterator]().next), SafeArrayIterator = createSafeIterator(ArrayPrototypeSymbolIterator, ArrayIteratorPrototypeNext), ArrayPrototypeMap = @Array.prototype.map, PromisePrototypeThen = @Promise.prototype.@then, arrayToSafePromiseIterable = (promises, mapFn) => new SafeArrayIterator(ArrayPrototypeMap.@call(promises, (promise, i) => new @Promise((a, b) => PromisePrototypeThen.@call(mapFn == null ? promise : mapFn(promise, i), a, b)))), PromiseAll = @Promise.all, PromiseResolve = @Promise.@resolve.bind(@Promise), SafePromiseAll = (promises, mapFn) => PromiseAll(arrayToSafePromiseIterable(promises, mapFn)), SafePromiseAllReturnArrayLike = (promises, mapFn) => new @Promise((resolve, reject) => {
  let { length } = promises, returnVal = @Array(length);
  if (ObjectSetPrototypeOf(returnVal, null), length === 0)
    resolve(returnVal);
  let pendingPromises = length;
  for (let i = 0;i < length; i++) {
    let promise = mapFn != null ? mapFn(promises[i], i) : promises[i];
    PromisePrototypeThen.@call(PromiseResolve(promise), (result) => {
      if (returnVal[i] = result, --pendingPromises === 0)
        resolve(returnVal);
    }, reject);
  }
});
$ = {
  Array: @Array,
  SafeArrayIterator,
  MapPrototypeGetSize: getGetter(Map, "size"),
  Number,
  Object,
  RegExp: @RegExp,
  SafeStringIterator: createSafeIterator(StringIterator, uncurryThis(StringIteratorPrototype.next)),
  SafeMap: makeSafe(Map, class SafeMap extends Map {
    constructor(i) {
      super(i);
    }
  }),
  SafePromiseAll,
  SafePromiseAllReturnArrayLike,
  SafeSet: makeSafe(Set, class SafeSet extends Set {
    constructor(i) {
      super(i);
    }
  }),
  SafeWeakSet: makeSafe(WeakSet, class SafeWeakSet extends WeakSet {
    constructor(i) {
      super(i);
    }
  }),
  SafeWeakMap: makeSafe(WeakMap, class SafeWeakMap extends WeakMap {
    constructor(i) {
      super(i);
    }
  }),
  SetPrototypeGetSize: getGetter(Set, "size"),
  String: @String,
  TypedArrayPrototypeGetLength: getGetter(@Uint8Array, "length"),
  TypedArrayPrototypeGetSymbolToStringTag: getGetter(@Uint8Array, Symbol.toStringTag),
  Uint8ClampedArray,
  Uint8Array: @Uint8Array,
  Uint16Array,
  Uint32Array,
  Int8Array,
  Int16Array,
  Int32Array,
  Float16Array,
  Float32Array,
  Float64Array,
  BigUint64Array,
  BigInt64Array,
  uncurryThis
};
return $})

