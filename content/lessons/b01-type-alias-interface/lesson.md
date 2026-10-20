---
version: 1
mode: ts
estimatedMinutes: 35
review: self-reviewed
problem: "A 阶段里，对象类型大多直接写在参数上，例如 user: { name: string; born: number }。同一个形状用在三四个地方时，这样写既啰嗦又容易改漏。TypeScript 用 type 和 interface 给对象形状起名字。它们大部分时候可以互换，但也有几处真正的区别。"
objectives:
  - 用 type 和 interface 给对象形状命名，并在参数、返回值和变量上使用
  - 知道 interface 可以 extends，也会自动合并同名声明；type 可以命名任何类型
  - 在类型里描述方法，知道两种写法
  - 用索引签名和 Record 描述键不固定的对象，知道读取结果包含 undefined
references:
  - title: Object Types — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/objects.html
    checked: 2026-10-20
  - title: Everyday Types（Type Aliases、Interfaces、Differences Between Type Aliases and Interfaces）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
    checked: 2026-10-20
  - title: Utility Types（Record）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/utility-types.html
    checked: 2026-10-20
---

## type：给类型起名字

`type 名字 = 类型;` 定义一个**类型别名**。之后在任何需要写类型的地方，都可以用这个名字代替。类型名习惯用大写开头（PascalCase）。

和所有类型一样，它在编译后被完全擦除（a02），只用于检查。

:::playground{#type-alias expect="2741@main.ts:12"}
```ts file=main.ts
type User = {
  name: string;
  born: number;
};

function describe(user: User): string {
  return `${user.name}（${user.born}）`;
}

const ada: User = { name: 'Ada', born: 1815 };
console.log(describe(ada));
const grace: User = { name: 'Grace' };
```
- 第 12 行：缺少必需的属性 `born`，报 TS2741。
- 对象类型里的属性之间用分号（也可以用逗号）分隔。
:::

## interface：另一种写法

`interface 名字 { … }` 也描述对象的形状，用法和对象类型的 `type` 几乎一样。区别主要有三点：

1. **只有 `type` 能命名非对象类型**：`type ID = string | number;`、`type Pair = [number, number];`。`interface` 只能描述对象（以及函数、类实例这类对象）。
2. **`interface` 用 `extends` 扩展**另一个接口；`type` 通过交叉类型 `&` 达到类似效果（b05）。
3. **同名的 `interface` 会自动合并**（声明合并），同名的 `type` 则报“重复标识符”。

:::playground{#interface expect="2741@main.ts:21, 2300@main.ts:23, 2300@main.ts:24"}
```ts file=main.ts
interface Point {
  x: number;
  y: number;
}

interface Point3D extends Point {
  z: number;
}

const p: Point3D = { x: 1, y: 2, z: 3 };
console.log(p);

type ID = string | number;

interface Settings {
  theme: string;
}
interface Settings {
  fontSize: number;
}
const settings: Settings = { theme: 'dark' };

type Config = { a: number };
type Config = { b: number };
```
- 第 6 行：`Point3D` 包含 `Point` 的全部属性，再加上 `z`。
- 第 15–20 行：两个 `Settings` 合并成了一个同时要求 `theme` 和 `fontSize` 的接口，所以第 21 行报 TS2741。声明合并的主要用途是给已有的类型（例如浏览器的全局类型）补充属性；在自己的代码里意外重名时，它可能带来意外。
- 第 23–24 行：`type` 不能重复声明，报 TS2300。
:::

**怎么选？** TypeScript Handbook 的建议是：大多数情况下按个人或团队习惯选择；如果没有偏好，先用 `interface`，需要 `type` 特有的能力（联合类型等）时再用 `type`。本课程两种都会用：描述对象形状时常用 `interface`，联合类型、元组等用 `type`。保持同一个项目内风格一致最重要。

## 在类型里描述方法

对象的属性可以是函数。类型里有两种写法：方法写法 `greet(): string`，和属性写法 `greet: () => string`。两者大部分时候效果相同（在严格模式下，属性写法对参数类型的检查更严格，B 阶段讲函数类型时会提到）。

:::playground{#methods}
```ts file=main.ts
interface Counter {
  readonly label: string;
  value(): number;
  increment: () => void;
}

function createCounter(label: string): Counter {
  let count = 0;
  return {
    label: label,
    value: () => count,
    increment: () => {
      count++;
    },
  };
}

const clicks = createCounter('点击');
clicks.increment();
clicks.increment();
console.log(clicks.label, clicks.value());
```
- `readonly label` 表示这个属性创建后不能修改（b03 详讲）。
- 这就是 a14 的闭包写法，现在给返回值起了一个名字 `Counter`。
:::

## 键不固定的对象：索引签名与 Record

a11 说过，用任意字符串作键读取普通对象时，TypeScript 会报错。如果一个对象本来就是“字典”——键在运行时才知道，值的类型都一样——可以用**索引签名**描述它：`{ [key: string]: number }`。内置的工具类型 `Record<string, number>` 是同样意思的简写。

本平台开启了 `noUncheckedIndexedAccess`，所以读取索引签名的结果包含 `undefined`（和数组下标一样，a10）：键可能不存在。

:::playground{#index-signature}
```ts file=main.ts
type Stock = { [fruit: string]: number };

const stock: Stock = { apple: 3, banana: 0 };
stock.cherry = 12;

const durian = stock['durian'];
console.log(durian);

const scores: Record<string, number> = { ada: 90 };
console.log((scores.ada ?? 0) + 5);

for (const [fruit, count] of Object.entries(stock)) {
  console.log(fruit, count);
}
```
- 第 4 行：索引签名允许添加任意字符串键。
- 把鼠标停在第 6 行的 `durian` 上：类型是 `number | undefined`，运行结果确实是 `undefined`。
- 第 12 行：`Object.entries` 只返回真实存在的键，`count` 的类型是 `number`。
- 需要频繁增删键、或者键不是字符串时，a18 的 `Map` 往往更合适；需要直接和 JSON 互相转换时，普通对象更方便。
:::

::exercise{#shop-types}

## 编程挑战

::exercise{#report-card}

::quiz

## 常见错误

- **同一个对象形状到处重复书写**：起一个名字，改一处就够了。
- **意外的声明合并**：同一个文件（模块）里同名的 `interface` 会合并，可能让对象多出必需的属性。不同的模块文件互不影响；要给全局类型补充属性，需要专门的 `declare global` 写法。
- **以为索引签名的读取结果一定存在**：在本平台它包含 `undefined`。
- **用 `interface` 写联合类型**：做不到，联合类型用 `type`。

## 下一步

下一课讲 TypeScript 最有特色的设计之一：结构化类型。类型名不重要，形状才重要；以及为什么直接写对象字面量时，多写一个属性也会报错。
