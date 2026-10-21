---
kind: challenge
title: 比较两次构建
---
在 CI 中，每次构建之后可以把路由表和上一次的比较：一个页面从 ○ 变成了 ◐、一个 Route Handler 从 ○ 变成了 ƒ，往往说明有人让它（或者它的一部分）每次请求都要在服务器上运行。在 `compare.ts` 中实现（`route-table.ts` 是上一个练习的答案，只读）：

1. `compareBuilds(before, after)`：参数是两次 `next build` 的完整输出。用 `parseRouteTable` 读出路由表，按地址比较：
   - 只在 `after` 中有：`{ type: 'added', path, kind }`；
   - 只在 `before` 中有：`{ type: 'removed', path, kind }`；
   - 两边都有，类型不同：`{ type: 'changed', path, from, to, worse }`。`worse` 表示变得更“动态”：按 ○ 和 ● 为 0、◐ 为 1、ƒ 为 2 排序，`to` 比 `from` 大时为 `true`；
   - 类型相同：不是变化，不出现；
   - 结果按地址排序：直接用 `<`、`>` 比较字符串（按 UTF-16 码元比较，大写字母排在小写字母前面），不用 `localeCompare`；
2. `regressions(changes)`：需要人看一眼的变化，即消失的页面和 `worse` 为 `true` 的变化，保持原来的顺序。

:::files{role=starter}
```ts file=compare.ts
import { parseRouteTable, type RouteKind } from './route-table';

export type Change =
  | { type: 'added'; path: string; kind: RouteKind }
  | { type: 'removed'; path: string; kind: RouteKind }
  | { type: 'changed'; path: string; from: RouteKind; to: RouteKind; worse: boolean };

/** 比较两次构建的路由表，按地址排序返回所有的变化 */
export function compareBuilds(before: string, after: string): Change[] {
  // TODO
  return [];
}

/** 需要人看一眼的变化：页面消失了，或者变得更“动态”了 */
export function regressions(changes: readonly Change[]): Change[] {
  // TODO
  return [];
}
```
:::

:::files{role=support}
```ts file=route-table.ts readonly
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
```ts file=main.ts readonly
import { compareBuilds, regressions } from './compare';

const before = 'Route (app)\n┌ ○ /\n├ ○ /about\n└ ○ /pricing\n';
const after = 'Route (app)\n┌ ○ /\n├ ƒ /about\n└ ○ /blog\n';

const changes = compareBuilds(before, after);
console.log(changes);
console.log('需要看一眼：', regressions(changes).map((c) => c.path));
```
:::

:::files{role=solution}
```ts file=compare.ts
import { parseRouteTable, type RouteKind } from './route-table';

export type Change =
  | { type: 'added'; path: string; kind: RouteKind }
  | { type: 'removed'; path: string; kind: RouteKind }
  | { type: 'changed'; path: string; from: RouteKind; to: RouteKind; worse: boolean };

/** 越大越“动态”：静态的页面可以直接从 CDN 返回，动态的页面每次都要在服务器上渲染 */
const RANK: Record<RouteKind, number> = { static: 0, ssg: 0, partial: 1, dynamic: 2 };

/** 比较两次构建的路由表，按地址排序返回所有的变化 */
export function compareBuilds(before: string, after: string): Change[] {
  const old = new Map(parseRouteTable(before).map((row) => [row.path, row.kind]));
  const now = new Map(parseRouteTable(after).map((row) => [row.path, row.kind]));
  const changes: Change[] = [];
  for (const [path, kind] of now) {
    const from = old.get(path);
    if (from === undefined) changes.push({ type: 'added', path, kind });
    else if (from !== kind) changes.push({ type: 'changed', path, from, to: kind, worse: RANK[kind] > RANK[from] });
  }
  for (const [path, kind] of old) {
    if (!now.has(path)) changes.push({ type: 'removed', path, kind });
  }
  return changes.toSorted((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** 需要人看一眼的变化：页面消失了，或者变得更“动态”了 */
export function regressions(changes: readonly Change[]): Change[] {
  return changes.filter((c) => c.type === 'removed' || (c.type === 'changed' && c.worse));
}
```
:::

:::files{role=tests}
```ts file=compare.test.ts
import { describe, expect, test } from 'vitest';
import { compareBuilds, regressions } from './compare';

const table = (...lines: string[]) => ['✓ Compiled successfully', '', 'Route (app)', ...lines, '', '○  (Static)  prerendered as static content'].join('\n');

const BEFORE = table('┌ ○ /', '├ ○ /about', '├ ○ /api/health', '├   /projects/[id]', '│ ├ ◐ /projects/[id]', '│ └ ○ /projects/p1', '└ ○ /pricing');
const AFTER = table('┌ ○ /', '├ ◐ /about', '├ ƒ /api/health', '├   /projects/[id]', '│ ├ ◐ /projects/[id]', '│ ├ ○ /projects/p1', '│ └ ○ /projects/p2', '└ ○ /blog');

describe('compareBuilds', () => {
  test('新增、消失、类型变了的页面，按地址排序；没有变化的不出现', () => {
    expect(compareBuilds(BEFORE, AFTER)).toEqual([
      { type: 'changed', path: '/about', from: 'static', to: 'partial', worse: true },
      { type: 'changed', path: '/api/health', from: 'static', to: 'dynamic', worse: true },
      { type: 'added', path: '/blog', kind: 'static' },
      { type: 'removed', path: '/pricing', kind: 'static' },
      { type: 'added', path: '/projects/p2', kind: 'static' },
    ]);
  });

  test('变得更静态不算变差；○ 和 ● 一样静态', () => {
    expect(compareBuilds(table('├ ƒ /a', '├ ◐ /b', '├ ● /c', '└ ○ /d'), table('├ ◐ /a', '├ ○ /b', '├ ○ /c', '└ ● /d'))).toEqual([
      { type: 'changed', path: '/a', from: 'dynamic', to: 'partial', worse: false },
      { type: 'changed', path: '/b', from: 'partial', to: 'static', worse: false },
      { type: 'changed', path: '/c', from: 'ssg', to: 'static', worse: false },
      { type: 'changed', path: '/d', from: 'static', to: 'ssg', worse: false },
    ]);
  });

  test('直接比较字符串排序：大写字母排在小写字母前面', () => {
    expect(compareBuilds(table('└ ○ /'), table('├ ○ /apple', '├ ○ /Zebra', '└ ○ /'))).toEqual([
      { type: 'added', path: '/Zebra', kind: 'static' },
      { type: 'added', path: '/apple', kind: 'static' },
    ]);
  });

  test('两次一样：没有变化', () => {
    expect(compareBuilds(BEFORE, BEFORE)).toEqual([]);
  });

  test('之前的构建失败了（没有路由表）：所有页面都是新增的', () => {
    expect(compareBuilds('Error: build failed', table('┌ ○ /', '└ ƒ /api/echo'))).toEqual([
      { type: 'added', path: '/', kind: 'static' },
      { type: 'added', path: '/api/echo', kind: 'dynamic' },
    ]);
  });
});

describe('regressions', () => {
  test('只留下消失的页面和变差的页面', () => {
    expect(regressions(compareBuilds(BEFORE, AFTER)).map((c) => c.path)).toEqual(['/about', '/api/health', '/pricing']);
  });

  test('变得更静态、新增的页面都不算', () => {
    expect(regressions(compareBuilds(table('└ ƒ /a'), table('├ ○ /a', '└ ○ /b')))).toEqual([]);
  });
});
```
:::

:::hint{level=1}
把两次的路由表各变成一个 `Map`：地址 → 类型。遍历新的一个，找出新增和变化的；再遍历旧的一个，找出消失的。最后用 `toSorted` 按 `path` 排序。
:::

:::hint{level=2}
“动态的程度”写成一张表：`const RANK: Record<RouteKind, number> = { static: 0, ssg: 0, partial: 1, dynamic: 2 }`，`worse` 就是 `RANK[to] > RANK[from]`。`Record<RouteKind, number>` 保证四种类型都有一个值。
:::

:::explanation
比较两个集合的常见做法：各自变成以“身份”（这里是地址）为键的 `Map`，然后分三种情况：只在新的中有、只在旧的中有、两边都有但值不同。`Change` 是一个可辨识联合，每一种变化带着它需要的字段：新增和消失只有一个 `kind`，变化有 `from`、`to` 和 `worse`。

“动态的程度”不是一个直接可以比较的值，所以用一张表把它映射成数字。`○` 和 `●` 都是构建时生成的完整 HTML，对部署和性能来说一样，所以排在同一级：两者之间的变化会被报告，但不算变差。

`regressions` 是给人看的：新增的页面通常是有意的，变得更静态是好事；消失的页面和变得更动态的页面，才值得在合并之前确认一下。

替代解先收集两边出现过的所有地址、排好序，再对每个地址判断属于哪一种情况。
:::

:::variant{kind=alt name=all-paths-first}
```ts file=compare.ts
import { parseRouteTable, type RouteKind } from './route-table';

export type Change =
  | { type: 'added'; path: string; kind: RouteKind }
  | { type: 'removed'; path: string; kind: RouteKind }
  | { type: 'changed'; path: string; from: RouteKind; to: RouteKind; worse: boolean };

const RANK: Record<RouteKind, number> = { static: 0, ssg: 0, partial: 1, dynamic: 2 };

const kinds = (output: string): Record<string, RouteKind> => Object.fromEntries(parseRouteTable(output).map((r) => [r.path, r.kind]));

export function compareBuilds(before: string, after: string): Change[] {
  const a = kinds(before);
  const b = kinds(after);
  // 两边出现过的所有地址，先排好序
  const paths = [...new Set([...Object.keys(a), ...Object.keys(b)])].toSorted();
  return paths.flatMap((path): Change[] => {
    const from = a[path];
    const to = b[path];
    if (from === undefined && to !== undefined) return [{ type: 'added', path, kind: to }];
    if (from !== undefined && to === undefined) return [{ type: 'removed', path, kind: from }];
    if (from !== undefined && to !== undefined && from !== to) return [{ type: 'changed', path, from, to, worse: RANK[to] > RANK[from] }];
    return [];
  });
}

export function regressions(changes: readonly Change[]): Change[] {
  return changes.filter((c) => c.type === 'removed' || (c.type === 'changed' && c.worse));
}
```
:::

:::variant{kind=wrong name=unsorted fails=tests reason="没有按地址排序：新增的、变化的、消失的分成了几堆"}
```ts file=compare.ts
import { parseRouteTable, type RouteKind } from './route-table';

export type Change =
  | { type: 'added'; path: string; kind: RouteKind }
  | { type: 'removed'; path: string; kind: RouteKind }
  | { type: 'changed'; path: string; from: RouteKind; to: RouteKind; worse: boolean };

/** 越大越“动态”：静态的页面可以直接从 CDN 返回，动态的页面每次都要在服务器上渲染 */
const RANK: Record<RouteKind, number> = { static: 0, ssg: 0, partial: 1, dynamic: 2 };

/** 比较两次构建的路由表，按地址排序返回所有的变化 */
export function compareBuilds(before: string, after: string): Change[] {
  const old = new Map(parseRouteTable(before).map((row) => [row.path, row.kind]));
  const now = new Map(parseRouteTable(after).map((row) => [row.path, row.kind]));
  const changes: Change[] = [];
  for (const [path, kind] of now) {
    const from = old.get(path);
    if (from === undefined) changes.push({ type: 'added', path, kind });
    else if (from !== kind) changes.push({ type: 'changed', path, from, to: kind, worse: RANK[kind] > RANK[from] });
  }
  for (const [path, kind] of old) {
    if (!now.has(path)) changes.push({ type: 'removed', path, kind });
  }
  return changes;
}

/** 需要人看一眼的变化：页面消失了，或者变得更“动态”了 */
export function regressions(changes: readonly Change[]): Change[] {
  return changes.filter((c) => c.type === 'removed' || (c.type === 'changed' && c.worse));
}
```
:::

:::variant{kind=wrong name=any-change-worse fails=tests reason="把“不是静态的”当作变差：从 ƒ 变成 ◐ 是变好了，也被报告成变差"}
```ts file=compare.ts
import { parseRouteTable, type RouteKind } from './route-table';

export type Change =
  | { type: 'added'; path: string; kind: RouteKind }
  | { type: 'removed'; path: string; kind: RouteKind }
  | { type: 'changed'; path: string; from: RouteKind; to: RouteKind; worse: boolean };

/** 越大越“动态”：静态的页面可以直接从 CDN 返回，动态的页面每次都要在服务器上渲染 */
const RANK: Record<RouteKind, number> = { static: 0, ssg: 0, partial: 1, dynamic: 2 };

/** 比较两次构建的路由表，按地址排序返回所有的变化 */
export function compareBuilds(before: string, after: string): Change[] {
  const old = new Map(parseRouteTable(before).map((row) => [row.path, row.kind]));
  const now = new Map(parseRouteTable(after).map((row) => [row.path, row.kind]));
  const changes: Change[] = [];
  for (const [path, kind] of now) {
    const from = old.get(path);
    if (from === undefined) changes.push({ type: 'added', path, kind });
    else if (from !== kind) changes.push({ type: 'changed', path, from, to: kind, worse: kind !== 'static' });
  }
  for (const [path, kind] of old) {
    if (!now.has(path)) changes.push({ type: 'removed', path, kind });
  }
  return changes.toSorted((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** 需要人看一眼的变化：页面消失了，或者变得更“动态”了 */
export function regressions(changes: readonly Change[]): Change[] {
  return changes.filter((c) => c.type === 'removed' || (c.type === 'changed' && c.worse));
}
```
:::

:::variant{kind=wrong name=added-is-regression fails=tests reason="把新增的页面也当作需要看的变化：新页面通常是有意加的"}
```ts file=compare.ts
import { parseRouteTable, type RouteKind } from './route-table';

export type Change =
  | { type: 'added'; path: string; kind: RouteKind }
  | { type: 'removed'; path: string; kind: RouteKind }
  | { type: 'changed'; path: string; from: RouteKind; to: RouteKind; worse: boolean };

/** 越大越“动态”：静态的页面可以直接从 CDN 返回，动态的页面每次都要在服务器上渲染 */
const RANK: Record<RouteKind, number> = { static: 0, ssg: 0, partial: 1, dynamic: 2 };

/** 比较两次构建的路由表，按地址排序返回所有的变化 */
export function compareBuilds(before: string, after: string): Change[] {
  const old = new Map(parseRouteTable(before).map((row) => [row.path, row.kind]));
  const now = new Map(parseRouteTable(after).map((row) => [row.path, row.kind]));
  const changes: Change[] = [];
  for (const [path, kind] of now) {
    const from = old.get(path);
    if (from === undefined) changes.push({ type: 'added', path, kind });
    else if (from !== kind) changes.push({ type: 'changed', path, from, to: kind, worse: RANK[kind] > RANK[from] });
  }
  for (const [path, kind] of old) {
    if (!now.has(path)) changes.push({ type: 'removed', path, kind });
  }
  return changes.toSorted((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** 需要人看一眼的变化：页面消失了，或者变得更“动态”了 */
export function regressions(changes: readonly Change[]): Change[] {
  return changes.filter((c) => c.type !== 'changed' || c.worse);
}
```
:::

:::variant{kind=wrong name=ssg-ranked-apart fails=tests reason="把 ○ 和 ● 分成了两级：从 ○ 变成 ● 被报告成变差"}
```ts file=compare.ts
import { parseRouteTable, type RouteKind } from './route-table';

export type Change =
  | { type: 'added'; path: string; kind: RouteKind }
  | { type: 'removed'; path: string; kind: RouteKind }
  | { type: 'changed'; path: string; from: RouteKind; to: RouteKind; worse: boolean };

/** 越大越“动态”：静态的页面可以直接从 CDN 返回，动态的页面每次都要在服务器上渲染 */
const RANK: Record<RouteKind, number> = { static: 0, ssg: 1, partial: 2, dynamic: 3 };

/** 比较两次构建的路由表，按地址排序返回所有的变化 */
export function compareBuilds(before: string, after: string): Change[] {
  const old = new Map(parseRouteTable(before).map((row) => [row.path, row.kind]));
  const now = new Map(parseRouteTable(after).map((row) => [row.path, row.kind]));
  const changes: Change[] = [];
  for (const [path, kind] of now) {
    const from = old.get(path);
    if (from === undefined) changes.push({ type: 'added', path, kind });
    else if (from !== kind) changes.push({ type: 'changed', path, from, to: kind, worse: RANK[kind] > RANK[from] });
  }
  for (const [path, kind] of old) {
    if (!now.has(path)) changes.push({ type: 'removed', path, kind });
  }
  return changes.toSorted((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** 需要人看一眼的变化：页面消失了，或者变得更“动态”了 */
export function regressions(changes: readonly Change[]): Change[] {
  return changes.filter((c) => c.type === 'removed' || (c.type === 'changed' && c.worse));
}
```
:::

:::variant{kind=wrong name=locale-sort fails=tests reason="用 localeCompare 排序：顺序和直接比较字符串不同，/apple 排到了 /Zebra 前面"}
```ts file=compare.ts
import { parseRouteTable, type RouteKind } from './route-table';

export type Change =
  | { type: 'added'; path: string; kind: RouteKind }
  | { type: 'removed'; path: string; kind: RouteKind }
  | { type: 'changed'; path: string; from: RouteKind; to: RouteKind; worse: boolean };

/** 越大越“动态”：静态的页面可以直接从 CDN 返回，动态的页面每次都要在服务器上渲染 */
const RANK: Record<RouteKind, number> = { static: 0, ssg: 0, partial: 1, dynamic: 2 };

/** 比较两次构建的路由表，按地址排序返回所有的变化 */
export function compareBuilds(before: string, after: string): Change[] {
  const old = new Map(parseRouteTable(before).map((row) => [row.path, row.kind]));
  const now = new Map(parseRouteTable(after).map((row) => [row.path, row.kind]));
  const changes: Change[] = [];
  for (const [path, kind] of now) {
    const from = old.get(path);
    if (from === undefined) changes.push({ type: 'added', path, kind });
    else if (from !== kind) changes.push({ type: 'changed', path, from, to: kind, worse: RANK[kind] > RANK[from] });
  }
  for (const [path, kind] of old) {
    if (!now.has(path)) changes.push({ type: 'removed', path, kind });
  }
  return changes.toSorted((a, b) => a.path.localeCompare(b.path));
}

/** 需要人看一眼的变化：页面消失了，或者变得更“动态”了 */
export function regressions(changes: readonly Change[]): Change[] {
  return changes.filter((c) => c.type === 'removed' || (c.type === 'changed' && c.worse));
}
```
:::

