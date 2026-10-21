---
version: 1
mode: react
estimatedMinutes: 55
review: self-reviewed
problem: 一个用 div 和 onClick 拼出来的“按钮”，用鼠标点完全正常，用键盘却按不到，读屏软件读出来的只是一段文字；一个弹出的确认框，键盘用户按 Tab 却跑到了它背后的页面上，关掉之后焦点也不知道去了哪里。这些问题在视觉上完全看不出来，只有用键盘、用读屏软件（或者用按角色查找的测试）才会暴露。这一课总结组件可访问性的几条核心规则：优先用原生元素，正确的名字、角色和状态，键盘操作与焦点管理；按 WAI-ARIA 的模式实现一个可以用键盘操作的标签页组件；再为一个确认对话框写组件测试，把这些要求固定下来。
objectives:
  - 优先使用原生的交互元素，为自定义组件提供正确的角色、可访问的名字和状态（aria-selected、aria-expanded 等）
  - 按 WAI-ARIA APG 的模式实现键盘交互：标签页的方向键与 Home/End，以及 roving tabindex
  - 管理焦点：对话框打开时把焦点移进去，关闭后归还给触发它的元素，Esc 关闭
  - 用 Testing Library 按角色、名字、状态和焦点测试组件的可访问性
references:
  - title: Tabs Pattern — WAI-ARIA Authoring Practices Guide
    url: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
    checked: 2026-10-20
  - title: Dialog (Modal) Pattern — WAI-ARIA Authoring Practices Guide
    url: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
    checked: 2026-10-20
  - title: Alert and Message Dialogs Pattern — WAI-ARIA Authoring Practices Guide
    url: https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/
    checked: 2026-10-20
  - title: Read Me First（No ARIA is better than Bad ARIA）— WAI-ARIA APG
    url: https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/
    checked: 2026-10-20
  - title: ByRole — Testing Library
    url: https://testing-library.com/docs/queries/byrole
    checked: 2026-10-20
---

## 先用原生元素

APG 的第一句忠告是“没有 ARIA 比错误的 ARIA 更好”。`<button>`、`<a href>`、`<input>`、`<select>`、`<details>` 这些原生元素自带了角色、键盘操作和焦点，什么都不用做就是可访问的。自己用 `<div>` 重新实现一个按钮，要补上 `role="button"`、`tabIndex={0}`、Enter 和空格的处理，还很容易漏掉一样。

:::playground{#div-button}
```tsx file=App.tsx
import { useState } from 'react';

export function App() {
  const [count, setCount] = useState(0);
  return (
    <>
      <div className="fake" onClick={() => setCount(count + 1)}>
        假按钮（div）
      </div>
      <button type="button" onClick={() => setCount(count + 1)}>
        真按钮（button）
      </button>
      <p role="status">点击了 {count} 次</p>
    </>
  );
}
```
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<App />);
```
- 在预览中用鼠标点两个都有效。然后点一下预览的空白处，按 Tab：焦点直接跳到了“真按钮”，`div` 根本无法用键盘到达；在“真按钮”上按 Enter 或空格，计数会增加。
- 在测试中，`screen.getByRole('button', { name: '假按钮（div）' })` 找不到它：按角色查找的测试会直接发现这个问题。
:::

## 名字、角色、状态

无论用不用原生元素，每个交互元素在可访问性树中都要有三样东西（d04 讲过可访问的名字）：

- **角色**：它是什么（按钮、标签页、对话框……）；
- **名字**：用户怎样称呼它。图标按钮要有 `aria-label`，对话框用 `aria-labelledby` 指向它的标题；
- **状态**：它现在怎样。展开了没有（`aria-expanded`）、选中了没有（`aria-selected`、`aria-checked`）、按下了没有（`aria-pressed`，g03）、不可用（`disabled`）。

状态必须和界面同步：视觉上选中的是第二个标签页，`aria-selected="true"` 也必须在第二个上。Testing Library 可以直接按状态查找：`getByRole('tab', { selected: true })`、`getByRole('button', { expanded: false })`。

## 键盘交互：以标签页为例

自定义的复合组件（标签页、菜单、列表框、树）要按照 WAI-ARIA APG 中对应模式的键盘约定实现，用户在不同的网站上才能用同样的方式操作。标签页的约定：

- 标签页的容器是 `role="tablist"`，有名字（`aria-label` 或 `aria-labelledby`）；每个标签页是 `role="tab"`，`aria-selected` 标出当前的那个，`aria-controls` 指向它的面板；每个面板是 `role="tabpanel"`，`aria-labelledby` 指向它的标签页；
- 按 Tab 进入标签页时，焦点落在**当前选中**的那一个上；再按 Tab，离开标签页，到达面板（面板设置了 `tabIndex={0}` 时；面板中第一个元素本身就能获得焦点时，APG 说面板可以不设置）；
- 在标签页上按 **右方向键**到下一个、**左方向键**到上一个，在两端循环；**Home**、**End** 到第一个、最后一个。“自动激活”的标签页在焦点移动时同时切换面板。

“按 Tab 只停在选中的那一个上”用 **roving tabindex** 实现：选中的标签页 `tabIndex={0}`，其他的 `tabIndex={-1}`（不在 Tab 的顺序中，但可以用代码 `focus()`）。方向键的处理函数中把焦点移到新的标签页上，并更新选中的状态。

::exercise{#tabs}

## 焦点管理：对话框

对话框是焦点管理最典型的例子。APG 的模态对话框模式要求：

1. 打开时，焦点移到对话框**内部**的一个元素上。对于“删除”这类难以撤销的操作，焦点最好放在**最不危险**的按钮上（通常是“取消”）；
2. 对话框有名字（`aria-labelledby` 指向标题），可以用 `aria-describedby` 指向说明文字；`aria-modal="true"` 告诉读屏软件对话框之外的内容暂时不可用。要求用户确认的对话框使用 `role="alertdialog"`（Alert Dialog 模式）；
3. 按 **Esc** 关闭；
4. 关闭之后，焦点**回到打开它的那个元素**上，键盘用户才能接着刚才的位置继续操作。

原生的 `<dialog>` 元素配合 `showModal()` 能自动处理其中的一部分（把对话框之外的内容变成不可交互、Esc 关闭）。但在测试中，user-event 模拟的按键不是浏览器认为“真实”的用户输入，不会触发浏览器自带的 Esc 关闭，所以下面的挑战中，组件自己处理 Esc 键。

## React 组件的测试

`@testing-library/react` 的 `render(<组件 />)` 把组件渲染进页面，之后用 `screen` 查找、用 user-event 操作，与 f08 完全一样。测试的仍然是用户能看到的行为，而不是组件内部：

- 不要检查 state 的值、不要调用组件内部的函数；用户点了按钮之后，检查页面上出现了什么；
- 换一种实现（`useState` 换成 `useReducer`，拆成两个子组件），行为不变，测试就应该仍然通过；
- 异步出现的内容用 `findBy…` 或 `waitFor` 等待。React 的状态更新由 Testing Library 自动包在 `act` 中，通常不需要自己写 `act`。

在自己的电脑上运行时，在 f08 的配置之外还要：安装 `@testing-library/react`（以及 `@vitejs/plugin-react`，加进 `vite.config.ts` 的 `plugins`）；在 `setup-tests.ts` 中加上 `afterEach(() => cleanup())`（`cleanup` 从 `@testing-library/react` 导入）。Testing Library 只在测试框架提供**全局的** `afterEach` 时才自动清理，而 Vitest 默认不提供全局 API（`globals` 为 `false`）：不加这一行，上一个测试渲染的组件会留在页面上，下一个测试会找到两个同样的按钮。这个网站和“下载本地项目”生成的项目都已经这样做了。

## 测试可访问性

f08 已经讲过按角色和名字查找元素。检查可访问性时，再加上**状态**和**焦点**：

```tsx
const user = userEvent.setup();
render(<Tabs label="账户设置" tabs={tabs} />);
const profile = screen.getByRole('tab', { name: '个人资料' });
const security = screen.getByRole('tab', { name: '安全' });
await user.click(security);
expect(security).toHaveAttribute('aria-selected', 'true');
expect(screen.getByRole('tabpanel')).toHaveAccessibleName('安全');
await user.keyboard('{ArrowLeft}');
expect(profile).toHaveFocus();
```

`getByRole` 默认忽略被 `hidden` 隐藏的元素，所以“只能找到一个 `tabpanel`”本身就检查了“其他面板都被隐藏了”。

自动化的工具（例如 axe-core）可以扫描出缺少名字、对比度不足这类问题，但它们发现不了“焦点没有回到原来的位置”“方向键不起作用”这类交互上的问题，这些要靠像上面这样的测试，以及真的用键盘操作一遍。

## 编程挑战

::exercise{#test-confirm-dialog}

::quiz

## 常见错误

- **用 `div` 加 `onClick` 做按钮**：键盘到达不了，读屏软件不知道它可以点击。用 `<button type="button">`。
- **图标按钮没有名字**：读屏软件只读出“按钮”。加 `aria-label`。
- **状态不同步**：界面切换了，`aria-selected`、`aria-expanded` 没有跟着变。用同一个 state 同时决定界面和属性。
- **自定义组件的每一项都可以 Tab 到**：标签页、菜单中按 Tab 应该只停在一项上，其余用方向键。用 roving tabindex。
- **对话框关闭后不归还焦点**：键盘用户回到了页面的开头。关闭时把焦点放回打开它的元素。
- **只用鼠标检查**：每次完成一个组件，用键盘完整地操作一遍，并用按角色查找的测试固定下来。
