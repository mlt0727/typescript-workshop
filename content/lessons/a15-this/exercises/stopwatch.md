---
kind: challenge
title: 可以拆开使用的秒表
---
实现 `createStopwatch(now)`，返回一个秒表对象。`now` 是一个返回当前时间（毫秒）的函数，测试会传入一个可以控制的假时钟。

秒表有四个方法：

- `start()`：开始计时；已经在计时时，什么也不做。
- `stop()`：暂停计时，把这一段时间累计起来；没有在计时时，什么也不做。
- `elapsed()`：返回累计的毫秒数，**包括正在进行的这一段**。
- `reset()`：停止并清零。

**重要**：界面代码会把方法单独取出来当作按钮的回调，例如 `const { start, stop } = watch;` 之后直接调用 `start()`。所以这些方法不能依赖 `this`。

:::files{role=starter}
```ts file=stopwatch.ts
type Stopwatch = {
  start: () => void;
  stop: () => void;
  elapsed: () => number;
  reset: () => void;
};

export function createStopwatch(now: () => number): Stopwatch {
  const watch = {
    total: 0,
    startedAt: 0,
    start() {
      this.startedAt = now();
    },
    stop() {
      this.total += now() - this.startedAt;
    },
    elapsed() {
      return this.total;
    },
    reset() {
      this.total = 0;
    },
  };
  return watch;
}
```
:::

:::files{role=solution}
```ts file=stopwatch.ts
type Stopwatch = {
  start: () => void;
  stop: () => void;
  elapsed: () => number;
  reset: () => void;
};

export function createStopwatch(now: () => number): Stopwatch {
  let total = 0;
  let startedAt: number | null = null;

  return {
    start: () => {
      if (startedAt === null) {
        startedAt = now();
      }
    },
    stop: () => {
      if (startedAt !== null) {
        total += now() - startedAt;
        startedAt = null;
      }
    },
    elapsed: () => (startedAt === null ? total : total + (now() - startedAt)),
    reset: () => {
      total = 0;
      startedAt = null;
    },
  };
}
```
:::

:::files{role=tests}
```ts file=stopwatch.test.ts
import { describe, expect, test } from 'vitest';
import { createStopwatch } from './stopwatch';

function fakeClock() {
  let time = 1000;
  return {
    now: () => time,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

describe('createStopwatch', () => {
  test('计时、暂停、继续', () => {
    const clock = fakeClock();
    const watch = createStopwatch(clock.now);
    watch.start();
    clock.advance(300);
    watch.stop();
    clock.advance(5000);
    expect(watch.elapsed()).toBe(300);
    watch.start();
    clock.advance(200);
    watch.stop();
    expect(watch.elapsed()).toBe(500);
  });

  test('elapsed 包含正在进行的一段', () => {
    const clock = fakeClock();
    const watch = createStopwatch(clock.now);
    watch.start();
    clock.advance(150);
    expect(watch.elapsed()).toBe(150);
  });

  test('方法可以单独取出使用', () => {
    const clock = fakeClock();
    const { start, stop, elapsed, reset } = createStopwatch(clock.now);
    start();
    clock.advance(400);
    stop();
    expect(elapsed()).toBe(400);
    reset();
    expect(elapsed()).toBe(0);
  });

  test('重复 start 不会重新开始计时', () => {
    const clock = fakeClock();
    const watch = createStopwatch(clock.now);
    watch.start();
    clock.advance(100);
    watch.start();
    clock.advance(100);
    expect(watch.elapsed()).toBe(200);
  });

  test('没有开始就 stop 什么也不做', () => {
    const clock = fakeClock();
    const watch = createStopwatch(clock.now);
    watch.stop();
    clock.advance(100);
    watch.stop();
    expect(watch.elapsed()).toBe(0);
  });

  test('reset 会停止计时', () => {
    const clock = fakeClock();
    const watch = createStopwatch(clock.now);
    watch.start();
    clock.advance(100);
    watch.reset();
    clock.advance(100);
    expect(watch.elapsed()).toBe(0);
  });

  test('两个秒表互不影响', () => {
    const clock = fakeClock();
    const a = createStopwatch(clock.now);
    const b = createStopwatch(clock.now);
    a.start();
    clock.advance(100);
    b.start();
    clock.advance(50);
    expect(a.elapsed()).toBe(150);
    expect(b.elapsed()).toBe(50);
  });
});
```
:::

:::hint{level=1}
不依赖 `this` 的办法是 a14 的闭包：把 `total` 和 `startedAt` 放在 `createStopwatch` 里的局部变量中，返回的四个函数都直接读写这两个变量。
:::

:::hint{level=2}
`let total = 0; let startedAt: number | null = null;`。`start` 只在 `startedAt === null` 时记录 `now()`；`stop` 只在 `startedAt !== null` 时把 `now() - startedAt` 加到 `total`；`elapsed` 在计时中时返回 `total + (now() - startedAt)`。
:::

:::explanation
起始代码能通过类型检查，但有几个问题：方法依赖 `this`，`const { start } = watch; start()` 时 `this` 是 `undefined`，运行时抛出 `TypeError`（TypeScript 发现不了）；它没有记录“是否正在计时”，重复 `start`、没开始就 `stop` 都会算错；`elapsed` 也没有包含正在进行的一段。另外，`total` 和 `startedAt` 仍然是返回对象上的属性，外部代码可以绕过方法直接修改它们。

参考答案改用闭包保存状态：四个箭头函数直接读写 `createStopwatch` 内部的 `total` 和 `startedAt`，完全不使用 `this`，所以无论怎样调用都正确。状态也不再暴露在返回的对象上，外部只能通过这四个函数操作它。

`startedAt` 的类型是 `number | null`：`null` 表示“没有在计时”。每次使用它之前都要检查（a05），这正好也实现了“重复 `start` 无效、没开始就 `stop` 无效”的规则。

把时钟作为参数 `now` 传入（而不是在函数里直接调用 `Date.now()`），测试就可以用假时钟精确控制时间。这种写法叫**依赖注入**，F 阶段的测试课还会遇到。
:::

:::variant{kind=alt name=state-object}
```ts file=stopwatch.ts
type Stopwatch = {
  start: () => void;
  stop: () => void;
  elapsed: () => number;
  reset: () => void;
};

export function createStopwatch(now: () => number): Stopwatch {
  const state: { total: number; startedAt: number | null } = { total: 0, startedAt: null };

  function running(): number {
    return state.startedAt === null ? 0 : now() - state.startedAt;
  }

  return {
    start() {
      state.startedAt ??= now();
    },
    stop() {
      state.total += running();
      state.startedAt = null;
    },
    elapsed() {
      return state.total + running();
    },
    reset() {
      state.total = 0;
      state.startedAt = null;
    },
  };
}
```
:::

:::variant{kind=wrong name=uses-this fails=tests reason="方法依赖 this，单独取出调用时出错"}
```ts file=stopwatch.ts
type Stopwatch = {
  start: () => void;
  stop: () => void;
  elapsed: () => number;
  reset: () => void;
};

export function createStopwatch(now: () => number): Stopwatch {
  const watch = {
    total: 0,
    startedAt: -1,
    start() {
      if (this.startedAt === -1) this.startedAt = now();
    },
    stop() {
      if (this.startedAt !== -1) {
        this.total += now() - this.startedAt;
        this.startedAt = -1;
      }
    },
    elapsed() {
      return this.startedAt === -1 ? this.total : this.total + (now() - this.startedAt);
    },
    reset() {
      this.total = 0;
      this.startedAt = -1;
    },
  };
  return watch;
}
```
:::

:::variant{kind=wrong name=restart-on-start fails=tests reason="重复 start 时重新记录了开始时间，丢失了已经计过的时间"}
```ts file=stopwatch.ts
type Stopwatch = {
  start: () => void;
  stop: () => void;
  elapsed: () => number;
  reset: () => void;
};

export function createStopwatch(now: () => number): Stopwatch {
  let total = 0;
  let startedAt: number | null = null;
  return {
    start: () => {
      startedAt = now();
    },
    stop: () => {
      if (startedAt !== null) {
        total += now() - startedAt;
        startedAt = null;
      }
    },
    elapsed: () => (startedAt === null ? total : total + (now() - startedAt)),
    reset: () => {
      total = 0;
      startedAt = null;
    },
  };
}
```
:::

:::variant{kind=wrong name=no-running-segment fails=tests reason="elapsed 没有包含正在进行的这一段"}
```ts file=stopwatch.ts
type Stopwatch = {
  start: () => void;
  stop: () => void;
  elapsed: () => number;
  reset: () => void;
};

export function createStopwatch(now: () => number): Stopwatch {
  let total = 0;
  let startedAt: number | null = null;
  return {
    start: () => {
      if (startedAt === null) startedAt = now();
    },
    stop: () => {
      if (startedAt !== null) {
        total += now() - startedAt;
        startedAt = null;
      }
    },
    elapsed: () => total,
    reset: () => {
      total = 0;
      startedAt = null;
    },
  };
}
```
:::
