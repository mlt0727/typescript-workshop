---
version: 1
mode: ts
estimatedMinutes: 50
review: ai-draft
problem: 项目面板要上线了。它是一个单页应用，用的是真实的路径（/projects/p1），i02 讲过这意味着什么：直接打开或者刷新深层的地址时，静态服务器要返回 index.html，资源和路由都要知道应用部署在哪个路径下。这一课把这些落实到项目面板上：从路由表生成部署平台的改写规则，让两者不会不一致；在只能提供 404.html 的 GitHub Pages 上，用一次跳转让深层地址也能打开，并且不让这个跳转被人利用；最后在每次部署之后自动运行冒烟测试。
objectives:
  - 根据平台的能力选择部署方式：改写（200）、404.html 加跳转、hash 路由，知道各自的代价
  - 从 React Router 的路由表算出所有页面的地址模式，生成 vercel.json 的改写规则，或者用测试检查两者一致
  - 在 GitHub Pages 上用 404.html 把原来的地址带到首页，再用 history.replaceState 恢复
  - 先用 URL 解析、再检查来源和路径，防止开放重定向
  - 用 GitHub Actions 的 status 事件在部署成功之后运行冒烟测试
references:
  - title: Rewrites — Vercel
    url: https://vercel.com/docs/rewrites
    checked: 2026-10-21
  - title: Creating a custom 404 page for your GitHub Pages site — GitHub Docs
    url: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site
    checked: 2026-10-21
  - title: spa-github-pages（用 404.html 跳转的一种实现）— rafgraph
    url: https://github.com/rafgraph/spa-github-pages
    checked: 2026-10-21
  - title: History.replaceState() — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/API/History/replaceState
    checked: 2026-10-21
  - title: Unvalidated Redirects and Forwards Cheat Sheet — OWASP
    url: https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html
    checked: 2026-10-21
  - title: Events that trigger workflows — status — GitHub Docs
    url: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#status
    checked: 2026-10-21
---

## 要做什么

1. 部署之后，项目面板每个页面的地址（`/projects`、`/projects/p1`、`/projects/p1/edit`……）直接打开、刷新都能显示；**找不到的地址仍然是 404**；
2. 路由表改了，部署的配置跟着改，不靠人记得同时改两个地方；
3. 部署到 GitHub Pages 的子路径（`https://用户名.github.io/shop/`）时，深层的地址也能打开，并且这个机制不能被人用来把访问者带到别的网站；
4. 每次部署之后，自动检查页面和资源（i02 的冒烟测试），有问题时有人知道。

## 选择部署的方式

| 方式 | 适用的平台 | 深层地址的状态码 | 代价 |
| --- | --- | --- | --- |
| 改写：页面的地址返回 `index.html` | Vercel、Netlify、Cloudflare Pages、自己的 Nginx | 200 | 要配置规则；规则要和路由表一致 |
| `404.html` 跳转到首页，首页再恢复地址 | GitHub Pages 这类只能提供 `404.html` 的平台 | 第一次是 404，再跳转一次 | 多一次请求，页面闪一下；搜索引擎看到的是 404 |
| hash 路由（`createHashRouter`） | 任何静态服务器 | 200（`#` 之后不发给服务器） | 地址难看；服务器无法区分页面 |

能配置改写的平台，首选改写。

## 从路由表生成改写规则

i01、i02 比较过两种改写：`/(.*)` 匹配一切，简单，但找不到的资源也得到了 `index.html`；只为页面的地址写规则，找不到的地址仍然是 404，但规则要和路由表一致。后者容易出的问题是：加了一个页面，忘了加规则，这个页面在本地一切正常，部署之后一刷新就是 404。

页面的地址本来就写在路由表中。React Router 的 `:projectId` 和 vercel.json 的 `:projectId` 写法相同（都来自 path-to-regexp 一类的语法，i01），所以可以直接从路由表算出改写规则：

```ts
// 项目面板的路由表（只看和地址有关的部分）
[{ path: '/', children: [
  { index: true },
  { path: 'projects', children: [{ index: true }, { path: 'new' }, { path: ':projectId' }, { path: ':projectId/edit' }] },
  { path: '*' },
] }]
// → 页面：/、/projects、/projects/new、/projects/:projectId、/projects/:projectId/edit
```

有两种用法：

- **生成**：一个脚本在构建之前写出 `vercel.json`；
- **检查**：`vercel.json` 照常手写，加一个单元测试，比较其中的 `rewrites` 和从路由表算出来的结果。加了页面却忘了改 `vercel.json`，CI（f12）就会失败。

```ts
test('vercel.json 的改写规则与路由表一致', () => {
  const config: unknown = JSON.parse(readFileSync('vercel.json', 'utf8'));
  expect(config).toMatchObject({ rewrites: vercelRewrites(routes) });
});
```

带 `*` 的路由（“页面不存在”）不生成规则：它的意思正是“其他所有的地址”，交给平台返回 404。两边的 `*` 写法也不同（React Router 的 `*`，vercel.json 中是 `:path*` 或 `(.*)`）。

::exercise{#route-rewrites}

## GitHub Pages：用 404.html 转一次

GitHub Pages 不能配置改写，只能提供一个 `404.html`：找不到文件时，返回它的内容，状态码是 404（i02 实测）。常见的做法是让 `404.html` 带着原来的地址跳转到首页，首页再把地址恢复过来：

1. 访问者打开 `https://user.github.io/shop/projects/p1?status=active`；
2. 没有这个文件，GitHub Pages 返回 `404.html`，其中的脚本把原来的地址放进查询参数，跳转到首页：`/shop/?p=projects%2Fp1%3Fstatus%3Dactive`；
3. `index.html` 加载，**在创建路由之前**，脚本读出 `p`，用 `history.replaceState` 把地址栏换回 `/shop/projects/p1?status=active`。它不会重新加载页面，也不会新增历史记录；
4. 路由（`basename: '/shop'`，i02）看到的就是原来的地址。

[rafgraph/spa-github-pages](https://github.com/rafgraph/spa-github-pages) 是这个做法的一个常用实现（它的编码方式不同，原理一样）。

### 不要相信地址中的 p

第 3 步中的 `p` 来自地址栏，任何人都可以构造一个链接发给别人：`https://user.github.io/shop/?p=…`。如果首页拿到 `p` 就直接用 `location.replace(…)` 跳过去，这个网站就成了一个**开放重定向**（open redirect）：链接看起来指向你的网站，点开却到了别人的网站，很适合用来钓鱼（OWASP）。即使用的是 `history.replaceState`，一个跨网站的地址也会让它抛出异常，页面就打不开了。

检查 `p` 的时候，不要只看字符串：URL 的解析规则有很多出人意料的地方。先把它交给 `URL` 解析，再检查解析的**结果**：

:::playground{#tricky-urls}
```ts file=main.ts
const origin = 'https://user.github.io';

for (const path of ['/projects', '//evil.example/x', '/\\evil.example', '/shop/../admin', '/shop/%2e%2e/admin', '/shop/https://evil.example']) {
  const url = new URL(path, origin);
  console.log(path.padEnd(28), url.origin === origin ? '同一个网站' : `另一个网站 ${url.origin}`, url.pathname);
}
```
- `//evil.example/x` 以 `//` 开头，是一个省略了协议的完整网址，指向另一个网站；
- `/\evil.example`：对于 `https` 这样的地址，解析时 `\` 和 `/` 一样，所以它也是 `//evil.example`；
- `/shop/../admin`、`/shop/%2e%2e/admin`：`..`（包括编码之后的 `%2e%2e`）会退回上一级，结果离开了 `/shop/`；
- `/shop/https://evil.example` 只是网站中一个奇怪的路径，并不会离开这个网站。
- 只检查“是不是以 `/` 开头”“有没有 `..`”这样的字符串规则，总会漏掉一些写法。解析之后检查 `origin` 和 `pathname`，规则就只有两条。
:::

## 部署之后自动检查

i02 写了冒烟测试：打开每一种页面，检查状态码、类型和引用的资源。它应该在每次部署之后自动运行。

这个网站在 Vercel 上，Vercel 每完成一次部署，就给 GitHub 上对应的提交设置一个名为 `Vercel` 的**状态**（commit status，实测这个仓库的提交上就有）。GitHub Actions 可以在提交的状态变化时运行（`on: status`），所以：

```yaml
name: 部署之后的冒烟测试
on: status
jobs:
  smoke:
    # 只在 Vercel 部署成功、并且是 main 分支（生产环境）的提交时运行
    if: github.event.context == 'Vercel' && github.event.state == 'success' && contains(github.event.branches.*.name, 'main')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
      # 脚本没有依赖，Node 24 可以直接运行 TypeScript（去掉类型）
      - run: node scripts/smoke-live.ts https://你的网站.vercel.app
```

- 这个网站的仓库中就有这样一个工作流（`.github/workflows/smoke.yml`，脚本是 `scripts/smoke-live.ts`）：2026-10-21 起，每次生产部署成功之后，它检查几个页面和它们的资源、`/api/health`，以及几个应该是 404 的地址（大小写不同、结尾多了斜杠、不存在）。状态是 `pending` 的那次事件，`if` 的条件不满足，工作流被跳过；
- 这个事件只认**默认分支**上的工作流文件；
- 冒烟测试失败时，这次运行就显示为失败；还可以在失败时发出通知，或者调用平台的回滚（i03）；
- 不在 Vercel 上的话，也可以在部署的工作流中，部署那一步之后直接运行冒烟测试。

## 编程挑战

::exercise{#pages-redirect}

::quiz

## 常见错误

- **用 `/(.*)` 回退一切**：找不到的资源、拼错的地址也都是 200 和一个网页，问题被掩盖了（i01、i02）。
- **手写两份页面列表**：路由表一份，部署配置一份，迟早不一致。生成，或者用测试检查。
- **为“页面不存在”的路由也写改写**：`*` 的意思是“其他所有地址”，它们应该是真正的 404。
- **404.html 跳转之后忘了恢复地址**，或者在创建路由之后才恢复：路由看到的是首页。
- **直接使用地址中的 `p`**：开放重定向。先解析，再检查 `origin` 和路径。
- **只用字符串规则检查网址**：`//`、`\`、`%2e%2e` 总有一种会漏掉。
- **部署之后不检查**：问题要等用户来发现。

## 下一步

项目 2 完成了。H 阶段开始写服务端：用 Next.js 在服务器上渲染页面、读写数据；项目 3 会把项目面板的数据放到真正的服务器和数据库中。
