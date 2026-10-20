---
kind: challenge
title: 自适应的卡片网格
---
课程目录里有 6 张卡片。在 `style.css` 中为 `.cards` 写布局，规则是：

1. 每张卡片至少 **210px** 宽；在这个前提下，一行放尽可能多的卡片；
2. 同一行的卡片平分整行的宽度（左右两端都贴齐容器），而且**所有**卡片一样宽（最后一行也是）；
3. 卡片之间的行间距和列间距都是 **16px**；
4. 同一行的卡片一样高，即使文字长短不同。

按 `base.css` 中容器的宽度，页面宽 1024、900、800、600、375 像素时，一行分别应该放 4、3、3、2、1 张卡片。测试会用 `page.viewport()` 切换这几种宽度，检查卡片的实际位置。

:::files{role=support}
```html file=index.html readonly
<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="./base.css" />
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main class="catalog">
      <h1>课程目录</h1>
      <div class="cards">
        <article class="card"><h2>变量</h2><p>let 与 const。</p></article>
        <article class="card"><h2>函数</h2><p>参数、返回值、默认参数、剩余参数和箭头函数，以及函数作为值传来传去。</p></article>
        <article class="card"><h2>数组</h2><p>下标、长度和常用方法。</p></article>
        <article class="card"><h2>对象</h2><p>属性、引用与拷贝。</p></article>
        <article class="card"><h2>模块</h2><p>import 与 export，把代码拆分到多个文件，并控制哪些内容对外可见。</p></article>
        <article class="card"><h2>错误</h2><p>throw 与 try/catch。</p></article>
      </div>
    </main>
  </body>
</html>
```
```css file=base.css readonly
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; }
.catalog { max-width: 960px; margin: 0 auto; padding: 0 16px; }
.card { padding: 12px; background: #e0f2fe; border-radius: 6px; }
.card h2 { margin: 0 0 4px; font-size: 1.1rem; }
.card p { margin: 0; }
```
:::

:::files{role=starter}
```css file=style.css
.cards {
}
```
:::

:::files{role=solution}
```css file=style.css
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 16px;
}
```
:::

:::files{role=tests}
```ts file=grid.test.ts
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

function cards(): DOMRect[] {
  return [...document.querySelectorAll('.card')].map((el) => el.getBoundingClientRect());
}

function container(): DOMRect {
  const el = document.querySelector('.cards');
  if (!el) throw new Error('找不到 .cards');
  return el.getBoundingClientRect();
}

/** 按 top 把卡片分成若干行 */
function rows(rects: DOMRect[]): DOMRect[][] {
  const result: DOMRect[][] = [];
  for (const r of rects) {
    const row = result.find((group) => group[0] !== undefined && Math.abs(group[0].top - r.top) < 1);
    if (row) row.push(r);
    else result.push([r]);
  }
  return result;
}

test.each([
  [1024, 4],
  [900, 3],
  [800, 3],
  [600, 2],
  [375, 1],
])('页面宽 %i 像素时，一行放 %i 张卡片', async (width, perRow) => {
  await page.viewport(width, 1200);
  const all = rows(cards());
  expect(all[0]?.length).toBe(perRow);
  expect(all.length).toBe(Math.ceil(6 / perRow));
});

test.each([[1024], [600]])('页面宽 %i 像素时，卡片一样宽，并铺满整行', async (width) => {
  await page.viewport(width, 1200);
  const rects = cards();
  const [first] = rects;
  if (!first) throw new Error('没有卡片');
  for (const r of rects) expect(Math.abs(r.width - first.width), '所有卡片应该一样宽').toBeLessThan(1);
  const firstRow = rows(rects)[0] ?? [];
  const last = firstRow.at(-1);
  if (!last) throw new Error('没有卡片');
  expect(Math.abs(first.left - container().left), '第一张卡片贴齐容器左边').toBeLessThan(1);
  expect(Math.abs(last.right - container().right), '一行的最后一张卡片贴齐容器右边').toBeLessThan(1);
});

test('行间距和列间距都是 16px', async () => {
  await page.viewport(1024, 1200);
  const [row1, row2] = rows(cards());
  const [a, b] = row1 ?? [];
  const [below] = row2 ?? [];
  if (!a || !b || !below) throw new Error('卡片的行列不对');
  expect(b.left - a.right).toBeCloseTo(16, 0);
  expect(below.top - a.bottom).toBeCloseTo(16, 0);
});

test('同一行的卡片一样高', async () => {
  await page.viewport(1024, 1200);
  for (const row of rows(cards())) {
    const heights = row.map((r) => r.height);
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1);
  }
});
```
:::

:::hint{level=1}
这正是 Grid 的 `repeat(auto-fill, minmax(最小宽度, 1fr))` 要解决的问题：每列至少多宽、能放几列就放几列、剩余空间平均分配。行列间距用 `gap`。
:::

:::hint{level=2}
`.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 16px; }`。同一行等高是 Grid 的默认行为（`align-items` 默认是 `stretch`），不需要额外设置。
:::

:::explanation
`repeat(auto-fill, minmax(210px, 1fr))` 一行代码表达了全部规则：

- `minmax(210px, 1fr)`：每列最窄 210px，最宽 `1fr`（平分剩余空间）；
- `auto-fill`：在不违反最小宽度的前提下，放尽可能多的列。容器内容宽 928px 时，4 列至少需要 4×210 + 3×16 = 888px，放得下；5 列需要 1114px，放不下，所以是 4 列。容器变窄，列数自动减少。

因为所有卡片都放在同样宽的列里，最后一行即使只有两张，宽度也和其他行一样。如果用 Flexbox 的 `flex-wrap` 加 `flex: 1`，最后一行的卡片会被拉宽去填满整行，宽度就不一致了——这是 Grid 的“二维”优势：列在所有行之间是对齐的。

同一行的格子默认一样高（拉伸到这一行最高的内容），所以文字长短不同的卡片也整整齐齐。
:::

:::variant{kind=alt name=media-queries}
```css file=style.css
.cards {
  display: grid;
  gap: 16px;
  grid-template-columns: 1fr;
}

@media (min-width: 468px) {
  .cards { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 694px) {
  .cards { grid-template-columns: repeat(3, 1fr); }
}

@media (min-width: 920px) {
  .cards { grid-template-columns: repeat(4, 1fr); }
}
```
:::

:::variant{kind=wrong name=fixed-columns fails=tests reason="固定 4 列，窄屏上卡片被挤得比 210px 还窄"}
```css file=style.css
.cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
```
:::

:::variant{kind=wrong name=flex-wrap-grow fails=tests reason="用 flex-wrap 加 flex: 1，最后一行的卡片被拉宽，宽度不一致"}
```css file=style.css
.cards {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.card {
  flex: 1 1 210px;
}
```
:::

:::variant{kind=wrong name=no-gap fails=tests reason="没有设置间距"}
```css file=style.css
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
}
```
:::

:::variant{kind=wrong name=align-start fails=tests reason="align-items: start 让卡片按内容决定高度，同一行高低不齐"}
```css file=style.css
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 16px;
  align-items: start;
}
```
:::
