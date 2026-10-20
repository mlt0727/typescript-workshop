---
version: 1
mode: dom
estimatedMinutes: 45
review: ai-draft
problem: 同一个网页会在手机、平板、宽屏显示器上打开，也会被键盘用户、屏幕阅读器用户、视力不好的用户使用。响应式设计让布局适应不同的屏幕宽度；可访问性（accessibility，常写作 a11y）让尽可能多的人都能使用页面。两者都不是“最后再加的功能”：从一开始用相对的尺寸、移动优先的媒体查询、足够的对比度和清晰的焦点样式，成本最低。
objectives:
  - 用流动的宽度、相对单位和 max-width 让布局适应不同的屏幕
  - 用移动优先的媒体查询在合适的宽度调整布局，并在 TypeScript 中用 matchMedia 读取媒体查询
  - 检查文字与背景的对比度，知道 WCAG 4.5:1 与 3:1 的要求，不只靠颜色传达信息
  - 保证键盘可用：可见的焦点样式（:focus-visible）、足够大的点击目标、图标按钮的可访问名称
references:
  - title: Responsive web design — MDN Learn web development
    url: https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Responsive_Design
    checked: 2026-10-20
  - title: Using media queries — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_media_queries/Using_media_queries
    checked: 2026-10-20
  - title: Web Content Accessibility Guidelines (WCAG) 2.2 — W3C
    url: https://www.w3.org/TR/WCAG22/
    checked: 2026-10-20
  - title: ":focus-visible — MDN"
    url: https://developer.mozilla.org/en-US/docs/Web/CSS/:focus-visible
    checked: 2026-10-20
  - title: "CSS and JavaScript accessibility best practices — MDN Learn web development"
    url: https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Accessibility/CSS_and_JavaScript
    checked: 2026-10-20
---

## 流动的布局

响应式的第一步，是让布局本身就能伸缩，而不是写死一个宽度：

- 容器用 `max-width` 限制最大宽度，而不是 `width`：屏幕比它窄时，容器跟着变窄；
- 图片加上 `max-width: 100%; height: auto;`，就不会撑破容器；
- 字号和间距多用 **`rem`**（相对于根元素的字号，默认 16px）。用户在浏览器设置里调大字号时，用 `rem` 写的文字会跟着变大，用 `px` 写的就不会；
- 长文本的行宽用 `ch`（一个“0”字符的宽度）限制，例如 `max-width: 65ch`，太长的行很难阅读。

上一课的 Flexbox 换行和 Grid 的 `auto-fill` 也属于这一类：它们根据可用空间自动调整，不需要知道屏幕有多宽。

:::playground{#fluid}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <article class="fixed">
      <h2>固定宽度 600px</h2>
      <p>预览区比 600px 窄时，这一块会超出屏幕，出现横向滚动条。</p>
    </article>
    <article class="fluid">
      <h2>最大宽度 600px</h2>
      <p>预览区变窄时，这一块跟着变窄，图片也一起缩小。</p>
      <img
        src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='100'%3E%3Crect width='800' height='100' fill='%2393c5fd'/%3E%3C/svg%3E"
        alt="一张 800 像素宽的示意图"
      />
    </article>
  </body>
</html>
```
```css file=style.css
* { box-sizing: border-box; }
body { margin: 0 1rem; font-family: system-ui, sans-serif; }
article { padding: 1rem; margin-block: 1rem; background: #f1f5f9; }

.fixed { width: 600px; }

.fluid { max-width: 600px; }
.fluid img { max-width: 100%; height: auto; display: block; }
```
- 把预览区拉窄到 600px 以下（或者在手机上打开），对比两块内容。
- `style.css` 第 8 行：没有它，800px 宽的图片会撑破容器。
- `index.html` 第 4 行的 viewport 设置让手机按设备宽度显示页面；缺少它，手机浏览器会假装自己有 980px 宽，再把整页缩小显示。
:::

## 媒体查询

只靠伸缩不够时，用**媒体查询**在某个宽度上改变布局：

```css
.layout { display: grid; gap: 1rem; }

@media (width >= 640px) {
  .layout { grid-template-columns: 1fr 240px; }
}
```

这里采用**移动优先**：不在媒体查询里的规则是窄屏（手机）的样式，媒体查询只为更宽的屏幕追加规则。`(width >= 640px)` 是较新的范围写法，和传统的 `(min-width: 640px)` 等价，现在的主流浏览器都已支持。断点要根据内容来定：在内容开始显得拥挤或稀疏的地方调整，而不是照搬某款手机的宽度。

媒体查询不只能查宽度，还能查用户的偏好：`(prefers-color-scheme: dark)`（深色模式）、`(prefers-reduced-motion: reduce)`（希望减少动画，对前庭功能障碍的用户很重要）。

在 TypeScript 中，`window.matchMedia(查询)` 返回一个 `MediaQueryList`：`matches` 是当前是否满足，`change` 事件在结果变化时触发。

:::playground{#media}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <div class="layout">
      <main>主要内容</main>
      <aside>侧栏</aside>
    </div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```css file=style.css
.layout { display: grid; gap: 1rem; }
main, aside { padding: 1rem; background: #e0f2fe; }
aside { background: #fef3c7; }

@media (width >= 640px) {
  .layout { grid-template-columns: 1fr 240px; }
}
```
```ts file=main.ts
const wide = window.matchMedia('(width >= 640px)');
console.log('现在是宽屏布局吗？', wide.matches);

wide.addEventListener('change', (event) => {
  console.log('宽度跨过了 640px，现在是宽屏布局吗？', event.matches);
});
```
- 拉动预览区的宽度，越过 640px 时侧栏会移到主要内容的下方或右侧，输出区同时打印一条消息。
- 布局的变化交给 CSS；只有逻辑需要随屏幕变化时（例如窄屏下把菜单折叠起来），才在 TypeScript 中读取媒体查询。
:::

另一个现代工具是**容器查询**（`@container`）：根据组件所在**容器**的宽度、而不是整个屏幕的宽度调整样式。同一个卡片组件放在窄侧栏和宽主区里时，它特别有用。本课程的练习只用到媒体查询。

## 可访问性的基本功

**对比度。** 文字与背景的对比度用 1:1（同色）到 21:1（黑白）表示。WCAG 2.2 的 AA 级要求：正文至少 **4.5:1**；大号文字（24px 以上，或 18.66px 以上的粗体）至少 3:1；按钮边框、焦点轮廓这类界面元素至少 3:1。浅灰色文字是最常见的问题：`#999` 配白色背景只有约 2.8:1。

**不只靠颜色。** 色觉障碍的用户可能分不清红绿。表单出错时，除了把边框变红，还要显示文字说明。

**键盘可用。** 很多用户只用键盘（或者模拟键盘的辅助设备）。Tab 键的顺序跟随 HTML 中元素的顺序，所以源代码的顺序要合理；获得焦点的元素必须**看得出来**。永远不要只写 `outline: none` 而不提供替代样式。`:focus-visible` 只在浏览器判断需要显示焦点时（例如用键盘操作时）生效，用鼠标点击按钮时不会出现焦点框，兼顾了两类用户。

**点击目标。** WCAG 2.2 要求可点击目标至少 **24×24** CSS 像素（有一些例外）；触屏上建议更大，常见的建议是 44×44。

**图标按钮要有名字。** 只有一个“×”图标的按钮，屏幕阅读器只能读出“按钮”或者“乘号”。用 `aria-label="关闭"` 给它一个名字，或者在按钮里放一段只给屏幕阅读器读的文字。

:::playground{#a11y}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <p class="sample low">浅灰色文字：#999 配白色背景</p>
    <p class="sample good">深灰色文字：#555 配白色背景</p>
    <button type="button" class="close" aria-label="关闭">×</button>
    <button type="button">普通按钮</button>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```css file=style.css
body { background: #fff; font-family: system-ui, sans-serif; }
.low { color: #999; }
.good { color: #555; }

button { font: inherit; padding: 0.25rem 0.75rem; }
.close { min-width: 2rem; min-height: 2rem; }
button:focus-visible { outline: 3px solid #0a6cff; outline-offset: 2px; }
```
```ts file=main.ts
/** 把 rgb(r, g, b) 转换成 WCAG 定义的相对亮度 */
function luminance(color: string): number {
  const [r = 0, g = 0, b = 0] = (color.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map((part) => {
    const c = Number(part) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const background = getComputedStyle(document.body).backgroundColor;
for (const el of document.querySelectorAll('.sample')) {
  const ratio = contrast(getComputedStyle(el).color, background);
  console.log(`${el.textContent}：${ratio.toFixed(2)}:1，${ratio >= 4.5 ? '达到' : '没有达到'} AA 要求`);
}
```
- 输出显示了两种灰色的对比度：`#999` 约 2.8:1，不合格；`#555` 约 7.5:1。`getComputedStyle` 返回的颜色总是 `rgb(…)` 格式，代码按 WCAG 的公式计算。
- 点一下预览区，再按 Tab 键在两个按钮之间切换：蓝色的焦点框清楚地标出当前位置。用鼠标点击按钮时，焦点框不会出现。
- 第一个按钮只显示“×”，但它的可访问名称是“关闭”（`aria-label`），最小尺寸是 2rem×2rem（32px），超过了 24px 的要求。
:::

::exercise{#responsive-layout}

## 编程挑战

::exercise{#a11y-fixes}

::quiz

## 常见错误

- **写死宽度**：`width: 1200px` 的容器在手机上一定会溢出。用 `max-width`。
- **只为桌面写样式，再用一堆 `max-width` 媒体查询去“修”手机**：移动优先通常更简单。
- **`outline: none`**：键盘用户看不到焦点在哪里。需要自定义时改用 `:focus-visible` 写出新的样式。
- **浅灰色的说明文字**：对比度往往不到 4.5:1。
- **只有图标的按钮没有名字**：加 `aria-label`。

## 下一步

下一课回到 TypeScript：用 `querySelector` 查询 DOM 元素，处理 `null`，并把 `Element` 收窄成具体的元素类型。
