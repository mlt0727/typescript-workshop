---
kind: task
title: 商店的路由
---
`routes.tsx` 中的商店只有两个互不相连的页面，导航用的是普通的 `<a>`（点击会让整个页面重新加载），也没有商品详情页。用 React Router 改写它，导出路由配置 `routes`：

1. 所有页面都显示在布局 `Layout` 中：上面是导航 `<nav aria-label="主导航">`，下面的 `<main>` 中显示当前的页面；
2. 导航中有“首页”（`/`）和“商品”（`/products`）两个链接，用 `NavLink`：“首页”只在 `/` 时是当前页；“商品”在商品列表和商品详情页都是当前页；
3. `/`：标题 `<h1>首页</h1>`；`/products`：标题“商品”，列表中每个商品是一个指向 `/products/编号` 的链接；
4. `/products/:productId`：标题是商品的名字，下面是“价格：¥22”这样的一行。编号必须只由数字组成、不以 0 开头，并且在 `PRODUCTS` 中存在，否则标题是“没有这个商品”（不显示价格）。两种情况下都有一个“返回商品列表”的链接；
5. 其他地址：标题“页面不存在”，同样显示在布局中；
6. 站内链接都不能让整个页面重新加载。

`data.ts`（只读）中是商品数据；`main.tsx`（只读）用你导出的 `routes` 创建路由。

:::files{role=starter}
```tsx file=routes.tsx
import { type RouteObject } from 'react-router';
import { PRODUCTS } from './data';

// TODO：用 NavLink、Link 代替 <a>；把页面放进布局（Outlet）中；加上商品详情页和“页面不存在”
function Layout() {
  return (
    <nav aria-label="主导航">
      <a href="/">首页</a> <a href="/products">商品</a>
    </nav>
  );
}

function Home() {
  return <h1>首页</h1>;
}

function ProductList() {
  return (
    <>
      <h1>商品</h1>
      <ul>
        {PRODUCTS.map((p) => (
          <li key={p.id}>
            <a href={`/products/${p.id}`}>{p.name}</a>
          </li>
        ))}
      </ul>
    </>
  );
}

export const routes: RouteObject[] = [
  { path: '/', Component: Layout },
  { path: '/products', Component: ProductList },
];
```
:::

:::files{role=support}
```ts file=data.ts readonly
export type Product = { id: number; name: string; price: number };

export const PRODUCTS: readonly Product[] = [
  { id: 101, name: '绿茶', price: 12 },
  { id: 205, name: '咖啡', price: 22 },
  { id: 309, name: '蛋糕', price: 28 },
];
```
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
import { Link, NavLink, Outlet, useParams, type RouteObject } from 'react-router';
import { PRODUCTS, type Product } from './data';

function Layout() {
  return (
    <>
      <nav aria-label="主导航">
        <NavLink to="/">首页</NavLink> <NavLink to="/products">商品</NavLink>
      </nav>
      <main>
        <Outlet />
      </main>
    </>
  );
}

function Home() {
  return <h1>首页</h1>;
}

function ProductList() {
  return (
    <>
      <h1>商品</h1>
      <ul>
        {PRODUCTS.map((p) => (
          <li key={p.id}>
            <Link to={`/products/${p.id}`}>{p.name}</Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function findProduct(productId: string | undefined): Product | undefined {
  if (productId === undefined || !/^[1-9]\d*$/.test(productId)) return undefined;
  return PRODUCTS.find((p) => p.id === Number(productId));
}

function ProductDetail() {
  const product = findProduct(useParams().productId);
  return (
    <>
      <h1>{product === undefined ? '没有这个商品' : product.name}</h1>
      {product !== undefined && <p>价格：¥{product.price}</p>}
      <Link to="/products">返回商品列表</Link>
    </>
  );
}

function NotFound() {
  return <h1>页面不存在</h1>;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: 'products', Component: ProductList },
      { path: 'products/:productId', Component: ProductDetail },
      { path: '*', Component: NotFound },
    ],
  },
];
```
:::

:::files{role=tests}
```tsx file=routes.test.tsx
import { afterEach, beforeEach, expect, test } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from './routes';

const clicks: boolean[] = [];

/** 在所有监听器之后记录链接的点击是否被路由处理，并阻止真实的跳转（沙箱中整页跳转会中断测试） */
function guard(event: MouseEvent): void {
  if (event.target instanceof Element && event.target.closest('a') !== null) {
    clicks.push(event.defaultPrevented);
    event.preventDefault();
  }
}

beforeEach(() => {
  clicks.length = 0;
  window.addEventListener('click', guard);
});

afterEach(() => {
  window.removeEventListener('click', guard);
});

function start(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const { unmount } = render(<RouterProvider router={router} />);
  return { router, unmount, user: userEvent.setup() };
}

const heading = () => screen.getByRole('heading', { level: 1 });
const navLink = (name: string) => within(screen.getByRole('navigation', { name: '主导航' })).getByRole('link', { name });

test('首页：显示在布局的 main 中，“首页”是当前页', () => {
  start('/');
  expect(heading()).toHaveTextContent('首页');
  expect(screen.getByRole('main')).toContainElement(heading());
  expect(navLink('首页')).toHaveAttribute('aria-current', 'page');
  expect(navLink('商品')).not.toHaveAttribute('aria-current');
});

test('从导航进入商品列表，再进入详情：页面不重新加载，“商品”一直是当前页', async () => {
  const { router, user } = start('/');
  await user.click(navLink('商品'));
  expect(await screen.findByRole('heading', { level: 1, name: '商品' })).toBeInTheDocument();
  expect(navLink('商品')).toHaveAttribute('aria-current', 'page');
  expect(navLink('首页')).not.toHaveAttribute('aria-current');
  const links = within(screen.getByRole('list')).getAllByRole('link');
  expect(links.map((a) => a.getAttribute('href'))).toEqual(['/products/101', '/products/205', '/products/309']);
  await user.click(screen.getByRole('link', { name: '咖啡' }));
  expect(await screen.findByRole('heading', { level: 1, name: '咖啡' })).toBeInTheDocument();
  expect(screen.getByText('价格：¥22')).toBeInTheDocument();
  expect(navLink('商品')).toHaveAttribute('aria-current', 'page');
  expect(router.state.location.pathname).toBe('/products/205');
  expect(clicks, '站内链接应该由路由处理，不能让整个页面重新加载').toEqual([true, true]);
});

test('详情页的“返回商品列表”', async () => {
  const { router, user } = start('/products/309');
  expect(heading()).toHaveTextContent('蛋糕');
  await user.click(screen.getByRole('link', { name: '返回商品列表' }));
  expect(await screen.findByRole('heading', { level: 1, name: '商品' })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/products');
});

test('编号不存在或格式不对：“没有这个商品”，仍然显示在布局中', () => {
  for (const id of ['999', '0', '205abc', '205.0', '-205']) {
    const { unmount } = start(`/products/${id}`);
    expect(heading(), `/products/${id}`).toHaveTextContent('没有这个商品');
    expect(screen.queryByText(/价格/)).toBeNull();
    expect(screen.getByRole('link', { name: '返回商品列表' })).toBeInTheDocument();
    expect(navLink('商品')).toHaveAttribute('aria-current', 'page');
    unmount();
  }
});

test('其他地址：“页面不存在”，仍然显示在布局中', () => {
  for (const path of ['/nope', '/products/205/edit']) {
    const { unmount } = start(path);
    expect(heading(), path).toHaveTextContent('页面不存在');
    expect(screen.getByRole('main')).toContainElement(heading());
    unmount();
  }
});
```
:::

:::hint{level=1}
一个 `path: '/'` 的布局路由，`Component: Layout`，其他页面都放在它的 `children` 中：`{ index: true, … }`、`{ path: 'products', … }`、`{ path: 'products/:productId', … }`、`{ path: '*', … }`。`Layout` 中用 `<Outlet />` 显示子页面。
:::

:::hint{level=2}
导航用 `<NavLink to="/">` 和 `<NavLink to="/products">`，它们默认按前缀判断当前页，正好符合要求。详情页用 `useParams().productId` 取得编号（类型是 `string | undefined`），先用 `/^[1-9]\d*$/.test(…)` 检查格式，再 `Number(…)` 并在 `PRODUCTS` 中查找。
:::

:::explanation
把所有页面放进同一个布局路由的 `children`，导航只写一次，404 页面也自动有了导航：React Router 先匹配 `/`，再在它的子路由中找到最具体的那一个（`products/:productId` 比 `*` 具体），渲染在 `Layout` 的 `<Outlet />` 中。如果把 `*` 写在布局之外，“页面不存在”就会单独显示，没有导航。

`NavLink` 的“当前页”是按前缀判断的：`/products` 也匹配 `/products/205`，所以在详情页“商品”仍然是当前页，这正是我们想要的；如果给它加上 `end`，详情页上它就不亮了。`to="/"` 是例外：React Router 让它只在根地址时才算当前页。

编号的验证和 e06、e10 一样：路径参数来自地址，可能是任何字符串。`parseInt('205abc')` 得到 205，`Number('205.0')` 也是 205，只靠它们，一个错误的地址就会显示出“咖啡”。先确认格式，再转换。替代解用了另一种写法：`String(Number(id)) === id`，转换回去还和原来一样，才是一个“干净”的整数。

替代解还演示了另一种写路由配置的方式：`createRoutesFromElements` 加上 JSX 的 `<Route>`。它得到的是同样的路由对象，选哪一种是风格问题。
:::

:::variant{kind=alt name=jsx-routes}
```tsx file=routes.tsx
import { createRoutesFromElements, Link, NavLink, Outlet, Route, useParams } from 'react-router';
import { PRODUCTS } from './data';

function Layout() {
  return (
    <>
      <nav aria-label="主导航">
        <NavLink to="/" end>
          首页
        </NavLink>{' '}
        <NavLink to="/products">商品</NavLink>
      </nav>
      <main>
        <Outlet />
      </main>
    </>
  );
}

function ProductList() {
  return (
    <>
      <h1>商品</h1>
      <ul>
        {PRODUCTS.map((p) => (
          <li key={p.id}>
            <Link to={String(p.id)}>{p.name}</Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function ProductDetail() {
  const { productId = '' } = useParams();
  const id = Number(productId);
  const product = String(id) === productId && id > 0 ? PRODUCTS.find((p) => p.id === id) : undefined;
  return (
    <>
      {product ? (
        <>
          <h1>{product.name}</h1>
          <p>价格：¥{product.price}</p>
        </>
      ) : (
        <h1>没有这个商品</h1>
      )}
      <Link to="..">返回商品列表</Link>
    </>
  );
}

export const routes = createRoutesFromElements(
  <Route path="/" element={<Layout />}>
    <Route index element={<h1>首页</h1>} />
    <Route path="products">
      <Route index element={<ProductList />} />
      <Route path=":productId" element={<ProductDetail />} />
    </Route>
    <Route path="*" element={<h1>页面不存在</h1>} />
  </Route>,
);
```
:::

:::variant{kind=wrong name=plain-anchors fails=tests reason="导航和列表仍然用 <a>：点击会让整个页面重新加载，也没有“当前页”"}
```tsx file=routes.tsx
import { Link, Outlet, useParams, type RouteObject } from 'react-router';
import { PRODUCTS, type Product } from './data';

function Layout() {
  return (
    <>
      <nav aria-label="主导航">
        <a href="/">首页</a> <a href="/products">商品</a>
      </nav>
      <main>
        <Outlet />
      </main>
    </>
  );
}

function Home() {
  return <h1>首页</h1>;
}

function ProductList() {
  return (
    <>
      <h1>商品</h1>
      <ul>
        {PRODUCTS.map((p) => (
          <li key={p.id}>
            <a href={`/products/${p.id}`}>{p.name}</a>
          </li>
        ))}
      </ul>
    </>
  );
}

function findProduct(productId: string | undefined): Product | undefined {
  if (productId === undefined || !/^[1-9]\d*$/.test(productId)) return undefined;
  return PRODUCTS.find((p) => p.id === Number(productId));
}

function ProductDetail() {
  const product = findProduct(useParams().productId);
  return (
    <>
      <h1>{product === undefined ? '没有这个商品' : product.name}</h1>
      {product !== undefined && <p>价格：¥{product.price}</p>}
      <Link to="/products">返回商品列表</Link>
    </>
  );
}

function NotFound() {
  return <h1>页面不存在</h1>;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: 'products', Component: ProductList },
      { path: 'products/:productId', Component: ProductDetail },
      { path: '*', Component: NotFound },
    ],
  },
];
```
:::

:::variant{kind=wrong name=products-end fails=tests reason="“商品”的 NavLink 加了 end，在商品详情页上不再是当前页"}
```tsx file=routes.tsx
import { Link, NavLink, Outlet, useParams, type RouteObject } from 'react-router';
import { PRODUCTS, type Product } from './data';

function Layout() {
  return (
    <>
      <nav aria-label="主导航">
        <NavLink to="/">首页</NavLink> <NavLink to="/products" end>商品</NavLink>
      </nav>
      <main>
        <Outlet />
      </main>
    </>
  );
}

function Home() {
  return <h1>首页</h1>;
}

function ProductList() {
  return (
    <>
      <h1>商品</h1>
      <ul>
        {PRODUCTS.map((p) => (
          <li key={p.id}>
            <Link to={`/products/${p.id}`}>{p.name}</Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function findProduct(productId: string | undefined): Product | undefined {
  if (productId === undefined || !/^[1-9]\d*$/.test(productId)) return undefined;
  return PRODUCTS.find((p) => p.id === Number(productId));
}

function ProductDetail() {
  const product = findProduct(useParams().productId);
  return (
    <>
      <h1>{product === undefined ? '没有这个商品' : product.name}</h1>
      {product !== undefined && <p>价格：¥{product.price}</p>}
      <Link to="/products">返回商品列表</Link>
    </>
  );
}

function NotFound() {
  return <h1>页面不存在</h1>;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: 'products', Component: ProductList },
      { path: 'products/:productId', Component: ProductDetail },
      { path: '*', Component: NotFound },
    ],
  },
];
```
:::

:::variant{kind=wrong name=not-found-outside-layout fails=tests reason="* 路由写在布局之外，“页面不存在”没有导航"}
```tsx file=routes.tsx
import { Link, NavLink, Outlet, useParams, type RouteObject } from 'react-router';
import { PRODUCTS, type Product } from './data';

function Layout() {
  return (
    <>
      <nav aria-label="主导航">
        <NavLink to="/">首页</NavLink> <NavLink to="/products">商品</NavLink>
      </nav>
      <main>
        <Outlet />
      </main>
    </>
  );
}

function Home() {
  return <h1>首页</h1>;
}

function ProductList() {
  return (
    <>
      <h1>商品</h1>
      <ul>
        {PRODUCTS.map((p) => (
          <li key={p.id}>
            <Link to={`/products/${p.id}`}>{p.name}</Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function findProduct(productId: string | undefined): Product | undefined {
  if (productId === undefined || !/^[1-9]\d*$/.test(productId)) return undefined;
  return PRODUCTS.find((p) => p.id === Number(productId));
}

function ProductDetail() {
  const product = findProduct(useParams().productId);
  return (
    <>
      <h1>{product === undefined ? '没有这个商品' : product.name}</h1>
      {product !== undefined && <p>价格：¥{product.price}</p>}
      <Link to="/products">返回商品列表</Link>
    </>
  );
}

function NotFound() {
  return <h1>页面不存在</h1>;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: 'products', Component: ProductList },
      { path: 'products/:productId', Component: ProductDetail },
    ],
  },
  { path: '*', Component: NotFound },
];
```
:::

:::variant{kind=wrong name=parse-int fails=tests reason="用 parseInt 转换编号，/products/205abc 也显示了“咖啡”"}
```tsx file=routes.tsx
import { Link, NavLink, Outlet, useParams, type RouteObject } from 'react-router';
import { PRODUCTS, type Product } from './data';

function Layout() {
  return (
    <>
      <nav aria-label="主导航">
        <NavLink to="/">首页</NavLink> <NavLink to="/products">商品</NavLink>
      </nav>
      <main>
        <Outlet />
      </main>
    </>
  );
}

function Home() {
  return <h1>首页</h1>;
}

function ProductList() {
  return (
    <>
      <h1>商品</h1>
      <ul>
        {PRODUCTS.map((p) => (
          <li key={p.id}>
            <Link to={`/products/${p.id}`}>{p.name}</Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function findProduct(productId: string | undefined): Product | undefined {
  return PRODUCTS.find((p) => p.id === Number.parseInt(productId ?? '', 10));
}

function ProductDetail() {
  const product = findProduct(useParams().productId);
  return (
    <>
      <h1>{product === undefined ? '没有这个商品' : product.name}</h1>
      {product !== undefined && <p>价格：¥{product.price}</p>}
      <Link to="/products">返回商品列表</Link>
    </>
  );
}

function NotFound() {
  return <h1>页面不存在</h1>;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: 'products', Component: ProductList },
      { path: 'products/:productId', Component: ProductDetail },
      { path: '*', Component: NotFound },
    ],
  },
];
```
:::

:::variant{kind=wrong name=number-only fails=tests reason="只用 Number 转换编号，/products/205.0 也显示了“咖啡”"}
```tsx file=routes.tsx
import { Link, NavLink, Outlet, useParams, type RouteObject } from 'react-router';
import { PRODUCTS, type Product } from './data';

function Layout() {
  return (
    <>
      <nav aria-label="主导航">
        <NavLink to="/">首页</NavLink> <NavLink to="/products">商品</NavLink>
      </nav>
      <main>
        <Outlet />
      </main>
    </>
  );
}

function Home() {
  return <h1>首页</h1>;
}

function ProductList() {
  return (
    <>
      <h1>商品</h1>
      <ul>
        {PRODUCTS.map((p) => (
          <li key={p.id}>
            <Link to={`/products/${p.id}`}>{p.name}</Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function findProduct(productId: string | undefined): Product | undefined {
  const id = Number(productId);
  return Number.isInteger(id) ? PRODUCTS.find((p) => p.id === id) : undefined;
}

function ProductDetail() {
  const product = findProduct(useParams().productId);
  return (
    <>
      <h1>{product === undefined ? '没有这个商品' : product.name}</h1>
      {product !== undefined && <p>价格：¥{product.price}</p>}
      <Link to="/products">返回商品列表</Link>
    </>
  );
}

function NotFound() {
  return <h1>页面不存在</h1>;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: 'products', Component: ProductList },
      { path: 'products/:productId', Component: ProductDetail },
      { path: '*', Component: NotFound },
    ],
  },
];
```
:::
