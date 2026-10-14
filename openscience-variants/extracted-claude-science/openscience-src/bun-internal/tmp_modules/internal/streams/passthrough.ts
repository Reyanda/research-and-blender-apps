(function (){"use strict";// build/release/tmp_modules/internal/streams/passthrough.ts
var $, Transform = @getInternalField(@internalModuleRegistry, 57) || @createInternalModuleById(57);
function PassThrough(options) {
  if (!(this instanceof PassThrough))
    return new PassThrough(options);
  Transform.@call(this, options);
}
@toClass(PassThrough, "PassThrough", Transform);
PassThrough.prototype._transform = function(chunk, encoding, cb) {
  cb(null, chunk);
};
$ = PassThrough;
return $})

