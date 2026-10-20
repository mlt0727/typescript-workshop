---
kind: task
title: 从常量数组推导状态类型
---
文章的状态只有三种。为了让“状态列表”和“状态类型”永远一致，类型要从数组推导出来，而不是再手写一遍：

1. 把 `STATUSES` 改成只读元组（`as const`）；
2. 定义并导出 `type Status`：由 `STATUSES` 的元素推导出来（结果应为 `'draft' | 'published' | 'archived'`）；
3. 实现类型守卫 `isStatus(value: string): value is Status`：`value` 是三种状态之一时返回 `true`。

注意：不允许使用 `as` 类型断言（`as const` 除外）。

:::files{role=starter}
```ts file=status.ts
export const STATUSES = ['draft', 'published', 'archived'];

export type Status = string;

export function isStatus(value: string): boolean {
  return STATUSES.includes(value);
}
```
:::

:::files{role=solution}
```ts file=status.ts
export const STATUSES = ['draft', 'published', 'archived'] as const;

export type Status = (typeof STATUSES)[number];

export function isStatus(value: string): value is Status {
  return STATUSES.some((status) => status === value);
}
```
:::

:::files{role=tests}
```ts file=status.test.ts
import { expect, test } from 'vitest';
import { STATUSES, isStatus } from './status';

test('合法与不合法的状态', () => {
  expect(isStatus('draft')).toBe(true);
  expect(isStatus('archived')).toBe(true);
  expect(isStatus('deleted')).toBe(false);
  expect(isStatus('Draft')).toBe(false);
});

test('状态列表', () => {
  expect(STATUSES).toEqual(['draft', 'published', 'archived']);
});
```
```ts file=status.test-d.ts
import { expectTypeOf } from 'vitest';
import { STATUSES, isStatus, type Status } from './status';

expectTypeOf<Status>().toEqualTypeOf<'draft' | 'published' | 'archived'>();
expectTypeOf(STATUSES).toEqualTypeOf<readonly ['draft', 'published', 'archived']>();

declare const input: string;
if (isStatus(input)) {
  expectTypeOf(input).toEqualTypeOf<Status>();
}
```
:::

:::hint{level=1}
`as const` 之后，`STATUSES` 的类型是只读元组 `readonly ['draft', 'published', 'archived']`。`(typeof STATUSES)[number]` 取出所有元素类型的联合。
:::

:::hint{level=2}
加上 `as const` 后，`STATUSES.includes(value)` 会报错：`includes` 的参数类型变成了 `Status`，不接受任意 `string`。改用 `STATUSES.some((status) => status === value)`——比较本身对任何字符串都合法。
:::

:::explanation
`as const` 让数组保持精确的字面量类型，`(typeof STATUSES)[number]` 再从中取出联合类型。以后在数组里增加一种状态，`Status` 自动更新，不会出现“列表改了、类型忘了改”的情况。

一个经常遇到的问题：只读元组的 `includes` 只接受元组元素的类型，`includes(value)` 传入 `string` 会报错。常见的“解决办法”是 `(STATUSES as readonly string[]).includes(value)`，但这是类型断言。`some((status) => status === value)` 用普通的比较就能做到，完全不需要断言。

返回类型 `value is Status` 让调用方在检查之后得到收窄的类型（b08）。
:::

:::variant{kind=alt name=set-lookup}
```ts file=status.ts
export const STATUSES = ['draft', 'published', 'archived'] as const;

export type Status = (typeof STATUSES)[number];

const STATUS_SET: ReadonlySet<string> = new Set(STATUSES);

export function isStatus(value: string): value is Status {
  return STATUS_SET.has(value);
}
```
:::

:::variant{kind=wrong name=handwritten-type fails=types reason="手写了 Status，数组没有用 as const，两者没有关联"}
```ts file=status.ts
export const STATUSES = ['draft', 'published', 'archived'];

export type Status = 'draft' | 'published' | 'archived';

export function isStatus(value: string): value is Status {
  return STATUSES.includes(value);
}
```
:::

:::variant{kind=wrong name=assert-includes fails=rules reason="用类型断言绕过 includes 的参数检查"}
```ts file=status.ts
export const STATUSES = ['draft', 'published', 'archived'] as const;

export type Status = (typeof STATUSES)[number];

export function isStatus(value: string): value is Status {
  return (STATUSES as readonly string[]).includes(value);
}
```
:::

:::variant{kind=wrong name=boolean-guard fails=types reason="返回类型是 boolean，调用方得不到收窄"}
```ts file=status.ts
export const STATUSES = ['draft', 'published', 'archived'] as const;

export type Status = (typeof STATUSES)[number];

export function isStatus(value: string): boolean {
  return STATUSES.some((status) => status === value);
}
```
:::
