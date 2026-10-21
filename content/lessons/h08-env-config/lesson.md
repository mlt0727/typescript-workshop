---
version: 1
mode: ts
estimatedMinutes: 50
review: ai-draft
problem: e13 讲过：浏览器中没有环境变量，前端构建工具会把一部分变量的值写进打包的代码，所以密钥绝不能用那种方式传给前端。Next.js 的应用同时运行在服务器和浏览器中，问题变得更细：.env、.env.local、.env.production 这些文件谁覆盖谁；NEXT_PUBLIC_ 开头的变量在构建时被写进代码，连服务器上的代码也一样，构建之后再改就不起作用了；没有这个前缀的变量只在服务器上能读到，而且要在请求时读才能拿到部署平台上的新值。这一课在实测的 Next.js 16.4.2 项目中把这些规则一条一条地确认下来，然后在浏览器中实现其中的两部分：按 Next.js 的规则读取 .env 文件，以及构建时替换 process.env。
objectives:
  - 说出 Next.js 读取 .env、.env.local、.env.[mode]、.env.[mode].local 的顺序，以及测试环境的例外
  - 知道 NEXT_PUBLIC_ 变量在构建时被内联到浏览器和服务器的代码中，构建之后修改不会生效
  - 在服务器上用请求时的读取拿到部署平台上的值，知道浏览器中的 process.env 是空的
  - 知道哪些文件可以提交，部署平台上的变量怎样设置，以及 NEXT_SERVER_ACTIONS_ENCRYPTION_KEY 这样的部署配置
references:
  - title: Environment Variables — Next.js（16.4，随 next 包附带的文档）
    url: https://nextjs.org/docs/app/guides/environment-variables
    checked: 2026-10-21
    note: 以 Next.js 16.4.2（Turbopack）为准；课中的实测项目由 create-next-app 16.4.2 生成
  - title: Environment Variables — Vercel
    url: https://vercel.com/docs/environment-variables
    checked: 2026-10-21
  - title: dotenv（.env 文件的格式）
    url: https://github.com/motdotla/dotenv
    checked: 2026-10-21
---

## 要做什么

e13 讲过前端的环境变量：值在构建时被写进代码，浏览器中没有真正的环境变量。这一课补上 Next.js 特有的部分：

1. `.env*` 文件的读取顺序和展开（练习一）；
2. `NEXT_PUBLIC_` 变量在构建时被内联，影响浏览器和服务器两边的代码（练习二）；
3. 服务器上怎样拿到部署平台上的值；
4. 哪些东西放在哪里。

下面的结果都来自 2026-10-21 在本机运行的 Next.js 16.4.2 项目（`next build` 和 `next start`）。项目中有这几个文件（create-next-app 生成的 `.gitignore` 已经忽略了所有的 `.env*`）：

```text
# .env
LAB_SOURCE=.env
LAB_C=.env
LAB_PROCESS=.env
LAB_USER=nextjs
LAB_URL=https://x.com/$LAB_USER
LAB_PRICE=\$5
NEXT_PUBLIC_GREETING=hello-from-env
LAB_SECRET=secret-value-7c1d

# .env.local
LAB_SOURCE=.env.local
LAB_B=.env.local

# .env.production
LAB_SOURCE=.env.production
LAB_B=.env.production
LAB_C=.env.production

# .env.production.local
LAB_SOURCE=.env.production.local

# .env.development
LAB_SOURCE=.env.development
```

## 文件的顺序

`next build` 的输出中列出了它读取的文件，从高优先级到低：

```text
- Environments: .env.production.local, .env.local, .env.production, .env
```

用 `LAB_PROCESS=from-process next start` 启动之后，一个 Route Handler 在请求时读取这些变量：

| 变量 | 值 | 说明 |
| --- | --- | --- |
| `LAB_SOURCE` | `.env.production.local` | 四个文件中都有，优先级最高的生效 |
| `LAB_B` | `.env.local` | `.env.local` 胜过 `.env.production` |
| `LAB_C` | `.env.production` | `.env.production` 胜过 `.env` |
| `LAB_PROCESS` | `from-process` | 启动时已经有的环境变量胜过所有的文件 |
| `LAB_URL` | `https://x.com/nextjs` | `$LAB_USER` 被展开了 |
| `LAB_PRICE` | `$5` | `\$` 是一个真正的 `$` |

`.env.development` 没有被读取：生产构建的 `NODE_ENV` 是 `production`。文档中的完整顺序是：`process.env`、`.env.$(NODE_ENV).local`、`.env.local`（`NODE_ENV` 是 `test` 时不读）、`.env.$(NODE_ENV)`、`.env`。

哪些文件提交到仓库？`.env`、`.env.development`、`.env.production`、`.env.test` 中可以放**不是秘密**的默认值，可以提交（create-next-app 默认把它们都忽略了，需要提交时要改 `.gitignore`）；`.env*.local` 是每个人自己电脑上的设置，**永远不**提交；真正的密钥不放进任何会被提交的文件，生产环境的密钥在部署平台上设置（Vercel 的项目设置中有 Environment Variables，可以分别给 Production、Preview、Development 设置不同的值）。

::exercise{#env-files}

## NEXT_PUBLIC_：构建时写进代码

没有 `NEXT_PUBLIC_` 前缀的变量只在服务器上可以读到。有这个前缀的变量，`next build` 会把代码中的 `process.env.NEXT_PUBLIC_…` **换成构建时的值**。实测项目中一个客户端组件在点击按钮时读取几种写法：

```tsx
const name = 'NEXT_PUBLIC_GREETING';
const env = process.env;
setReport(JSON.stringify({
  direct: process.env.NEXT_PUBLIC_GREETING ?? null,
  secret: process.env.LAB_SECRET ?? null,
  dynamic: process.env[name] ?? null,
  viaObject: env.NEXT_PUBLIC_GREETING ?? null,
  runtimeName: process.env[window.location.hash.slice(1)] ?? null,
  keys: Object.keys(process.env),
}));
```

用 `NEXT_PUBLIC_GREETING=runtime-value` 启动构建好的服务器，打开 `/h08#NEXT_PUBLIC_GREETING`，点击按钮：

```json
{"direct":"hello-from-env","secret":null,"dynamic":"hello-from-env","viaObject":"hello-from-env","runtimeName":null,"keys":[]}
```

- 读到的是**构建时**的 `hello-from-env`，启动时设置的 `runtime-value` 不起作用；
- 没有前缀的 `LAB_SECRET` 是 `null`。在 `.next/static/` 中搜索：`hello-from-env` 出现在一个代码块中，`secret-value-7c1d` 不在任何一个代码块中；
- 浏览器中的 `process.env` 是一个空对象（`keys` 是 `[]`），名字在运行时才确定的读取（`runtimeName`）读不到任何东西；
- 文档说“用变量名的 `process.env[name]`”和“`const env = process.env` 之后的 `env.X`”**不会**被内联，但实测 Next.js 16.4.2（Turbopack）认出了常量的名字和这个别名，照样替换了。不要依赖这种行为：只用直接写出的 `process.env.NEXT_PUBLIC_X`。

服务器上也一样。同一个 Route Handler 中：

- 直接写出的 `process.env.NEXT_PUBLIC_GREETING` 也是构建时的 `hello-from-env`：**服务器的代码同样被替换了**；
- 用请求中的查询参数作为名字读取（`process.env[name]`，`name` 是 `NEXT_PUBLIC_GREETING`），读到的才是启动时的 `runtime-value`。

“替换”就是字符串层面的替换，下面用几行代码模拟它：

:::playground{#build-time-inline}
```ts file=main.ts
const source = 'setup(process.env.NEXT_PUBLIC_GREETING, process.env.LAB_SECRET);';

/** 模拟 next build：NEXT_PUBLIC_ 变量换成值，其他的换成 undefined（浏览器中的代码） */
function build(env: Record<string, string | undefined>): string {
  return source.replace(/process\.env\.(\w+)/g, (_access: string, name: string) => {
    const value = env[name];
    return name.startsWith('NEXT_PUBLIC_') && value !== undefined ? JSON.stringify(value) : 'undefined';
  });
}

const built = build({ NEXT_PUBLIC_GREETING: 'hello-from-env', LAB_SECRET: 'secret-value-7c1d' });
console.log(built);

// 部署之后修改了环境变量：已经构建好的代码是一个字符串，不会跟着变
const runtimeEnv = { NEXT_PUBLIC_GREETING: 'runtime-value' };
console.log(built.includes(runtimeEnv.NEXT_PUBLIC_GREETING), built.includes('secret-value-7c1d'));
```
- 第 13 行：代码中只剩下值本身，`process.env` 不见了；
- 第 17 行：`false false`：新的值不在构建好的代码中，密钥也不在。
:::

所以 `NEXT_PUBLIC_` 变量适合“构建时就确定、谁都可以看”的配置：网站的公开地址、统计服务的公开 ID。同一份构建要部署到几个环境、每个环境的值不同时，`NEXT_PUBLIC_` 变量做不到，要由服务器在请求时读取、再传给需要它的地方。

::exercise{#inline-env}

## 服务器上在请求时读取

没有前缀的变量在服务器上读取。文档的建议是在**请求时**读取：

```tsx
import { connection } from 'next/server';

export default async function Component() {
  await connection();
  const value = process.env.MY_VALUE; // 在请求时读取
  // …
}
```

原因和 h04 一样：一个静态的页面（○）在构建时渲染，它读到的是构建时的环境变量，之后再改也不会变。`await connection()` 让这部分在请求时渲染，读到的就是部署平台上当前的值；Route Handler 读取请求时也是一样（实测的 Route Handler 就是这样，`LAB_PROCESS` 读到了启动时的值）。

启动时检查配置（e13 的 `parseEnv`）在 Next.js 中可以放在 `instrumentation.ts` 的 `register` 函数中：服务器启动时运行一次，缺少必须的变量就直接报错，而不是等到第一个用户的请求失败。

还有一个只在部署时才遇到的配置：h05 中提到的 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`。Server Function 捕获的变量会被加密之后发给浏览器，文档说默认**每次构建**生成一个新的密钥。自己部署多个实例（例如几个容器各自构建）时，它们的密钥就不一样，一个实例加密的内容另一个实例解不开，用户会看到 “Failed to find Server Action”。文档的做法是构建时设置这个变量（一个 base64 编码的 16、24 或 32 字节的密钥，例如 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=… next build`），让所有的实例共用同一个密钥。它和其他的密钥一样，只放在部署环境中。

::quiz

## 常见错误

- **把密钥放进 `NEXT_PUBLIC_` 变量**：它的值就在发给浏览器的代码中（实测在 `.next/static/` 中找到了它）。
- **以为修改部署平台上的 `NEXT_PUBLIC_` 变量会立刻生效**：它在构建时就写进了代码，要重新构建。
- **以为服务器上的 `process.env.NEXT_PUBLIC_X` 是运行时的值**：实测服务器的代码也被替换了。
- **在静态的页面中读取部署平台上的变量**：页面在构建时渲染，读到的是构建时的值。在请求时读取。
- **提交 `.env.local`**：它是每个人自己的设置，可能有密钥。
- **在浏览器中用动态的名字读取 `process.env`**：浏览器中它是空的对象。

## 下一步

h09 讲认证话题的安全边界：会话放在哪里，Proxy 能做什么、不能做什么，以及为什么每个 Server Function 和数据读取都要自己检查权限。
