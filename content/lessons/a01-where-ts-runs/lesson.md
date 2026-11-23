---
version: 1
mode: ts
estimatedMinutes: 25
review: self-reviewed
problem: 刚接触 TypeScript 时最容易混淆的是：代码到底由谁执行？类型检查发生在什么时候？类型错误会不会阻止程序运行？弄清这几件事，后面看到报错和输出时才知道该从哪里找原因。
objectives:
  - 说清 TypeScript 与 JavaScript 的关系：TypeScript 在 JavaScript 语法上增加了类型，真正运行的永远是 JavaScript
  - 区分“类型检查”和“运行”：类型错误不会自动阻止代码运行
  - 知道浏览器、Node.js 和本平台各自提供哪些运行环境 API
  - 会使用本平台的示例：运行、看类型错误、查看编译出的 JavaScript
references:
  - title: TypeScript for the New Programmer — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/typescript-from-scratch.html
    checked: 2026-10-20
  - title: TypeScript for Java/C# Programmers — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes-oop.html
    checked: 2026-10-20
  - title: The Basics — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/basic-types.html
    checked: 2026-10-20
  - title: JavaScript technologies overview — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/JavaScript_technologies_overview
    checked: 2026-10-20
  - title: TypeScript — Node.js 文档
    url: https://nodejs.org/api/typescript.html
    checked: 2026-10-20
    note: Node.js 自 v22.18.0 / v23.6.0 起默认可以直接运行 .ts 文件（只擦除类型，不做类型检查），v24.12.0 / v25.2.0 起该功能稳定
---

## 运行的永远是 JavaScript

**TypeScript** 是在 JavaScript 语法之上增加了**静态类型**（static types）的语言。JavaScript 可以在浏览器里运行，也可以用 Node.js 直接在电脑上运行（Node.js 是一个在浏览器之外运行 JavaScript 的程序，相当于 Python 的 `python` 命令）。两者里面的 JavaScript 引擎（如 Chrome 和 Node.js 使用的 V8）都只执行 JavaScript，所以 TypeScript 代码从写好到运行要经过三步：

1. **类型检查**：TypeScript 编译器（`tsc`，或编辑器里的语言服务）分析代码，报告类型错误；
2. **擦除类型**：去掉类型注解等 TypeScript 专有语法，得到普通 JavaScript；
3. **运行**：JavaScript 引擎执行这份代码。

这和你熟悉的语言不太一样：

| | 检查类型 | 运行 |
|---|---|---|
| Java | `javac` 编译时检查；有类型错误就**不生成**字节码 | JVM 运行字节码，运行时仍保留类的信息（泛型参数除外） |
| C++ | 编译时检查；有错误就**不生成**可执行文件 | 运行机器码 |
| Python | 默认不检查；可选用 mypy 等工具 | 解释器运行源码 |
| TypeScript | 编译器检查，但第 1、2 步是**独立的**：有类型错误时，大多数工具仍会产出 JavaScript | JavaScript 引擎运行**擦除了类型**的代码，运行时没有 TypeScript 类型 |

如果你给 Python 代码写过类型提示、再用 mypy 检查，这种做法并不陌生：检查是单独的一步，运行时不会按注解拦住类型不对的值。

在本平台，每个示例都会自动做第 1 步（结果显示在编辑器下方）；点击“运行”时完成第 2、3 步。点击“查看 JS”可以看到第 2 步的结果。

:::playground{#first-run}
```ts file=main.ts
const language: string = 'TypeScript';
const firstRelease: number = 2012;
let plannedLessons = 126;

console.log(language, '首次公开发布于', firstRelease, '年');
console.log('本平台规划了', plannedLessons, '节课');
```
- 点击“运行”，看输出面板。`console.log` 相当于 Python 的 `print`、Java 的 `System.out.println`：输出一行，多个参数之间用空格分隔。
- 点击“查看 JS”：`: string`、`: number` 这些**类型注解**（type annotation）都被删掉了，其余代码保持不变（编译器会重新生成代码格式，空行可能被去掉）。
- 第 3 行没有写类型，但把鼠标停在 `plannedLessons` 上，TypeScript 已经**推断**出它是 `number`。类型推断，以及 `const` 和 `let` 这两种声明变量的写法有什么区别，都在 a03 详细讲。
:::

## 类型检查与运行是两件事

下面的代码有一个类型错误。先看编辑器的报错，再点“运行”——它照样能运行。

:::playground{#check-vs-run expect="2322@main.ts:2"}
```ts file=main.ts
const price: number = 20;
const quantity: number = '3';

console.log('总价：', price * quantity);
console.log('加上数量：', price + quantity);
```
- 第 2 行把字符串 `'3'` 赋给了声明为 `number` 的变量，TypeScript 报 TS2322。
- 但程序仍然运行了：类型被擦除后，`quantity` 的值就是字符串 `'3'`。第 4 行的乘法里，JavaScript 会把字符串自动转换成数字，碰巧得到 60；第 5 行的 `+` 遇到字符串则变成**字符串拼接**，得到 `'203'`。
- TypeScript 以为 `quantity` 是数字，第 5 行就不会再报错——**忽略类型错误，类型系统就无法再保护你**。在本平台，提交练习时类型错误会让判题不通过。
:::

::exercise{#fix-receipt}

## 在哪里运行：浏览器、Node.js 与本平台

JavaScript **语言本身**（变量、函数、对象、数组……）由 ECMAScript 标准定义，在哪里都一样。但每个运行环境（宿主，host）会额外提供不同的 API：

| | 浏览器 | Node.js | 本平台“纯 TypeScript”示例 |
|---|---|---|---|
| 典型 API | `document`、`window`、`localStorage`、`fetch` | `process`、`fs`（文件系统）、`fetch` | `console`、`setTimeout`（定时器）、`fetch`（网络请求，由平台模拟）等 |
| 页面 DOM | 有 | 没有 | 没有（代码运行在 Web Worker 中） |
| `console.log` 显示在 | 开发者工具 | 终端 | 输出面板（格式与 Node.js 一致） |

表里的 **DOM** 是浏览器为网页建立的一组对象，代码通过它读取和修改页面，`document` 是它的入口（D 阶段详细讲）。本课的示例都属于第三列（示例顶部标着“TypeScript”）：代码运行在 Web Worker 里，这是浏览器提供的后台线程，接触不到页面。

TypeScript 通过编译配置里的 `lib` 选项知道当前环境有哪些 API。在不提供 DOM 的环境里使用 `document`，在编译期就会报错：

:::playground{#no-dom expect="2584@main.ts:2, 2584@main.ts:4" run=error}
```ts file=main.ts
console.log('setTimeout 的类型：', typeof setTimeout);
console.log('document 的类型：', typeof document);

document.title = '新标题';
```
- 第 2、4 行都报 TS2584：纯 TypeScript 示例运行在 Web Worker 中，类型库里没有 `document`，即使只是 `typeof document` 也会被检查。
- 运行时却有区别：前两行正常输出 `function` 和 `undefined`，第 4 行才抛出 `ReferenceError`。`typeof` 是 JavaScript 的运算符，在运行时给出一个值的类型名（下一课细讲）；对一个不存在的名字使用它会得到 `'undefined'`，不会出错。
- 后面的 DOM 课会使用“网页（DOM）”模式，那里有真实的页面和 `document`。
:::

F 阶段之前，课程里的代码都在这个网站上运行，现在不需要安装任何东西。以后在自己电脑上写 TypeScript，常见的做法有三种（F 阶段详细讲）：

- **直接运行**：`node 文件名.ts`。Node.js 22.18+ 或 23.6+ 默认支持，但只擦除类型、**不做类型检查**，并且不支持 `enum` 等需要额外生成代码的语法。
- **类型检查**：在项目里先 `npm install -D typescript`（npm 是随 Node.js 一起安装的包管理器，相当于 Python 的 pip），再用 `npx tsc --noEmit 文件名.ts` 做类型检查；配好 `tsconfig.json` 后直接运行 `npx tsc --noEmit`。
- **做网页项目**：用 Vite 这样的构建工具。

## 先认识函数的写法

后面的练习会用到函数。TypeScript 的函数写法和 Java/C++ 很接近，只是**类型写在名字后面**：

:::playground{#function-preview}
```ts file=main.ts
function toCelsius(fahrenheit: number): number {
  return (fahrenheit - 32) * 5 / 9;
}

function describe(celsius: number): string {
  if (celsius >= 30) {
    return '炎热';
  } else if (celsius >= 15) {
    return '舒适';
  } else {
    return '凉爽';
  }
}

console.log(toCelsius(212), describe(toCelsius(212)));
console.log(toCelsius(50), describe(toCelsius(50)));
```
- `(fahrenheit: number): number` 表示参数是 `number`、返回值也是 `number`。`if / else if / else` 与 Java、C++ 相同。
- 试着调用 `toCelsius('100')`：TypeScript 会指出参数类型不对。函数的更多写法在 a13 详细讲。
:::

练习里的函数前面要加上 `export`（例如 `export function toCelsius…`），和小票练习里的 `export const` 一样：它让测试文件可以导入这个函数来检查你的实现。模块的导入与导出在 a19 讲。

## 编程挑战

::exercise{#body-temperature}

::quiz

## 常见误区

- **“没有红线就一定没有 bug”**：类型检查只能发现类型层面的问题，逻辑错误（比如公式写错）仍要靠测试和思考。
- **“有类型错误程序就跑不起来”**：在 TypeScript 里，检查和运行是分开的。本平台和大多数构建工具都会在有类型错误时照样运行，你需要主动处理报错。
- **“TypeScript 的类型在运行时还在”**：类型在编译后被完全擦除，运行时无法用 TypeScript 类型来检查数据。下一课专门讨论这个边界。

## 下一步

下一课讨论“编译期与运行期”的边界：哪些检查发生在编译期，哪些只能在运行期做。
