---
kind: challenge
title: 包装 Route Handler
---
每个 Route Handler 都写一遍 `try`/`catch` 很容易漏掉。在 `with-error-handling.ts` 中实现一个包装函数（`errors.ts`、`responses.ts` 是上一个练习的答案，只读）：

1. `isControlFlow(error)`：`error` 是一个对象，有字符串类型的 `digest` 属性，并且它以 `NEXT_REDIRECT` 或 `NEXT_HTTP_ERROR_FALLBACK` 开头时返回 `true`（正文中实测的 `redirect()` 和 `notFound()` 抛出的值）；
2. `withErrorHandling(handler, deps)` 返回一个新的 handler，参数和 `handler` 相同（`context` 原样交给它）。每次调用：
   - 用 `deps.newId()` 生成这个请求的 `requestId`（每个请求一个新的）；
   - `handler` 正常返回：返回它的响应，加上 `X-Request-Id: requestId` 响应头，状态码、其他的头和响应体不变。有的响应的头不能修改（例如 `Response.redirect` 创建的），所以要构造一个新的响应；
   - `handler` 抛出了控制流：**原样抛出**，交给 Next.js 处理，不记录日志；
   - `handler` 抛出了其他的值：返回 `toErrorResponse(error, requestId)`；
3. **日志**：除了控制流，每个请求调用一次 `deps.log({ requestId, method, path, status })`。`path` 是地址的路径部分，**不含**查询字符串；只有状态码是 5xx 并且是因为抛出了错误时，才加上 `error`（抛出的那个值）。`deps.log` 抛出错误时不影响返回的响应。

:::files{role=starter}
```ts file=with-error-handling.ts
import { toErrorResponse } from './responses';

export type Handler<C> = (request: Request, context: C) => Promise<Response>;

export type LogEntry = Readonly<{ requestId: string; method: string; path: string; status: number; error?: unknown }>;

export type Deps = Readonly<{ newId: () => string; log: (entry: LogEntry) => void }>;

/** redirect()、notFound() 抛出的“错误”是 Next.js 的控制流：必须原样抛出 */
export function isControlFlow(error: unknown): boolean {
  // TODO
  return false;
}

/** 包装一个 Route Handler：每个请求一个 id，错误变成 JSON 响应，每个请求记录一条日志 */
export function withErrorHandling<C>(handler: Handler<C>, deps: Deps): Handler<C> {
  // TODO
  return handler;
}
```
:::

:::files{role=support}
```ts file=errors.ts readonly
/** 业务代码抛出的“预期的”错误：它们的 message 是写给用户看的，可以返回给浏览器 */

/** 输入不合法：fields 是每个字段的错误信息 */
export class ValidationError extends Error {
  readonly fields: Readonly<Record<string, string>>;
  constructor(fields: Readonly<Record<string, string>>) {
    super('输入有误');
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

/** 请求本身有问题，例如请求体不是 JSON */
export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

/** 没有登录（unauthenticated），或者登录了但没有权限（forbidden） */
export class AuthError extends Error {
  readonly reason: 'unauthenticated' | 'forbidden';
  constructor(reason: 'unauthenticated' | 'forbidden') {
    super(reason === 'unauthenticated' ? '请先登录' : '没有权限');
    this.name = 'AuthError';
    this.reason = reason;
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

/** 和现有的数据冲突，例如重名、版本不一致 */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}
```
```ts file=responses.ts readonly
import { AuthError, BadRequestError, ConflictError, NotFoundError, ValidationError } from './errors';

export type ErrorBody = Readonly<{ error: string; requestId: string; fields?: Readonly<Record<string, string>> }>;

/** 每种错误对应的状态码和返回给用户的信息；不认识的错误一律是 500，不透露任何细节 */
function describe(error: unknown): { status: number; message: string; fields?: Readonly<Record<string, string>> } {
  if (error instanceof ValidationError) return { status: 422, message: error.message, fields: error.fields };
  if (error instanceof BadRequestError) return { status: 400, message: error.message };
  if (error instanceof AuthError) return { status: error.reason === 'unauthenticated' ? 401 : 403, message: error.message };
  if (error instanceof NotFoundError) return { status: 404, message: error.message };
  if (error instanceof ConflictError) return { status: 409, message: error.message };
  return { status: 500, message: '服务器出错了，请稍后再试' };
}

/** 把 Route Handler 中抛出的错误变成一个 JSON 响应 */
export function toErrorResponse(error: unknown, requestId: string): Response {
  const { status, message, fields } = describe(error);
  const body: ErrorBody = fields === undefined ? { error: message, requestId } : { error: message, requestId, fields };
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId } });
}

/** request.json() 解析失败：Node.js 和 Chromium 中是 SyntaxError，WebKit 中是 name 为 SyntaxError 的 DOMException */
function isParseError(error: unknown): boolean {
  return error instanceof SyntaxError || (error instanceof DOMException && error.name === 'SyntaxError');
}

/** 读取 JSON 请求体：无法解析时是 BadRequestError，其他的错误原样抛出 */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch (error) {
    if (isParseError(error)) throw new BadRequestError('请求体不是有效的 JSON');
    throw error;
  }
}
```
```ts file=main.ts readonly
import { NotFoundError } from './errors';
import { withErrorHandling } from './with-error-handling';

let n = 0;
const deps = { newId: () => `req-${++n}`, log: (entry: object) => console.log('日志', JSON.stringify(entry)) };

const getProject = withErrorHandling(async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  if (id !== 'p1') throw new NotFoundError('找不到这个项目');
  return Response.json({ id, name: '官网改版' });
}, deps);

for (const id of ['p1', 'p9']) {
  const response = await getProject(new Request(`https://app.example/api/projects/${id}?token=abc`), { params: Promise.resolve({ id }) });
  console.log(response.status, response.headers.get('x-request-id'), await response.text());
}
```
:::

:::files{role=solution}
```ts file=with-error-handling.ts
import { toErrorResponse } from './responses';

export type Handler<C> = (request: Request, context: C) => Promise<Response>;

export type LogEntry = Readonly<{ requestId: string; method: string; path: string; status: number; error?: unknown }>;

export type Deps = Readonly<{ newId: () => string; log: (entry: LogEntry) => void }>;

/** redirect()、notFound() 抛出的“错误”是 Next.js 的控制流：digest 以这些前缀开头，必须原样抛出 */
const CONTROL_FLOW = ['NEXT_REDIRECT', 'NEXT_HTTP_ERROR_FALLBACK'];

export function isControlFlow(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('digest' in error)) return false;
  const { digest } = error;
  return typeof digest === 'string' && CONTROL_FLOW.some((prefix) => digest.startsWith(prefix));
}

/** 给响应加上 X-Request-Id：有的响应（例如 Response.redirect）的头不能修改，所以复制一份 */
function withRequestId(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Request-Id', requestId);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** 包装一个 Route Handler：每个请求一个 id，错误变成 JSON 响应，每个请求记录一条日志 */
export function withErrorHandling<C>(handler: Handler<C>, deps: Deps): Handler<C> {
  return async (request, context) => {
    const requestId = deps.newId();
    const { pathname } = new URL(request.url);
    let response: Response;
    let unexpected: { error: unknown } | undefined;
    try {
      response = withRequestId(await handler(request, context), requestId);
    } catch (error) {
      if (isControlFlow(error)) throw error;
      response = toErrorResponse(error, requestId);
      if (response.status >= 500) unexpected = { error };
    }
    const entry: LogEntry = { requestId, method: request.method, path: pathname, status: response.status };
    try {
      deps.log(unexpected === undefined ? entry : { ...entry, error: unexpected.error });
    } catch {
      // 日志出了问题不能让一个本来成功的请求失败
    }
    return response;
  };
}
```
:::

:::files{role=tests}
```ts file=with-error-handling.test.ts
import { describe, expect, test, vi } from 'vitest';
import { NotFoundError, ValidationError } from './errors';
import { withErrorHandling, type Deps, type LogEntry } from './with-error-handling';

function setup() {
  const entries: LogEntry[] = [];
  let n = 0;
  const deps: Deps = { newId: () => `req-${++n}`, log: (entry) => entries.push(entry) };
  return { deps, entries };
}

const get = (path: string) => new Request(`https://app.example${path}`);

/** 模拟 Next.js 的 redirect() 和 notFound() 抛出的东西（实测的 digest） */
const redirectError = () => Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/login;307;' });
const notFoundError = () => Object.assign(new Error('NEXT_HTTP_ERROR_FALLBACK;404'), { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' });

describe('withErrorHandling', () => {
  test('成功：响应原样返回，加上 X-Request-Id，记录一条日志', async () => {
    const { deps, entries } = setup();
    const handler = withErrorHandling(async () => Response.json({ ok: true }, { status: 201, headers: { 'Set-Cookie': 'a=1' } }), deps);
    const response = await handler(get('/api/todos'), {});
    expect(response.status).toBe(201);
    expect(await response.json()).toStrictEqual({ ok: true });
    expect(response.headers.get('x-request-id')).toBe('req-1');
    expect(response.headers.get('content-type')).toMatch(/^application\/json/);
    expect(entries).toStrictEqual([{ requestId: 'req-1', method: 'GET', path: '/api/todos', status: 201 }]);
  });

  test('每个请求一个新的 id；context 原样交给 handler', async () => {
    const { deps } = setup();
    const inner = vi.fn(async (_request: Request, context: { params: Promise<{ id: string }> }) => Response.json(await context.params));
    const handler = withErrorHandling(inner, deps);
    const context = { params: Promise.resolve({ id: 'p1' }) };
    const first = await handler(get('/api/projects/p1'), context);
    const second = await handler(get('/api/projects/p1'), context);
    expect([first.headers.get('x-request-id'), second.headers.get('x-request-id')]).toStrictEqual(['req-1', 'req-2']);
    expect(inner.mock.calls[0]?.[1]).toBe(context);
    expect(await first.json()).toStrictEqual({ id: 'p1' });
  });

  test('预期的错误：变成对应的 JSON 响应，日志中没有 error', async () => {
    const { deps, entries } = setup();
    const handler = withErrorHandling(async (request: Request) => {
      if (request.method === 'POST') throw new ValidationError({ title: '请填写标题' });
      throw new NotFoundError('找不到这个项目');
    }, deps);
    const invalid = await handler(new Request('https://app.example/api/todos', { method: 'POST' }), {});
    expect(invalid.status).toBe(422);
    expect(await invalid.json()).toStrictEqual({ error: '输入有误', requestId: 'req-1', fields: { title: '请填写标题' } });
    const missing = await handler(get('/api/projects/p9'), {});
    expect(missing.status).toBe(404);
    expect(entries).toStrictEqual([
      { requestId: 'req-1', method: 'POST', path: '/api/todos', status: 422 },
      { requestId: 'req-2', method: 'GET', path: '/api/projects/p9', status: 404 },
    ]);
  });

  test('未预期的错误：500，响应中没有细节，日志中有原来的 error', async () => {
    const { deps, entries } = setup();
    const error = new Error('连接失败：密码 hunter2');
    const handler = withErrorHandling(async () => {
      throw error;
    }, deps);
    const response = await handler(get('/api/report'), {});
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('hunter2');
    expect(response.headers.get('x-request-id')).toBe('req-1');
    expect(entries).toStrictEqual([{ requestId: 'req-1', method: 'GET', path: '/api/report', status: 500, error }]);
  });

  test('handler 自己返回的 5xx：照样记录，没有 error', async () => {
    const { deps, entries } = setup();
    const handler = withErrorHandling(async () => new Response('上游不可用', { status: 503 }), deps);
    expect((await handler(get('/api/health'), {})).status).toBe(503);
    expect(entries).toStrictEqual([{ requestId: 'req-1', method: 'GET', path: '/api/health', status: 503 }]);
  });

  test('redirect()、notFound() 的控制流原样抛出，交给 Next.js 处理', async () => {
    const { deps, entries } = setup();
    for (const make of [redirectError, notFoundError]) {
      const thrown = make();
      const handler = withErrorHandling(async () => {
        throw thrown;
      }, deps);
      let caught: unknown;
      try {
        await handler(get('/api/me'), {});
      } catch (error) {
        caught = error;
      }
      expect(caught).toBe(thrown);
    }
    expect(entries).toStrictEqual([]);
  });

  test('只看 digest 的前缀：别的错误即使有 digest 也是普通的错误', async () => {
    const { deps } = setup();
    const handler = withErrorHandling(async () => {
      throw Object.assign(new Error('x'), { digest: 'MY_REDIRECT' });
    }, deps);
    expect((await handler(get('/api/x'), {})).status).toBe(500);
  });

  test('Response.redirect 的响应头不能修改：也要能加上 X-Request-Id', async () => {
    const { deps } = setup();
    const handler = withErrorHandling(async () => Response.redirect('https://app.example/login', 303), deps);
    const response = await handler(get('/api/logout'), {});
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://app.example/login');
    expect(response.headers.get('x-request-id')).toBe('req-1');
  });

  test('日志中的 path 不含查询字符串（里面可能有令牌）', async () => {
    const { deps, entries } = setup();
    const handler = withErrorHandling(async () => new Response(null, { status: 204 }), deps);
    await handler(get('/api/callback?token=secret&state=1'), {});
    expect(entries[0]?.path).toBe('/api/callback');
  });

  test('日志函数出错不影响响应', async () => {
    const deps: Deps = {
      newId: () => 'req-1',
      log: () => {
        throw new Error('日志服务不可用');
      },
    };
    const handler = withErrorHandling(async () => Response.json({ ok: true }), deps);
    const response = await handler(get('/api/todos'), {});
    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({ ok: true });
  });
});
```
:::

:::hint{level=1}
返回一个 `async (request, context) => { … }`：第一行生成 `requestId`，然后在 `try` 中 `await handler(request, context)`。`catch` 中先判断 `isControlFlow(error)`，是就 `throw error`。最后统一记录日志、返回响应。
:::

:::hint{level=2}
加响应头：`const headers = new Headers(response.headers); headers.set('X-Request-Id', requestId);`，再 `new Response(response.body, { status: response.status, statusText: response.statusText, headers })`。`isControlFlow` 中用 `'digest' in error` 收窄之后，`error.digest` 的类型是 `unknown`，还要判断它是字符串。
:::

:::explanation
包装函数（高阶函数，b10）把每个接口都要做的事集中在一个地方：生成请求的 id、把错误变成响应、记录日志。具体的 handler 只需要写正常的流程，遇到问题就抛出一个预期的错误。

最容易出错的是 Next.js 的控制流。`redirect()` 和 `notFound()` 不是返回一个值，而是**抛出**一个带 `digest` 的错误，由 Next.js 在外面接住、变成跳转或者 404。一个“接住所有错误”的 `catch` 会把它们也变成 500：正文中实测，在 `try` 中调用 `redirect()` 的 Route Handler 返回了 500。真实的项目中用 `next/navigation` 的 `unstable_rethrow(error)`，它认识 Next.js 所有这样的控制流；这里只模拟实测的两种。

日志是给开发者看的，但它同样会被保存、被很多人看到：查询字符串中可能有登录的令牌，所以只记录路径；4xx 是用户的问题，不需要 `error`；5xx 才是程序的问题，要有完整的 `error` 才能查。`requestId` 同时出现在响应头、响应体和日志中，用户报告“请求 req-42 失败了”，开发者就能找到对应的那一条日志，这和 Next.js 给页面错误的 `digest` 是同一个思路。

替代解用 `promise.then(onFulfilled, onRejected)` 把成功和失败分成两个回调，构造新的响应时直接把原来的响应作为初始化参数。
:::

:::variant{kind=alt name=then-callbacks}
```ts file=with-error-handling.ts
import { toErrorResponse } from './responses';

export type Handler<C> = (request: Request, context: C) => Promise<Response>;

export type LogEntry = Readonly<{ requestId: string; method: string; path: string; status: number; error?: unknown }>;

export type Deps = Readonly<{ newId: () => string; log: (entry: LogEntry) => void }>;

/** redirect()、notFound() 抛出的“错误”是 Next.js 的控制流：digest 以这些前缀开头，必须原样抛出 */
export function isControlFlow(error: unknown): boolean {
  const digest: unknown = typeof error === 'object' && error !== null ? Reflect.get(error, 'digest') : undefined;
  return typeof digest === 'string' && /^(NEXT_REDIRECT|NEXT_HTTP_ERROR_FALLBACK)/.test(digest);
}

type Outcome = { response: Response; error?: unknown };

/** 包装一个 Route Handler：每个请求一个 id，错误变成 JSON 响应，每个请求记录一条日志 */
export function withErrorHandling<C>(handler: Handler<C>, deps: Deps): Handler<C> {
  return async (request, context) => {
    const requestId = deps.newId();
    const outcome: Outcome = await handler(request, context).then(
      (response): Outcome => {
        // 不在原来的响应上修改：用它的内容和状态构造一个新的响应
        const copy = new Response(response.body, response);
        copy.headers.set('X-Request-Id', requestId);
        return { response: copy };
      },
      (error: unknown): Outcome => {
        if (isControlFlow(error)) throw error;
        const response = toErrorResponse(error, requestId);
        return response.status >= 500 ? { response, error } : { response };
      },
    );
    const entry: LogEntry = { requestId, method: request.method, path: new URL(request.url).pathname, status: outcome.response.status };
    try {
      deps.log('error' in outcome ? { ...entry, error: outcome.error } : entry);
    } catch {
      // 日志出了问题不能让一个本来成功的请求失败
    }
    return outcome.response;
  };
}
```
:::

:::variant{kind=wrong name=swallow-control-flow fails=tests reason="吞掉了 redirect() 和 notFound()：本来的跳转和 404 变成了 500（正文中实测）"}
```ts file=with-error-handling.ts
import { toErrorResponse } from './responses';

export type Handler<C> = (request: Request, context: C) => Promise<Response>;

export type LogEntry = Readonly<{ requestId: string; method: string; path: string; status: number; error?: unknown }>;

export type Deps = Readonly<{ newId: () => string; log: (entry: LogEntry) => void }>;

/** redirect()、notFound() 抛出的“错误”是 Next.js 的控制流：digest 以这些前缀开头，必须原样抛出 */
const CONTROL_FLOW = ['NEXT_REDIRECT', 'NEXT_HTTP_ERROR_FALLBACK'];

export function isControlFlow(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('digest' in error)) return false;
  const { digest } = error;
  return typeof digest === 'string' && CONTROL_FLOW.some((prefix) => digest.startsWith(prefix));
}

/** 给响应加上 X-Request-Id：有的响应（例如 Response.redirect）的头不能修改，所以复制一份 */
function withRequestId(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Request-Id', requestId);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** 包装一个 Route Handler：每个请求一个 id，错误变成 JSON 响应，每个请求记录一条日志 */
export function withErrorHandling<C>(handler: Handler<C>, deps: Deps): Handler<C> {
  return async (request, context) => {
    const requestId = deps.newId();
    const { pathname } = new URL(request.url);
    let response: Response;
    let unexpected: { error: unknown } | undefined;
    try {
      response = withRequestId(await handler(request, context), requestId);
    } catch (error) {
      response = toErrorResponse(error, requestId);
      if (response.status >= 500) unexpected = { error };
    }
    const entry: LogEntry = { requestId, method: request.method, path: pathname, status: response.status };
    try {
      deps.log(unexpected === undefined ? entry : { ...entry, error: unexpected.error });
    } catch {
      // 日志出了问题不能让一个本来成功的请求失败
    }
    return response;
  };
}
```
:::

:::variant{kind=wrong name=mutate-headers fails=tests reason="直接修改 handler 返回的响应的头：Response.redirect 的头是不能修改的，跳转变成了 500"}
```ts file=with-error-handling.ts
import { toErrorResponse } from './responses';

export type Handler<C> = (request: Request, context: C) => Promise<Response>;

export type LogEntry = Readonly<{ requestId: string; method: string; path: string; status: number; error?: unknown }>;

export type Deps = Readonly<{ newId: () => string; log: (entry: LogEntry) => void }>;

/** redirect()、notFound() 抛出的“错误”是 Next.js 的控制流：digest 以这些前缀开头，必须原样抛出 */
const CONTROL_FLOW = ['NEXT_REDIRECT', 'NEXT_HTTP_ERROR_FALLBACK'];

export function isControlFlow(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('digest' in error)) return false;
  const { digest } = error;
  return typeof digest === 'string' && CONTROL_FLOW.some((prefix) => digest.startsWith(prefix));
}

/** 给响应加上 X-Request-Id：有的响应（例如 Response.redirect）的头不能修改，所以复制一份 */
function withRequestId(response: Response, requestId: string): Response {
  response.headers.set('X-Request-Id', requestId);
  return response;
}

/** 包装一个 Route Handler：每个请求一个 id，错误变成 JSON 响应，每个请求记录一条日志 */
export function withErrorHandling<C>(handler: Handler<C>, deps: Deps): Handler<C> {
  return async (request, context) => {
    const requestId = deps.newId();
    const { pathname } = new URL(request.url);
    let response: Response;
    let unexpected: { error: unknown } | undefined;
    try {
      response = withRequestId(await handler(request, context), requestId);
    } catch (error) {
      if (isControlFlow(error)) throw error;
      response = toErrorResponse(error, requestId);
      if (response.status >= 500) unexpected = { error };
    }
    const entry: LogEntry = { requestId, method: request.method, path: pathname, status: response.status };
    try {
      deps.log(unexpected === undefined ? entry : { ...entry, error: unexpected.error });
    } catch {
      // 日志出了问题不能让一个本来成功的请求失败
    }
    return response;
  };
}
```
:::

:::variant{kind=wrong name=id-per-wrapper fails=tests reason="在包装的时候生成 id：所有的请求共用同一个 id，日志就对不上了"}
```ts file=with-error-handling.ts
import { toErrorResponse } from './responses';

export type Handler<C> = (request: Request, context: C) => Promise<Response>;

export type LogEntry = Readonly<{ requestId: string; method: string; path: string; status: number; error?: unknown }>;

export type Deps = Readonly<{ newId: () => string; log: (entry: LogEntry) => void }>;

/** redirect()、notFound() 抛出的“错误”是 Next.js 的控制流：digest 以这些前缀开头，必须原样抛出 */
const CONTROL_FLOW = ['NEXT_REDIRECT', 'NEXT_HTTP_ERROR_FALLBACK'];

export function isControlFlow(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('digest' in error)) return false;
  const { digest } = error;
  return typeof digest === 'string' && CONTROL_FLOW.some((prefix) => digest.startsWith(prefix));
}

/** 给响应加上 X-Request-Id：有的响应（例如 Response.redirect）的头不能修改，所以复制一份 */
function withRequestId(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Request-Id', requestId);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** 包装一个 Route Handler：每个请求一个 id，错误变成 JSON 响应，每个请求记录一条日志 */
export function withErrorHandling<C>(handler: Handler<C>, deps: Deps): Handler<C> {
  const requestId = deps.newId();
  return async (request, context) => {
    const { pathname } = new URL(request.url);
    let response: Response;
    let unexpected: { error: unknown } | undefined;
    try {
      response = withRequestId(await handler(request, context), requestId);
    } catch (error) {
      if (isControlFlow(error)) throw error;
      response = toErrorResponse(error, requestId);
      if (response.status >= 500) unexpected = { error };
    }
    const entry: LogEntry = { requestId, method: request.method, path: pathname, status: response.status };
    try {
      deps.log(unexpected === undefined ? entry : { ...entry, error: unexpected.error });
    } catch {
      // 日志出了问题不能让一个本来成功的请求失败
    }
    return response;
  };
}
```
:::

:::variant{kind=wrong name=log-error-always fails=tests reason="预期的错误也把 error 写进日志：4xx 的日志被当成了程序错误，真正的问题被淹没"}
```ts file=with-error-handling.ts
import { toErrorResponse } from './responses';

export type Handler<C> = (request: Request, context: C) => Promise<Response>;

export type LogEntry = Readonly<{ requestId: string; method: string; path: string; status: number; error?: unknown }>;

export type Deps = Readonly<{ newId: () => string; log: (entry: LogEntry) => void }>;

/** redirect()、notFound() 抛出的“错误”是 Next.js 的控制流：digest 以这些前缀开头，必须原样抛出 */
const CONTROL_FLOW = ['NEXT_REDIRECT', 'NEXT_HTTP_ERROR_FALLBACK'];

export function isControlFlow(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('digest' in error)) return false;
  const { digest } = error;
  return typeof digest === 'string' && CONTROL_FLOW.some((prefix) => digest.startsWith(prefix));
}

/** 给响应加上 X-Request-Id：有的响应（例如 Response.redirect）的头不能修改，所以复制一份 */
function withRequestId(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Request-Id', requestId);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** 包装一个 Route Handler：每个请求一个 id，错误变成 JSON 响应，每个请求记录一条日志 */
export function withErrorHandling<C>(handler: Handler<C>, deps: Deps): Handler<C> {
  return async (request, context) => {
    const requestId = deps.newId();
    const { pathname } = new URL(request.url);
    let response: Response;
    let unexpected: { error: unknown } | undefined;
    try {
      response = withRequestId(await handler(request, context), requestId);
    } catch (error) {
      if (isControlFlow(error)) throw error;
      response = toErrorResponse(error, requestId);
      unexpected = { error };
    }
    const entry: LogEntry = { requestId, method: request.method, path: pathname, status: response.status };
    try {
      deps.log(unexpected === undefined ? entry : { ...entry, error: unexpected.error });
    } catch {
      // 日志出了问题不能让一个本来成功的请求失败
    }
    return response;
  };
}
```
:::

:::variant{kind=wrong name=log-full-url fails=tests reason="日志中记录了完整的地址：查询字符串中的令牌被写进了日志"}
```ts file=with-error-handling.ts
import { toErrorResponse } from './responses';

export type Handler<C> = (request: Request, context: C) => Promise<Response>;

export type LogEntry = Readonly<{ requestId: string; method: string; path: string; status: number; error?: unknown }>;

export type Deps = Readonly<{ newId: () => string; log: (entry: LogEntry) => void }>;

/** redirect()、notFound() 抛出的“错误”是 Next.js 的控制流：digest 以这些前缀开头，必须原样抛出 */
const CONTROL_FLOW = ['NEXT_REDIRECT', 'NEXT_HTTP_ERROR_FALLBACK'];

export function isControlFlow(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('digest' in error)) return false;
  const { digest } = error;
  return typeof digest === 'string' && CONTROL_FLOW.some((prefix) => digest.startsWith(prefix));
}

/** 给响应加上 X-Request-Id：有的响应（例如 Response.redirect）的头不能修改，所以复制一份 */
function withRequestId(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Request-Id', requestId);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** 包装一个 Route Handler：每个请求一个 id，错误变成 JSON 响应，每个请求记录一条日志 */
export function withErrorHandling<C>(handler: Handler<C>, deps: Deps): Handler<C> {
  return async (request, context) => {
    const requestId = deps.newId();
    const pathname = request.url;
    let response: Response;
    let unexpected: { error: unknown } | undefined;
    try {
      response = withRequestId(await handler(request, context), requestId);
    } catch (error) {
      if (isControlFlow(error)) throw error;
      response = toErrorResponse(error, requestId);
      if (response.status >= 500) unexpected = { error };
    }
    const entry: LogEntry = { requestId, method: request.method, path: pathname, status: response.status };
    try {
      deps.log(unexpected === undefined ? entry : { ...entry, error: unexpected.error });
    } catch {
      // 日志出了问题不能让一个本来成功的请求失败
    }
    return response;
  };
}
```
:::

:::variant{kind=wrong name=log-can-break fails=tests reason="日志函数出错时整个请求失败：日志服务的问题变成了所有接口的问题"}
```ts file=with-error-handling.ts
import { toErrorResponse } from './responses';

export type Handler<C> = (request: Request, context: C) => Promise<Response>;

export type LogEntry = Readonly<{ requestId: string; method: string; path: string; status: number; error?: unknown }>;

export type Deps = Readonly<{ newId: () => string; log: (entry: LogEntry) => void }>;

/** redirect()、notFound() 抛出的“错误”是 Next.js 的控制流：digest 以这些前缀开头，必须原样抛出 */
const CONTROL_FLOW = ['NEXT_REDIRECT', 'NEXT_HTTP_ERROR_FALLBACK'];

export function isControlFlow(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('digest' in error)) return false;
  const { digest } = error;
  return typeof digest === 'string' && CONTROL_FLOW.some((prefix) => digest.startsWith(prefix));
}

/** 给响应加上 X-Request-Id：有的响应（例如 Response.redirect）的头不能修改，所以复制一份 */
function withRequestId(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Request-Id', requestId);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** 包装一个 Route Handler：每个请求一个 id，错误变成 JSON 响应，每个请求记录一条日志 */
export function withErrorHandling<C>(handler: Handler<C>, deps: Deps): Handler<C> {
  return async (request, context) => {
    const requestId = deps.newId();
    const { pathname } = new URL(request.url);
    let response: Response;
    let unexpected: { error: unknown } | undefined;
    try {
      response = withRequestId(await handler(request, context), requestId);
    } catch (error) {
      if (isControlFlow(error)) throw error;
      response = toErrorResponse(error, requestId);
      if (response.status >= 500) unexpected = { error };
    }
    const entry: LogEntry = { requestId, method: request.method, path: pathname, status: response.status };
    deps.log(unexpected === undefined ? entry : { ...entry, error: unexpected.error });
    return response;
  };
}
```
:::

