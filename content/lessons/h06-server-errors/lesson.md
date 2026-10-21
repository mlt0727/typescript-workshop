---
version: 1
mode: ts
estimatedMinutes: 55
review: ai-draft
problem: 服务器上的代码出错时，浏览器看到什么？在单页应用中，这个问题由前端自己决定；在 Next.js 中，错误可能发生在服务端组件的渲染中、Server Function 中或者 Route Handler 中，每一种都有自己的去向。处理得不好，要么用户看到一个空白的 500，要么数据库的地址和密码出现在浏览器中。这一课在实测的 Next.js 16.4.2 项目中观察三种地方的错误各自变成了什么，然后把“预期的错误”和“未预期的错误”分开：前者变成有意义的状态码和信息，后者只告诉用户“出错了”和一个可以报告的 id。最后处理一个容易忽略的陷阱：redirect() 和 notFound() 是靠抛出错误实现的，接住所有错误的 catch 会把它们也吞掉。
objectives:
  - 区分预期的错误和未预期的错误，知道各自应该怎样传给用户
  - 用 error.tsx 处理页面中的错误，知道生产环境中浏览器只看到通用的信息和 digest
  - 写 Route Handler，把错误映射成合适的状态码和 JSON 响应，不泄漏细节
  - 知道 redirect()、notFound() 抛出的是控制流，用 unstable_rethrow 或者判断 digest 把它们原样抛出
  - 用请求的 id 把用户看到的错误和服务器的日志对应起来，日志中不记录敏感的信息
references:
  - title: Error Handling — Next.js（16.4，随 next 包附带的文档）
    url: https://nextjs.org/docs/app/getting-started/error-handling
    checked: 2026-10-21
    note: 以 Next.js 16.4.2（React 19.3.0）为准；课中的实测项目由 create-next-app 16.4.2 生成
  - title: error.js — Next.js
    url: https://nextjs.org/docs/app/api-reference/file-conventions/error
    checked: 2026-10-21
  - title: route.js（Route Handlers）— Next.js
    url: https://nextjs.org/docs/app/api-reference/file-conventions/route
    checked: 2026-10-21
  - title: unstable_rethrow — Next.js
    url: https://nextjs.org/docs/app/api-reference/functions/unstable_rethrow
    checked: 2026-10-21
  - title: HTTP response status codes — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
    checked: 2026-10-21
---

## 要做什么

服务器上的错误有三个来源：服务端组件的渲染、Server Function（h05）、Route Handler。这一课：

1. 区分两类错误：**预期的**和**未预期的**；
2. 看清楚页面中的错误在生产环境中变成了什么（`error.tsx`）；
3. 写 Route Handler，把错误映射成状态码和 JSON 响应（练习一）；
4. 避免吞掉 `redirect()`、`notFound()`，用请求的 id 对应日志（练习二）。

下面的结果都来自 2026-10-21 在本机运行的 Next.js 16.4.2 项目（`next build` 和 `next start`）。

## 两类错误

- **预期的错误**是程序正常运行的一部分：用户填错了表单、要找的东西不存在、没有权限、和别人的修改冲突了。它们的信息是写给用户看的，应该作为**值**返回：Server Function 返回给 `useActionState` 的状态（h05），Route Handler 返回一个 4xx 的响应，服务端组件渲染一段提示或者调用 `notFound()`；
- **未预期的错误**是程序或者环境出了问题：一个 `undefined` 的属性、数据库连不上、上游返回了奇怪的格式。它们应该**抛出**，由框架接住；它们的信息是写给开发者的，**不能**原样发给浏览器。

官方文档的建议也是这样：预期的错误不要用 `throw`，而是建模成返回值。

## 页面中的错误：error.tsx

实测项目中的 `/h06/boom` 页面在 `<Suspense>` 中渲染一个组件，它抛出 `new Error('连接数据库失败：密码 hunter2 不正确')`。同一个文件夹中有一个 `error.tsx`：

```tsx
'use client'; // error.tsx 必须是客户端组件

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const message = error instanceof Error ? error.message : String(error);
  const digest = error instanceof Error && 'digest' in error ? String(error.digest) : '（没有）';
  return (
    <div role="alert">
      <h2>出错了</h2>
      <p>{message}</p>
      <p>{digest}</p>
      <button onClick={() => retry()}>重试</button>
    </div>
  );
}
```

`error` 的类型是 `unknown`（客户端组件中抛出的可以是任何值），读取属性之前先收窄。`retry()` 重新请求并渲染这一段，从 16.3 起是稳定的 API（之前是 `reset`，它只重新渲染、不重新请求）。在生产服务器上请求这个页面：

- 状态码是 **200**：页面的外壳先送出了，后面的部分出错时状态码已经来不及改（和 h02 中 `notFound()` 的第一次请求一样）。HTML 中有标题“报表”，**没有** `hunter2`；
- 在浏览器中，`error.tsx` 显示的 `message` 是 `Minified React error #441…`，一段通用的说明，原来的信息不见了；`digest` 是 `2618878670`；
- 服务器的日志中有完整的错误信息，并且同样带着 `digest: '2618878670'`。

这就是 `digest` 的作用：浏览器中只有一个编号，开发者用它在服务器的日志中找到对应的错误。开发模式（`next dev`）中浏览器会看到原来的信息，方便调试，所以“开发时看到的错误信息”不代表生产环境。

几个规则：

- 错误向上冒泡到最近的 `error.tsx`。`error.tsx` 包住同一个文件夹中的 `page.tsx` 和下面的各层，但**不**包住同一个文件夹中的 `layout.tsx`：布局出错要由上一层的 `error.tsx` 处理，根布局出错用 `app/global-error.tsx`（它要自己输出 `<html>` 和 `<body>`）；
- 错误边界只接住**渲染**中的错误。事件处理函数、`setTimeout` 中的错误要自己 `try`/`catch`，放进 state 显示；在 `startTransition` 中抛出的错误会冒泡到错误边界；
- `notFound()` 由 `not-found.tsx` 显示，不经过 `error.tsx`。

## Route Handler

`app/` 中名为 `route.ts` 的文件是 **Route Handler**（h02）：它导出以 HTTP 方法命名的函数，收到 Web 标准的 `Request`，返回 `Response`，和 i01 中的 Vercel Function、这个网站的同步接口是同样的写法。

```ts
// app/api/projects/[id]/route.ts
export async function GET(request: Request, context: RouteContext<'/api/projects/[id]'>) {
  const { id } = await context.params;
  const project = await findProject(id);
  if (project === null) return Response.json({ error: '找不到这个项目' }, { status: 404 });
  return Response.json(project);
}
```

它是写给其他程序（移动应用、webhook、第三方）的 HTTP 接口；页面自己的表单用 Server Function 更简单。实测 Route Handler 中的几种情况：

| 情况 | 结果 |
| --- | --- |
| 抛出 `new Error('查询失败：…，密码 hunter2')`，没有处理 | **500**，响应体是空的；服务器的日志中打印了完整的信息，**包括密码** |
| `await request.json()`，请求体是 `{"a":` 或者空的 | 抛出 `SyntaxError: Unexpected end of JSON input` |
| 调用 `redirect('/h06/boom')`（`next/navigation`） | **307**，`Location: /h06/boom` |

第一行说明两件事：没有处理的错误不会泄漏给浏览器，但客户端也只得到一个毫无信息的 500；日志会记下错误的全部内容，所以错误信息中本来就不该有密码，日志也要当作敏感的数据保管。

## 把错误映射成响应

接口的使用者靠**状态码**决定下一步怎么做，所以每一类预期的错误都要有合适的状态码：

| 状态码 | 含义 | 客户端应该 |
| --- | --- | --- |
| 400 | 请求本身有问题（不是 JSON、缺少参数） | 修改请求，不要原样重试 |
| 401 | 没有登录 | 登录之后再试 |
| 403 | 登录了，但没有权限 | 不要再试 |
| 404 | 不存在 | 不要再试 |
| 409 | 和现有的数据冲突（重名、版本不一致） | 重新读取数据，再决定 |
| 422 | 格式没问题，但内容不合法（字段的校验） | 显示每个字段的错误 |
| 500 | 服务器出了问题 | 稍后重试，或者报告 `requestId` |

响应体用固定的形状（这里是 `{ error, requestId, fields? }`），客户端只需要写一套处理的代码：p2-04 的 `api.ts` 就是按状态码和固定的响应体读取错误的。

::exercise{#error-responses}

## 不要吞掉 Next.js 的控制流

`redirect()` 和 `notFound()` 的返回类型是 `never`：它们不是返回，而是**抛出**一个特殊的错误，由 Next.js 在外面接住。实测在 Route Handler 中接住它们，看看抛出的是什么：

```json
{
  "redirect": { "name": "Error", "message": "NEXT_REDIRECT", "digest": "NEXT_REDIRECT;replace;/h06;307;" },
  "notFound": { "name": "Error", "message": "NEXT_HTTP_ERROR_FALLBACK;404", "digest": "NEXT_HTTP_ERROR_FALLBACK;404" }
}
```

所以一个“接住所有错误”的 `try`/`catch` 会把它们也接住：

```ts
export async function GET() {
  try {
    redirect('/h06/boom');
  } catch {
    return Response.json({ error: '出了点问题' }, { status: 500 });
  }
}
```

实测这个接口返回 **500** 和 `{"error":"出了点问题"}`，本来的跳转没有了。下面用一个假的 `redirect` 模拟这件事：

:::playground{#swallowed-redirect}
```ts file=main.ts
/** 模拟 next/navigation 的 redirect：抛出一个带 digest 的错误（digest 的格式来自实测） */
function redirect(url: string): never {
  throw Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;replace;${url};307;` });
}

/** 模拟 unstable_rethrow：认出控制流就重新抛出 */
function rethrow(error: unknown): void {
  if (typeof error === 'object' && error !== null && 'digest' in error && typeof error.digest === 'string' && error.digest.startsWith('NEXT_')) {
    throw error;
  }
}

function swallowing() {
  try {
    redirect('/login');
  } catch {
    return '500：出了点问题';
  }
}

function rethrowing() {
  try {
    redirect('/login');
  } catch (error) {
    rethrow(error);
    return '500：出了点问题';
  }
}

console.log('接住所有错误：', swallowing());
try {
  rethrowing();
} catch (error) {
  console.log('重新抛出：', error instanceof Error ? error.message : error, '→ Next.js 接住它，返回 307');
}
```
- 第 2 行：返回类型是 `never`，TypeScript 知道它后面的代码不会运行；
- 第 15–19 行：`catch` 不区分接住的是什么，跳转变成了一个 500；
- 第 26 行：先让控制流离开，剩下的才是真正的错误。
:::

在 `catch` 的第一行调用 `unstable_rethrow(error)`（`next/navigation`），它认出 Next.js 的这类错误并重新抛出，其他的错误继续往下处理。除了 `redirect()`、`notFound()`、`permanentRedirect()`，在某些情况下 `cookies()`、`headers()` 这样的请求时 API 也会抛出需要原样抛出的错误。

## 请求的 id 和日志

用户报告“刚才保存失败了”，开发者要在成千上万条日志中找到那一条。给每个请求一个 id，同时放进响应头、错误的响应体和日志中，就能对上：这和页面错误的 `digest` 是同一个思路。记录日志时：

- 只记录路径，不记录查询字符串：其中可能有令牌（例如登录回调中的 `?code=…`）；
- 4xx 是用户的问题，记一条简单的记录就够了；5xx 才需要完整的错误；
- 日志服务出了问题，不能让本来成功的请求失败。

## 编程挑战

::exercise{#with-error-handling}

::quiz

## 常见错误

- **把未预期的错误信息返回给浏览器**：其中可能有 SQL、路径和密码。返回固定的信息和一个 id，细节留在服务器的日志中。
- **用 `throw` 表示预期的错误，再在页面中显示 `error.message`**：生产环境中浏览器看不到这个信息（实测是一段通用的说明）。预期的错误作为值返回。
- **所有的错误都返回 500，或者都返回 400**：客户端无法区分“稍后重试”和“修改输入”。
- **`catch` 接住了 `redirect()` 和 `notFound()`**：实测跳转变成了 500。用 `unstable_rethrow`。
- **在日志中记录完整的地址和请求体**：令牌和密码被写进了日志。
- **以为开发模式中看到的错误信息就是用户看到的**：开发模式会把原来的信息发给浏览器，生产环境不会。

## 下一步

h07 讲持久化：把数据从内存搬到文件和数据库中，并处理两个人同时修改同一条数据的冲突（409）。
