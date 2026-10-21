---
kind: task
title: 从路由表生成改写规则
---
在 `rewrites.ts` 中实现两个函数。`RouteDef` 是 React Router 路由对象中和地址有关的部分：`path`、`index`、`children`。

1. `routePatterns(routes)`：路由表中所有页面的地址模式，规则和 React Router 实际的匹配一致。
   - 一个路由的完整地址是上一级的完整地址加上它的 `path`（最外层从 `/` 开始）；`path` 以 `/` 开头时写的是完整的地址，直接使用。多余的 `/`（开头、结尾、连续）不影响结果；结果以 `/` 开头、不以 `/` 结尾，根是 `'/'`；
   - 有 `path` 的路由都算页面，包括有子路由的布局（React Router 会匹配它，`<Outlet />` 是空的）；`index` 路由也算页面，地址和上一级相同；没有 `path` 的布局本身不算，它的子路由接在上一级的地址后面；
   - `path` 只有一个 `*` 的路由（“页面不存在”）不算，它的子路由也不算；完整地址的最后一段是 `*` 时（例如 `files/*`），把这一段换成 vercel.json 的写法 `:path*`（`/files/:path*`）；
   - 按在路由表中出现的顺序，重复的只保留第一次；
2. `vercelRewrites(routes)`：除了 `'/'`，每个页面的地址都变成一条 `{ source: 地址, destination: '/index.html' }`。

:::files{role=starter}
```ts file=rewrites.ts
/** React Router 路由配置中和地址有关的部分 */
export type RouteDef = Readonly<{ path?: string; index?: boolean; children?: readonly RouteDef[] }>;

export type Rewrite = Readonly<{ source: string; destination: string }>;

/** 路由表中所有页面的地址模式，按出现的顺序，不重复 */
export function routePatterns(routes: readonly RouteDef[]): string[] {
  // TODO
  return [];
}

/** vercel.json 的 rewrites：每个页面的地址都返回 index.html（'/' 本来就是 index.html，不需要） */
export function vercelRewrites(routes: readonly RouteDef[]): Rewrite[] {
  // TODO
  return [];
}
```
```ts file=main.ts
import { routePatterns, vercelRewrites, type RouteDef } from './rewrites';

const routes: RouteDef[] = [
  {
    path: '/',
    children: [
      { index: true },
      { path: 'projects', children: [{ index: true }, { path: 'new' }, { path: ':projectId' }, { path: ':projectId/edit' }] },
      { path: '*' },
    ],
  },
];

console.log(routePatterns(routes));
console.log(JSON.stringify({ rewrites: vercelRewrites(routes) }, null, 2));
```
:::

:::files{role=solution}
```ts file=rewrites.ts
/** React Router 路由配置中和地址有关的部分 */
export type RouteDef = Readonly<{ path?: string; index?: boolean; children?: readonly RouteDef[] }>;

export type Rewrite = Readonly<{ source: string; destination: string }>;

/** 地址按 / 分成段，去掉空的段（开头、结尾、连续的 /） */
const segments = (path: string | undefined) => (path ?? '').split('/').filter((s) => s !== '');

/** 路由表中所有页面的地址模式，按出现的顺序，不重复 */
export function routePatterns(routes: readonly RouteDef[]): string[] {
  const patterns: string[] = [];
  const add = (parts: readonly string[]) => {
    const pattern = `/${parts.join('/')}`;
    if (!patterns.includes(pattern)) patterns.push(pattern);
  };
  const visit = (list: readonly RouteDef[], parent: readonly string[]) => {
    for (const route of list) {
      const own = segments(route.path);
      // 只有一个 * 的路由是“页面不存在”：其他所有地址都交给平台返回 404
      if (own.length === 1 && own[0] === '*') continue;
      // 以 / 开头的子路由写的是完整的地址
      const full = route.path?.startsWith('/') ? own : [...parent, ...own];
      if (full.at(-1) === '*') {
        // files/* 匹配 /files 和它下面的任意地址：vercel.json 中写成 :path*（零段或多段，i01）
        add([...full.slice(0, -1), ':path*']);
        continue;
      }
      // 有 path 的路由（包括有子路由的布局）和 index 路由都能匹配一个地址
      if (route.index === true || route.path !== undefined) add(full);
      if (route.children !== undefined) visit(route.children, full);
    }
  };
  visit(routes, []);
  return patterns;
}

/** vercel.json 的 rewrites：每个页面的地址都返回 index.html（'/' 本来就是 index.html，不需要） */
export function vercelRewrites(routes: readonly RouteDef[]): Rewrite[] {
  return routePatterns(routes)
    .filter((pattern) => pattern !== '/')
    .map((source) => ({ source, destination: '/index.html' }));
}
```
```ts file=main.ts
import { routePatterns, vercelRewrites, type RouteDef } from './rewrites';

const routes: RouteDef[] = [
  {
    path: '/',
    children: [
      { index: true },
      { path: 'projects', children: [{ index: true }, { path: 'new' }, { path: ':projectId' }, { path: ':projectId/edit' }] },
      { path: '*' },
    ],
  },
];

console.log(routePatterns(routes));
console.log(JSON.stringify({ rewrites: vercelRewrites(routes) }, null, 2));
```
:::

:::files{role=tests}
```ts file=rewrites.test.ts
import { describe, expect, test } from 'vitest';
import { routePatterns, vercelRewrites, type RouteDef } from './rewrites';

/** 项目面板的路由表（只保留和地址有关的部分） */
const APP: RouteDef[] = [
  {
    path: '/',
    children: [
      { index: true },
      {
        path: 'projects',
        children: [{ index: true }, { path: 'new' }, { path: ':projectId' }, { path: ':projectId/edit' }],
      },
      { path: '*' },
    ],
  },
];

describe('routePatterns', () => {
  test('项目面板的全部页面', () => {
    expect(routePatterns(APP)).toEqual(['/', '/projects', '/projects/new', '/projects/:projectId', '/projects/:projectId/edit']);
  });

  test('index 路由的地址就是父路由的地址', () => {
    expect(routePatterns([{ path: 'docs', children: [{ index: true }, { path: 'intro' }] }])).toEqual(['/docs', '/docs/intro']);
  });

  test('有 path 的布局本身也匹配它的地址（没有 index 子路由时，Outlet 是空的）', () => {
    expect(routePatterns([{ path: 'shop', children: [{ path: 'cart' }] }])).toEqual(['/shop', '/shop/cart']);
  });

  test('没有 path 的布局路由不匹配地址：子路由直接接在上一级的地址后面', () => {
    expect(routePatterns([{ path: '/', children: [{ children: [{ path: 'settings' }, { path: 'about' }] }] }])).toEqual(['/', '/settings', '/about']);
  });

  test('结尾的 / 不影响结果', () => {
    expect(routePatterns([{ path: '/shop/', children: [{ path: 'cart/' }, { path: 'items/:id' }] }])).toEqual(['/shop', '/shop/cart', '/shop/items/:id']);
  });

  test('以 / 开头的子路由写的是完整的地址', () => {
    expect(routePatterns([{ path: 'projects', children: [{ index: true }, { path: '/projects/new' }] }])).toEqual(['/projects', '/projects/new']);
  });

  test('只有 * 的路由（页面不存在）不算，它的子路由也不算；files/* 写成 /files/:path*', () => {
    expect(routePatterns([{ path: 'files/*' }, { path: '*', children: [{ path: 'x' }] }, { path: 'a' }])).toEqual(['/files/:path*', '/a']);
  });

  test('重复的地址只算一次，保留第一次出现的位置', () => {
    expect(routePatterns([{ path: 'a' }, { path: 'b', children: [{ index: true }] }, { path: '/a/' }])).toEqual(['/a', '/b']);
  });

  test('没有子路由的空数组也当作页面', () => {
    expect(routePatterns([{ path: 'empty', children: [] }])).toEqual(['/empty']);
  });
});

describe('vercelRewrites', () => {
  test('除了首页，每个页面都改写到 index.html', () => {
    expect(vercelRewrites(APP)).toEqual([
      { source: '/projects', destination: '/index.html' },
      { source: '/projects/new', destination: '/index.html' },
      { source: '/projects/:projectId', destination: '/index.html' },
      { source: '/projects/:projectId/edit', destination: '/index.html' },
    ]);
  });

  test('只有首页时不需要改写', () => {
    expect(vercelRewrites([{ path: '/', children: [{ index: true }, { path: '*' }] }])).toEqual([]);
  });
});
```
:::

:::hint{level=1}
写一个递归的函数 `visit(routes, parent)`，`parent` 是上一级地址的各段（字符串数组）。对每个路由：先把它的 `path` 按 `/` 分开、去掉空的段；以 `/` 开头就不接在 `parent` 后面。有 `path` 或者是 `index` 路由就记下地址；有子路由就用这个地址继续 `visit`。
:::

:::hint{level=2}
`(route.path ?? '').split('/').filter((s) => s !== '')`：多余的斜杠、`undefined` 的 `path` 都处理了，`'/' + parts.join('/')` 在根上正好是 `'/'`。“只有一个 `*`”的检查放在最前面，`continue` 跳过之后，它的子路由自然也被跳过了。去重可以在记下地址时用 `includes` 检查。
:::

:::explanation
路由表是一棵树，递归正好对应它的形状：处理一个路由，就是算出它的完整地址，再交给它的子路由。

哪些地址要生成规则，问的是“React Router 会不会为这个地址渲染一个页面”。有 `path` 的布局会：没有 `index` 子路由时，打开 `/shop` 照样渲染布局，只是 `<Outlet />` 是空的。如果只把没有子路由的路由当作页面（错误解 `leaves-only`），刷新 `/shop` 就是 404，而在本地点链接进去却一切正常。没有 `path` 的布局不匹配任何地址，它只是把子路由包在同一个外框中。

两种 `*` 要分开：只有一个 `*` 的路由是“页面不存在”，为它生成 `/:path*` 就等于“其他所有地址都返回 index.html”，找不到的地址全变成了 200（错误解 `keep-not-found`）；`files/*` 则是一个真正的页面，它下面的地址都由它显示，vercel.json 中要写成 `:path*`，原样写成 `/files/*` 不是 vercel.json 的写法（错误解 `literal-splat`）。

替代解用生成器函数（`function*`）在递归中逐个产生地址，再用 `Set` 去重：`Set` 保持第一次插入的顺序。
:::

:::variant{kind=alt name=generator-and-set}
```ts file=rewrites.ts
/** React Router 路由配置中和地址有关的部分 */
export type RouteDef = Readonly<{ path?: string; index?: boolean; children?: readonly RouteDef[] }>;

export type Rewrite = Readonly<{ source: string; destination: string }>;

/** 生成器：依次产生每个页面的完整地址（可能重复） */
function* pages(routes: readonly RouteDef[], parent: string[]): Generator<string> {
  for (const { path, index, children } of routes) {
    const own = (path ?? '').split('/').filter(Boolean);
    if (own.join('/') === '*') continue;
    const full = path?.startsWith('/') ? own : [...parent, ...own];
    if (full.at(-1) === '*') {
      yield '/' + [...full.slice(0, -1), ':path*'].join('/');
    } else {
      if (index || path !== undefined) yield '/' + full.join('/');
      if (children) yield* pages(children, full);
    }
  }
}

export function routePatterns(routes: readonly RouteDef[]): string[] {
  // Set 保持插入的顺序，重复的值只保留第一次
  return [...new Set(pages(routes, []))];
}

export function vercelRewrites(routes: readonly RouteDef[]): Rewrite[] {
  return routePatterns(routes).flatMap((source) => (source === '/' ? [] : [{ source, destination: '/index.html' }]));
}
```
```ts file=main.ts
import { routePatterns, vercelRewrites, type RouteDef } from './rewrites';

const routes: RouteDef[] = [
  {
    path: '/',
    children: [
      { index: true },
      { path: 'projects', children: [{ index: true }, { path: 'new' }, { path: ':projectId' }, { path: ':projectId/edit' }] },
      { path: '*' },
    ],
  },
];

console.log(routePatterns(routes));
console.log(JSON.stringify({ rewrites: vercelRewrites(routes) }, null, 2));
```
:::

:::variant{kind=wrong name=leaves-only fails=tests reason="只把没有子路由的路由当作页面：有 path 的布局也会被 React Router 匹配，刷新它的地址就是 404"}
```ts file=rewrites.ts
/** React Router 路由配置中和地址有关的部分 */
export type RouteDef = Readonly<{ path?: string; index?: boolean; children?: readonly RouteDef[] }>;

export type Rewrite = Readonly<{ source: string; destination: string }>;

/** 地址按 / 分成段，去掉空的段（开头、结尾、连续的 /） */
const segments = (path: string | undefined) => (path ?? '').split('/').filter((s) => s !== '');

/** 路由表中所有页面的地址模式，按出现的顺序，不重复 */
export function routePatterns(routes: readonly RouteDef[]): string[] {
  const patterns: string[] = [];
  const add = (parts: readonly string[]) => {
    const pattern = `/${parts.join('/')}`;
    if (!patterns.includes(pattern)) patterns.push(pattern);
  };
  const visit = (list: readonly RouteDef[], parent: readonly string[]) => {
    for (const route of list) {
      const own = segments(route.path);
      // 只有一个 * 的路由是“页面不存在”：其他所有地址都交给平台返回 404
      if (own.length === 1 && own[0] === '*') continue;
      // 以 / 开头的子路由写的是完整的地址
      const full = route.path?.startsWith('/') ? own : [...parent, ...own];
      if (full.at(-1) === '*') {
        // files/* 匹配 /files 和它下面的任意地址：vercel.json 中写成 :path*（零段或多段，i01）
        add([...full.slice(0, -1), ':path*']);
        continue;
      }
      // 有 path 的路由（包括有子路由的布局）和 index 路由都能匹配一个地址
      if (route.children !== undefined && route.children.length > 0) visit(route.children, full);
      else add(full);
    }
  };
  visit(routes, []);
  return patterns;
}

/** vercel.json 的 rewrites：每个页面的地址都返回 index.html（'/' 本来就是 index.html，不需要） */
export function vercelRewrites(routes: readonly RouteDef[]): Rewrite[] {
  return routePatterns(routes)
    .filter((pattern) => pattern !== '/')
    .map((source) => ({ source, destination: '/index.html' }));
}
```
```ts file=main.ts
import { routePatterns, vercelRewrites, type RouteDef } from './rewrites';

const routes: RouteDef[] = [
  {
    path: '/',
    children: [
      { index: true },
      { path: 'projects', children: [{ index: true }, { path: 'new' }, { path: ':projectId' }, { path: ':projectId/edit' }] },
      { path: '*' },
    ],
  },
];

console.log(routePatterns(routes));
console.log(JSON.stringify({ rewrites: vercelRewrites(routes) }, null, 2));
```
:::

:::variant{kind=wrong name=keep-not-found fails=tests reason="为“页面不存在”的 * 也生成了规则：/:path* 匹配一切，找不到的地址都变成了 200"}
```ts file=rewrites.ts
/** React Router 路由配置中和地址有关的部分 */
export type RouteDef = Readonly<{ path?: string; index?: boolean; children?: readonly RouteDef[] }>;

export type Rewrite = Readonly<{ source: string; destination: string }>;

/** 地址按 / 分成段，去掉空的段（开头、结尾、连续的 /） */
const segments = (path: string | undefined) => (path ?? '').split('/').filter((s) => s !== '');

/** 路由表中所有页面的地址模式，按出现的顺序，不重复 */
export function routePatterns(routes: readonly RouteDef[]): string[] {
  const patterns: string[] = [];
  const add = (parts: readonly string[]) => {
    const pattern = `/${parts.join('/')}`;
    if (!patterns.includes(pattern)) patterns.push(pattern);
  };
  const visit = (list: readonly RouteDef[], parent: readonly string[]) => {
    for (const route of list) {
      const own = segments(route.path);
      // 只有一个 * 的路由是“页面不存在”：其他所有地址都交给平台返回 404
      // 以 / 开头的子路由写的是完整的地址
      const full = route.path?.startsWith('/') ? own : [...parent, ...own];
      if (full.at(-1) === '*') {
        // files/* 匹配 /files 和它下面的任意地址：vercel.json 中写成 :path*（零段或多段，i01）
        add([...full.slice(0, -1), ':path*']);
        continue;
      }
      // 有 path 的路由（包括有子路由的布局）和 index 路由都能匹配一个地址
      if (route.index === true || route.path !== undefined) add(full);
      if (route.children !== undefined) visit(route.children, full);
    }
  };
  visit(routes, []);
  return patterns;
}

/** vercel.json 的 rewrites：每个页面的地址都返回 index.html（'/' 本来就是 index.html，不需要） */
export function vercelRewrites(routes: readonly RouteDef[]): Rewrite[] {
  return routePatterns(routes)
    .filter((pattern) => pattern !== '/')
    .map((source) => ({ source, destination: '/index.html' }));
}
```
```ts file=main.ts
import { routePatterns, vercelRewrites, type RouteDef } from './rewrites';

const routes: RouteDef[] = [
  {
    path: '/',
    children: [
      { index: true },
      { path: 'projects', children: [{ index: true }, { path: 'new' }, { path: ':projectId' }, { path: ':projectId/edit' }] },
      { path: '*' },
    ],
  },
];

console.log(routePatterns(routes));
console.log(JSON.stringify({ rewrites: vercelRewrites(routes) }, null, 2));
```
:::

:::variant{kind=wrong name=literal-splat fails=tests reason="files/* 原样写进了规则：vercel.json 中零段或多段要写成 :path*"}
```ts file=rewrites.ts
/** React Router 路由配置中和地址有关的部分 */
export type RouteDef = Readonly<{ path?: string; index?: boolean; children?: readonly RouteDef[] }>;

export type Rewrite = Readonly<{ source: string; destination: string }>;

/** 地址按 / 分成段，去掉空的段（开头、结尾、连续的 /） */
const segments = (path: string | undefined) => (path ?? '').split('/').filter((s) => s !== '');

/** 路由表中所有页面的地址模式，按出现的顺序，不重复 */
export function routePatterns(routes: readonly RouteDef[]): string[] {
  const patterns: string[] = [];
  const add = (parts: readonly string[]) => {
    const pattern = `/${parts.join('/')}`;
    if (!patterns.includes(pattern)) patterns.push(pattern);
  };
  const visit = (list: readonly RouteDef[], parent: readonly string[]) => {
    for (const route of list) {
      const own = segments(route.path);
      // 只有一个 * 的路由是“页面不存在”：其他所有地址都交给平台返回 404
      if (own.length === 1 && own[0] === '*') continue;
      // 以 / 开头的子路由写的是完整的地址
      const full = route.path?.startsWith('/') ? own : [...parent, ...own];
      if (full.at(-1) === '*') {
        // files/* 匹配 /files 和它下面的任意地址：vercel.json 中写成 :path*（零段或多段，i01）
        add(full);
        continue;
      }
      // 有 path 的路由（包括有子路由的布局）和 index 路由都能匹配一个地址
      if (route.index === true || route.path !== undefined) add(full);
      if (route.children !== undefined) visit(route.children, full);
    }
  };
  visit(routes, []);
  return patterns;
}

/** vercel.json 的 rewrites：每个页面的地址都返回 index.html（'/' 本来就是 index.html，不需要） */
export function vercelRewrites(routes: readonly RouteDef[]): Rewrite[] {
  return routePatterns(routes)
    .filter((pattern) => pattern !== '/')
    .map((source) => ({ source, destination: '/index.html' }));
}
```
```ts file=main.ts
import { routePatterns, vercelRewrites, type RouteDef } from './rewrites';

const routes: RouteDef[] = [
  {
    path: '/',
    children: [
      { index: true },
      { path: 'projects', children: [{ index: true }, { path: 'new' }, { path: ':projectId' }, { path: ':projectId/edit' }] },
      { path: '*' },
    ],
  },
];

console.log(routePatterns(routes));
console.log(JSON.stringify({ rewrites: vercelRewrites(routes) }, null, 2));
```
:::

:::variant{kind=wrong name=relative-only fails=tests reason="以 / 开头的子路由也接在父路由后面：得到了 /projects/projects/new"}
```ts file=rewrites.ts
/** React Router 路由配置中和地址有关的部分 */
export type RouteDef = Readonly<{ path?: string; index?: boolean; children?: readonly RouteDef[] }>;

export type Rewrite = Readonly<{ source: string; destination: string }>;

/** 地址按 / 分成段，去掉空的段（开头、结尾、连续的 /） */
const segments = (path: string | undefined) => (path ?? '').split('/').filter((s) => s !== '');

/** 路由表中所有页面的地址模式，按出现的顺序，不重复 */
export function routePatterns(routes: readonly RouteDef[]): string[] {
  const patterns: string[] = [];
  const add = (parts: readonly string[]) => {
    const pattern = `/${parts.join('/')}`;
    if (!patterns.includes(pattern)) patterns.push(pattern);
  };
  const visit = (list: readonly RouteDef[], parent: readonly string[]) => {
    for (const route of list) {
      const own = segments(route.path);
      // 只有一个 * 的路由是“页面不存在”：其他所有地址都交给平台返回 404
      if (own.length === 1 && own[0] === '*') continue;
      // 以 / 开头的子路由写的是完整的地址
      const full = [...parent, ...own];
      if (full.at(-1) === '*') {
        // files/* 匹配 /files 和它下面的任意地址：vercel.json 中写成 :path*（零段或多段，i01）
        add([...full.slice(0, -1), ':path*']);
        continue;
      }
      // 有 path 的路由（包括有子路由的布局）和 index 路由都能匹配一个地址
      if (route.index === true || route.path !== undefined) add(full);
      if (route.children !== undefined) visit(route.children, full);
    }
  };
  visit(routes, []);
  return patterns;
}

/** vercel.json 的 rewrites：每个页面的地址都返回 index.html（'/' 本来就是 index.html，不需要） */
export function vercelRewrites(routes: readonly RouteDef[]): Rewrite[] {
  return routePatterns(routes)
    .filter((pattern) => pattern !== '/')
    .map((source) => ({ source, destination: '/index.html' }));
}
```
```ts file=main.ts
import { routePatterns, vercelRewrites, type RouteDef } from './rewrites';

const routes: RouteDef[] = [
  {
    path: '/',
    children: [
      { index: true },
      { path: 'projects', children: [{ index: true }, { path: 'new' }, { path: ':projectId' }, { path: ':projectId/edit' }] },
      { path: '*' },
    ],
  },
];

console.log(routePatterns(routes));
console.log(JSON.stringify({ rewrites: vercelRewrites(routes) }, null, 2));
```
:::

:::variant{kind=wrong name=no-dedupe fails=tests reason="没有去掉重复的地址：同一条规则写了两遍"}
```ts file=rewrites.ts
/** React Router 路由配置中和地址有关的部分 */
export type RouteDef = Readonly<{ path?: string; index?: boolean; children?: readonly RouteDef[] }>;

export type Rewrite = Readonly<{ source: string; destination: string }>;

/** 地址按 / 分成段，去掉空的段（开头、结尾、连续的 /） */
const segments = (path: string | undefined) => (path ?? '').split('/').filter((s) => s !== '');

/** 路由表中所有页面的地址模式，按出现的顺序，不重复 */
export function routePatterns(routes: readonly RouteDef[]): string[] {
  const patterns: string[] = [];
  const add = (parts: readonly string[]) => {
    const pattern = `/${parts.join('/')}`;
    patterns.push(pattern);
  };
  const visit = (list: readonly RouteDef[], parent: readonly string[]) => {
    for (const route of list) {
      const own = segments(route.path);
      // 只有一个 * 的路由是“页面不存在”：其他所有地址都交给平台返回 404
      if (own.length === 1 && own[0] === '*') continue;
      // 以 / 开头的子路由写的是完整的地址
      const full = route.path?.startsWith('/') ? own : [...parent, ...own];
      if (full.at(-1) === '*') {
        // files/* 匹配 /files 和它下面的任意地址：vercel.json 中写成 :path*（零段或多段，i01）
        add([...full.slice(0, -1), ':path*']);
        continue;
      }
      // 有 path 的路由（包括有子路由的布局）和 index 路由都能匹配一个地址
      if (route.index === true || route.path !== undefined) add(full);
      if (route.children !== undefined) visit(route.children, full);
    }
  };
  visit(routes, []);
  return patterns;
}

/** vercel.json 的 rewrites：每个页面的地址都返回 index.html（'/' 本来就是 index.html，不需要） */
export function vercelRewrites(routes: readonly RouteDef[]): Rewrite[] {
  return routePatterns(routes)
    .filter((pattern) => pattern !== '/')
    .map((source) => ({ source, destination: '/index.html' }));
}
```
```ts file=main.ts
import { routePatterns, vercelRewrites, type RouteDef } from './rewrites';

const routes: RouteDef[] = [
  {
    path: '/',
    children: [
      { index: true },
      { path: 'projects', children: [{ index: true }, { path: 'new' }, { path: ':projectId' }, { path: ':projectId/edit' }] },
      { path: '*' },
    ],
  },
];

console.log(routePatterns(routes));
console.log(JSON.stringify({ rewrites: vercelRewrites(routes) }, null, 2));
```
:::

:::variant{kind=wrong name=root-rewrite fails=tests reason="为 / 也生成了改写：它本来就是 index.html，这条规则是多余的"}
```ts file=rewrites.ts
/** React Router 路由配置中和地址有关的部分 */
export type RouteDef = Readonly<{ path?: string; index?: boolean; children?: readonly RouteDef[] }>;

export type Rewrite = Readonly<{ source: string; destination: string }>;

/** 地址按 / 分成段，去掉空的段（开头、结尾、连续的 /） */
const segments = (path: string | undefined) => (path ?? '').split('/').filter((s) => s !== '');

/** 路由表中所有页面的地址模式，按出现的顺序，不重复 */
export function routePatterns(routes: readonly RouteDef[]): string[] {
  const patterns: string[] = [];
  const add = (parts: readonly string[]) => {
    const pattern = `/${parts.join('/')}`;
    if (!patterns.includes(pattern)) patterns.push(pattern);
  };
  const visit = (list: readonly RouteDef[], parent: readonly string[]) => {
    for (const route of list) {
      const own = segments(route.path);
      // 只有一个 * 的路由是“页面不存在”：其他所有地址都交给平台返回 404
      if (own.length === 1 && own[0] === '*') continue;
      // 以 / 开头的子路由写的是完整的地址
      const full = route.path?.startsWith('/') ? own : [...parent, ...own];
      if (full.at(-1) === '*') {
        // files/* 匹配 /files 和它下面的任意地址：vercel.json 中写成 :path*（零段或多段，i01）
        add([...full.slice(0, -1), ':path*']);
        continue;
      }
      // 有 path 的路由（包括有子路由的布局）和 index 路由都能匹配一个地址
      if (route.index === true || route.path !== undefined) add(full);
      if (route.children !== undefined) visit(route.children, full);
    }
  };
  visit(routes, []);
  return patterns;
}

/** vercel.json 的 rewrites：每个页面的地址都返回 index.html（'/' 本来就是 index.html，不需要） */
export function vercelRewrites(routes: readonly RouteDef[]): Rewrite[] {
  return routePatterns(routes)
    .map((source) => ({ source, destination: '/index.html' }));
}
```
```ts file=main.ts
import { routePatterns, vercelRewrites, type RouteDef } from './rewrites';

const routes: RouteDef[] = [
  {
    path: '/',
    children: [
      { index: true },
      { path: 'projects', children: [{ index: true }, { path: 'new' }, { path: ':projectId' }, { path: ':projectId/edit' }] },
      { path: '*' },
    ],
  },
];

console.log(routePatterns(routes));
console.log(JSON.stringify({ rewrites: vercelRewrites(routes) }, null, 2));
```
:::

