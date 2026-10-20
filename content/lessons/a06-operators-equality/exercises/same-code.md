---
kind: task
title: 比较商品编号
---
商品编号以**文字**为准：`'0042'` 和 `'42'` 是两个不同的商品。但有的接口把编号以数字给出（例如 `42`），这时按它的十进制文字 `'42'` 处理。

实现 `sameCode(a, b)`：两个编号代表同一个商品时返回 `true`。例如 `sameCode('42', 42)` 是 `true`，`sameCode('0042', 42)` 是 `false`，`sameCode(' 42', '42')` 也是 `false`（文字不同）。

:::files{role=starter}
```ts file=code.ts
export function sameCode(a: string | number, b: string | number): boolean {
  return a == b;
}

console.log(sameCode('42', 42), sameCode('0042', 42));
```
:::

:::files{role=solution}
```ts file=code.ts
export function sameCode(a: string | number, b: string | number): boolean {
  return String(a) === String(b);
}

console.log(sameCode('42', 42), sameCode('0042', 42));
```
:::

:::files{role=tests}
```ts file=code.test.ts
import { expect, test } from 'vitest';
import { sameCode } from './code';

test('同类型直接比较', () => {
  expect(sameCode('A100', 'A100')).toBe(true);
  expect(sameCode('A100', 'A101')).toBe(false);
  expect(sameCode(7, 7)).toBe(true);
});

test('数字按十进制文字处理', () => {
  expect(sameCode('42', 42)).toBe(true);
  expect(sameCode(42, '42')).toBe(true);
});

test('文字不同就是不同的商品', () => {
  expect(sameCode('0042', 42)).toBe(false);
  expect(sameCode(' 42', 42)).toBe(false);
  expect(sameCode('', 0)).toBe(false);
  expect(sameCode('4.20', 4.2)).toBe(false);
});
```
:::

:::hint{level=1}
起始代码的 `==` 会把字符串转换成数字再比较。规格要求按文字比较：先把两边都变成字符串。
:::

:::hint{level=2}
`return String(a) === String(b);`
:::

:::explanation
`==` 比较字符串和数字时，会把字符串转换成数字：`'0042'`、`' 42'` 都变成 `42`，`''` 变成 `0`，所以起始代码把不同的商品当成了同一个。

规格说编号以文字为准，那就把两边都**显式地**转换成字符串，再用 `===` 比较。`String(42)` 是 `'42'`，`String('0042')` 仍然是 `'0042'`。

改成 `a === b` 也不对：`'42' === 42` 是 `false`，不满足“数字按十进制文字处理”。
:::

:::variant{kind=alt name=template}
```ts file=code.ts
export function sameCode(a: string | number, b: string | number): boolean {
  return `${a}` === `${b}`;
}
```
:::

:::variant{kind=wrong name=strict-only fails=tests reason="只改成 ===，没有转换，'42' 和 42 不相等"}
```ts file=code.ts
export function sameCode(a: string | number, b: string | number): boolean {
  return a === b;
}
```
:::

:::variant{kind=wrong name=to-number fails=tests reason="转换成数字比较，'0042' 和 42 被当成同一个"}
```ts file=code.ts
export function sameCode(a: string | number, b: string | number): boolean {
  return Number(a) === Number(b);
}
```
:::
