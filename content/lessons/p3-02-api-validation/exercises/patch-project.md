---
kind: challenge
title: 修改项目：ETag 和 If-Match
---
在 `project.ts` 中实现 `patchProject(request, projectId, store, deps)`：`PATCH /api/projects/:projectId`。请求体按 p3-01 的 `parseProjectPatch` 检查（`patch.ts`，只读），发出去的数据用 `toProjectDto`（`dto.ts`，只读），状态的转换表 `TRANSITIONS` 在 `model.ts` 中。项目的 ETag 是 `etagOf(version)`：带引号的版本号，例如 `"v7"`（已经写好）。

按顺序检查，遇到第一个问题就返回（响应体都是 JSON）：

1. 没有这个项目，或者已经删除：404，`{ "error": "没有这个项目" }`；
2. **前提条件**：请求头 `If-Match` 去掉首尾的空白之后为空（包括没有这个请求头）或者是 `*`：428，`{ "error": "修改时必须带上 If-Match 请求头（项目的 ETag）" }`。它可以是用逗号分隔的几个 ETag，其中任何一个（去掉空白之后）和 `etagOf(项目的 version)` **完全相同**才算对上（`W/"v3"` 这样的弱 ETag 不算）；对不上：412，`{ "error": "项目已经被修改过，请刷新之后再试" }`；
3. 请求体：`Content-Type` 不是 JSON 是 415，不是合法的 JSON 是 400（和练习一的信息一样）；`parseProjectPatch` 失败是 422，`{ "errors": … }`（原样使用它的 `errors`）；
4. **业务规则**：`patch` 中有 `status`，并且和现在的状态不同时，按转换表检查，不允许时是 409，`不能从“计划中”改为“已完成”`（用 `STATUS_NAMES`）；改为 `'done'` 时，还有没有完成的任务（不算删除了的）是 409，`还有 2 个任务没有完成`；
5. 新的项目：原来的项目合并 `patch`，`version` 加 1，`updatedAt` 是 `deps.now()`。用 `store.replace(新的项目, 原来的 version)` 写入，返回 `false` 时是 412（同样的信息），**不要**重试；
6. 成功：200，响应体是 `toProjectDto(新的项目)`，响应头 `ETag` 是新的 ETag。

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
  /** 负责人的邮箱：只用来发通知，不公开 */
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
```ts file=patch.ts readonly
import { STATUSES, type ProjectStatus } from './model';

/** 修改一个项目时可以改的字段：没有出现的字段不改；dueDate 是 null 表示清除截止日期 */
export type ProjectPatch = Readonly<{ name?: string; owner?: string; dueDate?: string | null; status?: ProjectStatus }>;

export type PatchResult = { ok: true; patch: ProjectPatch } | { ok: false; errors: Readonly<Record<string, string>> };

const ALLOWED: readonly string[] = ['name', 'owner', 'dueDate', 'status'];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** YYYY-MM-DD，并且日历上有这一天（2026-02-30 不算） */
function isDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) return false;
  const [year = 0, month = 0, day = 0] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** 名称、负责人：去掉首尾的空白之后，1 到 max 个字符（按码位数） */
function parseText(value: unknown, label: string, max: number): { value: string } | { error: string } {
  if (typeof value !== 'string') return { error: `${label}必须是字符串` };
  const text = value.trim();
  if (text === '') return { error: `${label}不能为空` };
  if ([...text].length > max) return { error: `${label}不能超过 ${max} 个字符` };
  return { value: text };
}

/** 检查客户端发来的 PATCH 请求体：它来自网络，什么都可能有 */
export function parseProjectPatch(body: unknown): PatchResult {
  if (!isRecord(body)) return { ok: false, errors: { body: '请求体必须是一个 JSON 对象' } };
  // 用 Map 收集错误：字段的名字来自客户端，可能是 __proto__
  const errors = new Map<string, string>();
  const patch: { name?: string; owner?: string; dueDate?: string | null; status?: ProjectStatus } = {};

  for (const key of Object.keys(body)) {
    if (!ALLOWED.includes(key)) errors.set(key, '不能修改这个字段');
  }
  if (!ALLOWED.some((key) => Object.hasOwn(body, key))) errors.set('body', '没有要修改的字段');

  if (Object.hasOwn(body, 'name')) {
    const result = parseText(body['name'], '名称', 60);
    if ('error' in result) errors.set('name', result.error);
    else patch.name = result.value;
  }
  if (Object.hasOwn(body, 'owner')) {
    const result = parseText(body['owner'], '负责人', 30);
    if ('error' in result) errors.set('owner', result.error);
    else patch.owner = result.value;
  }
  if (Object.hasOwn(body, 'dueDate')) {
    const value = body['dueDate'];
    if (value === null || (typeof value === 'string' && isDate(value))) patch.dueDate = value;
    else errors.set('dueDate', '截止日期必须是 YYYY-MM-DD 格式的日期，或者 null');
  }
  if (Object.hasOwn(body, 'status')) {
    const status = STATUSES.find((s) => s === body['status']);
    if (status === undefined) errors.set('status', '状态必须是 planning、active、done 之一');
    else patch.status = status;
  }

  return errors.size > 0 ? { ok: false, errors: Object.fromEntries(errors) } : { ok: true, patch };
}
```
```ts file=dto.ts readonly
import type { ProjectDto, StoredProject, TaskDto } from './model';

/**
 * 把服务器保存的项目变成发给客户端的数据。
 * 只列出要发出去的字段（白名单）：存储中以后加了新的字段，也不会自动发出去。
 */
export function toProjectDto(project: StoredProject): ProjectDto | null {
  if (project.deletedAt !== null) return null;
  const tasks: TaskDto[] = project.tasks
    .filter((task) => task.deletedAt === null)
    .toSorted((a, b) => a.position - b.position)
    .map((task) => ({ id: task.id, title: task.title, done: task.done }));
  return {
    id: project.id,
    name: project.name,
    owner: project.owner,
    status: project.status,
    dueDate: project.dueDate,
    tasks,
    version: project.version,
    updatedAt: project.updatedAt,
  };
}
```
:::

:::files{role=starter}
```ts file=project.ts
import { toProjectDto } from './dto';
import { STATUS_NAMES, TRANSITIONS, type StoredProject } from './model';
import { parseProjectPatch } from './patch';
import type { Deps, ProjectStore } from './store';

/** 项目的 ETag：带引号的版本号，例如 "v7" */
export const etagOf = (version: number) => `"v${version}"`;

/** PATCH /api/projects/:projectId：请求头 If-Match 是客户端看到的版本，请求体见 p3-01 的 parseProjectPatch */
export async function patchProject(request: Request, projectId: string, store: ProjectStore, deps: Deps): Promise<Response> {
  // TODO
  return Response.json({ error: '还没有实现' }, { status: 501 });
}
```
```ts file=main.ts readonly
import type { StoredProject } from './model';
import { patchProject } from './project';
import { createMemoryStore } from './store';

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
const deps = { now: () => new Date().toISOString(), newId: () => '' };
const patch = (body: string, ifMatch: string) =>
  new Request('https://projects.example/api/projects/p1', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'If-Match': ifMatch }, body });

// A 和 B 都是在版本 1 的时候打开的项目
const a = await patchProject(patch('{"name":"官网改版（二期）"}', '"v1"'), 'p1', store, deps);
console.log('A：', a.status, a.headers.get('etag'));
const b = await patchProject(patch('{"owner":"李雷"}', '"v1"'), 'p1', store, deps);
console.log('B：', b.status, await b.text());
console.log('保存的项目：', await store.get('p1'));
```
:::

:::files{role=solution}
```ts file=project.ts
import { toProjectDto } from './dto';
import { STATUS_NAMES, TRANSITIONS, type StoredProject } from './model';
import { parseProjectPatch } from './patch';
import type { Deps, ProjectStore } from './store';

/** 项目的 ETag：带引号的版本号，例如 "v7" */
export const etagOf = (version: number) => `"v${version}"`;

const error = (status: number, message: string) => Response.json({ error: message }, { status });

function isJson(request: Request): boolean {
  const type = request.headers.get('content-type') ?? '';
  return (type.split(';')[0] ?? '').trim().toLowerCase() === 'application/json';
}

/** If-Match 可以列出几个 ETag，用逗号分隔；任何一个和现在的完全相同就行（强比较：W/ 开头的弱 ETag 不算） */
function matches(ifMatch: string, etag: string): boolean {
  return ifMatch.split(',').some((item) => item.trim() === etag);
}

/** PATCH /api/projects/:projectId：请求头 If-Match 是客户端看到的版本，请求体见 p3-01 的 parseProjectPatch */
export async function patchProject(request: Request, projectId: string, store: ProjectStore, deps: Deps): Promise<Response> {
  const project = await store.get(projectId);
  if (project === null || project.deletedAt !== null) return error(404, '没有这个项目');

  // 先检查前提条件（RFC 9110）：版本不对时，请求体是什么都没有意义
  const ifMatch = request.headers.get('if-match')?.trim() ?? '';
  if (ifMatch === '' || ifMatch === '*') return error(428, '修改时必须带上 If-Match 请求头（项目的 ETag）');
  if (!matches(ifMatch, etagOf(project.version))) return error(412, '项目已经被修改过，请刷新之后再试');

  if (!isJson(request)) return error(415, '请求体必须是 JSON');
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, '请求体不是合法的 JSON');
  }
  const parsed = parseProjectPatch(body);
  if (!parsed.ok) return Response.json({ errors: parsed.errors }, { status: 422 });
  const { patch } = parsed;

  // 业务规则（p2-01）：改为现在的状态不算变化
  if (patch.status !== undefined && patch.status !== project.status) {
    if (!TRANSITIONS[project.status].includes(patch.status)) {
      return error(409, `不能从“${STATUS_NAMES[project.status]}”改为“${STATUS_NAMES[patch.status]}”`);
    }
    const left = project.tasks.filter((task) => task.deletedAt === null && !task.done).length;
    if (patch.status === 'done' && left > 0) return error(409, `还有 ${left} 个任务没有完成`);
  }

  const next: StoredProject = { ...project, ...patch, version: project.version + 1, updatedAt: deps.now() };
  // 读取之后别人修改了项目：客户端是根据旧的版本做的修改，不能替它重试
  if (!(await store.replace(next, project.version))) return error(412, '项目已经被修改过，请刷新之后再试');
  return Response.json(toProjectDto(next), { headers: { ETag: etagOf(next.version) } });
}
```
```ts file=main.ts readonly
import type { StoredProject } from './model';
import { patchProject } from './project';
import { createMemoryStore } from './store';

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
const deps = { now: () => new Date().toISOString(), newId: () => '' };
const patch = (body: string, ifMatch: string) =>
  new Request('https://projects.example/api/projects/p1', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'If-Match': ifMatch }, body });

// A 和 B 都是在版本 1 的时候打开的项目
const a = await patchProject(patch('{"name":"官网改版（二期）"}', '"v1"'), 'p1', store, deps);
console.log('A：', a.status, a.headers.get('etag'));
const b = await patchProject(patch('{"owner":"李雷"}', '"v1"'), 'p1', store, deps);
console.log('B：', b.status, await b.text());
console.log('保存的项目：', await store.get('p1'));
```
:::

:::files{role=tests}
```ts file=project.test.ts
import { describe, expect, test } from 'vitest';
import type { StoredProject, StoredTask } from './model';
import { etagOf, patchProject } from './project';
import { createMemoryStore, type Deps } from './store';

const NOW = '2026-10-21T10:00:00.000Z';
const deps: Deps = { now: () => NOW, newId: () => 'unused' };

const task = (id: string, done: boolean, deletedAt: string | null = null): StoredTask => ({
  id,
  title: `任务 ${id}`,
  done,
  position: Number(id.slice(1)),
  createdAt: '2026-10-01T00:00:00.000Z',
  deletedAt,
});

const base: StoredProject = {
  id: 'p1',
  name: '官网改版',
  owner: '王芳',
  ownerEmail: 'wang.fang@example.com',
  status: 'active',
  dueDate: '2026-12-31',
  version: 3,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-10-20T00:00:00.000Z',
  deletedAt: null,
  tasks: [task('t1', true), task('t2', false), task('t3', false, '2026-10-02T00:00:00.000Z')],
};

function patch(body: string, ifMatch: string | null = '"v3"', contentType = 'application/json') {
  const headers = new Headers({ 'Content-Type': contentType });
  if (ifMatch !== null) headers.set('If-Match', ifMatch);
  return new Request('https://projects.example/api/projects/p1', { method: 'PATCH', headers, body });
}

async function send(request: Request, project: StoredProject = base, projectId = 'p1') {
  const store = createMemoryStore([project]);
  const response = await patchProject(request, projectId, store, deps);
  return { store, response, status: response.status, body: await response.json() };
}

describe('patchProject', () => {
  test('ETag 是带引号的版本号', () => {
    expect(etagOf(7)).toBe('"v7"');
  });

  test('没有这个项目，或者已经删除：404（不管有没有 If-Match）', async () => {
    expect(await send(patch('{"name":"新"}'), base, 'p9')).toMatchObject({ status: 404, body: { error: '没有这个项目' } });
    expect((await send(patch('{"name":"新"}', null), { ...base, deletedAt: NOW })).status).toBe(404);
  });

  test('没有 If-Match，或者是 *：428', async () => {
    expect(await send(patch('{"name":"新"}', null))).toMatchObject({ status: 428, body: { error: '修改时必须带上 If-Match 请求头（项目的 ETag）' } });
    expect((await send(patch('{"name":"新"}', '*'))).status).toBe(428);
    expect((await send(patch('{"name":"新"}', ' '))).status).toBe(428);
  });

  test('版本不对：412；弱 ETag 不算；可以列出几个', async () => {
    expect(await send(patch('{"name":"新"}', '"v2"'))).toMatchObject({ status: 412, body: { error: '项目已经被修改过，请刷新之后再试' } });
    expect((await send(patch('{"name":"新"}', 'W/"v3"'))).status).toBe(412);
    expect((await send(patch('{"name":"新"}', 'v3'))).status).toBe(412);
    expect((await send(patch('{"name":"新"}', '"v2", "v3"'))).status).toBe(200);
  });

  test('先检查前提条件，再看请求体：版本不对时，格式错误的请求体也是 412', async () => {
    expect((await send(patch('{"name":', '"v1"'))).status).toBe(412);
    expect((await send(patch('{"name":"新"}', '"v1"', 'text/plain'))).status).toBe(412);
  });

  test('请求体：415、400、422', async () => {
    expect(await send(patch('{"name":"新"}', '"v3"', 'text/plain'))).toMatchObject({ status: 415, body: { error: '请求体必须是 JSON' } });
    expect(await send(patch('{"name":'))).toMatchObject({ status: 400, body: { error: '请求体不是合法的 JSON' } });
    const invalid = await send(patch('{"name":"","version":9}'));
    expect(invalid.status).toBe(422);
    expect(invalid.body).toStrictEqual({ errors: { name: '名称不能为空', version: '不能修改这个字段' } });
  });

  test('状态的规则：409', async () => {
    expect(await send(patch('{"status":"done"}', '"v3"'), { ...base, status: 'planning' })).toMatchObject({
      status: 409,
      body: { error: '不能从“计划中”改为“已完成”' },
    });
    // t2 没有完成；t3 没有完成，但已经删除了，不算
    expect(await send(patch('{"status":"done"}'))).toMatchObject({ status: 409, body: { error: '还有 1 个任务没有完成' } });
  });

  test('成功：200，返回新的项目和新的 ETag；没有发来的字段不变', async () => {
    const { store, response, status, body } = await send(patch('{"name":" 官网改版（二期） ","dueDate":null}'));
    expect(status).toBe(200);
    expect(response.headers.get('etag')).toBe('"v4"');
    expect(body).toStrictEqual({
      id: 'p1',
      name: '官网改版（二期）',
      owner: '王芳',
      status: 'active',
      dueDate: null,
      tasks: [
        { id: 't1', title: '任务 t1', done: true },
        { id: 't2', title: '任务 t2', done: false },
      ],
      version: 4,
      updatedAt: NOW,
    });
    const saved = await store.get('p1');
    expect(saved).toStrictEqual({ ...base, name: '官网改版（二期）', dueDate: null, version: 4, updatedAt: NOW });
  });

  test('改为现在的状态不算变化；所有任务都完成时可以完成项目', async () => {
    expect((await send(patch('{"status":"active"}'))).status).toBe(200);
    const allDone = { ...base, tasks: [task('t1', true), task('t3', false, NOW)] };
    expect(await send(patch('{"status":"done"}'), allDone)).toMatchObject({ status: 200, body: { status: 'done', version: 4 } });
  });

  test('读取之后别人修改了项目：412，不替客户端重试，什么都不写入', async () => {
    const store = createMemoryStore([base]);
    store.interfere(1);
    const response = await patchProject(patch('{"name":"新名称"}'), 'p1', store, deps);
    expect(response.status).toBe(412);
    expect(store.writes).toBe(1);
    expect((await store.get('p1'))?.name).toBe('官网改版*');
  });

  test('拿着新的 ETag 可以继续修改，旧的就不行了', async () => {
    const store = createMemoryStore([base]);
    const first = await patchProject(patch('{"owner":"李雷"}'), 'p1', store, deps);
    const etag = first.headers.get('etag') ?? '';
    expect((await patchProject(patch('{"owner":"韩梅梅"}', etag), 'p1', store, deps)).status).toBe(200);
    expect((await patchProject(patch('{"owner":"王芳"}', etag), 'p1', store, deps)).status).toBe(412);
    expect((await store.get('p1'))?.owner).toBe('韩梅梅');
  });
});
```
:::

:::hint{level=1}
`request.headers.get('if-match')` 没有这个请求头时是 `null`，用 `?.trim() ?? ''` 统一成字符串。几个 ETag 的情况：`ifMatch.split(',').some((item) => item.trim() === etag)`。前提条件放在读取请求体之前。
:::

:::hint{level=2}
合并用 `{ ...project, ...patch, version: project.version + 1, updatedAt: deps.now() }`：`patch` 中只有发来的字段（p3-01），没有发来的字段保持原样。成功的响应：`Response.json(dto, { headers: { ETag: etagOf(next.version) } })`。
:::

:::explanation
`If-Match` 让“我看到的是哪个版本”成为请求的一部分。服务器检查两次：开始时和 `If-Match` 比较，写入时 `replace` 再和保存的版本比较。第一次挡住了明显过时的请求（不用再解析请求体），第二次挡住了“检查之后、写入之前”别人插进来的修改。少了第二次，两个同时到达、都带着 `"v3"` 的请求就都会成功，后一个覆盖前一个。

428 让 `If-Match` 成为必需的：不带它的客户端（例如忘了改的旧版本）会立刻被发现，而不是偶尔悄悄覆盖别人的修改。`*` 的意思是“不管哪个版本都行”，等于没有说明，所以也当作没有。

弱 ETag（`W/"…"`）表示“内容在意义上相同”，例如只是压缩的方式不同；`If-Match` 规定用强比较，弱 ETag 永远对不上。这里的 ETag 就是版本号，一定是强的。

写入冲突时返回 412 而不是重试：客户端是看着旧的数据决定这次修改的。正文中“服务器能不能自己重试”一节比较了它和添加任务的不同。

替代解把检查拆成几个返回 `Response | null` 的步骤函数，主函数中按顺序调用，遇到第一个不是 `null` 的就返回；它先创建响应，再用 `headers.set` 加上 `ETag`。
:::

:::variant{kind=alt name=step-functions}
```ts file=project.ts
import { toProjectDto } from './dto';
import { STATUS_NAMES, TRANSITIONS, type ProjectStatus, type StoredProject } from './model';
import { parseProjectPatch } from './patch';
import type { Deps, ProjectStore } from './store';

export function etagOf(version: number): string {
  return `"v${version}"`;
}

/** 每一步要么通过，要么给出应该返回的响应：按顺序执行，遇到第一个响应就停下 */
type Step = Response | null;

const fail = (status: number, error: string): Response => Response.json({ error }, { status });

function checkPrecondition(header: string | null, project: StoredProject): Step {
  const value = (header ?? '').trim();
  if (value === '' || value === '*') return fail(428, '修改时必须带上 If-Match 请求头（项目的 ETag）');
  const current = etagOf(project.version);
  return value.split(',').map((tag) => tag.trim()).includes(current) ? null : fail(412, '项目已经被修改过，请刷新之后再试');
}

function checkStatus(project: StoredProject, wanted: ProjectStatus | undefined): Step {
  if (wanted === undefined || wanted === project.status) return null;
  if (!TRANSITIONS[project.status].includes(wanted)) return fail(409, `不能从“${STATUS_NAMES[project.status]}”改为“${STATUS_NAMES[wanted]}”`);
  if (wanted !== 'done') return null;
  let left = 0;
  for (const task of project.tasks) if (task.deletedAt === null && !task.done) left++;
  return left === 0 ? null : fail(409, `还有 ${left} 个任务没有完成`);
}

export async function patchProject(request: Request, projectId: string, store: ProjectStore, deps: Deps): Promise<Response> {
  const project = await store.get(projectId);
  if (project?.deletedAt !== null) return fail(404, '没有这个项目');

  const precondition = checkPrecondition(request.headers.get('If-Match'), project);
  if (precondition !== null) return precondition;

  const mediaType = request.headers.get('Content-Type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (mediaType !== 'application/json') return fail(415, '请求体必须是 JSON');
  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return fail(400, '请求体不是合法的 JSON');
  }
  const parsed = parseProjectPatch(body);
  if (!parsed.ok) return Response.json({ errors: parsed.errors }, { status: 422 });

  const rule = checkStatus(project, parsed.patch.status);
  if (rule !== null) return rule;

  const saved: StoredProject = { ...project, ...parsed.patch, version: project.version + 1, updatedAt: deps.now() };
  const written = await store.replace(saved, project.version);
  if (!written) return fail(412, '项目已经被修改过，请刷新之后再试');
  const response = Response.json(toProjectDto(saved));
  response.headers.set('ETag', etagOf(saved.version));
  return response;
}
```
:::

:::variant{kind=wrong name=body-before-precondition fails=tests reason="先检查请求体再检查 If-Match：版本已经过时的请求被报告成请求体有错误，修好之后还是失败"}
```ts file=project.ts
import { toProjectDto } from './dto';
import { STATUS_NAMES, TRANSITIONS, type StoredProject } from './model';
import { parseProjectPatch } from './patch';
import type { Deps, ProjectStore } from './store';

/** 项目的 ETag：带引号的版本号，例如 "v7" */
export const etagOf = (version: number) => `"v${version}"`;

const error = (status: number, message: string) => Response.json({ error: message }, { status });

function isJson(request: Request): boolean {
  const type = request.headers.get('content-type') ?? '';
  return (type.split(';')[0] ?? '').trim().toLowerCase() === 'application/json';
}

/** If-Match 可以列出几个 ETag，用逗号分隔；任何一个和现在的完全相同就行（强比较：W/ 开头的弱 ETag 不算） */
function matches(ifMatch: string, etag: string): boolean {
  return ifMatch.split(',').some((item) => item.trim() === etag);
}

/** PATCH /api/projects/:projectId：请求头 If-Match 是客户端看到的版本，请求体见 p3-01 的 parseProjectPatch */
export async function patchProject(request: Request, projectId: string, store: ProjectStore, deps: Deps): Promise<Response> {
  const project = await store.get(projectId);
  if (project === null || project.deletedAt !== null) return error(404, '没有这个项目');

  if (!isJson(request)) return error(415, '请求体必须是 JSON');
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, '请求体不是合法的 JSON');
  }
  const parsed = parseProjectPatch(body);
  if (!parsed.ok) return Response.json({ errors: parsed.errors }, { status: 422 });
  const { patch } = parsed;
  const ifMatch = request.headers.get('if-match')?.trim() ?? '';
  if (ifMatch === '' || ifMatch === '*') return error(428, '修改时必须带上 If-Match 请求头（项目的 ETag）');
  if (!matches(ifMatch, etagOf(project.version))) return error(412, '项目已经被修改过，请刷新之后再试');

  // 业务规则（p2-01）：改为现在的状态不算变化
  if (patch.status !== undefined && patch.status !== project.status) {
    if (!TRANSITIONS[project.status].includes(patch.status)) {
      return error(409, `不能从“${STATUS_NAMES[project.status]}”改为“${STATUS_NAMES[patch.status]}”`);
    }
    const left = project.tasks.filter((task) => task.deletedAt === null && !task.done).length;
    if (patch.status === 'done' && left > 0) return error(409, `还有 ${left} 个任务没有完成`);
  }

  const next: StoredProject = { ...project, ...patch, version: project.version + 1, updatedAt: deps.now() };
  // 读取之后别人修改了项目：客户端是根据旧的版本做的修改，不能替它重试
  if (!(await store.replace(next, project.version))) return error(412, '项目已经被修改过，请刷新之后再试');
  return Response.json(toProjectDto(next), { headers: { ETag: etagOf(next.version) } });
}
```
:::

:::variant{kind=wrong name=star-accepted fails=tests reason="接受了 If-Match: *：客户端不用说明看到的是哪个版本，并发的修改又会互相覆盖"}
```ts file=project.ts
import { toProjectDto } from './dto';
import { STATUS_NAMES, TRANSITIONS, type StoredProject } from './model';
import { parseProjectPatch } from './patch';
import type { Deps, ProjectStore } from './store';

/** 项目的 ETag：带引号的版本号，例如 "v7" */
export const etagOf = (version: number) => `"v${version}"`;

const error = (status: number, message: string) => Response.json({ error: message }, { status });

function isJson(request: Request): boolean {
  const type = request.headers.get('content-type') ?? '';
  return (type.split(';')[0] ?? '').trim().toLowerCase() === 'application/json';
}

/** If-Match 可以列出几个 ETag，用逗号分隔；任何一个和现在的完全相同就行（强比较：W/ 开头的弱 ETag 不算） */
function matches(ifMatch: string, etag: string): boolean {
  return ifMatch.split(',').some((item) => item.trim() === etag);
}

/** PATCH /api/projects/:projectId：请求头 If-Match 是客户端看到的版本，请求体见 p3-01 的 parseProjectPatch */
export async function patchProject(request: Request, projectId: string, store: ProjectStore, deps: Deps): Promise<Response> {
  const project = await store.get(projectId);
  if (project === null || project.deletedAt !== null) return error(404, '没有这个项目');

  // 先检查前提条件（RFC 9110）：版本不对时，请求体是什么都没有意义
  const ifMatch = request.headers.get('if-match')?.trim() ?? '';
  if (ifMatch === '') return error(428, '修改时必须带上 If-Match 请求头（项目的 ETag）');
  if (ifMatch !== '*' && !matches(ifMatch, etagOf(project.version))) return error(412, '项目已经被修改过，请刷新之后再试');

  if (!isJson(request)) return error(415, '请求体必须是 JSON');
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, '请求体不是合法的 JSON');
  }
  const parsed = parseProjectPatch(body);
  if (!parsed.ok) return Response.json({ errors: parsed.errors }, { status: 422 });
  const { patch } = parsed;

  // 业务规则（p2-01）：改为现在的状态不算变化
  if (patch.status !== undefined && patch.status !== project.status) {
    if (!TRANSITIONS[project.status].includes(patch.status)) {
      return error(409, `不能从“${STATUS_NAMES[project.status]}”改为“${STATUS_NAMES[patch.status]}”`);
    }
    const left = project.tasks.filter((task) => task.deletedAt === null && !task.done).length;
    if (patch.status === 'done' && left > 0) return error(409, `还有 ${left} 个任务没有完成`);
  }

  const next: StoredProject = { ...project, ...patch, version: project.version + 1, updatedAt: deps.now() };
  // 读取之后别人修改了项目：客户端是根据旧的版本做的修改，不能替它重试
  if (!(await store.replace(next, project.version))) return error(412, '项目已经被修改过，请刷新之后再试');
  return Response.json(toProjectDto(next), { headers: { ETag: etagOf(next.version) } });
}
```
:::

:::variant{kind=wrong name=weak-compare fails=tests reason="比较时去掉了 W/：弱 ETag 只表示内容大致相同，不能用来防止并发的修改"}
```ts file=project.ts
import { toProjectDto } from './dto';
import { STATUS_NAMES, TRANSITIONS, type StoredProject } from './model';
import { parseProjectPatch } from './patch';
import type { Deps, ProjectStore } from './store';

/** 项目的 ETag：带引号的版本号，例如 "v7" */
export const etagOf = (version: number) => `"v${version}"`;

const error = (status: number, message: string) => Response.json({ error: message }, { status });

function isJson(request: Request): boolean {
  const type = request.headers.get('content-type') ?? '';
  return (type.split(';')[0] ?? '').trim().toLowerCase() === 'application/json';
}

/** If-Match 可以列出几个 ETag，用逗号分隔；任何一个和现在的完全相同就行（强比较：W/ 开头的弱 ETag 不算） */
function matches(ifMatch: string, etag: string): boolean {
  return ifMatch.split(',').some((item) => item.trim().replace(/^W\//, '') === etag);
}

/** PATCH /api/projects/:projectId：请求头 If-Match 是客户端看到的版本，请求体见 p3-01 的 parseProjectPatch */
export async function patchProject(request: Request, projectId: string, store: ProjectStore, deps: Deps): Promise<Response> {
  const project = await store.get(projectId);
  if (project === null || project.deletedAt !== null) return error(404, '没有这个项目');

  // 先检查前提条件（RFC 9110）：版本不对时，请求体是什么都没有意义
  const ifMatch = request.headers.get('if-match')?.trim() ?? '';
  if (ifMatch === '' || ifMatch === '*') return error(428, '修改时必须带上 If-Match 请求头（项目的 ETag）');
  if (!matches(ifMatch, etagOf(project.version))) return error(412, '项目已经被修改过，请刷新之后再试');

  if (!isJson(request)) return error(415, '请求体必须是 JSON');
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, '请求体不是合法的 JSON');
  }
  const parsed = parseProjectPatch(body);
  if (!parsed.ok) return Response.json({ errors: parsed.errors }, { status: 422 });
  const { patch } = parsed;

  // 业务规则（p2-01）：改为现在的状态不算变化
  if (patch.status !== undefined && patch.status !== project.status) {
    if (!TRANSITIONS[project.status].includes(patch.status)) {
      return error(409, `不能从“${STATUS_NAMES[project.status]}”改为“${STATUS_NAMES[patch.status]}”`);
    }
    const left = project.tasks.filter((task) => task.deletedAt === null && !task.done).length;
    if (patch.status === 'done' && left > 0) return error(409, `还有 ${left} 个任务没有完成`);
  }

  const next: StoredProject = { ...project, ...patch, version: project.version + 1, updatedAt: deps.now() };
  // 读取之后别人修改了项目：客户端是根据旧的版本做的修改，不能替它重试
  if (!(await store.replace(next, project.version))) return error(412, '项目已经被修改过，请刷新之后再试');
  return Response.json(toProjectDto(next), { headers: { ETag: etagOf(next.version) } });
}
```
:::

:::variant{kind=wrong name=retry-patch fails=tests reason="写入冲突时在新的数据上重试：客户端是根据旧的数据做的决定，这就是丢失的更新"}
```ts file=project.ts
import { toProjectDto } from './dto';
import { STATUS_NAMES, TRANSITIONS, type StoredProject } from './model';
import { parseProjectPatch } from './patch';
import type { Deps, ProjectStore } from './store';

/** 项目的 ETag：带引号的版本号，例如 "v7" */
export const etagOf = (version: number) => `"v${version}"`;

const error = (status: number, message: string) => Response.json({ error: message }, { status });

function isJson(request: Request): boolean {
  const type = request.headers.get('content-type') ?? '';
  return (type.split(';')[0] ?? '').trim().toLowerCase() === 'application/json';
}

/** If-Match 可以列出几个 ETag，用逗号分隔；任何一个和现在的完全相同就行（强比较：W/ 开头的弱 ETag 不算） */
function matches(ifMatch: string, etag: string): boolean {
  return ifMatch.split(',').some((item) => item.trim() === etag);
}

/** PATCH /api/projects/:projectId：请求头 If-Match 是客户端看到的版本，请求体见 p3-01 的 parseProjectPatch */
export async function patchProject(request: Request, projectId: string, store: ProjectStore, deps: Deps): Promise<Response> {
  const project = await store.get(projectId);
  if (project === null || project.deletedAt !== null) return error(404, '没有这个项目');

  // 先检查前提条件（RFC 9110）：版本不对时，请求体是什么都没有意义
  const ifMatch = request.headers.get('if-match')?.trim() ?? '';
  if (ifMatch === '' || ifMatch === '*') return error(428, '修改时必须带上 If-Match 请求头（项目的 ETag）');
  if (!matches(ifMatch, etagOf(project.version))) return error(412, '项目已经被修改过，请刷新之后再试');

  if (!isJson(request)) return error(415, '请求体必须是 JSON');
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, '请求体不是合法的 JSON');
  }
  const parsed = parseProjectPatch(body);
  if (!parsed.ok) return Response.json({ errors: parsed.errors }, { status: 422 });
  const { patch } = parsed;

  // 业务规则（p2-01）：改为现在的状态不算变化
  if (patch.status !== undefined && patch.status !== project.status) {
    if (!TRANSITIONS[project.status].includes(patch.status)) {
      return error(409, `不能从“${STATUS_NAMES[project.status]}”改为“${STATUS_NAMES[patch.status]}”`);
    }
    const left = project.tasks.filter((task) => task.deletedAt === null && !task.done).length;
    if (patch.status === 'done' && left > 0) return error(409, `还有 ${left} 个任务没有完成`);
  }

  const next: StoredProject = { ...project, ...patch, version: project.version + 1, updatedAt: deps.now() };
  // 读取之后别人修改了项目：客户端是根据旧的版本做的修改，不能替它重试
  if (!(await store.replace(next, project.version))) {
    const fresh = await store.get(projectId);
    if (fresh === null || !(await store.replace({ ...fresh, ...patch, version: fresh.version + 1, updatedAt: deps.now() }, fresh.version))) {
      return error(412, '项目已经被修改过，请刷新之后再试');
    }
  }
  return Response.json(toProjectDto(next), { headers: { ETag: etagOf(next.version) } });
}
```
:::

:::variant{kind=wrong name=deleted-tasks-unfinished fails=tests reason="删除了的任务也算没有完成：有删除的任务的项目永远不能完成"}
```ts file=project.ts
import { toProjectDto } from './dto';
import { STATUS_NAMES, TRANSITIONS, type StoredProject } from './model';
import { parseProjectPatch } from './patch';
import type { Deps, ProjectStore } from './store';

/** 项目的 ETag：带引号的版本号，例如 "v7" */
export const etagOf = (version: number) => `"v${version}"`;

const error = (status: number, message: string) => Response.json({ error: message }, { status });

function isJson(request: Request): boolean {
  const type = request.headers.get('content-type') ?? '';
  return (type.split(';')[0] ?? '').trim().toLowerCase() === 'application/json';
}

/** If-Match 可以列出几个 ETag，用逗号分隔；任何一个和现在的完全相同就行（强比较：W/ 开头的弱 ETag 不算） */
function matches(ifMatch: string, etag: string): boolean {
  return ifMatch.split(',').some((item) => item.trim() === etag);
}

/** PATCH /api/projects/:projectId：请求头 If-Match 是客户端看到的版本，请求体见 p3-01 的 parseProjectPatch */
export async function patchProject(request: Request, projectId: string, store: ProjectStore, deps: Deps): Promise<Response> {
  const project = await store.get(projectId);
  if (project === null || project.deletedAt !== null) return error(404, '没有这个项目');

  // 先检查前提条件（RFC 9110）：版本不对时，请求体是什么都没有意义
  const ifMatch = request.headers.get('if-match')?.trim() ?? '';
  if (ifMatch === '' || ifMatch === '*') return error(428, '修改时必须带上 If-Match 请求头（项目的 ETag）');
  if (!matches(ifMatch, etagOf(project.version))) return error(412, '项目已经被修改过，请刷新之后再试');

  if (!isJson(request)) return error(415, '请求体必须是 JSON');
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, '请求体不是合法的 JSON');
  }
  const parsed = parseProjectPatch(body);
  if (!parsed.ok) return Response.json({ errors: parsed.errors }, { status: 422 });
  const { patch } = parsed;

  // 业务规则（p2-01）：改为现在的状态不算变化
  if (patch.status !== undefined && patch.status !== project.status) {
    if (!TRANSITIONS[project.status].includes(patch.status)) {
      return error(409, `不能从“${STATUS_NAMES[project.status]}”改为“${STATUS_NAMES[patch.status]}”`);
    }
    const left = project.tasks.filter((task) => !task.done).length;
    if (patch.status === 'done' && left > 0) return error(409, `还有 ${left} 个任务没有完成`);
  }

  const next: StoredProject = { ...project, ...patch, version: project.version + 1, updatedAt: deps.now() };
  // 读取之后别人修改了项目：客户端是根据旧的版本做的修改，不能替它重试
  if (!(await store.replace(next, project.version))) return error(412, '项目已经被修改过，请刷新之后再试');
  return Response.json(toProjectDto(next), { headers: { ETag: etagOf(next.version) } });
}
```
:::

:::variant{kind=wrong name=no-transition-check fails=tests reason="没有检查转换表：计划中的项目可以直接改为已完成"}
```ts file=project.ts
import { toProjectDto } from './dto';
import { STATUS_NAMES, TRANSITIONS, type StoredProject } from './model';
import { parseProjectPatch } from './patch';
import type { Deps, ProjectStore } from './store';

/** 项目的 ETag：带引号的版本号，例如 "v7" */
export const etagOf = (version: number) => `"v${version}"`;

const error = (status: number, message: string) => Response.json({ error: message }, { status });

function isJson(request: Request): boolean {
  const type = request.headers.get('content-type') ?? '';
  return (type.split(';')[0] ?? '').trim().toLowerCase() === 'application/json';
}

/** If-Match 可以列出几个 ETag，用逗号分隔；任何一个和现在的完全相同就行（强比较：W/ 开头的弱 ETag 不算） */
function matches(ifMatch: string, etag: string): boolean {
  return ifMatch.split(',').some((item) => item.trim() === etag);
}

/** PATCH /api/projects/:projectId：请求头 If-Match 是客户端看到的版本，请求体见 p3-01 的 parseProjectPatch */
export async function patchProject(request: Request, projectId: string, store: ProjectStore, deps: Deps): Promise<Response> {
  const project = await store.get(projectId);
  if (project === null || project.deletedAt !== null) return error(404, '没有这个项目');

  // 先检查前提条件（RFC 9110）：版本不对时，请求体是什么都没有意义
  const ifMatch = request.headers.get('if-match')?.trim() ?? '';
  if (ifMatch === '' || ifMatch === '*') return error(428, '修改时必须带上 If-Match 请求头（项目的 ETag）');
  if (!matches(ifMatch, etagOf(project.version))) return error(412, '项目已经被修改过，请刷新之后再试');

  if (!isJson(request)) return error(415, '请求体必须是 JSON');
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, '请求体不是合法的 JSON');
  }
  const parsed = parseProjectPatch(body);
  if (!parsed.ok) return Response.json({ errors: parsed.errors }, { status: 422 });
  const { patch } = parsed;

  // 业务规则（p2-01）：改为现在的状态不算变化
  if (patch.status !== undefined && patch.status !== project.status) {
    const left = project.tasks.filter((task) => task.deletedAt === null && !task.done).length;
    if (patch.status === 'done' && left > 0) return error(409, `还有 ${left} 个任务没有完成`);
  }

  const next: StoredProject = { ...project, ...patch, version: project.version + 1, updatedAt: deps.now() };
  // 读取之后别人修改了项目：客户端是根据旧的版本做的修改，不能替它重试
  if (!(await store.replace(next, project.version))) return error(412, '项目已经被修改过，请刷新之后再试');
  return Response.json(toProjectDto(next), { headers: { ETag: etagOf(next.version) } });
}
```
:::

:::variant{kind=wrong name=same-status-checked fails=tests reason="改为现在的状态也按转换表检查：只改名称、顺便带上原来的状态的请求被拒绝了"}
```ts file=project.ts
import { toProjectDto } from './dto';
import { STATUS_NAMES, TRANSITIONS, type StoredProject } from './model';
import { parseProjectPatch } from './patch';
import type { Deps, ProjectStore } from './store';

/** 项目的 ETag：带引号的版本号，例如 "v7" */
export const etagOf = (version: number) => `"v${version}"`;

const error = (status: number, message: string) => Response.json({ error: message }, { status });

function isJson(request: Request): boolean {
  const type = request.headers.get('content-type') ?? '';
  return (type.split(';')[0] ?? '').trim().toLowerCase() === 'application/json';
}

/** If-Match 可以列出几个 ETag，用逗号分隔；任何一个和现在的完全相同就行（强比较：W/ 开头的弱 ETag 不算） */
function matches(ifMatch: string, etag: string): boolean {
  return ifMatch.split(',').some((item) => item.trim() === etag);
}

/** PATCH /api/projects/:projectId：请求头 If-Match 是客户端看到的版本，请求体见 p3-01 的 parseProjectPatch */
export async function patchProject(request: Request, projectId: string, store: ProjectStore, deps: Deps): Promise<Response> {
  const project = await store.get(projectId);
  if (project === null || project.deletedAt !== null) return error(404, '没有这个项目');

  // 先检查前提条件（RFC 9110）：版本不对时，请求体是什么都没有意义
  const ifMatch = request.headers.get('if-match')?.trim() ?? '';
  if (ifMatch === '' || ifMatch === '*') return error(428, '修改时必须带上 If-Match 请求头（项目的 ETag）');
  if (!matches(ifMatch, etagOf(project.version))) return error(412, '项目已经被修改过，请刷新之后再试');

  if (!isJson(request)) return error(415, '请求体必须是 JSON');
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, '请求体不是合法的 JSON');
  }
  const parsed = parseProjectPatch(body);
  if (!parsed.ok) return Response.json({ errors: parsed.errors }, { status: 422 });
  const { patch } = parsed;

  // 业务规则（p2-01）：改为现在的状态不算变化
  if (patch.status !== undefined) {
    if (!TRANSITIONS[project.status].includes(patch.status)) {
      return error(409, `不能从“${STATUS_NAMES[project.status]}”改为“${STATUS_NAMES[patch.status]}”`);
    }
    const left = project.tasks.filter((task) => task.deletedAt === null && !task.done).length;
    if (patch.status === 'done' && left > 0) return error(409, `还有 ${left} 个任务没有完成`);
  }

  const next: StoredProject = { ...project, ...patch, version: project.version + 1, updatedAt: deps.now() };
  // 读取之后别人修改了项目：客户端是根据旧的版本做的修改，不能替它重试
  if (!(await store.replace(next, project.version))) return error(412, '项目已经被修改过，请刷新之后再试');
  return Response.json(toProjectDto(next), { headers: { ETag: etagOf(next.version) } });
}
```
:::

:::variant{kind=wrong name=no-new-etag fails=tests reason="成功的响应没有带上新的 ETag：客户端下一次修改时只有旧的版本，必然 412"}
```ts file=project.ts
import { toProjectDto } from './dto';
import { STATUS_NAMES, TRANSITIONS, type StoredProject } from './model';
import { parseProjectPatch } from './patch';
import type { Deps, ProjectStore } from './store';

/** 项目的 ETag：带引号的版本号，例如 "v7" */
export const etagOf = (version: number) => `"v${version}"`;

const error = (status: number, message: string) => Response.json({ error: message }, { status });

function isJson(request: Request): boolean {
  const type = request.headers.get('content-type') ?? '';
  return (type.split(';')[0] ?? '').trim().toLowerCase() === 'application/json';
}

/** If-Match 可以列出几个 ETag，用逗号分隔；任何一个和现在的完全相同就行（强比较：W/ 开头的弱 ETag 不算） */
function matches(ifMatch: string, etag: string): boolean {
  return ifMatch.split(',').some((item) => item.trim() === etag);
}

/** PATCH /api/projects/:projectId：请求头 If-Match 是客户端看到的版本，请求体见 p3-01 的 parseProjectPatch */
export async function patchProject(request: Request, projectId: string, store: ProjectStore, deps: Deps): Promise<Response> {
  const project = await store.get(projectId);
  if (project === null || project.deletedAt !== null) return error(404, '没有这个项目');

  // 先检查前提条件（RFC 9110）：版本不对时，请求体是什么都没有意义
  const ifMatch = request.headers.get('if-match')?.trim() ?? '';
  if (ifMatch === '' || ifMatch === '*') return error(428, '修改时必须带上 If-Match 请求头（项目的 ETag）');
  if (!matches(ifMatch, etagOf(project.version))) return error(412, '项目已经被修改过，请刷新之后再试');

  if (!isJson(request)) return error(415, '请求体必须是 JSON');
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, '请求体不是合法的 JSON');
  }
  const parsed = parseProjectPatch(body);
  if (!parsed.ok) return Response.json({ errors: parsed.errors }, { status: 422 });
  const { patch } = parsed;

  // 业务规则（p2-01）：改为现在的状态不算变化
  if (patch.status !== undefined && patch.status !== project.status) {
    if (!TRANSITIONS[project.status].includes(patch.status)) {
      return error(409, `不能从“${STATUS_NAMES[project.status]}”改为“${STATUS_NAMES[patch.status]}”`);
    }
    const left = project.tasks.filter((task) => task.deletedAt === null && !task.done).length;
    if (patch.status === 'done' && left > 0) return error(409, `还有 ${left} 个任务没有完成`);
  }

  const next: StoredProject = { ...project, ...patch, version: project.version + 1, updatedAt: deps.now() };
  // 读取之后别人修改了项目：客户端是根据旧的版本做的修改，不能替它重试
  if (!(await store.replace(next, project.version))) return error(412, '项目已经被修改过，请刷新之后再试');
  return Response.json(toProjectDto(next));
}
```
:::

