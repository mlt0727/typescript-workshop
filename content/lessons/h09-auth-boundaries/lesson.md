---
version: 1
mode: ts
estimatedMinutes: 55
review: ai-draft
problem: 登录之后，服务器怎样在后面的每个请求中认出这个用户？会话保存在 cookie 中时，怎样保证它没有被改过？Next.js 的 Proxy 在每个请求到达页面之前运行，看起来是检查登录的理想位置，但它只是第一道门：它的 matcher 漏掉的地址、直接发来的 Server Function 请求，都不会经过它。这一课不教“怎样写一个完整的登录系统”（那应该交给经过审查的库），而是讲清楚认证话题中的几条安全边界：会话 cookie 的属性，签名和加密的区别，Proxy 能做什么、不能做什么，以及为什么每个读取数据和修改数据的地方都要自己检查权限。结果都在实测的 Next.js 16.4.2 项目中确认过。
objectives:
  - 区分认证（你是谁）和授权（你能做什么），把授权的规则写成一个可以测试的纯函数
  - 设置会话 cookie 时加上 HttpOnly、Secure、SameSite、过期时间，知道不加选项时的默认值
  - 用 HMAC 签名会话，知道签名不是加密，验证签名要用常数时间的比较
  - 知道 Proxy 只适合乐观的检查，每个 Server Function、Route Handler 和数据读取都要自己验证会话
references:
  - title: Authentication — Next.js（16.4，随 next 包附带的文档）
    url: https://nextjs.org/docs/app/guides/authentication
    checked: 2026-10-21
    note: 以 Next.js 16.4.2 为准；课中的实测项目由 create-next-app 16.4.2 生成
  - title: Proxy — Next.js
    url: https://nextjs.org/docs/app/getting-started/proxy
    checked: 2026-10-21
  - title: Using HTTP cookies — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies
    checked: 2026-10-21
  - title: SubtleCrypto.verify() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/verify
    checked: 2026-10-21
  - title: Secure contexts — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts
    checked: 2026-10-21
  - title: OWASP Session Management Cheat Sheet
    url: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
    checked: 2026-10-21
---

## 要做什么

这一课讲认证话题中几条容易被忽视的边界：

1. 认证和授权的区别，把授权写成一个纯函数（练习一）；
2. 会话保存在哪里，cookie 应该有哪些属性；
3. 签名的会话：防止被篡改，但不能保密（练习二）；
4. Proxy 能做什么、不能做什么；每个入口都要自己检查。

这一课**不**教怎样从零写一个登录系统：密码的存储、登录的限流、找回密码、多因素认证，这些交给经过审查的库和服务（例如 Auth.js、Better Auth，或者 Clerk 这样的托管服务）。下面的结果都来自 2026-10-21 在本机运行的 Next.js 16.4.2 项目（`next build` 和 `next start`）中的一个最小的登录流程。

## 认证和授权

- **认证**：确认“你是谁”。登录成功之后，服务器给浏览器一个**会话**，之后的每个请求带着它，服务器据此认出用户；
- **授权**：确认“你能做什么”。同一个用户，可以查看自己的项目，不能删除别人的项目。

授权的规则最好集中写成一个纯函数：输入是用户、操作和数据，输出是允许或者拒绝的原因。页面上是否显示“删除”按钮、Server Function 是否执行删除、Route Handler 是否返回数据，都调用它。

::exercise{#policy}

## 会话放在哪里

两种常见的做法：

- **无状态的会话**：会话的内容（用户 id、角色、过期时间）签名之后放在 cookie 中。服务器不需要保存任何东西，验证签名就知道它是不是自己发的。缺点是在过期之前很难让它失效（例如用户修改了密码、管理员禁用了账号）；
- **数据库中的会话**：cookie 中只放一个随机的会话 id，内容在数据库中。每个请求要查一次数据库，但可以随时删除一个会话，让它立刻失效。

不管哪一种，cookie 的属性都很重要。实测项目中的登录接口用 `cookies()`（`next/headers`）设置会话，带上文档推荐的选项：

```ts
(await cookies()).set('session', token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 3600 });
```

响应头是：

```text
set-cookie: session=…; Path=/; Expires=Wed, 21 Oct 2026 17:50:22 GMT; Max-Age=3600; Secure; HttpOnly; SameSite=lax
```

而不带选项的 `set('session', token)`，响应头只有 `Path=/`：**没有** `HttpOnly`、`Secure`、`SameSite`，也没有过期时间（关闭浏览器就没了）。每个属性的作用：

| 属性 | 作用 |
| --- | --- |
| `HttpOnly` | 页面中的 JavaScript 读不到它：即使页面被注入了恶意的脚本（XSS），也偷不走会话 |
| `Secure` | 只通过 HTTPS 发送（浏览器把 `localhost` 当作例外，开发时也能用） |
| `SameSite=Lax` | 从别的网站发起的 POST 等请求不带上它，减少跨站请求伪造（CSRF）；h05 中 Next.js 对 Server Function 的 Origin 检查是另一层保护 |
| `Max-Age` / `Expires` | 过期的时间；会话本身（例如签名中的 `expiresAt`）也要有自己的过期时间，不能只靠浏览器删除 cookie |

## 签名的会话

签名让服务器可以把数据交给浏览器保管，又不怕它被改：用一个只有服务器知道的密钥，对内容计算 HMAC，附在后面。实测项目的会话令牌是 `base64url(JSON).base64url(HMAC-SHA256)`，用 Web Crypto（`crypto.subtle`）计算，Proxy 和 Route Handler 中都能用：

- 把令牌的第一部分做 base64 解码，直接得到 `{"userId":"u1","role":"member","expiresAt":1792605022}`：**签名不是加密**，谁都能读；
- 把其中的 `"member"` 改成 `"admin"`，签名沿用原来的：验证失败，Proxy 把请求重定向到了登录页；
- 一个随便写的 `session=eyJ1c2VySWQiOiJhZG1pbiJ9.abc`：同样被拒绝。

`crypto.subtle` 只在**安全上下文**中存在：HTTPS 的页面、`localhost`，以及 Node.js 和 Next.js 的服务器。这个网站为了隔离你的代码，把示例和练习放在一个不透明来源的沙箱中运行，浏览器对它的处理不一样：2026-10-21 在本地实测，Chromium 中它不是安全上下文，`crypto.subtle` 是 `undefined`；WebKit（Safari 的引擎）中则有（下面示例的最后一行会打印出来）。为了在所有的浏览器中都能运行，下面的示例和练习二用一个纯 TypeScript 写的 `hmacSha256`（`hmac-sha256.ts`，只读），它的结果和 `crypto.subtle` 的完全一样：练习二的测试中的令牌就是用 Node.js 的 `crypto.subtle` 算出来的。真实的项目中不要自己实现这些，用 `crypto.subtle`。

在浏览器中试一试（这个令牌就是练习二的测试中用的那一个）：

:::playground{#hmac-session}
```ts file=main.ts
import { hmacSha256 } from './hmac-sha256';

const token = 'eyJ1c2VySWQiOiJ1MSIsInJvbGUiOiJtZW1iZXIiLCJleHBpcmVzQXQiOjIwMDAwMDAwMDB9.KDBHhMfQV5kvzqbp77k1-x0jFXPpGuGXDgn7HVG9EZU';
const [payload = '', signature = ''] = token.split('.');
const encoder = new TextEncoder();
const toBase64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

console.log('任何人都能读：', atob(payload.replaceAll('-', '+').replaceAll('_', '/')));

const key = encoder.encode('current-secret-0123456789abcdefghij');
const sign = (part: string) => toBase64Url(hmacSha256(key, encoder.encode(part)));

// 演示用 ===；真正验证签名时要用常数时间的比较（练习二）
console.log('原来的内容：', sign(payload) === signature);
const forged = toBase64Url(encoder.encode('{"userId":"u1","role":"admin","expiresAt":2000000000}'));
console.log('改成 admin：', sign(forged) === signature);

console.log('安全上下文：', globalThis.isSecureContext, '；crypto.subtle：', typeof globalThis.crypto.subtle);
```
```ts file=hmac-sha256.ts readonly
/**
 * SHA-256（FIPS 180-4）和 HMAC-SHA256（RFC 2104）的一个简短的实现。
 * 只是因为练习的沙箱不是安全上下文、没有 crypto.subtle（见正文）；真实的项目中用 crypto.subtle 或者 node:crypto。
 */
const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

export function sha256(data: Uint8Array): Uint8Array<ArrayBuffer> {
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const length = Math.ceil((data.length + 9) / 64) * 64;
  const padded = new Uint8Array(length);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  const bits = data.length * 8;
  view.setUint32(length - 8, Math.floor(bits / 0x100000000));
  view.setUint32(length - 4, bits >>> 0);

  const w = new Array<number>(64).fill(0);
  for (let offset = 0; offset < length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const w15 = w[i - 15] ?? 0;
      const w2 = w[i - 2] ?? 0;
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      w[i] = ((w[i - 16] ?? 0) + s0 + (w[i - 7] ?? 0) + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h.map((x) => x);
    a ??= 0;
    b ??= 0;
    c ??= 0;
    d ??= 0;
    e ??= 0;
    f ??= 0;
    g ??= 0;
    hh ??= 0;
    for (let i = 0; i < 64; i++) {
      const t1: number = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + (K[i] ?? 0) + (w[i] ?? 0)) >>> 0;
      const t2: number = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, hh].forEach((value, i) => {
      h[i] = ((h[i] ?? 0) + value) >>> 0;
    });
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  h.forEach((value, i) => outView.setUint32(i * 4, value));
  return out;
}

export function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array<ArrayBuffer> {
  const block = new Uint8Array(64);
  block.set(key.length > 64 ? sha256(key) : key);
  const inner = new Uint8Array(64 + message.length);
  const outer = new Uint8Array(64 + 32);
  for (let i = 0; i < 64; i++) {
    const byte = block[i] ?? 0;
    inner[i] = byte ^ 0x36;
    outer[i] = byte ^ 0x5c;
  }
  inner.set(message, 64);
  outer.set(sha256(inner), 64);
  return sha256(outer);
}
```
- 第 8 行：令牌的第一部分只是 base64 编码，解码就是 JSON；
- 第 11 行：用密钥对 `payload` 重新计算签名；
- 第 16 行：`false`：内容改了一个词，签名就对不上了；
- 第 18 行：实测 Chromium 中打印 `false` 和 `undefined`，WebKit 中打印 `true` 和 `object`。
:::

所以会话中只放“被别人看到也没关系”的东西；需要保密时用加密的格式，或者改用数据库中的会话。密钥本身放在服务器的环境变量中（h08），不能有 `NEXT_PUBLIC_` 前缀。

## Proxy：第一道门，不是唯一的门

Next.js 16 中，项目根目录的 `proxy.ts`（以前叫 Middleware）在请求到达页面和 Route Handler 之前运行。实测项目中：

```ts
// proxy.ts
export async function proxy(request: NextRequest) {
  const session = await verifySession(request.cookies.get('session')?.value);
  if (session === null) return NextResponse.redirect(new URL('/h09/login', request.url));
  return NextResponse.next();
}

export const config = { matcher: ['/h09/dashboard/:path*'] };
```

实测的结果：

| 请求 | 结果 |
| --- | --- |
| `/h09/dashboard`，没有 cookie，或者 cookie 是伪造的 | **307**，`Location: /h09/login` |
| `/h09/dashboard`，登录接口返回的 cookie | 200 |
| `/api/h09/notes`（`matcher` 之外），没有 cookie | **200**，返回了 `u1 的私人笔记` |
| `/api/h09/notes-safe`（自己验证会话），没有 cookie | 401 |

第三行就是 Proxy 的边界：`matcher` 之外的地址不会经过它。漏掉一个路径、写错一个模式，保护就没了。另外：

- Server Function 是向**页面所在的地址**发 POST（h05），能不能经过 Proxy 取决于 `matcher`，不能指望它；
- 文档建议 Proxy 只做“乐观的检查”：只读 cookie、验证签名，**不查数据库**，因为它对每个匹配的请求（包括预先获取）都运行；
- 它适合的事：没有登录时把页面重定向到登录页、对整组页面统一处理，让用户少看到一次错误。

真正的保护在**每一个**读取和修改数据的地方。文档推荐写一个数据访问层（Data Access Layer）：

```ts
// app/lib/dal.ts
import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const verifySession = cache(async () => {
  const session = await decrypt((await cookies()).get('session')?.value);
  if (!session?.userId) redirect('/login');
  return { userId: session.userId };
});
```

`server-only`（h03）保证它不会被导入到浏览器的代码中，`cache`（h04）让同一个请求中多次调用只验证一次。每个 Server Function、Route Handler 和读取数据的函数都先调用它，再用练习一那样的规则判断权限；返回给客户端组件的数据也只包含需要的字段（h03、h05）。在布局中检查是不够的：导航时布局不会重新渲染（h02），页面要自己检查。

## 编程挑战

::exercise{#session}

::quiz

## 常见错误

- **只在 Proxy 中检查登录**：实测 `matcher` 之外的接口不带 cookie 也返回了数据。每个入口都要自己验证会话。
- **只在页面上隐藏按钮**：请求可以不经过页面发来。Server Function 和 Route Handler 中也要检查权限。
- **设置会话 cookie 时不加选项**：实测默认只有 `Path=/`，页面中的脚本可以读到它。加上 `httpOnly`、`secure`、`sameSite` 和过期时间。
- **以为签名的会话是保密的**：base64 一解码就能读出来。
- **用 `===` 比较签名或者密码的哈希**：比较的快慢会泄漏信息。用 `crypto.subtle.verify` 或者 Node.js 的 `crypto.timingSafeEqual`。
- **对无关的人返回 403**：等于告诉他资源存在。返回 404。
- **自己发明认证的方案**：用经过审查的库。

## 下一步

H 阶段到这里结束。项目 3 把 H 阶段的内容合起来：从规划开始，做一个有服务器、有数据库、有登录的全栈应用。
