---
version: 1
mode: ts
estimatedMinutes: 50
review: ai-draft
problem: 在 G 阶段，每个组件都在浏览器中运行。App Router 中，组件默认是服务端组件：它只在服务器上运行，可以直接读数据库、使用密钥，它的代码不会发给浏览器。需要 state、事件或者浏览器 API 的组件要写成客户端组件，在文件开头加上 'use client'。两种组件可以组合在一棵树中，但它们之间有一条边界：代码沿着 import 越过它，数据沿着 props 越过它，而且只有能序列化的数据才能过去。这一课在实测的 Next.js 16.4.2 项目中看清楚这条边界：哪些代码真的被发给了浏览器，哪些 props 传不过去、传过去之后变成了什么，以及把只能在服务器上运行的代码导入客户端组件时，构建怎样报错。
objectives:
  - 说出服务端组件和客户端组件各自在哪里运行、能做什么，以及它们的代码是否发给浏览器
  - 知道 'use client' 标出的是模块图的边界：只需要写在入口，它导入的所有模块都进入客户端
  - 判断哪些 props 可以从服务端组件传给客户端组件，以及 URL、Error、值为 undefined 的属性传过去之后的样子
  - 用 children 把服务端组件的内容放进客户端组件，用 server-only 防止服务端的代码进入浏览器
references:
  - title: Server and Client Components — Next.js（16.4，随 next 包附带的文档）
    url: https://nextjs.org/docs/app/getting-started/server-and-client-components
    checked: 2026-10-21
    note: 以 Next.js 16.4.2（React 19.3.0）为准；课中的实测项目由 create-next-app 16.4.2 生成
  - title: The Server and Client Boundary — Next.js
    url: https://nextjs.org/docs/app/guides/server-and-client-boundary
    checked: 2026-10-21
  - title: use client — Next.js
    url: https://nextjs.org/docs/app/api-reference/directives/use-client
    checked: 2026-10-21
  - title: "'use client'（Serializable types）— React"
    url: https://react.dev/reference/rsc/use-client
    checked: 2026-10-21
---

## 要做什么

h02 的 `Counter` 文件开头写了 `'use client'`。这一课回答为什么：

1. 服务端组件和客户端组件分别在哪里运行，代码会不会发给浏览器；
2. `'use client'` 到底标出了什么；
3. 服务端组件可以把什么样的 props 传给客户端组件；
4. 怎样防止只能在服务器上运行的代码（例如读取密钥的代码）进入浏览器。

下面的结果都来自 2026-10-21 在本机运行的 Next.js 16.4.2（React 19.3.0）项目，用 `next build` 和 `next start`。两个练习实现其中可以移植的两个检查：props 能不能传过去，模块在边界的哪一边。

## 两种组件

| | 服务端组件 | 客户端组件 |
| --- | --- | --- |
| 怎样写 | App Router 中的默认 | 文件开头写 `'use client'` |
| 在服务器上运行 | 是 | 是（生成 HTML） |
| 在浏览器中运行 | 否 | 是（水合，之后的更新） |
| 可以使用 | `async`/`await` 读数据、数据库、文件、密钥 | `useState`、`useEffect`、事件处理、`window`、`localStorage` |
| 代码发给浏览器 | 否，只发送渲染的结果 | 是 |

注意第二行：客户端组件**也在服务器上运行**，用来生成首屏的 HTML（h01 的服务端渲染）。“客户端”的意思是它的代码还会发给浏览器，并在那里再运行一次。

在实测项目中写了一个页面 `app/h03/page.tsx`（服务端组件），它在标题中显示一个常量 `SERVER_MARK` 的值，并渲染一个客户端组件 `ClientView`，后者的界面中有另一个标记字符串。构建之后在 `.next/static/`（发给浏览器的 JavaScript）中搜索：

- 客户端组件的标记出现在其中一个代码块中；
- 服务端组件的标记**不在**任何一个代码块中。它出现在 HTML 中，也出现在页面中内嵌的 RSC Payload（服务器渲染的结果，一种 React 自己的数据格式）中，但 `SERVER_MARK` 这个名字和定义它的代码都不在浏览器中。

这就是服务端组件减少 JavaScript 体积、可以放心地使用密钥的原因：它的代码根本不会离开服务器。

## 'use client' 标出的是模块图的边界

`'use client'` 写在文件的最开头（在所有的 `import` 之前）。它不是说“这个组件是客户端组件”，而是说“**从这个模块开始，进入客户端的模块图**”：这个模块导入的所有模块，以及它们再导入的模块，都会被发给浏览器。所以只需要在入口写一次。实测：

- 客户端组件导入了 `lib/use-toggle.ts`，这个文件使用了 `useState`，没有写 `'use client'`：构建成功，运行正常。它在客户端的模块图中；
- 同一个 `lib/format.ts` 被服务端组件和客户端组件都导入了：构建之后，它的代码同时出现在浏览器的代码块和服务器的代码块中。Next.js 为两边各编译了一份；
- 一个使用了 `useState` 的组件文件没有写 `'use client'`，又被服务端组件（页面）直接导入：`useState` 留在了服务端组件的模块图中，构建失败：

```text
Error: You're importing a module that depends on `useState` into a React Server Component module. This API is only available in Client Components. To fix, mark the file (or its parent) with the `"use client"` directive.
```

两个规则：**代码沿着 `import` 越过边界**，客户端组件导入的东西都进入浏览器；**数据沿着 props 越过边界**，下一节讲。服务端组件可以导入并渲染客户端组件，反过来，客户端组件导入的模块都是客户端的，所以它不能“导入”一个服务端组件。

## 什么样的 props 能传过去

服务端组件渲染客户端组件时，props 要先序列化进 RSC Payload，在浏览器中再还原。实测项目中 `ClientView` 收到了这些 props，在浏览器中检查它们（水合之后）：

| 传的值 | 浏览器中收到的 |
| --- | --- |
| `new Date('2026-10-21T00:00:00Z')` | `Date` 的实例，时间不变 |
| `new Map([['a', 1], ['b', 2]])`、`new Set(['x', 'y'])` | `Map`、`Set` 的实例 |
| `BigInt(10)` | `bigint` |
| `[{ id: 't1', done: false }]` | 同样的数组和对象 |
| `Symbol.for('lab')` | `Symbol.keyFor` 得到 `'lab'`，还是同一个 symbol |
| `missing={undefined}` | `'missing' in props` 是 `false`：这个键不见了 |

下面这些值让构建失败（页面是静态的，构建时预渲染，所以在构建时就报错；动态的页面会在请求时报错）：

| 传的值 | 错误信息（节选） |
| --- | --- |
| `() => 1`，或者一个类本身 | `Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with "use server".` |
| `new Money(5)`（自己定义的类）、`Object.create(null)`、`/ab+c/` | `Only plain objects, and a few built-ins, can be passed to Client Components from Server Components. Classes or null prototypes are not supported.` |
| `Symbol('local')` | `Only global symbols received from Symbol.for(...) can be passed to Client Components.` |
| `[1, () => 1]`、`new Map([['k', () => 1]])` | 函数的那一条，并且指出了它在数组或 `Map` 中的位置 |

还有两个构建成功、但值变了样的：

- `new URL('https://example.com/a')`：浏览器中收到的是**字符串** `'https://example.com/a'`，不再是 `URL`；
- `new Error('boom')`：收到的是一个 `Error`，但生产构建中它的信息被换成了一段说明（“为了避免泄漏敏感的细节，生产构建中省略了具体的信息”）。

所以最稳妥的做法是：**传给客户端组件的 props 只用普通的数据**。需要 `URL` 时传 `href`，需要类的方法时传数据、在客户端组件中再创建对象。事件处理函数写在客户端组件里面；服务端组件需要“被调用”的函数是 Server Function（h05）。

TypeScript 的类型可以挡住一部分：

:::playground{#props-types expect="2322@main.ts:30, 2322@main.ts:31, 2322@main.ts:33"}
```ts file=main.ts
type Serializable =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | readonly Serializable[]
  | { readonly [key: string]: Serializable };

function clientProps<P extends Record<string, Serializable>>(props: P): P {
  return props;
}

class Money {
  readonly cents: number;
  constructor(cents: number) {
    this.cents = cents;
  }
}
type Price = { cents: number };
interface Line {
  sku: string;
}

const price: Price = new Money(990);
const line: Line = { sku: 'a1' };

clientProps({ title: '订单', createdAt: new Date(), tags: ['a'] });
clientProps({ onSelect: () => {} });
clientProps({ price: new Money(990) });
clientProps({ price });
clientProps({ line });
console.log(Object.getPrototypeOf(price) === Money.prototype);
```
- 第 30 行：函数不是 `Serializable`，类型错误；
- 第 31 行：`Money` 是一个类，它的类型没有索引签名，不能赋给 `{ readonly [key: string]: Serializable }`；
- 第 32 行**没有**类型错误：`price` 的类型是 `Price`（一个类型别名），类型只描述形状。但第 34 行打印 `true`：运行时它仍然是 `Money` 的实例，Next.js 会拒绝它；
- 第 33 行：`Line` 是一个接口，接口没有隐式的索引签名，即使它的内容完全可以传过去，也报错了。

类型能挡住函数，挡不住原型。练习一在运行时做这个检查。
:::

::exercise{#check-props}

## 把服务端的内容放进客户端组件

客户端组件不能导入服务端组件，但可以**接收**服务端组件渲染好的结果：渲染好的 React 元素是可以序列化的数据。最常见的是 `children`：

```tsx
// app/ui/modal.tsx
'use client';
import { useState, type ReactNode } from 'react';

export function Modal({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div role="dialog">
      <button onClick={() => setOpen(false)}>关闭</button>
      {children}
    </div>
  );
}
```

```tsx
// app/page.tsx（服务端组件）
import { Modal } from './ui/modal';
import { Cart } from './ui/cart'; // 服务端组件，在里面读取购物车的数据

export default function Page() {
  return (
    <Modal>
      <Cart />
    </Modal>
  );
}
```

`Cart` 写在 `Page` 中，所以它在服务器上渲染；`Modal` 只是收到了它的结果，放在自己的界面中。`Modal` 的代码中没有 `import { Cart }`，`Cart` 的代码也就不会进入浏览器。

同样的道理：

- **Context**：服务端组件不能使用 React 的 context。把 Provider 写成一个接收 `children` 的客户端组件，在布局中用它包住 `children`，并且包得尽量深（只包需要的部分）；
- **没有 `'use client'` 的第三方组件**：如果它使用了 `useState` 等，直接在服务端组件中使用会报错。写一个文件包装它：开头是 `'use client'`，然后 `import { Carousel } from 'acme-carousel'` 和 `export default Carousel`，在服务端组件中使用这个文件导出的组件；
- **让客户端组件尽量小**：一个布局中只有搜索框需要交互时，只把搜索框写成客户端组件，布局本身保持为服务端组件。

## 防止服务端的代码进入浏览器

一个读取密钥的函数可能被不小心导入到客户端组件中。Next.js 中，只有以 `NEXT_PUBLIC_` 开头的环境变量才会出现在浏览器的代码中（h08），所以密钥本身不会泄漏，但代码会在浏览器中“正常地”运行，得到一个空的值，这样的错误很难发现。

在只能在服务器上运行的模块中加一行 `import 'server-only'`，把它变成构建错误。实测项目中 `lib/secret.ts` 导入了 `server-only`，再让一个客户端组件导入它：

```text
./lib/secret.ts:1:1
Error: 'server-only' cannot be imported from a Client Component module
It should only be used from a Server Component.
Import traces:
  Client Component Browser:
    ./lib/secret.ts [Client Component Browser]
    ./app/h03err/_ui/probe.tsx [Client Component Browser]
    ./app/h03err/_ui/probe.tsx [Server Component]
    ./app/h03err/page.tsx [Server Component]
```

“Import trace” 从下往上读：页面（服务端组件）导入了 `probe.tsx`，它是一个客户端组件，在客户端中又导入了 `lib/secret.ts`。真正要改的往往是这条路径中间的某个导入，而不是报错的那个文件。在 Next.js 中不需要单独安装 `server-only`（`next` 自己带了一份）；对应的 `client-only` 用来标记只能在浏览器中运行的模块。

练习二模拟构建的这个过程：把模块分到两张模块图中，报告越过边界的错误和它们的导入路径。

## 编程挑战

::exercise{#module-boundary}

::quiz

## 常见错误

- **在每个文件中都写 `'use client'`**：只需要写在客户端的入口。写得太多，本来可以留在服务器上的组件也被发给了浏览器。
- **以为客户端组件只在浏览器中运行**：它也在服务器上渲染首屏的 HTML，在渲染时直接访问 `window` 会在服务器上出错，这类代码放在 `useEffect` 或事件处理函数中。
- **把函数或者类的实例作为 props 传给客户端组件**：构建或者渲染时报错；`URL` 会悄悄地变成字符串。
- **在客户端组件中导入读取数据库或密钥的模块**：用 `server-only` 让它变成构建错误。
- **用 `typeof` 或 `constructor` 判断普通对象**：要看原型（`Object.getPrototypeOf`）。
- **在 create-next-app 生成的项目中写 `10n`**：它的 `tsconfig.json` 中 `target` 是 `ES2017`，实测类型检查报 TS2737（BigInt 字面量需要 ES2020）；用 `BigInt(10)`，或者调整 `target`。

## 下一步

h04 讲在服务端组件中读取数据：`async` 组件、`<Suspense>` 与流式渲染，以及 `'use cache'` 决定哪些结果可以缓存。
