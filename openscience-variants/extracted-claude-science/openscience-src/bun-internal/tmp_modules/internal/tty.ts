(function (){"use strict";// build/release/tmp_modules/internal/tty.ts
var $;
var TERM_ENVS = {
  eterm: 4,
  cons25: 4,
  console: 4,
  cygwin: 4,
  dtterm: 4,
  gnome: 4,
  hurd: 4,
  jfbterm: 4,
  konsole: 4,
  kterm: 4,
  mlterm: 4,
  mosh: 24,
  putty: 4,
  st: 4,
  "rxvt-unicode-24bit": 24,
  terminator: 24
}, TERM_ENVS_REG_EXP = [/ansi/, /color/, /linux/, /^con[0-9]*x[0-9]/, /^rxvt/, /^screen/, /^xterm/, /^vt100/], warned = !1;
function warnOnDeactivatedColors(env) {
  if (warned)
    return;
  let name = "";
  if (env.NODE_DISABLE_COLORS !== @undefined)
    name = "NODE_DISABLE_COLORS";
  if (env.NO_COLOR !== @undefined) {
    if (name !== "")
      name += "' and '";
    name += "NO_COLOR";
  }
  if (name !== "")
    process.emitWarning(`The '${name}' env is ignored due to the 'FORCE_COLOR' env being set.`, "Warning"), warned = !0;
}
function getColorDepth(env) {
  let FORCE_COLOR = env.FORCE_COLOR;
  if (FORCE_COLOR !== @undefined)
    switch (FORCE_COLOR) {
      case "":
      case "1":
      case "true":
        return warnOnDeactivatedColors(env), 4;
      case "2":
        return warnOnDeactivatedColors(env), 8;
      case "3":
        return warnOnDeactivatedColors(env), 24;
      default:
        return 1;
    }
  if (env.NODE_DISABLE_COLORS !== @undefined || env.NO_COLOR !== @undefined || env.TERM === "dumb")
    return 1;
  if (env.TMUX)
    return 8;
  if (env.CI) {
    if (["APPVEYOR", "BUILDKITE", "CIRCLECI", "DRONE", "GITHUB_ACTIONS", "GITLAB_CI", "TRAVIS"].some((sign) => (sign in env)) || env.CI_NAME === "codeship")
      return 8;
    return 1;
  }
  let TEAMCITY_VERSION = env.TEAMCITY_VERSION;
  if (TEAMCITY_VERSION)
    return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(TEAMCITY_VERSION) ? 4 : 1;
  switch (env.TERM_PROGRAM) {
    case "iTerm.app":
      if (!env.TERM_PROGRAM_VERSION || /^[0-2]\./.test(env.TERM_PROGRAM_VERSION))
        return 8;
      return 24;
    case "HyperTerm":
    case "ghostty":
    case "WezTerm":
    case "MacTerm":
      return 24;
    case "Apple_Terminal":
      return 8;
  }
  let COLORTERM = env.COLORTERM;
  if (COLORTERM === "truecolor" || COLORTERM === "24bit")
    return 24;
  let TERM = env.TERM;
  if (TERM) {
    if (TERM.startsWith("xterm-256") !== null)
      return 8;
    let termEnv = TERM.toLowerCase();
    if (TERM_ENVS[termEnv])
      return TERM_ENVS[termEnv];
    if (TERM_ENVS_REG_EXP.some((term) => term.test(termEnv)))
      return 4;
  }
  if (env.COLORTERM)
    return 4;
  return 1;
}
$ = { getColorDepth };
return $})

