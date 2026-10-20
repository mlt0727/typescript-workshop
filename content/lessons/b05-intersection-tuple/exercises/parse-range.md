---
kind: challenge
title: 解析页码范围
---
打印对话框里可以输入页码范围，例如 `'3-7'`。实现两个函数，用元组 `[number, number]` 表示一个范围（第一个是起始页，第二个是结束页）：

**`parseRange(text)`**，返回 `[number, number] | null`：

- 格式是“整数-整数”，`-` 两边可以有空格，例如 `' 3 - 7 '`；
- 每一边去掉首尾空格后不能为空（`'-5'`、`'3-'` 都无效），用 `Number()` 转换的结果必须是非负整数；
- 必须正好有一个 `-`（`'1-2-3'` 无效）；
- 如果起始页大于结束页，交换它们：`'9-2'` 得到 `[2, 9]`；
- 无效时返回 `null`。

**`overlap(a, b)`**：两个范围（都已经是起始页 ≤ 结束页）的重叠部分，返回 `[number, number] | null`。例如 `[1, 5]` 和 `[4, 9]` 重叠部分是 `[4, 5]`；`[1, 3]` 和 `[3, 6]` 的重叠部分是 `[3, 3]`；没有重叠时返回 `null`。参数类型使用只读元组 `readonly [number, number]`。

:::files{role=starter}
```ts file=range.ts
export function parseRange(text: string) {
  const parts = text.split('-');
  return [Number(parts[0]), Number(parts[1])];
}

export function overlap(a: number[], b: number[]) {
  return null;
}
```
:::

:::files{role=solution}
```ts file=range.ts
function parsePage(part: string): number | null {
  const trimmed = part.trim();
  if (trimmed === '') {
    return null;
  }
  const page = Number(trimmed);
  return Number.isInteger(page) && page >= 0 ? page : null;
}

export function parseRange(text: string): [number, number] | null {
  const parts = text.split('-');
  if (parts.length !== 2) {
    return null;
  }
  const [left = '', right = ''] = parts;
  const start = parsePage(left);
  const end = parsePage(right);
  if (start === null || end === null) {
    return null;
  }
  return start <= end ? [start, end] : [end, start];
}

export function overlap(
  a: readonly [number, number],
  b: readonly [number, number],
): [number, number] | null {
  const start = Math.max(a[0], b[0]);
  const end = Math.min(a[1], b[1]);
  return start <= end ? [start, end] : null;
}
```
:::

:::files{role=tests}
```ts file=range.test.ts
import { describe, expect, test } from 'vitest';
import { overlap, parseRange } from './range';

describe('parseRange', () => {
  test('基本格式', () => {
    expect(parseRange('3-7')).toEqual([3, 7]);
    expect(parseRange(' 3 - 7 ')).toEqual([3, 7]);
    expect(parseRange('0-0')).toEqual([0, 0]);
  });

  test('起始页大于结束页时交换', () => {
    expect(parseRange('9-2')).toEqual([2, 9]);
  });

  test.each([['-5'], ['3-'], ['1-2-3'], ['abc'], ['1.5-3'], [''], ['3'], ['a-b']])('%s 无效', (text) => {
    expect(parseRange(text)).toBeNull();
  });
});

describe('overlap', () => {
  test('部分重叠', () => {
    expect(overlap([1, 5], [4, 9])).toEqual([4, 5]);
    expect(overlap([4, 9], [1, 5])).toEqual([4, 5]);
  });

  test('包含', () => {
    expect(overlap([1, 10], [3, 4])).toEqual([3, 4]);
  });

  test('只有一页重叠', () => {
    expect(overlap([1, 3], [3, 6])).toEqual([3, 3]);
  });

  test('没有重叠', () => {
    expect(overlap([1, 2], [5, 6])).toBeNull();
  });
});
```
```ts file=range.test-d.ts
import { expectTypeOf } from 'vitest';
import { overlap, parseRange } from './range';

expectTypeOf(parseRange).returns.toEqualTypeOf<[number, number] | null>();
expectTypeOf(overlap).returns.toEqualTypeOf<[number, number] | null>();
expectTypeOf(overlap).parameter(0).toEqualTypeOf<readonly [number, number]>();
```
:::

:::hint{level=1}
写出返回类型 `[number, number] | null`，TypeScript 就会检查每个 `return` 是否真的是二元元组。`text.split('-')` 的长度必须正好是 2。每一边先 `trim()`，再判断是否为空、是否是非负整数（`Number('')` 是 `0`，所以空字符串要单独排除）。
:::

:::hint{level=2}
`overlap`：重叠部分的起点是两个起点中较大的那个，终点是两个终点中较小的那个：`Math.max(a[0], b[0])` 和 `Math.min(a[1], b[1])`。起点不大于终点时才有重叠。注意 `a[0]` 在元组上的类型是 `number`，不需要检查 `undefined`。
:::

:::explanation
`text.split('-')` 返回的是普通数组 `string[]`，下标访问的类型是 `string | undefined`（a10）。检查了 `parts.length !== 2` 之后，TypeScript 仍然不知道长度，所以参考答案用带默认值的解构 `const [left = '', right = ''] = parts;` 得到两个 `string`。

返回值写成 `[start, end]` 时，因为函数声明了返回类型 `[number, number] | null`，这个数组字面量会按元组检查；如果没有写返回类型，它会被推断成 `number[]`。

`overlap` 的参数是元组，`a[0]`、`a[1]` 的类型都是 `number`——元组的长度是固定的，所以没有 `undefined`，这正是元组比普通数组好用的地方。参数用 `readonly`，因为函数只读不写，同时也能接收只读元组。
:::

:::variant{kind=alt name=destructure-params}
```ts file=range.ts
function toPage(text: string | undefined): number | null {
  if (text === undefined || text.trim() === '') return null;
  const n = Number(text);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export function parseRange(text: string): [number, number] | null {
  const parts = text.split('-');
  if (parts.length !== 2) return null;
  const a = toPage(parts[0]);
  const b = toPage(parts[1]);
  if (a === null || b === null) return null;
  return [Math.min(a, b), Math.max(a, b)];
}

export function overlap(
  [aStart, aEnd]: readonly [number, number],
  [bStart, bEnd]: readonly [number, number],
): [number, number] | null {
  if (aEnd < bStart || bEnd < aStart) return null;
  return [Math.max(aStart, bStart), Math.min(aEnd, bEnd)];
}
```
:::

:::variant{kind=wrong name=array-return fails=types reason="返回类型写成了 number[]，不是元组"}
```ts file=range.ts
export function parseRange(text: string): number[] | null {
  const parts = text.split('-');
  if (parts.length !== 2) return null;
  const nums = parts.map((p) => (p.trim() === '' ? NaN : Number(p)));
  if (!nums.every((n) => Number.isInteger(n) && n >= 0)) return null;
  return nums.toSorted((x, y) => x - y);
}

export function overlap(a: readonly [number, number], b: readonly [number, number]): number[] | null {
  const start = Math.max(a[0], b[0]);
  const end = Math.min(a[1], b[1]);
  return start <= end ? [start, end] : null;
}
```
:::

:::variant{kind=wrong name=empty-is-zero fails=tests reason="没有排除空的一边，Number('') 被当成了 0"}
```ts file=range.ts
export function parseRange(text: string): [number, number] | null {
  const parts = text.split('-');
  if (parts.length !== 2) return null;
  const [left = '', right = ''] = parts;
  const start = Number(left.trim());
  const end = Number(right.trim());
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < 0) return null;
  return start <= end ? [start, end] : [end, start];
}

export function overlap(a: readonly [number, number], b: readonly [number, number]): [number, number] | null {
  const start = Math.max(a[0], b[0]);
  const end = Math.min(a[1], b[1]);
  return start <= end ? [start, end] : null;
}
```
:::

:::variant{kind=wrong name=no-swap fails=tests reason="起始页大于结束页时没有交换"}
```ts file=range.ts
export function parseRange(text: string): [number, number] | null {
  const parts = text.split('-');
  if (parts.length !== 2) return null;
  const [left = '', right = ''] = parts;
  if (left.trim() === '' || right.trim() === '') return null;
  const start = Number(left);
  const end = Number(right);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < 0) return null;
  return [start, end];
}

export function overlap(a: readonly [number, number], b: readonly [number, number]): [number, number] | null {
  const start = Math.max(a[0], b[0]);
  const end = Math.min(a[1], b[1]);
  return start <= end ? [start, end] : null;
}
```
:::

:::variant{kind=wrong name=strict-overlap fails=tests reason="用 < 判断重叠，只有一页重叠时返回了 null"}
```ts file=range.ts
export function parseRange(text: string): [number, number] | null {
  const parts = text.split('-');
  if (parts.length !== 2) return null;
  const [left = '', right = ''] = parts;
  if (left.trim() === '' || right.trim() === '') return null;
  const start = Number(left);
  const end = Number(right);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < 0) return null;
  return start <= end ? [start, end] : [end, start];
}

export function overlap(a: readonly [number, number], b: readonly [number, number]): [number, number] | null {
  const start = Math.max(a[0], b[0]);
  const end = Math.min(a[1], b[1]);
  return start < end ? [start, end] : null;
}
```
:::
