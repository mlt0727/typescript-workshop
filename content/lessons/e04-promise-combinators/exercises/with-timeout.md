---
kind: challenge
title: 给 Promise 加上超时
---
实现 `withTimeout(promise, ms)`：

- `promise` 在 `ms` 毫秒内完成时，返回的 Promise 采用它的结果（兑现的值，或者拒绝的原因）；
- 超过 `ms` 毫秒还没完成时，返回的 Promise 以 `new TimeoutError(ms)` 被拒绝；
- 无论哪种情况，结束后都不能留下还在等待的计时器：`promise` 先完成时，要清除超时用的计时器；
- 返回类型保留 `promise` 的类型：传入 `Promise<number>`，得到 `Promise<number>`。

`TimeoutError` 已经写好：它继承 `Error`（b13），把 `name` 设为 `'TimeoutError'`，并记录超时的毫秒数，调用方可以用 `instanceof TimeoutError` 区分超时和其他错误。

提示：`setTimeout` 返回一个数字编号，把它交给 `clearTimeout` 就能取消这个计时器。测试使用 Vitest 的模拟计时器，并用 `vi.getTimerCount()` 检查还剩几个计时器。

:::files{role=starter}
```ts file=timeout.ts
export class TimeoutError extends Error {
  readonly ms: number;

  constructor(ms: number) {
    super(`操作超时（${ms} 毫秒）`);
    this.name = 'TimeoutError';
    this.ms = ms;
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  // 在这里实现
  return promise;
}
```
:::

:::files{role=solution}
```ts file=timeout.ts
export class TimeoutError extends Error {
  readonly ms: number;

  constructor(ms: number) {
    super(`操作超时（${ms} 毫秒）`);
    this.name = 'TimeoutError';
    this.ms = ms;
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer = 0;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
```
:::

:::files{role=tests}
```ts file=timeout.test.ts
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { TimeoutError, withTimeout } from './timeout';

function later<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function failLater(message: string, ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('withTimeout', () => {
  test('及时完成时得到原来的值，并清除计时器', async () => {
    const result = withTimeout(later('ok', 50), 100);
    const assertion = expect(result).resolves.toBe('ok');
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  test('恰好在 ms 毫秒时以 TimeoutError 拒绝', async () => {
    const result = withTimeout(later('slow', 500), 100);
    let settled = false;
    const caught = result
      .then(() => 'resolved')
      .catch((err: unknown) => err)
      .finally(() => {
        settled = true;
      });
    await vi.advanceTimersByTimeAsync(99);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
    const err = await caught;
    expect(err).toBeInstanceOf(TimeoutError);
    expect(err).toMatchObject({ name: 'TimeoutError', ms: 100, message: '操作超时（100 毫秒）' });
  });

  test('原来的 Promise 先被拒绝时，采用它的原因，并清除计时器', async () => {
    const result = withTimeout(failLater('坏了', 20), 100);
    const assertion = expect(result).rejects.toThrow('坏了');
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  test('已经兑现的 Promise 也能使用', async () => {
    await expect(withTimeout(Promise.resolve(7), 10)).resolves.toBe(7);
    expect(vi.getTimerCount()).toBe(0);
  });
});
```
```ts file=timeout.test-d.ts
import { expectTypeOf } from 'vitest';
import { withTimeout } from './timeout';

declare const numbers: Promise<number[]>;
expectTypeOf(withTimeout(numbers, 10)).toEqualTypeOf<Promise<number[]>>();
```
:::

:::hint{level=1}
让 `promise` 和一个“`ms` 毫秒后被拒绝”的 Promise 赛跑：`Promise.race`。这个超时 Promise 永远不会兑现，所以它的类型可以写成 `Promise<never>`，这样 `race` 的结果仍然对应 `T`。
:::

:::hint{level=2}
在创建超时 Promise 时，把 `setTimeout` 返回的编号存到外面的变量里：`timer = setTimeout(() => reject(new TimeoutError(ms)), ms)`。`new Promise` 的回调是同步执行的，所以之后 `timer` 已经有值了。无论 `race` 成功还是失败都要清除计时器，可以用 `.finally(() => clearTimeout(timer))`。
:::

:::explanation
`Promise.race` 采用第一个完成的结果：`promise` 先完成，就得到它的值或原因；超时 Promise 先完成，就得到 `TimeoutError`。超时 Promise 的类型是 `Promise<never>`，而 `never` 在联合中会消失，所以结果只和 `T` 有关。把鼠标停在 `Promise.race(…)` 上，会看到 `Promise<Awaited<T>>`：`Awaited<T>` 表示“`T` 被 `await` 之后的类型”（如果 `T` 本身是 Promise，就取出它兑现的值的类型），C 阶段会详细讲。它可以直接作为返回类型 `Promise<T>` 的值返回。

只用 `race` 还不够：`promise` 先完成时，超时用的计时器还在等待。它触发时会拒绝一个已经没人关心的 Promise，这没有害处，但计时器本身会一直留到时间到。如果在循环里大量使用，或者超时设得很长，这些计时器就会堆积。在本平台上也能看到后果：运行代码要等所有计时器结束才算完成，留下一个 10 秒的超时计时器，程序就会多“运行” 10 秒。所以要用 `finally` 在两种情况下都清除它。

`finally` 返回的新 Promise 通常采用原来的结果：回调的返回值被忽略，原来的值或拒绝原因原样传下去。例外是回调本身抛出错误或返回一个被拒绝的 Promise，这时新 Promise 以这个新错误拒绝；回调返回 Promise 时，会先等它完成。

注意 `promise` 本身并没有被停止：超时之后它仍在运行。要真正取消一个请求，需要 `AbortController`；给 `fetch` 加超时，现代写法是传入 `AbortSignal.timeout(毫秒)`（e08）。
:::

:::variant{kind=alt name=async-finally}
```ts file=timeout.ts
export class TimeoutError extends Error {
  readonly ms: number;

  constructor(ms: number) {
    super(`操作超时（${ms} 毫秒）`);
    this.name = 'TimeoutError';
    this.ms = ms;
  }
}

export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
```
:::

:::variant{kind=wrong name=no-clear fails=tests reason="promise 先完成时没有清除超时计时器"}
```ts file=timeout.ts
export class TimeoutError extends Error {
  readonly ms: number;

  constructor(ms: number) {
    super(`操作超时（${ms} 毫秒）`);
    this.name = 'TimeoutError';
    this.ms = ms;
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new TimeoutError(ms)), ms);
  });
  return Promise.race([promise, timeout]);
}
```
:::

:::variant{kind=wrong name=return-without-await fails=tests reason="try 中 return 时没有 await，finally 立刻执行，计时器在超时之前就被清除了"}
```ts file=timeout.ts
export class TimeoutError extends Error {
  readonly ms: number;

  constructor(ms: number) {
    super(`操作超时（${ms} 毫秒）`);
    this.name = 'TimeoutError';
    this.ms = ms;
  }
}

export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: number | undefined;
  try {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
```
:::

:::variant{kind=wrong name=plain-error fails=tests reason="超时用了普通的 Error，调用方无法区分超时和其他错误"}
```ts file=timeout.ts
export class TimeoutError extends Error {
  readonly ms: number;

  constructor(ms: number) {
    super(`操作超时（${ms} 毫秒）`);
    this.name = 'TimeoutError';
    this.ms = ms;
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer = 0;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`操作超时（${ms} 毫秒）`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
```
:::

:::variant{kind=wrong name=any-instead-of-race fails=tests reason="用了 Promise.any：原来的 Promise 被拒绝时没有立刻采用它的原因，超时的拒绝也被忽略"}
```ts file=timeout.ts
export class TimeoutError extends Error {
  readonly ms: number;

  constructor(ms: number) {
    super(`操作超时（${ms} 毫秒）`);
    this.name = 'TimeoutError';
    this.ms = ms;
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer = 0;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
  });
  return Promise.any([promise, timeout]).finally(() => clearTimeout(timer));
}
```
:::

:::variant{kind=wrong name=unknown-result fails=types reason="返回类型写成了 Promise<unknown>，调用方丢失了结果的类型"}
```ts file=timeout.ts
export class TimeoutError extends Error {
  readonly ms: number;

  constructor(ms: number) {
    super(`操作超时（${ms} 毫秒）`);
    this.name = 'TimeoutError';
    this.ms = ms;
  }
}

export function withTimeout(promise: Promise<unknown>, ms: number): Promise<unknown> {
  let timer = 0;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
```
:::
