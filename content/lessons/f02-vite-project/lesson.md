---
version: 1
mode: ts
estimatedMinutes: 50
review: ai-draft
problem: 浏览器不认识 .ts 文件，也不知道 import x from 'react' 中的 react 在哪里；写了几十个模块的网站，也不应该让用户的浏览器发几十个请求。构建工具解决这些问题：开发时把 TypeScript 即时转换成浏览器能运行的 JavaScript，发布前把整个项目打包成几个带哈希的静态文件。这一课用 Vite 在自己的电脑上创建一个 TypeScript 项目，看清项目中每个文件的作用、开发服务器做了什么、为什么 Vite 不检查类型、构建出的 dist 里有什么，以及部署到子路径时资源地址为什么会出错。
objectives:
  - 用 create-vite 创建 vanilla-ts 项目，说出 index.html、src、public、tsconfig.json 各自的作用
  - 说明开发服务器按需转换模块的过程，以及 Vite 只转译、不做类型检查，所以构建脚本要先运行 tsc
  - 读懂 vite build 的输出：带哈希的文件名、内联的小资源、原样复制的 public 文件，并用 vite preview 检查构建结果
  - 理解 base 选项与 import.meta.env.BASE_URL，正确拼接 public 文件的地址；知道静态服务器怎样提供 dist 中的文件
references:
  - title: Getting Started — Vite
    url: https://vite.dev/guide/
    checked: 2026-10-20
  - title: Features（TypeScript）— Vite
    url: https://vite.dev/guide/features
    checked: 2026-10-20
  - title: Static Asset Handling — Vite
    url: https://vite.dev/guide/assets
    checked: 2026-10-20
  - title: Building for Production（Public Base Path）— Vite
    url: https://vite.dev/guide/build
    checked: 2026-10-20
  - title: Deploying a Static Site — Vite
    url: https://vite.dev/guide/static-deploy
    checked: 2026-10-20
---

## 为什么需要构建工具

前面的课程中，代码都在这个网站的沙箱里运行，平台替你做了两件事：把 TypeScript 转换成 JavaScript，把 `import './geometry'` 连接到对应的文件。在自己的电脑上，这些事要由**构建工具**来做：

- 浏览器只运行 JavaScript，`.ts` 文件要先去掉类型；
- `import { createRoot } from 'react-dom/client'` 这样的“裸模块名”，浏览器不知道去哪里找，要解析到 `node_modules` 中的文件；
- 发布时，几十个模块最好打包成少数几个文件，并压缩、加上内容哈希，方便缓存。

[Vite](https://vite.dev/) 是现在最常用的前端构建工具：开发时它是一个服务器，浏览器请求哪个模块，就即时转换哪个（转换 TypeScript 用的是 Oxc）；发布时用 Rolldown 把整个项目打包。下面用的是编写本课时的最新版本：create-vite 9.3.1、Vite 8.3.4、TypeScript 6.0.3。

## 创建项目

在终端中运行（f01 已经装好了 Node.js）：

1. `npm create vite@latest my-app -- --template vanilla-ts --no-immediate`：用 `vanilla-ts` 模板（不用框架的 TypeScript）创建 `my-app` 文件夹。`--` 之后的参数传给 create-vite；`--no-immediate` 表示先不安装依赖、不启动，下面手动做；
2. `cd my-app`，`npm install`：安装 `package.json` 中的 `typescript` 和 `vite`（f01 讲过 `~6.0.3`、`^8.3.4` 的含义）；
3. `npm run dev`：启动开发服务器。终端显示 `VITE v8.3.4  ready in … ms` 和 `Local: http://localhost:5173/`，在浏览器中打开这个地址。

生成的文件：

| 文件 | 作用 |
| --- | --- |
| `index.html` | **入口**。它在项目根目录，不在 `public` 中：Vite 从它开始，顺着 `<script type="module" src="/src/main.ts">` 找到所有的模块 |
| `src/main.ts` | 入口模块：导入样式和 `counter.ts`，把页面内容写进 `#app` |
| `src/counter.ts` | 一个普通的模块：`setupCounter(element)` 让按钮显示点击次数 |
| `src/style.css` | 样式。注意它是在 `main.ts` 中用 `import './style.css'` 引入的，不是写在 `<link>` 中 |
| `src/assets/` | 在代码中导入的图片：`import viteLogo from './assets/vite.svg'` 得到的是图片的**地址**（字符串） |
| `public/` | 不经过处理、原样提供的文件（`favicon.svg`、`icons.svg`），用根路径引用：`/favicon.svg` |
| `tsconfig.json` | TypeScript 的配置（f03 详细讲） |
| `.gitignore` | 已经写好了 `node_modules`、`dist` 等不提交的内容（f10） |

`tsconfig.json` 中的 `"types": ["vite/client"]` 让 TypeScript 认识 `import './style.css'` 和 `import logo from './assets/vite.svg'`：这些导入在 TypeScript 看来不是代码模块，是 `vite/client` 中的声明告诉它“导入图片得到一个 `string`”。

## 开发服务器做了什么

打开浏览器的开发者工具（f04 详细讲），在网络面板中能看到浏览器真的请求了 `/src/main.ts` 和 `/src/counter.ts`。Vite 返回的不是原来的文件，而是转换后的 JavaScript。`counter.ts` 返回的内容大致是：

```js
export function setupCounter(element) {
	let counter = 0;
	const setCounter = (count) => {
		counter = count;
		element.innerHTML = `Count is ${counter}`;
	};
	element.addEventListener("click", () => setCounter(counter + 1));
	setCounter(0);
}
```

类型注解 `: HTMLButtonElement`、`: number` 都被去掉了，末尾还附带了一个 source map（f04），让开发者工具能显示原来的 TypeScript。`main.ts` 中的 `import './style.css'` 变成了 `import "/src/style.css"`，Vite 把 CSS 转换成一段把样式插入页面的代码。

修改文件并保存，页面会自动更新。修改 CSS 时，样式直接替换，页面不刷新（这叫**热模块替换**，HMR）；修改 `main.ts` 这类没有写 HMR 处理代码的模块时，Vite 让页面整个重新加载。

## Vite 不检查类型

这是最容易误会的一点。Vite 转换 `.ts` 文件时**只去掉类型，不做类型检查**：它一次只看一个文件，而类型检查需要整个项目的信息。所以有类型错误的代码，开发服务器照样运行，`vite build` 也照样成功。

`package.json` 中的构建脚本是 `"build": "tsc && vite build"`：先运行 `tsc`，`tsconfig.json` 中有 `"noEmit": true`，所以 `tsc` 只检查、不输出文件；它报错时 `&&` 让后面的 `vite build` 不再运行。在 `counter.ts` 中写一个类型错误 `let counter: number = "0"` 试一试（编写本课时实际运行的结果）：

- `npm run build`：输出 `src/counter.ts(2,7): error TS2322: Type 'string' is not assignable to type 'number'.`，构建失败；
- `npx vite build`：直接构建，成功了。

开发时靠编辑器显示类型错误；想在终端中持续检查，可以另开一个终端运行 `npx tsc --noEmit --watch`。

## 构建与预览

`npm run build` 的输出（文件名中的哈希每次内容变化都会不同）：

```text
dist/index.html                  0.45 kB │ gzip: 0.29 kB
dist/assets/vite-BF8QNONU.svg    8.70 kB │ gzip: 1.60 kB
dist/assets/hero-CLDdwZDr.png   13.05 kB
dist/assets/index-CsUDhMuy.css   4.10 kB │ gzip: 1.46 kB
dist/assets/index-wktXvZw9.js    4.49 kB │ gzip: 2.02 kB
```

- 所有的模块打包成了一个 `index-…js`，样式成了一个 `index-…css`。`dist/index.html` 中的 `<script>` 和 `<link>` 已经改成指向它们；
- 文件名中的 `-wktXvZw9` 是根据内容计算的**哈希**：内容不变，名字就不变，所以服务器可以让浏览器把它们缓存很久；内容一变，名字也变，浏览器自然会下载新的；
- `src/assets/typescript.svg` 不见了：它只有 1303 字节，小于默认的 4 KB（`build.assetsInlineLimit`），被直接**内联**进了 JavaScript（一个 `data:` 地址），省掉一次请求；8.7 KB 的 `vite.svg` 则成了单独的文件；
- `public/` 中的 `favicon.svg`、`icons.svg` 原样复制到了 `dist/` 的根目录，名字没有哈希。

`dist` 就是要部署的全部内容，它是纯静态文件，任何静态服务器都能提供。运行 `npm run preview`，Vite 用一个本地静态服务器（默认端口 4173）提供 `dist`，在部署之前检查构建的结果。

## 部署到子路径：base

如果网站不在域名的根路径下，例如 GitHub Pages 上的 `https://用户名.github.io/my-app/`，`/assets/index-wktXvZw9.js` 这样的地址就错了，应该是 `/my-app/assets/…`。这时设置 Vite 的 `base` 选项（在 `vite.config.ts` 中，或者 `vite build --base=/my-app/`）。

Vite 会自动改写它**知道**的地址：`index.html` 中的 `<script>`、`<link>`，导入的资源（`import viteLogo from …`），CSS 中的 `url()`。但它不会改写你写在字符串里的地址。模板的 `main.ts` 中就有这样的地址：`<use href="/icons.svg#github-icon">`。实际用 `--base=/repo/` 构建，`index.html` 中变成了 `/repo/favicon.svg`、`/repo/assets/index-…js`，导入的图片变成了 `/repo/assets/hero-…png`，而 JavaScript 中仍然是 `"/icons.svg#github-icon"`，部署之后这些图标都会显示不出来。

需要在代码中拼接地址时，用 Vite 注入的 `import.meta.env.BASE_URL`：它在构建时被替换成 `base` 的值。实测几种写法下它的值：

| `base` | `import.meta.env.BASE_URL` |
| --- | --- |
| 不设置（默认 `/`） | `/` |
| `/repo/` | `/repo/` |
| `/repo`（漏写了结尾的 `/`） | `/repo` |
| `./`（相对路径，部署位置事先不知道时用） | `./` |

注意第三行：`BASE_URL` 不一定以 `/` 结尾，直接 `BASE_URL + 'icons.svg'` 可能得到 `/repoicons.svg`。下面的示例写一个拼接函数（这个网站上没有 `import.meta.env`，所以把 `base` 作为参数传入）：

:::playground{#base-url}
```ts file=main.ts
function joinNaive(base: string, path: string): string {
  return base + path;
}

function join(base: string, path: string): string {
  const head = base.endsWith('/') ? base : `${base}/`;
  const tail = path.startsWith('/') ? path.slice(1) : path;
  return head + tail;
}

for (const base of ['/', '/repo/', '/repo', './']) {
  console.log(base.padEnd(7), joinNaive(base, '/icons.svg'), join(base, '/icons.svg'));
}
```
- `joinNaive` 在四种 `base` 下的结果是 `//icons.svg`、`/repo//icons.svg`、`/repo/icons.svg`、`.//icons.svg`：开头的 `//` 甚至会被浏览器当成另一个域名（`//icons.svg` 指向主机 `icons.svg`）。
- `join` 保证两部分之间正好有一个 `/`。下面的小任务在这个基础上处理更多的情况。
:::

::exercise{#public-url}

## 静态服务器怎样提供 dist

部署 `dist` 时，静态服务器（Vercel、Netlify、GitHub Pages、Nginx……）收到一个请求，要决定返回哪个文件。有两个问题和前端项目密切相关：

- **前端路由与刷新**：网站用 History API 做路由（e10）时，地址 `/projects/42` 只在浏览器中存在，`dist` 里没有这个文件。在首页点链接过去没有问题，但在这个地址上刷新页面，服务器找不到文件，就返回 404。所以这类网站要配置“找不到页面时返回 `index.html`”，由前端代码根据地址显示内容。但这条规则不能用在资源上：如果 `/assets/index-旧哈希.js` 也返回了 `index.html`，浏览器会报错“期望 JavaScript 模块，服务器返回的却是 text/html”，而不是一个清楚的 404；
- **缓存**：带哈希的文件可以缓存一年（内容变了名字就变）；`index.html` 必须每次都向服务器确认，否则用户会一直拿着旧的 `index.html`，加载旧版本的脚本。

下面的编程挑战就是实现这样一个静态服务器的决策部分。

## 编程挑战

::exercise{#serve-static}

::quiz

## 常见错误

- **以为 `npm run dev` 能发现类型错误**：Vite 只转译。看编辑器，或者运行 `npm run build`（其中的 `tsc`）、`npx tsc --noEmit`。
- **把要处理的图片放进 `public`**：`public` 中的文件不会加哈希、不会内联，引用时也不会被检查（写错名字只会在运行时 404）。在代码中用到的图片放在 `src` 中并导入。
- **用 `file://` 直接打开 `dist/index.html`**：模块脚本在 `file://` 下无法加载。用 `npm run preview` 或任何静态服务器。
- **部署到子路径后图标、图片丢失**：设置 `base`；代码中手写的地址用 `import.meta.env.BASE_URL` 拼接。
- **静态服务器对所有找不到的请求都返回 `index.html`**：资源请求也拿到了 HTML，错误信息变得难懂。只对“看起来是页面”的地址这样做。
