(function (){"use strict";// build/release/tmp_modules/internal/http.ts
var $, { isIPv4 } = @getInternalField(@internalModuleRegistry, 28) || @createInternalModuleById(28), {
  getHeader,
  setHeader,
  Headers,
  assignHeaders: assignHeadersFast,
  setRequestTimeout,
  headersTuple,
  webRequestOrResponseHasBodyValue,
  setServerCustomOptions,
  getCompleteWebRequestOrResponseBodyValueAsArrayBuffer,
  drainMicrotasks,
  setServerIdleTimeout
} = @lazy(9), getRawKeys = @lazy(10), kDeprecatedReplySymbol = Symbol("deprecatedReply"), kBodyChunks = Symbol("bodyChunks"), kPath = Symbol("path"), kPort = Symbol("port"), kMethod = Symbol("method"), kHost = Symbol("host"), kProtocol = Symbol("protocol"), kAgent = Symbol("agent"), kFetchRequest = Symbol("fetchRequest"), kTls = Symbol("tls"), kUseDefaultPort = Symbol("useDefaultPort"), kRes = Symbol("res"), kUpgradeOrConnect = Symbol("upgradeOrConnect"), kParser = Symbol("parser"), kMaxHeadersCount = Symbol("maxHeadersCount"), kReusedSocket = Symbol("reusedSocket"), kTimeoutTimer = Symbol("timeoutTimer"), kOptions = Symbol("options"), kSocketPath = Symbol("socketPath"), kSignal = Symbol("signal"), kMaxHeaderSize = Symbol("maxHeaderSize"), abortedSymbol = Symbol("aborted"), kClearTimeout = Symbol("kClearTimeout"), headerStateSymbol = Symbol("headerState"), kEmitState = Symbol("emitState"), bodyStreamSymbol = Symbol("bodyStream"), controllerSymbol = Symbol("controller"), runSymbol = Symbol("run"), deferredSymbol = Symbol("deferred"), eofInProgress = Symbol("eofInProgress"), fakeSocketSymbol = Symbol("fakeSocket"), firstWriteSymbol = Symbol("firstWrite"), headersSymbol = Symbol("headers"), isTlsSymbol = Symbol("is_tls"), kHandle = Symbol("handle"), kRealListen = Symbol("kRealListen"), noBodySymbol = Symbol("noBody"), optionsSymbol = Symbol("options"), reqSymbol = Symbol("req"), timeoutTimerSymbol = Symbol("timeoutTimer"), tlsSymbol = Symbol("tls"), typeSymbol = Symbol("type"), webRequestOrResponse = Symbol("FetchAPI"), statusCodeSymbol = Symbol("statusCode"), kAbortController = Symbol.for("kAbortController"), statusMessageSymbol = Symbol("statusMessage"), kInternalSocketData = Symbol.for("::bunternal::"), serverSymbol = Symbol.for("::bunternal::"), kPendingCallbacks = Symbol("pendingCallbacks"), kRequest = Symbol("request"), kCloseCallback = Symbol("closeCallback"), kDeferredTimeouts = Symbol("deferredTimeouts"), kEmptyObject = Object.freeze(Object.create(null)), ClientRequestEmitState;
((ClientRequestEmitState2) => {
  ClientRequestEmitState2[ClientRequestEmitState2.socket = 1] = "socket";
  ClientRequestEmitState2[ClientRequestEmitState2.prefinish = 2] = "prefinish";
  ClientRequestEmitState2[ClientRequestEmitState2.finish = 3] = "finish";
  ClientRequestEmitState2[ClientRequestEmitState2.response = 4] = "response";
})(ClientRequestEmitState ||= {});
var NodeHTTPResponseAbortEvent;
((NodeHTTPResponseAbortEvent2) => {
  NodeHTTPResponseAbortEvent2[NodeHTTPResponseAbortEvent2.none = 0] = "none";
  NodeHTTPResponseAbortEvent2[NodeHTTPResponseAbortEvent2.abort = 1] = "abort";
  NodeHTTPResponseAbortEvent2[NodeHTTPResponseAbortEvent2.timeout = 2] = "timeout";
})(NodeHTTPResponseAbortEvent ||= {});
var NodeHTTPIncomingRequestType;
((NodeHTTPIncomingRequestType2) => {
  NodeHTTPIncomingRequestType2[NodeHTTPIncomingRequestType2.FetchRequest = 0] = "FetchRequest";
  NodeHTTPIncomingRequestType2[NodeHTTPIncomingRequestType2.FetchResponse = 1] = "FetchResponse";
  NodeHTTPIncomingRequestType2[NodeHTTPIncomingRequestType2.NodeHTTPResponse = 2] = "NodeHTTPResponse";
})(NodeHTTPIncomingRequestType ||= {});
var NodeHTTPBodyReadState;
((NodeHTTPBodyReadState2) => {
  NodeHTTPBodyReadState2[NodeHTTPBodyReadState2.none = 0] = "none";
  NodeHTTPBodyReadState2[NodeHTTPBodyReadState2.pending = 2] = "pending";
  NodeHTTPBodyReadState2[NodeHTTPBodyReadState2.done = 4] = "done";
  NodeHTTPBodyReadState2[NodeHTTPBodyReadState2.hasBufferedDataDuringPause = 8] = "hasBufferedDataDuringPause";
})(NodeHTTPBodyReadState ||= {});
var NodeHTTPResponseFlags;
((NodeHTTPResponseFlags2) => {
  NodeHTTPResponseFlags2[NodeHTTPResponseFlags2.socket_closed = 1] = "socket_closed";
  NodeHTTPResponseFlags2[NodeHTTPResponseFlags2.request_has_completed = 2] = "request_has_completed";
  NodeHTTPResponseFlags2[NodeHTTPResponseFlags2.closed_or_completed = 3] = "closed_or_completed";
})(NodeHTTPResponseFlags ||= {});
var NodeHTTPHeaderState;
((NodeHTTPHeaderState2) => {
  NodeHTTPHeaderState2[NodeHTTPHeaderState2.none = 0] = "none";
  NodeHTTPHeaderState2[NodeHTTPHeaderState2.assigned = 1] = "assigned";
  NodeHTTPHeaderState2[NodeHTTPHeaderState2.sent = 2] = "sent";
})(NodeHTTPHeaderState ||= {});
function emitErrorNextTickIfErrorListenerNT(self, err, cb) {
  process.nextTick(emitErrorNextTickIfErrorListener, self, err, cb);
}
function emitErrorNextTickIfErrorListener(self, err, cb) {
  if (@isCallable(cb))
    if (self.listenerCount("error") == 0)
      cb();
    else
      cb(err);
}
function isAbortError(err) {
  return err?.name === "AbortError";
}
var isNextIncomingMessageHTTPS = !1;
function getIsNextIncomingMessageHTTPS() {
  return isNextIncomingMessageHTTPS;
}
function setIsNextIncomingMessageHTTPS(value) {
  isNextIncomingMessageHTTPS = value;
}
function callCloseCallback(self) {
  if (self[kCloseCallback])
    self[kCloseCallback](), self[kCloseCallback] = @undefined;
}
function emitCloseNT(self) {
  if (!self._closed)
    self.destroyed = !0, self._closed = !0, callCloseCallback(self), self.emit("close");
}
function emitCloseNTAndComplete(self) {
  if (!self._closed)
    self._closed = !0, callCloseCallback(self), self.emit("close");
  self.complete = !0;
}
function emitEOFIncomingMessageOuter(self) {
  self.push(null), self.complete = !0;
}
function emitEOFIncomingMessage(self) {
  self[eofInProgress] = !0, process.nextTick(emitEOFIncomingMessageOuter, self);
}
function validateMsecs(numberlike, field) {
  if (typeof numberlike !== "number" || numberlike < 0)
    throw @makeErrorWithCode(118, field, "number", numberlike);
  return numberlike;
}
var METHODS = [
  "ACL",
  "BIND",
  "CHECKOUT",
  "CONNECT",
  "COPY",
  "DELETE",
  "GET",
  "HEAD",
  "LINK",
  "LOCK",
  "M-SEARCH",
  "MERGE",
  "MKACTIVITY",
  "MKCALENDAR",
  "MKCOL",
  "MOVE",
  "NOTIFY",
  "OPTIONS",
  "PATCH",
  "POST",
  "PROPFIND",
  "PROPPATCH",
  "PURGE",
  "PUT",
  "QUERY",
  "REBIND",
  "REPORT",
  "SEARCH",
  "SOURCE",
  "SUBSCRIBE",
  "TRACE",
  "UNBIND",
  "UNLINK",
  "UNLOCK",
  "UNSUBSCRIBE"
], STATUS_CODES = {
  100: "Continue",
  101: "Switching Protocols",
  102: "Processing",
  103: "Early Hints",
  200: "OK",
  201: "Created",
  202: "Accepted",
  203: "Non-Authoritative Information",
  204: "No Content",
  205: "Reset Content",
  206: "Partial Content",
  207: "Multi-Status",
  208: "Already Reported",
  226: "IM Used",
  300: "Multiple Choices",
  301: "Moved Permanently",
  302: "Found",
  303: "See Other",
  304: "Not Modified",
  305: "Use Proxy",
  307: "Temporary Redirect",
  308: "Permanent Redirect",
  400: "Bad Request",
  401: "Unauthorized",
  402: "Payment Required",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  406: "Not Acceptable",
  407: "Proxy Authentication Required",
  408: "Request Timeout",
  409: "Conflict",
  410: "Gone",
  411: "Length Required",
  412: "Precondition Failed",
  413: "Payload Too Large",
  414: "URI Too Long",
  415: "Unsupported Media Type",
  416: "Range Not Satisfiable",
  417: "Expectation Failed",
  418: "I'm a Teapot",
  421: "Misdirected Request",
  422: "Unprocessable Entity",
  423: "Locked",
  424: "Failed Dependency",
  425: "Too Early",
  426: "Upgrade Required",
  428: "Precondition Required",
  429: "Too Many Requests",
  431: "Request Header Fields Too Large",
  451: "Unavailable For Legal Reasons",
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
  505: "HTTP Version Not Supported",
  506: "Variant Also Negotiates",
  507: "Insufficient Storage",
  508: "Loop Detected",
  509: "Bandwidth Limit Exceeded",
  510: "Not Extended",
  511: "Network Authentication Required"
};
function hasServerResponseFinished(self, chunk, callback) {
  let finished = self.finished;
  if (chunk) {
    let destroyed = self.destroyed;
    if (finished || destroyed) {
      let err;
      if (finished)
        err = @makeErrorWithCode(236);
      else if (destroyed)
        err = @makeErrorWithCode(228, "Stream is destroyed");
      if (!destroyed)
        process.nextTick(emitErrorNt, self, err, callback);
      else if (@isCallable(callback))
        process.nextTick(callback, err);
      return !0;
    }
  } else if (finished) {
    if (@isCallable(callback))
      if (!self.writableFinished)
        self.on("finish", callback);
      else
        callback(@makeErrorWithCode(226, "end"));
    return !0;
  }
  return !1;
}
function emitErrorNt(msg, err, callback) {
  if (@isCallable(callback))
    callback(err);
  if (@isCallable(msg.emit) && !msg.destroyed)
    msg.emit("error", err);
}
var setMaxHTTPHeaderSize = @lazy(11), getMaxHTTPHeaderSize = @lazy(12), kOutHeaders = Symbol("kOutHeaders");
function ipToInt(ip) {
  let octets = ip.split("."), result = 0;
  for (let i = 0;i < octets.length; i++)
    result = (result << 8) + Number.parseInt(octets[i]);
  return result >>> 0;
}

class ProxyConfig {
  href;
  protocol;
  auth;
  bypassList;
  proxyConnectionOptions;
  constructor(proxyUrl, keepAlive, noProxyList) {
    let parsedURL;
    try {
      parsedURL = new URL(proxyUrl);
    } catch {
      throw @makeErrorWithCode(198, `Invalid proxy URL: ${proxyUrl}`);
    }
    let { hostname, port, protocol, username, password } = parsedURL;
    if (this.href = proxyUrl, this.protocol = protocol, username || password) {
      let auth = `${decodeURIComponent(username)}:${decodeURIComponent(password)}`;
      this.auth = `Basic ${@Buffer.from(auth).toString("base64")}`;
    }
    if (noProxyList)
      this.bypassList = noProxyList.split(",").map((entry) => entry.trim().toLowerCase());
    else
      this.bypassList = [];
    this.proxyConnectionOptions = {
      host: hostname[0] === "[" ? hostname.slice(1, -1) : hostname,
      port: port ? Number(port) : protocol === "https:" ? 443 : 80
    };
  }
  shouldUseProxy(hostname, port) {
    let bypassList = this.bypassList;
    if (this.bypassList.length === 0)
      return !0;
    let host = hostname.toLowerCase(), hostWithPort = port ? `${host}:${port}` : host;
    for (let i = 0;i < bypassList.length; i++) {
      let entry = bypassList[i];
      if (entry === "*")
        return !1;
      if (entry === host || entry === hostWithPort)
        return !1;
      if (entry.startsWith(".")) {
        let suffix = entry.substring(1);
        if (host.endsWith(suffix))
          return !1;
      }
      if (entry.startsWith("*.") && host.endsWith(entry.substring(1)))
        return !1;
      if (entry.includes("-") && isIPv4(host)) {
        let { 0: startIP, 1: endIP } = entry.split("-");
        if (startIP = startIP.trim(), endIP = endIP.trim(), startIP && endIP && isIPv4(startIP) && isIPv4(endIP)) {
          let hostInt = ipToInt(host), startInt = ipToInt(startIP), endInt = ipToInt(endIP);
          if (hostInt >= startInt && hostInt <= endInt)
            return !1;
        }
      }
    }
    return !0;
  }
}
function parseProxyConfigFromEnv(env, protocol, keepAlive) {
  if (protocol !== "http:" && protocol !== "https:")
    return null;
  let proxyUrl = protocol === "https:" ? env.https_proxy || env.HTTPS_PROXY : env.http_proxy || env.HTTP_PROXY;
  if (!proxyUrl)
    return null;
  if (proxyUrl.includes("\r") || proxyUrl.includes(`
`))
    throw @makeErrorWithCode(198, `Invalid proxy URL: ${proxyUrl}`);
  if (!proxyUrl.startsWith("http://") && !proxyUrl.startsWith("https://"))
    return null;
  return new ProxyConfig(proxyUrl, keepAlive, env.no_proxy || env.NO_PROXY);
}
function checkShouldUseProxy(proxyConfig, reqOptions) {
  if (!proxyConfig)
    return !1;
  if (reqOptions.socketPath)
    return !1;
  return proxyConfig.shouldUseProxy(reqOptions.host || "localhost", reqOptions.port);
}
function filterEnvForProxies(env) {
  return {
    http_proxy: env.http_proxy,
    HTTP_PROXY: env.HTTP_PROXY,
    https_proxy: env.https_proxy,
    HTTPS_PROXY: env.HTTPS_PROXY,
    no_proxy: env.no_proxy,
    NO_PROXY: env.NO_PROXY
  };
}
return{
  webRequestOrResponseHasBodyValue,
  webRequestOrResponse,
  validateMsecs,
  typeSymbol,
  tlsSymbol,
  timeoutTimerSymbol,
  statusMessageSymbol,
  statusCodeSymbol,
  setServerIdleTimeout,
  setServerCustomOptions,
  setRequestTimeout,
  setMaxHTTPHeaderSize,
  setIsNextIncomingMessageHTTPS,
  setHeader,
  serverSymbol,
  runSymbol,
  reqSymbol,
  parseProxyConfigFromEnv,
  optionsSymbol,
  noBodySymbol,
  kUseDefaultPort,
  kUpgradeOrConnect,
  kTls,
  kTimeoutTimer,
  kSocketPath,
  kSignal,
  kReusedSocket,
  kRes,
  kRequest,
  kRealListen,
  kProtocol,
  kPort,
  kPendingCallbacks,
  kPath,
  kParser,
  kOutHeaders,
  kOptions,
  kMethod,
  kMaxHeadersCount,
  kMaxHeaderSize,
  kInternalSocketData,
  kHost,
  kHandle,
  kFetchRequest,
  kEmptyObject,
  kEmitState,
  kDeprecatedReplySymbol,
  kDeferredTimeouts,
  kCloseCallback,
  kClearTimeout,
  kBodyChunks,
  kAgent,
  kAbortController,
  isTlsSymbol,
  isAbortError,
  headersTuple,
  headersSymbol,
  headerStateSymbol,
  hasServerResponseFinished,
  getRawKeys,
  getMaxHTTPHeaderSize,
  getIsNextIncomingMessageHTTPS,
  getHeader,
  getCompleteWebRequestOrResponseBodyValueAsArrayBuffer,
  firstWriteSymbol,
  filterEnvForProxies,
  fakeSocketSymbol,
  eofInProgress,
  emitErrorNextTickIfErrorListenerNT,
  emitEOFIncomingMessage,
  emitCloseNTAndComplete,
  emitCloseNT,
  drainMicrotasks,
  deferredSymbol,
  controllerSymbol,
  checkShouldUseProxy,
  callCloseCallback,
  bodyStreamSymbol,
  assignHeadersFast,
  abortedSymbol,
  STATUS_CODES,
  NodeHTTPResponseFlags,
  NodeHTTPResponseAbortEvent,
  NodeHTTPIncomingRequestType,
  NodeHTTPHeaderState,
  NodeHTTPBodyReadState,
  METHODS,
  Headers,
  ClientRequestEmitState
};})

