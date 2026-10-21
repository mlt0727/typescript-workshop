---
kind: challenge
title: 匹配地址
---
在 `match.ts` 中实现 `matchRoute(patterns, pathname)`：`patterns` 是 App Router 的路由模式（上一个练习得到的 `pattern`），`pathname` 是请求的地址（不含查询字符串），返回匹配的模式和参数，没有匹配时返回 `null`。规则来自本课实测的 Next.js 16.4.2：

1. **地址**：`/` 是零段。其他的地址去掉开头的 `/` 之后用 `/` 分段；有空的段（结尾的 `/` 或者连续的 `//`）时返回 `null`（实测 Next.js 会先用 308 转到规范的地址）。每段用 `decodeURIComponent` 解码；解码失败时返回 `null`；
2. **模式**中的一段：`[[...name]]` 是可选的捕获段，`[...name]` 是捕获段，`[name]` 是动态段，其他是固定的段。捕获段只会出现在模式的最后；
3. **匹配**：固定的段必须和地址中的这一段完全相同（区分大小写）；动态段匹配正好一段，参数是字符串；捕获段匹配剩下的一段或多段，参数是数组；可选的捕获段还可以匹配零段，这时参数中**没有**这个键。没有捕获段的模式，段数必须和地址相同；
4. **优先级**：有几个模式都匹配时，从左往右逐段比较，第一个不同的位置上：固定的段 > 动态段 > 捕获段 > 可选的捕获段。除了捕获段和可选的捕获段之间（Next.js 不允许它们出现在同一层），这些顺序都是实测的。结果与 `patterns` 的顺序无关；
5. `patterns` 中不会有两个形状完全相同的模式，也不会有 `/docs` 和 `/docs/[[...slug]]` 这样的一对（Next.js 不允许）。所以比较到某个位置时，如果一个模式已经没有段了，这两个模式不可能同时匹配，怎样排都可以。

一处有意的不同：地址中有无法解码的 `%E4` 时，实测 Next.js 16.4.2 返回 500，这里返回 `null`。

:::files{role=starter}
```ts file=match.ts
export type Params = Record<string, string | string[]>;
export type Match = Readonly<{ pattern: string; params: Params }>;

/** 在 patterns 中找出匹配 pathname 的最具体的那一个；没有时返回 null */
export function matchRoute(patterns: readonly string[], pathname: string): Match | null {
  // TODO
  return null;
}
```
```ts file=main.ts readonly
import { matchRoute } from './match';

const routes = ['/', '/projects', '/projects/new', '/projects/[id]', '/docs/[[...slug]]', '/shop/[...slug]'];

for (const pathname of ['/projects/new', '/projects/p1', '/docs', '/docs/a/b', '/shop', '/projects/', '/projects/%E5%AE%98']) {
  console.log(pathname.padEnd(22), JSON.stringify(matchRoute(routes, pathname)));
}
```
:::

:::files{role=solution}
```ts file=match.ts
export type Params = Record<string, string | string[]>;
export type Match = Readonly<{ pattern: string; params: Params }>;

type Segment =
  | { type: 'static'; value: string }
  | { type: 'dynamic'; name: string }
  | { type: 'catch-all'; name: string }
  | { type: 'optional'; name: string };

/** 越具体越大：同一个位置上，固定的段优先于动态段，动态段优先于捕获段 */
const RANK: Record<Segment['type'], number> = { static: 3, dynamic: 2, 'catch-all': 1, optional: 0 };

function parse(pattern: string): Segment[] {
  return pattern
    .split('/')
    .filter((s) => s !== '')
    .map((s): Segment => {
      let m = /^\[\[\.\.\.(\w+)\]\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'optional', name: m[1] };
      m = /^\[\.\.\.(\w+)\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'catch-all', name: m[1] };
      m = /^\[(\w+)\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'dynamic', name: m[1] };
      return { type: 'static', value: s };
    });
}

/** 用一个模式匹配已经解码的各段；匹配时返回参数 */
function tryMatch(segments: readonly Segment[], parts: readonly string[]): Params | null {
  const params: Params = {};
  for (const [i, segment] of segments.entries()) {
    const part = parts[i];
    if (segment.type === 'catch-all' || segment.type === 'optional') {
      const rest = parts.slice(i);
      if (segment.type === 'catch-all' && rest.length === 0) return null;
      if (rest.length > 0) params[segment.name] = rest;
      return params;
    }
    if (part === undefined) return null;
    if (segment.type === 'static' && segment.value !== part) return null;
    if (segment.type === 'dynamic') params[segment.name] = part;
  }
  return parts.length === segments.length ? params : null;
}

/** 两个模式中更具体的排在前面 */
function compare(a: readonly Segment[], b: readonly Segment[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    // 一个模式已经没有段了：这样的两个模式不会同时匹配同一个地址，给它一个最小的值即可
    const x = a[i];
    const y = b[i];
    const rx = x === undefined ? -1 : RANK[x.type];
    const ry = y === undefined ? -1 : RANK[y.type];
    const diff = ry - rx;
    if (diff !== 0) return diff;
  }
  return 0;
}

/** 在 patterns 中找出匹配 pathname 的最具体的那一个 */
export function matchRoute(patterns: readonly string[], pathname: string): Match | null {
  // 空的段（结尾的 / 或者 //）：Next.js 先用 308 转到规范的地址，不在这里匹配
  const raw = pathname === '/' ? [] : pathname.slice(1).split('/');
  if (raw.includes('')) return null;
  let parts: string[];
  try {
    parts = raw.map((s) => decodeURIComponent(s));
  } catch {
    return null;
  }
  const candidates = patterns
    .map((pattern) => ({ pattern, segments: parse(pattern) }))
    .toSorted((a, b) => compare(a.segments, b.segments));
  for (const { pattern, segments } of candidates) {
    const params = tryMatch(segments, parts);
    if (params !== null) return { pattern, params };
  }
  return null;
}
```
```ts file=main.ts readonly
import { matchRoute } from './match';

const routes = ['/', '/projects', '/projects/new', '/projects/[id]', '/docs/[[...slug]]', '/shop/[...slug]'];

for (const pathname of ['/projects/new', '/projects/p1', '/docs', '/docs/a/b', '/shop', '/projects/', '/projects/%E5%AE%98']) {
  console.log(pathname.padEnd(22), JSON.stringify(matchRoute(routes, pathname)));
}
```
:::

:::files{role=tests}
```ts file=match.test.ts
import { describe, expect, test } from 'vitest';
import { matchRoute } from './match';

/** 实测项目中的路由（2026-10-21，Next.js 16.4.2），下面的期望结果都是对它实际请求得到的 */
const ROUTES = [
  '/',
  '/about',
  '/projects',
  '/projects/new',
  '/projects/[id]',
  '/docs/[[...slug]]',
  '/shop/[...slug]',
  '/api/one/[id]',
  '/api/r/[[...slug]]',
  '/api/r/intro',
  '/api/r/guides/[id]',
  '/api/r/guides/[id]/edit',
];

const match = (pathname: string) => matchRoute(ROUTES, pathname);

describe('matchRoute', () => {
  test('固定的地址', () => {
    expect(match('/')).toStrictEqual({ pattern: '/', params: {} });
    expect(match('/about')).toStrictEqual({ pattern: '/about', params: {} });
    expect(match('/projects')).toStrictEqual({ pattern: '/projects', params: {} });
  });

  test('动态段：一段，参数是字符串；固定的段优先', () => {
    expect(match('/projects/p1')).toStrictEqual({ pattern: '/projects/[id]', params: { id: 'p1' } });
    expect(match('/projects/new')).toStrictEqual({ pattern: '/projects/new', params: {} });
    expect(match('/projects/p1/x')).toBeNull();
  });

  test('捕获段：至少一段，参数是数组', () => {
    expect(match('/shop/x')).toStrictEqual({ pattern: '/shop/[...slug]', params: { slug: ['x'] } });
    expect(match('/shop/x/y')).toStrictEqual({ pattern: '/shop/[...slug]', params: { slug: ['x', 'y'] } });
    expect(match('/shop'), '/shop 实测是 404').toBeNull();
  });

  test('可选的捕获段：零段时 params 中没有这个键', () => {
    expect(match('/docs')).toStrictEqual({ pattern: '/docs/[[...slug]]', params: {} });
    expect(match('/docs/a/b')).toStrictEqual({ pattern: '/docs/[[...slug]]', params: { slug: ['a', 'b'] } });
  });

  test('参数是解码之后的值；编码的 / 仍然是同一段', () => {
    expect(match('/api/one/%E5%AE%98')).toStrictEqual({ pattern: '/api/one/[id]', params: { id: '官' } });
    expect(match('/api/one/a%2Fb')).toStrictEqual({ pattern: '/api/one/[id]', params: { id: 'a/b' } });
    expect(match('/docs/%E4%B8%AD/a%20b')).toStrictEqual({ pattern: '/docs/[[...slug]]', params: { slug: ['中', 'a b'] } });
  });

  test('更具体的路由优先；匹配不上时退回到可选的捕获段', () => {
    expect(match('/api/r')).toStrictEqual({ pattern: '/api/r/[[...slug]]', params: {} });
    expect(match('/api/r/intro')).toStrictEqual({ pattern: '/api/r/intro', params: {} });
    expect(match('/api/r/intro/x')).toStrictEqual({ pattern: '/api/r/[[...slug]]', params: { slug: ['intro', 'x'] } });
    expect(match('/api/r/guides')).toStrictEqual({ pattern: '/api/r/[[...slug]]', params: { slug: ['guides'] } });
    expect(match('/api/r/guides/a')).toStrictEqual({ pattern: '/api/r/guides/[id]', params: { id: 'a' } });
    expect(match('/api/r/guides/a/edit')).toStrictEqual({ pattern: '/api/r/guides/[id]/edit', params: { id: 'a' } });
    expect(match('/api/r/guides/a/b')).toStrictEqual({ pattern: '/api/r/[[...slug]]', params: { slug: ['guides', 'a', 'b'] } });
  });

  test('路由表中的顺序不影响结果', () => {
    expect(matchRoute(ROUTES.toReversed(), '/projects/new')?.pattern).toBe('/projects/new');
    expect(matchRoute(ROUTES.toReversed(), '/api/r/guides/a')?.pattern).toBe('/api/r/guides/[id]');
  });

  test('同一个位置上：动态段优先于捕获段和可选的捕获段（两种顺序都一样）', () => {
    for (const routes of [['/api/m/[...rest]', '/api/m/[id]'], ['/api/m/[id]', '/api/m/[...rest]']]) {
      expect(matchRoute(routes, '/api/m/1')).toStrictEqual({ pattern: '/api/m/[id]', params: { id: '1' } });
      expect(matchRoute(routes, '/api/m/1/2')).toStrictEqual({ pattern: '/api/m/[...rest]', params: { rest: ['1', '2'] } });
    }
    for (const routes of [['/api/n/[[...rest]]', '/api/n/[id]'], ['/api/n/[id]', '/api/n/[[...rest]]']]) {
      expect(matchRoute(routes, '/api/n')).toStrictEqual({ pattern: '/api/n/[[...rest]]', params: {} });
      expect(matchRoute(routes, '/api/n/1')).toStrictEqual({ pattern: '/api/n/[id]', params: { id: '1' } });
      expect(matchRoute(routes, '/api/n/1/2')).toStrictEqual({ pattern: '/api/n/[[...rest]]', params: { rest: ['1', '2'] } });
    }
  });

  test('区分大小写；有空的段时不匹配（Next.js 会先用 308 转走）', () => {
    expect(match('/Projects')).toBeNull();
    expect(match('/projects/')).toBeNull();
    expect(match('/docs/')).toBeNull();
    expect(match('/projects//p1')).toBeNull();
    expect(match('//projects')).toBeNull();
    expect(match('/nope')).toBeNull();
  });

  test('无法解码的地址：null', () => {
    expect(match('/projects/%E4')).toBeNull();
  });
});
```
:::

:::hint{level=1}
分成三步：把每个模式解析成段的数组（一个可辨识联合：`{ type: 'static', value } | { type: 'dynamic', name } | …`）；写一个函数用一个模式匹配地址的各段，匹配时返回参数，否则返回 `null`；按优先级把模式排好序，返回第一个匹配的。
:::

:::hint{level=2}
优先级写成一张表：`{ static: 3, dynamic: 2, 'catch-all': 1, optional: 0 }`。比较两个模式时逐个位置取出分数，某个模式在这个位置已经没有段时用 `-1`（规则 5：这时它们不会同时匹配）。第一个分数不同的位置决定顺序。地址先用 `pathname.slice(1).split('/')` 分段，再用 `includes('')` 检查空的段。
:::

:::explanation
路由匹配分成两个独立的问题：**能不能匹配**，以及**几个都能匹配时选哪一个**。把它们分开写，每一个都很简单：`tryMatch` 只关心一个模式，比较函数只关心两个模式的形状，跟地址无关。

排序依据的是模式的**形状**，而不是它在列表中的位置或者字符串的长度。这样不管路由是按什么顺序找到的（文件系统返回的顺序在不同的电脑上可能不同），结果都一样。这正是 App Router 的做法：同一层上，固定的文件夹优先于 `[id]`，`[id]` 优先于 `[...slug]`，`[...slug]` 优先于 `[[...slug]]`。

解码要**逐段**进行：先分段再解码，`a%2Fb` 才会是一段 `a/b`；先解码整个地址，编码的斜杠就变成了真正的分隔符。`decodeURIComponent` 遇到不完整的编码（例如 `%E4`）会抛出 `URIError`，要把它变成一个明确的结果。

替代解不排序：遍历所有的模式，用递归的函数匹配，同时记住其中最具体的一个。
:::

:::variant{kind=alt name=best-of-matches}
```ts file=match.ts
export type Params = Record<string, string | string[]>;
export type Match = Readonly<{ pattern: string; params: Params }>;

/** 一段有多具体；模式在这个位置已经结束时是 -1（这时两个模式不会同时匹配） */
function score(segment: string | undefined): number {
  if (segment === undefined) return -1;
  if (segment.startsWith('[[...')) return 0;
  if (segment.startsWith('[...')) return 1;
  if (segment.startsWith('[')) return 2;
  return 3;
}

/** [id]、[...slug]、[[...slug]] 中的参数名 */
function paramName(segment: string): string {
  return segment.replace(/^\[+(?:\.\.\.)?|\]+$/g, '');
}

/** 从第 i 段开始递归地匹配 */
function matchFrom(segments: readonly string[], parts: readonly string[], i: number, params: Params): Params | null {
  const segment = segments[i];
  const part = parts[i];
  if (segment === undefined) return part === undefined ? params : null;
  const kind = score(segment);
  if (kind === 0 || kind === 1) {
    const rest = parts.slice(i);
    if (rest.length === 0) return kind === 0 ? params : null;
    return { ...params, [paramName(segment)]: rest };
  }
  if (part === undefined) return null;
  if (kind === 3) return segment === part ? matchFrom(segments, parts, i + 1, params) : null;
  return matchFrom(segments, parts, i + 1, { ...params, [paramName(segment)]: part });
}

/** a 比 b 更具体时是正数 */
function specificity(a: readonly string[], b: readonly string[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = score(a[i]) - score(b[i]);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** 在 patterns 中找出匹配 pathname 的最具体的那一个；没有时返回 null */
export function matchRoute(patterns: readonly string[], pathname: string): Match | null {
  if (pathname !== '/' && /\/(\/|$)/.test(pathname)) return null;
  let parts: string[];
  try {
    parts = pathname.split('/').filter((s) => s !== '').map((s) => decodeURIComponent(s));
  } catch {
    return null;
  }
  // 先找出所有匹配的模式，同时记住其中最具体的一个
  let best: { pattern: string; segments: string[]; params: Params } | null = null;
  for (const pattern of patterns) {
    const segments = pattern.split('/').filter((s) => s !== '');
    const params = matchFrom(segments, parts, 0, {});
    if (params === null) continue;
    if (best === null || specificity(segments, best.segments) > 0) best = { pattern, segments, params };
  }
  return best === null ? null : { pattern: best.pattern, params: best.params };
}
```
:::

:::variant{kind=wrong name=first-match fails=tests reason="没有按具体程度排序，返回列表中第一个匹配的：结果取决于路由表的顺序"}
```ts file=match.ts
export type Params = Record<string, string | string[]>;
export type Match = Readonly<{ pattern: string; params: Params }>;

type Segment =
  | { type: 'static'; value: string }
  | { type: 'dynamic'; name: string }
  | { type: 'catch-all'; name: string }
  | { type: 'optional'; name: string };

/** 越具体越大：同一个位置上，固定的段优先于动态段，动态段优先于捕获段 */
const RANK: Record<Segment['type'], number> = { static: 3, dynamic: 2, 'catch-all': 1, optional: 0 };

function parse(pattern: string): Segment[] {
  return pattern
    .split('/')
    .filter((s) => s !== '')
    .map((s): Segment => {
      let m = /^\[\[\.\.\.(\w+)\]\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'optional', name: m[1] };
      m = /^\[\.\.\.(\w+)\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'catch-all', name: m[1] };
      m = /^\[(\w+)\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'dynamic', name: m[1] };
      return { type: 'static', value: s };
    });
}

/** 用一个模式匹配已经解码的各段；匹配时返回参数 */
function tryMatch(segments: readonly Segment[], parts: readonly string[]): Params | null {
  const params: Params = {};
  for (const [i, segment] of segments.entries()) {
    const part = parts[i];
    if (segment.type === 'catch-all' || segment.type === 'optional') {
      const rest = parts.slice(i);
      if (segment.type === 'catch-all' && rest.length === 0) return null;
      if (rest.length > 0) params[segment.name] = rest;
      return params;
    }
    if (part === undefined) return null;
    if (segment.type === 'static' && segment.value !== part) return null;
    if (segment.type === 'dynamic') params[segment.name] = part;
  }
  return parts.length === segments.length ? params : null;
}

/** 两个模式中更具体的排在前面 */
function compare(a: readonly Segment[], b: readonly Segment[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    // 一个模式已经没有段了：这样的两个模式不会同时匹配同一个地址，给它一个最小的值即可
    const x = a[i];
    const y = b[i];
    const rx = x === undefined ? -1 : RANK[x.type];
    const ry = y === undefined ? -1 : RANK[y.type];
    const diff = ry - rx;
    if (diff !== 0) return diff;
  }
  return 0;
}

/** 在 patterns 中找出匹配 pathname 的最具体的那一个 */
export function matchRoute(patterns: readonly string[], pathname: string): Match | null {
  // 空的段（结尾的 / 或者 //）：Next.js 先用 308 转到规范的地址，不在这里匹配
  const raw = pathname === '/' ? [] : pathname.slice(1).split('/');
  if (raw.includes('')) return null;
  let parts: string[];
  try {
    parts = raw.map((s) => decodeURIComponent(s));
  } catch {
    return null;
  }
  const candidates = patterns
    .map((pattern) => ({ pattern, segments: parse(pattern) }));
  for (const { pattern, segments } of candidates) {
    const params = tryMatch(segments, parts);
    if (params !== null) return { pattern, params };
  }
  return null;
}
```
:::

:::variant{kind=wrong name=longest-first fails=tests reason="按模式的长度排序：/projects/[id] 比 /projects/new 长，反而排在了前面"}
```ts file=match.ts
export type Params = Record<string, string | string[]>;
export type Match = Readonly<{ pattern: string; params: Params }>;

type Segment =
  | { type: 'static'; value: string }
  | { type: 'dynamic'; name: string }
  | { type: 'catch-all'; name: string }
  | { type: 'optional'; name: string };

/** 越具体越大：同一个位置上，固定的段优先于动态段，动态段优先于捕获段 */
const RANK: Record<Segment['type'], number> = { static: 3, dynamic: 2, 'catch-all': 1, optional: 0 };

function parse(pattern: string): Segment[] {
  return pattern
    .split('/')
    .filter((s) => s !== '')
    .map((s): Segment => {
      let m = /^\[\[\.\.\.(\w+)\]\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'optional', name: m[1] };
      m = /^\[\.\.\.(\w+)\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'catch-all', name: m[1] };
      m = /^\[(\w+)\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'dynamic', name: m[1] };
      return { type: 'static', value: s };
    });
}

/** 用一个模式匹配已经解码的各段；匹配时返回参数 */
function tryMatch(segments: readonly Segment[], parts: readonly string[]): Params | null {
  const params: Params = {};
  for (const [i, segment] of segments.entries()) {
    const part = parts[i];
    if (segment.type === 'catch-all' || segment.type === 'optional') {
      const rest = parts.slice(i);
      if (segment.type === 'catch-all' && rest.length === 0) return null;
      if (rest.length > 0) params[segment.name] = rest;
      return params;
    }
    if (part === undefined) return null;
    if (segment.type === 'static' && segment.value !== part) return null;
    if (segment.type === 'dynamic') params[segment.name] = part;
  }
  return parts.length === segments.length ? params : null;
}

/** 两个模式中更具体的排在前面 */
function compare(a: readonly Segment[], b: readonly Segment[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    // 一个模式已经没有段了：这样的两个模式不会同时匹配同一个地址，给它一个最小的值即可
    const x = a[i];
    const y = b[i];
    const rx = x === undefined ? -1 : RANK[x.type];
    const ry = y === undefined ? -1 : RANK[y.type];
    const diff = ry - rx;
    if (diff !== 0) return diff;
  }
  return 0;
}

/** 在 patterns 中找出匹配 pathname 的最具体的那一个 */
export function matchRoute(patterns: readonly string[], pathname: string): Match | null {
  // 空的段（结尾的 / 或者 //）：Next.js 先用 308 转到规范的地址，不在这里匹配
  const raw = pathname === '/' ? [] : pathname.slice(1).split('/');
  if (raw.includes('')) return null;
  let parts: string[];
  try {
    parts = raw.map((s) => decodeURIComponent(s));
  } catch {
    return null;
  }
  const candidates = patterns
    .map((pattern) => ({ pattern, segments: parse(pattern) }))
    .toSorted((a, b) => b.pattern.length - a.pattern.length);
  for (const { pattern, segments } of candidates) {
    const params = tryMatch(segments, parts);
    if (params !== null) return { pattern, params };
  }
  return null;
}
```
:::

:::variant{kind=wrong name=dynamic-below-catch-all fails=tests reason="把动态段排在了捕获段后面：/api/m/1 匹配了 [...rest]，实测是 [id]"}
```ts file=match.ts
export type Params = Record<string, string | string[]>;
export type Match = Readonly<{ pattern: string; params: Params }>;

type Segment =
  | { type: 'static'; value: string }
  | { type: 'dynamic'; name: string }
  | { type: 'catch-all'; name: string }
  | { type: 'optional'; name: string };

/** 越具体越大：同一个位置上，固定的段优先于动态段，动态段优先于捕获段 */
const RANK: Record<Segment['type'], number> = { static: 3, 'catch-all': 2, optional: 1, dynamic: 0 };

function parse(pattern: string): Segment[] {
  return pattern
    .split('/')
    .filter((s) => s !== '')
    .map((s): Segment => {
      let m = /^\[\[\.\.\.(\w+)\]\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'optional', name: m[1] };
      m = /^\[\.\.\.(\w+)\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'catch-all', name: m[1] };
      m = /^\[(\w+)\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'dynamic', name: m[1] };
      return { type: 'static', value: s };
    });
}

/** 用一个模式匹配已经解码的各段；匹配时返回参数 */
function tryMatch(segments: readonly Segment[], parts: readonly string[]): Params | null {
  const params: Params = {};
  for (const [i, segment] of segments.entries()) {
    const part = parts[i];
    if (segment.type === 'catch-all' || segment.type === 'optional') {
      const rest = parts.slice(i);
      if (segment.type === 'catch-all' && rest.length === 0) return null;
      if (rest.length > 0) params[segment.name] = rest;
      return params;
    }
    if (part === undefined) return null;
    if (segment.type === 'static' && segment.value !== part) return null;
    if (segment.type === 'dynamic') params[segment.name] = part;
  }
  return parts.length === segments.length ? params : null;
}

/** 两个模式中更具体的排在前面 */
function compare(a: readonly Segment[], b: readonly Segment[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    // 一个模式已经没有段了：这样的两个模式不会同时匹配同一个地址，给它一个最小的值即可
    const x = a[i];
    const y = b[i];
    const rx = x === undefined ? -1 : RANK[x.type];
    const ry = y === undefined ? -1 : RANK[y.type];
    const diff = ry - rx;
    if (diff !== 0) return diff;
  }
  return 0;
}

/** 在 patterns 中找出匹配 pathname 的最具体的那一个 */
export function matchRoute(patterns: readonly string[], pathname: string): Match | null {
  // 空的段（结尾的 / 或者 //）：Next.js 先用 308 转到规范的地址，不在这里匹配
  const raw = pathname === '/' ? [] : pathname.slice(1).split('/');
  if (raw.includes('')) return null;
  let parts: string[];
  try {
    parts = raw.map((s) => decodeURIComponent(s));
  } catch {
    return null;
  }
  const candidates = patterns
    .map((pattern) => ({ pattern, segments: parse(pattern) }))
    .toSorted((a, b) => compare(a.segments, b.segments));
  for (const { pattern, segments } of candidates) {
    const params = tryMatch(segments, parts);
    if (params !== null) return { pattern, params };
  }
  return null;
}
```
:::

:::variant{kind=wrong name=no-decode fails=tests reason="参数没有解码：得到的是 %E5%AE%98 而不是 官"}
```ts file=match.ts
export type Params = Record<string, string | string[]>;
export type Match = Readonly<{ pattern: string; params: Params }>;

type Segment =
  | { type: 'static'; value: string }
  | { type: 'dynamic'; name: string }
  | { type: 'catch-all'; name: string }
  | { type: 'optional'; name: string };

/** 越具体越大：同一个位置上，固定的段优先于动态段，动态段优先于捕获段 */
const RANK: Record<Segment['type'], number> = { static: 3, dynamic: 2, 'catch-all': 1, optional: 0 };

function parse(pattern: string): Segment[] {
  return pattern
    .split('/')
    .filter((s) => s !== '')
    .map((s): Segment => {
      let m = /^\[\[\.\.\.(\w+)\]\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'optional', name: m[1] };
      m = /^\[\.\.\.(\w+)\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'catch-all', name: m[1] };
      m = /^\[(\w+)\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'dynamic', name: m[1] };
      return { type: 'static', value: s };
    });
}

/** 用一个模式匹配已经解码的各段；匹配时返回参数 */
function tryMatch(segments: readonly Segment[], parts: readonly string[]): Params | null {
  const params: Params = {};
  for (const [i, segment] of segments.entries()) {
    const part = parts[i];
    if (segment.type === 'catch-all' || segment.type === 'optional') {
      const rest = parts.slice(i);
      if (segment.type === 'catch-all' && rest.length === 0) return null;
      if (rest.length > 0) params[segment.name] = rest;
      return params;
    }
    if (part === undefined) return null;
    if (segment.type === 'static' && segment.value !== part) return null;
    if (segment.type === 'dynamic') params[segment.name] = part;
  }
  return parts.length === segments.length ? params : null;
}

/** 两个模式中更具体的排在前面 */
function compare(a: readonly Segment[], b: readonly Segment[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    // 一个模式已经没有段了：这样的两个模式不会同时匹配同一个地址，给它一个最小的值即可
    const x = a[i];
    const y = b[i];
    const rx = x === undefined ? -1 : RANK[x.type];
    const ry = y === undefined ? -1 : RANK[y.type];
    const diff = ry - rx;
    if (diff !== 0) return diff;
  }
  return 0;
}

/** 在 patterns 中找出匹配 pathname 的最具体的那一个 */
export function matchRoute(patterns: readonly string[], pathname: string): Match | null {
  // 空的段（结尾的 / 或者 //）：Next.js 先用 308 转到规范的地址，不在这里匹配
  const raw = pathname === '/' ? [] : pathname.slice(1).split('/');
  if (raw.includes('')) return null;
  let parts: string[];
  try {
    parts = [...raw];
  } catch {
    return null;
  }
  const candidates = patterns
    .map((pattern) => ({ pattern, segments: parse(pattern) }))
    .toSorted((a, b) => compare(a.segments, b.segments));
  for (const { pattern, segments } of candidates) {
    const params = tryMatch(segments, parts);
    if (params !== null) return { pattern, params };
  }
  return null;
}
```
:::

:::variant{kind=wrong name=decode-whole fails=tests reason="先解码整个地址再分段：编码的 %2F 变成了 /，一段变成了两段"}
```ts file=match.ts
export type Params = Record<string, string | string[]>;
export type Match = Readonly<{ pattern: string; params: Params }>;

type Segment =
  | { type: 'static'; value: string }
  | { type: 'dynamic'; name: string }
  | { type: 'catch-all'; name: string }
  | { type: 'optional'; name: string };

/** 越具体越大：同一个位置上，固定的段优先于动态段，动态段优先于捕获段 */
const RANK: Record<Segment['type'], number> = { static: 3, dynamic: 2, 'catch-all': 1, optional: 0 };

function parse(pattern: string): Segment[] {
  return pattern
    .split('/')
    .filter((s) => s !== '')
    .map((s): Segment => {
      let m = /^\[\[\.\.\.(\w+)\]\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'optional', name: m[1] };
      m = /^\[\.\.\.(\w+)\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'catch-all', name: m[1] };
      m = /^\[(\w+)\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'dynamic', name: m[1] };
      return { type: 'static', value: s };
    });
}

/** 用一个模式匹配已经解码的各段；匹配时返回参数 */
function tryMatch(segments: readonly Segment[], parts: readonly string[]): Params | null {
  const params: Params = {};
  for (const [i, segment] of segments.entries()) {
    const part = parts[i];
    if (segment.type === 'catch-all' || segment.type === 'optional') {
      const rest = parts.slice(i);
      if (segment.type === 'catch-all' && rest.length === 0) return null;
      if (rest.length > 0) params[segment.name] = rest;
      return params;
    }
    if (part === undefined) return null;
    if (segment.type === 'static' && segment.value !== part) return null;
    if (segment.type === 'dynamic') params[segment.name] = part;
  }
  return parts.length === segments.length ? params : null;
}

/** 两个模式中更具体的排在前面 */
function compare(a: readonly Segment[], b: readonly Segment[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    // 一个模式已经没有段了：这样的两个模式不会同时匹配同一个地址，给它一个最小的值即可
    const x = a[i];
    const y = b[i];
    const rx = x === undefined ? -1 : RANK[x.type];
    const ry = y === undefined ? -1 : RANK[y.type];
    const diff = ry - rx;
    if (diff !== 0) return diff;
  }
  return 0;
}

/** 在 patterns 中找出匹配 pathname 的最具体的那一个 */
export function matchRoute(patterns: readonly string[], pathname: string): Match | null {
  // 空的段（结尾的 / 或者 //）：Next.js 先用 308 转到规范的地址，不在这里匹配
  const raw = pathname === '/' ? [] : pathname.slice(1).split('/');
  if (raw.includes('')) return null;
  let parts: string[];
  try {
    parts = decodeURIComponent(pathname).split('/').filter((s) => s !== '');
  } catch {
    return null;
  }
  const candidates = patterns
    .map((pattern) => ({ pattern, segments: parse(pattern) }))
    .toSorted((a, b) => compare(a.segments, b.segments));
  for (const { pattern, segments } of candidates) {
    const params = tryMatch(segments, parts);
    if (params !== null) return { pattern, params };
  }
  return null;
}
```
:::

:::variant{kind=wrong name=catch-all-empty fails=tests reason="捕获段也允许零段：/shop 实测是 404"}
```ts file=match.ts
export type Params = Record<string, string | string[]>;
export type Match = Readonly<{ pattern: string; params: Params }>;

type Segment =
  | { type: 'static'; value: string }
  | { type: 'dynamic'; name: string }
  | { type: 'catch-all'; name: string }
  | { type: 'optional'; name: string };

/** 越具体越大：同一个位置上，固定的段优先于动态段，动态段优先于捕获段 */
const RANK: Record<Segment['type'], number> = { static: 3, dynamic: 2, 'catch-all': 1, optional: 0 };

function parse(pattern: string): Segment[] {
  return pattern
    .split('/')
    .filter((s) => s !== '')
    .map((s): Segment => {
      let m = /^\[\[\.\.\.(\w+)\]\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'optional', name: m[1] };
      m = /^\[\.\.\.(\w+)\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'catch-all', name: m[1] };
      m = /^\[(\w+)\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'dynamic', name: m[1] };
      return { type: 'static', value: s };
    });
}

/** 用一个模式匹配已经解码的各段；匹配时返回参数 */
function tryMatch(segments: readonly Segment[], parts: readonly string[]): Params | null {
  const params: Params = {};
  for (const [i, segment] of segments.entries()) {
    const part = parts[i];
    if (segment.type === 'catch-all' || segment.type === 'optional') {
      const rest = parts.slice(i);
      if (rest.length > 0) params[segment.name] = rest;
      return params;
    }
    if (part === undefined) return null;
    if (segment.type === 'static' && segment.value !== part) return null;
    if (segment.type === 'dynamic') params[segment.name] = part;
  }
  return parts.length === segments.length ? params : null;
}

/** 两个模式中更具体的排在前面 */
function compare(a: readonly Segment[], b: readonly Segment[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    // 一个模式已经没有段了：这样的两个模式不会同时匹配同一个地址，给它一个最小的值即可
    const x = a[i];
    const y = b[i];
    const rx = x === undefined ? -1 : RANK[x.type];
    const ry = y === undefined ? -1 : RANK[y.type];
    const diff = ry - rx;
    if (diff !== 0) return diff;
  }
  return 0;
}

/** 在 patterns 中找出匹配 pathname 的最具体的那一个 */
export function matchRoute(patterns: readonly string[], pathname: string): Match | null {
  // 空的段（结尾的 / 或者 //）：Next.js 先用 308 转到规范的地址，不在这里匹配
  const raw = pathname === '/' ? [] : pathname.slice(1).split('/');
  if (raw.includes('')) return null;
  let parts: string[];
  try {
    parts = raw.map((s) => decodeURIComponent(s));
  } catch {
    return null;
  }
  const candidates = patterns
    .map((pattern) => ({ pattern, segments: parse(pattern) }))
    .toSorted((a, b) => compare(a.segments, b.segments));
  for (const { pattern, segments } of candidates) {
    const params = tryMatch(segments, parts);
    if (params !== null) return { pattern, params };
  }
  return null;
}
```
:::

:::variant{kind=wrong name=optional-empty-array fails=tests reason="可选的捕获段为零段时参数是空数组：实测这时 params 中没有这个键"}
```ts file=match.ts
export type Params = Record<string, string | string[]>;
export type Match = Readonly<{ pattern: string; params: Params }>;

type Segment =
  | { type: 'static'; value: string }
  | { type: 'dynamic'; name: string }
  | { type: 'catch-all'; name: string }
  | { type: 'optional'; name: string };

/** 越具体越大：同一个位置上，固定的段优先于动态段，动态段优先于捕获段 */
const RANK: Record<Segment['type'], number> = { static: 3, dynamic: 2, 'catch-all': 1, optional: 0 };

function parse(pattern: string): Segment[] {
  return pattern
    .split('/')
    .filter((s) => s !== '')
    .map((s): Segment => {
      let m = /^\[\[\.\.\.(\w+)\]\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'optional', name: m[1] };
      m = /^\[\.\.\.(\w+)\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'catch-all', name: m[1] };
      m = /^\[(\w+)\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'dynamic', name: m[1] };
      return { type: 'static', value: s };
    });
}

/** 用一个模式匹配已经解码的各段；匹配时返回参数 */
function tryMatch(segments: readonly Segment[], parts: readonly string[]): Params | null {
  const params: Params = {};
  for (const [i, segment] of segments.entries()) {
    const part = parts[i];
    if (segment.type === 'catch-all' || segment.type === 'optional') {
      const rest = parts.slice(i);
      if (segment.type === 'catch-all' && rest.length === 0) return null;
      params[segment.name] = rest;
      return params;
    }
    if (part === undefined) return null;
    if (segment.type === 'static' && segment.value !== part) return null;
    if (segment.type === 'dynamic') params[segment.name] = part;
  }
  return parts.length === segments.length ? params : null;
}

/** 两个模式中更具体的排在前面 */
function compare(a: readonly Segment[], b: readonly Segment[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    // 一个模式已经没有段了：这样的两个模式不会同时匹配同一个地址，给它一个最小的值即可
    const x = a[i];
    const y = b[i];
    const rx = x === undefined ? -1 : RANK[x.type];
    const ry = y === undefined ? -1 : RANK[y.type];
    const diff = ry - rx;
    if (diff !== 0) return diff;
  }
  return 0;
}

/** 在 patterns 中找出匹配 pathname 的最具体的那一个 */
export function matchRoute(patterns: readonly string[], pathname: string): Match | null {
  // 空的段（结尾的 / 或者 //）：Next.js 先用 308 转到规范的地址，不在这里匹配
  const raw = pathname === '/' ? [] : pathname.slice(1).split('/');
  if (raw.includes('')) return null;
  let parts: string[];
  try {
    parts = raw.map((s) => decodeURIComponent(s));
  } catch {
    return null;
  }
  const candidates = patterns
    .map((pattern) => ({ pattern, segments: parse(pattern) }))
    .toSorted((a, b) => compare(a.segments, b.segments));
  for (const { pattern, segments } of candidates) {
    const params = tryMatch(segments, parts);
    if (params !== null) return { pattern, params };
  }
  return null;
}
```
:::

:::variant{kind=wrong name=drop-empty-segments fails=tests reason="去掉了空的段：/projects/ 和 /projects//p1 也匹配了，实测它们都先被 308 转走"}
```ts file=match.ts
export type Params = Record<string, string | string[]>;
export type Match = Readonly<{ pattern: string; params: Params }>;

type Segment =
  | { type: 'static'; value: string }
  | { type: 'dynamic'; name: string }
  | { type: 'catch-all'; name: string }
  | { type: 'optional'; name: string };

/** 越具体越大：同一个位置上，固定的段优先于动态段，动态段优先于捕获段 */
const RANK: Record<Segment['type'], number> = { static: 3, dynamic: 2, 'catch-all': 1, optional: 0 };

function parse(pattern: string): Segment[] {
  return pattern
    .split('/')
    .filter((s) => s !== '')
    .map((s): Segment => {
      let m = /^\[\[\.\.\.(\w+)\]\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'optional', name: m[1] };
      m = /^\[\.\.\.(\w+)\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'catch-all', name: m[1] };
      m = /^\[(\w+)\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'dynamic', name: m[1] };
      return { type: 'static', value: s };
    });
}

/** 用一个模式匹配已经解码的各段；匹配时返回参数 */
function tryMatch(segments: readonly Segment[], parts: readonly string[]): Params | null {
  const params: Params = {};
  for (const [i, segment] of segments.entries()) {
    const part = parts[i];
    if (segment.type === 'catch-all' || segment.type === 'optional') {
      const rest = parts.slice(i);
      if (segment.type === 'catch-all' && rest.length === 0) return null;
      if (rest.length > 0) params[segment.name] = rest;
      return params;
    }
    if (part === undefined) return null;
    if (segment.type === 'static' && segment.value !== part) return null;
    if (segment.type === 'dynamic') params[segment.name] = part;
  }
  return parts.length === segments.length ? params : null;
}

/** 两个模式中更具体的排在前面 */
function compare(a: readonly Segment[], b: readonly Segment[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    // 一个模式已经没有段了：这样的两个模式不会同时匹配同一个地址，给它一个最小的值即可
    const x = a[i];
    const y = b[i];
    const rx = x === undefined ? -1 : RANK[x.type];
    const ry = y === undefined ? -1 : RANK[y.type];
    const diff = ry - rx;
    if (diff !== 0) return diff;
  }
  return 0;
}

/** 在 patterns 中找出匹配 pathname 的最具体的那一个 */
export function matchRoute(patterns: readonly string[], pathname: string): Match | null {
  // 空的段（结尾的 / 或者 //）：Next.js 先用 308 转到规范的地址，不在这里匹配
  const raw = pathname.split('/').filter((s) => s !== '');
  let parts: string[];
  try {
    parts = raw.map((s) => decodeURIComponent(s));
  } catch {
    return null;
  }
  const candidates = patterns
    .map((pattern) => ({ pattern, segments: parse(pattern) }))
    .toSorted((a, b) => compare(a.segments, b.segments));
  for (const { pattern, segments } of candidates) {
    const params = tryMatch(segments, parts);
    if (params !== null) return { pattern, params };
  }
  return null;
}
```
:::

:::variant{kind=wrong name=ignore-case fails=tests reason="不区分大小写：实测 /Projects 是 404"}
```ts file=match.ts
export type Params = Record<string, string | string[]>;
export type Match = Readonly<{ pattern: string; params: Params }>;

type Segment =
  | { type: 'static'; value: string }
  | { type: 'dynamic'; name: string }
  | { type: 'catch-all'; name: string }
  | { type: 'optional'; name: string };

/** 越具体越大：同一个位置上，固定的段优先于动态段，动态段优先于捕获段 */
const RANK: Record<Segment['type'], number> = { static: 3, dynamic: 2, 'catch-all': 1, optional: 0 };

function parse(pattern: string): Segment[] {
  return pattern
    .split('/')
    .filter((s) => s !== '')
    .map((s): Segment => {
      let m = /^\[\[\.\.\.(\w+)\]\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'optional', name: m[1] };
      m = /^\[\.\.\.(\w+)\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'catch-all', name: m[1] };
      m = /^\[(\w+)\]$/.exec(s);
      if (m?.[1] !== undefined) return { type: 'dynamic', name: m[1] };
      return { type: 'static', value: s };
    });
}

/** 用一个模式匹配已经解码的各段；匹配时返回参数 */
function tryMatch(segments: readonly Segment[], parts: readonly string[]): Params | null {
  const params: Params = {};
  for (const [i, segment] of segments.entries()) {
    const part = parts[i];
    if (segment.type === 'catch-all' || segment.type === 'optional') {
      const rest = parts.slice(i);
      if (segment.type === 'catch-all' && rest.length === 0) return null;
      if (rest.length > 0) params[segment.name] = rest;
      return params;
    }
    if (part === undefined) return null;
    if (segment.type === 'static' && segment.value.toLowerCase() !== part.toLowerCase()) return null;
    if (segment.type === 'dynamic') params[segment.name] = part;
  }
  return parts.length === segments.length ? params : null;
}

/** 两个模式中更具体的排在前面 */
function compare(a: readonly Segment[], b: readonly Segment[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    // 一个模式已经没有段了：这样的两个模式不会同时匹配同一个地址，给它一个最小的值即可
    const x = a[i];
    const y = b[i];
    const rx = x === undefined ? -1 : RANK[x.type];
    const ry = y === undefined ? -1 : RANK[y.type];
    const diff = ry - rx;
    if (diff !== 0) return diff;
  }
  return 0;
}

/** 在 patterns 中找出匹配 pathname 的最具体的那一个 */
export function matchRoute(patterns: readonly string[], pathname: string): Match | null {
  // 空的段（结尾的 / 或者 //）：Next.js 先用 308 转到规范的地址，不在这里匹配
  const raw = pathname === '/' ? [] : pathname.slice(1).split('/');
  if (raw.includes('')) return null;
  let parts: string[];
  try {
    parts = raw.map((s) => decodeURIComponent(s));
  } catch {
    return null;
  }
  const candidates = patterns
    .map((pattern) => ({ pattern, segments: parse(pattern) }))
    .toSorted((a, b) => compare(a.segments, b.segments));
  for (const { pattern, segments } of candidates) {
    const params = tryMatch(segments, parts);
    if (params !== null) return { pattern, params };
  }
  return null;
}
```
:::

