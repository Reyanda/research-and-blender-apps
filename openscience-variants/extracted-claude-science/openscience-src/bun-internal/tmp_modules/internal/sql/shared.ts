(function (){"use strict";// build/release/tmp_modules/internal/sql/shared.ts
var $, PublicArray = globalThis.Array;

class SQLArrayParameter {
  serializedValues;
  arrayType;
  constructor(serializedValues, arrayType) {
    this.serializedValues = serializedValues, this.arrayType = arrayType;
  }
  toString() {
    return this.serializedValues;
  }
  toJSON() {
    return this.serializedValues;
  }
}

class SQLResultArray extends PublicArray {
  count;
  command;
  lastInsertRowid;
  affectedRows;
  static [Symbol.toStringTag] = "SQLResults";
  constructor(values = []) {
    super(...values);
    Object.defineProperties(this, {
      count: { value: null, writable: !0 },
      command: { value: null, writable: !0 },
      lastInsertRowid: { value: null, writable: !0 },
      affectedRows: { value: null, writable: !0 }
    });
  }
  static get [Symbol.species]() {
    return @Array;
  }
}
function decodeIfValid(value) {
  if (value)
    return decodeURIComponent(value);
  return null;
}
var SSLMode;
((SSLMode2) => {
  SSLMode2[SSLMode2.disable = 0] = "disable";
  SSLMode2[SSLMode2.prefer = 1] = "prefer";
  SSLMode2[SSLMode2.require = 2] = "require";
  SSLMode2[SSLMode2.verify_ca = 3] = "verify_ca";
  SSLMode2[SSLMode2.verify_full = 4] = "verify_full";
})(SSLMode ||= {});
function normalizeSSLMode(value) {
  if (!value)
    return 0 /* disable */;
  switch (value = (value + "").toLowerCase(), value) {
    case "disable":
      return 0 /* disable */;
    case "prefer":
      return 1 /* prefer */;
    case "require":
    case "required":
      return 2 /* require */;
    case "verify-ca":
    case "verify_ca":
      return 3 /* verify_ca */;
    case "verify-full":
    case "verify_full":
      return 4 /* verify_full */;
    default:
      break;
  }
  throw @makeErrorWithCode(119, "sslmode", value, "must be one of: disable, prefer, require, verify-ca, verify-full");
}

class SQLHelper {
  value;
  columns;
  constructor(value, keys) {
    if (keys !== @undefined && keys.length === 0 && (@isObject(value[0]) || @isArray(value[0])))
      keys = Object.keys(value[0]);
    if (keys !== @undefined)
      for (let key of keys) {
        if (typeof key === "string") {
          let asNumber = Number(key);
          if (Number.isNaN(asNumber))
            continue;
          key = asNumber;
        }
        if (typeof key !== "string") {
          if (Number.isSafeInteger(key)) {
            if (key >= 0 && key <= 65536)
              continue;
          }
          throw Error(`Keys must be strings or numbers: ${@String(key)}`);
        }
      }
    this.value = value, this.columns = keys ?? [];
  }
}
function buildDefinedColumnsAndQuery(columns, items, escapeIdentifier) {
  let definedColumns = [], columnsSql = "(", columnCount = columns.length;
  for (let k = 0;k < columnCount; k++) {
    let column = columns[k], hasDefinedValue = !1;
    if (@isArray(items)) {
      for (let j = 0;j < items.length; j++)
        if (typeof items[j][column] < "u") {
          hasDefinedValue = !0;
          break;
        }
    } else
      hasDefinedValue = typeof items[column] < "u";
    if (hasDefinedValue) {
      if (definedColumns.length > 0)
        columnsSql += ", ";
      columnsSql += escapeIdentifier(column), definedColumns.push(column);
    }
  }
  return columnsSql += ") VALUES", { definedColumns, columnsSql };
}
var SQLITE_MEMORY = ":memory:", SQLITE_MEMORY_VARIANTS = [":memory:", "sqlite://:memory:", "sqlite:memory"], sqliteProtocols = [
  { prefix: "sqlite://", stripLength: 9 },
  { prefix: "sqlite:", stripLength: 7 },
  { prefix: "file://", stripLength: -1 },
  { prefix: "file:", stripLength: 5 }
];
function parseDefinitelySqliteUrl(value) {
  if (value === null)
    return null;
  let str = value instanceof URL ? value.toString() : value;
  if (SQLITE_MEMORY_VARIANTS.includes(str))
    return SQLITE_MEMORY;
  for (let { prefix, stripLength } of sqliteProtocols) {
    if (!str.startsWith(prefix))
      continue;
    if (stripLength === -1)
      try {
        return Bun.fileURLToPath(str);
      } catch {
        return str.slice(7);
      }
    return str.slice(stripLength);
  }
  return null;
}
function parseSQLiteOptions(filenameOrUrl, options) {
  let sqliteOptions = {
    ...options,
    adapter: "sqlite",
    filename: ":memory:"
  }, filename = filenameOrUrl || ":memory:", originalUrl = filename;
  if (filename instanceof URL)
    originalUrl = filename.toString(), filename = filename.toString();
  let queryString = null;
  if (typeof originalUrl === "string") {
    let queryIndex = originalUrl.indexOf("?");
    if (queryIndex !== -1) {
      if (queryString = originalUrl.slice(queryIndex + 1), typeof filename === "string")
        filename = filename.slice(0, queryIndex);
    }
  }
  let parsedFilename = parseDefinitelySqliteUrl(filename);
  if (parsedFilename !== null)
    filename = parsedFilename;
  if (sqliteOptions.filename = filename || ":memory:", queryString) {
    let mode = new URLSearchParams(queryString).get("mode");
    if (mode === "ro")
      sqliteOptions.readonly = !0;
    else if (mode === "rw")
      sqliteOptions.readonly = !1;
    else if (mode === "rwc")
      sqliteOptions.readonly = !1, sqliteOptions.create = !0;
  }
  if ("readonly" in options)
    sqliteOptions.readonly = options.readonly;
  if ("create" in options)
    sqliteOptions.create = options.create;
  if ("safeIntegers" in options)
    sqliteOptions.safeIntegers = options.safeIntegers;
  return sqliteOptions;
}
function isOptionsOfAdapter(options, adapter) {
  return options.adapter === adapter;
}
function assertIsOptionsOfAdapter(options, adapter) {
  if (!isOptionsOfAdapter(options, adapter))
    throw Error(`Expected adapter to be ${adapter}, but got '${options.adapter}'`);
}
var DEFAULT_PROTOCOL = "postgres", env = Bun.env;
function getConnectionDetailsFromEnvironment(adapter) {
  let url = null, sslMode = null;
  if (url ||= env.DATABASE_URL || env.DATABASEURL || null, !url) {
    if (url = env.TLS_DATABASE_URL || null, url)
      sslMode = 2 /* require */;
  }
  if (url)
    return [url, sslMode, adapter || null];
  if (!adapter || adapter === "postgres") {
    if (url ||= env.POSTGRES_URL || env.PGURL || env.PG_URL || env.PGURL || null, !url) {
      if (url = env.TLS_POSTGRES_DATABASE_URL || null, url)
        sslMode = 2 /* require */;
    }
    if (url)
      return [url, sslMode, "postgres"];
  }
  if (!adapter || adapter === "mysql") {
    if (url ||= env.MYSQL_URL || env.MYSQLURL || null, !url) {
      if (url = env.TLS_MYSQL_DATABASE_URL || null, url)
        sslMode = 2 /* require */;
    }
    if (url)
      return [url, sslMode, "mysql"];
  }
  if (!adapter || adapter === "mariadb") {
    if (url ||= env.MARIADB_URL || env.MARIADBURL || null, !url) {
      if (url = env.TLS_MARIADB_DATABASE_URL || null, url)
        sslMode = 2 /* require */;
    }
    if (url)
      return [url, sslMode, "mariadb"];
  }
  if (!adapter || adapter === "sqlite") {
    if (url ||= env.SQLITE_URL || env.SQLITEURL || null, url)
      return [url, sslMode, "sqlite"];
  }
  return [url, sslMode, adapter || null];
}
function ensureUrlHasProtocol(url, protocol) {
  if (url === null)
    return null;
  if (url instanceof URL)
    return url.protocol = protocol, url;
  return `${protocol}://${url}`;
}
function hasProtocol(url) {
  if (url instanceof URL)
    return !0;
  return url.includes("://");
}
function parseConnectionDetailsFromOptionsOrEnvironment(stringOrUrlOrOptions, definitelyOptionsButMaybeEmpty) {
  let options, stringOrUrl = null, sslMode = null, adapter = null;
  if (typeof stringOrUrlOrOptions === "string" || stringOrUrlOrOptions instanceof URL)
    stringOrUrl = stringOrUrlOrOptions, options = definitelyOptionsButMaybeEmpty;
  else
    options = stringOrUrlOrOptions ? { ...stringOrUrlOrOptions, ...definitelyOptionsButMaybeEmpty } : definitelyOptionsButMaybeEmpty, [stringOrUrl, sslMode, adapter] = getConnectionDetailsFromEnvironment(options.adapter);
  let resolvedUrl = stringOrUrl;
  if (options.adapter === "sqlite") {
    if ("filename" in options && options.filename)
      resolvedUrl = options.filename;
  } else if (!options.adapter) {
    if ("filename" in options && options.filename)
      resolvedUrl = options.filename;
    else if ("url" in options && options.url)
      resolvedUrl = options.url;
  } else if ("url" in options && options.url)
    resolvedUrl = options.url;
  if (options.adapter === "sqlite")
    return [resolvedUrl, null, options];
  if (!options.adapter && resolvedUrl !== null) {
    if (parseDefinitelySqliteUrl(resolvedUrl) !== null)
      return [resolvedUrl, null, { ...options, adapter: "sqlite" }];
  }
  let protocol = options.adapter || DEFAULT_PROTOCOL, urlToProcess = resolvedUrl || stringOrUrl;
  if (urlToProcess instanceof URL)
    protocol = urlToProcess.protocol.replace(/:$/, "");
  else if (urlToProcess !== null)
    if (hasProtocol(urlToProcess))
      try {
        urlToProcess = new URL(urlToProcess), protocol = urlToProcess.protocol.replace(/:$/, "");
      } catch (e) {
        if (options.adapter && typeof urlToProcess === "string" && urlToProcess.includes("sqlite"))
          throw Error(`Invalid URL '${urlToProcess}' for ${options.adapter}. Did you mean to specify \`{ adapter: "sqlite" }\`?`, { cause: e });
        throw e;
      }
    else
      urlToProcess = ensureUrlHasProtocol(urlToProcess, protocol);
  if (options.adapter === @undefined && adapter !== null)
    options.adapter = adapter;
  if (options.adapter) {
    if (!["postgres", "sqlite", "mysql", "mariadb"].includes(options.adapter))
      throw Error(`Unsupported adapter: ${options.adapter}. Supported adapters: "postgres", "sqlite", "mysql", "mariadb"`);
    return [urlToProcess, sslMode, options];
  }
  let parsedAdapterFromProtocol = parseAdapterFromProtocol(protocol);
  if (!parsedAdapterFromProtocol)
    throw Error(`Unsupported protocol: ${protocol}. Supported adapters: "postgres", "sqlite", "mysql", "mariadb"`);
  return [urlToProcess, sslMode, { ...options, adapter: parsedAdapterFromProtocol }];
}
function parseAdapterFromProtocol(protocol) {
  switch (protocol) {
    case "http":
    case "https":
    case "ftp":
    case "postgres":
    case "postgresql":
      return "postgres";
    case "mysql":
    case "mysql2":
      return "mysql";
    case "mariadb":
      return "mariadb";
    case "file":
    case "sqlite":
      return "sqlite";
    default:
      return null;
  }
}
function parseOptions(stringOrUrlOrOptions, definitelyOptionsButMaybeEmpty) {
  let [_url, sslModeFromConnectionDetails, options] = parseConnectionDetailsFromOptionsOrEnvironment(stringOrUrlOrOptions, definitelyOptionsButMaybeEmpty), adapter = options.adapter;
  if (adapter === "sqlite")
    return parseSQLiteOptions(_url, options);
  let sslMode = sslModeFromConnectionDetails || 0 /* disable */, url = _url, hostname, port, username, password, database, tls, query = "", idleTimeout, connectionTimeout, maxLifetime, onconnect, onclose, max, bigint, path, prepare = !0;
  if (url !== null)
    url = url instanceof URL ? url : new URL(url);
  if (url) {
    hostname ||= options.host || options.hostname || url.hostname, port ||= options.port || url.port, username ||= options.user || options.username || decodeIfValid(url.username), password ||= options.pass || options.password || decodeIfValid(url.password), path ||= options.path || url.pathname;
    let queryObject = url.searchParams.toJSON();
    for (let key in queryObject)
      if (key.toLowerCase() === "sslmode")
        sslMode = normalizeSSLMode(queryObject[key]);
      else if (key.toLowerCase() === "path")
        path = queryObject[key];
      else
        query += `${key}\x00${queryObject[key]}\x00`;
    query = query.trim();
  }
  switch (adapter) {
    case "postgres": {
      hostname ||= options.hostname || options.host || env.PG_HOST || env.PGHOST || "localhost";
      break;
    }
    case "mysql": {
      hostname ||= options.hostname || options.host || env.MYSQL_HOST || env.MYSQLHOST || "localhost";
      break;
    }
    case "mariadb": {
      hostname ||= options.hostname || options.host || env.MARIADB_HOST || env.MARIADBHOST || "localhost";
      break;
    }
  }
  switch (adapter) {
    case "postgres": {
      port ||= Number(options.port || env.PG_PORT || env.PGPORT || "5432");
      break;
    }
    case "mysql": {
      port ||= Number(options.port || env.MYSQL_PORT || env.MYSQLPORT || "3306");
      break;
    }
    case "mariadb": {
      port ||= Number(options.port || env.MARIADB_PORT || env.MARIADBPORT || "3306");
      break;
    }
  }
  if (path ||= options.path || "", adapter === "postgres") {
    if (path && Number.isSafeInteger(port) && path?.indexOf("/.s.PGSQL.") === -1) {
      let pathWithSocket = `${path}/.s.PGSQL.${port}`;
      if ((@getInternalField(@internalModuleRegistry, 98) || @createInternalModuleById(98)).existsSync(pathWithSocket))
        path = pathWithSocket;
    }
  }
  switch (adapter) {
    case "mysql": {
      username ||= options.username || options.user || env.MYSQL_USER || env.MYSQLUSER || env.USER || "root";
      break;
    }
    case "mariadb": {
      username ||= options.username || options.user || env.MARIADB_USER || env.MARIADBUSER || env.USER || "root";
      break;
    }
    case "postgres": {
      username ||= options.username || options.user || env.PG_USER || env.PGUSER || env.USER || "postgres";
      break;
    }
  }
  switch (adapter) {
    case "mysql": {
      password ||= options.password || options.pass || env.MYSQL_PASSWORD || env.MYSQLPASSWORD || env.PASSWORD || "";
      break;
    }
    case "mariadb": {
      password ||= options.password || options.pass || env.MARIADB_PASSWORD || env.MARIADBPASSWORD || env.PASSWORD || "";
      break;
    }
    case "postgres": {
      password ||= options.password || options.pass || env.PG_PASSWORD || env.PGPASSWORD || env.PASSWORD || "";
      break;
    }
  }
  switch (adapter) {
    case "postgres": {
      database ||= options.database || options.db || env.PG_DATABASE || env.PGDATABASE || decodeIfValid((url?.pathname ?? "").slice(1)) || username;
      break;
    }
    case "mysql": {
      database ||= options.database || options.db || env.MYSQL_DATABASE || env.MYSQLDATABASE || decodeIfValid((url?.pathname ?? "").slice(1)) || "mysql";
      break;
    }
    case "mariadb": {
      database ||= options.database || options.db || env.MARIADB_DATABASE || env.MARIADBDATABASE || decodeIfValid((url?.pathname ?? "").slice(1)) || "mariadb";
      break;
    }
  }
  let connection = options.connection;
  if (connection && @isObject(connection)) {
    for (let key in connection)
      if (connection[key] !== @undefined)
        query += `${key}\x00${connection[key]}\x00`;
  }
  if (tls ||= options.tls || options.ssl, max = options.max, idleTimeout ??= options.idleTimeout, idleTimeout ??= options.idle_timeout, connectionTimeout ??= options.connectionTimeout, connectionTimeout ??= options.connection_timeout, connectionTimeout ??= options.connectTimeout, connectionTimeout ??= options.connect_timeout, maxLifetime ??= options.maxLifetime, maxLifetime ??= options.max_lifetime, bigint ??= options.bigint, options.prepare === !1) {
    if (adapter === "mysql")
      throw @makeErrorWithCode(119, "options.prepare", !1, "prepared: false is not supported in MySQL");
    prepare = !1;
  }
  if (onconnect ??= options.onconnect, onclose ??= options.onclose, onconnect !== @undefined) {
    if (!@isCallable(onconnect))
      throw @makeErrorWithCode(118, "onconnect", "function", onconnect);
  }
  if (onclose !== @undefined) {
    if (!@isCallable(onclose))
      throw @makeErrorWithCode(118, "onclose", "function", onclose);
  }
  if (idleTimeout != null) {
    if (idleTimeout = Number(idleTimeout), idleTimeout > 2147483648 || idleTimeout < 0 || idleTimeout !== idleTimeout)
      throw @makeErrorWithCode(119, "options.idle_timeout", idleTimeout, "must be a non-negative integer less than 2^31");
    idleTimeout *= 1000;
  }
  if (connectionTimeout != null) {
    if (connectionTimeout = Number(connectionTimeout), connectionTimeout > 2147483648 || connectionTimeout < 0 || connectionTimeout !== connectionTimeout)
      throw @makeErrorWithCode(119, "options.connection_timeout", connectionTimeout, "must be a non-negative integer less than 2^31");
    connectionTimeout *= 1000;
  }
  if (maxLifetime != null) {
    if (maxLifetime = Number(maxLifetime), maxLifetime > 2147483648 || maxLifetime < 0 || maxLifetime !== maxLifetime)
      throw @makeErrorWithCode(119, "options.max_lifetime", maxLifetime, "must be a non-negative integer less than 2^31");
    maxLifetime *= 1000;
  }
  if (max != null) {
    if (max = Number(max), max > 2147483648 || max < 1 || max !== max)
      throw @makeErrorWithCode(119, "options.max", max, "must be a non-negative integer between 1 and 2^31");
  }
  if (sslMode !== 0 /* disable */ && !tls?.serverName) {
    if (hostname)
      tls = { ...tls, serverName: hostname };
    else if (tls)
      tls = !0;
  }
  if (tls && sslMode === 0 /* disable */)
    sslMode = 1 /* prefer */;
  if (port = Number(port), !Number.isSafeInteger(port) || port < 1 || port > 65535)
    throw @makeErrorWithCode(119, "port", port, "must be a non-negative integer between 1 and 65535");
  let ret = {
    adapter,
    hostname,
    port,
    username,
    password,
    database,
    tls,
    prepare,
    bigint,
    sslMode,
    query,
    max: max || 10
  };
  if (idleTimeout != null)
    ret.idleTimeout = idleTimeout;
  if (connectionTimeout != null)
    ret.connectionTimeout = connectionTimeout;
  if (maxLifetime != null)
    ret.maxLifetime = maxLifetime;
  if (onconnect !== @undefined)
    ret.onconnect = onconnect;
  if (onclose !== @undefined)
    ret.onclose = onclose;
  if (path) {
    if ((@getInternalField(@internalModuleRegistry, 98) || @createInternalModuleById(98)).existsSync(path))
      ret.path = path;
  }
  return ret;
}
$ = {
  parseDefinitelySqliteUrl,
  isOptionsOfAdapter,
  assertIsOptionsOfAdapter,
  parseOptions,
  SQLHelper,
  buildDefinedColumnsAndQuery,
  normalizeSSLMode,
  SQLResultArray,
  SQLArrayParameter,
  SSLMode
};
return $})

