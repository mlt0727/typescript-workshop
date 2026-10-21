---
version: 1
mode: ts
estimatedMinutes: 55
review: ai-draft
problem: 在 g14 中，组件先渲染出来，再在 effect 中请求数据，数据到达之后再渲染一次。服务端组件不需要这样绕：它本身就是一个 async 函数，直接 await 数据库或者接口，渲染出来的就是有数据的 HTML。但数据读取一旦搬到服务器上，就有了新的问题：几个组件都需要同一份数据时会不会查好几次，前后依赖的请求会不会排成一串，哪些结果可以在请求之间共用、共用多久，数据改了之后怎样让缓存失效。这一课在实测的 Next.js 16.4.2 项目中回答这些问题：React.cache 在一个请求中去重，'use cache' 在请求之间缓存，cacheLife 决定缓存多久，cacheTag 与 revalidateTag 让缓存按需失效。
objectives:
  - 在服务端组件中用 async/await 读取数据，用 Promise.all 让互不依赖的请求并行
  - 用 React.cache 让同一个请求中的重复读取只执行一次，知道它不在请求之间共享
  - 用 'use cache' 与 cacheLife 缓存结果，说出 stale、revalidate、expire 各自的含义
  - 用 cacheTag 标记缓存，说出 revalidateTag 与 updateTag 的区别，以及哪些数据不应该缓存
references:
  - title: Fetching Data — Next.js（16.4，随 next 包附带的文档）
    url: https://nextjs.org/docs/app/getting-started/fetching-data
    checked: 2026-10-21
    note: 以 Next.js 16.4.2（React 19.3.0）为准；课中的实测项目由 create-next-app 16.4.2 生成
  - title: use cache — Next.js
    url: https://nextjs.org/docs/app/api-reference/directives/use-cache
    checked: 2026-10-21
  - title: cacheLife — Next.js
    url: https://nextjs.org/docs/app/api-reference/functions/cacheLife
    checked: 2026-10-21
  - title: Revalidating（cacheTag、revalidateTag、updateTag）— Next.js
    url: https://nextjs.org/docs/app/getting-started/revalidating
    checked: 2026-10-21
  - title: cache — React
    url: https://react.dev/reference/react/cache
    checked: 2026-10-21
---

## 要做什么

h03 说服务端组件可以直接读数据库。这一课把“读数据”展开：

1. 在服务端组件中读数据，以及怎样避免请求排成一串；
2. 同一个请求中，几个组件需要同一份数据：`React.cache`；
3. 请求之间共用结果：`'use cache'` 和 `cacheLife`；
4. 数据改了：`cacheTag`、`revalidateTag`、`updateTag`。

下面的结果都来自 2026-10-21 在本机运行的 Next.js 16.4.2 项目（`next build` 和 `next start`）。两个练习实现其中可以移植的两部分：请求内的去重，带标签的缓存。

## 在服务端组件中读数据

服务端组件可以是 `async` 函数，直接 `await`：

```tsx
// app/posts/page.tsx
import { db } from '@/lib/db';

export default async function PostsPage() {
  const posts = await db.post.findMany();
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

没有 `useEffect`，没有“加载中”的状态，也没有一个给浏览器调用的接口：查询在服务器上运行，浏览器收到的就是列表。几点要注意：

- **读取默认不缓存**：没有缓存的 `fetch` 或数据库查询每个请求都运行一次。开启 Cache Components 时，在 `<Suspense>` 之外直接等待这样的数据会让构建失败（h02），要么放进 `<Suspense>` 流式送出，要么用 `'use cache'` 缓存它（下面讲）；
- **仍然要检查权限**：服务端组件可以读任何数据，读之前要确认当前的用户有权看它（h09）；
- **只把需要的字段传给客户端组件**：props 会被序列化发给浏览器（h03），把整行数据库记录传过去，可能把不该看到的字段也送了出去。

## 顺序与并行

一个组件中连着写两个 `await`，第二个请求要等第一个完成才开始：

```tsx
const artist = await getArtist(username);
const albums = await getAlbums(username); // 等 getArtist 完成之后才开始
```

两个请求互不依赖时，先**发起**，再一起等：

```tsx
const [artist, albums] = await Promise.all([getArtist(username), getAlbums(username)]);
```

:::playground{#waterfall}
```ts file=main.ts
const wait = (ms: number, label: string) => new Promise<string>((resolve) => setTimeout(() => resolve(label), ms));
const round = (ms: number) => Math.round(ms / 100) * 100;

let start = Date.now();
await wait(200, '艺人');
await wait(200, '专辑');
console.log('一个接一个：约', round(Date.now() - start), 'ms');

start = Date.now();
await Promise.all([wait(200, '艺人'), wait(200, '专辑')]);
console.log('一起等：约', round(Date.now() - start), 'ms');

start = Date.now();
const results = await Promise.allSettled([wait(100, '艺人'), Promise.reject(new Error('专辑服务不可用'))]);
console.log(results.map((r) => r.status), '约', round(Date.now() - start), 'ms');
```
- 第 5、6 行：第二个请求等第一个完成之后才开始，一共约 400 ms；
- 第 10 行：两个 Promise 在调用 `Promise.all` 之前就都已经开始了，一共约 200 ms；
- 第 14 行：`Promise.all` 只要有一个失败就整个失败；需要“各自成败”时用 `Promise.allSettled`（e04）。
:::

页面和它所在的各层布局本身是并行渲染的，每一层都会尽早开始自己的请求。真正有依赖的请求（先要知道艺人的 id 才能查他的歌单），把依赖的部分放进 `<Suspense>`：先显示已经有的内容，剩下的流式送出。

## 同一个请求中去重：React.cache

布局要显示当前用户的名字，页面要用用户的 id 查订单，侧栏要显示用户的头像。每个组件各自调用 `getUser(id)` 是最自然的写法，但这样一个请求会查三次数据库。`React.cache` 包装一个函数，让**同一个请求中**用同样的参数调用它时只执行一次：

```ts
// app/h04/_lib/data.ts
import { cache } from 'react';

export async function loadUser(id: string) {
  console.log(`[h04] loadUser(${id})`);
  // …查询数据库
}

export const getUser = cache(loadUser);
```

实测项目中的一个页面在 `<Suspense>` 中渲染了三个组件，分别读取用户 `1`、`1`、`2`。用 `getUser` 时，每个请求的服务器日志：

```text
[h04] request dedupe
[h04] loadUser(1) #1
[h04] loadUser(2) #2
[h04] request dedupe
[h04] loadUser(1) #3
[h04] loadUser(2) #4
```

每个请求中用户 `1` 只查了一次；第二个请求又查了一次：`React.cache` 的缓存**只属于一个请求**，请求之间不共享。同样的页面改成直接调用 `loadUser`，一个请求查了三次（`#5`、`#6`、`#7`）。

`fetch` 不需要这样包装：同一次渲染中，相同的 `fetch` 请求会自动去重。数据库查询、SDK 调用这些不是 `fetch` 的读取，才需要 `React.cache`。

::exercise{#request-memo}

## 请求之间缓存：'use cache'

`React.cache` 只在一个请求中有效。商品目录、文章列表这类“所有人看到的都一样、改得也不频繁”的数据，应该在请求之间共用：这是 `'use cache'` 的作用。它写在一个 `async` 函数（或者组件、整个文件）的开头：

```ts
import { cacheLife, cacheTag } from 'next/cache';

export async function getStamp() {
  'use cache';
  cacheLife({ stale: 30, revalidate: 5, expire: 3600 });
  cacheTag('h04-stamp');
  console.log('[h04] getStamp ran');
  return new Date().toISOString();
}
```

缓存的**键**由构建、函数本身和它的参数（以及它从外层捕获的变量）共同决定，所以参数和返回值都必须能序列化，规则和 h03 中传给客户端组件的 props 类似（参数还更严格一些）。`cacheLife` 决定缓存多久，三个时间的含义：

| 属性 | 含义 |
| --- | --- |
| `stale` | 浏览器中的路由器可以直接使用这份数据、不问服务器的时间 |
| `revalidate` | 过了这个时间，下一个请求先拿到旧的结果，服务器在后台重新生成 |
| `expire` | 过了这个时间还没有请求来刷新它，下一个请求必须等新的结果 |

也可以用预设的名字，例如 `cacheLife('hours')`（`stale` 5 分钟，`revalidate` 1 小时，`expire` 1 天）；不调用 `cacheLife` 时是 `'default'`（5 分钟、15 分钟、永不过期）。`revalidate` 为 0、`expire` 不到 5 分钟或者使用 `'seconds'` 的缓存太短，不会被放进构建时的静态外壳，而是变成请求时才填的“洞”。

实测项目中一个页面只显示 `await getStamp()` 的结果。构建时的路由表多了两列（h01 的练习遇到这种表头会报错）：

```text
Route (app)                  Revalidate  Expire
├ ○ /h04/stamp                       5s      1h
```

这个页面仍然是 ○：它在构建时生成，响应头中有 `Cache-Control: s-maxage=5, stale-while-revalidate=3595`（5 秒内是新的，之后 3595 秒内可以先用旧的，加起来正好是 `expire` 的 1 小时）。连续请求它，记录页面中的时间和响应头 `x-nextjs-cache`：

```text
04:32:37  2026-10-21T08:32:17.534Z  STALE   ← 距离上次生成已经超过 5 秒：先返回旧的，后台重新生成
04:32:37  2026-10-21T08:32:37.090Z  HIT     ← 紧接着的请求：已经是新的
04:32:43  2026-10-21T08:32:37.090Z  STALE   ← 又过了 6 秒
04:32:43  2026-10-21T08:32:43.533Z  HIT
04:32:44  2026-10-21T08:32:43.533Z  HIT     ← 5 秒之内：直接返回
```

这就是 stale-while-revalidate：过了 `revalidate`，**触发**重新生成的那个请求拿到的仍然是旧的内容，没有人需要等。

## 按需失效：cacheTag 与 revalidateTag

时间到了才刷新，不适合“编辑刚发布了一篇文章”这样的场景。`cacheTag('h04-stamp')` 给缓存的结果打上标签，数据改变时调用 `revalidateTag('h04-stamp', 'max')`，所有带这个标签的缓存都变旧。实测项目中一个 Route Handler 调用了它：

```text
04:32:44  2026-10-21T08:32:43.533Z  HIT
POST /api/h04/revalidate → {"ok":true}
04:32:45  2026-10-21T08:32:43.533Z  STALE   ← 还没到 5 秒，但已经被标记为变旧：先返回旧的
04:32:46  2026-10-21T08:32:45.166Z  HIT     ← 新的
```

和时间到了一样，失效之后的第一个请求仍然拿到旧的内容。这对文章列表没问题，但对“用户刚刚修改了自己的资料，页面却还显示旧的”就不行了。这时用 `updateTag(tag)`：它让缓存**立刻**过期，下一个请求等新的结果。`updateTag` 只能在 Server Function 中调用（h05），`revalidateTag` 在 Server Function 和 Route Handler 中都可以。还有一个 `revalidatePath('/profile')` 按地址失效，官方文档建议优先用标签，它更精确。

| | `revalidateTag(tag, 'max')` | `updateTag(tag)` |
| --- | --- | --- |
| 之后的第一个请求 | 先拿到旧的，后台重新生成 | 等新的结果 |
| 适合 | 后台的系统改了数据（CMS 的 webhook） | 用户刚刚改了自己的数据（读到自己的写入） |
| 在哪里调用 | Server Function、Route Handler | 只在 Server Function |

## 什么不应该缓存

- **因人而异的数据**：当前用户的购物车不能放进所有人共用的缓存。`'use cache'` 的函数（以及它调用的函数）中不能读取 `cookies()`、`headers()`、`searchParams`，否则报错；在缓存的函数外面读出需要的值，作为参数传进去，它就成了键的一部分，不同的值有各自的缓存。只有极少数无法这样改的情况才用 `'use cache: private'`；
- **必须准确的数据**：库存、余额这类数据，缓存中的旧值可能导致错误的决定，宁可每次都读；
- **以为缓存会一直留着**：默认的缓存保存在服务器的内存中。在无服务器的环境中，每个请求可能落在不同的实例上，运行时的缓存条目通常留不住（构建时生成的部分不受影响），需要时用 `'use cache: remote'` 交给平台提供的缓存。重新部署之后所有的缓存都失效，因为键中包含了构建。

## 编程挑战

在浏览器中实现一个带 `revalidate`、`expire` 和标签的缓存，包括“不重复填充”和“后台刷新失败时保留旧值”这些真实的缓存都要处理的细节。

::exercise{#tagged-cache}

::quiz

## 常见错误

- **连着写互不依赖的 `await`**：请求排成一串。先发起，再 `Promise.all`。
- **以为 `React.cache` 在请求之间共享**：它只属于一个请求。请求之间的缓存用 `'use cache'`。
- **用每次都新建的对象调用被缓存的函数**：`getPosts({ status: 'open' })` 每次的参数都是一个新对象，`React.cache` 永远命中不了。传基本类型的参数。
- **以为过了 `revalidate` 就会立刻看到新的内容**：触发刷新的那个请求拿到的仍然是旧的。
- **用户修改了自己的数据之后用 `revalidateTag`**：他会先看到旧的内容。用 `updateTag`。
- **把读取了 cookie 的数据放进共用的缓存**：一个用户的数据可能被另一个用户看到。

## 下一步

h05 讲数据写入：Server Function 怎样接收表单，怎样在服务器上校验输入，写入之后怎样用 `updateTag` 让页面显示新的数据。
