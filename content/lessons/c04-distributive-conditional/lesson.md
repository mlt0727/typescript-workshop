---
version: 1
mode: ts
estimatedMinutes: 45
review: self-reviewed
problem: '上一课的 DataOf 作用在 { ok: true; … } | { ok: false; … } 这样的联合类型上，结果“自动”去掉了失败的那一半。这不是巧合，而是条件类型的一条特殊规则：当被检查的是一个裸的类型参数、而传入的是联合类型时，条件类型会对联合的每个成员分别计算，再把结果合起来。内置的 Exclude、Extract、NonNullable 都建立在这条规则上。这一课弄清分布在什么时候发生、怎样关掉它、为什么 never 会“消失”，并用它从事件或动作的联合中挑出需要的成员，写出不需要类型断言的分发函数。'
objectives:
  - 说明分布式条件类型在什么条件下发生，并预测它作用在联合类型上的结果
  - 用 [T] extends [U] 关闭分布，正确判断一个类型是不是 never
  - 用 Exclude、Extract（以及自己写的同类工具）从联合类型中去掉或挑出成员
  - 用“动作表”生成可辨识联合，写出参数随动作类型变化、实现中不需要断言的分发函数
references:
  - title: Conditional Types（Distributive Conditional Types）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#distributive-conditional-types
    checked: 2026-10-20
  - title: Utility Types（Exclude、Extract、NonNullable）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/utility-types.html
    checked: 2026-10-20
  - title: TypeScript 4.6 Release Notes（Improved Indexed Access Inference）
    url: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-6.html
    checked: 2026-10-20
---

## 对联合的每个成员分别计算

```ts
type ToArray<T> = T extends unknown ? T[] : never;
type A = ToArray<string | number>; // string[] | number[]，而不是 (string | number)[]
```

`T extends unknown` 对任何类型都成立，看起来 `ToArray<string | number>` 应该是 `(string | number)[]`。但结果是 `string[] | number[]`：TypeScript 把 `string | number` 拆开，分别计算 `ToArray<string>` 和 `ToArray<number>`，再用 `|` 合起来。这叫**分布**（distributive）。

分布只在同时满足两个条件时发生：

1. `extends` 左边是一个**裸的类型参数**（就是 `T` 本身，不是 `T[]`、`[T]`、`Promise<T>`）；
2. 使用时这个参数被替换成了**联合类型**。

几个常见的推论：

- `boolean` 就是 `true | false`，所以 `ToArray<boolean>` 是 `false[] | true[]`；
- `never` 是“没有成员的联合”，分布时一个成员都没有，结果还是 `never`。所以 `type IsNever<T> = T extends never ? true : false` 作用在 `never` 上得到的是 `never`，而不是 `true`；
- 结果中的 `never` 会在合并时消失（`X | never` 就是 `X`），这正是“筛选”联合成员的原理。

:::playground{#distribute}
```ts file=main.ts
type ToArray<T> = T extends unknown ? T[] : never;
type ToArrayAll<T> = [T] extends [unknown] ? T[] : never;

type A = ToArray<string | number>; // string[] | number[]
type B = ToArrayAll<string | number>; // (string | number)[]

type MyExclude<T, U> = T extends U ? never : T;
type Status = 'draft' | 'published' | 'archived';
type Visible = MyExclude<Status, 'archived'>; // 'draft' | 'published'

type IsNeverWrong<T> = T extends never ? true : false;
type IsNever<T> = [T] extends [never] ? true : false;
type C = IsNeverWrong<never>; // never
type D = IsNever<never>; // true

const a: A = [1, 2];
const b: B = [1, 'two'];
const v: Visible = 'draft';
console.log(a, b, v);
```
- 第 2 行：把两边都包进元组 `[T]`，左边就不再是“裸的”类型参数，分布被关掉了，`T` 作为一个整体参与判断。
- 第 7 行就是内置的 `Exclude` 的定义：对每个成员，能赋值给 `U` 的变成 `never`（被去掉），其余保留。把 `never` 和 `T` 交换，就是 `Extract`。
- 第 17 行：`[1, 'two']` 能赋值给 `B`。把这一行的类型 `B` 改成 `A` 就会报错：`A` 是 `string[] | number[]`，每个数组只能有一种元素。
:::

## 从联合中挑出成员

可辨识联合（b09）中的每个成员都有一个 `type` 字段。`Extract` 按“能不能赋值给某个形状”挑选成员：

```ts
type AppEvent =
  | { type: 'click'; x: number; y: number }
  | { type: 'key'; key: string }
  | { type: 'scroll' };

type KeyEvent = Extract<AppEvent, { type: 'key' }>; // { type: 'key'; key: string }
type EventType = AppEvent['type']; // 'click' | 'key' | 'scroll'
```

`AppEvent['type']` 在联合上取属性，得到每个成员的 `type` 组成的联合。结合映射类型，可以为每种事件生成对应的处理函数类型：`{ [K in AppEvent['type']]: (event: Extract<AppEvent, { type: K }>) => void }`。

`NonNullable<T>` 去掉 `null` 和 `undefined`。现在的标准库把它定义成 `T & {}`（`{}` 表示“除了 `null`、`undefined` 以外的任何值”），对具体的联合类型，效果和分布式的 `T extends null | undefined ? never : T` 一样（`NonNullable<string | null>` 都是 `string`）；两者在少数情况下不同，例如 `NonNullable<unknown>` 是 `{}`，而分布式的版本得到 `unknown`。

## 分发函数：先有表，再有联合

用事件的联合来描述数据很方便，但要写一个“根据 `type` 调用对应处理函数”的函数时，会遇到一个问题：

:::playground{#correlated expect="2345@main.ts:11"}
```ts file=main.ts
type ActionMap = { add: { title: string }; remove: { id: string } };
type Action<K extends keyof ActionMap = keyof ActionMap> = { [P in K]: { type: P; payload: ActionMap[P] } }[K];
type Handlers = { [K in keyof ActionMap]: (payload: ActionMap[K]) => string };

const handlers: Handlers = {
  add: (payload) => `添加：${payload.title}`,
  remove: (payload) => `删除：${payload.id}`,
};

function runLoose(action: Action): string {
  return handlers[action.type](action.payload);
}

function run<K extends keyof ActionMap>(action: Action<K>): string {
  return handlers[action.type](action.payload);
}

console.log(run({ type: 'add', payload: { title: '写周报' } }), run({ type: 'remove', payload: { id: 't1' } }));
```
- 第 2 行：`Action` 由“动作表” `ActionMap` 生成：先为每个键 `P` 映射出 `{ type: P; payload: ActionMap[P] }`，再用 `[K]` 取出所有的值，得到可辨识联合 `{ type: 'add'; payload: { title } } | { type: 'remove'; payload: { id } }`。
- 第 11 行报 TS2345：`action` 是联合类型，`handlers[action.type]` 是两个处理函数的联合，`action.payload` 也是联合。TypeScript 不知道这两个联合是“相关的”（同一个 `action` 的 `type` 和 `payload` 一定配套），只能要求参数同时满足两个函数，也就是 `{ title } & { id }`。
- 第 14–16 行：同样的代码，只是加了一个类型参数 `K`，`action` 的类型是 `Action<K>`。现在 `handlers[action.type]` 的类型是 `Handlers[K]`，`action.payload` 是 `ActionMap[K]`，TypeScript 4.6 起能看出它们正好对应，不需要断言。关键在于联合是**从一张表映射出来的**，而且函数对表的键是泛型的。
:::

::exercise{#union-tools}

## 编程挑战

::exercise{#action-reducer}

::quiz

## 常见错误

- **以为 `T extends U ? X : Y` 总是把 `T` 当作一个整体**：裸的类型参数遇到联合时会分布。需要整体判断时写 `[T] extends [U]`。
- **用 `T extends never` 判断 `never`**：分布让结果也变成 `never`。写 `[T] extends [never]`。
- **用 `ToArray<string | number>` 去描述“混合数组”**：得到的是 `string[] | number[]`，每个数组只能有一种元素。
- **为可辨识联合写分发函数时，用 `as` 让 `handlers[action.type](action.payload)` 通过检查**：先写一张表，从表生成联合，再让分发函数对键泛型。
- **忘了 `boolean` 是 `true | false`**：分布时它会被拆成两个成员。
