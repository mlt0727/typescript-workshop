---
kind: challenge
title: 一个小型前端路由
---
在 `router.ts` 中实现一个小型的前端路由。

**`matchRoute(pattern, pathname)`**：路径模式由 `/` 分隔的若干段组成，以 `:` 开头的段是参数。匹配时返回参数对象，不匹配时返回 `null`：

- 段数必须相同，普通段必须完全相等；参数段匹配任意非空的一段，值要用 `decodeURIComponent` 解码，**解码失败**（例如残缺的 `%E0%A4%A`）也算不匹配；
- `pathname` 末尾多一个 `/` 也算匹配（`/users/42/` 匹配 `/users/:id`）；`/` 只匹配 `/`。

**`createRouter({ outlet, routes, history })`** 返回 `{ navigate, start }`。路由**只通过 `history` 读写地址**（类型见只读的 `history.ts`），不直接使用 `location.pathname` 和 `window.history`：

1. **渲染**：从 `history.location` 中取出路径部分（`new URL(地址, 任意基准地址).pathname`），找到第一个匹配的路由，调用它的 `render(params)` 得到 `{ title, content }`。把 `outlet` 的内容换成 `<h1 tabindex="-1">标题</h1><p>内容</p>`（文字用 `textContent` 设置），把 `document.title` 设为 `标题 · 示例站`，并把焦点移到这个 `<h1>`（`start()` 中的第一次渲染除外）。没有匹配的路由时，标题是 `页面不存在`，内容是 `没有 /路径 这个页面`；
2. `navigate(path)`：`history.push(path)`，然后渲染；
3. `start()`：渲染一次；用 `history.listen` 在后退、前进时重新渲染；在 `document` 上委托 `click`，拦截**站内链接**：`<a>` 的地址与当前页面同源，没有 `target`、`download` 属性，点击的是左键，并且没有按住 Ctrl、⌘（`metaKey`）、Shift、Alt。拦截时阻止默认行为，然后 `navigate(路径 + 查询参数 + 片段)`。其他链接一律交给浏览器。`start()` 返回一个函数，调用它会停止监听（包括 `history.listen`）。

为什么要把 `history` 作为参数传入？测试用一个只存在于内存中的历史记录（`createMemoryHistory`），不受浏览器的影响；部署到服务器上时用真正的 `createBrowserHistory()`；不能配置服务器的静态网站可以用 `createHashHistory()`，把路径放在 `#` 之后。路由的代码一行都不用改。（本题的预览只显示页面的结构，路由的行为由测试检查。）

:::files{role=support}
```html file=index.html readonly
<!doctype html>
<html lang="zh-CN">
  <body>
    <nav aria-label="主导航">
      <a href="/">首页</a>
      <a href="/users/42">用户 42</a>
      <a href="/users/%E9%98%BF%E8%BE%BE">用户阿达</a>
      <a href="/users/7?tab=posts#latest">用户 7 的帖子</a>
      <a href="/users/9"><strong>用户 9</strong> 的主页</a>
      <a href="/about" target="_blank">关于（新窗口）</a>
      <a href="/report.pdf" download>下载报告</a>
      <a href="https://example.com/elsewhere">外部网站</a>
    </nav>
    <main id="outlet"></main>
  </body>
</html>
```
```ts file=history.ts readonly
/** 路由读写地址的方式。路由只通过它来访问地址，不直接使用 location 和 window.history。 */
export interface RouterHistory {
  /** 当前的地址，例如 '/users/42?tab=posts#latest' */
  readonly location: string;
  /** 新增一条历史记录 */
  push(path: string): void;
  /** 地址被路由之外的操作改变时（后退、前进）调用 listener；返回取消监听的函数 */
  listen(listener: () => void): () => void;
}

/** 真实的浏览器地址：history.pushState + popstate。部署到服务器上时使用。 */
export function createBrowserHistory(): RouterHistory {
  return {
    get location() {
      return location.pathname + location.search + location.hash;
    },
    push(path) {
      history.pushState(null, '', path);
    },
    listen(listener) {
      window.addEventListener('popstate', listener);
      return () => window.removeEventListener('popstate', listener);
    },
  };
}

/** 把地址放在 # 之后：/index.html#/users/42。不需要服务器配置。 */
export function createHashHistory(): RouterHistory {
  return {
    get location() {
      return location.hash.startsWith('#/') ? location.hash.slice(1) : '/';
    },
    push(path) {
      history.pushState(null, '', `#${path}`);
    },
    listen(listener) {
      window.addEventListener('popstate', listener);
      return () => window.removeEventListener('popstate', listener);
    },
  };
}

/** 只存在于内存中的历史记录，测试中使用。back()、forward() 模拟浏览器的后退和前进。 */
export function createMemoryHistory(initial = '/'): RouterHistory & { back(): void; forward(): void } {
  let entries = [initial];
  let index = 0;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of [...listeners]) listener();
  };
  return {
    get location() {
      return entries[index] ?? '/';
    },
    push(path) {
      entries = [...entries.slice(0, index + 1), path];
      index = entries.length - 1;
    },
    listen(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    back() {
      if (index > 0) {
        index--;
        notify();
      }
    },
    forward() {
      if (index < entries.length - 1) {
        index++;
        notify();
      }
    },
  };
}
```
:::

:::files{role=starter}
```ts file=router.ts
import type { RouterHistory } from './history';

export type Params = Record<string, string>;
export type Page = { title: string; content: string };
export type Route = { pattern: string; render: (params: Params) => Page };
export type RouterOptions = { outlet: HTMLElement; routes: readonly Route[]; history: RouterHistory };
export type Router = { navigate(path: string): void; start(): () => void };

export function matchRoute(pattern: string, pathname: string): Params | null {
  return pattern === pathname ? {} : null;
}

export function createRouter(options: RouterOptions): Router {
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
import type { RouterHistory } from './history';

export type Params = Record<string, string>;
export type Page = { title: string; content: string };
export type Route = { pattern: string; render: (params: Params) => Page };
export type RouterOptions = { outlet: HTMLElement; routes: readonly Route[]; history: RouterHistory };
export type Router = { navigate(path: string): void; start(): () => void };

function segments(path: string): string[] {
  const trimmed = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  return trimmed.split('/');
}

function decode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
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
      const decoded = value === '' ? null : decode(value);
      if (decoded === null) return null;
      params[part.slice(1)] = decoded;
    } else if (part !== value) {
      return null;
    }
  }
  return params;
}

function isPlainLeftClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
}

export function createRouter(options: RouterOptions): Router {
  function render(moveFocus = true): void {
    const { pathname } = new URL(options.history.location, 'https://router.invalid');
    let page: Page = { title: '页面不存在', content: `没有 ${pathname} 这个页面` };
    for (const route of options.routes) {
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
    options.outlet.replaceChildren(heading, paragraph);
    document.title = `${page.title} · 示例站`;
    if (moveFocus) heading.focus();
  }

  function navigate(path: string): void {
    options.history.push(path);
    render();
  }

  function start(): () => void {
    const controller = new AbortController();
    const unlisten = options.history.listen(render);
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
    render(false);
    return () => {
      controller.abort();
      unlisten();
    };
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
import { createMemoryHistory } from './history';
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

  test('不匹配的情况，包括无法解码的参数', () => {
    expect(matchRoute('/users/:id', '/users')).toBeNull();
    expect(matchRoute('/users/:id', '/users/42/posts')).toBeNull();
    expect(matchRoute('/users/:id', '/teams/42')).toBeNull();
    expect(matchRoute('/', '/about')).toBeNull();
    expect(matchRoute('/users/:id', '/users//')).toBeNull();
    expect(matchRoute('/users/:id', '/users/%E0%A4%A')).toBeNull();
  });
});

describe('createRouter', () => {
  const routes: Route[] = [
    { pattern: '/', render: () => ({ title: '首页', content: '欢迎' }) },
    { pattern: '/users/:id', render: (p) => ({ title: `用户 ${p['id'] ?? ''}`, content: `这是 ${p['id'] ?? ''} 的主页` }) },
  ];
  let memory = createMemoryHistory('/');
  let stop: () => void = () => {};
  const clicks: boolean[] = [];

  /** 在所有监听器之后记录点击是否被拦截，并阻止真实的跳转（沙箱中跳转会中断测试） */
  function guard(event: MouseEvent): void {
    clicks.push(event.defaultPrevented);
    event.preventDefault();
  }

  function startAt(path: string): void {
    memory = createMemoryHistory(path);
    const outlet = document.querySelector('#outlet');
    if (!(outlet instanceof HTMLElement)) throw new Error('缺少 #outlet');
    stop = createRouter({ outlet, routes, history: memory }).start();
  }

  beforeEach(() => {
    clicks.length = 0;
    window.addEventListener('click', guard);
  });

  afterEach(() => {
    stop();
    window.removeEventListener('click', guard);
  });

  const heading = () => screen.getByRole('heading', { level: 1 });
  const link = (name: string) => screen.getByRole('link', { name });

  test('start 渲染当前地址，但不移动焦点', () => {
    startAt('/');
    expect(heading()).toHaveTextContent('首页');
    expect(heading()).toHaveAttribute('tabindex', '-1');
    expect(heading(), '页面刚打开时不要抢走焦点').not.toHaveFocus();
    expect(document.title).toBe('首页 · 示例站');
  });

  test('点击站内链接：不跳转页面，记录到历史中并渲染，焦点移到标题', async () => {
    startAt('/');
    const user = userEvent.setup();
    await user.click(link('用户 42'));
    expect(clicks).toEqual([true]);
    expect(memory.location).toBe('/users/42');
    expect(heading()).toHaveTextContent('用户 42');
    expect(heading()).toHaveFocus();
    expect(document.title).toBe('用户 42 · 示例站');
    await user.click(link('用户阿达'));
    expect(heading()).toHaveTextContent('用户 阿达');
  });

  test('点击链接中的子元素也会被拦截', async () => {
    startAt('/');
    await userEvent.setup().click(screen.getByText('用户 9'));
    expect(clicks).toEqual([true]);
    expect(memory.location).toBe('/users/9');
    expect(heading()).toHaveTextContent('用户 9');
  });

  test('保留链接中的查询参数和片段', async () => {
    startAt('/');
    await userEvent.setup().click(link('用户 7 的帖子'));
    expect(memory.location).toBe('/users/7?tab=posts#latest');
    expect(heading()).toHaveTextContent('用户 7');
  });

  test('后退、前进时重新渲染', async () => {
    startAt('/');
    await userEvent.setup().click(link('用户 42'));
    memory.back();
    expect(heading()).toHaveTextContent('首页');
    expect(heading()).toHaveFocus();
    memory.forward();
    expect(heading()).toHaveTextContent('用户 42');
  });

  test('不拦截：按住修饰键、target、download、外部链接', async () => {
    startAt('/');
    const user = userEvent.setup();
    for (const key of ['Control', 'Meta', 'Shift', 'Alt']) {
      await user.keyboard(`{${key}>}`);
      await user.click(link('用户 42'));
      await user.keyboard(`{/${key}}`);
    }
    await user.click(link('关于（新窗口）'));
    await user.click(link('下载报告'));
    await user.click(link('外部网站'));
    expect(clicks).toEqual([false, false, false, false, false, false, false]);
    expect(memory.location).toBe('/');
  });

  test('没有匹配的路由；路径参数中的 HTML 只作为文字显示', () => {
    startAt('/nowhere');
    expect(heading()).toHaveTextContent('页面不存在');
    expect(screen.getByText('没有 /nowhere 这个页面')).toBeInTheDocument();
    stop();
    startAt('/users/%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E');
    expect(heading()).toHaveTextContent('用户 <img src=x onerror=alert(1)>');
    expect(document.querySelector('#outlet img')).toBeNull();
  });

  test('停止之后不再拦截链接，也不再响应后退', async () => {
    startAt('/');
    const user = userEvent.setup();
    await user.click(link('用户 42'));
    stop();
    memory.back();
    expect(heading()).toHaveTextContent('用户 42');
    await user.click(link('用户 42'));
    expect(clicks).toEqual([true, false]);
  });
});
```
:::

:::hint{level=1}
`matchRoute`：先去掉 `pathname` 末尾多余的 `/`，再把两边都按 `/` 切开，逐段比较；解码放在 `try/catch` 中。`createRouter` 里写一个 `render()`：用 `options.history.location` 找到匹配的路由，生成标题和内容，更新 `outlet`、`document.title` 和焦点。
:::

:::hint{level=2}
拦截链接：`event.target` 收窄后用 `closest('a')` 找到链接（d08），检查 `button`、`ctrlKey`、`metaKey`、`shiftKey`、`altKey`，以及 `target`、`download` 属性；`new URL(link.href)` 得到 `origin`、`pathname`、`search`、`hash`。点击监听用 `AbortController` 的 `signal` 注册；`start()` 返回的函数里调用 `controller.abort()` 和 `history.listen` 返回的取消函数。标题要先设置 `tabIndex = -1` 才能用 `focus()` 聚焦；可以给 `render` 加一个参数，决定这一次要不要移动焦点。
:::

:::explanation
这就是 React Router 等库的核心：

- **地址是唯一的数据来源**：`render` 只看 `history.location`，所以无论是点击链接、调用 `navigate`、还是按后退键，最后都走同一条渲染路径；
- **拦截链接要克制**：只有普通的左键点击、同源、没有 `target` 和 `download` 的链接才由路由处理；用户按住 Ctrl/⌘ 或 Shift 想在新标签页、新窗口中打开，按住 Alt 想下载，或者要去别的网站时，都要交给浏览器，否则就破坏了用户熟悉的操作；
- **可访问性**：真实的页面跳转时，屏幕阅读器会读出新页面的标题；前端路由切换内容时它什么都不知道。更新 `document.title`，并把焦点移到新内容的主标题（`tabindex="-1"` 让标题可以被脚本聚焦，但不会出现在 Tab 顺序中），用户就能感知到“页面”变了。页面刚打开时则不要移动焦点：这时浏览器本来就从页面的开头开始，把焦点移到标题反而让用户跳过了导航；
- **路径参数来自地址，也就是来自用户**：任何人都可以构造一个 `/users/<img src=x onerror=…>` 的链接发给别人。用 `textContent` 显示，它只是一串文字（e12）。

把 `history` 作为参数传入，是 e05 讲过的**依赖注入**：路由只依赖一个小小的接口（`location`、`push`、`listen`），不关心地址实际存在哪里。React Router 也是这样设计的：同一套路由，可以配合 `createBrowserRouter`（真实地址）、`createHashRouter`（`#` 之后的地址）或 `createMemoryRouter`（测试等没有浏览器地址栏的环境）使用。

`start()` 返回清理函数，这是 d08 讲过的约定：路由不再需要时（例如在测试之间），一次移除所有监听器。

在真实的部署中，用 `createBrowserHistory()` 时还要让服务器把这些路径都返回同一个 `index.html`（本课的“前端路由”一节），否则刷新 `/users/42` 会得到 404。
:::

:::variant{kind=alt name=pattern-regex}
```ts file=router.ts
import type { RouterHistory } from './history';

export type Params = Record<string, string>;
export type Page = { title: string; content: string };
export type Route = { pattern: string; render: (params: Params) => Page };
export type RouterOptions = { outlet: HTMLElement; routes: readonly Route[]; history: RouterHistory };
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
  try {
    names.forEach((name, i) => {
      params[name] = decodeURIComponent(match[i + 1] ?? '');
    });
  } catch {
    return null;
  }
  return params;
}

export function createRouter({ outlet, routes, history: source }: RouterOptions): Router {
  const show = (moveFocus = true): void => {
    const path = new URL(source.location, 'https://example.invalid').pathname;
    const found = routes.map((r) => ({ r, p: matchRoute(r.pattern, path) })).find((x) => x.p !== null);
    const page = found?.p ? found.r.render(found.p) : { title: '页面不存在', content: `没有 ${path} 这个页面` };
    const h1 = Object.assign(document.createElement('h1'), { tabIndex: -1, textContent: page.title });
    outlet.replaceChildren(h1, Object.assign(document.createElement('p'), { textContent: page.content }));
    document.title = `${page.title} · 示例站`;
    if (moveFocus) h1.focus();
  };
  const navigate = (path: string): void => {
    source.push(path);
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
      const unlisten = source.listen(show);
      document.addEventListener('click', onClick);
      show(false);
      return () => {
        unlisten();
        document.removeEventListener('click', onClick);
      };
    },
  };
}
```
:::

:::variant{kind=wrong name=global-history fails=tests reason="没有使用传入的 history，直接读写了浏览器的地址"}
```ts file=router.ts
import type { RouterHistory } from './history';

export type Params = Record<string, string>;
export type Page = { title: string; content: string };
export type Route = { pattern: string; render: (params: Params) => Page };
export type RouterOptions = { outlet: HTMLElement; routes: readonly Route[]; history: RouterHistory };
export type Router = { navigate(path: string): void; start(): () => void };

function segments(path: string): string[] {
  const trimmed = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  return trimmed.split('/');
}

function decode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
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
      const decoded = value === '' ? null : decode(value);
      if (decoded === null) return null;
      params[part.slice(1)] = decoded;
    } else if (part !== value) {
      return null;
    }
  }
  return params;
}

function isPlainLeftClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
}

export function createRouter(options: RouterOptions): Router {
  function render(moveFocus = true): void {
    const { pathname } = new URL(location.href);
    let page: Page = { title: '页面不存在', content: `没有 ${pathname} 这个页面` };
    for (const route of options.routes) {
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
    options.outlet.replaceChildren(heading, paragraph);
    document.title = `${page.title} · 示例站`;
    if (moveFocus) heading.focus();
  }

  function navigate(path: string): void {
    history.pushState(null, '', path);
    render();
  }

  function start(): () => void {
    const controller = new AbortController();
    const unlisten = options.history.listen(render);
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
    render(false);
    return () => {
      controller.abort();
      unlisten();
    };
  }

  return { navigate, start };
}
```
:::

:::variant{kind=wrong name=intercept-everything fails=tests reason="拦截了所有链接，包括按住修饰键的点击、新窗口、下载和外部链接"}
```ts file=router.ts
import type { RouterHistory } from './history';

export type Params = Record<string, string>;
export type Page = { title: string; content: string };
export type Route = { pattern: string; render: (params: Params) => Page };
export type RouterOptions = { outlet: HTMLElement; routes: readonly Route[]; history: RouterHistory };
export type Router = { navigate(path: string): void; start(): () => void };

function segments(path: string): string[] {
  const trimmed = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  return trimmed.split('/');
}

function decode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
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
      const decoded = value === '' ? null : decode(value);
      if (decoded === null) return null;
      params[part.slice(1)] = decoded;
    } else if (part !== value) {
      return null;
    }
  }
  return params;
}

function isPlainLeftClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
}

export function createRouter(options: RouterOptions): Router {
  function render(moveFocus = true): void {
    const { pathname } = new URL(options.history.location, 'https://router.invalid');
    let page: Page = { title: '页面不存在', content: `没有 ${pathname} 这个页面` };
    for (const route of options.routes) {
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
    options.outlet.replaceChildren(heading, paragraph);
    document.title = `${page.title} · 示例站`;
    if (moveFocus) heading.focus();
  }

  function navigate(path: string): void {
    options.history.push(path);
    render();
  }

  function start(): () => void {
    const controller = new AbortController();
    const unlisten = options.history.listen(render);
    document.addEventListener(
      'click',
      (event) => {
        const link = event.target instanceof Element ? event.target.closest('a') : null;
        if (link === null) return;
        event.preventDefault();
        const url = new URL(link.href);
        navigate(url.pathname + url.search + url.hash);
      },
      { signal: controller.signal },
    );
    render(false);
    return () => {
      controller.abort();
      unlisten();
    };
  }

  return { navigate, start };
}
```
:::

:::variant{kind=wrong name=only-ctrl-meta fails=tests reason="只检查了 Ctrl 和 ⌘，按住 Shift、Alt 的点击也被拦截了"}
```ts file=router.ts
import type { RouterHistory } from './history';

export type Params = Record<string, string>;
export type Page = { title: string; content: string };
export type Route = { pattern: string; render: (params: Params) => Page };
export type RouterOptions = { outlet: HTMLElement; routes: readonly Route[]; history: RouterHistory };
export type Router = { navigate(path: string): void; start(): () => void };

function segments(path: string): string[] {
  const trimmed = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  return trimmed.split('/');
}

function decode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
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
      const decoded = value === '' ? null : decode(value);
      if (decoded === null) return null;
      params[part.slice(1)] = decoded;
    } else if (part !== value) {
      return null;
    }
  }
  return params;
}

function isPlainLeftClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.ctrlKey && !event.metaKey;
}

export function createRouter(options: RouterOptions): Router {
  function render(moveFocus = true): void {
    const { pathname } = new URL(options.history.location, 'https://router.invalid');
    let page: Page = { title: '页面不存在', content: `没有 ${pathname} 这个页面` };
    for (const route of options.routes) {
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
    options.outlet.replaceChildren(heading, paragraph);
    document.title = `${page.title} · 示例站`;
    if (moveFocus) heading.focus();
  }

  function navigate(path: string): void {
    options.history.push(path);
    render();
  }

  function start(): () => void {
    const controller = new AbortController();
    const unlisten = options.history.listen(render);
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
    render(false);
    return () => {
      controller.abort();
      unlisten();
    };
  }

  return { navigate, start };
}
```
:::

:::variant{kind=wrong name=drop-query fails=tests reason="只保留了路径，丢掉了查询参数和片段"}
```ts file=router.ts
import type { RouterHistory } from './history';

export type Params = Record<string, string>;
export type Page = { title: string; content: string };
export type Route = { pattern: string; render: (params: Params) => Page };
export type RouterOptions = { outlet: HTMLElement; routes: readonly Route[]; history: RouterHistory };
export type Router = { navigate(path: string): void; start(): () => void };

function segments(path: string): string[] {
  const trimmed = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  return trimmed.split('/');
}

function decode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
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
      const decoded = value === '' ? null : decode(value);
      if (decoded === null) return null;
      params[part.slice(1)] = decoded;
    } else if (part !== value) {
      return null;
    }
  }
  return params;
}

function isPlainLeftClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
}

export function createRouter(options: RouterOptions): Router {
  function render(moveFocus = true): void {
    const { pathname } = new URL(options.history.location, 'https://router.invalid');
    let page: Page = { title: '页面不存在', content: `没有 ${pathname} 这个页面` };
    for (const route of options.routes) {
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
    options.outlet.replaceChildren(heading, paragraph);
    document.title = `${page.title} · 示例站`;
    if (moveFocus) heading.focus();
  }

  function navigate(path: string): void {
    options.history.push(path);
    render();
  }

  function start(): () => void {
    const controller = new AbortController();
    const unlisten = options.history.listen(render);
    document.addEventListener(
      'click',
      (event) => {
        if (event.defaultPrevented || !isPlainLeftClick(event)) return;
        const link = event.target instanceof Element ? event.target.closest('a') : null;
        if (link === null || link.hasAttribute('target') || link.hasAttribute('download')) return;
        const url = new URL(link.href);
        if (url.origin !== location.origin) return;
        event.preventDefault();
        navigate(url.pathname);
      },
      { signal: controller.signal },
    );
    render(false);
    return () => {
      controller.abort();
      unlisten();
    };
  }

  return { navigate, start };
}
```
:::

:::variant{kind=wrong name=no-listen fails=tests reason="没有监听后退和前进"}
```ts file=router.ts
import type { RouterHistory } from './history';

export type Params = Record<string, string>;
export type Page = { title: string; content: string };
export type Route = { pattern: string; render: (params: Params) => Page };
export type RouterOptions = { outlet: HTMLElement; routes: readonly Route[]; history: RouterHistory };
export type Router = { navigate(path: string): void; start(): () => void };

function segments(path: string): string[] {
  const trimmed = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  return trimmed.split('/');
}

function decode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
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
      const decoded = value === '' ? null : decode(value);
      if (decoded === null) return null;
      params[part.slice(1)] = decoded;
    } else if (part !== value) {
      return null;
    }
  }
  return params;
}

function isPlainLeftClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
}

export function createRouter(options: RouterOptions): Router {
  function render(moveFocus = true): void {
    const { pathname } = new URL(options.history.location, 'https://router.invalid');
    let page: Page = { title: '页面不存在', content: `没有 ${pathname} 这个页面` };
    for (const route of options.routes) {
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
    options.outlet.replaceChildren(heading, paragraph);
    document.title = `${page.title} · 示例站`;
    if (moveFocus) heading.focus();
  }

  function navigate(path: string): void {
    options.history.push(path);
    render();
  }

  function start(): () => void {
    const controller = new AbortController();
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
    render(false);
    return () => {
      controller.abort();
    };
  }

  return { navigate, start };
}
```
:::

:::variant{kind=wrong name=focus-on-start fails=tests reason="页面刚打开时也把焦点移到了标题"}
```ts file=router.ts
import type { RouterHistory } from './history';

export type Params = Record<string, string>;
export type Page = { title: string; content: string };
export type Route = { pattern: string; render: (params: Params) => Page };
export type RouterOptions = { outlet: HTMLElement; routes: readonly Route[]; history: RouterHistory };
export type Router = { navigate(path: string): void; start(): () => void };

function segments(path: string): string[] {
  const trimmed = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  return trimmed.split('/');
}

function decode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
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
      const decoded = value === '' ? null : decode(value);
      if (decoded === null) return null;
      params[part.slice(1)] = decoded;
    } else if (part !== value) {
      return null;
    }
  }
  return params;
}

function isPlainLeftClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
}

export function createRouter(options: RouterOptions): Router {
  function render(moveFocus = true): void {
    const { pathname } = new URL(options.history.location, 'https://router.invalid');
    let page: Page = { title: '页面不存在', content: `没有 ${pathname} 这个页面` };
    for (const route of options.routes) {
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
    options.outlet.replaceChildren(heading, paragraph);
    document.title = `${page.title} · 示例站`;
    if (moveFocus) heading.focus();
  }

  function navigate(path: string): void {
    options.history.push(path);
    render();
  }

  function start(): () => void {
    const controller = new AbortController();
    const unlisten = options.history.listen(render);
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
    return () => {
      controller.abort();
      unlisten();
    };
  }

  return { navigate, start };
}
```
:::

:::variant{kind=wrong name=target-only fails=tests reason="只检查了 event.target 本身是不是链接，点击链接中的子元素时没有拦截"}
```ts file=router.ts
import type { RouterHistory } from './history';

export type Params = Record<string, string>;
export type Page = { title: string; content: string };
export type Route = { pattern: string; render: (params: Params) => Page };
export type RouterOptions = { outlet: HTMLElement; routes: readonly Route[]; history: RouterHistory };
export type Router = { navigate(path: string): void; start(): () => void };

function segments(path: string): string[] {
  const trimmed = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  return trimmed.split('/');
}

function decode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
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
      const decoded = value === '' ? null : decode(value);
      if (decoded === null) return null;
      params[part.slice(1)] = decoded;
    } else if (part !== value) {
      return null;
    }
  }
  return params;
}

function isPlainLeftClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
}

export function createRouter(options: RouterOptions): Router {
  function render(moveFocus = true): void {
    const { pathname } = new URL(options.history.location, 'https://router.invalid');
    let page: Page = { title: '页面不存在', content: `没有 ${pathname} 这个页面` };
    for (const route of options.routes) {
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
    options.outlet.replaceChildren(heading, paragraph);
    document.title = `${page.title} · 示例站`;
    if (moveFocus) heading.focus();
  }

  function navigate(path: string): void {
    options.history.push(path);
    render();
  }

  function start(): () => void {
    const controller = new AbortController();
    const unlisten = options.history.listen(render);
    document.addEventListener(
      'click',
      (event) => {
        if (event.defaultPrevented || !isPlainLeftClick(event)) return;
        const link = event.target instanceof HTMLAnchorElement ? event.target : null;
        if (link === null || link.hasAttribute('target') || link.hasAttribute('download')) return;
        const url = new URL(link.href);
        if (url.origin !== location.origin) return;
        event.preventDefault();
        navigate(url.pathname + url.search + url.hash);
      },
      { signal: controller.signal },
    );
    render(false);
    return () => {
      controller.abort();
      unlisten();
    };
  }

  return { navigate, start };
}
```
:::

:::variant{kind=wrong name=inner-html fails=tests reason="用 innerHTML 拼接标题，路径参数中的 HTML 生效了（XSS）"}
```ts file=router.ts
import type { RouterHistory } from './history';

export type Params = Record<string, string>;
export type Page = { title: string; content: string };
export type Route = { pattern: string; render: (params: Params) => Page };
export type RouterOptions = { outlet: HTMLElement; routes: readonly Route[]; history: RouterHistory };
export type Router = { navigate(path: string): void; start(): () => void };

function segments(path: string): string[] {
  const trimmed = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  return trimmed.split('/');
}

function decode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
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
      const decoded = value === '' ? null : decode(value);
      if (decoded === null) return null;
      params[part.slice(1)] = decoded;
    } else if (part !== value) {
      return null;
    }
  }
  return params;
}

function isPlainLeftClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
}

export function createRouter(options: RouterOptions): Router {
  function render(moveFocus = true): void {
    const { pathname } = new URL(options.history.location, 'https://router.invalid');
    let page: Page = { title: '页面不存在', content: `没有 ${pathname} 这个页面` };
    for (const route of options.routes) {
      const params = matchRoute(route.pattern, pathname);
      if (params !== null) {
        page = route.render(params);
        break;
      }
    }
    options.outlet.innerHTML = `<h1 tabindex="-1">${page.title}</h1><p>${page.content}</p>`;
    document.title = `${page.title} · 示例站`;
    if (moveFocus) options.outlet.querySelector('h1')?.focus();
  }

  function navigate(path: string): void {
    options.history.push(path);
    render();
  }

  function start(): () => void {
    const controller = new AbortController();
    const unlisten = options.history.listen(render);
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
    render(false);
    return () => {
      controller.abort();
      unlisten();
    };
  }

  return { navigate, start };
}
```
:::

:::variant{kind=wrong name=no-decode-guard fails=tests reason="解码失败时抛出了错误，而不是当作不匹配"}
```ts file=router.ts
import type { RouterHistory } from './history';

export type Params = Record<string, string>;
export type Page = { title: string; content: string };
export type Route = { pattern: string; render: (params: Params) => Page };
export type RouterOptions = { outlet: HTMLElement; routes: readonly Route[]; history: RouterHistory };
export type Router = { navigate(path: string): void; start(): () => void };

function segments(path: string): string[] {
  const trimmed = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  return trimmed.split('/');
}

function decode(value: string): string | null {
  return decodeURIComponent(value);
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
      const decoded = value === '' ? null : decode(value);
      if (decoded === null) return null;
      params[part.slice(1)] = decoded;
    } else if (part !== value) {
      return null;
    }
  }
  return params;
}

function isPlainLeftClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
}

export function createRouter(options: RouterOptions): Router {
  function render(moveFocus = true): void {
    const { pathname } = new URL(options.history.location, 'https://router.invalid');
    let page: Page = { title: '页面不存在', content: `没有 ${pathname} 这个页面` };
    for (const route of options.routes) {
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
    options.outlet.replaceChildren(heading, paragraph);
    document.title = `${page.title} · 示例站`;
    if (moveFocus) heading.focus();
  }

  function navigate(path: string): void {
    options.history.push(path);
    render();
  }

  function start(): () => void {
    const controller = new AbortController();
    const unlisten = options.history.listen(render);
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
    render(false);
    return () => {
      controller.abort();
      unlisten();
    };
  }

  return { navigate, start };
}
```
:::
