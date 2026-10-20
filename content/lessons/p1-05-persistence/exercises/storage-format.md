---
kind: task
title: 带版本号的存储格式
mode: ts
---
在 `storage.ts` 中实现 `loadBoard(raw)`：`raw` 是 `localStorage.getItem` 读到的字符串（还没有保存过时是 `null`），返回 `{ ok: true, board, migrated }` 或者 `{ ok: false, error }`。`serializeBoard` 已经写好，它按第 2 版的格式 `{ version: 2, board }` 保存。

1. `null`：`{ ok: true, board: EMPTY_BOARD, migrated: false }`；
2. 不是合法的 JSON：`JSON 格式不正确`；解析出来不是对象（数组、`null`、数字……）：`数据的格式不正确`；
3. `version` 是 2：`board.tasks` 必须是数组（否则 `数据的格式不正确`），每个任务都要符合 `Task`：
   - `id` 是 `t` 加上不以 0 开头的数字；`title` 去掉首尾空白后不为空、不超过 40 个字符；`tags` 是最多 3 个、互不重复、不为空、不超过 10 个字符的字符串；`status` 是三列之一；`createdAt` 是有限的数字；
   - 不符合时：`第 2 个任务的数据不正确`（数字是它在数组中的位置，从 1 开始）；
   - 只取出这五个字段组成新的对象，其他字段丢掉；
4. `version` 是 1（旧版本）：`{ version: 1, todos: [{ id, text, done }] }`，`todos` 必须是数组（否则 `数据的格式不正确`）。每一项的 `id` 是正整数、`text` 去掉首尾空白后不为空、`done` 是布尔值，否则 `第 2 个待办的数据不正确`。转换成任务：`id` 变成 `'t' + id`，标题是去掉首尾空白的 `text`（超过 40 个字符时只保留前 40 个），没有标签，`done` 为 `true` 时在“已完成”、否则在“待办”，`createdAt` 是它在数组中的下标；`nextId` 是最大的 `id` 加 1；结果中 `migrated` 为 `true`；
5. 其他版本：`不支持的版本：3`（数字换成读到的值，没有 `version` 时是 `undefined`）；
6. 最后检查整个任务板（两个版本都要）：编号重复时 `任务的编号重复：t2`；`nextId` 不是整数、或者不大于所有任务的编号时 `nextId 不正确`。

所有的长度都按字符计算（`[...text].length`）。不能使用类型断言（`as`）：数据是 `unknown`，要逐项检查。

:::files{role=starter}
```ts file=storage.ts
import { STATUSES, type Board, type Status, type Task } from './board';

export const STORAGE_KEY = 'taskboard';
export const BACKUP_KEY = 'taskboard:backup';
export const EMPTY_BOARD: Board = { tasks: [], nextId: 1 };

export type LoadResult = { ok: true; board: Board; migrated: boolean } | { ok: false; error: string };

/** 按第 2 版的格式保存 */
export function serializeBoard(board: Board): string {
  return JSON.stringify({ version: 2, board });
}

/** 读取 localStorage 中保存的字符串（null 表示还没有保存过） */
export function loadBoard(raw: string | null): LoadResult {
  // TODO：解析 JSON、按版本验证或转换
  return { ok: true, board: raw === null ? EMPTY_BOARD : JSON.parse(raw).board, migrated: false };
}
```
```ts file=main.ts
import { loadBoard, serializeBoard } from './storage';

const saved = serializeBoard({ tasks: [{ id: 't1', title: '写周报', tags: ['工作'], status: 'todo', createdAt: 1 }], nextId: 2 });
console.log(saved);
console.log(loadBoard(saved));
console.log(loadBoard('{"version":1,"todos":[{"id":3,"text":"修自行车","done":true}]}'));
console.log(loadBoard('坏掉的数据'));
```
:::

:::files{role=support}
```ts file=board.ts readonly
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
:::

:::files{role=solution}
```ts file=storage.ts
import { STATUSES, type Board, type Status, type Task } from './board';

export const STORAGE_KEY = 'taskboard';
export const BACKUP_KEY = 'taskboard:backup';
export const EMPTY_BOARD: Board = { tasks: [], nextId: 1 };

export type LoadResult = { ok: true; board: Board; migrated: boolean } | { ok: false; error: string };

/** 按第 2 版的格式保存 */
export function serializeBoard(board: Board): string {
  return JSON.stringify({ version: 2, board });
}

const fail = (error: string): LoadResult => ({ ok: false, error });
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isStatus = (value: unknown): value is Status => STATUSES.some((s) => s === value);
const charCount = (text: string) => [...text].length;
const ID = /^t[1-9]\d*$/;
const idNumber = (id: string) => Number(id.slice(1));

/** 验证第 2 版中的一个任务；只取出认识的字段，组成新的对象 */
function parseTask(value: unknown): Task | null {
  if (!isObject(value)) return null;
  const { id, title, tags, status, createdAt } = value;
  if (typeof id !== 'string' || !ID.test(id)) return null;
  if (typeof title !== 'string' || title.trim() === '' || charCount(title) > 40) return null;
  if (!Array.isArray(tags) || tags.length > 3) return null;
  const cleanTags: string[] = [];
  for (const tag of tags) {
    if (typeof tag !== 'string' || tag === '' || charCount(tag) > 10 || cleanTags.includes(tag)) return null;
    cleanTags.push(tag);
  }
  if (!isStatus(status) || typeof createdAt !== 'number' || !Number.isFinite(createdAt)) return null;
  return { id, title, tags: cleanTags, status, createdAt };
}

/** 检查整个任务板：编号不能重复，nextId 是大于所有编号的整数 */
function finish(tasks: Task[], nextId: unknown, migrated: boolean): LoadResult {
  const seen = new Set<string>();
  for (const task of tasks) {
    if (seen.has(task.id)) return fail(`任务的编号重复：${task.id}`);
    seen.add(task.id);
  }
  if (typeof nextId !== 'number' || !Number.isSafeInteger(nextId) || tasks.some((t) => idNumber(t.id) >= nextId)) {
    return fail('nextId 不正确');
  }
  return { ok: true, board: { tasks, nextId }, migrated };
}

function parseV2(data: Record<string, unknown>): LoadResult {
  const board = data['board'];
  if (!isObject(board) || !Array.isArray(board['tasks'])) return fail('数据的格式不正确');
  const tasks: Task[] = [];
  for (const [index, item] of board['tasks'].entries()) {
    const task = parseTask(item);
    if (task === null) return fail(`第 ${index + 1} 个任务的数据不正确`);
    tasks.push(task);
  }
  return finish(tasks, board['nextId'], false);
}

/** 第 1 版：{ version: 1, todos: [{ id: 数字, text, done }] }，转换成第 2 版的任务板 */
function migrateV1(data: Record<string, unknown>): LoadResult {
  const todos = data['todos'];
  if (!Array.isArray(todos)) return fail('数据的格式不正确');
  const tasks: Task[] = [];
  let maxId = 0;
  for (const [index, item] of todos.entries()) {
    const bad = fail(`第 ${index + 1} 个待办的数据不正确`);
    if (!isObject(item)) return bad;
    const { id, text, done } = item;
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) return bad;
    if (typeof text !== 'string' || text.trim() === '' || typeof done !== 'boolean') return bad;
    const title = [...text.trim()].slice(0, 40).join('');
    tasks.push({ id: `t${id}`, title, tags: [], status: done ? 'done' : 'todo', createdAt: index });
    maxId = Math.max(maxId, id);
  }
  return finish(tasks, maxId + 1, true);
}

/** 读取 localStorage 中保存的字符串（null 表示还没有保存过） */
export function loadBoard(raw: string | null): LoadResult {
  if (raw === null) return { ok: true, board: EMPTY_BOARD, migrated: false };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return fail('JSON 格式不正确');
  }
  if (!isObject(data)) return fail('数据的格式不正确');
  if (data['version'] === 1) return migrateV1(data);
  if (data['version'] === 2) return parseV2(data);
  return fail(`不支持的版本：${String(data['version'])}`);
}
```
```ts file=main.ts
import { loadBoard, serializeBoard } from './storage';

const saved = serializeBoard({ tasks: [{ id: 't1', title: '写周报', tags: ['工作'], status: 'todo', createdAt: 1 }], nextId: 2 });
console.log(saved);
console.log(loadBoard(saved));
console.log(loadBoard('{"version":1,"todos":[{"id":3,"text":"修自行车","done":true}]}'));
console.log(loadBoard('坏掉的数据'));
```
:::

:::files{role=tests}
```ts file=storage.test.ts
import { describe, expect, test } from 'vitest';
import type { Board } from './board';
import { EMPTY_BOARD, loadBoard, serializeBoard } from './storage';

const board: Board = {
  tasks: [
    { id: 't1', title: '写周报', tags: ['工作'], status: 'todo', createdAt: 10 },
    { id: 't3', title: '修自行车', tags: [], status: 'done', createdAt: 20 },
  ],
  nextId: 4,
};

const v2 = (data: unknown) => JSON.stringify({ version: 2, board: data });
const task = (extra: Record<string, unknown>) => ({ id: 't1', title: '写周报', tags: [], status: 'todo', createdAt: 1, ...extra });

describe('loadBoard', () => {
  test('还没有保存过（null）：空的任务板', () => {
    expect(loadBoard(null)).toEqual({ ok: true, board: EMPTY_BOARD, migrated: false });
  });

  test('保存之后原样读回来', () => {
    const raw = serializeBoard(board);
    expect(JSON.parse(raw)).toEqual({ version: 2, board });
    expect(loadBoard(raw)).toEqual({ ok: true, board, migrated: false });
  });

  test('不是 JSON、不是对象、不认识的版本', () => {
    expect(loadBoard('不是 JSON')).toEqual({ ok: false, error: 'JSON 格式不正确' });
    expect(loadBoard('[1, 2]')).toEqual({ ok: false, error: '数据的格式不正确' });
    expect(loadBoard('null')).toEqual({ ok: false, error: '数据的格式不正确' });
    expect(loadBoard('{"version":3,"board":{"tasks":[],"nextId":1}}')).toEqual({ ok: false, error: '不支持的版本：3' });
    expect(loadBoard('{}')).toEqual({ ok: false, error: '不支持的版本：undefined' });
    expect(loadBoard('{"version":2,"board":{"nextId":1}}')).toEqual({ ok: false, error: '数据的格式不正确' });
  });

  test('第 2 版中不合法的任务：报告是第几个', () => {
    const bad = [
      { status: 'archived' },
      { id: 'x1' },
      { id: 't01' },
      { title: '   ' },
      { title: '字'.repeat(41) },
      { tags: ['a', 'b', 'c', 'd'] },
      { tags: ['工作', '工作'] },
      { tags: [''] },
      { createdAt: '昨天' },
    ];
    for (const extra of bad) {
      expect(loadBoard(v2({ tasks: [task({ id: 't9' }), task(extra)], nextId: 10 })), JSON.stringify(extra)).toEqual({ ok: false, error: '第 2 个任务的数据不正确' });
    }
  });

  test('编号重复、nextId 不正确', () => {
    expect(loadBoard(v2({ tasks: [task({ id: 't2' }), task({ id: 't2' })], nextId: 3 }))).toEqual({ ok: false, error: '任务的编号重复：t2' });
    expect(loadBoard(v2({ tasks: [task({ id: 't5' })], nextId: 5 }))).toEqual({ ok: false, error: 'nextId 不正确' });
    expect(loadBoard(v2({ tasks: [task({ id: 't5' })], nextId: '6' }))).toEqual({ ok: false, error: 'nextId 不正确' });
    expect(loadBoard(v2({ tasks: [], nextId: 1.5 }))).toEqual({ ok: false, error: 'nextId 不正确' });
  });

  test('只保留认识的字段（例如不会把界面状态读进来）', () => {
    const result = loadBoard(v2({ tasks: [task({ editing: true, color: 'red' })], nextId: 2 }));
    expect(result).toEqual({ ok: true, board: { tasks: [task({})], nextId: 2 }, migrated: false });
  });

  test('第 1 版的数据：转换成第 2 版', () => {
    const raw = JSON.stringify({
      version: 1,
      todos: [
        { id: 3, text: '  修自行车 ', done: true },
        { id: 1, text: '写周报', done: false },
        { id: 7, text: '长'.repeat(50), done: false },
      ],
    });
    expect(loadBoard(raw)).toEqual({
      ok: true,
      migrated: true,
      board: {
        tasks: [
          { id: 't3', title: '修自行车', tags: [], status: 'done', createdAt: 0 },
          { id: 't1', title: '写周报', tags: [], status: 'todo', createdAt: 1 },
          { id: 't7', title: '长'.repeat(40), tags: [], status: 'todo', createdAt: 2 },
        ],
        nextId: 8,
      },
    });
  });

  test('第 1 版中不合法的数据', () => {
    expect(loadBoard('{"version":1,"todos":[{"id":1,"text":"a","done":false},{"id":"2","text":"b","done":false}]}')).toEqual({ ok: false, error: '第 2 个待办的数据不正确' });
    expect(loadBoard('{"version":1,"todos":[{"id":1,"text":"   ","done":false}]}')).toEqual({ ok: false, error: '第 1 个待办的数据不正确' });
    expect(loadBoard('{"version":1,"todos":[{"id":1,"text":"a","done":false},{"id":1,"text":"b","done":true}]}')).toEqual({ ok: false, error: '任务的编号重复：t1' });
    expect(loadBoard('{"version":1}')).toEqual({ ok: false, error: '数据的格式不正确' });
  });
});
```
```ts file=storage.test-d.ts
import { expectTypeOf } from 'vitest';
import type { Board } from './board';
import { loadBoard } from './storage';

const result = loadBoard(null);
// @ts-expect-error 先检查 ok，才能读取 board
console.log(result.board);
if (result.ok) {
  expectTypeOf(result.board).toEqualTypeOf<Board>();
  expectTypeOf(result.migrated).toEqualTypeOf<boolean>();
} else {
  expectTypeOf(result.error).toEqualTypeOf<string>();
}
```
:::

:::hint{level=1}
先写几个小工具：`isObject(value)`（类型守卫，排除 `null` 和数组）、`isStatus(value)`、`fail(error)`。`loadBoard` 中用 `try/catch` 包住 `JSON.parse`，再按 `data['version']` 分别交给 `parseV2(data)` 和 `migrateV1(data)`。
:::

:::hint{level=2}
验证一个任务：`const { id, title, tags, status, createdAt } = value`，逐个检查类型和规则，全部通过才返回 `{ id, title, tags: …, status, createdAt }` 这个新对象。编号重复、`nextId` 的检查对两个版本是一样的，写成一个 `finish(tasks, nextId, migrated)`。遍历数组时需要下标，用 `for (const [index, item] of array.entries())`。
:::

:::explanation
这个函数是任务板与外部世界之间的“海关”：存储中的数据可能来自旧版本的应用、可能被用户在开发者工具中改过、也可能是另一段代码写坏的。在这里逐项检查一次，之后的代码（`reduce`、`renderBoard`）就可以完全相信 `Board` 的类型（e06）。

几个值得注意的设计：

- **只取出认识的字段**：直接返回读到的对象，多余的字段（例如以前不小心保存进去的 `editing`）会一直跟着任务走，而且类型上看不见。逐个字段地构造新对象，`Task` 里就只有 `Task` 的东西；
- **错误说出位置**：“第 2 个任务的数据不正确”比“数据不正确”有用得多，尤其是在把备份的数据拿出来修复时；
- **迁移在验证之前完成**：第 1 版的数据先被转换成第 2 版的任务，再和第 2 版一样检查编号与 `nextId`。`migrated: true` 告诉调用方：读到的是旧格式，应该用新格式重新保存一次，下次就不用再转换了；
- **不认识的版本不要猜**：一个将来的第 3 版被旧的应用读到时，按第 2 版去解析可能“碰巧成功”，再用第 2 版的格式保存回去，第 3 版新增的内容就丢了。

不使用 `as Board` 这样的断言：它只是让编译器闭嘴，坏数据照样会进入程序（一个错误解就是这样写的）。
:::

:::variant{kind=alt name=check-functions}
```ts file=storage.ts
import { STATUSES, type Board, type Status, type Task } from './board';

export const STORAGE_KEY = 'taskboard';
export const BACKUP_KEY = 'taskboard:backup';
export const EMPTY_BOARD: Board = { tasks: [], nextId: 1 };

export type LoadResult = { ok: true; board: Board; migrated: boolean } | { ok: false; error: string };

/** 按第 2 版的格式保存 */
export function serializeBoard(board: Board): string {
  return JSON.stringify({ version: 2, board });
}

type Check<T> = (value: unknown) => T | null;

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : null;

const length = (text: string) => Array.from(text).length;

const text: (max: number) => Check<string> = (max) => (value) => (typeof value === 'string' && value.trim() !== '' && length(value) <= max ? value : null);

const status: Check<Status> = (value) => {
  for (const s of STATUSES) if (s === value) return s;
  return null;
};

function tagList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 3) return null;
  const tags = value.map((t: unknown) => (typeof t === 'string' && t !== '' && length(t) <= 10 ? t : null));
  if (tags.some((t) => t === null)) return null;
  const strings = tags.filter((t): t is string => t !== null);
  return new Set(strings).size === strings.length ? strings : null;
}

function toTask(value: unknown): Task | null {
  const r = record(value);
  if (r === null) return null;
  const id = typeof r['id'] === 'string' && /^t[1-9][0-9]*$/.test(r['id']) ? r['id'] : null;
  const title = text(40)(r['title']);
  const tags = tagList(r['tags']);
  const s = status(r['status']);
  const createdAt = typeof r['createdAt'] === 'number' && Number.isFinite(r['createdAt']) ? r['createdAt'] : null;
  if (id === null || title === null || tags === null || s === null || createdAt === null) return null;
  return { id, title, tags, status: s, createdAt };
}

function done(tasks: Task[], nextId: unknown, migrated: boolean): LoadResult {
  const ids = tasks.map((t) => t.id);
  const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);
  if (duplicate !== undefined) return { ok: false, error: `任务的编号重复：${duplicate}` };
  const max = Math.max(0, ...ids.map((id) => Number(id.slice(1))));
  if (!Number.isInteger(nextId) || typeof nextId !== 'number' || nextId <= max) return { ok: false, error: 'nextId 不正确' };
  return { ok: true, board: { tasks, nextId }, migrated };
}

export function loadBoard(raw: string | null): LoadResult {
  if (raw === null) return { ok: true, board: EMPTY_BOARD, migrated: false };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'JSON 格式不正确' };
  }
  const data = record(parsed);
  if (data === null) return { ok: false, error: '数据的格式不正确' };

  switch (data['version']) {
    case 2: {
      const board = record(data['board']);
      const list = board?.['tasks'];
      if (board === null || !Array.isArray(list)) return { ok: false, error: '数据的格式不正确' };
      const tasks: Task[] = [];
      for (let i = 0; i < list.length; i++) {
        const t = toTask(list[i]);
        if (t === null) return { ok: false, error: `第 ${i + 1} 个任务的数据不正确` };
        tasks.push(t);
      }
      return done(tasks, board['nextId'], false);
    }
    case 1: {
      const todos = data['todos'];
      if (!Array.isArray(todos)) return { ok: false, error: '数据的格式不正确' };
      const tasks: Task[] = [];
      for (let i = 0; i < todos.length; i++) {
        const r = record(todos[i]);
        const id = r?.['id'];
        const body = r?.['text'];
        const finished = r?.['done'];
        if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1 || typeof body !== 'string' || !body.trim() || typeof finished !== 'boolean') {
          return { ok: false, error: `第 ${i + 1} 个待办的数据不正确` };
        }
        tasks.push({ id: 't' + id, title: Array.from(body.trim()).slice(0, 40).join(''), tags: [], status: finished ? 'done' : 'todo', createdAt: i });
      }
      const max = Math.max(0, ...tasks.map((t) => Number(t.id.slice(1))));
      return done(tasks, max + 1, true);
    }
    default:
      return { ok: false, error: `不支持的版本：${String(data['version'])}` };
  }
}
```
:::

:::variant{kind=wrong name=trust-json fails=rules reason="用 as 把解析出来的数据当作 Board，没有验证"}
```ts file=storage.ts
import { STATUSES, type Board, type Status, type Task } from './board';

export const STORAGE_KEY = 'taskboard';
export const BACKUP_KEY = 'taskboard:backup';
export const EMPTY_BOARD: Board = { tasks: [], nextId: 1 };

export type LoadResult = { ok: true; board: Board; migrated: boolean } | { ok: false; error: string };

/** 按第 2 版的格式保存 */
export function serializeBoard(board: Board): string {
  return JSON.stringify({ version: 2, board });
}

export function loadBoard(raw: string | null): LoadResult {
  if (raw === null) return { ok: true, board: EMPTY_BOARD, migrated: false };
  try {
    const data = JSON.parse(raw) as { version: number; board: Board };
    if (data.version !== 2) return { ok: false, error: `不支持的版本：${String(data.version)}` };
    return { ok: true, board: data.board, migrated: false };
  } catch {
    return { ok: false, error: 'JSON 格式不正确' };
  }
}
```
:::

:::variant{kind=wrong name=keep-unknown-fields fails=tests reason="把读到的对象展开进结果，多余的字段也带进了任务"}
```ts file=storage.ts
import { STATUSES, type Board, type Status, type Task } from './board';

export const STORAGE_KEY = 'taskboard';
export const BACKUP_KEY = 'taskboard:backup';
export const EMPTY_BOARD: Board = { tasks: [], nextId: 1 };

export type LoadResult = { ok: true; board: Board; migrated: boolean } | { ok: false; error: string };

/** 按第 2 版的格式保存 */
export function serializeBoard(board: Board): string {
  return JSON.stringify({ version: 2, board });
}

const fail = (error: string): LoadResult => ({ ok: false, error });
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isStatus = (value: unknown): value is Status => STATUSES.some((s) => s === value);
const charCount = (text: string) => [...text].length;
const ID = /^t[1-9]\d*$/;
const idNumber = (id: string) => Number(id.slice(1));

/** 验证第 2 版中的一个任务；只取出认识的字段，组成新的对象 */
function parseTask(value: unknown): Task | null {
  if (!isObject(value)) return null;
  const { id, title, tags, status, createdAt } = value;
  if (typeof id !== 'string' || !ID.test(id)) return null;
  if (typeof title !== 'string' || title.trim() === '' || charCount(title) > 40) return null;
  if (!Array.isArray(tags) || tags.length > 3) return null;
  const cleanTags: string[] = [];
  for (const tag of tags) {
    if (typeof tag !== 'string' || tag === '' || charCount(tag) > 10 || cleanTags.includes(tag)) return null;
    cleanTags.push(tag);
  }
  if (!isStatus(status) || typeof createdAt !== 'number' || !Number.isFinite(createdAt)) return null;
  return { ...value, id, title, tags: cleanTags, status, createdAt };
}

/** 检查整个任务板：编号不能重复，nextId 是大于所有编号的整数 */
function finish(tasks: Task[], nextId: unknown, migrated: boolean): LoadResult {
  const seen = new Set<string>();
  for (const task of tasks) {
    if (seen.has(task.id)) return fail(`任务的编号重复：${task.id}`);
    seen.add(task.id);
  }
  if (typeof nextId !== 'number' || !Number.isSafeInteger(nextId) || tasks.some((t) => idNumber(t.id) >= nextId)) {
    return fail('nextId 不正确');
  }
  return { ok: true, board: { tasks, nextId }, migrated };
}

function parseV2(data: Record<string, unknown>): LoadResult {
  const board = data['board'];
  if (!isObject(board) || !Array.isArray(board['tasks'])) return fail('数据的格式不正确');
  const tasks: Task[] = [];
  for (const [index, item] of board['tasks'].entries()) {
    const task = parseTask(item);
    if (task === null) return fail(`第 ${index + 1} 个任务的数据不正确`);
    tasks.push(task);
  }
  return finish(tasks, board['nextId'], false);
}

/** 第 1 版：{ version: 1, todos: [{ id: 数字, text, done }] }，转换成第 2 版的任务板 */
function migrateV1(data: Record<string, unknown>): LoadResult {
  const todos = data['todos'];
  if (!Array.isArray(todos)) return fail('数据的格式不正确');
  const tasks: Task[] = [];
  let maxId = 0;
  for (const [index, item] of todos.entries()) {
    const bad = fail(`第 ${index + 1} 个待办的数据不正确`);
    if (!isObject(item)) return bad;
    const { id, text, done } = item;
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) return bad;
    if (typeof text !== 'string' || text.trim() === '' || typeof done !== 'boolean') return bad;
    const title = [...text.trim()].slice(0, 40).join('');
    tasks.push({ id: `t${id}`, title, tags: [], status: done ? 'done' : 'todo', createdAt: index });
    maxId = Math.max(maxId, id);
  }
  return finish(tasks, maxId + 1, true);
}

/** 读取 localStorage 中保存的字符串（null 表示还没有保存过） */
export function loadBoard(raw: string | null): LoadResult {
  if (raw === null) return { ok: true, board: EMPTY_BOARD, migrated: false };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return fail('JSON 格式不正确');
  }
  if (!isObject(data)) return fail('数据的格式不正确');
  if (data['version'] === 1) return migrateV1(data);
  if (data['version'] === 2) return parseV2(data);
  return fail(`不支持的版本：${String(data['version'])}`);
}
```
:::

:::variant{kind=wrong name=no-duplicate-check fails=tests reason="没有检查编号是否重复"}
```ts file=storage.ts
import { STATUSES, type Board, type Status, type Task } from './board';

export const STORAGE_KEY = 'taskboard';
export const BACKUP_KEY = 'taskboard:backup';
export const EMPTY_BOARD: Board = { tasks: [], nextId: 1 };

export type LoadResult = { ok: true; board: Board; migrated: boolean } | { ok: false; error: string };

/** 按第 2 版的格式保存 */
export function serializeBoard(board: Board): string {
  return JSON.stringify({ version: 2, board });
}

const fail = (error: string): LoadResult => ({ ok: false, error });
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isStatus = (value: unknown): value is Status => STATUSES.some((s) => s === value);
const charCount = (text: string) => [...text].length;
const ID = /^t[1-9]\d*$/;
const idNumber = (id: string) => Number(id.slice(1));

/** 验证第 2 版中的一个任务；只取出认识的字段，组成新的对象 */
function parseTask(value: unknown): Task | null {
  if (!isObject(value)) return null;
  const { id, title, tags, status, createdAt } = value;
  if (typeof id !== 'string' || !ID.test(id)) return null;
  if (typeof title !== 'string' || title.trim() === '' || charCount(title) > 40) return null;
  if (!Array.isArray(tags) || tags.length > 3) return null;
  const cleanTags: string[] = [];
  for (const tag of tags) {
    if (typeof tag !== 'string' || tag === '' || charCount(tag) > 10 || cleanTags.includes(tag)) return null;
    cleanTags.push(tag);
  }
  if (!isStatus(status) || typeof createdAt !== 'number' || !Number.isFinite(createdAt)) return null;
  return { id, title, tags: cleanTags, status, createdAt };
}

/** 检查整个任务板：编号不能重复，nextId 是大于所有编号的整数 */
function finish(tasks: Task[], nextId: unknown, migrated: boolean): LoadResult {
  if (typeof nextId !== 'number' || !Number.isSafeInteger(nextId) || tasks.some((t) => idNumber(t.id) >= nextId)) {
    return fail('nextId 不正确');
  }
  return { ok: true, board: { tasks, nextId }, migrated };
}

function parseV2(data: Record<string, unknown>): LoadResult {
  const board = data['board'];
  if (!isObject(board) || !Array.isArray(board['tasks'])) return fail('数据的格式不正确');
  const tasks: Task[] = [];
  for (const [index, item] of board['tasks'].entries()) {
    const task = parseTask(item);
    if (task === null) return fail(`第 ${index + 1} 个任务的数据不正确`);
    tasks.push(task);
  }
  return finish(tasks, board['nextId'], false);
}

/** 第 1 版：{ version: 1, todos: [{ id: 数字, text, done }] }，转换成第 2 版的任务板 */
function migrateV1(data: Record<string, unknown>): LoadResult {
  const todos = data['todos'];
  if (!Array.isArray(todos)) return fail('数据的格式不正确');
  const tasks: Task[] = [];
  let maxId = 0;
  for (const [index, item] of todos.entries()) {
    const bad = fail(`第 ${index + 1} 个待办的数据不正确`);
    if (!isObject(item)) return bad;
    const { id, text, done } = item;
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) return bad;
    if (typeof text !== 'string' || text.trim() === '' || typeof done !== 'boolean') return bad;
    const title = [...text.trim()].slice(0, 40).join('');
    tasks.push({ id: `t${id}`, title, tags: [], status: done ? 'done' : 'todo', createdAt: index });
    maxId = Math.max(maxId, id);
  }
  return finish(tasks, maxId + 1, true);
}

/** 读取 localStorage 中保存的字符串（null 表示还没有保存过） */
export function loadBoard(raw: string | null): LoadResult {
  if (raw === null) return { ok: true, board: EMPTY_BOARD, migrated: false };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return fail('JSON 格式不正确');
  }
  if (!isObject(data)) return fail('数据的格式不正确');
  if (data['version'] === 1) return migrateV1(data);
  if (data['version'] === 2) return parseV2(data);
  return fail(`不支持的版本：${String(data['version'])}`);
}
```
:::

:::variant{kind=wrong name=migrate-ignores-done fails=tests reason="转换旧数据时忽略了 done，已完成的待办都回到了“待办”"}
```ts file=storage.ts
import { STATUSES, type Board, type Status, type Task } from './board';

export const STORAGE_KEY = 'taskboard';
export const BACKUP_KEY = 'taskboard:backup';
export const EMPTY_BOARD: Board = { tasks: [], nextId: 1 };

export type LoadResult = { ok: true; board: Board; migrated: boolean } | { ok: false; error: string };

/** 按第 2 版的格式保存 */
export function serializeBoard(board: Board): string {
  return JSON.stringify({ version: 2, board });
}

const fail = (error: string): LoadResult => ({ ok: false, error });
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isStatus = (value: unknown): value is Status => STATUSES.some((s) => s === value);
const charCount = (text: string) => [...text].length;
const ID = /^t[1-9]\d*$/;
const idNumber = (id: string) => Number(id.slice(1));

/** 验证第 2 版中的一个任务；只取出认识的字段，组成新的对象 */
function parseTask(value: unknown): Task | null {
  if (!isObject(value)) return null;
  const { id, title, tags, status, createdAt } = value;
  if (typeof id !== 'string' || !ID.test(id)) return null;
  if (typeof title !== 'string' || title.trim() === '' || charCount(title) > 40) return null;
  if (!Array.isArray(tags) || tags.length > 3) return null;
  const cleanTags: string[] = [];
  for (const tag of tags) {
    if (typeof tag !== 'string' || tag === '' || charCount(tag) > 10 || cleanTags.includes(tag)) return null;
    cleanTags.push(tag);
  }
  if (!isStatus(status) || typeof createdAt !== 'number' || !Number.isFinite(createdAt)) return null;
  return { id, title, tags: cleanTags, status, createdAt };
}

/** 检查整个任务板：编号不能重复，nextId 是大于所有编号的整数 */
function finish(tasks: Task[], nextId: unknown, migrated: boolean): LoadResult {
  const seen = new Set<string>();
  for (const task of tasks) {
    if (seen.has(task.id)) return fail(`任务的编号重复：${task.id}`);
    seen.add(task.id);
  }
  if (typeof nextId !== 'number' || !Number.isSafeInteger(nextId) || tasks.some((t) => idNumber(t.id) >= nextId)) {
    return fail('nextId 不正确');
  }
  return { ok: true, board: { tasks, nextId }, migrated };
}

function parseV2(data: Record<string, unknown>): LoadResult {
  const board = data['board'];
  if (!isObject(board) || !Array.isArray(board['tasks'])) return fail('数据的格式不正确');
  const tasks: Task[] = [];
  for (const [index, item] of board['tasks'].entries()) {
    const task = parseTask(item);
    if (task === null) return fail(`第 ${index + 1} 个任务的数据不正确`);
    tasks.push(task);
  }
  return finish(tasks, board['nextId'], false);
}

/** 第 1 版：{ version: 1, todos: [{ id: 数字, text, done }] }，转换成第 2 版的任务板 */
function migrateV1(data: Record<string, unknown>): LoadResult {
  const todos = data['todos'];
  if (!Array.isArray(todos)) return fail('数据的格式不正确');
  const tasks: Task[] = [];
  let maxId = 0;
  for (const [index, item] of todos.entries()) {
    const bad = fail(`第 ${index + 1} 个待办的数据不正确`);
    if (!isObject(item)) return bad;
    const { id, text, done } = item;
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) return bad;
    if (typeof text !== 'string' || text.trim() === '' || typeof done !== 'boolean') return bad;
    const title = [...text.trim()].slice(0, 40).join('');
    tasks.push({ id: `t${id}`, title, tags: [], status: 'todo', createdAt: index });
    maxId = Math.max(maxId, id);
  }
  return finish(tasks, maxId + 1, true);
}

/** 读取 localStorage 中保存的字符串（null 表示还没有保存过） */
export function loadBoard(raw: string | null): LoadResult {
  if (raw === null) return { ok: true, board: EMPTY_BOARD, migrated: false };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return fail('JSON 格式不正确');
  }
  if (!isObject(data)) return fail('数据的格式不正确');
  if (data['version'] === 1) return migrateV1(data);
  if (data['version'] === 2) return parseV2(data);
  return fail(`不支持的版本：${String(data['version'])}`);
}
```
:::

:::variant{kind=wrong name=guess-version fails=tests reason="不认识的版本也按第 2 版解析"}
```ts file=storage.ts
import { STATUSES, type Board, type Status, type Task } from './board';

export const STORAGE_KEY = 'taskboard';
export const BACKUP_KEY = 'taskboard:backup';
export const EMPTY_BOARD: Board = { tasks: [], nextId: 1 };

export type LoadResult = { ok: true; board: Board; migrated: boolean } | { ok: false; error: string };

/** 按第 2 版的格式保存 */
export function serializeBoard(board: Board): string {
  return JSON.stringify({ version: 2, board });
}

const fail = (error: string): LoadResult => ({ ok: false, error });
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isStatus = (value: unknown): value is Status => STATUSES.some((s) => s === value);
const charCount = (text: string) => [...text].length;
const ID = /^t[1-9]\d*$/;
const idNumber = (id: string) => Number(id.slice(1));

/** 验证第 2 版中的一个任务；只取出认识的字段，组成新的对象 */
function parseTask(value: unknown): Task | null {
  if (!isObject(value)) return null;
  const { id, title, tags, status, createdAt } = value;
  if (typeof id !== 'string' || !ID.test(id)) return null;
  if (typeof title !== 'string' || title.trim() === '' || charCount(title) > 40) return null;
  if (!Array.isArray(tags) || tags.length > 3) return null;
  const cleanTags: string[] = [];
  for (const tag of tags) {
    if (typeof tag !== 'string' || tag === '' || charCount(tag) > 10 || cleanTags.includes(tag)) return null;
    cleanTags.push(tag);
  }
  if (!isStatus(status) || typeof createdAt !== 'number' || !Number.isFinite(createdAt)) return null;
  return { id, title, tags: cleanTags, status, createdAt };
}

/** 检查整个任务板：编号不能重复，nextId 是大于所有编号的整数 */
function finish(tasks: Task[], nextId: unknown, migrated: boolean): LoadResult {
  const seen = new Set<string>();
  for (const task of tasks) {
    if (seen.has(task.id)) return fail(`任务的编号重复：${task.id}`);
    seen.add(task.id);
  }
  if (typeof nextId !== 'number' || !Number.isSafeInteger(nextId) || tasks.some((t) => idNumber(t.id) >= nextId)) {
    return fail('nextId 不正确');
  }
  return { ok: true, board: { tasks, nextId }, migrated };
}

function parseV2(data: Record<string, unknown>): LoadResult {
  const board = data['board'];
  if (!isObject(board) || !Array.isArray(board['tasks'])) return fail('数据的格式不正确');
  const tasks: Task[] = [];
  for (const [index, item] of board['tasks'].entries()) {
    const task = parseTask(item);
    if (task === null) return fail(`第 ${index + 1} 个任务的数据不正确`);
    tasks.push(task);
  }
  return finish(tasks, board['nextId'], false);
}

/** 第 1 版：{ version: 1, todos: [{ id: 数字, text, done }] }，转换成第 2 版的任务板 */
function migrateV1(data: Record<string, unknown>): LoadResult {
  const todos = data['todos'];
  if (!Array.isArray(todos)) return fail('数据的格式不正确');
  const tasks: Task[] = [];
  let maxId = 0;
  for (const [index, item] of todos.entries()) {
    const bad = fail(`第 ${index + 1} 个待办的数据不正确`);
    if (!isObject(item)) return bad;
    const { id, text, done } = item;
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) return bad;
    if (typeof text !== 'string' || text.trim() === '' || typeof done !== 'boolean') return bad;
    const title = [...text.trim()].slice(0, 40).join('');
    tasks.push({ id: `t${id}`, title, tags: [], status: done ? 'done' : 'todo', createdAt: index });
    maxId = Math.max(maxId, id);
  }
  return finish(tasks, maxId + 1, true);
}

/** 读取 localStorage 中保存的字符串（null 表示还没有保存过） */
export function loadBoard(raw: string | null): LoadResult {
  if (raw === null) return { ok: true, board: EMPTY_BOARD, migrated: false };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return fail('JSON 格式不正确');
  }
  if (!isObject(data)) return fail('数据的格式不正确');
  if (data['version'] === 1) return migrateV1(data);
  return parseV2(data);
}
```
:::
