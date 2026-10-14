(function (){"use strict";// build/release/tmp_modules/node/https.ts
var $, http = @getInternalField(@internalModuleRegistry, 99) || @createInternalModuleById(99), { urlToHttpOptions } = @getInternalField(@internalModuleRegistry, 63) || @createInternalModuleById(63), ArrayPrototypeShift = @Array.prototype.shift, ObjectAssign = Object.assign, ArrayPrototypeUnshift = @Array.prototype.unshift;
function request(...args) {
  let options = {};
  if (typeof args[0] === "string") {
    let urlStr = ArrayPrototypeShift.@call(args);
    options = urlToHttpOptions(new URL(urlStr));
  } else if (args[0] instanceof URL)
    options = urlToHttpOptions(ArrayPrototypeShift.@call(args));
  if (args[0] && typeof args[0] !== "function")
    ObjectAssign.@call(null, options, ArrayPrototypeShift.@call(args));
  return options._defaultAgent = https.globalAgent, ArrayPrototypeUnshift.@call(args, options), new http.ClientRequest(...args);
}
function get(input, options, cb) {
  let req = request(input, options, cb);
  return req.end(), req;
}
function Agent(options) {
  if (!(this instanceof Agent))
    return new Agent(options);
  if (http.Agent.@apply(this, [options]), this.defaultPort = 443, this.protocol = "https:", this.maxCachedSessions = this.options.maxCachedSessions, this.maxCachedSessions === @undefined)
    this.maxCachedSessions = 100;
}
@toClass(Agent, "Agent", http.Agent);
Agent.prototype.createConnection = http.createConnection;
var https = {
  Agent,
  globalAgent: new Agent({ keepAlive: !0, scheduling: "lifo", timeout: 5000 }),
  Server: http.Server,
  createServer: http.createServer,
  get,
  request
};
$ = https;
return $})

