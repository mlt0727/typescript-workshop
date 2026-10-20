---
kind: task
title: 不修改原数组的待办操作
mode: ts
---
在 `todos.ts` 中实现五个函数。它们都**不能修改**传入的数组和对象，而是返回新的数组：

| 函数 | 作用 |
| --- | --- |
| `addTodo(list, id, title)` | 在末尾添加 `{ id, title, done: false }`，标题去掉首尾空白 |
| `toggleTodo(list, id)` | 切换这一项的 `done` |
| `renameTodo(list, id, title)` | 修改这一项的标题（去掉首尾空白） |
| `removeTodo(list, id)` | 删除这一项 |
| `moveUp(list, id)` | 和前一项交换位置 |

另外两条规则：

1. 结果中**没有变化**的项，必须是原来的对象本身（不要复制它们）；
2. 操作**没有带来任何变化**时（找不到这个 id、标题去掉空白后为空、已经在第一位），直接返回传入的数组本身。这样 React 用 `Object.is` 比较时会发现 state 没有变，从而跳过渲染。

测试会把传入的数组和对象冻结（`Object.freeze`），修改它们会抛出错误。

:::files{role=starter}
```ts file=todos.ts
export type Todo = Readonly<{ id: number; title: string; done: boolean }>;
export type TodoList = readonly Todo[];

export function addTodo(list: TodoList, id: number, title: string): TodoList {
  return list;
}

export function toggleTodo(list: TodoList, id: number): TodoList {
  return list;
}

export function renameTodo(list: TodoList, id: number, title: string): TodoList {
  return list;
}

export function removeTodo(list: TodoList, id: number): TodoList {
  return list;
}

export function moveUp(list: TodoList, id: number): TodoList {
  return list;
}
```
:::

:::files{role=solution}
```ts file=todos.ts
export type Todo = Readonly<{ id: number; title: string; done: boolean }>;
export type TodoList = readonly Todo[];

function has(list: TodoList, id: number): boolean {
  return list.some((t) => t.id === id);
}

export function addTodo(list: TodoList, id: number, title: string): TodoList {
  const text = title.trim();
  if (text === '') return list;
  return [...list, { id, title: text, done: false }];
}

export function toggleTodo(list: TodoList, id: number): TodoList {
  if (!has(list, id)) return list;
  return list.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
}

export function renameTodo(list: TodoList, id: number, title: string): TodoList {
  const text = title.trim();
  if (text === '' || !has(list, id)) return list;
  return list.map((t) => (t.id === id ? { ...t, title: text } : t));
}

export function removeTodo(list: TodoList, id: number): TodoList {
  if (!has(list, id)) return list;
  return list.filter((t) => t.id !== id);
}

export function moveUp(list: TodoList, id: number): TodoList {
  const index = list.findIndex((t) => t.id === id);
  const previous = list[index - 1];
  const current = list[index];
  if (index <= 0 || previous === undefined || current === undefined) return list;
  return list.with(index - 1, current).with(index, previous);
}
```
:::

:::files{role=tests}
```ts file=todos.test.ts
import { describe, expect, test } from 'vitest';
import { addTodo, moveUp, removeTodo, renameTodo, toggleTodo, type Todo, type TodoList } from './todos';

function frozen(items: Todo[]): TodoList {
  for (const item of items) Object.freeze(item);
  return Object.freeze(items);
}

function sample(): TodoList {
  return frozen([
    { id: 1, title: '读完 g04', done: false },
    { id: 2, title: '写练习', done: true },
    { id: 3, title: '复习 g03', done: false },
  ]);
}

describe('addTodo', () => {
  test('在末尾添加，原来的项保持原样', () => {
    const list = sample();
    const next = addTodo(list, 4, '  提交作业 ');
    expect(next).toEqual([...list, { id: 4, title: '提交作业', done: false }]);
    expect(next).not.toBe(list);
    expect(next[0]).toBe(list[0]);
    expect(list).toHaveLength(3);
  });

  test('标题为空时返回原数组', () => {
    const list = sample();
    expect(addTodo(list, 4, '   ')).toBe(list);
  });
});

describe('toggleTodo 与 renameTodo', () => {
  test('只替换被修改的那一项', () => {
    const list = sample();
    const next = toggleTodo(list, 2);
    expect(next[1]).toEqual({ id: 2, title: '写练习', done: false });
    expect(next[1]).not.toBe(list[1]);
    expect(next[0]).toBe(list[0]);
    expect(next[2]).toBe(list[2]);
    expect(list[1]?.done).toBe(true);

    const renamed = renameTodo(next, 3, ' 复习 g02 ');
    expect(renamed.map((t) => t.title)).toEqual(['读完 g04', '写练习', '复习 g02']);
    expect(renamed[0]).toBe(list[0]);
  });

  test('找不到 id 或标题为空时返回原数组', () => {
    const list = sample();
    expect(toggleTodo(list, 99)).toBe(list);
    expect(renameTodo(list, 99, '新标题')).toBe(list);
    expect(renameTodo(list, 1, '  ')).toBe(list);
  });
});

describe('removeTodo', () => {
  test('删除一项', () => {
    const list = sample();
    const next = removeTodo(list, 2);
    expect(next.map((t) => t.id)).toEqual([1, 3]);
    expect(next[1]).toBe(list[2]);
    expect(removeTodo(list, 99)).toBe(list);
  });
});

describe('moveUp', () => {
  test('和前一项交换位置', () => {
    const list = sample();
    const next = moveUp(list, 3);
    expect(next.map((t) => t.id)).toEqual([1, 3, 2]);
    expect(next[1]).toBe(list[2]);
    expect(next[2]).toBe(list[1]);
  });

  test('已经在第一位或者找不到时返回原数组', () => {
    const list = sample();
    expect(moveUp(list, 1)).toBe(list);
    expect(moveUp(list, 99)).toBe(list);
    expect(moveUp(frozen([]), 1)).toHaveLength(0);
  });
});
```
:::

:::hint{level=1}
添加用展开：`[...list, 新项]`；修改用 `map`，被改的那一项返回 `{ ...t, 改动 }`，其他项原样返回 `t`；删除用 `filter`。“没有变化就返回原数组”：先检查（例如 `list.some((t) => t.id === id)`），没有这一项就直接 `return list`。
:::

:::hint{level=2}
`moveUp`：用 `findIndex` 找到位置，`index <= 0` 时返回原数组。交换可以用两次 `with`：`list.with(index - 1, current).with(index, previous)`，`with` 返回替换了一项的新数组。用 `list[index]` 取元素时类型包含 `undefined`（`noUncheckedIndexedAccess`），检查之后再使用。
:::

:::explanation
`TodoList` 是 `readonly Todo[]`，`Todo` 是 `Readonly<…>`：在这个文件里写 `list.push(...)`、`list.splice(...)`、`t.done = true`，TypeScript 都会报错。即使类型被绕过，测试中冻结的数组也会在运行时抛出错误。两道防线检查的是同一条规则：**不修改，只创建**。

为什么“没有变化的项必须是原来的对象”？React 和很多工具靠引用是否相同来判断数据有没有变化。只替换真正变化的那一项，其余的项保持引用不变，后面就可以跳过对它们的处理（例如 g12 的 `memo`）。用 `structuredClone` 深拷贝整个数组再修改，结果在内容上是对的，却让每一项都成了“新的”。

“没有变化就返回原数组”也是同样的道理：`map` 和 `filter` 总是返回新数组，即使什么都没改。先判断一下，返回 `list` 本身，React 用 `Object.is` 比较时就知道不需要重新渲染。
:::

:::variant{kind=alt name=index-based}
```ts file=todos.ts
export type Todo = Readonly<{ id: number; title: string; done: boolean }>;
export type TodoList = readonly Todo[];

function update(list: TodoList, id: number, change: (t: Todo) => Todo): TodoList {
  const index = list.findIndex((t) => t.id === id);
  const target = list[index];
  if (target === undefined) return list;
  return list.toSpliced(index, 1, change(target));
}

export function addTodo(list: TodoList, id: number, title: string): TodoList {
  const text = title.trim();
  return text ? list.concat({ id, title: text, done: false }) : list;
}

export function toggleTodo(list: TodoList, id: number): TodoList {
  return update(list, id, (t) => ({ ...t, done: !t.done }));
}

export function renameTodo(list: TodoList, id: number, title: string): TodoList {
  const text = title.trim();
  return text ? update(list, id, (t) => ({ ...t, title: text })) : list;
}

export function removeTodo(list: TodoList, id: number): TodoList {
  const index = list.findIndex((t) => t.id === id);
  return index === -1 ? list : list.toSpliced(index, 1);
}

export function moveUp(list: TodoList, id: number): TodoList {
  const index = list.findIndex((t) => t.id === id);
  if (index < 1) return list;
  const copy = [...list];
  const [moved] = copy.splice(index, 1);
  if (moved === undefined) return list;
  copy.splice(index - 1, 0, moved);
  return copy;
}
```
:::

:::variant{kind=wrong name=always-new-array fails=tests reason="没有变化时也返回了新数组"}
```ts file=todos.ts
export type Todo = Readonly<{ id: number; title: string; done: boolean }>;
export type TodoList = readonly Todo[];

export function addTodo(list: TodoList, id: number, title: string): TodoList {
  const text = title.trim();
  if (text === '') return list;
  return [...list, { id, title: text, done: false }];
}

export function toggleTodo(list: TodoList, id: number): TodoList {
  return list.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
}

export function renameTodo(list: TodoList, id: number, title: string): TodoList {
  const text = title.trim();
  if (text === '') return list;
  return list.map((t) => (t.id === id ? { ...t, title: text } : t));
}

export function removeTodo(list: TodoList, id: number): TodoList {
  return list.filter((t) => t.id !== id);
}

export function moveUp(list: TodoList, id: number): TodoList {
  const index = list.findIndex((t) => t.id === id);
  const previous = list[index - 1];
  const current = list[index];
  if (index <= 0 || previous === undefined || current === undefined) return list;
  return list.with(index - 1, current).with(index, previous);
}
```
:::

:::variant{kind=wrong name=deep-clone fails=tests reason="先深拷贝整个数组，没有变化的项也成了新对象"}
```ts file=todos.ts
export type Todo = Readonly<{ id: number; title: string; done: boolean }>;
export type TodoList = readonly Todo[];

function has(list: TodoList, id: number): boolean {
  return list.some((t) => t.id === id);
}

export function addTodo(list: TodoList, id: number, title: string): TodoList {
  const text = title.trim();
  if (text === '') return list;
  return [...structuredClone(list), { id, title: text, done: false }];
}

export function toggleTodo(list: TodoList, id: number): TodoList {
  if (!has(list, id)) return list;
  return structuredClone(list).map((t) => (t.id === id ? { ...t, done: !t.done } : t));
}

export function renameTodo(list: TodoList, id: number, title: string): TodoList {
  const text = title.trim();
  if (text === '' || !has(list, id)) return list;
  return structuredClone(list).map((t) => (t.id === id ? { ...t, title: text } : t));
}

export function removeTodo(list: TodoList, id: number): TodoList {
  if (!has(list, id)) return list;
  return structuredClone(list).filter((t) => t.id !== id);
}

export function moveUp(list: TodoList, id: number): TodoList {
  const index = list.findIndex((t) => t.id === id);
  const copy = structuredClone(list);
  const previous = copy[index - 1];
  const current = copy[index];
  if (index <= 0 || previous === undefined || current === undefined) return list;
  return copy.with(index - 1, current).with(index, previous);
}
```
:::

:::variant{kind=wrong name=no-trim fails=tests reason="标题没有去掉首尾空白，空白标题也被添加了"}
```ts file=todos.ts
export type Todo = Readonly<{ id: number; title: string; done: boolean }>;
export type TodoList = readonly Todo[];

function has(list: TodoList, id: number): boolean {
  return list.some((t) => t.id === id);
}

export function addTodo(list: TodoList, id: number, title: string): TodoList {
  if (title === '') return list;
  return [...list, { id, title, done: false }];
}

export function toggleTodo(list: TodoList, id: number): TodoList {
  if (!has(list, id)) return list;
  return list.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
}

export function renameTodo(list: TodoList, id: number, title: string): TodoList {
  if (title === '' || !has(list, id)) return list;
  return list.map((t) => (t.id === id ? { ...t, title } : t));
}

export function removeTodo(list: TodoList, id: number): TodoList {
  if (!has(list, id)) return list;
  return list.filter((t) => t.id !== id);
}

export function moveUp(list: TodoList, id: number): TodoList {
  const index = list.findIndex((t) => t.id === id);
  const previous = list[index - 1];
  const current = list[index];
  if (index <= 0 || previous === undefined || current === undefined) return list;
  return list.with(index - 1, current).with(index, previous);
}
```
:::
