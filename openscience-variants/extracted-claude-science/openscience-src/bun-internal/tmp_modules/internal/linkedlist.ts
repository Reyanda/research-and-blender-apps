(function (){"use strict";// build/release/tmp_modules/internal/linkedlist.ts
var $;
function init(list) {
  return list._idleNext = list, list._idlePrev = list, list;
}
function peek(list) {
  if (list._idlePrev === list)
    return null;
  return list._idlePrev;
}
function remove(item) {
  if (item._idleNext)
    item._idleNext._idlePrev = item._idlePrev;
  if (item._idlePrev)
    item._idlePrev._idleNext = item._idleNext;
  item._idleNext = null, item._idlePrev = null;
}
function append(list, item) {
  if (item._idleNext || item._idlePrev)
    remove(item);
  item._idleNext = list._idleNext, item._idlePrev = list, list._idleNext._idlePrev = item, list._idleNext = item;
}
function isEmpty(list) {
  return list._idleNext === list;
}
return{
  remove,
  peek,
  isEmpty,
  init,
  append
};})

