---
version: 1
mode: ts
estimatedMinutes: 60
review: self-reviewed
problem: p3-01 划好了边界：怎样检查请求体，发出去哪些字段。这一课在 Next.js 中把接口真正写出来。一个 Route Handler 就是一个收到 Request、返回 Response 的函数，难的是细节：请求体不是 JSON 时返回什么，几个检查谁先谁后，状态码怎样让客户端知道该怎么做。还有一个 fake-server.ts 中不存在的问题：两个人同时修改同一个项目时，后保存的人会悄悄覆盖前一个人的修改（h07 的丢失更新）。HTTP 有一套标准的解决办法，ETag 和 If-Match。结果都在实测的 Next.js 16.4.2 项目中确认过。
objectives:
  - 把路由文件写得很薄，接口的逻辑写成接收 Request、存储和依赖的函数，在浏览器和测试中都能运行
  - 按顺序做检查并返回合适的状态码：415、400、404、409、422、428、412、503
  - 用 ETag 和 If-Match 发现并发的修改，知道什么时候服务器可以自己重试，什么时候必须让客户端处理
  - 知道 Next.js 为 Route Handler 自动做的事（405、OPTIONS、HEAD），以及开启 Cache Components 时不读请求的 GET 会在构建时预渲染
references:
  - title: route.js — Next.js（16.4，随 next 包附带的文档）
    url: https://nextjs.org/docs/app/api-reference/file-conventions/route
    checked: 2026-10-21
    note: 以 Next.js 16.4.2 为准；课中的实测项目由 create-next-app 16.4.2 生成
  - title: RFC 9110 HTTP Semantics — 13. Conditional Requests
    url: https://www.rfc-editor.org/rfc/rfc9110.html#name-conditional-requests
    checked: 2026-10-21
  - title: RFC 6585 — 428 Precondition Required
    url: https://www.rfc-editor.org/rfc/rfc6585.html#section-3
    checked: 2026-10-21
  - title: ETag — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/ETag
    checked: 2026-10-21
---

## 要做什么

这个里程碑的验收条件：

1. `POST /api/projects/:projectId/tasks` 的状态码和响应体和 p2-04 的 `fake-server.ts` 一样；请求体不是 JSON 时也有明确的回答；
2. `PATCH /api/projects/:projectId` 修改项目，请求体按 p3-01 的 `parseProjectPatch` 检查，状态的变化按 p2-01 的转换表检查；
3. 两个人打开同一个项目，A 先保存，B 再保存：B 的修改**不会**悄悄覆盖 A 的，B 被告知“项目已经被修改过”；
4. 修改之后，所有的接口（包括项目的列表）都立刻返回新的数据。

下面的结果都来自 2026-10-21 在本机运行的 Next.js 16.4.2 项目（`next build` 和 `next start`），数据暂时保存在内存中（p3-03 换成 SQLite）。

## 路由文件只做一件事

实测项目中，`app/api/projects/[projectId]/tasks/route.ts` 只有几行：

```ts
import { deps, store } from '@/lib/p3/instance';
import { addTask } from '@/lib/p3/tasks';

export async function POST(request: Request, ctx: RouteContext<'/api/projects/[projectId]/tasks'>) {
  const { projectId } = await ctx.params;
  return addTask(request, projectId, store, deps);
}
```

- `RouteContext` 是 Next.js 生成的全局类型（不用导入），参数中的 `projectId` 有了类型；`params` 是一个 Promise，要 `await`（h02）；
- 真正的逻辑在 `addTask` 中。它收到的是标准的 `Request`，用到的存储（`store`）和依赖（`deps`：现在的时间、生成 id）都从参数传进来。

这样做的好处是 `addTask` 不依赖 Next.js：测试中自己造一个 `Request`，传进一个内存中的存储和固定的时间，就能检查它返回的 `Response`。`Request`、`Response`、`Headers` 是 Fetch API 的一部分，浏览器中也有，所以下面的练习可以在这个网站中运行：

:::playground{#request-response}
```ts file=main.ts
const request = new Request('https://projects.example/api/projects/p1', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'If-Match': '"v3"' },
  body: '{"name":"官网改版（二期）"',
});
console.log(request.method, request.headers.get('content-type'), request.headers.get('IF-MATCH'));

try {
  await request.json();
} catch (error) {
  console.log('格式不对：', error instanceof Error ? error.name : error);
}

const response = Response.json({ error: '没有这个项目' }, { status: 404, headers: { ETag: '"v3"' } });
console.log(response.status, response.headers.get('content-type'), response.headers.get('etag'));
console.log(await response.text());
```
- 第 6 行：请求头的名字不分大小写，`IF-MATCH` 也能读到；`Content-Type` 是原样的字符串，带着 `; charset=utf-8`；
- 第 9、11 行：请求体不是合法的 JSON，`request.json()` 抛出 `SyntaxError`（h06；WebKit 中是一个 `name` 为 `SyntaxError` 的 `DOMException`）；
- 第 15 行：`Response.json` 自动加上了 `content-type: application/json`。
:::

## 状态码和检查的顺序

添加任务的接口，按这个顺序检查（前两步和项目无关，不用读取存储）：

| 顺序 | 情况 | 状态码 | 响应体 |
| --- | --- | --- | --- |
| 1 | `Content-Type` 不是 `application/json` | 415 | `{ "error": "请求体必须是 JSON" }` |
| 2 | 请求体不是合法的 JSON | 400 | `{ "error": "请求体不是合法的 JSON" }` |
| 3 | 没有这个项目，或者已经删除 | 404 | `{ "error": "没有这个项目" }` |
| 4 | 请求体不是对象 | 400 | `{ "error": "不支持的请求" }` |
| 5 | 项目已经完成 | 409 | `{ "error": "已完成的项目不能修改任务" }` |
| 6 | `title` 不是字符串 | 400 | `{ "error": "不支持的请求" }` |
| 7 | 标题为空、太长、重名 | 422 | `{ "errors": { "title": "…" } }` |
| 8 | 成功 | 201 | 新的任务，`Location` 响应头指向它 |

第 3 到 7 步的顺序和 `fake-server.ts` 一样，项目 2 的客户端看到的就是同样的回答。415 和 400 是新的：假的服务器只会收到自己的客户端发来的请求，真的服务器会收到任何请求。要求 `Content-Type: application/json` 有两个好处：

- **回答更明确**：实测 `curl -d '{"title":"上线"}'` 不加 `-H 'Content-Type: application/json'` 时，curl 默认发送 `application/x-www-form-urlencoded`，接口返回 415，调用的人马上知道哪里不对；
- **多一层防护**：`text/plain` 和表单格式的请求是“简单请求”，别的网站的页面可以直接发过来，浏览器不先预检（e11）；`application/json` 的请求跨源时必须先通过预检。Route Handler 没有 h05 中 Server Function 那样的 `Origin` 检查，这是防止跨站请求伪造（CSRF）的一层保护（认证之后还需要 h09 中的那些措施）。

勾选任务的接口（`PATCH /api/projects/:projectId/tasks/:taskId`，`{ "done": true }`）的写法和添加任务一样：同样的检查顺序，写入冲突时同样重试。

::exercise{#add-task}

## 两个人同时修改

h07 在一台服务器的内存和文件中见过“丢失更新”：两个请求先后读取，又先后写入，后写入的覆盖了先写入的。通过 HTTP 也一样，而且时间更长：A 和 B 上午打开同一个项目，A 把名称改了，B 下午把负责人改了。如果 B 的客户端发送的是整个项目，A 的名称就被改回去了；即使只发送修改的字段（p3-01 的 PATCH），B 也是在**过时的数据**上做的决定，例如 A 已经把项目标记为完成了。

HTTP 的标准做法是**条件请求**：

1. 服务器在响应中带上 `ETag` 响应头，它标识这一份数据的版本，这里用 `"v3"`（带引号是 ETag 的格式）；
2. 客户端修改时带上 `If-Match: "v3"`，意思是“只有项目还是我看到的那个版本时，才执行这个修改”；
3. 版本对不上，服务器返回 **412 Precondition Failed**，什么都不改；客户端重新读取，把新的数据给用户看。没有带 `If-Match` 的修改，服务器返回 **428 Precondition Required**（RFC 6585），强制客户端说明自己看到的是哪个版本。

h07 中版本冲突返回的是 409 和当前的数据，并提到也可以用 `ETag` 和 `If-Match` 表示版本。这里用的就是后一种：版本放在 `If-Match` 中，对不上时用 412；409 留给业务规则（p2-04 的约定）。412 的响应不带当前的数据，客户端要重新读取。读取项目的接口在响应中带上 `ETag`：

```ts
export async function GET(_request: Request, ctx: RouteContext<'/api/projects/[projectId]'>) {
  const { projectId } = await ctx.params;
  const project = await store.get(projectId);
  const dto = project === null ? null : toProjectDto(project);
  if (dto === null) return Response.json({ error: '没有这个项目' }, { status: 404 });
  return Response.json(dto, { headers: { ETag: etagOf(dto.version) } });
}
```

实测项目中：

| 请求 | 结果 |
| --- | --- |
| `GET /api/projects/p1` | 200，`etag: "v1"` |
| `PATCH`，没有 `If-Match` | 428 |
| A：`PATCH`，`If-Match: "v1"`，修改名称 | 200，`etag: "v2"` |
| B：`PATCH`，`If-Match: "v1"`，修改负责人 | **412**，`{"error":"项目已经被修改过，请刷新之后再试"}` |
| `PATCH`，`If-Match: "v2"`，`{"name":"","version":9}` | 422，`{"errors":{"version":"不能修改这个字段","name":"请输入项目名称"}}` |
| `PATCH`，`If-Match: "v2"`，`{}` | 400，`{"error":"没有要修改的字段"}` |
| `PATCH`，`Content-Type: text/plain`，过时的 `If-Match` | 415：只看请求头就能回答，最先检查 |
| `PATCH`，`If-Match: "v2"`，`{"status":"done"}`（还有一个任务没有完成） | 409，`{"error":"还有 1 个任务没有完成"}` |

两个细节：

- **前提条件先于请求体检查**：RFC 9110 规定，前提条件在正常的检查之后、处理请求体之前检查：版本不对时，请求体是什么都没有意义。只看请求头就能发现的问题（415）和项目不存在（404）先回答，然后是 428/412，再解析请求体（400、422），最后是业务规则（409）；
- **服务器写入时还要再比较一次**：读取项目、检查 `If-Match`、写入之间，别的请求也可能写入。所以存储的 `replace(next, expectedVersion)` 只在保存的版本仍然是 `expectedVersion` 时才写入（h07 的乐观并发），失败时同样返回 412。

## 服务器能不能自己重试

`replace` 失败之后，添加任务和修改项目的处理不一样：

- **添加任务**：客户端只说了“加一个叫‘上线’的任务”，它不依赖客户端看到的是哪个版本。服务器重新读取项目，重新检查一遍（项目可能刚刚被标记为完成），再写入就行。几次都失败，说明这个项目正在被频繁修改，返回 **503** 和 `Retry-After`；
- **修改项目**：客户端是看着版本 3 的数据决定改成什么的。服务器替它重试，就等于把它的决定用在了它没有见过的数据上。所以返回 412，让客户端（和用户）重新决定。

所以添加任务的接口不要求 `If-Match`，修改项目的接口要求。

::exercise{#patch-project}

## Next.js 替你做的事

实测中，Route Handler 还有几个行为是 Next.js 自动处理的：

- `route.ts` 中没有导出的方法，例如 `DELETE`：**405 Method Not Allowed**（实测这个响应中没有 `Allow` 响应头，而 RFC 9110 要求 405 带上它）；
- `OPTIONS`：没有导出时自动实现，返回 **204** 和 `allow: GET, HEAD, OPTIONS, PATCH`（根据导出了哪些方法）；
- `HEAD`：导出了 `GET` 就能用，返回同样的响应头（包括 `etag`），没有响应体；
- 带着当前的 ETag（`If-None-Match: "v1"`）的 `GET` 仍然返回 200 和完整的响应体：Next.js 不会根据 Route Handler 返回的 `ETag` 自动回答 304。需要的话要自己实现。

还有一个坑。项目的列表 `GET /api/projects` 最初是这样写的：

```ts
export async function GET() {
  const projects = await store.list();
  return Response.json(projects.flatMap((project) => toProjectDto(project) ?? []));
}
```

`next build` 的输出中它是 `○ /api/projects`：**静态的**。实测项目开启了 Cache Components（`next.config.ts` 中的 `cacheComponents: true`，h01），这时和 h08 中的 `/api/health` 一样，没有读取请求的 GET 处理函数在构建时运行了一次，结果被保存下来。实测修改了项目之后，`/api/projects/p1` 已经是版本 3，`/api/projects` 返回的仍然是构建时的数据（版本 1、旧的名称），响应头是 `x-nextjs-cache: HIT` 和 `cache-control: s-maxage=31536000`：服务器一直返回构建时的数据，直到下一次构建，`s-maxage` 还允许 CDN 把它缓存一年。加上 h04、h08 中的 `await connection()` 之后，它变成了 `ƒ`，每次请求都读取最新的数据。带动态参数的路由（`[projectId]`，没有 `generateStaticParams` 时）和其他的方法（`POST`、`PATCH`）不会被预渲染。

## 客户端怎样用

项目 2 的客户端要改两处：保存读取项目时的 `ETag`，修改时带上它；收到 412 时重新读取：

```ts
const response = await fetch(`/api/projects/${id}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', 'If-Match': etag },
  body: JSON.stringify(patch),
});
if (response.status === 412) {
  // 别人刚刚修改过：重新读取，告诉用户“项目已经被修改过，请检查之后再保存”
}
```

添加、勾选任务也会让项目的版本加 1，所以修改项目之前要用最新的 ETag。React Router 在 action 之后会重新运行 loader（p2-04），拿到的正好是新的版本。

这里假设客户端和接口在同一个域名下。如果项目 2 的静态页面部署在另一个域名（p2-06），带着 `If-Match` 和 JSON 的 `PATCH` 跨源时要先预检（e11），服务器要回答 `Access-Control-Allow-Methods: PATCH` 和 `Access-Control-Allow-Headers: Content-Type, If-Match`；实测 Next.js 自动生成的 `OPTIONS` 只有 `allow`，没有任何 `Access-Control-*` 响应头，要自己写。浏览器还会让 JavaScript 读不到 `ETag` 这样的响应头，服务器要在 `Access-Control-Expose-Headers` 中列出它。i03 再讨论部署的方式。

::quiz

## 常见错误

- **不检查 `Content-Type` 就解析请求体**：错误的请求得到莫名其妙的回答。不是 JSON 时返回 415。
- **检查的顺序随意**：版本不对的请求被报告成“请输入项目名称”，客户端修好了名称，再提交还是失败。先回答只看请求头的问题和 404，再前提条件，再请求体，最后业务规则。
- **只在开头比较版本**：读取和写入之间还有别的请求。写入时再比较一次（`WHERE version = ?`）。
- **在服务器上替客户端重试基于旧数据的修改**：这就是丢失更新。返回 412，让客户端决定。
- **忘了不读请求的 GET 会被预渲染**（开启 Cache Components 时）：实测列表接口一直返回构建时的数据。用 `await connection()`。
- **ETag 不带引号，或者用弱 ETag 做 If-Match**：`W/"v3"` 和 `"v3"` 用 `If-Match` 比较时永远对不上（强比较）。

## 下一步

数据还在内存中，重启就没了，也不能在几个服务器实例之间共享。p3-03 把存储换成 SQLite：表结构、迁移、事务中的版本检查，并给接口写测试。
