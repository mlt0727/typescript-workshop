---
version: 1
mode: ts
estimatedMinutes: 40
review: ai-draft
problem: 处理数组时，大多数循环都在做几件固定的事：把每个元素变成另一个值、挑出满足条件的元素、找到第一个符合的元素、把所有元素汇总成一个值。JavaScript 为它们提供了 map、filter、find、reduce 等方法。用对了，代码短而清楚；用错了，会遇到回调参数错位、find 返回 undefined、reduce 在空数组上抛异常这类问题。
objectives:
  - 用 map 转换、filter 筛选、find/findIndex 查找、some/every 判断，知道它们都不修改原数组
  - 知道回调会收到 (元素, 下标, 数组) 三个参数，避免 map(Number.parseInt) 这类错误
  - 用 reduce 汇总，始终提供初始值
  - 理解 find 返回 T | undefined，以及 filter 如何收窄类型
references:
  - title: Array.prototype.map() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map
    checked: 2026-10-20
  - title: Array.prototype.filter() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter
    checked: 2026-10-20
  - title: Array.prototype.find() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find
    checked: 2026-10-20
  - title: Array.prototype.reduce() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce
    checked: 2026-10-20
  - title: TypeScript 5.5 Release Notes（Inferred Type Predicates）
    url: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-5.html
    checked: 2026-10-20
---

## map 与 filter

- `arr.map(回调)`：对每个元素调用回调，用返回值组成**新数组**，长度不变。相当于 Python 的 `[f(x) for x in arr]`。
- `arr.filter(回调)`：保留回调返回 truthy 的元素，组成**新数组**。相当于 `[x for x in arr if cond(x)]`。

它们都**不修改原数组**。和 Java 的 Stream 不同，它们立即返回数组，不需要 `collect`；和 Python 3 的 `map()` 也不同，结果不是惰性的迭代器。

回调实际会收到三个参数：`(元素, 下标, 整个数组)`，用不到的可以不写。

:::playground{#map-filter}
```ts file=main.ts
const prices = [120, 45, 80, 300];

const discounted = prices.map((p) => Math.round(p * 0.8));
const cheap = prices.filter((p) => p < 100);
console.log(discounted, cheap, prices);

const labels = prices.map((p, i) => `${i + 1}. ¥${p}`);
console.log(labels);
```
- 第 5 行：`prices` 没有变。
- 第 7 行：回调用到了第二个参数下标 `i`。
- 回调的参数不需要写类型：TypeScript 从数组的类型推断出 `p` 是 `number`（a13 的上下文类型）。
:::

## 回调会收到不止一个参数

直接把一个现成的函数传给 `map` 时要小心：`map` 会把**下标**作为第二个参数传给它。`Number.parseInt` 的第二个参数恰好是进制，于是：

:::playground{#map-parse-int}
```ts file=main.ts
const texts = ['1', '2', '3'];

console.log(texts.map(Number.parseInt));
console.log(texts.map((s) => Number.parseInt(s, 10)));
console.log(texts.map(Number));
```
- 第 3 行输出 `[ 1, NaN, NaN ]`：实际调用的是 `parseInt('1', 0)`、`parseInt('2', 1)`、`parseInt('3', 2)`。进制 1 不合法，二进制里也没有 `3`。TypeScript 不会报错，因为多出来的参数类型恰好兼容。
- 第 4 行：写一个箭头函数，明确地只传需要的参数。这是最稳妥的习惯。
- 第 5 行：`Number` 只用第一个参数，所以直接传入没问题——但要确认这一点，不如统一写箭头函数。
:::

## find、findIndex、some、every

- `find`：返回**第一个**满足条件的元素，找不到时返回 `undefined`。类型是 `T | undefined`，使用前要检查。
- `findIndex`：返回第一个满足条件的下标，找不到时返回 `-1`。
- `some`：是否**至少有一个**满足；`every`：是否**全部**满足。它们找到答案就会停止遍历。

:::playground{#find}
```ts file=main.ts
const users = [
  { name: 'Ada', age: 36 },
  { name: 'Grace', age: 85 },
  { name: 'Linus', age: 21 },
];

const grace = users.find((u) => u.name === 'Grace');
console.log(grace?.age);
console.log(users.find((u) => u.age > 100));

console.log(users.findIndex((u) => u.name === 'Linus'));
console.log(users.some((u) => u.age < 25), users.every((u) => u.age >= 18));
```
- 把鼠标停在 `grace` 上：类型是 `{ name: string; age: number; } | undefined`。所以第 8 行用了 a08 的 `?.`。
- 第 9 行：找不到时得到 `undefined`。
:::

## reduce：把数组汇总成一个值

`arr.reduce((累计值, 元素) => 新的累计值, 初始值)`：从初始值开始，依次用每个元素更新累计值，最后返回累计值。

**始终提供初始值**。不提供时，`reduce` 会拿第一个元素当初始值，空数组时则直接抛出 `TypeError`。

:::playground{#reduce run=error}
```ts file=main.ts
const scores = [80, 92, 75];
const total = scores.reduce((sum, s) => sum + s, 0);
console.log(total, total / scores.length);

const highest = scores.reduce((max, s) => (s > max ? s : max), -Infinity);
console.log(highest);

const empty: number[] = [];
console.log(empty.reduce((sum, s) => sum + s, 0));
console.log(empty.reduce((sum, s) => sum + s));
```
- 第 2 行：`sum` 从 `0` 开始，依次加上每个分数。
- 第 9 行：有初始值，空数组得到 `0`。
- 第 10 行：没有初始值，空数组抛出 `TypeError`。TypeScript 不会提醒你。
- `reduce` 很灵活，但累计逻辑一复杂就不好读。汇总成对象、分组之类的任务，用 `for...of` 循环或 a18 的 `Map` 往往更清楚。
:::

## 链式调用与 filter 收窄

这些方法都返回新数组，所以可以连起来写。TypeScript 5.5 起，`filter` 的回调如果明显是在排除某种类型（例如 `x !== null`），返回的数组类型也会随之收窄：

:::playground{#chaining}
```ts file=main.ts
const orders = [
  { id: 'A1', amount: 30, paid: true },
  { id: 'A2', amount: 50, paid: false },
  { id: 'A3', amount: 20, paid: true },
];

const paidTotal = orders
  .filter((o) => o.paid)
  .map((o) => o.amount)
  .reduce((sum, a) => sum + a, 0);
console.log(paidTotal);

const inputs = ['3', '', '10'];
const parsed = inputs.map((s) => (s === '' ? null : Number(s)));
const present = parsed.filter((n) => n !== null);
console.log(parsed, present);
```
- 第 7–10 行：先筛选已付款的订单，再取出金额，最后求和，得到 `50`。每一步都返回新数组，原来的 `orders` 不变。
- 把鼠标停在 `parsed` 和 `present` 上：分别是 `(number | null)[]` 和 `number[]`。TypeScript 从回调 `n !== null` 推断出了类型守卫（B 阶段会讲）。
- 需要“对每个元素做点事、不需要结果”时，用 `for...of` 或 `forEach`，不要用 `map`。
:::

::exercise{#order-report}

## 编程挑战

::exercise{#exam-summary}

::quiz

## 常见错误

- **把现成函数直接传给 `map`**：`map(Number.parseInt)` 会把下标当进制。写成箭头函数。
- **箭头函数用了花括号却忘了 `return`**：`map((x) => { x * 2 })` 得到全是 `undefined` 的数组。
- **`reduce` 不写初始值**：空数组时抛出 `TypeError`。
- **忘了 `find` 可能返回 `undefined`**：使用前检查。
- **用 `filter(...)[0]` 代替 `find`**：会遍历整个数组，而且同样可能得到 `undefined`。

## 下一步

下一课讲 `sort` 等**会修改原数组**的方法，以及 ES2023 新增的 `toSorted` 等不修改原数组的版本。
