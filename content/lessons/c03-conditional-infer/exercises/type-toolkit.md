---
kind: task
title: 几个取出类型的工具
---
在 `types.ts` 中用条件类型和 `infer` 写出下面五个类型（这道题只做类型检查，类型测试中有正例，也有反例）：

1. **`KindOf<T>`**：`T` 能赋值给 `string` 时是 `'text'`，能赋值给 `number` 时是 `'number'`，能赋值给 `boolean` 时是 `'boolean'`，否则是 `'other'`；
2. **`ElementOf<T>`**：数组或元组（包括只读的）的元素类型；不是数组时是 `never`；
3. **`Unwrap<T>`**：`T` 是 Promise（或者任何 thenable，用 `PromiseLike`）时取出完成时的值，**只取一层**；否则原样返回 `T`；
4. **`ResultOf<F>`**：函数的返回值类型；不是函数时是 `never`。不能使用 `any`；
5. **`DataOf<R>`**：从 `{ ok: true; data: … } | { ok: false; error: string }` 这样的结果类型中取出 `data` 的类型。

:::files{role=starter}
```ts file=types.ts
export type KindOf<T> = 'other';
export type ElementOf<T> = unknown;
export type Unwrap<T> = T;
export type ResultOf<F> = unknown;
export type DataOf<R> = unknown;
```
```ts file=main.ts
import type { DataOf, ElementOf, ResultOf, Unwrap } from './types';

async function loadTasks(done: boolean) {
  return { ok: true as const, data: [{ id: 't1', title: '写周报', done }] };
}

type Loaded = Unwrap<ResultOf<typeof loadTasks>>;
type Task = ElementOf<DataOf<Loaded>>;

const task: Task = { id: 't2', title: '修自行车', done: false };
console.log(task);
```
:::

:::files{role=solution}
```ts file=types.ts
export type KindOf<T> = T extends string ? 'text' : T extends number ? 'number' : T extends boolean ? 'boolean' : 'other';
export type ElementOf<T> = T extends readonly (infer E)[] ? E : never;
export type Unwrap<T> = T extends PromiseLike<infer V> ? V : T;
export type ResultOf<F> = F extends (...args: never[]) => infer R ? R : never;
export type DataOf<R> = R extends { ok: true; data: infer D } ? D : never;
```
```ts file=main.ts
import type { DataOf, ElementOf, ResultOf, Unwrap } from './types';

async function loadTasks(done: boolean) {
  return { ok: true as const, data: [{ id: 't1', title: '写周报', done }] };
}

type Loaded = Unwrap<ResultOf<typeof loadTasks>>;
type Task = ElementOf<DataOf<Loaded>>;

const task: Task = { id: 't2', title: '修自行车', done: false };
console.log(task);
```
:::

:::files{role=tests}
```ts file=types.test-d.ts
import { expectTypeOf } from 'vitest';
import type { DataOf, ElementOf, KindOf, ResultOf, Unwrap } from './types';

expectTypeOf<KindOf<'hi'>>().toEqualTypeOf<'text'>();
expectTypeOf<KindOf<42>>().toEqualTypeOf<'number'>();
expectTypeOf<KindOf<false>>().toEqualTypeOf<'boolean'>();
expectTypeOf<KindOf<{ a: 1 }>>().toEqualTypeOf<'other'>();
expectTypeOf<KindOf<null>>().toEqualTypeOf<'other'>();

expectTypeOf<ElementOf<string[]>>().toEqualTypeOf<string>();
expectTypeOf<ElementOf<readonly number[]>>().toEqualTypeOf<number>();
expectTypeOf<ElementOf<readonly [1, 'a']>>().toEqualTypeOf<1 | 'a'>();
expectTypeOf<ElementOf<string>>().toEqualTypeOf<never>();

expectTypeOf<Unwrap<Promise<number>>>().toEqualTypeOf<number>();
expectTypeOf<Unwrap<Promise<Promise<number>>>>().toEqualTypeOf<Promise<number>>();
expectTypeOf<Unwrap<PromiseLike<'x'>>>().toEqualTypeOf<'x'>();
expectTypeOf<Unwrap<string>>().toEqualTypeOf<string>();

expectTypeOf<ResultOf<(a: string, b: number) => boolean>>().toEqualTypeOf<boolean>();
expectTypeOf<ResultOf<() => Promise<void>>>().toEqualTypeOf<Promise<void>>();
expectTypeOf<ResultOf<(...items: string[]) => number>>().toEqualTypeOf<number>();
expectTypeOf<ResultOf<'not a function'>>().toEqualTypeOf<never>();

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
expectTypeOf<DataOf<Result<{ id: string }>>>().toEqualTypeOf<{ id: string }>();
expectTypeOf<DataOf<Result<number[]>>>().toEqualTypeOf<number[]>();
expectTypeOf<DataOf<{ ok: false; error: string }>>().toEqualTypeOf<never>();
```
:::

:::hint{level=1}
每一个都是 `T extends 某个形状 ? 取出的部分 : 其他情况` 的形式。`KindOf` 是三个条件串起来：`T extends string ? 'text' : T extends number ? … : …`。数组的形状写成 `readonly (infer E)[]`：可变数组也能赋值给只读数组，所以两种都能匹配。
:::

:::hint{level=2}
函数的形状写成 `(...args: never[]) => infer R`：参数是 `never` 的函数类型能接收任何函数（参数类型是逆变的），不需要 `any`。如果写成 `unknown[]`，`(a: string) => boolean` 就匹配不上了：调用者可能传入任何值，而它只接受字符串。`DataOf` 的形状是 `{ ok: true; data: infer D }`。
:::

:::explanation
这五个类型都是“看看 `T` 是不是某种形状，是的话取出其中一部分”：

- `readonly (infer E)[]` 同时匹配 `string[]` 和 `readonly [1, 'a']`，因为可变的数组能赋值给只读的数组，反过来不行。只写 `(infer E)[]` 的话，只读数组和 `as const` 的元组都匹配不上；
- `PromiseLike` 只要求有一个 `then` 方法，`Promise` 当然满足。`Unwrap` 只取一层，所以 `Promise<Promise<number>>` 得到的是 `Promise<number>`；内置的 `Awaited` 会递归地取到底；
- `(...args: never[]) => infer R`：函数类型的参数是“逆变”的。目标类型的参数是 `never`，任何函数的参数都能接收 `never`（`never` 能赋值给任何类型），所以所有函数都能匹配。写成 `unknown[]` 则相反，只有能接收任意参数的函数才匹配，`(a: string) => boolean` 会得到 `never`；
- `DataOf` 作用在联合类型上：对 `{ ok: true; … }` 得到 `data` 的类型，对 `{ ok: false; … }` 得到 `never`，合起来 `never` 消失，只剩下 `data` 的类型。这种“对联合的每个成员分别计算”的行为就是下一课的分布式条件类型。

`main.ts` 展示了这些工具的用处：`Task` 完全从 `loadTasks` 的实现推导出来，函数返回的对象多了一个字段，`Task` 就自动多一个字段。
:::

:::variant{kind=alt name=indexed-and-promise}
```ts file=types.ts
type IsOf<T, U> = T extends U ? true : false;
export type KindOf<T> = IsOf<T, string> extends true ? 'text' : IsOf<T, number> extends true ? 'number' : IsOf<T, boolean> extends true ? 'boolean' : 'other';
export type ElementOf<T> = T extends readonly unknown[] ? T[number] : never;
export type Unwrap<T> = T extends { then(onfulfilled: (value: infer V) => unknown): unknown } ? V : T;
export type ResultOf<F> = F extends (...args: never) => infer R ? R : never;
export type DataOf<R> = R extends { ok: true } ? (R extends { data: infer D } ? D : never) : never;
```
:::

:::variant{kind=wrong name=unknown-args fails=types reason="函数的参数写成 unknown[]，只接收字符串的函数匹配不上"}
```ts file=types.ts
export type KindOf<T> = T extends string ? 'text' : T extends number ? 'number' : T extends boolean ? 'boolean' : 'other';
export type ElementOf<T> = T extends readonly (infer E)[] ? E : never;
export type Unwrap<T> = T extends PromiseLike<infer V> ? V : T;
export type ResultOf<F> = F extends (...args: unknown[]) => infer R ? R : never;
export type DataOf<R> = R extends { ok: true; data: infer D } ? D : never;
```
:::

:::variant{kind=wrong name=mutable-array-only fails=types reason="只匹配可变数组，只读数组和元组得到 never"}
```ts file=types.ts
export type KindOf<T> = T extends string ? 'text' : T extends number ? 'number' : T extends boolean ? 'boolean' : 'other';
export type ElementOf<T> = T extends (infer E)[] ? E : never;
export type Unwrap<T> = T extends PromiseLike<infer V> ? V : T;
export type ResultOf<F> = F extends (...args: never[]) => infer R ? R : never;
export type DataOf<R> = R extends { ok: true; data: infer D } ? D : never;
```
:::

:::variant{kind=wrong name=unwrap-deep fails=types reason="递归地取到底，不是只取一层"}
```ts file=types.ts
export type KindOf<T> = T extends string ? 'text' : T extends number ? 'number' : T extends boolean ? 'boolean' : 'other';
export type ElementOf<T> = T extends readonly (infer E)[] ? E : never;
export type Unwrap<T> = T extends PromiseLike<infer V> ? Unwrap<V> : T;
export type ResultOf<F> = F extends (...args: never[]) => infer R ? R : never;
export type DataOf<R> = R extends { ok: true; data: infer D } ? D : never;
```
:::

:::variant{kind=wrong name=any-args fails=rules reason="用 any 匹配函数的参数"}
```ts file=types.ts
export type KindOf<T> = T extends string ? 'text' : T extends number ? 'number' : T extends boolean ? 'boolean' : 'other';
export type ElementOf<T> = T extends readonly (infer E)[] ? E : never;
export type Unwrap<T> = T extends PromiseLike<infer V> ? V : T;
export type ResultOf<F> = F extends (...args: any[]) => infer R ? R : never;
export type DataOf<R> = R extends { ok: true; data: infer D } ? D : never;
```
:::
