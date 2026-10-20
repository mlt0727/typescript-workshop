---
version: 1
mode: ts
estimatedMinutes: 30
review: ai-draft
problem: 代码一多就要拆成多个文件。现代 JavaScript 用 ES 模块（ESM）组织代码：每个文件是一个模块，用 export 决定对外公开什么，用 import 使用别的模块。TypeScript 还要求你分清“导入的是值还是类型”，因为类型在编译后会被擦除。
objectives:
  - 用具名导出和默认导出公开模块内容，用对应的 import 语法导入
  - 理解每个模块有自己的作用域，导入的绑定是只读的
  - 知道模块只执行一次，模块顶层的变量在所有导入方之间共享
  - 在开启 verbatimModuleSyntax 时用 import type 导入类型
references:
  - title: JavaScript modules — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules
    checked: 2026-10-20
  - title: import — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import
    checked: 2026-10-20
  - title: Modules — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/modules.html
    checked: 2026-10-20
  - title: verbatimModuleSyntax — TSConfig Reference
    url: https://www.typescriptlang.org/tsconfig/#verbatimModuleSyntax
    checked: 2026-10-20
---

## 具名导出

在声明前加上 `export`，它就成为模块对外公开的一部分；没有 `export` 的内容只在本文件内可见。导入时用花括号列出名字，可以用 `as` 改名。

导入路径以 `./` 或 `../` 开头表示项目里的其他文件；`'react'` 这样不带路径的名字表示安装的包。本平台和 Vite 等构建工具允许省略 `.ts` 扩展名。

下面的示例有两个文件，点击编辑器上方的文件名切换：

:::playground{#named-exports expect="2459@main.ts:1" run=error}
```ts file=main.ts
import { circleArea, PI as pi, secret } from './geometry';

console.log(pi, circleArea(2));
```
```ts file=geometry.ts
export const PI = 3.14159;

export function circleArea(r: number): number {
  return PI * r * r;
}

function secret(): number {
  return 42;
}
```
- `geometry.ts` 里的 `secret` 没有导出，`main.ts` 导入它时报 TS2459。运行一下：浏览器在加载模块时就报错 `SyntaxError`（模块没有提供名为 `secret` 的导出），一行代码都不会执行。删掉 `, secret` 再运行。
- `PI as pi` 把导入的名字改成了 `pi`。
- 和 Java 的 `public` 类似，但单位是文件：一个文件就是一个模块，模块顶层的变量不会泄漏到全局。
:::

## 默认导出与命名空间导入

一个模块可以有**一个**默认导出 `export default`。导入默认导出时不写花括号，名字由导入方自己决定。`import * as 名字` 把模块的所有具名导出收集到一个对象里。

很多团队更推荐具名导出：名字在导出处就确定了，改名和自动补全都更可靠。React 组件和框架约定的文件（例如 Next.js 的页面）常用默认导出。

:::playground{#default-export}
```ts file=main.ts
import sayHello from './greet';
import * as text from './text';

console.log(sayHello('Ada'));
console.log(text.shout('hi'), text.whisper('HI'));
```
```ts file=greet.ts
export default function greet(name: string): string {
  return `你好，${name}`;
}
```
```ts file=text.ts
export function shout(s: string): string {
  return s.toUpperCase() + '!';
}

export function whisper(s: string): string {
  return s.toLowerCase() + '…';
}
```
- 第 1 行：默认导出的名字叫 `greet`，导入时起名为 `sayHello` 也可以。
:::

## 导入类型：import type

TypeScript 的类型也可以导出和导入。本平台开启了 `verbatimModuleSyntax`（新项目推荐的设置）：**只用作类型的导入必须写成 `import type`**，或者在名字前加 `type`。原因是编译时 TypeScript 只删除标明了 `type` 的导入，其余导入原样保留；如果一个类型被当作普通导入保留下来，运行时就会去找一个并不存在的值。

:::playground{#import-type expect="1484@main.ts:1" run=error}
```ts file=main.ts
import { User, describeUser } from './user';

const ada: User = { name: 'Ada', born: 1815 };
console.log(describeUser(ada));
```
```ts file=user.ts
export type User = { name: string; born: number };

export function describeUser(user: User): string {
  return `${user.name}（${user.born}）`;
}
```
- 第 1 行报 TS1484。先运行看看：编译后这行导入被原样保留，浏览器去 `user.ts` 编译出的 JavaScript 里找名为 `User` 的导出，而类型早已被擦除，于是抛出 `SyntaxError`。
- 改成 `import { type User, describeUser } from './user';`，或者单独一行 `import type { User } from './user';`，再运行。
- 改好后点击“查看 JS”：`type` 标记的导入在编译后消失了，`describeUser` 的导入保留着。
:::

## 模块只执行一次

一个模块无论被导入多少次，它的顶层代码**只执行一次**，所有导入方拿到的是同一份导出。所以模块顶层的变量就是被所有导入方共享的状态。

导入得到的绑定是**只读**的：导入方不能给它重新赋值（TS2632），只能调用模块提供的函数去修改。不过它是“活的”：模块内部修改后，导入方读到的是新值。

:::playground{#runs-once expect="2632@main.ts:8" run=error}
```ts file=main.ts
import { count, increment } from './counter';
import { useCounterTwice } from './other';

increment();
useCounterTwice();
console.log('main 读到的 count：', count);

count = 100;
```
```ts file=counter.ts
console.log('counter 模块执行了');

export let count = 0;

export function increment(): void {
  count++;
}
```
```ts file=other.ts
import { increment } from './counter';

export function useCounterTwice(): void {
  increment();
  increment();
}
```
- 运行时“counter 模块执行了”只输出一次，尽管 `main.ts` 和 `other.ts` 都导入了它。
- `main.ts` 读到的 `count` 是 `3`：三次 `increment` 修改的是同一个变量。
- 第 8 行：导入的绑定不能重新赋值，TypeScript 报 TS2632，运行时也会抛出 `TypeError`。
:::

旧的 Node.js 代码里还能看到 `require()` 和 `module.exports`，那是 CommonJS 模块格式。新代码使用 ESM；F 阶段讲工程化时会再遇到两者的区别。

::exercise{#export-fix}

## 编程挑战

::exercise{#settings-cache}

::quiz

## 常见错误

- **忘了 `export`**：其他文件导入时报 TS2459（或 TS2305）。
- **导入类型时不写 `type`**：开启 `verbatimModuleSyntax` 时报 TS1484。
- **给导入的变量赋值**：导入的绑定是只读的，通过模块导出的函数修改。
- **以为每次导入都会重新执行模块**：模块只执行一次，顶层状态是共享的。

## 下一步

下一课是 A 阶段的最后一课：错误处理。`throw`、`try/catch`，以及为什么 `catch` 到的错误类型是 `unknown`。
