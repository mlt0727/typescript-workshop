---
kind: challenge
title: 修复异步加载中的 bug
---
`loader.ts` 中的两个函数都有 bug。用户和测试人员的报告：

1. 用户列表总是空的，过一会儿刷新才偶尔有数据；
2. 有数据的时候，用户的顺序和 `ids` 的顺序不一样；
3. 有一个用户加载失败时，页面上悄悄地少了一个人，没有任何提示；
4. 在搜索框中快速输入时，有时最后显示的是前一个搜索词的结果。

修复之后的规格：

- **`loadUsers(ids, fetchUser)`**：**同时**发出所有请求（调用 `loadUsers` 时，同步地为每个 id 调用一次 `fetchUser`），全部完成后按 `ids` 的顺序返回；任何一个失败时，以那个错误拒绝；
- **`createSearch(fetchResults, render)`**：返回的 `search(query)` 调用 `fetchResults(query)`，完成后把结果交给 `render`。但如果在等待期间又调用了 `search`（无论搜索词是否相同），这个结果已经过时，不再交给 `render`。`search` 返回的 Promise 在处理完结果之后完成。

测试中的 `deferred()` 创建一个可以手动决定何时完成的 Promise，用来固定请求完成的顺序。

:::files{role=starter}
```ts file=loader.ts
export type User = { id: string; name: string };
export type FetchUser = (id: string) => Promise<User>;
export type FetchResults = (query: string) => Promise<string[]>;

/** 同时加载所有用户，按 ids 的顺序返回 */
export async function loadUsers(ids: readonly string[], fetchUser: FetchUser): Promise<User[]> {
  const users: User[] = [];
  ids.forEach(async (id) => {
    try {
      users.push(await fetchUser(id));
    } catch {
      // 加载失败的用户跳过
    }
  });
  return users;
}

/** 搜索框：每次输入调用 search，结果交给 render */
export function createSearch(fetchResults: FetchResults, render: (results: string[]) => void): (query: string) => Promise<void> {
  return async (query) => {
    render(await fetchResults(query));
  };
}
```
```ts file=main.ts
import { createSearch, loadUsers, type User } from './loader';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const fetchUser = async (id: string): Promise<User> => {
  await delay(id === 'u1' ? 30 : 10);
  return { id, name: `用户 ${id}` };
};
console.log(await loadUsers(['u1', 'u2', 'u3'], fetchUser));

const search = createSearch(
  async (query) => {
    await delay(query.length === 1 ? 40 : 10); // 第一次搜索比较慢
    return [`${query} 的结果`];
  },
  (results) => console.log('显示：', results),
);
await Promise.all([search('t'), search('ts')]);
```
:::

:::files{role=solution}
```ts file=loader.ts
export type User = { id: string; name: string };
export type FetchUser = (id: string) => Promise<User>;
export type FetchResults = (query: string) => Promise<string[]>;

/** 同时加载所有用户，按 ids 的顺序返回 */
export async function loadUsers(ids: readonly string[], fetchUser: FetchUser): Promise<User[]> {
  // forEach 不等待回调返回的 Promise；push 的顺序是完成的顺序。
  // map 立即发出所有请求，Promise.all 等待全部完成、按输入的顺序返回，任何一个失败就以那个错误拒绝
  return Promise.all(ids.map((id) => fetchUser(id)));
}

/** 搜索框：每次输入调用 search，结果交给 render */
export function createSearch(fetchResults: FetchResults, render: (results: string[]) => void): (query: string) => Promise<void> {
  let latest = 0;
  return async (query) => {
    const id = ++latest;
    const results = await fetchResults(query);
    // 等待期间又发出了新的搜索：这个结果已经过时了
    if (id === latest) render(results);
  };
}
```
```ts file=main.ts
import { createSearch, loadUsers, type User } from './loader';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const fetchUser = async (id: string): Promise<User> => {
  await delay(id === 'u1' ? 30 : 10);
  return { id, name: `用户 ${id}` };
};
console.log(await loadUsers(['u1', 'u2', 'u3'], fetchUser));

const search = createSearch(
  async (query) => {
    await delay(query.length === 1 ? 40 : 10); // 第一次搜索比较慢
    return [`${query} 的结果`];
  },
  (results) => console.log('显示：', results),
);
await Promise.all([search('t'), search('ts')]);
```
:::

:::files{role=tests}
```ts file=loader.test.ts
import { describe, expect, test } from 'vitest';
import { createSearch, loadUsers, type User } from './loader';

/** 一个可以手动决定何时完成的 Promise */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const user = (id: string): User => ({ id, name: `用户 ${id}` });

describe('loadUsers', () => {
  test('按 ids 的顺序返回，即使后面的先完成', async () => {
    const pending = new Map(['u1', 'u2', 'u3'].map((id) => [id, deferred<User>()]));
    const result = loadUsers(['u1', 'u2', 'u3'], (id) => pending.get(id)!.promise);
    pending.get('u3')!.resolve(user('u3'));
    pending.get('u1')!.resolve(user('u1'));
    pending.get('u2')!.resolve(user('u2'));
    await expect(result).resolves.toEqual([user('u1'), user('u2'), user('u3')]);
  });

  test('同时发出所有请求，不是一个接一个', async () => {
    const started: string[] = [];
    const pending = new Map(['a', 'b', 'c'].map((id) => [id, deferred<User>()]));
    const result = loadUsers(['a', 'b', 'c'], (id) => {
      started.push(id);
      return pending.get(id)!.promise;
    });
    await Promise.resolve();
    expect(started).toEqual(['a', 'b', 'c']);
    for (const [id, d] of pending) d.resolve(user(id));
    await result;
  });

  test('一个失败时，以那个错误拒绝（而不是悄悄地少了一个用户）', async () => {
    const result = loadUsers(['u1', 'u2'], async (id) => {
      if (id === 'u2') throw new Error('u2 加载失败');
      return user(id);
    });
    await expect(result).rejects.toThrow('u2 加载失败');
  });

  test('没有 id 时是空数组', async () => {
    await expect(loadUsers([], async (id) => user(id))).resolves.toEqual([]);
  });
});

describe('createSearch', () => {
  test('每次搜索的结果都会显示', async () => {
    const shown: string[][] = [];
    const search = createSearch(async (q) => [`${q}!`], (r) => shown.push(r));
    await search('a');
    await search('b');
    expect(shown).toEqual([['a!'], ['b!']]);
  });

  test('先发出的搜索后返回时，不能覆盖新的结果', async () => {
    const pending = new Map<string, ReturnType<typeof deferred<string[]>>>();
    const shown: string[][] = [];
    const search = createSearch(
      (q) => {
        const d = deferred<string[]>();
        pending.set(q, d);
        return d.promise;
      },
      (r) => shown.push(r),
    );
    const first = search('t');
    const second = search('ts');
    pending.get('ts')!.resolve(['ts 的结果']);
    await second;
    pending.get('t')!.resolve(['t 的结果']);
    await first;
    expect(shown).toEqual([['ts 的结果']]);
  });

  test('同一个搜索词输入了两次：只显示最后一次请求的结果', async () => {
    const calls: ReturnType<typeof deferred<string[]>>[] = [];
    const shown: string[][] = [];
    const search = createSearch(
      () => {
        const d = deferred<string[]>();
        calls.push(d);
        return d.promise;
      },
      (r) => shown.push(r),
    );
    const done = [search('a'), search('ab'), search('a')];
    calls[2]!.resolve(['第三次']);
    calls[0]!.resolve(['第一次']);
    calls[1]!.resolve(['第二次']);
    await Promise.all(done);
    expect(shown).toEqual([['第三次']]);
  });

  test('旧的搜索先返回：新的搜索还在等待时，也不显示旧的结果', async () => {
    const calls: ReturnType<typeof deferred<string[]>>[] = [];
    const shown: string[][] = [];
    const search = createSearch(
      () => {
        const d = deferred<string[]>();
        calls.push(d);
        return d.promise;
      },
      (r) => shown.push(r),
    );
    const first = search('a');
    const second = search('ab');
    calls[0]!.resolve(['a 的结果']);
    await first;
    expect(shown).toEqual([]);
    calls[1]!.resolve(['ab 的结果']);
    await second;
    expect(shown).toEqual([['ab 的结果']]);
  });
});
```
:::

:::hint{level=1}
报告 1、2、3 都在 `loadUsers` 中：`forEach` 不会等待 `async` 回调，函数在任何请求完成之前就返回了空数组；`push` 发生在每个请求完成的时候；`catch` 把错误吞掉了。一个 `Promise.all` 加 `map` 同时解决这三个问题。
:::

:::hint{level=2}
报告 4 是 e08 讲过的竞态。在 `createSearch` 中用一个计数器记住“最新的一次搜索”：每次调用 `search` 时加一并记下自己的编号，结果回来时如果编号已经不是最新的，就不调用 `render`。不要用搜索词判断：同一个词可能被输入两次。
:::

:::explanation
四个报告背后是三个原因：

- **`forEach` 不等待**（报告 1、2）：`forEach` 调用每个回调，不理会它们返回的 Promise，所以 `loadUsers` 在任何请求完成之前就返回了空数组。数据是“过一会儿”才 `push` 进同一个数组的，顺序是完成的顺序；
- **吞掉错误**（报告 3）：空的 `catch` 让失败变成了“少一个人”。是否要容忍部分失败是产品的决定，但无论如何都不能悄无声息：要么整体失败、显示错误，要么返回失败的列表让界面提示（`Promise.allSettled`）。这里的规格选择了整体失败；
- **竞态**（报告 4）：两个请求同时在路上，完成的顺序不确定。计数器记住了“最后发出的是哪一次”，过时的结果直接丢弃。比较搜索词是不够的：输入 `a`、`ab`、`a` 时，第一次 `a` 的请求也会被当成最新的。真实的代码中还可以用 `AbortController`（e08）取消过时的请求，节省流量。

`Promise.all(ids.map(fetchUser))` 一行同时满足了三条规格：`map` 同步地发出所有请求，`Promise.all` 按输入的顺序收集结果，任何一个拒绝时以那个错误拒绝。

测试中的 `deferred()` 是复现异步 bug 的关键工具：真实的网络中，完成的顺序取决于时机，bug 时有时无；在测试中手动决定每个 Promise 何时完成，就能每次都复现“后发出的先返回”。替代解把所有请求先发出，再依次 `await`，也能通过测试：请求在 `map` 时已经同时发出了，依次等待并不会让它们变慢。但它有两个小问题，所以 `Promise.all` 仍然更好：排在后面的请求先失败时，在 `await` 到它之前，这个拒绝暂时没有人处理，浏览器会报告“未处理的 Promise 拒绝”；有几个请求失败时，得到的是数组中排在前面的那个错误，而不是最先发生的那个。
:::

:::variant{kind=alt name=await-in-order}
```ts file=loader.ts
export type User = { id: string; name: string };
export type FetchUser = (id: string) => Promise<User>;
export type FetchResults = (query: string) => Promise<string[]>;

export async function loadUsers(ids: readonly string[], fetchUser: FetchUser): Promise<User[]> {
  const requests = ids.map(fetchUser);
  const users: User[] = [];
  for (const request of requests) users.push(await request);
  return users;
}

export function createSearch(fetchResults: FetchResults, render: (results: string[]) => void): (query: string) => Promise<void> {
  let current: Promise<string[]> | undefined;
  return async (query) => {
    const request = fetchResults(query);
    current = request;
    const results = await request;
    if (request === current) render(results);
  };
}
```
:::

:::variant{kind=wrong name=push-in-completion-order fails=tests reason="改成了 Promise.all 等待，但仍然在完成时 push：顺序是完成的顺序"}
```ts file=loader.ts
export type User = { id: string; name: string };
export type FetchUser = (id: string) => Promise<User>;
export type FetchResults = (query: string) => Promise<string[]>;

/** 同时加载所有用户，按 ids 的顺序返回 */
export async function loadUsers(ids: readonly string[], fetchUser: FetchUser): Promise<User[]> {
  // forEach 不等待回调返回的 Promise；push 的顺序是完成的顺序。
  // map 立即发出所有请求，Promise.all 等待全部完成、按输入的顺序返回，任何一个失败就以那个错误拒绝
  const users: User[] = [];
  await Promise.all(
    ids.map(async (id) => {
      users.push(await fetchUser(id));
    }),
  );
  return users;
}

/** 搜索框：每次输入调用 search，结果交给 render */
export function createSearch(fetchResults: FetchResults, render: (results: string[]) => void): (query: string) => Promise<void> {
  let latest = 0;
  return async (query) => {
    const id = ++latest;
    const results = await fetchResults(query);
    // 等待期间又发出了新的搜索：这个结果已经过时了
    if (id === latest) render(results);
  };
}
```
:::

:::variant{kind=wrong name=one-by-one fails=tests reason="改成了 for…of 中依次 await：结果正确，但请求是一个接一个发出的，总时间是所有请求之和"}
```ts file=loader.ts
export type User = { id: string; name: string };
export type FetchUser = (id: string) => Promise<User>;
export type FetchResults = (query: string) => Promise<string[]>;

/** 同时加载所有用户，按 ids 的顺序返回 */
export async function loadUsers(ids: readonly string[], fetchUser: FetchUser): Promise<User[]> {
  // forEach 不等待回调返回的 Promise；push 的顺序是完成的顺序。
  // map 立即发出所有请求，Promise.all 等待全部完成、按输入的顺序返回，任何一个失败就以那个错误拒绝
  const users: User[] = [];
  for (const id of ids) users.push(await fetchUser(id));
  return users;
}

/** 搜索框：每次输入调用 search，结果交给 render */
export function createSearch(fetchResults: FetchResults, render: (results: string[]) => void): (query: string) => Promise<void> {
  let latest = 0;
  return async (query) => {
    const id = ++latest;
    const results = await fetchResults(query);
    // 等待期间又发出了新的搜索：这个结果已经过时了
    if (id === latest) render(results);
  };
}
```
:::

:::variant{kind=wrong name=swallow-errors fails=tests reason="加载失败的用户被悄悄地跳过了：调用方以为一切正常"}
```ts file=loader.ts
export type User = { id: string; name: string };
export type FetchUser = (id: string) => Promise<User>;
export type FetchResults = (query: string) => Promise<string[]>;

/** 同时加载所有用户，按 ids 的顺序返回 */
export async function loadUsers(ids: readonly string[], fetchUser: FetchUser): Promise<User[]> {
  // forEach 不等待回调返回的 Promise；push 的顺序是完成的顺序。
  // map 立即发出所有请求，Promise.all 等待全部完成、按输入的顺序返回，任何一个失败就以那个错误拒绝
  const results = await Promise.allSettled(ids.map((id) => fetchUser(id)));
  return results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
}

/** 搜索框：每次输入调用 search，结果交给 render */
export function createSearch(fetchResults: FetchResults, render: (results: string[]) => void): (query: string) => Promise<void> {
  let latest = 0;
  return async (query) => {
    const id = ++latest;
    const results = await fetchResults(query);
    // 等待期间又发出了新的搜索：这个结果已经过时了
    if (id === latest) render(results);
  };
}
```
:::

:::variant{kind=wrong name=compare-query-text fails=tests reason="用搜索词判断是否过时：同一个词输入了两次时，旧的请求也被当成了最新的"}
```ts file=loader.ts
export type User = { id: string; name: string };
export type FetchUser = (id: string) => Promise<User>;
export type FetchResults = (query: string) => Promise<string[]>;

/** 同时加载所有用户，按 ids 的顺序返回 */
export async function loadUsers(ids: readonly string[], fetchUser: FetchUser): Promise<User[]> {
  // forEach 不等待回调返回的 Promise；push 的顺序是完成的顺序。
  // map 立即发出所有请求，Promise.all 等待全部完成、按输入的顺序返回，任何一个失败就以那个错误拒绝
  return Promise.all(ids.map((id) => fetchUser(id)));
}

/** 搜索框：每次输入调用 search，结果交给 render */
export function createSearch(fetchResults: FetchResults, render: (results: string[]) => void): (query: string) => Promise<void> {
  let latestQuery = '';
  return async (query) => {
    latestQuery = query;
    const results = await fetchResults(query);
    if (query === latestQuery) render(results);
  };
}
```
:::

:::variant{kind=wrong name=no-race-guard fails=tests reason="没有处理竞态：先发出的搜索后返回，覆盖了新的结果"}
```ts file=loader.ts
export type User = { id: string; name: string };
export type FetchUser = (id: string) => Promise<User>;
export type FetchResults = (query: string) => Promise<string[]>;

/** 同时加载所有用户，按 ids 的顺序返回 */
export async function loadUsers(ids: readonly string[], fetchUser: FetchUser): Promise<User[]> {
  // forEach 不等待回调返回的 Promise；push 的顺序是完成的顺序。
  // map 立即发出所有请求，Promise.all 等待全部完成、按输入的顺序返回，任何一个失败就以那个错误拒绝
  return Promise.all(ids.map((id) => fetchUser(id)));
}

/** 搜索框：每次输入调用 search，结果交给 render */
export function createSearch(fetchResults: FetchResults, render: (results: string[]) => void): (query: string) => Promise<void> {
  let latest = 0;
  return async (query) => {
    const id = ++latest;
    const results = await fetchResults(query);
    // 等待期间又发出了新的搜索：这个结果已经过时了
    render(results);
  };
}
```
:::
