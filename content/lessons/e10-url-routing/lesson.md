---
version: 1
mode: dom
estimatedMinutes: 45
review: ai-draft
problem: 用户在一个筛选过的列表里点进某条记录，再按“后退”，结果回到了没有筛选的首页；把当前页面的链接发给同事，对方打开看到的也不是同一个视图。原因是界面的状态只存在于 JavaScript 变量里，URL 对此一无所知。这一课讲 URL 的组成、用查询参数保存界面状态，以及用 History API 实现不刷新页面的前端路由，包括后退按钮、链接拦截和刷新时服务器需要做的配置。
objectives:
  - 用 URL 和 URLSearchParams 读取、构造地址的各个部分
  - 把可分享的界面状态（筛选、分页、选中的标签页）放进查询参数，区分 pushState 与 replaceState
  - 用 popstate 事件响应后退和前进，让界面与地址保持一致
  - 实现一个简单的前端路由：匹配路径参数、拦截站内链接、知道刷新深层链接时服务器要返回同一个页面
references:
  - title: URL — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/URL
    checked: 2026-10-20
  - title: Working with the History API — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/History_API/Working_with_the_History_API
    checked: 2026-10-20
  - title: "Window: popstate event — MDN"
    url: https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event
    checked: 2026-10-20
  - title: Rewrites — Vercel
    url: https://vercel.com/docs/rewrites
    checked: 2026-10-20
---

## URL 的组成

`https://shop.example/products/42?tab=reviews&page=2#comments` 由几部分组成：

| 部分 | 例子中的值 | `URL` 对象的属性 |
| --- | --- | --- |
| 来源（协议 + 域名 + 端口） | `https://shop.example` | `origin` |
| 路径 | `/products/42` | `pathname` |
| 查询参数 | `?tab=reviews&page=2` | `search`，以及 `searchParams` |
| 片段 | `#comments` | `hash` |

`new URL(地址, 基准地址)` 解析一个地址；`url.searchParams`（e05 用过）读写查询参数。片段（`#` 之后）只在浏览器中使用，不会发送给服务器。页面当前的地址是 `location.href`。

:::playground{#url-parts}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=main.ts
const url = new URL('https://shop.example/products/42?tab=reviews&page=2#comments');
console.log(url.origin, url.pathname, url.search, url.hash);

const page = Number(url.searchParams.get('page') ?? '1');
console.log('第', page, '页，标签页：', url.searchParams.get('tab'), '，不存在的参数：', url.searchParams.get('sort'));

const relative = new URL('../cart?from=detail', url);
console.log('相对地址解析后：', relative.href);

console.log('本页面的地址：', location.pathname);
```
- 第 4 行：查询参数的值总是字符串（或 `null`），需要数字时自己转换。
- 第 7 行：第二个参数是基准地址，`..` 和浏览器中的相对链接一样解析。
- 第 10 行：示例运行在平台的沙箱页面里，所以地址是 `/sandbox/index.html`。
:::

## 把界面状态放进 URL

哪些状态应该放进 URL？判断标准是：**刷新页面、分享链接、按后退键之后，用户是否期望看到同样的内容**。筛选条件、搜索词、分页、当前打开的标签页都是；展开的下拉菜单、输入框里还没提交的文字通常不是。

`history` 对象提供两个方法改变地址，**都不会刷新页面**：

- `history.pushState(state, '', 新地址)`：新增一条历史记录，用户按“后退”会回到之前的地址。适合离散的导航，例如点击筛选按钮、翻页；
- `history.replaceState(state, '', 新地址)`：替换当前的历史记录。适合连续的变化，例如在搜索框中输入：每敲一个字就新增一条记录，后退键就没法用了。

第二个参数是历史遗留的标题参数，传空字符串即可。用户按后退或前进时，浏览器改变地址并触发 `window` 上的 **`popstate`** 事件（调用 `pushState`、`replaceState` 本身不会触发它）。监听它，从地址中重新读取状态并渲染，界面就和地址保持一致。

:::playground{#filters-in-url}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <div role="group" aria-label="筛选" id="filters">
      <button type="button" data-status="all">全部</button>
      <button type="button" data-status="active">进行中</button>
      <button type="button" data-status="done">已完成</button>
    </div>
    <p id="view"></p>
    <button type="button" id="back">后退</button>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=main.ts
type Status = 'all' | 'active' | 'done';

const isStatus = (value: string | null): value is Status => value === 'all' || value === 'active' || value === 'done';

function readStatus(): Status {
  const value = new URL(location.href).searchParams.get('status');
  return isStatus(value) ? value : 'all';
}

const filters = document.querySelector('#filters');
const view = document.querySelector('#view');
const back = document.querySelector('#back');
if (!(filters instanceof HTMLElement) || !(view instanceof HTMLElement) || !(back instanceof HTMLButtonElement)) {
  throw new Error('页面结构不完整');
}

const render = (): void => {
  const status = readStatus();
  view.textContent = `当前筛选：${status}，地址中的查询参数：${location.search || '（无）'}`;
  for (const button of filters.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.status === status));
  }
};

filters.addEventListener('click', (event) => {
  const status = event.target instanceof Element ? event.target.closest('button')?.dataset.status : undefined;
  if (status === undefined || !isStatus(status)) return;
  const url = new URL(location.href);
  if (status === 'all') url.searchParams.delete('status');
  else url.searchParams.set('status', status);
  history.pushState(null, '', url);
  render();
});

window.addEventListener('popstate', render);
back.addEventListener('click', () => history.back());

render();
```
- 依次点击“进行中”“已完成”，再点“后退”（相当于浏览器的后退键）：地址和界面一起回到上一步。
- 第 5–8 行：状态**从地址读取**，地址是唯一的数据来源（d10 的思路）。
- 第 31 行：`pushState` 改变地址但不刷新页面，所以紧接着要自己调用 `render`。
- 第 35 行：后退、前进时浏览器触发 `popstate`，同样调用 `render`。
:::

## 前端路由

单页应用（SPA）只有一个 HTML 页面，但看起来有很多“页面”：`/`、`/users/42`、`/settings`。这就是**前端路由**：根据 `location.pathname` 决定渲染哪个视图，点击站内链接时用 `pushState` 改变地址而不是真的跳转。

一个路由要处理的事情：

1. **匹配路径**：`/users/:id` 这样的模式匹配 `/users/42`，并取出参数 `{ id: '42' }`；
2. **拦截站内链接**：在 `document` 上委托（d08）`click` 事件，对指向本站的 `<a>`，调用 `preventDefault()`，改用 `pushState` 并渲染。但用户按住 Ctrl/⌘/Shift 点击（想在新标签页打开）、链接带有 `target` 或 `download`、或者指向别的网站时，**不要拦截**；
3. **响应后退和前进**：监听 `popstate`，重新渲染；
4. **可访问性**：真正的页面跳转时，屏幕阅读器会读出新页面；前端路由切换视图时它什么也不知道。所以要更新 `document.title`，并把焦点移到新内容的主标题上（或者用一个 `role="status"` 的区域报告“已打开：用户 42”）。

还有一件事在浏览器之外：用户**刷新**或者**直接打开** `/users/42` 时，浏览器会真的向服务器请求这个路径。服务器上并没有这个文件，就会返回 404。所以部署单页应用时，要配置服务器把这些路径都返回同一个 `index.html`，由前端路由接管。本课程平台部署在 Vercel 上，它的 `vercel.json` 中就有这样的规则：

```json
{ "rewrites": [{ "source": "/learn/:lessonId", "destination": "/index.html" }] }
```

另一种做法是**哈希路由**：把路径放在 `#` 之后（`/#/users/42`）。片段不会发送给服务器，所以不需要服务器配置，但地址不那么美观，也不利于搜索引擎。现代应用通常用 History API。React Router 等路由库替你完成了这些工作（G 阶段），但原理就是本课的这些。

::exercise{#url-filters}

## 编程挑战

::exercise{#mini-router}

::quiz

## 常见错误

- **界面状态只放在变量里**：刷新、分享、后退都会丢失。可分享的状态放进 URL。
- **搜索框每输入一个字就 `pushState`**：历史记录被塞满，后退键失效。连续变化用 `replaceState`。
- **以为 `pushState` 会触发 `popstate`**：不会，改变地址后要自己渲染。
- **拦截所有链接的点击**：Ctrl+点击、`target="_blank"`、外部链接都应该交给浏览器。
- **部署后刷新深层链接得到 404**：服务器要把前端路由的路径都返回 `index.html`。

## 下一步

下一课讲 CORS：为什么浏览器会拦下跨域请求，它保护的是谁，以及正确的解决方式在哪里。
