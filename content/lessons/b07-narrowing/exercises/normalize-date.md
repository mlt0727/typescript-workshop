---
kind: challenge
title: 统一各种日期输入
---
不同来源给出的“时间”形式各不相同。实现 `toDate(input)`，把它们统一成 `Date | null`：

| 输入 | 结果 |
| --- | --- |
| `Date` 对象 | 一个**新的** `Date`，表示同一时刻（不能返回同一个对象，调用方可能会修改它） |
| 数字 | 把它当作**毫秒**时间戳：`new Date(input)` |
| 字符串 | 去掉首尾空格后用 `new Date(…)` 解析；空字符串返回 `null` |
| `null` 或 `undefined` | `null` |

无论哪种输入，得到的日期无效（`getTime()` 是 `NaN`，例如 `new Date('不是日期')`）时都返回 `null`。

再实现 `isSameDay(a, b)`：两个输入都能转换成有效日期，并且是 **UTC** 的同一天（年、月、日都相同）时返回 `true`，否则返回 `false`。可以用 `getUTCFullYear()`、`getUTCMonth()`、`getUTCDate()`。

:::files{role=starter}
```ts file=dates.ts
export type DateInput = Date | number | string | null | undefined;

export function toDate(input: DateInput): Date | null {
  return new Date(input);
}

export function isSameDay(a: DateInput, b: DateInput): boolean {
  return toDate(a) === toDate(b);
}
```
:::

:::files{role=solution}
```ts file=dates.ts
export type DateInput = Date | number | string | null | undefined;

function valid(date: Date): Date | null {
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toDate(input: DateInput): Date | null {
  if (input === null || input === undefined) {
    return null;
  }
  if (input instanceof Date) {
    return valid(new Date(input.getTime()));
  }
  if (typeof input === 'number') {
    return valid(new Date(input));
  }
  const text = input.trim();
  if (text === '') {
    return null;
  }
  return valid(new Date(text));
}

export function isSameDay(a: DateInput, b: DateInput): boolean {
  const first = toDate(a);
  const second = toDate(b);
  if (first === null || second === null) {
    return false;
  }
  return (
    first.getUTCFullYear() === second.getUTCFullYear() &&
    first.getUTCMonth() === second.getUTCMonth() &&
    first.getUTCDate() === second.getUTCDate()
  );
}
```
:::

:::files{role=tests}
```ts file=dates.test.ts
import { describe, expect, test } from 'vitest';
import { isSameDay, toDate } from './dates';

describe('toDate', () => {
  test('Date 输入返回新的对象', () => {
    const original = new Date(Date.UTC(2026, 9, 20, 8, 30));
    const result = toDate(original);
    expect(result?.getTime()).toBe(original.getTime());
    expect(result).not.toBe(original);
  });

  test('数字是毫秒时间戳', () => {
    expect(toDate(0)?.toISOString()).toBe('1970-01-01T00:00:00.000Z');
    expect(toDate(86_400_000)?.toISOString()).toBe('1970-01-02T00:00:00.000Z');
  });

  test('字符串', () => {
    expect(toDate('2026-10-20T08:30:00Z')?.toISOString()).toBe('2026-10-20T08:30:00.000Z');
    expect(toDate('  2026-10-20T00:00:00Z  ')?.getTime()).toBe(Date.UTC(2026, 9, 20));
  });

  test('空值与无效值', () => {
    expect(toDate(null)).toBeNull();
    expect(toDate(undefined)).toBeNull();
    expect(toDate('')).toBeNull();
    expect(toDate('   ')).toBeNull();
    expect(toDate('不是日期')).toBeNull();
    expect(toDate(Number.NaN)).toBeNull();
    expect(toDate(new Date('无效'))).toBeNull();
  });
});

describe('isSameDay', () => {
  test('同一天的不同时刻', () => {
    expect(isSameDay('2026-10-20T01:00:00Z', Date.UTC(2026, 9, 20, 23, 59))).toBe(true);
  });

  test('不同的日子', () => {
    expect(isSameDay('2026-10-20T23:59:59Z', '2026-10-21T00:00:00Z')).toBe(false);
    expect(isSameDay('2026-10-20T12:00:00Z', '2025-10-20T12:00:00Z')).toBe(false);
  });

  test('任一输入无效时为 false', () => {
    expect(isSameDay(null, null)).toBe(false);
    expect(isSameDay('2026-10-20T00:00:00Z', 'x')).toBe(false);
  });
});
```
:::

:::hint{level=1}
按输入类型逐个收窄：先排除 `null` 和 `undefined`，再用 `instanceof Date`、`typeof … === 'number'` 区分，最后剩下的是字符串。每种情况得到 `Date` 之后，统一检查 `getTime()` 是否为 `NaN`。
:::

:::hint{level=2}
写一个小函数 `valid(date)`：`Number.isNaN(date.getTime()) ? null : date`。复制日期用 `new Date(input.getTime())`。`isSameDay` 先把两个输入都转换，任一为 `null` 就返回 `false`，否则比较三个 UTC 字段。注意 `getUTCMonth()` 从 0 开始，但两边比较时不影响结果。
:::

:::explanation
`DateInput` 有五种可能，`toDate` 用四种不同的检查依次排除：`=== null || === undefined`、`instanceof Date`、`typeof === 'number'`，最后剩下 `string`。每一步之后，TypeScript 都知道 `input` 剩下哪些可能。

`new Date(…)` 遇到无法解析的输入不会抛出异常，而是返回一个“无效日期”，它的 `getTime()` 是 `NaN`。所以每种情况都要检查有效性。

返回新的 `Date` 而不是原对象，是因为 `Date` 是可变的（`setFullYear` 等方法会修改它，a11）。

起始代码的 `toDate(a) === toDate(b)` 比较的是两个对象的引用（a06），永远是 `false`。比较日期要比较它们的数值或字段。
:::

:::variant{kind=alt name=switch-typeof}
```ts file=dates.ts
export type DateInput = Date | number | string | null | undefined;

export function toDate(input: DateInput): Date | null {
  let date: Date;
  switch (typeof input) {
    case 'number':
      date = new Date(input);
      break;
    case 'string':
      if (input.trim() === '') return null;
      date = new Date(input.trim());
      break;
    case 'undefined':
      return null;
    default:
      if (input === null) return null;
      date = new Date(input.getTime());
  }
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isSameDay(a: DateInput, b: DateInput): boolean {
  const x = toDate(a);
  const y = toDate(b);
  return x !== null && y !== null && x.toISOString().slice(0, 10) === y.toISOString().slice(0, 10);
}
```
:::

:::variant{kind=wrong name=same-instance fails=tests reason="Date 输入直接返回了原对象"}
```ts file=dates.ts
export type DateInput = Date | number | string | null | undefined;

export function toDate(input: DateInput): Date | null {
  if (input === null || input === undefined) return null;
  let date: Date;
  if (input instanceof Date) {
    date = input;
  } else if (typeof input === 'number') {
    date = new Date(input);
  } else {
    if (input.trim() === '') return null;
    date = new Date(input.trim());
  }
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isSameDay(a: DateInput, b: DateInput): boolean {
  const x = toDate(a);
  const y = toDate(b);
  return x !== null && y !== null && x.toISOString().slice(0, 10) === y.toISOString().slice(0, 10);
}
```
:::

:::variant{kind=wrong name=no-validity-check fails=tests reason="没有检查无效日期"}
```ts file=dates.ts
export type DateInput = Date | number | string | null | undefined;

export function toDate(input: DateInput): Date | null {
  if (input === null || input === undefined) return null;
  if (input instanceof Date) return new Date(input.getTime());
  if (typeof input === 'number') return new Date(input);
  if (input.trim() === '') return null;
  return new Date(input.trim());
}

export function isSameDay(a: DateInput, b: DateInput): boolean {
  const x = toDate(a);
  const y = toDate(b);
  if (x === null || y === null) return false;
  return x.getUTCFullYear() === y.getUTCFullYear() && x.getUTCMonth() === y.getUTCMonth() && x.getUTCDate() === y.getUTCDate();
}
```
:::

:::variant{kind=wrong name=object-check-only fails=types reason="用 typeof 'object' 区分 Date，没有排除 null"}
```ts file=dates.ts
export type DateInput = Date | number | string | null | undefined;

export function toDate(input: DateInput): Date | null {
  if (input === undefined) return null;
  let date: Date;
  if (typeof input === 'object') {
    date = new Date(input.getTime());
  } else if (typeof input === 'number') {
    date = new Date(input);
  } else {
    if (input.trim() === '') return null;
    date = new Date(input.trim());
  }
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isSameDay(a: DateInput, b: DateInput): boolean {
  const x = toDate(a);
  const y = toDate(b);
  return x !== null && y !== null && x.toISOString().slice(0, 10) === y.toISOString().slice(0, 10);
}
```
:::
