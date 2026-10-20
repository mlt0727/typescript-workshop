---
kind: task
title: 不要把密码发给前端
---
数据库查出的用户记录除了公开信息，还带有 `passwordHash` 等内部字段。`toPublicUser(row)` 要返回只包含 `id`、`name`、`email` 三个字段的**新对象**，交给前端显示。

起始代码能通过类型检查（结构化类型允许这样做），但测试发现它把内部字段也交了出去。修好它。

:::files{role=starter}
```ts file=user.ts
export interface PublicUser {
  id: number;
  name: string;
  email: string;
}

export function toPublicUser(row: PublicUser): PublicUser {
  return row;
}
```
:::

:::files{role=solution}
```ts file=user.ts
export interface PublicUser {
  id: number;
  name: string;
  email: string;
}

export function toPublicUser(row: PublicUser): PublicUser {
  return { id: row.id, name: row.name, email: row.email };
}
```
:::

:::files{role=tests}
```ts file=user.test.ts
import { expect, test } from 'vitest';
import { toPublicUser } from './user';

const row = {
  id: 7,
  name: 'Ada',
  email: 'ada@example.com',
  passwordHash: '$2b$10$abc',
  isAdmin: true,
};

test('只包含公开字段', () => {
  const user = toPublicUser(row);
  expect(Object.keys(user).toSorted()).toEqual(['email', 'id', 'name']);
  expect(user).toEqual({ id: 7, name: 'Ada', email: 'ada@example.com' });
});

test('序列化后不包含内部字段', () => {
  expect(JSON.stringify(toPublicUser(row))).not.toContain('passwordHash');
});

test('返回新对象，不修改原记录', () => {
  const user = toPublicUser(row);
  expect(user).not.toBe(row);
  expect(row.passwordHash).toBe('$2b$10$abc');
});
```
:::

:::hint{level=1}
`row` 在运行时带着全部字段，类型 `PublicUser` 不会删除任何属性。要明确地创建一个只有三个字段的新对象。
:::

:::hint{level=2}
`return { id: row.id, name: row.name, email: row.email };`
:::

:::explanation
测试传入的 `row` 有五个属性，但它拥有 `PublicUser` 要求的全部属性，所以可以作为 `PublicUser` 参数传入（结构化类型）。函数里的 `row` 在运行时仍然是那个有五个属性的对象，直接返回它，内部字段就跟着一起出去了。

只有明确写出想要的字段、创建一个新对象，才能保证结果里没有别的东西。也可以用解构：`const { id, name, email } = row; return { id, name, email };`。

注意 `{ ...row }` 也不行：展开会复制所有属性，包括 `passwordHash`。
:::

:::variant{kind=alt name=destructure}
```ts file=user.ts
export interface PublicUser {
  id: number;
  name: string;
  email: string;
}

export function toPublicUser({ id, name, email }: PublicUser): PublicUser {
  return { id, name, email };
}
```
:::

:::variant{kind=wrong name=spread-copy fails=tests reason="展开复制了所有属性，内部字段仍然在"}
```ts file=user.ts
export interface PublicUser {
  id: number;
  name: string;
  email: string;
}

export function toPublicUser(row: PublicUser): PublicUser {
  return { ...row };
}
```
:::

:::variant{kind=wrong name=delete-field fails=tests reason="在原对象上删除字段：修改了调用方的数据，还漏掉了其他内部字段"}
```ts file=user.ts
export interface PublicUser {
  id: number;
  name: string;
  email: string;
}

export function toPublicUser(row: PublicUser): PublicUser {
  const copy = row;
  Reflect.deleteProperty(copy, 'passwordHash');
  return copy;
}
```
:::
