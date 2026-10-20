---
version: 1
mode: ts
estimatedMinutes: 35
review: ai-draft
problem: 上一课的泛型函数对 T 一无所知，连 value.length 都不能用。很多时候你需要的是“任何具有某些特征的类型”：任何有 length 的值、任何对象的任何键。泛型约束 T extends … 表达的就是这件事。配合 keyof 和索引访问类型 T[K]，可以写出“传入哪个键，就返回那个键对应类型的值”的函数——b11 用重载才做到的事情，现在一个签名就够了。
objectives:
  - "用 T extends 约束 限制类型参数，在函数内部使用约束保证存在的属性"
  - 知道返回值类型是 T 时，不能返回一个“只满足约束”的新对象
  - 用 keyof 得到对象类型所有键的联合，用 T[K] 得到某个键对应的值类型
  - "写出 K extends keyof T 的函数，让返回类型随传入的键变化"
references:
  - title: Generics（Generic Constraints、Using Type Parameters in Generic Constraints）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/generics.html
    checked: 2026-10-20
  - title: Keyof Type Operator — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/keyof-types.html
    checked: 2026-10-20
  - title: Indexed Access Types — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html
    checked: 2026-10-20
  - title: More on Functions（Working with Constrained Values）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/functions.html
    checked: 2026-10-20
---

## T extends 约束

在类型参数后面写 `extends 某个类型`，表示 `T` 必须是这个类型的**子类型**（满足它的形状）。于是：

- 调用时，不满足约束的实参会被拒绝；
- 在函数内部，可以放心使用约束中保证存在的属性。

这里的 `extends` 和类继承的 `extends` 是同一个词，但含义是“满足这个形状”（b02 的结构化类型）。

:::playground{#constraint expect="2345@main.ts:10"}
```ts file=main.ts
function lengthOf<T extends { length: number }>(value: T): number {
  return value.length;
}

function longest<T extends { length: number }>(a: T, b: T): T {
  return a.length >= b.length ? a : b;
}

console.log(lengthOf('abc'), lengthOf([1, 2]), lengthOf({ length: 7, name: 'x' }));
console.log(lengthOf(42));

const longer = longest([1, 2], [3]);
console.log(longer);
```
- 第 2 行：有了约束，`value.length` 不再报错。
- 第 10 行：数字没有 `length`，报 TS2345。
- 把鼠标停在 `longer` 上：类型是 `number[]` 而不是 `{ length: number }`。返回 `T` 保留了实参的完整类型，这正是用泛型而不是直接写 `(value: { length: number })` 的原因。
:::

## 约束不是 T 本身

一个常见的错误：返回类型是 `T`，却返回了一个“只满足约束”的新对象。约束只说明 `T` **至少**有哪些属性，而 `T` 可能是任何更具体的类型：调用方传入数组，期待拿回数组，你却给了一个 `{ length: … }` 普通对象。

:::playground{#constrained-values expect="2322@main.ts:5"}
```ts file=main.ts
function atLeast<T extends { length: number }>(value: T, min: number): T {
  if (value.length >= min) {
    return value;
  }
  return { length: min };
}

console.log(atLeast([1, 2, 3], 2));
```
- 第 5 行报 TS2322，提示 `T` 可能是约束的“另一个子类型”。如果调用 `atLeast([1], 5)`，调用方以为拿到的是 `number[]`，实际却是 `{ length: 5 }`，调用数组方法时就会出错。
:::

## keyof 与索引访问类型

两个新的类型运算符：

- `keyof T`：`T` 所有键组成的字面量联合。`keyof { name: string; age: number }` 就是 `'name' | 'age'`。
- `T[K]`：**索引访问类型**，`T` 中键 `K` 对应的值的类型。`User['age']` 是 `number`；`K` 是联合时，结果也是联合。

注意它们都是**类型层面**的写法：`User['age']` 写在类型的位置，和运行时的 `user['age']` 不是一回事。

:::playground{#keyof expect="2322@main.ts:8"}
```ts file=main.ts
type User = { name: string; age: number; admin: boolean };

type UserKey = keyof User;
type Age = User['age'];
type NameOrAge = User['name' | 'age'];

const key: UserKey = 'age';
const wrong: UserKey = 'email';
const age: Age = 36;
const value: NameOrAge = 'Ada';
console.log(key, age, value, wrong);
```
- 把鼠标停在 `UserKey`、`Age`、`NameOrAge` 上，看展开后的类型。
- 第 8 行：`'email'` 不是 `User` 的键，报 TS2322。
:::

## K extends keyof T：返回类型随键变化

把两者和泛型约束结合起来：`K extends keyof T` 要求 `K` 必须是 `T` 的某个键，返回类型 `T[K]` 就是这个键对应的值类型。调用时传入哪个键，就得到哪个键的准确类型。

:::playground{#get-prop expect="2345@main.ts:10"}
```ts file=main.ts
function getProp<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { name: 'Ada', age: 36 };
const name = getProp(user, 'name');
const age = getProp(user, 'age');
console.log(name.toUpperCase(), age + 1);

getProp(user, 'email');
```
- 把鼠标停在 `name` 和 `age` 上：分别是 `string` 和 `number`。
- 第 10 行：`'email'` 不是 `user` 的键，报 TS2345。
- 对比 b11 的挑战：那里为每个键写了一个重载签名，这里一个签名就够了，新增设置项时也不用修改函数。
:::

::exercise{#pluck}

## 编程挑战

::exercise{#typed-store}

::quiz

## 常见错误

- **在泛型函数里使用约束之外的属性**：先在约束中声明它。
- **返回类型写 `T`，却返回了只满足约束的新对象**：TS2322，改成返回约束类型，或者返回基于参数构造的值。
- **把 `keyof T` 当成运行时的值**：它只是类型。运行时用 `Object.keys`（返回 `string[]`，b02 解释过原因）。
- **用 `string` 代替 `keyof T`**：任意字符串都能传入，拼错的键要到运行时才暴露。

## 下一步

下一课讲三个和“告诉编译器更多信息”有关的工具：类型断言 `as`、`as const` 和 `satisfies`，以及它们的风险和区别。
