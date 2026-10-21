---
kind: challenge
title: 部署之后的冒烟测试
fixtures: deploy
---
在 `smoke.ts` 中实现 `smokeTest(origin, routes)`：`origin` 是部署的网站（例如 `https://good.example`），`routes` 是要检查的页面路径。`assets.ts`（只读）是小任务的参考解。

按 `routes` 的顺序**一个接一个**地检查每个页面（`new URL(路径, origin)`）：

1. 请求页面。连接失败（`fetch` 拒绝）时问题是 `无法连接`；状态码不在 200–299 之间时是 `状态码 404`（换成实际的状态码）；`content-type` 不以 `text/html` 开头时是 `类型是 实际的类型，不是网页`（没有 `content-type` 时“实际的类型”写成 `（没有类型）`）。有这些问题时，这个页面就不再往下检查；
2. 用 `assetUrls(页面的地址, 页面的 HTML)` 找出它引用的资源，按顺序请求每一个：连接失败、状态码的问题同上；脚本的 `content-type` 中要含有 `javascript`，否则是 `类型是 实际的类型，不是 JavaScript`；样式表的要含有 `text/css`，否则是 `类型是 实际的类型，不是 CSS`；
3. 同一个资源的地址只请求一次：前面的页面已经检查过的，后面的页面不再请求，也不再报告；
4. 每个问题是 `{ url, problem }`，`url` 是出问题的那个地址。按发现的顺序返回所有的问题，没有问题时返回空数组。

这道题的网络请求是模拟的（见下面的表），每个网站对应正文中实测到的一种问题：

| 网站 | 模拟的部署 |
| --- | --- |
| `good.example` | 配置正确：页面的地址都返回 `index.html`，资源都在 |
| `no-fallback.example` | 没有回退：只有 `/` 是网页，其他地址都是 404 |
| `relative.example` | `base` 为 `./`，并且有回退规则 `/(.*)` → `/index.html` |
| `user.github.io` | 应用部署在 `/shop/` 上，构建时的 `base` 却是 `/` |
| `broken.example` | 页面在，引用的脚本被删除了（404） |
| `down.example` | 连接不上 |

:::files{role=support}
```ts file=assets.ts readonly
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
:::

:::files{role=starter}
```ts file=smoke.ts
import { assetUrls } from './assets';

export type Problem = { url: string; problem: string };

/**
 * 部署之后的冒烟测试：依次打开 routes 中的每个页面，检查它和它引用的脚本、样式表都能正确加载。
 * 没有问题时返回空数组。
 */
export async function smokeTest(origin: string, routes: readonly string[]): Promise<Problem[]> {
  const problems: Problem[] = [];
  for (const route of routes) {
    const url = new URL(route, origin).href;
    const response = await fetch(url);
    if (!response.ok) problems.push({ url, problem: `状态码 ${response.status}` });
  }
  return problems;
}
```
```ts file=main.ts
import { smokeTest } from './smoke';

for (const origin of ['https://good.example', 'https://no-fallback.example', 'https://relative.example']) {
  console.log(origin, await smokeTest(origin, ['/', '/products', '/products/205']));
}
```
:::

:::files{role=solution}
```ts file=smoke.ts
import { assetUrls, type Asset } from './assets';

export type Problem = { url: string; problem: string };

const EXPECTED: Record<Asset['kind'], { type: string; name: string }> = {
  script: { type: 'javascript', name: 'JavaScript' },
  stylesheet: { type: 'text/css', name: 'CSS' },
};

/** 请求一个地址；失败（网络错误、状态码不是 2xx）时返回问题，成功时返回响应 */
async function get(url: string): Promise<Response | Problem> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return { url, problem: '无法连接' };
  }
  return response.ok ? response : { url, problem: `状态码 ${response.status}` };
}

const typeOf = (response: Response) => response.headers.get('content-type') ?? '（没有类型）';

/**
 * 部署之后的冒烟测试：依次打开 routes 中的每个页面，检查它和它引用的脚本、样式表都能正确加载。
 * 没有问题时返回空数组。
 */
export async function smokeTest(origin: string, routes: readonly string[]): Promise<Problem[]> {
  const problems: Problem[] = [];
  const checked = new Set<string>();
  for (const route of routes) {
    const pageUrl = new URL(route, origin).href;
    const page = await get(pageUrl);
    if (!(page instanceof Response)) {
      problems.push(page);
      continue;
    }
    if (!typeOf(page).startsWith('text/html')) {
      problems.push({ url: pageUrl, problem: `类型是 ${typeOf(page)}，不是网页` });
      continue;
    }
    for (const asset of assetUrls(pageUrl, await page.text())) {
      // 几个页面引用同一个文件时只检查一次
      if (checked.has(asset.url)) continue;
      checked.add(asset.url);
      const response = await get(asset.url);
      if (!(response instanceof Response)) problems.push(response);
      else if (!typeOf(response).includes(EXPECTED[asset.kind].type)) {
        problems.push({ url: asset.url, problem: `类型是 ${typeOf(response)}，不是 ${EXPECTED[asset.kind].name}` });
      }
    }
  }
  return problems;
}
```
```ts file=main.ts
import { smokeTest } from './smoke';

for (const origin of ['https://good.example', 'https://no-fallback.example', 'https://relative.example']) {
  console.log(origin, await smokeTest(origin, ['/', '/products', '/products/205']));
}
```
:::

:::files{role=tests}
```ts file=smoke.test.ts
import { describe, expect, test, vi } from 'vitest';
import { smokeTest } from './smoke';

const ROUTES = ['/', '/products', '/products/205'];
const JS = 'https://good.example/assets/index-CMnIaEjP.js';

describe('smokeTest', () => {
  test('配置正确的部署：没有问题', async () => {
    await expect(smokeTest('https://good.example', ROUTES)).resolves.toEqual([]);
  });

  test('没有回退：深层的地址 404', async () => {
    await expect(smokeTest('https://no-fallback.example', ROUTES)).resolves.toEqual([
      { url: 'https://no-fallback.example/products', problem: '状态码 404' },
      { url: 'https://no-fallback.example/products/205', problem: '状态码 404' },
    ]);
  });

  test('base 为 ./ 加上回退：深层的页面上，脚本和样式表的地址变成了 /products/assets/…，得到的是网页', async () => {
    await expect(smokeTest('https://relative.example', ROUTES)).resolves.toEqual([
      { url: 'https://relative.example/products/assets/index-CMnIaEjP.js', problem: '类型是 text/html; charset=utf-8，不是 JavaScript' },
      { url: 'https://relative.example/products/assets/index-D8J8pCed.css', problem: '类型是 text/html; charset=utf-8，不是 CSS' },
    ]);
  });

  test('部署在子路径上，base 却是 /：资源 404', async () => {
    await expect(smokeTest('https://user.github.io', ['/shop/'])).resolves.toEqual([
      { url: 'https://user.github.io/assets/index-CMnIaEjP.js', problem: '状态码 404' },
      { url: 'https://user.github.io/assets/index-D8J8pCed.css', problem: '状态码 404' },
    ]);
  });

  test('资源被删除；页面的类型不是网页；连接不上', async () => {
    await expect(smokeTest('https://broken.example', ['/'])).resolves.toEqual([{ url: 'https://broken.example/assets/index-CMnIaEjP.js', problem: '状态码 404' }]);
    await expect(smokeTest('https://good.example', ['/data.json'])).resolves.toEqual([{ url: 'https://good.example/data.json', problem: '类型是 application/json，不是网页' }]);
    await expect(smokeTest('https://down.example', ['/', '/about'])).resolves.toEqual([
      { url: 'https://down.example/', problem: '无法连接' },
      { url: 'https://down.example/about', problem: '无法连接' },
    ]);
  });

  test('几个页面引用同一个文件时只请求一次；页面按顺序检查', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await smokeTest('https://good.example', ROUTES);
    const urls = fetchSpy.mock.calls.map(([input]) => String(input));
    expect(urls).toEqual(['https://good.example/', JS, 'https://good.example/assets/index-D8J8pCed.css', 'https://good.example/products', 'https://good.example/products/205']);
  });
});
```
:::

:::hint{level=1}
写一个 `get(url)`：用 `try`/`catch` 包住 `fetch`，连接失败或者状态码不对时返回一个 `Problem`，否则返回 `Response`。主函数中用 `instanceof Response` 区分这两种结果。页面的类型用 `response.headers.get('content-type')` 检查，HTML 用 `await response.text()` 读出来交给 `assetUrls`。
:::

:::hint{level=2}
用一个 `Set` 记下已经检查过的资源地址（无论有没有问题都记下），检查之前先看它在不在里面。资源的类型写成一张表会比较清楚：`{ script: { type: 'javascript', name: 'JavaScript' }, stylesheet: { type: 'text/css', name: 'CSS' } }`。注意 `assetUrls` 的第一个参数是**页面的地址**，不是 `origin`。
:::

:::explanation
冒烟测试检查的是“部署出来的东西能不能用”，而不是功能对不对。它要发现的问题都发生在构建和部署之间，单元测试和组件测试看不到：

- **没有回退**：深层的页面 404。只检查首页是发现不了的，所以 `routes` 中要包含每一种页面；
- **`base` 为 `./`**：页面本身都是 200，问题在资源上。而且因为有回退，资源的状态码也是 200，只有检查**内容类型**才能发现：浏览器期望的是 JavaScript，得到的却是网页；
- **子路径与 `base` 不一致**：资源 404；
- **资源被删除**：例如用新的部署覆盖了旧的文件，而某个缓存中的旧页面还在引用它们。

每个资源只检查一次，既是为了少发请求，也是为了报告简洁：同一个缺失的脚本被十个页面引用，应该是一个问题，而不是十个。

这样的脚本可以放进 CI（f12）：部署完成之后运行，有问题时让这次部署失败或者发出通知。用 Playwright（f09）在真实的浏览器中打开这些页面、检查控制台中有没有错误，是更完整的版本；这个只用 `fetch` 的版本更快，也不需要浏览器。
:::

:::variant{kind=alt name=parallel-assets}
```ts file=smoke.ts
import { assetUrls } from './assets';

export type Problem = { url: string; problem: string };

type Check = { ok: true; type: string; text: () => Promise<string> } | { ok: false; problem: string };

async function check(url: string): Promise<Check> {
  try {
    const response = await fetch(url);
    if (!response.ok) return { ok: false, problem: `状态码 ${response.status}` };
    return { ok: true, type: response.headers.get('content-type') ?? '（没有类型）', text: () => response.text() };
  } catch {
    return { ok: false, problem: '无法连接' };
  }
}

export async function smokeTest(origin: string, routes: readonly string[]): Promise<Problem[]> {
  const problems: Problem[] = [];
  const seen = new Set<string>();
  for (const route of routes) {
    const url = new URL(route, origin).href;
    const page = await check(url);
    if (!page.ok) {
      problems.push({ url, problem: page.problem });
      continue;
    }
    if (!/^text\/html\b/.test(page.type)) {
      problems.push({ url, problem: `类型是 ${page.type}，不是网页` });
      continue;
    }
    const assets = assetUrls(url, await page.text()).filter((asset) => !seen.has(asset.url));
    for (const asset of assets) seen.add(asset.url);
    // 同一个页面的资源同时请求；Promise.all 的结果按数组的顺序排列
    const results = await Promise.all(assets.map((asset) => check(asset.url)));
    results.forEach((result, i) => {
      const asset = assets[i];
      if (asset === undefined) return;
      if (!result.ok) problems.push({ url: asset.url, problem: result.problem });
      else if (asset.kind === 'script' && !result.type.includes('javascript')) problems.push({ url: asset.url, problem: `类型是 ${result.type}，不是 JavaScript` });
      else if (asset.kind === 'stylesheet' && !result.type.includes('text/css')) problems.push({ url: asset.url, problem: `类型是 ${result.type}，不是 CSS` });
    });
  }
  return problems;
}
```
```ts file=main.ts
import { smokeTest } from './smoke';

for (const origin of ['https://good.example', 'https://no-fallback.example', 'https://relative.example']) {
  console.log(origin, await smokeTest(origin, ['/', '/products', '/products/205']));
}
```
:::

:::variant{kind=wrong name=status-only fails=tests reason="资源只检查了状态码：有回退规则时，错误的资源地址也是 200（内容是网页），这个问题发现不了"}
```ts file=smoke.ts
import { assetUrls, type Asset } from './assets';

export type Problem = { url: string; problem: string };

const EXPECTED: Record<Asset['kind'], { type: string; name: string }> = {
  script: { type: 'javascript', name: 'JavaScript' },
  stylesheet: { type: 'text/css', name: 'CSS' },
};

/** 请求一个地址；失败（网络错误、状态码不是 2xx）时返回问题，成功时返回响应 */
async function get(url: string): Promise<Response | Problem> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return { url, problem: '无法连接' };
  }
  return response.ok ? response : { url, problem: `状态码 ${response.status}` };
}

const typeOf = (response: Response) => response.headers.get('content-type') ?? '（没有类型）';

/**
 * 部署之后的冒烟测试：依次打开 routes 中的每个页面，检查它和它引用的脚本、样式表都能正确加载。
 * 没有问题时返回空数组。
 */
export async function smokeTest(origin: string, routes: readonly string[]): Promise<Problem[]> {
  const problems: Problem[] = [];
  const checked = new Set<string>();
  for (const route of routes) {
    const pageUrl = new URL(route, origin).href;
    const page = await get(pageUrl);
    if (!(page instanceof Response)) {
      problems.push(page);
      continue;
    }
    if (!typeOf(page).startsWith('text/html')) {
      problems.push({ url: pageUrl, problem: `类型是 ${typeOf(page)}，不是网页` });
      continue;
    }
    for (const asset of assetUrls(pageUrl, await page.text())) {
      // 几个页面引用同一个文件时只检查一次
      if (checked.has(asset.url)) continue;
      checked.add(asset.url);
      const response = await get(asset.url);
      // 只看状态码
      if (!(response instanceof Response)) problems.push(response);
    }
  }
  return problems;
}
```
```ts file=main.ts
import { smokeTest } from './smoke';

for (const origin of ['https://good.example', 'https://no-fallback.example', 'https://relative.example']) {
  console.log(origin, await smokeTest(origin, ['/', '/products', '/products/205']));
}
```
:::

:::variant{kind=wrong name=from-origin fails=tests reason="资源的地址相对于网站的根解析，而不是相对于页面：和浏览器的做法不同，./assets/… 的问题被掩盖了"}
```ts file=smoke.ts
import { assetUrls, type Asset } from './assets';

export type Problem = { url: string; problem: string };

const EXPECTED: Record<Asset['kind'], { type: string; name: string }> = {
  script: { type: 'javascript', name: 'JavaScript' },
  stylesheet: { type: 'text/css', name: 'CSS' },
};

/** 请求一个地址；失败（网络错误、状态码不是 2xx）时返回问题，成功时返回响应 */
async function get(url: string): Promise<Response | Problem> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return { url, problem: '无法连接' };
  }
  return response.ok ? response : { url, problem: `状态码 ${response.status}` };
}

const typeOf = (response: Response) => response.headers.get('content-type') ?? '（没有类型）';

/**
 * 部署之后的冒烟测试：依次打开 routes 中的每个页面，检查它和它引用的脚本、样式表都能正确加载。
 * 没有问题时返回空数组。
 */
export async function smokeTest(origin: string, routes: readonly string[]): Promise<Problem[]> {
  const problems: Problem[] = [];
  const checked = new Set<string>();
  for (const route of routes) {
    const pageUrl = new URL(route, origin).href;
    const page = await get(pageUrl);
    if (!(page instanceof Response)) {
      problems.push(page);
      continue;
    }
    if (!typeOf(page).startsWith('text/html')) {
      problems.push({ url: pageUrl, problem: `类型是 ${typeOf(page)}，不是网页` });
      continue;
    }
    // 资源的地址相对于网站的根来解析
    for (const asset of assetUrls(origin, await page.text())) {
      // 几个页面引用同一个文件时只检查一次
      if (checked.has(asset.url)) continue;
      checked.add(asset.url);
      const response = await get(asset.url);
      if (!(response instanceof Response)) problems.push(response);
      else if (!typeOf(response).includes(EXPECTED[asset.kind].type)) {
        problems.push({ url: asset.url, problem: `类型是 ${typeOf(response)}，不是 ${EXPECTED[asset.kind].name}` });
      }
    }
  }
  return problems;
}
```
```ts file=main.ts
import { smokeTest } from './smoke';

for (const origin of ['https://good.example', 'https://no-fallback.example', 'https://relative.example']) {
  console.log(origin, await smokeTest(origin, ['/', '/products', '/products/205']));
}
```
:::

:::variant{kind=wrong name=no-dedupe fails=tests reason="每个页面都重新请求同样的资源：请求变多，同一个问题也会报告好几次"}
```ts file=smoke.ts
import { assetUrls, type Asset } from './assets';

export type Problem = { url: string; problem: string };

const EXPECTED: Record<Asset['kind'], { type: string; name: string }> = {
  script: { type: 'javascript', name: 'JavaScript' },
  stylesheet: { type: 'text/css', name: 'CSS' },
};

/** 请求一个地址；失败（网络错误、状态码不是 2xx）时返回问题，成功时返回响应 */
async function get(url: string): Promise<Response | Problem> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return { url, problem: '无法连接' };
  }
  return response.ok ? response : { url, problem: `状态码 ${response.status}` };
}

const typeOf = (response: Response) => response.headers.get('content-type') ?? '（没有类型）';

/**
 * 部署之后的冒烟测试：依次打开 routes 中的每个页面，检查它和它引用的脚本、样式表都能正确加载。
 * 没有问题时返回空数组。
 */
export async function smokeTest(origin: string, routes: readonly string[]): Promise<Problem[]> {
  const problems: Problem[] = [];
  const checked = new Set<string>();
  for (const route of routes) {
    const pageUrl = new URL(route, origin).href;
    const page = await get(pageUrl);
    if (!(page instanceof Response)) {
      problems.push(page);
      continue;
    }
    if (!typeOf(page).startsWith('text/html')) {
      problems.push({ url: pageUrl, problem: `类型是 ${typeOf(page)}，不是网页` });
      continue;
    }
    for (const asset of assetUrls(pageUrl, await page.text())) {
      // 几个页面引用同一个文件时只检查一次
      const response = await get(asset.url);
      if (!(response instanceof Response)) problems.push(response);
      else if (!typeOf(response).includes(EXPECTED[asset.kind].type)) {
        problems.push({ url: asset.url, problem: `类型是 ${typeOf(response)}，不是 ${EXPECTED[asset.kind].name}` });
      }
    }
  }
  return problems;
}
```
```ts file=main.ts
import { smokeTest } from './smoke';

for (const origin of ['https://good.example', 'https://no-fallback.example', 'https://relative.example']) {
  console.log(origin, await smokeTest(origin, ['/', '/products', '/products/205']));
}
```
:::

:::variant{kind=wrong name=stop-at-first fails=tests reason="第一个页面有问题时就停下了：后面的页面没有检查，一次只能发现一个问题"}
```ts file=smoke.ts
import { assetUrls, type Asset } from './assets';

export type Problem = { url: string; problem: string };

const EXPECTED: Record<Asset['kind'], { type: string; name: string }> = {
  script: { type: 'javascript', name: 'JavaScript' },
  stylesheet: { type: 'text/css', name: 'CSS' },
};

/** 请求一个地址；失败（网络错误、状态码不是 2xx）时返回问题，成功时返回响应 */
async function get(url: string): Promise<Response | Problem> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return { url, problem: '无法连接' };
  }
  return response.ok ? response : { url, problem: `状态码 ${response.status}` };
}

const typeOf = (response: Response) => response.headers.get('content-type') ?? '（没有类型）';

/**
 * 部署之后的冒烟测试：依次打开 routes 中的每个页面，检查它和它引用的脚本、样式表都能正确加载。
 * 没有问题时返回空数组。
 */
export async function smokeTest(origin: string, routes: readonly string[]): Promise<Problem[]> {
  const problems: Problem[] = [];
  const checked = new Set<string>();
  for (const route of routes) {
    const pageUrl = new URL(route, origin).href;
    const page = await get(pageUrl);
    if (!(page instanceof Response)) {
      problems.push(page);
      return problems;
    }
    if (!typeOf(page).startsWith('text/html')) {
      problems.push({ url: pageUrl, problem: `类型是 ${typeOf(page)}，不是网页` });
      continue;
    }
    for (const asset of assetUrls(pageUrl, await page.text())) {
      // 几个页面引用同一个文件时只检查一次
      if (checked.has(asset.url)) continue;
      checked.add(asset.url);
      const response = await get(asset.url);
      if (!(response instanceof Response)) problems.push(response);
      else if (!typeOf(response).includes(EXPECTED[asset.kind].type)) {
        problems.push({ url: asset.url, problem: `类型是 ${typeOf(response)}，不是 ${EXPECTED[asset.kind].name}` });
      }
    }
  }
  return problems;
}
```
```ts file=main.ts
import { smokeTest } from './smoke';

for (const origin of ['https://good.example', 'https://no-fallback.example', 'https://relative.example']) {
  console.log(origin, await smokeTest(origin, ['/', '/products', '/products/205']));
}
```
:::
