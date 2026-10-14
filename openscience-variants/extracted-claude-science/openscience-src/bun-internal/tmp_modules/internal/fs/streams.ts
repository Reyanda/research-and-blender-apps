(function (){"use strict";// build/release/tmp_modules/internal/fs/streams.ts
var $, { Readable, Writable, finished } = @getInternalField(@internalModuleRegistry, 117) || @createInternalModuleById(117), fs = @getInternalField(@internalModuleRegistry, 98) || @createInternalModuleById(98), { read, write, fsync, writev } = fs, { FileHandle, kRef, kUnref, kFd } = fs.promises.@data, { validateInteger, validateInt32, validateFunction } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), kReadStreamFastPath = Symbol("kReadStreamFastPath"), kWriteStreamFastPath = Symbol("kWriteStreamFastPath"), kFs = Symbol("kFs"), {
  read: fileHandlePrototypeRead,
  write: fileHandlePrototypeWrite,
  fsync: fileHandlePrototypeFsync,
  writev: fileHandlePrototypeWritev
} = FileHandle.prototype, fileHandleStreamFs = (fh) => ({
  read: fh.read === fileHandlePrototypeRead ? read : function(fd, buf, offset, length, pos, cb) {
    return fh.read(buf, offset, length, pos).then(({ bytesRead, buffer }) => cb(null, bytesRead, buffer), (err) => cb(err, 0, buf));
  },
  write: fh.write === fileHandlePrototypeWrite ? write : function(fd, buffer, offset, length, position, cb) {
    return fh.write(buffer, offset, length, position).then(({ bytesWritten, buffer: buffer2 }) => cb(null, bytesWritten, buffer2), (err) => cb(err, 0, buffer));
  },
  writev: fh.writev === fileHandlePrototypeWritev ? writev : @undefined,
  fsync: fh.sync === fileHandlePrototypeFsync ? fsync : function(fd, cb) {
    return fh.sync().then(() => cb(), cb);
  },
  close: streamFileHandleClose.bind(fh)
});
function streamFileHandleClose(fd, cb) {
  this[kUnref](), this.close().then(() => cb(), cb);
}
function getValidatedPath(p) {
  if (p instanceof URL)
    return Bun.fileURLToPath(p);
  if (typeof p !== "string")
    throw @makeErrorWithCode(118, "path", "string or URL", p);
  return (@getInternalField(@internalModuleRegistry, 107) || @createInternalModuleById(107)).resolve(p);
}
function copyObject(source) {
  let target = {};
  for (let key in source)
    target[key] = source[key];
  return target;
}
function getStreamOptions(options, defaultOptions = {}) {
  if (options == null || typeof options === "function")
    return defaultOptions;
  if (typeof options === "string") {
    if (options !== "buffer" && !@Buffer.isEncoding(options))
      throw @makeErrorWithCode(119, "encoding", options, "is invalid encoding");
    return { encoding: options };
  } else if (typeof options !== "object")
    throw @makeErrorWithCode(118, "options", ["string", "Object"], options);
  let { encoding, signal = !0 } = options;
  if (encoding && encoding !== "buffer" && !@Buffer.isEncoding(encoding))
    throw @makeErrorWithCode(119, "encoding", encoding, "is invalid encoding");
  if (signal !== !0 && !signal)
    throw @makeErrorWithCode(118, "signal", "AbortSignal", signal);
  return options;
}
function ReadStream(path, options) {
  if (!(this instanceof ReadStream))
    return new ReadStream(path, options);
  options = copyObject(getStreamOptions(options)), options.decodeStrings = !0;
  let { fd, autoClose, fs: customFs, start, end = @Infinity, encoding } = options;
  if (fd == null) {
    this[kFs] = customFs || fs, this.fd = null, this.path = getValidatedPath(path);
    let { flags, mode } = options;
    if (this.flags = flags === @undefined ? "r" : flags, this.mode = mode === @undefined ? 438 : mode, customFs)
      validateFunction(customFs.open, "options.fs.open");
  } else if (typeof options.fd === "number") {
    if (Object.is(fd, -0))
      fd = 0;
    else
      validateInt32(fd, "fd", 0, 2147483647);
    this.fd = fd, this[kFs] = customFs || fs;
  } else if (typeof fd === "object" && fd instanceof FileHandle) {
    if (options.fs)
      throw @makeErrorWithCode(149, "fs.FileHandle with custom fs operations");
    this[kFs] = fileHandleStreamFs(fd), this.fd = fd[kFd], fd[kRef](), fd.on("close", this.close.bind(this));
  } else
    throw @makeErrorWithCode(118, "options.fd", "number or FileHandle", fd);
  if (customFs)
    validateFunction(customFs.read, "options.fs.read");
  if ((options.autoDestroy = autoClose === @undefined ? !0 : autoClose) && customFs)
    validateFunction(customFs.close, "options.fs.close");
  if (this.start = start, this.end = end, this.pos = @undefined, this.bytesRead = 0, start !== @undefined)
    validateInteger(start, "start", 0), this.pos = start;
  if (end === @undefined)
    end = @Infinity;
  else if (end !== @Infinity) {
    if (validateInteger(end, "end", 0), start !== @undefined && start > end)
      throw @makeErrorWithCode(156, "start", `<= "end" (here: ${end})`, start);
  }
  return this[kReadStreamFastPath] = start === 0 && end === @Infinity && autoClose && !customFs && (encoding === "buffer" || encoding === "binary" || encoding == null || encoding === "utf-8" || encoding === "utf8"), Readable.@call(this, options), this;
}
@toClass(ReadStream, "ReadStream", Readable);
var readStreamPrototype = ReadStream.prototype;
Object.defineProperty(readStreamPrototype, "autoClose", {
  get() {
    return this._readableState.autoDestroy;
  },
  set(val) {
    this._readableState.autoDestroy = val;
  }
});
var streamNoop = function open() {};
function streamConstruct(callback) {
  let { fd } = this;
  if (typeof fd === "number") {
    callback();
    return;
  }
  let fastPath = this[kWriteStreamFastPath];
  if (this.open !== streamNoop) {
    let orgEmit = this.emit;
    this.emit = function(...args) {
      if (args[0] === "open")
        this.emit = orgEmit, callback(), orgEmit.@apply(this, args);
      else if (args[0] === "error")
        this.emit = orgEmit, callback(args[1]);
      else
        orgEmit.@apply(this, args);
    }, this.open();
  } else {
    if (fastPath) {
      callback(), this.emit("open", this.fd), this.emit("ready");
      return;
    }
    this[kFs].open(this.path, this.flags, this.mode, (err, fd2) => {
      if (err)
        callback(err);
      else
        this.fd = fd2, callback(), this.emit("open", this.fd), this.emit("ready");
    });
  }
}
readStreamPrototype.open = streamNoop;
readStreamPrototype._construct = streamConstruct;
readStreamPrototype._read = function(n) {
  if (n = this.pos !== @undefined ? @min(this.end - this.pos + 1, n) : @min(this.end - this.bytesRead + 1, n), n <= 0) {
    this.push(null);
    return;
  }
  let buf = @Buffer.allocUnsafeSlow(n);
  this[kFs].read(this.fd, buf, 0, n, this.pos, (er, bytesRead, buf2) => {
    if (er)
      (@getInternalField(@internalModuleRegistry, 43) || @createInternalModuleById(43)).errorOrDestroy(this, er);
    else if (bytesRead > 0) {
      if (this.pos !== @undefined)
        this.pos += bytesRead;
      if (this.bytesRead += bytesRead, bytesRead !== buf2.length) {
        let dst = @Buffer.allocUnsafeSlow(bytesRead);
        buf2.copy(dst, 0, 0, bytesRead), buf2 = dst;
      }
      this.push(buf2);
    } else
      this.push(null);
  });
};
readStreamPrototype._destroy = function(err, cb) {
  if (this[kReadStreamFastPath])
    this.once(kReadStreamFastPath, (er) => close(this, err || er, cb));
  else
    close(this, err, cb);
};
readStreamPrototype.close = function(cb) {
  if (typeof cb === "function")
    finished(this, cb);
  this.destroy();
};
Object.defineProperty(readStreamPrototype, "pending", {
  get() {
    return this.fd == null;
  },
  configurable: !0
});
function close(stream, err, cb) {
  let fastPath = stream[kWriteStreamFastPath];
  if (fastPath && fastPath !== !0) {
    stream.fd = null;
    let maybePromise = fastPath.end(err);
    thenIfPromise(maybePromise, () => {
      cb(err);
    });
    return;
  }
  if (!stream.fd)
    cb(err);
  else if (stream.flush)
    stream[kFs].fsync(stream.fd, (flushErr) => {
      closeAfterSync(stream, err || flushErr, cb);
    });
  else
    closeAfterSync(stream, err, cb);
}
function closeAfterSync(stream, err, cb) {
  stream[kFs].close(stream.fd, (er) => {
    cb(er || err);
  }), stream.fd = null;
}
ReadStream.prototype.pipe = function(dest, pipeOpts) {
  return Readable.prototype.pipe.@call(this, dest, pipeOpts);
};
function WriteStream(path, options) {
  if (!(this instanceof WriteStream))
    return new WriteStream(path, options);
  let fastPath = options?.@fastPath;
  options = copyObject(getStreamOptions(options)), options.decodeStrings = !0;
  let { fd, autoClose, fs: customFs, start, flush } = options;
  if (fd == null) {
    this[kFs] = customFs || fs, this.fd = null, this.path = getValidatedPath(path);
    let { flags, mode } = options;
    if (this.flags = flags === @undefined ? "w" : flags, this.mode = mode === @undefined ? 438 : mode, customFs)
      validateFunction(customFs.open, "options.fs.open");
  } else if (typeof options.fd === "number") {
    if (Object.is(fd, -0))
      fd = 0;
    else
      validateInt32(fd, "fd", 0, 2147483647);
    this.fd = fd, this[kFs] = customFs || fs;
  } else if (typeof fd === "object" && fd instanceof FileHandle) {
    if (options.fs)
      throw @makeErrorWithCode(149, "fs.FileHandle with custom fs operations");
    this[kFs] = customFs = fileHandleStreamFs(fd), fd[kRef](), fd.on("close", this.close.bind(this)), this.fd = fd = fd[kFd];
  } else
    throw @makeErrorWithCode(118, "options.fd", "number or FileHandle", fd);
  let autoDestroy = autoClose = options.autoDestroy = autoClose === @undefined ? !0 : autoClose;
  if (customFs) {
    let { write: write2, writev: writev2, close: close2, fsync: fsync2 } = customFs;
    if (write2)
      validateFunction(write2, "options.fs.write");
    if (writev2)
      validateFunction(writev2, "options.fs.writev");
    if (autoDestroy)
      validateFunction(close2, "options.fs.close");
    if (flush)
      validateFunction(fsync2, "options.fs.fsync");
    if (!write2 && !writev2)
      throw @makeErrorWithCode(118, "options.fs.write", "function", write2);
  } else
    this._writev = @undefined;
  if (flush == null)
    this.flush = !1;
  else {
    if (typeof flush !== "boolean")
      throw @makeErrorWithCode(118, "options.flush", "boolean", flush);
    this.flush = flush;
  }
  if (this.start = start, this.pos = @undefined, this.bytesWritten = 0, start !== @undefined)
    validateInteger(start, "start", 0), this.pos = start;
  if (fastPath)
    this[kWriteStreamFastPath] = fd ? Bun.file(fd).writer() : !0, this._write = underscoreWriteFast, this._writev = @undefined, this.write = writeFast;
  if (Writable.@call(this, options), options.encoding)
    this.setDefaultEncoding(options.encoding);
  return this;
}
@toClass(WriteStream, "WriteStream", Writable);
var writeStreamPrototype = WriteStream.prototype;
writeStreamPrototype.open = streamNoop;
writeStreamPrototype._construct = streamConstruct;
function writeAll(data, size, pos, cb, retries = 0) {
  this[kFs].write(this.fd, data, 0, size, pos, (er, bytesWritten, buffer) => {
    if (er?.code === "EAGAIN")
      er = null, bytesWritten = 0;
    if (this.destroyed || er)
      return cb(er || @makeErrorWithCode(228, "write"));
    if (this.bytesWritten += bytesWritten, retries = bytesWritten ? 0 : retries + 1, size -= bytesWritten, pos += bytesWritten, retries > 5)
      cb(Error("write failed"));
    else if (size)
      writeAll.@call(this, buffer.slice(bytesWritten), size, pos, cb, retries);
    else
      cb();
  });
}
function writevAll(chunks, size, pos, cb, retries = 0) {
  this[kFs].writev(this.fd, chunks, this.pos, (er, bytesWritten, buffers) => {
    if (er?.code === "EAGAIN")
      er = null, bytesWritten = 0;
    if (this.destroyed || er)
      return cb(er || @makeErrorWithCode(228, "writev"));
    if (this.bytesWritten += bytesWritten, retries = bytesWritten ? 0 : retries + 1, size -= bytesWritten, pos += bytesWritten, retries > 5)
      cb(Error("writev failed"));
    else if (size)
      writevAll.@call(this, [@Buffer.concat(buffers).slice(bytesWritten)], size, pos, cb, retries);
    else
      cb();
  });
}
function _write(data, encoding, cb) {
  let fileSink = this[kWriteStreamFastPath];
  if (fileSink && fileSink !== !0) {
    let maybePromise = fileSink.write(data);
    if (@isPromise(maybePromise))
      return maybePromise.then(() => {
        this.emit("drain"), cb(null);
      }).catch(cb), !1;
    else
      return cb(null), !0;
  } else if (writeAll.@call(this, data, data.length, this.pos, (er) => {
    if (this.destroyed) {
      cb(er);
      return;
    }
    cb(er);
  }), this.pos !== @undefined)
    this.pos += data.length;
}
writeStreamPrototype._write = _write;
function underscoreWriteFast(data, encoding, cb) {
  let fileSink = this[kWriteStreamFastPath];
  if (!fileSink)
    return this._write = _write, this._write(data, encoding, cb);
  let hasCallback = typeof cb === "function";
  try {
    if (fileSink === !0)
      fileSink = this[kWriteStreamFastPath] = Bun.file(this.path).writer(), this.fd = fileSink._getFd();
    let maybePromise = fileSink.write(data);
    if (@isPromise(maybePromise))
      return maybePromise.then(() => {
        if (cb)
          cb(null);
        this.emit("drain");
      }, (err) => {
        if (cb)
          cb(err);
        if (!hasCallback)
          this.destroy(err);
      }), !1;
    else {
      if (cb)
        process.nextTick(cb, null);
      return !0;
    }
  } catch (e) {
    if (cb)
      process.nextTick(cb, e);
    if (!hasCallback)
      this.destroy(e);
    return !1;
  }
}
var writablePrototypeWrite = Writable.prototype.write, kWriteMonkeyPatchDefense = Symbol("!");
function writeFast(data, encoding, cb) {
  if (this[kWriteMonkeyPatchDefense])
    return writablePrototypeWrite.@call(this, data, encoding, cb);
  if (typeof encoding === "function")
    cb = encoding, encoding = @undefined;
  let hasCallback = typeof cb === "function";
  if (!hasCallback)
    cb = streamNoop;
  let fileSink = this[kWriteStreamFastPath];
  if (fileSink && fileSink !== !0) {
    let maybePromise = fileSink.write(data);
    if (@isPromise(maybePromise))
      return maybePromise.then(() => {
        this.emit("drain"), cb(null);
      }).catch((err) => {
        if (cb(err), !hasCallback)
          this.destroy(err);
      }), !1;
    else
      return cb(null), !0;
  } else {
    let result = this._write(data, encoding, cb);
    if (this.write === writeFast)
      this.write = writablePrototypeWrite;
    else
      this[kWriteMonkeyPatchDefense] = !0;
    return result;
  }
}
writeStreamPrototype._writev = function(data, cb) {
  let len = data.length, chunks = new @Array(len), size = 0;
  for (let i = 0;i < len; i++) {
    let chunk = data[i].chunk;
    chunks[i] = chunk, size += chunk.length;
  }
  let fileSink = this[kWriteStreamFastPath];
  if (fileSink && fileSink !== !0) {
    let maybePromise = fileSink.write(@Buffer.concat(chunks));
    if (@isPromise(maybePromise))
      return maybePromise.then(() => {
        this.emit("drain"), cb(null);
      }).catch(cb), !1;
    else
      return cb(null), !0;
  } else if (writevAll.@call(this, chunks, size, this.pos, (er) => {
    if (this.destroyed) {
      cb(er);
      return;
    }
    cb(er);
  }), this.pos !== @undefined)
    this.pos += size;
};
writeStreamPrototype._destroy = function(err, cb) {
  let sink = this[kWriteStreamFastPath];
  if (sink && sink !== !0) {
    let end = sink.end(err);
    if (@isPromise(end)) {
      end.then(() => cb(err), cb);
      return;
    }
  }
  close(this, err, cb);
};
writeStreamPrototype.close = function(cb) {
  if (cb) {
    if (this.closed) {
      process.nextTick(cb);
      return;
    }
    this.on("close", cb);
  }
  if (!this.autoClose)
    this.on("finish", this.destroy);
  this.end();
};
writeStreamPrototype.destroySoon = writeStreamPrototype.end;
Object.defineProperty(writeStreamPrototype, "autoClose", {
  get() {
    return this._writableState.autoDestroy;
  },
  set(val) {
    this._writableState.autoDestroy = val;
  }
});
Object.defineProperty(writeStreamPrototype, "pending", {
  get() {
    return this.fd === null;
  },
  configurable: !0
});
function thenIfPromise(maybePromise, cb) {
  if (@isPromise(maybePromise))
    maybePromise.then(() => cb(null), cb);
  else
    process.nextTick(cb, null);
}
function writableFromFileSink(fileSink) {
  let w = new WriteStream("", { @fastPath: !0 });
  return w[kWriteStreamFastPath] = fileSink, w.path = @undefined, w;
}
$ = {
  ReadStream,
  WriteStream,
  kWriteStreamFastPath,
  writableFromFileSink
};
return $})

