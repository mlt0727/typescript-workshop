---
kind: task
title: 新增一种图形
---
`Shape` 刚刚新增了三角形 `{ kind: 'triangle'; a: number; b: number; c: number }`（三条边长）。`perimeter` 用了穷尽检查，所以 TypeScript 立刻指出了还没处理的地方。

补上三角形的周长（三边之和），让类型检查和测试通过。不要删掉穷尽检查。

:::files{role=starter}
```ts file=shape.ts
export type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'rect'; width: number; height: number }
  | { kind: 'triangle'; a: number; b: number; c: number };

function assertNever(value: never): never {
  throw new Error(`未处理的图形：${JSON.stringify(value)}`);
}

export function perimeter(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return 2 * Math.PI * shape.radius;
    case 'rect':
      return 2 * (shape.width + shape.height);
    default:
      return assertNever(shape);
  }
}
```
:::

:::files{role=solution}
```ts file=shape.ts
export type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'rect'; width: number; height: number }
  | { kind: 'triangle'; a: number; b: number; c: number };

function assertNever(value: never): never {
  throw new Error(`未处理的图形：${JSON.stringify(value)}`);
}

export function perimeter(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return 2 * Math.PI * shape.radius;
    case 'rect':
      return 2 * (shape.width + shape.height);
    case 'triangle':
      return shape.a + shape.b + shape.c;
    default:
      return assertNever(shape);
  }
}
```
:::

:::files{role=tests}
```ts file=shape.test.ts
import { expect, test } from 'vitest';
import { perimeter } from './shape';

test('圆与矩形', () => {
  expect(perimeter({ kind: 'circle', radius: 1 })).toBeCloseTo(2 * Math.PI);
  expect(perimeter({ kind: 'rect', width: 3, height: 4 })).toBe(14);
});

test('三角形', () => {
  expect(perimeter({ kind: 'triangle', a: 3, b: 4, c: 5 })).toBe(12);
});
```
:::

:::hint{level=1}
看 TypeScript 在哪一行报错：`default` 里的 `shape` 现在还可能是三角形，不是 `never`。给三角形加一个 `case`。
:::

:::hint{level=2}
在 `default` 前面加上 `case 'triangle': return shape.a + shape.b + shape.c;`。
:::

:::explanation
加上 `case 'triangle'` 之后，三种情况都处理了，`default` 里的 `shape` 才变成 `never`，`assertNever(shape)` 通过检查。

这就是穷尽检查的价值：给联合类型新增成员时，编译器会逐一指出所有需要修改的 `switch`，而不是让新情况在运行时落进某个兜底分支。
:::

:::variant{kind=alt name=if-chain}
```ts file=shape.ts
export type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'rect'; width: number; height: number }
  | { kind: 'triangle'; a: number; b: number; c: number };

function assertNever(value: never): never {
  throw new Error(`未处理的图形：${JSON.stringify(value)}`);
}

export function perimeter(shape: Shape): number {
  if (shape.kind === 'circle') return 2 * Math.PI * shape.radius;
  if (shape.kind === 'rect') return 2 * (shape.width + shape.height);
  if (shape.kind === 'triangle') return shape.a + shape.b + shape.c;
  return assertNever(shape);
}
```
:::

:::variant{kind=wrong name=remove-check fails=tests reason="删掉了穷尽检查，用 default 兜底，三角形算错了"}
```ts file=shape.ts
export type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'rect'; width: number; height: number }
  | { kind: 'triangle'; a: number; b: number; c: number };

export function perimeter(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return 2 * Math.PI * shape.radius;
    case 'rect':
      return 2 * (shape.width + shape.height);
    default:
      return 0;
  }
}
```
:::

:::variant{kind=wrong name=wrong-fields fails=types reason="在三角形分支里读取了不存在的属性"}
```ts file=shape.ts
export type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'rect'; width: number; height: number }
  | { kind: 'triangle'; a: number; b: number; c: number };

function assertNever(value: never): never {
  throw new Error(`未处理的图形：${JSON.stringify(value)}`);
}

export function perimeter(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return 2 * Math.PI * shape.radius;
    case 'rect':
      return 2 * (shape.width + shape.height);
    case 'triangle':
      return shape.width * 3;
    default:
      return assertNever(shape);
  }
}
```
:::
