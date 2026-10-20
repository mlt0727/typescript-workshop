---
kind: task
title: 任意个数的平均分
---
实现 `average(...scores)`：接收**任意个数**的分数参数（不是一个数组），返回平均值；一个参数都没有时返回 `null`。

例如 `average(80, 90, 100)` 返回 `90`，`average()` 返回 `null`。

起始代码把参数写成了一个数组，所以 `average(80, 90, 100)` 这样的调用无法通过类型检查。

:::files{role=starter}
```ts file=average.ts
export function average(scores: number[]): number | null {
  let total = 0;
  for (const score of scores) {
    total += score;
  }
  return total / scores.length;
}

console.log(average(80, 90, 100), average());
```
:::

:::files{role=solution}
```ts file=average.ts
export function average(...scores: number[]): number | null {
  if (scores.length === 0) {
    return null;
  }
  let total = 0;
  for (const score of scores) {
    total += score;
  }
  return total / scores.length;
}

console.log(average(80, 90, 100), average());
```
:::

:::files{role=tests}
```ts file=average.test.ts
import { expect, test } from 'vitest';
import { average } from './average';

test('多个参数', () => {
  expect(average(80, 90, 100)).toBe(90);
  expect(average(1, 2)).toBe(1.5);
});

test('一个参数', () => {
  expect(average(60)).toBe(60);
});

test('没有参数时返回 null', () => {
  expect(average()).toBeNull();
});

test('可以展开一个数组传入', () => {
  const scores = [70, 80];
  expect(average(...scores)).toBe(75);
});
```
:::

:::hint{level=1}
把参数改成剩余参数：`...scores: number[]`。然后想一想没有参数时 `total / scores.length` 会得到什么。
:::

:::hint{level=2}
剩余参数在函数里就是一个普通数组。先 `if (scores.length === 0) { return null; }`，再计算平均值。
:::

:::explanation
`...scores: number[]` 把调用时传入的所有参数收集成一个数组，所以 `average(80, 90, 100)` 和 `average()` 都能通过类型检查；在函数内部，`scores` 就是一个普通的 `number[]`。

没有参数时，`total / scores.length` 是 `0 / 0`，得到 `NaN`（a04）。规格要求返回 `null`，所以要先检查长度。

已经有一个数组时，用展开语法 `average(...scores)` 把它拆成多个参数传入（a12）。
:::

:::variant{kind=alt name=divide-once}
```ts file=average.ts
export function average(...scores: number[]): number | null {
  let total = 0;
  for (const score of scores) {
    total += score;
  }
  return scores.length === 0 ? null : total / scores.length;
}
```
:::

:::variant{kind=wrong name=array-param fails=types reason="参数仍然是一个数组，不能用多个参数调用"}
```ts file=average.ts
export function average(scores: number[]): number | null {
  if (scores.length === 0) {
    return null;
  }
  let total = 0;
  for (const score of scores) {
    total += score;
  }
  return total / scores.length;
}
```
:::

:::variant{kind=wrong name=nan-for-empty fails=tests reason="没有处理空参数，返回了 NaN"}
```ts file=average.ts
export function average(...scores: number[]): number | null {
  let total = 0;
  for (const score of scores) {
    total += score;
  }
  return total / scores.length;
}
```
:::
