---
version: 1
mode: ts
estimatedMinutes: 30
review: ai-draft
problem: 在 Java 里，if 的条件必须是 boolean；在 JavaScript 里，任何值都可以放进 if，它会被当作“真”或“假”。`if (count)` 写起来很短，但当 count 是 0 时，它的意思就从“有没有值”悄悄变成了“是不是非零”。
objectives:
  - 记住全部 falsy 值，知道其余的值都是 truthy（包括 '0'、[] 和 {}）
  - 用 Boolean(x) 或 !!x 把值转换成布尔值
  - 理解 && 与 || 返回的是参与运算的值，并且会短路
  - 判断什么时候可以用真假检查，什么时候必须写 === null 这样的明确检查
references:
  - title: Falsy — MDN Glossary
    url: https://developer.mozilla.org/en-US/docs/Glossary/Falsy
    checked: 2026-10-20
  - title: Truthy — MDN Glossary
    url: https://developer.mozilla.org/en-US/docs/Glossary/Truthy
    checked: 2026-10-20
  - title: Logical AND (&&) — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Logical_AND
    checked: 2026-10-20
  - title: Narrowing（Truthiness narrowing）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
    checked: 2026-10-20
---

## falsy 值只有 8 个

放进 `if` 条件、`!`、`&&`、`||` 的值会被转换成布尔值。转换成 `false` 的值叫 **falsy**，一共只有这些：

`false`、`0`、`-0`、`0n`（bigint 的零）、`''`（空字符串）、`null`、`undefined`、`NaN`

**其余所有值**都是 **truthy**，包括字符串 `'0'`、`'false'`、只有空格的 `' '`，以及空数组 `[]` 和空对象 `{}`。

注意和 Python 的区别：Python 里空列表、空字典是假，JavaScript 里空数组、空对象是真。

:::playground{#falsy-values}
```ts file=main.ts
console.log(Boolean(0), Boolean(''), Boolean(null), Boolean(undefined), Boolean(NaN));
console.log(Boolean('0'), Boolean('false'), Boolean(' '), Boolean([]), Boolean({}));

const name: string = 'Ada';
console.log(!!name, !name);
```
- `Boolean(x)` 把任意值转换成布尔值。`!!x` 是同样效果的简写：第一个 `!` 转换并取反，第二个再取反回来。
- 第 2 行全部是 `true`。
:::

## 真假检查与收窄

`if (value)` 会同时排除 `null`、`undefined` 和其他所有 falsy 值。TypeScript 理解这一点，并据此收窄类型：

:::playground{#truthy-narrowing}
```ts file=main.ts
function greet(name: string | null): string {
  if (name) {
    return `你好，${name}`;
  }
  return '你好，访客';
}

function stockLabel(count: number | null): string {
  if (!count) {
    return '库存未知';
  }
  return `库存 ${count} 件`;
}

console.log(greet('Ada'), greet(null), greet(''));
console.log(stockLabel(5), stockLabel(null), stockLabel(0));
```
- `greet`：在 `if (name)` 分支里，`name` 被收窄成 `string`。空字符串也走了“访客”分支——对名字来说，这通常正是想要的。
- `stockLabel`：`stockLabel(0)` 返回了“库存未知”，这是 bug。库存为 0 是一个明确的值，但 `0` 是 falsy，被当成了“没有值”。
- 修复：把 `!count` 改成 `count === null`，再运行一次。
:::

**规则**：值的类型里包含 `number`、`string` 或 `boolean`，而 `0`、`''`、`false` 在业务上有意义时，不要用真假检查判断“有没有值”，要明确写 `=== null` / `=== undefined`。

## && 与 || 返回的是值

`&&` 和 `||` 不一定返回 `true`/`false`，而是返回两边中的一个：

- `a && b`：`a` 是 falsy 就返回 `a`，否则返回 `b`。
- `a || b`：`a` 是 truthy 就返回 `a`，否则返回 `b`。

它们还会**短路**：结果由左边确定时，右边根本不会被计算。这和 Java 的 `&&`、`||` 一样。

:::playground{#and-or-values}
```ts file=main.ts
const cat: string = '猫';
const empty: string = '';
const zero: number = 0;

console.log(cat && '狗', empty && '狗');
console.log(zero || 42, cat || 42);

function loud(label: string): boolean {
  console.log(`计算了${label}`);
  return true;
}
const enabled: boolean = false;
console.log(enabled && loud('右边'));
```
- 第 5 行：`cat` 是 truthy，`&&` 返回右边的 `'狗'`；`empty` 是 falsy，直接返回它本身（空字符串，所以输出里看不到）。
- 第 6 行：`zero || 42` 得到 `42`，`cat || 42` 得到 `'猫'`。
- 第 13 行：左边是 `false`，`loud` 没有被调用，所以没有输出“计算了右边”。
- 示例里先把值放进带类型注解的变量。如果直接写 `'猫' && '狗'`，TypeScript 会报 TS2872（“这种表达式永远是 truthy”），因为结果在写代码时就已经确定了。
:::

用 `||` 设默认值时会吞掉 `0` 和 `''`，a08 会讲专门为此设计的 `??`。

## TypeScript 能发现的“永远为真”

有些条件写错了也能运行，但结果永远一样。最常见的是忘了调用函数：

:::playground{#always-truthy expect="2774@main.ts:5"}
```ts file=main.ts
function isWeekend(day: number): boolean {
  return day === 0 || day === 6;
}

if (isWeekend) {
  console.log('今天是周末');
}
```
- 第 5 行少了 `(…)`：判断的是“函数存不存在”，而函数永远存在。TypeScript 报 TS2774。
- 运行一下，无论哪天都会输出“今天是周末”。改成 `isWeekend(3)` 再试试。
:::

::exercise{#is-blank}

## 编程挑战

::exercise{#profile-summary}

::quiz

## 常见错误

- **用 `if (count)` 判断数字有没有值**：`0` 会被当成没有值。
- **以为 `'0'`、`'false'`、`[]` 是 falsy**：它们都是 truthy。判断数组是否为空要用 `arr.length === 0`。
- **以为 `&&`、`||` 一定返回布尔值**：它们返回其中一边的值。需要布尔值时用 `Boolean(x)`。
- **条件里忘了调用函数**：`if (isReady)` 永远为真。

## 下一步

下一课讲 `?.`、`??` 与 `||` 的区别：如何安全地读取可能缺失的嵌套数据，以及如何正确地设置默认值。
