(function (){"use strict";// build/release/tmp_modules/thirdparty/isomorphic-fetch.ts
var $, bunFetch = Bun.fetch, fetch = (...args) => bunFetch(...args);
fetch.default = fetch;
fetch.fetch = fetch;
$ = fetch;
return $})

