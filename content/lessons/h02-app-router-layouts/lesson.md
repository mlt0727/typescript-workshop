---
version: 1
mode: ts
estimatedMinutes: 50
review: ai-draft
problem: 在 g13 中，路由是我们自己在代码中写的一张表：哪个地址显示哪个组件、哪些页面共用一个外框。Next.js 的 App Router 把这张表交给文件夹：app/projects/[id]/page.tsx 就是 /projects/:id 这个页面，app/projects/layout.tsx 就是这些页面共用的外框。这样一来，“哪个文件是页面”“地址中的参数是什么”“几个路由都能匹配时用哪一个”都由约定决定。这一课讲清楚这些约定，并在实测的 Next.js 16.4.2 项目中确认它们的细节：哪些文件产生路由，布局在导航时保留什么，动态路由的参数长什么样，开启 Cache Components 时怎样读取参数，以及地址有多余的斜杠、大小写不同、包含编码时会发生什么。
objectives:
  - 根据文件的路径说出它产生的路由：page 与 route 文件、动态段、路由组、私有文件夹
  - 用布局组织共用的界面，知道用 Link 导航时布局的状态会保留
  - 读取动态路由的参数：params 是 Promise，PageProps 等类型帮助函数，generateStaticParams 与 notFound
  - 在开启 Cache Components 时正确地读取参数，读懂构建失败的错误
  - 说出几个路由都能匹配同一个地址时 Next.js 选择哪一个，并实现这个匹配
references:
  - title: Layouts and Pages — Next.js（16.4，随 next 包附带的文档）
    url: https://nextjs.org/docs/app/getting-started/layouts-and-pages
    checked: 2026-10-21
  - title: Project structure and organization — Next.js
    url: https://nextjs.org/docs/app/getting-started/project-structure
    checked: 2026-10-21
  - title: Dynamic Route Segments — Next.js
    url: https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes
    checked: 2026-10-21
  - title: Linking and Navigating — Next.js
    url: https://nextjs.org/docs/app/getting-started/linking-and-navigating
    checked: 2026-10-21
  - title: generateStaticParams — Next.js
    url: https://nextjs.org/docs/app/api-reference/functions/generate-static-params
    checked: 2026-10-21
  - title: decodeURIComponent() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/decodeURIComponent
    checked: 2026-10-21
---

## 要做什么

g13 用 React Router 写过一张路由表。App Router 中没有这张表：**文件夹的结构就是路由表**。这一课回答：

1. `app/` 中的哪些文件产生路由，地址是什么；
2. 布局怎样包住页面，导航时保留什么；
3. 动态路由的参数怎样读取，开启 Cache Components 之后有什么要求；
4. 几个路由都能匹配同一个地址时，Next.js 用哪一个。

下面的结果都来自 2026-10-21 在本机运行的 Next.js 16.4.2 项目（h01 创建的那个，用 `next build` 和 `next start`）。两个练习在浏览器中实现其中可以移植的逻辑：从文件得到路由，从地址找到路由。

## 文件夹是地址，文件名是内容

`app/` 中的每个文件夹是地址中的一段，文件夹中的特殊文件决定这一段上显示什么：

| 文件 | 作用 |
| --- | --- |
| `page.tsx` | 这个地址的页面，有了它这个地址才能访问 |
| `route.ts` | Route Handler：导出 `GET`、`POST` 等函数，返回 `Response`（h06） |
| `layout.tsx` | 包住这一段和它下面所有页面的布局 |
| `loading.tsx`、`error.tsx`、`not-found.tsx` | 加载中、出错、找不到时显示的内容（h04、h06） |
| `template.tsx` | 和布局类似，但每次导航都重新创建 |

所以 `app/projects/[id]/page.tsx` 是 `/projects/[id]` 这个页面，`app/api/health/route.ts` 是 `/api/health` 这个接口。几个实测的细节：

- **扩展名**：`page.ts`、`route.tsx`、`route.jsx` 都产生了路由，默认的四种扩展名（`tsx`、`ts`、`jsx`、`js`）对两种文件都有效；
- **只有 `page` 和 `route` 产生路由**：文件夹中只有 `layout.tsx` 或者其他代码时，这个地址仍然是 404。`app/lab-test/route.test.ts` 没有出现在路由表中：文件名要完整地是 `route` 加扩展名；
- **私有文件夹**：名字以 `_` 开头的文件夹和它里面的所有东西都不参与路由。实测项目中的 `app/_priv/page.tsx` 不在路由表中，请求 `/_priv` 返回 404。把只在一个页面中用到的组件、数据放在旁边的 `_components/`、`_lib/` 中，是常见的做法；
- **路由组**：名字用圆括号括起来的文件夹（例如 `(marketing)`）只用来组织文件，不出现在地址中：`app/(marketing)/about/page.tsx` 是 `/about`。它的一个用途是让一部分页面共用一个布局，而不改变它们的地址。

不在 `app/` 中的文件不是 App Router 的路由（使用 `src/` 文件夹时，是 `src/app/`）。

::exercise{#file-route}

## 布局

根布局 `app/layout.tsx` 是必须的，它必须输出 `<html>` 和 `<body>`。实测项目中 create-next-app 生成的根布局是这样的（省略了字体）：

```tsx
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`children` 是这一层下面的页面或者下一层的布局。`LayoutProps<'/'>` 是 Next.js 在构建和开发时生成的全局类型，参数是这个布局所在的路由，它知道这一层有哪些参数，不需要导入。

在 `app/projects/` 中再加一个布局，`/projects` 下面的所有页面都会被它包住，它又被根布局包住：

```tsx
// app/projects/layout.tsx
import Link from 'next/link';
import { Counter } from './_components/counter';

export default function ProjectsLayout({ children }: LayoutProps<'/projects'>) {
  return (
    <section>
      <nav>
        <Link href="/projects">全部</Link> <Link href="/projects/p1">p1</Link> <Link href="/projects/p2">p2</Link>
      </nav>
      <Counter />
      {children}
    </section>
  );
}
```

`Counter` 是一个客户端组件（文件开头是 `'use client'`，h03 详细讲），里面用 `useState` 记录按钮被点了几次。在浏览器中实测：

1. 打开 `/projects`，点两次按钮，按钮上显示“布局中的计数：2”；
2. 点布局中的链接 `p1`：地址变成 `/projects/p1`，标题变成了这个项目的名字，**按钮上仍然是 2**，之前在 `window` 上设置的一个标记也还在：浏览器没有加载新的页面，只有 `children` 换了；
3. 用 `location.assign('/projects/p2')` 跳转：浏览器加载了新的页面，按钮回到 0，标记也没有了。

这就是官方文档说的：导航时布局保留状态、保持可交互、不重新渲染。导航栏、侧栏、播放器这类要在页面之间保持的东西，适合放在布局中。反过来，需要每个页面都重新开始的状态不要放在布局中。

## 链接与导航

上面的第 2 步和第 3 步的区别就是 `<Link>` 和普通跳转的区别。`next/link` 的 `<Link>` 渲染成一个普通的 `<a>`（不运行 JavaScript 时也能用），运行 JavaScript 之后，点击它只请求新页面需要的部分，在当前页面中替换。链接进入视口或者鼠标移到它上面时，它还会预先获取目标页面：静态的页面全部获取，动态的页面只获取共用的布局和 `loading.tsx` 这样的部分（或者不获取）。点击时需要等待的就少了。

在 App Router 中写站内链接，用 `<Link>`；只有确实需要整页加载时（例如跳到另一个应用），才用普通的 `<a>` 或 `location`。

## 动态路由

文件夹名用方括号括起来是动态段，它的值从地址中得到。三种写法和实测的参数（用 Route Handler 把 `params` 原样返回）：

| 文件夹 | 地址 | `params` |
| --- | --- | --- |
| `[id]` | `/api/one/p1` | `{ id: 'p1' }` |
| `[...slug]`（捕获段） | `/shop/a/b` | `{ slug: ['a', 'b'] }`；`/shop` 是 404 |
| `[[...slug]]`（可选的捕获段） | `/api/r/a` | `{ slug: ['a'] }` |
| `[[...slug]]` | `/api/r` | `{}`：`'slug' in params` 是 `false` |

参数的值是**解码之后**的：`/api/one/%E5%AE%98` 的 `id` 是 `'官'`，`/api/one/a%2Fb` 的 `id` 是 `'a/b'`，编码的斜杠仍然在同一段中。

在页面中，`params` 是一个 **Promise**（从 Next.js 15 开始），要 `await`。`PageProps<'/projects/[id]'>` 中 `params` 的类型是 `Promise<{ id: string }>`：

```tsx
// app/projects/[id]/page.tsx
import { notFound } from 'next/navigation';
import { PROJECTS } from '../_lib/data';

export async function generateStaticParams() {
  return PROJECTS.map((p) => ({ id: p.id }));
}

export default async function ProjectPage({ params }: PageProps<'/projects/[id]'>) {
  const { id } = await params;
  const project = PROJECTS.find((p) => p.id === id);
  if (!project) notFound();
  return <h1>{project.name}</h1>;
}
```

- `generateStaticParams` 返回构建时就生成的那些参数。h01 的路由表中，`/projects/p1`、`/projects/p2` 是 ○，就是它的结果；
- `notFound()` 显示“找不到”的页面。它的返回类型是 `never`，所以后面的 `project` 已经收窄成了 `Project`（b06、b07）；
- 参数的类型是 `string`，但它的值是任何人都可以在地址栏中随便输入的。不在数据中的 `id` 要当作“找不到”，而不是让程序在后面出错。

实测请求一个不存在的 `/projects/p4`：**第一次**返回 200，HTML 中有 `<meta name="robots" content="noindex"/>` 和 404 的内容；之后再请求同一个地址返回 404。原因是这个页面先送出了静态的外壳，响应已经开始了，状态码来不及修改；第一次渲染之后，Next.js 记住了这个结果。搜索引擎会因为 `noindex` 而不收录它，但用状态码判断页面是否存在的程序（例如 i02 的冒烟测试）要注意这一点。

## Cache Components 与路由参数

开启 Cache Components 之后，构建时要为每个页面生成静态的外壳。没有 `generateStaticParams` 的动态路由，构建时不知道参数是什么，参数就是“请求时的数据”。h01 中，`app/docs/[[...slug]]/page.tsx` 一开始在顶层 `await params`，构建失败了：

```text
Error: Route "/docs/[[...slug]]": Next.js encountered uncached or runtime data during prerendering.
```

改法有两种：

1. **把读取参数的部分放进 `<Suspense>`**：外壳构建时生成，参数相关的部分在请求时生成。路由表中这个页面是 ◐：

   ```tsx
   export default function Docs({ params }: PageProps<'/docs/[[...slug]]'>) {
     return (
       <main>
         <h1>文档</h1>
         <Suspense fallback={<p>正在加载…</p>}>
           {params.then(({ slug }) => <p>docs: {JSON.stringify(slug ?? null)}</p>)}
         </Suspense>
       </main>
     );
   }
   ```

   页面组件本身不再是 `async`，`params.then(...)` 得到一个 Promise，React 在 `<Suspense>` 中等待它；
2. **提供 `generateStaticParams`**：构建时用这些参数实际渲染页面，检查通过之后生成静态的 HTML。上面的 `/projects/[id]` 就是这样，它可以在顶层 `await params`。不在列表中的参数在第一次请求时渲染，成功之后保存下来。

## 一个地址匹配哪个路由

几个路由可能都能匹配同一个地址。实测项目中有这样几个 Route Handler：`/api/r/[[...slug]]`、`/api/r/intro`、`/api/r/guides/[id]`、`/api/r/guides/[id]/edit`，每个都返回自己的模式和参数：

| 地址 | 匹配的路由 | `params` |
| --- | --- | --- |
| `/api/r` | `/api/r/[[...slug]]` | `{}` |
| `/api/r/intro` | `/api/r/intro` | `{}` |
| `/api/r/intro/x` | `/api/r/[[...slug]]` | `{ slug: ['intro', 'x'] }` |
| `/api/r/guides` | `/api/r/[[...slug]]` | `{ slug: ['guides'] }` |
| `/api/r/guides/a` | `/api/r/guides/[id]` | `{ id: 'a' }` |
| `/api/r/guides/a/edit` | `/api/r/guides/[id]/edit` | `{ id: 'a' }` |
| `/api/r/guides/a/b` | `/api/r/[[...slug]]` | `{ slug: ['guides', 'a', 'b'] }` |

规律是：**越具体的越优先**。同一个位置上，固定的段优先于动态段，动态段优先于捕获段，捕获段优先于可选的捕获段；更具体的路由匹配不上时，退回到不那么具体的。`/projects/new` 和 `/projects/[id]` 都能匹配 `/projects/new`，实测显示的是“新建项目”这个页面。这个顺序只取决于路由的形状，与文件的创建顺序无关。

地址本身的几个细节：

- 结尾的 `/`：`/projects/` 返回 **308**，`Location: /projects`（Next.js 默认去掉结尾的斜杠）；
- 区分大小写：`/Projects` 是 **404**；
- 无法解码的地址：`/api/one/%E4` 返回了 **500**（`%E4` 是一个不完整的 UTF-8 编码）。

:::playground{#decode-segments}
```ts file=main.ts
for (const pathname of ['/api/one/%E5%AE%98', '/api/one/a%2Fb', '/docs/%E4%B8%AD/a%20b']) {
  const perSegment = pathname.split('/').filter((s) => s !== '').map((s) => decodeURIComponent(s));
  const wholeFirst = decodeURIComponent(pathname).split('/').filter((s) => s !== '');
  console.log(pathname, JSON.stringify(perSegment), JSON.stringify(wholeFirst));
}

try {
  decodeURIComponent('%E4');
} catch (error) {
  console.log(error instanceof URIError, String(error));
}
```
- 第 2 行先分段再逐段解码，第 3 行先解码整个地址再分段：`a%2Fb` 在第 2 行中是一段，在第 3 行中变成了两段；
- `%20` 是空格，`%E4%B8%AD` 是“中”的 UTF-8 编码；
- 第 8 行：不完整的编码让 `decodeURIComponent` 抛出 `URIError`，处理地址的代码要接住它。
:::

## 编程挑战

::exercise{#match-route}

::quiz

## 常见错误

- **以为文件夹中有文件就能访问**：只有 `page` 和 `route` 文件让一个地址可以访问，`layout.tsx`、组件、数据文件都不会。
- **把需要每页重置的状态放在布局中**：布局在导航时保留状态，从一个项目切换到另一个时，布局中的输入框不会清空。
- **站内链接用 `<a>` 或 `location`**：整个页面重新加载，布局中的状态全部丢失，也没有预先获取。
- **同步地读取 `params`**：从 Next.js 15 开始它是 Promise，要 `await` 或者在 `<Suspense>` 中 `.then`。
- **在 `<Suspense>` 之外读取没有 `generateStaticParams` 的参数**：开启 Cache Components 时构建会失败。
- **相信参数的类型就是参数的值**：`params.id` 是 `string`，但可以是任何字符串，找不到时用 `notFound()`。
- **用状态码判断不存在的动态页面**：实测第一次请求可能是 200 加上 `noindex`。

## 下一步

h03 讲服务端组件与客户端组件：上面的 `Counter` 为什么要写 `'use client'`，哪些代码只在服务器上运行，两者之间能传递什么。
