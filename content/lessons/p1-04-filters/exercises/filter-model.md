---
kind: task
title: 筛选条件
mode: ts
---
在 `filters.ts` 中实现筛选用到的纯函数。筛选条件是 `{ q, tag }`：`q` 是一段文字，`tag` 是一个标签，没有标签时是 `null`。

1. **`parseFilters(search)`**：从 `location.search` 这样的字符串中读出 `q` 和 `tag` 两个参数（用 `URLSearchParams`），都去掉首尾空白；`tag` 为空时是 `null`；其他参数忽略；
2. **`toSearch(filters)`**：生成查询字符串，只包含有效的条件（去掉首尾空白之后不为空的 `q`、不是 `null` 的 `tag`），按 `q`、`tag` 的顺序，用 `URLSearchParams` 编码；没有条件时返回空字符串 `''`，否则以 `?` 开头；
3. **`isFiltering(filters)`**：有没有有效的条件；
4. **`matchesFilters(task, filters)`**：任务的标题包含 `q`（去掉首尾空白，不区分英文大小写），**并且**任务带有 `tag` 这个标签（完全相同）；没有的条件不限制；
5. **`filterBoard(board, filters)`**：只保留符合条件的任务；没有有效的条件时返回**原来的** `board`。

:::files{role=starter}
```ts file=filters.ts
import type { Board, Task } from './board';

export type Filters = Readonly<{ q: string; tag: string | null }>;

export const NO_FILTERS: Filters = { q: '', tag: null };

/** 从 location.search 这样的字符串中解析筛选条件 */
export function parseFilters(search: string): Filters {
  return NO_FILTERS;
}

/** 生成查询字符串：只包含有效的条件，按 q、tag 的顺序；没有条件时返回空字符串 */
export function toSearch(filters: Filters): string {
  return '';
}

export function isFiltering(filters: Filters): boolean {
  return false;
}

/** 标题包含 q（不区分英文大小写），并且带有 tag 这个标签 */
export function matchesFilters(task: Task, filters: Filters): boolean {
  return true;
}

/** 只保留符合条件的任务；没有任何条件时返回原来的 board */
export function filterBoard(board: Board, filters: Filters): Board {
  return board;
}
```
```ts file=main.ts
import { filterBoard, parseFilters, toSearch } from './filters';
import { SAMPLE } from './sample';

for (const search of ['', '?q=handbook', '?tag=%E5%AE%B6', '?q=%20%E5%91%A8%E6%8A%A5%20&tag=%E5%B7%A5%E4%BD%9C']) {
  const filters = parseFilters(search);
  const titles = filterBoard(SAMPLE, filters).tasks.map((t) => t.title);
  console.log(JSON.stringify(search), filters, toSearch(filters), titles);
}
```
:::

:::files{role=support}
```ts file=board.ts readonly
export const STATUSES = ['todo', 'doing', 'done'] as const;
export type Status = (typeof STATUSES)[number];

export type Task = Readonly<{ id: string; title: string; tags: readonly string[]; status: Status; createdAt: number }>;
export type Board = Readonly<{ tasks: readonly Task[]; nextId: number }>;

export type Action =
  | { type: 'add'; title: string; tags: readonly string[]; now: number }
  | { type: 'rename'; id: string; title: string }
  | { type: 'step'; id: string; direction: -1 | 1 }
  | { type: 'remove'; id: string };

/** 用 change 计算出新的任务；找不到、或者 change 返回原来的任务时，返回原来的 board */
function updateTask(board: Board, id: string, change: (task: Task) => Task): Board {
  const index = board.tasks.findIndex((t) => t.id === id);
  const task = board.tasks[index];
  if (task === undefined) return board;
  const next = change(task);
  return next === task ? board : { ...board, tasks: board.tasks.with(index, next) };
}

export function reduce(board: Board, action: Action): Board {
  switch (action.type) {
    case 'add': {
      const task: Task = { id: `t${board.nextId}`, title: action.title, tags: action.tags, status: 'todo', createdAt: action.now };
      return { tasks: [...board.tasks, task], nextId: board.nextId + 1 };
    }
    case 'rename': {
      const title = action.title.trim();
      return updateTask(board, action.id, (task) => (title === '' || title === task.title ? task : { ...task, title }));
    }
    case 'step':
      return updateTask(board, action.id, (task) => {
        const next = STATUSES[STATUSES.indexOf(task.status) + action.direction];
        return next === undefined ? task : { ...task, status: next };
      });
    case 'remove': {
      const tasks = board.tasks.filter((t) => t.id !== action.id);
      return tasks.length === board.tasks.length ? board : { ...board, tasks };
    }
    default: {
      const unhandled: never = action;
      throw new Error(`未知的动作：${JSON.stringify(unhandled)}`);
    }
  }
}

const idNumber = (task: Task) => Number(task.id.slice(1));

/** 按状态分成三列；每列按创建时间排序，时间相同时按 id 中的数字排序 */
export function columnsOf(board: Board): Readonly<Record<Status, readonly Task[]>> {
  const sorted = board.tasks.toSorted((a, b) => a.createdAt - b.createdAt || idNumber(a) - idNumber(b));
  return {
    todo: sorted.filter((t) => t.status === 'todo'),
    doing: sorted.filter((t) => t.status === 'doing'),
    done: sorted.filter((t) => t.status === 'done'),
  };
}
```
```ts file=sample.ts readonly
import type { Board } from './board';

/** 页面打开时的示例数据（下一个里程碑会从本地存储中读取） */
export const SAMPLE: Board = {
  tasks: [
    { id: 't1', title: '写周报', tags: ['工作'], status: 'todo', createdAt: 1 },
    { id: 't2', title: '修自行车', tags: ['家'], status: 'doing', createdAt: 2 },
    { id: 't3', title: '买牛奶', tags: ['家'], status: 'done', createdAt: 3 },
    { id: 't4', title: 'Read the TS Handbook', tags: ['学习', '工作'], status: 'todo', createdAt: 4 },
  ],
  nextId: 5,
};
```
:::

:::files{role=solution}
```ts file=filters.ts
import type { Board, Task } from './board';

export type Filters = Readonly<{ q: string; tag: string | null }>;

export const NO_FILTERS: Filters = { q: '', tag: null };

/** 从 location.search 这样的字符串中解析筛选条件 */
export function parseFilters(search: string): Filters {
  const params = new URLSearchParams(search);
  const q = (params.get('q') ?? '').trim();
  const tag = (params.get('tag') ?? '').trim();
  return { q, tag: tag === '' ? null : tag };
}

/** 生成查询字符串：只包含有效的条件，按 q、tag 的顺序；没有条件时返回空字符串 */
export function toSearch(filters: Filters): string {
  const params = new URLSearchParams();
  const q = filters.q.trim();
  if (q !== '') params.set('q', q);
  if (filters.tag !== null) params.set('tag', filters.tag);
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
}

export function isFiltering(filters: Filters): boolean {
  return filters.q.trim() !== '' || filters.tag !== null;
}

/** 标题包含 q（不区分英文大小写），并且带有 tag 这个标签 */
export function matchesFilters(task: Task, filters: Filters): boolean {
  const q = filters.q.trim().toLowerCase();
  if (q !== '' && !task.title.toLowerCase().includes(q)) return false;
  return filters.tag === null || task.tags.includes(filters.tag);
}

/** 只保留符合条件的任务；没有任何条件时返回原来的 board */
export function filterBoard(board: Board, filters: Filters): Board {
  if (!isFiltering(filters)) return board;
  return { ...board, tasks: board.tasks.filter((task) => matchesFilters(task, filters)) };
}
```
```ts file=main.ts
import { filterBoard, parseFilters, toSearch } from './filters';
import { SAMPLE } from './sample';

for (const search of ['', '?q=handbook', '?tag=%E5%AE%B6', '?q=%20%E5%91%A8%E6%8A%A5%20&tag=%E5%B7%A5%E4%BD%9C']) {
  const filters = parseFilters(search);
  const titles = filterBoard(SAMPLE, filters).tasks.map((t) => t.title);
  console.log(JSON.stringify(search), filters, toSearch(filters), titles);
}
```
:::

:::files{role=tests}
```ts file=filters.test.ts
import { describe, expect, test } from 'vitest';
import type { Board, Task } from './board';
import { filterBoard, isFiltering, matchesFilters, NO_FILTERS, parseFilters, toSearch } from './filters';

function task(id: string, title: string, tags: string[]): Task {
  return Object.freeze({ id, title, tags: Object.freeze(tags), status: 'todo', createdAt: Number(id.slice(1)) });
}

const board: Board = Object.freeze({
  tasks: Object.freeze([task('t1', '写周报', ['工作']), task('t2', 'Read the TS Handbook', ['学习', '工作']), task('t3', '买牛奶', ['家'])]),
  nextId: 4,
});

describe('parseFilters', () => {
  test('没有参数时是 NO_FILTERS', () => {
    expect(parseFilters('')).toEqual(NO_FILTERS);
    expect(parseFilters('?')).toEqual(NO_FILTERS);
  });

  test('解码并去掉首尾空白；空的 tag 是 null；其他参数忽略', () => {
    expect(parseFilters('?q=%20%E5%91%A8%E6%8A%A5%20&tag=%E5%B7%A5%E4%BD%9C')).toEqual({ q: '周报', tag: '工作' });
    expect(parseFilters('tag=&q=ts&page=2')).toEqual({ q: 'ts', tag: null });
    expect(parseFilters('?tag=%20')).toEqual({ q: '', tag: null });
  });
});

describe('toSearch', () => {
  test('只包含有效的条件，按 q、tag 的顺序', () => {
    expect(toSearch(NO_FILTERS)).toBe('');
    expect(toSearch({ q: '  ', tag: null })).toBe('');
    expect(toSearch({ q: ' ts ', tag: null })).toBe('?q=ts');
    expect(toSearch({ tag: '家', q: '牛奶' })).toBe('?q=%E7%89%9B%E5%A5%B6&tag=%E5%AE%B6');
  });

  test('特殊字符被正确编码，可以原样解析回来', () => {
    const filters = { q: 'a&b=c #1', tag: 'C++' };
    expect(toSearch(filters)).toBe('?q=a%26b%3Dc+%231&tag=C%2B%2B');
    expect(parseFilters(toSearch(filters))).toEqual(filters);
  });
});

describe('isFiltering 与 matchesFilters', () => {
  test('只有空白的 q 不算筛选', () => {
    expect(isFiltering(NO_FILTERS)).toBe(false);
    expect(isFiltering({ q: '   ', tag: null })).toBe(false);
    expect(isFiltering({ q: '', tag: '家' })).toBe(true);
  });

  test('标题包含 q，不区分英文大小写', () => {
    const handbook = board.tasks[1] ?? task('t0', '', []);
    expect(matchesFilters(handbook, { q: 'ts handbook', tag: null })).toBe(true);
    expect(matchesFilters(handbook, { q: ' READ ', tag: null })).toBe(true);
    expect(matchesFilters(handbook, { q: '周报', tag: null })).toBe(false);
  });

  test('标签要完全相同；两个条件同时满足', () => {
    const handbook = board.tasks[1] ?? task('t0', '', []);
    expect(matchesFilters(handbook, { q: '', tag: '工作' })).toBe(true);
    expect(matchesFilters(handbook, { q: '', tag: '工' })).toBe(false);
    expect(matchesFilters(handbook, { q: 'handbook', tag: '家' })).toBe(false);
    expect(matchesFilters(handbook, { q: 'handbook', tag: '学习' })).toBe(true);
  });
});

describe('filterBoard', () => {
  test('没有条件时返回原来的 board', () => {
    expect(filterBoard(board, NO_FILTERS)).toBe(board);
    expect(filterBoard(board, { q: ' ', tag: null })).toBe(board);
  });

  test('只保留符合条件的任务，任务对象和 nextId 不变', () => {
    const result = filterBoard(board, { q: '', tag: '工作' });
    expect(result.tasks.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(result.tasks[0]).toBe(board.tasks[0]);
    expect(result.nextId).toBe(4);
    expect(filterBoard(board, { q: '牛奶', tag: '工作' }).tasks).toEqual([]);
  });
});
```
```ts file=filters.test-d.ts
import type { Filters } from './filters';

const ok: Filters = { q: '周报', tag: null };
// @ts-expect-error 没有标签时用 null，不能省略
const missing: Filters = { q: '' };
// @ts-expect-error 筛选条件是只读的
ok.q = '改了';
console.log(ok, missing);
```
:::

:::hint{level=1}
`new URLSearchParams(search)` 可以直接解析带 `?` 的字符串，`get` 取不到时返回 `null`。生成时新建一个空的 `URLSearchParams`，只 `set` 有效的条件，最后 `toString()`，不为空再加上 `?`。
:::

:::hint{level=2}
不区分大小写：两边都 `toLowerCase()` 再 `includes`。标签用 `task.tags.includes(tag)` 判断完全相同的一项。`filterBoard` 先用 `isFiltering` 判断，没有条件时直接 `return board`，否则 `{ ...board, tasks: board.tasks.filter(…) }`。
:::

:::explanation
这些函数都是纯的，和页面无关，所以可以像 e10 的 `parseFilters`/`toSearch` 一样单独测试。几个细节：

- `tag` 用 `null` 表示“不按标签筛选”，类型中只有这**一种**“没有”。地址中的 `?tag=` 在解析时就归一化成 `null`，之后的代码只需要判断 `tag !== null`。如果 `''` 也可能出现，代码中就有了两种“没有”：常见的错误写法是解析时保留空字符串，而使用的地方只检查了 `null`，于是 `''` 被当成一个标签，一个任务都不显示；
- 标签要求**完全相同**：`#工` 不应该筛出 `#工作`。标题是“包含”，标签是“等于”，这是两种不同的筛选；
- 编码交给 `URLSearchParams`：`&`、`=`、`#`、`+` 都有特殊含义，手工拼接 `?q=${q}` 的话，`a&b=c` 会被拆成两个参数，`C++` 会变成 `C  `（`+` 在查询参数中表示空格）；
- `filterBoard` 在没有条件时返回原来的对象，调用方就可以用 `===` 判断“有没有在筛选”，任务对象本身也都保持不变。
:::

:::variant{kind=alt name=entries}
```ts file=filters.ts
import type { Board, Task } from './board';

export type Filters = Readonly<{ q: string; tag: string | null }>;

export const NO_FILTERS: Filters = { q: '', tag: null };

const clean = (value: string | null) => value?.trim() ?? '';

export function parseFilters(search: string): Filters {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return { q: clean(params.get('q')), tag: clean(params.get('tag')) || null };
}

export function toSearch(filters: Filters): string {
  const entries: [string, string][] = [];
  if (clean(filters.q)) entries.push(['q', clean(filters.q)]);
  if (filters.tag !== null) entries.push(['tag', filters.tag]);
  return entries.length ? `?${new URLSearchParams(entries)}` : '';
}

export function isFiltering({ q, tag }: Filters): boolean {
  return Boolean(clean(q)) || tag !== null;
}

export function matchesFilters(task: Task, { q, tag }: Filters): boolean {
  const needle = clean(q).toLocaleLowerCase();
  const titleOk = needle === '' || task.title.toLocaleLowerCase().includes(needle);
  const tagOk = tag === null || task.tags.some((t) => t === tag);
  return titleOk && tagOk;
}

export function filterBoard(board: Board, filters: Filters): Board {
  return isFiltering(filters) ? { tasks: board.tasks.filter((t) => matchesFilters(t, filters)), nextId: board.nextId } : board;
}
```
:::

:::variant{kind=wrong name=empty-tag fails=tests reason="?tag= 时 tag 是空字符串而不是 null，结果一个任务都不显示"}
```ts file=filters.ts
import type { Board, Task } from './board';

export type Filters = Readonly<{ q: string; tag: string | null }>;

export const NO_FILTERS: Filters = { q: '', tag: null };

/** 从 location.search 这样的字符串中解析筛选条件 */
export function parseFilters(search: string): Filters {
  const params = new URLSearchParams(search);
  const q = (params.get('q') ?? '').trim();
  const tag = (params.get('tag') ?? '').trim();
  return { q, tag: params.has('tag') ? tag : null };
}

/** 生成查询字符串：只包含有效的条件，按 q、tag 的顺序；没有条件时返回空字符串 */
export function toSearch(filters: Filters): string {
  const params = new URLSearchParams();
  const q = filters.q.trim();
  if (q !== '') params.set('q', q);
  if (filters.tag !== null) params.set('tag', filters.tag);
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
}

export function isFiltering(filters: Filters): boolean {
  return filters.q.trim() !== '' || filters.tag !== null;
}

/** 标题包含 q（不区分英文大小写），并且带有 tag 这个标签 */
export function matchesFilters(task: Task, filters: Filters): boolean {
  const q = filters.q.trim().toLowerCase();
  if (q !== '' && !task.title.toLowerCase().includes(q)) return false;
  return filters.tag === null || task.tags.includes(filters.tag);
}

/** 只保留符合条件的任务；没有任何条件时返回原来的 board */
export function filterBoard(board: Board, filters: Filters): Board {
  if (!isFiltering(filters)) return board;
  return { ...board, tasks: board.tasks.filter((task) => matchesFilters(task, filters)) };
}
```
:::

:::variant{kind=wrong name=case-sensitive fails=tests reason="比较标题时区分了大小写"}
```ts file=filters.ts
import type { Board, Task } from './board';

export type Filters = Readonly<{ q: string; tag: string | null }>;

export const NO_FILTERS: Filters = { q: '', tag: null };

/** 从 location.search 这样的字符串中解析筛选条件 */
export function parseFilters(search: string): Filters {
  const params = new URLSearchParams(search);
  const q = (params.get('q') ?? '').trim();
  const tag = (params.get('tag') ?? '').trim();
  return { q, tag: tag === '' ? null : tag };
}

/** 生成查询字符串：只包含有效的条件，按 q、tag 的顺序；没有条件时返回空字符串 */
export function toSearch(filters: Filters): string {
  const params = new URLSearchParams();
  const q = filters.q.trim();
  if (q !== '') params.set('q', q);
  if (filters.tag !== null) params.set('tag', filters.tag);
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
}

export function isFiltering(filters: Filters): boolean {
  return filters.q.trim() !== '' || filters.tag !== null;
}

/** 标题包含 q（不区分英文大小写），并且带有 tag 这个标签 */
export function matchesFilters(task: Task, filters: Filters): boolean {
  const q = filters.q.trim();
  if (q !== '' && !task.title.includes(q)) return false;
  return filters.tag === null || task.tags.includes(filters.tag);
}

/** 只保留符合条件的任务；没有任何条件时返回原来的 board */
export function filterBoard(board: Board, filters: Filters): Board {
  if (!isFiltering(filters)) return board;
  return { ...board, tasks: board.tasks.filter((task) => matchesFilters(task, filters)) };
}
```
:::

:::variant{kind=wrong name=tag-substring fails=tests reason="标签按“包含”比较，#工 也筛出了 #工作"}
```ts file=filters.ts
import type { Board, Task } from './board';

export type Filters = Readonly<{ q: string; tag: string | null }>;

export const NO_FILTERS: Filters = { q: '', tag: null };

/** 从 location.search 这样的字符串中解析筛选条件 */
export function parseFilters(search: string): Filters {
  const params = new URLSearchParams(search);
  const q = (params.get('q') ?? '').trim();
  const tag = (params.get('tag') ?? '').trim();
  return { q, tag: tag === '' ? null : tag };
}

/** 生成查询字符串：只包含有效的条件，按 q、tag 的顺序；没有条件时返回空字符串 */
export function toSearch(filters: Filters): string {
  const params = new URLSearchParams();
  const q = filters.q.trim();
  if (q !== '') params.set('q', q);
  if (filters.tag !== null) params.set('tag', filters.tag);
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
}

export function isFiltering(filters: Filters): boolean {
  return filters.q.trim() !== '' || filters.tag !== null;
}

/** 标题包含 q（不区分英文大小写），并且带有 tag 这个标签 */
export function matchesFilters(task: Task, filters: Filters): boolean {
  const q = filters.q.trim().toLowerCase();
  if (q !== '' && !task.title.toLowerCase().includes(q)) return false;
  return filters.tag === null || task.tags.some((t) => t.includes(filters.tag ?? ''));
}

/** 只保留符合条件的任务；没有任何条件时返回原来的 board */
export function filterBoard(board: Board, filters: Filters): Board {
  if (!isFiltering(filters)) return board;
  return { ...board, tasks: board.tasks.filter((task) => matchesFilters(task, filters)) };
}
```
:::

:::variant{kind=wrong name=manual-query fails=tests reason="手工拼接查询字符串，没有编码"}
```ts file=filters.ts
import type { Board, Task } from './board';

export type Filters = Readonly<{ q: string; tag: string | null }>;

export const NO_FILTERS: Filters = { q: '', tag: null };

/** 从 location.search 这样的字符串中解析筛选条件 */
export function parseFilters(search: string): Filters {
  const params = new URLSearchParams(search);
  const q = (params.get('q') ?? '').trim();
  const tag = (params.get('tag') ?? '').trim();
  return { q, tag: tag === '' ? null : tag };
}

/** 生成查询字符串：只包含有效的条件，按 q、tag 的顺序；没有条件时返回空字符串 */
export function toSearch(filters: Filters): string {
  const parts: string[] = [];
  const q = filters.q.trim();
  if (q !== '') parts.push(`q=${q}`);
  if (filters.tag !== null) parts.push(`tag=${filters.tag}`);
  return parts.length === 0 ? '' : `?${parts.join('&')}`;
}

export function isFiltering(filters: Filters): boolean {
  return filters.q.trim() !== '' || filters.tag !== null;
}

/** 标题包含 q（不区分英文大小写），并且带有 tag 这个标签 */
export function matchesFilters(task: Task, filters: Filters): boolean {
  const q = filters.q.trim().toLowerCase();
  if (q !== '' && !task.title.toLowerCase().includes(q)) return false;
  return filters.tag === null || task.tags.includes(filters.tag);
}

/** 只保留符合条件的任务；没有任何条件时返回原来的 board */
export function filterBoard(board: Board, filters: Filters): Board {
  if (!isFiltering(filters)) return board;
  return { ...board, tasks: board.tasks.filter((task) => matchesFilters(task, filters)) };
}
```
:::

:::variant{kind=wrong name=always-new-board fails=tests reason="没有条件时也返回了新的 board"}
```ts file=filters.ts
import type { Board, Task } from './board';

export type Filters = Readonly<{ q: string; tag: string | null }>;

export const NO_FILTERS: Filters = { q: '', tag: null };

/** 从 location.search 这样的字符串中解析筛选条件 */
export function parseFilters(search: string): Filters {
  const params = new URLSearchParams(search);
  const q = (params.get('q') ?? '').trim();
  const tag = (params.get('tag') ?? '').trim();
  return { q, tag: tag === '' ? null : tag };
}

/** 生成查询字符串：只包含有效的条件，按 q、tag 的顺序；没有条件时返回空字符串 */
export function toSearch(filters: Filters): string {
  const params = new URLSearchParams();
  const q = filters.q.trim();
  if (q !== '') params.set('q', q);
  if (filters.tag !== null) params.set('tag', filters.tag);
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
}

export function isFiltering(filters: Filters): boolean {
  return filters.q.trim() !== '' || filters.tag !== null;
}

/** 标题包含 q（不区分英文大小写），并且带有 tag 这个标签 */
export function matchesFilters(task: Task, filters: Filters): boolean {
  const q = filters.q.trim().toLowerCase();
  if (q !== '' && !task.title.toLowerCase().includes(q)) return false;
  return filters.tag === null || task.tags.includes(filters.tag);
}

/** 只保留符合条件的任务；没有任何条件时返回原来的 board */
export function filterBoard(board: Board, filters: Filters): Board {
  return { ...board, tasks: board.tasks.filter((task) => matchesFilters(task, filters)) };
}
```
:::
