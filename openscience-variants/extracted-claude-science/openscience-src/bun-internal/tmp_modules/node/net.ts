(function (){"use strict";// build/release/tmp_modules/node/net.ts
var $, Duplex = @getInternalField(@internalModuleRegistry, 44) || @createInternalModuleById(44), { getDefaultHighWaterMark } = @getInternalField(@internalModuleRegistry, 56) || @createInternalModuleById(56), EventEmitter = @getInternalField(@internalModuleRegistry, 96) || @createInternalModuleById(96), dns, normalizedArgsSymbol = Symbol("normalizedArgs"), { ExceptionWithHostPort, ConnResetException, NodeAggregateError, ErrnoException } = @getInternalField(@internalModuleRegistry, 32) || @createInternalModuleById(32), { kTimeout, getTimerDuration } = @getInternalField(@internalModuleRegistry, 60) || @createInternalModuleById(60), { validateFunction, validateNumber, validateAbortSignal, validatePort, validateBoolean, validateInt32, validateString } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), { isIPv4, isIPv6, isIP } = @getInternalField(@internalModuleRegistry, 28) || @createInternalModuleById(28), ArrayPrototypeIncludes = @Array.prototype.includes, ArrayPrototypePush = @Array.prototype.push, MathMax = Math.max, { UV_ECANCELED, UV_ETIMEDOUT } = process.binding("uv");
var getDefaultAutoSelectFamily = @lazy(61), setDefaultAutoSelectFamily = @lazy(62), getDefaultAutoSelectFamilyAttemptTimeout = @lazy(63), setDefaultAutoSelectFamilyAttemptTimeout = @lazy(64), SocketAddress = @lazy(65), BlockList = @lazy(66), newDetachedSocket = @lazy(67), doConnect = @lazy(68), addServerName = @lazy(69), upgradeDuplexToTLS = @lazy(38), isNamedPipeSocket = @lazy(70), getBufferedAmount = @lazy(71), bunTlsSymbol = Symbol.for("::buntls::"), bunSocketServerOptions = Symbol.for("::bunnetserveroptions::"), owner_symbol = Symbol("owner_symbol"), kServerSocket = Symbol("kServerSocket"), kBytesWritten = Symbol("kBytesWritten"), bunTLSConnectOptions = Symbol.for("::buntlsconnectoptions::"), kReinitializeHandle = Symbol("kReinitializeHandle"), kRealListen = Symbol("kRealListen"), kSetNoDelay = Symbol("kSetNoDelay"), kSetKeepAlive = Symbol("kSetKeepAlive"), kSetKeepAliveInitialDelay = Symbol("kSetKeepAliveInitialDelay"), kConnectOptions = Symbol("connect-options"), kAttach = Symbol("kAttach"), kCloseRawConnection = Symbol("kCloseRawConnection"), kpendingRead = Symbol("kpendingRead"), kupgraded = Symbol("kupgraded"), ksocket = Symbol("ksocket"), khandlers = Symbol("khandlers"), kclosed = Symbol("closed"), kended = Symbol("ended"), kwriteCallback = Symbol("writeCallback"), kSocketClass = Symbol("kSocketClass");
function endNT(socket, callback, err) {
  socket.@end(), callback(err);
}
function emitCloseNT(self, hasError) {
  self.emit("close", hasError);
}
function detachSocket(self) {
  if (!self)
    self = this;
  self._handle = null;
}
function destroyNT(self, err) {
  self.destroy(err);
}
function destroyWhenAborted(err) {
  if (!this.destroyed)
    this.destroy(err.target.reason);
}
function onSocketEnd() {
  if (!this.allowHalfOpen)
    this.write = writeAfterFIN;
}
function writeAfterFIN(chunk, encoding, cb) {
  if (!this.writableEnded)
    return Duplex.prototype.write.@call(this, chunk, encoding, cb);
  if (typeof encoding === "function")
    cb = encoding, encoding = null;
  let err = Error("This socket has been ended by the other party");
  if (err.code = "EPIPE", typeof cb === "function")
    process.nextTick(cb, err);
  return this.destroy(err), !1;
}
function onConnectEnd() {
  if (!this._hadError && this.secureConnecting) {
    let options = this[kConnectOptions];
    this._hadError = !0;
    let error = new ConnResetException("Client network socket disconnected before secure TLS connection was established");
    error.path = options.path, error.host = options.host, error.port = options.port, error.localAddress = options.localAddress, this.destroy(error);
  }
}
var SocketHandlers = {
  close(socket, err) {
    let self = socket.data;
    if (!self || self[kclosed])
      return;
    self[kclosed] = !0, detachSocket(self), SocketEmitEndNT(self, err), self.data = null;
  },
  data(socket, buffer) {
    let { data: self } = socket;
    if (!self)
      return;
    if (self._unrefTimer(), self.bytesRead += buffer.length, !self.push(buffer))
      socket.pause();
  },
  drain(socket) {
    let self = socket.data;
    if (!self)
      return;
    let callback = self[kwriteCallback];
    if (self.connecting = !1, callback) {
      let writeChunk = self._pendingData;
      if (socket.@write(writeChunk || "", self._pendingEncoding || "utf8"))
        self._pendingData = self[kwriteCallback] = null, callback(null);
      else
        self._pendingData = null;
      self[kBytesWritten] = socket.bytesWritten;
    }
  },
  end(socket) {
    let self = socket.data;
    if (!self)
      return;
    SocketEmitEndNT(self);
  },
  error(socket, error) {
    let self = socket.data;
    if (!self)
      return;
    if (self._hadError)
      return;
    self._hadError = !0;
    let callback = self[kwriteCallback];
    if (callback)
      self[kwriteCallback] = null, callback(error);
    self.emit("error", error);
  },
  open(socket) {
    let self = socket.data;
    if (!self)
      return;
    if (socket.timeout(0), self.timeout)
      self.setTimeout(self.timeout);
    self._handle = socket, self.connecting = !1;
    let options = self[bunTLSConnectOptions];
    if (options) {
      let { session } = options;
      if (session)
        self.setSession(session);
    }
    if (self[kSetNoDelay])
      socket.setNoDelay(!0);
    if (self[kSetKeepAlive])
      socket.setKeepAlive(!0, self[kSetKeepAliveInitialDelay]);
    if (!self[kupgraded])
      self[kBytesWritten] = socket.bytesWritten, self.emit("connect", self), self.emit("ready");
    SocketHandlers.drain(socket);
  },
  handshake(socket, success, verifyError) {
    let { data: self } = socket;
    if (!self)
      return;
    if (!success && verifyError?.code === "ECONNRESET")
      return;
    self._securePending = !1, self.secureConnecting = !1, self._secureEstablished = !!success, self.emit("secure", self), self.alpnProtocol = socket.alpnProtocol;
    let { checkServerIdentity } = self[bunTLSConnectOptions];
    if (!verifyError && typeof checkServerIdentity === "function") {
      let hostname = self.servername || self._host || "localhost", cert = self.getPeerCertificate(!0);
      if (cert)
        verifyError = checkServerIdentity(hostname, cert);
    }
    if (self._requestCert || self._rejectUnauthorized)
      if (verifyError) {
        if (self.authorized = !1, self.authorizationError = verifyError.code || verifyError.message, self._rejectUnauthorized) {
          self.destroy(verifyError);
          return;
        }
      } else
        self.authorized = !0;
    else
      self.authorized = !0;
    self.emit("secureConnect", verifyError), self.removeListener("end", onConnectEnd);
  },
  timeout(socket) {
    let self = socket.data;
    if (!self)
      return;
    self.emit("timeout", self);
  },
  binaryType: "buffer"
};
function SocketEmitEndNT(self, _err) {
  if (!self[kended]) {
    if (!self.allowHalfOpen)
      self.write = writeAfterFIN;
    self[kended] = !0, self.push(null);
  }
}
var ServerHandlers = {
  data(socket, buffer) {
    let { data: self } = socket;
    if (!self)
      return;
    if (self._unrefTimer(), self.bytesRead += buffer.length, !self.push(buffer))
      socket.pause();
  },
  close(socket, err) {
    let data = this.data;
    if (!data)
      return;
    if (!data[kclosed])
      data[kclosed] = !0, detachSocket(data), SocketEmitEndNT(data, err), data.data = null, socket[owner_symbol] = null;
  },
  end(socket) {
    SocketHandlers.end(socket);
  },
  open(socket) {
    let self = socket.data;
    socket[kServerSocket] = self._handle;
    let options = self[bunSocketServerOptions], { pauseOnConnect, connectionListener, [kSocketClass]: SClass, requestCert, rejectUnauthorized } = options, _socket = new SClass({});
    if (_socket.isServer = !0, _socket._requestCert = requestCert, _socket._rejectUnauthorized = rejectUnauthorized, _socket[kAttach](this.localPort, socket), self.blockList) {
      let addressType = isIP(socket.remoteAddress);
      if (addressType && self.blockList.check(socket.remoteAddress, `ipv${addressType}`)) {
        let data = {
          localAddress: _socket.localAddress,
          localPort: _socket.localPort || this.localPort,
          localFamily: _socket.localFamily,
          remoteAddress: _socket.remoteAddress,
          remotePort: _socket.remotePort,
          remoteFamily: _socket.remoteFamily || "IPv4"
        };
        socket.end(), self.emit("drop", data);
        return;
      }
    }
    if (self.maxConnections != null && self._connections >= self.maxConnections) {
      let data = {
        localAddress: _socket.localAddress,
        localPort: _socket.localPort || this.localPort,
        localFamily: _socket.localFamily,
        remoteAddress: _socket.remoteAddress,
        remotePort: _socket.remotePort,
        remoteFamily: _socket.remoteFamily || "IPv4"
      };
      socket.end(), self.emit("drop", data);
      return;
    }
    let isTLS = typeof _socket[bunTlsSymbol] === "function";
    if (self._connections++, _socket.server = self, pauseOnConnect)
      _socket.pause();
    if (typeof connectionListener === "function") {
      if (this.pauseOnConnect = pauseOnConnect, !isTLS)
        self.prependOnceListener("connection", connectionListener);
    }
    if (self.emit("connection", _socket), !pauseOnConnect && !isTLS)
      _socket.resume();
  },
  handshake(socket, success, verifyError) {
    let self = socket.data;
    if (!success && verifyError?.code === "ECONNRESET") {
      let err = new ConnResetException("socket hang up");
      self.emit("_tlsError", err), self.server.emit("tlsClientError", err, self), self._hadError = !0, self.destroy();
      return;
    }
    self._securePending = !1, self.secureConnecting = !1, self._secureEstablished = !!success, self.servername = socket.getServername();
    let server = self.server;
    if (self.alpnProtocol = socket.alpnProtocol, self._requestCert || self._rejectUnauthorized)
      if (verifyError) {
        if (self.authorized = !1, self.authorizationError = verifyError.code || verifyError.message, server.emit("tlsClientError", verifyError, self), self._rejectUnauthorized) {
          self.emit("secure", self), self.destroy(verifyError);
          return;
        }
      } else
        self.authorized = !0;
    else
      self.authorized = !0;
    let connectionListener = server[bunSocketServerOptions]?.connectionListener;
    if (typeof connectionListener === "function")
      server.prependOnceListener("secureConnection", connectionListener);
    if (server.emit("secureConnection", self), self.emit("secure", self), self.emit("secureConnect", verifyError), server.pauseOnConnect)
      self.pause();
    else
      self.resume();
  },
  error(socket, error) {
    let data = this.data;
    if (!data)
      return;
    if (data._hadError)
      return;
    if (data._hadError = !0, typeof this[bunTlsSymbol] === "function")
      if (!data._secureEstablished)
        data.destroy(error);
      else if (data.isServer && data._rejectUnauthorized && /peer did not return a certificate/.test(error?.message))
        data.destroy();
      else {
        data._emitTLSError(error), this.emit("_tlsError", error), this.server.emit("tlsClientError", error, data), SocketHandlers.error(socket, error, !0);
        return;
      }
    SocketHandlers.error(socket, error, !0), this.server?.emit("clientError", error, data);
  },
  timeout(socket) {
    SocketHandlers.timeout(socket);
  },
  drain(socket) {
    SocketHandlers.drain(socket);
  },
  binaryType: "buffer"
}, SocketHandlers2 = {
  open(socket) {
    let { self, req } = socket.data;
    if (socket[owner_symbol] = self, !self[kupgraded])
      req.oncomplete(0, self._handle, req, !0, !0);
    if (socket.data.req = @undefined, self.pauseOnConnect)
      self.pause();
    if (self[kupgraded]) {
      self.connecting = !1;
      let options = self[bunTLSConnectOptions];
      if (options) {
        let { session } = options;
        if (session)
          self.setSession(session);
      }
      SocketHandlers2.drain(socket);
    }
  },
  data(socket, buffer) {
    let { self } = socket.data;
    if (self._unrefTimer(), self.bytesRead += buffer.length, !self.push(buffer))
      socket.pause();
  },
  drain(socket) {
    let { self } = socket.data, callback = self[kwriteCallback];
    if (self.connecting = !1, callback) {
      let writeChunk = self._pendingData;
      if (socket.@write(writeChunk || "", self._pendingEncoding || "utf8"))
        self[kBytesWritten] = socket.bytesWritten, self._pendingData = self[kwriteCallback] = null, callback(null);
      else
        self[kBytesWritten] = socket.bytesWritten, self._pendingData = null;
    }
  },
  end(socket) {
    let { self } = socket.data;
    if (self[kended])
      return;
    if (self[kended] = !0, !self.allowHalfOpen)
      self.write = writeAfterFIN;
    self.push(null), self.read(0);
  },
  close(socket, err) {
    let { self } = socket.data;
    if (self[kclosed])
      return;
    if (self[kclosed] = !0, self[kended] = !0, !self.allowHalfOpen)
      self.write = writeAfterFIN;
    self.push(null), self.read(0);
  },
  handshake(socket, success, verifyError) {
    let { self } = socket.data;
    if (!success && verifyError?.code === "ECONNRESET")
      return;
    self._securePending = !1, self.secureConnecting = !1, self._secureEstablished = !!success, self.emit("secure", self), self.alpnProtocol = socket.alpnProtocol;
    let { checkServerIdentity } = self[bunTLSConnectOptions];
    if (!verifyError && typeof checkServerIdentity === "function") {
      let hostname = self.servername || self._host || "localhost", cert = self.getPeerCertificate(!0);
      if (cert)
        verifyError = checkServerIdentity(hostname, cert);
    }
    if (self._requestCert || self._rejectUnauthorized)
      if (verifyError) {
        if (self.authorized = !1, self.authorizationError = verifyError.code || verifyError.message, self._rejectUnauthorized) {
          self.destroy(verifyError);
          return;
        }
      } else
        self.authorized = !0;
    else
      self.authorized = !0;
    self.emit("secureConnect", verifyError), self.removeListener("end", onConnectEnd);
  },
  error(socket, error) {
    if (socket.data === @undefined)
      return;
    let { self } = socket.data;
    if (self._hadError)
      return;
    self._hadError = !0;
    let callback = self[kwriteCallback];
    if (callback)
      self[kwriteCallback] = null, callback(error);
    if (!self.destroyed)
      process.nextTick(destroyNT, self, error);
  },
  timeout(socket) {
    let { self } = socket.data;
    self.emit("timeout", self);
  },
  connectError(socket, error) {
    let { self, req } = socket.data;
    socket[owner_symbol] = self, req.oncomplete(error.errno, self._handle, req, !0, !0), socket.data.req = @undefined;
  }
};
function kConnectTcp(self, addressType, req, address, port) {
  return doConnect(self._handle, {
    hostname: address,
    port,
    ipv6Only: addressType === 6,
    allowHalfOpen: self.allowHalfOpen,
    tls: req.tls,
    data: { self, req },
    socket: self[khandlers]
  }).catch((_reason) => {}), 0;
}
function kConnectPipe(self, req, address) {
  return doConnect(self._handle, {
    hostname: address,
    unix: address,
    allowHalfOpen: self.allowHalfOpen,
    tls: req.tls,
    data: { self, req },
    socket: self[khandlers]
  }).catch((_reason) => {}), 0;
}
function Socket(options) {
  if (!(this instanceof Socket))
    return new Socket(options);
  let {
    socket,
    signal,
    allowHalfOpen = !1,
    onread = null,
    noDelay = !1,
    keepAlive = !1,
    keepAliveInitialDelay,
    ...opts
  } = options || {};
  if (options?.objectMode)
    throw @makeErrorWithCode(119, "options.objectMode", options.objectMode, "is not supported");
  if (options?.readableObjectMode)
    throw @makeErrorWithCode(119, "options.readableObjectMode", options.readableObjectMode, "is not supported");
  if (options?.writableObjectMode)
    throw @makeErrorWithCode(119, "options.writableObjectMode", options.writableObjectMode, "is not supported");
  if (keepAliveInitialDelay !== @undefined) {
    if (validateNumber(keepAliveInitialDelay, "options.keepAliveInitialDelay"), keepAliveInitialDelay < 0)
      keepAliveInitialDelay = 0;
  }
  if (options?.fd !== @undefined)
    validateInt32(options.fd, "options.fd", 0);
  if (Duplex.@call(this, {
    ...opts,
    allowHalfOpen,
    readable: !0,
    writable: !0,
    emitClose: !1,
    autoDestroy: !0,
    decodeStrings: !1
  }), this._parent = null, this._parentWrap = null, this[kpendingRead] = @undefined, this[kupgraded] = null, this[kSetNoDelay] = Boolean(noDelay), this[kSetKeepAlive] = Boolean(keepAlive), this[kSetKeepAliveInitialDelay] = ~~(keepAliveInitialDelay / 1000), this[khandlers] = SocketHandlers2, this.bytesRead = 0, this[kBytesWritten] = @undefined, this[kclosed] = !1, this[kended] = !1, this.connecting = !1, this._host = @undefined, this._port = @undefined, this[bunTLSConnectOptions] = null, this.timeout = 0, this[kwriteCallback] = @undefined, this._pendingData = @undefined, this._pendingEncoding = @undefined, this._hadError = !1, this.isServer = !1, this._handle = null, this[ksocket] = @undefined, this.server = @undefined, this.pauseOnConnect = !1, this._peername = null, this._sockname = null, this._closeAfterHandlingError = !1, this.on("end", onSocketEnd), options?.fd !== @undefined) {
    let { fd } = options;
    validateInt32(fd, "fd", 0);
  }
  if (socket instanceof Socket)
    this[ksocket] = socket;
  if (onread) {
    if (typeof onread !== "object")
      @throwTypeError("onread must be an object");
    if (typeof onread.callback !== "function")
      @throwTypeError("onread.callback must be a function");
    this[khandlers] = {
      ...SocketHandlers2,
      data(socket2, buffer) {
        let { self } = socket2.data;
        if (!self)
          return;
        self._unrefTimer();
        try {
          onread.callback(buffer.length, buffer);
        } catch (e) {
          self.emit("error", e);
        }
      }
    };
  }
  if (signal)
    if (signal.aborted)
      process.nextTick(destroyNT, this, signal.reason);
    else
      signal.addEventListener("abort", destroyWhenAborted.bind(this));
  if (opts.blockList) {
    if (!BlockList.isBlockList(opts.blockList))
      throw @makeErrorWithCode(118, "options.blockList", "net.BlockList", opts.blockList);
    this.blockList = opts.blockList;
  }
}
@toClass(Socket, "Socket", Duplex);
Socket.prototype.address = function address() {
  return {
    address: this.localAddress,
    family: this.localFamily,
    port: this.localPort
  };
};
Socket.prototype._onTimeout = function() {
  if (this._pendingData)
    return;
  let handle = this._handle;
  if (handle && getBufferedAmount(handle) > 0)
    return;
  this.emit("timeout");
};
Object.defineProperty(Socket.prototype, "bufferSize", {
  get: function() {
    return this.writableLength;
  }
});
Object.defineProperty(Socket.prototype, "_bytesDispatched", {
  get: function() {
    return this[kBytesWritten] || 0;
  }
});
Object.defineProperty(Socket.prototype, "bytesWritten", {
  get: function() {
    let bytes = this[kBytesWritten] || 0, data = this._pendingData, writableBuffer = this.writableBuffer;
    if (!writableBuffer)
      return @undefined;
    for (let el of writableBuffer)
      bytes += el.chunk instanceof @Buffer ? el.chunk.length : @Buffer.byteLength(el.chunk, el.encoding);
    if (@isArray(data))
      for (let i = 0;i < data.length; i++) {
        let chunk = data[i];
        if (data.allBuffers || chunk instanceof @Buffer)
          bytes += chunk.length;
        else
          bytes += @Buffer.byteLength(chunk.chunk, chunk.encoding);
      }
    else if (data)
      if (typeof data !== "string")
        bytes += data.length;
      else
        bytes += @Buffer.byteLength(data, this._pendingEncoding || "utf8");
    return bytes;
  }
});
Socket.prototype[kAttach] = function(port, socket) {
  if (socket.data = this, socket[owner_symbol] = this, this.timeout)
    this.setTimeout(this.timeout);
  if (socket.timeout(0), this._handle = socket, this.connecting = !1, this[kSetNoDelay])
    socket.setNoDelay(!0);
  if (this[kSetKeepAlive])
    socket.setKeepAlive(!0, this[kSetKeepAliveInitialDelay]);
  if (!this[kupgraded])
    this[kBytesWritten] = socket.bytesWritten, this.emit("connect", this), this.emit("ready");
  SocketHandlers.drain(socket);
};
Socket.prototype[kCloseRawConnection] = function() {
  let connection = this[kupgraded];
  connection.connecting = !1, connection._handle = null, connection.unref(), connection.destroy();
};
Socket.prototype.connect = function connect(...args) {
  {
    let [options2, connectListener] = @isArray(args[0]) && args[0][normalizedArgsSymbol] ? args[0] : normalizeArgs(args), connection = this[ksocket], upgradeDuplex = !1, { port, host, path: path2, socket, rejectUnauthorized, checkServerIdentity, session, fd, pauseOnConnect } = options2;
    if (this.servername = options2.servername, socket)
      connection = socket;
    if (fd)
      doConnect(this._handle, {
        data: this,
        fd,
        socket: SocketHandlers,
        allowHalfOpen: this.allowHalfOpen
      }).catch((error) => {
        if (!this.destroyed)
          this.emit("error", error), this.emit("close", !0);
      });
    if (this.pauseOnConnect = pauseOnConnect, pauseOnConnect)
      this.pause();
    else
      process.nextTick(() => {
        this.resume();
      }), this.connecting = !0;
    if (fd)
      return this;
    if (!(socket && @isObject(socket) && socket instanceof Duplex) && port === @undefined && path2 == null)
      throw @makeErrorWithCode(150, ["options", "port", "path"]);
    let bunTLS = this[bunTlsSymbol];
    var tls = @undefined;
    if (typeof bunTLS === "function") {
      if (tls = bunTLS.@call(this, port, host, !0), this._requestCert = !0, tls) {
        if (typeof rejectUnauthorized < "u")
          this._rejectUnauthorized = rejectUnauthorized, tls.rejectUnauthorized = rejectUnauthorized;
        else
          this._rejectUnauthorized = tls.rejectUnauthorized;
        if (tls.requestCert = !0, tls.session = session || tls.session, this.servername = tls.servername, tls.checkServerIdentity = checkServerIdentity || tls.checkServerIdentity, this[bunTLSConnectOptions] = tls, !connection && tls.socket)
          connection = tls.socket;
      }
      if (connection) {
        if (typeof connection !== "object" || !(connection instanceof Socket) || typeof connection[bunTlsSymbol] === "function")
          if (connection instanceof Duplex)
            upgradeDuplex = !0;
          else
            @throwTypeError("socket must be an instance of net.Socket or Duplex");
      }
      this.authorized = !1, this.secureConnecting = !0, this._secureEstablished = !1, this._securePending = !0, this[kConnectOptions] = options2, this.prependListener("end", onConnectEnd);
    }
    if (connection) {
      if (connectListener != null)
        this.once("secureConnect", connectListener);
      try {
        this._undestroy();
        let socket2 = connection._handle;
        if (!upgradeDuplex && socket2)
          upgradeDuplex = isNamedPipeSocket(socket2);
        if (upgradeDuplex) {
          this[kupgraded] = connection;
          let [result, events] = upgradeDuplexToTLS(connection, {
            data: { self: this, req: { oncomplete: afterConnect } },
            tls,
            socket: this[khandlers]
          });
          connection.on("data", events[0]), connection.on("end", events[1]), connection.on("drain", events[2]), connection.on("close", events[3]), this._handle = result;
        } else if (socket2) {
          this[kupgraded] = connection;
          let result = socket2.upgradeTLS({
            data: { self: this, req: { oncomplete: afterConnect } },
            tls,
            socket: this[khandlers]
          });
          if (result) {
            let [raw, tls2] = result;
            connection._handle = raw, this.once("end", this[kCloseRawConnection]), raw.connecting = !1, this._handle = tls2;
          } else
            throw this._handle = null, Error("Invalid socket");
        } else
          connection.once("connect", () => {
            let socket3 = connection._handle;
            if (!upgradeDuplex && socket3)
              upgradeDuplex = isNamedPipeSocket(socket3);
            if (upgradeDuplex) {
              this[kupgraded] = connection;
              let [result, events] = upgradeDuplexToTLS(connection, {
                data: { self: this, req: { oncomplete: afterConnect } },
                tls,
                socket: this[khandlers]
              });
              connection.on("data", events[0]), connection.on("end", events[1]), connection.on("drain", events[2]), connection.on("close", events[3]), this._handle = result;
            } else {
              this[kupgraded] = connection;
              let result = socket3.upgradeTLS({
                data: { self: this, req: { oncomplete: afterConnect } },
                tls,
                socket: this[khandlers]
              });
              if (result) {
                let [raw, tls2] = result;
                connection._handle = raw, this.once("end", this[kCloseRawConnection]), raw.connecting = !1, this._handle = tls2;
              } else
                throw this._handle = null, Error("Invalid socket");
            }
          });
      } catch (error) {
        process.nextTick(emitErrorAndCloseNextTick, this, error);
      }
      return this;
    }
  }
  let [options, cb] = @isArray(args[0]) && args[0][normalizedArgsSymbol] ? args[0] : normalizeArgs(args);
  if (typeof this[bunTlsSymbol] === "function" && cb !== null)
    this.once("secureConnect", cb);
  else if (cb !== null)
    this.once("connect", cb);
  if (this._parent?.connecting)
    return this;
  if (this.write !== Socket.prototype.write)
    this.write = Socket.prototype.write;
  if (this.destroyed)
    this._handle = null, this._peername = null, this._sockname = null;
  this.connecting = !0;
  let { path } = options, pipe = !!path;
  if (!this._handle)
    this._handle = newDetachedSocket(typeof this[bunTlsSymbol] === "function"), initSocketHandle(this);
  if (!pipe)
    lookupAndConnect(this, options);
  else
    validateString(path, "options.path"), internalConnect(this, options, path);
  return this;
};
Socket.prototype[kReinitializeHandle] = function reinitializeHandle(handle) {
  this._handle?.close(), this._handle = handle, this._handle[owner_symbol] = this, initSocketHandle(this);
};
Socket.prototype.end = function end(data, encoding, callback) {
  return Duplex.prototype.end.@call(this, data, encoding, callback);
};
Socket.prototype._destroy = function _destroy(err, callback) {
  this.connecting = !1;
  for (let s = this;s !== null; s = s._parent)
    clearTimeout(s[kTimeout]);
  if (this._handle) {
    let isException = err ? !0 : !1;
    if (this[kBytesWritten] = this._handle.bytesWritten, this.resetAndClosing) {
      this.resetAndClosing = !1;
      let err2 = this._handle.close();
      if (setImmediate(() => {
        this.emit("close", isException);
      }), err2)
        this.emit("error", new ErrnoException(err2, "reset"));
    } else if (this._closeAfterHandlingError)
      queueMicrotask(() => closeSocketHandle(this, isException, !0));
    else
      closeSocketHandle(this, isException);
    if (!this._closeAfterHandlingError) {
      if (this._handle)
        this._handle.onread = () => {};
      this._handle = null, this._sockname = null;
    }
    callback(err);
  } else
    callback(err), process.nextTick(emitCloseNT, this, !1);
  if (this.server) {
    if (this.server._connections--, this.server._emitCloseIfDrained)
      this.server._emitCloseIfDrained();
  }
};
Socket.prototype._final = function _final(callback) {
  if (this.connecting)
    return this.once("connect", () => this._final(callback));
  let socket = this._handle;
  if (!socket)
    return callback();
  process.nextTick(endNT, socket, callback);
};
Object.defineProperty(Socket.prototype, "localAddress", {
  get: function() {
    return this._getsockname().address;
  }
});
Object.defineProperty(Socket.prototype, "localFamily", {
  get: function() {
    return this._getsockname().family;
  }
});
Object.defineProperty(Socket.prototype, "localPort", {
  get: function() {
    return this._getsockname().port;
  }
});
Object.defineProperty(Socket.prototype, "_connecting", {
  get: function() {
    return this.connecting;
  }
});
Object.defineProperty(Socket.prototype, "pending", {
  get: function() {
    return !this._handle || this.connecting;
  }
});
Socket.prototype.resume = function resume() {
  if (!this.connecting)
    this._handle?.resume();
  return Duplex.prototype.resume.@call(this);
};
Socket.prototype.pause = function pause() {
  if (!this.destroyed)
    this._handle?.pause();
  return Duplex.prototype.pause.@call(this);
};
Socket.prototype.read = function read(size) {
  if (!this.connecting)
    this._handle?.resume();
  return Duplex.prototype.read.@call(this, size);
};
Socket.prototype._read = function _read(size) {
  let socket = this._handle;
  if (this.connecting || !socket)
    this.once("connect", () => this._read(size));
  else
    socket?.resume();
};
Socket.prototype._reset = function _reset() {
  return this.resetAndClosing = !0, this.destroy();
};
Socket.prototype._getpeername = function() {
  if (!this._handle || this.connecting)
    return this._peername || {};
  else if (!this._peername) {
    let family = this._handle.remoteFamily;
    if (!family)
      return {};
    this._peername = {
      family,
      address: this._handle.remoteAddress,
      port: this._handle.remotePort
    };
  }
  return this._peername;
};
Socket.prototype._getsockname = function() {
  if (!this._handle || this.connecting)
    return this._sockname || {};
  else if (!this._sockname) {
    let family = this._handle.localFamily;
    if (!family)
      return {};
    this._sockname = {
      family,
      address: this._handle.localAddress,
      port: this._handle.localPort
    };
  }
  return this._sockname;
};
Object.defineProperty(Socket.prototype, "readyState", {
  get: function() {
    if (this.connecting)
      return "opening";
    if (this.readable && this.writable)
      return "open";
    if (this.readable && !this.writable)
      return "readOnly";
    if (!this.readable && this.writable)
      return "writeOnly";
    return "closed";
  }
});
Socket.prototype.ref = function ref() {
  let socket = this._handle;
  if (!socket)
    return this.once("connect", this.ref), this;
  return socket.ref(), this;
};
Object.defineProperty(Socket.prototype, "remotePort", {
  get: function() {
    return this._getpeername().port;
  }
});
Object.defineProperty(Socket.prototype, "remoteAddress", {
  get: function() {
    return this._getpeername().address;
  }
});
Object.defineProperty(Socket.prototype, "remoteFamily", {
  get: function() {
    return this._getpeername().family;
  }
});
Socket.prototype.resetAndDestroy = function resetAndDestroy() {
  if (this._handle)
    if (this.connecting)
      this.once("connect", () => this._reset());
    else
      this._reset();
  else
    this.destroy(@makeErrorWithCode(220));
  return this;
};
Socket.prototype.setKeepAlive = function setKeepAlive(enable = !1, initialDelayMsecs = 0) {
  enable = Boolean(enable);
  let initialDelay = ~~(initialDelayMsecs / 1000);
  if (!this._handle)
    return this[kSetKeepAlive] = enable, this[kSetKeepAliveInitialDelay] = initialDelay, this;
  if (!this._handle.setKeepAlive)
    return this;
  if (enable !== this[kSetKeepAlive] || enable && this[kSetKeepAliveInitialDelay] !== initialDelay)
    this[kSetKeepAlive] = enable, this[kSetKeepAliveInitialDelay] = initialDelay, this._handle.setKeepAlive(enable, initialDelay);
  return this;
};
Socket.prototype.setNoDelay = function setNoDelay(enable = !0) {
  if (enable = Boolean(enable === @undefined ? !0 : enable), !this._handle)
    return this[kSetNoDelay] = enable, this;
  if (this._handle.setNoDelay && enable !== this[kSetNoDelay])
    this[kSetNoDelay] = enable, this._handle.setNoDelay(enable);
  return this;
};
Socket.prototype.setTimeout = {
  setTimeout(msecs, callback) {
    if (this.destroyed)
      return this;
    if (this.timeout = msecs, msecs = getTimerDuration(msecs, "msecs"), clearTimeout(this[kTimeout]), msecs === 0) {
      if (callback !== @undefined)
        validateFunction(callback, "callback"), this.removeListener("timeout", callback);
    } else if (this[kTimeout] = setTimeout(this._onTimeout.bind(this), msecs).unref(), callback !== @undefined)
      validateFunction(callback, "callback"), this.once("timeout", callback);
    return this;
  }
}.setTimeout;
Socket.prototype._unrefTimer = function _unrefTimer() {
  for (let s = this;s !== null; s = s._parent)
    if (s[kTimeout])
      s[kTimeout].refresh();
};
Socket.prototype.unref = function unref() {
  let socket = this._handle;
  if (!socket)
    return this.once("connect", this.unref), this;
  return socket.unref(), this;
};
Socket.prototype.destroySoon = function destroySoon() {
  if (this.writable)
    this.end();
  if (this.writableFinished)
    this.destroy();
  else
    this.once("finish", this.destroy);
};
Socket.prototype._writev = function _writev(data, callback) {
  let allBuffers = data.allBuffers, chunks = data;
  if (allBuffers) {
    if (data.length === 1)
      return this._write(data[0], "buffer", callback);
    for (let i = 0;i < data.length; i++)
      data[i] = data[i].chunk;
  } else {
    if (data.length === 1) {
      let { chunk: chunk2, encoding } = data[0];
      return this._write(chunk2, encoding, callback);
    }
    for (let i = 0;i < data.length; i++) {
      let { chunk: chunk2, encoding } = data[i];
      if (typeof chunk2 === "string")
        data[i] = @Buffer.from(chunk2, encoding);
      else
        data[i] = chunk2;
    }
  }
  let chunk = @Buffer.concat(chunks || []);
  return this._write(chunk, "buffer", callback);
};
Socket.prototype._write = function _write(chunk, encoding, callback) {
  if (this.connecting) {
    let onClose = function() {
      callback(@makeErrorWithCode(219));
    };
    this[kwriteCallback] = callback, this._pendingData = chunk, this._pendingEncoding = encoding, this.once("connect", function connect() {
      this.off("close", onClose), this._write(chunk, encoding, callback);
    }), this.once("close", onClose);
    return;
  }
  this._pendingData = null, this._pendingEncoding = "", this[kwriteCallback] = null;
  let socket = this._handle;
  if (!socket)
    return callback(@makeErrorWithCode(220)), !1;
  this._unrefTimer();
  let success = socket.@write(chunk, encoding);
  if (this[kBytesWritten] = socket.bytesWritten, success)
    callback();
  else if (this[kwriteCallback])
    callback(Error("overlapping _write()"));
  else
    this[kwriteCallback] = callback;
};
function createConnection(...args) {
  let normalized = normalizeArgs(args), options = normalized[0], socket = new Socket(options);
  if (options.timeout)
    socket.setTimeout(options.timeout);
  return socket.connect(normalized);
}
function lookupAndConnect(self, options) {
  let { localAddress, localPort } = options, host = options.host || "localhost", { port, autoSelectFamilyAttemptTimeout, autoSelectFamily } = options;
  if (validateString(host, "options.host"), localAddress && !isIP(localAddress))
    throw @makeErrorWithCode(128, localAddress);
  if (localPort)
    validateNumber(localPort, "options.localPort");
  if (typeof port < "u") {
    if (typeof port !== "number" && typeof port !== "string")
      throw @makeErrorWithCode(118, "options.port", ["number", "string"], port);
    validatePort(port);
  }
  if (port |= 0, autoSelectFamily != null)
    validateBoolean(autoSelectFamily, "options.autoSelectFamily");
  else
    autoSelectFamily = getDefaultAutoSelectFamily();
  if (autoSelectFamilyAttemptTimeout != null) {
    if (validateInt32(autoSelectFamilyAttemptTimeout, "options.autoSelectFamilyAttemptTimeout", 1), autoSelectFamilyAttemptTimeout < 10)
      autoSelectFamilyAttemptTimeout = 10;
  } else
    autoSelectFamilyAttemptTimeout = getDefaultAutoSelectFamilyAttemptTimeout();
  self._host = host, self._port = port;
  let addressType = isIP(host);
  if (addressType) {
    process.nextTick(() => {
      if (self.connecting)
        internalConnect(self, options, host, port, addressType, localAddress, localPort);
    });
    return;
  }
  if (options.lookup != null)
    validateFunction(options.lookup, "options.lookup");
  if (dns === @undefined)
    dns = @getInternalField(@internalModuleRegistry, 94) || @createInternalModuleById(94);
  let dnsopts = {
    family: socketToDnsFamily(options.family),
    hints: options.hints || 0
  };
  if (dnsopts.family !== 4 && dnsopts.family !== 6 && dnsopts.hints === 0)
    dnsopts.hints = dns.ADDRCONFIG;
  let lookup = options.lookup || dns.lookup;
  if (dnsopts.family !== 4 && dnsopts.family !== 6 && !localAddress && autoSelectFamily) {
    dnsopts.all = !0, lookupAndConnectMultiple(self, lookup, host, options, dnsopts, port, localAddress, localPort, autoSelectFamilyAttemptTimeout);
    return;
  }
  lookup(host, dnsopts, function emitLookup(err, ip, addressType2) {
    if (self.emit("lookup", err, ip, addressType2, host), !self.connecting)
      return;
    if (err)
      process.nextTick(destroyNT, self, err);
    else if (!isIP(ip))
      err = @makeErrorWithCode(128, ip), process.nextTick(destroyNT, self, err);
    else if (addressType2 !== 4 && addressType2 !== 6)
      err = @makeErrorWithCode(117, addressType2, options.host, options.port), process.nextTick(destroyNT, self, err);
    else
      self._unrefTimer(), internalConnect(self, options, ip, port, addressType2, localAddress, localPort);
  });
}
function socketToDnsFamily(family) {
  switch (family) {
    case "IPv4":
      return 4;
    case "IPv6":
      return 6;
  }
  return family;
}
function lookupAndConnectMultiple(self, lookup, host, options, dnsopts, port, localAddress, localPort, timeout) {
  lookup(host, dnsopts, function emitLookup(err, addresses) {
    if (!self.connecting)
      return;
    else if (err) {
      self.emit("lookup", err, @undefined, @undefined, host), process.nextTick(destroyNT, self, err);
      return;
    }
    let validAddresses = [[], []], validIps = [[], []], destinations;
    for (let i = 0, l = addresses.length;i < l; i++) {
      let address2 = addresses[i], { address: ip, family: addressType } = address2;
      if (self.emit("lookup", err, ip, addressType, host), !self.connecting)
        return;
      if (isIP(ip) && (addressType === 4 || addressType === 6)) {
        destinations ||= addressType === 6 ? { 6: 0, 4: 1 } : { 4: 0, 6: 1 };
        let destination = destinations[addressType];
        if (!ArrayPrototypeIncludes.@call(validIps[destination], ip))
          ArrayPrototypePush.@call(validAddresses[destination], address2), ArrayPrototypePush.@call(validIps[destination], ip);
      }
    }
    if (!validAddresses[0].length && !validAddresses[1].length) {
      let { address: firstIp, family: firstAddressType } = addresses[0];
      if (!isIP(firstIp))
        err = @makeErrorWithCode(128, firstIp), process.nextTick(destroyNT, self, err);
      else if (firstAddressType !== 4 && firstAddressType !== 6)
        err = @makeErrorWithCode(117, firstAddressType, options.host, options.port), process.nextTick(destroyNT, self, err);
      return;
    }
    let toAttempt = [];
    for (let i = 0, l = MathMax(validAddresses[0].length, validAddresses[1].length);i < l; i++) {
      if (i in validAddresses[0])
        ArrayPrototypePush.@call(toAttempt, validAddresses[0][i]);
      if (i in validAddresses[1])
        ArrayPrototypePush.@call(toAttempt, validAddresses[1][i]);
    }
    if (toAttempt.length === 1) {
      let { address: ip, family: addressType } = toAttempt[0];
      self._unrefTimer(), internalConnect(self, options, ip, port, addressType, localAddress, localPort);
      return;
    }
    self.autoSelectFamilyAttemptedAddresses = [];
    let context = {
      socket: self,
      addresses: toAttempt,
      current: 0,
      port,
      localPort,
      timeout,
      [kTimeout]: null,
      errors: [],
      options
    };
    self._unrefTimer(), internalConnectMultiple(context);
  });
}
function internalConnect(self, options, address2, port, addressType, localAddress, localPort, _flags) {
  let err;
  if (localAddress || localPort) {
    if (addressType === 4)
      localAddress ||= "0.0.0.0";
    else
      localAddress ||= "::";
    if (err = checkBindError(err, localPort, self._handle), err) {
      let ex = new ExceptionWithHostPort(err, "bind", localAddress, localPort);
      self.destroy(ex);
      return;
    }
  }
  let connection = self[ksocket];
  if (options.socket)
    connection = options.socket;
  let tls = @undefined, bunTLS = self[bunTlsSymbol];
  if (typeof bunTLS === "function") {
    if (tls = bunTLS.@call(self, port, self._host, !0), self._requestCert = !0, tls) {
      let { rejectUnauthorized, session, checkServerIdentity } = options;
      if (typeof rejectUnauthorized < "u")
        self._rejectUnauthorized = rejectUnauthorized, tls.rejectUnauthorized = rejectUnauthorized;
      else
        self._rejectUnauthorized = tls.rejectUnauthorized;
      if (tls.requestCert = !0, tls.session = session || tls.session, self.servername = tls.servername, tls.checkServerIdentity = checkServerIdentity || tls.checkServerIdentity, self[bunTLSConnectOptions] = tls, !connection && tls.socket)
        connection = tls.socket;
    }
    self.authorized = !1, self.secureConnecting = !0, self._secureEstablished = !1, self._securePending = !0, self[kConnectOptions] = options, self.prependListener("end", onConnectEnd);
  }
  if (self.emit("connectionAttempt", address2, port, addressType), addressType === 6 || addressType === 4) {
    if (self.blockList?.check(address2, `ipv${addressType}`)) {
      self.destroy(@makeErrorWithCode(142, address2));
      return;
    }
    let req = {};
    req.oncomplete = afterConnect, req.address = address2, req.port = port, req.localAddress = localAddress, req.localPort = localPort, req.addressType = addressType, req.tls = tls, err = kConnectTcp(self, addressType, req, address2, port);
  } else {
    let req = {};
    req.address = address2, req.oncomplete = afterConnect, req.tls = tls, err = kConnectPipe(self, req, address2);
  }
  if (err) {
    let ex = new ExceptionWithHostPort(err, "connect", address2, port);
    self.destroy(ex);
  }
}
function internalConnectMultiple(context, canceled) {
  clearTimeout(context[kTimeout]);
  let self = context.socket;
  if (self._aborted)
    return;
  if (canceled || context.current === context.addresses.length) {
    if (context.errors.length === 0) {
      self.destroy(@makeErrorWithCode(221));
      return;
    }
    self.destroy(new NodeAggregateError(context.errors));
    return;
  }
  let current = context.current++;
  if (current > 0)
    self[kReinitializeHandle](newDetachedSocket(typeof self[bunTlsSymbol] === "function"));
  let { localPort, port, _flags } = context, { address: address2, family: addressType } = context.addresses[current], localAddress, err;
  if (localPort) {
    if (addressType === 4)
      localAddress = DEFAULT_IPV4_ADDR;
    else
      localAddress = DEFAULT_IPV6_ADDR;
    if (err = checkBindError(err, localPort, self._handle), err) {
      ArrayPrototypePush.@call(context.errors, new ExceptionWithHostPort(err, "bind", localAddress, localPort)), internalConnectMultiple(context);
      return;
    }
  }
  if (self.blockList?.check(address2, `ipv${addressType}`)) {
    let ex = @makeErrorWithCode(142, address2);
    ArrayPrototypePush.@call(context.errors, ex), self.emit("connectionAttemptFailed", address2, port, addressType, ex), internalConnectMultiple(context);
    return;
  }
  let connection = self[ksocket];
  if (context.options.socket)
    connection = context.options.socket;
  let tls = @undefined, bunTLS = self[bunTlsSymbol];
  if (typeof bunTLS === "function") {
    if (tls = bunTLS.@call(self, port, self._host, !0), self._requestCert = !0, tls) {
      let { rejectUnauthorized, session, checkServerIdentity } = context.options;
      if (typeof rejectUnauthorized < "u")
        self._rejectUnauthorized = rejectUnauthorized, tls.rejectUnauthorized = rejectUnauthorized;
      else
        self._rejectUnauthorized = tls.rejectUnauthorized;
      if (tls.requestCert = !0, tls.session = session || tls.session, self.servername = tls.servername, tls.checkServerIdentity = checkServerIdentity || tls.checkServerIdentity, self[bunTLSConnectOptions] = tls, !connection && tls.socket)
        connection = tls.socket;
    }
    self.authorized = !1, self.secureConnecting = !0, self._secureEstablished = !1, self._securePending = !0, self[kConnectOptions] = context.options, self.prependListener("end", onConnectEnd);
  }
  self.emit("connectionAttempt", address2, port, addressType);
  let req = {};
  if (req.oncomplete = afterConnectMultiple.bind(@undefined, context, current), req.address = address2, req.port = port, req.localAddress = localAddress, req.localPort = localPort, req.addressType = addressType, req.tls = tls, ArrayPrototypePush.@call(self.autoSelectFamilyAttemptedAddresses, `${address2}:${port}`), err = kConnectTcp(self, addressType, req, address2, port), err) {
    let ex = new ExceptionWithHostPort(err, "connect", address2, port);
    ArrayPrototypePush.@call(context.errors, ex), self.emit("connectionAttemptFailed", address2, port, addressType, ex), internalConnectMultiple(context);
    return;
  }
  if (current < context.addresses.length - 1)
    context[kTimeout] = setTimeout(internalConnectMultipleTimeout, context.timeout, context, req, self._handle).unref();
}
function internalConnectMultipleTimeout(context, req, handle) {
  if (context.socket.emit("connectionAttemptTimeout", req.address, req.port, req.addressType), req.oncomplete = @undefined, ArrayPrototypePush.@call(context.errors, createConnectionError(req, UV_ETIMEDOUT)), handle.close(), context.socket.connecting)
    internalConnectMultiple(context);
}
function afterConnect(status, handle, req, readable, writable) {
  if (!handle)
    return;
  let self = handle[owner_symbol];
  if (!self)
    return;
  if (self.destroyed)
    return;
  if (self.connecting = !1, self._sockname = null, status === 0) {
    if (self.readable && !readable)
      self.push(null), self.read();
    if (self.writable && !writable)
      self.end();
    if (self._unrefTimer(), self[kSetNoDelay] && self._handle.setNoDelay)
      self._handle.setNoDelay(!0);
    if (self[kSetKeepAlive] && self._handle.setKeepAlive)
      self._handle.setKeepAlive(!0, self[kSetKeepAliveInitialDelay]);
    if (self.emit("connect"), self.emit("ready"), readable && !self.isPaused())
      self.read(0);
  } else {
    let details;
    if (req.localAddress && req.localPort)
      details = req.localAddress + ":" + req.localPort;
    let ex = new ExceptionWithHostPort(status, "connect", req.address, req.port);
    if (details)
      ex.localAddress = req.localAddress, ex.localPort = req.localPort;
    self.emit("connectionAttemptFailed", req.address, req.port, req.addressType, ex), self.destroy(ex);
  }
}
function afterConnectMultiple(context, current, status, handle, req, readable, writable) {
  if (clearTimeout(context[kTimeout]), status === 0 && current !== context.current - 1) {
    handle.close();
    return;
  }
  let self = context.socket;
  if (status !== 0) {
    let ex = createConnectionError(req, status);
    if (ArrayPrototypePush.@call(context.errors, ex), self.emit("connectionAttemptFailed", req.address, req.port, req.addressType, ex), context.socket.connecting)
      internalConnectMultiple(context, status === UV_ECANCELED);
    return;
  }
  afterConnect(status, self._handle, req, readable, writable);
}
function createConnectionError(req, status) {
  let details;
  if (req.localAddress && req.localPort)
    details = req.localAddress + ":" + req.localPort;
  let ex = new ExceptionWithHostPort(status, "connect", req.address, req.port);
  if (details)
    ex.localAddress = req.localAddress, ex.localPort = req.localPort;
  return ex;
}
function Server(options, connectionListener) {
  if (!(this instanceof Server))
    return new Server(options, connectionListener);
  if (EventEmitter.@apply(this, []), typeof options === "function")
    connectionListener = options, options = {};
  else if (options == null || typeof options === "object")
    options = { ...options };
  else
    throw @makeErrorWithCode(118, "options", ["Object", "Function"], options);
  let {
    allowHalfOpen = !1,
    keepAlive = !1,
    keepAliveInitialDelay = 0,
    highWaterMark = getDefaultHighWaterMark(),
    pauseOnConnect = !1,
    noDelay = !1
  } = options;
  if (this._connections = 0, this._handle = null, this._usingWorkers = !1, this.workers = [], this._unref = !1, this.listeningId = 1, this[bunSocketServerOptions] = @undefined, this.allowHalfOpen = allowHalfOpen, this.keepAlive = keepAlive, this.keepAliveInitialDelay = keepAliveInitialDelay, this.highWaterMark = highWaterMark, this.pauseOnConnect = Boolean(pauseOnConnect), this.noDelay = noDelay, options.connectionListener = connectionListener, this[bunSocketServerOptions] = options, options.blockList) {
    if (!BlockList.isBlockList(options.blockList))
      throw @makeErrorWithCode(118, "options.blockList", "net.BlockList", options.blockList);
    this.blockList = options.blockList;
  }
}
@toClass(Server, "Server", EventEmitter);
Object.defineProperty(Server.prototype, "listening", {
  get() {
    return !!this._handle;
  }
});
Server.prototype.ref = function ref2() {
  return this._unref = !1, this._handle?.ref(), this;
};
Server.prototype.unref = function unref2() {
  return this._unref = !0, this._handle?.unref(), this;
};
Server.prototype.close = function close(callback) {
  if (typeof callback === "function")
    if (!this._handle)
      this.once("close", function close() {
        callback(@makeErrorWithCode(214));
      });
    else
      this.once("close", callback);
  if (this._handle)
    this._handle.stop(!1), this._handle = null;
  return this._emitCloseIfDrained(), this;
};
Server.prototype[Symbol.asyncDispose] = function() {
  let { resolve, reject, promise } = @Promise.withResolvers();
  return this.close(function(err, ...args) {
    if (err)
      reject(err);
    else
      resolve(...args);
  }), promise;
};
Server.prototype._emitCloseIfDrained = function _emitCloseIfDrained() {
  if (this._handle || this._connections > 0)
    return;
  process.nextTick(() => {
    this.emit("close");
  });
};
Server.prototype.address = function address2() {
  let server = this._handle;
  if (server) {
    let unix = server.unix;
    if (unix)
      return unix;
    let out = {}, err = this._handle.getsockname(out);
    if (err)
      throw new ErrnoException(err, "address");
    return out;
  }
  return null;
};
Server.prototype.getConnections = function getConnections(callback) {
  if (typeof callback === "function")
    callback(null, this._handle ? this._connections : 0);
  return this;
};
Server.prototype.listen = function listen(port, hostname, onListen) {
  let argsLength = arguments.length;
  if (typeof port === "string") {
    let numPort = Number(port);
    if (!Number.isNaN(numPort))
      port = numPort;
  }
  let backlog, path, exclusive = !1, allowHalfOpen = !1, reusePort = !1, ipv6Only = !1, fd;
  if (typeof port === "string") {
    if (Number.isSafeInteger(hostname)) {
      if (hostname > 0)
        backlog = hostname;
    } else if (typeof hostname === "function")
      onListen = hostname;
    path = port, hostname = @undefined, port = @undefined;
  } else {
    if (typeof hostname === "number")
      backlog = hostname, hostname = @undefined;
    else if (typeof hostname === "function")
      onListen = hostname, hostname = @undefined;
    else if (typeof hostname === "string" && typeof onListen === "number")
      backlog = onListen, onListen = argsLength > 3 ? arguments[3] : @undefined;
    if (typeof port === "function")
      onListen = port, port = 0;
    else if (typeof port === "object") {
      let options = port;
      if (addServerAbortSignalOption(this, options), hostname = options.host, exclusive = options.exclusive, path = options.path, port = options.port, ipv6Only = options.ipv6Only, allowHalfOpen = options.allowHalfOpen, reusePort = options.reusePort, backlog = options.backlog, typeof options.fd === "number" && options.fd >= 0)
        fd = options.fd, port = 0;
      let isLinux = !1;
      if (!Number.isSafeInteger(port) || port < 0)
        if (path) {
          let isAbstractPath = path.startsWith("\x00");
          if (isLinux && isAbstractPath && (options.writableAll || options.readableAll)) {
            let message = `The argument 'options' can not set readableAll or writableAll to true when path is abstract unix socket. Received ${JSON.stringify(options)}`, error = @makeTypeError(message);
            throw error.code = "ERR_INVALID_ARG_VALUE", error;
          }
          hostname = path, port = @undefined;
        } else {
          let message = `The argument 'options' must have the property "port" or "path"`;
          try {
            message = `${message}. Received ${JSON.stringify(options)}`;
          } catch {}
          let error = @makeTypeError(message);
          throw error.code = "ERR_INVALID_ARG_VALUE", error;
        }
      else if (port === @undefined)
        port = 0;
      if (typeof options.callback === "function")
        onListen = options?.callback;
    } else if (!Number.isSafeInteger(port) || port < 0)
      port = 0;
    hostname = hostname || "::";
  }
  if (typeof port === "number" && (port < 0 || port >= 65536))
    throw @makeErrorWithCode(217, `options.port should be >= 0 and < 65536. Received type number: (${port})`);
  if (this._handle)
    throw @makeErrorWithCode(213);
  if (onListen != null)
    this.once("listening", onListen);
  try {
    var tls = @undefined, TLSSocketClass = @undefined;
    let bunTLS = this[bunTlsSymbol], options = this[bunSocketServerOptions], contexts = null;
    if (typeof bunTLS === "function") {
      if ([tls, TLSSocketClass] = bunTLS.@call(this, port, hostname, !1), options.servername = tls.serverName, options[kSocketClass] = TLSSocketClass, contexts = tls.contexts, !tls.requestCert)
        tls.rejectUnauthorized = !1;
    } else
      options[kSocketClass] = Socket;
    listenInCluster(this, null, port, 4, backlog, fd, exclusive, ipv6Only, allowHalfOpen, reusePort, @undefined, @undefined, path, hostname, tls, contexts, onListen);
  } catch (err) {
    setTimeout(emitErrorNextTick, 1, this, err);
  }
  return this;
};
Server.prototype[kRealListen] = function(path, port, hostname, exclusive, ipv6Only, allowHalfOpen, reusePort, tls, contexts, _onListen, fd) {
  if (path)
    this._handle = Bun.listen({
      unix: path,
      tls,
      allowHalfOpen: allowHalfOpen || this[bunSocketServerOptions]?.allowHalfOpen || !1,
      reusePort: reusePort || this[bunSocketServerOptions]?.reusePort || !1,
      ipv6Only: ipv6Only || this[bunSocketServerOptions]?.ipv6Only || !1,
      exclusive: exclusive || this[bunSocketServerOptions]?.exclusive || !1,
      socket: ServerHandlers,
      data: this
    });
  else if (fd != null)
    this._handle = Bun.listen({
      fd,
      hostname,
      tls,
      allowHalfOpen: allowHalfOpen || this[bunSocketServerOptions]?.allowHalfOpen || !1,
      reusePort: reusePort || this[bunSocketServerOptions]?.reusePort || !1,
      ipv6Only: ipv6Only || this[bunSocketServerOptions]?.ipv6Only || !1,
      exclusive: exclusive || this[bunSocketServerOptions]?.exclusive || !1,
      socket: ServerHandlers,
      data: this
    });
  else
    this._handle = Bun.listen({
      port,
      hostname,
      tls,
      allowHalfOpen: allowHalfOpen || this[bunSocketServerOptions]?.allowHalfOpen || !1,
      reusePort: reusePort || this[bunSocketServerOptions]?.reusePort || !1,
      ipv6Only: ipv6Only || this[bunSocketServerOptions]?.ipv6Only || !1,
      exclusive: exclusive || this[bunSocketServerOptions]?.exclusive || !1,
      socket: ServerHandlers,
      data: this
    });
  let addr = this.address();
  if (addr && typeof addr === "object") {
    let familyLast = @String(addr.family).slice(-1);
    this._connectionKey = `${familyLast}:${addr.address}:${port}`;
  }
  if (contexts)
    for (let [name, context] of contexts)
      addServerName(this._handle, name, context);
  if (this._unref)
    this.unref();
  setTimeout(emitListeningNextTick, 1, this);
};
Server.prototype[EventEmitter.captureRejectionSymbol] = function(err, event, sock) {
  switch (event) {
    case "connection":
      sock.destroy(err);
      break;
    default:
      this.emit("error", err);
  }
};
Server.prototype.getsockname = function getsockname(out) {
  return out.port = this.address().port, out;
};
function emitErrorNextTick(self, error) {
  self.emit("error", error);
}
function emitErrorAndCloseNextTick(self, error) {
  self.emit("error", error), self.emit("close", !0);
}
function addServerAbortSignalOption(self, options) {
  if (options?.signal === @undefined)
    return;
  validateAbortSignal(options.signal, "options.signal");
  let { signal } = options, onAborted = () => self.close();
  if (signal.aborted)
    process.nextTick(onAborted);
  else
    signal.addEventListener("abort", onAborted);
}
function emitListeningNextTick(self) {
  if (!self._handle)
    return;
  self.emit("listening");
}
var cluster;
function listenInCluster(server, address3, port, addressType, backlog, fd, exclusive, ipv6Only, allowHalfOpen, reusePort, flags, options, path, hostname, tls, contexts, onListen) {
  if (exclusive = !!exclusive, cluster === @undefined)
    cluster = @getInternalField(@internalModuleRegistry, 88) || @createInternalModuleById(88);
  if (cluster.isPrimary || exclusive) {
    server[kRealListen](path, port, hostname, exclusive, ipv6Only, allowHalfOpen, reusePort, tls, contexts, onListen, fd);
    return;
  }
  let serverQuery = {
    address: address3,
    port,
    addressType,
    fd,
    flags,
    backlog,
    ...options
  };
  cluster._getServer(server, serverQuery, function listenOnPrimaryHandle(err, handle) {
    if (err = checkBindError(err, port, handle), err)
      throw new ExceptionWithHostPort(err, "bind", address3, port);
    server[kRealListen](path, port, hostname, exclusive, ipv6Only, allowHalfOpen, reusePort, tls, contexts, onListen, fd);
  });
}
function createServer(options, connectionListener) {
  return new Server(options, connectionListener);
}
function normalizeArgs(args) {
  let arr;
  if (args.length === 0)
    return arr = [{}, null], arr[normalizedArgsSymbol] = !0, arr;
  let arg0 = args[0], options = {};
  if (typeof arg0 === "object" && arg0 !== null)
    options = arg0;
  else if (isPipeName(arg0))
    options.path = arg0;
  else if (options.port = arg0, args.length > 1 && typeof args[1] === "string")
    options.host = args[1];
  let cb = args[args.length - 1];
  if (typeof cb !== "function")
    arr = [options, null];
  else
    arr = [options, cb];
  return arr[normalizedArgsSymbol] = !0, arr;
}
function initSocketHandle(self) {
  if (self._undestroy(), self._sockname = null, self[kclosed] = !1, self[kended] = !1, self._handle)
    self._handle[owner_symbol] = self;
}
function closeSocketHandle(self, isException, isCleanupPending = !1) {
  if (self._handle)
    self._handle.close(), setImmediate(() => {
      if (self.emit("close", isException), isCleanupPending)
        self._handle.onread = () => {}, self._handle = null, self._sockname = null;
    });
}
function checkBindError(err, port, handle) {
  if (err === 0 && port > 0 && handle.getsockname) {
    let out = {};
    if (err = handle.getsockname(out), err === 0 && port !== out.port)
      err = -4091;
  }
  return err;
}
function isPipeName(s) {
  return typeof s === "string" && toNumber(s) === !1;
}
function toNumber(x) {
  return (x = Number(x)) >= 0 ? x : !1;
}
var warnSimultaneousAccepts = !0;
function _setSimultaneousAccepts() {
  if (warnSimultaneousAccepts)
    process.emitWarning("net._setSimultaneousAccepts() is deprecated and will be removed.", "DeprecationWarning", "DEP0121"), warnSimultaneousAccepts = !1;
}
$ = {
  createServer,
  Server,
  createConnection,
  connect: createConnection,
  isIP,
  isIPv4,
  isIPv6,
  Socket,
  _normalizeArgs: normalizeArgs,
  _setSimultaneousAccepts,
  getDefaultAutoSelectFamily,
  setDefaultAutoSelectFamily,
  getDefaultAutoSelectFamilyAttemptTimeout,
  setDefaultAutoSelectFamilyAttemptTimeout,
  BlockList,
  SocketAddress,
  Stream: Socket
};
return $})

