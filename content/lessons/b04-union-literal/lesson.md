---
version: 1
mode: ts
estimatedMinutes: 35
review: self-reviewed
problem: 一个值经常“可能是这个，也可能是那个”：ID 可能是数字或字符串，订单状态只能是待付款、已付款、已发货中的一个。Java 用重载、枚举或者干脆用 String 表示，TypeScript 则有更直接的工具：联合类型 A | B，和只包含一个具体值的字面量类型。两者组合起来，可以精确地描述“只能是这几个值之一”。
objectives:
  - 用联合类型 A | B 描述多种可能，知道只能直接使用所有成员共有的操作
  - 用字面量类型的联合（例如 'open' | 'closed'）代替“任意字符串”
  - 理解类型拓宽：let 和对象属性会把字面量拓宽成 string，知道怎样避免
  - 区分 (string | number)[] 和 string[] | number[]
references:
  - title: Everyday Types（Union Types、Literal Types）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
    checked: 2026-10-20
  - title: Narrowing（typeof type guards）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
    checked: 2026-10-20
---

## 联合类型：A 或 B

`string | number` 表示“字符串或数字”（a02、a05 已经用过）。一个联合类型的值，只能直接使用**所有成员共有**的操作：TypeScript 不知道它此刻到底是哪一种。要使用某个成员特有的操作，先用 `typeof` 等检查**收窄**（a02；b07 会系统讲解）。

:::playground{#union-basics expect="2339@main.ts:2"}
```ts file=main.ts
function formatBad(value: string | number): string {
  return value.toFixed(2);
}

function format(value: string | number): string {
  if (typeof value === 'number') {
    return value.toFixed(2);
  }
  return value.trim();
}

console.log(format(3.14159), format('  已售罄  '));

function show(value: string | number): string {
  return value.toString();
}
console.log(show(42), show('x'));
```
- 第 2 行：`toFixed` 只有数字才有，字符串没有，报 TS2339。
- 第 6 行检查之后，分支里的 `value` 是 `number`；`if` 之后剩下的只能是 `string`。
- 第 15 行：`toString()` 是字符串和数字都有的方法，可以直接在 `string | number` 上调用。
:::

## 字面量类型

一个具体的值也可以作为类型：`'open'` 类型只有一个值，就是字符串 `'open'`。单独使用意义不大，但把几个字面量类型联合起来，就得到了一个“只能是这几个值之一”的类型——这是 TypeScript 里最常用的写法之一，可以代替很多语言里的枚举。

:::playground{#literal-types expect="2322@main.ts:4, 2345@main.ts:11"}
```ts file=main.ts
type Status = 'pending' | 'paid' | 'shipped';

let status: Status = 'pending';
status = 'closed';
status = 'paid';

function httpMessage(code: 200 | 404 | 500): string {
  return code === 200 ? '成功' : code === 404 ? '找不到' : '服务器错误';
}
console.log(httpMessage(404));
console.log(httpMessage(201));
console.log(status);
```
- 第 4 行：`'closed'` 不在 `Status` 中，报 TS2322。拼错状态名这类错误会在编译期被发现。
- 在编辑器里输入 `status = '`，自动补全会列出三个合法的值。
- 数字也可以是字面量类型（第 7 行）。第 11 行：`201` 不在 `200 | 404 | 500` 中，报 TS2345。`boolean` 其实就是 `true | false`。
:::

## 类型拓宽：什么时候字面量变成了 string

a03 讲过：`const greeting = '欢迎'` 推断为字面量类型 `'欢迎'`，`let` 则推断为 `string`，因为 `let` 以后可能被赋成别的字符串。这叫**类型拓宽**（widening）。对象的属性也会拓宽：属性以后可以被修改，所以 `{ align: 'left' }` 的 `align` 是 `string`。

拓宽之后，值就不能传给要求字面量联合的参数了：

:::playground{#widening expect="2345@main.ts:8, 2345@main.ts:11"}
```ts file=main.ts
type Align = 'left' | 'right' | 'center';
function setAlign(align: Align): string {
  return `对齐方式：${align}`;
}

const a = 'left';
let b = 'left';
console.log(setAlign(a), setAlign(b));

const options = { align: 'left' };
console.log(setAlign(options.align));

const typed: { align: Align } = { align: 'left' };
let c: Align = 'left';
console.log(setAlign(typed.align), setAlign(c));
```
- 把鼠标停在 `a`、`b` 和 `options` 上：分别是 `"left"`、`string` 和 `{ align: string; }`。所以第 8 行的 `setAlign(b)` 和第 11 行报 TS2345。
- 最直接的修复是写出类型注解（第 13、14 行）。b16 还会介绍 `as const` 和 `satisfies`。
:::

## 联合类型的数组

`(string | number)[]` 是“每个元素可以是字符串或数字”的数组，元素可以混合；`string[] | number[]` 是“要么全是字符串、要么全是数字”的数组。两者不一样：

:::playground{#union-arrays expect="2322@main.ts:3"}
```ts file=main.ts
const mixed: (string | number)[] = ['a', 1, 'b'];
const same: string[] | number[] = [1, 2, 3];
const wrong: string[] | number[] = ['a', 1];
console.log(mixed, same, wrong);
```
- 第 3 行：数组里既有字符串又有数字，不满足任何一个成员，报 TS2322。
- 注意括号：`string | number[]` 的意思是“字符串，或者数字数组”。
:::

::exercise{#status-label}

## 编程挑战

::exercise{#format-cell}

::quiz

## 常见错误

- **在联合类型上直接调用某个成员特有的方法**：先收窄。
- **用 `string` 表示只有几种取值的状态**：写成字面量联合，拼错的值会在编译期被发现。
- **把对象属性的值传给字面量联合参数时报错**：属性被拓宽成了 `string`，给对象写上类型注解。
- **`string | number[]` 少写括号**：它和 `(string | number)[]` 完全不同。

## 下一步

下一课讲交叉类型 `A & B` 和元组 `[string, number]`。
