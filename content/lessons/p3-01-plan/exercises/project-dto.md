---
kind: task
title: 发给客户端的数据
---
在 `dto.ts` 中实现 `toProjectDto(project)`：把服务器保存的项目（`StoredProject`）变成发给客户端的数据（`ProjectDto`，类型见只读的 `model.ts`）。

1. 项目已经被删除（`deletedAt` 不是 `null`）：返回 `null`（接口据此返回 404）；
2. 结果中**只有** `ProjectDto` 中的八个字段：`id`、`name`、`owner`、`status`、`dueDate`、`tasks`、`version`、`updatedAt`。`ownerEmail`、`createdAt`、`deletedAt` 不能出现；`project` 中如果还有类型中没有写的字段（例如以后数据库中新加的一列），也不能出现；
3. `tasks`：去掉已经删除的任务，按 `position` 从小到大排序，每个任务只有 `id`、`title`、`done`；
4. 不修改传入的数据。

:::files{role=support}
```ts file=model.ts readonly
/** 项目的三种状态：计划中、进行中、已完成（和项目 2 一样） */
export const STATUSES = ['planning', 'active', 'done'] as const;
export type ProjectStatus = (typeof STATUSES)[number];

export const STATUS_NAMES: Readonly<Record<ProjectStatus, string>> = { planning: '计划中', active: '进行中', done: '已完成' };

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
:::

:::files{role=starter}
```ts file=dto.ts
import type { ProjectDto, StoredProject } from './model';

/** 把服务器保存的项目变成发给客户端的数据 */
export function toProjectDto(project: StoredProject): ProjectDto | null {
  // TODO
  return null;
}
```
```ts file=main.ts readonly
import { toProjectDto } from './dto';
import type { StoredProject } from './model';

const stored: StoredProject = {
  id: 'p1',
  name: '官网改版',
  owner: '王芳',
  ownerEmail: 'wang.fang@example.com',
  status: 'active',
  dueDate: null,
  version: 3,
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-10-20T09:30:00.000Z',
  deletedAt: null,
  tasks: [
    { id: 't2', title: '上线', done: false, position: 2, createdAt: '2026-09-02T08:00:00.000Z', deletedAt: null },
    { id: 't1', title: '设计稿', done: true, position: 1, createdAt: '2026-09-01T08:00:00.000Z', deletedAt: null },
    { id: 't3', title: '旧的任务', done: false, position: 3, createdAt: '2026-09-03T08:00:00.000Z', deletedAt: '2026-09-04T08:00:00.000Z' },
  ],
};
console.log(JSON.stringify(toProjectDto(stored), null, 2));
console.log('删除之后：', toProjectDto({ ...stored, deletedAt: '2026-10-21T00:00:00.000Z' }));
```
:::

:::files{role=solution}
```ts file=dto.ts
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
```ts file=main.ts readonly
import { toProjectDto } from './dto';
import type { StoredProject } from './model';

const stored: StoredProject = {
  id: 'p1',
  name: '官网改版',
  owner: '王芳',
  ownerEmail: 'wang.fang@example.com',
  status: 'active',
  dueDate: null,
  version: 3,
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-10-20T09:30:00.000Z',
  deletedAt: null,
  tasks: [
    { id: 't2', title: '上线', done: false, position: 2, createdAt: '2026-09-02T08:00:00.000Z', deletedAt: null },
    { id: 't1', title: '设计稿', done: true, position: 1, createdAt: '2026-09-01T08:00:00.000Z', deletedAt: null },
    { id: 't3', title: '旧的任务', done: false, position: 3, createdAt: '2026-09-03T08:00:00.000Z', deletedAt: '2026-09-04T08:00:00.000Z' },
  ],
};
console.log(JSON.stringify(toProjectDto(stored), null, 2));
console.log('删除之后：', toProjectDto({ ...stored, deletedAt: '2026-10-21T00:00:00.000Z' }));
```
:::

:::files{role=tests}
```ts file=dto.test.ts
import { describe, expect, test } from 'vitest';
import { toProjectDto } from './dto';
import type { StoredProject, StoredTask } from './model';

const task = (id: string, position: number, done = false, deletedAt: string | null = null): StoredTask => ({
  id,
  title: `任务 ${id}`,
  done,
  position,
  createdAt: '2026-10-01T08:00:00.000Z',
  deletedAt,
});

const stored: StoredProject = {
  id: 'p1',
  name: '官网改版',
  owner: '王芳',
  ownerEmail: 'wang.fang@example.com',
  status: 'active',
  dueDate: '2026-12-31',
  version: 7,
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-10-20T09:30:00.000Z',
  deletedAt: null,
  tasks: [task('t3', 30, true), task('t1', 10), task('t2', 20, false, '2026-10-02T00:00:00.000Z'), task('t4', 15)],
};

describe('toProjectDto', () => {
  test('只有客户端需要的字段；任务按 position 排序，去掉已经删除的', () => {
    expect(toProjectDto(stored)).toStrictEqual({
      id: 'p1',
      name: '官网改版',
      owner: '王芳',
      status: 'active',
      dueDate: '2026-12-31',
      tasks: [
        { id: 't1', title: '任务 t1', done: false },
        { id: 't4', title: '任务 t4', done: false },
        { id: 't3', title: '任务 t3', done: true },
      ],
      version: 7,
      updatedAt: '2026-10-20T09:30:00.000Z',
    });
  });

  test('邮箱和内部的时间不会出现在 JSON 中', () => {
    const json = JSON.stringify(toProjectDto(stored));
    for (const secret of ['wang.fang@example.com', 'createdAt', 'deletedAt', 'position', 'ownerEmail']) expect(json.includes(secret), secret).toBe(false);
  });

  test('存储中多出来的字段也不会发出去', () => {
    // 例如以后数据库中加了一列，而这段代码没有改
    const withExtra = { ...stored, resetToken: 'secret-token', tasks: [{ ...task('t1', 1), assigneeEmail: 'li@example.com' }] };
    expect(JSON.stringify(toProjectDto(withExtra)).includes('secret-token')).toBe(false);
    expect(JSON.stringify(toProjectDto(withExtra)).includes('li@example.com')).toBe(false);
  });

  test('已经删除的项目：null（接口返回 404）', () => {
    expect(toProjectDto({ ...stored, deletedAt: '2026-10-21T00:00:00.000Z' })).toBeNull();
  });

  test('没有截止日期、没有任务', () => {
    expect(toProjectDto({ ...stored, dueDate: null, tasks: [] })).toMatchObject({ dueDate: null, tasks: [] });
  });

  test('结果经过 JSON 往返之后不变：没有 undefined', () => {
    const dto = toProjectDto({ ...stored, dueDate: null });
    expect(JSON.parse(JSON.stringify(dto))).toStrictEqual(dto);
  });

  test('不修改传入的数据', () => {
    const before = JSON.stringify(stored);
    toProjectDto(stored);
    expect(JSON.stringify(stored)).toBe(before);
  });
});
```
:::

:::hint{level=1}
返回一个新的对象字面量，逐个写出八个字段（白名单）。不要用 `{ ...project }` 再删掉几个字段：那样类型中没有写的字段会被一起带出去。
:::

:::hint{level=2}
任务：`filter` 去掉删除的，`toSorted` 按 `position` 排序（它返回新的数组，不修改原来的），`map` 成只有三个字段的新对象。
:::

:::explanation
发出去的数据只列出需要的字段，是为了让“发什么”成为一个明确的决定。TypeScript 的类型在这里帮不上忙：`StoredProject` 类型的变量在运行时可以有更多的字段（类型只保证“至少有这些”），测试中的 `withExtra` 就是这样传进来的。所以即使类型写得很好，用 `...rest` 的黑名单也会把多出来的字段带出去。

软删除的项目返回 `null`，接口返回 404：对客户端来说，删除了就是不存在。任务也一样，删除的任务不出现在清单中。

排序放在服务器上做，客户端拿到的顺序就是最终的顺序。数据库返回的行的顺序，只有在写了 `ORDER BY` 时才有保证（p3-03）；在这里按 `position` 排一次，就不依赖存储返回的顺序。

替代解用解构参数只取需要的字段（这也是白名单：没有写出来的字段根本不会被读取），用 `flatMap` 过滤，复制一份数组再 `sort`。
:::

:::variant{kind=alt name=destructure-params}
```ts file=dto.ts
import type { ProjectDto, StoredProject, StoredTask, TaskDto } from './model';

const byPosition = (a: StoredTask, b: StoredTask) => a.position - b.position;

function toTaskDto({ id, title, done }: StoredTask): TaskDto {
  return { id, title, done };
}

/** 解构参数只取需要的字段，其他的字段（包括以后新加的）都不会出现在结果中 */
export function toProjectDto({ id, name, owner, status, dueDate, version, updatedAt, deletedAt, tasks }: StoredProject): ProjectDto | null {
  if (deletedAt !== null) return null;
  const live = tasks.flatMap((task) => (task.deletedAt === null ? [task] : []));
  return { id, name, owner, status, dueDate, version, updatedAt, tasks: [...live].sort(byPosition).map(toTaskDto) };
}
```
:::

:::variant{kind=wrong name=deny-list fails=tests reason="用解构的剩余属性去掉几个字段（黑名单）：存储中以后新加的字段会自动发给客户端"}
```ts file=dto.ts
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
  const { ownerEmail, createdAt, deletedAt, ...rest } = project;
  return { ...rest, tasks };
}
```
:::

:::variant{kind=wrong name=keep-deleted-tasks fails=tests reason="没有去掉已经删除的任务：客户端又看到了删掉的任务"}
```ts file=dto.ts
import type { ProjectDto, StoredProject, TaskDto } from './model';

/**
 * 把服务器保存的项目变成发给客户端的数据。
 * 只列出要发出去的字段（白名单）：存储中以后加了新的字段，也不会自动发出去。
 */
export function toProjectDto(project: StoredProject): ProjectDto | null {
  if (project.deletedAt !== null) return null;
  const tasks: TaskDto[] = project.tasks
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

:::variant{kind=wrong name=no-sort fails=tests reason="没有按 position 排序：任务的顺序取决于存储返回的顺序"}
```ts file=dto.ts
import type { ProjectDto, StoredProject, TaskDto } from './model';

/**
 * 把服务器保存的项目变成发给客户端的数据。
 * 只列出要发出去的字段（白名单）：存储中以后加了新的字段，也不会自动发出去。
 */
export function toProjectDto(project: StoredProject): ProjectDto | null {
  if (project.deletedAt !== null) return null;
  const tasks: TaskDto[] = project.tasks
    .filter((task) => task.deletedAt === null)
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

:::variant{kind=wrong name=deleted-project fails=tests reason="已经删除的项目照样返回：删掉的项目还能被读到"}
```ts file=dto.ts
import type { ProjectDto, StoredProject, TaskDto } from './model';

/**
 * 把服务器保存的项目变成发给客户端的数据。
 * 只列出要发出去的字段（白名单）：存储中以后加了新的字段，也不会自动发出去。
 */
export function toProjectDto(project: StoredProject): ProjectDto | null {
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

:::variant{kind=wrong name=task-spread fails=tests reason="任务用展开复制：position、createdAt、deletedAt 都发了出去"}
```ts file=dto.ts
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
    .map((task) => ({ ...task }));
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

