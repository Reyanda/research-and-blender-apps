(function (){"use strict";// build/release/tmp_modules/internal/streams/compose.ts
var $, { pipeline } = @getInternalField(@internalModuleRegistry, 54) || @createInternalModuleById(54), Duplex = @getInternalField(@internalModuleRegistry, 44) || @createInternalModuleById(44), { destroyer } = @getInternalField(@internalModuleRegistry, 43) || @createInternalModuleById(43), {
  isNodeStream,
  isReadable,
  isWritable,
  isWebStream,
  isTransformStream,
  isWritableStream,
  isReadableStream
} = @getInternalField(@internalModuleRegistry, 58) || @createInternalModuleById(58), eos = @getInternalField(@internalModuleRegistry, 47) || @createInternalModuleById(47), ArrayPrototypeSlice = @Array.prototype.slice;
$ = function compose(...streams) {
  if (streams.length === 0)
    throw @makeErrorWithCode(150, "streams");
  if (streams.length === 1)
    return Duplex.from(streams[0]);
  let orgStreams = ArrayPrototypeSlice.@call(streams);
  if (typeof streams[0] === "function")
    streams[0] = Duplex.from(streams[0]);
  if (typeof streams[streams.length - 1] === "function") {
    let idx = streams.length - 1;
    streams[idx] = Duplex.from(streams[idx]);
  }
  for (let n = 0;n < streams.length; ++n) {
    if (!isNodeStream(streams[n]) && !isWebStream(streams[n]))
      continue;
    if (n < streams.length - 1 && !(isReadable(streams[n]) || isReadableStream(streams[n]) || isTransformStream(streams[n])))
      throw @makeErrorWithCode(119, `streams[${n}]`, orgStreams[n], "must be readable");
    if (n > 0 && !(isWritable(streams[n]) || isWritableStream(streams[n]) || isTransformStream(streams[n])))
      throw @makeErrorWithCode(119, `streams[${n}]`, orgStreams[n], "must be writable");
  }
  let ondrain, onfinish, onreadable, onclose, d;
  function onfinished(err) {
    let cb = onclose;
    if (onclose = null, cb)
      cb(err);
    else if (err)
      d.destroy(err);
    else if (!readable && !writable)
      d.destroy();
  }
  let head = streams[0], tail = pipeline(streams, onfinished), writable = !!(isWritable(head) || isWritableStream(head) || isTransformStream(head)), readable = !!(isReadable(tail) || isReadableStream(tail) || isTransformStream(tail));
  if (d = new Duplex({
    writableObjectMode: !!head?.writableObjectMode,
    readableObjectMode: !!tail?.readableObjectMode,
    writable,
    readable
  }), writable) {
    if (isNodeStream(head))
      d._write = function(chunk, encoding, callback) {
        if (head.write(chunk, encoding))
          callback();
        else
          ondrain = callback;
      }, d._final = function(callback) {
        head.end(), onfinish = callback;
      }, head.on("drain", function() {
        if (ondrain) {
          let cb = ondrain;
          ondrain = null, cb();
        }
      });
    else if (isWebStream(head)) {
      let writer = (isTransformStream(head) ? head.writable : head).getWriter();
      d._write = async function(chunk, encoding, callback) {
        try {
          await writer.ready, writer.write(chunk).catch(() => {}), callback();
        } catch (err) {
          callback(err);
        }
      }, d._final = async function(callback) {
        try {
          await writer.ready, writer.close().catch(() => {}), onfinish = callback;
        } catch (err) {
          callback(err);
        }
      };
    }
    let toRead = isTransformStream(tail) ? tail.readable : tail;
    eos(toRead, () => {
      if (onfinish) {
        let cb = onfinish;
        onfinish = null, cb();
      }
    });
  }
  if (readable) {
    if (isNodeStream(tail))
      tail.on("readable", function() {
        if (onreadable) {
          let cb = onreadable;
          onreadable = null, cb();
        }
      }), tail.on("end", function() {
        d.push(null);
      }), d._read = function() {
        while (!0) {
          let buf = tail.read();
          if (buf === null) {
            onreadable = d._read;
            return;
          }
          if (!d.push(buf))
            return;
        }
      };
    else if (isWebStream(tail)) {
      let reader = (isTransformStream(tail) ? tail.readable : tail).getReader();
      d._read = async function() {
        while (!0)
          try {
            let { value, done } = await reader.read();
            if (!d.push(value))
              return;
            if (done) {
              d.push(null);
              return;
            }
          } catch {
            return;
          }
      };
    }
  }
  return d._destroy = function(err, callback) {
    if (!err && onclose !== null)
      err = @makeAbortError();
    if (onreadable = null, ondrain = null, onfinish = null, isNodeStream(tail))
      destroyer(tail, err);
    if (onclose === null)
      callback(err);
    else
      onclose = callback;
  }, d;
};
return $})

