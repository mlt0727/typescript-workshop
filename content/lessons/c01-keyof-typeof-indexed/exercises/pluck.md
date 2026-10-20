---
kind: task
title: 取出一列与按键计数
---
在 `collection.ts` 中实现两个泛型函数，参数和返回值的类型都要随传入的键变化：

1. **`pluck(items, key)`**：返回每一项的 `key` 属性组成的新数组。例如对用户数组 `pluck(users, 'age')` 的返回值类型是 `number[]`，`pluck(users, 'tags')` 是 `string[][]`；传入不存在的键要在编译期报错。
2. **`countBy(items, key)`**：统计 `key` 属性的每一个值出现了几次，返回 `Map`，键是这个属性的值（类型同样随 `key` 变化），值是次数；`Map` 中键的顺序是第一次出现的顺序。

两个函数都不能修改传入的数组。

:::files{role=starter}
```ts file=collection.ts
/** 返回每一项的 key 属性组成的新数组 */
export function pluck(items: readonly object[], key: string): unknown[] {
  return [];
}

/** 统计 key 属性的每一个值出现了几次 */
export function countBy(items: readonly object[], key: string): Map<unknown, number> {
  return new Map();
}
```
```ts file=main.ts
import { countBy, pluck } from './collection';

const users = [
  { name: 'Ada', age: 36, role: 'admin', tags: ['math'] },
  { name: 'Lin', age: 28, role: 'editor', tags: [] },
  { name: 'Bo', age: 36, role: 'editor', tags: ['ops', 'db'] },
];

console.log(pluck(users, 'name'));
console.log(countBy(users, 'role'));
console.log(countBy(users, 'age'));
```
:::

:::files{role=solution}
```ts file=collection.ts
/** 返回每一项的 key 属性组成的新数组 */
export function pluck<T, K extends keyof T>(items: readonly T[], key: K): T[K][] {
  return items.map((item) => item[key]);
}

/** 统计 key 属性的每一个值出现了几次 */
export function countBy<T, K extends keyof T>(items: readonly T[], key: K): Map<T[K], number> {
  const counts = new Map<T[K], number>();
  for (const item of items) {
    const value = item[key];
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}
```
```ts file=main.ts
import { countBy, pluck } from './collection';

const users = [
  { name: 'Ada', age: 36, role: 'admin', tags: ['math'] },
  { name: 'Lin', age: 28, role: 'editor', tags: [] },
  { name: 'Bo', age: 36, role: 'editor', tags: ['ops', 'db'] },
];

console.log(pluck(users, 'name'));
console.log(countBy(users, 'role'));
console.log(countBy(users, 'age'));
```
:::

:::files{role=tests}
```ts file=collection.test.ts
import { describe, expect, test } from 'vitest';
import { countBy, pluck } from './collection';

const users = [
  { name: 'Ada', age: 36, role: 'admin' },
  { name: 'Lin', age: 28, role: 'editor' },
  { name: 'Bo', age: 36, role: 'editor' },
  { name: 'Mo', age: 41, role: 'viewer' },
];

describe('pluck', () => {
  test('按顺序取出每一项的属性', () => {
    expect(pluck(users, 'name')).toEqual(['Ada', 'Lin', 'Bo', 'Mo']);
    expect(pluck(users, 'age')).toEqual([36, 28, 36, 41]);
  });

  test('空数组得到空数组；不修改原数组', () => {
    expect(pluck([], 'length')).toEqual([]);
    const copy = [...users];
    pluck(users, 'role');
    expect(users).toEqual(copy);
  });
});

describe('countBy', () => {
  test('统计每个值出现的次数，按第一次出现的顺序', () => {
    expect([...countBy(users, 'role')]).toEqual([
      ['admin', 1],
      ['editor', 2],
      ['viewer', 1],
    ]);
    expect([...countBy(users, 'age')]).toEqual([
      [36, 2],
      [28, 1],
      [41, 1],
    ]);
  });

  test('值按 Map 的规则比较：1 和 "1" 是不同的键', () => {
    const items = [{ v: 1 }, { v: '1' }, { v: 1 }];
    expect([...countBy(items, 'v')]).toEqual([
      [1, 2],
      ['1', 1],
    ]);
  });

  test('空数组得到空的 Map', () => {
    expect(countBy([], 'length').size).toBe(0);
  });
});
```
```ts file=collection.test-d.ts
import { expectTypeOf } from 'vitest';
import { countBy, pluck } from './collection';

const users = [
  { name: 'Ada', age: 36, tags: ['math'] },
  { name: 'Lin', age: 28, tags: [] },
];

expectTypeOf(pluck(users, 'age')).toEqualTypeOf<number[]>();
expectTypeOf(pluck(users, 'tags')).toEqualTypeOf<string[][]>();
expectTypeOf(countBy(users, 'name')).toEqualTypeOf<Map<string, number>>();

// @ts-expect-error 不存在的键
pluck(users, 'emial');
// @ts-expect-error 不存在的键
countBy(users, 'email');
```
:::

:::hint{level=1}
两个函数都需要两个类型参数：数组元素的类型 `T`，以及键 `K extends keyof T`。这样 `item[key]` 的类型就是 `T[K]`，返回值写成 `T[K][]` 和 `Map<T[K], number>`。
:::

:::hint{level=2}
`pluck` 用 `items.map((item) => item[key])`。`countBy` 新建一个 `new Map<T[K], number>()`，遍历时 `counts.set(value, (counts.get(value) ?? 0) + 1)`：`get` 在没有这个键时返回 `undefined`，`?? 0` 把它当作 0（a08）。
:::

:::explanation
起始代码的参数是 `object` 和 `string`，返回 `unknown[]`：函数能写，但调用方什么类型信息都得不到。把 `key` 的类型写成 `K extends keyof T`，有两个效果：

- 传入不存在的键会在**调用处**报错，而不是运行时得到一列 `undefined`；
- 返回值的类型 `T[K]` 跟着 `K` 走：同一个函数，传 `'age'` 返回 `number[]`，传 `'tags'` 返回 `string[][]`。

如果只写一个类型参数、把键写成 `key: keyof T`，返回值就只能是 `T[keyof T][]`，也就是所有属性类型的联合组成的数组，`pluck(users, 'age')` 的类型会变成 `(string | number | string[])[]`。判断一个类型参数是否“有用”的标准是：它至少把两个位置（这里是参数 `key` 和返回值）联系了起来（c08 会再讲）。

`Map` 的键按 SameValueZero 比较：`1` 和 `'1'` 是两个不同的键，`NaN` 等于 `NaN`。这正是 `countBy` 想要的：值是什么类型，就按那个类型区分（a18）。
:::

:::variant{kind=alt name=reduce}
```ts file=collection.ts
export function pluck<T, K extends keyof T>(items: readonly T[], key: K): T[K][] {
  const result: T[K][] = [];
  for (const item of items) result.push(item[key]);
  return result;
}

export function countBy<T, K extends keyof T>(items: readonly T[], key: K): Map<T[K], number> {
  return items.reduce((counts, item) => counts.set(item[key], (counts.get(item[key]) ?? 0) + 1), new Map<T[K], number>());
}
```
:::

:::variant{kind=wrong name=key-without-generic fails=types reason="键的类型写成 keyof T，返回值成了所有属性类型的联合"}
```ts file=collection.ts
export function pluck<T>(items: readonly T[], key: keyof T): T[keyof T][] {
  return items.map((item) => item[key]);
}

export function countBy<T>(items: readonly T[], key: keyof T): Map<T[keyof T], number> {
  const counts = new Map<T[keyof T], number>();
  for (const item of items) {
    const value = item[key];
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}
```
:::

:::variant{kind=wrong name=string-key fails=types reason="键写成 string：不存在的键不报错，返回值都是 unknown"}
```ts file=collection.ts
/** 返回每一项的 key 属性组成的新数组 */
export function pluck(items: readonly Record<string, unknown>[], key: string): unknown[] {
  return items.map((item) => item[key]);
}

/** 统计 key 属性的每一个值出现了几次 */
export function countBy(items: readonly Record<string, unknown>[], key: string): Map<unknown, number> {
  const counts = new Map<unknown, number>();
  for (const item of items) counts.set(item[key], (counts.get(item[key]) ?? 0) + 1);
  return counts;
}
```
:::

:::variant{kind=wrong name=count-from-one fails=tests reason="第一次出现时记成了 0 次"}
```ts file=collection.ts
export function pluck<T, K extends keyof T>(items: readonly T[], key: K): T[K][] {
  return items.map((item) => item[key]);
}

export function countBy<T, K extends keyof T>(items: readonly T[], key: K): Map<T[K], number> {
  const counts = new Map<T[K], number>();
  for (const item of items) {
    const value = item[key];
    const before = counts.get(value);
    counts.set(value, before === undefined ? 0 : before + 1);
  }
  return counts;
}
```
:::

:::variant{kind=wrong name=string-keys fails=tests reason="用对象记录次数，数字和字符串的值被当成了同一个键"}
```ts file=collection.ts
export function pluck<T, K extends keyof T>(items: readonly T[], key: K): T[K][] {
  return items.map((item) => item[key]);
}

export function countBy<T, K extends keyof T>(items: readonly T[], key: K): Map<T[K], number> {
  const seen: Record<string, { value: T[K]; count: number }> = {};
  const order: string[] = [];
  for (const item of items) {
    const name = String(item[key]);
    const entry = seen[name];
    if (entry === undefined) {
      seen[name] = { value: item[key], count: 1 };
      order.push(name);
    } else {
      entry.count += 1;
    }
  }
  const counts = new Map<T[K], number>();
  for (const name of order) {
    const entry = seen[name];
    if (entry !== undefined) counts.set(entry.value, entry.count);
  }
  return counts;
}
```
:::
