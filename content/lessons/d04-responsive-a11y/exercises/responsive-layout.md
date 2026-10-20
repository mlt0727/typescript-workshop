---
kind: task
title: 移动优先的两栏布局
---
页面结构和基础样式（`base.css`）已经写好，只读。在 `style.css` 中完成响应式布局：

1. `.page` 最宽 **1000px**，屏幕更宽时在水平方向居中；
2. 图片（`.hero`）不能超出它所在的区域；
3. 页面宽度**小于 700px** 时，侧栏（`.sidebar`）排在主要内容（`.content`）的**下方**；**700px 及以上**时，侧栏在主要内容的**右侧**，宽 **250px**，与主要内容的间距 **24px**；
4. 任何宽度下，页面都不能出现横向滚动条。

请采用移动优先的写法：先写窄屏的样式，再用媒体查询为宽屏追加规则。测试会用 `page.viewport()` 在 375、699、700、1024、1200 像素宽度下检查布局。

:::files{role=support}
```html file=index.html readonly
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="./base.css" />
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <div class="page">
      <header><p class="logo">TS 工坊</p></header>
      <div class="layout">
        <main class="content">
          <h1>学习路线</h1>
          <p>从 JavaScript 共同语法出发，经过日常 TypeScript、浏览器与异步，最后完成三个项目。</p>
          <img
            class="hero"
            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='900' height='120'%3E%3Crect width='900' height='120' fill='%2393c5fd'/%3E%3C/svg%3E"
            alt="学习路线示意图"
          />
        </main>
        <aside class="sidebar">
          <h2>本周目标</h2>
          <p>完成 D 阶段的前四课。</p>
        </aside>
      </div>
    </div>
  </body>
</html>
```
```css file=base.css readonly
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; line-height: 1.6; }
.page { padding: 0 16px; }
.content { background: #f1f5f9; padding: 1rem; }
.sidebar { background: #fef3c7; padding: 1rem; }
```
:::

:::files{role=starter}
```css file=style.css
.page {
}

.hero {
}

.layout {
}
```
:::

:::files{role=solution}
```css file=style.css
.page {
  max-width: 1000px;
  margin-inline: auto;
}

.hero {
  display: block;
  max-width: 100%;
  height: auto;
}

.layout {
  display: grid;
  gap: 24px;
}

@media (width >= 700px) {
  .layout {
    grid-template-columns: 1fr 250px;
  }
}
```
:::

:::files{role=tests}
```ts file=responsive.test.ts
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

function box(selector: string): DOMRect {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`找不到 ${selector}`);
  return el.getBoundingClientRect();
}

test('页面最宽 1000px，宽屏上水平居中', async () => {
  await page.viewport(1200, 800);
  const p = box('.page');
  expect(p.width).toBeCloseTo(1000, 0);
  expect(p.left).toBeCloseTo(100, 0);
});

test.each([[375], [699], [700], [1024]])('页面宽 %i 像素时没有横向滚动条，图片不超出主要内容', async (width) => {
  await page.viewport(width, 800);
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
  expect(box('.hero').right).toBeLessThanOrEqual(box('.content').right + 0.5);
});

test.each([[375], [699]])('页面宽 %i 像素时，侧栏在主要内容下方', async (width) => {
  await page.viewport(width, 800);
  const main = box('.content');
  const side = box('.sidebar');
  expect(side.top, '侧栏应该在主要内容下方').toBeGreaterThanOrEqual(main.bottom);
  expect(Math.abs(side.left - main.left)).toBeLessThan(1);
});

test.each([[700], [1024]])('页面宽 %i 像素时，侧栏在右侧，宽 250px，间距 24px', async (width) => {
  await page.viewport(width, 800);
  const main = box('.content');
  const side = box('.sidebar');
  expect(Math.abs(side.top - main.top), '侧栏应该和主要内容在同一行').toBeLessThan(1);
  expect(side.width).toBeCloseTo(250, 0);
  expect(side.left - main.right).toBeCloseTo(24, 0);
});
```
:::

:::hint{level=1}
`.page` 用 `max-width` 加左右 `margin: auto` 居中；图片用 `max-width: 100%`。`.layout` 先写窄屏：一列（Grid 或者竖向的 Flex），然后在 `@media (width >= 700px)` 中改成两列。
:::

:::hint{level=2}
`.layout { display: grid; gap: 24px; }`，宽屏时 `grid-template-columns: 1fr 250px;`。注意断点：“700px 及以上”是 `width >= 700px`（或 `min-width: 700px`），写成 `width > 700px` 的话，恰好 700px 时还是窄屏布局。
:::

:::explanation
移动优先的好处是：基础规则就是最简单的单列布局，窄屏不需要任何媒体查询；宽屏只是在此基础上**追加**两列的规则。反过来先写桌面两列、再用 `max-width` 媒体查询“撤销”它，需要覆盖的规则更多，也更容易漏掉。

`max-width: 1000px` 加 `margin-inline: auto`（左右外边距自动）是让块级元素居中的经典写法：屏幕比 1000px 宽时，两侧平分剩余空间；比它窄时，`.page` 就是屏幕的宽度。

图片有自己的固有宽度（这里是 900px），不加 `max-width: 100%` 就会撑出横向滚动条。`height: auto` 保持图片的宽高比。

断点的边界值容易写错：`(width >= 700px)` 与 `(min-width: 700px)` 都包含 700px 本身；`(width > 700px)` 不包含。测试专门检查了 699 和 700 两个宽度。
:::

:::variant{kind=alt name=flex-and-min-width}
```css file=style.css
.page {
  max-width: 1000px;
  margin: 0 auto;
}

.hero {
  width: 100%;
  max-width: 100%;
  height: auto;
}

.layout {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

@media (min-width: 700px) {
  .layout {
    flex-direction: row;
  }

  .content {
    flex: 1;
    min-width: 0;
  }

  .sidebar {
    flex: 0 0 250px;
  }
}
```
:::

:::variant{kind=wrong name=fixed-width fails=tests reason="页面写死了 1000px 宽，窄屏上出现横向滚动条"}
```css file=style.css
.page {
  width: 1000px;
  margin-inline: auto;
}

.hero {
  display: block;
  max-width: 100%;
  height: auto;
}

.layout {
  display: grid;
  gap: 24px;
}

@media (width >= 700px) {
  .layout {
    grid-template-columns: 1fr 250px;
  }
}
```
:::

:::variant{kind=wrong name=image-overflow fails=tests reason="图片没有限制宽度，撑破了主要内容"}
```css file=style.css
.page {
  max-width: 1000px;
  margin-inline: auto;
}

.layout {
  display: grid;
  gap: 24px;
}

@media (width >= 700px) {
  .layout {
    grid-template-columns: 1fr 250px;
  }
}
```
:::

:::variant{kind=wrong name=off-by-one-breakpoint fails=tests reason="断点写成了 width > 700px，恰好 700px 时仍是窄屏布局"}
```css file=style.css
.page {
  max-width: 1000px;
  margin-inline: auto;
}

.hero {
  display: block;
  max-width: 100%;
  height: auto;
}

.layout {
  display: grid;
  gap: 24px;
}

@media (width > 700px) {
  .layout {
    grid-template-columns: 1fr 250px;
  }
}
```
:::

:::variant{kind=wrong name=always-two-columns fails=tests reason="没有媒体查询，窄屏上也是两栏"}
```css file=style.css
.page {
  max-width: 1000px;
  margin-inline: auto;
}

.hero {
  display: block;
  max-width: 100%;
  height: auto;
}

.layout {
  display: grid;
  grid-template-columns: 1fr 250px;
  gap: 24px;
}
```
:::
