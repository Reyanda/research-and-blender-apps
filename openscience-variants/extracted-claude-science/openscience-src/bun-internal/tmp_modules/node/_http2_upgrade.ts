(function (){"use strict";// build/release/tmp_modules/node/_http2_upgrade.ts
var $, { Duplex } = @getInternalField(@internalModuleRegistry, 117) || @createInternalModuleById(117), upgradeDuplexToTLS = @lazy(38);
function UpgradeContext(connectionListener, server, rawSocket) {
  this.connectionListener = connectionListener, this.server = server, this.rawSocket = rawSocket, this.nativeHandle = null, this.events = null;
}
function tlsSocketRead() {
  let h = this._ctx.nativeHandle;
  if (h)
    h.resume();
  this._ctx.rawSocket.resume();
}
function tlsSocketWrite(chunk, encoding, callback) {
  let h = this._ctx.nativeHandle;
  if (!h) {
    callback(Error("Socket is closed"));
    return;
  }
  if (h.@write(chunk, encoding))
    callback();
  else
    this._writeCallback = callback;
}
function tlsSocketDestroy(err, callback) {
  let h = this._ctx.nativeHandle;
  if (h)
    h.close(), this._ctx.nativeHandle = null;
  let writeCb = this._writeCallback;
  if (writeCb)
    this._writeCallback = null, writeCb(err ?? Error("Socket destroyed"));
  callback(err);
}
function tlsSocketFinal(callback) {
  let h = this._ctx.nativeHandle;
  if (!h)
    return callback();
  h.end(), callback();
}
function socketOpen() {}
function socketData(_socket, chunk) {
  if (!this.push(chunk))
    this._ctx.rawSocket.pause();
}
function socketEnd() {
  this.push(null);
}
function socketDrain() {
  let cb = this._writeCallback;
  if (cb)
    this._writeCallback = null, cb();
}
function socketClose() {
  if (!this.destroyed)
    this.destroy();
}
function socketError(_socket, err) {
  if (!this._ctx.server._requestCert && err?.code === "UNABLE_TO_GET_ISSUER_CERT")
    return;
  this.destroy(err);
}
function socketTimeout() {
  this.emit("timeout");
}
function socketHandshake(nativeHandle, success, verifyError) {
  let tlsSocket = this, ctx = tlsSocket._ctx;
  if (!success) {
    let err = verifyError || Error("TLS handshake failed");
    ctx.server.emit("tlsClientError", err, tlsSocket), tlsSocket.destroy(err);
    return;
  }
  if (tlsSocket._securePending = !1, tlsSocket.secureConnecting = !1, tlsSocket._secureEstablished = !0, tlsSocket.alpnProtocol = nativeHandle?.alpnProtocol ?? null, tlsSocket._requestCert || tlsSocket._rejectUnauthorized)
    if (verifyError) {
      if (tlsSocket.authorized = !1, tlsSocket.authorizationError = verifyError.code || verifyError.message, ctx.server.emit("tlsClientError", verifyError, tlsSocket), tlsSocket._rejectUnauthorized) {
        tlsSocket.emit("secure", tlsSocket), tlsSocket.destroy(verifyError);
        return;
      }
    } else
      tlsSocket.authorized = !0;
  else
    tlsSocket.authorized = !0;
  ctx.connectionListener.@call(ctx.server, tlsSocket), tlsSocket.resume();
}
function onTlsClose() {
  let ctx = this._ctx, raw = ctx.rawSocket, ev = ctx.events;
  if (!ev)
    return;
  raw.removeListener("data", ev[0]), raw.removeListener("end", ev[1]), raw.removeListener("drain", ev[2]), raw.removeListener("close", ev[3]);
}
function noop() {}
function upgradeRawSocketToH2(connectionListener, server, rawSocket) {
  let tlsSocket = new Duplex;
  tlsSocket._ctx = new UpgradeContext(connectionListener, server, rawSocket), tlsSocket._read = tlsSocketRead, tlsSocket._write = tlsSocketWrite, tlsSocket._destroy = tlsSocketDestroy, tlsSocket._final = tlsSocketFinal, tlsSocket.on("error", noop), tlsSocket.alpnProtocol = null, tlsSocket.authorized = !1, tlsSocket.encrypted = !0, tlsSocket.server = server, tlsSocket._requestCert = server._requestCert || !1, tlsSocket._rejectUnauthorized = server._requestCert ? server._rejectUnauthorized : !1;
  let handle, events;
  try {
    [handle, events] = upgradeDuplexToTLS(rawSocket, {
      isServer: !0,
      tls: {
        key: server.key,
        cert: server.cert,
        ca: server.ca,
        passphrase: server.passphrase,
        ALPNProtocols: server.ALPNProtocols ? server.ALPNProtocols.buffer.slice(server.ALPNProtocols.byteOffset, server.ALPNProtocols.byteOffset + server.ALPNProtocols.byteLength) : null
      },
      socket: {
        open: socketOpen,
        data: socketData.bind(tlsSocket),
        end: socketEnd.bind(tlsSocket),
        drain: socketDrain.bind(tlsSocket),
        close: socketClose.bind(tlsSocket),
        error: socketError.bind(tlsSocket),
        timeout: socketTimeout.bind(tlsSocket),
        handshake: socketHandshake.bind(tlsSocket)
      },
      data: {}
    });
  } catch (e) {
    return rawSocket.destroy(e), tlsSocket.destroy(e), !0;
  }
  return tlsSocket._ctx.nativeHandle = handle, tlsSocket._ctx.events = events, rawSocket.on("data", events[0]), rawSocket.on("end", events[1]), rawSocket.on("drain", events[2]), rawSocket.on("close", events[3]), tlsSocket.once("close", onTlsClose), !0;
}
$ = { upgradeRawSocketToH2 };
return $})

