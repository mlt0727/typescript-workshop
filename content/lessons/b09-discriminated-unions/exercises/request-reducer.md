---
kind: challenge
title: 请求状态机
---
用可辨识联合描述一个列表请求的状态，以及会改变状态的事件（后面 React 课的 `useReducer` 正是这种写法）。

**1. 定义并导出两个类型：**

```ts
type State =
  | { status: 'idle' }
  | { status: 'loading'; startedAt: number }
  | { status: 'success'; items: string[]; loadedAt: number }
  | { status: 'error'; message: string };

type RequestEvent =
  | { type: 'fetch'; at: number }
  | { type: 'resolve'; items: string[]; at: number }
  | { type: 'reject'; message: string }
  | { type: 'reset' };
```

**2. 实现 `transition(state, event)`**，返回新的状态：

| 事件 | 规则 |
| --- | --- |
| `fetch` | 当前不是 `loading` 时，变成 `{ status: 'loading', startedAt: at }`；正在 `loading` 时忽略 |
| `resolve` | 只在 `loading` 时有效：变成 `success`，`items` 复制一份，`loadedAt` 为事件的 `at` |
| `reject` | 只在 `loading` 时有效：变成 `{ status: 'error', message }` |
| `reset` | 任何状态都变成新的 `{ status: 'idle' }`（即使原来就是 `idle`，也返回新对象） |

“忽略”和“无效”都表示**返回原来的同一个状态对象**（不创建新对象）。不能修改传入的状态。

**3. 实现 `label(state)`**：`idle` → `'未开始'`，`loading` → `'加载中…'`，`success` → `` `已加载 ${条数} 条` ``，`error` → `` `出错：${message}` ``。两个函数都用穷尽检查处理所有情况。

:::files{role=starter}
```ts file=request.ts
export type State = {
  status: string;
  startedAt?: number;
  items?: string[];
  loadedAt?: number;
  message?: string;
};

export type RequestEvent = {
  type: string;
  at?: number;
  items?: string[];
  message?: string;
};

export function transition(state: State, event: RequestEvent): State {
  return state;
}

export function label(state: State): string {
  return state.status;
}
```
:::

:::files{role=solution}
```ts file=request.ts
export type State =
  | { status: 'idle' }
  | { status: 'loading'; startedAt: number }
  | { status: 'success'; items: string[]; loadedAt: number }
  | { status: 'error'; message: string };

export type RequestEvent =
  | { type: 'fetch'; at: number }
  | { type: 'resolve'; items: string[]; at: number }
  | { type: 'reject'; message: string }
  | { type: 'reset' };

function assertNever(value: never): never {
  throw new Error(`未处理的情况：${JSON.stringify(value)}`);
}

export function transition(state: State, event: RequestEvent): State {
  switch (event.type) {
    case 'fetch':
      return state.status === 'loading' ? state : { status: 'loading', startedAt: event.at };
    case 'resolve':
      return state.status === 'loading' ? { status: 'success', items: [...event.items], loadedAt: event.at } : state;
    case 'reject':
      return state.status === 'loading' ? { status: 'error', message: event.message } : state;
    case 'reset':
      return { status: 'idle' };
    default:
      return assertNever(event);
  }
}

export function label(state: State): string {
  switch (state.status) {
    case 'idle':
      return '未开始';
    case 'loading':
      return '加载中…';
    case 'success':
      return `已加载 ${state.items.length} 条`;
    case 'error':
      return `出错：${state.message}`;
    default:
      return assertNever(state);
  }
}
```
:::

:::files{role=tests}
```ts file=request.test.ts
import { describe, expect, test } from 'vitest';
import { label, transition, type State } from './request';

const idle: State = { status: 'idle' };
const loading: State = { status: 'loading', startedAt: 100 };

describe('transition', () => {
  test('fetch 开始加载', () => {
    expect(transition(idle, { type: 'fetch', at: 100 })).toEqual({ status: 'loading', startedAt: 100 });
    expect(transition({ status: 'error', message: 'x' }, { type: 'fetch', at: 5 })).toEqual({
      status: 'loading',
      startedAt: 5,
    });
  });

  test('正在加载时忽略 fetch', () => {
    expect(transition(loading, { type: 'fetch', at: 200 })).toBe(loading);
  });

  test('resolve 只在加载中有效，并复制 items', () => {
    const items = ['a', 'b'];
    const next = transition(loading, { type: 'resolve', items, at: 300 });
    expect(next).toEqual({ status: 'success', items: ['a', 'b'], loadedAt: 300 });
    items.push('c');
    expect(next).toEqual({ status: 'success', items: ['a', 'b'], loadedAt: 300 });
    expect(transition(idle, { type: 'resolve', items: [], at: 1 })).toBe(idle);
  });

  test('reject 只在加载中有效', () => {
    expect(transition(loading, { type: 'reject', message: '超时' })).toEqual({ status: 'error', message: '超时' });
    const success: State = { status: 'success', items: [], loadedAt: 1 };
    expect(transition(success, { type: 'reject', message: '超时' })).toBe(success);
  });

  test('reset 回到初始状态', () => {
    expect(transition({ status: 'error', message: 'x' }, { type: 'reset' })).toEqual({ status: 'idle' });
    expect(transition(loading, { type: 'reset' })).toEqual({ status: 'idle' });
  });

  test('不修改传入的状态', () => {
    const state: State = { status: 'loading', startedAt: 1 };
    transition(state, { type: 'resolve', items: ['x'], at: 2 });
    expect(state).toEqual({ status: 'loading', startedAt: 1 });
  });
});

describe('label', () => {
  test('四种状态', () => {
    expect(label(idle)).toBe('未开始');
    expect(label(loading)).toBe('加载中…');
    expect(label({ status: 'success', items: ['a', 'b', 'c'], loadedAt: 1 })).toBe('已加载 3 条');
    expect(label({ status: 'error', message: '网络断开' })).toBe('出错：网络断开');
  });
});
```
```ts file=request.test-d.ts
import { expectTypeOf } from 'vitest';
import type { RequestEvent, State } from './request';

expectTypeOf<State>().toEqualTypeOf<
  | { status: 'idle' }
  | { status: 'loading'; startedAt: number }
  | { status: 'success'; items: string[]; loadedAt: number }
  | { status: 'error'; message: string }
>();
expectTypeOf<RequestEvent>().toEqualTypeOf<
  | { type: 'fetch'; at: number }
  | { type: 'resolve'; items: string[]; at: number }
  | { type: 'reject'; message: string }
  | { type: 'reset' }
>();
```
:::

:::hint{level=1}
先把两个类型改成可辨识联合（判别属性分别是 `status` 和 `type`）。`transition` 对事件的 `type` 做 `switch`，在每个分支里再检查当前状态的 `status`。
:::

:::hint{level=2}
`case 'resolve': return state.status === 'loading' ? { status: 'success', items: [...event.items], loadedAt: event.at } : state;`。在这个分支里，`event` 已经被收窄成 `resolve` 事件，可以读取 `items` 和 `at`。两个 `switch` 的 `default` 都写 `return assertNever(…)`。
:::

:::explanation
起始代码的类型用一堆可选属性表示所有情况：`{ status: 'loading', message: 'x' }` 这种不可能的状态也是合法的，而且每次读取 `items`、`message` 都要处理 `undefined`。改成可辨识联合后，每种状态只有属于自己的属性：在 `case 'success'` 里，`state.items` 一定存在，类型是 `string[]`。

`transition` 的两层判断——先看事件类型，再看当前状态——正是状态机的写法。“忽略”时返回原对象，让调用方可以用 `===` 判断状态是否变化（React 正是这样判断是否需要重新渲染的）；有变化时总是创建新对象，从不修改旧状态。

两个 `default` 里的 `assertNever` 保证：以后新增一种状态或事件，编译器会指出这里需要处理。
:::

:::variant{kind=alt name=state-first}
```ts file=request.ts
export type State =
  | { status: 'idle' }
  | { status: 'loading'; startedAt: number }
  | { status: 'success'; items: string[]; loadedAt: number }
  | { status: 'error'; message: string };

export type RequestEvent =
  | { type: 'fetch'; at: number }
  | { type: 'resolve'; items: string[]; at: number }
  | { type: 'reject'; message: string }
  | { type: 'reset' };

function assertNever(value: never): never {
  throw new Error(`未处理：${JSON.stringify(value)}`);
}

export function transition(state: State, event: RequestEvent): State {
  if (event.type === 'reset') return { status: 'idle' };
  if (event.type === 'fetch') {
    return state.status === 'loading' ? state : { status: 'loading', startedAt: event.at };
  }
  if (state.status !== 'loading') return state;
  if (event.type === 'resolve') return { status: 'success', items: event.items.slice(), loadedAt: event.at };
  if (event.type === 'reject') return { status: 'error', message: event.message };
  return assertNever(event);
}

export function label(state: State): string {
  if (state.status === 'idle') return '未开始';
  if (state.status === 'loading') return '加载中…';
  if (state.status === 'success') return `已加载 ${state.items.length} 条`;
  if (state.status === 'error') return `出错：${state.message}`;
  return assertNever(state);
}
```
:::

:::variant{kind=wrong name=optional-fields fails=types reason="类型仍然是一堆可选属性，不是可辨识联合"}
```ts file=request.ts
export type State = {
  status: 'idle' | 'loading' | 'success' | 'error';
  startedAt?: number;
  items?: string[];
  loadedAt?: number;
  message?: string;
};

export type RequestEvent = {
  type: 'fetch' | 'resolve' | 'reject' | 'reset';
  at?: number;
  items?: string[];
  message?: string;
};

export function transition(state: State, event: RequestEvent): State {
  switch (event.type) {
    case 'fetch':
      return state.status === 'loading' ? state : { status: 'loading', startedAt: event.at ?? 0 };
    case 'resolve':
      return state.status === 'loading' ? { status: 'success', items: [...(event.items ?? [])], loadedAt: event.at ?? 0 } : state;
    case 'reject':
      return state.status === 'loading' ? { status: 'error', message: event.message ?? '' } : state;
    case 'reset':
      return { status: 'idle' };
  }
}

export function label(state: State): string {
  switch (state.status) {
    case 'idle':
      return '未开始';
    case 'loading':
      return '加载中…';
    case 'success':
      return `已加载 ${state.items?.length ?? 0} 条`;
    case 'error':
      return `出错：${state.message ?? ''}`;
  }
}
```
:::

:::variant{kind=wrong name=resolve-anytime fails=tests reason="不在加载中时也接受了 resolve"}
```ts file=request.ts
export type State =
  | { status: 'idle' }
  | { status: 'loading'; startedAt: number }
  | { status: 'success'; items: string[]; loadedAt: number }
  | { status: 'error'; message: string };

export type RequestEvent =
  | { type: 'fetch'; at: number }
  | { type: 'resolve'; items: string[]; at: number }
  | { type: 'reject'; message: string }
  | { type: 'reset' };

export function transition(state: State, event: RequestEvent): State {
  switch (event.type) {
    case 'fetch':
      return state.status === 'loading' ? state : { status: 'loading', startedAt: event.at };
    case 'resolve':
      return { status: 'success', items: [...event.items], loadedAt: event.at };
    case 'reject':
      return { status: 'error', message: event.message };
    case 'reset':
      return { status: 'idle' };
  }
}

export function label(state: State): string {
  switch (state.status) {
    case 'idle':
      return '未开始';
    case 'loading':
      return '加载中…';
    case 'success':
      return `已加载 ${state.items.length} 条`;
    case 'error':
      return `出错：${state.message}`;
  }
}
```
:::

:::variant{kind=wrong name=new-object-when-ignored fails=tests reason="忽略事件时返回了新对象，而不是原来的状态"}
```ts file=request.ts
export type State =
  | { status: 'idle' }
  | { status: 'loading'; startedAt: number }
  | { status: 'success'; items: string[]; loadedAt: number }
  | { status: 'error'; message: string };

export type RequestEvent =
  | { type: 'fetch'; at: number }
  | { type: 'resolve'; items: string[]; at: number }
  | { type: 'reject'; message: string }
  | { type: 'reset' };

export function transition(state: State, event: RequestEvent): State {
  switch (event.type) {
    case 'fetch':
      return state.status === 'loading' ? { ...state } : { status: 'loading', startedAt: event.at };
    case 'resolve':
      return state.status === 'loading' ? { status: 'success', items: [...event.items], loadedAt: event.at } : { ...state };
    case 'reject':
      return state.status === 'loading' ? { status: 'error', message: event.message } : { ...state };
    case 'reset':
      return { status: 'idle' };
  }
}

export function label(state: State): string {
  switch (state.status) {
    case 'idle':
      return '未开始';
    case 'loading':
      return '加载中…';
    case 'success':
      return `已加载 ${state.items.length} 条`;
    case 'error':
      return `出错：${state.message}`;
  }
}
```
:::

:::variant{kind=wrong name=shared-items fails=tests reason="success 状态直接使用了事件里的数组，没有复制"}
```ts file=request.ts
export type State =
  | { status: 'idle' }
  | { status: 'loading'; startedAt: number }
  | { status: 'success'; items: string[]; loadedAt: number }
  | { status: 'error'; message: string };

export type RequestEvent =
  | { type: 'fetch'; at: number }
  | { type: 'resolve'; items: string[]; at: number }
  | { type: 'reject'; message: string }
  | { type: 'reset' };

export function transition(state: State, event: RequestEvent): State {
  switch (event.type) {
    case 'fetch':
      return state.status === 'loading' ? state : { status: 'loading', startedAt: event.at };
    case 'resolve':
      return state.status === 'loading' ? { status: 'success', items: event.items, loadedAt: event.at } : state;
    case 'reject':
      return state.status === 'loading' ? { status: 'error', message: event.message } : state;
    case 'reset':
      return { status: 'idle' };
  }
}

export function label(state: State): string {
  switch (state.status) {
    case 'idle':
      return '未开始';
    case 'loading':
      return '加载中…';
    case 'success':
      return `已加载 ${state.items.length} 条`;
    case 'error':
      return `出错：${state.message}`;
  }
}
```
:::
