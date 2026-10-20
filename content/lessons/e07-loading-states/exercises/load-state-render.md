---
kind: task
title: 用可辨识联合渲染加载状态
---
起始代码用三个独立的字段（`isLoading`、`error`、`data`）表示加载状态。在 `render.ts` 中：

1. 把 `LoadState<T>` 改成可辨识联合，四种状态分别是：`{ status: 'idle' }`、`{ status: 'loading' }`、`{ status: 'error'; message: string }`、`{ status: 'success'; data: T }`；
2. 实现 `renderBooks(view, state, onRetry)`。`view.status` 是页面上**一直存在**的 `<p role="status">`，只改变它的文字；`view.results` 是显示结果的区域，按下表更新：

| 状态 | `view.status` 的文字 | `view.results` 的内容 |
| --- | --- | --- |
| `idle` | 空字符串 | 替换为 `<p>选择一个主题开始搜索。</p>` |
| `loading` | `正在加载…` | 保持不变（上一次的内容留在原处） |
| `error` | 空字符串 | 替换为 `<p role="alert">加载失败：错误信息</p>`，后面是一个“重试”按钮（`type="button"`，放在 alert **之外**），点击时调用 `onRetry` |
| `success`，没有数据 | `没有找到相关的书。` | 清空 |
| `success`，有数据 | `找到 N 本书` | 替换为 `<ul>`，每本书一个 `<li>`，内容是书名 |

3. `view.results` 的 `aria-busy` 在加载中时为 `"true"`，其他时候为 `"false"`。

书名中的特殊字符要原样显示（用 `textContent`）。

:::files{role=starter}
```ts file=render.ts
export type Book = { id: number; title: string };

// TODO：改成可辨识联合
export type LoadState<T> = { isLoading: boolean; error: string | null; data: T | null };

export type BookView = { status: HTMLElement; results: HTMLElement };

export function renderBooks(view: BookView, state: LoadState<Book[]>, onRetry: () => void): void {
  if (state.isLoading) {
    view.results.textContent = '正在加载…';
  } else if (state.data) {
    view.results.innerHTML = state.data.map((b) => `<li>${b.title}</li>`).join('');
  }
}
```
:::

:::files{role=solution}
```ts file=render.ts
export type Book = { id: number; title: string };

export type LoadState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

export type BookView = { status: HTMLElement; results: HTMLElement };

function paragraph(text: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.textContent = text;
  return p;
}

export function renderBooks(view: BookView, state: LoadState<Book[]>, onRetry: () => void): void {
  view.results.setAttribute('aria-busy', String(state.status === 'loading'));
  switch (state.status) {
    case 'idle':
      view.status.textContent = '';
      view.results.replaceChildren(paragraph('选择一个主题开始搜索。'));
      return;
    case 'loading':
      view.status.textContent = '正在加载…';
      return;
    case 'error': {
      view.status.textContent = '';
      const alert = paragraph(`加载失败：${state.message}`);
      alert.setAttribute('role', 'alert');
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = '重试';
      retry.addEventListener('click', onRetry);
      view.results.replaceChildren(alert, retry);
      return;
    }
    case 'success': {
      if (state.data.length === 0) {
        view.status.textContent = '没有找到相关的书。';
        view.results.replaceChildren();
        return;
      }
      const list = document.createElement('ul');
      for (const book of state.data) {
        const li = document.createElement('li');
        li.textContent = book.title;
        list.append(li);
      }
      view.status.textContent = `找到 ${state.data.length} 本书`;
      view.results.replaceChildren(list);
      return;
    }
    default: {
      const unreachable: never = state;
      throw new Error(`未处理的状态：${JSON.stringify(unreachable)}`);
    }
  }
}
```
:::

:::files{role=tests}
```ts file=render.test.ts
import { beforeEach, expect, test, vi } from 'vitest';
import { within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { renderBooks, type Book, type BookView, type LoadState } from './render';

let view: BookView;
const noop = () => {};

beforeEach(() => {
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const results = document.createElement('section');
  document.body.append(status, results);
  view = { status, results };
});

test('idle', () => {
  renderBooks(view, { status: 'idle' }, noop);
  expect(view.results).toHaveTextContent('选择一个主题开始搜索。');
  expect(view.status.textContent).toBe('');
  expect(view.results).toHaveAttribute('aria-busy', 'false');
});

test('loading：状态提示“正在加载…”，结果区域保留上一次的内容并标记为忙', () => {
  view.results.textContent = '上一次的结果';
  renderBooks(view, { status: 'loading' }, noop);
  expect(view.status).toHaveTextContent('正在加载…');
  expect(view.results).toHaveTextContent('上一次的结果');
  expect(view.results).toHaveAttribute('aria-busy', 'true');
});

test('error：显示原因，重试按钮调用 onRetry', async () => {
  const onRetry = vi.fn();
  renderBooks(view, { status: 'loading' }, noop);
  renderBooks(view, { status: 'error', message: '服务器出错' }, onRetry);
  const alert = within(view.results).getByRole('alert');
  expect(alert).toHaveTextContent(/^加载失败：服务器出错$/);
  const retry = within(view.results).getByRole('button', { name: '重试' });
  expect(retry).toHaveAttribute('type', 'button');
  expect(alert).not.toContainElement(retry);
  await userEvent.setup().click(retry);
  expect(onRetry).toHaveBeenCalledTimes(1);
  expect(view.status.textContent).toBe('');
  expect(view.results).toHaveAttribute('aria-busy', 'false');
});

test('success：没有数据', () => {
  view.results.textContent = '上一次的结果';
  renderBooks(view, { status: 'success', data: [] }, noop);
  expect(view.status).toHaveTextContent('没有找到相关的书。');
  expect(view.results.textContent).toBe('');
  expect(within(view.results).queryByRole('list')).toBeNull();
});

test('success：书名列表，特殊字符原样显示', () => {
  renderBooks(view, { status: 'success', data: [{ id: 1, title: '<b>TS</b> 入门' }, { id: 2, title: '深入 DOM' }] }, noop);
  expect(view.status).toHaveTextContent('找到 2 本书');
  const items = within(view.results).getAllByRole('listitem');
  expect(items.map((li) => li.textContent)).toEqual(['<b>TS</b> 入门', '深入 DOM']);
  expect(view.results.querySelector('b')).toBeNull();
  expect(view.results).toHaveAttribute('aria-busy', 'false');
});

test('状态提示始终是页面上原有的那个元素，结果区域里不新建状态元素', () => {
  const states: LoadState<Book[]>[] = [
    { status: 'loading' },
    { status: 'success', data: [{ id: 1, title: 'A' }] },
    { status: 'loading' },
    { status: 'success', data: [] },
    { status: 'error', message: '出错了' },
  ];
  for (const state of states) {
    renderBooks(view, state, noop);
    expect(document.querySelectorAll('[role="status"]'), state.status).toHaveLength(1);
    expect(within(view.results).queryByRole('status'), state.status).toBeNull();
  }
});
```
```ts file=render.test-d.ts
import type { LoadState } from './render';

const ok: LoadState<number>[] = [
  { status: 'idle' },
  { status: 'loading' },
  { status: 'error', message: '出错了' },
  { status: 'success', data: 1 },
];

// @ts-expect-error 加载中没有数据
const loadingWithData: LoadState<number> = { status: 'loading', data: 1 };
// @ts-expect-error 失败必须有原因
const errorWithoutMessage: LoadState<number> = { status: 'error' };
// @ts-expect-error 成功必须有数据
const successWithoutData: LoadState<number> = { status: 'success' };

console.log(ok, loadingWithData, errorWithoutMessage, successWithoutData);
```
:::

:::hint{level=1}
类型：四个对象类型用 `|` 连起来，每个都有一个字面量类型的 `status`（b09）。渲染：`switch (state.status)`，每个分支设置 `view.status.textContent`，需要时用 `view.results.replaceChildren(...)` 替换结果区域的内容（不传参数就是清空）。
:::

:::hint{level=2}
`aria-busy` 在 `switch` 之前统一设置：`view.results.setAttribute('aria-busy', String(state.status === 'loading'))`。`loading` 分支只改状态提示的文字，不动结果区域。重试按钮：`retry.addEventListener('click', onRetry)`。
:::

:::explanation
起始代码的 `{ isLoading, error, data }` 允许 `isLoading: true` 和 `error: '…'` 同时存在，渲染代码只能靠 `if` 的先后顺序“猜”该显示什么，而且它完全忘了处理错误。改成可辨识联合后：

- 每种状态只能带它自己的数据：加载中不可能有 `data`，失败一定有 `message`，类型测试检查的正是这些；
- 在 `switch` 的分支里，TypeScript 知道当前是哪种状态，`state.message`、`state.data` 都可以直接使用；
- `default` 分支的穷尽检查保证：以后加一种状态（例如“刷新中”），忘了渲染它就会编译失败。

**状态提示为什么要一直在页面上。** 屏幕阅读器只读出它已经在关注的区域里发生的变化。新插入一个带 `role="status"` 的元素、同时放进文字，很多读屏软件不会读出来（d09 讲过同样的规则）。所以状态提示的元素写在 HTML 里，之后只改变它的文字。`role="alert"` 不同：新插入的 alert 通常会被立即读出，错误信息可以随错误一起插入。“重试”按钮放在 alert 之外：alert 的全部内容都会被读出，按钮的文字会混在提示里；而且需要用户操作的内容不适合放进 alert（真正需要用户响应的提示，应该用 `role="alertdialog"` 的对话框）。

**`aria-busy` 放在哪里。** `aria-busy="true"` 告诉辅助技术“这块区域正在更新，先别读”。它只放在结果区域上：如果状态提示也在这块区域里，“正在加载…”本身也会被推迟。加载期间保留上一次的结果，并用样式（例如 `[aria-busy='true'] { opacity: 0.6; }`）表示它已经过时，是常见的做法。

“成功但没有数据”单独给出一句说明，避免用户面对一片空白不知所措。
:::

:::variant{kind=alt name=element-builder}
```ts file=render.ts
export type Book = { id: number; title: string };

export type LoadState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

export type BookView = { status: HTMLElement; results: HTMLElement };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', attrs: Record<string, string> = {}): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = text;
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
}

export function renderBooks({ status, results }: BookView, state: LoadState<Book[]>, onRetry: () => void): void {
  results.setAttribute('aria-busy', state.status === 'loading' ? 'true' : 'false');
  if (state.status === 'loading') {
    status.textContent = '正在加载…';
    return;
  }
  if (state.status === 'idle') {
    status.textContent = '';
    results.replaceChildren(el('p', '选择一个主题开始搜索。'));
  } else if (state.status === 'error') {
    status.textContent = '';
    const retry = el('button', '重试', { type: 'button' });
    retry.onclick = () => onRetry();
    results.replaceChildren(el('p', `加载失败：${state.message}`, { role: 'alert' }), retry);
  } else {
    status.textContent = state.data.length === 0 ? '没有找到相关的书。' : `找到 ${state.data.length} 本书`;
    const list = el('ul');
    list.append(...state.data.map((b) => el('li', b.title)));
    results.replaceChildren(...(state.data.length === 0 ? [] : [list]));
  }
}
```
:::

:::variant{kind=wrong name=optional-fields fails=types reason="状态用可选字段表示，不可能的组合仍然能写出来"}
```ts file=render.ts
export type Book = { id: number; title: string };

export type LoadState<T> = { status: 'idle' | 'loading' | 'error' | 'success'; message?: string; data?: T };

export type BookView = { status: HTMLElement; results: HTMLElement };

function paragraph(text: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.textContent = text;
  return p;
}

export function renderBooks(view: BookView, state: LoadState<Book[]>, onRetry: () => void): void {
  view.results.setAttribute('aria-busy', String(state.status === 'loading'));
  if (state.status === 'idle') {
    view.status.textContent = '';
    view.results.replaceChildren(paragraph('选择一个主题开始搜索。'));
  } else if (state.status === 'loading') {
    view.status.textContent = '正在加载…';
  } else if (state.status === 'error') {
    view.status.textContent = '';
    const alert = paragraph(`加载失败：${state.message ?? ''}`);
    alert.setAttribute('role', 'alert');
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = '重试';
    retry.addEventListener('click', onRetry);
    view.results.replaceChildren(alert, retry);
  } else {
    const data = state.data ?? [];
    view.status.textContent = data.length === 0 ? '没有找到相关的书。' : `找到 ${data.length} 本书`;
    const list = document.createElement('ul');
    for (const book of data) {
      const li = document.createElement('li');
      li.textContent = book.title;
      list.append(li);
    }
    if (data.length === 0) view.results.replaceChildren();
    else view.results.replaceChildren(list);
  }
}
```
:::

:::variant{kind=wrong name=status-inside-results fails=tests reason="每次渲染都在结果区域里新插入一个 role=status 的元素，读屏软件很可能不会读出"}
```ts file=render.ts
export type Book = { id: number; title: string };

export type LoadState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

export type BookView = { status: HTMLElement; results: HTMLElement };

function paragraph(text: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.textContent = text;
  return p;
}

export function renderBooks(view: BookView, state: LoadState<Book[]>, onRetry: () => void): void {
  const status = (text: string): HTMLParagraphElement => {
    const p = paragraph(text);
    p.setAttribute('role', 'status');
    return p;
  };
  view.results.setAttribute('aria-busy', String(state.status === 'loading'));
  switch (state.status) {
    case 'idle':
      view.results.replaceChildren(paragraph('选择一个主题开始搜索。'));
      return;
    case 'loading':
      view.results.replaceChildren(status('正在加载…'));
      return;
    case 'error': {
      const alert = paragraph(`加载失败：${state.message}`);
      alert.setAttribute('role', 'alert');
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = '重试';
      retry.addEventListener('click', onRetry);
      view.results.replaceChildren(alert, retry);
      return;
    }
    case 'success': {
      if (state.data.length === 0) {
        view.results.replaceChildren(status('没有找到相关的书。'));
        return;
      }
      const list = document.createElement('ul');
      for (const book of state.data) {
        const li = document.createElement('li');
        li.textContent = book.title;
        list.append(li);
      }
      view.results.replaceChildren(status(`找到 ${state.data.length} 本书`), list);
    }
  }
}
```
:::

:::variant{kind=wrong name=empty-as-list fails=tests reason="没有数据时渲染了一个空列表，没有给出说明"}
```ts file=render.ts
export type Book = { id: number; title: string };

export type LoadState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

export type BookView = { status: HTMLElement; results: HTMLElement };

function paragraph(text: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.textContent = text;
  return p;
}

export function renderBooks(view: BookView, state: LoadState<Book[]>, onRetry: () => void): void {
  view.results.setAttribute('aria-busy', String(state.status === 'loading'));
  switch (state.status) {
    case 'idle':
      view.status.textContent = '';
      view.results.replaceChildren(paragraph('选择一个主题开始搜索。'));
      return;
    case 'loading':
      view.status.textContent = '正在加载…';
      return;
    case 'error': {
      view.status.textContent = '';
      const alert = paragraph(`加载失败：${state.message}`);
      alert.setAttribute('role', 'alert');
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = '重试';
      retry.addEventListener('click', onRetry);
      view.results.replaceChildren(alert, retry);
      return;
    }
    case 'success': {
      const list = document.createElement('ul');
      for (const book of state.data) {
        const li = document.createElement('li');
        li.textContent = book.title;
        list.append(li);
      }
      view.status.textContent = `找到 ${state.data.length} 本书`;
      view.results.replaceChildren(list);
      return;
    }
  }
}
```
:::

:::variant{kind=wrong name=no-retry fails=tests reason="错误状态没有提供重试按钮"}
```ts file=render.ts
export type Book = { id: number; title: string };

export type LoadState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

export type BookView = { status: HTMLElement; results: HTMLElement };

function paragraph(text: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.textContent = text;
  return p;
}

export function renderBooks(view: BookView, state: LoadState<Book[]>, onRetry: () => void): void {
  view.results.setAttribute('aria-busy', String(state.status === 'loading'));
  switch (state.status) {
    case 'idle':
      view.status.textContent = '';
      view.results.replaceChildren(paragraph('选择一个主题开始搜索。'));
      return;
    case 'loading':
      view.status.textContent = '正在加载…';
      return;
    case 'error':
      view.status.textContent = '';
      view.results.replaceChildren(paragraph(`加载失败：${state.message}`));
      return;
    case 'success': {
      if (state.data.length === 0) {
        view.status.textContent = '没有找到相关的书。';
        view.results.replaceChildren();
        return;
      }
      const list = document.createElement('ul');
      for (const book of state.data) {
        const li = document.createElement('li');
        li.textContent = book.title;
        list.append(li);
      }
      view.status.textContent = `找到 ${state.data.length} 本书`;
      view.results.replaceChildren(list);
      return;
    }
  }
}
```
:::

:::variant{kind=wrong name=busy-never-reset fails=tests reason="只在加载时设置了 aria-busy，之后没有改回 false"}
```ts file=render.ts
export type Book = { id: number; title: string };

export type LoadState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

export type BookView = { status: HTMLElement; results: HTMLElement };

function paragraph(text: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.textContent = text;
  return p;
}

export function renderBooks(view: BookView, state: LoadState<Book[]>, onRetry: () => void): void {
  switch (state.status) {
    case 'idle':
      view.status.textContent = '';
      view.results.replaceChildren(paragraph('选择一个主题开始搜索。'));
      return;
    case 'loading':
      view.status.textContent = '正在加载…';
      view.results.setAttribute('aria-busy', 'true');
      return;
    case 'error': {
      view.status.textContent = '';
      const alert = paragraph(`加载失败：${state.message}`);
      alert.setAttribute('role', 'alert');
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = '重试';
      retry.addEventListener('click', onRetry);
      view.results.replaceChildren(alert, retry);
      return;
    }
    case 'success': {
      if (state.data.length === 0) {
        view.status.textContent = '没有找到相关的书。';
        view.results.replaceChildren();
        return;
      }
      const list = document.createElement('ul');
      for (const book of state.data) {
        const li = document.createElement('li');
        li.textContent = book.title;
        list.append(li);
      }
      view.status.textContent = `找到 ${state.data.length} 本书`;
      view.results.replaceChildren(list);
      return;
    }
  }
}
```
:::
