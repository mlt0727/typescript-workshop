---
kind: task
title: 可以放心使用的 getJson
fixtures: api
---
实现 `getJson(url)`：请求一个地址，返回解析后的 JSON。它要正确处理各种失败：

1. 网络失败时，`fetch` 的拒绝原样传给调用方（不要吞掉）；
2. 状态码不在 200–299 之间时，抛出 `HttpError`，它的 `status` 是状态码，`message` 是 `请求失败：状态码 404`（数字换成实际的状态码）；
3. 状态码是 204（No Content）时，返回 `null`，不要读取响应体；
4. 其他成功的情况，返回 `response.json()` 的结果。响应体不是 JSON 时，`json()` 的 `SyntaxError` 原样传给调用方；
5. 返回类型是 `Promise<unknown>`：调用方必须先验证再使用。

`HttpError` 已经写好。测试使用课程提供的模拟响应，例如 `/api/profile` 返回一个用户对象，`/api/missing` 返回 404。

:::files{role=starter}
```ts file=http.ts
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`请求失败：状态码 ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

export async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  return response.json();
}
```
:::

:::files{role=solution}
```ts file=http.ts
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`请求失败：状态码 ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

export async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new HttpError(response.status);
  }
  if (response.status === 204) {
    return null;
  }
  const data: unknown = await response.json();
  return data;
}
```
:::

:::files{role=tests}
```ts file=http.test.ts
import { describe, expect, test } from 'vitest';
import { getJson, HttpError } from './http';

async function failure(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error('期望被拒绝，实际成功了');
}

describe('getJson', () => {
  test('成功时返回解析后的 JSON', async () => {
    await expect(getJson('/api/profile')).resolves.toEqual({ id: 7, name: 'Grace' });
  });

  test('404 与 500 抛出 HttpError', async () => {
    const notFound = await failure(getJson('/api/missing'));
    expect(notFound).toBeInstanceOf(HttpError);
    expect(notFound).toMatchObject({ status: 404, message: '请求失败：状态码 404', name: 'HttpError' });
    const crash = await failure(getJson('/api/crash'));
    expect(crash).toMatchObject({ status: 500 });
  });

  test('204 返回 null', async () => {
    await expect(getJson('/api/empty')).resolves.toBeNull();
  });

  test('响应体不是 JSON 时，SyntaxError 原样传出', async () => {
    expect(await failure(getJson('/api/not-json'))).toBeInstanceOf(SyntaxError);
  });

  test('网络失败时，fetch 的拒绝原样传出', async () => {
    const err = await failure(getJson('/api/offline'));
    expect(err).toBeInstanceOf(TypeError);
    expect(err).not.toBeInstanceOf(HttpError);
  });
});
```
```ts file=http.test-d.ts
import { expectTypeOf } from 'vitest';
import { getJson } from './http';

expectTypeOf(getJson('/x')).toEqualTypeOf<Promise<unknown>>();
```
:::

:::hint{level=1}
`fetch` 之后先检查 `response.ok`，不成功就 `throw new HttpError(response.status)`。然后单独处理 204：它没有响应体，调用 `json()` 会出错。网络失败不需要任何代码：不写 `try/catch`，`await fetch(...)` 的拒绝自然就传给了调用方。
:::

:::hint{level=2}
`if (!response.ok) throw new HttpError(response.status);`，`if (response.status === 204) return null;`，最后 `const data: unknown = await response.json(); return data;`。
:::

:::explanation
`fetch` 把“请求没能完成”和“服务器说出错了”分成了两种情况：前者是被拒绝的 Promise，后者是 `ok` 为 `false` 的 `Response`。`getJson` 把后者也变成被拒绝的 Promise，调用方就可以用一个 `try/catch` 处理所有失败，并用 `instanceof HttpError` 区分是哪一种。

起始代码的问题：404 时，服务器返回的错误信息 `{ message: '没有这个资源' }` 被当成了正常的数据返回；204 时，空的响应体让 `json()` 抛出 `SyntaxError`。

`response.json()` 的类型是 `Promise<any>`。挡住 `any` 的是函数的返回类型 `Promise<unknown>`：即使直接写 `return response.json()`，调用方拿到的也是 `unknown`。先赋给 `unknown` 类型的变量，是为了在函数内部也不会不小心使用 `any`。返回类型同时提醒调用方：拿到的数据还没有经过验证。

这里没有用 `try/catch` 包住任何东西：不知道如何处理的错误，就不要捕获，让它传给知道如何处理的调用方。
:::

:::variant{kind=alt name=text-then-parse}
```ts file=http.ts
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`请求失败：状态码 ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

export async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (response.status < 200 || response.status > 299) throw new HttpError(response.status);
  if (response.status === 204) return null;
  const text = await response.text();
  const parsed: unknown = JSON.parse(text);
  return parsed;
}
```
:::

:::variant{kind=wrong name=no-ok-check fails=tests reason="没有检查 response.ok，把 404 的错误信息当成了数据"}
```ts file=http.ts
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`请求失败：状态码 ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

export async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (response.status === 204) return null;
  const data: unknown = await response.json();
  return data;
}
```
:::

:::variant{kind=wrong name=json-on-204 fails=tests reason="204 时也调用了 json()，空响应体导致 SyntaxError"}
```ts file=http.ts
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`请求失败：状态码 ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

export async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new HttpError(response.status);
  const data: unknown = await response.json();
  return data;
}
```
:::

:::variant{kind=wrong name=swallow-errors fails=tests reason="捕获了所有错误并返回 null，调用方无法知道请求失败了"}
```ts file=http.ts
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`请求失败：状态码 ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

export async function getJson(url: string): Promise<unknown> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new HttpError(response.status);
    if (response.status === 204) return null;
    const data: unknown = await response.json();
    return data;
  } catch {
    return null;
  }
}
```
:::

:::variant{kind=wrong name=wrap-network-error fails=tests reason="把网络失败也包装成了 HttpError，调用方无法区分"}
```ts file=http.ts
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`请求失败：状态码 ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

export async function getJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new HttpError(0);
  }
  if (!response.ok) throw new HttpError(response.status);
  if (response.status === 204) return null;
  const data: unknown = await response.json();
  return data;
}
```
:::
