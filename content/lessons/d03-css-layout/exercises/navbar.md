---
kind: task
title: 导航栏布局
---
页面结构和基础样式（`base.css`）都已经写好，只读。在 `style.css` 中完成导航栏的布局：

1. 网站名称（`.logo`）和导航（`nav`）在**同一行**：网站名称靠左，导航靠右；
2. 网站名称的字比导航链接大，两者在**垂直方向居中对齐**；
3. 三个导航链接排成一行，相邻两个之间的间距是 **16px**。

不要修改 `.site-header` 的内边距（`base.css` 中是左右 16px）。测试会在 1024 像素宽的页面上检查各元素的实际位置。

:::files{role=support}
```html file=index.html readonly
<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="./base.css" />
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <header class="site-header">
      <a class="logo" href="#home">TS 工坊</a>
      <nav aria-label="主导航">
        <ul class="links">
          <li><a href="#lessons">课程</a></li>
          <li><a href="#projects">项目</a></li>
          <li><a href="#about">关于</a></li>
        </ul>
      </nav>
    </header>
    <main><p>正文内容</p></main>
  </body>
</html>
```
```css file=base.css readonly
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; }
.site-header { padding: 8px 16px; background: #1e293b; }
.site-header a { color: white; text-decoration: none; }
.logo { font-size: 1.6rem; font-weight: bold; }
.links { margin: 0; padding: 0; list-style: none; }
```
:::

:::files{role=starter}
```css file=style.css
.site-header {
}

.links {
}
```
:::

:::files{role=solution}
```css file=style.css
.site-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.links {
  display: flex;
  gap: 16px;
}
```
:::

:::files{role=tests}
```ts file=layout.test.ts
import { expect, test } from 'vitest';
import { screen } from '@testing-library/dom';

function rect(el: Element): DOMRect {
  return el.getBoundingClientRect();
}

function parts() {
  const header = document.querySelector('.site-header');
  const logo = document.querySelector('.logo');
  if (!header || !logo) throw new Error('页面结构不完整');
  const nav = screen.getByRole('navigation');
  const links = ['课程', '项目', '关于'].map((name) => screen.getByRole('link', { name }));
  return { header, logo, nav, links };
}

const centerY = (r: DOMRect) => r.top + r.height / 2;

test('网站名称和导航在同一行：名称靠左，导航靠右', () => {
  const { header, logo, nav } = parts();
  const h = rect(header);
  const l = rect(logo);
  const n = rect(nav);
  expect(n.left, '导航应该在网站名称的右边').toBeGreaterThan(l.right);
  expect(Math.abs(l.left - (h.left + 16)), '网站名称应该紧贴左侧内边距').toBeLessThan(1);
  expect(Math.abs(n.right - (h.right - 16)), '导航应该紧贴右侧内边距').toBeLessThan(1);
});

test('网站名称和导航链接在垂直方向居中对齐', () => {
  const { logo, links } = parts();
  const [first] = links;
  if (!first) throw new Error('缺少链接');
  expect(rect(logo).height, '网站名称的字更大，盒子应该更高').toBeGreaterThan(rect(first).height);
  // 链接是行内元素，它的盒子高度取决于字体的上下伸部，不同浏览器、字体会有 1 像素左右的差别
  expect(Math.abs(centerY(rect(logo)) - centerY(rect(first)))).toBeLessThan(2);
});

test('三个链接排成一行，间距 16px', () => {
  const { nav, links } = parts();
  const boxes = links.map(rect);
  const last = boxes.at(-1);
  if (!last) throw new Error('缺少链接');
  expect(Math.abs(last.right - rect(nav).right), '最后一个链接后面不应该有多余的空白').toBeLessThan(1);
  for (let i = 1; i < boxes.length; i++) {
    const prev = boxes[i - 1];
    const cur = boxes[i];
    if (!prev || !cur) throw new Error('缺少链接');
    expect(Math.abs(cur.top - prev.top), '链接应该在同一行').toBeLessThan(1);
    expect(Math.abs(cur.left - prev.right - 16), '相邻链接的间距').toBeLessThan(1);
  }
});
```
:::

:::hint{level=1}
两处都需要 `display: flex`：`.site-header` 让网站名称和导航排成一行，`.links` 让三个 `li` 排成一行。剩下的问题是“一个靠左一个靠右”（主轴上怎么分布）和“垂直居中”（交叉轴上怎么对齐）。
:::

:::hint{level=2}
`.site-header`：`display: flex; justify-content: space-between; align-items: center;`。`.links`：`display: flex; gap: 16px;`。
:::

:::explanation
`.site-header` 是弹性容器，它的两个直接子元素（`.logo` 和 `nav`）沿主轴排成一行。`justify-content: space-between` 把剩余空间都放在两个项目之间，于是一个贴左、一个贴右；也可以给 `nav` 写 `margin-left: auto` 达到同样的效果。

`align-items` 的默认值是 `stretch`：两个项目被拉伸到同样的高度，`nav` 的盒子虽然和网站名称一样高，但里面的链接贴在顶部，看起来没有对齐。改成 `center` 后，两个项目各自保持内容的高度，并在交叉轴上居中。

`.links` 是另一个弹性容器（`ul` 的直接子元素是三个 `li`）。`gap: 16px` 只加在项目之间，第一个之前和最后一个之后都没有，这正是用 margin 难以做到的。
:::

:::variant{kind=alt name=margin-auto-and-grid}
```css file=style.css
.site-header {
  display: flex;
  align-items: center;
}

nav {
  margin-left: auto;
}

.links {
  display: grid;
  grid-auto-flow: column;
  column-gap: 16px;
}
```
:::

:::variant{kind=wrong name=no-header-flex fails=tests reason="只把链接排成了一行，网站名称和导航仍然上下排列"}
```css file=style.css
.site-header {
  text-align: right;
}

.links {
  display: flex;
  gap: 16px;
}
```
:::

:::variant{kind=wrong name=no-space-between fails=tests reason="没有把导航推到右边，它紧挨着网站名称"}
```css file=style.css
.site-header {
  display: flex;
  align-items: center;
  gap: 24px;
}

.links {
  display: flex;
  gap: 16px;
}
```
:::

:::variant{kind=wrong name=default-stretch fails=tests reason="没有设置 align-items，项目被拉伸，链接贴在顶部"}
```css file=style.css
.site-header {
  display: flex;
  justify-content: space-between;
}

.links {
  display: flex;
  gap: 16px;
}
```
:::

:::variant{kind=wrong name=margin-gap fails=tests reason="用 margin 制造间距，最后一个链接右边多出了 16px"}
```css file=style.css
.site-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.links {
  display: flex;
}

.links li {
  margin-right: 16px;
}
```
:::
