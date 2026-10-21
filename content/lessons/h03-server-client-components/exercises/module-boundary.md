---
kind: challenge
title: 找出模块图的边界
---
构建时，Next.js 从每个页面和布局开始沿着 `import` 走，把模块分到服务端和客户端两张模块图中，并报告越过边界的错误（正文中实测的两种）。在 `boundary.ts` 中实现 `analyzeBoundary(modules, entries)` 来模拟这个过程：

1. `modules` 描述每个模块：`directive` 是文件开头的 `'use client'`（没有时省略）；`only` 表示它只能放在服务端的模块图中（`'server'`，例如导入了 `server-only`），或者只能放在客户端的模块图中（`'client'`，例如使用了 `useState`：客户端组件也在服务器上渲染 HTML，但这样的代码不能出现在服务端组件的模块图中）；`imports` 是它导入的模块，按代码中的顺序。`imports` 和 `entries` 中的模块都在 `modules` 中，导入可能有循环；
2. **服务端的模块图**：从 `entries`（页面和布局）开始，沿着 `imports` 广度优先地访问。访问到有 `'use client'` 的模块时，它是一个**客户端入口**：它不属于服务端的模块图，也不再沿着它的 `imports` 往下走；
3. **客户端的模块图**：服务端的模块图访问完之后，从所有的客户端入口开始（按它们在第 2 步中被访问到的顺序），沿着 `imports` 广度优先地访问。这里访问到的模块，不管有没有 `'use client'`，都属于客户端。一个模块可以同时属于两张模块图；
4. **错误**：服务端的模块图中 `only` 是 `'client'` 的模块报告 `'client-only-in-server'`；客户端的模块图中 `only` 是 `'server'` 的模块报告 `'server-only-in-client'`。`trace` 是从某个入口到这个模块的导入路径：广度优先（按 `entries` 和 `imports` 的顺序）时**第一次**到达它的那一条；客户端中的模块，路径从服务端的入口开始，经过它所在的客户端入口；
5. 返回 `{ server, client, errors }`：两张模块图中的模块名按 `toSorted()` 的默认顺序排序，`errors` 按 `module` 排序（两种错误放在一起排）。

:::files{role=starter}
```ts file=boundary.ts
export type ModuleInfo = Readonly<{
  /** 文件开头的 'use client' 指令 */
  directive?: 'use client';
  /** 只能放在服务端的模块图中（例如导入了 server-only），或者只能放在客户端的模块图中（例如使用了 useState） */
  only?: 'server' | 'client';
  imports: readonly string[];
}>;

export type BoundaryError = Readonly<{
  kind: 'server-only-in-client' | 'client-only-in-server';
  module: string;
  trace: readonly string[];
}>;

export type BoundaryReport = Readonly<{ server: string[]; client: string[]; errors: BoundaryError[] }>;

/** 从页面和布局（服务端组件）开始，算出服务端和客户端的模块图，以及越过边界的错误 */
export function analyzeBoundary(modules: Readonly<Record<string, ModuleInfo>>, entries: readonly string[]): BoundaryReport {
  // TODO
  return { server: [], client: [], errors: [] };
}
```
```ts file=main.ts readonly
import { analyzeBoundary } from './boundary';

const report = analyzeBoundary(
  {
    'app/page.tsx': { imports: ['app/ui/like-button.tsx', 'lib/posts.ts'] },
    'app/ui/like-button.tsx': { directive: 'use client', only: 'client', imports: ['lib/format.ts', 'lib/posts.ts'] },
    'lib/format.ts': { imports: [] },
    'lib/posts.ts': { only: 'server', imports: [] },
  },
  ['app/page.tsx'],
);
console.log(JSON.stringify(report, null, 2));
```
:::

:::files{role=solution}
```ts file=boundary.ts
export type ModuleInfo = Readonly<{
  /** 文件开头的 'use client' 指令 */
  directive?: 'use client';
  /** 只能放在服务端的模块图中（例如导入了 server-only），或者只能放在客户端的模块图中（例如使用了 useState） */
  only?: 'server' | 'client';
  imports: readonly string[];
}>;

export type BoundaryError = Readonly<{
  kind: 'server-only-in-client' | 'client-only-in-server';
  module: string;
  trace: readonly string[];
}>;

export type BoundaryReport = Readonly<{ server: string[]; client: string[]; errors: BoundaryError[] }>;

type Visit = Readonly<{ module: string; trace: readonly string[] }>;

/** 广度优先地访问，返回每个模块第一次被访问到时的导入路径（按访问的顺序） */
function walk(
  modules: Readonly<Record<string, ModuleInfo>>,
  starts: readonly Visit[],
  follow: (module: string) => boolean,
): Map<string, readonly string[]> {
  const traces = new Map<string, readonly string[]>();
  const queue = [...starts];
  for (let visit = queue.shift(); visit !== undefined; visit = queue.shift()) {
    if (traces.has(visit.module)) continue;
    traces.set(visit.module, visit.trace);
    if (!follow(visit.module)) continue;
    for (const next of modules[visit.module]?.imports ?? []) {
      queue.push({ module: next, trace: [...visit.trace, next] });
    }
  }
  return traces;
}

/** 从页面和布局（服务端组件）开始，算出服务端和客户端的模块图，以及越过边界的错误 */
export function analyzeBoundary(modules: Readonly<Record<string, ModuleInfo>>, entries: readonly string[]): BoundaryReport {
  const isClientEntry = (module: string) => modules[module]?.directive === 'use client';
  // 服务端的模块图在 'use client' 处停下：那个模块是客户端入口，它导入的东西都在客户端
  const reached = walk(modules, entries.map((module) => ({ module, trace: [module] })), (module) => !isClientEntry(module));
  const server = [...reached].filter(([module]) => !isClientEntry(module));
  const clientEntries = [...reached].filter(([module]) => isClientEntry(module)).map(([module, trace]) => ({ module, trace }));
  const client = [...walk(modules, clientEntries, () => true)];

  const errors: BoundaryError[] = [
    ...server.filter(([module]) => modules[module]?.only === 'client').map(([module, trace]) => ({ kind: 'client-only-in-server' as const, module, trace })),
    ...client.filter(([module]) => modules[module]?.only === 'server').map(([module, trace]) => ({ kind: 'server-only-in-client' as const, module, trace })),
  ];
  return {
    server: server.map(([module]) => module).toSorted(),
    client: client.map(([module]) => module).toSorted(),
    errors: errors.toSorted((a, b) => (a.module < b.module ? -1 : a.module > b.module ? 1 : 0)),
  };
}
```
```ts file=main.ts readonly
import { analyzeBoundary } from './boundary';

const report = analyzeBoundary(
  {
    'app/page.tsx': { imports: ['app/ui/like-button.tsx', 'lib/posts.ts'] },
    'app/ui/like-button.tsx': { directive: 'use client', only: 'client', imports: ['lib/format.ts', 'lib/posts.ts'] },
    'lib/format.ts': { imports: [] },
    'lib/posts.ts': { only: 'server', imports: [] },
  },
  ['app/page.tsx'],
);
console.log(JSON.stringify(report, null, 2));
```
:::

:::files{role=tests}
```ts file=boundary.test.ts
import { describe, expect, test } from 'vitest';
import { analyzeBoundary, type ModuleInfo } from './boundary';

/** 一个常见的应用：布局中有主题和搜索框，页面读取文章，点赞按钮是客户端组件 */
const APP: Record<string, ModuleInfo> = {
  'app/layout.tsx': { imports: ['app/ui/theme-provider.tsx', 'app/ui/nav.tsx'] },
  'app/page.tsx': { imports: ['lib/posts.ts', 'app/ui/like-button.tsx', 'lib/format.ts'] },
  'app/ui/theme-provider.tsx': { directive: 'use client', only: 'client', imports: [] },
  'app/ui/nav.tsx': { imports: ['app/ui/search.tsx'] },
  'app/ui/search.tsx': { directive: 'use client', only: 'client', imports: ['lib/use-debounce.ts', 'lib/format.ts'] },
  'app/ui/like-button.tsx': { directive: 'use client', only: 'client', imports: ['lib/format.ts'] },
  'lib/use-debounce.ts': { only: 'client', imports: [] },
  'lib/posts.ts': { only: 'server', imports: ['lib/db.ts'] },
  'lib/db.ts': { only: 'server', imports: [] },
  'lib/format.ts': { imports: [] },
};
const ENTRIES = ['app/layout.tsx', 'app/page.tsx'];

describe('analyzeBoundary', () => {
  test('没有错误的应用：两张模块图', () => {
    expect(analyzeBoundary(APP, ENTRIES)).toStrictEqual({
      server: ['app/layout.tsx', 'app/page.tsx', 'app/ui/nav.tsx', 'lib/db.ts', 'lib/format.ts', 'lib/posts.ts'],
      client: ['app/ui/like-button.tsx', 'app/ui/search.tsx', 'app/ui/theme-provider.tsx', 'lib/format.ts', 'lib/use-debounce.ts'],
      errors: [],
    });
  });

  test('客户端组件导入了只能在服务器上运行的模块：它导入的模块也都在客户端', () => {
    const modules = { ...APP, 'app/ui/like-button.tsx': { directive: 'use client', only: 'client', imports: ['lib/format.ts', 'lib/posts.ts'] } } satisfies Record<string, ModuleInfo>;
    const report = analyzeBoundary(modules, ENTRIES);
    expect(report.client).toContain('lib/db.ts');
    expect(report.errors).toStrictEqual([
      { kind: 'server-only-in-client', module: 'lib/db.ts', trace: ['app/page.tsx', 'app/ui/like-button.tsx', 'lib/posts.ts', 'lib/db.ts'] },
      { kind: 'server-only-in-client', module: 'lib/posts.ts', trace: ['app/page.tsx', 'app/ui/like-button.tsx', 'lib/posts.ts'] },
    ]);
  });

  test('服务端组件直接导入了只能放在客户端的模块', () => {
    const modules = { ...APP, 'app/ui/nav.tsx': { imports: ['app/ui/search.tsx', 'lib/use-debounce.ts'] } } satisfies Record<string, ModuleInfo>;
    const report = analyzeBoundary(modules, ENTRIES);
    expect(report.server).toContain('lib/use-debounce.ts');
    expect(report.client).toContain('lib/use-debounce.ts');
    expect(report.errors).toStrictEqual([
      { kind: 'client-only-in-server', module: 'lib/use-debounce.ts', trace: ['app/layout.tsx', 'app/ui/nav.tsx', 'lib/use-debounce.ts'] },
    ]);
  });

  test("忘了写 'use client'：这个模块和它导入的模块都留在了服务端", () => {
    const modules = { ...APP, 'app/ui/search.tsx': { only: 'client', imports: ['lib/use-debounce.ts', 'lib/format.ts'] } } satisfies Record<string, ModuleInfo>;
    const report = analyzeBoundary(modules, ENTRIES);
    expect(report.client).toStrictEqual(['app/ui/like-button.tsx', 'app/ui/theme-provider.tsx', 'lib/format.ts']);
    expect(report.errors).toStrictEqual([
      { kind: 'client-only-in-server', module: 'app/ui/search.tsx', trace: ['app/layout.tsx', 'app/ui/nav.tsx', 'app/ui/search.tsx'] },
      { kind: 'client-only-in-server', module: 'lib/use-debounce.ts', trace: ['app/layout.tsx', 'app/ui/nav.tsx', 'app/ui/search.tsx', 'lib/use-debounce.ts'] },
    ]);
  });

  test("只需要在入口写 'use client'；客户端中的 'use client' 不改变什么", () => {
    const modules: Record<string, ModuleInfo> = {
      'app/page.tsx': { imports: ['app/ui/menu.tsx'] },
      'app/ui/menu.tsx': { directive: 'use client', imports: ['app/ui/menu-item.tsx', 'app/ui/popover.tsx'] },
      'app/ui/menu-item.tsx': { only: 'client', imports: [] },
      'app/ui/popover.tsx': { directive: 'use client', imports: ['app/ui/menu-item.tsx'] },
    };
    expect(analyzeBoundary(modules, ['app/page.tsx'])).toStrictEqual({
      server: ['app/page.tsx'],
      client: ['app/ui/menu-item.tsx', 'app/ui/menu.tsx', 'app/ui/popover.tsx'],
      errors: [],
    });
  });

  test('导入路径是广度优先时第一次到达的那一条', () => {
    const modules: Record<string, ModuleInfo> = {
      'app/page.tsx': { imports: ['app/ui/form.tsx'] },
      'app/ui/form.tsx': { directive: 'use client', imports: ['lib/a.ts', 'lib/b.ts'] },
      'lib/a.ts': { imports: ['lib/a2.ts'] },
      'lib/a2.ts': { imports: ['lib/db.ts'] },
      'lib/b.ts': { imports: ['lib/db.ts'] },
      'lib/db.ts': { only: 'server', imports: [] },
    };
    expect(analyzeBoundary(modules, ['app/page.tsx']).errors).toStrictEqual([
      { kind: 'server-only-in-client', module: 'lib/db.ts', trace: ['app/page.tsx', 'app/ui/form.tsx', 'lib/b.ts', 'lib/db.ts'] },
    ]);
  });

  test('客户端入口按服务端发现它们的顺序开始', () => {
    const modules: Record<string, ModuleInfo> = {
      'app/layout.tsx': { imports: ['app/ui/one.tsx'] },
      'app/page.tsx': { imports: ['app/ui/two.tsx'] },
      'app/ui/one.tsx': { directive: 'use client', imports: ['lib/x.ts'] },
      'app/ui/two.tsx': { directive: 'use client', imports: ['lib/secret.ts'] },
      'lib/x.ts': { imports: ['lib/secret.ts'] },
      'lib/secret.ts': { only: 'server', imports: [] },
    };
    // one.tsx 和 two.tsx 都是客户端的起点：从 two.tsx 一步就到 secret.ts，比经过 x.ts 先到
    expect(analyzeBoundary(modules, ['app/layout.tsx', 'app/page.tsx']).errors).toStrictEqual([
      { kind: 'server-only-in-client', module: 'lib/secret.ts', trace: ['app/page.tsx', 'app/ui/two.tsx', 'lib/secret.ts'] },
    ]);
  });

  test('客户端入口按被发现的顺序，而不是按名字排序', () => {
    const modules: Record<string, ModuleInfo> = {
      'app/layout.tsx': { imports: ['app/ui/b.tsx'] },
      'app/page.tsx': { imports: ['app/ui/a.tsx'] },
      'app/ui/a.tsx': { directive: 'use client', imports: ['lib/secret.ts'] },
      'app/ui/b.tsx': { directive: 'use client', imports: ['lib/secret.ts'] },
      'lib/secret.ts': { only: 'server', imports: [] },
    };
    expect(analyzeBoundary(modules, ['app/layout.tsx', 'app/page.tsx']).errors).toStrictEqual([
      { kind: 'server-only-in-client', module: 'lib/secret.ts', trace: ['app/layout.tsx', 'app/ui/b.tsx', 'lib/secret.ts'] },
    ]);
  });

  test('服务端的模块图也是广度优先', () => {
    const modules: Record<string, ModuleInfo> = {
      'app/page.tsx': { imports: ['lib/a.ts', 'lib/hook.ts'] },
      'lib/a.ts': { imports: ['lib/hook.ts'] },
      'lib/hook.ts': { only: 'client', imports: [] },
    };
    expect(analyzeBoundary(modules, ['app/page.tsx']).errors).toStrictEqual([
      { kind: 'client-only-in-server', module: 'lib/hook.ts', trace: ['app/page.tsx', 'lib/hook.ts'] },
    ]);
  });

  test('先完成服务端的模块图，再从所有的客户端入口一起开始：路径不一定是全局最短的', () => {
    const modules: Record<string, ModuleInfo> = {
      'app/layout.tsx': { imports: ['app/ui/a.tsx'] },
      'app/page.tsx': { imports: ['app/ui/nav.tsx'] },
      'app/ui/nav.tsx': { imports: ['app/ui/nav2.tsx'] },
      'app/ui/nav2.tsx': { imports: ['app/ui/b.tsx'] },
      'app/ui/a.tsx': { directive: 'use client', imports: ['lib/x.ts'] },
      'app/ui/b.tsx': { directive: 'use client', imports: ['lib/secret.ts'] },
      'lib/x.ts': { imports: ['lib/secret.ts'] },
      'lib/secret.ts': { only: 'server', imports: [] },
    };
    // 客户端的起点是 a.tsx 和 b.tsx：从 b.tsx 一步就到 secret.ts，比经过 x.ts 先到，
    // 尽管 layout → a → x → secret 只有 4 个模块
    expect(analyzeBoundary(modules, ['app/layout.tsx', 'app/page.tsx']).errors).toStrictEqual([
      { kind: 'server-only-in-client', module: 'lib/secret.ts', trace: ['app/page.tsx', 'app/ui/nav.tsx', 'app/ui/nav2.tsx', 'app/ui/b.tsx', 'lib/secret.ts'] },
    ]);
  });

  test('两种错误一起按模块名排序', () => {
    const modules = {
      ...APP,
      'app/ui/nav.tsx': { imports: ['app/ui/search.tsx', 'lib/use-debounce.ts'] },
      'app/ui/like-button.tsx': { directive: 'use client', only: 'client', imports: ['lib/format.ts', 'lib/posts.ts'] },
    } satisfies Record<string, ModuleInfo>;
    expect(analyzeBoundary(modules, ENTRIES).errors.map((error) => error.module)).toStrictEqual(['lib/db.ts', 'lib/posts.ts', 'lib/use-debounce.ts']);
  });

  test('服务端的循环导入', () => {
    const modules: Record<string, ModuleInfo> = {
      'app/page.tsx': { imports: ['lib/a.ts'] },
      'lib/a.ts': { imports: ['lib/b.ts'] },
      'lib/b.ts': { imports: ['lib/a.ts'] },
    };
    expect(analyzeBoundary(modules, ['app/page.tsx'])).toStrictEqual({ server: ['app/page.tsx', 'lib/a.ts', 'lib/b.ts'], client: [], errors: [] });
  });

  test("页面本身是客户端组件；循环导入", () => {
    const modules: Record<string, ModuleInfo> = {
      'app/page.tsx': { directive: 'use client', only: 'client', imports: ['lib/a.ts'] },
      'lib/a.ts': { imports: ['lib/b.ts'] },
      'lib/b.ts': { imports: ['lib/a.ts'] },
    };
    expect(analyzeBoundary(modules, ['app/page.tsx'])).toStrictEqual({ server: [], client: ['app/page.tsx', 'lib/a.ts', 'lib/b.ts'], errors: [] });
  });
});
```
:::

:::hint{level=1}
两张模块图都是同一种广度优先的遍历，只是起点不同、在哪里停下不同。写一个通用的函数：参数是起点（每个起点带着到达它的路径）和“要不要沿着这个模块的 `imports` 往下走”的判断，返回 `Map<模块, 第一次到达时的路径>`。`Map` 会保持插入的顺序，正好就是访问的顺序。
:::

:::hint{level=2}
服务端：起点是 `entries.map((m) => ({ module: m, trace: [m] }))`，有 `'use client'` 的模块不往下走。结果中有 `'use client'` 的就是客户端入口，连同它们的路径一起作为客户端的起点，这一次所有的模块都往下走。用队列实现广度优先：`queue.shift()` 取出最早放进去的；取出时如果已经访问过，就跳过。
:::

:::explanation
`'use client'` 标出的是**模块图**的边界，而不是组件树的边界：它所在的模块和这个模块导入的所有东西都进入客户端的模块图，所以只需要在入口写一次。反过来，一个服务端组件导入了使用 `useState` 的模块、又没有经过 `'use client'`，这个模块就留在了服务端的模块图中，构建时报错。

两张模块图可以共用模块：`lib/format.ts` 被服务端组件和客户端组件都导入时，Next.js 为两边各编译一份（正文中实测，它同时出现在浏览器的代码块和服务器的代码块中）。它必须在两个环境中都能运行。

报告错误时给出导入路径，是因为出问题的往往不是报错的那个文件：`lib/db.ts` 没有错，错的是某个客户端组件导入了它。服务端的部分是从入口出发的最短路径；客户端的部分从所有的客户端入口一起开始，整条路径不一定是全局最短的（测试中有一个例子），但结果是确定的。Next.js 的错误信息中也有这样的 “Import trace”。

替代解在遍历时记录每个模块是从哪个模块到达的，需要路径时再沿着它往回走；客户端中的路径往回走到客户端入口之后，接上服务端到达这个入口的路径。
:::

:::variant{kind=alt name=parent-pointers}
```ts file=boundary.ts
export type ModuleInfo = Readonly<{
  /** 文件开头的 'use client' 指令 */
  directive?: 'use client';
  /** 只能放在服务端的模块图中（例如导入了 server-only），或者只能放在客户端的模块图中（例如使用了 useState） */
  only?: 'server' | 'client';
  imports: readonly string[];
}>;

export type BoundaryError = Readonly<{
  kind: 'server-only-in-client' | 'client-only-in-server';
  module: string;
  trace: readonly string[];
}>;

export type BoundaryReport = Readonly<{ server: string[]; client: string[]; errors: BoundaryError[] }>;

type Modules = Readonly<Record<string, ModuleInfo>>;

/** 广度优先：记录每个模块是从哪个模块第一次到达的（起点是 null） */
function parentsFrom(modules: Modules, starts: readonly string[], follow: (module: string) => boolean): Map<string, string | null> {
  const parents = new Map<string, string | null>();
  const queue: string[] = [];
  for (const start of starts) {
    if (parents.has(start)) continue;
    parents.set(start, null);
    queue.push(start);
  }
  for (let i = 0; i < queue.length; i++) {
    const module = queue[i];
    if (module === undefined || !follow(module)) continue;
    for (const next of modules[module]?.imports ?? []) {
      if (parents.has(next)) continue;
      parents.set(next, module);
      queue.push(next);
    }
  }
  return parents;
}

/** 沿着 parents 往回走，得到从起点到 module 的路径 */
function traceOf(parents: ReadonlyMap<string, string | null>, module: string): string[] {
  const trace: string[] = [];
  for (let current: string | null | undefined = module; current !== null && current !== undefined; current = parents.get(current)) {
    trace.unshift(current);
  }
  return trace;
}

/** 从页面和布局（服务端组件）开始，算出服务端和客户端的模块图，以及越过边界的错误 */
export function analyzeBoundary(modules: Modules, entries: readonly string[]): BoundaryReport {
  const isClientEntry = (module: string) => modules[module]?.directive === 'use client';
  const serverParents = parentsFrom(modules, entries, (module) => !isClientEntry(module));
  const server = [...serverParents.keys()].filter((module) => !isClientEntry(module));
  const clientEntries = [...serverParents.keys()].filter(isClientEntry);
  const clientParents = parentsFrom(modules, clientEntries, () => true);
  const client = [...clientParents.keys()];

  const errors: BoundaryError[] = [];
  for (const module of server) {
    if (modules[module]?.only === 'client') errors.push({ kind: 'client-only-in-server', module, trace: traceOf(serverParents, module) });
  }
  for (const module of client) {
    if (modules[module]?.only !== 'server') continue;
    // 客户端中的路径从某个客户端入口开始，前面接上服务端到达这个入口的路径
    const [entry = module, ...rest] = traceOf(clientParents, module);
    errors.push({ kind: 'server-only-in-client', module, trace: [...traceOf(serverParents, entry), ...rest] });
  }
  return {
    server: server.toSorted(),
    client: client.toSorted(),
    errors: errors.toSorted((a, b) => (a.module < b.module ? -1 : a.module > b.module ? 1 : 0)),
  };
}
```
:::

:::variant{kind=wrong name=no-propagation fails=tests reason="客户端入口导入的模块没有算进客户端：'use client' 会把它导入的所有模块都带进客户端"}
```ts file=boundary.ts
export type ModuleInfo = Readonly<{
  /** 文件开头的 'use client' 指令 */
  directive?: 'use client';
  /** 只能放在服务端的模块图中（例如导入了 server-only），或者只能放在客户端的模块图中（例如使用了 useState） */
  only?: 'server' | 'client';
  imports: readonly string[];
}>;

export type BoundaryError = Readonly<{
  kind: 'server-only-in-client' | 'client-only-in-server';
  module: string;
  trace: readonly string[];
}>;

export type BoundaryReport = Readonly<{ server: string[]; client: string[]; errors: BoundaryError[] }>;

type Visit = Readonly<{ module: string; trace: readonly string[] }>;

/** 广度优先地访问，返回每个模块第一次被访问到时的导入路径（按访问的顺序） */
function walk(
  modules: Readonly<Record<string, ModuleInfo>>,
  starts: readonly Visit[],
  follow: (module: string) => boolean,
): Map<string, readonly string[]> {
  const traces = new Map<string, readonly string[]>();
  const queue = [...starts];
  for (let visit = queue.shift(); visit !== undefined; visit = queue.shift()) {
    if (traces.has(visit.module)) continue;
    traces.set(visit.module, visit.trace);
    if (!follow(visit.module)) continue;
    for (const next of modules[visit.module]?.imports ?? []) {
      queue.push({ module: next, trace: [...visit.trace, next] });
    }
  }
  return traces;
}

/** 从页面和布局（服务端组件）开始，算出服务端和客户端的模块图，以及越过边界的错误 */
export function analyzeBoundary(modules: Readonly<Record<string, ModuleInfo>>, entries: readonly string[]): BoundaryReport {
  const isClientEntry = (module: string) => modules[module]?.directive === 'use client';
  // 服务端的模块图在 'use client' 处停下：那个模块是客户端入口，它导入的东西都在客户端
  const reached = walk(modules, entries.map((module) => ({ module, trace: [module] })), (module) => !isClientEntry(module));
  const server = [...reached].filter(([module]) => !isClientEntry(module));
  const clientEntries = [...reached].filter(([module]) => isClientEntry(module)).map(([module, trace]) => ({ module, trace }));
  const client = [...walk(modules, clientEntries, () => false)];

  const errors: BoundaryError[] = [
    ...server.filter(([module]) => modules[module]?.only === 'client').map(([module, trace]) => ({ kind: 'client-only-in-server' as const, module, trace })),
    ...client.filter(([module]) => modules[module]?.only === 'server').map(([module, trace]) => ({ kind: 'server-only-in-client' as const, module, trace })),
  ];
  return {
    server: server.map(([module]) => module).toSorted(),
    client: client.map(([module]) => module).toSorted(),
    errors: errors.toSorted((a, b) => (a.module < b.module ? -1 : a.module > b.module ? 1 : 0)),
  };
}
```
:::

:::variant{kind=wrong name=through-boundary fails=tests reason="服务端的模块图越过了 'use client'：客户端组件导入的模块被当成了服务端的"}
```ts file=boundary.ts
export type ModuleInfo = Readonly<{
  /** 文件开头的 'use client' 指令 */
  directive?: 'use client';
  /** 只能放在服务端的模块图中（例如导入了 server-only），或者只能放在客户端的模块图中（例如使用了 useState） */
  only?: 'server' | 'client';
  imports: readonly string[];
}>;

export type BoundaryError = Readonly<{
  kind: 'server-only-in-client' | 'client-only-in-server';
  module: string;
  trace: readonly string[];
}>;

export type BoundaryReport = Readonly<{ server: string[]; client: string[]; errors: BoundaryError[] }>;

type Visit = Readonly<{ module: string; trace: readonly string[] }>;

/** 广度优先地访问，返回每个模块第一次被访问到时的导入路径（按访问的顺序） */
function walk(
  modules: Readonly<Record<string, ModuleInfo>>,
  starts: readonly Visit[],
  follow: (module: string) => boolean,
): Map<string, readonly string[]> {
  const traces = new Map<string, readonly string[]>();
  const queue = [...starts];
  for (let visit = queue.shift(); visit !== undefined; visit = queue.shift()) {
    if (traces.has(visit.module)) continue;
    traces.set(visit.module, visit.trace);
    if (!follow(visit.module)) continue;
    for (const next of modules[visit.module]?.imports ?? []) {
      queue.push({ module: next, trace: [...visit.trace, next] });
    }
  }
  return traces;
}

/** 从页面和布局（服务端组件）开始，算出服务端和客户端的模块图，以及越过边界的错误 */
export function analyzeBoundary(modules: Readonly<Record<string, ModuleInfo>>, entries: readonly string[]): BoundaryReport {
  const isClientEntry = (module: string) => modules[module]?.directive === 'use client';
  // 服务端的模块图在 'use client' 处停下：那个模块是客户端入口，它导入的东西都在客户端
  const reached = walk(modules, entries.map((module) => ({ module, trace: [module] })), () => true);
  const server = [...reached].filter(([module]) => !isClientEntry(module));
  const clientEntries = [...reached].filter(([module]) => isClientEntry(module)).map(([module, trace]) => ({ module, trace }));
  const client = [...walk(modules, clientEntries, () => true)];

  const errors: BoundaryError[] = [
    ...server.filter(([module]) => modules[module]?.only === 'client').map(([module, trace]) => ({ kind: 'client-only-in-server' as const, module, trace })),
    ...client.filter(([module]) => modules[module]?.only === 'server').map(([module, trace]) => ({ kind: 'server-only-in-client' as const, module, trace })),
  ];
  return {
    server: server.map(([module]) => module).toSorted(),
    client: client.map(([module]) => module).toSorted(),
    errors: errors.toSorted((a, b) => (a.module < b.module ? -1 : a.module > b.module ? 1 : 0)),
  };
}
```
:::

:::variant{kind=wrong name=entry-in-both fails=tests reason="把客户端入口也算进了服务端的模块图：它的代码在客户端"}
```ts file=boundary.ts
export type ModuleInfo = Readonly<{
  /** 文件开头的 'use client' 指令 */
  directive?: 'use client';
  /** 只能放在服务端的模块图中（例如导入了 server-only），或者只能放在客户端的模块图中（例如使用了 useState） */
  only?: 'server' | 'client';
  imports: readonly string[];
}>;

export type BoundaryError = Readonly<{
  kind: 'server-only-in-client' | 'client-only-in-server';
  module: string;
  trace: readonly string[];
}>;

export type BoundaryReport = Readonly<{ server: string[]; client: string[]; errors: BoundaryError[] }>;

type Visit = Readonly<{ module: string; trace: readonly string[] }>;

/** 广度优先地访问，返回每个模块第一次被访问到时的导入路径（按访问的顺序） */
function walk(
  modules: Readonly<Record<string, ModuleInfo>>,
  starts: readonly Visit[],
  follow: (module: string) => boolean,
): Map<string, readonly string[]> {
  const traces = new Map<string, readonly string[]>();
  const queue = [...starts];
  for (let visit = queue.shift(); visit !== undefined; visit = queue.shift()) {
    if (traces.has(visit.module)) continue;
    traces.set(visit.module, visit.trace);
    if (!follow(visit.module)) continue;
    for (const next of modules[visit.module]?.imports ?? []) {
      queue.push({ module: next, trace: [...visit.trace, next] });
    }
  }
  return traces;
}

/** 从页面和布局（服务端组件）开始，算出服务端和客户端的模块图，以及越过边界的错误 */
export function analyzeBoundary(modules: Readonly<Record<string, ModuleInfo>>, entries: readonly string[]): BoundaryReport {
  const isClientEntry = (module: string) => modules[module]?.directive === 'use client';
  // 服务端的模块图在 'use client' 处停下：那个模块是客户端入口，它导入的东西都在客户端
  const reached = walk(modules, entries.map((module) => ({ module, trace: [module] })), (module) => !isClientEntry(module));
  const server = [...reached];
  const clientEntries = [...reached].filter(([module]) => isClientEntry(module)).map(([module, trace]) => ({ module, trace }));
  const client = [...walk(modules, clientEntries, () => true)];

  const errors: BoundaryError[] = [
    ...server.filter(([module]) => modules[module]?.only === 'client').map(([module, trace]) => ({ kind: 'client-only-in-server' as const, module, trace })),
    ...client.filter(([module]) => modules[module]?.only === 'server').map(([module, trace]) => ({ kind: 'server-only-in-client' as const, module, trace })),
  ];
  return {
    server: server.map(([module]) => module).toSorted(),
    client: client.map(([module]) => module).toSorted(),
    errors: errors.toSorted((a, b) => (a.module < b.module ? -1 : a.module > b.module ? 1 : 0)),
  };
}
```
:::

:::variant{kind=wrong name=stack-not-queue fails=tests reason="用了栈而不是队列：得到的不是广度优先时第一次到达的路径"}
```ts file=boundary.ts
export type ModuleInfo = Readonly<{
  /** 文件开头的 'use client' 指令 */
  directive?: 'use client';
  /** 只能放在服务端的模块图中（例如导入了 server-only），或者只能放在客户端的模块图中（例如使用了 useState） */
  only?: 'server' | 'client';
  imports: readonly string[];
}>;

export type BoundaryError = Readonly<{
  kind: 'server-only-in-client' | 'client-only-in-server';
  module: string;
  trace: readonly string[];
}>;

export type BoundaryReport = Readonly<{ server: string[]; client: string[]; errors: BoundaryError[] }>;

type Visit = Readonly<{ module: string; trace: readonly string[] }>;

/** 广度优先地访问，返回每个模块第一次被访问到时的导入路径（按访问的顺序） */
function walk(
  modules: Readonly<Record<string, ModuleInfo>>,
  starts: readonly Visit[],
  follow: (module: string) => boolean,
): Map<string, readonly string[]> {
  const traces = new Map<string, readonly string[]>();
  const queue = [...starts];
  for (let visit = queue.pop(); visit !== undefined; visit = queue.pop()) {
    if (traces.has(visit.module)) continue;
    traces.set(visit.module, visit.trace);
    if (!follow(visit.module)) continue;
    for (const next of modules[visit.module]?.imports ?? []) {
      queue.push({ module: next, trace: [...visit.trace, next] });
    }
  }
  return traces;
}

/** 从页面和布局（服务端组件）开始，算出服务端和客户端的模块图，以及越过边界的错误 */
export function analyzeBoundary(modules: Readonly<Record<string, ModuleInfo>>, entries: readonly string[]): BoundaryReport {
  const isClientEntry = (module: string) => modules[module]?.directive === 'use client';
  // 服务端的模块图在 'use client' 处停下：那个模块是客户端入口，它导入的东西都在客户端
  const reached = walk(modules, entries.map((module) => ({ module, trace: [module] })), (module) => !isClientEntry(module));
  const server = [...reached].filter(([module]) => !isClientEntry(module));
  const clientEntries = [...reached].filter(([module]) => isClientEntry(module)).map(([module, trace]) => ({ module, trace }));
  const client = [...walk(modules, clientEntries, () => true)];

  const errors: BoundaryError[] = [
    ...server.filter(([module]) => modules[module]?.only === 'client').map(([module, trace]) => ({ kind: 'client-only-in-server' as const, module, trace })),
    ...client.filter(([module]) => modules[module]?.only === 'server').map(([module, trace]) => ({ kind: 'server-only-in-client' as const, module, trace })),
  ];
  return {
    server: server.map(([module]) => module).toSorted(),
    client: client.map(([module]) => module).toSorted(),
    errors: errors.toSorted((a, b) => (a.module < b.module ? -1 : a.module > b.module ? 1 : 0)),
  };
}
```
:::

:::variant{kind=wrong name=trace-from-client-entry fails=tests reason="客户端中的路径从客户端入口开始：看不出是哪个页面把它带进来的"}
```ts file=boundary.ts
export type ModuleInfo = Readonly<{
  /** 文件开头的 'use client' 指令 */
  directive?: 'use client';
  /** 只能放在服务端的模块图中（例如导入了 server-only），或者只能放在客户端的模块图中（例如使用了 useState） */
  only?: 'server' | 'client';
  imports: readonly string[];
}>;

export type BoundaryError = Readonly<{
  kind: 'server-only-in-client' | 'client-only-in-server';
  module: string;
  trace: readonly string[];
}>;

export type BoundaryReport = Readonly<{ server: string[]; client: string[]; errors: BoundaryError[] }>;

type Visit = Readonly<{ module: string; trace: readonly string[] }>;

/** 广度优先地访问，返回每个模块第一次被访问到时的导入路径（按访问的顺序） */
function walk(
  modules: Readonly<Record<string, ModuleInfo>>,
  starts: readonly Visit[],
  follow: (module: string) => boolean,
): Map<string, readonly string[]> {
  const traces = new Map<string, readonly string[]>();
  const queue = [...starts];
  for (let visit = queue.shift(); visit !== undefined; visit = queue.shift()) {
    if (traces.has(visit.module)) continue;
    traces.set(visit.module, visit.trace);
    if (!follow(visit.module)) continue;
    for (const next of modules[visit.module]?.imports ?? []) {
      queue.push({ module: next, trace: [...visit.trace, next] });
    }
  }
  return traces;
}

/** 从页面和布局（服务端组件）开始，算出服务端和客户端的模块图，以及越过边界的错误 */
export function analyzeBoundary(modules: Readonly<Record<string, ModuleInfo>>, entries: readonly string[]): BoundaryReport {
  const isClientEntry = (module: string) => modules[module]?.directive === 'use client';
  // 服务端的模块图在 'use client' 处停下：那个模块是客户端入口，它导入的东西都在客户端
  const reached = walk(modules, entries.map((module) => ({ module, trace: [module] })), (module) => !isClientEntry(module));
  const server = [...reached].filter(([module]) => !isClientEntry(module));
  const clientEntries = [...reached].filter(([module]) => isClientEntry(module)).map(([module]) => ({ module, trace: [module] }));
  const client = [...walk(modules, clientEntries, () => true)];

  const errors: BoundaryError[] = [
    ...server.filter(([module]) => modules[module]?.only === 'client').map(([module, trace]) => ({ kind: 'client-only-in-server' as const, module, trace })),
    ...client.filter(([module]) => modules[module]?.only === 'server').map(([module, trace]) => ({ kind: 'server-only-in-client' as const, module, trace })),
  ];
  return {
    server: server.map(([module]) => module).toSorted(),
    client: client.map(([module]) => module).toSorted(),
    errors: errors.toSorted((a, b) => (a.module < b.module ? -1 : a.module > b.module ? 1 : 0)),
  };
}
```
:::

:::variant{kind=wrong name=entries-sorted fails=tests reason="客户端入口按名字排序，而不是按被发现的顺序：给出的导入路径不对"}
```ts file=boundary.ts
export type ModuleInfo = Readonly<{
  /** 文件开头的 'use client' 指令 */
  directive?: 'use client';
  /** 只能放在服务端的模块图中（例如导入了 server-only），或者只能放在客户端的模块图中（例如使用了 useState） */
  only?: 'server' | 'client';
  imports: readonly string[];
}>;

export type BoundaryError = Readonly<{
  kind: 'server-only-in-client' | 'client-only-in-server';
  module: string;
  trace: readonly string[];
}>;

export type BoundaryReport = Readonly<{ server: string[]; client: string[]; errors: BoundaryError[] }>;

type Visit = Readonly<{ module: string; trace: readonly string[] }>;

/** 广度优先地访问，返回每个模块第一次被访问到时的导入路径（按访问的顺序） */
function walk(
  modules: Readonly<Record<string, ModuleInfo>>,
  starts: readonly Visit[],
  follow: (module: string) => boolean,
): Map<string, readonly string[]> {
  const traces = new Map<string, readonly string[]>();
  const queue = [...starts];
  for (let visit = queue.shift(); visit !== undefined; visit = queue.shift()) {
    if (traces.has(visit.module)) continue;
    traces.set(visit.module, visit.trace);
    if (!follow(visit.module)) continue;
    for (const next of modules[visit.module]?.imports ?? []) {
      queue.push({ module: next, trace: [...visit.trace, next] });
    }
  }
  return traces;
}

/** 从页面和布局（服务端组件）开始，算出服务端和客户端的模块图，以及越过边界的错误 */
export function analyzeBoundary(modules: Readonly<Record<string, ModuleInfo>>, entries: readonly string[]): BoundaryReport {
  const isClientEntry = (module: string) => modules[module]?.directive === 'use client';
  // 服务端的模块图在 'use client' 处停下：那个模块是客户端入口，它导入的东西都在客户端
  const reached = walk(modules, entries.map((module) => ({ module, trace: [module] })), (module) => !isClientEntry(module));
  const server = [...reached].filter(([module]) => !isClientEntry(module));
  const clientEntries = [...reached].filter(([module]) => isClientEntry(module)).map(([module, trace]) => ({ module, trace })).toSorted((a, b) => (a.module < b.module ? -1 : 1));
  const client = [...walk(modules, clientEntries, () => true)];

  const errors: BoundaryError[] = [
    ...server.filter(([module]) => modules[module]?.only === 'client').map(([module, trace]) => ({ kind: 'client-only-in-server' as const, module, trace })),
    ...client.filter(([module]) => modules[module]?.only === 'server').map(([module, trace]) => ({ kind: 'server-only-in-client' as const, module, trace })),
  ];
  return {
    server: server.map(([module]) => module).toSorted(),
    client: client.map(([module]) => module).toSorted(),
    errors: errors.toSorted((a, b) => (a.module < b.module ? -1 : a.module > b.module ? 1 : 0)),
  };
}
```
:::

:::variant{kind=wrong name=unsorted fails=tests reason="两张模块图没有排序：顺序取决于访问的顺序"}
```ts file=boundary.ts
export type ModuleInfo = Readonly<{
  /** 文件开头的 'use client' 指令 */
  directive?: 'use client';
  /** 只能放在服务端的模块图中（例如导入了 server-only），或者只能放在客户端的模块图中（例如使用了 useState） */
  only?: 'server' | 'client';
  imports: readonly string[];
}>;

export type BoundaryError = Readonly<{
  kind: 'server-only-in-client' | 'client-only-in-server';
  module: string;
  trace: readonly string[];
}>;

export type BoundaryReport = Readonly<{ server: string[]; client: string[]; errors: BoundaryError[] }>;

type Visit = Readonly<{ module: string; trace: readonly string[] }>;

/** 广度优先地访问，返回每个模块第一次被访问到时的导入路径（按访问的顺序） */
function walk(
  modules: Readonly<Record<string, ModuleInfo>>,
  starts: readonly Visit[],
  follow: (module: string) => boolean,
): Map<string, readonly string[]> {
  const traces = new Map<string, readonly string[]>();
  const queue = [...starts];
  for (let visit = queue.shift(); visit !== undefined; visit = queue.shift()) {
    if (traces.has(visit.module)) continue;
    traces.set(visit.module, visit.trace);
    if (!follow(visit.module)) continue;
    for (const next of modules[visit.module]?.imports ?? []) {
      queue.push({ module: next, trace: [...visit.trace, next] });
    }
  }
  return traces;
}

/** 从页面和布局（服务端组件）开始，算出服务端和客户端的模块图，以及越过边界的错误 */
export function analyzeBoundary(modules: Readonly<Record<string, ModuleInfo>>, entries: readonly string[]): BoundaryReport {
  const isClientEntry = (module: string) => modules[module]?.directive === 'use client';
  // 服务端的模块图在 'use client' 处停下：那个模块是客户端入口，它导入的东西都在客户端
  const reached = walk(modules, entries.map((module) => ({ module, trace: [module] })), (module) => !isClientEntry(module));
  const server = [...reached].filter(([module]) => !isClientEntry(module));
  const clientEntries = [...reached].filter(([module]) => isClientEntry(module)).map(([module, trace]) => ({ module, trace }));
  const client = [...walk(modules, clientEntries, () => true)];

  const errors: BoundaryError[] = [
    ...server.filter(([module]) => modules[module]?.only === 'client').map(([module, trace]) => ({ kind: 'client-only-in-server' as const, module, trace })),
    ...client.filter(([module]) => modules[module]?.only === 'server').map(([module, trace]) => ({ kind: 'server-only-in-client' as const, module, trace })),
  ];
  return {
    server: server.map(([module]) => module),
    client: client.map(([module]) => module),
    errors: errors.toSorted((a, b) => (a.module < b.module ? -1 : a.module > b.module ? 1 : 0)),
  };
}
```
:::

