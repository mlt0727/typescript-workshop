---
version: 1
mode: ts
estimatedMinutes: 30
review: self-reviewed
problem: Java 程序员会很自然地去找 enum，TypeScript 确实有。但它是 TypeScript 少数几个会生成运行时代码的特性之一，带来了一些意外的行为，也和现代“只擦除类型、不转换代码”的工具（例如 Node.js 直接运行 .ts），以及为这类工具设计的 erasableSyntaxOnly 选项不兼容。大多数情况下，字面量联合或 as const 对象是更简单、更通用的选择。
objectives:
  - 认识数字枚举和字符串枚举的写法，知道枚举会生成运行时对象（数字枚举还有反向映射）
  - 理解“可擦除语法”：哪些 TypeScript 语法需要生成代码，为什么 erasableSyntaxOnly 会拒绝它们
  - 用字面量联合或 as const 对象加推导类型代替枚举
  - 能看懂旧代码中的枚举，并把它迁移到替代写法
references:
  - title: Enums — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/enums.html
    checked: 2026-10-20
  - title: erasableSyntaxOnly — TSConfig Reference
    url: https://www.typescriptlang.org/tsconfig/#erasableSyntaxOnly
    checked: 2026-10-20
  - title: Running TypeScript Natively（Type stripping）— Node.js
    url: https://nodejs.org/api/typescript.html
    checked: 2026-10-20
---

## 枚举的写法与运行时对象

`enum` 定义一组有名字的常量。数字枚举的成员默认从 0 开始编号；字符串枚举的每个成员要写出值。和 Java 的枚举不同，成员只是数字或字符串，不能带字段和方法（更接近 C++ 的 `enum`）。

和 `type`、`interface` 不同，**枚举在运行时是一个真实的对象**：TypeScript 会为它生成代码。数字枚举还会生成**反向映射**（从值查名字），所以 `Object.keys` 会得到一些意外的键。（`const enum` 不生成对象，而是把值直接内联到使用的地方：成员的名字被换成它的值。这同样是在改写代码，而且枚举的定义可能在别的文件里，所以它也不是“擦掉类型就能运行”的语法。）

本平台开启了 `erasableSyntaxOnly` 选项（下一节讲），所以示例第 1、6 行的两个枚举都会报 TS1294。为了观察枚举的运行时行为，这里仍然运行一下（有类型错误时，TypeScript 照样会生成代码）。

:::playground{#enum expect="1294@main.ts:1, 1294@main.ts:6"}
```ts file=main.ts
enum Direction {
  Up,
  Down,
}

enum Level {
  Low = 'low',
  High = 'high',
}

console.log(Direction.Up, Direction.Down, Direction[0]);
console.log(Level.High);
console.log(Object.keys(Direction), Object.keys(Level));
```
- 第 11 行：`Direction.Up` 是 `0`，而 `Direction[0]` 是 `'Up'`——这就是反向映射。
- 第 13 行：数字枚举的 `Object.keys` 是 `[ '0', '1', 'Up', 'Down' ]`，名字和数字混在一起；字符串枚举没有反向映射，只有 `[ 'Low', 'High' ]`。
- 点击“查看 JS”，看看 TypeScript 为这两个枚举生成了什么代码。
:::

## 可擦除语法

越来越多的工具采用“**只擦除类型**”的方式运行 TypeScript：Node.js 直接运行 `.ts` 文件（a01）时，默认只是把类型注解等 TypeScript 专有语法替换成空白，不做任何代码生成；ts-blank-space 这类工具也是如此。能这样处理的语法叫**可擦除语法**。

另一类工具不只是擦除：a19 提到的 Vite、esbuild 这类构建工具，它们的转换器会为 `enum` 等语法生成代码。但它们逐个文件处理、不做类型检查，拿不到其他文件的类型信息，所以也有自己的限制，例如处理不了跨文件的 `const enum`（`isolatedModules` 选项会提前报告这类问题）。

需要生成代码的 TypeScript 语法不多，主要是：

- `enum`（包括 `const enum`；只有 `declare enum` 例外：它只描述一个别处已有的枚举，自己不生成代码）；
- 带有值的 `namespace`（ES 模块出现之前 TypeScript 用来组织代码的旧写法；只包含类型的 `namespace` 可以）；
- 类的参数属性 `constructor(private x: number)`（b12）；
- `import x = require('…')`、`import A = N.B`、`export = …` 这类旧的模块写法。

另外，尖括号断言 `<T>x`（b16）虽然不需要生成代码，也会被下面这个选项拒绝。

`erasableSyntaxOnly` 选项（TypeScript 5.8 加入）会拒绝这些语法（TS1294），保证代码里没有需要生成代码的 TypeScript 语法。项目需要兼容只擦除类型的工具时，新代码就应该避免这些语法。注意这只是必要条件：要让 Node.js 直接运行，还需要别的配合，例如类型导入要写成 `import type`（a19），相对导入要写出 `.ts` 扩展名（f03 会讲）。

## 替代写法一：字面量联合

如果只需要“一组固定的值”，字面量联合（b04）就够了，它在运行时什么都不留下：

```ts
type Direction = 'up' | 'down' | 'left' | 'right';
```

值本身就是可读的字符串，调试和序列化都很直接。

## 替代写法二：as const 对象 + 推导类型

如果还需要一个“运行时可以遍历、可以按名字引用”的对象，用 `as const` 对象，再从它推导出值的联合类型。推导用的都是已经学过的类型运算，下面示例第 6 行的 `(typeof Status)[keyof typeof Status]` 可以分三步读：

1. `typeof Status`（b16）是这个对象的类型：`{ readonly Active: 'active'; readonly Disabled: 'disabled' }`；
2. `keyof typeof Status`（b15）是它所有键的联合：`'Active' | 'Disabled'`；
3. 用这个联合做索引访问（b15），得到这些键对应的值类型的联合：`'active' | 'disabled'`。

:::playground{#as-const-object expect="2322@main.ts:9"}
```ts file=main.ts
const Status = {
  Active: 'active',
  Disabled: 'disabled',
} as const;

type Status = (typeof Status)[keyof typeof Status];

const a: Status = Status.Active;
const b: Status = 'deleted';

function label(status: Status): string {
  return status === Status.Active ? '启用' : '停用';
}

console.log(a, b, label('disabled'), Object.values(Status));
```
- 第 6 行：同名的值 `Status` 和类型 `Status` 可以共存，TypeScript 按名字出现的位置来区分：第 8 行冒号后面的 `Status` 是类型，等号后面的 `Status.Active` 用的是值。类型展开后是 `'active' | 'disabled'`。
- 第 8 行：既可以用 `Status.Active`，也可以直接写字符串 `'disabled'`（第 15 行）——这比字符串枚举更灵活，字符串枚举不接受普通字符串。
- 第 9 行：不合法的值报 TS2322。
- 第 15 行：`Object.values(Status)` 只有两个值，没有反向映射带来的多余项。
:::

::exercise{#migrate-enum}

## 编程挑战

::exercise{#http-status}

::quiz

## 常见错误

- **在开启 `erasableSyntaxOnly` 的项目里使用 `enum`**：TS1294。改用字面量联合或 `as const` 对象。
- **对数字枚举使用 `Object.keys`/`Object.values`**：反向映射会带来多余的项。
- **以为枚举和 `type` 一样会被擦除**：枚举会生成运行时对象（`const enum` 会被内联），还会影响打包体积和工具兼容性。

## 下一步

B 阶段到这里结束。接下来是 D 阶段：HTML、CSS 与 DOM，把前面学的类型用在真实的页面上；之后是 E 阶段（事件循环、Promise 与异步）和 C 阶段的进阶类型。
