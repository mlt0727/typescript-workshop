---
version: 1
mode: dom
estimatedMinutes: 40
review: ai-draft
problem: 刷新页面后，用户的设置、草稿、购物车都没了，体验很差。浏览器的 localStorage 可以把数据保存在本机，下次打开时再读出来。但它只能存字符串，日期、Set、Map 经过 JSON 之后会变样；读出来的数据可能来自旧版本的程序，也可能被用户手动改过，甚至根本无法解析；写入时还可能因为空间不足而失败。这一课讲如何可靠地保存和恢复数据。
objectives:
  - 使用 localStorage 和 sessionStorage，知道它们只存字符串、同步、按来源隔离
  - 知道 JSON 序列化会丢失或改变哪些值（Date、Set、Map、undefined、NaN），并在保存前后转换
  - 把“读取存储”当作数据边界：处理缺失、无法解析、格式不对和写入失败
  - 给保存的数据加上版本号，在格式变化时迁移旧数据；知道不应该在 localStorage 中保存什么
references:
  - title: Window.localStorage — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
    checked: 2026-10-20
  - title: Using the Web Storage API — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API
    checked: 2026-10-20
  - title: JSON.stringify() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify
    checked: 2026-10-20
  - title: Storage quotas and eviction criteria — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
    checked: 2026-10-20
---

## localStorage 与 sessionStorage

两者的用法相同，都是“字符串键 → 字符串值”的存储：

| 方法 | 作用 |
| --- | --- |
| `setItem(key, value)` | 保存。`value` 会被转换成字符串 |
| `getItem(key)` | 读取，类型是 `string \| null`，不存在时是 `null` |
| `removeItem(key)`、`clear()` | 删除一项、全部删除 |

区别在于寿命：`localStorage` 的数据一直保留，直到被删除（或者用户清除浏览器数据）；`sessionStorage` 只属于当前标签页，关闭标签页就没了。两者都按**来源**（协议 + 域名 + 端口）隔离：别的网站读不到你的数据。

它们是**同步**的 API，读写都会阻塞主线程，适合保存少量数据（各浏览器的上限通常是每个来源 5MB 左右）。

**关于本平台：** 沙箱里的 `localStorage` 和 `sessionStorage` 由内存模拟（界面上会标注），每次运行都从空开始，不会真的保存到你的浏览器里。

:::playground{#basics}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=main.ts
localStorage.setItem('theme', 'dark');
localStorage.setItem('fontSize', String(18));

const theme = localStorage.getItem('theme');
const fontSize = localStorage.getItem('fontSize');
console.log(theme, fontSize, typeof fontSize);
console.log('不存在的键：', localStorage.getItem('missing'));

localStorage.removeItem('theme');
console.log('删除之后：', localStorage.getItem('theme'), '，还剩', localStorage.length, '项');
```
- 第 2 行：`setItem` 只接受字符串（在 TypeScript 中直接传 `18` 会报错），所以先用 `String(18)` 转换；在 JavaScript 中直接传数字，也会被自动转换成 `"18"`。第 5 行读出来的同样是字符串。
- 第 4 行：把鼠标停在 `theme` 上，类型是 `string | null`。读取的结果总要处理 `null`。
:::

## JSON 往返会改变什么

要保存对象或数组，先用 `JSON.stringify` 变成字符串，读取时再 `JSON.parse`。但 JSON 只有字符串、数字、布尔值、`null`、数组和普通对象，其他值会被改变或丢弃：

:::playground{#json-roundtrip}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=main.ts
const original = {
  name: 'Ada',
  joined: new Date('2026-10-20T08:00:00Z'),
  tags: new Set(['ts', 'dom']),
  scores: new Map([['e01', 90]]),
  nickname: undefined,
  ratio: Number.NaN,
};

const text = JSON.stringify(original);
console.log(text);

const restored: unknown = JSON.parse(text);
console.log(restored);
```
- `Date` 变成了 ISO 格式的字符串（读回来也只是字符串，不会自动变回日期）；
- `Set` 和 `Map` 变成了空对象 `{}`，内容全部丢失；
- 值为 `undefined` 的属性被省略；`NaN` 变成了 `null`。
- 类的实例也只剩下自己的数据属性，读回来是普通对象，方法都没有了。

另外，`JSON.stringify` 遇到 `BigInt` 或者循环引用（对象直接或间接地引用了自己）时会抛出 `TypeError`，所以保存数据的代码也要准备好处理错误。

所以保存之前，要把数据转换成 JSON 能表示的形式（例如 `Set` → 数组、`Date` → 字符串）；读取之后，再验证并转换回来（e06）。
:::

## 读取存储也是数据边界

读取 `localStorage` 和读取 `fetch` 的结果一样，必须当作不可信的数据（e06）：

- 键可能不存在（第一次使用，或者用户清除了数据）；
- 内容可能不是合法的 JSON（被手动改过，或者写入时被截断）；
- 内容可能是**旧版本的程序**写入的，格式和现在不一样；
- 在某些隐私设置下，访问 `localStorage` 本身就会抛出错误。

写入也可能失败：超出存储上限时，`setItem` 会抛出 `QuotaExceededError`。所以读写都应该放在 `try/catch` 里，失败时退回到默认值，而不是让整个页面崩溃。

```ts
function loadTheme(): 'light' | 'dark' {
  try {
    const raw = localStorage.getItem('theme');
    return raw === 'light' || raw === 'dark' ? raw : 'light';
  } catch {
    return 'light';
  }
}
```

## 版本与迁移

程序会升级，保存的数据格式也会变：今天保存的是 `{ theme: 'dark' }`，下个版本也许变成 `{ version: 2, theme: 'dark', fontSize: 16 }`。用户的浏览器里仍然留着旧格式的数据。常见的做法是在保存的数据里写上**版本号**，读取时根据版本号处理：是当前版本就验证后使用；是已知的旧版本就**迁移**成新格式；无法识别就使用默认值。挑战题会实现这个过程。

## 不要保存什么

- **密码、访问令牌等机密**：页面上的任何脚本都能读取 `localStorage`，一旦网站出现 XSS 漏洞（e12），攻击者的脚本就能把它们发送出去；
- **大量数据或二进制文件**：同步的 API 会卡住页面，容量也有限。更大、更结构化的数据用 IndexedDB（本课程平台用它保存你的学习进度）；
- **需要在设备之间同步的数据**：`localStorage` 只在这台设备的这个浏览器里，换一台设备就没有了。

另外，同一个来源打开了多个标签页时，一个标签页修改了 `localStorage`，**其他**标签页会收到 `storage` 事件（修改的那个页面自己收不到），可以据此保持同步。

最后，不要把 `localStorage` 当作唯一的一份重要数据：用户可能清除浏览器数据，隐私浏览模式关闭后数据就没了，Safari 还会清除用户一段时间（7 天）没有访问过的网站用脚本写入的存储。它适合保存“丢了也不要紧”的数据，例如偏好设置和草稿。

::exercise{#persisted-value}

## 编程挑战

::exercise{#settings-migration}

::quiz

## 常见错误

- **把数字、布尔值存进去，读出来直接用**：读出来的都是字符串，`'false'` 是 truthy。
- **直接 `JSON.parse(raw)` 并使用结果**：内容损坏时抛出异常，结果的类型是 `any`，格式不对也不会被发现。用 `try/catch` 包住解析，并验证结果。
- **保存 `Set`、`Map`、`Date` 之前不转换**：读回来时数据已经丢了或者变成了字符串。
- **不处理旧格式的数据**：程序升级后，老用户一打开页面就出错。
- **把令牌、密码放在 `localStorage`**：XSS 可以直接读取。

## 下一步

下一课讲 URL 与浏览器历史：用地址栏保存界面状态，实现基础的前端路由。
