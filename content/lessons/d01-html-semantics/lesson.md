---
version: 1
mode: dom
estimatedMinutes: 35
review: ai-draft
problem: 网页的内容写在 HTML 里。HTML 不只是“让东西显示出来”：每个元素都带着含义（语义），浏览器、屏幕阅读器、搜索引擎，以及本课程的测试，都依靠这些含义理解页面。全部用 div 也能做得“看起来一样”，但这样的按钮无法用键盘操作，导航无法被辅助技术找到，测试也无法按角色查询。这一课讲 HTML 文档的结构，以及怎样为内容选择正确的元素。
objectives:
  - 读懂 HTML 文档的基本结构：doctype、lang、head 中的 meta 与 title、body
  - 用 header、nav、main、article、section、aside、footer 和标题层级组织页面
  - 为内容选择语义正确的元素：button 与 a、列表、图片的替代文字
  - 知道元素的“角色”是什么，理解测试中的 getByRole 查询的是什么
references:
  - title: Structuring documents — MDN Learn web development
    url: https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content/Structuring_documents
    checked: 2026-10-20
  - title: HTML elements reference — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements
    checked: 2026-10-20
  - title: "HTML: A good basis for accessibility — MDN"
    url: https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Accessibility/HTML
    checked: 2026-10-20
  - title: HTML Accessibility API Mappings（HTML-AAM）— W3C
    url: https://www.w3.org/TR/html-aam-1.0/
    checked: 2026-10-20
  - title: ByRole — Testing Library
    url: https://testing-library.com/docs/queries/byrole/
    checked: 2026-10-20
---

## 一个 HTML 文档

HTML 文档由**元素**组成：`<p>文字</p>` 是一个段落元素，`<p>` 是开始标签，`</p>` 是结束标签。开始标签里可以写**属性**，例如 `<a href="#intro">` 中的 `href`。元素可以嵌套，整个文档是一棵树——之后用 TypeScript 操作的 DOM，就是浏览器根据这棵树建立的对象。

有些元素没有内容，也就没有结束标签，例如 `<img>`、`<input>`、`<meta>`、`<br>`（写成 `<img … />` 也可以，斜杠会被忽略）。

:::playground{#document}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>我的第一个页面</title>
  </head>
  <body>
    <h1>你好，HTML</h1>
    <p>这是一个<strong>段落</strong>。HTML 由<em>元素</em>组成，元素可以嵌套。</p>
    <img
      src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Ccircle cx='5' cy='5' r='5' fill='%2306c'/%3E%3C/svg%3E"
      alt="一个蓝色的圆"
      width="48"
      height="48"
    />
    <p>跳到<a href="#more">更多内容</a>。</p>
    <p id="more">这里是更多内容。</p>
  </body>
</html>
```
- 第 1 行：`<!doctype html>` 让浏览器按现代标准解析页面。缺少它，浏览器会进入兼容旧网页的“怪异模式”，一些布局规则会不同。
- 第 2 行：`lang="zh-CN"` 声明页面语言。屏幕阅读器据此选择发音，浏览器据此选择字体和断行规则。
- 第 3–7 行：`<head>` 里是关于页面的信息，不直接显示：字符编码、移动端视口设置、标签页标题。第 5 行的 viewport 让手机按设备宽度显示页面，而不是缩小一个桌面宽度的页面。
- 第 8 行起：`<body>` 是显示出来的内容。第 13 行的 `alt` 是图片的**替代文字**：图片加载失败或者用户看不见图片时，用它代替图片。
:::

HTML 的解析器很宽容：标签写错了通常不会报错，浏览器会按规则“修好”它，但修出来的结构未必是你想要的。之后可以用浏览器开发者工具的 Elements 面板查看浏览器实际建立的树。

## 语义：元素表达的含义

`<div>` 和 `<span>` 是**没有含义**的容器，只用来分组或加样式。其他元素都表达了某种含义：`<h1>` 是一级标题，`<ul>` 是列表，`<button>` 是按钮。浏览器会根据含义提供默认行为（按钮能获得焦点、能用键盘触发），并把每个元素的**角色**（role）告诉辅助技术，例如屏幕阅读器会读出“按钮，开始学习”。

描述页面整体结构的元素叫**地标**（landmark），屏幕阅读器用户可以在地标之间跳转：

| 元素 | 角色 | 用途 |
| --- | --- | --- |
| `<header>` | banner | 页面顶部：网站名称、导航等 |
| `<nav>` | navigation | 一组导航链接 |
| `<main>` | main | 页面的主要内容，每个页面一个 |
| `<aside>` | complementary | 与主要内容相关的旁注、侧栏 |
| `<footer>` | contentinfo | 页面底部：版权、联系方式等 |
| `<section>` | region（有名字时） | 一个有标题的主题区块 |
| `<article>` | article | 可以独立存在的内容，例如一篇文章、一条评论 |

两个细节：`<header>` 和 `<footer>` 只有直接属于页面（不在 `article`、`aside`、`main`、`nav`、`section` 之内）时才是 banner 和 contentinfo；写在一篇文章里时，它们只是这篇文章的头部和尾部。`<section>` 只有通过 `aria-labelledby` 或 `aria-label` 得到名字时，才是一个 region 地标。

**标题**（`<h1>`～`<h6>`）构成页面的大纲。一般每个页面一个 `<h1>`，下面依次是 `<h2>`、`<h3>`，不要为了字号大小跳级——大小交给 CSS。

:::playground{#landmarks}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <header>
      <p class="logo">TypeScript 工坊</p>
      <nav aria-label="主导航">
        <ul>
          <li><a href="#lessons">课程</a></li>
          <li><a href="#about">关于</a></li>
        </ul>
      </nav>
    </header>
    <main>
      <h1>学习路线</h1>
      <section id="lessons" aria-labelledby="lessons-title">
        <h2 id="lessons-title">课程</h2>
        <ol>
          <li>JavaScript 共同语法</li>
          <li>日常 TypeScript</li>
          <li>HTML、CSS 与 DOM</li>
        </ol>
      </section>
      <aside>
        <p>小提示：每课大约 30 分钟。</p>
      </aside>
    </main>
    <footer>
      <p id="about">内容以 CC BY 4.0 发布。</p>
    </footer>
  </body>
</html>
```
```css file=style.css
header, main, footer, aside, section { border: 1px dashed #999; margin: 6px; padding: 4px 8px; }
nav ul { display: flex; gap: 12px; list-style: none; padding: 0; }
```
- 虚线框标出了每个地标和区块。去掉 CSS，页面看起来就是普通的文字，但结构仍然在：屏幕阅读器可以直接跳到“主导航”或“课程”区块。
- 第 9 行：`aria-label` 给导航起了名字。页面上有多个导航时（例如顶部和底部各一个），名字能区分它们。
- 第 18 行：`aria-labelledby` 引用第 19 行标题的 `id`，让这个 `section` 以“课程”为名，成为一个 region 地标。
- 第 20 行：步骤有先后顺序，用有序列表 `<ol>`；没有顺序的一组东西用 `<ul>`。
:::

## 按钮还是链接

最常见的语义错误是用 `<div>` 做按钮。它看起来可以一样，但：

- `<div>` 不能用 Tab 键聚焦，也不能用 Enter 或空格触发；
- 它没有 button 角色，屏幕阅读器不知道它能点；
- 测试中的 `getByRole('button')` 找不到它。

选择的原则：**执行一个操作**（提交、打开对话框、切换状态）用 `<button>`；**去往一个地方**（另一个页面、页面中的某个位置）用带 `href` 的 `<a>`。表单外的按钮要写 `type="button"`：`<button>` 默认的 `type` 是 `submit`，放在表单里会提交表单（下一课详讲）。

:::playground{#button-vs-div}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <div class="fake-button" id="fake">假按钮（div）</div>
    <button type="button" id="real">真按钮（button）</button>
    <p>点击次数：<output id="count">0</output></p>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```css file=style.css
.fake-button, button { display: inline-block; padding: 6px 12px; border: 1px solid #555; border-radius: 4px; background: #eee; font: inherit; cursor: pointer; }
```
```ts file=main.ts
const count = document.querySelector('#count');
if (!(count instanceof HTMLOutputElement)) throw new Error('缺少 #count');

let clicks = 0;
for (const id of ['#fake', '#real']) {
  document.querySelector(id)?.addEventListener('click', () => {
    clicks++;
    count.textContent = String(clicks);
    console.log(`${id} 被触发`);
  });
}
```
- 用鼠标点击，两个“按钮”都会计数。
- 现在点一下预览区域，按 Tab 键：焦点会跳过 `div`，只落在真按钮上；按 Enter 或空格，真按钮被触发。`div` 用键盘完全无法使用。
- 第 6 行用了可选链 `?.`（a08）：找不到元素时直接跳过。这里只是演示，正式代码应该像第 2 行那样检查。
:::

## 角色与测试

浏览器根据元素和属性计算出每个元素的角色和**可访问名称**（accessible name，例如按钮上的文字、`aria-label`、图片的 `alt`），组成一棵“可访问性树”交给辅助技术。在开发者工具的 Accessibility 面板中可以看到它。

本课程的 DOM 测试使用 Testing Library，它推荐的查询方式正是按角色和名称查找：

```ts
screen.getByRole('button', { name: '开始学习' });
screen.getByRole('heading', { level: 2, name: '课程' });
screen.getByRole('navigation', { name: '主导航' });
```

这样写的测试和用户的感知一致：用户看到（或听到）的是“一个叫开始学习的按钮”，而不是 `.btn-primary` 这个 class。语义写对了，测试自然容易写；用 `div` 拼出来的页面，这些查询全都会失败。

::exercise{#semantic-page}

## 编程挑战

::exercise{#recipe}

::quiz

## 常见错误

- **用 `div` 或 `span` 做按钮、链接**：键盘无法使用，没有角色。用 `<button>` 或 `<a href>`。
- **为了字号选择标题级别**：标题级别表达结构，字号用 CSS 控制。
- **图片没有 `alt`**：有意义的图片写出描述；纯装饰的图片写 `alt=""`，屏幕阅读器会跳过它。
- **整页只有 `div`**：至少要有 `header`、`main`、`footer`，导航放进 `nav`。

## 下一步

下一课讲表单：输入框、标签（label）、按钮的 type，以及浏览器自带的表单验证。
