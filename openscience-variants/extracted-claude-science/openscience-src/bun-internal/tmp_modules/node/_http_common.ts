(function (){"use strict";// build/release/tmp_modules/node/_http_common.ts
var $, { checkIsHttpToken } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), FreeList = @getInternalField(@internalModuleRegistry, 19) || @createInternalModuleById(19), { methods, allMethods, HTTPParser } = process.binding("http_parser"), incoming = @getInternalField(@internalModuleRegistry, 74) || @createInternalModuleById(74), { IncomingMessage, readStart, readStop } = incoming, RegExpPrototypeExec = @RegExp.prototype.exec, headerCharRegex;
function checkInvalidHeaderChar(val) {
  if (!headerCharRegex)
    headerCharRegex = /[^\t\x20-\x7e\x80-\xff]/;
  return RegExpPrototypeExec.@call(headerCharRegex, val) !== null;
}
var validateHeaderName = (name, label) => {
  if (typeof name !== "string" || !name || !checkIsHttpToken(name))
    throw @makeErrorWithCode(127, label || "Header name", name);
}, validateHeaderValue = (name, value) => {
  if (value === @undefined)
    throw @makeErrorWithCode(71, value, name);
  if (checkInvalidHeaderChar(value))
    throw @makeErrorWithCode(121, "header content", name);
}, insecureHTTPParser = !1, kIncomingMessage = Symbol("IncomingMessage"), kOnMessageBegin = HTTPParser.kOnMessageBegin | 0, kOnHeaders = HTTPParser.kOnHeaders | 0, kOnHeadersComplete = HTTPParser.kOnHeadersComplete | 0, kOnBody = HTTPParser.kOnBody | 0, kOnMessageComplete = HTTPParser.kOnMessageComplete | 0, kOnExecute = HTTPParser.kOnExecute | 0, kOnTimeout = HTTPParser.kOnTimeout | 0, MAX_HEADER_PAIRS = 2000;
function parserOnHeaders(headers, url) {
  if (this.maxHeaderPairs <= 0 || this._headers.length < this.maxHeaderPairs)
    this._headers.push(...headers);
  this._url += url;
}
function parserOnHeadersComplete(versionMajor, versionMinor, headers, method, url, statusCode, statusMessage, upgrade, shouldKeepAlive) {
  let parser = this, { socket } = parser;
  if (headers === @undefined)
    headers = parser._headers, parser._headers = [];
  if (url === @undefined)
    url = parser._url, parser._url = "";
  let ParserIncomingMessage = socket?.server?.[kIncomingMessage] || IncomingMessage, incoming2 = parser.incoming = new ParserIncomingMessage(socket);
  incoming2.httpVersionMajor = versionMajor, incoming2.httpVersionMinor = versionMinor, incoming2.httpVersion = `${versionMajor}.${versionMinor}`, incoming2.joinDuplicateHeaders = socket?.server?.joinDuplicateHeaders || parser.joinDuplicateHeaders, incoming2.url = url, incoming2.upgrade = upgrade;
  let n = headers.length;
  if (parser.maxHeaderPairs > 0)
    n = Math.min(n, parser.maxHeaderPairs);
  if (incoming2._addHeaderLines(headers, n), typeof method === "number")
    incoming2.method = allMethods[method];
  else
    incoming2.statusCode = statusCode, incoming2.statusMessage = statusMessage;
  return parser.onIncoming(incoming2, shouldKeepAlive);
}
function parserOnBody(b) {
  let stream = this.incoming;
  if (stream === null)
    return;
  if (!stream._dumped) {
    if (!stream.push(b))
      readStop(this.socket);
  }
}
function parserOnMessageComplete() {
  let parser = this, stream = parser.incoming;
  if (stream !== null) {
    stream.complete = !0;
    let headers = parser._headers;
    if (headers.length)
      stream._addHeaderLines(headers, headers.length), parser._headers = [], parser._url = "";
    stream.push(null);
  }
  readStart(parser.socket);
}
var parsers = new FreeList("parsers", 1000, function parsersCb() {
  let parser = new HTTPParser;
  return cleanParser(parser), parser[kOnHeaders] = parserOnHeaders, parser[kOnHeadersComplete] = parserOnHeadersComplete, parser[kOnBody] = parserOnBody, parser[kOnMessageComplete] = parserOnMessageComplete, parser;
});
function closeParserInstance(parser) {
  parser.close();
}
function freeParser(parser, req, socket) {
  if (parser) {
    if (parser._consumed)
      parser.unconsume();
    if (cleanParser(parser), parser.remove(), parsers.free(parser) === !1)
      setImmediate(closeParserInstance, parser);
    else
      parser.free();
  }
  if (req)
    req.parser = null;
  if (socket)
    socket.parser = null;
}
function cleanParser(parser) {
  parser._headers = [], parser._url = "", parser.socket = null, parser.incoming = null, parser.outgoing = null, parser.maxHeaderPairs = MAX_HEADER_PAIRS, parser[kOnMessageBegin] = null, parser[kOnExecute] = null, parser[kOnTimeout] = null, parser._consumed = !1, parser.onIncoming = null, parser.joinDuplicateHeaders = null;
}
function prepareError(err, parser, rawPacket) {
  if (err.rawPacket = rawPacket || parser.getCurrentBuffer(), typeof err.reason === "string")
    err.message = `Parse Error: ${err.reason}`;
}
var warnedLenient = !1;
function isLenient() {
  if (insecureHTTPParser && !warnedLenient)
    warnedLenient = !0, process.emitWarning("Using insecure HTTP parsing");
  return insecureHTTPParser;
}
$ = {
  validateHeaderName,
  validateHeaderValue,
  _checkIsHttpToken: checkIsHttpToken,
  _checkInvalidHeaderChar: checkInvalidHeaderChar,
  chunkExpression: /(?:^|\W)chunked(?:$|\W)/i,
  continueExpression: /(?:^|\W)100-continue(?:$|\W)/i,
  CRLF: `\r
`,
  freeParser,
  methods,
  parsers,
  kIncomingMessage,
  HTTPParser,
  isLenient,
  prepareError
};
return $})

