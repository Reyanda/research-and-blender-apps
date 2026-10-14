(function (){"use strict";// build/release/tmp_modules/node/fs.promises.ts
var $, types = @getInternalField(@internalModuleRegistry, 144) || @createInternalModuleById(144), EventEmitter = @getInternalField(@internalModuleRegistry, 96) || @createInternalModuleById(96), fs = @lazy(53), { glob } = @getInternalField(@internalModuleRegistry, 22) || @createInternalModuleById(22), { validateInteger } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), constants = @processBindingConstants.fs, PromisePrototypeFinally = @Promise.prototype.finally, SymbolAsyncDispose = Symbol.asyncDispose, ObjectFreeze = Object.freeze, kFd = Symbol("kFd"), kRefs = Symbol("kRefs"), kClosePromise = Symbol("kClosePromise"), kCloseResolve = Symbol("kCloseResolve"), kCloseReject = Symbol("kCloseReject"), kRef = Symbol("kRef"), kUnref = Symbol("kUnref"), kTransfer = Symbol("kTransfer"), kTransferList = Symbol("kTransferList"), kDeserialize = Symbol("kDeserialize"), kEmptyObject = ObjectFreeze(Object.create(null)), kFlag = Symbol("kFlag"), Interface;
function watch(filename, options = {}) {
  if (filename instanceof URL)
    @throwTypeError("Watch URLs are not supported yet");
  else if (@Buffer.isBuffer(filename))
    filename = filename.toString();
  else if (typeof filename !== "string")
    throw @makeErrorWithCode(118, "filename", ["string", "Buffer", "URL"], filename);
  let nextEventResolve = null;
  if (typeof options === "string")
    options = { encoding: options };
  let queue = @createFIFO(), watcher = fs.watch(filename, options || {}, (eventType, filename2) => {
    if (queue.push({ eventType, filename: filename2 }), nextEventResolve) {
      let resolve = nextEventResolve;
      nextEventResolve = null, resolve();
    }
  });
  return {
    [Symbol.asyncIterator]() {
      let closed = !1;
      return {
        async next() {
          while (!closed) {
            let event;
            while (event = queue.shift()) {
              if (event.eventType === "close")
                return closed = !0, { value: @undefined, done: !0 };
              if (event.eventType === "error")
                throw closed = !0, event.filename;
              return { value: event, done: !1 };
            }
            let { promise, resolve } = @Promise.withResolvers();
            nextEventResolve = resolve, await promise;
          }
          return { value: @undefined, done: !0 };
        },
        return() {
          if (!closed) {
            if (watcher.close(), closed = !0, nextEventResolve) {
              let resolve = nextEventResolve;
              nextEventResolve = null, resolve();
            }
          }
          return { value: @undefined, done: !0 };
        }
      };
    }
  };
}
function cp(src, dest, options) {
  if (!options)
    return fs.cp(src, dest);
  if (typeof options !== "object")
    @throwTypeError("options must be an object");
  if (options.dereference || options.filter || options.preserveTimestamps || options.verbatimSymlinks)
    return (@getInternalField(@internalModuleRegistry, 21) || @createInternalModuleById(21))(src, dest, options);
  return fs.cp(src, dest, options.recursive, options.errorOnExist, options.force ?? !0, options.mode);
}
async function opendir(dir, options) {
  return new (@getInternalField(@internalModuleRegistry, 98) || @createInternalModuleById(98)).Dir(1, dir, options);
}
var private_symbols = {
  kRef,
  kUnref,
  kFd,
  FileHandle: null,
  fs
}, _readFile = fs.readFile.bind(fs), _writeFile = fs.writeFile.bind(fs), _appendFile = fs.appendFile.bind(fs), exports = {
  access: asyncWrap(fs.access, "access"),
  appendFile: async function(fileHandleOrFdOrPath, ...args) {
    return fileHandleOrFdOrPath = fileHandleOrFdOrPath?.[kFd] ?? fileHandleOrFdOrPath, _appendFile(fileHandleOrFdOrPath, ...args);
  },
  close: asyncWrap(fs.close, "close"),
  copyFile: asyncWrap(fs.copyFile, "copyFile"),
  cp,
  exists: async function exists() {
    try {
      return await fs.exists.@apply(fs, arguments);
    } catch {
      return !1;
    }
  },
  chown: asyncWrap(fs.chown, "chown"),
  chmod: asyncWrap(fs.chmod, "chmod"),
  fchmod: asyncWrap(fs.fchmod, "fchmod"),
  fchown: asyncWrap(fs.fchown, "fchown"),
  fstat: asyncWrap(fs.fstat, "fstat"),
  fsync: asyncWrap(fs.fsync, "fsync"),
  fdatasync: asyncWrap(fs.fdatasync, "fdatasync"),
  ftruncate: asyncWrap(fs.ftruncate, "ftruncate"),
  futimes: asyncWrap(fs.futimes, "futimes"),
  glob,
  lchmod: asyncWrap(fs.lchmod, "lchmod"),
  lchown: asyncWrap(fs.lchown, "lchown"),
  link: asyncWrap(fs.link, "link"),
  lstat: asyncWrap(fs.lstat, "lstat"),
  mkdir: asyncWrap(fs.mkdir, "mkdir"),
  mkdtemp: asyncWrap(fs.mkdtemp, "mkdtemp"),
  statfs: asyncWrap(fs.statfs, "statfs"),
  open: async (path, flags = "r", mode = 438) => {
    return new private_symbols.FileHandle(await fs.open(path, flags, mode), flags);
  },
  read: asyncWrap(fs.read, "read"),
  write: asyncWrap(fs.write, "write"),
  readdir: asyncWrap(fs.readdir, "readdir"),
  readFile: async function(fileHandleOrFdOrPath, ...args) {
    return fileHandleOrFdOrPath = fileHandleOrFdOrPath?.[kFd] ?? fileHandleOrFdOrPath, _readFile(fileHandleOrFdOrPath, ...args);
  },
  writeFile: async function(fileHandleOrFdOrPath, ...args) {
    if (fileHandleOrFdOrPath = fileHandleOrFdOrPath?.[kFd] ?? fileHandleOrFdOrPath, !@isTypedArrayView(args[0]) && typeof args[0] !== "string" && (@isCallable(args[0]?.[Symbol.iterator]) || @isCallable(args[0]?.[Symbol.asyncIterator])))
      return writeFileAsyncIterator(fileHandleOrFdOrPath, ...args);
    return _writeFile(fileHandleOrFdOrPath, ...args);
  },
  readlink: asyncWrap(fs.readlink, "readlink"),
  realpath: asyncWrap(fs.realpath, "realpath"),
  rename: asyncWrap(fs.rename, "rename"),
  stat: asyncWrap(fs.stat, "stat"),
  symlink: asyncWrap(fs.symlink, "symlink"),
  truncate: asyncWrap(fs.truncate, "truncate"),
  unlink: asyncWrap(fs.unlink, "unlink"),
  utimes: asyncWrap(fs.utimes, "utimes"),
  lutimes: asyncWrap(fs.lutimes, "lutimes"),
  rm: asyncWrap(fs.rm, "rm"),
  rmdir: asyncWrap(fs.rmdir, "rmdir"),
  writev: async (fd, buffers, position) => {
    var bytesWritten = await fs.writev(fd, buffers, position);
    return {
      bytesWritten,
      buffers
    };
  },
  readv: async (fd, buffers, position) => {
    var bytesRead = await fs.readv(fd, buffers, position);
    return {
      bytesRead,
      buffers
    };
  },
  constants,
  watch,
  opendir,
  @data: private_symbols
};
$ = exports;
function asyncWrap(fn, name) {
  let wrapped = async function(...args) {
    return fn.@apply(fs, args);
  };
  return Object.defineProperty(wrapped, "name", { value: name }), Object.defineProperty(wrapped, "length", { value: fn.length }), wrapped;
}
{
  let {
    writeFile,
    readFile,
    fchmod,
    fchown,
    fdatasync,
    fsync,
    read,
    readv,
    fstat,
    ftruncate,
    futimes,
    write,
    writev,
    close
  } = exports, isArrayBufferView;

  class FileHandle extends EventEmitter {
    constructor(fd, flag) {
      super();
      this[kFd] = fd ? fd : -1, this[kRefs] = 1, this[kClosePromise] = null, this[kFlag] = flag;
    }
    getAsyncId() {
      throw Error("BUN TODO FileHandle.getAsyncId");
    }
    get fd() {
      return this[kFd];
    }
    [kCloseResolve];
    [kFd];
    [kFlag];
    [kClosePromise];
    [kRefs];
    [Symbol("messaging_transfer_symbol")]() {}
    async appendFile(data, options) {
      let fd = this[kFd];
      throwEBADFIfNecessary("writeFile", fd);
      let encoding = "utf8", flush = !1;
      if (options == null || typeof options === "function")
        ;
      else if (typeof options === "string")
        encoding = options;
      else
        encoding = options?.encoding ?? encoding, flush = options?.flush ?? flush;
      try {
        return this[kRef](), await writeFile(fd, data, { encoding, flush, flag: this[kFlag] });
      } finally {
        this[kUnref]();
      }
    }
    async chmod(mode) {
      let fd = this[kFd];
      throwEBADFIfNecessary("fchmod", fd);
      try {
        return this[kRef](), await fchmod(fd, mode);
      } finally {
        this[kUnref]();
      }
    }
    async chown(uid, gid) {
      let fd = this[kFd];
      throwEBADFIfNecessary("fchown", fd);
      try {
        return this[kRef](), await fchown(fd, uid, gid);
      } finally {
        this[kUnref]();
      }
    }
    async datasync() {
      let fd = this[kFd];
      throwEBADFIfNecessary("fdatasync", fd);
      try {
        return this[kRef](), await fdatasync(fd);
      } finally {
        this[kUnref]();
      }
    }
    async sync() {
      let fd = this[kFd];
      throwEBADFIfNecessary("fsync", fd);
      try {
        return this[kRef](), await fsync(fd);
      } finally {
        this[kUnref]();
      }
    }
    async read(bufferOrParams, offset, length, position) {
      let fd = this[kFd];
      throwEBADFIfNecessary("fsync", fd);
      let buffer = bufferOrParams;
      if (!types.isArrayBufferView(buffer)) {
        if (bufferOrParams !== @undefined) {
          if (typeof bufferOrParams !== "object" || @isArray(bufferOrParams))
            throw @makeErrorWithCode(118, "options", "object", bufferOrParams);
        }
        ({
          buffer = @Buffer.alloc(16384),
          offset = 0,
          length = buffer.byteLength - offset,
          position = null
        } = bufferOrParams ?? kEmptyObject);
      }
      if (offset !== null && typeof offset === "object")
        ({ offset = 0, length = buffer?.byteLength - offset, position = null } = offset);
      if (offset == null)
        offset = 0;
      else
        validateInteger(offset, "offset", 0);
      length ??= buffer?.byteLength - offset;
      try {
        this[kRef]();
        let bytesRead = await read(fd, buffer, offset, length, position);
        return { buffer, bytesRead };
      } finally {
        this[kUnref]();
      }
    }
    async readv(buffers, position) {
      let fd = this[kFd];
      throwEBADFIfNecessary("readv", fd);
      try {
        return this[kRef](), await readv(fd, buffers, position);
      } finally {
        this[kUnref]();
      }
    }
    async readFile(options) {
      let fd = this[kFd];
      throwEBADFIfNecessary("readFile", fd);
      try {
        return this[kRef](), await readFile(fd, options);
      } finally {
        this[kUnref]();
      }
    }
    readLines(options = @undefined) {
      if (Interface === @undefined)
        Interface = (@getInternalField(@internalModuleRegistry, 113) || @createInternalModuleById(113)).Interface;
      return new Interface({
        input: this.createReadStream(options),
        crlfDelay: @Infinity
      });
    }
    async stat(options) {
      let fd = this[kFd];
      throwEBADFIfNecessary("fstat", fd);
      try {
        return this[kRef](), await fstat(fd, options);
      } finally {
        this[kUnref]();
      }
    }
    async truncate(len = 0) {
      let fd = this[kFd];
      throwEBADFIfNecessary("ftruncate", fd);
      try {
        return this[kRef](), await ftruncate(fd, len);
      } finally {
        this[kUnref]();
      }
    }
    async utimes(atime, mtime) {
      let fd = this[kFd];
      throwEBADFIfNecessary("futimes", fd);
      try {
        return this[kRef](), await futimes(fd, atime, mtime);
      } finally {
        this[kUnref]();
      }
    }
    async write(buffer, offset, length, position) {
      let fd = this[kFd];
      if (throwEBADFIfNecessary("write", fd), buffer?.byteLength === 0)
        return { __proto__: null, bytesWritten: 0, buffer };
      if (isArrayBufferView ??= (@getInternalField(@internalModuleRegistry, 144) || @createInternalModuleById(144)).isArrayBufferView, isArrayBufferView(buffer)) {
        if (typeof offset === "object")
          ({ offset = 0, length = buffer.byteLength - offset, position = null } = offset ?? kEmptyObject);
        if (offset == null)
          offset = 0;
        if (typeof length !== "number")
          length = buffer.byteLength - offset;
        if (typeof position !== "number")
          position = null;
      }
      try {
        return this[kRef](), { buffer, bytesWritten: await write(fd, buffer, offset, length, position) };
      } finally {
        this[kUnref]();
      }
    }
    async writev(buffers, position) {
      let fd = this[kFd];
      throwEBADFIfNecessary("writev", fd);
      try {
        return this[kRef](), await writev(fd, buffers, position);
      } finally {
        this[kUnref]();
      }
    }
    async writeFile(data, options = "utf8") {
      let fd = this[kFd];
      throwEBADFIfNecessary("writeFile", fd);
      let encoding = "utf8", signal = @undefined;
      if (options == null || typeof options === "function")
        ;
      else if (typeof options === "string")
        encoding = options;
      else
        encoding = options?.encoding ?? encoding, signal = options?.signal ?? @undefined;
      try {
        return this[kRef](), await writeFile(fd, data, { encoding, flag: this[kFlag], signal });
      } finally {
        this[kUnref]();
      }
    }
    async close() {
      let fd = this[kFd];
      if (fd === -1)
        return @Promise.@resolve();
      if (this[kClosePromise])
        return this[kClosePromise];
      if (--this[kRefs] === 0)
        this[kFd] = -1, this[kClosePromise] = PromisePrototypeFinally.@call(close(fd), () => {
          this[kClosePromise] = @undefined;
        });
      else
        this[kClosePromise] = PromisePrototypeFinally.@call(new @Promise((resolve, reject) => {
          this[kCloseResolve] = resolve, this[kCloseReject] = reject;
        }), () => {
          this[kClosePromise] = @undefined, this[kCloseReject] = @undefined, this[kCloseResolve] = @undefined;
        });
      return this.emit("close"), this[kClosePromise];
    }
    async[SymbolAsyncDispose]() {
      return this.close();
    }
    readableWebStream(_options = kEmptyObject) {
      let fd = this[kFd];
      return throwEBADFIfNecessary("readableWebStream", fd), Bun.file(fd).stream();
    }
    createReadStream(options = kEmptyObject) {
      let fd = this[kFd];
      return throwEBADFIfNecessary("createReadStream", fd), new (@getInternalField(@internalModuleRegistry, 23) || @createInternalModuleById(23)).ReadStream(@undefined, {
        highWaterMark: 65536,
        ...options,
        fd: this
      });
    }
    createWriteStream(options = kEmptyObject) {
      let fd = this[kFd];
      return throwEBADFIfNecessary("createWriteStream", fd), new (@getInternalField(@internalModuleRegistry, 23) || @createInternalModuleById(23)).WriteStream(@undefined, {
        highWaterMark: 65536,
        ...options,
        fd: this
      });
    }
    [kTransfer]() {
      throw Error("BUN TODO FileHandle.kTransfer");
    }
    [kTransferList]() {
      throw Error("BUN TODO FileHandle.kTransferList");
    }
    [kDeserialize](_) {
      throw Error("BUN TODO FileHandle.kDeserialize");
    }
    [kRef]() {
      this[kRefs]++;
    }
    [kUnref]() {
      if (--this[kRefs] === 0)
        this[kFd] = -1, this.close().@then(this[kCloseResolve], this[kCloseReject]);
    }
  }
  private_symbols.FileHandle = FileHandle;
}
function throwEBADFIfNecessary(fn, fd) {
  if (fd === -1) {
    let err = Error("Bad file descriptor");
    throw err.code = "EBADF", err.name = "SystemError", err.syscall = fn, err;
  }
}
async function writeFileAsyncIteratorInner(fd, iterable, encoding, signal) {
  let writer = Bun.file(fd).writer(), mustRencode = !(encoding === "utf8" || encoding === "utf-8" || encoding === "binary" || encoding === "buffer"), totalBytesWritten = 0;
  try {
    for await (let chunk of iterable) {
      if (signal?.aborted)
        throw signal.reason;
      if (mustRencode && typeof chunk === "string")
        chunk = @Buffer.from(chunk, encoding);
      else if (@isUndefinedOrNull(chunk))
        throw @makeErrorWithCode(118, "chunk", ["string", "ArrayBufferView", "ArrayBuffer"], chunk);
      let prom = writer.write(chunk);
      if (prom && @isPromise(prom))
        totalBytesWritten += await prom;
      else
        totalBytesWritten += prom;
    }
  } finally {
    await writer.end();
  }
  return totalBytesWritten;
}
async function writeFileAsyncIterator(fdOrPath, iterable, optionsOrEncoding, flag, mode) {
  let encoding, signal = null;
  if (typeof optionsOrEncoding === "object") {
    if (encoding = optionsOrEncoding?.encoding ?? (encoding || "utf8"), flag = optionsOrEncoding?.flag ?? (flag || "w"), mode = optionsOrEncoding?.mode ?? (mode || 438), signal = optionsOrEncoding?.signal ?? null, signal?.aborted)
      throw signal.reason;
  } else if (typeof optionsOrEncoding === "string" || optionsOrEncoding == null)
    encoding = optionsOrEncoding || "utf8", flag ??= "w", mode ??= 438;
  if (!@Buffer.isEncoding(encoding))
    @throwTypeError(`Unknown encoding: ${encoding}`);
  let mustClose = typeof fdOrPath === "string";
  if (mustClose)
    fdOrPath = await fs.open(fdOrPath, flag, mode);
  if (signal?.aborted) {
    if (mustClose)
      await fs.close(fdOrPath);
    throw signal.reason;
  }
  let totalBytesWritten = 0, error;
  try {
    totalBytesWritten = await writeFileAsyncIteratorInner(fdOrPath, iterable, encoding, signal);
  } catch (err) {
    error = err;
  }
  if (mustClose) {
    if (typeof flag === "string" && !flag.includes("a"))
      try {
        await fs.ftruncate(fdOrPath, totalBytesWritten);
      } catch {}
    await fs.close(fdOrPath);
  }
  if (signal?.aborted)
    error = signal.reason;
  if (error)
    throw error;
}
return $})

