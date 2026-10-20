---
version: 1
mode: ts
estimatedMinutes: 35
review: self-reviewed
problem: 继承、接口、抽象类这些概念你在 Java 里都见过。TypeScript 的写法几乎一样，但有三处需要重新认识：implements 只是一项检查，不会给方法参数提供类型；子类构造函数必须先调用 super；覆盖父类方法时最好写 override，让拼写错误在编译期暴露。此外，JavaScript 社区普遍更偏好组合而不是深层的继承。
objectives:
  - 用 extends 继承类，在构造函数中先调用 super，用 super.方法() 调用父类实现
  - 用 override 标记覆盖的方法，理解它和 noImplicitOverride 各自能发现的错误
  - 用 implements 检查类是否满足接口，知道它不会为方法参数提供类型
  - 用 abstract 定义不能直接实例化、要求子类实现某些方法的基类
references:
  - title: Classes（Class Heritage、abstract Classes and Members）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/classes.html
    checked: 2026-10-20
  - title: noImplicitOverride — TSConfig Reference
    url: https://www.typescriptlang.org/tsconfig/#noImplicitOverride
    checked: 2026-10-20
  - title: extends — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/extends
    checked: 2026-10-20
compiler:
  overrides: { noImplicitOverride: true }
  note: 本课开启 noImplicitOverride，要求覆盖父类方法时写 override。它不在 strict 中，但推荐在项目里开启。
---

## extends 与 super

`class 子类 extends 父类` 继承父类的字段和方法。子类的构造函数**必须先调用 `super(…)`**（父类的构造函数），之后才能使用 `this`——这和 Java 要求先调用 `super(...)` 是同一个道理（Java 25 之前要求它写在构造函数第一行），JavaScript 允许在调用 `super` 之前执行不涉及 `this` 的代码。

覆盖父类的方法时，写上 `override` 关键字；在方法里用 `super.方法名()` 调用父类的实现。

:::playground{#extends expect="17009@main.ts:24" run=error}
```ts file=main.ts
class Animal {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  speak(): string {
    return `${this.name} 发出声音`;
  }
}

class Dog extends Animal {
  override speak(): string {
    return `${super.speak()}：汪汪`;
  }
}

const dog = new Dog('旺财');
console.log(dog.speak(), dog instanceof Animal);

class Cat extends Animal {
  constructor(name: string) {
    this.name = `猫：${name}`;
    super(name);
  }
}
new Cat('咪咪');
```
- 第 13 行：`Dog` 没有写构造函数，会自动使用父类的构造函数。
- 第 15 行：`super.speak()` 调用父类的实现，再在后面加上自己的内容。
- 第 24 行：在 `super(…)` 之前使用了 `this`，报 TS17009；运行时也确实抛出 `ReferenceError`。
:::

父类中用 `protected` 声明的成员，子类可以访问，类的外部不行（b12 提过，它同样只在编译期检查）。和 Java 不同，TypeScript 没有“包”的概念，`protected` 不包含包访问权限。

## override 与 noImplicitOverride

`override` 关键字本身就会触发检查：写了 `override` 但父类没有这个方法，报 TS4113（如果有名字相近的方法，报 TS4117 并提示“你是不是想写……”）。最常见的原因是**拼错了方法名**：不写 `override` 时，拼错的方法会成为一个新方法，父类的方法照样被调用，bug 很难发现。

本课还开启了 `noImplicitOverride` 选项（见页面上方的说明）。它增加的规则是：覆盖父类**已有实现**的方法时**必须**写 `override`，否则报 TS4114。这样一来：

- 所有覆盖都带着 `override`，读代码的人一眼就知道；
- 父类的方法改名或删除时，子类里的 `override` 会立刻报错；
- 父类新增了一个和子类方法同名的方法时，“意外覆盖”也会被发现。

实现父类的**抽象**方法时，`override` 可写可不写（推荐写上）。

:::playground{#override expect="4117@main.ts:8, 4114@main.ts:14"}
```ts file=main.ts
class Logger {
  format(message: string): string {
    return message;
  }
}

class PrefixLogger extends Logger {
  override fromat(message: string): string {
    return `[app] ${message}`;
  }
}

class UpperLogger extends Logger {
  format(message: string): string {
    return message.toUpperCase();
  }
}

console.log(new PrefixLogger().format('启动'), new UpperLogger().format('ok'));
```
- 第 8 行：`fromat` 拼错了，父类没有这个方法，报 TS4117，并提示是不是想写 `format`。运行一下：`PrefixLogger` 实际调用的是父类的 `format`，前缀没有加上。
- 第 14 行：覆盖了父类的 `format` 却没有写 `override`，报 TS4114。
:::

## implements：检查类是否满足接口

`class X implements 接口` 要求类拥有接口中的全部成员，否则报 TS2420。一个类可以 `implements` 多个接口（但只能 `extends` 一个类）。

和 Java 不同的是：由于结构化类型（b02），`implements` **只是一项检查**，它不会改变类本身的类型（例如接口里的可选属性不会因此加到类上）。即使不写 `implements`，形状相符的类也可以当作这个接口使用。另外，它**不会**给方法参数提供类型：方法的参数仍然要自己写类型注解。

:::playground{#implements expect="2420@main.ts:6, 7006@main.ts:17"}
```ts file=main.ts
interface Shape {
  name: string;
  area(): number;
}

class Square implements Shape {
  side = 2;
  area(): number {
    return this.side ** 2;
  }
}

interface Formatter {
  format(value: number): string;
}
class YuanFormatter implements Formatter {
  format(value) {
    return `¥${value}`;
  }
}

console.log(new Square().area(), new YuanFormatter().format(5));
```
- 第 6 行：缺少 `name`，报 TS2420。
- 第 17 行：接口中 `value` 是 `number`，但类的方法参数不会继承这个类型，`value` 是隐式 `any`，报 TS7006。
:::

## abstract：只能被继承的基类

`abstract class` 不能直接 `new`。它可以包含 `abstract` 方法：只有签名、没有实现，**要求非抽象的子类必须实现**。基类里的普通方法可以调用这些抽象方法——这就是“模板方法”模式。

:::playground{#abstract expect="2511@main.ts:21, 2515@main.ts:23"}
```ts file=main.ts
abstract class Report {
  abstract title(): string;
  abstract rows(): string[];

  render(): string {
    return [`# ${this.title()}`, ...this.rows().map((r) => `- ${r}`)].join('\n');
  }
}

class SalesReport extends Report {
  override title(): string {
    return '本周销售';
  }
  override rows(): string[] {
    return ['钢笔 12 支', '墨水 5 瓶'];
  }
}

console.log(new SalesReport().render());

const raw = new Report();

class EmptyReport extends Report {
  override title(): string {
    return '空';
  }
}
console.log(raw, EmptyReport);
```
- 第 6 行：基类的 `render` 调用了子类才会实现的 `title` 和 `rows`。
- 第 21 行：抽象类不能实例化，报 TS2511。（`abstract` 只在编译期起作用，运行时这一行其实能执行。）
- 第 23 行：`EmptyReport` 没有实现 `rows`，报 TS2515。
:::

**继承还是组合？** JavaScript 只支持单继承，深层的继承关系也让代码难以修改。现代 TypeScript/React 代码更常用**组合**：用接口描述能力，用普通函数、对象和闭包（a14）把能力组装起来。继承适合“确实是一种”的关系，并且层次最好很浅。

::exercise{#shape-classes}

## 编程挑战

::exercise{#notifier}

::quiz

## 常见错误

- **在 `super(…)` 之前使用 `this`**：TS17009，运行时 `ReferenceError`。
- **覆盖方法时拼错了名字**：开启 `noImplicitOverride` 并写 `override`，编译期就能发现。
- **以为 `implements` 会给方法参数提供类型**：参数仍要自己写注解。
- **试图 `new` 一个抽象类**：只能实例化实现了全部抽象方法的子类。

## 下一步

下一课讲泛型：如何写出“对任何类型都适用、又不丢失类型信息”的函数和类型。
