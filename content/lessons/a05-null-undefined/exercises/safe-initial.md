---
kind: task
title: 安全地取首字母
---
`initial(name)` 返回名字的第一个字符（转成大写）；名字是空字符串时返回 `'?'`。

例如 `initial('ada')` 返回 `'A'`，`initial('')` 返回 `'?'`。起始代码用 `name.at(0)` 取第一个字符，但 TypeScript 报错了：`at` 的返回类型是 `string | undefined`。先检查，再使用。

:::files{role=starter}
```ts file=initial.ts
export function initial(name: string): string {
  const first = name.at(0);
  return first.toUpperCase();
}

console.log(initial('ada'), initial(''));
```
:::

:::files{role=solution}
```ts file=initial.ts
export function initial(name: string): string {
  const first = name.at(0);
  if (first === undefined) {
    return '?';
  }
  return first.toUpperCase();
}

console.log(initial('ada'), initial(''));
```
:::

:::files{role=tests}
```ts file=initial.test.ts
import { expect, test } from 'vitest';
import { initial } from './initial';

test('返回大写的首字母', () => {
  expect(initial('ada')).toBe('A');
  expect(initial('Grace')).toBe('G');
});

test('汉字原样返回', () => {
  expect(initial('张三')).toBe('张');
});

test('空字符串返回问号', () => {
  expect(initial('')).toBe('?');
});
```
:::

:::hint{level=1}
把鼠标停在 `first` 上，看它的类型。`undefined` 的情况要先单独处理。
:::

:::hint{level=2}
在 `return first.toUpperCase();` 之前加上 `if (first === undefined) { return '?'; }`。
:::

:::explanation
`name.at(0)` 在空字符串上返回 `undefined`，所以它的类型是 `string | undefined`。在 `if (first === undefined) { return '?'; }` 之后，TypeScript 知道 `first` 只可能是 `string`，于是允许调用 `toUpperCase()`。

不能写成 `first!.toUpperCase()`：`!` 只是让编译器闭嘴，空字符串时运行时仍然会抛出 `TypeError`。也不要用 `String(first)`：`undefined` 会变成字符串 `'undefined'`，首字母成了 `'U'`。
:::

:::variant{kind=alt name=check-length}
```ts file=initial.ts
export function initial(name: string): string {
  if (name.length === 0) {
    return '?';
  }
  return name.slice(0, 1).toUpperCase();
}
```
:::

:::variant{kind=wrong name=check-null fails=types reason="at 返回的是 undefined 而不是 null，检查 === null 没有排除 undefined"}
```ts file=initial.ts
export function initial(name: string): string {
  const first = name.at(0);
  if (first === null) {
    return '?';
  }
  return first.toUpperCase();
}
```
:::

:::variant{kind=wrong name=non-null fails=rules reason="用非空断言让错误消失"}
```ts file=initial.ts
export function initial(name: string): string {
  const first = name.at(0);
  return first!.toUpperCase();
}
```
:::

:::variant{kind=wrong name=string-convert fails=tests reason="String(undefined) 是 'undefined'，空字符串时返回了 'U'"}
```ts file=initial.ts
export function initial(name: string): string {
  const first = String(name.at(0));
  return first.slice(0, 1).toUpperCase();
}
```
:::
