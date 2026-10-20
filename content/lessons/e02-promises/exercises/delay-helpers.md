---
kind: task
title: 把定时器包装成 Promise
---
实现两个基于 `setTimeout` 的工具函数：

- `delay(ms, value)`：返回一个 Promise，`ms` 毫秒后兑现为 `value`。它是泛型函数：`delay(100, 'ok')` 的类型是 `Promise<string>`。
- `failAfter(ms, message)`：返回一个 Promise，`ms` 毫秒后以 `new Error(message)` 拒绝。它永远不会兑现，所以类型是 `Promise<never>`。

:::files{role=starter}
```ts file=delay.ts
export function delay(ms: number, value: unknown) {
  setTimeout(() => value, ms);
}

export function failAfter(ms: number, message: string) {
  throw new Error(message);
}
```
:::

:::files{role=solution}
```ts file=delay.ts
export function delay<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });
}

export function failAfter(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}
```
:::

:::files{role=tests}
```ts file=delay.test.ts
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { delay, failAfter } from './delay';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test('delay 在指定时间后兑现', async () => {
  let result: string | undefined;
  delay(1000, 'ok').then((value) => {
    result = value;
  });
  await vi.advanceTimersByTimeAsync(999);
  expect(result).toBeUndefined();
  await vi.advanceTimersByTimeAsync(1);
  expect(result).toBe('ok');
});

test('failAfter 在指定时间后拒绝', async () => {
  let message = '';
  failAfter(500, '超时').catch((err: unknown) => {
    message = err instanceof Error ? err.message : '不是 Error';
  });
  await vi.advanceTimersByTimeAsync(499);
  expect(message).toBe('');
  await vi.advanceTimersByTimeAsync(1);
  expect(message).toBe('超时');
});

test('调用时不会立即抛出', () => {
  expect(() => failAfter(10, 'x').catch(() => {})).not.toThrow();
});
```
```ts file=delay.test-d.ts
import { expectTypeOf } from 'vitest';
import { delay, failAfter } from './delay';

expectTypeOf(delay(1, 'ok')).toEqualTypeOf<Promise<string>>();
expectTypeOf(delay(1, 42)).toEqualTypeOf<Promise<number>>();
expectTypeOf(failAfter(1, 'x')).toEqualTypeOf<Promise<never>>();
```
:::

:::hint{level=1}
用 `new Promise((resolve, reject) => { … })` 包装 `setTimeout`：定时器到点时调用 `resolve(value)` 或 `reject(new Error(message))`。`delay` 需要一个类型参数 `T`（b14）。
:::

:::hint{level=2}
`return new Promise((resolve) => { setTimeout(() => resolve(value), ms); });`。`failAfter` 的执行函数只用到第二个参数，第一个参数可以写成 `_`。
:::

:::explanation
`new Promise(执行函数)` 是把回调风格的 API 变成 Promise 的标准写法：执行函数立即运行，安排好定时器；定时器到点后调用 `resolve` 或 `reject`，Promise 的状态才确定下来。

`failAfter` 不能直接 `throw`：那样错误会在调用时同步抛出，而不是在 `ms` 毫秒后以 Promise 拒绝的形式出现。返回类型 `Promise<never>` 表示它永远不会兑现（b06 的 `never`）。

测试中的 `vi.advanceTimersByTimeAsync` 在快进时间的同时，让 Promise 的回调（微任务）有机会执行。测试代码用到了下一课才讲的 `async`/`await`：现在可以先把 `await x` 读作“等 `x` 完成再继续”。
:::

:::variant{kind=alt name=named-executor}
```ts file=delay.ts
export function delay<Value>(ms: number, value: Value): Promise<Value> {
  return new Promise<Value>(function (resolve) {
    setTimeout(resolve, ms, value);
  });
}

export function failAfter(ms: number, message: string): Promise<never> {
  return delay(ms, message).then((text) => {
    throw new Error(text);
  });
}
```
:::

:::variant{kind=wrong name=sync-throw fails=tests reason="failAfter 同步抛出了错误，而不是返回一个稍后拒绝的 Promise"}
```ts file=delay.ts
export function delay<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function failAfter(ms: number, message: string): Promise<never> {
  throw new Error(message);
}
```
:::

:::variant{kind=wrong name=unknown-value fails=types reason="没有用泛型，delay 返回 Promise<unknown>"}
```ts file=delay.ts
export function delay(ms: number, value: unknown): Promise<unknown> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function failAfter(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}
```
:::

:::variant{kind=wrong name=resolve-immediately fails=tests reason="立即兑现，没有等待定时器"}
```ts file=delay.ts
export function delay<T>(ms: number, value: T): Promise<T> {
  setTimeout(() => {}, ms);
  return Promise.resolve(value);
}

export function failAfter(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}
```
:::

:::variant{kind=wrong name=reject-immediately fails=tests reason="failAfter 立刻返回被拒绝的 Promise，没有等到指定时间"}
```ts file=delay.ts
export function delay<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });
}

export function failAfter(ms: number, message: string): Promise<never> {
  return Promise.reject(new Error(message));
}
```
:::
