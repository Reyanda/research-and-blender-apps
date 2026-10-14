(function (){"use strict";// build/release/tmp_modules/internal/debugger.ts
var $;
var socketFramerMessageLengthBuffer;

class SocketFramer {
  onMessage;
  state = 0 /* WaitingForLength */;
  pendingLength = 0;
  sizeBuffer = @Buffer.alloc(4);
  sizeBufferIndex = 0;
  bufferedData = @Buffer.alloc(0);
  constructor(onMessage) {
    this.onMessage = onMessage;
    if (!socketFramerMessageLengthBuffer)
      socketFramerMessageLengthBuffer = @Buffer.alloc(4);
    this.reset();
  }
  reset() {
    this.state = 0 /* WaitingForLength */, this.bufferedData = @Buffer.alloc(0), this.sizeBufferIndex = 0, this.sizeBuffer = @Buffer.alloc(4);
  }
  send(socket, data) {
    socketFramerMessageLengthBuffer.writeUInt32BE(@Buffer.byteLength(data), 0), socket.@write(socketFramerMessageLengthBuffer), socket.@write(data);
  }
  onData(socket, data) {
    this.bufferedData = this.bufferedData.length > 0 ? @Buffer.concat([this.bufferedData, data]) : data;
    let messagesToDeliver = [];
    while (this.bufferedData.length > 0) {
      if (this.state === 0 /* WaitingForLength */) {
        if (this.sizeBufferIndex + this.bufferedData.length < 4) {
          let remainingBytes2 = Math.min(4 - this.sizeBufferIndex, this.bufferedData.length);
          this.bufferedData.copy(this.sizeBuffer, this.sizeBufferIndex, 0, remainingBytes2), this.sizeBufferIndex += remainingBytes2, this.bufferedData = this.bufferedData.slice(remainingBytes2);
          break;
        }
        let remainingBytes = 4 - this.sizeBufferIndex;
        this.bufferedData.copy(this.sizeBuffer, this.sizeBufferIndex, 0, remainingBytes), this.pendingLength = this.sizeBuffer.readUInt32BE(0), this.state = 1 /* WaitingForMessage */, this.sizeBufferIndex = 0, this.bufferedData = this.bufferedData.slice(remainingBytes);
      }
      if (this.bufferedData.length < this.pendingLength)
        break;
      let message = this.bufferedData.toString("utf-8", 0, this.pendingLength);
      this.bufferedData = this.bufferedData.slice(this.pendingLength), this.state = 0 /* WaitingForLength */, this.pendingLength = 0, this.sizeBufferIndex = 0, messagesToDeliver.push(message);
    }
    if (messagesToDeliver.length === 1)
      this.onMessage(messagesToDeliver[0]);
    else if (messagesToDeliver.length > 1)
      this.onMessage(messagesToDeliver);
  }
}
$ = function(executionContextId, url, createBackend, send, close, isAutomatic, urlIsServer) {
  if (urlIsServer) {
    connectToUnixServer(executionContextId, url, createBackend, send, close);
    return;
  }
  let debug;
  try {
    debug = new Debugger(executionContextId, url, createBackend, send, close);
  } catch (error) {
    exit(`Failed to start inspector:
`, error);
  }
  if (!isAutomatic)
    if (debug.url) {
      let { protocol, href, host, pathname } = debug.url;
      if (!protocol.includes("unix")) {
        if (Bun.write(Bun.stderr, dim("--------------------- Bun Inspector ---------------------") + reset() + `
`), Bun.write(Bun.stderr, `Listening:
  ${dim(href)}
`), protocol.includes("ws"))
          Bun.write(Bun.stderr, `Inspect in browser:
  ${link(`https://debug.bun.sh/#${host}${pathname}`)}
`);
        Bun.write(Bun.stderr, dim("--------------------- Bun Inspector ---------------------") + reset() + `
`);
      }
    } else
      Bun.write(Bun.stderr, dim("--------------------- Bun Inspector ---------------------") + reset() + `
`), Bun.write(Bun.stderr, `Listening on ${dim(url)}
`), Bun.write(Bun.stderr, dim("--------------------- Bun Inspector ---------------------") + reset() + `
`);
  let notifyUrl = process.env.BUN_INSPECT_NOTIFY || "";
  if (notifyUrl)
    if (process.env.BUN_INSPECT_NOTIFY = "", notifyUrl.startsWith("unix://")) {
      let path = @getInternalField(@internalModuleRegistry, 107) || @createInternalModuleById(107);
      notify({
        unix: path.resolve(notifyUrl.substring(7))
      });
    } else {
      let { hostname, port } = new URL(notifyUrl);
      notify({
        hostname,
        port: port && port !== "0" ? Number(port) : @undefined
      });
    }
};
function unescapeUnixSocketUrl(href) {
  if (href.startsWith("unix://%2F"))
    return decodeURIComponent(href.substring(7));
  return href;
}

class Debugger {
  #url;
  #createBackend;
  constructor(executionContextId, url, createBackend, send, close) {
    try {
      if (this.#createBackend = (refEventLoop, receive) => {
        let backend = createBackend(executionContextId, refEventLoop, receive);
        return {
          write: (message) => {
            return send.@call(backend, message), !0;
          },
          close: () => close.@call(backend)
        };
      }, url.startsWith("unix://")) {
        this.#connectOverSocket({
          unix: unescapeUnixSocketUrl(url)
        });
        return;
      } else if (url.startsWith("fd://")) {
        this.#connectOverSocket({
          fd: Number(url.substring(5))
        });
        return;
      } else if (url.startsWith("fd:")) {
        this.#connectOverSocket({
          fd: Number(url.substring(3))
        });
        return;
      } else if (url.startsWith("unix:")) {
        this.#connectOverSocket({
          unix: url.substring(5)
        });
        return;
      } else if (url.startsWith("tcp://")) {
        let { hostname, port } = new URL(url);
        this.#connectOverSocket({
          hostname,
          port: port && port !== "0" ? Number(port) : @undefined
        });
        return;
      }
      this.#url = parseUrl(url), this.#listen();
    } catch (error) {
      throw console.error(error), error;
    }
  }
  get url() {
    return this.#url;
  }
  #listen() {
    let { protocol, hostname, port, pathname } = this.#url;
    if (protocol === "ws:" || protocol === "wss:" || protocol === "ws+tcp:") {
      let server = Bun.serve({
        hostname,
        port,
        fetch: this.#fetch.bind(this),
        websocket: this.#websocket
      });
      this.#url.hostname = server.hostname, this.#url.port = `${server.port}`;
      return;
    }
    if (protocol === "ws+unix:") {
      Bun.serve({
        unix: pathname,
        fetch: this.#fetch.bind(this),
        websocket: this.#websocket
      });
      return;
    }
    @throwTypeError(`Unsupported protocol: '${protocol}' (expected 'ws:' or 'ws+unix:')`);
  }
  #connectOverSocket(networkOptions) {
    let backend;
    return Bun.connect({
      ...networkOptions,
      socket: {
        open: (socket) => {
          let framer, callback = (...messages) => {
            for (let message of messages)
              framer.send(socket, message);
          };
          framer = new SocketFramer((message) => {
            backend.write(message);
          }), backend = this.#createBackend(!1, callback), socket.data = {
            framer,
            backend
          }, socket.ref();
        },
        data: (socket, bytes) => {
          if (!socket.data) {
            socket.terminate();
            return;
          }
          socket.data.framer.onData(socket, bytes);
        },
        drain: (_socket) => {},
        close: (socket) => {
          if (socket.data) {
            let { backend: backend2, framer } = socket.data;
            backend2.close(), framer.reset();
          }
        }
      }
    }).catch((err) => {
      if (!backend)
        backend = this.#createBackend(!1, () => {}), backend.close();
    });
  }
  get #websocket() {
    return {
      idleTimeout: 0,
      closeOnBackpressureLimit: !1,
      open: (ws) => this.#open(ws, webSocketWriter(ws)),
      message: (ws, message) => {
        if (typeof message === "string")
          this.#message(ws, message);
        else
          this.#error(ws, Error(`Unexpected binary message: ${message.toString()}`));
      },
      drain: (ws) => this.#drain(ws),
      close: (ws) => this.#close(ws)
    };
  }
  #fetch(request, server) {
    let { method, url, headers } = request, { pathname } = new URL(url);
    if (method !== "GET")
      return new Response(null, {
        status: 405
      });
    switch (pathname) {
      case "/json/version":
        return Response.json(versionInfo());
      case "/json":
      case "/json/list":
    }
    if (!this.#url.protocol.includes("unix") && this.#url.pathname !== pathname)
      return new Response(null, {
        status: 404
      });
    let data = {
      refEventLoop: headers.get("Ref-Event-Loop") === "0"
    };
    if (!server.upgrade(request, { data }))
      return new Response(null, {
        status: 426,
        headers: {
          Upgrade: "websocket"
        }
      });
  }
  #open(connection, writer) {
    let { data } = connection, { refEventLoop } = data, client = bufferedWriter(writer), backend = this.#createBackend(refEventLoop, (...messages) => {
      for (let message of messages)
        client.write(message);
    });
    data.client = client, data.backend = backend;
  }
  #message(connection, message) {
    let { data } = connection, { backend } = data;
    backend?.write(message);
  }
  #drain(connection) {
    let { data } = connection, { client } = data;
    client?.drain?.();
  }
  #close(connection) {
    let { data } = connection, { backend } = data;
    backend?.close();
  }
  #error(connection, error) {
    let { data } = connection, { backend } = data;
    console.error(error), backend?.close();
  }
}
async function connectToUnixServer(executionContextId, unix, createBackend, send, close) {
  let connectionOptions;
  if (unix.startsWith("unix:")) {
    if (unix = unescapeUnixSocketUrl(unix), unix.startsWith("unix://"))
      unix = unix.substring(7);
    connectionOptions = { unix };
  } else if (unix.startsWith("tcp:"))
    try {
      let { hostname, port } = new URL(unix);
      connectionOptions = {
        hostname,
        port: Number(port)
      };
    } catch {
      exit("Invalid tcp: URL:" + unix);
      return;
    }
  else if (unix.startsWith("/"))
    connectionOptions = { unix };
  else if (unix.startsWith("fd:"))
    connectionOptions = { fd: Number(unix.substring(3)) };
  else
    return;
  return await Bun.connect({
    ...connectionOptions,
    socket: {
      open: (socket2) => {
        let framer = new SocketFramer((message) => {
          backend.write(message);
        }), backendRaw = createBackend(executionContextId, !0, (...messages) => {
          for (let message of messages)
            framer.send(socket2, message);
        }), backend = {
          write: (message) => {
            return send.@call(backendRaw, message), !0;
          },
          close: () => close.@call(backendRaw)
        };
        socket2.data = {
          framer,
          backend
        }, socket2.ref();
      },
      data: (socket2, bytes) => {
        if (!socket2.data) {
          socket2.terminate();
          return;
        }
        socket2.data.framer.onData(socket2, bytes);
      },
      drain: (_socket) => {},
      close: (socket2) => {
        if (socket2.data) {
          let { backend, framer } = socket2.data;
          backend.close(), framer.reset();
        }
      }
    }
  }).catch((error) => {
    let backendRaw = createBackend(executionContextId, !0, () => {});
    close.@call(backendRaw);
  });
}
function versionInfo() {
  return {
    "Protocol-Version": "1.3",
    Browser: "Bun",
    "User-Agent": navigator.userAgent,
    "WebKit-Version": process.versions.webkit,
    "Bun-Version": Bun.version,
    "Bun-Revision": Bun.revision
  };
}
function webSocketWriter(ws) {
  return {
    write: (message) => !!ws.sendText(message),
    close: () => ws.close()
  };
}
function bufferedWriter(writer) {
  let draining = !1, pendingMessages = [];
  return {
    write: (message) => {
      if (draining || !writer.write(message))
        pendingMessages.push(message);
      return !0;
    },
    drain: () => {
      draining = !0;
      try {
        for (let i = 0;i < pendingMessages.length; i++)
          if (!writer.write(pendingMessages[i])) {
            pendingMessages = pendingMessages.slice(i);
            return;
          }
      } finally {
        draining = !1;
      }
    },
    close: () => {
      writer.close(), pendingMessages.length = 0;
    }
  };
}
var defaultHostname = "localhost", defaultPort = 6499;
function parseUrl(input) {
  if (input.startsWith("ws://") || input.startsWith("ws+unix://"))
    return new URL(input);
  let url = new URL(`ws://${defaultHostname}:${defaultPort}/${randomId()}`);
  for (let part of input.split(/(\[[a-z0-9:]+\])|:/).filter(Boolean)) {
    if (/^\d+$/.test(part)) {
      url.port = part;
      continue;
    }
    if (part.startsWith("[")) {
      url.hostname = part;
      continue;
    }
    if (part.startsWith("/")) {
      url.pathname = part;
      continue;
    }
    let [hostname, ...pathnames] = part.split("/");
    if (/^\d+$/.test(hostname))
      url.port = hostname;
    else
      url.hostname = hostname;
    if (pathnames.length)
      url.pathname = `/${pathnames.join("/")}`;
  }
  return url;
}
function randomId() {
  return Math.random().toString(36).slice(2);
}
var { enableANSIColors } = Bun;
function dim(string) {
  if (enableANSIColors)
    return `\x1B[2m${string}\x1B[22m`;
  return string;
}
function link(url) {
  if (enableANSIColors)
    return `\x1B[1m\x1B]8;;${url}\x1B\\${url}\x1B]8;;\x1B\\\x1B[22m`;
  return url;
}
function reset() {
  if (enableANSIColors)
    return "\x1B[49m";
  return "";
}
function notify(options) {
  Bun.connect({
    ...options,
    socket: {
      open: (socket) => {
        socket.end("1");
      },
      data: () => {}
    }
  }).catch(() => {});
}
function exit(...args) {
  console.error(...args), process.exit(1);
}
return $})

