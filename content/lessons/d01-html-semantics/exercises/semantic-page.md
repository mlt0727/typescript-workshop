---
kind: task
title: 把 div 改成有语义的结构
---
下面的页面全部用 `div` 写成，看起来没问题，但没有任何结构信息。改写 `index.html`：

1. 页面语言是简体中文（`zh-CN`）；
2. 页面顶部是 `header`，网站名称“TypeScript 工坊”是页面唯一的一级标题；
3. 导航放在 `nav` 中（`nav` 在顶部的 `header` 里），三个链接放在一个列表中，链接文字和地址不变；
4. 主要内容放在 `main` 中：文章是一个 `article`，标题是二级标题，两段文字是段落；
5. “开始学习”是一个 `type="button"` 的按钮，放在文章末尾；
6. 版权信息放在页面底部的 `footer` 中。

保留原来的 `class`，样式表（只读）就会继续生效。本题不需要写 TypeScript。

:::files{role=support}
```css file=style.css readonly
body { font-family: system-ui, sans-serif; margin: 0 16px; }
.header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; border-bottom: 1px solid #ccc; }
.title { font-size: 1.4rem; margin: 8px 0; }
.nav ul { display: flex; gap: 12px; list-style: none; padding: 0; }
.post-title { font-size: 1.2rem; }
.button { padding: 6px 12px; font: inherit; }
.footer { margin-top: 16px; color: #666; }
```
:::

:::files{role=starter}
```html file=index.html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>TypeScript 工坊</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <div class="header">
      <div class="title">TypeScript 工坊</div>
      <div class="nav">
        <a href="#home">首页</a>
        <a href="#lessons">课程</a>
        <a href="#about">关于</a>
      </div>
    </div>
    <div class="content">
      <div class="post">
        <div class="post-title">第一课：变量与常量</div>
        <div>不会重新赋值的变量用 const 声明。</div>
        <div>需要重新赋值时，用 let。</div>
        <div class="button">开始学习</div>
      </div>
    </div>
    <div class="footer">© 2026 TypeScript 工坊</div>
  </body>
</html>
```
:::

:::files{role=solution}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>TypeScript 工坊</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <header class="header">
      <h1 class="title">TypeScript 工坊</h1>
      <nav class="nav">
        <ul>
          <li><a href="#home">首页</a></li>
          <li><a href="#lessons">课程</a></li>
          <li><a href="#about">关于</a></li>
        </ul>
      </nav>
    </header>
    <main class="content">
      <article class="post">
        <h2 class="post-title">第一课：变量与常量</h2>
        <p>不会重新赋值的变量用 const 声明。</p>
        <p>需要重新赋值时，用 let。</p>
        <button type="button" class="button">开始学习</button>
      </article>
    </main>
    <footer class="footer">© 2026 TypeScript 工坊</footer>
  </body>
</html>
```
:::

:::files{role=tests}
```ts file=page.test.ts
import { expect, test } from 'vitest';
import { screen, within } from '@testing-library/dom';

// header/footer 只有不在 article、aside、main、nav、section 之内时，才是页面级的 banner/contentinfo
function pageLandmark(role: 'banner' | 'contentinfo'): HTMLElement {
  const found = screen.queryAllByRole(role).filter((el) => !el.parentElement?.closest('article, aside, main, nav, section'));
  expect(found, `页面级的 ${role} 应该恰好有一个`).toHaveLength(1);
  const [el] = found;
  if (!el) throw new Error(`找不到页面级的 ${role}`);
  return el;
}

test('页面语言是简体中文', () => {
  expect(document.documentElement).toHaveAttribute('lang', 'zh-CN');
});

test('顶部 header 中的网站名称是唯一的一级标题', () => {
  const banner = pageLandmark('banner');
  within(banner).getByRole('heading', { level: 1, name: 'TypeScript 工坊' });
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
});

test('导航在顶部的 header 里，链接放在列表中', () => {
  const nav = screen.getByRole('navigation');
  expect(pageLandmark('banner')).toContainElement(nav);
  within(nav).getByRole('list');
  const links = within(nav)
    .getAllByRole('listitem')
    .map((item) => within(item).getByRole('link'));
  expect(within(nav).getAllByRole('link'), '导航中的链接都应该在列表里').toHaveLength(links.length);
  expect(links.map((a) => a.textContent)).toEqual(['首页', '课程', '关于']);
  expect(links.map((a) => a.getAttribute('href'))).toEqual(['#home', '#lessons', '#about']);
});

test('文章在 main 中，标题是二级标题，正文是两个段落', () => {
  const article = within(screen.getByRole('main')).getByRole('article');
  within(article).getByRole('heading', { level: 2, name: '第一课：变量与常量' });
  const paragraphs = within(article).getAllByRole('paragraph');
  expect(paragraphs.map((p) => p.textContent)).toEqual(['不会重新赋值的变量用 const 声明。', '需要重新赋值时，用 let。']);
});

test('“开始学习”是文章末尾的真按钮', () => {
  const button = screen.getByRole('button', { name: '开始学习' });
  expect(button).toHaveAttribute('type', 'button');
  const article = within(screen.getByRole('main')).getByRole('article');
  expect(article).toContainElement(button);
  for (const p of within(article).getAllByRole('paragraph')) {
    // 按钮在每个段落之后
    expect(p.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  }
});

test('版权信息在页面底部的 footer 中', () => {
  expect(pageLandmark('contentinfo')).toHaveTextContent('© 2026 TypeScript 工坊');
});
```
:::

:::hint{level=1}
先搭骨架：`header`（网站名称 + `nav`）、`main`（里面一个 `article`）、`footer`。把 `<div class="header">` 改成 `<header class="header">`，其他同理，保留 `class`，样式就不受影响。
:::

:::hint{level=2}
网站名称用 `<h1>`，文章标题用 `<h2>`，两段文字用 `<p>`。链接放进 `<ul>`，每个链接外面套一个 `<li>`。“开始学习”写成 `<button type="button" class="button">开始学习</button>`。最后把第 2 行的 `lang="en"` 改成 `lang="zh-CN"`。
:::

:::explanation
改写之后，页面的外观几乎没有变化，但结构信息完全不同了：

- `header`、`nav`、`main`、`footer` 是地标，屏幕阅读器用户可以直接跳到导航或主要内容；
- 标题层级（一级的网站名称、二级的文章标题）构成了页面大纲；
- 链接放在列表里，屏幕阅读器会读出“列表，3 项”，用户知道导航有多少个选项；
- `<button>` 可以用 Tab 聚焦、用 Enter 或空格触发，`div` 都做不到。

测试也因此变得简单：每个检查都是“找一个叫某某的按钮”“在导航里找列表”这样的角色查询，和用户感知页面的方式一致。

`lang` 看起来是个小细节，但它决定了屏幕阅读器用什么语言朗读页面：`lang="en"` 的中文页面会被按英文规则读出来。
:::

:::variant{kind=alt name=extra-wrappers}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>TypeScript 工坊</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <div class="page">
      <header class="header">
        <h1 class="title">TypeScript 工坊</h1>
        <nav class="nav" aria-label="主导航">
          <ul>
            <li><a href="#home">首页</a></li>
            <li><a href="#lessons">课程</a></li>
            <li><a href="#about">关于</a></li>
          </ul>
        </nav>
      </header>
      <main class="content">
        <article class="post">
          <header>
            <h2 class="post-title">第一课：变量与常量</h2>
          </header>
          <p>不会重新赋值的变量用 const 声明。</p>
          <p>需要重新赋值时，用 let。</p>
          <footer>
            <button type="button" class="button">开始学习</button>
          </footer>
        </article>
      </main>
      <footer class="footer">
        <p>© 2026 TypeScript 工坊</p>
      </footer>
    </div>
  </body>
</html>
```
:::

:::variant{kind=wrong name=div-button fails=tests reason="“开始学习”仍然是 div，不是按钮"}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>TypeScript 工坊</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <header class="header">
      <h1 class="title">TypeScript 工坊</h1>
      <nav class="nav">
        <ul>
          <li><a href="#home">首页</a></li>
          <li><a href="#lessons">课程</a></li>
          <li><a href="#about">关于</a></li>
        </ul>
      </nav>
    </header>
    <main class="content">
      <article class="post">
        <h2 class="post-title">第一课：变量与常量</h2>
        <p>不会重新赋值的变量用 const 声明。</p>
        <p>需要重新赋值时，用 let。</p>
        <div class="button">开始学习</div>
      </article>
    </main>
    <footer class="footer">© 2026 TypeScript 工坊</footer>
  </body>
</html>
```
:::

:::variant{kind=wrong name=links-without-list fails=tests reason="导航链接没有放进列表"}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>TypeScript 工坊</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <header class="header">
      <h1 class="title">TypeScript 工坊</h1>
      <nav class="nav">
        <a href="#home">首页</a>
        <a href="#lessons">课程</a>
        <a href="#about">关于</a>
      </nav>
    </header>
    <main class="content">
      <article class="post">
        <h2 class="post-title">第一课：变量与常量</h2>
        <p>不会重新赋值的变量用 const 声明。</p>
        <p>需要重新赋值时，用 let。</p>
        <button type="button" class="button">开始学习</button>
      </article>
    </main>
    <footer class="footer">© 2026 TypeScript 工坊</footer>
  </body>
</html>
```
:::

:::variant{kind=wrong name=two-h1 fails=tests reason="文章标题也用了 h1，页面有两个一级标题"}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>TypeScript 工坊</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <header class="header">
      <h1 class="title">TypeScript 工坊</h1>
      <nav class="nav">
        <ul>
          <li><a href="#home">首页</a></li>
          <li><a href="#lessons">课程</a></li>
          <li><a href="#about">关于</a></li>
        </ul>
      </nav>
    </header>
    <main class="content">
      <article class="post">
        <h1 class="post-title">第一课：变量与常量</h1>
        <p>不会重新赋值的变量用 const 声明。</p>
        <p>需要重新赋值时，用 let。</p>
        <button type="button" class="button">开始学习</button>
      </article>
    </main>
    <footer class="footer">© 2026 TypeScript 工坊</footer>
  </body>
</html>
```
:::

:::variant{kind=wrong name=footer-in-main fails=tests reason="footer 放在了 main 里，不再是页面级的 contentinfo"}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>TypeScript 工坊</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <header class="header">
      <h1 class="title">TypeScript 工坊</h1>
      <nav class="nav">
        <ul>
          <li><a href="#home">首页</a></li>
          <li><a href="#lessons">课程</a></li>
          <li><a href="#about">关于</a></li>
        </ul>
      </nav>
    </header>
    <main class="content">
      <article class="post">
        <h2 class="post-title">第一课：变量与常量</h2>
        <p>不会重新赋值的变量用 const 声明。</p>
        <p>需要重新赋值时，用 let。</p>
        <button type="button" class="button">开始学习</button>
      </article>
      <footer class="footer">© 2026 TypeScript 工坊</footer>
    </main>
  </body>
</html>
```
:::
