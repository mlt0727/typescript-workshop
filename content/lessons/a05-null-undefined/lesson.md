---
version: 1
mode: ts
estimatedMinutes: 30
review: ai-draft
problem: “值可能不存在”是最常见的 bug 来源之一：Java 的 NullPointerException、Python 的 'NoneType' object has no attribute。JavaScript 甚至有两种“没有值”：null 和 undefined。TypeScript 的严格模式会在编译期把这类问题全部指出来，前提是你知道它在说什么、该怎么处理。
objectives:
  - 区分 undefined 与 null，知道它们分别从哪里来
  - 理解严格模式下 string 不包含 null/undefined，可能缺失的值要写成 string | null 等联合类型
  - 用 === null / === undefined 检查后再使用值，理解 TypeScript 的收窄
  - 知道 JSON 只有 null 没有 undefined
references:
  - title: undefined — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/undefined
    checked: 2026-10-20
  - title: null — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/null
    checked: 2026-10-20
  - title: Everyday Types（null and undefined、Union Types）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
    checked: 2026-10-20
  - title: Narrowing（Equality narrowing）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
    checked: 2026-10-20
  - title: strictNullChecks — TSConfig Reference
    url: https://www.typescriptlang.org/tsconfig/#strictNullChecks
    checked: 2026-10-20
---

## 两种“没有值”

- `undefined`：**“还没有值”**。通常是语言自动给的：声明了但没赋值的变量、读取对象上不存在的属性、没有 `return` 的函数的返回值、调用时没传的参数。
- `null`：**“明确地表示空”**，通常是代码主动返回的。例如浏览器里 `document.querySelector` 找不到元素时返回 `null`。

Python 只有 `None`，Java 只有 `null`。在 JavaScript 里两者都会遇到，下面先看 `undefined` 从哪里来：

:::playground{#where-undefined}
```ts file=main.ts
let notYet: number | undefined;
console.log(notYet);

function logOnly(message: string) {
  console.log(message);
}
const result = logOnly('这个函数没有 return');
console.log(result);

console.log('hi'.at(5));
console.log(typeof undefined, typeof null);
```
- 第 1 行的 `number | undefined` 读作“数字或 undefined”，这种用 `|` 连接的类型叫**联合类型**（union type），B 阶段详讲。
- 第 7 行：没有 `return` 的函数返回 `undefined`。把鼠标停在 `result` 上，TypeScript 显示它的类型是 `void`，意思是“这个函数不返回有用的值”。
- 第 10 行：`at(5)` 超出了字符串的范围，返回 `undefined`（不会像 Java 那样抛出越界异常）。
- 第 11 行：`typeof null` 是 `'object'`，这是 a02 讲过的历史遗留问题。
:::

## 严格模式：string 不包含 null

在本平台（以及所有新项目推荐的）严格模式下，TypeScript 开启了 `strictNullChecks`：`string` 类型**只**包含字符串，不包含 `null` 和 `undefined`。一个值可能缺失时，类型必须写出来，例如 `string | null`。

这和 Java 不同：Java 里任何对象引用都可能是 `null`，编译器不会提醒你。

:::playground{#strict-null expect="2322@main.ts:1, 18047@main.ts:11" run=error}
```ts file=main.ts
const nothing: string = null;

function findCity(code: string): string | null {
  if (code === 'SH') {
    return '上海';
  }
  return null;
}

const city = findCity('BJ');
console.log(city.length);
```
- 第 1 行：`null` 不能赋给 `string`，报 TS2322。
- 第 11 行：`findCity` 可能返回 `null`，直接读 `city.length` 报 TS18047（“`city` 可能是 null”）。
- 运行一下：第 11 行真的抛出了 `TypeError: Cannot read properties of null`——这正是 TypeScript 想提前阻止的错误。
:::

## 先检查，再使用

处理方法是先检查值是不是 `null`（或 `undefined`），再使用它。TypeScript 会跟踪这些检查：在检查之后的代码里，它知道值已经不可能是 `null`。这叫**收窄**（narrowing），a02 用 `typeof` 体验过一次。

:::playground{#narrowing}
```ts file=main.ts
function findCity(code: string): string | null {
  if (code === 'SH') {
    return '上海';
  }
  return null;
}

function cityLabel(code: string): string {
  const city = findCity(code);
  if (city === null) {
    return '未知城市';
  }
  return `${city}（${city.length} 个字）`;
}

console.log(cityLabel('SH'));
console.log(cityLabel('BJ'));
```
- 把鼠标停在第 9 行的 `city` 上：类型是 `string | null`。停在第 13 行的 `city` 上：类型变成了 `string`，因为 `null` 的情况在第 11 行已经 `return` 了。
- 检查要和类型对应：`at()` 返回的是 `string | undefined`，就要检查 `=== undefined`；检查 `=== null` 不能排除 `undefined`。
:::

a08 会讲 `?.` 和 `??`，它们是处理可能缺失的值的简写。在那之前，用 `if` 检查是最清楚的写法。

## null 还是 undefined？

两者都能表示“没有值”，团队通常会约定一种。一个实际的区别是 JSON：JSON 有 `null`，但没有 `undefined`。

:::playground{#json-null}
```ts file=main.ts
const profile = { name: 'Ada', phone: null, email: undefined };

console.log(JSON.stringify(profile));
console.log(String(undefined), `${null}`);
```
- 第 3 行：`JSON.stringify` 保留了值为 `null` 的 `phone`，但直接丢掉了值为 `undefined` 的 `email`。和后端交换数据时要注意这一点。
- 第 4 行：`null` 和 `undefined` 转成字符串分别是 `'null'` 和 `'undefined'`，拼到给用户看的文字里就是 bug。
:::

::exercise{#safe-initial}

## 编程挑战

::exercise{#parse-age}

::quiz

## 常见错误

- **只检查 `null`，忘了 `undefined`**（或者反过来）：先看清楚类型里写的是哪一个。
- **用 `!` 或 `as` 让错误消失**：`city!.length` 只是告诉 TypeScript“相信我”，运行时仍然会抛出 `TypeError`。本课程的练习禁止这样做。
- **用 `NaN`、`''`、`-1` 之类的“特殊值”表示缺失**：调用方很容易忘记检查。返回 `null` 时，TypeScript 会强迫调用方处理。
- **把 `null`/`undefined` 拼进文字**：用户会看到“你好，undefined”。

## 下一步

下一课讲运算符、`===` 与类型转换：为什么 JavaScript 有 `==` 和 `===` 两种相等，以及为什么几乎总是用 `===`。
