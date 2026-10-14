(function (){"use strict";// build/release/tmp_modules/internal/freelist.ts
var $;

class FreeList {
  name;
  max;
  ctor;
  list;
  constructor(name, max, ctor) {
    this.name = name, this.ctor = ctor, this.max = max, this.list = [];
  }
  alloc() {
    return this.list.length > 0 ? this.list.pop() : new this.ctor(...arguments);
  }
  free(obj) {
    if (this.list.length < this.max)
      return this.list.push(obj), !0;
    return !1;
  }
}
$ = FreeList;
return $})

