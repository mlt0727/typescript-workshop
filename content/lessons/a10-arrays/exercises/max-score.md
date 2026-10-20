---
kind: task
title: 找出最高分
---
实现 `maxScore(scores)`：返回数组中的最大值；数组为空时返回 `null`。

分数可能是负数（例如扣分制），所以不能假设最大值至少是 0。本题请用循环实现。

:::files{role=starter}
```ts file=max.ts
export function maxScore(scores: number[]): number | null {
  let max = scores[0];
  for (const score of scores) {
    if (score > max) {
      max = score;
    }
  }
  return max;
}

console.log(maxScore([72, 95, 88]), maxScore([]));
```
:::

:::files{role=solution}
```ts file=max.ts
export function maxScore(scores: number[]): number | null {
  let max = scores[0];
  if (max === undefined) {
    return null;
  }
  for (const score of scores) {
    if (score > max) {
      max = score;
    }
  }
  return max;
}

console.log(maxScore([72, 95, 88]), maxScore([]));
```
:::

:::files{role=tests}
```ts file=max.test.ts
import { expect, test } from 'vitest';
import { maxScore } from './max';

test('普通情况', () => {
  expect(maxScore([72, 95, 88])).toBe(95);
  expect(maxScore([60])).toBe(60);
});

test('最大值在开头或结尾', () => {
  expect(maxScore([99, 1, 2])).toBe(99);
  expect(maxScore([1, 2, 99])).toBe(99);
});

test('全是负数', () => {
  expect(maxScore([-5, -2, -9])).toBe(-2);
});

test('空数组返回 null', () => {
  expect(maxScore([])).toBeNull();
});
```
:::

:::hint{level=1}
把鼠标停在 `max` 上：`scores[0]` 的类型是 `number | undefined`，因为数组可能是空的。先处理空数组的情况。
:::

:::hint{level=2}
在循环之前加上 `if (max === undefined) { return null; }`。检查之后，TypeScript 知道 `max` 是 `number`，后面的比较和赋值就都没有问题了。也可以先检查 `scores.length === 0`，不过那样 TypeScript 不会因此收窄 `scores[0]` 的类型。
:::

:::explanation
`scores[0]` 在空数组上是 `undefined`。开启 `noUncheckedIndexedAccess` 后，TypeScript 把这个可能性写进了类型（`number | undefined`），所以起始代码里 `score > max` 报错。

参考答案先检查 `max === undefined`：空数组直接返回 `null`；否则 `max` 被收窄为 `number`，循环里的比较是安全的。用第一个元素作为初始值，也避免了“初始值设为 0”在全是负数时出错的问题。

注意：只检查 `scores.length === 0` 并不能让 TypeScript 收窄 `scores[0]` 的类型——它不会把长度和下标访问联系起来。这时需要像另一种写法那样，在取出元素后再检查一次。
:::

:::variant{kind=alt name=length-check}
```ts file=max.ts
export function maxScore(scores: number[]): number | null {
  if (scores.length === 0) {
    return null;
  }
  let max = -Infinity;
  for (const score of scores) {
    if (score > max) {
      max = score;
    }
  }
  return max;
}
```
:::

:::variant{kind=wrong name=start-at-zero fails=tests reason="初始值设为 0，全是负数时返回了 0"}
```ts file=max.ts
export function maxScore(scores: number[]): number | null {
  if (scores.length === 0) {
    return null;
  }
  let max = 0;
  for (const score of scores) {
    if (score > max) {
      max = score;
    }
  }
  return max;
}
```
:::

:::variant{kind=wrong name=non-null fails=rules reason="用非空断言跳过了空数组检查"}
```ts file=max.ts
export function maxScore(scores: number[]): number | null {
  let max = scores[0]!;
  for (const score of scores) {
    if (score > max) {
      max = score;
    }
  }
  return max;
}
```
:::

:::variant{kind=wrong name=length-then-index fails=types reason="只检查了长度，TypeScript 仍然认为 scores[0] 可能是 undefined"}
```ts file=max.ts
export function maxScore(scores: number[]): number | null {
  if (scores.length === 0) {
    return null;
  }
  let max = scores[0];
  for (const score of scores) {
    if (score > max) {
      max = score;
    }
  }
  return max;
}
```
:::
