---
version: 1
mode: ts
estimatedMinutes: 45
review: ai-draft
problem: 到目前为止，我们写的都是单页应用：服务器只送来一个几乎是空的 index.html 和一些 JavaScript，页面在浏览器中生成，数据在浏览器中请求。这种方式简单、部署便宜，但也有它做不到或者做不好的事：首屏要等 JavaScript 下载、运行完才有内容，密钥不能放在浏览器中，数据要先下载页面再请求。Next.js 是 React 官方推荐的框架之一，它让同一个 React 应用的一部分在服务器上运行：有的页面在构建时就生成好，有的在请求到达时生成，有的先送出一个静态的外壳再把其余的内容流式送来。这一课先看清楚它解决了什么问题，在自己的电脑上创建并构建一个 Next.js 16 的项目，读懂构建输出中的路由表。
objectives:
  - 说出单页应用在首屏、数据请求和密钥上的局限，以及服务端渲染怎样解决它们
  - 知道 Next.js 16 的几个组成部分：App Router、服务端组件与客户端组件、Server Functions、Route Handlers、Cache Components
  - 在自己的电脑上用 create-next-app 创建项目，运行开发服务器、生产构建和生产服务器
  - 读懂 next build 的路由表：○、◐、ƒ 分别表示什么，哪些代码让一个页面变得“动态”
references:
  - title: Installation — Next.js（16.4，随 next 包附带的文档）
    url: https://nextjs.org/docs/app/getting-started/installation
    checked: 2026-10-21
  - title: Building your application（构建输出中的符号）— Next.js
    url: https://nextjs.org/docs/app/guides/building
    checked: 2026-10-21
  - title: Server and Client Components — Next.js
    url: https://nextjs.org/docs/app/getting-started/server-and-client-components
    checked: 2026-10-21
  - title: Caching（Cache Components）— Next.js
    url: https://nextjs.org/docs/app/getting-started/caching
    checked: 2026-10-21
  - title: Creating a React App — React
    url: https://react.dev/learn/creating-a-react-app
    checked: 2026-10-21
---

## 要做什么

H 阶段在服务器上运行 React。这一课先回答三个问题：

1. 单页应用有哪些做不到或者做不好的事，服务端渲染怎样解决它们；
2. Next.js 16 由哪几部分组成，每一部分在 H 阶段的哪一课详细讲；
3. 在自己的电脑上创建一个 Next.js 项目，构建它，读懂构建输出中的**路由表**：每个页面是构建时就生成好的，还是请求到达时才生成的。

Next.js 的代码有一部分运行在服务器上，这个网站的练习运行在浏览器的沙箱中，无法运行它。所以 H 阶段的每一课都分成两部分：能在浏览器中运行的部分（数据处理、校验、请求和响应的逻辑）做成练习；必须在服务器上运行的部分，在你自己的电脑上做，课文中给出实测的结果。

## 单页应用的首屏

在浏览器中打开这个网站的一课时，服务器送来的 HTML 是什么样子的？2026-10-21 用 curl 请求 `https://typescript-workshop-jade.vercel.app/learn/a01-where-ts-runs`：整个 HTML 只有 597 字节，其中 `<div id="root"></div>` 是空的。课文、编辑器，全都是浏览器下载并运行 JavaScript 之后才生成的。这就是单页应用（i01 的“客户端渲染”）：

- **首屏要等 JavaScript**：在 JavaScript 下载、运行完之前，页面是空白的。网络慢、设备慢的时候尤其明显；
- **数据是一串等待**：HTML 到达，再下载 JavaScript，JavaScript 运行之后才开始请求数据（g14），数据到达之后才有内容；
- **不运行 JavaScript 的程序看不到内容**：例如一些搜索引擎的爬虫、聊天软件生成链接预览的程序；
- **浏览器中不能放密钥**：调用需要密钥的接口、直接访问数据库，都必须在服务器上做（i01、e13）。

对这个网站来说，这些代价可以接受：它的内容在构建时就确定了，用户打开之后会停留很久。但很多网站不一样：商品页面要尽快显示，要被搜索引擎收录，数据来自数据库并且随时在变。

## 页面在哪里生成

i01 分过三种情况：在浏览器中生成（客户端渲染），构建时生成（静态生成），请求到达时生成（服务端渲染）。Next.js 让同一个应用中的每个页面，甚至一个页面中的每一部分，分别选择合适的方式：

- **构建时生成**：内容不随请求变化的部分，`next build` 时就渲染成 HTML。部署之后像静态文件一样从 CDN 返回，最快；
- **请求时生成**：内容取决于“是谁在请求”“现在的数据是什么”的部分，在服务器上为每个请求渲染；
- **静态的外壳加上流式的内容**（Partial Prerendering）：页面的框架构建时就生成好，请求到达时立刻送出；需要等待的部分在服务器上准备好之后，接着在同一个响应中送来。用户先看到页面的框架和“正在加载…”，而不是一片空白。

不管哪一种，浏览器收到的都是**已经有内容的 HTML**，然后 React 在浏览器中“接管”它（水合，hydration），之后的交互和单页应用一样。

## Next.js 16 的几个部分

| 部分 | 作用 | 在哪一课 |
| --- | --- | --- |
| App Router | `app/` 文件夹的结构就是路由：`app/projects/[id]/page.tsx` 是 `/projects/:id` 这个页面 | h02 |
| 服务端组件 | 默认的组件只在服务器上运行，可以直接读数据库、使用密钥，它的代码不会发给浏览器 | h03 |
| 客户端组件 | 文件开头写 `'use client'`，可以用 state、事件、浏览器的 API，和 G 阶段的组件一样 | h03 |
| 在服务端读取数据、缓存 | 服务端组件是 `async` 函数，直接 `await` 数据；`'use cache'` 决定哪些结果可以缓存 | h04 |
| Server Functions | `'use server'` 的函数可以在浏览器中调用（例如表单提交），代码在服务器上运行 | h05 |
| Route Handlers | `app/api/…/route.ts` 导出 `GET`、`POST` 等函数，接收 `Request`、返回 `Response` | h06 |
| Proxy | 每个请求到达页面之前运行的代码（Next.js 16 之前叫 Middleware） | h09 |

Next.js 16 还有一个重要的变化：新建的项目默认开启 **Cache Components**。开启之后，所有 App Router 的页面都按“静态的外壳加上流式的内容”的方式渲染，构建时会检查每个页面能不能生成静态的外壳（下面实测）。H 阶段都按这个默认的设置来讲。

## 在自己的电脑上创建一个项目

Next.js 16.4 要求 Node.js 20.9 或者更新的版本。下面的命令和结果都是 2026-10-21 在本机（Windows，Node.js 24.13）实际运行得到的：

```bash
npx create-next-app@16.4.2 demo --ts --app --eslint --no-tailwind --no-src-dir --import-alias "@/*" --use-npm --no-react-compiler --disable-git --no-agent-feedback --yes
```

生成的项目中：

- `package.json` 中是 `next` 16.4.2、`react` 和 `react-dom` 19.3.0，开发依赖中的 TypeScript 是 `^5`（安装的是 5.9.3）；
- `next.config.ts` 中已经写好了 `cacheComponents: true` 和 `partialPrefetching: true`；
- `app/` 中有 `layout.tsx`（所有页面共用的外框）、`page.tsx`（首页）和 CSS；
- 还有一个 `AGENTS.md`，提醒 AI 编程助手先读 `node_modules/next/dist/docs/` 中随版本附带的文档：这个版本的 API 可能和它们“记得”的不一样。这句话对人也适用，这一课的引用就来自那里。

常用的三个命令：

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 开发服务器（默认 http://localhost:3000），修改代码之后自动更新 |
| `npm run build` | 生产构建（默认使用 Turbopack），并打印路由表 |
| `npm start` | 运行构建好的生产服务器 |

在实测的项目中，`npm start` 之后请求 `/projects`，返回的 HTML 中就有 `<h1>项目</h1>`：内容是服务器生成的，不需要等 JavaScript。

## 读懂构建输出

在这个项目中加了几个页面之后（下一课详细讲它们的写法），`npm run build` 打印出这样的路由表：

```text
Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /about
├ ƒ /api/echo
├ ○ /api/health
├   /docs/[[...slug]]
│ └ ◐ /docs/[[...slug]]
├ ○ /projects
├   /projects/[id]
│ ├ ◐ /projects/[id]
│ ├ ○ /projects/p1
│ └ ○ /projects/p2
├   /shop/[...slug]
│ └ ◐ /shop/[...slug]
└ ◐ /time

○  (Static)             prerendered as static content
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content
ƒ  (Dynamic)            server-rendered on demand
```

- **○ 静态**：整个页面构建时就生成好了。`/about`、`/projects` 只显示代码中的数据；`/api/health` 是一个不读取请求的 Route Handler，它的响应也在构建时生成；
- **◐ 部分预渲染**：构建时生成了静态的外壳，其余的部分在请求到达时生成。`/time` 显示当前的时间，这部分包在 `<Suspense>` 中，必须在请求时才能算出来；
- **ƒ 动态**：完全在请求时生成。`/api/echo` 读取了请求中的查询参数，每个请求都不一样；
- **一组**：`/projects/[id]` 这样的动态路由下面列出了构建时已经生成的几个地址（`/projects/p1`、`/projects/p2`，来自 `generateStaticParams`，h02），以及其他地址的“后备”（`◐ /projects/[id]`）。

没有开启 Cache Components 的项目中还会看到 `●`（SSG：从 `generateStaticParams` 生成的静态页面）。

这张表值得在每次构建时看一眼：一个本来是 ○ 的页面变成了 ◐ 或 ƒ，往往是因为有人在里面读了 cookie、请求头或者当前的时间，每个请求都要在服务器上重新渲染，变慢了，也更贵了。

开启 Cache Components 之后，构建还会**检查**每个页面能不能生成静态的外壳。在实测的项目中，一个页面在 `<Suspense>` 之外读取了路由参数，构建直接失败了：

```text
Error: Route "/docs/[[...slug]]": Next.js encountered uncached or runtime data during prerendering.
```

下一课讲怎样修改它。

:::playground{#route-line}
```ts file=main.ts
const lines = ['├ ○ /about', '│ └ ◐ /docs/[[...slug]]', '├   /projects/[id]', '└ ƒ /api/echo'];

for (const line of lines) {
  const match = /^(│ | {2})?[┌├└] (?:(\S) | {2})(\S.*)$/.exec(line);
  console.log(JSON.stringify(line), match === null ? '不匹配' : { indent: match[1] ?? '', symbol: match[2] ?? '（组标题）', path: match[3] });
}

console.log([...'├○◐ƒ│'].map((c) => `${c} U+${c.codePointAt(0)?.toString(16).toUpperCase()}`).join('  '));
```
- 第 4 行的正则依次匹配：可选的缩进（`│ ` 或两个空格）、树形符号 `┌├└` 和一个空格，然后是“一个符号加空格”或者“两个空格”（组标题），最后是地址；
- 组标题那一行没有符号，所以第二个分组是 `undefined`；
- 第 8 行：这些符号都不是 ASCII 字符，但每一个都只占一个 UTF-16 码元，`\S` 可以匹配它们。
:::

::exercise{#parse-route-table}

## 编程挑战

::exercise{#compare-builds}

::quiz

## 常见错误

- **以为服务端渲染之后就不需要 JavaScript 了**：HTML 让内容先显示出来，交互仍然要等 React 在浏览器中接管（水合）。
- **以为 Next.js 的页面都在服务器上运行**：客户端组件的代码仍然会发给浏览器并在那里运行，服务端组件才只在服务器上运行（h03）。
- **凭记忆写 Next.js 的代码**：Next.js 的大版本之间变化很大（例如 16 把 Middleware 改名为 Proxy，新项目默认开启 Cache Components）。以项目中安装的版本附带的文档为准。
- **不看构建输出**：一个页面悄悄从 ○ 变成了 ƒ，只有路由表会告诉你。

## 下一步

h02 讲 App Router 的路由约定：页面、布局、动态路由、路由组，以及 Cache Components 开启时怎样读取路由参数。
