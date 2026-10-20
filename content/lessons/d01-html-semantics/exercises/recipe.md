---
kind: challenge
title: 一份有结构的菜谱
---
起始页面把一份菜谱的内容平铺成了一串 `div`。把它整理成有语义的结构（文字内容不变）：

1. 所有内容放在 `main` 中，菜名“番茄炒蛋”是页面唯一的一级标题；
2. 第一张图片是成品照片，要有替代文字，内容包含“番茄炒蛋”；第二张图片只是装饰用的分隔线，应该被屏幕阅读器跳过；
3. “配料”和“步骤”各是一个区块，区块的名字与它的二级标题相同（最好用 `aria-labelledby` 引用标题）；
4. 配料是无序列表（4 项）；步骤是有序列表（3 项，顺序不变）；
5. “小贴士”是一个与正文相关的旁注（页面中的 complementary 地标）；
6. “加入收藏”是一个按钮（这里不需要它做任何事）。

测试会按角色和名称检查页面，例如“名叫‘配料’的区块里有一个列表”。本题不需要写 TypeScript。

:::files{role=support}
```css file=style.css readonly
body { font-family: system-ui, sans-serif; margin: 0 16px; }
img { display: block; margin: 8px 0; }
.divider { width: 100%; height: 4px; }
aside { border-left: 4px solid #f0b400; padding-left: 8px; }
```
:::

:::files{role=starter}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>番茄炒蛋</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <div>番茄炒蛋</div>
    <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 24'%3E%3Ccircle cx='14' cy='12' r='10' fill='%23e53935'/%3E%3Cellipse cx='28' cy='13' rx='9' ry='7' fill='%23fdd835'/%3E%3C/svg%3E" width="120" height="72" />
    <img class="divider" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 4'%3E%3Cpath d='M0 2h100' stroke='%23999' stroke-dasharray='4 3'/%3E%3C/svg%3E" />
    <div>配料</div>
    <div>番茄 2 个</div>
    <div>鸡蛋 3 个</div>
    <div>盐 少许</div>
    <div>葱花 少许</div>
    <div>步骤</div>
    <div>鸡蛋打散，炒到凝固后盛出。</div>
    <div>番茄切块，炒出汁水。</div>
    <div>倒回鸡蛋，加盐和葱花，翻炒均匀。</div>
    <div>小贴士：先炒蛋再炒番茄，蛋会更嫩。</div>
    <div>加入收藏</div>
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
    <title>番茄炒蛋</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main>
      <h1>番茄炒蛋</h1>
      <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 24'%3E%3Ccircle cx='14' cy='12' r='10' fill='%23e53935'/%3E%3Cellipse cx='28' cy='13' rx='9' ry='7' fill='%23fdd835'/%3E%3C/svg%3E" width="120" height="72" alt="一盘番茄炒蛋" />
      <img class="divider" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 4'%3E%3Cpath d='M0 2h100' stroke='%23999' stroke-dasharray='4 3'/%3E%3C/svg%3E" alt="" />

      <section aria-labelledby="ingredients-title">
        <h2 id="ingredients-title">配料</h2>
        <ul>
          <li>番茄 2 个</li>
          <li>鸡蛋 3 个</li>
          <li>盐 少许</li>
          <li>葱花 少许</li>
        </ul>
      </section>

      <section aria-labelledby="steps-title">
        <h2 id="steps-title">步骤</h2>
        <ol>
          <li>鸡蛋打散，炒到凝固后盛出。</li>
          <li>番茄切块，炒出汁水。</li>
          <li>倒回鸡蛋，加盐和葱花，翻炒均匀。</li>
        </ol>
      </section>

      <aside>
        <p>小贴士：先炒蛋再炒番茄，蛋会更嫩。</p>
      </aside>

      <button type="button">加入收藏</button>
    </main>
  </body>
</html>
```
:::

:::files{role=tests}
```ts file=page.test.ts
import { expect, test } from 'vitest';
import { screen, within } from '@testing-library/dom';

function textsOf(elements: HTMLElement[]): string[] {
  return elements.map((el) => (el.textContent ?? '').trim());
}

test('所有内容在 main 中，菜名是唯一的一级标题', () => {
  const main = screen.getByRole('main');
  expect(main).toContainElement(screen.getByRole('heading', { level: 1, name: '番茄炒蛋' }));
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(main).toContainElement(screen.getByRole('button', { name: '加入收藏' }));
  for (const img of document.querySelectorAll('img')) expect(main).toContainElement(img);
  for (const name of ['配料', '步骤']) expect(main).toContainElement(screen.getByRole('region', { name }));
  expect(main).toContainElement(screen.getByText(/先炒蛋再炒番茄/));
});

test('成品照片有替代文字，装饰图片被跳过', () => {
  expect(document.querySelectorAll('img')).toHaveLength(2);
  const images = screen.getAllByRole('img');
  expect(images).toHaveLength(1);
  expect(screen.getByRole('img', { name: /番茄炒蛋/ })).not.toHaveClass('divider');
});

test('配料是一个以二级标题命名的区块，里面是无序列表', () => {
  const region = screen.getByRole('region', { name: '配料' });
  within(region).getByRole('heading', { level: 2, name: '配料' });
  const list = within(region).getByRole('list');
  expect(list.tagName).toBe('UL');
  expect(textsOf(within(list).getAllByRole('listitem'))).toEqual(['番茄 2 个', '鸡蛋 3 个', '盐 少许', '葱花 少许']);
});

test('步骤是一个以二级标题命名的区块，里面是有序列表', () => {
  const region = screen.getByRole('region', { name: '步骤' });
  within(region).getByRole('heading', { level: 2, name: '步骤' });
  const list = within(region).getByRole('list');
  expect(list.tagName).toBe('OL');
  expect(textsOf(within(list).getAllByRole('listitem'))).toEqual([
    '鸡蛋打散，炒到凝固后盛出。',
    '番茄切块，炒出汁水。',
    '倒回鸡蛋，加盐和葱花，翻炒均匀。',
  ]);
});

test('小贴士是旁注', () => {
  // aside 放在 article、section 等区块中、又没有名字时，浏览器不把它当作地标
  const asides = screen
    .getAllByRole('complementary')
    .filter((el) => el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby') || !el.parentElement?.closest('article, aside, nav, section'));
  expect(asides).toHaveLength(1);
  expect(asides[0]).toHaveTextContent('先炒蛋再炒番茄，蛋会更嫩');
});

test('加入收藏是按钮', () => {
  expect(screen.getByRole('button', { name: '加入收藏' }).tagName).toBe('BUTTON');
});
```
:::

:::hint{level=1}
区块用 `<section>`，并用 `aria-labelledby` 指向它的 `<h2>` 的 `id`，这样区块才有名字、才是一个 region。有顺序的步骤用 `<ol>`，配料用 `<ul>`。旁注用 `<aside>`。
:::

:::hint{level=2}
成品照片加上 `alt="一盘番茄炒蛋"`；装饰性的分隔线加上 `alt=""`（空字符串，不是省略 `alt`）。按钮写成 `<button type="button">加入收藏</button>`。最后把所有内容放进 `<main>`。
:::

:::explanation
这道题的几个要点：

- **区块的名字**：`<section>` 本身只是一个普通的分组，只有通过 `aria-labelledby`（或 `aria-label`）得到名字后，才是一个 region 地标。引用标题的 `id`，名字就和屏幕上看到的标题一致，修改标题时也不用同步修改别处。
- **列表的类型**：`<ul>` 和 `<ol>` 的角色都是 list，区别在于含义：步骤的顺序很重要，用 `<ol>`，浏览器还会自动编号；配料没有顺序，用 `<ul>`。
- **图片的替代文字**：有内容的图片要描述它传达的信息；纯装饰的图片写 `alt=""`，它的角色变成 presentation，屏幕阅读器会跳过它。完全省略 `alt` 是另一回事：屏幕阅读器不知道它是装饰，可能读出文件名（这里是一长串 data URL），也可能只读出“图片”“未标记的图形”，用户无从得知图片的内容。
- **旁注**：`<aside>` 表示和正文相关但可以独立出来的内容，例如小贴士、相关链接。

测试中的 `getByRole('region', { name: '配料' })` 正是屏幕阅读器用户的视角：“跳到名叫‘配料’的区块”。
:::

:::variant{kind=alt name=aria-label-and-figure}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>番茄炒蛋</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main>
      <article>
        <h1>番茄炒蛋</h1>
        <figure>
          <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 24'%3E%3Ccircle cx='14' cy='12' r='10' fill='%23e53935'/%3E%3Cellipse cx='28' cy='13' rx='9' ry='7' fill='%23fdd835'/%3E%3C/svg%3E" width="120" height="72" alt="番茄炒蛋成品" />
        </figure>
        <img class="divider" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 4'%3E%3Cpath d='M0 2h100' stroke='%23999' stroke-dasharray='4 3'/%3E%3C/svg%3E" alt="" />
        <section aria-label="配料">
          <h2>配料</h2>
          <ul>
            <li>番茄 2 个</li>
            <li>鸡蛋 3 个</li>
            <li>盐 少许</li>
            <li>葱花 少许</li>
          </ul>
        </section>
        <section aria-label="步骤">
          <h2>步骤</h2>
          <ol>
            <li>鸡蛋打散，炒到凝固后盛出。</li>
            <li>番茄切块，炒出汁水。</li>
            <li>倒回鸡蛋，加盐和葱花，翻炒均匀。</li>
          </ol>
        </section>
        <button type="button">加入收藏</button>
      </article>
      <aside>小贴士：先炒蛋再炒番茄，蛋会更嫩。</aside>
    </main>
  </body>
</html>
```
:::

:::variant{kind=wrong name=unnamed-sections fails=tests reason="section 没有名字，不是 region 地标"}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>番茄炒蛋</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main>
      <h1>番茄炒蛋</h1>
      <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 24'%3E%3Ccircle cx='14' cy='12' r='10' fill='%23e53935'/%3E%3Cellipse cx='28' cy='13' rx='9' ry='7' fill='%23fdd835'/%3E%3C/svg%3E" width="120" height="72" alt="一盘番茄炒蛋" />
      <img class="divider" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 4'%3E%3Cpath d='M0 2h100' stroke='%23999' stroke-dasharray='4 3'/%3E%3C/svg%3E" alt="" />
      <section>
        <h2>配料</h2>
        <ul>
          <li>番茄 2 个</li>
          <li>鸡蛋 3 个</li>
          <li>盐 少许</li>
          <li>葱花 少许</li>
        </ul>
      </section>
      <section>
        <h2>步骤</h2>
        <ol>
          <li>鸡蛋打散，炒到凝固后盛出。</li>
          <li>番茄切块，炒出汁水。</li>
          <li>倒回鸡蛋，加盐和葱花，翻炒均匀。</li>
        </ol>
      </section>
      <aside><p>小贴士：先炒蛋再炒番茄，蛋会更嫩。</p></aside>
      <button type="button">加入收藏</button>
    </main>
  </body>
</html>
```
:::

:::variant{kind=wrong name=unordered-steps fails=tests reason="步骤用了无序列表"}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>番茄炒蛋</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main>
      <h1>番茄炒蛋</h1>
      <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 24'%3E%3Ccircle cx='14' cy='12' r='10' fill='%23e53935'/%3E%3Cellipse cx='28' cy='13' rx='9' ry='7' fill='%23fdd835'/%3E%3C/svg%3E" width="120" height="72" alt="一盘番茄炒蛋" />
      <img class="divider" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 4'%3E%3Cpath d='M0 2h100' stroke='%23999' stroke-dasharray='4 3'/%3E%3C/svg%3E" alt="" />
      <section aria-labelledby="i">
        <h2 id="i">配料</h2>
        <ul>
          <li>番茄 2 个</li>
          <li>鸡蛋 3 个</li>
          <li>盐 少许</li>
          <li>葱花 少许</li>
        </ul>
      </section>
      <section aria-labelledby="s">
        <h2 id="s">步骤</h2>
        <ul>
          <li>鸡蛋打散，炒到凝固后盛出。</li>
          <li>番茄切块，炒出汁水。</li>
          <li>倒回鸡蛋，加盐和葱花，翻炒均匀。</li>
        </ul>
      </section>
      <aside><p>小贴士：先炒蛋再炒番茄，蛋会更嫩。</p></aside>
      <button type="button">加入收藏</button>
    </main>
  </body>
</html>
```
:::

:::variant{kind=wrong name=decorative-alt fails=tests reason="装饰图片写了替代文字，屏幕阅读器不会跳过它"}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>番茄炒蛋</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main>
      <h1>番茄炒蛋</h1>
      <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 24'%3E%3Ccircle cx='14' cy='12' r='10' fill='%23e53935'/%3E%3Cellipse cx='28' cy='13' rx='9' ry='7' fill='%23fdd835'/%3E%3C/svg%3E" width="120" height="72" alt="一盘番茄炒蛋" />
      <img class="divider" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 4'%3E%3Cpath d='M0 2h100' stroke='%23999' stroke-dasharray='4 3'/%3E%3C/svg%3E" alt="分隔线" />
      <section aria-labelledby="i">
        <h2 id="i">配料</h2>
        <ul>
          <li>番茄 2 个</li>
          <li>鸡蛋 3 个</li>
          <li>盐 少许</li>
          <li>葱花 少许</li>
        </ul>
      </section>
      <section aria-labelledby="s">
        <h2 id="s">步骤</h2>
        <ol>
          <li>鸡蛋打散，炒到凝固后盛出。</li>
          <li>番茄切块，炒出汁水。</li>
          <li>倒回鸡蛋，加盐和葱花，翻炒均匀。</li>
        </ol>
      </section>
      <aside><p>小贴士：先炒蛋再炒番茄，蛋会更嫩。</p></aside>
      <button type="button">加入收藏</button>
    </main>
  </body>
</html>
```
:::

:::variant{kind=wrong name=photo-without-alt fails=tests reason="成品照片没有替代文字"}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>番茄炒蛋</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main>
      <h1>番茄炒蛋</h1>
      <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 24'%3E%3Ccircle cx='14' cy='12' r='10' fill='%23e53935'/%3E%3Cellipse cx='28' cy='13' rx='9' ry='7' fill='%23fdd835'/%3E%3C/svg%3E" width="120" height="72" />
      <img class="divider" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 4'%3E%3Cpath d='M0 2h100' stroke='%23999' stroke-dasharray='4 3'/%3E%3C/svg%3E" alt="" />
      <section aria-labelledby="i">
        <h2 id="i">配料</h2>
        <ul>
          <li>番茄 2 个</li>
          <li>鸡蛋 3 个</li>
          <li>盐 少许</li>
          <li>葱花 少许</li>
        </ul>
      </section>
      <section aria-labelledby="s">
        <h2 id="s">步骤</h2>
        <ol>
          <li>鸡蛋打散，炒到凝固后盛出。</li>
          <li>番茄切块，炒出汁水。</li>
          <li>倒回鸡蛋，加盐和葱花，翻炒均匀。</li>
        </ol>
      </section>
      <aside><p>小贴士：先炒蛋再炒番茄，蛋会更嫩。</p></aside>
      <button type="button">加入收藏</button>
    </main>
  </body>
</html>
```
:::
