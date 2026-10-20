---
version: 1
mode: dom
estimatedMinutes: 40
review: self-reviewed
problem: 上一课的监听器都直接挂在目标元素上。但一个列表可能有几百项，而且项目会被动态地添加和删除，给每一项单独挂监听器既浪费，又容易漏掉新加的元素。浏览器的事件会沿着 DOM 树传播，利用这一点，只在外层挂一个监听器就能处理所有子元素的事件，这就是事件委托。这一课还讲如何阻止浏览器的默认行为（链接跳转、表单提交），以及哪些事件不会冒泡。
objectives:
  - 理解事件传播的三个阶段：捕获、目标、冒泡，知道 capture 选项的作用
  - 用事件委托处理一组（包括动态添加的）子元素的事件：event.target、closest、contains
  - 用 preventDefault 阻止默认行为，知道 stopPropagation 为什么要慎用
  - 知道 focus、blur、mouseenter 等事件不冒泡，以及对应的替代事件
references:
  - title: Event bubbling — MDN Learn web development
    url: https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Event_bubbling
    checked: 2026-10-20
  - title: Event.preventDefault() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault
    checked: 2026-10-20
  - title: Element.closest() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/Element/closest
    checked: 2026-10-20
  - title: "Element: focusin event — MDN"
    url: https://developer.mozilla.org/en-US/docs/Web/API/Element/focusin_event
    checked: 2026-10-20
---

## 事件的传播：捕获、目标、冒泡

点击一个按钮时，事件并不只发生在按钮上。浏览器把它沿着 DOM 树传播三个阶段：

1. **捕获**：从 `window` 向下，经过每一层祖先，到达目标的父元素；
2. **目标**：到达被点击的元素本身；
3. **冒泡**：再从目标向上，经过每一层祖先，回到 `window`。

`addEventListener` 默认在**冒泡**阶段调用监听器；第三个参数传 `{ capture: true }`（或 `true`），则在**捕获**阶段调用。绝大多数时候用冒泡就够了。`event.eventPhase` 是当前阶段的编号：1 捕获、2 目标、3 冒泡。在目标元素自己身上，捕获阶段的监听器总是先于普通监听器执行，与注册的先后无关。

:::playground{#phases}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <div id="outer" class="box">
      outer
      <div id="inner" class="box">
        inner
        <button id="button" type="button">按钮</button>
      </div>
    </div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```css file=style.css
.box { padding: 12px; border: 2px dashed #888; margin: 4px; }
```
```ts file=main.ts
const phaseNames = ['无', '捕获', '目标', '冒泡'];

for (const id of ['outer', 'inner', 'button']) {
  const el = document.getElementById(id);
  if (el === null) continue;
  el.addEventListener('click', (event) => console.log(`[capture] ${id}：${phaseNames[event.eventPhase]}阶段`), { capture: true });
  el.addEventListener('click', (event) => console.log(`[bubble]  ${id}：${phaseNames[event.eventPhase]}阶段`));
}
```
- 点击按钮：先是从外到内的捕获（outer、inner），然后是按钮自己的两个监听器（目标阶段），最后是从内到外的冒泡（inner、outer）。
- 点击 inner 的空白处：事件的目标变成了 inner，button 上的监听器都不会被调用。
:::

## 事件委托

因为事件会冒泡，在外层元素上挂一个监听器，就能收到所有子元素的点击。在监听器里判断“点中的是哪一个”：

1. `event.target` 是事件实际发生的元素，类型是 `EventTarget | null`，先用 `instanceof Element` 收窄；
2. 点中的可能是按钮里面的图标，用 `target.closest('button')` 向上找到按钮本身；
3. 确认找到的按钮在这个容器里面：`list.contains(button)`（`closest` 可能一路找到容器外面去）。

好处是：只需要一个监听器；之后动态添加的元素自动生效，不需要再挂监听器；删除元素时也不用操心它的监听器。

:::playground{#delegation}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <ul id="list">
      <li data-id="1">第 1 项 <button type="button"><span aria-hidden="true">🗑</span> 删除</button></li>
      <li data-id="2">第 2 项 <button type="button"><span aria-hidden="true">🗑</span> 删除</button></li>
    </ul>
    <button type="button" id="add">添加一项</button>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=main.ts
const list = document.querySelector('#list');
const add = document.querySelector('#add');
if (!(list instanceof HTMLUListElement) || !(add instanceof HTMLButtonElement)) {
  throw new Error('页面结构不完整');
}

let count = 2;
add.addEventListener('click', () => {
  count++;
  const li = document.createElement('li');
  li.dataset.id = String(count);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = '删除';
  li.append(`第 ${count} 项 `, remove);
  list.append(li);
});

list.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('button');
  if (button === null || !list.contains(button)) return;
  const item = button.closest('li');
  console.log('删除第', item?.dataset.id, '项');
  item?.remove();
});
```
- 点击“添加一项”几次，再删除新加的项：它们没有单独的监听器，同样能被删除。
- 点击按钮里的 🗑 图标：`event.target` 是 `<span>`，第 21 行的 `closest('button')` 找到了按钮。
- 第 21 行：`closest('button')` 的参数正好是标签名，返回类型是 `HTMLButtonElement | null`。
:::

## 阻止默认行为

很多事件有浏览器的**默认行为**：点击链接会跳转，提交表单会发送数据并跳转页面，点击复选框会切换勾选状态，在输入框里按键会输入字符。在监听器里调用 `event.preventDefault()` 可以阻止它，`event.defaultPrevented` 表示是否已经被阻止。

最常见的用途是处理表单的 `submit` 事件：阻止页面跳转，改用 TypeScript 处理数据（下一课）。

另一个方法 `event.stopPropagation()` 阻止事件继续传播。它要**慎用**：外层的事件委托、页面上统计点击的代码、“点击外部关闭菜单”这类逻辑都依赖冒泡，阻止传播会让它们悄悄失效。大多数需要它的场合，其实应该在外层的监听器里判断 `event.target`。

:::playground{#prevent-default}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <p><a id="link" href="https://example.com/">去 example.com</a></p>
    <form id="search">
      <input name="q" value="TypeScript" aria-label="搜索内容" />
      <button>搜索</button>
    </form>
    <p><label><input type="checkbox" id="locked" checked /> 这个复选框无法取消</label></p>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=main.ts
const link = document.querySelector('#link');
const form = document.querySelector('#search');
const locked = document.querySelector('#locked');
if (!(link instanceof HTMLAnchorElement) || !(form instanceof HTMLFormElement) || !(locked instanceof HTMLInputElement)) {
  throw new Error('页面结构不完整');
}

link.addEventListener('click', (event) => {
  event.preventDefault();
  console.log('没有跳转，目标地址是', link.href);
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  console.log('没有提交，搜索内容：', new FormData(form).get('q'));
});

locked.addEventListener('click', (event) => {
  event.preventDefault();
  console.log('阻止了勾选状态的改变');
});
```
- 依次点击链接、“搜索”按钮（或在输入框里按 Enter）、复选框，观察输出：三种默认行为都被阻止了。
- 处理链接点击时要谨慎：用户可能想用 Ctrl/⌘+点击或 Shift+点击在新标签页、新窗口中打开，这些操作同样会触发 `click`，一律阻止会破坏这些习惯（中键点击触发的是 `auxclick`，不受影响）。真正执行操作的应该是按钮，链接就让它跳转。
:::

## 不冒泡的事件

少数事件不会冒泡，在外层监听时收不到：

| 不冒泡 | 替代做法 |
| --- | --- |
| `focus`、`blur` | 改用会冒泡的 `focusin`、`focusout` |
| `mouseenter`、`mouseleave` | 改用会冒泡的 `mouseover`、`mouseout`（进出子元素时也会触发） |
| `load`、`error`（图片等资源）、`invalid`（d02）、`scroll`（元素上的） | 在外层的捕获阶段监听：`{ capture: true }`（捕获阶段对所有事件都有效） |

所以对一组输入框做事件委托时，监听 `focusin`/`focusout`，而不是 `focus`/`blur`。

另外，`touchstart`、`wheel` 这类事件的监听器可以声明 `{ passive: true }`，表示自己不会调用 `preventDefault()`，浏览器就不必等待监听器执行完再滚动页面，滚动更流畅。挂在 `window`、`document`、`body` 上的 `touchstart`、`touchmove`、`wheel` 监听器默认就是 passive 的；在这些位置确实要阻止滚动时，必须显式写 `{ passive: false }`。

## 清理监听器

委托让监听器的数量不再随项数增长，但挂在容器上的监听器本身仍然一直有效。界面中的一部分被关闭或替换时（例如关闭一个弹窗、切换到另一个页面），要把它注册的监听器移除，否则它们会继续响应事件，访问已经不存在的数据。

d07 讲过的 `AbortController` 在这里很方便：一部分界面的所有监听器都用同一个 `signal` 注册，关闭时调用一次 `abort()` 就全部移除。如果你写了一个“挂上监听器”的函数，最好让它**返回一个清理函数**，调用方就不必关心内部用的是哪种方式（挑战题就是这样设计的；React 的 Effect 也采用同样的约定，G 阶段会讲）。

```ts
function setupPanel(panel: HTMLElement): () => void {
  const controller = new AbortController();
  panel.addEventListener('click', onClick, { signal: controller.signal });
  panel.addEventListener('keydown', onKeydown, { signal: controller.signal });
  return () => controller.abort();
}
```

（这里的 `onClick`、`onKeydown` 是在别处定义好的监听函数。）

::exercise{#todo-delegation}

## 编程挑战

::exercise{#delegate-helper}

::quiz

## 常见错误

- **给列表的每一项单独挂监听器**：新加的项要记得补挂，整体替换列表之后要全部重挂，监听器的数量也随项数增长。用事件委托。
- **直接使用 `event.target`**：点中的可能是按钮里面的图标或文字。用 `closest` 找到真正关心的元素。
- **委托时不检查 `contains`**：`closest` 可能找到容器外面的祖先元素。
- **处理表单时忘了 `preventDefault()`**：页面会提交并跳转（本平台的沙箱会拦截这种跳转并报告）。
- **随手 `stopPropagation()`**：外层依赖冒泡的逻辑会悄悄失效。
- **在外层监听 `focus`、`blur`**：它们不冒泡。用 `focusin`、`focusout`。

## 下一步

下一课把这些组合起来：读取表单输入，用 TypeScript 验证，并给出可访问的错误提示。
