(function (){"use strict";// build/release/tmp_modules/internal/fixed_queue.ts
var $;
class FixedCircularBuffer {
  top;
  bottom;
  list;
  next;
  constructor() {
    this.bottom = 0, this.top = 0, this.list = @newArrayWithSize(2048), this.next = null;
  }
  isEmpty() {
    return this.top === this.bottom;
  }
  isFull() {
    return (this.top + 1 & 2047) === this.bottom;
  }
  push(data) {
    this.list[this.top] = data, this.top = this.top + 1 & 2047;
  }
  shift() {
    var { list, bottom } = this;
    let nextItem = list[bottom];
    if (nextItem === @undefined)
      return null;
    return list[bottom] = @undefined, this.bottom = bottom + 1 & 2047, nextItem;
  }
}

class FixedQueue {
  head;
  tail;
  constructor() {
    this.head = this.tail = new FixedCircularBuffer;
  }
  isEmpty() {
    return this.head.isEmpty();
  }
  push(data) {
    if (this.head.isFull())
      this.head = this.head.next = new FixedCircularBuffer;
    this.head.push(data);
  }
  shift() {
    let tail = this.tail, next = tail.shift();
    if (tail.isEmpty() && tail.next !== null)
      this.tail = tail.next, tail.next = null;
    return next;
  }
}
$ = {
  FixedCircularBuffer,
  FixedQueue
};
return $})

