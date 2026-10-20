---
version: 1
mode: dom
estimatedMinutes: 55
review: self-reviewed
problem: 任务板现在能显示、能添加。这一个里程碑给每个任务加上“左移、右移、改名、删除”。任务会不断地被添加、删除、重新渲染，给每个按钮单独添加监听器既麻烦又容易出错，所以用事件委托：整个任务板只有一个监听器，根据被点击的按钮上的 data 属性决定做什么。重新渲染会替换掉所有的元素，用户刚刚点过的按钮也不在了，所以还要在每次操作之后把焦点放到一个合理的位置。最后实现就地改名：点“改名”时任务变成一个小表单，回车保存、Esc 取消。
objectives:
  - 用事件委托处理动态生成的元素：closest 找到按钮和它所属的任务，data 属性说明动作（d08）
  - 区分“数据状态”（任务板）和“界面状态”（正在改名的是哪个任务），两者共同决定渲染的结果
  - 重新渲染之后恢复焦点：移动后留在被移动的任务上，删除后移到这一列的标题（d09、e10）
  - 实现就地编辑：打开时聚焦并选中文字，回车保存、Esc 取消，结束后焦点回到触发它的按钮（g09）
references:
  - title: Event delegation — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Learn_web_development/Core/Scripting/Event_bubbling
    checked: 2026-10-20
  - title: Element.closest() — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/API/Element/closest
    checked: 2026-10-20
  - title: HTMLElement.dataset — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/API/HTMLElement/dataset
    checked: 2026-10-20
  - title: Developing a Keyboard Interface（焦点管理）— WAI-ARIA APG
    url: https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
    checked: 2026-10-20
---

## 一个监听器处理所有的按钮

每个任务都有四个按钮。任务是动态生成的，每次渲染都会换一批新的元素，如果给每个按钮单独 `addEventListener`，每次渲染之后都要重新绑定。d08 讲过另一种做法：**事件委托**。点击事件会从按钮冒泡到外层的元素，在外层（这里是整个任务板）只放一个监听器，用 `closest` 找出被点击的是哪个按钮、属于哪个任务：

:::playground{#delegation}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <ul id="tasks">
      <li data-id="t1">
        写周报
        <button type="button" data-action="right" aria-label="右移：写周报"><span aria-hidden="true">→</span></button>
        <button type="button" data-action="remove" aria-label="删除：写周报"><span aria-hidden="true">×</span></button>
      </li>
      <li data-id="t2">
        修自行车
        <button type="button" data-action="right" aria-label="右移：修自行车"><span aria-hidden="true">→</span></button>
        <button type="button" data-action="remove" aria-label="删除：修自行车"><span aria-hidden="true">×</span></button>
      </li>
    </ul>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=main.ts
const list = document.querySelector('#tasks');
if (!(list instanceof HTMLElement)) throw new Error('页面缺少 #tasks');

list.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  console.log('被点击的元素：', event.target.tagName);
  const button = event.target.closest('button[data-action]');
  const item = button?.closest('li');
  if (!(button instanceof HTMLButtonElement) || !(item instanceof HTMLLIElement)) return;
  console.log(`动作 ${button.dataset['action']}，任务 ${item.dataset['id']}`);
});
```
- 点箭头和叉号：控制台打印的“被点击的元素”是 `SPAN`，不是按钮。鼠标点到的是按钮里面的图标，`event.target` 就是那个图标。`closest('button[data-action]')` 从被点击的元素向上找，找到的才是按钮；再从按钮向上找到所属的 `li`。
- 用 Tab 移到按钮上、按回车或空格，按钮同样会触发 `click`，键盘用户不需要额外的处理。
- 图标放在 `aria-hidden="true"` 的 `span` 中，按钮的名字来自 `aria-label`（“右移：写周报”）：读屏用户听到的是完整的说明，而不是“右箭头”。名字中带上任务的标题，几个“删除”按钮就不会分不清。
- `dataset['action']` 读取 `data-action` 属性。属性值都是字符串，用之前要检查它是不是预期的几个值之一。
:::

## 数据状态与界面状态

“哪个任务正在改名”不是任务板本身的数据：保存任务板时不需要保存它，换一台设备打开也不需要恢复它。但它同样决定了页面的样子：正在改名的任务显示成一个表单。所以应用里有两部分状态：

- **数据状态** `board`：由 `reduce` 计算，以后会被保存；
- **界面状态** `view`：正在改名的任务 `editingId`、输入框中正在输入的内容 `draft`、改名的错误 `renameError`。它们只存在于这一次打开的页面中。

渲染函数同时接收两者：`renderBoard(root, board, view)`。界面状态变化时同样重新渲染，和 React 中“state 变了就重新渲染”是一个道理（g03）。`draft` 是个例外：用户每输入一个字就更新它，但不重新渲染（重新渲染会换掉正在输入的输入框），它的作用是在别的操作引起重新渲染时，让输入框显示用户已经输入的内容。

## 重新渲染之后的焦点

用户用键盘点了“右移”，任务板重新渲染，原来那个按钮被替换掉了，焦点丢了：`document.activeElement` 变成了 `document.body`。读屏用户听不到任何反馈，不知道发生了什么；键盘用户下一次按 Tab 时，现代浏览器会从被删除的元素原来的位置附近继续（“顺序焦点导航的起点”），在这里是任务板的开头，而不是刚才操作的那个任务。所以每个操作之后都要**把焦点放到一个合理的位置**，并用 `role="status"` 告诉用户结果：

- 移动之后：焦点留在被移动的任务的同一个按钮上（如果它已经禁用，例如移到了最右边，就放到另一个方向的按钮上），这样连续按几次就能一直移动；
- 删除之后：这个任务没有了，焦点移到它原来所在的那一列的标题上（标题设置 `tabindex="-1"`，可以被脚本聚焦，但不在 Tab 顺序中，e10）；
- 改名结束之后：焦点回到这个任务的“改名”按钮上（g09 的就地编辑标题也是这样）。

重新渲染之后，元素都是新的，要按 `data-id` 和 `data-action` 重新找到它们：``root.querySelector(`li[data-id="${CSS.escape(id)}"] [data-action="right"]`)``。`CSS.escape` 让 id 中的特殊字符不会破坏选择器。

::exercise{#task-actions}

## 编程挑战

::exercise{#rename-task}

::quiz

## 常见错误

- **用 `event.target` 判断点的是哪个按钮**：点到按钮里的图标时，`target` 是图标。用 `closest`。
- **每次渲染后给每个按钮重新绑定监听器**：容易重复绑定或者漏掉。在不会被替换的外层元素上委托。
- **重新渲染之后不管焦点**：焦点回到页面开头，键盘和读屏用户迷失了位置。
- **把界面状态放进数据模型**：`editingId` 会被保存下来，下次打开页面时还停在编辑状态。
- **几个按钮都叫“删除”**：读屏用户分不清删的是哪个。名字中带上任务的标题。

## 下一步

下一个里程碑加上筛选：按文字和标签筛选任务，筛选条件保存在地址的查询参数中，后退、前进、刷新之后都能恢复。
