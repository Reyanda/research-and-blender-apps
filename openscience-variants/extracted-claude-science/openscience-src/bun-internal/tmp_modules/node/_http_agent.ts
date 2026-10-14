(function (){"use strict";// build/release/tmp_modules/node/_http_agent.ts
var $, EventEmitter = @getInternalField(@internalModuleRegistry, 96) || @createInternalModuleById(96), { parseProxyConfigFromEnv, kProxyConfig, checkShouldUseProxy, kWaitForProxyTunnel } = @getInternalField(@internalModuleRegistry, 25) || @createInternalModuleById(25), { getLazy, kEmptyObject, once } = @getInternalField(@internalModuleRegistry, 32) || @createInternalModuleById(32), { validateNumber, validateOneOf, validateString } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), { isIP } = @getInternalField(@internalModuleRegistry, 28) || @createInternalModuleById(28), kOnKeylog = Symbol("onkeylog"), kRequestOptions = Symbol("requestOptions");
function freeSocketErrorListener(err) {
  let socket = this;
  socket.destroy(), socket.emit("agentRemove");
}
function Agent(options) {
  if (!(this instanceof Agent))
    return new Agent(options);
  if (EventEmitter.@call(this), this.options = { __proto__: null, ...options }, this.defaultPort = this.options.defaultPort || 80, this.protocol = this.options.protocol || "http:", this.options.noDelay === @undefined)
    this.options.noDelay = !0;
  this.options.path = null, this.requests = { __proto__: null }, this.sockets = { __proto__: null }, this.freeSockets = { __proto__: null }, this.keepAliveMsecs = this.options.keepAliveMsecs || 1000, this.keepAlive = this.options.keepAlive || !1, this.maxSockets = this.options.maxSockets || Agent.defaultMaxSockets, this.maxFreeSockets = this.options.maxFreeSockets || 256, this.scheduling = this.options.scheduling || "lifo", this.maxTotalSockets = this.options.maxTotalSockets, this.totalSocketCount = 0, this.agentKeepAliveTimeoutBuffer = typeof this.options.agentKeepAliveTimeoutBuffer === "number" && this.options.agentKeepAliveTimeoutBuffer >= 0 && Number.isFinite(this.options.agentKeepAliveTimeoutBuffer) ? this.options.agentKeepAliveTimeoutBuffer : 1000;
  let proxyEnv = this.options.proxyEnv;
  if (typeof proxyEnv === "object" && proxyEnv !== null)
    this[kProxyConfig] = parseProxyConfigFromEnv(proxyEnv, this.protocol, this.keepAlive);
  if (validateOneOf(this.scheduling, "scheduling", ["fifo", "lifo"]), this.maxTotalSockets !== @undefined)
    validateNumber(this.maxTotalSockets, "maxTotalSockets", 1);
  else
    this.maxTotalSockets = @Infinity;
  this.on("free", (socket, options2) => {
    let name = this.getName(options2);
    if (!socket.writable) {
      socket.destroy();
      return;
    }
    let requests = this.requests[name];
    if (requests?.length) {
      let req2 = requests.shift();
      if (setRequestSocket(this, req2, socket), requests.length === 0)
        delete this.requests[name];
      return;
    }
    let req = socket._httpMessage;
    if (!req || !req.shouldKeepAlive || !this.keepAlive) {
      socket.destroy();
      return;
    }
    let freeSockets = this.freeSockets[name] || [], freeLen = freeSockets.length, count = freeLen;
    if (this.sockets[name])
      count += this.sockets[name].length;
    if (this.totalSocketCount > this.maxTotalSockets || count > this.maxSockets || freeLen >= this.maxFreeSockets || !this.keepSocketAlive(socket)) {
      socket.destroy();
      return;
    }
    this.freeSockets[name] = freeSockets, socket._httpMessage = null, this.removeSocket(socket, options2), socket.once("error", freeSocketErrorListener), freeSockets.push(socket);
  }), this.on("newListener", maybeEnableKeylog);
}
@toClass(Agent, "Agent", EventEmitter);
function maybeEnableKeylog(eventName) {
  if (eventName === "keylog") {
    this.removeListener("newListener", maybeEnableKeylog);
    let agent = this;
    this[kOnKeylog] = function onkeylog(keylog) {
      agent.emit("keylog", keylog, this);
    };
    let sockets = Object.values(this.sockets);
    for (let i = 0;i < sockets.length; i++)
      sockets[i].on("keylog", this[kOnKeylog]);
  }
}
var tls = getLazy(() => @getInternalField(@internalModuleRegistry, 122) || @createInternalModuleById(122)), net = getLazy(() => @getInternalField(@internalModuleRegistry, 104) || @createInternalModuleById(104));
Agent.defaultMaxSockets = @Infinity;
Agent.prototype.createConnection = function createConnection(...args) {
  let normalized = net()._normalizeArgs(args), options = normalized[0], cb = normalized[1];
  if (!checkShouldUseProxy(this[kProxyConfig], options))
    return net().createConnection(...args);
  let connectOptions = {
    ...this[kProxyConfig].proxyConnectionOptions
  }, proxyProtocol = this[kProxyConfig].protocol;
  if (proxyProtocol === "http:")
    return net().connect(connectOptions, cb);
  else if (proxyProtocol === "https:")
    return tls().connect(connectOptions, cb);
};
Agent.prototype.getName = function getName(options = kEmptyObject) {
  let name = options.host || "localhost";
  if (name += ":", options.port)
    name += options.port;
  if (name += ":", options.localAddress)
    name += options.localAddress;
  if (options.family === 4 || options.family === 6)
    name += `:${options.family}`;
  if (options.socketPath)
    name += `:${options.socketPath}`;
  return name;
};
function handleSocketAfterProxy(err, req) {
  if (err.code === "ERR_PROXY_TUNNEL")
    if (err.proxyTunnelTimeout)
      req.emit("timeout");
    else
      req.emit("error", err);
}
Agent.prototype.addRequest = function addRequest(req, options, port, localAddress) {
  return;
};
Agent.prototype.createSocket = function createSocket(req, options, cb) {
  if (options = { __proto__: null, ...options, ...this.options }, options.socketPath)
    options.path = options.socketPath;
  normalizeServerName(options, req);
  let timeout = req.timeout || this.options.timeout || @undefined;
  if (timeout)
    options.timeout = timeout;
  let name = this.getName(options);
  options._agentKey = name, options.encoding = null;
  let oncreate = once((err, s) => {
    if (err)
      return cb(err);
    this.sockets[name] ||= [], this.sockets[name].push(s), this.totalSocketCount++, installListeners(this, s, options), cb(null, s);
  });
  if (this.keepAlive)
    options.keepAlive = this.keepAlive, options.keepAliveInitialDelay = this.keepAliveMsecs;
  let newSocket = this.createConnection(options, oncreate);
  if (newSocket && !newSocket[kWaitForProxyTunnel])
    oncreate(null, newSocket);
};
function normalizeServerName(options, req) {
  if (!options.servername && options.servername !== "")
    options.servername = calculateServerName(options, req);
}
function calculateServerName(options, req) {
  let servername = options.host, hostHeader = req.getHeader("host");
  if (hostHeader)
    if (validateString(hostHeader, "options.headers.host"), hostHeader[0] === "[") {
      let index = hostHeader.indexOf("]");
      if (index === -1)
        servername = hostHeader;
      else
        servername = hostHeader.substring(1, index);
    } else
      servername = hostHeader.split(":", 1)[0];
  if (isIP(servername))
    servername = "";
  return servername;
}
function installListeners(agent, s, options) {
  function onFree() {
    agent.emit("free", s, options);
  }
  s.on("free", onFree);
  function onClose() {
    agent.totalSocketCount--, agent.removeSocket(s, options);
  }
  s.on("close", onClose);
  function onTimeout() {
    let sockets = agent.freeSockets;
    if (Object.keys(sockets).some((name) => sockets[name].includes(s)))
      return s.destroy();
  }
  s.on("timeout", onTimeout);
  function onRemove() {
    agent.totalSocketCount--, agent.removeSocket(s, options), s.removeListener("close", onClose), s.removeListener("free", onFree), s.removeListener("timeout", onTimeout), s.removeListener("agentRemove", onRemove);
  }
  if (s.on("agentRemove", onRemove), agent[kOnKeylog])
    s.on("keylog", agent[kOnKeylog]);
}
Agent.prototype.removeSocket = function removeSocket(s, options) {
  let name = this.getName(options), sets = [this.sockets];
  if (!s.writable)
    sets.push(this.freeSockets);
  for (let sk = 0;sk < sets.length; sk++) {
    let sockets = sets[sk], socket = sockets[name];
    if (socket) {
      let index = socket.indexOf(s);
      if (index !== -1) {
        if (socket.splice(index, 1), socket.length === 0)
          delete sockets[name];
      }
    }
  }
  let req;
  if (this.requests[name]?.length)
    req = this.requests[name][0];
  else {
    let keys = Object.keys(this.requests);
    for (let i = 0;i < keys.length; i++) {
      let prop = keys[i];
      if (this.sockets[prop]?.length)
        break;
      req = this.requests[prop][0], options = req[kRequestOptions];
      break;
    }
  }
  if (req && options)
    req[kRequestOptions] = @undefined, this.createSocket(req, options, (err, socket) => {
      if (err) {
        handleSocketAfterProxy(err, req), req.onSocket(null, err);
        return;
      }
      socket.emit("free");
    });
};
Agent.prototype.keepSocketAlive = function keepSocketAlive(socket) {
  socket.setKeepAlive(!0, this.keepAliveMsecs), socket.unref();
  let agentTimeout = this.options.timeout || 0, canKeepSocketAlive = !0, res = socket._httpMessage?.res;
  if (res) {
    let keepAliveHint = res.headers["keep-alive"];
    if (keepAliveHint) {
      let hint = /^timeout=(\d+)/.exec(keepAliveHint)?.[1];
      if (hint) {
        let serverHintTimeout = Number.parseInt(hint) * 1000 - this.agentKeepAliveTimeoutBuffer;
        if (serverHintTimeout = serverHintTimeout > 0 ? serverHintTimeout : 0, serverHintTimeout === 0)
          canKeepSocketAlive = !1;
        else if (serverHintTimeout < agentTimeout)
          agentTimeout = serverHintTimeout;
      }
    }
  }
  if (socket.timeout !== agentTimeout)
    socket.setTimeout(agentTimeout);
  return canKeepSocketAlive;
};
Agent.prototype.reuseSocket = function reuseSocket(socket, req) {
  socket.removeListener("error", freeSocketErrorListener), req.reusedSocket = !0, socket.ref();
};
Agent.prototype.destroy = function destroy() {
  let sets = [this.freeSockets, this.sockets];
  for (let s = 0;s < sets.length; s++) {
    let set = sets[s], keys = Object.keys(set);
    for (let v = 0;v < keys.length; v++) {
      let setName = set[keys[v]];
      for (let n = 0;n < setName.length; n++)
        setName[n].destroy();
    }
  }
};
function setRequestSocket(agent, req, socket) {
  req.onSocket(socket);
  let agentTimeout = agent.options.timeout || 0;
  if (req.timeout === @undefined || req.timeout === agentTimeout)
    return;
  socket.setTimeout(req.timeout);
}
$ = {
  Agent,
  globalAgent: new Agent({
    keepAlive: !0,
    scheduling: "lifo",
    timeout: 5000,
    proxyEnv: @undefined
  })
};
return $})

