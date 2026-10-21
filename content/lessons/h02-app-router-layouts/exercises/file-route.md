---
kind: task
title: 文件对应的路由
---
在 `file-route.ts` 中实现 `routeFromFile(file)`：参数是 Next.js 项目中一个文件相对于项目根目录的路径（用 `/` 分隔，项目不使用 `src/` 文件夹），返回这个文件产生的路由，不产生路由时返回 `null`：

1. 只有 `app/` 中的文件才可能产生路由；
2. 文件名正好是 `page` 或 `route` 加上 `.tsx`、`.ts`、`.jsx`、`.js` 之一时，分别产生一个页面（`kind: 'page'`）或一个 Route Handler（`kind: 'route'`）。其他文件（`layout.tsx`、`loading.tsx`、`page.module.css`、`route.test.ts`……）都不产生路由；
3. `app/` 和文件名之间的每个文件夹是地址中的一段，原样保留（包括 `[id]` 这样的动态段）。`pattern` 以 `/` 开头，`app/` 中直接的 `page.tsx` 是 `/`；
4. 路由组（名字用圆括号括起来的文件夹，例如 `(marketing)`）不出现在地址中；
5. 路径中有任何一个私有文件夹（名字以 `_` 开头）时，这个文件不产生路由。

:::files{role=starter}
```ts file=file-route.ts
export type AppRoute = Readonly<{ pattern: string; kind: 'page' | 'route' }>;

/** app/ 中的一个文件对应的路由；不产生路由的文件返回 null */
export function routeFromFile(file: string): AppRoute | null {
  // TODO
  return null;
}
```
```ts file=main.ts
import { routeFromFile } from './file-route';

const files = [
  'app/page.tsx',
  'app/layout.tsx',
  'app/(marketing)/about/page.tsx',
  'app/projects/[id]/page.tsx',
  'app/projects/_lib/data.ts',
  'app/api/health/route.ts',
];

for (const file of files) {
  console.log(file.padEnd(32), routeFromFile(file));
}
```
:::

:::files{role=solution}
```ts file=file-route.ts
export type AppRoute = Readonly<{ pattern: string; kind: 'page' | 'route' }>;

/** 默认的扩展名：tsx、ts、jsx、js */
const FILE = /^(page|route)\.(tsx|ts|jsx|js)$/;

/** app/ 中的一个文件对应的路由；不产生路由的文件返回 null */
export function routeFromFile(file: string): AppRoute | null {
  const parts = file.split('/');
  if (parts[0] !== 'app' || parts.length < 2) return null;
  const match = FILE.exec(parts.at(-1) ?? '');
  if (match === null) return null;
  const segments: string[] = [];
  for (const folder of parts.slice(1, -1)) {
    // 私有文件夹（以 _ 开头）中的文件都不是路由
    if (folder.startsWith('_')) return null;
    // 路由组 (name) 只用来组织文件，不出现在地址中
    if (folder.startsWith('(') && folder.endsWith(')')) continue;
    segments.push(folder);
  }
  return { pattern: `/${segments.join('/')}`, kind: match[1] === 'page' ? 'page' : 'route' };
}
```
```ts file=main.ts
import { routeFromFile } from './file-route';

const files = [
  'app/page.tsx',
  'app/layout.tsx',
  'app/(marketing)/about/page.tsx',
  'app/projects/[id]/page.tsx',
  'app/projects/_lib/data.ts',
  'app/api/health/route.ts',
];

for (const file of files) {
  console.log(file.padEnd(32), routeFromFile(file));
}
```
:::

:::files{role=tests}
```ts file=file-route.test.ts
import { describe, expect, test } from 'vitest';
import { routeFromFile } from './file-route';

describe('routeFromFile', () => {
  test('page 文件是页面，文件夹就是地址', () => {
    expect(routeFromFile('app/page.tsx')).toEqual({ pattern: '/', kind: 'page' });
    expect(routeFromFile('app/projects/page.tsx')).toEqual({ pattern: '/projects', kind: 'page' });
    expect(routeFromFile('app/projects/new/page.tsx')).toEqual({ pattern: '/projects/new', kind: 'page' });
  });

  test('四种扩展名都可以', () => {
    expect(routeFromFile('app/blog/page.jsx')).toEqual({ pattern: '/blog', kind: 'page' });
    expect(routeFromFile('app/blog/page.js')).toEqual({ pattern: '/blog', kind: 'page' });
    expect(routeFromFile('app/lab/page.ts')).toEqual({ pattern: '/lab', kind: 'page' });
    expect(routeFromFile('app/api/x/route.tsx')).toEqual({ pattern: '/api/x', kind: 'route' });
  });

  test('动态段原样保留', () => {
    expect(routeFromFile('app/projects/[id]/page.tsx')).toEqual({ pattern: '/projects/[id]', kind: 'page' });
    expect(routeFromFile('app/shop/[...slug]/page.tsx')).toEqual({ pattern: '/shop/[...slug]', kind: 'page' });
    expect(routeFromFile('app/docs/[[...slug]]/page.tsx')).toEqual({ pattern: '/docs/[[...slug]]', kind: 'page' });
  });

  test('route 文件是 Route Handler', () => {
    expect(routeFromFile('app/api/health/route.ts')).toEqual({ pattern: '/api/health', kind: 'route' });
    expect(routeFromFile('app/api/one/[id]/route.js')).toEqual({ pattern: '/api/one/[id]', kind: 'route' });
  });

  test('路由组不出现在地址中', () => {
    expect(routeFromFile('app/(marketing)/about/page.tsx')).toEqual({ pattern: '/about', kind: 'page' });
    expect(routeFromFile('app/(marketing)/page.tsx')).toEqual({ pattern: '/', kind: 'page' });
    expect(routeFromFile('app/(shop)/(cart)/cart/page.tsx')).toEqual({ pattern: '/cart', kind: 'page' });
  });

  test('私有文件夹中的文件都不是路由，即使它叫 page', () => {
    expect(routeFromFile('app/projects/_lib/data.ts')).toBeNull();
    expect(routeFromFile('app/_components/page.tsx')).toBeNull();
    expect(routeFromFile('app/blog/_drafts/hello/page.tsx')).toBeNull();
  });

  test('其他文件不产生路由', () => {
    for (const file of ['app/layout.tsx', 'app/projects/loading.tsx', 'app/not-found.tsx', 'app/globals.css', 'app/projects/pages.tsx', 'app/projects/template.tsx', 'app/projects/page.module.css', 'app/api/route.test.ts']) {
      expect(routeFromFile(file), file).toBeNull();
    }
  });

  test('不在 app/ 中的文件不是 App Router 的路由', () => {
    expect(routeFromFile('src/page.tsx')).toBeNull();
    expect(routeFromFile('page.tsx')).toBeNull();
    expect(routeFromFile('lib/app/page.tsx')).toBeNull();
  });
});
```
:::

:::hint{level=1}
`file.split('/')` 分成几部分：第一部分必须是 `'app'`，最后一部分是文件名，中间的是文件夹。文件名用一个正则判断：`/^(page|route)\.(tsx|ts|jsx|js)$/`，第一个分组告诉你是哪一种。
:::

:::hint{level=2}
用 `parts.slice(1, -1)` 取出中间的文件夹，逐个处理：以 `_` 开头时直接 `return null`；是 `(…)` 时跳过；其他的放进一个数组。最后 `'/' + segments.join('/')`：没有文件夹时正好是 `'/'`。
:::

:::explanation
App Router 用文件夹表示地址，用文件名表示“这一段上显示什么”。所以一个文件是不是路由，只看两件事：它的文件名是不是 `page` 或 `route`，它所在的文件夹中有没有让整条路径退出路由的私有文件夹。其他文件放在 `app/` 中也不会被访问到，这就是官方文档说的“可以安全地放在一起”（colocation）。

文件名要**完整**地比较：`page.module.css` 和 `route.test.ts` 都以 `page.`、`route.` 开头，但它们是样式和测试，不是路由。正则中的 `^` 和 `$` 保证整个文件名都符合格式。

私有文件夹和路由组的区别：私有文件夹让它里面的**所有**文件都退出路由，所以遇到它就可以直接返回；路由组只是不出现在地址中，它里面的页面仍然是路由。

替代解用一个正则同时检查 `app/` 前缀和文件名，再用 `some` 和 `filter` 处理中间的文件夹。
:::

:::variant{kind=alt name=one-regex}
```ts file=file-route.ts
export type AppRoute = Readonly<{ pattern: string; kind: 'page' | 'route' }>;

/** app/ 中的一个文件对应的路由；不产生路由的文件返回 null */
export function routeFromFile(file: string): AppRoute | null {
  // 第一个分组是 app/ 和文件名之间的文件夹（可能没有），第二个分组是 page 或 route
  const match = /^app\/(?:(.*)\/)?(page|route)\.(?:tsx|ts|jsx|js)$/.exec(file);
  if (match === null) return null;
  const folders = match[1] === undefined ? [] : match[1].split('/');
  if (folders.some((folder) => folder.startsWith('_'))) return null;
  const segments = folders.filter((folder) => !(folder.startsWith('(') && folder.endsWith(')')));
  return { pattern: '/' + segments.join('/'), kind: match[2] === 'page' ? 'page' : 'route' };
}
```
:::

:::variant{kind=wrong name=groups-in-url fails=tests reason="路由组的文件夹也出现在了地址中：(marketing)/about 应该是 /about"}
```ts file=file-route.ts
export type AppRoute = Readonly<{ pattern: string; kind: 'page' | 'route' }>;

/** 默认的扩展名：tsx、ts、jsx、js */
const FILE = /^(page|route)\.(tsx|ts|jsx|js)$/;

/** app/ 中的一个文件对应的路由；不产生路由的文件返回 null */
export function routeFromFile(file: string): AppRoute | null {
  const parts = file.split('/');
  if (parts[0] !== 'app' || parts.length < 2) return null;
  const match = FILE.exec(parts.at(-1) ?? '');
  if (match === null) return null;
  const segments: string[] = [];
  for (const folder of parts.slice(1, -1)) {
    // 私有文件夹（以 _ 开头）中的文件都不是路由
    if (folder.startsWith('_')) return null;
    segments.push(folder);
  }
  return { pattern: `/${segments.join('/')}`, kind: match[1] === 'page' ? 'page' : 'route' };
}
```
:::

:::variant{kind=wrong name=skip-private-folder fails=tests reason="只跳过私有文件夹这一段：app/_components/page.tsx 变成了首页"}
```ts file=file-route.ts
export type AppRoute = Readonly<{ pattern: string; kind: 'page' | 'route' }>;

/** 默认的扩展名：tsx、ts、jsx、js */
const FILE = /^(page|route)\.(tsx|ts|jsx|js)$/;

/** app/ 中的一个文件对应的路由；不产生路由的文件返回 null */
export function routeFromFile(file: string): AppRoute | null {
  const parts = file.split('/');
  if (parts[0] !== 'app' || parts.length < 2) return null;
  const match = FILE.exec(parts.at(-1) ?? '');
  if (match === null) return null;
  const segments: string[] = [];
  for (const folder of parts.slice(1, -1)) {
    // 私有文件夹（以 _ 开头）中的文件都不是路由
    if (folder.startsWith('_')) continue;
    // 路由组 (name) 只用来组织文件，不出现在地址中
    if (folder.startsWith('(') && folder.endsWith(')')) continue;
    segments.push(folder);
  }
  return { pattern: `/${segments.join('/')}`, kind: match[1] === 'page' ? 'page' : 'route' };
}
```
:::

:::variant{kind=wrong name=ts-only fails=tests reason="只认 .tsx 和 .ts：用 JavaScript 写的页面（.jsx、.js）不被当作路由"}
```ts file=file-route.ts
export type AppRoute = Readonly<{ pattern: string; kind: 'page' | 'route' }>;

/** 默认的扩展名：tsx、ts、jsx、js */
const FILE = /^(page|route)\.(tsx|ts)$/;

/** app/ 中的一个文件对应的路由；不产生路由的文件返回 null */
export function routeFromFile(file: string): AppRoute | null {
  const parts = file.split('/');
  if (parts[0] !== 'app' || parts.length < 2) return null;
  const match = FILE.exec(parts.at(-1) ?? '');
  if (match === null) return null;
  const segments: string[] = [];
  for (const folder of parts.slice(1, -1)) {
    // 私有文件夹（以 _ 开头）中的文件都不是路由
    if (folder.startsWith('_')) return null;
    // 路由组 (name) 只用来组织文件，不出现在地址中
    if (folder.startsWith('(') && folder.endsWith(')')) continue;
    segments.push(folder);
  }
  return { pattern: `/${segments.join('/')}`, kind: match[1] === 'page' ? 'page' : 'route' };
}
```
:::

:::variant{kind=wrong name=name-prefix fails=tests reason="只看文件名的开头：page.module.css、route.test.ts 也被当成了路由"}
```ts file=file-route.ts
export type AppRoute = Readonly<{ pattern: string; kind: 'page' | 'route' }>;

/** 默认的扩展名：tsx、ts、jsx、js */
const FILE = /^(page|route)\./;

/** app/ 中的一个文件对应的路由；不产生路由的文件返回 null */
export function routeFromFile(file: string): AppRoute | null {
  const parts = file.split('/');
  if (parts[0] !== 'app' || parts.length < 2) return null;
  const match = FILE.exec(parts.at(-1) ?? '');
  if (match === null) return null;
  const segments: string[] = [];
  for (const folder of parts.slice(1, -1)) {
    // 私有文件夹（以 _ 开头）中的文件都不是路由
    if (folder.startsWith('_')) return null;
    // 路由组 (name) 只用来组织文件，不出现在地址中
    if (folder.startsWith('(') && folder.endsWith(')')) continue;
    segments.push(folder);
  }
  return { pattern: `/${segments.join('/')}`, kind: match[1] === 'page' ? 'page' : 'route' };
}
```
:::

