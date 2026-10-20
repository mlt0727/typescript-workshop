---
version: 1
mode: ts
estimatedMinutes: 30
review: ai-draft
problem: 在 Java 里，方法中的 this 永远是当前对象；在 Python 里，self 是显式写出的参数。JavaScript 的 this 不同：普通函数里的 this 由“怎么调用”决定，同一个方法换一种调用方式，this 就可能变成 undefined。箭头函数又完全没有自己的 this。把方法当作回调传出去时，这个差异就会变成运行时错误，而且 TypeScript 往往发现不了。
objectives:
  - 知道普通函数的 this 由调用方式决定：obj.method() 时 this 是 obj
  - 知道把方法单独取出或作为回调传递会丢失 this，并会用箭头函数包装或 bind 修复
  - 知道箭头函数没有自己的 this，它使用外层的 this，适合写在方法内部的回调
  - 认识 TypeScript 能发现的 this 问题（TS2683、TS2684）和发现不了的情况
references:
  - title: this — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this
    checked: 2026-10-20
  - title: Arrow function expressions（No separate this）— MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions
    checked: 2026-10-20
  - title: Function.prototype.bind() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind
    checked: 2026-10-20
  - title: More on Functions（Declaring this in a Function）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/functions.html
    checked: 2026-10-20
---

## this 由调用方式决定

对象里可以定义**方法**：`increment() { … }` 是 `increment: function () { … }` 的简写。用 `对象.方法()` 调用时，方法里的 `this` 就是点号前面的那个对象。

关键在于：`this` 是在**调用时**确定的，不是在定义时。把方法取出来单独调用，点号前面没有对象了，`this` 就是 `undefined`（在模块和严格模式下；本平台的代码都是模块）：

:::playground{#method-this run=error}
```ts file=main.ts
const counter = {
  count: 0,
  increment() {
    this.count++;
    return this.count;
  },
};

console.log(counter.increment(), counter.increment());

const inc = counter.increment;
console.log(inc());
```
- 第 9 行：`this` 是 `counter`，输出 `1 2`。
- 第 11–12 行：`inc` 和 `counter.increment` 是同一个函数，但这次调用时点号前面没有对象，`this` 是 `undefined`，运行时抛出 `TypeError`。
- **TypeScript 没有报错**：它不跟踪函数被取出后会怎样调用。这类错误只能靠理解规则来避免。
:::

## 作为回调传递时丢失 this

把方法直接传给 `forEach`、`map`、`setTimeout` 或事件监听器，和上面的“取出来单独调用”是一回事：调用它的是别的代码，不会以 `对象.方法()` 的形式调用。

修复方法有两种：

- 用箭头函数包一层：`(m) => logger.log(m)`，这样调用时又回到了 `logger.log(…)` 的形式。（最常用）
- 用 `bind` 创建一个 `this` 固定的新函数：`logger.log.bind(logger)`。

:::playground{#callback run=error}
```ts file=main.ts
const logger = {
  prefix: '[日志]',
  log(message: string) {
    console.log(`${this.prefix} ${message}`);
  },
};

const messages = ['开始', '结束'];
messages.forEach((m) => logger.log(m));
messages.forEach(logger.log.bind(logger));
messages.forEach(logger.log);
```
- 第 9、10 行正常输出。
- 第 11 行运行时抛出 `TypeError`：`forEach` 调用 `log` 时没有提供 `this`。TypeScript 同样没有报错。
:::

## 箭头函数没有自己的 this

箭头函数不会根据调用方式确定 `this`，它直接使用**定义位置外层的 `this`**（和 a14 的词法作用域一样）。这带来两个结论：

1. **不要用箭头函数写对象的方法**：外层是模块顶层，那里的 `this` 是 `undefined`。
2. **在方法内部的回调里，用箭头函数**：它使用的正是方法的 `this`。用普通 `function` 写回调，回调会有自己的 `this`，而它在被调用时是 `undefined`。

:::playground{#arrow-this expect="2532@main.ts:4, 2683@main.ts:13"}
```ts file=main.ts
const timer = {
  seconds: 0,
  tick: () => {
    this.seconds++;
  },
};

const cart = {
  prices: [30, 50],
  rate: 0.9,
  totalsWithFunction() {
    return this.prices.map(function (price) {
      return price * this.rate;
    });
  },
  totalsWithArrow() {
    return this.prices.map((price) => price * this.rate);
  },
};

console.log(cart.totalsWithArrow());
```
- 第 4 行：箭头函数里的 `this` 来自模块顶层，是 `undefined`，TypeScript 报 TS2532。
- 第 13 行：普通函数作为回调，有自己的 `this`，TypeScript 不知道它是什么类型，报 TS2683。
- 第 17 行：箭头函数使用 `totalsWithArrow` 的 `this`，也就是 `cart`。输出 `[ 27, 45 ]`。
:::

## 给 this 声明类型

TypeScript 允许在普通函数的**第一个参数位置**声明 `this` 的类型。它只用于类型检查，编译后会被擦除，调用时也不需要传：

:::playground{#this-parameter expect="2684@main.ts:7" run=error}
```ts file=main.ts
function describe(this: { name: string }): string {
  return `我是 ${this.name}`;
}

const user = { name: 'Ada', describe: describe };
console.log(user.describe());
describe();
```
- 第 6 行：通过 `user.describe()` 调用，`this` 是 `user`，满足声明，输出 `我是 Ada`。
- 第 7 行：直接调用时 `this` 是 `undefined`，不满足声明，TypeScript 报 TS2684。运行一下，这一行确实抛出了 `TypeError`——声明 `this` 的类型，就是把这类运行时错误提前到了编译期。
:::

现代 TypeScript 代码越来越少依赖 `this`：用闭包（a14）保存状态、用普通函数和箭头函数组合，可以完全避开这些问题。React 的函数组件就是这样做的。类（B 阶段）里仍然会大量用到 `this`，规则和这里完全一样。

::exercise{#arrow-callback}

## 编程挑战

::exercise{#stopwatch}

::quiz

## 常见错误

- **把方法直接作为回调传递**：`list.forEach(obj.method)` 会丢失 `this`。写成 `list.forEach((x) => obj.method(x))`。
- **用箭头函数定义对象的方法**：箭头函数没有自己的 `this`。
- **在方法里用 `function` 写回调**：回调有自己的 `this`。改用箭头函数。
- **以为 TypeScript 会发现所有 `this` 错误**：取出方法后单独调用的情况，它通常发现不了。

## 下一步

下一课讲数组的 `map`、`filter`、`reduce`、`find` 等方法：用一个回调函数描述“对每个元素做什么”。
