---
kind: challenge
title: 项目列表与详情页
---
在 `routes.tsx` 中完成项目面板的路由，导出路由配置 `routes`。`query.ts` 是上一个练习的答案，`data.ts` 是项目数据和固定的“今天” `TODAY`；这些文件和 `main.tsx` 都是只读的。布局 `Layout` 已经写好，所有页面都显示在它的 `<main>` 中。

1. `/`：用 loader 转到 `/projects`，并且**替换**当前的历史记录；
2. `/projects`：标题 `<h1>项目</h1>`。
   - 三个带标签的控件：“状态”下拉框（选项的 `value` 是 `STATUS_FILTERS` 中的值）、“搜索”输入框、“排序”下拉框（`value` 是 `SORTS` 中的值）。它们的值都来自地址（用 `parseFilters`）；
   - 改变状态、排序：更新地址，新增一条历史记录；输入搜索词：更新地址，**替换**当前的历史记录（`{ replace: true, flushSync: true }`）。地址用 `toSearchParams` 生成，和默认值相同的条件不出现在地址中，其他条件保留；
   - 一个 `role="status"` 的段落：“找到 3 个项目”，没有项目时是“没有符合条件的项目”；
   - 有项目时显示列表 `<ul aria-label="项目列表">`（用 `listProjects`），每一项：项目名称是指向 `/projects/编号` 的链接，后面是负责人、状态的名称、进度（如 `1/3`）、截止日期（没有时写“无截止日期”），过期的项目再加上“已过期”；
3. `/projects/:projectId`：标题是项目名称，下面依次是这几段文字：
   - “负责人：阿明”“状态：进行中”“进度：1/2（50%）”；
   - 截止日期：“截止日期：2026-10-12（已过期 8 天）”，还没到期是“（还有 26 天）”，当天是“（今天到期）”；已完成的项目只写“截止日期：2026-09-30”；没有截止日期时写“没有截止日期”；
   - 任务列表 `<ul aria-label="任务">`，每一项是任务的名称，完成的任务后面加上“（已完成）”；没有任务时，用一段“还没有任务”代替列表；
   - “返回项目列表”链接：从列表进入时，回到当时的列表（包括它的查询参数）；其他情况回到 `/projects`。用链接的 `state` 传递，读取时要检查它的格式；
   - 编号不存在时：标题“没有这个项目”，也有“返回项目列表”链接；
4. 其他地址：标题“页面不存在”；
5. 站内链接都不能让整个页面重新加载。

:::files{role=starter}
```tsx file=routes.tsx
import { Link, Outlet, type RouteObject } from 'react-router';
import { PROJECTS, TODAY } from './data';
import { STATUS_NAMES } from './model';
import { listProjects, parseFilters, SORTS, STATUS_FILTERS, toSearchParams, type Sort, type StatusFilter } from './query';
import { summarize } from './summary';

const STATUS_LABELS: Record<StatusFilter, string> = { all: '全部', ...STATUS_NAMES, overdue: '已过期' };
const SORT_LABELS: Record<Sort, string> = { due: '截止日期', name: '名称' };

function Layout() {
  return (
    <>
      <header>
        <Link to="/projects">项目面板</Link>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}

// TODO：筛选条件从地址中读取，修改时更新地址；每一项链接到详情页
function ProjectList() {
  return (
    <>
      <h1>项目</h1>
      <ul aria-label="项目列表">
        {PROJECTS.map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>
    </>
  );
}

// TODO：/ 转到 /projects；项目详情页；“页面不存在”
export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    children: [{ path: 'projects', Component: ProjectList }],
  },
];
```
:::

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
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { createHashRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from './routes';

// 预览运行在沙箱中，只能使用 # 之后的地址；部署到服务器上时用 createBrowserRouter（p2-06）
const router = createHashRouter(routes);

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<RouterProvider router={router} />);
```
:::

:::files{role=solution}
```tsx file=routes.tsx
import { Link, Outlet, replace, useLocation, useParams, useSearchParams, type RouteObject } from 'react-router';
import { PROJECTS, TODAY } from './data';
import { STATUS_NAMES, type Project } from './model';
import { listProjects, parseFilters, SORTS, STATUS_FILTERS, toSearchParams, type Filters, type Sort, type StatusFilter } from './query';
import { summarize, type Summary } from './summary';

const STATUS_LABELS: Record<StatusFilter, string> = { all: '全部', ...STATUS_NAMES, overdue: '已过期' };
const SORT_LABELS: Record<Sort, string> = { due: '截止日期', name: '名称' };

/** 进入详情页时随导航保存的数据：列表页当时的查询字符串 */
type FromList = { listSearch: string };

/** location.state 的类型是 any：它可能来自旧版本的页面，也可能根本没有，用之前先检查 */
function listSearchOf(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'listSearch' in state && typeof state.listSearch === 'string') {
    return state.listSearch;
  }
  return '';
}

function Layout() {
  return (
    <>
      <header>
        <Link to="/projects">项目面板</Link>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}

function ProjectItem({ project, from }: { project: Project; from: FromList }) {
  const s = summarize(project, TODAY);
  return (
    <li>
      <Link to={`/projects/${project.id}`} state={from}>
        {project.name}
      </Link>{' '}
      {project.owner} · {STATUS_NAMES[project.status]} · {s.done}/{s.total} · {project.dueDate ?? '无截止日期'}
      {s.overdue && <strong> 已过期</strong>}
    </li>
  );
}

function ProjectList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { search } = useLocation();
  const filters = parseFilters(searchParams);
  const projects = listProjects(PROJECTS, filters, TODAY);

  /** 地址只由 toSearchParams 生成：和默认值相同的条件不出现在地址中 */
  function update(changes: Partial<Filters>, options?: { replace: boolean; flushSync: boolean }) {
    setSearchParams(toSearchParams({ ...filters, ...changes }), options);
  }

  return (
    <>
      <h1>项目</h1>
      <label>
        状态{' '}
        <select
          value={filters.status}
          onChange={(e) => {
            const value = e.currentTarget.value;
            const status = STATUS_FILTERS.find((s) => s === value);
            if (status !== undefined) update({ status });
          }}
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>{' '}
      <label>
        搜索 <input type="search" value={filters.q} onChange={(e) => update({ q: e.currentTarget.value }, { replace: true, flushSync: true })} />
      </label>{' '}
      <label>
        排序{' '}
        <select
          value={filters.sort}
          onChange={(e) => {
            const value = e.currentTarget.value;
            const sort = SORTS.find((s) => s === value);
            if (sort !== undefined) update({ sort });
          }}
        >
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {SORT_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <p role="status">{projects.length === 0 ? '没有符合条件的项目' : `找到 ${projects.length} 个项目`}</p>
      {projects.length > 0 && (
        <ul aria-label="项目列表">
          {projects.map((p) => (
            <ProjectItem key={p.id} project={p} from={{ listSearch: search }} />
          ))}
        </ul>
      )}
    </>
  );
}

function dueText(project: Project, s: Summary): string {
  const { dueDate } = project;
  if (dueDate === null || s.daysLeft === null) return '没有截止日期';
  if (project.status === 'done') return `截止日期：${dueDate}`;
  if (s.daysLeft > 0) return `截止日期：${dueDate}（还有 ${s.daysLeft} 天）`;
  if (s.daysLeft === 0) return `截止日期：${dueDate}（今天到期）`;
  return `截止日期：${dueDate}（已过期 ${-s.daysLeft} 天）`;
}

function ProjectDetail() {
  const { projectId } = useParams();
  const location = useLocation();
  const back = { pathname: '/projects', search: listSearchOf(location.state) };
  const project = PROJECTS.find((p) => p.id === projectId);

  if (project === undefined) {
    return (
      <>
        <h1>没有这个项目</h1>
        <Link to={back}>返回项目列表</Link>
      </>
    );
  }

  const s = summarize(project, TODAY);
  return (
    <>
      <h1>{project.name}</h1>
      <p>负责人：{project.owner}</p>
      <p>状态：{STATUS_NAMES[project.status]}</p>
      <p>
        进度：{s.done}/{s.total}（{s.percent}%）
      </p>
      <p>{dueText(project, s)}</p>
      {project.tasks.length === 0 ? (
        <p>还没有任务</p>
      ) : (
        <ul aria-label="任务">
          {project.tasks.map((t) => (
            <li key={t.id}>
              {t.title}
              {t.done && '（已完成）'}
            </li>
          ))}
        </ul>
      )}
      <Link to={back}>返回项目列表</Link>
    </>
  );
}

function NotFound() {
  return <h1>页面不存在</h1>;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    children: [
      // replace 而不是 redirect：否则“后退”回到 /，又被转回 /projects，用户就退不出去了
      { index: true, loader: () => replace('/projects') },
      { path: 'projects', Component: ProjectList },
      { path: 'projects/:projectId', Component: ProjectDetail },
      { path: '*', Component: NotFound },
    ],
  },
];
```
:::

:::files{role=tests}
```tsx file=routes.test.tsx
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from './routes';

const clicks: boolean[] = [];

/** 在所有监听器之后记录链接的点击是否被路由处理，并阻止真实的跳转（沙箱中整页跳转会中断测试） */
function guard(event: MouseEvent): void {
  if (event.target instanceof Element && event.target.closest('a') !== null) {
    clicks.push(event.defaultPrevented);
    event.preventDefault();
  }
}

beforeEach(() => {
  clicks.length = 0;
  window.addEventListener('click', guard);
});

afterEach(() => {
  window.removeEventListener('click', guard);
});

type Entry = string | { pathname: string; search?: string; state?: unknown };

function start(...entries: Entry[]) {
  const router = createMemoryRouter(routes, { initialEntries: entries, initialIndex: entries.length - 1 });
  const { unmount } = render(<RouterProvider router={router} />);
  return { router, unmount, user: userEvent.setup() };
}

const heading = () => screen.getByRole('heading', { level: 1 });
const listNames = () => {
  const list = screen.queryByRole('list', { name: '项目列表' });
  if (list === null) return [];
  return within(list)
    .getAllByRole('listitem')
    .map((li) => within(li).getByRole('link').textContent);
};
const item = (name: string) => {
  const li = within(screen.getByRole('list', { name: '项目列表' }))
    .getAllByRole('listitem')
    .find((el) => within(el).queryByRole('link', { name }) !== null);
  if (li === undefined) throw new Error(`列表中没有“${name}”`);
  return li;
};
const statusSelect = () => screen.getByLabelText('状态');
const sortSelect = () => screen.getByLabelText('排序');
const searchBox = () => screen.getByLabelText('搜索');
const param = (router: ReturnType<typeof start>['router'], name: string) => new URLSearchParams(router.state.location.search).get(name);

const BY_DUE = ['季度报告', '数据迁移', '培训课程', '安全检查', '官网改版', '招聘计划'];

describe('地址', () => {
  test('/ 转到 /projects，并且替换历史记录：“后退”不会又回到 /', async () => {
    const { router } = start('/elsewhere', '/');
    expect(await screen.findByRole('heading', { level: 1, name: '项目' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/projects');
    await act(() => router.navigate(-1));
    expect(router.state.location.pathname, '“后退”应该回到进入 / 之前的页面').toBe('/elsewhere');
  });

  test('其他地址：“页面不存在”，显示在布局的 main 中', () => {
    for (const path of ['/nope', '/projects/p1/edit']) {
      const { unmount } = start(path);
      expect(heading(), path).toHaveTextContent('页面不存在');
      expect(screen.getByRole('main')).toContainElement(heading());
      unmount();
    }
  });
});

describe('列表页', () => {
  test('默认显示全部项目，按截止日期排序', () => {
    start('/projects');
    expect(heading()).toHaveTextContent('项目');
    expect(screen.getByRole('main')).toContainElement(heading());
    expect(listNames()).toEqual(BY_DUE);
    expect(screen.getByRole('status')).toHaveTextContent('找到 6 个项目');
    expect(statusSelect()).toHaveValue('all');
    expect(sortSelect()).toHaveValue('due');
    expect(searchBox()).toHaveValue('');
  });

  test('每一项：名称链接到详情页，后面是负责人、状态、进度、截止日期，过期的标出“已过期”', () => {
    start('/projects');
    const migrate = item('数据迁移');
    expect(within(migrate).getByRole('link')).toHaveAttribute('href', '/projects/p2');
    for (const text of ['阿明', '进行中', '1/2', '2026-10-12', '已过期']) expect(migrate).toHaveTextContent(text);
    const hiring = item('招聘计划');
    for (const text of ['小林', '计划中', '0/0', '无截止日期']) expect(hiring).toHaveTextContent(text);
    expect(hiring).not.toHaveTextContent('已过期');
    const report = item('季度报告');
    for (const text of ['Lin', '已完成', '1/1', '2026-09-30']) expect(report).toHaveTextContent(text);
    expect(report, '已完成的项目不算过期').not.toHaveTextContent('已过期');
    expect(item('培训课程'), '今天到期不算过期').not.toHaveTextContent('已过期');
  });

  test('筛选条件来自地址', () => {
    start('/projects?status=active&sort=name');
    expect(statusSelect()).toHaveValue('active');
    expect(sortSelect()).toHaveValue('name');
    expect(listNames()).toEqual(['官网改版', '培训课程', '数据迁移']);
    expect(screen.getByRole('status')).toHaveTextContent('找到 3 个项目');
  });

  test('搜索词来自地址；地址中不认识的值按默认值处理', () => {
    start('/projects?q=%E5%B0%8F%E6%9E%97&status=late&sort=date');
    expect(searchBox()).toHaveValue('小林');
    expect(statusSelect()).toHaveValue('all');
    expect(sortSelect()).toHaveValue('due');
    expect(listNames()).toEqual(['官网改版', '招聘计划']);
  });

  test('没有符合条件的项目', () => {
    start('/projects?q=zzz');
    expect(screen.getByRole('status')).toHaveTextContent('没有符合条件的项目');
    expect(screen.queryByRole('list', { name: '项目列表' })).toBeNull();
  });
});

describe('修改筛选条件', () => {
  test('改变状态：更新地址并新增历史记录，“后退”时列表和下拉框都跟着变', async () => {
    const { router, user } = start('/projects');
    await user.selectOptions(statusSelect(), 'overdue');
    expect(router.state.location.search).toBe('?status=overdue');
    expect(listNames()).toEqual(['数据迁移']);
    await user.selectOptions(statusSelect(), 'planning');
    expect(listNames()).toEqual(['安全检查', '招聘计划']);
    await act(() => router.navigate(-1));
    expect(statusSelect()).toHaveValue('overdue');
    expect(listNames()).toEqual(['数据迁移']);
    await act(() => router.navigate(-1));
    expect(router.state.location.search).toBe('');
    expect(statusSelect()).toHaveValue('all');
    expect(listNames()).toEqual(BY_DUE);
  });

  test('选回默认值时，参数从地址中删除；其他参数保留', async () => {
    const { router, user } = start('/projects?q=%E9%98%BF&status=active');
    await user.selectOptions(sortSelect(), 'name');
    expect(param(router, 'q')).toBe('阿');
    expect(param(router, 'status')).toBe('active');
    expect(param(router, 'sort')).toBe('name');
    expect(listNames()).toEqual(['培训课程', '数据迁移']);
    await user.selectOptions(statusSelect(), 'all');
    await user.selectOptions(sortSelect(), 'due');
    expect(router.state.location.search).toBe('?q=%E9%98%BF');
  });

  test('输入搜索词：更新地址，替换当前的历史记录', async () => {
    const { router, user } = start('/elsewhere', '/projects?status=active');
    await user.type(searchBox(), 'lin');
    expect(searchBox()).toHaveValue('lin');
    expect(param(router, 'q')).toBe('lin');
    expect(param(router, 'status')).toBe('active');
    expect(screen.getByRole('status')).toHaveTextContent('没有符合条件的项目');
    await user.clear(searchBox());
    expect(router.state.location.search).toBe('?status=active');
    expect(listNames()).toEqual(['数据迁移', '培训课程', '官网改版']);
    await act(() => router.navigate(-1));
    expect(router.state.location.pathname, '输入时应该替换历史记录，“后退”一次就离开列表页').toBe('/elsewhere');
  });
});

describe('详情页', () => {
  test('从列表进入详情，再返回：保留列表的筛选条件，页面不重新加载', async () => {
    const { router, user } = start('/projects?status=active&sort=name');
    await user.click(screen.getByRole('link', { name: '数据迁移' }));
    expect(await screen.findByRole('heading', { level: 1, name: '数据迁移' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/projects/p2');
    const back = screen.getByRole('link', { name: '返回项目列表' });
    expect(back).toHaveAttribute('href', '/projects?status=active&sort=name');
    await user.click(back);
    expect(await screen.findByRole('heading', { level: 1, name: '项目' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?status=active&sort=name');
    expect(listNames()).toEqual(['官网改版', '培训课程', '数据迁移']);
    expect(clicks, '站内链接应该由路由处理，不能让整个页面重新加载').toEqual([true, true]);
  });

  test('显示负责人、状态、进度、截止日期和任务', () => {
    start('/projects/p2');
    expect(heading()).toHaveTextContent('数据迁移');
    expect(screen.getByRole('main')).toContainElement(heading());
    for (const text of ['负责人：阿明', '状态：进行中', '进度：1/2（50%）', '截止日期：2026-10-12（已过期 8 天）']) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
    const tasks = within(screen.getByRole('list', { name: '任务' })).getAllByRole('listitem');
    expect(tasks.map((li) => li.textContent)).toEqual(['备份旧库（已完成）', '迁移脚本']);
  });

  test('截止日期的几种情况', () => {
    const cases: [string, string][] = [
      ['/projects/p1', '截止日期：2026-11-15（还有 26 天）'],
      ['/projects/p6', '截止日期：2026-10-20（今天到期）'],
      ['/projects/p3', '截止日期：2026-09-30'],
      ['/projects/p4', '没有截止日期'],
    ];
    for (const [path, text] of cases) {
      const { unmount } = start(path);
      expect(screen.getByText(text), path).toBeInTheDocument();
      unmount();
    }
  });

  test('没有任务时显示“还没有任务”', () => {
    start('/projects/p4');
    expect(screen.getByText('进度：0/0（0%）')).toBeInTheDocument();
    expect(screen.getByText('还没有任务')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: '任务' })).toBeNull();
  });

  test('直接打开详情页（不是从列表进入）：返回 /projects', () => {
    start('/projects/p1');
    expect(screen.getByRole('link', { name: '返回项目列表' })).toHaveAttribute('href', '/projects');
  });

  test('导航中保存的数据格式不对时，也返回 /projects，页面不出错', () => {
    for (const state of ['?status=done', { listSearch: 42 }, { search: '?q=a' }, null, 7]) {
      const { unmount } = start({ pathname: '/projects/p1', state });
      expect(heading(), JSON.stringify(state)).toHaveTextContent('官网改版');
      expect(screen.getByRole('link', { name: '返回项目列表' })).toHaveAttribute('href', '/projects');
      unmount();
    }
  });

  test('没有这个项目', () => {
    start({ pathname: '/projects/p9', state: { listSearch: '?q=a' } });
    expect(heading()).toHaveTextContent('没有这个项目');
    expect(screen.getByRole('main')).toContainElement(heading());
    expect(screen.getByRole('link', { name: '返回项目列表' })).toHaveAttribute('href', '/projects?q=a');
  });
});
```
:::

:::hint{level=1}
路由配置：`Layout` 的 `children` 中放 `{ index: true, loader: () => replace('/projects') }`、`{ path: 'projects', … }`、`{ path: 'projects/:projectId', … }`、`{ path: '*', … }`。列表页：`const [searchParams, setSearchParams] = useSearchParams()`，`const filters = parseFilters(searchParams)`；修改时 `setSearchParams(toSearchParams({ ...filters, ...changes }), options)`。
:::

:::hint{level=2}
列表中的链接：`` <Link to={`/projects/${p.id}`} state={{ listSearch: search }}> ``，其中 `search` 来自 `useLocation()`。详情页：`useLocation().state` 交给一个参数类型是 `unknown` 的函数，用 `typeof`、`'listSearch' in state` 收窄，得到字符串或 `''`；返回链接是 `to={{ pathname: '/projects', search }}`。下拉框的 `onChange` 中，用 `STATUS_FILTERS.find((s) => s === value)` 把字符串变回 `StatusFilter`。
:::

:::explanation
界面上的筛选条件只有一个来源：地址。每次渲染都用 `parseFilters(searchParams)` 读出来，修改时只改地址，React Router 再用新的地址渲染。所以“后退”“前进”、打开分享来的链接，下拉框、输入框和列表都和地址一致。如果把条件复制进 `useState`，它只在第一次渲染时读取地址，之后地址变了，界面却不变。

改变下拉框是一次明确的选择，新增一条历史记录，“后退”可以撤销它；输入搜索词时每个字都会更新地址，如果每次都新增历史记录，用户要按很多次“后退”才能离开这个页面，所以用 `replace`。`flushSync` 的原因见 g13：输入框的值直接来自地址。

“返回项目列表”用链接的 `state` 记住列表页当时的 `search`。它随这条历史记录保存，刷新之后还在，但不在地址中，分享出去的详情页链接很干净。读取时一定要检查：`location.state` 的类型是 `any`，直接打开的页面中它是 `null`，旧版本的应用写进去的可能是别的格式。如果把 `{ listSearch: 42 }` 直接交给 `Link`，React Router 生成地址时会出错，整个页面都显示不出来。

根地址的 loader 返回 `replace('/projects')`，在渲染之前就转走了，并且 `/` 不会留在历史记录中。用 `redirect` 的话，“后退”回到 `/`，又被转回 `/projects`。

替代解换了几种写法：根地址用 `<Navigate to="/projects" replace />`；`projects` 路由下嵌套 index 路由和 `:projectId` 子路由，列表中用相对链接 `to={p.id}`，返回链接用 `to={{ pathname: '..', search }}`（`..` 是相对于路由的上一级，也就是 `/projects`）；`setSearchParams` 传一个函数，在地址当前的参数上修改；用类型守卫 `isFromList` 检查 `state`。
:::

:::variant{kind=alt name=navigate-nested}
```tsx file=routes.tsx
import { Link, Navigate, Outlet, useLocation, useParams, useSearchParams, type RouteObject } from 'react-router';
import { PROJECTS, TODAY } from './data';
import { STATUS_NAMES, type Project } from './model';
import { listProjects, parseFilters, SORTS, STATUS_FILTERS, toSearchParams, type Filters, type Sort, type StatusFilter } from './query';
import { summarize } from './summary';

const STATUS_LABELS: Record<StatusFilter, string> = { all: '全部', ...STATUS_NAMES, overdue: '已过期' };
const SORT_LABELS: Record<Sort, string> = { due: '截止日期', name: '名称' };

type FromList = { listSearch: string };

function isFromList(state: unknown): state is FromList {
  return typeof state === 'object' && state !== null && 'listSearch' in state && typeof state.listSearch === 'string';
}

function Layout() {
  return (
    <>
      <header>
        <Link to="/projects">项目面板</Link>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}

function ProjectList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const filters = parseFilters(searchParams);
  const projects = listProjects(PROJECTS, filters, TODAY);
  const from: FromList = { listSearch: location.search };

  // 函数形式：在地址当前的参数上修改
  const change = (changes: Partial<Filters>, replaceEntry = false) =>
    setSearchParams((prev) => toSearchParams({ ...parseFilters(prev), ...changes }), replaceEntry ? { replace: true, flushSync: true } : undefined);

  return (
    <>
      <h1>项目</h1>
      <label htmlFor="status">状态</label>{' '}
      <select id="status" value={filters.status} onChange={(e) => change({ status: STATUS_FILTERS.find((s) => s === e.currentTarget.value) ?? 'all' })}>
        {STATUS_FILTERS.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>{' '}
      <label htmlFor="q">搜索</label> <input id="q" value={filters.q} onChange={(e) => change({ q: e.currentTarget.value }, true)} />{' '}
      <label htmlFor="sort">排序</label>{' '}
      <select id="sort" value={filters.sort} onChange={(e) => change({ sort: SORTS.find((s) => s === e.currentTarget.value) ?? 'due' })}>
        {SORTS.map((s) => (
          <option key={s} value={s}>
            {SORT_LABELS[s]}
          </option>
        ))}
      </select>
      <p role="status">{projects.length > 0 ? `找到 ${projects.length} 个项目` : '没有符合条件的项目'}</p>
      {projects.length > 0 ? (
        <ul aria-label="项目列表">
          {projects.map((p) => {
            const s = summarize(p, TODAY);
            return (
              <li key={p.id}>
                {/* 相对于当前路由（/projects）的链接 */}
                <Link to={p.id} state={from}>
                  {p.name}
                </Link>
                ：{[p.owner, STATUS_NAMES[p.status], `${s.done}/${s.total}`, p.dueDate ?? '无截止日期'].join('，')}
                {s.overdue ? '（已过期）' : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </>
  );
}

function dueLine(p: Project): string {
  if (p.dueDate === null) return '没有截止日期';
  const { daysLeft } = summarize(p, TODAY);
  const prefix = `截止日期：${p.dueDate}`;
  if (p.status === 'done' || daysLeft === null) return prefix;
  if (daysLeft === 0) return `${prefix}（今天到期）`;
  return daysLeft > 0 ? `${prefix}（还有 ${daysLeft} 天）` : `${prefix}（已过期 ${Math.abs(daysLeft)} 天）`;
}

function ProjectDetail() {
  const { projectId } = useParams();
  const { state } = useLocation();
  const search = isFromList(state) ? state.listSearch : '';
  const project = PROJECTS.find((p) => p.id === projectId);
  // 相对于路由的上一级（projects），保留列表的查询字符串
  const backLink = <Link to={{ pathname: '..', search }}>返回项目列表</Link>;

  if (!project) {
    return (
      <>
        <h1>没有这个项目</h1>
        {backLink}
      </>
    );
  }
  const s = summarize(project, TODAY);
  return (
    <article>
      <h1>{project.name}</h1>
      <p>{`负责人：${project.owner}`}</p>
      <p>{`状态：${STATUS_NAMES[project.status]}`}</p>
      <p>{`进度：${s.done}/${s.total}（${s.percent}%）`}</p>
      <p>{dueLine(project)}</p>
      {project.tasks.length > 0 ? (
        <ul aria-label="任务">
          {project.tasks.map((t) => (
            <li key={t.id}>{t.done ? `${t.title}（已完成）` : t.title}</li>
          ))}
        </ul>
      ) : (
        <p>还没有任务</p>
      )}
      {backLink}
    </article>
  );
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    children: [
      // 在组件中转向，同样要替换当前的历史记录
      { index: true, element: <Navigate to="/projects" replace /> },
      {
        path: 'projects',
        children: [
          { index: true, Component: ProjectList },
          { path: ':projectId', Component: ProjectDetail },
        ],
      },
      { path: '*', element: <h1>页面不存在</h1> },
    ],
  },
];
```
:::

:::variant{kind=wrong name=push-redirect fails=tests reason="用 redirect 转向：/ 留在历史记录中，“后退”又被转回 /projects"}
```tsx file=routes.tsx
import { Link, Outlet, redirect, useLocation, useParams, useSearchParams, type RouteObject } from 'react-router';
import { PROJECTS, TODAY } from './data';
import { STATUS_NAMES, type Project } from './model';
import { listProjects, parseFilters, SORTS, STATUS_FILTERS, toSearchParams, type Filters, type Sort, type StatusFilter } from './query';
import { summarize, type Summary } from './summary';

const STATUS_LABELS: Record<StatusFilter, string> = { all: '全部', ...STATUS_NAMES, overdue: '已过期' };
const SORT_LABELS: Record<Sort, string> = { due: '截止日期', name: '名称' };

/** 进入详情页时随导航保存的数据：列表页当时的查询字符串 */
type FromList = { listSearch: string };

/** location.state 的类型是 any：它可能来自旧版本的页面，也可能根本没有，用之前先检查 */
function listSearchOf(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'listSearch' in state && typeof state.listSearch === 'string') {
    return state.listSearch;
  }
  return '';
}

function Layout() {
  return (
    <>
      <header>
        <Link to="/projects">项目面板</Link>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}

function ProjectItem({ project, from }: { project: Project; from: FromList }) {
  const s = summarize(project, TODAY);
  return (
    <li>
      <Link to={`/projects/${project.id}`} state={from}>
        {project.name}
      </Link>{' '}
      {project.owner} · {STATUS_NAMES[project.status]} · {s.done}/{s.total} · {project.dueDate ?? '无截止日期'}
      {s.overdue && <strong> 已过期</strong>}
    </li>
  );
}

function ProjectList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { search } = useLocation();
  const filters = parseFilters(searchParams);
  const projects = listProjects(PROJECTS, filters, TODAY);

  /** 地址只由 toSearchParams 生成：和默认值相同的条件不出现在地址中 */
  function update(changes: Partial<Filters>, options?: { replace: boolean; flushSync: boolean }) {
    setSearchParams(toSearchParams({ ...filters, ...changes }), options);
  }

  return (
    <>
      <h1>项目</h1>
      <label>
        状态{' '}
        <select
          value={filters.status}
          onChange={(e) => {
            const value = e.currentTarget.value;
            const status = STATUS_FILTERS.find((s) => s === value);
            if (status !== undefined) update({ status });
          }}
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>{' '}
      <label>
        搜索 <input type="search" value={filters.q} onChange={(e) => update({ q: e.currentTarget.value }, { replace: true, flushSync: true })} />
      </label>{' '}
      <label>
        排序{' '}
        <select
          value={filters.sort}
          onChange={(e) => {
            const value = e.currentTarget.value;
            const sort = SORTS.find((s) => s === value);
            if (sort !== undefined) update({ sort });
          }}
        >
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {SORT_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <p role="status">{projects.length === 0 ? '没有符合条件的项目' : `找到 ${projects.length} 个项目`}</p>
      {projects.length > 0 && (
        <ul aria-label="项目列表">
          {projects.map((p) => (
            <ProjectItem key={p.id} project={p} from={{ listSearch: search }} />
          ))}
        </ul>
      )}
    </>
  );
}

function dueText(project: Project, s: Summary): string {
  const { dueDate } = project;
  if (dueDate === null || s.daysLeft === null) return '没有截止日期';
  if (project.status === 'done') return `截止日期：${dueDate}`;
  if (s.daysLeft > 0) return `截止日期：${dueDate}（还有 ${s.daysLeft} 天）`;
  if (s.daysLeft === 0) return `截止日期：${dueDate}（今天到期）`;
  return `截止日期：${dueDate}（已过期 ${-s.daysLeft} 天）`;
}

function ProjectDetail() {
  const { projectId } = useParams();
  const location = useLocation();
  const back = { pathname: '/projects', search: listSearchOf(location.state) };
  const project = PROJECTS.find((p) => p.id === projectId);

  if (project === undefined) {
    return (
      <>
        <h1>没有这个项目</h1>
        <Link to={back}>返回项目列表</Link>
      </>
    );
  }

  const s = summarize(project, TODAY);
  return (
    <>
      <h1>{project.name}</h1>
      <p>负责人：{project.owner}</p>
      <p>状态：{STATUS_NAMES[project.status]}</p>
      <p>
        进度：{s.done}/{s.total}（{s.percent}%）
      </p>
      <p>{dueText(project, s)}</p>
      {project.tasks.length === 0 ? (
        <p>还没有任务</p>
      ) : (
        <ul aria-label="任务">
          {project.tasks.map((t) => (
            <li key={t.id}>
              {t.title}
              {t.done && '（已完成）'}
            </li>
          ))}
        </ul>
      )}
      <Link to={back}>返回项目列表</Link>
    </>
  );
}

function NotFound() {
  return <h1>页面不存在</h1>;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    children: [
      // replace 而不是 redirect：否则“后退”回到 /，又被转回 /projects，用户就退不出去了
      { index: true, loader: () => redirect('/projects') },
      { path: 'projects', Component: ProjectList },
      { path: 'projects/:projectId', Component: ProjectDetail },
      { path: '*', Component: NotFound },
    ],
  },
];
```
:::

:::variant{kind=wrong name=filters-state fails=tests reason="把筛选条件复制进 useState：“后退”之后地址变了，界面却不变"}
```tsx file=routes.tsx
import { useState } from 'react';
import { Link, Outlet, replace, useLocation, useParams, useSearchParams, type RouteObject } from 'react-router';
import { PROJECTS, TODAY } from './data';
import { STATUS_NAMES, type Project } from './model';
import { listProjects, parseFilters, SORTS, STATUS_FILTERS, toSearchParams, type Filters, type Sort, type StatusFilter } from './query';
import { summarize, type Summary } from './summary';

const STATUS_LABELS: Record<StatusFilter, string> = { all: '全部', ...STATUS_NAMES, overdue: '已过期' };
const SORT_LABELS: Record<Sort, string> = { due: '截止日期', name: '名称' };

/** 进入详情页时随导航保存的数据：列表页当时的查询字符串 */
type FromList = { listSearch: string };

/** location.state 的类型是 any：它可能来自旧版本的页面，也可能根本没有，用之前先检查 */
function listSearchOf(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'listSearch' in state && typeof state.listSearch === 'string') {
    return state.listSearch;
  }
  return '';
}

function Layout() {
  return (
    <>
      <header>
        <Link to="/projects">项目面板</Link>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}

function ProjectItem({ project, from }: { project: Project; from: FromList }) {
  const s = summarize(project, TODAY);
  return (
    <li>
      <Link to={`/projects/${project.id}`} state={from}>
        {project.name}
      </Link>{' '}
      {project.owner} · {STATUS_NAMES[project.status]} · {s.done}/{s.total} · {project.dueDate ?? '无截止日期'}
      {s.overdue && <strong> 已过期</strong>}
    </li>
  );
}

function ProjectList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { search } = useLocation();
  const [filters, setFilters] = useState(() => parseFilters(searchParams));
  const projects = listProjects(PROJECTS, filters, TODAY);

  /** 地址只由 toSearchParams 生成：和默认值相同的条件不出现在地址中 */
  function update(changes: Partial<Filters>, options?: { replace: boolean; flushSync: boolean }) {
    const next = { ...filters, ...changes };
    setFilters(next);
    setSearchParams(toSearchParams(next), options);
  }

  return (
    <>
      <h1>项目</h1>
      <label>
        状态{' '}
        <select
          value={filters.status}
          onChange={(e) => {
            const value = e.currentTarget.value;
            const status = STATUS_FILTERS.find((s) => s === value);
            if (status !== undefined) update({ status });
          }}
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>{' '}
      <label>
        搜索 <input type="search" value={filters.q} onChange={(e) => update({ q: e.currentTarget.value }, { replace: true, flushSync: true })} />
      </label>{' '}
      <label>
        排序{' '}
        <select
          value={filters.sort}
          onChange={(e) => {
            const value = e.currentTarget.value;
            const sort = SORTS.find((s) => s === value);
            if (sort !== undefined) update({ sort });
          }}
        >
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {SORT_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <p role="status">{projects.length === 0 ? '没有符合条件的项目' : `找到 ${projects.length} 个项目`}</p>
      {projects.length > 0 && (
        <ul aria-label="项目列表">
          {projects.map((p) => (
            <ProjectItem key={p.id} project={p} from={{ listSearch: search }} />
          ))}
        </ul>
      )}
    </>
  );
}

function dueText(project: Project, s: Summary): string {
  const { dueDate } = project;
  if (dueDate === null || s.daysLeft === null) return '没有截止日期';
  if (project.status === 'done') return `截止日期：${dueDate}`;
  if (s.daysLeft > 0) return `截止日期：${dueDate}（还有 ${s.daysLeft} 天）`;
  if (s.daysLeft === 0) return `截止日期：${dueDate}（今天到期）`;
  return `截止日期：${dueDate}（已过期 ${-s.daysLeft} 天）`;
}

function ProjectDetail() {
  const { projectId } = useParams();
  const location = useLocation();
  const back = { pathname: '/projects', search: listSearchOf(location.state) };
  const project = PROJECTS.find((p) => p.id === projectId);

  if (project === undefined) {
    return (
      <>
        <h1>没有这个项目</h1>
        <Link to={back}>返回项目列表</Link>
      </>
    );
  }

  const s = summarize(project, TODAY);
  return (
    <>
      <h1>{project.name}</h1>
      <p>负责人：{project.owner}</p>
      <p>状态：{STATUS_NAMES[project.status]}</p>
      <p>
        进度：{s.done}/{s.total}（{s.percent}%）
      </p>
      <p>{dueText(project, s)}</p>
      {project.tasks.length === 0 ? (
        <p>还没有任务</p>
      ) : (
        <ul aria-label="任务">
          {project.tasks.map((t) => (
            <li key={t.id}>
              {t.title}
              {t.done && '（已完成）'}
            </li>
          ))}
        </ul>
      )}
      <Link to={back}>返回项目列表</Link>
    </>
  );
}

function NotFound() {
  return <h1>页面不存在</h1>;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    children: [
      // replace 而不是 redirect：否则“后退”回到 /，又被转回 /projects，用户就退不出去了
      { index: true, loader: () => replace('/projects') },
      { path: 'projects', Component: ProjectList },
      { path: 'projects/:projectId', Component: ProjectDetail },
      { path: '*', Component: NotFound },
    ],
  },
];
```
:::

:::variant{kind=wrong name=back-plain fails=tests reason="“返回项目列表”总是 /projects：筛选条件丢了"}
```tsx file=routes.tsx
import { Link, Outlet, replace, useLocation, useParams, useSearchParams, type RouteObject } from 'react-router';
import { PROJECTS, TODAY } from './data';
import { STATUS_NAMES, type Project } from './model';
import { listProjects, parseFilters, SORTS, STATUS_FILTERS, toSearchParams, type Filters, type Sort, type StatusFilter } from './query';
import { summarize, type Summary } from './summary';

const STATUS_LABELS: Record<StatusFilter, string> = { all: '全部', ...STATUS_NAMES, overdue: '已过期' };
const SORT_LABELS: Record<Sort, string> = { due: '截止日期', name: '名称' };

/** 进入详情页时随导航保存的数据：列表页当时的查询字符串 */
type FromList = { listSearch: string };

/** location.state 的类型是 any：它可能来自旧版本的页面，也可能根本没有，用之前先检查 */
function listSearchOf(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'listSearch' in state && typeof state.listSearch === 'string') {
    return state.listSearch;
  }
  return '';
}

function Layout() {
  return (
    <>
      <header>
        <Link to="/projects">项目面板</Link>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}

function ProjectItem({ project, from }: { project: Project; from: FromList }) {
  const s = summarize(project, TODAY);
  return (
    <li>
      <Link to={`/projects/${project.id}`} state={from}>
        {project.name}
      </Link>{' '}
      {project.owner} · {STATUS_NAMES[project.status]} · {s.done}/{s.total} · {project.dueDate ?? '无截止日期'}
      {s.overdue && <strong> 已过期</strong>}
    </li>
  );
}

function ProjectList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { search } = useLocation();
  const filters = parseFilters(searchParams);
  const projects = listProjects(PROJECTS, filters, TODAY);

  /** 地址只由 toSearchParams 生成：和默认值相同的条件不出现在地址中 */
  function update(changes: Partial<Filters>, options?: { replace: boolean; flushSync: boolean }) {
    setSearchParams(toSearchParams({ ...filters, ...changes }), options);
  }

  return (
    <>
      <h1>项目</h1>
      <label>
        状态{' '}
        <select
          value={filters.status}
          onChange={(e) => {
            const value = e.currentTarget.value;
            const status = STATUS_FILTERS.find((s) => s === value);
            if (status !== undefined) update({ status });
          }}
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>{' '}
      <label>
        搜索 <input type="search" value={filters.q} onChange={(e) => update({ q: e.currentTarget.value }, { replace: true, flushSync: true })} />
      </label>{' '}
      <label>
        排序{' '}
        <select
          value={filters.sort}
          onChange={(e) => {
            const value = e.currentTarget.value;
            const sort = SORTS.find((s) => s === value);
            if (sort !== undefined) update({ sort });
          }}
        >
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {SORT_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <p role="status">{projects.length === 0 ? '没有符合条件的项目' : `找到 ${projects.length} 个项目`}</p>
      {projects.length > 0 && (
        <ul aria-label="项目列表">
          {projects.map((p) => (
            <ProjectItem key={p.id} project={p} from={{ listSearch: search }} />
          ))}
        </ul>
      )}
    </>
  );
}

function dueText(project: Project, s: Summary): string {
  const { dueDate } = project;
  if (dueDate === null || s.daysLeft === null) return '没有截止日期';
  if (project.status === 'done') return `截止日期：${dueDate}`;
  if (s.daysLeft > 0) return `截止日期：${dueDate}（还有 ${s.daysLeft} 天）`;
  if (s.daysLeft === 0) return `截止日期：${dueDate}（今天到期）`;
  return `截止日期：${dueDate}（已过期 ${-s.daysLeft} 天）`;
}

function ProjectDetail() {
  const { projectId } = useParams();
  const location = useLocation();
  const back = '/projects';
  const project = PROJECTS.find((p) => p.id === projectId);

  if (project === undefined) {
    return (
      <>
        <h1>没有这个项目</h1>
        <Link to={back}>返回项目列表</Link>
      </>
    );
  }

  const s = summarize(project, TODAY);
  return (
    <>
      <h1>{project.name}</h1>
      <p>负责人：{project.owner}</p>
      <p>状态：{STATUS_NAMES[project.status]}</p>
      <p>
        进度：{s.done}/{s.total}（{s.percent}%）
      </p>
      <p>{dueText(project, s)}</p>
      {project.tasks.length === 0 ? (
        <p>还没有任务</p>
      ) : (
        <ul aria-label="任务">
          {project.tasks.map((t) => (
            <li key={t.id}>
              {t.title}
              {t.done && '（已完成）'}
            </li>
          ))}
        </ul>
      )}
      <Link to={back}>返回项目列表</Link>
    </>
  );
}

function NotFound() {
  return <h1>页面不存在</h1>;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    children: [
      // replace 而不是 redirect：否则“后退”回到 /，又被转回 /projects，用户就退不出去了
      { index: true, loader: () => replace('/projects') },
      { path: 'projects', Component: ProjectList },
      { path: 'projects/:projectId', Component: ProjectDetail },
      { path: '*', Component: NotFound },
    ],
  },
];
```
:::

:::variant{kind=wrong name=state-unchecked fails=tests reason="直接使用类型为 any 的 location.state：格式不对时整个页面出错"}
```tsx file=routes.tsx
import { Link, Outlet, replace, useLocation, useParams, useSearchParams, type RouteObject } from 'react-router';
import { PROJECTS, TODAY } from './data';
import { STATUS_NAMES, type Project } from './model';
import { listProjects, parseFilters, SORTS, STATUS_FILTERS, toSearchParams, type Filters, type Sort, type StatusFilter } from './query';
import { summarize, type Summary } from './summary';

const STATUS_LABELS: Record<StatusFilter, string> = { all: '全部', ...STATUS_NAMES, overdue: '已过期' };
const SORT_LABELS: Record<Sort, string> = { due: '截止日期', name: '名称' };

/** 进入详情页时随导航保存的数据：列表页当时的查询字符串 */
type FromList = { listSearch: string };

/** location.state 的类型是 any：它可能来自旧版本的页面，也可能根本没有，用之前先检查 */
function listSearchOf(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'listSearch' in state && typeof state.listSearch === 'string') {
    return state.listSearch;
  }
  return '';
}

function Layout() {
  return (
    <>
      <header>
        <Link to="/projects">项目面板</Link>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}

function ProjectItem({ project, from }: { project: Project; from: FromList }) {
  const s = summarize(project, TODAY);
  return (
    <li>
      <Link to={`/projects/${project.id}`} state={from}>
        {project.name}
      </Link>{' '}
      {project.owner} · {STATUS_NAMES[project.status]} · {s.done}/{s.total} · {project.dueDate ?? '无截止日期'}
      {s.overdue && <strong> 已过期</strong>}
    </li>
  );
}

function ProjectList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { search } = useLocation();
  const filters = parseFilters(searchParams);
  const projects = listProjects(PROJECTS, filters, TODAY);

  /** 地址只由 toSearchParams 生成：和默认值相同的条件不出现在地址中 */
  function update(changes: Partial<Filters>, options?: { replace: boolean; flushSync: boolean }) {
    setSearchParams(toSearchParams({ ...filters, ...changes }), options);
  }

  return (
    <>
      <h1>项目</h1>
      <label>
        状态{' '}
        <select
          value={filters.status}
          onChange={(e) => {
            const value = e.currentTarget.value;
            const status = STATUS_FILTERS.find((s) => s === value);
            if (status !== undefined) update({ status });
          }}
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>{' '}
      <label>
        搜索 <input type="search" value={filters.q} onChange={(e) => update({ q: e.currentTarget.value }, { replace: true, flushSync: true })} />
      </label>{' '}
      <label>
        排序{' '}
        <select
          value={filters.sort}
          onChange={(e) => {
            const value = e.currentTarget.value;
            const sort = SORTS.find((s) => s === value);
            if (sort !== undefined) update({ sort });
          }}
        >
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {SORT_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <p role="status">{projects.length === 0 ? '没有符合条件的项目' : `找到 ${projects.length} 个项目`}</p>
      {projects.length > 0 && (
        <ul aria-label="项目列表">
          {projects.map((p) => (
            <ProjectItem key={p.id} project={p} from={{ listSearch: search }} />
          ))}
        </ul>
      )}
    </>
  );
}

function dueText(project: Project, s: Summary): string {
  const { dueDate } = project;
  if (dueDate === null || s.daysLeft === null) return '没有截止日期';
  if (project.status === 'done') return `截止日期：${dueDate}`;
  if (s.daysLeft > 0) return `截止日期：${dueDate}（还有 ${s.daysLeft} 天）`;
  if (s.daysLeft === 0) return `截止日期：${dueDate}（今天到期）`;
  return `截止日期：${dueDate}（已过期 ${-s.daysLeft} 天）`;
}

function ProjectDetail() {
  const { projectId } = useParams();
  const location = useLocation();
  const back = { pathname: '/projects', search: location.state?.listSearch ?? '' };
  const project = PROJECTS.find((p) => p.id === projectId);

  if (project === undefined) {
    return (
      <>
        <h1>没有这个项目</h1>
        <Link to={back}>返回项目列表</Link>
      </>
    );
  }

  const s = summarize(project, TODAY);
  return (
    <>
      <h1>{project.name}</h1>
      <p>负责人：{project.owner}</p>
      <p>状态：{STATUS_NAMES[project.status]}</p>
      <p>
        进度：{s.done}/{s.total}（{s.percent}%）
      </p>
      <p>{dueText(project, s)}</p>
      {project.tasks.length === 0 ? (
        <p>还没有任务</p>
      ) : (
        <ul aria-label="任务">
          {project.tasks.map((t) => (
            <li key={t.id}>
              {t.title}
              {t.done && '（已完成）'}
            </li>
          ))}
        </ul>
      )}
      <Link to={back}>返回项目列表</Link>
    </>
  );
}

function NotFound() {
  return <h1>页面不存在</h1>;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    children: [
      // replace 而不是 redirect：否则“后退”回到 /，又被转回 /projects，用户就退不出去了
      { index: true, loader: () => replace('/projects') },
      { path: 'projects', Component: ProjectList },
      { path: 'projects/:projectId', Component: ProjectDetail },
      { path: '*', Component: NotFound },
    ],
  },
];
```
:::

:::variant{kind=wrong name=search-push fails=tests reason="输入搜索词时新增历史记录：每个字都要按一次“后退”"}
```tsx file=routes.tsx
import { Link, Outlet, replace, useLocation, useParams, useSearchParams, type RouteObject } from 'react-router';
import { PROJECTS, TODAY } from './data';
import { STATUS_NAMES, type Project } from './model';
import { listProjects, parseFilters, SORTS, STATUS_FILTERS, toSearchParams, type Filters, type Sort, type StatusFilter } from './query';
import { summarize, type Summary } from './summary';

const STATUS_LABELS: Record<StatusFilter, string> = { all: '全部', ...STATUS_NAMES, overdue: '已过期' };
const SORT_LABELS: Record<Sort, string> = { due: '截止日期', name: '名称' };

/** 进入详情页时随导航保存的数据：列表页当时的查询字符串 */
type FromList = { listSearch: string };

/** location.state 的类型是 any：它可能来自旧版本的页面，也可能根本没有，用之前先检查 */
function listSearchOf(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'listSearch' in state && typeof state.listSearch === 'string') {
    return state.listSearch;
  }
  return '';
}

function Layout() {
  return (
    <>
      <header>
        <Link to="/projects">项目面板</Link>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}

function ProjectItem({ project, from }: { project: Project; from: FromList }) {
  const s = summarize(project, TODAY);
  return (
    <li>
      <Link to={`/projects/${project.id}`} state={from}>
        {project.name}
      </Link>{' '}
      {project.owner} · {STATUS_NAMES[project.status]} · {s.done}/{s.total} · {project.dueDate ?? '无截止日期'}
      {s.overdue && <strong> 已过期</strong>}
    </li>
  );
}

function ProjectList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { search } = useLocation();
  const filters = parseFilters(searchParams);
  const projects = listProjects(PROJECTS, filters, TODAY);

  /** 地址只由 toSearchParams 生成：和默认值相同的条件不出现在地址中 */
  function update(changes: Partial<Filters>, options?: { replace: boolean; flushSync: boolean }) {
    setSearchParams(toSearchParams({ ...filters, ...changes }), options);
  }

  return (
    <>
      <h1>项目</h1>
      <label>
        状态{' '}
        <select
          value={filters.status}
          onChange={(e) => {
            const value = e.currentTarget.value;
            const status = STATUS_FILTERS.find((s) => s === value);
            if (status !== undefined) update({ status });
          }}
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>{' '}
      <label>
        搜索 <input type="search" value={filters.q} onChange={(e) => update({ q: e.currentTarget.value })} />
      </label>{' '}
      <label>
        排序{' '}
        <select
          value={filters.sort}
          onChange={(e) => {
            const value = e.currentTarget.value;
            const sort = SORTS.find((s) => s === value);
            if (sort !== undefined) update({ sort });
          }}
        >
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {SORT_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <p role="status">{projects.length === 0 ? '没有符合条件的项目' : `找到 ${projects.length} 个项目`}</p>
      {projects.length > 0 && (
        <ul aria-label="项目列表">
          {projects.map((p) => (
            <ProjectItem key={p.id} project={p} from={{ listSearch: search }} />
          ))}
        </ul>
      )}
    </>
  );
}

function dueText(project: Project, s: Summary): string {
  const { dueDate } = project;
  if (dueDate === null || s.daysLeft === null) return '没有截止日期';
  if (project.status === 'done') return `截止日期：${dueDate}`;
  if (s.daysLeft > 0) return `截止日期：${dueDate}（还有 ${s.daysLeft} 天）`;
  if (s.daysLeft === 0) return `截止日期：${dueDate}（今天到期）`;
  return `截止日期：${dueDate}（已过期 ${-s.daysLeft} 天）`;
}

function ProjectDetail() {
  const { projectId } = useParams();
  const location = useLocation();
  const back = { pathname: '/projects', search: listSearchOf(location.state) };
  const project = PROJECTS.find((p) => p.id === projectId);

  if (project === undefined) {
    return (
      <>
        <h1>没有这个项目</h1>
        <Link to={back}>返回项目列表</Link>
      </>
    );
  }

  const s = summarize(project, TODAY);
  return (
    <>
      <h1>{project.name}</h1>
      <p>负责人：{project.owner}</p>
      <p>状态：{STATUS_NAMES[project.status]}</p>
      <p>
        进度：{s.done}/{s.total}（{s.percent}%）
      </p>
      <p>{dueText(project, s)}</p>
      {project.tasks.length === 0 ? (
        <p>还没有任务</p>
      ) : (
        <ul aria-label="任务">
          {project.tasks.map((t) => (
            <li key={t.id}>
              {t.title}
              {t.done && '（已完成）'}
            </li>
          ))}
        </ul>
      )}
      <Link to={back}>返回项目列表</Link>
    </>
  );
}

function NotFound() {
  return <h1>页面不存在</h1>;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    children: [
      // replace 而不是 redirect：否则“后退”回到 /，又被转回 /projects，用户就退不出去了
      { index: true, loader: () => replace('/projects') },
      { path: 'projects', Component: ProjectList },
      { path: 'projects/:projectId', Component: ProjectDetail },
      { path: '*', Component: NotFound },
    ],
  },
];
```
:::

