---
kind: task
title: 判断输入是否为空
---
实现 `isBlank(text)`：`text` 是 `null`、`undefined`、空字符串，或者只包含空白字符（空格、制表符、换行）时，返回 `true`；否则返回 `false`。

注意 `'0'` 和 `'false'` 都是用户真实输入的内容，不算空。

:::files{role=starter}
```ts file=blank.ts
export function isBlank(text: string | null | undefined): boolean {
  return !text;
}

console.log(isBlank(''), isBlank('   '), isBlank('0'));
```
:::

:::files{role=solution}
```ts file=blank.ts
export function isBlank(text: string | null | undefined): boolean {
  return !text || text.trim() === '';
}

console.log(isBlank(''), isBlank('   '), isBlank('0'));
```
:::

:::files{role=tests}
```ts file=blank.test.ts
import { expect, test } from 'vitest';
import { isBlank } from './blank';

test('没有值', () => {
  expect(isBlank(null)).toBe(true);
  expect(isBlank(undefined)).toBe(true);
});

test('空字符串和只有空白字符', () => {
  expect(isBlank('')).toBe(true);
  expect(isBlank('   ')).toBe(true);
  expect(isBlank(' \t\n ')).toBe(true);
});

test('有内容', () => {
  expect(isBlank('Ada')).toBe(false);
  expect(isBlank('  Ada  ')).toBe(false);
});

test('看起来像“假”的文字也是内容', () => {
  expect(isBlank('0')).toBe(false);
  expect(isBlank('false')).toBe(false);
});
```
:::

:::hint{level=1}
`!text` 已经处理了 `null`、`undefined` 和空字符串，但 `'   '` 是 truthy。还需要再检查去掉空格后是不是空的。
:::

:::hint{level=2}
`return !text || text.trim() === '';`。`||` 的右边只在 `text` 是 truthy 时才会计算，TypeScript 知道这时 `text` 一定是 `string`。
:::

:::explanation
起始代码 `!text` 能识别 `null`、`undefined` 和 `''`（它们都是 falsy），但只有空格的字符串是 truthy，所以 `isBlank('   ')` 返回了 `false`。

参考答案利用了短路：`!text` 为真时直接返回 `true`；否则 `text` 一定是非空字符串（TypeScript 也会把它收窄为 `string`），这时再用 `trim()` 去掉首尾空格判断。

这里用真假检查是合适的：对文本输入来说，空字符串本来就应该算作“没有内容”。`'0'`、`'false'` 是非空字符串，都是 truthy，不会被误判。
:::

:::variant{kind=alt name=explicit-checks}
```ts file=blank.ts
export function isBlank(text: string | null | undefined): boolean {
  if (text === null || text === undefined) {
    return true;
  }
  return text.trim().length === 0;
}
```
:::

:::variant{kind=wrong name=trim-without-check fails=types reason="没有先排除 null 和 undefined 就调用 trim"}
```ts file=blank.ts
export function isBlank(text: string | null | undefined): boolean {
  return text.trim() === '';
}
```
:::

:::variant{kind=wrong name=only-null fails=types reason="只排除了 null，text 仍然可能是 undefined"}
```ts file=blank.ts
export function isBlank(text: string | null | undefined): boolean {
  if (text === null) {
    return true;
  }
  return text.trim() === '';
}
```
:::

:::variant{kind=wrong name=string-zero fails=tests reason="把 '0' 和 'false' 也当成了空"}
```ts file=blank.ts
export function isBlank(text: string | null | undefined): boolean {
  if (!text) {
    return true;
  }
  const trimmed = text.trim();
  return trimmed === '' || trimmed === '0' || trimmed === 'false';
}
```
:::
