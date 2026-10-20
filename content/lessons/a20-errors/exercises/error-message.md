---
kind: task
title: 从任意错误中取出说明
---
`catch` 到的值类型是 `unknown`。实现一个常用的小工具 `errorMessage(err)`，把它变成可以显示给用户的文字：

- `err` 是 `Error`（包括 `TypeError`、`RangeError` 等子类）时，返回它的 `message`；
- `err` 是字符串时，返回这个字符串本身；
- 其他情况（数字、`null`、普通对象……）返回 `'未知错误'`。

:::files{role=starter}
```ts file=message.ts
export function errorMessage(err: unknown): string {
  return err.message;
}

try {
  JSON.parse('{');
} catch (err) {
  console.log(errorMessage(err));
}
```
:::

:::files{role=solution}
```ts file=message.ts
export function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  return '未知错误';
}

try {
  JSON.parse('{');
} catch (err) {
  console.log(errorMessage(err));
}
```
:::

:::files{role=tests}
```ts file=message.test.ts
import { expect, test } from 'vitest';
import { errorMessage } from './message';

test('Error 及其子类', () => {
  expect(errorMessage(new Error('出错了'))).toBe('出错了');
  expect(errorMessage(new RangeError('超出范围'))).toBe('超出范围');
});

test('字符串原样返回', () => {
  expect(errorMessage('网络断开')).toBe('网络断开');
});

test('其他值', () => {
  expect(errorMessage(42)).toBe('未知错误');
  expect(errorMessage(null)).toBe('未知错误');
  expect(errorMessage(undefined)).toBe('未知错误');
  expect(errorMessage({ message: '伪装成错误的对象' })).toBe('未知错误');
});
```
:::

:::hint{level=1}
`unknown` 类型的值必须先检查才能使用。用 `instanceof Error` 判断是不是错误对象，用 a02 的 `typeof` 判断是不是字符串。
:::

:::hint{level=2}
`if (err instanceof Error) { return err.message; }`，然后 `if (typeof err === 'string') { return err; }`，最后返回 `'未知错误'`。
:::

:::explanation
`unknown` 表示“可能是任何值，使用前必须检查”。`err instanceof Error` 为真时，TypeScript 把 `err` 收窄为 `Error`，于是可以读取 `message`；`RangeError` 等子类也是 `Error`，同样满足。`typeof err === 'string'` 把它收窄为 `string`。

测试里的 `{ message: '…' }` 有 `message` 属性，但不是 `Error`。按规格它应该返回“未知错误”，`instanceof` 检查正好做到了这一点。

不要写 `(err as Error).message`：那只是让编译器闭嘴，`err` 是 `null` 时运行时会抛出 `TypeError`。
:::

:::variant{kind=alt name=ternaries}
```ts file=message.ts
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : typeof err === 'string' ? err : '未知错误';
}
```
:::

:::variant{kind=wrong name=assertion fails=rules reason="用类型断言假装 err 是 Error"}
```ts file=message.ts
export function errorMessage(err: unknown): string {
  return (err as Error).message ?? '未知错误';
}
```
:::

:::variant{kind=wrong name=string-convert fails=tests reason="用 String(err) 转换，Error 会变成 'Error: 出错了'"}
```ts file=message.ts
export function errorMessage(err: unknown): string {
  if (err === null || err === undefined || typeof err === 'number') {
    return '未知错误';
  }
  return String(err);
}
```
:::

:::variant{kind=wrong name=forget-string fails=tests reason="没有处理被抛出的字符串"}
```ts file=message.ts
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : '未知错误';
}
```
:::
