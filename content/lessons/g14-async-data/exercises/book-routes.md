---
kind: challenge
title: 用 loader 加载的书单
fixtures: library
timeoutMs: 20000
---
`routes.tsx` 中的书单是写死的。改用 loader 从模拟的服务器加载数据：

1. `/books` 的 loader 请求 `/api/books`，得到书的数组；`/books/:bookId` 的 loader 请求 `/api/books/编号`。两个请求都要传入 `request.signal`，响应的数据都要验证（不符合 `Book` 的形状时抛出 `Error('数据格式不正确')`）；
2. 编号必须只由数字组成、不以 0 开头，否则不发请求，直接当作“找不到”；服务器返回 404 时也是“找不到”：`throw data('没有这本书', { status: 404 })`；其他不是 2xx 的状态码抛出 `Error('服务器返回了 500')` 这样的错误；
3. 两个路由都有错误边界，显示在布局的 `<main>` 中（导航不消失）：“找不到”时显示 `<h1>没有这本书</h1>`，其他错误显示 `<div role="alert">加载失败：错误的消息</div>`；
4. 布局中有一个状态区 `<p role="status">`：正在导航（等待 loader）时显示“正在加载…”，否则为空；
5. 直接打开一个需要加载数据的地址时，第一次的数据到达之前显示“正在加载…”（用根路由的 `HydrateFallback`）。

页面的样子（标题、列表、“作者：…”、“返回书单”）保持起始代码中的写法。

:::files{role=starter}
```tsx file=routes.tsx
import { Link, Outlet, useParams, type RouteObject } from 'react-router';

export type Book = { id: number; title: string; author: string };

// TODO：现在页面上的数据是写死的。用 loader 从 /api/books 和 /api/books/:bookId 加载数据，
//       并处理加载中、找不到、加载失败
const BOOKS: Book[] = [{ id: 1, title: '三体', author: '刘慈欣' }];

function Layout() {
  return (
    <>
      <nav aria-label="主导航">
        <Link to="/">首页</Link> <Link to="/books">书单</Link>
      </nav>
      <main>
        <Outlet />
      </main>
    </>
  );
}

function BookList() {
  return (
    <>
      <h1>书单</h1>
      <ul>
        {BOOKS.map((book) => (
          <li key={book.id}>
            <Link to={`/books/${book.id}`}>{book.title}</Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function BookPage() {
  const { bookId } = useParams();
  const book = BOOKS.find((b) => String(b.id) === bookId);
  if (book === undefined) return <h1>没有这本书</h1>;
  return (
    <>
      <h1>《{book.title}》</h1>
      <p>作者：{book.author}</p>
      <Link to="/books">返回书单</Link>
    </>
  );
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, element: <h1>欢迎</h1> },
      { path: 'books', Component: BookList },
      { path: 'books/:bookId', Component: BookPage },
    ],
  },
];
```
:::

:::files{role=support}
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { createHashRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from './routes';

// 预览运行在沙箱中，只能使用 # 之后的地址；部署到服务器上时用 createBrowserRouter
const router = createHashRouter(routes);

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<RouterProvider router={router} />);
```
:::

:::files{role=solution}
```tsx file=routes.tsx
import { data, isRouteErrorResponse, Link, Outlet, useLoaderData, useNavigation, useRouteError, type LoaderFunctionArgs, type RouteObject } from 'react-router';

export type Book = { id: number; title: string; author: string };

function parseBook(value: unknown): Book {
  if (typeof value === 'object' && value !== null && 'id' in value && 'title' in value && 'author' in value) {
    const { id, title, author } = value;
    if (typeof id === 'number' && typeof title === 'string' && typeof author === 'string') return { id, title, author };
  }
  throw new Error('数据格式不正确');
}

function parseBooks(value: unknown): Book[] {
  if (!Array.isArray(value)) throw new Error('数据格式不正确');
  return value.map((item: unknown) => parseBook(item));
}

async function booksLoader({ request }: LoaderFunctionArgs): Promise<Book[]> {
  const response = await fetch('/api/books', { signal: request.signal });
  if (!response.ok) throw new Error(`服务器返回了 ${response.status}`);
  return parseBooks(await response.json());
}

async function bookLoader({ params, request }: LoaderFunctionArgs): Promise<Book> {
  const bookId = params.bookId ?? '';
  if (!/^[1-9]\d*$/.test(bookId)) throw data('没有这本书', { status: 404 });
  const response = await fetch(`/api/books/${bookId}`, { signal: request.signal });
  if (response.status === 404) throw data('没有这本书', { status: 404 });
  if (!response.ok) throw new Error(`服务器返回了 ${response.status}`);
  return parseBook(await response.json());
}

function Layout() {
  const navigation = useNavigation();
  return (
    <>
      <nav aria-label="主导航">
        <Link to="/">首页</Link> <Link to="/books">书单</Link>
      </nav>
      <p role="status">{navigation.state === 'loading' ? '正在加载…' : ''}</p>
      <main>
        <Outlet />
      </main>
    </>
  );
}

function Loading() {
  return <p role="status">正在加载…</p>;
}

function BookList() {
  const books = useLoaderData<typeof booksLoader>();
  return (
    <>
      <h1>书单</h1>
      <ul>
        {books.map((book) => (
          <li key={book.id}>
            <Link to={`/books/${book.id}`}>{book.title}</Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function BookPage() {
  const book = useLoaderData<typeof bookLoader>();
  return (
    <>
      <h1>《{book.title}》</h1>
      <p>作者：{book.author}</p>
      <Link to="/books">返回书单</Link>
    </>
  );
}

function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <h1>没有这本书</h1>;
  return <div role="alert">加载失败：{error instanceof Error ? error.message : '未知错误'}</div>;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    HydrateFallback: Loading,
    children: [
      { index: true, element: <h1>欢迎</h1> },
      { path: 'books', loader: booksLoader, Component: BookList, ErrorBoundary: RouteError },
      { path: 'books/:bookId', loader: bookLoader, Component: BookPage, ErrorBoundary: RouteError },
    ],
  },
];
```
:::

:::files{role=tests}
```tsx file=routes.test.tsx
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from './routes';

function guard(event: MouseEvent): void {
  if (event.target instanceof Element && event.target.closest('a') !== null) event.preventDefault();
}

beforeEach(() => {
  window.addEventListener('click', guard);
});

afterEach(() => {
  window.removeEventListener('click', guard);
  vi.restoreAllMocks();
});

function start(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return { router, user: userEvent.setup() };
}

const nav = () => screen.getByRole('navigation', { name: '主导航' });
const requested = (spy: { mock: { calls: unknown[][] } }) => spy.mock.calls.map(([input]) => String(input));

test('直接打开书单：先显示“正在加载…”，数据到了再显示书单', async () => {
  start('/books');
  expect(screen.getByText('正在加载…')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  expect(await screen.findByRole('heading', { level: 1, name: '书单' })).toBeInTheDocument();
  expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['三体', '活着', '围城']);
});

test('进入详情：加载时原来的页面保留，状态区显示“正在加载…”', async () => {
  const { router, user } = start('/books');
  await user.click(await screen.findByRole('link', { name: '活着' }));
  expect(await screen.findByText('正在加载…')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1 }), '数据到达之前，书单还在').toHaveTextContent('书单');
  expect(await screen.findByRole('heading', { level: 1, name: '《活着》' }, { timeout: 3000 })).toBeInTheDocument();
  expect(screen.getByText('作者：余华')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(/^$/);
  expect(router.state.location.pathname).toBe('/books/2');
});

test('不存在的书：“没有这本书”，导航还在', async () => {
  start('/books/99');
  expect(await screen.findByRole('heading', { level: 1, name: '没有这本书' })).toBeInTheDocument();
  expect(nav()).toBeInTheDocument();
  expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { level: 1 }));
});

test('编号格式不对：不发请求，直接是“没有这本书”', async () => {
  const fetchSpy = vi.spyOn(window, 'fetch');
  start('/books/abc');
  expect(await screen.findByRole('heading', { level: 1, name: '没有这本书' })).toBeInTheDocument();
  expect(requested(fetchSpy).filter((url) => url.includes('abc'))).toEqual([]);
});

test('服务器出错、数据格式不对：显示加载失败的原因，导航还在', async () => {
  start('/books/500');
  expect(await screen.findByRole('alert')).toHaveTextContent('加载失败：服务器返回了 500');
  expect(within(nav()).getByRole('link', { name: '书单' })).toBeInTheDocument();
});

test('数据格式不对也是加载失败', async () => {
  start('/books/3');
  expect(await screen.findByRole('alert')).toHaveTextContent('加载失败：数据格式不正确');
});

test('加载中又去了别的页面：中止上一次的请求', async () => {
  const fetchSpy = vi.spyOn(window, 'fetch');
  const { user } = start('/books');
  await user.click(await screen.findByRole('link', { name: '活着' }));
  await user.click(screen.getByRole('link', { name: '三体' }));
  expect(await screen.findByRole('heading', { level: 1, name: '《三体》' })).toBeInTheDocument();
  const slow = fetchSpy.mock.calls.find(([input]) => String(input).endsWith('/api/books/2'));
  expect(slow?.[1]?.signal?.aborted, '没有用到的请求应该被中止').toBe(true);
});
```
:::

:::hint{level=1}
loader 写成 `async function bookLoader({ params, request }: LoaderFunctionArgs): Promise<Book>`，在路由对象上写 `loader: bookLoader`，组件中用 `useLoaderData<typeof bookLoader>()` 读取。验证可以参考本课示例的 `parseBook`。错误边界写成一个组件，用 `useRouteError()` 取得错误，挂在 `ErrorBoundary` 上。
:::

:::hint{level=2}
“找不到”用 `isRouteErrorResponse(error) && error.status === 404` 判断。错误边界要挂在 `books`、`books/:bookId` 这两个子路由上（或者一个包住它们、没有 `path` 的路由上），挂在根路由上的话，出错时整个布局都会被替换。状态区用 `useNavigation().state === 'loading'`。
:::

:::explanation
loader 把“这个页面需要什么数据”写在了路由上，带来了几个好处：

- **导航与数据一起开始、一起取消**：点击链接时 loader 立刻开始；又点了别的链接，React Router 中止上一次导航，`request.signal` 让对应的 `fetch` 也真正停下来（最后一个测试）；
- **组件不用处理“加载中”**：`BookPage` 渲染时数据已经在了。“正在加载…”由布局根据 `useNavigation()` 统一显示，原来的页面在数据到达之前保持不变，不会闪成一片空白；
- **错误有统一的去处**：loader 中抛出的错误（包括 `throw data(…, { status: 404 })`）交给最近的错误边界，`isRouteErrorResponse` 区分“预期中的响应”（找不到）和意外的错误。错误边界挂在哪一层，出错时就替换哪一层，所以挂在子路由上，布局和导航都留着。

编号的验证在发请求之前：`/books/abc` 根本不会去问服务器。这和 g13 的商品详情是同一个道理，只是现在“找不到”通过错误边界显示。

第一次加载是个特殊情况：刚打开页面时还没有任何“原来的页面”可以保留，所以需要 `HydrateFallback`。

替代解把错误边界挂在一个没有 `path` 的路由上，它包住两个书的路由：两个路由共用同一个错误边界，地址也不受影响。
:::

:::variant{kind=alt name=pathless-boundary}
```tsx file=routes.tsx
import { data, isRouteErrorResponse, Link, Outlet, useLoaderData, useNavigation, useRouteError, type LoaderFunctionArgs, type RouteObject } from 'react-router';

export type Book = { id: number; title: string; author: string };

function parseBook(value: unknown): Book {
  if (typeof value === 'object' && value !== null && 'id' in value && 'title' in value && 'author' in value) {
    const { id, title, author } = value;
    if (typeof id === 'number' && typeof title === 'string' && typeof author === 'string') return { id, title, author };
  }
  throw new Error('数据格式不正确');
}

function parseBooks(value: unknown): Book[] {
  if (!Array.isArray(value)) throw new Error('数据格式不正确');
  return value.map((item: unknown) => parseBook(item));
}

async function booksLoader({ request }: LoaderFunctionArgs): Promise<Book[]> {
  const response = await fetch('/api/books', { signal: request.signal });
  if (!response.ok) throw new Error(`服务器返回了 ${response.status}`);
  return parseBooks(await response.json());
}

async function bookLoader({ params, request }: LoaderFunctionArgs): Promise<Book> {
  const bookId = Number(params.bookId);
  if (!Number.isSafeInteger(bookId) || bookId < 1 || String(bookId) !== params.bookId) {
    throw data('没有这本书', { status: 404 });
  }
  const response = await fetch(`/api/books/${encodeURIComponent(String(bookId))}`, { signal: request.signal });
  if (response.status === 404) throw data('没有这本书', { status: 404 });
  if (!response.ok) throw new Error(`服务器返回了 ${response.status}`);
  return parseBook(await response.json());
}

function Layout() {
  const navigation = useNavigation();
  return (
    <>
      <nav aria-label="主导航">
        <Link to="/">首页</Link> <Link to="/books">书单</Link>
      </nav>
      <p role="status">{navigation.state === 'loading' ? '正在加载…' : ''}</p>
      <main>
        <Outlet />
      </main>
    </>
  );
}

function Loading() {
  return <p role="status">正在加载…</p>;
}

function BookList() {
  const books = useLoaderData<typeof booksLoader>();
  return (
    <>
      <h1>书单</h1>
      <ul>
        {books.map((book) => (
          <li key={book.id}>
            <Link to={`/books/${book.id}`}>{book.title}</Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function BookPage() {
  const book = useLoaderData<typeof bookLoader>();
  return (
    <>
      <h1>《{book.title}》</h1>
      <p>作者：{book.author}</p>
      <Link to="/books">返回书单</Link>
    </>
  );
}

function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <h1>没有这本书</h1>;
  return <div role="alert">加载失败：{error instanceof Error ? error.message : '未知错误'}</div>;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    HydrateFallback: Loading,
    children: [
      { index: true, element: <h1>欢迎</h1> },
      {
        ErrorBoundary: RouteError,
        children: [
          { path: 'books', loader: booksLoader, Component: BookList },
          { path: 'books/:bookId', loader: bookLoader, Component: BookPage },
        ],
      },
    ],
  },
];
```
:::

:::variant{kind=wrong name=boundary-on-root fails=tests reason="错误边界挂在根路由上，出错时导航也被替换了"}
```tsx file=routes.tsx
import { data, isRouteErrorResponse, Link, Outlet, useLoaderData, useNavigation, useRouteError, type LoaderFunctionArgs, type RouteObject } from 'react-router';

export type Book = { id: number; title: string; author: string };

function parseBook(value: unknown): Book {
  if (typeof value === 'object' && value !== null && 'id' in value && 'title' in value && 'author' in value) {
    const { id, title, author } = value;
    if (typeof id === 'number' && typeof title === 'string' && typeof author === 'string') return { id, title, author };
  }
  throw new Error('数据格式不正确');
}

function parseBooks(value: unknown): Book[] {
  if (!Array.isArray(value)) throw new Error('数据格式不正确');
  return value.map((item: unknown) => parseBook(item));
}

async function booksLoader({ request }: LoaderFunctionArgs): Promise<Book[]> {
  const response = await fetch('/api/books', { signal: request.signal });
  if (!response.ok) throw new Error(`服务器返回了 ${response.status}`);
  return parseBooks(await response.json());
}

async function bookLoader({ params, request }: LoaderFunctionArgs): Promise<Book> {
  const bookId = params.bookId ?? '';
  if (!/^[1-9]\d*$/.test(bookId)) throw data('没有这本书', { status: 404 });
  const response = await fetch(`/api/books/${bookId}`, { signal: request.signal });
  if (response.status === 404) throw data('没有这本书', { status: 404 });
  if (!response.ok) throw new Error(`服务器返回了 ${response.status}`);
  return parseBook(await response.json());
}

function Layout() {
  const navigation = useNavigation();
  return (
    <>
      <nav aria-label="主导航">
        <Link to="/">首页</Link> <Link to="/books">书单</Link>
      </nav>
      <p role="status">{navigation.state === 'loading' ? '正在加载…' : ''}</p>
      <main>
        <Outlet />
      </main>
    </>
  );
}

function Loading() {
  return <p role="status">正在加载…</p>;
}

function BookList() {
  const books = useLoaderData<typeof booksLoader>();
  return (
    <>
      <h1>书单</h1>
      <ul>
        {books.map((book) => (
          <li key={book.id}>
            <Link to={`/books/${book.id}`}>{book.title}</Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function BookPage() {
  const book = useLoaderData<typeof bookLoader>();
  return (
    <>
      <h1>《{book.title}》</h1>
      <p>作者：{book.author}</p>
      <Link to="/books">返回书单</Link>
    </>
  );
}

function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <h1>没有这本书</h1>;
  return <div role="alert">加载失败：{error instanceof Error ? error.message : '未知错误'}</div>;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    HydrateFallback: Loading,
    ErrorBoundary: RouteError,
    children: [
      { index: true, element: <h1>欢迎</h1> },
      { path: 'books', loader: booksLoader, Component: BookList },
      { path: 'books/:bookId', loader: bookLoader, Component: BookPage },
    ],
  },
];
```
:::

:::variant{kind=wrong name=no-hydrate-fallback fails=tests reason="没有 HydrateFallback，直接打开书单时第一次加载什么都不显示"}
```tsx file=routes.tsx
import { data, isRouteErrorResponse, Link, Outlet, useLoaderData, useNavigation, useRouteError, type LoaderFunctionArgs, type RouteObject } from 'react-router';

export type Book = { id: number; title: string; author: string };

function parseBook(value: unknown): Book {
  if (typeof value === 'object' && value !== null && 'id' in value && 'title' in value && 'author' in value) {
    const { id, title, author } = value;
    if (typeof id === 'number' && typeof title === 'string' && typeof author === 'string') return { id, title, author };
  }
  throw new Error('数据格式不正确');
}

function parseBooks(value: unknown): Book[] {
  if (!Array.isArray(value)) throw new Error('数据格式不正确');
  return value.map((item: unknown) => parseBook(item));
}

async function booksLoader({ request }: LoaderFunctionArgs): Promise<Book[]> {
  const response = await fetch('/api/books', { signal: request.signal });
  if (!response.ok) throw new Error(`服务器返回了 ${response.status}`);
  return parseBooks(await response.json());
}

async function bookLoader({ params, request }: LoaderFunctionArgs): Promise<Book> {
  const bookId = params.bookId ?? '';
  if (!/^[1-9]\d*$/.test(bookId)) throw data('没有这本书', { status: 404 });
  const response = await fetch(`/api/books/${bookId}`, { signal: request.signal });
  if (response.status === 404) throw data('没有这本书', { status: 404 });
  if (!response.ok) throw new Error(`服务器返回了 ${response.status}`);
  return parseBook(await response.json());
}

function Layout() {
  const navigation = useNavigation();
  return (
    <>
      <nav aria-label="主导航">
        <Link to="/">首页</Link> <Link to="/books">书单</Link>
      </nav>
      <p role="status">{navigation.state === 'loading' ? '正在加载…' : ''}</p>
      <main>
        <Outlet />
      </main>
    </>
  );
}

function Loading() {
  return <p role="status">正在加载…</p>;
}

function BookList() {
  const books = useLoaderData<typeof booksLoader>();
  return (
    <>
      <h1>书单</h1>
      <ul>
        {books.map((book) => (
          <li key={book.id}>
            <Link to={`/books/${book.id}`}>{book.title}</Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function BookPage() {
  const book = useLoaderData<typeof bookLoader>();
  return (
    <>
      <h1>《{book.title}》</h1>
      <p>作者：{book.author}</p>
      <Link to="/books">返回书单</Link>
    </>
  );
}

function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <h1>没有这本书</h1>;
  return <div role="alert">加载失败：{error instanceof Error ? error.message : '未知错误'}</div>;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, element: <h1>欢迎</h1> },
      { path: 'books', loader: booksLoader, Component: BookList, ErrorBoundary: RouteError },
      { path: 'books/:bookId', loader: bookLoader, Component: BookPage, ErrorBoundary: RouteError },
    ],
  },
];
```
:::

:::variant{kind=wrong name=404-as-error fails=tests reason="服务器返回 404 时抛出了普通的错误，显示成了“加载失败”"}
```tsx file=routes.tsx
import { data, isRouteErrorResponse, Link, Outlet, useLoaderData, useNavigation, useRouteError, type LoaderFunctionArgs, type RouteObject } from 'react-router';

export type Book = { id: number; title: string; author: string };

function parseBook(value: unknown): Book {
  if (typeof value === 'object' && value !== null && 'id' in value && 'title' in value && 'author' in value) {
    const { id, title, author } = value;
    if (typeof id === 'number' && typeof title === 'string' && typeof author === 'string') return { id, title, author };
  }
  throw new Error('数据格式不正确');
}

function parseBooks(value: unknown): Book[] {
  if (!Array.isArray(value)) throw new Error('数据格式不正确');
  return value.map((item: unknown) => parseBook(item));
}

async function booksLoader({ request }: LoaderFunctionArgs): Promise<Book[]> {
  const response = await fetch('/api/books', { signal: request.signal });
  if (!response.ok) throw new Error(`服务器返回了 ${response.status}`);
  return parseBooks(await response.json());
}

async function bookLoader({ params, request }: LoaderFunctionArgs): Promise<Book> {
  const bookId = params.bookId ?? '';
  if (!/^[1-9]\d*$/.test(bookId)) throw data('没有这本书', { status: 404 });
  const response = await fetch(`/api/books/${bookId}`, { signal: request.signal });
  if (!response.ok) throw new Error(`服务器返回了 ${response.status}`);
  return parseBook(await response.json());
}

function Layout() {
  const navigation = useNavigation();
  return (
    <>
      <nav aria-label="主导航">
        <Link to="/">首页</Link> <Link to="/books">书单</Link>
      </nav>
      <p role="status">{navigation.state === 'loading' ? '正在加载…' : ''}</p>
      <main>
        <Outlet />
      </main>
    </>
  );
}

function Loading() {
  return <p role="status">正在加载…</p>;
}

function BookList() {
  const books = useLoaderData<typeof booksLoader>();
  return (
    <>
      <h1>书单</h1>
      <ul>
        {books.map((book) => (
          <li key={book.id}>
            <Link to={`/books/${book.id}`}>{book.title}</Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function BookPage() {
  const book = useLoaderData<typeof bookLoader>();
  return (
    <>
      <h1>《{book.title}》</h1>
      <p>作者：{book.author}</p>
      <Link to="/books">返回书单</Link>
    </>
  );
}

function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <h1>没有这本书</h1>;
  return <div role="alert">加载失败：{error instanceof Error ? error.message : '未知错误'}</div>;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    HydrateFallback: Loading,
    children: [
      { index: true, element: <h1>欢迎</h1> },
      { path: 'books', loader: booksLoader, Component: BookList, ErrorBoundary: RouteError },
      { path: 'books/:bookId', loader: bookLoader, Component: BookPage, ErrorBoundary: RouteError },
    ],
  },
];
```
:::

:::variant{kind=wrong name=no-param-check fails=tests reason="没有先验证编号，格式不对的编号也去请求了服务器"}
```tsx file=routes.tsx
import { data, isRouteErrorResponse, Link, Outlet, useLoaderData, useNavigation, useRouteError, type LoaderFunctionArgs, type RouteObject } from 'react-router';

export type Book = { id: number; title: string; author: string };

function parseBook(value: unknown): Book {
  if (typeof value === 'object' && value !== null && 'id' in value && 'title' in value && 'author' in value) {
    const { id, title, author } = value;
    if (typeof id === 'number' && typeof title === 'string' && typeof author === 'string') return { id, title, author };
  }
  throw new Error('数据格式不正确');
}

function parseBooks(value: unknown): Book[] {
  if (!Array.isArray(value)) throw new Error('数据格式不正确');
  return value.map((item: unknown) => parseBook(item));
}

async function booksLoader({ request }: LoaderFunctionArgs): Promise<Book[]> {
  const response = await fetch('/api/books', { signal: request.signal });
  if (!response.ok) throw new Error(`服务器返回了 ${response.status}`);
  return parseBooks(await response.json());
}

async function bookLoader({ params, request }: LoaderFunctionArgs): Promise<Book> {
  const bookId = params.bookId ?? '';
  const response = await fetch(`/api/books/${bookId}`, { signal: request.signal });
  if (response.status === 404) throw data('没有这本书', { status: 404 });
  if (!response.ok) throw new Error(`服务器返回了 ${response.status}`);
  return parseBook(await response.json());
}

function Layout() {
  const navigation = useNavigation();
  return (
    <>
      <nav aria-label="主导航">
        <Link to="/">首页</Link> <Link to="/books">书单</Link>
      </nav>
      <p role="status">{navigation.state === 'loading' ? '正在加载…' : ''}</p>
      <main>
        <Outlet />
      </main>
    </>
  );
}

function Loading() {
  return <p role="status">正在加载…</p>;
}

function BookList() {
  const books = useLoaderData<typeof booksLoader>();
  return (
    <>
      <h1>书单</h1>
      <ul>
        {books.map((book) => (
          <li key={book.id}>
            <Link to={`/books/${book.id}`}>{book.title}</Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function BookPage() {
  const book = useLoaderData<typeof bookLoader>();
  return (
    <>
      <h1>《{book.title}》</h1>
      <p>作者：{book.author}</p>
      <Link to="/books">返回书单</Link>
    </>
  );
}

function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <h1>没有这本书</h1>;
  return <div role="alert">加载失败：{error instanceof Error ? error.message : '未知错误'}</div>;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    HydrateFallback: Loading,
    children: [
      { index: true, element: <h1>欢迎</h1> },
      { path: 'books', loader: booksLoader, Component: BookList, ErrorBoundary: RouteError },
      { path: 'books/:bookId', loader: bookLoader, Component: BookPage, ErrorBoundary: RouteError },
    ],
  },
];
```
:::

:::variant{kind=wrong name=no-signal fails=tests reason="没有把 request.signal 传给 fetch，被放弃的导航仍在请求"}
```tsx file=routes.tsx
import { data, isRouteErrorResponse, Link, Outlet, useLoaderData, useNavigation, useRouteError, type LoaderFunctionArgs, type RouteObject } from 'react-router';

export type Book = { id: number; title: string; author: string };

function parseBook(value: unknown): Book {
  if (typeof value === 'object' && value !== null && 'id' in value && 'title' in value && 'author' in value) {
    const { id, title, author } = value;
    if (typeof id === 'number' && typeof title === 'string' && typeof author === 'string') return { id, title, author };
  }
  throw new Error('数据格式不正确');
}

function parseBooks(value: unknown): Book[] {
  if (!Array.isArray(value)) throw new Error('数据格式不正确');
  return value.map((item: unknown) => parseBook(item));
}

async function booksLoader({ request }: LoaderFunctionArgs): Promise<Book[]> {
  const response = await fetch('/api/books', { signal: request.signal });
  if (!response.ok) throw new Error(`服务器返回了 ${response.status}`);
  return parseBooks(await response.json());
}

async function bookLoader({ params, request }: LoaderFunctionArgs): Promise<Book> {
  const bookId = params.bookId ?? '';
  if (!/^[1-9]\d*$/.test(bookId)) throw data('没有这本书', { status: 404 });
  const response = await fetch(`/api/books/${bookId}`);
  if (response.status === 404) throw data('没有这本书', { status: 404 });
  if (!response.ok) throw new Error(`服务器返回了 ${response.status}`);
  return parseBook(await response.json());
}

function Layout() {
  const navigation = useNavigation();
  return (
    <>
      <nav aria-label="主导航">
        <Link to="/">首页</Link> <Link to="/books">书单</Link>
      </nav>
      <p role="status">{navigation.state === 'loading' ? '正在加载…' : ''}</p>
      <main>
        <Outlet />
      </main>
    </>
  );
}

function Loading() {
  return <p role="status">正在加载…</p>;
}

function BookList() {
  const books = useLoaderData<typeof booksLoader>();
  return (
    <>
      <h1>书单</h1>
      <ul>
        {books.map((book) => (
          <li key={book.id}>
            <Link to={`/books/${book.id}`}>{book.title}</Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function BookPage() {
  const book = useLoaderData<typeof bookLoader>();
  return (
    <>
      <h1>《{book.title}》</h1>
      <p>作者：{book.author}</p>
      <Link to="/books">返回书单</Link>
    </>
  );
}

function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <h1>没有这本书</h1>;
  return <div role="alert">加载失败：{error instanceof Error ? error.message : '未知错误'}</div>;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    HydrateFallback: Loading,
    children: [
      { index: true, element: <h1>欢迎</h1> },
      { path: 'books', loader: booksLoader, Component: BookList, ErrorBoundary: RouteError },
      { path: 'books/:bookId', loader: bookLoader, Component: BookPage, ErrorBoundary: RouteError },
    ],
  },
];
```
:::

:::variant{kind=wrong name=no-validation fails=tests reason="没有验证响应的数据，格式不对时显示了空的标题"}
```tsx file=routes.tsx
import { data, isRouteErrorResponse, Link, Outlet, useLoaderData, useNavigation, useRouteError, type LoaderFunctionArgs, type RouteObject } from 'react-router';

export type Book = { id: number; title: string; author: string };

function parseBook(value: unknown): Book {
  if (typeof value === 'object' && value !== null && 'id' in value && 'title' in value && 'author' in value) {
    const { id, title, author } = value;
    if (typeof id === 'number' && typeof title === 'string' && typeof author === 'string') return { id, title, author };
  }
  throw new Error('数据格式不正确');
}

function parseBooks(value: unknown): Book[] {
  if (!Array.isArray(value)) throw new Error('数据格式不正确');
  return value.map((item: unknown) => parseBook(item));
}

async function booksLoader({ request }: LoaderFunctionArgs): Promise<Book[]> {
  const response = await fetch('/api/books', { signal: request.signal });
  if (!response.ok) throw new Error(`服务器返回了 ${response.status}`);
  return parseBooks(await response.json());
}

async function bookLoader({ params, request }: LoaderFunctionArgs): Promise<Book> {
  const bookId = params.bookId ?? '';
  if (!/^[1-9]\d*$/.test(bookId)) throw data('没有这本书', { status: 404 });
  const response = await fetch(`/api/books/${bookId}`, { signal: request.signal });
  if (response.status === 404) throw data('没有这本书', { status: 404 });
  if (!response.ok) throw new Error(`服务器返回了 ${response.status}`);
  const book: Book = await response.json();
  return book;
}

function Layout() {
  const navigation = useNavigation();
  return (
    <>
      <nav aria-label="主导航">
        <Link to="/">首页</Link> <Link to="/books">书单</Link>
      </nav>
      <p role="status">{navigation.state === 'loading' ? '正在加载…' : ''}</p>
      <main>
        <Outlet />
      </main>
    </>
  );
}

function Loading() {
  return <p role="status">正在加载…</p>;
}

function BookList() {
  const books = useLoaderData<typeof booksLoader>();
  return (
    <>
      <h1>书单</h1>
      <ul>
        {books.map((book) => (
          <li key={book.id}>
            <Link to={`/books/${book.id}`}>{book.title}</Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function BookPage() {
  const book = useLoaderData<typeof bookLoader>();
  return (
    <>
      <h1>《{book.title}》</h1>
      <p>作者：{book.author}</p>
      <Link to="/books">返回书单</Link>
    </>
  );
}

function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <h1>没有这本书</h1>;
  return <div role="alert">加载失败：{error instanceof Error ? error.message : '未知错误'}</div>;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    HydrateFallback: Loading,
    children: [
      { index: true, element: <h1>欢迎</h1> },
      { path: 'books', loader: booksLoader, Component: BookList, ErrorBoundary: RouteError },
      { path: 'books/:bookId', loader: bookLoader, Component: BookPage, ErrorBoundary: RouteError },
    ],
  },
];
```
:::
