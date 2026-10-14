(function (){"use strict";// build/release/tmp_modules/node/_http_incoming.ts
var $, Readable = @getInternalField(@internalModuleRegistry, 55) || @createInternalModuleById(55), {
  abortedSymbol,
  eofInProgress,
  kHandle,
  noBodySymbol,
  typeSymbol,
  NodeHTTPIncomingRequestType,
  fakeSocketSymbol,
  isAbortError,
  emitErrorNextTickIfErrorListenerNT,
  kEmptyObject,
  getIsNextIncomingMessageHTTPS,
  setIsNextIncomingMessageHTTPS,
  NodeHTTPBodyReadState,
  emitEOFIncomingMessage,
  bodyStreamSymbol,
  statusMessageSymbol,
  statusCodeSymbol,
  webRequestOrResponse,
  NodeHTTPResponseAbortEvent,
  STATUS_CODES,
  assignHeadersFast,
  setRequestTimeout,
  headersTuple,
  webRequestOrResponseHasBodyValue,
  getCompleteWebRequestOrResponseBodyValueAsArrayBuffer,
  kAbortController
} = @getInternalField(@internalModuleRegistry, 25) || @createInternalModuleById(25), { FakeSocket } = @getInternalField(@internalModuleRegistry, 26) || @createInternalModuleById(26), defaultIncomingOpts = { type: "request" }, nop = () => {};
function assignHeadersSlow(object, req) {
  let headers = req.headers;
  var outHeaders = Object.create(null);
  let rawHeaders = [];
  var i = 0;
  for (let key in headers) {
    var originalKey = key, value = headers[originalKey];
    if (key = key.toLowerCase(), key !== "set-cookie")
      value = @String(value), @putByValDirect(rawHeaders, i++, originalKey), @putByValDirect(rawHeaders, i++, value), outHeaders[key] = value;
    else if (@isJSArray(value)) {
      outHeaders[key] = value.slice();
      for (let entry of value)
        @putByValDirect(rawHeaders, i++, originalKey), @putByValDirect(rawHeaders, i++, entry);
    } else
      value = @String(value), outHeaders[key] = [value], @putByValDirect(rawHeaders, i++, originalKey), @putByValDirect(rawHeaders, i++, value);
  }
  object.headers = outHeaders, object.rawHeaders = rawHeaders;
}
function assignHeaders(object, req) {
  if (assignHeadersFast(req, object, headersTuple)) {
    let headers = @getInternalField(headersTuple, 0), rawHeaders = @getInternalField(headersTuple, 1);
    return @putInternalField(headersTuple, 0, @undefined), @putInternalField(headersTuple, 1, @undefined), object.headers = headers, object.rawHeaders = rawHeaders, !0;
  } else
    return assignHeadersSlow(object, req), !1;
}
function onIncomingMessagePauseNodeHTTPResponse() {
  let handle = this[kHandle];
  if (handle && !this.destroyed)
    handle.pause();
}
function onIncomingMessageResumeNodeHTTPResponse() {
  let handle = this[kHandle];
  if (handle && !this.destroyed) {
    let resumed = handle.resume();
    if (resumed && resumed !== !0) {
      if ((handle.hasBody & NodeHTTPBodyReadState.done) !== 0)
        emitEOFIncomingMessage(this);
      this.push(resumed);
    }
  }
}
function IncomingMessage(req, options = defaultIncomingOpts) {
  if (this[abortedSymbol] = !1, this[eofInProgress] = !1, this._consuming = !1, this._dumped = !1, this.complete = !1, this._closed = !1, req === kHandle) {
    if (this[typeSymbol] = NodeHTTPIncomingRequestType.NodeHTTPResponse, this.url = arguments[1], this.method = arguments[2], this.headers = arguments[3], this.rawHeaders = arguments[4], this[kHandle] = arguments[5], this[noBodySymbol] = !arguments[6], this[fakeSocketSymbol] = arguments[7], Readable.@call(this), arguments[6])
      this.on("pause", onIncomingMessagePauseNodeHTTPResponse), this.on("resume", onIncomingMessageResumeNodeHTTPResponse);
  } else {
    this[noBodySymbol] = !1, Readable.@call(this);
    var { [typeSymbol]: type } = options || {};
    this[webRequestOrResponse] = req, this[typeSymbol] = type, this[bodyStreamSymbol] = @undefined;
    let statusText = req?.statusText;
    if (this[statusMessageSymbol] = statusText !== "" ? statusText || null : "", this[statusCodeSymbol] = req?.status || 200, type === NodeHTTPIncomingRequestType.FetchRequest || type === NodeHTTPIncomingRequestType.FetchResponse) {
      if (!assignHeaders(this, req))
        this[fakeSocketSymbol] = req;
    } else
      this.url = "", this.method = null, this.rawHeaders = [];
    if (this[noBodySymbol] = type === NodeHTTPIncomingRequestType.FetchRequest ? requestHasNoBody(this.method, this) : !1, getIsNextIncomingMessageHTTPS())
      this.socket.encrypted = !0, setIsNextIncomingMessageHTTPS(!1);
  }
  this._readableState.readingMore = !0;
}
function onDataIncomingMessage(chunk, isLast, aborted) {
  if (aborted === NodeHTTPResponseAbortEvent.abort) {
    this.destroy();
    return;
  }
  if (chunk && !this._dumped)
    this.push(chunk);
  if (isLast)
    emitEOFIncomingMessage(this);
}
var IncomingMessagePrototype = {
  constructor: IncomingMessage,
  __proto__: Readable.prototype,
  httpVersion: "1.1",
  _construct(callback) {
    if (this[typeSymbol] === NodeHTTPIncomingRequestType.FetchResponse) {
      if (!webRequestOrResponseHasBodyValue(this[webRequestOrResponse]))
        this.complete = !0, this.push(null);
    }
    callback();
  },
  _dump() {
    if (!this._dumped) {
      this._dumped = !0, this.removeAllListeners("data");
      let handle = this[kHandle];
      if (handle)
        handle.ondata = @undefined;
      this.resume();
    }
  },
  _read(_size) {
    if (!this._consuming)
      this._readableState.readingMore = !1, this._consuming = !0;
    let socket = this.socket;
    if (socket && socket.readable)
      socket.resume();
    if (this[eofInProgress])
      return;
    let internalRequest;
    if (this[noBodySymbol]) {
      emitEOFIncomingMessage(this);
      return;
    } else if (internalRequest = this[kHandle]) {
      let bodyReadState = internalRequest.hasBody;
      if ((bodyReadState & NodeHTTPBodyReadState.done) !== 0 || bodyReadState === NodeHTTPBodyReadState.none || this._dumped)
        emitEOFIncomingMessage(this);
      if ((bodyReadState & NodeHTTPBodyReadState.hasBufferedDataDuringPause) !== 0) {
        let drained = internalRequest.drainRequestBody();
        if (drained && !this._dumped)
          this.push(drained);
      }
      if (!internalRequest.ondata)
        internalRequest.ondata = onDataIncomingMessage.bind(this), internalRequest.hasCustomOnData = !1;
      return !0;
    } else if (this[bodyStreamSymbol] == null) {
      let completeBody = getCompleteWebRequestOrResponseBodyValueAsArrayBuffer(this[webRequestOrResponse]);
      if (completeBody) {
        if (!this._dumped)
          this.push(new @Buffer(completeBody));
        emitEOFIncomingMessage(this);
        return;
      }
      let reader = this[webRequestOrResponse].body?.getReader?.();
      if (!reader) {
        emitEOFIncomingMessage(this);
        return;
      }
      this[bodyStreamSymbol] = reader, consumeStream(this, reader);
    }
    return;
  },
  _finish() {
    this.emit("prefinish");
  },
  _destroy: function IncomingMessage_destroy(err, cb) {
    let shouldEmitAborted = !this.readableEnded || !this.complete;
    if (shouldEmitAborted)
      this[abortedSymbol] = !0, this.emit("aborted");
    if (isAbortError(err))
      err = @undefined;
    var nodeHTTPResponse = this[kHandle];
    if (nodeHTTPResponse) {
      if (this[kHandle] = @undefined, nodeHTTPResponse.onabort = nodeHTTPResponse.ondata = @undefined, !nodeHTTPResponse.finished && shouldEmitAborted)
        nodeHTTPResponse.abort();
      let socket = this.socket;
      if (socket && !socket.destroyed && shouldEmitAborted)
        socket.destroy(err);
    } else {
      let stream = this[bodyStreamSymbol];
      this[bodyStreamSymbol] = @undefined;
      let streamState = stream?.@state;
      if (streamState === 4 || streamState === 5 || streamState === 6)
        stream?.cancel?.().catch(nop);
      let socket = this.socket;
      if (socket && !socket.destroyed && shouldEmitAborted)
        socket.destroy(err);
    }
    let req = this.req;
    if (req && !this.complete)
      req[kAbortController]?.abort?.();
    if (@isCallable(cb))
      emitErrorNextTickIfErrorListenerNT(this, err, cb);
  },
  get aborted() {
    return this[abortedSymbol];
  },
  set aborted(value) {
    this[abortedSymbol] = value;
  },
  get connection() {
    return this[fakeSocketSymbol] ??= new FakeSocket(this);
  },
  get statusCode() {
    return this[statusCodeSymbol];
  },
  set statusCode(value) {
    if (!(value in STATUS_CODES))
      return;
    this[statusCodeSymbol] = value;
  },
  get statusMessage() {
    return this[statusMessageSymbol];
  },
  set statusMessage(value) {
    this[statusMessageSymbol] = value;
  },
  get httpVersionMajor() {
    if (this.httpVersion.startsWith("1."))
      return 1;
    return 0;
  },
  set httpVersionMajor(value) {},
  get httpVersionMinor() {
    if (this.httpVersion.endsWith(".1"))
      return 1;
    return 0;
  },
  set httpVersionMinor(value) {},
  get rawTrailers() {
    return [];
  },
  set rawTrailers(value) {},
  get trailers() {
    return kEmptyObject;
  },
  set trailers(value) {},
  setTimeout(msecs, callback) {
    this.take;
    let req = this[kHandle] || this[webRequestOrResponse];
    if (req) {
      if (setRequestTimeout(req, Math.ceil(msecs / 1000)), typeof callback === "function")
        this.once("timeout", callback);
    }
    return this;
  },
  get socket() {
    return this[fakeSocketSymbol] ??= new FakeSocket(this);
  },
  set socket(value) {
    this[fakeSocketSymbol] = value;
  }
};
IncomingMessage.prototype = IncomingMessagePrototype;
@setPrototypeDirect.@call(IncomingMessage, Readable);
function requestHasNoBody(method, req) {
  if (method === "GET" || method === "HEAD" || method === "TRACE" || method === "CONNECT" || method === "OPTIONS")
    return !0;
  let contentLength = req?.headers?.["content-length"];
  if (!parseInt(contentLength, 10))
    return !0;
  return !1;
}
async function consumeStream(self, reader) {
  var done = !1, value, aborted = !1;
  try {
    while (!0) {
      let result = reader.readMany();
      if (@isPromise(result))
        ({ done, value } = await result);
      else
        ({ done, value } = result);
      if (self.destroyed || (aborted = self[abortedSymbol]))
        break;
      if (!self._dumped)
        for (var v of value)
          self.push(v);
      if (self.destroyed || (aborted = self[abortedSymbol]) || done)
        break;
    }
  } catch (err) {
    if (aborted || self.destroyed)
      return;
    self.destroy(err);
  } finally {
    reader?.cancel?.().catch?.(nop);
  }
  if (!self.complete)
    emitEOFIncomingMessage(self);
}
function readStart(socket) {
  if (socket && !socket._paused && socket.readable)
    socket.resume();
}
function readStop(socket) {
  if (socket)
    socket.pause();
}
return{
  readStop,
  readStart,
  IncomingMessage
};})

