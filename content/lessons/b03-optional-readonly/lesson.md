---
version: 1
mode: ts
estimatedMinutes: 35
review: self-reviewed
problem: 真实数据里总有“可能没填”的字段，也总有“创建后不该再改”的字段，比如订单号。TypeScript 用可选属性 ? 和 readonly 修饰符把这两件事写进类型里。但它们都有边界：可选属性的值要先检查才能用；readonly 只是编译期的约定，而且只管一层。
objectives:
  - 用可选属性 ? 描述可能缺失的字段，使用前检查 undefined
  - 用 readonly 防止属性被重新赋值，知道它是浅的、只在编译期生效
  - 用 readonly 数组让嵌套的数组也不能被修改
  - 认识 Partial、Required、Readonly 三个工具类型，以及 Object.freeze
references:
  - title: Object Types（Optional Properties、readonly Properties）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/objects.html
    checked: 2026-10-20
  - title: Utility Types — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/utility-types.html
    checked: 2026-10-20
  - title: Object.freeze() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze
    checked: 2026-10-20
---

## 可选属性

属性名后面加 `?` 表示这个属性可以没有（a12 已经在参数的类型里用过）。读取可选属性得到的类型包含 `undefined`：`nickname?: string` 读出来是 `string | undefined`。所以使用前要检查，检查方法就是 a05、a08 学过的 `=== undefined`、`?.`、`??`。

:::playground{#optional expect="18048@main.ts:8"}
```ts file=main.ts
interface Profile {
  name: string;
  nickname?: string;
  age?: number;
}

function shout(p: Profile): string {
  return p.nickname.toUpperCase();
}

function label(p: Profile): string {
  const shown = p.nickname ?? p.name;
  return p.age === undefined ? shown : `${shown}（${p.age} 岁）`;
}

const ada: Profile = { name: 'Ada', age: 36 };
const bob: Profile = { name: 'Bob', nickname: undefined };
console.log(label(ada), label({ name: 'Cy', nickname: 'C', age: 0 }));
console.log('nickname' in ada, 'nickname' in bob);
```
- 第 8 行：`p.nickname` 可能是 `undefined`，报 TS18048。
- 第 13 行：用 `=== undefined` 判断年龄，0 岁也能正确显示。如果写成 `p.age ? … : …`，`0` 是 falsy（a07），0 岁就显示不出来了。
- 第 19 行：`'属性名' in 对象` 检查对象上有没有这个属性（b07 会用它来收窄类型）。`ada` 根本没有 `nickname` 属性，`bob` 有这个属性但值是 `undefined`，`in` 能区分两者（输出 `false true`）。默认情况下 TypeScript 的类型不区分这两种情况，所以第 17 行显式写 `nickname: undefined` 也能通过检查；a12 提到过的 `exactOptionalPropertyTypes` 选项可以让它区分。
:::

## readonly：不能重新赋值的属性

属性前面加 `readonly`，这个属性在创建后就不能被重新赋值。它和 `const` 类似：`const` 管变量，`readonly` 管属性。

但要注意它是**浅**的：`readonly items: string[]` 只是不允许 `items` 指向另一个数组，数组本身仍然可以 `push`。要让数组内容也不能修改，类型要写成 `readonly string[]`（a17）。

:::playground{#readonly expect="2540@main.ts:16, 2339@main.ts:19"}
```ts file=main.ts
interface Order {
  readonly id: string;
  readonly items: string[];
  status: string;
}

interface FrozenOrder {
  readonly id: string;
  readonly items: readonly string[];
}

const order: Order = { id: 'A1', items: ['钢笔'], status: '待付款' };
const frozen: FrozenOrder = { id: 'A2', items: ['墨水'] };

order.status = '已付款';
order.id = 'B1';
order.items.push('笔记本');

frozen.items.push('笔记本');
console.log(order, frozen);
```
- 第 15 行：`status` 没有 `readonly`，可以修改。
- 第 16 行：`id` 是 `readonly` 属性，不能重新赋值，报 TS2540。
- 第 17 行：没有报错！`readonly items` 只保护“`items` 指向哪个数组”，不保护数组的内容。
- 第 19 行：报 TS2339，只读数组上没有 `push`。注意第 9 行有两个 `readonly`：前一个管 `items` 这个属性，后一个属于数组类型 `readonly string[]`。
:::

## readonly 只在编译期生效

和所有类型一样，`readonly` 在编译后被擦除。运行上面的示例就能看到：报了错的第 16、19 行照样执行了，输出里 `id` 已经是 `'B1'`，`frozen.items` 里也多了 `'笔记本'`。

运行时真正阻止修改的是 `Object.freeze(obj)`：冻结后再对属性赋值，在 JavaScript 的严格模式下会抛出 `TypeError`（a15 讲过，模块代码都是严格模式）。`Object.freeze` 同样是浅的。TypeScript 把它返回值的类型写成 `Readonly<…>`，意思是所有属性都是 `readonly`（下一节讲）。

:::playground{#freeze expect="2540@main.ts:3" run=error}
```ts file=main.ts
const settings = Object.freeze({ theme: 'dark', fontSize: 14 });

settings.theme = 'light';
console.log('这一行不会执行');
```
- 把鼠标停在 `settings` 上：类型是 `Readonly<{ theme: "dark"; fontSize: 14; }>`。既然对象被冻结、值不会再变，TypeScript 就推断出了更精确的字面量类型（a03 讲过 `const` 也会这样推断）。
- 第 3 行：TypeScript 报 TS2540；运行一下，冻结的对象在运行时也拒绝了修改，抛出 `TypeError`。
:::

即使在编译期，`readonly` 也有管不到的地方：TypeScript 判断两个对象类型是否兼容时，不看属性是不是 `readonly`。所以，属性是 `readonly` 的对象可以赋给类型里没写 `readonly` 的变量，再通过那个变量修改。这一点不如 C++ 的 `const` 严格：C++ 不允许用非 `const` 的引用或指针指向 `const` 对象。只读**数组**是例外：`readonly string[]` 不能赋给 `string[]`（a17）。

:::playground{#readonly-assign expect="4104@main.ts:15"}
```ts file=main.ts
interface Point {
  readonly x: number;
}

interface MutablePoint {
  x: number;
}

const p: Point = { x: 1 };
const m: MutablePoint = p;
m.x = 2;
console.log(p.x);

const names: readonly string[] = ['Ada'];
const list: string[] = names;
```
- 第 10 行：没有报错。`Point` 和 `MutablePoint` 形状相同（b02），比较时不看 `readonly`。
- 第 11–12 行：`m` 和 `p` 指向同一个对象（a11），通过 `m` 修改之后，`p.x` 也变成了 `2`。
- 第 15 行：数组不一样，只读数组不能赋给普通数组，报 TS4104。
:::

## 三个常用的工具类型

TypeScript 内置了一些“根据已有类型生成新类型”的**工具类型**：

- `Partial<T>`：把 `T` 的所有属性变成可选。适合“只修改其中几个字段”的更新参数。
- `Required<T>`：把所有可选属性变成必需。
- `Readonly<T>`：把所有属性变成 `readonly`（仍然是浅的）。

:::playground{#utility-types}
```ts file=main.ts
interface Settings {
  theme: string;
  fontSize: number;
  language?: string;
}

type SettingsPatch = Partial<Settings>;

function update(current: Settings, patch: SettingsPatch): Settings {
  return { ...current, ...patch };
}

const base: Settings = { theme: 'light', fontSize: 14 };
console.log(update(base, { fontSize: 18 }));

const complete: Required<Settings> = { theme: 'dark', fontSize: 16, language: 'zh-CN' };
const locked: Readonly<Settings> = base;
console.log(complete, locked);
```
- 把鼠标停在第 7 行的 `SettingsPatch` 上，可以看到展开后的类型：每个属性都变成了可选。这些工具类型的实现原理（映射类型）在 C 阶段讲。
- 第 14 行：`patch` 只提供了 `fontSize`，这是 `Partial<Settings>` 允许的。注意 a12 的提醒：如果 `patch` 里有值为 `undefined` 的属性，展开会把它也覆盖进去。
- 第 16–17 行：`Required<Settings>` 里 `language` 成了必需的，少写会报错。`Readonly<Settings>` 不会复制对象：`locked` 和 `base` 是同一个对象，只是不能通过 `locked` 修改它的属性。
:::

::exercise{#profile-label}

## 编程挑战

::exercise{#immutable-order}

::quiz

## 常见错误

- **直接使用可选属性**：先检查 `undefined`，或用 `?.`、`??`。
- **以为 `readonly` 是深层的**：`readonly items: string[]` 的数组仍然可以 `push`，需要 `readonly string[]`。
- **以为 `readonly` 会在运行时阻止修改**：只有 `Object.freeze` 会，而且也是浅的。
- **用真假检查判断可选属性有没有提供**：`0`、`''`、`false` 都是有效值，却会被当成“没有提供”。

## 下一步

下一课讲联合类型与字面量类型：用 `'open' | 'closed'` 这样的类型精确描述“只能是这几个值之一”。
