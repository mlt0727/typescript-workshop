---
version: 1
mode: ts
estimatedMinutes: 40
review: ai-draft
problem: 真实程序经常要同时处理多个异步操作：并行请求几份互不依赖的数据，批量检查一组链接，给请求加上超时，从几个镜像中选最快的一个。Promise 提供了四个组合方法：all、allSettled、race 和 any。它们的区别在于“什么时候算完成”和“失败了怎么办”，选错了就会出现一个请求失败导致整页空白，或者错误被悄悄吞掉之类的问题。
objectives:
  - 用 Promise.all 并行等待多个操作，理解它的“一个失败就整体失败”
  - 用 Promise.allSettled 收集每个操作的结果，并用 status 收窄结果类型
  - 用 Promise.race 实现超时，知道落后的操作不会被取消
  - 用 Promise.any 取第一个成功的结果，处理 AggregateError
references:
  - title: Promise.all() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all
    checked: 2026-10-20
  - title: Promise.allSettled() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled
    checked: 2026-10-20
  - title: Promise.race() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/race
    checked: 2026-10-20
  - title: Promise.any() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/any
    checked: 2026-10-20
  - title: AggregateError — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AggregateError
    checked: 2026-10-20
---

## Promise.all：全部成功

`Promise.all(数组)` 等待数组中的所有 Promise：

- 全部兑现时，它兑现为**按原顺序排列**的结果数组，与谁先完成无关；
- 任何一个被拒绝时，它**立刻**以这个原因被拒绝，不再等其他的。

适合“缺一不可”的情况，例如页面同时需要用户信息和设置。上一课已经用它把串行等待改成了并行。

:::playground{#all}
```ts file=main.ts
function after<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function step(name: string, ms: number, fail = false): Promise<string> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log(`  ${name} 结束`);
      if (fail) reject(new Error(`${name} 失败`));
      else resolve(name);
    }, ms);
  });
}

const [user, count] = await Promise.all([after({ name: 'Ada' }, 30), after(42, 10)]);
console.log(user.name, count);

try {
  await Promise.all([step('A', 50), step('B', 10, true), step('C', 20)]);
} catch (err) {
  console.log('Promise.all 被拒绝：', err instanceof Error ? err.message : err);
}
await after(null, 100);
console.log('全部结束');
```
- 第 15 行：把鼠标停在 `user` 和 `count` 上，分别是 `{ name: string; }` 和 `number`。传入数组字面量时，TypeScript 把结果推断为元组，每个位置保留自己的类型。`42` 先完成，但仍在第二个位置。
- 第 19 行：B 在 10 毫秒时失败，`Promise.all` 立刻以 B 的错误被拒绝，不等 A 和 C。
- 看输出：A 和 C 在拒绝之后仍然“结束”了。`Promise.all` 不会取消其他操作，只是不再使用它们的结果。
:::

## Promise.allSettled：每一个的结果

`Promise.allSettled(数组)` **从不被拒绝**：它等所有操作都完成（无论成败），兑现为一个结果数组。每个结果是一个对象：

- 成功：`{ status: 'fulfilled', value: 值 }`；
- 失败：`{ status: 'rejected', reason: 原因 }`。

这正是 b09 的可辨识联合：先检查 `status`，才能读取 `value` 或 `reason`。适合“批量操作，部分失败也要继续，并且要知道哪些失败了”的情况。

:::playground{#all-settled expect="2339@main.ts:20"}
```ts file=main.ts
function after<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function failAfter(message: string, ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}

const results = await Promise.allSettled([after('A', 30), failAfter('B 失败', 10), after('C', 20)]);

for (const result of results) {
  if (result.status === 'fulfilled') {
    console.log('成功：', result.value);
  } else {
    const reason: unknown = result.reason;
    console.log('失败：', reason instanceof Error ? reason.message : String(reason));
  }
}

console.log(results[0].value);
```
- 第 9 行：B 最先失败，但 `allSettled` 照样等 A 和 C 完成；结果的顺序仍然是 A、B、C。
- 第 12 行：检查 `status` 之后，TypeScript 就知道这个结果有 `value`。
- 第 15 行：标准库把 `reason` 的类型写成了 `any`（历史原因）。先把它赋给 `unknown` 类型的变量，再像 a20 处理 `catch` 的参数那样检查。
- 第 20 行：没有检查 `status` 就读取 `value`，报 TS2339：失败的结果没有 `value`。
:::

## Promise.race：第一个完成的

`Promise.race(数组)` 采用**第一个完成**的结果，不管它是兑现还是拒绝。最常见的用途是超时：让真正的操作和一个“到时间就拒绝”的 Promise 赛跑。

:::playground{#race}
```ts file=main.ts
function after<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function rejectAfter(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(`超过 ${ms} 毫秒`)), ms));
}

console.log(await Promise.race([after('快的', 10), after('慢的', 50)]));

try {
  const data = await Promise.race([after('数据', 200), rejectAfter(50)]);
  console.log(data);
} catch (err) {
  console.log('超时：', err instanceof Error ? err.message : err);
}
```
- 第 9 行：“快的”先完成，`race` 兑现为它。
- 第 12 行：`rejectAfter(50)` 先完成，于是 `race` 被拒绝。把鼠标停在 `data` 上，类型是 `string`：`never` 表示不可能的值（b06），它和其他类型组成联合时会消失。
- 落后的操作仍在后台运行：“慢的”和“数据”到时间后照样完成，只是没人使用结果。反过来，如果数据先到，`rejectAfter` 的计时器仍会在 50 毫秒后触发。本课的挑战会处理这个问题。
:::

## Promise.any：第一个成功的

`Promise.any(数组)` 忽略被拒绝的，采用**第一个兑现**的结果。只有全部都被拒绝时，它才被拒绝，原因是一个 `AggregateError`，它的 `errors` 数组包含每一个拒绝原因。适合“几个来源，用最快成功的那个”，例如从多个镜像下载。

:::playground{#any}
```ts file=main.ts
function after<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function failAfter(message: string, ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}

const fastest = await Promise.any([failAfter('镜像 1 不可用', 10), after('镜像 2', 30), after('镜像 3', 50)]);
console.log('any：', fastest);

try {
  await Promise.race([failAfter('镜像 1 不可用', 10), after('镜像 2', 30)]);
} catch (err) {
  console.log('race：', err instanceof Error ? err.message : err);
}

try {
  await Promise.any([failAfter('镜像 1 不可用', 10), failAfter('镜像 2 不可用', 20)]);
} catch (err) {
  if (err instanceof AggregateError) {
    console.log('any：', err.errors.length, '个来源都失败了');
  }
}
```
- 第 9 行：镜像 1 最先完成，但它失败了；`any` 继续等，采用了“镜像 2”。
- 第 13 行：对比 `race`：镜像 1 最先完成，`race` 就被拒绝了。
- 第 19 行：全部被拒绝时，`any` 以 `AggregateError` 拒绝。
:::

## 怎么选

| 方法 | 什么时候兑现 | 什么时候被拒绝 | 典型用途 |
| --- | --- | --- | --- |
| `Promise.all` | 全部兑现，结果按原顺序 | 任何一个被拒绝（立刻） | 缺一不可的并行请求 |
| `Promise.allSettled` | 全部完成后，总是兑现 | 从不 | 批量操作，需要每一个的结果 |
| `Promise.race` | 第一个完成的是兑现 | 第一个完成的是拒绝 | 超时 |
| `Promise.any` | 第一个兑现 | 全部被拒绝（`AggregateError`） | 多个来源，取最快成功的 |

另外两点：

- 四个方法都**不会取消**其他操作。真正取消请求需要 `AbortController`（e08）。
- 空数组：`all` 和 `allSettled` 立刻兑现为 `[]`；`any` 立刻被拒绝；`race` 永远不会完成。

::exercise{#check-links}

## 编程挑战

::exercise{#with-timeout}

::quiz

## 常见错误

- **一个可选的请求失败，用 `Promise.all` 导致整体失败**：给它单独加上 `.catch`，或者改用 `allSettled`。
- **以为 `Promise.all` 被拒绝后其他操作就停了**：它们仍在运行，可能还会产生副作用。
- **没有检查 `status` 就读取 `allSettled` 的 `value`**：TS2339。
- **用 `race` 实现超时，却不清除计时器**：操作早已完成，计时器还留着。

## 下一步

下一课用 `fetch` 发出真实的 HTTP 请求：HTTP 状态码、读取 JSON，以及为什么 `fetch` 在 404 时不会被拒绝。
