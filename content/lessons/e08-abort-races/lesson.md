---
version: 1
mode: ts
estimatedMinutes: 40
review: ai-draft
problem: 用户在搜索框里先输入 t，又很快输入了 ty。两个请求都发了出去，但服务器处理 t 的请求更慢，它的结果比 ty 的结果晚到了一步，于是页面最终显示的是过时的 t 的结果。这种“后发先至”的竞态条件在任何异步界面里都会遇到，单靠禁用按钮解决不了。这一课讲两种办法：只采用最新请求的结果，以及用 AbortController 真正取消过时的请求；还会用同样的机制实现超时。
objectives:
  - 识别异步请求中的竞态条件：结果到达的顺序不一定是发出的顺序
  - 用请求编号只采用最新的结果，用 AbortController 取消过时的请求
  - 区分 AbortError、TimeoutError 与其他错误；用 AbortSignal.timeout 和 AbortSignal.any 组合取消条件
  - 让自己写的异步函数接受 signal 参数，支持被取消
references:
  - title: AbortController — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/AbortController
    checked: 2026-10-20
  - title: AbortSignal — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
    checked: 2026-10-20
  - title: AbortSignal.timeout() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static
    checked: 2026-10-20
  - title: AbortSignal.any() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static
    checked: 2026-10-20
---

## 后发先至

先看问题。两个搜索请求依次发出，但第一个更慢（模拟服务器对 `t` 需要 300 毫秒，对 `ty` 只需要 100 毫秒）。谁后完成，谁的结果就留在了界面上：

:::playground{#race-problem fixtures=search}
```ts file=main.ts
let shown: unknown = null;

async function search(q: string): Promise<void> {
  const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
  const results: unknown = await response.json();
  shown = results;
  console.log(`显示了 ${q} 的结果：`, results);
}

await Promise.all([search('t'), search('ty')]);
console.log('最终界面上的结果：', shown);
```
- `ty` 的结果先到并显示；200 毫秒后 `t` 的结果才到，覆盖了它。用户输入的是 `ty`，看到的却是 `t` 的结果。
- 网络和服务器的耗时无法预测，同样的代码在本机测试时可能一切正常，到了真实网络上才出问题，这正是竞态条件难以发现的原因。
:::

## 办法一：只采用最新的结果

给每次请求一个递增的编号，结果回来时检查它是不是最新的那一次，不是就丢弃：

```ts
let latest = 0;

async function search(q: string): Promise<void> {
  const id = ++latest;
  const results = await fetchResults(q);
  if (id !== latest) return; // 已经有更新的请求了，丢弃过时的结果
  render(results);
}
```

这样界面不会再显示过时的结果，但旧的请求仍然在进行，浪费流量和服务器资源。

## 办法二：用 AbortController 取消

`AbortController` 是取消异步操作的标准机制：

- `new AbortController()` 得到一个控制器，它的 `signal` 属性是一个 `AbortSignal`；
- 把 `signal` 传给 `fetch(url, { signal })`；
- 调用 `controller.abort()`，请求就会停止：还在等待响应时，`fetch` 返回的 Promise 被拒绝；`fetch` 已经兑现（响应头到了）、响应体还在传输时，`response.json()` 这类读取方法被拒绝。只有响应体也读完了，取消才不再有影响；
- 不传参数时，拒绝的原因是一个 `name` 为 `'AbortError'` 的 `DOMException`；`controller.abort(原因)` 则以你给出的原因拒绝。

每次发出新请求之前，取消上一次的：

:::playground{#abort fixtures=search}
```ts file=main.ts
let current: AbortController | undefined;

async function search(q: string): Promise<void> {
  current?.abort();
  const controller = new AbortController();
  current = controller;
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
    const results: unknown = await response.json();
    console.log(`显示了 ${q} 的结果：`, results);
  } catch (err) {
    if (controller.signal.aborted) {
      console.log(`${q} 的请求被取消了`);
      return;
    }
    throw err;
  }
}

await Promise.all([search('t'), search('ty')]);
```
- 第 4 行：发出 `ty` 的请求之前，取消了 `t` 的请求。`t` 的 `fetch` 立即以 `AbortError` 拒绝。
- 第 12–15 行：取消是我们**主动**做的，不是真正的错误，所以安静地返回；其他错误照常抛出。判断时检查 `controller.signal.aborted`，比检查 `err.name === 'AbortError'` 更可靠：用 `abort(原因)` 取消时，拒绝的原因不一定是 `AbortError`。
- `AbortController` 是一次性的：一旦 `abort()`，它的 `signal` 就永远处于已取消状态，所以每次请求都要新建一个。
:::

两种办法常常一起用：取消节省资源，编号检查兜底（有些异步操作不支持取消，或者在取消之前已经拿到了结果）。边输入边搜索时通常还会加上防抖（e01 的练习）：用户停顿一小段时间之后才发请求。防抖减少请求的数量，取消和编号保证显示的结果是对的，三者解决的是不同的问题。

## 超时与组合

`AbortSignal.timeout(毫秒)` 直接创建一个到时间就自动取消的信号，这时拒绝的原因是一个 `name` 为 `'TimeoutError'` 的 `DOMException`，可以和用户主动取消区分开。

需要“用户取消**或者**超时，任何一个发生就取消”时，用 `AbortSignal.any([信号 1, 信号 2])` 把多个信号组合成一个。这两个方法在现代浏览器中都已普遍可用。

:::playground{#timeout fixtures=search}
```ts file=main.ts
try {
  await fetch('/api/slow', { signal: AbortSignal.timeout(50) });
} catch (err) {
  console.log('超时：', err instanceof DOMException ? err.name : err);
}

const user = new AbortController();
const combined = AbortSignal.any([user.signal, AbortSignal.timeout(1000)]);
setTimeout(() => user.abort(), 20);
try {
  await fetch('/api/slow', { signal: combined });
} catch (err) {
  console.log('用户取消：', err instanceof DOMException ? err.name : err);
}
```
- 第 2 行：服务器要 300 毫秒，50 毫秒时超时，原因是 `TimeoutError`。
- 第 8–9 行：组合的信号中，用户在 20 毫秒时取消，原因是 `AbortError`。
- e04 的 `withTimeout` 只能让等待提前结束，请求本身仍在进行；`AbortSignal.timeout` 真正中止了请求。
:::

## 让自己的函数支持取消

自己写的异步函数，也可以接受一个可选的 `signal` 参数：把它传给内部的 `fetch`，在耗时的步骤之间用 `signal.throwIfAborted()` 检查是否已被取消（已取消时它会抛出 `signal.reason`）。这样调用方就能用同一种方式取消一整串操作。

::exercise{#latest-search}

## 编程挑战

::exercise{#timeout-fetch}

::quiz

## 常见错误

- **以为禁用按钮就能避免竞态**：搜索框这类连续输入的场景，请求本来就会重叠。
- **复用已经 abort 过的 AbortController**：它的 signal 永远是已取消的，新的请求会立即失败。每次新建。
- **把取消当作错误显示给用户**：取消是程序主动做的，应该静默忽略。用 `signal.aborted` 判断是不是自己取消的。
- **只取消、不检查**：有些操作在取消前已经完成，结果仍会回来。需要时配合请求编号。
- **超时只用 `Promise.race`**：等待结束了，请求还在进行。用 `AbortSignal.timeout`。

## 下一步

下一课讲浏览器存储：`localStorage` 与序列化，以及为什么从存储中读出的数据也要验证。
