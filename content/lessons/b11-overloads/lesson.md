---
version: 1
mode: ts
estimatedMinutes: 30
review: self-reviewed
problem: Java 可以写几个同名方法，按参数类型自动选择调用哪一个。JavaScript 不行（a13）：一个名字只能有一个函数实现。但有时一个函数确实有几种调用方式，而且返回类型取决于传入了什么。TypeScript 的重载签名可以描述这种情况——它只存在于类型层面，实现仍然只有一个，而且大多数时候联合类型就足够了。
objectives:
  - 写出多个重载签名加一个实现签名，知道调用方看不到实现签名
  - 知道重载适合“返回类型取决于参数”的情况，也知道联合类型的参数可能匹配不上任何签名
  - 按 Handbook 的建议，能用联合类型解决时优先用联合类型
  - 知道重载的顺序：更具体的签名写在前面
references:
  - title: More on Functions（Function Overloads）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/functions.html
    checked: 2026-10-20
---

## 重载签名与实现签名

TypeScript 的函数重载由两部分组成：

1. 若干**重载签名**：只有签名、没有函数体，描述调用方可以用哪些方式调用；
2. 一个**实现签名**：带函数体，参数要能兼容所有重载签名。它对调用方**不可见**。

运行时只有那一个实现：编译后重载签名全部消失。实现内部要自己判断是哪一种调用方式。

:::playground{#overloads expect="2575@main.ts:13"}
```ts file=main.ts
function makeDate(timestamp: number): Date;
function makeDate(year: number, month: number, day: number): Date;
function makeDate(yearOrTimestamp: number, month?: number, day?: number): Date {
  if (month !== undefined && day !== undefined) {
    return new Date(yearOrTimestamp, month - 1, day);
  }
  return new Date(yearOrTimestamp);
}

const epoch = makeDate(0);
const today = makeDate(2026, 10, 20);
console.log(epoch.getTime(), today.getFullYear(), today.getMonth() + 1, today.getDate());
makeDate(2026, 10);
```
- 第 1、2 行是重载签名：可以传 1 个参数，也可以传 3 个参数。
- 第 3 行是实现签名。虽然它允许只传 2 个参数（`day` 是可选的），但调用方看不到它，所以第 13 行报 TS2575：没有接受 2 个参数的重载。
- `new Date(年, 月, 日)` 的月份从 0 开始，所以第 5 行减了 1。
- 点击“查看 JS”：只剩下最后一个函数。
:::

## 返回类型取决于参数

重载最有价值的场景是：**不同的参数类型对应不同的返回类型**。只用一个签名的话，返回类型只能写成联合，调用方每次都要自己收窄。

但重载有一个明显的限制：调用时，TypeScript 会**逐个**尝试重载签名，实参必须能赋值给某一个签名的参数。联合类型的实参只有在某个签名接受**整个联合**时才能匹配。

:::playground{#return-depends expect="2769@main.ts:13"}
```ts file=main.ts
function parseInput(input: string): number;
function parseInput(input: string[]): number[];
function parseInput(input: string | string[]): number | number[] {
  return Array.isArray(input) ? input.map((s) => Number(s)) : Number(input);
}

const one = parseInput('42');
const many = parseInput(['1', '2']);
console.log(one + 1, many.length);

const fromUser: string | string[] = Math.random() > 0.5 ? '7' : ['7'];
console.log(fromUser);
parseInput(fromUser);
```
- 把鼠标停在 `one` 和 `many` 上：分别是 `number` 和 `number[]`，不需要再收窄。
- 第 13 行：参数是 `string | string[]`，既不完全符合第一个签名，也不完全符合第二个，报 TS2769。需要再加一个接受联合类型的重载签名才行。
:::

## 能用联合类型时，就不用重载

Handbook 的建议很明确：**能用联合类型参数解决的，就不要写重载。** 当返回类型不随参数变化时，重载只会让函数更难用：

:::playground{#prefer-union}
```ts file=main.ts
function lengthOf(value: string | readonly unknown[]): number {
  return value.length;
}

console.log(lengthOf('你好'), lengthOf([1, 2, 3]));

const something: string | number[] = Math.random() > 0.5 ? 'abc' : [1, 2];
console.log(lengthOf(something));
```
- 一个签名就覆盖了字符串和数组，联合类型的参数也能直接传入。
- 如果写成两个重载，第 8 行反而会报错。
:::

最后两条规则：

- **更具体的签名写在前面**：TypeScript 按顺序匹配，排在前面的宽泛签名会“截走”所有调用。例如 `f(x: unknown): unknown` 写在 `f(x: string): string` 前面，`f('a')` 的类型就是 `unknown`——而且编译器**不会提醒**你写反了。
- **实现签名必须兼容所有重载**：否则报 TS2394。实现签名通常写得比较宽，里面再收窄。
- **编译器不会逐一核对实现**：它只检查实现签名和重载签名在形式上兼容，不检查“传入字符串时是否真的返回了字符串”。实现里返回了错误的类型，TypeScript 也发现不了（和 b08 中写错的类型守卫一样）。重载签名是你对调用方的承诺，要靠测试来保证。

b14、b15 学完泛型和泛型约束后，很多原本需要重载的情况（例如“根据传入的键返回对应的值类型”）可以写得更简洁。

::exercise{#first-item}

## 编程挑战

::exercise{#setting-overloads}

::quiz

## 常见错误

- **以为可以像 Java 一样写多个实现**：只有一个实现，在里面自己判断。
- **用重载描述返回类型相同的情况**：用联合类型参数。
- **宽泛的签名写在前面**：后面的具体签名永远匹配不到。
- **传入联合类型的参数**：重载逐个匹配，联合类型匹配不上任何一个。

## 下一步

下一课进入类：字段、构造函数、方法、访问控制，以及 TypeScript 特有的参数属性。
