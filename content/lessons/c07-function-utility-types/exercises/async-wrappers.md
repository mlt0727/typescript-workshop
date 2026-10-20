---
kind: challenge
title: 重试与请求合并
---
在 `wrappers.ts` 中实现两个异步包装函数。包装之后的函数，参数和返回值的类型都要与原来的函数相同（不能使用 `any` 和类型断言）。

**`withRetry(fn, options)`**，`options` 是 `{ attempts: number; shouldRetry?: (error: unknown) => boolean; delay?: (attempt: number) => Promise<void> }`：

1. 调用 `fn`；成功就返回它的结果；
2. 失败（Promise 被拒绝）时，如果总共已经调用了 `attempts` 次，或者提供了 `shouldRetry` 且它对这个错误返回 `false`，就以**这次的错误**拒绝；否则（如果提供了 `delay`）先 `await delay(已经失败的次数)`，再重试。

**`memoizeAsync(fn, keyOf)`**：

1. 用 `keyOf(...args)` 算出缓存的键；同一个键的调用共用**同一个 Promise**：即使第一次调用还没有完成，第二次调用也不会再调用 `fn`；
2. 这个 Promise 失败后，要从缓存中移除，下一次同样的调用会重新调用 `fn`；成功的结果一直保留；
3. 不同的键互不影响。

:::files{role=starter}
```ts file=wrappers.ts
export type RetryOptions = {
  attempts: number;
  shouldRetry?: (error: unknown) => boolean;
  delay?: (attempt: number) => Promise<void>;
};

export function withRetry(fn: (...args: unknown[]) => Promise<unknown>, options: RetryOptions) {
  return fn;
}

export function memoizeAsync(fn: (...args: unknown[]) => Promise<unknown>, keyOf: (...args: unknown[]) => string) {
  return fn;
}
```
```ts file=main.ts
import { memoizeAsync, withRetry } from './wrappers';

let calls = 0;
async function loadUser(id: string) {
  calls += 1;
  if (calls === 1) throw new Error('网络错误');
  return { id, name: 'Ada' };
}

const getUser = memoizeAsync(withRetry(loadUser, { attempts: 3 }), (id) => id);
const [a, b] = await Promise.all([getUser('u1'), getUser('u1')]);
console.log(a === b, calls);
```
:::

:::files{role=solution}
```ts file=wrappers.ts
export type RetryOptions = {
  attempts: number;
  shouldRetry?: (error: unknown) => boolean;
  delay?: (attempt: number) => Promise<void>;
};

export function withRetry<A extends unknown[], R>(fn: (...args: A) => Promise<R>, options: RetryOptions): (...args: A) => Promise<R> {
  return async (...args) => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        const canRetry = attempt < options.attempts && (options.shouldRetry?.(error) ?? true);
        if (!canRetry) throw error;
        await options.delay?.(attempt);
      }
    }
  };
}

export function memoizeAsync<A extends unknown[], R>(fn: (...args: A) => Promise<R>, keyOf: (...args: A) => string): (...args: A) => Promise<R> {
  const cache = new Map<string, Promise<R>>();
  return (...args) => {
    const key = keyOf(...args);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const promise = fn(...args);
    cache.set(key, promise);
    // 失败的结果不缓存；只删除自己（期间可能已经换成了新的 Promise）
    promise.catch(() => {
      if (cache.get(key) === promise) cache.delete(key);
    });
    return promise;
  };
}
```
```ts file=main.ts
import { memoizeAsync, withRetry } from './wrappers';

let calls = 0;
async function loadUser(id: string) {
  calls += 1;
  if (calls === 1) throw new Error('网络错误');
  return { id, name: 'Ada' };
}

const getUser = memoizeAsync(withRetry(loadUser, { attempts: 3 }), (id) => id);
const [a, b] = await Promise.all([getUser('u1'), getUser('u1')]);
console.log(a === b, calls);
```
:::

:::files{role=tests}
```ts file=wrappers.test.ts
import { describe, expect, test } from 'vitest';
import { memoizeAsync, withRetry } from './wrappers';

/** 前 failures 次失败，之后成功；记录每次调用的参数 */
function flaky(failures: number) {
  const calls: string[] = [];
  const fn = async (id: string) => {
    calls.push(id);
    if (calls.length <= failures) throw new Error(`第 ${calls.length} 次失败`);
    return `结果 ${id}`;
  };
  return { fn, calls };
}

describe('withRetry', () => {
  test('失败后重试，直到成功', async () => {
    const { fn, calls } = flaky(2);
    await expect(withRetry(fn, { attempts: 3 })('a')).resolves.toBe('结果 a');
    expect(calls).toEqual(['a', 'a', 'a']);
  });

  test('达到次数上限时，以最后一次的错误拒绝', async () => {
    const { fn, calls } = flaky(5);
    await expect(withRetry(fn, { attempts: 3 })('a')).rejects.toThrow('第 3 次失败');
    expect(calls).toHaveLength(3);
  });

  test('attempts 为 1 时不重试', async () => {
    const { fn, calls } = flaky(1);
    await expect(withRetry(fn, { attempts: 1 })('a')).rejects.toThrow('第 1 次失败');
    expect(calls).toHaveLength(1);
  });

  test('shouldRetry 返回 false 时立即拒绝', async () => {
    const { fn, calls } = flaky(5);
    const seen: unknown[] = [];
    const wrapped = withRetry(fn, {
      attempts: 5,
      shouldRetry: (error) => {
        seen.push(error);
        return false;
      },
    });
    await expect(wrapped('a')).rejects.toThrow('第 1 次失败');
    expect(calls).toHaveLength(1);
    expect(seen).toHaveLength(1);
  });

  test('重试之前等待 delay，参数是已经失败的次数', async () => {
    const { fn } = flaky(2);
    const waits: number[] = [];
    const wrapped = withRetry(fn, { attempts: 3, delay: async (n) => void waits.push(n) });
    await wrapped('a');
    expect(waits).toEqual([1, 2]);
  });
});

describe('memoizeAsync', () => {
  test('并发的同样调用共用一个 Promise，只调用一次', async () => {
    const { fn, calls } = flaky(0);
    const cached = memoizeAsync(fn, (id) => id);
    const first = cached('a');
    const second = cached('a');
    expect(second).toBe(first);
    expect(await first).toBe('结果 a');
    await cached('a');
    expect(calls).toEqual(['a']);
  });

  test('不同的键分别调用', async () => {
    const { fn, calls } = flaky(0);
    const cached = memoizeAsync(fn, (id) => id);
    await Promise.all([cached('a'), cached('b'), cached('a')]);
    expect(calls).toEqual(['a', 'b']);
  });

  test('失败的结果不缓存，下一次重新调用', async () => {
    const { fn, calls } = flaky(1);
    const cached = memoizeAsync(fn, (id) => id);
    await expect(cached('a')).rejects.toThrow('第 1 次失败');
    await expect(cached('a')).resolves.toBe('结果 a');
    await expect(cached('a')).resolves.toBe('结果 a');
    expect(calls).toEqual(['a', 'a']);
  });
});
```
```ts file=wrappers.test-d.ts
import { expectTypeOf } from 'vitest';
import { memoizeAsync, withRetry } from './wrappers';

async function loadUser(id: string, includePosts?: boolean) {
  return { id, name: 'Ada', posts: includePosts ? ['p1'] : [] };
}

const retried = withRetry(loadUser, { attempts: 3 });
expectTypeOf(retried).parameters.toEqualTypeOf<[id: string, includePosts?: boolean | undefined]>();
expectTypeOf(retried).returns.toEqualTypeOf<Promise<{ id: string; name: string; posts: string[] }>>();

const cached = memoizeAsync(retried, (id, includePosts) => {
  expectTypeOf(id).toEqualTypeOf<string>();
  expectTypeOf(includePosts).toEqualTypeOf<boolean | undefined>();
  return `${id}:${includePosts}`;
});
expectTypeOf(cached).returns.resolves.toEqualTypeOf<{ id: string; name: string; posts: string[] }>();
// @ts-expect-error 参数类型不对
cached(42);
```
:::

:::hint{level=1}
两个函数的签名都是 `<A extends unknown[], R>(fn: (...args: A) => Promise<R>, …): (...args: A) => Promise<R>`。`withRetry` 用一个循环：`try { return await fn(...args); } catch (error) { … }`，注意 `return await` 才能让失败落进 `catch`（e03）。
:::

:::hint{level=2}
`memoizeAsync` 用 `Map<string, Promise<R>>` 缓存 **Promise** 本身：先 `cache.set(key, promise)`，再返回它，并发的第二次调用就会拿到同一个 Promise。失败时删除：`promise.catch(() => { if (cache.get(key) === promise) cache.delete(key); })`。这里的 `catch` 只用来清理缓存，返回给调用方的还是原来的 `promise`，它的拒绝照样会传给调用方。
:::

:::explanation
两个包装函数都用泛型的剩余参数 `A` 和结果 `R`，所以可以任意组合：`memoizeAsync(withRetry(loadUser, …), keyOf)` 的类型仍然是 `(id: string, includePosts?: boolean) => Promise<User>`，`keyOf` 的参数也自动得到了类型。

`withRetry` 中的 `return await fn(...args)`：不写 `await` 的话，`return fn(...args)` 直接把 Promise 交出去，它的拒绝不会被这里的 `catch` 接住，重试就不会发生（e03 讲过）。重试之间的 `delay` 由调用方提供，真实的代码通常在这里做“指数退避”（e05），测试中则可以传入一个立即完成的函数。

`memoizeAsync` 有两个关键点：

- **缓存 Promise，而不是结果**：如果等结果出来再写入缓存，两次几乎同时的调用都会发现缓存是空的，各发一次请求。缓存 Promise 让第二次调用直接拿到正在进行中的那个请求；
- **失败要清理**：被拒绝的 Promise 如果留在缓存里，之后的每次调用都会立刻得到同一个失败，再也恢复不了。清理时先确认缓存中的还是自己，避免删掉别人新放进去的 Promise。
:::

:::variant{kind=alt name=recursive-retry}
```ts file=wrappers.ts
export type RetryOptions = {
  attempts: number;
  shouldRetry?: (error: unknown) => boolean;
  delay?: (attempt: number) => Promise<void>;
};

export function withRetry<A extends unknown[], R>(fn: (...args: A) => Promise<R>, options: RetryOptions): (...args: A) => Promise<R> {
  const { attempts, shouldRetry = () => true, delay } = options;
  const run = (args: A, attempt: number): Promise<R> =>
    fn(...args).catch(async (error: unknown) => {
      if (attempt >= attempts || !shouldRetry(error)) throw error;
      if (delay) await delay(attempt);
      return run(args, attempt + 1);
    });
  return (...args) => run(args, 1);
}

export function memoizeAsync<A extends unknown[], R>(fn: (...args: A) => Promise<R>, keyOf: (...args: A) => string): (...args: A) => Promise<R> {
  const pending = new Map<string, Promise<R>>();
  return function cached(...args: A): Promise<R> {
    const key = keyOf(...args);
    const existing = pending.get(key);
    if (existing) return existing;
    const created = fn(...args).catch((error: unknown) => {
      pending.delete(key);
      throw error;
    });
    pending.set(key, created);
    return created;
  };
}
```
:::

:::variant{kind=wrong name=cache-values fails=tests reason="等结果出来才写入缓存，并发的同样调用各调用了一次"}
```ts file=wrappers.ts
export type RetryOptions = {
  attempts: number;
  shouldRetry?: (error: unknown) => boolean;
  delay?: (attempt: number) => Promise<void>;
};

export function withRetry<A extends unknown[], R>(fn: (...args: A) => Promise<R>, options: RetryOptions): (...args: A) => Promise<R> {
  return async (...args) => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        const canRetry = attempt < options.attempts && (options.shouldRetry?.(error) ?? true);
        if (!canRetry) throw error;
        await options.delay?.(attempt);
      }
    }
  };
}

export function memoizeAsync<A extends unknown[], R>(fn: (...args: A) => Promise<R>, keyOf: (...args: A) => string): (...args: A) => Promise<R> {
  const cache = new Map<string, R>();
  return async (...args) => {
    const key = keyOf(...args);
    if (cache.has(key)) {
      const value = cache.get(key);
      if (value !== undefined) return value;
    }
    const value = await fn(...args);
    cache.set(key, value);
    return value;
  };
}
```
:::

:::variant{kind=wrong name=caches-failure fails=tests reason="失败的 Promise 一直留在缓存里，之后的调用都得到同一个失败"}
```ts file=wrappers.ts
export type RetryOptions = {
  attempts: number;
  shouldRetry?: (error: unknown) => boolean;
  delay?: (attempt: number) => Promise<void>;
};

export function withRetry<A extends unknown[], R>(fn: (...args: A) => Promise<R>, options: RetryOptions): (...args: A) => Promise<R> {
  return async (...args) => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        const canRetry = attempt < options.attempts && (options.shouldRetry?.(error) ?? true);
        if (!canRetry) throw error;
        await options.delay?.(attempt);
      }
    }
  };
}

export function memoizeAsync<A extends unknown[], R>(fn: (...args: A) => Promise<R>, keyOf: (...args: A) => string): (...args: A) => Promise<R> {
  const cache = new Map<string, Promise<R>>();
  return (...args) => {
    const key = keyOf(...args);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const promise = fn(...args);
    cache.set(key, promise);
    return promise;
  };
}
```
:::

:::variant{kind=wrong name=return-without-await fails=tests reason="return fn(...args) 没有 await，失败没有被 catch 接住，不会重试"}
```ts file=wrappers.ts
export type RetryOptions = {
  attempts: number;
  shouldRetry?: (error: unknown) => boolean;
  delay?: (attempt: number) => Promise<void>;
};

export function withRetry<A extends unknown[], R>(fn: (...args: A) => Promise<R>, options: RetryOptions): (...args: A) => Promise<R> {
  return async (...args) => {
    for (let attempt = 1; ; attempt++) {
      try {
        return fn(...args);
      } catch (error) {
        const canRetry = attempt < options.attempts && (options.shouldRetry?.(error) ?? true);
        if (!canRetry) throw error;
        await options.delay?.(attempt);
      }
    }
  };
}

export function memoizeAsync<A extends unknown[], R>(fn: (...args: A) => Promise<R>, keyOf: (...args: A) => string): (...args: A) => Promise<R> {
  const cache = new Map<string, Promise<R>>();
  return (...args) => {
    const key = keyOf(...args);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const promise = fn(...args);
    cache.set(key, promise);
    promise.catch(() => {
      if (cache.get(key) === promise) cache.delete(key);
    });
    return promise;
  };
}
```
:::

:::variant{kind=wrong name=any-wrapper fails=rules reason="用 any 描述被包装的函数"}
```ts file=wrappers.ts
export type RetryOptions = {
  attempts: number;
  shouldRetry?: (error: unknown) => boolean;
  delay?: (attempt: number) => Promise<void>;
};

export function withRetry<F extends (...args: any[]) => Promise<any>>(fn: F, options: RetryOptions): (...args: Parameters<F>) => ReturnType<F> {
  return (async (...args: Parameters<F>) => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        const canRetry = attempt < options.attempts && (options.shouldRetry?.(error) ?? true);
        if (!canRetry) throw error;
        await options.delay?.(attempt);
      }
    }
  }) as (...args: Parameters<F>) => ReturnType<F>;
}

export function memoizeAsync<A extends unknown[], R>(fn: (...args: A) => Promise<R>, keyOf: (...args: A) => string): (...args: A) => Promise<R> {
  const cache = new Map<string, Promise<R>>();
  return (...args) => {
    const key = keyOf(...args);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const promise = fn(...args);
    cache.set(key, promise);
    promise.catch(() => {
      if (cache.get(key) === promise) cache.delete(key);
    });
    return promise;
  };
}
```
:::
