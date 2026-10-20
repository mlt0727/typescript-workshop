---
version: 1
mode: ts
estimatedMinutes: 40
review: self-reviewed
problem: 网页的数据通常来自服务器：浏览器发出 HTTP 请求，服务器返回状态码、头部和响应体（大多是 JSON）。fetch 是浏览器发请求的标准方式，用起来只要一行，但有几个出人意料的地方：服务器返回 404 或 500 时 fetch 并不会失败；response.json() 的类型是 any，TypeScript 什么也不检查；响应体只能读取一次。这一课讲清 fetch 的这些行为，并写出一个可以放心使用的请求函数。
objectives:
  - 理解 HTTP 请求与响应的组成，认识常见的状态码
  - 用 fetch 发出 GET 和带 JSON 请求体的 POST 请求
  - 区分“网络失败”（fetch 被拒绝）和“HTTP 错误”（response.ok 为 false），两者都要处理
  - 把 response.json() 的结果当作 unknown，用 URL、URLSearchParams 和 encodeURIComponent 构造地址
references:
  - title: Using the Fetch API — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
    checked: 2026-10-20
  - title: Response — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/Response
    checked: 2026-10-20
  - title: HTTP response status codes — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status
    checked: 2026-10-20
  - title: URLSearchParams — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams
    checked: 2026-10-20
---

## HTTP 请求与响应

浏览器和服务器之间用 HTTP 通信。一次**请求**包括：方法（`GET` 读取、`POST` 创建、`PUT`/`PATCH` 修改、`DELETE` 删除）、地址（URL）、头部（headers，例如 `Content-Type`）和可选的请求体。服务器的**响应**包括：**状态码**、头部和响应体。

状态码按第一位数字分组：

| 范围 | 含义 | 常见的例子 |
| --- | --- | --- |
| 2xx | 成功 | 200 OK、201 Created（已创建）、204 No Content（成功，但没有响应体） |
| 3xx | 重定向与缓存 | 301、302、307、308 重定向（fetch 默认自动跟随，代码通常看不到它们）；304 未修改（缓存仍然有效） |
| 4xx | 客户端的问题 | 400 请求格式不对、401 未登录、403 没有权限、404 不存在、409 冲突、422 数据验证失败、429 请求太频繁 |
| 5xx | 服务器的问题 | 500 服务器内部错误、502/503/504 网关或服务暂时不可用 |

**关于本平台：** 练习中的 `fetch` 由平台**模拟**：每个地址返回课程预先写好的响应（真实的 `Response` 对象），不会真的访问网络。相对地址以一个虚构的域名 `https://app.example` 为基准；在真实网页中，它们以页面所在的域名为基准。

## fetch 不会因为 404 而失败

`fetch(url)` 返回 `Promise<Response>`。只有**请求根本没能完成**（断网、域名解析失败、被浏览器拦截、被取消）时它才会被拒绝；只要服务器回应了，哪怕是 404、500，fetch 都会**兑现**为一个 `Response`。判断成功要看 `response.ok`（状态码在 200–299 之间时为 `true`）或 `response.status`。

读取响应体的方法都返回 Promise：`response.json()` 解析 JSON，`response.text()` 读取文本。

:::playground{#basic fixtures=users}
```ts file=main.ts
async function show(url: string): Promise<void> {
  const response = await fetch(url);
  console.log(url, '→', response.status, response.statusText, 'ok =', response.ok);
  const body: unknown = await response.json();
  console.log('  响应体：', body);
}

await show('/api/users/1');
await show('/api/users/999');
```
- 第 8 行：成功，状态码 200，`ok` 为 `true`。
- 第 9 行：用户不存在，状态码 404，`ok` 为 `false`，但 `fetch` 没有被拒绝，代码照常往下执行，还读到了服务器返回的错误信息。不检查 `ok`，就会把这个错误信息当成用户数据。
- 第 3 行的 `statusText` 是状态码后面的说明文字（例如 `Not Found`）。HTTP/2 和 HTTP/3 不再传输它，真实网页中它常常是空字符串，不要依赖它，判断时看 `status`。
- 第 4 行：把鼠标停在 `response.json` 上，它的返回类型是 `Promise<any>`。这里把结果赋给 `unknown` 类型的变量，强制自己在使用前检查（下一课详讲）。直接使用 `any`，TypeScript 就不再帮你检查任何东西。
:::

## 两种失败

所以一次请求有两类失败，要分别处理：

- **网络失败**：`fetch` 被拒绝，通常是 `TypeError`；
- **HTTP 错误**：`fetch` 成功，但 `response.ok` 为 `false`。

另外，响应体不一定是 JSON：服务器出错时，常常返回一段 HTML 错误页面，这时 `response.json()` 会被拒绝：Chrome、Firefox 中的拒绝原因是 `SyntaxError`，Safari 中却是一个 `name` 为 `'SyntaxError'` 的 `DOMException`。所以判断时检查 `err.name === 'SyntaxError'`，不要用 `instanceof SyntaxError`；或者先 `response.text()` 再自己 `JSON.parse`，这样在所有浏览器中都是真正的 `SyntaxError`。响应体只能读取**一次**：读过之后再调用 `json()` 或 `text()`，返回的 Promise 会以 `TypeError` 拒绝。确实需要读两次时，先用 `response.clone()` 复制一份。

:::playground{#failures fixtures=users}
```ts file=main.ts
try {
  await fetch('/api/offline');
} catch (err) {
  console.log('网络失败：fetch 被拒绝，是 TypeError 吗？', err instanceof TypeError);
}

const response = await fetch('/api/broken');
console.log('状态：', response.status, '内容类型：', response.headers.get('content-type'));
try {
  await response.json();
} catch (err) {
  console.log('响应体不是 JSON：', err instanceof Error ? err.name : err);
}
console.log('响应体已经读过了吗？', response.bodyUsed);
```
- 第 2 行：模拟的“断网”，`fetch` 被拒绝。
- 第 7 行：服务器返回 500 和一段 HTML。第 10 行尝试按 JSON 解析，失败的原因名为 `SyntaxError`（在 Safari 中打开这一页，它是一个 `DOMException`，名字相同）。
- 第 14 行：即使解析失败，响应体也已经被读取，不能再读第二次。需要两种方式都试一试时，先 `text()`，再自己 `JSON.parse`。
:::

## 发送 JSON

创建数据时用 `POST`：在第二个参数中写出方法、头部和请求体。请求体要自己用 `JSON.stringify` 转成字符串，并用 `Content-Type: application/json` 告诉服务器这是 JSON。

:::playground{#post fixtures=users}
```ts file=main.ts
type NewTodo = { title: string; done: boolean };
const draft: NewTodo = { title: '写周报', done: false };

const response = await fetch('/api/todos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(draft),
});

console.log(response.status, response.statusText);
const created: unknown = await response.json();
console.log('服务器创建了：', created);
```
- 服务器返回 201 Created，以及创建好的对象（带有服务器分配的 `id`）。
- 第 1–2 行先用类型描述要发送的数据，写错字段名会在编译期发现。响应仍然是 `unknown`：服务器返回什么，TypeScript 并不知道。
:::

## 构造 URL

查询参数中可能有空格、`&`、中文等字符，直接拼接字符串很容易出错（`&` 会被当作参数之间的分隔符）。用 `URL` 和它的 `searchParams`（一个 `URLSearchParams` 对象）构造地址，编码会自动处理：

:::playground{#url fixtures=users}
```ts file=main.ts
const url = new URL('https://api.example.com/search');
url.searchParams.set('q', 'TypeScript & React 入门');
url.searchParams.set('page', String(2));

console.log(url.href);
console.log('读取参数：', url.searchParams.get('q'));

const wrong = `https://api.example.com/search?q=${'TypeScript & React'}&page=2`;
console.log('直接拼接：', [...new URL(wrong).searchParams]);
console.log('编码单个值：', `/api/books?topic=${encodeURIComponent('TypeScript & React')}`);

const response = await fetch(url);
console.log('请求成功：', response.ok);
```
- 第 5 行：`&` 被编码成 `%26`，空格编码成 `+`，中文按 UTF-8 编码。
- 第 9 行：直接拼接时，`&` 截断了参数：`q` 的值变成了 `TypeScript `（末尾带一个空格），` React` 则变成了一个没有值的参数。
- 第 10 行：只需要编码**一个值**、把它放进手写的地址（查询参数或者路径，例如 `/users/${encodeURIComponent(name)}`）时，用 `encodeURIComponent`。它把空格编码成 `%20`，`URLSearchParams` 编码成 `+`，在查询参数中两者都表示空格。不要用 `encodeURI`：它不编码 `&`、`=`、`?`。
- `fetch` 可以直接接受 `URL` 对象。
:::

::exercise{#get-json}

## 编程挑战

::exercise{#fetch-retry}

::quiz

## 常见错误

- **不检查 `response.ok`**：404、500 时把错误信息当成了数据。
- **以为 `catch` 能捕获 404**：fetch 只在网络失败时被拒绝。
- **`const data = await response.json()` 之后直接使用**：`data` 是 `any`，拼错的属性名也不会报错。赋给 `unknown`，验证之后再用。
- **POST JSON 时忘了 `JSON.stringify` 或 `Content-Type`**：在 TypeScript 中，直接把对象传给 `body` 会编译失败（它不是允许的请求体类型）；在 JavaScript 中或者值是 `any` 时，服务器收到的是 `[object Object]`。忘了 `Content-Type`，服务器可能不知道如何解析请求体。
- **用字符串拼接查询参数**：特殊字符会破坏 URL。用 `URLSearchParams`，或者用 `encodeURIComponent` 编码每一个值。

## 下一步

下一课解决 `unknown` 的问题：在运行时验证服务器返回的数据，把它安全地变成类型明确的值。
