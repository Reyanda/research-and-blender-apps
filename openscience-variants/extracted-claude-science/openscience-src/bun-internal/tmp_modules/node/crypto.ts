(function (){"use strict";// build/release/tmp_modules/node/crypto.ts
var $, StringDecoder = (@getInternalField(@internalModuleRegistry, 143) || @createInternalModuleById(143)).StringDecoder, LazyTransform = @getInternalField(@internalModuleRegistry, 49) || @createInternalModuleById(49), { defineCustomPromisifyArgs } = @getInternalField(@internalModuleRegistry, 31) || @createInternalModuleById(31), Writable = @getInternalField(@internalModuleRegistry, 59) || @createInternalModuleById(59), { CryptoHasher } = Bun, {
  getCurves,
  certVerifySpkac,
  certExportPublicKey,
  certExportChallenge,
  getCiphers,
  getCipherInfo,
  Sign: _Sign,
  sign,
  Verify: _Verify,
  verify,
  Hmac: _Hmac,
  Hash: _Hash,
  ECDH,
  DiffieHellman,
  DiffieHellmanGroup,
  diffieHellman,
  checkPrime,
  checkPrimeSync,
  generatePrime,
  generatePrimeSync,
  Cipher,
  hkdf,
  hkdfSync,
  publicEncrypt,
  publicDecrypt,
  privateEncrypt,
  privateDecrypt,
  KeyObject,
  createSecretKey,
  createPublicKey,
  createPrivateKey,
  generateKey,
  generateKeySync,
  generateKeyPair,
  generateKeyPairSync,
  X509Certificate
} = @lazy(45), {
  pbkdf2: _pbkdf2,
  pbkdf2Sync,
  timingSafeEqual,
  randomInt,
  randomUUID,
  randomBytes,
  randomFillSync,
  randomFill,
  secureHeapUsed,
  getFips,
  setFips,
  setEngine,
  getHashes,
  scrypt,
  scryptSync
} = @lazy(46), normalizeEncoding = @lazy(37), { validateString } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), kHandle = Symbol("kHandle");
function verifySpkac(spkac, encoding) {
  return certVerifySpkac(getArrayBufferOrView(spkac, "spkac", encoding));
}
function exportPublicKey(spkac, encoding) {
  return certExportPublicKey(getArrayBufferOrView(spkac, "spkac", encoding));
}
function exportChallenge(spkac, encoding) {
  return certExportChallenge(getArrayBufferOrView(spkac, "spkac", encoding));
}
function Certificate() {
  if (!new.target)
    return new Certificate;
  this.verifySpkac = verifySpkac, this.exportPublicKey = exportPublicKey, this.exportChallenge = exportChallenge;
}
Certificate.prototype = {};
Certificate.verifySpkac = verifySpkac;
Certificate.exportPublicKey = exportPublicKey;
Certificate.exportChallenge = exportChallenge;
var Buffer = globalThis.Buffer, { isAnyArrayBuffer, isArrayBufferView } = @getInternalField(@internalModuleRegistry, 144) || @createInternalModuleById(144);
function getArrayBufferOrView(buffer, name, encoding) {
  if (buffer instanceof KeyObject) {
    if (buffer.type !== "secret") {
      let error2 = @makeTypeError(`ERR_CRYPTO_INVALID_KEY_OBJECT_TYPE: Invalid key object type ${key.type}, expected secret`);
      throw error2.code = "ERR_CRYPTO_INVALID_KEY_OBJECT_TYPE", error2;
    }
    buffer = buffer.export();
  }
  if (isAnyArrayBuffer(buffer))
    return buffer;
  if (typeof buffer === "string") {
    if (encoding === "buffer")
      encoding = "utf8";
    return Buffer.from(buffer, encoding);
  }
  if (!isArrayBufferView(buffer)) {
    var error = @makeTypeError(`ERR_INVALID_ARG_TYPE: The "${name}" argument must be of type string or an instance of ArrayBuffer, Buffer, TypedArray, or DataView. Received ` + buffer);
    throw error.code = "ERR_INVALID_ARG_TYPE", error;
  }
  return buffer;
}
var crypto = globalThis.crypto, crypto_exports = {};
crypto_exports.getRandomValues = (value) => crypto.getRandomValues(value);
crypto_exports.constants = @processBindingConstants.crypto;
crypto_exports.KeyObject = KeyObject;
crypto_exports.generateKey = generateKey;
crypto_exports.generateKeySync = generateKeySync;
defineCustomPromisifyArgs(generateKeyPair, ["publicKey", "privateKey"]);
crypto_exports.generateKeyPair = generateKeyPair;
crypto_exports.generateKeyPairSync = generateKeyPairSync;
crypto_exports.createSecretKey = createSecretKey;
crypto_exports.createPublicKey = createPublicKey;
crypto_exports.createPrivateKey = createPrivateKey;
var webcrypto = crypto, _subtle = webcrypto.subtle;
crypto_exports.hash = function hash(algorithm, input, outputEncoding = "hex") {
  return CryptoHasher.hash(algorithm, input, outputEncoding);
};
function pbkdf2(password, salt, iterations, keylen, digest, callback) {
  if (typeof digest === "function")
    callback = digest, digest = @undefined;
  let promise = _pbkdf2(password, salt, iterations, keylen, digest, callback);
  if (callback) {
    promise.then((result) => callback(null, result), (err) => callback(err));
    return;
  }
  promise.then(() => {});
}
crypto_exports.pbkdf2 = pbkdf2;
crypto_exports.pbkdf2Sync = pbkdf2Sync;
crypto_exports.hkdf = hkdf;
crypto_exports.hkdfSync = hkdfSync;
crypto_exports.getCurves = getCurves;
crypto_exports.getCipherInfo = getCipherInfo;
crypto_exports.timingSafeEqual = timingSafeEqual;
crypto_exports.webcrypto = webcrypto;
crypto_exports.subtle = _subtle;
crypto_exports.X509Certificate = X509Certificate;
crypto_exports.Certificate = Certificate;
function Sign(algorithm, options) {
  if (!(this instanceof Sign))
    return new Sign(algorithm, options);
  validateString(algorithm, "algorithm"), this[kHandle] = new _Sign, this[kHandle].init(algorithm), Writable.@apply(this, [options]);
}
@toClass(Sign, "Sign", Writable);
Object.assign(Sign.prototype, {
  _write: function(chunk, encoding, callback) {
    this.update(chunk, encoding), callback();
  },
  update: function(data, encoding) {
    return this[kHandle].update(this, data, encoding);
  },
  sign: function(options, encoding) {
    return this[kHandle].sign(options, encoding);
  }
});
crypto_exports.Sign = Sign;
crypto_exports.sign = sign;
function createSign(algorithm, options) {
  return new Sign(algorithm, options);
}
crypto_exports.createSign = createSign;
function Verify(algorithm, options) {
  if (!(this instanceof Verify))
    return new Verify(algorithm, options);
  validateString(algorithm, "algorithm"), this[kHandle] = new _Verify, this[kHandle].init(algorithm), Writable.@apply(this, [options]);
}
@toClass(Verify, "Verify", Writable);
Verify.prototype._write = Sign.prototype._write;
Verify.prototype.update = Sign.prototype.update;
Object.assign(Verify.prototype, {
  verify: function(options, signature, sigEncoding) {
    return this[kHandle].verify(options, signature, sigEncoding);
  }
});
crypto_exports.Verify = Verify;
crypto_exports.verify = verify;
function createVerify(algorithm, options) {
  return new Verify(algorithm, options);
}
crypto_exports.createVerify = createVerify;
function Hash(algorithm, options) {
  if (!new.target)
    return new Hash(algorithm, options);
  let handle = new _Hash(algorithm, options);
  this[kHandle] = handle, LazyTransform.@apply(this, [options]);
}
@toClass(Hash, "Hash", LazyTransform);
Object.assign(Hash.prototype, {
  copy: function(options) {
    return new Hash(this[kHandle], options);
  },
  _transform: function(chunk, encoding, callback) {
    this[kHandle].update(this, chunk, encoding), callback();
  },
  _flush: function(callback) {
    this.push(this[kHandle].digest(null, !1)), callback();
  },
  update: function(data, encoding) {
    return this[kHandle].update(this, data, encoding);
  },
  digest: function(outputEncoding) {
    return this[kHandle].digest(outputEncoding);
  }
});
crypto_exports.Hash = Hash;
crypto_exports.createHash = function createHash(algorithm, options) {
  return new Hash(algorithm, options);
};
function Hmac(hmac, key2, options) {
  if (!new.target)
    return new Hmac(hmac, key2, options);
  let handle = new _Hmac(hmac, key2, options);
  this[kHandle] = handle, LazyTransform.@apply(this, [options]);
}
@toClass(Hmac, "Hmac", LazyTransform);
Object.assign(Hmac.prototype, {
  update: function(data, encoding) {
    return this[kHandle].update(this, data, encoding);
  },
  digest: function(outputEncoding) {
    return this[kHandle].digest(outputEncoding);
  },
  _transform: function(chunk, encoding, callback) {
    this[kHandle].update(this, chunk, encoding), callback();
  },
  _flush: function(callback) {
    this.push(this[kHandle].digest()), callback();
  }
});
crypto_exports.Hmac = Hmac;
crypto_exports.createHmac = function createHmac(hmac, key2, options) {
  return new Hmac(hmac, key2, options);
};
crypto_exports.getHashes = getHashes;
crypto_exports.randomInt = randomInt;
crypto_exports.randomFill = randomFill;
crypto_exports.randomFillSync = randomFillSync;
crypto_exports.randomBytes = randomBytes;
crypto_exports.randomUUID = randomUUID;
crypto_exports.checkPrime = checkPrime;
crypto_exports.checkPrimeSync = checkPrimeSync;
crypto_exports.generatePrime = generatePrime;
crypto_exports.generatePrimeSync = generatePrimeSync;
crypto_exports.secureHeapUsed = secureHeapUsed;
crypto_exports.setEngine = setEngine;
crypto_exports.getFips = getFips;
crypto_exports.setFips = setFips;
Object.defineProperty(crypto_exports, "fips", {
  __proto__: null,
  get: getFips,
  set: setFips
});
for (let rng of ["pseudoRandomBytes", "prng", "rng"])
  Object.defineProperty(crypto_exports, rng, {
    value: randomBytes,
    enumerable: !1,
    configurable: !0
  });
function createDiffieHellman(sizeOrKey, keyEncoding, generator, genEncoding) {
  return new DiffieHellman(sizeOrKey, keyEncoding, generator, genEncoding);
}
crypto_exports.DiffieHellmanGroup = DiffieHellmanGroup;
crypto_exports.getDiffieHellman = crypto_exports.createDiffieHellmanGroup = DiffieHellmanGroup;
crypto_exports.createDiffieHellman = createDiffieHellman;
crypto_exports.DiffieHellman = DiffieHellman;
crypto_exports.diffieHellman = diffieHellman;
crypto_exports.ECDH = ECDH;
crypto_exports.createECDH = function createECDH(curve) {
  return new ECDH(curve);
};
{
  let getDecoder2 = function(decoder, encoding) {
    let normalizedEncoding = normalizeEncoding(encoding);
    if (decoder ||= new StringDecoder(encoding), decoder.encoding !== normalizedEncoding) {
      if (normalizedEncoding === @undefined)
        throw @makeErrorWithCode(254, encoding);
      throw @makeErrorWithCode(264, "Cannot change encoding");
    }
    return decoder;
  }, Cipheriv2 = function(cipher, key2, iv, options) {
    if (!new.target)
      return new Cipheriv2(cipher, key2, iv, options);
    this[kHandle] = new Cipher(!1, cipher, key2, iv, options), LazyTransform.@apply(this, [options]), this._decoder = null;
  }, Decipheriv2 = function(cipher, key2, iv, options) {
    if (!new.target)
      return new Decipheriv2(cipher, key2, iv, options);
    this[kHandle] = new Cipher(!0, cipher, key2, iv, options), LazyTransform.@apply(this, [options]), this._decoder = null;
  };
  getDecoder = getDecoder2, Cipheriv = Cipheriv2, Decipheriv = Decipheriv2, @toClass(Cipheriv2, "Cipheriv", LazyTransform), Object.assign(Cipheriv2.prototype, {
    setAutoPadding: function(ap) {
      return this[kHandle].setAutoPadding(ap), this;
    },
    getAuthTag: function() {
      return this[kHandle].getAuthTag();
    },
    setAAD: function(aadbuf, options) {
      return this[kHandle].setAAD(aadbuf, options), this;
    },
    _transform: function(chunk, encoding, callback) {
      this.push(this[kHandle].update(chunk, encoding)), callback();
    },
    _flush: function(callback) {
      try {
        this.push(this[kHandle].final());
      } catch (e) {
        callback(e);
        return;
      }
      callback();
    },
    update: function(data, inputEncoding, outputEncoding) {
      let res = this[kHandle].update(data, inputEncoding);
      if (outputEncoding && outputEncoding !== "buffer")
        return this._decoder = getDecoder2(this._decoder, outputEncoding), this._decoder.write(res);
      return res;
    },
    final: function(outputEncoding) {
      let res = this[kHandle].final();
      if (outputEncoding && outputEncoding !== "buffer")
        return this._decoder = getDecoder2(this._decoder, outputEncoding), this._decoder.end(res);
      return res;
    }
  }), @toClass(Decipheriv2, "Decipheriv", LazyTransform), Object.assign(Decipheriv2.prototype, {
    setAutoPadding: Cipheriv2.prototype.setAutoPadding,
    setAuthTag: function(tagbuf, encoding) {
      return this[kHandle].setAuthTag(tagbuf, encoding), this;
    },
    setAAD: Cipheriv2.prototype.setAAD,
    _transform: Cipheriv2.prototype._transform,
    _flush: Cipheriv2.prototype._flush,
    update: Cipheriv2.prototype.update,
    final: Cipheriv2.prototype.final
  }), crypto_exports.Cipheriv = Cipheriv2, crypto_exports.Decipheriv = Decipheriv2, crypto_exports.createCipheriv = function createCipheriv(cipher, key2, iv, options) {
    return new Cipheriv2(cipher, key2, iv, options);
  }, crypto_exports.createDecipheriv = function createDecipheriv(cipher, key2, iv, options) {
    return new Decipheriv2(cipher, key2, iv, options);
  }, crypto_exports.getCiphers = getCiphers;
}
var getDecoder, Cipheriv, Decipheriv;
crypto_exports.scrypt = scrypt;
crypto_exports.scryptSync = scryptSync;
crypto_exports.publicEncrypt = publicEncrypt;
crypto_exports.publicDecrypt = publicDecrypt;
crypto_exports.privateEncrypt = privateEncrypt;
crypto_exports.privateDecrypt = privateDecrypt;
$ = crypto_exports;
return $})

