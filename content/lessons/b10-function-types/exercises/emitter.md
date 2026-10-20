---
kind: challenge
title: 消息订阅器
---
实现 `createEmitter()`，返回一个简单的消息订阅器。先定义并导出两个类型：

```ts
type Listener = (message: string) => void;
type Emitter = {
  on: (listener: Listener) => () => void;
  once: (listener: Listener) => () => void;
  emit: (message: string) => number;
};
```

规则：

- `on(listener)`：注册监听函数，返回一个**取消函数**。调用取消函数移除这一次注册；多次调用取消函数没有额外效果。
- 同一个函数可以注册多次，每次注册各自独立：被注册两次就会被调用两次，取消其中一次不影响另一次。
- `once(listener)`：注册一个只会被调用一次的监听函数（第一次 `emit` 之后自动移除）；同样返回取消函数。
- `emit(message)`：按注册顺序调用**这次 `emit` 开始时**已注册的所有监听函数，返回调用的个数。监听函数在被调用时取消自己或别人的注册、或者注册新的监听函数，都不影响这一轮已经确定的调用名单——但已经被取消、还没轮到的监听函数不应再被调用。

:::files{role=starter}
```ts file=emitter.ts
export type Listener = (message: string) => void;

export type Emitter = {
  on: (listener: Listener) => () => void;
  once: (listener: Listener) => () => void;
  emit: (message: string) => number;
};

export function createEmitter(): Emitter {
  const listeners: Listener[] = [];
  return {
    on: (listener) => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        listeners.splice(index, 1);
      };
    },
    once: (listener) => () => {},
    emit: (message) => {
      listeners.forEach((listener) => listener(message));
      return listeners.length;
    },
  };
}
```
:::

:::files{role=solution}
```ts file=emitter.ts
export type Listener = (message: string) => void;

export type Emitter = {
  on: (listener: Listener) => () => void;
  once: (listener: Listener) => () => void;
  emit: (message: string) => number;
};

type Registration = { listener: Listener; once: boolean; active: boolean };

export function createEmitter(): Emitter {
  let registrations: Registration[] = [];

  function add(listener: Listener, once: boolean): () => void {
    const registration: Registration = { listener, once, active: true };
    registrations.push(registration);
    return () => {
      registration.active = false;
      registrations = registrations.filter((r) => r !== registration);
    };
  }

  return {
    on: (listener) => add(listener, false),
    once: (listener) => add(listener, true),
    emit: (message) => {
      const snapshot = [...registrations];
      let called = 0;
      for (const registration of snapshot) {
        if (!registration.active) {
          continue;
        }
        if (registration.once) {
          registration.active = false;
          registrations = registrations.filter((r) => r !== registration);
        }
        registration.listener(message);
        called++;
      }
      return called;
    },
  };
}
```
:::

:::files{role=tests}
```ts file=emitter.test.ts
import { describe, expect, test, vi } from 'vitest';
import { createEmitter } from './emitter';

describe('createEmitter', () => {
  test('按注册顺序调用，返回调用个数', () => {
    const emitter = createEmitter();
    const log: string[] = [];
    emitter.on((m) => log.push(`A:${m}`));
    emitter.on((m) => log.push(`B:${m}`));
    expect(emitter.emit('hi')).toBe(2);
    expect(log).toEqual(['A:hi', 'B:hi']);
  });

  test('不需要参数的监听函数也可以注册', () => {
    const emitter = createEmitter();
    let count = 0;
    emitter.on(() => {
      count++;
    });
    emitter.emit('x');
    expect(count).toBe(1);
  });

  test('取消注册', () => {
    const emitter = createEmitter();
    const fn = vi.fn();
    const off = emitter.on(fn);
    off();
    off();
    expect(emitter.emit('x')).toBe(0);
    expect(fn).not.toHaveBeenCalled();
  });

  test('同一个函数注册两次是两次独立的注册', () => {
    const emitter = createEmitter();
    const fn = vi.fn();
    const offFirst = emitter.on(fn);
    emitter.on(fn);
    expect(emitter.emit('a')).toBe(2);
    offFirst();
    expect(emitter.emit('b')).toBe(1);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test('once 只调用一次，也可以提前取消', () => {
    const emitter = createEmitter();
    const fn = vi.fn();
    emitter.once(fn);
    emitter.emit('a');
    emitter.emit('b');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');

    const never = vi.fn();
    const off = emitter.once(never);
    off();
    emitter.emit('c');
    expect(never).not.toHaveBeenCalled();
  });

  test('监听函数在调用时取消自己，不会影响下一个', () => {
    const emitter = createEmitter();
    const log: string[] = [];
    const offA = emitter.on(() => {
      log.push('A');
      offA();
    });
    emitter.on(() => log.push('B'));
    emitter.emit('x');
    emitter.emit('y');
    expect(log).toEqual(['A', 'B', 'B']);
  });

  test('调用期间新注册的监听函数从下一轮开始生效', () => {
    const emitter = createEmitter();
    const late = vi.fn();
    emitter.on(() => {
      emitter.on(late);
    });
    expect(emitter.emit('1')).toBe(1);
    expect(late).not.toHaveBeenCalled();
    emitter.emit('2');
    expect(late).toHaveBeenCalledTimes(1);
  });

  test('被前面的监听函数取消的，本轮不再调用', () => {
    const emitter = createEmitter();
    const second = vi.fn();
    let offSecond = (): void => {};
    emitter.on(() => offSecond());
    offSecond = emitter.on(second);
    expect(emitter.emit('x')).toBe(1);
    expect(second).not.toHaveBeenCalled();
  });
});
```
```ts file=emitter.test-d.ts
import { expectTypeOf } from 'vitest';
import { createEmitter, type Listener } from './emitter';

expectTypeOf<Listener>().toEqualTypeOf<(message: string) => void>();
const emitter = createEmitter();
expectTypeOf(emitter.on).parameter(0).toEqualTypeOf<Listener>();
expectTypeOf(emitter.emit).returns.toEqualTypeOf<number>();
```
:::

:::hint{level=1}
起始代码有几个问题：取消时按函数查找，同一个函数注册两次就分不清；遍历时直接遍历会被修改的数组；`once` 没有实现。给每一次注册创建一个独立的对象（记录监听函数、是否 `once`、是否仍然有效），取消时移除的是这个对象。
:::

:::hint{level=2}
`emit` 开始时复制一份注册列表 `[...registrations]` 作为本轮名单；遍历时跳过已经失效的注册。取消函数把注册对象标记为失效，并从列表中移除。`once` 的注册在调用前先标记失效并移除。
:::

:::explanation
这道题的关键在于“一次注册”是一个独立的对象，而不是“一个函数”。用 `indexOf(listener)` 查找时，同一个函数注册两次就无法区分；`indexOf` 找不到时返回 `-1`，`splice(-1, 1)` 还会删掉最后一个元素（a10）——起始代码多次调用取消函数就会误删别人的注册。

遍历时，监听函数可能修改注册列表。如果直接遍历原数组，取消自己会让后面的元素前移一位，下一个监听函数被跳过。所以 `emit` 先复制一份本轮名单；同时用 `active` 标记处理“本轮中被取消、还没轮到”的情况。

类型方面，`Listener` 是 `(message: string) => void`。因为参数更少的函数可以赋给它，`() => { count++; }` 这样不需要消息的监听函数也能直接注册；返回值是 `void`，所以 `(m) => log.push(m)` 返回了数字也没关系（b06）。
:::

:::variant{kind=alt name=map-of-ids}
```ts file=emitter.ts
export type Listener = (message: string) => void;

export type Emitter = {
  on: (listener: Listener) => () => void;
  once: (listener: Listener) => () => void;
  emit: (message: string) => number;
};

export function createEmitter(): Emitter {
  const registry = new Map<number, { listener: Listener; once: boolean }>();
  let nextId = 0;

  const register = (listener: Listener, once: boolean) => {
    const id = nextId++;
    registry.set(id, { listener, once });
    return () => {
      registry.delete(id);
    };
  };

  return {
    on: (listener) => register(listener, false),
    once: (listener) => register(listener, true),
    emit: (message) => {
      let called = 0;
      for (const id of [...registry.keys()]) {
        const entry = registry.get(id);
        if (entry === undefined) continue;
        if (entry.once) registry.delete(id);
        entry.listener(message);
        called++;
      }
      return called;
    },
  };
}
```
:::

:::variant{kind=wrong name=remove-by-function fails=tests reason="按函数移除，同一个函数注册两次时取消一次就全部移除了"}
```ts file=emitter.ts
export type Listener = (message: string) => void;

export type Emitter = {
  on: (listener: Listener) => () => void;
  once: (listener: Listener) => () => void;
  emit: (message: string) => number;
};

export function createEmitter(): Emitter {
  let listeners: { fn: Listener; once: boolean }[] = [];
  const add = (fn: Listener, once: boolean) => {
    listeners.push({ fn, once });
    return () => {
      listeners = listeners.filter((l) => l.fn !== fn);
    };
  };
  return {
    on: (fn) => add(fn, false),
    once: (fn) => add(fn, true),
    emit: (message) => {
      const round = [...listeners];
      listeners = listeners.filter((l) => !l.once);
      round.forEach((l) => l.fn(message));
      return round.length;
    },
  };
}
```
:::

:::variant{kind=wrong name=iterate-live-array fails=tests reason="遍历时直接遍历被修改的数组，监听函数取消自己后下一个被跳过"}
```ts file=emitter.ts
export type Listener = (message: string) => void;

export type Emitter = {
  on: (listener: Listener) => () => void;
  once: (listener: Listener) => () => void;
  emit: (message: string) => number;
};

type Registration = { listener: Listener; once: boolean };

export function createEmitter(): Emitter {
  const registrations: Registration[] = [];
  const add = (listener: Listener, once: boolean) => {
    const registration: Registration = { listener, once };
    registrations.push(registration);
    return () => {
      const index = registrations.indexOf(registration);
      if (index >= 0) registrations.splice(index, 1);
    };
  };
  return {
    on: (listener) => add(listener, false),
    once: (listener) => add(listener, true),
    emit: (message) => {
      let called = 0;
      for (let i = 0; i < registrations.length; i++) {
        const registration = registrations[i];
        if (registration === undefined) continue;
        if (registration.once) {
          registrations.splice(i, 1);
          i--;
        }
        registration.listener(message);
        called++;
      }
      return called;
    },
  };
}
```
:::

:::variant{kind=wrong name=snapshot-without-active fails=tests reason="复制了名单，但没有跳过本轮中已被取消的监听函数"}
```ts file=emitter.ts
export type Listener = (message: string) => void;

export type Emitter = {
  on: (listener: Listener) => () => void;
  once: (listener: Listener) => () => void;
  emit: (message: string) => number;
};

type Registration = { listener: Listener; once: boolean };

export function createEmitter(): Emitter {
  let registrations: Registration[] = [];
  const add = (listener: Listener, once: boolean) => {
    const registration: Registration = { listener, once };
    registrations.push(registration);
    return () => {
      registrations = registrations.filter((r) => r !== registration);
    };
  };
  return {
    on: (listener) => add(listener, false),
    once: (listener) => add(listener, true),
    emit: (message) => {
      const round = [...registrations];
      registrations = registrations.filter((r) => !r.once);
      for (const r of round) r.listener(message);
      return round.length;
    },
  };
}
```
:::
