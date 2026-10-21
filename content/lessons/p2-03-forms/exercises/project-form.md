---
kind: challenge
title: 新建与编辑项目的表单
---
完成 `ProjectForm.tsx` 中的表单组件 `ProjectForm`。它用在新建页（`original` 是 `null`）和编辑页中，`onSave` 由页面提供：保存数据，然后转到别的页面。`form.ts` 是上一个练习的答案；`routes.tsx`、`store.ts` 是预览用的页面和内存中的数据；这些文件都是只读的。三个输入框和提交按钮已经写好。

1. **校验**：提交时用 `validateProject(draft, { today, projects, original })` 校验；
   - 第一次提交之前不显示错误；提交过之后，错误随输入实时更新；
   - 出错的输入框加上 `aria-invalid="true"`，`aria-describedby` 指向一个 `id` 为“字段名-error”（如 `name-error`）的元素，其中是错误信息；
   - 提交时有错误：不调用 `onSave`，焦点移到第一个出错的输入框（按名称、负责人、截止日期的顺序；字段名也是输入框的 `id`）；
   - 没有错误：调用 `onSave`，传入校验得到的数据；
2. **离开之前提醒**：表单中的值和初始值（`toDraft(original)`）有任何不同，就算“有未保存的修改”（改了又改回去不算）。有修改时：
   - 站内的导航（链接、“后退”）到另一个路径时，用 `useBlocker` 拦截，并显示一个 `role="alertdialog"` 的元素：名字（`aria-labelledby`）是“离开这个页面？”，描述（`aria-describedby`）是“还有没保存的修改，离开之后它们会丢失。”。其中有两个按钮：“继续编辑”（出现时获得焦点；留在这里）和“离开”（去原来要去的地方）；
   - 刷新、关闭页面时：监听 `window` 的 `beforeunload` 事件，调用 `preventDefault()`。没有修改时不监听；
   - 保存成功之后，`onSave` 引起的导航不要拦截。

:::files{role=starter}
```tsx file=ProjectForm.tsx
import { useState, type SubmitEvent } from 'react';
import { toDraft, validateProject, type ProjectDraft, type ProjectInput } from './form';
import type { Project } from './model';

type Props = Readonly<{
  /** 正在编辑的项目；新建时是 null */
  original: Project | null;
  projects: readonly Project[];
  today: string;
  onSave: (input: ProjectInput) => void;
}>;

/** 字段的顺序也是出错时寻找第一个错误的顺序 */
const FIELDS = [
  { key: 'name', label: '名称', type: 'text' },
  { key: 'owner', label: '负责人', type: 'text' },
  { key: 'dueDate', label: '截止日期', type: 'date' },
] as const;

export function ProjectForm({ original, projects, today, onSave }: Props) {
  const [draft, setDraft] = useState<ProjectDraft>(() => toDraft(original));

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    // TODO：校验；有错误时显示错误并把焦点移到第一个错误上；没有错误时调用 onSave
  }

  // TODO：有未保存的修改时，拦截站内的导航，并提醒刷新、关闭标签页
  return (
    <form noValidate onSubmit={handleSubmit}>
      {FIELDS.map((f) => (
        <div key={f.key}>
          <label htmlFor={f.key}>{f.label}</label>{' '}
          <input
            id={f.key}
            type={f.type}
            value={draft[f.key]}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setDraft((d) => ({ ...d, [f.key]: value }));
            }}
          />
        </div>
      ))}
      <button type="submit">{original === null ? '创建项目' : '保存修改'}</button>
    </form>
  );
}
```
:::

:::files{role=support}
```ts file=form.ts readonly
import type { Project } from './model';

/** 表单中的值：输入框给出的都是字符串，没有填写的截止日期是 '' */
export type ProjectDraft = Readonly<{ name: string; owner: string; dueDate: string }>;

/** 校验通过之后的数据：去掉了首尾空白，没有截止日期是 null */
export type ProjectInput = Readonly<{ name: string; owner: string; dueDate: string | null }>;

/** 每个字段的错误信息；没有错误的字段不出现 */
export type FieldErrors = Partial<Record<keyof ProjectDraft, string>>;

export type Validation = { ok: true; value: ProjectInput } | { ok: false; errors: FieldErrors };

export type ValidationContext = Readonly<{
  /** 今天，YYYY-MM-DD */
  today: string;
  /** 已有的全部项目，用来检查重名 */
  projects: readonly Project[];
  /** 正在编辑的项目；新建时是 null */
  original: Project | null;
}>;

export const NAME_MAX_LENGTH = 40;

/** 表单的初始值：编辑时来自项目，新建时都是空的 */
export function toDraft(project: Project | null): ProjectDraft {
  return { name: project?.name ?? '', owner: project?.owner ?? '', dueDate: project?.dueDate ?? '' };
}

/** 是 YYYY-MM-DD 格式，并且是日历上真实存在的一天 */
function isCalendarDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  // 2026-02-30 会被“进位”成 3 月 2 日：转换回字符串之后和原来不同
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

export function validateProject(draft: ProjectDraft, context: ValidationContext): Validation {
  const { today, projects, original } = context;
  const name = draft.name.trim();
  const owner = draft.owner.trim();
  const dueDate = draft.dueDate === '' ? null : draft.dueDate;
  const errors: FieldErrors = {};

  if (name === '') {
    errors.name = '请输入项目名称';
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = `项目名称不能超过 ${NAME_MAX_LENGTH} 个字符`;
  } else {
    // 编辑时，项目和它自己同名不算重名
    const same = projects.find((p) => p.id !== original?.id && p.name.toLowerCase() === name.toLowerCase());
    if (same !== undefined) errors.name = `已经有一个叫“${same.name}”的项目`;
  }

  if (owner === '') errors.owner = '请输入负责人';

  if (dueDate !== null) {
    if (!isCalendarDate(dueDate)) {
      errors.dueDate = '请输入有效的日期';
    } else if (dueDate < today && dueDate !== original?.dueDate) {
      // 已经过期的项目，保持原来的截止日期不变是允许的
      errors.dueDate = '截止日期不能早于今天';
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, owner, dueDate } };
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
```ts file=store.ts readonly
import { useSyncExternalStore } from 'react';
import { PROJECTS } from './data';
import type { ProjectInput } from './form';
import type { Project } from './model';

// 这个里程碑还没有服务器：项目保存在内存中，刷新页面就恢复原样（p2-04 换成服务器）
let projects: readonly Project[] = PROJECTS;
let nextId = PROJECTS.length + 1;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 读取全部项目；保存之后，用到它的组件会重新渲染 */
export function useProjects(): readonly Project[] {
  return useSyncExternalStore(subscribe, () => projects);
}

/** 新建（id 为 null）或修改一个项目，返回保存后的项目 */
export function saveProject(id: string | null, input: ProjectInput): Project {
  const old = projects.find((p) => p.id === id);
  const project: Project = old === undefined ? { id: `p${nextId++}`, status: 'planning', tasks: [], ...input } : { ...old, ...input };
  projects = old === undefined ? [...projects, project] : projects.map((p) => (p.id === project.id ? project : p));
  for (const listener of listeners) listener();
  return project;
}
```
```tsx file=routes.tsx readonly
import { Link, Outlet, replace, useNavigate, useParams, type RouteObject } from 'react-router';
import { TODAY } from './data';
import { STATUS_NAMES } from './model';
import { ProjectForm } from './ProjectForm';
import { saveProject, useProjects } from './store';

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
  const projects = useProjects();
  return (
    <>
      <h1>项目</h1>
      <p>
        <Link to="/projects/new">新建项目</Link>
      </p>
      <ul aria-label="项目列表">
        {projects.map((p) => (
          <li key={p.id}>
            <Link to={`/projects/${p.id}`}>{p.name}</Link> {p.owner} · {STATUS_NAMES[p.status]} · {p.dueDate ?? '无截止日期'}
          </li>
        ))}
      </ul>
    </>
  );
}

function ProjectDetail() {
  const { projectId } = useParams();
  const project = useProjects().find((p) => p.id === projectId);
  if (project === undefined) return <h1>没有这个项目</h1>;
  return (
    <>
      <h1>{project.name}</h1>
      <p>负责人：{project.owner}</p>
      <p>{project.dueDate === null ? '没有截止日期' : `截止日期：${project.dueDate}`}</p>
      <p>
        <Link to={`/projects/${project.id}/edit`}>编辑</Link> <Link to="/projects">返回项目列表</Link>
      </p>
    </>
  );
}

function NewProject() {
  const projects = useProjects();
  const navigate = useNavigate();
  return (
    <>
      <h1>新建项目</h1>
      <ProjectForm
        original={null}
        projects={projects}
        today={TODAY}
        onSave={(input) => {
          const project = saveProject(null, input);
          void navigate(`/projects/${project.id}`);
        }}
      />
      <Link to="/projects">取消</Link>
    </>
  );
}

function EditProject() {
  const { projectId } = useParams();
  const projects = useProjects();
  const navigate = useNavigate();
  const project = projects.find((p) => p.id === projectId);
  if (project === undefined) return <h1>没有这个项目</h1>;
  return (
    <>
      <h1>编辑项目</h1>
      {/* key：从一个项目的编辑页直接去另一个项目的编辑页时，表单重新开始（g12） */}
      <ProjectForm
        key={project.id}
        original={project}
        projects={projects}
        today={TODAY}
        onSave={(input) => {
          saveProject(project.id, input);
          void navigate(`/projects/${project.id}`);
        }}
      />
      <Link to={`/projects/${project.id}`}>取消</Link>
    </>
  );
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, loader: () => replace('/projects') },
      { path: 'projects', Component: ProjectList },
      { path: 'projects/new', Component: NewProject },
      { path: 'projects/:projectId', Component: ProjectDetail },
      { path: 'projects/:projectId/edit', Component: EditProject },
      { path: '*', element: <h1>页面不存在</h1> },
    ],
  },
];
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
```tsx file=ProjectForm.tsx
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { useBlocker } from 'react-router';
import { toDraft, validateProject, type FieldErrors, type ProjectDraft, type ProjectInput } from './form';
import type { Project } from './model';

type Props = Readonly<{
  /** 正在编辑的项目；新建时是 null */
  original: Project | null;
  projects: readonly Project[];
  today: string;
  onSave: (input: ProjectInput) => void;
}>;

/** 字段的顺序也是出错时寻找第一个错误的顺序 */
const FIELDS = [
  { key: 'name', label: '名称', type: 'text' },
  { key: 'owner', label: '负责人', type: 'text' },
  { key: 'dueDate', label: '截止日期', type: 'date' },
] as const;

export function ProjectForm({ original, projects, today, onSave }: Props) {
  const initial = toDraft(original);
  const [draft, setDraft] = useState<ProjectDraft>(initial);
  const [submitted, setSubmitted] = useState(false);
  // 保存成功之后，接下来的这次导航不要拦截。拦截函数在导航时才读取它，所以用 ref
  const saving = useRef(false);

  const result = validateProject(draft, { today, projects, original });
  const errors: FieldErrors = submitted && !result.ok ? result.errors : {};
  // 和初始值比较：改了又改回去，就不算有修改
  const dirty = FIELDS.some((f) => draft[f.key] !== initial[f.key]);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !saving.current && currentLocation.pathname !== nextLocation.pathname);

  // 刷新、关闭标签页、离开这个网站：只在有未保存的修改时监听
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    if (!result.ok) {
      const first = FIELDS.find((f) => result.errors[f.key] !== undefined);
      if (first !== undefined) document.getElementById(first.key)?.focus();
      return;
    }
    saving.current = true;
    onSave(result.value);
  }

  return (
    <form noValidate onSubmit={handleSubmit}>
      {FIELDS.map((f) => {
        const error = errors[f.key];
        return (
          <div key={f.key}>
            <label htmlFor={f.key}>{f.label}</label>{' '}
            <input
              id={f.key}
              type={f.type}
              value={draft[f.key]}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setDraft((d) => ({ ...d, [f.key]: value }));
              }}
              aria-invalid={error !== undefined}
              aria-describedby={error !== undefined ? `${f.key}-error` : undefined}
            />
            {error !== undefined && <p id={`${f.key}-error`}>{error}</p>}
          </div>
        );
      })}
      <button type="submit">{original === null ? '创建项目' : '保存修改'}</button>
      {blocker.state === 'blocked' && (
        <div role="alertdialog" aria-labelledby="leave-title" aria-describedby="leave-desc">
          <h2 id="leave-title">离开这个页面？</h2>
          <p id="leave-desc">还有没保存的修改，离开之后它们会丢失。</p>
          <button type="button" autoFocus onClick={() => blocker.reset()}>
            继续编辑
          </button>{' '}
          <button type="button" onClick={() => blocker.proceed()}>
            离开
          </button>
        </div>
      )}
    </form>
  );
}
```
:::

:::files{role=tests}
```tsx file=ProjectForm.test.tsx
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, Link, useNavigate, useParams, type RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { PROJECTS, TODAY } from './data';
import type { ProjectInput } from './form';
import { ProjectForm } from './ProjectForm';

const saved: ProjectInput[] = [];

function NewPage() {
  const navigate = useNavigate();
  return (
    <>
      <h1>新建项目</h1>
      <ProjectForm
        original={null}
        projects={PROJECTS}
        today={TODAY}
        onSave={(input) => {
          saved.push(input);
          void navigate('/projects');
        }}
      />
      <Link to="/projects">取消</Link>
    </>
  );
}

function EditPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const project = PROJECTS.find((p) => p.id === projectId);
  if (project === undefined) return <h1>没有这个项目</h1>;
  return (
    <>
      <h1>编辑项目</h1>
      <ProjectForm
        key={project.id}
        original={project}
        projects={PROJECTS}
        today={TODAY}
        onSave={(input) => {
          saved.push(input);
          void navigate(`/projects/${project.id}`);
        }}
      />
      <Link to={`/projects/${project.id}`}>取消</Link>
    </>
  );
}

const routes: RouteObject[] = [
  { path: '/projects', element: <h1>项目列表</h1> },
  { path: '/projects/new', Component: NewPage },
  { path: '/projects/:projectId', element: <h1>项目详情</h1> },
  { path: '/projects/:projectId/edit', Component: EditPage },
];

const clicks: boolean[] = [];

/** 阻止链接的真实跳转（沙箱中整页跳转会中断测试） */
function guard(event: MouseEvent): void {
  if (event.target instanceof Element && event.target.closest('a') !== null) {
    clicks.push(event.defaultPrevented);
    event.preventDefault();
  }
}

beforeEach(() => {
  saved.length = 0;
  clicks.length = 0;
  window.addEventListener('click', guard);
});

afterEach(() => {
  window.removeEventListener('click', guard);
});

function start(...entries: string[]) {
  const router = createMemoryRouter(routes, { initialEntries: entries, initialIndex: entries.length - 1 });
  render(<RouterProvider router={router} />);
  return { router, user: userEvent.setup() };
}

const field = (label: string) => screen.getByLabelText(label);
const leaveDialog = () => screen.queryByRole('alertdialog', { name: '离开这个页面？' });

/** 派发一个 beforeunload 事件，返回页面是否要求浏览器提醒 */
function beforeUnloadPrevented(): boolean {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('新建项目', () => {
  test('空的表单；还没有提交时不显示错误', () => {
    start('/projects/new');
    expect(field('名称')).toHaveValue('');
    expect(field('负责人')).toHaveValue('');
    expect(field('截止日期')).toHaveValue('');
    expect(field('截止日期')).toHaveAttribute('type', 'date');
    expect(screen.getByRole('button', { name: '创建项目' })).toBeInTheDocument();
    expect(field('名称')).not.toHaveAttribute('aria-invalid', 'true');
    expect(field('名称')).not.toHaveAccessibleDescription(/./);
  });

  test('提交有错误的表单：显示错误，焦点移到第一个错误，不保存', async () => {
    const { router, user } = start('/projects/new');
    await user.type(field('负责人'), '阿明');
    await user.click(screen.getByRole('button', { name: '创建项目' }));
    expect(field('名称')).toHaveAttribute('aria-invalid', 'true');
    expect(field('名称')).toHaveAccessibleDescription('请输入项目名称');
    expect(field('名称')).toHaveFocus();
    expect(field('负责人')).not.toHaveAttribute('aria-invalid', 'true');
    expect(saved).toEqual([]);
    expect(router.state.location.pathname).toBe('/projects/new');
  });

  test('提交过一次之后，错误随输入更新', async () => {
    const { user } = start('/projects/new');
    await user.click(screen.getByRole('button', { name: '创建项目' }));
    expect(field('名称')).toHaveAccessibleDescription('请输入项目名称');
    expect(field('负责人')).toHaveAccessibleDescription('请输入负责人');
    await user.type(field('名称'), '数据迁移');
    expect(field('名称')).toHaveAccessibleDescription('已经有一个叫“数据迁移”的项目');
    await user.type(field('名称'), '二期');
    expect(field('名称')).not.toHaveAttribute('aria-invalid', 'true');
    expect(field('名称')).not.toHaveAccessibleDescription(/./);
    expect(field('负责人')).toHaveAccessibleDescription('请输入负责人');
  });

  test('第一个错误在后面的字段时，焦点移到那里', async () => {
    const { user } = start('/projects/new');
    await user.type(field('名称'), '季度复盘');
    await user.type(field('负责人'), '阿明');
    await user.type(field('截止日期'), '2026-10-01');
    await user.click(screen.getByRole('button', { name: '创建项目' }));
    expect(field('截止日期')).toHaveAccessibleDescription('截止日期不能早于今天');
    expect(field('截止日期')).toHaveFocus();
  });

  test('提交正确的表单：保存整理好的数据，离开时不提醒', async () => {
    const { router, user } = start('/projects/new');
    await user.type(field('名称'), ' 季度复盘 ');
    await user.type(field('负责人'), '阿明');
    await user.click(screen.getByRole('button', { name: '创建项目' }));
    expect(saved).toEqual([{ name: '季度复盘', owner: '阿明', dueDate: null }]);
    expect(await screen.findByRole('heading', { level: 1, name: '项目列表' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/projects');
    expect(leaveDialog()).toBeNull();
  });
});

describe('编辑项目', () => {
  test('表单的初始值来自项目', () => {
    start('/projects/p1/edit');
    expect(field('名称')).toHaveValue('官网改版');
    expect(field('负责人')).toHaveValue('小林');
    expect(field('截止日期')).toHaveValue('2026-11-15');
    expect(screen.getByRole('button', { name: '保存修改' })).toBeInTheDocument();
  });

  test('不做修改直接保存：自己的名称不算重名，已经过期的截止日期可以保留', async () => {
    const { router, user } = start('/projects/p2/edit');
    await user.click(screen.getByRole('button', { name: '保存修改' }));
    expect(saved).toEqual([{ name: '数据迁移', owner: '阿明', dueDate: '2026-10-12' }]);
    expect(await screen.findByRole('heading', { level: 1, name: '项目详情' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/projects/p2');
  });

  test('改成另一个项目的名称：显示错误', async () => {
    const { user } = start('/projects/p1/edit');
    await user.clear(field('名称'));
    await user.type(field('名称'), '数据迁移');
    await user.click(screen.getByRole('button', { name: '保存修改' }));
    expect(field('名称')).toHaveAccessibleDescription('已经有一个叫“数据迁移”的项目');
    expect(field('名称')).toHaveFocus();
    expect(saved).toEqual([]);
  });

  test('修改之后保存：保存新的数据，离开时不提醒', async () => {
    const { router, user } = start('/projects/p1/edit');
    await user.type(field('名称'), '（第二版）');
    await user.click(screen.getByRole('button', { name: '保存修改' }));
    expect(saved).toEqual([{ name: '官网改版（第二版）', owner: '小林', dueDate: '2026-11-15' }]);
    expect(await screen.findByRole('heading', { level: 1, name: '项目详情' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/projects/p1');
    expect(leaveDialog(), '保存之后的导航不应该被拦截').toBeNull();
  });
});

describe('离开之前提醒', () => {
  test('没有修改：直接离开', async () => {
    const { router, user } = start('/projects/p1/edit');
    await user.click(screen.getByRole('link', { name: '取消' }));
    expect(await screen.findByRole('heading', { level: 1, name: '项目详情' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/projects/p1');
  });

  test('有修改时点击链接：先询问；“继续编辑”留在这里，修改还在', async () => {
    const { router, user } = start('/projects/p1/edit');
    await user.type(field('负责人'), '和阿明');
    await user.click(screen.getByRole('link', { name: '取消' }));
    const dialog = await screen.findByRole('alertdialog', { name: '离开这个页面？' });
    expect(dialog).toHaveAccessibleDescription('还有没保存的修改，离开之后它们会丢失。');
    expect(screen.getByRole('button', { name: '继续编辑' })).toHaveFocus();
    expect(router.state.location.pathname).toBe('/projects/p1/edit');
    await user.click(screen.getByRole('button', { name: '继续编辑' }));
    expect(leaveDialog()).toBeNull();
    expect(router.state.location.pathname).toBe('/projects/p1/edit');
    expect(field('负责人')).toHaveValue('小林和阿明');
  });

  test('选择“离开”：去往原来要去的页面', async () => {
    const { router, user } = start('/projects/p1/edit');
    await user.type(field('名称'), '!');
    await user.click(screen.getByRole('link', { name: '取消' }));
    await user.click(await screen.findByRole('button', { name: '离开' }));
    expect(await screen.findByRole('heading', { level: 1, name: '项目详情' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/projects/p1');
    expect(saved).toEqual([]);
  });

  test('“后退”也会被拦截', async () => {
    const { router, user } = start('/projects', '/projects/p1/edit');
    await user.type(field('名称'), '!');
    await act(() => router.navigate(-1));
    expect(await screen.findByRole('alertdialog', { name: '离开这个页面？' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/projects/p1/edit');
    await user.click(screen.getByRole('button', { name: '离开' }));
    expect(await screen.findByRole('heading', { level: 1, name: '项目列表' })).toBeInTheDocument();
  });

  test('改了又改回原来的值：不算有修改', async () => {
    const { router, user } = start('/projects/p1/edit');
    await user.type(field('名称'), '!');
    await user.type(field('名称'), '{Backspace}');
    expect(field('名称')).toHaveValue('官网改版');
    await user.click(screen.getByRole('link', { name: '取消' }));
    expect(await screen.findByRole('heading', { level: 1, name: '项目详情' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/projects/p1');
  });

  test('刷新或关闭页面：只在有修改时提醒', async () => {
    const { user } = start('/projects/p1/edit');
    expect(beforeUnloadPrevented(), '没有修改时不应该提醒').toBe(false);
    await user.type(field('名称'), '!');
    expect(beforeUnloadPrevented(), '有修改时应该调用 preventDefault()').toBe(true);
    await user.type(field('名称'), '{Backspace}');
    expect(beforeUnloadPrevented(), '改回原来的值之后不应该再提醒').toBe(false);
  });

  test('站内链接不让整个页面重新加载', async () => {
    const { user } = start('/projects/p1/edit');
    await user.click(screen.getByRole('link', { name: '取消' }));
    expect(await screen.findByRole('heading', { level: 1, name: '项目详情' })).toBeInTheDocument();
    expect(clicks).toEqual([true]);
  });
});
```
:::

:::hint{level=1}
在渲染时算出三样东西：`const result = validateProject(…)`；`const errors = submitted && !result.ok ? result.errors : {}`；`const dirty = FIELDS.some((f) => draft[f.key] !== initial[f.key])`，其中 `initial = toDraft(original)`。提交时 `setSubmitted(true)`，有错误就用 `FIELDS.find(…)` 找到第一个出错的字段，`document.getElementById(字段名)?.focus()`。
:::

:::hint{level=2}
`const saving = useRef(false)`；`useBlocker(({ currentLocation, nextLocation }) => dirty && !saving.current && currentLocation.pathname !== nextLocation.pathname)`；提交成功时先 `saving.current = true` 再 `onSave(…)`。对话框在 `blocker.state === 'blocked'` 时显示，按钮分别调用 `blocker.reset()` 和 `blocker.proceed()`，“继续编辑”加上 `autoFocus`。`beforeunload` 写在一个依赖 `[dirty]` 的 Effect 中，`dirty` 为 `false` 时直接返回。
:::

:::explanation
表单的状态只有两个：`draft`（输入的内容）和 `submitted`（是否尝试过提交）。错误、是否有修改、提交按钮的文字，都在渲染时从它们和 props 算出来，不需要另外的 state，也就不会互相矛盾。

“有修改”是当前的值和 `toDraft(original)` 的比较。用一个在 `onChange` 中设置的标记，改回原来的值之后它仍然是 `true`，用户会被问一个不必要的问题。

`useBlocker` 拦截 React Router 处理的导航，包括链接和“后退”。它的参数是一个函数，React Router 在每次导航之前调用它；但 React Router 是在 Effect 中更新这个函数的。保存成功时，`onSave` 中的 `navigate` 和提交在同一个事件中执行，新的渲染还没有发生。如果用 `setSaving(true)`，拦截函数看到的仍然是旧的 `false`，刚保存完就会被问“确定要离开吗”。ref 的修改立刻生效，拦截函数在导航时才读取它，所以能看到 `true`。

刷新和关闭页面不经过 React Router，要用 `beforeunload`。只在有修改时监听：这是一个和浏览器窗口同步的 Effect，`dirty` 变化时 React 先运行清理函数，再根据新的值决定是否监听。

替代解：拦截函数用 `useCallback` 包起来（React Router 文档的写法），`beforeunload` 的监听器用 `AbortController` 移除，焦点通过表单的 `elements.namedItem(…)` 找到输入框，标签直接包住输入框。
:::

:::variant{kind=alt name=callback-and-signal}
```tsx file=ProjectForm.tsx
import { useCallback, useEffect, useRef, useState, type SubmitEvent } from 'react';
import { useBlocker, type BlockerFunction } from 'react-router';
import { toDraft, validateProject, type ProjectDraft, type ProjectInput } from './form';
import type { Project } from './model';

type Props = Readonly<{
  /** 正在编辑的项目；新建时是 null */
  original: Project | null;
  projects: readonly Project[];
  today: string;
  onSave: (input: ProjectInput) => void;
}>;

const FIELDS = [
  { key: 'name', label: '名称', type: 'text' },
  { key: 'owner', label: '负责人', type: 'text' },
  { key: 'dueDate', label: '截止日期', type: 'date' },
] as const;

function sameDraft(a: ProjectDraft, b: ProjectDraft): boolean {
  return a.name === b.name && a.owner === b.owner && a.dueDate === b.dueDate;
}

export function ProjectForm({ original, projects, today, onSave }: Props) {
  const [draft, setDraft] = useState<ProjectDraft>(() => toDraft(original));
  const [showErrors, setShowErrors] = useState(false);
  const leaving = useRef(false);

  const result = validateProject(draft, { today, projects, original });
  const changed = !sameDraft(draft, toDraft(original));

  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) => changed && !leaving.current && currentLocation.pathname !== nextLocation.pathname,
    [changed],
  );
  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    if (!changed) return;
    const controller = new AbortController();
    window.addEventListener('beforeunload', (e) => e.preventDefault(), { signal: controller.signal });
    return () => controller.abort();
  }, [changed]);

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (result.ok) {
      leaving.current = true;
      onSave(result.value);
      return;
    }
    setShowErrors(true);
    const { errors } = result;
    const first = FIELDS.find((f) => f.key in errors);
    // 输入框有 name 属性，可以从表单的 elements 中按名字找到
    const input = first && e.currentTarget.elements.namedItem(first.key);
    if (input instanceof HTMLInputElement) input.focus();
  }

  return (
    <form noValidate onSubmit={handleSubmit}>
      {FIELDS.map(({ key, label, type }) => {
        const error = showErrors && !result.ok ? result.errors[key] : undefined;
        const errorId = `${key}-error`;
        return (
          <p key={key}>
            <label>
              {label}{' '}
              <input
                id={key}
                name={key}
                type={type}
                value={draft[key]}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setDraft((d) => ({ ...d, [key]: value }));
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
              />
            </label>
            {error && (
              <>
                {' '}
                <strong id={errorId}>{error}</strong>
              </>
            )}
          </p>
        );
      })}
      <p>
        <button type="submit">{original ? '保存修改' : '创建项目'}</button>
      </p>
      {blocker.state === 'blocked' ? (
        <section role="alertdialog" aria-labelledby="leave-title" aria-describedby="leave-desc">
          <h2 id="leave-title">离开这个页面？</h2>
          <p id="leave-desc">还有没保存的修改，离开之后它们会丢失。</p>
          <button type="button" autoFocus onClick={blocker.reset}>
            继续编辑
          </button>{' '}
          <button type="button" onClick={blocker.proceed}>
            离开
          </button>
        </section>
      ) : null}
    </form>
  );
}
```
:::

:::variant{kind=wrong name=block-save fails=tests reason="用 state 放行保存之后的导航：拦截函数还没更新，刚保存完就被询问"}
```tsx file=ProjectForm.tsx
import { useEffect, useState, type SubmitEvent } from 'react';
import { useBlocker } from 'react-router';
import { toDraft, validateProject, type FieldErrors, type ProjectDraft, type ProjectInput } from './form';
import type { Project } from './model';

type Props = Readonly<{
  /** 正在编辑的项目；新建时是 null */
  original: Project | null;
  projects: readonly Project[];
  today: string;
  onSave: (input: ProjectInput) => void;
}>;

/** 字段的顺序也是出错时寻找第一个错误的顺序 */
const FIELDS = [
  { key: 'name', label: '名称', type: 'text' },
  { key: 'owner', label: '负责人', type: 'text' },
  { key: 'dueDate', label: '截止日期', type: 'date' },
] as const;

export function ProjectForm({ original, projects, today, onSave }: Props) {
  const initial = toDraft(original);
  const [draft, setDraft] = useState<ProjectDraft>(initial);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const result = validateProject(draft, { today, projects, original });
  const errors: FieldErrors = submitted && !result.ok ? result.errors : {};
  // 和初始值比较：改了又改回去，就不算有修改
  const dirty = FIELDS.some((f) => draft[f.key] !== initial[f.key]);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !saving && currentLocation.pathname !== nextLocation.pathname);

  // 刷新、关闭标签页、离开这个网站：只在有未保存的修改时监听
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    if (!result.ok) {
      const first = FIELDS.find((f) => result.errors[f.key] !== undefined);
      if (first !== undefined) document.getElementById(first.key)?.focus();
      return;
    }
    setSaving(true);
    onSave(result.value);
  }

  return (
    <form noValidate onSubmit={handleSubmit}>
      {FIELDS.map((f) => {
        const error = errors[f.key];
        return (
          <div key={f.key}>
            <label htmlFor={f.key}>{f.label}</label>{' '}
            <input
              id={f.key}
              type={f.type}
              value={draft[f.key]}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setDraft((d) => ({ ...d, [f.key]: value }));
              }}
              aria-invalid={error !== undefined}
              aria-describedby={error !== undefined ? `${f.key}-error` : undefined}
            />
            {error !== undefined && <p id={`${f.key}-error`}>{error}</p>}
          </div>
        );
      })}
      <button type="submit">{original === null ? '创建项目' : '保存修改'}</button>
      {blocker.state === 'blocked' && (
        <div role="alertdialog" aria-labelledby="leave-title" aria-describedby="leave-desc">
          <h2 id="leave-title">离开这个页面？</h2>
          <p id="leave-desc">还有没保存的修改，离开之后它们会丢失。</p>
          <button type="button" autoFocus onClick={() => blocker.reset()}>
            继续编辑
          </button>{' '}
          <button type="button" onClick={() => blocker.proceed()}>
            离开
          </button>
        </div>
      )}
    </form>
  );
}
```
:::

:::variant{kind=wrong name=dirty-flag fails=tests reason="用标记记录“改过”：改回原来的值之后仍然被拦截"}
```tsx file=ProjectForm.tsx
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { useBlocker } from 'react-router';
import { toDraft, validateProject, type FieldErrors, type ProjectDraft, type ProjectInput } from './form';
import type { Project } from './model';

type Props = Readonly<{
  /** 正在编辑的项目；新建时是 null */
  original: Project | null;
  projects: readonly Project[];
  today: string;
  onSave: (input: ProjectInput) => void;
}>;

/** 字段的顺序也是出错时寻找第一个错误的顺序 */
const FIELDS = [
  { key: 'name', label: '名称', type: 'text' },
  { key: 'owner', label: '负责人', type: 'text' },
  { key: 'dueDate', label: '截止日期', type: 'date' },
] as const;

export function ProjectForm({ original, projects, today, onSave }: Props) {
  const initial = toDraft(original);
  const [draft, setDraft] = useState<ProjectDraft>(initial);
  const [submitted, setSubmitted] = useState(false);
  // 保存成功之后，接下来的这次导航不要拦截。拦截函数在导航时才读取它，所以用 ref
  const saving = useRef(false);

  const result = validateProject(draft, { today, projects, original });
  const errors: FieldErrors = submitted && !result.ok ? result.errors : {};
  const [dirty, setDirty] = useState(false);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !saving.current && currentLocation.pathname !== nextLocation.pathname);

  // 刷新、关闭标签页、离开这个网站：只在有未保存的修改时监听
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    if (!result.ok) {
      const first = FIELDS.find((f) => result.errors[f.key] !== undefined);
      if (first !== undefined) document.getElementById(first.key)?.focus();
      return;
    }
    saving.current = true;
    onSave(result.value);
  }

  return (
    <form noValidate onSubmit={handleSubmit}>
      {FIELDS.map((f) => {
        const error = errors[f.key];
        return (
          <div key={f.key}>
            <label htmlFor={f.key}>{f.label}</label>{' '}
            <input
              id={f.key}
              type={f.type}
              value={draft[f.key]}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setDraft((d) => ({ ...d, [f.key]: value }));
                setDirty(true);
              }}
              aria-invalid={error !== undefined}
              aria-describedby={error !== undefined ? `${f.key}-error` : undefined}
            />
            {error !== undefined && <p id={`${f.key}-error`}>{error}</p>}
          </div>
        );
      })}
      <button type="submit">{original === null ? '创建项目' : '保存修改'}</button>
      {blocker.state === 'blocked' && (
        <div role="alertdialog" aria-labelledby="leave-title" aria-describedby="leave-desc">
          <h2 id="leave-title">离开这个页面？</h2>
          <p id="leave-desc">还有没保存的修改，离开之后它们会丢失。</p>
          <button type="button" autoFocus onClick={() => blocker.reset()}>
            继续编辑
          </button>{' '}
          <button type="button" onClick={() => blocker.proceed()}>
            离开
          </button>
        </div>
      )}
    </form>
  );
}
```
:::

:::variant{kind=wrong name=always-beforeunload fails=tests reason="一直监听 beforeunload：没有修改时刷新页面也会被询问"}
```tsx file=ProjectForm.tsx
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { useBlocker } from 'react-router';
import { toDraft, validateProject, type FieldErrors, type ProjectDraft, type ProjectInput } from './form';
import type { Project } from './model';

type Props = Readonly<{
  /** 正在编辑的项目；新建时是 null */
  original: Project | null;
  projects: readonly Project[];
  today: string;
  onSave: (input: ProjectInput) => void;
}>;

/** 字段的顺序也是出错时寻找第一个错误的顺序 */
const FIELDS = [
  { key: 'name', label: '名称', type: 'text' },
  { key: 'owner', label: '负责人', type: 'text' },
  { key: 'dueDate', label: '截止日期', type: 'date' },
] as const;

export function ProjectForm({ original, projects, today, onSave }: Props) {
  const initial = toDraft(original);
  const [draft, setDraft] = useState<ProjectDraft>(initial);
  const [submitted, setSubmitted] = useState(false);
  // 保存成功之后，接下来的这次导航不要拦截。拦截函数在导航时才读取它，所以用 ref
  const saving = useRef(false);

  const result = validateProject(draft, { today, projects, original });
  const errors: FieldErrors = submitted && !result.ok ? result.errors : {};
  // 和初始值比较：改了又改回去，就不算有修改
  const dirty = FIELDS.some((f) => draft[f.key] !== initial[f.key]);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !saving.current && currentLocation.pathname !== nextLocation.pathname);

  // 刷新、关闭标签页、离开这个网站：只在有未保存的修改时监听
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    if (!result.ok) {
      const first = FIELDS.find((f) => result.errors[f.key] !== undefined);
      if (first !== undefined) document.getElementById(first.key)?.focus();
      return;
    }
    saving.current = true;
    onSave(result.value);
  }

  return (
    <form noValidate onSubmit={handleSubmit}>
      {FIELDS.map((f) => {
        const error = errors[f.key];
        return (
          <div key={f.key}>
            <label htmlFor={f.key}>{f.label}</label>{' '}
            <input
              id={f.key}
              type={f.type}
              value={draft[f.key]}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setDraft((d) => ({ ...d, [f.key]: value }));
              }}
              aria-invalid={error !== undefined}
              aria-describedby={error !== undefined ? `${f.key}-error` : undefined}
            />
            {error !== undefined && <p id={`${f.key}-error`}>{error}</p>}
          </div>
        );
      })}
      <button type="submit">{original === null ? '创建项目' : '保存修改'}</button>
      {blocker.state === 'blocked' && (
        <div role="alertdialog" aria-labelledby="leave-title" aria-describedby="leave-desc">
          <h2 id="leave-title">离开这个页面？</h2>
          <p id="leave-desc">还有没保存的修改，离开之后它们会丢失。</p>
          <button type="button" autoFocus onClick={() => blocker.reset()}>
            继续编辑
          </button>{' '}
          <button type="button" onClick={() => blocker.proceed()}>
            离开
          </button>
        </div>
      )}
    </form>
  );
}
```
:::

:::variant{kind=wrong name=no-original fails=tests reason="校验时没有传入正在编辑的项目：不做修改也保存不了"}
```tsx file=ProjectForm.tsx
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { useBlocker } from 'react-router';
import { toDraft, validateProject, type FieldErrors, type ProjectDraft, type ProjectInput } from './form';
import type { Project } from './model';

type Props = Readonly<{
  /** 正在编辑的项目；新建时是 null */
  original: Project | null;
  projects: readonly Project[];
  today: string;
  onSave: (input: ProjectInput) => void;
}>;

/** 字段的顺序也是出错时寻找第一个错误的顺序 */
const FIELDS = [
  { key: 'name', label: '名称', type: 'text' },
  { key: 'owner', label: '负责人', type: 'text' },
  { key: 'dueDate', label: '截止日期', type: 'date' },
] as const;

export function ProjectForm({ original, projects, today, onSave }: Props) {
  const initial = toDraft(original);
  const [draft, setDraft] = useState<ProjectDraft>(initial);
  const [submitted, setSubmitted] = useState(false);
  // 保存成功之后，接下来的这次导航不要拦截。拦截函数在导航时才读取它，所以用 ref
  const saving = useRef(false);

  const result = validateProject(draft, { today, projects, original: null });
  const errors: FieldErrors = submitted && !result.ok ? result.errors : {};
  // 和初始值比较：改了又改回去，就不算有修改
  const dirty = FIELDS.some((f) => draft[f.key] !== initial[f.key]);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !saving.current && currentLocation.pathname !== nextLocation.pathname);

  // 刷新、关闭标签页、离开这个网站：只在有未保存的修改时监听
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    if (!result.ok) {
      const first = FIELDS.find((f) => result.errors[f.key] !== undefined);
      if (first !== undefined) document.getElementById(first.key)?.focus();
      return;
    }
    saving.current = true;
    onSave(result.value);
  }

  return (
    <form noValidate onSubmit={handleSubmit}>
      {FIELDS.map((f) => {
        const error = errors[f.key];
        return (
          <div key={f.key}>
            <label htmlFor={f.key}>{f.label}</label>{' '}
            <input
              id={f.key}
              type={f.type}
              value={draft[f.key]}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setDraft((d) => ({ ...d, [f.key]: value }));
              }}
              aria-invalid={error !== undefined}
              aria-describedby={error !== undefined ? `${f.key}-error` : undefined}
            />
            {error !== undefined && <p id={`${f.key}-error`}>{error}</p>}
          </div>
        );
      })}
      <button type="submit">{original === null ? '创建项目' : '保存修改'}</button>
      {blocker.state === 'blocked' && (
        <div role="alertdialog" aria-labelledby="leave-title" aria-describedby="leave-desc">
          <h2 id="leave-title">离开这个页面？</h2>
          <p id="leave-desc">还有没保存的修改，离开之后它们会丢失。</p>
          <button type="button" autoFocus onClick={() => blocker.reset()}>
            继续编辑
          </button>{' '}
          <button type="button" onClick={() => blocker.proceed()}>
            离开
          </button>
        </div>
      )}
    </form>
  );
}
```
:::

:::variant{kind=wrong name=errors-always fails=tests reason="还没提交就显示错误：打开新建页就是一片错误"}
```tsx file=ProjectForm.tsx
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { useBlocker } from 'react-router';
import { toDraft, validateProject, type FieldErrors, type ProjectDraft, type ProjectInput } from './form';
import type { Project } from './model';

type Props = Readonly<{
  /** 正在编辑的项目；新建时是 null */
  original: Project | null;
  projects: readonly Project[];
  today: string;
  onSave: (input: ProjectInput) => void;
}>;

/** 字段的顺序也是出错时寻找第一个错误的顺序 */
const FIELDS = [
  { key: 'name', label: '名称', type: 'text' },
  { key: 'owner', label: '负责人', type: 'text' },
  { key: 'dueDate', label: '截止日期', type: 'date' },
] as const;

export function ProjectForm({ original, projects, today, onSave }: Props) {
  const initial = toDraft(original);
  const [draft, setDraft] = useState<ProjectDraft>(initial);
  const [submitted, setSubmitted] = useState(false);
  // 保存成功之后，接下来的这次导航不要拦截。拦截函数在导航时才读取它，所以用 ref
  const saving = useRef(false);

  const result = validateProject(draft, { today, projects, original });
  const errors: FieldErrors = !result.ok ? result.errors : {};
  // 和初始值比较：改了又改回去，就不算有修改
  const dirty = FIELDS.some((f) => draft[f.key] !== initial[f.key]);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !saving.current && currentLocation.pathname !== nextLocation.pathname);

  // 刷新、关闭标签页、离开这个网站：只在有未保存的修改时监听
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    if (!result.ok) {
      const first = FIELDS.find((f) => result.errors[f.key] !== undefined);
      if (first !== undefined) document.getElementById(first.key)?.focus();
      return;
    }
    saving.current = true;
    onSave(result.value);
  }

  return (
    <form noValidate onSubmit={handleSubmit}>
      {FIELDS.map((f) => {
        const error = errors[f.key];
        return (
          <div key={f.key}>
            <label htmlFor={f.key}>{f.label}</label>{' '}
            <input
              id={f.key}
              type={f.type}
              value={draft[f.key]}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setDraft((d) => ({ ...d, [f.key]: value }));
              }}
              aria-invalid={error !== undefined}
              aria-describedby={error !== undefined ? `${f.key}-error` : undefined}
            />
            {error !== undefined && <p id={`${f.key}-error`}>{error}</p>}
          </div>
        );
      })}
      <button type="submit">{original === null ? '创建项目' : '保存修改'}</button>
      {blocker.state === 'blocked' && (
        <div role="alertdialog" aria-labelledby="leave-title" aria-describedby="leave-desc">
          <h2 id="leave-title">离开这个页面？</h2>
          <p id="leave-desc">还有没保存的修改，离开之后它们会丢失。</p>
          <button type="button" autoFocus onClick={() => blocker.reset()}>
            继续编辑
          </button>{' '}
          <button type="button" onClick={() => blocker.proceed()}>
            离开
          </button>
        </div>
      )}
    </form>
  );
}
```
:::

:::variant{kind=wrong name=no-focus fails=tests reason="提交失败时没有移动焦点：键盘和屏幕阅读器的用户不知道哪里出了错"}
```tsx file=ProjectForm.tsx
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { useBlocker } from 'react-router';
import { toDraft, validateProject, type FieldErrors, type ProjectDraft, type ProjectInput } from './form';
import type { Project } from './model';

type Props = Readonly<{
  /** 正在编辑的项目；新建时是 null */
  original: Project | null;
  projects: readonly Project[];
  today: string;
  onSave: (input: ProjectInput) => void;
}>;

/** 字段的顺序也是出错时寻找第一个错误的顺序 */
const FIELDS = [
  { key: 'name', label: '名称', type: 'text' },
  { key: 'owner', label: '负责人', type: 'text' },
  { key: 'dueDate', label: '截止日期', type: 'date' },
] as const;

export function ProjectForm({ original, projects, today, onSave }: Props) {
  const initial = toDraft(original);
  const [draft, setDraft] = useState<ProjectDraft>(initial);
  const [submitted, setSubmitted] = useState(false);
  // 保存成功之后，接下来的这次导航不要拦截。拦截函数在导航时才读取它，所以用 ref
  const saving = useRef(false);

  const result = validateProject(draft, { today, projects, original });
  const errors: FieldErrors = submitted && !result.ok ? result.errors : {};
  // 和初始值比较：改了又改回去，就不算有修改
  const dirty = FIELDS.some((f) => draft[f.key] !== initial[f.key]);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !saving.current && currentLocation.pathname !== nextLocation.pathname);

  // 刷新、关闭标签页、离开这个网站：只在有未保存的修改时监听
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    if (!result.ok) {
      return;
    }
    saving.current = true;
    onSave(result.value);
  }

  return (
    <form noValidate onSubmit={handleSubmit}>
      {FIELDS.map((f) => {
        const error = errors[f.key];
        return (
          <div key={f.key}>
            <label htmlFor={f.key}>{f.label}</label>{' '}
            <input
              id={f.key}
              type={f.type}
              value={draft[f.key]}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setDraft((d) => ({ ...d, [f.key]: value }));
              }}
              aria-invalid={error !== undefined}
              aria-describedby={error !== undefined ? `${f.key}-error` : undefined}
            />
            {error !== undefined && <p id={`${f.key}-error`}>{error}</p>}
          </div>
        );
      })}
      <button type="submit">{original === null ? '创建项目' : '保存修改'}</button>
      {blocker.state === 'blocked' && (
        <div role="alertdialog" aria-labelledby="leave-title" aria-describedby="leave-desc">
          <h2 id="leave-title">离开这个页面？</h2>
          <p id="leave-desc">还有没保存的修改，离开之后它们会丢失。</p>
          <button type="button" autoFocus onClick={() => blocker.reset()}>
            继续编辑
          </button>{' '}
          <button type="button" onClick={() => blocker.proceed()}>
            离开
          </button>
        </div>
      )}
    </form>
  );
}
```
:::

