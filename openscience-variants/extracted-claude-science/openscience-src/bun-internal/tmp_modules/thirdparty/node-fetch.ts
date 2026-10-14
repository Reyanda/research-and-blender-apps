(function (){"use strict";// build/release/tmp_modules/thirdparty/node-fetch.ts
var $, bindings = @lazy(95), WebResponse = bindings[0], WebRequest = bindings[1], Blob = bindings[2], WebHeaders = bindings[3], FormData = bindings[4], File = bindings[5], nativeFetch = Bun.fetch;

class Headers extends WebHeaders {
  raw() {
    let obj = this.toJSON();
    for (let key in obj) {
      let val = obj[key];
      if (!@isJSArray(val))
        obj[key] = [val];
    }
    return obj;
  }
  sort() {
    @throwTypeError("Expected this to be instanceof URLSearchParams");
  }
}
var kHeaders = Symbol("kHeaders"), kBody = Symbol("kBody"), HeadersPrototype = Headers.prototype;

class Response extends WebResponse {
  [kBody];
  [kHeaders];
  constructor(body, init) {
    let { Readable, Stream } = @getInternalField(@internalModuleRegistry, 117) || @createInternalModuleById(117);
    if (body && typeof body === "object" && (body instanceof Stream || body instanceof Readable))
      body = Readable.toWeb(body);
    super(body, init);
  }
  get body() {
    let body = this[kBody];
    if (!body) {
      var web = super.body;
      if (!web)
        return null;
      body = this[kBody] = new (@getInternalField(@internalModuleRegistry, 69) || @createInternalModuleById(69))._ReadableFromWeb({}, web);
    }
    return body;
  }
  get headers() {
    return this[kHeaders] ??= Object.setPrototypeOf(super.headers, HeadersPrototype);
  }
  clone() {
    return Object.setPrototypeOf(super.clone(this), ResponsePrototype);
  }
  async arrayBuffer() {
    return this.body, await super.arrayBuffer();
  }
  async blob() {
    return this.body, await super.blob();
  }
  async formData() {
    return this.body, await super.formData();
  }
  async json() {
    return this.body, await super.json();
  }
  async buffer() {
    return this.body, new @Buffer(await super.arrayBuffer());
  }
  async text() {
    return this.body, await super.text();
  }
  get type() {
    if (!super.ok)
      return "error";
    return "default";
  }
}
var ResponsePrototype = Response.prototype, kUrl = Symbol("kUrl");

class Request extends WebRequest {
  [kUrl];
  constructor(input, init) {
    if (typeof input === "string" && !URL.canParse(input)) {
      super(new URL(input, "http://localhost/"), init);
      this[kUrl] = input;
    } else
      super(input, init);
  }
  get url() {
    return this[kUrl] ?? super.url;
  }
}
async function fetch(url, init) {
  if (init?.body && typeof init.body === "object" && !init.body[Symbol.asyncIterator]) {
    let { Readable, Stream, PassThrough } = @getInternalField(@internalModuleRegistry, 117) || @createInternalModuleById(117);
    if (init.body instanceof Stream || init.body instanceof Readable) {
      let readable = init.body;
      if (!(readable instanceof Readable)) {
        let passthrough = new PassThrough;
        readable.pipe(passthrough), readable = passthrough;
      }
      init = { ...init, body: Readable.toWeb(readable) };
    }
  }
  let response = await nativeFetch.@call(@undefined, url, init);
  return Object.setPrototypeOf(response, ResponsePrototype), response;
}

class AbortError extends DOMException {
  constructor(message) {
    super(message, "AbortError");
  }
}

class FetchBaseError extends Error {
  type;
  constructor(message, type) {
    super(message);
    this.type = type;
  }
}

class FetchError extends FetchBaseError {
  constructor(message, type, systemError) {
    super(message, type);
    this.code = systemError?.code;
  }
}
function blobFrom(path, options) {
  return @Promise.@resolve(Bun.file(path, options));
}
function blobFromSync(path, options) {
  return Bun.file(path, options);
}
var fileFrom = blobFrom, fileFromSync = blobFromSync;
function isRedirect(code) {
  return code === 301 || code === 302 || code === 303 || code === 307 || code === 308;
}
$ = Object.assign(fetch, {
  AbortError,
  Blob,
  FetchBaseError,
  FetchError,
  File,
  FormData,
  Headers,
  Request,
  Response,
  blobFrom,
  blobFromSync,
  fileFrom,
  fileFromSync,
  isRedirect,
  fetch,
  default: fetch
});
return $})

