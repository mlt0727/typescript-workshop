---
version: 1
mode: ts
estimatedMinutes: 30
review: ai-draft
problem: 条件和循环的语法与 Java/C++ 几乎一样，可以很快迁移过来。真正需要注意的是少数几处不同：switch 用 === 比较、for...of 和 for...in 是两种完全不同的循环，以及按下标遍历字符串时可能把一个字符拆成两半。
objectives:
  - 快速迁移 if/else、三元运算符、while、do...while 与经典 for 循环
  - 写出不会意外贯穿的 switch，知道 noFallthroughCasesInSwitch 的作用
  - 用 for...of 遍历值，知道 for...in 遍历的是键（字符串），不要用它遍历数组
  - 知道 for...of 按字符（码点）遍历字符串，而下标按 UTF-16 编码单元
references:
  - title: Control flow and error handling — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Control_flow_and_error_handling
    checked: 2026-10-20
  - title: Loops and iteration — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Loops_and_iteration
    checked: 2026-10-20
  - title: for...of — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of
    checked: 2026-10-20
  - title: for...in — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...in
    checked: 2026-10-20
  - title: noFallthroughCasesInSwitch — TSConfig Reference
    url: https://www.typescriptlang.org/tsconfig/#noFallthroughCasesInSwitch
    checked: 2026-10-20
---

## 和 Java 一样的部分

`if`/`else if`/`else`、三元运算符 `条件 ? 值1 : 值2`、`while`、`do...while`、经典 `for (初始化; 条件; 更新)`、`break`、`continue` 的写法和 Java/C++ 相同。Python 用户注意：条件要放在括号里，代码块用花括号而不是缩进。

:::playground{#basics}
```ts file=main.ts
const score: number = 85;

if (score >= 90) {
  console.log('A');
} else if (score >= 60) {
  console.log('及格');
} else {
  console.log('不及格');
}

const passed = score >= 60 ? '通过' : '未通过';
console.log(passed);

let total = 0;
for (let i = 1; i <= 100; i++) {
  if (i % 2 === 0) {
    continue;
  }
  total += i;
}
console.log(total);

let tries = 0;
do {
  tries++;
} while (tries < 0);
console.log(tries);
```
- 第 15–20 行：累加 1 到 100 中的奇数，结果是 `2500`。
- 第 24–26 行：`do...while` 先执行一次再判断条件，所以即使条件一开始就不成立，`tries` 也是 `1`。
- 即使代码块只有一行，也建议写上花括号，这是大多数 JavaScript 代码规范的要求。
:::

## switch：用 === 比较，小心贯穿

`switch` 用 `===` 比较值，可以直接用于字符串（Java 7 起也支持）。和 Java/C++ 一样，一个 `case` 执行完如果没有 `break` 或 `return`，会**继续执行下一个 `case`**（贯穿，fallthrough）。

本平台开启了 TypeScript 的 `noFallthroughCasesInSwitch`：非空的 `case` 贯穿到下一个 `case` 时会报错。空的 `case` 可以叠在一起，表示“这几种情况做同一件事”。

:::playground{#switch expect="7029@main.ts:4"}
```ts file=main.ts
function sizeLabel(size: string): string {
  let label = '未知';
  switch (size) {
    case 'S':
      label = '小';
    case 'M':
      label = '中';
      break;
    case 'L':
    case 'XL':
      label = '大';
      break;
  }
  return label;
}

console.log(sizeLabel('S'), sizeLabel('XL'), sizeLabel('s'));
```
- 第 4 行报 TS7029：`case 'S'` 后面没有 `break`，会贯穿到 `case 'M'`。运行一下，`sizeLabel('S')` 得到的是“中”。在第 5 行后面加上 `break;` 修复它。
- 第 9–10 行：空的 `case 'L'` 叠在 `case 'XL'` 上，这是允许的。
- `sizeLabel('s')` 得到“未知”：`===` 区分大小写。
- 在函数里，每个 `case` 直接 `return` 往往比先赋值再 `break` 更简洁。
:::

## for...of 与 for...in

这是最需要注意的地方。两种循环名字很像，作用完全不同：

- `for (const x of 可迭代对象)`：遍历**值**。相当于 Python 的 `for x in list`、Java 的 `for (var x : list)`。可以遍历数组、字符串，以及后面会学的 `Map`、`Set`。
- `for (const key in 对象)`：遍历对象的**键**（属性名），键总是字符串。

Python 用户很容易写出 `for (const x in arr)`，期待得到元素，结果得到的是下标字符串 `'0'`、`'1'`……**不要用 `for...in` 遍历数组。**

:::playground{#of-vs-in}
```ts file=main.ts
const fruits = ['苹果', '香蕉'];

for (const fruit of fruits) {
  console.log('of:', fruit);
}

for (const key in fruits) {
  console.log('in:', key, typeof key);
}

const user = { name: 'Ada', born: 1815 };
for (const key in user) {
  console.log(key);
}
```
- 第 3–5 行：`for...of` 得到元素。
- 第 7–9 行：`for...in` 得到的是字符串 `'0'` 和 `'1'`。
- 第 12–14 行：遍历普通对象的属性名是 `for...in` 的正常用途（不过更常用的是 a11 会讲的 `Object.keys`、`Object.entries`）。
- 循环变量用 `const` 声明：每一轮循环都是一个新的变量，在循环体里不需要重新赋值。
:::

## 遍历字符串：for...of 按字符，下标按编码单元

a04 讲过，`length` 统计的是 UTF-16 编码单元，emoji 等字符占 2 个。用下标遍历会把这样的字符拆成两半；`for...of` 则按完整的字符（Unicode 码点）遍历：

:::playground{#string-iteration}
```ts file=main.ts
const text = '好😀';

for (const ch of text) {
  console.log('of:', ch);
}

for (let i = 0; i < text.length; i++) {
  console.log('下标', i, text.charAt(i));
}
```
- `for...of` 输出两次：`好` 和 `😀`。
- 下标循环执行了 3 次，后两次各得到半个 emoji，显示成乱码。
- 处理用户输入的文字时，优先用 `for...of`。
:::

::exercise{#delivery-days}

## 编程挑战

::exercise{#first-repeated}

::quiz

## 常见错误

- **用 `for...in` 遍历数组**：得到的是下标字符串，不是元素。用 `for...of`。
- **`switch` 忘了 `break`**：本平台会报 TS7029；在没有开启这个选项的项目里，它只会悄悄产生错误结果。
- **按下标遍历用户输入的文字**：emoji 会被拆成两半。用 `for...of`。
- **省略花括号**：`if (x) doA(); doB();` 中的 `doB()` 不受 `if` 控制。

## 下一步

下一课讲数组：创建、读写、越界访问的结果，以及为什么本平台的 `arr[0]` 类型是 `T | undefined`。
