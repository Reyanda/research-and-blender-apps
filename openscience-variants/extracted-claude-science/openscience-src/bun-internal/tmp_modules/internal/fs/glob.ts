(function (){"use strict";// build/release/tmp_modules/internal/fs/glob.ts
var $, { validateObject, validateString, validateFunction, validateArray } = @getInternalField(@internalModuleRegistry, 68) || @createInternalModuleById(68), { sep } = @getInternalField(@internalModuleRegistry, 107) || @createInternalModuleById(107);
async function* glob(pattern, options) {
  let patterns = validatePattern(pattern), globOptions = mapOptions(options || {}), exclude = globOptions.exclude, excludeGlobs = @Array.isArray(exclude) ? exclude.flatMap((pattern2) => [new Bun.Glob(pattern2), new Bun.Glob(pattern2.replace(/\/+$/, "") + "/**")]) : null;
  for (let pat of patterns)
    for await (let ent of new Bun.Glob(pat).scan(globOptions)) {
      if (typeof exclude === "function") {
        if (exclude(ent))
          continue;
      } else if (excludeGlobs) {
        if (excludeGlobs.some((glob2) => glob2.match(ent)))
          continue;
      }
      yield ent;
    }
}
function* globSync(pattern, options) {
  let patterns = validatePattern(pattern), globOptions = mapOptions(options || {}), exclude = globOptions.exclude, excludeGlobs = @Array.isArray(exclude) ? exclude.flatMap((pattern2) => [new Bun.Glob(pattern2), new Bun.Glob(pattern2.replace(/\/+$/, "") + "/**")]) : null;
  for (let pat of patterns)
    for (let ent of new Bun.Glob(pat).scanSync(globOptions)) {
      if (typeof exclude === "function") {
        if (exclude(ent))
          continue;
      } else if (excludeGlobs) {
        if (excludeGlobs.some((glob2) => glob2.match(ent)))
          continue;
      }
      yield ent;
    }
}
function validatePattern(pattern) {
  if (@Array.isArray(pattern))
    return validateArray(pattern, "pattern"), pattern.map((p) => {
      return validateString(p, "pattern"), p;
    });
  return validateString(pattern, "pattern"), [pattern];
}
function mapOptions(options) {
  validateObject(options, "options");
  let exclude = options.exclude ?? no;
  if (@Array.isArray(exclude))
    validateArray(exclude, "options.exclude");
  else
    validateFunction(exclude, "options.exclude");
  if (options.withFileTypes)
    @throwTypeError("fs.glob does not support options.withFileTypes yet. Please open an issue on GitHub.");
  return {
    cwd: options?.cwd ?? process.cwd(),
    followSymlinks: !0,
    onlyFiles: !1,
    exclude
  };
}
var no = (_) => !1;
$ = { glob, globSync };
return $})

