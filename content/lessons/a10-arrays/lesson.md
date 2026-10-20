---
version: 1
mode: ts
estimatedMinutes: 35
review: ai-draft
problem: JavaScript 的数组像 Python 的 list 或 Java 的 ArrayList：长度可变，随时增删。但读取不存在的下标时，它既不抛 IndexError 也不抛越界异常，只是安静地返回 undefined。本平台开启的 noUncheckedIndexedAccess 会把这个风险写进类型里。
objectives:
  - 创建数组并写出数组类型 T[]，知道空数组需要类型注解
  - 使用 push、pop、includes、indexOf、slice、splice、join 等常用方法
  - 知道越界读取返回 undefined，理解 noUncheckedIndexedAccess 下 arr[i] 的类型是 T | undefined
  - 区分不修改原数组的方法（slice）和修改原数组的方法（push、pop、splice）
references:
  - title: Array — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array
    checked: 2026-10-20
  - title: Array.prototype.slice() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/slice
    checked: 2026-10-20
  - title: Array.prototype.splice() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice
    checked: 2026-10-20
  - title: Everyday Types（Arrays）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
    checked: 2026-10-20
  - title: noUncheckedIndexedAccess — TSConfig Reference
    url: https://www.typescriptlang.org/tsconfig/#noUncheckedIndexedAccess
    checked: 2026-10-20
---

## 创建数组与常用方法

数组字面量用方括号。数组类型写作 `元素类型[]`，例如 `number[]`、`string[]`（也可以写成 `Array<number>`，效果相同）。有初始元素时 TypeScript 会推断类型；**空数组没有元素可供推断，要写上注解**。

:::playground{#basics expect="2345@main.ts:10"}
```ts file=main.ts
const scores = [90, 72, 85];
scores.push(60);
console.log(scores.length, scores);

console.log(scores.includes(72), scores.indexOf(85), scores.indexOf(100));
console.log(scores.join(' / '));

const tags: string[] = [];
tags.push('ts');
tags.push(42);
```
- 第 1 行：`scores` 推断为 `number[]`。它是 `const`，但仍然可以 `push`：`const` 只禁止重新赋值（a03）。
- 第 5 行：`indexOf` 找不到时返回 `-1`。只需要判断“有没有”时，`includes` 更直接。
- 第 10 行：`tags` 是 `string[]`，放入数字报 TS2345。
:::

## 越界读取：undefined，而不是异常

读取不存在的下标时，JavaScript 返回 `undefined`，不会抛出异常。TypeScript 默认假设下标访问总能取到值，但这并不安全，所以本平台开启了 **`noUncheckedIndexedAccess`**：`names[0]` 的类型是 `string | undefined`，使用前要检查。

:::playground{#out-of-bounds expect="18048@main.ts:5"}
```ts file=main.ts
const names = ['Ada', 'Grace'];
console.log(names[5]);

const first = names[0];
console.log(first.toUpperCase());

const second = names[1];
if (second !== undefined) {
  console.log(second.toUpperCase());
}

for (const name of names) {
  console.log(name.length);
}

console.log(names.at(-1));
```
- 第 2 行：输出 `undefined`。Python 会抛 `IndexError`，Java 会抛 `ArrayIndexOutOfBoundsException`。
- 第 5 行报 TS18048：即使你知道 `names[0]` 存在，TypeScript 也无法确定（数组长度只在运行时才知道）。第 7–10 行是正确的写法：先检查。
- 第 12–14 行：`for...of` 里的 `name` 类型是 `string`，没有 `undefined`——遍历只会取到真实存在的元素。**能用 `for...of` 时就不要用下标**。
- 第 16 行：`at(-1)` 取最后一个元素，类型同样是 `string | undefined`。
:::

往超出长度的下标写入，数组会自动变长，中间留下“空位”（empty slots）。这几乎总是 bug，用 `push` 添加元素即可。

## 修改原数组，还是返回新数组

数组方法分成两类，这个区别会在 a17 再次出现：

- **修改原数组**：`push`（末尾添加）、`pop`（移除并返回末尾元素）、`unshift`/`shift`（开头添加/移除）、`splice`（在任意位置删除或插入）。
- **不修改原数组，返回新数组**：`slice`（复制一段）、`concat`（拼接），以及 a16 会讲的 `map`、`filter`。

:::playground{#slice-splice}
```ts file=main.ts
const letters = ['a', 'b', 'c', 'd', 'e'];

const part = letters.slice(1, 3);
console.log(part, letters);

const removed = letters.splice(1, 2);
console.log(removed, letters);

const last = letters.pop();
console.log(last, letters);
```
- `slice(开始, 结束)` 和字符串的 `slice` 一样，不包含结束位置；原数组不变。
- `splice(开始, 删除个数)` 从原数组里**删除**元素并返回被删除的部分。`slice` 和 `splice` 只差一个字母，作用完全不同。
- `pop()` 的返回类型是 `string | undefined`：空数组 `pop` 得到 `undefined`。
:::

::exercise{#max-score}

## 编程挑战

::exercise{#chunk}

::quiz

## 常见错误

- **以为越界会抛异常**：`arr[100]` 只会得到 `undefined`。
- **用 `!` 消除 `T | undefined`**：`scores[0]!` 在空数组上仍然是 `undefined`。先检查长度或元素。
- **该用 `for...of` 时用下标循环**：下标访问会带来 `undefined` 检查，`for...of` 不会。
- **混淆 `slice` 与 `splice`**：`splice` 会修改原数组。
- **空数组不写类型**：写成 `const list: string[] = [];`。

## 下一步

下一课讲对象与引用：为什么把数组或对象赋给另一个变量后，修改其中一个会影响另一个，以及如何做浅拷贝。
