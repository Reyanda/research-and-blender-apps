(function (){"use strict";// build/release/tmp_modules/internal/sql/errors.ts
var $;

class SQLError extends Error {
  constructor(message) {
    super(message);
    this.name = "SQLError";
  }
}

class PostgresError extends SQLError {
  code;
  constructor(message, options) {
    super(message);
    if (this.name = "PostgresError", this.code = options.code, options.errno !== @undefined)
      this.errno = options.errno;
    if (options.detail !== @undefined)
      this.detail = options.detail;
    if (options.hint !== @undefined)
      this.hint = options.hint;
    if (options.severity !== @undefined)
      this.severity = options.severity;
    if (options.position !== @undefined)
      this.position = options.position;
    if (options.internalPosition !== @undefined)
      this.internalPosition = options.internalPosition;
    if (options.internalQuery !== @undefined)
      this.internalQuery = options.internalQuery;
    if (options.where !== @undefined)
      this.where = options.where;
    if (options.schema !== @undefined)
      this.schema = options.schema;
    if (options.table !== @undefined)
      this.table = options.table;
    if (options.column !== @undefined)
      this.column = options.column;
    if (options.dataType !== @undefined)
      this.dataType = options.dataType;
    if (options.constraint !== @undefined)
      this.constraint = options.constraint;
    if (options.file !== @undefined)
      this.file = options.file;
    if (options.line !== @undefined)
      this.line = options.line;
    if (options.routine !== @undefined)
      this.routine = options.routine;
  }
}

class SQLiteError extends SQLError {
  code;
  errno;
  constructor(message, options) {
    super(message);
    if (this.name = "SQLiteError", this.code = options.code, this.errno = options.errno, options.byteOffset !== @undefined)
      this.byteOffset = options.byteOffset;
  }
}

class MySQLError extends SQLError {
  code;
  constructor(message, options) {
    super(message);
    if (this.name = "MySQLError", this.code = options.code, options.errno !== @undefined)
      this.errno = options.errno;
    if (options.sqlState !== @undefined)
      this.sqlState = options.sqlState;
  }
}
$ = { PostgresError, SQLError, SQLiteError, MySQLError };
return $})

