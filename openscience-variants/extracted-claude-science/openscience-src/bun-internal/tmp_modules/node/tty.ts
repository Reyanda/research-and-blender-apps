(function (){"use strict";// build/release/tmp_modules/node/tty.ts
var $, {
  setRawMode: ttySetMode,
  isatty,
  getWindowSize: _getWindowSize
} = @lazy(82), { validateInteger } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), fs = @getInternalField(@internalModuleRegistry, 23) || @createInternalModuleById(23);
function ReadStream(fd) {
  if (!(this instanceof ReadStream))
    return new ReadStream(fd);
  fs.ReadStream.@apply(this, ["", { fd }]), this.isRaw = !1, this.isTTY = isatty(fd);
}
@toClass(ReadStream, "ReadStream", fs.ReadStream);
Object.defineProperty(ReadStream, "prototype", {
  get() {
    let Prototype = Object.create(fs.ReadStream.prototype);
    return Prototype.ref = function() {
      let source = this.@bunNativePtr;
      if (source?.updateRef)
        source.updateRef(!0);
      return this;
    }, Prototype.unref = function() {
      let source = this.@bunNativePtr;
      if (source?.updateRef)
        source.updateRef(!1);
      return this;
    }, Prototype.setRawMode = function(flag) {
      flag = !!flag;
      {
        let err = ttySetMode(this.fd, flag);
        if (err)
          return this.emit("error", Error("setRawMode failed with errno: " + err)), this;
      }
      return this.isRaw = flag, this;
    }, Object.defineProperty(ReadStream, "prototype", { value: Prototype }), Prototype;
  },
  enumerable: !0,
  configurable: !0
});
function WriteStream(fd) {
  if (!(this instanceof WriteStream))
    return new WriteStream(fd);
  let stream = fs.WriteStream.@call(this, null, { fd, @fastPath: !0, autoClose: !1 });
  if (stream.columns = @undefined, stream.rows = @undefined, stream.isTTY = isatty(stream.fd), stream.isTTY) {
    let windowSizeArray = [0, 0];
    if (_getWindowSize(fd, windowSizeArray) === !0)
      stream.columns = windowSizeArray[0], stream.rows = windowSizeArray[1];
  }
  return stream;
}
Object.defineProperty(WriteStream, "prototype", {
  get() {
    let Real = fs.WriteStream.prototype;
    return Object.defineProperty(WriteStream, "prototype", { value: Real }), WriteStream.prototype._refreshSize = function() {
      let oldCols = this.columns, oldRows = this.rows, windowSizeArray = [0, 0];
      if (_getWindowSize(this.fd, windowSizeArray) === !0) {
        if (oldCols !== windowSizeArray[0] || oldRows !== windowSizeArray[1])
          this.columns = windowSizeArray[0], this.rows = windowSizeArray[1], this.emit("resize");
      }
    }, WriteStream.prototype.clearLine = function(dir, cb) {
      return (@getInternalField(@internalModuleRegistry, 113) || @createInternalModuleById(113)).clearLine(this, dir, cb);
    }, WriteStream.prototype.clearScreenDown = function(cb) {
      return (@getInternalField(@internalModuleRegistry, 113) || @createInternalModuleById(113)).clearScreenDown(this, cb);
    }, WriteStream.prototype.cursorTo = function(x, y, cb) {
      return (@getInternalField(@internalModuleRegistry, 113) || @createInternalModuleById(113)).cursorTo(this, x, y, cb);
    }, WriteStream.prototype.getColorDepth = function(env = process.env) {
      return (@getInternalField(@internalModuleRegistry, 62) || @createInternalModuleById(62)).getColorDepth(env);
    }, WriteStream.prototype.getWindowSize = function() {
      return [this.columns, this.rows];
    }, WriteStream.prototype.hasColors = function(count, env) {
      if (env === @undefined && (count === @undefined || typeof count === "object" && count !== null))
        env = count, count = 16;
      else
        validateInteger(count, "count", 2);
      return count <= 2 ** this.getColorDepth(env);
    }, WriteStream.prototype.moveCursor = function(dx, dy, cb) {
      return (@getInternalField(@internalModuleRegistry, 113) || @createInternalModuleById(113)).moveCursor(this, dx, dy, cb);
    }, WriteStream.prototype[Symbol.asyncIterator] = function() {
      return async function* () {}();
    }, Real;
  },
  enumerable: !0,
  configurable: !0
});
$ = { ReadStream, WriteStream, isatty };
return $})

