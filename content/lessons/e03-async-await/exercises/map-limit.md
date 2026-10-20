---
kind: challenge
title: 限制并发数量
---
有 100 个文件要上传，同时发出 100 个请求会压垮服务器；一个一个上传又太慢。常见的做法是限制**同时进行**的数量。

实现 `mapLimit(items, limit, fn)`：对 `items` 的每个元素调用异步函数 `fn(item, index)`，返回所有结果组成的数组。

- 结果按 `items` 的顺序排列，与完成的先后无关；
- 任何时刻，正在进行（已经调用、还没完成）的 `fn` 最多 `limit` 个；
- 有任务完成时立刻启动下一个，不要等一整批都完成；
- 任何一个 `fn` 被拒绝时，`mapLimit` 返回的 Promise **立即**以同样的原因被拒绝（不等其他正在进行的任务结束），并且**不再启动**新的任务（已经在进行的无法取消，不用管它们）；
- `limit` 不是正整数时，返回的 Promise 被拒绝，原因是 `RangeError`；
- `items` 为空时得到 `[]`。

:::files{role=starter}
```ts file=map-limit.ts
export async function mapLimit<T, U>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
  // 在这里实现
  return [];
}
```
:::

:::files{role=solution}
```ts file=map-limit.ts
export async function mapLimit<T, U>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new RangeError(`limit 必须是正整数：${limit}`);
  }

  const queue = [...items.entries()];
  const results: U[] = [];
  let failed = false;

  async function worker(): Promise<void> {
    while (!failed) {
      const entry = queue.shift();
      if (entry === undefined) {
        return;
      }
      const [index, item] = entry;
      try {
        results[index] = await fn(item, index);
      } catch (err) {
        failed = true;
        throw err;
      }
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(limit, items.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}
```
:::

:::files{role=tests}
```ts file=map-limit.test.ts
import { describe, expect, expectTypeOf, test } from 'vitest';
import { mapLimit } from './map-limit';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

expectTypeOf(mapLimit(['a', 'bb'], 1, async (s) => s.length)).toEqualTypeOf<Promise<number[]>>();

describe('mapLimit', () => {
  test('结果按输入顺序排列，并把下标传给 fn', async () => {
    const result = await mapLimit([30, 10, 20], 2, async (ms, index) => {
      await sleep(ms);
      return `${index}:${ms}`;
    });
    expect(result).toEqual(['0:30', '1:10', '2:20']);
  });

  test('同时进行的任务不超过 limit，并且确实用满了 limit', async () => {
    let active = 0;
    let maxActive = 0;
    const result = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (n) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await sleep(10);
      active -= 1;
      return n * n;
    });
    expect(result).toEqual([1, 4, 9, 16, 25, 36]);
    expect(maxActive).toBe(2);
  });

  test('limit 大于任务数时，全部同时进行', async () => {
    let active = 0;
    let maxActive = 0;
    await mapLimit(['a', 'b', 'c'], 10, async (s) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await sleep(10);
      active -= 1;
      return s;
    });
    expect(maxActive).toBe(3);
  });

  test('一个任务完成后立刻启动下一个，不等整批完成', async () => {
    const finished: string[] = [];
    await mapLimit(['a', 'b', 'c'], 2, async (name) => {
      await sleep(name === 'a' ? 100 : 10);
      finished.push(name);
      return name;
    });
    expect(finished).toEqual(['b', 'c', 'a']);
  });

  test('任务被拒绝时，结果被拒绝，并且不再启动新的任务', async () => {
    const started: number[] = [];
    const promise = mapLimit([1, 2, 3, 4, 5, 6], 2, async (n) => {
      started.push(n);
      if (n === 2) {
        await sleep(5);
        throw new Error(`任务 ${n} 失败`);
      }
      await sleep(20);
      return n;
    });
    await expect(promise).rejects.toThrow('任务 2 失败');
    await sleep(60);
    expect(started).toEqual([1, 2]);
  });

  test('任务被拒绝时立即拒绝，不等其他正在进行的任务', async () => {
    const start = Date.now();
    const promise = mapLimit(['fast-fail', 'slow'], 2, async (name) => {
      await sleep(name === 'slow' ? 300 : 5);
      if (name === 'fast-fail') throw new Error('失败');
      return name;
    });
    await expect(promise).rejects.toThrow('失败');
    expect(Date.now() - start).toBeLessThan(200);
  });

  test('空数组得到空数组，不调用 fn', async () => {
    let calls = 0;
    const result = await mapLimit([], 3, async (n: number) => {
      calls += 1;
      return n;
    });
    expect(result).toEqual([]);
    expect(calls).toBe(0);
  });

  test('limit 必须是正整数', async () => {
    const same = async (n: number): Promise<number> => n;
    await expect(mapLimit([1], 0, same)).rejects.toThrow(RangeError);
    await expect(mapLimit([1], 1.5, same)).rejects.toThrow(RangeError);
    await expect(mapLimit([1], Number.NaN, same)).rejects.toThrow(RangeError);
  });
});
```
:::

:::hint{level=1}
不要一次启动所有任务，也不要分批。启动 `limit` 个“工人”（每个工人是一次 async 函数调用）：工人循环地取出下一个还没处理的元素，`await` 它的结果，存到对应的下标，再取下一个。没有元素可取时工人结束；所有工人都结束，所有任务也就完成了。
:::

:::hint{level=2}
用 `const queue = [...items.entries()]` 得到 `[下标, 元素]` 的数组，工人用 `queue.shift()` 取任务，得到 `undefined` 表示取完了。结果写进 `results[index]`，顺序就不会乱。再用一个 `failed` 变量：工人的 `fn` 被拒绝时把它设为 `true` 再抛出，其他工人每次取任务前先检查它。最后 `await Promise.all(工人们)`：任何一个工人被拒绝，它就被拒绝。
:::

:::explanation
这是“工作池”模式：固定数量的工人共享一个任务队列。

- **并发上限**：只有 `limit` 个工人，每个工人一次只等待一个 `fn`，所以同时进行的任务不会超过 `limit`。
- **立刻补位**：工人完成一个任务后马上取下一个，不用等其他工人。分批的写法（每 `limit` 个用一次 `Promise.all`）会被一整批里最慢的任务拖住。
- **顺序**：结果按下标写入，与完成先后无关。
- **错误**：工人抛出的错误让 `Promise.all(workers)` 被拒绝，`await` 把它抛出，`mapLimit` 返回的 Promise 也就被拒绝了。`failed` 让其他工人不再取新任务。

多个工人共用 `queue` 和 `failed`，却不需要加锁：JavaScript 在一个线程上运行代码，两个 `await` 之间的代码不会被打断（e01）。`queue.shift()` 和检查 `failed` 都发生在 `await` 之前，不会有两个工人取到同一个任务。

`queue.shift()` 返回 `[number, T] | undefined`，检查 `undefined` 之后就能安全解构。如果直接用 `items[index]`，在 `noUncheckedIndexedAccess` 下得到 `T | undefined`，而 `T` 本身也可能包含 `undefined`，不能靠检查 `undefined` 来判断“取完了”。

已经开始的任务无法从外部停止；要真正取消请求，需要 `AbortController`（e08）。
:::

:::variant{kind=alt name=shared-iterator}
```ts file=map-limit.ts
export async function mapLimit<T, U>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
  if (!(Number.isInteger(limit) && limit > 0)) throw new RangeError('limit 无效');
  const results = new Array<U>(items.length);
  const entries = items.entries();
  let stopped = false;

  const run = async (): Promise<void> => {
    for (const [index, item] of entries) {
      if (stopped) return;
      try {
        results[index] = await fn(item, index);
      } catch (err) {
        stopped = true;
        throw err;
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}
```
:::

:::variant{kind=wrong name=no-limit fails=tests reason="同时启动了所有任务，没有限制并发数量"}
```ts file=map-limit.ts
export async function mapLimit<T, U>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
  if (!Number.isInteger(limit) || limit <= 0) throw new RangeError('limit 无效');
  return Promise.all(items.map((item, index) => fn(item, index)));
}
```
:::

:::variant{kind=wrong name=serial fails=tests reason="一个一个执行，没有用到 limit 允许的并发"}
```ts file=map-limit.ts
export async function mapLimit<T, U>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
  if (!Number.isInteger(limit) || limit <= 0) throw new RangeError('limit 无效');
  const results: U[] = [];
  for (const [index, item] of items.entries()) {
    results.push(await fn(item, index));
  }
  return results;
}
```
:::

:::variant{kind=wrong name=batches fails=tests reason="分批执行，要等一整批都完成才启动下一批"}
```ts file=map-limit.ts
export async function mapLimit<T, U>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
  if (!Number.isInteger(limit) || limit <= 0) throw new RangeError('limit 无效');
  const results: U[] = [];
  for (let start = 0; start < items.length; start += limit) {
    const batch = items.slice(start, start + limit);
    const values = await Promise.all(batch.map((item, offset) => fn(item, start + offset)));
    results.push(...values);
  }
  return results;
}
```
:::

:::variant{kind=wrong name=finish-order fails=tests reason="按完成的先后保存结果，顺序和输入不一致"}
```ts file=map-limit.ts
export async function mapLimit<T, U>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
  if (!Number.isInteger(limit) || limit <= 0) throw new RangeError('limit 无效');
  const queue = [...items.entries()];
  const results: U[] = [];
  let failed = false;
  async function worker(): Promise<void> {
    while (!failed) {
      const entry = queue.shift();
      if (entry === undefined) return;
      try {
        results.push(await fn(entry[1], entry[0]));
      } catch (err) {
        failed = true;
        throw err;
      }
    }
  }
  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(limit, items.length); i++) workers.push(worker());
  await Promise.all(workers);
  return results;
}
```
:::

:::variant{kind=wrong name=keep-going fails=tests reason="出错后其他工人继续启动新的任务"}
```ts file=map-limit.ts
export async function mapLimit<T, U>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
  if (!Number.isInteger(limit) || limit <= 0) throw new RangeError('limit 无效');
  const queue = [...items.entries()];
  const results: U[] = [];
  async function worker(): Promise<void> {
    for (let entry = queue.shift(); entry !== undefined; entry = queue.shift()) {
      const [index, item] = entry;
      results[index] = await fn(item, index);
    }
  }
  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(limit, items.length); i++) workers.push(worker());
  await Promise.all(workers);
  return results;
}
```
:::

:::variant{kind=wrong name=missing-await fails=types reason="忘了 await，把 Promise 存进了结果数组"}
```ts file=map-limit.ts
export async function mapLimit<T, U>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
  if (!Number.isInteger(limit) || limit <= 0) throw new RangeError('limit 无效');
  const queue = [...items.entries()];
  const results: U[] = [];
  let failed = false;
  async function worker(): Promise<void> {
    while (!failed) {
      const entry = queue.shift();
      if (entry === undefined) return;
      const [index, item] = entry;
      try {
        results[index] = fn(item, index);
      } catch (err) {
        failed = true;
        throw err;
      }
    }
  }
  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(limit, items.length); i++) workers.push(worker());
  await Promise.all(workers);
  return results;
}
```
:::

:::variant{kind=wrong name=settle-then-throw fails=tests reason="等所有任务都结束后才拒绝，没有立即拒绝"}
```ts file=map-limit.ts
export async function mapLimit<T, U>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
  if (!Number.isInteger(limit) || limit <= 0) throw new RangeError('limit 无效');
  const queue = [...items.entries()];
  const results: U[] = [];
  let failed = false;
  async function worker(): Promise<void> {
    while (!failed) {
      const entry = queue.shift();
      if (entry === undefined) return;
      const [index, item] = entry;
      try {
        results[index] = await fn(item, index);
      } catch (err) {
        failed = true;
        throw err;
      }
    }
  }
  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(limit, items.length); i++) workers.push(worker());
  const settled = await Promise.allSettled(workers);
  for (const s of settled) {
    if (s.status === 'rejected') throw s.reason;
  }
  return results;
}
```
:::
