(function (){"use strict";// build/release/tmp_modules/internal/fs/cp.ts
var $, { chmod, copyFile, lstat, mkdir, opendir, readlink, stat, symlink, unlink, utimes } = @getInternalField(@internalModuleRegistry, 97) || @createInternalModuleById(97), { dirname, isAbsolute, join, parse, resolve, sep } = @getInternalField(@internalModuleRegistry, 107) || @createInternalModuleById(107), PromisePrototypeThen = @Promise.prototype.@then, PromiseReject = @Promise.@reject, ArrayPrototypeFilter = @Array.prototype.filter, StringPrototypeSplit = @String.prototype.split, ArrayPrototypeEvery = @Array.prototype.every;
async function cpFn(src, dest, opts) {
  let stats = await checkPaths(src, dest, opts), { srcStat, destStat, skipped } = stats;
  if (skipped)
    return;
  return await checkParentPaths(src, srcStat, dest), checkParentDir(destStat, src, dest, opts);
}
async function checkPaths(src, dest, opts) {
  if (opts.filter && !await opts.filter(src, dest))
    return { __proto__: null, skipped: !0 };
  let { 0: srcStat, 1: destStat } = await getStats(src, dest, opts);
  if (destStat) {
    if (areIdentical(srcStat, destStat))
      throw Error("Source and destination must not be the same.");
    if (srcStat.isDirectory() && !destStat.isDirectory())
      throw Error(`cannot overwrite directory ${src} with non-directory ${dest}`);
    if (!srcStat.isDirectory() && destStat.isDirectory())
      throw Error(`cannot overwrite non-directory ${src} with directory ${dest}`);
  }
  if (srcStat.isDirectory() && isSrcSubdir(src, dest))
    throw Error(`cannot copy ${src} to a subdirectory of self ${dest}`);
  return { __proto__: null, srcStat, destStat, skipped: !1 };
}
function areIdentical(srcStat, destStat) {
  return destStat.ino && destStat.dev && destStat.ino === srcStat.ino && destStat.dev === srcStat.dev;
}
function getStats(src, dest, opts) {
  let statFunc = opts.dereference ? (file) => stat(file, { bigint: !0 }) : (file) => lstat(file, { bigint: !0 });
  return @Promise.all([
    statFunc(src),
    PromisePrototypeThen.@call(statFunc(dest), @undefined, (err) => {
      if (err.code === "ENOENT")
        return null;
      throw err;
    })
  ]);
}
async function checkParentDir(destStat, src, dest, opts) {
  let destParent = dirname(dest);
  if (await pathExists(destParent))
    return getStatsForCopy(destStat, src, dest, opts);
  return await mkdir(destParent, { recursive: !0 }), getStatsForCopy(destStat, src, dest, opts);
}
function pathExists(dest) {
  return PromisePrototypeThen.@call(stat(dest), () => !0, (err) => err.code === "ENOENT" ? !1 : PromiseReject(err));
}
async function checkParentPaths(src, srcStat, dest) {
  let srcParent = resolve(dirname(src)), destParent = resolve(dirname(dest));
  if (destParent === srcParent || destParent === parse(destParent).root)
    return;
  let destStat;
  try {
    destStat = await stat(destParent, { bigint: !0 });
  } catch (err) {
    if (err.code === "ENOENT")
      return;
    throw err;
  }
  if (areIdentical(srcStat, destStat))
    throw Error(`cannot copy ${src} to a subdirectory of self ${dest}`);
  return checkParentPaths(src, srcStat, destParent);
}
var normalizePathToArray = (path) => ArrayPrototypeFilter.@call(StringPrototypeSplit.@call(resolve(path), sep), Boolean);
function isSrcSubdir(src, dest) {
  let srcArr = normalizePathToArray(src), destArr = normalizePathToArray(dest);
  return ArrayPrototypeEvery.@call(srcArr, (cur, i) => destArr[i] === cur);
}
async function getStatsForCopy(destStat, src, dest, opts) {
  let srcStat = await (opts.dereference ? stat : lstat)(src);
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
    return _copyFile(srcStat, src, dest, opts);
  return mayCopyFile(srcStat, src, dest, opts);
}
async function mayCopyFile(srcStat, src, dest, opts) {
  if (opts.force)
    return await unlink(dest), _copyFile(srcStat, src, dest, opts);
  else if (opts.errorOnExist)
    throw Error(`${dest} already exists`);
}
async function _copyFile(srcStat, src, dest, opts) {
  if (await copyFile(src, dest, opts.mode), opts.preserveTimestamps)
    return handleTimestampsAndMode(srcStat.mode, src, dest);
  return setDestMode(dest, srcStat.mode);
}
async function handleTimestampsAndMode(srcMode, src, dest) {
  if (fileIsNotWritable(srcMode))
    return await makeFileWritable(dest, srcMode), setDestTimestampsAndMode(srcMode, src, dest);
  return setDestTimestampsAndMode(srcMode, src, dest);
}
function fileIsNotWritable(srcMode) {
  return (srcMode & 128) === 0;
}
function makeFileWritable(dest, srcMode) {
  return setDestMode(dest, srcMode | 128);
}
async function setDestTimestampsAndMode(srcMode, src, dest) {
  return await setDestTimestamps(src, dest), setDestMode(dest, srcMode);
}
function setDestMode(dest, srcMode) {
  return chmod(dest, srcMode);
}
async function setDestTimestamps(src, dest) {
  let updatedSrcStat = await stat(src);
  return utimes(dest, updatedSrcStat.atime, updatedSrcStat.mtime);
}
function onDir(srcStat, destStat, src, dest, opts) {
  if (!destStat)
    return mkDirAndCopy(srcStat.mode, src, dest, opts);
  return copyDir(src, dest, opts);
}
async function mkDirAndCopy(srcMode, src, dest, opts) {
  return await mkdir(dest), await copyDir(src, dest, opts), setDestMode(dest, srcMode);
}
async function copyDir(src, dest, opts) {
  let dir = await opendir(src);
  for await (let { name } of dir) {
    let srcItem = join(src, name), destItem = join(dest, name), { destStat, skipped } = await checkPaths(srcItem, destItem, opts);
    if (!skipped)
      await getStatsForCopy(destStat, srcItem, destItem, opts);
  }
}
async function onLink(destStat, src, dest, opts) {
  let resolvedSrc = await readlink(src);
  if (!opts.verbatimSymlinks && !isAbsolute(resolvedSrc))
    resolvedSrc = resolve(dirname(src), resolvedSrc);
  if (!destStat)
    return symlink(resolvedSrc, dest);
  let resolvedDest;
  try {
    resolvedDest = await readlink(dest);
  } catch (err) {
    if (err.code === "EINVAL" || err.code === "UNKNOWN")
      return symlink(resolvedSrc, dest);
    throw err;
  }
  if (!isAbsolute(resolvedDest))
    resolvedDest = resolve(dirname(dest), resolvedDest);
  if (isSrcSubdir(resolvedSrc, resolvedDest))
    throw Error(`cannot copy ${resolvedSrc} to a subdirectory of self ${resolvedDest}`);
  if ((await stat(src)).isDirectory() && isSrcSubdir(resolvedDest, resolvedSrc))
    throw Error(`cannot overwrite ${resolvedDest} with ${resolvedSrc}`);
  return copyLink(resolvedSrc, dest);
}
async function copyLink(resolvedSrc, dest) {
  return await unlink(dest), symlink(resolvedSrc, dest);
}
$ = cpFn;
return $})

