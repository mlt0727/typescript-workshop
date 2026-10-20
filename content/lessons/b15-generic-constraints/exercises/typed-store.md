---
kind: challenge
title: 类型安全的状态存储
---
实现 `createStore(initial)`，返回一个通用的状态存储，适用于任何对象形状的状态：

- `get(key)`：返回 `key` 当前的值，类型是该键对应的值类型；
- `set(key, value)`：`value` 的类型必须和该键对应；值没有变化时（`Object.is` 判断相等）什么也不做；否则保存新值，并通知订阅了这个键的监听函数 `(newValue, oldValue)`；
- `subscribe(key, listener)`：订阅某个键的变化，返回取消订阅的函数；
- `snapshot()`：返回当前完整状态的**浅拷贝**。

`createStore` 要复制一份 `initial`，之后修改 `initial` 不影响存储。

和 b11 的挑战比较：这里不再为每个键写重载，而是用 `K extends keyof T` 一个签名描述所有键。

:::files{role=starter}
```ts file=store.ts
export function createStore(initial: object) {
  const state = initial;
  return {
    get: (key: string) => state[key],
    set: (key: string, value: unknown) => {},
    subscribe: (key: string, listener: (value: unknown) => void) => () => {},
    snapshot: () => state,
  };
}
```
:::

:::files{role=solution}
```ts file=store.ts
export function createStore<T extends object>(initial: T) {
  const state: T = { ...initial };
  const subscribers: { key: keyof T; notify: (previous: T) => void }[] = [];

  function get<K extends keyof T>(key: K): T[K] {
    return state[key];
  }

  function set<K extends keyof T>(key: K, value: T[K]): void {
    if (Object.is(state[key], value)) {
      return;
    }
    const previous: T = { ...state };
    state[key] = value;
    for (const subscriber of [...subscribers]) {
      if (subscriber.key === key) {
        subscriber.notify(previous);
      }
    }
  }

  function subscribe<K extends keyof T>(key: K, listener: (newValue: T[K], oldValue: T[K]) => void): () => void {
    const subscriber = { key: key, notify: (previous: T) => listener(state[key], previous[key]) };
    subscribers.push(subscriber);
    return () => {
      const index = subscribers.indexOf(subscriber);
      if (index >= 0) {
        subscribers.splice(index, 1);
      }
    };
  }

  function snapshot(): T {
    return { ...state };
  }

  return { get, set, subscribe, snapshot };
}
```
:::

:::files{role=tests}
```ts file=store.test.ts
import { describe, expect, test, vi } from 'vitest';
import { createStore } from './store';

function initial() {
  return { count: 0, user: 'Ada', tags: ['a'] };
}

describe('createStore', () => {
  test('读取与修改', () => {
    const store = createStore(initial());
    expect(store.get('count')).toBe(0);
    store.set('count', 5);
    store.set('user', 'Grace');
    expect(store.get('count')).toBe(5);
    expect(store.snapshot()).toEqual({ count: 5, user: 'Grace', tags: ['a'] });
  });

  test('通知订阅了该键的监听函数', () => {
    const store = createStore(initial());
    const onCount = vi.fn();
    const onUser = vi.fn();
    store.subscribe('count', onCount);
    store.subscribe('user', onUser);
    store.set('count', 1);
    expect(onCount).toHaveBeenCalledWith(1, 0);
    expect(onUser).not.toHaveBeenCalled();
  });

  test('值没有变化时不通知', () => {
    const store = createStore(initial());
    const onCount = vi.fn();
    store.subscribe('count', onCount);
    store.set('count', 0);
    expect(onCount).not.toHaveBeenCalled();
  });

  test('取消订阅', () => {
    const store = createStore(initial());
    const onCount = vi.fn();
    const off = store.subscribe('count', onCount);
    off();
    store.set('count', 2);
    expect(onCount).not.toHaveBeenCalled();
  });

  test('与 initial 互不影响，snapshot 是拷贝', () => {
    const start = initial();
    const store = createStore(start);
    start.count = 99;
    expect(store.get('count')).toBe(0);
    const snap = store.snapshot();
    snap.count = 42;
    expect(store.get('count')).toBe(0);
  });
});
```
```ts file=store.test-d.ts
import { expectTypeOf } from 'vitest';
import { createStore } from './store';

const store = createStore({ count: 0, user: 'Ada', ready: false });

expectTypeOf(store.get('count')).toEqualTypeOf<number>();
expectTypeOf(store.get('user')).toEqualTypeOf<string>();
expectTypeOf(store.snapshot()).toEqualTypeOf<{ count: number; user: string; ready: boolean }>();

store.subscribe('ready', (now, before) => {
  expectTypeOf(now).toEqualTypeOf<boolean>();
  expectTypeOf(before).toEqualTypeOf<boolean>();
});

// @ts-expect-error count 必须是数字
store.set('count', '1');
// @ts-expect-error 没有这个键
store.get('missing');
```
:::

:::hint{level=1}
给 `createStore` 加类型参数 `T extends object`，`initial: T`。三个方法各自再声明 `<K extends keyof T>`：`get(key: K): T[K]`，`set(key: K, value: T[K])`，`subscribe(key: K, listener: (newValue: T[K], oldValue: T[K]) => void)`。
:::

:::hint{level=2}
难点是保存监听函数：不同键的监听函数参数类型不同，放进同一个数组或 `Map` 时，TypeScript 记不住“哪个键对应哪种参数”。办法是在 `subscribe` 里——这时 `K` 和 `T[K]` 都是确定的——把监听函数包装成一个统一类型的闭包，例如 `(previous: T) => listener(state[key], previous[key])`，存储时只保存这个闭包和它的键。`set` 在修改前先保存一份 `previous`，修改后调用对应键的闭包。
:::

:::explanation
`T extends object` 让存储适用于任何对象形状的状态；三个方法上的 `K extends keyof T` 把“键”和“值的类型”绑定在一起：`set('count', '1')` 找不到匹配，在编译期被拒绝；`subscribe('ready', …)` 的回调参数自动是 `boolean`。

真正的难点在于保存监听函数：一个 `Map<keyof T, …>` 无法记住“这个键对应这种参数类型”。如果把它们存成某个宽泛的类型，调用时就不得不用类型断言把类型“找回来”——断言只是“相信我”，判题规则也不允许。参考答案换了个思路：在 `subscribe` 内部，`K` 和 `T[K]` 都是已知的，于是把监听函数包装成一个只需要 `previous: T` 的闭包（a14）。闭包自己知道该取哪个键、参数是什么类型，存储时所有闭包的类型都一样，整个实现不需要任何断言。

`set` 先用 `Object.is` 判断值是否变化（它把 `NaN` 视为等于自身），再保存修改前的状态 `previous`，通知时闭包从 `previous` 里取旧值、从 `state` 里取新值。遍历时复制订阅列表，和 b10 的订阅器一样，避免监听函数在回调中取消订阅导致跳过别人。

这类“类型系统难以直接表达、需要在实现内部换个结构”的情况在库代码中很常见，关键是让**对外的签名**保持精确。
:::

:::variant{kind=alt name=grouped-by-key}
```ts file=store.ts
export function createStore<T extends object>(initial: T) {
  const state: T = { ...initial };
  const byKey = new Map<keyof T, Set<(previous: T) => void>>();

  const get = <K extends keyof T>(key: K): T[K] => state[key];

  function set<K extends keyof T>(key: K, value: T[K]): void {
    if (Object.is(state[key], value)) return;
    const previous = { ...state };
    state[key] = value;
    for (const notify of [...(byKey.get(key) ?? [])]) notify(previous);
  }

  function subscribe<K extends keyof T>(key: K, listener: (newValue: T[K], oldValue: T[K]) => void): () => void {
    const notify = (previous: T) => listener(state[key], previous[key]);
    const group = byKey.get(key) ?? new Set<(previous: T) => void>();
    group.add(notify);
    byKey.set(key, group);
    return () => {
      group.delete(notify);
    };
  }

  return { get, set, subscribe, snapshot: (): T => ({ ...state }) };
}
```
:::

:::variant{kind=wrong name=string-keys fails=types reason="键用了 string，值用了 unknown，调用方失去了所有类型信息"}
```ts file=store.ts
export function createStore(initial: Record<string, unknown>) {
  const state: Record<string, unknown> = { ...initial };
  const subs: { key: string; fn: (v: unknown, o: unknown) => void }[] = [];
  return {
    get: (key: string) => state[key],
    set: (key: string, value: unknown) => {
      const old = state[key];
      if (Object.is(old, value)) return;
      state[key] = value;
      for (const s of [...subs]) if (s.key === key) s.fn(value, old);
    },
    subscribe: (key: string, fn: (v: unknown, o: unknown) => void) => {
      const entry = { key, fn };
      subs.push(entry);
      return () => {
        subs.splice(subs.indexOf(entry), 1);
      };
    },
    snapshot: () => ({ ...state }),
  };
}
```
:::

:::variant{kind=wrong name=no-copy fails=tests reason="没有复制 initial，snapshot 也返回了内部对象"}
```ts file=store.ts
export function createStore<T extends object>(initial: T) {
  const state: T = initial;
  const subscribers: { key: keyof T; notify: (old: T) => void }[] = [];
  function get<K extends keyof T>(key: K): T[K] {
    return state[key];
  }
  function set<K extends keyof T>(key: K, value: T[K]): void {
    if (Object.is(state[key], value)) return;
    const before: T = { ...state };
    state[key] = value;
    for (const s of [...subscribers]) if (s.key === key) s.notify(before);
  }
  function subscribe<K extends keyof T>(key: K, listener: (newValue: T[K], oldValue: T[K]) => void): () => void {
    const entry = { key: key, notify: (old: T) => listener(state[key], old[key]) };
    subscribers.push(entry);
    return () => {
      subscribers.splice(subscribers.indexOf(entry), 1);
    };
  }
  return { get, set, subscribe, snapshot: (): T => state };
}
```
:::

:::variant{kind=wrong name=notify-unchanged fails=tests reason="值没有变化时也通知了监听函数"}
```ts file=store.ts
export function createStore<T extends object>(initial: T) {
  const state: T = { ...initial };
  const subscribers: { key: keyof T; notify: (old: T) => void }[] = [];
  function get<K extends keyof T>(key: K): T[K] {
    return state[key];
  }
  function set<K extends keyof T>(key: K, value: T[K]): void {
    const before: T = { ...state };
    state[key] = value;
    for (const s of [...subscribers]) if (s.key === key) s.notify(before);
  }
  function subscribe<K extends keyof T>(key: K, listener: (newValue: T[K], oldValue: T[K]) => void): () => void {
    const entry = { key: key, notify: (old: T) => listener(state[key], old[key]) };
    subscribers.push(entry);
    return () => {
      subscribers.splice(subscribers.indexOf(entry), 1);
    };
  }
  return { get, set, subscribe, snapshot: (): T => ({ ...state }) };
}
```
:::
