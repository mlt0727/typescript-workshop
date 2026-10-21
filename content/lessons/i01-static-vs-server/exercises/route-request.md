---
kind: challenge
title: 模拟部署平台的路由
---
在 `route.ts` 中实现 `routeRequest(deployment, url)`：模拟部署平台收到一个请求之后，决定由谁来处理它。`deployment` 描述一次部署：`dist` 中的静态文件、函数、重定向和改写的规则；`url` 是请求的路径，可能带有 `?查询参数`。`pattern.ts`（只读）是小任务的参考解。

按顺序处理（与 Vercel 的文档描述的顺序一致）：

1. **重定向**：按顺序找第一条 `source` 匹配路径的规则。返回 `{ kind: 'redirect', status, location }`：`permanent` 为 `false` 时 `status` 是 307，否则是 308；`location` 是把参数填进 `destination` 之后的地址，后面加上原来的查询参数（`?` 及其后面的部分，原样保留）；
2. **文件和函数**：路径正好是一个函数时，返回 `{ kind: 'function', path, query }`，`query` 是查询参数（名字 → 值）；路径正好是一个文件时，返回 `{ kind: 'file', path }`；路径加上 `/index.html`（路径以 `/` 结尾时直接加 `index.html`）是一个文件时，返回那个文件（`/` 得到 `/index.html`，`/sandbox` 和 `/sandbox/` 得到 `/sandbox/index.html`）；
3. **改写**：按顺序找第一条匹配的规则，把参数填进 `destination` 得到目标路径，再按第 2 步在文件和函数中查找它。目标是函数时，`query` 中除了请求的查询参数，还要加上匹配得到的参数（同名时用参数的值）。目标不存在时返回 404；
4. 都没有时返回 `{ kind: 'not-found' }`。

**把参数填进 `destination`**：其中的 `:名字*` 和 `:名字` 换成对应参数的值（`/help/:path*` 加上 `path` 为 `a/b` 得到 `/help/a/b`）。

本题的一处简化：第一条匹配的改写决定结果，它的目标不存在时直接是 404，不再尝试后面的规则（Vercel 的文档没有说明这种情况）。测试中“这个网站的部署”一组的期望结果，都与 2026-10-20 对线上实际请求的结果一致。

:::files{role=support}
```ts file=pattern.ts readonly
/** 匹配得到的参数：参数名 → 匹配到的文字 */
export type Params = Record<string, string>;

/**
 * 判断路径 pathname 是否匹配模式 pattern（vercel.json 中 source 的写法的一个子集）。
 * 匹配时返回参数，不匹配时返回 null。
 */
export function matchPattern(pattern: string, pathname: string): Params | null {
  if (pattern === '/') return pathname === '/' ? {} : null;
  const parts = pattern.split('/').slice(1);
  const segments = pathname.split('/').slice(1);
  const params: Params = {};
  for (const [i, part] of parts.entries()) {
    const last = i === parts.length - 1;
    const rest = segments.slice(i);
    if (last && part === '(.*)') {
      // 剩下的全部（可以为空，可以含有 /）
      params['0'] = rest.join('/');
      return params;
    }
    if (last && part.startsWith(':') && part.endsWith('*')) {
      // 零段或多段，每一段都不能为空
      if (rest.includes('')) return null;
      params[part.slice(1, -1)] = rest.join('/');
      return params;
    }
    const segment = segments[i];
    if (segment === undefined || segment === '') return null;
    if (part.startsWith(':')) params[part.slice(1)] = segment;
    else if (part !== segment) return null;
  }
  return segments.length === parts.length ? params : null;
}
```
:::

:::files{role=starter}
```ts file=route.ts
import { matchPattern, type Params } from './pattern';

export type Rule = { source: string; destination: string };
export type Redirect = Rule & { permanent?: boolean };

export type Deployment = {
  /** 静态文件，例如 '/index.html'、'/assets/index-wktXvZw9.js' */
  files: ReadonlySet<string>;
  /** 函数的路径，例如 '/api'（api/index.ts） */
  functions: ReadonlySet<string>;
  redirects?: readonly Redirect[];
  rewrites?: readonly Rule[];
};

export type Route =
  | { kind: 'redirect'; status: 307 | 308; location: string }
  | { kind: 'file'; path: string }
  | { kind: 'function'; path: string; query: Record<string, string> }
  | { kind: 'not-found' };

export function routeRequest(deployment: Deployment, url: string): Route {
  return deployment.files.has(url) ? { kind: 'file', path: url } : { kind: 'not-found' };
}
```
```ts file=main.ts
import { routeRequest, type Deployment } from './route';

const site: Deployment = {
  files: new Set(['/index.html', '/favicon.svg', '/sandbox/index.html']),
  functions: new Set(['/api']),
  rewrites: [
    { source: '/api/:path*', destination: '/api' },
    { source: '/learn/:lessonId', destination: '/index.html' },
    { source: '/settings', destination: '/index.html' },
  ],
};

for (const url of ['/', '/learn/a01-where-ts-runs', '/settings/', '/sandbox', '/api/health?x=1', '/nope']) {
  console.log(url.padEnd(26), routeRequest(site, url));
}
```
:::

:::files{role=solution}
```ts file=route.ts
import { matchPattern, type Params } from './pattern';

export type Rule = { source: string; destination: string };
export type Redirect = Rule & { permanent?: boolean };

export type Deployment = {
  /** 静态文件，例如 '/index.html'、'/assets/index-wktXvZw9.js' */
  files: ReadonlySet<string>;
  /** 函数的路径，例如 '/api'（api/index.ts） */
  functions: ReadonlySet<string>;
  redirects?: readonly Redirect[];
  rewrites?: readonly Rule[];
};

export type Route =
  | { kind: 'redirect'; status: 307 | 308; location: string }
  | { kind: 'file'; path: string }
  | { kind: 'function'; path: string; query: Record<string, string> }
  | { kind: 'not-found' };

/** 把 destination 中的 :名字*、:名字 换成参数的值 */
function fill(destination: string, params: Params): string {
  return destination.replace(/:(\w+)\*?/g, (whole, name: string) => params[name] ?? whole);
}

/** 在静态文件和函数中查找 path；找不到时返回 null */
function resolve(deployment: Deployment, path: string, query: Record<string, string>): Route | null {
  if (deployment.functions.has(path)) return { kind: 'function', path, query };
  if (deployment.files.has(path)) return { kind: 'file', path };
  // 文件夹中的 index.html：'/' → '/index.html'，'/sandbox' 和 '/sandbox/' → '/sandbox/index.html'
  const index = `${path.endsWith('/') ? path : `${path}/`}index.html`;
  if (deployment.files.has(index)) return { kind: 'file', path: index };
  return null;
}

export function routeRequest(deployment: Deployment, url: string): Route {
  const at = url.indexOf('?');
  const pathname = at === -1 ? url : url.slice(0, at);
  const search = at === -1 ? '' : url.slice(at);
  const query = Object.fromEntries(new URLSearchParams(search));

  // 1. 重定向：在一切之前
  for (const rule of deployment.redirects ?? []) {
    const params = matchPattern(rule.source, pathname);
    if (params !== null) return { kind: 'redirect', status: rule.permanent === false ? 307 : 308, location: fill(rule.destination, params) + search };
  }
  // 2. 文件系统：存在的文件和函数优先于改写
  const direct = resolve(deployment, pathname, query);
  if (direct !== null) return direct;
  // 3. 改写：第一条匹配的规则；参数也作为查询参数交给函数
  for (const rule of deployment.rewrites ?? []) {
    const params = matchPattern(rule.source, pathname);
    if (params !== null) return resolve(deployment, fill(rule.destination, params), { ...query, ...params }) ?? { kind: 'not-found' };
  }
  return { kind: 'not-found' };
}
```
```ts file=main.ts
import { routeRequest, type Deployment } from './route';

const site: Deployment = {
  files: new Set(['/index.html', '/favicon.svg', '/sandbox/index.html']),
  functions: new Set(['/api']),
  rewrites: [
    { source: '/api/:path*', destination: '/api' },
    { source: '/learn/:lessonId', destination: '/index.html' },
    { source: '/settings', destination: '/index.html' },
  ],
};

for (const url of ['/', '/learn/a01-where-ts-runs', '/settings/', '/sandbox', '/api/health?x=1', '/nope']) {
  console.log(url.padEnd(26), routeRequest(site, url));
}
```
:::

:::files{role=tests}
```ts file=route.test.ts
import { describe, expect, test } from 'vitest';
import { routeRequest, type Deployment } from './route';

/** 这个网站自己的部署（vercel.json 中的 rewrites，dist 中的部分文件，api/index.ts） */
const site: Deployment = {
  files: new Set(['/index.html', '/favicon.svg', '/assets/index-BN902Ne_.js', '/sandbox/index.html', '/sandbox/frame.js']),
  functions: new Set(['/api']),
  rewrites: [
    { source: '/api/:path*', destination: '/api' },
    { source: '/learn/:lessonId', destination: '/index.html' },
    { source: '/settings', destination: '/index.html' },
  ],
};

const file = (path: string) => ({ kind: 'file', path });
const notFound = { kind: 'not-found' };

describe('这个网站的部署（与 2026-10-20 在线上实际请求的结果一致）', () => {
  test('首页、课程页面、设置页都得到 index.html', () => {
    expect(routeRequest(site, '/')).toEqual(file('/index.html'));
    expect(routeRequest(site, '/learn/a01-where-ts-runs')).toEqual(file('/index.html'));
    expect(routeRequest(site, '/learn/a01-where-ts-runs?x=1')).toEqual(file('/index.html'));
    expect(routeRequest(site, '/settings')).toEqual(file('/index.html'));
  });

  test('静态文件直接返回；文件夹返回其中的 index.html', () => {
    expect(routeRequest(site, '/favicon.svg')).toEqual(file('/favicon.svg'));
    expect(routeRequest(site, '/index.html')).toEqual(file('/index.html'));
    expect(routeRequest(site, '/sandbox')).toEqual(file('/sandbox/index.html'));
    expect(routeRequest(site, '/sandbox/')).toEqual(file('/sandbox/index.html'));
  });

  test('没有规则匹配的地址是 404：大小写、结尾的 /、多出的一段都不行', () => {
    for (const url of ['/settings/', '/settings/x', '/Settings', '/learn/a01-where-ts-runs/', '/does-not-exist', '/assets/missing-abc123.js']) {
      expect(routeRequest(site, url), url).toEqual(notFound);
    }
  });

  test('/api/… 改写到函数 /api，参数和查询都交给它', () => {
    expect(routeRequest(site, '/api/health')).toEqual({ kind: 'function', path: '/api', query: { path: 'health' } });
    expect(routeRequest(site, '/api/sync?since=3')).toEqual({ kind: 'function', path: '/api', query: { since: '3', path: 'sync' } });
    expect(routeRequest(site, '/api')).toEqual({ kind: 'function', path: '/api', query: {} });
  });
});

describe('处理的顺序', () => {
  const spa: Deployment = {
    files: new Set(['/index.html', '/assets/app-1a2b3c4d.js']),
    functions: new Set(),
    rewrites: [{ source: '/(.*)', destination: '/index.html' }],
  };

  test('存在的文件优先于改写；SPA 的回退让其他地址都得到 index.html', () => {
    expect(routeRequest(spa, '/assets/app-1a2b3c4d.js')).toEqual(file('/assets/app-1a2b3c4d.js'));
    expect(routeRequest(spa, '/projects/42')).toEqual(file('/index.html'));
    // 回退的代价：找不到的资源也得到了 index.html（状态是 200，内容是 HTML）
    expect(routeRequest(spa, '/assets/app-OLD.js')).toEqual(file('/index.html'));
  });

  test('重定向最先处理：默认是永久（308），permanent: false 是临时（307）；参数填进目标，保留查询', () => {
    const moved: Deployment = {
      files: new Set(['/index.html']),
      functions: new Set(),
      redirects: [
        { source: '/old-blog/:slug', destination: '/blog/:slug' },
        { source: '/sale', destination: '/promotions/autumn', permanent: false },
      ],
      rewrites: [{ source: '/(.*)', destination: '/index.html' }],
    };
    expect(routeRequest(moved, '/old-blog/hello?ref=mail')).toEqual({ kind: 'redirect', status: 308, location: '/blog/hello?ref=mail' });
    expect(routeRequest(moved, '/sale')).toEqual({ kind: 'redirect', status: 307, location: '/promotions/autumn' });
  });

  test('第一条匹配的改写生效；改写的目标也不存在时是 404', () => {
    const deployment: Deployment = {
      files: new Set(['/a.html', '/b.html']),
      functions: new Set(['/api/sharp']),
      rewrites: [
        { source: '/page/:name', destination: '/:name.html' },
        { source: '/page/(.*)', destination: '/b.html' },
        { source: '/resize/:width/:height', destination: '/api/sharp' },
      ],
    };
    expect(routeRequest(deployment, '/page/a')).toEqual(file('/a.html'));
    expect(routeRequest(deployment, '/page/zzz')).toEqual(notFound);
    expect(routeRequest(deployment, '/page/x/y')).toEqual(file('/b.html'));
    expect(routeRequest(deployment, '/resize/800/600')).toEqual({ kind: 'function', path: '/api/sharp', query: { width: '800', height: '600' } });
  });

  test(':名字* 的参数填进目标中', () => {
    const docs: Deployment = {
      files: new Set(['/help/getting-started/install/index.html']),
      functions: new Set(),
      rewrites: [{ source: '/docs/:path*', destination: '/help/:path*' }],
    };
    expect(routeRequest(docs, '/docs/getting-started/install')).toEqual(file('/help/getting-started/install/index.html'));
  });
});
```
:::

:::hint{level=1}
先把 `url` 在第一个 `?` 处分成路径和查询部分，`Object.fromEntries(new URLSearchParams(查询部分))` 得到 `query`。然后写一个 `resolve(path, query)`：依次检查函数、文件、文件夹中的 `index.html`，找不到返回 `null`。主函数按“重定向 → `resolve(路径)` → 改写 → 404”的顺序调用它。
:::

:::hint{level=2}
填参数可以用一个正则：`destination.replace(/:(\w+)\*?/g, (whole, name: string) => params[name] ?? whole)`，它同时处理了 `:名字` 和 `:名字*`。改写交给函数时，`query` 写成 `{ ...query, ...params }`，参数在后面，同名时覆盖查询参数。文件夹的 `index.html`：`` `${path.endsWith('/') ? path : `${path}/`}index.html` ``。
:::

:::explanation
部署平台的路由是一个按顺序执行的流程，每一步都有它的理由：

- **重定向在最前面**：它的意思是“这个地址已经搬家了”，不应该再看旧地址上还有什么；
- **文件优先于改写**：这样单页应用的回退规则 `/(.*)` → `/index.html` 不会挡住真正的 JavaScript、CSS 和图片。但测试中也能看到它的代价：一个**不存在**的资源 `/assets/app-OLD.js` 也得到了 `index.html`，状态是 200，内容却是 HTML。浏览器把它当成 JavaScript 执行，报出语法错误，而不是一个清楚的 404。这就是为什么这个网站没有用 `/(.*)`，而是只为几个页面的地址（`/learn/:lessonId`、`/settings`）写了改写：其他找不到的地址都是真正的 404；
- **参数作为查询参数交给函数**：`/api/:path*` → `/api` 之后，函数从查询参数 `path` 知道请求的是 `/api/sync` 还是 `/api/health`。一条改写、一个函数，就处理了全部的接口。

测试中的第一组用的就是这个网站的 `vercel.json`。以后部署自己的网站时，可以用同样的方法检查：对线上实际请求几个地址（包括带结尾斜杠的、大小写不同的、不存在的），看看状态码和内容类型是不是你期望的。
:::

:::variant{kind=alt name=url-and-phases}
```ts file=route.ts
import { matchPattern } from './pattern';

export type Rule = { source: string; destination: string };
export type Redirect = Rule & { permanent?: boolean };

export type Deployment = {
  /** 静态文件，例如 '/index.html'、'/assets/index-wktXvZw9.js' */
  files: ReadonlySet<string>;
  /** 函数的路径，例如 '/api'（api/index.ts） */
  functions: ReadonlySet<string>;
  redirects?: readonly Redirect[];
  rewrites?: readonly Rule[];
};

export type Route =
  | { kind: 'redirect'; status: 307 | 308; location: string }
  | { kind: 'file'; path: string }
  | { kind: 'function'; path: string; query: Record<string, string> }
  | { kind: 'not-found' };

const NOT_FOUND: Route = { kind: 'not-found' };

/** 找到第一条匹配的规则，并把参数填进它的目标 */
function firstMatch<R extends Rule>(rules: readonly R[], pathname: string) {
  for (const rule of rules) {
    const params = matchPattern(rule.source, pathname);
    if (params === null) continue;
    const target = rule.destination.replace(/:(\w+)\*?/g, (whole, name: string) => params[name] ?? whole);
    return { rule, params, target };
  }
  return null;
}

export function routeRequest({ files, functions, redirects = [], rewrites = [] }: Deployment, url: string): Route {
  // 用一个虚构的来源解析，只取路径和查询（与网站真正的域名无关）
  const parsed = new URL(url, 'https://example.invalid');
  const pathname = parsed.pathname;
  const query: Record<string, string> = {};
  parsed.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  const lookup = (path: string, extra: Record<string, string>): Route | null => {
    if (functions.has(path)) return { kind: 'function', path, query: { ...query, ...extra } };
    for (const candidate of [path, path.endsWith('/') ? `${path}index.html` : `${path}/index.html`]) {
      if (files.has(candidate)) return { kind: 'file', path: candidate };
    }
    return null;
  };

  const redirect = firstMatch(redirects, pathname);
  if (redirect) return { kind: 'redirect', status: redirect.rule.permanent === false ? 307 : 308, location: redirect.target + parsed.search };

  const direct = lookup(pathname, {});
  if (direct) return direct;

  const rewrite = firstMatch(rewrites, pathname);
  return rewrite ? (lookup(rewrite.target, rewrite.params) ?? NOT_FOUND) : NOT_FOUND;
}
```
```ts file=main.ts
import { routeRequest, type Deployment } from './route';

const site: Deployment = {
  files: new Set(['/index.html', '/favicon.svg', '/sandbox/index.html']),
  functions: new Set(['/api']),
  rewrites: [
    { source: '/api/:path*', destination: '/api' },
    { source: '/learn/:lessonId', destination: '/index.html' },
    { source: '/settings', destination: '/index.html' },
  ],
};

for (const url of ['/', '/learn/a01-where-ts-runs', '/settings/', '/sandbox', '/api/health?x=1', '/nope']) {
  console.log(url.padEnd(26), routeRequest(site, url));
}
```
:::

:::variant{kind=wrong name=rewrites-first fails=tests reason="先看改写再看文件：SPA 的回退规则挡住了真正的 JavaScript 文件，/assets/app-1a2b3c4d.js 也得到了 index.html"}
```ts file=route.ts
import { matchPattern, type Params } from './pattern';

export type Rule = { source: string; destination: string };
export type Redirect = Rule & { permanent?: boolean };

export type Deployment = {
  /** 静态文件，例如 '/index.html'、'/assets/index-wktXvZw9.js' */
  files: ReadonlySet<string>;
  /** 函数的路径，例如 '/api'（api/index.ts） */
  functions: ReadonlySet<string>;
  redirects?: readonly Redirect[];
  rewrites?: readonly Rule[];
};

export type Route =
  | { kind: 'redirect'; status: 307 | 308; location: string }
  | { kind: 'file'; path: string }
  | { kind: 'function'; path: string; query: Record<string, string> }
  | { kind: 'not-found' };

/** 把 destination 中的 :名字*、:名字 换成参数的值 */
function fill(destination: string, params: Params): string {
  return destination.replace(/:(\w+)\*?/g, (whole, name: string) => params[name] ?? whole);
}

/** 在静态文件和函数中查找 path；找不到时返回 null */
function resolve(deployment: Deployment, path: string, query: Record<string, string>): Route | null {
  if (deployment.functions.has(path)) return { kind: 'function', path, query };
  if (deployment.files.has(path)) return { kind: 'file', path };
  // 文件夹中的 index.html：'/' → '/index.html'，'/sandbox' 和 '/sandbox/' → '/sandbox/index.html'
  const index = `${path.endsWith('/') ? path : `${path}/`}index.html`;
  if (deployment.files.has(index)) return { kind: 'file', path: index };
  return null;
}

export function routeRequest(deployment: Deployment, url: string): Route {
  const at = url.indexOf('?');
  const pathname = at === -1 ? url : url.slice(0, at);
  const search = at === -1 ? '' : url.slice(at);
  const query = Object.fromEntries(new URLSearchParams(search));

  // 1. 重定向：在一切之前
  for (const rule of deployment.redirects ?? []) {
    const params = matchPattern(rule.source, pathname);
    if (params !== null) return { kind: 'redirect', status: rule.permanent === false ? 307 : 308, location: fill(rule.destination, params) + search };
  }
  // 先看改写，再看文件
  for (const rule of deployment.rewrites ?? []) {
    const params = matchPattern(rule.source, pathname);
    if (params !== null) return resolve(deployment, fill(rule.destination, params), { ...query, ...params }) ?? { kind: 'not-found' };
  }
  return resolve(deployment, pathname, query) ?? { kind: 'not-found' };
}
```
```ts file=main.ts
import { routeRequest, type Deployment } from './route';

const site: Deployment = {
  files: new Set(['/index.html', '/favicon.svg', '/sandbox/index.html']),
  functions: new Set(['/api']),
  rewrites: [
    { source: '/api/:path*', destination: '/api' },
    { source: '/learn/:lessonId', destination: '/index.html' },
    { source: '/settings', destination: '/index.html' },
  ],
};

for (const url of ['/', '/learn/a01-where-ts-runs', '/settings/', '/sandbox', '/api/health?x=1', '/nope']) {
  console.log(url.padEnd(26), routeRequest(site, url));
}
```
:::

:::variant{kind=wrong name=no-dir-index fails=tests reason="只处理了首页的 index.html：/sandbox 和 /sandbox/ 没有找到文件夹中的 index.html"}
```ts file=route.ts
import { matchPattern, type Params } from './pattern';

export type Rule = { source: string; destination: string };
export type Redirect = Rule & { permanent?: boolean };

export type Deployment = {
  /** 静态文件，例如 '/index.html'、'/assets/index-wktXvZw9.js' */
  files: ReadonlySet<string>;
  /** 函数的路径，例如 '/api'（api/index.ts） */
  functions: ReadonlySet<string>;
  redirects?: readonly Redirect[];
  rewrites?: readonly Rule[];
};

export type Route =
  | { kind: 'redirect'; status: 307 | 308; location: string }
  | { kind: 'file'; path: string }
  | { kind: 'function'; path: string; query: Record<string, string> }
  | { kind: 'not-found' };

/** 把 destination 中的 :名字*、:名字 换成参数的值 */
function fill(destination: string, params: Params): string {
  return destination.replace(/:(\w+)\*?/g, (whole, name: string) => params[name] ?? whole);
}

/** 在静态文件和函数中查找 path；找不到时返回 null */
function resolve(deployment: Deployment, path: string, query: Record<string, string>): Route | null {
  if (deployment.functions.has(path)) return { kind: 'function', path, query };
  if (deployment.files.has(path)) return { kind: 'file', path };
  if (path === '/' && deployment.files.has('/index.html')) return { kind: 'file', path: '/index.html' };
  return null;
}

export function routeRequest(deployment: Deployment, url: string): Route {
  const at = url.indexOf('?');
  const pathname = at === -1 ? url : url.slice(0, at);
  const search = at === -1 ? '' : url.slice(at);
  const query = Object.fromEntries(new URLSearchParams(search));

  // 1. 重定向：在一切之前
  for (const rule of deployment.redirects ?? []) {
    const params = matchPattern(rule.source, pathname);
    if (params !== null) return { kind: 'redirect', status: rule.permanent === false ? 307 : 308, location: fill(rule.destination, params) + search };
  }
  // 2. 文件系统：存在的文件和函数优先于改写
  const direct = resolve(deployment, pathname, query);
  if (direct !== null) return direct;
  // 3. 改写：第一条匹配的规则；参数也作为查询参数交给函数
  for (const rule of deployment.rewrites ?? []) {
    const params = matchPattern(rule.source, pathname);
    if (params !== null) return resolve(deployment, fill(rule.destination, params), { ...query, ...params }) ?? { kind: 'not-found' };
  }
  return { kind: 'not-found' };
}
```
```ts file=main.ts
import { routeRequest, type Deployment } from './route';

const site: Deployment = {
  files: new Set(['/index.html', '/favicon.svg', '/sandbox/index.html']),
  functions: new Set(['/api']),
  rewrites: [
    { source: '/api/:path*', destination: '/api' },
    { source: '/learn/:lessonId', destination: '/index.html' },
    { source: '/settings', destination: '/index.html' },
  ],
};

for (const url of ['/', '/learn/a01-where-ts-runs', '/settings/', '/sandbox', '/api/health?x=1', '/nope']) {
  console.log(url.padEnd(26), routeRequest(site, url));
}
```
:::

:::variant{kind=wrong name=drop-params fails=tests reason="改写到函数时没有把参数交给它：函数不知道请求的是 /api/sync 还是 /api/health"}
```ts file=route.ts
import { matchPattern, type Params } from './pattern';

export type Rule = { source: string; destination: string };
export type Redirect = Rule & { permanent?: boolean };

export type Deployment = {
  /** 静态文件，例如 '/index.html'、'/assets/index-wktXvZw9.js' */
  files: ReadonlySet<string>;
  /** 函数的路径，例如 '/api'（api/index.ts） */
  functions: ReadonlySet<string>;
  redirects?: readonly Redirect[];
  rewrites?: readonly Rule[];
};

export type Route =
  | { kind: 'redirect'; status: 307 | 308; location: string }
  | { kind: 'file'; path: string }
  | { kind: 'function'; path: string; query: Record<string, string> }
  | { kind: 'not-found' };

/** 把 destination 中的 :名字*、:名字 换成参数的值 */
function fill(destination: string, params: Params): string {
  return destination.replace(/:(\w+)\*?/g, (whole, name: string) => params[name] ?? whole);
}

/** 在静态文件和函数中查找 path；找不到时返回 null */
function resolve(deployment: Deployment, path: string, query: Record<string, string>): Route | null {
  if (deployment.functions.has(path)) return { kind: 'function', path, query };
  if (deployment.files.has(path)) return { kind: 'file', path };
  // 文件夹中的 index.html：'/' → '/index.html'，'/sandbox' 和 '/sandbox/' → '/sandbox/index.html'
  const index = `${path.endsWith('/') ? path : `${path}/`}index.html`;
  if (deployment.files.has(index)) return { kind: 'file', path: index };
  return null;
}

export function routeRequest(deployment: Deployment, url: string): Route {
  const at = url.indexOf('?');
  const pathname = at === -1 ? url : url.slice(0, at);
  const search = at === -1 ? '' : url.slice(at);
  const query = Object.fromEntries(new URLSearchParams(search));

  // 1. 重定向：在一切之前
  for (const rule of deployment.redirects ?? []) {
    const params = matchPattern(rule.source, pathname);
    if (params !== null) return { kind: 'redirect', status: rule.permanent === false ? 307 : 308, location: fill(rule.destination, params) + search };
  }
  // 2. 文件系统：存在的文件和函数优先于改写
  const direct = resolve(deployment, pathname, query);
  if (direct !== null) return direct;
  // 3. 改写：第一条匹配的规则；参数也作为查询参数交给函数
  for (const rule of deployment.rewrites ?? []) {
    const params = matchPattern(rule.source, pathname);
    if (params !== null) return resolve(deployment, fill(rule.destination, params), query) ?? { kind: 'not-found' };
  }
  return { kind: 'not-found' };
}
```
```ts file=main.ts
import { routeRequest, type Deployment } from './route';

const site: Deployment = {
  files: new Set(['/index.html', '/favicon.svg', '/sandbox/index.html']),
  functions: new Set(['/api']),
  rewrites: [
    { source: '/api/:path*', destination: '/api' },
    { source: '/learn/:lessonId', destination: '/index.html' },
    { source: '/settings', destination: '/index.html' },
  ],
};

for (const url of ['/', '/learn/a01-where-ts-runs', '/settings/', '/sandbox', '/api/health?x=1', '/nope']) {
  console.log(url.padEnd(26), routeRequest(site, url));
}
```
:::
