---
version: 1
mode: ts
estimatedMinutes: 55
review: self-reviewed
problem: 网站在本机的开发服务器上一切正常，部署之后却出了问题：首页能打开，点进商品页面也没事，可是在商品页面上刷新一下就是 404；或者部署到 GitHub Pages 的子路径上，页面一片空白。这些问题都来自同一个事实：开发服务器替你做了很多事，而部署的静态服务器只会按路径找文件。这一课在本机用真实的服务器复现这些问题（所有的结果都是实际运行得到的），讲清楚刷新时的回退、资源的路径（base 与路由的 basename），最后写一个部署之后的冒烟测试，把这些问题一次查出来。
objectives:
  - 解释单页应用在刷新深层地址时为什么会 404，在不同的静态服务器上配置回退（改写、404.html）或者改用 hash 路由
  - 根据部署的位置设置 Vite 的 base 和路由的 basename，知道相对路径 ./ 与深层地址一起使用时的问题
  - 按页面的地址解析 HTML 中引用的资源地址（URL 的相对解析）
  - 写一个部署之后的冒烟测试：检查每个页面和它引用的资源的状态码与内容类型
references:
  - title: Deploying a Static Site — Vite
    url: https://vite.dev/guide/static-deploy
    checked: 2026-10-20
  - title: Public Base Path — Vite
    url: https://vite.dev/guide/build#public-base-path
    checked: 2026-10-20
  - title: createBrowserRouter（basename）— React Router
    url: https://reactrouter.com/api/data-routers/createBrowserRouter
    checked: 2026-10-20
  - title: Creating a custom 404 page for your GitHub Pages site — GitHub Docs
    url: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site
    checked: 2026-10-20
  - title: URL() constructor（相对地址的解析）— MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/API/URL/URL
    checked: 2026-10-20
---

## 部署之前：在本机检查生产构建

f02 讲过：`npm run build` 生成 `dist`，`npm run preview` 用一个本地的静态服务器提供它。部署之前先在本机检查一遍生产构建，比部署之后再发现问题要省事得多。

但 `vite preview` 和真正部署用的静态服务器并不完全一样。下面的实验用 g13 的商店应用（路由有 `/`、`/products`、`/products/:productId`），把 g13 中为了这个网站的预览而使用的 `createHashRouter` 换成部署时用的 `createBrowserRouter`，`npm run build` 之后，用两种服务器打开同样的地址：

| 请求 | `vite preview` | Python 的 `python -m http.server` |
| --- | --- | --- |
| `/` | 200，显示“首页” | 200，显示“首页” |
| `/products/205`（直接打开或者刷新） | 200，显示“咖啡” | **404**（`Error response`） |

`dist` 中只有 `index.html` 和 `assets/`，并没有 `products/205` 这个文件。在页面上点击链接时，路由在浏览器中切换页面，不会向服务器请求 `/products/205`；但**直接打开或者刷新**时，浏览器向服务器请求的就是这个路径。Python 的服务器只会按路径找文件，所以是 404。

`vite preview` 返回了 `index.html`，是因为它和开发服务器一样内置了**回退**（fallback）：找不到文件、并且请求可能接受网页（`Accept` 中有 `text/html` 或者 `*/*`，或者根本没有 `Accept`）时，返回 `index.html`。实测用 `Accept: application/json` 请求同一个地址就是 404。还有一个例外：浏览器为 `<script>` 发出的请求带有 `Sec-Fetch-Dest: script`，Vite 不会对它返回网页（vite 8.3 的源码），所以下面第 3 个问题中缺失的脚本是 404；而用 `fetch` 或 curl 请求同一个地址，得到的却是 200 和网页。所以在 `vite preview` 上一切正常，不代表部署之后也正常。

## 刷新之后的 404：回退

单页应用要求静态服务器做一件事：**找不到文件的页面地址，返回 `index.html`**，由浏览器中的路由决定显示什么。不同的平台写法不同：

- **Vercel**：在 `vercel.json` 中写改写（i01）。可以写 `{ "source": "/(.*)", "destination": "/index.html" }` 匹配一切，也可以像这个网站一样只为页面的地址写规则（`/learn/:lessonId`）。前者简单，代价是找不到的资源也得到 `index.html`（i01 的编程挑战）；
- **GitHub Pages**：不能配置改写，只能提供一个 `404.html`：找不到文件时返回它的内容。常见的做法是把 `index.html` 复制一份成为 `404.html`，或者在 `404.html` 中放一段跳转回首页、再由首页恢复原来地址的脚本（p2-06）。无论哪一种，GitHub Pages 返回 `404.html` 时的状态码都是 404：实测一个用后一种做法部署单页应用的网站（`spa-github-pages.rafgraph.dev`），`/` 是 200，`/example/two` 返回 404（`Server: GitHub.com`），内容是它的 `404.html`。页面最终能显示，但搜索引擎和监控工具看到的是 404；
- **Nginx、Caddy 这样的服务器**：配置“找不到时用 `/index.html`”（Nginx 中是 `try_files $uri $uri/ /index.html;`）；
- **改用 hash 路由**：`createHashRouter` 的地址是 `/#/products/205`，`#` 之后的部分根本不会发给服务器，任何静态服务器都能用。代价是地址难看，而且服务器永远无法区分这些页面。这个网站的练习预览就是因为沙箱的限制而使用了它。

## 资源的路径：base 与 basename

f02 讲过 `base`：部署在子路径（例如 GitHub Pages 的 `https://用户名.github.io/shop/`）上时，资源的地址要加上这个前缀。构建时 `base` 是什么，`index.html` 中的地址就是什么。实测同一个应用：

| 构建时的 `base` | `index.html` 中的脚本 |
| --- | --- |
| `/`（默认） | `src="/assets/index-….js"` |
| `/shop/` | `src="/shop/assets/index-….js"` |
| `./` | `src="./assets/index-….js"` |

文件名中的哈希（这里写成 `…`）随代码和 `base` 变化，几次构建的文件名不完全相同。浏览器按**页面的地址**解析这些地址（MDN 的 `new URL(地址, 页面的地址)` 就是这个规则）：以 `/` 开头的从网站的根开始；`./` 开头的相对于页面所在的“文件夹”。这带来了三个实测到的问题：

:::playground{#resolve}
```ts file=main.ts
const pages = ['https://shop.example/', 'https://shop.example/products', 'https://shop.example/products/205', 'https://user.github.io/shop/'];

for (const page of pages) {
  const root = new URL('/assets/app.js', page).pathname;
  const relative = new URL('./assets/app.js', page).pathname;
  console.log(page.padEnd(34), root.padEnd(22), relative);
}
```
- 第二列是 `/assets/app.js`（`base` 为 `/`）解析的结果：在任何页面上都一样，包括子路径上的 `/shop/`，那里它缺了 `/shop`；
- 第三列是 `./assets/app.js`（`base` 为 `./`）：在 `/products/205` 上变成了 `/products/assets/app.js`，在 `/shop/` 上反而是对的。
:::

1. **部署在 `/shop/` 上，`base` 却是 `/`**：页面请求的是 `/assets/index-….js`（缺了 `/shop`），404，页面一片空白；
2. **`base` 是 `/shop/`，路由却不知道**：资源都加载了，页面上显示的却是“页面不存在”：路由看到的地址是 `/shop/`，而路由表中只有 `/`。要告诉路由它在哪个前缀下：`createBrowserRouter(routes, { basename: '/shop' })`。用 `import.meta.env.BASE_URL` 得到 `base`，就不用在两个地方各写一遍。加上之后实测显示“首页”；
3. **`base` 是 `./`，配合 `createBrowserRouter`**：在 `/products` 上，`./assets/…` 解析成 `/assets/…`，一切正常；在 `/products/205` 上，它被解析成 `/products/assets/…`，实测 Chromium 和 WebKit 中这个脚本都是 404，页面一片空白。相对路径只适合页面都在同一层的网站（或者 hash 路由）。

## 部署之后：冒烟测试

上面的每个问题，都可以在部署之后用几个请求发现：打开每一种页面（首页、列表、详情），检查它的状态码和类型，再检查它引用的每个脚本和样式表能不能加载、类型对不对。这叫**冒烟测试**（smoke test）：不测功能的细节，只确认“通电之后没有冒烟”。

i01 中的表格就是对这个网站做的一次这样的检查（手动的）。它可以是一个手动的清单，也可以是一个脚本，在 CI（f12）中部署完成之后自动运行。下面的小任务先解决其中最容易出错的一步：按页面的地址解析资源的地址；编程挑战写出完整的冒烟测试。

::exercise{#asset-urls}

## 编程挑战

::exercise{#smoke-test}

## 在自己的电脑上做一遍

1. 用“下载本地项目”下载 g13 的 `app-routes` 练习，把 `main.tsx` 中的 `createHashRouter` 换成 `createBrowserRouter`（`import` 也要改），然后 `npm install`、`npm run build`；
2. `npm run preview`，打开 `/products/205` 并刷新：能显示；
3. 在 `dist` 文件夹中运行 `python -m http.server 8000`（需要安装 Python），打开 `http://localhost:8000/products/205`：404。再打开 `http://localhost:8000/`，点击链接进入商品页面：能显示，但刷新之后又是 404；
4. `npx vite build --base=./` 之后再用 `npm run preview` 打开 `/products/205`，在 DevTools 的网络面板中找到那个 404 的脚本，看它的地址；
5. 在 `vite.config.ts` 中设置 `base: '/shop/'`，给 `createBrowserRouter` 加上 `basename`，构建之后把 `dist` 中的内容放进另一个文件夹的 `shop/` 中，在那个文件夹中运行 `python -m http.server`，打开 `http://localhost:8000/shop/`。

::quiz

## 常见错误

- **只在 `vite preview` 上检查**：它有回退，部署的服务器可能没有。用一个没有回退的静态服务器，或者直接在线上刷新深层地址。
- **回退规则写成 `/(.*)`，却忘了它的代价**：找不到的资源也得到 `index.html`，浏览器报的是“类型不对”而不是 404。
- **`base` 和部署的位置不一致**：子路径上资源 404、页面空白。
- **改了 `base`，忘了路由的 `basename`**：资源都加载了，显示的却是“页面不存在”。
- **用 `./` 作为 `base`，同时使用路径路由**：第一层的页面正常，深层的页面空白。
- **以为 GitHub Pages 的 `404.html` 和改写一样**：页面能显示，但状态码是 404。
