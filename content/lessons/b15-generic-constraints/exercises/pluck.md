---
kind: task
title: 取出某一列
---
`pluck(items, key)` 从对象数组中取出某个属性组成的新数组，例如 `pluck(users, 'name')` 得到所有用户名。

要求类型准确：`key` 只能是元素类型的键；返回数组的元素类型就是这个键对应的值类型。例如 `pluck(users, 'age')` 的类型是 `number[]`，`pluck(users, 'email')` 应当报错（如果用户类型里没有 `email`）。

:::files{role=starter}
```ts file=pluck.ts
export function pluck<T>(items: readonly T[], key: string): unknown[] {
  return items.map((item) => item[key]);
}
```
:::

:::files{role=solution}
```ts file=pluck.ts
export function pluck<T, K extends keyof T>(items: readonly T[], key: K): T[K][] {
  return items.map((item) => item[key]);
}
```
:::

:::files{role=tests}
```ts file=pluck.test.ts
import { expect, test } from 'vitest';
import { pluck } from './pluck';

const users = [
  { name: 'Ada', age: 36 },
  { name: 'Grace', age: 85 },
];

test('取出一列', () => {
  expect(pluck(users, 'name')).toEqual(['Ada', 'Grace']);
  expect(pluck(users, 'age')).toEqual([36, 85]);
});

test('空数组', () => {
  expect(pluck([], 'length')).toEqual([]);
});
```
```ts file=pluck.test-d.ts
import { expectTypeOf } from 'vitest';
import { pluck } from './pluck';

type User = { name: string; age: number };
declare const users: User[];

expectTypeOf(pluck(users, 'name')).toEqualTypeOf<string[]>();
expectTypeOf(pluck(users, 'age')).toEqualTypeOf<number[]>();

// @ts-expect-error User 没有 email
pluck(users, 'email');
```
:::

:::hint{level=1}
再加一个类型参数 `K`，约束为 `keyof T`，让 `key` 的类型是 `K`。返回数组的元素类型用索引访问类型 `T[K]` 表示。
:::

:::hint{level=2}
`export function pluck<T, K extends keyof T>(items: readonly T[], key: K): T[K][]`。函数体不用改。
:::

:::explanation
`K extends keyof T` 把 `key` 限制为元素类型的某个键：传入 `'email'` 时，TypeScript 发现它不在 `keyof User` 里，直接报错。返回类型 `T[K][]` 读作“`T` 中键 `K` 对应的类型，组成的数组”：`K` 是 `'age'` 时就是 `number[]`。

起始代码的 `item[key]` 本身就会报错：`key` 是任意字符串，TypeScript 无法确定它是 `T` 的键（a11、b01 讲过的 TS7053）。加上约束后，这个访问就是安全的。

注意 `T[K][]` 是“`T[K]` 的数组”；写成 `T[K[]]` 会报错（TS2536：数组类型不能用来索引 `T`）。也可以写成 `Array<T[K]>`，更不容易看错。
:::

:::variant{kind=alt name=array-generic}
```ts file=pluck.ts
export function pluck<Item, Key extends keyof Item>(items: readonly Item[], key: Key): Array<Item[Key]> {
  const result: Array<Item[Key]> = [];
  for (const item of items) {
    result.push(item[key]);
  }
  return result;
}
```
:::

:::variant{kind=wrong name=keyof-without-k fails=types reason="没有单独的类型参数 K，返回类型是所有值类型的联合，和传入的键无关"}
```ts file=pluck.ts
export function pluck<T>(items: readonly T[], key: keyof T): T[keyof T][] {
  return items.map((item) => item[key]);
}
```
:::

:::variant{kind=wrong name=unknown-result fails=types reason="返回 unknown[]，调用方拿不到具体的类型"}
```ts file=pluck.ts
export function pluck<T, K extends keyof T>(items: readonly T[], key: K): unknown[] {
  return items.map((item) => item[key]);
}
```
:::
