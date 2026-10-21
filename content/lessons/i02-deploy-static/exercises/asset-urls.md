---
kind: task
title: 解析页面引用的资源地址
---
在 `assets.ts` 中实现 `assetUrls(pageUrl, html)`：找出页面的 HTML 中引用的脚本和样式表，按页面的地址把它们解析成完整的地址。浏览器加载这个页面时，请求的就是这些地址。

1. `<script>` 标签的 `src` 是脚本（`kind: 'script'`）；`<link>` 标签中，`rel` 含有 `stylesheet` 的是样式表，含有 `modulepreload` 的也是脚本（Vite 用它预先加载拆分出来的模块）。`rel` 可能有多个用空白分开的值，不区分大小写。其他的标签和其他的 `<link>`（图标、`preconnect`）不算；
2. 属性的值用双引号或者单引号括起来；没有 `src`（内联的脚本）或者值为空的不算；
3. 用 `new URL(地址, pageUrl)` 解析。只保留 `http:` 和 `https:` 的地址（`data:` 这类不算），去掉 `#` 及其后面的部分，保留查询参数；
4. 按在 HTML 中出现的顺序返回 `{ kind, url }`；同一种类、同一个地址只保留第一次。

（这里用正则查找标签，对 Vite 生成的 `index.html` 足够了；它并不是一个完整的 HTML 解析器。）

:::files{role=starter}
```ts file=assets.ts
export type Asset = { kind: 'script' | 'stylesheet'; url: string };

/**
 * 页面 pageUrl 的 HTML 中引用的脚本和样式表，按出现的顺序，解析成完整的地址。
 * 只看 <script src> 和 rel 为 stylesheet、modulepreload 的 <link href>。
 */
export function assetUrls(pageUrl: string, html: string): Asset[] {
  const src = /src="([^"]+)"/.exec(html)?.[1];
  return src === undefined ? [] : [{ kind: 'script', url: src }];
}
```
```ts file=main.ts
import { assetUrls } from './assets';

const html = '<script type="module" crossorigin src="./assets/index-BSa2dRPq.js"></script><link rel="stylesheet" href="./assets/index.css">';
for (const page of ['https://shop.example/', 'https://shop.example/products', 'https://shop.example/products/205']) {
  console.log(page.padEnd(34), assetUrls(page, html).map((a) => a.url));
}
```
:::

:::files{role=solution}
```ts file=assets.ts
export type Asset = { kind: 'script' | 'stylesheet'; url: string };

/** 一个标签中某个属性的值（双引号或单引号） */
function attribute(tag: string, name: string): string | undefined {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag);
  return match === null ? undefined : (match[1] ?? match[2]);
}

/**
 * 页面 pageUrl 的 HTML 中引用的脚本和样式表，按出现的顺序，解析成完整的地址。
 * 只看 <script src> 和 rel 为 stylesheet、modulepreload 的 <link href>。
 */
export function assetUrls(pageUrl: string, html: string): Asset[] {
  const assets: Asset[] = [];
  for (const match of html.matchAll(/<(script|link)\b[^>]*>/gi)) {
    const tag = match[0];
    const name = (match[1] ?? '').toLowerCase();
    let kind: Asset['kind'] | undefined;
    let ref: string | undefined;
    if (name === 'script') {
      kind = 'script';
      ref = attribute(tag, 'src');
    } else {
      const rel = (attribute(tag, 'rel') ?? '').toLowerCase().split(/\s+/);
      if (rel.includes('stylesheet')) kind = 'stylesheet';
      else if (rel.includes('modulepreload')) kind = 'script';
      ref = attribute(tag, 'href');
    }
    if (kind === undefined || ref === undefined || ref.trim() === '') continue;
    const url = new URL(ref.trim(), pageUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
    url.hash = '';
    const href = url.href;
    if (!assets.some((a) => a.kind === kind && a.url === href)) assets.push({ kind, url: href });
  }
  return assets;
}
```
```ts file=main.ts
import { assetUrls } from './assets';

const html = '<script type="module" crossorigin src="./assets/index-BSa2dRPq.js"></script><link rel="stylesheet" href="./assets/index.css">';
for (const page of ['https://shop.example/', 'https://shop.example/products', 'https://shop.example/products/205']) {
  console.log(page.padEnd(34), assetUrls(page, html).map((a) => a.url));
}
```
:::

:::files{role=tests}
```ts file=assets.test.ts
import { describe, expect, test } from 'vitest';
import { assetUrls } from './assets';

// vite build 实际生成的 index.html（base 为 / 和 ./ 时）
const rootHtml = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>商店的路由</title>
    <script type="module" crossorigin src="/assets/index-CMnIaEjP.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-D8J8pCed.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
const relativeHtml = rootHtml.replaceAll('"/assets/', '"./assets/');

describe('assetUrls', () => {
  test('脚本和样式表，按出现的顺序，解析成完整的地址', () => {
    expect(assetUrls('https://shop.example/products/205', rootHtml)).toEqual([
      { kind: 'script', url: 'https://shop.example/assets/index-CMnIaEjP.js' },
      { kind: 'stylesheet', url: 'https://shop.example/assets/index-D8J8pCed.css' },
    ]);
  });

  test('相对路径相对于页面的地址：深层的地址上指到了别的文件夹', () => {
    expect(assetUrls('https://shop.example/', relativeHtml).map((a) => a.url)).toEqual(['https://shop.example/assets/index-CMnIaEjP.js', 'https://shop.example/assets/index-D8J8pCed.css']);
    expect(assetUrls('https://shop.example/products', relativeHtml)[0]?.url).toBe('https://shop.example/assets/index-CMnIaEjP.js');
    expect(assetUrls('https://shop.example/products/205', relativeHtml)[0]?.url).toBe('https://shop.example/products/assets/index-CMnIaEjP.js');
    expect(assetUrls('https://shop.example/products/', relativeHtml)[0]?.url).toBe('https://shop.example/products/assets/index-CMnIaEjP.js');
  });

  test('部署在子路径上：以 / 开头的地址从网站的根开始', () => {
    expect(assetUrls('https://user.github.io/shop/', rootHtml)[0]?.url).toBe('https://user.github.io/assets/index-CMnIaEjP.js');
    expect(assetUrls('https://user.github.io/shop/', rootHtml.replaceAll('"/assets/', '"/shop/assets/'))[0]?.url).toBe('https://user.github.io/shop/assets/index-CMnIaEjP.js');
  });

  test('modulepreload 也是脚本；其他的 link（图标、preconnect）不算', () => {
    const html = `<link rel="icon" href="/favicon.svg"><link rel="preconnect" href="https://fonts.example"><link rel="modulepreload" crossorigin href="/assets/react-B2c3d4e5.js"><link rel="Stylesheet" href="/a.css">`;
    expect(assetUrls('https://shop.example/', html)).toEqual([
      { kind: 'script', url: 'https://shop.example/assets/react-B2c3d4e5.js' },
      { kind: 'stylesheet', url: 'https://shop.example/a.css' },
    ]);
  });

  test('单引号也可以；没有 src 的内联脚本、data: 地址不算；去掉 #，保留查询参数，重复的只算一次', () => {
    const html = `<script>console.log(1)</script><script src='/app.js?v=3#x'></script><script type="module" src="/app.js?v=3"></script><link rel="stylesheet" href="data:text/css,body{}"><link rel='stylesheet' href='/print.css'><script src="https://cdn.example/lib.js"></script>`;
    expect(assetUrls('https://shop.example/', html)).toEqual([
      { kind: 'script', url: 'https://shop.example/app.js?v=3' },
      { kind: 'stylesheet', url: 'https://shop.example/print.css' },
      { kind: 'script', url: 'https://cdn.example/lib.js' },
    ]);
  });

  test('没有引用任何资源时是空数组', () => {
    expect(assetUrls('https://shop.example/', '<p>你好</p>')).toEqual([]);
  });
});
```
```ts file=assets.test-d.ts
import { expectTypeOf } from 'vitest';
import { assetUrls, type Asset } from './assets';

expectTypeOf(assetUrls).returns.toEqualTypeOf<Asset[]>();
expectTypeOf<Asset['kind']>().toEqualTypeOf<'script' | 'stylesheet'>();
```
:::

:::hint{level=1}
先用 `html.matchAll(/<(script|link)\b[^>]*>/gi)` 找出每一个开始标签，再从标签中取出需要的属性。取属性可以写一个小函数：用 `new RegExp(...)` 拼出 `\s名字\s*=\s*(?:"([^"]*)"|'([^']*)')` 这样的正则，两个分组分别是双引号和单引号的情况。
:::

:::hint{level=2}
`rel` 的值先转成小写，再 `split(/\s+/)`，用 `includes('stylesheet')` 判断，这样 `rel="Stylesheet"`、`rel="preload stylesheet"` 都能处理。解析之后的 `URL` 对象可以直接修改：`url.hash = ''` 去掉片段，`url.protocol` 是 `'https:'` 这样带冒号的字符串。
:::

:::explanation
这道题的核心只有一行：`new URL(地址, pageUrl)`。浏览器解析 HTML 中的每一个地址时，用的都是这个规则：

- 以 `/` 开头：从网站的根开始，与页面在哪一层无关；
- 以 `./` 开头（或者直接是 `assets/…`）：相对于页面所在的“文件夹”。`/products/205` 的文件夹是 `/products/`，`/products` 的文件夹是 `/`。所以 `base: './'` 在第一层的页面上正常，在第二层就错了；
- 完整的地址（`https://cdn.example/…`）保持不变。

正文中实测到的三个问题，用这个函数都能直接看出来：只要把部署之后的页面地址和它的 HTML 交给它，就能看到浏览器会去请求哪些地址，再和 `dist` 中实际的文件比较。编程挑战把这一步变成真正的请求。

去掉 `#` 是因为片段不会发给服务器；查询参数会发给服务器（有的项目用 `?v=3` 让浏览器重新下载），所以保留。
:::

:::variant{kind=alt name=attribute-map}
```ts file=assets.ts
export type Asset = { kind: 'script' | 'stylesheet'; url: string };

/** 把一个开始标签中的属性读成 Map（名字都转成小写） */
function attributes(tag: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const m of tag.matchAll(/\s([a-zA-Z-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g)) {
    const [, name = '', double, single] = m;
    result.set(name.toLowerCase(), double ?? single ?? '');
  }
  return result;
}

export function assetUrls(pageUrl: string, html: string): Asset[] {
  const found = new Map<string, Asset>();
  for (const m of html.matchAll(/<(script|link)(\s[^>]*)?>/gi)) {
    const attrs = attributes(m[2] ?? '');
    const isScript = (m[1] ?? '').toLowerCase() === 'script';
    const rels = (attrs.get('rel') ?? '').toLowerCase().split(/\s+/);
    const kind = isScript ? 'script' : rels.includes('stylesheet') ? 'stylesheet' : rels.includes('modulepreload') ? 'script' : null;
    const ref = (isScript ? attrs.get('src') : attrs.get('href'))?.trim();
    if (kind === null || !ref) continue;
    const url = new URL(ref, pageUrl);
    if (!url.protocol.startsWith('http')) continue;
    url.hash = '';
    const key = `${kind} ${url.href}`;
    if (!found.has(key)) found.set(key, { kind, url: url.href });
  }
  return [...found.values()];
}
```
```ts file=main.ts
import { assetUrls } from './assets';

const html = '<script type="module" crossorigin src="./assets/index-BSa2dRPq.js"></script><link rel="stylesheet" href="./assets/index.css">';
for (const page of ['https://shop.example/', 'https://shop.example/products', 'https://shop.example/products/205']) {
  console.log(page.padEnd(34), assetUrls(page, html).map((a) => a.url));
}
```
:::

:::variant{kind=wrong name=from-origin fails=tests reason="相对于网站的根解析：./assets/… 在任何页面上都变成了 /assets/…，看不出深层页面上的问题"}
```ts file=assets.ts
export type Asset = { kind: 'script' | 'stylesheet'; url: string };

/** 一个标签中某个属性的值（双引号或单引号） */
function attribute(tag: string, name: string): string | undefined {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag);
  return match === null ? undefined : (match[1] ?? match[2]);
}

/**
 * 页面 pageUrl 的 HTML 中引用的脚本和样式表，按出现的顺序，解析成完整的地址。
 * 只看 <script src> 和 rel 为 stylesheet、modulepreload 的 <link href>。
 */
export function assetUrls(pageUrl: string, html: string): Asset[] {
  const assets: Asset[] = [];
  for (const match of html.matchAll(/<(script|link)\b[^>]*>/gi)) {
    const tag = match[0];
    const name = (match[1] ?? '').toLowerCase();
    let kind: Asset['kind'] | undefined;
    let ref: string | undefined;
    if (name === 'script') {
      kind = 'script';
      ref = attribute(tag, 'src');
    } else {
      const rel = (attribute(tag, 'rel') ?? '').toLowerCase().split(/\s+/);
      if (rel.includes('stylesheet')) kind = 'stylesheet';
      else if (rel.includes('modulepreload')) kind = 'script';
      ref = attribute(tag, 'href');
    }
    if (kind === undefined || ref === undefined || ref.trim() === '') continue;
    // 相对于网站的根，而不是相对于页面
    const url = new URL(ref.trim(), new URL(pageUrl).origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
    url.hash = '';
    const href = url.href;
    if (!assets.some((a) => a.kind === kind && a.url === href)) assets.push({ kind, url: href });
  }
  return assets;
}
```
```ts file=main.ts
import { assetUrls } from './assets';

const html = '<script type="module" crossorigin src="./assets/index-BSa2dRPq.js"></script><link rel="stylesheet" href="./assets/index.css">';
for (const page of ['https://shop.example/', 'https://shop.example/products', 'https://shop.example/products/205']) {
  console.log(page.padEnd(34), assetUrls(page, html).map((a) => a.url));
}
```
:::

:::variant{kind=wrong name=double-quotes-only fails=tests reason="只认双引号：src='/app.js' 这样用单引号的地址没有找到"}
```ts file=assets.ts
export type Asset = { kind: 'script' | 'stylesheet'; url: string };

/** 一个标签中某个属性的值（双引号或单引号） */
function attribute(tag: string, name: string): string | undefined {
  const match = new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i').exec(tag);
  return match === null ? undefined : match[1];
}

/**
 * 页面 pageUrl 的 HTML 中引用的脚本和样式表，按出现的顺序，解析成完整的地址。
 * 只看 <script src> 和 rel 为 stylesheet、modulepreload 的 <link href>。
 */
export function assetUrls(pageUrl: string, html: string): Asset[] {
  const assets: Asset[] = [];
  for (const match of html.matchAll(/<(script|link)\b[^>]*>/gi)) {
    const tag = match[0];
    const name = (match[1] ?? '').toLowerCase();
    let kind: Asset['kind'] | undefined;
    let ref: string | undefined;
    if (name === 'script') {
      kind = 'script';
      ref = attribute(tag, 'src');
    } else {
      const rel = (attribute(tag, 'rel') ?? '').toLowerCase().split(/\s+/);
      if (rel.includes('stylesheet')) kind = 'stylesheet';
      else if (rel.includes('modulepreload')) kind = 'script';
      ref = attribute(tag, 'href');
    }
    if (kind === undefined || ref === undefined || ref.trim() === '') continue;
    const url = new URL(ref.trim(), pageUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
    url.hash = '';
    const href = url.href;
    if (!assets.some((a) => a.kind === kind && a.url === href)) assets.push({ kind, url: href });
  }
  return assets;
}
```
```ts file=main.ts
import { assetUrls } from './assets';

const html = '<script type="module" crossorigin src="./assets/index-BSa2dRPq.js"></script><link rel="stylesheet" href="./assets/index.css">';
for (const page of ['https://shop.example/', 'https://shop.example/products', 'https://shop.example/products/205']) {
  console.log(page.padEnd(34), assetUrls(page, html).map((a) => a.url));
}
```
:::

:::variant{kind=wrong name=every-link fails=tests reason="把所有的 link 都当成了样式表：图标和 preconnect 也被算进去了"}
```ts file=assets.ts
export type Asset = { kind: 'script' | 'stylesheet'; url: string };

/** 一个标签中某个属性的值（双引号或单引号） */
function attribute(tag: string, name: string): string | undefined {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag);
  return match === null ? undefined : (match[1] ?? match[2]);
}

/**
 * 页面 pageUrl 的 HTML 中引用的脚本和样式表，按出现的顺序，解析成完整的地址。
 * 只看 <script src> 和 rel 为 stylesheet、modulepreload 的 <link href>。
 */
export function assetUrls(pageUrl: string, html: string): Asset[] {
  const assets: Asset[] = [];
  for (const match of html.matchAll(/<(script|link)\b[^>]*>/gi)) {
    const tag = match[0];
    const name = (match[1] ?? '').toLowerCase();
    let kind: Asset['kind'] | undefined;
    let ref: string | undefined;
    if (name === 'script') {
      kind = 'script';
      ref = attribute(tag, 'src');
    } else {
      const rel = (attribute(tag, 'rel') ?? '').toLowerCase().split(/\s+/);
      kind = rel.includes('modulepreload') ? 'script' : 'stylesheet';
      ref = attribute(tag, 'href');
    }
    if (kind === undefined || ref === undefined || ref.trim() === '') continue;
    const url = new URL(ref.trim(), pageUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
    url.hash = '';
    const href = url.href;
    if (!assets.some((a) => a.kind === kind && a.url === href)) assets.push({ kind, url: href });
  }
  return assets;
}
```
```ts file=main.ts
import { assetUrls } from './assets';

const html = '<script type="module" crossorigin src="./assets/index-BSa2dRPq.js"></script><link rel="stylesheet" href="./assets/index.css">';
for (const page of ['https://shop.example/', 'https://shop.example/products', 'https://shop.example/products/205']) {
  console.log(page.padEnd(34), assetUrls(page, html).map((a) => a.url));
}
```
:::
