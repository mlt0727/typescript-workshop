---
kind: challenge
title: 实现“重试直到成功”的等待函数
mode: ts
---
Playwright 的断言、Testing Library 的 `waitFor` 背后都是同一个函数：反复尝试一个检查，直到它成功或者超时。在 `poll.ts` 中实现 `poll(check, options)`：

1. 调用 `poll` 时**立刻**尝试第一次（同步地调用 `check`）；
2. `check` 返回值（或者返回的 Promise 完成）就算成功，`poll` 以这个值完成；
3. `check` 抛出异常（或者返回的 Promise 被拒绝）就算失败。截止时间是“调用 `poll` 的时刻 + `timeout`”（默认 1000 毫秒）。失败时如果已经到了截止时间，以**这次的错误**拒绝（原样传出，不包装）；否则等待 `interval`（默认 50 毫秒）再试，但不越过截止时间：剩下的时间不够一个 `interval` 时，正好在截止时间进行最后一次尝试；
4. 异步的 `check` 要等它完成（无论成功还是失败）之后，才开始计算下一次的等待，两次尝试**不会同时进行**。

时间用 `Date.now()` 和 `setTimeout`（测试中是假计时器）。
:::files{role=starter}
```ts file=poll.ts
export type PollOptions = {
  /** 最多等待多少毫秒，默认 1000 */
  timeout?: number;
  /** 两次尝试之间等待多少毫秒，默认 50 */
  interval?: number;
};

export async function poll<T>(check: () => T | Promise<T>, options: PollOptions = {}): Promise<T> {
  return check();
}
```
```ts file=main.ts
import { poll } from './poll';

let ready = false;
setTimeout(() => (ready = true), 120);

const value = await poll(() => {
  if (!ready) throw new Error('还没有准备好');
  return '准备好了';
});
console.log(value);

try {
  await poll(() => {
    throw new Error('永远不会成功');
  }, { timeout: 100 });
} catch (error) {
  console.log('超时：', error instanceof Error ? error.message : error);
}
```
:::

:::files{role=solution}
```ts file=poll.ts
export type PollOptions = {
  /** 最多等待多少毫秒，默认 1000 */
  timeout?: number;
  /** 两次尝试之间等待多少毫秒，默认 50 */
  interval?: number;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function poll<T>(check: () => T | Promise<T>, { timeout = 1000, interval = 50 }: PollOptions = {}): Promise<T> {
  const deadline = Date.now() + timeout;
  for (;;) {
    try {
      // 异步的 check 要等它完成，下一次尝试才开始：两次尝试不会重叠
      return await check();
    } catch (error) {
      const now = Date.now();
      if (now >= deadline) throw error; // 以最后一次的错误拒绝
      // 不越过截止时间：最后一次尝试正好在截止时间进行
      await sleep(Math.min(interval, deadline - now));
    }
  }
}
```
```ts file=main.ts
import { poll } from './poll';

let ready = false;
setTimeout(() => (ready = true), 120);

const value = await poll(() => {
  if (!ready) throw new Error('还没有准备好');
  return '准备好了';
});
console.log(value);

try {
  await poll(() => {
    throw new Error('永远不会成功');
  }, { timeout: 100 });
} catch (error) {
  console.log('超时：', error instanceof Error ? error.message : error);
}
```
:::

:::files{role=tests}
```ts file=poll.test.ts
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { poll } from './poll';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/** 前 failures 次抛出错误，之后返回 'ok'；记录每次调用的时间 */
function flaky(failures: number) {
  const times: number[] = [];
  const check = () => {
    times.push(Date.now());
    if (times.length <= failures) throw new Error(`第 ${times.length} 次失败`);
    return 'ok';
  };
  return { check, times };
}

describe('poll', () => {
  test('第一次就成功时立即完成，而且是立刻尝试的', async () => {
    const { check, times } = flaky(0);
    const start = Date.now();
    const result = poll(check);
    expect(times).toEqual([start]);
    await expect(result).resolves.toBe('ok');
  });

  test('每隔 interval 重试，直到成功', async () => {
    const { check, times } = flaky(2);
    const start = Date.now();
    const result = poll(check);
    await vi.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toBe('ok');
    expect(times.map((t) => t - start)).toEqual([0, 50, 100]);
  });

  test('超时后以最后一次的错误拒绝；最后一次尝试正好在截止时间', async () => {
    const { check, times } = flaky(Infinity);
    const start = Date.now();
    const result = poll(check).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(1000);
    const error = await result;
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ message: '第 21 次失败' });
    expect(times).toHaveLength(21);
    expect((times.at(-1) ?? 0) - start).toBe(1000);
  });

  test('自定义 timeout 与 interval：截止时间不是 interval 的整数倍', async () => {
    const { check, times } = flaky(Infinity);
    const start = Date.now();
    const result = poll(check, { timeout: 120, interval: 50 }).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(500);
    await result;
    expect(times.map((t) => t - start)).toEqual([0, 50, 100, 120]);
  });

  test('timeout 为 0：只尝试一次', async () => {
    const { check, times } = flaky(Infinity);
    const result = poll(check, { timeout: 0 }).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(500);
    expect(await result).toMatchObject({ message: '第 1 次失败' });
    expect(times).toHaveLength(1);
  });

  test('异步的 check：等它完成之后再开始计算下一次的间隔，不会重叠', async () => {
    const starts: number[] = [];
    let running = 0;
    let maxRunning = 0;
    const start = Date.now();
    const check = async () => {
      starts.push(Date.now() - start);
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((resolve) => setTimeout(resolve, 80));
      running -= 1;
      throw new Error('慢而且失败');
    };
    const result = poll(check, { timeout: 300 }).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(2000);
    await result;
    expect(starts).toEqual([0, 130, 260]);
    expect(maxRunning).toBe(1);
  });

  test('抛出的不是 Error 也原样传出', async () => {
    const result = poll(() => {
      throw '字符串';
    }, { timeout: 0 }).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(500);
    expect(await result).toBe('字符串');
  });
});
```
:::

:::hint{level=1}
用一个无限循环：`try { return await check(); } catch (error) { … }`。`await check()` 同时处理了同步的返回值、同步抛出的异常和 Promise 的拒绝，而且会等待异步的 check 完成，所以第 4 条自然满足。在 `catch` 中比较 `Date.now()` 和截止时间，决定是抛出 `error` 还是等待之后继续循环。
:::

:::hint{level=2}
等待用 `await new Promise((resolve) => setTimeout(resolve, ms))`，`ms` 是 `Math.min(interval, deadline - now)`，这样最后一次等待正好停在截止时间。`async` 函数在第一个 `await` 之前是同步执行的，所以第一次 `check` 就是在调用 `poll` 时立刻发生的。
:::

:::explanation
`poll` 只有十几行，但每一条规则都对应着测试稳定性中的一个问题：

- **立刻尝试**：结果已经就绪时不浪费时间，测试越快越好；
- **按时间而不是按次数**：`check` 本身可能很慢（例如等待一个网络请求），按次数计算时总时间会远远超过 `timeout`；
- **最后一次尝试在截止时间**：否则实际只等了 `timeout - interval` 就放弃了，接近超时的情况会时好时坏；
- **不重叠**：用 `setInterval` 时，慢的检查还没完成，下一次就开始了，同时有多个检查在进行，结果的顺序也无法确定；
- **原样传出最后一次的错误**：超时时，最有用的信息是“最后一次检查为什么失败”（例如 `Expected: "Count is 3", Received: "Count is 2"`），而不是一句笼统的“超时了”。Playwright 的失败输出中，`Call log` 就列出了每一次检查的结果。

测试中的假计时器（f06）在这里非常关键：真实的等待会让这些测试花上好几秒，而且时间不精确；有了假计时器，“第 0、50、100 毫秒各尝试一次”可以被精确地检查。
:::

:::variant{kind=alt name=promise-chain}
```ts file=poll.ts
export type PollOptions = {
  /** 最多等待多少毫秒，默认 1000 */
  timeout?: number;
  /** 两次尝试之间等待多少毫秒，默认 50 */
  interval?: number;
};

export function poll<T>(check: () => T | Promise<T>, options: PollOptions = {}): Promise<T> {
  const { timeout = 1000, interval = 50 } = options;
  const deadline = Date.now() + timeout;
  return new Promise<T>((resolve, reject) => {
    const failed = (error: unknown) => {
      const left = deadline - Date.now();
      if (left <= 0) reject(error);
      else setTimeout(attempt, Math.min(interval, left));
    };
    function attempt() {
      let result: T | Promise<T>;
      try {
        result = check(); // 同步地调用：第一次尝试发生在 poll 被调用的时候
      } catch (error) {
        failed(error);
        return;
      }
      Promise.resolve(result).then(resolve, failed);
    }
    attempt();
  });
}
```
:::

:::variant{kind=wrong name=count-attempts fails=tests reason="按“次数”而不是按时间重试（timeout / interval 次）：异步的 check 本身花的时间没有算进去，超过了截止时间还在重试"}
```ts file=poll.ts
export type PollOptions = {
  /** 最多等待多少毫秒，默认 1000 */
  timeout?: number;
  /** 两次尝试之间等待多少毫秒，默认 50 */
  interval?: number;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function poll<T>(check: () => T | Promise<T>, { timeout = 1000, interval = 50 }: PollOptions = {}): Promise<T> {
  const attempts = Math.ceil(timeout / interval) + 1;
  for (let i = 1; ; i++) {
    try {
      return await check();
    } catch (error) {
      if (i >= attempts) throw error;
      await sleep(interval);
    }
  }
}
```
:::

:::variant{kind=wrong name=no-final-attempt fails=tests reason="剩下的时间不够一个 interval 就放弃了：截止时间那一刻的最后一次尝试没有进行"}
```ts file=poll.ts
export type PollOptions = {
  /** 最多等待多少毫秒，默认 1000 */
  timeout?: number;
  /** 两次尝试之间等待多少毫秒，默认 50 */
  interval?: number;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function poll<T>(check: () => T | Promise<T>, { timeout = 1000, interval = 50 }: PollOptions = {}): Promise<T> {
  const deadline = Date.now() + timeout;
  for (;;) {
    try {
      // 异步的 check 要等它完成，下一次尝试才开始：两次尝试不会重叠
      return await check();
    } catch (error) {
      const now = Date.now();
      if (now + interval > deadline) throw error;
      await sleep(interval);
    }
  }
}
```
:::

:::variant{kind=wrong name=overlapping fails=tests reason="用 setInterval 按固定的节奏尝试：慢的 check 还没完成，下一次就开始了"}
```ts file=poll.ts
export type PollOptions = {
  /** 最多等待多少毫秒，默认 1000 */
  timeout?: number;
  /** 两次尝试之间等待多少毫秒，默认 50 */
  interval?: number;
};

export function poll<T>(check: () => T | Promise<T>, { timeout = 1000, interval = 50 }: PollOptions = {}): Promise<T> {
  const deadline = Date.now() + timeout;
  return new Promise<T>((resolve, reject) => {
    let done = false;
    const attempt = () => {
      Promise.resolve()
        .then(check)
        .then(
          (value) => {
            if (done) return;
            done = true;
            clearInterval(timer);
            resolve(value);
          },
          (error: unknown) => {
            if (done || Date.now() < deadline) return;
            done = true;
            clearInterval(timer);
            reject(error);
          },
        );
    };
    const timer = setInterval(attempt, interval);
    attempt();
  });
}
```
:::

:::variant{kind=wrong name=generic-timeout-error fails=tests reason="超时时抛出一个新的“超时”错误：最后一次失败的原因丢掉了"}
```ts file=poll.ts
export type PollOptions = {
  /** 最多等待多少毫秒，默认 1000 */
  timeout?: number;
  /** 两次尝试之间等待多少毫秒，默认 50 */
  interval?: number;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function poll<T>(check: () => T | Promise<T>, { timeout = 1000, interval = 50 }: PollOptions = {}): Promise<T> {
  const deadline = Date.now() + timeout;
  for (;;) {
    try {
      // 异步的 check 要等它完成，下一次尝试才开始：两次尝试不会重叠
      return await check();
    } catch (error) {
      const now = Date.now();
      if (now >= deadline) throw new Error(`等待 ${timeout} 毫秒后超时`);
      // 不越过截止时间：最后一次尝试正好在截止时间进行
      await sleep(Math.min(interval, deadline - now));
    }
  }
}
```
:::

:::variant{kind=wrong name=sleep-first fails=tests reason="先等待再尝试第一次：本来立刻就能成功的检查也要多等 interval"}
```ts file=poll.ts
export type PollOptions = {
  /** 最多等待多少毫秒，默认 1000 */
  timeout?: number;
  /** 两次尝试之间等待多少毫秒，默认 50 */
  interval?: number;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function poll<T>(check: () => T | Promise<T>, { timeout = 1000, interval = 50 }: PollOptions = {}): Promise<T> {
  const deadline = Date.now() + timeout;
  for (;;) {
    await sleep(interval);
    try {
      // 异步的 check 要等它完成，下一次尝试才开始：两次尝试不会重叠
      return await check();
    } catch (error) {
      const now = Date.now();
      if (now >= deadline) throw error; // 以最后一次的错误拒绝

    }
  }
}
```
:::
