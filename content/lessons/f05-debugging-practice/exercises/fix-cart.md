---
kind: task
title: 根据错误报告修复购物车
---
`cart.ts` 是购物车页面用到的几个函数，用户报告了四个问题：

1. 点了“按价格排序”之后，购物车原来的商品顺序也变了；而且排序的结果是从便宜到贵，应该是从贵到便宜；
2. 购物车里只有一件商品时，合计显示 `¥0`；
3. 第 1 页显示的是第 2 页的商品；商品数正好是每页数量的整数倍时，最后多出一个空页；
4. 12.30 元显示成了 `¥12.3`；退款的 -5 元显示成了 `¥-5`。

找到并修复这些 bug，修复后的规格：

- **`sortByPrice(items)`**：返回新数组，单价从高到低，单价相同时保持原来的顺序。把参数的类型改成 `readonly Item[]`，让类型检查挡住“修改传入的数组”；
- **`totalCents(items)`**：所有商品的 `单价 × 数量` 之和；
- **`pageCount(totalItems, size)`**：页数，没有商品时是 1 页；**`page(items, pageNumber, size)`**：页码从 1 开始，超出范围时返回空数组，页码不是大于等于 1 的整数时抛出 `RangeError`；
- **`formatYuan(cents)`**：`¥` 加上固定两位小数的金额；负数的负号写在 `¥` 前面（`-¥5.00`）。

`main.ts` 中已经写好了这四个问题的复现，先运行看看。

:::files{role=starter}
```ts file=cart.ts
export type Item = { name: string; priceCents: number; quantity: number };

/** 按单价从高到低排序 */
export function sortByPrice(items: Item[]): Item[] {
  return items.sort((a, b) => a.priceCents - b.priceCents);
}

/** 合计（分） */
export function totalCents(items: readonly Item[]): number {
  let total = 0;
  for (let i = 1; i < items.length; i++) {
    const item = items[i];
    if (item) total += item.priceCents * item.quantity;
  }
  return total;
}

/** 一共有几页 */
export function pageCount(totalItems: number, size: number): number {
  return Math.floor(totalItems / size) + 1;
}

/** 第 pageNumber 页的商品（页码从 1 开始） */
export function page<T>(items: readonly T[], pageNumber: number, size: number): T[] {
  const start = pageNumber * size;
  return items.slice(start, start + size);
}

/** 把分格式化成元 */
export function formatYuan(cents: number): string {
  return `¥${cents / 100}`;
}
```
```ts file=main.ts
import { formatYuan, page, pageCount, sortByPrice, totalCents } from './cart';

const cart = [
  { name: '笔记本', priceCents: 1230, quantity: 1 },
  { name: '钢笔', priceCents: 4500, quantity: 2 },
  { name: '橡皮', priceCents: 150, quantity: 3 },
];

// 报告 1
console.log(sortByPrice(cart).map((item) => item.name), cart.map((item) => item.name));
// 报告 2
console.log(formatYuan(totalCents(cart.slice(0, 1))));
// 报告 3
console.log(page(cart, 1, 2).map((item) => item.name), pageCount(4, 2));
// 报告 4
console.log(formatYuan(1230), formatYuan(-500));
```
:::

:::files{role=solution}
```ts file=cart.ts
export type Item = { name: string; priceCents: number; quantity: number };

/** 按单价从高到低排序 */
export function sortByPrice(items: readonly Item[]): Item[] {
  // 报告 1：sort 会修改原数组；toSorted 返回新数组。b - a 是从高到低。排序是稳定的，单价相同时保持原来的顺序
  return items.toSorted((a, b) => b.priceCents - a.priceCents);
}

/** 合计（分） */
export function totalCents(items: readonly Item[]): number {
  // 报告 2：循环从 1 开始，漏掉了第一件商品
  let total = 0;
  for (const item of items) total += item.priceCents * item.quantity;
  return total;
}

/** 一共有几页 */
export function pageCount(totalItems: number, size: number): number {
  // 报告 3：正好整除时 floor + 1 多出一个空页；没有商品时仍然显示 1 页
  return Math.max(1, Math.ceil(totalItems / size));
}

/** 第 pageNumber 页的商品（页码从 1 开始） */
export function page<T>(items: readonly T[], pageNumber: number, size: number): T[] {
  if (!Number.isInteger(pageNumber) || pageNumber < 1) throw new RangeError(`页码从 1 开始：${pageNumber}`);
  // 报告 3：页码从 1 开始，第 1 页从下标 0 开始
  const start = (pageNumber - 1) * size;
  return items.slice(start, start + size);
}

/** 把分格式化成元 */
export function formatYuan(cents: number): string {
  // 报告 4：固定两位小数；负号放在 ¥ 前面
  const sign = cents < 0 ? '-' : '';
  return `${sign}¥${(Math.abs(cents) / 100).toFixed(2)}`;
}
```
```ts file=main.ts
import { formatYuan, page, pageCount, sortByPrice, totalCents } from './cart';

const cart = [
  { name: '笔记本', priceCents: 1230, quantity: 1 },
  { name: '钢笔', priceCents: 4500, quantity: 2 },
  { name: '橡皮', priceCents: 150, quantity: 3 },
];

// 报告 1
console.log(sortByPrice(cart).map((item) => item.name), cart.map((item) => item.name));
// 报告 2
console.log(formatYuan(totalCents(cart.slice(0, 1))));
// 报告 3
console.log(page(cart, 1, 2).map((item) => item.name), pageCount(4, 2));
// 报告 4
console.log(formatYuan(1230), formatYuan(-500));
```
:::

:::files{role=tests}
```ts file=cart.test.ts
import { describe, expect, test } from 'vitest';
import { formatYuan, page, pageCount, sortByPrice, totalCents, type Item } from './cart';

const cart: Item[] = [
  { name: '笔记本', priceCents: 1230, quantity: 1 },
  { name: '钢笔', priceCents: 4500, quantity: 2 },
  { name: '尺子', priceCents: 1230, quantity: 1 },
  { name: '橡皮', priceCents: 150, quantity: 3 },
];

describe('报告 1：sortByPrice', () => {
  test('从贵到便宜；单价相同时保持原来的顺序', () => {
    expect(sortByPrice(cart).map((item) => item.name)).toEqual(['钢笔', '笔记本', '尺子', '橡皮']);
  });

  test('不修改传入的数组', () => {
    const before = cart.map((item) => item.name);
    sortByPrice(cart);
    expect(cart.map((item) => item.name)).toEqual(before);
  });
});

describe('报告 2：totalCents', () => {
  test('一件、多件、没有', () => {
    expect(totalCents(cart.slice(0, 1))).toBe(1230);
    expect(totalCents(cart)).toBe(1230 + 9000 + 1230 + 450);
    expect(totalCents([])).toBe(0);
  });
});

describe('报告 3：分页', () => {
  test('pageCount：正好整除时没有多余的空页，没有商品时是 1 页', () => {
    expect(pageCount(4, 2)).toBe(2);
    expect(pageCount(5, 2)).toBe(3);
    expect(pageCount(1, 10)).toBe(1);
    expect(pageCount(0, 10)).toBe(1);
  });

  test('page：页码从 1 开始', () => {
    expect(page(cart, 1, 3).map((item) => item.name)).toEqual(['笔记本', '钢笔', '尺子']);
    expect(page(cart, 2, 3).map((item) => item.name)).toEqual(['橡皮']);
    expect(page(cart, 3, 3)).toEqual([]);
    expect(page([], 1, 3)).toEqual([]);
  });

  test('page：页码不是从 1 开始的整数时抛出 RangeError', () => {
    expect(() => page(cart, 0, 3)).toThrow(RangeError);
    expect(() => page(cart, -1, 3)).toThrow(RangeError);
    expect(() => page(cart, 1.5, 3)).toThrow(RangeError);
  });
});

describe('报告 4：formatYuan', () => {
  test('固定两位小数', () => {
    expect(formatYuan(1230)).toBe('¥12.30');
    expect(formatYuan(1200)).toBe('¥12.00');
    expect(formatYuan(5)).toBe('¥0.05');
    expect(formatYuan(0)).toBe('¥0.00');
    expect(formatYuan(123456)).toBe('¥1234.56');
  });

  test('负数：负号在 ¥ 前面', () => {
    expect(formatYuan(-500)).toBe('-¥5.00');
    expect(formatYuan(-1)).toBe('-¥0.01');
  });
});
```
```ts file=cart.test-d.ts
import { expectTypeOf } from 'vitest';
import { sortByPrice, type Item } from './cart';

// 参数是只读的：在函数中调用 sort、push 会报错，这类 bug 在编译期就能被发现
expectTypeOf(sortByPrice).parameter(0).toEqualTypeOf<readonly Item[]>();
```
:::

:::hint{level=1}
一次只看一个报告。报告 1 的两个问题（顺序变了、方向反了）都在一行里：`sort` 修改原数组，比较函数 `a - b` 是从小到大。报告 2：循环从哪里开始？报告 3：页码从 1 开始，第 1 页的起始下标是多少？
:::

:::hint{level=2}
`toSorted`（ES2023）返回排好序的新数组。页数用 `Math.ceil(总数 / 每页)`，再用 `Math.max(1, …)` 保证至少 1 页。金额先取绝对值再 `toFixed(2)`，负号单独加在前面。把参数改成 `readonly Item[]` 之后，如果还写着 `items.sort(…)`，编译器会报错（只读数组没有 `sort`）。
:::

:::explanation
四个 bug 分别属于正文表格中的几种类型：

- **报告 1**：`sort` 是原地排序（a17），修改了调用方的数组，这是“意外的修改”；比较函数的方向写反了。把参数类型改成 `readonly Item[]` 之后，`items.sort` 直接是编译错误，这类 bug 以后不会再出现：用类型把规则写下来，比记住规则可靠；
- **报告 2、3**：差一错误。循环从 1 开始漏掉了第一项；页码从 1 开始，起始下标却按从 0 开始计算；`Math.floor(n / size) + 1` 在正好整除时多出一页。边界上的测试（空数组、一项、正好整除）能发现它们；
- **报告 4**：数字格式。`1230 / 100` 是 `12.3`，模板字符串不会补零。金额用整数的“分”保存和计算，只在显示时转换，可以避免 `0.1 + 0.2` 这样的浮点误差；`toFixed(2)` 对“分除以 100”得到的数是安全的。

注意报告 1 和报告 3 都是“两个问题挤在一个报告中”，真实的错误报告常常如此：先把报告拆成一个个能单独验证的现象。

`page` 中新增的 `RangeError`：页码 0 在修复前恰好能返回第 1 页的商品，修复后会悄悄地返回第 0 页（`slice(-3, 0)` 是空数组）。对不合理的输入直接报错，问题会出现在调用的地方，而不是在页面上显示一个莫名其妙的空列表。
:::

:::variant{kind=alt name=reduce-and-integers}
```ts file=cart.ts
export type Item = { name: string; priceCents: number; quantity: number };

export function sortByPrice(items: readonly Item[]): Item[] {
  return [...items].sort((a, b) => b.priceCents - a.priceCents);
}

export function totalCents(items: readonly Item[]): number {
  return items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
}

export function pageCount(totalItems: number, size: number): number {
  if (totalItems === 0) return 1;
  return Math.floor((totalItems + size - 1) / size);
}

export function page<T>(items: readonly T[], pageNumber: number, size: number): T[] {
  if (pageNumber < 1 || pageNumber % 1 !== 0) throw new RangeError('无效的页码');
  return items.slice((pageNumber - 1) * size, pageNumber * size);
}

export function formatYuan(cents: number): string {
  const abs = Math.abs(cents);
  const yuan = Math.trunc(abs / 100);
  const fen = String(abs % 100).padStart(2, '0');
  return `${cents < 0 ? '-' : ''}¥${yuan}.${fen}`;
}
```
:::

:::variant{kind=wrong name=mutating-sort fails=types reason="参数仍然是可以修改的 Item[]，sort 修改了传入的数组"}
```ts file=cart.ts
export type Item = { name: string; priceCents: number; quantity: number };

/** 按单价从高到低排序 */
export function sortByPrice(items: Item[]): Item[] {
  return items.sort((a, b) => b.priceCents - a.priceCents);
}

/** 合计（分） */
export function totalCents(items: readonly Item[]): number {
  // 报告 2：循环从 1 开始，漏掉了第一件商品
  let total = 0;
  for (const item of items) total += item.priceCents * item.quantity;
  return total;
}

/** 一共有几页 */
export function pageCount(totalItems: number, size: number): number {
  // 报告 3：正好整除时 floor + 1 多出一个空页；没有商品时仍然显示 1 页
  return Math.max(1, Math.ceil(totalItems / size));
}

/** 第 pageNumber 页的商品（页码从 1 开始） */
export function page<T>(items: readonly T[], pageNumber: number, size: number): T[] {
  if (!Number.isInteger(pageNumber) || pageNumber < 1) throw new RangeError(`页码从 1 开始：${pageNumber}`);
  // 报告 3：页码从 1 开始，第 1 页从下标 0 开始
  const start = (pageNumber - 1) * size;
  return items.slice(start, start + size);
}

/** 把分格式化成元 */
export function formatYuan(cents: number): string {
  // 报告 4：固定两位小数；负号放在 ¥ 前面
  const sign = cents < 0 ? '-' : '';
  return `${sign}¥${(Math.abs(cents) / 100).toFixed(2)}`;
}
```
:::

:::variant{kind=wrong name=still-ascending fails=tests reason="不再修改原数组了，但仍然是从便宜到贵"}
```ts file=cart.ts
export type Item = { name: string; priceCents: number; quantity: number };

/** 按单价从高到低排序 */
export function sortByPrice(items: readonly Item[]): Item[] {
  // 报告 1：sort 会修改原数组；toSorted 返回新数组。b - a 是从高到低。排序是稳定的，单价相同时保持原来的顺序
  return items.toSorted((a, b) => a.priceCents - b.priceCents);
}

/** 合计（分） */
export function totalCents(items: readonly Item[]): number {
  // 报告 2：循环从 1 开始，漏掉了第一件商品
  let total = 0;
  for (const item of items) total += item.priceCents * item.quantity;
  return total;
}

/** 一共有几页 */
export function pageCount(totalItems: number, size: number): number {
  // 报告 3：正好整除时 floor + 1 多出一个空页；没有商品时仍然显示 1 页
  return Math.max(1, Math.ceil(totalItems / size));
}

/** 第 pageNumber 页的商品（页码从 1 开始） */
export function page<T>(items: readonly T[], pageNumber: number, size: number): T[] {
  if (!Number.isInteger(pageNumber) || pageNumber < 1) throw new RangeError(`页码从 1 开始：${pageNumber}`);
  // 报告 3：页码从 1 开始，第 1 页从下标 0 开始
  const start = (pageNumber - 1) * size;
  return items.slice(start, start + size);
}

/** 把分格式化成元 */
export function formatYuan(cents: number): string {
  // 报告 4：固定两位小数；负号放在 ¥ 前面
  const sign = cents < 0 ? '-' : '';
  return `${sign}¥${(Math.abs(cents) / 100).toFixed(2)}`;
}
```
:::

:::variant{kind=wrong name=ceil-only fails=tests reason="改成了 Math.ceil，但没有商品时得到 0 页"}
```ts file=cart.ts
export type Item = { name: string; priceCents: number; quantity: number };

/** 按单价从高到低排序 */
export function sortByPrice(items: readonly Item[]): Item[] {
  // 报告 1：sort 会修改原数组；toSorted 返回新数组。b - a 是从高到低。排序是稳定的，单价相同时保持原来的顺序
  return items.toSorted((a, b) => b.priceCents - a.priceCents);
}

/** 合计（分） */
export function totalCents(items: readonly Item[]): number {
  // 报告 2：循环从 1 开始，漏掉了第一件商品
  let total = 0;
  for (const item of items) total += item.priceCents * item.quantity;
  return total;
}

/** 一共有几页 */
export function pageCount(totalItems: number, size: number): number {
  // 报告 3：正好整除时 floor + 1 多出一个空页；没有商品时仍然显示 1 页
  return Math.ceil(totalItems / size);
}

/** 第 pageNumber 页的商品（页码从 1 开始） */
export function page<T>(items: readonly T[], pageNumber: number, size: number): T[] {
  if (!Number.isInteger(pageNumber) || pageNumber < 1) throw new RangeError(`页码从 1 开始：${pageNumber}`);
  // 报告 3：页码从 1 开始，第 1 页从下标 0 开始
  const start = (pageNumber - 1) * size;
  return items.slice(start, start + size);
}

/** 把分格式化成元 */
export function formatYuan(cents: number): string {
  // 报告 4：固定两位小数；负号放在 ¥ 前面
  const sign = cents < 0 ? '-' : '';
  return `${sign}¥${(Math.abs(cents) / 100).toFixed(2)}`;
}
```
:::

:::variant{kind=wrong name=fixed-with-sign fails=tests reason="用 toFixed 修好了小数，但负数显示成了 ¥-5.00"}
```ts file=cart.ts
export type Item = { name: string; priceCents: number; quantity: number };

/** 按单价从高到低排序 */
export function sortByPrice(items: readonly Item[]): Item[] {
  // 报告 1：sort 会修改原数组；toSorted 返回新数组。b - a 是从高到低。排序是稳定的，单价相同时保持原来的顺序
  return items.toSorted((a, b) => b.priceCents - a.priceCents);
}

/** 合计（分） */
export function totalCents(items: readonly Item[]): number {
  // 报告 2：循环从 1 开始，漏掉了第一件商品
  let total = 0;
  for (const item of items) total += item.priceCents * item.quantity;
  return total;
}

/** 一共有几页 */
export function pageCount(totalItems: number, size: number): number {
  // 报告 3：正好整除时 floor + 1 多出一个空页；没有商品时仍然显示 1 页
  return Math.max(1, Math.ceil(totalItems / size));
}

/** 第 pageNumber 页的商品（页码从 1 开始） */
export function page<T>(items: readonly T[], pageNumber: number, size: number): T[] {
  if (!Number.isInteger(pageNumber) || pageNumber < 1) throw new RangeError(`页码从 1 开始：${pageNumber}`);
  // 报告 3：页码从 1 开始，第 1 页从下标 0 开始
  const start = (pageNumber - 1) * size;
  return items.slice(start, start + size);
}

/** 把分格式化成元 */
export function formatYuan(cents: number): string {
  // 报告 4：固定两位小数；负号放在 ¥ 前面
  return `¥${(cents / 100).toFixed(2)}`;
}
```
:::

:::variant{kind=wrong name=no-page-check fails=tests reason="修好了起始下标，但页码 0 或负数时悄悄地返回了错误的商品"}
```ts file=cart.ts
export type Item = { name: string; priceCents: number; quantity: number };

/** 按单价从高到低排序 */
export function sortByPrice(items: readonly Item[]): Item[] {
  // 报告 1：sort 会修改原数组；toSorted 返回新数组。b - a 是从高到低。排序是稳定的，单价相同时保持原来的顺序
  return items.toSorted((a, b) => b.priceCents - a.priceCents);
}

/** 合计（分） */
export function totalCents(items: readonly Item[]): number {
  // 报告 2：循环从 1 开始，漏掉了第一件商品
  let total = 0;
  for (const item of items) total += item.priceCents * item.quantity;
  return total;
}

/** 一共有几页 */
export function pageCount(totalItems: number, size: number): number {
  // 报告 3：正好整除时 floor + 1 多出一个空页；没有商品时仍然显示 1 页
  return Math.max(1, Math.ceil(totalItems / size));
}

/** 第 pageNumber 页的商品（页码从 1 开始） */
export function page<T>(items: readonly T[], pageNumber: number, size: number): T[] {
  // 报告 3：页码从 1 开始，第 1 页从下标 0 开始
  const start = (pageNumber - 1) * size;
  return items.slice(start, start + size);
}

/** 把分格式化成元 */
export function formatYuan(cents: number): string {
  // 报告 4：固定两位小数；负号放在 ¥ 前面
  const sign = cents < 0 ? '-' : '';
  return `${sign}¥${(Math.abs(cents) / 100).toFixed(2)}`;
}
```
:::
