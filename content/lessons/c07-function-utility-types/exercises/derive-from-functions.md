---
kind: task
title: 从函数推导类型与计时包装
---
`api.ts`（只读）中有三个函数。在 `types.ts` 中：

1. 不要手写字段，从这些函数推导出三个类型：
   - **`Task`**：`loadTask` 完成时得到的任务对象；
   - **`SearchOptions`**：`searchTasks` 的第二个参数的类型，**不含** `undefined`；
   - **`NewTask`**：`createTask` 的第一个参数的类型；
2. 实现 **`withTiming(fn, report, now)`**：返回一个参数和返回值都与 `fn` 相同的新函数。每次调用时，用 `now()` 在调用 `fn` 前后各取一次时间，把差值交给 `report`；**`fn` 抛出异常时也要报告**，然后照常抛出。不能使用 `any`。

:::files{role=starter}
```ts file=types.ts
import type { createTask, loadTask, searchTasks } from './api';

export type Task = unknown;
export type SearchOptions = unknown;
export type NewTask = unknown;

export function withTiming(fn: (...args: unknown[]) => unknown, report: (ms: number) => void, now: () => number) {
  return fn;
}
```
```ts file=main.ts
import { createTask } from './api';
import { withTiming } from './types';

const timed = withTiming(createTask, (ms) => console.log(`用了 ${ms} 毫秒`), () => performance.now());
console.log(timed({ title: '写周报' }, Date.now()));
```
:::

:::files{role=support}
```ts file=api.ts readonly
export type Status = 'todo' | 'doing' | 'done';

export async function loadTask(id: string): Promise<{ id: string; title: string; status: Status; tags: string[] }> {
  return { id, title: '写周报', status: 'todo', tags: ['工作'] };
}

export async function searchTasks(query: string, options?: { status?: Status; limit?: number }): Promise<string[]> {
  const limit = options?.limit ?? 10;
  return ['t1', 't2', 't3'].filter((id) => id.includes(query)).slice(0, limit);
}

export function createTask(input: { title: string; tags?: string[] }, now: number): { id: string; createdAt: number } {
  return { id: `t${now}`, createdAt: now };
}
```
:::

:::files{role=solution}
```ts file=types.ts
import type { createTask, loadTask, searchTasks } from './api';

export type Task = Awaited<ReturnType<typeof loadTask>>;
export type SearchOptions = NonNullable<Parameters<typeof searchTasks>[1]>;
export type NewTask = Parameters<typeof createTask>[0];

export function withTiming<A extends unknown[], R>(
  fn: (...args: A) => R,
  report: (ms: number) => void,
  now: () => number,
): (...args: A) => R {
  return (...args) => {
    const start = now();
    try {
      return fn(...args);
    } finally {
      report(now() - start);
    }
  };
}
```
```ts file=main.ts
import { createTask } from './api';
import { withTiming } from './types';

const timed = withTiming(createTask, (ms) => console.log(`用了 ${ms} 毫秒`), () => performance.now());
console.log(timed({ title: '写周报' }, Date.now()));
```
:::

:::files{role=tests}
```ts file=types.test.ts
import { describe, expect, test } from 'vitest';
import { withTiming } from './types';

function clock(...times: number[]): () => number {
  let i = 0;
  return () => times[i++] ?? Number.NaN;
}

describe('withTiming', () => {
  test('传入参数，返回原来的结果，报告用时', () => {
    const reports: number[] = [];
    const add = withTiming((a: number, b: number) => a + b, (ms) => reports.push(ms), clock(100, 130));
    expect(add(2, 3)).toBe(5);
    expect(reports).toEqual([30]);
  });

  test('每次调用都报告一次', () => {
    const reports: number[] = [];
    const id = withTiming((x: string) => x, (ms) => reports.push(ms), clock(0, 5, 10, 12));
    id('a');
    id('b');
    expect(reports).toEqual([5, 2]);
  });

  test('抛出异常时也报告，然后照常抛出', () => {
    const reports: number[] = [];
    const fail = withTiming(
      () => {
        throw new Error('失败了');
      },
      (ms) => reports.push(ms),
      clock(1, 4),
    );
    expect(() => fail()).toThrow('失败了');
    expect(reports).toEqual([3]);
  });

  test('异步函数：返回的 Promise 原样返回', async () => {
    const reports: number[] = [];
    const load = withTiming(async (id: string) => `任务 ${id}`, (ms) => reports.push(ms), clock(0, 1));
    await expect(load('t1')).resolves.toBe('任务 t1');
    expect(reports).toEqual([1]);
  });
});
```
```ts file=types.test-d.ts
import { expectTypeOf } from 'vitest';
import { createTask, type Status } from './api';
import { withTiming, type NewTask, type SearchOptions, type Task } from './types';

expectTypeOf<Task>().toEqualTypeOf<{ id: string; title: string; status: Status; tags: string[] }>();
expectTypeOf<SearchOptions>().toEqualTypeOf<{ status?: Status; limit?: number }>();
expectTypeOf<NewTask>().toEqualTypeOf<{ title: string; tags?: string[] }>();

const timed = withTiming(createTask, () => {}, () => 0);
expectTypeOf(timed).parameters.toEqualTypeOf<[input: { title: string; tags?: string[] }, now: number]>();
expectTypeOf(timed).returns.toEqualTypeOf<{ id: string; createdAt: number }>();
// @ts-expect-error 少了第二个参数
timed({ title: 'x' });
```
:::

:::hint{level=1}
`Task` 要套两层：`ReturnType<typeof loadTask>` 是 `Promise<…>`，再用 `Awaited` 取出里面的对象。`SearchOptions` 是 `Parameters<typeof searchTasks>[1]`，它包含 `undefined`（参数是可选的），用 `NonNullable` 去掉。
:::

:::hint{level=2}
`withTiming` 写成 `<A extends unknown[], R>(fn: (...args: A) => R, …): (...args: A) => R`。实现中用 `try { return fn(...args); } finally { report(now() - start); }`：`finally` 在正常返回和抛出异常时都会执行（a20）。
:::

:::explanation
三个类型都从 `api.ts` 推导：`loadTask` 的返回值多了一个字段，`Task` 自动跟着变。`import type` 可以导入值，只要在类型位置（`typeof`）使用它们。

`Parameters<typeof searchTasks>[1]` 是 `{ status?: Status; limit?: number } | undefined`：可选参数的类型包含 `undefined`。`NonNullable` 把它去掉，得到的才是“选项对象”本身。

`withTiming` 用泛型的剩余参数 `A` 和返回值 `R`，包装之后的函数和原来的函数类型完全一样，连参数名 `input`、`now` 都保留了（类型测试中的 `parameters`）。`try…finally` 保证无论 `fn` 正常返回还是抛出异常，都会报告用时，而且不会吞掉异常。

对异步函数，这里报告的只是“调用到返回 Promise”这一段同步的时间，而不是请求完成的时间。要测量异步操作的耗时，需要等 Promise 完成（编程挑战中的包装函数就是这样处理异步的）。
:::

:::variant{kind=alt name=parameters-and-return-type}
```ts file=types.ts
import type { createTask, loadTask, searchTasks } from './api';

type LoadTaskResult = ReturnType<typeof loadTask>;
export type Task = LoadTaskResult extends Promise<infer T> ? T : never;
export type SearchOptions = Exclude<Parameters<typeof searchTasks>[1], undefined>;
export type NewTask = Parameters<typeof createTask>[0];

export function withTiming<A extends unknown[], R>(fn: (...args: A) => R, report: (ms: number) => void, now: () => number) {
  return function timed(...args: A): R {
    const start = now();
    let result: R;
    try {
      result = fn(...args);
    } catch (error) {
      report(now() - start);
      throw error;
    }
    report(now() - start);
    return result;
  };
}
```
:::

:::variant{kind=wrong name=promise-task fails=types reason="Task 只用了 ReturnType，得到的是 Promise 而不是任务对象"}
```ts file=types.ts
import type { createTask, loadTask, searchTasks } from './api';

export type Task = ReturnType<typeof loadTask>;
export type SearchOptions = NonNullable<Parameters<typeof searchTasks>[1]>;
export type NewTask = Parameters<typeof createTask>[0];

export function withTiming<A extends unknown[], R>(
  fn: (...args: A) => R,
  report: (ms: number) => void,
  now: () => number,
): (...args: A) => R {
  return (...args) => {
    const start = now();
    try {
      return fn(...args);
    } finally {
      report(now() - start);
    }
  };
}
```
:::

:::variant{kind=wrong name=loses-signature fails=types reason="包装函数的类型写成 (...args: unknown[]) => unknown，原来的参数和返回值类型都丢了"}
```ts file=types.ts
import type { createTask, loadTask, searchTasks } from './api';

export type Task = Awaited<ReturnType<typeof loadTask>>;
export type SearchOptions = NonNullable<Parameters<typeof searchTasks>[1]>;
export type NewTask = Parameters<typeof createTask>[0];

export function withTiming(
  fn: (...args: never[]) => unknown,
  report: (ms: number) => void,
  now: () => number,
): (...args: unknown[]) => unknown {
  return (...args) => {
    const start = now();
    try {
      return Reflect.apply(fn, undefined, args);
    } finally {
      report(now() - start);
    }
  };
}
```
:::

:::variant{kind=wrong name=no-report-on-throw fails=tests reason="fn 抛出异常时没有报告用时"}
```ts file=types.ts
import type { createTask, loadTask, searchTasks } from './api';

export type Task = Awaited<ReturnType<typeof loadTask>>;
export type SearchOptions = NonNullable<Parameters<typeof searchTasks>[1]>;
export type NewTask = Parameters<typeof createTask>[0];

export function withTiming<A extends unknown[], R>(
  fn: (...args: A) => R,
  report: (ms: number) => void,
  now: () => number,
): (...args: A) => R {
  return (...args) => {
    const start = now();
    const result = fn(...args);
    report(now() - start);
    return result;
  };
}
```
:::

:::variant{kind=wrong name=options-with-undefined fails=types reason="SearchOptions 没有去掉 undefined"}
```ts file=types.ts
import type { createTask, loadTask, searchTasks } from './api';

export type Task = Awaited<ReturnType<typeof loadTask>>;
export type SearchOptions = Parameters<typeof searchTasks>[1];
export type NewTask = Parameters<typeof createTask>[0];

export function withTiming<A extends unknown[], R>(
  fn: (...args: A) => R,
  report: (ms: number) => void,
  now: () => number,
): (...args: A) => R {
  return (...args) => {
    const start = now();
    try {
      return fn(...args);
    } finally {
      report(now() - start);
    }
  };
}
```
:::
