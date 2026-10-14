(function (){"use strict";// build/release/tmp_modules/node/_http_server.ts
var $, EventEmitter = @getInternalField(@internalModuleRegistry, 96) || @createInternalModuleById(96), { Duplex, Stream } = @getInternalField(@internalModuleRegistry, 117) || @createInternalModuleById(117), {
  _checkInvalidHeaderChar: checkInvalidHeaderChar,
  validateHeaderName,
  validateHeaderValue
} = @getInternalField(@internalModuleRegistry, 73) || @createInternalModuleById(73), { validateObject, validateLinkHeaderValue, validateBoolean, validateInteger } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), { ConnResetException } = @getInternalField(@internalModuleRegistry, 32) || @createInternalModuleById(32), { isPrimary } = @getInternalField(@internalModuleRegistry, 12) || @createInternalModuleById(12), { throwOnInvalidTLSArray } = @getInternalField(@internalModuleRegistry, 61) || @createInternalModuleById(61), {
  kInternalSocketData,
  serverSymbol,
  kHandle,
  kRealListen,
  tlsSymbol,
  optionsSymbol,
  kDeferredTimeouts,
  kDeprecatedReplySymbol,
  headerStateSymbol,
  NodeHTTPHeaderState,
  kPendingCallbacks,
  kRequest,
  kCloseCallback,
  NodeHTTPResponseFlags,
  headersSymbol,
  emitErrorNextTickIfErrorListenerNT,
  getIsNextIncomingMessageHTTPS,
  setIsNextIncomingMessageHTTPS,
  callCloseCallback,
  emitCloseNT,
  NodeHTTPResponseAbortEvent,
  STATUS_CODES,
  isTlsSymbol,
  hasServerResponseFinished,
  OutgoingMessagePrototype,
  NodeHTTPBodyReadState,
  controllerSymbol,
  firstWriteSymbol,
  deferredSymbol,
  eofInProgress,
  runSymbol,
  drainMicrotasks,
  setServerIdleTimeout,
  setServerCustomOptions,
  getMaxHTTPHeaderSize
} = @getInternalField(@internalModuleRegistry, 25) || @createInternalModuleById(25), NumberIsNaN = Number.isNaN, { format } = @getInternalField(@internalModuleRegistry, 66) || @createInternalModuleById(66), { IncomingMessage } = @getInternalField(@internalModuleRegistry, 74) || @createInternalModuleById(74), { OutgoingMessage } = @getInternalField(@internalModuleRegistry, 75) || @createInternalModuleById(75), { kIncomingMessage } = @getInternalField(@internalModuleRegistry, 73) || @createInternalModuleById(73), kConnectionsCheckingInterval = Symbol("http.server.connectionsCheckingInterval"), getBunServerAllClosedPromise = @lazy(40), sendHelper = @lazy(4), kServerResponse = Symbol("ServerResponse"), kRejectNonStandardBodyWrites = Symbol("kRejectNonStandardBodyWrites"), GlobalPromise = globalThis.Promise, kEmptyBuffer = @Buffer.alloc(0), ObjectKeys = Object.keys, MathMin = Math.min, cluster;
function emitCloseServer(self) {
  callCloseCallback(self), self.emit("close");
}
function emitCloseNTServer() {
  process.nextTick(emitCloseServer, this);
}
function setCloseCallback(self, callback) {
  if (callback === self[kCloseCallback])
    return;
  if (self[kCloseCallback])
    throw Error("Close callback already set");
  self[kCloseCallback] = callback;
}
function assignSocketInternal(self, socket) {
  if (socket._httpMessage)
    throw @makeErrorWithCode(74, "Socket already assigned");
  socket._httpMessage = self, setCloseCallback(socket, onServerResponseClose), self.socket = socket, self.emit("socket", socket);
}
function onServerResponseClose() {
  let httpMessage = this._httpMessage;
  if (httpMessage)
    emitCloseNT(httpMessage);
}
function strictContentLength(response) {
  if (response.strictContentLength) {
    let contentLength = response._contentLength ?? response.getHeader("content-length");
    if (contentLength && response._hasBody && !response._removedContLen && !response.chunkedEncoding && !response.hasHeader("transfer-encoding")) {
      if (typeof contentLength === "number")
        return contentLength;
      else if (typeof contentLength === "string") {
        if (contentLength = parseInt(contentLength, 10), NumberIsNaN(contentLength))
          return;
        return contentLength;
      }
    }
  }
}
var ServerResponse_writeDeprecated = function _write(chunk, encoding, callback) {
  if (@isCallable(encoding))
    callback = encoding, encoding = @undefined;
  if (!@isCallable(callback))
    callback = @undefined;
  if (encoding && encoding !== "buffer")
    chunk = @Buffer.from(chunk, encoding);
  if (this.destroyed || this.finished) {
    if (chunk)
      emitErrorNextTickIfErrorListenerNT(this, @makeErrorWithCode(236), callback);
    return !1;
  }
  if (this[firstWriteSymbol] === @undefined && !this.headersSent) {
    if (this[firstWriteSymbol] = chunk, callback)
      callback();
    return;
  }
  ensureReadableStreamController.@call(this, (controller) => {
    if (controller.write(chunk), callback)
      callback();
  });
};
function onNodeHTTPServerSocketTimeout() {
  let req = this[kRequest], reqTimeout = req && !req.complete && req.emit("timeout", this), res = this._httpMessage, resTimeout = res && res.emit("timeout", this), serverTimeout = this.server.emit("timeout", this);
  if (!reqTimeout && !resTimeout && !serverTimeout)
    this.destroy();
}
function emitRequestCloseNT(self) {
  callCloseCallback(self), self.emit("close");
}
function emitListeningNextTick(self, hostname, port) {
  if (self.listening = !!self[serverSymbol])
    self.emit("listening", null, hostname, port);
}
function Server(options, callback) {
  if (!(this instanceof Server))
    return new Server(options, callback);
  if (EventEmitter.@call(this), this[kConnectionsCheckingInterval] = { _destroyed: !1 }, this.listening = !1, this._unref = !1, this.maxRequestsPerSocket = 0, this[kInternalSocketData] = @undefined, this[tlsSymbol] = null, this.noDelay = !0, typeof options === "function")
    callback = options, options = {};
  else if (options == null)
    options = {};
  else {
    validateObject(options, "options"), options = { ...options };
    let cert = options.cert;
    if (cert)
      throwOnInvalidTLSArray("options.cert", cert), this[isTlsSymbol] = !0;
    let key = options.key;
    if (key)
      throwOnInvalidTLSArray("options.key", key), this[isTlsSymbol] = !0;
    let ca = options.ca;
    if (ca)
      throwOnInvalidTLSArray("options.ca", ca), this[isTlsSymbol] = !0;
    let passphrase = options.passphrase;
    if (passphrase && typeof passphrase !== "string")
      throw @makeErrorWithCode(118, "options.passphrase", "string", passphrase);
    let serverName = options.servername;
    if (serverName && typeof serverName !== "string")
      throw @makeErrorWithCode(118, "options.servername", "string", serverName);
    let secureOptions = options.secureOptions || 0;
    if (secureOptions && typeof secureOptions !== "number")
      throw @makeErrorWithCode(118, "options.secureOptions", "number", secureOptions);
    if (this[isTlsSymbol])
      this[tlsSymbol] = {
        serverName,
        key,
        cert,
        ca,
        passphrase,
        secureOptions
      };
    else
      this[tlsSymbol] = null;
  }
  if (this[optionsSymbol] = options, storeHTTPOptions.@call(this, options), callback)
    this.on("request", callback);
  return this;
}
@toClass(Server, "Server", EventEmitter);
Server.prototype[kIncomingMessage] = @undefined;
Server.prototype[kServerResponse] = @undefined;
Server.prototype[kConnectionsCheckingInterval] = @undefined;
Server.prototype.ref = function() {
  return this._unref = !1, this[serverSymbol]?.ref?.(), this;
};
Server.prototype.unref = function() {
  return this._unref = !0, this[serverSymbol]?.unref?.(), this;
};
Server.prototype.closeAllConnections = function() {
  let server = this[serverSymbol];
  if (!server)
    return;
  this[serverSymbol] = @undefined;
  let connectionsCheckingInterval = this[kConnectionsCheckingInterval];
  if (connectionsCheckingInterval)
    connectionsCheckingInterval._destroyed = !0;
  this.listening = !1, server.stop(!0);
};
Server.prototype.closeIdleConnections = function() {
  this[serverSymbol]?.closeIdleConnections();
};
Server.prototype.close = function(optionalCallback) {
  let server = this[serverSymbol];
  if (!server) {
    if (typeof optionalCallback === "function")
      process.nextTick(optionalCallback, @makeErrorWithCode(214));
    return;
  }
  this[serverSymbol] = @undefined;
  let connectionsCheckingInterval = this[kConnectionsCheckingInterval];
  if (connectionsCheckingInterval)
    connectionsCheckingInterval._destroyed = !0;
  if (typeof optionalCallback === "function")
    setCloseCallback(this, optionalCallback);
  this.listening = !1, server.closeIdleConnections(), server.stop();
};
Server.prototype[EventEmitter.captureRejectionSymbol] = function(err, event, ...args) {
  switch (event) {
    case "request": {
      let { 1: res2 } = args;
      if (!res2.headersSent && !res2.writableEnded) {
        let names = res2.getHeaderNames();
        for (let i = 0;i < names.length; i++)
          res2.removeHeader(names[i]);
        res2.statusCode = 500, res2.end(STATUS_CODES[500]);
      } else
        res2.destroy();
      break;
    }
    default:
      let { 1: res } = args;
      res?.socket?.destroy();
      break;
  }
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
Server.prototype.address = function() {
  if (!this[serverSymbol])
    return null;
  return this[serverSymbol].address;
};
Server.prototype.listen = function() {
  let server = this, port, host, onListen, socketPath, tls = this[tlsSymbol];
  if (arguments.length > 0) {
    if ((@isObject(arguments[0]) || @isCallable(arguments[0])) && arguments[0] !== null) {
      port = arguments[0].port, host = arguments[0].host, socketPath = arguments[0].path;
      let otherTLS = arguments[0].tls;
      if (otherTLS && @isObject(otherTLS))
        tls = otherTLS;
    } else if (typeof arguments[0] === "string" && !(Number(arguments[0]) >= 0))
      socketPath = arguments[0];
    else if (port = arguments[0], arguments.length > 1 && typeof arguments[1] === "string")
      host = arguments[1];
  }
  if (port === @undefined && !socketPath)
    port = 0;
  if (typeof port === "string") {
    let portNumber = parseInt(port);
    if (!Number.isNaN(portNumber))
      port = portNumber;
  }
  if (@isCallable(arguments[arguments.length - 1]))
    onListen = arguments[arguments.length - 1];
  try {
    if (isPrimary)
      return server[kRealListen](tls, port, host, socketPath, !1, onListen), this;
    if (cluster === @undefined)
      cluster = @getInternalField(@internalModuleRegistry, 88) || @createInternalModuleById(88);
    server.once("listening", () => {
      cluster.worker.state = "listening";
      let address = server.address(), message = {
        act: "listening",
        port: address && address.port || port,
        data: null,
        addressType: 4
      };
      sendHelper(message, null);
    }), server[kRealListen](tls, port, host, socketPath, !0, onListen);
  } catch (err) {
    setTimeout(() => server.emit("error", err), 1);
  }
  return this;
};
Server.prototype[kRealListen] = function(tls, port, host, socketPath, reusePort, onListen) {
  {
    let ResponseClass = this[optionsSymbol].ServerResponse || ServerResponse, RequestClass = this[optionsSymbol].IncomingMessage || IncomingMessage, canUseInternalAssignSocket = ResponseClass?.prototype.assignSocket === ServerResponse.prototype.assignSocket, isHTTPS = !1, server = this;
    if (tls)
      this.serverName = tls.serverName || host || "localhost";
    if (this[serverSymbol] = Bun.serve({
      idleTimeout: 0,
      tls,
      port,
      hostname: host,
      unix: socketPath,
      reusePort,
      websocket: {
        open(ws) {
          ws.data.open(ws);
        },
        message(ws, message) {
          ws.data.message(ws, message);
        },
        close(ws, code, reason) {
          ws.data.close(ws, code, reason);
        },
        drain(ws) {
          ws.data.drain(ws);
        },
        ping(ws, data) {
          ws.data.ping(ws, data);
        },
        pong(ws, data) {
          ws.data.pong(ws, data);
        }
      },
      maxRequestBodySize: Number.MAX_SAFE_INTEGER,
      onNodeHTTPRequest(bunServer, url, method, headersObject, headersArray, handle, hasBody, socketHandle, isSocketNew, socket, isAncientHTTP, connectHead) {
        let prevIsNextIncomingMessageHTTPS = getIsNextIncomingMessageHTTPS();
        if (setIsNextIncomingMessageHTTPS(isHTTPS), !socket)
          socket = new NodeHTTPServerSocket(server, socketHandle, !!tls);
        let http_req = new RequestClass(kHandle, url, method, headersObject, headersArray, handle, hasBody, socket);
        if (isAncientHTTP)
          http_req.httpVersion = "1.0";
        if (method === "CONNECT") {
          if (server.listenerCount("connect") > 0) {
            socket[kEnableStreaming](!0);
            let { promise: promise2, resolve: resolve2 } = @newPromiseCapability(@Promise);
            socket.once("close", resolve2);
            let head = connectHead ? connectHead : kEmptyBuffer;
            return server.emit("connect", http_req, socket, head), promise2;
          } else
            socketHandle.close();
          return;
        }
        socket[kEnableStreaming](!1);
        let http_res = new ResponseClass(http_req, {
          [kHandle]: handle,
          [kRejectNonStandardBodyWrites]: server.rejectNonStandardBodyWrites
        });
        if (setIsNextIncomingMessageHTTPS(prevIsNextIncomingMessageHTTPS), handle.onabort = onServerRequestEvent.bind(socket), hasBody)
          handle.pause();
        drainMicrotasks();
        let resolveFunction, didFinish = !1, isRequestsLimitSet = typeof server.maxRequestsPerSocket === "number" && server.maxRequestsPerSocket > 0, reachedRequestsLimit = !1;
        if (isRequestsLimitSet) {
          let requestCount = (socket._requestCount || 0) + 1;
          if (socket._requestCount = requestCount, server.maxRequestsPerSocket < requestCount)
            reachedRequestsLimit = !0;
        }
        if (isSocketNew && !reachedRequestsLimit)
          server.emit("connection", socket);
        socket[kRequest] = http_req;
        let is_upgrade = http_req.headers.upgrade;
        if (!is_upgrade)
          if (canUseInternalAssignSocket)
            assignSocketInternal(http_res, socket);
          else
            http_res.assignSocket(socket);
        function onClose() {
          if (didFinish = !0, resolveFunction)
            resolveFunction();
        }
        if (setCloseCallback(http_res, onClose), reachedRequestsLimit)
          server.emit("dropRequest", http_req, socket), http_res.writeHead(503), http_res.end(), socket.destroy();
        else if (is_upgrade) {
          if (server.emit("upgrade", http_req, socket, kEmptyBuffer), !socket._httpMessage)
            if (canUseInternalAssignSocket)
              assignSocketInternal(http_res, socket);
            else
              http_res.assignSocket(socket);
        } else if (http_req.headers.expect !== @undefined)
          if (http_req.headers.expect === "100-continue")
            if (server.listenerCount("checkContinue") > 0)
              server.emit("checkContinue", http_req, http_res);
            else
              http_res.writeContinue(), server.emit("request", http_req, http_res);
          else if (server.listenerCount("checkExpectation") > 0)
            server.emit("checkExpectation", http_req, http_res);
          else
            http_res.writeHead(417), http_res.end();
        else
          server.emit("request", http_req, http_res);
        if (socket.cork(), handle.finished || didFinish) {
          handle = @undefined, http_res[kCloseCallback] = @undefined, http_res.detachSocket(socket);
          return;
        }
        if (http_res.socket)
          http_res.on("finish", http_res.detachSocket.bind(http_res, socket));
        let { resolve, promise } = @newPromiseCapability(@Promise);
        return resolveFunction = resolve, promise;
      }
    }), getBunServerAllClosedPromise(this[serverSymbol]).@then(emitCloseNTServer.bind(this)), isHTTPS = this[serverSymbol].protocol === "https", setServerCustomOptions(this[serverSymbol], this.requireHostHeader, !0, typeof this.maxHeaderSize < "u" ? this.maxHeaderSize : getMaxHTTPHeaderSize(), onServerClientError.bind(this)), this?._unref)
      this[serverSymbol]?.unref?.();
    if (@isCallable(onListen))
      this.once("listening", onListen);
    if (this[kDeferredTimeouts]) {
      for (let { msecs, callback } of this[kDeferredTimeouts])
        this.setTimeout(msecs, callback);
      delete this[kDeferredTimeouts];
    }
    setTimeout(emitListeningNextTick, 1, this, this[serverSymbol]?.hostname, this[serverSymbol]?.port);
  }
};
Server.prototype.setTimeout = function(msecs, callback) {
  let server = this[serverSymbol];
  if (server) {
    if (setServerIdleTimeout(server, Math.ceil(msecs / 1000)), typeof callback === "function")
      this.once("timeout", callback);
  } else
    (this[kDeferredTimeouts] ??= []).push({ msecs, callback });
  return this;
};
function onServerRequestEvent(event) {
  let socket = this;
  switch (event) {
    case NodeHTTPResponseAbortEvent.abort: {
      if (!socket.destroyed)
        socket.destroy();
      break;
    }
    case NodeHTTPResponseAbortEvent.timeout: {
      socket.emit("timeout");
      break;
    }
  }
}
function onServerClientError(ssl, socket, errorCode, rawPacket) {
  let self = this, err;
  switch (errorCode) {
    case 2 /* HTTP_PARSER_ERROR_INVALID_CONTENT_LENGTH */:
      err = @makeErrorWithCode(287, "Parse Error");
      break;
    case 3 /* HTTP_PARSER_ERROR_INVALID_TRANSFER_ENCODING */:
      err = @makeErrorWithCode(288, "Parse Error");
      break;
    case 8 /* HTTP_PARSER_ERROR_INVALID_EOF */:
      err = @makeErrorWithCode(289, "Parse Error");
      break;
    case 9 /* HTTP_PARSER_ERROR_INVALID_METHOD */:
      err = @makeErrorWithCode(290, "Parse Error: Invalid method encountered"), err.bytesParsed = 1;
      break;
    case 10 /* HTTP_PARSER_ERROR_INVALID_HEADER_TOKEN */:
      err = @makeErrorWithCode(300, "Parse Error: Invalid header token encountered");
      break;
    case 6 /* HTTP_PARSER_ERROR_REQUEST_HEADER_FIELDS_TOO_LARGE */:
      err = @makeErrorWithCode(301, "Parse Error: Header overflow"), err.bytesParsed = rawPacket.byteLength;
      break;
    default:
      err = @makeErrorWithCode(291, "Parse Error");
      break;
  }
  err.rawPacket = rawPacket;
  let nodeSocket = new NodeHTTPServerSocket(self, socket, ssl);
  if (self.emit("connection", nodeSocket), self.emit("clientError", err, nodeSocket), nodeSocket.listenerCount("error") > 0)
    nodeSocket.emit("error", err);
}
var kBytesWritten = Symbol("kBytesWritten"), kEnableStreaming = Symbol("kEnableStreaming"), NodeHTTPServerSocket = class Socket extends Duplex {
  bytesRead = 0;
  connecting = !1;
  timeout = 0;
  [kBytesWritten] = 0;
  [kHandle];
  server;
  _httpMessage;
  _secureEstablished = !1;
  #pendingCallback = null;
  constructor(server, handle, encrypted) {
    super();
    this.server = server, this[kHandle] = handle, this._secureEstablished = !!handle?.secureEstablished, handle.onclose = this.#onClose.bind(this), handle.duplex = this, this.encrypted = encrypted, this.on("timeout", onNodeHTTPServerSocketTimeout);
  }
  get bytesWritten() {
    let handle = this[kHandle];
    return handle ? handle.response?.getBytesWritten?.() ?? handle.bytesWritten ?? this[kBytesWritten] ?? 0 : this[kBytesWritten] ?? 0;
  }
  set bytesWritten(value) {
    this[kBytesWritten] = value;
  }
  [kEnableStreaming](enable) {
    let handle = this[kHandle];
    if (handle)
      if (enable)
        handle.ondata = this.#onData.bind(this), handle.ondrain = this.#onDrain.bind(this);
      else
        handle.ondata = @undefined, handle.ondrain = @undefined;
  }
  #onDrain() {
    let handle = this[kHandle];
    this[kBytesWritten] = handle ? handle.response?.getBytesWritten?.() ?? handle.bytesWritten ?? 0 : 0;
    let callback = this.#pendingCallback;
    if (callback)
      this.#pendingCallback = null, callback();
    this.emit("drain");
  }
  #onData(chunk, last) {
    if (chunk)
      this.push(chunk);
    if (last) {
      let handle = this[kHandle];
      if (handle)
        handle.ondata = @undefined;
      this.push(null);
    }
  }
  #closeHandle(handle, callback) {
    this[kHandle] = @undefined, handle.onclose = this.#onCloseForDestroy.bind(this, callback), handle.close();
    let req = this._httpMessage?.req;
    if (req && !req.complete)
      req.destroy();
  }
  #onClose() {
    this[kHandle] = null;
    let req = this._httpMessage?.req;
    if (req && !req.complete && !req[kHandle]?.upgraded)
      if (req[kHandle] = @undefined, req.listenerCount("error") > 0)
        req.destroy(new ConnResetException("aborted"));
      else
        req.destroy();
  }
  #onCloseForDestroy(closeCallback) {
    if (this.#onClose(), @isCallable(closeCallback))
      closeCallback();
  }
  _onTimeout() {
    let response = this[kHandle]?.response;
    if (response && response.writableLength > 0)
      return;
    this.emit("timeout");
  }
  _unrefTimer() {}
  address() {
    return this[kHandle]?.remoteAddress || null;
  }
  get bufferSize() {
    return this.writableLength;
  }
  connect(_port, _host, _connectListener) {
    return this;
  }
  _destroy(err, callback) {
    let handle = this[kHandle];
    if (!handle) {
      if (@isCallable(callback))
        callback(err);
      return;
    }
    if (handle.ondata = @undefined, handle.closed) {
      let onclose = handle.onclose;
      if (handle.onclose = @undefined, @isCallable(onclose))
        onclose.@call(handle);
      if (@isCallable(callback))
        callback(err);
      return;
    }
    this.#closeHandle(handle, callback);
  }
  _final(callback) {
    let handle = this[kHandle];
    if (!handle) {
      callback();
      return;
    }
    handle.end(), callback();
  }
  get localAddress() {
    return this[kHandle]?.localAddress?.address;
  }
  get localFamily() {
    return this[kHandle]?.localAddress?.family;
  }
  get localPort() {
    return this[kHandle]?.localAddress?.port;
  }
  get pending() {
    return this.connecting;
  }
  #resumeSocket() {
    let handle = this[kHandle], response = handle?.response;
    if (response) {
      let resumed = response.resume();
      if (resumed && resumed !== !0) {
        let bodyReadState = handle.hasBody, req = this._httpMessage?.req;
        if ((bodyReadState & NodeHTTPBodyReadState.done) !== 0)
          emitServerSocketEOFNT(this, req);
        if (req)
          req.push(resumed);
        this.push(resumed);
      }
    }
  }
  _read(_size) {
    this.#resumeSocket();
  }
  get readyState() {
    if (this.connecting)
      return "opening";
    if (this.readable)
      return this.writable ? "open" : "readOnly";
    else
      return this.writable ? "writeOnly" : "closed";
  }
  ref() {
    return this;
  }
  get remoteAddress() {
    return this.address()?.address;
  }
  set remoteAddress(val) {
    this.address().address = val;
  }
  get remotePort() {
    return this.address()?.port;
  }
  set remotePort(val) {
    this.address().port = val;
  }
  get remoteFamily() {
    return this.address()?.family;
  }
  set remoteFamily(val) {
    this.address().family = val;
  }
  resetAndDestroy() {}
  setKeepAlive(_enable = !1, _initialDelay = 0) {}
  setNoDelay(_noDelay = !0) {
    return this;
  }
  setTimeout(_timeout, _callback) {
    return this;
  }
  setEncoding(_encoding) {
    let err = Error("Changing the socket encoding is not allowed per RFC7230 Section 3.");
    throw err.code = "ERR_HTTP_SOCKET_ENCODING", err;
  }
  unref() {
    return this;
  }
  _write(_chunk, _encoding, _callback) {
    let handle = this[kHandle], err;
    try {
      if (handle && handle.ondrain && !handle.write(_chunk, _encoding))
        return this.#pendingCallback = _callback, !1;
    } catch (e) {
      err = e;
    }
    if (err)
      _callback(err);
    else
      _callback();
  }
  pause() {
    let response = this[kHandle]?.response;
    if (response)
      response.pause();
    return super.pause();
  }
  resume() {
    return this.#resumeSocket(), super.resume();
  }
  get [kInternalSocketData]() {
    return this[kHandle]?.response;
  }
};
function _writeHead(statusCode, reason, obj, response) {
  let originalStatusCode = statusCode, hasContentLength = response.hasHeader("content-length");
  if (statusCode |= 0, statusCode < 100 || statusCode > 999)
    throw @makeErrorWithCode(72, format("%s", originalStatusCode));
  if (typeof reason === "string")
    response.statusMessage = reason;
  else {
    if (!response.statusMessage)
      response.statusMessage = STATUS_CODES[statusCode] || "unknown";
    obj ??= reason;
  }
  if (checkInvalidHeaderChar(response.statusMessage))
    throw @makeErrorWithCode(121, "statusMessage");
  response.statusCode = statusCode;
  {
    let k;
    if (@isArray(obj)) {
      let length = obj.length;
      if (length && @isArray(obj[0]))
        for (let i = 0;i < length; i++) {
          let k2 = obj[i];
          if (k2)
            response.appendHeader(k2[0], k2[1]);
        }
      else {
        if (length % 2 !== 0)
          throw @makeErrorWithCode(119, "headers", obj);
        if ((response.chunkedEncoding !== !0 || response.hasHeader("content-length")) && (response._trailer || response.hasHeader("trailer")))
          throw @makeErrorWithCode(73, "Trailers are invalid with this transfer encoding");
        for (let n = 0;n < length; n += 2)
          k = obj[n + 0], response.removeHeader(k);
        for (let n = 0;n < length; n += 2)
          if (k = obj[n], k)
            response.appendHeader(k, obj[n + 1]);
      }
    } else if (obj) {
      let keys = Object.keys(obj), length = keys.length;
      for (let i = 0;i < length; i++)
        if (k = keys[i], k)
          response.setHeader(k, obj[k]);
    }
    if ((response.chunkedEncoding !== !0 || response.hasHeader("content-length")) && (response._trailer || response.hasHeader("trailer"))) {
      if (hasContentLength)
        response.removeHeader("trailer");
      else
        response.removeHeader("content-length");
      throw @makeErrorWithCode(73, "Trailers are invalid with this transfer encoding");
    }
  }
  updateHasBody(response, statusCode);
}
Object.defineProperty(NodeHTTPServerSocket, "name", { value: "Socket" });
function ServerResponse(req, options) {
  if (!(this instanceof ServerResponse))
    return new ServerResponse(req, options);
  if (OutgoingMessage.@call(this, options), this.useChunkedEncodingByDefault = !0, this[kDeprecatedReplySymbol] = options?.[kDeprecatedReplySymbol])
    this[controllerSymbol] = @undefined, this[firstWriteSymbol] = @undefined, this[deferredSymbol] = @undefined, this.write = ServerResponse_writeDeprecated, this.end = ServerResponse_finalDeprecated;
  if (this.req = req, this.sendDate = !0, this._sent100 = !1, this[headerStateSymbol] = NodeHTTPHeaderState.none, this[kPendingCallbacks] = [], this.finished = !1, req.method === "HEAD")
    this._hasBody = !1;
  if (options) {
    let handle = options[kHandle];
    if (handle)
      this[kHandle] = handle;
    else
      this[kHandle] = req[kHandle];
    this[kRejectNonStandardBodyWrites] = options[kRejectNonStandardBodyWrites] ?? !1;
  } else
    this[kHandle] = req[kHandle];
  this.statusCode = 200, this.statusMessage = @undefined, this.chunkedEncoding = !1;
}
@toClass(ServerResponse, "ServerResponse", OutgoingMessage);
ServerResponse.prototype._removedConnection = !1;
ServerResponse.prototype._removedContLen = !1;
ServerResponse.prototype._hasBody = !0;
ServerResponse.prototype._ended = !1;
ServerResponse.prototype[kRejectNonStandardBodyWrites] = @undefined;
Object.defineProperty(ServerResponse.prototype, "headersSent", {
  get() {
    return this[headerStateSymbol] === NodeHTTPHeaderState.sent || this[headerStateSymbol] === NodeHTTPHeaderState.assigned;
  },
  set(value) {
    this[headerStateSymbol] = value ? NodeHTTPHeaderState.sent : NodeHTTPHeaderState.none;
  }
});
ServerResponse.prototype._writeRaw = function(chunk, encoding, callback) {
  return this.socket.write(chunk, encoding, callback);
};
ServerResponse.prototype.writeEarlyHints = function(hints, cb) {
  let head = `HTTP/1.1 103 Early Hints\r
`;
  if (validateObject(hints, "hints"), hints.link === null || hints.link === @undefined)
    return;
  let link = validateLinkHeaderValue(hints.link);
  if (link.length === 0)
    return;
  head += "Link: " + link + `\r
`;
  for (let key of ObjectKeys(hints))
    if (key !== "link") {
      let value = hints[key];
      validateHeaderName(key), validateHeaderValue(key, value), head += key + ": " + value + `\r
`;
    }
  head += `\r
`, this._writeRaw(head, "ascii", cb);
};
ServerResponse.prototype.writeProcessing = function(cb) {
  this._writeRaw(`HTTP/1.1 102 Processing\r
\r
`, "ascii", cb);
};
ServerResponse.prototype.writeContinue = function(cb) {
  this.socket[kHandle]?.response?.writeContinue(), cb?.();
};
ServerResponse.prototype.end = function(chunk, encoding, callback) {
  let handle = this[kHandle];
  if (handle?.aborted)
    return this;
  if (@isCallable(chunk))
    callback = chunk, chunk = @undefined, encoding = @undefined;
  else if (@isCallable(encoding))
    callback = encoding, encoding = @undefined;
  else if (!@isCallable(callback))
    callback = @undefined;
  if (hasServerResponseFinished(this, chunk, callback))
    return this;
  if (chunk && !this._hasBody)
    if (this[kRejectNonStandardBodyWrites])
      throw @makeErrorWithCode(68);
    else
      chunk = @undefined;
  if (!handle) {
    if (@isCallable(callback))
      process.nextTick(callback);
    return this;
  }
  let headerState = this[headerStateSymbol];
  if (callWriteHeadIfObservable(this, headerState), handle.flags & NodeHTTPResponseFlags.closed_or_completed)
    return !0;
  if (headerState !== NodeHTTPHeaderState.sent)
    handle.cork(() => {
      handle.writeHead(this.statusCode, this.statusMessage, this[headersSymbol]), this[headerStateSymbol] = NodeHTTPHeaderState.sent, this._contentLength = handle.end(chunk, encoding, @undefined, strictContentLength(this));
    });
  else if (!(!chunk && handle.ended) && !handle.aborted)
    handle.end(chunk, encoding, @undefined, strictContentLength(this));
  this._header = " ";
  let req = this.req, socket = req.socket;
  if (!req._consuming && !req?._readableState?.resumeScheduled)
    req._dump();
  if (this.detachSocket(socket), this.finished = !0, process.nextTick((self) => {
    self._ended = !0;
  }, this), this.emit("prefinish"), this._callPendingCallbacks(), callback)
    process.nextTick(function(callback2, self) {
      self.emit("finish");
      try {
        callback2();
      } catch (err) {
        self.emit("error", err);
      }
      process.nextTick(emitCloseNT, self);
    }, callback, this);
  else
    process.nextTick(function(self) {
      self.emit("finish"), process.nextTick(emitCloseNT, self);
    }, this);
  return this;
};
Object.defineProperty(ServerResponse.prototype, "writable", {
  get() {
    return !this._ended || !hasServerResponseFinished(this);
  }
});
ServerResponse.prototype.write = function(chunk, encoding, callback) {
  let handle = this[kHandle];
  if (@isCallable(chunk))
    callback = chunk, chunk = @undefined, encoding = @undefined;
  else if (@isCallable(encoding))
    callback = encoding, encoding = @undefined;
  else if (!@isCallable(callback))
    callback = @undefined;
  if (hasServerResponseFinished(this, chunk, callback))
    return !1;
  if (chunk && !this._hasBody)
    if (this[kRejectNonStandardBodyWrites])
      throw @makeErrorWithCode(68);
    else
      chunk = @undefined;
  let result = 0, headerState = this[headerStateSymbol];
  if (callWriteHeadIfObservable(this, headerState), !handle)
    if (this.socket)
      return this.socket.write(chunk, encoding, callback);
    else
      return OutgoingMessagePrototype.write.@call(this, chunk, encoding, callback);
  if (handle.flags & NodeHTTPResponseFlags.closed_or_completed)
    return !0;
  if (this[headerStateSymbol] !== NodeHTTPHeaderState.sent)
    handle.cork(() => {
      handle.writeHead(this.statusCode, this.statusMessage, this[headersSymbol]), this[headerStateSymbol] = NodeHTTPHeaderState.sent, result = handle.write(chunk, encoding, allowWritesToContinue.bind(this), strictContentLength(this));
    });
  else
    result = handle.write(chunk, encoding, allowWritesToContinue.bind(this), strictContentLength(this));
  if (result < 0) {
    if (callback)
      this[kPendingCallbacks].push(callback);
    return !1;
  }
  if (this._callPendingCallbacks(), callback)
    process.nextTick(callback);
  return this.emit("drain"), !0;
};
ServerResponse.prototype._callPendingCallbacks = function() {
  let originalLength = this[kPendingCallbacks].length;
  for (let i = 0;i < originalLength; ++i)
    process.nextTick(this[kPendingCallbacks][i]);
  if (this[kPendingCallbacks].length == originalLength)
    this[kPendingCallbacks] = [];
  else
    this[kPendingCallbacks].splice(0, originalLength);
};
ServerResponse.prototype._finish = function() {
  this.emit("prefinish");
};
ServerResponse.prototype.detachSocket = function(socket) {
  if (socket._httpMessage === this) {
    if (socket[kCloseCallback])
      socket[kCloseCallback] = @undefined;
    socket.removeListener("close", onServerResponseClose), socket._httpMessage = null;
  }
  this.socket = null;
};
ServerResponse.prototype._implicitHeader = function() {
  if (this.headersSent)
    return;
  this.writeHead(this.statusCode);
};
Object.defineProperty(ServerResponse.prototype, "writableNeedDrain", {
  get() {
    return !this.destroyed && !this.finished && (this[kHandle]?.bufferedAmount ?? 0) !== 0;
  }
});
Object.defineProperty(ServerResponse.prototype, "writableFinished", {
  get() {
    return !!(this.finished && (!this[kHandle] || this[kHandle].finished));
  }
});
Object.defineProperty(ServerResponse.prototype, "writableLength", {
  get() {
    return this.writableFinished ? 0 : this[kHandle]?.bufferedAmount ?? 0;
  }
});
Object.defineProperty(ServerResponse.prototype, "writableHighWaterMark", {
  get() {
    return 65536;
  }
});
Object.defineProperty(ServerResponse.prototype, "closed", {
  get() {
    return this._closed;
  }
});
ServerResponse.prototype._send = function(data, encoding, callback, _byteLength) {
  let handle = this[kHandle];
  if (!handle)
    return OutgoingMessagePrototype._send.@apply(this, arguments);
  if (this[headerStateSymbol] !== NodeHTTPHeaderState.sent)
    handle.cork(() => {
      handle.writeHead(this.statusCode, this.statusMessage, this[headersSymbol]), this[headerStateSymbol] = NodeHTTPHeaderState.sent, handle.write(data, encoding, callback, strictContentLength(this));
    });
  else
    handle.write(data, encoding, callback, strictContentLength(this));
};
ServerResponse.prototype.writeHead = function(statusCode, statusMessage, headers) {
  if (this.headersSent)
    throw @makeErrorWithCode(69, "writeHead");
  return _writeHead(statusCode, statusMessage, headers, this), this[headerStateSymbol] = NodeHTTPHeaderState.assigned, this;
};
ServerResponse.prototype.assignSocket = function(socket) {
  if (socket._httpMessage)
    throw @makeErrorWithCode(74, "Socket already assigned");
  socket._httpMessage = this, socket.once("close", onServerResponseClose), this.socket = socket, this.emit("socket", socket);
};
Object.defineProperty(ServerResponse.prototype, "shouldKeepAlive", {
  get() {
    return this[kHandle]?.shouldKeepAlive ?? !0;
  },
  set(_value) {}
});
ServerResponse.prototype.destroy = function(_err) {
  if (this.destroyed)
    return this;
  let handle = this[kHandle];
  if (this.destroyed = !0, handle)
    handle.abort();
  return this?.socket?.destroy(), this.emit("close"), this;
};
ServerResponse.prototype.emit = function(event) {
  if (event === "close")
    callCloseCallback(this);
  return Stream.prototype.emit.@apply(this, arguments);
};
ServerResponse.prototype.flushHeaders = function() {
  if (this[headerStateSymbol] === NodeHTTPHeaderState.sent)
    return;
  if (this[headerStateSymbol] !== NodeHTTPHeaderState.assigned)
    this._implicitHeader();
  let handle = this[kHandle];
  if (handle) {
    if (this[headerStateSymbol] === NodeHTTPHeaderState.assigned)
      this[headerStateSymbol] = NodeHTTPHeaderState.sent, handle.writeHead(this.statusCode, this.statusMessage, this[headersSymbol]);
    handle.flushHeaders();
  }
};
function updateHasBody(response, statusCode) {
  if (statusCode === 204 || statusCode === 304 || statusCode >= 100 && statusCode <= 199)
    response._hasBody = !1;
  else
    response._hasBody = !0;
}
function emitServerSocketEOF(self, req) {
  if (self.push(null), req)
    req.push(null), req.complete = !0;
}
function emitServerSocketEOFNT(self, req) {
  if (req)
    req[eofInProgress] = !0;
  process.nextTick(emitServerSocketEOF, self);
}
var OriginalWriteHeadFn, OriginalImplicitHeadFn;
function callWriteHeadIfObservable(self, headerState) {
  if (headerState === NodeHTTPHeaderState.none && !(self.writeHead === OriginalWriteHeadFn && self._implicitHeader === OriginalImplicitHeadFn))
    self.writeHead(self.statusCode, self.statusMessage, self[headersSymbol]);
}
function allowWritesToContinue() {
  this._callPendingCallbacks(), this.emit("drain");
}
function drainHeadersIfObservable() {
  if (this._implicitHeader === OriginalImplicitHeadFn && this.writeHead === OriginalWriteHeadFn)
    return;
  this._implicitHeader();
}
function ServerResponse_finalDeprecated(chunk, encoding, callback) {
  if (@isCallable(encoding))
    callback = encoding, encoding = @undefined;
  if (!@isCallable(callback))
    callback = @undefined;
  if (this.destroyed || this.finished) {
    if (chunk)
      emitErrorNextTickIfErrorListenerNT(this, @makeErrorWithCode(236), callback);
    return !1;
  }
  if (encoding && encoding !== "buffer")
    chunk = @Buffer.from(chunk, encoding);
  let req = this.req, shouldEmitClose = req && req.emit && !this.finished;
  if (!this.headersSent) {
    let data = this[firstWriteSymbol];
    if (chunk)
      if (data) {
        if (encoding)
          data = @Buffer.from(data, encoding);
        data = new Blob([data, chunk]);
      } else
        data = chunk;
    else if (!data)
      data = @undefined;
    else
      data = new Blob([data]);
    if (this[firstWriteSymbol] = @undefined, this.finished = !0, this.headersSent = !0, drainHeadersIfObservable.@call(this), this[kDeprecatedReplySymbol](new Response(data, {
      headers: this[headersSymbol],
      status: this.statusCode,
      statusText: this.statusMessage ?? STATUS_CODES[this.statusCode]
    })), shouldEmitClose)
      req.complete = !0, process.nextTick(emitRequestCloseNT, req);
    callback?.();
    return;
  }
  this.finished = !0, ensureReadableStreamController.@call(this, (controller) => {
    if (chunk && encoding)
      chunk = @Buffer.from(chunk, encoding);
    let prom;
    if (chunk)
      controller.write(chunk), prom = controller.end();
    else
      prom = controller.end();
    let handler = () => {
      callback();
      let deferred = this[deferredSymbol];
      if (deferred)
        this[deferredSymbol] = @undefined, deferred();
    };
    if (@isPromise(prom))
      prom.then(handler, handler);
    else
      handler();
  });
}
ServerResponse.prototype.writeHeader = ServerResponse.prototype.writeHead;
OriginalWriteHeadFn = ServerResponse.prototype.writeHead;
OriginalImplicitHeadFn = ServerResponse.prototype._implicitHeader;
function storeHTTPOptions(options) {
  this[kIncomingMessage] = options.IncomingMessage || IncomingMessage, this[kServerResponse] = options.ServerResponse || ServerResponse;
  let maxHeaderSize = options.maxHeaderSize;
  if (maxHeaderSize !== @undefined)
    validateInteger(maxHeaderSize, "maxHeaderSize", 0);
  this.maxHeaderSize = maxHeaderSize;
  let insecureHTTPParser = options.insecureHTTPParser;
  if (insecureHTTPParser !== @undefined)
    validateBoolean(insecureHTTPParser, "options.insecureHTTPParser");
  this.insecureHTTPParser = insecureHTTPParser;
  let requestTimeout = options.requestTimeout;
  if (requestTimeout !== @undefined)
    validateInteger(requestTimeout, "requestTimeout", 0), this.requestTimeout = requestTimeout;
  else
    this.requestTimeout = 300000;
  let headersTimeout = options.headersTimeout;
  if (headersTimeout !== @undefined)
    validateInteger(headersTimeout, "headersTimeout", 0), this.headersTimeout = headersTimeout;
  else
    this.headersTimeout = MathMin(60000, this.requestTimeout);
  if (this.requestTimeout > 0 && this.headersTimeout > 0 && this.headersTimeout > this.requestTimeout)
    throw @makeErrorWithCode(156, "headersTimeout", "<= requestTimeout", headersTimeout);
  let keepAliveTimeout = options.keepAliveTimeout;
  if (keepAliveTimeout !== @undefined)
    validateInteger(keepAliveTimeout, "keepAliveTimeout", 0), this.keepAliveTimeout = keepAliveTimeout;
  else
    this.keepAliveTimeout = 5000;
  let connectionsCheckingInterval = options.connectionsCheckingInterval;
  if (connectionsCheckingInterval !== @undefined)
    validateInteger(connectionsCheckingInterval, "connectionsCheckingInterval", 0), this.connectionsCheckingInterval = connectionsCheckingInterval;
  else
    this.connectionsCheckingInterval = 30000;
  let requireHostHeader = options.requireHostHeader;
  if (requireHostHeader !== @undefined)
    validateBoolean(requireHostHeader, "options.requireHostHeader"), this.requireHostHeader = requireHostHeader;
  else
    this.requireHostHeader = !0;
  let joinDuplicateHeaders = options.joinDuplicateHeaders;
  if (joinDuplicateHeaders !== @undefined)
    validateBoolean(joinDuplicateHeaders, "options.joinDuplicateHeaders");
  this.joinDuplicateHeaders = joinDuplicateHeaders;
  let rejectNonStandardBodyWrites = options.rejectNonStandardBodyWrites;
  if (rejectNonStandardBodyWrites !== @undefined)
    validateBoolean(rejectNonStandardBodyWrites, "options.rejectNonStandardBodyWrites"), this.rejectNonStandardBodyWrites = rejectNonStandardBodyWrites;
  else
    this.rejectNonStandardBodyWrites = !1;
}
function ensureReadableStreamController(run) {
  let thisController = this[controllerSymbol];
  if (thisController)
    return run(thisController);
  this.headersSent = !0;
  let firstWrite = this[firstWriteSymbol], old_run = this[runSymbol];
  if (old_run) {
    old_run.push(run);
    return;
  }
  this[runSymbol] = [run], this[kDeprecatedReplySymbol](new Response(new @ReadableStream({
    type: "direct",
    pull: (controller) => {
      if (this[controllerSymbol] = controller, firstWrite)
        controller.write(firstWrite);
      firstWrite = @undefined;
      for (let run2 of this[runSymbol])
        run2(controller);
      if (!this.finished) {
        let { promise, resolve } = @newPromiseCapability(GlobalPromise);
        return this[deferredSymbol] = resolve, promise;
      }
    }
  }), {
    headers: this[headersSymbol],
    status: this.statusCode,
    statusText: this.statusMessage ?? STATUS_CODES[this.statusCode]
  }));
}
$ = {
  Server,
  ServerResponse,
  kConnectionsCheckingInterval
};
return $})

