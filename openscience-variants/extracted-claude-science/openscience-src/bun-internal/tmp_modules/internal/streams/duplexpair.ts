(function (){"use strict";// build/release/tmp_modules/internal/streams/duplexpair.ts
var $, Duplex = @getInternalField(@internalModuleRegistry, 44) || @createInternalModuleById(44), kCallback = Symbol("Callback"), kInitOtherSide = Symbol("InitOtherSide");

class DuplexSide extends Duplex {
  #otherSide = null;
  [kCallback] = null;
  constructor(options) {
    super(options);
    this.#otherSide = null;
  }
  [kInitOtherSide](otherSide) {
    if (this.#otherSide === null)
      this.#otherSide = otherSide;
  }
  _read() {
    let callback = this[kCallback];
    if (callback)
      this[kCallback] = null, callback();
  }
  _write(chunk, encoding, callback) {
    if (chunk.length === 0)
      process.nextTick(callback);
    else
      this.#otherSide.push(chunk), this.#otherSide[kCallback] = callback;
  }
  _final(callback) {
    this.#otherSide.on("end", callback), this.#otherSide.push(null);
  }
}
function duplexPair(options) {
  let side0 = new DuplexSide(options), side1 = new DuplexSide(options);
  return side0[kInitOtherSide](side1), side1[kInitOtherSide](side0), [side0, side1];
}
$ = duplexPair;
return $})

