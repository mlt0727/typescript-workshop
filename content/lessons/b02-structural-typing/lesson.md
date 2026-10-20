---
version: 1
mode: ts
estimatedMinutes: 30
review: ai-draft
problem: 在 Java 里，一个类必须声明 implements 某个接口，才能当作这个接口使用。TypeScript 不看名字和声明，只看形状：只要一个值拥有需要的属性，它就“是”这个类型。这让代码非常灵活，但也意味着类型不会阻止多余的属性流过去——除了一个特殊情况：直接写出的对象字面量。
objectives:
  - 理解结构化类型：类型兼容只看形状，不看名字或声明
  - 知道拥有更多属性的值可以赋给要求更少属性的类型
  - 理解多余属性检查只针对直接写出的对象字面量，它的目的是发现拼写错误
  - 知道类型不会在运行时删除多余的属性，需要时要自己挑出想要的字段
references:
  - title: Type Compatibility — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/type-compatibility.html
    checked: 2026-10-20
  - title: Object Types（Excess Property Checks）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/objects.html
    checked: 2026-10-20
  - title: TypeScript for Java/C# Programmers（Structural Typing）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes-oop.html
    checked: 2026-10-20
---

## 只看形状，不看名字

TypeScript 的类型系统是**结构化**的（structural typing）：判断一个值能不能当作某个类型使用时，只比较它们的**形状**——有没有需要的属性、属性的类型是否兼容。类型叫什么名字、值是怎样创建的、有没有“声明实现了”这个类型，都不重要。

Java、C# 的类型系统是**名义**的（nominal）：类型必须通过 `implements`、`extends` 明确建立关系。

:::playground{#structural}
```ts file=main.ts
interface Point {
  x: number;
  y: number;
}

interface Vector {
  x: number;
  y: number;
}

function vectorLength(v: Vector): number {
  return Math.hypot(v.x, v.y);
}

const p: Point = { x: 3, y: 4 };
console.log(vectorLength(p));

const labeled = { x: 6, y: 8, label: 'A' };
console.log(vectorLength(labeled));
```
- 第 16 行：`Point` 和 `Vector` 是两个不同的名字，但形状相同，`Point` 可以直接传给需要 `Vector` 的函数。
- 第 19 行：`labeled` 多了一个 `label` 属性，仍然可以传入：它拥有 `Vector` 要求的全部属性。属性**更多**的值可以赋给要求**更少**的类型。
- 这有时被称为“编译期的鸭子类型”：看起来像鸭子、叫起来像鸭子，就当它是鸭子。
:::

## 多余属性检查：只针对对象字面量

上面第 19 行的规则有一个例外：如果在需要某个类型的地方**直接写一个对象字面量**，TypeScript 会额外检查它有没有多余的属性。原因是：直接写出来的对象，多出来的属性没有任何代码会用到，几乎一定是写错了——最常见的是可选属性的拼写错误。

:::playground{#excess expect="2353@main.ts:8, 2561@main.ts:17"}
```ts file=main.ts
interface Point {
  x: number;
  y: number;
}

const ok = { x: 1, y: 2, z: 3 };
const p1: Point = ok;
const p2: Point = { x: 1, y: 2, z: 3 };

interface DrawOptions {
  width: number;
  color?: string;
}
function draw(options: DrawOptions): string {
  return `宽 ${options.width}，颜色 ${options.color ?? '黑色'}`;
}
console.log(draw({ width: 10, colour: 'red' }));
console.log(p1, p2);
```
- 第 7 行：先放进变量再赋值，不检查多余属性，没有错误。
- 第 8 行：直接写对象字面量，`z` 是多余的，报 TS2353。
- 第 17 行：`colour` 拼错了（应该是 `color`），TypeScript 报 TS2561 并给出了建议。如果没有这项检查，`color` 是可选属性，拼错的那个会被悄悄忽略，画出来的是黑色。运行一下看看。
:::

## 类型不会删除多余的属性

结构化类型只是**编译期**的规则。运行时，对象上有什么属性就是什么属性：把一个带有 `password` 的对象赋给 `{ name: string }` 类型的变量，`password` 仍然在那里，`Object.keys`、`JSON.stringify`、展开语法都能看到它。

这也是 a11 提到的 `Object.keys` 返回 `string[]` 的原因：TypeScript 无法保证对象只有类型里写的那些键。

:::playground{#extra-at-runtime}
```ts file=main.ts
interface PublicUser {
  name: string;
}

function show(user: PublicUser): string {
  return JSON.stringify(user);
}

const row = { name: 'Ada', password: 'hunter2' };
console.log(show(row));
console.log(Object.keys(row));
```
- 第 10 行：`password` 被一起序列化了。类型 `PublicUser` 只限制了函数**能用**哪些属性，不会删除其他属性。
- 需要只保留某些字段时（例如返回给前端的数据），要明确地挑出来：`{ name: user.name }`。
:::

::exercise{#public-user}

## 编程挑战

::exercise{#normalize-products}

::quiz

## 常见错误

- **以为类型会“过滤”属性**：类型只在编译期存在，多余的属性在运行时照样存在。
- **以为多余属性检查总会生效**：它只针对直接写出的对象字面量，经过变量中转就不检查了。
- **用 Java 的思路理解兼容性**：在 TypeScript 里，两个没有任何声明关系的类型，只要形状相同就可以互相赋值。

## 下一步

下一课讲可选属性和 `readonly`：如何描述“可能没有”的属性，以及如何防止对象被修改。
