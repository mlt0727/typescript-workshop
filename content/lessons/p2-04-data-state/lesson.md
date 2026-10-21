---
version: 1
mode: react
estimatedMinutes: 60
review: ai-draft
problem: 到目前为止，项目的数据都写在代码中。真实的应用从服务器读写数据：网络会断，服务器会出错，会拒绝不符合规则的请求，返回的数据也可能不是期望的样子；用户还会连点两次“添加”。g14 用 loader 读取了数据，这一课处理“写”：先写一个类型化的 API 客户端，把每一种失败都变成类型中的一种情况；再用 React Router 的 action 和 useFetcher 修改数据，做到乐观更新、防止重复提交，并把服务器返回的错误显示在合适的位置。
objectives:
  - 把请求的结果写成 Result 类型，区分连接失败、404、输入错误（422）、违反业务规则（409）、其他服务器错误和格式不对的数据
  - 知道被中止的请求不是失败，让它继续抛出，交给路由处理
  - 用 action 处理提交，用 useFetcher 在不离开页面的情况下提交；知道提交之后 React Router 会重新运行 loader，失败的 4xx/5xx 除外
  - 用 fetcher.formData 做乐观更新，失败时自动恢复；用 fetcher.state 防止重复提交
  - 把字段的错误、操作的错误分别显示在对应的位置，让屏幕阅读器也能读到
references:
  - title: Actions（Data 模式）— React Router
    url: https://reactrouter.com/start/data/actions
    checked: 2026-10-21
  - title: Using Fetchers — React Router
    url: https://reactrouter.com/how-to/fetchers
    checked: 2026-10-21
  - title: Revalidation Optimization — React Router
    url: https://reactrouter.com/how-to/optimize-revalidation
    checked: 2026-10-21
    note: 原文：Failed submissions returning a 4xx/5xx status do not trigger revalidations by default（与 react-router 8.5 的源码一致）
  - title: useRevalidator — React Router API
    url: https://reactrouter.com/api/hooks/useRevalidator
    checked: 2026-10-21
  - title: Response.ok — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/API/Response/ok
    checked: 2026-10-21
  - title: 422 Unprocessable Content — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Reference/Status/422
    checked: 2026-10-21
  - title: 409 Conflict — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Reference/Status/409
    checked: 2026-10-21
---

## 要做什么

p2-01 需求的第 2 条和第 4 条：在详情页上勾选任务、添加任务，数据保存在服务器上。写成验收条件：

1. 打开详情页时显示“正在加载”；加载失败时说明原因，并且可以重试（g14 讲过，起始代码已经写好）；
2. 勾选一个任务，复选框**立刻**变化，不等服务器的回应；服务器拒绝或者连接失败时，复选框恢复原来的样子，并在这个任务旁边说明原因；
3. 添加任务时，在服务器回应之前“添加”按钮不能再点，连点两次也只发出一个请求；
4. 服务器说“输入不对”（例如任务重名）时，错误显示在输入框旁边，输入的内容保留；其他错误（例如项目已经完成）用一条提示说明；
5. 添加成功之后，新任务出现在列表中，输入框清空。

## 服务器的接口

| 请求 | 成功 | 失败 |
| --- | --- | --- |
| `GET /api/projects/:projectId` | 200，项目 | 404：没有这个项目 |
| `POST /api/projects/:projectId/tasks`，`{ "title": "…" }` | 201，新的任务 | 422：`{ "errors": { "title": "任务不能为空" } }`；409：`{ "error": "已完成的项目不能修改任务" }` |
| `PATCH /api/projects/:projectId/tasks/:taskId`，`{ "done": true }` | 200，修改后的任务 | 404：没有这个任务；409：同上 |

两种拒绝的区别：**422**（Unprocessable Content）表示请求的内容不对，响应中按字段列出错误，界面把它们显示在对应的输入框旁边；**409**（Conflict）表示请求本身没问题，但和服务器上现在的状态冲突（项目已经完成了），界面显示一条说明。

这个里程碑还没有真正的服务器（p3 才有）：练习用模拟的响应，编程挑战用 `fake-server.ts`，一个在内存中运行、实现了上面接口的“服务器”。

## 每一种失败都是一种类型

`fetch` 只在**连接失败**时拒绝（抛出 `TypeError`）。服务器返回 404、500 时，`fetch` 照样成功，要自己检查 `response.ok`（状态码在 200–299 之间）。响应体不是 JSON 时（比如代理服务器返回了一个 HTML 的错误页面），`response.json()` 才抛出异常：

:::playground{#fetch-failures mode=ts fixtures=api}
```ts file=main.ts
for (const path of ['/api/projects/p1', '/api/projects/p9', '/api/projects/html', '/api/projects/down']) {
  try {
    const response = await fetch(path);
    console.log(path, response.status, response.ok, response.headers.get('content-type'));
    await response.json();
  } catch (error) {
    console.log(path, '抛出了', error instanceof Error ? error.name : error);
  }
}
```
- `p9` 是 404：`fetch` 没有抛出异常，只是 `ok` 为 `false`，响应体照样是 JSON；
- `html` 的状态码是 200，类型却是网页：`response.json()` 抛出 `SyntaxError`；
- `down` 连接失败：`fetch` 本身拒绝，抛出 `TypeError`。
:::

调用方关心的是“发生了什么，该怎么告诉用户”，而不是这些细节。所以和 p2-01 的 `update` 一样，API 客户端返回一个结果，失败的原因是一个可辨识联合（b09）：

```ts
type ApiError =
  | { kind: 'network' } // 连接失败
  | { kind: 'not-found' } // 404
  | { kind: 'invalid'; errors: Readonly<Record<string, string>> } // 422：每个字段的错误
  | { kind: 'conflict'; message: string } // 409：违反了业务规则
  | { kind: 'server'; status: number } // 其他的错误状态码
  | { kind: 'bad-response' }; // 成功了，但返回的不是期望的数据

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };
```

几个要点：

- **成功的数据也要检查**：服务器的程序也会有 bug，部署也可能新旧版本不一致。和 e06 一样，用解析函数把 `unknown` 变成 `Project`，格式不对就是 `bad-response`，而不是让一个 `undefined` 在界面深处才出错；
- **错误的响应体也要检查**：说好 422 时返回 `{ errors: … }`，但网关、代理在出错时可能返回一个网页。格式不对的 409、422 就当作一般的服务器错误；
- **被中止的请求不是失败**：loader 和 action 收到的 `request.signal` 会在请求不再需要时被中止，例如数据还没加载完，用户就去了别的页面；或者同一个 fetcher 又提交了一次（e08、g14）。这时 `fetch` 抛出 `AbortError`，它不应该变成“无法连接服务器”显示给用户，而是继续抛出：React Router 知道这次请求已经不需要了，会忽略它。

::exercise{#api-client}

## 修改数据：action

g14 中，路由的 `loader` 在导航时**读取**数据。**修改**数据用路由的 `action`：

```tsx
export async function projectAction({ params, request }: ActionFunctionArgs) {
  const form = await request.formData();
  if (form.get('intent') === 'toggle') {
    const result = await setTaskDone(params.projectId ?? '', String(form.get('taskId')), form.get('done') === 'true', request.signal);
    return result.ok ? data({ ok: true }) : data({ ok: false, message: errorMessage(result.error) }, { status: 400 });
  }
  // …
}

{ path: 'projects/:projectId', loader: projectLoader, action: projectAction, Component: ProjectPage }
```

提交的方式有两种：

- `<Form method="post">`、`useSubmit()`：提交是一次**导航**，像点了一个链接，会新增一条历史记录。适合“提交之后去另一个页面”，例如新建项目之后转到它的详情页；
- `useFetcher()`：提交**不导航**，页面和地址都不变。适合在一个页面上做很多小的修改，例如勾选任务、添加一个任务。每个 `useFetcher()` 有自己独立的状态，几个任务可以同时在保存。

一个页面上常常有几种提交，都交给同一个 action。约定在表单中带一个 `intent` 字段，action 根据它决定做什么。

**action 完成之后，React Router 会重新运行页面上的 loader**，界面显示的就是服务器上最新的数据，不需要手动把新任务插进列表。例外是 action 返回 4xx、5xx 的状态码（用 `data(值, { status })` 返回）：React Router 认为这次提交失败了，数据没有变，默认不重新加载。所以失败时要返回一个错误的状态码，而不是一个状态码为 200 的 `{ ok: false }`。

## 乐观更新

勾选一个任务，如果要等服务器回应之后复选框才变化，网络慢的时候用户会以为没点上，再点一次。大部分修改都会成功，所以可以先按“成功了”显示，这叫**乐观更新**：

```tsx
const fetcher = useFetcher<typeof projectAction>();
const done = fetcher.formData ? fetcher.formData.get('done') === 'true' : task.done;
```

`fetcher.formData` 是正在提交的数据，只在提交期间存在。提交期间显示提交的值；结束之后它消失，显示的又是 loader 的数据：成功时，loader 已经重新运行，数据就是新的值；失败时，数据没有变，复选框自然就恢复了。不需要另外的 state，也不需要“失败时改回去”的代码。

## 防止重复提交

`fetcher.state` 是 `'idle'`、`'submitting'`（等待 action）或 `'loading'`（action 完成之后，等待 loader 重新运行）。不是 `'idle'` 时禁用提交按钮：

```tsx
const busy = fetcher.state !== 'idle';
<button type="submit" disabled={busy}>{busy ? '添加中…' : '添加'}</button>
```

按钮禁用之后，在输入框中按回车也不会提交（HTML 规定，表单的默认按钮被禁用时，回车不提交表单）。

只在服务器端看，这样仍然不是绝对安全的：网络慢、用户刷新了页面，同一个请求还是可能到达两次。更可靠的系统会给每次提交一个唯一的编号，服务器发现重复的编号就不再执行（幂等键）。在界面上禁用按钮，挡住的是最常见的情况：用户连点。

## 错误显示在哪里

同样是失败，显示的位置不同：

- **字段的错误**（422）：显示在输入框旁边，用 `aria-invalid` 和 `aria-describedby` 关联到输入框（g06）。输入的内容要保留，用户改一下就能再提交；
- **操作的错误**（409、连接失败、服务器出错）：和某个输入框无关，用一个 `role="alert"` 的元素说明，屏幕阅读器会立刻读出它；
- **某一项的错误**：勾选任务失败时，说明放在这个任务里面，用户才知道是哪一个。

添加成功之后要清空输入框。如果输入框是受控的，可以在渲染时根据新的结果调整 state；如果不是受控的，可以在 Effect 中调用表单的 `reset()`：这是对 DOM 的操作，而不是 `setState`（g11）。编程挑战的参考解用了后一种，替代解用了前一种。

## 编程挑战

::exercise{#task-actions}

::quiz

## 常见错误

- **以为 `fetch` 在 404、500 时会抛出异常**：它只在连接失败时拒绝。检查 `response.ok`。
- **只在成功时检查数据**：失败的响应体也可能不是期望的格式，例如网关返回的网页。
- **把中止当作失败**：用户离开页面之后，还弹出一个“无法连接服务器”。中止时继续抛出。
- **失败时返回状态码 200**：React Router 以为成功了，又重新加载一遍数据。用 `data(值, { status: 4xx })`。
- **乐观更新时复制一份 state**：失败时还要记得改回去。从 `fetcher.formData` 和 loader 的数据算出来。
- **提交期间按钮可以再点**：连点两次就提交了两次。用 `fetcher.state` 禁用按钮。
- **所有错误都显示在页面顶部**：用户不知道是哪个输入框、哪个任务出了问题。

## 下一步

项目面板的主要功能都有了。p2-05 给它写测试：组件测试覆盖每一种状态，端到端测试在真正的浏览器中走一遍主要的流程。
