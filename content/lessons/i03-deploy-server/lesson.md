---
version: 1
mode: ts
estimatedMinutes: 55
review: self-reviewed
problem: 项目 3 的服务器在本机运行正常。部署出去要回答几个问题：它在哪里运行，是按请求启动的无服务器平台，还是一台一直运行的服务器；数据放在哪里，p3-03 的 SQLite 文件在哪种平台上留得住；配置和密钥怎样交给它；出了问题怎样发现，怎样退回去。i02 部署的是静态文件，出了错多半是一个空白的页面或者 404；服务器出错时，用户看到的是 500，能帮你找到原因的只有日志。这一课以这个网站自己的部署（Vercel 上的函数加上托管的 Postgres）和项目 3 的实测项目为例讲这些决定，练习两件事：去掉密钥、限制大小的一行 JSON 日志，以及回滚之前检查旧的代码能不能在现在的数据库上运行。
objectives:
  - 比较无服务器平台和一直运行的服务器，知道 SQLite 文件适合哪一种，什么时候要换成托管的数据库
  - 按环境设置环境变量，用健康检查报告“配置了什么”而不泄露配置的值
  - 写结构化的日志：一行 JSON，不记录密钥和令牌，限制大小；知道 Vercel 怎样判断日志的级别、保存多久
  - 知道 Vercel 的即时回滚做了什么、没做什么；用兼容的迁移和先扩展、后收缩的步骤让回滚可行
references:
  - title: Performing an Instant Rollback on a Deployment — Vercel
    url: https://vercel.com/docs/instant-rollback
    checked: 2026-10-21
  - title: Runtime Logs — Vercel
    url: https://vercel.com/docs/logs/runtime
    checked: 2026-10-21
    note: 级别按输出的流判断；每行最多 256 KB；Hobby 保存 1 小时、Pro 保存 1 天
  - title: How can I use files in Vercel Functions? — Vercel Knowledge Base
    url: https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions
    checked: 2026-10-21
  - title: How to self-host your Next.js application（16.4，随 next 包附带的文档）
    url: https://nextjs.org/docs/app/guides/self-hosting
    checked: 2026-10-21
  - title: Logging Cheat Sheet — OWASP
    url: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
    checked: 2026-10-21
---

## 要做什么

部署项目 3 的服务器，验收条件：

1. 重启、部署新的版本之后，数据都还在；
2. 密钥只在部署平台的环境变量中：不在仓库中，不在构建的产物中，也不在日志中；
3. 有一个健康检查，能确认部署是活的、该配置的都配置了；
4. 每个请求在日志中有一行；用户报告一个错误时，可以用请求的 id 找到对应的那一行；
5. 新的版本出了问题，几分钟之内能退回上一个版本，并且事先知道哪些情况退不回去。

下面的结果来自 2026-10-21：这个网站的线上部署（只读地查看），以及在本机运行的项目 3 的实测项目（Next.js 16.4.2）。

## 在哪里运行

| | 无服务器平台（例如 Vercel） | 一直运行的服务器（云主机、Docker） |
| --- | --- | --- |
| 运行方式 | 来了请求才启动实例，自动扩缩，实例随时可能被回收 | `next start` 一直运行，自己负责重启、扩容、升级系统 |
| 本地的文件 | 不能用来保存数据：实例分布在不同的机器上，彼此不共享；h07 讲过，函数的文件系统只有 `/tmp` 可写，而且属于一个实例。Vercel 的文档建议把要保存的文件放进对象存储（例如 Vercel Blob） | 云主机的磁盘上的文件一直都在。Docker 的容器要把数据库文件放在挂载的卷（volume）上，否则每次部署换一个新的容器，文件就没了。两种都要自己备份 |
| SQLite 文件 | 不合适 | 只有一台机器、一块持久的磁盘时合适（p3-03：同一台机器上的几个进程可以共用一个文件） |
| 数据库 | 通过网络访问的托管数据库 | 本机的 SQLite，或者托管的数据库 |
| 费用 | 没有请求时几乎不花钱；有免费的额度 | 不管有没有请求都在计费 |

所以项目 3 部署到 Vercel 时，SQLite 的存储要换成一个托管的数据库，例如 Postgres。好在接口的代码只依赖 `ProjectStore`：写一个 Postgres 的实现，让 p3-03 的契约测试在它上面也通过，处理函数一行都不用改。

这个网站自己就是这样部署的：页面是静态的文件（i02），`/api/*` 是一个 Vercel 的函数（`api/index.ts`），同步的数据保存在托管的 Postgres（Neon）中：

```ts
const store = process.env.DATABASE_URL ? new NeonStore(process.env.DATABASE_URL) : undefined;
const secrets = secretsFromEnv(process.env);
const logError = (request: Request, error: unknown) => console.error(formatErrorLog(request, error, secrets));

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      return await handleApi(request, { store, passwordHash: process.env.SYNC_PASSWORD_HASH, ai: aiConfigFromEnv(process.env), logError });
    } catch (err) {
      logError(request, err);
      return new Response(JSON.stringify({ error: '服务器内部错误' }), { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } });
    }
  },
};
```

它的 `catch` 最初是 `console.error('API error', err)`，把错误对象原样交给日志：正是下文要改进的写法。现在的 `formatErrorLog` 用的就是下文的做法：一行 JSON，只有错误的名字和信息，环境变量中密钥的值换成 `[REDACTED]`。

数据库在网络的另一端，每一次查询都要往返一次，p3-03 中的 N+1 问题在这里会变得明显。所以函数的区域（`vercel.json` 中的 `regions`）要和数据库在同一个地区：这个网站的函数在 `iad1`（美国东部），数据库也在美国东部。

自己运行 `next start` 时，Next.js 的文档提醒：停止服务器时发送 `SIGINT` 或者 `SIGTERM` 并等待，Next.js 会处理完正在进行的请求再退出，平台应该留出 10 到 30 秒的时间。

## 配置和密钥

h08 讲过环境变量：部署平台上按环境（Production、Preview、Development）分别设置；没有 `NEXT_PUBLIC_` 前缀的只在服务器上能读到；在 Vercel 上修改之后要重新部署。还有几件事：

- **尽早检查配置**（e13 的 `parseEnv`）：缺少必须的变量就立刻报错。无服务器平台上，实例要等第一个请求来了才启动，所以“启动时检查”也是在第一个请求时才发现；要更早发现，就在构建时检查（构建失败就不会上线），或者在部署之后、切换流量之前先访问一次健康检查；
- **健康检查只报告“有没有”**：这个网站的 `/api/health` 返回每个功能是否配置好了，而不是配置的值。实测线上的响应是 `{"ok":true,"sync":true,"ai":false}`：同步功能的数据库和密码都配置了，问 AI 的密钥没有配置。它只说明变量设置了，不说明数据库连得上；要检查连接，可以在健康检查中查询一次数据库，失败时也只返回“失败”，不返回错误的信息。在 Next.js 中写健康检查的 Route Handler 时，记得 h08 中的实测：不读取请求的 GET 会在构建时被预渲染，要加上 `await connection()`。

## 日志

程序写到标准输出（`console.log`）和标准错误（`console.error`）的内容，在 Vercel 上出现在运行日志（Runtime Logs）中；自己运行 `next start` 时，由 Docker、systemd 这样运行它的工具收集。问题在于写什么、怎么写。

h06 中实测过直接把错误抛给 Next.js 的后果。这里的实测项目又确认了一次：一个 Route Handler 抛出的错误的信息中带着数据库的密码（数据库的驱动连接失败时，错误信息中可能会有连接字符串）：

```ts
throw new Error(`connect failed: password=${process.env.LAB_DB_PASSWORD}`);
```

客户端收到一个空的 500，而 `next start` 的输出中是：

```text
⨯ Error: connect failed: password=lab-pass-7f3k29xq
    at r (…\.next-lab13\server\chunks\_0vj2gv73mjph5._.js:1:113)
```

密码原样进了日志。日志会被很多人和工具读到，这和把密码写进代码差不多。另外，这种多行的文字很难搜索和统计。

h06 的 `withErrorHandling` 已经解决了一半：捕获错误、返回带着 `X-Request-Id` 的 JSON 响应、每个请求调用一次 `deps.log`（控制流原样抛出，`deps.log` 出错不影响响应）。剩下的一半是 `deps.log` 写什么：服务器的日志通常写成**结构化**的，每条日志一行 JSON，字段固定，平台和工具可以按字段搜索、筛选、统计。但错误对象不能直接交给 `JSON.stringify`：

:::playground{#stringify-error}
```ts file=main.ts
const error = new Error('保存失败', { cause: new TypeError('fetch failed') });

console.log(JSON.stringify({ level: 'error', error }));
console.log(Object.keys(error));
console.log(JSON.stringify({ level: 'error', error: { name: error.name, message: error.message } }));
```
- 第 3 行：`{"level":"error","error":{}}`：错误的 `message`、`stack`、`cause` 都是不可枚举的属性，`name` 在原型上，`JSON.stringify` 一个也不写；
- 第 4 行：`[]`，没有可枚举的自有属性；
- 第 5 行：要自己取出需要的字段。
:::

实测项目用一个和 h06 一样的包装函数，加上下面练习中的 `formatLog`，输出是（第一行的请求带着 `?token=abc`，第二行的请求抛出了上面那个错误）：

```text
{"time":"2026-10-21T18:16:07.517Z","level":"info","message":"GET /api/i03/logged 200","requestId":"req-mvifnzvh-1","method":"GET","path":"/api/i03/logged","status":200,"durationMs":0}
{"time":"2026-10-21T18:16:07.560Z","level":"error","message":"GET /api/i03/logged 500","requestId":"req-mvifnzwo-2","method":"GET","path":"/api/i03/logged","status":500,"durationMs":0,"error":{"name":"Error","message":"connect failed: password=[REDACTED]"}}
```

- 密码被换成了 `[REDACTED]`：`LAB_DB_PASSWORD` 的值在“不能出现的值”的列表中；
- 日志中只有路径。不过 Vercel 的运行日志自己会记下请求的查询参数（日志详情中的 Search Params），所以令牌本来就不该放在网址中；
- 每个响应带着请求的 id（h06），用户报告问题时给出它，就能找到对应的那一行。Vercel 自己也给每个响应一个 id：实测线上 `/api/health` 的响应头中有 `X-Vercel-Id: iad1::iad1::…`（处理请求的边缘区域、函数的区域和请求的 id；函数原来在新加坡（`sin1`）时是 `iad1::sin1::…`）。请求中带来的 `x-request-id` 来自客户端，任何人都可以写，只有在你自己的代理会覆盖它时才能沿用。

Vercel 的运行日志还有几个规则（文档）：

- **级别看输出的流**，不看 JSON 中的 `level`：`console.log` 是 info，`console.error` 是 error。用 `console.log` 写的一条 error 日志，按级别筛选时找不到。所以写日志时按级别选择 `console.error` 或者 `console.log`；
- **大小**：每行最多 256 KB，每个请求最多 256 行、1 MB；
- **保存的时间**：Hobby 计划 1 小时，Pro 计划 1 天。要“用户第二天报告问题时还能找到”，需要把日志转发到别的服务（Log Drains）。

不应该进日志的东西：密码、令牌、`Authorization` 和 `Cookie` 请求头、会话的 id；完整的请求体（可能有个人信息）。应该进日志的：时间、级别、请求的 id、方法和路径、状态码、花的时间、错误的类型和信息（OWASP 的日志备忘单中有更完整的清单）。

::exercise{#log-line}

## 回滚

Vercel 上每次推送到 `main` 都会生成一个新的部署：这个仓库最近的提交上都有 Vercel 写入的状态 `Deployment has completed`（实测，用 GitHub 的提交状态查看）。新的部署出了问题时，可以用**即时回滚**（Instant Rollback）退回去。Vercel 的文档说：

- 回滚是立刻生效的：生产环境的域名重新指向之前的那个部署，不重新构建；
- 回滚之后的部署用的是它当时的配置：项目设置中修改过的环境变量**不会**应用到它上面。如果你刚刚因为泄漏而更换了一个密钥，回滚回去的部署用的还是那个已经作废的旧密钥；
- 回滚之后，Vercel 关闭了生产域名的自动分配：之后推送到 `main` 的提交**不会**自动上线，要用 “Undo Rollback” 或者 `vercel promote` 恢复；
- Hobby 计划只能回滚到紧挨着的上一个生产部署。

代码可以退回去，**数据退不回去**。新的版本执行了迁移（p3-03），数据库已经是新的表结构了；新的版本写入的数据也可能是旧的代码不认识的，例如一个新的状态值，p3-03 的 `rowsToProjects` 遇到它会抛出错误。用了 p3-03 的 `planMigrations`，旧的版本连启动都会拒绝：`数据库中有代码中没有的迁移`。

让回滚可行的办法是把修改表结构分成几步，并且记下每一步是否**兼容**：之前的代码在这个迁移之后还能不能运行。只加东西（新的表、可以为空的新列）是兼容的；删除、改名、加上新的约束是不兼容的。例如把 `owner` 换成 `owner_id`（先扩展、后收缩，常叫做 expand/contract）：

1. **扩展**：迁移 `0003_add_owner_id`（兼容），加一列 `owner_id`，可以为空。之前的代码不知道这一列，照样运行；
2. 部署同时写 `owner` 和 `owner_id`、读的时候优先用 `owner_id` 的代码，补上旧数据的 `owner_id`；
3. 部署不再读写 `owner` 的代码。p3-03 中 `owner` 是 `NOT NULL` 的，代码不写它就插不进去，所以在这之前先用一个兼容的迁移去掉 `NOT NULL`（SQLite 中要重建这张表）；
4. **收缩**：迁移 `0004_drop_owner`（不兼容），删除 `owner`。只在确定不会再回滚到还读写 `owner` 的版本之后才做。

前三步都可以退回上一个版本，第四步不行：它之后出了问题，只能**向前修复**，尽快发布一个修好的新版本。迁移的文件中写明它是否兼容，执行时记进 `schema_migrations`；旧的代码启动时，数据库中多出来的迁移都兼容，就记一条警告照常运行，有一个不兼容就拒绝。回滚之前也可以用同样的规则先检查一遍：

::exercise{#rollback-target}

还有两件和迁移有关的部署上的事：

- **在哪里执行迁移**：无服务器平台上，每个新的实例第一次用到数据库时都会检查迁移；有新的迁移时，几个实例会同时尝试执行（p3-03 用 `BEGIN IMMEDIATE` 让它们排队）。更稳妥的做法是把迁移作为部署中单独的一步，在切换流量之前执行一次；
- **Preview 部署用自己的数据库**：如果 Preview 环境的 `DATABASE_URL` 指向生产的数据库，开一个拉取请求，它的部署就会在生产的数据库上执行迁移。Preview 要用单独的数据库（例如托管的数据库提供的分支）。

托管的数据库通常还提供备份和按时间点恢复，执行不兼容的迁移之前，要知道怎样用它们。

::quiz

## 常见错误

- **把 SQLite 文件部署到无服务器平台**：实例之间不共享文件，实例被回收时数据就没了。用托管的数据库，或者一直运行的服务器。
- **数据库文件放在 Docker 容器里，没有挂载卷**：下一次部署就是一个新的容器，数据没了。
- **健康检查返回配置的值**：它通常是公开的。只返回“有没有”。
- **直接把错误抛给框架**：实测密码随着错误的信息进了日志。捕获错误，记录去掉了密钥的一行（h06 的包装函数加上 `formatLog`）。
- **错误的日志用 `console.log` 写**：在 Vercel 上它的级别是 info，筛选错误时找不到。
- **以为回滚之后推送的修复会自动上线**：Vercel 关闭了自动分配，要先撤销回滚。
- **在一次部署中做不兼容的表结构修改**：出了问题回滚不了。先扩展，后收缩；记下每个迁移是否兼容。
- **Preview 部署连着生产的数据库**：一个拉取请求就能改掉生产的表结构。

## 下一步

课程到这里就结束了。从第一个 `console.log` 开始，你写过了类型、浏览器中的页面、React 的应用、Next.js 的服务器，并且部署过自己的静态网站（i02、p2-06）。接下来可以：

- 把项目 3 补完：p3-01 中留作练习的新建和删除项目、截止日期和重名的规则；
- 写一个 Postgres 的 `ProjectStore`，让 p3-03 的契约测试也在它上面运行（`:memory:` 是 SQLite 才有的，Postgres 要用一个测试专用的数据库或者分支），然后把项目 3 部署到你自己的账号上；
- 读一读每课的参考资料：TypeScript、React、Next.js 的官方文档会随着版本更新，这门课中的“实测”都写明了版本和日期，换了版本时，用同样的方法自己再测一次。
