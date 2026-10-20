---
kind: task
title: 用户的创建、修改与摘要
---
`users.ts` 中已有 `User` 类型。用工具类型从它派生出三个类型（不要手写字段），并实现三个函数：

1. **`NewUser`**：创建用户时传入的数据，没有 `id` 和 `createdAt`；
2. **`UserPatch`**：修改时传入的补丁，只能包含 `name`、`email`、`bio`，每一项都可以省略；
3. **`UserSummary`**：列表中显示的摘要，只有 `id` 和 `name`；
4. **`createUser(input, id, now)`**：返回完整的 `User`；
5. **`applyPatch(user, patch)`**：返回修改后的新对象，不修改传入的对象。补丁中**值为 `undefined` 的字段不修改**（`{ name: undefined }` 不能把名字变成 `undefined`）；
6. **`summarize(users)`**：返回摘要的数组，每一项**只有** `id` 和 `name` 两个属性。

不能使用类型断言。

:::files{role=starter}
```ts file=users.ts
export type User = { id: string; name: string; email: string; bio?: string; createdAt: Date };

export type NewUser = User;
export type UserPatch = User;
export type UserSummary = User;

export function createUser(input: NewUser, id: string, now: Date): User {
  return input;
}

export function applyPatch(user: User, patch: UserPatch): User {
  return { ...user, ...patch };
}

export function summarize(users: readonly User[]): UserSummary[] {
  return [...users];
}
```
```ts file=main.ts
import { applyPatch, createUser, summarize } from './users';

const ada = createUser({ name: 'Ada', email: 'ada@example.com' }, 'u1', new Date('2026-01-01'));
const renamed = applyPatch(ada, { name: undefined, bio: '数学家' });
console.log(renamed.name, renamed.bio, summarize([ada, renamed]));
```
:::

:::files{role=solution}
```ts file=users.ts
export type User = { id: string; name: string; email: string; bio?: string; createdAt: Date };

export type NewUser = Omit<User, 'id' | 'createdAt'>;
export type UserPatch = Partial<Pick<User, 'name' | 'email' | 'bio'>>;
export type UserSummary = Pick<User, 'id' | 'name'>;

export function createUser(input: NewUser, id: string, now: Date): User {
  return { ...input, id, createdAt: now };
}

export function applyPatch(user: User, patch: UserPatch): User {
  const next: User = { ...user };
  if (patch.name !== undefined) next.name = patch.name;
  if (patch.email !== undefined) next.email = patch.email;
  if (patch.bio !== undefined) next.bio = patch.bio;
  return next;
}

export function summarize(users: readonly User[]): UserSummary[] {
  return users.map(({ id, name }) => ({ id, name }));
}
```
```ts file=main.ts
import { applyPatch, createUser, summarize } from './users';

const ada = createUser({ name: 'Ada', email: 'ada@example.com' }, 'u1', new Date('2026-01-01'));
const renamed = applyPatch(ada, { name: undefined, bio: '数学家' });
console.log(renamed.name, renamed.bio, summarize([ada, renamed]));
```
:::

:::files{role=tests}
```ts file=users.test.ts
import { describe, expect, test } from 'vitest';
import { applyPatch, createUser, summarize, type User } from './users';

const now = new Date('2026-10-20T00:00:00Z');
const ada: User = { id: 'u1', name: 'Ada', email: 'ada@example.com', createdAt: now };

describe('createUser', () => {
  test('加上 id 与 createdAt', () => {
    expect(createUser({ name: 'Lin', email: 'lin@example.com' }, 'u2', now)).toEqual({
      id: 'u2',
      name: 'Lin',
      email: 'lin@example.com',
      createdAt: now,
    });
  });

  test('传入的数据中多出的 id、createdAt 不会覆盖新的值', () => {
    // 结构化类型：一个完整的 User 也可以当作 NewUser 传入
    const later = new Date('2026-10-21T00:00:00Z');
    expect(createUser(ada, 'u2', later)).toMatchObject({ id: 'u2', createdAt: later });
  });
});

describe('applyPatch', () => {
  test('修改给出的字段，返回新对象', () => {
    const next = applyPatch(ada, { email: 'ada@new.example', bio: '数学家' });
    expect(next).toEqual({ ...ada, email: 'ada@new.example', bio: '数学家' });
    expect(next).not.toBe(ada);
    expect(ada.email).toBe('ada@example.com');
  });

  test('值为 undefined 的字段不修改', () => {
    const next = applyPatch({ ...ada, bio: '旧的简介' }, { name: undefined, bio: undefined, email: undefined });
    expect(next.name).toBe('Ada');
    expect(next.bio).toBe('旧的简介');
    expect(next.email).toBe('ada@example.com');
  });

  test('空字符串是一个正常的值', () => {
    expect(applyPatch({ ...ada, bio: '旧的简介' }, { bio: '' }).bio).toBe('');
  });
});

describe('summarize', () => {
  test('每一项只有 id 和 name', () => {
    const list = summarize([ada, { ...ada, id: 'u2', name: 'Lin', bio: 'x' }]);
    expect(list).toEqual([
      { id: 'u1', name: 'Ada' },
      { id: 'u2', name: 'Lin' },
    ]);
    expect(list.map((u) => Object.keys(u).toSorted())).toEqual([
      ['id', 'name'],
      ['id', 'name'],
    ]);
  });
});
```
```ts file=users.test-d.ts
import { expectTypeOf } from 'vitest';
import { applyPatch, createUser, type NewUser, type User, type UserPatch, type UserSummary } from './users';

expectTypeOf<NewUser>().toEqualTypeOf<{ name: string; email: string; bio?: string }>();
expectTypeOf<UserPatch>().toEqualTypeOf<{ name?: string; email?: string; bio?: string }>();
expectTypeOf<UserSummary>().toEqualTypeOf<{ id: string; name: string }>();

declare const user: User;
// @ts-expect-error 创建时必须提供 email
createUser({ name: 'Ada' }, 'u1', new Date());
// @ts-expect-error id 不能通过补丁修改
applyPatch(user, { id: 'u9' });
// @ts-expect-error createdAt 不能通过补丁修改
applyPatch(user, { createdAt: new Date() });
```
:::

:::hint{level=1}
`NewUser = Omit<User, 'id' | 'createdAt'>`；`UserPatch = Partial<Pick<User, 'name' | 'email' | 'bio'>>`：先挑出能改的字段，再让它们都可选；`UserSummary = Pick<User, 'id' | 'name'>`。
:::

:::hint{level=2}
`applyPatch` 不能直接 `{ ...user, ...patch }`：补丁中显式的 `undefined` 会覆盖原来的值。先复制一份 `const next: User = { ...user }`，再对每个字段判断 `patch.name !== undefined` 才赋值。`summarize` 用解构只取出两个字段：`users.map(({ id, name }) => ({ id, name }))`，直接返回 `user` 的话，多余的字段也会被带出去。
:::

:::explanation
工具类型让这三个类型都由 `User` 派生：给 `User` 加一个字段 `avatar`，`NewUser` 自动多出它；把 `email` 改名，`UserPatch` 中的 `email` 也跟着报错，不会漏改。

三个运行时的细节和类型有关：

- **展开的顺序**：`createUser` 写成 `{ ...input, id, createdAt: now }`，新的 `id` 和 `createdAt` 写在后面。同样因为结构化类型，一个完整的 `User` 也能当作 `NewUser` 传入；如果写成 `{ id, createdAt: now, ...input }`，输入中多出的旧 `id` 会覆盖新的；

- **补丁中的 `undefined`**：`UserPatch` 的每个属性都是 `string | undefined`，显式的 `{ name: undefined }` 能通过检查。展开合并 `{ ...user, ...patch }` 时，TypeScript 认为 `name` 仍然是 `string`，运行时却是 `undefined`。逐个字段判断 `!== undefined` 才能避免（用 `??` 回退也可以，但要注意它和 `!== undefined` 的区别：`??` 也会跳过 `null`）；
- **摘要中多余的字段**：`UserSummary` 只有两个属性，但 TypeScript 允许把一个完整的 `User` 当作 `UserSummary` 返回（结构化类型，多余的属性不报错，b02）。如果摘要要发给前端或写进日志，多余的 `email` 就泄露了出去。用解构构造新对象，才真正只有这两个字段。
:::

:::variant{kind=alt name=loop-over-fields}
```ts file=users.ts
export type User = { id: string; name: string; email: string; bio?: string; createdAt: Date };

type Editable = 'name' | 'email' | 'bio';

export type NewUser = Omit<User, 'id' | 'createdAt'>;
export type UserPatch = Partial<Pick<User, Editable>>;
export type UserSummary = Pick<User, 'id' | 'name'>;

export function createUser(input: NewUser, id: string, now: Date): User {
  const { name, email, bio } = input;
  return bio === undefined ? { id, name, email, createdAt: now } : { id, name, email, bio, createdAt: now };
}

export function applyPatch(user: User, patch: UserPatch): User {
  return {
    ...user,
    name: patch.name ?? user.name,
    email: patch.email ?? user.email,
    ...(patch.bio === undefined ? {} : { bio: patch.bio }),
  };
}

export function summarize(users: readonly User[]): UserSummary[] {
  const result: UserSummary[] = [];
  for (const user of users) result.push({ id: user.id, name: user.name });
  return result;
}
```
:::

:::variant{kind=wrong name=spread-patch fails=tests reason="直接展开合并补丁，显式的 undefined 覆盖了原来的值"}
```ts file=users.ts
export type User = { id: string; name: string; email: string; bio?: string; createdAt: Date };

export type NewUser = Omit<User, 'id' | 'createdAt'>;
export type UserPatch = Partial<Pick<User, 'name' | 'email' | 'bio'>>;
export type UserSummary = Pick<User, 'id' | 'name'>;

export function createUser(input: NewUser, id: string, now: Date): User {
  return { ...input, id, createdAt: now };
}

export function applyPatch(user: User, patch: UserPatch): User {
  return { ...user, ...patch };
}

export function summarize(users: readonly User[]): UserSummary[] {
  return users.map(({ id, name }) => ({ id, name }));
}
```
:::

:::variant{kind=wrong name=summary-leaks-fields fails=tests reason="摘要直接返回了完整的用户对象，多余的字段也带了出去"}
```ts file=users.ts
export type User = { id: string; name: string; email: string; bio?: string; createdAt: Date };

export type NewUser = Omit<User, 'id' | 'createdAt'>;
export type UserPatch = Partial<Pick<User, 'name' | 'email' | 'bio'>>;
export type UserSummary = Pick<User, 'id' | 'name'>;

export function createUser(input: NewUser, id: string, now: Date): User {
  return { ...input, id, createdAt: now };
}

export function applyPatch(user: User, patch: UserPatch): User {
  const next: User = { ...user };
  if (patch.name !== undefined) next.name = patch.name;
  if (patch.email !== undefined) next.email = patch.email;
  if (patch.bio !== undefined) next.bio = patch.bio;
  return next;
}

export function summarize(users: readonly User[]): UserSummary[] {
  return [...users];
}
```
:::

:::variant{kind=wrong name=partial-user fails=types reason="补丁的类型是 Partial<User>，id 和 createdAt 也能被修改"}
```ts file=users.ts
export type User = { id: string; name: string; email: string; bio?: string; createdAt: Date };

export type NewUser = Omit<User, 'id' | 'createdAt'>;
export type UserPatch = Partial<User>;
export type UserSummary = Pick<User, 'id' | 'name'>;

export function createUser(input: NewUser, id: string, now: Date): User {
  return { ...input, id, createdAt: now };
}

export function applyPatch(user: User, patch: UserPatch): User {
  const next: User = { ...user };
  if (patch.name !== undefined) next.name = patch.name;
  if (patch.email !== undefined) next.email = patch.email;
  if (patch.bio !== undefined) next.bio = patch.bio;
  return next;
}

export function summarize(users: readonly User[]): UserSummary[] {
  return users.map(({ id, name }) => ({ id, name }));
}
```
:::

:::variant{kind=wrong name=omit-typo fails=types reason="Omit 中把 createdAt 拼错了，Omit 不检查键名，createdAt 没有被去掉"}
```ts file=users.ts
export type User = { id: string; name: string; email: string; bio?: string; createdAt: Date };

export type NewUser = Omit<User, 'id' | 'createAt'>;
export type UserPatch = Partial<Pick<User, 'name' | 'email' | 'bio'>>;
export type UserSummary = Pick<User, 'id' | 'name'>;

export function createUser(input: NewUser, id: string, now: Date): User {
  return { ...input, id, createdAt: now };
}

export function applyPatch(user: User, patch: UserPatch): User {
  const next: User = { ...user };
  if (patch.name !== undefined) next.name = patch.name;
  if (patch.email !== undefined) next.email = patch.email;
  if (patch.bio !== undefined) next.bio = patch.bio;
  return next;
}

export function summarize(users: readonly User[]): UserSummary[] {
  return users.map(({ id, name }) => ({ id, name }));
}
```
:::
