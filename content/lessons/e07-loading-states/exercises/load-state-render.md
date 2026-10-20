---
kind: task
title: 用可辨识联合渲染加载状态
---
起始代码用三个独立的字段（`isLoading`、`error`、`data`）表示加载状态。在 `render.ts` 中：

1. 把 `LoadState<T>` 改成可辨识联合，四种状态分别是：`{ status: 'idle' }`、`{ status: 'loading' }`、`{ status: 'error'; message: string }`、`{ status: 'success'; data: T }`；
2. 实现 `renderBooks(container, state, onRetry)`，**替换** `container` 的内容：

| 状态 | 渲染 |
| --- | --- |
| `idle` | `<p>选择一个主题开始搜索。</p>` |
| `loading` | `<p role="status">正在加载…</p>` |
| `error` | `<div role="alert">`，里面是 `<p>加载失败：错误信息</p>` 和一个“重试”按钮（`type="button"`），点击时调用 `onRetry` |
| `success`，没有数据 | `<p role="status">没有找到相关的书。</p>` |
| `success`，有数据 | `<p role="status">找到 N 本书</p>`，后面是 `<ul>`，每本书一个 `<li>`，内容是书名 |

3. `container` 的 `aria-busy` 在加载中时为 `"true"`，其他时候为 `"false"`。

书名中的特殊字符要原样显示（用 `textContent`）。

:::files{role=starter}
```ts file=render.ts
export type Book = { id: number; title: string };

// TODO：改成可辨识联合
export type LoadState<T> = { isLoading: boolean; error: string | null; data: T | null };

export function renderBooks(container: HTMLElement, state: LoadState<Book[]>, onRetry: () => void): void {
  if (state.isLoading) {
    container.textContent = '正在加载…';
  } else if (state.data) {
    container.innerHTML = state.data.map((b) => `<li>${b.title}</li>`).join('');
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

function paragraph(text: string, role?: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.textContent = text;
  if (role !== undefined) p.setAttribute('role', role);
  return p;
}

export function renderBooks(container: HTMLElement, state: LoadState<Book[]>, onRetry: () => void): void {
  container.setAttribute('aria-busy', String(state.status === 'loading'));
  switch (state.status) {
    case 'idle':
      container.replaceChildren(paragraph('选择一个主题开始搜索。'));
      return;
    case 'loading':
      container.replaceChildren(paragraph('正在加载…', 'status'));
      return;
    case 'error': {
      const alert = document.createElement('div');
      alert.setAttribute('role', 'alert');
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = '重试';
      retry.addEventListener('click', onRetry);
      alert.append(paragraph(`加载失败：${state.message}`), retry);
      container.replaceChildren(alert);
      return;
    }
    case 'success': {
      if (state.data.length === 0) {
        container.replaceChildren(paragraph('没有找到相关的书。', 'status'));
        return;
      }
      const list = document.createElement('ul');
      for (const book of state.data) {
        const li = document.createElement('li');
        li.textContent = book.title;
        list.append(li);
      }
      container.replaceChildren(paragraph(`找到 ${state.data.length} 本书`, 'status'), list);
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
import { renderBooks } from './render';

let container: HTMLElement;
const noop = () => {};

beforeEach(() => {
  container = document.createElement('section');
  document.body.append(container);
});

test('idle', () => {
  renderBooks(container, { status: 'idle' }, noop);
  expect(container).toHaveTextContent('选择一个主题开始搜索。');
  expect(container).toHaveAttribute('aria-busy', 'false');
});

test('loading', () => {
  renderBooks(container, { status: 'loading' }, noop);
  expect(within(container).getByRole('status')).toHaveTextContent('正在加载…');
  expect(container).toHaveAttribute('aria-busy', 'true');
});

test('error：显示原因，重试按钮调用 onRetry', async () => {
  const onRetry = vi.fn();
  renderBooks(container, { status: 'error', message: '服务器出错' }, onRetry);
  const alert = within(container).getByRole('alert');
  expect(alert).toHaveTextContent('加载失败：服务器出错');
  await userEvent.setup().click(within(alert).getByRole('button', { name: '重试' }));
  expect(onRetry).toHaveBeenCalledTimes(1);
  expect(container).toHaveAttribute('aria-busy', 'false');
});

test('success：没有数据', () => {
  renderBooks(container, { status: 'success', data: [] }, noop);
  expect(within(container).getByRole('status')).toHaveTextContent('没有找到相关的书。');
  expect(within(container).queryByRole('list')).toBeNull();
});

test('success：书名列表，特殊字符原样显示', () => {
  renderBooks(container, { status: 'success', data: [{ id: 1, title: '<b>TS</b> 入门' }, { id: 2, title: '深入 DOM' }] }, noop);
  expect(within(container).getByRole('status')).toHaveTextContent('找到 2 本书');
  const items = within(container).getAllByRole('listitem');
  expect(items.map((li) => li.textContent)).toEqual(['<b>TS</b> 入门', '深入 DOM']);
  expect(container.querySelector('b')).toBeNull();
});

test('每次渲染都替换原来的内容', () => {
  renderBooks(container, { status: 'loading' }, noop);
  renderBooks(container, { status: 'success', data: [{ id: 1, title: 'A' }] }, noop);
  expect(within(container).getAllByRole('status')).toHaveLength(1);
  expect(container).not.toHaveTextContent('正在加载');
  expect(container).toHaveAttribute('aria-busy', 'false');
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
类型：四个对象类型用 `|` 连起来，每个都有一个字面量类型的 `status`（b09）。渲染：`switch (state.status)`，每个分支创建需要的元素，用 `container.replaceChildren(...)` 替换内容。
:::

:::hint{level=2}
写一个小工具 `paragraph(text, role?)` 创建 `<p>`，需要时用 `setAttribute('role', role)` 加上角色。重试按钮：`retry.addEventListener('click', onRetry)`。`aria-busy` 在 `switch` 之前统一设置：`container.setAttribute('aria-busy', String(state.status === 'loading'))`。
:::

:::explanation
起始代码的 `{ isLoading, error, data }` 允许 `isLoading: true` 和 `error: '…'` 同时存在，渲染代码只能靠 `if` 的先后顺序“猜”该显示什么，而且它完全忘了处理错误。改成可辨识联合后：

- 每种状态只能带它自己的数据：加载中不可能有 `data`，失败一定有 `message`，类型测试检查的正是这些；
- 在 `switch` 的分支里，TypeScript 知道当前是哪种状态，`state.message`、`state.data` 都可以直接使用；
- `default` 分支的穷尽检查保证：以后加一种状态（例如“刷新中”），忘了渲染它就会编译失败。

“成功但没有数据”单独显示一句说明，避免用户面对一片空白不知所措。`role="status"` 的提示会被屏幕阅读器读出，`role="alert"` 用于需要立即注意的错误。
:::

:::variant{kind=alt name=element-builder}
```ts file=render.ts
export type Book = { id: number; title: string };

export type LoadState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', attrs: Record<string, string> = {}): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = text;
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
}

export function renderBooks(container: HTMLElement, state: LoadState<Book[]>, onRetry: () => void): void {
  container.setAttribute('aria-busy', state.status === 'loading' ? 'true' : 'false');
  if (state.status === 'idle') {
    container.replaceChildren(el('p', '选择一个主题开始搜索。'));
  } else if (state.status === 'loading') {
    container.replaceChildren(el('p', '正在加载…', { role: 'status' }));
  } else if (state.status === 'error') {
    const box = el('div', '', { role: 'alert' });
    const retry = el('button', '重试', { type: 'button' });
    retry.onclick = () => onRetry();
    box.append(el('p', `加载失败：${state.message}`), retry);
    container.replaceChildren(box);
  } else if (state.data.length === 0) {
    container.replaceChildren(el('p', '没有找到相关的书。', { role: 'status' }));
  } else {
    const list = el('ul');
    list.append(...state.data.map((b) => el('li', b.title)));
    container.replaceChildren(el('p', `找到 ${state.data.length} 本书`, { role: 'status' }), list);
  }
}
```
:::

:::variant{kind=wrong name=optional-fields fails=types reason="状态用可选字段表示，不可能的组合仍然能写出来"}
```ts file=render.ts
export type Book = { id: number; title: string };

export type LoadState<T> = { status: 'idle' | 'loading' | 'error' | 'success'; message?: string; data?: T };

function paragraph(text: string, role?: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.textContent = text;
  if (role !== undefined) p.setAttribute('role', role);
  return p;
}

export function renderBooks(container: HTMLElement, state: LoadState<Book[]>, onRetry: () => void): void {
  container.setAttribute('aria-busy', String(state.status === 'loading'));
  if (state.status === 'idle') container.replaceChildren(paragraph('选择一个主题开始搜索。'));
  else if (state.status === 'loading') container.replaceChildren(paragraph('正在加载…', 'status'));
  else if (state.status === 'error') {
    const alert = document.createElement('div');
    alert.setAttribute('role', 'alert');
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = '重试';
    retry.addEventListener('click', onRetry);
    alert.append(paragraph(`加载失败：${state.message ?? ''}`), retry);
    container.replaceChildren(alert);
  } else {
    const data = state.data ?? [];
    if (data.length === 0) {
      container.replaceChildren(paragraph('没有找到相关的书。', 'status'));
      return;
    }
    const list = document.createElement('ul');
    for (const book of data) {
      const li = document.createElement('li');
      li.textContent = book.title;
      list.append(li);
    }
    container.replaceChildren(paragraph(`找到 ${data.length} 本书`, 'status'), list);
  }
}
```
:::

:::variant{kind=wrong name=empty-as-list fails=tests reason="没有数据时渲染了一个空列表，用户看到一片空白"}
```ts file=render.ts
export type Book = { id: number; title: string };

export type LoadState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

function paragraph(text: string, role?: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.textContent = text;
  if (role !== undefined) p.setAttribute('role', role);
  return p;
}

export function renderBooks(container: HTMLElement, state: LoadState<Book[]>, onRetry: () => void): void {
  container.setAttribute('aria-busy', String(state.status === 'loading'));
  switch (state.status) {
    case 'idle':
      container.replaceChildren(paragraph('选择一个主题开始搜索。'));
      return;
    case 'loading':
      container.replaceChildren(paragraph('正在加载…', 'status'));
      return;
    case 'error': {
      const alert = document.createElement('div');
      alert.setAttribute('role', 'alert');
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = '重试';
      retry.addEventListener('click', onRetry);
      alert.append(paragraph(`加载失败：${state.message}`), retry);
      container.replaceChildren(alert);
      return;
    }
    case 'success': {
      const list = document.createElement('ul');
      for (const book of state.data) {
        const li = document.createElement('li');
        li.textContent = book.title;
        list.append(li);
      }
      container.replaceChildren(paragraph(`找到 ${state.data.length} 本书`, 'status'), list);
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

function paragraph(text: string, role?: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.textContent = text;
  if (role !== undefined) p.setAttribute('role', role);
  return p;
}

export function renderBooks(container: HTMLElement, state: LoadState<Book[]>, onRetry: () => void): void {
  container.setAttribute('aria-busy', String(state.status === 'loading'));
  switch (state.status) {
    case 'idle':
      container.replaceChildren(paragraph('选择一个主题开始搜索。'));
      return;
    case 'loading':
      container.replaceChildren(paragraph('正在加载…', 'status'));
      return;
    case 'error':
      container.replaceChildren(paragraph(`加载失败：${state.message}`, 'alert'));
      return;
    case 'success': {
      if (state.data.length === 0) {
        container.replaceChildren(paragraph('没有找到相关的书。', 'status'));
        return;
      }
      const list = document.createElement('ul');
      for (const book of state.data) {
        const li = document.createElement('li');
        li.textContent = book.title;
        list.append(li);
      }
      container.replaceChildren(paragraph(`找到 ${state.data.length} 本书`, 'status'), list);
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

function paragraph(text: string, role?: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.textContent = text;
  if (role !== undefined) p.setAttribute('role', role);
  return p;
}

export function renderBooks(container: HTMLElement, state: LoadState<Book[]>, onRetry: () => void): void {
  switch (state.status) {
    case 'idle':
      container.replaceChildren(paragraph('选择一个主题开始搜索。'));
      return;
    case 'loading':
      container.setAttribute('aria-busy', 'true');
      container.replaceChildren(paragraph('正在加载…', 'status'));
      return;
    case 'error': {
      const alert = document.createElement('div');
      alert.setAttribute('role', 'alert');
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = '重试';
      retry.addEventListener('click', onRetry);
      alert.append(paragraph(`加载失败：${state.message}`), retry);
      container.replaceChildren(alert);
      return;
    }
    case 'success': {
      if (state.data.length === 0) {
        container.replaceChildren(paragraph('没有找到相关的书。', 'status'));
        return;
      }
      const list = document.createElement('ul');
      for (const book of state.data) {
        const li = document.createElement('li');
        li.textContent = book.title;
        list.append(li);
      }
      container.replaceChildren(paragraph(`找到 ${state.data.length} 本书`, 'status'), list);
    }
  }
}
```
:::
