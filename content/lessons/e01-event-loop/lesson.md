---
version: 1
mode: ts
estimatedMinutes: 35
review: ai-draft
problem: JavaScript 只有一个主线程，却要同时处理用户点击、网络响应、定时器。它靠的不是多线程，而是事件循环：代码一段一段地执行，每段都运行到结束，等待中的回调排队等着下一次机会。不理解这个模型，就会写出“为什么 setTimeout 0 没有立刻执行”“为什么页面卡住了”这类问题；后面的 Promise、async/await 也都建立在它之上。
objectives:
  - 理解 JavaScript 单线程、运行到完成：一段同步代码执行时，任何回调都不会插进来
  - 区分任务（定时器、事件）和微任务（Promise 回调、queueMicrotask），能预测输出顺序
  - 知道 setTimeout 的延迟是“至少”，长时间的同步代码会推迟所有回调、卡住页面
  - 用 setTimeout / clearTimeout 安排和取消回调，并用测试中的假计时器验证
references:
  - title: The event loop — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Event_loop
    checked: 2026-10-20
  - title: Using microtasks in JavaScript with queueMicrotask() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide
    checked: 2026-10-20
  - title: setTimeout() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout
    checked: 2026-10-20
---

## 单线程，运行到完成

浏览器里的 JavaScript（以及 Node.js 中的主代码）在**一个线程**上运行。和 Java 的多线程不同，你写的代码不会被另一个线程打断：一段同步代码一旦开始，就会**一直运行到结束**，期间任何回调（定时器到点、按钮被点击、网络响应到达）都只能排队等待。

“排队”就是**事件循环**的工作：

1. 执行当前的一段代码（一个**任务**，例如整个脚本、一次定时器回调、一次点击处理），直到调用栈清空；
2. 执行所有**微任务**（Promise 的回调、`queueMicrotask` 安排的函数），包括执行过程中新加入的微任务；
3. （浏览器在合适的时候渲染页面）；
4. 从任务队列中取出下一个任务，回到第 1 步。

:::playground{#order}
```ts file=main.ts
console.log('1 同步');

setTimeout(() => console.log('5 定时器回调'), 0);

Promise.resolve().then(() => console.log('3 Promise 回调'));

queueMicrotask(() => console.log('4 微任务'));

console.log('2 同步');
```
- 先把两行同步输出打印完（当前任务运行到结束）。
- 然后执行所有微任务：Promise 回调和 `queueMicrotask` 按加入的顺序执行。
- 最后才轮到下一个任务：定时器回调。`setTimeout(…, 0)` 的意思是“尽快放进任务队列”，而不是“立刻执行”。
- `Promise.resolve().then(…)` 的细节下一课讲，这里只需要知道它的回调是一个微任务。
:::

## 延迟是“至少”，同步代码会挡住一切

`setTimeout(回调, 毫秒)` 安排回调**在至少这么多毫秒之后**放进任务队列。如果那时还有同步代码在运行，回调只能继续等。

所以长时间运行的同步代码（大循环、大量计算）会推迟所有回调；在浏览器里，它还会让页面无法响应点击、无法渲染，看起来就是“卡死了”。

:::playground{#blocking}
```ts file=main.ts
const start = Date.now();

setTimeout(() => {
  console.log('定时器在', Date.now() - start, '毫秒后才执行');
}, 0);

while (Date.now() - start < 300) {
  // 忙等 300 毫秒，模拟一段很慢的同步计算
}
console.log('同步代码结束');
```
- 定时器要求 0 毫秒，实际等了 300 毫秒以上：它必须等同步代码结束。
- 本平台的纯 TS 示例运行在 Worker 中，所以页面没有卡住；如果同样的代码运行在页面的主线程上，这 300 毫秒里页面完全没有反应。
- 处理大量计算时，可以把工作拆成小块、用 `setTimeout` 分批执行，或者交给 Web Worker（另一个线程）。
:::

## 取消定时器

`setTimeout` 返回一个编号，把它传给 `clearTimeout` 就能取消还没执行的回调。（周期性执行用 `setInterval`，取消用 `clearInterval`。）

:::playground{#clear-timeout}
```ts file=main.ts
const timer = setTimeout(() => console.log('这一行不会出现'), 100);
clearTimeout(timer);

let count = 0;
const interval = setInterval(() => {
  count++;
  console.log('第', count, '次');
  if (count === 3) {
    clearInterval(interval);
  }
}, 50);
```
- 第 1 行的回调在执行前被取消了。
- `setInterval` 每 50 毫秒执行一次，第 3 次时取消自己。平台会等所有定时器结束后才认为运行完成。
:::

## 在测试中控制时间

测试定时器相关的代码时，不可能真的去等。测试框架提供了**假计时器**：`vi.useFakeTimers()` 之后，`setTimeout` 不再真的计时，测试用 `vi.advanceTimersByTime(毫秒)` 手动“快进”。本课的练习就是这样测试的，你可以点“查看验收测试”看看。

::exercise{#reminder}

## 编程挑战

::exercise{#debounce}

::quiz

## 常见错误

- **以为 `setTimeout(fn, 0)` 会立刻执行**：它要等当前代码和所有微任务结束。
- **以为定时器会准时执行**：延迟是“至少”，被同步代码挡住时会更晚。
- **在主线程上做长时间的同步计算**：页面会卡住。拆分任务或使用 Web Worker。
- **忘了取消不再需要的定时器**：回调仍会执行，可能操作已经不存在的数据。

## 下一步

下一课讲 Promise：如何表示一个“将来才会得到的结果”，以及 `then`、`catch`、`finally` 的链式调用。
