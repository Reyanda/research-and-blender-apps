(function (){"use strict";// build/release/tmp_modules/node/_http_outgoing.ts
var $, { Stream } = @getInternalField(@internalModuleRegistry, 40) || @createInternalModuleById(40), { isUint8Array, validateString } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), { deprecate } = @getInternalField(@internalModuleRegistry, 65) || @createInternalModuleById(65), ObjectDefineProperty = Object.defineProperty, ObjectKeys = Object.keys, {
  headerStateSymbol,
  NodeHTTPHeaderState,
  kAbortController,
  fakeSocketSymbol,
  headersSymbol,
  kBodyChunks,
  kEmitState,
  ClientRequestEmitState,
  kEmptyObject,
  kHandle,
  getHeader,
  setHeader,
  Headers,
  getRawKeys,
  kOutHeaders
} = @getInternalField(@internalModuleRegistry, 25) || @createInternalModuleById(25), {
  validateHeaderName,
  validateHeaderValue,
  _checkInvalidHeaderChar: checkInvalidHeaderChar
} = @getInternalField(@internalModuleRegistry, 73) || @createInternalModuleById(73), kUniqueHeaders = Symbol("kUniqueHeaders"), kBytesWritten = Symbol("kBytesWritten"), kRejectNonStandardBodyWrites = Symbol("kRejectNonStandardBodyWrites"), kCorked = Symbol("corked"), kChunkedBuffer = Symbol("kChunkedBuffer"), kHighWaterMark = Symbol("kHighWaterMark"), kChunkedLength = Symbol("kChunkedLength"), { FakeSocket } = @getInternalField(@internalModuleRegistry, 26) || @createInternalModuleById(26), nop = () => {};
function emitErrorNt(msg, err, callback) {
  if (callback(err), typeof msg.emit === "function" && !msg.destroyed)
    msg.emit("error", err);
}
function onError(msg, err, callback) {
  if (msg.destroyed)
    return;
  process.nextTick(emitErrorNt, msg, err, callback);
}
function isHTTPHeaderStateSentOrAssigned(state) {
  return state === NodeHTTPHeaderState.sent || state === NodeHTTPHeaderState.assigned;
}
function throwHeadersSentIfNecessary(self, action) {
  if (self._header != null || isHTTPHeaderStateSentOrAssigned(self[headerStateSymbol]))
    throw @makeErrorWithCode(69, action);
}
function write_(msg, chunk, encoding, callback, fromEnd) {
  if (typeof callback !== "function")
    callback = nop;
  if (chunk === null)
    throw @makeErrorWithCode(229);
  else if (typeof chunk !== "string" && !isUint8Array(chunk))
    throw @makeErrorWithCode(118, "chunk", ["string", "Buffer", "Uint8Array"], chunk);
  let err;
  if (msg.finished)
    err = @makeErrorWithCode(236);
  else if (msg.destroyed)
    err = @makeErrorWithCode(228, "write");
  if (err) {
    if (!msg.destroyed)
      onError(msg, err, callback);
    else
      process.nextTick(callback, err);
    return !1;
  }
  let len;
  if (msg.strictContentLength) {
    if (len ??= typeof chunk === "string" ? @Buffer.byteLength(chunk, encoding) : chunk.byteLength, strictContentLength(msg) && (fromEnd ? msg[kBytesWritten] + len !== msg._contentLength : msg[kBytesWritten] + len > msg._contentLength))
      throw Error(`Response body's content-length of ${len + msg[kBytesWritten]} byte(s) does not match the content-length of ${msg._contentLength} byte(s) set in header`);
    msg[kBytesWritten] += len;
  } else
    len ??= typeof chunk === "string" ? @Buffer.byteLength(chunk, encoding) : chunk.byteLength, msg[kBytesWritten] += len;
  function connectionUnCorkNT(conn) {
    conn.uncork();
  }
  let lazyCrlfBuf;
  function getCrlfBuf() {
    if (!lazyCrlfBuf)
      lazyCrlfBuf = @Buffer.from(`\r
`);
    return lazyCrlfBuf;
  }
  function strictContentLength(msg2) {
    return msg2.strictContentLength && msg2._contentLength != null && msg2._hasBody && !msg2._removedContLen && !msg2.chunkedEncoding && !msg2.hasHeader("transfer-encoding");
  }
  if (!msg._header) {
    if (fromEnd)
      len ??= typeof chunk === "string" ? @Buffer.byteLength(chunk, encoding) : chunk.byteLength, msg._contentLength = len;
    msg._implicitHeader();
  }
  if (!msg._hasBody)
    if (msg[kRejectNonStandardBodyWrites])
      throw @makeErrorWithCode(68);
    else
      return process.nextTick(callback), !0;
  if (!fromEnd && msg.socket && !msg.socket.writableCorked)
    msg.socket.cork(), process.nextTick(connectionUnCorkNT, msg.socket);
  let ret;
  if (msg.chunkedEncoding && chunk.length !== 0)
    if (len ??= typeof chunk === "string" ? @Buffer.byteLength(chunk, encoding) : chunk.byteLength, msg[kCorked] && msg._headerSent)
      msg[kChunkedBuffer].push(chunk, encoding, callback), msg[kChunkedLength] += len, ret = msg[kChunkedLength] < msg[kHighWaterMark];
    else {
      let crlf_buf = getCrlfBuf();
      msg._send(len.toString(16), "latin1", null), msg._send(crlf_buf, null, null), msg._send(chunk, encoding, null, len), ret = msg._send(crlf_buf, null, callback);
    }
  else
    ret = msg._send(chunk, encoding, callback, len);
  return ret;
}
function OutgoingMessage(options) {
  if (!new.target)
    return new OutgoingMessage(options);
  Stream.@call(this, options), this.sendDate = !0, this.finished = !1, this[headerStateSymbol] = NodeHTTPHeaderState.none, this[kAbortController] = null, this[kBytesWritten] = 0, this.writable = !0, this.destroyed = !1, this._hasBody = !0, this._trailer = "", this._contentLength = null, this._closed = !1, this._header = null, this._headerSent = !1, this[kHighWaterMark] = options?.highWaterMark ?? 65536;
}
var OutgoingMessagePrototype = {
  constructor: OutgoingMessage,
  __proto__: Stream.prototype,
  _keepAliveTimeout: 0,
  _defaultKeepAlive: !0,
  shouldKeepAlive: !0,
  _onPendingData: function nop2() {},
  outputSize: 0,
  outputData: [],
  strictContentLength: !1,
  _removedTE: !1,
  _removedContLen: !1,
  _removedConnection: !1,
  usesChunkedEncodingByDefault: !0,
  _closed: !1,
  _headerNames: @undefined,
  appendHeader(name, value) {
    validateString(name, "name");
    var headers = this[headersSymbol] ??= new Headers;
    return headers.append(name, value), this;
  },
  _implicitHeader() {
    throw @makeErrorWithCode(149, "_implicitHeader()");
  },
  flushHeaders() {},
  getHeader(name) {
    return validateString(name, "name"), getHeader(this[headersSymbol], name);
  },
  write(chunk, encoding, callback) {
    if (typeof encoding === "function")
      callback = encoding, encoding = null;
    return write_(this, chunk, encoding, callback, !1);
  },
  pipe() {
    this.emit("error", @makeErrorWithCode(227));
  },
  getHeaderNames() {
    var headers = this[headersSymbol];
    if (!headers)
      return [];
    return @Array.from(headers.keys());
  },
  getRawHeaderNames() {
    var headers = this[headersSymbol];
    if (!headers)
      return [];
    return getRawKeys.@call(headers);
  },
  getHeaders() {
    let headers = this[headersSymbol];
    if (!headers)
      return kEmptyObject;
    return headers.toJSON();
  },
  removeHeader(name) {
    validateString(name, "name"), throwHeadersSentIfNecessary(this, "remove");
    let headers = this[headersSymbol];
    if (!headers)
      return;
    headers.delete(name);
  },
  setHeader(name, value) {
    throwHeadersSentIfNecessary(this, "set"), validateHeaderName(name), validateHeaderValue(name, value);
    let headers = this[headersSymbol] ??= new Headers;
    return setHeader(headers, name, value), this;
  },
  setHeaders(headers) {
    if (throwHeadersSentIfNecessary(this, "set"), !headers || @isArray(headers) || typeof headers.keys !== "function" || typeof headers.get !== "function")
      throw @makeErrorWithCode(118, "headers", ["Headers", "Map"], headers);
    let cookies = [];
    for (let { 0: key, 1: value } of headers) {
      if (key === "set-cookie") {
        if (@isArray(value))
          cookies.push(...value);
        else
          cookies.push(value);
        continue;
      }
      this.setHeader(key, value);
    }
    if (cookies.length)
      this.setHeader("set-cookie", cookies);
    return this;
  },
  hasHeader(name) {
    validateString(name, "name");
    let headers = this[headersSymbol];
    if (!headers)
      return !1;
    return headers.has(name);
  },
  get headers() {
    let headers = this[headersSymbol];
    if (!headers)
      return kEmptyObject;
    return headers.toJSON();
  },
  set headers(value) {
    this[headersSymbol] = new Headers(value);
  },
  addTrailers(headers) {
    this._trailer = "";
    let keys = Object.keys(headers), isArray = @isArray(headers);
    for (let i = 0, l = keys.length;i < l; i++) {
      let field, value, key = keys[i];
      if (isArray)
        field = headers[key][0], value = headers[key][1];
      else
        field = key, value = headers[key];
      validateHeaderName(field, "Trailer name");
      let isArrayValue = @isArray(value);
      if (isArrayValue && value.length > 1 && (!this[kUniqueHeaders] || !this[kUniqueHeaders].has(field.toLowerCase())))
        for (let j = 0, l2 = value.length;j < l2; j++) {
          if (checkInvalidHeaderChar(value[j]))
            throw @makeErrorWithCode(121, "trailer content", field);
          this._trailer += field + ": " + value[j] + `\r
`;
        }
      else {
        if (isArrayValue)
          value = value.join("; ");
        if (checkInvalidHeaderChar(value))
          throw @makeErrorWithCode(121, "trailer content", field);
        this._trailer += field + ": " + value + `\r
`;
      }
    }
  },
  setTimeout(msecs, callback) {
    if (this.callback)
      this.emit("timeout", callback);
    if (!this[fakeSocketSymbol])
      this.once("socket", function socketSetTimeoutOnConnect(socket) {
        socket.setTimeout(msecs, callback);
      });
    else
      this.socket.setTimeout(msecs);
    return this;
  },
  get connection() {
    return this.socket;
  },
  set connection(value) {
    this.socket = value;
  },
  get socket() {
    return this[fakeSocketSymbol] = this[fakeSocketSymbol] ?? new FakeSocket(this), this[fakeSocketSymbol];
  },
  set socket(value) {
    this[fakeSocketSymbol] = value;
  },
  get chunkedEncoding() {
    return !1;
  },
  set chunkedEncoding(value) {},
  get writableObjectMode() {
    return !1;
  },
  get writableLength() {
    return this.finished ? 0 : this[kBytesWritten] || 0;
  },
  get writableHighWaterMark() {
    return 16384;
  },
  get writableNeedDrain() {
    return !this.destroyed && !this.finished && this[kBodyChunks] && this[kBodyChunks].length > 0;
  },
  get writableEnded() {
    return this.finished;
  },
  get writableFinished() {
    return this.finished && !!(this[kEmitState] & 1 << ClientRequestEmitState.finish);
  },
  _send(data, encoding, callback, byteLength) {
    if (!this._headerSent && this._header !== null) {
      if (typeof data === "string" && (encoding === "utf8" || encoding === "latin1" || !encoding))
        data = this._header + data;
      else {
        let header = this._header;
        this.outputData.unshift({
          data: header,
          encoding: "latin1",
          callback: null
        }), this.outputSize += header.length, this._onPendingData(header.length);
      }
      this._headerSent = !0;
    }
    return this._writeRaw(data, encoding, callback, byteLength);
  },
  _writeRaw(data, encoding, callback, _size) {
    let conn = this[kHandle];
    if (conn?.destroyed)
      return !1;
    if (typeof encoding === "function")
      callback = encoding, encoding = null;
    if (conn && conn._httpMessage === this && conn.writable) {
      if (this.outputData.length)
        this._flushOutput(conn);
      return conn.write(data, encoding, callback);
    }
    return this.outputData.push({ data, encoding, callback }), this.outputSize += data.length, this._onPendingData(data.length), this.outputSize < this[kHighWaterMark];
  },
  end(_chunk, _encoding, _callback) {
    return this;
  },
  get writableCorked() {
    return this.socket.writableCorked;
  },
  set writableCorked(value) {},
  cork() {
    this.socket.cork();
  },
  uncork() {
    this.socket.uncork();
  },
  destroy(_err) {
    if (this.destroyed)
      return this;
    let handle = this[kHandle];
    if (this.destroyed = !0, handle)
      handle.abort();
    return this;
  }
};
OutgoingMessage.prototype = OutgoingMessagePrototype;
ObjectDefineProperty(OutgoingMessage.prototype, "_headerNames", {
  __proto__: null,
  get: deprecate(function() {
    let headers = this.getHeaders();
    if (headers !== null) {
      let out = Object.create(null), keys = ObjectKeys(headers);
      for (let i = 0;i < keys.length; ++i) {
        let key = keys[i];
        out[key] = key;
      }
      return out;
    }
    return null;
  }, "OutgoingMessage.prototype._headerNames is deprecated", "DEP0066"),
  set: deprecate(function(val) {
    if (typeof val === "object" && val !== null) {
      let headers = this.getHeaders();
      if (!headers)
        return;
      let keys = ObjectKeys(val);
      for (let i = 0;i < keys.length; ++i) {
        let header = headers[keys[i]];
        if (header)
          header[keys[i]] = val[keys[i]];
      }
    }
  }, "OutgoingMessage.prototype._headerNames is deprecated", "DEP0066")
});
ObjectDefineProperty(OutgoingMessage.prototype, "_headers", {
  __proto__: null,
  get: deprecate(function() {
    return this.getHeaders();
  }, "OutgoingMessage.prototype._headers is deprecated", "DEP0066"),
  set: deprecate(function(val) {
    if (val == null)
      this[kOutHeaders] = null;
    else if (typeof val === "object") {
      let headers = this[kOutHeaders] = Object.create(null), keys = ObjectKeys(val);
      for (let i = 0;i < keys.length; ++i) {
        let name = keys[i];
        headers[name.toLowerCase()] = [name, val[name]];
      }
    }
  }, "OutgoingMessage.prototype._headers is deprecated", "DEP0066")
});
@setPrototypeDirect.@call(OutgoingMessage, Stream);
$ = {
  OutgoingMessage,
  FakeSocket,
  OutgoingMessagePrototype
};
return $})

