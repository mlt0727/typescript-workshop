---
kind: challenge
title: 带标签的缓存
---
在 `cache.ts` 中实现 `createCache(now)`，模拟一个服务器上的共享缓存（`now()` 返回当前的时间，单位是秒）。它的规则来自 Next.js 16.4.2 的文档和源码中缓存处理器的约定，也就是正文中实测的页面缓存的行为：过了 `revalidate` 先返回旧值；Next.js 默认的内存缓存处理器则选择在 `revalidate` 时直接丢弃条目，这里不模拟这种做法。

1. `read(key, fill)`：读取 `key` 的缓存。`fill()` 产生新的值，同时给出这个值的 `life`（`revalidate`、`expire`）和 `tags`。返回 `{ value, outcome }`；
2. **四种情况**（`age` 是现在减去条目**开始填充**时的 `now()`）：
   - 没有条目：调用 `fill`，等它完成，保存并返回新的值，`outcome` 是 `'miss'`；
   - 条目过期（见第 6 条），或者 `age >= life.expire`：同样要等新的值，`outcome` 是 `'expired'`；
   - 条目变旧（见第 6 条），或者 `age >= life.revalidate`：**立刻**返回旧的值，`outcome` 是 `'stale'`，同时在后台调用 `fill` 刷新；
   - 其他情况：返回缓存的值，`outcome` 是 `'hit'`，不调用 `fill`；
3. **保存**：每次填充在**开始**时记下当时的 `now()` 和它开始的先后顺序，`fill` 完成时保存条目。如果这时已经保存着一个开始得**更晚**的条目，丢弃这次的结果（调用方仍然得到这次的值）。每个条目使用它自己那次填充给出的 `life` 和 `tags`；
4. **不重复填充**：一个键正在进行需要等待的填充时（`'miss'` 或 `'expired'`），同一个键的其他读取等同一次填充，得到同样的结果和同样的 `outcome` 类型；一个键正在后台刷新时，不再发起另一次后台刷新；
5. **失败**：需要等待的填充失败时，等待它的读取都以同样的错误失败，缓存不变（过期的条目仍然是过期的），下一次读取重新填充；后台刷新失败时保留旧的条目（仍然是旧的），下一次读取再试。后台刷新的失败不能变成没有被处理的 Promise 拒绝；
6. `revalidateTag(tag)`：带有这个标签、并且在这次调用**之前**开始填充的条目变旧；`updateTag(tag)`：同样的条目过期。之后才开始的填充不受影响。一个条目既过期又变旧时，算作过期。

:::files{role=starter}
```ts file=cache.ts
/** 单位都是秒 */
export type CacheLife = Readonly<{ revalidate: number; expire: number }>;
export type Fill<T> = Readonly<{ value: T; life: CacheLife; tags: readonly string[] }>;
export type Outcome = 'miss' | 'hit' | 'stale' | 'expired';
export type Read<T> = Readonly<{ value: T; outcome: Outcome }>;

export type Cache<T> = Readonly<{
  read(key: string, fill: () => Promise<Fill<T>>): Promise<Read<T>>;
  /** 在这之前开始填充的、带这个标签的条目变旧：读取时先返回旧值，同时在后台刷新 */
  revalidateTag(tag: string): void;
  /** 在这之前开始填充的、带这个标签的条目过期：读取时要等新的值 */
  updateTag(tag: string): void;
}>;

export function createCache<T>(now: () => number): Cache<T> {
  // TODO
  return {
    async read(key, fill) {
      const { value } = await fill();
      return { value, outcome: 'miss' };
    },
    revalidateTag() {},
    updateTag() {},
  };
}
```
```ts file=main.ts readonly
import { createCache, type Fill } from './cache';

const clock = { time: 0 };
const cache = createCache<string>(() => clock.time);

let version = 0;
const getStamp = async (): Promise<Fill<string>> => {
  version += 1;
  return { value: `第 ${version} 版`, life: { revalidate: 5, expire: 3600 }, tags: ['stamp'] };
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

for (const [time, action] of [[0, 'read'], [2, 'read'], [6, 'read'], [6.5, 'read'], [7, 'revalidateTag'], [7, 'read'], [8, 'read']] as const) {
  clock.time = time;
  if (action === 'revalidateTag') {
    cache.revalidateTag('stamp');
    console.log(`${time}s revalidateTag('stamp')`);
    continue;
  }
  const { value, outcome } = await cache.read('stamp', getStamp);
  console.log(`${time}s ${outcome.padEnd(7)} ${value}`);
  await settle();
}
```
:::

:::files{role=solution}
```ts file=cache.ts
/** 单位都是秒 */
export type CacheLife = Readonly<{ revalidate: number; expire: number }>;
export type Fill<T> = Readonly<{ value: T; life: CacheLife; tags: readonly string[] }>;
export type Outcome = 'miss' | 'hit' | 'stale' | 'expired';
export type Read<T> = Readonly<{ value: T; outcome: Outcome }>;

export type Cache<T> = Readonly<{
  read(key: string, fill: () => Promise<Fill<T>>): Promise<Read<T>>;
  /** 在这之前开始填充的、带这个标签的条目变旧：读取时先返回旧值，同时在后台刷新 */
  revalidateTag(tag: string): void;
  /** 在这之前开始填充的、带这个标签的条目过期：读取时要等新的值 */
  updateTag(tag: string): void;
}>;

type Entry<T> = {
  value: T;
  life: CacheLife;
  tags: readonly string[];
  /** 开始填充时的 now() */
  createdAt: number;
  /** 开始填充时的序号 */
  started: number;
};

export function createCache<T>(now: () => number): Cache<T> {
  const entries = new Map<string, Entry<T>>();
  /** 正在进行的、调用方需要等待的填充 */
  const blocking = new Map<string, Promise<T>>();
  /** 正在后台刷新的键 */
  const refreshing = new Set<string>();
  /** 递增的序号：每次开始填充、每次让标签失效都加一，用来判断事情发生的先后 */
  let sequence = 0;
  /** 每个标签最近一次 revalidateTag、updateTag 时的序号 */
  const staleSince = new Map<string, number>();
  const expiredSince = new Map<string, number>();

  /** 这个条目开始填充之后，它的某个标签被标记过 */
  const markedAfter = (marks: ReadonlyMap<string, number>, entry: Entry<T>) => entry.tags.some((tag) => (marks.get(tag) ?? 0) > entry.started);

  /** 运行 fill，完成之后保存条目；时间和序号都以开始的时候为准 */
  async function fillAndStore(key: string, fill: () => Promise<Fill<T>>): Promise<T> {
    const started = ++sequence;
    const createdAt = now();
    const { value, life, tags } = await fill();
    const current = entries.get(key);
    // 已经保存了一个开始得更晚的条目：这次的结果更旧，不能覆盖它
    if (current === undefined || current.started < started) entries.set(key, { value, life, tags, createdAt, started });
    return value;
  }

  function waitFor(key: string, fill: () => Promise<Fill<T>>): Promise<T> {
    let pending = blocking.get(key);
    if (pending === undefined) {
      pending = fillAndStore(key, fill).finally(() => blocking.delete(key));
      blocking.set(key, pending);
    }
    return pending;
  }

  function refreshInBackground(key: string, fill: () => Promise<Fill<T>>): void {
    if (refreshing.has(key)) return;
    refreshing.add(key);
    fillAndStore(key, fill)
      // 后台刷新失败：保留旧的条目，下一次读取再试
      .catch(() => {})
      .finally(() => refreshing.delete(key));
  }

  return {
    async read(key, fill) {
      const entry = entries.get(key);
      if (entry === undefined) return { value: await waitFor(key, fill), outcome: 'miss' };
      const age = now() - entry.createdAt;
      if (age >= entry.life.expire || markedAfter(expiredSince, entry)) return { value: await waitFor(key, fill), outcome: 'expired' };
      if (age >= entry.life.revalidate || markedAfter(staleSince, entry)) {
        refreshInBackground(key, fill);
        return { value: entry.value, outcome: 'stale' };
      }
      return { value: entry.value, outcome: 'hit' };
    },
    revalidateTag(tag) {
      staleSince.set(tag, ++sequence);
    },
    updateTag(tag) {
      expiredSince.set(tag, ++sequence);
    },
  };
}
```
```ts file=main.ts readonly
import { createCache, type Fill } from './cache';

const clock = { time: 0 };
const cache = createCache<string>(() => clock.time);

let version = 0;
const getStamp = async (): Promise<Fill<string>> => {
  version += 1;
  return { value: `第 ${version} 版`, life: { revalidate: 5, expire: 3600 }, tags: ['stamp'] };
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

for (const [time, action] of [[0, 'read'], [2, 'read'], [6, 'read'], [6.5, 'read'], [7, 'revalidateTag'], [7, 'read'], [8, 'read']] as const) {
  clock.time = time;
  if (action === 'revalidateTag') {
    cache.revalidateTag('stamp');
    console.log(`${time}s revalidateTag('stamp')`);
    continue;
  }
  const { value, outcome } = await cache.read('stamp', getStamp);
  console.log(`${time}s ${outcome.padEnd(7)} ${value}`);
  await settle();
}
```
:::

:::files{role=tests}
```ts file=cache.test.ts
import { describe, expect, test } from 'vitest';
import { createCache, type CacheLife, type Fill } from './cache';

const LIFE: CacheLife = { revalidate: 5, expire: 3600 };

/** 一个假的时钟和一个会计数的数据源：第 n 次调用得到 'v{n}' */
function setup(life: CacheLife = LIFE, tags: readonly string[] = ['stamp']) {
  const clock = { time: 0 };
  const cache = createCache<string>(() => clock.time);
  let calls = 0;
  const fill = async (): Promise<Fill<string>> => {
    calls += 1;
    return { value: `v${calls}`, life, tags };
  };
  return { clock, cache, fill, calls: () => calls };
}

/** 一个由测试决定什么时候完成的 Promise */
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** 等后台的工作（几轮微任务）完成 */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createCache', () => {
  test('第一次是 miss，之后在 revalidate 之前都是 hit', async () => {
    const { clock, cache, fill, calls } = setup();
    expect(await cache.read('k', fill)).toStrictEqual({ value: 'v1', outcome: 'miss' });
    clock.time = 4.9;
    expect(await cache.read('k', fill)).toStrictEqual({ value: 'v1', outcome: 'hit' });
    expect(calls()).toBe(1);
  });

  test('过了 revalidate：先返回旧值，同时在后台刷新，下一次就是新值', async () => {
    const { clock, cache, fill, calls } = setup();
    await cache.read('k', fill);
    clock.time = 5;
    expect(await cache.read('k', fill)).toStrictEqual({ value: 'v1', outcome: 'stale' });
    await settle();
    expect(calls()).toBe(2);
    expect(await cache.read('k', fill)).toStrictEqual({ value: 'v2', outcome: 'hit' });
  });

  test('后台刷新还没完成时，再次读取不会再发起一次刷新', async () => {
    const { clock, cache, fill } = setup();
    await cache.read('k', fill);
    clock.time = 6;
    const refresh = deferred<Fill<string>>();
    let refreshCalls = 0;
    const slowFill = () => {
      refreshCalls += 1;
      return refresh.promise;
    };
    expect(await cache.read('k', slowFill)).toStrictEqual({ value: 'v1', outcome: 'stale' });
    expect(await cache.read('k', slowFill)).toStrictEqual({ value: 'v1', outcome: 'stale' });
    expect(refreshCalls).toBe(1);
    refresh.resolve({ value: 'new', life: LIFE, tags: [] });
    await settle();
    expect(await cache.read('k', slowFill)).toStrictEqual({ value: 'new', outcome: 'hit' });
  });

  test('条目的时间从开始填充时算起', async () => {
    const { clock, cache } = setup();
    const pending = deferred<Fill<string>>();
    const reading = cache.read('k', () => pending.promise);
    clock.time = 3;
    pending.resolve({ value: 'slow', life: LIFE, tags: [] });
    expect(await reading).toStrictEqual({ value: 'slow', outcome: 'miss' });
    clock.time = 4.9;
    expect(await cache.read('k', () => pending.promise)).toStrictEqual({ value: 'slow', outcome: 'hit' });
    clock.time = 5;
    expect(await cache.read('k', () => pending.promise)).toStrictEqual({ value: 'slow', outcome: 'stale' });
    await settle();
  });

  test('写入之前开始的后台刷新，完成得再晚也不能覆盖写入之后的新值', async () => {
    const { clock, cache } = setup();
    await cache.read('k', async () => ({ value: 'v1', life: LIFE, tags: ['stamp'] }));
    clock.time = 6;
    // 后台刷新开始了：它读到的是写入之前的数据，而且很慢
    const slow = deferred<Fill<string>>();
    expect(await cache.read('k', () => slow.promise)).toStrictEqual({ value: 'v1', outcome: 'stale' });
    // 用户写入数据，让标签立刻过期
    cache.updateTag('stamp');
    const fresh = async (): Promise<Fill<string>> => ({ value: 'after-write', life: LIFE, tags: ['stamp'] });
    expect(await cache.read('k', fresh)).toStrictEqual({ value: 'after-write', outcome: 'expired' });
    // 慢的后台刷新现在才完成
    slow.resolve({ value: 'before-write', life: LIFE, tags: ['stamp'] });
    await settle();
    expect(await cache.read('k', fresh)).toStrictEqual({ value: 'after-write', outcome: 'hit' });
  });

  test('标签失效只影响在它之前开始的填充', async () => {
    const { cache } = setup();
    const pending = deferred<Fill<string>>();
    const reading = cache.read('k', () => pending.promise);
    cache.revalidateTag('stamp');
    pending.resolve({ value: 'started-before', life: LIFE, tags: ['stamp'] });
    await reading;
    expect(await cache.read('k', async () => ({ value: 'v2', life: LIFE, tags: ['stamp'] }))).toStrictEqual({ value: 'started-before', outcome: 'stale' });
    await settle();
    // 后台刷新是在 revalidateTag 之后开始的：它的结果不受影响
    expect(await cache.read('k', async () => ({ value: 'v3', life: LIFE, tags: ['stamp'] }))).toStrictEqual({ value: 'v2', outcome: 'hit' });
  });

  test('每一轮变旧都会刷新', async () => {
    const { clock, cache, fill, calls } = setup();
    await cache.read('k', fill);
    clock.time = 5;
    await cache.read('k', fill);
    await settle();
    clock.time = 10;
    expect(await cache.read('k', fill)).toStrictEqual({ value: 'v2', outcome: 'stale' });
    await settle();
    expect(calls()).toBe(3);
    expect(await cache.read('k', fill)).toStrictEqual({ value: 'v3', outcome: 'hit' });
  });

  test('过了 expire：要等新的值', async () => {
    const { clock, cache, fill } = setup({ revalidate: 5, expire: 60 });
    await cache.read('k', fill);
    clock.time = 60;
    const next = deferred<Fill<string>>();
    let done = false;
    const reading = cache.read('k', () => next.promise).then((result) => {
      done = true;
      return result;
    });
    await settle();
    expect(done).toBe(false);
    next.resolve({ value: 'fresh', life: LIFE, tags: [] });
    expect(await reading).toStrictEqual({ value: 'fresh', outcome: 'expired' });
  });

  test('同时发出的几次 expired 读取也共用一次填充', async () => {
    const { clock, cache, fill, calls } = setup({ revalidate: 5, expire: 60 });
    await cache.read('k', fill);
    clock.time = 60;
    const results = await Promise.all([cache.read('k', fill), cache.read('k', fill)]);
    expect(results).toStrictEqual([
      { value: 'v2', outcome: 'expired' },
      { value: 'v2', outcome: 'expired' },
    ]);
    expect(calls()).toBe(2);
  });

  test('过期之后的填充失败：等待的读取都失败，旧的条目仍然是过期的', async () => {
    const { clock, cache, fill } = setup({ revalidate: 5, expire: 60 });
    await cache.read('k', fill);
    clock.time = 60;
    const failing = async (): Promise<Fill<string>> => {
      throw new Error('上游超时');
    };
    const results = await Promise.allSettled([cache.read('k', failing), cache.read('k', failing)]);
    expect(results.map((result) => result.status)).toStrictEqual(['rejected', 'rejected']);
    expect(await cache.read('k', fill)).toStrictEqual({ value: 'v2', outcome: 'expired' });
  });

  test('同时发出的几次 miss 共用一次填充', async () => {
    const { cache, fill, calls } = setup();
    const results = await Promise.all([cache.read('k', fill), cache.read('k', fill), cache.read('k', fill)]);
    expect(results).toStrictEqual([
      { value: 'v1', outcome: 'miss' },
      { value: 'v1', outcome: 'miss' },
      { value: 'v1', outcome: 'miss' },
    ]);
    expect(calls()).toBe(1);
  });

  test('需要等待的填充失败：这次读取失败，什么也不保存，下一次再试', async () => {
    const { cache, fill } = setup();
    const failing = async (): Promise<Fill<string>> => {
      throw new Error('数据库不可用');
    };
    await expect(cache.read('k', failing)).rejects.toThrow('数据库不可用');
    expect(await cache.read('k', fill)).toStrictEqual({ value: 'v1', outcome: 'miss' });
  });

  test('后台刷新失败：继续返回旧值，下一次读取再试', async () => {
    const { clock, cache, fill } = setup();
    await cache.read('k', fill);
    clock.time = 10;
    let failures = 0;
    const failing = async (): Promise<Fill<string>> => {
      failures += 1;
      throw new Error('上游超时');
    };
    expect(await cache.read('k', failing)).toStrictEqual({ value: 'v1', outcome: 'stale' });
    await settle();
    expect(await cache.read('k', failing)).toStrictEqual({ value: 'v1', outcome: 'stale' });
    await settle();
    expect(failures).toBe(2);
  });

  test('revalidateTag：有这个标签的条目变旧（先返回旧值），其他的不受影响', async () => {
    const { cache, fill } = setup();
    await cache.read('a', fill);
    const other = async (): Promise<Fill<string>> => ({ value: 'o1', life: LIFE, tags: ['other'] });
    await cache.read('b', other);
    cache.revalidateTag('stamp');
    expect(await cache.read('a', fill)).toStrictEqual({ value: 'v1', outcome: 'stale' });
    expect(await cache.read('b', other)).toStrictEqual({ value: 'o1', outcome: 'hit' });
    await settle();
    expect(await cache.read('a', fill)).toStrictEqual({ value: 'v2', outcome: 'hit' });
  });

  test('updateTag：有这个标签的条目立刻过期，下一次读取等新的值', async () => {
    const { cache, fill } = setup();
    await cache.read('a', fill);
    cache.updateTag('stamp');
    expect(await cache.read('a', fill)).toStrictEqual({ value: 'v2', outcome: 'expired' });
    expect(await cache.read('a', fill)).toStrictEqual({ value: 'v2', outcome: 'hit' });
  });

  test('先 updateTag 再 revalidateTag：仍然是过期的', async () => {
    const { cache, fill } = setup();
    await cache.read('a', fill);
    cache.updateTag('stamp');
    cache.revalidateTag('stamp');
    expect(await cache.read('a', fill)).toStrictEqual({ value: 'v2', outcome: 'expired' });
  });

  test('每次填充带着自己的 life 和 tags', async () => {
    const { clock, cache } = setup();
    let n = 0;
    const fill = async (): Promise<Fill<string>> => {
      n += 1;
      return n === 1 ? { value: 'short', life: { revalidate: 1, expire: 2 }, tags: ['x'] } : { value: 'long', life: LIFE, tags: ['y'] };
    };
    await cache.read('k', fill);
    clock.time = 2;
    expect(await cache.read('k', fill)).toStrictEqual({ value: 'long', outcome: 'expired' });
    cache.updateTag('x');
    expect(await cache.read('k', fill)).toStrictEqual({ value: 'long', outcome: 'hit' });
  });
});
```
:::

:::hint{level=1}
需要几份状态：保存的条目（`Map<string, Entry>`，条目中有值、`life`、`tags`、开始填充的时间和序号），正在进行的需要等待的填充（`Map<string, Promise<T>>`），正在后台刷新的键（`Set<string>`），以及每个标签最近一次变旧、过期时的序号。“先后顺序”用一个每次开始填充、每次标签失效都加一的计数器表示。`read` 先找条目，再按“过期 → 变旧 → 命中”的顺序判断。
:::

:::hint{level=2}
写一个 `fillAndStore(key, fill)`：先取序号和 `now()`，再 `await fill()`，保存之前比较已有条目的序号。条目“在标签失效之前开始”就是：标签失效时的序号大于条目的序号。需要等待时，先看 `Map` 中有没有这个键的 Promise，没有才调用 `fillAndStore`，并在 `.finally` 中删掉它。后台刷新调用 `fillAndStore` 之后接上 `.catch(() => {})`，否则失败的 Promise 没有人处理。
:::

:::explanation
`revalidate` 和 `expire` 分开，是在“快”和“新”之间取舍：过了 `revalidate`，数据可能已经旧了，但大多数时候先返回旧值、在后台刷新（stale-while-revalidate）用户感觉不到；过了 `expire`，旧值已经旧得不能用了，只能让这一次请求等。正文中实测的响应头 `Cache-Control: s-maxage=5, stale-while-revalidate=3595` 说的正是这件事：5 秒内是新的，之后的 3595 秒内可以先用旧的。

“不重复填充”很重要：一个热门的缓存过期的那一刻，可能同时有几百个请求到达，如果每个请求都去查数据库，数据库会被这一下打垮（缓存击穿）。让同一个键的请求共用一次填充，上游只被查一次。

`revalidateTag` 和 `updateTag` 的区别也是同样的取舍。后台的系统（例如 CMS 的 webhook）修改了数据，用 `revalidateTag`：稍后才看到新内容没关系。用户自己刚刚修改了数据，用 `updateTag`：他下一次看到的必须是自己的修改（“读到自己的写入”），所以宁可等。

后台刷新失败时保留旧值，是缓存的另一个好处：上游暂时不可用时，用户仍然能看到稍微旧一点的内容，而不是一个错误页面。

为什么以**开始**填充的时间为准？想象一个慢的后台刷新：它在用户写入之前开始读数据库，读到的是旧的数据，在写入之后才完成。如果按完成的时间算，这份旧的数据会被当成刚刚生成的新值，`updateTag` 就白调用了。Next.js 也是这样做的：它的源码中记录的是开始计算结果的时间，标签失效时比较的是“失效是否发生在这个时间之后”。这里用一个递增的序号代替时间来比较先后，因为测试中的时钟可能不动，两件事的时间可能相同。

替代解用一个类，把每个键的所有状态（条目、标记、正在进行的填充）放在同一个对象中。
:::

:::variant{kind=alt name=slot-class}
```ts file=cache.ts
/** 单位都是秒 */
export type CacheLife = Readonly<{ revalidate: number; expire: number }>;
export type Fill<T> = Readonly<{ value: T; life: CacheLife; tags: readonly string[] }>;
export type Outcome = 'miss' | 'hit' | 'stale' | 'expired';
export type Read<T> = Readonly<{ value: T; outcome: Outcome }>;

export type Cache<T> = Readonly<{
  read(key: string, fill: () => Promise<Fill<T>>): Promise<Read<T>>;
  /** 在这之前开始填充的、带这个标签的条目变旧：读取时先返回旧值，同时在后台刷新 */
  revalidateTag(tag: string): void;
  /** 在这之前开始填充的、带这个标签的条目过期：读取时要等新的值 */
  updateTag(tag: string): void;
}>;

/** 一个键的全部状态：当前的条目，以及正在进行的填充 */
class Slot<T> {
  current: { value: T; life: CacheLife; tags: readonly string[]; createdAt: number; started: number } | undefined;
  blocking: Promise<T> | undefined;
  refreshing = false;
}

class TaggedCache<T> {
  readonly #slots = new Map<string, Slot<T>>();
  readonly #now: () => number;
  /** 事件的先后：开始填充、标签失效都从这里取下一个号 */
  #clock = 0;
  /** 标签 → 最近一次失效的号和种类 */
  readonly #marks = new Map<string, { stale: number; expired: number }>();

  constructor(now: () => number) {
    this.#now = now;
  }

  #slot(key: string): Slot<T> {
    let slot = this.#slots.get(key);
    if (slot === undefined) {
      slot = new Slot<T>();
      this.#slots.set(key, slot);
    }
    return slot;
  }

  async #fill(slot: Slot<T>, fill: () => Promise<Fill<T>>): Promise<T> {
    const started = ++this.#clock;
    const createdAt = this.#now();
    const result = await fill();
    if (slot.current === undefined || slot.current.started < started) slot.current = { ...result, createdAt, started };
    return result.value;
  }

  #wait(slot: Slot<T>, fill: () => Promise<Fill<T>>): Promise<T> {
    slot.blocking ??= this.#fill(slot, fill).finally(() => {
      slot.blocking = undefined;
    });
    return slot.blocking;
  }

  /** 条目开始填充之后，它的标签中最近的一次失效是哪一种 */
  #invalidation(started: number, tags: readonly string[]): 'none' | 'stale' | 'expired' {
    let result: 'none' | 'stale' | 'expired' = 'none';
    for (const tag of tags) {
      const mark = this.#marks.get(tag);
      if (mark === undefined) continue;
      if (mark.expired > started) return 'expired';
      if (mark.stale > started) result = 'stale';
    }
    return result;
  }

  async read(key: string, fill: () => Promise<Fill<T>>): Promise<Read<T>> {
    const slot = this.#slot(key);
    const current = slot.current;
    if (current === undefined) return { value: await this.#wait(slot, fill), outcome: 'miss' };
    const age = this.#now() - current.createdAt;
    const invalidation = this.#invalidation(current.started, current.tags);
    if (invalidation === 'expired' || age >= current.life.expire) return { value: await this.#wait(slot, fill), outcome: 'expired' };
    if (invalidation === 'stale' || age >= current.life.revalidate) {
      if (!slot.refreshing) {
        slot.refreshing = true;
        this.#fill(slot, fill)
          .catch(() => {})
          .finally(() => {
            slot.refreshing = false;
          });
      }
      return { value: current.value, outcome: 'stale' };
    }
    return { value: current.value, outcome: 'hit' };
  }

  #mark(tag: string, kind: 'stale' | 'expired'): void {
    const mark = this.#marks.get(tag) ?? { stale: 0, expired: 0 };
    this.#marks.set(tag, kind === 'stale' ? { ...mark, stale: ++this.#clock } : { ...mark, expired: ++this.#clock });
  }

  revalidateTag(tag: string): void {
    this.#mark(tag, 'stale');
  }

  updateTag(tag: string): void {
    this.#mark(tag, 'expired');
  }
}

export function createCache<T>(now: () => number): Cache<T> {
  const cache = new TaggedCache<T>(now);
  return {
    read: (key, fill) => cache.read(key, fill),
    revalidateTag: (tag) => cache.revalidateTag(tag),
    updateTag: (tag) => cache.updateTag(tag),
  };
}
```
:::

:::variant{kind=wrong name=block-on-stale fails=tests reason="变旧之后也等新的值：失去了先返回旧值的意义，用户要一直等上游"}
```ts file=cache.ts
/** 单位都是秒 */
export type CacheLife = Readonly<{ revalidate: number; expire: number }>;
export type Fill<T> = Readonly<{ value: T; life: CacheLife; tags: readonly string[] }>;
export type Outcome = 'miss' | 'hit' | 'stale' | 'expired';
export type Read<T> = Readonly<{ value: T; outcome: Outcome }>;

export type Cache<T> = Readonly<{
  read(key: string, fill: () => Promise<Fill<T>>): Promise<Read<T>>;
  /** 在这之前开始填充的、带这个标签的条目变旧：读取时先返回旧值，同时在后台刷新 */
  revalidateTag(tag: string): void;
  /** 在这之前开始填充的、带这个标签的条目过期：读取时要等新的值 */
  updateTag(tag: string): void;
}>;

type Entry<T> = {
  value: T;
  life: CacheLife;
  tags: readonly string[];
  /** 开始填充时的 now() */
  createdAt: number;
  /** 开始填充时的序号 */
  started: number;
};

export function createCache<T>(now: () => number): Cache<T> {
  const entries = new Map<string, Entry<T>>();
  /** 正在进行的、调用方需要等待的填充 */
  const blocking = new Map<string, Promise<T>>();
  /** 正在后台刷新的键 */
  const refreshing = new Set<string>();
  /** 递增的序号：每次开始填充、每次让标签失效都加一，用来判断事情发生的先后 */
  let sequence = 0;
  /** 每个标签最近一次 revalidateTag、updateTag 时的序号 */
  const staleSince = new Map<string, number>();
  const expiredSince = new Map<string, number>();

  /** 这个条目开始填充之后，它的某个标签被标记过 */
  const markedAfter = (marks: ReadonlyMap<string, number>, entry: Entry<T>) => entry.tags.some((tag) => (marks.get(tag) ?? 0) > entry.started);

  /** 运行 fill，完成之后保存条目；时间和序号都以开始的时候为准 */
  async function fillAndStore(key: string, fill: () => Promise<Fill<T>>): Promise<T> {
    const started = ++sequence;
    const createdAt = now();
    const { value, life, tags } = await fill();
    const current = entries.get(key);
    // 已经保存了一个开始得更晚的条目：这次的结果更旧，不能覆盖它
    if (current === undefined || current.started < started) entries.set(key, { value, life, tags, createdAt, started });
    return value;
  }

  function waitFor(key: string, fill: () => Promise<Fill<T>>): Promise<T> {
    let pending = blocking.get(key);
    if (pending === undefined) {
      pending = fillAndStore(key, fill).finally(() => blocking.delete(key));
      blocking.set(key, pending);
    }
    return pending;
  }

  function refreshInBackground(key: string, fill: () => Promise<Fill<T>>): void {
    if (refreshing.has(key)) return;
    refreshing.add(key);
    fillAndStore(key, fill)
      // 后台刷新失败：保留旧的条目，下一次读取再试
      .catch(() => {})
      .finally(() => refreshing.delete(key));
  }

  return {
    async read(key, fill) {
      const entry = entries.get(key);
      if (entry === undefined) return { value: await waitFor(key, fill), outcome: 'miss' };
      const age = now() - entry.createdAt;
      if (age >= entry.life.expire || markedAfter(expiredSince, entry)) return { value: await waitFor(key, fill), outcome: 'expired' };
      if (age >= entry.life.revalidate || markedAfter(staleSince, entry)) {
        return { value: await waitFor(key, fill), outcome: 'stale' };
      }
      return { value: entry.value, outcome: 'hit' };
    },
    revalidateTag(tag) {
      staleSince.set(tag, ++sequence);
    },
    updateTag(tag) {
      expiredSince.set(tag, ++sequence);
    },
  };
}
```
:::

:::variant{kind=wrong name=created-at-end fails=tests reason="从填充完成的时间算起：一个慢的填充开始之后改变的数据，可能被当成新的保存很久"}
```ts file=cache.ts
/** 单位都是秒 */
export type CacheLife = Readonly<{ revalidate: number; expire: number }>;
export type Fill<T> = Readonly<{ value: T; life: CacheLife; tags: readonly string[] }>;
export type Outcome = 'miss' | 'hit' | 'stale' | 'expired';
export type Read<T> = Readonly<{ value: T; outcome: Outcome }>;

export type Cache<T> = Readonly<{
  read(key: string, fill: () => Promise<Fill<T>>): Promise<Read<T>>;
  /** 在这之前开始填充的、带这个标签的条目变旧：读取时先返回旧值，同时在后台刷新 */
  revalidateTag(tag: string): void;
  /** 在这之前开始填充的、带这个标签的条目过期：读取时要等新的值 */
  updateTag(tag: string): void;
}>;

type Entry<T> = {
  value: T;
  life: CacheLife;
  tags: readonly string[];
  /** 开始填充时的 now() */
  createdAt: number;
  /** 开始填充时的序号 */
  started: number;
};

export function createCache<T>(now: () => number): Cache<T> {
  const entries = new Map<string, Entry<T>>();
  /** 正在进行的、调用方需要等待的填充 */
  const blocking = new Map<string, Promise<T>>();
  /** 正在后台刷新的键 */
  const refreshing = new Set<string>();
  /** 递增的序号：每次开始填充、每次让标签失效都加一，用来判断事情发生的先后 */
  let sequence = 0;
  /** 每个标签最近一次 revalidateTag、updateTag 时的序号 */
  const staleSince = new Map<string, number>();
  const expiredSince = new Map<string, number>();

  /** 这个条目开始填充之后，它的某个标签被标记过 */
  const markedAfter = (marks: ReadonlyMap<string, number>, entry: Entry<T>) => entry.tags.some((tag) => (marks.get(tag) ?? 0) > entry.started);

  /** 运行 fill，完成之后保存条目；时间和序号都以开始的时候为准 */
  async function fillAndStore(key: string, fill: () => Promise<Fill<T>>): Promise<T> {
    const started = ++sequence;
    const { value, life, tags } = await fill();
    const createdAt = now();
    const current = entries.get(key);
    // 已经保存了一个开始得更晚的条目：这次的结果更旧，不能覆盖它
    if (current === undefined || current.started < started) entries.set(key, { value, life, tags, createdAt, started });
    return value;
  }

  function waitFor(key: string, fill: () => Promise<Fill<T>>): Promise<T> {
    let pending = blocking.get(key);
    if (pending === undefined) {
      pending = fillAndStore(key, fill).finally(() => blocking.delete(key));
      blocking.set(key, pending);
    }
    return pending;
  }

  function refreshInBackground(key: string, fill: () => Promise<Fill<T>>): void {
    if (refreshing.has(key)) return;
    refreshing.add(key);
    fillAndStore(key, fill)
      // 后台刷新失败：保留旧的条目，下一次读取再试
      .catch(() => {})
      .finally(() => refreshing.delete(key));
  }

  return {
    async read(key, fill) {
      const entry = entries.get(key);
      if (entry === undefined) return { value: await waitFor(key, fill), outcome: 'miss' };
      const age = now() - entry.createdAt;
      if (age >= entry.life.expire || markedAfter(expiredSince, entry)) return { value: await waitFor(key, fill), outcome: 'expired' };
      if (age >= entry.life.revalidate || markedAfter(staleSince, entry)) {
        refreshInBackground(key, fill);
        return { value: entry.value, outcome: 'stale' };
      }
      return { value: entry.value, outcome: 'hit' };
    },
    revalidateTag(tag) {
      staleSince.set(tag, ++sequence);
    },
    updateTag(tag) {
      expiredSince.set(tag, ++sequence);
    },
  };
}
```
:::

:::variant{kind=wrong name=always-store fails=tests reason="填充完成时总是保存：写入之前开始的慢的后台刷新，把写入之后的新值覆盖了"}
```ts file=cache.ts
/** 单位都是秒 */
export type CacheLife = Readonly<{ revalidate: number; expire: number }>;
export type Fill<T> = Readonly<{ value: T; life: CacheLife; tags: readonly string[] }>;
export type Outcome = 'miss' | 'hit' | 'stale' | 'expired';
export type Read<T> = Readonly<{ value: T; outcome: Outcome }>;

export type Cache<T> = Readonly<{
  read(key: string, fill: () => Promise<Fill<T>>): Promise<Read<T>>;
  /** 在这之前开始填充的、带这个标签的条目变旧：读取时先返回旧值，同时在后台刷新 */
  revalidateTag(tag: string): void;
  /** 在这之前开始填充的、带这个标签的条目过期：读取时要等新的值 */
  updateTag(tag: string): void;
}>;

type Entry<T> = {
  value: T;
  life: CacheLife;
  tags: readonly string[];
  /** 开始填充时的 now() */
  createdAt: number;
  /** 开始填充时的序号 */
  started: number;
};

export function createCache<T>(now: () => number): Cache<T> {
  const entries = new Map<string, Entry<T>>();
  /** 正在进行的、调用方需要等待的填充 */
  const blocking = new Map<string, Promise<T>>();
  /** 正在后台刷新的键 */
  const refreshing = new Set<string>();
  /** 递增的序号：每次开始填充、每次让标签失效都加一，用来判断事情发生的先后 */
  let sequence = 0;
  /** 每个标签最近一次 revalidateTag、updateTag 时的序号 */
  const staleSince = new Map<string, number>();
  const expiredSince = new Map<string, number>();

  /** 这个条目开始填充之后，它的某个标签被标记过 */
  const markedAfter = (marks: ReadonlyMap<string, number>, entry: Entry<T>) => entry.tags.some((tag) => (marks.get(tag) ?? 0) > entry.started);

  /** 运行 fill，完成之后保存条目；时间和序号都以开始的时候为准 */
  async function fillAndStore(key: string, fill: () => Promise<Fill<T>>): Promise<T> {
    const started = ++sequence;
    const createdAt = now();
    const { value, life, tags } = await fill();
    const current = entries.get(key);
    // 已经保存了一个开始得更晚的条目：这次的结果更旧，不能覆盖它
    void current;
    entries.set(key, { value, life, tags, createdAt, started });
    return value;
  }

  function waitFor(key: string, fill: () => Promise<Fill<T>>): Promise<T> {
    let pending = blocking.get(key);
    if (pending === undefined) {
      pending = fillAndStore(key, fill).finally(() => blocking.delete(key));
      blocking.set(key, pending);
    }
    return pending;
  }

  function refreshInBackground(key: string, fill: () => Promise<Fill<T>>): void {
    if (refreshing.has(key)) return;
    refreshing.add(key);
    fillAndStore(key, fill)
      // 后台刷新失败：保留旧的条目，下一次读取再试
      .catch(() => {})
      .finally(() => refreshing.delete(key));
  }

  return {
    async read(key, fill) {
      const entry = entries.get(key);
      if (entry === undefined) return { value: await waitFor(key, fill), outcome: 'miss' };
      const age = now() - entry.createdAt;
      if (age >= entry.life.expire || markedAfter(expiredSince, entry)) return { value: await waitFor(key, fill), outcome: 'expired' };
      if (age >= entry.life.revalidate || markedAfter(staleSince, entry)) {
        refreshInBackground(key, fill);
        return { value: entry.value, outcome: 'stale' };
      }
      return { value: entry.value, outcome: 'hit' };
    },
    revalidateTag(tag) {
      staleSince.set(tag, ++sequence);
    },
    updateTag(tag) {
      expiredSince.set(tag, ++sequence);
    },
  };
}
```
:::

:::variant{kind=wrong name=no-refresh-dedupe fails=tests reason="每次读到旧值都发起一次后台刷新：同一个键同时有好几个刷新"}
```ts file=cache.ts
/** 单位都是秒 */
export type CacheLife = Readonly<{ revalidate: number; expire: number }>;
export type Fill<T> = Readonly<{ value: T; life: CacheLife; tags: readonly string[] }>;
export type Outcome = 'miss' | 'hit' | 'stale' | 'expired';
export type Read<T> = Readonly<{ value: T; outcome: Outcome }>;

export type Cache<T> = Readonly<{
  read(key: string, fill: () => Promise<Fill<T>>): Promise<Read<T>>;
  /** 在这之前开始填充的、带这个标签的条目变旧：读取时先返回旧值，同时在后台刷新 */
  revalidateTag(tag: string): void;
  /** 在这之前开始填充的、带这个标签的条目过期：读取时要等新的值 */
  updateTag(tag: string): void;
}>;

type Entry<T> = {
  value: T;
  life: CacheLife;
  tags: readonly string[];
  /** 开始填充时的 now() */
  createdAt: number;
  /** 开始填充时的序号 */
  started: number;
};

export function createCache<T>(now: () => number): Cache<T> {
  const entries = new Map<string, Entry<T>>();
  /** 正在进行的、调用方需要等待的填充 */
  const blocking = new Map<string, Promise<T>>();
  /** 正在后台刷新的键 */
  const refreshing = new Set<string>();
  /** 递增的序号：每次开始填充、每次让标签失效都加一，用来判断事情发生的先后 */
  let sequence = 0;
  /** 每个标签最近一次 revalidateTag、updateTag 时的序号 */
  const staleSince = new Map<string, number>();
  const expiredSince = new Map<string, number>();

  /** 这个条目开始填充之后，它的某个标签被标记过 */
  const markedAfter = (marks: ReadonlyMap<string, number>, entry: Entry<T>) => entry.tags.some((tag) => (marks.get(tag) ?? 0) > entry.started);

  /** 运行 fill，完成之后保存条目；时间和序号都以开始的时候为准 */
  async function fillAndStore(key: string, fill: () => Promise<Fill<T>>): Promise<T> {
    const started = ++sequence;
    const createdAt = now();
    const { value, life, tags } = await fill();
    const current = entries.get(key);
    // 已经保存了一个开始得更晚的条目：这次的结果更旧，不能覆盖它
    if (current === undefined || current.started < started) entries.set(key, { value, life, tags, createdAt, started });
    return value;
  }

  function waitFor(key: string, fill: () => Promise<Fill<T>>): Promise<T> {
    let pending = blocking.get(key);
    if (pending === undefined) {
      pending = fillAndStore(key, fill).finally(() => blocking.delete(key));
      blocking.set(key, pending);
    }
    return pending;
  }

  function refreshInBackground(key: string, fill: () => Promise<Fill<T>>): void {
    refreshing.add(key);
    fillAndStore(key, fill)
      // 后台刷新失败：保留旧的条目，下一次读取再试
      .catch(() => {})
      .finally(() => refreshing.delete(key));
  }

  return {
    async read(key, fill) {
      const entry = entries.get(key);
      if (entry === undefined) return { value: await waitFor(key, fill), outcome: 'miss' };
      const age = now() - entry.createdAt;
      if (age >= entry.life.expire || markedAfter(expiredSince, entry)) return { value: await waitFor(key, fill), outcome: 'expired' };
      if (age >= entry.life.revalidate || markedAfter(staleSince, entry)) {
        refreshInBackground(key, fill);
        return { value: entry.value, outcome: 'stale' };
      }
      return { value: entry.value, outcome: 'hit' };
    },
    revalidateTag(tag) {
      staleSince.set(tag, ++sequence);
    },
    updateTag(tag) {
      expiredSince.set(tag, ++sequence);
    },
  };
}
```
:::

:::variant{kind=wrong name=no-miss-dedupe fails=tests reason="同时发出的几次 miss 各自填充一次：上游被同样的请求打了好几次"}
```ts file=cache.ts
/** 单位都是秒 */
export type CacheLife = Readonly<{ revalidate: number; expire: number }>;
export type Fill<T> = Readonly<{ value: T; life: CacheLife; tags: readonly string[] }>;
export type Outcome = 'miss' | 'hit' | 'stale' | 'expired';
export type Read<T> = Readonly<{ value: T; outcome: Outcome }>;

export type Cache<T> = Readonly<{
  read(key: string, fill: () => Promise<Fill<T>>): Promise<Read<T>>;
  /** 在这之前开始填充的、带这个标签的条目变旧：读取时先返回旧值，同时在后台刷新 */
  revalidateTag(tag: string): void;
  /** 在这之前开始填充的、带这个标签的条目过期：读取时要等新的值 */
  updateTag(tag: string): void;
}>;

type Entry<T> = {
  value: T;
  life: CacheLife;
  tags: readonly string[];
  /** 开始填充时的 now() */
  createdAt: number;
  /** 开始填充时的序号 */
  started: number;
};

export function createCache<T>(now: () => number): Cache<T> {
  const entries = new Map<string, Entry<T>>();
  /** 正在进行的、调用方需要等待的填充 */
  const blocking = new Map<string, Promise<T>>();
  /** 正在后台刷新的键 */
  const refreshing = new Set<string>();
  /** 递增的序号：每次开始填充、每次让标签失效都加一，用来判断事情发生的先后 */
  let sequence = 0;
  /** 每个标签最近一次 revalidateTag、updateTag 时的序号 */
  const staleSince = new Map<string, number>();
  const expiredSince = new Map<string, number>();

  /** 这个条目开始填充之后，它的某个标签被标记过 */
  const markedAfter = (marks: ReadonlyMap<string, number>, entry: Entry<T>) => entry.tags.some((tag) => (marks.get(tag) ?? 0) > entry.started);

  /** 运行 fill，完成之后保存条目；时间和序号都以开始的时候为准 */
  async function fillAndStore(key: string, fill: () => Promise<Fill<T>>): Promise<T> {
    const started = ++sequence;
    const createdAt = now();
    const { value, life, tags } = await fill();
    const current = entries.get(key);
    // 已经保存了一个开始得更晚的条目：这次的结果更旧，不能覆盖它
    if (current === undefined || current.started < started) entries.set(key, { value, life, tags, createdAt, started });
    return value;
  }

  function waitFor(key: string, fill: () => Promise<Fill<T>>): Promise<T> {
    let pending: Promise<T> | undefined;
    if (pending === undefined) {
      pending = fillAndStore(key, fill).finally(() => blocking.delete(key));
      blocking.set(key, pending);
    }
    return pending;
  }

  function refreshInBackground(key: string, fill: () => Promise<Fill<T>>): void {
    if (refreshing.has(key)) return;
    refreshing.add(key);
    fillAndStore(key, fill)
      // 后台刷新失败：保留旧的条目，下一次读取再试
      .catch(() => {})
      .finally(() => refreshing.delete(key));
  }

  return {
    async read(key, fill) {
      const entry = entries.get(key);
      if (entry === undefined) return { value: await waitFor(key, fill), outcome: 'miss' };
      const age = now() - entry.createdAt;
      if (age >= entry.life.expire || markedAfter(expiredSince, entry)) return { value: await waitFor(key, fill), outcome: 'expired' };
      if (age >= entry.life.revalidate || markedAfter(staleSince, entry)) {
        refreshInBackground(key, fill);
        return { value: entry.value, outcome: 'stale' };
      }
      return { value: entry.value, outcome: 'hit' };
    },
    revalidateTag(tag) {
      staleSince.set(tag, ++sequence);
    },
    updateTag(tag) {
      expiredSince.set(tag, ++sequence);
    },
  };
}
```
:::

:::variant{kind=wrong name=revalidate-expires fails=tests reason="revalidateTag 让条目立刻过期：它应该先返回旧值、在后台刷新"}
```ts file=cache.ts
/** 单位都是秒 */
export type CacheLife = Readonly<{ revalidate: number; expire: number }>;
export type Fill<T> = Readonly<{ value: T; life: CacheLife; tags: readonly string[] }>;
export type Outcome = 'miss' | 'hit' | 'stale' | 'expired';
export type Read<T> = Readonly<{ value: T; outcome: Outcome }>;

export type Cache<T> = Readonly<{
  read(key: string, fill: () => Promise<Fill<T>>): Promise<Read<T>>;
  /** 在这之前开始填充的、带这个标签的条目变旧：读取时先返回旧值，同时在后台刷新 */
  revalidateTag(tag: string): void;
  /** 在这之前开始填充的、带这个标签的条目过期：读取时要等新的值 */
  updateTag(tag: string): void;
}>;

type Entry<T> = {
  value: T;
  life: CacheLife;
  tags: readonly string[];
  /** 开始填充时的 now() */
  createdAt: number;
  /** 开始填充时的序号 */
  started: number;
};

export function createCache<T>(now: () => number): Cache<T> {
  const entries = new Map<string, Entry<T>>();
  /** 正在进行的、调用方需要等待的填充 */
  const blocking = new Map<string, Promise<T>>();
  /** 正在后台刷新的键 */
  const refreshing = new Set<string>();
  /** 递增的序号：每次开始填充、每次让标签失效都加一，用来判断事情发生的先后 */
  let sequence = 0;
  /** 每个标签最近一次 revalidateTag、updateTag 时的序号 */
  const staleSince = new Map<string, number>();
  const expiredSince = new Map<string, number>();

  /** 这个条目开始填充之后，它的某个标签被标记过 */
  const markedAfter = (marks: ReadonlyMap<string, number>, entry: Entry<T>) => entry.tags.some((tag) => (marks.get(tag) ?? 0) > entry.started);

  /** 运行 fill，完成之后保存条目；时间和序号都以开始的时候为准 */
  async function fillAndStore(key: string, fill: () => Promise<Fill<T>>): Promise<T> {
    const started = ++sequence;
    const createdAt = now();
    const { value, life, tags } = await fill();
    const current = entries.get(key);
    // 已经保存了一个开始得更晚的条目：这次的结果更旧，不能覆盖它
    if (current === undefined || current.started < started) entries.set(key, { value, life, tags, createdAt, started });
    return value;
  }

  function waitFor(key: string, fill: () => Promise<Fill<T>>): Promise<T> {
    let pending = blocking.get(key);
    if (pending === undefined) {
      pending = fillAndStore(key, fill).finally(() => blocking.delete(key));
      blocking.set(key, pending);
    }
    return pending;
  }

  function refreshInBackground(key: string, fill: () => Promise<Fill<T>>): void {
    if (refreshing.has(key)) return;
    refreshing.add(key);
    fillAndStore(key, fill)
      // 后台刷新失败：保留旧的条目，下一次读取再试
      .catch(() => {})
      .finally(() => refreshing.delete(key));
  }

  return {
    async read(key, fill) {
      const entry = entries.get(key);
      if (entry === undefined) return { value: await waitFor(key, fill), outcome: 'miss' };
      const age = now() - entry.createdAt;
      if (age >= entry.life.expire || markedAfter(expiredSince, entry)) return { value: await waitFor(key, fill), outcome: 'expired' };
      if (age >= entry.life.revalidate || markedAfter(staleSince, entry)) {
        refreshInBackground(key, fill);
        return { value: entry.value, outcome: 'stale' };
      }
      return { value: entry.value, outcome: 'hit' };
    },
    revalidateTag(tag) {
      expiredSince.set(tag, ++sequence);
    },
    updateTag(tag) {
      expiredSince.set(tag, ++sequence);
    },
  };
}
```
:::

:::variant{kind=wrong name=forget-on-refresh-error fails=tests reason="后台刷新失败时删掉了旧的条目：上游出问题时，本来还能返回的旧值也没有了"}
```ts file=cache.ts
/** 单位都是秒 */
export type CacheLife = Readonly<{ revalidate: number; expire: number }>;
export type Fill<T> = Readonly<{ value: T; life: CacheLife; tags: readonly string[] }>;
export type Outcome = 'miss' | 'hit' | 'stale' | 'expired';
export type Read<T> = Readonly<{ value: T; outcome: Outcome }>;

export type Cache<T> = Readonly<{
  read(key: string, fill: () => Promise<Fill<T>>): Promise<Read<T>>;
  /** 在这之前开始填充的、带这个标签的条目变旧：读取时先返回旧值，同时在后台刷新 */
  revalidateTag(tag: string): void;
  /** 在这之前开始填充的、带这个标签的条目过期：读取时要等新的值 */
  updateTag(tag: string): void;
}>;

type Entry<T> = {
  value: T;
  life: CacheLife;
  tags: readonly string[];
  /** 开始填充时的 now() */
  createdAt: number;
  /** 开始填充时的序号 */
  started: number;
};

export function createCache<T>(now: () => number): Cache<T> {
  const entries = new Map<string, Entry<T>>();
  /** 正在进行的、调用方需要等待的填充 */
  const blocking = new Map<string, Promise<T>>();
  /** 正在后台刷新的键 */
  const refreshing = new Set<string>();
  /** 递增的序号：每次开始填充、每次让标签失效都加一，用来判断事情发生的先后 */
  let sequence = 0;
  /** 每个标签最近一次 revalidateTag、updateTag 时的序号 */
  const staleSince = new Map<string, number>();
  const expiredSince = new Map<string, number>();

  /** 这个条目开始填充之后，它的某个标签被标记过 */
  const markedAfter = (marks: ReadonlyMap<string, number>, entry: Entry<T>) => entry.tags.some((tag) => (marks.get(tag) ?? 0) > entry.started);

  /** 运行 fill，完成之后保存条目；时间和序号都以开始的时候为准 */
  async function fillAndStore(key: string, fill: () => Promise<Fill<T>>): Promise<T> {
    const started = ++sequence;
    const createdAt = now();
    const { value, life, tags } = await fill();
    const current = entries.get(key);
    // 已经保存了一个开始得更晚的条目：这次的结果更旧，不能覆盖它
    if (current === undefined || current.started < started) entries.set(key, { value, life, tags, createdAt, started });
    return value;
  }

  function waitFor(key: string, fill: () => Promise<Fill<T>>): Promise<T> {
    let pending = blocking.get(key);
    if (pending === undefined) {
      pending = fillAndStore(key, fill).finally(() => blocking.delete(key));
      blocking.set(key, pending);
    }
    return pending;
  }

  function refreshInBackground(key: string, fill: () => Promise<Fill<T>>): void {
    if (refreshing.has(key)) return;
    refreshing.add(key);
    fillAndStore(key, fill)
      // 后台刷新失败：保留旧的条目，下一次读取再试
      .catch(() => entries.delete(key))
      .finally(() => refreshing.delete(key));
  }

  return {
    async read(key, fill) {
      const entry = entries.get(key);
      if (entry === undefined) return { value: await waitFor(key, fill), outcome: 'miss' };
      const age = now() - entry.createdAt;
      if (age >= entry.life.expire || markedAfter(expiredSince, entry)) return { value: await waitFor(key, fill), outcome: 'expired' };
      if (age >= entry.life.revalidate || markedAfter(staleSince, entry)) {
        refreshInBackground(key, fill);
        return { value: entry.value, outcome: 'stale' };
      }
      return { value: entry.value, outcome: 'hit' };
    },
    revalidateTag(tag) {
      staleSince.set(tag, ++sequence);
    },
    updateTag(tag) {
      expiredSince.set(tag, ++sequence);
    },
  };
}
```
:::

