---
version: 1
mode: ts
estimatedMinutes: 40
review: ai-draft
problem: then 链能用，但步骤一多、再加上条件分支和错误处理，就很难读了。async/await 让你用看起来像同步代码的写法使用 Promise：一行一行往下写，用普通的 try/catch 处理错误。但它底下仍然是 Promise 和事件循环：async 函数总是返回 Promise，await 只暂停当前函数而不是整个程序，忘了 await 或者把能并行的操作写成了串行，都是常见的错误。
objectives:
  - 用 async 声明返回 Promise 的函数，用 await 等待 Promise 的结果
  - 用 try/catch/finally 处理异步错误，理解错误如何在 async 函数之间传递
  - 区分串行等待和并行等待，知道什么时候应该先启动再等待
  - 识别忘了 await、在 forEach 中使用 async 回调等常见错误
references:
  - title: async function — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function
    checked: 2026-10-20
  - title: await — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await
    checked: 2026-10-20
  - title: Using promises（async and await）— MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises
    checked: 2026-10-20
---

## async 与 await

在函数前加上 `async`：

- 它**总是返回 Promise**：`return 值` 让 Promise 兑现为这个值，`throw` 让 Promise 被拒绝。返回类型要写成 `Promise<T>`（写成 `T` 会报 TS1064）。
- 函数内部可以使用 `await 表达式`：暂停**这个函数**，等 Promise 完成后，得到兑现的值（或者在这里抛出拒绝的原因）。

暂停期间，事件循环照常运行其他代码。`await` 之后的代码相当于放进了 `then` 回调里。

模块的顶层也可以直接使用 `await`（本平台的代码都是模块）。

:::playground{#basics}
```ts file=main.ts
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadUser(id: number): Promise<{ id: number; name: string }> {
  await wait(50);
  return { id: id, name: id === 1 ? 'Ada' : 'Grace' };
}

async function greet(id: number): Promise<string> {
  const user = await loadUser(id);
  return `你好，${user.name}`;
}

console.log('开始');
greet(1).then((text) => console.log(text));
const second = await greet(2);
console.log(second);
console.log('结束');
```
- 第 11 行：`await loadUser(id)` 得到的是 `{ id, name }` 对象本身，不是 Promise。
- 第 16 行：`greet` 返回 Promise，仍然可以用 `then`。
- 第 17 行：模块顶层的 `await`。“开始”最先输出；`greet(1)` 和 `greet(2)` 都要等 50 毫秒。
:::

## 用 try/catch 处理异步错误

`await` 一个被拒绝的 Promise，会在那一行**抛出**拒绝的原因，所以可以用 a20 学过的 `try/catch/finally` 处理。没有被捕获的错误会让 async 函数返回的 Promise 被拒绝，继续传给它的调用者。

:::playground{#errors}
```ts file=main.ts
async function loadConfig(text: string): Promise<{ port: number }> {
  const data: unknown = JSON.parse(text);
  if (typeof data !== 'object' || data === null || !('port' in data) || typeof data.port !== 'number') {
    throw new Error('配置无效');
  }
  return { port: data.port };
}

async function start(text: string): Promise<string> {
  try {
    const config = await loadConfig(text);
    return `在 ${config.port} 端口启动`;
  } catch (err) {
    return `启动失败：${err instanceof Error ? err.message : String(err)}`;
  } finally {
    console.log('检查完毕：', text);
  }
}

console.log(await start('{ "port": 8080 }'));
console.log(await start('{ "port": "x" }'));
console.log(await start('{'));
```
- 第 4 行的 `throw` 让 `loadConfig` 返回的 Promise 被拒绝；第 11 行的 `await` 把它变成了一个抛出的错误，被第 13 行捕获。
- 第 22 行：`JSON.parse` 同步抛出的 `SyntaxError` 也一样：在 async 函数中，任何抛出的错误都会变成被拒绝的 Promise。
- `catch` 中的 `err` 仍然是 `unknown`（a20）。
:::

## 串行与并行

`await` 会等待，所以连续写两个 `await`，第二个操作要等第一个完成后才**开始**。如果两个操作互不依赖，这就白白浪费了时间。应该**先启动**它们（调用函数，拿到 Promise），**再等待**。同时等待多个 Promise 最常用 `Promise.all`（下一课详讲）。

:::playground{#parallel}
```ts file=main.ts
function slowValue(value: number, ms: number): Promise<number> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

let start = Date.now();
const a = await slowValue(1, 200);
const b = await slowValue(2, 200);
console.log('串行：', a + b, '耗时约', Math.round((Date.now() - start) / 100) * 100, '毫秒');

start = Date.now();
const [c, d] = await Promise.all([slowValue(1, 200), slowValue(2, 200)]);
console.log('并行：', c + d, '耗时约', Math.round((Date.now() - start) / 100) * 100, '毫秒');
```
- 第 6–7 行：第二个请求等第一个完成后才开始，总共约 400 毫秒。
- 第 11 行：两个操作同时开始，`Promise.all` 等它们都完成，约 200 毫秒。
- 只有当后一步**需要**前一步的结果时（例如先查用户、再用用户 ID 查订单），才应该串行。
:::

## 常见的 await 错误

TypeScript 能发现一部分“忘了 `await`”的错误：拿到的是 `Promise<User>` 而不是 `User`，读取属性时会报错；把 `Promise<boolean>` 当作条件，会报“这个条件永远为真”。

另一个常见错误是在 `forEach` 中使用 async 回调：`forEach` 不会等待回调返回的 Promise，循环后面的代码会立刻执行。需要按顺序等待时用 `for...of`；需要并行时用 `map` 加 `Promise.all`。

:::playground{#mistakes expect="2339@main.ts:10, 2801@main.ts:11"}
```ts file=main.ts
type User = { name: string };
async function fetchUser(): Promise<User> {
  return { name: 'Ada' };
}
async function isAdmin(): Promise<boolean> {
  return false;
}

const user = fetchUser();
console.log(user.name);
if (isAdmin()) {
  console.log('这一行总会执行');
}

const done: string[] = [];
['a', 'b'].forEach(async (item) => {
  await new Promise((resolve) => setTimeout(resolve, 10));
  done.push(item);
});
console.log('forEach 之后：', done);

for (const item of ['c', 'd']) {
  await new Promise((resolve) => setTimeout(resolve, 10));
  done.push(item);
}
console.log('for...of 之后：', done);
```
- 第 10 行：`user` 是 `Promise<User>`，没有 `name`，报 TS2339。改成 `const user = await fetchUser();`。
- 第 11 行：Promise 对象总是 truthy，报 TS2801。
- 第 20 行输出空数组：`forEach` 没有等待。第 26 行输出全部四项：`for...of` 中的 `await` 让循环按顺序等待，而前面 `forEach` 里的两个回调也已经在这期间完成了。
:::

::exercise{#load-profile}

## 编程挑战

::exercise{#map-limit}

::quiz

## 常见错误

- **忘了 `await`**：拿到的是 Promise 而不是结果。
- **能并行的操作写成串行**：先启动，再一起等待。
- **在 `forEach` 中使用 async 回调**：用 `for...of` 或 `Promise.all`。
- **调用 async 函数却不处理它的结果**：如果它被拒绝，就成了“未处理的拒绝”。要么 `await`，要么 `.catch`。

## 下一步

下一课讲 `Promise.all`、`allSettled`、`race` 和 `any`：同时等待多个异步操作的四种方式。
