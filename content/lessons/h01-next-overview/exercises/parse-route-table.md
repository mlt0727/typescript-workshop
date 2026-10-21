---
kind: task
title: 读出构建的路由表
---
在 `route-table.ts` 中实现 `parseRouteTable(output)`：从 `next build` 的完整输出中读出 App Router 的路由表。

1. 找到第一个以 `Route (app)` 开头的行（表头），从下一行开始读，读到第一个空行（或者输出的结尾）为止。没有这样的行时返回空数组。换行可能是 `\n` 或 `\r\n`，行尾可能有空格；
2. 表头后面还有别的内容时（例如用了 `'use cache'` 之后会多出 `Revalidate`、`Expire` 两列），这个练习不处理这种格式：抛出 `Error`，错误信息中包含表头这一行；
3. 每一行是：可选的缩进（`│ ` 或者两个空格），树形符号（`┌`、`├`、`└`、`─` 之一，只有一个路由时是 `─`）和一个空格，然后是“一个符号加一个空格”或者“两个空格”，最后是地址。地址以 `/` 开头，一直到行尾，中间没有空白；
4. 有符号的一行是一个路由：`{ path, kind, group }`，`kind` 由符号决定（`SYMBOLS`）。没有缩进的路由 `group` 是 `null`；缩进的路由属于它上面最近的一个组标题，`group` 是那个标题的地址；
5. 没有符号（两个空格）、也没有缩进的一行是组标题，它本身不是一个路由；
6. 其他的行都抛出 `Error`，错误信息中包含这一行的内容：不符合第 3 条格式的（例如省略了一部分路径时的 `[+3 more paths]`，构建较慢时地址后面的耗时 `(512 ms)`），符号不在 `SYMBOLS` 中的，以及缩进的组标题。

:::files{role=starter}
```ts file=route-table.ts
export type RouteKind = 'static' | 'ssg' | 'partial' | 'dynamic';

/** 路由表中的一行：path 是地址，group 是它所在的那一组（动态路由的模式），不在组中时是 null */
export type RouteRow = Readonly<{ path: string; kind: RouteKind; group: string | null }>;

/** next build 路由表中的符号 */
export const SYMBOLS: Readonly<Record<string, RouteKind>> = { '○': 'static', '●': 'ssg', '◐': 'partial', 'ƒ': 'dynamic' };

/** 从 next build 的输出中读出 App Router 的路由表 */
export function parseRouteTable(output: string): RouteRow[] {
  // TODO
  return [];
}
```
```ts file=main.ts
import { parseRouteTable } from './route-table';

const output = `✓ Generating static pages using 12 workers (12/12)

Route (app)
┌ ○ /
├ ƒ /api/echo
├   /projects/[id]
│ ├ ◐ /projects/[id]
│ └ ○ /projects/p1
└ ◐ /time

○  (Static)  prerendered as static content`;

console.log(parseRouteTable(output));
```
:::

:::files{role=solution}
```ts file=route-table.ts
export type RouteKind = 'static' | 'ssg' | 'partial' | 'dynamic';

/** 路由表中的一行：path 是地址，group 是它所在的那一组（动态路由的模式），不在组中时是 null */
export type RouteRow = Readonly<{ path: string; kind: RouteKind; group: string | null }>;

/** next build 路由表中的符号 */
export const SYMBOLS: Readonly<Record<string, RouteKind>> = { '○': 'static', '●': 'ssg', '◐': 'partial', 'ƒ': 'dynamic' };

/** 一行：可选的缩进（“│ ”或两个空格），树形符号和一个空格，然后是“符号 + 空格”或者两个空格，最后是以 / 开头、没有空白的地址 */
const LINE = /^(│ | {2})?[┌├└─] (?:(\S) | {2})(\/\S*)$/;

/** 从 next build 的输出中读出 App Router 的路由表 */
export function parseRouteTable(output: string): RouteRow[] {
  const lines = output.split(/\r?\n/).map((line) => line.trimEnd());
  const start = lines.findIndex((line) => line.startsWith('Route (app)'));
  if (start === -1) return [];
  const header = lines[start] ?? '';
  // 表头后面还有别的列（例如 Revalidate、Expire）：这个格式不认识，不要猜
  if (header !== 'Route (app)') throw new Error(`无法解析：${header}`);
  const rows: RouteRow[] = [];
  let group: string | null = null;
  for (const line of lines.slice(start + 1)) {
    if (line === '') break;
    const match = LINE.exec(line);
    if (match === null) throw new Error(`无法解析：${line}`);
    const [, indent, symbol, path = ''] = match;
    if (symbol === undefined) {
      // 没有符号的一行是一组的标题，下面缩进的几行属于它；组标题本身不会缩进
      if (indent !== undefined) throw new Error(`无法解析：${line}`);
      group = path;
      continue;
    }
    const kind = SYMBOLS[symbol];
    if (kind === undefined) throw new Error(`无法解析：${line}`);
    if (indent === undefined) group = null;
    rows.push({ path, kind, group });
  }
  return rows;
}
```
```ts file=main.ts
import { parseRouteTable } from './route-table';

const output = `✓ Generating static pages using 12 workers (12/12)

Route (app)
┌ ○ /
├ ƒ /api/echo
├   /projects/[id]
│ ├ ◐ /projects/[id]
│ └ ○ /projects/p1
└ ◐ /time

○  (Static)  prerendered as static content`;

console.log(parseRouteTable(output));
```
:::

:::files{role=tests}
```ts file=route-table.test.ts
import { describe, expect, test } from 'vitest';
import { parseRouteTable } from './route-table';

/** 2026-10-21 在本机运行 next build（Next.js 16.4.2，开启 Cache Components）实际得到的输出（中间省略了几行） */
const BUILD = `▲ Next.js 16.4.2 (Turbopack)
- Cache Components enabled
✓ Compiled successfully in 202ms
✓ Generating static pages using 12 workers (12/12) in 553ms

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /about
├ ƒ /api/echo
├ ○ /api/health
├   /docs/[[...slug]]
│ └ ◐ /docs/[[...slug]]
├ ○ /projects
├   /projects/[id]
│ ├ ◐ /projects/[id]
│ ├ ○ /projects/p1
│ └ ○ /projects/p2
├   /shop/[...slug]
│ └ ◐ /shop/[...slug]
└ ◐ /time


○  (Static)             prerendered as static content
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content
ƒ  (Dynamic)            server-rendered on demand
`;

describe('parseRouteTable', () => {
  test('读出每一行的地址和类型；组标题本身不是一行', () => {
    expect(parseRouteTable(BUILD)).toEqual([
      { path: '/', kind: 'static', group: null },
      { path: '/_not-found', kind: 'static', group: null },
      { path: '/about', kind: 'static', group: null },
      { path: '/api/echo', kind: 'dynamic', group: null },
      { path: '/api/health', kind: 'static', group: null },
      { path: '/docs/[[...slug]]', kind: 'partial', group: '/docs/[[...slug]]' },
      { path: '/projects', kind: 'static', group: null },
      { path: '/projects/[id]', kind: 'partial', group: '/projects/[id]' },
      { path: '/projects/p1', kind: 'static', group: '/projects/[id]' },
      { path: '/projects/p2', kind: 'static', group: '/projects/[id]' },
      { path: '/shop/[...slug]', kind: 'partial', group: '/shop/[...slug]' },
      { path: '/time', kind: 'partial', group: null },
    ]);
  });

  test('最后一组的子行用两个空格缩进；没有 Cache Components 时还有 ●', () => {
    const output = ['Route (app)', '┌ ○ /', '├ ● /blog', '└   /products/[id]', '  ├ ◐ /products/[id]', '  └ ◐ /products/1', ''].join('\n');
    expect(parseRouteTable(output)).toEqual([
      { path: '/', kind: 'static', group: null },
      { path: '/blog', kind: 'ssg', group: null },
      { path: '/products/[id]', kind: 'partial', group: '/products/[id]' },
      { path: '/products/1', kind: 'partial', group: '/products/[id]' },
    ]);
  });

  test('组结束之后的一行不再属于这个组', () => {
    const output = ['Route (app)', '├   /a/[id]', '│ └ ○ /a/1', '└ ƒ /b'].join('\n');
    expect(parseRouteTable(output)).toEqual([
      { path: '/a/1', kind: 'static', group: '/a/[id]' },
      { path: '/b', kind: 'dynamic', group: null },
    ]);
  });

  test('Windows 的换行、行尾的空格都不影响结果', () => {
    expect(parseRouteTable('Route (app)\r\n┌ ○ /   \r\n└ ƒ /api/echo\r\n\r\n')).toEqual([
      { path: '/', kind: 'static', group: null },
      { path: '/api/echo', kind: 'dynamic', group: null },
    ]);
  });

  test('没有路由表：空数组', () => {
    expect(parseRouteTable('Error: Route "/docs/[[...slug]]": Next.js encountered uncached or runtime data during prerendering.')).toEqual([]);
  });

  test('只有一个路由时，树形符号是 ─', () => {
    expect(parseRouteTable('Route (app)\n─ ○ /\n')).toEqual([{ path: '/', kind: 'static', group: null }]);
  });

  test('只读 App Router 的那一张表，后面的 Route (pages) 不读', () => {
    const output = ['Route (app)', '┌ ○ /', '└ ○ /_not-found', '', 'Route (pages)', '┌ ○ /legacy', '└ ○ /404', ''].join('\n');
    expect(parseRouteTable(output)).toEqual([
      { path: '/', kind: 'static', group: null },
      { path: '/_not-found', kind: 'static', group: null },
    ]);
    expect(parseRouteTable('Route (pages)\n┌ ○ /legacy\n└ ○ /404\n')).toEqual([]);
  });

  test('认不出来的一行：抛出错误，错误信息中包含这一行', () => {
    expect(() => parseRouteTable('Route (app)\n├ ? /x\n')).toThrow('├ ? /x');
    expect(() => parseRouteTable('Route (app)\n/x\n')).toThrow('/x');
    expect(() => parseRouteTable('Route (app)\n├ ○  /x\n')).toThrow('├ ○  /x');
    expect(() => parseRouteTable('Route (app)\n├   /a/[id]\n│ ├   /a/x\n')).toThrow('│ ├   /a/x');
  });

  test('不认识的格式也要报错：别的列、省略的路径、耗时', () => {
    const withColumns = ['Route (app)           Revalidate  Expire', '┌ ○ /', '├ ○ /products                15m      1y', ''].join('\n');
    expect(() => parseRouteTable(withColumns)).toThrow('Revalidate');
    expect(() => parseRouteTable('Route (app)\n├   /p/[id]\n│ ├ ○ /p/1\n│ └ ○ [+3 more paths]\n')).toThrow('[+3 more paths]');
    expect(() => parseRouteTable('Route (app)\n└ ○ /slow (512 ms)\n')).toThrow('/slow (512 ms)');
  });
});
```
:::

:::hint{level=1}
`output.split(/\r?\n/)` 分成行，再 `trimEnd()`；`lines.findIndex((line) => line.startsWith('Route (app)'))` 找到表头，它不正好是 `'Route (app)'` 时报错。每一行用一个正则匹配，三个分组分别是缩进、符号和地址（正文示例中的正则还要改两处：树形符号加上 `─`，地址改成 `\/\S*`）；符号是 `undefined` 时，这一行是组标题。
:::

:::hint{level=2}
用一个变量 `group` 记住当前的组：遇到组标题时设为它的地址；遇到没有缩进的路由时设为 `null`；有缩进的路由使用 `group` 当前的值。`SYMBOLS[symbol]` 的类型是 `RouteKind | undefined`，是 `undefined` 时抛出错误。
:::

:::explanation
构建输出是给人看的，不是给程序读的：树形的线条、对齐用的空格、符号都只是为了好看。把它变成结构化的数据，就要先把格式描述清楚，再一行一行地按这个格式读。格式之外的行要报错，而不是悄悄跳过：Next.js 换了一种输出的格式，解析的程序应该大声地失败，而不是返回一个看起来正常、其实少了几行的结果。

这张表实际上还有几种这个练习没有处理的样子（都来自 Next.js 16.4.2 打印路由表的代码和随包的文档）：用了缓存的路由后面有 `Revalidate`、`Expire` 两列；生成的路径太多时只列出几条，最后一行是 `[+N more paths]`；预渲染较慢的页面后面有耗时。地址必须以 `/` 开头、不能有空白，这两条规则让这些行都会报错，而不是被读成一个奇怪的地址。

组的处理是一个小的状态机：组标题打开一个组，后面缩进的行属于它，下一个没有缩进的行结束它。最后一组的子行前面是两个空格而不是 `│ `，因为下面已经没有别的行，不需要竖线了。

真实的项目中，最好不要依赖这种给人看的输出：Next.js 在 `.next/` 中也会生成描述构建结果的文件。但这些文件的格式同样可能随版本变化，解析时的原则是一样的。

替代解不用正则，按位置读出每一部分。
:::

:::variant{kind=alt name=by-position}
```ts file=route-table.ts
export type RouteKind = 'static' | 'ssg' | 'partial' | 'dynamic';

/** 路由表中的一行：path 是地址，group 是它所在的那一组（动态路由的模式），不在组中时是 null */
export type RouteRow = Readonly<{ path: string; kind: RouteKind; group: string | null }>;

/** next build 路由表中的符号 */
export const SYMBOLS: Readonly<Record<string, RouteKind>> = { '○': 'static', '●': 'ssg', '◐': 'partial', 'ƒ': 'dynamic' };

const kindOf = (symbol: string): RouteKind | undefined => (Object.hasOwn(SYMBOLS, symbol) ? SYMBOLS[symbol] : undefined);

/** 不用正则，按位置读：缩进 2 个字符，树形符号 2 个字符，符号 2 个字符，剩下的是地址 */
export function parseRouteTable(output: string): RouteRow[] {
  const all = output.split('\n').map((line) => line.replace(/\s+$/, ''));
  const from = all.findIndex((line) => line.startsWith('Route (app)'));
  if (from < 0) return [];
  if (all[from] !== 'Route (app)') throw new Error(`无法解析：${all[from] ?? ''}`);
  const end = all.indexOf('', from);
  const rows: RouteRow[] = [];
  let group: string | null = null;
  for (const line of all.slice(from + 1, end === -1 ? undefined : end)) {
    const nested = line.startsWith('│ ') || line.startsWith('  ');
    const rest = nested ? line.slice(2) : line;
    const path = rest.slice(4);
    const validPath = path.startsWith('/') && !/\s/.test(path);
    if (!'┌├└─'.includes(rest.charAt(0)) || rest.charAt(1) !== ' ' || rest.charAt(3) !== ' ' || !validPath) {
      throw new Error(`无法解析：${line}`);
    }
    const symbol = rest.charAt(2);
    if (symbol === ' ') {
      if (nested) throw new Error(`无法解析：${line}`);
      group = path;
      continue;
    }
    const kind = kindOf(symbol);
    if (kind === undefined) throw new Error(`无法解析：${line}`);
    if (!nested) group = null;
    rows.push({ path, kind, group });
  }
  return rows;
}
```
```ts file=main.ts
import { parseRouteTable } from './route-table';

const output = `✓ Generating static pages using 12 workers (12/12)

Route (app)
┌ ○ /
├ ƒ /api/echo
├   /projects/[id]
│ ├ ◐ /projects/[id]
│ └ ○ /projects/p1
└ ◐ /time

○  (Static)  prerendered as static content`;

console.log(parseRouteTable(output));
```
:::

:::variant{kind=wrong name=no-groups fails=tests reason="没有记录行所在的组：看不出 /projects/p1 是 /projects/[id] 生成的"}
```ts file=route-table.ts
export type RouteKind = 'static' | 'ssg' | 'partial' | 'dynamic';

/** 路由表中的一行：path 是地址，group 是它所在的那一组（动态路由的模式），不在组中时是 null */
export type RouteRow = Readonly<{ path: string; kind: RouteKind; group: string | null }>;

/** next build 路由表中的符号 */
export const SYMBOLS: Readonly<Record<string, RouteKind>> = { '○': 'static', '●': 'ssg', '◐': 'partial', 'ƒ': 'dynamic' };

/** 一行：可选的缩进（“│ ”或两个空格），树形符号和一个空格，然后是“符号 + 空格”或者两个空格，最后是以 / 开头、没有空白的地址 */
const LINE = /^(│ | {2})?[┌├└─] (?:(\S) | {2})(\/\S*)$/;

/** 从 next build 的输出中读出 App Router 的路由表 */
export function parseRouteTable(output: string): RouteRow[] {
  const lines = output.split(/\r?\n/).map((line) => line.trimEnd());
  const start = lines.findIndex((line) => line.startsWith('Route (app)'));
  if (start === -1) return [];
  const header = lines[start] ?? '';
  // 表头后面还有别的列（例如 Revalidate、Expire）：这个格式不认识，不要猜
  if (header !== 'Route (app)') throw new Error(`无法解析：${header}`);
  const rows: RouteRow[] = [];
  let group: string | null = null;
  for (const line of lines.slice(start + 1)) {
    if (line === '') break;
    const match = LINE.exec(line);
    if (match === null) throw new Error(`无法解析：${line}`);
    const [, indent, symbol, path = ''] = match;
    if (symbol === undefined) {
      // 没有符号的一行是一组的标题，下面缩进的几行属于它；组标题本身不会缩进
      if (indent !== undefined) throw new Error(`无法解析：${line}`);
      group = path;
      continue;
    }
    const kind = SYMBOLS[symbol];
    if (kind === undefined) throw new Error(`无法解析：${line}`);
    if (indent === undefined) group = null;
    rows.push({ path, kind, group: null });
  }
  return rows;
}
```
```ts file=main.ts
import { parseRouteTable } from './route-table';

const output = `✓ Generating static pages using 12 workers (12/12)

Route (app)
┌ ○ /
├ ƒ /api/echo
├   /projects/[id]
│ ├ ◐ /projects/[id]
│ └ ○ /projects/p1
└ ◐ /time

○  (Static)  prerendered as static content`;

console.log(parseRouteTable(output));
```
:::

:::variant{kind=wrong name=bar-indent-only fails=tests reason="缩进只认 │ ：最后一组用两个空格缩进的行读不出来"}
```ts file=route-table.ts
export type RouteKind = 'static' | 'ssg' | 'partial' | 'dynamic';

/** 路由表中的一行：path 是地址，group 是它所在的那一组（动态路由的模式），不在组中时是 null */
export type RouteRow = Readonly<{ path: string; kind: RouteKind; group: string | null }>;

/** next build 路由表中的符号 */
export const SYMBOLS: Readonly<Record<string, RouteKind>> = { '○': 'static', '●': 'ssg', '◐': 'partial', 'ƒ': 'dynamic' };

/** 一行：可选的缩进（“│ ”或两个空格），树形符号和一个空格，然后是“符号 + 空格”或者两个空格，最后是以 / 开头、没有空白的地址 */
const LINE = /^(│ )?[┌├└─] (?:(\S) | {2})(\/\S*)$/;

/** 从 next build 的输出中读出 App Router 的路由表 */
export function parseRouteTable(output: string): RouteRow[] {
  const lines = output.split(/\r?\n/).map((line) => line.trimEnd());
  const start = lines.findIndex((line) => line.startsWith('Route (app)'));
  if (start === -1) return [];
  const header = lines[start] ?? '';
  // 表头后面还有别的列（例如 Revalidate、Expire）：这个格式不认识，不要猜
  if (header !== 'Route (app)') throw new Error(`无法解析：${header}`);
  const rows: RouteRow[] = [];
  let group: string | null = null;
  for (const line of lines.slice(start + 1)) {
    if (line === '') break;
    const match = LINE.exec(line);
    if (match === null) throw new Error(`无法解析：${line}`);
    const [, indent, symbol, path = ''] = match;
    if (symbol === undefined) {
      // 没有符号的一行是一组的标题，下面缩进的几行属于它；组标题本身不会缩进
      if (indent !== undefined) throw new Error(`无法解析：${line}`);
      group = path;
      continue;
    }
    const kind = SYMBOLS[symbol];
    if (kind === undefined) throw new Error(`无法解析：${line}`);
    if (indent === undefined) group = null;
    rows.push({ path, kind, group });
  }
  return rows;
}
```
```ts file=main.ts
import { parseRouteTable } from './route-table';

const output = `✓ Generating static pages using 12 workers (12/12)

Route (app)
┌ ○ /
├ ƒ /api/echo
├   /projects/[id]
│ ├ ◐ /projects/[id]
│ └ ○ /projects/p1
└ ◐ /time

○  (Static)  prerendered as static content`;

console.log(parseRouteTable(output));
```
:::

:::variant{kind=wrong name=skip-unknown fails=tests reason="读不懂的行直接跳过：格式变了也不会报错，结果悄悄少了几行"}
```ts file=route-table.ts
export type RouteKind = 'static' | 'ssg' | 'partial' | 'dynamic';

/** 路由表中的一行：path 是地址，group 是它所在的那一组（动态路由的模式），不在组中时是 null */
export type RouteRow = Readonly<{ path: string; kind: RouteKind; group: string | null }>;

/** next build 路由表中的符号 */
export const SYMBOLS: Readonly<Record<string, RouteKind>> = { '○': 'static', '●': 'ssg', '◐': 'partial', 'ƒ': 'dynamic' };

/** 一行：可选的缩进（“│ ”或两个空格），树形符号和一个空格，然后是“符号 + 空格”或者两个空格，最后是以 / 开头、没有空白的地址 */
const LINE = /^(│ | {2})?[┌├└─] (?:(\S) | {2})(\/\S*)$/;

/** 从 next build 的输出中读出 App Router 的路由表 */
export function parseRouteTable(output: string): RouteRow[] {
  const lines = output.split(/\r?\n/).map((line) => line.trimEnd());
  const start = lines.findIndex((line) => line.startsWith('Route (app)'));
  if (start === -1) return [];
  const header = lines[start] ?? '';
  // 表头后面还有别的列（例如 Revalidate、Expire）：这个格式不认识，不要猜
  if (header !== 'Route (app)') return [];
  const rows: RouteRow[] = [];
  let group: string | null = null;
  for (const line of lines.slice(start + 1)) {
    if (line === '') break;
    const match = LINE.exec(line);
    if (match === null) continue;
    const [, indent, symbol, path = ''] = match;
    if (symbol === undefined) {
      // 没有符号的一行是一组的标题，下面缩进的几行属于它；组标题本身不会缩进
      if (indent !== undefined) throw new Error(`无法解析：${line}`);
      group = path;
      continue;
    }
    const kind = SYMBOLS[symbol];
    if (kind === undefined) continue;
    if (indent === undefined) group = null;
    rows.push({ path, kind, group });
  }
  return rows;
}
```
```ts file=main.ts
import { parseRouteTable } from './route-table';

const output = `✓ Generating static pages using 12 workers (12/12)

Route (app)
┌ ○ /
├ ƒ /api/echo
├   /projects/[id]
│ ├ ◐ /projects/[id]
│ └ ○ /projects/p1
└ ◐ /time

○  (Static)  prerendered as static content`;

console.log(parseRouteTable(output));
```
:::

:::variant{kind=wrong name=no-trim fails=tests reason="没有处理 Windows 的换行（CRLF）：这样的输出一行也读不出来"}
```ts file=route-table.ts
export type RouteKind = 'static' | 'ssg' | 'partial' | 'dynamic';

/** 路由表中的一行：path 是地址，group 是它所在的那一组（动态路由的模式），不在组中时是 null */
export type RouteRow = Readonly<{ path: string; kind: RouteKind; group: string | null }>;

/** next build 路由表中的符号 */
export const SYMBOLS: Readonly<Record<string, RouteKind>> = { '○': 'static', '●': 'ssg', '◐': 'partial', 'ƒ': 'dynamic' };

/** 一行：可选的缩进（“│ ”或两个空格），树形符号和一个空格，然后是“符号 + 空格”或者两个空格，最后是以 / 开头、没有空白的地址 */
const LINE = /^(│ | {2})?[┌├└─] (?:(\S) | {2})(\/\S*)$/;

/** 从 next build 的输出中读出 App Router 的路由表 */
export function parseRouteTable(output: string): RouteRow[] {
  const lines = output.split('\n');
  const start = lines.findIndex((line) => line.startsWith('Route (app)'));
  if (start === -1) return [];
  const header = lines[start] ?? '';
  // 表头后面还有别的列（例如 Revalidate、Expire）：这个格式不认识，不要猜
  if (header !== 'Route (app)') throw new Error(`无法解析：${header}`);
  const rows: RouteRow[] = [];
  let group: string | null = null;
  for (const line of lines.slice(start + 1)) {
    if (line === '') break;
    const match = LINE.exec(line);
    if (match === null) throw new Error(`无法解析：${line}`);
    const [, indent, symbol, path = ''] = match;
    if (symbol === undefined) {
      // 没有符号的一行是一组的标题，下面缩进的几行属于它；组标题本身不会缩进
      if (indent !== undefined) throw new Error(`无法解析：${line}`);
      group = path;
      continue;
    }
    const kind = SYMBOLS[symbol];
    if (kind === undefined) throw new Error(`无法解析：${line}`);
    if (indent === undefined) group = null;
    rows.push({ path, kind, group });
  }
  return rows;
}
```
```ts file=main.ts
import { parseRouteTable } from './route-table';

const output = `✓ Generating static pages using 12 workers (12/12)

Route (app)
┌ ○ /
├ ƒ /api/echo
├   /projects/[id]
│ ├ ◐ /projects/[id]
│ └ ○ /projects/p1
└ ◐ /time

○  (Static)  prerendered as static content`;

console.log(parseRouteTable(output));
```
:::

:::variant{kind=wrong name=any-path fails=tests reason="地址可以是任何内容：[+3 more paths] 和带耗时的行被读成了奇怪的地址"}
```ts file=route-table.ts
export type RouteKind = 'static' | 'ssg' | 'partial' | 'dynamic';

/** 路由表中的一行：path 是地址，group 是它所在的那一组（动态路由的模式），不在组中时是 null */
export type RouteRow = Readonly<{ path: string; kind: RouteKind; group: string | null }>;

/** next build 路由表中的符号 */
export const SYMBOLS: Readonly<Record<string, RouteKind>> = { '○': 'static', '●': 'ssg', '◐': 'partial', 'ƒ': 'dynamic' };

/** 一行：可选的缩进（“│ ”或两个空格），树形符号和一个空格，然后是“符号 + 空格”或者两个空格，最后是以 / 开头、没有空白的地址 */
const LINE = /^(│ | {2})?[┌├└─] (?:(\S) | {2})(\S.*)$/;

/** 从 next build 的输出中读出 App Router 的路由表 */
export function parseRouteTable(output: string): RouteRow[] {
  const lines = output.split(/\r?\n/).map((line) => line.trimEnd());
  const start = lines.findIndex((line) => line.startsWith('Route (app)'));
  if (start === -1) return [];
  const header = lines[start] ?? '';
  // 表头后面还有别的列（例如 Revalidate、Expire）：这个格式不认识，不要猜
  if (header !== 'Route (app)') throw new Error(`无法解析：${header}`);
  const rows: RouteRow[] = [];
  let group: string | null = null;
  for (const line of lines.slice(start + 1)) {
    if (line === '') break;
    const match = LINE.exec(line);
    if (match === null) throw new Error(`无法解析：${line}`);
    const [, indent, symbol, path = ''] = match;
    if (symbol === undefined) {
      // 没有符号的一行是一组的标题，下面缩进的几行属于它；组标题本身不会缩进
      if (indent !== undefined) throw new Error(`无法解析：${line}`);
      group = path;
      continue;
    }
    const kind = SYMBOLS[symbol];
    if (kind === undefined) throw new Error(`无法解析：${line}`);
    if (indent === undefined) group = null;
    rows.push({ path, kind, group });
  }
  return rows;
}
```
```ts file=main.ts
import { parseRouteTable } from './route-table';

const output = `✓ Generating static pages using 12 workers (12/12)

Route (app)
┌ ○ /
├ ƒ /api/echo
├   /projects/[id]
│ ├ ◐ /projects/[id]
│ └ ○ /projects/p1
└ ◐ /time

○  (Static)  prerendered as static content`;

console.log(parseRouteTable(output));
```
:::

