---
version: 1
mode: ts
estimatedMinutes: 35
review: ai-draft
problem: 回调无处不在：数组方法、事件监听、定时器、React 的事件处理。要写一个接收回调的函数，就要描述“参数是什么样的函数”。函数类型的兼容规则和对象有些不同：少写参数可以，参数类型却不能随便放宽或收紧。理解这些规则，才能看懂 TypeScript 关于回调的报错。
objectives:
  - "用函数类型表达式 (参数: 类型) => 返回类型 描述回调，并给它起类型别名"
  - 理解参数更少的函数可以赋给参数更多的函数类型，反过来不行
  - 理解参数类型的兼容方向：处理更窄类型的函数不能用在需要处理更宽类型的地方
  - 知道回调类型中不要随意写可选参数，以及方法写法的参数检查较宽松
references:
  - title: More on Functions（Function Type Expressions、Optional Parameters in Callbacks）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/functions.html
    checked: 2026-10-20
  - title: Type Compatibility（Comparing two functions）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/type-compatibility.html
    checked: 2026-10-20
  - title: strictFunctionTypes — TSConfig Reference
    url: https://www.typescriptlang.org/tsconfig/#strictFunctionTypes
    checked: 2026-10-20
---

## 函数类型

a13 用过 `(n: number) => number` 这样的**函数类型表达式**。它和箭头函数长得很像，但它是类型：参数名只是为了可读，真正有意义的是参数和返回值的类型。常用的函数类型可以起一个别名。

:::playground{#function-types}
```ts file=main.ts
type Formatter = (value: number) => string;

const yuan: Formatter = (v) => `¥${v.toFixed(2)}`;
const percent: Formatter = (v) => `${Math.round(v * 100)}%`;

function formatAll(values: number[], format: Formatter): string[] {
  return values.map((v) => format(v));
}

console.log(formatAll([1.5, 20], yuan), formatAll([0.256, 1], percent));
```
- 第 3、4 行：变量的类型是 `Formatter`，箭头函数的参数 `v` 不需要再写类型（上下文类型，a13）。
- 第 6 行：`format` 参数接收任何符合 `Formatter` 的函数。
:::

## 参数可以更少，不能更多

把一个函数赋给某个函数类型时，**参数更少是允许的**：调用方多传的参数会被忽略（a13：JavaScript 本身就忽略多余的参数）。这就是 `forEach((item) => …)` 能通过检查的原因——`forEach` 实际会传 3 个参数。

反过来，函数**需要**的参数比函数类型提供的多，就不行了：调用方根本不会传那个参数。

:::playground{#parameter-count expect="2322@main.ts:6"}
```ts file=main.ts
type Visitor = (value: number, index: number, all: number[]) => void;
const onlyValue: Visitor = (value) => console.log(value);

type Callback = (value: number) => void;
const needsIndex = (value: number, index: number) => console.log(value, index);
const cb: Callback = needsIndex;

[10, 20].forEach(onlyValue);
```
- 第 2 行：只用一个参数，没有问题。
- 第 6 行：`needsIndex` 需要两个参数，但 `Callback` 的调用方只会传一个，报 TS2322。
:::

## 参数类型：处理范围只能更宽，不能更窄

如果一个函数类型承诺“可以处理 `string | number`”，那赋给它的函数就必须**真的能处理**字符串和数字。只能处理字符串的函数不行：调用方可能会传入数字。反过来，一个能处理任何值的函数，当然可以用在只传字符串的地方。

这条规则由 `strict` 中的 `strictFunctionTypes` 选项检查。但有一个历史遗留的例外：用**方法写法**（`handle(value: …): void`）声明的成员不按这条规则严格检查，用**属性写法**（`handle: (value: …) => void`）声明的才会检查。

:::playground{#parameter-types expect="2322@main.ts:4, 2322@main.ts:17" run=error}
```ts file=main.ts
type Handler = (value: string | number) => void;

const onlyStrings = (value: string) => console.log(value.toUpperCase());
const h1: Handler = onlyStrings;

const anything = (value: unknown) => console.log(value);
const h2: Handler = anything;

interface WithMethod {
  handle(value: string | number): void;
}
const m: WithMethod = { handle: onlyStrings };

interface WithProperty {
  handle: (value: string | number) => void;
}
const p: WithProperty = { handle: onlyStrings };

m.handle(42);
console.log(h1, h2, p);
```
- 第 4 行：`onlyStrings` 处理不了数字，报 TS2322。
- 第 7 行：能处理任何值的函数可以用在这里。
- 第 12 行：方法写法没有报错。运行一下：第 19 行 `m.handle(42)` 把数字交给了只会处理字符串的函数，抛出 `TypeError`。第 17 行用属性写法，同样的问题在编译期就被发现了。需要可靠检查的回调，用属性写法声明。
:::

## 回调类型中的可选参数

Handbook 有一条专门的建议：**给回调写函数类型时，不要把参数写成可选的，除非你确实会在不传这个参数的情况下调用它。** 回调类型里的 `?` 表示“调用方可能不传”，于是每个实现回调的人都不得不处理 `undefined`；而“回调可以少写参数”本来就是允许的，不需要 `?`。

:::playground{#optional-callback-param expect="18048@main.ts:9"}
```ts file=main.ts
function eachBad(items: number[], cb: (item: number, index?: number) => void): void {
  items.forEach((item, i) => cb(item, i));
}

function each(items: number[], cb: (item: number, index: number) => void): void {
  items.forEach((item, i) => cb(item, i));
}

eachBad([1, 2], (item, index) => console.log(item, index.toFixed()));
each([1, 2], (item, index) => console.log(item, index.toFixed()));
each([1, 2], (item) => console.log(item));
```
- 第 9 行：`index` 被声明成可选，实现回调的人必须处理 `undefined`，报 TS18048——尽管 `eachBad` 实际总是会传。
- 第 10、11 行：`index` 声明成必需参数，需要它的回调可以直接使用，不需要它的回调可以不写。
:::

::exercise{#price-steps}

## 编程挑战

::exercise{#emitter}

::quiz

## 常见错误

- **回调类型的参数写成可选**：除非真的会不传，否则写成必需参数。
- **把只能处理窄类型的函数传给需要处理宽类型的地方**：TS2322 是在提醒你调用方可能传入你没处理的值。
- **用方法写法声明回调成员**：参数检查不严格，用属性写法。
- **回调需要的参数比调用方提供的多**：调用方不会传，参数会是 `undefined`。

## 下一步

下一课讲函数重载：TypeScript 中“同一个函数，多种调用方式”的写法，以及为什么大多数时候用联合类型就够了。
