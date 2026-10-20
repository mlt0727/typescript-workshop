---
version: 1
mode: ts
estimatedMinutes: 45
review: self-reviewed
problem: 一个表单有 email、age、agree 三个字段，于是还需要“每个字段的校验函数”“每个字段的错误信息”“每个字段是否被修改过”这几个类型。它们的键完全相同，只是每个键对应的值不同。把它们一个个手写出来，加一个字段就要改四处。映射类型（mapped type）用一个类型“遍历”另一个类型的键，按规则生成新的类型；它还能统一加上或去掉 readonly 和 ? 修饰符。TypeScript 内置的 Partial、Readonly、Record 都是用它写出来的。
objectives:
  - '读懂并写出 { [K in keyof T]: … } 形式的映射类型，在值的位置使用 T[K]'
  - 用 readonly、?，以及 -readonly、-? 添加或去掉修饰符；知道“同态”映射会保留原来的修饰符
  - 用映射类型从一个“数据”类型派生出校验函数、错误信息、事件处理函数等相关类型
  - 写出参数和返回值都用映射类型描述的泛型函数，不使用类型断言
references:
  - title: Mapped Types — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/mapped-types.html
    checked: 2026-10-20
  - title: Utility Types — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/utility-types.html
    checked: 2026-10-20
---

## 遍历键，生成新的类型

映射类型的写法像一个 `for…in` 循环，只是它运行在类型层面：

```ts
type Validators<T> = {
  [K in keyof T]: (value: T[K]) => string | null;
};
```

读作：对 `T` 的每一个键 `K`，新类型都有一个同名的属性，它的类型是“接收 `T[K]`、返回错误信息或 `null` 的函数”。`T[K]` 是上一课的索引访问类型，它让每个校验函数的参数类型都和对应的字段一致。

`in` 后面可以是任何由字符串、数字或 symbol 字面量组成的联合类型：`{ [K in 'x' | 'y']: number }` 就是 `{ x: number; y: number }`。`Record<'x' | 'y', number>` 正是这样定义的。

:::playground{#form-types}
```ts file=main.ts
type SignupForm = { email: string; age: number; agree: boolean };

type Validators<T> = { [K in keyof T]?: (value: T[K]) => string | null };
type Errors<T> = { [K in keyof T]?: string };
type Touched<T> = { [K in keyof T]: boolean };

const validators: Validators<SignupForm> = {
  email: (value) => (value.includes('@') ? null : '邮箱格式不正确'),
  age: (value) => (value >= 18 ? null : '需要年满 18 岁'),
};

const values: SignupForm = { email: 'ada.example.com', age: 16, agree: true };
const errors: Errors<SignupForm> = {};
const emailError = validators.email?.(values.email) ?? null;
if (emailError !== null) errors.email = emailError;
const ageError = validators.age?.(values.age) ?? null;
if (ageError !== null) errors.age = ageError;
const touched: Touched<SignupForm> = { email: true, age: true, agree: false };
console.log(errors, touched);
```
- 第 8、9 行：校验函数的参数 `value` 没有写类型，TypeScript 从 `Validators<SignupForm>` 中知道 `email` 的是 `string`、`age` 的是 `number`，所以 `value.includes`、`value >= 18` 都能通过检查。把第 9 行改成 `value.includes('1')`，就会报错。
- 第 3、4 行的 `?` 让每个属性都可以省略：不是每个字段都需要校验（`agree` 就没有），也不是每个字段都有错误。第 5 行没有 `?`，`Touched<SignupForm>` 必须三个字段都写上。
- 第 14–17 行：只有真的有错误时才给 `errors` 加上属性，所以 `errors` 中只有 `email` 和 `age`，没有值为 `undefined` 的属性（练习中会用到这一点）。
- 在 `SignupForm` 中加一个字段 `name: string`，第 18 行马上报错（少了 `name`），而另外两个派生类型自动多出了 `name`。
:::

## 修饰符：加上、去掉、保留

映射时可以给每个属性加上 `readonly` 或 `?`，也可以在前面写 `-` 把它们去掉（写 `+` 和不写一样）：

| 写法 | 效果 | 内置的同类工具 |
| --- | --- | --- |
| `{ readonly [K in keyof T]: T[K] }` | 每个属性都只读 | `Readonly<T>` |
| `{ [K in keyof T]?: T[K] }` | 每个属性都可选 | `Partial<T>` |
| `{ [K in keyof T]-?: T[K] }` | 每个属性都必需 | `Required<T>` |
| `{ -readonly [K in keyof T]: T[K] }` | 去掉只读 | （没有内置的） |

`in keyof T` 这种映射叫作**同态**映射（homomorphic）：新类型的键就是 `T` 的键，TypeScript 会**保留** `T` 原有的 `readonly` 和 `?`，再应用你写的修饰符。所以 `{ [K in keyof T]: T[K] }` 得到的是和 `T` 完全一样的类型。`-?` 去掉可选时，也会把属性类型中因为可选而带上的 `undefined` 一起去掉。

:::playground{#modifiers expect="2540@main.ts:10"}
```ts file=main.ts
type Profile = { readonly id: string; nickname?: string; bio: string };

type Frozen<T> = { readonly [K in keyof T]: T[K] };
type Editable<T> = { -readonly [K in keyof T]-?: T[K] };

const draft: Editable<Profile> = { id: 'u1', nickname: 'Ada', bio: '' };
draft.id = 'u2';

const saved: Frozen<Profile> = draft;
saved.bio = '改不了';
console.log(draft, saved);
```
- 第 4 行：`Editable` 去掉了 `id` 的只读和 `nickname` 的可选，所以第 6 行必须写 `nickname`，第 7 行可以修改 `id`。
- 第 10 行：`Frozen` 把每个属性都变成只读，赋值报 TS2540。注意第 9 行把 `draft` 赋给 `saved` 是允许的：`readonly` 只限制“通过这个类型”修改，`draft` 本身仍然可以修改，运行时也没有任何冻结（要真正冻结需要 `Object.freeze`）。
:::

映射类型对数组和元组同样有效：`T` 是类型参数、代入的是元组时，同态映射 `{ [K in keyof T]: … }` 得到的还是元组，每个位置分别映射。例如 `type Promised<T> = { [K in keyof T]: Promise<T[K]> }`，`Promised<[string, number]>` 就是 `[Promise<string>, Promise<number>]`。`Promise.all` 的类型就是这样写的（c07）。注意前提是“类型参数”：直接写 `{ [K in keyof [string, number]]: … }` 时，`keyof` 得到的是数组的全部键，`length`、`push` 这些也会被映射，结果不再是元组。

## 在泛型函数中使用映射类型

映射类型最大的用处，是让一个泛型函数的几个参数**互相约束**。下面的 `validateForm` 中，`validators` 的类型由 `values` 推导出来：传入 `{ age: 3 }`，`validators.age` 的参数就必须是 `number`。

```ts
function validateForm<T>(values: T, validators: Validators<T>): Errors<T> {
  const errors: Errors<T> = {};
  for (const key in validators) {
    const check = validators[key];
    if (check === undefined) continue;
    const message = check(values[key]);
    if (message !== null) errors[key] = message;
  }
  return errors;
}
```

`for (const key in validators)` 中，`key` 的类型是 `Extract<keyof T, string>`（只取字符串键，`for…in` 不会遍历 symbol 键）。`validators[key]` 和 `values[key]` 用的是同一个 `key`，TypeScript 知道前者接收的正是后者的类型，所以 `check(values[key])` 不需要任何断言。`errors` 的每个属性都是可选的，所以可以从空对象 `{}` 开始。

反过来，**从零构造**一个所有属性都必需的映射类型对象（例如在循环中一项项填出 `Touched<T>`）时，TypeScript 无法确认循环结束时每个键都填上了，往往只能借助断言。这时更好的做法通常是换一个设计：让属性可选，或者由调用方提供完整的对象。

::exercise{#validate-form}

## 编程挑战

::exercise{#event-bus}

::quiz

## 常见错误

- **为每个派生类型手写一遍键**：加一个字段要改好几处。用 `[K in keyof T]` 从一个来源生成。
- **值的位置写成 `T[keyof T]`**：每个属性都成了所有值类型的联合，`email` 的校验函数也可能收到 `number`。写 `T[K]`。
- **以为 `readonly` 会在运行时冻结对象**：它只是类型检查，而且可以通过别名修改。需要运行时保证时用 `Object.freeze`。
- **忘了同态映射会保留修饰符**：`{ [K in keyof T]: T[K] }` 不会去掉可选和只读，要去掉就写 `-?`、`-readonly`。
- **在循环中构造一个必需属性的映射对象，再用 `as` 让它通过检查**：断言掩盖了“某个键可能没有填”的问题。优先考虑可选属性或者换一种数据流向。
