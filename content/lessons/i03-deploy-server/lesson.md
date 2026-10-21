---
version: 1
mode: ts
estimatedMinutes: 50
review: ai-draft
problem: 项目 3 的服务器在本机运行正常。部署出去要回答几个问题：它在哪里运行，是按请求启动的无服务器平台，还是一台一直运行的服务器；数据放在哪里，p3-03 的 SQLite 文件在哪种平台上留得住；配置和密钥怎样交给它；出了问题怎样发现，怎样退回去。i02 部署的是静态文件，出错了最多是一个 404；服务器出错时，用户看到的是 500，能帮你找到原因的只有日志。这一课以这个网站自己的部署（Vercel 上的函数加上托管的 Postgres）和项目 3 的实测项目为例讲这些决定，练习实现结构化的日志：去掉密钥的一行 JSON，以及为每个请求记一行日志的包装函数。
objectives:
  - 比较无服务器平台和一直运行的服务器，知道 SQLite 文件适合哪一种，什么时候要换成托管的数据库
  - 按环境设置环境变量，用健康检查报告“配置了什么”而不泄露配置的值
  - 写结构化的日志：每个请求一行 JSON，带着请求的 id，不记录密钥、令牌和查询参数
  - 知道 Vercel 的即时回滚做了什么、没做什么，以及数据库的迁移为什么让回滚变难
references:
  - title: Performing an Instant Rollback on a Deployment — Vercel
    url: https://vercel.com/docs/instant-rollback
    checked: 2026-10-21
  - title: Vercel Functions Limits
    url: https://vercel.com/docs/functions/limitations
    checked: 2026-10-21
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
4. 每个请求在日志中有一行；用户报告一个错误时，可以用响应中的请求 id 找到对应的那一行；
5. 新的版本出了问题，几分钟之内能退回上一个版本，并且事先知道哪些情况退不回去。

下面的结果来自 2026-10-21：这个网站的线上部署（只读地查看），以及在本机运行的项目 3 的实测项目（Next.js 16.4.2）。

## 在哪里运行

| | 无服务器平台（例如 Vercel） | 一直运行的服务器（云主机、Docker） |
| --- | --- | --- |
| 运行方式 | 来了请求才启动实例，自动扩缩，实例随时可能被回收 | `next start` 一直运行，自己负责重启、扩容、升级系统 |
| 本地的文件 | 不能用来保存数据：Vercel 的文档建议把要保存的文件放进对象存储（例如 Vercel Blob）；几个实例之间也不共享 | 同一块磁盘上的文件一直都在，但要自己备份 |
| SQLite 文件 | 不合适 | 只有一个实例时很合适（p3-03） |
| 数据库 | 通过网络访问的托管数据库 | 本机的 SQLite，或者托管的数据库 |
| 费用 | 没有请求时几乎不花钱；有免费的额度 | 不管有没有请求都在计费 |

p3-03 中实测过：两个实例各有一份内存，在一个实例上的修改另一个看不到；本地的文件也是同样的道理。所以项目 3 部署到 Vercel 时，SQLite 的存储要换成一个托管的数据库，例如 Postgres。好在接口的代码只依赖 `ProjectStore`：写一个 Postgres 的实现，让 p3-03 的合同测试在它上面也通过，处理函数一行都不用改。

这个网站自己就是这样部署的：页面是静态的文件（i02），`/api/*` 是一个 Vercel 的函数（`api/index.ts`），同步的数据保存在托管的 Postgres（Neon）中：

```ts
const store = process.env.DATABASE_URL ? new NeonStore(process.env.DATABASE_URL) : undefined;

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      return await handleApi(request, { store, passwordHash: process.env.SYNC_PASSWORD_HASH, ai: aiConfigFromEnv(process.env) });
    } catch (err) {
      console.error('API error', err);
      return new Response(JSON.stringify({ error: '服务器内部错误' }), { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } });
    }
  },
};
```

数据库在网络的另一端，p3-03 中的 N+1 问题在这里就变得很明显：每一次查询都要等一个来回。

自己运行 `next start` 时，Next.js 的文档提醒：停止服务器时发送 `SIGINT` 或者 `SIGTERM` 并等待，Next.js 会处理完正在进行的请求再退出，平台应该留出 10 到 30 秒的时间。

## 配置和密钥

h08 讲过环境变量：部署平台上按环境（Production、Preview、Development）分别设置；没有 `NEXT_PUBLIC_` 前缀的只在服务器上能读到；在 Vercel 上修改之后要重新部署。还有两件事：

- **启动时检查配置**（e13 的 `parseEnv`）：缺少必须的变量就立刻报错，而不是等到第一个用户的请求才失败；
- **健康检查只报告“有没有”**：这个网站的 `/api/health` 返回每个功能是否配置好了，而不是配置的值。实测线上的响应是 `{"ok":true,"sync":true,"ai":false}`：同步功能的数据库和密码都配置了，问 AI 的密钥没有配置。部署之后访问一次它，就知道这次部署是不是少了什么。

## 日志

无服务器平台和 `next start` 都把程序写到标准输出（`console.log`）和标准错误（`console.error`）的内容收集起来，在 Vercel 上就是运行日志（Runtime Logs）。问题在于写什么、怎么写。

先看不处理会怎样。实测项目中一个 Route Handler 抛出了一个错误，错误的信息中带着数据库的密码（数据库的驱动连接失败时，错误信息中常常有连接字符串）：

```ts
throw new Error(`connect failed: password=${process.env.LAB_DB_PASSWORD}`);
```

客户端收到一个空的 500，而 `next start` 的输出中是：

```text
⨯ Error: connect failed: password=lab-pass-7f3k29xq
    at r (…\.next-lab13\server\chunks\_0vj2gv73mjph5._.js:1:113)
```

密码原样进了日志。日志会被很多人和工具读到，保存的时间也很长，这和把密码写进代码差不多。另外，这种多行的文字很难搜索和统计：哪个请求出的错，花了多长时间，同一个错误一天发生了多少次，都看不出来。

所以服务器的日志通常写成**结构化**的：每条日志一行 JSON，字段固定，平台和工具可以按字段搜索、筛选、统计。但错误对象不能直接交给 `JSON.stringify`：

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

实测项目用下面两个练习中的函数包住同一个处理函数之后，输出是：

```text
{"time":"2026-10-21T18:16:07.517Z","level":"info","message":"GET /api/i03/logged 200","requestId":"req-mvifnzvh-1","method":"GET","path":"/api/i03/logged","status":200,"durationMs":0}
{"time":"2026-10-21T18:16:07.560Z","level":"error","message":"GET /api/i03/logged 500","requestId":"req-mvifnzwo-2","method":"GET","path":"/api/i03/logged","status":500,"durationMs":0,"error":{"name":"Error","message":"connect failed: password=[REDACTED]"}}
```

- 密码被换成了 `[REDACTED]`：`LAB_DB_PASSWORD` 的值在“不能出现的值”的列表中；
- 第一个请求带着 `?token=abc`，日志中只有路径，查询参数中可能有令牌；
- 每个响应带着 `x-request-id` 响应头，500 的响应体中也有 `requestId`。用户报告问题时给出这个 id，就能找到对应的那一行。Vercel 自己也给每个响应一个 id：实测线上 `/api/health` 的响应头中有 `X-Vercel-Id: iad1::sin1::…`。

不应该进日志的东西：密码、令牌、`Authorization` 和 `Cookie` 请求头、密钥；完整的请求体（可能有个人信息）；查询参数。应该进日志的：时间、级别、请求的 id、方法和路径、状态码、花的时间、错误的类型和信息（OWASP 的日志备忘单中有更完整的清单）。

::exercise{#log-line}

::exercise{#request-log}

## 回滚

Vercel 上每次推送到 `main` 都会生成一个新的部署：这个仓库的每个提交上都有 Vercel 写入的状态 `Deployment has completed`（实测，用 GitHub 的提交状态查看）。新的部署出了问题时，可以用**即时回滚**（Instant Rollback）退回去。Vercel 的文档说：

- 回滚是立刻生效的：生产环境的域名重新指向之前的那个部署，不重新构建；
- 回滚之后的部署用的是它当时的配置：项目设置中修改过的环境变量**不会**应用到它上面；
- 回滚之后，Vercel 关闭了生产域名的自动分配：之后推送到 `main` 的提交**不会**自动上线，要用 “Undo Rollback” 或者 `vercel promote` 恢复；
- Hobby 计划只能回滚到紧挨着的上一个生产部署。

代码可以退回去，**数据退不回去**。如果新的版本执行了迁移（p3-03），数据库已经是新的表结构了，旧的代码却不知道：

- 用了 p3-03 的 `planMigrations`，旧的版本启动时会拒绝：`数据库中有代码中没有的迁移`。这是故意的，宁可明确地失败，也不要让旧的代码在新的表结构上读错、写坏数据；
- 如果新的迁移删除或者改名了一列，旧的代码就算启动了也会出错。

所以修改表结构要分步，让每一步都和上一个版本的代码兼容（常叫做 expand/contract，先扩展、后收缩）。例如把 `owner` 拆成 `owner_id`：

1. **扩展**：加一列 `owner_id`，可以为空。旧的代码不知道这一列，照样运行；
2. 新的代码同时写 `owner` 和 `owner_id`，读的时候优先用 `owner_id`；把旧的数据补上 `owner_id`；
3. 确认不会再回滚到不认识 `owner_id` 的版本之后，**收缩**：在之后的某次部署中删除 `owner`。

每一步都可以单独回滚。如果所有的迁移都只做扩展，可以把 p3-03 中“数据库中有代码中没有的迁移”从拒绝改成警告；只要有一个迁移删除或者改名了东西，就只能**向前修复**：尽快发布一个修好的新版本，而不是回滚。托管的数据库通常还提供备份和按时间点恢复，执行有风险的迁移之前，要知道怎样用它们。

::quiz

## 常见错误

- **把 SQLite 文件部署到无服务器平台**：实例之间不共享文件，实例被回收时数据就没了。用托管的数据库，或者一直运行的服务器。
- **健康检查返回配置的值**：它通常是公开的。只返回“有没有”。
- **直接把错误抛给框架**：实测密码随着错误的信息进了日志。捕获错误，记录去掉了密钥的一行，返回带着请求 id 的 500。
- **日志中记录查询参数、请求头、请求体**：令牌和个人信息就进了日志。只记录需要的字段。
- **以为回滚之后推送的修复会自动上线**：Vercel 关闭了自动分配，要先撤销回滚。
- **在一次部署中做不兼容的表结构修改**：出了问题回滚不了。先扩展，后收缩。

## 下一步

课程到这里就结束了。从第一个 `console.log` 开始，你写过了类型、浏览器中的页面、React 的应用、Next.js 的服务器，最后把它们部署了出去。接下来可以给项目 3 加上 p3-01 中留作练习的部分（新建和删除项目、截止日期和重名的规则），写一个 Postgres 的存储并让合同测试通过，再把它部署到你自己的账号上。
