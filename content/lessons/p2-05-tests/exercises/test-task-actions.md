---
kind: challenge
title: 为任务页面写组件测试
grading: tests
timeoutMs: 60000
---
`routes.tsx`（只读）是 p2-04 编程挑战的参考解：项目的详情页，可以勾选、添加任务。在 `routes.test.tsx` 中为它写组件测试。起始代码中的 `open(地址)` 创建一个新的模拟服务器（每个请求 200 毫秒），替换 `fetch`，渲染页面并等待标题出现，返回 `server` 和 `user`。

平台准备了六个写错的 `routes.tsx`，你的测试要发现每一个。要求回顾（p2-04）：

1. 勾选任务时，在服务器回应之前就显示新的状态；成功之后进度更新；服务器拒绝时恢复原来的状态，并在这个任务的 `<li>` 中用 `role="alert"` 说明原因；
2. 添加任务：提交期间“添加”按钮不可用（`aria-disabled`，并忽略提交）；去掉空白之后为空的任务不发请求，直接显示为输入框的错误（可访问描述）；成功之后新任务出现在列表中；违反业务规则（已完成的项目，`p3`）用 `role="alert"` 说明，不算输入框的错误。

可以用的工具：`server.requests`（服务器收到的请求，如 `'POST /api/projects/p1/tasks'`）、`server.offline = true`（之后的请求连接失败）、`screen.findBy…`、`waitFor`。

:::files{role=support}
```tsx file=routes.tsx readonly
import { useEffect, useRef } from 'react';
import {
  data,
  isRouteErrorResponse,
  Link,
  Navigate,
  Outlet,
  useFetcher,
  useLoaderData,
  useNavigation,
  useRevalidator,
  useRouteError,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type RouteObject,
} from 'react-router';
import { addTask, errorMessage, getProject, setTaskDone, type ApiError } from './api';
import { STATUS_NAMES, type Task } from './model';
import { summarize } from './summary';
import { TODAY } from './data';

// ---------- 读取（已经写好） ----------

export async function projectLoader({ params, request }: LoaderFunctionArgs) {
  const result = await getProject(params.projectId ?? '', request.signal);
  if (result.ok) return result.data;
  if (result.error.kind === 'not-found') throw data('没有这个项目', { status: 404 });
  throw new Error(errorMessage(result.error));
}

function ProjectError() {
  const error = useRouteError();
  const revalidator = useRevalidator();
  if (isRouteErrorResponse(error) && error.status === 404) return <h1>没有这个项目</h1>;
  return (
    <div role="alert">
      <p>加载失败：{error instanceof Error ? error.message : '未知的错误'}</p>
      <button
        type="button"
        aria-disabled={revalidator.state === 'loading'}
        onClick={() => {
          // 重新加载期间按钮仍然可以获得焦点（e07），在这里忽略重复的点击
          if (revalidator.state !== 'loading') void revalidator.revalidate();
        }}
      >
        {revalidator.state === 'loading' ? '正在重试…' : '重试'}
      </button>
    </div>
  );
}

// ---------- 写入 ----------

type ActionResult = { ok: true } | { ok: false; message: string; fieldError?: string };

const succeeded = () => data<ActionResult>({ ok: true });

/** 失败时返回 4xx 的状态码：数据没有变，React Router 也就不会重新运行 loader */
const failed = (error: ApiError) =>
  data<ActionResult>(
    { ok: false, message: errorMessage(error), fieldError: error.kind === 'invalid' ? error.errors.title : undefined },
    { status: error.kind === 'invalid' ? 422 : 400 },
  );

export async function projectAction({ params, request }: ActionFunctionArgs) {
  const projectId = params.projectId ?? '';
  const form = await request.formData();
  const intent = form.get('intent');
  if (intent === 'toggle') {
    const taskId = form.get('taskId');
    if (typeof taskId !== 'string') throw data('缺少 taskId', { status: 400 });
    const result = await setTaskDone(projectId, taskId, form.get('done') === 'true', request.signal);
    return result.ok ? succeeded() : failed(result.error);
  }
  if (intent === 'add') {
    const title = form.get('title');
    const text = typeof title === 'string' ? title.trim() : '';
    // 显然不对的输入，不必发给服务器
    if (text === '') return data<ActionResult>({ ok: false, message: '任务不能为空', fieldError: '任务不能为空' }, { status: 422 });
    const result = await addTask(projectId, text, request.signal);
    return result.ok ? succeeded() : failed(result.error);
  }
  throw data('不认识的操作', { status: 400 });
}

function TaskItem({ task }: { task: Task }) {
  const fetcher = useFetcher<typeof projectAction>();
  // 乐观更新：提交还没有完成时，先显示提交的值
  const done = fetcher.formData ? fetcher.formData.get('done') === 'true' : task.done;
  const error = fetcher.state === 'idle' && fetcher.data?.ok === false ? fetcher.data.message : null;
  return (
    <li>
      <label>
        <input
          type="checkbox"
          checked={done}
          onChange={(e) => void fetcher.submit({ intent: 'toggle', taskId: task.id, done: String(e.currentTarget.checked) }, { method: 'post' })}
        />{' '}
        {task.title}
      </label>
      {error !== null && <span role="alert"> {error}</span>}
    </li>
  );
}

function AddTask() {
  const fetcher = useFetcher<typeof projectAction>();
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  // 'submitting'（等待 action）和 'loading'（action 完成之后，等待 loader）都算提交期间
  const busy = fetcher.state !== 'idle';
  const result = fetcher.state === 'idle' ? fetcher.data : undefined;
  const fieldError = result?.ok === false ? result.fieldError : undefined;
  const otherError = result?.ok === false && result.fieldError === undefined ? result.message : undefined;

  // 结果到达之后操作 DOM（不是 setState）：成功时清空输入框；输入有误时把焦点移到输入框，读屏软件会读出它的错误
  useEffect(() => {
    if (result?.ok === true) form.current?.reset();
    else if (result?.ok === false && result.fieldError !== undefined) input.current?.focus();
  }, [result]);

  return (
    <fetcher.Form
      method="post"
      ref={form}
      onSubmit={(e) => {
        // 按钮用 aria-disabled（焦点不会丢失，e07），所以要在这里忽略提交期间的再次提交
        if (busy) e.preventDefault();
      }}
    >
      <input type="hidden" name="intent" value="add" />
      <label htmlFor="title">新任务</label>{' '}
      <input
        ref={input}
        id="title"
        name="title"
        aria-invalid={fieldError !== undefined}
        aria-describedby={fieldError !== undefined ? 'title-error' : undefined}
      />{' '}
      <button type="submit" aria-disabled={busy}>
        {busy ? '添加中…' : '添加'}
      </button>
      {fieldError !== undefined && <p id="title-error">{fieldError}</p>}
      {otherError !== undefined && <p role="alert">{otherError}</p>}
    </fetcher.Form>
  );
}

function ProjectPage() {
  const project = useLoaderData<typeof projectLoader>();
  const s = summarize(project, TODAY);
  return (
    <>
      <h1>{project.name}</h1>
      <p>
        状态：{STATUS_NAMES[project.status]} · 进度：{s.done}/{s.total}
      </p>
      <ul aria-label="任务">
        {project.tasks.map((task) => (
          <TaskItem key={task.id} task={task} />
        ))}
      </ul>
      <AddTask />
    </>
  );
}

function Layout() {
  const navigation = useNavigation();
  return (
    <>
      <header>
        <Link to="/projects/p1">官网改版</Link> <Link to="/projects/p3">季度报告</Link>
      </header>
      {/* 在页面之间切换、等待 loader 时的提示（g14） */}
      <p role="status">{navigation.state === 'loading' ? '正在加载…' : ''}</p>
      <main>
        <Outlet />
      </main>
    </>
  );
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    HydrateFallback: () => <p>正在加载…</p>,
    children: [
      { index: true, element: <Navigate to="/projects/p1" replace /> },
      {
        path: 'projects/:projectId',
        loader: projectLoader,
        action: projectAction,
        Component: ProjectPage,
        ErrorBoundary: ProjectError,
      },
    ],
  },
];
```
```ts file=api.ts readonly
import type { Project, Task } from './model';
import { parseProject, parseTask } from './schema';

/** 一次请求可能失败的几种方式 */
export type ApiError =
  | { kind: 'network' } // 连接失败
  | { kind: 'not-found' } // 404
  | { kind: 'invalid'; errors: Readonly<Record<string, string>> } // 422：输入不对，每个字段的错误
  | { kind: 'conflict'; message: string } // 409：违反了业务规则
  | { kind: 'server'; status: number } // 其他的错误状态码
  | { kind: 'bad-response' }; // 成功了，但返回的不是期望的数据

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export type RequestOptions = { method?: 'GET' | 'POST' | 'PATCH'; body?: unknown; signal?: AbortSignal };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** 读出 JSON；不是 JSON 时返回 undefined */
async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/** 422 的响应体：{ errors: { 字段: 信息 } }，信息都是字符串 */
function fieldErrors(body: unknown): Record<string, string> | null {
  if (!isRecord(body) || !isRecord(body.errors)) return null;
  const errors: Record<string, string> = {};
  for (const [field, message] of Object.entries(body.errors)) {
    if (typeof message !== 'string') return null;
    errors[field] = message;
  }
  return errors;
}

/** 请求 /api 之下的 path，用 parse 检查返回的数据 */
export async function request<T>(path: string, parse: (value: unknown) => T | null, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const { method = 'GET', body, signal } = options;
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      signal,
      ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
    });
  } catch (error) {
    // 被中止不是“连接失败”：调用方已经不需要这次请求了，继续抛出原来的错误
    if (signal?.aborted) throw error;
    return { ok: false, error: { kind: 'network' } };
  }

  if (!response.ok) {
    const json = response.status === 409 || response.status === 422 ? await readJson(response) : undefined;
    if (signal?.aborted) throw signal.reason;
    if (response.status === 404) return { ok: false, error: { kind: 'not-found' } };
    const errors = response.status === 422 ? fieldErrors(json) : null;
    if (errors !== null) return { ok: false, error: { kind: 'invalid', errors } };
    if (response.status === 409 && isRecord(json) && typeof json.error === 'string') return { ok: false, error: { kind: 'conflict', message: json.error } };
    return { ok: false, error: { kind: 'server', status: response.status } };
  }

  const json = await readJson(response);
  if (signal?.aborted) throw signal.reason;
  const data = json === undefined ? null : parse(json);
  return data === null ? { ok: false, error: { kind: 'bad-response' } } : { ok: true, data };
}

/** 显示给用户的错误信息 */
export function errorMessage(error: ApiError): string {
  switch (error.kind) {
    case 'network':
      return '无法连接服务器，请检查网络后重试';
    case 'not-found':
      return '要找的内容不存在';
    case 'invalid':
      return `输入的内容有误：${Object.values(error.errors).join('；')}`;
    case 'conflict':
      return error.message;
    case 'server':
      return `服务器出错了（${error.status}），请稍后重试`;
    case 'bad-response':
      return '服务器返回的数据格式不对';
  }
}

// 下面三个函数已经写好：项目面板用到的接口（p2-04 的编程挑战会用到它们）

export const getProject = (projectId: string, signal?: AbortSignal): Promise<ApiResult<Project>> =>
  request(`/projects/${encodeURIComponent(projectId)}`, parseProject, { signal });

export const addTask = (projectId: string, title: string, signal?: AbortSignal): Promise<ApiResult<Task>> =>
  request(`/projects/${encodeURIComponent(projectId)}/tasks`, parseTask, { method: 'POST', body: { title }, signal });

export const setTaskDone = (projectId: string, taskId: string, done: boolean, signal?: AbortSignal): Promise<ApiResult<Task>> =>
  request(`/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`, parseTask, { method: 'PATCH', body: { done }, signal });
```
```ts file=fake-server.ts readonly
import type { Project, Task } from './model';

/**
 * 一个在内存中运行的“服务器”，实现了这一课的接口，用来代替真正的 fetch：
 *   GET   /api/projects/:projectId
 *   POST  /api/projects/:projectId/tasks           { title }
 *   PATCH /api/projects/:projectId/tasks/:taskId   { done }
 * 预览和测试都用它；p3 会换成真正的服务器。
 */
export type FakeServer = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  /** 收到的请求，例如 'PATCH /api/projects/p1/tasks/t2' */
  requests: string[];
  /** 为 true 时，所有请求都以网络错误失败 */
  offline: boolean;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function wait(ms: number, signal: AbortSignal | null | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      reject(signal.reason);
    });
  });
}

export function createFakeServer(initial: readonly Project[], delayMs = 300): FakeServer {
  let projects = initial;
  let nextId = 100;
  const update = (id: string, change: (p: Project) => Project) => {
    projects = projects.map((p) => (p.id === id ? change(p) : p));
  };

  async function handle(method: string, path: string, body: unknown): Promise<Response> {
    const match = /^\/api\/projects\/([^/]+)(?:\/tasks(?:\/([^/]+))?)?$/.exec(path);
    const project = projects.find((p) => p.id === match?.[1]);
    if (match === null || project === undefined) return json({ error: '没有这个项目' }, 404);
    const taskId = match[2];
    const isTasks = path.endsWith('/tasks') || taskId !== undefined;

    if (method === 'GET' && !isTasks) return json(project);
    if (!isTasks || typeof body !== 'object' || body === null) return json({ error: '不支持的请求' }, 400);
    if (project.status === 'done') return json({ error: '已完成的项目不能修改任务' }, 409);

    if (method === 'POST' && taskId === undefined && 'title' in body && typeof body.title === 'string') {
      const title = body.title.trim();
      if (title === '') return json({ errors: { title: '任务不能为空' } }, 422);
      if ([...title].length > 80) return json({ errors: { title: '任务不能超过 80 个字符' } }, 422);
      if (project.tasks.some((t) => t.title === title)) return json({ errors: { title: `已经有一个叫“${title}”的任务` } }, 422);
      const task: Task = { id: `t${nextId++}`, title, done: false };
      update(project.id, (p) => ({ ...p, tasks: [...p.tasks, task] }));
      return json(task, 201);
    }
    if (method === 'PATCH' && taskId !== undefined && 'done' in body && typeof body.done === 'boolean') {
      const old = project.tasks.find((t) => t.id === taskId);
      if (old === undefined) return json({ error: '没有这个任务' }, 404);
      const task: Task = { ...old, done: body.done };
      update(project.id, (p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === taskId ? task : t)) }));
      return json(task);
    }
    return json({ error: '不支持的请求' }, 400);
  }

  const server: FakeServer = {
    requests: [],
    offline: false,
    async fetch(input, init) {
      const url = new URL(input instanceof Request ? input.url : String(input), 'https://projects.example');
      const method = (init?.method ?? 'GET').toUpperCase();
      server.requests.push(`${method} ${url.pathname}`);
      await wait(delayMs, init?.signal);
      if (server.offline) throw new TypeError('Failed to fetch');
      const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      return handle(method, url.pathname, body);
    },
  };
  return server;
}
```
```ts file=schema.ts readonly
import { STATUSES, type Project, type Task } from './model';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** 服务器返回的一个任务；格式不对时返回 null */
export function parseTask(value: unknown): Task | null {
  if (!isRecord(value)) return null;
  const { id, title, done } = value;
  return typeof id === 'string' && typeof title === 'string' && typeof done === 'boolean' ? { id, title, done } : null;
}

/** 服务器返回的一个项目；格式不对时返回 null */
export function parseProject(value: unknown): Project | null {
  if (!isRecord(value) || !Array.isArray(value.tasks)) return null;
  const { id, name, owner, dueDate } = value;
  const status = STATUSES.find((s) => s === value.status);
  if (typeof id !== 'string' || typeof name !== 'string' || typeof owner !== 'string' || status === undefined) return null;
  if (dueDate !== null && typeof dueDate !== 'string') return null;
  const tasks: Task[] = [];
  for (const item of value.tasks) {
    const task = parseTask(item);
    if (task === null) return null;
    tasks.push(task);
  }
  return { id, name, owner, status, dueDate, tasks };
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
```ts file=data.ts readonly
import type { Project } from './model';

/** 项目的示例数据（p2-04 起，由模拟的服务器从这份数据开始） */
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
import { PROJECTS } from './data';
import { createFakeServer } from './fake-server';
import { routes } from './routes';

// 这个预览没有真正的服务器：用内存中的“服务器”代替 fetch。每个请求等 600 毫秒，方便看到加载和保存的状态
const server = createFakeServer(PROJECTS, 600);
window.fetch = server.fetch;

// 预览运行在沙箱中，只能使用 # 之后的地址；部署到服务器上时用 createBrowserRouter（p2-06）
const router = createHashRouter(routes);

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<RouterProvider router={router} />);
```
:::

:::files{role=starter}
```tsx file=routes.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, test, vi } from 'vitest';
import { PROJECTS } from './data';
import { createFakeServer } from './fake-server';
import { routes } from './routes';

/** 打开一个项目的页面：每个测试一个新的服务器，每个请求 200 毫秒 */
async function open(path: string) {
  const server = createFakeServer(PROJECTS, 200);
  vi.spyOn(globalThis, 'fetch').mockImplementation(server.fetch);
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
  await screen.findByRole('heading', { level: 1 });
  return { server, user: userEvent.setup() };
}

const posts = (requests: string[]) => requests.filter((r) => r.startsWith('POST'));

test('显示项目的任务', async () => {
  await open('/projects/p1');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('官网改版');
  expect(screen.getByRole('checkbox', { name: '整理需求' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: '设计稿' })).not.toBeChecked();
});

// TODO：测试勾选任务（乐观更新、失败时恢复）和添加任务（防止重复提交、空的任务、错误显示的位置）
```
:::

:::files{role=solution}
```tsx file=routes.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, test, vi } from 'vitest';
import { PROJECTS } from './data';
import { createFakeServer } from './fake-server';
import { routes } from './routes';

/** 打开一个项目的页面：每个测试一个新的服务器，每个请求 200 毫秒 */
async function open(path: string) {
  const server = createFakeServer(PROJECTS, 200);
  vi.spyOn(globalThis, 'fetch').mockImplementation(server.fetch);
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
  await screen.findByRole('heading', { level: 1 });
  return { server, user: userEvent.setup() };
}

const posts = (requests: string[]) => requests.filter((r) => r.startsWith('POST'));
/** 按钮不可用：disabled，或者 aria-disabled="true"（e07） */
const unavailable = (button: HTMLElement) => button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true';

describe('勾选任务', () => {
  test('服务器回应之前就显示新的状态，之后进度更新', async () => {
    const { user } = await open('/projects/p1');
    await user.click(screen.getByRole('checkbox', { name: '设计稿' }));
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: '设计稿' })).toBeChecked();
      expect(screen.getByText(/进度：1\/3/)).toBeInTheDocument();
    });
    expect(await screen.findByText(/进度：2\/3/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '设计稿' })).toBeChecked();
  });

  test('服务器拒绝：恢复原来的状态，在任务旁边说明原因', async () => {
    const { user } = await open('/projects/p3');
    const box = screen.getByRole('checkbox', { name: '汇总数据' });
    await user.click(box);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('已完成的项目不能修改任务');
    expect(box.closest('li')).toContainElement(alert);
    expect(screen.getByRole('checkbox', { name: '汇总数据' })).toBeChecked();
  });
});

describe('添加任务', () => {
  test('成功：新任务出现在列表中，进度更新', async () => {
    const { user } = await open('/projects/p1');
    await user.type(screen.getByLabelText('新任务'), '联系客户');
    await user.click(screen.getByRole('button', { name: '添加' }));
    expect(await screen.findByRole('checkbox', { name: '联系客户' })).not.toBeChecked();
    expect(screen.getByText(/进度：1\/4/)).toBeInTheDocument();
  });

  test('提交期间按钮不可用，再点也不会发出第二个请求', async () => {
    const { server, user } = await open('/projects/p1');
    await user.type(screen.getByLabelText('新任务'), '联系客户');
    const button = screen.getByRole('button', { name: '添加' });
    await user.click(button);
    // 按钮的状态在下一次渲染时才变化，等它变成不可用之后再点第二次
    await waitFor(() => expect(unavailable(button)).toBe(true));
    await user.click(button);
    await screen.findByRole('checkbox', { name: '联系客户' });
    expect(posts(server.requests)).toHaveLength(1);
  });

  test('空的任务不发给服务器，显示在输入框旁边', async () => {
    const { server, user } = await open('/projects/p1');
    await user.type(screen.getByLabelText('新任务'), '  ');
    await user.click(screen.getByRole('button', { name: '添加' }));
    await waitFor(() => expect(screen.getByLabelText('新任务')).toHaveAccessibleDescription('任务不能为空'));
    expect(posts(server.requests)).toEqual([]);
  });

  test('违反业务规则：用 alert 说明，不算输入框的错误', async () => {
    const { user } = await open('/projects/p3');
    await user.type(screen.getByLabelText('新任务'), '补充');
    await user.click(screen.getByRole('button', { name: '添加' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('已完成的项目不能修改任务');
    expect(screen.getByLabelText('新任务')).not.toHaveAttribute('aria-invalid', 'true');
  });
});
```
:::

:::mutant{name=no-optimistic hint="没有乐观更新：服务器回应之后复选框才变化。只等复选框被勾选是不够的，要同时检查服务器还没有回应（例如进度还是 1/3）"}
```tsx file=routes.tsx
import { useEffect, useRef } from 'react';
import {
  data,
  isRouteErrorResponse,
  Link,
  Navigate,
  Outlet,
  useFetcher,
  useLoaderData,
  useNavigation,
  useRevalidator,
  useRouteError,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type RouteObject,
} from 'react-router';
import { addTask, errorMessage, getProject, setTaskDone, type ApiError } from './api';
import { STATUS_NAMES, type Task } from './model';
import { summarize } from './summary';
import { TODAY } from './data';

// ---------- 读取（已经写好） ----------

export async function projectLoader({ params, request }: LoaderFunctionArgs) {
  const result = await getProject(params.projectId ?? '', request.signal);
  if (result.ok) return result.data;
  if (result.error.kind === 'not-found') throw data('没有这个项目', { status: 404 });
  throw new Error(errorMessage(result.error));
}

function ProjectError() {
  const error = useRouteError();
  const revalidator = useRevalidator();
  if (isRouteErrorResponse(error) && error.status === 404) return <h1>没有这个项目</h1>;
  return (
    <div role="alert">
      <p>加载失败：{error instanceof Error ? error.message : '未知的错误'}</p>
      <button
        type="button"
        aria-disabled={revalidator.state === 'loading'}
        onClick={() => {
          // 重新加载期间按钮仍然可以获得焦点（e07），在这里忽略重复的点击
          if (revalidator.state !== 'loading') void revalidator.revalidate();
        }}
      >
        {revalidator.state === 'loading' ? '正在重试…' : '重试'}
      </button>
    </div>
  );
}

// ---------- 写入 ----------

type ActionResult = { ok: true } | { ok: false; message: string; fieldError?: string };

const succeeded = () => data<ActionResult>({ ok: true });

/** 失败时返回 4xx 的状态码：数据没有变，React Router 也就不会重新运行 loader */
const failed = (error: ApiError) =>
  data<ActionResult>(
    { ok: false, message: errorMessage(error), fieldError: error.kind === 'invalid' ? error.errors.title : undefined },
    { status: error.kind === 'invalid' ? 422 : 400 },
  );

export async function projectAction({ params, request }: ActionFunctionArgs) {
  const projectId = params.projectId ?? '';
  const form = await request.formData();
  const intent = form.get('intent');
  if (intent === 'toggle') {
    const taskId = form.get('taskId');
    if (typeof taskId !== 'string') throw data('缺少 taskId', { status: 400 });
    const result = await setTaskDone(projectId, taskId, form.get('done') === 'true', request.signal);
    return result.ok ? succeeded() : failed(result.error);
  }
  if (intent === 'add') {
    const title = form.get('title');
    const text = typeof title === 'string' ? title.trim() : '';
    // 显然不对的输入，不必发给服务器
    if (text === '') return data<ActionResult>({ ok: false, message: '任务不能为空', fieldError: '任务不能为空' }, { status: 422 });
    const result = await addTask(projectId, text, request.signal);
    return result.ok ? succeeded() : failed(result.error);
  }
  throw data('不认识的操作', { status: 400 });
}

function TaskItem({ task }: { task: Task }) {
  const fetcher = useFetcher<typeof projectAction>();
  // 乐观更新：提交还没有完成时，先显示提交的值
  const done = task.done;
  const error = fetcher.state === 'idle' && fetcher.data?.ok === false ? fetcher.data.message : null;
  return (
    <li>
      <label>
        <input
          type="checkbox"
          checked={done}
          onChange={(e) => void fetcher.submit({ intent: 'toggle', taskId: task.id, done: String(e.currentTarget.checked) }, { method: 'post' })}
        />{' '}
        {task.title}
      </label>
      {error !== null && <span role="alert"> {error}</span>}
    </li>
  );
}

function AddTask() {
  const fetcher = useFetcher<typeof projectAction>();
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  // 'submitting'（等待 action）和 'loading'（action 完成之后，等待 loader）都算提交期间
  const busy = fetcher.state !== 'idle';
  const result = fetcher.state === 'idle' ? fetcher.data : undefined;
  const fieldError = result?.ok === false ? result.fieldError : undefined;
  const otherError = result?.ok === false && result.fieldError === undefined ? result.message : undefined;

  // 结果到达之后操作 DOM（不是 setState）：成功时清空输入框；输入有误时把焦点移到输入框，读屏软件会读出它的错误
  useEffect(() => {
    if (result?.ok === true) form.current?.reset();
    else if (result?.ok === false && result.fieldError !== undefined) input.current?.focus();
  }, [result]);

  return (
    <fetcher.Form
      method="post"
      ref={form}
      onSubmit={(e) => {
        // 按钮用 aria-disabled（焦点不会丢失，e07），所以要在这里忽略提交期间的再次提交
        if (busy) e.preventDefault();
      }}
    >
      <input type="hidden" name="intent" value="add" />
      <label htmlFor="title">新任务</label>{' '}
      <input
        ref={input}
        id="title"
        name="title"
        aria-invalid={fieldError !== undefined}
        aria-describedby={fieldError !== undefined ? 'title-error' : undefined}
      />{' '}
      <button type="submit" aria-disabled={busy}>
        {busy ? '添加中…' : '添加'}
      </button>
      {fieldError !== undefined && <p id="title-error">{fieldError}</p>}
      {otherError !== undefined && <p role="alert">{otherError}</p>}
    </fetcher.Form>
  );
}

function ProjectPage() {
  const project = useLoaderData<typeof projectLoader>();
  const s = summarize(project, TODAY);
  return (
    <>
      <h1>{project.name}</h1>
      <p>
        状态：{STATUS_NAMES[project.status]} · 进度：{s.done}/{s.total}
      </p>
      <ul aria-label="任务">
        {project.tasks.map((task) => (
          <TaskItem key={task.id} task={task} />
        ))}
      </ul>
      <AddTask />
    </>
  );
}

function Layout() {
  const navigation = useNavigation();
  return (
    <>
      <header>
        <Link to="/projects/p1">官网改版</Link> <Link to="/projects/p3">季度报告</Link>
      </header>
      {/* 在页面之间切换、等待 loader 时的提示（g14） */}
      <p role="status">{navigation.state === 'loading' ? '正在加载…' : ''}</p>
      <main>
        <Outlet />
      </main>
    </>
  );
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    HydrateFallback: () => <p>正在加载…</p>,
    children: [
      { index: true, element: <Navigate to="/projects/p1" replace /> },
      {
        path: 'projects/:projectId',
        loader: projectLoader,
        action: projectAction,
        Component: ProjectPage,
        ErrorBoundary: ProjectError,
      },
    ],
  },
];
```
:::

:::mutant{name=not-disabled hint="提交期间“添加”按钮仍然可用：需要检查提交之后按钮的状态，或者再点一次、数一数服务器收到的请求"}
```tsx file=routes.tsx
import { useEffect, useRef } from 'react';
import {
  data,
  isRouteErrorResponse,
  Link,
  Navigate,
  Outlet,
  useFetcher,
  useLoaderData,
  useNavigation,
  useRevalidator,
  useRouteError,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type RouteObject,
} from 'react-router';
import { addTask, errorMessage, getProject, setTaskDone, type ApiError } from './api';
import { STATUS_NAMES, type Task } from './model';
import { summarize } from './summary';
import { TODAY } from './data';

// ---------- 读取（已经写好） ----------

export async function projectLoader({ params, request }: LoaderFunctionArgs) {
  const result = await getProject(params.projectId ?? '', request.signal);
  if (result.ok) return result.data;
  if (result.error.kind === 'not-found') throw data('没有这个项目', { status: 404 });
  throw new Error(errorMessage(result.error));
}

function ProjectError() {
  const error = useRouteError();
  const revalidator = useRevalidator();
  if (isRouteErrorResponse(error) && error.status === 404) return <h1>没有这个项目</h1>;
  return (
    <div role="alert">
      <p>加载失败：{error instanceof Error ? error.message : '未知的错误'}</p>
      <button
        type="button"
        aria-disabled={revalidator.state === 'loading'}
        onClick={() => {
          // 重新加载期间按钮仍然可以获得焦点（e07），在这里忽略重复的点击
          if (revalidator.state !== 'loading') void revalidator.revalidate();
        }}
      >
        {revalidator.state === 'loading' ? '正在重试…' : '重试'}
      </button>
    </div>
  );
}

// ---------- 写入 ----------

type ActionResult = { ok: true } | { ok: false; message: string; fieldError?: string };

const succeeded = () => data<ActionResult>({ ok: true });

/** 失败时返回 4xx 的状态码：数据没有变，React Router 也就不会重新运行 loader */
const failed = (error: ApiError) =>
  data<ActionResult>(
    { ok: false, message: errorMessage(error), fieldError: error.kind === 'invalid' ? error.errors.title : undefined },
    { status: error.kind === 'invalid' ? 422 : 400 },
  );

export async function projectAction({ params, request }: ActionFunctionArgs) {
  const projectId = params.projectId ?? '';
  const form = await request.formData();
  const intent = form.get('intent');
  if (intent === 'toggle') {
    const taskId = form.get('taskId');
    if (typeof taskId !== 'string') throw data('缺少 taskId', { status: 400 });
    const result = await setTaskDone(projectId, taskId, form.get('done') === 'true', request.signal);
    return result.ok ? succeeded() : failed(result.error);
  }
  if (intent === 'add') {
    const title = form.get('title');
    const text = typeof title === 'string' ? title.trim() : '';
    // 显然不对的输入，不必发给服务器
    if (text === '') return data<ActionResult>({ ok: false, message: '任务不能为空', fieldError: '任务不能为空' }, { status: 422 });
    const result = await addTask(projectId, text, request.signal);
    return result.ok ? succeeded() : failed(result.error);
  }
  throw data('不认识的操作', { status: 400 });
}

function TaskItem({ task }: { task: Task }) {
  const fetcher = useFetcher<typeof projectAction>();
  // 乐观更新：提交还没有完成时，先显示提交的值
  const done = fetcher.formData ? fetcher.formData.get('done') === 'true' : task.done;
  const error = fetcher.state === 'idle' && fetcher.data?.ok === false ? fetcher.data.message : null;
  return (
    <li>
      <label>
        <input
          type="checkbox"
          checked={done}
          onChange={(e) => void fetcher.submit({ intent: 'toggle', taskId: task.id, done: String(e.currentTarget.checked) }, { method: 'post' })}
        />{' '}
        {task.title}
      </label>
      {error !== null && <span role="alert"> {error}</span>}
    </li>
  );
}

function AddTask() {
  const fetcher = useFetcher<typeof projectAction>();
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  // 'submitting'（等待 action）和 'loading'（action 完成之后，等待 loader）都算提交期间
  const busy = fetcher.state !== 'idle';
  const result = fetcher.state === 'idle' ? fetcher.data : undefined;
  const fieldError = result?.ok === false ? result.fieldError : undefined;
  const otherError = result?.ok === false && result.fieldError === undefined ? result.message : undefined;

  // 结果到达之后操作 DOM（不是 setState）：成功时清空输入框；输入有误时把焦点移到输入框，读屏软件会读出它的错误
  useEffect(() => {
    if (result?.ok === true) form.current?.reset();
    else if (result?.ok === false && result.fieldError !== undefined) input.current?.focus();
  }, [result]);

  return (
    <fetcher.Form
      method="post"
      ref={form}
      onSubmit={(e) => {
        // 按钮用 aria-disabled（焦点不会丢失，e07），所以要在这里忽略提交期间的再次提交
      }}
    >
      <input type="hidden" name="intent" value="add" />
      <label htmlFor="title">新任务</label>{' '}
      <input
        ref={input}
        id="title"
        name="title"
        aria-invalid={fieldError !== undefined}
        aria-describedby={fieldError !== undefined ? 'title-error' : undefined}
      />{' '}
      <button type="submit">
        {busy ? '添加中…' : '添加'}
      </button>
      {fieldError !== undefined && <p id="title-error">{fieldError}</p>}
      {otherError !== undefined && <p role="alert">{otherError}</p>}
    </fetcher.Form>
  );
}

function ProjectPage() {
  const project = useLoaderData<typeof projectLoader>();
  const s = summarize(project, TODAY);
  return (
    <>
      <h1>{project.name}</h1>
      <p>
        状态：{STATUS_NAMES[project.status]} · 进度：{s.done}/{s.total}
      </p>
      <ul aria-label="任务">
        {project.tasks.map((task) => (
          <TaskItem key={task.id} task={task} />
        ))}
      </ul>
      <AddTask />
    </>
  );
}

function Layout() {
  const navigation = useNavigation();
  return (
    <>
      <header>
        <Link to="/projects/p1">官网改版</Link> <Link to="/projects/p3">季度报告</Link>
      </header>
      {/* 在页面之间切换、等待 loader 时的提示（g14） */}
      <p role="status">{navigation.state === 'loading' ? '正在加载…' : ''}</p>
      <main>
        <Outlet />
      </main>
    </>
  );
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    HydrateFallback: () => <p>正在加载…</p>,
    children: [
      { index: true, element: <Navigate to="/projects/p1" replace /> },
      {
        path: 'projects/:projectId',
        loader: projectLoader,
        action: projectAction,
        Component: ProjectPage,
        ErrorBoundary: ProjectError,
      },
    ],
  },
];
```
:::

:::mutant{name=send-empty hint="只有空白的任务也发给了服务器：界面上看起来一样（服务器也拒绝了它），需要检查 server.requests"}
```tsx file=routes.tsx
import { useEffect, useRef } from 'react';
import {
  data,
  isRouteErrorResponse,
  Link,
  Navigate,
  Outlet,
  useFetcher,
  useLoaderData,
  useNavigation,
  useRevalidator,
  useRouteError,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type RouteObject,
} from 'react-router';
import { addTask, errorMessage, getProject, setTaskDone, type ApiError } from './api';
import { STATUS_NAMES, type Task } from './model';
import { summarize } from './summary';
import { TODAY } from './data';

// ---------- 读取（已经写好） ----------

export async function projectLoader({ params, request }: LoaderFunctionArgs) {
  const result = await getProject(params.projectId ?? '', request.signal);
  if (result.ok) return result.data;
  if (result.error.kind === 'not-found') throw data('没有这个项目', { status: 404 });
  throw new Error(errorMessage(result.error));
}

function ProjectError() {
  const error = useRouteError();
  const revalidator = useRevalidator();
  if (isRouteErrorResponse(error) && error.status === 404) return <h1>没有这个项目</h1>;
  return (
    <div role="alert">
      <p>加载失败：{error instanceof Error ? error.message : '未知的错误'}</p>
      <button
        type="button"
        aria-disabled={revalidator.state === 'loading'}
        onClick={() => {
          // 重新加载期间按钮仍然可以获得焦点（e07），在这里忽略重复的点击
          if (revalidator.state !== 'loading') void revalidator.revalidate();
        }}
      >
        {revalidator.state === 'loading' ? '正在重试…' : '重试'}
      </button>
    </div>
  );
}

// ---------- 写入 ----------

type ActionResult = { ok: true } | { ok: false; message: string; fieldError?: string };

const succeeded = () => data<ActionResult>({ ok: true });

/** 失败时返回 4xx 的状态码：数据没有变，React Router 也就不会重新运行 loader */
const failed = (error: ApiError) =>
  data<ActionResult>(
    { ok: false, message: errorMessage(error), fieldError: error.kind === 'invalid' ? error.errors.title : undefined },
    { status: error.kind === 'invalid' ? 422 : 400 },
  );

export async function projectAction({ params, request }: ActionFunctionArgs) {
  const projectId = params.projectId ?? '';
  const form = await request.formData();
  const intent = form.get('intent');
  if (intent === 'toggle') {
    const taskId = form.get('taskId');
    if (typeof taskId !== 'string') throw data('缺少 taskId', { status: 400 });
    const result = await setTaskDone(projectId, taskId, form.get('done') === 'true', request.signal);
    return result.ok ? succeeded() : failed(result.error);
  }
  if (intent === 'add') {
    const title = form.get('title');
    const text = typeof title === 'string' ? title.trim() : '';
    // 显然不对的输入，不必发给服务器
    const result = await addTask(projectId, text, request.signal);
    return result.ok ? succeeded() : failed(result.error);
  }
  throw data('不认识的操作', { status: 400 });
}

function TaskItem({ task }: { task: Task }) {
  const fetcher = useFetcher<typeof projectAction>();
  // 乐观更新：提交还没有完成时，先显示提交的值
  const done = fetcher.formData ? fetcher.formData.get('done') === 'true' : task.done;
  const error = fetcher.state === 'idle' && fetcher.data?.ok === false ? fetcher.data.message : null;
  return (
    <li>
      <label>
        <input
          type="checkbox"
          checked={done}
          onChange={(e) => void fetcher.submit({ intent: 'toggle', taskId: task.id, done: String(e.currentTarget.checked) }, { method: 'post' })}
        />{' '}
        {task.title}
      </label>
      {error !== null && <span role="alert"> {error}</span>}
    </li>
  );
}

function AddTask() {
  const fetcher = useFetcher<typeof projectAction>();
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  // 'submitting'（等待 action）和 'loading'（action 完成之后，等待 loader）都算提交期间
  const busy = fetcher.state !== 'idle';
  const result = fetcher.state === 'idle' ? fetcher.data : undefined;
  const fieldError = result?.ok === false ? result.fieldError : undefined;
  const otherError = result?.ok === false && result.fieldError === undefined ? result.message : undefined;

  // 结果到达之后操作 DOM（不是 setState）：成功时清空输入框；输入有误时把焦点移到输入框，读屏软件会读出它的错误
  useEffect(() => {
    if (result?.ok === true) form.current?.reset();
    else if (result?.ok === false && result.fieldError !== undefined) input.current?.focus();
  }, [result]);

  return (
    <fetcher.Form
      method="post"
      ref={form}
      onSubmit={(e) => {
        // 按钮用 aria-disabled（焦点不会丢失，e07），所以要在这里忽略提交期间的再次提交
        if (busy) e.preventDefault();
      }}
    >
      <input type="hidden" name="intent" value="add" />
      <label htmlFor="title">新任务</label>{' '}
      <input
        ref={input}
        id="title"
        name="title"
        aria-invalid={fieldError !== undefined}
        aria-describedby={fieldError !== undefined ? 'title-error' : undefined}
      />{' '}
      <button type="submit" aria-disabled={busy}>
        {busy ? '添加中…' : '添加'}
      </button>
      {fieldError !== undefined && <p id="title-error">{fieldError}</p>}
      {otherError !== undefined && <p role="alert">{otherError}</p>}
    </fetcher.Form>
  );
}

function ProjectPage() {
  const project = useLoaderData<typeof projectLoader>();
  const s = summarize(project, TODAY);
  return (
    <>
      <h1>{project.name}</h1>
      <p>
        状态：{STATUS_NAMES[project.status]} · 进度：{s.done}/{s.total}
      </p>
      <ul aria-label="任务">
        {project.tasks.map((task) => (
          <TaskItem key={task.id} task={task} />
        ))}
      </ul>
      <AddTask />
    </>
  );
}

function Layout() {
  const navigation = useNavigation();
  return (
    <>
      <header>
        <Link to="/projects/p1">官网改版</Link> <Link to="/projects/p3">季度报告</Link>
      </header>
      {/* 在页面之间切换、等待 loader 时的提示（g14） */}
      <p role="status">{navigation.state === 'loading' ? '正在加载…' : ''}</p>
      <main>
        <Outlet />
      </main>
    </>
  );
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    HydrateFallback: () => <p>正在加载…</p>,
    children: [
      { index: true, element: <Navigate to="/projects/p1" replace /> },
      {
        path: 'projects/:projectId',
        loader: projectLoader,
        action: projectAction,
        Component: ProjectPage,
        ErrorBoundary: ProjectError,
      },
    ],
  },
];
```
:::

:::mutant{name=error-as-field hint="违反业务规则的错误被当作输入框的错误：需要在 p3 上添加任务，检查 role=alert，以及输入框没有 aria-invalid"}
```tsx file=routes.tsx
import { useEffect, useRef } from 'react';
import {
  data,
  isRouteErrorResponse,
  Link,
  Navigate,
  Outlet,
  useFetcher,
  useLoaderData,
  useNavigation,
  useRevalidator,
  useRouteError,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type RouteObject,
} from 'react-router';
import { addTask, errorMessage, getProject, setTaskDone, type ApiError } from './api';
import { STATUS_NAMES, type Task } from './model';
import { summarize } from './summary';
import { TODAY } from './data';

// ---------- 读取（已经写好） ----------

export async function projectLoader({ params, request }: LoaderFunctionArgs) {
  const result = await getProject(params.projectId ?? '', request.signal);
  if (result.ok) return result.data;
  if (result.error.kind === 'not-found') throw data('没有这个项目', { status: 404 });
  throw new Error(errorMessage(result.error));
}

function ProjectError() {
  const error = useRouteError();
  const revalidator = useRevalidator();
  if (isRouteErrorResponse(error) && error.status === 404) return <h1>没有这个项目</h1>;
  return (
    <div role="alert">
      <p>加载失败：{error instanceof Error ? error.message : '未知的错误'}</p>
      <button
        type="button"
        aria-disabled={revalidator.state === 'loading'}
        onClick={() => {
          // 重新加载期间按钮仍然可以获得焦点（e07），在这里忽略重复的点击
          if (revalidator.state !== 'loading') void revalidator.revalidate();
        }}
      >
        {revalidator.state === 'loading' ? '正在重试…' : '重试'}
      </button>
    </div>
  );
}

// ---------- 写入 ----------

type ActionResult = { ok: true } | { ok: false; message: string; fieldError?: string };

const succeeded = () => data<ActionResult>({ ok: true });

/** 失败时返回 4xx 的状态码：数据没有变，React Router 也就不会重新运行 loader */
const failed = (error: ApiError) =>
  data<ActionResult>(
    { ok: false, message: errorMessage(error), fieldError: error.kind === 'invalid' ? error.errors.title : errorMessage(error) },
    { status: error.kind === 'invalid' ? 422 : 400 },
  );

export async function projectAction({ params, request }: ActionFunctionArgs) {
  const projectId = params.projectId ?? '';
  const form = await request.formData();
  const intent = form.get('intent');
  if (intent === 'toggle') {
    const taskId = form.get('taskId');
    if (typeof taskId !== 'string') throw data('缺少 taskId', { status: 400 });
    const result = await setTaskDone(projectId, taskId, form.get('done') === 'true', request.signal);
    return result.ok ? succeeded() : failed(result.error);
  }
  if (intent === 'add') {
    const title = form.get('title');
    const text = typeof title === 'string' ? title.trim() : '';
    // 显然不对的输入，不必发给服务器
    if (text === '') return data<ActionResult>({ ok: false, message: '任务不能为空', fieldError: '任务不能为空' }, { status: 422 });
    const result = await addTask(projectId, text, request.signal);
    return result.ok ? succeeded() : failed(result.error);
  }
  throw data('不认识的操作', { status: 400 });
}

function TaskItem({ task }: { task: Task }) {
  const fetcher = useFetcher<typeof projectAction>();
  // 乐观更新：提交还没有完成时，先显示提交的值
  const done = fetcher.formData ? fetcher.formData.get('done') === 'true' : task.done;
  const error = fetcher.state === 'idle' && fetcher.data?.ok === false ? fetcher.data.message : null;
  return (
    <li>
      <label>
        <input
          type="checkbox"
          checked={done}
          onChange={(e) => void fetcher.submit({ intent: 'toggle', taskId: task.id, done: String(e.currentTarget.checked) }, { method: 'post' })}
        />{' '}
        {task.title}
      </label>
      {error !== null && <span role="alert"> {error}</span>}
    </li>
  );
}

function AddTask() {
  const fetcher = useFetcher<typeof projectAction>();
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  // 'submitting'（等待 action）和 'loading'（action 完成之后，等待 loader）都算提交期间
  const busy = fetcher.state !== 'idle';
  const result = fetcher.state === 'idle' ? fetcher.data : undefined;
  const fieldError = result?.ok === false ? result.fieldError : undefined;
  const otherError = result?.ok === false && result.fieldError === undefined ? result.message : undefined;

  // 结果到达之后操作 DOM（不是 setState）：成功时清空输入框；输入有误时把焦点移到输入框，读屏软件会读出它的错误
  useEffect(() => {
    if (result?.ok === true) form.current?.reset();
    else if (result?.ok === false && result.fieldError !== undefined) input.current?.focus();
  }, [result]);

  return (
    <fetcher.Form
      method="post"
      ref={form}
      onSubmit={(e) => {
        // 按钮用 aria-disabled（焦点不会丢失，e07），所以要在这里忽略提交期间的再次提交
        if (busy) e.preventDefault();
      }}
    >
      <input type="hidden" name="intent" value="add" />
      <label htmlFor="title">新任务</label>{' '}
      <input
        ref={input}
        id="title"
        name="title"
        aria-invalid={fieldError !== undefined}
        aria-describedby={fieldError !== undefined ? 'title-error' : undefined}
      />{' '}
      <button type="submit" aria-disabled={busy}>
        {busy ? '添加中…' : '添加'}
      </button>
      {fieldError !== undefined && <p id="title-error">{fieldError}</p>}
      {otherError !== undefined && <p role="alert">{otherError}</p>}
    </fetcher.Form>
  );
}

function ProjectPage() {
  const project = useLoaderData<typeof projectLoader>();
  const s = summarize(project, TODAY);
  return (
    <>
      <h1>{project.name}</h1>
      <p>
        状态：{STATUS_NAMES[project.status]} · 进度：{s.done}/{s.total}
      </p>
      <ul aria-label="任务">
        {project.tasks.map((task) => (
          <TaskItem key={task.id} task={task} />
        ))}
      </ul>
      <AddTask />
    </>
  );
}

function Layout() {
  const navigation = useNavigation();
  return (
    <>
      <header>
        <Link to="/projects/p1">官网改版</Link> <Link to="/projects/p3">季度报告</Link>
      </header>
      {/* 在页面之间切换、等待 loader 时的提示（g14） */}
      <p role="status">{navigation.state === 'loading' ? '正在加载…' : ''}</p>
      <main>
        <Outlet />
      </main>
    </>
  );
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    HydrateFallback: () => <p>正在加载…</p>,
    children: [
      { index: true, element: <Navigate to="/projects/p1" replace /> },
      {
        path: 'projects/:projectId',
        loader: projectLoader,
        action: projectAction,
        Component: ProjectPage,
        ErrorBoundary: ProjectError,
      },
    ],
  },
];
```
:::

:::mutant{name=no-revert hint="勾选的状态被复制进了 state：服务器拒绝之后，复选框没有恢复。需要在 p3 上勾选，等提示出现之后检查复选框"}
```tsx file=routes.tsx
import { useEffect, useRef, useState } from 'react';
import {
  data,
  isRouteErrorResponse,
  Link,
  Navigate,
  Outlet,
  useFetcher,
  useLoaderData,
  useNavigation,
  useRevalidator,
  useRouteError,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type RouteObject,
} from 'react-router';
import { addTask, errorMessage, getProject, setTaskDone, type ApiError } from './api';
import { STATUS_NAMES, type Task } from './model';
import { summarize } from './summary';
import { TODAY } from './data';

// ---------- 读取（已经写好） ----------

export async function projectLoader({ params, request }: LoaderFunctionArgs) {
  const result = await getProject(params.projectId ?? '', request.signal);
  if (result.ok) return result.data;
  if (result.error.kind === 'not-found') throw data('没有这个项目', { status: 404 });
  throw new Error(errorMessage(result.error));
}

function ProjectError() {
  const error = useRouteError();
  const revalidator = useRevalidator();
  if (isRouteErrorResponse(error) && error.status === 404) return <h1>没有这个项目</h1>;
  return (
    <div role="alert">
      <p>加载失败：{error instanceof Error ? error.message : '未知的错误'}</p>
      <button
        type="button"
        aria-disabled={revalidator.state === 'loading'}
        onClick={() => {
          // 重新加载期间按钮仍然可以获得焦点（e07），在这里忽略重复的点击
          if (revalidator.state !== 'loading') void revalidator.revalidate();
        }}
      >
        {revalidator.state === 'loading' ? '正在重试…' : '重试'}
      </button>
    </div>
  );
}

// ---------- 写入 ----------

type ActionResult = { ok: true } | { ok: false; message: string; fieldError?: string };

const succeeded = () => data<ActionResult>({ ok: true });

/** 失败时返回 4xx 的状态码：数据没有变，React Router 也就不会重新运行 loader */
const failed = (error: ApiError) =>
  data<ActionResult>(
    { ok: false, message: errorMessage(error), fieldError: error.kind === 'invalid' ? error.errors.title : undefined },
    { status: error.kind === 'invalid' ? 422 : 400 },
  );

export async function projectAction({ params, request }: ActionFunctionArgs) {
  const projectId = params.projectId ?? '';
  const form = await request.formData();
  const intent = form.get('intent');
  if (intent === 'toggle') {
    const taskId = form.get('taskId');
    if (typeof taskId !== 'string') throw data('缺少 taskId', { status: 400 });
    const result = await setTaskDone(projectId, taskId, form.get('done') === 'true', request.signal);
    return result.ok ? succeeded() : failed(result.error);
  }
  if (intent === 'add') {
    const title = form.get('title');
    const text = typeof title === 'string' ? title.trim() : '';
    // 显然不对的输入，不必发给服务器
    if (text === '') return data<ActionResult>({ ok: false, message: '任务不能为空', fieldError: '任务不能为空' }, { status: 422 });
    const result = await addTask(projectId, text, request.signal);
    return result.ok ? succeeded() : failed(result.error);
  }
  throw data('不认识的操作', { status: 400 });
}

function TaskItem({ task }: { task: Task }) {
  const fetcher = useFetcher<typeof projectAction>();
  // 自己保存勾选的状态：点击之后立刻变化
  const [done, setDone] = useState(task.done);
  const error = fetcher.state === 'idle' && fetcher.data?.ok === false ? fetcher.data.message : null;
  return (
    <li>
      <label>
        <input
          type="checkbox"
          checked={done}
          onChange={(e) => {
            setDone(e.currentTarget.checked);
            void fetcher.submit({ intent: 'toggle', taskId: task.id, done: String(e.currentTarget.checked) }, { method: 'post' });
          }}
        />{' '}
        {task.title}
      </label>
      {error !== null && <span role="alert"> {error}</span>}
    </li>
  );
}

function AddTask() {
  const fetcher = useFetcher<typeof projectAction>();
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  // 'submitting'（等待 action）和 'loading'（action 完成之后，等待 loader）都算提交期间
  const busy = fetcher.state !== 'idle';
  const result = fetcher.state === 'idle' ? fetcher.data : undefined;
  const fieldError = result?.ok === false ? result.fieldError : undefined;
  const otherError = result?.ok === false && result.fieldError === undefined ? result.message : undefined;

  // 结果到达之后操作 DOM（不是 setState）：成功时清空输入框；输入有误时把焦点移到输入框，读屏软件会读出它的错误
  useEffect(() => {
    if (result?.ok === true) form.current?.reset();
    else if (result?.ok === false && result.fieldError !== undefined) input.current?.focus();
  }, [result]);

  return (
    <fetcher.Form
      method="post"
      ref={form}
      onSubmit={(e) => {
        // 按钮用 aria-disabled（焦点不会丢失，e07），所以要在这里忽略提交期间的再次提交
        if (busy) e.preventDefault();
      }}
    >
      <input type="hidden" name="intent" value="add" />
      <label htmlFor="title">新任务</label>{' '}
      <input
        ref={input}
        id="title"
        name="title"
        aria-invalid={fieldError !== undefined}
        aria-describedby={fieldError !== undefined ? 'title-error' : undefined}
      />{' '}
      <button type="submit" aria-disabled={busy}>
        {busy ? '添加中…' : '添加'}
      </button>
      {fieldError !== undefined && <p id="title-error">{fieldError}</p>}
      {otherError !== undefined && <p role="alert">{otherError}</p>}
    </fetcher.Form>
  );
}

function ProjectPage() {
  const project = useLoaderData<typeof projectLoader>();
  const s = summarize(project, TODAY);
  return (
    <>
      <h1>{project.name}</h1>
      <p>
        状态：{STATUS_NAMES[project.status]} · 进度：{s.done}/{s.total}
      </p>
      <ul aria-label="任务">
        {project.tasks.map((task) => (
          <TaskItem key={task.id} task={task} />
        ))}
      </ul>
      <AddTask />
    </>
  );
}

function Layout() {
  const navigation = useNavigation();
  return (
    <>
      <header>
        <Link to="/projects/p1">官网改版</Link> <Link to="/projects/p3">季度报告</Link>
      </header>
      {/* 在页面之间切换、等待 loader 时的提示（g14） */}
      <p role="status">{navigation.state === 'loading' ? '正在加载…' : ''}</p>
      <main>
        <Outlet />
      </main>
    </>
  );
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    HydrateFallback: () => <p>正在加载…</p>,
    children: [
      { index: true, element: <Navigate to="/projects/p1" replace /> },
      {
        path: 'projects/:projectId',
        loader: projectLoader,
        action: projectAction,
        Component: ProjectPage,
        ErrorBoundary: ProjectError,
      },
    ],
  },
];
```
:::

:::mutant{name=no-revalidate hint="提交之后没有重新加载数据：新任务不出现，进度也不变。需要检查成功之后列表和进度的变化"}
```tsx file=routes.tsx
import { useEffect, useRef } from 'react';
import {
  data,
  isRouteErrorResponse,
  Link,
  Navigate,
  Outlet,
  useFetcher,
  useLoaderData,
  useNavigation,
  useRevalidator,
  useRouteError,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type RouteObject,
} from 'react-router';
import { addTask, errorMessage, getProject, setTaskDone, type ApiError } from './api';
import { STATUS_NAMES, type Task } from './model';
import { summarize } from './summary';
import { TODAY } from './data';

// ---------- 读取（已经写好） ----------

export async function projectLoader({ params, request }: LoaderFunctionArgs) {
  const result = await getProject(params.projectId ?? '', request.signal);
  if (result.ok) return result.data;
  if (result.error.kind === 'not-found') throw data('没有这个项目', { status: 404 });
  throw new Error(errorMessage(result.error));
}

function ProjectError() {
  const error = useRouteError();
  const revalidator = useRevalidator();
  if (isRouteErrorResponse(error) && error.status === 404) return <h1>没有这个项目</h1>;
  return (
    <div role="alert">
      <p>加载失败：{error instanceof Error ? error.message : '未知的错误'}</p>
      <button
        type="button"
        aria-disabled={revalidator.state === 'loading'}
        onClick={() => {
          // 重新加载期间按钮仍然可以获得焦点（e07），在这里忽略重复的点击
          if (revalidator.state !== 'loading') void revalidator.revalidate();
        }}
      >
        {revalidator.state === 'loading' ? '正在重试…' : '重试'}
      </button>
    </div>
  );
}

// ---------- 写入 ----------

type ActionResult = { ok: true } | { ok: false; message: string; fieldError?: string };

const succeeded = () => data<ActionResult>({ ok: true });

/** 失败时返回 4xx 的状态码：数据没有变，React Router 也就不会重新运行 loader */
const failed = (error: ApiError) =>
  data<ActionResult>(
    { ok: false, message: errorMessage(error), fieldError: error.kind === 'invalid' ? error.errors.title : undefined },
    { status: error.kind === 'invalid' ? 422 : 400 },
  );

export async function projectAction({ params, request }: ActionFunctionArgs) {
  const projectId = params.projectId ?? '';
  const form = await request.formData();
  const intent = form.get('intent');
  if (intent === 'toggle') {
    const taskId = form.get('taskId');
    if (typeof taskId !== 'string') throw data('缺少 taskId', { status: 400 });
    const result = await setTaskDone(projectId, taskId, form.get('done') === 'true', request.signal);
    return result.ok ? succeeded() : failed(result.error);
  }
  if (intent === 'add') {
    const title = form.get('title');
    const text = typeof title === 'string' ? title.trim() : '';
    // 显然不对的输入，不必发给服务器
    if (text === '') return data<ActionResult>({ ok: false, message: '任务不能为空', fieldError: '任务不能为空' }, { status: 422 });
    const result = await addTask(projectId, text, request.signal);
    return result.ok ? succeeded() : failed(result.error);
  }
  throw data('不认识的操作', { status: 400 });
}

function TaskItem({ task }: { task: Task }) {
  const fetcher = useFetcher<typeof projectAction>();
  // 乐观更新：提交还没有完成时，先显示提交的值
  const done = fetcher.formData ? fetcher.formData.get('done') === 'true' : task.done;
  const error = fetcher.state === 'idle' && fetcher.data?.ok === false ? fetcher.data.message : null;
  return (
    <li>
      <label>
        <input
          type="checkbox"
          checked={done}
          onChange={(e) => void fetcher.submit({ intent: 'toggle', taskId: task.id, done: String(e.currentTarget.checked) }, { method: 'post' })}
        />{' '}
        {task.title}
      </label>
      {error !== null && <span role="alert"> {error}</span>}
    </li>
  );
}

function AddTask() {
  const fetcher = useFetcher<typeof projectAction>();
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  // 'submitting'（等待 action）和 'loading'（action 完成之后，等待 loader）都算提交期间
  const busy = fetcher.state !== 'idle';
  const result = fetcher.state === 'idle' ? fetcher.data : undefined;
  const fieldError = result?.ok === false ? result.fieldError : undefined;
  const otherError = result?.ok === false && result.fieldError === undefined ? result.message : undefined;

  // 结果到达之后操作 DOM（不是 setState）：成功时清空输入框；输入有误时把焦点移到输入框，读屏软件会读出它的错误
  useEffect(() => {
    if (result?.ok === true) form.current?.reset();
    else if (result?.ok === false && result.fieldError !== undefined) input.current?.focus();
  }, [result]);

  return (
    <fetcher.Form
      method="post"
      ref={form}
      onSubmit={(e) => {
        // 按钮用 aria-disabled（焦点不会丢失，e07），所以要在这里忽略提交期间的再次提交
        if (busy) e.preventDefault();
      }}
    >
      <input type="hidden" name="intent" value="add" />
      <label htmlFor="title">新任务</label>{' '}
      <input
        ref={input}
        id="title"
        name="title"
        aria-invalid={fieldError !== undefined}
        aria-describedby={fieldError !== undefined ? 'title-error' : undefined}
      />{' '}
      <button type="submit" aria-disabled={busy}>
        {busy ? '添加中…' : '添加'}
      </button>
      {fieldError !== undefined && <p id="title-error">{fieldError}</p>}
      {otherError !== undefined && <p role="alert">{otherError}</p>}
    </fetcher.Form>
  );
}

function ProjectPage() {
  const project = useLoaderData<typeof projectLoader>();
  const s = summarize(project, TODAY);
  return (
    <>
      <h1>{project.name}</h1>
      <p>
        状态：{STATUS_NAMES[project.status]} · 进度：{s.done}/{s.total}
      </p>
      <ul aria-label="任务">
        {project.tasks.map((task) => (
          <TaskItem key={task.id} task={task} />
        ))}
      </ul>
      <AddTask />
    </>
  );
}

function Layout() {
  const navigation = useNavigation();
  return (
    <>
      <header>
        <Link to="/projects/p1">官网改版</Link> <Link to="/projects/p3">季度报告</Link>
      </header>
      {/* 在页面之间切换、等待 loader 时的提示（g14） */}
      <p role="status">{navigation.state === 'loading' ? '正在加载…' : ''}</p>
      <main>
        <Outlet />
      </main>
    </>
  );
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    HydrateFallback: () => <p>正在加载…</p>,
    children: [
      { index: true, element: <Navigate to="/projects/p1" replace /> },
      {
        path: 'projects/:projectId',
        loader: projectLoader,
        action: projectAction,
        Component: ProjectPage,
        ErrorBoundary: ProjectError,
        // 提交之后不重新加载数据
        shouldRevalidate: ({ formMethod, defaultShouldRevalidate }) => (formMethod === undefined ? defaultShouldRevalidate : false),
      },
    ],
  },
];
```
:::

:::hint{level=1}
每个要求写一个测试。乐观更新：点击之后 `await waitFor(() => { expect(复选框).toBeChecked(); expect(screen.getByText(/进度：1\/3/)).toBeInTheDocument(); })`。失败的情况用 `p3`（已完成的项目）：勾选、添加都会被服务器拒绝。
:::

:::hint{level=2}
请求的数量：`server.requests.filter((r) => r.startsWith('POST'))`。不可用：按钮用的是 `aria-disabled`，点击之后 `await waitFor(() => expect(按钮).toHaveAttribute('aria-disabled', 'true'))`，再点一次、数一数请求。错误的位置：`expect(复选框.closest('li')).toContainElement(await screen.findByRole('alert'))`；输入框的错误：`toHaveAccessibleDescription('任务不能为空')`，以及 `not.toHaveAttribute('aria-invalid', 'true')`。
:::

:::explanation
这六个变异体中，有一半用“看起来对不对”是发现不了的：

- `send-empty`：服务器也会拒绝空的任务，界面上显示的错误一模一样。只有数一数请求，才知道它多发了一次；
- `no-optimistic`：最终的结果完全正确，差别只在“服务器回应之前”的那 200 毫秒。测试要在那段时间里检查，所以要同时断言一个“服务器还没回应”的标志；
- `not-disabled`：按钮在提交期间可以点，但如果测试只点一次，一切正常。

另外三个是失败和成功之后的状态：`no-revert` 在服务器拒绝之后停在了错误的状态，`error-as-field` 把错误显示在了错误的位置，`no-revalidate` 在成功之后没有显示新的数据。只测“点一下，结果对了”的测试会漏掉它们，见错误解 `success-only`。

替代解用键盘操作（空格勾选、回车提交），用 `within(li)` 在一个任务的范围内查找，三个测试各覆盖一条完整的路径。

这些测试不依赖固定的等待时间：`findBy`、`waitFor` 在条件成立时立刻继续，最多等 1 秒。模拟服务器的 200 毫秒延迟是为了让“提交期间”的状态持续一段时间，测试可以观察到它。
:::

:::variant{kind=alt name=keyboard-and-within}
```tsx file=routes.test.tsx
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { expect, test, vi } from 'vitest';
import { PROJECTS } from './data';
import { createFakeServer } from './fake-server';
import { routes } from './routes';

/** 打开一个项目的页面：每个测试一个新的服务器，每个请求 200 毫秒 */
async function open(path: string) {
  const server = createFakeServer(PROJECTS, 200);
  vi.spyOn(globalThis, 'fetch').mockImplementation(server.fetch);
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
  await screen.findByRole('heading', { level: 1 });
  return { server, user: userEvent.setup() };
}

const writes = (requests: string[]) => requests.filter((r) => !r.startsWith('GET'));
const progress = () => screen.getByText(/进度：/).textContent?.replace(/\s/g, '');

test('用键盘勾选：先显示新的状态，再等服务器保存', async () => {
  const { server, user } = await open('/projects/p1');
  screen.getByRole('checkbox', { name: '写文案' }).focus();
  await user.keyboard(' ');
  await waitFor(() => {
    expect(screen.getByRole('checkbox', { name: '写文案' })).toBeChecked();
    expect(writes(server.requests)).toHaveLength(1);
    expect(progress()).toContain('1/3');
  });
  await waitFor(() => expect(progress()).toContain('2/3'));
});

test('已完成的项目：勾选、添加都被拒绝，界面回到服务器上的数据', async () => {
  const { user } = await open('/projects/p3');
  const item = screen.getByRole('checkbox', { name: '汇总数据' }).closest('li');
  if (item === null) throw new Error('任务应该在 li 中');
  await user.click(within(item).getByRole('checkbox'));
  expect(await within(item).findByRole('alert')).toHaveTextContent('已完成');
  expect(within(item).getByRole('checkbox')).toBeChecked();

  await user.type(screen.getByLabelText('新任务'), '补充{Enter}');
  await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));
  expect(screen.getByLabelText('新任务')).not.toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText('新任务')).toHaveValue('补充');
});

test('添加：空白不发请求；提交期间不可用；成功后出现在列表中', async () => {
  const { server, user } = await open('/projects/p1');
  const input = screen.getByLabelText('新任务');
  await user.type(input, ' {Enter}');
  await waitFor(() => expect(input).toBeInvalid());
  expect(writes(server.requests)).toEqual([]);

  await user.clear(input);
  await user.type(input, '联系客户{Enter}');
  await waitFor(() => expect(screen.getByRole('button', { name: /添加/ })).toHaveAttribute('aria-disabled', 'true'));
  await user.type(input, '{Enter}');
  expect(await screen.findByRole('checkbox', { name: '联系客户' })).toBeInTheDocument();
  expect(writes(server.requests)).toEqual(['POST /api/projects/p1/tasks']);
  expect(progress()).toContain('1/4');
});
```
:::

:::variant{kind=wrong name=success-only fails=mutants misses=no-optimistic,not-disabled,send-empty,error-as-field,no-revert reason="只测了成功的情况：勾选一个任务、添加一个任务，结果都对。失败、空的输入、提交期间的状态都没有测"}
```tsx file=routes.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, test, vi } from 'vitest';
import { PROJECTS } from './data';
import { createFakeServer } from './fake-server';
import { routes } from './routes';

/** 打开一个项目的页面：每个测试一个新的服务器，每个请求 200 毫秒 */
async function open(path: string) {
  const server = createFakeServer(PROJECTS, 200);
  vi.spyOn(globalThis, 'fetch').mockImplementation(server.fetch);
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
  await screen.findByRole('heading', { level: 1 });
  return { server, user: userEvent.setup() };
}

const posts = (requests: string[]) => requests.filter((r) => r.startsWith('POST'));

test('勾选任务，进度更新', async () => {
  const { user } = await open('/projects/p1');
  await user.click(screen.getByRole('checkbox', { name: '设计稿' }));
  expect(await screen.findByText(/进度：2\/3/)).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: '设计稿' })).toBeChecked();
});

test('添加任务', async () => {
  const { user } = await open('/projects/p1');
  await user.type(screen.getByLabelText('新任务'), '联系客户');
  await user.click(screen.getByRole('button', { name: '添加' }));
  expect(await screen.findByRole('checkbox', { name: '联系客户' })).toBeInTheDocument();
});
```
:::

:::variant{kind=wrong name=expects-no-revert fails=tests reason="期望服务器拒绝之后复选框保持点击后的状态：界面应该显示服务器上的数据，测试本身写错了"}
```tsx file=routes.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, test, vi } from 'vitest';
import { PROJECTS } from './data';
import { createFakeServer } from './fake-server';
import { routes } from './routes';

/** 打开一个项目的页面：每个测试一个新的服务器，每个请求 200 毫秒 */
async function open(path: string) {
  const server = createFakeServer(PROJECTS, 200);
  vi.spyOn(globalThis, 'fetch').mockImplementation(server.fetch);
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
  await screen.findByRole('heading', { level: 1 });
  return { server, user: userEvent.setup() };
}

const posts = (requests: string[]) => requests.filter((r) => r.startsWith('POST'));

test('服务器拒绝之后，复选框保持点击之后的状态', async () => {
  const { user } = await open('/projects/p3');
  await user.click(screen.getByRole('checkbox', { name: '汇总数据' }));
  await screen.findByRole('alert');
  // 错误的期望：服务器没有保存这次修改，界面应该显示服务器上的数据
  expect(screen.getByRole('checkbox', { name: '汇总数据' })).not.toBeChecked();
});
```
:::

