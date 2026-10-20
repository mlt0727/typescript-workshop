---
version: 1
mode: ts
estimatedMinutes: 35
review: self-reviewed
problem: 前端代码请求另一个域名的接口，控制台里出现了一行红字：“has been blocked by CORS policy”。很多人的第一反应是在前端找办法绕过去，或者装个浏览器插件把它关掉。理解了 CORS 到底在保护什么，就会明白为什么不能这样做：它保护的是浏览器里的用户，规则由被请求的服务器制定，解决办法也在服务器那一边。
objectives:
  - 判断两个地址是否同源，理解同源策略限制的是“读取跨源响应”
  - 理解 CORS 保护的是用户的数据，而不是服务器；知道为什么在前端无法、也不应该绕过它
  - 区分简单请求与预检请求，读懂 Access-Control-Allow-* 等响应头的含义
  - 知道带凭据（cookie）的跨源请求的额外要求，以及开发时用代理、上线时由服务器配置的正确做法
references:
  - title: Cross-Origin Resource Sharing (CORS) — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS
    checked: 2026-10-20
  - title: Same-origin policy — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy
    checked: 2026-10-20
  - title: Fetch Standard（CORS protocol）— WHATWG
    url: https://fetch.spec.whatwg.org/#http-cors-protocol
    checked: 2026-10-20
---

## 同源

**来源**（origin）由三部分组成：协议、域名、端口。三者都相同才是**同源**：

:::playground{#origins}
```ts file=main.ts
const page = new URL('https://app.example.com/dashboard');

const targets = [
  'https://app.example.com/api/user',
  'https://api.example.com/user',
  'http://app.example.com/api/user',
  'https://app.example.com:8443/api/user',
];

for (const target of targets) {
  const url = new URL(target);
  console.log(url.origin === page.origin ? '同源' : '跨源', target);
}
```
- 第 4 行：路径不同不影响，同源。
- 第 5–7 行：子域名不同、协议不同、端口不同，都是跨源。
:::

浏览器的**同源策略**并不禁止页面向别的来源**发出**请求（`<img>`、`<form>` 一直都可以），它禁止的是页面上的脚本**读取**跨源请求的响应，除非对方明确允许。

## CORS 保护的是谁

为什么要限制读取？因为请求是从**用户的浏览器**发出的，带着这个用户的身份。假设你登录了银行网站，又打开了一个恶意网页；如果恶意网页的脚本可以用 `fetch('https://bank.example/account', { credentials: 'include' })` 带上你的 cookie 请求账户信息，并且读到结果，它拿到的就是**你的**账户信息。同源策略阻止了这件事。

（现代浏览器默认把没有声明 `SameSite` 的 cookie 当作 `SameSite=Lax`，跨站的 `fetch` 通常不会带上它们；只有服务器明确设置了 `SameSite=None; Secure` 的 cookie 才会被带上。但同源策略保护的不只是 cookie：公司内网中的服务、家里路由器的管理页面、只按 IP 地址认证的接口，都只有“在用户的网络里”才能访问，同样不能让任意网页读取。）

**CORS**（跨源资源共享）是在这个限制上开的口子：被请求的服务器在响应头里声明“允许哪些来源读取我的响应”，浏览器检查之后，才把响应交给页面的脚本。所以：

- CORS 保护的是**用户**的数据，执行检查的是**浏览器**，制定规则的是**被请求的服务器**；
- 它不是用来保护服务器的：`curl` 或者你自己的后端可以随意请求任何接口，根本不经过 CORS；
- “被 CORS 拦下”的如果是简单请求（见下文），请求已经到达了服务器，只是浏览器不让脚本读取响应；需要预检的请求，预检没通过时真正的请求不会发送。无论哪种，`fetch` 都以 `TypeError` 拒绝，具体原因只出现在控制台里，脚本拿不到（这是故意的，避免泄露信息）。

## 响应头

服务器用这些响应头声明规则：

| 响应头 | 含义 |
| --- | --- |
| `Access-Control-Allow-Origin` | 允许读取响应的来源，例如 `https://app.example.com`；公开的、不需要登录的数据可以用 `*` |
| `Access-Control-Allow-Methods` | 预检时声明允许的方法，例如 `GET, POST, PUT` |
| `Access-Control-Allow-Headers` | 预检时声明允许的请求头，例如 `Content-Type, Authorization` |
| `Access-Control-Max-Age` | 预检结果可以缓存多少秒 |
| `Access-Control-Allow-Credentials` | 为 `true` 时，允许带 cookie 的请求读取响应 |
| `Access-Control-Expose-Headers` | 允许脚本读取的额外响应头（默认只能读取少数几个常用的头） |

## 简单请求与预检请求

有些跨源请求，浏览器会先发一个 `OPTIONS` 方法的**预检请求**，问服务器“我接下来要用这个方法、带这些请求头来请求你，可以吗？”，服务器同意了才发送真正的请求。

不需要预检的叫**简单请求**，条件（简化后）是：

- 方法是 `GET`、`HEAD`、`POST` 之一；
- 只带有浏览器认为安全的请求头，例如 `Accept`、`Accept-Language`、`Content-Language`、`Content-Type`；
- `Content-Type` 只能是 `application/x-www-form-urlencoded`、`multipart/form-data`、`text/plain` 之一。

这些条件正是普通的 HTML 表单能发出的请求：它们在 CORS 出现之前就可以跨源发送，所以浏览器不再额外询问。反过来，发送 JSON（`Content-Type: application/json`）、使用 `PUT`/`DELETE`、或者带上 `Authorization` 头的请求，都会先预检。

## 带凭据的请求

`fetch` 默认只在同源请求中带上 cookie。跨源请求要带 cookie，需要写 `fetch(url, { credentials: 'include' })`，并且服务器必须：

- 返回 `Access-Control-Allow-Credentials: true`；
- `Access-Control-Allow-Origin` 写出**具体的来源**，不能是 `*`；
- 不允许把 `Access-Control-Allow-Credentials: true` 和 `*` 一起使用，浏览器会拒绝。

另外，只要 `Access-Control-Allow-Origin` 的值会**随请求的来源变化**（例如按白名单返回请求方的来源，不管带不带凭据），服务器就应该在响应中加上 `Vary: Origin`，包括不放行的响应。否则中间的缓存可能把给 A 的响应交给 B。

## 正确的解决方式

- **你能控制这个服务器**：在服务器上为你的前端来源配置 CORS 响应头（挑战题就是实现这部分逻辑）；
- **你不能控制它**（第三方接口）：由你自己的后端去请求它，前端只请求自己的后端（同源，或者你自己配置了 CORS）。这样还能把第三方的密钥留在服务器上（e13）；
- **本地开发**：前端开发服务器（例如 Vite 的 `server.proxy`）把 `/api` 转发给后端，浏览器看到的就是同源请求（F 阶段）。

不要做的事：

- `fetch(url, { mode: 'no-cors' })` 并不能“关掉”CORS：它得到的是一个**不透明**的响应，状态码是 0，内容读不到；
- 关闭浏览器安全设置或装插件“解决”CORS：只在你自己的浏览器里生效，你的用户仍然会被拦下；
- 以为 CORS 能防止 CSRF（跨站请求伪造）：简单请求不预检，带着 cookie 的表单提交仍然会到达服务器。防 CSRF 要靠 `SameSite` cookie 和 CSRF 令牌（H 阶段）。

**关于本平台：** 平台的 `fetch` 是模拟的，不会执行 CORS 检查，所以本课的练习用纯函数实现判断规则和服务器端的响应头。

::exercise{#needs-preflight}

## 编程挑战

::exercise{#cors-headers}

::quiz

## 常见错误

- **在前端想办法绕过 CORS**：规则由被请求的服务器制定，前端改不了，也不应该改。
- **服务器返回 `Access-Control-Allow-Origin: *` 同时允许凭据**：浏览器会拒绝。带 cookie 时要写出具体的来源。
- **只给真正的请求加响应头，忘了处理 `OPTIONS` 预检**：发 JSON 的请求永远过不了预检。
- **以为 CORS 是安全措施，可以保护接口**：它只约束浏览器里的脚本，接口的鉴权要自己做。

## 下一步

下一课讲 XSS（跨站脚本）：最常见的前端安全漏洞，以及 `textContent`、URL 校验、CSP 这些防线。
