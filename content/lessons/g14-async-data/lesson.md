---
version: 1
mode: react
estimatedMinutes: 55
review: ai-draft
problem: e07 用可辨识联合描述了一次请求的几种状态，e08 处理了取消与竞态，g11 在 Effect 中请求过数据。真实的 React 应用里，几乎每个页面都要加载数据：加载时要有提示，失败时能重试，参数变了要取消旧的请求，数据格式不对要报错，还要决定数据在哪里加载：在组件中，还是在路由上。这一课先把这些整理成一个可复用的数据加载 Hook，再用 React Router 的 loader 在导航时加载数据，用错误边界显示“找不到”和意外的错误，最后介绍 React 19 的 use 与 Suspense，以及真实项目中常用的数据请求库。
objectives:
  - 用可辨识联合描述远程数据的状态；在渲染时根据“结果属于哪一次请求”推出加载状态，不在 Effect 中同步地 setState
  - 写出可复用的数据加载 Hook：AbortController 取消过时的请求、验证数据、重试
  - "用 React Router 的 loader 加载路由数据：request.signal、throw data(…, { status: 404 })、ErrorBoundary 与 useRouteError、isRouteErrorResponse、useNavigation、HydrateFallback"
  - 了解 use(promise) 与 Suspense 的前提（Promise 必须被缓存），知道数据请求库解决了哪些问题
references:
  - title: Synchronizing with Effects — Fetching data — React
    url: https://react.dev/learn/synchronizing-with-effects#fetching-data
    checked: 2026-10-20
  - title: use — React
    url: https://react.dev/reference/react/use
    checked: 2026-10-20
  - title: "<Suspense> — React"
    url: https://react.dev/reference/react/Suspense
    checked: 2026-10-20
  - title: Data Loading (Data Mode) — React Router
    url: https://reactrouter.com/start/data/data-loading
    checked: 2026-10-20
  - title: Error Boundaries — React Router
    url: https://reactrouter.com/how-to/error-boundary
    checked: 2026-10-20
  - title: Pending UI — React Router
    url: https://reactrouter.com/start/framework/pending-ui
    checked: 2026-10-20
---

## 在组件中加载：一个可复用的 Hook

每个需要数据的组件都要处理同样的几件事：发请求、显示加载中、处理失败、验证数据、参数变化时取消旧的请求。把它们写进一个 Hook，组件只需要关心“拿到了什么”。

状态用 e07 的可辨识联合描述。和 g11 的城市搜索一样，**加载中不是一个单独设置的 state**：Hook 记住“最近一次的结果属于哪个地址、第几次尝试”，结果不属于当前的请求，就是“加载中”。这样 Effect 只在请求结束时设置 state，不需要一开始先同步地设置“加载中”（g12 讲过这会多一次渲染）。

:::playground{#use-json fixtures=api}
```tsx file=App.tsx
import { useEffect, useEffectEvent, useState } from 'react';

type RemoteData<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'success'; data: T };
type Outcome<T> = Exclude<RemoteData<T>, { status: 'loading' }>;

function useJson<T>(url: string, parse: (value: unknown) => T): { state: RemoteData<T>; reload: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ url: string; attempt: number; outcome: Outcome<T> } | null>(null);
  const parseLatest = useEffectEvent(parse);

  useEffect(() => {
    const controller = new AbortController();
    const settle = (outcome: Outcome<T>) => setResult({ url, attempt, outcome });
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`服务器返回了 ${response.status}`);
        settle({ status: 'success', data: parseLatest(await response.json()) });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        settle({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      });
    return () => controller.abort();
  }, [url, attempt]);

  const current = result !== null && result.url === url && result.attempt === attempt;
  return { state: current ? result.outcome : { status: 'loading' }, reload: () => setAttempt((n) => n + 1) };
}

type User = { id: number; name: string };

function parseUsers(value: unknown): User[] {
  if (!Array.isArray(value)) throw new Error('数据格式不正确');
  return value.map((item: unknown) => {
    if (typeof item === 'object' && item !== null && 'id' in item && 'name' in item && typeof item.id === 'number' && typeof item.name === 'string') {
      return { id: item.id, name: item.name };
    }
    throw new Error('数据格式不正确');
  });
}

function UserList({ url }: { url: string }) {
  const { state, reload } = useJson(url, parseUsers);
  return (
    <>
      <p role="status">{state.status === 'loading' ? '正在加载…' : ''}</p>
      {state.status === 'error' && (
        <div role="alert">
          加载失败：{state.message}{' '}
          <button type="button" onClick={reload}>
            重试
          </button>
        </div>
      )}
      {state.status === 'success' &&
        (state.data.length === 0 ? (
          <p>还没有用户</p>
        ) : (
          <ul>
            {state.data.map((user) => (
              <li key={user.id}>{user.name}</li>
            ))}
          </ul>
        ))}
    </>
  );
}

const SOURCES = [
  { label: '正常', url: '/api/users' },
  { label: '空列表', url: '/api/users/empty' },
  { label: '服务器出错', url: '/api/users/broken' },
  { label: '格式不对', url: '/api/users/bad-shape' },
];

export function App() {
  const [url, setUrl] = useState('/api/users');
  return (
    <>
      <p>
        {SOURCES.map((s) => (
          <button key={s.url} type="button" aria-pressed={s.url === url} onClick={() => setUrl(s.url)}>
            {s.label}
          </button>
        ))}
      </p>
      <UserList url={url} />
    </>
  );
}
```
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<App />);
```
- 第 3 行：三种情况用一个可辨识联合表示，`state.status === 'success'` 之后才能读 `state.data`，“既在加载又有错误”这种状态根本写不出来（b09、e07）。第 4 行的 `Exclude` 从中去掉“加载中”，得到“一次请求的结果”。
- 第 26–27 行：结果属于当前的地址和第几次尝试，才显示它，否则就是“加载中”。点“重试”只是让 `attempt` 加 1，Effect 因为依赖变化重新执行，界面自然回到“加载中”。
- 第 9 行的 `useEffectEvent`（g11）：调用方通常会传入一个内联的 `parse` 函数，它每次渲染都是新的。把它写进依赖数组，每次渲染都会重新请求；用 `useEffectEvent` 包起来，Effect 中调用的总是最新的 `parse`，它本身又不是依赖。
- 快速切换几个按钮：清理函数中止了过时的请求（e08），被中止的请求不算失败（第 20 行）。
- 状态区 `role="status"` 一直在页面上，只是内容在变，读屏软件才会读出“正在加载…”；错误用 `role="alert"`，插入时会立刻被读出（e07）。
:::

## 数据随路由加载：loader

在组件中加载数据，页面总是先显示出来、再开始请求；如果子组件也要加载数据，它要等父组件的数据到了、渲染出来之后才开始，形成一个接一个的“瀑布”。React Router 的 Data 模式提供了另一种方式：在路由上写一个 **loader**，导航一开始就调用它（嵌套的几个路由的 loader 同时开始），数据到了再显示新的页面，组件用 `useLoaderData()` 读取。

:::playground{#route-loader fixtures=books}
```tsx file=App.tsx
import { data, isRouteErrorResponse, Link, Outlet, useLoaderData, useNavigation, useRouteError, type LoaderFunctionArgs, type RouteObject } from 'react-router';

type Book = { id: number; title: string; author: string };

function parseBook(value: unknown): Book {
  if (typeof value === 'object' && value !== null && 'id' in value && 'title' in value && 'author' in value) {
    const { id, title, author } = value;
    if (typeof id === 'number' && typeof title === 'string' && typeof author === 'string') return { id, title, author };
  }
  throw new Error('数据格式不正确');
}

async function bookLoader({ params, request }: LoaderFunctionArgs): Promise<Book> {
  const response = await fetch(`/api/books/${params.bookId ?? ''}`, { signal: request.signal });
  if (response.status === 404) throw data('没有这本书', { status: 404 });
  if (!response.ok) throw new Error(`服务器返回了 ${response.status}`);
  return parseBook(await response.json());
}

function Layout() {
  const navigation = useNavigation();
  return (
    <>
      <nav aria-label="书">
        <Link to="/books/1">第 1 本</Link> · <Link to="/books/2">第 2 本（较慢）</Link> · <Link to="/books/99">不存在的书</Link> ·{' '}
        <Link to="/books/500">服务器出错</Link>
      </nav>
      <p role="status">{navigation.state === 'loading' ? '正在加载…' : ''}</p>
      <Outlet />
    </>
  );
}

function BookPage() {
  const book = useLoaderData<typeof bookLoader>();
  return (
    <h1>
      《{book.title}》 {book.author}
    </h1>
  );
}

function BookError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <h1>没有这本书</h1>;
  return <p role="alert">加载失败：{error instanceof Error ? error.message : '未知错误'}</p>;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, element: <p>点上面的链接</p> },
      { path: 'books/:bookId', loader: bookLoader, Component: BookPage, ErrorBoundary: BookError },
    ],
  },
];
```
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { createHashRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from './App';

const router = createHashRouter(routes);

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<RouterProvider router={router} />);
```
- 点“第 2 本”：页面先停在原来的内容上，状态区显示“正在加载…”（`useNavigation()` 告诉我们正在导航），数据到了才换成新的页面。这是 loader 的默认行为：新页面出现时，数据已经准备好了，组件中不需要处理“加载中”。
- `bookLoader` 是一个普通的 async 函数，不是 Hook：它在组件之外，导航开始时就被调用。`request.signal` 是这次导航的中止信号：“第 2 本”还在加载时点了别的链接，React Router 会中止这次请求（e08）。
- “不存在的书”：loader 中 `throw data('没有这本书', { status: 404 })`，最近的 `ErrorBoundary` 代替这个路由的组件显示出来，`isRouteErrorResponse(error)` 判断出这是一个“响应”，可以读 `status`。导航和状态区还在：错误只替换了出错的那一层路由。
- “服务器出错”：loader 抛出的是一个普通的 `Error`，同样由 `ErrorBoundary` 显示。组件渲染时抛出的错误也会被它捕获。
- 第 35 行的 `useLoaderData<typeof bookLoader>()`：类型参数写的是 loader 本身，`book` 的类型由 loader 的返回值推出来（`Book`）。在 loader 中验证数据，组件拿到的就是可以放心使用的类型。
:::

两个补充：

- **第一次加载**：如果用户直接打开 `/books/1`，页面刚启动时还没有任何数据可以显示。给路由加一个 `HydrateFallback` 组件（例如“正在加载…”），React Router 在第一次的 loader 完成之前显示它。
- **组件里加载还是路由上加载**：路由的数据（打开这个页面就需要的东西）适合放在 loader 中，它和导航一起开始、一起取消，错误由路由的错误边界统一处理；页面上局部的、按需的数据（例如展开一个面板才需要的详情），在组件中用前面的 Hook 加载更合适。

测试 loader 和 g13 一样用 `createMemoryRouter`。要注意 loader 是异步的：从一个带 loader 的地址开始渲染时，先显示的是 `HydrateFallback`，断言数据要用 `findBy…`。

## use 与 Suspense

React 19 的 `use` 可以在渲染时读取一个 Promise：Promise 还没有完成时，组件“挂起”，最近的 `<Suspense fallback={…}>` 显示后备内容；Promise 被拒绝时，错误交给最近的错误边界（`use` 不能放在 `try/catch` 中）。

```tsx
function Albums({ albumsPromise }: { albumsPromise: Promise<Album[]> }) {
  const albums = use(albumsPromise);
  return <ul>{albums.map((a) => <li key={a.id}>{a.title}</li>)}</ul>;
}

// 使用：<Suspense fallback={<p>正在加载…</p>}><Albums albumsPromise={albumsPromise} /></Suspense>
```

关键的前提是：**Promise 必须被缓存**，在多次渲染之间是同一个对象。直接在渲染中写 `use(fetch(…))`，每次渲染都会创建一个新的 Promise，组件就会一直挂起、永远显示后备内容。Promise 应该在渲染之外创建：在事件处理函数中、在路由的 loader 中、在服务端组件中（H 阶段），或者由一个负责缓存的框架、库来管理。Suspense 也看不到在 Effect 中发起的请求：它只对 `use` 读取的 Promise（以及 `lazy` 加载的组件等）起作用。

## 真实项目中的数据请求库

前面的 Hook 展示了数据加载的核心，但真实的应用还会遇到更多问题：同一份数据被好几个组件请求，要合并成一次；离开页面再回来，先显示缓存的数据、在后台刷新；失败时自动重试；修改数据之后，让相关的列表重新加载。TanStack Query、SWR 这类库专门解决这些问题，React Router 的 loader 也处理了一部分。在项目中直接使用它们，比自己从头写更可靠；理解了本课的原理，用起这些库来也就知道它们在做什么。

::exercise{#use-json-hook}

## 编程挑战

::exercise{#book-routes}

::quiz

## 常见错误

- **用几个布尔值描述请求**（`loading`、`error`、`data` 各存一份）：会出现“既在加载又有错误”的状态。用可辨识联合。
- **在 Effect 一开始同步地设置“加载中”**：多一次渲染。根据“结果属于哪一次请求”在渲染时推出来。
- **把内联的 `parse` 或选项对象写进依赖数组**：每次渲染都重新请求，甚至无限循环。用 `useEffectEvent`，或者把它们定义在组件之外。
- **被中止的请求当成失败**：切换参数时会闪现错误提示。`catch` 中先检查 `signal.aborted`。
- **在 loader 中忘了把 `request.signal` 传给 `fetch`**：过时的导航仍在请求。
- **在渲染中创建 Promise 再交给 `use`**：组件永远挂起。Promise 必须被缓存。

## 下一步

下一课综合前面的内容，讲组件的可访问性与组件测试：用角色和名称查询元素、测试键盘操作，以及怎样写出对重构友好的测试。
