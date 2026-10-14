(function (){"use strict";// build/release/tmp_modules/internal-for-testing.ts
var $, fmtBinding = @lazy(98), highlightJavaScript = (code) => fmtBinding(code, "highlight-javascript"), escapePowershell = (code) => fmtBinding(code, "escape-powershell"), canonicalizeIP = @lazy(78), SQL = @lazy(1), patchInternals = {
  parse: @lazy(99),
  apply: @lazy(100),
  makeDiff: @lazy(101)
}, internalSourceMap = {
  fromVLQ: @lazy(102),
  toVLQ: @lazy(103),
  find: @lazy(104)
}, shellLex = @lazy(105), shellParse = @lazy(106), escapeRegExp = @lazy(107), escapeRegExpForPackageNameMatching = @lazy(108), shellInternals = {
  lex: (a, ...b) => shellLex(a.raw, b),
  parse: (a, ...b) => shellParse(a.raw, b),
  builtinDisabled: @lazy(109)
}, iniInternals = {
  parse: @lazy(110),
  loadNpmrc: @lazy(111)
}, cssInternals = {
  minifyTestWithOptions: @lazy(112),
  minifyErrorTestWithOptions: @lazy(113),
  testWithOptions: @lazy(114),
  prefixTestWithOptions: @lazy(115),
  minifyTest: @lazy(116),
  prefixTest: @lazy(117),
  _test: @lazy(118),
  attrTest: @lazy(119)
}, crash_handler = @lazy(120), upgrade_test_helpers = @lazy(121), install_test_helpers = @lazy(122), jscInternals = @lazy(123), nativeFrameForTesting = @lazy(124), memfd_create = @lazy(125), createStatsForIno = @lazy(126), setSyntheticAllocationLimitForTesting = @lazy(127), npm_manifest_test_helpers = @lazy(128), npa = @lazy(129), npmTag = @lazy(130), readTarball = @lazy(131), isArchitectureMatch = @lazy(132), isOperatingSystemMatch = @lazy(133), createSocketPair = @lazy(134), isModuleResolveFilenameSlowPathEnabled = @lazy(135), frameworkRouterInternals = @lazy(136), bindgen = @lazy(137), noOpForTesting = @lazy(138), Dequeue = @getInternalField(@internalModuleRegistry, 17) || @createInternalModuleById(17), fs = (@getInternalField(@internalModuleRegistry, 97) || @createInternalModuleById(97)).@data, fsStreamInternals = {
  writeStreamFastPath(str) {
    return str[(@getInternalField(@internalModuleRegistry, 23) || @createInternalModuleById(23)).kWriteStreamFastPath];
  }
}, arrayBufferViewHasBuffer = @lazy(139), timerInternals = {
  timerClockMs: @lazy(140)
}, decodeURIComponentSIMD = @lazy(141), getDevServerDeinitCount = @lazy(142), getCounters = @lazy(143), hasNonReifiedStatic = @lazy(144), setSocketOptions = @lazy(145), structuredCloneAdvanced = @lazy(146), lsanDoLeakCheck = @lazy(147), getEventLoopStats = @lazy(148), hostedGitInfo = {
  parseUrl: @lazy(149),
  fromUrl: @lazy(150)
};
return{
  upgrade_test_helpers,
  timerInternals,
  structuredCloneAdvanced,
  shellInternals,
  setSyntheticAllocationLimitForTesting,
  setSocketOptions,
  readTarball,
  patchInternals,
  npm_manifest_test_helpers,
  npmTag,
  npa,
  noOpForTesting,
  nativeFrameForTesting,
  memfd_create,
  lsanDoLeakCheck,
  jscInternals,
  isOperatingSystemMatch,
  isModuleResolveFilenameSlowPathEnabled,
  isArchitectureMatch,
  internalSourceMap,
  install_test_helpers,
  iniInternals,
  hostedGitInfo,
  highlightJavaScript,
  hasNonReifiedStatic,
  getEventLoopStats,
  getDevServerDeinitCount,
  getCounters,
  fsStreamInternals,
  fs,
  frameworkRouterInternals,
  escapeRegExpForPackageNameMatching,
  escapeRegExp,
  escapePowershell,
  decodeURIComponentSIMD,
  cssInternals,
  createStatsForIno,
  createSocketPair,
  crash_handler,
  canonicalizeIP,
  bindgen,
  arrayBufferViewHasBuffer,
  SQL,
  Dequeue
};})

