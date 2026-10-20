---
version: 1
mode: ts
estimatedMinutes: 45
review: ai-draft
problem: 前端代码需要知道接口的地址、第三方服务的公开 ID，开发时和上线后还各不相同，这些通常放在环境变量里。可是浏览器中没有环境变量：Vite 在构建时把 import.meta.env.VITE_API_BASE 直接替换成了字符串，写进打包后的 JavaScript，任何人打开开发者工具都能看到。把 API 密钥放进 VITE_ 开头的变量，就等于把它公开了。这一课讲清楚 Vite 的 .env 文件、VITE_ 前缀与加载顺序，什么可以放进前端、什么必须留在服务器，以及怎样在启动时验证配置、在构建后检查有没有泄露密钥。
objectives:
  - 说明 Vite 如何加载 .env、.env.local、.env.[mode] 文件，以及只有 VITE_ 开头的变量会暴露给前端代码
  - 理解 import.meta.env 在构建时被替换成字面量，前端打包的一切都是公开的；区分可以公开的标识与必须保密的密钥
  - 为 import.meta.env 写类型声明，在应用启动时验证配置并给出清楚的错误
  - 知道需要密钥的调用应该经过服务端，并能在构建产物中检查泄露的密钥
references:
  - title: Env Variables and Modes — Vite
    url: https://vite.dev/guide/env-and-mode
    checked: 2026-10-20
  - title: envPrefix — Vite
    url: https://vite.dev/config/shared-options#envprefix
    checked: 2026-10-20
  - title: About secret scanning — GitHub Docs
    url: https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning
    checked: 2026-10-20
  - title: Behind GitHub's new authentication token formats — The GitHub Blog
    url: https://github.blog/engineering/platform-security/behind-githubs-new-authentication-token-formats/
    checked: 2026-10-20
---

## 浏览器中没有环境变量

Node.js 中的程序可以读 `process.env`，那是操作系统给每个进程的变量。浏览器中运行的代码没有这样的东西：代码是从服务器下载下来的文本。所以 Vite 的做法是**在构建时替换**：代码中的 `import.meta.env.VITE_API_BASE`，构建时被换成一个字符串字面量。

编写本课时实际做的实验（Vite 8.3.4）。项目根目录中有三个文件：

```text
# .env
VITE_API_BASE=https://api.example.com
VITE_STRIPE_KEY=pk_test_123
SECRET_TOKEN=super-secret-value
VITE_MODE_NOTE=from-env

# .env.production
VITE_MODE_NOTE=from-production

# .env.local
VITE_API_BASE=http://localhost:3000
```

`main.ts` 中输出 `import.meta.env` 的几个值，运行 `npx vite build`，打包后的 JavaScript 中是：

```js
console.log(`API`,`http://localhost:3000`),
console.log(`STRIPE`,`pk_test_123`),
console.log(`SECRET`,void 0),
console.log(`NOTE`,`from-production`),
console.log(`MODE`,`production`,!1,!0,`/`)
```

- 值被**原样写进**了打包后的代码，`import.meta.env` 这个对象在运行时并不存在；
- 没有 `VITE_` 前缀的 `SECRET_TOKEN` 被换成了 `void 0`（`undefined`），它的值没有出现在任何构建产物中。这个前缀就是 Vite 的保护措施：只有明确标记为“可以给前端”的变量才会被替换进去（前缀可以用 `envPrefix` 选项修改）；
- `.env.local` 覆盖了 `.env` 中的 `VITE_API_BASE`；生产构建时 `.env.production` 覆盖了 `.env` 中的 `VITE_MODE_NOTE`；
- 内置的变量：`MODE`（`production`、`development` 或者 `--mode` 指定的名字）、`DEV`、`PROD`（布尔值）、`BASE_URL`（f02）、`SSR`。

加载的顺序（后面的覆盖前面的）：`.env`、`.env.local`、`.env.[mode]`、`.env.[mode].local`。以 `.local` 结尾的文件是你自己电脑上的设置，create-vite 模板的 `.gitignore` 中已经有 `*.local`，它们不会被提交。另外，启动 Vite 时操作系统中已经存在的同名环境变量优先级最高。

:::playground{#env-replace}
```ts file=main.ts
/** 模拟 Vite 构建时做的事：把 import.meta.env.名字 替换成 JSON 字面量 */
function replaceEnv(source: string, env: Record<string, string>, prefix = 'VITE_'): string {
  return source.replace(/import\.meta\.env\.([A-Z0-9_]+)/g, (_match, name: string) => {
    const value = env[name];
    return name.startsWith(prefix) && value !== undefined ? JSON.stringify(value) : 'void 0';
  });
}

const env = { VITE_API_BASE: 'https://api.example.com', SECRET_TOKEN: 'super-secret-value' };
const source = 'fetch(import.meta.env.VITE_API_BASE + "/users", { headers: { token: import.meta.env.SECRET_TOKEN } });';
console.log(replaceEnv(source, env));
```
- 构建结果中的接口地址是一个普通的字符串，任何人下载这个 JavaScript 文件都能读到它。
- `SECRET_TOKEN` 变成了 `void 0`：代码在运行时拿到的是 `undefined`。想“绕过”这个限制，把它改名成 `VITE_SECRET_TOKEN`，它就会被原样写进下载给每个用户的代码中。
:::

## 什么可以放进前端

**前端打包的一切都是公开的**：压缩、混淆都只是让它难读，任何人都能在开发者工具的 Sources 或 Network 面板中找到它（f04）。所以：

| 可以放进 `VITE_` 变量 | 绝不能放进前端 |
| --- | --- |
| 接口的地址 | API 的密钥（例如 Anthropic、OpenAI 的密钥） |
| 设计为公开的标识：Stripe 的可公开密钥 `pk_…`、统计服务的站点 ID、Sentry 的 DSN | Stripe 的私密密钥 `sk_…`、数据库的连接字符串、云服务的访问密钥 |
| 功能开关、版本号 | 用来签名、加密的私钥，任何“有了它就能以你的名义操作”的东西 |

需要密钥的调用必须经过**服务端**：前端请求你自己的接口，服务端带上密钥去调用第三方服务，再把结果返回给前端。这个网站的“问 AI”就是这样做的：Anthropic 的 API 密钥只保存在 Vercel 的服务端环境变量 `ANTHROPIC_API_KEY` 中，浏览器只和 `/api/ai` 通信，从来看不到密钥（H 阶段会讲服务端的环境变量）。

“可公开的密钥”本身也要配合限制使用：例如只允许你的域名使用、只给最小的权限，并在服务端的控制台中设置。

## 给 import.meta.env 加上类型

`vite/client` 中已经声明了 `MODE`、`DEV` 等内置变量。自己的变量用 c12 讲的声明合并补上，例如在 `src/vite-env.d.ts` 中：

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string;
  readonly VITE_TIMEOUT_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

注意这只是“承诺”：声明说 `VITE_API_BASE` 是 `string`，但如果部署时忘了设置，运行时它就是 `undefined`。所以在应用启动时**验证一次**配置，出错时给出清楚的信息，比让错误在某个请求中才出现要好得多。下面的小任务就是这个验证函数。

::exercise{#parse-env}

## 构建之后检查

即使大家都知道规则，泄露仍然会发生：有人临时把密钥写进了代码，或者把一个私密的变量改成了 `VITE_` 开头。GitHub 的 secret scanning 会扫描推送的代码，发现已知格式的密钥（GitHub 的令牌以 `ghp_` 等前缀开头，正是为了便于这样识别）。在 CI 中（f12）也可以对构建产物再检查一次：已知格式的密钥、以及服务端环境变量的值，都不应该出现在 `dist` 中。下面的编程挑战实现这样一个检查。

## 编程挑战

::exercise{#scan-bundle}

::quiz

## 常见错误

- **把密钥放进 `VITE_` 变量**：它会被写进打包后的代码，对所有人公开。密钥只放在服务端。
- **以为 `.env` 中的值在运行时读取**：它们在构建时就被替换了。修改之后要重新构建、重新部署。
- **提交 `.env.local`**：它保存的是你自己电脑上的设置，可能有私密的值。模板的 `.gitignore` 已经忽略了 `*.local`。
- **只写类型声明，不验证**：缺少的变量在运行时是 `undefined`。启动时验证一次。
- **用 `JSON.stringify(import.meta.env)` 打印配置“方便调试”**：它会把所有 `VITE_` 变量一起写进日志。只输出需要的值。
- **泄露之后只删除代码**：已经推送或部署过的密钥要立即作废，换一个新的（f10）。
