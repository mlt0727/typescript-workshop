---
kind: challenge
title: 勾选与添加任务
timeoutMs: 30000
---
`routes.tsx` 中的详情页已经能加载项目、处理“找不到”和加载失败（可以重试）。任务的复选框现在是只读的。完成“写”的部分：

1. **action**：给 `projects/:projectId` 路由加上 `action: projectAction`。表单中的 `intent` 是 `'toggle'` 时，用 `setTaskDone` 修改任务（`taskId`、`done` 两个字段，`done` 是 `'true'` 或 `'false'`）；是 `'add'` 时，用 `addTask` 添加任务（`title` 字段，去掉首尾空白之后为空时**不发请求**，直接当作“任务不能为空”的字段错误）。成功时返回 `data({ ok: true })`；失败时返回带有 4xx 状态码的 `data(…)`，其中有显示给用户的信息（用 `errorMessage`），422 时还要有 `title` 字段的错误；
2. **勾选任务**：每个任务用自己的 `useFetcher()` 提交。复选框的名字（标签）是任务的名称。提交期间显示提交的值（乐观更新）；失败时显示 loader 的数据，并在这个任务的 `<li>` 中用一个 `role="alert"` 的元素说明原因；
3. **添加任务**：列表后面一个表单，输入框的标签是“新任务”，提交按钮是“添加”。提交期间按钮禁用，文字是“添加中…”。字段错误：输入框加上 `aria-invalid="true"`，`aria-describedby` 指向显示错误的元素，输入的内容保留；其他错误：用一个 `role="alert"` 的元素说明。成功之后清空输入框。

`api.ts` 是上一个练习的答案；`fake-server.ts` 是内存中的服务器，测试中每个请求要等 200 毫秒，它拒绝重名的任务（422），已完成的项目（`p3`）不能修改任务（409）。这些文件和 `main.tsx` 都是只读的。

:::files{role=starter}
```tsx file=routes.tsx
import {
  data,
  isRouteErrorResponse,
  Link,
  Navigate,
  Outlet,
  useLoaderData,
  useRevalidator,
  useRouteError,
  type LoaderFunctionArgs,
  type RouteObject,
} from 'react-router';
import { addTask, errorMessage, getProject, setTaskDone } from './api';
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
      <button type="button" disabled={revalidator.state === 'loading'} onClick={() => void revalidator.revalidate()}>
        {revalidator.state === 'loading' ? '正在重试…' : '重试'}
      </button>
    </div>
  );
}

// ---------- 写入 ----------

// TODO：projectAction 处理两种提交（intent 为 toggle、add），调用 setTaskDone、addTask；
//       TaskItem 用 useFetcher 提交勾选（乐观更新），AddTask 用 fetcher.Form 添加任务

function TaskItem({ task }: { task: Task }) {
  return (
    <li>
      <label>
        <input type="checkbox" checked={task.done} readOnly /> {task.title}
      </label>
    </li>
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
    </>
  );
}

function Layout() {
  return (
    <>
      <header>
        <Link to="/projects/p1">官网改版</Link> <Link to="/projects/p3">季度报告</Link>
      </header>
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
        Component: ProjectPage,
        ErrorBoundary: ProjectError,
      },
    ],
  },
];
```
:::

:::files{role=support}
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
    // 被中止不是“连接失败”：交给调用方（例如路由），它知道这次请求已经不需要了
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

:::files{role=solution}
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
      <button type="button" disabled={revalidator.state === 'loading'} onClick={() => void revalidator.revalidate()}>
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
  const busy = fetcher.state !== 'idle';
  const result = fetcher.state === 'idle' ? fetcher.data : undefined;
  const fieldError = result?.ok === false ? result.fieldError : undefined;
  const otherError = result?.ok === false && result.fieldError === undefined ? result.message : undefined;

  // 添加成功之后清空输入框：这是对 DOM 的操作，不是 setState
  useEffect(() => {
    if (result?.ok === true) form.current?.reset();
  }, [result]);

  return (
    <fetcher.Form method="post" ref={form}>
      <input type="hidden" name="intent" value="add" />
      <label htmlFor="title">新任务</label>{' '}
      <input
        id="title"
        name="title"
        aria-invalid={fieldError !== undefined}
        aria-describedby={fieldError !== undefined ? 'title-error' : undefined}
      />{' '}
      <button type="submit" disabled={busy}>
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
  return (
    <>
      <header>
        <Link to="/projects/p1">官网改版</Link> <Link to="/projects/p3">季度报告</Link>
      </header>
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

:::files{role=tests}
```tsx file=routes.test.tsx
import { describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { PROJECTS } from './data';
import { createFakeServer } from './fake-server';
import { routes } from './routes';

/** 每个测试一个新的服务器：数据从 PROJECTS 开始，每个请求 200 毫秒 */
async function open(path: string) {
  const server = createFakeServer(PROJECTS, 200);
  vi.spyOn(globalThis, 'fetch').mockImplementation(server.fetch);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1 });
  return { server, router, user: userEvent.setup() };
}

const checkbox = (name: string) => screen.getByRole('checkbox', { name });
const titleInput = () => screen.getByLabelText('新任务');
const addButton = () => screen.getByRole('button', { name: /^添加/ });
const taskNames = () => within(screen.getByRole('list', { name: '任务' })).getAllByRole('checkbox').map((box) => box.closest('li')?.textContent?.trim());
const writes = (requests: string[]) => requests.filter((r) => !r.startsWith('GET'));

describe('读取（起始代码已经写好）', () => {
  test('显示项目和任务', async () => {
    await open('/projects/p1');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('官网改版');
    expect(screen.getByText(/进度：1\/3/)).toBeInTheDocument();
    expect(checkbox('整理需求')).toBeChecked();
    expect(checkbox('设计稿')).not.toBeChecked();
  });

  test('加载失败时可以重试', async () => {
    const server = createFakeServer(PROJECTS, 50);
    server.offline = true;
    vi.spyOn(globalThis, 'fetch').mockImplementation(server.fetch);
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/projects/p1'] })} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('加载失败：无法连接服务器，请检查网络后重试');
    server.offline = false;
    await userEvent.setup().click(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByRole('heading', { level: 1, name: '官网改版' })).toBeInTheDocument();
  });
});

describe('勾选任务', () => {
  test('立刻显示新的状态（乐观更新），保存之后进度也更新', async () => {
    const { server, user } = await open('/projects/p1');
    await user.click(checkbox('设计稿'));
    // 服务器还没有回应（进度还是 1/3）时，复选框就应该已经勾选了
    await waitFor(() => {
      expect(checkbox('设计稿')).toBeChecked();
      expect(screen.getByText(/进度：1\/3/)).toBeInTheDocument();
    });
    expect(await screen.findByText(/进度：2\/3/)).toBeInTheDocument();
    expect(checkbox('设计稿')).toBeChecked();
    expect(writes(server.requests)).toEqual(['PATCH /api/projects/p1/tasks/t2']);
  });

  test('取消勾选也一样', async () => {
    const { server, user } = await open('/projects/p1');
    await user.click(checkbox('整理需求'));
    await waitFor(() => {
      expect(checkbox('整理需求')).not.toBeChecked();
      expect(screen.getByText(/进度：1\/3/)).toBeInTheDocument();
    });
    expect(await screen.findByText(/进度：0\/3/)).toBeInTheDocument();
    expect(writes(server.requests)).toEqual(['PATCH /api/projects/p1/tasks/t1']);
  });

  test('服务器拒绝时恢复原来的状态，并在这个任务旁边说明原因', async () => {
    const { user } = await open('/projects/p3');
    await user.click(checkbox('汇总数据'));
    await waitFor(() => expect(checkbox('汇总数据'), '提交期间先显示提交的值').not.toBeChecked());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('已完成的项目不能修改任务');
    expect(alert.closest('li'), '错误信息应该显示在这个任务中').toBe(checkbox('汇总数据').closest('li'));
    expect(checkbox('汇总数据')).toBeChecked();
  });

  test('连接失败时也恢复原来的状态', async () => {
    const { server, user } = await open('/projects/p1');
    server.offline = true;
    await user.click(checkbox('设计稿'));
    expect(await screen.findByRole('alert')).toHaveTextContent('无法连接服务器，请检查网络后重试');
    expect(checkbox('设计稿')).not.toBeChecked();
    expect(screen.getByText(/进度：1\/3/)).toBeInTheDocument();
  });
});

describe('添加任务', () => {
  test('添加成功：任务出现在列表最后，输入框清空', async () => {
    const { server, user } = await open('/projects/p1');
    await user.type(titleInput(), ' 联系客户 ');
    await user.click(addButton());
    expect(await screen.findByRole('checkbox', { name: '联系客户' })).not.toBeChecked();
    expect(taskNames().at(-1)).toBe('联系客户');
    await waitFor(() => expect(titleInput()).toHaveValue(''));
    expect(screen.getByText(/进度：1\/4/)).toBeInTheDocument();
    expect(writes(server.requests)).toEqual(['POST /api/projects/p1/tasks']);
  });

  test('提交期间按钮不能再点，不会重复提交', async () => {
    const { server, user } = await open('/projects/p1');
    await user.type(titleInput(), '联系客户');
    await user.click(addButton());
    await waitFor(() => expect(addButton()).toBeDisabled());
    expect(addButton()).toHaveTextContent('添加中…');
    await user.click(addButton());
    await user.type(titleInput(), '{Enter}');
    await screen.findByRole('checkbox', { name: '联系客户' });
    expect(writes(server.requests), '只应该发出一次请求').toEqual(['POST /api/projects/p1/tasks']);
    expect(addButton()).toBeEnabled();
    expect(addButton()).toHaveTextContent('添加');
  });

  test('服务器返回的字段错误显示在输入框旁边，输入的内容保留', async () => {
    const { user } = await open('/projects/p1');
    await user.type(titleInput(), '设计稿');
    await user.click(addButton());
    await waitFor(() => expect(titleInput()).toHaveAttribute('aria-invalid', 'true'));
    expect(titleInput()).toHaveAccessibleDescription('已经有一个叫“设计稿”的任务');
    // 等一会儿：清空输入框的代码（如果有）会在提交结束之后运行
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(titleInput(), '出错之后，输入的内容应该保留').toHaveValue('设计稿');
    await user.clear(titleInput());
    await user.type(titleInput(), '设计稿 2');
    await user.click(addButton());
    expect(await screen.findByRole('checkbox', { name: '设计稿 2' })).toBeInTheDocument();
    expect(titleInput()).not.toHaveAttribute('aria-invalid', 'true');
    expect(titleInput()).not.toHaveAccessibleDescription(/./);
  });

  test('空的任务不发给服务器', async () => {
    const { server, user } = await open('/projects/p1');
    await user.type(titleInput(), '   ');
    await user.click(addButton());
    await waitFor(() => expect(titleInput()).toHaveAccessibleDescription('任务不能为空'));
    expect(writes(server.requests)).toEqual([]);
  });

  test('其他错误（违反业务规则、连接失败）用 role="alert" 显示', async () => {
    const { server, user } = await open('/projects/p3');
    await user.type(titleInput(), '补充');
    await user.click(addButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('已完成的项目不能修改任务');
    expect(titleInput()).toHaveValue('补充');
    expect(titleInput()).not.toHaveAttribute('aria-invalid', 'true');
    server.offline = true;
    await user.click(addButton());
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('无法连接服务器，请检查网络后重试'));
  });
});
```
:::

:::hint{level=1}
action 中 `const form = await request.formData()`，`form.get('intent')` 决定做什么；`form.get(…)` 的类型是 `FormDataEntryValue | null`，用 `typeof … === 'string'` 收窄。任务的组件中 `const fetcher = useFetcher<typeof projectAction>()`，复选框的 `onChange` 调用 `fetcher.submit({ intent: 'toggle', taskId: task.id, done: String(e.currentTarget.checked) }, { method: 'post' })`。
:::

:::hint{level=2}
乐观更新：`const done = fetcher.formData ? fetcher.formData.get('done') === 'true' : task.done`。失败的信息只在 `fetcher.state === 'idle'` 并且 `fetcher.data?.ok === false` 时显示。添加任务用 `<fetcher.Form method="post">`，里面放一个 `<input type="hidden" name="intent" value="add" />`；`const busy = fetcher.state !== 'idle'`。清空输入框：给表单一个 ref，在依赖 `fetcher.data` 的 Effect 中，结果成功时调用 `form.current?.reset()`。
:::

:::explanation
页面上的数据只有一个来源：loader。action 只负责把修改交给服务器，成功之后 React Router 重新运行 loader，新任务、新的进度都来自服务器的最新数据。失败时 action 返回 4xx，数据没有变，React Router 也就不再请求一次。

乐观更新完全是“算出来的”：提交期间 `fetcher.formData` 存在，显示提交的值；提交结束之后它消失，显示的就是 loader 的数据。成功和失败两种情况都不需要额外的代码，复选框就会停在正确的状态上。如果把勾选的状态复制进 `useState`，就要自己记得在失败时改回去，还要在 loader 的数据变化时同步，两份数据迟早会不一致。

`fetcher.state` 在提交期间是 `'submitting'`，action 完成之后、loader 重新运行期间是 `'loading'`，都不是 `'idle'`。按钮在这整段时间都禁用：新任务出现在列表中之前，用户不能再提交一次。

空的任务在 action 中就拦下来：这一步运行在浏览器中，不发请求也能给出结果；服务器仍然会检查（它不能相信任何客户端），这里只是省掉一次没有意义的请求。

替代解用 JSON 提交（`encType: 'application/json'`，action 中 `await request.json()`，正在提交的数据在 `fetcher.json` 中），先用一个解析函数检查提交的内容；添加任务的输入框是受控的，在渲染时根据新的结果清空它，而不是用 Effect。
:::

:::variant{kind=alt name=json-and-controlled}
```tsx file=routes.tsx
import { useState, type SubmitEvent } from 'react';
import {
  data,
  isRouteErrorResponse,
  Link,
  Navigate,
  Outlet,
  useFetcher,
  useLoaderData,
  useRevalidator,
  useRouteError,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type RouteObject,
} from 'react-router';
import { addTask, errorMessage, getProject, setTaskDone, type ApiResult } from './api';
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
      <button type="button" disabled={revalidator.state === 'loading'} onClick={() => void revalidator.revalidate()}>
        {revalidator.state === 'loading' ? '正在重试…' : '重试'}
      </button>
    </div>
  );
}

// ---------- 写入：用 JSON 提交 ----------

type Submission = { intent: 'toggle'; taskId: string; done: boolean } | { intent: 'add'; title: string };
type Outcome = { ok: true } | { ok: false; message: string; field: boolean };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function parseSubmission(value: unknown): Submission | null {
  if (!isRecord(value)) return null;
  if (value.intent === 'toggle' && typeof value.taskId === 'string' && typeof value.done === 'boolean') {
    return { intent: 'toggle', taskId: value.taskId, done: value.done };
  }
  if (value.intent === 'add' && typeof value.title === 'string') return { intent: 'add', title: value.title };
  return null;
}

function outcome<T>(result: ApiResult<T>) {
  if (result.ok) return data<Outcome>({ ok: true });
  const { error } = result;
  const message = error.kind === 'invalid' ? (error.errors.title ?? errorMessage(error)) : errorMessage(error);
  return data<Outcome>({ ok: false, message, field: error.kind === 'invalid' }, { status: error.kind === 'invalid' ? 422 : 400 });
}

export async function projectAction({ params, request }: ActionFunctionArgs) {
  const submission = parseSubmission(await request.json());
  const projectId = params.projectId ?? '';
  if (submission === null) throw data('不认识的提交', { status: 400 });
  if (submission.intent === 'toggle') return outcome(await setTaskDone(projectId, submission.taskId, submission.done, request.signal));
  const title = submission.title.trim();
  if (title === '') return data<Outcome>({ ok: false, message: '任务不能为空', field: true }, { status: 422 });
  return outcome(await addTask(projectId, title, request.signal));
}

function TaskItem({ task }: { task: Task }) {
  const fetcher = useFetcher<typeof projectAction>();
  // JSON 提交时，正在提交的数据在 fetcher.json 中
  const pending = parseSubmission(fetcher.json);
  const done = pending?.intent === 'toggle' ? pending.done : task.done;
  const failure = fetcher.state === 'idle' && fetcher.data?.ok === false ? fetcher.data.message : '';
  return (
    <li>
      <input
        type="checkbox"
        id={`task-${task.id}`}
        checked={done}
        onChange={(e) => void fetcher.submit({ intent: 'toggle', taskId: task.id, done: e.currentTarget.checked }, { method: 'post', encType: 'application/json' })}
      />{' '}
      <label htmlFor={`task-${task.id}`}>{task.title}</label>
      {failure !== '' && (
        <>
          {' '}
          <strong role="alert">{failure}</strong>
        </>
      )}
    </li>
  );
}

function AddTask() {
  const fetcher = useFetcher<typeof projectAction>();
  const [title, setTitle] = useState('');
  const [handled, setHandled] = useState(fetcher.data);
  const busy = fetcher.state !== 'idle';
  const result = busy ? undefined : fetcher.data;
  // 渲染时根据新的结果调整 state：成功之后清空输入框（不需要 Effect）
  if (!busy && fetcher.data !== handled) {
    setHandled(fetcher.data);
    if (fetcher.data?.ok === true) setTitle('');
  }
  const fieldError = result?.ok === false && result.field ? result.message : null;
  const otherError = result?.ok === false && !result.field ? result.message : null;

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    void fetcher.submit({ intent: 'add', title }, { method: 'post', encType: 'application/json' });
  }

  return (
    <form onSubmit={handleSubmit}>
      <p>
        <label>
          新任务{' '}
          <input
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            aria-invalid={fieldError !== null || undefined}
            aria-describedby={fieldError !== null ? 'title-error' : undefined}
          />
        </label>{' '}
        <button type="submit" disabled={busy}>
          {busy ? '添加中…' : '添加'}
        </button>
      </p>
      {fieldError !== null && <p id="title-error">{fieldError}</p>}
      {otherError !== null && <p role="alert">{otherError}</p>}
    </form>
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
  return (
    <>
      <header>
        <Link to="/projects/p1">官网改版</Link> <Link to="/projects/p3">季度报告</Link>
      </header>
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

:::variant{kind=wrong name=no-optimistic fails=tests reason="没有乐观更新：等服务器回应之后复选框才变化，网络慢时用户会以为没点上"}
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
      <button type="button" disabled={revalidator.state === 'loading'} onClick={() => void revalidator.revalidate()}>
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
  const busy = fetcher.state !== 'idle';
  const result = fetcher.state === 'idle' ? fetcher.data : undefined;
  const fieldError = result?.ok === false ? result.fieldError : undefined;
  const otherError = result?.ok === false && result.fieldError === undefined ? result.message : undefined;

  // 添加成功之后清空输入框：这是对 DOM 的操作，不是 setState
  useEffect(() => {
    if (result?.ok === true) form.current?.reset();
  }, [result]);

  return (
    <fetcher.Form method="post" ref={form}>
      <input type="hidden" name="intent" value="add" />
      <label htmlFor="title">新任务</label>{' '}
      <input
        id="title"
        name="title"
        aria-invalid={fieldError !== undefined}
        aria-describedby={fieldError !== undefined ? 'title-error' : undefined}
      />{' '}
      <button type="submit" disabled={busy}>
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
  return (
    <>
      <header>
        <Link to="/projects/p1">官网改版</Link> <Link to="/projects/p3">季度报告</Link>
      </header>
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

:::variant{kind=wrong name=not-disabled fails=tests reason="提交期间按钮仍然可以点：连点两次就添加了两次"}
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
      <button type="button" disabled={revalidator.state === 'loading'} onClick={() => void revalidator.revalidate()}>
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
  const busy = fetcher.state !== 'idle';
  const result = fetcher.state === 'idle' ? fetcher.data : undefined;
  const fieldError = result?.ok === false ? result.fieldError : undefined;
  const otherError = result?.ok === false && result.fieldError === undefined ? result.message : undefined;

  // 添加成功之后清空输入框：这是对 DOM 的操作，不是 setState
  useEffect(() => {
    if (result?.ok === true) form.current?.reset();
  }, [result]);

  return (
    <fetcher.Form method="post" ref={form}>
      <input type="hidden" name="intent" value="add" />
      <label htmlFor="title">新任务</label>{' '}
      <input
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
  return (
    <>
      <header>
        <Link to="/projects/p1">官网改版</Link> <Link to="/projects/p3">季度报告</Link>
      </header>
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

:::variant{kind=wrong name=reset-always fails=tests reason="失败时也清空了输入框：用户要重新输入一遍"}
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
      <button type="button" disabled={revalidator.state === 'loading'} onClick={() => void revalidator.revalidate()}>
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
  const busy = fetcher.state !== 'idle';
  const result = fetcher.state === 'idle' ? fetcher.data : undefined;
  const fieldError = result?.ok === false ? result.fieldError : undefined;
  const otherError = result?.ok === false && result.fieldError === undefined ? result.message : undefined;

  // 添加成功之后清空输入框：这是对 DOM 的操作，不是 setState
  useEffect(() => {
    if (result !== undefined) form.current?.reset();
  }, [result]);

  return (
    <fetcher.Form method="post" ref={form}>
      <input type="hidden" name="intent" value="add" />
      <label htmlFor="title">新任务</label>{' '}
      <input
        id="title"
        name="title"
        aria-invalid={fieldError !== undefined}
        aria-describedby={fieldError !== undefined ? 'title-error' : undefined}
      />{' '}
      <button type="submit" disabled={busy}>
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
  return (
    <>
      <header>
        <Link to="/projects/p1">官网改版</Link> <Link to="/projects/p3">季度报告</Link>
      </header>
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

:::variant{kind=wrong name=send-empty fails=tests reason="空的任务也发给了服务器：多了一次没有意义的请求"}
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
      <button type="button" disabled={revalidator.state === 'loading'} onClick={() => void revalidator.revalidate()}>
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
  const busy = fetcher.state !== 'idle';
  const result = fetcher.state === 'idle' ? fetcher.data : undefined;
  const fieldError = result?.ok === false ? result.fieldError : undefined;
  const otherError = result?.ok === false && result.fieldError === undefined ? result.message : undefined;

  // 添加成功之后清空输入框：这是对 DOM 的操作，不是 setState
  useEffect(() => {
    if (result?.ok === true) form.current?.reset();
  }, [result]);

  return (
    <fetcher.Form method="post" ref={form}>
      <input type="hidden" name="intent" value="add" />
      <label htmlFor="title">新任务</label>{' '}
      <input
        id="title"
        name="title"
        aria-invalid={fieldError !== undefined}
        aria-describedby={fieldError !== undefined ? 'title-error' : undefined}
      />{' '}
      <button type="submit" disabled={busy}>
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
  return (
    <>
      <header>
        <Link to="/projects/p1">官网改版</Link> <Link to="/projects/p3">季度报告</Link>
      </header>
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

:::variant{kind=wrong name=error-as-field fails=tests reason="所有的错误都当作字段错误：项目已完成这样的问题被显示成输入框的错误"}
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
      <button type="button" disabled={revalidator.state === 'loading'} onClick={() => void revalidator.revalidate()}>
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
  const busy = fetcher.state !== 'idle';
  const result = fetcher.state === 'idle' ? fetcher.data : undefined;
  const fieldError = result?.ok === false ? result.fieldError : undefined;
  const otherError = result?.ok === false && result.fieldError === undefined ? result.message : undefined;

  // 添加成功之后清空输入框：这是对 DOM 的操作，不是 setState
  useEffect(() => {
    if (result?.ok === true) form.current?.reset();
  }, [result]);

  return (
    <fetcher.Form method="post" ref={form}>
      <input type="hidden" name="intent" value="add" />
      <label htmlFor="title">新任务</label>{' '}
      <input
        id="title"
        name="title"
        aria-invalid={fieldError !== undefined}
        aria-describedby={fieldError !== undefined ? 'title-error' : undefined}
      />{' '}
      <button type="submit" disabled={busy}>
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
  return (
    <>
      <header>
        <Link to="/projects/p1">官网改版</Link> <Link to="/projects/p3">季度报告</Link>
      </header>
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

