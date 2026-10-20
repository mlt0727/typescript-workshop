---
kind: challenge
title: 带类型的事件总线
---
b10 的订阅器只能发送字符串。这次每一种事件都有自己的数据类型，用一个“事件表”类型描述：

```ts
type AppEvents = {
  added: { id: string; title: string };
  removed: { id: string };
  cleared: undefined;
};
```

在 `bus.ts` 中：

1. 导出 `Handler<P>`（接收 `P` 的函数，返回 `void`）和映射类型 `Listeners<E>`：事件表 `E` 中的每一种事件**可以**有一个处理函数数组，数组元素的参数类型与这种事件的数据一致；
2. 实现 `createBus<E>()`，返回 `Bus<E>`（类型已给出）：
   - `on(type, handler)`：注册处理函数，返回取消函数。取消函数只移除这一次注册（同一个函数注册两次，取消一次之后还剩一次）；重复调用取消函数没有额外效果；
   - `emit(type, payload)`：按注册顺序调用这一种事件的处理函数，返回调用的个数。只调用**本次 `emit` 开始时**已经注册的函数：处理函数中新注册的函数从下一次 `emit` 开始生效；
   - `listenerCount(type)`：这一种事件当前有几个处理函数。
3. `emit('added', { id: '1' })`（缺少 `title`）、`emit('unknown', …)`、`on('removed', (p) => p.title)` 都要在编译期报错。

不能使用类型断言。

:::files{role=starter}
```ts file=bus.ts
export type Handler<P> = (payload: P) => void;
export type Listeners<E> = Record<string, Handler<unknown>[]>;

export type Bus<E> = {
  on<K extends keyof E>(type: K, handler: Handler<E[K]>): () => void;
  emit<K extends keyof E>(type: K, payload: E[K]): number;
  listenerCount(type: keyof E): number;
};

export function createBus<E>(): Bus<E> {
  return {
    on: () => () => {},
    emit: () => 0,
    listenerCount: () => 0,
  };
}
```
```ts file=main.ts
import { createBus } from './bus';

type AppEvents = {
  added: { id: string; title: string };
  removed: { id: string };
  cleared: undefined;
};

const bus = createBus<AppEvents>();
const off = bus.on('added', (task) => console.log('添加了', task.title));
bus.on('removed', (task) => console.log('删除了', task.id));
console.log(bus.emit('added', { id: 't1', title: '写周报' }));
off();
console.log(bus.emit('added', { id: 't2', title: '修自行车' }), bus.listenerCount('removed'));
```
:::

:::files{role=solution}
```ts file=bus.ts
export type Handler<P> = (payload: P) => void;
export type Listeners<E> = { [K in keyof E]?: Handler<E[K]>[] };

export type Bus<E> = {
  on<K extends keyof E>(type: K, handler: Handler<E[K]>): () => void;
  emit<K extends keyof E>(type: K, payload: E[K]): number;
  listenerCount(type: keyof E): number;
};

export function createBus<E>(): Bus<E> {
  const listeners: Listeners<E> = {};
  return {
    on(type, handler) {
      // 每次注册都包成一个新函数：同一个 handler 注册两次，数组中也是两个不同的项
      const entry: typeof handler = (payload) => handler(payload);
      // 换成一个新数组：正在进行的 emit 遍历的是旧数组，不受影响
      listeners[type] = [...(listeners[type] ?? []), entry];
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        const list = listeners[type] ?? [];
        const index = list.indexOf(entry);
        if (index !== -1) listeners[type] = list.toSpliced(index, 1);
      };
    },
    emit(type, payload) {
      const list = listeners[type] ?? [];
      for (const handler of list) handler(payload);
      return list.length;
    },
    listenerCount(type) {
      return listeners[type]?.length ?? 0;
    },
  };
}
```
```ts file=main.ts
import { createBus } from './bus';

type AppEvents = {
  added: { id: string; title: string };
  removed: { id: string };
  cleared: undefined;
};

const bus = createBus<AppEvents>();
const off = bus.on('added', (task) => console.log('添加了', task.title));
bus.on('removed', (task) => console.log('删除了', task.id));
console.log(bus.emit('added', { id: 't1', title: '写周报' }));
off();
console.log(bus.emit('added', { id: 't2', title: '修自行车' }), bus.listenerCount('removed'));
```
:::

:::files{role=tests}
```ts file=bus.test.ts
import { describe, expect, test } from 'vitest';
import { createBus } from './bus';

type Events = { added: { id: string }; removed: { id: string }; cleared: undefined };

describe('createBus', () => {
  test('按注册顺序调用这一种事件的处理函数，返回调用的个数', () => {
    const bus = createBus<Events>();
    const calls: string[] = [];
    bus.on('added', (p) => calls.push(`a1:${p.id}`));
    bus.on('removed', (p) => calls.push(`r:${p.id}`));
    bus.on('added', (p) => calls.push(`a2:${p.id}`));
    expect(bus.emit('added', { id: 't1' })).toBe(2);
    expect(calls).toEqual(['a1:t1', 'a2:t1']);
    expect(bus.emit('cleared', undefined)).toBe(0);
  });

  test('取消函数只移除这一次注册，重复调用没有额外效果', () => {
    const bus = createBus<Events>();
    const calls: string[] = [];
    const handler = (p: { id: string }) => calls.push(p.id);
    const off1 = bus.on('added', handler);
    bus.on('added', handler);
    off1();
    off1();
    expect(bus.listenerCount('added')).toBe(1);
    expect(bus.emit('added', { id: 'x' })).toBe(1);
    expect(calls).toEqual(['x']);
  });

  test('同一个函数注册了两次：取消的是这一次注册，其余的顺序不变', () => {
    const bus = createBus<Events>();
    const calls: string[] = [];
    const h = () => calls.push('h');
    const g = () => calls.push('g');
    bus.on('added', h);
    bus.on('added', g);
    const offSecondH = bus.on('added', h);
    offSecondH();
    bus.emit('added', { id: '1' });
    expect(calls).toEqual(['h', 'g']);
  });

  test('处理函数中新注册的函数从下一次 emit 开始生效', () => {
    const bus = createBus<Events>();
    const calls: string[] = [];
    bus.on('added', () => {
      calls.push('first');
      bus.on('added', () => calls.push('late'));
    });
    expect(bus.emit('added', { id: '1' })).toBe(1);
    expect(calls).toEqual(['first']);
    bus.emit('added', { id: '2' });
    expect(calls).toEqual(['first', 'first', 'late']);
  });

  test('listenerCount：没有注册过的事件是 0', () => {
    const bus = createBus<Events>();
    expect(bus.listenerCount('removed')).toBe(0);
    const off = bus.on('removed', () => {});
    expect(bus.listenerCount('removed')).toBe(1);
    off();
    expect(bus.listenerCount('removed')).toBe(0);
  });

  test('不同的总线互不影响', () => {
    const a = createBus<Events>();
    const b = createBus<Events>();
    a.on('added', () => {});
    expect(b.listenerCount('added')).toBe(0);
  });
});
```
```ts file=bus.test-d.ts
import { expectTypeOf } from 'vitest';
import { createBus, type Handler, type Listeners } from './bus';

type AppEvents = { added: { id: string; title: string }; removed: { id: string }; cleared: undefined };

expectTypeOf<Listeners<AppEvents>>().toEqualTypeOf<{
  added?: Handler<{ id: string; title: string }>[];
  removed?: Handler<{ id: string }>[];
  cleared?: Handler<undefined>[];
}>();

const bus = createBus<AppEvents>();
bus.on('removed', (p) => {
  expectTypeOf(p).toEqualTypeOf<{ id: string }>();
});
bus.emit('cleared', undefined);
// @ts-expect-error 缺少 title
bus.emit('added', { id: '1' });
// @ts-expect-error 不存在的事件
bus.emit('unknown', 1);
// @ts-expect-error removed 事件的数据中没有 title
bus.on('removed', (p) => p.title);
```
:::

:::hint{level=1}
`Listeners<E>` 写成 `{ [K in keyof E]?: Handler<E[K]>[] }`。在 `createBus` 中用一个 `const listeners: Listeners<E> = {}` 保存所有的处理函数：属性都是可选的，所以可以从空对象开始。`listeners[type]` 的类型就是 `Handler<E[K]>[] | undefined`。
:::

:::hint{level=2}
“`emit` 开始时已注册的函数”：注册时不要往原来的数组里 `push`，而是换成一个新数组 `[...旧数组, entry]`，正在进行的 `emit` 遍历的仍是旧数组。“只移除这一次注册”：同一个函数可能注册多次，所以每次注册都把它包成一个新函数 `const entry: typeof handler = (payload) => handler(payload)`，取消时删除的是 `entry`（`toSpliced(index, 1)` 只移除一项，同样得到新数组）；用一个 `active` 变量让取消函数只生效一次。
:::

:::explanation
映射类型 `Listeners<E>` 让“事件名”和“处理函数的参数类型”一一对应：`listeners.added` 只能放接收 `{ id; title }` 的函数，`listeners.removed` 只能放接收 `{ id }` 的函数。`on` 和 `emit` 的 `K extends keyof E` 再把调用处的事件名和数据类型连起来，于是缺少 `title`、事件名拼错、在 `removed` 的处理函数中读取 `title`，都在编译期报错。

实现时没有用到任何断言：`listeners[type]` 是 `Listeners<E>[K]`，TypeScript 能把它化简成 `Handler<E[K]>[] | undefined`，和参数 `handler: Handler<E[K]>` 正好匹配。

行为上有两个细节值得注意：

- **快照**：每次注册、取消都换成一个新数组，而不是修改原来的数组。`emit` 拿到的是开始时的数组，处理函数中注册的新函数不会在这一轮被调用（新注册的函数下一轮才生效，这一点与 b10 的订阅器相同）。也因为是快照，`emit` 过程中被取消的函数在这一轮仍会被调用，这与 b10 “取消立即生效”的规则不同：两种规则都常见，规格中要写清楚；
- **按注册移除**：每次注册都把 `handler` 包成一个新函数 `entry`，同一个函数注册两次，数组中就是两个不同的项，取消时找到的正是这一次注册的那一项。如果按 `handler` 本身删除：`filter((h) => h !== handler)` 会把两次注册都删掉；`indexOf(handler)` 找到的是**第一次**注册，依次注册 h、g、h 之后取消第二个 h，剩下的顺序变成了 g、h。
:::

:::variant{kind=alt name=wrapped-handlers}
```ts file=bus.ts
export type Handler<P> = (payload: P) => void;
export type Listeners<E> = { [K in keyof E]?: Handler<E[K]>[] };

export type Bus<E> = {
  on<K extends keyof E>(type: K, handler: Handler<E[K]>): () => void;
  emit<K extends keyof E>(type: K, payload: E[K]): number;
  listenerCount(type: keyof E): number;
};

export function createBus<E>(): Bus<E> {
  const listeners: Listeners<E> = {};

  function on<K extends keyof E>(type: K, handler: Handler<E[K]>): () => void {
    // 用一个新函数包一层：每次注册都是不同的对象，取消时按对象删除
    const entry: Handler<E[K]> = (payload) => handler(payload);
    listeners[type] = (listeners[type] ?? []).concat(entry);
    return () => {
      listeners[type] = (listeners[type] ?? []).filter((h) => h !== entry);
    };
  }

  function emit<K extends keyof E>(type: K, payload: E[K]): number {
    const snapshot = listeners[type] ?? [];
    snapshot.forEach((h) => h(payload));
    return snapshot.length;
  }

  return { on, emit, listenerCount: (type) => (listeners[type] ?? []).length };
}
```
:::

:::variant{kind=wrong name=unknown-payload fails=types reason="处理函数的参数都是 unknown，事件名和数据类型没有对应起来"}
```ts file=bus.ts
export type Handler<P> = (payload: P) => void;
export type Listeners<E> = { [K in keyof E]?: Handler<unknown>[] };

export type Bus<E> = {
  on<K extends keyof E>(type: K, handler: Handler<E[K]>): () => void;
  emit<K extends keyof E>(type: K, payload: E[K]): number;
  listenerCount(type: keyof E): number;
};

export function createBus<E>(): Bus<E> {
  const listeners: Record<PropertyKey, Handler<unknown>[]> = {};
  return {
    on(type, handler) {
      const wrapped: Handler<unknown> = () => {};
      listeners[type] = [...(listeners[type] ?? []), wrapped];
      return () => {};
    },
    emit(type, payload) {
      return (listeners[type] ?? []).length;
    },
    listenerCount(type) {
      return listeners[type]?.length ?? 0;
    },
  };
}
```
:::

:::variant{kind=wrong name=filter-removes-all fails=tests reason="取消时按函数过滤，同一个函数注册两次时两次都被删掉"}
```ts file=bus.ts
export type Handler<P> = (payload: P) => void;
export type Listeners<E> = { [K in keyof E]?: Handler<E[K]>[] };

export type Bus<E> = {
  on<K extends keyof E>(type: K, handler: Handler<E[K]>): () => void;
  emit<K extends keyof E>(type: K, payload: E[K]): number;
  listenerCount(type: keyof E): number;
};

export function createBus<E>(): Bus<E> {
  const listeners: Listeners<E> = {};
  return {
    on(type, handler) {
      listeners[type] = [...(listeners[type] ?? []), handler];
      return () => {
        listeners[type] = (listeners[type] ?? []).filter((h) => h !== handler);
      };
    },
    emit(type, payload) {
      const list = listeners[type] ?? [];
      for (const handler of list) handler(payload);
      return list.length;
    },
    listenerCount(type) {
      return listeners[type]?.length ?? 0;
    },
  };
}
```
:::

:::variant{kind=wrong name=live-array fails=tests reason="注册时修改原来的数组，处理函数中新注册的函数在同一轮就被调用了"}
```ts file=bus.ts
export type Handler<P> = (payload: P) => void;
export type Listeners<E> = { [K in keyof E]?: Handler<E[K]>[] };

export type Bus<E> = {
  on<K extends keyof E>(type: K, handler: Handler<E[K]>): () => void;
  emit<K extends keyof E>(type: K, payload: E[K]): number;
  listenerCount(type: keyof E): number;
};

export function createBus<E>(): Bus<E> {
  const listeners: Listeners<E> = {};
  return {
    on(type, handler) {
      const list = listeners[type] ?? [];
      list.push(handler);
      listeners[type] = list;
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        const index = list.indexOf(handler);
        if (index !== -1) list.splice(index, 1);
      };
    },
    emit(type, payload) {
      let count = 0;
      for (const handler of listeners[type] ?? []) {
        handler(payload);
        count += 1;
      }
      return count;
    },
    listenerCount(type) {
      return listeners[type]?.length ?? 0;
    },
  };
}
```
:::

:::variant{kind=wrong name=remove-first-match fails=tests reason="用 indexOf(handler) 删除：同一个函数注册了两次时，删掉的是第一次注册，不是这一次"}
```ts file=bus.ts
export type Handler<P> = (payload: P) => void;
export type Listeners<E> = { [K in keyof E]?: Handler<E[K]>[] };

export type Bus<E> = {
  on<K extends keyof E>(type: K, handler: Handler<E[K]>): () => void;
  emit<K extends keyof E>(type: K, payload: E[K]): number;
  listenerCount(type: keyof E): number;
};

export function createBus<E>(): Bus<E> {
  const listeners: Listeners<E> = {};
  return {
    on(type, handler) {
      listeners[type] = [...(listeners[type] ?? []), handler];
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        const list = listeners[type] ?? [];
        const index = list.indexOf(handler);
        if (index !== -1) listeners[type] = list.toSpliced(index, 1);
      };
    },
    emit(type, payload) {
      const list = listeners[type] ?? [];
      for (const handler of list) handler(payload);
      return list.length;
    },
    listenerCount(type) {
      return listeners[type]?.length ?? 0;
    },
  };
}
```
:::
