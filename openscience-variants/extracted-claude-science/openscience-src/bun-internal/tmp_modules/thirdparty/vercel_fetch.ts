(function (){"use strict";// build/release/tmp_modules/thirdparty/vercel_fetch.ts
var $;
$ = (wrapper = Bun.fetch) => {
  async function vercelFetch(url, opts = {}) {
    if (opts.body && typeof opts.body === "object" && (!("buffer" in opts.body) || typeof opts.body.buffer !== "object" || !(opts.body.buffer instanceof @ArrayBuffer))) {
      if (opts.body = JSON.stringify(opts.body), !opts.headers)
        opts.headers = /* @__PURE__ */ new Headers;
      opts.headers.set("Content-Type", "application/json");
    }
    try {
      return await wrapper(url, opts);
    } catch (error) {
      throw error.url = url, error.opts = opts, error;
    }
  }
  return vercelFetch.default = vercelFetch, vercelFetch;
};
return $})

