(function (){"use strict";// build/release/tmp_modules/internal/cluster/RoundRobinHandle.ts
var $, { append, init, isEmpty, peek, remove } = @getInternalField(@internalModuleRegistry, 27) || @createInternalModuleById(27), { kHandle } = @getInternalField(@internalModuleRegistry, 32) || @createInternalModuleById(32), net, sendHelper = @lazy(3), ArrayIsArray = @Array.isArray;
var assert_fail = () => {
  throw Error("ERR_INTERNAL_ASSERTION");
};
$ = class RoundRobinHandle {
  key;
  all;
  free;
  handles;
  handle;
  server;
  constructor(key, address, { port, fd, flags, backlog, readableAll, writableAll }) {
    if (net ??= @getInternalField(@internalModuleRegistry, 104) || @createInternalModuleById(104), this.key = key, this.all = /* @__PURE__ */ new Map, this.free = /* @__PURE__ */ new Map, this.handles = init(Object.create(null)), this.handle = null, this.server = net.createServer(assert_fail), fd >= 0)
      this.server.listen({ fd, backlog });
    else if (port >= 0)
      this.server.listen({
        port,
        host: address,
        ipv6Only: !!(flags & 1),
        backlog
      });
    else
      this.server.listen({
        path: address,
        backlog,
        readableAll,
        writableAll
      });
    this.server.once("listening", () => {
      this.handle = this.server._handle, this.handle.onconnection = (err, handle) => this.distribute(err, handle), this.server._handle = null, this.server = null;
    });
  }
  add(worker, send) {
    this.all.set(worker.id, worker);
    let done = () => {
      if (this.handle.getsockname) {
        let out = {};
        this.handle.getsockname(out), send(null, { sockname: out }, null);
      } else
        send(null, null, null);
      this.handoff(worker);
    };
    if (this.server === null)
      return done();
    this.server.once("listening", done), this.server.once("error", (err) => {
      send(err.errno, null);
    });
  }
  remove(worker) {
    if (!this.all.delete(worker.id))
      return !1;
    if (this.free.delete(worker.id), this.all.size !== 0)
      return !1;
    while (!isEmpty(this.handles)) {
      let handle = peek(this.handles);
      handle.close(), remove(handle);
    }
    return this.handle?.stop(!1), this.handle = null, !0;
  }
  distribute(err, handle) {
    if (err)
      return;
    append(this.handles, handle);
    let [workerEntry] = this.free;
    if (ArrayIsArray(workerEntry)) {
      let { 0: workerId, 1: worker } = workerEntry;
      this.free.delete(workerId), this.handoff(worker);
    }
  }
  handoff(worker) {
    if (!this.all.has(worker.id))
      return;
    let handle = peek(this.handles);
    if (handle === null) {
      this.free.set(worker.id, worker);
      return;
    }
    remove(handle);
    let message = { act: "newconn", key: this.key };
    sendHelper(worker.process[kHandle], message, handle, (reply) => {
      if (reply.accepted)
        handle.close();
      else
        this.distribute(0, handle);
      this.handoff(worker);
    });
  }
};
return $})

