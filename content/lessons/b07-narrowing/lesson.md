---
version: 1
mode: ts
estimatedMinutes: 40
review: self-reviewed
problem: 联合类型、unknown、可选属性都会给你一个“可能是好几种东西”的值，而要真正使用它，必须先弄清它此刻是哪一种。TypeScript 会跟踪你写的运行时检查，在检查之后自动缩小变量的类型，这叫收窄。前面的课零散地用过几种检查，这一课把它们放在一起，并讲清楚每种检查能收窄成什么、在哪里会失效。
objectives:
  - 用 typeof、=== / !==、真假检查、in、instanceof、Array.isArray 收窄类型
  - 知道 typeof x === 'object' 也包含 null，in 和 instanceof 各自适用的场合
  - 理解控制流分析：提前 return、赋值都会改变变量此后的类型
  - 知道收窄在回调中可能失效：变量之后还会被重新赋值时，回调里不能依赖之前的检查
references:
  - title: Narrowing — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
    checked: 2026-10-20
  - title: instanceof — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/instanceof
    checked: 2026-10-20
  - title: in — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/in
    checked: 2026-10-20
  - title: TypeScript 5.4 Release Notes（Preserved Narrowing in Closures）
    url: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-4.html
    checked: 2026-10-20
---

## typeof：区分基本类型

`typeof` 返回 `'string'`、`'number'`、`'bigint'`、`'boolean'`、`'symbol'`、`'undefined'`、`'object'`、`'function'` 之一。TypeScript 会根据它收窄类型。

唯一的陷阱是 a02 讲过的 `typeof null === 'object'`：用 `typeof x === 'object'` 检查之后，`null` 仍然在类型里。

:::playground{#typeof expect="18047@main.ts:6"}
```ts file=main.ts
function size(value: string | string[] | number | null): number {
  if (typeof value === 'string') {
    return value.length;
  }
  if (typeof value === 'object') {
    return value.length;
  }
  return value;
}

function sizeFixed(value: string | string[] | number | null): number {
  if (typeof value === 'string') {
    return value.length;
  }
  if (value === null) {
    return 0;
  }
  if (typeof value === 'object') {
    return value.length;
  }
  return value;
}
console.log(sizeFixed('abc'), sizeFixed(['a', 'b']), sizeFixed(7), sizeFixed(null));
```
- 第 6 行：此时 `value` 的类型是 `string[] | null`，报 TS18047。把鼠标停在第 6 行的 `value` 上看看。
- 第 8 行：前面两个分支都 `return` 了，剩下的只能是 `number`。
- `sizeFixed` 先排除 `null`，再判断 `'object'`。
:::

## 相等与真假检查

- `=== null`、`!== undefined` 等相等检查，排除或保留特定的值（a05）。
- 两个联合类型的值用 `===` 比较时，相等的分支里两者都会被收窄到它们的**共同部分**。
- 真假检查 `if (x)` 排除 `null`、`undefined`，也会排除 `0`、`''`、`false`（a07）——在类型上，TypeScript 也会把它们从字面量类型中去掉。

:::playground{#equality}
```ts file=main.ts
function compare(x: string | number, y: string | boolean): string {
  if (x === y) {
    return x.toUpperCase() + y.toLowerCase();
  }
  return '不相等';
}

function greet(name: string | null | undefined): string {
  if (name) {
    return `你好，${name}`;
  }
  return '你好，访客';
}

console.log(compare('Hi', 'Hi'), compare(1, true), greet('Ada'), greet(''));
```
- 第 3 行：`x` 和 `y` 相等，只可能都是 `string`（两个联合唯一的共同成员），所以两者都可以调用字符串方法。
- 第 9 行之后的分支里，`name` 是 `string`；注意空字符串走了“访客”分支（a07）。
:::

## in：按属性区分对象类型

`'属性名' in 对象` 检查对象（或它的原型链）上是否有这个属性。对**对象类型的联合**，它是最直接的区分方法：

:::playground{#in-operator}
```ts file=main.ts
type Fish = { name: string; swim: () => string };
type Bird = { name: string; fly: () => string };

function move(animal: Fish | Bird): string {
  if ('swim' in animal) {
    return animal.swim();
  }
  return animal.fly();
}

const nemo: Fish = { name: 'Nemo', swim: () => '游泳' };
const tweety: Bird = { name: 'Tweety', fly: () => '飞翔' };
console.log(move(nemo), move(tweety));
```
- 第 5 行的检查之后，`animal` 是 `Fish`；第 8 行剩下的是 `Bird`。
- 注意前提：对象类型是开放的（b02），一个带有额外 `swim` 属性的对象也可以赋给 `Bird`，这时 `'swim' in animal` 会把它误判成 `Fish`。需要可靠区分时，用 b09 的可辨识联合。
- `in` 也能用在 `unknown` 收窄出的 `object` 上：`'theme' in config` 之后可以读取 `config.theme`（类型是 `unknown`，b06 的练习用过）。
:::

## instanceof：类的实例

`x instanceof C` 检查 `x` 是否是类 `C`（或其子类）的实例。适用于 `Date`、`Error`、`Map` 以及自己定义的类（b12）。它**不能**用于 `type` 和 `interface`：它们在运行时不存在（a02）。

`Array.isArray(x)` 是检查数组的专用方法，比 `instanceof Array` 更可靠：在另一个 iframe 或 Worker 中创建的数组，`instanceof Array` 会得到 `false`。

:::playground{#instanceof}
```ts file=main.ts
function stamp(when: Date | string | number[]): string {
  if (when instanceof Date) {
    return when.toISOString();
  }
  if (Array.isArray(when)) {
    return when.join('-');
  }
  return when;
}

console.log(stamp(new Date(0)), stamp('今天'), stamp([2026, 10, 20]));
```
:::

## 控制流分析：类型随代码位置变化

TypeScript 沿着代码的执行路径计算每个位置上变量的类型：提前 `return`（或 `throw`、`continue`）会把对应的情况从后面的代码中排除；给变量**赋值**也会改变它此后的类型。

**回调里的陷阱**：回调函数可能在很久以后才执行。如果变量在检查之后**还会被重新赋值**，回调执行时它可能已经变了，所以 TypeScript 不允许回调依赖之前的检查。对箭头函数这类回调，`const` 一直能保留之前的收窄；TypeScript 5.4 起，参数和 `let` 只要在创建回调之后不再被赋值，也能保留。用 `function` 声明的内部函数不适用这条规则。最稳妥的做法是先把检查过的值存进一个 `const`。

:::playground{#control-flow expect="18047@main.ts:16" run=error}
```ts file=main.ts
let value: string | number = '文字';
console.log(value.toUpperCase());
value = 42;
console.log(value.toFixed(1));

function totalLength(prefix: string | null, items: string[]): number[] {
  if (prefix === null) {
    return [];
  }
  return items.map((item) => prefix.length + item.length);
}
console.log(totalLength('ab', ['x', 'yy']));

let current: string | null = 'Ada';
if (current !== null) {
  setTimeout(() => console.log(current.length), 0);
}
current = null;
```
- 第 2、4 行：赋值让 `value` 的类型先是 `string`，后是 `number`。
- 第 10 行：`prefix` 是参数，检查之后没有再被赋值，回调里仍然是 `string`。
- 第 16 行报 TS18047：`current` 在第 18 行被改成了 `null`，回调执行时（下一轮事件循环）它确实已经是 `null`。运行一下，真的抛出了 `TypeError`。TypeScript 在这里发现的是一个真实的 bug。
:::

::exercise{#describe-input}

## 编程挑战

::exercise{#normalize-date}

::quiz

## 常见错误

- **`typeof x === 'object'` 之后直接使用 `x`**：别忘了 `null`。
- **对 `type`/`interface` 用 `instanceof`**：它们在运行时不存在，用 `in` 或 b09 的“可辨识联合”。
- **用真假检查收窄可能为 `0`、`''` 的值**：会把有效值一起排除。
- **在回调里依赖之前的检查**：如果变量之后还会被赋值，先把检查过的值存进 `const`。

## 下一步

下一课讲如何把检查封装成函数——自定义类型守卫 `x is T` 和断言函数 `asserts x is T`。
