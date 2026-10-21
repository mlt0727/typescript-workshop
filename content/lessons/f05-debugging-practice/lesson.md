---
version: 1
mode: ts
estimatedMinutes: 50
review: self-reviewed
problem: 用户说“购物车有时候合计不对”“列表偶尔是空的”，这样的报告往往没有错误信息，也不是每次都出现。排错的难点不在于修改代码，而在于找到是哪一行、为什么。凭感觉改一处、刷新看看，常常是修好了一个症状，又引入了另一个问题。这一课练习一套固定的排错步骤：先稳定地复现，再缩小范围，提出假设并验证，修复之后用测试把它固定下来；并认识 TypeScript/JavaScript 项目中最常见的几类 bug。
objectives:
  - 按“复现、缩小、假设与验证、修复、回归测试”的步骤排查问题，而不是凭感觉修改
  - 读懂 Chromium 与 Safari 中常见运行时错误的信息，判断错误发生的位置与原因
  - 识别常见的 bug 类型：意外的修改、边界与差一错误、数字与字符串、遗漏的 await 与竞态
  - 根据失败的测试和错误报告修复同步与异步代码中的 bug，并补上回归测试
references:
  - title: JavaScript error reference — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors
    checked: 2026-10-20
  - title: Array.prototype.forEach() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach
    checked: 2026-10-20
  - title: Debug JavaScript — Chrome DevTools
    url: https://developer.chrome.com/docs/devtools/javascript
    checked: 2026-10-20
---

## 排错的五个步骤

1. **稳定地复现**：找到一组每次都能触发问题的操作或输入。“有时候”通常意味着还没找到条件：特定的数据（空数组、只有一项、负数）、特定的顺序（先删除再添加）、特定的时机（网络慢的时候）；
2. **缩小范围**：把问题缩小到尽可能小的代码和数据上。一个有效的方法是**二分**：问题出现在 A→B→C→D 这条路径上，先检查 B 的输出对不对，对的话问题在 C、D，否则在 A、B。数据也可以二分：100 条数据出错，试试前 50 条；
3. **提出假设，验证它**：“我认为是排序修改了原数组”，然后用一个断点、一行输出或者一个小测试**证实或者否定**它。没有验证过的假设，不要据此修改代码；
4. **修复原因，而不是症状**：在显示处把 `NaN` 换成 `0`，只是把问题藏了起来；
5. **写回归测试**：把第 1 步找到的复现条件写成测试。它先在修复前失败，修复后通过，以后也不会悄悄回来。

前面的课程已经提供了工具：f04 的断点和堆栈，b、c 阶段的类型（很多 bug 在编译期就能被发现），这一课再加上一个：**先写一个失败的测试**。测试就是一个可以反复运行的、最小的复现。

## 读懂错误信息

很多问题有明确的错误信息，先读懂它。同样的错误，Chromium 和 Safari 的说法不同（下面是两个浏览器中实际得到的）：

| 原因 | Chromium | Safari |
| --- | --- | --- |
| 在 `undefined` 上读属性 | `Cannot read properties of undefined (reading 'name')` | `undefined is not an object (evaluating 'user.name')` |
| 调用的不是函数 | `api.load is not a function` | `api.load is not a function. (In 'api.load()', 'api.load' is undefined)` |
| 给 `const` 重新赋值 | `Assignment to constant variable.` | `Attempted to assign to readonly property.` |
| 在 `let` 声明之前使用 | `Cannot access 'x' before initialization` | 同左 |
| 无效的 JSON | `Expected property name or '}' in JSON at position 1 (line 1 column 2)` | `JSON Parse error: Expected '}'` |

读错误信息时问三个问题：**什么值**出了问题（`undefined`）？**在哪里**（堆栈的第一层，f04）？这个值**从哪里来**（顺着调用栈往下找，是谁传进来的）？例如 `Cannot read properties of undefined (reading 'name')` 出现在 `user.name`，要找的不是这一行，而是“为什么 `user` 是 `undefined`”：是 `find` 没有找到？是请求还没回来？还是数组越界？`strict` 和 `noUncheckedIndexedAccess`（c11）能在编译期挡住其中的大部分。

## 常见的几类 bug

| 类型 | 例子 | 怎样发现 |
| --- | --- | --- |
| 意外的修改 | `sort`、`reverse`、`splice` 修改原数组（a17）；两个变量指向同一个对象（a11） | 测试“传入的数组不变”；用 `toSorted` 等不修改原数组的方法；`readonly` 类型 |
| 边界与差一错误 | 循环从 1 开始；分页的页码从 1 还是 0 开始；`<` 写成 `<=` | 测试空数组、一项、正好等于边界的情况 |
| 数字与字符串 | `'2' + 1` 是 `'21'`；`0.1 + 0.2` 不等于 `0.3`；`12.3` 显示成了 `¥12.3` | 金额用整数的“分”计算；格式化时用 `toFixed(2)` |
| 遗漏的 `await` | `forEach(async …)` 不会等待；忘了 `await` 的 Promise 中的错误没有被接住 | 类型（返回值是 `Promise`）；lint 规则 `no-misused-promises`（把 async 函数传给不等待它的 `forEach`）和 `no-floating-promises`（调用了返回 Promise 的函数却没有 `await`），见 f11 |
| 竞态 | 先发出的请求后返回，旧的结果覆盖了新的（e08） | 在测试中控制请求完成的顺序 |

`forEach(async …)` 值得单独看一下：

:::playground{#foreach-async}
```ts file=main.ts
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const delays = [30, 10, 20];

const results: number[] = [];
delays.forEach(async (ms) => {
  await sleep(ms);
  results.push(ms);
});
console.log('forEach 之后：', results);

const ordered = await Promise.all(
  delays.map(async (ms) => {
    await sleep(ms);
    return ms;
  }),
);
console.log('Promise.all：', ordered);
setTimeout(() => console.log('稍后：', results), 50);
```
- `forEach` 不理会回调返回的 Promise，所以第 9 行输出时 `results` 还是空的；稍后再看，元素已经加进来了，但顺序是**完成的顺序**（10、20、30），不是数组的顺序。
- `Promise.all` 加上 `map` 等待全部完成，结果的顺序与输入一致。
- 这类 bug 的症状是“有时候是空的”“顺序偶尔不对”，正好对应“取决于时机”。
:::

## 练习：根据错误报告修复

下面的小任务给出了用户的错误报告和一组测试。按照五个步骤来：先运行测试，看哪些失败了、失败的信息是什么；在 `main.ts` 中写出最小的复现；对每个 bug 提出假设，用一行输出或者断点验证；修复之后再运行测试。

::exercise{#fix-cart}

## 编程挑战

挑战中的 bug 都和异步有关：时机不同，结果就不同。测试用“可以手动控制完成时机的 Promise”把时机固定下来，这也是复现异步 bug 的常用方法。

::exercise{#fix-loader}

::quiz

## 常见错误

- **没有复现就开始修改**：改完之后无法确认是否修好了。先让问题稳定地出现。
- **一次修改好几处**：修好了也不知道是哪一处起了作用，引入了新问题也不知道是哪一处。一次只改一处，改完就验证。
- **在症状处打补丁**：`NaN` 换成 `0`、`try { … } catch {}` 吞掉错误、在列表为空时再请求一次。找到原因再修改。
- **修好了不写测试**：同样的 bug 以后可能被别人（或者你自己）重新引入。
- **以为 `forEach(async …)` 会等待**：用 `for…of` 加 `await`（依次执行）或者 `Promise.all` 加 `map`（同时执行）。
