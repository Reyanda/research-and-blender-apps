(function (){"use strict";// build/release/tmp_modules/node/fs.ts
var $, EventEmitter = @getInternalField(@internalModuleRegistry, 96) || @createInternalModuleById(96), promises = @getInternalField(@internalModuleRegistry, 97) || @createInternalModuleById(97), types = @getInternalField(@internalModuleRegistry, 144) || @createInternalModuleById(144), { validateFunction, validateInteger } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), kEmptyObject = Object.freeze(Object.create(null)), isDate = types.isDate, { fs } = promises.@data, constants = @processBindingConstants.fs, _lazyGlob;
function lazyGlob() {
  return _lazyGlob ??= @getInternalField(@internalModuleRegistry, 22) || @createInternalModuleById(22);
}
function ensureCallback(callback) {
  if (!@isCallable(callback))
    throw @makeErrorWithCode(118, "cb", "function", callback);
  return callback;
}
function nullcallback(callback) {
  return FunctionPrototypeBind.@call(callback, @undefined, null);
}
var FunctionPrototypeBind = nullcallback.bind;

class FSWatcher extends EventEmitter {
  #watcher;
  #listener;
  constructor(path, options, listener) {
    super();
    if (path instanceof URL)
      path = Bun.fileURLToPath(path);
    else if (typeof path === "string" && path.startsWith("file:"))
      path = Bun.fileURLToPath(path);
    if (typeof options === "function")
      listener = options, options = {};
    else if (typeof options === "string")
      options = { encoding: options };
    if (typeof listener !== "function")
      listener = () => {};
    this.#listener = listener;
    try {
      this.#watcher = fs.watch(path, options || {}, this.#onEvent.bind(this));
    } catch (e) {
      throw e.path = path, e.filename = path, e;
    }
  }
  #onEvent(eventType, filenameOrError) {
    if (eventType === "close") {
      queueMicrotask(() => {
        this.emit("close", filenameOrError);
      });
      return;
    } else if (eventType === "error") {
      if (filenameOrError.code === "EACCES")
        filenameOrError.code = "EPERM";
      this.emit(eventType, filenameOrError);
    } else
      this.emit("change", eventType, filenameOrError), this.#listener(eventType, filenameOrError);
  }
  close() {
    this.#watcher?.close(), this.#watcher = null;
  }
  ref() {
    this.#watcher?.ref();
  }
  unref() {
    this.#watcher?.unref();
  }
  start() {}
}
function openAsBlob(path, options) {
  return @Promise.@resolve(Bun.file(path, options));
}
function emitStop(self) {
  self.emit("stop");
}

class StatWatcher extends EventEmitter {
  _handle;
  constructor(path, options) {
    super();
    this._handle = fs.watchFile(path, options, this.#onChange.bind(this));
  }
  #onChange(curr, prev) {
    this.emit("change", curr, prev);
  }
  start() {}
  stop() {
    if (!this._handle)
      return;
    process.nextTick(emitStop, this), this._handle.close(), this._handle = null;
  }
  ref() {
    this._handle?.ref();
  }
  unref() {
    this._handle?.unref();
  }
}
var access = function access2(path, mode, callback) {
  if (@isCallable(mode))
    callback = mode, mode = @undefined;
  ensureCallback(callback), fs.access(path, mode).then(callback, callback);
}, appendFile = function appendFile2(path, data, options, callback) {
  if (!@isCallable(callback))
    callback = options, options = @undefined;
  ensureCallback(callback), fs.appendFile(path, data, options).then(nullcallback(callback), callback);
}, close = function close2(fd, callback) {
  if (@isCallable(callback))
    fs.close(fd).then(() => callback(null), callback);
  else if (callback === @undefined)
    fs.close(fd).then(() => {});
  else
    callback = ensureCallback(callback);
}, rm = function rm2(path, options, callback) {
  if (@isCallable(options))
    callback = options, options = @undefined;
  ensureCallback(callback), fs.rm(path, options).then(nullcallback(callback), callback);
}, rmdir = function rmdir2(path, options, callback) {
  if (@isCallable(options))
    callback = options, options = @undefined;
  fs.rmdir(path, options).then(nullcallback(callback), callback);
}, copyFile = function copyFile2(src, dest, mode, callback) {
  if (@isCallable(mode))
    callback = mode, mode = 0;
  ensureCallback(callback), fs.copyFile(src, dest, mode).then(nullcallback(callback), callback);
}, exists = function exists2(path, callback) {
  ensureCallback(callback);
  try {
    fs.exists.@apply(fs, [path]).then((existed) => callback(existed), (_) => callback(!1));
  } catch {
    callback(!1);
  }
}, chown = function chown2(path, uid, gid, callback) {
  ensureCallback(callback), fs.chown(path, uid, gid).then(nullcallback(callback), callback);
}, chmod = function chmod2(path, mode, callback) {
  ensureCallback(callback), fs.chmod(path, mode).then(nullcallback(callback), callback);
}, fchmod = function fchmod2(fd, mode, callback) {
  ensureCallback(callback), fs.fchmod(fd, mode).then(nullcallback(callback), callback);
}, fchown = function fchown2(fd, uid, gid, callback) {
  ensureCallback(callback), fs.fchown(fd, uid, gid).then(nullcallback(callback), callback);
}, fstat = function fstat2(fd, options, callback) {
  if (@isCallable(options))
    callback = options, options = @undefined;
  fs.fstat(fd, options).then(function(stats) {
    callback(null, stats);
  }, callback);
}, fsync = function fsync2(fd, callback) {
  ensureCallback(callback), fs.fsync(fd).then(nullcallback(callback), callback);
}, ftruncate = function ftruncate2(fd, len = 0, callback) {
  if (@isCallable(len))
    callback = len, len = 0;
  ensureCallback(callback), fs.ftruncate(fd, len).then(nullcallback(callback), callback);
}, futimes = function futimes2(fd, atime, mtime, callback) {
  ensureCallback(callback), fs.futimes(fd, atime, mtime).then(nullcallback(callback), callback);
}, lchmod = constants.O_SYMLINK !== @undefined ? function lchmod2(path, mode, callback) {
  ensureCallback(callback), fs.lchmod(path, mode).then(nullcallback(callback), callback);
} : @undefined, lchown = function lchown2(path, uid, gid, callback) {
  ensureCallback(callback), fs.lchown(path, uid, gid).then(nullcallback(callback), callback);
}, link = function link2(existingPath, newPath, callback) {
  ensureCallback(callback), fs.link(existingPath, newPath).then(nullcallback(callback), callback);
}, mkdir = function mkdir2(path, options, callback) {
  if (@isCallable(options))
    callback = options, options = @undefined;
  ensureCallback(callback), fs.mkdir(path, options).then(nullcallback(callback), callback);
}, mkdtemp = function mkdtemp2(prefix, options, callback) {
  if (@isCallable(options))
    callback = options, options = @undefined;
  ensureCallback(callback), fs.mkdtemp(prefix, options).then(function(folder) {
    callback(null, folder);
  }, callback);
}, open = function open2(path, flags, mode, callback) {
  if (arguments.length < 3)
    callback = flags;
  else if (@isCallable(mode))
    callback = mode, mode = @undefined;
  ensureCallback(callback), fs.open(path, flags, mode).then(function(fd) {
    callback(null, fd);
  }, callback);
}, fdatasync = function fdatasync2(fd, callback) {
  ensureCallback(callback), fs.fdatasync(fd).then(nullcallback(callback), callback);
}, read = function read2(fd, buffer, offsetOrOptions, length, position, callback) {
  let offset = offsetOrOptions, params = null;
  if (arguments.length <= 4) {
    if (arguments.length === 4) {
      if (typeof params !== "object" || @isArray(params))
        throw @makeErrorWithCode(118, "options", "object", params);
      callback = length, params = offsetOrOptions;
    } else if (arguments.length === 3) {
      if (!types.isArrayBufferView(buffer))
        params = buffer, { buffer = @Buffer.alloc(16384) } = params ?? {};
      callback = offsetOrOptions;
    } else
      callback = buffer, buffer = @Buffer.alloc(16384);
    if (params !== @undefined) {
      if (typeof params !== "object" || @isArray(params))
        throw @makeErrorWithCode(118, "options", "object", params);
    }
    ({ offset = 0, length = buffer?.byteLength - offset, position = null } = params ?? {});
  }
  if (!callback)
    throw @makeErrorWithCode(118, "callback", "function", callback);
  fs.read(fd, buffer, offset, length, position).then((bytesRead) => void callback(null, bytesRead, buffer), (err) => callback(err));
}, write = function write2(fd, buffer, offsetOrOptions, length, position, callback) {
  function wrapper(bytesWritten) {
    callback(null, bytesWritten, buffer);
  }
  if (@isTypedArrayView(buffer)) {
    if (callback ||= position || length || offsetOrOptions, ensureCallback(callback), typeof offsetOrOptions === "object")
      ({
        offset: offsetOrOptions = 0,
        length = buffer.byteLength - offsetOrOptions,
        position = null
      } = offsetOrOptions ?? {});
    fs.write(fd, buffer, offsetOrOptions, length, position).then(wrapper, callback);
    return;
  }
  if (!@isCallable(position)) {
    if (@isCallable(offsetOrOptions))
      position = offsetOrOptions, offsetOrOptions = @undefined;
    else
      position = length;
    length = "utf8";
  }
  callback = position, ensureCallback(callback), fs.write(fd, buffer, offsetOrOptions, length).then(wrapper, callback);
}, readdir = function readdir2(path, options, callback) {
  if (@isCallable(options))
    callback = options, options = @undefined;
  ensureCallback(callback), fs.readdir(path, options).then(function(files) {
    callback(null, files);
  }, callback);
}, readFile = function readFile2(path, options, callback) {
  callback ||= options, ensureCallback(callback), fs.readFile(path, options).then(function(data) {
    callback(null, data);
  }, callback);
}, writeFile = function writeFile2(path, data, options, callback) {
  callback ||= options, ensureCallback(callback), fs.writeFile(path, data, options).then(nullcallback(callback), callback);
}, readlink = function readlink2(path, options, callback) {
  if (@isCallable(options))
    callback = options, options = @undefined;
  ensureCallback(callback), fs.readlink(path, options).then(function(linkString) {
    callback(null, linkString);
  }, callback);
}, rename = function rename2(oldPath, newPath, callback) {
  ensureCallback(callback), fs.rename(oldPath, newPath).then(nullcallback(callback), callback);
}, lstat = function lstat2(path, options, callback) {
  if (@isCallable(options))
    callback = options, options = @undefined;
  ensureCallback(callback), fs.lstat(path, options).then(function(stats) {
    callback(null, stats);
  }, callback);
}, stat = function stat2(path, options, callback) {
  if (@isCallable(options))
    callback = options, options = @undefined;
  ensureCallback(callback), fs.stat(path, options).then(function(stats) {
    callback(null, stats);
  }, callback);
}, statfs = function statfs2(path, options, callback) {
  if (@isCallable(options))
    callback = options, options = @undefined;
  ensureCallback(callback), fs.statfs(path, options).then(function(stats) {
    callback(null, stats);
  }, callback);
}, symlink = function symlink2(target, path, type, callback) {
  if (callback === @undefined)
    callback = type, ensureCallback(callback), type = @undefined;
  fs.symlink(target, path, type).then(callback, callback);
}, truncate = function truncate2(path, len, callback) {
  if (typeof path === "number") {
    ftruncate(path, len, callback);
    return;
  }
  if (@isCallable(len))
    callback = len, len = 0;
  else if (len === @undefined)
    len = 0;
  ensureCallback(callback), fs.truncate(path, len).then(nullcallback(callback), callback);
}, unlink = function unlink2(path, callback) {
  ensureCallback(callback), fs.unlink(path).then(nullcallback(callback), callback);
}, utimes = function utimes2(path, atime, mtime, callback) {
  ensureCallback(callback), fs.utimes(path, atime, mtime).then(nullcallback(callback), callback);
}, lutimes = function lutimes2(path, atime, mtime, callback) {
  ensureCallback(callback), fs.lutimes(path, atime, mtime).then(nullcallback(callback), callback);
}, accessSync = fs.accessSync.bind(fs), appendFileSync = fs.appendFileSync.bind(fs), closeSync = fs.closeSync.bind(fs), copyFileSync = fs.copyFileSync.bind(fs), existsSync = function existsSync2(_path) {
  try {
    return fs.existsSync.@apply(fs, arguments);
  } catch {
    return !1;
  }
}, chownSync = fs.chownSync.bind(fs), chmodSync = fs.chmodSync.bind(fs), fchmodSync = fs.fchmodSync.bind(fs), fchownSync = fs.fchownSync.bind(fs), fstatSync = fs.fstatSync.bind(fs), fsyncSync = fs.fsyncSync.bind(fs), ftruncateSync = fs.ftruncateSync.bind(fs), futimesSync = fs.futimesSync.bind(fs), lchmodSync = constants.O_SYMLINK !== @undefined ? fs.lchmodSync.bind(fs) : @undefined, lchownSync = fs.lchownSync.bind(fs), linkSync = fs.linkSync.bind(fs), lstatSync = fs.lstatSync.bind(fs), mkdirSync = fs.mkdirSync.bind(fs), mkdtempSync = fs.mkdtempSync.bind(fs), openSync = fs.openSync.bind(fs), readSync = function readSync2(fd, buffer, offsetOrOptions, length, position) {
  let offset = offsetOrOptions;
  if (arguments.length <= 3 || typeof offsetOrOptions === "object") {
    if (offsetOrOptions !== @undefined) {
      if (typeof offsetOrOptions !== "object" || @isArray(offsetOrOptions))
        throw @makeErrorWithCode(118, "options", "object", offsetOrOptions);
    }
    ({ offset = 0, length = buffer.byteLength - offset, position = null } = offsetOrOptions ?? {});
  }
  return fs.readSync(fd, buffer, offset, length, position);
}, writeSync = fs.writeSync.bind(fs), readdirSync = fs.readdirSync.bind(fs), readFileSync = fs.readFileSync.bind(fs), fdatasyncSync = fs.fdatasyncSync.bind(fs), writeFileSync = fs.writeFileSync.bind(fs), readlinkSync = fs.readlinkSync.bind(fs), renameSync = fs.renameSync.bind(fs), statSync = fs.statSync.bind(fs), statfsSync = fs.statfsSync.bind(fs), symlinkSync = fs.symlinkSync.bind(fs), truncateSync = fs.truncateSync.bind(fs), unlinkSync = fs.unlinkSync.bind(fs), utimesSync = fs.utimesSync.bind(fs), lutimesSync = fs.lutimesSync.bind(fs), rmSync = fs.rmSync.bind(fs), rmdirSync = fs.rmdirSync.bind(fs), writev = function writev2(fd, buffers, position, callback) {
  if (typeof position === "function")
    callback = position, position = null;
  callback = ensureCallback(callback), fs.writev(fd, buffers, position).@then((bytesWritten) => callback(null, bytesWritten, buffers), callback);
}, writevSync = fs.writevSync.bind(fs), readv = function readv2(fd, buffers, position, callback) {
  if (typeof position === "function")
    callback = position, position = null;
  callback = ensureCallback(callback), fs.readv(fd, buffers, position).@then((bytesRead) => callback(null, bytesRead, buffers), callback);
}, readvSync = fs.readvSync.bind(fs), Dirent = fs.Dirent, Stats = fs.Stats, watch = function watch2(path, options, listener) {
  return new FSWatcher(path, options, listener);
}, opendir = function opendir2(path, options, callback) {
  if (typeof options === "function")
    callback = options, options = @undefined;
  validateFunction(callback, "callback");
  let result = new Dir(1, path, options);
  callback(null, result);
}, { defineCustomPromisifyArgs } = @getInternalField(@internalModuleRegistry, 31) || @createInternalModuleById(31), kCustomPromisifiedSymbol = Symbol.for("nodejs.util.promisify.custom"), existsCb = exists;
exists[kCustomPromisifiedSymbol] = {
  exists(path) {
    return new @Promise((resolve) => existsCb(path, resolve));
  }
}.exists;
defineCustomPromisifyArgs(read, ["bytesRead", "buffer"]);
defineCustomPromisifyArgs(readv, ["bytesRead", "buffers"]);
defineCustomPromisifyArgs(write, ["bytesWritten", "buffer"]);
defineCustomPromisifyArgs(writev, ["bytesWritten", "buffers"]);
var statWatchers = /* @__PURE__ */ new Map;
function getValidatedPath(p) {
  if (p instanceof URL)
    return Bun.fileURLToPath(p);
  if (typeof p !== "string")
    throw @makeErrorWithCode(118, "path", "string or URL", p);
  if (p.startsWith("file:"))
    return Bun.fileURLToPath(p);
  return (@getInternalField(@internalModuleRegistry, 107) || @createInternalModuleById(107)).resolve(p);
}
function watchFile(filename, options, listener) {
  if (filename = getValidatedPath(filename), typeof options === "function")
    listener = options, options = {};
  if (typeof listener !== "function")
    throw @makeErrorWithCode(118, "listener", "function", listener);
  var stat3 = statWatchers.get(filename);
  if (!stat3)
    stat3 = new StatWatcher(filename, options), statWatchers.set(filename, stat3);
  return stat3.addListener("change", listener), stat3;
}
function unwatchFile(filename, listener) {
  filename = getValidatedPath(filename);
  var stat3 = statWatchers.get(filename);
  if (!stat3)
    return throwIfNullBytesInFileName(filename);
  if (listener) {
    if (stat3.removeListener("change", listener), stat3.listenerCount("change") !== 0)
      return;
  } else
    stat3.removeAllListeners("change");
  stat3.stop(), statWatchers.delete(filename);
}
function throwIfNullBytesInFileName(filename) {
  if (filename.indexOf("\x00") !== -1)
    throw @makeErrorWithCode(119, "path", "string without null bytes", filename);
}
function createReadStream(path, options) {
  return new exports.ReadStream(path, options);
}
function createWriteStream(path, options) {
  return new exports.WriteStream(path, options);
}
var realpathSync = fs.realpathSync.bind(fs), realpath = function realpath2(p, options, callback) {
  if (@isCallable(options))
    callback = options, options = @undefined;
  ensureCallback(callback), fs.realpath(p, options, !1).then(function(resolvedPath) {
    callback(null, resolvedPath);
  }, callback);
};
realpath.native = function realpath4(p, options, callback) {
  if (@isCallable(options))
    callback = options, options = @undefined;
  ensureCallback(callback), fs.realpathNative(p, options).then(function(resolvedPath) {
    callback(null, resolvedPath);
  }, callback);
};
realpathSync.native = fs.realpathNativeSync.bind(fs);
function cpSync(src, dest, options) {
  if (!options)
    return fs.cpSync(src, dest);
  if (typeof options !== "object")
    @throwTypeError("options must be an object");
  if (options.dereference || options.filter || options.preserveTimestamps || options.verbatimSymlinks)
    return (@getInternalField(@internalModuleRegistry, 20) || @createInternalModuleById(20))(src, dest, options);
  return fs.cpSync(src, dest, options.recursive, options.errorOnExist, options.force ?? !0, options.mode);
}
function cp(src, dest, options, callback) {
  if (@isCallable(options))
    callback = options, options = @undefined;
  ensureCallback(callback), promises.cp(src, dest, options).then(() => callback(), callback);
}
function _toUnixTimestamp(time, name = "time") {
  if (typeof time === "string" && +time == time)
    return +time;
  if (@isFinite(time)) {
    if (time < 0)
      return Date.now() / 1000;
    return time;
  }
  if (isDate(time))
    return time.getTime() / 1000;
  throw @makeErrorWithCode(118, name, "number or Date", time);
}
function opendirSync(path, options) {
  return new Dir(1, path, options);
}

class Dir {
  #handle;
  #path;
  #options;
  #entries = null;
  constructor(handle, path, options) {
    if (@isUndefinedOrNull(handle))
      throw @makeErrorWithCode(150, "handle");
    validateInteger(handle, "handle", 0), this.#handle = @toLength(handle), this.#path = path, this.#options = options;
  }
  readSync() {
    if (this.#handle < 0)
      throw @makeErrorWithCode(52);
    return (this.#entries ??= fs.readdirSync(this.#path, {
      withFileTypes: !0,
      encoding: this.#options?.encoding,
      recursive: this.#options?.recursive
    })).shift() ?? null;
  }
  read(cb) {
    if (this.#handle < 0)
      throw @makeErrorWithCode(52);
    if (!@isUndefinedOrNull(cb))
      return validateFunction(cb, "callback"), this.read().then((entry) => cb(null, entry));
    if (this.#entries)
      return @Promise.@resolve(this.#entries.shift() ?? null);
    return fs.readdir(this.#path, {
      withFileTypes: !0,
      encoding: this.#options?.encoding,
      recursive: this.#options?.recursive
    }).then((entries) => {
      return this.#entries = entries, entries.shift() ?? null;
    });
  }
  close(cb) {
    let handle = this.#handle;
    if (handle < 0)
      throw @makeErrorWithCode(52);
    if (!@isUndefinedOrNull(cb))
      validateFunction(cb, "callback"), process.nextTick(cb);
    if (handle > 2)
      fs.closeSync(handle);
    this.#handle = -1;
  }
  closeSync() {
    let handle = this.#handle;
    if (handle < 0)
      throw @makeErrorWithCode(52);
    if (handle > 2)
      fs.closeSync(handle);
    this.#handle = -1;
  }
  get path() {
    return this.#path;
  }
  async* [Symbol.asyncIterator]() {
    yield* this.#entries ??= await fs.readdir(this.#path, {
      withFileTypes: !0,
      encoding: this.#options?.encoding,
      recursive: this.#options?.recursive
    });
  }
}
function glob(pattern, options, callback) {
  if (typeof options === "function")
    callback = options, options = @undefined;
  validateFunction(callback, "callback"), @Array.fromAsync(lazyGlob().glob(pattern, options ?? kEmptyObject)).then((result) => callback(null, result)).catch(callback);
}
function globSync(pattern, options) {
  return @Array.from(lazyGlob().globSync(pattern, options ?? kEmptyObject));
}
var exports = {
  appendFile,
  appendFileSync,
  access,
  accessSync,
  chown,
  chownSync,
  chmod,
  chmodSync,
  close,
  closeSync,
  copyFile,
  copyFileSync,
  cp,
  cpSync,
  createReadStream,
  createWriteStream,
  exists,
  existsSync,
  fchown,
  fchownSync,
  fchmod,
  fchmodSync,
  fdatasync,
  fdatasyncSync,
  fstat,
  fstatSync,
  fsync,
  fsyncSync,
  ftruncate,
  ftruncateSync,
  futimes,
  futimesSync,
  glob,
  globSync,
  lchown,
  lchownSync,
  lchmod,
  lchmodSync,
  link,
  linkSync,
  lstat,
  lstatSync,
  lutimes,
  lutimesSync,
  mkdir,
  mkdirSync,
  mkdtemp,
  mkdtempSync,
  open,
  openSync,
  read,
  readFile,
  readFileSync,
  readSync,
  readdir,
  readdirSync,
  readlink,
  readlinkSync,
  readv,
  readvSync,
  realpath,
  realpathSync,
  rename,
  renameSync,
  rm,
  rmSync,
  rmdir,
  rmdirSync,
  stat,
  statfs,
  statSync,
  statfsSync,
  symlink,
  symlinkSync,
  truncate,
  truncateSync,
  unlink,
  unlinkSync,
  unwatchFile,
  utimes,
  utimesSync,
  watch,
  watchFile,
  write,
  writeFile,
  writeFileSync,
  writeSync,
  writev,
  writevSync,
  _toUnixTimestamp,
  openAsBlob,
  Dirent,
  opendir,
  opendirSync,
  F_OK: 0,
  R_OK: 4,
  W_OK: 2,
  X_OK: 1,
  constants,
  Dir,
  Stats,
  get ReadStream() {
    return exports.ReadStream = (@getInternalField(@internalModuleRegistry, 23) || @createInternalModuleById(23)).ReadStream;
  },
  set ReadStream(value) {
    Object.defineProperty(exports, "ReadStream", {
      value,
      writable: !0,
      configurable: !0
    });
  },
  get WriteStream() {
    return exports.WriteStream = (@getInternalField(@internalModuleRegistry, 23) || @createInternalModuleById(23)).WriteStream;
  },
  set WriteStream(value) {
    Object.defineProperty(exports, "WriteStream", {
      value,
      writable: !0,
      configurable: !0
    });
  },
  get FileReadStream() {
    return exports.FileReadStream = (@getInternalField(@internalModuleRegistry, 23) || @createInternalModuleById(23)).ReadStream;
  },
  set FileReadStream(value) {
    Object.defineProperty(exports, "FileReadStream", {
      value,
      writable: !0,
      configurable: !0
    });
  },
  get FileWriteStream() {
    return exports.FileWriteStream = (@getInternalField(@internalModuleRegistry, 23) || @createInternalModuleById(23)).WriteStream;
  },
  set FileWriteStream(value) {
    Object.defineProperty(exports, "FileWriteStream", {
      value,
      writable: !0,
      configurable: !0
    });
  },
  promises
};
$ = exports;
function setName(fn, value) {
  Object.@defineProperty(fn, "name", { value, enumerable: !1, configurable: !0 });
}
setName(Dirent, "Dirent");
setName(FSWatcher, "FSWatcher");
setName(Stats, "Stats");
setName(_toUnixTimestamp, "_toUnixTimestamp");
setName(access, "access");
setName(accessSync, "accessSync");
setName(appendFile, "appendFile");
setName(appendFileSync, "appendFileSync");
setName(chmod, "chmod");
setName(chmodSync, "chmodSync");
setName(chown, "chown");
setName(chownSync, "chownSync");
setName(close, "close");
setName(closeSync, "closeSync");
setName(copyFile, "copyFile");
setName(copyFileSync, "copyFileSync");
setName(cp, "cp");
setName(cpSync, "cpSync");
setName(createReadStream, "createReadStream");
setName(createWriteStream, "createWriteStream");
setName(exists, "exists");
setName(existsSync, "existsSync");
setName(fchmod, "fchmod");
setName(fchmodSync, "fchmodSync");
setName(fchown, "fchown");
setName(fchownSync, "fchownSync");
setName(fstat, "fstat");
setName(fstatSync, "fstatSync");
setName(fsync, "fsync");
setName(fsyncSync, "fsyncSync");
setName(ftruncate, "ftruncate");
setName(ftruncateSync, "ftruncateSync");
setName(futimes, "futimes");
setName(futimesSync, "futimesSync");
if (lchmod)
  setName(lchmod, "lchmod");
if (lchmodSync)
  setName(lchmodSync, "lchmodSync");
setName(lchown, "lchown");
setName(lchownSync, "lchownSync");
setName(link, "link");
setName(linkSync, "linkSync");
setName(lstat, "lstat");
setName(lstatSync, "lstatSync");
setName(lutimes, "lutimes");
setName(lutimesSync, "lutimesSync");
setName(mkdir, "mkdir");
setName(mkdirSync, "mkdirSync");
setName(mkdtemp, "mkdtemp");
setName(mkdtempSync, "mkdtempSync");
setName(open, "open");
setName(openSync, "openSync");
setName(read, "read");
setName(readFile, "readFile");
setName(readFileSync, "readFileSync");
setName(readSync, "readSync");
setName(readdir, "readdir");
setName(readdirSync, "readdirSync");
setName(readlink, "readlink");
setName(readlinkSync, "readlinkSync");
setName(readv, "readv");
setName(readvSync, "readvSync");
setName(realpath, "realpath");
setName(realpathSync, "realpathSync");
setName(rename, "rename");
setName(renameSync, "renameSync");
setName(rm, "rm");
setName(rmSync, "rmSync");
setName(rmdir, "rmdir");
setName(rmdirSync, "rmdirSync");
setName(stat, "stat");
setName(statfs, "statfs");
setName(statSync, "statSync");
setName(statfsSync, "statfsSync");
setName(symlink, "symlink");
setName(symlinkSync, "symlinkSync");
setName(truncate, "truncate");
setName(truncateSync, "truncateSync");
setName(unlink, "unlink");
setName(unlinkSync, "unlinkSync");
setName(unwatchFile, "unwatchFile");
setName(utimes, "utimes");
setName(utimesSync, "utimesSync");
setName(watch, "watch");
setName(watchFile, "watchFile");
setName(write, "write");
setName(writeFile, "writeFile");
setName(writeFileSync, "writeFileSync");
setName(writeSync, "writeSync");
setName(writev, "writev");
setName(writevSync, "writevSync");
setName(fdatasync, "fdatasync");
setName(fdatasyncSync, "fdatasyncSync");
setName(openAsBlob, "openAsBlob");
setName(opendir, "opendir");
return $})

