---
version: 1
mode: ts
estimatedMinutes: 45
review: ai-draft
problem: '有了 keyof 和映射类型，我们能按“键”生成类型；但很多时候需要按“情况”决定类型：如果是数组，取元素的类型；如果是 Promise，取它完成时的值；如果是函数，取返回值；如果表单字段是数字输入框，值就是 number。条件类型 T extends U ? X : Y 就是类型层面的 if，配合 infer，还能从一个类型的“内部”取出一部分。这一课学会读写条件类型和 infer，并知道它的一个重要限制：在泛型函数的实现中，TypeScript 不会根据条件类型去检查你返回的值。'
objectives:
  - '读懂并写出 T extends U ? X : Y 形式的条件类型，以及多个条件串联的写法'
  - 用 infer 从数组、Promise、函数、对象类型中取出一部分类型，并用 infer X extends 约束取出的类型
  - 用条件类型配合映射类型，从一份描述（例如表单字段的定义）推导出值的类型
  - 知道泛型函数的返回值写成条件类型时，实现中通常无法通过检查，以及用重载或拆分函数代替的做法
references:
  - title: Conditional Types — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/conditional-types.html
    checked: 2026-10-20
  - title: TypeScript 4.7 Release Notes（extends Constraints on infer Type Variables）
    url: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-7.html
    checked: 2026-10-20
---

## 类型层面的 if

条件类型的写法和三元运算符一样：

```ts
type IsText<T> = T extends string ? true : false;
```

`T extends U` 在这里的意思是“`T` 能不能赋值给 `U`”，和泛型约束（b15）中的 `extends` 是同一个意思。`IsText<'hi'>` 是 `true`，`IsText<42>` 是 `false`。多个条件可以串起来，像 `else if`：

```ts
type Kind<T> = T extends string ? 'text' : T extends number ? 'number' : 'other';
```

条件类型很少单独使用，它的威力来自和 `infer` 的配合。

## infer：从类型的内部取出一部分

在 `extends` 右边的类型中写 `infer X`，意思是“这里的类型是什么，就把它叫作 `X`”，然后可以在 `?` 后面的分支中使用 `X`：

| 写法 | 取出什么 |
| --- | --- |
| `T extends readonly (infer E)[] ? E : never` | 数组、元组的元素类型 |
| `T extends PromiseLike<infer V> ? V : T` | Promise 完成时的值（不是 Promise 就原样返回） |
| `T extends (...args: never[]) => infer R ? R : never` | 函数的返回值类型 |
| `T extends { ok: true; data: infer D } ? D : never` | 对象中某个属性的类型 |

匹配不上时走 `:` 后面的分支，通常写 `never`（“没有这样的类型”）或者原样返回 `T`。

:::playground{#infer}
```ts file=main.ts
type ElementOf<T> = T extends readonly (infer E)[] ? E : never;
type Unwrap<T> = T extends PromiseLike<infer V> ? V : T;
type ResultOf<F> = F extends (...args: never[]) => infer R ? R : never;

async function loadUser(id: string) {
  return { id, name: 'Ada', roles: ['admin', 'editor'] };
}

type User = Unwrap<ResultOf<typeof loadUser>>; // { id: string; name: string; roles: string[] }
type Role = ElementOf<User['roles']>; // string
type Nothing = ElementOf<number>; // never

const user: User = { id: 'u1', name: 'Lin', roles: [] };
const role: Role = 'viewer';
console.log(user, role);
```
- 第 9 行：`typeof loadUser` 是函数的类型，`ResultOf` 取出返回值 `Promise<{ … }>`，`Unwrap` 再取出 Promise 里面的对象。`loadUser` 的返回值改了，`User` 自动跟着变。
- 第 3 行的参数写成 `never[]`：任何函数都能赋值给“参数是 `never`”的函数类型（参数类型是逆变的，`never` 能赋值给任何类型），所以它能匹配所有的函数，又不需要写 `any`。
- `Unwrap` 只取一层：`Unwrap<Promise<Promise<number>>>` 是 `Promise<number>`。内置的 `Awaited` 会一直取到底（c07）。
:::

`infer` 还可以带约束：`infer X extends string` 表示“取出来的类型必须是 `string`，否则这个分支不匹配”。例如 `T extends [infer H extends string, ...unknown[]] ? H : never` 只在元组的第一项是字符串时取出它。

## 从描述推导值的类型

条件类型和上一课的映射类型合在一起，可以从一份“描述”推导出数据的类型。例如表单的字段定义：

```ts
type Field =
  | { kind: 'text' }
  | { kind: 'number'; min?: number }
  | { kind: 'select'; options: readonly string[] };

type ValueOf<F> = F extends { kind: 'text' } ? string
  : F extends { kind: 'number' } ? number
  : F extends { kind: 'select'; options: readonly (infer O)[] } ? O
  : never;

type FormValues<S> = { [K in keyof S]: ValueOf<S[K]> };
```

用 `as const satisfies Record<string, Field>` 写出具体的字段（b16），`FormValues<typeof SIGNUP>` 就是这个表单的值的类型；下拉框的值还会精确到 `'free' | 'pro'`。编程挑战就做这件事。

## 一个重要的限制：泛型函数的返回值

很自然地，你会想写一个“返回值类型取决于参数”的函数：

:::playground{#deferred expect="2322@main.ts:2, 2322@main.ts:3"}
```ts file=main.ts
function parse<T extends 'number' | 'text'>(kind: T, raw: string): T extends 'number' ? number : string {
  if (kind === 'number') return Number(raw);
  return raw;
}

function parseOverloaded(kind: 'number', raw: string): number;
function parseOverloaded(kind: 'text', raw: string): string;
function parseOverloaded(kind: 'number' | 'text', raw: string): number | string {
  return kind === 'number' ? Number(raw) : raw;
}

const n = parseOverloaded('number', '42'); // number
const s = parseOverloaded('text', '42'); // string
console.log(n + 1, s.padStart(4, '0'));
```
- 第 2、3 行报 TS2322：在函数内部，`T` 还没有确定，`T extends 'number' ? number : string` 是一个“延迟”的条件类型，TypeScript 不会因为 `kind === 'number'` 这个判断就认为条件成立（收窄的是变量 `kind`，不是类型参数 `T`）。所以没有任何具体的值能赋给它。
- 第 6–10 行用**重载**（b11）表达同样的意思：调用方看到的是前两个签名，返回值随参数变化；实现签名返回 `number | string`，检查照常进行。
- 另一个常见的做法是干脆拆成两个函数 `parseNumber`、`parseText`。条件类型更适合用来**描述**已有的类型（取出返回值、推导值的类型），而不是作为自己实现的函数的返回值。
:::

条件类型作用在**联合类型**上时还有一个特别的规则（“分布”）：`ValueOf<Field>` 会对 `Field` 的每一个成员分别计算，再把结果合起来，得到 `string | number`。下一课专门讲它。

::exercise{#type-toolkit}

## 编程挑战

::exercise{#form-schema}

::quiz

## 常见错误

- **把 `extends` 读成“继承”**：在条件类型中它的意思是“能不能赋值给”。`'a' extends string` 成立，`string extends 'a'` 不成立。
- **用 `(...args: any[]) => infer R` 匹配函数**：`any` 会悄悄扩散。参数写成 `never[]` 一样能匹配所有函数。
- **以为 `Unwrap<Promise<Promise<T>>>` 会取到底**：`infer` 只匹配一层，要递归或者用内置的 `Awaited`。
- **把条件类型写成自己实现的泛型函数的返回值，再用 `as` 让实现通过**：断言让检查失去意义。用重载或者拆分函数。
- **条件的顺序写反**：`F extends { kind: string } ? string : …` 写在最前面，所有字段都会匹配它。更具体的条件要写在前面。
