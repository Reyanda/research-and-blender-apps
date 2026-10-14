(function (){"use strict";// build/release/tmp_modules/node/http.ts
var $, { validateInteger } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), { Agent, globalAgent } = @getInternalField(@internalModuleRegistry, 71) || @createInternalModuleById(71), { ClientRequest } = @getInternalField(@internalModuleRegistry, 72) || @createInternalModuleById(72), { validateHeaderName, validateHeaderValue, parsers } = @getInternalField(@internalModuleRegistry, 73) || @createInternalModuleById(73), { IncomingMessage } = @getInternalField(@internalModuleRegistry, 74) || @createInternalModuleById(74), { OutgoingMessage } = @getInternalField(@internalModuleRegistry, 75) || @createInternalModuleById(75), { Server, ServerResponse } = @getInternalField(@internalModuleRegistry, 76) || @createInternalModuleById(76), { METHODS, STATUS_CODES, setMaxHTTPHeaderSize, getMaxHTTPHeaderSize } = @getInternalField(@internalModuleRegistry, 25) || @createInternalModuleById(25), { WebSocket, CloseEvent, MessageEvent } = globalThis;
function createServer(options, callback) {
  return new Server(options, callback);
}
function request(url, options, cb) {
  return new ClientRequest(url, options, cb);
}
function get(url, options, cb) {
  let req = request(url, options, cb);
  return req.end(), req;
}
var http_exports = {
  Agent,
  Server,
  METHODS,
  STATUS_CODES,
  createServer,
  ServerResponse,
  IncomingMessage,
  request,
  get,
  get maxHeaderSize() {
    return getMaxHTTPHeaderSize();
  },
  set maxHeaderSize(value) {
    setMaxHTTPHeaderSize(value);
  },
  validateHeaderName,
  validateHeaderValue,
  setMaxIdleHTTPParsers(max) {
    validateInteger(max, "max", 1), parsers.max = max;
  },
  globalAgent,
  ClientRequest,
  OutgoingMessage,
  WebSocket,
  CloseEvent,
  MessageEvent
};
$ = http_exports;
return $})

