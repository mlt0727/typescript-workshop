---
version: 1
mode: ts
estimatedMinutes: 45
review: ai-draft
problem: 前几课用泛型写了不少函数，但“能写出泛型”和“设计出好用的泛型 API”是两回事。常见的问题有：类型参数只出现一次，什么也没连起来；类型参数只出现在返回值里，调用方随便写一个类型就能骗过编译器；推断出来的类型太宽（'S' 变成了 string），或者被一个不该参与推断的参数带偏。这一课总结设计泛型 API 的几条规则，并介绍两个较新的工具：const 类型参数（TypeScript 5.0）让推断保留字面量，NoInfer（TypeScript 5.4）让某个参数不参与推断。
objectives:
  - 判断一个类型参数是否有用：它应当把至少两个位置（参数与参数、参数与返回值）联系起来
  - 识别“只出现在返回值中”的类型参数带来的虚假安全，改用 unknown 加验证
  - 用 const 类型参数保留字面量类型，用 NoInfer 阻止某个参数参与推断，用默认类型参数简化调用
  - 设计一个泛型类：在没有推断来源时由调用方给出类型参数，在有来源时让 TypeScript 推断
references:
  - title: Generics — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/generics.html
    checked: 2026-10-20
  - title: More on Functions（Guidelines for Writing Good Generic Functions）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/functions.html#guidelines-for-writing-good-generic-functions
    checked: 2026-10-20
  - title: TypeScript 5.0 Release Notes（const Type Parameters）
    url: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html
    checked: 2026-10-20
  - title: TypeScript 5.4 Release Notes（The NoInfer Utility Type）
    url: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-4.html
    checked: 2026-10-20
---

## 规则一：类型参数要把两个位置连起来

类型参数的作用是表达“这里的类型和那里的类型有关系”。如果它只出现一次，就什么也没表达：

```ts
function logValue<T>(label: string, value: T): void { … } // T 只出现一次：写成 value: unknown 就行
function first<T>(items: readonly T[]): T | undefined { … } // T 连接了参数和返回值：有用
```

`logValue` 的 `T` 没有任何约束作用，任何值都能传进来，和 `unknown` 完全一样，只是让读代码的人多想一步。判断的标准很简单：数一数类型参数出现了几次（不算声明它的地方）。只出现一次的，通常可以去掉。

## 规则二：不要让类型参数只出现在返回值中

```ts
function parseJson<T>(text: string): T {
  return JSON.parse(text); // JSON.parse 返回 any，于是这里不报错
}
const user = parseJson<User>(text); // 看起来很安全，其实什么都没检查
```

`T` 只出现在返回值里，调用方写什么类型，就“得到”什么类型。这和 `as` 一样是断言，只是藏在了函数签名里，看起来更安全，因而更危险。诚实的写法是返回 `unknown`，让调用方验证（e06）；或者让调用方把验证函数也传进来，类型参数就有了真正的来源：

```ts
function parseJson<T>(text: string, isT: (value: unknown) => value is T): T | null
```

现在 `T` 出现了两次：守卫的类型和返回值。`T` 由守卫推断出来，返回的值也确实经过了这个守卫。

## 规则三：控制推断的宽窄

TypeScript 推断类型参数时，默认会把字面量“放宽”：传入 `['S', 'M']`，`T extends readonly string[]` 被推断成 `string[]`。在类型参数前面加上 `const`（TypeScript 5.0 起），推断就会像 `as const` 一样保留字面量，调用方不用自己写 `as const`。

另一个方向的问题是“推断被带偏”。下面的 `withDefault` 希望 `fallback` 必须是 `allowed` 中的一项，但 `T` 同时从两个参数推断，`'c'` 也被加进了 `T`：

:::playground{#inference expect="2345@main.ts:16"}
```ts file=main.ts
function enumValues<const T extends readonly string[]>(values: T) {
  return { values, is: (x: string): x is T[number] => values.includes(x) };
}

function withDefaultLoose<T extends string>(allowed: readonly T[], fallback: T): (input: string) => T {
  return (input) => allowed.find((a) => a === input) ?? fallback;
}

function withDefault<T extends string>(allowed: readonly T[], fallback: NoInfer<T>): (input: string) => T {
  return (input) => allowed.find((a) => a === input) ?? fallback;
}

const sizes = enumValues(['S', 'M', 'L']); // values: readonly ['S', 'M', 'L']
const pick = withDefaultLoose(['S', 'M'], 'XL'); // 不报错：T 变成了 'S' | 'M' | 'XL'
const strict = withDefault(['S', 'M'], 'S');
const wrong = withDefault(['S', 'M'], 'XL');
console.log(sizes.values, sizes.is('M'), pick('?'), strict('L'), wrong('?'));
```
- 第 1 行的 `const`：`sizes.values` 的类型是 `readonly ['S', 'M', 'L']`，`sizes.is` 能把字符串收窄成 `'S' | 'M' | 'L'`。去掉 `const`，`values` 就只是 `string[]`。
- 第 14 行：`T` 同时从 `allowed` 和 `fallback` 推断，`'XL'` 也成了 `T` 的一员，错误没有被发现。
- 第 9 行的 `NoInfer<T>`：告诉 TypeScript 不要从 `fallback` 推断 `T`，`T` 只由 `allowed` 决定，于是第 16 行的 `'XL'` 报 TS2345。
:::

`const` 类型参数只影响**直接写在调用处**的字面量；传入一个已经声明好的 `string[]` 变量，类型照样是 `string[]`。

## 规则四：没有推断来源时，由调用方给出

一个空的缓存 `new Cache()` 没有任何参数能告诉 TypeScript 键和值是什么类型。这时：

- 让调用方写出类型参数：`new Cache<string, User>(…)`，这是容器类的正常用法；
- 给类型参数一个**默认值**：`class Cache<K = string, V = unknown>`，什么都不写时就用默认值；
- 如果构造参数中有用到这些类型的地方（例如 `onEvict: (key: K, value: V) => void`），TypeScript 也能从那里推断。

不要为了“少写一个类型参数”而把容器的值类型写成 `any`：之后每次取出的值都失去了检查。

## 小结：一个好的泛型签名

- 每个类型参数至少连起两个位置；
- 能推断的就让它推断，推断的来源是参数而不是返回值；
- 约束（`extends`）写最宽的、真正需要的那个；
- 用 `const`、`NoInfer`、默认值调整推断，而不是让调用方写断言；
- 拿不准时，`unknown` 加验证比一个虚假的类型参数更诚实。

::exercise{#fix-signatures}

## 编程挑战

::exercise{#lru-cache}

::quiz

## 常见错误

- **只出现一次的类型参数**：`<T>(value: T): void` 等于 `(value: unknown): void`。
- **只出现在返回值里的类型参数**：`parseJson<T>(text): T` 是藏起来的断言。返回 `unknown`，或者接收一个验证函数。
- **推断出的类型太宽**：让调用方写 `as const` 不如在签名中写 `const T`。
- **不该参与推断的参数带偏了推断**：用 `NoInfer<T>`。
- **容器的值类型写成 `any`**：取出的每个值都失去了检查。让调用方给出类型参数，或者提供默认值。
