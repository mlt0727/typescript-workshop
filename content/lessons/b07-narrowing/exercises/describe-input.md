---
kind: task
title: 描述各种输入
---
`describe(value)` 的参数可能是字符串、数字、布尔值、`Date`、字符串数组或 `null`。按下表返回描述：

| 值 | 返回 |
| --- | --- |
| 字符串 | `` `文字（${长度} 个字符）` `` |
| 数字 | `` `数字 ${值}` `` |
| 布尔值 | `'是'` 或 `'否'` |
| `Date` | `` `日期 ${value.toISOString()}` `` |
| 字符串数组 | `` `列表（${元素个数} 项）` `` |
| `null` | `'空'` |

起始代码有类型错误。用合适的检查逐个收窄，让每个分支只处理一种情况。

:::files{role=starter}
```ts file=describe.ts
export type Input = string | number | boolean | Date | string[] | null;

export function describe(value: Input): string {
  if (typeof value === 'object') {
    return `列表（${value.length} 项）`;
  }
  if (typeof value === 'string') {
    return `文字（${value.length} 个字符）`;
  }
  return `数字 ${value}`;
}
```
:::

:::files{role=solution}
```ts file=describe.ts
export type Input = string | number | boolean | Date | string[] | null;

export function describe(value: Input): string {
  if (value === null) {
    return '空';
  }
  if (value instanceof Date) {
    return `日期 ${value.toISOString()}`;
  }
  if (Array.isArray(value)) {
    return `列表（${value.length} 项）`;
  }
  if (typeof value === 'string') {
    return `文字（${value.length} 个字符）`;
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }
  return `数字 ${value}`;
}
```
:::

:::files{role=tests}
```ts file=describe.test.ts
import { expect, test } from 'vitest';
import { describe as describeValue } from './describe';

test('字符串与数字', () => {
  expect(describeValue('你好')).toBe('文字（2 个字符）');
  expect(describeValue('')).toBe('文字（0 个字符）');
  expect(describeValue(0)).toBe('数字 0');
  expect(describeValue(-2.5)).toBe('数字 -2.5');
});

test('布尔值', () => {
  expect(describeValue(true)).toBe('是');
  expect(describeValue(false)).toBe('否');
});

test('日期与列表', () => {
  expect(describeValue(new Date(0))).toBe('日期 1970-01-01T00:00:00.000Z');
  expect(describeValue(['a', 'b'])).toBe('列表（2 项）');
  expect(describeValue([])).toBe('列表（0 项）');
});

test('null', () => {
  expect(describeValue(null)).toBe('空');
});
```
:::

:::hint{level=1}
`typeof value === 'object'` 同时包含 `Date`、数组和 `null`，太粗了。先用 `=== null` 排除 `null`，再分别用 `instanceof Date` 和 `Array.isArray` 区分日期和数组。
:::

:::hint{level=2}
按顺序检查：`value === null` → `value instanceof Date` → `Array.isArray(value)` → `typeof value === 'string'` → `typeof value === 'boolean'`，最后剩下的就是 `number`。每个分支都 `return`，后面的代码自然排除了已经处理的情况。
:::

:::explanation
`typeof` 只能区分基本类型，对象一律是 `'object'`（`null` 也是）。所以对象类的成员要用更精确的检查：`instanceof Date` 识别日期，`Array.isArray` 识别数组，`=== null` 识别空值。

每个 `if` 都提前 `return`，TypeScript 的控制流分析会从后续代码中去掉已处理的类型，最后一行的 `value` 只剩 `number`。把鼠标停在不同位置的 `value` 上，可以看到类型一步步变窄。
:::

:::variant{kind=alt name=typeof-switch}
```ts file=describe.ts
export type Input = string | number | boolean | Date | string[] | null;

export function describe(value: Input): string {
  switch (typeof value) {
    case 'string':
      return `文字（${value.length} 个字符）`;
    case 'number':
      return `数字 ${value}`;
    case 'boolean':
      return value ? '是' : '否';
  }
  if (value === null) return '空';
  return value instanceof Date ? `日期 ${value.toISOString()}` : `列表（${value.length} 项）`;
}
```
:::

:::variant{kind=wrong name=object-includes-null fails=types reason="typeof 'object' 之后没有排除 null"}
```ts file=describe.ts
export type Input = string | number | boolean | Date | string[] | null;

export function describe(value: Input): string {
  if (typeof value === 'object') {
    if (value instanceof Date) return `日期 ${value.toISOString()}`;
    return `列表（${value.length} 项）`;
  }
  if (typeof value === 'string') return `文字（${value.length} 个字符）`;
  if (typeof value === 'boolean') return value ? '是' : '否';
  return `数字 ${value}`;
}
```
:::

:::variant{kind=wrong name=truthy-null fails=tests reason="用真假检查排除 null，0、空字符串和 false 也被当成了空"}
```ts file=describe.ts
export type Input = string | number | boolean | Date | string[] | null;

export function describe(value: Input): string {
  if (!value) {
    return '空';
  }
  if (value instanceof Date) return `日期 ${value.toISOString()}`;
  if (Array.isArray(value)) return `列表（${value.length} 项）`;
  if (typeof value === 'string') return `文字（${value.length} 个字符）`;
  if (typeof value === 'boolean') return '是';
  return `数字 ${value}`;
}
```
:::
