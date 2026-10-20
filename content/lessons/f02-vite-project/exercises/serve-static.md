---
kind: challenge
title: 静态服务器：找文件、前端路由与缓存
---
`dist` 部署之后，静态服务器对每个请求要决定返回哪个文件、带什么缓存头。在 `server.ts` 中实现 `serveStatic(url, files)`。`files` 是 `dist` 中所有文件的路径（例如 `/index.html`、`/assets/index-wktXvZw9.js`、`/favicon.svg`），`url` 是请求的路径（以 `/` 开头，可能带 `?查询` 或 `#片段`）。

**找文件**，按顺序：

1. 去掉第一个 `?` 或 `#` 及其后面的内容，再用 `decodeURIComponent` 解码（`%E4%B8%AD` 是“中”）。解码失败（抛出 `URIError`），或者解码后的路径中有一段是 `..`，返回 404；
2. `files` 中正好有这个路径：返回它；
3. 路径以 `/` 结尾，并且 `路径 + 'index.html'` 存在：返回它（`/` 得到 `/index.html`）；
4. 路径的最后一段（最后一个 `/` 之后的部分）中没有 `.`，说明这是前端路由的地址（`/projects/42`）：返回 `/index.html`（不存在时 404）；
5. 其他情况（例如找不到的 `/assets/index-旧的哈希.js`）返回 404，**不要**返回 `index.html`。

**缓存头** `cacheControl`，按返回的文件决定：

- `.html` 文件：`no-cache`；
- 在 `/assets/` 中、文件名形如 `名字-哈希.扩展名` 的文件（哈希是正好 8 个字符，字母、数字、`_` 或 `-`；扩展名是字母和数字）：`public, max-age=31536000, immutable`；
- 其他文件（`public` 中复制过来的）：`public, max-age=3600`。

返回值是 `{ status: 200, file, cacheControl }` 或 `{ status: 404 }`，类型已经给出。

:::files{role=starter}
```ts file=server.ts
export type StaticResult = { status: 200; file: string; cacheControl: string } | { status: 404 };

export function serveStatic(url: string, files: ReadonlySet<string>): StaticResult {
  if (files.has(url)) return { status: 200, file: url, cacheControl: 'no-cache' };
  return { status: 404 };
}
```
```ts file=main.ts
import { serveStatic } from './server';

const dist = new Set(['/index.html', '/favicon.svg', '/icons.svg', '/assets/index-wktXvZw9.js', '/assets/index-CsUDhMuy.css']);

for (const url of ['/', '/projects/42?tab=files', '/assets/index-wktXvZw9.js', '/assets/index-OldHash1.js', '/favicon.svg']) {
  console.log(url, serveStatic(url, dist));
}
```
:::

:::files{role=solution}
```ts file=server.ts
export type StaticResult = { status: 200; file: string; cacheControl: string } | { status: 404 };

const NOT_FOUND: StaticResult = { status: 404 };
const HASHED_ASSET = /^\/assets\/.+-[A-Za-z0-9_-]{8}\.[A-Za-z0-9]+$/;

function cacheControlFor(file: string): string {
  if (file.endsWith('.html')) return 'no-cache';
  if (HASHED_ASSET.test(file)) return 'public, max-age=31536000, immutable';
  return 'public, max-age=3600';
}

/** 去掉查询和片段并解码；无效的路径返回 null */
function cleanPath(url: string): string | null {
  const end = url.search(/[?#]/);
  const raw = end === -1 ? url : url.slice(0, end);
  let path: string;
  try {
    path = decodeURIComponent(raw);
  } catch {
    return null; // URIError：不完整的 %xx
  }
  return path.split('/').includes('..') ? null : path;
}

function findFile(path: string, files: ReadonlySet<string>): string | null {
  if (files.has(path)) return path;
  if (path.endsWith('/') && files.has(`${path}index.html`)) return `${path}index.html`;
  const lastSegment = path.slice(path.lastIndexOf('/') + 1);
  // 没有扩展名：前端路由的地址，交给 index.html；有扩展名的资源找不到就是 404
  if (!lastSegment.includes('.') && files.has('/index.html')) return '/index.html';
  return null;
}

export function serveStatic(url: string, files: ReadonlySet<string>): StaticResult {
  const path = cleanPath(url);
  if (path === null) return NOT_FOUND;
  const file = findFile(path, files);
  if (file === null) return NOT_FOUND;
  return { status: 200, file, cacheControl: cacheControlFor(file) };
}
```
```ts file=main.ts
import { serveStatic } from './server';

const dist = new Set(['/index.html', '/favicon.svg', '/icons.svg', '/assets/index-wktXvZw9.js', '/assets/index-CsUDhMuy.css']);

for (const url of ['/', '/projects/42?tab=files', '/assets/index-wktXvZw9.js', '/assets/index-OldHash1.js', '/favicon.svg']) {
  console.log(url, serveStatic(url, dist));
}
```
:::

:::files{role=tests}
```ts file=server.test.ts
import { describe, expect, test } from 'vitest';
import { serveStatic } from './server';

const dist = new Set([
  '/index.html',
  '/favicon.svg',
  '/site-manifest.json',
  '/robots.txt',
  '/assets/index-wktXvZw9.js',
  '/assets/index-BN902Ne_.js',
  '/assets/index-CsUDhMuy.css',
  '/assets/react-dom-a1-B2c3d.js',
  '/assets/hero-CLDdwZDr.png',
  '/assets/logo.svg',
  '/docs/index.html',
  '/docs/guide.html',
  '/中文 说明.txt',
]);

const IMMUTABLE = 'public, max-age=31536000, immutable';
const HOUR = 'public, max-age=3600';
const page = (file: string) => ({ status: 200, file, cacheControl: 'no-cache' });

describe('找文件', () => {
  test('存在的文件直接返回', () => {
    expect(serveStatic('/assets/index-wktXvZw9.js', dist)).toEqual({ status: 200, file: '/assets/index-wktXvZw9.js', cacheControl: IMMUTABLE });
    expect(serveStatic('/robots.txt', dist)).toEqual({ status: 200, file: '/robots.txt', cacheControl: HOUR });
    expect(serveStatic('/docs/guide.html', dist)).toEqual(page('/docs/guide.html'));
  });

  test('以 / 结尾时找 index.html', () => {
    expect(serveStatic('/', dist)).toEqual(page('/index.html'));
    expect(serveStatic('/docs/', dist)).toEqual(page('/docs/index.html'));
  });

  test('去掉查询和片段', () => {
    expect(serveStatic('/?utm_source=mail', dist)).toEqual(page('/index.html'));
    expect(serveStatic('/favicon.svg?v=3', dist)).toMatchObject({ status: 200, file: '/favicon.svg' });
    expect(serveStatic('/robots.txt#top', dist)).toMatchObject({ status: 200, file: '/robots.txt' });
  });

  test('前端路由的地址返回 /index.html', () => {
    expect(serveStatic('/projects/42', dist)).toEqual(page('/index.html'));
    expect(serveStatic('/projects/42/?tab=files', dist)).toEqual(page('/index.html'));
    expect(serveStatic('/settings#theme', dist)).toEqual(page('/index.html'));
    expect(serveStatic('/projects/42', new Set(['/assets/index-wktXvZw9.js']))).toEqual({ status: 404 });
  });

  test('找不到的资源是 404，不是 index.html', () => {
    expect(serveStatic('/assets/index-OldHash1.js', dist)).toEqual({ status: 404 });
    expect(serveStatic('/missing.png', dist)).toEqual({ status: 404 });
    expect(serveStatic('/docs/missing.html', dist)).toEqual({ status: 404 });
  });

  test('解码；解码失败或者有 .. 时是 404', () => {
    expect(serveStatic('/%E4%B8%AD%E6%96%87%20%E8%AF%B4%E6%98%8E.txt', dist)).toMatchObject({ status: 200, file: '/中文 说明.txt' });
    expect(serveStatic('/%E4%B8%AD%E6', dist)).toEqual({ status: 404 });
    expect(serveStatic('/assets/../index.html', dist)).toEqual({ status: 404 });
    expect(serveStatic('/assets/%2E%2E/index.html', dist)).toEqual({ status: 404 });
    expect(serveStatic('/docs/..%2Findex.html', dist)).toEqual({ status: 404 });
  });
});

describe('缓存头', () => {
  test('带哈希的资源可以长期缓存', () => {
    for (const file of ['/assets/index-BN902Ne_.js', '/assets/index-CsUDhMuy.css', '/assets/react-dom-a1-B2c3d.js', '/assets/hero-CLDdwZDr.png']) {
      expect(serveStatic(file, dist), file).toMatchObject({ cacheControl: IMMUTABLE });
    }
  });

  test('没有哈希的、不在 /assets/ 中的文件只缓存一小时', () => {
    expect(serveStatic('/assets/logo.svg', dist)).toMatchObject({ cacheControl: HOUR });
    expect(serveStatic('/site-manifest.json', dist)).toMatchObject({ cacheControl: HOUR });
    expect(serveStatic('/favicon.svg', dist)).toMatchObject({ cacheControl: HOUR });
  });
});
```
```ts file=server.test-d.ts
import { expectTypeOf } from 'vitest';
import { serveStatic } from './server';

const result = serveStatic('/', new Set(['/index.html']));
if (result.status === 200) {
  expectTypeOf(result.file).toEqualTypeOf<string>();
} else {
  // @ts-expect-error 404 的结果中没有 file
  console.log(result.file);
}
```
:::

:::hint{level=1}
拆成三个小函数：`cleanPath(url)` 去掉查询、解码并检查 `..`（失败返回 `null`）；`findFile(path, files)` 按第 2–4 条依次尝试，找不到返回 `null`；`cacheControlFor(file)` 决定缓存头。`url.search(/[?#]/)` 能找到第一个 `?` 或 `#` 的位置。`decodeURIComponent` 遇到不完整的 `%xx` 会抛出异常，用 `try`/`catch` 接住。
:::

:::hint{level=2}
`..` 的检查要在**解码之后**做：`%2E%2E` 解码后就是 `..`。用 `path.split('/').includes('..')` 判断某一段是不是正好是 `..`（文件名 `a..b.txt` 不算）。带哈希的资源可以用一个正则判断：`/^\/assets\/.+-[A-Za-z0-9_-]{8}\.[A-Za-z0-9]+$/`。注意 `/site-manifest.json` 的 `manifest` 也是 8 个字母，所以“在 `/assets/` 中”这个条件不能省。
:::

:::explanation
这道题对应的是部署时最常见的两类问题。

**前端路由**：`/projects/42` 这样的地址只在浏览器中存在，服务器上没有这个文件。第 4 条规则让服务器在“找不到、并且看起来是页面”时返回 `index.html`，前端代码再根据地址显示内容。“看起来是页面”用的是一个简单的约定：最后一段没有扩展名。它也有代价：如果前端路由中有带点的地址（例如 `/users/ada.lovelace`），服务器会把它当作文件，返回 404。Vercel、Netlify 等平台的“重写”（rewrite）规则做的就是这件事，配置方式各不相同。

**找不到的资源返回 404**：发布新版本之后，还开着旧页面的用户可能会请求已经被删除的旧文件（`/assets/index-旧的哈希.js`）。如果服务器把 `index.html` 当作它返回，浏览器拿到的是 HTML，报出的错误是“模块脚本的 MIME 类型不对”，很难看出原因；返回 404 则一目了然。

**缓存**：带哈希的文件内容永远不会变（内容变了文件名就变），所以可以缓存一年并标记 `immutable`；`index.html` 用 `no-cache`（它的意思是“每次使用前都要向服务器确认”，而不是“不缓存”），保证用户总能拿到引用最新脚本的 `index.html`。`public` 中复制过来的文件没有哈希，内容可能在原来的名字下更新，只能缓存较短的时间。

**安全**：检查 `..` 是为了防止“路径穿越”，即用 `/assets/../../etc/passwd` 这样的请求读取 `dist` 之外的文件。真实的服务器会把路径规范化后检查它仍然在根目录之内，这里简化成直接拒绝。检查必须在解码之后：`%2E%2E` 解码之后就是 `..`。

返回类型是一个可辨识联合：只有 `status` 为 200 时才有 `file`，类型测试中对 404 的结果读取 `file` 会报错。
:::

:::variant{kind=alt name=url-parts}
```ts file=server.ts
export type StaticResult = { status: 200; file: string; cacheControl: string } | { status: 404 };

function decodePath(url: string): string | undefined {
  const [raw = ''] = url.split(/[?#]/, 1);
  try {
    const path = decodeURIComponent(raw);
    return path.split('/').some((segment) => segment === '..') ? undefined : path;
  } catch {
    return undefined;
  }
}

function candidates(path: string): string[] {
  const list = [path];
  if (path.endsWith('/')) list.push(path + 'index.html');
  const name = path.split('/').at(-1) ?? '';
  if (!name.includes('.')) list.push('/index.html');
  return list;
}

export function serveStatic(url: string, files: ReadonlySet<string>): StaticResult {
  const path = decodePath(url);
  if (path === undefined) return { status: 404 };
  const file = candidates(path).find((candidate) => files.has(candidate));
  if (file === undefined) return { status: 404 };
  const name = file.split('/').at(-1) ?? '';
  let cacheControl = 'public, max-age=3600';
  if (name.endsWith('.html')) cacheControl = 'no-cache';
  else if (file.startsWith('/assets/') && /-[\w-]{8}\.[a-z\d]+$/i.test(name)) cacheControl = 'public, max-age=31536000, immutable';
  return { status: 200, file, cacheControl };
}
```
:::

:::variant{kind=wrong name=fallback-everything fails=tests reason="所有找不到的请求都返回 index.html：旧的脚本、图片也拿到了 HTML"}
```ts file=server.ts
export type StaticResult = { status: 200; file: string; cacheControl: string } | { status: 404 };

const HASHED_ASSET = /^\/assets\/.+-[A-Za-z0-9_-]{8}\.[A-Za-z0-9]+$/;

function cacheControlFor(file: string): string {
  if (file.endsWith('.html')) return 'no-cache';
  if (HASHED_ASSET.test(file)) return 'public, max-age=31536000, immutable';
  return 'public, max-age=3600';
}

export function serveStatic(url: string, files: ReadonlySet<string>): StaticResult {
  const end = url.search(/[?#]/);
  let path: string;
  try {
    path = decodeURIComponent(end === -1 ? url : url.slice(0, end));
  } catch {
    return { status: 404 };
  }
  if (path.split('/').includes('..')) return { status: 404 };
  let file: string | null = null;
  if (files.has(path)) file = path;
  else if (path.endsWith('/') && files.has(`${path}index.html`)) file = `${path}index.html`;
  else if (files.has('/index.html')) file = '/index.html';
  return file === null ? { status: 404 } : { status: 200, file, cacheControl: cacheControlFor(file) };
}
```
:::

:::variant{kind=wrong name=no-route-fallback fails=tests reason="没有前端路由的回退：在 /projects/42 刷新页面得到 404"}
```ts file=server.ts
export type StaticResult = { status: 200; file: string; cacheControl: string } | { status: 404 };

const HASHED_ASSET = /^\/assets\/.+-[A-Za-z0-9_-]{8}\.[A-Za-z0-9]+$/;

function cacheControlFor(file: string): string {
  if (file.endsWith('.html')) return 'no-cache';
  if (HASHED_ASSET.test(file)) return 'public, max-age=31536000, immutable';
  return 'public, max-age=3600';
}

export function serveStatic(url: string, files: ReadonlySet<string>): StaticResult {
  const end = url.search(/[?#]/);
  let path: string;
  try {
    path = decodeURIComponent(end === -1 ? url : url.slice(0, end));
  } catch {
    return { status: 404 };
  }
  if (path.split('/').includes('..')) return { status: 404 };
  let file: string | null = null;
  if (files.has(path)) file = path;
  else if (path.endsWith('/') && files.has(`${path}index.html`)) file = `${path}index.html`;
  return file === null ? { status: 404 } : { status: 200, file, cacheControl: cacheControlFor(file) };
}
```
:::

:::variant{kind=wrong name=hash-anywhere fails=tests reason="只看文件名像不像带哈希，不管是否在 /assets/ 中：/site-manifest.json 被缓存了一年"}
```ts file=server.ts
export type StaticResult = { status: 200; file: string; cacheControl: string } | { status: 404 };

function cacheControlFor(file: string): string {
  if (file.endsWith('.html')) return 'no-cache';
  if (/-[A-Za-z0-9_-]{8}\.[A-Za-z0-9]+$/.test(file)) return 'public, max-age=31536000, immutable';
  return 'public, max-age=3600';
}

export function serveStatic(url: string, files: ReadonlySet<string>): StaticResult {
  const end = url.search(/[?#]/);
  let path: string;
  try {
    path = decodeURIComponent(end === -1 ? url : url.slice(0, end));
  } catch {
    return { status: 404 };
  }
  if (path.split('/').includes('..')) return { status: 404 };
  let file: string | null = null;
  if (files.has(path)) file = path;
  else if (path.endsWith('/') && files.has(`${path}index.html`)) file = `${path}index.html`;
  else if (!path.slice(path.lastIndexOf('/') + 1).includes('.') && files.has('/index.html')) file = '/index.html';
  return file === null ? { status: 404 } : { status: 200, file, cacheControl: cacheControlFor(file) };
}
```
:::

:::variant{kind=wrong name=check-before-decode fails=tests reason="解码之前检查 ..：%2E%2E 解码之后才变成 ..，没有被拦住"}
```ts file=server.ts
export type StaticResult = { status: 200; file: string; cacheControl: string } | { status: 404 };

const HASHED_ASSET = /^\/assets\/.+-[A-Za-z0-9_-]{8}\.[A-Za-z0-9]+$/;

function cacheControlFor(file: string): string {
  if (file.endsWith('.html')) return 'no-cache';
  if (HASHED_ASSET.test(file)) return 'public, max-age=31536000, immutable';
  return 'public, max-age=3600';
}

export function serveStatic(url: string, files: ReadonlySet<string>): StaticResult {
  const end = url.search(/[?#]/);
  const raw = end === -1 ? url : url.slice(0, end);
  if (raw.split('/').includes('..')) return { status: 404 };
  let path: string;
  try {
    path = decodeURIComponent(raw);
  } catch {
    return { status: 404 };
  }
  // 规范化路径：去掉 a/.. 这样的段
  const segments: string[] = [];
  for (const segment of path.split('/')) {
    if (segment === '..') segments.pop();
    else segments.push(segment);
  }
  path = segments.join('/') || '/';
  let file: string | null = null;
  if (files.has(path)) file = path;
  else if (path.endsWith('/') && files.has(`${path}index.html`)) file = `${path}index.html`;
  else if (!path.slice(path.lastIndexOf('/') + 1).includes('.') && files.has('/index.html')) file = '/index.html';
  return file === null ? { status: 404 } : { status: 200, file, cacheControl: cacheControlFor(file) };
}
```
:::

:::variant{kind=wrong name=immutable-html fails=tests reason="index.html 也被长期缓存：用户会一直拿着引用旧脚本的页面"}
```ts file=server.ts
export type StaticResult = { status: 200; file: string; cacheControl: string } | { status: 404 };

export function serveStatic(url: string, files: ReadonlySet<string>): StaticResult {
  const end = url.search(/[?#]/);
  let path: string;
  try {
    path = decodeURIComponent(end === -1 ? url : url.slice(0, end));
  } catch {
    return { status: 404 };
  }
  if (path.split('/').includes('..')) return { status: 404 };
  let file: string | null = null;
  if (files.has(path)) file = path;
  else if (path.endsWith('/') && files.has(`${path}index.html`)) file = `${path}index.html`;
  else if (!path.slice(path.lastIndexOf('/') + 1).includes('.') && files.has('/index.html')) file = '/index.html';
  if (file === null) return { status: 404 };
  const cacheControl = file.startsWith('/assets/') || file.endsWith('.html') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600';
  return { status: 200, file, cacheControl };
}
```
:::
