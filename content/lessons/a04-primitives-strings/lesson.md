---
version: 1
mode: ts
estimatedMinutes: 35
review: ai-draft
problem: 数字、字符串、布尔值你在 Python/Java 里早就用熟了，但 JavaScript 有几处不同：只有一种数字类型，除法不会取整，除以 0 不抛异常，字符串也没有 char。把这些差异提前弄清楚，可以少踩很多“结果差一点”的坑。
objectives:
  - 知道 number 是唯一的数字类型（64 位浮点数），会用 Math.trunc / Math.floor 做整数除法
  - 认识 NaN 与 Infinity，会用 Number.isNaN 检查转换失败
  - 掌握常用字符串方法，知道字符串不可变
  - 用模板字符串拼接文字，知道 + 遇到字符串时会拼接
  - 类型注解使用小写的 number、string、boolean
references:
  - title: Number — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number
    checked: 2026-10-20
  - title: NaN — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/NaN
    checked: 2026-10-20
  - title: String — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String
    checked: 2026-10-20
  - title: Template literals — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals
    checked: 2026-10-20
  - title: Everyday Types（The primitives）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
    checked: 2026-10-20
---

## 只有一种数字：number

JavaScript 没有 `int`、`long`、`float` 之分，所有数字都是 64 位浮点数（IEEE 754 双精度，和 Java 的 `double`、Python 的 `float` 是同一种格式）。TypeScript 用 `number` 表示它们。

这带来几个和 Java/C++ 不同的结果：

:::playground{#numbers}
```ts file=main.ts
console.log(7 / 2);
console.log(Math.trunc(7 / 2), Math.trunc(-7 / 2), Math.floor(-7 / 2));
console.log(-7 % 3);
console.log(0.1 + 0.2, (0.1 + 0.2).toFixed(2));
console.log(Math.round(2.5), Math.round(-2.5));
console.log(Number.MAX_SAFE_INTEGER);
```
- 第 1 行：`7 / 2` 是 `3.5`，**除法不会自动取整**。需要整数除法时自己选择取整方式：`Math.trunc` 向 0 取整（和 Java/C++ 的整数除法一样，`-7 / 2` 得 `-3`）；`Math.floor` 向下取整（和 Python 的 `//` 一样，得 `-4`）。
- 第 3 行：`%` 的结果符号跟随被除数，`-7 % 3` 是 `-1`。这和 Java/C++ 相同，和 Python（结果是 `2`）不同。
- 第 4 行：`0.1 + 0.2` 不精确等于 `0.3`，这是二进制浮点数的普遍问题，Java 的 `double` 也一样。显示时可以用 `toFixed(2)` 保留两位小数（它返回字符串）。
- 第 5 行：`Math.round` 遇到 `.5` 时向正无穷方向取整，所以 `-2.5` 得 `-2`。这和 Java 的 `Math.round` 相同，和 Python 的 `round`（`round(2.5)` 是 `2`）不同。
- 第 6 行：整数在 ±(2⁵³ − 1) 以内是精确的，超出后会丢失精度。处理金额时常用整数“分”保存，就是为了只做精确的整数运算。
:::

更大的整数可以用另一种基本类型 `bigint`（写作 `10n`），本课程很少用到。

## NaN 与 Infinity

数学上没有意义的运算不会抛出异常，而是得到特殊的数字值：

- `1 / 0` 是 `Infinity`（Java 的整数除以 0 会抛异常，Python 会抛 `ZeroDivisionError`）。
- 转换失败、`0 / 0` 等得到 `NaN`（Not a Number）。`NaN` 的类型仍然是 `number`，而且它**不等于任何值，包括它自己**。

`Number(text)` 把字符串转换成数字，转换失败时得到 `NaN`，所以转换后一定要检查：

:::playground{#nan expect="2845@main.ts:4"}
```ts file=main.ts
const input = '12px';
const parsed = Number(input);
console.log(parsed, typeof parsed);
console.log(parsed === NaN);
console.log(Number.isNaN(parsed));
console.log(1 / 0, Number(''), Number(' 42 '));
```
- 第 4 行：`parsed === NaN` 永远是 `false`，TypeScript 直接报 TS2845 提醒你。检查 `NaN` 要用第 5 行的 `Number.isNaN`。
- 第 6 行：`Number('')` 是 `0`，`Number(' 42 ')` 会忽略首尾空格得到 `42`。空字符串变成 `0` 常常不是你想要的，需要单独处理。
:::

## 字符串

字符串可以用单引号或双引号，两者完全相同（本课程统一用单引号）。JavaScript 没有 `char` 类型，`'a'` 就是长度为 1 的字符串。

字符串是**不可变**的（和 Java、Python 一样）：所有方法都返回新字符串，不会修改原来的字符串。

:::playground{#strings}
```ts file=main.ts
const name = '  TypeScript  ';
const trimmed = name.trim();

console.log(trimmed.length, trimmed.toUpperCase());
console.log(trimmed.slice(0, 4), trimmed.slice(-6));
console.log(trimmed.includes('Script'), trimmed.startsWith('Type'));
console.log('7'.padStart(3, '0'), 'ab'.repeat(3));
console.log(name);
console.log('你好'.length, '😀'.length);
```
- `slice(开始, 结束)` 取子串，不包含结束位置；负数表示从末尾数，和 Python 的切片类似。
- `padStart(长度, 填充)` 在前面补字符，常用于补零。
- 第 8 行：`name` 本身没有变，`trim()` 返回的是新字符串。
- 第 9 行：`length` 统计的是 UTF-16 编码单元的个数（和 Java 的 `length()` 一样，和 Python 的 `len` 不同）。常用汉字各占 1 个，emoji 等字符占 2 个。
:::

## 模板字符串

用反引号 `` ` `` 包起来的是**模板字符串**，`${表达式}` 会被替换成表达式的值，还可以直接换行。它相当于 Python 的 f-string。

用 `+` 也能拼接，但要注意：只要有一边是字符串，`+` 就做拼接，不做加法。TypeScript 允许 `string + number`（这是常见写法），但不允许对字符串做 `-`、`*` 等算术运算：

:::playground{#template expect="2362@main.ts:9"}
```ts file=main.ts
const item = '咖啡';
const count = 2;
const price = 18;

console.log(`${count} 杯${item}，共 ${count * price} 元`);
console.log(`第一行
第二行`);
console.log('5' + 1, 1 + 2 + '3');
console.log('5' - 1);
```
- 第 5 行：`${}` 里可以写任意表达式。
- 第 8 行：`'5' + 1` 是 `'51'`；`1 + 2 + '3'` 从左往右算，先得 `3`，再拼接成 `'33'`。
- 第 9 行：TypeScript 报 TS2362。JavaScript 本身会把 `'5'` 转换成数字得到 `4`，但这种隐式转换很容易出错，TypeScript 不允许。需要数字时先用 `Number()` 转换。
:::

反过来，把数字转换成字符串可以用 `String(n)` 或模板字符串 `` `${n}` ``。

## boolean，以及类型名要小写

布尔值是小写的 `true` 和 `false`（Python 是 `True`/`False`）。

写类型注解时用小写的 `number`、`string`、`boolean`。首字母大写的 `Number`、`String`、`Boolean` 也存在，但它们指的是很少用到的“包装对象”类型，TypeScript Handbook 明确建议不要在类型注解里使用。

::exercise{#format-duration}

## 编程挑战

::exercise{#format-yuan}

::quiz

## 常见错误

- **以为 `/` 会取整**：`7 / 2` 是 `3.5`。需要整数时用 `Math.trunc` 或 `Math.floor`，并想清楚负数时要哪一种。
- **用 `=== NaN` 检查转换失败**：永远是 `false`，要用 `Number.isNaN`。
- **忘了 `Number('')` 是 `0`**：用户什么都没输入时，转换结果是 `0` 而不是 `NaN`。
- **`+` 意外拼接**：`'5' + 1` 是 `'51'`。读取输入框得到的都是字符串，计算前先转换。
- **类型注解写成 `String`、`Number`**：应该用小写。

## 下一步

下一课讲 `null` 与 `undefined`：JavaScript 里表示“没有值”的两种方式，以及严格模式下 TypeScript 如何强迫你处理它们。
