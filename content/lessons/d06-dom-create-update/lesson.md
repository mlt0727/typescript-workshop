---
version: 1
mode: dom
estimatedMinutes: 40
review: self-reviewed
problem: 找到元素之后，下一步是改变页面：显示一段文字、添加一个列表项、切换一个样式、删除一条记录。DOM 提供了很多方法做这些事，它们之间的差别却很重要：innerHTML 会把字符串当作 HTML 解析，用它显示用户输入的内容会造成安全漏洞；设置属性（attribute）和设置 DOM 属性（property）不总是一回事；每次都清空重建整个列表，会丢掉输入框的焦点和内容。这一课讲创建、插入、更新、删除节点的常用方法和它们的类型。
objectives:
  - 区分 textContent 与 innerHTML，用 textContent 显示不可信的文字
  - 用 createElement 创建元素，用 append、before、replaceWith、remove、replaceChildren 改变结构
  - 用 classList、dataset、hidden 和 DOM 属性更新元素，知道 attribute 与 property 的区别
  - 用 template 元素复制重复的结构，并在更新列表时复用已有的节点
references:
  - title: Node.textContent — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent
    checked: 2026-10-20
  - title: Element.innerHTML（Security considerations）— MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML
    checked: 2026-10-20
  - title: Document.createElement() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/Document/createElement
    checked: 2026-10-20
  - title: Element.replaceChildren() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/Element/replaceChildren
    checked: 2026-10-20
  - title: "<template>: The Content Template element — MDN"
    url: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/template
    checked: 2026-10-20
---

## textContent 与 innerHTML

两者都能改变元素的内容，但对字符串的处理完全不同：

- `el.textContent = 字符串`：字符串就是**文字**，`<` `>` 原样显示；
- `el.innerHTML = 字符串`：字符串被当作 **HTML 解析**，`<b>` 会变成一个粗体元素。

所以 `innerHTML` 绝对不能用来显示**用户输入**或者任何来自外部的数据：用户输入 `<img src=x onerror="…">`，浏览器就会创建这个图片元素，并在加载失败时执行其中的代码，这就是 **XSS**（跨站脚本攻击，e12 详讲）。显示文字时一律用 `textContent`。

:::playground{#text-vs-html}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <p>textContent：<span id="safe"></span></p>
    <p>innerHTML：<span id="unsafe"></span></p>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=main.ts
const comment = '<b>好评</b><img src="x" onerror="alert(1)">';

const safe = document.querySelector('#safe');
const unsafe = document.querySelector('#unsafe');
if (!safe || !unsafe) throw new Error('页面结构不完整');

safe.textContent = comment;
unsafe.innerHTML = comment;

console.log('safe 里的元素个数：', safe.children.length);
console.log('unsafe 里的元素：', [...unsafe.children].map((el) => el.tagName));
```
- 第 7 行：整段字符串原样显示为文字。
- 第 8 行：字符串被解析，页面中多出了一个 `<b>` 和一个 `<img>`。本平台的沙箱禁止内联脚本，所以 `onerror` 中的代码没有执行；在没有这层保护的真实网站上，它会执行。
- 读取时也一样：`textContent` 返回纯文字，`innerHTML` 返回 HTML 源代码。
:::

## 创建与插入元素

`document.createElement('li')` 创建一个新元素。和 `querySelector` 一样，传入标签名时 TypeScript 知道它的具体类型：`createElement('li')` 是 `HTMLLIElement`，`createElement('input')` 是 `HTMLInputElement`，不需要任何检查。新元素还不在页面上，要插入之后才会显示。

| 方法 | 作用 |
| --- | --- |
| `parent.append(a, b, …)` | 加到 `parent` 内部的末尾（可以一次加多个，也可以直接传字符串作为文字） |
| `parent.prepend(…)` | 加到内部的开头 |
| `el.before(…)` / `el.after(…)` | 加到 `el` 的前面或后面（作为兄弟节点） |
| `el.replaceWith(…)` | 用新节点替换 `el` |
| `el.remove()` | 把 `el` 从页面上删除 |
| `parent.replaceChildren(…)` | 删除 `parent` 的所有子节点，换成新的（不传参数就是清空） |

一个元素同时只能在一个位置：把**已经在页面上**的元素 `append` 到别处，它会从原来的位置**移动**过去，而不是复制一份。

:::playground{#create}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <ul id="list"><li>已有的一项</li></ul>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=main.ts
const list = document.querySelector('#list');
if (!(list instanceof HTMLUListElement)) throw new Error('缺少 #list');

const first = document.createElement('li');
first.textContent = '新的第一项';
list.prepend(first);

const items = ['苹果', '香蕉'].map((fruit) => {
  const li = document.createElement('li');
  li.textContent = fruit;
  return li;
});
list.append(...items);

list.append(first);
console.log([...list.children].map((li) => li.textContent));
```
- 第 4 行：把鼠标停在 `first` 上，类型是 `HTMLLIElement`。
- 第 13 行：`append` 可以一次插入多个节点，用展开运算符传入数组。
- 第 15 行：`first` 已经在列表开头，再 `append` 一次，它被**移动**到了末尾。
:::

## 更新元素：class、dataset、属性

- **class**：`el.classList.add('done')`、`remove`、`toggle('done', 条件)`、`contains`。比直接改 `el.style` 更好：样式留在 CSS 里，代码只负责切换状态。
- **data-* 属性**：`el.dataset.id = 't1'` 会在 HTML 上写出 `data-id="t1"`（d05 讲过读取）。
- **hidden**：`el.hidden = true` 隐藏元素（等同于 HTML 的 `hidden` 属性）。注意：如果 CSS 给这个元素写了 `display: flex` 之类的规则，它会盖过 `hidden` 的效果，元素仍然显示。
- **DOM 属性与 HTML 属性**：HTML 中写的 `value="Ada"`、`checked` 是**属性**（attribute），表示**初始值**；`input.value`、`input.checked` 是 DOM 对象上的**属性**（property），表示**当前值**。用户输入之后，`input.value` 变了，`getAttribute('value')` 仍然是初始值。读写当前状态时用 DOM 属性；需要初始值时，也有对应的 DOM 属性 `input.defaultValue`、`input.defaultChecked`。`aria-*` 属性多数也有对应的 DOM 属性（例如 `el.ariaPressed`，值同样是字符串），但用 `setAttribute` 更常见；`aria-describedby` 这类引用元素 `id` 的属性只能这样写。

:::playground{#attr-vs-prop}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <label>昵称 <input id="name" value="Ada" /></label>
    <button type="button" id="star" aria-pressed="false">收藏</button>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=main.ts
const input = document.querySelector('#name');
const star = document.querySelector('#star');
if (!(input instanceof HTMLInputElement) || !(star instanceof HTMLButtonElement)) {
  throw new Error('页面结构不完整');
}

input.value = 'Grace';
console.log('当前值（property）：', input.value);
console.log('初始值（attribute）：', input.getAttribute('value'));

star.addEventListener('click', () => {
  const pressed = star.getAttribute('aria-pressed') === 'true';
  star.setAttribute('aria-pressed', String(!pressed));
  star.classList.toggle('active', !pressed);
  console.log('已收藏：', !pressed);
});
```
- 第 7–9 行：改变的是当前值，HTML 属性中的初始值不受影响。表单的“重置”恢复的正是这个初始值（d02）。
- 第 12–14 行：`aria-pressed` 告诉屏幕阅读器这是一个“按下/未按下”的切换按钮。这里用 `getAttribute`/`setAttribute` 读写（也可以用 `star.ariaPressed`），值是字符串 `'true'` 或 `'false'`。
:::

## template：重复的结构

每一项结构比较复杂时，用代码一个个 `createElement` 会很长。`<template>` 元素里的内容不会显示，专门用来被复制：

模板的内容在 `template.content` 中，它是一个 `DocumentFragment`（一个不在页面上的“节点片段”）。`document.importNode(template.content, true)` 深拷贝出一份新的片段，类型仍然是 `DocumentFragment`；在片段里查询、填入数据，再把它插入页面，片段里的节点就被移动到了页面上。

:::playground{#template}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <ul id="cards"></ul>
    <template id="card-template">
      <li class="card"><strong class="title"></strong> <span class="price"></span></li>
    </template>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=main.ts
const list = document.querySelector('#cards');
const template = document.querySelector('#card-template');
if (!(list instanceof HTMLUListElement) || !(template instanceof HTMLTemplateElement)) {
  throw new Error('页面结构不完整');
}

const products = [
  { name: '笔记本', price: 12 },
  { name: '铅笔', price: 3.5 },
];

for (const product of products) {
  const fragment = document.importNode(template.content, true);
  const title = fragment.querySelector('.title');
  const price = fragment.querySelector('.price');
  if (title) title.textContent = product.name;
  if (price) price.textContent = `${product.price} 元`;
  list.append(fragment);
}

console.log('卡片数量：', list.children.length);
```
- 第 13 行：把鼠标停在 `fragment` 上，类型是 `DocumentFragment`。每次循环都复制一份新的，模板本身不变。
- 第 18 行：插入片段时，插入的是它里面的节点，片段本身变空。
- 另一种写法是 `template.content.firstElementChild?.cloneNode(true)`，但 `cloneNode` 的返回类型是笼统的 `Node`，还要再用 `instanceof` 收窄。d08 的小任务会用到模板。
:::

## 重建还是复用

数据变化后更新列表，最简单的办法是 `list.replaceChildren(...新的元素)`：全部删掉，重新创建。数据量不大时这完全可以。但它有代价：原来的元素都被丢弃，元素上的状态也随之丢失——文本框里正在输入的内容、键盘焦点、滚动位置、正在进行的 CSS 过渡。

另一种做法是给每个元素记下数据的 id（例如 `data-id`），更新时**复用**还在的元素、只修改变化的部分，删除不再需要的、创建新增的。React 之类的框架内部就是这样做的（G 阶段的 `key`）。

复用时还要注意焦点：把一个获得焦点的元素从页面上移走，哪怕马上又插回来，它也会失去焦点。所以调整顺序时，只移动位置不对的元素，不要把所有元素重新插入一遍。（较新的浏览器提供了 `moveBefore()` 方法，可以在移动的同时保留焦点等状态，但它还不是所有浏览器都支持。）

::exercise{#render-todos}

## 编程挑战

::exercise{#sync-list}

::quiz

## 常见错误

- **用 `innerHTML` 显示用户输入**：XSS 漏洞。用 `textContent`。
- **以为 `append` 会复制节点**：已经在页面上的节点会被移动。
- **重新渲染前忘了清空**：列表越来越长。用 `replaceChildren`。
- **用 `getAttribute('value')` 读取用户输入**：它是初始值，当前值在 `input.value`。
- **直接改 `el.style`**：样式散落在代码里。优先切换 class。

## 下一步

下一课（d07）讲事件监听：事件对象的类型、`target` 与 `currentTarget`、移除监听器；之后的 d08 讲事件冒泡、事件委托和阻止默认行为。
