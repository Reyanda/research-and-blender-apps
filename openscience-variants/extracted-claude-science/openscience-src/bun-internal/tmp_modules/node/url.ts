(function (){"use strict";// build/release/tmp_modules/node/url.ts
var $, { URL, URLSearchParams } = globalThis, [domainToASCII, domainToUnicode] = @lazy(83), { urlToHttpOptions } = @getInternalField(@internalModuleRegistry, 63) || @createInternalModuleById(63), { validateString } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68);
function Url() {
  this.protocol = null, this.slashes = null, this.auth = null, this.host = null, this.port = null, this.hostname = null, this.hash = null, this.search = null, this.query = null, this.pathname = null, this.path = null, this.href = null;
}
Url.prototype = {};
var protocolPattern = /^([a-z0-9.+-]+:)/i, portPattern = /:[0-9]*$/, simplePathPattern = /^(\/\/?(?!\/)[^?\s]*)(\?[^\s]*)?$/, delims = ["<", ">", '"', "`", " ", "\r", `
`, "\t"], unwise = ["{", "}", "|", "\\", "^", "`"].concat(delims), autoEscape = ["'"].concat(unwise), nonHostChars = ["%", "/", "?", ";", "#"].concat(autoEscape), hostEndingChars = ["/", "?", "#"], hostnameMaxLen = 255, unsafeProtocol = {
  javascript: !0,
  "javascript:": !0
}, hostlessProtocol = {
  javascript: !0,
  "javascript:": !0
}, slashedProtocol = {
  http: !0,
  https: !0,
  ftp: !0,
  gopher: !0,
  file: !0,
  "http:": !0,
  "https:": !0,
  "ftp:": !0,
  "gopher:": !0,
  "file:": !0
};
function urlParse(url, parseQueryString, slashesDenoteHost) {
  if (@isObject(url) && url instanceof Url)
    return url;
  var u = new Url;
  try {
    u.parse(url, parseQueryString, slashesDenoteHost);
  } catch (e) {
    throw @putByIdDirect(e, "input", url), e;
  }
  return u;
}
Url.prototype.parse = function parse(url, parseQueryString, slashesDenoteHost) {
  validateString(url, "url");
  let hasHash = !1, hasAt = !1, start = -1, end = -1, rest = "", lastPos = 0;
  for (let i2 = 0, inWs = !1, split = !1;i2 < url.length; ++i2) {
    let code = url.@charCodeAt(i2), isWs = code < 33 || code === 160 /* NO_BREAK_SPACE */ || code === 65279 /* ZERO_WIDTH_NOBREAK_SPACE */;
    if (start === -1) {
      if (isWs)
        continue;
      lastPos = start = i2;
    } else if (inWs) {
      if (!isWs)
        end = -1, inWs = !1;
    } else if (isWs)
      end = i2, inWs = !0;
    if (!split)
      switch (code) {
        case 64 /* AT */:
          hasAt = !0;
          break;
        case 35 /* HASH */:
          hasHash = !0;
        case 63 /* QUESTION_MARK */:
          split = !0;
          break;
        case 92 /* BACKWARD_SLASH */:
          if (i2 - lastPos > 0)
            rest += url.slice(lastPos, i2);
          rest += "/", lastPos = i2 + 1;
          break;
      }
    else if (!hasHash && code === 35 /* HASH */)
      hasHash = !0;
  }
  if (start !== -1) {
    if (lastPos === start)
      if (end === -1)
        if (start === 0)
          rest = url;
        else
          rest = url.slice(start);
      else
        rest = url.slice(start, end);
    else if (end === -1 && lastPos < url.length)
      rest += url.slice(lastPos);
    else if (end !== -1 && lastPos < end)
      rest += url.slice(lastPos, end);
  }
  if (!slashesDenoteHost && !hasHash && !hasAt) {
    let simplePath = simplePathPattern.exec(rest);
    if (simplePath) {
      if (this.path = rest, this.href = rest, this.pathname = simplePath[1], simplePath[2])
        if (this.search = simplePath[2], parseQueryString)
          this.query = new URLSearchParams(this.search.slice(1)).toJSON();
        else
          this.query = this.search.slice(1);
      else if (parseQueryString)
        this.search = null, this.query = Object.create(null);
      return this;
    }
  }
  var proto = protocolPattern.exec(rest);
  if (proto) {
    proto = proto[0];
    var lowerProto = proto.toLowerCase();
    this.protocol = lowerProto, rest = rest.substring(proto.length);
  }
  let slashes;
  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@/]+@[^@/]+/)) {
    if (slashes = rest.substring(0, 2) === "//", slashes && !(proto && hostlessProtocol[proto]))
      rest = rest.substring(2), this.slashes = !0;
  }
  if (!hostlessProtocol[proto] && (slashes || proto && !slashedProtocol[proto])) {
    var hostEnd = -1;
    for (var i = 0;i < hostEndingChars.length; i++) {
      var hec = rest.indexOf(hostEndingChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }
    var auth, atSign;
    if (hostEnd === -1)
      atSign = rest.lastIndexOf("@");
    else
      atSign = rest.lastIndexOf("@", hostEnd);
    if (atSign !== -1)
      auth = rest.slice(0, atSign), rest = rest.slice(atSign + 1), this.auth = decodeURIComponent(auth);
    hostEnd = -1;
    for (var i = 0;i < nonHostChars.length; i++) {
      var hec = rest.indexOf(nonHostChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }
    if (hostEnd === -1)
      hostEnd = rest.length;
    if (this.host = rest.slice(0, hostEnd), rest = rest.slice(hostEnd), this.parseHost(), typeof this.hostname !== "string")
      this.hostname = "";
    let hostname = this.hostname;
    var ipv6Hostname = isIpv6Hostname(this.hostname);
    if (!ipv6Hostname)
      rest = getHostname(this, rest, hostname, url);
    if (this.hostname.length > hostnameMaxLen)
      this.hostname = "";
    else
      this.hostname = this.hostname.toLowerCase();
    if (this.hostname)
      this.hostname = new URL("http://" + this.hostname).hostname;
    var p = this.port ? ":" + this.port : "", h = this.hostname || "";
    if (this.host = h + p, this.href += this.host, ipv6Hostname) {
      if (this.hostname = this.hostname.slice(1, -1), rest[0] !== "/")
        rest = "/" + rest;
    }
  }
  if (!unsafeProtocol[lowerProto])
    for (var i = 0, l = autoEscape.length;i < l; i++) {
      var ae = autoEscape[i];
      if (rest.indexOf(ae) === -1)
        continue;
      var esc = encodeURIComponent(ae);
      if (esc === ae)
        esc = escape(ae);
      rest = rest.split(ae).join(esc);
    }
  var hash = rest.indexOf("#");
  if (hash !== -1)
    this.hash = rest.substring(hash), rest = rest.slice(0, hash);
  var qm = rest.indexOf("?");
  if (qm !== -1) {
    if (this.search = rest.substring(qm), this.query = rest.substring(qm + 1), parseQueryString) {
      let query = this.query;
      this.query = new URLSearchParams(query).toJSON();
    }
    rest = rest.slice(0, qm);
  } else if (parseQueryString)
    this.search = null, this.query = {};
  if (rest)
    this.pathname = rest;
  if (slashedProtocol[lowerProto] && this.hostname && !this.pathname)
    this.pathname = "/";
  if (this.pathname || this.search) {
    var p = this.pathname || "", s = this.search || "";
    this.path = p + s;
  }
  return this.href = this.format(), this;
};
function isIpv6Hostname(hostname) {
  return hostname.@charCodeAt(0) === 91 /* LEFT_SQUARE_BRACKET */ && hostname.@charCodeAt(@toLength(hostname.length - 1)) === 93 /* RIGHT_SQUARE_BRACKET */;
}
var warnInvalidPort = !0;
function getHostname(self, rest, hostname, url) {
  for (let i = 0;i < hostname.length; ++i) {
    let code = hostname.@charCodeAt(i);
    if (!(code !== 47 /* FORWARD_SLASH */ && code !== 92 /* BACKWARD_SLASH */ && code !== 35 /* HASH */ && code !== 63 /* QUESTION_MARK */ && code !== 58 /* COLON */)) {
      if (warnInvalidPort && code === 58 /* COLON */) {
        let detail = `The URL ${url} is invalid. Future versions of Node.js will throw an error.`;
        process.emitWarning(detail, "DeprecationWarning", "DEP0170"), warnInvalidPort = !1;
      }
      return self.hostname = hostname.slice(0, i), `/${hostname.slice(i)}${rest}`;
    }
  }
  return rest;
}
function urlFormat(urlObject) {
  if (typeof urlObject === "string")
    urlObject = urlParse(urlObject);
  else if (typeof urlObject !== "object" || urlObject === null)
    throw @makeErrorWithCode(118, "urlObject", ["Object", "string"], urlObject);
  if (!(urlObject instanceof Url))
    return Url.prototype.format.@call(urlObject);
  return urlObject.format();
}
Url.prototype.format = function format() {
  var auth = this.auth || "";
  if (auth)
    auth = encodeURIComponent(auth), auth = auth.replace(/%3A/i, ":"), auth += "@";
  var protocol = this.protocol || "", pathname = this.pathname || "", hash = this.hash || "", host = "", query = "";
  if (this.host)
    host = auth + this.host;
  else if (this.hostname) {
    if (host = auth + (this.hostname.indexOf(":") === -1 ? this.hostname : "[" + this.hostname + "]"), this.port)
      host += ":" + this.port;
  }
  if (this.query && typeof this.query === "object" && Object.keys(this.query).length)
    query = new URLSearchParams(this.query).toString();
  var search = this.search || query && "?" + query || "";
  if (protocol && protocol.substr(-1) !== ":")
    protocol += ":";
  if (this.slashes || (!protocol || slashedProtocol[protocol]) && host.length > 0) {
    if (host = "//" + (host || ""), pathname && pathname.charAt(0) !== "/")
      pathname = "/" + pathname;
  } else if (!host)
    host = "";
  if (hash && hash.charAt(0) !== "#")
    hash = "#" + hash;
  if (search && search.charAt(0) !== "?")
    search = "?" + search;
  return pathname = pathname.replace(/[?#]/g, function(match) {
    return encodeURIComponent(match);
  }), search = search.replace("#", "%23"), protocol + host + pathname + search + hash;
};
function urlResolve(source, relative) {
  return urlParse(source, !1, !0).resolve(relative);
}
Url.prototype.resolve = function resolve(relative) {
  return this.resolveObject(urlParse(relative, !1, !0)).format();
};
function urlResolveObject(source, relative) {
  if (!source)
    return relative;
  return urlParse(source, !1, !0).resolveObject(relative);
}
Url.prototype.resolveObject = function resolveObject(relative) {
  if (typeof relative === "string") {
    var rel = new Url;
    rel.parse(relative, !1, !0), relative = rel;
  }
  var result = new Url, tkeys = Object.keys(this);
  for (var tk = 0;tk < tkeys.length; tk++) {
    var tkey = tkeys[tk];
    result[tkey] = this[tkey];
  }
  if (result.hash = relative.hash, relative.href === "")
    return result.href = result.format(), result;
  if (relative.slashes && !relative.protocol) {
    var rkeys = Object.keys(relative);
    for (var rk = 0;rk < rkeys.length; rk++) {
      var rkey = rkeys[rk];
      if (rkey !== "protocol")
        result[rkey] = relative[rkey];
    }
    if (slashedProtocol[result.protocol] && result.hostname && !result.pathname)
      result.pathname = "/", result.path = result.pathname;
    return result.href = result.format(), result;
  }
  if (relative.protocol && relative.protocol !== result.protocol) {
    if (!slashedProtocol[relative.protocol]) {
      var keys = Object.keys(relative);
      for (var v = 0;v < keys.length; v++) {
        var k = keys[v];
        result[k] = relative[k];
      }
      return result.href = result.format(), result;
    }
    if (result.protocol = relative.protocol, !relative.host && !(relative.protocol === "file" || relative.protocol === "file:") && !hostlessProtocol[relative.protocol]) {
      let relPath2 = (relative.pathname || "").split("/");
      while (relPath2.length && !(relative.host = relPath2.shift()))
        ;
      if (relative.host ||= "", relative.hostname ||= "", relPath2[0] !== "")
        relPath2.unshift("");
      if (relPath2.length < 2)
        relPath2.unshift("");
      result.pathname = relPath2.join("/");
    } else
      result.pathname = relative.pathname;
    if (result.search = relative.search, result.query = relative.query, result.host = relative.host || "", result.auth = relative.auth, result.hostname = relative.hostname || relative.host, result.port = relative.port, result.pathname || result.search) {
      var p = result.pathname || "", s = result.search || "";
      result.path = p + s;
    }
    return result.slashes = result.slashes || relative.slashes, result.href = result.format(), result;
  }
  let isSourceAbs = result.pathname && result.pathname.charAt(0) === "/", isRelAbs = relative.host || relative.pathname && relative.pathname.charAt(0) === "/", mustEndAbs = isRelAbs || isSourceAbs || result.host && relative.pathname, removeAllDots = mustEndAbs, srcPath = result.pathname && result.pathname.split("/") || [], relPath = relative.pathname && relative.pathname.split("/") || [], psychotic = result.protocol && !slashedProtocol[result.protocol];
  if (psychotic) {
    if (result.hostname = "", result.port = null, result.host)
      if (srcPath[0] === "")
        srcPath[0] = result.host;
      else
        srcPath.unshift(result.host);
    if (result.host = "", relative.protocol) {
      if (relative.hostname = null, relative.port = null, result.auth = null, relative.host)
        if (relPath[0] === "")
          relPath[0] = relative.host;
        else
          relPath.unshift(relative.host);
      relative.host = null;
    }
    mustEndAbs &&= relPath[0] === "" || srcPath[0] === "";
  }
  if (isRelAbs) {
    if (relative.host || relative.host === "") {
      if (result.host !== relative.host)
        result.auth = null;
      result.host = relative.host, result.port = relative.port;
    }
    if (relative.hostname || relative.hostname === "") {
      if (result.hostname !== relative.hostname)
        result.auth = null;
      result.hostname = relative.hostname;
    }
    result.search = relative.search, result.query = relative.query, srcPath = relPath;
  } else if (relPath.length)
    srcPath ||= [], srcPath.pop(), srcPath = srcPath.concat(relPath), result.search = relative.search, result.query = relative.query;
  else if (relative.search != null && relative.search !== @undefined) {
    if (psychotic) {
      result.hostname = result.host = srcPath.shift();
      var authInHost = result.host && result.host.indexOf("@") > 0 ? result.host.split("@") : !1;
      if (authInHost)
        result.auth = authInHost.shift(), result.hostname = result.host = authInHost.shift();
    }
    if (result.search = relative.search, result.query = relative.query, result.pathname !== null || result.search !== null)
      result.path = (result.pathname ? result.pathname : "") + (result.search ? result.search : "");
    return result.href = result.format(), result;
  }
  if (!srcPath.length) {
    if (result.pathname = null, result.search)
      result.path = "/" + result.search;
    else
      result.path = null;
    return result.href = result.format(), result;
  }
  var last = srcPath.slice(-1)[0], hasTrailingSlash = (result.host || relative.host || srcPath.length > 1) && (last === "." || last === "..") || last === "", up = 0;
  for (var i = srcPath.length;i >= 0; i--)
    if (last = srcPath[i], last === ".")
      srcPath.splice(i, 1);
    else if (last === "..")
      srcPath.splice(i, 1), up++;
    else if (up)
      srcPath.splice(i, 1), up--;
  if (!mustEndAbs && !removeAllDots)
    for (;up--; up)
      srcPath.unshift("..");
  if (mustEndAbs && srcPath[0] !== "" && (!srcPath[0] || srcPath[0].charAt(0) !== "/"))
    srcPath.unshift("");
  if (hasTrailingSlash && srcPath.join("/").substr(-1) !== "/")
    srcPath.push("");
  var isAbsolute = srcPath[0] === "" || srcPath[0] && srcPath[0].charAt(0) === "/";
  if (psychotic) {
    result.hostname = isAbsolute ? "" : srcPath.length ? srcPath.shift() : "", result.host = result.hostname;
    var authInHost = result.host && result.host.indexOf("@") > 0 ? result.host.split("@") : !1;
    if (authInHost)
      result.auth = authInHost.shift(), result.hostname = result.host = authInHost.shift();
  }
  if (mustEndAbs ||= result.host && srcPath.length, mustEndAbs && !isAbsolute)
    srcPath.unshift("");
  if (srcPath.length > 0)
    result.pathname = srcPath.join("/");
  else
    result.pathname = null, result.path = null;
  if (result.pathname !== null || result.search !== null)
    result.path = (result.pathname ? result.pathname : "") + (result.search ? result.search : "");
  return result.auth = relative.auth || result.auth, result.slashes = result.slashes || relative.slashes, result.href = result.format(), result;
};
Url.prototype.parseHost = function parseHost() {
  var host = this.host, port = portPattern.exec(host);
  if (port) {
    if (port = port[0], port !== ":")
      this.port = port.slice(1);
    host = host.slice(0, host.length - port.length);
  }
  if (host)
    this.hostname = host;
};
$ = {
  parse: urlParse,
  resolve: urlResolve,
  resolveObject: urlResolveObject,
  format: urlFormat,
  Url,
  URLSearchParams,
  URL,
  pathToFileURL: Bun.pathToFileURL,
  fileURLToPath: Bun.fileURLToPath,
  urlToHttpOptions,
  domainToASCII,
  domainToUnicode
};
return $})

