---
version: 1
mode: ts
estimatedMinutes: 30
review: self-reviewed
problem: JavaScript 有两种相等：== 和 ===。== 会先偷偷转换类型再比较，于是 '042' == 42 成立。字符串之间的 < 按字典序比较，于是 '10' < '9' 也成立。这些规则不难记，但一旦踩中，错误往往不会报出来，只是结果悄悄地错了。
objectives:
  - 使用 JavaScript 的算术、赋值和比较运算符，知道 ** 与字符串比较的规则
  - 理解 == 与 === 的区别，始终使用 === 和 !==
  - 知道对象和数组用 === 比较的是引用
  - 用 Number()、String()、Number.parseInt() 做显式类型转换
references:
  - title: Expressions and operators — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_operators
    checked: 2026-10-20
  - title: Equality comparisons and sameness — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Equality_comparisons_and_sameness
    checked: 2026-10-20
  - title: Number.parseInt() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/parseInt
    checked: 2026-10-20
  - title: Narrowing（Equality narrowing）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
    checked: 2026-10-20
---

## 熟悉的运算符，几处不同

算术运算符 `+ - * / %`、赋值运算符 `= += -=`、自增 `++`、比较运算符 `< > <= >=`、逻辑运算符 `&& || !` 的用法和 Java/C++ 基本相同。需要注意：

- `**` 是乘方（和 Python 一样；Java 要用 `Math.pow`）。
- 字符串之间可以直接用 `<`、`>` 比较，按**字典序**逐个比较字符的编码（和 Python、C++ 的 `std::string` 一样；Java 的 `String` 不能这样比较）。真正的坑在于**数字形式的字符串**也按字典序比较，见下面的例子。
- `&&` 和 `||` 返回的是参与运算的值本身，不一定是 `true`/`false`，这和 Python 的 `and`/`or` 一样（下一课详讲）。

:::playground{#operators}
```ts file=main.ts
console.log(2 ** 10, 7 % 3);

let count = 0;
count += 5;
count++;
console.log(count);

console.log('apple' < 'banana', 'Z' < 'a');
console.log('10' < '9', 10 < 9);
```
- 第 8 行：大写字母的编码小于小写字母，所以 `'Z' < 'a'` 成立。
- 第 9 行：`'10' < '9'` 成立，因为第一个字符 `'1'` 小于 `'9'`。从输入框、URL 读到的数字都是字符串，比较前要先转换成数字。
- TypeScript 不允许直接比较字符串和数字：试着在最后加一行 `console.log('10' < 9);`，会报 TS2365。
:::

## == 与 ===

- `===`（严格相等）：类型不同就是 `false`，不做任何转换。
- `==`（宽松相等）：类型不同时先按一套复杂的规则转换类型再比较。`'1' == 1`、`'' == 0`、`null == undefined` 都成立。

不等号也一样分成 `!==` 和 `!=`。**始终使用 `===` 和 `!==`**。

TypeScript 能发现很多可疑的比较：两个值的类型完全没有交集时，无论用 `==` 还是 `===` 都会报错。但当类型有交集（例如都是 `string | number`），或者数据来自 `JSON.parse` 这样的 `any` 时，它不会阻止你，`==` 的转换就会悄悄生效：

:::playground{#loose-equality expect="2367@main.ts:3"}
```ts file=main.ts
const input = '1';
const expected = 1;
console.log(input === expected);

function sameLoose(a: string | number, b: string | number): boolean {
  return a == b;
}
console.log(sameLoose('1', 1), sameLoose('042', 42), sameLoose('', 0));

const fromServer = JSON.parse('{ "count": "0" }');
console.log(fromServer.count == 0, fromServer.count === 0);
```
- 第 3 行：`'1'` 和 `1` 类型没有交集，TypeScript 报 TS2367（换成 `==` 也一样）。
- 第 8 行：参数类型有交集，TypeScript 不报错，但 `==` 认为 `'042'` 等于 `42`、空字符串等于 `0`。
- 第 11 行：`fromServer` 是 `any`，`count` 实际上是字符串 `"0"`。`==` 说它等于 `0`，`===` 说不等——`===` 的结果才反映了数据的真实情况。
:::

`==` 只有一个常见的例外用法：有些代码库用 `x == null` 同时检查 `null` 和 `undefined`。本课程统一写成 `x === null || x === undefined`，或者用 a08 的 `??`。

## 对象比较的是引用

`===` 比较对象和数组时，比较的是**是不是同一个对象**，而不是内容是否相同。这和 Java 的 `==` 一样，和 Python 的 `==`（比较内容）不同。

:::playground{#reference-equality expect="2839@main.ts:6"}
```ts file=main.ts
const a = { x: 1 };
const b = { x: 1 };
const c = a;

console.log(a === b, a === c);
console.log([1, 2] === [1, 2]);
```
- 第 5 行：`a` 和 `b` 内容相同但是两个不同的对象，结果是 `false`；`c` 和 `a` 指向同一个对象，结果是 `true`。
- 第 6 行：直接比较两个新写出来的数组，结果一定是 `false`，TypeScript 报 TS2839 提醒你。
- 要比较内容，需要逐个比较属性（或元素）。a11 会进一步讲引用。
:::

## 显式转换

需要转换类型时，自己明确地写出来：

- 字符串 → 数字：`Number(text)` 要求整段文字是一个合法的数字写法（首尾空格除外；空字符串得到 `0`，a04 讲过），否则得到 `NaN`；`Number.parseInt(text, 10)` 从开头读取尽可能多的数字，遇到非数字字符就停止。
- 数字 → 字符串：`String(n)` 或模板字符串。

:::playground{#conversions}
```ts file=main.ts
console.log(Number('42'), Number('4 2'), Number('42px'));
console.log(Number.parseInt('42px', 10), Number.parseFloat('3.14abc'));
console.log(Number.parseInt('0x1A'), Number.parseInt('0x1A', 10));
console.log(String(42) === '42');
```
- 第 2 行：`parseInt` 和 `parseFloat` 会忽略后面的非数字部分，`'42px'` 得到 `42`。这在处理 `'12px'` 这样的 CSS 值时有用，但校验用户输入时通常太宽松。
- 第 3 行：不写第二个参数时，`parseInt` 会把 `0x` 开头的文字当成十六进制，得到 `26`；写上 `10` 后按十进制读取，读到 `'0'` 之后遇到 `'x'` 就停止，得到 `0`。**总是写上 `10`**，让结果不依赖文字的写法。
:::

::exercise{#same-code}

## 编程挑战

::exercise{#compare-time}

::quiz

## 常见错误

- **使用 `==`**：它的转换规则会让 `'042' == 42` 成立。始终用 `===`。
- **比较数字形式的字符串**：`'10' < '9'` 成立。先转换成数字再比较。
- **用 `===` 比较两个对象的内容**：它比较的是引用。
- **`parseInt` 不写进制**，或者用它来校验输入：`Number.parseInt('12abc', 10)` 也会得到 `12`。

## 下一步

下一课讲 truthy 与 falsy：`if (value)` 到底在检查什么，以及 `&&`、`||` 为什么返回的不一定是布尔值。
