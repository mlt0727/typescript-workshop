---
version: 1
mode: dom
estimatedMinutes: 40
review: self-reviewed
problem: 评论区要显示换行和加粗，开发者图省事，把用户的评论拼进字符串，再用 innerHTML 放进页面。某天，一条评论里藏着一个 `<img src=x onerror=…>`：之后每个打开这个页面的人，浏览器都执行了攻击者写的代码，它能以这个用户的身份读取页面上的数据、发出请求。这就是跨站脚本（XSS）。这一课讲 XSS 从哪里来，以及前端的几道防线：用 textContent 插入文字、只允许安全协议的链接、确实需要 HTML 时用清理库，再用内容安全策略（CSP）兜底。
objectives:
  - 理解 XSS 的危害：攻击者的脚本以用户的身份在你的页面上运行
  - 认出危险的写法：innerHTML、insertAdjacentHTML、document.write、eval，以及由用户控制的链接地址
  - 用 textContent、createElement、setAttribute 安全地插入用户提供的数据
  - 用协议白名单检查链接地址；知道清理库和内容安全策略（CSP）的作用与局限
references:
  - title: Cross-site scripting (XSS) — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/XSS
    checked: 2026-10-20
  - title: Cross Site Scripting Prevention Cheat Sheet — OWASP
    url: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
    checked: 2026-10-20
  - title: "Element: innerHTML property — MDN"
    url: https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML
    checked: 2026-10-20
  - title: Content Security Policy (CSP) — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP
    checked: 2026-10-20
  - title: "Element: setHTML() method — MDN"
    url: https://developer.mozilla.org/en-US/docs/Web/API/Element/setHTML
    checked: 2026-10-20
---

## XSS 是什么

**跨站脚本**（Cross-Site Scripting，XSS）是指：攻击者设法让**自己的脚本**在**你的网站**上运行。脚本一旦运行，它和你自己写的代码没有区别：可以读取页面上的内容和 `localStorage` 里的数据，可以带着用户的登录状态向你的服务器发请求（这些请求是同源的，CORS 拦不住，e11），也可以把页面改成一个钓鱼表单。

攻击者的代码通常藏在**数据**里：评论、用户名、搜索词、地址中的参数。只要程序把这些数据当作 **HTML 或代码**插进页面，而不是当作**文本**，就可能出问题。按照恶意数据从哪里来，常分为三类：保存在服务器上、显示给每个访问者的（存储型）；藏在链接里、诱导用户点击的（反射型）；完全在前端由 JavaScript 读取并插入页面的（DOM 型）。前端代码要负责的，主要是把数据**插进页面的那一刻**。

## innerHTML 把文字当成了 HTML

`element.innerHTML = 字符串` 会把字符串**解析成 HTML**。字符串来自用户时，用户就能决定页面上出现什么元素、带有什么属性：

:::playground{#inner-html}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <h2>评论</h2>
    <div id="comments"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=main.ts
document.addEventListener('securitypolicyviolation', (event) => {
  if (event.violatedDirective.startsWith('script-src')) console.log('CSP 拦下了：', event.violatedDirective);
});

const comments = document.querySelector('#comments');
if (!(comments instanceof HTMLElement)) throw new Error('页面结构不完整');

const evil = `好文章！<img src="missing.png" onerror="console.log('攻击者的代码运行了')"><script>console.log('script 运行了')</script>`;

const unsafe = document.createElement('p');
unsafe.innerHTML = evil;
console.log('innerHTML：页面上多了一个 img 吗？', unsafe.querySelector('img') !== null);
console.log('它带着 onerror 吗？', unsafe.querySelector('img')?.getAttribute('onerror'));

const safe = document.createElement('p');
safe.textContent = evil;
console.log('textContent：页面上有 img 吗？', safe.querySelector('img') !== null);

comments.append(unsafe, safe);
```
- 第 10–11 行：`innerHTML` 把评论解析成了 HTML，页面上真的多了一个 `<img>`，它的 `onerror` 属性里是攻击者的代码。图片加载失败时，浏览器会执行它。
- 本平台的沙箱页面设置了内容安全策略（CSP，见下文），所以 `onerror` 被拦了下来（第 1–3 行打印出被拦的原因）。一个没有 CSP 的普通网站，这段代码会**真的运行**。
- `<script>` 没有运行：通过 `innerHTML` 插入的 `<script>` 元素不会执行。但这并不能让 `innerHTML` 变得安全，`onerror`、`onload` 这类事件属性有很多种写法。
- 第 15–16 行：`textContent` 把整段内容当作**文字**，尖括号原样显示在页面上，没有产生任何元素。
:::

同样会把字符串当作 HTML 解析的还有：`outerHTML`、`insertAdjacentHTML()`、`document.write()`、`setHTMLUnsafe()`、`Range.createContextualFragment()`，以及 `<iframe>` 的 `srcdoc` 属性；把字符串当作代码执行的有 `eval()`、`new Function()`、`setTimeout('字符串')`；用户提供的地址交给 `location.href = …` 或 `window.open()` 时，`javascript:` 地址同样会执行。React 的 `dangerouslySetInnerHTML` 内部用的也是 `innerHTML`，名字就是在提醒你。

## 默认就安全的写法

d06 介绍的 DOM 方法，正好就是插入用户数据的安全方式：

- **文字**：`element.textContent = text`，或者 `element.append(text)`（传入字符串时，`append` 创建的是文本节点）；
- **结构**：用 `document.createElement` 创建元素，结构由**你的代码**决定，用户的数据只出现在文字里；
- **普通属性**：`element.setAttribute('title', text)`、`input.value = text` 是安全的，属性的值不会被当作 HTML 解析。但**属性名**不能由用户决定，`on` 开头的事件属性、`style`、`srcdoc` 会把值当作代码或 HTML；
- **链接地址**：`href`、`src` 要单独检查，见下一节。

**关于模板字符串：** `` `<p>${text}</p>` `` 这样拼出来的 HTML，再交给 `innerHTML`，和直接用 `innerHTML` 一样危险。可以自己写一个“转义函数”把 `<`、`&`、`"` 替换掉，但每种位置（文字、属性、URL、`<script>` 里面）需要的转义都不同，很容易漏掉一种。能用 DOM 方法就不要拼 HTML。

## 链接地址：只允许安全的协议

`<a href="javascript:…">` 被点击时，浏览器会把冒号后面的内容当作脚本执行。所以用户提供的链接（个人主页、评论中的链接）即使用 `setAttribute` 设置，也可能是攻击。

不要用“是不是以 `javascript:` 开头”来判断：`JavaScript:`、` javascript:`（前面有空格）、写在 HTML 属性中的 `java&#10;script:`（`&#10;` 是换行符的字符引用，地址中间藏着一个换行）浏览器都会当作 `javascript:`；还有 `data:`、`vbscript:` 等其他危险的协议。正确的做法是**白名单**：用 `URL` 解析地址（它会像浏览器一样处理大小写、空白和控制字符），然后只允许已知安全的协议：

:::playground{#safe-url}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=main.ts
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

function safeHref(input: string): string | null {
  const url = URL.parse(input.trim(), 'https://app.example/');
  return url !== null && SAFE_PROTOCOLS.has(url.protocol) ? url.href : null;
}

for (const input of ['https://developer.mozilla.org/', '/docs/intro', 'mailto:hi@example.com', 'javascript:alert(1)', ' JavaScript:alert(1)', 'java\nscript:alert(1)', 'data:text/html,<script>alert(1)</script>']) {
  console.log(JSON.stringify(input), '→', safeHref(input));
}
```
- 第 4 行：`URL.parse(地址, 基准地址)` 解析失败时返回 `null`，不像 `new URL` 那样抛出错误。第二个参数让相对地址（`/docs/intro`）以本站为基准解析；示例用了一个虚构的地址，真实页面中用 `location.href`。
- 第 5 行：返回的是**解析之后**的 `url.href`，而不是用户的原文。检查的和使用的是同一个值。
- 后四个输入都是攻击：第一个是原样的 `javascript:`；第二个的大写和前面的空格、第三个中间的换行，经过 `trim()` 和 `URL` 的规范化之后，同样是 `javascript:` 协议；最后一个是 `data:` 协议。白名单拒绝了它们。
:::

## 确实需要显示 HTML 时

有时候内容本来就是 HTML，例如富文本编辑器产生的文章。这时要用**清理**（sanitize）：解析 HTML，只保留白名单中的元素和属性，删掉脚本、事件属性和危险的链接。不要自己写，用经过检验的库，例如 **DOMPurify**（MDN 和 OWASP 都推荐它）。浏览器也在加入内置的清理功能 `element.setHTML()`（Sanitizer API），但截至本课的检查日期，它还没有在所有主流浏览器中可用，使用前要先检测，或者继续用 DOMPurify。

更常见的需求其实只是“支持换行、加粗、链接”。这时不需要接受任何 HTML：自己规定一种很小的格式，用 DOM 方法把它渲染出来，挑战题就是这样做的。

## 内容安全策略：最后一道防线

**内容安全策略**（Content Security Policy，CSP）是服务器在响应头中声明的规则（也可以写在页面的 `<meta http-equiv="Content-Security-Policy">` 中，本平台的沙箱就是这样做的，但这种方式支持的指令少一些），告诉浏览器这个页面可以加载、执行哪些脚本。例如：

```
Content-Security-Policy: script-src 'self'
```

它只允许执行本站的脚本文件：页面中的内联脚本、`onerror` 这类事件属性、`javascript:` 链接都不会被执行。即使某处漏掉了转义，注入的代码也很可能跑不起来，上面的示例就被本平台的 CSP 拦了下来。

按域名列出允许的来源，配置起来容易出漏洞（例如允许的 CDN 上恰好有可以利用的脚本）。现在更推荐的“严格 CSP”是用每次请求都不同的随机数（nonce）或者脚本内容的哈希来标记允许执行的脚本，再加上 `object-src 'none'`、`base-uri 'none'`。一些浏览器还支持 **Trusted Types**（`require-trusted-types-for 'script'`）：开启后，把普通字符串交给 `innerHTML` 这类危险的接口会直接报错，必须先经过你指定的清理函数。这些都由服务器配置，H 阶段会再提到。

但 CSP 是**兜底**，不是借口：它要由服务器配置；规则写得太宽（例如加上 `'unsafe-inline'`）就失去了作用；它也挡不住所有的攻击，例如注入一个伪造的登录表单。正确插入数据始终是第一道防线。

**关于框架：** React 等框架默认把 `{text}` 当作文字插入，替你防住了大部分情况；React 19 还会拦截 `javascript:` 链接，但只拦截这一种，`data:` 等其他协议不管。所以 `dangerouslySetInnerHTML`、用户提供的链接，仍然要你自己检查（G 阶段）。

::exercise{#safe-href}

## 编程挑战

::exercise{#markdown-lite}

::quiz

## 常见错误

- **用 `innerHTML` 显示用户的文字**：只是为了显示文字时，用 `textContent`。
- **以为过滤掉 `<script>` 就安全了**：`<img onerror>`、`<svg onload>` 等写法多得是，而且 `innerHTML` 插入的 `<script>` 本来就不执行。
- **用黑名单检查链接**：`JavaScript:`、带空白或控制字符的写法都能绕过。解析之后用协议白名单。
- **在属性中拼接 HTML**：`` `<a href="${url}">` `` 里，一个 `"` 就能结束属性、加上新的事件属性。用 `setAttribute` 或 `a.href = …`。
- **把 CSP 当作唯一的防线**：它是兜底，正确地插入数据才是根本。

## 下一步

E 阶段的最后一课（e13）要在 F 阶段学会搭建本地项目之后再学：在构建工具中使用环境变量，以及为什么任何放进前端代码的“密钥”都不再是秘密。
