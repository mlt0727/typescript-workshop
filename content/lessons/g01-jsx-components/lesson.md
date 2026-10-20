---
version: 1
mode: react
estimatedMinutes: 35
review: ai-draft
problem: d10 用“状态 → 渲染函数 → DOM”的方式写界面，但渲染函数里满是 createElement、textContent、replaceChildren，结构很难一眼看出来。React 让你直接写出界面应该是什么样子：在 TypeScript 中写类似 HTML 的 JSX，由 React 负责更新 DOM。这一课讲 JSX 的规则（它和 HTML 的几处关键差别）、在 JSX 中嵌入表达式与条件渲染，以及怎样把界面拆成组件。
objectives:
  - 知道 JSX 是函数调用的语法糖，.tsx 文件中的 JSX 同样经过类型检查
  - 掌握 JSX 与 HTML 的差别：className、htmlFor、style 对象、驼峰事件名、必须闭合的标签、只能有一个根元素与 Fragment
  - 在 JSX 中用 {} 嵌入表达式，用 && 和三元运算符做条件渲染，避开 0 && 的陷阱
  - 用首字母大写的函数定义组件、组合组件，理解 JSX 中的文字会被自动转义
references:
  - title: Writing Markup with JSX — React
    url: https://react.dev/learn/writing-markup-with-jsx
    checked: 2026-10-20
  - title: JavaScript in JSX with Curly Braces — React
    url: https://react.dev/learn/javascript-in-jsx-with-curly-braces
    checked: 2026-10-20
  - title: Conditional Rendering — React
    url: https://react.dev/learn/conditional-rendering
    checked: 2026-10-20
  - title: Your First Component — React
    url: https://react.dev/learn/your-first-component
    checked: 2026-10-20
  - title: JSX — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/jsx.html
    checked: 2026-10-20
    note: 本平台使用 React 19.3、@types/react 19.3，编译选项 jsx 为 react-jsx
---

## 从渲染函数到 JSX

d10 的渲染函数是这样写的：

```ts
const card = document.createElement('article');
const title = document.createElement('h2');
title.textContent = book.title;
card.append(title);
```

用 React，同样的界面写成：

```tsx
const card = (
  <article>
    <h2>{book.title}</h2>
  </article>
);
```

这种写在 TypeScript 里的类似 HTML 的语法叫 **JSX**，包含 JSX 的文件扩展名是 `.tsx`。JSX 不是字符串，也不是 HTML：编译时，每个标签都会变成一次函数调用，例如 `<h2>{book.title}</h2>` 变成 `jsx('h2', { children: book.title })`，得到一个描述界面的普通对象（React **元素**）。React 拿到这些对象，再去创建和更新真实的 DOM。

因为它就是函数调用，TypeScript 会检查每个标签和属性：写错属性名、给属性传了错误类型的值，都会在编译时报错。

:::playground{#first-jsx}
```tsx file=App.tsx
const book = { title: 'TypeScript 入门', author: '李雷', pages: 320 };

function Header() {
  return (
    <header>
      <h1 className="site-title">读书笔记</h1>
    </header>
  );
}

export function App() {
  return (
    <main>
      <Header />
      <article>
        <h2>{book.title}</h2>
        <p>
          {book.author} 著，共 {book.pages} 页，大约需要 {Math.ceil(book.pages / 40)} 天读完。
        </p>
      </article>
    </main>
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
- 第 3–9 行：**组件**就是一个返回 JSX 的函数，名字必须以大写字母开头。第 14 行像使用 HTML 标签一样使用它：`<Header />`。
- 第 18 行：花括号 `{}` 里可以写任意 JavaScript **表达式**：变量、函数调用、算术运算。
- 点击示例上方的“查看 JS”，可以看到 JSX 被编译成了 `_jsx("h2", { children: book.title })` 这样的函数调用。
- 把鼠标停在第 11 行的 `App` 上：它的返回类型是 `React.JSX.Element`。
- `main.tsx` 找到页面上的 `#root` 元素，让 React 把 `<App />` 渲染进去。以后的示例都有这个文件，通常不需要修改。
:::

## JSX 和 HTML 的差别

JSX 看起来像 HTML，但有几条规则不同。从 HTML 复制过来的代码，常常要改这几处：

| HTML | JSX | 原因 |
| --- | --- | --- |
| `class="card"` | `className="card"` | JSX 的属性对应 DOM 属性，`class` 在 DOM 中叫 `className` |
| `<label for="email">` | `<label htmlFor="email">` | 同理，DOM 属性是 `htmlFor` |
| `style="color: gray"` | `style={{ color: 'gray' }}` | `style` 接收一个对象，属性名用驼峰：`fontSize`、`backgroundColor` |
| `onclick="…"`、`tabindex="0"` | `onClick={函数}`、`tabIndex={0}` | 属性名用驼峰；事件处理函数传**函数**，不传字符串（g03） |
| `<input>`、`<br>`、`<img>` | `<input />`、`<br />`、`<img />` | 每个标签都必须闭合，没有内容的标签用 `/>` 自闭合 |
| 多个并列的元素 | 用一个元素或 `<>…</>` 包起来 | 一个 JSX 表达式只能有一个根元素 |

`aria-*` 和 `data-*` 属性保持 HTML 的写法，例如 `aria-label="关闭"`。

最后一条的原因是：一个 JSX 表达式就是**一次**函数调用，返回**一个**值。需要返回几个并列的元素、又不想多加一层 `<div>` 时，用 **Fragment**：`<>` 和 `</>`。它在 DOM 中不产生任何元素。

TypeScript 能发现其中的大部分错误：写成 `class`，它会提示 “Did you mean 'className'?”；`style` 写成字符串，它会报告类型不匹配。

## 条件渲染

JSX 是表达式，所以可以存进变量、作为函数的返回值，也可以用运算符来选择：

- `条件 ? <A /> : <B />`：二选一；
- `条件 && <A />`：条件成立时显示，否则什么都不显示；
- 返回 `null`：什么都不渲染。`null`、`undefined`、`true`、`false` 渲染出来都是空的。

**陷阱：** `&&` 左边是数字 `0` 时，表达式的值就是 `0`，而 React 会把数字渲染出来。`{count && <p>有 {count} 条消息</p>}` 在 `count` 为 0 时，页面上会出现一个孤零零的 `0`。左边写成真正的布尔值：`count > 0 && …`。

:::playground{#conditional}
```tsx file=App.tsx
type Message = { from: string; text: string };

const inbox: Message[] = [];
const unread = 0;
const draft: string | null = '下周一开会';

function summary(messages: Message[]) {
  if (messages.length === 0) return <p>收件箱是空的。</p>;
  return <p>共有 {messages.length} 封邮件。</p>;
}

export function App() {
  const badge = unread > 0 ? <strong>{unread} 封未读</strong> : <span>没有未读邮件</span>;
  return (
    <>
      <h2>收件箱</h2>
      {summary(inbox)}
      {badge}
      {draft !== null && <p>草稿：{draft}</p>}
      <p>错误的写法：{unread && <span>{unread} 封未读</span>}</p>
      <p>正确的写法：{unread > 0 && <span>{unread} 封未读</span>}</p>
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
- 第 7–10 行：普通的函数也可以返回 JSX，用 `if` 提前返回不同的内容。
- 第 13 行：把 JSX 存进变量，再在第 18 行使用。
- 第 20 行显示了一个 `0`，第 21 行什么都不显示。把第 4 行的 `0` 改成 `3` 再运行，两行都会显示“3 封未读”。
- 第 15 和 22 行的 `<>`、`</>` 是 Fragment：页面上只有 `h2` 和几个 `p`，没有多出的包裹元素。
:::

## JSX 中的文字是安全的

花括号里的字符串会作为**文字**插入页面，React 会替你转义，效果和 `textContent` 一样（e12 讲过为什么这很重要）：

```tsx
const name = '<img src=x onerror=alert(1)>';
<p>你好，{name}</p>; // 页面上显示的就是这串字符，不会出现 img 元素
```

只有专门的 `dangerouslySetInnerHTML` 属性才会把字符串当作 HTML 插入。它的名字就是警告，本课程不会用到它。

## 拆分组件

组件让你给一块界面起个名字，在别处重复使用。几条约定：

- 组件名以**大写字母**开头。`<header>` 是 HTML 标签，`<Header>` 才是你的组件，React 靠首字母区分它们；
- 组件定义在模块的顶层，不要在另一个组件函数**内部**定义组件（每次渲染都会得到一个“新的”组件，React 会丢掉它的状态）；
- 一个组件可以在自己的 JSX 中使用其他组件，这样一层层组合出整个页面；常见的做法是每个组件一个文件，用 `export` 导出（a19）。

现在的组件还不能接收参数，每次显示的内容都一样。下一课讲 **props**：像给函数传参数一样，给组件传入数据。

::exercise{#fix-jsx}

## 编程挑战

::exercise{#order-summary}

::quiz

## 常见错误

- **从 HTML 复制过来不改属性**：`class`、`for`、`style="…"`、`onclick` 都要改成 JSX 的写法。TypeScript 会给出提示。
- **标签不闭合**：`<input>`、`<br>` 在 JSX 中必须写成 `<input />`、`<br />`。
- **返回多个并列的元素**：用一个父元素，或者用 `<>…</>` 包起来。
- **`{count && …}`**：`count` 为 0 时会显示 0。用 `count > 0 && …`。
- **组件名用小写字母开头**：`<header />` 会被当作 HTML 标签。

## 下一步

下一课讲 props：给组件传入数据和子元素，并用 TypeScript 描述组件接受的参数。
