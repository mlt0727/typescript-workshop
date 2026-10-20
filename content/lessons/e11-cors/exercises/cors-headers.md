---
kind: challenge
title: 服务器端的 CORS 处理
---
在服务器上实现 CORS：`handleCors(request, config)` 根据请求和配置，决定要在响应中加上哪些头。

`request.headers` 中请求头的名字都是**小写**（和 Node.js 的 `req.headers` 一样）；返回的响应头的名字也用小写。

1. **返回的头里总是包含 `vary: 'Origin'`**：响应的内容取决于请求的来源，缓存要按来源区分（为了简单，`*` 的情况也加上，这不会出错）；
2. **没有 `origin` 请求头**：不是跨源请求，返回 `{ kind: 'continue', headers: { vary: 'Origin' } }`；
3. **允许的来源**和 `access-control-allow-origin` 的值：`allowedOrigins` 中有这个来源（完全相同）时，值就是这个来源；否则，如果 `allowedOrigins` 中有 `'*'` **并且不允许凭据**，值是 `'*'`；其他情况都不允许。允许凭据时，`'*'` 不放行任何来源；
4. **预检请求**：方法是 `OPTIONS`，并且有 `access-control-request-method` 请求头。满足下面三条才通过：来源被允许；请求的方法在 `allowedMethods` 中（直接比较）；`access-control-request-headers`（用逗号分隔的列表，可能不存在）中的每一项，去掉空白、不区分大小写，都在 `allowedHeaders` 中。
   - 通过：`{ kind: 'preflight', status: 204, headers }`，`headers` 包含 `access-control-allow-origin`；`access-control-allow-methods`（`allowedMethods` 用 `', '` 连接）；`access-control-allow-headers`（`allowedHeaders` 用 `', '` 连接，列表为空时不包含）；`access-control-max-age`（秒数的字符串）；允许凭据时还有 `access-control-allow-credentials: 'true'`；以及 `vary`；
   - 不通过：`{ kind: 'preflight', status: 403, headers: { vary: 'Origin' } }`；
5. **其他请求**（实际请求）：服务器照常处理，返回 `{ kind: 'continue', headers }`。来源被允许时，`headers` 包含 `access-control-allow-origin`，允许凭据时还有 `access-control-allow-credentials: 'true'`；不被允许时只有 `vary`。

:::files{role=starter}
```ts file=cors.ts
export type CorsConfig = {
  allowedOrigins: readonly string[];
  allowedMethods: readonly string[];
  allowedHeaders: readonly string[];
  allowCredentials: boolean;
  maxAgeSeconds: number;
};

export type CorsRequest = { method: string; headers: Record<string, string> };

export type CorsResult =
  | { kind: 'preflight'; status: 204 | 403; headers: Record<string, string> }
  | { kind: 'continue'; headers: Record<string, string> };

export function handleCors(request: CorsRequest, config: CorsConfig): CorsResult {
  return { kind: 'continue', headers: { 'access-control-allow-origin': '*' } };
}
```
:::

:::files{role=solution}
```ts file=cors.ts
export type CorsConfig = {
  allowedOrigins: readonly string[];
  allowedMethods: readonly string[];
  allowedHeaders: readonly string[];
  allowCredentials: boolean;
  maxAgeSeconds: number;
};

export type CorsRequest = { method: string; headers: Record<string, string> };

export type CorsResult =
  | { kind: 'preflight'; status: 204 | 403; headers: Record<string, string> }
  | { kind: 'continue'; headers: Record<string, string> };

function allowOriginFor(origin: string, config: CorsConfig): string | undefined {
  if (config.allowedOrigins.includes(origin)) return origin;
  if (config.allowedOrigins.includes('*') && !config.allowCredentials) return '*';
  return undefined;
}

function parseList(value: string | undefined): string[] {
  if (value === undefined) return [];
  return value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item !== '');
}

export function handleCors(request: CorsRequest, config: CorsConfig): CorsResult {
  const headers: Record<string, string> = { vary: 'Origin' };
  const origin = request.headers['origin'];
  if (origin === undefined) return { kind: 'continue', headers };

  const allowOrigin = allowOriginFor(origin, config);
  const requestedMethod = request.headers['access-control-request-method'];

  if (request.method === 'OPTIONS' && requestedMethod !== undefined) {
    const allowedHeaders = new Set(config.allowedHeaders.map((name) => name.toLowerCase()));
    const methodAllowed = config.allowedMethods.includes(requestedMethod);
    const headersAllowed = parseList(request.headers['access-control-request-headers']).every((name) =>
      allowedHeaders.has(name),
    );
    if (allowOrigin === undefined || !methodAllowed || !headersAllowed) {
      return { kind: 'preflight', status: 403, headers };
    }
    headers['access-control-allow-origin'] = allowOrigin;
    headers['access-control-allow-methods'] = config.allowedMethods.join(', ');
    if (config.allowedHeaders.length > 0) {
      headers['access-control-allow-headers'] = config.allowedHeaders.join(', ');
    }
    headers['access-control-max-age'] = String(config.maxAgeSeconds);
    if (config.allowCredentials) headers['access-control-allow-credentials'] = 'true';
    return { kind: 'preflight', status: 204, headers };
  }

  if (allowOrigin !== undefined) {
    headers['access-control-allow-origin'] = allowOrigin;
    if (config.allowCredentials) headers['access-control-allow-credentials'] = 'true';
  }
  return { kind: 'continue', headers };
}
```
:::

:::files{role=tests}
```ts file=cors.test.ts
import { describe, expect, test } from 'vitest';
import { handleCors, type CorsConfig, type CorsRequest } from './cors';

const config: CorsConfig = {
  allowedOrigins: ['https://app.example.com', 'http://localhost:5173'],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  allowCredentials: true,
  maxAgeSeconds: 600,
};

const publicConfig: CorsConfig = {
  allowedOrigins: ['*'],
  allowedMethods: ['GET'],
  allowedHeaders: [],
  allowCredentials: false,
  maxAgeSeconds: 3600,
};

function preflight(origin: string, method: string, requestHeaders?: string): CorsRequest {
  const headers: Record<string, string> = { origin, 'access-control-request-method': method };
  if (requestHeaders !== undefined) headers['access-control-request-headers'] = requestHeaders;
  return { method: 'OPTIONS', headers };
}

describe('实际请求', () => {
  test('没有 Origin：不是跨源请求，只返回 Vary', () => {
    expect(handleCors({ method: 'GET', headers: {} }, config)).toEqual({ kind: 'continue', headers: { vary: 'Origin' } });
  });

  test('允许的来源：返回这个来源和 Allow-Credentials', () => {
    expect(handleCors({ method: 'GET', headers: { origin: 'https://app.example.com' } }, config)).toEqual({
      kind: 'continue',
      headers: {
        'access-control-allow-origin': 'https://app.example.com',
        'access-control-allow-credentials': 'true',
        vary: 'Origin',
      },
    });
  });

  test('不允许的来源：照常处理，但不返回 CORS 头；来源必须完全相同', () => {
    for (const origin of ['https://evil.example', 'https://app.example.com.evil.example', 'http://app.example.com', 'https://app.example.com:8443']) {
      expect(handleCors({ method: 'POST', headers: { origin } }, config), origin).toEqual({
        kind: 'continue',
        headers: { vary: 'Origin' },
      });
    }
  });
});

describe('预检请求', () => {
  test('通过：204 和完整的响应头', () => {
    expect(handleCors(preflight('http://localhost:5173', 'PUT', 'content-type,authorization'), config)).toEqual({
      kind: 'preflight',
      status: 204,
      headers: {
        'access-control-allow-origin': 'http://localhost:5173',
        'access-control-allow-methods': 'GET, POST, PUT, DELETE',
        'access-control-allow-headers': 'Content-Type, Authorization',
        'access-control-max-age': '600',
        'access-control-allow-credentials': 'true',
        vary: 'Origin',
      },
    });
  });

  test('请求头列表：去掉空白、不区分大小写，也可以不存在', () => {
    expect(handleCors(preflight('https://app.example.com', 'POST', ' Content-Type , AUTHORIZATION '), config)).toMatchObject({
      kind: 'preflight',
      status: 204,
    });
    expect(handleCors(preflight('https://app.example.com', 'DELETE'), config)).toMatchObject({ kind: 'preflight', status: 204 });
  });

  test('来源、方法、请求头有一项不允许：403', () => {
    const rejected = { kind: 'preflight', status: 403, headers: { vary: 'Origin' } };
    expect(handleCors(preflight('https://evil.example', 'GET'), config)).toEqual(rejected);
    expect(handleCors(preflight('https://app.example.com', 'PATCH'), config)).toEqual(rejected);
    expect(handleCors(preflight('https://app.example.com', 'POST', 'content-type, x-debug'), config)).toEqual(rejected);
  });

  test('没有 Access-Control-Request-Method 的 OPTIONS 不是预检', () => {
    expect(handleCors({ method: 'OPTIONS', headers: { origin: 'https://app.example.com' } }, config)).toMatchObject({
      kind: 'continue',
    });
  });
});

describe('公开数据与凭据', () => {
  test('不需要凭据的公开数据：任何来源都得到 *', () => {
    expect(handleCors({ method: 'GET', headers: { origin: 'https://anyone.example' } }, publicConfig)).toEqual({
      kind: 'continue',
      headers: { 'access-control-allow-origin': '*', vary: 'Origin' },
    });
    expect(handleCors(preflight('https://anyone.example', 'GET'), publicConfig)).toEqual({
      kind: 'preflight',
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET',
        'access-control-max-age': '3600',
        vary: 'Origin',
      },
    });
  });

  test('允许凭据时，* 不放行任何来源，只放行列出的来源', () => {
    const withCredentials: CorsConfig = { ...publicConfig, allowedOrigins: ['*', 'https://app.example.com'], allowCredentials: true };
    expect(handleCors({ method: 'GET', headers: { origin: 'https://anyone.example' } }, withCredentials)).toEqual({
      kind: 'continue',
      headers: { vary: 'Origin' },
    });
    expect(handleCors(preflight('https://anyone.example', 'GET'), withCredentials)).toEqual({
      kind: 'preflight',
      status: 403,
      headers: { vary: 'Origin' },
    });
    expect(handleCors({ method: 'GET', headers: { origin: 'https://app.example.com' } }, withCredentials)).toEqual({
      kind: 'continue',
      headers: {
        'access-control-allow-origin': 'https://app.example.com',
        'access-control-allow-credentials': 'true',
        vary: 'Origin',
      },
    });
  });
});
```
:::

:::hint{level=1}
先处理最简单的情况：没有 `origin` 就直接返回。然后写一个辅助函数 `allowOriginFor(origin, config): string | undefined`，返回 `access-control-allow-origin` 的值，`undefined` 表示不允许。预检和实际请求都要用到它。
:::

:::hint{level=2}
请求头列表：`value.split(',')`，每一项 `trim().toLowerCase()`，过滤掉空字符串；把 `allowedHeaders` 也转成小写放进 `Set`，再用 `every` 检查。响应头对象可以先写成 `const headers: Record<string, string> = { vary: 'Origin' }`，再按条件添加。判断预检：`request.method === 'OPTIONS' && requestedMethod !== undefined`；`request.headers['origin']` 的类型是 `string | undefined`（`noUncheckedIndexedAccess`），检查之后才能当作字符串使用。
:::

:::explanation
**来源必须完全相同。** 用 `startsWith`、`includes` 或者不严谨的正则匹配来源，是真实项目中常见的漏洞：`https://app.example.com.evil.example` 以 `https://app.example.com` 开头，但它是攻击者的域名。所以用一个明确的列表做完全比较。

**允许凭据时不能放行“任何来源”。** 浏览器拒绝 `Access-Control-Allow-Origin: *` 与凭据一起使用。一些服务器为了绕过这个限制，把请求的 `Origin` 原样写回响应头，这等于允许任何网站带着用户的 cookie 读取接口，正是同源策略要阻止的事情。所以这里的规则是：允许凭据时，`*` 不放行任何来源。

**`Vary: Origin`。** 同一个地址，给不同的来源返回的 `Access-Control-Allow-Origin` 不同。如果中间的缓存（CDN、浏览器缓存）不知道这一点，就可能把给 A 的响应交给 B，B 的请求因此失败（或者 A 被拒绝的响应被交给了允许的来源）。`Vary: Origin` 告诉缓存按 `Origin` 分别保存。

**不允许的实际请求照常处理。** CORS 不会阻止请求到达服务器：简单请求不需要预检，浏览器直接发送，只在读取响应时检查。所以接口仍然要自己做鉴权，有副作用的接口还要防 CSRF。预检则不同：预检不通过，浏览器就不会发送真正的请求。

**预检的缓存。** `Access-Control-Max-Age` 让浏览器在这段时间内不再重复预检。浏览器会设上限（例如 Chromium 是 2 小时），设得再大也没用。

**真实服务器上还要注意的几点：**

- 方法名区分大小写。浏览器只会把 `GET`、`HEAD`、`POST`、`PUT`、`DELETE`、`OPTIONS` 这六个方法名统一成大写；`fetch(url, { method: 'patch' })` 发出的就是小写的 `patch`，它和 `Access-Control-Allow-Methods: PATCH` 不匹配，预检会失败。所以前端要写大写的 `PATCH`；
- 预检请求本身**不带**凭据（cookie）。处理 `OPTIONS` 的代码不能要求用户已经登录，否则所有需要预检的请求都会失败；
- 不要把 `'null'` 放进允许的来源。沙箱 iframe、本地打开的 `file://` 页面发出的请求，`Origin` 都是 `null`，允许它就等于允许了任何能制造这种页面的人。
:::

:::variant{kind=alt name=lookup-first}
```ts file=cors.ts
export type CorsConfig = {
  allowedOrigins: readonly string[];
  allowedMethods: readonly string[];
  allowedHeaders: readonly string[];
  allowCredentials: boolean;
  maxAgeSeconds: number;
};

export type CorsRequest = { method: string; headers: Record<string, string> };

export type CorsResult =
  | { kind: 'preflight'; status: 204 | 403; headers: Record<string, string> }
  | { kind: 'continue'; headers: Record<string, string> };

const VARY = { vary: 'Origin' } as const;

export function handleCors(request: CorsRequest, config: CorsConfig): CorsResult {
  const origin = request.headers['origin'];
  const requestedMethod = request.headers['access-control-request-method'];
  const isPreflight = request.method === 'OPTIONS' && requestedMethod !== undefined;

  let allowOrigin: string | null = null;
  if (origin !== undefined && config.allowedOrigins.includes(origin)) allowOrigin = origin;
  else if (origin !== undefined && config.allowedOrigins.includes('*') && !config.allowCredentials) allowOrigin = '*';

  const credentials: Record<string, string> = config.allowCredentials ? { 'access-control-allow-credentials': 'true' } : {};

  if (origin === undefined) return { kind: 'continue', headers: { ...VARY } };
  if (!isPreflight) {
    return allowOrigin === null
      ? { kind: 'continue', headers: { ...VARY } }
      : { kind: 'continue', headers: { ...VARY, 'access-control-allow-origin': allowOrigin, ...credentials } };
  }

  const allowedHeaderNames = config.allowedHeaders.map((name) => name.toLowerCase());
  const requested = (request.headers['access-control-request-headers'] ?? '').split(',');
  const headersOk = requested.every((raw) => {
    const name = raw.trim().toLowerCase();
    return name === '' || allowedHeaderNames.includes(name);
  });
  const methodOk = config.allowedMethods.some((method) => method === requestedMethod);
  const allowHeaders: Record<string, string> =
    config.allowedHeaders.length > 0 ? { 'access-control-allow-headers': config.allowedHeaders.join(', ') } : {};
  if (allowOrigin === null || !methodOk || !headersOk) {
    return { kind: 'preflight', status: 403, headers: { ...VARY } };
  }
  return {
    kind: 'preflight',
    status: 204,
    headers: {
      ...VARY,
      'access-control-allow-origin': allowOrigin,
      'access-control-allow-methods': config.allowedMethods.join(', '),
      ...allowHeaders,
      'access-control-max-age': `${config.maxAgeSeconds}`,
      ...credentials,
    },
  };
}
```
:::

:::variant{kind=wrong name=reflect-any-origin fails=tests reason="配置中有 * 时把任何来源原样写回，允许凭据时也是如此"}
```ts file=cors.ts
export type CorsConfig = {
  allowedOrigins: readonly string[];
  allowedMethods: readonly string[];
  allowedHeaders: readonly string[];
  allowCredentials: boolean;
  maxAgeSeconds: number;
};

export type CorsRequest = { method: string; headers: Record<string, string> };

export type CorsResult =
  | { kind: 'preflight'; status: 204 | 403; headers: Record<string, string> }
  | { kind: 'continue'; headers: Record<string, string> };

function allowOriginFor(origin: string, config: CorsConfig): string | undefined {
  if (config.allowedOrigins.includes(origin)) return origin;
  if (config.allowedOrigins.includes('*')) return config.allowCredentials ? origin : '*';
  return undefined;
}

export function handleCors(request: CorsRequest, config: CorsConfig): CorsResult {
  const headers: Record<string, string> = { vary: 'Origin' };
  const origin = request.headers['origin'];
  if (origin === undefined) return { kind: 'continue', headers };
  const allowOrigin = allowOriginFor(origin, config);
  const requestedMethod = request.headers['access-control-request-method'];
  if (request.method === 'OPTIONS' && requestedMethod !== undefined) {
    const allowed = new Set(config.allowedHeaders.map((name) => name.toLowerCase()));
    const requested = (request.headers['access-control-request-headers'] ?? '')
      .split(',')
      .map((name) => name.trim().toLowerCase())
      .filter((name) => name !== '');
    if (allowOrigin === undefined || !config.allowedMethods.includes(requestedMethod) || !requested.every((name) => allowed.has(name))) {
      return { kind: 'preflight', status: 403, headers };
    }
    headers['access-control-allow-origin'] = allowOrigin;
    headers['access-control-allow-methods'] = config.allowedMethods.join(', ');
    if (config.allowedHeaders.length > 0) headers['access-control-allow-headers'] = config.allowedHeaders.join(', ');
    headers['access-control-max-age'] = String(config.maxAgeSeconds);
    if (config.allowCredentials) headers['access-control-allow-credentials'] = 'true';
    return { kind: 'preflight', status: 204, headers };
  }
  if (allowOrigin !== undefined) {
    headers['access-control-allow-origin'] = allowOrigin;
    if (config.allowCredentials) headers['access-control-allow-credentials'] = 'true';
  }
  return { kind: 'continue', headers };
}
```
:::

:::variant{kind=wrong name=prefix-match fails=tests reason="用 startsWith 匹配来源，攻击者的域名也能通过"}
```ts file=cors.ts
export type CorsConfig = {
  allowedOrigins: readonly string[];
  allowedMethods: readonly string[];
  allowedHeaders: readonly string[];
  allowCredentials: boolean;
  maxAgeSeconds: number;
};

export type CorsRequest = { method: string; headers: Record<string, string> };

export type CorsResult =
  | { kind: 'preflight'; status: 204 | 403; headers: Record<string, string> }
  | { kind: 'continue'; headers: Record<string, string> };

function allowOriginFor(origin: string, config: CorsConfig): string | undefined {
  if (config.allowedOrigins.some((allowed) => allowed !== '*' && origin.startsWith(allowed))) return origin;
  if (config.allowedOrigins.includes('*') && !config.allowCredentials) return '*';
  return undefined;
}

export function handleCors(request: CorsRequest, config: CorsConfig): CorsResult {
  const headers: Record<string, string> = { vary: 'Origin' };
  const origin = request.headers['origin'];
  if (origin === undefined) return { kind: 'continue', headers };
  const allowOrigin = allowOriginFor(origin, config);
  const requestedMethod = request.headers['access-control-request-method'];
  if (request.method === 'OPTIONS' && requestedMethod !== undefined) {
    const allowed = new Set(config.allowedHeaders.map((name) => name.toLowerCase()));
    const requested = (request.headers['access-control-request-headers'] ?? '')
      .split(',')
      .map((name) => name.trim().toLowerCase())
      .filter((name) => name !== '');
    if (allowOrigin === undefined || !config.allowedMethods.includes(requestedMethod) || !requested.every((name) => allowed.has(name))) {
      return { kind: 'preflight', status: 403, headers };
    }
    headers['access-control-allow-origin'] = allowOrigin;
    headers['access-control-allow-methods'] = config.allowedMethods.join(', ');
    if (config.allowedHeaders.length > 0) headers['access-control-allow-headers'] = config.allowedHeaders.join(', ');
    headers['access-control-max-age'] = String(config.maxAgeSeconds);
    if (config.allowCredentials) headers['access-control-allow-credentials'] = 'true';
    return { kind: 'preflight', status: 204, headers };
  }
  if (allowOrigin !== undefined) {
    headers['access-control-allow-origin'] = allowOrigin;
    if (config.allowCredentials) headers['access-control-allow-credentials'] = 'true';
  }
  return { kind: 'continue', headers };
}
```
:::

:::variant{kind=wrong name=no-preflight fails=tests reason="没有区分预检请求，OPTIONS 也被当作实际请求处理"}
```ts file=cors.ts
export type CorsConfig = {
  allowedOrigins: readonly string[];
  allowedMethods: readonly string[];
  allowedHeaders: readonly string[];
  allowCredentials: boolean;
  maxAgeSeconds: number;
};

export type CorsRequest = { method: string; headers: Record<string, string> };

export type CorsResult =
  | { kind: 'preflight'; status: 204 | 403; headers: Record<string, string> }
  | { kind: 'continue'; headers: Record<string, string> };

export function handleCors(request: CorsRequest, config: CorsConfig): CorsResult {
  const headers: Record<string, string> = { vary: 'Origin' };
  const origin = request.headers['origin'];
  if (origin === undefined) return { kind: 'continue', headers };
  if (config.allowedOrigins.includes(origin)) {
    headers['access-control-allow-origin'] = origin;
  } else if (config.allowedOrigins.includes('*') && !config.allowCredentials) {
    headers['access-control-allow-origin'] = '*';
  }
  if (headers['access-control-allow-origin'] !== undefined && config.allowCredentials) {
    headers['access-control-allow-credentials'] = 'true';
  }
  return { kind: 'continue', headers };
}
```
:::

:::variant{kind=wrong name=raw-header-list fails=tests reason="请求头列表没有去掉空白、统一大小写"}
```ts file=cors.ts
export type CorsConfig = {
  allowedOrigins: readonly string[];
  allowedMethods: readonly string[];
  allowedHeaders: readonly string[];
  allowCredentials: boolean;
  maxAgeSeconds: number;
};

export type CorsRequest = { method: string; headers: Record<string, string> };

export type CorsResult =
  | { kind: 'preflight'; status: 204 | 403; headers: Record<string, string> }
  | { kind: 'continue'; headers: Record<string, string> };

function allowOriginFor(origin: string, config: CorsConfig): string | undefined {
  if (config.allowedOrigins.includes(origin)) return origin;
  if (config.allowedOrigins.includes('*') && !config.allowCredentials) return '*';
  return undefined;
}

export function handleCors(request: CorsRequest, config: CorsConfig): CorsResult {
  const headers: Record<string, string> = { vary: 'Origin' };
  const origin = request.headers['origin'];
  if (origin === undefined) return { kind: 'continue', headers };
  const allowOrigin = allowOriginFor(origin, config);
  const requestedMethod = request.headers['access-control-request-method'];
  if (request.method === 'OPTIONS' && requestedMethod !== undefined) {
    const requestedText = request.headers['access-control-request-headers'];
    const requested = requestedText === undefined ? [] : requestedText.split(',');
    if (allowOrigin === undefined || !config.allowedMethods.includes(requestedMethod) || !requested.every((name) => config.allowedHeaders.includes(name))) {
      return { kind: 'preflight', status: 403, headers };
    }
    headers['access-control-allow-origin'] = allowOrigin;
    headers['access-control-allow-methods'] = config.allowedMethods.join(', ');
    if (config.allowedHeaders.length > 0) headers['access-control-allow-headers'] = config.allowedHeaders.join(', ');
    headers['access-control-max-age'] = String(config.maxAgeSeconds);
    if (config.allowCredentials) headers['access-control-allow-credentials'] = 'true';
    return { kind: 'preflight', status: 204, headers };
  }
  if (allowOrigin !== undefined) {
    headers['access-control-allow-origin'] = allowOrigin;
    if (config.allowCredentials) headers['access-control-allow-credentials'] = 'true';
  }
  return { kind: 'continue', headers };
}
```
:::
