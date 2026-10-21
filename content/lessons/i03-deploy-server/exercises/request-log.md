---
kind: task
title: 每个请求一行日志
---
在 `request.ts` 中实现 `withRequestLog(handler, deps)`：返回一个新的处理函数，它调用 `handler`，并为每个请求写**一行**日志（用只读的 `log.ts` 中的 `formatLog`，`time` 是 `deps.time()`，`secrets` 是 `deps.secrets`，写出用 `deps.write`）。

1. **请求的 id**：请求头 `x-request-id` 只由字母、数字和 `-` 组成、长度是 8 到 64 时，沿用它；否则用 `deps.newId()`；
2. **调用 `handler`**。它抛出错误时，响应是 500，响应体是 `{ "error": "服务器内部错误", "requestId": "…" }`；
3. **日志**：`message` 是 `方法 路径 状态码`，例如 `GET /api/projects 200`；`fields` 是 `requestId`、`method`、`path`、`status`、`durationMs`，`handler` 抛出了错误时再加上 `error`（错误本身，`formatLog` 会处理它）。`path` 只是路径，不包括查询参数。`durationMs` 是调用 `handler` 前后两次 `deps.clock()` 的差，四舍五入成整数（在调用之前读一次，写日志之前读一次）。级别：抛出了错误或者状态码 ≥ 500 是 `'error'`，≥ 400 是 `'warn'`，否则是 `'info'`；
4. **响应**：在响应上加上响应头 `x-request-id`。有的响应的响应头是不可修改的（例如 `Response.redirect` 返回的），所以要先复制一份：`new Response(response.body, response)`。

:::files{role=support}
```ts file=log.ts readonly
export type Level = 'debug' | 'info' | 'warn' | 'error';

export type LogEntry = Readonly<{ level: Level; message: string; fields?: Readonly<Record<string, unknown>> }>;

export type LogOptions = Readonly<{
  /** 记录的时间，ISO 格式 */
  time: string;
  /** 不能出现在日志中的值，例如数据库的密码、API 密钥 */
  secrets: readonly string[];
}>;

const REDACTED = '[REDACTED]';
const SENSITIVE = ['password', 'secret', 'token', 'authorization', 'cookie', 'apikey', 'api_key'];
const RESERVED = new Set(['time', 'level', 'message']);
const MAX_LENGTH = 500;

const isSensitive = (key: string) => SENSITIVE.some((word) => key.toLowerCase().includes(word));

/** 把一条日志变成一行 JSON：去掉密钥，截断太长的字符串，不会抛出错误 */
export function formatLog(entry: LogEntry, options: LogOptions): string {
  // 先替换长的：一个密钥包含另一个时，不会只替换掉一半
  const hidden = options.secrets.filter((secret) => secret.length >= 8).toSorted((a, b) => b.length - a.length);

  const scrub = (text: string): string => {
    let result = text;
    for (const secret of hidden) result = result.replaceAll(secret, REDACTED);
    // 先替换密钥再截断：截断的地方正好落在密钥中间时，也不会漏出一半
    const chars = [...result];
    return chars.length > MAX_LENGTH ? `${chars.slice(0, MAX_LENGTH).join('')}…（共 ${chars.length} 个字符）` : result;
  };

  // 正在处理的对象（从根到当前的路径上的）：再遇到它就是循环引用
  const ancestors = new Set<object>();

  const clean = (value: unknown): unknown => {
    if (typeof value === 'string') return scrub(value);
    if (typeof value === 'bigint') return value.toString();
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value !== 'object') return undefined; // undefined、函数、symbol：和 JSON.stringify 一样去掉
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
    if (ancestors.has(value)) return '[Circular]';
    ancestors.add(value);
    try {
      if (value instanceof Error) {
        const error: [string, unknown][] = [
          ['name', scrub(value.name)],
          ['message', scrub(value.message)],
        ];
        if (value.cause !== undefined) error.push(['cause', clean(value.cause)]);
        return Object.fromEntries(error);
      }
      if (Array.isArray(value)) return value.map((item) => clean(item) ?? null);
      return Object.fromEntries(cleanEntries(Object.entries(value)));
    } finally {
      ancestors.delete(value);
    }
  };

  const cleanEntries = (entries: [string, unknown][]): [string, unknown][] =>
    entries.flatMap(([key, value]): [string, unknown][] => {
      if (isSensitive(key)) return [[key, REDACTED]];
      const cleaned = clean(value);
      return cleaned === undefined ? [] : [[key, cleaned]];
    });

  const fields = Object.entries(entry.fields ?? {}).filter(([key]) => !RESERVED.has(key));
  // Object.fromEntries 定义字段：名为 __proto__ 的字段也只是一个普通的字段（p3-01）
  const line = Object.fromEntries<unknown>([['time', options.time], ['level', entry.level], ['message', scrub(entry.message)], ...cleanEntries(fields)]);
  return JSON.stringify(line);
}
```
:::

:::files{role=starter}
```ts file=request.ts
import { formatLog, type Level } from './log';

export type Handler = (request: Request) => Promise<Response>;

export type RequestLogDeps = Readonly<{
  /** 毫秒，只用来计算花了多长时间（例如 performance.now） */
  clock: () => number;
  /** 记录的时间，ISO 格式 */
  time: () => string;
  newId: () => string;
  /** 写出一行日志（例如 console.log） */
  write: (line: string) => void;
  secrets: readonly string[];
}>;

/** 包住一个处理函数：每个请求写一行日志，响应带上 x-request-id；处理函数抛出错误时返回 500 */
export function withRequestLog(handler: Handler, deps: RequestLogDeps): Handler {
  // TODO
  return handler;
}
```
```ts file=main.ts readonly
import { withRequestLog } from './request';

const SECRET = 'sk-live-0123456789abcdef';
let ids = 0;
const handler = withRequestLog(
  async (request) => {
    if (request.url.includes('boom')) throw new Error(`upstream rejected key ${SECRET}`);
    return Response.json({ ok: true });
  },
  {
    clock: () => performance.now(),
    time: () => new Date().toISOString(),
    newId: () => `req-${String(++ids).padStart(6, '0')}`,
    write: (line) => console.log(line),
    secrets: [SECRET],
  },
);

for (const url of ['https://projects.example/api/projects?token=abc', 'https://projects.example/api/boom']) {
  const response = await handler(new Request(url));
  console.log('→', response.status, response.headers.get('x-request-id'), await response.text());
}
```
:::

:::files{role=solution}
```ts file=request.ts
import { formatLog, type Level } from './log';

export type Handler = (request: Request) => Promise<Response>;

export type RequestLogDeps = Readonly<{
  /** 毫秒，只用来计算花了多长时间（例如 performance.now） */
  clock: () => number;
  /** 记录的时间，ISO 格式 */
  time: () => string;
  newId: () => string;
  /** 写出一行日志（例如 console.log） */
  write: (line: string) => void;
  secrets: readonly string[];
}>;

const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

/** 包住一个处理函数：每个请求写一行日志，响应带上 x-request-id；处理函数抛出错误时返回 500 */
export function withRequestLog(handler: Handler, deps: RequestLogDeps): Handler {
  return async (request) => {
    const start = deps.clock();
    // 上游（例如负载均衡）给的 id 格式对就沿用，这样两边的日志能对上；否则自己生成一个
    const incoming = request.headers.get('x-request-id');
    const requestId = incoming !== null && REQUEST_ID.test(incoming) ? incoming : deps.newId();
    // 查询参数中可能有令牌之类的东西：只记录路径
    const path = new URL(request.url).pathname;

    let response: Response;
    let failure: unknown;
    try {
      response = await handler(request);
    } catch (error) {
      failure = error;
      response = Response.json({ error: '服务器内部错误', requestId }, { status: 500 });
    }

    const status = response.status;
    const level: Level = failure !== undefined || status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    const fields: Record<string, unknown> = { requestId, method: request.method, path, status, durationMs: Math.round(deps.clock() - start) };
    if (failure !== undefined) fields['error'] = failure;
    deps.write(formatLog({ level, message: `${request.method} ${path} ${status}`, fields }, { time: deps.time(), secrets: deps.secrets }));

    // 有的响应的请求头是不可修改的（例如 Response.redirect）：复制一份再加上
    const result = new Response(response.body, response);
    result.headers.set('x-request-id', requestId);
    return result;
  };
}
```
```ts file=main.ts readonly
import { withRequestLog } from './request';

const SECRET = 'sk-live-0123456789abcdef';
let ids = 0;
const handler = withRequestLog(
  async (request) => {
    if (request.url.includes('boom')) throw new Error(`upstream rejected key ${SECRET}`);
    return Response.json({ ok: true });
  },
  {
    clock: () => performance.now(),
    time: () => new Date().toISOString(),
    newId: () => `req-${String(++ids).padStart(6, '0')}`,
    write: (line) => console.log(line),
    secrets: [SECRET],
  },
);

for (const url of ['https://projects.example/api/projects?token=abc', 'https://projects.example/api/boom']) {
  const response = await handler(new Request(url));
  console.log('→', response.status, response.headers.get('x-request-id'), await response.text());
}
```
:::

:::files{role=tests}
```ts file=request.test.ts
import { describe, expect, test } from 'vitest';
import { withRequestLog, type Handler, type RequestLogDeps } from './request';

const SECRET = 'sk-live-0123456789abcdef';

function setup(handler: Handler) {
  const lines: string[] = [];
  let now = 1000;
  let ids = 0;
  const deps: RequestLogDeps = {
    // 每次读取时间都过去 7.4 毫秒
    clock: () => (now += 7.4),
    time: () => '2026-10-21T10:00:00.000Z',
    newId: () => `req-${String(++ids).padStart(6, '0')}`,
    write: (line) => lines.push(line),
    secrets: [SECRET],
  };
  const logs = (): unknown[] => lines.map((line) => JSON.parse(line));
  return { wrapped: withRequestLog(handler, deps), lines, logs };
}

const ok: Handler = async () => Response.json({ ok: true });

describe('withRequestLog', () => {
  test('每个请求一行日志：方法、路径、状态码、花的时间', async () => {
    const { wrapped, lines, logs } = setup(ok);
    const response = await wrapped(new Request('https://projects.example/api/projects?token=abc&page=2'));
    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({ ok: true });
    expect(lines).toHaveLength(1);
    expect(logs()[0]).toStrictEqual({
      time: '2026-10-21T10:00:00.000Z',
      level: 'info',
      message: 'GET /api/projects 200',
      requestId: 'req-000001',
      method: 'GET',
      path: '/api/projects',
      status: 200,
      durationMs: 7,
    });
  });

  test('查询参数不进日志', async () => {
    const { wrapped, lines } = setup(ok);
    await wrapped(new Request('https://projects.example/api/sync?token=abc'));
    expect(lines.join('').includes('token=abc')).toBe(false);
  });

  test('响应带上 x-request-id；请求中带着格式正确的 id 时沿用它', async () => {
    const { wrapped, logs } = setup(ok);
    expect((await wrapped(new Request('https://projects.example/a'))).headers.get('x-request-id')).toBe('req-000001');
    const given = await wrapped(new Request('https://projects.example/b', { headers: { 'x-request-id': 'lb-12345678' } }));
    expect(given.headers.get('x-request-id')).toBe('lb-12345678');
    expect(logs()[1]).toMatchObject({ requestId: 'lb-12345678' });
  });

  test('格式不对的 id 不沿用：太短、太长、有别的字符（可能是想往日志里注入内容）', async () => {
    const { wrapped } = setup(ok);
    for (const id of ['short', 'x'.repeat(65), 'abc"def}ghij', '12345678\nlevel=error']) {
      const response = await wrapped(new Request('https://projects.example/', { headers: { 'x-request-id': id.replaceAll('\n', ' ') } }));
      expect(response.headers.get('x-request-id'), id).toMatch(/^req-\d{6}$/);
    }
  });

  test('4xx 是 warn，5xx 是 error', async () => {
    const { wrapped, logs } = setup(async (request) => Response.json({}, { status: request.url.endsWith('/missing') ? 404 : 503 }));
    await wrapped(new Request('https://projects.example/missing'));
    await wrapped(new Request('https://projects.example/busy', { method: 'POST' }));
    expect(logs()).toMatchObject([
      { level: 'warn', message: 'GET /missing 404', status: 404 },
      { level: 'error', message: 'POST /busy 503', status: 503 },
    ]);
  });

  test('处理函数抛出错误：返回 500 和 requestId；日志中有错误，但没有密钥', async () => {
    const { wrapped, logs, lines } = setup(async () => {
      throw new Error(`database refused: ${SECRET}`);
    });
    const response = await wrapped(new Request('https://projects.example/api/projects', { method: 'PATCH' }));
    expect(response.status).toBe(500);
    expect(response.headers.get('x-request-id')).toBe('req-000001');
    expect(await response.json()).toStrictEqual({ error: '服务器内部错误', requestId: 'req-000001' });
    expect(logs()[0]).toMatchObject({ level: 'error', status: 500, error: { name: 'Error', message: 'database refused: [REDACTED]' } });
    expect(lines[0]?.includes(SECRET)).toBe(false);
  });

  test('响应头不可修改时（Response.redirect）也能加上 x-request-id', async () => {
    const { wrapped } = setup(async () => Response.redirect('https://projects.example/login', 307));
    const response = await wrapped(new Request('https://projects.example/'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://projects.example/login');
    expect(response.headers.get('x-request-id')).toBe('req-000001');
  });
});
```
:::

:::hint{level=1}
返回的是一个 `async (request) => { … }`。`handler` 的调用放在 `try` 中：成功时拿到它的响应，失败时记下错误，自己造一个 500 的响应。之后两种情况走同一段代码：写日志、加响应头。
:::

:::hint{level=2}
路径：`new URL(request.url).pathname`。id 的格式：`/^[A-Za-z0-9-]{8,64}$/`。级别可以用一个条件表达式：`failure !== undefined || status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'`。
:::

:::explanation
这个包装函数把“每个接口都要做的事”集中到一个地方：处理函数（p3-02 的 `addTask`、`patchProject`）不需要知道日志的存在，也不会忘记写日志。

请求的 id 让一次请求在各处留下的痕迹能对上：响应头中的、500 的响应体中的、日志中的是同一个。前面还有一层（负载均衡、反向代理）时，它可能已经给了请求一个 id，沿用它，两边的日志就能对上。但这个请求头来自外部，任何人都可以写任何东西，所以只接受格式简单的 id：否则别人可以往日志中写入换行、引号，伪造出一条看起来是别的内容的日志（日志注入）。

捕获处理函数抛出的错误，而不是让它传到框架：正文中实测，让 Next.js 处理时客户端收到一个空的 500，日志中是原样的错误信息（带着密码）。在这里捕获，日志经过了 `formatLog` 的处理，客户端也拿到了可以报告的 `requestId`。

复制响应是因为 `Response` 的响应头有时不可修改：`Response.redirect()`、`fetch()` 返回的响应都是这样，直接 `headers.set` 会抛出 `TypeError`。

替代解用 `handler(request).then(成功, 失败)` 把两种结果变成同一种形状，级别写成一个小函数，复制响应时用 `new Headers(response.headers)` 构造新的响应头。
:::

:::variant{kind=alt name=then-outcome}
```ts file=request.ts
import { formatLog, type Level } from './log';

export type Handler = (request: Request) => Promise<Response>;

export type RequestLogDeps = Readonly<{
  clock: () => number;
  time: () => string;
  newId: () => string;
  write: (line: string) => void;
  secrets: readonly string[];
}>;

function levelFor(status: number): Level {
  if (status >= 500) return 'error';
  if (status >= 400) return 'warn';
  return 'info';
}

/** 复制一个响应，换上新的响应头（原来的响应头可能是不可修改的） */
function withHeader(response: Response, name: string, value: string): Response {
  const headers = new Headers(response.headers);
  headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function withRequestLog(handler: Handler, deps: RequestLogDeps): Handler {
  return async (request) => {
    const started = deps.clock();
    const given = request.headers.get('x-request-id') ?? '';
    const requestId = /^[A-Za-z0-9-]{8,64}$/.test(given) ? given : deps.newId();
    const { pathname } = new URL(request.url);

    const outcome = await handler(request).then(
      (response) => ({ response, error: undefined }),
      (error: unknown) => ({ response: Response.json({ error: '服务器内部错误', requestId }, { status: 500 }), error }),
    );
    const { status } = outcome.response;
    const fields: Record<string, unknown> = {
      requestId,
      method: request.method,
      path: pathname,
      status,
      durationMs: Math.round(deps.clock() - started),
      ...(outcome.error === undefined ? {} : { error: outcome.error }),
    };
    const level = outcome.error === undefined ? levelFor(status) : 'error';
    deps.write(formatLog({ level, message: `${request.method} ${pathname} ${status}`, fields }, { time: deps.time(), secrets: deps.secrets }));
    return withHeader(outcome.response, 'x-request-id', requestId);
  };
}
```
:::

:::variant{kind=wrong name=query-logged fails=tests reason="记录了查询参数：?token=… 这样的值进了日志"}
```ts file=request.ts
import { formatLog, type Level } from './log';

export type Handler = (request: Request) => Promise<Response>;

export type RequestLogDeps = Readonly<{
  /** 毫秒，只用来计算花了多长时间（例如 performance.now） */
  clock: () => number;
  /** 记录的时间，ISO 格式 */
  time: () => string;
  newId: () => string;
  /** 写出一行日志（例如 console.log） */
  write: (line: string) => void;
  secrets: readonly string[];
}>;

const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

/** 包住一个处理函数：每个请求写一行日志，响应带上 x-request-id；处理函数抛出错误时返回 500 */
export function withRequestLog(handler: Handler, deps: RequestLogDeps): Handler {
  return async (request) => {
    const start = deps.clock();
    // 上游（例如负载均衡）给的 id 格式对就沿用，这样两边的日志能对上；否则自己生成一个
    const incoming = request.headers.get('x-request-id');
    const requestId = incoming !== null && REQUEST_ID.test(incoming) ? incoming : deps.newId();
    // 查询参数中可能有令牌之类的东西：只记录路径
    const path = request.url.slice(request.url.indexOf('/', 8));

    let response: Response;
    let failure: unknown;
    try {
      response = await handler(request);
    } catch (error) {
      failure = error;
      response = Response.json({ error: '服务器内部错误', requestId }, { status: 500 });
    }

    const status = response.status;
    const level: Level = failure !== undefined || status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    const fields: Record<string, unknown> = { requestId, method: request.method, path, status, durationMs: Math.round(deps.clock() - start) };
    if (failure !== undefined) fields['error'] = failure;
    deps.write(formatLog({ level, message: `${request.method} ${path} ${status}`, fields }, { time: deps.time(), secrets: deps.secrets }));

    // 有的响应的请求头是不可修改的（例如 Response.redirect）：复制一份再加上
    const result = new Response(response.body, response);
    result.headers.set('x-request-id', requestId);
    return result;
  };
}
```
:::

:::variant{kind=wrong name=trust-any-id fails=tests reason="直接沿用请求中的任何 x-request-id：别人可以往日志中写入任意的内容"}
```ts file=request.ts
import { formatLog, type Level } from './log';

export type Handler = (request: Request) => Promise<Response>;

export type RequestLogDeps = Readonly<{
  /** 毫秒，只用来计算花了多长时间（例如 performance.now） */
  clock: () => number;
  /** 记录的时间，ISO 格式 */
  time: () => string;
  newId: () => string;
  /** 写出一行日志（例如 console.log） */
  write: (line: string) => void;
  secrets: readonly string[];
}>;

const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

/** 包住一个处理函数：每个请求写一行日志，响应带上 x-request-id；处理函数抛出错误时返回 500 */
export function withRequestLog(handler: Handler, deps: RequestLogDeps): Handler {
  return async (request) => {
    const start = deps.clock();
    // 上游（例如负载均衡）给的 id 格式对就沿用，这样两边的日志能对上；否则自己生成一个
    const incoming = request.headers.get('x-request-id');
    const requestId = incoming !== null && incoming !== '' ? incoming : deps.newId();
    // 查询参数中可能有令牌之类的东西：只记录路径
    const path = new URL(request.url).pathname;

    let response: Response;
    let failure: unknown;
    try {
      response = await handler(request);
    } catch (error) {
      failure = error;
      response = Response.json({ error: '服务器内部错误', requestId }, { status: 500 });
    }

    const status = response.status;
    const level: Level = failure !== undefined || status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    const fields: Record<string, unknown> = { requestId, method: request.method, path, status, durationMs: Math.round(deps.clock() - start) };
    if (failure !== undefined) fields['error'] = failure;
    deps.write(formatLog({ level, message: `${request.method} ${path} ${status}`, fields }, { time: deps.time(), secrets: deps.secrets }));

    // 有的响应的请求头是不可修改的（例如 Response.redirect）：复制一份再加上
    const result = new Response(response.body, response);
    result.headers.set('x-request-id', requestId);
    return result;
  };
}
```
:::

:::variant{kind=wrong name=mutate-headers fails=tests reason="直接修改原来的响应头：Response.redirect 的响应头不可修改，加 x-request-id 时抛出了错误"}
```ts file=request.ts
import { formatLog, type Level } from './log';

export type Handler = (request: Request) => Promise<Response>;

export type RequestLogDeps = Readonly<{
  /** 毫秒，只用来计算花了多长时间（例如 performance.now） */
  clock: () => number;
  /** 记录的时间，ISO 格式 */
  time: () => string;
  newId: () => string;
  /** 写出一行日志（例如 console.log） */
  write: (line: string) => void;
  secrets: readonly string[];
}>;

const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

/** 包住一个处理函数：每个请求写一行日志，响应带上 x-request-id；处理函数抛出错误时返回 500 */
export function withRequestLog(handler: Handler, deps: RequestLogDeps): Handler {
  return async (request) => {
    const start = deps.clock();
    // 上游（例如负载均衡）给的 id 格式对就沿用，这样两边的日志能对上；否则自己生成一个
    const incoming = request.headers.get('x-request-id');
    const requestId = incoming !== null && REQUEST_ID.test(incoming) ? incoming : deps.newId();
    // 查询参数中可能有令牌之类的东西：只记录路径
    const path = new URL(request.url).pathname;

    let response: Response;
    let failure: unknown;
    try {
      response = await handler(request);
    } catch (error) {
      failure = error;
      response = Response.json({ error: '服务器内部错误', requestId }, { status: 500 });
    }

    const status = response.status;
    const level: Level = failure !== undefined || status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    const fields: Record<string, unknown> = { requestId, method: request.method, path, status, durationMs: Math.round(deps.clock() - start) };
    if (failure !== undefined) fields['error'] = failure;
    deps.write(formatLog({ level, message: `${request.method} ${path} ${status}`, fields }, { time: deps.time(), secrets: deps.secrets }));

    // 有的响应的请求头是不可修改的（例如 Response.redirect）：复制一份再加上
    response.headers.set('x-request-id', requestId);
    return response;
  };
}
```
:::

:::variant{kind=wrong name=error-not-logged fails=tests reason="出错时没有记录错误本身：日志中只知道是 500，不知道为什么"}
```ts file=request.ts
import { formatLog, type Level } from './log';

export type Handler = (request: Request) => Promise<Response>;

export type RequestLogDeps = Readonly<{
  /** 毫秒，只用来计算花了多长时间（例如 performance.now） */
  clock: () => number;
  /** 记录的时间，ISO 格式 */
  time: () => string;
  newId: () => string;
  /** 写出一行日志（例如 console.log） */
  write: (line: string) => void;
  secrets: readonly string[];
}>;

const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

/** 包住一个处理函数：每个请求写一行日志，响应带上 x-request-id；处理函数抛出错误时返回 500 */
export function withRequestLog(handler: Handler, deps: RequestLogDeps): Handler {
  return async (request) => {
    const start = deps.clock();
    // 上游（例如负载均衡）给的 id 格式对就沿用，这样两边的日志能对上；否则自己生成一个
    const incoming = request.headers.get('x-request-id');
    const requestId = incoming !== null && REQUEST_ID.test(incoming) ? incoming : deps.newId();
    // 查询参数中可能有令牌之类的东西：只记录路径
    const path = new URL(request.url).pathname;

    let response: Response;
    let failure: unknown;
    try {
      response = await handler(request);
    } catch (error) {
      failure = error;
      response = Response.json({ error: '服务器内部错误', requestId }, { status: 500 });
    }

    const status = response.status;
    const level: Level = failure !== undefined || status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    const fields: Record<string, unknown> = { requestId, method: request.method, path, status, durationMs: Math.round(deps.clock() - start) };
    deps.write(formatLog({ level, message: `${request.method} ${path} ${status}`, fields }, { time: deps.time(), secrets: deps.secrets }));

    // 有的响应的请求头是不可修改的（例如 Response.redirect）：复制一份再加上
    const result = new Response(response.body, response);
    result.headers.set('x-request-id', requestId);
    return result;
  };
}
```
:::

:::variant{kind=wrong name=always-info fails=tests reason="所有请求的级别都是 info：按级别筛选错误时什么都找不到"}
```ts file=request.ts
import { formatLog, type Level } from './log';

export type Handler = (request: Request) => Promise<Response>;

export type RequestLogDeps = Readonly<{
  /** 毫秒，只用来计算花了多长时间（例如 performance.now） */
  clock: () => number;
  /** 记录的时间，ISO 格式 */
  time: () => string;
  newId: () => string;
  /** 写出一行日志（例如 console.log） */
  write: (line: string) => void;
  secrets: readonly string[];
}>;

const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

/** 包住一个处理函数：每个请求写一行日志，响应带上 x-request-id；处理函数抛出错误时返回 500 */
export function withRequestLog(handler: Handler, deps: RequestLogDeps): Handler {
  return async (request) => {
    const start = deps.clock();
    // 上游（例如负载均衡）给的 id 格式对就沿用，这样两边的日志能对上；否则自己生成一个
    const incoming = request.headers.get('x-request-id');
    const requestId = incoming !== null && REQUEST_ID.test(incoming) ? incoming : deps.newId();
    // 查询参数中可能有令牌之类的东西：只记录路径
    const path = new URL(request.url).pathname;

    let response: Response;
    let failure: unknown;
    try {
      response = await handler(request);
    } catch (error) {
      failure = error;
      response = Response.json({ error: '服务器内部错误', requestId }, { status: 500 });
    }

    const status = response.status;
    const level: Level = 'info';
    const fields: Record<string, unknown> = { requestId, method: request.method, path, status, durationMs: Math.round(deps.clock() - start) };
    if (failure !== undefined) fields['error'] = failure;
    deps.write(formatLog({ level, message: `${request.method} ${path} ${status}`, fields }, { time: deps.time(), secrets: deps.secrets }));

    // 有的响应的请求头是不可修改的（例如 Response.redirect）：复制一份再加上
    const result = new Response(response.body, response);
    result.headers.set('x-request-id', requestId);
    return result;
  };
}
```
:::

:::variant{kind=wrong name=rethrow fails=tests reason="处理函数抛出的错误继续往外抛：Next.js 返回一个空的 500，日志中是带着密钥的错误信息（正文中实测）"}
```ts file=request.ts
import { formatLog, type Level } from './log';

export type Handler = (request: Request) => Promise<Response>;

export type RequestLogDeps = Readonly<{
  /** 毫秒，只用来计算花了多长时间（例如 performance.now） */
  clock: () => number;
  /** 记录的时间，ISO 格式 */
  time: () => string;
  newId: () => string;
  /** 写出一行日志（例如 console.log） */
  write: (line: string) => void;
  secrets: readonly string[];
}>;

const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

/** 包住一个处理函数：每个请求写一行日志，响应带上 x-request-id；处理函数抛出错误时返回 500 */
export function withRequestLog(handler: Handler, deps: RequestLogDeps): Handler {
  return async (request) => {
    const start = deps.clock();
    // 上游（例如负载均衡）给的 id 格式对就沿用，这样两边的日志能对上；否则自己生成一个
    const incoming = request.headers.get('x-request-id');
    const requestId = incoming !== null && REQUEST_ID.test(incoming) ? incoming : deps.newId();
    // 查询参数中可能有令牌之类的东西：只记录路径
    const path = new URL(request.url).pathname;

    let response: Response;
    let failure: unknown;
    try {
      response = await handler(request);
    } catch (error) {
      failure = error;
      throw error;
    }

    const status = response.status;
    const level: Level = failure !== undefined || status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    const fields: Record<string, unknown> = { requestId, method: request.method, path, status, durationMs: Math.round(deps.clock() - start) };
    if (failure !== undefined) fields['error'] = failure;
    deps.write(formatLog({ level, message: `${request.method} ${path} ${status}`, fields }, { time: deps.time(), secrets: deps.secrets }));

    // 有的响应的请求头是不可修改的（例如 Response.redirect）：复制一份再加上
    const result = new Response(response.body, response);
    result.headers.set('x-request-id', requestId);
    return result;
  };
}
```
:::

