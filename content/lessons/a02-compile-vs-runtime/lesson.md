---
version: 1
mode: ts
estimatedMinutes: 30
review: self-reviewed
problem: TypeScript 能在运行前发现很多错误，但不是全部。尤其是从网络、文件、用户输入进来的数据，TypeScript 根本看不到它们的真实内容。你需要知道类型检查的边界在哪里，以及在边界上如何用运行时检查保护自己。
objectives:
  - 区分编译期错误（TypeScript 报告）与运行期错误（程序运行时抛出）
  - 理解类型擦除：TypeScript 类型在运行时不存在，不能当作值使用
  - 会用 JavaScript 的 typeof 运算符在运行时检查值的类型，并知道它的两个“意外”结果
  - 知道 JSON.parse 等外部数据入口不受类型检查保护，需要运行时检查
references:
  - title: TypeScript for the New Programmer（Erased Types）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/typescript-from-scratch.html
    checked: 2026-10-20
  - title: The Basics（Erased Types、Static type-checking）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/basic-types.html
    checked: 2026-10-20
  - title: typeof — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof
    checked: 2026-10-20
  - title: JSON.parse() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse
    checked: 2026-10-20
---

## 两种错误

- **编译期错误**：TypeScript 在运行之前分析代码时报告的错误，显示在编辑器里。
- **运行期错误**：程序运行时抛出的异常，例如 `TypeError`、`ReferenceError`，显示在输出面板里。

两者没有包含关系：有些问题只在编译期被发现（运行时甚至不会出错），有些问题只在运行期才暴露。

:::playground{#compile-only expect="2339@main.ts:4"}
```ts file=main.ts
const user = { name: 'Ada', born: 1815 };

console.log(user.name.toUpperCase());
console.log(user.age);
```
- 第 4 行：对象上没有 `age` 属性，TypeScript 报 TS2339。
- 运行一下：第 4 行并不会抛异常，只是输出 `undefined`——在 JavaScript 里读取不存在的属性是合法的。这种“静默的错误”正是 TypeScript 最有价值的地方。
- 和 Python 不同：Python 读取对象上不存在的属性会抛出 `AttributeError`。
:::

## 类型在运行时不存在

TypeScript 的类型只在编译期存在，编译后被完全**擦除**（erased）。所以类型不能当作“值”使用：

:::playground{#erased expect="2693@main.ts:5" run=error}
```ts file=main.ts
type Point = { x: number; y: number };
const origin: Point = { x: 0, y: 0 };

console.log(typeof origin);
console.log(origin instanceof Point);
```
- 第 5 行报 TS2693：`Point` 只是一个类型，却被当作值使用。运行时也确实找不到它，抛出 `ReferenceError`。
- 点击“查看 JS”：`type Point = …` 这一整行都消失了，`origin` 的注解也没了。
- `typeof origin` 是 **JavaScript 的运行时运算符**，它检查的是值本身，结果是字符串 `'object'`。运行时只知道“这是一个对象”，不知道它曾被声明为 `Point`。
:::

这和 Java 很不一样：Java 在运行时保留了类的信息，可以用 `instanceof` 判断对象的类；TypeScript 里的 `type` 和 `interface` 在运行时什么都不剩。（`class` 是例外：类是 JavaScript 的真实语法，运行时存在，可以用 `instanceof`，后面的课会讲。）

## 用 typeof 做运行时检查

需要在运行时判断一个值是什么时，用 JavaScript 自己的工具。最基础的是 `typeof`，它返回一个描述值类型的字符串：

:::playground{#typeof-values}
```ts file=main.ts
console.log(typeof 42, typeof 'hi', typeof true, typeof undefined);
console.log(typeof { a: 1 }, typeof [1, 2], typeof null);
console.log(typeof console.log);
console.log(Array.isArray([1, 2]), Array.isArray({ a: 1 }));
```
- 注意两个“意外”：`typeof null` 是 `'object'`（JavaScript 早期设计遗留的问题），数组的 `typeof` 也是 `'object'`。判断数组要用 `Array.isArray`。
- `typeof` 在 TypeScript 里还有另一种用法（写在类型的位置，用来“取得某个变量的类型”），C 阶段会讲。这一课说的都是运行时的 `typeof`。
:::

TypeScript 会理解这些运行时检查：在 `if (typeof value === 'string')` 的分支里（`===` 是严格相等，a06 会讲为什么不用 `==`），它知道 `value` 一定是字符串，于是允许你使用字符串的方法。这叫**类型收窄**（narrowing），B 阶段会系统讲解，下面的小任务先体验一下。

::exercise{#describe-value}

## 外部数据：类型检查的盲区

`JSON.parse` 把 JSON 文本变成 JavaScript 值，但 TypeScript 在编译期不可能知道文本的内容，所以它的返回类型是 `any`——一种**关闭类型检查**的特殊类型（B 阶段详讲）。把它赋给一个带类型注解的变量时，TypeScript 会**无条件相信**这个注解：

:::playground{#json-boundary run=error}
```ts file=main.ts
type User = { name: string };

const text = '{ "name": 42 }';
const user: User = JSON.parse(text);

console.log('TypeScript 认为 name 是字符串，实际是：', typeof user.name);
console.log(user.name.toUpperCase());
```
- 编辑器里没有任何错误，但运行时第 7 行抛出 `TypeError`：`name` 实际上是数字，没有 `toUpperCase` 方法。
- 来自网络、文件、用户输入的数据都是这样：**类型注解只是你的声明，不是检查**。在这些边界上要写运行时检查（E 阶段有专门一课讲运行时数据校验）。
:::

## 编程挑战

::exercise{#read-port}

::quiz

## 常见误区

- **把类型当作值使用**：`if (x instanceof SomeType)` 对 `type`/`interface` 无效。运行时检查要用 `typeof`、`Array.isArray`、`instanceof`（用于类）等 JavaScript 工具。
- **用 `typeof x === 'object'` 判断“是对象”**：`null` 和数组也会得到 `'object'`，需要额外排除。
- **相信外部数据的类型注解**：`const user: User = JSON.parse(text)` 不会检查任何东西。

## 下一步

下一课讲 `let`/`const`、类型注解与类型推断：什么时候需要自己写类型，什么时候交给 TypeScript 推断。
