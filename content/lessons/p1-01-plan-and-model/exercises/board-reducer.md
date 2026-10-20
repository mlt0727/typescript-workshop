---
kind: challenge
title: 任务板的状态更新函数
mode: ts
---
在 `board.ts` 中完成任务板的模型。类型已经给出（注意 `Status` 是从 `STATUSES` 这个只读数组推出来的，b16）。实现：

**`reduce(board, action)`**，不能修改传入的对象：

| 动作 | 效果 |
| --- | --- |
| `add` | 添加 `{ id: 't' + nextId, title, tags, status: 'todo', createdAt: now }` 到末尾，`nextId` 加 1（已经写好） |
| `rename` | 标题去掉首尾空白后改名 |
| `step` | 按 `STATUSES` 的顺序移到左边（`-1`）或右边（`1`）相邻的列 |
| `remove` | 删除这个任务 |

动作没有带来任何变化时（找不到 id；新标题为空或者和原来的相同；已经在最左边还往左、已经在最右边还往右），返回**原来的** `board`。被修改的任务换成新对象，其他任务保持原来的对象。在 `default` 中用 `never` 做穷尽检查（b09；测试检查不到这一点，写完对照参考解自查）。

**`columnsOf(board)`** 把任务按状态分成 `todo`、`doing`、`done` 三列，每列按 `createdAt` 从小到大排序；`createdAt` 相同时，按 id 中的**数字**从小到大（`t2` 在 `t10` 之前）。

:::files{role=starter}
```ts file=board.ts
export const STATUSES = ['todo', 'doing', 'done'] as const;
export type Status = (typeof STATUSES)[number];

export type Task = Readonly<{ id: string; title: string; tags: readonly string[]; status: Status; createdAt: number }>;
export type Board = Readonly<{ tasks: readonly Task[]; nextId: number }>;

export type Action =
  | { type: 'add'; title: string; tags: readonly string[]; now: number }
  | { type: 'rename'; id: string; title: string }
  | { type: 'step'; id: string; direction: -1 | 1 }
  | { type: 'remove'; id: string };

export function reduce(board: Board, action: Action): Board {
  switch (action.type) {
    case 'add': {
      const task: Task = { id: `t${board.nextId}`, title: action.title, tags: action.tags, status: 'todo', createdAt: action.now };
      return { tasks: [...board.tasks, task], nextId: board.nextId + 1 };
    }
    // TODO：rename、step、remove
    default:
      return board;
  }
}

/** 按状态分成三列；每列按创建时间排序，时间相同时按 id 中的数字排序 */
export function columnsOf(board: Board): Readonly<Record<Status, readonly Task[]>> {
  return { todo: board.tasks, doing: [], done: [] };
}
```
```ts file=main.ts
import { columnsOf, reduce, type Board } from './board';

let board: Board = { tasks: [], nextId: 1 };
board = reduce(board, { type: 'add', title: '写周报', tags: ['工作'], now: 1 });
board = reduce(board, { type: 'add', title: '修自行车', tags: [], now: 2 });
board = reduce(board, { type: 'step', id: 't1', direction: 1 });
board = reduce(board, { type: 'rename', id: 't2', title: '  修好自行车 ' });

const columns = columnsOf(board);
for (const status of ['todo', 'doing', 'done'] as const) {
  console.log(status, columns[status].map((t) => `${t.id} ${t.title}`));
}
```
:::

:::files{role=solution}
```ts file=board.ts
export const STATUSES = ['todo', 'doing', 'done'] as const;
export type Status = (typeof STATUSES)[number];

export type Task = Readonly<{ id: string; title: string; tags: readonly string[]; status: Status; createdAt: number }>;
export type Board = Readonly<{ tasks: readonly Task[]; nextId: number }>;

export type Action =
  | { type: 'add'; title: string; tags: readonly string[]; now: number }
  | { type: 'rename'; id: string; title: string }
  | { type: 'step'; id: string; direction: -1 | 1 }
  | { type: 'remove'; id: string };

/** 用 change 计算出新的任务；找不到、或者 change 返回原来的任务时，返回原来的 board */
function updateTask(board: Board, id: string, change: (task: Task) => Task): Board {
  const index = board.tasks.findIndex((t) => t.id === id);
  const task = board.tasks[index];
  if (task === undefined) return board;
  const next = change(task);
  return next === task ? board : { ...board, tasks: board.tasks.with(index, next) };
}

export function reduce(board: Board, action: Action): Board {
  switch (action.type) {
    case 'add': {
      const task: Task = { id: `t${board.nextId}`, title: action.title, tags: action.tags, status: 'todo', createdAt: action.now };
      return { tasks: [...board.tasks, task], nextId: board.nextId + 1 };
    }
    case 'rename': {
      const title = action.title.trim();
      return updateTask(board, action.id, (task) => (title === '' || title === task.title ? task : { ...task, title }));
    }
    case 'step':
      return updateTask(board, action.id, (task) => {
        const next = STATUSES[STATUSES.indexOf(task.status) + action.direction];
        return next === undefined ? task : { ...task, status: next };
      });
    case 'remove': {
      const tasks = board.tasks.filter((t) => t.id !== action.id);
      return tasks.length === board.tasks.length ? board : { ...board, tasks };
    }
    default: {
      const unhandled: never = action;
      throw new Error(`未知的动作：${JSON.stringify(unhandled)}`);
    }
  }
}

const idNumber = (task: Task) => Number(task.id.slice(1));

/** 按状态分成三列；每列按创建时间排序，时间相同时按 id 中的数字排序 */
export function columnsOf(board: Board): Readonly<Record<Status, readonly Task[]>> {
  const sorted = board.tasks.toSorted((a, b) => a.createdAt - b.createdAt || idNumber(a) - idNumber(b));
  return {
    todo: sorted.filter((t) => t.status === 'todo'),
    doing: sorted.filter((t) => t.status === 'doing'),
    done: sorted.filter((t) => t.status === 'done'),
  };
}
```
```ts file=main.ts
import { columnsOf, reduce, type Board } from './board';

let board: Board = { tasks: [], nextId: 1 };
board = reduce(board, { type: 'add', title: '写周报', tags: ['工作'], now: 1 });
board = reduce(board, { type: 'add', title: '修自行车', tags: [], now: 2 });
board = reduce(board, { type: 'step', id: 't1', direction: 1 });
board = reduce(board, { type: 'rename', id: 't2', title: '  修好自行车 ' });

const columns = columnsOf(board);
for (const status of ['todo', 'doing', 'done'] as const) {
  console.log(status, columns[status].map((t) => `${t.id} ${t.title}`));
}
```
:::

:::files{role=tests}
```ts file=board.test.ts
import { describe, expect, test } from 'vitest';
import { columnsOf, reduce, type Board, type Task } from './board';

function task(id: string, status: Task['status'], createdAt: number, title = `任务 ${id}`): Task {
  return Object.freeze({ id, title, tags: Object.freeze([]), status, createdAt });
}

function board(tasks: Task[], nextId: number): Board {
  return Object.freeze({ tasks: Object.freeze(tasks), nextId });
}

const sample = () => board([task('t1', 'todo', 10), task('t2', 'doing', 20), task('t3', 'done', 30)], 4);

describe('reduce', () => {
  test('add：新任务进入“待办”，id 来自 nextId', () => {
    const before = sample();
    const after = reduce(before, { type: 'add', title: '写周报', tags: ['工作'], now: 99 });
    expect(after.nextId).toBe(5);
    expect(after.tasks.at(-1)).toEqual({ id: 't4', title: '写周报', tags: ['工作'], status: 'todo', createdAt: 99 });
    expect(after.tasks.slice(0, 3)).toEqual(before.tasks);
    expect(after.tasks[0]).toBe(before.tasks[0]);
  });

  test('删除之后再添加，id 不会重复', () => {
    let b = sample();
    b = reduce(b, { type: 'remove', id: 't3' });
    b = reduce(b, { type: 'add', title: '新任务', tags: [], now: 50 });
    expect(b.tasks.map((t) => t.id)).toEqual(['t1', 't2', 't4']);
  });

  test('rename：去掉首尾空白；空标题、相同的标题、找不到 id 时返回原来的 board', () => {
    const before = sample();
    const after = reduce(before, { type: 'rename', id: 't2', title: '  进行中的任务 ' });
    expect(after.tasks[1]).toEqual({ ...before.tasks[1], title: '进行中的任务' });
    expect(after.tasks[0]).toBe(before.tasks[0]);
    expect(reduce(before, { type: 'rename', id: 't2', title: '   ' })).toBe(before);
    expect(reduce(before, { type: 'rename', id: 't2', title: ' 任务 t2 ' })).toBe(before);
    expect(reduce(before, { type: 'rename', id: 't9', title: '新名字' })).toBe(before);
  });

  test('step：移到相邻的列；已经在最左、最右时返回原来的 board', () => {
    const before = sample();
    expect(reduce(before, { type: 'step', id: 't1', direction: 1 }).tasks[0]?.status).toBe('doing');
    expect(reduce(before, { type: 'step', id: 't2', direction: -1 }).tasks[1]?.status).toBe('todo');
    expect(reduce(before, { type: 'step', id: 't2', direction: 1 }).tasks[1]?.status).toBe('done');
    expect(reduce(before, { type: 'step', id: 't1', direction: -1 })).toBe(before);
    expect(reduce(before, { type: 'step', id: 't3', direction: 1 })).toBe(before);
    expect(reduce(before, { type: 'step', id: 't9', direction: 1 })).toBe(before);
    const moved = reduce(before, { type: 'step', id: 't1', direction: 1 });
    expect(moved.tasks[0]?.createdAt).toBe(10);
    expect(moved.tasks[2]).toBe(before.tasks[2]);
  });

  test('remove：删除，其他任务保持原来的对象；找不到时返回原来的 board', () => {
    const before = sample();
    const after = reduce(before, { type: 'remove', id: 't2' });
    expect(after.tasks.map((t) => t.id)).toEqual(['t1', 't3']);
    expect(after.tasks[0]).toBe(before.tasks[0]);
    expect(after.tasks[1]).toBe(before.tasks[2]);
    expect(reduce(before, { type: 'remove', id: 't9' })).toBe(before);
  });
});

describe('columnsOf', () => {
  test('按状态分成三列，每列按创建时间排序', () => {
    const b = board([task('t1', 'done', 30), task('t2', 'todo', 20), task('t3', 'todo', 10), task('t4', 'doing', 5)], 5);
    const columns = columnsOf(b);
    expect(columns.todo.map((t) => t.id)).toEqual(['t3', 't2']);
    expect(columns.doing.map((t) => t.id)).toEqual(['t4']);
    expect(columns.done.map((t) => t.id)).toEqual(['t1']);
  });

  test('创建时间相同时按 id 中的数字排序（t2 在 t10 之前）', () => {
    const b = board([task('t10', 'todo', 7), task('t2', 'todo', 7), task('t1', 'todo', 9)], 11);
    expect(columnsOf(b).todo.map((t) => t.id)).toEqual(['t2', 't10', 't1']);
  });
});
```
```ts file=board.test-d.ts
import { columnsOf, reduce, type Board, type Task } from './board';

const t: Task = { id: 't1', title: '写周报', tags: [], status: 'todo', createdAt: 1 };
const b: Board = { tasks: [t], nextId: 2 };
// @ts-expect-error 只能向相邻的列移动一步
reduce(b, { type: 'step', id: 't1', direction: 2 });
// @ts-expect-error 状态只能是三列中的一个
const archived: Task = { ...t, status: 'archived' };
// @ts-expect-error 任务是只读的
t.title = '改名';
// @ts-expect-error 任务的标签是只读的
t.tags.push('紧急');
// @ts-expect-error 任务列表是只读的
b.tasks.push(t);
// @ts-expect-error 列是只读的
columnsOf(b).todo.push(t);
```
:::

:::hint{level=1}
`rename` 和 `step` 都是“找到一个任务、算出它的新样子”，可以写一个辅助函数：用 `findIndex` 找到位置，算出新任务，没有变化就返回原来的 `board`，否则用 `with(index, 新任务)` 得到新数组（g04）。`step` 的目标列是 `STATUSES[当前的位置 + direction]`，越界时是 `undefined`。
:::

:::hint{level=2}
`columnsOf`：先用 `toSorted` 排序（比较函数 `a.createdAt - b.createdAt || 数字(a) - 数字(b)`，`||` 在前一项为 0 时才比较后一项），再按状态 `filter` 三次。id 中的数字是 `Number(id.slice(1))`；直接比较字符串的话，`'t10' < 't2'`。
:::

:::explanation
这个函数是整个任务板的“规则手册”：界面只负责把用户的操作翻译成动作，结果完全由它决定，所以它的每一条规则都值得测试。

- **“没有变化就返回原对象”** 让调用方可以用 `===` 判断：渲染、保存、记录历史都可以在 `next === board` 时跳过（d10、g04）；
- **只替换被修改的那一项**：其他任务还是原来的对象，以后用 React 渲染时，它们的组件可以跳过（g12 的 `memo`）；
- **`step` 不循环**：从“已完成”再往右，并不是回到“待办”。越界时 `STATUSES[3]` 是 `undefined`（在 `noUncheckedIndexedAccess` 下它的类型也包含 `undefined`），正好用来判断；
- **排序的第二个关键字**：`createdAt` 相同（例如批量导入的任务）时，排序要稳定、可预测。字符串比较 `'t10'` 和 `'t2'` 是逐个字符比较的，`'1' < '2'`，所以 `t10` 会排在前面，要取出数字再比较。

`STATUSES` 用 `as const` 声明，再用 `(typeof STATUSES)[number]` 得到联合类型（b16）：列的顺序和状态的类型来自同一个地方，`step` 也直接用这个数组决定左右，以后加一列只需要改这一处。
:::

:::variant{kind=alt name=map-and-flag}
```ts file=board.ts
export const STATUSES = ['todo', 'doing', 'done'] as const;
export type Status = (typeof STATUSES)[number];

export type Task = Readonly<{ id: string; title: string; tags: readonly string[]; status: Status; createdAt: number }>;
export type Board = Readonly<{ tasks: readonly Task[]; nextId: number }>;

export type Action =
  | { type: 'add'; title: string; tags: readonly string[]; now: number }
  | { type: 'rename'; id: string; title: string }
  | { type: 'step'; id: string; direction: -1 | 1 }
  | { type: 'remove'; id: string };

function replaceTask(board: Board, id: string, next: (task: Task) => Task | null): Board {
  let changed = false;
  const tasks = board.tasks.map((task) => {
    if (task.id !== id) return task;
    const result = next(task);
    if (result === null) return task;
    changed = true;
    return result;
  });
  return changed ? { ...board, tasks } : board;
}

export function reduce(board: Board, action: Action): Board {
  if (action.type === 'add') {
    return {
      nextId: board.nextId + 1,
      tasks: [...board.tasks, { id: 't' + board.nextId, title: action.title, tags: action.tags, status: 'todo', createdAt: action.now }],
    };
  }
  if (action.type === 'rename') {
    const title = action.title.trim();
    return replaceTask(board, action.id, (t) => (title && title !== t.title ? { ...t, title } : null));
  }
  if (action.type === 'step') {
    return replaceTask(board, action.id, (t) => {
      const index = STATUSES.indexOf(t.status) + action.direction;
      const status = index >= 0 && index < STATUSES.length ? STATUSES[index] : undefined;
      return status ? { ...t, status } : null;
    });
  }
  if (action.type === 'remove') {
    return board.tasks.some((t) => t.id === action.id) ? { ...board, tasks: board.tasks.filter((t) => t.id !== action.id) } : board;
  }
  const unhandled: never = action;
  return unhandled;
}

export function columnsOf(board: Board): Readonly<Record<Status, readonly Task[]>> {
  const order = (t: Task): [number, number] => [t.createdAt, Number.parseInt(t.id.slice(1), 10)];
  const sorted = [...board.tasks].sort((a, b) => {
    const [ta, ia] = order(a);
    const [tb, ib] = order(b);
    return ta !== tb ? ta - tb : ia - ib;
  });
  const columns: Record<Status, Task[]> = { todo: [], doing: [], done: [] };
  for (const t of sorted) columns[t.status].push(t);
  return columns;
}
```
:::

:::variant{kind=wrong name=id-from-length fails=tests reason="用任务的个数生成 id，删除之后再添加，id 重复了"}
```ts file=board.ts
export const STATUSES = ['todo', 'doing', 'done'] as const;
export type Status = (typeof STATUSES)[number];

export type Task = Readonly<{ id: string; title: string; tags: readonly string[]; status: Status; createdAt: number }>;
export type Board = Readonly<{ tasks: readonly Task[]; nextId: number }>;

export type Action =
  | { type: 'add'; title: string; tags: readonly string[]; now: number }
  | { type: 'rename'; id: string; title: string }
  | { type: 'step'; id: string; direction: -1 | 1 }
  | { type: 'remove'; id: string };

/** 用 change 计算出新的任务；找不到、或者 change 返回原来的任务时，返回原来的 board */
function updateTask(board: Board, id: string, change: (task: Task) => Task): Board {
  const index = board.tasks.findIndex((t) => t.id === id);
  const task = board.tasks[index];
  if (task === undefined) return board;
  const next = change(task);
  return next === task ? board : { ...board, tasks: board.tasks.with(index, next) };
}

export function reduce(board: Board, action: Action): Board {
  switch (action.type) {
    case 'add': {
      const task: Task = { id: `t${board.tasks.length + 1}`, title: action.title, tags: action.tags, status: 'todo', createdAt: action.now };
      return { tasks: [...board.tasks, task], nextId: board.nextId + 1 };
    }
    case 'rename': {
      const title = action.title.trim();
      return updateTask(board, action.id, (task) => (title === '' || title === task.title ? task : { ...task, title }));
    }
    case 'step':
      return updateTask(board, action.id, (task) => {
        const next = STATUSES[STATUSES.indexOf(task.status) + action.direction];
        return next === undefined ? task : { ...task, status: next };
      });
    case 'remove': {
      const tasks = board.tasks.filter((t) => t.id !== action.id);
      return tasks.length === board.tasks.length ? board : { ...board, tasks };
    }
    default: {
      const unhandled: never = action;
      throw new Error(`未知的动作：${JSON.stringify(unhandled)}`);
    }
  }
}

const idNumber = (task: Task) => Number(task.id.slice(1));

/** 按状态分成三列；每列按创建时间排序，时间相同时按 id 中的数字排序 */
export function columnsOf(board: Board): Readonly<Record<Status, readonly Task[]>> {
  const sorted = board.tasks.toSorted((a, b) => a.createdAt - b.createdAt || idNumber(a) - idNumber(b));
  return {
    todo: sorted.filter((t) => t.status === 'todo'),
    doing: sorted.filter((t) => t.status === 'doing'),
    done: sorted.filter((t) => t.status === 'done'),
  };
}
```
:::

:::variant{kind=wrong name=step-wraps fails=tests reason="移到最右边之后又绕回了最左边"}
```ts file=board.ts
export const STATUSES = ['todo', 'doing', 'done'] as const;
export type Status = (typeof STATUSES)[number];

export type Task = Readonly<{ id: string; title: string; tags: readonly string[]; status: Status; createdAt: number }>;
export type Board = Readonly<{ tasks: readonly Task[]; nextId: number }>;

export type Action =
  | { type: 'add'; title: string; tags: readonly string[]; now: number }
  | { type: 'rename'; id: string; title: string }
  | { type: 'step'; id: string; direction: -1 | 1 }
  | { type: 'remove'; id: string };

/** 用 change 计算出新的任务；找不到、或者 change 返回原来的任务时，返回原来的 board */
function updateTask(board: Board, id: string, change: (task: Task) => Task): Board {
  const index = board.tasks.findIndex((t) => t.id === id);
  const task = board.tasks[index];
  if (task === undefined) return board;
  const next = change(task);
  return next === task ? board : { ...board, tasks: board.tasks.with(index, next) };
}

export function reduce(board: Board, action: Action): Board {
  switch (action.type) {
    case 'add': {
      const task: Task = { id: `t${board.nextId}`, title: action.title, tags: action.tags, status: 'todo', createdAt: action.now };
      return { tasks: [...board.tasks, task], nextId: board.nextId + 1 };
    }
    case 'rename': {
      const title = action.title.trim();
      return updateTask(board, action.id, (task) => (title === '' || title === task.title ? task : { ...task, title }));
    }
    case 'step':
      return updateTask(board, action.id, (task) => {
        const index = (STATUSES.indexOf(task.status) + action.direction + STATUSES.length) % STATUSES.length;
        const next = STATUSES[index];
        return next === undefined || next === task.status ? task : { ...task, status: next };
      });
    case 'remove': {
      const tasks = board.tasks.filter((t) => t.id !== action.id);
      return tasks.length === board.tasks.length ? board : { ...board, tasks };
    }
    default: {
      const unhandled: never = action;
      throw new Error(`未知的动作：${JSON.stringify(unhandled)}`);
    }
  }
}

const idNumber = (task: Task) => Number(task.id.slice(1));

/** 按状态分成三列；每列按创建时间排序，时间相同时按 id 中的数字排序 */
export function columnsOf(board: Board): Readonly<Record<Status, readonly Task[]>> {
  const sorted = board.tasks.toSorted((a, b) => a.createdAt - b.createdAt || idNumber(a) - idNumber(b));
  return {
    todo: sorted.filter((t) => t.status === 'todo'),
    doing: sorted.filter((t) => t.status === 'doing'),
    done: sorted.filter((t) => t.status === 'done'),
  };
}
```
:::

:::variant{kind=wrong name=always-new-board fails=tests reason="没有变化时也返回了新的 board"}
```ts file=board.ts
export const STATUSES = ['todo', 'doing', 'done'] as const;
export type Status = (typeof STATUSES)[number];

export type Task = Readonly<{ id: string; title: string; tags: readonly string[]; status: Status; createdAt: number }>;
export type Board = Readonly<{ tasks: readonly Task[]; nextId: number }>;

export type Action =
  | { type: 'add'; title: string; tags: readonly string[]; now: number }
  | { type: 'rename'; id: string; title: string }
  | { type: 'step'; id: string; direction: -1 | 1 }
  | { type: 'remove'; id: string };

/** 用 change 计算出新的任务；找不到、或者 change 返回原来的任务时，返回原来的 board */
function updateTask(board: Board, id: string, change: (task: Task) => Task): Board {
  const index = board.tasks.findIndex((t) => t.id === id);
  const task = board.tasks[index];
  if (task === undefined) return board;
  const next = change(task);
  return { ...board, tasks: board.tasks.with(index, next) };
}

export function reduce(board: Board, action: Action): Board {
  switch (action.type) {
    case 'add': {
      const task: Task = { id: `t${board.nextId}`, title: action.title, tags: action.tags, status: 'todo', createdAt: action.now };
      return { tasks: [...board.tasks, task], nextId: board.nextId + 1 };
    }
    case 'rename': {
      const title = action.title.trim();
      return updateTask(board, action.id, (task) => (title === '' || title === task.title ? task : { ...task, title }));
    }
    case 'step':
      return updateTask(board, action.id, (task) => {
        const next = STATUSES[STATUSES.indexOf(task.status) + action.direction];
        return next === undefined ? task : { ...task, status: next };
      });
    case 'remove': {
      const tasks = board.tasks.filter((t) => t.id !== action.id);
      return tasks.length === board.tasks.length ? board : { ...board, tasks };
    }
    default: {
      const unhandled: never = action;
      throw new Error(`未知的动作：${JSON.stringify(unhandled)}`);
    }
  }
}

const idNumber = (task: Task) => Number(task.id.slice(1));

/** 按状态分成三列；每列按创建时间排序，时间相同时按 id 中的数字排序 */
export function columnsOf(board: Board): Readonly<Record<Status, readonly Task[]>> {
  const sorted = board.tasks.toSorted((a, b) => a.createdAt - b.createdAt || idNumber(a) - idNumber(b));
  return {
    todo: sorted.filter((t) => t.status === 'todo'),
    doing: sorted.filter((t) => t.status === 'doing'),
    done: sorted.filter((t) => t.status === 'done'),
  };
}
```
:::

:::variant{kind=wrong name=lexical-id-sort fails=tests reason="按字符串比较 id，t10 排在了 t2 前面"}
```ts file=board.ts
export const STATUSES = ['todo', 'doing', 'done'] as const;
export type Status = (typeof STATUSES)[number];

export type Task = Readonly<{ id: string; title: string; tags: readonly string[]; status: Status; createdAt: number }>;
export type Board = Readonly<{ tasks: readonly Task[]; nextId: number }>;

export type Action =
  | { type: 'add'; title: string; tags: readonly string[]; now: number }
  | { type: 'rename'; id: string; title: string }
  | { type: 'step'; id: string; direction: -1 | 1 }
  | { type: 'remove'; id: string };

/** 用 change 计算出新的任务；找不到、或者 change 返回原来的任务时，返回原来的 board */
function updateTask(board: Board, id: string, change: (task: Task) => Task): Board {
  const index = board.tasks.findIndex((t) => t.id === id);
  const task = board.tasks[index];
  if (task === undefined) return board;
  const next = change(task);
  return next === task ? board : { ...board, tasks: board.tasks.with(index, next) };
}

export function reduce(board: Board, action: Action): Board {
  switch (action.type) {
    case 'add': {
      const task: Task = { id: `t${board.nextId}`, title: action.title, tags: action.tags, status: 'todo', createdAt: action.now };
      return { tasks: [...board.tasks, task], nextId: board.nextId + 1 };
    }
    case 'rename': {
      const title = action.title.trim();
      return updateTask(board, action.id, (task) => (title === '' || title === task.title ? task : { ...task, title }));
    }
    case 'step':
      return updateTask(board, action.id, (task) => {
        const next = STATUSES[STATUSES.indexOf(task.status) + action.direction];
        return next === undefined ? task : { ...task, status: next };
      });
    case 'remove': {
      const tasks = board.tasks.filter((t) => t.id !== action.id);
      return tasks.length === board.tasks.length ? board : { ...board, tasks };
    }
    default: {
      const unhandled: never = action;
      throw new Error(`未知的动作：${JSON.stringify(unhandled)}`);
    }
  }
}

const idNumber = (task: Task) => Number(task.id.slice(1));

/** 按状态分成三列；每列按创建时间排序，时间相同时按 id 中的数字排序 */
export function columnsOf(board: Board): Readonly<Record<Status, readonly Task[]>> {
  const sorted = board.tasks.toSorted((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  return {
    todo: sorted.filter((t) => t.status === 'todo'),
    doing: sorted.filter((t) => t.status === 'doing'),
    done: sorted.filter((t) => t.status === 'done'),
  };
}
```
:::

:::variant{kind=wrong name=mutate-task fails=types reason="直接修改了原来的任务对象"}
```ts file=board.ts
export const STATUSES = ['todo', 'doing', 'done'] as const;
export type Status = (typeof STATUSES)[number];

export type Task = Readonly<{ id: string; title: string; tags: readonly string[]; status: Status; createdAt: number }>;
export type Board = Readonly<{ tasks: readonly Task[]; nextId: number }>;

export type Action =
  | { type: 'add'; title: string; tags: readonly string[]; now: number }
  | { type: 'rename'; id: string; title: string }
  | { type: 'step'; id: string; direction: -1 | 1 }
  | { type: 'remove'; id: string };

/** 用 change 计算出新的任务；找不到、或者 change 返回原来的任务时，返回原来的 board */
function updateTask(board: Board, id: string, change: (task: Task) => Task): Board {
  const index = board.tasks.findIndex((t) => t.id === id);
  const task = board.tasks[index];
  if (task === undefined) return board;
  const next = change(task);
  return next === task ? board : { ...board, tasks: board.tasks.with(index, next) };
}

export function reduce(board: Board, action: Action): Board {
  switch (action.type) {
    case 'add': {
      const task: Task = { id: `t${board.nextId}`, title: action.title, tags: action.tags, status: 'todo', createdAt: action.now };
      return { tasks: [...board.tasks, task], nextId: board.nextId + 1 };
    }
    case 'rename': {
      const found = board.tasks.find((t) => t.id === action.id);
      const title = action.title.trim();
      if (found === undefined || title === '' || title === found.title) return board;
      found.title = title;
      return { ...board };
    }
    case 'step':
      return updateTask(board, action.id, (task) => {
        const next = STATUSES[STATUSES.indexOf(task.status) + action.direction];
        return next === undefined ? task : { ...task, status: next };
      });
    case 'remove': {
      const tasks = board.tasks.filter((t) => t.id !== action.id);
      return tasks.length === board.tasks.length ? board : { ...board, tasks };
    }
    default: {
      const unhandled: never = action;
      throw new Error(`未知的动作：${JSON.stringify(unhandled)}`);
    }
  }
}

const idNumber = (task: Task) => Number(task.id.slice(1));

/** 按状态分成三列；每列按创建时间排序，时间相同时按 id 中的数字排序 */
export function columnsOf(board: Board): Readonly<Record<Status, readonly Task[]>> {
  const sorted = board.tasks.toSorted((a, b) => a.createdAt - b.createdAt || idNumber(a) - idNumber(b));
  return {
    todo: sorted.filter((t) => t.status === 'todo'),
    doing: sorted.filter((t) => t.status === 'doing'),
    done: sorted.filter((t) => t.status === 'done'),
  };
}
```
:::
