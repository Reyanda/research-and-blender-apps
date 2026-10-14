(function (){"use strict";// build/release/tmp_modules/node/os.ts
var $, tmpdir = function() {
  var env = Bun.env;
  return tmpdir = function() {
    if (!1)
      var path;
    var path = env.TMPDIR || env.TMP || env.TEMP || "/tmp";
    let length = path.length;
    if (length > 1 && path[length - 1] === "/")
      path = path.slice(0, -1);
    return path;
  }, tmpdir[Symbol.toPrimitive] = tmpdir, tmpdir();
};
function lazyCpus({ cpus, hostCpuCount }) {
  return () => {
    let array = new @Array(hostCpuCount);
    function populate() {
      let results = cpus(), length = results.length;
      array.length = length;
      for (let i = 0;i < length; i++)
        array[i] = results[i];
    }
    for (let i = 0;i < array.length; i++) {
      let instance = {
        get model() {
          if (array[i] === instance)
            populate();
          return array[i].model;
        },
        set model(value) {
          if (array[i] === instance)
            populate();
          array[i].model = value;
        },
        get speed() {
          if (array[i] === instance)
            populate();
          return array[i].speed;
        },
        set speed(value) {
          if (array[i] === instance)
            populate();
          array[i].speed = value;
        },
        get times() {
          if (array[i] === instance)
            populate();
          return array[i].times;
        },
        set times(value) {
          if (array[i] === instance)
            populate();
          array[i].times = value;
        },
        toJSON() {
          if (array[i] === instance)
            populate();
          return array[i];
        }
      };
      array[i] = instance;
    }
    return array;
  };
}
function bound(binding) {
  return {
    availableParallelism: function() {
      return navigator.hardwareConcurrency;
    },
    arch: function() {
      return "arm64";
    },
    cpus: lazyCpus(binding),
    endianness: function() {
      return "LE";
    },
    freemem: binding.freemem,
    getPriority: binding.getPriority,
    homedir: binding.homedir,
    hostname: binding.hostname,
    loadavg: binding.loadavg,
    networkInterfaces: binding.networkInterfaces,
    platform: function() {
      return "darwin";
    },
    release: binding.release,
    setPriority: binding.setPriority,
    get tmpdir() {
      return tmpdir;
    },
    totalmem: binding.totalmem,
    type: function() {
      return "Darwin";
    },
    uptime: binding.uptime,
    userInfo: binding.userInfo,
    version: binding.version,
    machine: function() {
      return "arm64";
    },
    devNull: "/dev/null",
    get EOL() {
      return `
`;
    },
    constants: @processBindingConstants.os
  };
}
var out = bound(@lazy(72));
symbolToStringify(out, "arch");
symbolToStringify(out, "availableParallelism");
symbolToStringify(out, "endianness");
symbolToStringify(out, "freemem");
symbolToStringify(out, "homedir");
symbolToStringify(out, "hostname");
symbolToStringify(out, "platform");
symbolToStringify(out, "release");
symbolToStringify(out, "tmpdir");
symbolToStringify(out, "totalmem");
symbolToStringify(out, "type");
symbolToStringify(out, "uptime");
symbolToStringify(out, "version");
symbolToStringify(out, "machine");
function symbolToStringify(obj, key) {
  obj[key][Symbol.toPrimitive] = function(_hint) {
    return obj[key]();
  };
}
$ = out;
return $})

