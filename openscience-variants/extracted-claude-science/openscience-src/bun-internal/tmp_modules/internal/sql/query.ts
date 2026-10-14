(function (){"use strict";// build/release/tmp_modules/internal/sql/query.ts
var $, _resolve = Symbol("resolve"), _reject = Symbol("reject"), _handle = Symbol("handle"), _queryStatus = Symbol("status"), _handler = Symbol("handler"), _strings = Symbol("strings"), _values = Symbol("values"), _flags = Symbol("flags"), _results = Symbol("results"), _adapter = Symbol("adapter"), PublicPromise = @Promise;

class Query extends PublicPromise {
  [_resolve];
  [_reject];
  [_handle];
  [_handler];
  [_queryStatus];
  [_strings];
  [_values];
  [_flags];
  [_adapter];
  [Symbol.for("nodejs.util.inspect.custom")]() {
    let status = this[_queryStatus], query = "";
    if ((status & 2 /* active */) != 0)
      query += "active ";
    if ((status & 4 /* cancelled */) != 0)
      query += "cancelled ";
    if ((status & 16 /* executed */) != 0)
      query += "executed ";
    if ((status & 8 /* error */) != 0)
      query += "error ";
    return `Query { ${query.trimEnd()} }`;
  }
  #getQueryHandle() {
    let handle = this[_handle];
    if (!handle)
      try {
        let [sql, values] = this[_adapter].normalizeQuery(this[_strings], this[_values]);
        this[_handle] = handle = this[_adapter].createQueryHandle(sql, values, this[_flags]);
      } catch (err) {
        this[_queryStatus] |= 40, this.reject(err);
      }
    return handle;
  }
  constructor(strings, values, flags, handler, adapter) {
    let resolve_, reject_;
    super((resolve, reject) => {
      resolve_ = resolve, reject_ = reject;
    });
    if (this[_adapter] = adapter, typeof strings === "string") {
      if (!(flags & 2 /* unsafe */))
        flags |= 16 /* notTagged */, strings = adapter.escapeIdentifier(strings);
    }
    this[_resolve] = resolve_, this[_reject] = reject_, this[_handle] = null, this[_handler] = handler, this[_queryStatus] = 0 /* none */, this[_strings] = strings, this[_values] = values, this[_flags] = flags, this[_results] = null;
  }
  #run() {
    let { [_handler]: handler, [_queryStatus]: status } = this;
    if (status & 60)
      return;
    if (this[_flags] & 16 /* notTagged */) {
      this.reject(this[_adapter].notTaggedCallError());
      return;
    }
    this[_queryStatus] |= 16 /* executed */;
    let handle = this.#getQueryHandle();
    if (!handle)
      return this;
    try {
      return handler(this, handle);
    } catch (err) {
      this[_queryStatus] |= 8 /* error */, this.reject(err);
    }
  }
  async#runAsync() {
    let { [_handler]: handler, [_queryStatus]: status } = this;
    if (status & 60)
      return;
    if (this[_flags] & 16 /* notTagged */) {
      this.reject(this[_adapter].notTaggedCallError());
      return;
    }
    this[_queryStatus] |= 16 /* executed */;
    let handle = this.#getQueryHandle();
    if (!handle)
      return this;
    await @Promise.@resolve();
    try {
      return handler(this, handle);
    } catch (err) {
      this[_queryStatus] |= 8 /* error */, this.reject(err);
    }
  }
  get active() {
    return (this[_queryStatus] & 2 /* active */) != 0;
  }
  set active(value) {
    if (this[_queryStatus] & 12)
      return;
    if (value)
      this[_queryStatus] |= 2 /* active */;
    else
      this[_queryStatus] &= -3;
  }
  get cancelled() {
    return (this[_queryStatus] & 4 /* cancelled */) !== 0;
  }
  resolve(x) {
    this[_queryStatus] &= -3;
    let handle = this.#getQueryHandle();
    if (!handle)
      return this;
    return handle.done?.(), this[_resolve](x);
  }
  reject(x) {
    if (this[_queryStatus] &= -3, this[_queryStatus] |= 8 /* error */, !(this[_queryStatus] & 32 /* invalidHandle */)) {
      let handle = this.#getQueryHandle();
      if (!handle)
        return this[_reject](x);
      handle.done?.();
    }
    return this[_reject](x);
  }
  cancel() {
    let status = this[_queryStatus];
    if (status & 4 /* cancelled */)
      return this;
    if (this[_queryStatus] |= 4 /* cancelled */, status & 16 /* executed */) {
      let handle = this.#getQueryHandle();
      if (handle)
        handle.cancel?.();
    }
    return this;
  }
  execute() {
    return this.#run(), this;
  }
  async run() {
    if (this[_flags] & 16 /* notTagged */)
      throw this[_adapter].notTaggedCallError();
    return await this.#runAsync(), this;
  }
  raw() {
    let handle = this.#getQueryHandle();
    if (!handle)
      return this;
    return handle.setMode(2 /* raw */), this;
  }
  simple() {
    return this[_flags] |= 8 /* simple */, this;
  }
  values() {
    let handle = this.#getQueryHandle();
    if (!handle)
      return this;
    return handle.setMode(1 /* values */), this;
  }
  #runAsyncAndCatch() {
    let runPromise = this.#runAsync();
    if (@isPromise(runPromise) && runPromise !== this)
      runPromise.catch(() => {});
  }
  then() {
    this.#runAsyncAndCatch();
    let result = super.@then.@apply(this, arguments);
    if (arguments.length >= 2 && arguments[1] != null)
      @markPromiseAsHandled(result);
    return result;
  }
  catch() {
    if (this[_flags] & 16 /* notTagged */)
      throw this[_adapter].notTaggedCallError();
    this.#runAsyncAndCatch();
    let result = super.catch.@apply(this, arguments);
    return @markPromiseAsHandled(result), result;
  }
  finally(_onfinally) {
    if (this[_flags] & 16 /* notTagged */)
      throw this[_adapter].notTaggedCallError();
    return this.#runAsyncAndCatch(), super.finally.@apply(this, arguments);
  }
}
Object.defineProperty(Query, Symbol.species, { value: PublicPromise });
Object.defineProperty(Query, Symbol.toStringTag, { value: "Query" });
var SQLQueryResultMode;
((SQLQueryResultMode2) => {
  SQLQueryResultMode2[SQLQueryResultMode2.objects = 0] = "objects";
  SQLQueryResultMode2[SQLQueryResultMode2.values = 1] = "values";
  SQLQueryResultMode2[SQLQueryResultMode2.raw = 2] = "raw";
})(SQLQueryResultMode ||= {});
var SQLQueryFlags;
((SQLQueryFlags2) => {
  SQLQueryFlags2[SQLQueryFlags2.none = 0] = "none";
  SQLQueryFlags2[SQLQueryFlags2.allowUnsafeTransaction = 1] = "allowUnsafeTransaction";
  SQLQueryFlags2[SQLQueryFlags2.unsafe = 2] = "unsafe";
  SQLQueryFlags2[SQLQueryFlags2.bigint = 4] = "bigint";
  SQLQueryFlags2[SQLQueryFlags2.simple = 8] = "simple";
  SQLQueryFlags2[SQLQueryFlags2.notTagged = 16] = "notTagged";
})(SQLQueryFlags ||= {});
var SQLQueryStatus;
((SQLQueryStatus2) => {
  SQLQueryStatus2[SQLQueryStatus2.none = 0] = "none";
  SQLQueryStatus2[SQLQueryStatus2.active = 2] = "active";
  SQLQueryStatus2[SQLQueryStatus2.cancelled = 4] = "cancelled";
  SQLQueryStatus2[SQLQueryStatus2.error = 8] = "error";
  SQLQueryStatus2[SQLQueryStatus2.executed = 16] = "executed";
  SQLQueryStatus2[SQLQueryStatus2.invalidHandle = 32] = "invalidHandle";
})(SQLQueryStatus ||= {});
$ = {
  Query,
  SQLQueryFlags,
  SQLQueryResultMode,
  SQLQueryStatus,
  symbols: {
    _resolve,
    _reject,
    _handle,
    _queryStatus,
    _handler,
    _strings,
    _values,
    _flags,
    _results
  }
};
return $})

