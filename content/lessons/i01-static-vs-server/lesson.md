---
version: 1
mode: ts
estimatedMinutes: 50
review: ai-draft
problem: 到目前为止写的网站都是“静态”的：构建之后得到一个 dist 文件夹，部署就是把这些文件放到服务器上，所有的代码都在用户的浏览器中运行。有些事情静态网站做不到：保存一份所有设备都能读到的数据、保管密钥、在返回页面之前查询数据库。这一课讲清楚静态站点与服务端应用的分界，以及部署平台收到一个请求之后，按什么顺序决定由谁来处理它。例子就是这个网站自己在 Vercel 上的部署，课中的结果都是对线上实际发出请求得到的。
objectives:
  - 区分静态站点与服务端应用：代码在哪里运行、什么时候运行、能接触到什么
  - 判断一个功能是否需要服务端：密钥、跨设备共享的数据、不能交给浏览器的检查
  - 说出部署平台处理一次请求的顺序：重定向、静态文件与函数、改写、404
  - 读懂 vercel.json 中 rewrites 的路径模式：路径参数、通配、SPA 的回退，以及大小写和结尾的斜杠
references:
  - title: Static Configuration with vercel.json（rewrites）— Vercel Docs
    url: https://vercel.com/docs/project-configuration/vercel-json
    checked: 2026-10-20
  - title: Rewrites on Vercel — Vercel Docs
    url: https://vercel.com/docs/routing/rewrites
    checked: 2026-10-20
  - title: Vercel Functions — Vercel Docs
    url: https://vercel.com/docs/functions
    checked: 2026-10-20
  - title: path-to-regexp 6.3.0（vercel.json 的路径模式语法）
    url: https://github.com/pillarjs/path-to-regexp/tree/v6.3.0
    checked: 2026-10-20
  - title: Rendering on the Web — web.dev
    url: https://web.dev/articles/rendering-on-the-web
    checked: 2026-10-20
---

## 两种网站

**静态站点**：构建时（f02、f12）生成一组文件，部署之后，服务器对每个请求只做一件事：找到对应的文件，原样返回。同一个地址，所有用户拿到的都是同一份文件，所以它可以放在 CDN（遍布各地的缓存服务器）上，离用户很近、很快、很便宜。页面上的一切变化都是浏览器中的 JavaScript 做的。p1 的任务板就是这样：它的数据保存在浏览器的 localStorage 中，服务器根本不知道。

**服务端应用**：有一部分代码运行在服务器上，**每个请求都运行一次**。它可以读写数据库、使用密钥、根据是谁在请求返回不同的结果。代价是要有一台（或者一组）一直能运行代码的服务器，要考虑它的出错、日志、安全和费用（i03）。

| | 静态站点 | 服务端应用 |
| --- | --- | --- |
| 代码在哪里运行 | 只在浏览器中 | 浏览器中，以及服务器上 |
| 页面什么时候生成 | 构建时，或者在浏览器中 | 也可以在每个请求到达时 |
| 能保管密钥吗 | 不能：发给浏览器的一切用户都能看到（e13） | 能：密钥只留在服务器上 |
| 能保存所有设备共享的数据吗 | 不能（只能存在各自的浏览器中） | 能：存在服务器端的数据库中 |
| 部署的是什么 | 一个文件夹 | 文件夹，加上要运行的代码 |

两者常常混合使用。**这个网站**就是一个例子：页面、课程内容、编译器、沙箱全是构建出来的静态文件（`dist`）；只有两件事需要服务端：跨设备同步进度（数据存在数据库中，要验证同步密码），和“问 AI”（API 密钥不能发给浏览器）。它们由仓库中的 `api/index.ts` 处理，在 Vercel 上作为一个**函数**（Vercel Function）部署：平时不占用服务器，有请求时才启动运行。

2026-10-20 对线上的网站实际发出请求，得到的结果：

| 请求 | 状态 | 内容类型 | 由谁处理 |
| --- | --- | --- | --- |
| `/` | 200 | `text/html` | 静态文件 `index.html` |
| `/learn/a01-where-ts-runs` | 200 | `text/html` | 改写到 `index.html`（见下文） |
| `/favicon.svg` | 200 | `image/svg+xml` | 静态文件 |
| `/api/health` | 200 | `application/json`，`cache-control: no-store` | 函数 |
| `/api/sync`（没有带同步密码） | 401 | `application/json` | 函数：拒绝了请求 |
| `/does-not-exist` | 404 | `text/plain` | 平台自己的 404 |

## 什么时候需要服务端

问自己三个问题：

1. **要用到密钥吗？** 调用 AI、支付、发邮件的接口都需要密钥。密钥一旦进了前端的代码，就等于公开了（e13）。必须由服务端代为调用；
2. **数据要在设备之间、用户之间共享吗？** localStorage 只属于一个浏览器。要在手机和电脑上看到同一份数据，就要存在服务器上；
3. **有不能交给浏览器的检查吗？** 浏览器中的代码用户可以随意修改：在前端检查“密码对不对”“这个操作允许不允许”，相当于没有检查。真正的检查必须在服务端做，前端的检查只是为了更快地给用户反馈（d09）。

三个都是“不”，静态站点就够了。很多看起来“动态”的功能其实不需要服务端：在浏览器中调用公开的接口（e05）、把数据存在 localStorage（p1-05）、在构建时生成页面。

## 页面在什么时候生成

H 阶段会用 Next.js 做服务端的部分。在那之前，先分清页面的 HTML 可以在三个时候生成：

- **在浏览器中**（客户端渲染，CSR）：服务器返回一个几乎是空的 `index.html` 和 JavaScript，页面由 JavaScript 生成。p1、G 阶段的应用都是这样；
- **构建时**（静态生成，SSG）：构建时就把每个页面的 HTML 生成好，部署的是现成的 HTML 文件。适合内容很少变化的页面（文档、博客）；
- **请求到达时**（服务端渲染，SSR）：每个请求都在服务器上生成一次 HTML。适合每个人看到的内容都不同、或者变化很快的页面。

前两种都可以部署为静态站点，只有第三种需要服务器一直能运行代码。

## 一个请求经过哪些步骤

单页应用有一个静态站点特有的问题：`/learn/a01-where-ts-runs` 并不是 `dist` 中的一个文件，页面的路由是浏览器中的 JavaScript 根据地址决定的（e10、g13）。用户直接打开这个地址、或者在这个页面上刷新时，服务器收到的就是这个路径，必须返回 `index.html`，否则就是 404（下一课专门讲）。

Vercel 用 `vercel.json` 配置这些规则。这个网站的配置中有三条**改写**（rewrite）：服务器返回另一个文件或者交给函数处理，但浏览器的地址栏不变。

```json
"rewrites": [
  { "source": "/api/:path*", "destination": "/api" },
  { "source": "/learn/:lessonId", "destination": "/index.html" },
  { "source": "/settings", "destination": "/index.html" }
]
```

Vercel 的文档说明了处理的顺序：**重定向**（redirect）总是在改写之前处理；**存在的文件优先于改写**（“precedence is given to the filesystem prior to rewrites being applied”）；改写的目标是函数时，路径中的参数作为查询参数交给函数。所以：

1. 先看重定向：匹配时直接返回 308（永久）或 307（临时）和新的地址，浏览器会再请求一次新的地址；
2. 再看文件和函数：`/favicon.svg` 是一个文件，直接返回；`/sandbox` 是一个文件夹，返回其中的 `index.html`；
3. 都不是时，按顺序找第一条匹配的改写；
4. 什么都没有匹配，返回 404。

`source` 的写法来自 path-to-regexp 这个库：`:lessonId` 匹配正好一段，`:path*` 匹配零段或多段，`(.*)` 匹配剩下的一切。有两点很容易出错，实测这个网站：

- **区分大小写**：`/Settings`、`/Learn/a01-where-ts-runs`、`/Index.html` 都是 404；
- **结尾的斜杠不能多**：`/settings` 是 200，`/settings/` 和 `/learn/a01-where-ts-runs/` 都是 404。直接使用 path-to-regexp 时，它默认既不区分大小写，也允许结尾多一个斜杠，Vercel 的匹配与这两个默认值不同。

还有一个容易忽略的地方：这个网站的 `headers` 中给 `/assets/(.*)` 加上了“缓存一年”的响应头。实测请求一个不存在的 `/assets/missing-abc123.js`，返回的 404 也带着 `cache-control: public, max-age=31536000, immutable`：响应头的规则按路径匹配，不管文件存不存在。因为文件名中带有内容的哈希，同一个名字以后也不会变成一个真的文件，这里没有问题；但对没有哈希的路径，这样的规则可能让浏览器长期缓存一个 404。

:::playground{#first-match}
```ts file=main.ts
type Rule = { source: string; destination: string };

const rules: Rule[] = [
  { source: '/settings', destination: '/index.html' },
  { source: '/old', destination: '/new.html' },
];
const files = new Set(['/index.html', '/new.html', '/old']);

/** 只支持固定路径的简化版：先看文件，再看改写 */
function serve(path: string): string {
  if (files.has(path)) return `文件 ${path}`;
  const rule = rules.find((r) => r.source === path);
  return rule ? `改写到 ${rule.destination}` : '404';
}

for (const path of ['/settings', '/settings/', '/Settings', '/old', '/missing']) {
  console.log(path.padEnd(12), serve(path));
}
```
- `/old` 既是一个文件，又匹配一条改写：文件优先，改写不起作用。Vercel 的文档因此建议：`source` 不要写成一个存在的文件；
- `/settings/` 和 `/Settings` 都不等于 `/settings`，没有规则匹配。下面的小任务实现带参数的模式，编程挑战实现完整的顺序。
:::

::exercise{#match-pattern}

## 编程挑战

::exercise{#route-request}

::quiz

## 常见错误

- **把密钥放进前端的环境变量**：所有发给浏览器的东西都是公开的。需要密钥的调用放到函数中（e13）。
- **以为“动态”的功能都需要服务器**：调用公开的接口、保存在 localStorage、构建时生成页面，都不需要。先问三个问题。
- **单页应用没有配置回退**：刷新或者直接打开深层的地址时得到 404（i02）。
- **改写的 `source` 写成了一个存在的文件**：文件优先，这条改写永远不会生效。
- **忽略了大小写和结尾的斜杠**：`/settings` 不匹配 `/settings/`。需要时另写一条规则，或者用重定向把一种写法统一到另一种。
- **把前端的检查当成安全措施**：用户可以修改浏览器中运行的任何代码。权限和密码必须在服务端检查。
