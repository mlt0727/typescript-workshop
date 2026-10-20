---
version: 1
mode: ts
estimatedMinutes: 40
review: ai-draft
problem: "JavaScript 的 class 和 Java 的类长得很像：字段、构造函数、方法、new。但有几处关键不同：TypeScript 的 private 只在编译期有效，运行时真正私有的是 JavaScript 自己的 #字段；字段必须初始化；方法作为回调传出去会丢失 this（a15）；还有一些 TypeScript 特有的简写，在现代的“只擦除类型”工具链里已经不推荐使用。"
objectives:
  - 用 class 定义字段、构造函数、方法，知道严格模式要求字段被初始化
  - "区分 TypeScript 的 private/protected（编译期）和 JavaScript 的 #私有字段（运行时）"
  - 使用 readonly 字段、getter/setter 和 static 成员
  - 知道参数属性在 erasableSyntaxOnly 下不可用，以及类的方法作为回调时如何保留 this
references:
  - title: Classes — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/classes.html
    checked: 2026-10-20
  - title: Private elements — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_elements
    checked: 2026-10-20
  - title: erasableSyntaxOnly — TSConfig Reference
    url: https://www.typescriptlang.org/tsconfig/#erasableSyntaxOnly
    checked: 2026-10-20
---

## 字段、构造函数、方法

类的写法和 Java 很接近。不同点：字段要写在类体里（不需要类型前缀，类型写在名字后面）；构造函数叫 `constructor`；访问字段和方法必须写 `this.`。

在严格模式下，TypeScript 要求每个字段**都被初始化**：要么在声明处给初始值，要么在构造函数里赋值，否则报 TS2564（`strictPropertyInitialization`）。

:::playground{#class-basics expect="2564@main.ts:20"}
```ts file=main.ts
class Counter {
  count = 0;
  readonly label: string;

  constructor(label: string) {
    this.label = label;
  }

  increment(): number {
    this.count++;
    return this.count;
  }
}

const clicks = new Counter('点击');
clicks.increment();
console.log(clicks, clicks instanceof Counter);

class Forgotten {
  name: string;
}
console.log(new Forgotten());
```
- 第 2 行：有初始值，类型推断为 `number`。
- 第 3 行：`readonly` 字段只能在声明处或构造函数里赋值（b03）。
- 第 20 行：`name` 既没有初始值，也没有在构造函数里赋值，报 TS2564。运行一下，第 22 行输出 `Forgotten { name: undefined }`：类型说它是 `string`，实际是 `undefined`。
- 类是 JavaScript 的真实语法，运行时存在，所以可以用 `instanceof`（a02、b07）。
:::

## private 与 #私有字段

TypeScript 的 `private` 和 `protected` 与 Java 的含义相似，但**只在编译期检查**：编译后它们被擦除，字段在运行时就是普通属性，`JSON.stringify`、`Object.keys` 都能看到。

JavaScript 自己有真正私有的字段：名字以 `#` 开头。类外部的代码在运行时也无法读取它（直接写 `obj.#x` 甚至是语法错误）。需要真正隐藏数据时，用 `#` 字段。

:::playground{#private expect="2341@main.ts:21"}
```ts file=main.ts
class Account {
  private owner: string;
  #balance = 0;

  constructor(owner: string) {
    this.owner = owner;
  }

  deposit(amount: number): void {
    this.#balance += amount;
  }

  get balance(): number {
    return this.#balance;
  }
}

const account = new Account('Ada');
account.deposit(100);
console.log(account.balance, JSON.stringify(account), Object.keys(account));
console.log(account.owner);
```
- 第 20 行：`JSON.stringify` 和 `Object.keys` 都包含了 `private` 的 `owner`，但没有 `#balance`。
- 第 21 行：TypeScript 拒绝在类外访问 `private` 字段（TS2341）；但运行一下，这一行照样输出了 `Ada`——编译期的限制在运行时不存在。
- 第 13 行是一个 **getter**：用 `account.balance` 读取，不加括号。对应地，`set balance(value) { … }` 定义 setter。
:::

## static 成员，以及不推荐的参数属性

`static` 成员属于类本身，而不是实例，用 `类名.成员` 访问，常用于常量和工厂方法。

TypeScript 还有一种简写叫**参数属性**：`constructor(private readonly name: string) {}` 会自动声明并赋值字段。它不是“擦掉类型就能运行”的语法（需要生成额外的赋值代码），所以本平台开启的 `erasableSyntaxOnly` 选项会拒绝它（TS1294）。Node.js 直接运行 `.ts` 文件时也不支持它（a01）。新代码请显式声明字段。

:::playground{#static-and-parameter-properties expect="1294@main.ts:15"}
```ts file=main.ts
class Temperature {
  static readonly ABSOLUTE_ZERO = -273.15;
  readonly celsius: number;

  constructor(celsius: number) {
    this.celsius = celsius;
  }

  static fromFahrenheit(f: number): Temperature {
    return new Temperature(((f - 32) * 5) / 9);
  }
}

class User {
  constructor(private readonly id: number) {}
}

console.log(Temperature.ABSOLUTE_ZERO, Temperature.fromFahrenheit(212).celsius);
console.log(new User(1));
```
- 第 9 行：静态工厂方法，通过 `Temperature.fromFahrenheit(…)` 调用。
- 第 15 行：参数属性被拒绝，报 TS1294。改写方法就像 `Temperature` 那样：在类体中声明字段，在构造函数里赋值。
:::

## 方法作为回调

a15 讲过：方法单独取出来调用会丢失 `this`。类的方法同样如此。如果某个方法经常被当作回调传出去（例如事件处理），可以把它写成**箭头函数字段**：箭头函数没有自己的 `this`，它使用创建实例时的 `this`。

:::playground{#method-callback run=error}
```ts file=main.ts
class ClickTracker {
  clicks = 0;

  handleWithMethod(): void {
    this.clicks++;
  }

  handleWithArrow = (): void => {
    this.clicks++;
  };
}

const tracker = new ClickTracker();
const arrow = tracker.handleWithArrow;
arrow();
console.log(tracker.clicks);

const method = tracker.handleWithMethod;
method();
```
- 第 15 行：箭头函数字段在单独调用时仍然使用 `tracker` 作为 `this`，第 16 行输出 `1`。
- 第 19 行：普通方法单独调用时 `this` 是 `undefined`，抛出 `TypeError`。
- 代价：箭头函数字段在每个实例上各有一份，而普通方法所有实例共享一份。只在确实需要当作回调传递时使用。
:::

::exercise{#temperature-class}

## 编程挑战

::exercise{#lru-cache}

::quiz

## 常见错误

- **以为 `private` 会在运行时隐藏数据**：它只在编译期检查。需要真正私有时用 `#` 字段。
- **字段既没有初始值，也没在构造函数里赋值**：TS2564。
- **使用参数属性**：开启 `erasableSyntaxOnly` 时不可用，显式声明字段。
- **把类的方法直接作为回调传递**：丢失 `this`。用箭头函数包一层，或写成箭头函数字段。

## 下一步

下一课讲继承、实现接口与抽象类：`extends`、`implements`、`super`、`abstract`，以及什么时候组合比继承更合适。
