(function (){"use strict";// build/release/tmp_modules/internal/assert/myers_diff.ts
var $, colors = @getInternalField(@internalModuleRegistry, 64) || @createInternalModuleById(64);
var kNopLinesToCollapse = 5, { myersDiff } = @lazy(2);
function printSimpleMyersDiff(diff) {
  let message = "";
  for (let diffIdx = diff.length - 1;diffIdx >= 0; diffIdx--) {
    let { kind, value } = diff[diffIdx];
    if (typeof value === "number")
      value = @String.fromCharCode(value);
    switch (kind) {
      case 0 /* Insert */:
        message += `${colors.green}${value}${colors.white}`;
        break;
      case 1 /* Delete */:
        message += `${colors.red}${value}${colors.white}`;
        break;
      case 2 /* Equal */:
        message += `${colors.white}${value}${colors.white}`;
        break;
      default:
        @throwTypeError(`Invalid diff operation kind: ${kind}`);
    }
  }
  return `
${message}`;
}
function printMyersDiff(diff, _simple = !1) {
  let message = "", skipped = !1, nopCount = 0;
  for (let diffIdx = diff.length - 1;diffIdx >= 0; diffIdx--) {
    let { kind, value } = diff[diffIdx], previousType = diffIdx < diff.length - 1 ? diff[diffIdx + 1].kind : null;
    if (previousType && kind !== previousType && previousType === 2 /* Equal */) {
      if (nopCount === kNopLinesToCollapse + 1)
        message += `${colors.white}  ${diff[diffIdx + 1].value}
`;
      else if (nopCount === kNopLinesToCollapse + 2)
        message += `${colors.white}  ${diff[diffIdx + 2].value}
`, message += `${colors.white}  ${diff[diffIdx + 1].value}
`;
      if (nopCount >= kNopLinesToCollapse + 3)
        message += `${colors.blue}...${colors.white}
`, message += `${colors.white}  ${diff[diffIdx + 1].value}
`, skipped = !0;
      nopCount = 0;
    }
    switch (kind) {
      case 0 /* Insert */:
        message += `${colors.green}+${colors.white} ${value}
`;
        break;
      case 1 /* Delete */:
        message += `${colors.red}-${colors.white} ${value}
`;
        break;
      case 2 /* Equal */:
        if (nopCount < kNopLinesToCollapse)
          message += `${colors.white}  ${value}
`;
        nopCount++;
        break;
      default:
        @throwTypeError(`Invalid diff operation kind: ${kind}`);
    }
  }
  return message = message.trimEnd(), { message: `
${message}`, skipped };
}
$ = { myersDiff, printMyersDiff, printSimpleMyersDiff };
return $})

