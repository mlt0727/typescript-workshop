---
kind: challenge
title: 生成用户资料摘要
---
接口返回的用户数据很不完整。实现 `formatProfile(user)`，返回一行摘要：

```text
<显示名> · 帖子 <帖子数> · 关注者 <关注者数> · <邮箱>
```

规则：

| 部分 | 来源 | 什么时候算“缺失” | 缺失时显示 |
|---|---|---|---|
| 显示名 | `user.name` | `null`、`undefined` **或空字符串** | `用户#<id>`，例如 `用户#7` |
| 帖子数 | `user.stats.posts` | `stats` 或 `posts` 缺失 | `未知` |
| 关注者数 | `user.stats.followers` | `stats` 缺失，或 `followers` 为 `null`/`undefined` | `未知` |
| 邮箱 | `user.contact.email` | `contact` 缺失或为 `null`，或 `email` 缺失 | `未填写邮箱` |

注意：帖子数和关注者数为 `0` 时要显示 `0`，不算缺失。

示例：`{ id: 7, name: 'Ada', stats: { posts: 0 }, contact: null }` → `Ada · 帖子 0 · 关注者 未知 · 未填写邮箱`

要求：不使用 `any`、类型断言或非空断言；返回类型为 `string`。

:::files{role=starter}
```ts file=profile.ts
export type ApiUser = {
  id: number;
  name?: string | null;
  stats?: {
    posts?: number;
    followers?: number | null;
  };
  contact?: {
    email?: string;
  } | null;
};

export function formatProfile(user: ApiUser): string {
  // 在这里实现
  return '';
}

console.log(formatProfile({ id: 7, name: 'Ada', stats: { posts: 0 }, contact: null }));
```
:::

:::files{role=solution}
```ts file=profile.ts
export type ApiUser = {
  id: number;
  name?: string | null;
  stats?: {
    posts?: number;
    followers?: number | null;
  };
  contact?: {
    email?: string;
  } | null;
};

export function formatProfile(user: ApiUser): string {
  const name = user.name || `用户#${user.id}`;
  const posts = user.stats?.posts ?? '未知';
  const followers = user.stats?.followers ?? '未知';
  const email = user.contact?.email ?? '未填写邮箱';
  return `${name} · 帖子 ${posts} · 关注者 ${followers} · ${email}`;
}

console.log(formatProfile({ id: 7, name: 'Ada', stats: { posts: 0 }, contact: null }));
```
:::

:::files{role=tests}
```ts file=profile.test.ts
import { describe, expect, test } from 'vitest';
import { formatProfile } from './profile';

describe('formatProfile', () => {
  test('数据完整', () => {
    expect(
      formatProfile({
        id: 1,
        name: 'Ada',
        stats: { posts: 12, followers: 300 },
        contact: { email: 'ada@example.com' },
      }),
    ).toBe('Ada · 帖子 12 · 关注者 300 · ada@example.com');
  });

  test('0 不算缺失', () => {
    expect(formatProfile({ id: 2, name: 'Bo', stats: { posts: 0, followers: 0 }, contact: { email: 'b@example.com' } })).toBe(
      'Bo · 帖子 0 · 关注者 0 · b@example.com',
    );
  });

  test('嵌套对象缺失或为 null', () => {
    expect(formatProfile({ id: 3, name: 'Cy' })).toBe('Cy · 帖子 未知 · 关注者 未知 · 未填写邮箱');
    expect(formatProfile({ id: 4, name: 'Di', stats: {}, contact: null })).toBe('Di · 帖子 未知 · 关注者 未知 · 未填写邮箱');
    expect(formatProfile({ id: 5, name: 'Ed', stats: { followers: null }, contact: {} })).toBe(
      'Ed · 帖子 未知 · 关注者 未知 · 未填写邮箱',
    );
  });

  test.each([
    ['空字符串', ''],
    ['null', null],
    ['缺失', undefined],
  ])('名字为%s时显示编号', (_label, name) => {
    expect(formatProfile({ id: 7, name, stats: { posts: 1, followers: 2 }, contact: { email: 'x@example.com' } })).toBe(
      '用户#7 · 帖子 1 · 关注者 2 · x@example.com',
    );
  });

  test('题目中的示例', () => {
    expect(formatProfile({ id: 7, name: 'Ada', stats: { posts: 0 }, contact: null })).toBe(
      'Ada · 帖子 0 · 关注者 未知 · 未填写邮箱',
    );
  });
});
```
```ts file=profile.test-d.ts
import { expectTypeOf } from 'vitest';
import { formatProfile, type ApiUser } from './profile';

expectTypeOf(formatProfile).parameter(0).toEqualTypeOf<ApiUser>();
expectTypeOf(formatProfile).returns.toEqualTypeOf<string>();
```
:::

:::hint{level=1}
逐个字段问自己：“哪些值算缺失？”显示名把空字符串也当作缺失；帖子数和关注者数的 `0` 却是有效数据。两种情况适合的运算符不同。
:::

:::hint{level=2}
显示名用 `||`；帖子数、关注者数和邮箱用 `??`。`stats` 和 `contact` 本身可能缺失（`contact` 还可能是 `null`），所以读取它们的属性时要用 `?.`，例如 `user.stats?.posts ?? '未知'`。
:::

:::explanation
参考答案对每个字段选择了不同的运算符：

- `user.name || \`用户#${user.id}\``：规则要求空字符串也算缺失，`||` 正好把 `''`、`null`、`undefined` 都替换掉。
- `user.stats?.posts ?? '未知'`：`?.` 处理 `stats` 缺失；`??` 只替换 `null`/`undefined`，保留 `0`。
- `user.contact?.email ?? '未填写邮箱'`：`?.` 同时能处理 `contact` 为 `undefined` 和 `null` 的情况。

模板字符串会把数字转成字符串，所以 `posts` 的类型是 `number | string` 也没关系。全部用 `||` 会把 `0` 变成“未知”；全部用 `??` 会把空名字原样输出——这两种常见错误都会被测试拒绝。
:::

:::variant{kind=alt name=explicit-checks}
```ts file=profile.ts
export type ApiUser = {
  id: number;
  name?: string | null;
  stats?: {
    posts?: number;
    followers?: number | null;
  };
  contact?: {
    email?: string;
  } | null;
};

export function formatProfile(user: ApiUser): string {
  let name = `用户#${user.id}`;
  if (user.name !== undefined && user.name !== null && user.name !== '') {
    name = user.name;
  }
  let posts = '未知';
  let followers = '未知';
  if (user.stats) {
    if (user.stats.posts !== undefined) posts = String(user.stats.posts);
    if (user.stats.followers !== undefined && user.stats.followers !== null) {
      followers = String(user.stats.followers);
    }
  }
  let email = '未填写邮箱';
  if (user.contact && user.contact.email !== undefined) {
    email = user.contact.email;
  }
  return `${name} · 帖子 ${posts} · 关注者 ${followers} · ${email}`;
}
```
:::

:::variant{kind=wrong name=all-or fails=tests reason="全部用 ||：帖子数和关注者数的 0 被当成缺失"}
```ts file=profile.ts
export type ApiUser = {
  id: number;
  name?: string | null;
  stats?: {
    posts?: number;
    followers?: number | null;
  };
  contact?: {
    email?: string;
  } | null;
};

export function formatProfile(user: ApiUser): string {
  const name = user.name || `用户#${user.id}`;
  const posts = user.stats?.posts || '未知';
  const followers = user.stats?.followers || '未知';
  const email = user.contact?.email || '未填写邮箱';
  return `${name} · 帖子 ${posts} · 关注者 ${followers} · ${email}`;
}
```
:::

:::variant{kind=wrong name=all-nullish fails=tests reason="全部用 ??：空字符串名字没有被替换"}
```ts file=profile.ts
export type ApiUser = {
  id: number;
  name?: string | null;
  stats?: {
    posts?: number;
    followers?: number | null;
  };
  contact?: {
    email?: string;
  } | null;
};

export function formatProfile(user: ApiUser): string {
  const name = user.name ?? `用户#${user.id}`;
  const posts = user.stats?.posts ?? '未知';
  const followers = user.stats?.followers ?? '未知';
  const email = user.contact?.email ?? '未填写邮箱';
  return `${name} · 帖子 ${posts} · 关注者 ${followers} · ${email}`;
}
```
:::

:::variant{kind=wrong name=non-null-stats fails=rules reason="用非空断言跳过检查，stats 缺失时运行时崩溃"}
```ts file=profile.ts
export type ApiUser = {
  id: number;
  name?: string | null;
  stats?: {
    posts?: number;
    followers?: number | null;
  };
  contact?: {
    email?: string;
  } | null;
};

export function formatProfile(user: ApiUser): string {
  const name = user.name || `用户#${user.id}`;
  const posts = user.stats!.posts ?? '未知';
  const followers = user.stats!.followers ?? '未知';
  const email = user.contact?.email ?? '未填写邮箱';
  return `${name} · 帖子 ${posts} · 关注者 ${followers} · ${email}`;
}
```
:::

:::variant{kind=wrong name=no-defaults fails=tests reason="没有提供默认值，缺失时输出 undefined"}
```ts file=profile.ts
export type ApiUser = {
  id: number;
  name?: string | null;
  stats?: {
    posts?: number;
    followers?: number | null;
  };
  contact?: {
    email?: string;
  } | null;
};

export function formatProfile(user: ApiUser): string {
  return `${user.name || `用户#${user.id}`} · 帖子 ${user.stats?.posts} · 关注者 ${user.stats?.followers} · ${user.contact?.email}`;
}
```
:::
