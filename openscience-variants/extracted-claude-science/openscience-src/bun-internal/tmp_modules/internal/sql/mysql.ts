(function (){"use strict";// build/release/tmp_modules/internal/sql/mysql.ts
var $, { SQLHelper, SSLMode, SQLResultArray, buildDefinedColumnsAndQuery } = @getInternalField(@internalModuleRegistry, 37) || @createInternalModuleById(37), {
  Query,
  SQLQueryFlags,
  symbols: { _strings, _values, _flags, _results, _handle }
} = @getInternalField(@internalModuleRegistry, 36) || @createInternalModuleById(36), { MySQLError } = @getInternalField(@internalModuleRegistry, 33) || @createInternalModuleById(33), {
  createConnection: createMySQLConnection,
  createQuery: createMySQLQuery,
  init: initMySQL
} = @lazy(16);
function wrapError(error) {
  if (Error.isError(error))
    return error;
  return new MySQLError(error.message, error);
}
initMySQL(function onResolveMySQLQuery(query, result, commandTag, count, queries, is_last, last_insert_rowid, affected_rows) {
  if (query[_flags] & SQLQueryFlags.simple) {
    query[_handle].setPendingValue(new SQLResultArray), result.count = count || 0, result.lastInsertRowid = last_insert_rowid, result.affectedRows = affected_rows || 0;
    let last_result = query[_results];
    if (!last_result)
      query[_results] = result;
    else if (last_result instanceof SQLResultArray)
      query[_results] = [last_result, result];
    else
      last_result.push(result);
    if (is_last) {
      if (queries) {
        let queriesIndex = queries.indexOf(query);
        if (queriesIndex !== -1)
          queries.splice(queriesIndex, 1);
      }
      try {
        query.resolve(query[_results]);
      } catch {}
    }
    return;
  }
  if (result.count = count || 0, result.lastInsertRowid = last_insert_rowid, result.affectedRows = affected_rows || 0, queries) {
    let queriesIndex = queries.indexOf(query);
    if (queriesIndex !== -1)
      queries.splice(queriesIndex, 1);
  }
  try {
    query.resolve(result);
  } catch {}
}, function onRejectMySQLQuery(query, reject, queries) {
  if (reject = wrapError(reject), queries) {
    let queriesIndex = queries.indexOf(query);
    if (queriesIndex !== -1)
      queries.splice(queriesIndex, 1);
  }
  try {
    query.reject(reject);
  } catch {}
});
var SQLCommand;
((SQLCommand2) => {
  SQLCommand2[SQLCommand2.insert = 0] = "insert";
  SQLCommand2[SQLCommand2.update = 1] = "update";
  SQLCommand2[SQLCommand2.updateSet = 2] = "updateSet";
  SQLCommand2[SQLCommand2.where = 3] = "where";
  SQLCommand2[SQLCommand2.in = 4] = "in";
  SQLCommand2[SQLCommand2.none = -1] = "none";
})(SQLCommand ||= {});
function commandToString(command) {
  switch (command) {
    case 0 /* insert */:
      return "INSERT";
    case 2 /* updateSet */:
    case 1 /* update */:
      return "UPDATE";
    case 4 /* in */:
    case 3 /* where */:
      return "WHERE";
    default:
      return "";
  }
}
function detectCommand(query) {
  let text = query.toLowerCase().trim(), text_len = text.length, token = "", command = -1 /* none */, quoted = !1;
  for (let i = text_len - 1;i >= 0; i--) {
    let char = text[i];
    switch (char) {
      case " ":
      case `
`:
      case "\t":
      case "\r":
      case "\f":
      case "\v":
        switch (token) {
          case "insert":
            return 0 /* insert */;
          case "update":
            return 1 /* update */;
          case "where":
            return 3 /* where */;
          case "set":
            return 2 /* updateSet */;
          case "in":
            return 4 /* in */;
          default: {
            token = "";
            continue;
          }
        }
      default: {
        if (char === '"') {
          quoted = !quoted;
          continue;
        }
        if (!quoted)
          token = char + token;
      }
    }
  }
  if (token)
    switch (token) {
      case "insert":
        return 0 /* insert */;
      case "update":
        return 1 /* update */;
      case "where":
        return 3 /* where */;
      case "set":
        return 2 /* updateSet */;
      case "in":
      case "any":
      case "all":
        return 4 /* in */;
      default:
        return -1 /* none */;
    }
  return command;
}
function onQueryFinish(onClose) {
  this.queries.delete(onClose), this.adapter.release(this);
}
function closeNT(onClose, err) {
  onClose(err);
}

class PooledMySQLConnection {
  static async createConnection(options, onConnected, onClose) {
    let {
      hostname,
      port,
      username,
      tls,
      query,
      database,
      sslMode,
      idleTimeout = 0,
      connectionTimeout = 30000,
      maxLifetime = 0,
      prepare = !0,
      path
    } = options, password = options.password;
    try {
      if (typeof password === "function")
        password = password();
      if (password && @isPromise(password))
        password = await password;
      return createMySQLConnection(hostname, Number(port), username || "", password || "", database || "", sslMode || SSLMode.disable, tls || null, query || "", path || "", onConnected, onClose, idleTimeout, connectionTimeout, maxLifetime, !prepare);
    } catch (e) {
      return process.nextTick(closeNT, onClose, e), null;
    }
  }
  adapter;
  connection = null;
  state = 0 /* pending */;
  storedError = null;
  queries = /* @__PURE__ */ new Set;
  onFinish = null;
  connectionInfo;
  flags = 0;
  queryCount = 0;
  #onConnected(err, connection) {
    if (err)
      err = wrapError(err);
    else
      this.connection = connection;
    let connectionInfo = this.connectionInfo;
    if (connectionInfo?.onconnect)
      connectionInfo.onconnect(err);
    if (this.storedError = err, !err)
      this.flags |= 1 /* canBeConnected */;
    this.state = err ? 2 /* closed */ : 1 /* connected */;
    let onFinish = this.onFinish;
    if (onFinish) {
      if (this.queryCount = 0, this.flags &= -3, this.flags &= -5, err)
        onFinish(err);
      else
        this.connection?.close();
      return;
    }
    this.adapter.release(this, !0);
  }
  #onClose(err) {
    if (err)
      err = wrapError(err);
    let connectionInfo = this.connectionInfo;
    if (connectionInfo?.onclose)
      connectionInfo.onclose(err);
    this.state = 2 /* closed */, this.connection = null, this.storedError = err, this.adapter.readyConnections.delete(this);
    let queries = new Set(this.queries);
    this.queries?.clear?.(), this.queryCount = 0, this.flags &= -3;
    for (let onClose of queries)
      onClose(err);
    let onFinish = this.onFinish;
    if (onFinish)
      onFinish(err);
    this.adapter.release(this, !0);
  }
  constructor(connectionInfo, adapter) {
    this.state = 0 /* pending */, this.adapter = adapter, this.connectionInfo = connectionInfo, this.#startConnection();
  }
  #startConnection() {
    PooledMySQLConnection.createConnection(this.connectionInfo, this.#onConnected.bind(this), this.#onClose.bind(this));
  }
  onClose(onClose) {
    this.queries.add(onClose);
  }
  bindQuery(query, onClose) {
    this.queries.add(onClose), query.finally(onQueryFinish.bind(this, onClose));
  }
  #doRetry() {
    if (this.adapter.closed)
      return;
    this.storedError = null, this.state = 0 /* pending */, this.#startConnection();
  }
  close() {
    try {
      if (this.state === 1 /* connected */)
        this.connection?.close();
    } catch {}
  }
  flush() {
    this.connection?.flush();
  }
  retry() {
    if (this.adapter.closed)
      return !1;
    if (this.flags & 1 /* canBeConnected */)
      this.#doRetry();
    else
      switch (this.storedError?.code) {
        case "ERR_MYSQL_PASSWORD_REQUIRED":
        case "ERR_MYSQL_MISSING_AUTH_DATA":
        case "ERR_MYSQL_FAILED_TO_ENCRYPT_PASSWORD":
        case "ERR_MYSQL_INVALID_PUBLIC_KEY":
        case "ERR_MYSQL_UNSUPPORTED_PROTOCOL_VERSION":
        case "ERR_MYSQL_UNSUPPORTED_AUTH_PLUGIN":
        case "ERR_MYSQL_AUTHENTICATION_FAILED":
          return !1;
        default:
          this.#doRetry();
      }
    return !0;
  }
}

class MySQLAdapter {
  connectionInfo;
  connections;
  readyConnections = /* @__PURE__ */ new Set;
  waitingQueue = [];
  reservedQueue = [];
  poolStarted = !1;
  closed = !1;
  totalQueries = 0;
  onAllQueriesFinished = null;
  constructor(connectionInfo) {
    this.connectionInfo = connectionInfo, this.connections = new @Array(connectionInfo.max);
  }
  escapeIdentifier(str) {
    return "`" + str.replaceAll("`", "``") + "`";
  }
  connectionClosedError() {
    return new MySQLError("Connection closed", {
      code: "ERR_MYSQL_CONNECTION_CLOSED"
    });
  }
  notTaggedCallError() {
    return new MySQLError("Query not called as a tagged template literal", {
      code: "ERR_MYSQL_NOT_TAGGED_CALL"
    });
  }
  queryCancelledError() {
    return new MySQLError("Query cancelled", {
      code: "ERR_MYSQL_QUERY_CANCELLED"
    });
  }
  invalidTransactionStateError(message) {
    return new MySQLError(message, {
      code: "ERR_MYSQL_INVALID_TRANSACTION_STATE"
    });
  }
  supportsReservedConnections() {
    return !0;
  }
  getConnectionForQuery(pooledConnection) {
    return pooledConnection.connection;
  }
  attachConnectionCloseHandler(connection, handler) {
    if (connection.onClose)
      connection.onClose(handler);
  }
  detachConnectionCloseHandler(connection, handler) {
    if (connection.queries)
      connection.queries.delete(handler);
  }
  array(_values2, _typeNameOrID) {
    throw Error("MySQL doesn't support arrays");
  }
  getTransactionCommands(options) {
    let BEGIN = "START TRANSACTION";
    if (options)
      BEGIN = `START TRANSACTION ${options}`;
    return {
      BEGIN,
      COMMIT: "COMMIT",
      ROLLBACK: "ROLLBACK",
      SAVEPOINT: "SAVEPOINT",
      RELEASE_SAVEPOINT: "RELEASE SAVEPOINT",
      ROLLBACK_TO_SAVEPOINT: "ROLLBACK TO SAVEPOINT"
    };
  }
  getDistributedTransactionCommands(name) {
    if (!this.validateDistributedTransactionName(name).valid)
      return null;
    return {
      BEGIN: `XA START '${name}'`,
      COMMIT: `XA PREPARE '${name}'`,
      ROLLBACK: `XA ROLLBACK '${name}'`,
      SAVEPOINT: "SAVEPOINT",
      RELEASE_SAVEPOINT: "RELEASE SAVEPOINT",
      ROLLBACK_TO_SAVEPOINT: "ROLLBACK TO SAVEPOINT",
      BEFORE_COMMIT_OR_ROLLBACK: `XA END '${name}'`
    };
  }
  validateTransactionOptions(_options) {
    return { valid: !0 };
  }
  validateDistributedTransactionName(name) {
    if (name.indexOf("'") !== -1)
      return {
        valid: !1,
        error: "Distributed transaction name cannot contain single quotes."
      };
    return { valid: !0 };
  }
  getCommitDistributedSQL(name) {
    let validation = this.validateDistributedTransactionName(name);
    if (!validation.valid)
      throw Error(validation.error);
    return `XA COMMIT '${name}'`;
  }
  getRollbackDistributedSQL(name) {
    let validation = this.validateDistributedTransactionName(name);
    if (!validation.valid)
      throw Error(validation.error);
    return `XA ROLLBACK '${name}'`;
  }
  createQueryHandle(sql, values, flags) {
    if (!(flags & SQLQueryFlags.allowUnsafeTransaction)) {
      if (this.connectionInfo.max !== 1) {
        let upperCaseSqlString = sql.toUpperCase().trim();
        if (upperCaseSqlString.startsWith("BEGIN") || upperCaseSqlString.startsWith("START TRANSACTION"))
          throw new MySQLError("Only use sql.begin, sql.reserved or max: 1", {
            code: "ERR_MYSQL_UNSAFE_TRANSACTION"
          });
      }
    }
    return createMySQLQuery(sql, values, new SQLResultArray, @undefined, !!(flags & SQLQueryFlags.bigint), !!(flags & SQLQueryFlags.simple));
  }
  maxDistribution() {
    if (!this.waitingQueue.length)
      return 0;
    let result = Math.ceil((this.waitingQueue.length + this.totalQueries) / this.connections.length);
    return result ? result : 1;
  }
  flushConcurrentQueries() {
    let maxDistribution = this.maxDistribution();
    if (maxDistribution === 0)
      return;
    while (!0) {
      let nonReservedConnections = @Array.from(this.readyConnections).filter((c) => !(c.flags & 4 /* preReserved */) && c.queryCount < maxDistribution);
      if (nonReservedConnections.length === 0)
        return;
      let orderedConnections = nonReservedConnections.sort((a, b) => a.queryCount - b.queryCount);
      for (let connection of orderedConnections) {
        let pending = this.waitingQueue.shift();
        if (!pending)
          return;
        connection.queryCount++, this.totalQueries++, pending(null, connection);
      }
    }
  }
  release(connection, connectingEvent = !1) {
    if (!connectingEvent)
      connection.queryCount--, this.totalQueries--;
    let currentQueryCount = connection.queryCount;
    if (currentQueryCount == 0)
      connection.flags &= -3, connection.flags &= -5;
    if (this.onAllQueriesFinished) {
      if (!this.hasPendingQueries())
        this.onAllQueriesFinished();
    }
    if (connection.state !== 1 /* connected */) {
      if (connection.storedError) {
        if (this.hasConnectionsAvailable())
          return;
        let waitingQueue = this.waitingQueue, reservedQueue = this.reservedQueue;
        this.waitingQueue = [], this.reservedQueue = [];
        for (let pending of waitingQueue)
          pending(connection.storedError, connection);
        for (let pending of reservedQueue)
          pending(connection.storedError, connection);
      }
      return;
    }
    if (currentQueryCount == 0) {
      let pendingReserved = this.reservedQueue.shift();
      if (pendingReserved) {
        connection.flags |= 2 /* reserved */, connection.queryCount++, this.totalQueries++, pendingReserved(connection.storedError, connection);
        return;
      }
    }
    this.readyConnections.add(connection), this.flushConcurrentQueries();
  }
  hasConnectionsAvailable() {
    if (this.readyConnections.size > 0)
      return !0;
    if (this.poolStarted) {
      let pollSize = this.connections.length;
      for (let i = 0;i < pollSize; i++)
        if (this.connections[i].state !== 2 /* closed */)
          return !0;
    }
    return !1;
  }
  hasPendingQueries() {
    if (this.waitingQueue.length > 0 || this.reservedQueue.length > 0)
      return !0;
    if (this.poolStarted)
      return this.totalQueries > 0;
    return !1;
  }
  isConnected() {
    if (this.readyConnections.size > 0)
      return !0;
    if (this.poolStarted) {
      let pollSize = this.connections.length;
      for (let i = 0;i < pollSize; i++)
        if (this.connections[i].state === 1 /* connected */)
          return !0;
    }
    return !1;
  }
  flush() {
    if (this.closed)
      return;
    if (this.poolStarted) {
      let pollSize = this.connections.length;
      for (let i = 0;i < pollSize; i++) {
        let connection = this.connections[i];
        if (connection.state === 1 /* connected */)
          connection.connection?.flush();
      }
    }
  }
  async#close() {
    let pending;
    while (pending = this.waitingQueue.shift())
      pending(this.connectionClosedError(), null);
    while (this.reservedQueue.length > 0) {
      let pendingReserved = this.reservedQueue.shift();
      if (pendingReserved)
        pendingReserved(this.connectionClosedError(), null);
    }
    let promises = [];
    if (this.poolStarted) {
      this.poolStarted = !1;
      let pollSize = this.connections.length;
      for (let i = 0;i < pollSize; i++) {
        let connection = this.connections[i];
        switch (connection.state) {
          case 0 /* pending */:
            {
              let { promise, resolve } = @Promise.withResolvers();
              connection.onFinish = resolve, promises.push(promise), connection.connection?.close();
            }
            break;
          case 1 /* connected */:
            {
              let { promise, resolve } = @Promise.withResolvers();
              connection.onFinish = resolve, promises.push(promise), connection.connection?.close();
            }
            break;
        }
        this.connections[i] = null;
      }
    }
    return this.readyConnections.clear(), this.waitingQueue.length = 0, @Promise.all(promises);
  }
  async close(options) {
    if (this.closed)
      return;
    let timeout = options?.timeout;
    if (timeout) {
      if (timeout = Number(timeout), timeout > 2147483648 || timeout < 0 || timeout !== timeout)
        throw @makeErrorWithCode(119, "options.timeout", timeout, "must be a non-negative integer less than 2^31");
      if (this.closed = !0, timeout === 0 || !this.hasPendingQueries()) {
        await this.#close();
        return;
      }
      let { promise, resolve } = @Promise.withResolvers(), timer = setTimeout(() => {
        this.#close().finally(resolve);
      }, timeout * 1000);
      return timer.unref(), this.onAllQueriesFinished = () => {
        clearTimeout(timer), this.#close().finally(resolve);
      }, promise;
    } else {
      if (this.closed = !0, !this.hasPendingQueries()) {
        await this.#close();
        return;
      }
      let { promise, resolve } = @Promise.withResolvers();
      return this.onAllQueriesFinished = () => {
        this.#close().finally(resolve);
      }, promise;
    }
  }
  connect(onConnected, reserved = !1) {
    if (this.closed)
      return onConnected(this.connectionClosedError(), null);
    if (this.readyConnections.size === 0) {
      let retry_in_progress = !1, all_closed = !0, storedError = null;
      if (this.poolStarted) {
        let pollSize2 = this.connections.length;
        for (let i = 0;i < pollSize2; i++) {
          let connection = this.connections[i];
          if (connection.state === 2 /* closed */)
            if (connection.retry()) {
              if (!retry_in_progress)
                if (retry_in_progress = !0, reserved)
                  this.reservedQueue.push(onConnected);
                else
                  this.waitingQueue.push(onConnected);
            } else
              storedError = connection.storedError;
          else
            all_closed = !1;
        }
        if (!all_closed && !retry_in_progress)
          if (reserved)
            this.reservedQueue.push(onConnected);
          else
            this.waitingQueue.push(onConnected);
        else if (!retry_in_progress)
          onConnected(storedError ?? this.connectionClosedError(), null);
        return;
      }
      if (reserved)
        this.reservedQueue.push(onConnected);
      else
        this.waitingQueue.push(onConnected);
      this.poolStarted = !0;
      let pollSize = this.connections.length, firstConnection = new PooledMySQLConnection(this.connectionInfo, this);
      if (this.connections[0] = firstConnection, reserved)
        firstConnection.flags |= 4 /* preReserved */;
      for (let i = 1;i < pollSize; i++)
        this.connections[i] = new PooledMySQLConnection(this.connectionInfo, this);
      return;
    }
    if (reserved) {
      let connectionWithLeastQueries = null, leastQueries = @Infinity;
      for (let connection of this.readyConnections) {
        if (connection.flags & 4 /* preReserved */ || connection.flags & 2 /* reserved */)
          continue;
        let queryCount = connection.queryCount;
        if (queryCount > 0) {
          if (queryCount < leastQueries)
            leastQueries = queryCount, connectionWithLeastQueries = connection;
          continue;
        }
        connection.flags |= 2 /* reserved */, connection.queryCount++, this.totalQueries++, this.readyConnections.delete(connection), onConnected(null, connection);
        return;
      }
      if (connectionWithLeastQueries)
        connectionWithLeastQueries.flags |= 4 /* preReserved */;
      this.reservedQueue.push(onConnected);
    } else
      this.waitingQueue.push(onConnected), this.flushConcurrentQueries();
  }
  normalizeQuery(strings, values, binding_idx = 1) {
    if (typeof strings === "string")
      return [strings, values || []];
    if (!@isArray(strings))
      throw SyntaxError("Invalid query: SQL Fragment cannot be executed or was misused");
    let str_len = strings.length;
    if (str_len === 0)
      return ["", []];
    let binding_values = [], query = "";
    for (let i = 0;i < str_len; i++) {
      let string = strings[i];
      if (typeof string === "string") {
        if (query += string, values.length > i) {
          let value = values[i];
          if (value instanceof Query) {
            let q = value, [sub_query, sub_values] = this.normalizeQuery(q[_strings], q[_values], binding_idx);
            query += sub_query;
            for (let j = 0;j < sub_values.length; j++)
              binding_values.push(sub_values[j]);
            binding_idx += sub_values.length;
          } else if (value instanceof SQLHelper) {
            let command = detectCommand(query);
            if (command === -1 /* none */ || command === 3 /* where */)
              throw SyntaxError("Helpers are only allowed for INSERT, UPDATE and IN commands");
            let { columns, value: items } = value, columnCount = columns.length;
            if (columnCount === 0 && command !== 4 /* in */)
              throw SyntaxError(`Cannot ${commandToString(command)} with no columns`);
            let lastColumnIndex = columns.length - 1;
            if (command === 0 /* insert */) {
              let { definedColumns, columnsSql } = buildDefinedColumnsAndQuery(columns, items, this.escapeIdentifier.bind(this)), definedColumnCount = definedColumns.length;
              if (definedColumnCount === 0)
                throw SyntaxError("Insert needs to have at least one column with a defined value");
              let lastDefinedColumnIndex = definedColumnCount - 1;
              if (query += columnsSql, @isArray(items)) {
                let itemsCount = items.length, lastItemIndex = itemsCount - 1;
                for (let j = 0;j < itemsCount; j++) {
                  query += "(";
                  let item = items[j];
                  for (let k = 0;k < definedColumnCount; k++) {
                    let column = definedColumns[k], columnValue = item[column];
                    query += `?${k < lastDefinedColumnIndex ? ", " : ""}`, binding_values.push(typeof columnValue > "u" ? null : columnValue);
                  }
                  if (j < lastItemIndex)
                    query += "),";
                  else
                    query += ") ";
                }
              } else {
                query += "(";
                let item = items;
                for (let j = 0;j < definedColumnCount; j++) {
                  let column = definedColumns[j], columnValue = item[column];
                  query += `?${j < lastDefinedColumnIndex ? ", " : ""}`, binding_values.push(columnValue);
                }
                query += ") ";
              }
            } else if (command === 4 /* in */) {
              if (!@isArray(items))
                throw SyntaxError("An array of values is required for WHERE IN helper");
              let itemsCount = items.length, lastItemIndex = itemsCount - 1;
              query += "(";
              for (let j = 0;j < itemsCount; j++)
                if (query += `?${j < lastItemIndex ? ", " : ""}`, columnCount > 0) {
                  if (columnCount > 1)
                    throw SyntaxError("Cannot use WHERE IN helper with multiple columns");
                  let value2 = items[j];
                  if (typeof value2 > "u")
                    binding_values.push(null);
                  else {
                    let value_from_key = value2[columns[0]];
                    if (typeof value_from_key > "u")
                      binding_values.push(null);
                    else
                      binding_values.push(value_from_key);
                  }
                } else {
                  let value2 = items[j];
                  if (typeof value2 > "u")
                    binding_values.push(null);
                  else
                    binding_values.push(value2);
                }
              query += ") ";
            } else {
              let item;
              if (@isArray(items)) {
                if (items.length > 1)
                  throw SyntaxError("Cannot use array of objects for UPDATE");
                item = items[0];
              } else
                item = items;
              let isUpsert = query.trimEnd().endsWith("ON DUPLICATE KEY UPDATE");
              if (command === 1 /* update */ && !isUpsert)
                query += " SET ";
              let hasValues = !1;
              for (let i2 = 0;i2 < columnCount; i2++) {
                let column = columns[i2], columnValue = item[column];
                if (typeof columnValue > "u")
                  continue;
                hasValues = !0, query += `${this.escapeIdentifier(column)} = ?${i2 < lastColumnIndex ? ", " : ""}`, binding_values.push(columnValue);
              }
              if (query.endsWith(", "))
                query = query.substring(0, query.length - 2);
              if (!hasValues)
                throw SyntaxError("Update needs to have at least one column");
              query += " ";
            }
          } else if (query += "? ", typeof value > "u")
            binding_values.push(null);
          else
            binding_values.push(value);
        }
      } else
        throw SyntaxError("Invalid query: SQL Fragment cannot be executed or was misused");
    }
    return [query, binding_values];
  }
}
$ = {
  MySQLAdapter,
  commandToString,
  detectCommand,
  SQLCommand
};
return $})

