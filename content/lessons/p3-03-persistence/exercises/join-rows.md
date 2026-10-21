---
kind: challenge
title: 把 JOIN 的结果还原成项目
---
在 `rows.ts` 中实现 `rowsToProjects(rows)`：把 `projects LEFT JOIN tasks` 的查询结果（`JoinedRow` 的数组，见 `rows.ts` 中的类型）还原成 `StoredProject` 的数组（类型见只读的 `model.ts`）。

1. 每个不同的项目 `id` 对应一个 `StoredProject`，按这个 `id` **第一次出现**的顺序排列；项目的字段来自这个项目的行，列名从 `snake_case` 换成驼峰（`owner_email` → `ownerEmail`，`due_date` → `dueDate`，依此类推）；
2. `task_id` 是 `null` 的行没有任务（`LEFT JOIN` 中没有任务的项目）；其他每一行是这个项目的一个任务：`task_title` → `title`、`task_position` → `position`、`task_created_at` → `createdAt`、`task_deleted_at` → `deletedAt`，`task_done` 是 0 或者 1，换成 `false` 或者 `true`；
3. 每个项目的 `tasks` 按 `position` 从小到大排序，不依赖行的顺序；没有任务时是 `[]`；
4. 数据不对时抛出 `Error`，信息以 `数据库中的数据不对：` 开头：
   - `status` 不是三种状态之一：`数据库中的数据不对：项目 p1 的 status 是 archived`；
   - `task_id` 不是 `null`，但 `task_title`、`task_position` 或者 `task_created_at` 是 `null`：`数据库中的数据不对：项目 p1 的任务 t9 缺少字段`；
   - `task_done` 不是 0 也不是 1：`数据库中的数据不对：项目 p1 的任务 t9 的 done 是 2`。

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
:::

:::files{role=starter}
```ts file=rows.ts
import { STATUSES, type StoredProject, type StoredTask } from './model';

/**
 * SELECT p.*, t.id AS task_id, t.title AS task_title, …
 * FROM projects p LEFT JOIN tasks t ON t.project_id = p.id
 * 的一行：每个任务一行；没有任务的项目也有一行，任务的列都是 null
 */
export type JoinedRow = Readonly<{
  id: string;
  name: string;
  owner: string;
  owner_email: string;
  status: string;
  due_date: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  task_id: string | null;
  task_title: string | null;
  task_done: number | null;
  task_position: number | null;
  task_created_at: string | null;
  task_deleted_at: string | null;
}>;

/** 把 JOIN 的结果还原成项目：项目按第一次出现的顺序，任务按 position 排序 */
export function rowsToProjects(rows: readonly JoinedRow[]): StoredProject[] {
  // TODO
  return [];
}
```
```ts file=main.ts readonly
import { rowsToProjects, type JoinedRow } from './rows';

const base = {
  owner: '王芳', owner_email: 'wang.fang@example.com', status: 'active', due_date: null, version: 1,
  created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z', deleted_at: null,
};
const noTask = { task_id: null, task_title: null, task_done: null, task_position: null, task_created_at: null, task_deleted_at: null };
const rows: JoinedRow[] = [
  { ...base, id: 'p1', name: '官网改版', ...noTask, task_id: 't2', task_title: '上线', task_done: 0, task_position: 2, task_created_at: base.created_at },
  { ...base, id: 'p1', name: '官网改版', ...noTask, task_id: 't1', task_title: '设计稿', task_done: 1, task_position: 1, task_created_at: base.created_at },
  { ...base, id: 'p2', name: '年度报告', ...noTask },
];
console.log(JSON.stringify(rowsToProjects(rows), null, 2));
```
:::

:::files{role=solution}
```ts file=rows.ts
import { STATUSES, type StoredProject, type StoredTask } from './model';

/**
 * SELECT p.*, t.id AS task_id, t.title AS task_title, …
 * FROM projects p LEFT JOIN tasks t ON t.project_id = p.id
 * 的一行：每个任务一行；没有任务的项目也有一行，任务的列都是 null
 */
export type JoinedRow = Readonly<{
  id: string;
  name: string;
  owner: string;
  owner_email: string;
  status: string;
  due_date: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  task_id: string | null;
  task_title: string | null;
  task_done: number | null;
  task_position: number | null;
  task_created_at: string | null;
  task_deleted_at: string | null;
}>;

/** 数据库中的数据不对：这是程序或者数据的错误，不是用户的错误，所以抛出 */
function corrupt(message: string): never {
  throw new Error(`数据库中的数据不对：${message}`);
}

function toTask(row: JoinedRow): StoredTask | null {
  if (row.task_id === null) return null;
  const where = `项目 ${row.id} 的任务 ${row.task_id}`;
  if (row.task_title === null || row.task_position === null || row.task_created_at === null) corrupt(`${where} 缺少字段`);
  // SQLite 没有布尔类型：保存的是 0 和 1
  if (row.task_done !== 0 && row.task_done !== 1) corrupt(`${where} 的 done 是 ${row.task_done}`);
  return {
    id: row.task_id,
    title: row.task_title,
    done: row.task_done === 1,
    position: row.task_position,
    createdAt: row.task_created_at,
    deletedAt: row.task_deleted_at,
  };
}

/** 把 JOIN 的结果还原成项目：项目按第一次出现的顺序，任务按 position 排序 */
export function rowsToProjects(rows: readonly JoinedRow[]): StoredProject[] {
  const projects = new Map<string, { project: Omit<StoredProject, 'tasks'>; tasks: StoredTask[] }>();
  for (const row of rows) {
    let entry = projects.get(row.id);
    if (entry === undefined) {
      const status = STATUSES.find((s) => s === row.status) ?? corrupt(`项目 ${row.id} 的 status 是 ${row.status}`);
      entry = {
        project: {
          id: row.id,
          name: row.name,
          owner: row.owner,
          ownerEmail: row.owner_email,
          status,
          dueDate: row.due_date,
          version: row.version,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          deletedAt: row.deleted_at,
        },
        tasks: [],
      };
      projects.set(row.id, entry);
    }
    const task = toTask(row);
    if (task !== null) entry.tasks.push(task);
  }
  return [...projects.values()].map(({ project, tasks }) => ({ ...project, tasks: tasks.toSorted((a, b) => a.position - b.position) }));
}
```
```ts file=main.ts readonly
import { rowsToProjects, type JoinedRow } from './rows';

const base = {
  owner: '王芳', owner_email: 'wang.fang@example.com', status: 'active', due_date: null, version: 1,
  created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z', deleted_at: null,
};
const noTask = { task_id: null, task_title: null, task_done: null, task_position: null, task_created_at: null, task_deleted_at: null };
const rows: JoinedRow[] = [
  { ...base, id: 'p1', name: '官网改版', ...noTask, task_id: 't2', task_title: '上线', task_done: 0, task_position: 2, task_created_at: base.created_at },
  { ...base, id: 'p1', name: '官网改版', ...noTask, task_id: 't1', task_title: '设计稿', task_done: 1, task_position: 1, task_created_at: base.created_at },
  { ...base, id: 'p2', name: '年度报告', ...noTask },
];
console.log(JSON.stringify(rowsToProjects(rows), null, 2));
```
:::

:::files{role=tests}
```ts file=rows.test.ts
import { describe, expect, test } from 'vitest';
import { rowsToProjects, type JoinedRow } from './rows';

const T0 = '2026-10-01T00:00:00.000Z';

const project = (id: string, extra: Partial<JoinedRow> = {}): JoinedRow => ({
  id,
  name: `项目 ${id}`,
  owner: '王芳',
  owner_email: 'wang.fang@example.com',
  status: 'active',
  due_date: null,
  version: 1,
  created_at: T0,
  updated_at: T0,
  deleted_at: null,
  task_id: null,
  task_title: null,
  task_done: null,
  task_position: null,
  task_created_at: null,
  task_deleted_at: null,
  ...extra,
});

const withTask = (projectId: string, taskId: string, position: number, done = 0, deletedAt: string | null = null): JoinedRow =>
  project(projectId, { task_id: taskId, task_title: `任务 ${taskId}`, task_done: done, task_position: position, task_created_at: T0, task_deleted_at: deletedAt });

describe('rowsToProjects', () => {
  test('每个任务一行：合并成一个项目，列名换成驼峰，0 和 1 换成布尔值', () => {
    const rows = [withTask('p1', 't1', 1, 1), withTask('p1', 't2', 2, 0, '2026-10-02T00:00:00.000Z')];
    expect(rowsToProjects(rows)).toStrictEqual([
      {
        id: 'p1',
        name: '项目 p1',
        owner: '王芳',
        ownerEmail: 'wang.fang@example.com',
        status: 'active',
        dueDate: null,
        version: 1,
        createdAt: T0,
        updatedAt: T0,
        deletedAt: null,
        tasks: [
          { id: 't1', title: '任务 t1', done: true, position: 1, createdAt: T0, deletedAt: null },
          { id: 't2', title: '任务 t2', done: false, position: 2, createdAt: T0, deletedAt: '2026-10-02T00:00:00.000Z' },
        ],
      },
    ]);
  });

  test('没有任务的项目：LEFT JOIN 给出一行，任务的列都是 null', () => {
    const result = rowsToProjects([project('p2', { status: 'planning', due_date: '2026-12-31' })]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'p2', status: 'planning', dueDate: '2026-12-31', tasks: [] });
  });

  test('项目按第一次出现的顺序；任务按 position 排序，不依赖行的顺序', () => {
    const rows = [withTask('p2', 'a', 3), withTask('p1', 'x', 1), withTask('p2', 'b', 1), project('p3'), withTask('p2', 'c', 2)];
    const result = rowsToProjects(rows);
    expect(result.map((p) => p.id)).toStrictEqual(['p2', 'p1', 'p3']);
    expect(result[0]?.tasks.map((t) => t.id)).toStrictEqual(['b', 'c', 'a']);
  });

  test('没有行：空的数组', () => {
    expect(rowsToProjects([])).toStrictEqual([]);
  });

  test('数据库中的数据不对：抛出错误，信息中有项目和任务的 id', () => {
    expect(() => rowsToProjects([project('p1', { status: 'archived' })])).toThrow('数据库中的数据不对：项目 p1 的 status 是 archived');
    expect(() => rowsToProjects([withTask('p1', 't9', 1, 2)])).toThrow('数据库中的数据不对：项目 p1 的任务 t9 的 done 是 2');
    expect(() => rowsToProjects([project('p1', { task_id: 't9', task_done: 0, task_position: 1, task_created_at: T0 })])).toThrow('数据库中的数据不对：项目 p1 的任务 t9 缺少字段');
  });

  test('每个项目的任务是独立的数组', () => {
    const [a, b] = rowsToProjects([withTask('p1', 't1', 1), withTask('p2', 't2', 1)]);
    expect(a?.tasks.map((t) => t.id)).toStrictEqual(['t1']);
    expect(b?.tasks.map((t) => t.id)).toStrictEqual(['t2']);
  });
});
```
:::

:::hint{level=1}
用一个 `Map`，键是项目的 `id`，值是“项目的字段”和“任务的数组”。`Map` 按放入的顺序遍历，正好是第一次出现的顺序。最后把每个值变成一个 `StoredProject`，任务排好序。
:::

:::hint{level=2}
写一个返回 `never` 的函数 `corrupt(message)` 专门抛出错误：`if (row.task_title === null) corrupt(…)` 之后，TypeScript 就知道 `row.task_title` 是字符串了。状态的检查：`STATUSES.find((s) => s === row.status) ?? corrupt(…)`，结果的类型是 `ProjectStatus`。
:::

:::explanation
`JOIN` 的结果是一张平的表：项目的列在它的每个任务的行中都重复一次。还原成嵌套的对象，就是按项目的 `id` 分组。用 `Map` 而不是“和上一行比较”：后者假设同一个项目的行是相邻的，只有 SQL 中写了合适的 `ORDER BY` 才成立；`Map` 不依赖行的顺序。同样，任务在代码中再按 `position` 排一次。

这里的错误用抛出，而不是像 p2-01 的业务规则那样返回结果：数据库中出现了 `done` 是 2 的任务，说明程序有 bug 或者数据被别的东西改坏了，调用方没有办法“处理”它，接口应该返回 500，并把错误记录下来（i03）。表结构中的 `CHECK` 约束本来就会挡住这样的数据（正文中实测），这里的检查是第二道保险：数据可能来自没有这些约束的旧的表结构，或者另一个程序。

替代解用 `Map.groupBy`（ES2024）先把行按项目的 `id` 分组，再逐组转换；它用 `Boolean(task_done)` 转换已经检查过的 0 和 1。
:::

:::variant{kind=alt name=group-by}
```ts file=rows.ts
import { STATUSES, type ProjectStatus, type StoredProject, type StoredTask } from './model';

export type JoinedRow = Readonly<{
  id: string;
  name: string;
  owner: string;
  owner_email: string;
  status: string;
  due_date: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  task_id: string | null;
  task_title: string | null;
  task_done: number | null;
  task_position: number | null;
  task_created_at: string | null;
  task_deleted_at: string | null;
}>;

const isStatus = (value: string): value is ProjectStatus => STATUSES.some((s) => s === value);

/** 先按项目的 id 分组，再把每一组变成一个项目 */
export function rowsToProjects(rows: readonly JoinedRow[]): StoredProject[] {
  const groups = Map.groupBy(rows, (row) => row.id);
  const result: StoredProject[] = [];
  for (const [id, group] of groups) {
    const first = group[0];
    if (first === undefined) continue;
    if (!isStatus(first.status)) throw new Error(`数据库中的数据不对：项目 ${id} 的 status 是 ${first.status}`);
    const tasks: StoredTask[] = [];
    for (const row of group) {
      const { task_id, task_title, task_done, task_position, task_created_at, task_deleted_at } = row;
      if (task_id === null) continue;
      if (task_title === null || task_position === null || task_created_at === null) throw new Error(`数据库中的数据不对：项目 ${id} 的任务 ${task_id} 缺少字段`);
      if (task_done !== 0 && task_done !== 1) throw new Error(`数据库中的数据不对：项目 ${id} 的任务 ${task_id} 的 done 是 ${task_done}`);
      tasks.push({ id: task_id, title: task_title, done: Boolean(task_done), position: task_position, createdAt: task_created_at, deletedAt: task_deleted_at });
    }
    tasks.sort((a, b) => a.position - b.position);
    result.push({
      id,
      name: first.name,
      owner: first.owner,
      ownerEmail: first.owner_email,
      status: first.status,
      dueDate: first.due_date,
      version: first.version,
      createdAt: first.created_at,
      updatedAt: first.updated_at,
      deletedAt: first.deleted_at,
      tasks,
    });
  }
  return result;
}
```
:::

:::variant{kind=wrong name=done-unchecked fails=tests reason="没有检查 done 的值：数据库中的 2 被悄悄当成了 false"}
```ts file=rows.ts
import { STATUSES, type StoredProject, type StoredTask } from './model';

/**
 * SELECT p.*, t.id AS task_id, t.title AS task_title, …
 * FROM projects p LEFT JOIN tasks t ON t.project_id = p.id
 * 的一行：每个任务一行；没有任务的项目也有一行，任务的列都是 null
 */
export type JoinedRow = Readonly<{
  id: string;
  name: string;
  owner: string;
  owner_email: string;
  status: string;
  due_date: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  task_id: string | null;
  task_title: string | null;
  task_done: number | null;
  task_position: number | null;
  task_created_at: string | null;
  task_deleted_at: string | null;
}>;

/** 数据库中的数据不对：这是程序或者数据的错误，不是用户的错误，所以抛出 */
function corrupt(message: string): never {
  throw new Error(`数据库中的数据不对：${message}`);
}

function toTask(row: JoinedRow): StoredTask | null {
  if (row.task_id === null) return null;
  const where = `项目 ${row.id} 的任务 ${row.task_id}`;
  if (row.task_title === null || row.task_position === null || row.task_created_at === null) corrupt(`${where} 缺少字段`);
  // SQLite 没有布尔类型：保存的是 0 和 1
  return {
    id: row.task_id,
    title: row.task_title,
    done: row.task_done === 1,
    position: row.task_position,
    createdAt: row.task_created_at,
    deletedAt: row.task_deleted_at,
  };
}

/** 把 JOIN 的结果还原成项目：项目按第一次出现的顺序，任务按 position 排序 */
export function rowsToProjects(rows: readonly JoinedRow[]): StoredProject[] {
  const projects = new Map<string, { project: Omit<StoredProject, 'tasks'>; tasks: StoredTask[] }>();
  for (const row of rows) {
    let entry = projects.get(row.id);
    if (entry === undefined) {
      const status = STATUSES.find((s) => s === row.status) ?? corrupt(`项目 ${row.id} 的 status 是 ${row.status}`);
      entry = {
        project: {
          id: row.id,
          name: row.name,
          owner: row.owner,
          ownerEmail: row.owner_email,
          status,
          dueDate: row.due_date,
          version: row.version,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          deletedAt: row.deleted_at,
        },
        tasks: [],
      };
      projects.set(row.id, entry);
    }
    const task = toTask(row);
    if (task !== null) entry.tasks.push(task);
  }
  return [...projects.values()].map(({ project, tasks }) => ({ ...project, tasks: tasks.toSorted((a, b) => a.position - b.position) }));
}
```
:::

:::variant{kind=wrong name=no-sort fails=tests reason="任务没有按 position 排序：行的顺序只有在 SQL 中写了 ORDER BY 时才有保证"}
```ts file=rows.ts
import { STATUSES, type StoredProject, type StoredTask } from './model';

/**
 * SELECT p.*, t.id AS task_id, t.title AS task_title, …
 * FROM projects p LEFT JOIN tasks t ON t.project_id = p.id
 * 的一行：每个任务一行；没有任务的项目也有一行，任务的列都是 null
 */
export type JoinedRow = Readonly<{
  id: string;
  name: string;
  owner: string;
  owner_email: string;
  status: string;
  due_date: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  task_id: string | null;
  task_title: string | null;
  task_done: number | null;
  task_position: number | null;
  task_created_at: string | null;
  task_deleted_at: string | null;
}>;

/** 数据库中的数据不对：这是程序或者数据的错误，不是用户的错误，所以抛出 */
function corrupt(message: string): never {
  throw new Error(`数据库中的数据不对：${message}`);
}

function toTask(row: JoinedRow): StoredTask | null {
  if (row.task_id === null) return null;
  const where = `项目 ${row.id} 的任务 ${row.task_id}`;
  if (row.task_title === null || row.task_position === null || row.task_created_at === null) corrupt(`${where} 缺少字段`);
  // SQLite 没有布尔类型：保存的是 0 和 1
  if (row.task_done !== 0 && row.task_done !== 1) corrupt(`${where} 的 done 是 ${row.task_done}`);
  return {
    id: row.task_id,
    title: row.task_title,
    done: row.task_done === 1,
    position: row.task_position,
    createdAt: row.task_created_at,
    deletedAt: row.task_deleted_at,
  };
}

/** 把 JOIN 的结果还原成项目：项目按第一次出现的顺序，任务按 position 排序 */
export function rowsToProjects(rows: readonly JoinedRow[]): StoredProject[] {
  const projects = new Map<string, { project: Omit<StoredProject, 'tasks'>; tasks: StoredTask[] }>();
  for (const row of rows) {
    let entry = projects.get(row.id);
    if (entry === undefined) {
      const status = STATUSES.find((s) => s === row.status) ?? corrupt(`项目 ${row.id} 的 status 是 ${row.status}`);
      entry = {
        project: {
          id: row.id,
          name: row.name,
          owner: row.owner,
          ownerEmail: row.owner_email,
          status,
          dueDate: row.due_date,
          version: row.version,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          deletedAt: row.deleted_at,
        },
        tasks: [],
      };
      projects.set(row.id, entry);
    }
    const task = toTask(row);
    if (task !== null) entry.tasks.push(task);
  }
  return [...projects.values()].map(({ project, tasks }) => ({ ...project, tasks }));
}
```
:::

:::variant{kind=wrong name=null-row-as-task fails=tests reason="把 LEFT JOIN 中任务的列都是 null 的行也当成了一个任务：没有任务的项目多出一个空的任务"}
```ts file=rows.ts
import { STATUSES, type StoredProject, type StoredTask } from './model';

/**
 * SELECT p.*, t.id AS task_id, t.title AS task_title, …
 * FROM projects p LEFT JOIN tasks t ON t.project_id = p.id
 * 的一行：每个任务一行；没有任务的项目也有一行，任务的列都是 null
 */
export type JoinedRow = Readonly<{
  id: string;
  name: string;
  owner: string;
  owner_email: string;
  status: string;
  due_date: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  task_id: string | null;
  task_title: string | null;
  task_done: number | null;
  task_position: number | null;
  task_created_at: string | null;
  task_deleted_at: string | null;
}>;

/** 数据库中的数据不对：这是程序或者数据的错误，不是用户的错误，所以抛出 */
function corrupt(message: string): never {
  throw new Error(`数据库中的数据不对：${message}`);
}

function toTask(row: JoinedRow): StoredTask | null {
  if (row.task_id === null) return { id: '', title: '', done: false, position: 0, createdAt: '', deletedAt: null };
  const where = `项目 ${row.id} 的任务 ${row.task_id}`;
  if (row.task_title === null || row.task_position === null || row.task_created_at === null) corrupt(`${where} 缺少字段`);
  // SQLite 没有布尔类型：保存的是 0 和 1
  if (row.task_done !== 0 && row.task_done !== 1) corrupt(`${where} 的 done 是 ${row.task_done}`);
  return {
    id: row.task_id,
    title: row.task_title,
    done: row.task_done === 1,
    position: row.task_position,
    createdAt: row.task_created_at,
    deletedAt: row.task_deleted_at,
  };
}

/** 把 JOIN 的结果还原成项目：项目按第一次出现的顺序，任务按 position 排序 */
export function rowsToProjects(rows: readonly JoinedRow[]): StoredProject[] {
  const projects = new Map<string, { project: Omit<StoredProject, 'tasks'>; tasks: StoredTask[] }>();
  for (const row of rows) {
    let entry = projects.get(row.id);
    if (entry === undefined) {
      const status = STATUSES.find((s) => s === row.status) ?? corrupt(`项目 ${row.id} 的 status 是 ${row.status}`);
      entry = {
        project: {
          id: row.id,
          name: row.name,
          owner: row.owner,
          ownerEmail: row.owner_email,
          status,
          dueDate: row.due_date,
          version: row.version,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          deletedAt: row.deleted_at,
        },
        tasks: [],
      };
      projects.set(row.id, entry);
    }
    const task = toTask(row);
    if (task !== null) entry.tasks.push(task);
  }
  return [...projects.values()].map(({ project, tasks }) => ({ ...project, tasks: tasks.toSorted((a, b) => a.position - b.position) }));
}
```
:::

:::variant{kind=wrong name=status-default fails=tests reason="数据库中不认识的状态被当成了 active：数据的错误被掩盖了"}
```ts file=rows.ts
import { STATUSES, type StoredProject, type StoredTask } from './model';

/**
 * SELECT p.*, t.id AS task_id, t.title AS task_title, …
 * FROM projects p LEFT JOIN tasks t ON t.project_id = p.id
 * 的一行：每个任务一行；没有任务的项目也有一行，任务的列都是 null
 */
export type JoinedRow = Readonly<{
  id: string;
  name: string;
  owner: string;
  owner_email: string;
  status: string;
  due_date: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  task_id: string | null;
  task_title: string | null;
  task_done: number | null;
  task_position: number | null;
  task_created_at: string | null;
  task_deleted_at: string | null;
}>;

/** 数据库中的数据不对：这是程序或者数据的错误，不是用户的错误，所以抛出 */
function corrupt(message: string): never {
  throw new Error(`数据库中的数据不对：${message}`);
}

function toTask(row: JoinedRow): StoredTask | null {
  if (row.task_id === null) return null;
  const where = `项目 ${row.id} 的任务 ${row.task_id}`;
  if (row.task_title === null || row.task_position === null || row.task_created_at === null) corrupt(`${where} 缺少字段`);
  // SQLite 没有布尔类型：保存的是 0 和 1
  if (row.task_done !== 0 && row.task_done !== 1) corrupt(`${where} 的 done 是 ${row.task_done}`);
  return {
    id: row.task_id,
    title: row.task_title,
    done: row.task_done === 1,
    position: row.task_position,
    createdAt: row.task_created_at,
    deletedAt: row.task_deleted_at,
  };
}

/** 把 JOIN 的结果还原成项目：项目按第一次出现的顺序，任务按 position 排序 */
export function rowsToProjects(rows: readonly JoinedRow[]): StoredProject[] {
  const projects = new Map<string, { project: Omit<StoredProject, 'tasks'>; tasks: StoredTask[] }>();
  for (const row of rows) {
    let entry = projects.get(row.id);
    if (entry === undefined) {
      const status = STATUSES.find((s) => s === row.status) ?? 'active';
      entry = {
        project: {
          id: row.id,
          name: row.name,
          owner: row.owner,
          ownerEmail: row.owner_email,
          status,
          dueDate: row.due_date,
          version: row.version,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          deletedAt: row.deleted_at,
        },
        tasks: [],
      };
      projects.set(row.id, entry);
    }
    const task = toTask(row);
    if (task !== null) entry.tasks.push(task);
  }
  return [...projects.values()].map(({ project, tasks }) => ({ ...project, tasks: tasks.toSorted((a, b) => a.position - b.position) }));
}
```
:::

:::variant{kind=wrong name=shared-tasks fails=tests reason="所有的项目共用了一个任务的数组：每个项目都拿到了所有的任务"}
```ts file=rows.ts
import { STATUSES, type StoredProject, type StoredTask } from './model';

/**
 * SELECT p.*, t.id AS task_id, t.title AS task_title, …
 * FROM projects p LEFT JOIN tasks t ON t.project_id = p.id
 * 的一行：每个任务一行；没有任务的项目也有一行，任务的列都是 null
 */
export type JoinedRow = Readonly<{
  id: string;
  name: string;
  owner: string;
  owner_email: string;
  status: string;
  due_date: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  task_id: string | null;
  task_title: string | null;
  task_done: number | null;
  task_position: number | null;
  task_created_at: string | null;
  task_deleted_at: string | null;
}>;

/** 数据库中的数据不对：这是程序或者数据的错误，不是用户的错误，所以抛出 */
function corrupt(message: string): never {
  throw new Error(`数据库中的数据不对：${message}`);
}

function toTask(row: JoinedRow): StoredTask | null {
  if (row.task_id === null) return null;
  const where = `项目 ${row.id} 的任务 ${row.task_id}`;
  if (row.task_title === null || row.task_position === null || row.task_created_at === null) corrupt(`${where} 缺少字段`);
  // SQLite 没有布尔类型：保存的是 0 和 1
  if (row.task_done !== 0 && row.task_done !== 1) corrupt(`${where} 的 done 是 ${row.task_done}`);
  return {
    id: row.task_id,
    title: row.task_title,
    done: row.task_done === 1,
    position: row.task_position,
    createdAt: row.task_created_at,
    deletedAt: row.task_deleted_at,
  };
}

/** 把 JOIN 的结果还原成项目：项目按第一次出现的顺序，任务按 position 排序 */
export function rowsToProjects(rows: readonly JoinedRow[]): StoredProject[] {
  const projects = new Map<string, { project: Omit<StoredProject, 'tasks'>; tasks: StoredTask[] }>();
  const shared: StoredTask[] = [];
  for (const row of rows) {
    let entry = projects.get(row.id);
    if (entry === undefined) {
      const status = STATUSES.find((s) => s === row.status) ?? corrupt(`项目 ${row.id} 的 status 是 ${row.status}`);
      entry = {
        project: {
          id: row.id,
          name: row.name,
          owner: row.owner,
          ownerEmail: row.owner_email,
          status,
          dueDate: row.due_date,
          version: row.version,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          deletedAt: row.deleted_at,
        },
        tasks: shared,
      };
      projects.set(row.id, entry);
    }
    const task = toTask(row);
    if (task !== null) entry.tasks.push(task);
  }
  return [...projects.values()].map(({ project, tasks }) => ({ ...project, tasks: tasks.toSorted((a, b) => a.position - b.position) }));
}
```
:::

