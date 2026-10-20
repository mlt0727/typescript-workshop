---
version: 1
mode: dom
estimatedMinutes: 45
review: self-reviewed
problem: HTML 决定页面有什么，CSS 决定它们长什么样、放在哪里。对有编程背景的人来说，CSS 最难的往往不是语法，而是布局：元素为什么挤在一起、为什么换行、为什么不居中。现代 CSS 有两个专门的布局工具：Flexbox 沿一条轴排列一组元素（导航栏、按钮组），Grid 同时控制行和列（卡片网格、页面框架）。这一课先用最短的篇幅讲清 CSS 的基本规则和盒模型，再讲这两个布局工具。
objectives:
  - 读懂 CSS 规则：选择器、属性与值，知道层叠与优先级的基本规则
  - 理解盒模型（content、padding、border、margin）和 box-sizing:border-box
  - 用 Flexbox 沿一条轴排列元素：主轴与交叉轴、justify-content、align-items、gap、flex 与换行
  - 用 Grid 划分行和列：fr 单位、repeat、minmax 与 auto-fill，并知道两者各自适合的场合
references:
  - title: CSS styling basics — MDN Learn web development
    url: https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics
    checked: 2026-10-20
  - title: The box model — MDN Learn web development
    url: https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics/Box_model
    checked: 2026-10-20
  - title: Flexbox — MDN Learn web development
    url: https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Flexbox
    checked: 2026-10-20
  - title: Grids — MDN Learn web development
    url: https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Grids
    checked: 2026-10-20
  - title: Relationship of grid layout to other layout methods — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Relationship_of_grid_layout_with_other_layout_methods
    checked: 2026-10-20
---

## CSS 规则与盒模型

一条 CSS 规则由**选择器**和一组**声明**组成：

```css
.card h2 {
  color: #333;
  margin-top: 0;
}
```

样式表通常写在单独的 `.css` 文件里，用 HTML 的 `<link rel="stylesheet" href="./style.css">` 引入。

常用的选择器：元素名 `p`、类 `.card`、id `#main`、后代 `.card h2`（`.card` 里面的所有 `h2`）、子元素 `.list > li`、状态 `a:hover`、属性 `input[type="checkbox"]`、所有元素 `*`。用逗号分隔的 `h1, h2` 表示“同时选中这两类”。一个元素可以同时被多条规则选中，冲突时，**更具体**的选择器获胜（id 比类具体，类比元素名具体）；一样具体时，**后写**的获胜。实际项目里尽量用类选择器，让优先级保持简单。

几个写法上的约定：长度单位最常用 `px`（像素）和 `rem`（根元素字号的倍数，默认 1rem = 16px，下一课讲为什么推荐它）；`margin`、`padding` 这类属性可以一次写多个值：两个值是“上下 左右”（`margin: 10px 0`），四个值按顺时针“上 右 下 左”。

每个元素都是一个矩形的**盒子**，从内到外依次是：内容（content）、内边距（padding）、边框（border）、外边距（margin）。默认情况下，`width` 只指内容的宽度，padding 和 border 会加在外面，这经常让人算错尺寸。几乎所有现代项目都会把它改成 `box-sizing: border-box`：`width` 包含 padding 和 border。

元素默认的 `display` 决定它怎么参与排列：`div`、`p`、`h1` 这类**块级**元素独占一行、宽度撑满父元素；`a`、`span`、`strong` 这类**行内**元素像文字一样在行内排列，设置 `width`、`height` 不起作用。

:::playground{#box-model}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <div class="box" id="content-box">content-box</div>
    <div class="box border-box" id="border-box">border-box</div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```css file=style.css
.box {
  width: 200px;
  padding: 20px;
  border: 5px solid #0a6cff;
  margin: 10px 0;
  background: #e8f0ff;
}

.border-box {
  box-sizing: border-box;
}
```
```ts file=main.ts
for (const id of ['content-box', 'border-box']) {
  const box = document.getElementById(id);
  if (box) console.log(id, '实际宽度：', box.getBoundingClientRect().width);
}
```
- 两个盒子的 `width` 都是 `200px`。第一个的实际宽度是 200 + 20×2 + 5×2 = 250；第二个用了 `border-box`，padding 和 border 算在 200 以内。
- `getBoundingClientRect()` 返回元素在页面上实际占据的矩形，之后的测试会用它检查布局。
:::

## Flexbox：沿一条轴排列

给父元素设置 `display: flex`，它就成了**弹性容器**，直接子元素成为**弹性项目**，沿着**主轴**排成一行（`flex-direction: row`，默认）或一列（`column`）。与主轴垂直的方向叫**交叉轴**。

| 属性（写在容器上） | 作用 |
| --- | --- |
| `flex-direction` | 主轴方向：`row` 或 `column` |
| `justify-content` | 项目在**主轴**上怎么分布：`flex-start`、`center`、`space-between`… |
| `align-items` | 项目在**交叉轴**上怎么对齐：默认效果是拉伸到一样高（初始值写作 `normal`，在弹性布局中相当于 `stretch`），还有 `center`、`flex-start`… |
| `gap` | 项目之间的间距 |
| `flex-wrap: wrap` | 一行放不下时换行（默认不换行，项目会被压缩） |

写在**项目**上的 `flex: 1` 表示“分配剩余空间”：几个项目都写 `flex: 1`，它们就平分剩余宽度。`margin-left: auto` 会吃掉左边所有的剩余空间，把这个项目推到最右边。

:::playground{#flex}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <header class="bar">
      <strong class="logo">TS 工坊</strong>
      <nav>
        <a href="#a">课程</a>
        <a href="#b">项目</a>
      </nav>
      <button type="button" class="login">登录</button>
    </header>

    <div class="stats">
      <div class="stat">已完成<br /><b>12</b></div>
      <div class="stat">进行中<br /><b>3</b></div>
      <div class="stat wide">本周学习时间<br /><b>4 小时</b></div>
    </div>
  </body>
</html>
```
```css file=style.css
* { box-sizing: border-box; }
body { font-family: system-ui, sans-serif; margin: 8px; }

.bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 12px;
  background: #1e293b;
  color: white;
}
.bar nav { display: flex; gap: 12px; }
.bar a { color: #cbd5e1; }
.logo { font-size: 1.4rem; }
.login { margin-left: auto; }

.stats { display: flex; gap: 8px; margin-top: 12px; }
.stat { flex: 1; padding: 8px; background: #f1f5f9; border-radius: 6px; }
.wide { flex: 2; }
```
- `style.css` 第 6 行：`align-items: center` 让高度不同的 logo、导航和按钮在垂直方向居中。删掉这一行试试：项目被拉伸成一样高，导航文字贴到了顶部。
- 第 12 行：`nav` 既是 `.bar` 的项目，自己又是一个弹性容器，两个链接之间用 `gap` 隔开。弹性布局可以这样一层套一层。
- 第 15 行：`margin-left: auto` 把登录按钮推到最右边。
- 第 18–19 行：三个统计块按 `flex` 的比例 1 : 1 : 2 分配宽度。把预览区拉窄，它们会一起缩小。
:::

## Grid：同时控制行和列

`display: grid` 把容器划分成网格。`grid-template-columns` 定义列：

- `200px 1fr`：第一列 200 像素，第二列占据剩余空间。`fr` 是“剩余空间的份数”；
- `repeat(3, 1fr)`：三列等宽；
- `repeat(auto-fill, minmax(160px, 1fr))`：每列至少 160 像素，能放几列就放几列，多出来的空间平均分给各列。容器变窄时列数自动减少，**不需要媒体查询**。项目比列数少时，`auto-fill` 会保留空着的列（右侧留白）；换成 `auto-fit`，空列会被折叠，现有的项目拉伸占满整行。

项目按顺序依次填入格子，放满一行就换到下一行；同一行的格子默认一样高。`gap` 同时设置行间距和列间距。

:::playground{#grid}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <div class="page">
      <aside class="sidebar">目录</aside>
      <main class="cards">
        <article class="card">变量</article>
        <article class="card">函数：参数、返回值和箭头函数，内容比较长的一张卡片</article>
        <article class="card">数组</article>
        <article class="card">对象</article>
        <article class="card">模块</article>
      </main>
    </div>
  </body>
</html>
```
```css file=style.css
* { box-sizing: border-box; }
body { font-family: system-ui, sans-serif; margin: 8px; }

.page {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 12px;
}
.sidebar { background: #fef3c7; padding: 8px; }

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}
.card { padding: 12px; background: #e0f2fe; border-radius: 6px; }
```
- `style.css` 第 6 行：页面分成固定宽度的侧栏和占据剩余空间的主区域。
- 第 13 行：卡片自动决定列数。把预览区拉宽或拉窄，观察列数的变化；第二张卡片的文字更长，同一行的其他卡片也跟着变高。
:::

## 怎么选

- **Flexbox** 是一维的：沿一条轴排列一组元素，项目的大小可以由内容决定。适合导航栏、工具栏、按钮组、把某个元素推到一边。
- **Grid** 是二维的：先定义好行列，再把项目放进去，行和列都对齐。适合卡片网格、表单的标签与输入框对齐、整个页面的框架。

两者经常一起使用：页面框架用 Grid，框架里的导航栏用 Flexbox。

::exercise{#navbar}

## 编程挑战

::exercise{#card-grid}

::quiz

## 常见错误

- **忘了 `box-sizing: border-box`**：加了 padding 之后元素比预期的宽，撑破了容器。
- **把 `display: flex` 写在了项目上**：它要写在**父元素**（容器）上，作用于直接子元素。
- **分不清 `justify-content` 和 `align-items`**：前者管主轴，后者管交叉轴；`flex-direction: column` 时两者的方向随之互换。
- **用 margin 制造项目之间的间距**：首尾还要额外处理，用 `gap` 更简单。
- **用固定的列数加一堆媒体查询做卡片网格**：`repeat(auto-fill, minmax(…, 1fr))` 通常一行就够了。

## 下一步

下一课讲响应式设计和可访问性的基础：视口、媒体查询、相对单位、颜色对比度和键盘焦点。
