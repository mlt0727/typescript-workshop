---
kind: task
title: 通用的分组函数
---
`groupBy(items, keyOf)` 把数组按 `keyOf(元素)` 的结果分组，返回 `Map<string, 元素数组>`；每组内保持原来的顺序，Map 中键的顺序是第一次出现的顺序。

起始代码用了 `any`，返回的分组失去了元素类型。把它改成泛型函数：传入 `User[]` 时，返回 `Map<string, User[]>`；传入 `number[]` 时，返回 `Map<string, number[]>`。

（a18 介绍过内置的 `Map.groupBy`，这一题自己实现一个，练习泛型。）

:::files{role=starter}
```ts file=group.ts
export function groupBy(items: any[], keyOf: (item: any) => string): Map<string, any[]> {
  const groups = new Map<string, any[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}
```
:::

:::files{role=solution}
```ts file=group.ts
export function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}
```
:::

:::files{role=tests}
```ts file=group.test.ts
import { expect, test } from 'vitest';
import { groupBy } from './group';

test('按城市分组', () => {
  const users = [
    { name: 'Ada', city: '伦敦' },
    { name: 'Grace', city: '纽约' },
    { name: 'Alan', city: '伦敦' },
  ];
  const groups = groupBy(users, (u) => u.city);
  expect([...groups.keys()]).toEqual(['伦敦', '纽约']);
  expect(groups.get('伦敦')?.map((u) => u.name)).toEqual(['Ada', 'Alan']);
});

test('数字按奇偶分组', () => {
  const groups = groupBy([1, 2, 3, 4, 5], (n) => (n % 2 === 0 ? '偶' : '奇'));
  expect(groups.get('奇')).toEqual([1, 3, 5]);
  expect(groups.get('偶')).toEqual([2, 4]);
});

test('空数组', () => {
  expect(groupBy([], () => 'x').size).toBe(0);
});
```
```ts file=group.test-d.ts
import { expectTypeOf } from 'vitest';
import { groupBy } from './group';

type User = { name: string; city: string };
declare const users: User[];

expectTypeOf(groupBy(users, (u) => u.city)).toEqualTypeOf<Map<string, User[]>>();
expectTypeOf(groupBy([1, 2], (n) => String(n))).toEqualTypeOf<Map<string, number[]>>();

// 回调的参数类型由数组推断出来
groupBy(users, (u) => {
  expectTypeOf(u).toEqualTypeOf<User>();
  return u.name;
});
```
:::

:::hint{level=1}
在函数名后面声明类型参数 `<T>`，然后把所有的 `any` 换成 `T`：元素是 `T`，回调接收 `T`，结果是 `Map<string, T[]>`。
:::

:::hint{level=2}
签名写成 `groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]>`，函数体里 `new Map<string, T[]>()`。
:::

:::explanation
类型参数 `T` 出现在三个位置：数组的元素、回调的参数、结果中的数组元素。它把这三者联系在一起：调用时 TypeScript 从 `items` 推断出 `T`，于是回调的参数 `u` 自动有了类型（不用写注解），结果也是 `Map<string, User[]>`。

参数写成 `readonly T[]`，说明函数不会修改传入的数组，同时也能接收只读数组。
:::

:::variant{kind=alt name=reduce-version}
```ts file=group.ts
export function groupBy<TItem>(items: readonly TItem[], keyOf: (item: TItem) => string): Map<string, TItem[]> {
  return items.reduce((groups, item) => {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
    return groups;
  }, new Map<string, TItem[]>());
}
```
:::

:::variant{kind=wrong name=keep-any fails=rules reason="仍然使用 any"}
```ts file=group.ts
export function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, any[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}
```
:::

:::variant{kind=wrong name=unknown-instead fails=types reason="用 unknown 代替泛型，返回的分组失去了元素类型"}
```ts file=group.ts
export function groupBy(items: readonly unknown[], keyOf: (item: unknown) => string): Map<string, unknown[]> {
  const groups = new Map<string, unknown[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}
```
:::
