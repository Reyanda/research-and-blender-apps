(function (){"use strict";// build/release/tmp_modules/thirdparty/ws.ts
var $;
var EventEmitter = @getInternalField(@internalModuleRegistry, 96) || @createInternalModuleById(96), http = @getInternalField(@internalModuleRegistry, 99) || @createInternalModuleById(99), onceObject = { once: !0 }, kBunInternals = Symbol.for("::bunternal::"), readyStates = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"], encoder = /* @__PURE__ */ new TextEncoder;
function extractAgentOptions(agent) {
  let connectOpts = agent?.connectOpts || agent?.options, tls = null, proxy = null;
  if (@isObject(connectOpts)) {
    let newTlsOptions = {}, hasTlsOptions = !1;
    if (connectOpts.rejectUnauthorized !== @undefined)
      newTlsOptions.rejectUnauthorized = connectOpts.rejectUnauthorized, hasTlsOptions = !0;
    if (connectOpts.ca)
      newTlsOptions.ca = connectOpts.ca, hasTlsOptions = !0;
    if (connectOpts.cert)
      newTlsOptions.cert = connectOpts.cert, hasTlsOptions = !0;
    if (connectOpts.key)
      newTlsOptions.key = connectOpts.key, hasTlsOptions = !0;
    if (connectOpts.passphrase)
      newTlsOptions.passphrase = connectOpts.passphrase, hasTlsOptions = !0;
    if (hasTlsOptions)
      tls = newTlsOptions;
  }
  let agentProxy = connectOpts?.proxy || agent?.proxy;
  if (agentProxy) {
    let proxyUrl = agentProxy?.href || agentProxy;
    if (agent?.proxyHeaders) {
      let proxyHeaders = @isCallable(agent.proxyHeaders) ? agent.proxyHeaders.@call(agent) : agent.proxyHeaders;
      proxy = { url: proxyUrl, headers: proxyHeaders };
    } else
      proxy = proxyUrl;
  }
  return { tls, proxy };
}
var eventIds = {
  open: 1,
  close: 2,
  message: 3,
  error: 4,
  ping: 5,
  pong: 6
}, emittedWarnings = /* @__PURE__ */ new Set;
function emitWarning(type, message) {
  if (emittedWarnings.has(type))
    return;
  emittedWarnings.add(type), console.warn("[bun] Warning:", message);
}
function normalizeData(data, opts) {
  let isBinary = opts?.binary;
  if (typeof data === "number")
    data = data.toString();
  if (isBinary === !0 && typeof data === "string")
    data = @Buffer.from(data);
  else if (isBinary === !1 && @isTypedArrayView(data))
    data = new @Buffer(data.buffer, data.byteOffset, data.byteLength).toString("utf-8");
  return data;
}
var WebSocket;

class BunWebSocket extends EventEmitter {
  static [Symbol.toStringTag] = "WebSocket";
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  #ws;
  #paused = !1;
  #fragments = !1;
  #binaryType = "nodebuffer";
  #eventId = 0;
  constructor(url, protocols, options) {
    super();
    if (!WebSocket)
      WebSocket = @lazy(97);
    if (protocols === @undefined)
      protocols = [];
    else if (!@Array.isArray(protocols))
      if (typeof protocols === "object" && protocols !== null)
        options = protocols, protocols = [];
      else
        protocols = [protocols];
    let headers, method = "GET", proxy, tlsOptions, agent;
    if (@isObject(options)) {
      if (headers = options?.headers, proxy = options?.proxy, tlsOptions = options?.tls, agent = options?.agent, @isObject(agent)) {
        let agentOpts = extractAgentOptions(agent);
        if (!proxy && agentOpts.proxy)
          proxy = agentOpts.proxy;
        if (!tlsOptions && agentOpts.tls)
          tlsOptions = agentOpts.tls;
      }
    }
    let finishRequest = options?.finishRequest;
    if (@isCallable(finishRequest)) {
      if (headers)
        headers = {
          __proto__: null,
          ...headers
        };
      let lazyRawHeaders, didCallEnd = !1, nodeHttpClientRequestSimulated = {
        __proto__: Object.create(EventEmitter.prototype),
        setHeader: function(name, value) {
          if (!headers)
            headers = Object.create(null);
          headers[name.toLowerCase()] = value;
        },
        getHeader: function(name) {
          return headers ? headers[name.toLowerCase()] : @undefined;
        },
        removeHeader: function(name) {
          if (headers)
            delete headers[name.toLowerCase()];
        },
        getHeaders: function() {
          return { ...headers };
        },
        hasHeader: function(name) {
          return headers ? name.toLowerCase() in headers : !1;
        },
        headersSent: !1,
        method,
        path: url,
        abort: function() {},
        end: () => {
          if (!didCallEnd)
            didCallEnd = !0, this.#createWebSocket(url, protocols, headers, method, proxy, tlsOptions);
        },
        write() {},
        writeHead() {},
        [Symbol.toStringTag]: "ClientRequest",
        get rawHeaders() {
          if (lazyRawHeaders === @undefined) {
            lazyRawHeaders = [];
            for (let key in headers)
              lazyRawHeaders.push(key, headers[key]);
          }
          return lazyRawHeaders;
        },
        set rawHeaders(value) {
          lazyRawHeaders = value;
        },
        rawTrailers: [],
        trailers: null,
        finished: !1,
        socket: @undefined,
        _header: null,
        _headerSent: !1,
        _last: null
      };
      if (EventEmitter.@call(nodeHttpClientRequestSimulated), finishRequest(nodeHttpClientRequestSimulated), !didCallEnd)
        this.#createWebSocket(url, protocols, headers, method, proxy, tlsOptions);
      return;
    }
    this.#createWebSocket(url, protocols, headers, method, proxy, tlsOptions);
  }
  #createWebSocket(url, protocols, headers, method, proxy, tls) {
    let wsOptions;
    if (headers || proxy || tls) {
      if (wsOptions = { protocols }, headers)
        wsOptions.headers = headers;
      if (method)
        wsOptions.method = method;
      if (proxy)
        wsOptions.proxy = proxy;
      if (tls)
        wsOptions.tls = tls;
    } else
      wsOptions = protocols;
    let ws = this.#ws = new WebSocket(url, wsOptions);
    return ws.binaryType = "nodebuffer", ws;
  }
  #onOrOnce(event, listener, once) {
    if (event === "unexpected-response" || event === "upgrade" || event === "redirect")
      emitWarning(event, "ws.WebSocket '" + event + "' event is not implemented in bun");
    let mask = 1 << eventIds[event], hasPersistentListener = mask && (this.#eventId & mask) === mask;
    if (mask && !hasPersistentListener) {
      if (!once)
        this.#eventId |= mask;
      if (event === "open")
        this.#ws.addEventListener("open", () => {
          this.emit("open");
        }, once);
      else if (event === "close")
        this.#ws.addEventListener("close", ({ code, reason, wasClean }) => {
          this.emit("close", code, reason, wasClean);
        }, once);
      else if (event === "message")
        this.#ws.addEventListener("message", ({ data }) => {
          let isBinary = typeof data !== "string";
          if (isBinary)
            this.emit("message", this.#fragments ? [data] : data, isBinary);
          else {
            let encoded = encoder.encode(data);
            if (this.#binaryType !== "arraybuffer")
              encoded = @Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength);
            this.emit("message", this.#fragments ? [encoded] : encoded, isBinary);
          }
        }, once);
      else if (event === "error")
        this.#ws.addEventListener("error", (err) => {
          this.emit("error", err);
        }, once);
      else if (event === "ping")
        this.#ws.addEventListener("ping", ({ data }) => {
          this.emit("ping", data);
        }, once);
      else if (event === "pong")
        this.#ws.addEventListener("pong", ({ data }) => {
          this.emit("pong", data);
        }, once);
    }
    return once ? super.once(event, listener) : super.on(event, listener);
  }
  on(event, listener) {
    return this.#onOrOnce(event, listener, @undefined);
  }
  once(event, listener) {
    return this.#onOrOnce(event, listener, onceObject);
  }
  send(data, opts, cb) {
    if (@isCallable(opts))
      cb = opts, opts = @undefined;
    try {
      this.#ws.send(normalizeData(data, opts), opts?.compress);
    } catch (error) {
      if (typeof cb === "function")
        process.nextTick(cb, error);
      return;
    }
    if (typeof cb === "function")
      process.nextTick(cb, null);
  }
  close(code, reason) {
    let ws = this.#ws;
    if (ws)
      ws.close(code, reason);
  }
  terminate() {
    let ws = this.#ws;
    if (ws)
      ws.terminate();
  }
  get url() {
    return this.#ws.url;
  }
  get readyState() {
    return this.#ws.readyState;
  }
  get binaryType() {
    return this.#binaryType;
  }
  set binaryType(value) {
    if (value === "nodebuffer" || value === "arraybuffer")
      this.#ws.binaryType = this.#binaryType = value, this.#fragments = !1;
    else if (value === "fragments")
      this.#ws.binaryType = "nodebuffer", this.#binaryType = "fragments", this.#fragments = !0;
    else
      throw Error(`Invalid binaryType: ${value}`);
  }
  get protocol() {
    return this.#ws.protocol;
  }
  get extensions() {
    return this.#ws.extensions;
  }
  addEventListener(type, listener, options) {
    this.#ws.addEventListener(type, listener, options);
  }
  removeEventListener(type, listener) {
    this.#ws.removeEventListener(type, listener);
  }
  get onopen() {
    return this.#ws.onopen;
  }
  set onopen(value) {
    this.#ws.onopen = value;
  }
  get onerror() {
    return this.#ws.onerror;
  }
  set onerror(value) {
    this.#ws.onerror = value;
  }
  get onclose() {
    return this.#ws.onclose;
  }
  set onclose(value) {
    this.#ws.onclose = value;
  }
  get onmessage() {
    return this.#ws.onmessage;
  }
  set onmessage(value) {
    this.#ws.onmessage = value;
  }
  get bufferedAmount() {
    return this.#ws.bufferedAmount;
  }
  get isPaused() {
    return this.#paused;
  }
  ping(data, mask, cb) {
    if (this.#ws.readyState === 0)
      throw Error("WebSocket is not open: readyState 0 (CONNECTING)");
    if (typeof data === "function")
      cb = data, data = mask = @undefined;
    else if (typeof mask === "function")
      cb = mask, mask = @undefined;
    if (typeof data === "number")
      data = data.toString();
    try {
      if (data === @undefined)
        this.#ws.ping();
      else
        this.#ws.ping(data);
    } catch (error) {
      if (typeof cb === "function") {
        cb(error);
        return;
      }
      this.emit("error", error);
      return;
    }
    if (typeof cb === "function")
      cb();
  }
  pong(data, mask, cb) {
    if (this.#ws.readyState === 0)
      throw Error("WebSocket is not open: readyState 0 (CONNECTING)");
    if (typeof data === "function")
      cb = data, data = mask = @undefined;
    else if (typeof mask === "function")
      cb = mask, mask = @undefined;
    if (typeof data === "number")
      data = data.toString();
    try {
      if (data === @undefined)
        this.#ws.pong();
      else
        this.#ws.pong(data);
    } catch (error) {
      if (typeof cb === "function") {
        cb(error);
        return;
      }
      this.emit("error", error);
      return;
    }
    if (typeof cb === "function")
      cb();
  }
  pause() {
    switch (this.readyState) {
      case 0:
      case 3:
        return;
    }
    this.#paused = !0, emitWarning("pause()", "ws.WebSocket.pause() is not implemented in bun");
  }
  resume() {
    switch (this.readyState) {
      case 0:
      case 3:
        return;
    }
    this.#paused = !1, emitWarning("resume()", "ws.WebSocket.resume() is not implemented in bun");
  }
}
Object.defineProperty(BunWebSocket, "name", { value: "WebSocket" });
var wsKeyRegex = /^[+/0-9A-Za-z]{22}==$/, wsTokenChars = [
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  0,
  1,
  1,
  1,
  1,
  1,
  0,
  0,
  1,
  1,
  0,
  1,
  1,
  0,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  0,
  1,
  0,
  1,
  0
];
function subprotocolParse(header) {
  let protocols = /* @__PURE__ */ new Set, start = -1, end = -1, i = 0;
  for (i;i < header.length; i++) {
    let code = header.charCodeAt(i);
    if (end === -1 && wsTokenChars[code] === 1) {
      if (start === -1)
        start = i;
    } else if (i !== 0 && (code === 32 || code === 9)) {
      if (end === -1 && start !== -1)
        end = i;
    } else if (code === 44) {
      if (start === -1)
        throw SyntaxError(`Unexpected character at index ${i}`);
      if (end === -1)
        end = i;
      let protocol2 = header.slice(start, end);
      if (protocols.has(protocol2))
        throw SyntaxError(`The "${protocol2}" subprotocol is duplicated`);
      protocols.add(protocol2), start = end = -1;
    } else
      throw SyntaxError(`Unexpected character at index ${i}`);
  }
  if (start === -1 || end !== -1)
    throw SyntaxError("Unexpected end of input");
  let protocol = header.slice(start, i);
  if (protocols.has(protocol))
    throw SyntaxError(`The "${protocol}" subprotocol is duplicated`);
  return protocols.add(protocol), protocols;
}
function wsEmitClose(server) {
  server._state = CLOSED, server.emit("close");
}
function abortHandshake(response, code, message, headers = {}) {
  message = message || http.STATUS_CODES[code], headers = {
    Connection: "close",
    "Content-Type": "text/html",
    "Content-Length": @Buffer.byteLength(message),
    ...headers
  }, response.writeHead(code, headers), response.write(message), response.end();
}
function abortHandshakeOrEmitwsClientError(server, req, response, socket, code, message) {
  if (server.listenerCount("wsClientError")) {
    let err = Error(message);
    Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError), server.emit("wsClientError", err, socket, req);
  } else
    abortHandshake(response, code, message);
}
var RUNNING = 0, CLOSING = 1, CLOSED = 2;

class BunWebSocketMocked extends EventEmitter {
  #ws;
  #state;
  #enquedMessages = [];
  #url;
  #protocol;
  #extensions;
  #bufferedAmount = 0;
  #binaryType = "arraybuffer";
  #onclose;
  #onerror;
  #onmessage;
  #onopen;
  constructor(url, protocol, extensions, binaryType) {
    super();
    if (this.#ws = null, this.#state = 0, this.#url = url, this.#bufferedAmount = 0, binaryType = binaryType || "arraybuffer", binaryType !== "nodebuffer" && binaryType !== "blob" && binaryType !== "arraybuffer")
      @throwTypeError("binaryType must be either 'blob', 'arraybuffer' or 'nodebuffer'");
    this.#binaryType = binaryType, this.#protocol = protocol, this.#extensions = extensions;
    let message = this.#message.bind(this), open = this.#open.bind(this), close = this.#close.bind(this), drain = this.#drain.bind(this), ping = this.#ping.bind(this), pong = this.#pong.bind(this);
    this[kBunInternals] = {
      message,
      open,
      close,
      drain,
      ping,
      pong
    };
  }
  #ping(ws, data) {
    this.#ws = ws, this.emit("ping", data);
  }
  #pong(ws, data) {
    this.#ws = ws, this.emit("pong", data);
  }
  #message(ws, message) {
    this.#ws = ws;
    let isBinary = !1;
    if (typeof message === "string")
      if (this.#binaryType === "arraybuffer")
        message = encoder.encode(message).buffer;
      else if (this.#binaryType === "blob")
        message = new Blob([message], { type: "text/plain" });
      else
        message = @Buffer.from(message);
    else if (isBinary = !0, this.#binaryType !== "nodebuffer") {
      if (this.#binaryType === "arraybuffer")
        message = new @Uint8Array(message);
      else if (this.#binaryType === "blob")
        message = new Blob([message]);
    }
    this.emit("message", message, isBinary);
  }
  #open(ws) {
    this.#ws = ws, this.#state = 1, this.emit("open", this), this.#drain(ws);
  }
  #close(ws, code, reason) {
    this.#state = 3, this.#ws = null, this.emit("close", code, reason);
  }
  #drain(ws) {
    let chunk;
    while ((chunk = this.#enquedMessages[0]) && this.#state === 1) {
      let [data, compress, cb] = chunk;
      if (ws.send(data, compress) < 1)
        return;
      if (this.#bufferedAmount -= chunk.length, this.#enquedMessages.shift(), typeof cb === "function")
        queueMicrotask(cb);
    }
  }
  ping(data, mask, cb) {
    if (this.#state === 0)
      throw Error("WebSocket is not open: readyState 0 (CONNECTING)");
    if (typeof data === "function")
      cb = data, data = mask = @undefined;
    else if (typeof mask === "function")
      cb = mask, mask = @undefined;
    if (typeof data === "number")
      data = data.toString();
    try {
      if (data === @undefined)
        this.#ws.ping();
      else
        this.#ws.ping(data);
    } catch (error) {
      if (typeof cb === "function")
        cb(error);
      return;
    }
    if (typeof cb === "function")
      cb();
  }
  pong(data, mask, cb) {
    if (this.#state === 0)
      throw Error("WebSocket is not open: readyState 0 (CONNECTING)");
    if (typeof data === "function")
      cb = data, data = mask = @undefined;
    else if (typeof mask === "function")
      cb = mask, mask = @undefined;
    if (typeof data === "number")
      data = data.toString();
    try {
      if (data === @undefined)
        this.#ws.pong();
      else
        this.#ws.pong(data);
    } catch (error) {
      if (typeof cb === "function")
        cb(error);
      return;
    }
    if (typeof cb === "function")
      cb();
  }
  send(data, opts, cb) {
    if (@isCallable(opts))
      cb = opts, opts = @undefined;
    if (this.#state === 1) {
      let compress = opts?.compress;
      if (data = normalizeData(data, opts), this.#ws.send(data, compress) === 0) {
        this.#enquedMessages.push([data, compress, cb]), this.#bufferedAmount += data.length;
        return;
      }
      if (typeof cb === "function")
        process.nextTick(cb);
    } else if (this.#state === 0)
      this.#enquedMessages.push([data, opts?.compress, cb]), this.#bufferedAmount += data.length;
  }
  close(code, reason) {
    if (this.#state === 1)
      this.#state = 2, this.#ws.close(code, reason);
  }
  terminate() {
    if (!this)
      return;
    let state = this.#state;
    if (state === 3)
      return;
    if (state === 0) {
      abortHandshake(this, this._req, "WebSocket was closed before the connection was established");
      return;
    }
    let ws = this.#ws;
    if (ws)
      this.#state = 2, ws.terminate();
  }
  get binaryType() {
    return this.#binaryType;
  }
  set binaryType(type) {
    if (type !== "nodebuffer" && type !== "blob" && type !== "arraybuffer")
      @throwTypeError("binaryType must be either 'blob', 'arraybuffer' or 'nodebuffer'");
    this.#binaryType = type;
  }
  get readyState() {
    return this.#state;
  }
  get url() {
    return this.#url;
  }
  get protocol() {
    return this.#protocol;
  }
  get extensions() {
    return this.#extensions;
  }
  get bufferedAmount() {
    return this.#bufferedAmount ?? 0;
  }
  setSocket(_socket, _head, _options) {
    throw Error("Not implemented");
  }
  set onclose(cb) {
    if (this.#onclose)
      this.removeListener("close", this.#onclose);
    this.on("close", cb), this.#onclose = cb;
  }
  set onerror(cb) {
    if (this.#onerror)
      this.removeListener("error", this.#onerror);
    this.on("error", cb), this.#onerror = cb;
  }
  set onmessage(cb) {
    if (this.#onmessage)
      this.removeListener("message", this.#onmessage);
    let l = (data) => cb({ data });
    this.on("message", l), this.#onmessage = l;
  }
  set onopen(cb) {
    if (this.#onopen)
      this.removeListener("open", this.#onopen);
    this.on("open", cb), this.#onopen = cb;
  }
  get onclose() {
    return this.#onclose;
  }
  get onerror() {
    return this.#onerror;
  }
  get onmessage() {
    return this.#onmessage;
  }
  get onopen() {
    return this.#onopen;
  }
  addEventListener(type, listener, _options) {
    if (type === "message") {
      let l = (data) => listener({ data });
      l.listener = listener, this.on(type, l);
      return;
    }
    this.on(type, listener);
  }
  removeEventListener(type, listener) {
    this.off(type, listener);
  }
}

class WebSocketServer extends EventEmitter {
  _server;
  options;
  clients;
  _shouldEmitClose;
  _state;
  _removeListeners;
  constructor(options, callback) {
    super();
    if (options = {
      maxPayload: 104857600,
      skipUTF8Validation: !1,
      perMessageDeflate: !1,
      handleProtocols: null,
      clientTracking: !0,
      verifyClient: null,
      noServer: !1,
      backlog: null,
      server: null,
      host: null,
      path: null,
      port: null,
      ...options
    }, options.port == null && !options.server && !options.noServer || options.port != null && (options.server || options.noServer) || options.server && options.noServer)
      @throwTypeError('One and only one of the "port", "server", or "noServer" options must be specified');
    if (options.port != null)
      this._server = http.createServer((req, res) => {
        let body = http.STATUS_CODES[426];
        res.writeHead(426, {
          "Content-Length": body.length,
          "Content-Type": "text/plain"
        }), res.end(body);
      }), this._server.listen(options.port, options.host, options.backlog, callback);
    else if (options.server)
      this._server = options.server;
    if (this._server) {
      let emitConnection = this.emit.bind(this, "connection"), emitListening = this.emit.bind(this, "listening"), emitError = this.emit.bind(this, "error"), doUpgrade = (req, socket, head) => {
        this.handleUpgrade(req, socket, head, emitConnection);
      };
      this._server.on("listening", emitListening), this._server.on("error", emitError), this._server.on("upgrade", doUpgrade), this._removeListeners = () => {
        this._server.removeListener("upgrade", doUpgrade), this._server.removeListener("listening", emitListening), this._server.removeListener("error", emitError);
      };
    }
    if (options.perMessageDeflate === !0)
      options.perMessageDeflate = {};
    if (options.clientTracking)
      this.clients = /* @__PURE__ */ new Set, this._shouldEmitClose = !1;
    this.options = options, this._state = RUNNING;
  }
  address() {
    if (this.options.noServer)
      throw Error('The server is operating in "noServer" mode');
    if (!this._server)
      return null;
    return this._server.address();
  }
  close(cb) {
    if (this._state === CLOSED) {
      if (cb)
        this.once("close", () => {
          cb(Error("The server is not running"));
        });
      process.nextTick((server) => {
        server._state = CLOSED, server.emit("close");
      }, this);
      return;
    }
    if (cb)
      this.once("close", cb);
    if (this._state === CLOSING)
      return;
    if (this._state = CLOSING, this.options.noServer || this.options.server) {
      if (this._server)
        this._removeListeners(), this._removeListeners = this._server = null;
      if (this.clients)
        if (!this.clients.size)
          process.nextTick((server) => {
            server._state = CLOSED, server.emit("close");
          }, this);
        else
          this._shouldEmitClose = !0;
      else
        process.nextTick((server) => {
          server._state = CLOSED, server.emit("close");
        }, this);
    } else {
      let server = this._server;
      this._removeListeners(), this._removeListeners = this._server = null, server.close(() => {
        this._state = CLOSED, this.emit("close");
      });
    }
  }
  shouldHandle(req) {
    if (this.options.path) {
      let index = req.url.indexOf("?");
      if ((index !== -1 ? req.url.slice(0, index) : req.url) !== this.options.path)
        return !1;
    }
    return !0;
  }
  completeUpgrade(extensions, key, protocols, request, socket, head, cb) {
    let response = socket._httpMessage, server = socket.server[kBunInternals], req = socket[kBunInternals];
    if (this._state > RUNNING)
      return abortHandshake(response, 503);
    let protocol = "";
    if (protocols.size)
      protocol = this.options.handleProtocols ? this.options.handleProtocols(protocols, request) : protocols.values().next().value;
    let ws = new BunWebSocketMocked(request.url, protocol, extensions, "nodebuffer"), headers = ["HTTP/1.1 101 Switching Protocols", "Upgrade: websocket", "Connection: Upgrade"];
    if (this.emit("headers", headers, request), server.upgrade(req, {
      data: ws[kBunInternals],
      headers: protocol ? { "sec-websocket-protocol": protocol } : @undefined
    })) {
      if (this.clients)
        this.clients.add(ws), ws.on("close", () => {
          if (this.clients.delete(ws), this._shouldEmitClose && !this.clients.size)
            process.nextTick(wsEmitClose, this);
        });
      cb(ws, request);
    } else
      abortHandshake(response, 500);
  }
  handleUpgrade(req, socket, head, cb) {
    let response = socket._httpMessage || socket[kBunInternals], key = req.headers["sec-websocket-key"], version = +req.headers["sec-websocket-version"];
    if (req.method !== "GET") {
      abortHandshakeOrEmitwsClientError(this, req, response, socket, 405, "Invalid HTTP method");
      return;
    }
    if (req.headers.upgrade.toLowerCase() !== "websocket") {
      abortHandshakeOrEmitwsClientError(this, req, response, socket, 400, "Invalid Upgrade header");
      return;
    }
    if (!key || !wsKeyRegex.test(key)) {
      abortHandshakeOrEmitwsClientError(this, req, response, socket, 400, "Missing or invalid Sec-WebSocket-Key header");
      return;
    }
    if (version !== 8 && version !== 13) {
      abortHandshakeOrEmitwsClientError(this, req, response, socket, 400, "Missing or invalid Sec-WebSocket-Version header");
      return;
    }
    if (!this.shouldHandle(req)) {
      abortHandshake(response, 400);
      return;
    }
    let secWebSocketProtocol = req.headers["sec-websocket-protocol"], protocols = /* @__PURE__ */ new Set;
    if (secWebSocketProtocol !== @undefined)
      try {
        protocols = subprotocolParse(secWebSocketProtocol);
      } catch {
        abortHandshakeOrEmitwsClientError(this, req, response, socket, 400, "Invalid Sec-WebSocket-Protocol header");
        return;
      }
    let extensions = {};
    if (this.options.verifyClient) {
      let info = {
        origin: req.headers[`${version === 8 ? "sec-websocket-origin" : "origin"}`],
        secure: !!(req.socket.authorized || req.socket.encrypted),
        req
      };
      if (this.options.verifyClient.length === 2) {
        this.options.verifyClient(info, (verified, code, message, headers) => {
          if (!verified)
            return abortHandshake(response, code || 401, message, headers);
          this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
        });
        return;
      }
      if (!this.options.verifyClient(info))
        return abortHandshake(response, 401);
    }
    this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
  }
}
Object.defineProperty(BunWebSocket, "CONNECTING", {
  enumerable: !0,
  value: readyStates.indexOf("CONNECTING")
});
Object.defineProperty(BunWebSocket.prototype, "CONNECTING", {
  enumerable: !0,
  value: readyStates.indexOf("CONNECTING")
});
Object.defineProperty(BunWebSocket, "OPEN", {
  enumerable: !0,
  value: readyStates.indexOf("OPEN")
});
Object.defineProperty(BunWebSocket.prototype, "OPEN", {
  enumerable: !0,
  value: readyStates.indexOf("OPEN")
});
Object.defineProperty(BunWebSocket, "CLOSING", {
  enumerable: !0,
  value: readyStates.indexOf("CLOSING")
});
Object.defineProperty(BunWebSocket.prototype, "CLOSING", {
  enumerable: !0,
  value: readyStates.indexOf("CLOSING")
});
Object.defineProperty(BunWebSocket, "CLOSED", {
  enumerable: !0,
  value: readyStates.indexOf("CLOSED")
});
Object.defineProperty(BunWebSocket.prototype, "CLOSED", {
  enumerable: !0,
  value: readyStates.indexOf("CLOSED")
});
Object.defineProperty(BunWebSocketMocked.prototype, "CONNECTING", {
  enumerable: !0,
  value: readyStates.indexOf("CONNECTING")
});
Object.defineProperty(BunWebSocketMocked.prototype, "OPEN", {
  enumerable: !0,
  value: readyStates.indexOf("OPEN")
});
Object.defineProperty(BunWebSocketMocked.prototype, "CLOSING", {
  enumerable: !0,
  value: readyStates.indexOf("CLOSING")
});
Object.defineProperty(BunWebSocketMocked.prototype, "CLOSED", {
  enumerable: !0,
  value: readyStates.indexOf("CLOSED")
});

class Sender {
  constructor() {
    throw Error("Not supported yet in Bun");
  }
}

class Receiver {
  constructor() {
    throw Error("Not supported yet in Bun");
  }
}
var createWebSocketStream = (_ws) => {
  throw Error("Not supported yet in Bun");
};
$ = Object.assign(BunWebSocket, {
  createWebSocketStream,
  Receiver,
  Sender,
  WebSocket: BunWebSocket,
  Server: WebSocketServer,
  WebSocketServer
});
return $})

