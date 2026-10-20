---
kind: challenge
title: 失败后重试
---
网络请求偶尔会失败，重试一两次往往就能成功。实现 `retry(task, attempts)`：

- `task` 是一个**返回 Promise 的函数**（每次调用都会发起一次新的尝试）；
- 调用 `task()`；如果兑现，`retry` 返回的 Promise 就以同样的值兑现，不再继续尝试；
- 如果拒绝，并且还有剩余次数，就再调用一次 `task()`；
- 总共最多调用 `attempts` 次。全部失败时，以**最后一次**的错误拒绝；
- `attempts` 必须是正整数，否则返回一个以 `RangeError` 拒绝的 Promise（不要同步抛出，也不要调用 `task`）。

`retry` 是泛型函数：`task` 返回 `Promise<T>` 时，`retry` 也返回 `Promise<T>`。本题请用 `then`/`catch` 实现（下一课的 `async`/`await` 写起来会更短）。

:::files{role=starter}
```ts file=retry.ts
export function retry<T>(task: () => Promise<T>, attempts: number): Promise<T> {
  return task();
}
```
:::

:::files{role=solution}
```ts file=retry.ts
export function retry<T>(task: () => Promise<T>, attempts: number): Promise<T> {
  if (!Number.isInteger(attempts) || attempts < 1) {
    return Promise.reject(new RangeError(`尝试次数必须是正整数：${attempts}`));
  }
  return task().catch((error: unknown) => {
    if (attempts === 1) {
      throw error;
    }
    return retry(task, attempts - 1);
  });
}
```
:::

:::files{role=tests}
```ts file=retry.test.ts
import { describe, expect, test, vi } from 'vitest';
import { retry } from './retry';

function flaky(failures: number, value: string) {
  let calls = 0;
  return vi.fn(() => {
    calls++;
    return calls <= failures ? Promise.reject(new Error(`第 ${calls} 次失败`)) : Promise.resolve(value);
  });
}

describe('retry', () => {
  test('第一次就成功', async () => {
    const task = flaky(0, 'ok');
    await expect(retry(task, 3)).resolves.toBe('ok');
    expect(task).toHaveBeenCalledTimes(1);
  });

  test('失败两次后成功', async () => {
    const task = flaky(2, 'ok');
    await expect(retry(task, 3)).resolves.toBe('ok');
    expect(task).toHaveBeenCalledTimes(3);
  });

  test('全部失败时以最后一次的错误拒绝', async () => {
    const task = flaky(5, 'ok');
    await expect(retry(task, 3)).rejects.toThrow('第 3 次失败');
    expect(task).toHaveBeenCalledTimes(3);
  });

  test('只尝试一次', async () => {
    const task = flaky(1, 'ok');
    await expect(retry(task, 1)).rejects.toThrow('第 1 次失败');
    expect(task).toHaveBeenCalledTimes(1);
  });

  test('次数无效时返回被拒绝的 Promise，不调用 task', async () => {
    const task = flaky(0, 'ok');
    await expect(retry(task, 0)).rejects.toThrow(RangeError);
    await expect(retry(task, 1.5)).rejects.toThrow(RangeError);
    expect(task).not.toHaveBeenCalled();
  });

  test('参数无效时不会同步抛出', () => {
    expect(() => retry(() => Promise.resolve(1), -1).catch(() => {})).not.toThrow();
  });
});
```
```ts file=retry.test-d.ts
import { expectTypeOf } from 'vitest';
import { retry } from './retry';

declare function loadNumbers(): Promise<number[]>;
expectTypeOf(retry(loadNumbers, 3)).toEqualTypeOf<Promise<number[]>>();
```
:::

:::hint{level=1}
先处理参数无效的情况：返回 `Promise.reject(new RangeError(…))`。然后调用 `task()`，在它的 `catch` 里决定：如果已经是最后一次，就把错误继续抛出；否则返回“再试一次”的 Promise——也就是用剩余次数再调用 `retry`。
:::

:::hint{level=2}
```ts
return task().catch((error: unknown) => {
  if (attempts === 1) throw error;
  return retry(task, attempts - 1);
});
```
在 `catch` 回调里 `throw`，`catch` 返回的 Promise 就被拒绝；返回另一个 Promise，它就跟随那个 Promise 的结果。
:::

:::explanation
关键在于 `catch` 回调的两种结果：

- 在回调里 `throw error`：`catch` 返回的 Promise 以这个错误拒绝，失败一直传到调用方——这就是“以最后一次的错误拒绝”。
- 返回 `retry(task, attempts - 1)`：`catch` 返回的 Promise 跟随这次新尝试的结果（e02 讲的“返回 Promise 会被展开”）。

递归让每一次尝试都排在上一次失败之后，而不是同时发起。参数无效时返回 `Promise.reject(…)` 而不是 `throw`：调用方用 `.catch` 或 `await` 处理异步函数的错误，不应该同时还要防备它同步抛出。

`task` 必须是函数而不是一个 Promise：Promise 一旦创建，操作就已经开始，结果只有一个，无法“重新执行”。
:::

:::variant{kind=alt name=loop-with-then}
```ts file=retry.ts
export function retry<T>(task: () => Promise<T>, attempts: number): Promise<T> {
  if (!(Number.isInteger(attempts) && attempts >= 1)) {
    return Promise.reject(new RangeError('尝试次数无效'));
  }
  let chain: Promise<T> = task();
  for (let i = 1; i < attempts; i++) {
    chain = chain.catch(() => task());
  }
  return chain;
}
```
:::

:::variant{kind=wrong name=first-error fails=tests reason="全部失败时返回了第一次的错误"}
```ts file=retry.ts
export function retry<T>(task: () => Promise<T>, attempts: number): Promise<T> {
  if (!Number.isInteger(attempts) || attempts < 1) {
    return Promise.reject(new RangeError('尝试次数无效'));
  }
  let firstError: unknown;
  const attempt = (left: number): Promise<T> =>
    task().catch((error: unknown) => {
      firstError ??= error;
      if (left === 1) throw firstError;
      return attempt(left - 1);
    });
  return attempt(attempts);
}
```
:::

:::variant{kind=wrong name=off-by-one fails=tests reason="剩余次数从 attempts 数到 0，总共多尝试了一次"}
```ts file=retry.ts
export function retry<T>(task: () => Promise<T>, attempts: number): Promise<T> {
  if (!Number.isInteger(attempts) || attempts < 1) {
    return Promise.reject(new RangeError('尝试次数无效'));
  }
  const attempt = (left: number): Promise<T> =>
    task().catch((error: unknown) => {
      if (left === 0) throw error;
      return attempt(left - 1);
    });
  return attempt(attempts);
}
```
:::

:::variant{kind=wrong name=sync-throw fails=tests reason="参数无效时同步抛出了错误"}
```ts file=retry.ts
export function retry<T>(task: () => Promise<T>, attempts: number): Promise<T> {
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new RangeError('尝试次数无效');
  }
  return task().catch((error: unknown) => {
    if (attempts === 1) throw error;
    return retry(task, attempts - 1);
  });
}
```
:::

:::variant{kind=wrong name=swallow-error fails=tests reason="全部失败时没有拒绝，而是以 undefined 兑现"}
```ts file=retry.ts
export function retry<T>(task: () => Promise<T>, attempts: number): Promise<T | undefined> {
  if (!Number.isInteger(attempts) || attempts < 1) {
    return Promise.reject(new RangeError('尝试次数无效'));
  }
  return task().catch(() => {
    if (attempts === 1) return undefined;
    return retry(task, attempts - 1);
  });
}
```
:::
