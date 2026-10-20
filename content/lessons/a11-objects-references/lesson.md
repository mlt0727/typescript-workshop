---
version: 1
mode: ts
estimatedMinutes: 35
review: ai-draft
problem: 把一个对象赋给另一个变量、传给一个函数，都不会复制它。两个名字指向同一个对象，从任何一边修改，另一边都会“看到”。这和 Java、Python 的对象引用一样；不同的是，JavaScript 里复制对象的写法很多，而最常用的那种只复制一层。
objectives:
  - 创建对象、读写属性，知道 TypeScript 会固定对象的形状
  - 理解变量和参数保存的是引用，修改会影响所有指向同一对象的名字
  - 用 { ...obj } 和 [...arr] 做浅拷贝，知道嵌套的对象仍然共享
  - 用 structuredClone 做深拷贝；用 Object.keys / values / entries 遍历对象
references:
  - title: Working with objects — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Working_with_objects
    checked: 2026-10-20
  - title: Shallow copy — MDN Glossary
    url: https://developer.mozilla.org/en-US/docs/Glossary/Shallow_copy
    checked: 2026-10-20
  - title: structuredClone() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone
    checked: 2026-10-20
  - title: Object.entries() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries
    checked: 2026-10-20
  - title: Object Types — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/objects.html
    checked: 2026-10-20
---

## 对象字面量

对象字面量 `{ 键: 值 }` 直接创建一个对象，不需要先定义类（和 Python 的 dict 字面量写法相似，但用途更像 Java 里只有字段的对象）。用 `.` 或 `['键']` 读写属性。

TypeScript 会根据字面量推断对象的**形状**：有哪些属性、各是什么类型。之后就不能随意添加新属性了：

:::playground{#object-basics expect="2339@main.ts:4"}
```ts file=main.ts
const book = { title: '三体', pages: 302 };
console.log(book.title, book['pages']);
book.pages = 310;
book.author = '刘慈欣';
console.log(book);
```
- 把鼠标停在 `book` 上：类型是 `{ title: string; pages: number; }`。
- 第 3 行：修改已有属性没有问题（`const` 只禁止重新赋值）。
- 第 4 行：`author` 不在推断出的形状里，报 TS2339。JavaScript 本身允许随时添加属性（运行一下，输出里有 `author`），但 TypeScript 认为这多半是拼写错误或设计问题。需要的属性应该在创建时就写上，或者在类型里声明为可选属性（B 阶段讲）。
:::

对象也不是 Python 的 dict：用任意字符串变量作键去读取 `book[key]` 时，TypeScript 会报错（TS7053），因为它无法确定这个键存在。键事先不知道的“字典”，要用 a18 的 `Map`。

## 变量保存的是引用

对象（包括数组）赋值给另一个变量、作为参数传给函数时，**复制的是引用，不是对象本身**。和 Java、Python 一样：

:::playground{#references}
```ts file=main.ts
const original = { name: 'Ada', tags: ['math'] };
const alias = original;
alias.name = 'Grace';
console.log(original.name);

function rename(person: { name: string }) {
  person.name = '改过了';
}
rename(original);
console.log(original.name);
```
- 第 2 行没有创建新对象，`alias` 和 `original` 指向同一个对象，所以第 4 行输出 `Grace`。
- 第 6 行的参数类型 `{ name: string }` 是直接写出的对象类型（B 阶段会讲如何给它起名字）。函数修改了参数的属性，调用方的对象也变了，第 10 行输出 `改过了`。
- 字符串、数字等基本类型的值本来就不可变，不存在这个问题。
:::

## 浅拷贝：只复制一层

需要一个可以独立修改的副本时，最常用的写法是**展开语法**：`{ ...obj }` 复制对象，`[...arr]` 复制数组（下一课会讲它的更多用法）。它们都是**浅拷贝**：只复制最外面一层，嵌套的对象和数组仍然是共享的。

需要连嵌套内容一起复制（**深拷贝**）时，用 `structuredClone(obj)`。它是浏览器和 Node.js 都提供的全局函数，可以复制普通对象、数组、`Date`、`Map` 等，但不能复制函数。

:::playground{#shallow-copy}
```ts file=main.ts
const original = { name: 'Ada', tags: ['math'] };

const copy = { ...original };
copy.name = 'Grace';
copy.tags.push('poetry');
console.log(original);
console.log(copy);

const deep = structuredClone(original);
deep.tags.push('engine');
console.log(original.tags, deep.tags);
```
- 第 4 行修改的是副本自己的 `name`，`original.name` 仍然是 `Ada`。
- 第 5 行：`copy.tags` 和 `original.tags` 是**同一个数组**，所以 `original` 也多了 `'poetry'`。
- 第 10 行：深拷贝的 `deep.tags` 是一个新数组，修改它不影响 `original`。
:::

## 遍历对象的属性

`Object.keys(obj)`、`Object.values(obj)`、`Object.entries(obj)` 分别返回属性名数组、属性值数组和 `[键, 值]` 数组：

:::playground{#entries}
```ts file=main.ts
const stock = { apple: 3, banana: 0, cherry: 12 };

console.log(Object.keys(stock));
console.log(Object.values(stock));

for (const [fruit, count] of Object.entries(stock)) {
  console.log(`${fruit}: ${count}`);
}
```
- 第 6 行的 `const [fruit, count]` 把每一项 `[键, 值]` 拆成两个变量，类似 Python 的 `for k, v in d.items()`。这种写法叫**解构**，下一课详讲。
- `Object.keys` 的返回类型是 `string[]`，不是 `('apple' | 'banana' | 'cherry')[]`。原因与 TypeScript 的结构化类型有关，B 阶段会解释。
:::

::exercise{#with-nickname}

## 编程挑战

::exercise{#add-tag}

::quiz

## 常见错误

- **以为赋值会复制对象**：`const b = a` 之后，`a` 和 `b` 是同一个对象。
- **在函数里修改传入的对象**：调用方的数据会被意外改变。需要修改时，返回一个新对象。
- **以为 `{ ...obj }` 是深拷贝**：嵌套的数组和对象仍然共享。
- **把对象当字典用**：用任意字符串作键会报 TS7053，键不固定时用 `Map`。

## 下一步

下一课讲解构与展开：从对象和数组中取出值的简洁写法，以及用展开语法合并、复制数据。
