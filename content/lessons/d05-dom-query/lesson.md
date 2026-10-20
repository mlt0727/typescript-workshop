---
version: 1
mode: dom
estimatedMinutes: 40
review: ai-draft
problem: 用 TypeScript 操作网页，第一步总是“找到元素”。浏览器根据 HTML 建立了一棵 DOM 树，querySelector 之类的方法在树中查找元素。TypeScript 在这里非常严格：它不知道页面上有什么，所以查询结果可能是 null，类型也往往只是笼统的 Element。初学者最常见的做法是用 as 或者感叹号让报错消失，结果把错误推迟到了运行时。这一课讲查询方法的返回类型，以及用检查而不是断言得到具体元素类型的写法。
objectives:
  - 用 querySelector、querySelectorAll、getElementById 查询元素，读懂它们的返回类型
  - 处理查询结果为 null 的情况，在元素缺失时给出清楚的错误
  - 用 instanceof 把 Element 收窄成 HTMLInputElement 等具体类型，知道为什么不用 as 和泛型参数
  - 在某个元素内部查询，用 closest 向上查找，用 dataset 读取 data-* 属性
references:
  - title: Document.querySelector() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector
    checked: 2026-10-20
  - title: Document.querySelectorAll() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelectorAll
    checked: 2026-10-20
  - title: Element.closest() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/Element/closest
    checked: 2026-10-20
  - title: HTMLElement.dataset — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dataset
    checked: 2026-10-20
  - title: DOM Manipulation — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/dom-manipulation.html
    checked: 2026-10-20
---

## 查询元素与返回类型

| 方法 | 用途 | 返回类型 |
| --- | --- | --- |
| `document.querySelector(选择器)` | 第一个匹配 CSS 选择器的元素 | 见下文，可能为 `null` |
| `document.querySelectorAll(选择器)` | 所有匹配的元素 | `NodeListOf<…>`，可能为空 |
| `document.getElementById(id)` | 指定 id 的元素（不加 `#`） | `HTMLElement \| null` |

`querySelector` 的返回类型取决于你传入的字符串：

- 如果正好是一个**标签名**，例如 `'input'`、`'button'`，TypeScript 能查到对应的类型：`HTMLInputElement | null`；
- 其他选择器，例如 `'#name'`、`'input.name'`、`'.card button'`，TypeScript 无法从字符串推断出元素类型，结果是笼统的 `Element | null`。

无论哪种，结果都**可能是 `null`**：选择器写错了、元素还没有创建、或者被删除了。TypeScript 不知道页面上有什么，所以要求你处理这种情况。

:::playground{#query-types}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <h1 id="title">设置</h1>
    <label for="name">昵称</label>
    <input id="name" value="Ada" />
    <ul>
      <li>一</li>
      <li>二</li>
    </ul>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=main.ts
const byTag = document.querySelector('input');
const bySelector = document.querySelector('#name');
const byId = document.getElementById('name');
const items = document.querySelectorAll('li');

console.log(byTag?.value, bySelector?.tagName, byId?.id, items.length);

const missing = document.querySelector('#nmae');
console.log('拼错的选择器：', missing);
```
- 依次把鼠标停在第 1–4 行的变量上：`HTMLInputElement | null`、`Element | null`、`HTMLElement | null`、`NodeListOf<HTMLLIElement>`。
- 第 2 行和第 1 行找到的是同一个元素，但 TypeScript 只知道它是 `Element`，在它上面读 `.value` 会报错。
- 第 8 行的选择器拼错了，结果是 `null`。不处理它，后面访问属性时就会在运行时抛出 `TypeError`。
:::

## 处理 null，收窄类型

推荐的写法是：查询之后**立刻检查**，用 `instanceof` 同时排除 `null` 和“类型不对”两种情况（b07 讲过 `instanceof` 收窄）。检查失败时抛出一个说清楚原因的错误，比几行之后一个莫名其妙的 `Cannot read properties of null` 好排查得多。

```ts
const input = document.querySelector('#name');
if (!(input instanceof HTMLInputElement)) {
  throw new Error('找不到昵称输入框 #name');
}
input.value; // 这里 input 已经是 HTMLInputElement
```

为什么不用下面两种更短的写法？

- `document.querySelector('#name') as HTMLInputElement`，或者 `document.querySelector<HTMLInputElement>('#name')`：这两种写法都是**类型断言**（b16），TypeScript 照单全收，不做任何检查。如果 `#name` 其实是一个 `<div>`，或者根本不存在，错误要到运行时才出现。本课程的判题规则把它们都当作断言拒绝。
- `document.querySelector('#name')!`：非空断言，同样只是让编译器闭嘴。

:::playground{#assertion-danger run=error}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <h1 id="title">设置</h1>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=main.ts
const checked = document.querySelector('#title');
if (checked instanceof HTMLInputElement) {
  console.log('输入框的值：', checked.value);
} else {
  console.log('#title 不是输入框，而是', checked?.tagName);
}

const asserted = document.querySelector<HTMLInputElement>('#title');
console.log('断言之后 TypeScript 认为它有 value：', asserted?.value);

const forced = document.querySelector('#subtitle')!;
console.log(forced.textContent);
```
- 第 1–6 行：检查发现 `#title` 是 `<h1>`，程序可以做出合理的处理。
- 第 8 行：泛型参数让 TypeScript 相信 `#title` 是输入框，没有任何报错；实际读到的 `value` 是 `undefined`，错误被悄悄地带到了后面。
- 第 11 行：`#subtitle` 不存在，`!` 让编译器放行，第 12 行在运行时抛出 `TypeError`。
:::

有些元素本来就是可选的（例如只在某些页面上出现的提示条），这时用可选链 `?.`（a08）比抛出错误更合适：`document.querySelector('.banner')?.remove()`。

## querySelectorAll

`querySelectorAll` 返回一个 `NodeList`：

- 它是**静态**的：查询之后再添加的元素不会出现在里面；
- 它不是数组，但可以用 `for...of` 遍历，也有 `forEach` 和 `length`；需要 `map`、`filter` 时，先用 `[...list]` 或 `Array.from(list)` 转成数组；
- 和 `querySelector` 一样，只有选择器正好是标签名时，元素类型才是具体的，否则是 `NodeListOf<Element>`，每个元素都要单独收窄。

## 在局部查询：元素上的方法

`querySelector` 和 `querySelectorAll` 也是每个元素的方法：`card.querySelector('button')` 只在 `card` 内部查找。另外两个常用的方法：

- `element.closest(选择器)`：从元素本身开始**向上**找第一个匹配的祖先，找不到时返回 `null`。处理点击时常用来找“被点中的按钮所在的卡片”（d08 的事件委托会大量使用）；
- `element.matches(选择器)`：元素是否匹配选择器，返回布尔值。

HTML 中 `data-` 开头的自定义属性可以通过 `dataset` 读取：`data-price="12"` 对应 `element.dataset.price`，`data-product-id` 对应 `dataset.productId`（连字符变成驼峰）。值的类型是 `string | undefined`：属性可能不存在，存在时也总是字符串，需要数字时要自己转换并检查。

:::playground{#scoped}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <ul id="products">
      <li class="product" data-product-id="p1" data-price="12">
        <span class="name">笔记本</span> <button type="button">加入购物车</button>
      </li>
      <li class="product" data-product-id="p2" data-price="3.5">
        <span class="name">铅笔</span> <button type="button">加入购物车</button>
      </li>
      <li class="product" data-product-id="p3">
        <span class="name">橡皮</span> <button type="button">加入购物车</button>
      </li>
    </ul>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=main.ts
for (const item of document.querySelectorAll('.product')) {
  if (!(item instanceof HTMLElement)) continue;
  const name = item.querySelector('.name')?.textContent ?? '（无名）';
  const price = Number(item.dataset.price);
  console.log(item.dataset.productId, name, Number.isNaN(price) ? '没有价格' : `${price} 元`);
}

const button = document.querySelector('button');
const card = button?.closest('.product');
console.log('第一个按钮所在的商品：', card instanceof HTMLElement ? card.dataset.productId : '找不到');
```
- 第 1 行：选择器不是标签名，每个元素都是 `Element`；第 2 行收窄成 `HTMLElement` 之后才能用 `dataset`。
- 第 3 行：只在当前商品内部查找名称。
- 第 4 行：`dataset.price` 是 `string | undefined`。第三个商品没有 `data-price`，`Number(undefined)` 得到 `NaN`。
- 第 9 行：`closest` 从按钮向上，找到了它所在的 `.product`。
:::

::exercise{#read-settings}

## 编程挑战

::exercise{#typed-query}

::quiz

## 常见错误

- **`document.querySelector('#x') as HTMLInputElement`**：断言不检查，元素不存在或类型不对时，错误被推迟到运行时。用 `instanceof`。
- **`querySelector(...)!`**：同样只是让编译器闭嘴。
- **忘了 `getElementById` 不加 `#`**：`getElementById('#name')` 找的是 id 为“#name”的元素。
- **把 `NodeList` 当数组用**：它没有 `map`、`filter`，先转换成数组。
- **把 `dataset` 的值当数字用**：它总是字符串（或 `undefined`），要转换并检查。

## 下一步

下一课讲创建和更新节点：`textContent` 与 `innerHTML` 的区别、`createElement`、`append`、`classList`，以及如何安全地显示用户输入。
