(function (){"use strict";// build/release/tmp_modules/internal/fs/cp-sync.ts
var $, ArrayPrototypeEvery = @Array.prototype.every, ArrayPrototypeFilter = @Array.prototype.filter, StringPrototypeSplit = @String.prototype.split;
function areIdentical(srcStat, destStat) {
  return destStat.ino && destStat.dev && destStat.ino === srcStat.ino && destStat.dev === srcStat.dev;
}
var normalizePathToArray = (path) => ArrayPrototypeFilter.@call(StringPrototypeSplit.@call(resolve(path), sep), Boolean);
function isSrcSubdir(src, dest) {
  let srcArr = normalizePathToArray(src), destArr = normalizePathToArray(dest);
  return ArrayPrototypeEvery.@call(srcArr, (cur, i) => destArr[i] === cur);
}
var {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  statSync,
  symlinkSync,
  unlinkSync,
  utimesSync
} = @getInternalField(@internalModuleRegistry, 98) || @createInternalModuleById(98), { dirname, isAbsolute, join, parse, resolve, sep } = @getInternalField(@internalModuleRegistry, 107) || @createInternalModuleById(107);
function cpSyncFn(src, dest, opts) {
  let { srcStat, destStat, skipped } = checkPathsSync(src, dest, opts);
  if (skipped)
    return;
  return checkParentPathsSync(src, srcStat, dest), checkParentDir(destStat, src, dest, opts);
}
function checkPathsSync(src, dest, opts) {
  if (opts.filter) {
    let shouldCopy = opts.filter(src, dest);
    if (@isPromise(shouldCopy))
      throw Error("Expected a boolean from the filter function, but got a promise. Use `fs.promises.cp` instead.");
    if (!shouldCopy)
      return { __proto__: null, skipped: !0 };
  }
  let { srcStat, destStat } = getStatsSync(src, dest, opts);
  if (destStat) {
    if (areIdentical(srcStat, destStat))
      throw Error("src and dest cannot be the same");
    if (srcStat.isDirectory() && !destStat.isDirectory())
      throw Error(`cannot overwrite directory ${src} with non-directory ${dest}`);
    if (!srcStat.isDirectory() && destStat.isDirectory())
      throw Error(`cannot overwrite non-directory ${src} with directory ${dest}`);
  }
  if (srcStat.isDirectory() && isSrcSubdir(src, dest))
    throw Error(`cannot copy ${src} to a subdirectory of self ${dest}`);
  return { __proto__: null, srcStat, destStat, skipped: !1 };
}
function getStatsSync(src, dest, opts) {
  let destStat, statFunc = opts.dereference ? (file) => statSync(file, { bigint: !0 }) : (file) => lstatSync(file, { bigint: !0 }), srcStat = statFunc(src);
  try {
    destStat = statFunc(dest);
  } catch (err) {
    if (err.code === "ENOENT")
      return { srcStat, destStat: null };
    throw err;
  }
  return { srcStat, destStat };
}
function checkParentPathsSync(src, srcStat, dest) {
  let srcParent = resolve(dirname(src)), destParent = resolve(dirname(dest));
  if (destParent === srcParent || destParent === parse(destParent).root)
    return;
  let destStat;
  try {
    destStat = statSync(destParent, { bigint: !0 });
  } catch (err) {
    if (err.code === "ENOENT")
      return;
    throw err;
  }
  if (areIdentical(srcStat, destStat))
    throw Error(`cannot copy ${src} to a subdirectory of self ${dest}`);
  return checkParentPathsSync(src, srcStat, destParent);
}
function checkParentDir(destStat, src, dest, opts) {
  let destParent = dirname(dest);
  if (!existsSync(destParent))
    mkdirSync(destParent, { recursive: !0 });
  return getStats(destStat, src, dest, opts);
}
function getStats(destStat, src, dest, opts) {
  let srcStat = (opts.dereference ? statSync : lstatSync)(src);
  if (srcStat.isDirectory() && opts.recursive)
    return onDir(srcStat, destStat, src, dest, opts);
  else if (srcStat.isDirectory())
    throw Error(`${src} is a directory (not copied)`);
  else if (srcStat.isFile() || srcStat.isCharacterDevice() || srcStat.isBlockDevice())
    return onFile(srcStat, destStat, src, dest, opts);
  else if (srcStat.isSymbolicLink())
    return onLink(destStat, src, dest, opts);
  else if (srcStat.isSocket())
    throw Error(`cannot copy a socket file: ${dest}`);
  else if (srcStat.isFIFO())
    throw Error(`cannot copy a FIFO pipe: ${dest}`);
  throw Error(`cannot copy an unknown file type: ${dest}`);
}
function onFile(srcStat, destStat, src, dest, opts) {
  if (!destStat)
    return copyFile(srcStat, src, dest, opts);
  return mayCopyFile(srcStat, src, dest, opts);
}
function mayCopyFile(srcStat, src, dest, opts) {
  if (opts.force)
    return unlinkSync(dest), copyFile(srcStat, src, dest, opts);
  else if (opts.errorOnExist)
    throw Error(`${dest} already exists`);
}
function copyFile(srcStat, src, dest, opts) {
  if (copyFileSync(src, dest, opts.mode), opts.preserveTimestamps)
    handleTimestamps(srcStat.mode, src, dest);
  return setDestMode(dest, srcStat.mode);
}
function handleTimestamps(srcMode, src, dest) {
  if (fileIsNotWritable(srcMode))
    makeFileWritable(dest, srcMode);
  return setDestTimestamps(src, dest);
}
function fileIsNotWritable(srcMode) {
  return (srcMode & 128) === 0;
}
function makeFileWritable(dest, srcMode) {
  return setDestMode(dest, srcMode | 128);
}
function setDestMode(dest, srcMode) {
  return chmodSync(dest, srcMode);
}
function setDestTimestamps(src, dest) {
  let updatedSrcStat = statSync(src);
  return utimesSync(dest, updatedSrcStat.atime, updatedSrcStat.mtime);
}
function onDir(srcStat, destStat, src, dest, opts) {
  if (!destStat)
    return mkDirAndCopy(srcStat.mode, src, dest, opts);
  return copyDir(src, dest, opts);
}
function mkDirAndCopy(srcMode, src, dest, opts) {
  return mkdirSync(dest), copyDir(src, dest, opts), setDestMode(dest, srcMode);
}
function copyDir(src, dest, opts) {
  for (let dirent of readdirSync(src, { withFileTypes: !0 })) {
    let { name } = dirent, srcItem = join(src, name), destItem = join(dest, name), { destStat, skipped } = checkPathsSync(srcItem, destItem, opts);
    if (!skipped)
      getStats(destStat, srcItem, destItem, opts);
  }
}
function onLink(destStat, src, dest, opts) {
  let resolvedSrc = readlinkSync(src);
  if (!opts.verbatimSymlinks && !isAbsolute(resolvedSrc))
    resolvedSrc = resolve(dirname(src), resolvedSrc);
  if (!destStat)
    return symlinkSync(resolvedSrc, dest);
  let resolvedDest;
  try {
    resolvedDest = readlinkSync(dest);
  } catch (err) {
    if (err.code === "EINVAL" || err.code === "UNKNOWN")
      return symlinkSync(resolvedSrc, dest);
    throw err;
  }
  if (!isAbsolute(resolvedDest))
    resolvedDest = resolve(dirname(dest), resolvedDest);
  if (isSrcSubdir(resolvedSrc, resolvedDest))
    throw Error(`cannot copy ${resolvedSrc} to a subdirectory of self ${resolvedDest}`);
  if (statSync(dest).isDirectory() && isSrcSubdir(resolvedDest, resolvedSrc))
    throw Error(`cannot overwrite ${resolvedDest} with ${resolvedSrc}`);
  return copyLink(resolvedSrc, dest);
}
function copyLink(resolvedSrc, dest) {
  return unlinkSync(dest), symlinkSync(resolvedSrc, dest);
}
$ = cpSyncFn;
return $})

