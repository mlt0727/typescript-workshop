---
kind: task
title: 自己写出联合类型的工具
---
在 `union.ts` 中写出下面这些类型（这道题只做类型检查）。不要使用内置的 `Exclude`、`Extract`、`NonNullable`（判题检查不了这一条，直接写 `Exclude<T, U>` 也能通过，但那样就失去了练习的意义）：

1. **`MyExclude<T, U>`**：从联合 `T` 中去掉能赋值给 `U` 的成员；**`MyExtract<T, U>`**：只保留能赋值给 `U` 的成员；
2. **`NonNullish<T>`**：从 `T` 中去掉 `null` 和 `undefined`；
3. **`IsNever<T>`**：`T` 是 `never` 时为 `true`，否则为 `false`（包括 `T` 是联合类型的时候）；
4. **`ToArray<T>`**：对联合的每个成员分别生成数组，`ToArray<string | number>` 是 `string[] | number[]`；**`ToArrayAll<T>`**：把整个 `T` 作为元素类型，`ToArrayAll<string | number>` 是 `(string | number)[]`；
5. **`HandlerMap<E>`**：`E` 是带 `type` 字段的事件联合，为每一种 `type` 生成一个处理函数，参数是这一种事件。

:::files{role=starter}
```ts file=union.ts
export type MyExclude<T, U> = T;
export type MyExtract<T, U> = T;
export type NonNullish<T> = T;
export type IsNever<T> = false;
export type ToArray<T> = T[];
export type ToArrayAll<T> = T[];
export type HandlerMap<E extends { type: string }> = Record<string, (event: E) => void>;
```
```ts file=main.ts
import type { HandlerMap } from './union';

type AppEvent = { type: 'click'; x: number } | { type: 'key'; key: string } | { type: 'scroll' };

const handlers: HandlerMap<AppEvent> = {
  click: (event) => console.log('点击', event),
  key: (event) => console.log('按键', event),
  scroll: () => console.log('滚动'),
};
handlers.click({ type: 'click', x: 10 });
```
:::

:::files{role=solution}
```ts file=union.ts
export type MyExclude<T, U> = T extends U ? never : T;
export type MyExtract<T, U> = T extends U ? T : never;
export type NonNullish<T> = T extends null | undefined ? never : T;
export type IsNever<T> = [T] extends [never] ? true : false;
export type ToArray<T> = T extends unknown ? T[] : never;
export type ToArrayAll<T> = [T] extends [unknown] ? T[] : never;
export type HandlerMap<E extends { type: string }> = { [K in E['type']]: (event: MyExtract<E, { type: K }>) => void };
```
```ts file=main.ts
import type { HandlerMap } from './union';

type AppEvent = { type: 'click'; x: number } | { type: 'key'; key: string } | { type: 'scroll' };

const handlers: HandlerMap<AppEvent> = {
  click: (event) => console.log('点击', event.x),
  key: (event) => console.log('按键', event.key),
  scroll: () => console.log('滚动'),
};
handlers.click({ type: 'click', x: 10 });
```
:::

:::files{role=tests}
```ts file=union.test-d.ts
import { expectTypeOf } from 'vitest';
import type { HandlerMap, IsNever, MyExclude, MyExtract, NonNullish, ToArray, ToArrayAll } from './union';

type Status = 'draft' | 'published' | 'archived';
expectTypeOf<MyExclude<Status, 'archived'>>().toEqualTypeOf<'draft' | 'published'>();
expectTypeOf<MyExclude<Status, 'draft' | 'archived'>>().toEqualTypeOf<'published'>();
expectTypeOf<MyExclude<string | number | (() => void), Function>>().toEqualTypeOf<string | number>();
expectTypeOf<MyExtract<Status, 'draft' | 'other'>>().toEqualTypeOf<'draft'>();
expectTypeOf<MyExtract<string | number | boolean, number | boolean>>().toEqualTypeOf<number | boolean>();

expectTypeOf<NonNullish<string | null | undefined>>().toEqualTypeOf<string>();
expectTypeOf<NonNullish<0 | '' | false | null>>().toEqualTypeOf<0 | '' | false>();
expectTypeOf<NonNullish<undefined>>().toEqualTypeOf<never>();

expectTypeOf<IsNever<never>>().toEqualTypeOf<true>();
expectTypeOf<IsNever<undefined>>().toEqualTypeOf<false>();
expectTypeOf<IsNever<string | number>>().toEqualTypeOf<false>();
expectTypeOf<IsNever<MyExclude<'a', 'a'>>>().toEqualTypeOf<true>();

expectTypeOf<ToArray<string | number>>().toEqualTypeOf<string[] | number[]>();
expectTypeOf<ToArray<boolean>>().toEqualTypeOf<false[] | true[]>();
expectTypeOf<ToArrayAll<string | number>>().toEqualTypeOf<(string | number)[]>();
expectTypeOf<ToArrayAll<boolean>>().toEqualTypeOf<boolean[]>();

type AppEvent = { type: 'click'; x: number } | { type: 'key'; key: string } | { type: 'scroll' };
expectTypeOf<HandlerMap<AppEvent>>().toEqualTypeOf<{
  click: (event: { type: 'click'; x: number }) => void;
  key: (event: { type: 'key'; key: string }) => void;
  scroll: (event: { type: 'scroll' }) => void;
}>();
// @ts-expect-error 少了 scroll 的处理函数
const missing: HandlerMap<AppEvent> = { click: () => {}, key: () => {} };
console.log(missing);
```
:::

:::hint{level=1}
`MyExclude`、`MyExtract`、`NonNullish`、`ToArray` 都利用分布：左边写裸的 `T`，每个成员单独判断，不要的成员变成 `never`（合并时会消失）。`HandlerMap` 是一个映射类型，键是 `E['type']`，值是参数为 `MyExtract<E, { type: K }>` 的函数。
:::

:::hint{level=2}
`IsNever` 和 `ToArrayAll` 需要关掉分布：把两边都包进元组，`[T] extends [never] ? true : false`。如果写成 `T extends never ? …`，`T` 是 `never` 时分布出零个成员，结果是 `never`；`T` 是联合时又会对每个成员分别得出 `false`。
:::

:::explanation
标准库的 `Exclude<T, U>` 和 `Extract<T, U>` 就是这样一行定义，原理都是分布：联合的每个成员单独做一次判断，不需要的成员变成 `never`，而 `X | never` 就是 `X`，于是它们被“筛掉”了。`NonNullish` 同理；标准库现在把 `NonNullable<T>` 写成 `T & {}`，对具体的联合类型效果一样（`unknown` 这样的类型上两者不同，正文讲过）。

`IsNever` 是分布最容易出错的地方。`never` 可以看作“没有成员的联合”，`T extends never ? true : false` 遇到它时一个成员都没有可算，结果是 `never`，既不是 `true` 也不是 `false`。包进元组之后，`[never]` 是一个具体的元组类型，判断照常进行。

`ToArrayAll` 其实不需要条件类型，`type ToArrayAll<T> = T[]` 就够了：`T[]` 中的 `T` 不在 `extends` 的左边，不会分布。这里写成 `[T] extends [unknown]` 是为了和 `ToArray` 对照。

`HandlerMap` 把 c02 的映射类型和本课的 `Extract` 结合起来：键是所有的 `type`，每个处理函数的参数精确到这一种事件，所以 `main.ts` 中 `event.x`、`event.key` 都能通过检查；少写一种事件的处理函数会报错。
:::

:::variant{kind=alt name=other-forms}
```ts file=union.ts
export type MyExclude<T, U> = T extends U ? never : T;
export type MyExtract<T, U> = T extends unknown ? (T extends U ? T : never) : never;
export type NonNullish<T> = T & {};
export type IsNever<T> = [T] extends [never] ? true : false;
export type ToArray<T> = T extends T ? T[] : never;
export type ToArrayAll<T> = T[];
export type HandlerMap<E extends { type: string }> = { [K in E['type']]: (event: E extends { type: K } ? E : never) => void };
```
:::

:::variant{kind=wrong name=naive-is-never fails=types reason="用 T extends never 判断，分布让 IsNever<never> 也变成了 never"}
```ts file=union.ts
export type MyExclude<T, U> = T extends U ? never : T;
export type MyExtract<T, U> = T extends U ? T : never;
export type NonNullish<T> = T extends null | undefined ? never : T;
export type IsNever<T> = T extends never ? true : false;
export type ToArray<T> = T extends unknown ? T[] : never;
export type ToArrayAll<T> = [T] extends [unknown] ? T[] : never;
export type HandlerMap<E extends { type: string }> = { [K in E['type']]: (event: MyExtract<E, { type: K }>) => void };
```
:::

:::variant{kind=wrong name=distributes-all fails=types reason="ToArrayAll 没有关掉分布，得到 string[] | number[]"}
```ts file=union.ts
export type MyExclude<T, U> = T extends U ? never : T;
export type MyExtract<T, U> = T extends U ? T : never;
export type NonNullish<T> = T extends null | undefined ? never : T;
export type IsNever<T> = [T] extends [never] ? true : false;
export type ToArray<T> = T extends unknown ? T[] : never;
export type ToArrayAll<T> = T extends unknown ? T[] : never;
export type HandlerMap<E extends { type: string }> = { [K in E['type']]: (event: MyExtract<E, { type: K }>) => void };
```
:::

:::variant{kind=wrong name=handler-gets-union fails=types reason="处理函数的参数是整个事件联合，没有按 type 挑出对应的成员"}
```ts file=union.ts
export type MyExclude<T, U> = T extends U ? never : T;
export type MyExtract<T, U> = T extends U ? T : never;
export type NonNullish<T> = T extends null | undefined ? never : T;
export type IsNever<T> = [T] extends [never] ? true : false;
export type ToArray<T> = T extends unknown ? T[] : never;
export type ToArrayAll<T> = [T] extends [unknown] ? T[] : never;
export type HandlerMap<E extends { type: string }> = { [K in E['type']]: (event: E) => void };
```
:::
