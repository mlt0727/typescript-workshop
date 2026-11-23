---
version: 1
mode: ts
estimatedMinutes: 30
review: self-reviewed
problem: 联合类型表示“A 或 B”。有时需要的是“既是 A 又是 B”：一个带时间戳的用户，就是“用户”加上“时间戳”。另一种常见需求是“固定长度、每个位置类型不同”的数组，例如函数同时返回最小值和最大值。TypeScript 用交叉类型 A & B 和元组 [A, B] 描述这两种情况。
objectives:
  - 用交叉类型 A & B 组合对象类型，并和 interface extends 对比
  - 知道属性类型冲突时交叉的结果可能是 never
  - 用元组描述固定长度、每个位置类型不同的数组，知道越界访问会报错
  - 用元组从函数返回多个值，并知道普通数组字面量不会被推断成元组
references:
  - title: Object Types（Intersection Types、Tuple Types）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/objects.html
    checked: 2026-10-20
  - title: Everyday Types — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
    checked: 2026-10-20
---

## 交叉类型：既是 A 又是 B

`A & B` 表示同时满足 `A` 和 `B` 的类型。对两个对象类型来说，结果就是**同时拥有两边全部属性**的对象。它常用来把几个小类型组合起来，效果类似 b01 的 `interface … extends …`。

:::playground{#intersection expect="2322@main.ts:6"}
```ts file=main.ts
type Named = { name: string };
type Timestamped = { createdAt: string };
type User = Named & Timestamped & { id: number };

const ada: User = { id: 1, name: 'Ada', createdAt: '2026-10-20' };
const missing: User = { id: 2, name: 'Grace' };

function describe(entity: Named & Timestamped): string {
  return `${entity.name}，创建于 ${entity.createdAt}`;
}
console.log(describe(ada));
```
- 第 3 行：三个类型交叉在一起，`User` 需要 `name`、`createdAt` 和 `id`。
- 第 6 行：缺少 `createdAt`，报 TS2322。
- 第 11 行：`ada` 拥有 `describe` 需要的全部属性（b02 的结构化类型）。
:::

**`&` 和 `extends` 怎么选？** 只是给对象类型加几个属性时，两种写法都可以。区别有两点。一是属性冲突（两边有同名属性，类型却不兼容）时，`interface … extends …` 会直接报错，错误信息通常也更清楚；`&` 不报错，结果见下一节。二是 `extends` 只能扩展对象类型（包括对象形状的类型别名），而且要先起一个名字；`&` 可以用于联合类型、基本类型等任何类型，也可以像上面示例的第 8 行那样直接写在用到的地方。

## 冲突的交叉：never

`string & number` 要求一个值既是字符串又是数字。这样的值不存在，TypeScript 把这个类型算作 `never`：**没有任何值**的类型（b06 会详细讲）。

两个对象类型交叉时，同名属性的类型也会交叉。所以两边的同名属性类型不兼容时，交叉不会报错，而是让这个属性的类型变成 `never`：这个属性放不进任何值，也就写不出符合这个交叉类型的对象。

:::playground{#conflict expect="2322@main.ts:4"}
```ts file=main.ts
type Impossible = string & number;
type Conflict = { id: string } & { id: number };

const c: Conflict = { id: 'x' };
const nothing: Impossible[] = [];
console.log(c, nothing);
```
- 把鼠标停在 `Impossible` 上：类型是 `never`。
- 第 4 行：`Conflict` 的 `id` 必须同时是 `string` 和 `number`，也就是 `never`，任何值都赋不进去，报 TS2322。
- 第 5 行：`Impossible[]` 就是 `never[]`，里面放不进任何元素，只有空数组能赋给它。
- 这类错误往往出现在交叉了两个“看起来差不多”的类型时：报错信息里出现 `never`，就要检查是不是交叉的两边有冲突。
:::

## 元组：固定长度、每个位置有自己的类型

**元组**类型 `[string, number]` 表示长度为 2、第一个元素是字符串、第二个元素是数字的数组。它常用来返回多个值，或者表示“键值对”这样位置有固定含义的数据（a11 中 `Object.entries` 的每一项就是 `[string, 值]` 元组）。

和普通数组不同，元组知道每个位置的类型。对一个 `[string, number]` 类型的 `pair` 来说：

- `pair[0]` 的类型是 `string`，**没有** `undefined`（长度是固定的；普通数组按下标读出来的类型会带上 `undefined`，见 a10）；
- 访问不存在的位置 `pair[2]` 会报错；
- 解构时每个变量都有准确的类型。

:::playground{#tuples expect="2322@main.ts:2, 2322@main.ts:2, 2493@main.ts:7"}
```ts file=main.ts
const pair: [string, number] = ['Ada', 36];
const reversed: [string, number] = [36, 'Ada'];

const [name, age] = pair;
console.log(name.toUpperCase(), age + 1);
console.log(pair[0].length);
console.log(pair[2]);

function minMax(values: number[]): [number, number] {
  return [Math.min(...values), Math.max(...values)];
}
const [low, high] = minMax([3, 9, 1]);
console.log(low, high);
```
- 第 2 行：顺序反了，两个位置都报 TS2322。
- 第 4–6 行：`name` 是 `string`，`age` 是 `number`，`pair[0]` 也不需要检查 `undefined`。
- 第 7 行：长度为 2 的元组没有下标 2，报 TS2493。
- 第 9–13 行：`minMax` 用元组一次返回两个值（相当于 Python 的 `return low, high`），调用的地方用解构接住，`low` 和 `high` 都是 `number`。
- 元组的位置可以起名字，方便阅读：`type Range = [min: number, max: number];`。名字只用于提示，不影响使用方式。
:::

## 元组需要写出来，而且最好是只读的

数组字面量**不会**被自动推断成元组：`const x = ['a', 1]` 的类型是 `(string | number)[]`。需要元组时，要写出类型注解（函数返回值的注解就足够，例如上面的 `minMax`）。b16 会讲另一种办法：`as const`。

另外，和 Python 的 `tuple` 不同，TypeScript 的元组只是一种类型，运行时仍然是普通的数组，可以修改：TypeScript 允许在 `[string, number]` 上调用 `push`，这会让实际长度和类型对不上。不打算修改的元组，写成 `readonly [string, number]`（`readonly` 的作用和 a17 的只读数组 `readonly number[]` 一样），`push` 就不能用了。

:::playground{#tuple-pitfalls expect="2339@main.ts:9"}
```ts file=main.ts
const inferred = ['a', 1];
const declared: [string, number] = ['a', 1];

declared.push(2);
console.log(declared, declared.length);
console.log(inferred);

const fixed: readonly [string, number] = ['b', 2];
fixed.push(3);
```
- 把鼠标停在 `inferred` 上：是 `(string | number)[]`，不是元组。
- 第 4 行：没有报错。运行后看第 5 行的输出：`declared` 变成了 3 个元素，而它的类型仍然说长度是 2。
- 第 9 行：只读元组没有 `push`，报 TS2339。
:::

::exercise{#with-meta}

## 编程挑战

::exercise{#parse-range}

::quiz

## 常见错误

- **交叉了有冲突属性的类型**：结果中出现 `never`。
- **以为数组字面量会被推断成元组**：需要写出类型注解。
- **对元组 `push`**：长度和类型对不上。不修改的元组用 `readonly`。
- **用元组表示有很多字段的数据**：超过两三个位置时，对象（有属性名）通常更清楚。

## 下一步

下一课讲四个特殊的类型：`any`、`unknown`、`never` 和 `void`。
