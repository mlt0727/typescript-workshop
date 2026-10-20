---
version: 1
mode: ts
estimatedMinutes: 40
review: self-reviewed
problem: 程序里常有一份“权威”的数据：一张配置表、一组默认值、一个常量数组。如果对应的类型再手写一遍，两份迟早会不一致：加了一个设置项，忘了改类型。TypeScript 提供了三个类型运算符，从已有的值和类型中推导出新的类型：typeof 取变量的类型，keyof 取对象类型的所有键，T[K] 取某个键对应的值的类型。这一课学会用它们让类型跟着数据走，写出“返回值的类型随参数变化”的函数，并弄清 keyof 遇到索引签名、Object.keys 返回 string[] 这两个常见的意外。
objectives:
  - 在类型位置用 typeof 得到变量的类型，用 keyof 得到对象类型的键组成的联合类型
  - 用索引访问类型 T[K]、T[keyof T]、T[number] 取出属性、全部值、数组元素的类型
  - 写出 K extends keyof T 的泛型函数，让参数和返回值的类型随键变化
  - 说明 keyof 遇到索引签名时的结果，以及 Object.keys 为什么返回 string[]
references:
  - title: Keyof Type Operator — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/keyof-types.html
    checked: 2026-10-20
  - title: Typeof Type Operator — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/typeof-types.html
    checked: 2026-10-20
  - title: Indexed Access Types — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html
    checked: 2026-10-20
  - title: Object.keys() — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/keys
    checked: 2026-10-20
---

## 让类型跟着数据走

C 阶段讲“类型运算”：用已有的类型计算出新的类型。它们最实际的用途，是让类型只有**一个来源**。设想一组默认设置：

```ts
const DEFAULTS = { theme: 'light', fontSize: 16, showHints: true };
```

手写一个 `type Settings = { theme: string; fontSize: number; showHints: boolean }` 当然可以，但以后在 `DEFAULTS` 里加一项，就要记得同时改类型。更好的办法是从值推导出类型，加一项只需要改一处。

三个运算符都只存在于类型位置（冒号后面、`type` 声明中、尖括号里），编译之后全部擦除（a02）：

| 写法 | 含义 | 例子 |
| --- | --- | --- |
| `typeof 变量` | 这个变量的类型 | `typeof DEFAULTS` 是 `{ theme: string; fontSize: number; showHints: boolean }` |
| `keyof 类型` | 对象类型所有键组成的联合类型 | `keyof Settings` 是 `'theme' \| 'fontSize' \| 'showHints'` |
| `类型[键]` | 这个键对应的值的类型 | `Settings['fontSize']` 是 `number` |

`T[K]` 中的 `K` 可以是联合类型，结果也是联合：`Settings[keyof Settings]` 是所有值的类型 `string | number | boolean`。数组和元组用 `number` 作键，得到元素的类型：`(typeof COLORS)[number]`。

:::playground{#derive}
```ts file=main.ts
const DEFAULTS = { theme: 'light', fontSize: 16, showHints: true };

type Settings = typeof DEFAULTS;
type SettingKey = keyof Settings; // 'theme' | 'fontSize' | 'showHints'
type FontSize = Settings['fontSize']; // number
type AnyValue = Settings[SettingKey]; // string | number | boolean

const COLORS = ['red', 'green', 'blue'] as const;
type Color = (typeof COLORS)[number]; // 'red' | 'green' | 'blue'

const size: FontSize = 18;
const key: SettingKey = 'showHints';
const value: AnyValue = DEFAULTS[key];
const color: Color = 'green';
console.log(size, key, value, color);
```
- 把鼠标停在 `Settings`、`SettingKey` 等名字上，编辑器会显示推导出的类型。在 `DEFAULTS` 中加一项 `language: 'zh-CN'`，这些类型会一起变化。
- 第 8–9 行：没有 `as const` 时，`COLORS` 的类型是 `string[]`，`(typeof COLORS)[number]` 就只是 `string`（b16）。
- 第 13 行：`DEFAULTS[key]` 能通过检查，因为 `key` 的类型是 `SettingKey`，每一个可能的值都是 `DEFAULTS` 确实有的键。
:::

注意 `typeof` 有两种：表达式中的 `typeof x` 是 JavaScript 的运算符，运行时返回 `'string'`、`'object'` 这样的字符串（b07 用它收窄）；类型位置的 `typeof x` 是 TypeScript 的运算符，得到 `x` 的类型。后者只能用在变量（以及它的属性）上，不能写 `typeof someFunction()`。

## 让返回值随键变化

`keyof` 最常见的用法是做泛型的约束（b15）：`K extends keyof T` 表示“`K` 是 `T` 的某一个键”，返回值写成 `T[K]`，类型就会随传入的键变化。

:::playground{#generic-key expect="2345@main.ts:8"}
```ts file=main.ts
function get<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { name: 'Ada', age: 36, tags: ['admin'] };
const age = get(user, 'age'); // number
const tags = get(user, 'tags'); // string[]
const oops = get(user, 'emial');
console.log(age + 1, tags.join(','), oops);
```
- 第 6、7 行：`K` 分别被推断为 `'age'`、`'tags'`，返回值分别是 `number`、`string[]`，不需要任何断言。
- 第 8 行：`'emial'` 不在 `keyof typeof user` 中，报 TS2345。拼写错误在编译期就被发现了。
- 如果写成 `key: keyof T`、返回 `T[keyof T]`，返回值就成了所有属性类型的联合 `string | number | string[]`，调用方还得自己收窄。一个类型参数要同时出现在参数和返回值中，才能把它们“连”起来。
:::

## 两个常见的意外

**索引签名的 `keyof`。**对于 `{ [key: string]: number }` 这样的索引签名，`keyof` 的结果是 `string | number`，而不是 `string`：JavaScript 会把数字键转换成字符串，`obj[0]` 和 `obj['0']` 是同一个属性，所以数字也是合法的键。`{ [key: number]: string }` 的 `keyof` 则是 `number`。而 `keyof Record<string, number>` 是 `string`。

**`Object.keys` 返回 `string[]`。**`Object.keys(DEFAULTS)` 的类型不是 `SettingKey[]`，而是 `string[]`。原因是结构化类型（b02）：一个 `Settings` 类型的值在运行时完全可能带着更多的属性（只要它有 `Settings` 要求的那些），TypeScript 不能保证 `Object.keys` 只返回这几个键。要得到确定的键，可以：

- 遍历一个自己写的键列表（例如 `as const` 数组）；
- 写一个类型守卫（b08）：`(key: string): key is SettingKey => Object.hasOwn(DEFAULTS, key)`。这里要用 `Object.hasOwn`，不能用 `in`：`'toString' in DEFAULTS` 是 `true`，因为 `in` 也会查找原型链上继承来的属性。

一个关于 `satisfies` 的细节：如果写成 `const DEFAULTS = { …, showHints: true } satisfies Record<string, string | number | boolean>`，推导出的 `showHints` 的类型是字面量 `true` 而不是 `boolean`。上下文类型中的 `boolean` 就是 `true | false` 这两个字面量的联合，于是 `true` 被保留为字面量。之后就不能把这个设置改成 `false` 了。所以这一课的默认值直接写成普通的对象，让 TypeScript 按常规放宽类型。

::exercise{#pluck}

## 编程挑战

::exercise{#settings}

::quiz

## 常见错误

- **手写一份和数据重复的类型**：两份迟早不一致。用 `typeof`、`keyof`、`T[K]` 推导。
- **`key: keyof T` 配上返回值 `T[keyof T]`**：返回值成了所有属性类型的联合。用一个类型参数 `K extends keyof T` 把参数和返回值连起来。
- **以为 `Object.keys(obj)` 的类型是 `(keyof T)[]`**：它是 `string[]`，并且这样设计是有原因的。用键列表或者类型守卫，不要用 `as` 硬转。
- **用 `in` 判断“是不是自己定义的键”**：`in` 会查到原型链上的 `toString`、`constructor`。用 `Object.hasOwn`。
- **在类型位置写 `typeof someFunction()`**：类型位置的 `typeof` 只能用于变量和属性；要得到函数返回值的类型，用 c07 的 `ReturnType`。
