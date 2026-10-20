---
kind: challenge
title: 失败时自动重试
---
网络偶尔抖动，服务器偶尔过载（503），或者提示“请求太频繁”（429）。这些情况稍等一会儿再试，往往就成功了。实现 `fetchWithRetry(url, options, fetchImpl)`：

1. 最多尝试 `1 + options.retries` 次；
2. **可以重试**的情况：`fetchImpl` 被拒绝（网络失败），或者响应的状态码是 429 或 5xx。其他响应（包括 2xx 和其他 4xx）立即返回，不再重试；
3. 第 1 次重试前等待 `baseDelayMs`，第 2 次等待 `baseDelayMs × 2`，第 3 次等待 `baseDelayMs × 4`……（指数退避）；
4. 可以重试的**响应**带有 `Retry-After` 头部、并且它的值是一个非负整数（秒数）时，改为等待这么多秒；
5. 次数用完时：最后一次得到的是响应，就返回这个响应；最后一次是网络失败，就抛出那次的错误。

第三个参数 `fetchImpl` 默认就是 `fetch`。把它作为参数，测试就可以传入一个按顺序返回预定结果的假函数——这种写法叫**依赖注入**，能让依赖外部世界的代码变得容易测试。测试还会用假计时器检查每次等待的时长。

:::files{role=starter}
```ts file=retry.ts
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type RetryOptions = { retries: number; baseDelayMs: number };

export async function fetchWithRetry(url: string, options: RetryOptions, fetchImpl: FetchLike = fetch): Promise<Response> {
  return fetchImpl(url);
}
```
:::

:::files{role=solution}
```ts file=retry.ts
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type RetryOptions = { retries: number; baseDelayMs: number };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

function retryAfterMs(response: Response): number | undefined {
  const value = response.headers.get('Retry-After');
  return value !== null && /^\d+$/.test(value) ? Number(value) * 1000 : undefined;
}

export async function fetchWithRetry(url: string, options: RetryOptions, fetchImpl: FetchLike = fetch): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const isLast = attempt >= options.retries;
    let wait = options.baseDelayMs * 2 ** attempt;
    try {
      const response = await fetchImpl(url);
      if (!isRetryable(response.status) || isLast) {
        return response;
      }
      wait = retryAfterMs(response) ?? wait;
    } catch (err) {
      if (isLast) throw err;
    }
    await sleep(wait);
  }
}
```
:::

:::files{role=tests}
```ts file=retry.test.ts
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fetchWithRetry } from './retry';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** 按顺序返回预定结果的假 fetch，并记录每次调用的时间 */
function scripted(steps: (number | Error | Response)[]) {
  const times: number[] = [];
  const start = Date.now();
  const fn = vi.fn(async (_input: string, _init?: RequestInit): Promise<Response> => {
    times.push(Date.now() - start);
    const step = steps.shift();
    if (step === undefined) throw new Error('fetch 被调用的次数超过了预期');
    if (step instanceof Error) throw step;
    return typeof step === 'number' ? new Response(null, { status: step }) : step;
  });
  return { fn, times };
}

describe('fetchWithRetry', () => {
  test('成功时直接返回，不重试', async () => {
    const { fn } = scripted([200]);
    const response = await fetchWithRetry('/x', { retries: 3, baseDelayMs: 100 }, fn);
    expect(response.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('5xx 时按指数退避重试，成功后返回', async () => {
    const { fn, times } = scripted([500, 503, 200]);
    const pending = fetchWithRetry('/x', { retries: 3, baseDelayMs: 100 }, fn);
    await vi.advanceTimersByTimeAsync(99);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(200);
    const response = await pending;
    expect(response.status).toBe(200);
    expect(times).toEqual([0, 100, 300]);
  });

  test('其他 4xx 不重试', async () => {
    const { fn } = scripted([404]);
    const response = await fetchWithRetry('/x', { retries: 3, baseDelayMs: 100 }, fn);
    expect(response.status).toBe(404);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('429 时按 Retry-After 等待', async () => {
    const tooMany = new Response(null, { status: 429, headers: { 'Retry-After': '2' } });
    const { fn, times } = scripted([tooMany, 200]);
    const pending = fetchWithRetry('/x', { retries: 1, baseDelayMs: 100 }, fn);
    await vi.advanceTimersByTimeAsync(2000);
    expect((await pending).status).toBe(200);
    expect(times).toEqual([0, 2000]);
  });

  test('Retry-After 不是整数秒时，仍按指数退避', async () => {
    const tooMany = new Response(null, { status: 503, headers: { 'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT' } });
    const { fn, times } = scripted([tooMany, 200]);
    const pending = fetchWithRetry('/x', { retries: 1, baseDelayMs: 50 }, fn);
    await vi.advanceTimersByTimeAsync(50);
    await pending;
    expect(times).toEqual([0, 50]);
  });

  test('网络失败也会重试；次数用完时抛出最后一次的错误', async () => {
    const { fn } = scripted([new TypeError('第 1 次'), new TypeError('第 2 次'), new TypeError('第 3 次')]);
    const assertion = expect(fetchWithRetry('/x', { retries: 2, baseDelayMs: 10 }, fn)).rejects.toThrow('第 3 次');
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test('次数用完时返回最后一个响应', async () => {
    const { fn } = scripted([500, 502]);
    const pending = fetchWithRetry('/x', { retries: 1, baseDelayMs: 10 }, fn);
    await vi.advanceTimersByTimeAsync(1000);
    expect((await pending).status).toBe(502);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('retries 为 0 时只尝试一次', async () => {
    const { fn } = scripted([503]);
    expect((await fetchWithRetry('/x', { retries: 0, baseDelayMs: 10 }, fn)).status).toBe(503);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
```
:::

:::hint{level=1}
用一个循环表示“第几次尝试”。每次尝试有三种结果：返回了不需要重试的响应（直接返回）、返回了需要重试的响应、或者被拒绝（用 `try/catch` 捕获）。如果这是最后一次，就返回响应或抛出错误；否则等待一段时间，进入下一次循环。
:::

:::hint{level=2}
第 `attempt` 次（从 0 开始）失败后的等待时间是 `baseDelayMs * 2 ** attempt`。`Retry-After`：`response.headers.get('Retry-After')` 得到字符串或 `null`，用正则 `/^\d+$/` 确认是整数秒，再乘以 1000。等待用 `new Promise((resolve) => setTimeout(resolve, ms))` 包装（e02）。
:::

:::explanation
重试的关键是**只重试有希望成功的失败**：网络抖动、429、5xx 都可能是暂时的；400、404 这类错误再试多少次结果也一样，重试只会浪费时间、加重服务器负担。

**指数退避**让等待时间成倍增长：服务器过载时，大量客户端如果都在固定的短时间后重试，会让服务器更难恢复。真实的实现通常还会加上随机的“抖动”（jitter），让不同客户端的重试时间错开。服务器通过 `Retry-After` 明确告诉了等待多久时，应该听它的。

`fetchImpl` 参数是依赖注入：函数不再直接依赖全局的 `fetch`，测试时就能传入一个完全受控的假函数，按顺序返回 500、503、200，再配合假计时器，精确地检查每次请求发出的时刻（`times`），而不用真的等待。

注意 `fetchWithRetry` 只适合**可以安全重复**的请求（例如 GET）。创建订单这样的 POST 请求，如果第一次其实已经成功、只是响应在路上丢了，重试可能会创建两个订单。
:::

:::variant{kind=alt name=recursive}
```ts file=retry.ts
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type RetryOptions = { retries: number; baseDelayMs: number };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function fetchWithRetry(url: string, options: RetryOptions, fetchImpl: FetchLike = fetch, attempt = 0): Promise<Response> {
  const canRetry = attempt < options.retries;
  const backoff = options.baseDelayMs * 2 ** attempt;
  let response: Response;
  try {
    response = await fetchImpl(url);
  } catch (err) {
    if (!canRetry) throw err;
    await sleep(backoff);
    return fetchWithRetry(url, options, fetchImpl, attempt + 1);
  }
  if (!canRetry || (response.status !== 429 && response.status < 500)) return response;
  const header = response.headers.get('Retry-After') ?? '';
  await sleep(/^\d+$/.test(header) ? Number(header) * 1000 : backoff);
  return fetchWithRetry(url, options, fetchImpl, attempt + 1);
}
```
:::

:::variant{kind=wrong name=retry-all-errors fails=tests reason="所有失败的状态码都重试了，包括 404"}
```ts file=retry.ts
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type RetryOptions = { retries: number; baseDelayMs: number };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function fetchWithRetry(url: string, options: RetryOptions, fetchImpl: FetchLike = fetch): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const isLast = attempt >= options.retries;
    let wait = options.baseDelayMs * 2 ** attempt;
    try {
      const response = await fetchImpl(url);
      if (response.ok || isLast) return response;
      const header = response.headers.get('Retry-After');
      if (header !== null && /^\d+$/.test(header)) wait = Number(header) * 1000;
    } catch (err) {
      if (isLast) throw err;
    }
    await sleep(wait);
  }
}
```
:::

:::variant{kind=wrong name=constant-delay fails=tests reason="每次都等待相同的时间，没有指数退避"}
```ts file=retry.ts
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type RetryOptions = { retries: number; baseDelayMs: number };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function fetchWithRetry(url: string, options: RetryOptions, fetchImpl: FetchLike = fetch): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const isLast = attempt >= options.retries;
    let wait = options.baseDelayMs;
    try {
      const response = await fetchImpl(url);
      if ((response.status !== 429 && response.status < 500) || isLast) return response;
      const header = response.headers.get('Retry-After');
      if (header !== null && /^\d+$/.test(header)) wait = Number(header) * 1000;
    } catch (err) {
      if (isLast) throw err;
    }
    await sleep(wait);
  }
}
```
:::

:::variant{kind=wrong name=ignore-retry-after fails=tests reason="忽略了 Retry-After"}
```ts file=retry.ts
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type RetryOptions = { retries: number; baseDelayMs: number };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function fetchWithRetry(url: string, options: RetryOptions, fetchImpl: FetchLike = fetch): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const isLast = attempt >= options.retries;
    try {
      const response = await fetchImpl(url);
      if ((response.status !== 429 && response.status < 500) || isLast) return response;
    } catch (err) {
      if (isLast) throw err;
    }
    await sleep(options.baseDelayMs * 2 ** attempt);
  }
}
```
:::

:::variant{kind=wrong name=generic-final-error fails=tests reason="次数用完时抛出了新的错误，丢掉了最后一次失败的原因"}
```ts file=retry.ts
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type RetryOptions = { retries: number; baseDelayMs: number };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function fetchWithRetry(url: string, options: RetryOptions, fetchImpl: FetchLike = fetch): Promise<Response> {
  for (let attempt = 0; attempt <= options.retries; attempt++) {
    let wait = options.baseDelayMs * 2 ** attempt;
    try {
      const response = await fetchImpl(url);
      if ((response.status !== 429 && response.status < 500) || attempt === options.retries) return response;
      const header = response.headers.get('Retry-After');
      if (header !== null && /^\d+$/.test(header)) wait = Number(header) * 1000;
    } catch {
      // 继续重试
    }
    if (attempt < options.retries) await sleep(wait);
  }
  throw new Error('重试次数已用完');
}
```
:::
