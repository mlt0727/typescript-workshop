---
version: 1
mode: ts
estimatedMinutes: 35
review: self-reviewed
problem: 程序总会遇到无法继续的情况：配置文件格式错误、参数超出范围、网络断开。JavaScript 用 throw 抛出错误、用 try/catch 处理，写法和 Java 很像，但有三个关键不同：任何值都能被抛出、catch 不能按类型分开写、TypeScript 也不知道一个函数会抛出什么。所以 catch 到的错误类型是 unknown，你必须先检查再使用。
objectives:
  - 用 throw new Error(...) 抛出错误，用 try/catch/finally 处理
  - 理解 catch 的变量类型是 unknown，用 instanceof Error 收窄后再读取 message
  - 知道 JavaScript 没有受检异常，也不能按类型写多个 catch
  - 用 cause 包装底层错误，并判断什么时候该抛出、什么时候该返回 null
references:
  - title: Control flow and error handling（Exception handling statements）— MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Control_flow_and_error_handling
    checked: 2026-10-20
  - title: Error — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
    checked: 2026-10-20
  - title: Error.prototype.cause — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause
    checked: 2026-10-20
  - title: useUnknownInCatchVariables — TSConfig Reference
    url: https://www.typescriptlang.org/tsconfig/#useUnknownInCatchVariables
    checked: 2026-10-20
---

## throw 与 try/catch/finally

`throw new Error('说明')` 抛出一个错误，当前函数立刻停止，错误沿着调用链向上传递，直到被某个 `try/catch` 捕获；没有人捕获时，程序报“未捕获的错误”。`finally` 块无论是否出错都会执行，常用于清理工作。

除了 `Error`，还有表示特定问题的内置错误类型，例如 `TypeError`、`RangeError`、`SyntaxError`（`JSON.parse` 解析失败时抛出）。

:::playground{#throw-catch}
```ts file=main.ts
function parsePercent(text: string): number {
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new RangeError(`不是有效的百分比：${text}`);
  }
  return value;
}

try {
  console.log(parsePercent('42'));
  console.log(parsePercent('120'));
  console.log('这一行不会执行');
} catch (err) {
  console.log('出错了');
} finally {
  console.log('finally 总会执行');
}
```
- 第 11 行抛出错误后，`try` 块中剩下的第 12 行被跳过，直接进入 `catch`。
- `Number.isFinite` 同时排除了 `NaN` 和 `Infinity`。
- 和 Java 不同，JavaScript **没有受检异常**：函数签名里不写会抛出什么，TypeScript 也不会检查你是否处理了错误。
:::

## catch 到的是 unknown

JavaScript 允许 `throw` 任何值：字符串、数字、普通对象都可以。所以 `catch (err)` 里的 `err` 可能是任何东西。在 TypeScript 的 `strict` 选项下（它包含 `useUnknownInCatchVariables`），TypeScript 把它的类型定为 **`unknown`**：不能直接读取属性，必须先检查。最常用的检查是 `err instanceof Error`。

另外，JavaScript 既没有 Java 那样的多个 `catch (IOException e)`，也没有 Python 那样的 `except ValueError:`：只能写一个 `catch`，在里面按需判断。

:::playground{#unknown-catch expect="18046@main.ts:4"}
```ts file=main.ts
try {
  JSON.parse('{ 坏的 JSON');
} catch (err) {
  console.log(err.message);
  if (err instanceof Error) {
    console.log(err.name, '：', err.message);
  }
}

function risky(kind: number): void {
  if (kind === 1) {
    throw new Error('普通的 Error');
  }
  throw '只是一个字符串';
}

for (const kind of [1, 2]) {
  try {
    risky(kind);
  } catch (err) {
    if (err instanceof Error) {
      console.log('Error：', err.message);
    } else {
      console.log('不是 Error：', err);
    }
  }
}
```
- 第 4 行报 TS18046：`err` 的类型是 `unknown`。第 5 行检查之后，TypeScript 知道它是 `Error`，可以读取 `name` 和 `message`。
- 第 14 行抛出了一个字符串。这是不好的写法（字符串没有调用栈），但别人的代码可能这样做，所以 `catch` 里要考虑这种情况。
- 不需要错误对象时，可以省略变量：`catch { … }`。
:::

## 包装错误：cause

在较低层捕获错误后，常常需要换成对调用方更有意义的说明，同时保留原始错误以便排查。`new Error(说明, { cause: 原始错误 })`（ES2022）正是为此设计的：

:::playground{#cause}
```ts file=main.ts
function loadConfig(text: string): { port: number } {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error('配置文件格式错误', { cause: err });
  }
}

try {
  loadConfig('{');
} catch (err) {
  if (err instanceof Error) {
    console.log(err.message);
    console.log('原因：', err.cause instanceof Error ? err.cause.name : err.cause);
  }
}
```
- 输出“配置文件格式错误”，原因是 `SyntaxError`。
- `cause` 的类型同样是 `unknown`，使用前也要检查。
:::

## 抛出，还是返回 null？

不是所有失败都应该抛出错误。一个简单的判断标准：

- **预料之中、调用方通常要处理的情况**（找不到用户、输入框为空）：返回 `null` 或一个表示结果的值（a05）。TypeScript 会强迫调用方检查。
- **不应该发生、或者当前函数无法处理的情况**（配置文件损坏、违反了函数的前提条件）：抛出错误，让上层统一处理。

无论选择哪种，都**不要悄悄吞掉错误**：空的 `catch {}` 会让 bug 变得极难排查。确实要忽略时，至少写清楚原因。

::exercise{#error-message}

## 编程挑战

::exercise{#parse-port-errors}

::quiz

## 常见错误

- **在 `catch` 里直接用 `err.message`**：`err` 是 `unknown`，先 `instanceof Error`。
- **用 `as Error` 消除报错**：被抛出的可能根本不是 `Error`。
- **抛出字符串**：`throw '出错了'` 没有调用栈。始终抛出 `Error` 或它的子类。
- **空的 `catch`**：错误被悄悄吞掉，问题被推迟到更难排查的地方。
- **用异常表示正常的分支**：预料之中的失败，返回 `null` 往往更清楚。

## 下一步

A 阶段到这里结束。B 阶段开始系统地学习 TypeScript 的类型：用 `type` 和 `interface` 描述对象，以及联合类型、收窄、泛型等。
