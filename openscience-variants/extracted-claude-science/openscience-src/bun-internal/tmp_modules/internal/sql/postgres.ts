(function (){"use strict";// build/release/tmp_modules/internal/sql/postgres.ts
var $, {
  SQLHelper,
  SSLMode,
  SQLResultArray,
  SQLArrayParameter,
  buildDefinedColumnsAndQuery
} = @getInternalField(@internalModuleRegistry, 37) || @createInternalModuleById(37), {
  Query,
  SQLQueryFlags,
  symbols: { _strings, _values, _flags, _results, _handle }
} = @getInternalField(@internalModuleRegistry, 36) || @createInternalModuleById(36);
function isTypedArray(value) {
  return @ArrayBuffer.isView(value) && !@Buffer.isBuffer(value);
}
var { PostgresError } = @getInternalField(@internalModuleRegistry, 33) || @createInternalModuleById(33), {
  createConnection: createPostgresConnection,
  createQuery: createPostgresQuery,
  init: initPostgres
} = @lazy(17), cmds = ["", "INSERT", "DELETE", "UPDATE", "MERGE", "SELECT", "MOVE", "FETCH", "COPY"], escapeBackslash = /\\/g, escapeQuote = /"/g;
function arrayEscape(value) {
  return value.replace(escapeBackslash, "\\\\").replace(escapeQuote, "\\\"");
}
var POSTGRES_ARRAY_TYPES = {
  1000: "BOOLEAN",
  1001: "BYTEA",
  1002: "CHAR",
  1003: "NAME",
  1009: "TEXT",
  1014: "CHAR",
  1015: "VARCHAR",
  1005: "SMALLINT",
  1006: "INT2VECTOR",
  1007: "INTEGER",
  1016: "BIGINT",
  1021: "REAL",
  1022: "DOUBLE PRECISION",
  1231: "NUMERIC",
  791: "MONEY",
  1028: "OID",
  1010: "TID",
  1011: "XID",
  1012: "CID",
  199: "JSON",
  3802: "JSONB",
  3807: "JSONB",
  4072: "JSONPATH",
  4073: "JSONPATH",
  143: "XML",
  1017: "POINT",
  1018: "LSEG",
  1019: "PATH",
  1020: "BOX",
  1027: "POLYGON",
  629: "LINE",
  719: "CIRCLE",
  651: "CIDR",
  1040: "MACADDR",
  1041: "INET",
  775: "MACADDR8",
  1182: "DATE",
  1183: "TIME",
  1115: "TIMESTAMP",
  1185: "TIMESTAMPTZ",
  1187: "INTERVAL",
  1270: "TIMETZ",
  1561: "BIT",
  1563: "VARBIT",
  1034: "ACLITEM",
  12052: "PG_DATABASE",
  10052: "PG_DATABASE"
};
function isPostgresNumericType(type) {
  switch (type) {
    case "BIT":
    case "VARBIT":
    case "SMALLINT":
    case "INT2VECTOR":
    case "INTEGER":
    case "INT":
    case "BIGINT":
    case "REAL":
    case "DOUBLE PRECISION":
    case "NUMERIC":
    case "MONEY":
      return !0;
    default:
      return !1;
  }
}
function isPostgresJsonType(type) {
  switch (type) {
    case "JSON":
    case "JSONB":
      return !0;
    default:
      return !1;
  }
}
function getPostgresArrayType(typeId) {
  return POSTGRES_ARRAY_TYPES[typeId] || null;
}
function arrayValueSerializer(type, is_numeric, is_json, value) {
  if (@isArray(value) || isTypedArray(value)) {
    if (!value.length)
      return "{}";
    let delimiter = type === "BOX" ? ";" : ",";
    return `{${value.map(arrayValueSerializer.bind(this, type, is_numeric, is_json)).join(delimiter)}}`;
  }
  switch (typeof value) {
    case "undefined":
      return "null";
    case "string":
      if (is_json)
        return `"${arrayEscape(JSON.stringify(value))}"`;
      return `"${arrayEscape(value)}"`;
    case "bigint":
    case "number":
      if (is_numeric || is_json)
        return "" + value;
      return `"${value}"`;
    case "boolean":
      switch (type) {
        case "BOOLEAN":
          return value === !0 ? "t" : "f";
        case "JSON":
        case "JSONB":
          return value === !0 ? "true" : "false";
        default:
          if (is_numeric)
            return "" + (value ? 1 : 0);
          return value === !0 ? '"true"' : '"false"';
      }
    default:
      if (value instanceof Date) {
        let isoValue = value.toISOString();
        if (is_json)
          return `"${arrayEscape(JSON.stringify(isoValue))}"`;
        return `"${arrayEscape(isoValue)}"`;
      }
      if (@Buffer.isBuffer(value)) {
        let hexValue = value.toString("hex");
        if (type === "BYTEA")
          return `"\\x${arrayEscape(hexValue)}"`;
        if (is_json)
          return `"${arrayEscape(JSON.stringify(hexValue))}"`;
        return `"${arrayEscape(hexValue)}"`;
      }
      return `"${arrayEscape(JSON.stringify(value))}"`;
  }
}
function getArrayType(typeNameOrID = @undefined) {
  let typeOfType = typeof typeNameOrID;
  if (typeOfType === "number")
    return getPostgresArrayType(typeNameOrID) ?? "JSON";
  if (typeOfType === "string")
    return typeNameOrID?.toUpperCase();
  return "JSON";
}
function serializeArray(values, type) {
  if (!@isArray(values) && !isTypedArray(values))
    return values;
  if (!values.length)
    return "{}";
  let delimiter = type === "BOX" ? ";" : ",";
  return `{${values.map(arrayValueSerializer.bind(this, type, isPostgresNumericType(type), isPostgresJsonType(type))).join(delimiter)}}`;
}
function wrapPostgresError(error) {
  if (Error.isError(error))
    return error;
  return new PostgresError(error.message, error);
}
initPostgres(function onResolvePostgresQuery(query, result, commandTag, count, queries, is_last) {
  if (is_last) {
    if (queries) {
      let queriesIndex = queries.indexOf(query);
      if (queriesIndex !== -1)
        queries.splice(queriesIndex, 1);
    }
    try {
      query.resolve(query[_results]);
    } catch {}
    return;
  }
  if (query[_handle].setPendingValue(new SQLResultArray), typeof commandTag === "string") {
    if (commandTag.length > 0)
      result.command = commandTag;
  } else
    result.command = cmds[commandTag];
  result.count = count || 0;
  let last_result = query[_results];
  if (!last_result)
    query[_results] = result;
  else if (last_result instanceof SQLResultArray)
    query[_results] = [last_result, result];
  else
    last_result.push(result);
  return;
}, function onRejectPostgresQuery(query, reject, queries) {
  if (reject = wrapPostgresError(reject), queries) {
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
        return 4 /* in */;
      default:
        return -1 /* none */;
    }
  return command;
}
function onQueryFinish(onClose) {
  this.queries.delete(onClose), this.adapter.release(this);
}

class PooledPostgresConnection {
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
      return createPostgresConnection(hostname, Number(port), username || "", password || "", database || "", sslMode || SSLMode.disable, tls || null, query || "", path || "", onConnected, onClose, idleTimeout, connectionTimeout, maxLifetime, !prepare);
    } catch (e) {
      return onClose(e), null;
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
  #onConnected(err, _) {
    if (err)
      err = wrapPostgresError(err);
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
      err = wrapPostgresError(err);
    let connectionInfo = this.connectionInfo;
    if (connectionInfo?.onclose)
      connectionInfo.onclose(err);
    this.state = 2 /* closed */, this.connection = null, this.storedError = err, this.adapter.readyConnections?.delete(this);
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
  async#startConnection() {
    this.connection = await PooledPostgresConnection.createConnection(this.connectionInfo, this.#onConnected.bind(this), this.#onClose.bind(this));
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
        case "ERR_POSTGRES_UNSUPPORTED_AUTHENTICATION_METHOD":
        case "ERR_POSTGRES_UNKNOWN_AUTHENTICATION_METHOD":
        case "ERR_POSTGRES_TLS_NOT_AVAILABLE":
        case "ERR_POSTGRES_TLS_UPGRADE_FAILED":
        case "ERR_POSTGRES_INVALID_SERVER_SIGNATURE":
        case "ERR_POSTGRES_INVALID_SERVER_KEY":
        case "ERR_POSTGRES_AUTHENTICATION_FAILED_PBKDF2":
          return !1;
        default:
          this.#doRetry();
      }
    return !0;
  }
}

class PostgresAdapter {
  connectionInfo;
  connections;
  readyConnections;
  waitingQueue = [];
  reservedQueue = [];
  poolStarted = !1;
  closed = !1;
  totalQueries = 0;
  onAllQueriesFinished = null;
  constructor(connectionInfo) {
    this.connectionInfo = connectionInfo, this.connections = new @Array(connectionInfo.max), this.readyConnections = /* @__PURE__ */ new Set;
  }
  escapeIdentifier(str) {
    return '"' + str.replaceAll('"', '""').replaceAll(".", '"."') + '"';
  }
  connectionClosedError() {
    return new PostgresError("Connection closed", {
      code: "ERR_POSTGRES_CONNECTION_CLOSED"
    });
  }
  notTaggedCallError() {
    return new PostgresError("Query not called as a tagged template literal", {
      code: "ERR_POSTGRES_NOT_TAGGED_CALL"
    });
  }
  queryCancelledError() {
    return new PostgresError("Query cancelled", {
      code: "ERR_POSTGRES_QUERY_CANCELLED"
    });
  }
  invalidTransactionStateError(message) {
    return new PostgresError(message, {
      code: "ERR_POSTGRES_INVALID_TRANSACTION_STATE"
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
  array(values, typeNameOrID) {
    let arrayType = getArrayType(typeNameOrID);
    return new SQLArrayParameter(serializeArray(values, arrayType), arrayType);
  }
  getTransactionCommands(options) {
    let BEGIN = "BEGIN";
    if (options)
      BEGIN = `BEGIN ${options}`;
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
      BEGIN: "BEGIN",
      COMMIT: `PREPARE TRANSACTION '${name}'`,
      ROLLBACK: "ROLLBACK",
      SAVEPOINT: "SAVEPOINT",
      RELEASE_SAVEPOINT: "RELEASE SAVEPOINT",
      ROLLBACK_TO_SAVEPOINT: "ROLLBACK TO SAVEPOINT",
      BEFORE_COMMIT_OR_ROLLBACK: null
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
    return `COMMIT PREPARED '${name}'`;
  }
  getRollbackDistributedSQL(name) {
    let validation = this.validateDistributedTransactionName(name);
    if (!validation.valid)
      throw Error(validation.error);
    return `ROLLBACK PREPARED '${name}'`;
  }
  createQueryHandle(sql, values, flags) {
    if (!(flags & SQLQueryFlags.allowUnsafeTransaction)) {
      if (this.connectionInfo.max !== 1) {
        let upperCaseSqlString = sql.toUpperCase().trim();
        if (upperCaseSqlString.startsWith("BEGIN") || upperCaseSqlString.startsWith("START TRANSACTION"))
          throw new PostgresError("Only use sql.begin, sql.reserved or max: 1", {
            code: "ERR_POSTGRES_UNSAFE_TRANSACTION"
          });
      }
    }
    return createPostgresQuery(sql, values, new SQLResultArray, @undefined, !!(flags & SQLQueryFlags.bigint), !!(flags & SQLQueryFlags.simple));
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
      let nonReservedConnections = @Array.from(this.readyConnections || []).filter((c) => !(c.flags & 4 /* preReserved */) && c.queryCount < maxDistribution);
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
    if (this.readyConnections?.size > 0)
      return !0;
    if (this.poolStarted) {
      let pollSize = this.connections.length;
      for (let i = 0;i < pollSize; i++) {
        let connection = this.connections[i];
        if (connection && connection.state !== 2 /* closed */)
          return !0;
      }
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
    if (this.readyConnections?.size > 0)
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
    if (!this.readyConnections || this.readyConnections.size === 0) {
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
      let pollSize = this.connections.length, firstConnection = new PooledPostgresConnection(this.connectionInfo, this);
      if (this.connections[0] = firstConnection, reserved)
        firstConnection.flags |= 4 /* preReserved */;
      for (let i = 1;i < pollSize; i++)
        this.connections[i] = new PooledPostgresConnection(this.connectionInfo, this);
      return;
    }
    if (reserved) {
      let connectionWithLeastQueries = null, leastQueries = @Infinity;
      for (let connection of this.readyConnections || []) {
        if (connection.flags & 4 /* preReserved */ || connection.flags & 2 /* reserved */)
          continue;
        let queryCount = connection.queryCount;
        if (queryCount > 0) {
          if (queryCount < leastQueries)
            leastQueries = queryCount, connectionWithLeastQueries = connection;
          continue;
        }
        connection.flags |= 2 /* reserved */, connection.queryCount++, this.totalQueries++, this.readyConnections?.delete(connection), onConnected(null, connection);
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
                    query += `$${binding_idx++}${k < lastDefinedColumnIndex ? ", " : ""}`, binding_values.push(typeof columnValue > "u" ? null : columnValue);
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
                  query += `$${binding_idx++}${j < lastDefinedColumnIndex ? ", " : ""}`, binding_values.push(columnValue);
                }
                query += ") ";
              }
            } else if (command === 4 /* in */) {
              if (!@isArray(items))
                throw SyntaxError("An array of values is required for WHERE IN helper");
              let itemsCount = items.length, lastItemIndex = itemsCount - 1;
              query += "(";
              for (let j = 0;j < itemsCount; j++)
                if (query += `$${binding_idx++}${j < lastItemIndex ? ", " : ""}`, columnCount > 0) {
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
              if (command === 1 /* update */)
                query += " SET ";
              let hasValues = !1;
              for (let i2 = 0;i2 < columnCount; i2++) {
                let column = columns[i2], columnValue = item[column];
                if (typeof columnValue > "u")
                  continue;
                hasValues = !0, query += `${this.escapeIdentifier(column)} = $${binding_idx++}${i2 < lastColumnIndex ? ", " : ""}`, binding_values.push(columnValue);
              }
              if (query.endsWith(", "))
                query = query.substring(0, query.length - 2);
              if (!hasValues)
                throw SyntaxError("Update needs to have at least one column");
              query += " ";
            }
          } else if (value instanceof SQLArrayParameter)
            query += `$${binding_idx++}::${value.arrayType}[] `, binding_values.push(value.serializedValues);
          else if (query += `$${binding_idx++} `, typeof value > "u")
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
  PostgresAdapter,
  SQLCommand,
  commandToString,
  detectCommand
};
return $})

