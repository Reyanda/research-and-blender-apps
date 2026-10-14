(function (){"use strict";// build/release/tmp_modules/internal/http/FakeSocket.ts
var $, { kInternalSocketData, serverSymbol } = @getInternalField(@internalModuleRegistry, 25) || @createInternalModuleById(25), { kAutoDestroyed } = @getInternalField(@internalModuleRegistry, 32) || @createInternalModuleById(32), { Duplex } = @getInternalField(@internalModuleRegistry, 40) || @createInternalModuleById(40), FakeSocket = class Socket extends Duplex {
  [kInternalSocketData];
  bytesRead = 0;
  bytesWritten = 0;
  connecting = !1;
  timeout = 0;
  isServer = !1;
  #address;
  _httpMessage;
  constructor(httpMessage) {
    super();
    this._httpMessage = httpMessage;
  }
  address() {
    var internalData;
    return this.#address ??= (internalData = this[kInternalSocketData])?.[0]?.[serverSymbol]?.requestIP(internalData[2]) ?? {};
  }
  get bufferSize() {
    return this.writableLength;
  }
  connect(_port, _host, _connectListener) {
    return this;
  }
  _onTimeout = function() {
    this.emit("timeout");
  };
  _destroy(_err, _callback) {
    let socketData = this[kInternalSocketData];
    if (!socketData)
      return;
    if (!socketData[1].req[kAutoDestroyed])
      socketData[1].end();
  }
  _final(_callback) {}
  get localAddress() {
    return this.address() ? "127.0.0.1" : @undefined;
  }
  get localFamily() {
    return "IPv4";
  }
  get localPort() {
    return 80;
  }
  get pending() {
    return this.connecting;
  }
  _read(_size) {}
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
  setTimeout(timeout, callback) {
    let socketData = this[kInternalSocketData];
    if (!socketData)
      return;
    return socketData[1]?.req?.setTimeout(timeout, callback), this;
  }
  unref() {
    return this;
  }
  _write(_chunk, _encoding, _callback) {}
  destroy() {
    return this._httpMessage?.destroy?.(), super.destroy();
  }
};
Object.defineProperty(FakeSocket, "name", { value: "Socket" });
$ = {
  FakeSocket
};
return $})

