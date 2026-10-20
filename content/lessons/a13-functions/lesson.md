---
version: 1
mode: ts
estimatedMinutes: 35
review: ai-draft
problem: JavaScript 有三种写函数的方式，现代代码里箭头函数最常见。函数还是“值”，可以赋给变量、作为参数传递——后面的数组方法、事件处理、React 组件都建立在这一点上。另外，JavaScript 本身不检查参数个数，这件事完全交给了 TypeScript。
objectives:
  - 写出函数声明、函数表达式和箭头函数，知道箭头函数返回对象字面量要加括号
  - 使用可选参数、默认参数和剩余参数，知道 TypeScript 会检查参数个数和类型
  - 知道函数声明会被提升，而 const 声明的箭头函数不能在定义之前调用
  - "把函数作为参数传递，写出简单的函数类型 (n: number) => number"
references:
  - title: Functions — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions
    checked: 2026-10-20
  - title: Arrow function expressions — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions
    checked: 2026-10-20
  - title: Rest parameters — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/rest_parameters
    checked: 2026-10-20
  - title: More on Functions — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/functions.html
    checked: 2026-10-20
---

## 三种写法

:::playground{#three-forms}
```ts file=main.ts
function add(a: number, b: number): number {
  return a + b;
}

const subtract = function (a: number, b: number): number {
  return a - b;
};

const multiply = (a: number, b: number): number => a * b;

const square = (n: number) => {
  const result = n * n;
  return result;
};

console.log(add(1, 2), subtract(5, 3), multiply(4, 5), square(6));
```
- 第 1–3 行：**函数声明**，和其他语言最像。
- 第 5–7 行：**函数表达式**，把一个没有名字的函数赋给变量。
- 第 9 行：**箭头函数**。`=>` 后面直接写表达式时，表达式的值就是返回值（简洁写法），类似 Python 的 `lambda`，但不限于一个表达式。
- 第 11–14 行：箭头函数的函数体用花括号时，和普通函数一样需要 `return`。
- 返回类型可以省略，由 TypeScript 推断（`square` 推断为返回 `number`）；参数类型必须写。
:::

现代代码中，短小的函数、回调通常写成箭头函数；模块里导出的具名函数两种写法都很常见。箭头函数和普通函数在 `this` 上有重要区别，a15 再讲。

## 箭头函数返回对象：加括号

简洁写法里，`=>` 后面的 `{` 会被当成**函数体**的开始，而不是对象字面量。要返回对象，用圆括号包起来：

:::playground{#arrow-object expect="2695@main.ts:1"}
```ts file=main.ts
const makePoint = (x: number, y: number) => { x, y };
const makePointFixed = (x: number, y: number) => ({ x, y });

console.log(makePoint(1, 2), makePointFixed(1, 2));
```
- 第 1 行：`{ x, y }` 被当成了函数体，里面是一个没有意义的逗号表达式，TypeScript 报 TS2695。函数没有 `return`，返回 `undefined`。
- 第 2 行：加上圆括号后，返回的是对象 `{ x: 1, y: 2 }`。（`{ x, y }` 是 `{ x: x, y: y }` 的简写，属性名和变量名相同时可以这样写。）
:::

## 参数：可选、默认值与剩余参数

JavaScript 本身不检查调用时传了几个参数：少传的是 `undefined`，多传的被忽略。TypeScript 会严格检查个数和类型。需要灵活的参数时，明确地声明出来：

- **可选参数** `greeting?: string`：可以不传，类型包含 `undefined`。
- **默认参数** `times = 2`：不传（或传 `undefined`）时使用默认值；TypeScript 根据默认值推断类型。
- **剩余参数** `...numbers: number[]`：把剩下的所有参数收集成一个数组，类似 Python 的 `*args`、Java 的 `int... numbers`。

:::playground{#parameters expect="2554@main.ts:17, 2554@main.ts:18, 2345@main.ts:19"}
```ts file=main.ts
function greet(name: string, greeting?: string): string {
  return `${greeting ?? '你好'}，${name}`;
}

function repeat(text: string, times = 2): string {
  return text.repeat(times);
}

function sum(...numbers: number[]): number {
  let total = 0;
  for (const n of numbers) {
    total += n;
  }
  return total;
}

console.log(greet());
console.log(repeat('ha', 3, 4));
console.log(repeat('ha', '3'));
console.log(greet('Ada'), greet('Ada', '早上好'), repeat('ha'), sum(), sum(1, 2, 3));
```
- 第 17–18 行：参数个数不对，报 TS2554。
- 第 19 行：`times` 根据默认值推断为 `number`，传字符串报 TS2345。
- 可选参数和默认参数必须放在必需参数后面；剩余参数必须是最后一个。
- JavaScript 没有 Java 那样按参数类型区分的“重载”：同名函数只能有一个。需要多种调用方式时，用可选参数、默认参数或联合类型。
:::

## 提升：函数声明可以先调用后定义

**函数声明**会被提升（hoisting）：在同一作用域里，可以在定义之前调用。用 `const` 保存的函数表达式和箭头函数则不行，和 a03 讲的 `let`/`const` 一样，在声明之前不能使用：

:::playground{#hoisting expect="2448@main.ts:2, 2454@main.ts:2" run=error}
```ts file=main.ts
console.log(double(4));
console.log(triple(4));

function double(n: number): number {
  return n * 2;
}

const triple = (n: number): number => n * 3;
```
- 第 1 行正常：`double` 是函数声明。
- 第 2 行：TypeScript 报 TS2448 和 TS2454（在声明之前使用）。运行时抛出 `ReferenceError`。
:::

## 函数也是值

函数可以作为参数传给另一个函数。参数的**函数类型**写作 `(参数: 类型) => 返回类型`：

:::playground{#functions-as-values}
```ts file=main.ts
function applyTwice(fn: (n: number) => number, value: number): number {
  return fn(fn(value));
}

console.log(applyTwice((n) => n + 3, 10));
console.log(applyTwice((n) => n * n, 3));

const names = ['ada', 'grace'];
console.log(names.map((name) => name.toUpperCase()));
```
- 第 1 行：`fn` 的类型是“接收一个 `number`、返回 `number` 的函数”。
- 第 5 行：传入的箭头函数没有写参数类型，TypeScript 根据 `applyTwice` 的声明知道 `n` 是 `number`。这叫**上下文类型**（contextual typing）。
- 第 9 行：数组的 `map` 对每个元素调用传入的函数，得到新数组。a16 会详细讲 `map`、`filter` 等方法。
:::

::exercise{#average}

## 编程挑战

::exercise{#make-labeler}

::quiz

## 常见错误

- **箭头函数返回对象时忘了括号**：`() => { ok: true }` 返回的是 `undefined`。
- **在 `const` 箭头函数定义之前调用它**：会抛出 `ReferenceError`。
- **把可选参数放在必需参数前面**：TypeScript 会报错，调整顺序或改用选项对象。
- **想写 Java 式的重载**：JavaScript 中后定义的同名函数会覆盖前面的，TypeScript 会报重复声明。

## 下一步

下一课讲作用域与闭包：函数如何“记住”它被创建时的变量。
