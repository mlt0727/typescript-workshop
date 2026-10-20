---
version: 1
mode: ts
estimatedMinutes: 35
review: self-reviewed
problem: TypeScript 里有四个特殊的类型，前面已经零星遇到过：JSON.parse 返回的 any、catch 到的 unknown、交叉冲突得到的 never、没有返回值的函数的 void。它们分别代表“不检查”“不知道”“不可能”和“不关心返回值”。分清它们，尤其是 any 和 unknown 的区别，是写出安全代码的关键。
objectives:
  - 知道 any 会关闭类型检查并向外传染，理解本课程为什么禁止显式 any
  - 用 unknown 表示“还不知道是什么”的值，先收窄再使用
  - 理解 never 表示不可能存在的值，用于永不返回的函数和穷尽检查
  - 理解 void 表示不使用返回值，知道函数类型中的 void 和声明的返回类型 void 有区别
references:
  - title: Everyday Types（any）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
    checked: 2026-10-20
  - title: More on Functions（void、unknown、never）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/functions.html
    checked: 2026-10-20
  - title: Narrowing（The never type、Exhaustiveness checking）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
    checked: 2026-10-20
---

## any：关闭检查

`any` 表示“不检查”：对 `any` 类型的值做任何操作都不会报错，它也可以赋给任何类型（`never` 除外）的变量。更麻烦的是它会**传染**：从 `any` 上读出的属性、调用的结果，也都是 `any`。

`any` 最常见的来源不是你自己写的，而是 `JSON.parse`、一些老的库，以及没有类型的参数（严格模式下会报 TS7006 提醒你）。本课程的练习禁止显式写 `any`。

:::playground{#any run=error}
```ts file=main.ts
const data = JSON.parse('{ "user": null }');
const city = data.user.address.city;
const total: number = data.price;

console.log(total);
console.log(city);
```
- 把鼠标停在 `data` 和 `city` 上：都是 `any`。第 2 行明显有问题（`user` 是 `null`），TypeScript 却一声不吭。
- 第 3 行：`any` 可以赋给 `number`，`total` 的类型说是数字，实际是 `undefined`。
- 运行一下：程序在第 2 行就抛出了 `TypeError`。`any` 把错误从编译期推迟到了运行期。
:::

## unknown：安全的“不知道”

`unknown` 也能接收任何值，但它要求你**在使用前先检查**：不能读属性、不能调用、不能赋给其他类型（除了 `unknown` 和 `any`），直到你用 `typeof`、`instanceof`、`=== null` 等把它收窄。

a20 中 `catch (err)` 的 `err` 就是 `unknown`。自己写函数时，“来自外部、还没检查过”的数据，也应该用 `unknown` 而不是 `any`。

要读取 `unknown` 值的属性，要先证明它是对象、并且有这个属性：`typeof x === 'object' && x !== null && 'name' in x` 之后，`x.name` 可以读取，类型仍是 `unknown`，需要再检查（b07 详讲 `in`）。

:::playground{#unknown expect="18046@main.ts:3, 2322@main.ts:4"}
```ts file=main.ts
const raw: unknown = JSON.parse('"hello"');

raw.toUpperCase();
const text: string = raw;

if (typeof raw === 'string') {
  console.log(raw.toUpperCase());
}

function parseJson(text: string): unknown {
  return JSON.parse(text);
}
const value = parseJson('[1, 2, 3]');
if (Array.isArray(value)) {
  console.log(value.length);
}
```
- 第 1 行：把 `JSON.parse` 的结果放进 `unknown` 变量，就把 `any` “关”住了。
- 第 3、4 行：没有检查就使用，分别报 TS18046 和 TS2322。
- 第 6 行检查之后，分支里的 `raw` 是 `string`。
- 第 10 行：函数返回 `unknown`，强迫调用方检查。E 阶段会介绍按形状校验数据的工具。
:::

**简单的规则**：不知道类型时用 `unknown`，而不是 `any`。`any` 说“相信我，不用检查”，`unknown` 说“先检查，再使用”。

## never：不可能的值

`never` 是没有任何值的类型。它出现在几种地方：

- **永远不会正常返回的函数**：总是抛出错误，或者是无限循环。返回类型要明确写成 `never`：用 `function` 声明的函数即使总是抛出错误，TypeScript 推断出的返回类型也是 `void`。
- **不可能的交叉**：b05 的 `string & number`。
- **所有情况都被排除之后**：把联合类型的每个成员都检查过之后，剩下的类型就是 `never`。利用这一点可以做**穷尽检查**（b09 详讲）。

:::playground{#never}
```ts file=main.ts
function fail(message: string): never {
  throw new Error(message);
}

type Shape = 'circle' | 'square';

function sides(shape: Shape): number {
  switch (shape) {
    case 'circle':
      return 0;
    case 'square':
      return 4;
    default: {
      const unreachable: never = shape;
      return fail(`未知的形状：${unreachable}`);
    }
  }
}

console.log(sides('circle'), sides('square'));
```
- 第 13–16 行：两种形状都处理过了，`default` 分支里 `shape` 的类型是 `never`，所以可以赋给 `never` 类型的变量。
- 试着给 `Shape` 加一个 `'triangle'`：第 14 行立刻报错，因为 `'triangle'` 不能赋给 `never`。TypeScript 由此提醒你：新加的情况还没有处理。
:::

## void：不关心返回值

`void` 用在返回类型上，表示“这个函数不返回有用的值”。声明为 `void` 的函数如果 `return` 了一个值，会报错。

但在**函数类型**里，`void` 的含义更宽松：`() => void` 表示“调用方不会使用返回值”，所以返回了值的函数也可以赋给它。这是为了让 `forEach(…)` 这类回调可以直接写成 `(x) => list.push(x)`（`push` 返回新长度，但没人关心）。

:::playground{#void expect="2322@main.ts:6"}
```ts file=main.ts
function log(message: string): void {
  console.log(message);
}

function bad(): void {
  return 42;
}

const callback: () => void = () => 42;
const result = callback();

const copied: number[] = [];
[1, 2, 3].forEach((n) => copied.push(n));
console.log(result, copied);
log('完成');
```
- 第 6 行：声明返回 `void` 的函数返回了数字，报 TS2322。
- 第 9 行：同样的值赋给函数类型 `() => void` 却没有报错。第 10 行的 `result` 类型是 `void`，运行时其实是 `42`——所以不要使用 `void` 函数的返回值。
- 第 13 行：`push` 有返回值，但 `forEach` 的回调类型是 `void`，没有问题。
:::

::exercise{#unknown-config}

## 编程挑战

::exercise{#assert-never}

::quiz

## 常见错误

- **用 `any` 让错误消失**：错误只是被推迟到了运行时。用 `unknown` 并收窄。
- **在 `unknown` 上直接使用属性**：先检查类型。
- **使用 `void` 函数的返回值**：类型是 `void`，实际值可能是任何东西。
- **忘了处理新增的联合成员**：用 `never` 做穷尽检查，让编译器提醒你。

## 下一步

下一课系统地讲类型收窄：`typeof`、`instanceof`、`in`、相等检查和真假检查分别能把类型收窄成什么。
