---
kind: task
title: 用 typeof 区分字符串和数字
---
参数 `value` 可能是字符串，也可能是数字（`string | number` 读作“字符串或数字”，这种**联合类型**在 B 阶段详讲）。实现 `describeValue`：

- 字符串：返回 `字符串，长度 N`，`N` 是字符串长度（`value.length`）；
- 数字：返回 `数字，两倍是 N`，`N` 是 `value * 2`。

例如 `describeValue('abc')` 返回 `'字符串，长度 3'`，`describeValue(21)` 返回 `'数字，两倍是 42'`。可以用 `+` 拼接字符串，例如 `'长度 ' + 3`。

:::files{role=starter}
```ts file=describe.ts
export function describeValue(value: string | number): string {
  return '字符串，长度 ' + value.length;
}

console.log(describeValue('abc'), describeValue(21));
```
:::

:::files{role=solution}
```ts file=describe.ts
export function describeValue(value: string | number): string {
  if (typeof value === 'string') {
    return '字符串，长度 ' + value.length;
  }
  return '数字，两倍是 ' + value * 2;
}

console.log(describeValue('abc'), describeValue(21));
```
:::

:::files{role=tests}
```ts file=describe.test.ts
import { expect, test } from 'vitest';
import { describeValue } from './describe';

test('字符串', () => {
  expect(describeValue('abc')).toBe('字符串，长度 3');
  expect(describeValue('')).toBe('字符串，长度 0');
});

test('数字', () => {
  expect(describeValue(21)).toBe('数字，两倍是 42');
  expect(describeValue(0)).toBe('数字，两倍是 0');
  expect(describeValue(-1.5)).toBe('数字，两倍是 -3');
});

test('数字形式的字符串仍然按字符串处理', () => {
  expect(describeValue('42')).toBe('字符串，长度 2');
});
```
:::

:::hint{level=1}
起始代码报错：`number` 上没有 `length`。先用运行时的 `typeof` 判断 `value` 是不是字符串，在判断成立的分支里再使用 `value.length`。
:::

:::hint{level=2}
`if (typeof value === 'string') { return '字符串，长度 ' + value.length; }`，分支外面剩下的情况只能是数字。
:::

:::explanation
`typeof value === 'string'` 是 JavaScript 的运行时检查。TypeScript 能理解它：在 `if` 分支里，`value` 的类型被收窄为 `string`，可以使用 `.length`；`if` 之后（分支里已经 `return`），剩下的情况只可能是 `number`，所以可以做乘法。

注意 `'42'` 是字符串，`typeof` 检查的是值的实际类型，不会因为内容像数字就当作数字。
:::

:::variant{kind=alt name=check-number-first}
```ts file=describe.ts
export function describeValue(value: string | number): string {
  if (typeof value === 'number') {
    return '数字，两倍是 ' + value * 2;
  } else {
    return '字符串，长度 ' + value.length;
  }
}
```
:::

:::variant{kind=wrong name=no-check fails=types reason="没有先判断类型就使用 .length"}
```ts file=describe.ts
export function describeValue(value: string | number): string {
  if (value.length > 0) {
    return '字符串，长度 ' + value.length;
  }
  return '数字，两倍是 ' + value * 2;
}
```
:::

:::variant{kind=wrong name=coerce-to-number fails=tests reason="用 Number() 把数字形式的字符串也当成数字"}
```ts file=describe.ts
export function describeValue(value: string | number): string {
  if (typeof value === 'number' || !Number.isNaN(Number(value))) {
    return '数字，两倍是 ' + Number(value) * 2;
  }
  return '字符串，长度 ' + value.length;
}
```
:::
