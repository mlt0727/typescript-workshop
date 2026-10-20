---
version: 1
mode: ts
estimatedMinutes: 40
review: self-reviewed
problem: 网络请求、读取文件、等待定时器都不会立刻得到结果，但事件循环不允许你“停下来等”。早期 JavaScript 用回调函数处理这类结果，层层嵌套之后很难读，错误也很难传递。Promise 把“一个将来才会得到的结果”变成了一个可以传递、可以组合的值。fetch、React 的数据加载、几乎所有现代异步 API 都返回 Promise。
objectives:
  - 理解 Promise 的三种状态：等待中、已兑现、已拒绝，状态一旦确定就不再改变
  - 用 then、catch、finally 处理结果，理解 then 返回新的 Promise、可以链式调用
  - 用 new Promise 把基于回调的 API（如 setTimeout）包装成 Promise
  - 知道回调总是异步执行、错误会沿链传递，以及未处理的拒绝会被报告
references:
  - title: Using promises — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises
    checked: 2026-10-20
  - title: Promise — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise
    checked: 2026-10-20
  - title: Promise() constructor — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/Promise
    checked: 2026-10-20
---

## 一个将来才有的值

**Promise** 代表一个异步操作的最终结果。它有三种状态：

- **等待中**（pending）：结果还没出来；
- **已兑现**（fulfilled）：成功，带有一个值；
- **已拒绝**（rejected）：失败，带有一个原因（通常是 `Error`）。

状态只会从“等待中”变成另外两种之一，并且**只变一次**。兑现和拒绝统称**完成**（settled）。TypeScript 用 `Promise<T>` 表示“最终会兑现为 `T` 的 Promise”。

如果你用过 Java 的 `CompletableFuture` 或 Python asyncio 的 `Future`，Promise 是同一类东西：一个代表“将来的结果”的对象，结果出来后，通知事先登记好的回调。

`promise.then(回调)` 登记一个回调：Promise 兑现时，回调收到兑现的值。`catch` 登记失败时的回调，`finally` 无论成功失败都会执行。

:::playground{#basics}
```ts file=main.ts
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function rollDice(lost: boolean): Promise<number> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (lost) {
        reject(new Error('骰子丢了'));
      } else {
        resolve(4);
      }
    }, 100);
  });
}

console.log('开始');
wait(50).then(() => console.log('等了 50 毫秒'));
rollDice(false)
  .then((n) => console.log('掷出', n))
  .finally(() => console.log('第一次掷骰子结束'));
rollDice(true)
  .then((n) => console.log('掷出', n))
  .catch((err: unknown) => console.log('失败：', err instanceof Error ? err.message : err))
  .finally(() => console.log('第二次掷骰子结束'));
console.log('同步代码结束');
```
- 第 2 行：`new Promise(执行函数)` 立即调用执行函数，并传给它 `resolve` 和 `reject`。调用 `resolve(值)` 兑现，调用 `reject(原因)` 拒绝。这是把 `setTimeout` 这类基于回调的 API 包装成 Promise 的标准写法。（如果传给 `resolve` 的本身是另一个 Promise，这个 Promise 不会立刻兑现，而是跟随那个 Promise 的结果。）
- 第 20–27 行只是**登记**回调，不会等待：“同步代码结束”先输出，结果出来后回调才执行（e01 的事件循环）。
- 第 24 行的 Promise 被拒绝：`then` 的回调被跳过，`catch` 的回调收到错误；`finally` 无论成败都会执行。
- 实际开发中，你更多是**使用**别人返回的 Promise（例如 `fetch`），很少自己 `new Promise`。
:::

## then 返回新的 Promise

`then` 的返回值是一个**新的** Promise，它会兑现为回调的返回值。所以 `then` 可以一个接一个地写下去，每一步处理上一步的结果。TypeScript 跟踪每一步的类型：

- 回调返回普通值 `U`，新 Promise 是 `Promise<U>`；
- 回调返回另一个 Promise，新 Promise 会**等它完成**并采用它的结果（不会出现 `Promise<Promise<U>>`）。

:::playground{#chaining}
```ts file=main.ts
function fetchUserName(id: number): Promise<string> {
  return Promise.resolve(id === 1 ? '  ada  ' : '  grace ');
}

function fetchScore(name: string): Promise<number> {
  return new Promise((resolve) => setTimeout(() => resolve(name.length * 10), 50));
}

const result = fetchUserName(1)
  .then((name) => name.trim())
  .then((name) => name.toUpperCase())
  .then((name) => fetchScore(name))
  .then((score) => `得分：${score}`);

result.then((text) => console.log(text));
```
- 把鼠标停在 `result` 上：类型是 `Promise<string>`。
- 第 12 行的回调返回 `Promise<number>`，下一步的 `score` 直接是 `number`。
- `Promise.resolve(值)` 创建一个已兑现的 Promise，常用于测试和示例。对应地，`Promise.reject(原因)` 创建一个已拒绝的 Promise。
:::

## 回调总是异步执行

即使 Promise 已经兑现，`then` 的回调也**不会**立刻执行，而是作为微任务，在当前同步代码结束后执行（e01）。这保证了无论 Promise 是否已经完成，代码的执行顺序都是一致的。

:::playground{#always-async}
```ts file=main.ts
const ready = Promise.resolve('已经有结果了');

ready.then((value) => console.log('2', value));
console.log('1 同步代码');
```
:::

## 错误沿着链传递

在 `then` 回调中抛出错误，或者返回一个被拒绝的 Promise，都会让 `then` 返回的 Promise 被拒绝。拒绝会跳过后面的 `then`，一直传到最近的 `catch`。`catch` 本身也返回新的 Promise：处理完错误后，链可以继续。

没有任何 `catch` 处理的拒绝，会被运行环境报告为“未处理的 Promise 拒绝”——浏览器控制台里的红色错误、Node.js 中甚至会让进程退出。

:::playground{#errors run=error}
```ts file=main.ts
function parsePrice(text: string): Promise<number> {
  return Promise.resolve(text).then((t) => {
    const price = Number(t);
    if (Number.isNaN(price)) {
      throw new Error(`不是价格：${t}`);
    }
    return price;
  });
}

parsePrice('abc')
  .then((price) => price * 0.9)
  .then((discounted) => console.log('折后', discounted))
  .catch((err: unknown) => {
    console.log('出错了：', err instanceof Error ? err.message : err);
    return 0;
  })
  .then((value) => console.log('继续执行，值是', value));

parsePrice('oops').then((price) => console.log(price));
```
- 第 5 行抛出的错误跳过了第 12、13 行，被第 14 行的 `catch` 处理。`catch` 返回 `0`，链继续，第 18 行输出“继续执行，值是 0”。
- 注意 `catch` 回调的参数：标准库把它的类型写成了 `any`，和 `try/catch` 不同，`strict` 选项管不到这里，直接写 `err.message` 也不会报错。所以要像第 14 行这样自己写上注解 `err: unknown`，再像 a20 那样检查后使用。`then` 的第二个参数（失败时的回调）也是如此。
- 第 20 行没有 `catch`，平台报告了“未处理的 Promise 拒绝”。
:::

::exercise{#delay-helpers}

## 编程挑战

::exercise{#retry}

::quiz

## 常见错误

- **在 `then` 里忘了 `return`**：下一步拿到的是 `undefined`，而且内部 Promise 的错误不会传到外面。
- **以为 `then` 会“等待”**：它只是登记回调，后面的同步代码照常执行。
- **只写 `then` 不写 `catch`**：拒绝没人处理。
- **嵌套 `then`**：`a.then((x) => b(x).then(…))` 能用，但把内部的 Promise 返回出来、继续链式调用更清楚。

## 下一步

下一课讲 `async`/`await`：用看起来像同步代码的写法使用 Promise，以及 `try/catch` 如何处理异步错误。
