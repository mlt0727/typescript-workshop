---
kind: task
title: 分页查询的默认值
---
`pageQuery(options)` 生成分页查询的参数文字，格式为 `q=关键字&page=页码&size=每页条数`。

- `page` 没有提供时默认为 `1`；
- `size` 没有提供时默认为 `20`；
- `size` 为 `0` 表示“只要总数，不要列表”，是合法的值，要原样保留。

例如 `pageQuery({ keyword: 'ts' })` 返回 `'q=ts&page=1&size=20'`，`pageQuery({ keyword: 'ts', size: 0 })` 返回 `'q=ts&page=1&size=0'`。

起始代码在没有提供 `page` 时生成了 `page=undefined`。用解构默认值修好它。

:::files{role=starter}
```ts file=query.ts
export function pageQuery(options: { keyword: string; page?: number; size?: number }): string {
  return `q=${options.keyword}&page=${options.page}&size=${options.size}`;
}

console.log(pageQuery({ keyword: 'ts' }));
```
:::

:::files{role=solution}
```ts file=query.ts
export function pageQuery(options: { keyword: string; page?: number; size?: number }): string {
  const { keyword, page = 1, size = 20 } = options;
  return `q=${keyword}&page=${page}&size=${size}`;
}

console.log(pageQuery({ keyword: 'ts' }));
```
:::

:::files{role=tests}
```ts file=query.test.ts
import { expect, test } from 'vitest';
import { pageQuery } from './query';

test('使用默认值', () => {
  expect(pageQuery({ keyword: 'ts' })).toBe('q=ts&page=1&size=20');
});

test('提供的值优先', () => {
  expect(pageQuery({ keyword: 'react', page: 3, size: 50 })).toBe('q=react&page=3&size=50');
});

test('只提供一部分', () => {
  expect(pageQuery({ keyword: 'ts', page: 2 })).toBe('q=ts&page=2&size=20');
});

test('size 为 0 是合法的值', () => {
  expect(pageQuery({ keyword: 'ts', size: 0 })).toBe('q=ts&page=1&size=0');
});

test('显式传入 undefined 也使用默认值', () => {
  expect(pageQuery({ keyword: 'ts', page: undefined })).toBe('q=ts&page=1&size=20');
});
```
:::

:::hint{level=1}
在函数开头用对象解构取出三个属性，并给 `page` 和 `size` 写上默认值。
:::

:::hint{level=2}
`const { keyword, page = 1, size = 20 } = options;`，然后在模板字符串里使用这三个变量。也可以直接在参数位置解构。
:::

:::explanation
解构默认值在属性值为 `undefined` 时生效：没有提供属性、或者显式传入 `undefined`，都会得到默认值。

`size` 为 `0` 时默认值**不会**生效，因为 `0` 不是 `undefined`，这正是规格要求的。如果写成 `options.size || 20`，`0` 是 falsy，会被错误地换成 `20`（a07、a08 讲过）。

`options.size ?? 20` 也是正确的写法：`??` 只在 `null` 和 `undefined` 时使用默认值。
:::

:::variant{kind=alt name=param-destructuring}
```ts file=query.ts
export function pageQuery({
  keyword,
  page = 1,
  size = 20,
}: {
  keyword: string;
  page?: number;
  size?: number;
}): string {
  return `q=${keyword}&page=${page}&size=${size}`;
}
```
:::

:::variant{kind=alt name=nullish}
```ts file=query.ts
export function pageQuery(options: { keyword: string; page?: number; size?: number }): string {
  const page = options.page ?? 1;
  const size = options.size ?? 20;
  return `q=${options.keyword}&page=${page}&size=${size}`;
}
```
:::

:::variant{kind=wrong name=or-default fails=tests reason="用 || 设默认值，size 为 0 时被换成了 20"}
```ts file=query.ts
export function pageQuery(options: { keyword: string; page?: number; size?: number }): string {
  const page = options.page || 1;
  const size = options.size || 20;
  return `q=${options.keyword}&page=${page}&size=${size}`;
}
```
:::

:::variant{kind=wrong name=no-defaults fails=tests reason="只做了解构，没有写默认值"}
```ts file=query.ts
export function pageQuery(options: { keyword: string; page?: number; size?: number }): string {
  const { keyword, page, size } = options;
  return `q=${keyword}&page=${page}&size=${size}`;
}
```
:::
