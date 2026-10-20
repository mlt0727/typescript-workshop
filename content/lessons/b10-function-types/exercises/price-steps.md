---
kind: task
title: 价格处理流水线
---
结算时，价格要依次经过若干“步骤”：打折、减券、取整……每一步都是一个接收价格、返回新价格的函数。

1. 定义并导出函数类型 `Step`：接收一个 `number`，返回一个 `number`。
2. 实现 `applySteps(price, steps)`：按数组顺序依次应用每一步，返回最终价格；没有步骤时返回原价。

例如 `applySteps(100, [(p) => p * 0.8, (p) => p - 5])` 先打八折得 80，再减 5 得 75。

:::files{role=starter}
```ts file=steps.ts
export function applySteps(price: number, steps): number {
  return price;
}
```
:::

:::files{role=solution}
```ts file=steps.ts
export type Step = (price: number) => number;

export function applySteps(price: number, steps: readonly Step[]): number {
  let result = price;
  for (const step of steps) {
    result = step(result);
  }
  return result;
}
```
:::

:::files{role=tests}
```ts file=steps.test.ts
import { expect, test } from 'vitest';
import { applySteps, type Step } from './steps';

const discount: Step = (p) => p * 0.8;
const coupon: Step = (p) => p - 5;
const floor: Step = (p) => Math.floor(p);

test('按顺序应用', () => {
  expect(applySteps(100, [discount, coupon])).toBe(75);
  expect(applySteps(100, [coupon, discount])).toBe(76);
});

test('没有步骤时返回原价', () => {
  expect(applySteps(42, [])).toBe(42);
});

test('同一步骤可以出现多次', () => {
  expect(applySteps(99.9, [floor, coupon, coupon])).toBe(89);
});
```
```ts file=steps.test-d.ts
import { expectTypeOf } from 'vitest';
import { applySteps, type Step } from './steps';

expectTypeOf<Step>().toEqualTypeOf<(price: number) => number>();
expectTypeOf(applySteps).toBeCallableWith(10, [(p: number) => p + 1]);

// @ts-expect-error 步骤必须返回数字
applySteps(10, [(p: number) => `${p}`]);
```
:::

:::hint{level=1}
`export type Step = (price: number) => number;`，然后把 `steps` 的类型写成 `Step[]`（或 `readonly Step[]`）。
:::

:::hint{level=2}
用一个 `let result = price;`，`for (const step of steps) { result = step(result); }`，最后返回 `result`。也可以用 `reduce`：`steps.reduce((p, step) => step(p), price)`。
:::

:::explanation
`Step` 是一个函数类型，`Step[]` 就是“函数的数组”。数组里的每一项都接收上一步的结果、返回新的结果，按顺序调用即可。

参数用 `readonly Step[]` 表示函数不会修改调用方的数组（a17）。顺序很重要：先打折再减券和先减券再打折，结果不同（75 和 76）。

`reduce` 的写法 `steps.reduce((p, step) => step(p), price)` 也很常见：初始值是原价，每一步把累计值交给下一个函数。
:::

:::variant{kind=alt name=reduce}
```ts file=steps.ts
export type Step = (price: number) => number;

export function applySteps(price: number, steps: Step[]): number {
  return steps.reduce((current, step) => step(current), price);
}
```
:::

:::variant{kind=wrong name=void-step fails=types reason="Step 的返回类型写成了 void"}
```ts file=steps.ts
export type Step = (price: number) => void;

export function applySteps(price: number, steps: Step[]): number {
  for (const step of steps) {
    step(price);
  }
  return price;
}
```
:::

:::variant{kind=wrong name=reverse-order fails=tests reason="从最后一步开始应用，顺序反了"}
```ts file=steps.ts
export type Step = (price: number) => number;

export function applySteps(price: number, steps: Step[]): number {
  return steps.reduceRight((current, step) => step(current), price);
}
```
:::

:::variant{kind=wrong name=always-from-original fails=tests reason="每一步都作用在原价上，没有把上一步的结果传下去"}
```ts file=steps.ts
export type Step = (price: number) => number;

export function applySteps(price: number, steps: Step[]): number {
  let result = price;
  for (const step of steps) {
    result = step(price);
  }
  return result;
}
```
:::
