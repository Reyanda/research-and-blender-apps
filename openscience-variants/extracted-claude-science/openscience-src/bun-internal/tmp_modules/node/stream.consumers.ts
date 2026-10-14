(function (){"use strict";// build/release/tmp_modules/node/stream.consumers.ts
var $, JSONParse = JSON.parse;
async function blob(stream) {
  if (@inherits(1, stream))
    return Bun.readableStreamToBlob(stream);
  let chunks = [];
  for await (let chunk of stream)
    chunks.push(chunk);
  return new Blob(chunks);
}
async function arrayBuffer(stream) {
  if (@inherits(1, stream))
    return Bun.readableStreamToArrayBuffer(stream);
  return (await blob(stream)).arrayBuffer();
}
async function bytes(stream) {
  if (@inherits(1, stream))
    return Bun.readableStreamToBytes(stream);
  return (await blob(stream)).bytes();
}
async function buffer(stream) {
  return @Buffer.from(await arrayBuffer(stream));
}
async function text(stream) {
  if (@inherits(1, stream))
    return Bun.readableStreamToText(stream);
  let dec = /* @__PURE__ */ new TextDecoder, str = "";
  for await (let chunk of stream)
    if (typeof chunk === "string")
      str += chunk;
    else
      str += dec.decode(chunk, { stream: !0 });
  return str += dec.decode(@undefined, { stream: !1 }), str;
}
async function json(stream) {
  if (@inherits(1, stream))
    return Bun.readableStreamToJSON(stream);
  let str = await text(stream);
  return JSONParse(str);
}
$ = {
  arrayBuffer,
  bytes,
  text,
  json,
  buffer,
  blob
};
return $})

