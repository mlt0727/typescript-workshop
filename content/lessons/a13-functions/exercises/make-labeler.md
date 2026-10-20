---
kind: challenge
title: 生成标签函数
---
实现 `makeLabeler(prefix, options)`：它不直接返回文字，而是**返回一个函数**。返回的函数接收一个字符串 `value`，返回 `前缀 + 分隔符 + 值` 的文字。

`options` 是可选的选项对象：

- `separator`：分隔符，默认是 `': '`（冒号加一个空格）；
- `uppercase`：为 `true` 时把**值**（不包括前缀）转成大写，默认是 `false`。

例如：

```ts
const idLabel = makeLabeler('ID');
idLabel('a1');                                       // 'ID: a1'
makeLabeler('ID', { separator: '#' })('a1');         // 'ID#a1'
makeLabeler('code', { uppercase: true })('a1');      // 'code: A1'
```

调用时可以不传 `options`，也可以只传其中一项。

:::files{role=starter}
```ts file=labeler.ts
export function makeLabeler(
  prefix: string,
  options: { separator?: string; uppercase?: boolean },
): (value: string) => string {
  return (value) => prefix + value;
}

const idLabel = makeLabeler('ID', {});
console.log(idLabel('a1'));
```
:::

:::files{role=solution}
```ts file=labeler.ts
export function makeLabeler(
  prefix: string,
  { separator = ': ', uppercase = false }: { separator?: string; uppercase?: boolean } = {},
): (value: string) => string {
  return (value) => {
    const shown = uppercase ? value.toUpperCase() : value;
    return `${prefix}${separator}${shown}`;
  };
}

const idLabel = makeLabeler('ID');
console.log(idLabel('a1'));
```
:::

:::files{role=tests}
```ts file=labeler.test.ts
import { describe, expect, test } from 'vitest';
import { makeLabeler } from './labeler';

describe('makeLabeler', () => {
  test('不传选项时使用默认值', () => {
    const idLabel = makeLabeler('ID');
    expect(idLabel('a1')).toBe('ID: a1');
    expect(idLabel('b2')).toBe('ID: b2');
  });

  test('自定义分隔符', () => {
    expect(makeLabeler('ID', { separator: '#' })('a1')).toBe('ID#a1');
    expect(makeLabeler('ID', { separator: '' })('a1')).toBe('IDa1');
  });

  test('只把值转成大写', () => {
    expect(makeLabeler('code', { uppercase: true })('a1')).toBe('code: A1');
  });

  test('两个选项一起使用', () => {
    expect(makeLabeler('code', { uppercase: true, separator: ' = ' })('x')).toBe('code = X');
  });

  test('传入空的选项对象', () => {
    expect(makeLabeler('ID', {})('a1')).toBe('ID: a1');
  });
});
```
```ts file=labeler.test-d.ts
import { expectTypeOf } from 'vitest';
import { makeLabeler } from './labeler';

expectTypeOf(makeLabeler('ID')).toEqualTypeOf<(value: string) => string>();
expectTypeOf(makeLabeler).toBeCallableWith('ID');
expectTypeOf(makeLabeler).toBeCallableWith('ID', { uppercase: true });
```
:::

:::hint{level=1}
要让 `options` 可以不传，给它一个默认值 `= {}`。然后用解构默认值（a12）给 `separator` 和 `uppercase` 设默认值。返回的箭头函数可以直接使用这些变量。
:::

:::hint{level=2}
参数可以写成 `{ separator = ': ', uppercase = false }: { separator?: string; uppercase?: boolean } = {}`：先解构、带默认值，类型写在解构模式后面，最后的 `= {}` 是整个参数的默认值。返回 `(value) => …`，在里面根据 `uppercase` 决定是否调用 `value.toUpperCase()`。
:::

:::explanation
参数 `{ … } = {}` 有两层默认值：不传第二个参数时，整个参数默认为 `{}`；然后对这个对象解构，`separator`、`uppercase` 没有提供时各自使用默认值。缺少 `= {}` 的话，`makeLabeler('ID')` 会被 TypeScript 拒绝（参数个数不够），运行时解构 `undefined` 也会抛出 `TypeError`。

返回值的类型 `(value: string) => string` 是一个函数类型。返回的箭头函数没有写 `value` 的类型，TypeScript 根据声明的返回类型推断出它是 `string`（上下文类型）。

返回的函数在之后被调用时，仍然能使用 `prefix`、`separator`、`uppercase`，即使 `makeLabeler` 早已执行完毕。这叫**闭包**，下一课详细讲。

分隔符为空字符串 `''` 时要原样使用，解构默认值只在 `undefined` 时生效，所以不会被替换成 `': '`。
:::

:::variant{kind=alt name=options-object}
```ts file=labeler.ts
export function makeLabeler(
  prefix: string,
  options: { separator?: string; uppercase?: boolean } = {},
): (value: string) => string {
  const separator = options.separator ?? ': ';
  const uppercase = options.uppercase ?? false;
  return function (value: string): string {
    return prefix + separator + (uppercase ? value.toUpperCase() : value);
  };
}
```
:::

:::variant{kind=wrong name=required-options fails=types reason="options 没有默认值，不能只传一个参数调用"}
```ts file=labeler.ts
export function makeLabeler(
  prefix: string,
  { separator = ': ', uppercase = false }: { separator?: string; uppercase?: boolean },
): (value: string) => string {
  return (value) => `${prefix}${separator}${uppercase ? value.toUpperCase() : value}`;
}
```
:::

:::variant{kind=wrong name=upper-prefix fails=tests reason="把前缀也转成了大写"}
```ts file=labeler.ts
export function makeLabeler(
  prefix: string,
  { separator = ': ', uppercase = false }: { separator?: string; uppercase?: boolean } = {},
): (value: string) => string {
  return (value) => {
    const text = `${prefix}${separator}${value}`;
    return uppercase ? text.toUpperCase() : text;
  };
}
```
:::

:::variant{kind=wrong name=or-separator fails=tests reason="用 || 设默认值，空字符串分隔符被换成了 ': '"}
```ts file=labeler.ts
export function makeLabeler(
  prefix: string,
  options: { separator?: string; uppercase?: boolean } = {},
): (value: string) => string {
  const separator = options.separator || ': ';
  return (value) => `${prefix}${separator}${options.uppercase ? value.toUpperCase() : value}`;
}
```
:::

:::variant{kind=wrong name=returns-string fails=types reason="直接返回了文字，而不是返回一个函数"}
```ts file=labeler.ts
export function makeLabeler(
  prefix: string,
  { separator = ': ' }: { separator?: string; uppercase?: boolean } = {},
): string {
  return `${prefix}${separator}`;
}
```
:::
