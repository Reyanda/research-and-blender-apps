(function (){"use strict";// build/release/tmp_modules/bun/sqlite.ts
var $;
var defineProperties = Object.defineProperties, toStringTag = Symbol.toStringTag, isArray = @Array.isArray, isTypedArray = @ArrayBuffer.isView, internalFieldTuple;
function initializeSQL() {
  ({ 0: SQL, 1: internalFieldTuple } = @lazy(1));
}
function createChangesObject() {
  return {
    changes: @getInternalField(internalFieldTuple, 0),
    lastInsertRowid: @getInternalField(internalFieldTuple, 1)
  };
}
var constants = {
  SQLITE_OPEN_READONLY: 1,
  SQLITE_OPEN_READWRITE: 2,
  SQLITE_OPEN_CREATE: 4,
  SQLITE_OPEN_DELETEONCLOSE: 8,
  SQLITE_OPEN_EXCLUSIVE: 16,
  SQLITE_OPEN_AUTOPROXY: 32,
  SQLITE_OPEN_URI: 64,
  SQLITE_OPEN_MEMORY: 128,
  SQLITE_OPEN_MAIN_DB: 256,
  SQLITE_OPEN_TEMP_DB: 512,
  SQLITE_OPEN_TRANSIENT_DB: 1024,
  SQLITE_OPEN_MAIN_JOURNAL: 2048,
  SQLITE_OPEN_TEMP_JOURNAL: 4096,
  SQLITE_OPEN_SUBJOURNAL: 8192,
  SQLITE_OPEN_SUPER_JOURNAL: 16384,
  SQLITE_OPEN_NOMUTEX: 32768,
  SQLITE_OPEN_FULLMUTEX: 65536,
  SQLITE_OPEN_SHAREDCACHE: 131072,
  SQLITE_OPEN_PRIVATECACHE: 262144,
  SQLITE_OPEN_WAL: 524288,
  SQLITE_OPEN_NOFOLLOW: 16777216,
  SQLITE_OPEN_EXRESCODE: 33554432,
  SQLITE_PREPARE_PERSISTENT: 1,
  SQLITE_PREPARE_NORMALIZE: 2,
  SQLITE_PREPARE_NO_VTAB: 4,
  SQLITE_DESERIALIZE_READONLY: 4,
  SQLITE_FCNTL_LOCKSTATE: 1,
  SQLITE_FCNTL_GET_LOCKPROXYFILE: 2,
  SQLITE_FCNTL_SET_LOCKPROXYFILE: 3,
  SQLITE_FCNTL_LAST_ERRNO: 4,
  SQLITE_FCNTL_SIZE_HINT: 5,
  SQLITE_FCNTL_CHUNK_SIZE: 6,
  SQLITE_FCNTL_FILE_POINTER: 7,
  SQLITE_FCNTL_SYNC_OMITTED: 8,
  SQLITE_FCNTL_WIN32_AV_RETRY: 9,
  SQLITE_FCNTL_PERSIST_WAL: 10,
  SQLITE_FCNTL_OVERWRITE: 11,
  SQLITE_FCNTL_VFSNAME: 12,
  SQLITE_FCNTL_POWERSAFE_OVERWRITE: 13,
  SQLITE_FCNTL_PRAGMA: 14,
  SQLITE_FCNTL_BUSYHANDLER: 15,
  SQLITE_FCNTL_TEMPFILENAME: 16,
  SQLITE_FCNTL_MMAP_SIZE: 18,
  SQLITE_FCNTL_TRACE: 19,
  SQLITE_FCNTL_HAS_MOVED: 20,
  SQLITE_FCNTL_SYNC: 21,
  SQLITE_FCNTL_COMMIT_PHASETWO: 22,
  SQLITE_FCNTL_WIN32_SET_HANDLE: 23,
  SQLITE_FCNTL_WAL_BLOCK: 24,
  SQLITE_FCNTL_ZIPVFS: 25,
  SQLITE_FCNTL_RBU: 26,
  SQLITE_FCNTL_VFS_POINTER: 27,
  SQLITE_FCNTL_JOURNAL_POINTER: 28,
  SQLITE_FCNTL_WIN32_GET_HANDLE: 29,
  SQLITE_FCNTL_PDB: 30,
  SQLITE_FCNTL_BEGIN_ATOMIC_WRITE: 31,
  SQLITE_FCNTL_COMMIT_ATOMIC_WRITE: 32,
  SQLITE_FCNTL_ROLLBACK_ATOMIC_WRITE: 33,
  SQLITE_FCNTL_LOCK_TIMEOUT: 34,
  SQLITE_FCNTL_DATA_VERSION: 35,
  SQLITE_FCNTL_SIZE_LIMIT: 36,
  SQLITE_FCNTL_CKPT_DONE: 37,
  SQLITE_FCNTL_RESERVE_BYTES: 38,
  SQLITE_FCNTL_CKPT_START: 39,
  SQLITE_FCNTL_EXTERNAL_READER: 40,
  SQLITE_FCNTL_CKSM_FILE: 41,
  SQLITE_FCNTL_RESET_CACHE: 42
}, SQL, controllers;

class Statement {
  constructor(raw) {
    switch (this.#raw = raw, raw.paramsCount) {
      case 0: {
        this.get = this.#getNoArgs, this.all = this.#allNoArgs, this.iterate = this.#iterateNoArgs, this.values = this.#valuesNoArgs, this.raw = this.#rawNoArgs, this.run = this.#runNoArgs;
        break;
      }
      default: {
        this.get = this.#get, this.all = this.#all, this.iterate = this.#iterate, this.values = this.#values, this.raw = this.#rawValues, this.run = this.#run;
        break;
      }
    }
  }
  #raw;
  get;
  all;
  iterate;
  values;
  raw;
  run;
  isFinalized = !1;
  toJSON() {
    return {
      sql: this.native.toString(),
      isFinalized: this.isFinalized,
      paramsCount: this.paramsCount,
      columnNames: this.columnNames
    };
  }
  get [toStringTag]() {
    return `"${this.native.toString()}"`;
  }
  toString() {
    return this.native.toString();
  }
  get native() {
    return this.#raw;
  }
  #getNoArgs() {
    return this.#raw.get();
  }
  #allNoArgs() {
    return this.#raw.all();
  }
  *#iterateNoArgs() {
    for (let res = this.#raw.iterate();res; res = this.#raw.iterate())
      yield res;
  }
  #valuesNoArgs() {
    return this.#raw.values();
  }
  #rawNoArgs() {
    return this.#raw.raw();
  }
  #runNoArgs() {
    return this.#raw.run(internalFieldTuple), createChangesObject();
  }
  safeIntegers(updatedValue) {
    if (updatedValue !== @undefined)
      return this.#raw.safeIntegers = !!updatedValue, this;
    return this.#raw.safeIntegers;
  }
  as(ClassType) {
    return this.#raw.as(ClassType), this;
  }
  #get(...args) {
    if (args.length === 0)
      return this.#getNoArgs();
    var arg0 = args[0];
    return !isArray(arg0) && (!arg0 || typeof arg0 !== "object" || isTypedArray(arg0)) ? this.#raw.get(args) : this.#raw.get(...args);
  }
  #all(...args) {
    if (args.length === 0)
      return this.#allNoArgs();
    var arg0 = args[0];
    return !isArray(arg0) && (!arg0 || typeof arg0 !== "object" || isTypedArray(arg0)) ? this.#raw.all(args) : this.#raw.all(...args);
  }
  *#iterate(...args) {
    if (args.length === 0)
      return yield* this.#iterateNoArgs();
    var arg0 = args[0];
    let res = !isArray(arg0) && (!arg0 || typeof arg0 !== "object" || isTypedArray(arg0)) ? this.#raw.iterate(args) : this.#raw.iterate(...args);
    for (;res; res = this.#raw.iterate())
      yield res;
  }
  #values(...args) {
    if (args.length === 0)
      return this.#valuesNoArgs();
    var arg0 = args[0];
    return !isArray(arg0) && (!arg0 || typeof arg0 !== "object" || isTypedArray(arg0)) ? this.#raw.values(args) : this.#raw.values(...args);
  }
  #rawValues(...args) {
    if (args.length === 0)
      return this.#rawNoArgs();
    var arg0 = args[0];
    return !isArray(arg0) && (!arg0 || typeof arg0 !== "object" || isTypedArray(arg0)) ? this.#raw.raw(args) : this.#raw.raw(...args);
  }
  #run(...args) {
    if (args.length === 0)
      return this.#runNoArgs(), createChangesObject();
    var arg0 = args[0];
    if (!isArray(arg0) && (!arg0 || typeof arg0 !== "object" || isTypedArray(arg0)))
      this.#raw.run(internalFieldTuple, args);
    else
      this.#raw.run(internalFieldTuple, ...args);
    return createChangesObject();
  }
  get columnNames() {
    return this.#raw.columns;
  }
  get columnTypes() {
    return this.#raw.columnTypes;
  }
  get declaredTypes() {
    return this.#raw.declaredTypes;
  }
  get paramsCount() {
    return this.#raw.paramsCount;
  }
  finalize(...args) {
    return this.isFinalized = !0, this.#raw.finalize(...args);
  }
  *[Symbol.iterator]() {
    yield* this.#iterateNoArgs();
  }
  [Symbol.dispose]() {
    if (!this.isFinalized)
      this.finalize();
  }
}
var cachedCount = Symbol.for("Bun.Database.cache.count");

class Database {
  constructor(filenameGiven, options) {
    if (typeof filenameGiven > "u")
      ;
    else if (typeof filenameGiven !== "string") {
      if (isTypedArray(filenameGiven)) {
        let deserializeFlags = 0;
        if (options && typeof options === "object") {
          if (options.strict)
            this.#internalFlags |= 4;
          if (options.safeIntegers)
            this.#internalFlags |= 2;
          if (options.readonly)
            deserializeFlags |= constants.SQLITE_DESERIALIZE_READONLY;
        }
        this.#handle = Database.#deserialize(filenameGiven, this.#internalFlags, deserializeFlags), this.filename = ":memory:";
        return;
      }
      @throwTypeError(`Expected 'filename' to be a string, got '${typeof filenameGiven}'`);
    }
    var filename = typeof filenameGiven === "string" ? filenameGiven.trim() : ":memory:", flags = constants.SQLITE_OPEN_READWRITE | constants.SQLITE_OPEN_CREATE;
    if (typeof options === "object" && options) {
      if (flags = 0, options.readonly)
        flags = constants.SQLITE_OPEN_READONLY;
      if ("readOnly" in options)
        @throwTypeError('Misspelled option "readOnly" should be "readonly"');
      if (options.create)
        flags = constants.SQLITE_OPEN_READWRITE | constants.SQLITE_OPEN_CREATE;
      if (options.readwrite)
        flags |= constants.SQLITE_OPEN_READWRITE;
      if ("strict" in options || "safeIntegers" in options) {
        if (options.safeIntegers)
          this.#internalFlags |= 2;
        if (options.strict)
          this.#internalFlags |= 4;
        if (flags === 0)
          flags = constants.SQLITE_OPEN_READWRITE | constants.SQLITE_OPEN_CREATE;
      }
    } else if (typeof options === "number")
      flags = options;
    let anonymous = filename === "" || filename === ":memory:";
    if (anonymous && (flags & constants.SQLITE_OPEN_READONLY) !== 0)
      throw Error("Cannot open an anonymous database in read-only mode.");
    if (!SQL)
      initializeSQL();
    this.#handle = SQL.open(anonymous ? ":memory:" : filename, flags, this), this.filename = filename;
  }
  #internalFlags = 0;
  #handle;
  #cachedQueriesKeys = [];
  #cachedQueriesLengths = [];
  #cachedQueriesValues = [];
  filename;
  #hasClosed = !1;
  get handle() {
    return this.#handle;
  }
  get inTransaction() {
    return SQL.isInTransaction(this.#handle);
  }
  static open(filename, options) {
    return new Database(filename, options);
  }
  loadExtension(name, entryPoint) {
    return SQL.loadExtension(this.#handle, name, entryPoint);
  }
  serialize(optionalName) {
    return SQL.serialize(this.#handle, optionalName || "main");
  }
  static #deserialize(serialized, openFlags, deserializeFlags) {
    if (!SQL)
      initializeSQL();
    return SQL.deserialize(serialized, openFlags, deserializeFlags);
  }
  static deserialize(serialized, options = !1) {
    if (typeof options === "boolean")
      return new Database(serialized, { readonly: options });
    else if (options && typeof options === "object")
      return new Database(serialized, options);
    else
      return new Database(serialized, 0);
  }
  [Symbol.dispose]() {
    if (!this.#hasClosed)
      this.close(!0);
  }
  static setCustomSQLite(path) {
    if (!SQL)
      initializeSQL();
    return SQL.setCustomSQLite(path);
  }
  fileControl(_cmd, _arg) {
    let handle = this.#handle;
    if (arguments.length <= 2)
      return SQL.fcntl(handle, null, arguments[0], arguments[1]);
    return SQL.fcntl(handle, ...arguments);
  }
  close(throwOnError = !1) {
    if (this.clearQueryCache(), controllers) {
      let controller = controllers.get(this);
      if (controller) {
        controllers.delete(this);
        let seen = /* @__PURE__ */ new Set;
        for (let ctrl of [controller.default, controller.deferred, controller.immediate, controller.exclusive]) {
          if (!ctrl)
            continue;
          for (let stmt of [ctrl.begin, ctrl.commit, ctrl.rollback, ctrl.savepoint, ctrl.release, ctrl.rollbackTo])
            if (stmt && !seen.has(stmt))
              seen.add(stmt), stmt.finalize?.();
        }
      }
    }
    return this.#hasClosed = !0, SQL.close(this.#handle, throwOnError);
  }
  clearQueryCache() {
    for (let item of this.#cachedQueriesValues)
      item?.finalize?.();
    this.#cachedQueriesKeys.length = 0, this.#cachedQueriesValues.length = 0, this.#cachedQueriesLengths.length = 0;
  }
  run(query, ...params) {
    if (params.length === 0)
      return SQL.run(this.#handle, this.#internalFlags, internalFieldTuple, query), createChangesObject();
    var arg0 = params[0];
    if (!isArray(arg0) && (!arg0 || typeof arg0 !== "object" || isTypedArray(arg0)))
      SQL.run(this.#handle, this.#internalFlags, internalFieldTuple, query, params);
    else
      SQL.run(this.#handle, this.#internalFlags, internalFieldTuple, query, ...params);
    return createChangesObject();
  }
  prepare(query, params, flags = 0) {
    return new Statement(SQL.prepare(this.#handle, query, params, flags || 0, this.#internalFlags));
  }
  static MAX_QUERY_CACHE_SIZE = 20;
  get [cachedCount]() {
    return this.#cachedQueriesKeys.length;
  }
  query(query) {
    if (typeof query !== "string")
      @throwTypeError(`Expected 'query' to be a string, got '${typeof query}'`);
    if (query.length === 0)
      throw Error("SQL query cannot be empty.");
    let willCache = this.#cachedQueriesKeys.length < Database.MAX_QUERY_CACHE_SIZE, index = this.#cachedQueriesLengths.indexOf(query.length);
    while (index !== -1) {
      if (this.#cachedQueriesKeys[index] !== query) {
        index = this.#cachedQueriesLengths.indexOf(query.length, index + 1);
        continue;
      }
      let stmt2 = this.#cachedQueriesValues[index];
      if (stmt2.isFinalized)
        return this.#cachedQueriesValues[index] = this.prepare(query, @undefined, willCache ? constants.SQLITE_PREPARE_PERSISTENT : 0);
      return stmt2;
    }
    var stmt = this.prepare(query, @undefined, willCache ? constants.SQLITE_PREPARE_PERSISTENT : 0);
    if (willCache)
      this.#cachedQueriesKeys.push(query), this.#cachedQueriesLengths.push(query.length), this.#cachedQueriesValues.push(stmt);
    return stmt;
  }
  transaction(fn, self) {
    if (typeof fn !== "function")
      @throwTypeError("Expected first argument to be a function");
    let db = this, controller = getController(db, self), properties = {
      default: { value: wrapTransaction(fn, db, controller.default) },
      deferred: { value: wrapTransaction(fn, db, controller.deferred) },
      immediate: {
        value: wrapTransaction(fn, db, controller.immediate)
      },
      exclusive: {
        value: wrapTransaction(fn, db, controller.exclusive)
      },
      database: { value: this, enumerable: !0 }
    };
    return defineProperties(properties.default.value, properties), defineProperties(properties.deferred.value, properties), defineProperties(properties.immediate.value, properties), defineProperties(properties.exclusive.value, properties), properties.default.value;
  }
}
Database.prototype.exec = Database.prototype.run;
var getController = (db, _self) => {
  let controller = (controllers ||= /* @__PURE__ */ new WeakMap).get(db);
  if (!controller) {
    let shared = {
      commit: db.prepare("COMMIT", @undefined, 0),
      rollback: db.prepare("ROLLBACK", @undefined, 0),
      savepoint: db.prepare("SAVEPOINT `\t_bs3.\t`", @undefined, 0),
      release: db.prepare("RELEASE `\t_bs3.\t`", @undefined, 0),
      rollbackTo: db.prepare("ROLLBACK TO `\t_bs3.\t`", @undefined, 0)
    };
    controllers.set(db, controller = {
      default: Object.assign({ begin: db.prepare("BEGIN", @undefined, 0) }, shared),
      deferred: Object.assign({ begin: db.prepare("BEGIN DEFERRED", @undefined, 0) }, shared),
      immediate: Object.assign({ begin: db.prepare("BEGIN IMMEDIATE", @undefined, 0) }, shared),
      exclusive: Object.assign({ begin: db.prepare("BEGIN EXCLUSIVE", @undefined, 0) }, shared)
    });
  }
  return controller;
}, wrapTransaction = (fn, db, { begin, commit, rollback, savepoint, release, rollbackTo }) => function transaction(...args) {
  let before, after, undo;
  if (db.inTransaction)
    before = savepoint, after = release, undo = rollbackTo;
  else
    before = begin, after = commit, undo = rollback;
  try {
    before.run();
    let result = fn.@apply(this, args);
    return after.run(), result;
  } catch (ex) {
    if (db.inTransaction) {
      if (undo.run(), undo !== rollback)
        after.run();
    }
    throw ex;
  }
};

class SQLiteError extends Error {
  static [Symbol.hasInstance](instance) {
    return instance?.name === "SQLiteError";
  }
  constructor() {
    super();
    throw Error("SQLiteError can only be constructed by bun:sqlite");
  }
}
$ = {
  __esModule: !0,
  Database,
  Statement,
  constants,
  default: Database,
  SQLiteError
};
return $})

