---
kind: task
mode: ts
title: 列表的筛选条件
---
在 `query.ts` 中实现列表页的两个函数（`toSearchParams` 已经写好；`model.ts`、`summary.ts`、`data.ts` 只读，`summary.ts` 是 p2-01 的 `summarize`）：

1. `parseFilters(params)`：从查询参数中读出筛选条件。
   - `status`：`STATUS_FILTERS` 中的一个，否则是 `'all'`；
   - `q`：搜索词，**原样**读出（不去掉空白），没有时是 `''`；
   - `sort`：`SORTS` 中的一个，否则是 `'due'`；
2. `listProjects(projects, filters, today)`：返回列表页上显示的项目。
   - 状态：`'all'` 是全部；`'overdue'` 是过期的项目（用 `summarize(…).overdue` 判断）；其他值是这个状态的项目；
   - 搜索词：去掉首尾空白之后为空时不筛选；否则名称或负责人中包含它的项目，**不区分大小写**；
   - `sort: 'due'`：截止日期早的在前，没有截止日期的排在最后，截止日期相同时按名称；`sort: 'name'`：按名称；名称按中文拼音的顺序（`'zh-CN'`）；
   - 不修改传入的数组。

`main.ts` 用几个地址试一试这两个函数。

:::files{role=support}
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
  const percent = total === 0 ? 0 : Math.floor((done / total) * 100);
  const daysLeft = project.dueDate === null ? null : Math.round((utcDay(project.dueDate) - utcDay(today)) / DAY);
  const overdue = project.status !== 'done' && daysLeft !== null && daysLeft < 0;
  return { done, total, percent, overdue, daysLeft };
}
```
```ts file=data.ts readonly
import type { Project } from './model';

/** 这个里程碑还没有服务器（p2-04 再从服务器加载）：项目数据先写在这里 */
export const PROJECTS: readonly Project[] = [
  {
    id: 'p1',
    name: '官网改版',
    owner: '小林',
    status: 'active',
    dueDate: '2026-11-15',
    tasks: [
      { id: 't1', title: '整理需求', done: true },
      { id: 't2', title: '设计稿', done: false },
      { id: 't3', title: '写文案', done: false },
    ],
  },
  {
    id: 'p2',
    name: '数据迁移',
    owner: '阿明',
    status: 'active',
    dueDate: '2026-10-12',
    tasks: [
      { id: 't1', title: '备份旧库', done: true },
      { id: 't2', title: '迁移脚本', done: false },
    ],
  },
  { id: 'p3', name: '季度报告', owner: 'Lin', status: 'done', dueDate: '2026-09-30', tasks: [{ id: 't1', title: '汇总数据', done: true }] },
  { id: 'p4', name: '招聘计划', owner: '小林', status: 'planning', dueDate: null, tasks: [] },
  {
    id: 'p5',
    name: '安全检查',
    owner: '老周',
    status: 'planning',
    dueDate: '2026-11-15',
    tasks: [{ id: 't1', title: '列出依赖', done: false }],
  },
  {
    id: 'p6',
    name: '培训课程',
    owner: '阿明',
    status: 'active',
    dueDate: '2026-10-20',
    tasks: [
      { id: 't1', title: '准备讲义', done: true },
      { id: 't2', title: '预约会议室', done: true },
      { id: 't3', title: '发通知', done: false },
    ],
  },
];

/** 为了让页面和测试的结果确定，“今天”固定为这一天（真实的应用中用当天的日期） */
export const TODAY = '2026-10-20';
```
:::

:::files{role=starter}
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
  // TODO
  return DEFAULT_FILTERS;
}

/** 生成查询参数：和默认值相同的条件不写进地址（已经写好） */
export function toSearchParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status !== DEFAULT_FILTERS.status) params.set('status', filters.status);
  if (filters.q !== DEFAULT_FILTERS.q) params.set('q', filters.q);
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set('sort', filters.sort);
  return params;
}

/** 列表页上显示的项目：按 filters 筛选、排序 */
export function listProjects(projects: readonly Project[], filters: Filters, today: string): Project[] {
  // TODO
  return [...projects];
}
```
```ts file=main.ts
import { PROJECTS, TODAY } from './data';
import { listProjects, parseFilters } from './query';

for (const search of ['', 'status=overdue', 'q=%E9%98%BF%E6%98%8E&sort=name', 'status=Active&sort=date']) {
  const filters = parseFilters(new URLSearchParams(search));
  const names = listProjects(PROJECTS, filters, TODAY).map((p) => p.name);
  console.log(`?${search}`, filters, names.join(' '));
}
```
:::

:::files{role=solution}
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
    return q === '' || p.name.toLowerCase().includes(q) || p.owner.toLowerCase().includes(q);
  });
  return matches.toSorted(filters.sort === 'name' ? byName : byDueDate);
}
```
```ts file=main.ts
import { PROJECTS, TODAY } from './data';
import { listProjects, parseFilters } from './query';

for (const search of ['', 'status=overdue', 'q=%E9%98%BF%E6%98%8E&sort=name', 'status=Active&sort=date']) {
  const filters = parseFilters(new URLSearchParams(search));
  const names = listProjects(PROJECTS, filters, TODAY).map((p) => p.name);
  console.log(`?${search}`, filters, names.join(' '));
}
```
:::

:::files{role=tests}
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

:::hint{level=1}
`parseFilters`：`const value = params.get('sort')`，再用 `SORTS.find((s) => s === value) ?? 'due'`，`find` 返回的正是 `Sort | undefined`。`listProjects`：先 `filter` 再 `toSorted`，搜索词先 `trim()` 再 `toLowerCase()`，名称和负责人也转成小写再 `includes`。
:::

:::hint{level=2}
比较名称用 `a.name.localeCompare(b.name, 'zh-CN')`。比较截止日期时先处理 `null`：两个相同（包括都是 `null`）时按名称；只有 `a` 是 `null` 时返回 `1`（`a` 排在后面），只有 `b` 是 `null` 时返回 `-1`；都不是 `null` 时，`YYYY-MM-DD` 字符串可以直接用 `<` 比较。
:::

:::explanation
`parseFilters` 用 `find` 检查地址中的值：它返回数组中**和输入相等的那个元素**，类型是元素的类型，所以不需要断言。`as StatusFilter` 能通过类型检查，却什么也没有检查，地址中的 `status=Active` 就会原样进入程序，`listProjects` 找不到这个状态，列表变成空的。

搜索词在 `parseFilters` 中原样保留，在 `listProjects` 中才去掉空白：输入框的值来自地址，如果读出来时就去掉空白，用户输入的空格会被“吃掉”，没法输入“小 林”这样中间有空格的词。

截止日期的比较中，`null` 要单独处理。把它换成空字符串，它就排在最前面；换成一个比所有日期都大的字符串（替代解用了 `'9999-99-99'`）也可以，但要确定它真的比所有可能的值都大。截止日期相同时用名称作为第二个条件，结果就不依赖于数据原来的顺序。

参数的类型是 `readonly Project[]`，没有 `sort` 方法：类型保证了不会修改传入的数组。`toSorted` 返回新的数组。

替代解写了一个泛型的类型守卫 `isOneOf`，排序用同一个 `Intl.Collator` 的 `compare`，比较截止日期时用 `||` 连接两个条件：第一个比较结果是 0 时才看第二个。
:::

:::variant{kind=alt name=guard-and-collator}
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

/** 类型守卫：value 是 values 中的一个 */
function isOneOf<T extends string>(values: readonly T[], value: string | null): value is T {
  return values.some((v) => v === value);
}

/** 从地址的查询参数中读出筛选条件：缺少的参数和不认识的值都用默认值 */
export function parseFilters(params: URLSearchParams): Filters {
  const status = params.get('status');
  const sort = params.get('sort');
  return {
    status: isOneOf(STATUS_FILTERS, status) ? status : 'all',
    q: params.get('q') ?? '',
    sort: isOneOf(SORTS, sort) ? sort : 'due',
  };
}

/** 生成查询参数：和默认值相同的条件不写进地址（已经写好） */
export function toSearchParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status !== DEFAULT_FILTERS.status) params.set('status', filters.status);
  if (filters.q !== DEFAULT_FILTERS.q) params.set('q', filters.q);
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set('sort', filters.sort);
  return params;
}

/** 同一个 Collator 可以反复使用，比每次调用 localeCompare 更快 */
const collator = new Intl.Collator('zh-CN');

/** 没有截止日期的排在最后：比较时把 null 换成一个比所有日期都大的字符串 */
const dueKey = (p: Project) => p.dueDate ?? '9999-99-99';

/** 按字符串本身的顺序比较（YYYY-MM-DD 的顺序就是日期的先后） */
const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** 列表页上显示的项目：按 filters 筛选、排序 */
export function listProjects(projects: readonly Project[], filters: Filters, today: string): Project[] {
  const q = filters.q.trim().toLowerCase();
  const statusOk = (p: Project): boolean => {
    switch (filters.status) {
      case 'all':
        return true;
      case 'overdue':
        return summarize(p, today).overdue;
      default:
        return p.status === filters.status;
    }
  };
  const textOk = (p: Project) => [p.name, p.owner].some((text) => text.toLowerCase().includes(q));
  const result = projects.filter((p) => statusOk(p) && textOk(p));
  return result.toSorted((a, b) => {
    const byName = collator.compare(a.name, b.name);
    if (filters.sort === 'name') return byName;
    return compareText(dueKey(a), dueKey(b)) || byName;
  });
}
```
:::

:::variant{kind=wrong name=no-trim fails=tests reason="搜索词没有去掉首尾空白：搜索“ 阿明 ”什么也找不到"}
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

:::variant{kind=wrong name=null-first fails=tests reason="把没有截止日期当作空字符串比较：它们排到了最前面"}
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

:::variant{kind=wrong name=code-units fails=tests reason="用 < 比较中文名称：按汉字的编号排序，不是拼音"}
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

:::variant{kind=wrong name=overdue-done fails=tests reason="只比较了截止日期：已完成的项目也被当作过期"}
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

:::variant{kind=wrong name=cast fails=rules reason="用类型断言代替检查：地址中不认识的值原样进入程序"}
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
  return {
    status: (params.get('status') ?? 'all') as StatusFilter,
    q: params.get('q') ?? '',
    sort: (params.get('sort') ?? 'due') as Sort,
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

:::variant{kind=wrong name=sort-in-place fails=types reason="readonly 数组没有 sort 方法：不能在原数组上排序"}
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
    return q === '' || p.name.toLowerCase().includes(q) || p.owner.toLowerCase().includes(q);
  });
  if (filters.status === 'all' && q === '') return projects.sort(filters.sort === 'name' ? byName : byDueDate);
  return matches.toSorted(filters.sort === 'name' ? byName : byDueDate);
}
```
:::

