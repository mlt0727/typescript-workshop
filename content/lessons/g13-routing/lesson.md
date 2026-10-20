---
version: 1
mode: react
estimatedMinutes: 55
review: ai-draft
problem: e10 手写了一个小路由：匹配路径、拦截链接、处理后退。真实的应用还需要更多：几个页面共用同一个布局、链接显示“当前页”、路径参数、在 404 页面上也保留导航、把筛选条件放进地址里、在测试中模拟任意地址。React Router 是 React 生态中使用最广的路由库，这一课用它的 Data 模式组织一个多页面的应用：路由配置与嵌套布局、Link 与 NavLink、路径参数的类型与验证、查询参数，以及怎样测试路由。
objectives:
  - 用 createBrowserRouter（或 createHashRouter）与 RouterProvider 配置路由：嵌套路由、布局与 Outlet、index 路由、* 路由
  - 用 Link、NavLink 导航，理解 NavLink 的 aria-current 和 end；知道 useNavigate 只用于不是由点击引起的跳转
  - 用 useParams 读取路径参数，理解它的类型是 string | undefined，使用前要验证
  - 用 useSearchParams 把界面状态放进查询参数，区分 replace 与新增历史记录
  - 用 createMemoryRouter 在测试中从任意地址开始渲染，知道导航是异步完成的
references:
  - title: Picking a Mode — React Router
    url: https://reactrouter.com/start/modes
    checked: 2026-10-20
  - title: Routing (Data Mode) — React Router
    url: https://reactrouter.com/start/data/routing
    checked: 2026-10-20
  - title: Navigating — React Router
    url: https://reactrouter.com/start/framework/navigating
    checked: 2026-10-20
  - title: URL Values — React Router
    url: https://reactrouter.com/start/declarative/url-values
    checked: 2026-10-20
  - title: Upgrading from v7 — React Router
    url: https://reactrouter.com/upgrading/v7
    checked: 2026-10-20
    note: 本平台使用 react-router 8.5；v8 删除了 react-router-dom 包，所有内容从 react-router 导入
  - title: Accessibility — React Router
    url: https://reactrouter.com/how-to/accessibility
    checked: 2026-10-20
---

## 为什么用路由库

e10 的路由已经能用了，但真实的应用很快会遇到更多问题：很多页面共用一个带导航的布局；导航中要标出当前所在的页面；`/products` 和 `/products/:id` 要同时显示“商品”导航是当前页；地址不存在时，要在同一个布局中显示 404；路径参数要解码；链接要能写成相对于当前页面的形式……React Router 把这些都做好了，原理和 e10 一样：**地址是唯一的数据来源**，链接被拦截后由路由更新地址、重新渲染。

React Router 有三种用法（官方称为“模式”）：

- **Declarative 模式**：`<BrowserRouter>` 加上 JSX 写的 `<Routes>`、`<Route>`，只做路由匹配和导航；
- **Data 模式**：用 `createBrowserRouter` 在 React 之外创建路由，再交给 `<RouterProvider>`。除了路由，还支持在路由上加载数据（`loader`，g14）等功能；
- **Framework 模式**：在 Data 模式之上加一个 Vite 插件，提供按文件组织路由、服务端渲染等功能，更像一个完整的框架。

本课使用 **Data 模式**。版本说明：本平台使用 react-router 8（2026 年 6 月发布 8.0）。从 v7 开始，所有内容都从 `react-router` 导入，只有 `RouterProvider` 这类和 DOM 有关的组件从 `react-router/dom` 导入；v8 删除了旧的 `react-router-dom` 包。很多旧教程还在用 `react-router-dom`，或者 v6 之前的 `<Switch>`、`useHistory`，不要照抄。

## 第一个路由：嵌套与布局

路由配置是一个**路由对象**的数组：`path` 是路径，`Component` 是这个地址显示的组件，`children` 是嵌套的子路由。

:::playground{#first-router}
```tsx file=App.tsx
import { Link, NavLink, Outlet, type RouteObject } from 'react-router';

const linkStyle = ({ isActive }: { isActive: boolean }) => ({ fontWeight: isActive ? 'bold' : 'normal' });

function Layout() {
  return (
    <>
      <nav aria-label="主导航">
        <NavLink to="/" style={linkStyle}>
          首页
        </NavLink>{' '}
        ·{' '}
        <NavLink to="/about" style={linkStyle}>
          关于
        </NavLink>{' '}
        · <Link to="/nowhere">一个不存在的页面</Link>
      </nav>
      <main>
        <Outlet />
      </main>
      <footer>页脚：每个页面都有</footer>
    </>
  );
}

const Home = () => <h1>首页</h1>;
const About = () => <h1>关于我们</h1>;
const NotFound = () => <h1>页面不存在</h1>;

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: 'about', Component: About },
      { path: '*', Component: NotFound },
    ],
  },
];
```
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { createHashRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from './App';

// 预览运行在沙箱中，只能使用 # 之后的地址（见正文）；部署到服务器上时用 createBrowserRouter
const router = createHashRouter(routes);

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<RouterProvider router={router} />);
```
- `/` 对应的 `Layout` 是一个**布局路由**：它的子路由渲染在 `<Outlet />` 的位置。点三个链接，导航和页脚一直都在，只有 `<main>` 中的内容在变。
- `{ index: true }` 是 **index 路由**：地址正好是父路由的路径（这里是 `/`）时显示它，相当于“默认的子页面”。
- `path: '*'` 匹配其他所有地址。它是 `Layout` 的子路由，所以 404 页面也有导航和页脚。React Router 会给路由排序：`about` 比 `*` 更具体，先匹配它，所以书写的顺序不重要。
- `NavLink` 和 `Link` 都渲染一个真正的 `<a>`：按住 Ctrl/⌘ 点击会在新标签页打开（e10 讲过路由要放过这类点击）。区别是 `NavLink` 知道自己是不是**当前页**：它会得到 `aria-current="page"` 属性和 `active` 类名，`style` 和 `className` 还可以写成函数，根据 `isActive` 返回样式。
- `NavLink` 默认按**前缀**判断当前页：`<NavLink to="/products">` 在 `/products/2` 上也是当前页，这通常正是我们想要的（在详情页，“商品”导航仍然亮着）。加上 `end` 之后，只有地址完全相同时才算。`to="/"` 是个例外：每个地址都以 `/` 开头，所以 React Router 让它只在根地址时才算当前页，加不加 `end` 都一样。
:::

`createBrowserRouter` 使用真实的路径（`/about`），这是正式部署时的选择，但服务器要把这些路径都返回同一个 `index.html`（e10）。本平台的预览运行在一个沙箱页面中，Safari 不允许沙箱修改路径，所以示例用 `createHashRouter`，把路径放在 `#` 之后。两者的路由配置完全一样。路由对象要在组件之外**只创建一次**，不要放在 state 里，也不要在组件中每次渲染都创建。

## 路径参数：类型是 string | undefined

以 `:` 开头的段是**动态段**，它的值通过 `useParams()` 读取：

:::playground{#route-params}
```tsx file=App.tsx
import { Link, useParams, type RouteObject } from 'react-router';

type Product = { id: number; name: string; price: number };

const PRODUCTS: readonly Product[] = [
  { id: 1, name: '绿茶', price: 12 },
  { id: 2, name: '咖啡', price: 22 },
  { id: 3, name: '蛋糕', price: 28 },
];

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
        <li>
          <Link to="99">一个不存在的商品</Link>
        </li>
        <li>
          <Link to="2abc">一个格式不对的地址</Link>
        </li>
      </ul>
    </>
  );
}

function ProductDetail() {
  const { productId } = useParams();
  const product = productId !== undefined && /^[1-9]\d*$/.test(productId) ? PRODUCTS.find((p) => p.id === Number(productId)) : undefined;
  if (product === undefined) {
    return (
      <>
        <h1>没有编号为“{productId}”的商品</h1>
        <Link to="..">返回商品列表</Link>
      </>
    );
  }
  return (
    <>
      <h1>{product.name}</h1>
      <p>价格：¥{product.price}</p>
      <Link to="..">返回商品列表</Link>
    </>
  );
}

export const routes: RouteObject[] = [
  {
    path: '/products',
    children: [
      { index: true, Component: ProductList },
      { path: ':productId', Component: ProductDetail },
    ],
  },
  { path: '*', element: <Link to="/products">去商品列表</Link> },
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
- 把鼠标停在第 33 行的 `productId` 上：类型是 `string | undefined`。组件不知道自己会被放在哪个路由下（同一个组件可以用在没有这个参数的路由中），所以 TypeScript 只能说“可能没有”。
- 路径参数和查询参数一样**来自用户**：任何人都能在地址栏中输入 `/products/2abc`。第 34 行先用正则确认它是正整数，再查找商品。如果直接用 `parseInt('2abc')`，得到的是 2，一个错误的地址也会显示出“咖啡”（e06 讲过，运行时的数据要验证）。
- `/products` 这一项没有 `Component`，只用来给子路由加上共同的前缀。`to={String(p.id)}`、`to=".."` 是**相对链接**：相对于当前的路由，`..` 回到上一级路由 `/products`。
:::

## 链接与跳转

- 用户点击就能去的地方，用 `<Link>` 或 `<NavLink>`：它们是真正的链接，可以在新标签页打开、可以复制地址，读屏软件也会把它读成“链接”；
- 不是由用户点击引起的跳转（例如操作超时后回到登录页），才用 `useNavigate()` 得到的 `navigate('/login')`。不要用一个按钮加 `navigate` 去模拟链接；
- `<Link to="/products" replace>`、`navigate(-1)`：替换当前的历史记录、后退一步。

React Router 不会在切换页面后移动焦点，也不会通知读屏软件页面变了（官方文档的“Accessibility”一节把它们留给了应用）。e10 的做法在这里同样适用：在布局中根据 `useLocation().pathname` 的变化，把焦点移到新页面的主标题上（页面刚打开时不移动）。

## 查询参数：把界面状态放进地址

e10 说过：筛选、排序、页码这类状态放进查询参数，刷新、后退、分享链接时都能保留。`useSearchParams()` 返回当前的 `URLSearchParams` 和一个修改它的函数：

:::playground{#search-params}
```tsx file=App.tsx
import { useLocation, useSearchParams, type RouteObject } from 'react-router';

const CITIES = ['北京', '上海', '广州', '深圳', '杭州', '南京'];

function CityList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const q = searchParams.get('q') ?? '';
  const visible = CITIES.filter((city) => city.includes(q.trim()));

  return (
    <>
      <label>
        筛选城市{' '}
        <input
          value={q}
          onChange={(e) => {
            const text = e.currentTarget.value;
            setSearchParams(text === '' ? {} : { q: text }, { replace: true, flushSync: true });
          }}
        />
      </label>
      <p>当前地址：{location.pathname + location.search}</p>
      <ul>
        {visible.map((city) => (
          <li key={city}>{city}</li>
        ))}
      </ul>
    </>
  );
}

export const routes: RouteObject[] = [{ path: '*', Component: CityList }];
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
- 输入框的值**直接来自地址**（`searchParams.get('q')`），没有另外的 state。地址变了（输入、后退、打开分享来的链接），界面跟着变，两者不可能不一致。
- `replace: true`：每输入一个字都新增一条历史记录的话，用户按一次“后退”只能删掉一个字。输入时替换当前记录；切换排序、翻页这种“一步操作”才新增记录。
- `flushSync: true`：React Router 默认在 transition（`startTransition`）中更新导航后的状态，好让 React 先处理更紧急的更新。但这个输入框的值来自地址：地址还没更新时，React 会先把输入框恢复成旧的值，打字很快时，下一个字就可能接在旧的值后面，前一个字“丢了”。`flushSync` 让这一次更新同步完成。只有像这样**直接绑定在地址上的输入框**才需要它。
- `setSearchParams` 也可以传一个函数 `(prev) => 新的参数`，在原来的参数基础上修改。读出来的值都是 `string | null`，排序、页码这类有固定取值的参数，读取时要验证（e10 的 `parseFilters`）。
:::

## 测试路由

测试中用 `createMemoryRouter`：地址只保存在内存中，可以从任意地址开始，不影响浏览器（e10 的 `createMemoryHistory` 也是这个思路）。路由配置单独导出，测试和 `main.tsx` 共用同一份：

```tsx
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { routes } from './App';

test('从详情页返回列表', async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/products/2'] });
  render(<RouterProvider router={router} />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('咖啡');

  await userEvent.setup().click(screen.getByRole('link', { name: '返回商品列表' }));
  expect(await screen.findByRole('heading', { level: 1, name: '商品' })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/products');
});
```

注意第二个断言用的是 `findByRole`：点击链接之后，导航是**异步**完成的（还可能要先加载数据），页面不会在 `click` 返回时立刻更新。`findBy…` 会等到元素出现为止。`router.state.location` 是路由当前的地址；要在测试中直接导航，用 `await act(() => router.navigate('/about'))`，后退一步是 `router.navigate(-1)`。

::exercise{#app-routes}

## 编程挑战

::exercise{#catalog-search}

::quiz

## 常见错误

- **从 `react-router-dom` 导入**：v8 已经删除了这个包。从 `react-router` 导入，`RouterProvider` 从 `react-router/dom` 导入。
- **用 `<a href>` 或者按钮加 `navigate` 做站内导航**：前者会让整个页面重新加载，后者不是真正的链接。用 `<Link>`、`<NavLink>`。
- **给需要按前缀匹配的 `NavLink` 加了 `end`**：`<NavLink to="/products" end>` 在商品详情页上就不再是当前页了。只在确实需要“完全相同”时才加 `end`。
- **直接使用 `useParams()` 的值**：它可能是 `undefined`，也可能是任意的字符串。验证之后再用。
- **把查询参数复制进 state**：后退、前进之后，界面和地址就不一致了。直接从地址读取。
- **测试中点击链接后立刻断言**：导航是异步的，用 `findBy…` 或 `waitFor`。

## 下一步

下一课讲异步数据：加载状态、错误状态、重试，以及在路由上用 `loader` 加载数据。
