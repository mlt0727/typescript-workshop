---
kind: challenge
title: 地址中的搜索、排序与翻页
---
`Catalog.tsx` 中的商品目录可以搜索、排序、翻页，但这些状态只保存在组件中：刷新页面、按“后退”、把链接发给别人，都会丢失。把它们改成**保存在地址的查询参数中**：

1. 从地址中读取三个参数：
   - `q`：搜索词。输入框显示它原来的值；筛选时去掉首尾空白，名字包含它的商品才显示；
   - `sort`：`default`（默认）、`price-asc`、`price-desc` 之一，不是这三个值时按 `default` 处理；
   - `page`：页码（每页 `PAGE_SIZE` 件）。只由数字组成、不以 0 开头时才有效，否则是第 1 页；超过总页数时显示最后一页；
2. 输入搜索词：更新 `q`（为空时删除这个参数），删除 `page`（回到第 1 页）。输入框直接绑定在地址上，修改时传 `{ replace: true, flushSync: true }`：替换当前的历史记录（本课讲过原因）；
3. 改变排序：更新 `sort`（选择“默认”时删除这个参数），删除 `page`，**新增**一条历史记录；
4. “上一页”“下一页”是**链接**（`Link`），保留其他参数，只改 `page`；指向第 1 页时删除 `page`。第一页没有“上一页”，最后一页没有“下一页”；
5. 界面上显示的一切都由地址决定：后退、前进之后，输入框、下拉框、列表都要跟着变。

`catalog.ts`（只读）中是商品数据。路由配置 `routes` 已经写好。

:::files{role=starter}
```tsx file=Catalog.tsx
import { useState } from 'react';
import { Link, type RouteObject } from 'react-router';
import { PAGE_SIZE, PRODUCTS, type Product } from './catalog';

type Sort = 'default' | 'price-asc' | 'price-desc';

const SORTS: readonly { value: Sort; label: string }[] = [
  { value: 'default', label: '默认' },
  { value: 'price-asc', label: '价格从低到高' },
  { value: 'price-desc', label: '价格从高到低' },
];

function sortProducts(products: readonly Product[], sort: Sort): readonly Product[] {
  if (sort === 'price-asc') return products.toSorted((a, b) => a.price - b.price);
  if (sort === 'price-desc') return products.toSorted((a, b) => b.price - a.price);
  return products;
}

// TODO：现在这些状态只保存在组件中。把它们改成从地址的查询参数中读取，修改时更新地址
export function Catalog() {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('default');
  const [page, setPage] = useState(1);

  const matches = sortProducts(
    PRODUCTS.filter((p) => p.name.includes(q.trim())),
    sort,
  );
  const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const visible = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <h1>商品</h1>
      <label>
        搜索 <input value={q} onChange={(e) => setQ(e.currentTarget.value)} />
      </label>{' '}
      <label>
        排序{' '}
        <select
          value={sort}
          onChange={(e) => {
            const value = e.currentTarget.value;
            if (value === 'price-asc' || value === 'price-desc' || value === 'default') setSort(value);
          }}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      {visible.length === 0 ? (
        <p>没有找到商品</p>
      ) : (
        <ul aria-label="商品">
          {visible.map((p) => (
            <li key={p.id}>
              {p.name} ¥{p.price}
            </li>
          ))}
        </ul>
      )}
      <nav aria-label="分页">
        {page > 1 && (
          <button type="button" onClick={() => setPage(page - 1)}>
            上一页
          </button>
        )}{' '}
        <span>
          第 {page} / {totalPages} 页
        </span>{' '}
        {page < totalPages && (
          <button type="button" onClick={() => setPage(page + 1)}>
            下一页
          </button>
        )}
      </nav>
    </>
  );
}

export const routes: RouteObject[] = [
  { path: '/', element: <Link to="/products">去商品列表</Link> },
  { path: '/products', Component: Catalog },
];
```
:::

:::files{role=support}
```ts file=catalog.ts readonly
export type Product = { id: number; name: string; price: number };

export const PRODUCTS: readonly Product[] = [
  { id: 1, name: '绿茶', price: 12 },
  { id: 2, name: '红茶', price: 15 },
  { id: 3, name: '咖啡', price: 22 },
  { id: 4, name: '奶茶', price: 16 },
  { id: 5, name: '蛋糕', price: 28 },
  { id: 6, name: '抹茶蛋糕', price: 32 },
  { id: 7, name: '矿泉水', price: 3 },
];

/** 每页显示的商品数 */
export const PAGE_SIZE = 3;
```
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { createHashRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from './Catalog';

// 预览运行在沙箱中，只能使用 # 之后的地址；部署到服务器上时用 createBrowserRouter
const router = createHashRouter(routes);

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<RouterProvider router={router} />);
```
:::

:::files{role=solution}
```tsx file=Catalog.tsx
import { Link, useSearchParams, type RouteObject } from 'react-router';
import { PAGE_SIZE, PRODUCTS, type Product } from './catalog';

type Sort = 'default' | 'price-asc' | 'price-desc';

const SORTS: readonly { value: Sort; label: string }[] = [
  { value: 'default', label: '默认' },
  { value: 'price-asc', label: '价格从低到高' },
  { value: 'price-desc', label: '价格从高到低' },
];

function sortProducts(products: readonly Product[], sort: Sort): readonly Product[] {
  if (sort === 'price-asc') return products.toSorted((a, b) => a.price - b.price);
  if (sort === 'price-desc') return products.toSorted((a, b) => b.price - a.price);
  return products;
}

function isSort(value: string | null): value is Sort {
  return value === 'default' || value === 'price-asc' || value === 'price-desc';
}

/** 在 current 的基础上修改参数：值为 null 的参数被删除 */
function withParams(current: URLSearchParams, changes: Record<string, string | null>): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  return next;
}

const searchOf = (params: URLSearchParams) => (params.size === 0 ? '' : `?${params.toString()}`);

export function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const sortParam = searchParams.get('sort');
  const sort: Sort = isSort(sortParam) ? sortParam : 'default';
  const pageText = searchParams.get('page') ?? '';

  const matches = sortProducts(
    PRODUCTS.filter((p) => p.name.includes(q.trim())),
    sort,
  );
  const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const page = /^[1-9]\d*$/.test(pageText) ? Math.min(Number(pageText), totalPages) : 1;
  const visible = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function updateSearch(text: string) {
    setSearchParams(withParams(searchParams, { q: text === '' ? null : text, page: null }), { replace: true, flushSync: true });
  }

  function updateSort(value: string) {
    setSearchParams(withParams(searchParams, { sort: value === 'default' ? null : value, page: null }));
  }

  const pageTo = (n: number) => ({ search: searchOf(withParams(searchParams, { page: n === 1 ? null : String(n) })) });

  return (
    <>
      <h1>商品</h1>
      <label>
        搜索 <input value={q} onChange={(e) => updateSearch(e.currentTarget.value)} />
      </label>{' '}
      <label>
        排序{' '}
        <select value={sort} onChange={(e) => updateSort(e.currentTarget.value)}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      {visible.length === 0 ? (
        <p>没有找到商品</p>
      ) : (
        <ul aria-label="商品">
          {visible.map((p) => (
            <li key={p.id}>
              {p.name} ¥{p.price}
            </li>
          ))}
        </ul>
      )}
      <nav aria-label="分页">
        {page > 1 && <Link to={pageTo(page - 1)}>上一页</Link>} <span>第 {page} / {totalPages} 页</span>{' '}
        {page < totalPages && <Link to={pageTo(page + 1)}>下一页</Link>}
      </nav>
    </>
  );
}

export const routes: RouteObject[] = [
  { path: '/', element: <Link to="/products">去商品列表</Link> },
  { path: '/products', Component: Catalog },
];
```
:::

:::files{role=tests}
```tsx file=Catalog.test.tsx
import { expect, test } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from './Catalog';

type MemoryRouter = ReturnType<typeof createMemoryRouter>;

/** 从 entries 中最后一个地址开始；之前的地址是可以后退回去的历史记录 */
function start(...entries: string[]) {
  const router = createMemoryRouter(routes, { initialEntries: entries, initialIndex: entries.length - 1 });
  render(<RouterProvider router={router} />);
  return { router, user: userEvent.setup() };
}

const params = (router: MemoryRouter) => Object.fromEntries(new URLSearchParams(router.state.location.search));
const items = () =>
  within(screen.getByRole('list', { name: '商品' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent?.split(' ')[0]);
const pageInfo = () => screen.getByText(/^第 \d+ \/ \d+ 页$/);
const pager = () => within(screen.getByRole('navigation', { name: '分页' }));

test('从地址读取搜索词、排序和页码', () => {
  start('/products?q=茶&sort=price-desc');
  expect(screen.getByLabelText('搜索')).toHaveValue('茶');
  expect(screen.getByLabelText('排序')).toHaveValue('price-desc');
  expect(items()).toEqual(['抹茶蛋糕', '奶茶', '红茶']);
  expect(pageInfo()).toHaveTextContent('第 1 / 2 页');
  expect(pager().queryByRole('link', { name: '上一页' })).toBeNull();
  expect(pager().getByRole('link', { name: '下一页' })).toBeInTheDocument();
});

test('不合法的排序和页码退回默认值', () => {
  start('/products?sort=cheap&page=abc');
  expect(screen.getByLabelText('排序')).toHaveValue('default');
  expect(items()).toEqual(['绿茶', '红茶', '咖啡']);
  expect(pageInfo()).toHaveTextContent('第 1 / 3 页');
});

test('以 0 开头、带小数点的页码无效', () => {
  for (const page of ['02', '1.5']) {
    const { router } = start(`/products?page=${page}`);
    expect(pageInfo(), `page=${page}`).toHaveTextContent('第 1 / 3 页');
    expect(router.state.location.search).toBe(`?page=${page}`);
    cleanup();
  }
});

test('输入框显示原来的搜索词；筛选时去掉首尾空白', () => {
  start('/products?q=%20蛋糕%20');
  expect(screen.getByLabelText('搜索')).toHaveValue(' 蛋糕 ');
  expect(items()).toEqual(['蛋糕', '抹茶蛋糕']);
});

test('页码太大时显示最后一页', () => {
  start('/products?page=99');
  expect(items()).toEqual(['矿泉水']);
  expect(pageInfo()).toHaveTextContent('第 3 / 3 页');
  expect(pager().queryByRole('link', { name: '下一页' })).toBeNull();
});

test('输入搜索词：更新地址中的 q，保留其他参数，替换当前的历史记录，并回到第 1 页', async () => {
  const { router, user } = start('/', '/products?sort=price-desc&page=3');
  await user.type(screen.getByLabelText('搜索'), '蛋糕');
  expect(params(router)).toEqual({ sort: 'price-desc', q: '蛋糕' });
  expect(items()).toEqual(['抹茶蛋糕', '蛋糕']);
  await user.clear(screen.getByLabelText('搜索'));
  expect(params(router)).toEqual({ sort: 'price-desc' });
  await act(() => router.navigate(-1));
  expect(router.state.location.pathname, '输入时应该替换历史记录，后退一次就离开这个页面').toBe('/');
});

test('改变排序：保留搜索词，新增一条历史记录，回到第 1 页；后退时界面跟着地址恢复', async () => {
  const { router, user } = start('/products?q=茶&page=2');
  expect(items()).toEqual(['抹茶蛋糕']);
  await user.selectOptions(screen.getByLabelText('排序'), 'price-asc');
  await waitFor(() => expect(params(router)).toEqual({ q: '茶', sort: 'price-asc' }));
  expect(await screen.findByText('第 1 / 2 页')).toBeInTheDocument();
  expect(items()).toEqual(['绿茶', '红茶', '奶茶']);
  await user.selectOptions(screen.getByLabelText('排序'), 'default');
  await waitFor(() => expect(params(router)).toEqual({ q: '茶' }));
  await act(() => router.navigate(-1));
  expect(params(router)).toEqual({ q: '茶', sort: 'price-asc' });
  expect(screen.getByLabelText('排序'), '后退之后，下拉框要跟着地址变化').toHaveValue('price-asc');
  expect(items()).toEqual(['绿茶', '红茶', '奶茶']);
  await act(() => router.navigate(-1));
  expect(params(router)).toEqual({ q: '茶', page: '2' });
  expect(screen.getByLabelText('排序')).toHaveValue('default');
  expect(items()).toEqual(['抹茶蛋糕']);
});

/** 解析链接的 href：比较路径和参数，不受参数顺序、中文是否编码的影响 */
function target(link: HTMLElement) {
  const url = new URL(link.getAttribute('href') ?? '', 'https://app.test');
  return { pathname: url.pathname, params: Object.fromEntries(url.searchParams) };
}

test('翻页是真正的链接：保留其他参数，第 1 页不写 page', async () => {
  const { router, user } = start('/products?q=茶&sort=price-desc');
  expect(items()).toEqual(['抹茶蛋糕', '奶茶', '红茶']);
  const next = pager().getByRole('link', { name: '下一页' });
  expect(target(next)).toEqual({ pathname: '/products', params: { q: '茶', sort: 'price-desc', page: '2' } });
  await user.click(next);
  expect(await screen.findByText('第 2 / 2 页')).toBeInTheDocument();
  expect(params(router)).toEqual({ q: '茶', sort: 'price-desc', page: '2' });
  expect(items()).toEqual(['绿茶']);
  const prev = pager().getByRole('link', { name: '上一页' });
  expect(target(prev)).toEqual({ pathname: '/products', params: { q: '茶', sort: 'price-desc' } });
  await user.click(prev);
  expect(await screen.findByText('第 1 / 2 页')).toBeInTheDocument();
  expect(params(router)).toEqual({ q: '茶', sort: 'price-desc' });
});

test('后退、前进时，输入框跟着地址变化', async () => {
  const { router } = start('/products?q=茶', '/products?q=蛋糕');
  expect(screen.getByLabelText('搜索')).toHaveValue('蛋糕');
  await act(() => router.navigate(-1));
  expect(screen.getByLabelText('搜索')).toHaveValue('茶');
  expect(items()).toEqual(['绿茶', '红茶', '奶茶']);
});

test('没有匹配的商品', async () => {
  const { user } = start('/products');
  await user.type(screen.getByLabelText('搜索'), '果汁');
  expect(screen.getByText('没有找到商品')).toBeInTheDocument();
  expect(pageInfo()).toHaveTextContent('第 1 / 1 页');
});
```
:::

:::hint{level=1}
用 `const [searchParams, setSearchParams] = useSearchParams()` 代替三个 `useState`。读取：`searchParams.get('q') ?? ''`；`sort` 用类型守卫检查；`page` 用正则检查格式，再和总页数比较。写一个小函数：在当前参数的基础上设置或删除几个参数，返回新的 `URLSearchParams`。
:::

:::hint{level=2}
输入框：`setSearchParams(新的参数, { replace: true, flushSync: true })`；下拉框：`setSearchParams(新的参数)`。翻页链接写成 `<Link to={{ search: '?' + 新的参数.toString() }}>`（参数为空时 `search` 用空字符串）：`to` 中只写 `search`，路径就保持不变。
:::

:::explanation
这道题是 e10 的 `parseFilters`/`toSearch` 在 React 中的版本，关键是：**地址是唯一的数据来源**。组件中没有任何保存筛选条件的 state，`q`、`sort`、`page` 每次渲染都从 `searchParams` 中读出来，所以后退、前进、打开分享的链接，界面都会自动对上。如果把参数复制进 `useState`，第一次渲染之后它们就和地址各走各的了（一个错误解就是这样写的）。

两种修改方式对应两种用户预期：输入是一个连续的过程，每个字都新增一条历史记录的话，“后退”会一个字一个字地删；所以用 `replace`。切换排序是一次明确的操作，用户希望“后退”能回到之前的排序，所以新增记录。翻页用链接而不是按钮：链接有真实的地址，可以在新标签页打开，读屏软件也能把它们读成链接。

`flushSync` 的原因在正文中讲过：导航默认在 transition 中更新，而这个输入框的值来自地址，地址晚一步更新，快速输入时就会丢字。

页码超过总页数时只是“显示”最后一页，没有修改地址：渲染时根据数据算出要显示什么（g12），不需要 Effect 去“纠正”地址。
:::

:::variant{kind=alt name=functional-updates}
```tsx file=Catalog.tsx
import { Link, useSearchParams, type RouteObject } from 'react-router';
import { PAGE_SIZE, PRODUCTS, type Product } from './catalog';

type Sort = 'default' | 'price-asc' | 'price-desc';

const SORTS: readonly { value: Sort; label: string }[] = [
  { value: 'default', label: '默认' },
  { value: 'price-asc', label: '价格从低到高' },
  { value: 'price-desc', label: '价格从高到低' },
];

function sortProducts(products: readonly Product[], sort: Sort): readonly Product[] {
  if (sort === 'price-asc') return products.toSorted((a, b) => a.price - b.price);
  if (sort === 'price-desc') return products.toSorted((a, b) => b.price - a.price);
  return products;
}

const SORT_VALUES: readonly string[] = SORTS.map((s) => s.value);

function readSort(value: string | null): Sort {
  for (const s of SORTS) if (s.value === value) return s.value;
  return 'default';
}

function readPage(value: string | null): number {
  if (value === null) return 1;
  const n = Number(value);
  return Number.isInteger(n) && String(n) === value && n >= 1 ? n : 1;
}

function edit(params: URLSearchParams, key: string, value: string | null): URLSearchParams {
  const next = new URLSearchParams(params);
  if (value === null) next.delete(key);
  else next.set(key, value);
  return next;
}

export function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const sort = readSort(searchParams.get('sort'));

  const matches = sortProducts(
    PRODUCTS.filter((p) => p.name.includes(q.trim())),
    sort,
  );
  const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const page = Math.min(readPage(searchParams.get('page')), totalPages);
  const visible = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const updateSearch = (text: string) =>
    setSearchParams((prev) => edit(edit(prev, 'q', text || null), 'page', null), { replace: true, flushSync: true });

  const updateSort = (value: string) =>
    setSearchParams((prev) => edit(edit(prev, 'sort', SORT_VALUES.includes(value) && value !== 'default' ? value : null), 'page', null));

  const pageTo = (n: number) => {
    const next = edit(searchParams, 'page', n > 1 ? String(n) : null).toString();
    return { search: next ? `?${next}` : '' };
  };

  return (
    <>
      <h1>商品</h1>
      <label>
        搜索 <input value={q} onChange={(e) => updateSearch(e.currentTarget.value)} />
      </label>{' '}
      <label>
        排序{' '}
        <select value={sort} onChange={(e) => updateSort(e.currentTarget.value)}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      {visible.length === 0 ? (
        <p>没有找到商品</p>
      ) : (
        <ul aria-label="商品">
          {visible.map((p) => (
            <li key={p.id}>
              {p.name} ¥{p.price}
            </li>
          ))}
        </ul>
      )}
      <nav aria-label="分页">
        {page > 1 && <Link to={pageTo(page - 1)}>上一页</Link>} <span>第 {page} / {totalPages} 页</span>{' '}
        {page < totalPages && <Link to={pageTo(page + 1)}>下一页</Link>}
      </nav>
    </>
  );
}

export const routes: RouteObject[] = [
  { path: '/', element: <Link to="/products">去商品列表</Link> },
  { path: '/products', Component: Catalog },
];
```
:::

:::variant{kind=wrong name=copy-into-state fails=tests reason="把 q 复制进了 useState，后退之后输入框和地址不一致"}
```tsx file=Catalog.tsx
import { useState } from 'react';
import { Link, useSearchParams, type RouteObject } from 'react-router';
import { PAGE_SIZE, PRODUCTS, type Product } from './catalog';

type Sort = 'default' | 'price-asc' | 'price-desc';

const SORTS: readonly { value: Sort; label: string }[] = [
  { value: 'default', label: '默认' },
  { value: 'price-asc', label: '价格从低到高' },
  { value: 'price-desc', label: '价格从高到低' },
];

function sortProducts(products: readonly Product[], sort: Sort): readonly Product[] {
  if (sort === 'price-asc') return products.toSorted((a, b) => a.price - b.price);
  if (sort === 'price-desc') return products.toSorted((a, b) => b.price - a.price);
  return products;
}

function isSort(value: string | null): value is Sort {
  return value === 'default' || value === 'price-asc' || value === 'price-desc';
}

/** 在 current 的基础上修改参数：值为 null 的参数被删除 */
function withParams(current: URLSearchParams, changes: Record<string, string | null>): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  return next;
}

const searchOf = (params: URLSearchParams) => (params.size === 0 ? '' : `?${params.toString()}`);

export function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const sortParam = searchParams.get('sort');
  const sort: Sort = isSort(sortParam) ? sortParam : 'default';
  const pageText = searchParams.get('page') ?? '';

  const matches = sortProducts(
    PRODUCTS.filter((p) => p.name.includes(q.trim())),
    sort,
  );
  const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const page = /^[1-9]\d*$/.test(pageText) ? Math.min(Number(pageText), totalPages) : 1;
  const visible = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function updateSearch(text: string) {
    setQ(text);
    setSearchParams(withParams(searchParams, { q: text === '' ? null : text, page: null }), { replace: true, flushSync: true });
  }

  function updateSort(value: string) {
    setSearchParams(withParams(searchParams, { sort: value === 'default' ? null : value, page: null }));
  }

  const pageTo = (n: number) => ({ search: searchOf(withParams(searchParams, { page: n === 1 ? null : String(n) })) });

  return (
    <>
      <h1>商品</h1>
      <label>
        搜索 <input value={q} onChange={(e) => updateSearch(e.currentTarget.value)} />
      </label>{' '}
      <label>
        排序{' '}
        <select value={sort} onChange={(e) => updateSort(e.currentTarget.value)}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      {visible.length === 0 ? (
        <p>没有找到商品</p>
      ) : (
        <ul aria-label="商品">
          {visible.map((p) => (
            <li key={p.id}>
              {p.name} ¥{p.price}
            </li>
          ))}
        </ul>
      )}
      <nav aria-label="分页">
        {page > 1 && <Link to={pageTo(page - 1)}>上一页</Link>} <span>第 {page} / {totalPages} 页</span>{' '}
        {page < totalPages && <Link to={pageTo(page + 1)}>下一页</Link>}
      </nav>
    </>
  );
}

export const routes: RouteObject[] = [
  { path: '/', element: <Link to="/products">去商品列表</Link> },
  { path: '/products', Component: Catalog },
];
```
:::

:::variant{kind=wrong name=push-while-typing fails=tests reason="输入时没有 replace，每个字都新增一条历史记录"}
```tsx file=Catalog.tsx
import { Link, useSearchParams, type RouteObject } from 'react-router';
import { PAGE_SIZE, PRODUCTS, type Product } from './catalog';

type Sort = 'default' | 'price-asc' | 'price-desc';

const SORTS: readonly { value: Sort; label: string }[] = [
  { value: 'default', label: '默认' },
  { value: 'price-asc', label: '价格从低到高' },
  { value: 'price-desc', label: '价格从高到低' },
];

function sortProducts(products: readonly Product[], sort: Sort): readonly Product[] {
  if (sort === 'price-asc') return products.toSorted((a, b) => a.price - b.price);
  if (sort === 'price-desc') return products.toSorted((a, b) => b.price - a.price);
  return products;
}

function isSort(value: string | null): value is Sort {
  return value === 'default' || value === 'price-asc' || value === 'price-desc';
}

/** 在 current 的基础上修改参数：值为 null 的参数被删除 */
function withParams(current: URLSearchParams, changes: Record<string, string | null>): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  return next;
}

const searchOf = (params: URLSearchParams) => (params.size === 0 ? '' : `?${params.toString()}`);

export function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const sortParam = searchParams.get('sort');
  const sort: Sort = isSort(sortParam) ? sortParam : 'default';
  const pageText = searchParams.get('page') ?? '';

  const matches = sortProducts(
    PRODUCTS.filter((p) => p.name.includes(q.trim())),
    sort,
  );
  const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const page = /^[1-9]\d*$/.test(pageText) ? Math.min(Number(pageText), totalPages) : 1;
  const visible = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function updateSearch(text: string) {
    setSearchParams(withParams(searchParams, { q: text === '' ? null : text, page: null }), { flushSync: true });
  }

  function updateSort(value: string) {
    setSearchParams(withParams(searchParams, { sort: value === 'default' ? null : value, page: null }));
  }

  const pageTo = (n: number) => ({ search: searchOf(withParams(searchParams, { page: n === 1 ? null : String(n) })) });

  return (
    <>
      <h1>商品</h1>
      <label>
        搜索 <input value={q} onChange={(e) => updateSearch(e.currentTarget.value)} />
      </label>{' '}
      <label>
        排序{' '}
        <select value={sort} onChange={(e) => updateSort(e.currentTarget.value)}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      {visible.length === 0 ? (
        <p>没有找到商品</p>
      ) : (
        <ul aria-label="商品">
          {visible.map((p) => (
            <li key={p.id}>
              {p.name} ¥{p.price}
            </li>
          ))}
        </ul>
      )}
      <nav aria-label="分页">
        {page > 1 && <Link to={pageTo(page - 1)}>上一页</Link>} <span>第 {page} / {totalPages} 页</span>{' '}
        {page < totalPages && <Link to={pageTo(page + 1)}>下一页</Link>}
      </nav>
    </>
  );
}

export const routes: RouteObject[] = [
  { path: '/', element: <Link to="/products">去商品列表</Link> },
  { path: '/products', Component: Catalog },
];
```
:::

:::variant{kind=wrong name=keep-page fails=tests reason="改变搜索词时没有回到第 1 页"}
```tsx file=Catalog.tsx
import { Link, useSearchParams, type RouteObject } from 'react-router';
import { PAGE_SIZE, PRODUCTS, type Product } from './catalog';

type Sort = 'default' | 'price-asc' | 'price-desc';

const SORTS: readonly { value: Sort; label: string }[] = [
  { value: 'default', label: '默认' },
  { value: 'price-asc', label: '价格从低到高' },
  { value: 'price-desc', label: '价格从高到低' },
];

function sortProducts(products: readonly Product[], sort: Sort): readonly Product[] {
  if (sort === 'price-asc') return products.toSorted((a, b) => a.price - b.price);
  if (sort === 'price-desc') return products.toSorted((a, b) => b.price - a.price);
  return products;
}

function isSort(value: string | null): value is Sort {
  return value === 'default' || value === 'price-asc' || value === 'price-desc';
}

/** 在 current 的基础上修改参数：值为 null 的参数被删除 */
function withParams(current: URLSearchParams, changes: Record<string, string | null>): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  return next;
}

const searchOf = (params: URLSearchParams) => (params.size === 0 ? '' : `?${params.toString()}`);

export function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const sortParam = searchParams.get('sort');
  const sort: Sort = isSort(sortParam) ? sortParam : 'default';
  const pageText = searchParams.get('page') ?? '';

  const matches = sortProducts(
    PRODUCTS.filter((p) => p.name.includes(q.trim())),
    sort,
  );
  const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const page = /^[1-9]\d*$/.test(pageText) ? Math.min(Number(pageText), totalPages) : 1;
  const visible = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function updateSearch(text: string) {
    setSearchParams(withParams(searchParams, { q: text === '' ? null : text }), { replace: true, flushSync: true });
  }

  function updateSort(value: string) {
    setSearchParams(withParams(searchParams, { sort: value === 'default' ? null : value, page: null }));
  }

  const pageTo = (n: number) => ({ search: searchOf(withParams(searchParams, { page: n === 1 ? null : String(n) })) });

  return (
    <>
      <h1>商品</h1>
      <label>
        搜索 <input value={q} onChange={(e) => updateSearch(e.currentTarget.value)} />
      </label>{' '}
      <label>
        排序{' '}
        <select value={sort} onChange={(e) => updateSort(e.currentTarget.value)}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      {visible.length === 0 ? (
        <p>没有找到商品</p>
      ) : (
        <ul aria-label="商品">
          {visible.map((p) => (
            <li key={p.id}>
              {p.name} ¥{p.price}
            </li>
          ))}
        </ul>
      )}
      <nav aria-label="分页">
        {page > 1 && <Link to={pageTo(page - 1)}>上一页</Link>} <span>第 {page} / {totalPages} 页</span>{' '}
        {page < totalPages && <Link to={pageTo(page + 1)}>下一页</Link>}
      </nav>
    </>
  );
}

export const routes: RouteObject[] = [
  { path: '/', element: <Link to="/products">去商品列表</Link> },
  { path: '/products', Component: Catalog },
];
```
:::

:::variant{kind=wrong name=no-clamp fails=tests reason="页码超过总页数时没有显示最后一页，而是“没有找到商品”"}
```tsx file=Catalog.tsx
import { Link, useSearchParams, type RouteObject } from 'react-router';
import { PAGE_SIZE, PRODUCTS, type Product } from './catalog';

type Sort = 'default' | 'price-asc' | 'price-desc';

const SORTS: readonly { value: Sort; label: string }[] = [
  { value: 'default', label: '默认' },
  { value: 'price-asc', label: '价格从低到高' },
  { value: 'price-desc', label: '价格从高到低' },
];

function sortProducts(products: readonly Product[], sort: Sort): readonly Product[] {
  if (sort === 'price-asc') return products.toSorted((a, b) => a.price - b.price);
  if (sort === 'price-desc') return products.toSorted((a, b) => b.price - a.price);
  return products;
}

function isSort(value: string | null): value is Sort {
  return value === 'default' || value === 'price-asc' || value === 'price-desc';
}

/** 在 current 的基础上修改参数：值为 null 的参数被删除 */
function withParams(current: URLSearchParams, changes: Record<string, string | null>): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  return next;
}

const searchOf = (params: URLSearchParams) => (params.size === 0 ? '' : `?${params.toString()}`);

export function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const sortParam = searchParams.get('sort');
  const sort: Sort = isSort(sortParam) ? sortParam : 'default';
  const pageText = searchParams.get('page') ?? '';

  const matches = sortProducts(
    PRODUCTS.filter((p) => p.name.includes(q.trim())),
    sort,
  );
  const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const page = /^[1-9]\d*$/.test(pageText) ? Number(pageText) : 1;
  const visible = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function updateSearch(text: string) {
    setSearchParams(withParams(searchParams, { q: text === '' ? null : text, page: null }), { replace: true, flushSync: true });
  }

  function updateSort(value: string) {
    setSearchParams(withParams(searchParams, { sort: value === 'default' ? null : value, page: null }));
  }

  const pageTo = (n: number) => ({ search: searchOf(withParams(searchParams, { page: n === 1 ? null : String(n) })) });

  return (
    <>
      <h1>商品</h1>
      <label>
        搜索 <input value={q} onChange={(e) => updateSearch(e.currentTarget.value)} />
      </label>{' '}
      <label>
        排序{' '}
        <select value={sort} onChange={(e) => updateSort(e.currentTarget.value)}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      {visible.length === 0 ? (
        <p>没有找到商品</p>
      ) : (
        <ul aria-label="商品">
          {visible.map((p) => (
            <li key={p.id}>
              {p.name} ¥{p.price}
            </li>
          ))}
        </ul>
      )}
      <nav aria-label="分页">
        {page > 1 && <Link to={pageTo(page - 1)}>上一页</Link>} <span>第 {page} / {totalPages} 页</span>{' '}
        {page < totalPages && <Link to={pageTo(page + 1)}>下一页</Link>}
      </nav>
    </>
  );
}

export const routes: RouteObject[] = [
  { path: '/', element: <Link to="/products">去商品列表</Link> },
  { path: '/products', Component: Catalog },
];
```
:::

:::variant{kind=wrong name=page-one-in-url fails=tests reason="指向第 1 页的链接仍然带着 page=1"}
```tsx file=Catalog.tsx
import { Link, useSearchParams, type RouteObject } from 'react-router';
import { PAGE_SIZE, PRODUCTS, type Product } from './catalog';

type Sort = 'default' | 'price-asc' | 'price-desc';

const SORTS: readonly { value: Sort; label: string }[] = [
  { value: 'default', label: '默认' },
  { value: 'price-asc', label: '价格从低到高' },
  { value: 'price-desc', label: '价格从高到低' },
];

function sortProducts(products: readonly Product[], sort: Sort): readonly Product[] {
  if (sort === 'price-asc') return products.toSorted((a, b) => a.price - b.price);
  if (sort === 'price-desc') return products.toSorted((a, b) => b.price - a.price);
  return products;
}

function isSort(value: string | null): value is Sort {
  return value === 'default' || value === 'price-asc' || value === 'price-desc';
}

/** 在 current 的基础上修改参数：值为 null 的参数被删除 */
function withParams(current: URLSearchParams, changes: Record<string, string | null>): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  return next;
}

const searchOf = (params: URLSearchParams) => (params.size === 0 ? '' : `?${params.toString()}`);

export function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const sortParam = searchParams.get('sort');
  const sort: Sort = isSort(sortParam) ? sortParam : 'default';
  const pageText = searchParams.get('page') ?? '';

  const matches = sortProducts(
    PRODUCTS.filter((p) => p.name.includes(q.trim())),
    sort,
  );
  const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const page = /^[1-9]\d*$/.test(pageText) ? Math.min(Number(pageText), totalPages) : 1;
  const visible = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function updateSearch(text: string) {
    setSearchParams(withParams(searchParams, { q: text === '' ? null : text, page: null }), { replace: true, flushSync: true });
  }

  function updateSort(value: string) {
    setSearchParams(withParams(searchParams, { sort: value === 'default' ? null : value, page: null }));
  }

  const pageTo = (n: number) => ({ search: searchOf(withParams(searchParams, { page: String(n) })) });

  return (
    <>
      <h1>商品</h1>
      <label>
        搜索 <input value={q} onChange={(e) => updateSearch(e.currentTarget.value)} />
      </label>{' '}
      <label>
        排序{' '}
        <select value={sort} onChange={(e) => updateSort(e.currentTarget.value)}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      {visible.length === 0 ? (
        <p>没有找到商品</p>
      ) : (
        <ul aria-label="商品">
          {visible.map((p) => (
            <li key={p.id}>
              {p.name} ¥{p.price}
            </li>
          ))}
        </ul>
      )}
      <nav aria-label="分页">
        {page > 1 && <Link to={pageTo(page - 1)}>上一页</Link>} <span>第 {page} / {totalPages} 页</span>{' '}
        {page < totalPages && <Link to={pageTo(page + 1)}>下一页</Link>}
      </nav>
    </>
  );
}

export const routes: RouteObject[] = [
  { path: '/', element: <Link to="/products">去商品列表</Link> },
  { path: '/products', Component: Catalog },
];
```
:::
