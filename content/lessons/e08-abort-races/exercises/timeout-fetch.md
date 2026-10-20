---
kind: challenge
title: 可以取消、会超时的请求
fixtures: timeout
---
实现 `getJsonWithTimeout(url, options)`：

1. `options.timeoutMs` 毫秒后请求（包括读取响应体）还没完成，就**中止请求**，并以 `RequestTimeoutError` 拒绝，消息是 `请求超过 100 毫秒`（数字换成实际的值）；
2. `options.signal`（可选）是调用方的取消信号。调用方取消时中止请求，并以**调用方给出的取消原因**（`signal.reason`）原样拒绝；如果调用之前它就已经被取消了，也一样（这时不应该发出请求）；
3. 状态码不在 200–299 之间时，以 `HttpError` 拒绝（`status` 是状态码）；
4. 成功时返回解析后的 JSON（类型是 `unknown`）。

`HttpError` 和 `RequestTimeoutError` 已经写好。模拟的服务器中，`/api/fast` 20 毫秒后响应，`/api/slow` 要 400 毫秒；`/api/slow-body` 的响应头 20 毫秒就到了，但响应体要再过 400 毫秒才传输完；`/api/missing` 返回 404。

:::files{role=starter}
```ts file=request.ts
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`请求失败：状态码 ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

export class RequestTimeoutError extends Error {
  constructor(ms: number) {
    super(`请求超过 ${ms} 毫秒`);
    this.name = 'RequestTimeoutError';
  }
}

export type RequestOptions = { timeoutMs: number; signal?: AbortSignal };

export async function getJsonWithTimeout(url: string, options: RequestOptions): Promise<unknown> {
  const response = await fetch(url);
  const data: unknown = await response.json();
  return data;
}
```
:::

:::files{role=solution}
```ts file=request.ts
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`请求失败：状态码 ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

export class RequestTimeoutError extends Error {
  constructor(ms: number) {
    super(`请求超过 ${ms} 毫秒`);
    this.name = 'RequestTimeoutError';
  }
}

export type RequestOptions = { timeoutMs: number; signal?: AbortSignal };

export async function getJsonWithTimeout(url: string, options: RequestOptions): Promise<unknown> {
  const timeout = AbortSignal.timeout(options.timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

  try {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new HttpError(response.status);
    const data: unknown = await response.json();
    return data;
  } catch (err) {
    if (options.signal?.aborted) throw options.signal.reason;
    if (timeout.aborted) throw new RequestTimeoutError(options.timeoutMs);
    throw err;
  }
}
```
:::

:::files{role=tests}
```ts file=request.test.ts
import { describe, expect, test, vi } from 'vitest';
import { getJsonWithTimeout, HttpError, RequestTimeoutError } from './request';

async function failure(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error('期望被拒绝，实际成功了');
}

describe('getJsonWithTimeout', () => {
  test('及时完成时返回 JSON', async () => {
    await expect(getJsonWithTimeout('/api/fast', { timeoutMs: 300 })).resolves.toEqual({ name: 'fast' });
  });

  test('超时：以 RequestTimeoutError 拒绝，并且很快结束', async () => {
    const start = Date.now();
    const err = await failure(getJsonWithTimeout('/api/slow', { timeoutMs: 100 }));
    expect(err).toBeInstanceOf(RequestTimeoutError);
    expect(err).toMatchObject({ message: '请求超过 100 毫秒' });
    expect(Date.now() - start).toBeLessThan(350);
  });

  test('超时会真正中止请求，而不只是不再等待', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    await failure(getJsonWithTimeout('/api/slow', { timeoutMs: 50 }));
    const signal = spy.mock.calls[0]?.[1]?.signal;
    expect(signal?.aborted, '传给 fetch 的信号应当已经被中止').toBe(true);
  });

  test('响应头及时到达、响应体传输得太慢，同样算超时', async () => {
    const start = Date.now();
    const err = await failure(getJsonWithTimeout('/api/slow-body', { timeoutMs: 100 }));
    expect(err).toBeInstanceOf(RequestTimeoutError);
    expect(Date.now() - start).toBeLessThan(350);
  });

  test('调用方取消：以调用方的原因拒绝，不是超时', async () => {
    const controller = new AbortController();
    const reason = new Error('用户离开了页面');
    setTimeout(() => controller.abort(reason), 30);
    const err = await failure(getJsonWithTimeout('/api/slow', { timeoutMs: 1000, signal: controller.signal }));
    expect(err).toBe(reason);
  });

  test('读取响应体期间调用方取消：同样以调用方的原因拒绝', async () => {
    const controller = new AbortController();
    const reason = new Error('切换到了别的页面');
    setTimeout(() => controller.abort(reason), 60);
    const err = await failure(getJsonWithTimeout('/api/slow-body', { timeoutMs: 1000, signal: controller.signal }));
    expect(err).toBe(reason);
  });

  test('调用方取消时没有给出原因：得到 AbortError', async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 30);
    const err = await failure(getJsonWithTimeout('/api/slow', { timeoutMs: 1000, signal: controller.signal }));
    expect(err).toBeInstanceOf(DOMException);
    expect(err).toMatchObject({ name: 'AbortError' });
  });

  test('已经取消的信号：立即拒绝', async () => {
    const reason = new Error('早就取消了');
    const start = Date.now();
    const err = await failure(getJsonWithTimeout('/api/slow', { timeoutMs: 1000, signal: AbortSignal.abort(reason) }));
    expect(err).toBe(reason);
    expect(Date.now() - start).toBeLessThan(100);
  });

  test('HTTP 错误', async () => {
    const err = await failure(getJsonWithTimeout('/api/missing', { timeoutMs: 300 }));
    expect(err).toBeInstanceOf(HttpError);
    expect(err).toMatchObject({ status: 404 });
  });
});
```
:::

:::hint{level=1}
用 `AbortSignal.timeout(timeoutMs)` 创建超时信号；调用方也给了 `signal` 时，用 `AbortSignal.any([调用方的信号, 超时信号])` 组合成一个，传给 `fetch`。
:::

:::hint{level=2}
把 `fetch`、状态码检查和 `response.json()` 都放进同一个 `try`。被拒绝之后，判断是谁导致的：`options.signal?.aborted` 为真，就 `throw options.signal.reason`；否则 `timeout.aborted` 为真，就抛出 `RequestTimeoutError`；都不是（例如网络失败），原样抛出。先检查调用方的信号：两者都已取消时，以调用方为准。
:::

:::explanation
`AbortSignal.any` 把“调用方取消”和“超时”两个条件合并成一个信号：任何一个先发生，`fetch` 都会被中止。与 e04 的 `Promise.race` 超时不同，这里请求真的被停下了。

被拒绝之后要区分原因，因为调用方对它们的处理不同：调用方自己取消的请求通常静默忽略（它知道原因），超时则可能需要提示用户或者重试。取消原因（`signal.reason`）由调用方决定，可以是任何值：没有给出时是一个 `AbortError`，超时信号的原因是 `TimeoutError`。把调用方的原因原样传回去，调用方才能认出“这是我取消的”。

`fetch` 在**响应头**到达时就兑现了，这时响应体可能还在传输。信号在这之后被中止，读取响应体（`response.json()`）会以中止原因拒绝。所以 `json()` 也要放在同一个 `try` 里，否则响应体传得慢时，调用方得到的是一个 `DOMException`（`TimeoutError`），而不是约定的 `RequestTimeoutError`。

已经取消的信号传给 `fetch` 时，它会立即拒绝，根本不发出请求，所以第 2 条不需要特别处理。测试中的 `AbortSignal.abort(原因)` 创建一个一开始就已取消的信号。
:::

:::variant{kind=alt name=manual-controller}
```ts file=request.ts
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`请求失败：状态码 ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

export class RequestTimeoutError extends Error {
  constructor(ms: number) {
    super(`请求超过 ${ms} 毫秒`);
    this.name = 'RequestTimeoutError';
  }
}

export type RequestOptions = { timeoutMs: number; signal?: AbortSignal };

export async function getJsonWithTimeout(url: string, options: RequestOptions): Promise<unknown> {
  const outer = options.signal;
  outer?.throwIfAborted();
  const controller = new AbortController();
  const timeoutError = new RequestTimeoutError(options.timeoutMs);
  const timer = setTimeout(() => controller.abort(timeoutError), options.timeoutMs);
  const onAbort = () => controller.abort(outer?.reason);
  outer?.addEventListener('abort', onAbort, { once: true });
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new HttpError(response.status);
    const data: unknown = await response.json();
    return data;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', onAbort);
  }
}
```
:::

:::variant{kind=wrong name=ignore-caller-signal fails=tests reason="只用了超时信号，忽略了调用方的取消"}
```ts file=request.ts
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`请求失败：状态码 ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

export class RequestTimeoutError extends Error {
  constructor(ms: number) {
    super(`请求超过 ${ms} 毫秒`);
    this.name = 'RequestTimeoutError';
  }
}

export type RequestOptions = { timeoutMs: number; signal?: AbortSignal };

export async function getJsonWithTimeout(url: string, options: RequestOptions): Promise<unknown> {
  const timeout = AbortSignal.timeout(options.timeoutMs);
  let response: Response;
  try {
    response = await fetch(url, { signal: timeout });
  } catch (err) {
    if (timeout.aborted) throw new RequestTimeoutError(options.timeoutMs);
    throw err;
  }
  if (!response.ok) throw new HttpError(response.status);
  const data: unknown = await response.json();
  return data;
}
```
:::

:::variant{kind=wrong name=everything-is-timeout fails=tests reason="任何中止都报告成超时，调用方的取消原因丢失了"}
```ts file=request.ts
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`请求失败：状态码 ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

export class RequestTimeoutError extends Error {
  constructor(ms: number) {
    super(`请求超过 ${ms} 毫秒`);
    this.name = 'RequestTimeoutError';
  }
}

export type RequestOptions = { timeoutMs: number; signal?: AbortSignal };

export async function getJsonWithTimeout(url: string, options: RequestOptions): Promise<unknown> {
  const timeout = AbortSignal.timeout(options.timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (err) {
    if (err instanceof DOMException || signal.aborted) throw new RequestTimeoutError(options.timeoutMs);
    throw err;
  }
  if (!response.ok) throw new HttpError(response.status);
  const data: unknown = await response.json();
  return data;
}
```
:::

:::variant{kind=wrong name=race-without-abort fails=tests reason="用 Promise.race 实现超时，没有把取消信号交给 fetch，调用方的取消不起作用"}
```ts file=request.ts
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`请求失败：状态码 ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

export class RequestTimeoutError extends Error {
  constructor(ms: number) {
    super(`请求超过 ${ms} 毫秒`);
    this.name = 'RequestTimeoutError';
  }
}

export type RequestOptions = { timeoutMs: number; signal?: AbortSignal };

export async function getJsonWithTimeout(url: string, options: RequestOptions): Promise<unknown> {
  let timer = 0;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RequestTimeoutError(options.timeoutMs)), options.timeoutMs);
  });
  try {
    const response = await Promise.race([fetch(url), timeout]);
    if (!response.ok) throw new HttpError(response.status);
    const data: unknown = await response.json();
    return data;
  } finally {
    clearTimeout(timer);
  }
}
```
:::

:::variant{kind=wrong name=json-outside-try fails=tests reason="只转换了 fetch 的错误，读取响应体时超时得到的是 DOMException"}
```ts file=request.ts
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`请求失败：状态码 ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

export class RequestTimeoutError extends Error {
  constructor(ms: number) {
    super(`请求超过 ${ms} 毫秒`);
    this.name = 'RequestTimeoutError';
  }
}

export type RequestOptions = { timeoutMs: number; signal?: AbortSignal };

export async function getJsonWithTimeout(url: string, options: RequestOptions): Promise<unknown> {
  const timeout = AbortSignal.timeout(options.timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (err) {
    if (options.signal?.aborted) throw options.signal.reason;
    if (timeout.aborted) throw new RequestTimeoutError(options.timeoutMs);
    throw err;
  }

  if (!response.ok) throw new HttpError(response.status);
  const data: unknown = await response.json();
  return data;
}
```
:::

:::variant{kind=wrong name=race-with-caller-signal fails=tests reason="用 Promise.race 实现超时：超时后请求并没有被中止"}
```ts file=request.ts
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`请求失败：状态码 ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

export class RequestTimeoutError extends Error {
  constructor(ms: number) {
    super(`请求超过 ${ms} 毫秒`);
    this.name = 'RequestTimeoutError';
  }
}

export type RequestOptions = { timeoutMs: number; signal?: AbortSignal };

export async function getJsonWithTimeout(url: string, options: RequestOptions): Promise<unknown> {
  let timer = 0;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RequestTimeoutError(options.timeoutMs)), options.timeoutMs);
  });
  const request = (async () => {
    const response = await fetch(url, { signal: options.signal });
    if (!response.ok) throw new HttpError(response.status);
    const data: unknown = await response.json();
    return data;
  })();
  try {
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
```
:::

:::variant{kind=wrong name=no-status-check fails=tests reason="没有检查 response.ok"}
```ts file=request.ts
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`请求失败：状态码 ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

export class RequestTimeoutError extends Error {
  constructor(ms: number) {
    super(`请求超过 ${ms} 毫秒`);
    this.name = 'RequestTimeoutError';
  }
}

export type RequestOptions = { timeoutMs: number; signal?: AbortSignal };

export async function getJsonWithTimeout(url: string, options: RequestOptions): Promise<unknown> {
  const timeout = AbortSignal.timeout(options.timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  try {
    const response = await fetch(url, { signal });
    const data: unknown = await response.json();
    return data;
  } catch (err) {
    if (options.signal?.aborted) throw options.signal.reason;
    if (timeout.aborted) throw new RequestTimeoutError(options.timeoutMs);
    throw err;
  }
}
```
:::
