---
kind: task
title: 错误对应的响应
---
`errors.ts`（只读）中有几个“预期的”错误类，它们的 `message` 是写给用户看的。在 `responses.ts` 中实现：

1. `toErrorResponse(error, requestId)`：把 Route Handler 中抛出的任何值变成一个 JSON 响应（`Response.json`）：

   | 错误 | 状态码 | `error` |
   | --- | --- | --- |
   | `ValidationError` | 422 | 它的 `message`，另外加上 `fields` |
   | `BadRequestError` | 400 | 它的 `message` |
   | `AuthError`，`reason` 是 `'unauthenticated'` / `'forbidden'` | 401 / 403 | 它的 `message` |
   | `NotFoundError` | 404 | 它的 `message` |
   | `ConflictError` | 409 | 它的 `message` |
   | 其他任何值（包括普通的 `Error`、`TypeError`、`SyntaxError`、字符串、`undefined`） | 500 | 固定的“服务器出错了，请稍后再试”，**不包含**原来的任何信息 |

   响应体是 `{ error, requestId }`，只有 `ValidationError` 还有 `fields`。所有的响应都带上 `Cache-Control: no-store` 和 `X-Request-Id: requestId`；
2. `readJson(request)`：返回解析之后的请求体。`request.json()` 因为内容不是 JSON（包括空的请求体）而失败时，抛出 `BadRequestError('请求体不是有效的 JSON')`；其他原因的失败（例如请求体已经被读过了）原样抛出。解析失败时抛出的值在不同的环境中不一样：Node.js（Next.js 运行的地方）和 Chromium 中是 `SyntaxError`，WebKit 中是一个 `name` 为 `'SyntaxError'` 的 `DOMException`，两种都要认出来。

:::files{role=starter}
```ts file=responses.ts
import { AuthError, BadRequestError, ConflictError, NotFoundError, ValidationError } from './errors';

export type ErrorBody = Readonly<{ error: string; requestId: string; fields?: Readonly<Record<string, string>> }>;

/** 把 Route Handler 中抛出的错误变成一个 JSON 响应 */
export function toErrorResponse(error: unknown, requestId: string): Response {
  // TODO
  return Response.json({ error: String(error), requestId }, { status: 500 });
}

/** 读取 JSON 请求体：无法解析时是 BadRequestError，其他的错误原样抛出 */
export async function readJson(request: Request): Promise<unknown> {
  // TODO
  return request.json();
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
```ts file=main.ts readonly
import { NotFoundError, ValidationError } from './errors';
import { readJson, toErrorResponse } from './responses';

for (const error of [new ValidationError({ title: '请填写标题' }), new NotFoundError('找不到这个项目'), new Error('连接失败：密码 hunter2')]) {
  const response = toErrorResponse(error, 'req-1');
  console.log(response.status, response.headers.get('cache-control'), await response.text());
}

try {
  await readJson(new Request('https://app.example/api', { method: 'POST', body: '{"title":' }));
} catch (error) {
  console.log(error instanceof Error ? `${error.name}: ${error.message}` : error);
}
```
:::

:::files{role=solution}
```ts file=responses.ts
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
:::

:::files{role=tests}
```ts file=responses.test.ts
import { describe, expect, test } from 'vitest';
import { AuthError, BadRequestError, ConflictError, NotFoundError, ValidationError } from './errors';
import { readJson, toErrorResponse } from './responses';

async function check(error: unknown) {
  const response = toErrorResponse(error, 'req-7');
  return { status: response.status, body: await response.json(), headers: response.headers };
}

describe('toErrorResponse', () => {
  test('校验错误：422，带上每个字段的信息', async () => {
    expect(await check(new ValidationError({ title: '请填写标题' }))).toMatchObject({
      status: 422,
      body: { error: '输入有误', fields: { title: '请填写标题' }, requestId: 'req-7' },
    });
  });

  test('其他预期的错误：各自的状态码和信息，没有 fields', async () => {
    const cases: [unknown, number, string][] = [
      [new BadRequestError('请求体不是有效的 JSON'), 400, '请求体不是有效的 JSON'],
      [new AuthError('unauthenticated'), 401, '请先登录'],
      [new AuthError('forbidden'), 403, '没有权限'],
      [new NotFoundError('找不到这个项目'), 404, '找不到这个项目'],
      [new ConflictError('已经有同名的项目'), 409, '已经有同名的项目'],
    ];
    for (const [error, status, message] of cases) {
      const result = await check(error);
      expect({ status: result.status, body: result.body }, message).toStrictEqual({ status, body: { error: message, requestId: 'req-7' } });
    }
  });

  test('未预期的错误：500，不透露原来的信息', async () => {
    for (const error of [new Error('连接失败：密码 hunter2'), new TypeError('x is undefined'), new SyntaxError('Unexpected token'), '字符串', undefined, { status: 404 }]) {
      const { status, body } = await check(error);
      expect(status).toBe(500);
      expect(body).toStrictEqual({ error: '服务器出错了，请稍后再试', requestId: 'req-7' });
    }
  });

  test('响应头：JSON、不缓存、带上请求的 id', async () => {
    const { headers } = await check(new NotFoundError('找不到'));
    expect(headers.get('content-type')).toMatch(/^application\/json/);
    expect(headers.get('cache-control')).toBe('no-store');
    expect(headers.get('x-request-id')).toBe('req-7');
    const failed = await check(new Error('boom'));
    expect(failed.headers.get('cache-control')).toBe('no-store');
    expect(failed.headers.get('x-request-id')).toBe('req-7');
  });
});

describe('readJson', () => {
  const post = (body: string) => new Request('https://app.example/api/todos', { method: 'POST', body, headers: { 'content-type': 'application/json' } });

  test('正常的 JSON：返回解析的值', async () => {
    expect(await readJson(post('{"title":"买牛奶"}'))).toStrictEqual({ title: '买牛奶' });
  });

  test('无法解析的请求体（包括空的）：BadRequestError', async () => {
    for (const body of ['{"title":', '', 'title=买牛奶']) {
      let caught: unknown;
      try {
        await readJson(post(body));
      } catch (error) {
        caught = error;
      }
      expect(caught, body).toBeInstanceOf(BadRequestError);
      expect(caught instanceof Error ? caught.message : '', body).toBe('请求体不是有效的 JSON');
    }
  });

  test('不是解析的问题（请求体已经被读过了）：原样抛出', async () => {
    const request = post('{}');
    await request.text();
    let caught: unknown;
    try {
      await readJson(request);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(TypeError);
  });
});
```
:::

:::hint{level=1}
先写一个函数，用一串 `instanceof` 判断错误的类型，返回 `{ status, message, fields? }`；最后一行是“其他任何值”。`toErrorResponse` 再用它构造响应：`Response.json(body, { status, headers })`。
:::

:::hint{level=2}
`readJson` 用 `try`/`catch` 包住 `await request.json()`。`catch` 中先判断是不是解析失败（`error instanceof SyntaxError`，或者 `error instanceof DOMException && error.name === 'SyntaxError'`），是才换成 `BadRequestError`；不是就 `throw error`。注意 `await` 不能省：`return request.json()` 返回的 Promise 失败时，`catch` 根本接不到。
:::

:::explanation
错误分成两类，处理的方式完全不同。**预期的错误**（输入不合法、没有权限、找不到、冲突）是程序正常运行的一部分，它们的信息是写给用户看的，状态码告诉客户端该怎么办：401 重新登录，403 不用再试，404 不存在，409 先刷新再改，422 修改输入。**未预期的错误**是程序或者环境出了问题，它的信息可能包含 SQL、文件路径、密码（正文中实测，Route Handler 中未处理的错误信息完整地出现在了服务器的日志中），这些都不能发给浏览器：用户只需要知道“出错了”，以及一个可以报告给开发者的 `requestId`。

判断“预期”要用明确的类型（`instanceof` 自己定义的类），而不是“看起来像”：`SyntaxError` 可能来自客户端发来的坏 JSON，也可能来自自己代码中的 `JSON.parse`，把它们都当成 400 会掩盖真正的程序错误。所以 `readJson` 在**确定**是请求体的问题时，才把它换成 `BadRequestError`。

`Cache-Control: no-store` 防止一个临时的错误（例如数据库重启的那几秒）被 CDN 或浏览器缓存下来。

替代解用一张“错误类 → 状态码”的表，`readJson` 先读出文本再自己 `JSON.parse`，这样“读不出来”和“不是 JSON”自然就分开了。
:::

:::variant{kind=alt name=table-and-text}
```ts file=responses.ts
import { AuthError, BadRequestError, ConflictError, NotFoundError, ValidationError } from './errors';

export type ErrorBody = Readonly<{ error: string; requestId: string; fields?: Readonly<Record<string, string>> }>;

/** 预期的错误类和它们的状态码；按顺序查找，找不到的就是未预期的错误 */
const EXPECTED: readonly (readonly [abstract new (...args: never[]) => Error, (error: Error) => number])[] = [
  [ValidationError, () => 422],
  [BadRequestError, () => 400],
  [AuthError, (error) => (error instanceof AuthError && error.reason === 'forbidden' ? 403 : 401)],
  [NotFoundError, () => 404],
  [ConflictError, () => 409],
];

/** 把 Route Handler 中抛出的错误变成一个 JSON 响应 */
export function toErrorResponse(error: unknown, requestId: string): Response {
  const headers = { 'Cache-Control': 'no-store', 'X-Request-Id': requestId };
  const match = error instanceof Error ? EXPECTED.find(([type]) => error instanceof type) : undefined;
  if (match === undefined || !(error instanceof Error)) {
    return Response.json({ error: '服务器出错了，请稍后再试', requestId } satisfies ErrorBody, { status: 500, headers });
  }
  const body: ErrorBody = error instanceof ValidationError ? { error: error.message, requestId, fields: error.fields } : { error: error.message, requestId };
  return Response.json(body, { status: match[1](error), headers });
}

/** 读取 JSON 请求体：先读出文本，再自己解析，这样能分清“读不出来”和“不是 JSON” */
export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new BadRequestError('请求体不是有效的 JSON');
  }
}
```
:::

:::variant{kind=wrong name=leak-message fails=tests reason="未预期的错误返回了原来的信息：数据库的密码被发给了浏览器"}
```ts file=responses.ts
import { AuthError, BadRequestError, ConflictError, NotFoundError, ValidationError } from './errors';

export type ErrorBody = Readonly<{ error: string; requestId: string; fields?: Readonly<Record<string, string>> }>;

/** 每种错误对应的状态码和返回给用户的信息；不认识的错误一律是 500，不透露任何细节 */
function describe(error: unknown): { status: number; message: string; fields?: Readonly<Record<string, string>> } {
  if (error instanceof ValidationError) return { status: 422, message: error.message, fields: error.fields };
  if (error instanceof BadRequestError) return { status: 400, message: error.message };
  if (error instanceof AuthError) return { status: error.reason === 'unauthenticated' ? 401 : 403, message: error.message };
  if (error instanceof NotFoundError) return { status: 404, message: error.message };
  if (error instanceof ConflictError) return { status: 409, message: error.message };
  return { status: 500, message: error instanceof Error ? error.message : '服务器出错了，请稍后再试' };
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
:::

:::variant{kind=wrong name=syntax-error-400 fails=tests reason="所有的 SyntaxError 都当作请求的问题：代码中 JSON.parse 的错误也变成了 400，掩盖了程序的错误"}
```ts file=responses.ts
import { AuthError, BadRequestError, ConflictError, NotFoundError, ValidationError } from './errors';

export type ErrorBody = Readonly<{ error: string; requestId: string; fields?: Readonly<Record<string, string>> }>;

/** 每种错误对应的状态码和返回给用户的信息；不认识的错误一律是 500，不透露任何细节 */
function describe(error: unknown): { status: number; message: string; fields?: Readonly<Record<string, string>> } {
  if (error instanceof ValidationError) return { status: 422, message: error.message, fields: error.fields };
  if (error instanceof BadRequestError) return { status: 400, message: error.message };
  if (error instanceof AuthError) return { status: error.reason === 'unauthenticated' ? 401 : 403, message: error.message };
  if (error instanceof NotFoundError) return { status: 404, message: error.message };
  if (error instanceof ConflictError) return { status: 409, message: error.message };
  if (error instanceof SyntaxError) return { status: 400, message: '请求体不是有效的 JSON' };
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
:::

:::variant{kind=wrong name=forbidden-401 fails=tests reason="没有权限也返回 401：客户端会以为要重新登录"}
```ts file=responses.ts
import { AuthError, BadRequestError, ConflictError, NotFoundError, ValidationError } from './errors';

export type ErrorBody = Readonly<{ error: string; requestId: string; fields?: Readonly<Record<string, string>> }>;

/** 每种错误对应的状态码和返回给用户的信息；不认识的错误一律是 500，不透露任何细节 */
function describe(error: unknown): { status: number; message: string; fields?: Readonly<Record<string, string>> } {
  if (error instanceof ValidationError) return { status: 422, message: error.message, fields: error.fields };
  if (error instanceof BadRequestError) return { status: 400, message: error.message };
  if (error instanceof AuthError) return { status: 401, message: error.message };
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
:::

:::variant{kind=wrong name=cacheable fails=tests reason="错误响应没有 Cache-Control: no-store：CDN 或浏览器可能缓存一个临时的错误"}
```ts file=responses.ts
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
  return Response.json(body, { status, headers: { 'X-Request-Id': requestId } });
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
:::

:::variant{kind=wrong name=readjson-catch-all fails=tests reason="readJson 把所有的错误都变成 400：请求体已经被读过这样的程序错误也被当成了客户端的问题"}
```ts file=responses.ts
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
    void error;
    throw new BadRequestError('请求体不是有效的 JSON');
  }
}
```
:::

