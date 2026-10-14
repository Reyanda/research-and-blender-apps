(function (){"use strict";// build/release/tmp_modules/node/http2.ts
var $, { isTypedArray } = @getInternalField(@internalModuleRegistry, 144) || @createInternalModuleById(144), { hideFromStack, throwNotImplemented } = @getInternalField(@internalModuleRegistry, 32) || @createInternalModuleById(32), { STATUS_CODES } = @getInternalField(@internalModuleRegistry, 25) || @createInternalModuleById(25), tls = @getInternalField(@internalModuleRegistry, 122) || @createInternalModuleById(122), net = @getInternalField(@internalModuleRegistry, 104) || @createInternalModuleById(104), fs = @getInternalField(@internalModuleRegistry, 98) || @createInternalModuleById(98), { @data } = @getInternalField(@internalModuleRegistry, 97) || @createInternalModuleById(97), FileHandle = @data.FileHandle;
var bunSocketServerOptions = Symbol.for("::bunnetserveroptions::"), kInfoHeaders = Symbol("sent-info-headers"), kProxySocket = Symbol("proxySocket"), kSessions = Symbol("sessions"), kOptions = Symbol("options"), kQuotedString = /^[\x09\x20-\x5b\x5d-\x7e\x80-\xff]*$/;
var Stream = @getInternalField(@internalModuleRegistry, 117) || @createInternalModuleById(117), { Readable } = Stream, TLSSocket = tls.TLSSocket, Socket = net.Socket, EventEmitter = @getInternalField(@internalModuleRegistry, 96) || @createInternalModuleById(96), { Duplex } = Stream, { SafeArrayIterator, SafeSet } = @getInternalField(@internalModuleRegistry, 30) || @createInternalModuleById(30), { promisify } = @getInternalField(@internalModuleRegistry, 31) || @createInternalModuleById(31), RegExpPrototypeExec = @RegExp.prototype.exec, ObjectAssign = Object.assign, ArrayIsArray = @Array.isArray, ObjectKeys = Object.keys, FunctionPrototypeBind = Function.prototype.bind, StringPrototypeTrim = @String.prototype.trim, ArrayPrototypePush = @Array.prototype.push, StringPrototypeToLowerCase = @String.prototype.toLowerCase, StringPrototypeIncludes = @String.prototype.includes, StringPrototypeStartsWith = @String.prototype.startsWith, ObjectPrototypeHasOwnProperty = Object.prototype.hasOwnProperty, DatePrototypeToUTCString = Date.prototype.toUTCString, DatePrototypeGetMilliseconds = Date.prototype.getMilliseconds, H2FrameParser = @lazy(55), _nativeAssertSettings = @lazy(56), { upgradeRawSocketToH2 } = @getInternalField(@internalModuleRegistry, 70) || @createInternalModuleById(70);
var kSettingIds = {
  1: "headerTableSize",
  2: "enablePush",
  3: "maxConcurrentStreams",
  4: "initialWindowSize",
  5: "maxFrameSize",
  6: "maxHeaderListSize",
  8: "enableConnectProtocol"
}, kDefaultSettings = {
  headerTableSize: 4096,
  enablePush: !0,
  maxConcurrentStreams: 4294967295,
  initialWindowSize: 65535,
  maxFrameSize: 16384,
  maxHeaderListSize: 65535,
  maxHeaderSize: 65535,
  enableConnectProtocol: !1
};
function throwSettingRangeError(name, value) {
  let err = RangeError(`Invalid value for setting "${name}": ${value}`);
  throw err.code = "ERR_HTTP2_INVALID_SETTING_VALUE", err;
}
function throwSettingTypeError(name, value) {
  let err = @makeTypeError(`Invalid value for setting "${name}": ${value}`);
  throw err.code = "ERR_HTTP2_INVALID_SETTING_VALUE", err;
}
function validateSettings(settings) {
  if (typeof settings !== "object" || settings === null || @isArray(settings))
    throw @makeErrorWithCode(118, "settings", "object", settings);
  if (settings.headerTableSize !== @undefined) {
    let v = settings.headerTableSize;
    if (typeof v !== "number" || v < 0 || v > kMaxInt || Number.isNaN(v))
      throwSettingRangeError("headerTableSize", v);
  }
  if (settings.enablePush !== @undefined) {
    let v = settings.enablePush;
    if (typeof v !== "boolean")
      throwSettingTypeError("enablePush", v);
  }
  if (settings.initialWindowSize !== @undefined) {
    let v = settings.initialWindowSize;
    if (typeof v !== "number" || v < 0 || v > kMaxInt || Number.isNaN(v))
      throwSettingRangeError("initialWindowSize", v);
  }
  if (settings.maxFrameSize !== @undefined) {
    let v = settings.maxFrameSize;
    if (typeof v !== "number" || v < 16384 || v > 16777215 || Number.isNaN(v))
      throwSettingRangeError("maxFrameSize", v);
  }
  if (settings.maxConcurrentStreams !== @undefined) {
    let v = settings.maxConcurrentStreams;
    if (typeof v !== "number" || v < 0 || v > kMaxInt || Number.isNaN(v))
      throwSettingRangeError("maxConcurrentStreams", v);
  }
  if (settings.maxHeaderListSize !== @undefined) {
    let v = settings.maxHeaderListSize;
    if (typeof v !== "number" || v < 0 || v > kMaxInt || Number.isNaN(v))
      throwSettingRangeError("maxHeaderListSize", v);
  }
  if (settings.maxHeaderSize !== @undefined) {
    let v = settings.maxHeaderSize;
    if (typeof v !== "number" || v < 0 || v > kMaxInt || Number.isNaN(v))
      throwSettingRangeError("maxHeaderSize", v);
  }
  if (settings.enableConnectProtocol !== @undefined) {
    let v = settings.enableConnectProtocol;
    if (typeof v !== "boolean")
      throwSettingTypeError("enableConnectProtocol", v);
  }
  if (settings.customSettings !== @undefined) {
    let cs = settings.customSettings;
    if (typeof cs !== "object" || cs === null)
      throwSettingRangeError("customSettings", cs);
    let keys = ObjectKeys(cs);
    if (keys.length > 10) {
      let err = Error("Number of custom settings exceeds MAX_ADDITIONAL_SETTINGS");
      throw err.code = "ERR_HTTP2_TOO_MANY_CUSTOM_SETTINGS", err;
    }
    for (let key of keys) {
      let id = Number(key);
      if (!Number.isInteger(id) || id < 0 || id > 65535)
        throwSettingRangeError(key, cs[key]);
      let val = cs[key];
      if (typeof val !== "number" || val < 0 || val > kMaxInt || !Number.isFinite(val))
        throwSettingRangeError(key, val);
    }
  }
}
function assertSettings(settings) {
  validateSettings(settings);
}
function getPackedSettings(settings) {
  if (settings === @undefined)
    return @Buffer.alloc(0);
  validateSettings(settings);
  let entries = [];
  if (settings.headerTableSize !== @undefined)
    entries.push([1, settings.headerTableSize]);
  if (settings.enablePush !== @undefined)
    entries.push([2, settings.enablePush ? 1 : 0]);
  if (settings.maxConcurrentStreams !== @undefined)
    entries.push([3, settings.maxConcurrentStreams]);
  if (settings.initialWindowSize !== @undefined)
    entries.push([4, settings.initialWindowSize]);
  if (settings.maxFrameSize !== @undefined)
    entries.push([5, settings.maxFrameSize]);
  if (settings.maxHeaderListSize !== @undefined)
    entries.push([6, settings.maxHeaderListSize]);
  else if (settings.maxHeaderSize !== @undefined)
    entries.push([6, settings.maxHeaderSize]);
  if (settings.enableConnectProtocol !== @undefined)
    entries.push([8, settings.enableConnectProtocol ? 1 : 0]);
  if (settings.customSettings) {
    let cs = settings.customSettings, keys = ObjectKeys(cs);
    keys.sort((a, b) => Number(a) - Number(b));
    for (let key of keys)
      entries.push([Number(key), cs[key]]);
  }
  let buf = @Buffer.alloc(entries.length * 6);
  for (let i = 0;i < entries.length; i++) {
    let offset = i * 6;
    buf.writeUInt16BE(entries[i][0], offset), buf.writeUInt32BE(entries[i][1], offset + 2);
  }
  return buf;
}
function getUnpackedSettings(buf, options) {
  if (buf === @undefined)
    return { ...kDefaultSettings };
  if (!@Buffer.isBuffer(buf) && !isTypedArray(buf))
    throw @makeErrorWithCode(118, "buf", ["Buffer", "TypedArray"], buf);
  if (buf.length % 6 !== 0) {
    let err = RangeError("Packed settings length must be a multiple of six");
    throw err.code = "ERR_HTTP2_INVALID_PACKED_SETTINGS_LENGTH", err;
  }
  let settings = {}, customSettings = {}, hasCustom = !1;
  for (let i = 0;i < buf.length; i += 6) {
    let type = buf[i] * 256 + buf[i + 1], value = (buf[i + 2] << 24 | buf[i + 3] << 16 | buf[i + 4] << 8 | buf[i + 5]) >>> 0, name = kSettingIds[type];
    if (name) {
      if (name === "enablePush")
        settings[name] = value !== 0;
      else if (name === "enableConnectProtocol")
        settings[name] = value !== 0;
      else
        settings[name] = value;
      if (name === "maxHeaderListSize")
        settings.maxHeaderSize = value;
    } else
      customSettings[@String(type)] = value, hasCustom = !0;
  }
  if (hasCustom)
    settings.customSettings = customSettings;
  if (options && options.validate)
    validateSettings(settings);
  return settings;
}
var sensitiveHeaders = Symbol.for("nodejs.http2.sensitiveHeaders"), bunHTTP2Native = Symbol.for("::bunhttp2native::"), bunHTTP2Socket = Symbol.for("::bunhttp2socket::"), bunHTTP2OriginSet = Symbol("::bunhttp2originset::"), bunHTTP2StreamFinal = Symbol.for("::bunHTTP2StreamFinal::"), bunHTTP2WaitForTrailers = Symbol("::bunhttp2waitfortrailers::"), bunHTTP2StreamStatus = Symbol.for("::bunhttp2StreamStatus::"), bunHTTP2Session = Symbol.for("::bunhttp2session::"), bunHTTP2Headers = Symbol.for("::bunhttp2headers::"), ReflectGetPrototypeOf = Reflect.getPrototypeOf, kBeginSend = Symbol("begin-send"), kServer = Symbol("server"), kState = Symbol("state"), kStream = Symbol("stream"), kResponse = Symbol("response"), kHeaders = Symbol("headers"), kRawHeaders = Symbol("rawHeaders"), kTrailers = Symbol("trailers"), kRawTrailers = Symbol("rawTrailers"), kSetHeader = Symbol("setHeader"), kAppendHeader = Symbol("appendHeader"), kAborted = Symbol("aborted"), kRequest = Symbol("request"), kHeadRequest = Symbol("headRequest"), kMaxStreams = 4294967295, kMaxInt = 4294967295, kMaxWindowSize = 2147483647, {
  validateInteger,
  validateString,
  validateObject,
  validateFunction,
  checkIsHttpToken,
  validateLinkHeaderValue,
  validateUint32,
  validateInt32,
  validateBuffer,
  validateNumber
} = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), utcCache;
function utcDate() {
  if (!utcCache)
    cache();
  return utcCache;
}
function emitEventNT(self, event, ...args) {
  if (self.listenerCount(event) > 0)
    self.emit(event, ...args);
}
function emitErrorNT(self, error, destroy) {
  if (destroy)
    if (self.listenerCount("error") > 0)
      self.destroy(error);
    else
      self.destroy();
  else if (self.listenerCount("error") > 0)
    self.emit("error", error);
}
function emitOutofStreamErrorNT(self) {
  self.destroy(@makeErrorWithCode(94));
}
function cache() {
  let d = /* @__PURE__ */ new Date;
  utcCache = d.toUTCString(), setTimeout(resetCache, 1000 - d.getMilliseconds()).unref();
}
function resetCache() {
  utcCache = @undefined;
}
function getAuthority(headers) {
  if (headers[HTTP2_HEADER_AUTHORITY] !== @undefined)
    return headers[HTTP2_HEADER_AUTHORITY];
  if (headers[HTTP2_HEADER_HOST] !== @undefined)
    return headers[HTTP2_HEADER_HOST];
}
function onStreamData(chunk) {
  let request = this[kRequest];
  if (request !== @undefined && !request.push(chunk))
    this.pause();
}
function onStreamTrailers(trailers, flags, rawTrailers) {
  let request = this[kRequest];
  if (request !== @undefined)
    ObjectAssign(request[kTrailers], trailers), ArrayPrototypePush.@call(request[kRawTrailers], ...new SafeArrayIterator(rawTrailers));
}
function onStreamEnd() {
  if (this[kRequest] !== @undefined)
    this[kRequest].push(null);
}
function onStreamError(error) {}
function onRequestPause() {
  this[kStream].pause();
}
function onRequestResume() {
  this[kStream].resume();
}
function onStreamDrain() {
  let response = this[kResponse];
  if (response !== @undefined)
    response.emit("drain");
}
function onStreamAbortedResponse() {}
function onStreamAbortedRequest() {
  let request = this[kRequest];
  if (request !== @undefined && request[kState].closed === !1)
    request[kAborted] = !0, request.emit("aborted");
}
function resumeStream(stream) {
  stream.resume();
}
function onStreamTrailersReady() {
  this.sendTrailers(this[kResponse][kTrailers]);
}
function onStreamCloseResponse() {
  let res = this[kResponse];
  if (res === @undefined)
    return;
  let state = res[kState];
  if (this.headRequest !== state.headRequest)
    return;
  state.closed = !0, this.removeListener("wantTrailers", onStreamTrailersReady), this[kResponse] = @undefined, res.emit("finish"), res.emit("close");
}
function onStreamCloseRequest() {
  let req = this[kRequest];
  if (req === @undefined)
    return;
  let state = req[kState];
  if (state.closed = !0, req.push(null), !state.didRead && !req._readableState.resumeScheduled)
    req.resume();
  this[kRequest] = @undefined, req.emit("close");
}
function onStreamTimeout() {
  this.emit("timeout");
}
function isPseudoHeader(name) {
  switch (name) {
    case HTTP2_HEADER_STATUS:
    case HTTP2_HEADER_METHOD:
    case HTTP2_HEADER_PATH:
    case HTTP2_HEADER_AUTHORITY:
    case HTTP2_HEADER_SCHEME:
      return !0;
    default:
      return !1;
  }
}
function isConnectionHeaderAllowed(name, value) {
  return name !== HTTP2_HEADER_CONNECTION || value === "trailers";
}
var statusConnectionHeaderWarned = !1, statusMessageWarned = !1;
function statusMessageWarn() {
  if (statusMessageWarned === !1)
    process.emitWarning("Status message is not supported by HTTP/2 (RFC7540 8.1.2.4)", "UnsupportedWarning"), statusMessageWarned = !0;
}
function connectionHeaderMessageWarn() {
  if (statusConnectionHeaderWarned === !1)
    process.emitWarning("The provided connection header is not valid, the value will be dropped from the header and will never be in use.", "UnsupportedWarning"), statusConnectionHeaderWarned = !0;
}
function assertValidHeader(name, value) {
  if (name === "" || typeof name !== "string" || StringPrototypeIncludes.@call(name, " "))
    throw @makeErrorWithCode(127, "Header name", name);
  if (isPseudoHeader(name))
    throw @makeErrorWithCode(98);
  if (value === @undefined || value === null)
    throw @makeErrorWithCode(85, value, name);
  if (!isConnectionHeaderAllowed(name, value))
    connectionHeaderMessageWarn();
}
function assertIsObject(value, name, types) {
  if (value !== @undefined && (!@isObject(value) || @isArray(value)))
    throw @makeErrorWithCode(118, name, types || "Object", value);
}
function assertIsArray(value, name, types) {
  if (value !== @undefined && !@isArray(value))
    throw @makeErrorWithCode(118, name, types || "Array", value);
}
hideFromStack(assertIsObject);
hideFromStack(assertIsArray);
hideFromStack(assertValidHeader);

class Http2ServerRequest extends Readable {
  [kState];
  [kHeaders];
  [kRawHeaders];
  [kTrailers];
  [kRawTrailers];
  [kStream];
  [kAborted];
  constructor(stream, headers, options, rawHeaders) {
    super({ autoDestroy: !1, ...options });
    this[kState] = {
      closed: !1,
      didRead: !1
    }, this[kHeaders] = headers, this[kRawHeaders] = rawHeaders, this[kTrailers] = {}, this[kRawTrailers] = [], this[kStream] = stream, this[kAborted] = !1, stream[kRequest] = this, stream.on("trailers", onStreamTrailers), stream.on("end", onStreamEnd), stream.on("error", onStreamError), stream.on("aborted", onStreamAbortedRequest), stream.on("close", onStreamCloseRequest), stream.on("timeout", onStreamTimeout.bind(this)), this.on("pause", onRequestPause), this.on("resume", onRequestResume);
  }
  get aborted() {
    return this[kAborted];
  }
  get complete() {
    return this[kAborted] || this.readableEnded || this[kState].closed || this[kStream].destroyed;
  }
  get stream() {
    return this[kStream];
  }
  get headers() {
    return this[kHeaders];
  }
  get rawHeaders() {
    return this[kRawHeaders];
  }
  get trailers() {
    return this[kTrailers];
  }
  get rawTrailers() {
    return this[kRawTrailers];
  }
  get httpVersionMajor() {
    return 2;
  }
  get httpVersionMinor() {
    return 0;
  }
  get httpVersion() {
    return "2.0";
  }
  get socket() {
    let stream = this[kStream], proxySocket = stream[kProxySocket];
    if (proxySocket == null)
      return stream[kProxySocket] = new Proxy(stream, proxyCompatSocketHandler);
    return proxySocket;
  }
  get connection() {
    return this.socket;
  }
  _read(nread) {
    let state = this[kState];
    if (!state.didRead)
      state.didRead = !0, this[kStream].on("data", onStreamData);
    else
      process.nextTick(resumeStream, this[kStream]);
  }
  get method() {
    return this[kHeaders][HTTP2_HEADER_METHOD];
  }
  set method(method) {
    if (validateString(method, "method"), StringPrototypeTrim.@call(method) === "")
      throw @makeErrorWithCode(119, "method", method);
    this[kHeaders][HTTP2_HEADER_METHOD] = method;
  }
  get authority() {
    return getAuthority(this[kHeaders]);
  }
  get scheme() {
    return this[kHeaders][HTTP2_HEADER_SCHEME];
  }
  get url() {
    return this[kHeaders][HTTP2_HEADER_PATH];
  }
  set url(url) {
    this[kHeaders][HTTP2_HEADER_PATH] = url;
  }
  setTimeout(msecs, callback) {
    if (!this[kState].closed)
      this[kStream].setTimeout(msecs, callback);
    return this;
  }
}

class Http2ServerResponse extends Stream {
  [kState];
  [kHeaders];
  [kTrailers];
  [kStream];
  constructor(stream, options) {
    super(options);
    this[kState] = {
      closed: !1,
      ending: !1,
      destroyed: !1,
      headRequest: !1,
      sendDate: !0,
      statusCode: HTTP_STATUS_OK
    }, this[kHeaders] = Object.create(null), this[kTrailers] = Object.create(null), this[kStream] = stream, stream[kResponse] = this, this.writable = !0, this.req = stream[kRequest], stream.on("drain", onStreamDrain), stream.on("aborted", onStreamAbortedResponse), stream.on("close", onStreamCloseResponse), stream.on("wantTrailers", onStreamTrailersReady), stream.on("timeout", onStreamTimeout.bind(this));
  }
  get _header() {
    return this.headersSent;
  }
  get writableEnded() {
    return this[kState].ending;
  }
  get finished() {
    return this[kState].ending;
  }
  get socket() {
    if (this[kState].closed)
      return @undefined;
    return this[kStream]?.[bunHTTP2Session]?.socket;
  }
  get connection() {
    return this.socket;
  }
  get stream() {
    return this[kStream];
  }
  get headersSent() {
    return this[kStream].headersSent;
  }
  get sendDate() {
    return this[kState].sendDate;
  }
  set sendDate(bool) {
    this[kState].sendDate = Boolean(bool);
  }
  get statusCode() {
    return this[kState].statusCode;
  }
  get writableCorked() {
    return this[kStream].writableCorked;
  }
  get writableHighWaterMark() {
    return this[kStream].writableHighWaterMark;
  }
  get writableFinished() {
    return this[kStream].writableFinished;
  }
  get writableLength() {
    return this[kStream].writableLength;
  }
  set statusCode(code) {
    if (code |= 0, code >= 100 && code < 200)
      throw @makeErrorWithCode(84);
    if (code < 100 || code > 599)
      throw @makeErrorWithCode(105, code);
    this[kState].statusCode = code;
  }
  setTrailer(name, value) {
    validateString(name, "name"), name = StringPrototypeToLowerCase.@call(StringPrototypeTrim.@call(name)), assertValidHeader(name, value), this[kTrailers][name] = value;
  }
  addTrailers(headers) {
    let keys = ObjectKeys(headers), key = "";
    for (let i = 0;i < keys.length; i++)
      key = keys[i], this.setTrailer(key, headers[key]);
  }
  getHeader(name) {
    return validateString(name, "name"), name = StringPrototypeToLowerCase.@call(StringPrototypeTrim.@call(name)), this[kHeaders][name];
  }
  getHeaderNames() {
    return ObjectKeys(this[kHeaders]);
  }
  getHeaders() {
    let headers = Object.create(null);
    return ObjectAssign(headers, this[kHeaders]);
  }
  hasHeader(name) {
    return validateString(name, "name"), name = StringPrototypeToLowerCase.@call(StringPrototypeTrim.@call(name)), ObjectPrototypeHasOwnProperty.@call(this[kHeaders], name);
  }
  removeHeader(name) {
    if (validateString(name, "name"), this[kStream].headersSent)
      throw @makeErrorWithCode(83);
    if (name = StringPrototypeToLowerCase.@call(StringPrototypeTrim.@call(name)), name === "date") {
      this[kState].sendDate = !1;
      return;
    }
    delete this[kHeaders][name];
  }
  setHeader(name, value) {
    if (validateString(name, "name"), this[kStream].headersSent)
      throw @makeErrorWithCode(83);
    this[kSetHeader](name, value);
  }
  [kSetHeader](name, value) {
    if (name = StringPrototypeToLowerCase.@call(StringPrototypeTrim.@call(name)), assertValidHeader(name, value), !isConnectionHeaderAllowed(name, value))
      return;
    if (name[0] === ":")
      assertValidPseudoHeader(name);
    else if (!checkIsHttpToken(name))
      this.destroy(@makeErrorWithCode(127, "Header name", name));
    this[kHeaders][name] = value;
  }
  appendHeader(name, value) {
    if (validateString(name, "name"), this[kStream].headersSent)
      throw @makeErrorWithCode(83);
    this[kAppendHeader](name, value);
  }
  [kAppendHeader](name, value) {
    if (name = StringPrototypeToLowerCase.@call(StringPrototypeTrim.@call(name)), assertValidHeader(name, value), !isConnectionHeaderAllowed(name, value))
      return;
    if (name[0] === ":")
      assertValidPseudoHeader(name);
    else if (!checkIsHttpToken(name))
      this.destroy(@makeErrorWithCode(127, "Header name", name));
    let headers = this[kHeaders];
    if (headers === null || !headers[name])
      return this.setHeader(name, value);
    if (!ArrayIsArray(headers[name]))
      headers[name] = [headers[name]];
    let existingValues = headers[name];
    if (ArrayIsArray(value))
      for (let i = 0, length = value.length;i < length; i++)
        existingValues.push(value[i]);
    else
      existingValues.push(value);
  }
  get statusMessage() {
    return statusMessageWarn(), "";
  }
  set statusMessage(msg) {
    statusMessageWarn();
  }
  flushHeaders() {
    let state = this[kState];
    if (!state.closed && !this[kStream].headersSent)
      this.writeHead(state.statusCode);
  }
  writeHead(statusCode, statusMessage, headers) {
    let state = this[kState];
    if (state.closed || this.stream.destroyed)
      return this;
    if (this[kStream].headersSent)
      throw @makeErrorWithCode(83);
    if (typeof statusMessage === "string")
      statusMessageWarn();
    if (headers === @undefined && typeof statusMessage === "object")
      headers = statusMessage;
    let i;
    if (ArrayIsArray(headers)) {
      if (this[kHeaders])
        if (headers.length && ArrayIsArray(headers[0]))
          for (let n = 0;n < headers.length; n += 1) {
            let key = headers[n + 0][0];
            this.removeHeader(key);
          }
        else
          for (let n = 0;n < headers.length; n += 2) {
            let key = headers[n + 0];
            this.removeHeader(key);
          }
      if (headers.length && ArrayIsArray(headers[0]))
        for (i = 0;i < headers.length; i++) {
          let header = headers[i];
          this[kAppendHeader](header[0], header[1]);
        }
      else {
        if (headers.length % 2 !== 0)
          throw @makeErrorWithCode(119, "headers", headers);
        for (i = 0;i < headers.length; i += 2)
          this[kAppendHeader](headers[i], headers[i + 1]);
      }
    } else if (typeof headers === "object") {
      let keys = ObjectKeys(headers), key = "";
      for (i = 0;i < keys.length; i++)
        key = keys[i], this[kSetHeader](key, headers[key]);
    }
    return state.statusCode = statusCode, this[kBeginSend](), this;
  }
  cork() {
    this[kStream].cork();
  }
  uncork() {
    this[kStream].uncork();
  }
  write(chunk, encoding, cb) {
    let state = this[kState];
    if (typeof encoding === "function")
      cb = encoding, encoding = "utf8";
    let err;
    if (state.ending)
      err = @makeErrorWithCode(236);
    else if (state.closed)
      err = @makeErrorWithCode(90);
    else if (state.destroyed)
      return !1;
    if (err) {
      if (typeof cb === "function")
        process.nextTick(cb, err);
      return this.destroy(err), !1;
    }
    let stream = this[kStream];
    if (!stream.headersSent)
      this.writeHead(state.statusCode);
    return stream.write(chunk, encoding, cb);
  }
  end(chunk, encoding, cb) {
    let stream = this[kStream], state = this[kState];
    if (typeof chunk === "function")
      cb = chunk, chunk = null;
    else if (typeof encoding === "function")
      cb = encoding, encoding = "utf8";
    if ((state.closed || state.ending) && state.headRequest === stream.headRequest) {
      if (typeof cb === "function")
        process.nextTick(cb);
      return this;
    }
    if (chunk !== null && chunk !== @undefined)
      this.write(chunk, encoding);
    if (state.headRequest = stream.headRequest, state.ending = !0, typeof cb === "function")
      if (stream.writableEnded)
        this.once("finish", cb);
      else
        stream.once("finish", cb);
    if (!stream.headersSent)
      this.writeHead(this[kState].statusCode);
    if (this[kState].closed || stream.destroyed)
      onStreamCloseResponse.@call(stream);
    else
      stream.end();
    return this;
  }
  destroy(err) {
    if (this[kState].destroyed)
      return;
    this[kState].destroyed = !0, this[kStream].destroy(err);
  }
  setTimeout(msecs, callback) {
    if (this[kState].closed)
      return;
    this[kStream].setTimeout(msecs, callback);
  }
  createPushResponse(headers, callback) {
    if (validateFunction(callback, "callback"), this[kState].closed) {
      let error = @makeErrorWithCode(90);
      process.nextTick(callback, error);
      return;
    }
    this[kStream].pushStream(headers, {}, (err, stream, headers2, options) => {
      if (err) {
        callback(err);
        return;
      }
      callback(null, new Http2ServerResponse(stream));
    });
  }
  [kBeginSend]() {
    let state = this[kState], headers = this[kHeaders];
    headers[HTTP2_HEADER_STATUS] = state.statusCode;
    let options = {
      endStream: state.ending,
      waitForTrailers: !0,
      sendDate: state.sendDate
    };
    this[kStream].respond(headers, options);
  }
  writeContinue() {
    let stream = this[kStream];
    if (stream.headersSent || this[kState].closed)
      return !1;
    return stream.additionalHeaders({
      [HTTP2_HEADER_STATUS]: HTTP_STATUS_CONTINUE
    }), !0;
  }
  writeEarlyHints(hints) {
    validateObject(hints, "hints");
    let headers = Object.create(null), linkHeaderValue = validateLinkHeaderValue(hints.link);
    for (let key of ObjectKeys(hints))
      if (key !== "link")
        headers[key] = hints[key];
    if (linkHeaderValue.length === 0)
      return !1;
    let stream = this[kStream];
    if (stream.headersSent || this[kState].closed)
      return !1;
    return stream.additionalHeaders({
      ...headers,
      [HTTP2_HEADER_STATUS]: HTTP_STATUS_EARLY_HINTS,
      Link: linkHeaderValue
    }), !0;
  }
}
function onServerStream(Http2ServerRequest2, Http2ServerResponse2, stream, headers, flags, rawHeaders) {
  let server = this, request = new Http2ServerRequest2(stream, headers, @undefined, rawHeaders), response = new Http2ServerResponse2(stream);
  if (headers[HTTP2_HEADER_METHOD] === "CONNECT") {
    if (!server.emit("connect", request, response))
      response.statusCode = HTTP_STATUS_METHOD_NOT_ALLOWED, response.end();
    return;
  }
  if (headers.expect !== @undefined) {
    if (headers.expect === "100-continue")
      if (server.listenerCount("checkContinue"))
        server.emit("checkContinue", request, response);
      else
        response.writeContinue(), server.emit("request", request, response);
    else if (server.listenerCount("checkExpectation"))
      server.emit("checkExpectation", request, response);
    else
      response.statusCode = HTTP_STATUS_EXPECTATION_FAILED, response.end();
    return;
  }
  server.emit("request", request, response);
}
var proxyCompatSocketHandler = {
  has(stream, prop) {
    let ref = stream.session !== @undefined ? stream.session[bunHTTP2Socket] : stream;
    return prop in stream || prop in ref;
  },
  get(stream, prop) {
    switch (prop) {
      case "on":
      case "once":
      case "end":
      case "emit":
      case "destroy":
        return stream[prop].bind(stream);
      case "writable":
      case "destroyed":
        return stream[prop];
      case "readable": {
        if (stream.destroyed)
          return !1;
        let request = stream[kRequest];
        return request ? request.readable : stream.readable;
      }
      case "setTimeout": {
        let session = stream.session;
        if (session !== @undefined)
          return session.setTimeout.bind(session);
        return stream.setTimeout.bind(stream);
      }
      case "write":
      case "read":
      case "pause":
      case "resume":
        throw @makeErrorWithCode(92);
      default: {
        let ref = stream.session !== @undefined ? stream.session[bunHTTP2Socket] : stream, value = ref[prop];
        return typeof value === "function" ? value.bind(ref) : value;
      }
    }
  },
  getPrototypeOf(stream) {
    if (stream.session !== @undefined)
      return ReflectGetPrototypeOf(stream.session[bunHTTP2Socket]);
    return ReflectGetPrototypeOf(stream);
  },
  set(stream, prop, value) {
    switch (prop) {
      case "writable":
      case "readable":
      case "destroyed":
      case "on":
      case "once":
      case "end":
      case "emit":
      case "destroy":
        return stream[prop] = value, !0;
      case "setTimeout": {
        let session = stream.session;
        if (session !== @undefined)
          session.setTimeout = value;
        else
          stream.setTimeout = value;
        return !0;
      }
      case "write":
      case "read":
      case "pause":
      case "resume":
        throw @makeErrorWithCode(92);
      default: {
        let ref = stream.session !== @undefined ? stream.session[bunHTTP2Socket] : stream;
        return ref[prop] = value, !0;
      }
    }
  }
}, proxySocketHandler = {
  get(session, prop) {
    switch (prop) {
      case "setTimeout":
      case "ref":
      case "unref":
        return FunctionPrototypeBind.@call(session[prop], session);
      case "destroy":
      case "emit":
      case "end":
      case "pause":
      case "read":
      case "resume":
      case "write":
      case "setEncoding":
      case "setKeepAlive":
      case "setNoDelay":
        throw @makeErrorWithCode(92);
      default: {
        let socket = session[bunHTTP2Socket];
        if (!socket)
          throw @makeErrorWithCode(103);
        let value = socket[prop];
        return typeof value === "function" ? FunctionPrototypeBind.@call(value, socket) : value;
      }
    }
  },
  getPrototypeOf(session) {
    let socket = session[bunHTTP2Socket];
    if (!socket)
      throw @makeErrorWithCode(103);
    return ReflectGetPrototypeOf(socket);
  },
  set(session, prop, value) {
    switch (prop) {
      case "setTimeout":
      case "ref":
      case "unref":
        return session[prop] = value, !0;
      case "destroy":
      case "emit":
      case "end":
      case "pause":
      case "read":
      case "resume":
      case "write":
      case "setEncoding":
      case "setKeepAlive":
      case "setNoDelay":
        throw @makeErrorWithCode(92);
      default: {
        let socket = session[bunHTTP2Socket];
        if (!socket)
          throw @makeErrorWithCode(103);
        return socket[prop] = value, !0;
      }
    }
  }
}, nameForErrorCode = [
  "NGHTTP2_NO_ERROR",
  "NGHTTP2_PROTOCOL_ERROR",
  "NGHTTP2_INTERNAL_ERROR",
  "NGHTTP2_FLOW_CONTROL_ERROR",
  "NGHTTP2_SETTINGS_TIMEOUT",
  "NGHTTP2_STREAM_CLOSED",
  "NGHTTP2_FRAME_SIZE_ERROR",
  "NGHTTP2_REFUSED_STREAM",
  "NGHTTP2_CANCEL",
  "NGHTTP2_COMPRESSION_ERROR",
  "NGHTTP2_CONNECT_ERROR",
  "NGHTTP2_ENHANCE_YOUR_CALM",
  "NGHTTP2_INADEQUATE_SECURITY",
  "NGHTTP2_HTTP_1_1_REQUIRED"
], constants = {
  NGHTTP2_ERR_FRAME_SIZE_ERROR: -522,
  NGHTTP2_SESSION_SERVER: 0,
  NGHTTP2_SESSION_CLIENT: 1,
  NGHTTP2_STREAM_STATE_IDLE: 1,
  NGHTTP2_STREAM_STATE_OPEN: 2,
  NGHTTP2_STREAM_STATE_RESERVED_LOCAL: 3,
  NGHTTP2_STREAM_STATE_RESERVED_REMOTE: 4,
  NGHTTP2_STREAM_STATE_HALF_CLOSED_LOCAL: 5,
  NGHTTP2_STREAM_STATE_HALF_CLOSED_REMOTE: 6,
  NGHTTP2_STREAM_STATE_CLOSED: 7,
  NGHTTP2_FLAG_NONE: 0,
  NGHTTP2_FLAG_END_STREAM: 1,
  NGHTTP2_FLAG_END_HEADERS: 4,
  NGHTTP2_FLAG_ACK: 1,
  NGHTTP2_FLAG_PADDED: 8,
  NGHTTP2_FLAG_PRIORITY: 32,
  DEFAULT_SETTINGS_HEADER_TABLE_SIZE: 4096,
  DEFAULT_SETTINGS_ENABLE_PUSH: 1,
  DEFAULT_SETTINGS_MAX_CONCURRENT_STREAMS: 4294967295,
  DEFAULT_SETTINGS_INITIAL_WINDOW_SIZE: 65535,
  DEFAULT_SETTINGS_MAX_FRAME_SIZE: 16384,
  DEFAULT_SETTINGS_MAX_HEADER_LIST_SIZE: 65535,
  DEFAULT_SETTINGS_ENABLE_CONNECT_PROTOCOL: 0,
  MAX_MAX_FRAME_SIZE: 16777215,
  MIN_MAX_FRAME_SIZE: 16384,
  MAX_INITIAL_WINDOW_SIZE: 2147483647,
  NGHTTP2_SETTINGS_HEADER_TABLE_SIZE: 1,
  NGHTTP2_SETTINGS_ENABLE_PUSH: 2,
  NGHTTP2_SETTINGS_MAX_CONCURRENT_STREAMS: 3,
  NGHTTP2_SETTINGS_INITIAL_WINDOW_SIZE: 4,
  NGHTTP2_SETTINGS_MAX_FRAME_SIZE: 5,
  NGHTTP2_SETTINGS_MAX_HEADER_LIST_SIZE: 6,
  NGHTTP2_SETTINGS_ENABLE_CONNECT_PROTOCOL: 8,
  PADDING_STRATEGY_NONE: 0,
  PADDING_STRATEGY_ALIGNED: 1,
  PADDING_STRATEGY_MAX: 2,
  PADDING_STRATEGY_CALLBACK: 1,
  NGHTTP2_NO_ERROR: 0,
  NGHTTP2_PROTOCOL_ERROR: 1,
  NGHTTP2_INTERNAL_ERROR: 2,
  NGHTTP2_FLOW_CONTROL_ERROR: 3,
  NGHTTP2_SETTINGS_TIMEOUT: 4,
  NGHTTP2_STREAM_CLOSED: 5,
  NGHTTP2_FRAME_SIZE_ERROR: 6,
  NGHTTP2_REFUSED_STREAM: 7,
  NGHTTP2_CANCEL: 8,
  NGHTTP2_COMPRESSION_ERROR: 9,
  NGHTTP2_CONNECT_ERROR: 10,
  NGHTTP2_ENHANCE_YOUR_CALM: 11,
  NGHTTP2_INADEQUATE_SECURITY: 12,
  NGHTTP2_HTTP_1_1_REQUIRED: 13,
  NGHTTP2_DEFAULT_WEIGHT: 16,
  HTTP2_HEADER_STATUS: ":status",
  HTTP2_HEADER_METHOD: ":method",
  HTTP2_HEADER_AUTHORITY: ":authority",
  HTTP2_HEADER_SCHEME: ":scheme",
  HTTP2_HEADER_PATH: ":path",
  HTTP2_HEADER_PROTOCOL: ":protocol",
  HTTP2_HEADER_ACCEPT_ENCODING: "accept-encoding",
  HTTP2_HEADER_ACCEPT_LANGUAGE: "accept-language",
  HTTP2_HEADER_ACCEPT_RANGES: "accept-ranges",
  HTTP2_HEADER_ACCEPT: "accept",
  HTTP2_HEADER_ACCESS_CONTROL_ALLOW_CREDENTIALS: "access-control-allow-credentials",
  HTTP2_HEADER_ACCESS_CONTROL_ALLOW_HEADERS: "access-control-allow-headers",
  HTTP2_HEADER_ACCESS_CONTROL_ALLOW_METHODS: "access-control-allow-methods",
  HTTP2_HEADER_ACCESS_CONTROL_ALLOW_ORIGIN: "access-control-allow-origin",
  HTTP2_HEADER_ACCESS_CONTROL_EXPOSE_HEADERS: "access-control-expose-headers",
  HTTP2_HEADER_ACCESS_CONTROL_REQUEST_HEADERS: "access-control-request-headers",
  HTTP2_HEADER_ACCESS_CONTROL_REQUEST_METHOD: "access-control-request-method",
  HTTP2_HEADER_AGE: "age",
  HTTP2_HEADER_AUTHORIZATION: "authorization",
  HTTP2_HEADER_CACHE_CONTROL: "cache-control",
  HTTP2_HEADER_CONNECTION: "connection",
  HTTP2_HEADER_CONTENT_DISPOSITION: "content-disposition",
  HTTP2_HEADER_CONTENT_ENCODING: "content-encoding",
  HTTP2_HEADER_CONTENT_LENGTH: "content-length",
  HTTP2_HEADER_CONTENT_TYPE: "content-type",
  HTTP2_HEADER_COOKIE: "cookie",
  HTTP2_HEADER_DATE: "date",
  HTTP2_HEADER_ETAG: "etag",
  HTTP2_HEADER_FORWARDED: "forwarded",
  HTTP2_HEADER_HOST: "host",
  HTTP2_HEADER_IF_MODIFIED_SINCE: "if-modified-since",
  HTTP2_HEADER_IF_NONE_MATCH: "if-none-match",
  HTTP2_HEADER_IF_RANGE: "if-range",
  HTTP2_HEADER_LAST_MODIFIED: "last-modified",
  HTTP2_HEADER_LINK: "link",
  HTTP2_HEADER_LOCATION: "location",
  HTTP2_HEADER_RANGE: "range",
  HTTP2_HEADER_REFERER: "referer",
  HTTP2_HEADER_SERVER: "server",
  HTTP2_HEADER_SET_COOKIE: "set-cookie",
  HTTP2_HEADER_STRICT_TRANSPORT_SECURITY: "strict-transport-security",
  HTTP2_HEADER_TRANSFER_ENCODING: "transfer-encoding",
  HTTP2_HEADER_TE: "te",
  HTTP2_HEADER_UPGRADE_INSECURE_REQUESTS: "upgrade-insecure-requests",
  HTTP2_HEADER_UPGRADE: "upgrade",
  HTTP2_HEADER_USER_AGENT: "user-agent",
  HTTP2_HEADER_VARY: "vary",
  HTTP2_HEADER_X_CONTENT_TYPE_OPTIONS: "x-content-type-options",
  HTTP2_HEADER_X_FRAME_OPTIONS: "x-frame-options",
  HTTP2_HEADER_KEEP_ALIVE: "keep-alive",
  HTTP2_HEADER_PROXY_CONNECTION: "proxy-connection",
  HTTP2_HEADER_X_XSS_PROTECTION: "x-xss-protection",
  HTTP2_HEADER_ALT_SVC: "alt-svc",
  HTTP2_HEADER_CONTENT_SECURITY_POLICY: "content-security-policy",
  HTTP2_HEADER_EARLY_DATA: "early-data",
  HTTP2_HEADER_EXPECT_CT: "expect-ct",
  HTTP2_HEADER_ORIGIN: "origin",
  HTTP2_HEADER_PURPOSE: "purpose",
  HTTP2_HEADER_TIMING_ALLOW_ORIGIN: "timing-allow-origin",
  HTTP2_HEADER_X_FORWARDED_FOR: "x-forwarded-for",
  HTTP2_HEADER_PRIORITY: "priority",
  HTTP2_HEADER_ACCEPT_CHARSET: "accept-charset",
  HTTP2_HEADER_ACCESS_CONTROL_MAX_AGE: "access-control-max-age",
  HTTP2_HEADER_ALLOW: "allow",
  HTTP2_HEADER_CONTENT_LANGUAGE: "content-language",
  HTTP2_HEADER_CONTENT_LOCATION: "content-location",
  HTTP2_HEADER_CONTENT_MD5: "content-md5",
  HTTP2_HEADER_CONTENT_RANGE: "content-range",
  HTTP2_HEADER_DNT: "dnt",
  HTTP2_HEADER_EXPECT: "expect",
  HTTP2_HEADER_EXPIRES: "expires",
  HTTP2_HEADER_FROM: "from",
  HTTP2_HEADER_IF_MATCH: "if-match",
  HTTP2_HEADER_IF_UNMODIFIED_SINCE: "if-unmodified-since",
  HTTP2_HEADER_MAX_FORWARDS: "max-forwards",
  HTTP2_HEADER_PREFER: "prefer",
  HTTP2_HEADER_PROXY_AUTHENTICATE: "proxy-authenticate",
  HTTP2_HEADER_PROXY_AUTHORIZATION: "proxy-authorization",
  HTTP2_HEADER_REFRESH: "refresh",
  HTTP2_HEADER_RETRY_AFTER: "retry-after",
  HTTP2_HEADER_TRAILER: "trailer",
  HTTP2_HEADER_TK: "tk",
  HTTP2_HEADER_VIA: "via",
  HTTP2_HEADER_WARNING: "warning",
  HTTP2_HEADER_WWW_AUTHENTICATE: "www-authenticate",
  HTTP2_HEADER_HTTP2_SETTINGS: "http2-settings",
  HTTP2_METHOD_ACL: "ACL",
  HTTP2_METHOD_BASELINE_CONTROL: "BASELINE-CONTROL",
  HTTP2_METHOD_BIND: "BIND",
  HTTP2_METHOD_CHECKIN: "CHECKIN",
  HTTP2_METHOD_CHECKOUT: "CHECKOUT",
  HTTP2_METHOD_CONNECT: "CONNECT",
  HTTP2_METHOD_COPY: "COPY",
  HTTP2_METHOD_DELETE: "DELETE",
  HTTP2_METHOD_GET: "GET",
  HTTP2_METHOD_HEAD: "HEAD",
  HTTP2_METHOD_LABEL: "LABEL",
  HTTP2_METHOD_LINK: "LINK",
  HTTP2_METHOD_LOCK: "LOCK",
  HTTP2_METHOD_MERGE: "MERGE",
  HTTP2_METHOD_MKACTIVITY: "MKACTIVITY",
  HTTP2_METHOD_MKCALENDAR: "MKCALENDAR",
  HTTP2_METHOD_MKCOL: "MKCOL",
  HTTP2_METHOD_MKREDIRECTREF: "MKREDIRECTREF",
  HTTP2_METHOD_MKWORKSPACE: "MKWORKSPACE",
  HTTP2_METHOD_MOVE: "MOVE",
  HTTP2_METHOD_OPTIONS: "OPTIONS",
  HTTP2_METHOD_ORDERPATCH: "ORDERPATCH",
  HTTP2_METHOD_PATCH: "PATCH",
  HTTP2_METHOD_POST: "POST",
  HTTP2_METHOD_PRI: "PRI",
  HTTP2_METHOD_PROPFIND: "PROPFIND",
  HTTP2_METHOD_PROPPATCH: "PROPPATCH",
  HTTP2_METHOD_PUT: "PUT",
  HTTP2_METHOD_REBIND: "REBIND",
  HTTP2_METHOD_REPORT: "REPORT",
  HTTP2_METHOD_SEARCH: "SEARCH",
  HTTP2_METHOD_TRACE: "TRACE",
  HTTP2_METHOD_UNBIND: "UNBIND",
  HTTP2_METHOD_UNCHECKOUT: "UNCHECKOUT",
  HTTP2_METHOD_UNLINK: "UNLINK",
  HTTP2_METHOD_UNLOCK: "UNLOCK",
  HTTP2_METHOD_UPDATE: "UPDATE",
  HTTP2_METHOD_UPDATEREDIRECTREF: "UPDATEREDIRECTREF",
  HTTP2_METHOD_VERSION_CONTROL: "VERSION-CONTROL",
  HTTP_STATUS_CONTINUE: 100,
  HTTP_STATUS_SWITCHING_PROTOCOLS: 101,
  HTTP_STATUS_PROCESSING: 102,
  HTTP_STATUS_EARLY_HINTS: 103,
  HTTP_STATUS_OK: 200,
  HTTP_STATUS_CREATED: 201,
  HTTP_STATUS_ACCEPTED: 202,
  HTTP_STATUS_NON_AUTHORITATIVE_INFORMATION: 203,
  HTTP_STATUS_NO_CONTENT: 204,
  HTTP_STATUS_RESET_CONTENT: 205,
  HTTP_STATUS_PARTIAL_CONTENT: 206,
  HTTP_STATUS_MULTI_STATUS: 207,
  HTTP_STATUS_ALREADY_REPORTED: 208,
  HTTP_STATUS_IM_USED: 226,
  HTTP_STATUS_MULTIPLE_CHOICES: 300,
  HTTP_STATUS_MOVED_PERMANENTLY: 301,
  HTTP_STATUS_FOUND: 302,
  HTTP_STATUS_SEE_OTHER: 303,
  HTTP_STATUS_NOT_MODIFIED: 304,
  HTTP_STATUS_USE_PROXY: 305,
  HTTP_STATUS_TEMPORARY_REDIRECT: 307,
  HTTP_STATUS_PERMANENT_REDIRECT: 308,
  HTTP_STATUS_BAD_REQUEST: 400,
  HTTP_STATUS_UNAUTHORIZED: 401,
  HTTP_STATUS_PAYMENT_REQUIRED: 402,
  HTTP_STATUS_FORBIDDEN: 403,
  HTTP_STATUS_NOT_FOUND: 404,
  HTTP_STATUS_METHOD_NOT_ALLOWED: 405,
  HTTP_STATUS_NOT_ACCEPTABLE: 406,
  HTTP_STATUS_PROXY_AUTHENTICATION_REQUIRED: 407,
  HTTP_STATUS_REQUEST_TIMEOUT: 408,
  HTTP_STATUS_CONFLICT: 409,
  HTTP_STATUS_GONE: 410,
  HTTP_STATUS_LENGTH_REQUIRED: 411,
  HTTP_STATUS_PRECONDITION_FAILED: 412,
  HTTP_STATUS_PAYLOAD_TOO_LARGE: 413,
  HTTP_STATUS_URI_TOO_LONG: 414,
  HTTP_STATUS_UNSUPPORTED_MEDIA_TYPE: 415,
  HTTP_STATUS_RANGE_NOT_SATISFIABLE: 416,
  HTTP_STATUS_EXPECTATION_FAILED: 417,
  HTTP_STATUS_TEAPOT: 418,
  HTTP_STATUS_MISDIRECTED_REQUEST: 421,
  HTTP_STATUS_UNPROCESSABLE_ENTITY: 422,
  HTTP_STATUS_LOCKED: 423,
  HTTP_STATUS_FAILED_DEPENDENCY: 424,
  HTTP_STATUS_TOO_EARLY: 425,
  HTTP_STATUS_UPGRADE_REQUIRED: 426,
  HTTP_STATUS_PRECONDITION_REQUIRED: 428,
  HTTP_STATUS_TOO_MANY_REQUESTS: 429,
  HTTP_STATUS_REQUEST_HEADER_FIELDS_TOO_LARGE: 431,
  HTTP_STATUS_UNAVAILABLE_FOR_LEGAL_REASONS: 451,
  HTTP_STATUS_INTERNAL_SERVER_ERROR: 500,
  HTTP_STATUS_NOT_IMPLEMENTED: 501,
  HTTP_STATUS_BAD_GATEWAY: 502,
  HTTP_STATUS_SERVICE_UNAVAILABLE: 503,
  HTTP_STATUS_GATEWAY_TIMEOUT: 504,
  HTTP_STATUS_HTTP_VERSION_NOT_SUPPORTED: 505,
  HTTP_STATUS_VARIANT_ALSO_NEGOTIATES: 506,
  HTTP_STATUS_INSUFFICIENT_STORAGE: 507,
  HTTP_STATUS_LOOP_DETECTED: 508,
  HTTP_STATUS_BANDWIDTH_LIMIT_EXCEEDED: 509,
  HTTP_STATUS_NOT_EXTENDED: 510,
  HTTP_STATUS_NETWORK_AUTHENTICATION_REQUIRED: 511
}, {
  NGHTTP2_ERR_FRAME_SIZE_ERROR,
  NGHTTP2_SESSION_SERVER,
  NGHTTP2_SESSION_CLIENT,
  NGHTTP2_STREAM_STATE_IDLE,
  NGHTTP2_STREAM_STATE_OPEN,
  NGHTTP2_STREAM_STATE_RESERVED_LOCAL,
  NGHTTP2_STREAM_STATE_RESERVED_REMOTE,
  NGHTTP2_STREAM_STATE_HALF_CLOSED_LOCAL,
  NGHTTP2_STREAM_STATE_HALF_CLOSED_REMOTE,
  NGHTTP2_STREAM_STATE_CLOSED,
  NGHTTP2_FLAG_NONE,
  NGHTTP2_FLAG_END_STREAM,
  NGHTTP2_FLAG_END_HEADERS,
  NGHTTP2_FLAG_ACK,
  NGHTTP2_FLAG_PADDED,
  NGHTTP2_FLAG_PRIORITY,
  DEFAULT_SETTINGS_HEADER_TABLE_SIZE,
  DEFAULT_SETTINGS_ENABLE_PUSH,
  DEFAULT_SETTINGS_MAX_CONCURRENT_STREAMS,
  DEFAULT_SETTINGS_INITIAL_WINDOW_SIZE,
  DEFAULT_SETTINGS_MAX_FRAME_SIZE,
  DEFAULT_SETTINGS_MAX_HEADER_LIST_SIZE,
  DEFAULT_SETTINGS_ENABLE_CONNECT_PROTOCOL,
  MAX_MAX_FRAME_SIZE,
  MIN_MAX_FRAME_SIZE,
  MAX_INITIAL_WINDOW_SIZE,
  NGHTTP2_SETTINGS_HEADER_TABLE_SIZE,
  NGHTTP2_SETTINGS_ENABLE_PUSH,
  NGHTTP2_SETTINGS_MAX_CONCURRENT_STREAMS,
  NGHTTP2_SETTINGS_INITIAL_WINDOW_SIZE,
  NGHTTP2_SETTINGS_MAX_FRAME_SIZE,
  NGHTTP2_SETTINGS_MAX_HEADER_LIST_SIZE,
  NGHTTP2_SETTINGS_ENABLE_CONNECT_PROTOCOL,
  PADDING_STRATEGY_NONE,
  PADDING_STRATEGY_ALIGNED,
  PADDING_STRATEGY_MAX,
  PADDING_STRATEGY_CALLBACK,
  NGHTTP2_NO_ERROR,
  NGHTTP2_PROTOCOL_ERROR,
  NGHTTP2_INTERNAL_ERROR,
  NGHTTP2_FLOW_CONTROL_ERROR,
  NGHTTP2_SETTINGS_TIMEOUT,
  NGHTTP2_STREAM_CLOSED,
  NGHTTP2_FRAME_SIZE_ERROR,
  NGHTTP2_REFUSED_STREAM,
  NGHTTP2_CANCEL,
  NGHTTP2_COMPRESSION_ERROR,
  NGHTTP2_CONNECT_ERROR,
  NGHTTP2_ENHANCE_YOUR_CALM,
  NGHTTP2_INADEQUATE_SECURITY,
  NGHTTP2_HTTP_1_1_REQUIRED,
  NGHTTP2_DEFAULT_WEIGHT,
  HTTP2_HEADER_STATUS,
  HTTP2_HEADER_METHOD,
  HTTP2_HEADER_AUTHORITY,
  HTTP2_HEADER_SCHEME,
  HTTP2_HEADER_PATH,
  HTTP2_HEADER_PROTOCOL,
  HTTP2_HEADER_ACCEPT_ENCODING,
  HTTP2_HEADER_ACCEPT_LANGUAGE,
  HTTP2_HEADER_ACCEPT_RANGES,
  HTTP2_HEADER_ACCEPT,
  HTTP2_HEADER_ACCESS_CONTROL_ALLOW_CREDENTIALS,
  HTTP2_HEADER_ACCESS_CONTROL_ALLOW_HEADERS,
  HTTP2_HEADER_ACCESS_CONTROL_ALLOW_METHODS,
  HTTP2_HEADER_ACCESS_CONTROL_ALLOW_ORIGIN,
  HTTP2_HEADER_ACCESS_CONTROL_EXPOSE_HEADERS,
  HTTP2_HEADER_ACCESS_CONTROL_REQUEST_HEADERS,
  HTTP2_HEADER_ACCESS_CONTROL_REQUEST_METHOD,
  HTTP2_HEADER_AGE,
  HTTP2_HEADER_AUTHORIZATION,
  HTTP2_HEADER_CACHE_CONTROL,
  HTTP2_HEADER_CONNECTION,
  HTTP2_HEADER_CONTENT_DISPOSITION,
  HTTP2_HEADER_CONTENT_ENCODING,
  HTTP2_HEADER_CONTENT_LENGTH,
  HTTP2_HEADER_CONTENT_TYPE,
  HTTP2_HEADER_COOKIE,
  HTTP2_HEADER_DATE,
  HTTP2_HEADER_ETAG,
  HTTP2_HEADER_FORWARDED,
  HTTP2_HEADER_HOST,
  HTTP2_HEADER_IF_MODIFIED_SINCE,
  HTTP2_HEADER_IF_NONE_MATCH,
  HTTP2_HEADER_IF_RANGE,
  HTTP2_HEADER_LAST_MODIFIED,
  HTTP2_HEADER_LINK,
  HTTP2_HEADER_LOCATION,
  HTTP2_HEADER_RANGE,
  HTTP2_HEADER_REFERER,
  HTTP2_HEADER_SERVER,
  HTTP2_HEADER_SET_COOKIE,
  HTTP2_HEADER_STRICT_TRANSPORT_SECURITY,
  HTTP2_HEADER_TRANSFER_ENCODING,
  HTTP2_HEADER_TE,
  HTTP2_HEADER_UPGRADE_INSECURE_REQUESTS,
  HTTP2_HEADER_UPGRADE,
  HTTP2_HEADER_USER_AGENT,
  HTTP2_HEADER_VARY,
  HTTP2_HEADER_X_CONTENT_TYPE_OPTIONS,
  HTTP2_HEADER_X_FRAME_OPTIONS,
  HTTP2_HEADER_KEEP_ALIVE,
  HTTP2_HEADER_PROXY_CONNECTION,
  HTTP2_HEADER_X_XSS_PROTECTION,
  HTTP2_HEADER_ALT_SVC,
  HTTP2_HEADER_CONTENT_SECURITY_POLICY,
  HTTP2_HEADER_EARLY_DATA,
  HTTP2_HEADER_EXPECT_CT,
  HTTP2_HEADER_ORIGIN,
  HTTP2_HEADER_PURPOSE,
  HTTP2_HEADER_TIMING_ALLOW_ORIGIN,
  HTTP2_HEADER_X_FORWARDED_FOR,
  HTTP2_HEADER_PRIORITY,
  HTTP2_HEADER_ACCEPT_CHARSET,
  HTTP2_HEADER_ACCESS_CONTROL_MAX_AGE,
  HTTP2_HEADER_ALLOW,
  HTTP2_HEADER_CONTENT_LANGUAGE,
  HTTP2_HEADER_CONTENT_LOCATION,
  HTTP2_HEADER_CONTENT_MD5,
  HTTP2_HEADER_CONTENT_RANGE,
  HTTP2_HEADER_DNT,
  HTTP2_HEADER_EXPECT,
  HTTP2_HEADER_EXPIRES,
  HTTP2_HEADER_FROM,
  HTTP2_HEADER_IF_MATCH,
  HTTP2_HEADER_IF_UNMODIFIED_SINCE,
  HTTP2_HEADER_MAX_FORWARDS,
  HTTP2_HEADER_PREFER,
  HTTP2_HEADER_PROXY_AUTHENTICATE,
  HTTP2_HEADER_PROXY_AUTHORIZATION,
  HTTP2_HEADER_REFRESH,
  HTTP2_HEADER_RETRY_AFTER,
  HTTP2_HEADER_TRAILER,
  HTTP2_HEADER_TK,
  HTTP2_HEADER_VIA,
  HTTP2_HEADER_WARNING,
  HTTP2_HEADER_WWW_AUTHENTICATE,
  HTTP2_HEADER_HTTP2_SETTINGS,
  HTTP2_METHOD_ACL,
  HTTP2_METHOD_BASELINE_CONTROL,
  HTTP2_METHOD_BIND,
  HTTP2_METHOD_CHECKIN,
  HTTP2_METHOD_CHECKOUT,
  HTTP2_METHOD_CONNECT,
  HTTP2_METHOD_COPY,
  HTTP2_METHOD_DELETE,
  HTTP2_METHOD_GET,
  HTTP2_METHOD_HEAD,
  HTTP2_METHOD_LABEL,
  HTTP2_METHOD_LINK,
  HTTP2_METHOD_LOCK,
  HTTP2_METHOD_MERGE,
  HTTP2_METHOD_MKACTIVITY,
  HTTP2_METHOD_MKCALENDAR,
  HTTP2_METHOD_MKCOL,
  HTTP2_METHOD_MKREDIRECTREF,
  HTTP2_METHOD_MKWORKSPACE,
  HTTP2_METHOD_MOVE,
  HTTP2_METHOD_OPTIONS,
  HTTP2_METHOD_ORDERPATCH,
  HTTP2_METHOD_PATCH,
  HTTP2_METHOD_POST,
  HTTP2_METHOD_PRI,
  HTTP2_METHOD_PROPFIND,
  HTTP2_METHOD_PROPPATCH,
  HTTP2_METHOD_PUT,
  HTTP2_METHOD_REBIND,
  HTTP2_METHOD_REPORT,
  HTTP2_METHOD_SEARCH,
  HTTP2_METHOD_TRACE,
  HTTP2_METHOD_UNBIND,
  HTTP2_METHOD_UNCHECKOUT,
  HTTP2_METHOD_UNLINK,
  HTTP2_METHOD_UNLOCK,
  HTTP2_METHOD_UPDATE,
  HTTP2_METHOD_UPDATEREDIRECTREF,
  HTTP2_METHOD_VERSION_CONTROL,
  HTTP_STATUS_CONTINUE,
  HTTP_STATUS_SWITCHING_PROTOCOLS,
  HTTP_STATUS_PROCESSING,
  HTTP_STATUS_EARLY_HINTS,
  HTTP_STATUS_OK,
  HTTP_STATUS_CREATED,
  HTTP_STATUS_ACCEPTED,
  HTTP_STATUS_NON_AUTHORITATIVE_INFORMATION,
  HTTP_STATUS_NO_CONTENT,
  HTTP_STATUS_RESET_CONTENT,
  HTTP_STATUS_PARTIAL_CONTENT,
  HTTP_STATUS_MULTI_STATUS,
  HTTP_STATUS_ALREADY_REPORTED,
  HTTP_STATUS_IM_USED,
  HTTP_STATUS_MULTIPLE_CHOICES,
  HTTP_STATUS_MOVED_PERMANENTLY,
  HTTP_STATUS_FOUND,
  HTTP_STATUS_SEE_OTHER,
  HTTP_STATUS_NOT_MODIFIED,
  HTTP_STATUS_USE_PROXY,
  HTTP_STATUS_TEMPORARY_REDIRECT,
  HTTP_STATUS_PERMANENT_REDIRECT,
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_UNAUTHORIZED,
  HTTP_STATUS_PAYMENT_REQUIRED,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_METHOD_NOT_ALLOWED,
  HTTP_STATUS_NOT_ACCEPTABLE,
  HTTP_STATUS_PROXY_AUTHENTICATION_REQUIRED,
  HTTP_STATUS_REQUEST_TIMEOUT,
  HTTP_STATUS_CONFLICT,
  HTTP_STATUS_GONE,
  HTTP_STATUS_LENGTH_REQUIRED,
  HTTP_STATUS_PRECONDITION_FAILED,
  HTTP_STATUS_PAYLOAD_TOO_LARGE,
  HTTP_STATUS_URI_TOO_LONG,
  HTTP_STATUS_UNSUPPORTED_MEDIA_TYPE,
  HTTP_STATUS_RANGE_NOT_SATISFIABLE,
  HTTP_STATUS_EXPECTATION_FAILED,
  HTTP_STATUS_TEAPOT,
  HTTP_STATUS_MISDIRECTED_REQUEST,
  HTTP_STATUS_UNPROCESSABLE_ENTITY,
  HTTP_STATUS_LOCKED,
  HTTP_STATUS_FAILED_DEPENDENCY,
  HTTP_STATUS_TOO_EARLY,
  HTTP_STATUS_UPGRADE_REQUIRED,
  HTTP_STATUS_PRECONDITION_REQUIRED,
  HTTP_STATUS_TOO_MANY_REQUESTS,
  HTTP_STATUS_REQUEST_HEADER_FIELDS_TOO_LARGE,
  HTTP_STATUS_UNAVAILABLE_FOR_LEGAL_REASONS,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_NOT_IMPLEMENTED,
  HTTP_STATUS_BAD_GATEWAY,
  HTTP_STATUS_SERVICE_UNAVAILABLE,
  HTTP_STATUS_GATEWAY_TIMEOUT,
  HTTP_STATUS_HTTP_VERSION_NOT_SUPPORTED,
  HTTP_STATUS_VARIANT_ALSO_NEGOTIATES,
  HTTP_STATUS_INSUFFICIENT_STORAGE,
  HTTP_STATUS_LOOP_DETECTED,
  HTTP_STATUS_BANDWIDTH_LIMIT_EXCEEDED,
  HTTP_STATUS_NOT_EXTENDED,
  HTTP_STATUS_NETWORK_AUTHENTICATION_REQUIRED
} = constants, kValidPseudoHeaders = new SafeSet([
  HTTP2_HEADER_STATUS,
  HTTP2_HEADER_METHOD,
  HTTP2_HEADER_AUTHORITY,
  HTTP2_HEADER_SCHEME,
  HTTP2_HEADER_PATH,
  HTTP2_HEADER_PROTOCOL
]), kSingleValueHeaders = new SafeSet([
  HTTP2_HEADER_STATUS,
  HTTP2_HEADER_METHOD,
  HTTP2_HEADER_AUTHORITY,
  HTTP2_HEADER_SCHEME,
  HTTP2_HEADER_PATH,
  HTTP2_HEADER_PROTOCOL,
  HTTP2_HEADER_ACCESS_CONTROL_ALLOW_CREDENTIALS,
  HTTP2_HEADER_ACCESS_CONTROL_MAX_AGE,
  HTTP2_HEADER_ACCESS_CONTROL_REQUEST_METHOD,
  HTTP2_HEADER_AGE,
  HTTP2_HEADER_AUTHORIZATION,
  HTTP2_HEADER_CONTENT_ENCODING,
  HTTP2_HEADER_CONTENT_LANGUAGE,
  HTTP2_HEADER_CONTENT_LENGTH,
  HTTP2_HEADER_CONTENT_LOCATION,
  HTTP2_HEADER_CONTENT_MD5,
  HTTP2_HEADER_CONTENT_RANGE,
  HTTP2_HEADER_CONTENT_TYPE,
  HTTP2_HEADER_DATE,
  HTTP2_HEADER_DNT,
  HTTP2_HEADER_ETAG,
  HTTP2_HEADER_EXPIRES,
  HTTP2_HEADER_FROM,
  HTTP2_HEADER_HOST,
  HTTP2_HEADER_IF_MATCH,
  HTTP2_HEADER_IF_MODIFIED_SINCE,
  HTTP2_HEADER_IF_NONE_MATCH,
  HTTP2_HEADER_IF_RANGE,
  HTTP2_HEADER_IF_UNMODIFIED_SINCE,
  HTTP2_HEADER_LAST_MODIFIED,
  HTTP2_HEADER_LOCATION,
  HTTP2_HEADER_MAX_FORWARDS,
  HTTP2_HEADER_PROXY_AUTHORIZATION,
  HTTP2_HEADER_RANGE,
  HTTP2_HEADER_REFERER,
  HTTP2_HEADER_RETRY_AFTER,
  HTTP2_HEADER_TK,
  HTTP2_HEADER_UPGRADE_INSECURE_REQUESTS,
  HTTP2_HEADER_USER_AGENT,
  HTTP2_HEADER_X_CONTENT_TYPE_OPTIONS
]);
function assertValidPseudoHeader(key) {
  if (!kValidPseudoHeaders.has(key))
    throw @makeErrorWithCode(88, key);
}
hideFromStack(assertValidPseudoHeader);
var NoPayloadMethods = /* @__PURE__ */ new Set([HTTP2_METHOD_DELETE, HTTP2_METHOD_GET, HTTP2_METHOD_HEAD]);

class Http2Session extends EventEmitter {
  [bunHTTP2Socket];
  [bunHTTP2OriginSet] = @undefined;
  [EventEmitter.captureRejectionSymbol](err, event, ...args) {
    switch (event) {
      case "stream": {
        args[0].destroy(err);
        break;
      }
      default:
        this.destroy(err);
    }
  }
}
function streamErrorFromCode(code) {
  if (code === 14)
    return @makeErrorWithCode(91);
  return @makeErrorWithCode(106, nameForErrorCode[code] || code);
}
hideFromStack(streamErrorFromCode);
function sessionErrorFromCode(code) {
  if (code === 14)
    return @makeErrorWithCode(91);
  return @makeErrorWithCode(102, nameForErrorCode[code] || code);
}
hideFromStack(sessionErrorFromCode);
function assertSession(session) {
  if (!session)
    throw @makeErrorWithCode(89);
}
hideFromStack(assertSession);
function pushToStream(stream, data) {
  if (data && stream[bunHTTP2StreamStatus] & 8 /* Closed */) {
    if (!stream._readableState.ended)
      stream.resume(), stream.push(null);
    return;
  }
  stream.push(data);
}
function markWritableDone(stream) {
  let _final = stream[bunHTTP2StreamFinal];
  if (typeof _final === "function") {
    stream[bunHTTP2StreamFinal] = null, _final(), stream[bunHTTP2StreamStatus] |= 36;
    return;
  }
  stream[bunHTTP2StreamStatus] |= 32 /* WritableClosed */;
}
function markStreamClosed(stream) {
  let status = stream[bunHTTP2StreamStatus];
  if ((status & 8 /* Closed */) === 0)
    stream[bunHTTP2StreamStatus] = status | 8 /* Closed */, markWritableDone(stream);
}
function rstNextTick(id, rstCode) {
  this[bunHTTP2Native]?.rstStream(id, rstCode);
}

class Http2Stream extends Duplex {
  #id;
  [bunHTTP2Session] = null;
  [bunHTTP2StreamFinal] = null;
  [bunHTTP2StreamStatus] = 0;
  rstCode = @undefined;
  [bunHTTP2Headers];
  [kInfoHeaders];
  #sentTrailers;
  [kAborted] = !1;
  [kHeadRequest] = !1;
  constructor(streamId, session, headers) {
    super({
      decodeStrings: !1,
      autoDestroy: !1
    });
    this.#id = streamId, this[bunHTTP2Session] = session, this[bunHTTP2Headers] = headers;
  }
  get scheme() {
    let headers = this[bunHTTP2Headers];
    if (headers)
      return headers[":scheme"] || "https";
    return "https";
  }
  get id() {
    return this.#id;
  }
  get pending() {
    return !this.#id;
  }
  get bufferSize() {
    let session = this[bunHTTP2Session];
    if (!session)
      return 0;
    return session.bufferSize() + (session[bunHTTP2Socket]?.bufferSize || 0);
  }
  get sentHeaders() {
    return this[bunHTTP2Headers];
  }
  get sentInfoHeaders() {
    return this[kInfoHeaders] || [];
  }
  get sentTrailers() {
    return this.#sentTrailers;
  }
  get headRequest() {
    return !!this[kHeadRequest];
  }
  sendTrailers(headers) {
    let session = this[bunHTTP2Session];
    if (this.destroyed || this.closed)
      throw @makeErrorWithCode(90);
    if (this.#sentTrailers)
      throw @makeErrorWithCode(107);
    if (assertSession(session), (this[bunHTTP2StreamStatus] & 2 /* WantTrailer */) === 0)
      throw @makeErrorWithCode(108);
    if (headers == @undefined)
      headers = {};
    else if (!@isObject(headers))
      throw @makeErrorWithCode(118, "headers", "object", headers);
    else
      headers = { ...headers };
    let sensitives = headers[sensitiveHeaders], sensitiveNames = {};
    if (delete headers[sensitiveHeaders], sensitives) {
      if (!@isJSArray(sensitives))
        throw @makeErrorWithCode(119, "headers[http2.neverIndex]", sensitives);
      for (let i = 0;i < sensitives.length; i++)
        sensitiveNames[sensitives[i]] = !0;
    }
    if (ObjectKeys(headers).length === 0)
      session[bunHTTP2Native]?.noTrailers(this.#id);
    else
      session[bunHTTP2Native]?.sendTrailers(this.#id, headers, sensitiveNames);
    this.#sentTrailers = headers;
  }
  setTimeout(timeout, callback) {
    let session = this[bunHTTP2Session];
    if (!session)
      return;
    session.setTimeout(timeout, callback);
  }
  get closed() {
    return (this[bunHTTP2StreamStatus] & 8 /* Closed */) !== 0;
  }
  get destroyed() {
    return this[bunHTTP2Session] === null;
  }
  get state() {
    let session = this[bunHTTP2Session];
    if (session)
      return session[bunHTTP2Native]?.getStreamState(this.#id);
    return constants.NGHTTP2_STREAM_STATE_CLOSED;
  }
  priority(options) {
    if (!options)
      return !1;
    if (options.silent)
      return !1;
    let session = this[bunHTTP2Session];
    assertSession(session), session[bunHTTP2Native]?.setStreamPriority(this.#id, options);
  }
  get endAfterHeaders() {
    let session = this[bunHTTP2Session];
    if (session)
      return session[bunHTTP2Native]?.getEndAfterHeaders(this.#id) || !1;
    return !1;
  }
  get aborted() {
    return this[kAborted] || !1;
  }
  get session() {
    return this[bunHTTP2Session];
  }
  get pushAllowed() {
    return !1;
  }
  close(code, callback) {
    if ((this[bunHTTP2StreamStatus] & 8 /* Closed */) === 0) {
      let session = this[bunHTTP2Session];
      if (assertSession(session), code = code || 0, validateInteger(code, "code", 0, kMaxInt), typeof callback < "u")
        validateFunction(callback, "callback"), this.once("close", callback);
      this.push(null);
      let { ending } = this._writableState;
      if (!ending) {
        if (!this.aborted)
          this[kAborted] = !0, this.emit("aborted");
        this.end();
      }
      if (markStreamClosed(this), this.rstCode = code, this.writableFinished || code)
        setImmediate(rstNextTick.bind(session, this.#id, code));
      else
        this.once("finish", rstNextTick.bind(session, this.#id, code));
    }
  }
  _destroy(err, callback) {
    let { ending } = this._writableState;
    if (this.push(null), !ending) {
      if (!this.aborted)
        this[kAborted] = !0, this.emit("aborted");
      this._writableState.destroyed = !1, this.end(), this._writableState.destroyed = !0;
    }
    let session = this[bunHTTP2Session];
    assertSession(session);
    let rstCode = this.rstCode;
    if (!rstCode)
      if (err != null)
        if (err.code === "ABORT_ERR")
          rstCode = NGHTTP2_CANCEL;
        else
          rstCode = NGHTTP2_INTERNAL_ERROR;
      else
        rstCode = this.rstCode = 0;
    if (this.rstCode = rstCode, err == null && rstCode !== NGHTTP2_NO_ERROR && rstCode !== NGHTTP2_CANCEL)
      err = @makeErrorWithCode(106, nameForErrorCode[rstCode] || rstCode);
    if (markStreamClosed(this), this[bunHTTP2Session] = null, session && typeof this.#id === "number")
      setImmediate(rstNextTick.bind(session, this.#id, rstCode));
    callback(err);
  }
  _final(callback) {
    let status = this[bunHTTP2StreamStatus], session = this[bunHTTP2Session];
    if (session) {
      let native = session[bunHTTP2Native];
      if (native) {
        if (this[bunHTTP2StreamStatus] |= 4 /* FinalCalled */, this[bunHTTP2WaitForTrailers]) {
          if (this[bunHTTP2WaitForTrailers] = !1, (this[bunHTTP2StreamStatus] & 2 /* WantTrailer */) === 0)
            if (this[bunHTTP2StreamStatus] |= 2 /* WantTrailer */, this.listenerCount("wantTrailers") === 0)
              native.noTrailers(this.#id), this.#sentTrailers = {};
            else
              this.emit("wantTrailers");
          callback();
          return;
        }
        native.writeStream(this.#id, "", "ascii", !0, callback);
        return;
      }
    }
    if ((status & 32 /* WritableClosed */) !== 0 || (status & 8 /* Closed */) !== 0)
      callback(), this[bunHTTP2StreamStatus] |= 4 /* FinalCalled */;
    else
      this[bunHTTP2StreamFinal] = callback;
  }
  _read(_size) {}
  end(chunk, encoding, callback) {
    let status = this[bunHTTP2StreamStatus];
    if (typeof callback > "u") {
      if (typeof chunk === "function")
        callback = chunk, chunk = @undefined;
      else if (typeof encoding === "function")
        callback = encoding, encoding = @undefined;
    }
    if ((status & 1 /* EndedCalled */) !== 0) {
      typeof callback == "function" && callback();
      return;
    }
    return this[bunHTTP2StreamStatus] = status | 1 /* EndedCalled */, super.end(chunk, encoding, callback);
  }
  _writev(data, callback) {
    let session = this[bunHTTP2Session];
    if (session) {
      let native = session[bunHTTP2Native];
      if (native) {
        let allBuffers = data.allBuffers, chunks;
        if (chunks = data, allBuffers)
          for (let i = 0;i < data.length; i++)
            data[i] = data[i].chunk;
        else
          for (let i = 0;i < data.length; i++) {
            let { chunk: chunk2, encoding } = data[i];
            if (typeof chunk2 === "string")
              data[i] = @Buffer.from(chunk2, encoding);
            else
              data[i] = chunk2;
          }
        let chunk = @Buffer.concat(chunks || []);
        native.writeStream(this.#id, chunk, @undefined, !1, callback);
        return;
      }
    }
    if (typeof callback == "function")
      callback();
  }
  _write(chunk, encoding, callback) {
    let session = this[bunHTTP2Session];
    if (session) {
      let native = session[bunHTTP2Native];
      if (native) {
        native.writeStream(this.#id, chunk, encoding, !1, callback);
        return;
      }
    }
    if (typeof callback == "function")
      callback();
  }
  [EventEmitter.captureRejectionSymbol](err, event, ...args) {
    switch (event) {
      case "stream": {
        args[0].destroy(err);
        break;
      }
      default:
        this.destroy(err);
    }
  }
}

class ClientHttp2Stream extends Http2Stream {
  constructor(streamId, session, headers) {
    super(streamId, session, headers);
  }
}
function tryClose(fd) {
  try {
    fs.close(fd);
  } catch {}
}
function doSendFileFD(options, fd, headers, err, stat) {
  let onError = options.onError;
  if (err) {
    if (err.code !== "EBADF")
      tryClose(fd);
    if (onError)
      onError(err);
    else
      this.respond(headers, options), this.destroy(streamErrorFromCode(NGHTTP2_INTERNAL_ERROR));
    return;
  }
  if (!stat.isFile()) {
    let isDirectory = stat.isDirectory();
    if (options.offset !== @undefined || options.offset > 0 || options.length !== @undefined || options.length >= 0 || isDirectory) {
      let err2 = isDirectory ? @makeErrorWithCode(101) : @makeErrorWithCode(100);
      if (tryClose(fd), onError)
        onError(err2);
      else
        this.respond(headers, options), this.destroy(err2);
      return;
    }
    options.offset = 0, options.length = -1;
  }
  if (this.destroyed || this.closed) {
    tryClose(fd), this.destroy(@makeErrorWithCode(90));
    return;
  }
  let statOptions = {
    offset: options.offset !== @undefined ? options.offset : 0,
    length: options.length !== @undefined ? options.length : -1
  };
  if (statOptions.offset <= 0)
    statOptions.offset = 0;
  if (statOptions.length <= 0)
    if (stat.isFile())
      statOptions.length = stat.size;
    else
      statOptions.length = @undefined;
  if (typeof options.statCheck === "function" && options.statCheck.@call(this, stat, headers, options) === !1 || this.headersSent) {
    tryClose(fd);
    return;
  }
  if (stat.isFile()) {
    statOptions.length = statOptions.length < 0 ? stat.size - +statOptions.offset : Math.min(stat.size - +statOptions.offset, statOptions.length);
    for (let i in headers)
      if (i?.toLowerCase() === HTTP2_HEADER_CONTENT_LENGTH)
        delete headers[i];
    headers[HTTP2_HEADER_CONTENT_LENGTH] = statOptions.length;
  }
  try {
    this.respond(headers, options), fs.createReadStream(null, {
      fd,
      autoClose: !1,
      start: statOptions.offset ? statOptions.offset : @undefined,
      end: typeof statOptions.length === "number" ? statOptions.length + (statOptions.offset || 0) - 1 : @undefined,
      emitClose: !1
    }).pipe(this);
  } catch (err2) {
    if (typeof onError === "function")
      onError(err2);
    else
      this.destroy(err2);
  }
}
function afterOpen(options, headers, err, fd) {
  let onError = options.onError;
  if (err) {
    if (tryClose(fd), onError)
      onError(err);
    else
      this.destroy(err);
    return;
  }
  if (this.destroyed || this.closed) {
    tryClose(fd);
    return;
  }
  fs.fstat(fd, doSendFileFD.bind(this, options, fd, headers));
}

class ServerHttp2Stream extends Http2Stream {
  headersSent = !1;
  constructor(streamId, session, headers) {
    super(streamId, session, headers);
  }
  pushStream() {
    throw @makeErrorWithCode(99);
  }
  respondWithFile(path, headers, options) {
    if (this.destroyed)
      throw @makeErrorWithCode(90);
    if (this.headersSent)
      throw @makeErrorWithCode(83);
    if (headers == @undefined)
      headers = {};
    else if (!@isObject(headers))
      throw @makeErrorWithCode(118, "headers", "object", headers);
    else
      headers = { ...headers };
    if (headers[HTTP2_HEADER_STATUS] === @undefined)
      headers[HTTP2_HEADER_STATUS] = 200;
    let statusCode = headers[HTTP2_HEADER_STATUS];
    if (options = { ...options }, statusCode === HTTP_STATUS_NO_CONTENT || statusCode === HTTP_STATUS_RESET_CONTENT || statusCode === HTTP_STATUS_NOT_MODIFIED || this.headRequest)
      throw @makeErrorWithCode(95, statusCode);
    if (options.offset !== @undefined && typeof options.offset !== "number")
      throw @makeErrorWithCode(119, "options.offset", options.offset);
    if (options.length !== @undefined && typeof options.length !== "number")
      throw @makeErrorWithCode(119, "options.length", options.length);
    if (options.statCheck !== @undefined && typeof options.statCheck !== "function")
      throw @makeErrorWithCode(119, "options.statCheck", options.statCheck);
    fs.open(path, "r", afterOpen.bind(this, options || {}, headers));
  }
  respondWithFD(fd, headers, options) {
    if (this.destroyed)
      throw @makeErrorWithCode(90);
    if (this.headersSent)
      throw @makeErrorWithCode(83);
    if (headers == @undefined)
      headers = {};
    else if (!@isObject(headers))
      throw @makeErrorWithCode(118, "headers", "object", headers);
    else
      headers = { ...headers };
    if (headers[HTTP2_HEADER_STATUS] === @undefined)
      headers[HTTP2_HEADER_STATUS] = 200;
    let statusCode = headers[HTTP2_HEADER_STATUS];
    if (statusCode === HTTP_STATUS_NO_CONTENT || statusCode === HTTP_STATUS_RESET_CONTENT || statusCode === HTTP_STATUS_NOT_MODIFIED || this.headRequest)
      throw @makeErrorWithCode(95, statusCode);
    if (options = { ...options }, options.offset !== @undefined && typeof options.offset !== "number")
      throw @makeErrorWithCode(119, "options.offset", options.offset);
    if (options.length !== @undefined && typeof options.length !== "number")
      throw @makeErrorWithCode(119, "options.length", options.length);
    if (options.statCheck !== @undefined && typeof options.statCheck !== "function")
      throw @makeErrorWithCode(119, "options.statCheck", options.statCheck);
    if (fd instanceof FileHandle)
      fs.fstat(fd.fd, doSendFileFD.bind(this, options, fd, headers));
    else
      fs.fstat(fd, doSendFileFD.bind(this, options, fd, headers));
  }
  additionalHeaders(headers) {
    if (this.destroyed || this.closed)
      throw @makeErrorWithCode(90);
    if (this.sentTrailers)
      throw @makeErrorWithCode(107);
    if (this.headersSent)
      throw @makeErrorWithCode(82);
    if (headers == @undefined)
      headers = {};
    else if (!@isObject(headers))
      throw @makeErrorWithCode(118, "headers", "object", headers);
    else
      headers = { ...headers };
    for (let name in headers)
      if (name.startsWith(":") && name !== HTTP2_HEADER_STATUS)
        throw @makeErrorWithCode(88, name);
    let sensitives = headers[sensitiveHeaders];
    delete headers[sensitiveHeaders];
    let sensitiveNames = {};
    if (sensitives) {
      if (!@isArray(sensitives))
        throw @makeErrorWithCode(119, "headers[http2.neverIndex]", sensitives);
      for (let i = 0;i < sensitives.length; i++)
        sensitiveNames[sensitives[i]] = !0;
    }
    let hasStatus = !0;
    if (headers[HTTP2_HEADER_STATUS] === @undefined)
      headers[HTTP2_HEADER_STATUS] = 200, hasStatus = !1;
    let statusCode = headers[HTTP2_HEADER_STATUS];
    if (hasStatus) {
      if (statusCode === HTTP_STATUS_SWITCHING_PROTOCOLS)
        throw @makeErrorWithCode(104);
      if (statusCode < 100 || statusCode >= 200)
        throw @makeErrorWithCode(86, statusCode);
      if (statusCode === HTTP_STATUS_NO_CONTENT || statusCode === HTTP_STATUS_RESET_CONTENT || statusCode === HTTP_STATUS_NOT_MODIFIED || this.headRequest)
        throw @makeErrorWithCode(95, statusCode);
    }
    let session = this[bunHTTP2Session];
    if (assertSession(session), !this[kInfoHeaders])
      this[kInfoHeaders] = [headers];
    else
      ArrayPrototypePush.@call(this[kInfoHeaders], headers);
    session[bunHTTP2Native]?.request(this.id, @undefined, headers, sensitiveNames);
  }
  respond(headers, options) {
    if (this.destroyed)
      throw @makeErrorWithCode(90);
    let session = this[bunHTTP2Session];
    if (assertSession(session), this.headersSent)
      throw @makeErrorWithCode(83);
    if (this.sentTrailers)
      throw @makeErrorWithCode(107);
    if (headers == @undefined)
      headers = {};
    else if (!@isObject(headers))
      throw @makeErrorWithCode(118, "headers", "object", headers);
    else
      headers = { ...headers };
    let sensitives = headers[sensitiveHeaders];
    delete headers[sensitiveHeaders];
    let sensitiveNames = {};
    if (sensitives) {
      if (!@isArray(sensitives))
        throw @makeErrorWithCode(119, "headers[http2.neverIndex]", sensitives);
      for (let i = 0;i < sensitives.length; i++)
        sensitiveNames[sensitives[i]] = !0;
    }
    if (headers[HTTP2_HEADER_STATUS] === @undefined)
      headers[HTTP2_HEADER_STATUS] = 200;
    let statusCode = headers[HTTP2_HEADER_STATUS], endStream = !!options?.endStream;
    if (endStream || statusCode === HTTP_STATUS_NO_CONTENT || statusCode === HTTP_STATUS_RESET_CONTENT || statusCode === HTTP_STATUS_NOT_MODIFIED || this.headRequest === !0)
      options = { ...options, endStream: !0, waitForTrailers: !1 }, endStream = !0;
    let sendDate = options?.sendDate;
    if (sendDate == null || sendDate) {
      if (headers.date == null)
        headers.date = utcDate();
    }
    if (typeof options > "u")
      session[bunHTTP2Native]?.request(this.id, @undefined, headers, sensitiveNames);
    else if (session[bunHTTP2Native]?.request(this.id, @undefined, headers, sensitiveNames, options), options?.waitForTrailers && !endStream)
      this[bunHTTP2WaitForTrailers] = !0;
    if (this.headersSent = !0, this[bunHTTP2Headers] = headers, endStream)
      this.end();
    return;
  }
}
function connectWithProtocol(protocol, options, listener) {
  if (protocol === "http:")
    return net.connect(options, listener);
  return tls.connect(options, listener);
}
function emitConnectNT(self, socket) {
  self.emit("connect", self, socket);
}
function emitStreamErrorNT(self, stream, error, destroy, destroy_self) {
  if (stream) {
    let error_instance = @undefined;
    if (stream.listenerCount("error") > 0)
      if (typeof error === "number") {
        if (stream.rstCode = error, error != 0)
          error_instance = streamErrorFromCode(error);
      } else
        error_instance = error;
    if (stream.readable)
      stream.resume(), pushToStream(stream, null);
    if (markStreamClosed(stream), destroy)
      stream.destroy(error_instance, stream.rstCode);
    else if (error_instance)
      stream.emit("error", error_instance);
    if (destroy_self)
      self.destroy();
  }
}
function toHeaderObject(headers, sensitiveHeadersValue) {
  let obj = { __proto__: null, [sensitiveHeaders]: sensitiveHeadersValue };
  for (let n = 0;n < headers.length; n += 2) {
    let name = headers[n], value = headers[n + 1] || "";
    if (name === HTTP2_HEADER_STATUS)
      value |= 0;
    let existing = obj[name];
    if (existing === @undefined)
      obj[name] = name === HTTP2_HEADER_SET_COOKIE ? [value] : value;
    else if (!kSingleValueHeaders.has(name))
      switch (name) {
        case HTTP2_HEADER_COOKIE:
          obj[name] = `${existing}; ${value}`;
          break;
        case HTTP2_HEADER_SET_COOKIE:
          ArrayPrototypePush.@call(existing, value);
          break;
        default:
          obj[name] = `${existing}, ${value}`;
          break;
      }
  }
  return obj;
}
function getOrigin(origin, isAltSvc) {
  if (typeof origin === "string")
    try {
      origin = new URL(origin).origin;
    } catch (e) {
      if (isAltSvc)
        throw @makeErrorWithCode(75);
      else
        throw @makeErrorWithCode(141, origin);
    }
  else if (origin != null && typeof origin === "object")
    origin = origin.origin;
  if (validateString(origin, "origin"), !origin || origin === "null")
    if (isAltSvc)
      throw @makeErrorWithCode(75);
    else
      throw @makeErrorWithCode(87);
  return origin;
}
function initOriginSet(session) {
  let originSet = session[bunHTTP2OriginSet];
  if (originSet === @undefined) {
    let socket = session[bunHTTP2Socket];
    session[bunHTTP2OriginSet] = originSet = /* @__PURE__ */ new Set;
    let hostName = socket.servername;
    if (!hostName)
      if (socket.remoteFamily === "IPv6")
        hostName = `[${socket.remoteAddress}]`;
      else
        hostName = socket.remoteAddress;
    let originString = `https://${hostName}`;
    if (socket.remotePort != null)
      originString += `:${socket.remotePort}`;
    originSet.add(originString);
  }
  return originSet;
}
function removeOriginFromSet(session, stream) {
  let originSet = session[bunHTTP2OriginSet], origin = `https://${stream.authority}`;
  if (originSet && origin)
    originSet.delete(origin);
}

class ServerHttp2Session extends Http2Session {
  [kServer] = null;
  #closed = !1;
  #connected = !1;
  #connections = 0;
  #socket_proxy;
  #parser;
  #url;
  #isServer = !1;
  #alpnProtocol = @undefined;
  #localSettings = {
    headerTableSize: 4096,
    enablePush: !1,
    maxConcurrentStreams: 100,
    initialWindowSize: 65535,
    maxFrameSize: 16384,
    maxHeaderListSize: 65535,
    maxHeaderSize: 65535
  };
  #encrypted = !1;
  #pendingSettingsAck = !0;
  #remoteSettings = null;
  #pingCallbacks = null;
  static #Handlers = {
    binaryType: "buffer",
    streamStart(self, stream_id) {
      if (!self)
        return;
      self.#connections++;
      let stream = new ServerHttp2Stream(stream_id, self, null);
      self.#parser?.setStreamContext(stream_id, stream);
    },
    frameError(self, stream, frameType, errorCode) {
      if (!self || typeof stream !== "object")
        return;
      process.nextTick(emitFrameErrorEventNT, stream, frameType, errorCode);
    },
    aborted(self, stream, error, old_state) {
      if (!self || typeof stream !== "object")
        return;
      if (stream.rstCode = constants.NGHTTP2_CANCEL, old_state != 5 && old_state != 7)
        stream[kAborted] = !0, stream.emit("aborted");
      self.#connections--, process.nextTick(emitStreamErrorNT, self, stream, error, !0, self.#connections === 0 && self.#closed);
    },
    streamError(self, stream, error) {
      if (!self || typeof stream !== "object")
        return;
      self.#connections--, process.nextTick(emitStreamErrorNT, self, stream, error, !0, self.#connections === 0 && self.#closed);
    },
    streamEnd(self, stream, state) {
      if (!self || typeof stream !== "object")
        return;
      if (state == 6 || state == 7) {
        if (stream.readable) {
          if (!stream.rstCode)
            stream.rstCode = 0;
          if (pushToStream(stream, null), stream.readableFlowing === null)
            stream.resume();
        }
      }
      if (state === 7) {
        if (markStreamClosed(stream), self.#connections--, stream.destroy(), self.#connections === 0 && self.#closed)
          self.destroy();
      } else if (state === 5)
        markWritableDone(stream);
    },
    streamData(self, stream, data) {
      if (!self || typeof stream !== "object" || !data)
        return;
      pushToStream(stream, data);
    },
    streamHeaders(self, stream, rawheaders, sensitiveHeadersValue, flags) {
      if (!self || typeof stream !== "object" || self.closed || stream.closed)
        return;
      let headers = toHeaderObject(rawheaders, sensitiveHeadersValue || []);
      if (headers[HTTP2_HEADER_METHOD] === HTTP2_METHOD_HEAD)
        stream[kHeadRequest] = !0;
      if ((stream[bunHTTP2StreamStatus] & 16 /* StreamResponded */) !== 0)
        stream.emit("trailers", headers, flags, rawheaders);
      else
        stream[bunHTTP2StreamStatus] |= 16 /* StreamResponded */, self[kServer].emit("stream", stream, headers, flags, rawheaders), self.emit("stream", stream, headers, flags, rawheaders);
    },
    localSettings(self, settings) {
      if (!self)
        return;
      self.#localSettings = settings, self.#pendingSettingsAck = !1, self.emit("localSettings", settings);
    },
    remoteSettings(self, settings) {
      if (!self)
        return;
      self.#remoteSettings = settings, self.emit("remoteSettings", settings);
    },
    ping(self, payload, isACK) {
      if (!self)
        return;
      if (self.emit("ping", payload), isACK) {
        let callbacks = self.#pingCallbacks;
        if (callbacks) {
          let callbackInfo = callbacks.shift();
          if (callbackInfo) {
            let [callback, start] = callbackInfo;
            callback(null, Date.now() - start, payload);
          }
        }
      }
    },
    error(self, errorCode, lastStreamId, opaqueData) {
      if (!self)
        return;
      self.destroy(errorCode);
    },
    wantTrailers(self, stream) {
      if (!self || typeof stream !== "object")
        return;
      let status = stream[bunHTTP2StreamStatus];
      if ((status & 2 /* WantTrailer */) !== 0)
        return;
      if (stream[bunHTTP2StreamStatus] = status | 2 /* WantTrailer */, stream.listenerCount("wantTrailers") === 0)
        self[bunHTTP2Native]?.noTrailers(stream.id);
      else
        stream.emit("wantTrailers");
    },
    goaway(self, errorCode, lastStreamId, opaqueData) {
      if (!self)
        return;
      if (self.emit("goaway", errorCode, lastStreamId, opaqueData || @Buffer.allocUnsafe(0)), errorCode !== 0)
        self.#parser.emitErrorToAllStreams(errorCode);
      self.close();
    },
    end(self, errorCode, lastStreamId, opaqueData) {
      if (!self)
        return;
      self.destroy();
    },
    write(self, buffer) {
      if (!self)
        return -1;
      let socket = self[bunHTTP2Socket];
      if (socket && !socket.writableEnded && self.#connected)
        return socket.write(buffer) ? 1 : 0;
      return -1;
    }
  };
  #onRead(data) {
    this.#parser?.read(data);
  }
  #onClose() {
    let parser = this.#parser;
    if (parser)
      parser.emitAbortToAllStreams(), parser.detach(), this.#parser = null;
    this.close();
  }
  #onError(error) {
    this.destroy(error);
  }
  #onTimeout() {
    let parser = this.#parser;
    if (parser)
      parser.forEachStream(emitTimeout);
    this.emit("timeout");
  }
  #onDrain() {
    let parser = this.#parser;
    if (parser)
      parser.flush();
  }
  altsvc(alt, originOrStream) {
    let parser = this.#parser;
    if (this.destroyed || !parser)
      throw @makeErrorWithCode(89);
    let stream = 0, origin;
    if (typeof originOrStream === "string")
      origin = getOrigin(originOrStream, !0);
    else if (typeof originOrStream === "number") {
      if (originOrStream >>> 0 !== originOrStream || originOrStream === 0)
        throw @makeErrorWithCode(156, "originOrStream", "> 0 && < 4294967296", originOrStream);
      stream = originOrStream;
    } else if (originOrStream !== @undefined) {
      if (originOrStream !== null && typeof originOrStream === "object")
        origin = originOrStream.origin;
      if (typeof origin !== "string")
        throw @makeErrorWithCode(118, "originOrStream", ["string", "number", "URL", "object"], originOrStream);
      else if (!origin)
        throw @makeErrorWithCode(75);
      else
        origin = getOrigin(origin, !0);
    }
    if (validateString(alt, "alt"), !kQuotedString.test(alt))
      throw @makeErrorWithCode(121, "alt");
    if (origin = origin || "", @Buffer.byteLength(origin) + @Buffer.byteLength(alt) > 16382)
      throw @makeErrorWithCode(76);
    parser.altsvc(origin, alt, stream);
  }
  origin(...origins) {
    let parser = this.#parser;
    if (this.destroyed || !parser)
      throw @makeErrorWithCode(89);
    let length = origins.length;
    if (length === 0)
      return;
    if (length === 1)
      return parser.origin(getOrigin(origins[0], !1));
    let validOrigins = new @Array(length);
    for (let i = 0;i < length; i++)
      validOrigins[i] = getOrigin(origins[i], !1);
    parser.origin(validOrigins);
  }
  constructor(socket, options, server) {
    super();
    if (this[kServer] = server, server)
      server[kSessions].add(this);
    if (this.#connected = !0, socket instanceof TLSSocket)
      this.#alpnProtocol = socket.alpnProtocol || "h2";
    else
      this.#alpnProtocol = "h2c";
    this[bunHTTP2Socket] = socket;
    let nativeSocket = socket._handle;
    this.#encrypted = socket instanceof TLSSocket, this.#parser = new H2FrameParser({
      native: nativeSocket,
      context: this,
      settings: { ...options, ...options?.settings, enablePush: !1 },
      type: 0,
      handlers: ServerHttp2Session.#Handlers
    }), socket.on("close", this.#onClose.bind(this)), socket.on("error", this.#onError.bind(this)), socket.on("timeout", this.#onTimeout.bind(this)), socket.on("data", this.#onRead.bind(this)), socket.on("drain", this.#onDrain.bind(this)), process.nextTick(emitConnectNT, this, socket);
  }
  get originSet() {
    if (this.encrypted)
      return @Array.from(initOriginSet(this));
  }
  get alpnProtocol() {
    return this.#alpnProtocol;
  }
  get connecting() {
    let socket = this[bunHTTP2Socket];
    if (!socket)
      return !1;
    return socket.connecting || !1;
  }
  get connected() {
    return this[bunHTTP2Socket]?.connecting === !1;
  }
  get destroyed() {
    return this[bunHTTP2Socket] === null;
  }
  get encrypted() {
    return this.#encrypted;
  }
  get closed() {
    return this.#closed;
  }
  get remoteSettings() {
    return this.#remoteSettings;
  }
  get localSettings() {
    return this.#localSettings;
  }
  get pendingSettingsAck() {
    return this.#pendingSettingsAck;
  }
  get type() {
    return 0;
  }
  get socket() {
    if (this.#socket_proxy)
      return this.#socket_proxy;
    if (!this[bunHTTP2Socket])
      return null;
    return this.#socket_proxy = new Proxy(this, proxySocketHandler), this.#socket_proxy;
  }
  get state() {
    return this.#parser?.getCurrentState();
  }
  get [bunHTTP2Native]() {
    return this.#parser;
  }
  unref() {
    return this[bunHTTP2Socket]?.unref();
  }
  ref() {
    return this[bunHTTP2Socket]?.ref();
  }
  setTimeout(msecs, callback) {
    return this[bunHTTP2Socket]?.setTimeout(msecs, callback);
  }
  ping(payload, callback) {
    if (typeof payload === "function")
      callback = payload, payload = @Buffer.alloc(8);
    else
      payload = payload || @Buffer.alloc(8);
    if (!(payload instanceof @Buffer) && !isTypedArray(payload))
      throw @makeErrorWithCode(118, "payload", ["Buffer", "TypedArray"], payload);
    let parser = this.#parser;
    if (!parser)
      return !1;
    if (!this[bunHTTP2Socket])
      return !1;
    if (typeof callback === "function") {
      if (payload.byteLength !== 8) {
        let error = @makeErrorWithCode(97);
        callback(error, 0, payload);
        return;
      }
      if (this.#pingCallbacks)
        this.#pingCallbacks.push([callback, Date.now()]);
      else
        this.#pingCallbacks = [[callback, Date.now()]];
    } else if (payload.byteLength !== 8)
      throw @makeErrorWithCode(97);
    return parser.ping(payload), !0;
  }
  goaway(code = NGHTTP2_NO_ERROR, lastStreamID = 0, opaqueData) {
    if (this.destroyed)
      throw @makeErrorWithCode(89);
    if (opaqueData !== @undefined)
      validateBuffer(opaqueData, "opaqueData");
    return validateNumber(code, "code"), validateNumber(lastStreamID, "lastStreamID"), this.#parser?.goaway(code, lastStreamID, opaqueData);
  }
  setLocalWindowSize(windowSize) {
    if (this.destroyed)
      throw @makeErrorWithCode(89);
    return validateInt32(windowSize, "windowSize", 0, kMaxWindowSize), this.#parser?.setLocalWindowSize?.(windowSize);
  }
  settings(settings, callback) {
    if (callback !== @undefined && typeof callback !== "function")
      throw @makeErrorWithCode(118, "callback", "function", callback);
    if (validateSettings(settings), settings = { ...settings, enablePush: !1 }, this.#pendingSettingsAck = !0, this.#parser?.settings(settings), typeof callback === "function") {
      let start = Date.now();
      this.once("localSettings", () => {
        callback(null, this.#localSettings, Date.now() - start);
      });
    }
  }
  close(callback) {
    if (this.#closed = !0, typeof callback === "function")
      this.on("close", callback);
    if (this.#connections === 0)
      this.destroy();
  }
  destroy(error = NGHTTP2_NO_ERROR, code) {
    let server = this[kServer];
    if (server)
      server[kSessions].delete(this);
    if (typeof error === "number")
      code = error, error = code !== NGHTTP2_NO_ERROR ? @makeErrorWithCode(102, code) : @undefined;
    let socket = this[bunHTTP2Socket];
    if (!this.#connected)
      return;
    if (this.#closed = !0, this.#connected = !1, socket)
      this.goaway(code || constants.NGHTTP2_NO_ERROR, 0, @Buffer.alloc(0)), socket.end();
    let parser = this.#parser;
    if (parser)
      parser.emitErrorToAllStreams(code || constants.NGHTTP2_NO_ERROR), parser.detach(), this.#parser = null;
    if (this[bunHTTP2Socket] = null, error)
      this.emit("error", error);
    this.emit("close");
  }
}
function emitTimeout(session) {
  session.emit("timeout");
}
function streamCancel(stream) {
  stream.close(NGHTTP2_CANCEL);
}

class ClientHttp2Session extends Http2Session {
  #closed = !1;
  #connected = !1;
  #connections = 0;
  #socket_proxy;
  #parser;
  #url;
  #authority;
  #alpnProtocol = @undefined;
  #localSettings = {
    headerTableSize: 4096,
    enablePush: !0,
    maxConcurrentStreams: 100,
    initialWindowSize: 65535,
    maxFrameSize: 16384,
    maxHeaderListSize: 65535,
    maxHeaderSize: 65535
  };
  #encrypted = !1;
  #pendingSettingsAck = !0;
  #remoteSettings = null;
  #pingCallbacks = null;
  static #Handlers = {
    binaryType: "buffer",
    streamStart(self, stream_id) {
      if (!self)
        return;
      if (self.#connections++, stream_id % 2 === 0) {
        let stream = new ClientHttp2Session(stream_id, self, null);
        self.#parser?.setStreamContext(stream_id, stream);
      }
    },
    frameError(self, stream, frameType, errorCode) {
      if (!self || typeof stream !== "object")
        return;
      process.nextTick(emitFrameErrorEventNT, stream, frameType, errorCode);
    },
    aborted(self, stream, error, old_state) {
      if (!self || typeof stream !== "object")
        return;
      if (stream.rstCode = constants.NGHTTP2_CANCEL, old_state != 5 && old_state != 7)
        stream[kAborted] = !0, stream.emit("aborted");
      self.#connections--, process.nextTick(emitStreamErrorNT, self, stream, error, !0, self.#connections === 0 && self.#closed);
    },
    streamError(self, stream, error) {
      if (!self || typeof stream !== "object")
        return;
      self.#connections--, process.nextTick(emitStreamErrorNT, self, stream, error, !0, self.#connections === 0 && self.#closed);
    },
    streamEnd(self, stream, state) {
      if (!self || typeof stream !== "object")
        return;
      if (state == 6 || state == 7) {
        if (stream.readable) {
          if (!stream.rstCode)
            stream.rstCode = 0;
          pushToStream(stream, null), stream.read(0);
        }
      }
      if (state === 7) {
        if (markStreamClosed(stream), self.#connections--, stream.destroy(), self.#connections === 0 && self.#closed)
          self.destroy();
      } else if (state === 5)
        markWritableDone(stream);
    },
    streamData(self, stream, data) {
      if (!self || typeof stream !== "object" || !data)
        return;
      pushToStream(stream, data);
    },
    streamHeaders(self, stream, rawheaders, sensitiveHeadersValue, flags) {
      if (!self || typeof stream !== "object" || stream.rstCode)
        return;
      let headers = toHeaderObject(rawheaders, sensitiveHeadersValue || []), status = stream[bunHTTP2StreamStatus], header_status = headers[HTTP2_HEADER_STATUS];
      if (header_status === HTTP_STATUS_CONTINUE)
        stream.emit("continue");
      if ((status & 16 /* StreamResponded */) !== 0)
        stream.emit("trailers", headers, flags, rawheaders);
      else if (header_status >= 100 && header_status < 200)
        stream.emit("headers", headers, flags, rawheaders);
      else {
        if (stream[bunHTTP2StreamStatus] |= 16 /* StreamResponded */, header_status === 421)
          removeOriginFromSet(self, stream);
        self.emit("stream", stream, headers, flags, rawheaders), stream.emit("response", headers, flags, rawheaders);
      }
    },
    localSettings(self, settings) {
      if (!self)
        return;
      self.#localSettings = settings, self.#pendingSettingsAck = !1, self.emit("localSettings", settings);
    },
    remoteSettings(self, settings) {
      if (!self)
        return;
      self.#remoteSettings = settings, self.emit("remoteSettings", settings);
    },
    ping(self, payload, isACK) {
      if (!self)
        return;
      if (self.emit("ping", payload), isACK) {
        let callbacks = self.#pingCallbacks;
        if (callbacks) {
          let callbackInfo = callbacks.shift();
          if (callbackInfo) {
            let [callback, start] = callbackInfo;
            callback(null, Date.now() - start, payload);
          }
        }
      }
    },
    error(self, errorCode, lastStreamId, opaqueData) {
      if (!self)
        return;
      let error_instance = sessionErrorFromCode(errorCode);
      self.destroy(error_instance);
    },
    wantTrailers(self, stream) {
      if (!self || typeof stream !== "object")
        return;
      let status = stream[bunHTTP2StreamStatus];
      if ((status & 2 /* WantTrailer */) !== 0)
        return;
      if (stream[bunHTTP2StreamStatus] = status | 2 /* WantTrailer */, stream.listenerCount("wantTrailers") === 0)
        self[bunHTTP2Native]?.noTrailers(stream.id);
      else
        stream.emit("wantTrailers");
    },
    goaway(self, errorCode, lastStreamId, opaqueData) {
      if (!self)
        return;
      if (self.emit("goaway", errorCode, lastStreamId, opaqueData || @Buffer.allocUnsafe(0)), self.closed)
        return;
      self.destroy(@undefined, errorCode);
    },
    end(self, errorCode, lastStreamId, opaqueData) {
      if (!self)
        return;
      self.destroy();
    },
    altsvc(self, origin, value, streamId) {
      if (!self)
        return;
      self.emit("altsvc", value, origin, streamId);
    },
    origin(self, origin) {
      if (!self)
        return;
      if (self.encrypted) {
        let originSet = initOriginSet(self);
        if (@isArray(origin)) {
          for (let item of origin)
            originSet.add(item);
          self.emit("origin", origin);
        } else if (origin)
          originSet.add(origin), self.emit("origin", [origin]);
      }
    },
    write(self, buffer) {
      if (!self)
        return -1;
      let socket = self[bunHTTP2Socket];
      if (socket && !socket.writableEnded && self.#connected)
        return socket.write(buffer) ? 1 : 0;
      return -1;
    }
  };
  #onRead(data) {
    this.#parser?.read(data);
  }
  get originSet() {
    if (this.encrypted)
      return @Array.from(initOriginSet(this));
  }
  get alpnProtocol() {
    return this.#alpnProtocol;
  }
  #onConnect() {
    let socket = this[bunHTTP2Socket];
    if (!socket)
      return;
    if (this.#connected = !0, socket instanceof TLSSocket) {
      if (socket.alpnProtocol !== "h2") {
        socket.end();
        let error = @makeErrorWithCode(80, "h2 is not supported");
        this.emit("error", error);
      }
      this.#alpnProtocol = "h2";
    } else
      this.#alpnProtocol = "h2c";
    let nativeSocket = socket._handle;
    if (nativeSocket)
      this.#parser.setNativeSocket(nativeSocket);
    process.nextTick(emitConnectNT, this, socket), this.#parser.flush();
  }
  #onClose() {
    let parser = this.#parser, err = this.connecting ? @makeErrorWithCode(220) : null;
    if (parser)
      parser.forEachStream(streamCancel), parser.detach(), this.#parser = null;
    this.destroy(err, NGHTTP2_NO_ERROR), this[bunHTTP2Socket] = null;
  }
  #onError(error) {
    if (this[bunHTTP2Socket] = null, this.#closed) {
      this.destroy();
      return;
    }
    this.destroy(error);
  }
  #onTimeout() {
    let parser = this.#parser;
    if (parser)
      parser.forEachStream(emitTimeout);
    this.emit("timeout");
  }
  #onDrain() {
    let parser = this.#parser;
    if (parser)
      parser.flush();
  }
  get connecting() {
    let socket = this[bunHTTP2Socket];
    if (!socket)
      return !1;
    return socket.connecting || !1;
  }
  get connected() {
    return this[bunHTTP2Socket]?.connecting === !1;
  }
  get destroyed() {
    return this[bunHTTP2Socket] === null;
  }
  get encrypted() {
    return this.#encrypted;
  }
  get closed() {
    return this.#closed;
  }
  get remoteSettings() {
    return this.#remoteSettings;
  }
  get localSettings() {
    return this.#localSettings;
  }
  get pendingSettingsAck() {
    return this.#pendingSettingsAck;
  }
  get type() {
    return 1;
  }
  unref() {
    return this[bunHTTP2Socket]?.unref();
  }
  ref() {
    return this[bunHTTP2Socket]?.ref();
  }
  setNextStreamID(id) {
    if (this.destroyed)
      throw @makeErrorWithCode(89);
    if (validateNumber(id, "id"), id <= 0 || id > kMaxStreams)
      throw @makeErrorWithCode(156, "id", `> 0 and <= ${kMaxStreams}`, id);
    this.#parser?.setNextStreamID(id);
  }
  setTimeout(msecs, callback) {
    return this[bunHTTP2Socket]?.setTimeout(msecs, callback);
  }
  ping(payload, callback) {
    if (typeof payload === "function")
      callback = payload, payload = @Buffer.alloc(8);
    else
      payload = payload || @Buffer.alloc(8);
    if (!(payload instanceof @Buffer) && !isTypedArray(payload))
      throw @makeErrorWithCode(118, "payload", ["Buffer", "TypedArray"], payload);
    let parser = this.#parser;
    if (!parser)
      return !1;
    if (!this[bunHTTP2Socket])
      return !1;
    if (typeof callback === "function") {
      if (payload.byteLength !== 8) {
        let error = @makeErrorWithCode(97);
        callback(error, 0, payload);
        return;
      }
      if (this.#pingCallbacks)
        this.#pingCallbacks.push([callback, Date.now()]);
      else
        this.#pingCallbacks = [[callback, Date.now()]];
    } else if (payload.byteLength !== 8)
      throw @makeErrorWithCode(97);
    return parser.ping(payload), !0;
  }
  goaway(errorCode, lastStreamId, opaqueData) {
    return this.#parser?.goaway(errorCode, lastStreamId, opaqueData);
  }
  setLocalWindowSize(windowSize) {
    if (this.destroyed)
      throw @makeErrorWithCode(89);
    return validateInt32(windowSize, "windowSize", 0, kMaxWindowSize), this.#parser?.setLocalWindowSize?.(windowSize);
  }
  get socket() {
    if (this.#socket_proxy)
      return this.#socket_proxy;
    if (!this[bunHTTP2Socket])
      return null;
    return this.#socket_proxy = new Proxy(this, proxySocketHandler), this.#socket_proxy;
  }
  get state() {
    return this.#parser?.getCurrentState();
  }
  settings(settings, callback) {
    if (callback !== @undefined && typeof callback !== "function")
      throw @makeErrorWithCode(118, "callback", "function", callback);
    if (validateSettings(settings), this.#pendingSettingsAck = !0, this.#parser?.settings(settings), typeof callback === "function") {
      let start = Date.now();
      this.once("localSettings", () => {
        callback(null, this.#localSettings, Date.now() - start);
      });
    }
  }
  constructor(url, options, listener) {
    super();
    if (typeof options === "function")
      listener = options, options = @undefined;
    if (assertIsObject(options, "options"), options = { ...options }, assertIsArray(options.remoteCustomSettings, "options.remoteCustomSettings"), options.remoteCustomSettings) {
      if (options.remoteCustomSettings = [...options.remoteCustomSettings], options.remoteCustomSettings.length > 10)
        throw @makeErrorWithCode(109);
    }
    if (typeof url === "string")
      url = new URL(url);
    assertIsObject(url, "authority", ["string", "Object", "URL"]), this.#url = url;
    let protocol = url.protocol || options?.protocol || "https:";
    switch (protocol) {
      case "http:":
      case "https:":
        break;
      default:
        throw @makeErrorWithCode(111, protocol);
    }
    let port = url.port ? parseInt(url.port, 10) : protocol === "http:" ? 80 : 443, host = "localhost";
    if (url.hostname) {
      if (host = url.hostname, host[0] === "[")
        host = host.slice(1, -1);
    } else if (url.host)
      host = url.host;
    if (protocol === "https:" && port === 443 || protocol === "http:" && port === 80) {
      let needsBrackets = StringPrototypeIncludes.@call(host, ":") && !StringPrototypeStartsWith.@call(host, "[");
      this.#authority = needsBrackets ? `[${host}]` : host;
    } else {
      let needsBrackets = StringPrototypeIncludes.@call(host, ":") && !StringPrototypeStartsWith.@call(host, "[");
      this.#authority = needsBrackets ? `[${host}]:${port}` : `${host}:${port}`;
    }
    function onConnect() {
      try {
        this.#onConnect(arguments), listener?.@call(this, this);
      } catch (e) {
        this.destroy(e);
      }
    }
    let socket;
    if (typeof options?.createConnection === "function")
      if (socket = options.createConnection(url, options), this[bunHTTP2Socket] = socket, socket.connecting || socket.secureConnecting) {
        let connectEvent = socket instanceof tls.TLSSocket ? "secureConnect" : "connect";
        socket.once(connectEvent, onConnect.bind(this));
      } else
        process.nextTick(onConnect.bind(this));
    else
      socket = connectWithProtocol(protocol, options ? {
        host,
        port: @String(port),
        ALPNProtocols: ["h2"],
        ...options
      } : {
        host,
        port: @String(port),
        ALPNProtocols: ["h2"]
      }, onConnect.bind(this)), this[bunHTTP2Socket] = socket;
    this.#encrypted = socket instanceof TLSSocket;
    let nativeSocket = socket._handle;
    this.#parser = new H2FrameParser({
      native: nativeSocket,
      context: this,
      settings: { ...options, ...options?.settings },
      handlers: ClientHttp2Session.#Handlers
    }), socket.on("data", this.#onRead.bind(this)), socket.on("drain", this.#onDrain.bind(this)), socket.on("close", this.#onClose.bind(this)), socket.on("error", this.#onError.bind(this)), socket.on("timeout", this.#onTimeout.bind(this));
  }
  close(callback) {
    if (this.#closed = !0, typeof callback === "function")
      this.once("close", callback);
    if (this.#connections === 0)
      this.destroy();
  }
  destroy(error, code) {
    let socket = this[bunHTTP2Socket];
    if (this.#closed && !this.#connected && !this.#parser)
      return;
    if (this.#closed = !0, this.#connected = !1, socket)
      this.goaway(code || constants.NGHTTP2_NO_ERROR, 0, @Buffer.alloc(0)), socket.end();
    let parser = this.#parser;
    if (parser)
      parser.emitErrorToAllStreams(code || constants.NGHTTP2_NO_ERROR), parser.detach();
    if (this.#parser = null, this[bunHTTP2Socket] = null, error)
      this.emit("error", error);
    this.emit("close");
  }
  request(headers, options) {
    try {
      if (this.destroyed || this.closed)
        throw @makeErrorWithCode(90);
      if (this.sentTrailers)
        throw @makeErrorWithCode(107);
      if (headers == @undefined)
        headers = {};
      else if (!@isObject(headers))
        throw @makeErrorWithCode(118, "headers", "object", headers);
      else
        headers = { ...headers };
      let sensitives = headers[sensitiveHeaders];
      delete headers[sensitiveHeaders];
      let sensitiveNames = {};
      if (sensitives) {
        if (!@isArray(sensitives))
          throw @makeErrorWithCode(119, "headers[http2.neverIndex]", sensitives);
        for (let i = 0;i < sensitives.length; i++)
          sensitiveNames[sensitives[i]] = !0;
      }
      let url = this.#url, authority = headers[":authority"];
      if (!authority) {
        if (authority = this.#authority, !headers.host)
          headers[":authority"] = authority;
      }
      let method = headers[":method"];
      if (!method)
        method = "GET", headers[":method"] = method;
      let scheme = headers[":scheme"];
      if (!scheme) {
        let protocol = url.protocol || options?.protocol || "https:";
        switch (protocol) {
          case "https:":
            scheme = "https";
            break;
          case "http:":
            scheme = "http";
            break;
          default:
            scheme = protocol;
        }
        headers[":scheme"] = scheme;
      }
      if (headers[":path"] == @undefined)
        headers[":path"] = "/";
      if (NoPayloadMethods.has(method.toUpperCase()))
        if (!options || !@isObject(options))
          options = { endStream: !0 };
        else
          options = { ...options, endStream: !0 };
      let stream_id = this.#parser.getNextStream();
      if (stream_id < 0) {
        let req2 = new ClientHttp2Stream(@undefined, this, headers);
        return process.nextTick(emitOutofStreamErrorNT, req2), req2;
      }
      let req = new ClientHttp2Stream(stream_id, this, headers);
      if (req.authority = authority, req[kHeadRequest] = method === HTTP2_METHOD_HEAD, typeof options > "u")
        this.#parser.request(stream_id, req, headers, sensitiveNames);
      else
        this.#parser.request(stream_id, req, headers, sensitiveNames, options);
      return process.nextTick(emitEventNT, req, "ready"), req;
    } catch (e) {
      throw this.#connections--, process.nextTick(emitErrorNT, this, e, this.#connections === 0 && this.#closed), e;
    }
  }
  static connect(url, options, listener) {
    return new ClientHttp2Session(url, options, listener);
  }
  get [bunHTTP2Native]() {
    return this.#parser;
  }
}
function connect(url, options, listener) {
  return ClientHttp2Session.connect(url, options, listener);
}
function setupCompat(ev) {
  if (ev === "request") {
    this.removeListener("newListener", setupCompat);
    let options = this[bunSocketServerOptions], ServerRequest = options?.Http2ServerRequest || Http2ServerRequest, ServerResponse = options?.Http2ServerResponse || Http2ServerResponse;
    this.on("stream", FunctionPrototypeBind.@call(onServerStream, this, ServerRequest, ServerResponse));
  }
}
function sessionOnError(error) {
  this[kServer]?.emit("sessionError", error, this);
}
function sessionOnTimeout() {
  if (this.destroyed || this.closed)
    return;
  if (!this[kServer].emit("timeout", this))
    this.destroy();
}
function closeAllSessions(server) {
  let sessions = server[kSessions];
  if (sessions.size > 0)
    for (let session of sessions)
      session.close();
}
function connectionListener(socket) {
  let options = this[bunSocketServerOptions] || {};
  if (socket.alpnProtocol === !1 || socket.alpnProtocol === "http/1.1") {
    if (!this.emit("unknownProtocol", socket)) {
      let timer = setTimeout(() => {
        if (!socket.destroyed)
          socket.destroy();
      }, options.unknownProtocolTimeout);
      timer.unref(), socket.once("close", () => clearTimeout(timer)), socket.end("HTTP/1.0 403 Forbidden\r\nContent-Type: text/plain\r\n\r\nMissing ALPN Protocol, expected `h2` to be available.\nIf this is a HTTP request: The server was not configured with the `allowHTTP1` option or a listener for the `unknownProtocol` event.\n");
    }
    return;
  }
  let session = new ServerHttp2Session(socket, options, this);
  session.on("error", sessionOnError);
  let timeout = this.timeout;
  if (timeout)
    session.setTimeout(timeout, sessionOnTimeout);
  if (this.emit("session", session), options.origins && @isArray(options.origins))
    try {
      session.origin(...options.origins);
    } catch (e) {
      session.emit("frameError", HTTP2_HEADER_ORIGIN, e, 0);
    }
}
function initializeOptions(options) {
  if (assertIsObject(options, "options"), options = { ...options }, assertIsObject(options.settings, "options.settings"), options.settings = { ...options.settings }, assertIsArray(options.remoteCustomSettings, "options.remoteCustomSettings"), options.remoteCustomSettings) {
    if (options.remoteCustomSettings = [...options.remoteCustomSettings], options.remoteCustomSettings.length > 10)
      throw @makeErrorWithCode(109);
  }
  if (options.maxSessionInvalidFrames !== @undefined)
    validateUint32(options.maxSessionInvalidFrames, "maxSessionInvalidFrames");
  if (options.maxSessionRejectedStreams !== @undefined)
    validateUint32(options.maxSessionRejectedStreams, "maxSessionRejectedStreams");
  if (options.unknownProtocolTimeout !== @undefined)
    validateUint32(options.unknownProtocolTimeout, "unknownProtocolTimeout");
  else
    options.unknownProtocolTimeout = 1e4;
  return options.Http2ServerRequest ||= Http2ServerRequest, options.Http2ServerResponse ||= Http2ServerResponse, options;
}

class Http2Server extends net.Server {
  timeout = 0;
  [kSessions] = new SafeSet;
  constructor(options, onRequestHandler) {
    if (typeof options === "function")
      onRequestHandler = options, options = {};
    options = initializeOptions(options);
    super(options);
    if (this[kSessions] = new SafeSet, this[kOptions] = { settings: options.settings || {} }, this.setMaxListeners(0), this.on("newListener", setupCompat), typeof onRequestHandler === "function")
      this.on("request", onRequestHandler);
  }
  emit(event, ...args) {
    if (event === "connection")
      super.prependOnceListener("connection", connectionListener);
    return super.emit(event, ...args);
  }
  setTimeout(ms, callback) {
    if (this.timeout = ms, typeof callback === "function")
      this.on("timeout", callback);
    return this;
  }
  updateSettings(settings) {
    assertSettings(settings);
    let options = this[bunSocketServerOptions];
    if (options)
      options.settings = { ...options.settings, ...settings };
    this[kOptions].settings = { ...this[kOptions].settings, ...settings };
  }
  close(callback) {
    super.close(callback), closeAllSessions(this);
  }
}
Http2Server.prototype[EventEmitter.captureRejectionSymbol] = function(err, event, ...args) {
  switch (event) {
    case "stream": {
      let { 0: stream } = args;
      if (stream.sentHeaders)
        stream.destroy(err);
      else
        stream.respond({ [HTTP2_HEADER_STATUS]: 500 }), stream.end();
      break;
    }
    case "request": {
      let { 1: res } = args;
      if (!res.headersSent && !res.finished) {
        for (let name of res.getHeaderNames())
          res.removeHeader(name);
        res.statusCode = 500, res.end(STATUS_CODES[500]);
      } else
        res.destroy();
      break;
    }
    default:
      break;
  }
};
function onErrorSecureServerSession(err, socket) {
  if (!this.emit("clientError", err, socket))
    socket.destroy(err);
}
function emitFrameErrorEventNT(stream, frameType, errorCode) {
  stream.emit("frameError", frameType, errorCode);
}

class Http2SecureServer extends tls.Server {
  timeout = 0;
  [kSessions] = new SafeSet;
  constructor(options, onRequestHandler) {
    if (typeof options < "u")
      if (options && typeof options === "object")
        options = { ...options, ALPNProtocols: ["h2"] };
      else
        throw @makeErrorWithCode(118, "options", "object", options);
    else
      options = { ALPNProtocols: ["h2"] };
    let settings = options.settings;
    if (typeof settings < "u")
      validateObject(settings, "options.settings");
    if (options.maxSessionInvalidFrames !== @undefined)
      validateUint32(options.maxSessionInvalidFrames, "maxSessionInvalidFrames");
    if (options.maxSessionRejectedStreams !== @undefined)
      validateUint32(options.maxSessionRejectedStreams, "maxSessionRejectedStreams");
    super(options, connectionListener);
    if (this[kSessions] = new SafeSet, this[kOptions] = { settings: settings || {} }, this.setMaxListeners(0), this.on("newListener", setupCompat), typeof onRequestHandler === "function")
      this.on("request", onRequestHandler);
    this.on("tlsClientError", onErrorSecureServerSession);
  }
  emit(event, ...args) {
    if (event === "connection") {
      let socket = args[0];
      if (socket && !(socket instanceof TLSSocket))
        return upgradeRawSocketToH2(connectionListener, this, socket);
    }
    return super.emit(event, ...args);
  }
  setTimeout(ms, callback) {
    if (this.timeout = ms, typeof callback === "function")
      this.on("timeout", callback);
    return this;
  }
  updateSettings(settings) {
    assertSettings(settings);
    let options = this[bunSocketServerOptions];
    if (options)
      options.settings = { ...options.settings, ...settings };
    this[kOptions].settings = { ...this[kOptions].settings, ...settings };
  }
  close(callback) {
    super.close(callback), closeAllSessions(this);
  }
}
function createServer(options, onRequestHandler) {
  return new Http2Server(options, onRequestHandler);
}
function createSecureServer(options, onRequestHandler) {
  return new Http2SecureServer(options, onRequestHandler);
}
function getDefaultSettings() {
  return getUnpackedSettings();
}
Object.defineProperty(connect, promisify.custom, {
  __proto__: null,
  value: function(authority, options) {
    let { promise, resolve, reject } = @Promise.withResolvers(), server = connect(authority, options, () => {
      return server.removeListener("error", reject), resolve(server);
    });
    return server.once("error", reject), promise;
  }
});
$ = {
  constants,
  createServer,
  createSecureServer,
  getDefaultSettings,
  getPackedSettings,
  getUnpackedSettings,
  sensitiveHeaders,
  Http2ServerRequest,
  Http2ServerResponse,
  connect,
  ClientHttp2Session
};
hideFromStack([
  Http2ServerRequest,
  Http2ServerResponse,
  connect,
  createServer,
  createSecureServer,
  getDefaultSettings,
  getPackedSettings,
  getUnpackedSettings,
  ClientHttp2Session,
  ClientHttp2Stream
]);
return $})

