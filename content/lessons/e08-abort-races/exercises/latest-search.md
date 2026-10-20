---
kind: task
title: 只显示最新的搜索结果
---
实现 `createSearcher(search, onResults)`，返回一个函数 `run(query)`。每次调用 `run(query)`：

1. 先取消**上一次**还没结束的搜索（调用它的 `AbortController` 的 `abort()`），再为这一次新建一个 `AbortController`，调用 `search(query, signal)`；
2. 只有**最新**一次调用的结果才传给 `onResults(query, results)`。注意：有些 `search` 实现会忽略 `signal`，被取消后仍然返回结果，这些过时的结果也必须丢弃；
3. `run` 返回的 Promise：这次调用被更新的调用取代后，它的任何结果或错误都被忽略，Promise 正常兑现；如果这次是最新的调用而 `search` 被拒绝，就以同样的原因拒绝。

:::files{role=starter}
```ts file=searcher.ts
export type SearchFn = (query: string, signal: AbortSignal) => Promise<string[]>;

export function createSearcher(search: SearchFn, onResults: (query: string, results: string[]) => void): (query: string) => Promise<void> {
  return async (query) => {
    const results = await search(query, new AbortController().signal);
    onResults(query, results);
  };
}
```
:::

:::files{role=solution}
```ts file=searcher.ts
export type SearchFn = (query: string, signal: AbortSignal) => Promise<string[]>;

export function createSearcher(search: SearchFn, onResults: (query: string, results: string[]) => void): (query: string) => Promise<void> {
  let current: AbortController | undefined;

  return async (query) => {
    current?.abort();
    const controller = new AbortController();
    current = controller;
    try {
      const results = await search(query, controller.signal);
      if (current === controller) onResults(query, results);
    } catch (err) {
      if (current === controller) throw err;
    }
  };
}
```
:::

:::files{role=tests}
```ts file=searcher.test.ts
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createSearcher, type SearchFn } from './searcher';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const delays: Record<string, number> = { t: 300, ty: 100, typ: 50 };

/** 遵守 signal 的搜索：被取消时以 AbortError 拒绝 */
const polite: SearchFn = (query, signal) =>
  new Promise((resolve, reject) => {
    const id = setTimeout(() => resolve([`${query} 的结果`]), delays[query] ?? 10);
    signal.addEventListener('abort', () => {
      clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

/** 忽略 signal 的搜索：被取消后照样返回结果 */
const stubborn: SearchFn = (query) => new Promise((resolve) => setTimeout(() => resolve([`${query} 的结果`]), delays[query] ?? 10));

describe('createSearcher', () => {
  test('后发先至时，只显示最新的结果', async () => {
    const onResults = vi.fn();
    const run = createSearcher(polite, onResults);
    const first = run('t');
    const second = run('ty');
    await vi.advanceTimersByTimeAsync(500);
    await Promise.all([first, second]);
    expect(onResults.mock.calls).toEqual([['ty', ['ty 的结果']]]);
  });

  test('即使 search 忽略了 signal，过时的结果也被丢弃', async () => {
    const onResults = vi.fn();
    const run = createSearcher(stubborn, onResults);
    const calls = [run('t'), run('ty')];
    await vi.advanceTimersByTimeAsync(500);
    await Promise.all(calls);
    expect(onResults.mock.calls).toEqual([['ty', ['ty 的结果']]]);
  });

  test('新的调用会取消上一次的 signal，每次使用新的 signal', async () => {
    const signals: AbortSignal[] = [];
    const run = createSearcher((query, signal) => {
      signals.push(signal);
      return polite(query, signal);
    }, () => {});
    const calls = [run('t'), run('ty'), run('typ')];
    expect(signals.map((s) => s.aborted)).toEqual([true, true, false]);
    await vi.advanceTimersByTimeAsync(500);
    await Promise.all(calls);
    expect(new Set(signals).size).toBe(3);
  });

  test('前一次结束之后再调用，两次结果都显示', async () => {
    const onResults = vi.fn();
    const run = createSearcher(polite, onResults);
    const first = run('ty');
    await vi.advanceTimersByTimeAsync(100);
    await first;
    const second = run('typ');
    await vi.advanceTimersByTimeAsync(100);
    await second;
    expect(onResults.mock.calls.map(([q]) => q)).toEqual(['ty', 'typ']);
  });

  test('最新调用的错误会传出；过时调用的错误被忽略', async () => {
    const failing: SearchFn = (query) =>
      new Promise((_, reject) => setTimeout(() => reject(new Error(`${query} 失败`)), delays[query] ?? 10));
    const run = createSearcher(failing, () => {});
    const stale = run('t');
    const latest = run('ty');
    const latestAssertion = expect(latest).rejects.toThrow('ty 失败');
    await vi.advanceTimersByTimeAsync(500);
    await latestAssertion;
    await expect(stale).resolves.toBeUndefined();
  });
});
```
:::

:::hint{level=1}
在 `createSearcher` 里用一个闭包变量记住“当前的 AbortController”。`run` 每次先 `current?.abort()`，再新建一个控制器赋给 `current`，把它的 `signal` 传给 `search`。
:::

:::hint{level=2}
结果回来时，用 `current === controller` 判断这次调用是不是仍然是最新的：是才调用 `onResults`。`catch` 里也一样：是最新的才重新抛出错误，否则忽略（这同时处理了被取消时的 `AbortError`）。
:::

:::explanation
两种办法在这里一起使用：

- **取消**（`abort()`）让遵守 `signal` 的搜索尽早停止，节省网络和服务器资源；
- **身份检查**（`current === controller`）兜底：不管 `search` 有没有遵守 `signal`，只要它不是最新的调用，结果和错误都被丢弃。

每次调用都用一个新的 `AbortController`：它本身就充当了“请求编号”，不需要额外的计数器。被取消的调用产生的 `AbortError` 是程序主动造成的，不应该当作错误传给调用方。

起始代码每次都用一个新的控制器，却从不取消，也不检查，于是谁最后完成谁就显示，正是本课开头的问题。
:::

:::variant{kind=alt name=request-counter}
```ts file=searcher.ts
export type SearchFn = (query: string, signal: AbortSignal) => Promise<string[]>;

export function createSearcher(search: SearchFn, onResults: (query: string, results: string[]) => void): (query: string) => Promise<void> {
  let latest = 0;
  let controller = new AbortController();

  return async (query) => {
    controller.abort();
    controller = new AbortController();
    const id = ++latest;
    let results: string[];
    try {
      results = await search(query, controller.signal);
    } catch (err) {
      if (id === latest) throw err;
      return;
    }
    if (id === latest) onResults(query, results);
  };
}
```
:::

:::variant{kind=wrong name=abort-only fails=tests reason="只依靠取消，search 忽略 signal 时过时的结果仍然被显示"}
```ts file=searcher.ts
export type SearchFn = (query: string, signal: AbortSignal) => Promise<string[]>;

export function createSearcher(search: SearchFn, onResults: (query: string, results: string[]) => void): (query: string) => Promise<void> {
  let current: AbortController | undefined;
  return async (query) => {
    current?.abort();
    const controller = new AbortController();
    current = controller;
    try {
      onResults(query, await search(query, controller.signal));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      throw err;
    }
  };
}
```
:::

:::variant{kind=wrong name=check-only fails=tests reason="只丢弃过时的结果，没有取消过时的请求"}
```ts file=searcher.ts
export type SearchFn = (query: string, signal: AbortSignal) => Promise<string[]>;

export function createSearcher(search: SearchFn, onResults: (query: string, results: string[]) => void): (query: string) => Promise<void> {
  let latest = 0;
  return async (query) => {
    const id = ++latest;
    try {
      const results = await search(query, new AbortController().signal);
      if (id === latest) onResults(query, results);
    } catch (err) {
      if (id === latest) throw err;
    }
  };
}
```
:::

:::variant{kind=wrong name=reuse-controller fails=tests reason="所有请求共用一个 AbortController，取消一次之后后面的请求都立即被取消"}
```ts file=searcher.ts
export type SearchFn = (query: string, signal: AbortSignal) => Promise<string[]>;

export function createSearcher(search: SearchFn, onResults: (query: string, results: string[]) => void): (query: string) => Promise<void> {
  const controller = new AbortController();
  let latest = 0;
  return async (query) => {
    if (latest > 0) controller.abort();
    const id = ++latest;
    try {
      const results = await search(query, controller.signal);
      if (id === latest) onResults(query, results);
    } catch (err) {
      if (id === latest) throw err;
    }
  };
}
```
:::

:::variant{kind=wrong name=rethrow-stale-errors fails=tests reason="过时调用的错误也传了出去"}
```ts file=searcher.ts
export type SearchFn = (query: string, signal: AbortSignal) => Promise<string[]>;

export function createSearcher(search: SearchFn, onResults: (query: string, results: string[]) => void): (query: string) => Promise<void> {
  let current: AbortController | undefined;
  return async (query) => {
    current?.abort();
    const controller = new AbortController();
    current = controller;
    const results = await search(query, controller.signal);
    if (current === controller) onResults(query, results);
  };
}
```
:::
