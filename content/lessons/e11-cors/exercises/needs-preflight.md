---
kind: task
title: 这个请求需要预检吗
---
实现 `needsPreflight(request)`，按本课的（简化）规则判断一个跨源请求是否需要预检：

1. 方法（不区分大小写）不是 `GET`、`HEAD`、`POST` 之一 → 需要；
2. 有任何一个请求头的名字（不区分大小写）不是 `accept`、`accept-language`、`content-language`、`content-type` 之一 → 需要；
3. 有 `Content-Type` 头，并且它的 MIME 类型不是 `application/x-www-form-urlencoded`、`multipart/form-data`、`text/plain` 之一 → 需要。比较 MIME 类型时，只看分号之前的部分，去掉空白，不区分大小写：`text/plain; charset=utf-8` 的类型是 `text/plain`；
4. 其他情况 → 不需要。

`request.headers` 是一个普通对象，键是请求头的名字，可能是任意大小写。

:::files{role=starter}
```ts file=preflight.ts
export type CrossOriginRequest = { method: string; headers: Record<string, string> };

export function needsPreflight(request: CrossOriginRequest): boolean {
  return request.method !== 'GET';
}
```
:::

:::files{role=solution}
```ts file=preflight.ts
export type CrossOriginRequest = { method: string; headers: Record<string, string> };

const SIMPLE_METHODS = new Set(['GET', 'HEAD', 'POST']);
const SAFE_HEADERS = new Set(['accept', 'accept-language', 'content-language', 'content-type']);
const SIMPLE_CONTENT_TYPES = new Set(['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain']);

function mimeType(value: string): string {
  return (value.split(';')[0] ?? '').trim().toLowerCase();
}

export function needsPreflight(request: CrossOriginRequest): boolean {
  if (!SIMPLE_METHODS.has(request.method.toUpperCase())) return true;
  for (const [name, value] of Object.entries(request.headers)) {
    const lower = name.toLowerCase();
    if (!SAFE_HEADERS.has(lower)) return true;
    if (lower === 'content-type' && !SIMPLE_CONTENT_TYPES.has(mimeType(value))) return true;
  }
  return false;
}
```
:::

:::files{role=tests}
```ts file=preflight.test.ts
import { describe, expect, test } from 'vitest';
import { needsPreflight } from './preflight';

describe('needsPreflight', () => {
  test('简单的 GET 和表单 POST 不需要预检', () => {
    expect(needsPreflight({ method: 'GET', headers: {} })).toBe(false);
    expect(needsPreflight({ method: 'get', headers: { Accept: 'application/json' } })).toBe(false);
    expect(needsPreflight({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })).toBe(false);
    expect(needsPreflight({ method: 'HEAD', headers: { 'accept-language': 'zh-CN' } })).toBe(false);
  });

  test('其他方法需要预检', () => {
    for (const method of ['PUT', 'DELETE', 'PATCH', 'options']) {
      expect(needsPreflight({ method, headers: {} }), method).toBe(true);
    }
  });

  test('自定义请求头需要预检，请求头名字不区分大小写', () => {
    expect(needsPreflight({ method: 'GET', headers: { Authorization: 'Bearer x' } })).toBe(true);
    expect(needsPreflight({ method: 'GET', headers: { 'X-Requested-With': 'fetch' } })).toBe(true);
    expect(needsPreflight({ method: 'GET', headers: { 'ACCEPT-LANGUAGE': 'en', 'Content-Language': 'en' } })).toBe(false);
  });

  test('Content-Type 只看 MIME 类型', () => {
    expect(needsPreflight({ method: 'POST', headers: { 'content-type': 'application/json' } })).toBe(true);
    expect(needsPreflight({ method: 'POST', headers: { 'Content-Type': 'text/plain; charset=utf-8' } })).toBe(false);
    expect(needsPreflight({ method: 'POST', headers: { 'Content-Type': ' Multipart/Form-Data ; boundary=x' } })).toBe(false);
    expect(needsPreflight({ method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' } })).toBe(true);
  });
});
```
:::

:::hint{level=1}
三条规则依次检查，任何一条成立就返回 `true`。方法用 `toUpperCase()` 统一大小写；请求头用 `Object.entries` 遍历，名字用 `toLowerCase()` 统一大小写。把允许的值放进 `Set`，用 `has` 判断。
:::

:::hint{level=2}
MIME 类型：`value.split(';')[0]` 取分号之前的部分（类型是 `string | undefined`，可以 `?? ''`），再 `trim()` 和 `toLowerCase()`。
:::

:::explanation
这三条规则对应的正是一个普通 HTML 表单能发出的请求：表单只能用 `GET` 或 `POST`，只能设置少数几个请求头，编码方式只有那三种 `Content-Type`。这类请求在 CORS 出现之前就能跨源发送，服务器本来就要防范它们（例如防 CSRF），所以浏览器直接发送，只在读取响应时检查。

其他请求（发送 JSON、使用 `PUT`、带上 `Authorization` 头）是 CORS 出现之后才可能跨源发出的，旧的服务器可能完全没有考虑过它们，所以浏览器先用 `OPTIONS` 问一声，服务器明确同意了才发送。

HTTP 请求头的名字不区分大小写，`Content-Type` 和 `content-type` 是同一个头；MIME 类型本身也不区分大小写，分号之后的参数（`charset`、`boundary`）不影响判断。真实的规则更细一些：这几个头的值有长度和字符的限制，单个字节范围的 `Range` 头也算安全，请求体是 `ReadableStream`、或者用 `XMLHttpRequest` 监听了上传进度时也会预检。这里做了简化。
:::

:::variant{kind=alt name=some-headers}
```ts file=preflight.ts
export type CrossOriginRequest = { method: string; headers: Record<string, string> };

export function needsPreflight(request: CrossOriginRequest): boolean {
  const method = request.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && method !== 'POST') return true;
  return Object.entries(request.headers).some(([name, value]) => {
    switch (name.toLowerCase()) {
      case 'accept':
      case 'accept-language':
      case 'content-language':
        return false;
      case 'content-type': {
        const type = value.split(';', 1).join('').trim().toLowerCase();
        return !['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain'].includes(type);
      }
      default:
        return true;
    }
  });
}
```
:::

:::variant{kind=wrong name=case-sensitive-names fails=tests reason="请求头的名字区分了大小写"}
```ts file=preflight.ts
export type CrossOriginRequest = { method: string; headers: Record<string, string> };

const SAFE = ['accept', 'accept-language', 'content-language', 'content-type'];
const SIMPLE_TYPES = ['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain'];

export function needsPreflight(request: CrossOriginRequest): boolean {
  if (!['GET', 'HEAD', 'POST'].includes(request.method.toUpperCase())) return true;
  for (const [name, value] of Object.entries(request.headers)) {
    if (!SAFE.includes(name)) return true;
    if (name === 'content-type' && !SIMPLE_TYPES.includes((value.split(';')[0] ?? '').trim().toLowerCase())) return true;
  }
  return false;
}
```
:::

:::variant{kind=wrong name=whole-content-type fails=tests reason="比较了整个 Content-Type 的值，带 charset 的简单类型被误判"}
```ts file=preflight.ts
export type CrossOriginRequest = { method: string; headers: Record<string, string> };

const SAFE = ['accept', 'accept-language', 'content-language', 'content-type'];
const SIMPLE_TYPES = ['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain'];

export function needsPreflight(request: CrossOriginRequest): boolean {
  if (!['GET', 'HEAD', 'POST'].includes(request.method.toUpperCase())) return true;
  for (const [name, value] of Object.entries(request.headers)) {
    const lower = name.toLowerCase();
    if (!SAFE.includes(lower)) return true;
    if (lower === 'content-type' && !SIMPLE_TYPES.includes(value.toLowerCase())) return true;
  }
  return false;
}
```
:::

:::variant{kind=wrong name=ignore-content-type fails=tests reason="没有检查 Content-Type，发送 JSON 的 POST 被当成了简单请求"}
```ts file=preflight.ts
export type CrossOriginRequest = { method: string; headers: Record<string, string> };

const SAFE = ['accept', 'accept-language', 'content-language', 'content-type'];

export function needsPreflight(request: CrossOriginRequest): boolean {
  if (!['GET', 'HEAD', 'POST'].includes(request.method.toUpperCase())) return true;
  return Object.keys(request.headers).some((name) => !SAFE.includes(name.toLowerCase()));
}
```
:::
