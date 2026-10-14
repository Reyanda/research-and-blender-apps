(function (){"use strict";// build/release/tmp_modules/internal/cluster/child.ts
var $, EventEmitter = @getInternalField(@internalModuleRegistry, 96) || @createInternalModuleById(96), Worker = @getInternalField(@internalModuleRegistry, 10) || @createInternalModuleById(10), path = @getInternalField(@internalModuleRegistry, 107) || @createInternalModuleById(107), sendHelper = @lazy(4), onInternalMessage = @lazy(5), FunctionPrototype = Function.prototype, ArrayPrototypeJoin = @Array.prototype.join, ObjectAssign = Object.assign, cluster = new EventEmitter, handles = /* @__PURE__ */ new Map, indexes = /* @__PURE__ */ new Map, noop = FunctionPrototype;
var owner_symbol = Symbol("owner_symbol");
$ = cluster;
cluster.isWorker = !0;
cluster.isMaster = !1;
cluster.isPrimary = !1;
cluster.worker = null;
cluster.Worker = Worker;
cluster._setupWorker = function() {
  let worker = new Worker({
    id: +process.env.NODE_UNIQUE_ID | 0,
    process,
    state: "online"
  });
  cluster.worker = worker, @lazy(6)(), process.once("disconnect", () => {
    if (process.channel = null, worker.emit("disconnect"), !worker.exitedAfterDisconnect)
      process.exit(0);
  }), onInternalMessage(worker, onmessage), send({ act: "online" });
  function onmessage(message, handle) {
    if (message.act === "newconn")
      onconnection(message, handle);
    else if (message.act === "disconnect")
      worker._disconnect(!0);
  }
};
cluster._getServer = function(obj, options, cb) {
  let address = options.address;
  if (options.port < 0 && typeof address === "string")
    address = path.resolve(address);
  let indexesKey = ArrayPrototypeJoin.@call([address, options.port, options.addressType, options.fd], ":"), indexSet = indexes.get(indexesKey);
  if (indexSet === @undefined)
    indexSet = { nextIndex: 0, set: /* @__PURE__ */ new Set }, indexes.set(indexesKey, indexSet);
  let index = indexSet.nextIndex++;
  indexSet.set.add(index);
  let message = {
    act: "queryServer",
    index,
    data: null,
    ...options
  };
  if (message.address = address, obj._getServerData)
    message.data = obj._getServerData();
  send(message, (reply, handle) => {
    if (typeof obj._setServerData === "function")
      obj._setServerData(reply.data);
    if (handle)
      shared(reply, { handle, indexesKey, index }, cb);
    else
      rr(reply, { indexesKey, index }, cb);
  }), obj.once("listening", () => {
    if (!indexes.has(indexesKey))
      return;
    cluster.worker.state = "listening";
    let address2 = obj.address();
    message.act = "listening", message.port = address2 && address2.port || options.port, send(message);
  });
};
function removeIndexesKey(indexesKey, index) {
  let indexSet = indexes.get(indexesKey);
  if (!indexSet)
    return;
  if (indexSet.set.delete(index), indexSet.set.size === 0)
    indexes.delete(indexesKey);
}
function shared(message, { handle, indexesKey, index }, cb) {
  let key = message.key, close = handle.close;
  handle.close = function() {
    return send({ act: "close", key }), handles.delete(key), removeIndexesKey(indexesKey, index), close.@apply(handle, arguments);
  }, handles.set(key, handle), cb(message.errno, handle);
}
function rr(message, { indexesKey, index }, cb) {
  if (message.errno)
    return cb(message.errno, null);
  let key = message.key, fakeHandle = null;
  function ref() {
    if (!fakeHandle)
      fakeHandle = setInterval(noop, 2147483647);
  }
  function unref() {
    if (fakeHandle)
      clearInterval(fakeHandle), fakeHandle = null;
  }
  function listen(_backlog) {
    return 0;
  }
  function close() {
    if (key === @undefined)
      return;
    unref(), send({ act: "close", key }), handles.delete(key), removeIndexesKey(indexesKey, index), key = @undefined;
  }
  function getsockname(out) {
    if (key)
      ObjectAssign(out, message.sockname);
    return 0;
  }
  let handle = { close, listen, ref, unref };
  if (handle.ref(), message.sockname)
    handle.getsockname = getsockname;
  handles.set(key, handle), cb(0, handle);
}
function onconnection(message, handle) {
  let key = message.key, server = handles.get(key), accepted = server !== @undefined;
  if (accepted && server[owner_symbol]) {
    let self = server[owner_symbol];
    if (self.maxConnections != null && self._connections >= self.maxConnections)
      accepted = !1;
  }
  if (send({ ack: message.seq, accepted }), accepted)
    server.onconnection(0, handle);
  else
    handle.close();
}
function send(message, cb) {
  return sendHelper(message, null, cb);
}
Worker.prototype.disconnect = function() {
  if (this.state !== "disconnecting" && this.state !== "destroying")
    this.state = "disconnecting", this._disconnect();
  return this;
};
Worker.prototype._disconnect = function(primaryInitiated) {
  this.exitedAfterDisconnect = !0;
  let waitingCount = 1;
  function checkWaitingCount() {
    if (waitingCount--, waitingCount === 0)
      if (primaryInitiated)
        process.disconnect();
      else
        send({ act: "exitedAfterDisconnect" }, () => process.disconnect());
  }
  handles.forEach((handle) => {
    if (waitingCount++, handle[owner_symbol])
      handle[owner_symbol].close(checkWaitingCount);
    else
      handle.close(checkWaitingCount);
  }), handles.clear(), checkWaitingCount();
};
Worker.prototype.destroy = function() {
  if (this.state === "destroying")
    return;
  if (this.exitedAfterDisconnect = !0, !this.isConnected())
    process.exit(0);
  else
    this.state = "destroying", send({ act: "exitedAfterDisconnect" }, () => process.disconnect()), process.once("disconnect", () => process.exit(0));
};
return $})

