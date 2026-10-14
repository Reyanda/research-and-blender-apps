(function (){"use strict";// build/release/tmp_modules/bun/sql.ts
var $, { Query, SQLQueryFlags } = @getInternalField(@internalModuleRegistry, 36) || @createInternalModuleById(36), { PostgresAdapter } = @getInternalField(@internalModuleRegistry, 35) || @createInternalModuleById(35), { MySQLAdapter } = @getInternalField(@internalModuleRegistry, 34) || @createInternalModuleById(34), { SQLiteAdapter } = @getInternalField(@internalModuleRegistry, 38) || @createInternalModuleById(38), { SQLHelper, parseOptions } = @getInternalField(@internalModuleRegistry, 37) || @createInternalModuleById(37), { SQLError, PostgresError, SQLiteError, MySQLError } = @getInternalField(@internalModuleRegistry, 33) || @createInternalModuleById(33), defineProperties = Object.defineProperties;
function adapterFromOptions(options) {
  switch (options.adapter) {
    case "postgres":
      return new PostgresAdapter(options);
    case "mysql":
    case "mariadb":
      return new MySQLAdapter(options);
    case "sqlite":
      return new SQLiteAdapter(options);
    default:
      throw Error(`Unsupported adapter: ${options.adapter}.`);
  }
}
var SQL = function SQL2(stringOrUrlOrOptions = @undefined, definitelyOptionsButMaybeEmpty = {}) {
  let connectionInfo = parseOptions(stringOrUrlOrOptions, definitelyOptionsButMaybeEmpty), pool = adapterFromOptions(connectionInfo);
  function onQueryDisconnected(err) {
    let query = this;
    if (err)
      return query.reject(err);
    if (query.cancelled)
      return query.reject(pool.queryCancelledError());
  }
  function onQueryConnected(handle, err, connectionHandle) {
    let query = this;
    if (err)
      return query.reject(err);
    if (query.cancelled)
      return pool.release(connectionHandle), query.reject(pool.queryCancelledError());
    if (connectionHandle.bindQuery)
      connectionHandle.bindQuery(query, onQueryDisconnected.bind(query));
    try {
      let connection = pool.getConnectionForQuery ? pool.getConnectionForQuery(connectionHandle) : connectionHandle, result = handle.run(connection, query);
      if (result && @isPromise(result))
        result.catch((err2) => query.reject(err2));
    } catch (err2) {
      query.reject(err2);
    }
  }
  function queryFromPoolHandler(query, handle, err) {
    if (err)
      return query.reject(err);
    if (!handle || query.cancelled)
      return query.reject(pool.queryCancelledError());
    pool.connect(onQueryConnected.bind(query, handle));
  }
  function queryFromPool(strings, values) {
    try {
      return new Query(strings, values, connectionInfo.bigint ? SQLQueryFlags.bigint : SQLQueryFlags.none, queryFromPoolHandler, pool);
    } catch (err) {
      return @Promise.@reject(err);
    }
  }
  function unsafeQuery(strings, values) {
    try {
      let flags = connectionInfo.bigint ? SQLQueryFlags.bigint | SQLQueryFlags.unsafe : SQLQueryFlags.unsafe;
      if ((values?.length ?? 0) === 0)
        flags |= SQLQueryFlags.simple;
      return new Query(strings, values, flags, queryFromPoolHandler, pool);
    } catch (err) {
      return @Promise.@reject(err);
    }
  }
  function onTransactionQueryDisconnected(query) {
    this.delete(query);
  }
  function queryFromTransactionHandler(transactionQueries, query, handle, err) {
    let pooledConnection = this;
    if (err)
      return transactionQueries.delete(query), query.reject(err);
    if (query.cancelled)
      return transactionQueries.delete(query), query.reject(pool.queryCancelledError());
    query.finally(onTransactionQueryDisconnected.bind(transactionQueries, query));
    try {
      let connection = pool.getConnectionForQuery ? pool.getConnectionForQuery(pooledConnection) : pooledConnection, result = handle.run(connection, query);
      if (result && @isPromise(result))
        result.catch((err2) => query.reject(err2));
    } catch (err2) {
      query.reject(err2);
    }
  }
  function queryFromTransaction(strings, values, pooledConnection, transactionQueries) {
    try {
      let query = new Query(strings, values, connectionInfo.bigint ? SQLQueryFlags.allowUnsafeTransaction | SQLQueryFlags.bigint : SQLQueryFlags.allowUnsafeTransaction, queryFromTransactionHandler.bind(pooledConnection, transactionQueries), pool);
      return transactionQueries.add(query), query;
    } catch (err) {
      return @Promise.@reject(err);
    }
  }
  function unsafeQueryFromTransaction(strings, values, pooledConnection, transactionQueries) {
    try {
      let flags = connectionInfo.bigint ? SQLQueryFlags.allowUnsafeTransaction | SQLQueryFlags.unsafe | SQLQueryFlags.bigint : SQLQueryFlags.allowUnsafeTransaction | SQLQueryFlags.unsafe;
      if ((values?.length ?? 0) === 0)
        flags |= SQLQueryFlags.simple;
      let query = new Query(strings, values, flags, queryFromTransactionHandler.bind(pooledConnection, transactionQueries), pool);
      return transactionQueries.add(query), query;
    } catch (err) {
      return @Promise.@reject(err);
    }
  }
  function onTransactionDisconnected(err) {
    let reject = this.reject;
    this.connectionState |= 2 /* closed */;
    for (let query of this.queries)
      query.reject(err);
    if (err)
      return reject(err);
  }
  function onReserveConnected(err, pooledConnection) {
    let { resolve, reject } = this;
    if (err)
      return reject(err);
    let reservedTransaction = /* @__PURE__ */ new Set, state = {
      connectionState: 1 /* acceptQueries */,
      reject,
      storedError: null,
      queries: /* @__PURE__ */ new Set
    }, onClose = onTransactionDisconnected.bind(state);
    if (pooledConnection.onClose)
      pooledConnection.onClose(onClose);
    function reserved_sql(strings, ...values) {
      if (state.connectionState & 2 /* closed */ || !(state.connectionState & 1 /* acceptQueries */))
        return @Promise.@reject(pool.connectionClosedError());
      if (@isArray(strings)) {
        if (!@isArray(strings.raw))
          return new SQLHelper(strings, values);
      } else if (typeof strings === "object" && !(strings instanceof Query) && !(strings instanceof SQLHelper))
        return new SQLHelper([strings], values);
      return queryFromTransaction(strings, values, pooledConnection, state.queries);
    }
    reserved_sql.unsafe = (string, args = []) => {
      return unsafeQueryFromTransaction(string, args, pooledConnection, state.queries);
    }, reserved_sql.file = async (path, args = []) => {
      return await Bun.file(path).text().then((text) => {
        return unsafeQueryFromTransaction(text, args, pooledConnection, state.queries);
      });
    }, reserved_sql.connect = () => {
      if (state.connectionState & 2 /* closed */)
        return @Promise.@reject(pool.connectionClosedError());
      return @Promise.@resolve(reserved_sql);
    }, reserved_sql.commitDistributed = async function(name) {
      if (!pool.getCommitDistributedSQL)
        throw Error("This adapter doesn't support distributed transactions.");
      let sql2 = pool.getCommitDistributedSQL(name);
      return await reserved_sql.unsafe(sql2);
    }, reserved_sql.rollbackDistributed = async function(name) {
      if (!pool.getRollbackDistributedSQL)
        throw Error("This adapter doesn't support distributed transactions.");
      let sql2 = pool.getRollbackDistributedSQL(name);
      return await reserved_sql.unsafe(sql2);
    }, reserved_sql.reserve = () => sql.reserve(), reserved_sql.array = sql.array;
    function onTransactionFinished(transaction_promise) {
      reservedTransaction.delete(transaction_promise);
    }
    reserved_sql.beginDistributed = (name, fn) => {
      if (state.connectionState & 2 /* closed */)
        return @Promise.@reject(pool.connectionClosedError());
      let callback = fn;
      if (typeof name !== "string")
        return @Promise.@reject(@makeErrorWithCode(119, "name", name, "must be a string"));
      if (!@isCallable(callback))
        return @Promise.@reject(@makeErrorWithCode(119, "fn", callback, "must be a function"));
      let { promise, resolve: resolve2, reject: reject2 } = @Promise.withResolvers();
      return onTransactionConnected(callback, name, resolve2, reject2, !0, !0, null, pooledConnection), reservedTransaction.add(promise), promise.finally(onTransactionFinished.bind(null, promise)), promise;
    }, reserved_sql.begin = (options_or_fn, fn) => {
      if (state.connectionState & 2 /* closed */ || !(state.connectionState & 1 /* acceptQueries */))
        return @Promise.@reject(pool.connectionClosedError());
      let callback = fn, options = options_or_fn;
      if (@isCallable(options_or_fn))
        callback = options_or_fn, options = @undefined;
      else if (typeof options_or_fn !== "string")
        return @Promise.@reject(@makeErrorWithCode(119, "options", options_or_fn, "must be a string"));
      if (!@isCallable(callback))
        return @Promise.@reject(@makeErrorWithCode(119, "fn", callback, "must be a function"));
      let { promise, resolve: resolve2, reject: reject2 } = @Promise.withResolvers();
      return onTransactionConnected(callback, options, resolve2, reject2, !0, !1, null, pooledConnection), reservedTransaction.add(promise), promise.finally(onTransactionFinished.bind(null, promise)), promise;
    }, reserved_sql.flush = () => {
      if (state.connectionState & 2 /* closed */)
        throw pool.connectionClosedError();
      if (pooledConnection.flush)
        return pooledConnection.flush();
      return pool.flush();
    }, reserved_sql.close = async (options) => {
      let reserveQueries = state.queries;
      if (state.connectionState & 2 /* closed */ || !(state.connectionState & 1 /* acceptQueries */))
        return @Promise.@resolve(@undefined);
      state.connectionState &= -2;
      let timeout = options?.timeout;
      if (timeout) {
        if (timeout = Number(timeout), timeout > 2147483648 || timeout < 0 || timeout !== timeout)
          throw @makeErrorWithCode(119, "options.timeout", timeout, "must be a non-negative integer less than 2^31");
        if (timeout > 0 && (reserveQueries.size > 0 || reservedTransaction.size > 0)) {
          let { promise, resolve: resolve2 } = @Promise.withResolvers(), pending_queries = @Array.from(reserveQueries), pending_transactions = @Array.from(reservedTransaction), timer = setTimeout(() => {
            state.connectionState |= 2 /* closed */;
            for (let query of reserveQueries)
              query.cancel();
            state.connectionState |= 2 /* closed */, pooledConnection.close(), resolve2();
          }, timeout * 1000);
          return timer.unref(), @Promise.all([@Promise.all(pending_queries), @Promise.all(pending_transactions)]).finally(() => {
            clearTimeout(timer), resolve2();
          }), promise;
        }
      }
      state.connectionState |= 2 /* closed */;
      for (let query of reserveQueries)
        query.cancel();
      return pooledConnection.close(), @Promise.@resolve(@undefined);
    }, reserved_sql.release = () => {
      if (state.connectionState & 2 /* closed */ || !(state.connectionState & 1 /* acceptQueries */))
        return @Promise.@reject(pool.connectionClosedError());
      if (state.connectionState |= 2 /* closed */, state.connectionState &= -2, pool.detachConnectionCloseHandler)
        pool.detachConnectionCloseHandler(pooledConnection, onClose);
      return pool.release(pooledConnection), @Promise.@resolve(@undefined);
    }, reserved_sql[Symbol.asyncDispose] = () => reserved_sql.release(), reserved_sql[Symbol.dispose] = () => reserved_sql.release(), reserved_sql.options = sql.options, reserved_sql.transaction = reserved_sql.begin, reserved_sql.distributed = reserved_sql.beginDistributed, reserved_sql.end = reserved_sql.close, resolve(reserved_sql);
  }
  async function onTransactionConnected(callback, options, resolve, reject, dontRelease, distributed, err, pooledConnection) {
    if (err)
      return reject(err);
    let state = {
      connectionState: 1 /* acceptQueries */,
      reject,
      queries: /* @__PURE__ */ new Set
    }, savepoints = 0, transactionSavepoints = /* @__PURE__ */ new Set, BEGIN_COMMAND, ROLLBACK_COMMAND, COMMIT_COMMAND, SAVEPOINT_COMMAND, RELEASE_SAVEPOINT_COMMAND, ROLLBACK_TO_SAVEPOINT_COMMAND, BEFORE_COMMIT_OR_ROLLBACK_COMMAND = null;
    if (distributed) {
      let commands = pool.getDistributedTransactionCommands?.(options);
      if (!commands)
        return pool.release(pooledConnection), reject(Error("This adapter doesn't support distributed transactions."));
      BEGIN_COMMAND = commands.BEGIN, COMMIT_COMMAND = commands.COMMIT, ROLLBACK_COMMAND = commands.ROLLBACK, SAVEPOINT_COMMAND = commands.SAVEPOINT, RELEASE_SAVEPOINT_COMMAND = commands.RELEASE_SAVEPOINT, ROLLBACK_TO_SAVEPOINT_COMMAND = commands.ROLLBACK_TO_SAVEPOINT, BEFORE_COMMIT_OR_ROLLBACK_COMMAND = commands.BEFORE_COMMIT_OR_ROLLBACK || null;
    } else {
      if (options && pool.validateTransactionOptions) {
        let validation = pool.validateTransactionOptions(options);
        if (!validation.valid)
          return pool.release(pooledConnection), reject(Error(validation.error));
      }
      try {
        let commands = pool.getTransactionCommands(options);
        BEGIN_COMMAND = commands.BEGIN, COMMIT_COMMAND = commands.COMMIT, ROLLBACK_COMMAND = commands.ROLLBACK, SAVEPOINT_COMMAND = commands.SAVEPOINT, RELEASE_SAVEPOINT_COMMAND = commands.RELEASE_SAVEPOINT, ROLLBACK_TO_SAVEPOINT_COMMAND = commands.ROLLBACK_TO_SAVEPOINT, BEFORE_COMMIT_OR_ROLLBACK_COMMAND = commands.BEFORE_COMMIT_OR_ROLLBACK || null;
      } catch (err2) {
        return pool.release(pooledConnection), reject(err2);
      }
    }
    let onClose = onTransactionDisconnected.bind(state);
    if (pool.attachConnectionCloseHandler)
      pool.attachConnectionCloseHandler(pooledConnection, onClose);
    function run_internal_transaction_sql(string) {
      if (state.connectionState & 2 /* closed */)
        return @Promise.@reject(pool.connectionClosedError());
      return unsafeQueryFromTransaction(string, [], pooledConnection, state.queries);
    }
    function transaction_sql(strings, ...values) {
      if (state.connectionState & 2 /* closed */ || !(state.connectionState & 1 /* acceptQueries */))
        return @Promise.@reject(pool.connectionClosedError());
      if (@isArray(strings)) {
        if (!@isArray(strings.raw))
          return new SQLHelper(strings, values);
      } else if (typeof strings === "object" && !(strings instanceof Query) && !(strings instanceof SQLHelper))
        return new SQLHelper([strings], values);
      return queryFromTransaction(strings, values, pooledConnection, state.queries);
    }
    transaction_sql.unsafe = (string, args = []) => {
      return unsafeQueryFromTransaction(string, args, pooledConnection, state.queries);
    }, transaction_sql.file = async (path, args = []) => {
      return await Bun.file(path).text().then((text) => {
        return unsafeQueryFromTransaction(text, args, pooledConnection, state.queries);
      });
    }, transaction_sql.reserve = () => sql.reserve(), transaction_sql.array = sql.array, transaction_sql.connect = () => {
      if (state.connectionState & 2 /* closed */)
        return @Promise.@reject(pool.connectionClosedError());
      return @Promise.@resolve(transaction_sql);
    }, transaction_sql.commitDistributed = async function(name) {
      if (!pool.getCommitDistributedSQL)
        throw Error("This adapter doesn't support distributed transactions.");
      let sql2 = pool.getCommitDistributedSQL(name);
      return await run_internal_transaction_sql(sql2);
    }, transaction_sql.rollbackDistributed = async function(name) {
      if (!pool.getRollbackDistributedSQL)
        throw Error("This adapter doesn't support distributed transactions.");
      let sql2 = pool.getRollbackDistributedSQL(name);
      return await run_internal_transaction_sql(sql2);
    }, transaction_sql.begin = function() {
      if (distributed)
        throw pool.invalidTransactionStateError("cannot call begin inside a distributed transaction");
      throw pool.invalidTransactionStateError("cannot call begin inside a transaction use savepoint() instead");
    }, transaction_sql.beginDistributed = function() {
      if (distributed)
        throw pool.invalidTransactionStateError("cannot call beginDistributed inside a distributed transaction");
      throw pool.invalidTransactionStateError("cannot call beginDistributed inside a transaction use savepoint() instead");
    }, transaction_sql.flush = function() {
      if (state.connectionState & 2 /* closed */)
        throw pool.connectionClosedError();
      if (pooledConnection.flush)
        return pooledConnection.flush();
      return pool.flush();
    }, transaction_sql.close = async function(options2) {
      if (state.connectionState & 2 /* closed */ || !(state.connectionState & 1 /* acceptQueries */))
        return @Promise.@resolve(@undefined);
      state.connectionState &= -2;
      let transactionQueries = state.queries, timeout = options2?.timeout;
      if (timeout) {
        if (timeout = Number(timeout), timeout > 2147483648 || timeout < 0 || timeout !== timeout)
          throw @makeErrorWithCode(119, "options.timeout", timeout, "must be a non-negative integer less than 2^31");
        if (timeout > 0 && (transactionQueries.size > 0 || transactionSavepoints.size > 0)) {
          let { promise, resolve: resolve2 } = @Promise.withResolvers(), pending_queries = @Array.from(transactionQueries), pending_savepoints = @Array.from(transactionSavepoints), timer = setTimeout(async () => {
            for (let query of transactionQueries)
              query.cancel();
            if (BEFORE_COMMIT_OR_ROLLBACK_COMMAND)
              await run_internal_transaction_sql(BEFORE_COMMIT_OR_ROLLBACK_COMMAND);
            await run_internal_transaction_sql(ROLLBACK_COMMAND), state.connectionState |= 2 /* closed */, resolve2();
          }, timeout * 1000);
          return timer.unref(), @Promise.all([@Promise.all(pending_queries), @Promise.all(pending_savepoints)]).finally(() => {
            clearTimeout(timer), resolve2();
          }), promise;
        }
      }
      for (let query of transactionQueries)
        query.cancel();
      if (BEFORE_COMMIT_OR_ROLLBACK_COMMAND)
        await run_internal_transaction_sql(BEFORE_COMMIT_OR_ROLLBACK_COMMAND);
      await run_internal_transaction_sql(ROLLBACK_COMMAND), state.connectionState |= 2 /* closed */;
    }, transaction_sql[Symbol.asyncDispose] = () => transaction_sql.close(), transaction_sql.options = sql.options, transaction_sql.transaction = transaction_sql.begin, transaction_sql.distributed = transaction_sql.beginDistributed, transaction_sql.end = transaction_sql.close;
    function onSavepointFinished(savepoint_promise) {
      transactionSavepoints.delete(savepoint_promise);
    }
    async function run_internal_savepoint(save_point_name, savepoint_callback) {
      await run_internal_transaction_sql(`${SAVEPOINT_COMMAND} ${save_point_name}`);
      try {
        let result = await savepoint_callback(transaction_sql);
        if (RELEASE_SAVEPOINT_COMMAND)
          await run_internal_transaction_sql(`${RELEASE_SAVEPOINT_COMMAND} ${save_point_name}`);
        if (@isArray(result))
          result = await @Promise.all(result);
        return result;
      } catch (err2) {
        if (!(state.connectionState & 2 /* closed */))
          await run_internal_transaction_sql(`${ROLLBACK_TO_SAVEPOINT_COMMAND} ${save_point_name}`);
        throw err2;
      }
    }
    if (distributed)
      transaction_sql.savepoint = async (_fn, _name) => {
        throw pool.invalidTransactionStateError("cannot call savepoint inside a distributed transaction");
      };
    else
      transaction_sql.savepoint = async (fn, name) => {
        let savepoint_callback = fn;
        if (state.connectionState & 2 /* closed */ || !(state.connectionState & 1 /* acceptQueries */))
          throw pool.connectionClosedError();
        if (@isCallable(name))
          savepoint_callback = name, name = "";
        if (!@isCallable(savepoint_callback))
          throw @makeErrorWithCode(119, "fn", callback, "must be a function");
        let save_point_name = `s${savepoints++}${name ? `_${name}` : ""}`, promise = run_internal_savepoint(save_point_name, savepoint_callback);
        return transactionSavepoints.add(promise), await promise.finally(onSavepointFinished.bind(null, promise));
      };
    let needs_rollback = !1;
    try {
      await run_internal_transaction_sql(BEGIN_COMMAND), needs_rollback = !0;
      let transaction_result = await callback(transaction_sql);
      if (@isArray(transaction_result))
        transaction_result = await @Promise.all(transaction_result);
      if (needs_rollback = !1, BEFORE_COMMIT_OR_ROLLBACK_COMMAND)
        await run_internal_transaction_sql(BEFORE_COMMIT_OR_ROLLBACK_COMMAND);
      return await run_internal_transaction_sql(COMMIT_COMMAND), resolve(transaction_result);
    } catch (err2) {
      try {
        if (!(state.connectionState & 2 /* closed */) && needs_rollback) {
          if (BEFORE_COMMIT_OR_ROLLBACK_COMMAND)
            await run_internal_transaction_sql(BEFORE_COMMIT_OR_ROLLBACK_COMMAND);
          await run_internal_transaction_sql(ROLLBACK_COMMAND);
        }
      } catch (err3) {
        return reject(err3);
      }
      return reject(err2);
    } finally {
      if (state.connectionState |= 2 /* closed */, pool.detachConnectionCloseHandler)
        pool.detachConnectionCloseHandler(pooledConnection, onClose);
      if (!dontRelease)
        pool.release(pooledConnection);
    }
  }
  function sql(strings, ...values) {
    if (@isArray(strings)) {
      if (!@isArray(strings.raw))
        return new SQLHelper(strings, values);
    } else if (typeof strings === "object" && !(strings instanceof Query) && !(strings instanceof SQLHelper))
      return new SQLHelper([strings], values);
    return queryFromPool(strings, values);
  }
  return sql.unsafe = (string, args = []) => {
    return unsafeQuery(string, args);
  }, sql.file = async (path, args = []) => {
    return await Bun.file(path).text().then((text) => {
      return unsafeQuery(text, args);
    });
  }, sql.reserve = () => {
    if (pool.closed)
      return @Promise.@reject(pool.connectionClosedError());
    if (pool.supportsReservedConnections && !pool.supportsReservedConnections())
      return @Promise.@reject(Error("This adapter doesn't support connection reservation"));
    let promiseWithResolvers = @Promise.withResolvers();
    return pool.connect(onReserveConnected.bind(promiseWithResolvers), !0), promiseWithResolvers.promise;
  }, sql.array = (values, typeNameOrID = @undefined) => {
    return pool.array(values, typeNameOrID);
  }, sql.rollbackDistributed = async function(name) {
    if (pool.closed)
      throw pool.connectionClosedError();
    if (!pool.getRollbackDistributedSQL)
      throw Error("This adapter doesn't support distributed transactions.");
    let sqlQuery = pool.getRollbackDistributedSQL(name);
    return await sql.unsafe(sqlQuery);
  }, sql.commitDistributed = async function(name) {
    if (pool.closed)
      throw pool.connectionClosedError();
    if (!pool.getCommitDistributedSQL)
      throw Error("This adapter doesn't support distributed transactions.");
    let sqlQuery = pool.getCommitDistributedSQL(name);
    return await sql.unsafe(sqlQuery);
  }, sql.beginDistributed = (name, fn) => {
    if (pool.closed)
      return @Promise.@reject(pool.connectionClosedError());
    let callback = fn;
    if (typeof name !== "string")
      return @Promise.@reject(@makeErrorWithCode(119, "name", name, "must be a string"));
    if (!@isCallable(callback))
      return @Promise.@reject(@makeErrorWithCode(119, "fn", callback, "must be a function"));
    let { promise, resolve, reject } = @Promise.withResolvers(), useReserved = pool.supportsReservedConnections?.() ?? !0;
    return pool.connect(onTransactionConnected.bind(null, callback, name, resolve, reject, !1, !0), useReserved), promise;
  }, sql.begin = (options_or_fn, fn) => {
    if (pool.closed)
      return @Promise.@reject(pool.connectionClosedError());
    let callback = fn, options = options_or_fn;
    if (@isCallable(options_or_fn))
      callback = options_or_fn, options = @undefined;
    else if (typeof options_or_fn !== "string")
      return @Promise.@reject(@makeErrorWithCode(119, "options", options_or_fn, "must be a string"));
    if (!@isCallable(callback))
      return @Promise.@reject(@makeErrorWithCode(119, "fn", callback, "must be a function"));
    let { promise, resolve, reject } = @Promise.withResolvers(), useReserved = pool.supportsReservedConnections?.() ?? !0;
    return pool.connect(onTransactionConnected.bind(null, callback, options, resolve, reject, !1, !1), useReserved), promise;
  }, sql.connect = () => {
    if (pool.closed)
      return @Promise.@reject(pool.connectionClosedError());
    if (pool.isConnected())
      return @Promise.@resolve(sql);
    let { resolve, reject, promise } = @Promise.withResolvers(), onConnected = (err, connection) => {
      if (err)
        return reject(err);
      pool.release(connection), resolve(sql);
    };
    return pool.connect(onConnected), promise;
  }, sql.close = async (options) => {
    await pool.close(options);
  }, sql[Symbol.asyncDispose] = () => sql.close(), sql.flush = () => pool.flush(), sql.options = connectionInfo, sql.transaction = sql.begin, sql.distributed = sql.beginDistributed, sql.end = sql.close, sql;
}, lazyDefaultSQL;
function resetDefaultSQL(sql) {
  lazyDefaultSQL = sql;
}
function ensureDefaultSQL() {
  if (!lazyDefaultSQL)
    resetDefaultSQL(SQL(@undefined));
}
var defaultSQLObject = function sql(strings, ...values) {
  if (new.target)
    return SQL(strings);
  if (!lazyDefaultSQL)
    resetDefaultSQL(SQL(@undefined));
  return lazyDefaultSQL(strings, ...values);
};
defaultSQLObject.reserve = (...args) => {
  return ensureDefaultSQL(), lazyDefaultSQL.reserve(...args);
};
defaultSQLObject.array = (...args) => {
  return ensureDefaultSQL(), lazyDefaultSQL.array(...args);
};
defaultSQLObject.commitDistributed = (...args) => {
  return ensureDefaultSQL(), lazyDefaultSQL.commitDistributed(...args);
};
defaultSQLObject.rollbackDistributed = (...args) => {
  return ensureDefaultSQL(), lazyDefaultSQL.rollbackDistributed(...args);
};
defaultSQLObject.distributed = defaultSQLObject.beginDistributed = (...args) => {
  return ensureDefaultSQL(), lazyDefaultSQL.beginDistributed(...args);
};
defaultSQLObject.connect = (...args) => {
  return ensureDefaultSQL(), lazyDefaultSQL.connect(...args);
};
defaultSQLObject.unsafe = (...args) => {
  return ensureDefaultSQL(), lazyDefaultSQL.unsafe(...args);
};
defaultSQLObject.file = (filename, ...args) => {
  return ensureDefaultSQL(), lazyDefaultSQL.file(filename, ...args);
};
defaultSQLObject.transaction = defaultSQLObject.begin = function(...args) {
  return ensureDefaultSQL(), lazyDefaultSQL.begin(...args);
};
defaultSQLObject.end = defaultSQLObject.close = (...args) => {
  return ensureDefaultSQL(), lazyDefaultSQL.close(...args);
};
defaultSQLObject.flush = (...args) => {
  return ensureDefaultSQL(), lazyDefaultSQL.flush(...args);
};
defineProperties(defaultSQLObject, {
  options: {
    get: () => {
      return ensureDefaultSQL(), lazyDefaultSQL.options;
    }
  },
  [Symbol.asyncDispose]: {
    get: () => {
      return ensureDefaultSQL(), lazyDefaultSQL[Symbol.asyncDispose];
    }
  }
});
SQL.SQLError = SQLError;
SQL.PostgresError = PostgresError;
SQL.SQLiteError = SQLiteError;
SQL.MySQLError = MySQLError;
$ = {
  sql: defaultSQLObject,
  default: defaultSQLObject,
  SQL,
  Query,
  postgres: SQL,
  SQLError,
  PostgresError,
  MySQLError,
  SQLiteError
};
return $})

