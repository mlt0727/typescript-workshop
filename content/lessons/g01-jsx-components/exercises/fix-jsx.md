---
kind: task
title: 把 HTML 改成 JSX
---
`Newsletter` 组件的代码是从一个 HTML 页面直接复制过来的，现在既编译不过，也运行不了。把它改成正确的 JSX：

- 页面上的结构保持不变：标题 `<h2>` 和表单 `<form>` 是**并列**的两个元素，不要额外添加包裹它们的元素；
- 原来的 class、`style` 都要保留下来（改成 JSX 的写法）；“邮箱”标签和输入框之间的关联也要保留（用 `htmlFor`，或者把输入框放进 `<label>` 里）；
- 每个标签都要正确闭合。

:::files{role=starter}
```tsx file=Newsletter.tsx
export function Newsletter() {
  return (
    <h2 class="title">订阅周刊</h2>
    <form class="newsletter">
      <label for="email">邮箱</label>
      <input id="email" type="email" required>
      <p class="hint" style="color: gray">每周一封，随时退订。</p>
      <hr>
      <button type="submit">订阅</button>
    </form>
  );
}
```
:::

:::files{role=support}
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { Newsletter } from './Newsletter';

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<Newsletter />);
```
:::

:::files{role=solution}
```tsx file=Newsletter.tsx
export function Newsletter() {
  return (
    <>
      <h2 className="title">订阅周刊</h2>
      <form className="newsletter">
        <label htmlFor="email">邮箱</label>
        <input id="email" type="email" required />
        <p className="hint" style={{ color: 'gray' }}>
          每周一封，随时退订。
        </p>
        <hr />
        <button type="submit">订阅</button>
      </form>
    </>
  );
}
```
:::

:::files{role=tests}
```tsx file=Newsletter.test.tsx
import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Newsletter } from './Newsletter';

test('标题和表单是并列的两个元素，没有多余的包裹元素', () => {
  const { container } = render(<Newsletter />);
  expect([...container.children].map((el) => el.tagName)).toEqual(['H2', 'FORM']);
});

test('class 都保留了下来', () => {
  const { container } = render(<Newsletter />);
  expect(screen.getByRole('heading', { level: 2, name: '订阅周刊' })).toHaveClass('title');
  expect(container.querySelector('form')).toHaveClass('newsletter');
  expect(screen.getByText('每周一封，随时退订。')).toHaveClass('hint');
});

test('标签和邮箱输入框关联在一起', () => {
  render(<Newsletter />);
  const input = screen.getByLabelText('邮箱');
  const label = screen.getByText('邮箱', { selector: 'label' });
  expect(label instanceof HTMLLabelElement ? label.control : null, '标签要和输入框关联，而不是只给输入框起一个同样的名字').toBe(input);
  expect(input).toHaveAttribute('type', 'email');
  expect(input).toBeRequired();
});

test('提示文字是灰色的', () => {
  render(<Newsletter />);
  expect(screen.getByText('每周一封，随时退订。').style.color).toBe('gray');
});

test('分隔线和订阅按钮都在表单里', () => {
  const { container } = render(<Newsletter />);
  expect(container.querySelector('form > hr')).not.toBeNull();
  expect(screen.getByRole('button', { name: '订阅' })).toHaveAttribute('type', 'submit');
});
```
:::

:::hint{level=1}
对照本课的表格逐条改：`class` → `className`，`for` → `htmlFor`，`style` 改成对象，`<input>`、`<hr>` 改成自闭合。两个并列的元素用 `<>` 和 `</>` 包起来。
:::

:::hint{level=2}
`style={{ color: 'gray' }}`：外层花括号表示“这里是一个表达式”，内层花括号是对象字面量。改完之后看一看编辑器里还剩下哪些错误，TypeScript 的提示（例如 “Did you mean 'htmlFor'?”）会告诉你怎么改。
:::

:::explanation
JSX 最终会变成 JavaScript 对象（g01 正文），属性名就是对象的键：`class` 和 `for` 是 JavaScript 的保留字，所以沿用 DOM 中对应属性的名字 `className`、`htmlFor`；其他属性名大多用驼峰写法（`tabIndex`、`onClick`）；`style` 接收一个对象。`aria-*`、`data-*` 例外，保持原样。

Fragment（`<>…</>`）解决了“只能返回一个值”的限制，又不会在页面中多出一层元素。多一层 `<div>` 往往会破坏 CSS 布局（例如 Grid 和 Flexbox 只对直接子元素生效），或者让 HTML 结构不再合法（例如 `<ul>` 里只能放 `<li>`）。

注意把 `for` 改掉时不要直接删除它：没有 `htmlFor`，标签就和输入框失去了关联，点击“邮箱”这两个字不会聚焦输入框，读屏软件也读不出输入框的名字（d02）。另一种关联方式是把 `<input>` 放进 `<label>` 里面。
:::

:::variant{kind=alt name=fragment-and-wrapping-label}
```tsx file=Newsletter.tsx
import { Fragment } from 'react';

export function Newsletter() {
  const hintStyle = { color: 'gray' };
  return (
    <Fragment>
      <h2 className="title">订阅周刊</h2>
      <form className="newsletter">
        <label>
          邮箱
          <input id="email" type="email" required={true} />
        </label>
        <p className="hint" style={hintStyle}>每周一封，随时退订。</p>
        <hr />
        <button type="submit">订阅</button>
      </form>
    </Fragment>
  );
}
```
:::

:::variant{kind=wrong name=extra-div fails=tests reason="用一个 div 包住了标题和表单，页面结构变了"}
```tsx file=Newsletter.tsx
export function Newsletter() {
  return (
    <div>
      <h2 className="title">订阅周刊</h2>
      <form className="newsletter">
        <label htmlFor="email">邮箱</label>
        <input id="email" type="email" required />
        <p className="hint" style={{ color: 'gray' }}>每周一封，随时退订。</p>
        <hr />
        <button type="submit">订阅</button>
      </form>
    </div>
  );
}
```
:::

:::variant{kind=wrong name=class-attribute fails=types reason="仍然使用 HTML 的 class 属性"}
```tsx file=Newsletter.tsx
export function Newsletter() {
  return (
    <>
      <h2 class="title">订阅周刊</h2>
      <form class="newsletter">
        <label htmlFor="email">邮箱</label>
        <input id="email" type="email" required />
        <p class="hint" style={{ color: 'gray' }}>每周一封，随时退订。</p>
        <hr />
        <button type="submit">订阅</button>
      </form>
    </>
  );
}
```
:::

:::variant{kind=wrong name=style-string fails=types reason="style 仍然是字符串"}
```tsx file=Newsletter.tsx
export function Newsletter() {
  return (
    <>
      <h2 className="title">订阅周刊</h2>
      <form className="newsletter">
        <label htmlFor="email">邮箱</label>
        <input id="email" type="email" required />
        <p className="hint" style="color: gray">每周一封，随时退订。</p>
        <hr />
        <button type="submit">订阅</button>
      </form>
    </>
  );
}
```
:::

:::variant{kind=wrong name=deleted-for fails=tests reason="删掉了 for 而不是改成 htmlFor，标签与输入框失去了关联"}
```tsx file=Newsletter.tsx
export function Newsletter() {
  return (
    <>
      <h2 className="title">订阅周刊</h2>
      <form className="newsletter">
        <label>邮箱</label>
        <input id="email" type="email" required />
        <p className="hint" style={{ color: 'gray' }}>每周一封，随时退订。</p>
        <hr />
        <button type="submit">订阅</button>
      </form>
    </>
  );
}
```
:::
