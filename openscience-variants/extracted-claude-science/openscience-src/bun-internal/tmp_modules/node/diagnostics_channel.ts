(function (){"use strict";// build/release/tmp_modules/node/diagnostics_channel.ts
var $, { validateFunction } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), SafeMap = Map, SafeFinalizationRegistry = FinalizationRegistry, ArrayPrototypeAt = @Array.prototype.at, ArrayPrototypeIndexOf = @Array.prototype.indexOf, ArrayPrototypeSplice = @Array.prototype.splice, ObjectGetPrototypeOf = Object.getPrototypeOf, ObjectSetPrototypeOf = Object.setPrototypeOf, SymbolHasInstance = Symbol.hasInstance, PromiseResolve = @Promise.@resolve.bind(@Promise), PromiseReject = @Promise.@reject.bind(@Promise), PromisePrototypeThen = (promise, onFulfilled, onRejected) => promise.then(onFulfilled, onRejected);

class WeakReference extends WeakRef {
  #refs = 0;
  get() {
    return this.deref();
  }
  incRef() {
    return ++this.#refs;
  }
  decRef() {
    return --this.#refs;
  }
}

class WeakRefMap extends SafeMap {
  #finalizers = new SafeFinalizationRegistry((key) => {
    this.delete(key);
  });
  set(key, value) {
    return this.#finalizers.register(value, key), super.set(key, new WeakReference(value));
  }
  get(key) {
    return super.get(key)?.get();
  }
  incRef(key) {
    return super.get(key)?.incRef();
  }
  decRef(key) {
    return super.get(key)?.decRef();
  }
}
function markActive(channel) {
  ObjectSetPrototypeOf.@call(null, channel, ActiveChannel.prototype), channel._subscribers = [], channel._stores = new SafeMap;
}
function maybeMarkInactive(channel) {
  if (!channel._subscribers.length && !channel._stores.size)
    ObjectSetPrototypeOf.@call(null, channel, Channel.prototype), channel._subscribers = @undefined, channel._stores = @undefined;
}
function defaultTransform(data) {
  return data;
}
function wrapStoreRun(store, data, next, transform = defaultTransform) {
  return () => {
    let context;
    try {
      context = transform(data);
    } catch (err) {
      return process.nextTick(() => reportError(err)), next();
    }
    return store.run(context, next);
  };
}

class ActiveChannel {
  _subscribers;
  name;
  _stores;
  subscribe(subscription) {
    validateFunction(subscription, "subscription"), @arrayPush(this._subscribers, subscription), channels.incRef(this.name);
  }
  unsubscribe(subscription) {
    let index = ArrayPrototypeIndexOf.@call(this._subscribers, subscription);
    if (index === -1)
      return !1;
    return ArrayPrototypeSplice.@call(this._subscribers, index, 1), channels.decRef(this.name), maybeMarkInactive(this), !0;
  }
  bindStore(store, transform) {
    if (!this._stores.has(store))
      channels.incRef(this.name);
    this._stores.set(store, transform);
  }
  unbindStore(store) {
    if (!this._stores.has(store))
      return !1;
    return this._stores.delete(store), channels.decRef(this.name), maybeMarkInactive(this), !0;
  }
  get hasSubscribers() {
    return !0;
  }
  publish(data) {
    for (let i = 0;i < (this._subscribers?.length || 0); i++)
      try {
        let onMessage = this._subscribers[i];
        onMessage(data, this.name);
      } catch (err) {
        process.nextTick(() => reportError(err));
      }
  }
  runStores(data, fn, thisArg, ...args) {
    let run = () => {
      return this.publish(data), fn.@apply(thisArg, args);
    };
    for (let entry of this._stores.entries()) {
      let store = entry[0], transform = entry[1];
      run = wrapStoreRun(store, data, run, transform);
    }
    return run();
  }
}

class Channel {
  _subscribers;
  _stores;
  name;
  constructor(name) {
    this._subscribers = @undefined, this._stores = @undefined, this.name = name, channels.set(name, this);
  }
  static [SymbolHasInstance](instance) {
    let prototype = ObjectGetPrototypeOf.@call(null, instance);
    return prototype === Channel.prototype || prototype === ActiveChannel.prototype;
  }
  subscribe(subscription) {
    markActive(this), this.subscribe(subscription);
  }
  unsubscribe() {
    return !1;
  }
  bindStore(store, transform) {
    markActive(this), this.bindStore(store, transform);
  }
  unbindStore() {
    return !1;
  }
  get hasSubscribers() {
    return !1;
  }
  publish() {}
  runStores(data, fn, thisArg, ...args) {
    return fn.@apply(thisArg, args);
  }
}
var channels = new WeakRefMap;
function channel(name) {
  let channel2 = channels.get(name);
  if (channel2)
    return channel2;
  if (typeof name !== "string" && typeof name !== "symbol")
    throw @makeErrorWithCode(118, "channel", "string or symbol", name);
  return new Channel(name);
}
function subscribe(name, subscription) {
  return channel(name).subscribe(subscription);
}
function unsubscribe(name, subscription) {
  return channel(name).unsubscribe(subscription);
}
function hasSubscribers(name) {
  let channel2 = channels.get(name);
  if (!channel2)
    return !1;
  return channel2.hasSubscribers;
}
var traceEvents = ["start", "end", "asyncStart", "asyncEnd", "error"];
function assertChannel(value, name) {
  if (!(value instanceof Channel))
    throw @makeErrorWithCode(118, name, ["Channel"], value);
}

class TracingChannel {
  start;
  end;
  asyncStart;
  asyncEnd;
  error;
  constructor(nameOrChannels) {
    if (typeof nameOrChannels === "string")
      this.start = channel(`tracing:${nameOrChannels}:start`), this.end = channel(`tracing:${nameOrChannels}:end`), this.asyncStart = channel(`tracing:${nameOrChannels}:asyncStart`), this.asyncEnd = channel(`tracing:${nameOrChannels}:asyncEnd`), this.error = channel(`tracing:${nameOrChannels}:error`);
    else if (typeof nameOrChannels === "object") {
      let { start, end, asyncStart, asyncEnd, error } = nameOrChannels;
      assertChannel(start, "nameOrChannels.start"), assertChannel(end, "nameOrChannels.end"), assertChannel(asyncStart, "nameOrChannels.asyncStart"), assertChannel(asyncEnd, "nameOrChannels.asyncEnd"), assertChannel(error, "nameOrChannels.error"), this.start = start, this.end = end, this.asyncStart = asyncStart, this.asyncEnd = asyncEnd, this.error = error;
    } else
      throw @makeErrorWithCode(118, "nameOrChannels", ["string, object, or Channel"], nameOrChannels);
  }
  subscribe(handlers) {
    for (let name of traceEvents) {
      if (!handlers[name])
        continue;
      this[name]?.subscribe(handlers[name]);
    }
  }
  unsubscribe(handlers) {
    let done = !0;
    for (let name of traceEvents) {
      if (!handlers[name])
        continue;
      if (!this[name]?.unsubscribe(handlers[name]))
        done = !1;
    }
    return done;
  }
  traceSync(fn, context = {}, thisArg, ...args) {
    let { start, end, error } = this;
    return start.runStores(context, () => {
      try {
        let result = fn.@apply(thisArg, args);
        return context.result = result, result;
      } catch (err) {
        throw context.error = err, error.publish(context), err;
      } finally {
        end.publish(context);
      }
    });
  }
  tracePromise(fn, context = {}, thisArg, ...args) {
    let { start, end, asyncStart, asyncEnd, error } = this;
    function reject(err) {
      return context.error = err, error.publish(context), asyncStart.publish(context), asyncEnd.publish(context), PromiseReject(err);
    }
    function resolve(result) {
      return context.result = result, asyncStart.publish(context), asyncEnd.publish(context), result;
    }
    return start.runStores(context, () => {
      try {
        let promise = fn.@apply(thisArg, args);
        if (!(promise instanceof @Promise))
          promise = PromiseResolve(promise);
        return PromisePrototypeThen(promise, resolve, reject);
      } catch (err) {
        throw context.error = err, error.publish(context), err;
      } finally {
        end.publish(context);
      }
    });
  }
  traceCallback(fn, position = -1, context = {}, thisArg, ...args) {
    let { start, end, asyncStart, asyncEnd, error } = this;
    function wrappedCallback(err, res) {
      if (err)
        context.error = err, error.publish(context);
      else
        context.result = res;
      asyncStart.runStores(context, () => {
        try {
          if (callback)
            return callback.@apply(this, arguments);
        } finally {
          asyncEnd.publish(context);
        }
      });
    }
    let callback = ArrayPrototypeAt.@call(args, position);
    return validateFunction(callback, "callback"), ArrayPrototypeSplice.@call(args, position, 1, wrappedCallback), start.runStores(context, () => {
      try {
        return fn.@apply(thisArg, args);
      } catch (err) {
        throw context.error = err, error.publish(context), err;
      } finally {
        end.publish(context);
      }
    });
  }
}
function tracingChannel(nameOrChannels) {
  return new TracingChannel(nameOrChannels);
}
$ = {
  channel,
  hasSubscribers,
  subscribe,
  tracingChannel,
  unsubscribe,
  Channel
};
return $})

