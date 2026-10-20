---
version: 1
mode: ts
estimatedMinutes: 55
review: ai-draft
problem: 代码不按预期工作时，在每一行加 console.log 再刷新，是最慢的排错方法。浏览器自带的开发者工具（DevTools）可以让代码停在任意一行，查看当时每个变量的值、是谁调用了这个函数；可以看到每一个网络请求的状态、请求头和响应内容。可是运行的明明是打包、压缩过的 JavaScript，DevTools 为什么能显示原来的 TypeScript？这一课学会 DevTools 中最常用的几个面板，读懂错误的堆栈，并弄清 source map 是怎样把运行的代码对应回源文件的。
objectives:
  - 用 Console 的 table、group、count、assert 等方法输出更易读的信息，知道展开对象时看到的是哪一刻的值
  - 在 Sources 面板中设置断点、条件断点和日志点，使用单步执行、调用栈、作用域和监视表达式
  - 读懂 Chrome 与 Safari 的错误堆栈，用 Network 面板检查请求的状态、请求头、响应与耗时
  - 说明 source map 的结构与 mappings 的编码方式，知道开发与生产构建中 source map 的设置
references:
  - title: 使用断点暂停代码 — Chrome DevTools
    url: https://developer.chrome.com/docs/devtools/javascript/breakpoints
    checked: 2026-10-20
  - title: Console API reference — Chrome DevTools
    url: https://developer.chrome.com/docs/devtools/console/api
    checked: 2026-10-20
  - title: Network features reference — Chrome DevTools
    url: https://developer.chrome.com/docs/devtools/network/reference
    checked: 2026-10-20
  - title: Source Map 规范（ECMA-426）
    url: https://tc39.es/ecma426/
    checked: 2026-10-20
  - title: build.sourcemap — Vite
    url: https://vite.dev/config/build-options#build-sourcemap
    checked: 2026-10-20
---

## 打开开发者工具

在 Chrome 或 Edge 中按 `F12`（macOS 上 `Cmd+Option+I`），或者在页面上右键选“检查”。Safari 要先在“设置 → 高级”中勾选“显示网页开发者功能”，然后用 `Cmd+Option+I` 打开“网页检查器”。下面以 Chrome 为例（界面可以切换成中文，括号中是中文界面的名称），最常用的面板：

| 面板 | 用途 |
| --- | --- |
| Elements（元素） | 查看和临时修改 DOM 与 CSS，看元素实际使用了哪些样式（d03、d04） |
| Console（控制台） | 查看输出和错误；在当前页面中执行任意表达式 |
| Sources（来源） | 查看源文件，设置断点，单步执行 |
| Network（网络） | 查看每一个请求：地址、状态、请求头、响应、耗时 |
| Application（应用） | 查看和清除 `localStorage`、cookie、IndexedDB（e09） |

## Console：不只是 console.log

`console` 还有几个让输出更易读的方法。这个网站的控制台按 Node.js 的格式显示它们，浏览器中的样子不同，但信息是一样的：

:::playground{#console-methods run=error}
```ts file=main.ts
const users = [
  { name: 'Ada', role: 'admin', visits: 12 },
  { name: 'Lin', role: 'editor', visits: 3 },
];
console.table(users);

console.group('加载用户');
console.log('请求 /api/users');
console.warn('响应慢：1200ms');
console.groupEnd();

for (const user of users) console.count(user.role === 'admin' ? 'admin' : 'other');
console.assert(users.length === 3, '期望 3 个用户，实际', users.length);

const cart = { items: 1 };
console.log('之前', cart);
cart.items = 2;
console.log('之后', cart);
```
- `console.table` 把对象数组显示成表格；`console.group`/`groupEnd` 把相关的输出缩进成一组；`console.count` 统计某个标签出现了几次；`console.assert` 只在条件为假时输出一条错误（这里故意让它失败，所以运行结果中有一条错误级别的输出，代码本身并没有抛出异常）。
- 最后两行在这里分别显示 `{ items: 1 }` 和 `{ items: 2 }`。但在 Chrome 的控制台中，**展开**第一个对象时看到的是展开那一刻的值，也就是 `items: 2`（旁边有一个小图标提示“这个值是展开时计算的”）。需要记录某一刻的值时，输出原始值或者一份拷贝：`console.log(JSON.stringify(cart))`、`console.log(structuredClone(cart))`。
:::

在 Console 中可以直接输入表达式并回车执行，它运行在当前页面中，能访问页面的全局变量。在 Elements 中选中一个元素后，在 Console 中输入 `$0` 就是这个元素。

## 断点：让代码停下来

`console.log` 只能看到你事先想到要输出的东西。**断点**让代码停在某一行，这时可以查看所有的变量。

- **代码行断点**：在 Sources 面板中打开文件，点击行号。代码执行到这一行之前暂停；
- **`debugger;` 语句**：写在代码中的断点，只在 DevTools 打开时生效（提交代码前记得删掉，f11 的 lint 规则会提醒）；
- **条件断点**：右键行号，选择“添加条件断点”，输入一个表达式（例如 `user.id === 'u42'`），只有它为真时才暂停。在循环中找某一次迭代时特别有用；
- **日志点**：右键行号，选择“添加日志点”，输入要输出的内容。它不暂停，只是在控制台输出，相当于不用修改代码的 `console.log`；
- **异常时暂停**：在断点窗格中勾选“在出现未捕获的异常时暂停”，代码会停在抛出异常的那一行，而不是只在控制台留下一条错误。

暂停之后，右侧的窗格显示：

- **Scope（作用域）**：当前所有可见的变量和它们的值（局部变量、闭包中的变量、全局变量）；
- **Call Stack（调用栈）**：是谁调用了这个函数，一层一层往上。点击某一层，可以查看那一层的变量；
- **Watch（监视）**：添加表达式（例如 `items.length`），每次暂停时自动计算。

用顶部的按钮控制执行（括号中是 Chrome 的快捷键）：继续执行（`F8`），单步跳过（`F10`，执行完这一行，不进入其中调用的函数），单步进入（`F11`，进入这一行调用的函数），单步跳出（`Shift+F11`，执行完当前函数，回到调用它的地方）。

这个网站的代码运行在沙箱中，并且有运行时间的限制，暂停太久会被当作超时终止，所以断点练习请在 f02 的本地项目中做（见文末的实验）。

## 读懂错误的堆栈

未捕获的异常会在控制台中显示错误信息和**堆栈**：异常发生时，调用栈上每一层的函数和位置。下面是在 Chromium 和 WebKit（Safari 的引擎）中，同一段代码实际得到的 `error.stack`：

```text
Error: boom
    at add (http://localhost:5398/src/main.js:2:29)
    at http://localhost:5398/src/main.js:8:10
```

```text
add@http://localhost:5398/src/main.js:2:38
module code@http://localhost:5398/src/main.js:8:13
```

- Chromium（Chrome、Edge）：第一行是错误信息，之后每一层是 `at 函数名 (地址:行:列)`；没有名字的（模块的顶层、匿名函数）只有 `at 地址:行:列`；构造函数是 `at new Point (…)`，对象的方法是 `at Object.method (…)`；`await` 之后的那一层前面有 `async`；浏览器内置的函数是 `at Array.map (<anonymous>)`；
- Safari：没有错误信息那一行，每一层是 `函数名@地址:行:列`；模块的顶层叫 `module code`，内置函数是 `map@[native code]`；
- 两者的**列号**不同：第 2 行是 `function add(a, b) { return new Error('boom').stack; }`，Chromium 的第 29 列是 `new` 的 `n`，Safari 的第 38 列是 `Error` 后面的 `(`。行号和列号都从 1 开始。

最上面一层是异常发生的地方；往下是调用它的地方。错误往往不在最上面一层，而在把错误的数据传进来的那一层。DevTools 中堆栈里的地址可以点击，直接跳到对应的源文件（如果有 source map，跳到的是 TypeScript 源文件）。

::exercise{#parse-stack}

## Network：每一个请求

在 Network 面板打开的状态下刷新页面，列表中是页面发出的每一个请求：

- **Status（状态）**：200、404、500……红色的是失败的请求（包括被 CORS 拦下的，e11）；
- **Type、Size、Time**：资源类型、传输的大小（`(memory cache)`、`(disk cache)` 表示来自缓存，f02 讲过带哈希的文件为什么可以长期缓存）、耗时；
- 点击一个请求：**Headers（标头）** 是请求和响应的头部，**Payload（载荷）** 是发送的数据，**Preview（预览）/Response（响应）** 是响应的内容，**Timing（时间）** 把耗时分成排队、连接、等待服务器、下载几段；
- 顶部的“停用缓存”在 DevTools 打开时禁用缓存；“节流”可以模拟慢速网络（例如“慢速 4G”），用来检查 e07 的加载状态；“保留日志”让页面跳转之后列表不被清空；
- 右键一个请求，“复制 → 以 fetch 格式复制”或“以 cURL 格式复制”，可以在别处重新发送同样的请求。

## source map：从运行的代码回到源文件

f02 讲过，开发服务器把 `counter.ts` 转换成去掉了类型的 JavaScript，返回的内容末尾有一行：

```text
//# sourceMappingURL=data:application/json;base64,eyJtYXBwaW5ncyI6…
```

这是一个 **source map**（这里直接以 base64 内联在文件中）。解码之后是一个 JSON 对象：

```json
{
  "version": 3,
  "sources": ["counter.ts"],
  "sourcesContent": ["export function setupCounter(element: HTMLButtonElement) {\n…"],
  "names": [],
  "mappings": "AAAA,OAAO,SAAS,aAAa,SAA4B;CACvD,IAAI,UAAU;…"
}
```

- `sources`：源文件的列表；`sourcesContent`：源文件的内容（DevTools 显示的 TypeScript 就来自这里）；
- `names`：原来的标识符名字（压缩后变量名被改短时用来还原）；
- `mappings`：“运行的代码中的哪个位置，对应源文件中的哪个位置”。`;` 分隔**生成的代码**的每一行，`,` 分隔一行中的每一**段**。每一段是 1、4 或 5 个数：生成的列号、源文件的下标、源文件中的行号、列号、名字的下标（都从 0 开始）。

为了让文件尽可能小，这些数有两层压缩：

1. **相对值**：生成的列号是相对于同一行中上一段的；其余四个数是相对于整个 `mappings` 中上一次出现的值。所以大多数数都很小，经常是 0；
2. **Base64 VLQ 编码**：每个数编码成一个或多个 Base64 字符（`A`–`Z`、`a`–`z`、`0`–`9`、`+`、`/` 依次代表 0 到 63）。每个字符的 6 位中，最高位（32）表示“后面还有”，低 5 位是数据，先出现的是低位；拼出的数的最低位是符号（1 表示负数），其余是绝对值。所以 `A` 是 0，`C` 是 1，`D` 是 -1，`gB` 是 16。

例如第一段 `AAAA` 就是 `[0, 0, 0, 0]`：生成的代码第 1 行第 0 列，对应 `counter.ts` 第 1 行第 0 列。下面的编程挑战实现这个解码，并根据生成代码中的位置找到源码的位置，这正是 DevTools 显示 TypeScript 源文件、把堆栈中的位置换成源文件位置时做的事。

**生产构建**中，Vite 默认**不生成** source map（`build.sourcemap: false`）。设为 `true` 会生成单独的 `.map` 文件，并在 JavaScript 末尾加上指向它的注释；设为 `'hidden'` 也生成 `.map` 文件，但不加注释，浏览器不会去加载它，适合只上传给错误监控服务。注意 `sourcesContent` 中有完整的源代码，公开部署 `.map` 文件就等于公开了源代码。

## 在自己的电脑上做一遍

用 f02 的 `my-app` 项目，`npm run dev` 之后在浏览器中打开：

1. Sources 面板中按 `Ctrl+P`（macOS 上 `Cmd+P`），输入 `counter.ts` 打开它，在 `counter = count` 这一行设置断点。点击页面上的按钮：代码暂停，在 Scope 中看 `count` 和 `counter` 的值，按 `F10` 单步执行，观察 `counter` 的变化；看 Call Stack，找到点击事件的处理函数；
2. 把断点改成条件断点 `count === 3`，连续点击按钮，确认只在第三次点击时暂停；再把它换成日志点 `'count', count`；
3. 在 `main.ts` 末尾加一行 `fetch('/vite.svg').then((r) => console.log(r.status))`，在 Network 面板中找到这个请求，查看它的响应头和耗时；再改成一个不存在的地址，看状态码；
4. 运行 `npm run build`，看 `dist/assets` 中没有 `.map` 文件；在 `vite.config.ts`（没有就新建）中写 `export default { build: { sourcemap: true } }`，再构建一次，打开生成的 `.map` 文件看看它的结构。

## 编程挑战

::exercise{#source-map}

::quiz

## 常见错误

- **只靠 `console.log` 排错**：断点能一次看到所有变量和调用栈，条件断点和日志点不用修改代码。
- **以为展开的对象就是输出那一刻的值**：Chrome 中展开对象时读取的是当前的值。需要快照时输出 `JSON.stringify` 的结果或者一份拷贝。
- **只看堆栈的最上面一层**：错误常常来自调用它的那一层传进来的数据。
- **公开部署带 `sourcesContent` 的 source map 却以为源码是保密的**：任何人都能在 DevTools 中看到完整的源文件。需要时用 `'hidden'`，只把 `.map` 交给错误监控服务。
- **忘了删除 `debugger;`**：打开了 DevTools 的用户会在这里停下来。
