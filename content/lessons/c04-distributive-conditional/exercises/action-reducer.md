---
kind: challenge
title: 由动作表生成的待办 reducer
---
`todos.ts` 中已经有待办清单的状态和一张“动作表” `ActionMap`：键是动作的名字，值是这种动作携带的数据（`clearDone` 不带数据，是 `undefined`）。完成：

1. **`Action<K>`**：由 `ActionMap` 生成的可辨识联合，每个成员是 `{ type: 名字; payload: 数据 }`。`K` 默认是所有的动作名，`Action<'add'>` 只包含 `add` 这一种；
2. **`Reducers`**：映射类型，为每种动作规定一个 `(state: State, payload: 这种动作的数据) => State` 的函数；并导出实现了它的 **`reducers`**：
   - `add`：在末尾添加 `{ id: 't' + nextId, title, done: false }`，`nextId` 加 1；
   - `toggle`：切换这一项的 `done`；
   - `rename`：把这一项的标题改成 `title`；
   - `clearDone`：删除所有已完成的项；
   - 没有任何变化时（找不到 `id`、没有已完成的项）返回**原来的** `state`；不能修改传入的对象；
3. **`reduce(state, action)`**：用 `reducers` 中对应的函数处理一个动作。不能使用类型断言；
4. **`actionsOfType(log, type)`**：从动作记录中挑出某一种动作，返回值的类型精确到这一种（例如 `type` 是 `'rename'` 时，元素的类型就是 `rename` 动作）；
5. **`PayloadType`**：所有**携带数据**的动作名组成的联合（`clearDone` 不在其中）。要从 `ActionMap` 推导，不能手写。

:::files{role=starter}
```ts file=todos.ts
export type Todo = { id: string; title: string; done: boolean };
export type State = { todos: readonly Todo[]; nextId: number };

export type ActionMap = {
  add: { title: string };
  toggle: { id: string };
  rename: { id: string; title: string };
  clearDone: undefined;
};

export type Action<K extends keyof ActionMap = keyof ActionMap> = { type: K; payload: unknown };
export type Reducers = Record<keyof ActionMap, (state: State, payload: unknown) => State>;

export const reducers: Reducers = {
  add: (state) => state,
  toggle: (state) => state,
  rename: (state) => state,
  clearDone: (state) => state,
};

export function reduce(state: State, action: Action): State {
  return state;
}

export function actionsOfType(log: readonly Action[], type: keyof ActionMap): Action[] {
  return [];
}

export type PayloadType = keyof ActionMap;
```
```ts file=main.ts
import { reduce, type Action, type State } from './todos';

const log: Action[] = [
  { type: 'add', payload: { title: '写周报' } },
  { type: 'add', payload: { title: '修自行车' } },
  { type: 'toggle', payload: { id: 't1' } },
  { type: 'clearDone', payload: undefined },
];
const initial: State = { todos: [], nextId: 1 };
console.log(log.reduce(reduce, initial));
```
:::

:::files{role=solution}
```ts file=todos.ts
export type Todo = { id: string; title: string; done: boolean };
export type State = { todos: readonly Todo[]; nextId: number };

export type ActionMap = {
  add: { title: string };
  toggle: { id: string };
  rename: { id: string; title: string };
  clearDone: undefined;
};

export type Action<K extends keyof ActionMap = keyof ActionMap> = {
  [P in K]: { type: P; payload: ActionMap[P] };
}[K];

export type Reducers = { [K in keyof ActionMap]: (state: State, payload: ActionMap[K]) => State };

/** 用 change 修改 id 对应的待办；找不到或没有变化时返回原来的 state */
function update(state: State, id: string, change: (todo: Todo) => Todo): State {
  const index = state.todos.findIndex((todo) => todo.id === id);
  const todo = state.todos[index];
  if (todo === undefined) return state;
  const next = change(todo);
  return next === todo ? state : { ...state, todos: state.todos.with(index, next) };
}

export const reducers: Reducers = {
  add: (state, { title }) => ({
    todos: [...state.todos, { id: `t${state.nextId}`, title, done: false }],
    nextId: state.nextId + 1,
  }),
  toggle: (state, { id }) => update(state, id, (todo) => ({ ...todo, done: !todo.done })),
  rename: (state, { id, title }) => update(state, id, (todo) => (todo.title === title ? todo : { ...todo, title })),
  clearDone: (state) => {
    const todos = state.todos.filter((todo) => !todo.done);
    return todos.length === state.todos.length ? state : { ...state, todos };
  },
};

export function reduce<K extends keyof ActionMap>(state: State, action: Action<K>): State {
  return reducers[action.type](state, action.payload);
}

export function actionsOfType<K extends keyof ActionMap>(log: readonly Action[], type: K): Extract<Action, { type: K }>[] {
  return log.filter((action): action is Extract<Action, { type: K }> => action.type === type);
}

export type PayloadType = { [K in keyof ActionMap]: ActionMap[K] extends undefined ? never : K }[keyof ActionMap];
```
```ts file=main.ts
import { reduce, type Action, type State } from './todos';

const log: Action[] = [
  { type: 'add', payload: { title: '写周报' } },
  { type: 'add', payload: { title: '修自行车' } },
  { type: 'toggle', payload: { id: 't1' } },
  { type: 'clearDone', payload: undefined },
];
const initial: State = { todos: [], nextId: 1 };
console.log(log.reduce(reduce, initial));
```
:::

:::files{role=tests}
```ts file=todos.test.ts
import { describe, expect, test } from 'vitest';
import { actionsOfType, reduce, type Action, type State } from './todos';

const empty: State = { todos: [], nextId: 1 };
const sample: State = {
  todos: [
    { id: 't1', title: '写周报', done: false },
    { id: 't2', title: '修自行车', done: true },
  ],
  nextId: 3,
};

describe('reduce', () => {
  test('add：添加到末尾，id 来自 nextId', () => {
    const next = reduce(empty, { type: 'add', payload: { title: '写周报' } });
    expect(next).toEqual({ todos: [{ id: 't1', title: '写周报', done: false }], nextId: 2 });
    expect(empty.todos).toEqual([]);
  });

  test('toggle：切换 done，其他项保持原来的对象', () => {
    const next = reduce(sample, { type: 'toggle', payload: { id: 't1' } });
    expect(next.todos[0]).toEqual({ id: 't1', title: '写周报', done: true });
    expect(next.todos[1]).toBe(sample.todos[1]);
    expect(sample.todos[0]?.done).toBe(false);
  });

  test('rename：改标题', () => {
    const next = reduce(sample, { type: 'rename', payload: { id: 't2', title: '修好自行车' } });
    expect(next.todos.map((t) => t.title)).toEqual(['写周报', '修好自行车']);
  });

  test('clearDone：删除已完成的项', () => {
    const next = reduce(sample, { type: 'clearDone', payload: undefined });
    expect(next.todos.map((t) => t.id)).toEqual(['t1']);
    expect(next.nextId).toBe(3);
  });

  test('没有变化时返回原来的 state', () => {
    expect(reduce(sample, { type: 'toggle', payload: { id: 't9' } })).toBe(sample);
    expect(reduce(sample, { type: 'rename', payload: { id: 't9', title: 'x' } })).toBe(sample);
    expect(reduce(sample, { type: 'rename', payload: { id: 't1', title: '写周报' } })).toBe(sample);
    expect(reduce(empty, { type: 'clearDone', payload: undefined })).toBe(empty);
  });

  test('可以直接交给数组的 reduce', () => {
    const log: Action[] = [
      { type: 'add', payload: { title: 'a' } },
      { type: 'add', payload: { title: 'b' } },
      { type: 'toggle', payload: { id: 't1' } },
      { type: 'clearDone', payload: undefined },
    ];
    expect(log.reduce(reduce, empty)).toEqual({ todos: [{ id: 't2', title: 'b', done: false }], nextId: 3 });
  });
});

describe('actionsOfType', () => {
  test('按顺序挑出某一种动作', () => {
    const log: Action[] = [
      { type: 'add', payload: { title: 'a' } },
      { type: 'rename', payload: { id: 't1', title: 'b' } },
      { type: 'add', payload: { title: 'c' } },
    ];
    expect(actionsOfType(log, 'add').map((a) => a.payload.title)).toEqual(['a', 'c']);
    expect(actionsOfType(log, 'toggle')).toEqual([]);
  });
});
```
```ts file=todos.test-d.ts
import { expectTypeOf } from 'vitest';
import { actionsOfType, reduce, type Action, type PayloadType, type State } from './todos';

expectTypeOf<Action>().toEqualTypeOf<
  | { type: 'add'; payload: { title: string } }
  | { type: 'toggle'; payload: { id: string } }
  | { type: 'rename'; payload: { id: string; title: string } }
  | { type: 'clearDone'; payload: undefined }
>();
expectTypeOf<Action<'toggle'>>().toEqualTypeOf<{ type: 'toggle'; payload: { id: string } }>();
expectTypeOf<PayloadType>().toEqualTypeOf<'add' | 'toggle' | 'rename'>();

declare const log: Action[];
expectTypeOf(actionsOfType(log, 'rename')).toEqualTypeOf<{ type: 'rename'; payload: { id: string; title: string } }[]>();

declare const state: State;
reduce(state, { type: 'clearDone', payload: undefined });
// @ts-expect-error add 的数据中要有 title
reduce(state, { type: 'add', payload: { id: 't1' } });
// @ts-expect-error 不存在的动作
reduce(state, { type: 'remove', payload: { id: 't1' } });
```
:::

:::hint{level=1}
`Action<K>` 照着正文的写法：先映射出 `{ [P in K]: { type: P; payload: ActionMap[P] } }`，再用 `[K]` 取出所有的值。`Reducers` 是 `{ [K in keyof ActionMap]: (state: State, payload: ActionMap[K]) => State }`。`reduce` 要带上类型参数 `K extends keyof ActionMap`，参数写成 `Action<K>`，函数体只有一行 `reducers[action.type](state, action.payload)`。
:::

:::hint{level=2}
`actionsOfType` 的返回类型写成 `Extract<Action, { type: K }>[]`，用类型守卫过滤：`log.filter((action): action is Extract<Action, { type: K }> => action.type === type)`。`PayloadType`：映射出 `{ [K in keyof ActionMap]: ActionMap[K] extends undefined ? never : K }`，再用 `[keyof ActionMap]` 取出所有的值，`never` 会消失。
:::

:::explanation
这道题的结构是“先有表，再有联合”：`ActionMap` 是唯一的来源，`Action`、`Reducers`、`PayloadType` 都从它推导。加一种动作，只需要在表里加一行；`reducers` 少写这种动作的处理函数，马上报错。

`reduce` 的函数体只有一行，却不需要任何断言，原因是正文讲的“相关联合”：`action` 的类型是 `Action<K>`，于是 `reducers[action.type]` 是 `Reducers[K]`，`action.payload` 是 `ActionMap[K]`，两者由同一个 `K` 连在一起。如果把参数写成不带类型参数的 `Action`，TypeScript 就只看到两个互不相关的联合，报 TS2345。另一种完全正确的写法是 `switch (action.type)`：每个分支中 `action` 被收窄成一种动作（b09），只是要把每种动作都写一个分支。

`actionsOfType` 的类型守卫用 `Extract<Action, { type: K }>`：分布式的 `Extract` 从联合中挑出 `type` 能赋值给 `K` 的成员。`K` 是 `'rename'` 时得到 `rename` 动作；`K` 是 `'add' | 'toggle'` 时，两种动作都会被挑出来。

`PayloadType` 用了一个常见的技巧：映射出“键 → 键或 never”的对象，再用 `[keyof ActionMap]` 取出所有的值，`never` 在联合中消失，剩下的就是满足条件的键。

“没有变化时返回原来的 state”让调用方可以用 `===` 判断要不要重新渲染（p1-01 的任务板也是这样）。
:::

:::variant{kind=alt name=switch}
```ts file=todos.ts
export type Todo = { id: string; title: string; done: boolean };
export type State = { todos: readonly Todo[]; nextId: number };

export type ActionMap = {
  add: { title: string };
  toggle: { id: string };
  rename: { id: string; title: string };
  clearDone: undefined;
};

type ActionTable<M> = { [P in keyof M]: { type: P; payload: M[P] } };
export type Action<K extends keyof ActionMap = keyof ActionMap> = ActionTable<ActionMap>[K];

export type Reducers = { [K in keyof ActionMap]: (state: State, payload: ActionMap[K]) => State };

export const reducers: Reducers = {
  add(state, payload) {
    const todo: Todo = { id: 't' + state.nextId, title: payload.title, done: false };
    return { todos: state.todos.concat(todo), nextId: state.nextId + 1 };
  },
  toggle(state, payload) {
    if (!state.todos.some((t) => t.id === payload.id)) return state;
    return { ...state, todos: state.todos.map((t) => (t.id === payload.id ? { ...t, done: !t.done } : t)) };
  },
  rename(state, payload) {
    const target = state.todos.find((t) => t.id === payload.id);
    if (target === undefined || target.title === payload.title) return state;
    return { ...state, todos: state.todos.map((t) => (t === target ? { ...t, title: payload.title } : t)) };
  },
  clearDone(state) {
    if (!state.todos.some((t) => t.done)) return state;
    return { ...state, todos: state.todos.filter((t) => !t.done) };
  },
};

export function reduce(state: State, action: Action): State {
  switch (action.type) {
    case 'add':
      return reducers.add(state, action.payload);
    case 'toggle':
      return reducers.toggle(state, action.payload);
    case 'rename':
      return reducers.rename(state, action.payload);
    case 'clearDone':
      return reducers.clearDone(state, action.payload);
  }
}

export function actionsOfType<K extends keyof ActionMap>(log: readonly Action[], type: K): Extract<Action, { type: K }>[] {
  const result: Extract<Action, { type: K }>[] = [];
  for (const action of log) {
    if (isType(action, type)) result.push(action);
  }
  return result;
}

function isType<K extends keyof ActionMap>(action: Action, type: K): action is Extract<Action, { type: K }> {
  return action.type === type;
}

export type PayloadType = Exclude<keyof ActionMap, { [K in keyof ActionMap]: ActionMap[K] extends undefined ? K : never }[keyof ActionMap]>;
```
:::

:::variant{kind=wrong name=not-discriminated fails=types reason="type 和 payload 各自是联合，不是按动作配对的可辨识联合"}
```ts file=todos.ts
export type Todo = { id: string; title: string; done: boolean };
export type State = { todos: readonly Todo[]; nextId: number };

export type ActionMap = {
  add: { title: string };
  toggle: { id: string };
  rename: { id: string; title: string };
  clearDone: undefined;
};

export type Action<K extends keyof ActionMap = keyof ActionMap> = { type: K; payload: ActionMap[K] };

export type Reducers = { [K in keyof ActionMap]: (state: State, payload: ActionMap[K]) => State };

function update(state: State, id: string, change: (todo: Todo) => Todo): State {
  const index = state.todos.findIndex((todo) => todo.id === id);
  const todo = state.todos[index];
  if (todo === undefined) return state;
  const next = change(todo);
  return next === todo ? state : { ...state, todos: state.todos.with(index, next) };
}

export const reducers: Reducers = {
  add: (state, { title }) => ({
    todos: [...state.todos, { id: `t${state.nextId}`, title, done: false }],
    nextId: state.nextId + 1,
  }),
  toggle: (state, { id }) => update(state, id, (todo) => ({ ...todo, done: !todo.done })),
  rename: (state, { id, title }) => update(state, id, (todo) => (todo.title === title ? todo : { ...todo, title })),
  clearDone: (state) => {
    const todos = state.todos.filter((todo) => !todo.done);
    return todos.length === state.todos.length ? state : { ...state, todos };
  },
};

export function reduce<K extends keyof ActionMap>(state: State, action: Action<K>): State {
  return reducers[action.type](state, action.payload);
}

export function actionsOfType<K extends keyof ActionMap>(log: readonly Action[], type: K): Action<K>[] {
  const result: Action<K>[] = [];
  for (const action of log) {
    if (action.type === type) result.push({ type, payload: action.payload });
  }
  return result;
}

export type PayloadType = { [K in keyof ActionMap]: ActionMap[K] extends undefined ? never : K }[keyof ActionMap];
```
:::

:::variant{kind=wrong name=assert-handler fails=rules reason="用 as 把处理函数转成接收 unknown 的函数，掩盖了类型不匹配"}
```ts file=todos.ts
export type Todo = { id: string; title: string; done: boolean };
export type State = { todos: readonly Todo[]; nextId: number };

export type ActionMap = {
  add: { title: string };
  toggle: { id: string };
  rename: { id: string; title: string };
  clearDone: undefined;
};

export type Action<K extends keyof ActionMap = keyof ActionMap> = {
  [P in K]: { type: P; payload: ActionMap[P] };
}[K];

export type Reducers = { [K in keyof ActionMap]: (state: State, payload: ActionMap[K]) => State };

function update(state: State, id: string, change: (todo: Todo) => Todo): State {
  const index = state.todos.findIndex((todo) => todo.id === id);
  const todo = state.todos[index];
  if (todo === undefined) return state;
  const next = change(todo);
  return next === todo ? state : { ...state, todos: state.todos.with(index, next) };
}

export const reducers: Reducers = {
  add: (state, { title }) => ({
    todos: [...state.todos, { id: `t${state.nextId}`, title, done: false }],
    nextId: state.nextId + 1,
  }),
  toggle: (state, { id }) => update(state, id, (todo) => ({ ...todo, done: !todo.done })),
  rename: (state, { id, title }) => update(state, id, (todo) => (todo.title === title ? todo : { ...todo, title })),
  clearDone: (state) => {
    const todos = state.todos.filter((todo) => !todo.done);
    return todos.length === state.todos.length ? state : { ...state, todos };
  },
};

export function reduce(state: State, action: Action): State {
  const handler = reducers[action.type] as (state: State, payload: unknown) => State;
  return handler(state, action.payload);
}

export function actionsOfType<K extends keyof ActionMap>(log: readonly Action[], type: K): Extract<Action, { type: K }>[] {
  return log.filter((action): action is Extract<Action, { type: K }> => action.type === type);
}

export type PayloadType = { [K in keyof ActionMap]: ActionMap[K] extends undefined ? never : K }[keyof ActionMap];
```
:::

:::variant{kind=wrong name=always-new-state fails=tests reason="找不到 id、没有已完成的项时也返回了新的 state"}
```ts file=todos.ts
export type Todo = { id: string; title: string; done: boolean };
export type State = { todos: readonly Todo[]; nextId: number };

export type ActionMap = {
  add: { title: string };
  toggle: { id: string };
  rename: { id: string; title: string };
  clearDone: undefined;
};

export type Action<K extends keyof ActionMap = keyof ActionMap> = {
  [P in K]: { type: P; payload: ActionMap[P] };
}[K];

export type Reducers = { [K in keyof ActionMap]: (state: State, payload: ActionMap[K]) => State };

export const reducers: Reducers = {
  add: (state, { title }) => ({
    todos: [...state.todos, { id: `t${state.nextId}`, title, done: false }],
    nextId: state.nextId + 1,
  }),
  toggle: (state, { id }) => ({ ...state, todos: state.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }),
  rename: (state, { id, title }) => ({ ...state, todos: state.todos.map((t) => (t.id === id ? { ...t, title } : t)) }),
  clearDone: (state) => ({ ...state, todos: state.todos.filter((todo) => !todo.done) }),
};

export function reduce<K extends keyof ActionMap>(state: State, action: Action<K>): State {
  return reducers[action.type](state, action.payload);
}

export function actionsOfType<K extends keyof ActionMap>(log: readonly Action[], type: K): Extract<Action, { type: K }>[] {
  return log.filter((action): action is Extract<Action, { type: K }> => action.type === type);
}

export type PayloadType = { [K in keyof ActionMap]: ActionMap[K] extends undefined ? never : K }[keyof ActionMap];
```
:::

:::variant{kind=wrong name=payload-type-all fails=types reason="PayloadType 把不带数据的 clearDone 也算了进去"}
```ts file=todos.ts
export type Todo = { id: string; title: string; done: boolean };
export type State = { todos: readonly Todo[]; nextId: number };

export type ActionMap = {
  add: { title: string };
  toggle: { id: string };
  rename: { id: string; title: string };
  clearDone: undefined;
};

export type Action<K extends keyof ActionMap = keyof ActionMap> = {
  [P in K]: { type: P; payload: ActionMap[P] };
}[K];

export type Reducers = { [K in keyof ActionMap]: (state: State, payload: ActionMap[K]) => State };

function update(state: State, id: string, change: (todo: Todo) => Todo): State {
  const index = state.todos.findIndex((todo) => todo.id === id);
  const todo = state.todos[index];
  if (todo === undefined) return state;
  const next = change(todo);
  return next === todo ? state : { ...state, todos: state.todos.with(index, next) };
}

export const reducers: Reducers = {
  add: (state, { title }) => ({
    todos: [...state.todos, { id: `t${state.nextId}`, title, done: false }],
    nextId: state.nextId + 1,
  }),
  toggle: (state, { id }) => update(state, id, (todo) => ({ ...todo, done: !todo.done })),
  rename: (state, { id, title }) => update(state, id, (todo) => (todo.title === title ? todo : { ...todo, title })),
  clearDone: (state) => {
    const todos = state.todos.filter((todo) => !todo.done);
    return todos.length === state.todos.length ? state : { ...state, todos };
  },
};

export function reduce<K extends keyof ActionMap>(state: State, action: Action<K>): State {
  return reducers[action.type](state, action.payload);
}

export function actionsOfType<K extends keyof ActionMap>(log: readonly Action[], type: K): Extract<Action, { type: K }>[] {
  return log.filter((action): action is Extract<Action, { type: K }> => action.type === type);
}

export type PayloadType = { [K in keyof ActionMap]: ActionMap[K] extends unknown ? K : never }[keyof ActionMap];
```
:::
