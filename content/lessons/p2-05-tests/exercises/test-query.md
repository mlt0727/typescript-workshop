---
kind: task
mode: ts
title: 为筛选与排序写单元测试
grading: tests
---
`query.ts`（只读）是 p2-02 的筛选与排序：`parseFilters`、`toSearchParams`、`listProjects`。在 `query.test.ts` 中为它们写测试。

平台准备了八个写错的 `query.ts`，每个都只错了一处，错在 p2-02 的要求中容易忽略的地方：没有截止日期的项目、搜索词的空白和大小写、并列时的顺序、拼音的顺序、哪些项目算“过期”、地址中的值和默认值。你的测试先要在正确的 `query.ts` 上全部通过，然后要发现每一个写错的版本。

要求回顾（p2-02）：`parseFilters` 对不认识的值（包括大小写不同的）用默认值，搜索词原样保留；`toSearchParams` 不写入和默认值相同的条件；`listProjects` 的搜索去掉首尾空白、不区分大小写，匹配名称或负责人；“已过期”是没有完成、截止日期在今天之前；按截止日期排序时没有截止日期的在最后，日期相同时按名称；名称按拼音排序。

:::files{role=support}
```ts file=query.ts readonly
import { STATUSES, type Project } from './model';
import { summarize } from './summary';

/** 状态筛选：'all' 是全部，'overdue' 是已过期的项目 */
export const STATUS_FILTERS = ['all', ...STATUSES, 'overdue'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export const SORTS = ['due', 'name'] as const;
export type Sort = (typeof SORTS)[number];

export type Filters = Readonly<{ status: StatusFilter; q: string; sort: Sort }>;

export const DEFAULT_FILTERS: Filters = { status: 'all', q: '', sort: 'due' };

/** 从地址的查询参数中读出筛选条件：缺少的参数和不认识的值都用默认值 */
export function parseFilters(params: URLSearchParams): Filters {
  const status = params.get('status');
  const sort = params.get('sort');
  return {
    status: STATUS_FILTERS.find((s) => s === status) ?? DEFAULT_FILTERS.status,
    q: params.get('q') ?? DEFAULT_FILTERS.q,
    sort: SORTS.find((s) => s === sort) ?? DEFAULT_FILTERS.sort,
  };
}

/** 生成查询参数：和默认值相同的条件不写进地址 */
export function toSearchParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status !== DEFAULT_FILTERS.status) params.set('status', filters.status);
  if (filters.q !== DEFAULT_FILTERS.q) params.set('q', filters.q);
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set('sort', filters.sort);
  return params;
}

const byName = (a: Project, b: Project) => a.name.localeCompare(b.name, 'zh-CN');

function byDueDate(a: Project, b: Project): number {
  if (a.dueDate === b.dueDate) return byName(a, b);
  // 没有截止日期的排在最后
  if (a.dueDate === null) return 1;
  if (b.dueDate === null) return -1;
  return a.dueDate < b.dueDate ? -1 : 1;
}

/** 列表页上显示的项目：按 filters 筛选、排序 */
export function listProjects(projects: readonly Project[], filters: Filters, today: string): Project[] {
  const q = filters.q.trim().toLowerCase();
  const matches = projects.filter((p) => {
    if (filters.status === 'overdue') {
      if (!summarize(p, today).overdue) return false;
    } else if (filters.status !== 'all' && p.status !== filters.status) {
      return false;
    }
    return q === '' || p.name.toLowerCase().includes(q) || p.owner.toLowerCase().includes(q);
  });
  return matches.toSorted(filters.sort === 'name' ? byName : byDueDate);
}
```
```ts file=model.ts readonly
/** 项目的三种状态：计划中、进行中、已完成 */
export const STATUSES = ['planning', 'active', 'done'] as const;
export type ProjectStatus = (typeof STATUSES)[number];

export const STATUS_NAMES: Readonly<Record<ProjectStatus, string>> = { planning: '计划中', active: '进行中', done: '已完成' };

export type Task = Readonly<{ id: string; title: string; done: boolean }>;

export type Project = Readonly<{
  id: string;
  name: string;
  owner: string;
  status: ProjectStatus;
  /** 截止日期，格式是 YYYY-MM-DD；没有截止日期时是 null */
  dueDate: string | null;
  tasks: readonly Task[];
}>;
```
```ts file=summary.ts readonly
import type { Project } from './model';

export type Summary = Readonly<{
  done: number;
  total: number;
  /** 完成的百分比，向下取整；没有任务时是 0 */
  percent: number;
  /** 还没有完成，并且截止日期在今天之前 */
  overdue: boolean;
  /** 从今天到截止日期还有几天（过期时是负数）；没有截止日期时是 null */
  daysLeft: number | null;
}>;

const DAY = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' 这一天的 UTC 零点（毫秒）：按 UTC 计算，不受时区和夏令时的影响 */
function utcDay(date: string): number {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

/** today 和 project.dueDate 都是 'YYYY-MM-DD' */
export function summarize(project: Project, today: string): Summary {
  const total = project.tasks.length;
  const done = project.tasks.filter((t) => t.done).length;
  const percent = total === 0 ? 0 : Math.floor((done * 100) / total);
  const daysLeft = project.dueDate === null ? null : (utcDay(project.dueDate) - utcDay(today)) / DAY;
  const overdue = project.status !== 'done' && daysLeft !== null && daysLeft < 0;
  return { done, total, percent, overdue, daysLeft };
}
```
:::

:::files{role=starter}
```ts file=query.test.ts
import { describe, expect, test } from 'vitest';
import type { Project } from './model';
import { DEFAULT_FILTERS, listProjects, parseFilters, toSearchParams, type Filters } from './query';

const TODAY = '2026-10-20';

/** 测试数据：只写和这个测试有关的字段 */
function project(id: string, name: string, fields: Partial<Project> = {}): Project {
  return { id, name, owner: '小林', status: 'active', dueDate: null, tasks: [], ...fields };
}

const names = (projects: readonly Project[]) => projects.map((p) => p.name);
const filters = (changes: Partial<Filters>): Filters => ({ ...DEFAULT_FILTERS, ...changes });

describe('parseFilters', () => {
  test('没有参数时是默认值', () => {
    expect(parseFilters(new URLSearchParams(''))).toEqual({ status: 'all', q: '', sort: 'due' });
  });
});

// TODO：为 parseFilters、toSearchParams、listProjects 写更多的测试
```
:::

:::files{role=solution}
```ts file=query.test.ts
import { describe, expect, test } from 'vitest';
import type { Project } from './model';
import { DEFAULT_FILTERS, listProjects, parseFilters, toSearchParams, type Filters } from './query';

const TODAY = '2026-10-20';

function project(id: string, name: string, fields: Partial<Project> = {}): Project {
  return { id, name, owner: '小林', status: 'active', dueDate: null, tasks: [], ...fields };
}

const parse = (search: string) => parseFilters(new URLSearchParams(search));
const names = (projects: readonly Project[]) => projects.map((p) => p.name);
const filters = (changes: Partial<Filters>): Filters => ({ ...DEFAULT_FILTERS, ...changes });

describe('parseFilters', () => {
  test('没有参数时是默认值', () => {
    expect(parse('')).toEqual({ status: 'all', q: '', sort: 'due' });
  });

  test('读出三个参数', () => {
    expect(parse('status=active&q=%E5%B0%8F%E6%9E%97&sort=name')).toEqual({ status: 'active', q: '小林', sort: 'name' });
    expect(parse('status=overdue').status).toBe('overdue');
    expect(parse('status=planning').status).toBe('planning');
    expect(parse('status=done').status).toBe('done');
    expect(parse('status=all').status).toBe('all');
  });

  test('不认识的值用默认值', () => {
    for (const search of ['status=Active', 'status=', 'status=late', 'status=active%20']) {
      expect(parse(search).status, search).toBe('all');
    }
    for (const search of ['sort=date', 'sort=', 'sort=NAME']) {
      expect(parse(search).sort, search).toBe('due');
    }
  });

  test('搜索词原样保留（包括空白），由筛选时处理', () => {
    expect(parse('q=+%E5%B0%8F+').q).toBe(' 小 ');
  });

  test('toSearchParams 不写入默认值', () => {
    expect(toSearchParams(DEFAULT_FILTERS).toString()).toBe('');
    expect(toSearchParams(filters({ sort: 'name' })).toString()).toBe('sort=name');
    expect(toSearchParams(filters({ status: 'done', q: '林' })).toString()).toBe('status=done&q=%E6%9E%97');
  });

  test('和 toSearchParams 互为逆运算', () => {
    const samples: Filters[] = [
      DEFAULT_FILTERS,
      { status: 'done', q: '', sort: 'name' },
      { status: 'overdue', q: 'a&b=c', sort: 'due' },
      { status: 'all', q: ' 林 ', sort: 'name' },
    ];
    for (const f of samples) expect(parseFilters(toSearchParams(f))).toEqual(f);
  });
});

describe('listProjects：筛选', () => {
  const all = [
    project('a', '官网改版', { status: 'active', dueDate: '2026-11-15' }),
    project('b', '数据迁移', { status: 'active', dueDate: '2026-10-12', owner: '阿明' }),
    project('c', '季度报告', { status: 'done', dueDate: '2026-09-30', owner: 'Lin' }),
    project('d', '招聘计划', { status: 'planning', dueDate: '2026-10-19' }),
    project('e', '培训课程', { status: 'planning', dueDate: TODAY, owner: '阿明' }),
  ];

  test('按状态筛选', () => {
    expect(names(listProjects(all, filters({ status: 'active' }), TODAY)).toSorted()).toEqual(['官网改版', '数据迁移'].toSorted());
    expect(names(listProjects(all, filters({ status: 'done' }), TODAY))).toEqual(['季度报告']);
    expect(names(listProjects(all, filters({ status: 'planning' }), TODAY)).toSorted()).toEqual(['招聘计划', '培训课程'].toSorted());
    expect(listProjects(all, DEFAULT_FILTERS, TODAY)).toHaveLength(5);
  });

  test('已过期：没有完成、截止日期在今天之前（已完成的和今天到期的都不算）', () => {
    expect(names(listProjects(all, filters({ status: 'overdue' }), TODAY))).toEqual(['数据迁移', '招聘计划']);
  });

  test('搜索名称或负责人，去掉首尾空白，不区分大小写', () => {
    expect(names(listProjects(all, filters({ q: '迁移' }), TODAY))).toEqual(['数据迁移']);
    expect(names(listProjects(all, filters({ q: ' 阿明 ' }), TODAY))).toEqual(['数据迁移', '培训课程']);
    expect(names(listProjects(all, filters({ q: 'lin' }), TODAY))).toEqual(['季度报告']);
    expect(names(listProjects(all, filters({ q: 'LIN' }), TODAY))).toEqual(['季度报告']);
    expect(listProjects(all, filters({ q: '   ' }), TODAY)).toHaveLength(5);
    expect(listProjects(all, filters({ q: '没有' }), TODAY)).toEqual([]);
  });

  test('几个条件同时生效', () => {
    expect(names(listProjects(all, filters({ status: 'planning', q: '阿明' }), TODAY))).toEqual(['培训课程']);
    expect(listProjects(all, filters({ status: 'done', q: '阿明' }), TODAY)).toEqual([]);
  });
});

describe('listProjects：排序', () => {
  const all = [
    project('a', '招聘计划'),
    project('b', '官网改版', { dueDate: '2026-11-15' }),
    project('c', '数据迁移', { dueDate: '2026-10-12' }),
    project('d', '培训课程'),
    project('e', '安全检查', { dueDate: '2026-11-15' }),
    project('f', '季度报告', { dueDate: '2026-12-01' }),
  ];

  test('按截止日期：早的在前，没有截止日期的在最后，日期相同时按名称', () => {
    expect(names(listProjects(all, DEFAULT_FILTERS, TODAY))).toEqual(['数据迁移', '安全检查', '官网改版', '季度报告', '培训课程', '招聘计划']);
  });

  test('按名称：中文按拼音排序', () => {
    expect(names(listProjects(all, filters({ sort: 'name' }), TODAY))).toEqual(['安全检查', '官网改版', '季度报告', '培训课程', '数据迁移', '招聘计划']);
  });

  test('不修改传入的数组', () => {
    const before = names(all);
    listProjects(all, filters({ sort: 'name' }), TODAY);
    listProjects(all, DEFAULT_FILTERS, TODAY);
    expect(names(all)).toEqual(before);
  });
});
```
:::

:::mutant{name=null-first hint="没有截止日期的项目被排到了最前面：需要一个测试，其中既有带截止日期的项目，也有没有截止日期的"}
```ts file=query.ts
import { STATUSES, type Project } from './model';
import { summarize } from './summary';

/** 状态筛选：'all' 是全部，'overdue' 是已过期的项目 */
export const STATUS_FILTERS = ['all', ...STATUSES, 'overdue'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export const SORTS = ['due', 'name'] as const;
export type Sort = (typeof SORTS)[number];

export type Filters = Readonly<{ status: StatusFilter; q: string; sort: Sort }>;

export const DEFAULT_FILTERS: Filters = { status: 'all', q: '', sort: 'due' };

/** 从地址的查询参数中读出筛选条件：缺少的参数和不认识的值都用默认值 */
export function parseFilters(params: URLSearchParams): Filters {
  const status = params.get('status');
  const sort = params.get('sort');
  return {
    status: STATUS_FILTERS.find((s) => s === status) ?? DEFAULT_FILTERS.status,
    q: params.get('q') ?? DEFAULT_FILTERS.q,
    sort: SORTS.find((s) => s === sort) ?? DEFAULT_FILTERS.sort,
  };
}

/** 生成查询参数：和默认值相同的条件不写进地址 */
export function toSearchParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status !== DEFAULT_FILTERS.status) params.set('status', filters.status);
  if (filters.q !== DEFAULT_FILTERS.q) params.set('q', filters.q);
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set('sort', filters.sort);
  return params;
}

const byName = (a: Project, b: Project) => a.name.localeCompare(b.name, 'zh-CN');

function byDueDate(a: Project, b: Project): number {
  const x = a.dueDate ?? '';
  const y = b.dueDate ?? '';
  if (x === y) return byName(a, b);
  return x < y ? -1 : 1;
}

/** 列表页上显示的项目：按 filters 筛选、排序 */
export function listProjects(projects: readonly Project[], filters: Filters, today: string): Project[] {
  const q = filters.q.trim().toLowerCase();
  const matches = projects.filter((p) => {
    if (filters.status === 'overdue') {
      if (!summarize(p, today).overdue) return false;
    } else if (filters.status !== 'all' && p.status !== filters.status) {
      return false;
    }
    return q === '' || p.name.toLowerCase().includes(q) || p.owner.toLowerCase().includes(q);
  });
  return matches.toSorted(filters.sort === 'name' ? byName : byDueDate);
}
```
:::

:::mutant{name=no-trim hint="搜索词没有去掉首尾空白：需要用前后带空格的搜索词测试"}
```ts file=query.ts
import { STATUSES, type Project } from './model';
import { summarize } from './summary';

/** 状态筛选：'all' 是全部，'overdue' 是已过期的项目 */
export const STATUS_FILTERS = ['all', ...STATUSES, 'overdue'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export const SORTS = ['due', 'name'] as const;
export type Sort = (typeof SORTS)[number];

export type Filters = Readonly<{ status: StatusFilter; q: string; sort: Sort }>;

export const DEFAULT_FILTERS: Filters = { status: 'all', q: '', sort: 'due' };

/** 从地址的查询参数中读出筛选条件：缺少的参数和不认识的值都用默认值 */
export function parseFilters(params: URLSearchParams): Filters {
  const status = params.get('status');
  const sort = params.get('sort');
  return {
    status: STATUS_FILTERS.find((s) => s === status) ?? DEFAULT_FILTERS.status,
    q: params.get('q') ?? DEFAULT_FILTERS.q,
    sort: SORTS.find((s) => s === sort) ?? DEFAULT_FILTERS.sort,
  };
}

/** 生成查询参数：和默认值相同的条件不写进地址 */
export function toSearchParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status !== DEFAULT_FILTERS.status) params.set('status', filters.status);
  if (filters.q !== DEFAULT_FILTERS.q) params.set('q', filters.q);
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set('sort', filters.sort);
  return params;
}

const byName = (a: Project, b: Project) => a.name.localeCompare(b.name, 'zh-CN');

function byDueDate(a: Project, b: Project): number {
  if (a.dueDate === b.dueDate) return byName(a, b);
  // 没有截止日期的排在最后
  if (a.dueDate === null) return 1;
  if (b.dueDate === null) return -1;
  return a.dueDate < b.dueDate ? -1 : 1;
}

/** 列表页上显示的项目：按 filters 筛选、排序 */
export function listProjects(projects: readonly Project[], filters: Filters, today: string): Project[] {
  const q = filters.q.toLowerCase();
  const matches = projects.filter((p) => {
    if (filters.status === 'overdue') {
      if (!summarize(p, today).overdue) return false;
    } else if (filters.status !== 'all' && p.status !== filters.status) {
      return false;
    }
    return q === '' || p.name.toLowerCase().includes(q) || p.owner.toLowerCase().includes(q);
  });
  return matches.toSorted(filters.sort === 'name' ? byName : byDueDate);
}
```
:::

:::mutant{name=code-units hint="名称按汉字的编号排序，不是拼音：需要几个编号顺序和拼音顺序不同的名称（例如“安全检查”“官网改版”“培训课程”“数据迁移”）"}
```ts file=query.ts
import { STATUSES, type Project } from './model';
import { summarize } from './summary';

/** 状态筛选：'all' 是全部，'overdue' 是已过期的项目 */
export const STATUS_FILTERS = ['all', ...STATUSES, 'overdue'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export const SORTS = ['due', 'name'] as const;
export type Sort = (typeof SORTS)[number];

export type Filters = Readonly<{ status: StatusFilter; q: string; sort: Sort }>;

export const DEFAULT_FILTERS: Filters = { status: 'all', q: '', sort: 'due' };

/** 从地址的查询参数中读出筛选条件：缺少的参数和不认识的值都用默认值 */
export function parseFilters(params: URLSearchParams): Filters {
  const status = params.get('status');
  const sort = params.get('sort');
  return {
    status: STATUS_FILTERS.find((s) => s === status) ?? DEFAULT_FILTERS.status,
    q: params.get('q') ?? DEFAULT_FILTERS.q,
    sort: SORTS.find((s) => s === sort) ?? DEFAULT_FILTERS.sort,
  };
}

/** 生成查询参数：和默认值相同的条件不写进地址 */
export function toSearchParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status !== DEFAULT_FILTERS.status) params.set('status', filters.status);
  if (filters.q !== DEFAULT_FILTERS.q) params.set('q', filters.q);
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set('sort', filters.sort);
  return params;
}

const byName = (a: Project, b: Project) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

function byDueDate(a: Project, b: Project): number {
  if (a.dueDate === b.dueDate) return byName(a, b);
  // 没有截止日期的排在最后
  if (a.dueDate === null) return 1;
  if (b.dueDate === null) return -1;
  return a.dueDate < b.dueDate ? -1 : 1;
}

/** 列表页上显示的项目：按 filters 筛选、排序 */
export function listProjects(projects: readonly Project[], filters: Filters, today: string): Project[] {
  const q = filters.q.trim().toLowerCase();
  const matches = projects.filter((p) => {
    if (filters.status === 'overdue') {
      if (!summarize(p, today).overdue) return false;
    } else if (filters.status !== 'all' && p.status !== filters.status) {
      return false;
    }
    return q === '' || p.name.toLowerCase().includes(q) || p.owner.toLowerCase().includes(q);
  });
  return matches.toSorted(filters.sort === 'name' ? byName : byDueDate);
}
```
:::

:::mutant{name=overdue-done hint="已完成的项目也被当作过期：需要一个截止日期已过、但状态是已完成的项目"}
```ts file=query.ts
import { STATUSES, type Project } from './model';
import { summarize } from './summary';

/** 状态筛选：'all' 是全部，'overdue' 是已过期的项目 */
export const STATUS_FILTERS = ['all', ...STATUSES, 'overdue'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export const SORTS = ['due', 'name'] as const;
export type Sort = (typeof SORTS)[number];

export type Filters = Readonly<{ status: StatusFilter; q: string; sort: Sort }>;

export const DEFAULT_FILTERS: Filters = { status: 'all', q: '', sort: 'due' };

/** 从地址的查询参数中读出筛选条件：缺少的参数和不认识的值都用默认值 */
export function parseFilters(params: URLSearchParams): Filters {
  const status = params.get('status');
  const sort = params.get('sort');
  return {
    status: STATUS_FILTERS.find((s) => s === status) ?? DEFAULT_FILTERS.status,
    q: params.get('q') ?? DEFAULT_FILTERS.q,
    sort: SORTS.find((s) => s === sort) ?? DEFAULT_FILTERS.sort,
  };
}

/** 生成查询参数：和默认值相同的条件不写进地址 */
export function toSearchParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status !== DEFAULT_FILTERS.status) params.set('status', filters.status);
  if (filters.q !== DEFAULT_FILTERS.q) params.set('q', filters.q);
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set('sort', filters.sort);
  return params;
}

const byName = (a: Project, b: Project) => a.name.localeCompare(b.name, 'zh-CN');

function byDueDate(a: Project, b: Project): number {
  if (a.dueDate === b.dueDate) return byName(a, b);
  // 没有截止日期的排在最后
  if (a.dueDate === null) return 1;
  if (b.dueDate === null) return -1;
  return a.dueDate < b.dueDate ? -1 : 1;
}

/** 列表页上显示的项目：按 filters 筛选、排序 */
export function listProjects(projects: readonly Project[], filters: Filters, today: string): Project[] {
  const q = filters.q.trim().toLowerCase();
  const matches = projects.filter((p) => {
    if (filters.status === 'overdue') {
      if (p.dueDate === null || p.dueDate >= today) return false;
    } else if (filters.status !== 'all' && p.status !== filters.status) {
      return false;
    }
    return q === '' || p.name.toLowerCase().includes(q) || p.owner.toLowerCase().includes(q);
  });
  return matches.toSorted(filters.sort === 'name' ? byName : byDueDate);
}
```
:::

:::mutant{name=case-sensitive hint="搜索区分了大小写：需要一个英文的负责人或名称，用不同的大小写搜索"}
```ts file=query.ts
import { STATUSES, type Project } from './model';
import { summarize } from './summary';

/** 状态筛选：'all' 是全部，'overdue' 是已过期的项目 */
export const STATUS_FILTERS = ['all', ...STATUSES, 'overdue'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export const SORTS = ['due', 'name'] as const;
export type Sort = (typeof SORTS)[number];

export type Filters = Readonly<{ status: StatusFilter; q: string; sort: Sort }>;

export const DEFAULT_FILTERS: Filters = { status: 'all', q: '', sort: 'due' };

/** 从地址的查询参数中读出筛选条件：缺少的参数和不认识的值都用默认值 */
export function parseFilters(params: URLSearchParams): Filters {
  const status = params.get('status');
  const sort = params.get('sort');
  return {
    status: STATUS_FILTERS.find((s) => s === status) ?? DEFAULT_FILTERS.status,
    q: params.get('q') ?? DEFAULT_FILTERS.q,
    sort: SORTS.find((s) => s === sort) ?? DEFAULT_FILTERS.sort,
  };
}

/** 生成查询参数：和默认值相同的条件不写进地址 */
export function toSearchParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status !== DEFAULT_FILTERS.status) params.set('status', filters.status);
  if (filters.q !== DEFAULT_FILTERS.q) params.set('q', filters.q);
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set('sort', filters.sort);
  return params;
}

const byName = (a: Project, b: Project) => a.name.localeCompare(b.name, 'zh-CN');

function byDueDate(a: Project, b: Project): number {
  if (a.dueDate === b.dueDate) return byName(a, b);
  // 没有截止日期的排在最后
  if (a.dueDate === null) return 1;
  if (b.dueDate === null) return -1;
  return a.dueDate < b.dueDate ? -1 : 1;
}

/** 列表页上显示的项目：按 filters 筛选、排序 */
export function listProjects(projects: readonly Project[], filters: Filters, today: string): Project[] {
  const q = filters.q.trim().toLowerCase();
  const matches = projects.filter((p) => {
    if (filters.status === 'overdue') {
      if (!summarize(p, today).overdue) return false;
    } else if (filters.status !== 'all' && p.status !== filters.status) {
      return false;
    }
    return q === '' || p.name.includes(filters.q.trim()) || p.owner.includes(filters.q.trim());
  });
  return matches.toSorted(filters.sort === 'name' ? byName : byDueDate);
}
```
:::

:::mutant{name=no-tie-break hint="截止日期相同时没有按名称排序，结果取决于输入的顺序：需要两个截止日期相同、输入顺序和拼音顺序相反的项目"}
```ts file=query.ts
import { STATUSES, type Project } from './model';
import { summarize } from './summary';

/** 状态筛选：'all' 是全部，'overdue' 是已过期的项目 */
export const STATUS_FILTERS = ['all', ...STATUSES, 'overdue'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export const SORTS = ['due', 'name'] as const;
export type Sort = (typeof SORTS)[number];

export type Filters = Readonly<{ status: StatusFilter; q: string; sort: Sort }>;

export const DEFAULT_FILTERS: Filters = { status: 'all', q: '', sort: 'due' };

/** 从地址的查询参数中读出筛选条件：缺少的参数和不认识的值都用默认值 */
export function parseFilters(params: URLSearchParams): Filters {
  const status = params.get('status');
  const sort = params.get('sort');
  return {
    status: STATUS_FILTERS.find((s) => s === status) ?? DEFAULT_FILTERS.status,
    q: params.get('q') ?? DEFAULT_FILTERS.q,
    sort: SORTS.find((s) => s === sort) ?? DEFAULT_FILTERS.sort,
  };
}

/** 生成查询参数：和默认值相同的条件不写进地址 */
export function toSearchParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status !== DEFAULT_FILTERS.status) params.set('status', filters.status);
  if (filters.q !== DEFAULT_FILTERS.q) params.set('q', filters.q);
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set('sort', filters.sort);
  return params;
}

const byName = (a: Project, b: Project) => a.name.localeCompare(b.name, 'zh-CN');

function byDueDate(a: Project, b: Project): number {
  if (a.dueDate === b.dueDate) return 0;
  // 没有截止日期的排在最后
  if (a.dueDate === null) return 1;
  if (b.dueDate === null) return -1;
  return a.dueDate < b.dueDate ? -1 : 1;
}

/** 列表页上显示的项目：按 filters 筛选、排序 */
export function listProjects(projects: readonly Project[], filters: Filters, today: string): Project[] {
  const q = filters.q.trim().toLowerCase();
  const matches = projects.filter((p) => {
    if (filters.status === 'overdue') {
      if (!summarize(p, today).overdue) return false;
    } else if (filters.status !== 'all' && p.status !== filters.status) {
      return false;
    }
    return q === '' || p.name.toLowerCase().includes(q) || p.owner.toLowerCase().includes(q);
  });
  return matches.toSorted(filters.sort === 'name' ? byName : byDueDate);
}
```
:::

:::mutant{name=unchecked-status hint="地址中大小写不同的状态（status=Active）也被接受了：需要测试不认识的值"}
```ts file=query.ts
import { STATUSES, type Project } from './model';
import { summarize } from './summary';

/** 状态筛选：'all' 是全部，'overdue' 是已过期的项目 */
export const STATUS_FILTERS = ['all', ...STATUSES, 'overdue'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export const SORTS = ['due', 'name'] as const;
export type Sort = (typeof SORTS)[number];

export type Filters = Readonly<{ status: StatusFilter; q: string; sort: Sort }>;

export const DEFAULT_FILTERS: Filters = { status: 'all', q: '', sort: 'due' };

/** 从地址的查询参数中读出筛选条件：缺少的参数和不认识的值都用默认值 */
export function parseFilters(params: URLSearchParams): Filters {
  const status = params.get('status');
  const sort = params.get('sort');
  return {
    status: STATUS_FILTERS.find((s) => s === status?.toLowerCase()) ?? DEFAULT_FILTERS.status,
    q: params.get('q') ?? DEFAULT_FILTERS.q,
    sort: SORTS.find((s) => s === sort) ?? DEFAULT_FILTERS.sort,
  };
}

/** 生成查询参数：和默认值相同的条件不写进地址 */
export function toSearchParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status !== DEFAULT_FILTERS.status) params.set('status', filters.status);
  if (filters.q !== DEFAULT_FILTERS.q) params.set('q', filters.q);
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set('sort', filters.sort);
  return params;
}

const byName = (a: Project, b: Project) => a.name.localeCompare(b.name, 'zh-CN');

function byDueDate(a: Project, b: Project): number {
  if (a.dueDate === b.dueDate) return byName(a, b);
  // 没有截止日期的排在最后
  if (a.dueDate === null) return 1;
  if (b.dueDate === null) return -1;
  return a.dueDate < b.dueDate ? -1 : 1;
}

/** 列表页上显示的项目：按 filters 筛选、排序 */
export function listProjects(projects: readonly Project[], filters: Filters, today: string): Project[] {
  const q = filters.q.trim().toLowerCase();
  const matches = projects.filter((p) => {
    if (filters.status === 'overdue') {
      if (!summarize(p, today).overdue) return false;
    } else if (filters.status !== 'all' && p.status !== filters.status) {
      return false;
    }
    return q === '' || p.name.toLowerCase().includes(q) || p.owner.toLowerCase().includes(q);
  });
  return matches.toSorted(filters.sort === 'name' ? byName : byDueDate);
}
```
:::

:::mutant{name=writes-defaults hint="和默认值相同的状态也写进了地址（status=all）：需要检查 toSearchParams 生成的字符串，而不只是读回来的结果"}
```ts file=query.ts
import { STATUSES, type Project } from './model';
import { summarize } from './summary';

/** 状态筛选：'all' 是全部，'overdue' 是已过期的项目 */
export const STATUS_FILTERS = ['all', ...STATUSES, 'overdue'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export const SORTS = ['due', 'name'] as const;
export type Sort = (typeof SORTS)[number];

export type Filters = Readonly<{ status: StatusFilter; q: string; sort: Sort }>;

export const DEFAULT_FILTERS: Filters = { status: 'all', q: '', sort: 'due' };

/** 从地址的查询参数中读出筛选条件：缺少的参数和不认识的值都用默认值 */
export function parseFilters(params: URLSearchParams): Filters {
  const status = params.get('status');
  const sort = params.get('sort');
  return {
    status: STATUS_FILTERS.find((s) => s === status) ?? DEFAULT_FILTERS.status,
    q: params.get('q') ?? DEFAULT_FILTERS.q,
    sort: SORTS.find((s) => s === sort) ?? DEFAULT_FILTERS.sort,
  };
}

/** 生成查询参数：和默认值相同的条件不写进地址 */
export function toSearchParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  params.set('status', filters.status);
  if (filters.q !== DEFAULT_FILTERS.q) params.set('q', filters.q);
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set('sort', filters.sort);
  return params;
}

const byName = (a: Project, b: Project) => a.name.localeCompare(b.name, 'zh-CN');

function byDueDate(a: Project, b: Project): number {
  if (a.dueDate === b.dueDate) return byName(a, b);
  // 没有截止日期的排在最后
  if (a.dueDate === null) return 1;
  if (b.dueDate === null) return -1;
  return a.dueDate < b.dueDate ? -1 : 1;
}

/** 列表页上显示的项目：按 filters 筛选、排序 */
export function listProjects(projects: readonly Project[], filters: Filters, today: string): Project[] {
  const q = filters.q.trim().toLowerCase();
  const matches = projects.filter((p) => {
    if (filters.status === 'overdue') {
      if (!summarize(p, today).overdue) return false;
    } else if (filters.status !== 'all' && p.status !== filters.status) {
      return false;
    }
    return q === '' || p.name.toLowerCase().includes(q) || p.owner.toLowerCase().includes(q);
  });
  return matches.toSorted(filters.sort === 'name' ? byName : byDueDate);
}
```
:::

:::hint{level=1}
每个测试只准备和它有关的数据：起始代码中的 `project(id, name, { … })` 只需要写出关心的字段。按“边界”来想测试：没有截止日期、截止日期相同、只有空白的搜索词、英文名称的大小写、已经完成但截止日期已过、地址中不认识的值、和默认值相同的条件。
:::

:::hint{level=2}
排序的测试，把项目按“错误的顺序”放进输入：例如截止日期相同的两个项目，先放拼音靠后的那个；如果实现没有按名称排序，结果就会保留输入的顺序而失败。检查 `toSearchParams` 时比较 `.toString()`：`toSearchParams(DEFAULT_FILTERS).toString()` 应该是空字符串。
:::

:::explanation
每个变异体都对应一个“只要想到就很容易测，没想到就会漏掉”的边界。它们的共同点是：用“正常”的数据测试，正确的和错误的实现给出同样的结果。例如名称排序，如果测试数据中只有“官网改版”“数据迁移”，汉字编号的顺序碰巧和拼音的顺序一样（官 U+5B98 在数 U+6570 之前），错误的实现也能通过；换成“培训课程”“安全检查”，两种顺序就不同了。

排序的测试有一个技巧：输入的顺序要和期望的顺序**不同**。`toSorted` 是稳定的，比较结果相同的项保持原来的顺序；如果输入恰好已经是期望的顺序，一个不比较名称的实现也会给出正确的结果。

`toSearchParams` 的测试只检查“写进去再读出来还是一样”是不够的：`status=all` 读出来也是 `all`。要直接检查生成的字符串。

替代解把用例写成表格（`test.each`）：一组精心挑选的项目（输入的顺序故意打乱），配上不同的筛选条件和期望的结果。错误解 `happy-path` 只测了正常的情况，所有的测试都通过了，却一个变异体也没有发现。
:::

:::variant{kind=alt name=table-driven}
```ts file=query.test.ts
import { describe, expect, test } from 'vitest';
import type { Project } from './model';
import { DEFAULT_FILTERS, listProjects, parseFilters, toSearchParams, type Filters } from './query';

const TODAY = '2026-10-20';

/** 一组覆盖各种边界的项目；输入的顺序故意和期望的顺序不同 */
const ALL: Project[] = [
  { id: '1', name: '招聘计划', owner: '小林', status: 'planning', dueDate: null, tasks: [] },
  { id: '2', name: '官网改版', owner: '小林', status: 'active', dueDate: '2026-11-15', tasks: [] },
  { id: '3', name: '季度报告', owner: 'Lin', status: 'done', dueDate: '2026-09-30', tasks: [] },
  { id: '4', name: '安全检查', owner: '老周', status: 'planning', dueDate: '2026-11-15', tasks: [] },
  { id: '5', name: '数据迁移', owner: '阿明', status: 'active', dueDate: '2026-10-12', tasks: [] },
  { id: '6', name: '培训课程', owner: '阿明', status: 'active', dueDate: null, tasks: [] },
];

const run = (changes: Partial<Filters>) => listProjects(ALL, { ...DEFAULT_FILTERS, ...changes }, TODAY).map((p) => p.name);

describe('listProjects', () => {
  test.each([
    [{}, ['季度报告', '数据迁移', '安全检查', '官网改版', '培训课程', '招聘计划']],
    [{ sort: 'name' }, ['安全检查', '官网改版', '季度报告', '培训课程', '数据迁移', '招聘计划']],
    [{ status: 'overdue' }, ['数据迁移']],
    [{ status: 'planning' }, ['安全检查', '招聘计划']],
    [{ q: '  阿明 ' }, ['数据迁移', '培训课程']],
    [{ q: 'LIN' }, ['季度报告']],
    [{ q: '   ' }, ['季度报告', '数据迁移', '安全检查', '官网改版', '培训课程', '招聘计划']],
  ] as const)('%o', (changes: Partial<Filters>, expected: readonly string[]) => {
    expect(run(changes)).toEqual(expected);
  });
});

describe('地址', () => {
  test.each([
    ['', DEFAULT_FILTERS],
    ['status=overdue&q=+x+&sort=name', { status: 'overdue', q: ' x ', sort: 'name' }],
    ['status=Active&sort=Name', DEFAULT_FILTERS],
    ['status=&sort=', DEFAULT_FILTERS],
  ] as const)('parseFilters(%s)', (search: string, expected: Filters) => {
    expect(parseFilters(new URLSearchParams(search))).toEqual(expected);
  });

  test.each([
    [DEFAULT_FILTERS, ''],
    [{ status: 'all', q: '', sort: 'name' }, 'sort=name'],
    [{ status: 'done', q: 'a b', sort: 'due' }, 'status=done&q=a+b'],
  ] as const)('toSearchParams → %s', (filters: Filters, expected: string) => {
    expect(toSearchParams(filters).toString()).toBe(expected);
  });
});
```
:::

:::variant{kind=wrong name=happy-path fails=mutants misses=null-first,no-trim,code-units,overdue-done,case-sensitive,no-tie-break,unchecked-status,writes-defaults reason="只测了正常的情况：读出参数、按状态筛选、按名称搜索、按截止日期排序，边界一个也没有测"}
```ts file=query.test.ts
import { describe, expect, test } from 'vitest';
import type { Project } from './model';
import { DEFAULT_FILTERS, listProjects, parseFilters, type Filters } from './query';

const TODAY = '2026-10-20';

function project(id: string, name: string, fields: Partial<Project> = {}): Project {
  return { id, name, owner: '小林', status: 'active', dueDate: null, tasks: [], ...fields };
}

const names = (projects: readonly Project[]) => projects.map((p) => p.name);
const filters = (changes: Partial<Filters>): Filters => ({ ...DEFAULT_FILTERS, ...changes });

describe('只测了正常的情况', () => {
  test('读出参数', () => {
    expect(parseFilters(new URLSearchParams('status=active&q=a&sort=name'))).toEqual({ status: 'active', q: 'a', sort: 'name' });
  });

  test('按状态筛选、按名称搜索', () => {
    const all = [project('a', '官网改版'), project('b', '数据迁移', { status: 'done' })];
    expect(names(listProjects(all, filters({ status: 'done' }), TODAY))).toEqual(['数据迁移']);
    expect(names(listProjects(all, filters({ q: '官网' }), TODAY))).toEqual(['官网改版']);
  });

  test('按截止日期排序', () => {
    const all = [project('a', '官网改版', { dueDate: '2026-11-15' }), project('b', '数据迁移', { dueDate: '2026-10-12' })];
    expect(names(listProjects(all, DEFAULT_FILTERS, TODAY))).toEqual(['数据迁移', '官网改版']);
  });
});
```
:::

:::variant{kind=wrong name=expects-code-units fails=tests reason="期望的名称顺序是汉字的编号顺序，不是拼音：测试本身写错了，在正确的实现上就失败"}
```ts file=query.test.ts
import { describe, expect, test } from 'vitest';
import type { Project } from './model';
import { DEFAULT_FILTERS, listProjects, parseFilters, toSearchParams, type Filters } from './query';

const TODAY = '2026-10-20';

/** 测试数据：只写和这个测试有关的字段 */
function project(id: string, name: string, fields: Partial<Project> = {}): Project {
  return { id, name, owner: '小林', status: 'active', dueDate: null, tasks: [], ...fields };
}

const names = (projects: readonly Project[]) => projects.map((p) => p.name);
const filters = (changes: Partial<Filters>): Filters => ({ ...DEFAULT_FILTERS, ...changes });

describe('parseFilters', () => {
  test('没有参数时是默认值', () => {
    expect(parseFilters(new URLSearchParams(''))).toEqual({ status: 'all', q: '', sort: 'due' });
  });
});

describe('listProjects', () => {
  test('按名称排序', () => {
    const all = [project('a', '数据迁移'), project('b', '安全检查'), project('c', '培训课程')];
    // 错误的期望：这是汉字编号的顺序，不是拼音的顺序
    expect(names(listProjects(all, filters({ sort: 'name' }), TODAY))).toEqual(['培训课程', '安全检查', '数据迁移']);
  });
});
```
:::

