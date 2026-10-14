(function (){"use strict";// build/release/tmp_modules/node/tls.ts
var $, { isArrayBufferView, isTypedArray } = @getInternalField(@internalModuleRegistry, 144) || @createInternalModuleById(144), net = @getInternalField(@internalModuleRegistry, 104) || @createInternalModuleById(104), Duplex = @getInternalField(@internalModuleRegistry, 44) || @createInternalModuleById(44), addServerName = @lazy(69), { throwNotImplemented } = @getInternalField(@internalModuleRegistry, 32) || @createInternalModuleById(32), { throwOnInvalidTLSArray } = @getInternalField(@internalModuleRegistry, 61) || @createInternalModuleById(61), { validateString } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), { Server: NetServer, Socket: NetSocket } = net, getBundledRootCertificates = @lazy(75), getExtraCACertificates = @lazy(76), getSystemCACertificates = @lazy(77), canonicalizeIP = @lazy(78), getTLSDefaultCiphers = @lazy(79), setTLSDefaultCiphers = @lazy(80), _VALID_CIPHERS_SET;
function getValidCiphersSet() {
  if (!_VALID_CIPHERS_SET)
    _VALID_CIPHERS_SET = /* @__PURE__ */ new Set([
      "EXP1024-RC4-MD5",
      "EXP1024-RC2-CBC-MD5",
      "EXP1024-DES-CBC-SHA",
      "EXP1024-DHE-DSS-DES-CBC-SHA",
      "EXP1024-RC4-SHA",
      "EXP1024-DHE-DSS-RC4-SHA",
      "DHE-DSS-RC4-SHA",
      "AES128-SHA",
      "DH-DSS-AES128-SHA",
      "DH-RSA-AES128-SHA",
      "DHE-DSS-AES128-SHA",
      "DHE-RSA-AES128-SHA",
      "ADH-AES128-SHA",
      "AES256-SHA",
      "DH-DSS-AES256-SHA",
      "DH-RSA-AES256-SHA",
      "DHE-DSS-AES256-SHA",
      "DHE-RSA-AES256-SHA",
      "ADH-AES256-SHA",
      "ECDH-ECDSA-NULL-SHA",
      "ECDH-ECDSA-RC4-SHA",
      "ECDH-ECDSA-DES-CBC3-SHA",
      "ECDH-ECDSA-AES128-SHA",
      "ECDH-ECDSA-AES256-SHA",
      "ECDHE-ECDSA-NULL-SHA",
      "ECDHE-ECDSA-RC4-SHA",
      "ECDHE-ECDSA-DES-CBC3-SHA",
      "ECDHE-ECDSA-AES128-SHA",
      "ECDHE-ECDSA-AES256-SHA",
      "ECDH-RSA-NULL-SHA",
      "ECDH-RSA-RC4-SHA",
      "ECDH-RSA-DES-CBC3-SHA",
      "ECDH-RSA-AES128-SHA",
      "ECDH-RSA-AES256-SHA",
      "ECDHE-RSA-NULL-SHA",
      "ECDHE-RSA-RC4-SHA",
      "ECDHE-RSA-DES-CBC3-SHA",
      "ECDHE-RSA-AES128-SHA",
      "ECDHE-RSA-AES256-SHA",
      "ECDHE-RSA-AES128-SHA256",
      "AECDH-NULL-SHA",
      "AECDH-RC4-SHA",
      "AECDH-DES-CBC3-SHA",
      "AECDH-AES128-SHA",
      "AECDH-AES256-SHA",
      "PSK-RC4-SHA",
      "PSK-3DES-EDE-CBC-SHA",
      "PSK-AES128-CBC-SHA",
      "PSK-AES256-CBC-SHA",
      "ECDHE-PSK-AES128-CBC-SHA",
      "ECDHE-PSK-AES256-CBC-SHA",
      "SRP-3DES-EDE-CBC-SHA",
      "SRP-RSA-3DES-EDE-CBC-SHA",
      "SRP-DSS-3DES-EDE-CBC-SHA",
      "SRP-AES-128-CBC-SHA",
      "SRP-RSA-AES-128-CBC-SHA",
      "SRP-DSS-AES-128-CBC-SHA",
      "SRP-AES-256-CBC-SHA",
      "SRP-RSA-AES-256-CBC-SHA",
      "SRP-DSS-AES-256-CBC-SHA",
      "CAMELLIA128-SHA",
      "DH-DSS-CAMELLIA128-SHA",
      "DH-RSA-CAMELLIA128-SHA",
      "DHE-DSS-CAMELLIA128-SHA",
      "DHE-RSA-CAMELLIA128-SHA",
      "ADH-CAMELLIA128-SHA",
      "CAMELLIA256-SHA",
      "DH-DSS-CAMELLIA256-SHA",
      "DH-RSA-CAMELLIA256-SHA",
      "DHE-DSS-CAMELLIA256-SHA",
      "DHE-RSA-CAMELLIA256-SHA",
      "ADH-CAMELLIA256-SHA",
      "SEED-SHA",
      "DH-DSS-SEED-SHA",
      "DH-RSA-SEED-SHA",
      "DHE-DSS-SEED-SHA",
      "DHE-RSA-SEED-SHA",
      "ADH-SEED-SHA",
      "NULL-SHA256",
      "AES128-SHA256",
      "AES256-SHA256",
      "DH-DSS-AES128-SHA256",
      "DH-RSA-AES128-SHA256",
      "DHE-DSS-AES128-SHA256",
      "DHE-RSA-AES128-SHA256",
      "DH-DSS-AES256-SHA256",
      "DH-RSA-AES256-SHA256",
      "DHE-DSS-AES256-SHA256",
      "DHE-RSA-AES256-SHA256",
      "ADH-AES128-SHA256",
      "ADH-AES256-SHA256",
      "AES128-GCM-SHA256",
      "AES256-GCM-SHA384",
      "DHE-RSA-AES128-GCM-SHA256",
      "DHE-RSA-AES256-GCM-SHA384",
      "DH-RSA-AES128-GCM-SHA256",
      "DH-RSA-AES256-GCM-SHA384",
      "DHE-DSS-AES128-GCM-SHA256",
      "DHE-DSS-AES256-GCM-SHA384",
      "DH-DSS-AES128-GCM-SHA256",
      "DH-DSS-AES256-GCM-SHA384",
      "ADH-AES128-GCM-SHA256",
      "ADH-AES256-GCM-SHA384",
      "ECDHE-ECDSA-AES128-SHA256",
      "ECDHE-ECDSA-AES256-SHA384",
      "ECDH-ECDSA-AES128-SHA256",
      "ECDH-ECDSA-AES256-SHA384",
      "ECDHE-RSA-AES128-SHA256",
      "ECDHE-RSA-AES256-SHA384",
      "ECDH-RSA-AES128-SHA256",
      "ECDH-RSA-AES256-SHA384",
      "ECDHE-ECDSA-AES128-GCM-SHA256",
      "ECDHE-ECDSA-AES256-GCM-SHA384",
      "ECDH-ECDSA-AES128-GCM-SHA256",
      "ECDH-ECDSA-AES256-GCM-SHA384",
      "ECDHE-RSA-AES128-GCM-SHA256",
      "ECDHE-RSA-AES256-GCM-SHA384",
      "ECDH-RSA-AES128-GCM-SHA256",
      "ECDH-RSA-AES256-GCM-SHA384",
      "ECDHE-RSA-CHACHA20-POLY1305",
      "ECDHE-ECDSA-CHACHA20-POLY1305",
      "ECDHE-PSK-CHACHA20-POLY1305",
      "TLS_AES_128_GCM_SHA256",
      "TLS_AES_256_GCM_SHA384",
      "TLS_CHACHA20_POLY1305_SHA256",
      "HIGH",
      "!aNULL",
      "!eNULL",
      "!EXPORT",
      "!DES",
      "!RC4",
      "!MD5",
      "!PSK",
      "!SRP",
      "!CAMELLIA"
    ]);
  return _VALID_CIPHERS_SET;
}
function validateCiphers(ciphers, name = "options") {
  if (ciphers !== @undefined && ciphers !== null) {
    validateString(ciphers, `${name}.ciphers`);
    let ciphersSet = getValidCiphersSet(), requested = ciphers.split(":");
    for (let r of requested)
      if (r && !ciphersSet.has(r))
        throw @makeErrorWithCode(248);
  }
}
var SymbolReplace = Symbol.replace, RegExpPrototypeSymbolReplace = @RegExp.prototype[SymbolReplace], RegExpPrototypeExec = @RegExp.prototype.exec, ObjectAssign = Object.assign, StringPrototypeStartsWith = @String.prototype.startsWith, StringPrototypeSlice = @String.prototype.slice, StringPrototypeIncludes = @String.prototype.includes, StringPrototypeSplit = @String.prototype.split, StringPrototypeIndexOf = @String.prototype.indexOf, StringPrototypeSubstring = @String.prototype.substring, StringPrototypeEndsWith = @String.prototype.endsWith, StringFromCharCode = @String.fromCharCode, StringPrototypeCharCodeAt = @String.prototype.charCodeAt, ArrayPrototypeIncludes = @Array.prototype.includes, ArrayPrototypeJoin = @Array.prototype.join, ArrayPrototypeForEach = @Array.prototype.forEach, ArrayPrototypePush = @Array.prototype.push, ArrayPrototypeSome = @Array.prototype.some, ArrayPrototypeReduce = @Array.prototype.reduce, ObjectFreeze = Object.freeze;
function parseCertString() {
  throwNotImplemented("Not implemented");
}
var rejectUnauthorizedDefault = process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0" && process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "false";
function unfqdn(host) {
  return RegExpPrototypeSymbolReplace.@call(/[.]$/, host, "");
}
function toLowerCase(c) {
  return StringFromCharCode(32 + StringPrototypeCharCodeAt.@call(c, 0));
}
function splitHost(host) {
  return StringPrototypeSplit.@call(RegExpPrototypeSymbolReplace.@call(/[A-Z]/g, unfqdn(host), toLowerCase), ".");
}
function check(hostParts, pattern, wildcards) {
  if (!pattern)
    return !1;
  let patternParts = splitHost(pattern);
  if (hostParts.length !== patternParts.length)
    return !1;
  if (ArrayPrototypeIncludes.@call(patternParts, ""))
    return !1;
  let isBad = (s) => RegExpPrototypeExec.@call(/[^\u0021-\u007F]/u, s) !== null;
  if (ArrayPrototypeSome.@call(patternParts, isBad))
    return !1;
  for (let i = hostParts.length - 1;i > 0; i -= 1)
    if (hostParts[i] !== patternParts[i])
      return !1;
  let hostSubdomain = hostParts[0], patternSubdomain = patternParts[0], patternSubdomainParts = StringPrototypeSplit.@call(patternSubdomain, "*");
  if (patternSubdomainParts.length === 1 || StringPrototypeIncludes.@call(patternSubdomain, "xn--"))
    return hostSubdomain === patternSubdomain;
  if (!wildcards)
    return !1;
  if (patternSubdomainParts.length > 2)
    return !1;
  if (patternParts.length <= 2)
    return !1;
  let { 0: prefix, 1: suffix } = patternSubdomainParts;
  if (prefix.length + suffix.length > hostSubdomain.length)
    return !1;
  if (!StringPrototypeStartsWith.@call(hostSubdomain, prefix))
    return !1;
  if (!StringPrototypeEndsWith.@call(hostSubdomain, suffix))
    return !1;
  return !0;
}
var jsonStringPattern = /^"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"/;
function splitEscapedAltNames(altNames) {
  let result = [], currentToken = "", offset = 0;
  while (offset !== altNames.length) {
    let nextSep = StringPrototypeIndexOf.@call(altNames, ", ", offset), nextQuote = StringPrototypeIndexOf.@call(altNames, '"', offset);
    if (nextQuote !== -1 && (nextSep === -1 || nextQuote < nextSep)) {
      currentToken += StringPrototypeSubstring.@call(altNames, offset, nextQuote);
      let match = RegExpPrototypeExec.@call(jsonStringPattern, StringPrototypeSubstring.@call(altNames, nextQuote));
      if (!match)
        throw @makeErrorWithCode(238);
      currentToken += JSON.parse(match[0]), offset = nextQuote + match[0].length;
    } else if (nextSep !== -1)
      currentToken += StringPrototypeSubstring.@call(altNames, offset, nextSep), ArrayPrototypePush.@call(result, currentToken), currentToken = "", offset = nextSep + 2;
    else
      currentToken += StringPrototypeSubstring.@call(altNames, offset), offset = altNames.length;
  }
  return ArrayPrototypePush.@call(result, currentToken), result;
}
function checkServerIdentity(hostname, cert) {
  let { subject, subjectaltname: altNames } = cert, dnsNames = [], ips = [];
  if (hostname = "" + hostname, altNames) {
    let splitAltNames = StringPrototypeIncludes.@call(altNames, '"') ? splitEscapedAltNames(altNames) : StringPrototypeSplit.@call(altNames, ", ");
    ArrayPrototypeForEach.@call(splitAltNames, (name) => {
      if (StringPrototypeStartsWith.@call(name, "DNS:"))
        ArrayPrototypePush.@call(dnsNames, StringPrototypeSlice.@call(name, 4));
      else if (StringPrototypeStartsWith.@call(name, "IP Address:"))
        ArrayPrototypePush.@call(ips, canonicalizeIP(StringPrototypeSlice.@call(name, 11)));
    });
  }
  let valid = !1, reason = "Unknown reason";
  if (hostname = unfqdn(hostname), net.isIP(hostname)) {
    if (valid = ArrayPrototypeIncludes.@call(ips, canonicalizeIP(hostname)), !valid)
      reason = `IP: ${hostname} is not in the cert's list: ` + ArrayPrototypeJoin.@call(ips, ", ");
  } else if (dnsNames.length > 0 || subject?.CN) {
    let hostParts = splitHost(hostname), wildcard = (pattern) => check(hostParts, pattern, !0);
    if (dnsNames.length > 0) {
      if (valid = ArrayPrototypeSome.@call(dnsNames, wildcard), !valid)
        reason = `Host: ${hostname}. is not in the cert's altnames: ${altNames}`;
    } else {
      let cn = subject.CN;
      if (@Array.isArray(cn))
        valid = ArrayPrototypeSome.@call(cn, wildcard);
      else if (cn)
        valid = wildcard(cn);
      if (!valid)
        reason = `Host: ${hostname}. is not cert's CN: ${cn}`;
    }
  } else
    reason = "Cert does not contain a DNS name";
  if (!valid)
    return @makeErrorWithCode(239, reason, hostname, cert);
}
var InternalSecureContext = class SecureContext {
  context;
  key;
  cert;
  ca;
  passphrase;
  servername;
  secureOptions;
  constructor(options) {
    let context = {};
    if (options) {
      let cert = options.cert;
      if (cert)
        throwOnInvalidTLSArray("options.cert", cert), this.cert = cert;
      let key = options.key;
      if (key)
        throwOnInvalidTLSArray("options.key", key), this.key = key;
      let ca = options.ca;
      if (ca)
        throwOnInvalidTLSArray("options.ca", ca), this.ca = ca;
      let passphrase = options.passphrase;
      if (passphrase && typeof passphrase !== "string")
        @throwTypeError("passphrase argument must be an string");
      this.passphrase = passphrase;
      let servername = options.servername;
      if (servername && typeof servername !== "string")
        @throwTypeError("servername argument must be an string");
      this.servername = servername;
      let secureOptions = options.secureOptions || 0;
      if (secureOptions && typeof secureOptions !== "number")
        @throwTypeError("secureOptions argument must be an number");
      if (this.secureOptions = secureOptions, !@isUndefinedOrNull(options.privateKeyIdentifier)) {
        if (@isUndefinedOrNull(options.privateKeyEngine))
          throw @makeErrorWithCode(119, "options.privateKeyEngine", options.privateKeyEngine);
        else if (typeof options.privateKeyEngine !== "string")
          throw @makeErrorWithCode(118, "options.privateKeyEngine", ["string", "null", "undefined"], options.privateKeyEngine);
        if (typeof options.privateKeyIdentifier !== "string")
          throw @makeErrorWithCode(118, "options.privateKeyIdentifier", ["string", "null", "undefined"], options.privateKeyIdentifier);
      }
    }
    this.context = context;
  }
};
function SecureContext2(options) {
  return new InternalSecureContext(options);
}
function createSecureContext(options) {
  return new SecureContext2(options);
}
function translatePeerCertificate(c) {
  return c;
}
var ksecureContext = Symbol("ksecureContext"), kcheckServerIdentity = Symbol("kcheckServerIdentity"), ksession = Symbol("ksession"), krenegotiationDisabled = Symbol("renegotiationDisabled"), buntls = Symbol.for("::buntls::");
function TLSSocket(socket, options) {
  this[ksecureContext] = @undefined, this.ALPNProtocols = @undefined, this[kcheckServerIdentity] = @undefined, this[ksession] = @undefined, this.alpnProtocol = null, this._secureEstablished = !1, this._rejectUnauthorized = rejectUnauthorizedDefault, this._securePending = !0, this._newSessionPending = @undefined, this._controlReleased = @undefined, this.secureConnecting = !1, this._SNICallback = @undefined, this.servername = @undefined, this.authorized = !1, this.authorizationError, this[krenegotiationDisabled] = @undefined, this.encrypted = !0;
  let isNetSocketOrDuplex = socket instanceof Duplex;
  if (options = isNetSocketOrDuplex ? { ...options, allowHalfOpen: !1 } : options || socket || {}, NetSocket.@call(this, options), this.ciphers = options.ciphers, this.ciphers)
    validateCiphers(options.ciphers);
  if (typeof options === "object") {
    let { ALPNProtocols } = options;
    if (ALPNProtocols)
      convertALPNProtocols(ALPNProtocols, this);
    if (isNetSocketOrDuplex)
      this._handle = socket, this._handle._parentWrap = this;
  }
  this[ksecureContext] = options.secureContext || createSecureContext(options), this.authorized = !1, this.secureConnecting = !0, this._secureEstablished = !1, this._securePending = !0, this[kcheckServerIdentity] = options.checkServerIdentity || checkServerIdentity, this[ksession] = options.session || null;
}
@toClass(TLSSocket, "TLSSocket", NetSocket);
TLSSocket.prototype._start = function _start() {
  this.connect();
};
TLSSocket.prototype.getSession = function getSession() {
  return this._handle?.getSession?.();
};
TLSSocket.prototype.getEphemeralKeyInfo = function getEphemeralKeyInfo() {
  return this._handle?.getEphemeralKeyInfo?.();
};
TLSSocket.prototype.getCipher = function getCipher() {
  return this._handle?.getCipher?.();
};
TLSSocket.prototype.getSharedSigalgs = function getSharedSigalgs() {
  return this._handle?.getSharedSigalgs?.();
};
TLSSocket.prototype.getProtocol = function getProtocol() {
  return this._handle?.getTLSVersion?.();
};
TLSSocket.prototype.getFinished = function getFinished() {
  return this._handle?.getTLSFinishedMessage?.() || @undefined;
};
TLSSocket.prototype.getPeerFinished = function getPeerFinished() {
  return this._handle?.getTLSPeerFinishedMessage?.() || @undefined;
};
TLSSocket.prototype.isSessionReused = function isSessionReused() {
  return this._handle?.isSessionReused?.() ?? !1;
};
TLSSocket.prototype.renegotiate = function renegotiate(options, callback) {
  if (this[krenegotiationDisabled]) {
    let error = @makeErrorWithCode(245);
    if (typeof callback === "function")
      process.nextTick(callback, error);
    return !1;
  }
  let socket = this._handle;
  if (!socket)
    return;
  if (options) {
    let requestCert = !!this._requestCert, rejectUnauthorized = !!this._rejectUnauthorized;
    if (options.requestCert !== @undefined)
      requestCert = !!options.requestCert;
    if (options.rejectUnauthorized !== @undefined)
      rejectUnauthorized = !!options.rejectUnauthorized;
    if (requestCert !== this._requestCert || rejectUnauthorized !== this._rejectUnauthorized)
      socket.setVerifyMode?.(requestCert, rejectUnauthorized), this._requestCert = requestCert, this._rejectUnauthorized = rejectUnauthorized;
  }
  try {
    if (socket.renegotiate?.(), typeof callback === "function")
      this.once("secure", () => callback(null));
    return !0;
  } catch (err) {
    if (typeof callback === "function")
      process.nextTick(callback, err);
    return !1;
  }
};
TLSSocket.prototype.disableRenegotiation = function disableRenegotiation() {
  return this[krenegotiationDisabled] = !0, this._handle?.disableRenegotiation?.();
};
TLSSocket.prototype.getTLSTicket = function getTLSTicket() {
  return this._handle?.getTLSTicket?.();
};
TLSSocket.prototype.exportKeyingMaterial = function exportKeyingMaterial(length, label, context) {
  if (context)
    return this._handle?.exportKeyingMaterial?.(length, label, context);
  return this._handle?.exportKeyingMaterial?.(length, label);
};
TLSSocket.prototype.setMaxSendFragment = function setMaxSendFragment(size) {
  return this._handle?.setMaxSendFragment?.(size) || !1;
};
TLSSocket.prototype.enableTrace = function enableTrace() {};
TLSSocket.prototype.setServername = function setServername(name) {
  if (this.isServer)
    throw @makeErrorWithCode(246);
  this.servername = name, this._handle?.setServername?.(name);
};
TLSSocket.prototype.setSession = function setSession(session) {
  if (this[ksession] = session, typeof session === "string")
    session = @Buffer.from(session, "latin1");
  return this._handle?.setSession?.(session);
};
TLSSocket.prototype.getPeerCertificate = function getPeerCertificate(abbreviated) {
  if (this._handle) {
    let cert = arguments.length < 1 ? this._handle.getPeerCertificate?.() : this._handle.getPeerCertificate?.(abbreviated);
    if (cert)
      return translatePeerCertificate(cert);
    return {};
  }
  return null;
};
TLSSocket.prototype.getCertificate = function getCertificate() {
  let cert = this._handle?.getCertificate?.();
  if (cert)
    return translatePeerCertificate(cert);
};
TLSSocket.prototype.getPeerX509Certificate = function getPeerX509Certificate() {
  return this._handle?.getPeerX509Certificate?.();
};
TLSSocket.prototype.getX509Certificate = function getX509Certificate() {
  return this._handle?.getX509Certificate?.();
};
TLSSocket.prototype[buntls] = function(port, host) {
  let ctx = this[ksecureContext], servername = this.servername || ctx?.servername;
  if (servername === @undefined)
    servername = host && !net.isIP(host) ? host : "";
  return {
    socket: this._handle,
    ALPNProtocols: this.ALPNProtocols,
    checkServerIdentity: this[kcheckServerIdentity],
    session: this[ksession],
    rejectUnauthorized: this._rejectUnauthorized,
    requestCert: this._requestCert,
    ciphers: this.ciphers,
    ...ctx,
    servername
  };
};
var CLIENT_RENEG_LIMIT = 3, CLIENT_RENEG_WINDOW = 600;
function Server(options, secureConnectionListener) {
  if (!(this instanceof Server))
    return new Server(options, secureConnectionListener);
  NetServer.@apply(this, [options, secureConnectionListener]), this.key = @undefined, this.cert = @undefined, this.ca = @undefined, this.passphrase = @undefined, this.secureOptions = @undefined, this._rejectUnauthorized = rejectUnauthorizedDefault, this._requestCert = @undefined, this.servername = @undefined, this.ALPNProtocols = @undefined;
  let contexts = null;
  this.addContext = function(hostname, context) {
    if (typeof hostname !== "string")
      @throwTypeError("hostname must be a string");
    if (!(context instanceof InternalSecureContext))
      context = createSecureContext(context);
    if (this._handle)
      addServerName(this._handle, hostname, context);
    else {
      if (!contexts)
        contexts = /* @__PURE__ */ new Map;
      contexts.set(hostname, context);
    }
  }, this.setSecureContext = function(options2) {
    if (options2 instanceof InternalSecureContext)
      options2 = options2.context;
    if (options2) {
      let { ALPNProtocols } = options2;
      if (ALPNProtocols)
        convertALPNProtocols(ALPNProtocols, this);
      let cert = options2.cert;
      if (cert)
        throwOnInvalidTLSArray("options.cert", cert), this.cert = cert;
      let key = options2.key;
      if (key)
        throwOnInvalidTLSArray("options.key", key), this.key = key;
      let ca = options2.ca;
      if (ca)
        throwOnInvalidTLSArray("options.ca", ca), this.ca = ca;
      let passphrase = options2.passphrase;
      if (passphrase && typeof passphrase !== "string")
        throw @makeErrorWithCode(118, "options.passphrase", "string", passphrase);
      this.passphrase = passphrase;
      let servername = options2.servername;
      if (servername && typeof servername !== "string")
        throw @makeErrorWithCode(118, "options.servername", "string", servername);
      this.servername = servername;
      let secureOptions = options2.secureOptions || 0;
      if (secureOptions && typeof secureOptions !== "number")
        throw @makeErrorWithCode(118, "options.secureOptions", "number", secureOptions);
      this.secureOptions = secureOptions;
      let requestCert = options2.requestCert || !1;
      if (requestCert)
        this._requestCert = requestCert;
      else
        this._requestCert = @undefined;
      let rejectUnauthorized = options2.rejectUnauthorized;
      if (typeof rejectUnauthorized < "u")
        this._rejectUnauthorized = rejectUnauthorized;
      else
        this._rejectUnauthorized = rejectUnauthorizedDefault;
      if (typeof options2.ciphers < "u") {
        if (typeof options2.ciphers !== "string")
          throw @makeErrorWithCode(118, "options.ciphers", "string", options2.ciphers);
        validateCiphers(options2.ciphers), this.ciphers = options2.ciphers;
      }
    }
  }, Server.prototype.getTicketKeys = function() {
    throw Error("Not implented in Bun yet");
  }, Server.prototype.setTicketKeys = function() {
    throw Error("Not implented in Bun yet");
  }, this[buntls] = function(port, host, isClient) {
    return [
      {
        serverName: this.servername || host || "localhost",
        key: this.key,
        cert: this.cert,
        ca: this.ca,
        passphrase: this.passphrase,
        secureOptions: this.secureOptions,
        rejectUnauthorized: this._rejectUnauthorized,
        requestCert: isClient ? !0 : this._requestCert,
        ALPNProtocols: this.ALPNProtocols,
        clientRenegotiationLimit: CLIENT_RENEG_LIMIT,
        clientRenegotiationWindow: CLIENT_RENEG_WINDOW,
        contexts,
        ciphers: this.ciphers
      },
      TLSSocket
    ];
  }, this.setSecureContext(options);
}
@toClass(Server, "Server", NetServer);
function createServer(options, connectionListener) {
  return new Server(options, connectionListener);
}
var DEFAULT_ECDH_CURVE = "auto", DEFAULT_MIN_VERSION = "TLSv1.2", DEFAULT_MAX_VERSION = "TLSv1.3";
function normalizeConnectArgs(listArgs) {
  let args = net._normalizeArgs(listArgs);
  if (listArgs[1] !== null && typeof listArgs[1] === "object")
    ObjectAssign(args[0], listArgs[1]);
  else if (listArgs[2] !== null && typeof listArgs[2] === "object")
    ObjectAssign(args[0], listArgs[2]);
  return args;
}
function connect(...args) {
  let normal = normalizeConnectArgs(args), options = normal[0], { ALPNProtocols, servername } = options;
  if (servername && net.isIP(servername))
    throw @makeErrorWithCode(119, "options.servername", servername, "Setting the TLS ServerName to an IP address is not permitted.");
  if (ALPNProtocols)
    convertALPNProtocols(ALPNProtocols, options);
  return new TLSSocket(options).connect(normal);
}
function getCiphers() {
  return getDefaultCiphers().split(":");
}
function convertProtocols(protocols) {
  let lens = new @Array(protocols.length), buff = @Buffer.allocUnsafe(ArrayPrototypeReduce.@call(protocols, (p, c, i) => {
    let len = @Buffer.byteLength(c);
    if (len > 255)
      @throwRangeError(`The byte length of the protocol at index ${i} exceeds the maximum length. It must be <= 255. Received ${len}`);
    return lens[i] = len, p + 1 + len;
  }, 0)), offset = 0;
  for (let i = 0, c = protocols.length;i < c; i++)
    buff[offset++] = lens[i], buff.write(protocols[i], offset), offset += lens[i];
  return buff;
}
function convertALPNProtocols(protocols, out) {
  if (@Array.isArray(protocols))
    out.ALPNProtocols = convertProtocols(protocols);
  else if (isTypedArray(protocols))
    out.ALPNProtocols = @Buffer.from(protocols);
  else if (isArrayBufferView(protocols))
    out.ALPNProtocols = @Buffer.from(protocols.buffer.slice(protocols.byteOffset, protocols.byteOffset + protocols.byteLength));
  else if (@Buffer.isBuffer(protocols))
    out.ALPNProtocols = protocols;
}
var bundledRootCertificates;
function cacheBundledRootCertificates() {
  return bundledRootCertificates ||= getBundledRootCertificates(), bundledRootCertificates;
}
var getUseSystemCA = @lazy(81), defaultCACertificates;
function cacheDefaultCACertificates() {
  if (defaultCACertificates)
    return defaultCACertificates;
  defaultCACertificates = [];
  let bundled = cacheBundledRootCertificates();
  for (let i = 0;i < bundled.length; ++i)
    ArrayPrototypePush.@call(defaultCACertificates, bundled[i]);
  if (getUseSystemCA() || process.env.NODE_USE_SYSTEM_CA === "1") {
    let system = cacheSystemCACertificates();
    for (let i = 0;i < system.length; ++i)
      ArrayPrototypePush.@call(defaultCACertificates, system[i]);
  }
  if (process.env.NODE_EXTRA_CA_CERTS) {
    let extra = cacheExtraCACertificates();
    for (let i = 0;i < extra.length; ++i)
      ArrayPrototypePush.@call(defaultCACertificates, extra[i]);
  }
  return ObjectFreeze(defaultCACertificates), defaultCACertificates;
}
var systemCACertificates;
function cacheSystemCACertificates() {
  return systemCACertificates ||= getSystemCACertificates(), systemCACertificates;
}
var extraCACertificates;
function cacheExtraCACertificates() {
  return extraCACertificates ||= getExtraCACertificates(), extraCACertificates;
}
function getCACertificates(type = "default") {
  switch (validateString(type, "type"), type) {
    case "default":
      return cacheDefaultCACertificates();
    case "bundled":
      return cacheBundledRootCertificates();
    case "system":
      return cacheSystemCACertificates();
    case "extra":
      return cacheExtraCACertificates();
    default:
      throw @makeErrorWithCode(119, "type", type);
  }
}
function tlsCipherFilter(a) {
  return !a.startsWith("TLS_");
}
function getDefaultCiphers() {
  let ciphers = getTLSDefaultCiphers();
  return `TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256${ciphers ? ":" + ciphers : ""}`;
}
$ = {
  CLIENT_RENEG_LIMIT,
  CLIENT_RENEG_WINDOW,
  connect,
  convertALPNProtocols,
  createSecureContext,
  createServer,
  get DEFAULT_CIPHERS() {
    return getDefaultCiphers();
  },
  set DEFAULT_CIPHERS(value) {
    if (value)
      validateCiphers(value, "value"), value = value.split(":").filter(tlsCipherFilter).join(":");
    setTLSDefaultCiphers(value);
  },
  DEFAULT_ECDH_CURVE,
  DEFAULT_MAX_VERSION,
  DEFAULT_MIN_VERSION,
  getCiphers,
  parseCertString,
  SecureContext: SecureContext2,
  Server,
  TLSSocket,
  checkServerIdentity,
  get rootCertificates() {
    return cacheBundledRootCertificates();
  },
  getCACertificates
};
return $})

