---
kind: task
title: 添加任务的接口
---
在 `tasks.ts` 中实现 `addTask(request, projectId, store, deps)`：`POST /api/projects/:projectId/tasks` 的处理函数，请求体是 `{ "title": "…" }`。它返回一个 `Response`；所有的响应体都是 JSON（例如用 `Response.json`）。`store` 和 `deps` 的类型见只读的 `store.ts`。

按顺序检查，遇到第一个问题就返回：

1. `Content-Type` 的媒体类型（`;` 之前的部分，去掉空白、不分大小写）不是 `application/json`：415，`{ "error": "请求体必须是 JSON" }`；
2. 请求体不是合法的 JSON：400，`{ "error": "请求体不是合法的 JSON" }`；
3. `store.get(projectId)` 是 `null`，或者项目已经删除：404，`{ "error": "没有这个项目" }`；
4. 请求体不是对象（`typeof` 不是 `'object'`，或者是 `null`）：400，`{ "error": "不支持的请求" }`；
5. 项目的状态是 `'done'`：409，`{ "error": "已完成的项目不能修改任务" }`；
6. 请求体中没有字符串类型的 `title`：400，`{ "error": "不支持的请求" }`；
7. `title` 去掉首尾的空白之后：为空是 `任务不能为空`；超过 80 个字符（按码位）是 `任务不能超过 80 个字符`；和一个没有删除的任务同名是 `已经有一个叫“上线”的任务`（换成实际的标题）。都是 422，`{ "errors": { "title": "…" } }`；
8. 创建任务：`id` 是 `deps.newId()`，`done` 是 `false`，`position` 比所有任务（包括删除了的）的最大值大 1（没有任务时是 1），`createdAt` 是 `deps.now()`，`deletedAt` 是 `null`。新的项目是原来的项目加上这个任务（放在最后），`version` 加 1，`updatedAt` 是同一个 `deps.now()`。用 `store.replace(新的项目, 原来的 version)` 写入；
9. 写入成功：201，响应体是 `{ id, title, done }`，响应头 `Location` 是 `/api/projects/{projectId}/tasks/{任务的 id}`；
10. `replace` 返回 `false`（读取之后别人修改了项目）：从第 3 步开始重新做（重新读取，重新检查）。一共最多做 3 次，都失败时返回 503，`{ "error": "项目正在被频繁修改，请稍后重试" }`，响应头 `Retry-After: 1`。

:::files{role=support}
```ts file=model.ts readonly
/** 项目的三种状态：计划中、进行中、已完成（和项目 2 一样） */
export const STATUSES = ['planning', 'active', 'done'] as const;
export type ProjectStatus = (typeof STATUSES)[number];

export const STATUS_NAMES: Readonly<Record<ProjectStatus, string>> = { planning: '计划中', active: '进行中', done: '已完成' };

/** 状态的转换表（p2-01）：每种状态可以改为哪些状态 */
export const TRANSITIONS: Readonly<Record<ProjectStatus, readonly ProjectStatus[]>> = {
  planning: ['active'],
  active: ['planning', 'done'],
  done: ['active'],
};

/** 发给客户端的数据：和项目 2 的 Project 一样，多了 version 和 updatedAt */
export type TaskDto = Readonly<{ id: string; title: string; done: boolean }>;
export type ProjectDto = Readonly<{
  id: string;
  name: string;
  owner: string;
  status: ProjectStatus;
  /** 截止日期，格式是 YYYY-MM-DD；没有截止日期时是 null */
  dueDate: string | null;
  tasks: readonly TaskDto[];
  /** 每次修改加 1，用来发现并发的修改（p3-02） */
  version: number;
  updatedAt: string;
}>;

/** 服务器保存的数据：有一些字段从不发给客户端 */
export type StoredTask = Readonly<{
  id: string;
  title: string;
  done: boolean;
  /** 任务在清单中的顺序，从小到大 */
  position: number;
  createdAt: string;
  /** 删除的时间；没有删除时是 null（软删除） */
  deletedAt: string | null;
}>;

export type StoredProject = Readonly<{
  id: string;
  name: string;
  owner: string;
  /** 负责人的邮箱：服务器根据负责人查出来，只用来发通知，不公开 */
  ownerEmail: string;
  status: ProjectStatus;
  dueDate: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  tasks: readonly StoredTask[];
}>;
```
```ts file=store.ts readonly
import type { StoredProject } from './model';

/** 服务器保存项目的地方。p3-02 用内存中的实现，p3-03 换成 SQLite */
export type ProjectStore = {
  get(id: string): Promise<StoredProject | null>;
  list(): Promise<StoredProject[]>;
  /**
   * 用 next 替换保存的项目，但只在保存的 version 仍然等于 expectedVersion 时才写入（h07 的乐观并发）。
   * 返回 false 表示读取之后别人已经修改过这个项目，这次什么都没有写入。
   */
  replace(next: StoredProject, expectedVersion: number): Promise<boolean>;
};

/** 时间和 id 从外面传进来：测试中可以固定它们 */
export type Deps = Readonly<{ now: () => string; newId: () => string }>;

export type MemoryStore = ProjectStore & {
  /** 测试用：之后的 count 次 replace 都会失败，就像读取和写入之间别人修改了项目（名称后面加上 *，version 加 1） */
  interfere(count: number): void;
  /** replace 被调用的次数 */
  readonly writes: number;
};

export function createMemoryStore(initial: readonly StoredProject[]): MemoryStore {
  const projects = new Map(initial.map((project) => [project.id, project]));
  let interfering = 0;
  let writes = 0;
  return {
    async get(id) {
      return projects.get(id) ?? null;
    },
    async list() {
      return [...projects.values()];
    },
    async replace(next, expectedVersion) {
      writes++;
      const current = projects.get(next.id);
      if (current === undefined) return false;
      if (interfering > 0) {
        interfering--;
        projects.set(current.id, { ...current, name: `${current.name}*`, version: current.version + 1 });
        return false;
      }
      if (current.version !== expectedVersion) return false;
      projects.set(next.id, next);
      return true;
    },
    interfere(count) {
      interfering = count;
    },
    get writes() {
      return writes;
    },
  };
}
```
:::

:::files{role=starter}
```ts file=tasks.ts
import type { StoredProject, StoredTask, TaskDto } from './model';
import type { Deps, ProjectStore } from './store';

/** POST /api/projects/:projectId/tasks，请求体是 { "title": "…" } */
export async function addTask(request: Request, projectId: string, store: ProjectStore, deps: Deps): Promise<Response> {
  // TODO
  return Response.json({ error: '还没有实现' }, { status: 501 });
}
```
```ts file=main.ts readonly
import type { StoredProject } from './model';
import { createMemoryStore } from './store';
import { addTask } from './tasks';

const project: StoredProject = {
  id: 'p1',
  name: '官网改版',
  owner: '王芳',
  ownerEmail: 'wang.fang@example.com',
  status: 'active',
  dueDate: null,
  version: 1,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  deletedAt: null,
  tasks: [{ id: 't1', title: '设计稿', done: true, position: 1, createdAt: '2026-10-01T00:00:00.000Z', deletedAt: null }],
};
const store = createMemoryStore([project]);
let next = 100;
const deps = { now: () => new Date().toISOString(), newId: () => `t${next++}` };
const post = (body: string, type = 'application/json') =>
  new Request('https://projects.example/api/projects/p1/tasks', { method: 'POST', headers: { 'Content-Type': type }, body });

for (const request of [post('{"title":"上线"}'), post('{"title":" 上线 "}'), post('{"title":""}'), post('title=上线', 'application/x-www-form-urlencoded')]) {
  const response = await addTask(request, 'p1', store, deps);
  console.log(response.status, response.headers.get('location'), await response.text());
}
```
:::

:::files{role=solution}
```ts file=tasks.ts
import type { StoredProject, StoredTask, TaskDto } from './model';
import type { Deps, ProjectStore } from './store';

/** 读取和写入之间被别人修改时，最多做几次 */
const MAX_ATTEMPTS = 3;

const error = (status: number, message: string) => Response.json({ error: message }, { status });
const invalid = (message: string) => Response.json({ errors: { title: message } }, { status: 422 });

/** Content-Type 的媒体类型部分：'application/json; charset=utf-8' → 'application/json' */
function isJson(request: Request): boolean {
  const type = request.headers.get('content-type') ?? '';
  return (type.split(';')[0] ?? '').trim().toLowerCase() === 'application/json';
}

/** POST /api/projects/:projectId/tasks，请求体是 { "title": "…" } */
export async function addTask(request: Request, projectId: string, store: ProjectStore, deps: Deps): Promise<Response> {
  if (!isJson(request)) return error(415, '请求体必须是 JSON');
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, '请求体不是合法的 JSON');
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const project = await store.get(projectId);
    if (project === null || project.deletedAt !== null) return error(404, '没有这个项目');
    // 下面的顺序和 p2-04 的 fake-server.ts 一样
    if (typeof body !== 'object' || body === null) return error(400, '不支持的请求');
    if (project.status === 'done') return error(409, '已完成的项目不能修改任务');
    if (!('title' in body) || typeof body.title !== 'string') return error(400, '不支持的请求');
    const title = body.title.trim();
    if (title === '') return invalid('任务不能为空');
    if ([...title].length > 80) return invalid('任务不能超过 80 个字符');
    if (project.tasks.some((task) => task.deletedAt === null && task.title === title)) return invalid(`已经有一个叫“${title}”的任务`);

    const now = deps.now();
    const task: StoredTask = {
      id: deps.newId(),
      title,
      done: false,
      // 删除的任务也占着自己的位置：新任务排在所有任务的后面
      position: Math.max(0, ...project.tasks.map((t) => t.position)) + 1,
      createdAt: now,
      deletedAt: null,
    };
    const next: StoredProject = { ...project, tasks: [...project.tasks, task], version: project.version + 1, updatedAt: now };
    if (await store.replace(next, project.version)) {
      const dto: TaskDto = { id: task.id, title: task.title, done: task.done };
      return Response.json(dto, { status: 201, headers: { Location: `/api/projects/${projectId}/tasks/${task.id}` } });
    }
    // 读取之后别人修改了这个项目。添加任务不依赖客户端看到的是哪个版本，重新读取、再检查一遍就行
  }
  return Response.json({ error: '项目正在被频繁修改，请稍后重试' }, { status: 503, headers: { 'Retry-After': '1' } });
}
```
```ts file=main.ts readonly
import type { StoredProject } from './model';
import { createMemoryStore } from './store';
import { addTask } from './tasks';

const project: StoredProject = {
  id: 'p1',
  name: '官网改版',
  owner: '王芳',
  ownerEmail: 'wang.fang@example.com',
  status: 'active',
  dueDate: null,
  version: 1,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  deletedAt: null,
  tasks: [{ id: 't1', title: '设计稿', done: true, position: 1, createdAt: '2026-10-01T00:00:00.000Z', deletedAt: null }],
};
const store = createMemoryStore([project]);
let next = 100;
const deps = { now: () => new Date().toISOString(), newId: () => `t${next++}` };
const post = (body: string, type = 'application/json') =>
  new Request('https://projects.example/api/projects/p1/tasks', { method: 'POST', headers: { 'Content-Type': type }, body });

for (const request of [post('{"title":"上线"}'), post('{"title":" 上线 "}'), post('{"title":""}'), post('title=上线', 'application/x-www-form-urlencoded')]) {
  const response = await addTask(request, 'p1', store, deps);
  console.log(response.status, response.headers.get('location'), await response.text());
}
```
:::

:::files{role=tests}
```ts file=tasks.test.ts
import { describe, expect, test } from 'vitest';
import type { StoredProject, StoredTask } from './model';
import { createMemoryStore, type Deps } from './store';
import { addTask } from './tasks';

const NOW = '2026-10-21T10:00:00.000Z';

function deps(): Deps {
  let next = 100;
  return { now: () => NOW, newId: () => `t${next++}` };
}

const task = (id: string, title: string, position: number, deletedAt: string | null = null): StoredTask => ({
  id,
  title,
  done: false,
  position,
  createdAt: '2026-10-01T00:00:00.000Z',
  deletedAt,
});

const base: StoredProject = {
  id: 'p1',
  name: '官网改版',
  owner: '王芳',
  ownerEmail: 'wang.fang@example.com',
  status: 'active',
  dueDate: null,
  version: 5,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-10-20T00:00:00.000Z',
  deletedAt: null,
  tasks: [task('t1', '设计稿', 10), task('t2', '旧的任务', 30, '2026-10-02T00:00:00.000Z')],
};

/** contentType 是 null 时不带 Content-Type：请求体用字节，因为字符串请求体会被自动加上 text/plain */
const post = (body: string, contentType: string | null = 'application/json') =>
  new Request('https://projects.example/api/projects/p1/tasks', {
    method: 'POST',
    headers: contentType === null ? {} : { 'Content-Type': contentType },
    body: contentType === null ? new TextEncoder().encode(body) : body,
  });

async function send(request: Request, projects: readonly StoredProject[] = [base], projectId = 'p1') {
  const store = createMemoryStore(projects);
  const response = await addTask(request, projectId, store, deps());
  return { store, response, status: response.status, body: await response.json() };
}

describe('addTask', () => {
  test('请求体不是 JSON：415；Content-Type 的参数和大小写不影响，媒体类型要完全相同', async () => {
    expect(await send(post('{"title":"上线"}', 'text/plain'))).toMatchObject({ status: 415, body: { error: '请求体必须是 JSON' } });
    const bare = post('{"title":"上线"}', null);
    expect(bare.headers.get('content-type')).toBeNull();
    expect((await send(bare)).status).toBe(415);
    for (const type of ['application/json-patch+json', 'text/json', 'application/x-www-form-urlencoded']) {
      expect((await send(post('{"title":"上线"}', type))).status, type).toBe(415);
    }
    expect((await send(post('{"title":"上线"}', 'application/json; charset=utf-8'))).status).toBe(201);
    expect((await send(post('{"title":"上线"}', 'Application/JSON'))).status).toBe(201);
  });

  test('415 在 404 之前：不用读取存储就能回答', async () => {
    expect((await send(post('{"title":"上线"}', 'text/plain'), [base], 'p9')).status).toBe(415);
  });

  test('JSON 的格式不对：400', async () => {
    expect(await send(post('{"title":'))).toMatchObject({ status: 400, body: { error: '请求体不是合法的 JSON' } });
    expect((await send(post(''))).status).toBe(400);
  });

  test('没有这个项目，或者项目已经删除：404', async () => {
    expect(await send(post('{"title":"上线"}'), [base], 'p9')).toMatchObject({ status: 404, body: { error: '没有这个项目' } });
    expect((await send(post('{"title":"上线"}'), [{ ...base, deletedAt: NOW }])).status).toBe(404);
  });

  test('和 fake-server 一样的顺序：请求体不是对象 400，项目已完成 409，标题不是字符串 400', async () => {
    expect(await send(post('"上线"'))).toMatchObject({ status: 400, body: { error: '不支持的请求' } });
    expect((await send(post('null'))).status).toBe(400);
    const done = { ...base, status: 'done' as const };
    expect(await send(post('{"title":""}'), [done])).toMatchObject({ status: 409, body: { error: '已完成的项目不能修改任务' } });
    // 不是对象的检查在已完成之前，已完成的检查在标题的类型之前
    expect((await send(post('null'), [done])).status).toBe(400);
    expect((await send(post('{}'), [done])).status).toBe(409);
    expect((await send(post('{"title":1}'))).status).toBe(400);
    expect((await send(post('{}'))).status).toBe(400);
    expect((await send(post('[]'))).status).toBe(400);
  });

  test('标题的检查：422', async () => {
    expect(await send(post('{"title":"   "}'))).toMatchObject({ status: 422, body: { errors: { title: '任务不能为空' } } });
    expect((await send(post(JSON.stringify({ title: '字'.repeat(81) })))).body).toStrictEqual({ errors: { title: '任务不能超过 80 个字符' } });
    expect((await send(post(JSON.stringify({ title: '🚀'.repeat(80) })))).status).toBe(201);
    // 长度按去掉空白之后计算
    expect((await send(post(JSON.stringify({ title: ` ${'字'.repeat(80)} ` })))).status).toBe(201);
    expect((await send(post('{"title":" 设计稿 "}'))).body).toStrictEqual({ errors: { title: '已经有一个叫“设计稿”的任务' } });
    // 删除了的任务不算重名
    expect((await send(post('{"title":"旧的任务"}'))).status).toBe(201);
  });

  test('成功：201，响应体是新的任务，Location 指向它；项目的版本加 1', async () => {
    const { store, response, status, body } = await send(post('{"title":"  上线  "}'));
    expect(status).toBe(201);
    expect(body).toStrictEqual({ id: 't100', title: '上线', done: false });
    expect(response.headers.get('location')).toBe('/api/projects/p1/tasks/t100');
    expect(response.headers.get('content-type')).toMatch(/^application\/json/);
    const saved = await store.get('p1');
    expect(saved?.version).toBe(6);
    expect(saved?.updatedAt).toBe(NOW);
    // 删除的任务（position 30）也占着位置
    expect(saved?.tasks.at(-1)).toStrictEqual({ id: 't100', title: '上线', done: false, position: 31, createdAt: NOW, deletedAt: null });
    expect(saved?.tasks.slice(0, 2)).toStrictEqual(base.tasks);
  });

  test('没有任务的项目：position 是 1', async () => {
    const { store } = await send(post('{"title":"第一个"}'), [{ ...base, tasks: [] }]);
    expect((await store.get('p1'))?.tasks[0]?.position).toBe(1);
  });

  test('读取之后别人修改了项目：重新读取再试，别人的修改保留', async () => {
    const store = createMemoryStore([base]);
    store.interfere(2);
    const response = await addTask(post('{"title":"上线"}'), 'p1', store, deps());
    expect(response.status).toBe(201);
    expect(store.writes).toBe(3);
    const saved = await store.get('p1');
    expect(saved?.name).toBe('官网改版**');
    expect(saved?.version).toBe(8);
    expect(saved?.tasks.map((t) => t.title)).toStrictEqual(['设计稿', '旧的任务', '上线']);
  });

  test('一直冲突：试 3 次之后 503，带上 Retry-After，没有写入任务', async () => {
    const store = createMemoryStore([base]);
    store.interfere(3);
    const response = await addTask(post('{"title":"上线"}'), 'p1', store, deps());
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('1');
    expect(await response.json()).toStrictEqual({ error: '项目正在被频繁修改，请稍后重试' });
    expect(store.writes).toBe(3);
    expect((await store.get('p1'))?.tasks).toHaveLength(2);
  });

  /** 第一次 replace 时，别人抢先把项目改成了 changed 的样子 */
  function interruptedOnce(changed: StoredProject) {
    const projects = new Map<string, StoredProject>([['p1', base]]);
    let first = true;
    return {
      get: async (id: string) => projects.get(id) ?? null,
      list: async () => [...projects.values()],
      replace: async (next: StoredProject, expected: number) => {
        if (first) {
          first = false;
          projects.set('p1', changed);
          return false;
        }
        if (projects.get(next.id)?.version !== expected) return false;
        projects.set(next.id, next);
        return true;
      },
    };
  }

  test('重试时重新检查：别人在这期间把项目标记为已完成，就是 409', async () => {
    const store = interruptedOnce({ ...base, status: 'done', version: base.version + 1 });
    expect((await addTask(post('{"title":"上线"}'), 'p1', store, deps())).status).toBe(409);
  });

  test('重试时重新检查：别人在这期间加了一个同名的任务，就是 422', async () => {
    const store = interruptedOnce({ ...base, tasks: [...base.tasks, task('t9', '上线', 40)], version: base.version + 1 });
    const response = await addTask(post('{"title":"上线"}'), 'p1', store, deps());
    expect(response.status).toBe(422);
    expect(await response.json()).toStrictEqual({ errors: { title: '已经有一个叫“上线”的任务' } });
  });
});
```
:::

:::hint{level=1}
前两步和项目无关，放在循环的外面；从读取项目开始的部分放在一个最多执行 3 次的循环中，`replace` 成功就 `return`，失败就进入下一次。写两个小函数会让代码短很多：`error(status, message)` 和 `invalid(message)`，分别返回 `{ error }` 和 `{ errors: { title } }` 的响应。
:::

:::hint{level=2}
`request.json()` 放在 `try` 中，失败时返回 400。`'title' in body` 之后，TypeScript 知道 `body.title` 存在（类型是 `unknown`），再用 `typeof` 检查它是不是字符串。最大的位置：`Math.max(0, ...project.tasks.map((t) => t.position))`，0 让空的数组也有结果。
:::

:::explanation
这个函数和 Next.js 无关：它只用到 Fetch API 的 `Request`、`Response` 和传进来的存储。路由文件中的 `POST` 只负责取出 `projectId`，再调用它（正文中实测项目的写法）。所以它可以在浏览器中、在测试中运行，测试也不需要启动服务器。

第 3 到 7 步的顺序故意和 p2-04 的 `fake-server.ts` 一样，项目 2 的客户端换成真的服务器之后，看到的是同样的回答。前两步是假的服务器不需要的：它只会收到自己的客户端发来的请求。

写入冲突时，服务器可以自己重试，因为“添加一个任务”不依赖客户端看到的是哪个版本。但每次重试都要**重新读取、重新检查**：别人可能刚刚把项目标记为完成，或者添加了一个同名的任务。重试的次数要有上限，否则一个被频繁修改的项目会让请求一直卡住；503 加上 `Retry-After` 告诉客户端过一会儿再试。

替代解把“给定项目，算出新的项目或者错误的响应”写成一个不读写存储的函数 `plan`（时间和 id 来自 `deps`），循环中只做读取、`plan`、写入三件事。
:::

:::variant{kind=alt name=pure-plan}
```ts file=tasks.ts
import type { StoredProject, StoredTask } from './model';
import type { Deps, ProjectStore } from './store';

type Plan = { ok: true; next: StoredProject; task: StoredTask } | { ok: false; response: Response };

const reject = (status: number, body: object): { ok: false; response: Response } => ({ ok: false, response: Response.json(body, { status }) });

/** 不读写存储的部分：给定现在的项目，算出添加任务之后的项目，或者应该返回的错误 */
function plan(project: StoredProject | null, body: unknown, deps: Deps): Plan {
  if (project === null || project.deletedAt !== null) return reject(404, { error: '没有这个项目' });
  if (typeof body !== 'object' || body === null) return reject(400, { error: '不支持的请求' });
  if (project.status === 'done') return reject(409, { error: '已完成的项目不能修改任务' });
  const raw: unknown = Reflect.get(body, 'title');
  if (typeof raw !== 'string') return reject(400, { error: '不支持的请求' });
  const title = raw.trim();
  const problem =
    title === '' ? '任务不能为空'
    : Array.from(title).length > 80 ? '任务不能超过 80 个字符'
    : project.tasks.some((t) => t.deletedAt === null && t.title === title) ? `已经有一个叫“${title}”的任务`
    : null;
  if (problem !== null) return reject(422, { errors: { title: problem } });

  const now = deps.now();
  const last = project.tasks.reduce((max, t) => Math.max(max, t.position), 0);
  const task: StoredTask = { id: deps.newId(), title, done: false, position: last + 1, createdAt: now, deletedAt: null };
  return { ok: true, task, next: { ...project, tasks: project.tasks.concat(task), version: project.version + 1, updatedAt: now } };
}

export async function addTask(request: Request, projectId: string, store: ProjectStore, deps: Deps): Promise<Response> {
  if (!/^application\/json\s*(;|$)/i.test(request.headers.get('content-type') ?? '')) {
    return Response.json({ error: '请求体必须是 JSON' }, { status: 415 });
  }
  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return Response.json({ error: '请求体不是合法的 JSON' }, { status: 400 });
  }

  let attempts = 0;
  while (attempts < 3) {
    attempts++;
    const result = plan(await store.get(projectId), body, deps);
    if (!result.ok) return result.response;
    if (await store.replace(result.next, result.next.version - 1)) {
      const { id, title, done } = result.task;
      return new Response(JSON.stringify({ id, title, done }), {
        status: 201,
        headers: { 'Content-Type': 'application/json', Location: `/api/projects/${projectId}/tasks/${id}` },
      });
    }
  }
  return Response.json({ error: '项目正在被频繁修改，请稍后重试' }, { status: 503, headers: { 'Retry-After': '1' } });
}
```
:::

:::variant{kind=wrong name=no-content-type-check fails=tests reason="没有检查 Content-Type：curl 默认的表单格式也被当成 JSON 解析"}
```ts file=tasks.ts
import type { StoredProject, StoredTask, TaskDto } from './model';
import type { Deps, ProjectStore } from './store';

/** 读取和写入之间被别人修改时，最多做几次 */
const MAX_ATTEMPTS = 3;

const error = (status: number, message: string) => Response.json({ error: message }, { status });
const invalid = (message: string) => Response.json({ errors: { title: message } }, { status: 422 });

/** Content-Type 的媒体类型部分：'application/json; charset=utf-8' → 'application/json' */
function isJson(request: Request): boolean {
  const type = request.headers.get('content-type') ?? '';
  return (type.split(';')[0] ?? '').trim().toLowerCase() === 'application/json';
}

/** POST /api/projects/:projectId/tasks，请求体是 { "title": "…" } */
export async function addTask(request: Request, projectId: string, store: ProjectStore, deps: Deps): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, '请求体不是合法的 JSON');
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const project = await store.get(projectId);
    if (project === null || project.deletedAt !== null) return error(404, '没有这个项目');
    // 下面的顺序和 p2-04 的 fake-server.ts 一样
    if (typeof body !== 'object' || body === null) return error(400, '不支持的请求');
    if (project.status === 'done') return error(409, '已完成的项目不能修改任务');
    if (!('title' in body) || typeof body.title !== 'string') return error(400, '不支持的请求');
    const title = body.title.trim();
    if (title === '') return invalid('任务不能为空');
    if ([...title].length > 80) return invalid('任务不能超过 80 个字符');
    if (project.tasks.some((task) => task.deletedAt === null && task.title === title)) return invalid(`已经有一个叫“${title}”的任务`);

    const now = deps.now();
    const task: StoredTask = {
      id: deps.newId(),
      title,
      done: false,
      // 删除的任务也占着自己的位置：新任务排在所有任务的后面
      position: Math.max(0, ...project.tasks.map((t) => t.position)) + 1,
      createdAt: now,
      deletedAt: null,
    };
    const next: StoredProject = { ...project, tasks: [...project.tasks, task], version: project.version + 1, updatedAt: now };
    if (await store.replace(next, project.version)) {
      const dto: TaskDto = { id: task.id, title: task.title, done: task.done };
      return Response.json(dto, { status: 201, headers: { Location: `/api/projects/${projectId}/tasks/${task.id}` } });
    }
    // 读取之后别人修改了这个项目。添加任务不依赖客户端看到的是哪个版本，重新读取、再检查一遍就行
  }
  return Response.json({ error: '项目正在被频繁修改，请稍后重试' }, { status: 503, headers: { 'Retry-After': '1' } });
}
```
:::

:::variant{kind=wrong name=title-before-done fails=tests reason="先检查标题再检查项目的状态：已完成的项目收到的是“任务不能为空”，用户改好标题之后还是失败"}
```ts file=tasks.ts
import type { StoredProject, StoredTask, TaskDto } from './model';
import type { Deps, ProjectStore } from './store';

/** 读取和写入之间被别人修改时，最多做几次 */
const MAX_ATTEMPTS = 3;

const error = (status: number, message: string) => Response.json({ error: message }, { status });
const invalid = (message: string) => Response.json({ errors: { title: message } }, { status: 422 });

/** Content-Type 的媒体类型部分：'application/json; charset=utf-8' → 'application/json' */
function isJson(request: Request): boolean {
  const type = request.headers.get('content-type') ?? '';
  return (type.split(';')[0] ?? '').trim().toLowerCase() === 'application/json';
}

/** POST /api/projects/:projectId/tasks，请求体是 { "title": "…" } */
export async function addTask(request: Request, projectId: string, store: ProjectStore, deps: Deps): Promise<Response> {
  if (!isJson(request)) return error(415, '请求体必须是 JSON');
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, '请求体不是合法的 JSON');
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const project = await store.get(projectId);
    if (project === null || project.deletedAt !== null) return error(404, '没有这个项目');
    // 下面的顺序和 p2-04 的 fake-server.ts 一样
    if (typeof body !== 'object' || body === null) return error(400, '不支持的请求');
    if (!('title' in body) || typeof body.title !== 'string') return error(400, '不支持的请求');
    const title = body.title.trim();
    if (title === '') return invalid('任务不能为空');
    if ([...title].length > 80) return invalid('任务不能超过 80 个字符');
    if (project.tasks.some((task) => task.deletedAt === null && task.title === title)) return invalid(`已经有一个叫“${title}”的任务`);
    if (project.status === 'done') return error(409, '已完成的项目不能修改任务');

    const now = deps.now();
    const task: StoredTask = {
      id: deps.newId(),
      title,
      done: false,
      // 删除的任务也占着自己的位置：新任务排在所有任务的后面
      position: Math.max(0, ...project.tasks.map((t) => t.position)) + 1,
      createdAt: now,
      deletedAt: null,
    };
    const next: StoredProject = { ...project, tasks: [...project.tasks, task], version: project.version + 1, updatedAt: now };
    if (await store.replace(next, project.version)) {
      const dto: TaskDto = { id: task.id, title: task.title, done: task.done };
      return Response.json(dto, { status: 201, headers: { Location: `/api/projects/${projectId}/tasks/${task.id}` } });
    }
    // 读取之后别人修改了这个项目。添加任务不依赖客户端看到的是哪个版本，重新读取、再检查一遍就行
  }
  return Response.json({ error: '项目正在被频繁修改，请稍后重试' }, { status: 503, headers: { 'Retry-After': '1' } });
}
```
:::

:::variant{kind=wrong name=deleted-is-duplicate fails=tests reason="删除了的任务也算重名：删掉一个任务之后，不能再添加同名的任务"}
```ts file=tasks.ts
import type { StoredProject, StoredTask, TaskDto } from './model';
import type { Deps, ProjectStore } from './store';

/** 读取和写入之间被别人修改时，最多做几次 */
const MAX_ATTEMPTS = 3;

const error = (status: number, message: string) => Response.json({ error: message }, { status });
const invalid = (message: string) => Response.json({ errors: { title: message } }, { status: 422 });

/** Content-Type 的媒体类型部分：'application/json; charset=utf-8' → 'application/json' */
function isJson(request: Request): boolean {
  const type = request.headers.get('content-type') ?? '';
  return (type.split(';')[0] ?? '').trim().toLowerCase() === 'application/json';
}

/** POST /api/projects/:projectId/tasks，请求体是 { "title": "…" } */
export async function addTask(request: Request, projectId: string, store: ProjectStore, deps: Deps): Promise<Response> {
  if (!isJson(request)) return error(415, '请求体必须是 JSON');
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, '请求体不是合法的 JSON');
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const project = await store.get(projectId);
    if (project === null || project.deletedAt !== null) return error(404, '没有这个项目');
    // 下面的顺序和 p2-04 的 fake-server.ts 一样
    if (typeof body !== 'object' || body === null) return error(400, '不支持的请求');
    if (project.status === 'done') return error(409, '已完成的项目不能修改任务');
    if (!('title' in body) || typeof body.title !== 'string') return error(400, '不支持的请求');
    const title = body.title.trim();
    if (title === '') return invalid('任务不能为空');
    if ([...title].length > 80) return invalid('任务不能超过 80 个字符');
    if (project.tasks.some((task) => task.title === title)) return invalid(`已经有一个叫“${title}”的任务`);

    const now = deps.now();
    const task: StoredTask = {
      id: deps.newId(),
      title,
      done: false,
      // 删除的任务也占着自己的位置：新任务排在所有任务的后面
      position: Math.max(0, ...project.tasks.map((t) => t.position)) + 1,
      createdAt: now,
      deletedAt: null,
    };
    const next: StoredProject = { ...project, tasks: [...project.tasks, task], version: project.version + 1, updatedAt: now };
    if (await store.replace(next, project.version)) {
      const dto: TaskDto = { id: task.id, title: task.title, done: task.done };
      return Response.json(dto, { status: 201, headers: { Location: `/api/projects/${projectId}/tasks/${task.id}` } });
    }
    // 读取之后别人修改了这个项目。添加任务不依赖客户端看到的是哪个版本，重新读取、再检查一遍就行
  }
  return Response.json({ error: '项目正在被频繁修改，请稍后重试' }, { status: 503, headers: { 'Retry-After': '1' } });
}
```
:::

:::variant{kind=wrong name=position-skips-deleted fails=tests reason="新任务的位置没有算上删除的任务：恢复删除的任务时，两个任务的位置会一样"}
```ts file=tasks.ts
import type { StoredProject, StoredTask, TaskDto } from './model';
import type { Deps, ProjectStore } from './store';

/** 读取和写入之间被别人修改时，最多做几次 */
const MAX_ATTEMPTS = 3;

const error = (status: number, message: string) => Response.json({ error: message }, { status });
const invalid = (message: string) => Response.json({ errors: { title: message } }, { status: 422 });

/** Content-Type 的媒体类型部分：'application/json; charset=utf-8' → 'application/json' */
function isJson(request: Request): boolean {
  const type = request.headers.get('content-type') ?? '';
  return (type.split(';')[0] ?? '').trim().toLowerCase() === 'application/json';
}

/** POST /api/projects/:projectId/tasks，请求体是 { "title": "…" } */
export async function addTask(request: Request, projectId: string, store: ProjectStore, deps: Deps): Promise<Response> {
  if (!isJson(request)) return error(415, '请求体必须是 JSON');
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, '请求体不是合法的 JSON');
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const project = await store.get(projectId);
    if (project === null || project.deletedAt !== null) return error(404, '没有这个项目');
    // 下面的顺序和 p2-04 的 fake-server.ts 一样
    if (typeof body !== 'object' || body === null) return error(400, '不支持的请求');
    if (project.status === 'done') return error(409, '已完成的项目不能修改任务');
    if (!('title' in body) || typeof body.title !== 'string') return error(400, '不支持的请求');
    const title = body.title.trim();
    if (title === '') return invalid('任务不能为空');
    if ([...title].length > 80) return invalid('任务不能超过 80 个字符');
    if (project.tasks.some((task) => task.deletedAt === null && task.title === title)) return invalid(`已经有一个叫“${title}”的任务`);

    const now = deps.now();
    const task: StoredTask = {
      id: deps.newId(),
      title,
      done: false,
      // 删除的任务也占着自己的位置：新任务排在所有任务的后面
      position: Math.max(0, ...project.tasks.filter((t) => t.deletedAt === null).map((t) => t.position)) + 1,
      createdAt: now,
      deletedAt: null,
    };
    const next: StoredProject = { ...project, tasks: [...project.tasks, task], version: project.version + 1, updatedAt: now };
    if (await store.replace(next, project.version)) {
      const dto: TaskDto = { id: task.id, title: task.title, done: task.done };
      return Response.json(dto, { status: 201, headers: { Location: `/api/projects/${projectId}/tasks/${task.id}` } });
    }
    // 读取之后别人修改了这个项目。添加任务不依赖客户端看到的是哪个版本，重新读取、再检查一遍就行
  }
  return Response.json({ error: '项目正在被频繁修改，请稍后重试' }, { status: 503, headers: { 'Retry-After': '1' } });
}
```
:::

:::variant{kind=wrong name=no-retry fails=tests reason="写入冲突时不重试：别人恰好在同一时刻修改了项目，添加任务就失败了"}
```ts file=tasks.ts
import type { StoredProject, StoredTask, TaskDto } from './model';
import type { Deps, ProjectStore } from './store';

/** 读取和写入之间被别人修改时，最多做几次 */
const MAX_ATTEMPTS = 1;

const error = (status: number, message: string) => Response.json({ error: message }, { status });
const invalid = (message: string) => Response.json({ errors: { title: message } }, { status: 422 });

/** Content-Type 的媒体类型部分：'application/json; charset=utf-8' → 'application/json' */
function isJson(request: Request): boolean {
  const type = request.headers.get('content-type') ?? '';
  return (type.split(';')[0] ?? '').trim().toLowerCase() === 'application/json';
}

/** POST /api/projects/:projectId/tasks，请求体是 { "title": "…" } */
export async function addTask(request: Request, projectId: string, store: ProjectStore, deps: Deps): Promise<Response> {
  if (!isJson(request)) return error(415, '请求体必须是 JSON');
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, '请求体不是合法的 JSON');
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const project = await store.get(projectId);
    if (project === null || project.deletedAt !== null) return error(404, '没有这个项目');
    // 下面的顺序和 p2-04 的 fake-server.ts 一样
    if (typeof body !== 'object' || body === null) return error(400, '不支持的请求');
    if (project.status === 'done') return error(409, '已完成的项目不能修改任务');
    if (!('title' in body) || typeof body.title !== 'string') return error(400, '不支持的请求');
    const title = body.title.trim();
    if (title === '') return invalid('任务不能为空');
    if ([...title].length > 80) return invalid('任务不能超过 80 个字符');
    if (project.tasks.some((task) => task.deletedAt === null && task.title === title)) return invalid(`已经有一个叫“${title}”的任务`);

    const now = deps.now();
    const task: StoredTask = {
      id: deps.newId(),
      title,
      done: false,
      // 删除的任务也占着自己的位置：新任务排在所有任务的后面
      position: Math.max(0, ...project.tasks.map((t) => t.position)) + 1,
      createdAt: now,
      deletedAt: null,
    };
    const next: StoredProject = { ...project, tasks: [...project.tasks, task], version: project.version + 1, updatedAt: now };
    if (await store.replace(next, project.version)) {
      const dto: TaskDto = { id: task.id, title: task.title, done: task.done };
      return Response.json(dto, { status: 201, headers: { Location: `/api/projects/${projectId}/tasks/${task.id}` } });
    }
    // 读取之后别人修改了这个项目。添加任务不依赖客户端看到的是哪个版本，重新读取、再检查一遍就行
  }
  return Response.json({ error: '项目正在被频繁修改，请稍后重试' }, { status: 503, headers: { 'Retry-After': '1' } });
}
```
:::

:::variant{kind=wrong name=retry-stale fails=tests reason="重试时没有重新读取项目：每次都用旧的版本写入，每次都冲突"}
```ts file=tasks.ts
import type { StoredProject, StoredTask, TaskDto } from './model';
import type { Deps, ProjectStore } from './store';

/** 读取和写入之间被别人修改时，最多做几次 */
const MAX_ATTEMPTS = 3;

const error = (status: number, message: string) => Response.json({ error: message }, { status });
const invalid = (message: string) => Response.json({ errors: { title: message } }, { status: 422 });

/** Content-Type 的媒体类型部分：'application/json; charset=utf-8' → 'application/json' */
function isJson(request: Request): boolean {
  const type = request.headers.get('content-type') ?? '';
  return (type.split(';')[0] ?? '').trim().toLowerCase() === 'application/json';
}

/** POST /api/projects/:projectId/tasks，请求体是 { "title": "…" } */
export async function addTask(request: Request, projectId: string, store: ProjectStore, deps: Deps): Promise<Response> {
  if (!isJson(request)) return error(415, '请求体必须是 JSON');
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, '请求体不是合法的 JSON');
  }

  const project = await store.get(projectId);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (project === null || project.deletedAt !== null) return error(404, '没有这个项目');
    // 下面的顺序和 p2-04 的 fake-server.ts 一样
    if (typeof body !== 'object' || body === null) return error(400, '不支持的请求');
    if (project.status === 'done') return error(409, '已完成的项目不能修改任务');
    if (!('title' in body) || typeof body.title !== 'string') return error(400, '不支持的请求');
    const title = body.title.trim();
    if (title === '') return invalid('任务不能为空');
    if ([...title].length > 80) return invalid('任务不能超过 80 个字符');
    if (project.tasks.some((task) => task.deletedAt === null && task.title === title)) return invalid(`已经有一个叫“${title}”的任务`);

    const now = deps.now();
    const task: StoredTask = {
      id: deps.newId(),
      title,
      done: false,
      // 删除的任务也占着自己的位置：新任务排在所有任务的后面
      position: Math.max(0, ...project.tasks.map((t) => t.position)) + 1,
      createdAt: now,
      deletedAt: null,
    };
    const next: StoredProject = { ...project, tasks: [...project.tasks, task], version: project.version + 1, updatedAt: now };
    if (await store.replace(next, project.version)) {
      const dto: TaskDto = { id: task.id, title: task.title, done: task.done };
      return Response.json(dto, { status: 201, headers: { Location: `/api/projects/${projectId}/tasks/${task.id}` } });
    }
    // 读取之后别人修改了这个项目。添加任务不依赖客户端看到的是哪个版本，重新读取、再检查一遍就行
  }
  return Response.json({ error: '项目正在被频繁修改，请稍后重试' }, { status: 503, headers: { 'Retry-After': '1' } });
}
```
:::

:::variant{kind=wrong name=prefix-media-type fails=tests reason="只看 Content-Type 是不是以 application/json 开头：application/json-patch+json 这样的其他格式也被当成了 JSON"}
```ts file=tasks.ts
import type { StoredProject, StoredTask, TaskDto } from './model';
import type { Deps, ProjectStore } from './store';

/** 读取和写入之间被别人修改时，最多做几次 */
const MAX_ATTEMPTS = 3;

const error = (status: number, message: string) => Response.json({ error: message }, { status });
const invalid = (message: string) => Response.json({ errors: { title: message } }, { status: 422 });

/** Content-Type 的媒体类型部分：'application/json; charset=utf-8' → 'application/json' */
function isJson(request: Request): boolean {
  const type = request.headers.get('content-type') ?? '';
  return type.toLowerCase().startsWith('application/json');
}

/** POST /api/projects/:projectId/tasks，请求体是 { "title": "…" } */
export async function addTask(request: Request, projectId: string, store: ProjectStore, deps: Deps): Promise<Response> {
  if (!isJson(request)) return error(415, '请求体必须是 JSON');
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, '请求体不是合法的 JSON');
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const project = await store.get(projectId);
    if (project === null || project.deletedAt !== null) return error(404, '没有这个项目');
    // 下面的顺序和 p2-04 的 fake-server.ts 一样
    if (typeof body !== 'object' || body === null) return error(400, '不支持的请求');
    if (project.status === 'done') return error(409, '已完成的项目不能修改任务');
    if (!('title' in body) || typeof body.title !== 'string') return error(400, '不支持的请求');
    const title = body.title.trim();
    if (title === '') return invalid('任务不能为空');
    if ([...title].length > 80) return invalid('任务不能超过 80 个字符');
    if (project.tasks.some((task) => task.deletedAt === null && task.title === title)) return invalid(`已经有一个叫“${title}”的任务`);

    const now = deps.now();
    const task: StoredTask = {
      id: deps.newId(),
      title,
      done: false,
      // 删除的任务也占着自己的位置：新任务排在所有任务的后面
      position: Math.max(0, ...project.tasks.map((t) => t.position)) + 1,
      createdAt: now,
      deletedAt: null,
    };
    const next: StoredProject = { ...project, tasks: [...project.tasks, task], version: project.version + 1, updatedAt: now };
    if (await store.replace(next, project.version)) {
      const dto: TaskDto = { id: task.id, title: task.title, done: task.done };
      return Response.json(dto, { status: 201, headers: { Location: `/api/projects/${projectId}/tasks/${task.id}` } });
    }
    // 读取之后别人修改了这个项目。添加任务不依赖客户端看到的是哪个版本，重新读取、再检查一遍就行
  }
  return Response.json({ error: '项目正在被频繁修改，请稍后重试' }, { status: 503, headers: { 'Retry-After': '1' } });
}
```
:::

:::variant{kind=wrong name=no-location fails=tests reason="201 没有带上 Location：客户端不知道新的任务在哪个地址"}
```ts file=tasks.ts
import type { StoredProject, StoredTask, TaskDto } from './model';
import type { Deps, ProjectStore } from './store';

/** 读取和写入之间被别人修改时，最多做几次 */
const MAX_ATTEMPTS = 3;

const error = (status: number, message: string) => Response.json({ error: message }, { status });
const invalid = (message: string) => Response.json({ errors: { title: message } }, { status: 422 });

/** Content-Type 的媒体类型部分：'application/json; charset=utf-8' → 'application/json' */
function isJson(request: Request): boolean {
  const type = request.headers.get('content-type') ?? '';
  return (type.split(';')[0] ?? '').trim().toLowerCase() === 'application/json';
}

/** POST /api/projects/:projectId/tasks，请求体是 { "title": "…" } */
export async function addTask(request: Request, projectId: string, store: ProjectStore, deps: Deps): Promise<Response> {
  if (!isJson(request)) return error(415, '请求体必须是 JSON');
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, '请求体不是合法的 JSON');
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const project = await store.get(projectId);
    if (project === null || project.deletedAt !== null) return error(404, '没有这个项目');
    // 下面的顺序和 p2-04 的 fake-server.ts 一样
    if (typeof body !== 'object' || body === null) return error(400, '不支持的请求');
    if (project.status === 'done') return error(409, '已完成的项目不能修改任务');
    if (!('title' in body) || typeof body.title !== 'string') return error(400, '不支持的请求');
    const title = body.title.trim();
    if (title === '') return invalid('任务不能为空');
    if ([...title].length > 80) return invalid('任务不能超过 80 个字符');
    if (project.tasks.some((task) => task.deletedAt === null && task.title === title)) return invalid(`已经有一个叫“${title}”的任务`);

    const now = deps.now();
    const task: StoredTask = {
      id: deps.newId(),
      title,
      done: false,
      // 删除的任务也占着自己的位置：新任务排在所有任务的后面
      position: Math.max(0, ...project.tasks.map((t) => t.position)) + 1,
      createdAt: now,
      deletedAt: null,
    };
    const next: StoredProject = { ...project, tasks: [...project.tasks, task], version: project.version + 1, updatedAt: now };
    if (await store.replace(next, project.version)) {
      const dto: TaskDto = { id: task.id, title: task.title, done: task.done };
      return Response.json(dto, { status: 201 });
    }
    // 读取之后别人修改了这个项目。添加任务不依赖客户端看到的是哪个版本，重新读取、再检查一遍就行
  }
  return Response.json({ error: '项目正在被频繁修改，请稍后重试' }, { status: 503, headers: { 'Retry-After': '1' } });
}
```
:::

