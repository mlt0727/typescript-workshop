---
kind: task
title: 待办的状态更新函数
mode: ts
---
在 `todos.ts` 中完成待办应用的状态逻辑。类型已经给出，实现三个函数：

**`update(state, action)`** 根据动作返回新的状态，**不能修改**传入的 `state` 和其中的任何对象：

| 动作 | 效果 |
| --- | --- |
| `{ type: 'add', text }` | 文字去掉首尾空白后，以 `nextId` 为 id 添加一项未完成的待办到末尾，`nextId` 加 1；文字为空时返回**原来的** `state` |
| `{ type: 'toggle', id }` | 切换这一项的 `done`；其他项保持原来的对象 |
| `{ type: 'remove', id }` | 删除这一项 |
| `{ type: 'set-filter', filter }` | 设置筛选条件 |
| `{ type: 'clear-done' }` | 删除所有已完成的项 |

动作不会带来任何变化时（`toggle`、`remove` 的 id 不存在，`clear-done` 时没有已完成的项，`set-filter` 设置的就是当前的筛选条件），返回**原来的** `state` 对象，让调用方可以用 `===` 判断有没有变化。

**`visibleTodos(state)`** 按筛选条件返回要显示的待办：`all` 全部，`active` 未完成的，`done` 已完成的。

**`remainingCount(state)`** 返回未完成的项数。

:::files{role=starter}
```ts file=todos.ts
export type Todo = { readonly id: number; readonly text: string; readonly done: boolean };
export type Filter = 'all' | 'active' | 'done';
export type State = { readonly todos: readonly Todo[]; readonly filter: Filter; readonly nextId: number };
export type Action =
  | { type: 'add'; text: string }
  | { type: 'toggle'; id: number }
  | { type: 'remove'; id: number }
  | { type: 'set-filter'; filter: Filter }
  | { type: 'clear-done' };

export function update(state: State, action: Action): State {
  if (action.type === 'add') {
    return { ...state, todos: [...state.todos, { id: state.nextId, text: action.text, done: false }] };
  }
  return state;
}

export function visibleTodos(state: State): readonly Todo[] {
  return state.todos;
}

export function remainingCount(state: State): number {
  return state.todos.length;
}
```
:::

:::files{role=solution}
```ts file=todos.ts
export type Todo = { readonly id: number; readonly text: string; readonly done: boolean };
export type Filter = 'all' | 'active' | 'done';
export type State = { readonly todos: readonly Todo[]; readonly filter: Filter; readonly nextId: number };
export type Action =
  | { type: 'add'; text: string }
  | { type: 'toggle'; id: number }
  | { type: 'remove'; id: number }
  | { type: 'set-filter'; filter: Filter }
  | { type: 'clear-done' };

export function update(state: State, action: Action): State {
  switch (action.type) {
    case 'add': {
      const text = action.text.trim();
      if (text === '') return state;
      return {
        ...state,
        todos: [...state.todos, { id: state.nextId, text, done: false }],
        nextId: state.nextId + 1,
      };
    }
    case 'toggle': {
      if (!state.todos.some((t) => t.id === action.id)) return state;
      return { ...state, todos: state.todos.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t)) };
    }
    case 'remove': {
      const todos = state.todos.filter((t) => t.id !== action.id);
      return todos.length === state.todos.length ? state : { ...state, todos };
    }
    case 'set-filter':
      return action.filter === state.filter ? state : { ...state, filter: action.filter };
    case 'clear-done': {
      const todos = state.todos.filter((t) => !t.done);
      return todos.length === state.todos.length ? state : { ...state, todos };
    }
    default: {
      const unreachable: never = action;
      return unreachable;
    }
  }
}

export function visibleTodos(state: State): readonly Todo[] {
  switch (state.filter) {
    case 'all':
      return state.todos;
    case 'active':
      return state.todos.filter((t) => !t.done);
    case 'done':
      return state.todos.filter((t) => t.done);
  }
}

export function remainingCount(state: State): number {
  return state.todos.filter((t) => !t.done).length;
}
```
:::

:::files{role=tests}
```ts file=todos.test.ts
import { describe, expect, test } from 'vitest';
import { remainingCount, update, visibleTodos, type State } from './todos';

function freeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const inner of Object.values(value)) freeze(inner);
    Object.freeze(value);
  }
  return value;
}

function sample(): State {
  return freeze<State>({
    todos: [
      { id: 1, text: '买牛奶', done: false },
      { id: 2, text: '写周报', done: true },
      { id: 3, text: '运动', done: false },
    ],
    filter: 'all',
    nextId: 4,
  });
}

describe('update', () => {
  test('add：去掉空白，使用 nextId 并加 1', () => {
    const state = sample();
    const next = update(state, { type: 'add', text: '  读书  ' });
    expect(next.todos.at(-1)).toEqual({ id: 4, text: '读书', done: false });
    expect(next.nextId).toBe(5);
    const after = update(next, { type: 'add', text: '散步' });
    expect(after.todos.at(-1)?.id).toBe(5);
    expect(state.todos).toHaveLength(3);
  });

  test('add：空白文字返回原来的 state', () => {
    const state = sample();
    expect(update(state, { type: 'add', text: '   ' })).toBe(state);
  });

  test('toggle：只替换被切换的那一项', () => {
    const state = sample();
    const next = update(state, { type: 'toggle', id: 1 });
    expect(next.todos[0]).toEqual({ id: 1, text: '买牛奶', done: true });
    expect(next.todos[1]).toBe(state.todos[1]);
    expect(next.todos[2]).toBe(state.todos[2]);
    expect(state.todos[0]?.done).toBe(false);
  });

  test('remove 与 clear-done', () => {
    const state = sample();
    expect(update(state, { type: 'remove', id: 2 }).todos.map((t) => t.id)).toEqual([1, 3]);
    expect(update(state, { type: 'clear-done' }).todos.map((t) => t.id)).toEqual([1, 3]);
  });

  test('set-filter', () => {
    expect(update(sample(), { type: 'set-filter', filter: 'done' }).filter).toBe('done');
  });

  test('没有变化时返回原来的 state 对象', () => {
    const state = sample();
    expect(update(state, { type: 'toggle', id: 99 })).toBe(state);
    expect(update(state, { type: 'remove', id: 99 })).toBe(state);
    expect(update(state, { type: 'set-filter', filter: 'all' })).toBe(state);
    const noneDone = update(state, { type: 'clear-done' });
    expect(update(noneDone, { type: 'clear-done' })).toBe(noneDone);
  });
});

describe('派生数据', () => {
  test('visibleTodos', () => {
    const state = sample();
    expect(visibleTodos(state).map((t) => t.id)).toEqual([1, 2, 3]);
    expect(visibleTodos({ ...state, filter: 'active' }).map((t) => t.id)).toEqual([1, 3]);
    expect(visibleTodos({ ...state, filter: 'done' }).map((t) => t.id)).toEqual([2]);
  });

  test('remainingCount', () => {
    expect(remainingCount(sample())).toBe(2);
    expect(remainingCount(update(sample(), { type: 'toggle', id: 1 }))).toBe(1);
  });
});
```
:::

:::hint{level=1}
用 `switch (action.type)` 处理每一种动作，每个分支返回新的状态：`{ ...state, 要改的字段: 新值 }`。新数组用展开、`map`、`filter` 生成，不要用 `push`、`splice` 或者直接给属性赋值（`readonly` 也不允许）。
:::

:::hint{level=2}
“没有变化时返回原来的 state”：`toggle` 先用 `some` 检查 id 是否存在；`remove` 和 `clear-done` 可以比较过滤前后的长度。`switch` 最后加一个 `default` 分支，把 `action` 赋给 `never` 类型的变量做穷尽检查（b09）：以后新增动作而忘了处理时，这里会报错。
:::

:::explanation
`update` 是一个**纯函数**：只根据参数计算返回值，不修改参数，也不碰 DOM。这让它非常容易测试，也让“撤销”这样的功能变得简单——旧的状态从来没有被修改过，保存下来就能恢复。

测试用 `Object.freeze` 冻结了整个初始状态：任何修改都会在运行时抛出错误。`toggle` 的测试还检查了没有被切换的项**仍然是原来的对象**（`toBe`）：不可变更新只复制变化的部分，其余部分共享。

“没有变化时返回同一个对象”是一个很有用的约定：调用方用 `next === state` 就能知道要不要重新渲染、要不要记录到撤销历史中。React 也是用 `Object.is` 比较新旧状态，决定是否跳过更新。
:::

:::variant{kind=alt name=handlers-object}
```ts file=todos.ts
export type Todo = { readonly id: number; readonly text: string; readonly done: boolean };
export type Filter = 'all' | 'active' | 'done';
export type State = { readonly todos: readonly Todo[]; readonly filter: Filter; readonly nextId: number };
export type Action =
  | { type: 'add'; text: string }
  | { type: 'toggle'; id: number }
  | { type: 'remove'; id: number }
  | { type: 'set-filter'; filter: Filter }
  | { type: 'clear-done' };

function withTodos(state: State, todos: readonly Todo[]): State {
  const changed = todos.length !== state.todos.length || todos.some((t, i) => t !== state.todos[i]);
  return changed ? { ...state, todos } : state;
}

export function update(state: State, action: Action): State {
  switch (action.type) {
    case 'add': {
      const text = action.text.trim();
      return text ? { ...withTodos(state, [...state.todos, { id: state.nextId, text, done: false }]), nextId: state.nextId + 1 } : state;
    }
    case 'toggle':
      return withTodos(state, state.todos.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t)));
    case 'remove':
      return withTodos(state, state.todos.filter((t) => t.id !== action.id));
    case 'set-filter':
      return state.filter === action.filter ? state : { ...state, filter: action.filter };
    case 'clear-done':
      return withTodos(state, state.todos.filter((t) => !t.done));
  }
}

const predicates: Record<Filter, (t: Todo) => boolean> = {
  all: () => true,
  active: (t) => !t.done,
  done: (t) => t.done,
};

export function visibleTodos(state: State): readonly Todo[] {
  return state.todos.filter(predicates[state.filter]);
}

export function remainingCount(state: State): number {
  return state.todos.filter(predicates.active).length;
}
```
:::

:::variant{kind=wrong name=mutate-todo fails=tests reason="用 Object.assign 修改了原来的待办对象"}
```ts file=todos.ts
export type Todo = { readonly id: number; readonly text: string; readonly done: boolean };
export type Filter = 'all' | 'active' | 'done';
export type State = { readonly todos: readonly Todo[]; readonly filter: Filter; readonly nextId: number };
export type Action =
  | { type: 'add'; text: string }
  | { type: 'toggle'; id: number }
  | { type: 'remove'; id: number }
  | { type: 'set-filter'; filter: Filter }
  | { type: 'clear-done' };

export function update(state: State, action: Action): State {
  switch (action.type) {
    case 'add': {
      const text = action.text.trim();
      if (text === '') return state;
      return { ...state, todos: [...state.todos, { id: state.nextId, text, done: false }], nextId: state.nextId + 1 };
    }
    case 'toggle': {
      if (!state.todos.some((t) => t.id === action.id)) return state;
      return { ...state, todos: state.todos.map((t) => (t.id === action.id ? Object.assign(t, { done: !t.done }) : t)) };
    }
    case 'remove': {
      const todos = state.todos.filter((t) => t.id !== action.id);
      return todos.length === state.todos.length ? state : { ...state, todos };
    }
    case 'set-filter':
      return action.filter === state.filter ? state : { ...state, filter: action.filter };
    case 'clear-done': {
      const todos = state.todos.filter((t) => !t.done);
      return todos.length === state.todos.length ? state : { ...state, todos };
    }
  }
}

export function visibleTodos(state: State): readonly Todo[] {
  return state.filter === 'all' ? state.todos : state.todos.filter((t) => t.done === (state.filter === 'done'));
}

export function remainingCount(state: State): number {
  return state.todos.filter((t) => !t.done).length;
}
```
:::

:::variant{kind=wrong name=same-next-id fails=tests reason="添加后没有增加 nextId，后面添加的项 id 重复"}
```ts file=todos.ts
export type Todo = { readonly id: number; readonly text: string; readonly done: boolean };
export type Filter = 'all' | 'active' | 'done';
export type State = { readonly todos: readonly Todo[]; readonly filter: Filter; readonly nextId: number };
export type Action =
  | { type: 'add'; text: string }
  | { type: 'toggle'; id: number }
  | { type: 'remove'; id: number }
  | { type: 'set-filter'; filter: Filter }
  | { type: 'clear-done' };

export function update(state: State, action: Action): State {
  switch (action.type) {
    case 'add': {
      const text = action.text.trim();
      if (text === '') return state;
      return { ...state, todos: [...state.todos, { id: state.nextId, text, done: false }] };
    }
    case 'toggle': {
      if (!state.todos.some((t) => t.id === action.id)) return state;
      return { ...state, todos: state.todos.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t)) };
    }
    case 'remove': {
      const todos = state.todos.filter((t) => t.id !== action.id);
      return todos.length === state.todos.length ? state : { ...state, todos };
    }
    case 'set-filter':
      return action.filter === state.filter ? state : { ...state, filter: action.filter };
    case 'clear-done': {
      const todos = state.todos.filter((t) => !t.done);
      return todos.length === state.todos.length ? state : { ...state, todos };
    }
  }
}

export function visibleTodos(state: State): readonly Todo[] {
  return state.filter === 'all' ? state.todos : state.todos.filter((t) => t.done === (state.filter === 'done'));
}

export function remainingCount(state: State): number {
  return state.todos.filter((t) => !t.done).length;
}
```
:::

:::variant{kind=wrong name=always-new-state fails=tests reason="没有变化时也返回了新的 state 对象"}
```ts file=todos.ts
export type Todo = { readonly id: number; readonly text: string; readonly done: boolean };
export type Filter = 'all' | 'active' | 'done';
export type State = { readonly todos: readonly Todo[]; readonly filter: Filter; readonly nextId: number };
export type Action =
  | { type: 'add'; text: string }
  | { type: 'toggle'; id: number }
  | { type: 'remove'; id: number }
  | { type: 'set-filter'; filter: Filter }
  | { type: 'clear-done' };

export function update(state: State, action: Action): State {
  switch (action.type) {
    case 'add': {
      const text = action.text.trim();
      if (text === '') return state;
      return { ...state, todos: [...state.todos, { id: state.nextId, text, done: false }], nextId: state.nextId + 1 };
    }
    case 'toggle':
      return { ...state, todos: state.todos.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t)) };
    case 'remove':
      return { ...state, todos: state.todos.filter((t) => t.id !== action.id) };
    case 'set-filter':
      return { ...state, filter: action.filter };
    case 'clear-done':
      return { ...state, todos: state.todos.filter((t) => !t.done) };
  }
}

export function visibleTodos(state: State): readonly Todo[] {
  return state.filter === 'all' ? state.todos : state.todos.filter((t) => t.done === (state.filter === 'done'));
}

export function remainingCount(state: State): number {
  return state.todos.filter((t) => !t.done).length;
}
```
:::

:::variant{kind=wrong name=no-trim fails=tests reason="添加时没有去掉首尾空白，只有空格的文字也被添加了"}
```ts file=todos.ts
export type Todo = { readonly id: number; readonly text: string; readonly done: boolean };
export type Filter = 'all' | 'active' | 'done';
export type State = { readonly todos: readonly Todo[]; readonly filter: Filter; readonly nextId: number };
export type Action =
  | { type: 'add'; text: string }
  | { type: 'toggle'; id: number }
  | { type: 'remove'; id: number }
  | { type: 'set-filter'; filter: Filter }
  | { type: 'clear-done' };

export function update(state: State, action: Action): State {
  switch (action.type) {
    case 'add':
      if (action.text === '') return state;
      return { ...state, todos: [...state.todos, { id: state.nextId, text: action.text, done: false }], nextId: state.nextId + 1 };
    case 'toggle': {
      if (!state.todos.some((t) => t.id === action.id)) return state;
      return { ...state, todos: state.todos.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t)) };
    }
    case 'remove': {
      const todos = state.todos.filter((t) => t.id !== action.id);
      return todos.length === state.todos.length ? state : { ...state, todos };
    }
    case 'set-filter':
      return action.filter === state.filter ? state : { ...state, filter: action.filter };
    case 'clear-done': {
      const todos = state.todos.filter((t) => !t.done);
      return todos.length === state.todos.length ? state : { ...state, todos };
    }
  }
}

export function visibleTodos(state: State): readonly Todo[] {
  return state.filter === 'all' ? state.todos : state.todos.filter((t) => t.done === (state.filter === 'done'));
}

export function remainingCount(state: State): number {
  return state.todos.filter((t) => !t.done).length;
}
```
:::
