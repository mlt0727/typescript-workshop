---
kind: task
title: 取第一项
---
`first(value)` 有两种用法：

- 传入字符串：返回第一个字符；空字符串返回 `''`。返回类型是 `string`。
- 传入数字数组：返回第一个元素；空数组返回 `undefined`。返回类型是 `number | undefined`。

起始代码只有一个签名，调用方拿到的类型是 `string | number | undefined`，每次都要自己判断。用重载签名让两种调用分别得到准确的返回类型。

:::files{role=starter}
```ts file=first.ts
export function first(value: string | number[]): string | number | undefined {
  if (typeof value === 'string') {
    return value.slice(0, 1);
  }
  return value[0];
}
```
:::

:::files{role=solution}
```ts file=first.ts
export function first(value: string): string;
export function first(value: number[]): number | undefined;
export function first(value: string | number[]): string | number | undefined {
  if (typeof value === 'string') {
    return value.slice(0, 1);
  }
  return value[0];
}
```
:::

:::files{role=tests}
```ts file=first.test.ts
import { expect, test } from 'vitest';
import { first } from './first';

test('字符串', () => {
  expect(first('abc')).toBe('a');
  expect(first('')).toBe('');
});

test('数组', () => {
  expect(first([7, 8])).toBe(7);
  expect(first([])).toBeUndefined();
});
```
```ts file=first.test-d.ts
import { expectTypeOf } from 'vitest';
import { first } from './first';

expectTypeOf(first('abc')).toEqualTypeOf<string>();
expectTypeOf(first([1, 2])).toEqualTypeOf<number | undefined>();
```
:::

:::hint{level=1}
在实现之前加两行重载签名：一行接收 `string`、返回 `string`；一行接收 `number[]`、返回 `number | undefined`。两行都要 `export`。
:::

:::hint{level=2}
```ts
export function first(value: string): string;
export function first(value: number[]): number | undefined;
export function first(value: string | number[]): string | number | undefined {
  // 原来的实现
}
```
:::

:::explanation
重载签名把“传字符串得到字符串、传数组得到数字或 undefined”这件事告诉了调用方。实现签名保持原样：它对外不可见，只需要兼容两个重载签名即可。

`value.slice(0, 1)` 在空字符串上返回 `''`，所以字符串版本的返回类型可以是 `string`；数组的 `value[0]` 在本平台是 `number | undefined`（a10），正好对应第二个签名。
:::

:::variant{kind=alt name=separate-branches}
```ts file=first.ts
export function first(value: string): string;
export function first(value: number[]): number | undefined;
export function first(value: string | number[]) {
  if (Array.isArray(value)) {
    return value.length > 0 ? value[0] : undefined;
  }
  return value.charAt(0);
}
```
:::

:::variant{kind=wrong name=no-overloads fails=types reason="没有重载签名，返回类型仍然是联合"}
```ts file=first.ts
export function first(value: string | number[]): string | number | undefined {
  if (typeof value === 'string') {
    return value.charAt(0);
  }
  return value[0];
}
```
:::

:::variant{kind=wrong name=wrong-return fails=types reason="字符串版本的返回类型写成了 string | undefined"}
```ts file=first.ts
export function first(value: string): string | undefined;
export function first(value: number[]): number | undefined;
export function first(value: string | number[]): string | number | undefined {
  if (typeof value === 'string') {
    return value.at(0);
  }
  return value[0];
}
```
:::

:::variant{kind=wrong name=empty-string-undefined fails=tests reason="空字符串返回了 undefined"}
```ts file=first.ts
export function first(value: string): string;
export function first(value: number[]): number | undefined;
export function first(value: string | number[]): string | number | undefined {
  if (typeof value === 'string') {
    return value.at(0);
  }
  return value[0];
}
```
:::
