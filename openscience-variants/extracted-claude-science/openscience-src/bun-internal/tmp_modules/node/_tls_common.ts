(function (){"use strict";// build/release/tmp_modules/node/_tls_common.ts
var $;
function translatePeerCertificate(c) {
  if (!c)
    return null;
  if (c.issuerCertificate != null && c.issuerCertificate !== c)
    c.issuerCertificate = translatePeerCertificate(c.issuerCertificate);
  if (c.infoAccess != null) {
    let info = c.infoAccess;
    c.infoAccess = Object.create(null), info.replace(/([^\n:]*):([^\n]*)(?:\n|$)/g, (all, key, val) => {
      if (val.charCodeAt(0) === 34)
        val = JSON.parse(val);
      if (key in c.infoAccess)
        c.infoAccess[key].push(val);
      else
        c.infoAccess[key] = [val];
    });
  }
  return c;
}
$ = {
  translatePeerCertificate
};
return $})

