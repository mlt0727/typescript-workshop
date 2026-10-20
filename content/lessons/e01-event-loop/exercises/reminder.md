---
kind: task
title: 可以取消的提醒
---
`createReminder(callback, ms)` 安排在 `ms` 毫秒后调用一次 `callback`，并返回一个对象：

- `cancel()`：取消提醒。如果提醒还没触发，取消它并返回 `true`；如果已经触发过、或者已经取消过，返回 `false`。
- `fired`：getter，提醒是否已经触发。

起始代码能安排提醒，但没法取消。补全它。

:::files{role=starter}
```ts file=reminder.ts
export function createReminder(callback: () => void, ms: number) {
  setTimeout(callback, ms);
  return {
    cancel: () => false,
    get fired() {
      return false;
    },
  };
}
```
:::

:::files{role=solution}
```ts file=reminder.ts
export function createReminder(callback: () => void, ms: number) {
  let fired = false;
  let cancelled = false;
  const timer = setTimeout(() => {
    fired = true;
    callback();
  }, ms);

  return {
    cancel(): boolean {
      if (fired || cancelled) {
        return false;
      }
      clearTimeout(timer);
      cancelled = true;
      return true;
    },
    get fired(): boolean {
      return fired;
    },
  };
}
```
:::

:::files{role=tests}
```ts file=reminder.test.ts
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createReminder } from './reminder';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test('到时间后调用一次', () => {
  const callback = vi.fn();
  const reminder = createReminder(callback, 1000);
  vi.advanceTimersByTime(999);
  expect(callback).not.toHaveBeenCalled();
  expect(reminder.fired).toBe(false);
  vi.advanceTimersByTime(1);
  expect(callback).toHaveBeenCalledTimes(1);
  expect(reminder.fired).toBe(true);
});

test('触发前取消', () => {
  const callback = vi.fn();
  const reminder = createReminder(callback, 1000);
  expect(reminder.cancel()).toBe(true);
  vi.advanceTimersByTime(5000);
  expect(callback).not.toHaveBeenCalled();
  expect(reminder.fired).toBe(false);
});

test('重复取消、触发后取消都返回 false', () => {
  const first = createReminder(() => {}, 100);
  expect(first.cancel()).toBe(true);
  expect(first.cancel()).toBe(false);

  const second = createReminder(() => {}, 100);
  vi.advanceTimersByTime(100);
  expect(second.cancel()).toBe(false);
});
```
:::

:::hint{level=1}
保存 `setTimeout` 返回的编号，`cancel` 时把它交给 `clearTimeout`。另外用两个闭包变量（a14）记录“是否已经触发”“是否已经取消”。
:::

:::hint{level=2}
`const timer = setTimeout(() => { fired = true; callback(); }, ms);`。`cancel` 里先判断 `if (fired || cancelled) return false;`，再 `clearTimeout(timer); cancelled = true; return true;`。
:::

:::explanation
`setTimeout` 返回的编号是取消定时器的唯一凭据，要保存下来。触发和取消这两种状态用闭包变量记录：定时器回调把 `fired` 设为 `true`，`cancel` 根据两个状态决定返回值。

测试使用了假计时器：`vi.advanceTimersByTime(999)` 让时间“快进”999 毫秒，此时提醒还不应该触发；再快进 1 毫秒，回调被调用。这样不用真的等待，测试也完全确定。
:::

:::variant{kind=alt name=nullable-timer}
```ts file=reminder.ts
export function createReminder(callback: () => void, ms: number) {
  let pending: number | null = setTimeout(() => {
    pending = null;
    done = true;
    callback();
  }, ms);
  let done = false;

  return {
    cancel(): boolean {
      if (pending === null) return false;
      clearTimeout(pending);
      pending = null;
      return true;
    },
    get fired(): boolean {
      return done;
    },
  };
}
```
:::

:::variant{kind=wrong name=no-clear fails=tests reason="cancel 只修改了标记，没有真正取消定时器"}
```ts file=reminder.ts
export function createReminder(callback: () => void, ms: number) {
  let fired = false;
  let cancelled = false;
  setTimeout(() => {
    fired = true;
    callback();
  }, ms);
  return {
    cancel(): boolean {
      if (fired || cancelled) return false;
      cancelled = true;
      return true;
    },
    get fired(): boolean {
      return fired;
    },
  };
}
```
:::

:::variant{kind=wrong name=always-true fails=tests reason="已经触发或已经取消时，cancel 仍然返回 true"}
```ts file=reminder.ts
export function createReminder(callback: () => void, ms: number) {
  let fired = false;
  const timer = setTimeout(() => {
    fired = true;
    callback();
  }, ms);
  return {
    cancel(): boolean {
      clearTimeout(timer);
      return true;
    },
    get fired(): boolean {
      return fired;
    },
  };
}
```
:::
