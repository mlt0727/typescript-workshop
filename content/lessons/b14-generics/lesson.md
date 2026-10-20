---
version: 1
mode: ts
estimatedMinutes: 40
review: ai-draft
problem: 写一个“返回数组第一个元素”的函数，参数类型写什么？写 number[] 就只能用于数字；写 any[] 就丢掉了类型，调用方拿到的是 any。泛型让函数对任何类型都适用，同时保留“输入是什么类型、输出就是什么类型”的关系。你其实已经用过很多泛型：Array<number>、Map<string, number>、Record<string, number>、Partial<T>。
objectives:
  - 写出带类型参数的泛型函数，理解 TypeScript 会根据实参推断类型参数
  - 定义泛型类型别名、泛型接口和泛型类，并在使用时提供类型实参
  - 知道类型参数应该把输入和输出联系起来，没有建立联系的类型参数没有意义
  - 认识类型参数的默认值，并能看懂内置泛型类型的签名
references:
  - title: Generics — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/generics.html
    checked: 2026-10-20
  - title: More on Functions（Generic Functions、Guidelines for Writing Good Generic Functions）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/functions.html
    checked: 2026-10-20
---

## 问题：any 会丢失类型

:::playground{#why-generics}
```ts file=main.ts
function firstAny(items: any[]): any {
  return items[0];
}

function first<T>(items: readonly T[]): T | undefined {
  return items[0];
}

const a = firstAny([1, 2, 3]);
const b = first([1, 2, 3]);
const c = first(['x', 'y']);
console.log(a, b, c);
```
- 把鼠标停在 `a` 上：类型是 `any`，之后对它做什么都不会被检查（b06）。
- 第 5 行的 `<T>` 声明了一个**类型参数** `T`。它像函数参数一样，代表“调用时才确定的某个类型”。
- 停在 `b`、`c` 上：分别是 `number | undefined` 和 `string | undefined`。TypeScript 根据传入的数组**推断**出 `T` 是 `number` 或 `string`，返回类型也随之确定。
- 和 Java 的泛型方法很像，区别是 TypeScript 的类型参数写在函数名后面，而且编译后被完全擦除。
:::

## 类型参数的推断与显式指定

大多数时候，类型参数由实参自动推断。推断不出来、或者推断的结果不是你想要的时候，可以在调用处用尖括号**显式指定**：`first<string | number>([…])`。

一个函数可以有多个类型参数。习惯上用 `T`、`U`，或者有意义的名字如 `TKey`、`TValue`。

:::playground{#inference}
```ts file=main.ts
function pair<A, B>(a: A, b: B): [A, B] {
  return [a, b];
}

function identity<T>(value: T): T {
  return value;
}

const p = pair('Ada', 36);
const literal = identity('hi');
let text = 'hi';
const widened = identity(text);
const mixed = identity<string | number>(42);
console.log(p, literal, widened, mixed);
```
- `p` 是 `[string, number]`。
- `literal` 是 `"hi"`、`widened` 是 `string`：推断遵循 b04 的拓宽规则，传入 `const` 字面量就推断出字面量类型。
- 第 13 行显式指定了 `T` 为 `string | number`，所以 `mixed` 的类型是 `string | number`。
:::

## 泛型类型与泛型类

类型别名、接口和类也可以有类型参数。使用时在名字后面写尖括号给出**类型实参**。`Array<number>`、`Map<string, number[]>`、`Record<string, number>`、`Partial<User>` 都是这样的泛型类型。

类型参数还可以有**默认值**：`type Result<T, E = string>` 在只写一个实参时，`E` 就是 `string`。

:::playground{#generic-types expect="2322@main.ts:4, 2345@main.ts:27"}
```ts file=main.ts
type Box<T> = { value: T };

const numberBox: Box<number> = { value: 1 };
const wrongBox: Box<number> = { value: '1' };

type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

const parsed: Result<number> = { ok: true, value: 42 };
const failed: Result<number> = { ok: false, error: '不是数字' };

class Stack<T> {
  #items: T[] = [];

  push(item: T): void {
    this.#items.push(item);
  }

  pop(): T | undefined {
    return this.#items.pop();
  }
}

const words = new Stack<string>();
words.push('hello');
words.push(42);
console.log(numberBox, wrongBox, parsed, failed, words.pop());
```
- 第 4 行：`Box<number>` 的 `value` 必须是数字，报 TS2322。
- 第 6 行：b09 的结果类型变成了通用的 `Result<T, E>`，`E` 默认为 `string`。
- 第 25 行：`new Stack<string>()` 创建了只能放字符串的栈，第 27 行放入数字报 TS2345。
:::

## 好的泛型：把输入和输出联系起来

Handbook 给出了几条写泛型函数的建议，最重要的一条：**类型参数应该出现在至少两个位置**，把参数之间、或者参数和返回值之间联系起来。只出现一次的类型参数没有意义，直接写具体类型（或 `unknown`）就行。

另外，在函数体内，`T` 可能是任何类型，所以**不能对它做任何假设**：例如 `value.length` 会报错，因为 `T` 可能是数字。需要“具有某些属性的任何类型”时，用下一课的**泛型约束**。

:::playground{#guidelines expect="2339@main.ts:6"}
```ts file=main.ts
function describe<T>(value: T): string {
  return String(value);
}

function lengthOf<T>(value: T): number {
  return value.length;
}

function describeBetter(value: unknown): string {
  return String(value);
}

console.log(describe(1), describeBetter([1, 2]), lengthOf('abc'));
```
- 第 1 行：`T` 只在参数里出现一次，没有和任何东西建立联系。第 9 行用 `unknown` 写出的函数效果完全相同，而且更简单。
- 第 6 行：`T` 可能是任何类型，不一定有 `length`，报 TS2339。下一课用 `T extends { length: number }` 解决。
:::

::exercise{#group-by-key}

## 编程挑战

::exercise{#result-helpers}

::quiz

## 常见错误

- **用 `any` 代替泛型**：调用方拿到 `any`，类型检查全部失效。
- **类型参数只出现一次**：它没有建立任何联系，换成具体类型或 `unknown`。
- **在泛型函数里假设 `T` 有某些属性**：需要的话用泛型约束（b15）。
- **以为泛型在运行时存在**：`T` 会被擦除，不能写 `new T()` 或 `x instanceof T`。

## 下一步

下一课讲泛型约束：`T extends …` 和 `keyof`，以及如何写出“根据键返回对应类型的值”的函数。
