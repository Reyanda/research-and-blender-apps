(function (){"use strict";// build/release/tmp_modules/node/dns.ts
var $, dns = Bun.dns, utilPromisifyCustomSymbol = Symbol.for("nodejs.util.promisify.custom"), { isIP } = @getInternalField(@internalModuleRegistry, 28) || @createInternalModuleById(28), {
  validateFunction,
  validateArray,
  validateString,
  validateBoolean,
  validateNumber
} = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), errorCodes = {
  NODATA: "ENODATA",
  FORMERR: "EFORMERR",
  SERVFAIL: "ESERVFAIL",
  NOTFOUND: "ENOTFOUND",
  NOTIMP: "ENOTIMP",
  REFUSED: "EREFUSED",
  BADQUERY: "EBADQUERY",
  BADNAME: "EBADNAME",
  BADFAMILY: "EBADFAMILY",
  BADRESP: "EBADRESP",
  CONNREFUSED: "ECONNREFUSED",
  TIMEOUT: "ETIMEOUT",
  EOF: "EOF",
  FILE: "EFILE",
  NOMEM: "ENOMEM",
  DESTRUCTION: "EDESTRUCTION",
  BADSTR: "EBADSTR",
  BADFLAGS: "EBADFLAGS",
  NONAME: "ENONAME",
  BADHINTS: "EBADHINTS",
  NOTINITIALIZED: "ENOTINITIALIZED",
  LOADIPHLPAPI: "ELOADIPHLPAPI",
  ADDRGETNETWORKPARAMS: "EADDRGETNETWORKPARAMS",
  CANCELLED: "ECANCELLED"
};
var IPv6RE = /^\[([^[\]]*)\]/, addrSplitRE = /(^.+?)(?::(\d+))?$/;
function translateErrorCode(promise) {
  return promise.catch((error) => {
    return @Promise.@reject(withTranslatedError(error));
  });
}
function withTranslatedError(error) {
  let code = error?.code;
  if (code?.startsWith?.("DNS_"))
    error.code = code.slice(4);
  return error;
}
function getServers() {
  return dns.getServers();
}
function setServers(servers) {
  return setServersOn(servers, dns);
}
var getRuntimeDefaultResultOrderOption = @lazy(49);
function newResolver(options) {
  if (!newResolver.zig)
    newResolver.zig = @lazy(50);
  return newResolver.zig(options);
}
function defaultResultOrder() {
  if (typeof defaultResultOrder.value > "u")
    defaultResultOrder.value = getRuntimeDefaultResultOrderOption();
  return defaultResultOrder.value;
}
function setDefaultResultOrder(order) {
  validateOrder(order), defaultResultOrder.value = order;
}
function getDefaultResultOrder() {
  return defaultResultOrder();
}
function setServersOn(servers, object) {
  validateArray(servers, "servers");
  let triples = [];
  servers.forEach((server, i) => {
    validateString(server, `servers[${i}]`);
    let ipVersion = isIP(server);
    if (ipVersion !== 0) {
      triples.push([ipVersion, server, 53]);
      return;
    }
    let match = IPv6RE.exec(server);
    if (match) {
      if (ipVersion = isIP(match[1]), ipVersion !== 0) {
        let port = parseInt(addrSplitRE[Symbol.replace](server, "$2")) || 53;
        triples.push([ipVersion, match[1], port]);
        return;
      }
    }
    let addrSplitMatch = addrSplitRE.exec(server);
    if (addrSplitMatch) {
      let hostIP = addrSplitMatch[1], port = addrSplitMatch[2] || 53;
      if (ipVersion = isIP(hostIP), ipVersion !== 0) {
        triples.push([ipVersion, hostIP, parseInt(port)]);
        return;
      }
    }
    throw @makeErrorWithCode(128, server);
  }), object.setServers(triples);
}
function validateFlagsOption(options) {
  if (options.flags === @undefined)
    return;
  if (validateNumber(options.flags), (options.flags & ~(dns.ALL | dns.ADDRCONFIG | dns.V4MAPPED)) != 0)
    throw @makeErrorWithCode(119, "hints", options.flags, "is invalid");
}
function validateFamily(family) {
  if (family !== 6 && family !== 4 && family !== 0)
    throw @makeErrorWithCode(119, "family", family, "must be one of 0, 4 or 6");
}
function validateFamilyOption(options) {
  if (options.family != null)
    switch (options.family) {
      case "IPv4":
        options.family = 4;
        break;
      case "IPv6":
        options.family = 6;
        break;
      default:
        validateFamily(options.family);
        break;
    }
}
function validateAllOption(options) {
  if (options.all !== @undefined)
    validateBoolean(options.all);
}
function validateVerbatimOption(options) {
  if (options.verbatim !== @undefined)
    validateBoolean(options.verbatim);
}
function validateOrder(order) {
  if (!["ipv4first", "ipv6first", "verbatim"].includes(order))
    throw @makeErrorWithCode(119, "order", order, "is invalid");
}
function validateOrderOption(options) {
  if (options.order !== @undefined)
    validateOrder(options.order);
}
function validateResolve(hostname, callback) {
  if (typeof hostname !== "string")
    throw @makeErrorWithCode(118, "hostname", "string", hostname);
  if (typeof callback !== "function")
    throw @makeErrorWithCode(118, "callback", "function", callback);
}
function validateLocalAddresses(first, second) {
  if (validateString(first), typeof second < "u")
    validateString(second);
}
function invalidHostname(hostname) {
  if (invalidHostname.warned)
    return;
  invalidHostname.warned = !0, process.emitWarning(`The provided hostname "${@String(hostname)}" is not a valid hostname, and is supported in the dns module solely for compatibility.`, "DeprecationWarning", "DEP0118");
}
function translateLookupOptions(options) {
  if (!options || typeof options !== "object")
    options = { family: options };
  let { family, order, verbatim, hints: flags, all } = options;
  if (order === @undefined && typeof verbatim === "boolean")
    order = verbatim ? "verbatim" : "ipv4first";
  return order ??= defaultResultOrder(), {
    family,
    flags,
    all,
    order,
    verbatim
  };
}
function validateLookupOptions(options) {
  validateFlagsOption(options), validateFamilyOption(options), validateAllOption(options), validateVerbatimOption(options), validateOrderOption(options);
}
function lookup(hostname, options, callback) {
  if (typeof hostname !== "string" && hostname)
    throw @makeErrorWithCode(118, "hostname", "string", hostname);
  if (typeof options === "function")
    callback = options, options = { family: 0 };
  else if (typeof options === "number")
    validateFunction(callback, "callback"), validateFamily(options), options = { family: options };
  else if (options !== @undefined && typeof options !== "object")
    throw validateFunction(arguments.length === 2 ? options : callback, "callback"), @makeErrorWithCode(118, "options", ["integer", "object"], options);
  if (validateFunction(callback, "callback"), options = translateLookupOptions(options), validateLookupOptions(options), !hostname) {
    if (invalidHostname(hostname), options.all)
      callback(null, []);
    else
      callback(null, null, 4);
    return;
  }
  let family = isIP(hostname);
  if (family) {
    if (options.all)
      process.nextTick(callback, null, [{ address: hostname, family }]);
    else
      process.nextTick(callback, null, hostname, family);
    return;
  }
  dns.lookup(hostname, options).then((res) => {
    if (throwIfEmpty(res), options.order == "ipv4first")
      res.sort((a, b) => a.family - b.family);
    else if (options.order == "ipv6first")
      res.sort((a, b) => b.family - a.family);
    if (options?.all)
      callback(null, res.map(mapLookupAll));
    else {
      let [{ address, family: family2 }] = res;
      callback(null, address, family2);
    }
  }).catch((err) => {
    if (err.code?.startsWith("DNS_"))
      err.code = err.code.slice(4);
    callback(err, @undefined, @undefined);
  });
}
function lookupService(address, port, callback) {
  if (arguments.length < 3)
    throw @makeErrorWithCode(150, "address", "port", "callback");
  if (typeof callback !== "function")
    throw @makeErrorWithCode(118, "callback", "function", callback);
  validateString(address), dns.lookupService(address, port).then((results) => {
    callback(null, ...results);
  }, (error) => {
    callback(withTranslatedError(error));
  });
}
function validateResolverOptions(options) {
  if (options === @undefined)
    return;
  for (let key of ["timeout", "tries"])
    if (key in options) {
      if (typeof options[key] !== "number")
        throw @makeErrorWithCode(118, key, "number", options[key]);
    }
  if ("timeout" in options) {
    let timeout = options.timeout;
    if (timeout < 0 && timeout != -1 || Math.floor(timeout) != timeout || timeout >= 2147483648)
      throw @makeErrorWithCode(156, "timeout", "Invalid timeout", timeout);
  }
}
var InternalResolver = class Resolver {
  #resolver;
  constructor(options) {
    validateResolverOptions(options), this.#resolver = this._handle = newResolver(options);
  }
  cancel() {
    this.#resolver.cancel();
  }
  static #getResolver(object) {
    return typeof object < "u" && #resolver in object ? object.#resolver : dns;
  }
  getServers() {
    return Resolver.#getResolver(this).getServers() || [];
  }
  resolve(hostname, rrtype, callback) {
    if (typeof rrtype === "function")
      callback = rrtype, rrtype = "A";
    else if (typeof rrtype > "u")
      rrtype = "A";
    else if (typeof rrtype !== "string")
      throw @makeErrorWithCode(118, "rrtype", "string", rrtype);
    validateResolve(hostname, callback), Resolver.#getResolver(this).resolve(hostname, rrtype).then((results) => {
      switch (rrtype?.toLowerCase()) {
        case "a":
        case "aaaa":
          callback(null, results.map(mapResolveX));
          break;
        default:
          callback(null, results);
          break;
      }
    }, (error) => {
      callback(withTranslatedError(error));
    });
  }
  resolve4(hostname, options, callback) {
    if (typeof options == "function")
      callback = options, options = null;
    validateResolve(hostname, callback), Resolver.#getResolver(this).resolve(hostname, "A").then((addresses) => {
      callback(null, options?.ttl ? addresses : addresses.map(mapResolveX));
    }, (error) => {
      callback(withTranslatedError(error));
    });
  }
  resolve6(hostname, options, callback) {
    if (typeof options == "function")
      callback = options, options = null;
    validateResolve(hostname, callback), Resolver.#getResolver(this).resolve(hostname, "AAAA").then((addresses) => {
      callback(null, options?.ttl ? addresses : addresses.map(mapResolveX));
    }, (error) => {
      callback(withTranslatedError(error));
    });
  }
  resolveAny(hostname, callback) {
    validateResolve(hostname, callback), Resolver.#getResolver(this).resolveAny(hostname).then((results) => {
      callback(null, results);
    }, (error) => {
      callback(withTranslatedError(error));
    });
  }
  resolveCname(hostname, callback) {
    validateResolve(hostname, callback), Resolver.#getResolver(this).resolveCname(hostname).then((results) => {
      callback(null, results);
    }, (error) => {
      callback(withTranslatedError(error));
    });
  }
  resolveMx(hostname, callback) {
    validateResolve(hostname, callback), Resolver.#getResolver(this).resolveMx(hostname).then((results) => {
      callback(null, results);
    }, (error) => {
      callback(withTranslatedError(error));
    });
  }
  resolveNaptr(hostname, callback) {
    validateResolve(hostname, callback), Resolver.#getResolver(this).resolveNaptr(hostname).then((results) => {
      callback(null, results);
    }, (error) => {
      callback(withTranslatedError(error));
    });
  }
  resolveNs(hostname, callback) {
    validateResolve(hostname, callback), Resolver.#getResolver(this).resolveNs(hostname).then((results) => {
      callback(null, results);
    }, (error) => {
      callback(withTranslatedError(error));
    });
  }
  resolvePtr(hostname, callback) {
    validateResolve(hostname, callback), Resolver.#getResolver(this).resolvePtr(hostname).then((results) => {
      callback(null, results);
    }, (error) => {
      callback(withTranslatedError(error));
    });
  }
  resolveSrv(hostname, callback) {
    validateResolve(hostname, callback), Resolver.#getResolver(this).resolveSrv(hostname).then((results) => {
      callback(null, results);
    }, (error) => {
      callback(withTranslatedError(error));
    });
  }
  resolveCaa(hostname, callback) {
    if (typeof callback !== "function")
      throw @makeErrorWithCode(118, "callback", "function", callback);
    Resolver.#getResolver(this).resolveCaa(hostname).then((results) => {
      callback(null, results);
    }, (error) => {
      callback(withTranslatedError(error));
    });
  }
  resolveTxt(hostname, callback) {
    if (typeof callback !== "function")
      throw @makeErrorWithCode(118, "callback", "function", callback);
    Resolver.#getResolver(this).resolveTxt(hostname).then((results) => {
      callback(null, results);
    }, (error) => {
      callback(withTranslatedError(error));
    });
  }
  resolveSoa(hostname, callback) {
    if (typeof callback !== "function")
      throw @makeErrorWithCode(118, "callback", "function", callback);
    Resolver.#getResolver(this).resolveSoa(hostname).then((results) => {
      callback(null, results);
    }, (error) => {
      callback(withTranslatedError(error));
    });
  }
  reverse(ip, callback) {
    if (typeof callback !== "function")
      throw @makeErrorWithCode(118, "callback", "function", callback);
    Resolver.#getResolver(this).reverse(ip).then((results) => {
      callback(null, results);
    }, (error) => {
      callback(withTranslatedError(error));
    });
  }
  setLocalAddress(first, second) {
    validateLocalAddresses(first, second), Resolver.#getResolver(this).setLocalAddress(first, second);
  }
  setServers(servers) {
    return setServersOn(servers, Resolver.#getResolver(this));
  }
};
function Resolver2(options) {
  return new InternalResolver(options);
}
@toClass(Resolver2, "Resolver", InternalResolver);
var {
  resolve,
  resolve4,
  resolve6,
  resolveAny,
  resolveCname,
  resolveCaa,
  resolveMx,
  resolveNaptr,
  resolveNs,
  resolvePtr,
  resolveSoa,
  resolveSrv,
  reverse,
  resolveTxt
} = InternalResolver.prototype, mapLookupAll = (res) => {
  let { address, family } = res;
  return { address, family };
};
function throwIfEmpty(res) {
  if (res.length === 0) {
    let err = Error("No records found");
    throw err.name = "DNSException", err.code = "ENODATA", err.errno = 1, err.syscall = "getaddrinfo", err;
  }
}
Object.defineProperty(throwIfEmpty, "name", { value: "::bunternal::" });
var promisifyLookup = (order) => (res) => {
  if (throwIfEmpty(res), order == "ipv4first")
    res.sort((a, b) => a.family - b.family);
  else if (order == "ipv6first")
    res.sort((a, b) => b.family - a.family);
  let [{ address, family }] = res;
  return { address, family };
}, promisifyLookupAll = (order) => (res) => {
  if (throwIfEmpty(res), order == "ipv4first")
    res.sort((a, b) => a.family - b.family);
  else if (order == "ipv6first")
    res.sort((a, b) => b.family - a.family);
  return res.map(mapLookupAll);
}, mapResolveX = (a) => a.address, promisifyResolveX = (ttl) => {
  if (ttl)
    return (res) => res;
  else
    return (res) => {
      return res?.map(mapResolveX);
    };
}, promises = {
  ...errorCodes,
  lookup(hostname, options) {
    if (typeof hostname !== "string" && hostname)
      throw @makeErrorWithCode(118, "hostname", "string", hostname);
    if (typeof options === "number")
      validateFamily(options), options = { family: options };
    else if (options !== @undefined && typeof options !== "object")
      throw @makeErrorWithCode(118, "options", ["integer", "object"], options);
    if (options = translateLookupOptions(options), validateLookupOptions(options), !hostname)
      return invalidHostname(hostname), @Promise.@resolve(options.all ? [] : {
        address: null,
        family: 4
      });
    let family = isIP(hostname);
    if (family) {
      let obj = { address: hostname, family };
      return @Promise.@resolve(options.all ? [obj] : obj);
    }
    if (options.all)
      return translateErrorCode(dns.lookup(hostname, options).then(promisifyLookupAll(options.order)));
    return translateErrorCode(dns.lookup(hostname, options).then(promisifyLookup(options.order)));
  },
  lookupService(address, port) {
    if (arguments.length !== 2)
      throw @makeErrorWithCode(150, "address", "port");
    validateString(address);
    try {
      return translateErrorCode(dns.lookupService(address, port)).then(([hostname, service]) => ({
        hostname,
        service
      }));
    } catch (err) {
      if (err.name === "TypeError" || err.name === "RangeError")
        throw err;
      return @Promise.@reject(withTranslatedError(err));
    }
  },
  resolve(hostname, rrtype) {
    if (typeof hostname !== "string")
      throw @makeErrorWithCode(118, "hostname", "string", hostname);
    if (typeof rrtype > "u")
      rrtype = "A";
    else if (typeof rrtype !== "string")
      throw @makeErrorWithCode(118, "rrtype", "string", rrtype);
    switch (rrtype?.toLowerCase()) {
      case "a":
      case "aaaa":
        return translateErrorCode(dns.resolve(hostname, rrtype).then(promisifyResolveX(!1)));
      default:
        return translateErrorCode(dns.resolve(hostname, rrtype));
    }
  },
  resolve4(hostname, options) {
    return translateErrorCode(dns.resolve(hostname, "A").then(promisifyResolveX(options?.ttl)));
  },
  resolve6(hostname, options) {
    return translateErrorCode(dns.resolve(hostname, "AAAA").then(promisifyResolveX(options?.ttl)));
  },
  resolveAny(hostname) {
    return translateErrorCode(dns.resolveAny(hostname));
  },
  resolveSrv(hostname) {
    return translateErrorCode(dns.resolveSrv(hostname));
  },
  resolveTxt(hostname) {
    return translateErrorCode(dns.resolveTxt(hostname));
  },
  resolveSoa(hostname) {
    return translateErrorCode(dns.resolveSoa(hostname));
  },
  resolveNaptr(hostname) {
    return translateErrorCode(dns.resolveNaptr(hostname));
  },
  resolveMx(hostname) {
    return translateErrorCode(dns.resolveMx(hostname));
  },
  resolveCaa(hostname) {
    return translateErrorCode(dns.resolveCaa(hostname));
  },
  resolveNs(hostname) {
    return translateErrorCode(dns.resolveNs(hostname));
  },
  resolvePtr(hostname) {
    return translateErrorCode(dns.resolvePtr(hostname));
  },
  resolveCname(hostname) {
    return translateErrorCode(dns.resolveCname(hostname));
  },
  reverse(ip) {
    return translateErrorCode(dns.reverse(ip));
  },
  Resolver: class Resolver3 {
    #resolver;
    constructor(options) {
      validateResolverOptions(options), this.#resolver = this._handle = newResolver(options);
    }
    cancel() {
      this.#resolver.cancel();
    }
    static #getResolver(object) {
      return typeof object < "u" && #resolver in object ? object.#resolver : dns;
    }
    getServers() {
      return Resolver3.#getResolver(this).getServers() || [];
    }
    resolve(hostname, rrtype) {
      if (typeof rrtype > "u")
        rrtype = "A";
      else if (typeof rrtype !== "string")
        rrtype = null;
      switch (rrtype?.toLowerCase()) {
        case "a":
        case "aaaa":
          return translateErrorCode(Resolver3.#getResolver(this).resolve(hostname, rrtype).then(promisifyResolveX(!1)));
        default:
          return translateErrorCode(Resolver3.#getResolver(this).resolve(hostname, rrtype));
      }
    }
    resolve4(hostname, options) {
      return translateErrorCode(Resolver3.#getResolver(this).resolve(hostname, "A").then(promisifyResolveX(options?.ttl)));
    }
    resolve6(hostname, options) {
      return translateErrorCode(Resolver3.#getResolver(this).resolve(hostname, "AAAA").then(promisifyResolveX(options?.ttl)));
    }
    resolveAny(hostname) {
      return translateErrorCode(Resolver3.#getResolver(this).resolveAny(hostname));
    }
    resolveCname(hostname) {
      return translateErrorCode(Resolver3.#getResolver(this).resolveCname(hostname));
    }
    resolveMx(hostname) {
      return translateErrorCode(Resolver3.#getResolver(this).resolveMx(hostname));
    }
    resolveNaptr(hostname) {
      return translateErrorCode(Resolver3.#getResolver(this).resolveNaptr(hostname));
    }
    resolveNs(hostname) {
      return translateErrorCode(Resolver3.#getResolver(this).resolveNs(hostname));
    }
    resolvePtr(hostname) {
      return translateErrorCode(Resolver3.#getResolver(this).resolvePtr(hostname));
    }
    resolveSoa(hostname) {
      return translateErrorCode(Resolver3.#getResolver(this).resolveSoa(hostname));
    }
    resolveSrv(hostname) {
      return translateErrorCode(Resolver3.#getResolver(this).resolveSrv(hostname));
    }
    resolveCaa(hostname) {
      return translateErrorCode(Resolver3.#getResolver(this).resolveCaa(hostname));
    }
    resolveTxt(hostname) {
      return translateErrorCode(Resolver3.#getResolver(this).resolveTxt(hostname));
    }
    reverse(ip) {
      return translateErrorCode(Resolver3.#getResolver(this).reverse(ip));
    }
    setLocalAddress(first, second) {
      validateLocalAddresses(first, second), Resolver3.#getResolver(this).setLocalAddress(first, second);
    }
    setServers(servers) {
      return setServersOn(servers, Resolver3.#getResolver(this));
    }
  },
  getDefaultResultOrder,
  setDefaultResultOrder,
  getServers,
  setServers
};
for (let [method, pMethod] of [
  [lookup, promises.lookup],
  [lookupService, promises.lookupService],
  [resolve, promises.resolve],
  [reverse, promises.reverse],
  [resolve4, promises.resolve4],
  [resolve6, promises.resolve6],
  [resolveAny, promises.resolveAny],
  [resolveCname, promises.resolveCname],
  [resolveCaa, promises.resolveCaa],
  [resolveMx, promises.resolveMx],
  [resolveNs, promises.resolveNs],
  [resolvePtr, promises.resolvePtr],
  [resolveSoa, promises.resolveSoa],
  [resolveSrv, promises.resolveSrv],
  [resolveTxt, promises.resolveTxt],
  [resolveNaptr, promises.resolveNaptr]
])
  method[utilPromisifyCustomSymbol] = pMethod;
$ = {
  ADDRCONFIG: dns.ADDRCONFIG,
  ALL: dns.ALL,
  V4MAPPED: dns.V4MAPPED,
  ...errorCodes,
  lookup,
  lookupService,
  Resolver: Resolver2,
  setServers,
  setDefaultResultOrder,
  getDefaultResultOrder,
  resolve,
  reverse,
  resolve4,
  resolve6,
  resolveAny,
  resolveCname,
  resolveCaa,
  resolveMx,
  resolveNs,
  resolvePtr,
  resolveSoa,
  resolveSrv,
  resolveTxt,
  resolveNaptr,
  promises,
  getServers
};
return $})

