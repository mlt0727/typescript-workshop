---
version: 1
mode: ts
estimatedMinutes: 35
review: self-reviewed
problem: 现代 JavaScript 代码里到处是 const { name } = user、[...list, item]、{ ...defaults, ...options } 这样的写法。它们让取值和组合数据变得很短，但默认值什么时候生效、展开时谁覆盖谁、undefined 会不会覆盖默认值，这些细节决定了代码是否正确。
objectives:
  - 用对象解构和数组解构取出值，会重命名、设置默认值和使用剩余元素
  - 知道解构默认值只在值为 undefined 时生效，null 不会触发默认值
  - 在函数参数中使用解构，认识可选属性 ?
  - 用展开语法合并数组和对象，知道后面的属性覆盖前面的，undefined 也会覆盖
references:
  - title: Destructuring — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring
    checked: 2026-10-20
  - title: Spread syntax (...) — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax
    checked: 2026-10-20
  - title: Object Types（Optional Properties）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/objects.html
    checked: 2026-10-20
  - title: exactOptionalPropertyTypes — TSConfig Reference
    url: https://www.typescriptlang.org/tsconfig/#exactOptionalPropertyTypes
    checked: 2026-10-20
---

## 对象解构

对象解构按**属性名**取值：`const { name, age } = user` 等价于分别写 `const name = user.name` 和 `const age = user.age`。

- `{ name: userName }`：取出 `name`，放进名为 `userName` 的变量（重命名）。
- `{ role = 'guest' }`：属性值是 `undefined` 时使用默认值。
- `{ id, ...rest }`：取出 `id`，其余属性组成一个新对象 `rest`。

:::playground{#object-destructuring}
```ts file=main.ts
const user = { name: 'Ada', born: 1815, city: null, role: undefined };

const { name, born } = user;
console.log(name, born);

const { name: userName } = user;
console.log(userName);

const { city = '未知', role = 'guest' } = user;
console.log(city, role);

const { born: year, ...others } = user;
console.log(year, others);
```
- 第 9 行：`role` 的值是 `undefined`，默认值生效，得到 `'guest'`；`city` 的值是 `null`，**默认值不生效**，仍然是 `null`。默认值只认 `undefined`。
- 第 12 行：`others` 是一个新对象，包含除 `born` 之外的属性。
:::

## 数组解构

数组解构按**位置**取值，和 Python 的 `a, b = items` 相似。不同的是，Python 要求个数一致，否则抛出 `ValueError`；JavaScript 多出来的元素被忽略，不够的位置得到 `undefined`，不会报错：

:::playground{#array-destructuring}
```ts file=main.ts
const names = ['Ada', 'Grace', 'Linus'];

const [first, second] = names;
console.log(first, second);

const [, , third] = names;
console.log(third);

const [head, ...tail] = names;
console.log(head, tail);

let a = 1;
let b = 2;
[a, b] = [b, a];
console.log(a, b);
```
- 把鼠标停在 `first` 上：类型是 `string | undefined`。和 `names[0]` 一样，数组可能没有那么多元素（a10 的 `noUncheckedIndexedAccess`）。
- 第 6 行：用逗号跳过不需要的位置。
- 第 9 行：`tail` 是剩余元素组成的新数组 `['Grace', 'Linus']`。
- 第 14 行：交换两个变量，不需要临时变量。
:::

## 在参数中解构，以及可选属性

函数参数是对象时，可以直接在参数位置解构。类型注解写在整个解构模式后面。

属性名后面加 `?` 表示**可选属性**：调用时可以不提供，它的类型自动包含 `undefined`。这和解构默认值是天然的搭配（可选属性在 B 阶段详讲）：

:::playground{#parameter-destructuring}
```ts file=main.ts
function greet({ name, title = '同学' }: { name: string; title?: string }): string {
  return `${name}${title}，你好`;
}

console.log(greet({ name: '张三' }));
console.log(greet({ name: '李四', title: '老师' }));
console.log(greet({ name: '王五', title: undefined }));
```
- 第 1 行：`title?: string` 表示可以不传 `title`；没传或传了 `undefined` 时，解构默认值 `'同学'` 生效。
- 这种“选项对象”的写法比一长串位置参数更清楚，调用处能看出每个值的含义。
:::

## 展开：合并数组与对象

上一课用 `{ ...obj }` 和 `[...arr]` 做浅拷贝。展开语法还能合并：

- `[...a, ...b, 4]`：按顺序拼接。
- `{ ...defaults, ...options }`：合并对象，**后面的同名属性覆盖前面的**。
- `Math.max(...numbers)`：把数组展开成函数的多个参数。

:::playground{#spread expect="2783@main.ts:7"}
```ts file=main.ts
const a = [1, 2];
const b = [3];
console.log([...a, ...b, 4], Math.max(...a, ...b));

const defaults = { theme: 'light', fontSize: 14 };
console.log({ ...defaults, fontSize: 18 });
console.log({ fontSize: 18, ...defaults });

function withOptions(options: { theme?: string; fontSize?: number }) {
  return { ...defaults, ...options };
}
const result = withOptions({ theme: undefined });
console.log(result);
```
- 第 6–7 行：顺序决定结果。`fontSize: 18` 写在后面才能覆盖默认值。第 7 行的 `fontSize: 18` 一定会被 `defaults` 里的同名属性覆盖，TypeScript 报 TS2783 提醒你这个值没有意义。
- 第 12–13 行：**`undefined` 也会覆盖**。`options` 里明确写了 `theme: undefined`，合并结果的 `theme` 变成了 `undefined`。
- 把鼠标停在 `result` 上：TypeScript 认为 `theme` 是 `string`，和运行结果不符。这是 TypeScript 为了方便做出的让步：默认情况下它不区分“没有这个属性”和“属性值是 `undefined`”。开启更严格的 `exactOptionalPropertyTypes` 选项可以禁止显式传入 `undefined`，但本平台和大多数项目没有开启。合并来自外部的选项时，要自己处理 `undefined`。
:::

::exercise{#page-query}

## 编程挑战

::exercise{#merge-options}

::quiz

## 常见错误

- **以为默认值对 `null` 也生效**：解构默认值只在 `undefined` 时生效。
- **展开顺序写反**：`{ ...options, ...defaults }` 会让默认值覆盖用户的选择。
- **以为 `undefined` 不会覆盖**：`{ ...defaults, ...{ theme: undefined } }` 的 `theme` 是 `undefined`。
- **忘了数组解构可能取到 `undefined`**：`const [first] = list` 的 `first` 类型包含 `undefined`。

## 下一步

下一课讲函数：普通函数与箭头函数、参数默认值与剩余参数、返回类型。
