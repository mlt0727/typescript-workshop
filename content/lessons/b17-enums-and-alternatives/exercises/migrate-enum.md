---
kind: task
title: 把枚举迁移成 as const 对象
---
起始代码用了字符串枚举 `Priority`，本平台的 `erasableSyntaxOnly` 不允许。把它迁移成 `as const` 对象，并推导出同名的类型：

1. 导出常量对象 `Priority`，成员与原来相同：`Low` → `'low'`、`Medium` → `'medium'`、`High` → `'high'`；
2. 导出类型 `Priority`，它是对象中所有值的联合：`'low' | 'medium' | 'high'`；
3. `weight(priority)` 的行为不变：`low` 为 1，`medium` 为 2，`high` 为 3。

迁移之后，调用方既可以写 `weight(Priority.High)`，也可以直接写 `weight('high')`。

:::files{role=starter}
```ts file=priority.ts
export enum Priority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

export function weight(priority: Priority): number {
  switch (priority) {
    case Priority.Low:
      return 1;
    case Priority.Medium:
      return 2;
    case Priority.High:
      return 3;
  }
}
```
:::

:::files{role=solution}
```ts file=priority.ts
export const Priority = {
  Low: 'low',
  Medium: 'medium',
  High: 'high',
} as const;

export type Priority = (typeof Priority)[keyof typeof Priority];

export function weight(priority: Priority): number {
  switch (priority) {
    case Priority.Low:
      return 1;
    case Priority.Medium:
      return 2;
    case Priority.High:
      return 3;
  }
}
```
:::

:::files{role=tests}
```ts file=priority.test.ts
import { expect, test } from 'vitest';
import { Priority, weight } from './priority';

test('权重', () => {
  expect(weight(Priority.Low)).toBe(1);
  expect(weight(Priority.Medium)).toBe(2);
  expect(weight('high')).toBe(3);
});

test('运行时对象只有三个成员', () => {
  expect(Object.entries(Priority)).toEqual([
    ['Low', 'low'],
    ['Medium', 'medium'],
    ['High', 'high'],
  ]);
});
```
```ts file=priority.test-d.ts
import { expectTypeOf } from 'vitest';
import { Priority, weight } from './priority';

expectTypeOf<Priority>().toEqualTypeOf<'low' | 'medium' | 'high'>();
expectTypeOf(Priority.High).toEqualTypeOf<'high'>();
weight('low');

// @ts-expect-error 不是合法的优先级
weight('urgent');
```
:::

:::hint{level=1}
把 `enum Priority { … }` 改成 `export const Priority = { Low: 'low', … } as const;`，再加一行同名的类型。`weight` 函数本身不用改。
:::

:::hint{level=2}
`export type Priority = (typeof Priority)[keyof typeof Priority];`：`typeof Priority` 是对象的类型，`keyof` 取出所有键，索引访问取出所有值的类型。
:::

:::explanation
`as const` 让每个属性保持字面量类型（`'low'` 而不是 `string`），`(typeof Priority)[keyof typeof Priority]` 把所有值组成联合类型。值 `Priority` 和类型 `Priority` 同名，使用起来和原来的枚举几乎一样：`Priority.High` 仍然可用，`switch` 里的 `case Priority.Low:` 也不用改。

迁移后还多了一个好处：类型是普通的字符串字面量联合，`weight('high')` 这样直接传字符串也能通过检查；原来的字符串枚举不接受普通字符串。
:::

:::variant{kind=alt name=literal-union-and-object}
```ts file=priority.ts
export type Priority = 'low' | 'medium' | 'high';

export const Priority = {
  Low: 'low',
  Medium: 'medium',
  High: 'high',
} as const satisfies Record<string, Priority>;

const WEIGHTS: Record<Priority, number> = { low: 1, medium: 2, high: 3 };

export function weight(priority: Priority): number {
  return WEIGHTS[priority];
}
```
:::

:::variant{kind=wrong name=keep-enum fails=types reason="仍然使用 enum，erasableSyntaxOnly 不允许"}
```ts file=priority.ts
export enum Priority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

export function weight(priority: Priority | `${Priority}`): number {
  switch (priority) {
    case 'low':
      return 1;
    case 'medium':
      return 2;
    case 'high':
      return 3;
  }
}
```
:::

:::variant{kind=wrong name=no-as-const fails=types reason="没有 as const，推导出的类型是 string"}
```ts file=priority.ts
export const Priority = {
  Low: 'low',
  Medium: 'medium',
  High: 'high',
};

export type Priority = (typeof Priority)[keyof typeof Priority];

export function weight(priority: Priority): number {
  if (priority === Priority.Low) return 1;
  if (priority === Priority.Medium) return 2;
  return 3;
}
```
:::
