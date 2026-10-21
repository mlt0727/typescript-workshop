---
kind: task
mode: ts
title: 类型化的 API 客户端
fixtures: api
timeoutMs: 15000
---
在 `api.ts` 中实现 `request(path, parse, options)` 和 `errorMessage(error)`（类型和用到它们的三个函数已经写好；`model.ts`、`schema.ts` 只读）。

**`request`** 请求 `/api` 加上 `path`，返回 `ApiResult<T>`：

1. 用 `options.method`（默认 `'GET'`）和 `options.signal` 调用 `fetch`。有 `options.body` 时，把它转换成 JSON 作为请求体，并加上请求头 `Content-Type: application/json`；没有时不发请求体；
2. `fetch` 失败：如果 `signal` 已经中止，把原来的错误**继续抛出**；否则是 `{ kind: 'network' }`。读取响应体时被中止也一样：继续抛出；
3. 状态码不在 200–299 之间：
   - 404：`{ kind: 'not-found' }`；
   - 422，并且响应体是 `{ errors: { 字段: 信息 } }`（每个信息都是字符串）：`{ kind: 'invalid', errors }`；
   - 409，并且响应体是 `{ error: 信息 }`（字符串）：`{ kind: 'conflict', message }`；
   - 其他情况（包括格式不对的 409、422）：`{ kind: 'server', status }`；
4. 状态码在 200–299 之间：响应体不是 JSON，或者 `parse(响应体)` 返回 `null`：`{ kind: 'bad-response' }`；否则 `{ ok: true, data }`。

**`errorMessage`** 返回显示给用户的信息：

| 错误 | 信息 |
| --- | --- |
| `network` | `无法连接服务器，请检查网络后重试` |
| `not-found` | `要找的内容不存在` |
| `invalid` | `输入的内容有误：` 加上所有字段的信息，用 `；` 连接 |
| `conflict` | 服务器给出的 `message` |
| `server` | `服务器出错了（500），请稍后重试`（换成实际的状态码） |
| `bad-response` | `服务器返回的数据格式不对` |

这道题的网络请求是模拟的：`/api/projects/p1` 正常，`p9` 是 404，`html` 返回一个网页，`broken` 的数据格式不对，`boom` 是 500，`down` 连接失败，`slow` 要等 3 秒，`slowbody` 的响应头很快到达、响应体要等 3 秒；添加任务时 `p1` 成功，`p2` 是 422，`p3` 是 409，`p4`、`p5`、`p6` 的错误响应格式不对。

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
:::

:::files{role=starter}
```ts file=api.ts
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

/** 请求 /api 之下的 path，用 parse 检查返回的数据 */
export async function request<T>(path: string, parse: (value: unknown) => T | null, options: RequestOptions = {}): Promise<ApiResult<T>> {
  // TODO：发送 body；处理连接失败、中止、错误的状态码、不是 JSON 的响应
  const response = await fetch(`/api${path}`, { method: options.method, signal: options.signal });
  const data = parse(await response.json());
  return data === null ? { ok: false, error: { kind: 'bad-response' } } : { ok: true, data };
}

/** 显示给用户的错误信息 */
export function errorMessage(error: ApiError): string {
  // TODO
  return error.kind;
}

// 下面三个函数已经写好：项目面板用到的接口（p2-04 的编程挑战会用到它们）

export const getProject = (projectId: string, signal?: AbortSignal): Promise<ApiResult<Project>> =>
  request(`/projects/${encodeURIComponent(projectId)}`, parseProject, { signal });

export const addTask = (projectId: string, title: string, signal?: AbortSignal): Promise<ApiResult<Task>> =>
  request(`/projects/${encodeURIComponent(projectId)}/tasks`, parseTask, { method: 'POST', body: { title }, signal });

export const setTaskDone = (projectId: string, taskId: string, done: boolean, signal?: AbortSignal): Promise<ApiResult<Task>> =>
  request(`/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`, parseTask, { method: 'PATCH', body: { done }, signal });
```
```ts file=main.ts
import { addTask, errorMessage, getProject } from './api';

for (const id of ['p1', 'p9', 'html', 'down']) {
  const result = await getProject(id);
  console.log(id, result.ok ? result.data.name : errorMessage(result.error));
}
const added = await addTask('p3', '补充');
console.log(added.ok ? added.data : added.error);
```
:::

:::files{role=solution}
```ts file=api.ts
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
```ts file=main.ts
import { addTask, errorMessage, getProject } from './api';

for (const id of ['p1', 'p9', 'html', 'down']) {
  const result = await getProject(id);
  console.log(id, result.ok ? result.data.name : errorMessage(result.error));
}
const added = await addTask('p3', '补充');
console.log(added.ok ? added.data : added.error);
```
:::

:::files{role=tests}
```ts file=api.test.ts
import { describe, expect, test, vi } from 'vitest';
import { addTask, errorMessage, getProject, request, setTaskDone, type ApiError } from './api';
import { parseProject } from './schema';

describe('成功的请求', () => {
  test('GET：返回检查过的数据', async () => {
    const result = await getProject('p1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.tasks.map((t) => t.title)).toEqual(['整理需求', '设计稿']);
  });

  test('POST、PATCH：方法、JSON 的请求体和 Content-Type', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    await expect(addTask('p1', '写文案')).resolves.toEqual({ ok: true, data: { id: 't3', title: '写文案', done: false } });
    await expect(setTaskDone('p1', 't2', true)).resolves.toEqual({ ok: true, data: { id: 't2', title: '设计稿', done: true } });
    const [url, init] = spy.mock.calls[0] ?? [];
    expect(String(url)).toBe('/api/projects/p1/tasks');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"title":"写文案"}');
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
    const [url2, init2] = spy.mock.calls[1] ?? [];
    expect(String(url2)).toBe('/api/projects/p1/tasks/t2');
    expect(init2?.method).toBe('PATCH');
    expect(init2?.body).toBe('{"done":true}');
  });

  test('GET 不带请求体；把 signal 交给 fetch', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    const controller = new AbortController();
    await getProject('p1', controller.signal);
    const [, init] = spy.mock.calls[0] ?? [];
    expect(init?.body).toBeUndefined();
    expect(new Headers(init?.headers).has('content-type'), '没有请求体时不需要 Content-Type').toBe(false);
    expect(init?.signal).toBe(controller.signal);
  });
});

describe('失败的请求', () => {
  const fail = (error: ApiError) => ({ ok: false, error });

  test('连接失败（传入了 signal、但没有中止时也一样）', async () => {
    await expect(getProject('down')).resolves.toEqual(fail({ kind: 'network' }));
    await expect(getProject('down', new AbortController().signal)).resolves.toEqual(fail({ kind: 'network' }));
  });

  test('404', async () => {
    await expect(getProject('p9')).resolves.toEqual(fail({ kind: 'not-found' }));
    await expect(setTaskDone('p1', 't9', true)).resolves.toEqual(fail({ kind: 'not-found' }));
  });

  test('422：每个字段的错误', async () => {
    await expect(addTask('p2', '很长的任务')).resolves.toEqual(fail({ kind: 'invalid', errors: { title: '任务不能超过 80 个字符' } }));
  });

  test('409：服务器给出的原因', async () => {
    await expect(addTask('p3', '补充')).resolves.toEqual(fail({ kind: 'conflict', message: '已完成的项目不能修改任务' }));
  });

  test('409、422 的响应体格式不对时，当作服务器的错误', async () => {
    await expect(addTask('p4', '补充')).resolves.toEqual(fail({ kind: 'server', status: 422 }));
    await expect(addTask('p5', '补充')).resolves.toEqual(fail({ kind: 'server', status: 409 }));
    await expect(addTask('p6', '补充')).resolves.toEqual(fail({ kind: 'server', status: 422 }));
  });

  test('其他的错误状态码', async () => {
    await expect(getProject('boom')).resolves.toEqual(fail({ kind: 'server', status: 500 }));
    await expect(setTaskDone('p1', 'teapot', true)).resolves.toEqual(fail({ kind: 'server', status: 503 }));
  });

  test('成功的状态码，但数据不对：不是 JSON，或者格式不对', async () => {
    await expect(getProject('html')).resolves.toEqual(fail({ kind: 'bad-response' }));
    await expect(getProject('broken')).resolves.toEqual(fail({ kind: 'bad-response' }));
    await expect(setTaskDone('p1', 'bad', true)).resolves.toEqual(fail({ kind: 'bad-response' }));
    await expect(request('/projects/p1', () => null)).resolves.toEqual(fail({ kind: 'bad-response' }));
  });

  test('被中止的请求不是失败：原来的错误继续抛出', async () => {
    const controller = new AbortController();
    const pending = getProject('slow', controller.signal);
    controller.abort();
    await expect(pending).rejects.toThrow();
    let caught: unknown;
    try {
      await request('/projects/slow', parseProject, { signal: AbortSignal.abort() });
    } catch (error) {
      caught = error;
    }
    expect(caught instanceof DOMException && caught.name === 'AbortError', '应该抛出 AbortError').toBe(true);
  });

  test('读取响应体时被中止：同样继续抛出，而不是当作格式不对的数据', async () => {
    const controller = new AbortController();
    const pending = getProject('slowbody', controller.signal);
    setTimeout(() => controller.abort(), 300);
    await expect(pending).rejects.toThrow();
  });
});

describe('errorMessage', () => {
  test('每一种错误的信息', () => {
    expect(errorMessage({ kind: 'network' })).toBe('无法连接服务器，请检查网络后重试');
    expect(errorMessage({ kind: 'not-found' })).toBe('要找的内容不存在');
    expect(errorMessage({ kind: 'invalid', errors: { title: '任务不能为空', name: '名称太长' } })).toBe('输入的内容有误：任务不能为空；名称太长');
    expect(errorMessage({ kind: 'conflict', message: '已完成的项目不能修改任务' })).toBe('已完成的项目不能修改任务');
    expect(errorMessage({ kind: 'server', status: 502 })).toBe('服务器出错了（502），请稍后重试');
    expect(errorMessage({ kind: 'bad-response' })).toBe('服务器返回的数据格式不对');
  });
});
```
:::

:::hint{level=1}
把 `fetch` 放进 `try`/`catch`，`catch` 中先看 `options.signal?.aborted`。再写一个读 JSON 的小函数：`try { return await response.json(); } catch { return undefined; }`，失败的响应和成功的响应都用它。`errorMessage` 用 `switch (error.kind)`，每个 `case` 中 `error` 都被收窄成对应的那一种。
:::

:::hint{level=2}
请求的选项可以这样写：`{ method, signal, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }) }`。422 的响应体要逐个检查：先确认它是对象、`errors` 也是对象，再用 `Object.entries` 检查每个值都是字符串。
:::

:::explanation
`fetch` 的三种“失败”方式各不相同：连接失败时拒绝；服务器返回错误的状态码时照常返回，只是 `ok` 为 `false`；响应体不是 JSON 时，`json()` 才抛出异常。`request` 把它们全部整理成 `ApiError` 中的一种，调用方只需要处理一个可辨识联合，TypeScript 会检查每一种情况都处理了。

响应体只是“声称”自己的格式：成功的响应用 `parse` 检查，失败的响应也要检查。服务器换了版本、请求被转到了另一个服务，或者框架用默认的错误页面回应时，状态码可能是 422，响应体却不是 `{ errors }`；这时如果相信它，就会把 `undefined` 当作错误信息显示给用户。格式不对的错误响应归为 `server`，至少状态码是可信的。

中止和失败要分开。请求被中止，是因为调用方已经不需要它了，网络并没有问题。在路由的 loader、action 中，React Router 本来就会丢弃被中止的请求的结果；但如果客户端把中止变成 `{ kind: 'network' }`，在其他地方使用它的代码（Effect、重试、错误上报）就会以为连接失败了。继续抛出原来的 `AbortError`，结果的含义才是对的。注意判断的依据是 `signal.aborted`，而不是“有没有传入 signal”：loader 总会传入 signal，真正的连接失败仍然是 `{ kind: 'network' }`。读取响应体的时候也可能被中止，所以读完之后还要再检查一次。

替代解先用 `response.text()` 读出文字再 `JSON.parse`，失败的响应按状态码 `switch`；`errorMessage` 先处理带数据的三种错误，剩下的三种用一张表，表的类型 `Record<typeof error.kind, string>` 正好是收窄之后剩下的三个键。
:::

:::variant{kind=alt name=text-then-parse}
```ts file=api.ts
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

const NOT_JSON = Symbol('不是 JSON');

/** 先读出文字再解析：解析失败时得到 NOT_JSON，而不是异常 */
async function body(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return NOT_JSON;
  }
}

function stringRecord(value: unknown): Record<string, string> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'string') return null;
    result[key] = item;
  }
  return result;
}

function failure(status: number, json: unknown): ApiError {
  const record = typeof json === 'object' && json !== null && !Array.isArray(json) ? Object.fromEntries(Object.entries(json)) : {};
  switch (status) {
    case 404:
      return { kind: 'not-found' };
    case 409:
      return typeof record.error === 'string' ? { kind: 'conflict', message: record.error } : { kind: 'server', status };
    case 422: {
      const errors = stringRecord(record.errors);
      return errors ? { kind: 'invalid', errors } : { kind: 'server', status };
    }
    default:
      return { kind: 'server', status };
  }
}

export async function request<T>(path: string, parse: (value: unknown) => T | null, { method = 'GET', body: payload, signal }: RequestOptions = {}): Promise<ApiResult<T>> {
  const init: RequestInit = { method, signal };
  if (payload !== undefined) {
    init.body = JSON.stringify(payload);
    init.headers = { 'Content-Type': 'application/json' };
  }
  try {
    const response = await fetch(`/api${path}`, init);
    const json = await body(response);
    if (!response.ok) return { ok: false, error: failure(response.status, json) };
    const data = json === NOT_JSON ? null : parse(json);
    return data === null ? { ok: false, error: { kind: 'bad-response' } } : { ok: true, data };
  } catch (error) {
    // 中止（包括读取响应体时被中止）原样抛出；其他的异常都来自网络
    if (signal?.aborted) throw error;
    return { ok: false, error: { kind: 'network' } };
  }
}

/** 显示给用户的错误信息 */
export function errorMessage(error: ApiError): string {
  if (error.kind === 'invalid') return `输入的内容有误：${Object.values(error.errors).join('；')}`;
  if (error.kind === 'conflict') return error.message;
  if (error.kind === 'server') return `服务器出错了（${error.status}），请稍后重试`;
  // 到这里 error 已经收窄为剩下的三种，它们的信息是固定的
  const fixed: Record<typeof error.kind, string> = {
    network: '无法连接服务器，请检查网络后重试',
    'not-found': '要找的内容不存在',
    'bad-response': '服务器返回的数据格式不对',
  };
  return fixed[error.kind];
}

// 下面三个函数已经写好：项目面板用到的接口（p2-04 的编程挑战会用到它们）

export const getProject = (projectId: string, signal?: AbortSignal): Promise<ApiResult<Project>> =>
  request(`/projects/${encodeURIComponent(projectId)}`, parseProject, { signal });

export const addTask = (projectId: string, title: string, signal?: AbortSignal): Promise<ApiResult<Task>> =>
  request(`/projects/${encodeURIComponent(projectId)}/tasks`, parseTask, { method: 'POST', body: { title }, signal });

export const setTaskDone = (projectId: string, taskId: string, done: boolean, signal?: AbortSignal): Promise<ApiResult<Task>> =>
  request(`/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`, parseTask, { method: 'PATCH', body: { done }, signal });
```
```ts file=main.ts
import { addTask, errorMessage, getProject } from './api';

for (const id of ['p1', 'p9', 'html', 'down']) {
  const result = await getProject(id);
  console.log(id, result.ok ? result.data.name : errorMessage(result.error));
}
const added = await addTask('p3', '补充');
console.log(added.ok ? added.data : added.error);
```
:::

:::variant{kind=wrong name=abort-as-network fails=tests reason="中止也当作连接失败：调用方会以为网络出了问题"}
```ts file=api.ts
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
```ts file=main.ts
import { addTask, errorMessage, getProject } from './api';

for (const id of ['p1', 'p9', 'html', 'down']) {
  const result = await getProject(id);
  console.log(id, result.ok ? result.data.name : errorMessage(result.error));
}
const added = await addTask('p3', '补充');
console.log(added.ok ? added.data : added.error);
```
:::

:::variant{kind=wrong name=abort-if-signal fails=tests reason="只要传入了 signal 就继续抛出：loader 中真正的连接失败也变成了异常"}
```ts file=api.ts
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
    if (signal) throw error;
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
```ts file=main.ts
import { addTask, errorMessage, getProject } from './api';

for (const id of ['p1', 'p9', 'html', 'down']) {
  const result = await getProject(id);
  console.log(id, result.ok ? result.data.name : errorMessage(result.error));
}
const added = await addTask('p3', '补充');
console.log(added.ok ? added.data : added.error);
```
:::

:::variant{kind=wrong name=body-abort-ignored fails=tests reason="读取响应体时被中止，被当作了格式不对的数据"}
```ts file=api.ts
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
```ts file=main.ts
import { addTask, errorMessage, getProject } from './api';

for (const id of ['p1', 'p9', 'html', 'down']) {
  const result = await getProject(id);
  console.log(id, result.ok ? result.data.name : errorMessage(result.error));
}
const added = await addTask('p3', '补充');
console.log(added.ok ? added.data : added.error);
```
:::

:::variant{kind=wrong name=no-json-guard fails=tests reason="成功的响应直接调用 json()：服务器返回网页时，整个请求抛出 SyntaxError"}
```ts file=api.ts
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

  const data = parse(await response.json());
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
```ts file=main.ts
import { addTask, errorMessage, getProject } from './api';

for (const id of ['p1', 'p9', 'html', 'down']) {
  const result = await getProject(id);
  console.log(id, result.ok ? result.data.name : errorMessage(result.error));
}
const added = await addTask('p3', '补充');
console.log(added.ok ? added.data : added.error);
```
:::

:::variant{kind=wrong name=unchecked-errors fails=tests reason="没有检查 422 中每个信息的类型：数字也被当成了错误信息"}
```ts file=api.ts
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
    const errors = response.status === 422 && isRecord(json) && isRecord(json.errors) ? Object.fromEntries(Object.entries(json.errors).map(([field, message]) => [field, String(message)])) : null;
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
```ts file=main.ts
import { addTask, errorMessage, getProject } from './api';

for (const id of ['p1', 'p9', 'html', 'down']) {
  const result = await getProject(id);
  console.log(id, result.ok ? result.data.name : errorMessage(result.error));
}
const added = await addTask('p3', '补充');
console.log(added.ok ? added.data : added.error);
```
:::

:::variant{kind=wrong name=status-200 fails=tests reason="只把 200 当作成功：创建任务返回的 201 被当成了错误"}
```ts file=api.ts
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

  if (response.status !== 200) {
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
```ts file=main.ts
import { addTask, errorMessage, getProject } from './api';

for (const id of ['p1', 'p9', 'html', 'down']) {
  const result = await getProject(id);
  console.log(id, result.ok ? result.data.name : errorMessage(result.error));
}
const added = await addTask('p3', '补充');
console.log(added.ok ? added.data : added.error);
```
:::

