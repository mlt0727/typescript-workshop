---
kind: challenge
title: useUndoable：可以撤销和重做的 state
---
实现一个泛型 Hook `useUndoable<T>(initial, limit = 100)`，它像 `useState` 一样保存一个值，但能撤销和重做。返回 `Undoable<T>`：

- `value`：当前的值；
- `set(next)`：设置新值。旧的值进入“可撤销”的记录，“可重做”的记录被清空。`next` 与当前的值相同（`Object.is`）时什么都不做；
- `undo()`：回到上一个值，当前的值进入“可重做”的记录；没有可撤销的记录时什么都不做；
- `redo()`：撤销的反向操作；没有可重做的记录时什么都不做；
- `canUndo`、`canRedo`：现在能不能撤销、重做；
- 可撤销的记录最多保留 `limit` 条，超出时丢弃最早的。

在同一个事件中连续调用 `set` 两次，两次都要被记录。`T` 由 `initial` 推断：`useUndoable(0)` 的 `set` 只接受数字。`TitleEditor.tsx`（只读）是一个使用它的小编辑器。

:::files{role=starter}
```ts file=useUndoable.ts
import { useState } from 'react';

export type Undoable<T> = {
  value: T;
  set(next: T): void;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
};

type History<T> = { past: readonly T[]; present: T; future: readonly T[] };

export function useUndoable<T>(initial: T, limit = 100): Undoable<T> {
  const [value, setValue] = useState(initial);
  // TODO：记住历史，实现撤销与重做
  return {
    value,
    set: setValue,
    undo() {},
    redo() {},
    canUndo: false,
    canRedo: false,
  };
}
```
:::

:::files{role=support}
```tsx file=TitleEditor.tsx readonly
import { useUndoable } from './useUndoable';

export function TitleEditor() {
  const title = useUndoable('未命名文档');
  return (
    <div>
      <label htmlFor="title">标题</label> <input id="title" value={title.value} onChange={(e) => title.set(e.currentTarget.value)} />{' '}
      <button type="button" disabled={!title.canUndo} onClick={title.undo}>
        撤销
      </button>{' '}
      <button type="button" disabled={!title.canRedo} onClick={title.redo}>
        重做
      </button>
      <p>当前标题：{title.value}</p>
    </div>
  );
}
```
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { TitleEditor } from './TitleEditor';

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<TitleEditor />);
```
:::

:::files{role=solution}
```ts file=useUndoable.ts
import { useState } from 'react';

export type Undoable<T> = {
  value: T;
  set(next: T): void;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
};

type History<T> = { past: readonly T[]; present: T; future: readonly T[] };

/** 数组的最后一项，数组为空时返回 null。用对象包住：T 本身包含 undefined 时也分得清 */
function lastOf<T>(items: readonly T[]): { value: T } | null {
  return items.reduce<{ value: T } | null>((_, value) => ({ value }), null);
}

export function useUndoable<T>(initial: T, limit = 100): Undoable<T> {
  const [history, setHistory] = useState<History<T>>({ past: [], present: initial, future: [] });

  return {
    value: history.present,
    set(next) {
      setHistory((h) =>
        Object.is(next, h.present) ? h : { past: [...h.past, h.present].slice(-limit), present: next, future: [] },
      );
    },
    undo() {
      setHistory((h) => {
        const previous = lastOf(h.past);
        if (previous === null) return h;
        return { past: h.past.slice(0, -1), present: previous.value, future: [h.present, ...h.future] };
      });
    },
    redo() {
      setHistory((h) => {
        const next = lastOf(h.future.slice(0, 1));
        if (next === null) return h;
        return { past: [...h.past, h.present].slice(-limit), present: next.value, future: h.future.slice(1) };
      });
    },
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
```
:::

:::files{role=tests}
```tsx file=useUndoable.test.tsx
import { describe, expect, test } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useUndoable } from './useUndoable';
import { TitleEditor } from './TitleEditor';

describe('useUndoable', () => {
  test('设置、撤销、重做', () => {
    const { result } = renderHook(() => useUndoable(1));
    expect(result.current).toMatchObject({ value: 1, canUndo: false, canRedo: false });
    act(() => result.current.set(2));
    act(() => result.current.set(3));
    expect(result.current).toMatchObject({ value: 3, canUndo: true, canRedo: false });
    act(() => result.current.undo());
    expect(result.current).toMatchObject({ value: 2, canUndo: true, canRedo: true });
    act(() => result.current.undo());
    expect(result.current).toMatchObject({ value: 1, canUndo: false, canRedo: true });
    act(() => result.current.redo());
    act(() => result.current.redo());
    expect(result.current).toMatchObject({ value: 3, canUndo: true, canRedo: false });
  });

  test('没有可撤销、可重做的记录时什么都不做', () => {
    const { result } = renderHook(() => useUndoable('a'));
    act(() => result.current.undo());
    act(() => result.current.redo());
    expect(result.current.value).toBe('a');
  });

  test('撤销之后再设置新值，重做的记录被清空', () => {
    const { result } = renderHook(() => useUndoable('a'));
    act(() => result.current.set('b'));
    act(() => result.current.undo());
    act(() => result.current.set('c'));
    expect(result.current).toMatchObject({ value: 'c', canRedo: false });
    act(() => result.current.undo());
    expect(result.current.value).toBe('a');
  });

  test('设置为相同的值不产生新记录', () => {
    const { result } = renderHook(() => useUndoable(5));
    act(() => result.current.set(5));
    expect(result.current.canUndo).toBe(false);
  });

  test('同一个事件中连续设置两次，两次都被记录', () => {
    const { result } = renderHook(() => useUndoable(0));
    act(() => {
      result.current.set(1);
      result.current.set(2);
    });
    expect(result.current.value).toBe(2);
    act(() => result.current.undo());
    expect(result.current.value).toBe(1);
  });

  test('最多保留 limit 条可撤销的记录，丢弃最早的', () => {
    const { result } = renderHook(() => useUndoable(0, 3));
    for (const n of [1, 2, 3, 4, 5]) act(() => result.current.set(n));
    for (let i = 0; i < 10; i++) act(() => result.current.undo());
    expect(result.current.value).toBe(2);
  });

  test('T 本身包含 undefined 时也能撤销到 undefined', () => {
    const { result } = renderHook(() => useUndoable<string | undefined>(undefined));
    act(() => result.current.set('a'));
    act(() => result.current.undo());
    expect(result.current).toMatchObject({ value: undefined, canUndo: false, canRedo: true });
    act(() => result.current.redo());
    expect(result.current.value).toBe('a');
  });

  test('值可以是对象，历史中保存的是同一个对象', () => {
    const first = { title: '草稿' };
    const second = { title: '定稿' };
    const { result } = renderHook(() => useUndoable(first));
    act(() => result.current.set(second));
    act(() => result.current.undo());
    expect(result.current.value).toBe(first);
  });
});

test('TitleEditor：输入之后可以撤销', async () => {
  const user = userEvent.setup();
  render(<TitleEditor />);
  await user.clear(screen.getByLabelText('标题'));
  await user.type(screen.getByLabelText('标题'), '周报');
  expect(screen.getByText('当前标题：周报')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '撤销' }));
  expect(screen.getByText('当前标题：周')).toBeInTheDocument();
});
```
```tsx file=useUndoable.test-d.tsx
import { expectTypeOf } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUndoable } from './useUndoable';

const { result } = renderHook(() => useUndoable({ title: '草稿', words: 0 }));
expectTypeOf(result.current.value).toEqualTypeOf<{ title: string; words: number }>();
// @ts-expect-error 只能设置同一种类型的值
result.current.set({ title: '缺少字数' });

const counter = renderHook(() => useUndoable(0)).result.current;
expectTypeOf(counter.value).toEqualTypeOf<number>();
// @ts-expect-error 数字的历史中不能放字符串
counter.set('1');
```
:::

:::hint{level=1}
三部分数据总是一起变化：过去的值 `past`、当前的值 `present`、将来的值 `future`。把它们放进**一个**对象 state 中（g07“一起变化的放在一起”），每个操作都用更新函数计算出新的对象。
:::

:::hint{level=2}
`set(next)`：`setHistory((h) => ({ past: [...h.past, h.present].slice(-limit), present: next, future: [] }))`，相同的值时返回 `h` 本身。`undo`：取出 `h.past` 的最后一项作为新的 `present`，原来的 `present` 放到 `future` 的开头。`at(-1)` 取最后一项，`slice(0, -1)` 去掉最后一项。
:::

:::explanation
历史记录是一个经典的“三段式”结构：`past`、`present`、`future`。撤销把 `present` 推进 `future`、从 `past` 取回一个；重做反过来；设置新值则清空 `future`，因为从这里开始，旧的“将来”已经不存在了。

三段数据放在一个 state 中，并且每次都用更新函数计算，有两个好处：一是它们永远一起变化，不会出现“`present` 改了、`past` 还没改”的中间状态；二是同一个事件中连续调用两次 `set`，第二次的更新函数拿到的是第一次的结果，两次都被记录。如果分成三个 `useState` 并直接读取当前渲染的值，第二次调用读到的仍然是旧的 `present`。

`slice(-limit)` 只保留最后 `limit` 项，实现“最多保留多少条”。所有数组操作都返回新数组（g04），`History<T>` 中的 `readonly` 让修改原数组的写法无法通过编译。

取出最后一项时，不能用 `h.past.at(-1) === undefined` 判断“有没有记录”：如果 `T` 本身包含 `undefined`（例如 `useUndoable<string | undefined>(undefined)`），记录的值就可能是 `undefined`。参考解用一个小函数 `lastOf` 把元素包进对象，`null` 才表示“没有”。另一种写法是用 `for…of` 遍历：只有数组非空时才会进入循环体（见替代解）。

这个 Hook 是泛型的：`useUndoable({ title: '草稿', words: 0 })` 中，`T` 被推断为 `{ title: string; words: number }`，`set` 也就只接受这种对象。
:::

:::variant{kind=alt name=destructured-history}
```ts file=useUndoable.ts
import { useState } from 'react';

export type Undoable<T> = {
  value: T;
  set(next: T): void;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
};

type History<T> = { past: readonly T[]; present: T; future: readonly T[] };

const EMPTY: readonly never[] = [];

export function useUndoable<T>(initial: T, limit = 100): Undoable<T> {
  const [{ past, present, future }, setHistory] = useState<History<T>>(() => ({ past: EMPTY, present: initial, future: EMPTY }));

  const set = (next: T) =>
    setHistory((h) => {
      if (Object.is(h.present, next)) return h;
      const kept = h.past.length >= limit ? h.past.slice(h.past.length - limit + 1) : h.past;
      return { past: [...kept, h.present], present: next, future: EMPTY };
    });

  // for…of 只在数组非空时进入循环体，取出的元素类型就是 T
  const undo = () =>
    setHistory((h) => {
      for (const previous of h.past.toReversed()) {
        return { past: h.past.slice(0, -1), present: previous, future: [h.present, ...h.future] };
      }
      return h;
    });

  const redo = () =>
    setHistory((h) => {
      for (const next of h.future) {
        return { past: [...h.past, h.present], present: next, future: h.future.slice(1) };
      }
      return h;
    });

  return { value: present, set, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 };
}
```
:::

:::variant{kind=wrong name=three-states fails=tests reason="分成三个 state 并读取当前渲染的值，同一个事件中连续设置两次时第一次丢失了"}
```ts file=useUndoable.ts
import { useState } from 'react';

export type Undoable<T> = {
  value: T;
  set(next: T): void;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
};

type History<T> = { past: readonly T[]; present: T; future: readonly T[] };

export function useUndoable<T>(initial: T, limit = 100): Undoable<T> {
  const [past, setPast] = useState<readonly T[]>([]);
  const [present, setPresent] = useState(initial);
  const [future, setFuture] = useState<readonly T[]>([]);

  return {
    value: present,
    set(next) {
      if (Object.is(next, present)) return;
      setPast([...past, present].slice(-limit));
      setPresent(next);
      setFuture([]);
    },
    undo() {
      const previous = past.at(-1);
      if (previous === undefined || past.length === 0) return;
      setPast(past.slice(0, -1));
      setPresent(previous);
      setFuture([present, ...future]);
    },
    redo() {
      const [next, ...rest] = future;
      if (next === undefined || future.length === 0) return;
      setPast([...past, present].slice(-limit));
      setPresent(next);
      setFuture(rest);
    },
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
```
:::

:::variant{kind=wrong name=mutate-past fails=types reason="用 push 修改了原来的历史数组"}
```ts file=useUndoable.ts
import { useState } from 'react';

export type Undoable<T> = {
  value: T;
  set(next: T): void;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
};

type History<T> = { past: readonly T[]; present: T; future: readonly T[] };

/** 数组的最后一项，数组为空时返回 null。用对象包住：T 本身包含 undefined 时也分得清 */
function lastOf<T>(items: readonly T[]): { value: T } | null {
  return items.reduce<{ value: T } | null>((_, value) => ({ value }), null);
}

export function useUndoable<T>(initial: T, limit = 100): Undoable<T> {
  const [history, setHistory] = useState<History<T>>({ past: [], present: initial, future: [] });

  return {
    value: history.present,
    set(next) {
      setHistory((h) => {
        if (Object.is(next, h.present)) return h;
        h.past.push(h.present);
        return { past: h.past.slice(-limit), present: next, future: [] };
      });
    },
    undo() {
      setHistory((h) => {
        const previous = lastOf(h.past);
        if (previous === null) return h;
        return { past: h.past.slice(0, -1), present: previous.value, future: [h.present, ...h.future] };
      });
    },
    redo() {
      setHistory((h) => {
        const next = lastOf(h.future.slice(0, 1));
        if (next === null) return h;
        return { past: [...h.past, h.present].slice(-limit), present: next.value, future: h.future.slice(1) };
      });
    },
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
```
:::

:::variant{kind=wrong name=no-limit fails=tests reason="没有限制可撤销记录的数量"}
```ts file=useUndoable.ts
import { useState } from 'react';

export type Undoable<T> = {
  value: T;
  set(next: T): void;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
};

type History<T> = { past: readonly T[]; present: T; future: readonly T[] };

/** 数组的最后一项，数组为空时返回 null。用对象包住：T 本身包含 undefined 时也分得清 */
function lastOf<T>(items: readonly T[]): { value: T } | null {
  return items.reduce<{ value: T } | null>((_, value) => ({ value }), null);
}

export function useUndoable<T>(initial: T, limit = 100): Undoable<T> {
  const [history, setHistory] = useState<History<T>>({ past: [], present: initial, future: [] });

  return {
    value: history.present,
    set(next) {
      setHistory((h) => (Object.is(next, h.present) ? h : { past: [...h.past, h.present], present: next, future: [] }));
    },
    undo() {
      setHistory((h) => {
        const previous = lastOf(h.past);
        if (previous === null) return h;
        return { past: h.past.slice(0, -1), present: previous.value, future: [h.present, ...h.future] };
      });
    },
    redo() {
      setHistory((h) => {
        const next = lastOf(h.future.slice(0, 1));
        if (next === null) return h;
        return { past: [...h.past, h.present].slice(-limit), present: next.value, future: h.future.slice(1) };
      });
    },
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
```
:::

:::variant{kind=wrong name=keep-future fails=tests reason="设置新值时没有清空可重做的记录"}
```ts file=useUndoable.ts
import { useState } from 'react';

export type Undoable<T> = {
  value: T;
  set(next: T): void;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
};

type History<T> = { past: readonly T[]; present: T; future: readonly T[] };

/** 数组的最后一项，数组为空时返回 null。用对象包住：T 本身包含 undefined 时也分得清 */
function lastOf<T>(items: readonly T[]): { value: T } | null {
  return items.reduce<{ value: T } | null>((_, value) => ({ value }), null);
}

export function useUndoable<T>(initial: T, limit = 100): Undoable<T> {
  const [history, setHistory] = useState<History<T>>({ past: [], present: initial, future: [] });

  return {
    value: history.present,
    set(next) {
      setHistory((h) =>
        Object.is(next, h.present) ? h : { past: [...h.past, h.present].slice(-limit), present: next, future: h.future },
      );
    },
    undo() {
      setHistory((h) => {
        const previous = lastOf(h.past);
        if (previous === null) return h;
        return { past: h.past.slice(0, -1), present: previous.value, future: [h.present, ...h.future] };
      });
    },
    redo() {
      setHistory((h) => {
        const next = lastOf(h.future.slice(0, 1));
        if (next === null) return h;
        return { past: [...h.past, h.present].slice(-limit), present: next.value, future: h.future.slice(1) };
      });
    },
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
```
:::

:::variant{kind=wrong name=widened-type fails=types reason="把值的类型放宽成了 T | string"}
```ts file=useUndoable.ts
import { useState } from 'react';

export type Undoable<T> = {
  value: T;
  set(next: T): void;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
};

type History<T> = { past: readonly T[]; present: T; future: readonly T[] };

/** 数组的最后一项，数组为空时返回 null。用对象包住：T 本身包含 undefined 时也分得清 */
function lastOf<T>(items: readonly T[]): { value: T } | null {
  return items.reduce<{ value: T } | null>((_, value) => ({ value }), null);
}

export function useUndoable<T>(initial: T, limit = 100): Undoable<T | string> {
  const [history, setHistory] = useState<History<T | string>>({ past: [], present: initial, future: [] });

  return {
    value: history.present,
    set(next) {
      setHistory((h) =>
        Object.is(next, h.present) ? h : { past: [...h.past, h.present].slice(-limit), present: next, future: [] },
      );
    },
    undo() {
      setHistory((h) => {
        const previous = lastOf(h.past);
        if (previous === null) return h;
        return { past: h.past.slice(0, -1), present: previous.value, future: [h.present, ...h.future] };
      });
    },
    redo() {
      setHistory((h) => {
        const next = lastOf(h.future.slice(0, 1));
        if (next === null) return h;
        return { past: [...h.past, h.present].slice(-limit), present: next.value, future: h.future.slice(1) };
      });
    },
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
```
:::
