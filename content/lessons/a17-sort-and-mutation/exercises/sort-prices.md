---
kind: task
title: 价格从低到高
---
实现 `sortPrices(prices)`：返回按价格**从低到高**排序的新数组。参数是只读数组，不能修改它。

起始代码有两个问题：TypeScript 报错（只读数组没有 `sort`），而且没有写比较函数。

:::files{role=starter}
```ts file=prices.ts
export function sortPrices(prices: readonly number[]): number[] {
  return prices.sort();
}

console.log(sortPrices([100, 25, 9, 1000]));
```
:::

:::files{role=solution}
```ts file=prices.ts
export function sortPrices(prices: readonly number[]): number[] {
  return prices.toSorted((a, b) => a - b);
}

console.log(sortPrices([100, 25, 9, 1000]));
```
:::

:::files{role=tests}
```ts file=prices.test.ts
import { expect, test } from 'vitest';
import { sortPrices } from './prices';

test('按数值从低到高', () => {
  expect(sortPrices([100, 25, 9, 1000])).toEqual([9, 25, 100, 1000]);
});

test('包含相同价格和小数', () => {
  expect(sortPrices([2.5, 10, 2.5, 0.99])).toEqual([0.99, 2.5, 2.5, 10]);
});

test('空数组', () => {
  expect(sortPrices([])).toEqual([]);
});

test('不修改传入的数组', () => {
  const prices = [30, 10, 20];
  const sorted = sortPrices(prices);
  expect(prices).toEqual([30, 10, 20]);
  expect(sorted).not.toBe(prices);
});
```
:::

:::hint{level=1}
只读数组上不能调用会修改数组的 `sort`，但可以调用返回新数组的 `toSorted`。数字排序别忘了比较函数。
:::

:::hint{level=2}
`return prices.toSorted((a, b) => a - b);`
:::

:::explanation
`toSorted` 返回排好序的新数组，不修改原数组，所以能用在只读数组上。比较函数 `(a, b) => a - b`：`a` 小于 `b` 时返回负数，`a` 排在前面，于是得到升序。

不写比较函数时，`toSorted` 和 `sort` 一样按字符串排序，`[100, 25, 9, 1000]` 会变成 `[100, 1000, 25, 9]`。
:::

:::variant{kind=alt name=copy-then-sort}
```ts file=prices.ts
export function sortPrices(prices: readonly number[]): number[] {
  const copy = [...prices];
  copy.sort((a, b) => a - b);
  return copy;
}
```
:::

:::variant{kind=wrong name=no-comparator fails=tests reason="没有比较函数，按字符串排序"}
```ts file=prices.ts
export function sortPrices(prices: readonly number[]): number[] {
  return prices.toSorted();
}
```
:::

:::variant{kind=wrong name=descending fails=tests reason="比较函数写反了，得到降序"}
```ts file=prices.ts
export function sortPrices(prices: readonly number[]): number[] {
  return prices.toSorted((a, b) => b - a);
}
```
:::

:::variant{kind=wrong name=boolean-comparator fails=types reason="比较函数返回了布尔值，而不是数字"}
```ts file=prices.ts
export function sortPrices(prices: readonly number[]): number[] {
  return prices.toSorted((a, b) => a > b);
}
```
:::
