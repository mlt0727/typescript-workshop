---
kind: task
title: 从路由表生成改写规则
---
在 `rewrites.ts` 中实现两个函数。`RouteDef` 是 React Router 路由对象中和地址有关的部分：`path`、`index`、`children`。

1. `routePatterns(routes)`：路由表中所有页面的地址模式。
   - 一个路由的完整地址是上一级的完整地址加上它的 `path`（最外层从 `/` 开始）。子路由的 `path` 是相对的；`path` 开头、结尾多余的 `/` 不影响结果。结果以 `/` 开头、不以 `/` 结尾，根是 `'/'`；
   - 没有 `path` 的路由（`index` 路由、没有 `path` 的布局路由）的完整地址和上一级相同；
   - **页面**是没有子路由的路由（`children` 不存在或者是空数组）；有子路由的只是布局，看它的子路由；
   - 完整地址中带有 `*` 的路由不算，它的子路由也不算；
   - 按在路由表中出现的顺序，重复的只保留第一次；
2. `vercelRewrites(routes)`：除了 `'/'`，每个页面的地址都变成一条 `{ source: 地址, destination: '/index.html' }`。

:::files{role=starter}
```ts file=rewrites.ts
/** React Router 路由配置中和地址有关的部分 */
export type RouteDef = Readonly<{ path?: string; index?: boolean; children?: readonly RouteDef[] }>;

export type Rewrite = Readonly<{ source: string; destination: string }>;

/** 路由表中所有页面的地址模式，按出现的顺序，不重复；带 * 的路由（例如“页面不存在”）不算 */
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

/** 把 parent 和 path 连起来：去掉多余的斜杠，结果以 / 开头、不以 / 结尾（根是 '/'） */
function join(parent: string, path: string | undefined): string {
  const parts = [...parent.split('/'), ...(path ?? '').split('/')].filter((part) => part !== '');
  return `/${parts.join('/')}`;
}

/** 路由表中所有页面的地址模式，按出现的顺序，不重复；带 * 的路由（例如“页面不存在”）不算 */
export function routePatterns(routes: readonly RouteDef[]): string[] {
  const patterns: string[] = [];
  const visit = (list: readonly RouteDef[], parent: string) => {
    for (const route of list) {
      const full = join(parent, route.path);
      if (full.includes('*')) continue;
      if (route.children !== undefined && route.children.length > 0) {
        visit(route.children, full);
      } else if (!patterns.includes(full)) {
        patterns.push(full);
      }
    }
  };
  visit(routes, '/');
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

  test('没有 path 的布局路由：子路由直接接在上一级的地址后面', () => {
    expect(routePatterns([{ path: '/', children: [{ children: [{ path: 'settings' }, { path: 'about' }] }] }])).toEqual(['/settings', '/about']);
  });

  test('结尾的 / 不影响结果', () => {
    expect(routePatterns([{ path: '/shop/', children: [{ path: 'cart/' }, { path: 'items/:id' }] }])).toEqual(['/shop/cart', '/shop/items/:id']);
  });

  test('带 * 的路由不算页面，它的子路由也不算', () => {
    expect(routePatterns([{ path: 'files/*' }, { path: '*', children: [{ path: 'x' }] }, { path: 'a' }])).toEqual(['/a']);
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
写一个递归的函数 `visit(routes, parent)`：对每个路由，先算出完整地址；有子路由就用这个地址作为 `parent` 继续 `visit`，没有就把地址记下来。连接地址时，把两部分都按 `/` 分开，去掉空的部分，再用 `/` 连起来，前面加一个 `/`。
:::

:::hint{level=2}
`[...parent.split('/'), ...(route.path ?? '').split('/')].filter((part) => part !== '')`，再 `'/' + parts.join('/')`：多余的斜杠、`undefined` 的 `path` 都处理了，根正好是 `'/'`。带 `*` 的检查放在递归之前，它的子路由就自然被跳过了。
:::

:::explanation
路由表是一棵树：布局路由提供共同的外框，叶子才是一个个页面。地址模式就是从根走到每个叶子的路径。递归正好对应这棵树的形状：处理一个路由，就是算出它的完整地址，再交给它的子路由。

`index` 路由没有自己的 `path`，地址和父路由相同；没有 `path` 的布局路由也一样。用“去掉空的部分再连接”的方式拼地址，这两种情况和多余的斜杠都不需要特别处理。

`/projects` 既是布局（有子路由），又通过它的 `index` 子路由成为一个页面；它出现在结果中，是因为那个 `index` 子路由，而不是布局本身。如果一个布局没有 `index` 子路由（例如没有 `path` 的布局），它本身就不是一个页面，错误解 `layout-as-page` 把它也算了进去。

替代解用生成器函数（`function*`）在递归中逐个产生地址，再用 `Set` 去重：`Set` 保持第一次插入的顺序。
:::

:::variant{kind=alt name=generator-and-set}
```ts file=rewrites.ts
/** React Router 路由配置中和地址有关的部分 */
export type RouteDef = Readonly<{ path?: string; index?: boolean; children?: readonly RouteDef[] }>;

export type Rewrite = Readonly<{ source: string; destination: string }>;

/** 生成器：依次产生每个页面的完整地址（可能重复） */
function* pages(routes: readonly RouteDef[], parent: string[]): Generator<string> {
  for (const route of routes) {
    const segments = [...parent, ...(route.path ?? '').split('/').filter(Boolean)];
    if (segments.some((s) => s.includes('*'))) continue;
    if (route.children?.length) yield* pages(route.children, segments);
    else yield '/' + segments.join('/');
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

:::variant{kind=wrong name=keep-splat fails=tests reason="没有排除带 * 的路由：“页面不存在”也得到了 index.html，找不到的地址都变成了 200"}
```ts file=rewrites.ts
/** React Router 路由配置中和地址有关的部分 */
export type RouteDef = Readonly<{ path?: string; index?: boolean; children?: readonly RouteDef[] }>;

export type Rewrite = Readonly<{ source: string; destination: string }>;

/** 把 parent 和 path 连起来：去掉多余的斜杠，结果以 / 开头、不以 / 结尾（根是 '/'） */
function join(parent: string, path: string | undefined): string {
  const parts = [...parent.split('/'), ...(path ?? '').split('/')].filter((part) => part !== '');
  return `/${parts.join('/')}`;
}

/** 路由表中所有页面的地址模式，按出现的顺序，不重复；带 * 的路由（例如“页面不存在”）不算 */
export function routePatterns(routes: readonly RouteDef[]): string[] {
  const patterns: string[] = [];
  const visit = (list: readonly RouteDef[], parent: string) => {
    for (const route of list) {
      const full = join(parent, route.path);
      if (route.children !== undefined && route.children.length > 0) {
        visit(route.children, full);
      } else if (!patterns.includes(full)) {
        patterns.push(full);
      }
    }
  };
  visit(routes, '/');
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

:::variant{kind=wrong name=layout-as-page fails=tests reason="把有子路由的布局也当作页面：没有 index 子路由的布局本身并不是一个页面"}
```ts file=rewrites.ts
/** React Router 路由配置中和地址有关的部分 */
export type RouteDef = Readonly<{ path?: string; index?: boolean; children?: readonly RouteDef[] }>;

export type Rewrite = Readonly<{ source: string; destination: string }>;

/** 把 parent 和 path 连起来：去掉多余的斜杠，结果以 / 开头、不以 / 结尾（根是 '/'） */
function join(parent: string, path: string | undefined): string {
  const parts = [...parent.split('/'), ...(path ?? '').split('/')].filter((part) => part !== '');
  return `/${parts.join('/')}`;
}

/** 路由表中所有页面的地址模式，按出现的顺序，不重复；带 * 的路由（例如“页面不存在”）不算 */
export function routePatterns(routes: readonly RouteDef[]): string[] {
  const patterns: string[] = [];
  const visit = (list: readonly RouteDef[], parent: string) => {
    for (const route of list) {
      const full = join(parent, route.path);
      if (full.includes('*')) continue;
      if (!patterns.includes(full)) patterns.push(full);
      if (route.children !== undefined) visit(route.children, full);
    }
  };
  visit(routes, '/');
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

/** 把 parent 和 path 连起来：去掉多余的斜杠，结果以 / 开头、不以 / 结尾（根是 '/'） */
function join(parent: string, path: string | undefined): string {
  const parts = [...parent.split('/'), ...(path ?? '').split('/')].filter((part) => part !== '');
  return `/${parts.join('/')}`;
}

/** 路由表中所有页面的地址模式，按出现的顺序，不重复；带 * 的路由（例如“页面不存在”）不算 */
export function routePatterns(routes: readonly RouteDef[]): string[] {
  const patterns: string[] = [];
  const visit = (list: readonly RouteDef[], parent: string) => {
    for (const route of list) {
      const full = join(parent, route.path);
      if (full.includes('*')) continue;
      if (route.children !== undefined && route.children.length > 0) {
        visit(route.children, full);
      } else {
        patterns.push(full);
      }
    }
  };
  visit(routes, '/');
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

/** 把 parent 和 path 连起来：去掉多余的斜杠，结果以 / 开头、不以 / 结尾（根是 '/'） */
function join(parent: string, path: string | undefined): string {
  const parts = [...parent.split('/'), ...(path ?? '').split('/')].filter((part) => part !== '');
  return `/${parts.join('/')}`;
}

/** 路由表中所有页面的地址模式，按出现的顺序，不重复；带 * 的路由（例如“页面不存在”）不算 */
export function routePatterns(routes: readonly RouteDef[]): string[] {
  const patterns: string[] = [];
  const visit = (list: readonly RouteDef[], parent: string) => {
    for (const route of list) {
      const full = join(parent, route.path);
      if (full.includes('*')) continue;
      if (route.children !== undefined && route.children.length > 0) {
        visit(route.children, full);
      } else if (!patterns.includes(full)) {
        patterns.push(full);
      }
    }
  };
  visit(routes, '/');
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

:::variant{kind=wrong name=concat fails=tests reason="直接拼接字符串：根路由得到了 //，结尾的斜杠也留在了地址中"}
```ts file=rewrites.ts
/** React Router 路由配置中和地址有关的部分 */
export type RouteDef = Readonly<{ path?: string; index?: boolean; children?: readonly RouteDef[] }>;

export type Rewrite = Readonly<{ source: string; destination: string }>;

/** 把 parent 和 path 连起来：去掉多余的斜杠，结果以 / 开头、不以 / 结尾（根是 '/'） */
function join(parent: string, path: string | undefined): string {
  if (path === undefined) return parent;
  return parent.endsWith('/') ? parent + path : `${parent}/${path}`;
}

/** 路由表中所有页面的地址模式，按出现的顺序，不重复；带 * 的路由（例如“页面不存在”）不算 */
export function routePatterns(routes: readonly RouteDef[]): string[] {
  const patterns: string[] = [];
  const visit = (list: readonly RouteDef[], parent: string) => {
    for (const route of list) {
      const full = join(parent, route.path);
      if (full.includes('*')) continue;
      if (route.children !== undefined && route.children.length > 0) {
        visit(route.children, full);
      } else if (!patterns.includes(full)) {
        patterns.push(full);
      }
    }
  };
  visit(routes, '/');
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

