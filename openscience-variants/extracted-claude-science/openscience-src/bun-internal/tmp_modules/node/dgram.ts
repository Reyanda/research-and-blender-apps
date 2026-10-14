(function (){"use strict";// build/release/tmp_modules/node/dgram.ts
var $;
var kStateSymbol = Symbol("state symbol"), kOwnerSymbol = Symbol("owner symbol"), async_id_symbol = Symbol("async_id_symbol"), { throwNotImplemented } = @getInternalField(@internalModuleRegistry, 32) || @createInternalModuleById(32), {
  validateString,
  validateNumber,
  validateFunction,
  validatePort,
  validateAbortSignal
} = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), { isIP } = @getInternalField(@internalModuleRegistry, 28) || @createInternalModuleById(28), EventEmitter = @getInternalField(@internalModuleRegistry, 96) || @createInternalModuleById(96), { deprecate } = @getInternalField(@internalModuleRegistry, 65) || @createInternalModuleById(65), SymbolDispose = Symbol.dispose, SymbolAsyncDispose = Symbol.asyncDispose, ObjectDefineProperty = Object.defineProperty, FunctionPrototypeBind = Function.prototype.bind;

class ERR_SOCKET_BUFFER_SIZE extends Error {
  constructor(ctx) {
    super(`Invalid buffer size: ${ctx}`);
    this.code = "ERR_SOCKET_BUFFER_SIZE";
  }
}
function isInt32(value) {
  return value === (value | 0);
}
function defaultTriggerAsyncIdScope(triggerAsyncId, block, ...args) {
  return block.@apply(null, args);
}
function lookup4(lookup, address, callback) {
  return lookup(address || "127.0.0.1", 4, callback);
}
function lookup6(lookup, address, callback) {
  return lookup(address || "::1", 6, callback);
}
function EINVAL(syscall) {
  throw Object.assign(Error(`${syscall} EINVAL`), {
    code: "EINVAL",
    syscall
  });
}
var dns;
function newHandle(type, lookup) {
  if (lookup === @undefined) {
    if (dns === @undefined)
      dns = @getInternalField(@internalModuleRegistry, 94) || @createInternalModuleById(94);
    lookup = dns.lookup;
  } else
    validateFunction(lookup, "lookup");
  let handle = {};
  if (type === "udp4")
    handle.lookup = FunctionPrototypeBind.@call(lookup4, handle, lookup);
  else if (type === "udp6")
    handle.lookup = FunctionPrototypeBind.@call(lookup6, handle, lookup);
  else
    throw @makeErrorWithCode(218);
  return handle.onmessage = onMessage, handle;
}
function onMessage(nread, handle, buf, rinfo) {
  let self = handle[kOwnerSymbol];
  if (nread < 0)
    return self.emit("error", Object.assign(Error("recvmsg"), {
      syscall: "recvmsg",
      errno: nread
    }));
  rinfo.size = buf.length, self.emit("message", buf, rinfo);
}
var udpSocketChannel;
function Socket(type, listener) {
  EventEmitter.@call(this);
  let lookup, recvBufferSize, sendBufferSize, options;
  if (type !== null && typeof type === "object")
    options = type, type = options.type, lookup = options.lookup, recvBufferSize = options.recvBufferSize, sendBufferSize = options.sendBufferSize;
  let handle = newHandle(type, lookup);
  if (handle[kOwnerSymbol] = this, this.type = type, typeof listener === "function")
    this.on("message", listener);
  if (this[kStateSymbol] = {
    handle,
    receiving: !1,
    bindState: 0,
    connectState: 0,
    queue: @undefined,
    reuseAddr: options && options.reuseAddr,
    reusePort: options && options.reusePort,
    ipv6Only: options && options.ipv6Only,
    recvBufferSize,
    sendBufferSize,
    unrefOnBind: !1
  }, options?.signal !== @undefined) {
    let { signal } = options;
    validateAbortSignal(signal, "options.signal");
    let onAborted = () => {
      if (this[kStateSymbol].handle)
        this.close();
    };
    if (signal.aborted)
      onAborted();
    else {
      let disposable = EventEmitter.addAbortListener(signal, onAborted);
      this.once("close", disposable[SymbolDispose]);
    }
  }
  if (!udpSocketChannel)
    udpSocketChannel = (@getInternalField(@internalModuleRegistry, 92) || @createInternalModuleById(92)).channel("udp.socket");
  if (udpSocketChannel.hasSubscribers)
    udpSocketChannel.publish({
      socket: this
    });
}
@toClass(Socket, "Socket", EventEmitter);
function createSocket(type, listener) {
  return new Socket(type, listener);
}
function bufferSize(self, size, _buffer) {
  if (size >>> 0 !== size)
    throw @makeErrorWithCode(216);
  let ctx = {}, ret = 524288;
  if (ret === @undefined)
    throw new ERR_SOCKET_BUFFER_SIZE(ctx);
  return ret;
}
Socket.prototype.bind = function(port_, address_) {
  let port = port_, state = this[kStateSymbol];
  if (state.bindState !== 0) {
    this.emit("error", @makeErrorWithCode(215));
    return;
  }
  state.bindState = 1;
  let cb = arguments.length && arguments[arguments.length - 1];
  if (typeof cb === "function") {
    let removeListeners2 = function() {
      this.removeListener("error", removeListeners2), this.removeListener("listening", onListening2);
    }, onListening2 = function() {
      removeListeners2.@call(this), cb.@call(this);
    };
    var removeListeners = removeListeners2, onListening = onListening2;
    this.on("error", removeListeners2), this.on("listening", onListening2);
  }
  if (port !== null && typeof port === "object" && typeof port.recvStart === "function")
    throwNotImplemented("Socket.prototype.bind(handle)");
  if (port !== null && typeof port === "object" && isInt32(port.fd) && port.fd > 0)
    throwNotImplemented("Socket.prototype.bind({ fd })");
  let address;
  if (port !== null && typeof port === "object")
    address = port.address || "", port = port.port;
  else
    address = typeof address_ === "function" ? "" : address_;
  if (!address)
    if (this.type === "udp4")
      address = "0.0.0.0";
    else
      address = "::";
  return state.handle.lookup(address, (err, ip) => {
    if (!state.handle)
      return;
    if (err) {
      state.bindState = 0, this.emit("error", err);
      return;
    }
    let flags = 32 /* LISTEN_DISALLOW_REUSE_PORT_FAILURE */;
    if (state.reuseAddr)
      flags |= 16 /* LISTEN_REUSE_ADDR */;
    if (state.ipv6Only)
      flags |= 8 /* SOCKET_IPV6_ONLY */;
    if (state.reusePort)
      flags |= 4 /* LISTEN_REUSE_PORT */;
    let family = this.type === "udp4" ? "IPv4" : "IPv6";
    try {
      Bun.udpSocket({
        hostname: ip,
        port: port || 0,
        flags,
        socket: {
          data: (_socket, data, port2, address2) => {
            this.emit("message", data, {
              port: port2,
              address: address2,
              size: data.length,
              family
            });
          },
          error: (error) => {
            this.emit("error", error);
          }
        }
      }).@then((socket) => {
        if (state.unrefOnBind)
          socket.unref(), state.unrefOnBind = !1;
        state.handle.socket = socket, state.receiving = !0, state.bindState = 2, this.emit("listening");
      }, (err2) => {
        state.bindState = 0, this.emit("error", err2);
      });
    } catch (err2) {
      state.bindState = 0, this.emit("error", err2);
    }
  }), this;
};
Socket.prototype.connect = function(port, address, callback) {
  if (port = validatePort(port, "Port", !1), typeof address === "function")
    callback = address, address = "";
  else if (address === @undefined)
    address = "";
  validateString(address, "address");
  let state = this[kStateSymbol];
  if (state.connectState !== 0)
    throw @makeErrorWithCode(222);
  if (state.connectState = 1, state.bindState === 0)
    this.bind({ port: 0, exclusive: !0 }, null);
  if (state.bindState !== 2) {
    enqueue(this, FunctionPrototypeBind.@call(_connect, this, port, address, callback));
    return;
  }
  _connect.@apply(this, [port, address, callback]);
};
function _connect(port, address, callback) {
  let state = this[kStateSymbol];
  if (callback)
    this.once("connect", callback);
  let afterDns = (ex, ip) => {
    defaultTriggerAsyncIdScope(this[async_id_symbol], doConnect, ex, this, ip, address, port, callback);
  };
  state.handle.lookup(address, afterDns);
}
var connectFn = @lazy(47);
function doConnect(ex, self, ip, address, port, callback) {
  let state = self[kStateSymbol];
  if (!state.handle)
    return;
  if (!ex)
    try {
      connectFn.@call(state.handle.socket, ip, port);
    } catch (e) {
      ex = e;
    }
  if (ex)
    return state.connectState = 0, process.nextTick(() => {
      if (callback)
        self.removeListener("connect", callback), callback(ex);
      else
        self.emit("error", ex);
    });
  state.connectState = 2, process.nextTick(() => self.emit("connect"));
}
var disconnectFn = @lazy(48);
Socket.prototype.disconnect = function() {
  let state = this[kStateSymbol];
  if (state.connectState !== 2)
    throw @makeErrorWithCode(223);
  disconnectFn.@call(state.handle.socket), state.connectState = 0;
};
Socket.prototype.sendto = function(buffer, offset, length, port, address, callback) {
  validateNumber(offset, "offset"), validateNumber(length, "length"), validateNumber(port, "port"), validateString(address, "address"), this.send(buffer, offset, length, port, address, callback);
};
function sliceBuffer(buffer, offset, length) {
  if (typeof buffer === "string")
    buffer = @Buffer.from(buffer);
  else if (!@ArrayBuffer.isView(buffer))
    throw @makeErrorWithCode(118, "buffer", ["string", "Buffer", "TypedArray", "DataView"], buffer);
  if (offset = offset >>> 0, length = length >>> 0, offset > buffer.byteLength)
    throw @makeErrorWithCode(12, "offset");
  if (offset + length > buffer.byteLength)
    throw @makeErrorWithCode(12, "length");
  return @Buffer.from(buffer.buffer, buffer.byteOffset + offset, length);
}
function fixBufferList(list) {
  let newlist = new @Array(list.length);
  for (let i = 0, l = list.length;i < l; i++) {
    let buf = list[i];
    if (typeof buf === "string")
      newlist[i] = @Buffer.from(buf);
    else if (!@ArrayBuffer.isView(buf))
      return null;
    else
      newlist[i] = @Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  return newlist;
}
function enqueue(self, toEnqueue) {
  let state = self[kStateSymbol];
  if (state.queue === @undefined)
    state.queue = [], self.once(EventEmitter.errorMonitor, onListenError), self.once("listening", onListenSuccess);
  state.queue.push(toEnqueue);
}
function onListenSuccess() {
  this.removeListener(EventEmitter.errorMonitor, onListenError), clearQueue.@call(this);
}
function onListenError(_err) {
  this.removeListener("listening", onListenSuccess), this[kStateSymbol].queue = @undefined;
}
function clearQueue() {
  let state = this[kStateSymbol], queue = state.queue;
  state.queue = @undefined;
  for (let queueEntry of queue)
    queueEntry();
}
Socket.prototype.send = function(buffer, offset, length, port, address, callback) {
  let list, state = this[kStateSymbol], connected = state.connectState === 2;
  if (!connected)
    if (address || port && typeof port !== "function")
      buffer = sliceBuffer(buffer, offset, length);
    else
      callback = port, port = offset, address = length;
  else {
    if (typeof length === "number") {
      if (buffer = sliceBuffer(buffer, offset, length), typeof port === "function")
        callback = port, port = null;
    } else
      callback = offset;
    if (port || address)
      throw @makeErrorWithCode(222);
  }
  if (!@Array.isArray(buffer))
    if (typeof buffer === "string")
      list = [@Buffer.from(buffer)];
    else if (!@ArrayBuffer.isView(buffer))
      throw @makeErrorWithCode(118, "buffer", ["string", "Buffer", "TypedArray", "DataView"], buffer);
    else
      list = [buffer];
  else if (!(list = fixBufferList(buffer)))
    throw @makeErrorWithCode(118, "buffer list arguments", ["string", "Buffer", "TypedArray", "DataView"], buffer);
  if (!connected)
    port = validatePort(port, "Port", !1);
  if (typeof callback !== "function")
    callback = @undefined;
  if (typeof address === "function")
    callback = address, address = @undefined;
  else if (address != null)
    validateString(address, "address");
  if (state.bindState === 0)
    this.bind({ port: 0, exclusive: !0 }, null);
  if (list.length === 0)
    list.push(@Buffer.alloc(0));
  if (state.bindState !== 2) {
    enqueue(this, FunctionPrototypeBind.@call(this.send, this, list, port, address, callback));
    return;
  }
  let afterDns = (ex, ip) => {
    defaultTriggerAsyncIdScope(this[async_id_symbol], doSend, ex, this, ip, list, address, port, callback);
  };
  if (!connected)
    state.handle.lookup(address, afterDns);
  else
    afterDns(null, null);
};
function doSend(ex, self, ip, list, address, port, callback) {
  let state = self[kStateSymbol];
  if (ex) {
    if (typeof callback === "function") {
      process.nextTick(callback, ex);
      return;
    }
    process.nextTick(() => self.emit("error", ex));
    return;
  }
  if (!state.handle)
    return;
  let socket = state.handle.socket;
  if (!socket)
    return;
  let err = null, success = !1, data;
  if (list === @undefined)
    data = new @Buffer(0);
  else if (@Array.isArray(list) && list.length === 1) {
    let { buffer, byteOffset, byteLength } = list[0];
    data = new @Buffer(buffer).slice(byteOffset).slice(0, byteLength);
  } else
    data = @Buffer.concat(list);
  try {
    if (port)
      success = socket.send(data, port, ip);
    else
      success = socket.send(data);
  } catch (e) {
    err = e;
  }
  if (callback)
    if (err)
      err.address = ip, err.port = port, err.message = `send ${err.code} ${ip}:${port}`, process.nextTick(callback, err);
    else {
      let sent = success ? data.byteLength : 0;
      process.nextTick(callback, null, sent);
    }
}
Socket.prototype.close = function(callback) {
  let state = this[kStateSymbol], queue = state.queue;
  if (typeof callback === "function")
    this.on("close", callback);
  if (queue !== @undefined)
    return queue.push(FunctionPrototypeBind.@call(this.close, this)), this;
  return state.receiving = !1, state.handle.socket?.close(), state.handle = null, defaultTriggerAsyncIdScope(this[async_id_symbol], process.nextTick, socketCloseNT, this), this;
};
Socket.prototype[SymbolAsyncDispose] = async function() {
  if (!this[kStateSymbol].handle.socket)
    return;
  let { promise, resolve, reject } = @newPromiseCapability(@Promise);
  return this.close((err) => {
    if (err)
      reject(err);
    else
      resolve();
  }), promise;
};
function socketCloseNT(self) {
  self.emit("close");
}
Socket.prototype.address = function() {
  let addr = this[kStateSymbol].handle.socket?.address;
  if (!addr)
    throw @makeErrorWithCode(224);
  return addr;
};
Socket.prototype.remoteAddress = function() {
  let state = this[kStateSymbol], socket = state.handle.socket;
  if (!socket)
    throw @makeErrorWithCode(224);
  if (state.connectState !== 2)
    throw @makeErrorWithCode(223);
  if (!socket.remoteAddress)
    throw @makeErrorWithCode(223);
  return socket.remoteAddress;
};
Socket.prototype.setBroadcast = function(arg) {
  let handle = this[kStateSymbol].handle;
  if (!handle?.socket)
    throw Error("setBroadcast EBADF");
  return handle.socket.setBroadcast(arg);
};
Socket.prototype.setTTL = function(ttl) {
  if (typeof ttl !== "number")
    throw @makeErrorWithCode(118, "ttl", "number", ttl);
  let handle = this[kStateSymbol].handle;
  if (!handle?.socket)
    throw Error("setTTL EBADF");
  return handle.socket.setTTL(ttl);
};
Socket.prototype.setMulticastTTL = function(ttl) {
  if (typeof ttl !== "number")
    throw @makeErrorWithCode(118, "ttl", "number", ttl);
  let handle = this[kStateSymbol].handle;
  if (!handle?.socket)
    throw Error("setMulticastTTL EBADF");
  return handle.socket.setMulticastTTL(ttl);
};
Socket.prototype.setMulticastLoopback = function(arg) {
  let handle = this[kStateSymbol].handle;
  if (!handle?.socket)
    throw Error("setMulticastLoopback EBADF");
  return handle.socket.setMulticastLoopback(arg);
};
Socket.prototype.setMulticastInterface = function(interfaceAddress) {
  validateString(interfaceAddress, "interfaceAddress");
  let handle = this[kStateSymbol].handle;
  if (!handle?.socket)
    throw @makeErrorWithCode(224);
  if (!handle.socket.setMulticastInterface(interfaceAddress))
    throw EINVAL("setMulticastInterface");
};
Socket.prototype.addMembership = function(multicastAddress, interfaceAddress) {
  if (!multicastAddress)
    throw @makeErrorWithCode(150, "multicastAddress");
  if (validateString(multicastAddress, "multicastAddress"), typeof interfaceAddress < "u")
    validateString(interfaceAddress, "interfaceAddress");
  let { handle, bindState } = this[kStateSymbol];
  if (!handle?.socket) {
    if (!isIP(multicastAddress))
      throw EINVAL("addMembership");
    throw @makeErrorWithCode(224);
  }
  if (bindState === 0)
    this.bind({ port: 0, exclusive: !0 }, null);
  return handle.socket.addMembership(multicastAddress, interfaceAddress);
};
Socket.prototype.dropMembership = function(multicastAddress, interfaceAddress) {
  if (!multicastAddress)
    throw @makeErrorWithCode(150, "multicastAddress");
  if (validateString(multicastAddress, "multicastAddress"), typeof interfaceAddress < "u")
    validateString(interfaceAddress, "interfaceAddress");
  let { handle } = this[kStateSymbol];
  if (!handle?.socket) {
    if (!isIP(multicastAddress))
      throw EINVAL("dropMembership");
    throw @makeErrorWithCode(224);
  }
  return handle.socket.dropMembership(multicastAddress, interfaceAddress);
};
Socket.prototype.addSourceSpecificMembership = function(sourceAddress, groupAddress, interfaceAddress) {
  if (validateString(sourceAddress, "sourceAddress"), validateString(groupAddress, "groupAddress"), typeof interfaceAddress < "u")
    validateString(interfaceAddress, "interfaceAddress");
  let { handle, bindState } = this[kStateSymbol];
  if (!handle?.socket) {
    if (!isIP(sourceAddress) || !isIP(groupAddress))
      throw EINVAL("addSourceSpecificMembership");
    throw @makeErrorWithCode(224);
  }
  if (bindState === 0)
    this.bind(0);
  return handle.socket.addSourceSpecificMembership(sourceAddress, groupAddress, interfaceAddress);
};
Socket.prototype.dropSourceSpecificMembership = function(sourceAddress, groupAddress, interfaceAddress) {
  if (validateString(sourceAddress, "sourceAddress"), validateString(groupAddress, "groupAddress"), typeof interfaceAddress < "u")
    validateString(interfaceAddress, "interfaceAddress");
  let { handle, bindState } = this[kStateSymbol];
  if (!handle?.socket) {
    if (!isIP(sourceAddress) || !isIP(groupAddress))
      throw EINVAL("dropSourceSpecificMembership");
    throw @makeErrorWithCode(224);
  }
  if (bindState === 0)
    this.bind(0);
  return handle.socket.dropSourceSpecificMembership(sourceAddress, groupAddress, interfaceAddress);
};
Socket.prototype.ref = function() {
  let socket = this[kStateSymbol].handle?.socket;
  if (socket)
    socket.ref();
  return this;
};
Socket.prototype.unref = function() {
  let socket = this[kStateSymbol].handle?.socket;
  if (socket)
    socket.unref();
  else
    this[kStateSymbol].unrefOnBind = !0;
  return this;
};
Socket.prototype.setRecvBufferSize = function(size) {
  bufferSize(this, size, !0);
};
Socket.prototype.setSendBufferSize = function(size) {
  bufferSize(this, size, !1);
};
Socket.prototype.getRecvBufferSize = function() {
  return bufferSize(this, 0, !0);
};
Socket.prototype.getSendBufferSize = function() {
  return bufferSize(this, 0, !1);
};
Socket.prototype.getSendQueueSize = function() {
  return 0;
};
Socket.prototype.getSendQueueCount = function() {
  return 0;
};
ObjectDefineProperty(Socket.prototype, "_handle", {
  get: deprecate(function() {
    return this[kStateSymbol].handle;
  }, "Socket.prototype._handle is deprecated", "DEP0112"),
  set: deprecate(function(val) {
    this[kStateSymbol].handle = val;
  }, "Socket.prototype._handle is deprecated", "DEP0112")
});
ObjectDefineProperty(Socket.prototype, "_receiving", {
  get: deprecate(function() {
    return this[kStateSymbol].receiving;
  }, "Socket.prototype._receiving is deprecated", "DEP0112"),
  set: deprecate(function(val) {
    this[kStateSymbol].receiving = val;
  }, "Socket.prototype._receiving is deprecated", "DEP0112")
});
ObjectDefineProperty(Socket.prototype, "_bindState", {
  get: deprecate(function() {
    return this[kStateSymbol].bindState;
  }, "Socket.prototype._bindState is deprecated", "DEP0112"),
  set: deprecate(function(val) {
    this[kStateSymbol].bindState = val;
  }, "Socket.prototype._bindState is deprecated", "DEP0112")
});
ObjectDefineProperty(Socket.prototype, "_queue", {
  get: deprecate(function() {
    return this[kStateSymbol].queue;
  }, "Socket.prototype._queue is deprecated", "DEP0112"),
  set: deprecate(function(val) {
    this[kStateSymbol].queue = val;
  }, "Socket.prototype._queue is deprecated", "DEP0112")
});
ObjectDefineProperty(Socket.prototype, "_reuseAddr", {
  get: deprecate(function() {
    return this[kStateSymbol].reuseAddr;
  }, "Socket.prototype._reuseAddr is deprecated", "DEP0112"),
  set: deprecate(function(val) {
    this[kStateSymbol].reuseAddr = val;
  }, "Socket.prototype._reuseAddr is deprecated", "DEP0112")
});
function healthCheck(socket) {
  if (!socket[kStateSymbol].handle)
    throw @makeErrorWithCode(224);
}
Socket.prototype._healthCheck = deprecate(function() {
  healthCheck(this);
}, "Socket.prototype._healthCheck() is deprecated", "DEP0112");
function stopReceiving(socket) {
  let state = socket[kStateSymbol];
  if (!state.receiving)
    return;
  state.receiving = !1;
}
Socket.prototype._stopReceiving = deprecate(function() {
  stopReceiving(this);
}, "Socket.prototype._stopReceiving() is deprecated", "DEP0112");
$ = {
  createSocket,
  Socket
};
return $})

