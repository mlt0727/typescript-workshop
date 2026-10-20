---
kind: challenge
title: 添加任务
---
`main.ts` 中已经把示例数据渲染到了页面上。完成添加任务的表单（`index.html` 只读）：

1. 提交表单（按回车或点“添加”）时，阻止浏览器默认的提交，用 `parseTaskInput` 解析输入框的内容；
2. 解析成功：用 `reduce` 添加任务（`now` 是 `Date.now()`），重新渲染任务板；清空输入框，焦点留在输入框；在 `#announce`（`role="status"`）中写入“已添加：标题”；
3. 解析失败：在 `#new-task-error` 中显示错误的消息并让它显示出来（去掉 `hidden`），给输入框加上 `aria-invalid="true"`；保留输入的文字，焦点留在输入框，任务板不变；
4. 用户修改输入框时，或者下一次添加成功之后，错误提示消失（重新隐藏、清空文字），输入框去掉 `aria-invalid`。

`#new-task-error` 有 `role="alert"`，显示出来时读屏软件会立刻读出；输入框的 `aria-describedby` 已经指向它和提示文字。

:::files{role=starter}
```ts file=main.ts
import { reduce, type Board } from './board';
import { parseTaskInput } from './parse';
import { renderBoard } from './render';
import { SAMPLE } from './sample';

function byId<T extends HTMLElement>(id: string, type: { new (): T; prototype: T }): T {
  const node = document.getElementById(id);
  if (!(node instanceof type)) throw new Error(`页面缺少 #${id}`);
  return node;
}

const form = byId('add-form', HTMLFormElement);
const input = byId('new-task', HTMLInputElement);
const errorText = byId('new-task-error', HTMLParagraphElement);
const announce = byId('announce', HTMLParagraphElement);
const boardRoot = byId('board', HTMLDivElement);

let board: Board = SAMPLE;
renderBoard(boardRoot, board);

// TODO：提交表单时解析输入；合法就添加任务、重新渲染并在 announce 中播报，否则在 errorText 中显示错误
form.addEventListener('submit', () => {});
```
:::

:::files{role=support}
```html file=index.html readonly
<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main>
      <h1>任务板</h1>
      <form id="add-form" novalidate>
        <label for="new-task">新任务</label>
        <input id="new-task" autocomplete="off" aria-describedby="new-task-hint new-task-error" />
        <button type="submit">添加</button>
        <p id="new-task-hint">用 # 添加标签，例如：写周报 #工作</p>
        <p id="new-task-error" class="error" role="alert" hidden></p>
      </form>
      <p id="announce" role="status"></p>
      <div id="board" class="board"></div>
    </main>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```css file=style.css readonly
body { font-family: system-ui, sans-serif; margin: 1rem; }
.board { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
.column { background: #f3f4f6; border-radius: 8px; padding: 0.5rem 1rem; }
.column ul { list-style: none; padding: 0; }
.task { background: #fff; border-radius: 6px; padding: 0.5rem; margin-bottom: 0.5rem; }
.tags { display: inline; list-style: none; padding: 0; margin-left: 0.5rem; color: #4b5563; }
.tags li { display: inline; margin-right: 0.25rem; }
.error { color: #b91c1c; }
[aria-invalid='true'] { border-color: #b91c1c; }
```
```ts file=board.ts readonly
export const STATUSES = ['todo', 'doing', 'done'] as const;
export type Status = (typeof STATUSES)[number];

export type Task = Readonly<{ id: string; title: string; tags: readonly string[]; status: Status; createdAt: number }>;
export type Board = Readonly<{ tasks: readonly Task[]; nextId: number }>;

export type Action =
  | { type: 'add'; title: string; tags: readonly string[]; now: number }
  | { type: 'rename'; id: string; title: string }
  | { type: 'step'; id: string; direction: -1 | 1 }
  | { type: 'remove'; id: string };

/** 用 change 计算出新的任务；找不到、或者 change 返回原来的任务时，返回原来的 board */
function updateTask(board: Board, id: string, change: (task: Task) => Task): Board {
  const index = board.tasks.findIndex((t) => t.id === id);
  const task = board.tasks[index];
  if (task === undefined) return board;
  const next = change(task);
  return next === task ? board : { ...board, tasks: board.tasks.with(index, next) };
}

export function reduce(board: Board, action: Action): Board {
  switch (action.type) {
    case 'add': {
      const task: Task = { id: `t${board.nextId}`, title: action.title, tags: action.tags, status: 'todo', createdAt: action.now };
      return { tasks: [...board.tasks, task], nextId: board.nextId + 1 };
    }
    case 'rename': {
      const title = action.title.trim();
      return updateTask(board, action.id, (task) => (title === '' || title === task.title ? task : { ...task, title }));
    }
    case 'step':
      return updateTask(board, action.id, (task) => {
        const next = STATUSES[STATUSES.indexOf(task.status) + action.direction];
        return next === undefined ? task : { ...task, status: next };
      });
    case 'remove': {
      const tasks = board.tasks.filter((t) => t.id !== action.id);
      return tasks.length === board.tasks.length ? board : { ...board, tasks };
    }
    default: {
      const unhandled: never = action;
      throw new Error(`未知的动作：${JSON.stringify(unhandled)}`);
    }
  }
}

const idNumber = (task: Task) => Number(task.id.slice(1));

/** 按状态分成三列；每列按创建时间排序，时间相同时按 id 中的数字排序 */
export function columnsOf(board: Board): Readonly<Record<Status, readonly Task[]>> {
  const sorted = board.tasks.toSorted((a, b) => a.createdAt - b.createdAt || idNumber(a) - idNumber(b));
  return {
    todo: sorted.filter((t) => t.status === 'todo'),
    doing: sorted.filter((t) => t.status === 'doing'),
    done: sorted.filter((t) => t.status === 'done'),
  };
}
```
```ts file=parse.ts readonly
export type TitleResult = { ok: true; title: string } | { ok: false; error: string };
export type ParseResult = { ok: true; title: string; tags: readonly string[] } | { ok: false; error: string };

const MAX_TITLE = 40;
const MAX_TAG = 10;
const MAX_TAGS = 3;

/** 按码点计算长度：emoji 这类基本平面以外的字符算一个（a04、a09） */
const charCount = (text: string) => [...text].length;

/** 标题的规则（添加任务和改名都用它）：任意空白分隔的词用一个空格连起来，不能为空，不超过 40 个字符 */
export function parseTitle(text: string): TitleResult {
  const title = text.split(/\s+/).filter((word) => word !== '').join(' ');
  if (title === '') return { ok: false, error: '标题不能为空' };
  if (charCount(title) > MAX_TITLE) return { ok: false, error: `标题不能超过 ${MAX_TITLE} 个字符` };
  return { ok: true, title };
}

/** 把“写周报 #工作 #紧急”这样的一行输入解析成标题和标签 */
export function parseTaskInput(text: string): ParseResult {
  const words = text.split(/\s+/).filter((word) => word !== '');
  const rawTags = words.filter((word) => word.startsWith('#')).map((word) => word.slice(1));
  // 先检查所有的标签，再检查标题；按规定的顺序报告第一个问题，与词在输入中的位置无关
  if (rawTags.includes('')) return { ok: false, error: '标签不能为空' };
  if (rawTags.some((tag) => charCount(tag) > MAX_TAG)) return { ok: false, error: `标签不能超过 ${MAX_TAG} 个字符` };
  const tags = [...new Set(rawTags)];
  if (tags.length > MAX_TAGS) return { ok: false, error: `最多 ${MAX_TAGS} 个标签` };
  const title = parseTitle(words.filter((word) => !word.startsWith('#')).join(' '));
  return title.ok ? { ok: true, title: title.title, tags } : title;
}
```
```ts file=dom.ts readonly
/** 创建一个元素：设置属性，按顺序加入子节点（字符串会成为文字节点，不会被当成 HTML） */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Readonly<Record<string, string>> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  node.append(...children);
  return node;
}
```
```ts file=render.ts readonly
import { columnsOf, STATUSES, type Board, type Task } from './board';
import { el } from './dom';

export const COLUMN_NAMES = { todo: '待办', doing: '进行中', done: '已完成' } as const;

function renderTask(task: Task): HTMLLIElement {
  const item = el('li', { class: 'task', 'data-id': task.id }, el('span', { class: 'title' }, task.title));
  if (task.tags.length > 0) {
    item.append(el('ul', { class: 'tags', 'aria-label': '标签' }, ...task.tags.map((tag) => el('li', {}, `#${tag}`))));
  }
  return item;
}

export function renderBoard(root: HTMLElement, board: Board): void {
  const columns = columnsOf(board);
  root.replaceChildren(
    ...STATUSES.map((status) => {
      const tasks = columns[status];
      const headingId = `column-${status}`;
      return el(
        'section',
        { class: 'column', 'data-status': status, 'aria-labelledby': headingId },
        el('h2', { id: headingId }, `${COLUMN_NAMES[status]} `, el('span', { class: 'count' }, String(tasks.length))),
        tasks.length === 0 ? el('p', { class: 'empty' }, '没有任务') : el('ul', {}, ...tasks.map(renderTask)),
      );
    }),
  );
}
```
```ts file=sample.ts readonly
import type { Board } from './board';

/** 页面打开时的示例数据（以后会从本地存储中读取） */
export const SAMPLE: Board = {
  tasks: [
    { id: 't1', title: '写周报', tags: ['工作'], status: 'todo', createdAt: 1 },
    { id: 't2', title: '修自行车', tags: [], status: 'doing', createdAt: 2 },
  ],
  nextId: 3,
};
```
:::

:::files{role=solution}
```ts file=main.ts
import { reduce, type Board } from './board';
import { parseTaskInput } from './parse';
import { renderBoard } from './render';
import { SAMPLE } from './sample';

function byId<T extends HTMLElement>(id: string, type: { new (): T; prototype: T }): T {
  const node = document.getElementById(id);
  if (!(node instanceof type)) throw new Error(`页面缺少 #${id}`);
  return node;
}

const form = byId('add-form', HTMLFormElement);
const input = byId('new-task', HTMLInputElement);
const errorText = byId('new-task-error', HTMLParagraphElement);
const announce = byId('announce', HTMLParagraphElement);
const boardRoot = byId('board', HTMLDivElement);

let board: Board = SAMPLE;
renderBoard(boardRoot, board);

function showError(message: string): void {
  errorText.textContent = message;
  errorText.hidden = false;
  input.setAttribute('aria-invalid', 'true');
}

function clearError(): void {
  errorText.textContent = '';
  errorText.hidden = true;
  input.removeAttribute('aria-invalid');
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const parsed = parseTaskInput(input.value);
  if (!parsed.ok) {
    showError(parsed.error);
    input.focus();
    return;
  }
  board = reduce(board, { type: 'add', title: parsed.title, tags: parsed.tags, now: Date.now() });
  renderBoard(boardRoot, board);
  clearError();
  input.value = '';
  input.focus();
  announce.textContent = `已添加：${parsed.title}`;
});

input.addEventListener('input', clearError);
```
:::

:::files{role=tests}
```ts file=add.test.ts
import { expect, test } from 'vitest';
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

const input = () => screen.getByLabelText('新任务');
const column = (name: RegExp) => screen.getByRole('region', { name });
const titles = (name: RegExp) => [...column(name).querySelectorAll('li.task .title')].map((n) => n.textContent);
const errorText = () => document.getElementById('new-task-error');

function watchSubmits(): boolean[] {
  const prevented: boolean[] = [];
  document.addEventListener('submit', (event) => prevented.push(event.defaultPrevented));
  return prevented;
}

test('页面打开时显示示例数据', () => {
  expect(titles(/^待办/)).toEqual(['写周报']);
  expect(titles(/^进行中/)).toEqual(['修自行车']);
  expect(within(column(/^已完成 0$/)).getByText('没有任务')).toBeInTheDocument();
});

test('按回车添加：进入“待办”，清空输入框，焦点留在输入框，播报结果', async () => {
  const prevented = watchSubmits();
  const user = userEvent.setup();
  await user.type(input(), '读完 p1-02 #学习{Enter}');
  expect(prevented).toEqual([true]);
  expect(titles(/^待办 2$/)).toEqual(['写周报', '读完 p1-02']);
  const added = [...column(/^待办/).querySelectorAll('li.task')].at(-1);
  expect(added?.textContent).toContain('#学习');
  expect(input()).toHaveValue('');
  expect(input()).toHaveFocus();
  expect(screen.getByRole('status')).toHaveTextContent('已添加：读完 p1-02');
});

test('点“添加”按钮也能添加；连续添加的任务 id 不重复', async () => {
  const user = userEvent.setup();
  await user.type(input(), '第一个');
  await user.click(screen.getByRole('button', { name: '添加' }));
  await user.type(input(), '第二个');
  await user.click(screen.getByRole('button', { name: '添加' }));
  const ids = [...column(/^待办/).querySelectorAll<HTMLElement>('li.task')].map((li) => li.dataset['id']);
  expect(ids).toEqual(['t1', 't3', 't4']);
});

test('输入不合法：显示原因，标记输入框，保留输入的文字，不添加', async () => {
  const prevented = watchSubmits();
  const user = userEvent.setup();
  await user.type(input(), '#工作{Enter}');
  expect(prevented).toEqual([true]);
  expect(screen.getByRole('alert')).toHaveTextContent('标题不能为空');
  expect(errorText()).toBeVisible();
  expect(input()).toHaveAttribute('aria-invalid', 'true');
  expect(input()).toHaveValue('#工作');
  expect(input()).toHaveFocus();
  expect(titles(/^待办 1$/)).toEqual(['写周报']);
});

test('修改输入框，或者成功添加之后，错误提示消失', async () => {
  const user = userEvent.setup();
  await user.type(input(), '#{Enter}');
  expect(screen.getByRole('alert')).toHaveTextContent('标签不能为空');
  await user.type(input(), '工作');
  expect(errorText()).not.toBeVisible();
  expect(errorText(), '隐藏的同时要清空文字').toBeEmptyDOMElement();
  expect(input()).not.toHaveAttribute('aria-invalid');
  await user.type(input(), '{Enter}');
  expect(screen.getByRole('alert')).toHaveTextContent('标题不能为空');
  await user.clear(input());
  await user.type(input(), '好了{Enter}');
  expect(errorText()).not.toBeVisible();
  expect(errorText(), '隐藏的同时要清空文字').toBeEmptyDOMElement();
  expect(input()).not.toHaveAttribute('aria-invalid');
});

test('用户输入的 HTML 只作为文字显示', async () => {
  const user = userEvent.setup();
  await user.type(input(), '<b>粗体</b> 任务{Enter}');
  expect(titles(/^待办/)).toEqual(['写周报', '<b>粗体</b> 任务']);
  expect(document.querySelector('#board b')).toBeNull();
});
```
:::

:::hint{level=1}
用一个变量保存当前的 `board`。提交时：`event.preventDefault()`，`const parsed = parseTaskInput(input.value)`，然后根据 `parsed.ok` 分两种情况处理。成功时 `board = reduce(board, …)`，再 `renderBoard(boardRoot, board)`。
:::

:::hint{level=2}
写两个小函数 `showError(message)`、`clearError()`：前者设置文字、`hidden = false`、`setAttribute('aria-invalid', 'true')`，后者反过来（`removeAttribute`）。输入框的 `input` 事件调用 `clearError`。点“添加”按钮提交时，焦点可能已经移到了按钮上（按回车提交时它还在输入框中），所以处理完之后调用 `input.focus()` 把焦点放回输入框。
:::

:::explanation
这个表单的每一个细节都是为了让用户知道发生了什么：

- **阻止默认提交**：表单默认会把数据发给 `action` 指定的地址并刷新页面，整个任务板的状态就没了；
- **失败时**：文字说明 + `aria-invalid` + `aria-describedby`（d04、d09）。只把边框变红，读屏用户和色盲用户都无从得知。提交时焦点本来就在输入框中，`aria-describedby` 不会被重新读出，所以由 `role="alert"` 让错误一出现就被读出来。保留输入的文字，用户只需要改正，而不是重新输入；
- **错误消失时要清空文字**，不只是隐藏：被 `aria-describedby` 直接引用的元素即使是隐藏的，它的文字仍然会计入输入框的描述（Accessible Name and Description Computation 1.2，第 2A 步），读屏软件会继续读出早已过时的“标题不能为空”；
- **成功时**：清空输入框、焦点留在原处，连续添加几个任务时不用来回点击；`role="status"` 的区域一直在页面上，内容变化时读屏软件会礼貌地读出“已添加：…”（e07）；
- **状态 → 渲染**：事件处理函数只做三件事：解析输入、用 `reduce` 计算新的状态、用 `renderBoard` 显示它。任务板上的内容永远来自 `board`，不会和它不一致。

也可以把“更新状态并重新渲染”写成一个 `dispatch(action)` 函数，下一个里程碑就会这样做：那时会有更多的动作（移动、改名、删除），它们都经过同一个 `dispatch`，渲染、播报（以后还有保存）都只写一次。
:::

:::variant{kind=alt name=dispatch}
```ts file=main.ts
import { reduce, type Action, type Board } from './board';
import { parseTaskInput } from './parse';
import { renderBoard } from './render';
import { SAMPLE } from './sample';

function byId<T extends HTMLElement>(id: string, type: { new (): T; prototype: T }): T {
  const node = document.getElementById(id);
  if (!(node instanceof type)) throw new Error(`页面缺少 #${id}`);
  return node;
}

const form = byId('add-form', HTMLFormElement);
const input = byId('new-task', HTMLInputElement);
const errorText = byId('new-task-error', HTMLParagraphElement);
const announce = byId('announce', HTMLParagraphElement);
const boardRoot = byId('board', HTMLDivElement);

let board: Board = SAMPLE;

function dispatch(action: Action, message: string): void {
  const next = reduce(board, action);
  if (next === board) return;
  board = next;
  renderBoard(boardRoot, board);
  announce.textContent = message;
}

function setError(message: string | null): void {
  errorText.hidden = message === null;
  errorText.textContent = message ?? '';
  if (message === null) input.removeAttribute('aria-invalid');
  else input.setAttribute('aria-invalid', 'true');
}

renderBoard(boardRoot, board);

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const result = parseTaskInput(input.value);
  input.focus();
  if (!result.ok) {
    setError(result.error);
    return;
  }
  setError(null);
  dispatch({ type: 'add', title: result.title, tags: result.tags, now: Date.now() }, `已添加：${result.title}`);
  form.reset();
});

input.addEventListener('input', () => setError(null));
```
:::

:::variant{kind=wrong name=no-prevent-default fails=tests reason="没有阻止表单默认的提交"}
```ts file=main.ts
import { reduce, type Board } from './board';
import { parseTaskInput } from './parse';
import { renderBoard } from './render';
import { SAMPLE } from './sample';

function byId<T extends HTMLElement>(id: string, type: { new (): T; prototype: T }): T {
  const node = document.getElementById(id);
  if (!(node instanceof type)) throw new Error(`页面缺少 #${id}`);
  return node;
}

const form = byId('add-form', HTMLFormElement);
const input = byId('new-task', HTMLInputElement);
const errorText = byId('new-task-error', HTMLParagraphElement);
const announce = byId('announce', HTMLParagraphElement);
const boardRoot = byId('board', HTMLDivElement);

let board: Board = SAMPLE;
renderBoard(boardRoot, board);

function showError(message: string): void {
  errorText.textContent = message;
  errorText.hidden = false;
  input.setAttribute('aria-invalid', 'true');
}

function clearError(): void {
  errorText.textContent = '';
  errorText.hidden = true;
  input.removeAttribute('aria-invalid');
}

form.addEventListener('submit', (event) => {
  const parsed = parseTaskInput(input.value);
  if (!parsed.ok) {
    showError(parsed.error);
    input.focus();
    return;
  }
  board = reduce(board, { type: 'add', title: parsed.title, tags: parsed.tags, now: Date.now() });
  renderBoard(boardRoot, board);
  clearError();
  input.value = '';
  input.focus();
  announce.textContent = `已添加：${parsed.title}`;
});

input.addEventListener('input', clearError);
```
:::

:::variant{kind=wrong name=error-stays fails=tests reason="修改输入框、成功添加之后，错误提示仍然留着"}
```ts file=main.ts
import { reduce, type Board } from './board';
import { parseTaskInput } from './parse';
import { renderBoard } from './render';
import { SAMPLE } from './sample';

function byId<T extends HTMLElement>(id: string, type: { new (): T; prototype: T }): T {
  const node = document.getElementById(id);
  if (!(node instanceof type)) throw new Error(`页面缺少 #${id}`);
  return node;
}

const form = byId('add-form', HTMLFormElement);
const input = byId('new-task', HTMLInputElement);
const errorText = byId('new-task-error', HTMLParagraphElement);
const announce = byId('announce', HTMLParagraphElement);
const boardRoot = byId('board', HTMLDivElement);

let board: Board = SAMPLE;
renderBoard(boardRoot, board);

function showError(message: string): void {
  errorText.textContent = message;
  errorText.hidden = false;
  input.setAttribute('aria-invalid', 'true');
}

function clearError(): void {
  errorText.textContent = '';
  errorText.hidden = true;
  input.removeAttribute('aria-invalid');
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const parsed = parseTaskInput(input.value);
  if (!parsed.ok) {
    showError(parsed.error);
    input.focus();
    return;
  }
  board = reduce(board, { type: 'add', title: parsed.title, tags: parsed.tags, now: Date.now() });
  renderBoard(boardRoot, board);
  input.value = '';
  input.focus();
  announce.textContent = `已添加：${parsed.title}`;
});

```
:::

:::variant{kind=wrong name=hide-but-keep-text fails=tests reason="错误提示只是隐藏了，文字还在，仍然会作为输入框的描述被读出"}
```ts file=main.ts
import { reduce, type Board } from './board';
import { parseTaskInput } from './parse';
import { renderBoard } from './render';
import { SAMPLE } from './sample';

function byId<T extends HTMLElement>(id: string, type: { new (): T; prototype: T }): T {
  const node = document.getElementById(id);
  if (!(node instanceof type)) throw new Error(`页面缺少 #${id}`);
  return node;
}

const form = byId('add-form', HTMLFormElement);
const input = byId('new-task', HTMLInputElement);
const errorText = byId('new-task-error', HTMLParagraphElement);
const announce = byId('announce', HTMLParagraphElement);
const boardRoot = byId('board', HTMLDivElement);

let board: Board = SAMPLE;
renderBoard(boardRoot, board);

function showError(message: string): void {
  errorText.textContent = message;
  errorText.hidden = false;
  input.setAttribute('aria-invalid', 'true');
}

function clearError(): void {
  errorText.hidden = true;
  input.removeAttribute('aria-invalid');
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const parsed = parseTaskInput(input.value);
  if (!parsed.ok) {
    showError(parsed.error);
    input.focus();
    return;
  }
  board = reduce(board, { type: 'add', title: parsed.title, tags: parsed.tags, now: Date.now() });
  renderBoard(boardRoot, board);
  clearError();
  input.value = '';
  input.focus();
  announce.textContent = `已添加：${parsed.title}`;
});

input.addEventListener('input', clearError);
```
:::

:::variant{kind=wrong name=clear-on-error fails=tests reason="输入不合法时清空了输入框，用户要重新输入"}
```ts file=main.ts
import { reduce, type Board } from './board';
import { parseTaskInput } from './parse';
import { renderBoard } from './render';
import { SAMPLE } from './sample';

function byId<T extends HTMLElement>(id: string, type: { new (): T; prototype: T }): T {
  const node = document.getElementById(id);
  if (!(node instanceof type)) throw new Error(`页面缺少 #${id}`);
  return node;
}

const form = byId('add-form', HTMLFormElement);
const input = byId('new-task', HTMLInputElement);
const errorText = byId('new-task-error', HTMLParagraphElement);
const announce = byId('announce', HTMLParagraphElement);
const boardRoot = byId('board', HTMLDivElement);

let board: Board = SAMPLE;
renderBoard(boardRoot, board);

function showError(message: string): void {
  errorText.textContent = message;
  errorText.hidden = false;
  input.setAttribute('aria-invalid', 'true');
}

function clearError(): void {
  errorText.textContent = '';
  errorText.hidden = true;
  input.removeAttribute('aria-invalid');
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const parsed = parseTaskInput(input.value);
  if (!parsed.ok) {
    showError(parsed.error);
    input.value = '';
    input.focus();
    return;
  }
  board = reduce(board, { type: 'add', title: parsed.title, tags: parsed.tags, now: Date.now() });
  renderBoard(boardRoot, board);
  clearError();
  input.value = '';
  input.focus();
  announce.textContent = `已添加：${parsed.title}`;
});

input.addEventListener('input', clearError);
```
:::

:::variant{kind=wrong name=blur-after-add fails=tests reason="添加之后焦点离开了输入框"}
```ts file=main.ts
import { reduce, type Board } from './board';
import { parseTaskInput } from './parse';
import { renderBoard } from './render';
import { SAMPLE } from './sample';

function byId<T extends HTMLElement>(id: string, type: { new (): T; prototype: T }): T {
  const node = document.getElementById(id);
  if (!(node instanceof type)) throw new Error(`页面缺少 #${id}`);
  return node;
}

const form = byId('add-form', HTMLFormElement);
const input = byId('new-task', HTMLInputElement);
const errorText = byId('new-task-error', HTMLParagraphElement);
const announce = byId('announce', HTMLParagraphElement);
const boardRoot = byId('board', HTMLDivElement);

let board: Board = SAMPLE;
renderBoard(boardRoot, board);

function showError(message: string): void {
  errorText.textContent = message;
  errorText.hidden = false;
  input.setAttribute('aria-invalid', 'true');
}

function clearError(): void {
  errorText.textContent = '';
  errorText.hidden = true;
  input.removeAttribute('aria-invalid');
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const parsed = parseTaskInput(input.value);
  if (!parsed.ok) {
    showError(parsed.error);
    input.focus();
    return;
  }
  board = reduce(board, { type: 'add', title: parsed.title, tags: parsed.tags, now: Date.now() });
  renderBoard(boardRoot, board);
  clearError();
  input.value = '';
  input.blur();
  announce.textContent = `已添加：${parsed.title}`;
});

input.addEventListener('input', clearError);
```
:::

:::variant{kind=wrong name=forgot-render fails=tests reason="更新了状态却没有重新渲染，页面上看不到新任务"}
```ts file=main.ts
import { reduce, type Board } from './board';
import { parseTaskInput } from './parse';
import { renderBoard } from './render';
import { SAMPLE } from './sample';

function byId<T extends HTMLElement>(id: string, type: { new (): T; prototype: T }): T {
  const node = document.getElementById(id);
  if (!(node instanceof type)) throw new Error(`页面缺少 #${id}`);
  return node;
}

const form = byId('add-form', HTMLFormElement);
const input = byId('new-task', HTMLInputElement);
const errorText = byId('new-task-error', HTMLParagraphElement);
const announce = byId('announce', HTMLParagraphElement);
const boardRoot = byId('board', HTMLDivElement);

let board: Board = SAMPLE;
renderBoard(boardRoot, board);

function showError(message: string): void {
  errorText.textContent = message;
  errorText.hidden = false;
  input.setAttribute('aria-invalid', 'true');
}

function clearError(): void {
  errorText.textContent = '';
  errorText.hidden = true;
  input.removeAttribute('aria-invalid');
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const parsed = parseTaskInput(input.value);
  if (!parsed.ok) {
    showError(parsed.error);
    input.focus();
    return;
  }
  board = reduce(board, { type: 'add', title: parsed.title, tags: parsed.tags, now: Date.now() });
  clearError();
  input.value = '';
  input.focus();
  announce.textContent = `已添加：${parsed.title}`;
});

input.addEventListener('input', clearError);
```
:::
