---
kind: task
title: 加载用户主页
---
`loadProfile(id, api)` 加载一个用户的主页数据。`api` 提供两个异步函数（测试会传入假的实现）：

- `api.getUser(id)`：返回 `Promise<User | null>`，用户不存在时为 `null`；
- `api.getPosts(userId)`：返回 `Promise<Post[]>`。

规则：

1. 先获取用户；用户不存在时，抛出 `Error('用户不存在')`（`loadProfile` 返回的 Promise 被拒绝），并且**不要**再请求文章；
2. 再获取这个用户的文章；
3. 返回 `{ name: 用户名, postCount: 文章数, latest: 最新一篇文章的标题 }`，没有文章时 `latest` 为 `null`。文章数组按时间从旧到新排列，最后一篇是最新的。

用 `async`/`await` 实现。

:::files{role=starter}
```ts file=profile.ts
export type User = { id: number; name: string };
export type Post = { id: number; title: string };
export type Api = {
  getUser: (id: number) => Promise<User | null>;
  getPosts: (userId: number) => Promise<Post[]>;
};
export type Profile = { name: string; postCount: number; latest: string | null };

export async function loadProfile(id: number, api: Api): Promise<Profile> {
  const user = api.getUser(id);
  const posts = api.getPosts(id);
  return { name: user.name, postCount: posts.length, latest: null };
}
```
:::

:::files{role=solution}
```ts file=profile.ts
export type User = { id: number; name: string };
export type Post = { id: number; title: string };
export type Api = {
  getUser: (id: number) => Promise<User | null>;
  getPosts: (userId: number) => Promise<Post[]>;
};
export type Profile = { name: string; postCount: number; latest: string | null };

export async function loadProfile(id: number, api: Api): Promise<Profile> {
  const user = await api.getUser(id);
  if (user === null) {
    throw new Error('用户不存在');
  }
  const posts = await api.getPosts(user.id);
  const last = posts.at(-1);
  return { name: user.name, postCount: posts.length, latest: last === undefined ? null : last.title };
}
```
:::

:::files{role=tests}
```ts file=profile.test.ts
import { describe, expect, test, vi } from 'vitest';
import { loadProfile, type Api } from './profile';

function fakeApi(): Api {
  return {
    getUser: vi.fn(async (id: number) => (id === 1 ? { id: 1, name: 'Ada' } : id === 2 ? { id: 2, name: 'Grace' } : null)),
    getPosts: vi.fn(async (userId: number) =>
      userId === 1 ? [{ id: 10, title: '第一篇' }, { id: 11, title: '最新一篇' }] : [],
    ),
  };
}

describe('loadProfile', () => {
  test('有文章的用户', async () => {
    await expect(loadProfile(1, fakeApi())).resolves.toEqual({ name: 'Ada', postCount: 2, latest: '最新一篇' });
  });

  test('没有文章的用户', async () => {
    await expect(loadProfile(2, fakeApi())).resolves.toEqual({ name: 'Grace', postCount: 0, latest: null });
  });

  test('用户不存在时拒绝，并且不请求文章', async () => {
    const api = fakeApi();
    await expect(loadProfile(99, api)).rejects.toThrow('用户不存在');
    expect(api.getPosts).not.toHaveBeenCalled();
  });
});
```
:::

:::hint{level=1}
起始代码忘了 `await`：`user` 和 `posts` 都是 Promise，TypeScript 报错找不到 `name` 和 `length`。先 `await` 用户，检查 `null`，再 `await` 文章。
:::

:::hint{level=2}
`const user = await api.getUser(id); if (user === null) throw new Error('用户不存在');` 然后 `const posts = await api.getPosts(user.id);`。最新一篇可以用 a10 的 `posts.at(-1)`，注意它可能是 `undefined`。
:::

:::explanation
`await` 把 `Promise<User | null>` 变成了 `User | null`，接着就可以用 a05 的方法检查 `null`。在 async 函数里 `throw`，返回的 Promise 就被拒绝，调用方用 `catch` 或 `try/catch` 处理。

这里必须串行：文章请求需要先确认用户存在。起始代码同时发起了两个请求，用户不存在时也白白请求了文章。

`posts.at(-1)` 取最后一个元素，类型是 `Post | undefined`，空数组时为 `undefined`。
:::

:::variant{kind=alt name=then-chain}
```ts file=profile.ts
export type User = { id: number; name: string };
export type Post = { id: number; title: string };
export type Api = {
  getUser: (id: number) => Promise<User | null>;
  getPosts: (userId: number) => Promise<Post[]>;
};
export type Profile = { name: string; postCount: number; latest: string | null };

export function loadProfile(id: number, api: Api): Promise<Profile> {
  return api.getUser(id).then((user) => {
    if (user === null) throw new Error('用户不存在');
    return api.getPosts(user.id).then((posts) => ({
      name: user.name,
      postCount: posts.length,
      latest: posts.length > 0 ? (posts[posts.length - 1]?.title ?? null) : null,
    }));
  });
}
```
:::

:::variant{kind=wrong name=parallel-requests fails=tests reason="同时请求了用户和文章，用户不存在时也请求了文章"}
```ts file=profile.ts
export type User = { id: number; name: string };
export type Post = { id: number; title: string };
export type Api = {
  getUser: (id: number) => Promise<User | null>;
  getPosts: (userId: number) => Promise<Post[]>;
};
export type Profile = { name: string; postCount: number; latest: string | null };

export async function loadProfile(id: number, api: Api): Promise<Profile> {
  const [user, posts] = await Promise.all([api.getUser(id), api.getPosts(id)]);
  if (user === null) throw new Error('用户不存在');
  const last = posts.at(-1);
  return { name: user.name, postCount: posts.length, latest: last?.title ?? null };
}
```
:::

:::variant{kind=wrong name=return-null fails=types reason="用户不存在时返回了 null，而不是拒绝"}
```ts file=profile.ts
export type User = { id: number; name: string };
export type Post = { id: number; title: string };
export type Api = {
  getUser: (id: number) => Promise<User | null>;
  getPosts: (userId: number) => Promise<Post[]>;
};
export type Profile = { name: string; postCount: number; latest: string | null };

export async function loadProfile(id: number, api: Api): Promise<Profile> {
  const user = await api.getUser(id);
  if (user === null) return null;
  const posts = await api.getPosts(user.id);
  const last = posts.at(-1);
  return { name: user.name, postCount: posts.length, latest: last?.title ?? null };
}
```
:::

:::variant{kind=wrong name=first-not-latest fails=tests reason="取了第一篇文章，而不是最新一篇"}
```ts file=profile.ts
export type User = { id: number; name: string };
export type Post = { id: number; title: string };
export type Api = {
  getUser: (id: number) => Promise<User | null>;
  getPosts: (userId: number) => Promise<Post[]>;
};
export type Profile = { name: string; postCount: number; latest: string | null };

export async function loadProfile(id: number, api: Api): Promise<Profile> {
  const user = await api.getUser(id);
  if (user === null) throw new Error('用户不存在');
  const posts = await api.getPosts(user.id);
  return { name: user.name, postCount: posts.length, latest: posts[0]?.title ?? null };
}
```
:::
