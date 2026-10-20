---
kind: challenge
title: 区分失败原因的图书搜索
fixtures: quick
---
`render.ts`（只读）提供了小任务中的 `LoadState` 和 `renderBooks`。在 `main.ts` 中完成搜索流程：

1. 提交表单（阻止默认行为）时，请求 `/api/books?topic=主题`（主题来自 `#topic`，用 `encodeURIComponent` 编码），状态依次经过 `loading` 和最终状态，每次状态改变都调用 `renderBooks(#results, state, 重试函数)`；
2. 加载期间，“搜索”按钮禁用；结束后恢复；
3. 响应的数据必须是数组，每一项是 `{ id: number, title: string }`（多余的字段丢弃）。验证通过就进入 `success`；
4. 失败时进入 `error`，`message` 按原因区分：

| 原因 | message |
| --- | --- |
| `fetch` 被拒绝（网络失败） | `网络连接失败，请检查网络后重试` |
| 状态码 500–599 | `服务器暂时出了问题，请稍后重试（状态码 500）`（数字换成实际的状态码） |
| 其他非 2xx 状态码 | `请求失败（状态码 404）` |
| 数据不是合法的 JSON，或者没有通过验证 | `数据格式不正确` |

5. 点击“重试”时，用**上一次请求的主题**重新请求（即使下拉框已经改了）；
6. 页面加载后先渲染 `idle` 状态。

模拟的服务器为 `typescript`、`cobol`（空结果）、`broken`（500）、`offline`（网络失败）、`weird`（格式错误）这几个主题准备了响应。

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
        <option value="offline">网络断开</option>
        <option value="weird">格式错误</option>
      </select>
      <button>搜索</button>
    </form>
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
const results = document.querySelector('#results');
const button = form?.querySelector('button');
if (!(form instanceof HTMLFormElement) || !(topic instanceof HTMLSelectElement) || !(results instanceof HTMLElement) || !button) {
  throw new Error('页面结构不完整');
}

// TODO：状态、加载流程、错误分类、重试
```
:::

:::files{role=solution}
```ts file=main.ts
import { renderBooks, type Book, type LoadState } from './render';

const form = document.querySelector('#search');
const topic = document.querySelector('#topic');
const results = document.querySelector('#results');
const button = form?.querySelector('button');
if (!(form instanceof HTMLFormElement) || !(topic instanceof HTMLSelectElement) || !(results instanceof HTMLElement) || !button) {
  throw new Error('页面结构不完整');
}

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

const setState = (state: LoadState<Book[]>): void => {
  button.disabled = state.status === 'loading';
  renderBooks(results, state, () => void load(lastTopic));
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

:::files{role=tests}
```ts file=search.test.ts
import { expect, test } from 'vitest';
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

async function search(topic: string) {
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText('主题'), topic);
  await user.click(screen.getByRole('button', { name: '搜索' }));
}

async function errorMessage(): Promise<string> {
  const alert = await screen.findByRole('alert');
  return alert.querySelector('p')?.textContent ?? '';
}

test('页面加载后是 idle 状态', () => {
  expect(screen.getByText('选择一个主题开始搜索。')).toBeInTheDocument();
});

test('加载中显示状态并禁用按钮，完成后显示结果', async () => {
  await search('typescript');
  expect(screen.getByRole('status')).toHaveTextContent('正在加载…');
  expect(screen.getByRole('button', { name: '搜索' })).toBeDisabled();
  expect(await screen.findByText('找到 2 本书')).toBeInTheDocument();
  expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Effective TypeScript', 'Programming TypeScript']);
  expect(screen.getByRole('button', { name: '搜索' })).toBeEnabled();
});

test('空结果', async () => {
  await search('cobol');
  expect(await screen.findByText('没有找到相关的书。')).toBeInTheDocument();
});

test('服务器出错', async () => {
  await search('broken');
  expect(await errorMessage()).toBe('加载失败：服务器暂时出了问题，请稍后重试（状态码 500）');
});

test('网络失败', async () => {
  await search('offline');
  expect(await errorMessage()).toBe('加载失败：网络连接失败，请检查网络后重试');
});

test('数据格式不正确', async () => {
  await search('weird');
  expect(await errorMessage()).toBe('加载失败：数据格式不正确');
});

test('重试使用上一次请求的主题', async () => {
  const user = userEvent.setup();
  await search('offline');
  const alert = await screen.findByRole('alert');
  await user.selectOptions(screen.getByLabelText('主题'), 'typescript');
  await user.click(within(alert).getByRole('button', { name: '重试' }));
  expect(screen.getByRole('status')).toHaveTextContent('正在加载…');
  expect(await errorMessage()).toBe('加载失败：网络连接失败，请检查网络后重试');
});
```
:::

:::hint{level=1}
把流程拆成几个函数：`fetchBooks(topic)` 负责请求、分类错误和验证数据，失败时抛出一个带有**给用户看的消息**的错误；`load(topic)` 负责状态：先 `loading`，然后根据 `fetchBooks` 的结果进入 `success` 或 `error`；`setState(state)` 负责同步按钮和调用 `renderBooks`。
:::

:::hint{level=2}
可以定义一个 `class LoadError extends Error {}`，所有已知的失败都抛出它，`load` 的 `catch` 里用 `instanceof LoadError` 取出消息。网络失败要单独用 `try/catch` 包住 `fetch`；`response.json()` 的 `SyntaxError` 也要包住，归为“数据格式不正确”。重试函数里用一个变量记住上一次请求的主题。
:::

:::explanation
这道题把前面几课串了起来：`fetch` 的两类失败（e05）、运行时验证（e06）、可辨识联合的状态和渲染（本课）。

代码按职责分成了三层：

- `fetchBooks`：只关心数据。它把各种底层错误（`TypeError`、状态码、`SyntaxError`、验证失败）**翻译**成一个面向用户的 `LoadError`；
- `load`：只关心状态的流转：`loading` → `success` 或 `error`；
- `setState`：只关心界面：按钮是否禁用、调用 `renderBooks`。

“翻译”错误这一步很重要：底层的错误信息（例如 `Failed to fetch`、`Unexpected token`）对用户没有意义，而且可能暴露实现细节。用户需要的是“发生了什么、我能做什么”。

重试使用上一次请求的主题，而不是下拉框当前的值：用户点击的是“重试刚才失败的请求”。`void load(...)` 明确表示“这里有意不等待这个 Promise”，`load` 内部已经处理了所有错误，不会产生未处理的拒绝。
:::

:::variant{kind=alt name=result-based}
```ts file=main.ts
import { renderBooks, type Book, type LoadState } from './render';

const form = document.querySelector('#search');
const topic = document.querySelector('#topic');
const results = document.querySelector('#results');
const button = form?.querySelector('button');
if (!(form instanceof HTMLFormElement) || !(topic instanceof HTMLSelectElement) || !(results instanceof HTMLElement) || !button) {
  throw new Error('页面结构不完整');
}

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

function show(state: LoadState<Book[]>): void {
  if (!(results instanceof HTMLElement) || !button) return;
  button.disabled = state.status === 'loading';
  renderBooks(results, state, () => {
    void run(previous);
  });
}

async function run(t: string): Promise<void> {
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
const results = document.querySelector('#results');
const button = form?.querySelector('button');
if (!(form instanceof HTMLFormElement) || !(topic instanceof HTMLSelectElement) || !(results instanceof HTMLElement) || !button) {
  throw new Error('页面结构不完整');
}

let lastTopic = topic.value;

const setState = (state: LoadState<Book[]>): void => {
  button.disabled = state.status === 'loading';
  renderBooks(results, state, () => void load(lastTopic));
};

const load = async (topicValue: string): Promise<void> => {
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

:::variant{kind=wrong name=button-never-disabled fails=tests reason="加载期间没有禁用搜索按钮"}
```ts file=main.ts
import { renderBooks, type Book, type LoadState } from './render';

const form = document.querySelector('#search');
const topic = document.querySelector('#topic');
const results = document.querySelector('#results');
if (!(form instanceof HTMLFormElement) || !(topic instanceof HTMLSelectElement) || !(results instanceof HTMLElement)) {
  throw new Error('页面结构不完整');
}

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
  const data: unknown = await response.json().catch(() => null);
  if (!Array.isArray(data)) throw new LoadError('数据格式不正确');
  return data.map((item: unknown) => {
    if (typeof item !== 'object' || item === null || !('id' in item) || !('title' in item)) throw new LoadError('数据格式不正确');
    const { id, title } = item;
    if (typeof id !== 'number' || typeof title !== 'string') throw new LoadError('数据格式不正确');
    return { id, title };
  });
}

let lastTopic = topic.value;

const load = async (topicValue: string): Promise<void> => {
  lastTopic = topicValue;
  const show = (state: LoadState<Book[]>) => renderBooks(results, state, () => void load(lastTopic));
  show({ status: 'loading' });
  try {
    show({ status: 'success', data: await fetchBooks(topicValue) });
  } catch (err) {
    show({ status: 'error', message: err instanceof LoadError ? err.message : '发生了未知错误' });
  }
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void load(topic.value);
});

renderBooks(results, { status: 'idle' }, () => {});
```
:::

:::variant{kind=wrong name=retry-current-select fails=tests reason="重试时读取了下拉框当前的值，而不是上一次请求的主题"}
```ts file=main.ts
import { renderBooks, type Book, type LoadState } from './render';

const form = document.querySelector('#search');
const topic = document.querySelector('#topic');
const results = document.querySelector('#results');
const button = form?.querySelector('button');
if (!(form instanceof HTMLFormElement) || !(topic instanceof HTMLSelectElement) || !(results instanceof HTMLElement) || !button) {
  throw new Error('页面结构不完整');
}

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
  const data: unknown = await response.json().catch(() => null);
  if (!Array.isArray(data)) throw new LoadError('数据格式不正确');
  return data.map((item: unknown) => {
    if (typeof item !== 'object' || item === null || !('id' in item) || !('title' in item)) throw new LoadError('数据格式不正确');
    const { id, title } = item;
    if (typeof id !== 'number' || typeof title !== 'string') throw new LoadError('数据格式不正确');
    return { id, title };
  });
}

const setState = (state: LoadState<Book[]>): void => {
  button.disabled = state.status === 'loading';
  renderBooks(results, state, () => void load());
};

const load = async (): Promise<void> => {
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
