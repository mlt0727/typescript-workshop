---
version: 1
mode: ts
estimatedMinutes: 30
review: ai-draft
problem: 上一课的 makeLabeler 返回了一个函数，这个函数在 makeLabeler 执行完很久之后被调用，却仍然能用到 prefix。这种“函数记住了它被创建时周围的变量”的能力叫闭包。事件处理、React 的 Hook、各种回调都依赖它；循环里创建函数时，它也是一类经典 bug 的来源。
objectives:
  - 理解词法作用域：函数能访问它被定义的位置周围的变量
  - 理解闭包：函数会一直持有它用到的外层变量，即使外层函数已经返回
  - 知道闭包捕获的是变量本身而不是当时的值；知道 for 循环中 let 每轮都是新变量
  - 用闭包保存私有状态，并且不把内部的可变数据直接交出去
references:
  - title: Closures — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures
    checked: 2026-10-20
  - title: Scope — MDN Glossary
    url: https://developer.mozilla.org/en-US/docs/Glossary/Scope
    checked: 2026-10-20
  - title: let（Scoping rules）— MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let
    checked: 2026-10-20
---

## 词法作用域

a03 讲过块级作用域：`let`/`const` 只在声明它的花括号里可见。函数也会形成作用域，而且可以嵌套。规则只有一条：**代码能访问它所在位置以及所有外层位置声明的变量**。这由代码**写在哪里**决定（词法作用域），而不是由函数在哪里被调用决定。

内层声明了同名变量时，会**遮蔽**外层的变量：

:::playground{#lexical-scope}
```ts file=main.ts
const label = '外层';
const site = '课程平台';

function show() {
  const label = '内层';
  console.log(label, site);
}

show();
console.log(label);
```
- 第 6 行：`label` 找到的是第 5 行的内层变量；`site` 在函数里没有声明，就向外层找，找到第 2 行。
- 第 10 行：外层的 `label` 没有被函数里的同名变量影响。
- 同名遮蔽是合法的，但容易让人看错，尽量避免。
:::

## 闭包：函数记住了外层变量

函数可以作为返回值。被返回的函数仍然能访问它被创建时外层函数里的变量，即使外层函数已经执行完毕。这样的“函数 + 它记住的外层变量”就是**闭包**（closure）。

:::playground{#counter}
```ts file=main.ts
function makeCounter() {
  let count = 0;
  return () => {
    count++;
    return count;
  };
}

const a = makeCounter();
const b = makeCounter();
console.log(a(), a(), a());
console.log(b());
```
- 每次调用 `makeCounter` 都会创建一个**新的** `count` 变量，返回的函数记住的是属于自己的那一个。所以 `a` 数到 3，`b` 从 1 开始。
- 外面的代码无法直接读写 `count`，只能通过返回的函数改变它。闭包因此常用来保存“私有状态”。
- 和 Python 的嵌套函数相似（Python 修改外层变量需要 `nonlocal`，JavaScript 不需要）。Java 的 lambda 只能捕获“实际上不变”（effectively final）的局部变量，JavaScript 没有这个限制。
:::

## 捕获的是变量，不是当时的值

闭包记住的是**变量本身**。变量之后被修改，闭包读到的是新值：

:::playground{#live-binding}
```ts file=main.ts
let message = '早上好';
const say = () => message;

message = '晚上好';
console.log(say());
```
- 输出 `晚上好`：`say` 在调用时才去读取 `message`，读到的是当时的值。
:::

这在循环里尤其重要。`for (let i = …)` 的每一轮都会创建一个**新的** `i`，所以每轮创建的函数记住的是各自的 `i`。老代码中的 `var` 只有一个变量，所有函数共享它：

:::playground{#loop-closures}
```ts file=main.ts
const withLet: (() => number)[] = [];
for (let i = 0; i < 3; i++) {
  withLet.push(() => i);
}

const withVar: (() => number)[] = [];
for (var j = 0; j < 3; j++) {
  withVar.push(() => j);
}

console.log(withLet.map((f) => f()));
console.log(withVar.map((f) => f()));
```
- 第 1 行的类型 `(() => number)[]` 表示“元素是无参数、返回 `number` 的函数的数组”。
- 第 11 行输出 `[ 0, 1, 2 ]`；第 12 行输出 `[ 3, 3, 3 ]`：三个函数共享同一个 `j`，调用时循环早已结束，`j` 是 `3`。这是使用 `var` 时代非常常见的 bug，也是本课程禁止 `var` 的原因之一。
- Python 的 `[lambda: i for i in range(3)]` 也有同样的问题（三个函数都返回 `2`）；JavaScript 的 `let` 每轮新建变量，正好避免了它。
:::

## 不要把内部的可变数据直接交出去

用闭包保存状态时，如果把内部的数组或对象直接返回，外面的代码拿到的是**同一个引用**（a11），就能绕过你设计的接口修改内部状态。返回副本：

:::playground{#leak}
```ts file=main.ts
function makeLog() {
  const entries: string[] = [];
  return {
    add: (text: string) => {
      entries.push(text);
    },
    all: () => entries,
    copy: () => [...entries],
  };
}

const log = makeLog();
log.add('登录');
log.all().push('伪造的记录');
log.copy().push('这条不会生效');
console.log(log.copy());
```
- 第 14 行通过 `all()` 拿到了内部数组本身，直接写入了一条记录。
- 第 15 行修改的是副本，不影响内部状态。最终输出 `[ '登录', '伪造的记录' ]`。
- 返回的对象里的 `add`、`all`、`copy` 都是闭包，共享同一个 `entries`。
:::

::exercise{#make-counter}

## 编程挑战

::exercise{#bank-account}

::quiz

## 常见错误

- **以为闭包保存的是创建时的值**：它保存的是变量，读到的是调用时的值。
- **在循环里用 `var` 创建回调**：所有回调共享同一个变量。用 `let` 或 `const`。
- **把状态放在函数外面的模块变量里**：所有“实例”会共享同一份状态。每次调用工厂函数时在函数内部创建状态。
- **直接返回内部的数组或对象**：外部可以绕过接口修改它。返回副本。

## 下一步

下一课讲 `this`：它的值取决于函数**如何被调用**，而不是写在哪里——这正好和本课的词法作用域相反，也是箭头函数与普通函数最重要的区别。
