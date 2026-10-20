---
kind: challenge
title: 一个小型前端路由
---
在 `router.ts` 中实现一个小型的前端路由。

**`matchRoute(pattern, pathname)`**：路径模式由 `/` 分隔的若干段组成，以 `:` 开头的段是参数。匹配时返回参数对象，不匹配时返回 `null`：

- 段数必须相同，普通段必须完全相等；参数段匹配任意非空的一段，值要用 `decodeURIComponent` 解码；
- `pathname` 末尾多一个 `/` 也算匹配（`/users/42/` 匹配 `/users/:id`）；`/` 只匹配 `/`。

**`createRouter(outlet, routes)`** 返回 `{ navigate, start }`：

1. **渲染**当前的 `location.pathname`：找到第一个匹配的路由，调用它的 `render(params)` 得到 `{ title, content }`，把 `outlet` 的内容换成 `<h1 tabindex="-1">标题</h1><p>内容</p>`（用 `textContent`），把 `document.title` 设为 `标题 · 示例站`，并把焦点移到这个 `<h1>`。没有匹配的路由时，标题是 `页面不存在`，内容是 `没有 /路径 这个页面`；
2. `navigate(path)`：用 `history.pushState` 改变地址，然后渲染；
3. `start()`：渲染一次；开始监听 `popstate`（后退、前进时重新渲染）；在 `document` 上委托 `click`，拦截**站内链接**：`<a>` 的地址与当前页面同源，没有 `target`、`download` 属性，并且点击时没有按住 Ctrl、⌘（`metaKey`）、Shift、Alt。拦截时阻止默认行为，然后 `navigate(路径 + 查询参数 + 片段)`。其他链接一律交给浏览器。`start()` 返回一个函数，调用它会移除这些监听器。

:::files{role=support}
```html file=index.html readonly
<!doctype html>
<html lang="zh-CN">
  <body>
    <nav aria-label="主导航">
      <a href="/">首页</a>
      <a href="/users/42">用户 42</a>
      <a href="/users/%E9%98%BF%E8%BE%BE">用户阿达</a>
      <a href="/about" target="_blank">关于（新窗口）</a>
      <a href="/report.pdf" download>下载报告</a>
      <a href="https://example.com/elsewhere">外部网站</a>
    </nav>
    <main id="outlet"></main>
  </body>
</html>
```
:::

:::files{role=starter}
```ts file=router.ts
export type Params = Record<string, string>;
export type Route = { pattern: string; render: (params: Params) => { title: string; content: string } };
export type Router = { navigate(path: string): void; start(): () => void };

export function matchRoute(pattern: string, pathname: string): Params | null {
  return pattern === pathname ? {} : null;
}

export function createRouter(outlet: HTMLElement, routes: readonly Route[]): Router {
  return {
    navigate(path) {
      location.href = path;
    },
    start() {
      return () => {};
    },
  };
}
```
:::

:::files{role=solution}
```ts file=router.ts
export type Params = Record<string, string>;
export type Route = { pattern: string; render: (params: Params) => { title: string; content: string } };
export type Router = { navigate(path: string): void; start(): () => void };

function segments(path: string): string[] {
  const trimmed = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  return trimmed.split('/');
}

export function matchRoute(pattern: string, pathname: string): Params | null {
  const expected = segments(pattern);
  const actual = segments(pathname);
  if (expected.length !== actual.length) return null;
  const params: Params = {};
  for (const [i, part] of expected.entries()) {
    const value = actual[i];
    if (value === undefined) return null;
    if (part.startsWith(':')) {
      if (value === '') return null;
      params[part.slice(1)] = decodeURIComponent(value);
    } else if (part !== value) {
      return null;
    }
  }
  return params;
}

function isPlainLeftClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
}

export function createRouter(outlet: HTMLElement, routes: readonly Route[]): Router {
  function render(): void {
    const pathname = location.pathname;
    let page = { title: '页面不存在', content: `没有 ${pathname} 这个页面` };
    for (const route of routes) {
      const params = matchRoute(route.pattern, pathname);
      if (params !== null) {
        page = route.render(params);
        break;
      }
    }
    const heading = document.createElement('h1');
    heading.tabIndex = -1;
    heading.textContent = page.title;
    const paragraph = document.createElement('p');
    paragraph.textContent = page.content;
    outlet.replaceChildren(heading, paragraph);
    document.title = `${page.title} · 示例站`;
    heading.focus();
  }

  function navigate(path: string): void {
    history.pushState(null, '', path);
    render();
  }

  function start(): () => void {
    const controller = new AbortController();
    window.addEventListener('popstate', render, { signal: controller.signal });
    document.addEventListener(
      'click',
      (event) => {
        if (event.defaultPrevented || !isPlainLeftClick(event)) return;
        const link = event.target instanceof Element ? event.target.closest('a') : null;
        if (link === null || link.hasAttribute('target') || link.hasAttribute('download')) return;
        const url = new URL(link.href);
        if (url.origin !== location.origin) return;
        event.preventDefault();
        navigate(url.pathname + url.search + url.hash);
      },
      { signal: controller.signal },
    );
    render();
    return () => controller.abort();
  }

  return { navigate, start };
}
```
:::

:::files{role=tests}
```ts file=router.test.ts
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { createRouter, matchRoute, type Route } from './router';

describe('matchRoute', () => {
  test('匹配普通段和参数段', () => {
    expect(matchRoute('/', '/')).toEqual({});
    expect(matchRoute('/users/:id', '/users/42')).toEqual({ id: '42' });
    expect(matchRoute('/users/:id/posts/:postId', '/users/7/posts/9')).toEqual({ id: '7', postId: '9' });
    expect(matchRoute('/users/:id', '/users/42/')).toEqual({ id: '42' });
  });

  test('参数被解码', () => {
    expect(matchRoute('/tags/:name', '/tags/C%2B%2B')).toEqual({ name: 'C++' });
  });

  test('不匹配的情况', () => {
    expect(matchRoute('/users/:id', '/users')).toBeNull();
    expect(matchRoute('/users/:id', '/users/42/posts')).toBeNull();
    expect(matchRoute('/users/:id', '/teams/42')).toBeNull();
    expect(matchRoute('/', '/about')).toBeNull();
    expect(matchRoute('/users/:id', '/users//')).toBeNull();
  });
});

describe('createRouter', () => {
  const routes: Route[] = [
    { pattern: '/', render: () => ({ title: '首页', content: '欢迎' }) },
    { pattern: '/users/:id', render: (p) => ({ title: `用户 ${p.id ?? ''}`, content: `这是 ${p.id ?? ''} 的主页` }) },
  ];
  let stop: () => void = () => {};
  const clicks: boolean[] = [];

  /** 在所有监听器之后记录点击是否被拦截，并阻止真实的跳转（沙箱中跳转会中断测试） */
  function guard(event: MouseEvent): void {
    clicks.push(event.defaultPrevented);
    event.preventDefault();
  }

  beforeEach(() => {
    history.replaceState(null, '', '/');
    clicks.length = 0;
    window.addEventListener('click', guard);
    const outlet = document.querySelector('#outlet');
    if (!(outlet instanceof HTMLElement)) throw new Error('缺少 #outlet');
    stop = createRouter(outlet, routes).start();
  });

  afterEach(() => {
    stop();
    window.removeEventListener('click', guard);
  });

  const heading = () => screen.getByRole('heading', { level: 1 });

  test('start 渲染当前地址', () => {
    expect(heading()).toHaveTextContent('首页');
    expect(document.title).toBe('首页 · 示例站');
  });

  test('点击站内链接：不跳转页面，改变地址并渲染，焦点移到标题', async () => {
    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: '用户 42' }));
    expect(clicks).toEqual([true]);
    expect(location.pathname).toBe('/users/42');
    expect(heading()).toHaveTextContent('用户 42');
    expect(heading()).toHaveFocus();
    expect(document.title).toBe('用户 42 · 示例站');
    await user.click(screen.getByRole('link', { name: '用户阿达' }));
    expect(heading()).toHaveTextContent('用户 阿达');
  });

  test('后退时重新渲染', async () => {
    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: '用户 42' }));
    const popped = new Promise<void>((resolve) => window.addEventListener('popstate', () => resolve(), { once: true }));
    history.back();
    await popped;
    expect(location.pathname).toBe('/');
    expect(heading()).toHaveTextContent('首页');
  });

  test('不拦截：Ctrl/⌘ 点击、target、download、外部链接', async () => {
    const user = userEvent.setup();
    await user.keyboard('{Control>}');
    await user.click(screen.getByRole('link', { name: '用户 42' }));
    await user.keyboard('{/Control}');
    await user.keyboard('{Meta>}');
    await user.click(screen.getByRole('link', { name: '用户 42' }));
    await user.keyboard('{/Meta}');
    await user.click(screen.getByRole('link', { name: '关于（新窗口）' }));
    await user.click(screen.getByRole('link', { name: '下载报告' }));
    await user.click(screen.getByRole('link', { name: '外部网站' }));
    expect(clicks).toEqual([false, false, false, false, false]);
    expect(location.pathname).toBe('/');
  });

  test('没有匹配的路由', () => {
    history.replaceState(null, '', '/nowhere');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(heading()).toHaveTextContent('页面不存在');
    expect(screen.getByText('没有 /nowhere 这个页面')).toBeInTheDocument();
  });

  test('停止后不再拦截链接', async () => {
    const user = userEvent.setup();
    stop();
    await user.click(screen.getByRole('link', { name: '用户 42' }));
    expect(clicks).toEqual([false]);
  });
});
```
:::

:::hint{level=1}
`matchRoute`：先去掉 `pathname` 末尾多余的 `/`，再把两边都按 `/` 切开，逐段比较。`createRouter` 里写一个 `render()`：用 `location.pathname` 找到匹配的路由，生成标题和内容，更新 `outlet`、`document.title` 和焦点。
:::

:::hint{level=2}
拦截链接：`event.target` 收窄后用 `closest('a')` 找到链接（d08），检查 `ctrlKey`、`metaKey`、`shiftKey`、`altKey`、`button`，以及 `target`、`download` 属性；`new URL(link.href).origin === location.origin` 判断同源。所有监听器都用同一个 `AbortController` 的 `signal` 注册，`start()` 返回 `() => controller.abort()`。标题要先设置 `tabIndex = -1` 才能用 `focus()` 聚焦。
:::

:::explanation
这就是 React Router 等库的核心：

- **地址是唯一的数据来源**：`render` 只看 `location.pathname`，所以无论是点击链接、调用 `navigate`、还是按后退键，最后都走同一条渲染路径；
- **拦截链接要克制**：只有普通的左键点击、同源、没有 `target` 和 `download` 的链接才由路由处理；用户按住 Ctrl/⌘ 想在新标签页打开、下载文件、去往别的网站时，都要交给浏览器，否则就破坏了用户熟悉的操作；
- **可访问性**：真实的页面跳转时，屏幕阅读器会读出新页面的标题；前端路由切换内容时它什么都不知道。更新 `document.title`，并把焦点移到新内容的主标题（`tabindex="-1"` 让标题可以被脚本聚焦，但不会出现在 Tab 顺序中），用户就能感知到“页面”变了。

`start()` 返回清理函数，这是 d08 讲过的约定：路由不再需要时（例如在测试之间），一次移除所有监听器。

在真实的部署中，还要让服务器把这些路径都返回同一个 `index.html`（本课的“前端路由”一节），否则刷新 `/users/42` 会得到 404。
:::

:::variant{kind=alt name=pattern-regex}
```ts file=router.ts
export type Params = Record<string, string>;
export type Route = { pattern: string; render: (params: Params) => { title: string; content: string } };
export type Router = { navigate(path: string): void; start(): () => void };

function toRegExp(pattern: string): { re: RegExp; names: string[] } {
  const names: string[] = [];
  const source = pattern
    .split('/')
    .map((part) => {
      if (part.startsWith(':')) {
        names.push(part.slice(1));
        return '([^/]+)';
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { re: new RegExp(`^${source}${pattern === '/' ? '' : '/?'}$`), names };
}

export function matchRoute(pattern: string, pathname: string): Params | null {
  const { re, names } = toRegExp(pattern);
  const match = re.exec(pathname);
  if (!match) return null;
  const params: Params = {};
  names.forEach((name, i) => {
    params[name] = decodeURIComponent(match[i + 1] ?? '');
  });
  return params;
}

export function createRouter(outlet: HTMLElement, routes: readonly Route[]): Router {
  const show = (): void => {
    const path = location.pathname;
    const found = routes.map((r) => ({ r, p: matchRoute(r.pattern, path) })).find((x) => x.p !== null);
    const page = found?.p ? found.r.render(found.p) : { title: '页面不存在', content: `没有 ${path} 这个页面` };
    const h1 = Object.assign(document.createElement('h1'), { tabIndex: -1, textContent: page.title });
    outlet.replaceChildren(h1, Object.assign(document.createElement('p'), { textContent: page.content }));
    document.title = `${page.title} · 示例站`;
    h1.focus();
  };
  const navigate = (path: string): void => {
    history.pushState(null, '', path);
    show();
  };
  const onClick = (event: MouseEvent): void => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (!(event.target instanceof Element)) return;
    const a = event.target.closest('a');
    if (!a || a.target || a.hasAttribute('download') || a.origin !== location.origin) return;
    event.preventDefault();
    navigate(a.pathname + a.search + a.hash);
  };
  return {
    navigate,
    start() {
      window.addEventListener('popstate', show);
      document.addEventListener('click', onClick);
      show();
      return () => {
        window.removeEventListener('popstate', show);
        document.removeEventListener('click', onClick);
      };
    },
  };
}
```
:::

:::variant{kind=wrong name=intercept-everything fails=tests reason="拦截了所有链接，包括 Ctrl 点击、新窗口、下载和外部链接"}
```ts file=router.ts
export type Params = Record<string, string>;
export type Route = { pattern: string; render: (params: Params) => { title: string; content: string } };
export type Router = { navigate(path: string): void; start(): () => void };

export function matchRoute(pattern: string, pathname: string): Params | null {
  const trim = (p: string) => (p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p);
  const expected = trim(pattern).split('/');
  const actual = trim(pathname).split('/');
  if (expected.length !== actual.length) return null;
  const params: Params = {};
  for (const [i, part] of expected.entries()) {
    const value = actual[i] ?? '';
    if (part.startsWith(':')) {
      if (value === '') return null;
      params[part.slice(1)] = decodeURIComponent(value);
    } else if (part !== value) return null;
  }
  return params;
}

export function createRouter(outlet: HTMLElement, routes: readonly Route[]): Router {
  const render = (): void => {
    const path = location.pathname;
    let page = { title: '页面不存在', content: `没有 ${path} 这个页面` };
    for (const route of routes) {
      const params = matchRoute(route.pattern, path);
      if (params) {
        page = route.render(params);
        break;
      }
    }
    const h1 = document.createElement('h1');
    h1.tabIndex = -1;
    h1.textContent = page.title;
    const p = document.createElement('p');
    p.textContent = page.content;
    outlet.replaceChildren(h1, p);
    document.title = `${page.title} · 示例站`;
    h1.focus();
  };
  const navigate = (path: string): void => {
    history.pushState(null, '', path);
    render();
  };
  return {
    navigate,
    start() {
      const controller = new AbortController();
      window.addEventListener('popstate', render, { signal: controller.signal });
      document.addEventListener(
        'click',
        (event) => {
          const link = event.target instanceof Element ? event.target.closest('a') : null;
          if (!link) return;
          event.preventDefault();
          const url = new URL(link.href);
          navigate(url.pathname + url.search + url.hash);
        },
        { signal: controller.signal },
      );
      render();
      return () => controller.abort();
    },
  };
}
```
:::

:::variant{kind=wrong name=no-popstate fails=tests reason="没有监听 popstate，后退时界面不变"}
```ts file=router.ts
export type Params = Record<string, string>;
export type Route = { pattern: string; render: (params: Params) => { title: string; content: string } };
export type Router = { navigate(path: string): void; start(): () => void };

export function matchRoute(pattern: string, pathname: string): Params | null {
  const trim = (p: string) => (p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p);
  const expected = trim(pattern).split('/');
  const actual = trim(pathname).split('/');
  if (expected.length !== actual.length) return null;
  const params: Params = {};
  for (const [i, part] of expected.entries()) {
    const value = actual[i] ?? '';
    if (part.startsWith(':')) {
      if (value === '') return null;
      params[part.slice(1)] = decodeURIComponent(value);
    } else if (part !== value) return null;
  }
  return params;
}

export function createRouter(outlet: HTMLElement, routes: readonly Route[]): Router {
  const render = (): void => {
    const path = location.pathname;
    let page = { title: '页面不存在', content: `没有 ${path} 这个页面` };
    for (const route of routes) {
      const params = matchRoute(route.pattern, path);
      if (params) {
        page = route.render(params);
        break;
      }
    }
    const h1 = document.createElement('h1');
    h1.tabIndex = -1;
    h1.textContent = page.title;
    const p = document.createElement('p');
    p.textContent = page.content;
    outlet.replaceChildren(h1, p);
    document.title = `${page.title} · 示例站`;
    h1.focus();
  };
  const navigate = (path: string): void => {
    history.pushState(null, '', path);
    render();
  };
  return {
    navigate,
    start() {
      const controller = new AbortController();
      document.addEventListener(
        'click',
        (event) => {
          if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
          const link = event.target instanceof Element ? event.target.closest('a') : null;
          if (!link || link.hasAttribute('target') || link.hasAttribute('download')) return;
          const url = new URL(link.href);
          if (url.origin !== location.origin) return;
          event.preventDefault();
          navigate(url.pathname + url.search + url.hash);
        },
        { signal: controller.signal },
      );
      render();
      return () => controller.abort();
    },
  };
}
```
:::

:::variant{kind=wrong name=no-decode fails=tests reason="参数没有解码"}
```ts file=router.ts
export type Params = Record<string, string>;
export type Route = { pattern: string; render: (params: Params) => { title: string; content: string } };
export type Router = { navigate(path: string): void; start(): () => void };

export function matchRoute(pattern: string, pathname: string): Params | null {
  const trim = (p: string) => (p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p);
  const expected = trim(pattern).split('/');
  const actual = trim(pathname).split('/');
  if (expected.length !== actual.length) return null;
  const params: Params = {};
  for (const [i, part] of expected.entries()) {
    const value = actual[i] ?? '';
    if (part.startsWith(':')) {
      if (value === '') return null;
      params[part.slice(1)] = value;
    } else if (part !== value) return null;
  }
  return params;
}

export function createRouter(outlet: HTMLElement, routes: readonly Route[]): Router {
  const render = (): void => {
    const path = location.pathname;
    let page = { title: '页面不存在', content: `没有 ${path} 这个页面` };
    for (const route of routes) {
      const params = matchRoute(route.pattern, path);
      if (params) {
        page = route.render(params);
        break;
      }
    }
    const h1 = document.createElement('h1');
    h1.tabIndex = -1;
    h1.textContent = page.title;
    const p = document.createElement('p');
    p.textContent = page.content;
    outlet.replaceChildren(h1, p);
    document.title = `${page.title} · 示例站`;
    h1.focus();
  };
  const navigate = (path: string): void => {
    history.pushState(null, '', path);
    render();
  };
  return {
    navigate,
    start() {
      const controller = new AbortController();
      window.addEventListener('popstate', render, { signal: controller.signal });
      document.addEventListener(
        'click',
        (event) => {
          if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
          const link = event.target instanceof Element ? event.target.closest('a') : null;
          if (!link || link.hasAttribute('target') || link.hasAttribute('download')) return;
          const url = new URL(link.href);
          if (url.origin !== location.origin) return;
          event.preventDefault();
          navigate(url.pathname + url.search + url.hash);
        },
        { signal: controller.signal },
      );
      render();
      return () => controller.abort();
    },
  };
}
```
:::

:::variant{kind=wrong name=no-focus-or-title fails=tests reason="切换视图时没有更新标题，也没有移动焦点"}
```ts file=router.ts
export type Params = Record<string, string>;
export type Route = { pattern: string; render: (params: Params) => { title: string; content: string } };
export type Router = { navigate(path: string): void; start(): () => void };

export function matchRoute(pattern: string, pathname: string): Params | null {
  const trim = (p: string) => (p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p);
  const expected = trim(pattern).split('/');
  const actual = trim(pathname).split('/');
  if (expected.length !== actual.length) return null;
  const params: Params = {};
  for (const [i, part] of expected.entries()) {
    const value = actual[i] ?? '';
    if (part.startsWith(':')) {
      if (value === '') return null;
      params[part.slice(1)] = decodeURIComponent(value);
    } else if (part !== value) return null;
  }
  return params;
}

export function createRouter(outlet: HTMLElement, routes: readonly Route[]): Router {
  const render = (): void => {
    const path = location.pathname;
    let page = { title: '页面不存在', content: `没有 ${path} 这个页面` };
    for (const route of routes) {
      const params = matchRoute(route.pattern, path);
      if (params) {
        page = route.render(params);
        break;
      }
    }
    const h1 = document.createElement('h1');
    h1.textContent = page.title;
    const p = document.createElement('p');
    p.textContent = page.content;
    outlet.replaceChildren(h1, p);
  };
  const navigate = (path: string): void => {
    history.pushState(null, '', path);
    render();
  };
  return {
    navigate,
    start() {
      const controller = new AbortController();
      window.addEventListener('popstate', render, { signal: controller.signal });
      document.addEventListener(
        'click',
        (event) => {
          if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
          const link = event.target instanceof Element ? event.target.closest('a') : null;
          if (!link || link.hasAttribute('target') || link.hasAttribute('download')) return;
          const url = new URL(link.href);
          if (url.origin !== location.origin) return;
          event.preventDefault();
          navigate(url.pathname + url.search + url.hash);
        },
        { signal: controller.signal },
      );
      render();
      return () => controller.abort();
    },
  };
}
```
:::
