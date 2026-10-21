---
kind: challenge
title: 带标签的缓存
---
在 `cache.ts` 中实现 `createCache(now)`，模拟服务器上 `'use cache'` 的缓存（`now()` 返回当前的时间，单位是秒）：

1. `read(key, fill)`：读取 `key` 的缓存。`fill()` 产生新的值，同时给出这个值的 `life`（`revalidate`、`expire`）和 `tags`。返回 `{ value, outcome }`；
2. **四种情况**（`age` 是现在减去条目保存的时间）：
   - 没有条目：调用 `fill`，等它完成，保存并返回新的值，`outcome` 是 `'miss'`；
   - 条目被 `updateTag` 标记为过期，或者 `age >= life.expire`：同样要等新的值，`outcome` 是 `'expired'`；
   - 条目被 `revalidateTag` 标记为变旧，或者 `age >= life.revalidate`：**立刻**返回旧的值，`outcome` 是 `'stale'`，同时在后台调用 `fill` 刷新；
   - 其他情况：返回缓存的值，`outcome` 是 `'hit'`，不调用 `fill`；
3. **保存**：`fill` 完成时保存新的条目，保存的时间是**完成时**的 `now()`，并清除变旧、过期的标记。每个条目使用它自己那次填充给出的 `life` 和 `tags`；
4. **不重复填充**：一个键正在进行需要等待的填充时（`'miss'` 或 `'expired'`），同一个键的其他读取等同一次填充，得到同样的结果和同样的 `outcome` 类型；一个键正在后台刷新时，不再发起另一次后台刷新；
5. **失败**：需要等待的填充失败时，这次读取以同样的错误失败，缓存不变，下一次读取重新填充；后台刷新失败时保留旧的条目（仍然是旧的），下一次读取再试；
6. `revalidateTag(tag)`、`updateTag(tag)` 标记所有带有这个标签的条目。

:::files{role=starter}
```ts file=cache.ts
/** 单位都是秒 */
export type CacheLife = Readonly<{ revalidate: number; expire: number }>;
export type Fill<T> = Readonly<{ value: T; life: CacheLife; tags: readonly string[] }>;
export type Outcome = 'miss' | 'hit' | 'stale' | 'expired';
export type Read<T> = Readonly<{ value: T; outcome: Outcome }>;

export type Cache<T> = Readonly<{
  read(key: string, fill: () => Promise<Fill<T>>): Promise<Read<T>>;
  /** 有这个标签的条目变旧：下一次读取先返回旧值，同时在后台刷新 */
  revalidateTag(tag: string): void;
  /** 有这个标签的条目立刻过期：下一次读取要等新的值 */
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
  /** 有这个标签的条目变旧：下一次读取先返回旧值，同时在后台刷新 */
  revalidateTag(tag: string): void;
  /** 有这个标签的条目立刻过期：下一次读取要等新的值 */
  updateTag(tag: string): void;
}>;

type Entry<T> = {
  value: T;
  life: CacheLife;
  tags: readonly string[];
  createdAt: number;
  stale: boolean;
  expired: boolean;
};

export function createCache<T>(now: () => number): Cache<T> {
  const entries = new Map<string, Entry<T>>();
  /** 正在进行的、调用方需要等待的填充 */
  const blocking = new Map<string, Promise<T>>();
  /** 正在后台刷新的键 */
  const refreshing = new Set<string>();

  /** 运行 fill，完成之后（以完成的时间为准）保存新的条目 */
  async function fillAndStore(key: string, fill: () => Promise<Fill<T>>): Promise<T> {
    const { value, life, tags } = await fill();
    entries.set(key, { value, life, tags, createdAt: now(), stale: false, expired: false });
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
      if (entry.expired || age >= entry.life.expire) return { value: await waitFor(key, fill), outcome: 'expired' };
      if (entry.stale || age >= entry.life.revalidate) {
        refreshInBackground(key, fill);
        return { value: entry.value, outcome: 'stale' };
      }
      return { value: entry.value, outcome: 'hit' };
    },
    revalidateTag(tag) {
      for (const entry of entries.values()) if (entry.tags.includes(tag)) entry.stale = true;
    },
    updateTag(tag) {
      for (const entry of entries.values()) if (entry.tags.includes(tag)) entry.expired = true;
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

  test('条目的时间从填充完成时算起', async () => {
    const { clock, cache } = setup();
    const pending = deferred<Fill<string>>();
    const reading = cache.read('k', () => pending.promise);
    clock.time = 3;
    pending.resolve({ value: 'slow', life: LIFE, tags: [] });
    expect(await reading).toStrictEqual({ value: 'slow', outcome: 'miss' });
    clock.time = 7.5;
    expect(await cache.read('k', () => pending.promise)).toStrictEqual({ value: 'slow', outcome: 'hit' });
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
需要三份状态：保存的条目（`Map<string, Entry>`，条目中有值、`life`、`tags`、保存的时间和两个标记），正在进行的需要等待的填充（`Map<string, Promise<T>>`），正在后台刷新的键（`Set<string>`）。`read` 先找条目，再按“过期 → 变旧 → 命中”的顺序判断。
:::

:::hint{level=2}
写一个 `fillAndStore(key, fill)`：`await fill()`，然后用这时的 `now()` 保存条目。需要等待时，先看 `Map` 中有没有这个键的 Promise，没有才调用 `fillAndStore`，并在 `.finally` 中删掉它。后台刷新调用 `fillAndStore` 之后接上 `.catch(() => {})`，否则失败的 Promise 没有人处理。
:::

:::explanation
`revalidate` 和 `expire` 分开，是在“快”和“新”之间取舍：过了 `revalidate`，数据可能已经旧了，但大多数时候先返回旧值、在后台刷新（stale-while-revalidate）用户感觉不到；过了 `expire`，旧值已经旧得不能用了，只能让这一次请求等。正文中实测的响应头 `Cache-Control: s-maxage=5, stale-while-revalidate=3595` 说的正是这件事：5 秒内是新的，之后的 3595 秒内可以先用旧的。

“不重复填充”很重要：一个热门的缓存过期的那一刻，可能同时有几百个请求到达，如果每个请求都去查数据库，数据库会被这一下打垮（缓存击穿）。让同一个键的请求共用一次填充，上游只被查一次。

`revalidateTag` 和 `updateTag` 的区别也是同样的取舍。后台的系统（例如 CMS 的 webhook）修改了数据，用 `revalidateTag`：稍后才看到新内容没关系。用户自己刚刚修改了数据，用 `updateTag`：他下一次看到的必须是自己的修改（“读到自己的写入”），所以宁可等。

后台刷新失败时保留旧值，是缓存的另一个好处：上游暂时不可用时，用户仍然能看到稍微旧一点的内容，而不是一个错误页面。

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
  /** 有这个标签的条目变旧：下一次读取先返回旧值，同时在后台刷新 */
  revalidateTag(tag: string): void;
  /** 有这个标签的条目立刻过期：下一次读取要等新的值 */
  updateTag(tag: string): void;
}>;

/** 一个键的全部状态：当前的条目、标记，以及正在进行的填充 */
class Slot<T> {
  current: { value: T } | undefined;
  life: CacheLife = { revalidate: 0, expire: 0 };
  tags: readonly string[] = [];
  createdAt = 0;
  mark: 'none' | 'stale' | 'expired' = 'none';
  blocking: Promise<T> | undefined;
  refreshing = false;
}

class TaggedCache<T> {
  readonly #slots = new Map<string, Slot<T>>();
  readonly #now: () => number;

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
    const result = await fill();
    slot.current = { value: result.value };
    slot.life = result.life;
    slot.tags = result.tags;
    slot.createdAt = this.#now();
    slot.mark = 'none';
    return result.value;
  }

  #wait(slot: Slot<T>, fill: () => Promise<Fill<T>>): Promise<T> {
    slot.blocking ??= this.#fill(slot, fill).finally(() => {
      slot.blocking = undefined;
    });
    return slot.blocking;
  }

  async read(key: string, fill: () => Promise<Fill<T>>): Promise<Read<T>> {
    const slot = this.#slot(key);
    const current = slot.current;
    if (current === undefined) return { value: await this.#wait(slot, fill), outcome: 'miss' };
    const age = this.#now() - slot.createdAt;
    if (slot.mark === 'expired' || age >= slot.life.expire) return { value: await this.#wait(slot, fill), outcome: 'expired' };
    if (slot.mark === 'stale' || age >= slot.life.revalidate) {
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

  #markAll(tag: string, mark: 'stale' | 'expired'): void {
    for (const slot of this.#slots.values()) {
      if (slot.current !== undefined && slot.tags.includes(tag) && slot.mark !== 'expired') slot.mark = mark;
    }
  }

  revalidateTag(tag: string): void {
    this.#markAll(tag, 'stale');
  }

  updateTag(tag: string): void {
    this.#markAll(tag, 'expired');
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
  /** 有这个标签的条目变旧：下一次读取先返回旧值，同时在后台刷新 */
  revalidateTag(tag: string): void;
  /** 有这个标签的条目立刻过期：下一次读取要等新的值 */
  updateTag(tag: string): void;
}>;

type Entry<T> = {
  value: T;
  life: CacheLife;
  tags: readonly string[];
  createdAt: number;
  stale: boolean;
  expired: boolean;
};

export function createCache<T>(now: () => number): Cache<T> {
  const entries = new Map<string, Entry<T>>();
  /** 正在进行的、调用方需要等待的填充 */
  const blocking = new Map<string, Promise<T>>();
  /** 正在后台刷新的键 */
  const refreshing = new Set<string>();

  /** 运行 fill，完成之后（以完成的时间为准）保存新的条目 */
  async function fillAndStore(key: string, fill: () => Promise<Fill<T>>): Promise<T> {
    const { value, life, tags } = await fill();
    entries.set(key, { value, life, tags, createdAt: now(), stale: false, expired: false });
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
      if (entry.expired || age >= entry.life.expire) return { value: await waitFor(key, fill), outcome: 'expired' };
      if (entry.stale || age >= entry.life.revalidate) {
        return { value: await waitFor(key, fill), outcome: 'stale' };
      }
      return { value: entry.value, outcome: 'hit' };
    },
    revalidateTag(tag) {
      for (const entry of entries.values()) if (entry.tags.includes(tag)) entry.stale = true;
    },
    updateTag(tag) {
      for (const entry of entries.values()) if (entry.tags.includes(tag)) entry.expired = true;
    },
  };
}
```
:::

:::variant{kind=wrong name=created-at-start fails=tests reason="从开始填充的时间算起：一个慢的填充刚完成，条目就已经变旧了"}
```ts file=cache.ts
/** 单位都是秒 */
export type CacheLife = Readonly<{ revalidate: number; expire: number }>;
export type Fill<T> = Readonly<{ value: T; life: CacheLife; tags: readonly string[] }>;
export type Outcome = 'miss' | 'hit' | 'stale' | 'expired';
export type Read<T> = Readonly<{ value: T; outcome: Outcome }>;

export type Cache<T> = Readonly<{
  read(key: string, fill: () => Promise<Fill<T>>): Promise<Read<T>>;
  /** 有这个标签的条目变旧：下一次读取先返回旧值，同时在后台刷新 */
  revalidateTag(tag: string): void;
  /** 有这个标签的条目立刻过期：下一次读取要等新的值 */
  updateTag(tag: string): void;
}>;

type Entry<T> = {
  value: T;
  life: CacheLife;
  tags: readonly string[];
  createdAt: number;
  stale: boolean;
  expired: boolean;
};

export function createCache<T>(now: () => number): Cache<T> {
  const entries = new Map<string, Entry<T>>();
  /** 正在进行的、调用方需要等待的填充 */
  const blocking = new Map<string, Promise<T>>();
  /** 正在后台刷新的键 */
  const refreshing = new Set<string>();

  /** 运行 fill，完成之后（以完成的时间为准）保存新的条目 */
  async function fillAndStore(key: string, fill: () => Promise<Fill<T>>): Promise<T> {
    const startedAt = now();
    const { value, life, tags } = await fill();
    entries.set(key, { value, life, tags, createdAt: startedAt, stale: false, expired: false });
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
      if (entry.expired || age >= entry.life.expire) return { value: await waitFor(key, fill), outcome: 'expired' };
      if (entry.stale || age >= entry.life.revalidate) {
        refreshInBackground(key, fill);
        return { value: entry.value, outcome: 'stale' };
      }
      return { value: entry.value, outcome: 'hit' };
    },
    revalidateTag(tag) {
      for (const entry of entries.values()) if (entry.tags.includes(tag)) entry.stale = true;
    },
    updateTag(tag) {
      for (const entry of entries.values()) if (entry.tags.includes(tag)) entry.expired = true;
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
  /** 有这个标签的条目变旧：下一次读取先返回旧值，同时在后台刷新 */
  revalidateTag(tag: string): void;
  /** 有这个标签的条目立刻过期：下一次读取要等新的值 */
  updateTag(tag: string): void;
}>;

type Entry<T> = {
  value: T;
  life: CacheLife;
  tags: readonly string[];
  createdAt: number;
  stale: boolean;
  expired: boolean;
};

export function createCache<T>(now: () => number): Cache<T> {
  const entries = new Map<string, Entry<T>>();
  /** 正在进行的、调用方需要等待的填充 */
  const blocking = new Map<string, Promise<T>>();
  /** 正在后台刷新的键 */
  const refreshing = new Set<string>();

  /** 运行 fill，完成之后（以完成的时间为准）保存新的条目 */
  async function fillAndStore(key: string, fill: () => Promise<Fill<T>>): Promise<T> {
    const { value, life, tags } = await fill();
    entries.set(key, { value, life, tags, createdAt: now(), stale: false, expired: false });
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
      if (entry.expired || age >= entry.life.expire) return { value: await waitFor(key, fill), outcome: 'expired' };
      if (entry.stale || age >= entry.life.revalidate) {
        refreshInBackground(key, fill);
        return { value: entry.value, outcome: 'stale' };
      }
      return { value: entry.value, outcome: 'hit' };
    },
    revalidateTag(tag) {
      for (const entry of entries.values()) if (entry.tags.includes(tag)) entry.stale = true;
    },
    updateTag(tag) {
      for (const entry of entries.values()) if (entry.tags.includes(tag)) entry.expired = true;
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
  /** 有这个标签的条目变旧：下一次读取先返回旧值，同时在后台刷新 */
  revalidateTag(tag: string): void;
  /** 有这个标签的条目立刻过期：下一次读取要等新的值 */
  updateTag(tag: string): void;
}>;

type Entry<T> = {
  value: T;
  life: CacheLife;
  tags: readonly string[];
  createdAt: number;
  stale: boolean;
  expired: boolean;
};

export function createCache<T>(now: () => number): Cache<T> {
  const entries = new Map<string, Entry<T>>();
  /** 正在进行的、调用方需要等待的填充 */
  const blocking = new Map<string, Promise<T>>();
  /** 正在后台刷新的键 */
  const refreshing = new Set<string>();

  /** 运行 fill，完成之后（以完成的时间为准）保存新的条目 */
  async function fillAndStore(key: string, fill: () => Promise<Fill<T>>): Promise<T> {
    const { value, life, tags } = await fill();
    entries.set(key, { value, life, tags, createdAt: now(), stale: false, expired: false });
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
      if (entry.expired || age >= entry.life.expire) return { value: await waitFor(key, fill), outcome: 'expired' };
      if (entry.stale || age >= entry.life.revalidate) {
        refreshInBackground(key, fill);
        return { value: entry.value, outcome: 'stale' };
      }
      return { value: entry.value, outcome: 'hit' };
    },
    revalidateTag(tag) {
      for (const entry of entries.values()) if (entry.tags.includes(tag)) entry.stale = true;
    },
    updateTag(tag) {
      for (const entry of entries.values()) if (entry.tags.includes(tag)) entry.expired = true;
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
  /** 有这个标签的条目变旧：下一次读取先返回旧值，同时在后台刷新 */
  revalidateTag(tag: string): void;
  /** 有这个标签的条目立刻过期：下一次读取要等新的值 */
  updateTag(tag: string): void;
}>;

type Entry<T> = {
  value: T;
  life: CacheLife;
  tags: readonly string[];
  createdAt: number;
  stale: boolean;
  expired: boolean;
};

export function createCache<T>(now: () => number): Cache<T> {
  const entries = new Map<string, Entry<T>>();
  /** 正在进行的、调用方需要等待的填充 */
  const blocking = new Map<string, Promise<T>>();
  /** 正在后台刷新的键 */
  const refreshing = new Set<string>();

  /** 运行 fill，完成之后（以完成的时间为准）保存新的条目 */
  async function fillAndStore(key: string, fill: () => Promise<Fill<T>>): Promise<T> {
    const { value, life, tags } = await fill();
    entries.set(key, { value, life, tags, createdAt: now(), stale: false, expired: false });
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
      if (entry.expired || age >= entry.life.expire) return { value: await waitFor(key, fill), outcome: 'expired' };
      if (entry.stale || age >= entry.life.revalidate) {
        refreshInBackground(key, fill);
        return { value: entry.value, outcome: 'stale' };
      }
      return { value: entry.value, outcome: 'hit' };
    },
    revalidateTag(tag) {
      for (const entry of entries.values()) if (entry.tags.includes(tag)) entry.expired = true;
    },
    updateTag(tag) {
      for (const entry of entries.values()) if (entry.tags.includes(tag)) entry.expired = true;
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
  /** 有这个标签的条目变旧：下一次读取先返回旧值，同时在后台刷新 */
  revalidateTag(tag: string): void;
  /** 有这个标签的条目立刻过期：下一次读取要等新的值 */
  updateTag(tag: string): void;
}>;

type Entry<T> = {
  value: T;
  life: CacheLife;
  tags: readonly string[];
  createdAt: number;
  stale: boolean;
  expired: boolean;
};

export function createCache<T>(now: () => number): Cache<T> {
  const entries = new Map<string, Entry<T>>();
  /** 正在进行的、调用方需要等待的填充 */
  const blocking = new Map<string, Promise<T>>();
  /** 正在后台刷新的键 */
  const refreshing = new Set<string>();

  /** 运行 fill，完成之后（以完成的时间为准）保存新的条目 */
  async function fillAndStore(key: string, fill: () => Promise<Fill<T>>): Promise<T> {
    const { value, life, tags } = await fill();
    entries.set(key, { value, life, tags, createdAt: now(), stale: false, expired: false });
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
      if (entry.expired || age >= entry.life.expire) return { value: await waitFor(key, fill), outcome: 'expired' };
      if (entry.stale || age >= entry.life.revalidate) {
        refreshInBackground(key, fill);
        return { value: entry.value, outcome: 'stale' };
      }
      return { value: entry.value, outcome: 'hit' };
    },
    revalidateTag(tag) {
      for (const entry of entries.values()) if (entry.tags.includes(tag)) entry.stale = true;
    },
    updateTag(tag) {
      for (const entry of entries.values()) if (entry.tags.includes(tag)) entry.expired = true;
    },
  };
}
```
:::

