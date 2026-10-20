---
version: 1
mode: dom
representative: true
estimatedMinutes: 35
review: ai-draft
problem: 网页要响应点击、输入、按键等用户操作。你需要知道监听器拿到的事件对象是什么类型，分清“被点中的元素”和“挂监听器的元素”，并在不再需要时移除监听器。
objectives:
  - 用 addEventListener 监听事件，读懂 TypeScript 为事件对象推断的类型（MouseEvent、KeyboardEvent 等）
  - 区分 event.target（事件发生的元素）与 event.currentTarget（监听器所在的元素）
  - 不用断言，用 instanceof 把 EventTarget 收窄成具体的元素类型
  - 用 once、AbortController 的 signal 或 removeEventListener 移除监听器
references:
  - title: EventTarget.addEventListener() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
    checked: 2026-10-20
  - title: Event.currentTarget — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/Event/currentTarget
    checked: 2026-10-20
  - title: Event.target — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/Event/target
    checked: 2026-10-20
  - title: Introduction to events — MDN Learn web development
    url: https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Events
    checked: 2026-10-20
  - title: DOM Manipulation — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/dom-manipulation.html
    checked: 2026-10-20
---

## 监听一个事件

浏览器在用户操作时**派发事件**（dispatch an event）。`element.addEventListener(type, listener)` 注册一个**监听器**（listener）：事件发生时，浏览器调用这个函数，并传入描述这次事件的**事件对象**。

这和 Java Swing 的 `addActionListener`、或 Python GUI 库的回调很像，区别在于 TypeScript 会根据事件名推断参数类型：`'click'` 对应 `MouseEvent`，`'keydown'` 对应 `KeyboardEvent`，`'input'` 对应 `Event`。

:::playground{#first-listener}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <button id="like" type="button">👍 点赞</button>
    <p>已获得 <output id="count">0</output> 个赞</p>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=main.ts
const button = document.querySelector('#like');
const count = document.querySelector('#count');
if (!(button instanceof HTMLButtonElement) || !(count instanceof HTMLOutputElement)) {
  throw new Error('页面缺少 #like 按钮或 #count 输出');
}

let likes = 0;
button.addEventListener('click', (event) => {
  likes++;
  count.textContent = String(likes);
  console.log(`第 ${likes} 次点击，事件类型：${event.type}，按下的鼠标键编号：${event.button}`);
});
```
- 点击“运行”，再点几下预览里的按钮，观察页面和输出。
- 把鼠标停在第 8 行的 `event` 上：类型是 `MouseEvent`，所以能读到 `event.button`。把 `'click'` 改成 `'keydown'`，`event.button` 会立刻报错——`KeyboardEvent` 上没有这个属性。
- `querySelector('#like')` 的返回类型是 `Element | null`：TypeScript 不可能知道 id 对应的是什么元素。第 3 行用 `instanceof` 同时排除了 `null` 和“类型不对”两种情况，之后 `button`、`count` 就是具体的元素类型。
:::

## `target` 与 `currentTarget`

点击一个元素时，事件会从它开始向外层元素**冒泡**（bubble），外层元素上的监听器也会被调用（下一课详细讲）。所以在一个监听器里有两个不同的元素：

- `event.target`：事件**发生**的那个元素，可能是监听器所在元素内部的某个子元素。
- `event.currentTarget`：**挂着当前监听器**的那个元素。它只在监听器执行期间有值，之后再读取会得到 `null`。

两者的类型都是 `EventTarget | null`：TypeScript 不知道事件具体从哪个元素来，所以使用元素的属性之前要先收窄。

:::playground{#target-vs-current}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <div id="card" class="card">
      <h3 id="title">TypeScript 工坊</h3>
      <button id="star" type="button"><span id="icon">⭐</span> 收藏</button>
    </div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```css file=style.css
.card { padding: 12px; border: 2px dashed #888; max-width: 260px; }
#icon { display: inline-block; padding: 0 4px; background: #ffe9a8; }
```
```ts file=main.ts
function describe(t: EventTarget | null): string {
  if (t instanceof HTMLElement) return `<${t.tagName.toLowerCase()} id="${t.id}">`;
  return String(t);
}

const card = document.querySelector('#card');
if (!(card instanceof HTMLDivElement)) throw new Error('缺少 #card');

card.addEventListener('click', (event) => {
  console.log('target：', describe(event.target), '｜ currentTarget：', describe(event.currentTarget));
  setTimeout(() => console.log('事件处理结束后再读 currentTarget：', event.currentTarget), 0);
});
```
- 分别点击星星图标、按钮文字、标题和卡片的虚线边框附近，比较两列输出：`currentTarget` 永远是卡片，`target` 随你点中的元素变化。
- 第 11 行在事件处理结束后读取 `currentTarget`，输出是 `null`。如果以后需要这个元素，应该在监听器里先把它存到变量里。
:::

::exercise{#char-counter}

## 移除监听器

监听器会一直生效，直到被移除。三种常用方式：

| 方式 | 写法 | 注意 |
|---|---|---|
| 只触发一次 | `addEventListener('click', fn, { once: true })` | 调用一次后自动移除 |
| 用 signal 批量移除 | `addEventListener('click', fn, { signal: controller.signal })`，之后 `controller.abort()` | 一个 `AbortController` 可以同时移除多个监听器 |
| 手动移除 | `removeEventListener('click', fn)` | 必须传入**同一个函数引用**；内联写的箭头函数无法这样移除 |

:::playground{#remove-listeners}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <button id="once" type="button">只响应一次</button>
    <button id="ping" type="button">Ping</button>
    <button id="stop" type="button">停止监听 Ping</button>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=main.ts
const onceButton = document.querySelector('#once');
const ping = document.querySelector('#ping');
const stop = document.querySelector('#stop');
if (!(onceButton instanceof HTMLButtonElement) || !(ping instanceof HTMLButtonElement) || !(stop instanceof HTMLButtonElement)) {
  throw new Error('页面结构不完整');
}

onceButton.addEventListener('click', () => console.log('第一次点击生效'), { once: true });

const controller = new AbortController();
ping.addEventListener('click', () => console.log('pong'), { signal: controller.signal });

stop.addEventListener('click', () => {
  controller.abort();
  console.log('已移除 Ping 的监听器');
});
```
- 连续点几次“只响应一次”，只有第一次有输出。
- 点几次 Ping，再点“停止监听 Ping”，之后 Ping 不再输出。
:::

## 编程挑战

::exercise{#poll}

::quiz

## 常见错误

- **到处写 `!` 或 `as HTMLButtonElement`**：它们只是让编译器闭嘴。元素不存在或类型不对时，错误会在运行时以更难理解的方式出现。用 `instanceof` 检查，或者在找不到元素时尽早抛出清楚的错误。
- **把 `event.target` 当成挂监听器的元素**：用户点中的可能是按钮里的图标。需要监听器所在的元素时用 `currentTarget`（或闭包里已经拿到的元素变量）。
- **用 `'change'` 代替 `'input'` 做实时反馈**：文本框的 `change` 一般在失去焦点或提交时才触发，`input` 才是每次输入都触发。
- **想用 `removeEventListener` 移除内联箭头函数**：每次写 `() => …` 都是新函数，引用不同就移除不掉。用 `signal` 或保存函数引用。

## 下一步

下一课讲事件冒泡与**事件委托**（event delegation）：只在外层元素挂一个监听器，处理很多子元素的事件，并用 `preventDefault()` 阻止表单默认的提交跳转。
