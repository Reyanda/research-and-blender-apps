(function (){"use strict";// build/release/tmp_modules/node/_http_client.ts
var $, { isIP, isIPv6 } = @getInternalField(@internalModuleRegistry, 28) || @createInternalModuleById(28), {
  checkIsHttpToken,
  validateFunction,
  validateInteger,
  validateBoolean,
  validateString
} = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), nodeHttpClient = @lazy(39), { urlToHttpOptions } = @getInternalField(@internalModuleRegistry, 63) || @createInternalModuleById(63), { throwOnInvalidTLSArray } = @getInternalField(@internalModuleRegistry, 61) || @createInternalModuleById(61), { validateHeaderName } = @getInternalField(@internalModuleRegistry, 73) || @createInternalModuleById(73), { getTimerDuration } = @getInternalField(@internalModuleRegistry, 60) || @createInternalModuleById(60), { ConnResetException } = @getInternalField(@internalModuleRegistry, 32) || @createInternalModuleById(32), {
  kBodyChunks,
  abortedSymbol,
  kClearTimeout,
  emitErrorNextTickIfErrorListenerNT,
  isAbortError,
  kTls,
  kAbortController,
  kMethod,
  kAgent,
  kProtocol,
  kPath,
  kUseDefaultPort,
  kHost,
  kPort,
  kSocketPath,
  kFetchRequest,
  kRes,
  kUpgradeOrConnect,
  kParser,
  kMaxHeaderSize,
  kMaxHeadersCount,
  kReusedSocket,
  kOptions,
  kTimeoutTimer,
  kEmitState,
  ClientRequestEmitState,
  kSignal,
  kEmptyObject,
  getIsNextIncomingMessageHTTPS,
  setIsNextIncomingMessageHTTPS,
  typeSymbol,
  NodeHTTPIncomingRequestType,
  reqSymbol,
  callCloseCallback,
  emitCloseNTAndComplete
} = @getInternalField(@internalModuleRegistry, 25) || @createInternalModuleById(25), { globalAgent } = @getInternalField(@internalModuleRegistry, 71) || @createInternalModuleById(71), { IncomingMessage } = @getInternalField(@internalModuleRegistry, 74) || @createInternalModuleById(74), { OutgoingMessage } = @getInternalField(@internalModuleRegistry, 75) || @createInternalModuleById(75), globalReportError = globalThis.reportError, setTimeout = globalThis.setTimeout, INVALID_PATH_REGEX = /[^\u0021-\u00ff]/, { URL } = globalThis, ObjectAssign = Object.assign, RegExpPrototypeExec = @RegExp.prototype.exec, StringPrototypeToUpperCase = @String.prototype.toUpperCase;
function emitErrorEventNT(self, err) {
  if (self.destroyed)
    return;
  if (self.listenerCount("error") > 0)
    self.emit("error", err);
}
function ClientRequest(input, options, cb) {
  if (!(this instanceof ClientRequest))
    return new ClientRequest(input, options, cb);
  this.write = (chunk, encoding, callback) => {
    if (this.destroyed)
      return !1;
    if (@isCallable(chunk))
      callback = chunk, chunk = @undefined, encoding = @undefined;
    else if (@isCallable(encoding))
      callback = encoding, encoding = @undefined;
    else if (!@isCallable(callback))
      callback = @undefined;
    return write_(chunk, encoding, callback);
  };
  let writeCount = 0, resolveNextChunk = (_end) => {}, pushChunk = (chunk) => {
    if (this[kBodyChunks].push(chunk), writeCount > 1)
      startFetch();
    resolveNextChunk?.(!1);
  }, write_ = (chunk, encoding, callback) => {
    let canSkipReEncodingData = typeof chunk === "string" && (encoding === "utf-8" || encoding === "utf8" || !encoding) || @isTypedArrayView(chunk) && (!encoding || encoding === "buffer" || encoding === "utf-8"), bodySize = 0;
    if (!canSkipReEncodingData)
      chunk = @Buffer.from(chunk, encoding);
    if (bodySize = chunk.length, writeCount++, !this[kBodyChunks]) {
      if (this[kBodyChunks] = [], pushChunk(chunk), callback)
        callback();
      return !0;
    }
    for (let chunk2 of this[kBodyChunks])
      if (bodySize += chunk2.length, bodySize >= 1048576)
        break;
    if (pushChunk(chunk), callback)
      callback();
    return bodySize < 1048576;
  }, oldEnd = this.end;
  this.end = function(chunk, encoding, callback) {
    if (oldEnd?.@call(this, chunk, encoding, callback), @isCallable(chunk))
      callback = chunk, chunk = @undefined, encoding = @undefined;
    else if (@isCallable(encoding))
      callback = encoding, encoding = @undefined;
    else if (!@isCallable(callback))
      callback = @undefined;
    if (chunk) {
      if (this.finished)
        return emitErrorNextTickIfErrorListenerNT(this, @makeErrorWithCode(236), callback), this;
      write_(chunk, encoding, null);
    } else if (this.finished) {
      if (callback)
        if (!this.writableFinished)
          this.on("finish", callback);
        else
          callback(@makeErrorWithCode(226, "end"));
    }
    if (callback)
      this.once("finish", callback);
    if (!this.finished)
      send(), resolveNextChunk?.(!0);
    return this;
  }, this.flushHeaders = function() {
    if (!fetching)
      this[kAbortController] ??= new AbortController, this[kAbortController].signal.addEventListener("abort", onAbort, {
        once: !0
      }), startFetch();
  }, this.destroy = function(err) {
    if (this.destroyed)
      return this;
    this.destroyed = !0;
    let res = this.res;
    if (res)
      res._dump();
    if (this.finished = !0, this.res && !this.res.complete)
      this.res.emit("end");
    return this[kAbortController]?.abort?.(), this.socket.destroy(err), this;
  }, this._ensureTls = () => {
    if (this[kTls] === null)
      this[kTls] = {};
    return this[kTls];
  };
  let socketCloseListener = () => {
    this.destroyed = !0;
    let res = this.res;
    if (res) {
      if (!res.complete)
        res.destroy(new ConnResetException("aborted"));
      if (!this._closed)
        this._closed = !0, callCloseCallback(this), this.emit("close"), this.socket?.emit?.("close");
      if (!res.aborted && res.readable)
        res.push(null);
    } else if (!this._closed)
      this._closed = !0, callCloseCallback(this), this.emit("close"), this.socket?.emit?.("close");
  }, onAbort = (_err) => {
    if (this[kClearTimeout]?.(), socketCloseListener(), !this[abortedSymbol] && !this?.res?.complete)
      process.nextTick(emitAbortNextTick, this), this[abortedSymbol] = !0;
  }, fetching = !1, startFetch = (customBody) => {
    if (fetching)
      return !1;
    fetching = !0;
    let method2 = this[kMethod], keepalive = !0, agentKeepalive = this[kAgent]?.keepAlive;
    if (agentKeepalive !== @undefined)
      keepalive = agentKeepalive;
    let protocol2 = this[kProtocol], path = this[kPath], host2 = this[kHost], getURL = (host3) => {
      if (isIPv6(host3))
        host3 = `[${host3}]`;
      if (path.startsWith("http://") || path.startsWith("https://"))
        return [path, `${protocol2}//${host3}${this[kUseDefaultPort] ? "" : ":" + this[kPort]}`];
      else {
        let proxy, url = `${protocol2}//${host3}${this[kUseDefaultPort] ? "" : ":" + this[kPort]}${path}`;
        try {
          let agentProxy = this[kAgent]?.proxy;
          proxy = agentProxy?.href || agentProxy;
        } catch {}
        return [url, proxy];
      }
    }, go = (url, proxy, softFail = !1) => {
      let tls = protocol2 === "https:" && this[kTls] ? { ...this[kTls], serverName: this[kTls].servername } : @undefined, fetchOptions = {
        method: method2,
        headers: this.getHeaders(),
        redirect: "manual",
        signal: this[kAbortController]?.signal,
        timeout: !1,
        decompress: !1,
        keepalive
      }, keepOpen = !1, isDuplex = customBody === @undefined && !this.finished;
      if (isDuplex)
        fetchOptions.duplex = "half", keepOpen = !0;
      if (customBody !== @undefined)
        fetchOptions.body = customBody;
      else if (isDuplex && (method2 !== "GET" && method2 !== "HEAD" && method2 !== "OPTIONS" || this[kBodyChunks]?.length > 0)) {
        let self = this;
        fetchOptions.body = async function* () {
          while (self[kBodyChunks]?.length > 0)
            yield self[kBodyChunks].shift();
          if (self[kBodyChunks]?.length === 0)
            self.emit("drain");
          while (!self.finished)
            if (yield await new @Promise((resolve) => {
              resolveNextChunk = (end) => {
                if (resolveNextChunk = @undefined, end)
                  resolve(@undefined);
                else
                  resolve(self[kBodyChunks].shift());
              };
            }), self[kBodyChunks]?.length === 0)
              self.emit("drain");
          handleResponse?.();
        };
      }
      if (tls)
        fetchOptions.tls = tls;
      if (proxy)
        fetchOptions.proxy = proxy;
      let socketPath = this[kSocketPath];
      if (socketPath)
        fetchOptions.unix = socketPath;
      if (this[kFetchRequest] = nodeHttpClient(url, fetchOptions).then((response) => {
        if (this.aborted) {
          maybeEmitClose();
          return;
        }
        if (handleResponse = () => {
          this[kFetchRequest] = null, this[kClearTimeout](), handleResponse = @undefined;
          let prevIsHTTPS = getIsNextIncomingMessageHTTPS();
          setIsNextIncomingMessageHTTPS(response.url.startsWith("https:"));
          var res = this.res = new IncomingMessage(response, {
            [typeSymbol]: NodeHTTPIncomingRequestType.FetchResponse,
            [reqSymbol]: this
          });
          setIsNextIncomingMessageHTTPS(prevIsHTTPS), res.req = this;
          let timer;
          res.setTimeout = (msecs, callback) => {
            if (timer)
              clearTimeout(timer);
            timer = setTimeout(() => {
              if (res.complete)
                return;
              res.emit("timeout"), callback?.();
            }, msecs);
          }, process.nextTick((self, res2) => {
            let contentLength = res2.headers["content-length"];
            if (contentLength && isNaN(Number(contentLength))) {
              emitErrorEventNT(self, @makeErrorWithCode(287, "Parse Error")), res2.complete = !0, maybeEmitClose();
              return;
            }
            try {
              if (self.aborted || !self.emit("response", res2))
                res2._dump();
            } finally {
              if (maybeEmitClose(), res2.statusCode === 304) {
                res2.complete = !0, maybeEmitClose();
                return;
              }
            }
          }, this, res);
        }, !keepOpen)
          handleResponse();
        onEnd();
      }), !softFail)
        this[kFetchRequest].catch((err) => {
          if (err.code === "ConnectionRefused")
            err = Error("ECONNREFUSED"), err.code = "ECONNREFUSED";
          if (isAbortError(err))
            return;
          try {
            this.emit("error", err);
          } catch (_err) {}
        }).finally(() => {
          if (!keepOpen)
            fetching = !1, this[kFetchRequest] = null, this[kClearTimeout]();
        });
      return this[kFetchRequest];
    };
    if (isIP(host2) || !options.lookup) {
      let [url, proxy] = getURL(host2);
      return go(url, proxy, !1), !0;
    }
    try {
      return options.lookup(host2, { all: !0 }, (err, results) => {
        if (err) {
          process.nextTick((self, err2) => self.emit("error", err2), this, err);
          return;
        }
        let candidates = results.sort((a, b) => b.family - a.family), fail = (message, name, code, syscall) => {
          let error = Error(message);
          error.name = name, error.code = code, error.syscall = syscall, process.nextTick((self, err2) => self.emit("error", err2), this, error);
        };
        if (candidates.length === 0) {
          fail("No records found", "DNSException", "ENOTFOUND", "getaddrinfo");
          return;
        }
        if (!this.hasHeader("Host"))
          this.setHeader("Host", `${host2}${this[kUseDefaultPort] ? "" : ":" + this[kPort]}`);
        if (protocol2 === "https:" && !this[kTls]?.servername)
          this._ensureTls().servername = host2;
        let iterate = () => {
          if (candidates.length === 0) {
            fail(`connect ECONNREFUSED ${host2}:${port}`, "Error", "ECONNREFUSED", "connect");
            return;
          }
          let [url, proxy] = getURL(candidates.shift().address);
          go(url, proxy, candidates.length > 0).catch(iterate);
        };
        iterate();
      }), !0;
    } catch (err) {
      return process.nextTick((self, err2) => self.emit("error", err2), this, err), !1;
    }
  }, onEnd = () => {}, handleResponse = () => {}, send = () => {
    this.finished = !0, this[kAbortController] ??= new AbortController, this[kAbortController].signal.addEventListener("abort", onAbort, { once: !0 });
    var body = this[kBodyChunks] && this[kBodyChunks].length > 1 ? new Blob(this[kBodyChunks]) : this[kBodyChunks]?.[0];
    try {
      startFetch(body), onEnd = () => {
        handleResponse?.();
      };
    } catch (err) {
      this.emit("error", err);
    } finally {
      process.nextTick(maybeEmitFinish.bind(this));
    }
  }, maybeEmitSocket = () => {
    if (this.destroyed)
      return;
    if (!(this[kEmitState] & 1 << ClientRequestEmitState.socket))
      this[kEmitState] |= 1 << ClientRequestEmitState.socket, this.emit("socket", this.socket);
  }, maybeEmitPrefinish = () => {
    if (maybeEmitSocket(), !(this[kEmitState] & 1 << ClientRequestEmitState.prefinish))
      this[kEmitState] |= 1 << ClientRequestEmitState.prefinish, this.emit("prefinish");
  }, maybeEmitFinish = () => {
    if (maybeEmitPrefinish(), !(this[kEmitState] & 1 << ClientRequestEmitState.finish))
      this[kEmitState] |= 1 << ClientRequestEmitState.finish, this.emit("finish");
  }, maybeEmitClose = () => {
    if (maybeEmitPrefinish(), !this._closed)
      process.nextTick(emitCloseNTAndComplete, this);
  };
  if (this.abort = () => {
    if (this.aborted)
      return;
    this[abortedSymbol] = !0, process.nextTick(emitAbortNextTick, this), this[kAbortController]?.abort?.(), this.destroy();
  }, typeof input === "string") {
    let urlStr = input;
    try {
      var urlObject = new URL(urlStr);
    } catch (_err) {
      throw @makeErrorWithCode(141, `Invalid URL: ${urlStr}`);
    }
    input = urlToHttpOptions(urlObject);
  } else if (input && typeof input === "object" && input instanceof URL)
    input = urlToHttpOptions(input);
  else
    cb = options, options = input, input = null;
  if (typeof options === "function")
    cb = options, options = input || kEmptyObject;
  else
    options = ObjectAssign(input || {}, options);
  this[kTls] = null, this[kAbortController] = null;
  let agent = options.agent, defaultAgent = options._defaultAgent || globalAgent;
  if (agent === !1)
    agent = new defaultAgent.constructor;
  else if (agent == null)
    agent = defaultAgent;
  else if (typeof agent.addRequest !== "function")
    throw @makeErrorWithCode(118, "options.agent", "Agent-like Object, undefined, or false", agent);
  this[kAgent] = agent, this.destroyed = !1;
  let protocol = options.protocol || defaultAgent.protocol, expectedProtocol = defaultAgent.protocol;
  if (this.agent.protocol)
    expectedProtocol = this.agent.protocol;
  if (protocol !== expectedProtocol)
    throw @makeErrorWithCode(133, protocol, expectedProtocol);
  if (this[kProtocol] = protocol, options.path) {
    let path = @String(options.path);
    if (RegExpPrototypeExec.@call(INVALID_PATH_REGEX, path) !== null)
      throw @makeErrorWithCode(251, "Request path");
  }
  let defaultPort = options.defaultPort || this[kAgent].defaultPort, port = this[kPort] = options.port || defaultPort || 80;
  this[kUseDefaultPort] = this[kPort] === defaultPort;
  let host = this[kHost] = options.host = validateHost(options.hostname, "hostname") || validateHost(options.host, "host") || "localhost";
  this[kSocketPath] = options.socketPath;
  let signal = options.signal;
  if (signal)
    signal.addEventListener("abort", () => {
      this[kAbortController]?.abort();
    }, { once: !0 }), this[kSignal] = signal;
  let method = options.method, methodIsString = typeof method === "string";
  if (method !== null && method !== @undefined && !methodIsString)
    throw @makeErrorWithCode(118, "options.method", "string", method);
  if (methodIsString && method) {
    if (!checkIsHttpToken(method))
      throw @makeErrorWithCode(127, "Method", method);
    method = this[kMethod] = StringPrototypeToUpperCase.@call(method);
  } else
    method = this[kMethod] = "GET";
  let { maxHeaderSize: _maxHeaderSize, maxHeaderSize } = options;
  if (maxHeaderSize !== @undefined)
    validateInteger(maxHeaderSize, "maxHeaderSize", 0);
  this.maxHeaderSize = maxHeaderSize, this[kMaxHeaderSize] = _maxHeaderSize;
  let insecureHTTPParser = options.insecureHTTPParser;
  if (insecureHTTPParser !== @undefined)
    validateBoolean(insecureHTTPParser, "options.insecureHTTPParser");
  this.insecureHTTPParser = insecureHTTPParser;
  let joinDuplicateHeaders = options.joinDuplicateHeaders;
  if (joinDuplicateHeaders !== @undefined)
    validateBoolean(joinDuplicateHeaders, "options.joinDuplicateHeaders");
  if (this.joinDuplicateHeaders = joinDuplicateHeaders, options.pfx)
    throw Error("pfx is not supported");
  let mergedTlsOptions = { __proto__: null, ...agent?.connectOpts, ...options, ...agent?.options };
  if (mergedTlsOptions.rejectUnauthorized !== @undefined)
    this._ensureTls().rejectUnauthorized = mergedTlsOptions.rejectUnauthorized;
  if (mergedTlsOptions.ca)
    throwOnInvalidTLSArray("options.ca", mergedTlsOptions.ca), this._ensureTls().ca = mergedTlsOptions.ca;
  if (mergedTlsOptions.cert)
    throwOnInvalidTLSArray("options.cert", mergedTlsOptions.cert), this._ensureTls().cert = mergedTlsOptions.cert;
  if (mergedTlsOptions.key)
    throwOnInvalidTLSArray("options.key", mergedTlsOptions.key), this._ensureTls().key = mergedTlsOptions.key;
  if (mergedTlsOptions.passphrase)
    validateString(mergedTlsOptions.passphrase, "options.passphrase"), this._ensureTls().passphrase = mergedTlsOptions.passphrase;
  if (mergedTlsOptions.ciphers)
    validateString(mergedTlsOptions.ciphers, "options.ciphers"), this._ensureTls().ciphers = mergedTlsOptions.ciphers;
  if (mergedTlsOptions.servername)
    validateString(mergedTlsOptions.servername, "options.servername"), this._ensureTls().servername = mergedTlsOptions.servername;
  if (mergedTlsOptions.secureOptions)
    validateInteger(mergedTlsOptions.secureOptions, "options.secureOptions"), this._ensureTls().secureOptions = mergedTlsOptions.secureOptions;
  if (this[kPath] = options.path || "/", cb)
    this.once("response", cb);
  if (this.finished = !1, this[kRes] = null, this[kUpgradeOrConnect] = !1, this[kParser] = null, this[kMaxHeadersCount] = null, this[kReusedSocket] = !1, this[kHost] = host, this[kProtocol] = protocol, options.timeout !== @undefined) {
    let timeout = getTimerDuration(options.timeout, "timeout");
    this.timeout = timeout, this.setTimeout(timeout, @undefined);
  }
  let { headers } = options;
  if (@isJSArray(headers)) {
    let length = headers.length;
    if (@isJSArray(headers[0]))
      for (let i = 0;i < length; i++) {
        let actualHeader = headers[i];
        if (actualHeader.length !== 2)
          throw @makeErrorWithCode(119, "options.headers", "expected array of [key, value]");
        let key = actualHeader[0];
        if (validateHeaderName(key), key?.toLowerCase() === "host") {
          if (!this.getHeader(key))
            this.setHeader(key, actualHeader[1]);
        } else
          this.appendHeader(key, actualHeader[1]);
      }
    else {
      if (length % 2 !== 0)
        throw @makeErrorWithCode(119, "options.headers", "expected [key, value, key, value, ...]");
      for (let i = 0;i < length; )
        this.appendHeader(headers[i++], headers[i++]);
    }
  } else {
    if (headers)
      for (let key in headers) {
        let value = headers[key];
        if (key === "host" || key === "hostname") {
          if (value !== null && value !== @undefined && typeof value !== "string")
            throw @makeErrorWithCode(118, `options.${key}`, ["string", "undefined", "null"], value);
        }
        this.setHeader(key, value);
      }
    var auth = options.auth;
    if (auth && !this.getHeader("Authorization"))
      this.setHeader("Authorization", "Basic " + @Buffer.from(auth).toString("base64"));
  }
  let { signal: _signal, ...optsWithoutSignal } = options;
  this[kOptions] = optsWithoutSignal, this._httpMessage = this, process.nextTick(emitContinueAndSocketNT, this), this[kEmitState] = 0, this.setSocketKeepAlive = (_enable = !0, _initialDelay = 0) => {}, this.setNoDelay = (_noDelay = !0) => {}, this[kClearTimeout] = () => {
    let timeoutTimer = this[kTimeoutTimer];
    if (timeoutTimer)
      clearTimeout(timeoutTimer), this[kTimeoutTimer] = @undefined, this.removeAllListeners("timeout");
  };
}
var ClientRequestPrototype = {
  constructor: ClientRequest,
  __proto__: OutgoingMessage.prototype,
  setTimeout(msecs, callback) {
    if (this.destroyed)
      return this;
    if (this.timeout = msecs = getTimerDuration(msecs, "msecs"), clearTimeout(this[kTimeoutTimer]), msecs === 0) {
      if (callback !== @undefined)
        validateFunction(callback, "callback"), this.removeListener("timeout", callback);
      this[kTimeoutTimer] = @undefined;
    } else if (this[kTimeoutTimer] = setTimeout(() => {
      this[kTimeoutTimer] = @undefined, this[kAbortController]?.abort(), this.emit("timeout");
    }, msecs).unref(), callback !== @undefined)
      validateFunction(callback, "callback"), this.once("timeout", callback);
    return this;
  },
  clearTimeout(cb) {
    this.setTimeout(0, cb);
  },
  get path() {
    return this[kPath];
  },
  get port() {
    return this[kPort];
  },
  get method() {
    return this[kMethod];
  },
  get host() {
    return this[kHost];
  },
  get protocol() {
    return this[kProtocol];
  },
  get agent() {
    return this[kAgent];
  },
  set agent(value) {
    this[kAgent] = value;
  },
  get aborted() {
    return this[abortedSymbol] || this[kSignal]?.aborted || !!this[kAbortController]?.signal.aborted;
  },
  set aborted(value) {
    this[abortedSymbol] = value;
  },
  get writable() {
    return !0;
  }
};
ClientRequest.prototype = ClientRequestPrototype;
@setPrototypeDirect.@call(ClientRequest, OutgoingMessage);
function validateHost(host, name) {
  if (host !== null && host !== @undefined && typeof host !== "string")
    throw @makeErrorWithCode(118, `options.${name}`, ["string", "undefined", "null"], host);
  return host;
}
function emitContinueAndSocketNT(self) {
  if (self.destroyed)
    return;
  if (!(self[kEmitState] & 1 << ClientRequestEmitState.socket))
    self[kEmitState] |= 1 << ClientRequestEmitState.socket, self.emit("socket", self.socket);
  if (!self._closed && self.getHeader("expect") === "100-continue")
    self.emit("continue");
}
function emitAbortNextTick(self) {
  self.emit("abort");
}
$ = {
  ClientRequest,
  kBodyChunks,
  abortedSymbol
};
return $})

