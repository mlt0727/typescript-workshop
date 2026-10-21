---
kind: task
title: 带版本号的仓库
---
在 `todo-repo.ts` 中实现 `createTodoRepo(newId)`：一个内存中的待办仓库，用**乐观并发**防止两个人同时修改时互相覆盖。规则：

1. `create(title)`：标题去掉首尾的空白；已经有同样标题的待办时返回 `{ ok: false, reason: 'duplicate' }`（像数据库中的 UNIQUE 约束）；否则用 `newId()` 创建 `{ id, title, done: false, version: 1 }`，返回 `{ ok: true, value }`；
2. `get(id)`：没有时返回 `null`；`list()`：按创建的顺序返回所有的待办；
3. `update(id, expectedVersion, patch)`：
   - 没有这条待办：`{ ok: false, reason: 'not-found' }`；
   - 它当前的 `version` 不等于 `expectedVersion`：`{ ok: false, reason: 'conflict', current }`，`current` 是当前的待办，什么也不写入；
   - 修改之后的标题（去掉首尾的空白）和**另一条**待办重复：`{ ok: false, reason: 'duplicate' }`。版本先检查，重复后检查；
   - 否则写入：`patch` 中给出的字段替换原来的值，没有给出的不变，`version` 加一，返回新的待办；
4. `remove(id, expectedVersion)`：和 `update` 一样检查是否存在和版本，成功时删除并返回 `{ ok: true, value: null }`；
5. **所有**返回的待办对象（`create`、`get`、`list`、`update` 的结果，以及冲突时的 `current`）都是**冻结的**（`Object.freeze`），调用方不能通过它修改仓库中的数据；之后的修改也不能改变调用方已经拿到的对象（每个版本是一个新的对象）。`list()` 返回的数组也不是仓库内部的数组，修改之后的待办仍然在原来的位置；
6. 只有确定能创建时才调用 `newId()`：重复的标题不消耗 id。

:::files{role=starter}
```ts file=todo-repo.ts
export type Todo = Readonly<{ id: string; title: string; done: boolean; version: number }>;

export type Patch = Readonly<{ title?: string; done?: boolean }>;

export type Failure = { ok: false; reason: 'not-found' } | { ok: false; reason: 'duplicate' } | { ok: false; reason: 'conflict'; current: Todo };
export type Result<T> = { ok: true; value: T } | Failure;

export type TodoRepo = Readonly<{
  create(title: string): Result<Todo>;
  get(id: string): Todo | null;
  list(): Todo[];
  update(id: string, expectedVersion: number, patch: Patch): Result<Todo>;
  remove(id: string, expectedVersion: number): Result<null>;
}>;

/** 内存中的待办仓库：每次修改都要带上读到的版本号，版本不一致就是冲突 */
export function createTodoRepo(newId: () => string): TodoRepo {
  // TODO
  return {
    create: () => ({ ok: false, reason: 'not-found' }),
    get: () => null,
    list: () => [],
    update: () => ({ ok: false, reason: 'not-found' }),
    remove: () => ({ ok: false, reason: 'not-found' }),
  };
}
```
```ts file=main.ts
import { createTodoRepo } from './todo-repo';

let n = 0;
const repo = createTodoRepo(() => `t${++n}`);
repo.create('买牛奶');

// 两个人打开了同一条待办，看到的都是第 1 版
const alice = repo.get('t1');
const bob = repo.get('t1');

console.log('Alice 修改标题：', repo.update('t1', alice?.version ?? 0, { title: '买牛奶和面包' }));
console.log('Bob 勾选完成：', repo.update('t1', bob?.version ?? 0, { done: true }));
console.log('现在：', repo.list());
```
:::

:::files{role=solution}
```ts file=todo-repo.ts
export type Todo = Readonly<{ id: string; title: string; done: boolean; version: number }>;

export type Patch = Readonly<{ title?: string; done?: boolean }>;

export type Failure = { ok: false; reason: 'not-found' } | { ok: false; reason: 'duplicate' } | { ok: false; reason: 'conflict'; current: Todo };
export type Result<T> = { ok: true; value: T } | Failure;

export type TodoRepo = Readonly<{
  create(title: string): Result<Todo>;
  get(id: string): Todo | null;
  list(): Todo[];
  update(id: string, expectedVersion: number, patch: Patch): Result<Todo>;
  remove(id: string, expectedVersion: number): Result<null>;
}>;

/** 内存中的待办仓库：每次修改都要带上读到的版本号，版本不一致就是冲突 */
export function createTodoRepo(newId: () => string): TodoRepo {
  // Map 保持插入的顺序：list() 按创建的顺序返回
  const todos = new Map<string, Todo>();

  /** 标题像数据库中的 UNIQUE 约束一样不能重复（去掉首尾空白之后比较） */
  const titleTaken = (title: string, exceptId?: string) => [...todos.values()].some((todo) => todo.id !== exceptId && todo.title === title);

  /** 检查 id 和版本：通过时返回当前的待办 */
  function check(id: string, expectedVersion: number): { ok: true; todo: Todo } | Failure {
    const todo = todos.get(id);
    if (todo === undefined) return { ok: false, reason: 'not-found' };
    if (todo.version !== expectedVersion) return { ok: false, reason: 'conflict', current: todo };
    return { ok: true, todo };
  }

  return {
    create(title) {
      const trimmed = title.trim();
      if (titleTaken(trimmed)) return { ok: false, reason: 'duplicate' };
      const todo: Todo = Object.freeze({ id: newId(), title: trimmed, done: false, version: 1 });
      todos.set(todo.id, todo);
      return { ok: true, value: todo };
    },
    get(id) {
      return todos.get(id) ?? null;
    },
    list() {
      return [...todos.values()];
    },
    update(id, expectedVersion, patch) {
      const found = check(id, expectedVersion);
      if (!found.ok) return found;
      const title = patch.title === undefined ? found.todo.title : patch.title.trim();
      if (titleTaken(title, id)) return { ok: false, reason: 'duplicate' };
      // 每个版本都是一个新的冻结对象：调用方拿到的旧对象不会被悄悄改掉
      const next: Todo = Object.freeze({ ...found.todo, title, done: patch.done ?? found.todo.done, version: found.todo.version + 1 });
      todos.set(id, next);
      return { ok: true, value: next };
    },
    remove(id, expectedVersion) {
      const found = check(id, expectedVersion);
      if (!found.ok) return found;
      todos.delete(id);
      return { ok: true, value: null };
    },
  };
}
```
```ts file=main.ts
import { createTodoRepo } from './todo-repo';

let n = 0;
const repo = createTodoRepo(() => `t${++n}`);
repo.create('买牛奶');

// 两个人打开了同一条待办，看到的都是第 1 版
const alice = repo.get('t1');
const bob = repo.get('t1');

console.log('Alice 修改标题：', repo.update('t1', alice?.version ?? 0, { title: '买牛奶和面包' }));
console.log('Bob 勾选完成：', repo.update('t1', bob?.version ?? 0, { done: true }));
console.log('现在：', repo.list());
```
:::

:::files{role=tests}
```ts file=todo-repo.test.ts
import { describe, expect, test } from 'vitest';
import { createTodoRepo } from './todo-repo';

function setup() {
  let n = 0;
  return createTodoRepo(() => `t${++n}`);
}

describe('createTodoRepo', () => {
  test('创建：版本从 1 开始，标题去掉首尾的空白，按创建的顺序列出', () => {
    const repo = setup();
    expect(repo.create('  买牛奶 ')).toStrictEqual({ ok: true, value: { id: 't1', title: '买牛奶', done: false, version: 1 } });
    repo.create('写周报');
    expect(repo.list().map((todo) => todo.id)).toStrictEqual(['t1', 't2']);
    expect(repo.get('t2')).toStrictEqual({ id: 't2', title: '写周报', done: false, version: 1 });
    expect(repo.get('t9')).toBeNull();
  });

  test('修改：版本一致才写入，版本加一，没有给出的字段不变', () => {
    const repo = setup();
    repo.create('买牛奶');
    expect(repo.update('t1', 1, { done: true })).toStrictEqual({ ok: true, value: { id: 't1', title: '买牛奶', done: true, version: 2 } });
    expect(repo.update('t1', 2, { title: ' 买牛奶和面包 ' })).toStrictEqual({ ok: true, value: { id: 't1', title: '买牛奶和面包', done: true, version: 3 } });
  });

  test('两个人读到同一个版本：后提交的那个得到冲突和当前的数据，什么也没写入', () => {
    const repo = setup();
    repo.create('买牛奶');
    const alice = repo.get('t1');
    const bob = repo.get('t1');
    expect(repo.update('t1', alice?.version ?? 0, { title: '买牛奶和面包' }).ok).toBe(true);
    const result = repo.update('t1', bob?.version ?? 0, { done: true });
    expect(result).toStrictEqual({ ok: false, reason: 'conflict', current: { id: 't1', title: '买牛奶和面包', done: false, version: 2 } });
    expect(repo.get('t1')).toStrictEqual({ id: 't1', title: '买牛奶和面包', done: false, version: 2 });
  });

  test('删除也要带上版本', () => {
    const repo = setup();
    repo.create('买牛奶');
    repo.update('t1', 1, { done: true });
    expect(repo.remove('t1', 1)).toMatchObject({ ok: false, reason: 'conflict' });
    expect(repo.remove('t1', 2)).toStrictEqual({ ok: true, value: null });
    expect(repo.get('t1')).toBeNull();
    expect(repo.remove('t1', 2)).toStrictEqual({ ok: false, reason: 'not-found' });
    expect(repo.update('t1', 2, { done: false })).toStrictEqual({ ok: false, reason: 'not-found' });
  });

  test('标题不能重复（像 UNIQUE 约束）：创建和修改都检查，改成自己原来的标题可以', () => {
    const repo = setup();
    repo.create('买牛奶');
    repo.create('写周报');
    expect(repo.create(' 买牛奶 ')).toStrictEqual({ ok: false, reason: 'duplicate' });
    expect(repo.update('t2', 1, { title: '买牛奶' })).toStrictEqual({ ok: false, reason: 'duplicate' });
    expect(repo.update('t2', 1, { title: '写周报' })).toMatchObject({ ok: true, value: { version: 2 } });
    expect(repo.list()).toHaveLength(2);
  });

  test('先检查版本，再检查重复：过期的修改报告冲突', () => {
    const repo = setup();
    repo.create('买牛奶');
    repo.create('写周报');
    repo.update('t2', 1, { done: true });
    expect(repo.update('t2', 1, { title: '买牛奶' })).toMatchObject({ ok: false, reason: 'conflict' });
  });

  test('比当前更新的版本也是冲突', () => {
    const repo = setup();
    repo.create('买牛奶');
    expect(repo.update('t1', 5, { done: true })).toMatchObject({ ok: false, reason: 'conflict', current: { version: 1 } });
  });

  test('修改的标题也先去掉空白再检查重复；重复的标题不消耗 id', () => {
    const repo = setup();
    repo.create('买牛奶');
    repo.create('写周报');
    expect(repo.update('t2', 1, { title: ' 买牛奶 ' })).toStrictEqual({ ok: false, reason: 'duplicate' });
    repo.create('买牛奶');
    expect(repo.create('第三条')).toMatchObject({ ok: true, value: { id: 't3' } });
  });

  test('修改之后仍然按创建的顺序列出；删除冲突时带上当前的数据', () => {
    const repo = setup();
    repo.create('买牛奶');
    repo.create('写周报');
    repo.update('t1', 1, { done: true });
    expect(repo.list().map((todo) => todo.id)).toStrictEqual(['t1', 't2']);
    expect(repo.remove('t1', 1)).toStrictEqual({ ok: false, reason: 'conflict', current: { id: 't1', title: '买牛奶', done: true, version: 2 } });
  });

  test('所有返回的待办都是冻结的', () => {
    const repo = setup();
    const created = repo.create('买牛奶');
    const updated = repo.update('t1', 1, { done: true });
    const conflict = repo.update('t1', 1, { done: false });
    expect(created.ok && Object.isFrozen(created.value)).toBe(true);
    expect(updated.ok && Object.isFrozen(updated.value)).toBe(true);
    expect(!conflict.ok && conflict.reason === 'conflict' && Object.isFrozen(conflict.current)).toBe(true);
    expect(repo.list().every((todo) => Object.isFrozen(todo))).toBe(true);
  });

  test('返回的对象不能用来绕过仓库修改数据', () => {
    const repo = setup();
    repo.create('买牛奶');
    const snapshot = repo.get('t1');
    expect(Object.isFrozen(snapshot)).toBe(true);
    const listed = repo.list();
    listed.pop();
    expect(repo.list()).toHaveLength(1);
    // 修改之后，之前拿到的对象仍然是旧的版本
    repo.update('t1', 1, { done: true });
    expect(snapshot).toStrictEqual({ id: 't1', title: '买牛奶', done: false, version: 1 });
  });
});
```
:::

:::hint{level=1}
用一个 `Map<string, Todo>` 保存待办，`Map` 会保持插入的顺序。`update` 和 `remove` 都要先“找到这条待办并检查版本”，写成一个共用的函数。
:::

:::hint{level=2}
修改时不要改原来的对象，而是创建一个新的：`Object.freeze({ ...old, title, done, version: old.version + 1 })`，再放回 `Map`。检查重复时要排除正在修改的这一条自己。
:::

:::explanation
两个人同时打开同一条待办：Alice 改了标题，Bob 勾选了完成。如果仓库只是“谁最后提交就保存谁的”，Bob 提交时带着的是他看到的旧标题，Alice 的修改就悄悄地没了（丢失更新）。**乐观并发**让每次修改都带上“我是基于第几版改的”：版本一致才写入，否则告诉他“数据已经变了”，并把当前的数据给他，由用户或者程序决定怎么合并。它叫“乐观”，是因为它不加锁，假设冲突很少发生，真的发生时再处理。

在 HTTP 接口中，冲突通常是 409（h06），响应体带上当前的数据；也可以用 `ETag` 响应头和 `If-Match` 请求头表达版本，不一致时返回 412。这个网站的同步功能就是这样做的：推送时带上 `baseRevision`，和服务器上的 `revision` 不一致就返回 409 和当前的文档。

先检查版本、再检查重复，是因为基于过期数据的修改，最重要的信息是“数据已经变了”：用户需要先看到新的数据，重名不重名要在新数据的基础上再判断。

冻结并且每次创建新的对象，是在模拟数据库的行为：查询得到的是一份副本，修改查询结果不会改变数据库。如果仓库把内部的对象直接交出去，任何拿到它的代码都能绕过版本检查修改数据。

替代解在内部保存可以修改的行，每次对外返回时复制一份并冻结，就像从数据库中查出来的结果。
:::

:::variant{kind=alt name=frozen-copies}
```ts file=todo-repo.ts
export type Todo = Readonly<{ id: string; title: string; done: boolean; version: number }>;

export type Patch = Readonly<{ title?: string; done?: boolean }>;

export type Failure = { ok: false; reason: 'not-found' } | { ok: false; reason: 'duplicate' } | { ok: false; reason: 'conflict'; current: Todo };
export type Result<T> = { ok: true; value: T } | Failure;

export type TodoRepo = Readonly<{
  create(title: string): Result<Todo>;
  get(id: string): Todo | null;
  list(): Todo[];
  update(id: string, expectedVersion: number, patch: Patch): Result<Todo>;
  remove(id: string, expectedVersion: number): Result<null>;
}>;

type Row = { id: string; title: string; done: boolean; version: number };

/** 内部保存可以修改的行，对外只给冻结的副本，就像从数据库中查出来的结果 */
export function createTodoRepo(newId: () => string): TodoRepo {
  const rows: Row[] = [];
  const snapshot = (row: Row): Todo => Object.freeze({ ...row });
  const find = (id: string) => rows.find((row) => row.id === id);
  const duplicate = (title: string, self: Row | undefined) => rows.some((row) => row !== self && row.title === title);

  return {
    create(title) {
      const trimmed = title.trim();
      if (duplicate(trimmed, undefined)) return { ok: false, reason: 'duplicate' };
      // 确定能创建之后才取 id：重复的标题不消耗 id
      const row: Row = { id: newId(), title: trimmed, done: false, version: 1 };
      rows.push(row);
      return { ok: true, value: snapshot(row) };
    },
    get(id) {
      const row = find(id);
      return row === undefined ? null : snapshot(row);
    },
    list() {
      return rows.map(snapshot);
    },
    update(id, expectedVersion, patch) {
      const row = find(id);
      if (row === undefined) return { ok: false, reason: 'not-found' };
      if (row.version !== expectedVersion) return { ok: false, reason: 'conflict', current: snapshot(row) };
      const title = patch.title?.trim() ?? row.title;
      if (duplicate(title, row)) return { ok: false, reason: 'duplicate' };
      row.title = title;
      row.done = patch.done ?? row.done;
      row.version += 1;
      return { ok: true, value: snapshot(row) };
    },
    remove(id, expectedVersion) {
      const index = rows.findIndex((row) => row.id === id);
      const row = rows[index];
      if (row === undefined) return { ok: false, reason: 'not-found' };
      if (row.version !== expectedVersion) return { ok: false, reason: 'conflict', current: snapshot(row) };
      rows.splice(index, 1);
      return { ok: true, value: null };
    },
  };
}
```
:::

:::variant{kind=wrong name=last-write-wins fails=tests reason="不检查版本：后提交的人悄悄覆盖了前一个人的修改"}
```ts file=todo-repo.ts
export type Todo = Readonly<{ id: string; title: string; done: boolean; version: number }>;

export type Patch = Readonly<{ title?: string; done?: boolean }>;

export type Failure = { ok: false; reason: 'not-found' } | { ok: false; reason: 'duplicate' } | { ok: false; reason: 'conflict'; current: Todo };
export type Result<T> = { ok: true; value: T } | Failure;

export type TodoRepo = Readonly<{
  create(title: string): Result<Todo>;
  get(id: string): Todo | null;
  list(): Todo[];
  update(id: string, expectedVersion: number, patch: Patch): Result<Todo>;
  remove(id: string, expectedVersion: number): Result<null>;
}>;

/** 内存中的待办仓库：每次修改都要带上读到的版本号，版本不一致就是冲突 */
export function createTodoRepo(newId: () => string): TodoRepo {
  // Map 保持插入的顺序：list() 按创建的顺序返回
  const todos = new Map<string, Todo>();

  /** 标题像数据库中的 UNIQUE 约束一样不能重复（去掉首尾空白之后比较） */
  const titleTaken = (title: string, exceptId?: string) => [...todos.values()].some((todo) => todo.id !== exceptId && todo.title === title);

  /** 检查 id 和版本：通过时返回当前的待办 */
  function check(id: string, expectedVersion: number): { ok: true; todo: Todo } | Failure {
    const todo = todos.get(id);
    if (todo === undefined) return { ok: false, reason: 'not-found' };
    return { ok: true, todo };
  }

  return {
    create(title) {
      const trimmed = title.trim();
      if (titleTaken(trimmed)) return { ok: false, reason: 'duplicate' };
      const todo: Todo = Object.freeze({ id: newId(), title: trimmed, done: false, version: 1 });
      todos.set(todo.id, todo);
      return { ok: true, value: todo };
    },
    get(id) {
      return todos.get(id) ?? null;
    },
    list() {
      return [...todos.values()];
    },
    update(id, expectedVersion, patch) {
      const found = check(id, expectedVersion);
      if (!found.ok) return found;
      const title = patch.title === undefined ? found.todo.title : patch.title.trim();
      if (titleTaken(title, id)) return { ok: false, reason: 'duplicate' };
      // 每个版本都是一个新的冻结对象：调用方拿到的旧对象不会被悄悄改掉
      const next: Todo = Object.freeze({ ...found.todo, title, done: patch.done ?? found.todo.done, version: found.todo.version + 1 });
      todos.set(id, next);
      return { ok: true, value: next };
    },
    remove(id, expectedVersion) {
      const found = check(id, expectedVersion);
      if (!found.ok) return found;
      todos.delete(id);
      return { ok: true, value: null };
    },
  };
}
```
:::

:::variant{kind=wrong name=unfrozen fails=tests reason="返回的对象没有冻结：调用方可以直接修改仓库中的数据"}
```ts file=todo-repo.ts
export type Todo = Readonly<{ id: string; title: string; done: boolean; version: number }>;

export type Patch = Readonly<{ title?: string; done?: boolean }>;

export type Failure = { ok: false; reason: 'not-found' } | { ok: false; reason: 'duplicate' } | { ok: false; reason: 'conflict'; current: Todo };
export type Result<T> = { ok: true; value: T } | Failure;

export type TodoRepo = Readonly<{
  create(title: string): Result<Todo>;
  get(id: string): Todo | null;
  list(): Todo[];
  update(id: string, expectedVersion: number, patch: Patch): Result<Todo>;
  remove(id: string, expectedVersion: number): Result<null>;
}>;

/** 内存中的待办仓库：每次修改都要带上读到的版本号，版本不一致就是冲突 */
export function createTodoRepo(newId: () => string): TodoRepo {
  // Map 保持插入的顺序：list() 按创建的顺序返回
  const todos = new Map<string, Todo>();

  /** 标题像数据库中的 UNIQUE 约束一样不能重复（去掉首尾空白之后比较） */
  const titleTaken = (title: string, exceptId?: string) => [...todos.values()].some((todo) => todo.id !== exceptId && todo.title === title);

  /** 检查 id 和版本：通过时返回当前的待办 */
  function check(id: string, expectedVersion: number): { ok: true; todo: Todo } | Failure {
    const todo = todos.get(id);
    if (todo === undefined) return { ok: false, reason: 'not-found' };
    if (todo.version !== expectedVersion) return { ok: false, reason: 'conflict', current: todo };
    return { ok: true, todo };
  }

  return {
    create(title) {
      const trimmed = title.trim();
      if (titleTaken(trimmed)) return { ok: false, reason: 'duplicate' };
      const todo: Todo = { id: newId(), title: trimmed, done: false, version: 1 };
      todos.set(todo.id, todo);
      return { ok: true, value: todo };
    },
    get(id) {
      return todos.get(id) ?? null;
    },
    list() {
      return [...todos.values()];
    },
    update(id, expectedVersion, patch) {
      const found = check(id, expectedVersion);
      if (!found.ok) return found;
      const title = patch.title === undefined ? found.todo.title : patch.title.trim();
      if (titleTaken(title, id)) return { ok: false, reason: 'duplicate' };
      // 每个版本都是一个新的冻结对象：调用方拿到的旧对象不会被悄悄改掉
      const next: Todo = Object.freeze({ ...found.todo, title, done: patch.done ?? found.todo.done, version: found.todo.version + 1 });
      todos.set(id, next);
      return { ok: true, value: next };
    },
    remove(id, expectedVersion) {
      const found = check(id, expectedVersion);
      if (!found.ok) return found;
      todos.delete(id);
      return { ok: true, value: null };
    },
  };
}
```
:::

:::variant{kind=wrong name=duplicate-first fails=tests reason="先检查重复、再检查版本：基于过期数据的修改报告了“重名”，用户不知道数据已经变了"}
```ts file=todo-repo.ts
export type Todo = Readonly<{ id: string; title: string; done: boolean; version: number }>;

export type Patch = Readonly<{ title?: string; done?: boolean }>;

export type Failure = { ok: false; reason: 'not-found' } | { ok: false; reason: 'duplicate' } | { ok: false; reason: 'conflict'; current: Todo };
export type Result<T> = { ok: true; value: T } | Failure;

export type TodoRepo = Readonly<{
  create(title: string): Result<Todo>;
  get(id: string): Todo | null;
  list(): Todo[];
  update(id: string, expectedVersion: number, patch: Patch): Result<Todo>;
  remove(id: string, expectedVersion: number): Result<null>;
}>;

/** 内存中的待办仓库：每次修改都要带上读到的版本号，版本不一致就是冲突 */
export function createTodoRepo(newId: () => string): TodoRepo {
  // Map 保持插入的顺序：list() 按创建的顺序返回
  const todos = new Map<string, Todo>();

  /** 标题像数据库中的 UNIQUE 约束一样不能重复（去掉首尾空白之后比较） */
  const titleTaken = (title: string, exceptId?: string) => [...todos.values()].some((todo) => todo.id !== exceptId && todo.title === title);

  /** 检查 id 和版本：通过时返回当前的待办 */
  function check(id: string, expectedVersion: number): { ok: true; todo: Todo } | Failure {
    const todo = todos.get(id);
    if (todo === undefined) return { ok: false, reason: 'not-found' };
    if (todo.version !== expectedVersion) return { ok: false, reason: 'conflict', current: todo };
    return { ok: true, todo };
  }

  return {
    create(title) {
      const trimmed = title.trim();
      if (titleTaken(trimmed)) return { ok: false, reason: 'duplicate' };
      const todo: Todo = Object.freeze({ id: newId(), title: trimmed, done: false, version: 1 });
      todos.set(todo.id, todo);
      return { ok: true, value: todo };
    },
    get(id) {
      return todos.get(id) ?? null;
    },
    list() {
      return [...todos.values()];
    },
    update(id, expectedVersion, patch) {
      if (patch.title !== undefined && titleTaken(patch.title.trim(), id)) return { ok: false, reason: 'duplicate' };
      const found = check(id, expectedVersion);
      if (!found.ok) return found;
      const title = patch.title === undefined ? found.todo.title : patch.title.trim();
      // 每个版本都是一个新的冻结对象：调用方拿到的旧对象不会被悄悄改掉
      const next: Todo = Object.freeze({ ...found.todo, title, done: patch.done ?? found.todo.done, version: found.todo.version + 1 });
      todos.set(id, next);
      return { ok: true, value: next };
    },
    remove(id, expectedVersion) {
      const found = check(id, expectedVersion);
      if (!found.ok) return found;
      todos.delete(id);
      return { ok: true, value: null };
    },
  };
}
```
:::

:::variant{kind=wrong name=self-duplicate fails=tests reason="检查重复时没有排除自己：保持原来的标题也被当成了重名"}
```ts file=todo-repo.ts
export type Todo = Readonly<{ id: string; title: string; done: boolean; version: number }>;

export type Patch = Readonly<{ title?: string; done?: boolean }>;

export type Failure = { ok: false; reason: 'not-found' } | { ok: false; reason: 'duplicate' } | { ok: false; reason: 'conflict'; current: Todo };
export type Result<T> = { ok: true; value: T } | Failure;

export type TodoRepo = Readonly<{
  create(title: string): Result<Todo>;
  get(id: string): Todo | null;
  list(): Todo[];
  update(id: string, expectedVersion: number, patch: Patch): Result<Todo>;
  remove(id: string, expectedVersion: number): Result<null>;
}>;

/** 内存中的待办仓库：每次修改都要带上读到的版本号，版本不一致就是冲突 */
export function createTodoRepo(newId: () => string): TodoRepo {
  // Map 保持插入的顺序：list() 按创建的顺序返回
  const todos = new Map<string, Todo>();

  /** 标题像数据库中的 UNIQUE 约束一样不能重复（去掉首尾空白之后比较） */
  const titleTaken = (title: string, exceptId?: string) => [...todos.values()].some((todo) => todo.id !== exceptId && todo.title === title);

  /** 检查 id 和版本：通过时返回当前的待办 */
  function check(id: string, expectedVersion: number): { ok: true; todo: Todo } | Failure {
    const todo = todos.get(id);
    if (todo === undefined) return { ok: false, reason: 'not-found' };
    if (todo.version !== expectedVersion) return { ok: false, reason: 'conflict', current: todo };
    return { ok: true, todo };
  }

  return {
    create(title) {
      const trimmed = title.trim();
      if (titleTaken(trimmed)) return { ok: false, reason: 'duplicate' };
      const todo: Todo = Object.freeze({ id: newId(), title: trimmed, done: false, version: 1 });
      todos.set(todo.id, todo);
      return { ok: true, value: todo };
    },
    get(id) {
      return todos.get(id) ?? null;
    },
    list() {
      return [...todos.values()];
    },
    update(id, expectedVersion, patch) {
      const found = check(id, expectedVersion);
      if (!found.ok) return found;
      const title = patch.title === undefined ? found.todo.title : patch.title.trim();
      if (titleTaken(title)) return { ok: false, reason: 'duplicate' };
      // 每个版本都是一个新的冻结对象：调用方拿到的旧对象不会被悄悄改掉
      const next: Todo = Object.freeze({ ...found.todo, title, done: patch.done ?? found.todo.done, version: found.todo.version + 1 });
      todos.set(id, next);
      return { ok: true, value: next };
    },
    remove(id, expectedVersion) {
      const found = check(id, expectedVersion);
      if (!found.ok) return found;
      todos.delete(id);
      return { ok: true, value: null };
    },
  };
}
```
:::

:::variant{kind=wrong name=untrimmed-compare fails=tests reason="用去掉空白之前的标题检查重复：“ 买牛奶 ”和“买牛奶”被当成了两个标题"}
```ts file=todo-repo.ts
export type Todo = Readonly<{ id: string; title: string; done: boolean; version: number }>;

export type Patch = Readonly<{ title?: string; done?: boolean }>;

export type Failure = { ok: false; reason: 'not-found' } | { ok: false; reason: 'duplicate' } | { ok: false; reason: 'conflict'; current: Todo };
export type Result<T> = { ok: true; value: T } | Failure;

export type TodoRepo = Readonly<{
  create(title: string): Result<Todo>;
  get(id: string): Todo | null;
  list(): Todo[];
  update(id: string, expectedVersion: number, patch: Patch): Result<Todo>;
  remove(id: string, expectedVersion: number): Result<null>;
}>;

/** 内存中的待办仓库：每次修改都要带上读到的版本号，版本不一致就是冲突 */
export function createTodoRepo(newId: () => string): TodoRepo {
  // Map 保持插入的顺序：list() 按创建的顺序返回
  const todos = new Map<string, Todo>();

  /** 标题像数据库中的 UNIQUE 约束一样不能重复（去掉首尾空白之后比较） */
  const titleTaken = (title: string, exceptId?: string) => [...todos.values()].some((todo) => todo.id !== exceptId && todo.title === title);

  /** 检查 id 和版本：通过时返回当前的待办 */
  function check(id: string, expectedVersion: number): { ok: true; todo: Todo } | Failure {
    const todo = todos.get(id);
    if (todo === undefined) return { ok: false, reason: 'not-found' };
    if (todo.version !== expectedVersion) return { ok: false, reason: 'conflict', current: todo };
    return { ok: true, todo };
  }

  return {
    create(title) {
      const trimmed = title.trim();
      if (titleTaken(title)) return { ok: false, reason: 'duplicate' };
      const todo: Todo = Object.freeze({ id: newId(), title: trimmed, done: false, version: 1 });
      todos.set(todo.id, todo);
      return { ok: true, value: todo };
    },
    get(id) {
      return todos.get(id) ?? null;
    },
    list() {
      return [...todos.values()];
    },
    update(id, expectedVersion, patch) {
      const found = check(id, expectedVersion);
      if (!found.ok) return found;
      const title = patch.title === undefined ? found.todo.title : patch.title.trim();
      if (titleTaken(title, id)) return { ok: false, reason: 'duplicate' };
      // 每个版本都是一个新的冻结对象：调用方拿到的旧对象不会被悄悄改掉
      const next: Todo = Object.freeze({ ...found.todo, title, done: patch.done ?? found.todo.done, version: found.todo.version + 1 });
      todos.set(id, next);
      return { ok: true, value: next };
    },
    remove(id, expectedVersion) {
      const found = check(id, expectedVersion);
      if (!found.ok) return found;
      todos.delete(id);
      return { ok: true, value: null };
    },
  };
}
```
:::

:::variant{kind=wrong name=remove-ignores-version fails=tests reason="删除不检查版本：一个人删掉了另一个人刚刚修改过的待办"}
```ts file=todo-repo.ts
export type Todo = Readonly<{ id: string; title: string; done: boolean; version: number }>;

export type Patch = Readonly<{ title?: string; done?: boolean }>;

export type Failure = { ok: false; reason: 'not-found' } | { ok: false; reason: 'duplicate' } | { ok: false; reason: 'conflict'; current: Todo };
export type Result<T> = { ok: true; value: T } | Failure;

export type TodoRepo = Readonly<{
  create(title: string): Result<Todo>;
  get(id: string): Todo | null;
  list(): Todo[];
  update(id: string, expectedVersion: number, patch: Patch): Result<Todo>;
  remove(id: string, expectedVersion: number): Result<null>;
}>;

/** 内存中的待办仓库：每次修改都要带上读到的版本号，版本不一致就是冲突 */
export function createTodoRepo(newId: () => string): TodoRepo {
  // Map 保持插入的顺序：list() 按创建的顺序返回
  const todos = new Map<string, Todo>();

  /** 标题像数据库中的 UNIQUE 约束一样不能重复（去掉首尾空白之后比较） */
  const titleTaken = (title: string, exceptId?: string) => [...todos.values()].some((todo) => todo.id !== exceptId && todo.title === title);

  /** 检查 id 和版本：通过时返回当前的待办 */
  function check(id: string, expectedVersion: number): { ok: true; todo: Todo } | Failure {
    const todo = todos.get(id);
    if (todo === undefined) return { ok: false, reason: 'not-found' };
    if (todo.version !== expectedVersion) return { ok: false, reason: 'conflict', current: todo };
    return { ok: true, todo };
  }

  return {
    create(title) {
      const trimmed = title.trim();
      if (titleTaken(trimmed)) return { ok: false, reason: 'duplicate' };
      const todo: Todo = Object.freeze({ id: newId(), title: trimmed, done: false, version: 1 });
      todos.set(todo.id, todo);
      return { ok: true, value: todo };
    },
    get(id) {
      return todos.get(id) ?? null;
    },
    list() {
      return [...todos.values()];
    },
    update(id, expectedVersion, patch) {
      const found = check(id, expectedVersion);
      if (!found.ok) return found;
      const title = patch.title === undefined ? found.todo.title : patch.title.trim();
      if (titleTaken(title, id)) return { ok: false, reason: 'duplicate' };
      // 每个版本都是一个新的冻结对象：调用方拿到的旧对象不会被悄悄改掉
      const next: Todo = Object.freeze({ ...found.todo, title, done: patch.done ?? found.todo.done, version: found.todo.version + 1 });
      todos.set(id, next);
      return { ok: true, value: next };
    },
    remove(id, expectedVersion) {
      if (!todos.has(id)) return { ok: false, reason: 'not-found' };
      todos.delete(id);
      return { ok: true, value: null };
    },
  };
}
```
:::

