---
version: 1
mode: ts
estimatedMinutes: 30
review: ai-draft
problem: 声明变量时要做两个决定：它以后会不会被重新赋值（let 还是 const），以及要不要自己写类型。选错了，要么错过 TypeScript 的保护，要么写出一堆多余的注解。
objectives:
  - 正确选择 let 与 const，知道 const 只禁止重新赋值、不禁止修改对象内容
  - 理解块级作用域，并知道为什么不再使用 var
  - 理解类型推断：知道 TypeScript 会为哪些声明推断出什么类型
  - 判断什么时候需要写类型注解（函数参数、无初始值的变量、需要更宽的类型时）
references:
  - title: let — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let
    checked: 2026-10-20
  - title: const — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const
    checked: 2026-10-20
  - title: var — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/var
    checked: 2026-10-20
  - title: Everyday Types（Type Annotations on Variables）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
    checked: 2026-10-20
  - title: Type Inference — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/type-inference.html
    checked: 2026-10-20
---

## let 与 const

现代 JavaScript 用两个关键字声明变量：

- `const`：声明后**不能重新赋值**。默认优先使用它。
- `let`：之后需要重新赋值时使用（计数器、循环变量、逐步累加的结果）。

注意 `const` 管的是“这个名字绑定到哪个值”，不是“值本身能不能改”。和 Java 的 `final` 一样：`const` 对象的属性仍然可以修改。

:::playground{#let-const expect="2588@main.ts:5" run=error}
```ts file=main.ts
let score = 80;
score = score + 5;

const maxScore = 100;
maxScore = 120;

const player = { name: 'Ada', level: 1 };
player.level = 2;

console.log(score, maxScore, player);
```
- 第 5 行给 `const` 变量重新赋值，TypeScript 报 TS2588。这个错误不只是“类型问题”：运行一下，JavaScript 会在第 5 行抛出 `TypeError`，后面的代码都不会执行。
- 删掉第 5 行再运行，输出 `85 100 { name: 'Ada', level: 2 }`。
- 第 8 行修改了 `const` 对象的属性，这是允许的：`player` 仍然指向同一个对象。
:::

## 块级作用域，以及为什么不用 var

`let` 和 `const` 是**块级作用域**（block scope）：只在声明它的那对花括号 `{ … }` 里可见，和 Java、C++ 一样。Python 没有块级作用域——`if` 里赋值的变量在外面也能用，这个习惯在 JavaScript 里要改掉。

老代码里还会看到 `var`。它只有**函数作用域**，会“漏”出代码块，而且在声明之前就能访问（值是 `undefined`），容易引出难以察觉的 bug。新代码不要使用 `var`。

:::playground{#block-scope expect="2304@main.ts:7" run=error}
```ts file=main.ts
{
  var leaked = 'var 声明的变量';
  let scoped = 'let 声明的变量';
}

console.log(leaked);
console.log(scoped);
```
- 第 1–4 行是一个单独的代码块（JavaScript 允许单独写一对花括号）。
- `var` 声明的 `leaked` 漏到了块外，第 6 行正常输出；`let` 声明的 `scoped` 在块外不存在，TypeScript 报 TS2304，运行时抛出 `ReferenceError`。
:::

## 类型推断：大多数时候不用写类型

TypeScript 会根据初始值**推断**（infer）变量的类型，所以下面这些声明都不需要写注解。把鼠标停在变量名上看推断结果：

:::playground{#inference}
```ts file=main.ts
let count = 0;
let title = '欢迎';
const greeting = '欢迎';
const enabled = true;

count = count + 1;
title = '再见';

console.log(count, title, greeting, enabled);
```
- `count` 推断为 `number`，`title` 推断为 `string`。
- `greeting` 推断为 `"欢迎"`，`enabled` 推断为 `true`：`const` 永远不会被重新赋值，所以 TypeScript 推断出更精确的**字面量类型**（literal type），即“只能是这一个值”的类型。`let` 以后可能被赋成别的字符串，所以推断为更宽的 `string`。字面量类型在 B 阶段详讲。
- 试着在第 7 行之后加一行 `count = '一';`：TypeScript 会报错，因为 `count` 已被推断为 `number`。
:::

## 什么时候要写类型注解

类型注解的写法是在名字后面加 `: 类型`。以下情况需要（或应该）写：

1. **函数参数**：TypeScript 不会根据调用处推断参数类型，参数不写类型会报“隐式 any”错误（TS7006）。
2. **没有初始值的变量**：例如 `let message: string;`，稍后才赋值。
3. **你需要比推断结果更宽（或更窄）的类型**：例如一个变量可能存数字或字符串。
4. **公开的函数返回值**：返回类型可以推断，但写出来能防止实现被意外改坏，也是给调用者的文档。

:::playground{#when-annotate expect="7006@main.ts:1"}
```ts file=main.ts
function double(n) {
  return n * 2;
}

let message: string;
const hour = 9;
if (hour < 12) {
  message = '上午好';
} else {
  message = '下午好';
}

console.log(double(21), message);
```
- 第 1 行参数 `n` 没有类型，TypeScript 报 TS7006。改成 `n: number` 后错误消失，而且鼠标停在 `double` 上能看到返回类型被推断为 `number`。
- 第 5 行 `message` 先声明、后赋值，所以写了注解。如果某个分支忘了赋值就使用它，TypeScript 会报“使用前未赋值”（TS2454）。
:::

::exercise{#choose-declarations}

## 编程挑战

::exercise{#coupon-price}

::quiz

## 常见错误

- **把 `const` 理解为“值不可变”**：它只禁止重新赋值，对象和数组的内容仍然可以修改。
- **到处写类型注解**：`const name: string = 'Ada'` 并不比 `const name = 'Ada'` 更安全，反而丢掉了更精确的字面量类型。把注解留给参数、无初始值的变量和公开的返回值。
- **沿用 Python 的作用域习惯**：在 `if` 或循环里用 `let` 声明的变量，出了代码块就不存在了。
- **使用 `var`**：现代代码没有理由使用它。

## 下一步

下一课讲 `number`、`string`、`boolean` 三种基本类型与模板字符串，包括与 Python/Java 不同的数字规则。
