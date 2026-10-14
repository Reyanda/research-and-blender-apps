(function (){"use strict";// build/release/tmp_modules/internal/cluster/primary.ts
var $, EventEmitter = @getInternalField(@internalModuleRegistry, 96) || @createInternalModuleById(96), Worker = @getInternalField(@internalModuleRegistry, 10) || @createInternalModuleById(10), RoundRobinHandle = @getInternalField(@internalModuleRegistry, 9) || @createInternalModuleById(9), path = @getInternalField(@internalModuleRegistry, 107) || @createInternalModuleById(107), { throwNotImplemented, kHandle } = @getInternalField(@internalModuleRegistry, 32) || @createInternalModuleById(32), sendHelper = @lazy(3), onInternalMessage = @lazy(7), child_process, ArrayPrototypeSlice = @Array.prototype.slice, ObjectValues = Object.values, ObjectKeys = Object.keys, cluster = new EventEmitter, intercom = new EventEmitter;
$ = cluster;
var handles = /* @__PURE__ */ new Map;
cluster.isWorker = !1;
cluster.isMaster = !0;
cluster.isPrimary = !0;
cluster.Worker = Worker;
cluster.workers = {};
cluster.settings = {};
cluster.SCHED_NONE = 1;
cluster.SCHED_RR = 2;
var ids = 0, initialized = !1, schedulingPolicyEnv = process.env.NODE_CLUSTER_SCHED_POLICY, schedulingPolicy = 0;
if (schedulingPolicyEnv === "rr")
  schedulingPolicy = 2;
else if (schedulingPolicyEnv === "none")
  schedulingPolicy = 1;
else
  schedulingPolicy = 2;
cluster.schedulingPolicy = schedulingPolicy;
cluster.setupPrimary = function(options) {
  let settings = {
    args: ArrayPrototypeSlice.@call(process.argv, 2),
    exec: process.argv[1],
    execArgv: process.execArgv,
    silent: !1,
    ...cluster.settings,
    ...options
  };
  if (cluster.settings = settings, initialized === !0)
    return process.nextTick(setupSettingsNT, settings);
  if (initialized = !0, schedulingPolicy = cluster.schedulingPolicy, !(schedulingPolicy === 1 || schedulingPolicy === 2))
    throw Error(`Bad cluster.schedulingPolicy: ${schedulingPolicy}`);
  process.nextTick(setupSettingsNT, settings);
};
cluster.setupMaster = cluster.setupPrimary;
function setupSettingsNT(settings) {
  cluster.emit("setup", settings);
}
function createWorkerProcess(id, env) {
  let workerEnv = { ...process.env, ...env, NODE_UNIQUE_ID: `${id}` }, execArgv = [...cluster.settings.execArgv];
  return child_process ??= @getInternalField(@internalModuleRegistry, 87) || @createInternalModuleById(87), child_process.fork(cluster.settings.exec, cluster.settings.args, {
    cwd: cluster.settings.cwd,
    env: workerEnv,
    serialization: cluster.settings.serialization,
    silent: cluster.settings.silent,
    windowsHide: cluster.settings.windowsHide,
    execArgv,
    stdio: cluster.settings.stdio,
    gid: cluster.settings.gid,
    uid: cluster.settings.uid
  });
}
function removeWorker(worker) {
  if (!worker)
    throw Error("ERR_INTERNAL_ASSERTION");
  if (delete cluster.workers[worker.id], ObjectKeys(cluster.workers).length === 0) {
    if (handles.size !== 0)
      throw Error("Resource leak detected.");
    intercom.emit("disconnect");
  }
}
function removeHandlesForWorker(worker) {
  if (!worker)
    throw Error("ERR_INTERNAL_ASSERTION");
  handles.forEach((handle, key) => {
    if (handle.remove(worker))
      handles.delete(key);
  });
}
cluster.fork = function(env) {
  cluster.setupPrimary();
  let id = ++ids, workerProcess = createWorkerProcess(id, env), worker = new Worker({
    id,
    process: workerProcess
  });
  return worker.on("message", function(message, handle) {
    cluster.emit("message", this, message, handle);
  }), worker.process.once("exit", (exitCode, signalCode) => {
    if (!worker.isConnected())
      removeHandlesForWorker(worker), removeWorker(worker);
    worker.exitedAfterDisconnect = !!worker.exitedAfterDisconnect, worker.state = "dead", worker.emit("exit", exitCode, signalCode), cluster.emit("exit", worker, exitCode, signalCode);
  }), worker.process.once("disconnect", () => {
    if (worker.process.channel = null, removeHandlesForWorker(worker), worker.isDead())
      removeWorker(worker);
    worker.exitedAfterDisconnect = !!worker.exitedAfterDisconnect, worker.state = "disconnected", worker.emit("disconnect"), cluster.emit("disconnect", worker);
  }), onInternalMessage(worker.process[kHandle], worker, onmessage), process.nextTick(emitForkNT, worker), cluster.workers[worker.id] = worker, worker;
};
function emitForkNT(worker) {
  cluster.emit("fork", worker);
}
cluster.disconnect = function(cb) {
  if (ObjectKeys(cluster.workers).length === 0)
    process.nextTick(() => intercom.emit("disconnect"));
  else
    for (let worker of ObjectValues(cluster.workers))
      if (worker.isConnected())
        worker.disconnect();
  if (typeof cb === "function")
    intercom.once("disconnect", cb);
};
var methodMessageMapping = {
  close,
  exitedAfterDisconnect,
  listening,
  online,
  queryServer
};
function onmessage(message, _handle) {
  let worker = this, fn = methodMessageMapping[message.act];
  if (typeof fn === "function")
    fn(worker, message);
}
function online(worker) {
  worker.state = "online", worker.emit("online"), cluster.emit("online", worker);
}
function exitedAfterDisconnect(worker, message) {
  worker.exitedAfterDisconnect = !0, send(worker, { ack: message.seq });
}
function queryServer(worker, message) {
  if (worker.exitedAfterDisconnect)
    return;
  let key = `${message.address}:${message.port}:${message.addressType}:${message.fd}:${message.index}`, handle = handles.get(key);
  if (handle === @undefined) {
    let address = message.address;
    if (message.port < 0 && typeof address === "string") {
      if (address = path.relative(process.cwd(), address), message.address.length < address.length)
        address = message.address;
    }
    if (schedulingPolicy !== 2 || message.addressType === "udp4" || message.addressType === "udp6")
      throwNotImplemented("node:cluster SCHED_NONE");
    else
      handle = new RoundRobinHandle(key, address, message);
    handles.set(key, handle);
  }
  if (!handle.data)
    handle.data = message.data;
  handle.add(worker, (errno, reply, handle2) => {
    let { data } = handles.get(key);
    if (errno)
      handles.delete(key);
    send(worker, {
      errno,
      key,
      ack: message.seq,
      data,
      ...reply
    }, handle2);
  });
}
function listening(worker, message) {
  let info = {
    addressType: message.addressType,
    address: message.address,
    port: message.port,
    fd: message.fd
  };
  worker.state = "listening", worker.emit("listening", info), cluster.emit("listening", worker, info);
}
function close(worker, message) {
  let key = message.key, handle = handles.get(key);
  if (handle && handle.remove(worker))
    handles.delete(key);
}
function send(worker, message, handle, cb) {
  return sendHelper(worker.process[kHandle], message, handle, cb);
}
Worker.prototype.disconnect = function() {
  return this.exitedAfterDisconnect = !0, send(this, { act: "disconnect" }), this.process.disconnect(), removeHandlesForWorker(this), removeWorker(this), this;
};
Worker.prototype.destroy = function(signo) {
  let proc = this.process, signal = signo || "SIGTERM";
  proc.kill(signal);
};
return $})

