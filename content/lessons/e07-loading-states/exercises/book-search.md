---
kind: challenge
title: 区分失败原因的图书搜索
fixtures: quick
---
`render.ts`（只读）提供了小任务中的 `LoadState` 和 `renderBooks`。在 `main.ts` 中完成搜索流程：

1. 提交表单（阻止默认行为）时，请求 `/api/books?topic=主题`（主题来自 `#topic`，用 `encodeURIComponent` 编码），状态依次经过 `loading` 和最终状态，每次状态改变都调用 `renderBooks(view, state, 重试函数)`（`view` 已经准备好）；
2. 加载期间，“搜索”按钮的 `aria-disabled` 为 `"true"`，并且**忽略**这期间的提交和重试；结束后改回 `"false"`。不要设置 `disabled`：它会让按钮失去焦点；
3. 响应的数据必须是数组，每一项是 `{ id: number, title: string }`，任何一项不合格都算作数据格式不正确。验证通过就进入 `success`；
4. 失败时进入 `error`，`message` 按原因区分：

| 原因 | message |
| --- | --- |
| `fetch` 被拒绝（网络失败） | `网络连接失败，请检查网络后重试` |
| 状态码 500–599 | `服务器暂时出了问题，请稍后重试（状态码 500）`（数字换成实际的状态码） |
| 其他非 2xx 状态码 | `请求失败（状态码 404）` |
| 数据不是合法的 JSON，或者没有通过验证 | `数据格式不正确` |

5. 点击“重试”时，用**上一次请求的主题**重新请求（即使下拉框已经改了）；
6. 页面加载后先渲染 `idle` 状态。

下拉框中的每个主题都对应一种模拟的响应：成功、空结果、500、404、网络失败、不是数组、返回了 HTML 网页、数组中有一项不合格。

:::files{role=support}
```html file=index.html readonly
<!doctype html>
<html lang="zh-CN">
  <body>
    <form id="search">
      <label for="topic">主题</label>
      <select id="topic">
        <option value="typescript">TypeScript</option>
        <option value="cobol">COBOL</option>
        <option value="broken">服务器出错</option>
        <option value="missing">找不到</option>
        <option value="offline">网络断开</option>
        <option value="weird">格式错误</option>
        <option value="html">返回了网页</option>
        <option value="bad-item">有不合格的项</option>
      </select>
      <button>搜索</button>
    </form>
    <p id="status" role="status"></p>
    <section id="results"></section>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=render.ts readonly
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
      const alert = document.createElement('div');
      alert.setAttribute('role', 'alert');
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = '重试';
      retry.addEventListener('click', onRetry);
      alert.append(paragraph(`加载失败：${state.message}`), retry);
      view.results.replaceChildren(alert);
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

:::files{role=starter}
```ts file=main.ts
import { renderBooks, type Book, type LoadState } from './render';

const form = document.querySelector('#search');
const topic = document.querySelector('#topic');
const statusLine = document.querySelector('#status');
const results = document.querySelector('#results');
const button = form?.querySelector('button');
if (
  !(form instanceof HTMLFormElement) ||
  !(topic instanceof HTMLSelectElement) ||
  !(statusLine instanceof HTMLElement) ||
  !(results instanceof HTMLElement) ||
  !button
) {
  throw new Error('页面结构不完整');
}
const view = { status: statusLine, results };

// TODO：状态、加载流程、错误分类、重试
```
:::

:::files{role=solution}
```ts file=main.ts
import { renderBooks, type Book, type LoadState } from './render';

const form = document.querySelector('#search');
const topic = document.querySelector('#topic');
const statusLine = document.querySelector('#status');
const results = document.querySelector('#results');
const button = form?.querySelector('button');
if (
  !(form instanceof HTMLFormElement) ||
  !(topic instanceof HTMLSelectElement) ||
  !(statusLine instanceof HTMLElement) ||
  !(results instanceof HTMLElement) ||
  !button
) {
  throw new Error('页面结构不完整');
}
const view = { status: statusLine, results };

class LoadError extends Error {}

function parseBooks(value: unknown): Book[] {
  if (!Array.isArray(value)) throw new LoadError('数据格式不正确');
  return value.map((item: unknown) => {
    if (typeof item !== 'object' || item === null || !('id' in item) || !('title' in item)) {
      throw new LoadError('数据格式不正确');
    }
    const { id, title } = item;
    if (typeof id !== 'number' || typeof title !== 'string') throw new LoadError('数据格式不正确');
    return { id, title };
  });
}

async function fetchBooks(topicValue: string): Promise<Book[]> {
  let response: Response;
  try {
    response = await fetch(`/api/books?topic=${encodeURIComponent(topicValue)}`);
  } catch {
    throw new LoadError('网络连接失败，请检查网络后重试');
  }
  if (response.status >= 500) throw new LoadError(`服务器暂时出了问题，请稍后重试（状态码 ${response.status}）`);
  if (!response.ok) throw new LoadError(`请求失败（状态码 ${response.status}）`);
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new LoadError('数据格式不正确');
  }
  return parseBooks(data);
}

let state: LoadState<Book[]> = { status: 'idle' };
let lastTopic = topic.value;

const setState = (next: LoadState<Book[]>): void => {
  state = next;
  button.setAttribute('aria-disabled', String(next.status === 'loading'));
  renderBooks(view, next, () => void load(lastTopic));
};

const load = async (topicValue: string): Promise<void> => {
  if (state.status === 'loading') return;
  lastTopic = topicValue;
  setState({ status: 'loading' });
  try {
    setState({ status: 'success', data: await fetchBooks(topicValue) });
  } catch (err) {
    setState({ status: 'error', message: err instanceof LoadError ? err.message : '发生了未知错误' });
  }
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void load(topic.value);
});

setState({ status: 'idle' });
```
:::

:::files{role=tests}
```ts file=search.test.ts
import { expect, test, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

async function search(topic: string) {
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText('主题'), topic);
  await user.click(screen.getByRole('button', { name: '搜索' }));
}

/** 等到这一次加载结束（结果区域不再忙） */
async function settled() {
  await waitFor(() => expect(document.querySelector('#results')).toHaveAttribute('aria-busy', 'false'));
}

async function errorMessage(): Promise<string> {
  const alert = await screen.findByRole('alert');
  return alert.querySelector('p')?.textContent ?? '';
}

test('页面加载后是 idle 状态', () => {
  expect(screen.getByText('选择一个主题开始搜索。')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '搜索' })).toHaveAttribute('aria-disabled', 'false');
});

test('加载中显示状态，完成后显示结果；状态提示是页面上原有的元素', async () => {
  await search('typescript');
  expect(screen.getByRole('status')).toHaveTextContent('正在加载…');
  expect(await screen.findByText('找到 2 本书')).toBe(document.querySelector('#status'));
  expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Effective TypeScript', 'Programming TypeScript']);
});

test('加载期间按钮标记为不可用、保留焦点，再次提交被忽略', async () => {
  const fetchSpy = vi.spyOn(window, 'fetch');
  const user = userEvent.setup();
  const button = screen.getByRole('button', { name: '搜索' });
  await user.click(button);
  expect(button).toHaveAttribute('aria-disabled', 'true');
  expect(button).toBeEnabled();
  expect(document.activeElement).toBe(button);
  await user.click(button);
  await user.keyboard('{Enter}');
  await settled();
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  expect(button).toHaveAttribute('aria-disabled', 'false');
});

test('空结果', async () => {
  await search('cobol');
  expect(await screen.findByText('没有找到相关的书。')).toBeInTheDocument();
});

test('服务器出错（5xx）', async () => {
  await search('broken');
  expect(await errorMessage()).toBe('加载失败：服务器暂时出了问题，请稍后重试（状态码 500）');
});

test('其他非 2xx 状态码', async () => {
  await search('missing');
  expect(await errorMessage()).toBe('加载失败：请求失败（状态码 404）');
});

test('网络失败', async () => {
  await search('offline');
  expect(await errorMessage()).toBe('加载失败：网络连接失败，请检查网络后重试');
});

test('数据格式不正确：不是数组、不是 JSON、有不合格的项', async () => {
  for (const topic of ['weird', 'html', 'bad-item']) {
    await search(topic);
    await settled();
    expect(await errorMessage(), topic).toBe('加载失败：数据格式不正确');
  }
});

test('重试使用上一次请求的主题', async () => {
  const user = userEvent.setup();
  await search('offline');
  const alert = await screen.findByRole('alert');
  await user.selectOptions(screen.getByLabelText('主题'), 'typescript');
  await user.click(within(alert).getByRole('button', { name: '重试' }));
  expect(screen.getByRole('status')).toHaveTextContent('正在加载…');
  await settled();
  expect(await errorMessage()).toBe('加载失败：网络连接失败，请检查网络后重试');
});
```
:::

:::hint{level=1}
把流程拆成几个函数：`fetchBooks(topic)` 负责请求、分类错误和验证数据，失败时抛出一个带有**给用户看的消息**的错误；`load(topic)` 负责状态：加载中就直接返回，否则先 `loading`，然后根据 `fetchBooks` 的结果进入 `success` 或 `error`；`setState(state)` 负责记住当前状态、同步按钮的 `aria-disabled` 和调用 `renderBooks`。
:::

:::hint{level=2}
可以定义一个 `class LoadError extends Error {}`，所有已知的失败都抛出它，`load` 的 `catch` 里用 `instanceof LoadError` 取出消息。网络失败要单独用 `try/catch` 包住 `fetch`；`response.json()` 的 `SyntaxError` 也要包住，归为“数据格式不正确”。验证每一项时构造新的 `{ id, title }`，顺便丢掉多余的字段。重试函数可以写成 `() => void load(lastTopic)`：这里的 `void` 是一个**运算符**（不是 b06 讲的 `void` 类型），它计算后面的表达式并丢弃结果，表示“有意不等待这个 Promise”。
:::

:::explanation
这道题把前面几课串了起来：`fetch` 的两类失败（e05）、运行时验证（e06）、可辨识联合的状态和渲染（本课）。

代码按职责分成了三层：

- `fetchBooks`：只关心数据。它把各种底层错误（`TypeError`、状态码、`SyntaxError`、验证失败）**翻译**成一个面向用户的 `LoadError`；
- `load`：只关心状态的流转：`loading` → `success` 或 `error`；
- `setState`：只关心界面：按钮的状态、调用 `renderBooks`。

“翻译”错误这一步很重要：底层的错误信息（例如 `Failed to fetch`、`Unexpected token`）对用户没有意义，而且可能暴露实现细节。用户需要的是“发生了什么、我能做什么”。

**为什么用 `aria-disabled` 而不是 `disabled`。** 用户点击“搜索”（或者在按钮上按回车）时，焦点就在按钮上。设置 `disabled` 之后，浏览器会把焦点从按钮上移走，落到 `<body>` 上，键盘和读屏用户会失去当前的位置。`aria-disabled="true"` 只告诉辅助技术“现在不可用”，焦点保留在原处；但它不会阻止点击，所以 `load` 开头要自己检查状态，忽略重复的提交。

重试使用上一次请求的主题，而不是下拉框当前的值：用户点击的是“重试刚才失败的请求”。`load` 内部已经处理了所有错误，`void load(...)` 不会产生未处理的拒绝。
:::

:::variant{kind=alt name=result-based}
```ts file=main.ts
import { renderBooks, type Book, type LoadState } from './render';

const form = document.querySelector('#search');
const topic = document.querySelector('#topic');
const statusLine = document.querySelector('#status');
const results = document.querySelector('#results');
const button = form?.querySelector('button');
if (
  !(form instanceof HTMLFormElement) ||
  !(topic instanceof HTMLSelectElement) ||
  !(statusLine instanceof HTMLElement) ||
  !(results instanceof HTMLElement) ||
  !button
) {
  throw new Error('页面结构不完整');
}
const view = { status: statusLine, results };

type Outcome = { ok: true; books: Book[] } | { ok: false; message: string };

function toBooks(value: unknown): Book[] | null {
  if (!Array.isArray(value)) return null;
  const books: Book[] = [];
  for (const item of value) {
    const v: unknown = item;
    if (typeof v !== 'object' || v === null) return null;
    const id = 'id' in v ? v.id : undefined;
    const title = 'title' in v ? v.title : undefined;
    if (typeof id !== 'number' || typeof title !== 'string') return null;
    books.push({ id, title });
  }
  return books;
}

async function request(t: string): Promise<Outcome> {
  const response = await fetch(`/api/books?topic=${encodeURIComponent(t)}`).catch(() => null);
  if (response === null) return { ok: false, message: '网络连接失败，请检查网络后重试' };
  if (response.status >= 500) return { ok: false, message: `服务器暂时出了问题，请稍后重试（状态码 ${response.status}）` };
  if (!response.ok) return { ok: false, message: `请求失败（状态码 ${response.status}）` };
  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, message: '数据格式不正确' };
  }
  const books = toBooks(parsed);
  return books ? { ok: true, books } : { ok: false, message: '数据格式不正确' };
}

let previous = '';
let busy = false;

function show(state: LoadState<Book[]>): void {
  busy = state.status === 'loading';
  button?.setAttribute('aria-disabled', busy ? 'true' : 'false');
  renderBooks(view, state, () => {
    void run(previous);
  });
}

async function run(t: string): Promise<void> {
  if (busy) return;
  previous = t;
  show({ status: 'loading' });
  const outcome = await request(t);
  show(outcome.ok ? { status: 'success', data: outcome.books } : { status: 'error', message: outcome.message });
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void run(topic.value);
});
show({ status: 'idle' });
```
:::

:::variant{kind=wrong name=no-error-classification fails=tests reason="所有失败都显示同一句消息，没有区分原因"}
```ts file=main.ts
import { renderBooks, type Book, type LoadState } from './render';

const form = document.querySelector('#search');
const topic = document.querySelector('#topic');
const statusLine = document.querySelector('#status');
const results = document.querySelector('#results');
const button = form?.querySelector('button');
if (
  !(form instanceof HTMLFormElement) ||
  !(topic instanceof HTMLSelectElement) ||
  !(statusLine instanceof HTMLElement) ||
  !(results instanceof HTMLElement) ||
  !button
) {
  throw new Error('页面结构不完整');
}
const view = { status: statusLine, results };

let state: LoadState<Book[]> = { status: 'idle' };
let lastTopic = topic.value;

const setState = (next: LoadState<Book[]>): void => {
  state = next;
  button.setAttribute('aria-disabled', String(next.status === 'loading'));
  renderBooks(view, next, () => void load(lastTopic));
};

const load = async (topicValue: string): Promise<void> => {
  if (state.status === 'loading') return;
  lastTopic = topicValue;
  setState({ status: 'loading' });
  try {
    const response = await fetch(`/api/books?topic=${encodeURIComponent(topicValue)}`);
    if (!response.ok) throw new Error('bad status');
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error('bad data');
    const books: Book[] = data.flatMap((item: unknown) =>
      typeof item === 'object' && item !== null && 'id' in item && 'title' in item && typeof item.id === 'number' && typeof item.title === 'string'
        ? [{ id: item.id, title: item.title }]
        : [],
    );
    setState({ status: 'success', data: books });
  } catch {
    setState({ status: 'error', message: '出错了，请重试' });
  }
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void load(topic.value);
});

setState({ status: 'idle' });
```
:::

:::variant{kind=wrong name=shallow-validation fails=tests reason="只检查了是不是数组，没有逐项验证"}
```ts file=main.ts
import { renderBooks, type Book, type LoadState } from './render';

const form = document.querySelector('#search');
const topic = document.querySelector('#topic');
const statusLine = document.querySelector('#status');
const results = document.querySelector('#results');
const button = form?.querySelector('button');
if (
  !(form instanceof HTMLFormElement) ||
  !(topic instanceof HTMLSelectElement) ||
  !(statusLine instanceof HTMLElement) ||
  !(results instanceof HTMLElement) ||
  !button
) {
  throw new Error('页面结构不完整');
}
const view = { status: statusLine, results };

class LoadError extends Error {}

async function fetchBooks(topicValue: string): Promise<Book[]> {
  let response: Response;
  try {
    response = await fetch(`/api/books?topic=${encodeURIComponent(topicValue)}`);
  } catch {
    throw new LoadError('网络连接失败，请检查网络后重试');
  }
  if (response.status >= 500) throw new LoadError(`服务器暂时出了问题，请稍后重试（状态码 ${response.status}）`);
  if (!response.ok) throw new LoadError(`请求失败（状态码 ${response.status}）`);
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new LoadError('数据格式不正确');
  }
  if (!Array.isArray(data)) throw new LoadError('数据格式不正确');
  return data;
}

let state: LoadState<Book[]> = { status: 'idle' };
let lastTopic = topic.value;

const setState = (next: LoadState<Book[]>): void => {
  state = next;
  button.setAttribute('aria-disabled', String(next.status === 'loading'));
  renderBooks(view, next, () => void load(lastTopic));
};

const load = async (topicValue: string): Promise<void> => {
  if (state.status === 'loading') return;
  lastTopic = topicValue;
  setState({ status: 'loading' });
  try {
    setState({ status: 'success', data: await fetchBooks(topicValue) });
  } catch (err) {
    setState({ status: 'error', message: err instanceof LoadError ? err.message : '发生了未知错误' });
  }
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void load(topic.value);
});

setState({ status: 'idle' });
```
:::

:::variant{kind=wrong name=uses-disabled fails=tests reason="用 disabled 禁用按钮，焦点丢失"}
```ts file=main.ts
import { renderBooks, type Book, type LoadState } from './render';

const form = document.querySelector('#search');
const topic = document.querySelector('#topic');
const statusLine = document.querySelector('#status');
const results = document.querySelector('#results');
const button = form?.querySelector('button');
if (
  !(form instanceof HTMLFormElement) ||
  !(topic instanceof HTMLSelectElement) ||
  !(statusLine instanceof HTMLElement) ||
  !(results instanceof HTMLElement) ||
  !button
) {
  throw new Error('页面结构不完整');
}
const view = { status: statusLine, results };

class LoadError extends Error {}

function parseBooks(value: unknown): Book[] {
  if (!Array.isArray(value)) throw new LoadError('数据格式不正确');
  return value.map((item: unknown) => {
    if (typeof item !== 'object' || item === null || !('id' in item) || !('title' in item)) {
      throw new LoadError('数据格式不正确');
    }
    const { id, title } = item;
    if (typeof id !== 'number' || typeof title !== 'string') throw new LoadError('数据格式不正确');
    return { id, title };
  });
}

async function fetchBooks(topicValue: string): Promise<Book[]> {
  let response: Response;
  try {
    response = await fetch(`/api/books?topic=${encodeURIComponent(topicValue)}`);
  } catch {
    throw new LoadError('网络连接失败，请检查网络后重试');
  }
  if (response.status >= 500) throw new LoadError(`服务器暂时出了问题，请稍后重试（状态码 ${response.status}）`);
  if (!response.ok) throw new LoadError(`请求失败（状态码 ${response.status}）`);
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new LoadError('数据格式不正确');
  }
  return parseBooks(data);
}

let lastTopic = topic.value;

const setState = (next: LoadState<Book[]>): void => {
  button.disabled = next.status === 'loading';
  renderBooks(view, next, () => void load(lastTopic));
};

const load = async (topicValue: string): Promise<void> => {
  lastTopic = topicValue;
  setState({ status: 'loading' });
  try {
    setState({ status: 'success', data: await fetchBooks(topicValue) });
  } catch (err) {
    setState({ status: 'error', message: err instanceof LoadError ? err.message : '发生了未知错误' });
  }
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void load(topic.value);
});

setState({ status: 'idle' });
```
:::

:::variant{kind=wrong name=no-duplicate-guard fails=tests reason="按钮标记为不可用，但加载期间的提交没有被忽略"}
```ts file=main.ts
import { renderBooks, type Book, type LoadState } from './render';

const form = document.querySelector('#search');
const topic = document.querySelector('#topic');
const statusLine = document.querySelector('#status');
const results = document.querySelector('#results');
const button = form?.querySelector('button');
if (
  !(form instanceof HTMLFormElement) ||
  !(topic instanceof HTMLSelectElement) ||
  !(statusLine instanceof HTMLElement) ||
  !(results instanceof HTMLElement) ||
  !button
) {
  throw new Error('页面结构不完整');
}
const view = { status: statusLine, results };

class LoadError extends Error {}

function parseBooks(value: unknown): Book[] {
  if (!Array.isArray(value)) throw new LoadError('数据格式不正确');
  return value.map((item: unknown) => {
    if (typeof item !== 'object' || item === null || !('id' in item) || !('title' in item)) {
      throw new LoadError('数据格式不正确');
    }
    const { id, title } = item;
    if (typeof id !== 'number' || typeof title !== 'string') throw new LoadError('数据格式不正确');
    return { id, title };
  });
}

async function fetchBooks(topicValue: string): Promise<Book[]> {
  let response: Response;
  try {
    response = await fetch(`/api/books?topic=${encodeURIComponent(topicValue)}`);
  } catch {
    throw new LoadError('网络连接失败，请检查网络后重试');
  }
  if (response.status >= 500) throw new LoadError(`服务器暂时出了问题，请稍后重试（状态码 ${response.status}）`);
  if (!response.ok) throw new LoadError(`请求失败（状态码 ${response.status}）`);
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new LoadError('数据格式不正确');
  }
  return parseBooks(data);
}

let state: LoadState<Book[]> = { status: 'idle' };
let lastTopic = topic.value;

const setState = (next: LoadState<Book[]>): void => {
  state = next;
  button.setAttribute('aria-disabled', String(next.status === 'loading'));
  renderBooks(view, next, () => void load(lastTopic));
};

const load = async (topicValue: string): Promise<void> => {
  lastTopic = topicValue;
  setState({ status: 'loading' });
  try {
    setState({ status: 'success', data: await fetchBooks(topicValue) });
  } catch (err) {
    setState({ status: 'error', message: err instanceof LoadError ? err.message : '发生了未知错误' });
  }
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void load(topic.value);
});

setState({ status: 'idle' });
```
:::

:::variant{kind=wrong name=retry-current-select fails=tests reason="重试时读取了下拉框当前的值，而不是上一次请求的主题"}
```ts file=main.ts
import { renderBooks, type Book, type LoadState } from './render';

const form = document.querySelector('#search');
const topic = document.querySelector('#topic');
const statusLine = document.querySelector('#status');
const results = document.querySelector('#results');
const button = form?.querySelector('button');
if (
  !(form instanceof HTMLFormElement) ||
  !(topic instanceof HTMLSelectElement) ||
  !(statusLine instanceof HTMLElement) ||
  !(results instanceof HTMLElement) ||
  !button
) {
  throw new Error('页面结构不完整');
}
const view = { status: statusLine, results };

class LoadError extends Error {}

function parseBooks(value: unknown): Book[] {
  if (!Array.isArray(value)) throw new LoadError('数据格式不正确');
  return value.map((item: unknown) => {
    if (typeof item !== 'object' || item === null || !('id' in item) || !('title' in item)) {
      throw new LoadError('数据格式不正确');
    }
    const { id, title } = item;
    if (typeof id !== 'number' || typeof title !== 'string') throw new LoadError('数据格式不正确');
    return { id, title };
  });
}

async function fetchBooks(topicValue: string): Promise<Book[]> {
  let response: Response;
  try {
    response = await fetch(`/api/books?topic=${encodeURIComponent(topicValue)}`);
  } catch {
    throw new LoadError('网络连接失败，请检查网络后重试');
  }
  if (response.status >= 500) throw new LoadError(`服务器暂时出了问题，请稍后重试（状态码 ${response.status}）`);
  if (!response.ok) throw new LoadError(`请求失败（状态码 ${response.status}）`);
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new LoadError('数据格式不正确');
  }
  return parseBooks(data);
}

let state: LoadState<Book[]> = { status: 'idle' };

const setState = (next: LoadState<Book[]>): void => {
  state = next;
  button.setAttribute('aria-disabled', String(next.status === 'loading'));
  renderBooks(view, next, () => void load());
};

const load = async (): Promise<void> => {
  if (state.status === 'loading') return;
  setState({ status: 'loading' });
  try {
    setState({ status: 'success', data: await fetchBooks(topic.value) });
  } catch (err) {
    setState({ status: 'error', message: err instanceof LoadError ? err.message : '发生了未知错误' });
  }
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void load();
});

setState({ status: 'idle' });
```
:::
