(function (){"use strict";// build/release/tmp_modules/internal/sql/sqlite.ts
var $, { SQLHelper, SQLResultArray, buildDefinedColumnsAndQuery } = @getInternalField(@internalModuleRegistry, 37) || @createInternalModuleById(37), {
  Query,
  SQLQueryResultMode,
  symbols: { _strings, _values }
} = @getInternalField(@internalModuleRegistry, 36) || @createInternalModuleById(36), { SQLiteError } = @getInternalField(@internalModuleRegistry, 33) || @createInternalModuleById(33), lazySQLiteModule;
function getSQLiteModule() {
  if (!lazySQLiteModule)
    lazySQLiteModule = @getInternalField(@internalModuleRegistry, 2) || @createInternalModuleById(2);
  return lazySQLiteModule;
}
var SQLCommand;
((SQLCommand2) => {
  SQLCommand2[SQLCommand2.insert = 0] = "insert";
  SQLCommand2[SQLCommand2.update = 1] = "update";
  SQLCommand2[SQLCommand2.updateSet = 2] = "updateSet";
  SQLCommand2[SQLCommand2.where = 3] = "where";
  SQLCommand2[SQLCommand2.in = 4] = "in";
  SQLCommand2[SQLCommand2.none = -1] = "none";
})(SQLCommand ||= {});
function commandToString(command, lastToken) {
  switch (command) {
    case 0 /* insert */:
      return "INSERT";
    case 2 /* updateSet */:
    case 1 /* update */:
      return "UPDATE";
    case 4 /* in */:
    case 3 /* where */:
      if (lastToken)
        return lastToken;
      return "WHERE";
    default:
      if (lastToken)
        return lastToken;
      return "";
  }
}
function parseSQLQuery(query, partial = !1) {
  let text = query.toUpperCase().trim(), text_len = text.length, token = "", command = -1 /* none */, lastToken = "", canReturnRows = !1, quoted = !1;
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
          case "INSERT": {
            if (command === -1 /* none */)
              command = 0 /* insert */;
            if (lastToken = token, token = "", partial)
              return { command: 0 /* insert */, lastToken, canReturnRows };
            continue;
          }
          case "UPDATE": {
            if (command === -1 /* none */)
              command = 1 /* update */;
            if (lastToken = token, token = "", partial)
              return { command: 1 /* update */, lastToken, canReturnRows };
            continue;
          }
          case "WHERE": {
            if (command === -1 /* none */)
              command = 3 /* where */;
            if (lastToken = token, token = "", partial)
              return { command: 3 /* where */, lastToken, canReturnRows };
            continue;
          }
          case "SET": {
            if (command === -1 /* none */)
              command = 2 /* updateSet */;
            if (lastToken = token, token = "", partial)
              return { command: 2 /* updateSet */, lastToken, canReturnRows };
            continue;
          }
          case "IN": {
            if (command === -1 /* none */)
              command = 4 /* in */;
            if (lastToken = token, token = "", partial)
              return { command: 4 /* in */, lastToken, canReturnRows };
            continue;
          }
          case "SELECT":
          case "PRAGMA":
          case "WITH":
          case "EXPLAIN":
          case "RETURNING": {
            lastToken = token, canReturnRows = !0, token = "";
            continue;
          }
          default: {
            lastToken = token, token = "";
            continue;
          }
        }
      default: {
        if (char === '"' || char === "'") {
          if (quoted === char)
            quoted = !1;
          else
            quoted = char;
          continue;
        }
        if (!quoted)
          token = char + token;
      }
    }
  }
  if (token)
    switch (lastToken = token, token) {
      case "INSERT":
        if (command === -1 /* none */)
          command = 0 /* insert */;
        break;
      case "UPDATE":
        if (command === -1 /* none */)
          command = 1 /* update */;
        break;
      case "WHERE":
        if (command === -1 /* none */)
          command = 3 /* where */;
        break;
      case "SET":
        if (command === -1 /* none */)
          command = 2 /* updateSet */;
        break;
      case "IN":
        if (command === -1 /* none */)
          command = 4 /* in */;
        break;
      case "SELECT":
      case "PRAGMA":
      case "WITH":
      case "EXPLAIN":
      case "RETURNING": {
        canReturnRows = !0;
        break;
      }
      default:
        command = -1 /* none */;
        break;
    }
  return { command, lastToken, canReturnRows };
}

class SQLiteQueryHandle {
  mode = SQLQueryResultMode.objects;
  sql;
  values;
  parsedInfo;
  constructor(sql, values) {
    this.sql = sql, this.values = values, this.parsedInfo = parseSQLQuery(sql);
  }
  setMode(mode) {
    this.mode = mode;
  }
  run(db, query) {
    if (!db)
      throw new SQLiteError("SQLite database not initialized", {
        code: "SQLITE_CONNECTION_CLOSED",
        errno: 0
      });
    let { sql, values, mode, parsedInfo } = this;
    try {
      let command = parsedInfo.command;
      if (parsedInfo.canReturnRows) {
        let stmt = db.prepare(sql), result;
        if (mode === SQLQueryResultMode.values)
          result = stmt.values.@apply(stmt, values);
        else if (mode === SQLQueryResultMode.raw)
          result = stmt.raw.@apply(stmt, values);
        else
          result = stmt.all.@apply(stmt, values);
        let sqlResult = @isArray(result) ? new SQLResultArray(result) : new SQLResultArray([result]);
        sqlResult.command = commandToString(command, parsedInfo.lastToken), sqlResult.count = @isArray(result) ? result.length : 1, stmt.finalize(), query.resolve(sqlResult);
      } else {
        let changes = db.run.@apply(db, [sql].concat(values)), sqlResult = new SQLResultArray;
        sqlResult.command = commandToString(command, parsedInfo.lastToken), sqlResult.count = changes.changes, sqlResult.lastInsertRowid = changes.lastInsertRowid, query.resolve(sqlResult);
      }
    } catch (err) {
      if (err && typeof err === "object" && "name" in err && err.name === "SQLiteError") {
        let code = "code" in err ? @String(err.code) : "SQLITE_ERROR", errno = "errno" in err ? Number(err.errno) : 1, byteOffset = "byteOffset" in err ? Number(err.byteOffset) : @undefined, message = "message" in err ? @String(err.message) : "SQLite error";
        throw new SQLiteError(message, { code, errno, byteOffset });
      }
      throw err;
    }
  }
}

class SQLiteAdapter {
  connectionInfo;
  db = null;
  storedError = null;
  _closed = !1;
  queries = /* @__PURE__ */ new Set;
  constructor(connectionInfo) {
    this.connectionInfo = connectionInfo;
    try {
      let SQLiteModule = getSQLiteModule(), { filename } = this.connectionInfo;
      if (filename instanceof URL)
        filename = filename.toString();
      let options = {};
      if (this.connectionInfo.readonly)
        options.readonly = !0;
      else
        options.create = this.connectionInfo.create !== !1, options.readwrite = !0;
      if ("safeIntegers" in this.connectionInfo)
        options.safeIntegers = this.connectionInfo.safeIntegers;
      if ("strict" in this.connectionInfo)
        options.strict = this.connectionInfo.strict;
      this.db = new SQLiteModule.Database(filename, options);
      try {
        let onconnect = this.connectionInfo.onconnect;
        if (onconnect)
          onconnect(null);
      } catch {}
    } catch (err) {
      if (err && typeof err === "object" && "name" in err && err.name === "SQLiteError") {
        let code = "code" in err ? @String(err.code) : "SQLITE_ERROR", errno = "errno" in err ? Number(err.errno) : 1, byteOffset = "byteOffset" in err ? Number(err.byteOffset) : @undefined, message = "message" in err ? @String(err.message) : "SQLite error";
        this.storedError = new SQLiteError(message, { code, errno, byteOffset });
      } else
        this.storedError = err;
      this.db = null;
      try {
        let onconnect = this.connectionInfo.onconnect;
        if (onconnect)
          onconnect(this.storedError ?? err);
      } catch {}
    }
  }
  createQueryHandle(sql, values = []) {
    return new SQLiteQueryHandle(sql, values ?? []);
  }
  escapeIdentifier(str) {
    return '"' + str.replaceAll('"', '""').replaceAll(".", '"."') + '"';
  }
  connectionClosedError() {
    return new SQLiteError("Connection closed", {
      code: "ERR_SQLITE_CONNECTION_CLOSED",
      errno: 0
    });
  }
  notTaggedCallError() {
    return new SQLiteError("Query not called as a tagged template literal", {
      code: "ERR_SQLITE_NOT_TAGGED_CALL",
      errno: 0
    });
  }
  queryCancelledError() {
    return new SQLiteError("Query cancelled", {
      code: "ERR_SQLITE_QUERY_CANCELLED",
      errno: 0
    });
  }
  invalidTransactionStateError(message) {
    return new SQLiteError(message, {
      code: "ERR_SQLITE_INVALID_TRANSACTION_STATE",
      errno: 0
    });
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
            let { command } = parseSQLQuery(query, !0);
            if (command === -1 /* none */ || command === 3 /* where */)
              throw SyntaxError("Helpers are only allowed for INSERT, UPDATE and WHERE IN commands");
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
              if (command === 1 /* update */)
                query += " SET ";
              for (let i2 = 0;i2 < columnCount; i2++) {
                let column = columns[i2], columnValue = item[column];
                if (typeof columnValue > "u")
                  continue;
                if (query += `${this.escapeIdentifier(column)} = ?${i2 < lastColumnIndex ? ", " : ""}`, typeof columnValue > "u")
                  binding_values.push(null);
                else
                  binding_values.push(columnValue);
              }
              if (query.endsWith(", "))
                query = query.substring(0, query.length - 2);
              if (query.endsWith("SET "))
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
  connect(onConnected, reserved) {
    if (this._closed)
      return onConnected(this.connectionClosedError(), null);
    if (reserved)
      return onConnected(Error("SQLite doesn't support connection reservation (no connection pool)"), null);
    if (this.storedError)
      onConnected(this.storedError, null);
    else if (this.db)
      onConnected(null, this.db);
    else
      onConnected(this.connectionClosedError(), null);
  }
  release(_connection, _connectingEvent) {}
  async close(_options) {
    if (this._closed)
      return;
    if (this._closed = !0, this.storedError = Error("Connection closed"), this.db) {
      try {
        this.db.close();
      } catch {}
      this.db = null;
    }
    try {
      let onclose = this.connectionInfo.onclose;
      if (onclose)
        onclose(this.storedError);
    } catch {}
  }
  flush() {
    throw Error("SQLite doesn't support flush() - queries are executed synchronously");
  }
  isConnected() {
    return this.db !== null;
  }
  get closed() {
    return this._closed;
  }
  supportsReservedConnections() {
    return !1;
  }
  getConnectionForQuery(connection) {
    return connection;
  }
  array(_values2, _typeNameOrID) {
    throw Error("SQLite doesn't support arrays");
  }
  getTransactionCommands(options) {
    let BEGIN = "BEGIN";
    if (options) {
      let upperOptions = options.toUpperCase();
      if (upperOptions === "DEFERRED" || upperOptions === "IMMEDIATE" || upperOptions === "EXCLUSIVE")
        BEGIN = `BEGIN ${upperOptions}`;
      else if (upperOptions === "READONLY" || upperOptions === "READ")
        throw Error(`SQLite doesn't support '${options}' transaction mode. Use DEFERRED, IMMEDIATE, or EXCLUSIVE.`);
      else
        BEGIN = `BEGIN ${options}`;
    }
    return {
      BEGIN,
      COMMIT: "COMMIT",
      ROLLBACK: "ROLLBACK",
      SAVEPOINT: "SAVEPOINT",
      RELEASE_SAVEPOINT: "RELEASE SAVEPOINT",
      ROLLBACK_TO_SAVEPOINT: "ROLLBACK TO SAVEPOINT"
    };
  }
  getDistributedTransactionCommands(_name) {
    return null;
  }
  validateTransactionOptions(options) {
    if (!options)
      return { valid: !0 };
    let upperOptions = options.toUpperCase();
    if (upperOptions === "READONLY" || upperOptions === "READ")
      return {
        valid: !1,
        error: `SQLite doesn't support '${options}' transaction mode. Use DEFERRED, IMMEDIATE, or EXCLUSIVE.`
      };
    return { valid: !0 };
  }
  validateDistributedTransactionName() {
    return {
      valid: !1,
      error: "SQLite doesn't support distributed transactions."
    };
  }
  getCommitDistributedSQL() {
    throw Error("SQLite doesn't support distributed transactions.");
  }
  getRollbackDistributedSQL() {
    throw Error("SQLite doesn't support distributed transactions.");
  }
}
$ = {
  SQLiteAdapter,
  SQLCommand,
  commandToString,
  parseSQLQuery,
  SQLiteQueryHandle
};
return $})

