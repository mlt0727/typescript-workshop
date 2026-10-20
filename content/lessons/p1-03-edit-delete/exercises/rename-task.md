---
kind: challenge
title: 就地改名
---
完成“改名”。这次需要修改两个文件。

**`render.ts`**：`renderBoard(root, board, view)` 多接收一个界面状态 `view: { editingId, draft, renameError }`（不传时是 `NOT_EDITING`：`{ editingId: null, draft: '', renameError: null }`）。`editingId` 对应的任务显示成一个改名的表单，代替标题和四个按钮（标签仍然显示），输入框中是 `draft`：

```html
<li class="task editing" data-id="t1">
  <form class="rename" novalidate>
    <label>新的标题 <input name="title" autocomplete="off" /></label>
    <!-- 有 renameError 时：<p class="error" role="alert" id="rename-error-t1">错误</p>，输入框带 aria-invalid="true" 和 aria-describedby -->
    <button type="submit">保存</button>
    <button type="button" data-action="cancel">取消</button>
  </form>
  …标签…
</li>
```

**`main.ts`**：

1. 点“改名”：进入编辑状态（同一时间只编辑一个任务，点另一个任务的“改名”就换成编辑它），输入框中是原来的标题，**获得焦点并选中全部文字**；
2. 保存（回车或“保存”）：阻止表单默认的提交；用 `parseTitle` 检查新标题（和添加任务时的规则一样：空白合并成一个空格，不能为空，不超过 40 个字符；`#` 开头的词也只是标题的一部分）。不合法时留在编辑状态，显示 `parseTitle` 返回的错误，输入框中保留用户输入的内容，焦点留在输入框；合法时用 `rename` 动作改名，标题有变化时在 `#announce` 中写入“已改名：新标题”；
3. 取消（Esc 或“取消”）：不保存；显示错误之后用户修改输入框时，错误提示消失（去掉错误说明和输入框的 `aria-invalid`）；
4. 保存、取消之后回到普通的显示，焦点回到这个任务的“改名”按钮；
5. 编辑时，其他任务的按钮照常工作；任务板因此重新渲染时，表单和正在输入的内容都要保留：在输入框的 `input` 事件中把内容记到 `view.draft` 中。

表单是渲染出来的，每次渲染都会换成新的元素，所以 `submit`、`input`、`keydown` 也要在 `boardRoot` 上委托处理（这几种事件都会冒泡）。

:::files{role=starter}
```ts file=render.ts
import { columnsOf, STATUSES, type Board, type Task } from './board';
import { el } from './dom';

export const COLUMN_NAMES = { todo: '待办', doing: '进行中', done: '已完成' } as const;

function actionButton(action: 'left' | 'right' | 'rename' | 'remove', label: string, icon: string, disabled = false): HTMLButtonElement {
  const button = el('button', { type: 'button', 'data-action': action, 'aria-label': label }, el('span', { 'aria-hidden': 'true' }, icon));
  button.disabled = disabled;
  return button;
}

function tagList(task: Task): HTMLUListElement[] {
  return task.tags.length === 0 ? [] : [el('ul', { class: 'tags', 'aria-label': '标签' }, ...task.tags.map((tag) => el('li', {}, `#${tag}`)))];
}

function actions(task: Task): HTMLDivElement {
  const position = STATUSES.indexOf(task.status);
  return el(
    'div',
    { class: 'actions' },
    actionButton('left', `左移：${task.title}`, '←', position === 0),
    actionButton('right', `右移：${task.title}`, '→', position === STATUSES.length - 1),
    actionButton('rename', `改名：${task.title}`, '✎'),
    actionButton('remove', `删除：${task.title}`, '×'),
  );
}

function renderTask(task: Task): HTMLLIElement {
  return el('li', { class: 'task', 'data-id': task.id }, el('span', { class: 'title' }, task.title), ...tagList(task), actions(task));
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
        el('h2', { id: headingId, tabindex: '-1' }, `${COLUMN_NAMES[status]} `, el('span', { class: 'count' }, String(tasks.length))),
        tasks.length === 0 ? el('p', { class: 'empty' }, '没有任务') : el('ul', {}, ...tasks.map(renderTask)),
      );
    }),
  );
}
```
```ts file=main.ts
import { reduce, type Action, type Board } from './board';
import { parseTaskInput } from './parse';
import { COLUMN_NAMES, renderBoard } from './render';
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

/** 计算新的状态；有变化时重新渲染 */
function dispatch(action: Action): void {
  const next = reduce(board, action);
  if (next === board) return;
  board = next;
  renderBoard(boardRoot, board);
}

const taskSelector = (id: string) => `li[data-id="${CSS.escape(id)}"]`;

/** 聚焦任务板中符合 selector 的元素；找不到或者是禁用的按钮时返回 false */
function focusIn(selector: string): boolean {
  const target = boardRoot.querySelector(selector);
  if (!(target instanceof HTMLElement) || (target instanceof HTMLButtonElement && target.disabled)) return false;
  target.focus();
  return true;
}

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
  input.focus();
  if (!parsed.ok) {
    showError(parsed.error);
    return;
  }
  clearError();
  dispatch({ type: 'add', title: parsed.title, tags: parsed.tags, now: Date.now() });
  input.value = '';
  announce.textContent = `已添加：${parsed.title}`;
});

input.addEventListener('input', clearError);

boardRoot.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('button[data-action]');
  const item = button?.closest('li.task');
  if (!(button instanceof HTMLButtonElement) || !(item instanceof HTMLElement)) return;
  const task = board.tasks.find((t) => t.id === item.dataset['id']);
  if (task === undefined) return;
  const name = button.dataset['action'];
  if (name === 'left' || name === 'right') {
    dispatch({ type: 'step', id: task.id, direction: name === 'left' ? -1 : 1 });
    const moved = board.tasks.find((t) => t.id === task.id);
    if (moved !== undefined) announce.textContent = `已移到“${COLUMN_NAMES[moved.status]}”：${task.title}`;
    const other = name === 'left' ? 'right' : 'left';
    if (!focusIn(`${taskSelector(task.id)} [data-action="${name}"]`)) focusIn(`${taskSelector(task.id)} [data-action="${other}"]`);
  } else if (name === 'remove') {
    dispatch({ type: 'remove', id: task.id });
    announce.textContent = `已删除：${task.title}`;
    focusIn(`#column-${task.status}`);
  }
  // TODO：“改名”
});
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
.actions { display: inline-flex; gap: 0.25rem; margin-left: 0.5rem; }
.rename { display: flex; gap: 0.25rem; align-items: center; flex-wrap: wrap; }
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
```ts file=sample.ts readonly
import type { Board } from './board';

/** 页面打开时的示例数据（以后会从本地存储中读取） */
export const SAMPLE: Board = {
  tasks: [
    { id: 't1', title: '写周报', tags: ['工作'], status: 'todo', createdAt: 1 },
    { id: 't2', title: '修自行车', tags: [], status: 'doing', createdAt: 2 },
    { id: 't3', title: '买牛奶', tags: [], status: 'done', createdAt: 3 },
  ],
  nextId: 4,
};
```
:::

:::files{role=solution}
```ts file=render.ts
import { columnsOf, STATUSES, type Board, type Task } from './board';
import { el } from './dom';

export const COLUMN_NAMES = { todo: '待办', doing: '进行中', done: '已完成' } as const;

function actionButton(action: 'left' | 'right' | 'rename' | 'remove', label: string, icon: string, disabled = false): HTMLButtonElement {
  const button = el('button', { type: 'button', 'data-action': action, 'aria-label': label }, el('span', { 'aria-hidden': 'true' }, icon));
  button.disabled = disabled;
  return button;
}

function tagList(task: Task): HTMLUListElement[] {
  return task.tags.length === 0 ? [] : [el('ul', { class: 'tags', 'aria-label': '标签' }, ...task.tags.map((tag) => el('li', {}, `#${tag}`)))];
}

function actions(task: Task): HTMLDivElement {
  const position = STATUSES.indexOf(task.status);
  return el(
    'div',
    { class: 'actions' },
    actionButton('left', `左移：${task.title}`, '←', position === 0),
    actionButton('right', `右移：${task.title}`, '→', position === STATUSES.length - 1),
    actionButton('rename', `改名：${task.title}`, '✎'),
    actionButton('remove', `删除：${task.title}`, '×'),
  );
}

/** 界面状态：正在改名的任务、输入框中正在输入的内容、改名的错误 */
export type View = Readonly<{ editingId: string | null; draft: string; renameError: string | null }>;

export const NOT_EDITING: View = { editingId: null, draft: '', renameError: null };

function renderEditing(task: Task, view: View): HTMLLIElement {
  const field = el('input', { name: 'title', autocomplete: 'off' });
  field.value = view.draft;
  const form = el('form', { class: 'rename', novalidate: '' }, el('label', {}, '新的标题 ', field));
  if (view.renameError !== null) {
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', `rename-error-${task.id}`);
    form.append(el('p', { class: 'error', role: 'alert', id: `rename-error-${task.id}` }, view.renameError));
  }
  form.append(el('button', { type: 'submit' }, '保存'), el('button', { type: 'button', 'data-action': 'cancel' }, '取消'));
  return el('li', { class: 'task editing', 'data-id': task.id }, form, ...tagList(task));
}

function renderTask(task: Task, view: View): HTMLLIElement {
  if (task.id === view.editingId) return renderEditing(task, view);
  return el('li', { class: 'task', 'data-id': task.id }, el('span', { class: 'title' }, task.title), ...tagList(task), actions(task));
}

export function renderBoard(root: HTMLElement, board: Board, view: View = NOT_EDITING): void {
  const columns = columnsOf(board);
  root.replaceChildren(
    ...STATUSES.map((status) => {
      const tasks = columns[status];
      const headingId = `column-${status}`;
      return el(
        'section',
        { class: 'column', 'data-status': status, 'aria-labelledby': headingId },
        el('h2', { id: headingId, tabindex: '-1' }, `${COLUMN_NAMES[status]} `, el('span', { class: 'count' }, String(tasks.length))),
        tasks.length === 0 ? el('p', { class: 'empty' }, '没有任务') : el('ul', {}, ...tasks.map((task) => renderTask(task, view))),
      );
    }),
  );
}
```
```ts file=main.ts
import { reduce, type Action, type Board } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { COLUMN_NAMES, NOT_EDITING, renderBoard, type View } from './render';
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
let view: View = NOT_EDITING;

function render(): void {
  renderBoard(boardRoot, board, view);
}

/** 计算新的状态；有变化时重新渲染 */
function dispatch(action: Action): void {
  const next = reduce(board, action);
  if (next === board) return;
  board = next;
  render();
}

const taskSelector = (id: string) => `li[data-id="${CSS.escape(id)}"]`;

/** 聚焦任务板中符合 selector 的元素；找不到或者是禁用的按钮时返回 false */
function focusIn(selector: string): boolean {
  const target = boardRoot.querySelector(selector);
  if (!(target instanceof HTMLElement) || (target instanceof HTMLButtonElement && target.disabled)) return false;
  target.focus();
  return true;
}

/** 结束改名：回到普通的显示，焦点回到这个任务的“改名”按钮 */
function finishRename(id: string): void {
  view = NOT_EDITING;
  render();
  focusIn(`${taskSelector(id)} [data-action="rename"]`);
}

render();

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
  input.focus();
  if (!parsed.ok) {
    showError(parsed.error);
    return;
  }
  clearError();
  dispatch({ type: 'add', title: parsed.title, tags: parsed.tags, now: Date.now() });
  input.value = '';
  announce.textContent = `已添加：${parsed.title}`;
});

input.addEventListener('input', clearError);

boardRoot.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('button[data-action]');
  const item = button?.closest('li.task');
  if (!(button instanceof HTMLButtonElement) || !(item instanceof HTMLElement)) return;
  const task = board.tasks.find((t) => t.id === item.dataset['id']);
  if (task === undefined) return;
  const name = button.dataset['action'];
  if (name === 'left' || name === 'right') {
    dispatch({ type: 'step', id: task.id, direction: name === 'left' ? -1 : 1 });
    const moved = board.tasks.find((t) => t.id === task.id);
    if (moved !== undefined) announce.textContent = `已移到“${COLUMN_NAMES[moved.status]}”：${task.title}`;
    const other = name === 'left' ? 'right' : 'left';
    if (!focusIn(`${taskSelector(task.id)} [data-action="${name}"]`)) focusIn(`${taskSelector(task.id)} [data-action="${other}"]`);
  } else if (name === 'remove') {
    dispatch({ type: 'remove', id: task.id });
    announce.textContent = `已删除：${task.title}`;
    focusIn(`#column-${task.status}`);
  } else if (name === 'rename') {
    view = { editingId: task.id, draft: task.title, renameError: null };
    render();
    const field = boardRoot.querySelector(`${taskSelector(task.id)} input[name="title"]`);
    if (field instanceof HTMLInputElement) {
      field.focus();
      field.select();
    }
  } else if (name === 'cancel') {
    finishRename(task.id);
  }
});

boardRoot.addEventListener('submit', (event) => {
  const renameForm = event.target;
  if (!(renameForm instanceof HTMLFormElement) || !renameForm.classList.contains('rename')) return;
  event.preventDefault();
  const id = view.editingId;
  const field = renameForm.elements.namedItem('title');
  if (id === null || !(field instanceof HTMLInputElement)) return;
  // 和添加任务时用同一条标题规则
  const parsed = parseTitle(field.value);
  if (!parsed.ok) {
    view = { editingId: id, draft: field.value, renameError: parsed.error };
    render();
    const again = boardRoot.querySelector(`${taskSelector(id)} input[name="title"]`);
    if (again instanceof HTMLInputElement) again.focus();
    return;
  }
  const before = board;
  board = reduce(board, { type: 'rename', id, title: parsed.title });
  if (board !== before) announce.textContent = `已改名：${parsed.title}`;
  finishRename(id);
});

// 记下正在输入的内容（只更新状态，不重新渲染：重新渲染会换掉输入框，光标的位置也会丢）
boardRoot.addEventListener('input', (event) => {
  if (view.editingId === null || !(event.target instanceof HTMLInputElement) || event.target.name !== 'title') return;
  const field = event.target;
  if (view.renameError !== null) {
    // 用户开始修改时错误提示消失（和添加任务的表单一样）：页面上只有这几处和新的状态不一致，直接改掉
    field.removeAttribute('aria-invalid');
    field.removeAttribute('aria-describedby');
    field.form?.querySelector('p.error')?.remove();
  }
  view = { ...view, draft: field.value, renameError: null };
});

boardRoot.addEventListener('keydown', (event) => {
  // 用输入法组字时按的 Esc 是给输入法的（取消组字），不是取消改名
  if (event.key !== 'Escape' || event.isComposing || view.editingId === null) return;
  if (event.target instanceof Element && event.target.closest('form.rename') !== null) finishRename(view.editingId);
});
```
:::

:::files{role=tests}
```ts file=rename.test.ts
import { expect, test } from 'vitest';
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

const button = (name: string) => screen.getByRole('button', { name });
const titleField = () => screen.getByRole('textbox', { name: '新的标题' });
const titles = (column: RegExp) => [...screen.getByRole('region', { name: column }).querySelectorAll('li.task .title')].map((n) => n.textContent);
const status = () => screen.getByRole('status');

test('点“改名”：任务变成表单，输入框显示原来的标题，获得焦点并选中全部文字', async () => {
  const user = userEvent.setup();
  await user.click(button('改名：写周报'));
  const field = titleField();
  expect(field).toHaveValue('写周报');
  expect(field).toHaveFocus();
  if (!(field instanceof HTMLInputElement)) throw new Error('应该是输入框');
  expect([field.selectionStart, field.selectionEnd]).toEqual([0, 3]);
  expect(screen.queryByRole('button', { name: '改名：写周报' })).toBeNull();
  expect(button('保存')).toBeInTheDocument();
  expect(button('改名：修自行车')).toBeInTheDocument();
  expect(field.closest('li')?.textContent, '编辑时标签仍然显示').toContain('#工作');
});

test('回车保存：去掉首尾空白，标签保留，焦点回到“改名”按钮，播报结果', async () => {
  const user = userEvent.setup();
  await user.click(button('改名：写周报'));
  await user.keyboard('  写周报（第 42 周）  {Enter}');
  expect(titles(/^待办/)).toEqual(['写周报（第 42 周）']);
  expect(screen.queryByRole('textbox', { name: '新的标题' })).toBeNull();
  expect(button('改名：写周报（第 42 周）')).toHaveFocus();
  expect(status()).toHaveTextContent('已改名：写周报（第 42 周）');
  const item = button('改名：写周报（第 42 周）').closest('li');
  expect(item?.textContent).toContain('#工作');
});

test('点“保存”按钮也能保存', async () => {
  const user = userEvent.setup();
  await user.click(button('改名：修自行车'));
  await user.clear(titleField());
  await user.type(titleField(), '修好自行车');
  await user.click(button('保存'));
  expect(titles(/^进行中/)).toEqual(['修好自行车']);
  expect(button('改名：修好自行车')).toHaveFocus();
});

test('Esc 或“取消”：不保存，焦点回到“改名”按钮', async () => {
  const user = userEvent.setup();
  await user.click(button('改名：写周报'));
  await user.keyboard('随便写写{Escape}');
  expect(titles(/^待办/)).toEqual(['写周报']);
  expect(button('改名：写周报')).toHaveFocus();
  await user.click(button('改名：写周报'));
  await user.keyboard('又写了一些');
  await user.click(button('取消'));
  expect(titles(/^待办/)).toEqual(['写周报']);
  expect(button('改名：写周报')).toHaveFocus();
});

test('标题为空时不保存：显示原因，标记输入框，留在编辑状态', async () => {
  const prevented: boolean[] = [];
  document.addEventListener('submit', (event) => prevented.push(event.defaultPrevented));
  const user = userEvent.setup();
  await user.click(button('改名：写周报'));
  await user.clear(titleField());
  await user.keyboard('{Enter}');
  expect(prevented).toEqual([true]);
  expect(screen.getByRole('alert')).toHaveTextContent('标题不能为空');
  expect(titleField()).toHaveAttribute('aria-invalid', 'true');
  const describedBy = titleField().getAttribute('aria-describedby') ?? '';
  expect(document.getElementById(describedBy), '输入框的 aria-describedby 指向错误说明').toHaveTextContent('标题不能为空');
  expect(titleField(), '输入框中仍是用户输入的内容').toHaveValue('');
  expect(titleField()).toHaveFocus();
  await user.keyboard('写');
  expect(screen.queryByRole('alert'), '用户修改输入框时，错误提示消失').toBeNull();
  expect(titleField()).not.toHaveAttribute('aria-invalid');
  expect(titleField()).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(titles(/^待办/)).toEqual(['写周报']);
});

test('新标题和添加任务时的规则一样：空白合并成一个空格，不超过 40 个字符', async () => {
  const user = userEvent.setup();
  await user.click(button('改名：写周报'));
  await user.keyboard('字'.repeat(41) + '{Enter}');
  expect(screen.getByRole('alert')).toHaveTextContent('标题不能超过 40 个字符');
  expect(titleField()).toHaveValue('字'.repeat(41));
  await user.clear(titleField());
  await user.type(titleField(), '  写   周报 #家 {Enter}');
  expect(titles(/^待办/)).toEqual(['写 周报 #家']);
  expect(status()).toHaveTextContent('已改名：写 周报 #家');
});

test('编辑时因为别的操作重新渲染，表单和正在输入的内容都还在', async () => {
  const user = userEvent.setup();
  await user.click(button('改名：写周报'));
  await user.clear(titleField());
  await user.type(titleField(), '写月报');
  await user.click(button('右移：修自行车'));
  expect(titleField()).toHaveValue('写月报');
  await user.clear(titleField());
  await user.keyboard('{Enter}');
  expect(screen.getByRole('alert')).toHaveTextContent('标题不能为空');
  await user.type(titleField(), '写季报');
  await user.click(button('删除：买牛奶'));
  expect(titleField()).toHaveValue('写季报');
  await user.click(titleField());
  await user.keyboard('{Enter}');
  expect(titles(/^待办/)).toEqual(['写季报']);
});

test('同一时间只编辑一个任务；编辑时其他任务的按钮照常工作', async () => {
  const user = userEvent.setup();
  await user.click(button('改名：写周报'));
  await user.click(button('改名：买牛奶'));
  expect(screen.getAllByRole('textbox', { name: '新的标题' })).toHaveLength(1);
  expect(titleField()).toHaveValue('买牛奶');
  expect(titles(/^待办/)).toEqual(['写周报']);
  await user.click(button('右移：修自行车'));
  expect(within(screen.getByRole('region', { name: /^已完成/ })).getByRole('textbox', { name: '新的标题' })).toBeInTheDocument();
});
```
:::

:::hint{level=1}
用一个变量 `view` 保存界面状态，写一个 `render()` 调用 `renderBoard(boardRoot, board, view)`。进入编辑：`view = { editingId: task.id, draft: task.title, renameError: null }`、`render()`，再找到新的输入框，`focus()` 之后 `select()`。保存和取消都调用同一个 `finishRename(id)`：`view = NOT_EDITING`、`render()`、聚焦“改名”按钮。
:::

:::hint{level=2}
`boardRoot.addEventListener('submit', …)` 中，`event.target` 就是被提交的表单；用 `form.elements.namedItem('title')` 取得输入框，检查它是 `HTMLInputElement`。`input` 事件中只更新 `view.draft`，不要重新渲染。`keydown` 中检查 `event.key === 'Escape'`，并且事件来自改名的表单（`closest('form.rename')`）。在 `render.ts` 中，`renderTask` 多接收一个 `view` 参数，`task.id === view.editingId` 时返回表单，输入框的 `value` 是 `view.draft`。
:::

:::explanation
就地编辑的关键是**界面状态**：`editingId` 决定哪个任务显示成表单，`draft` 是输入框中正在输入的内容，`renameError` 决定要不要显示错误。它们和 `board` 一起交给 `renderBoard`，渲染函数仍然是纯粹的“状态 → 页面”，任何时候重新渲染都能得到正确的界面。常见的错误写法是直接在 DOM 中把一个 `li` 换成表单：下一次因为别的原因重新渲染（例如另一个任务被移动了），表单就会消失；只记下 `editingId`、每次都用原来的标题填输入框，用户输入到一半的内容同样会丢（倒数第二个测试）。

`draft` 在 `input` 事件中更新，但这时**不重新渲染**：重新渲染会换掉正在输入的输入框，光标的位置、输入法正在组的字都会丢。输入框自己显示着用户输入的内容，状态只需要“记住”它，等下一次因为别的原因渲染时用上。

焦点的规则和 g09 的可编辑标题一样：打开时聚焦并选中文字，用户可以直接输入新的标题；结束时回到触发它的“改名”按钮。不同的是这里没有 `flushSync`：原生 DOM 的 `render()` 是同步的，调用返回时新的元素已经在页面上了，可以直接查找并聚焦。

事件委托在这里不只是为了方便：表单、输入框、取消按钮都是每次渲染新生成的，监听器只能放在不会被替换的 `boardRoot` 上。`submit`、`input` 和 `keydown` 都会冒泡，所以一个 `boardRoot` 就能接住所有任务的表单。

标题的检查和添加任务时用同一个 `parseTitle`：如果改名时只检查“不为空”，就能存进去一个 41 个字符的标题，p1-05 读取保存的数据时会拒绝它。出错时的处理也和添加任务时一样：留在原处、说明原因、标记输入框、保留用户的输入，用户开始修改时错误提示消失（p1-02）。因为输入时不重新渲染，`input` 处理函数直接去掉页面上的错误说明和 `aria-invalid`，同时把 `renameError` 设为 `null`：页面和状态仍然一致。错误的 `p` 有 `role="alert"`，出现时就会被读出。

按 Esc 时如果正在用输入法组字（`event.isComposing` 为 `true`），这一下是给输入法的（取消正在组的字），不应该退出编辑。
:::

:::variant{kind=alt name=form-data}
```ts file=render.ts
import { columnsOf, STATUSES, type Board, type Task } from './board';
import { el } from './dom';

export const COLUMN_NAMES = { todo: '待办', doing: '进行中', done: '已完成' } as const;

function actionButton(action: 'left' | 'right' | 'rename' | 'remove', label: string, icon: string, disabled = false): HTMLButtonElement {
  const button = el('button', { type: 'button', 'data-action': action, 'aria-label': label }, el('span', { 'aria-hidden': 'true' }, icon));
  button.disabled = disabled;
  return button;
}

function tagList(task: Task): HTMLUListElement[] {
  return task.tags.length === 0 ? [] : [el('ul', { class: 'tags', 'aria-label': '标签' }, ...task.tags.map((tag) => el('li', {}, `#${tag}`)))];
}

function actions(task: Task): HTMLDivElement {
  const position = STATUSES.indexOf(task.status);
  return el(
    'div',
    { class: 'actions' },
    actionButton('left', `左移：${task.title}`, '←', position === 0),
    actionButton('right', `右移：${task.title}`, '→', position === STATUSES.length - 1),
    actionButton('rename', `改名：${task.title}`, '✎'),
    actionButton('remove', `删除：${task.title}`, '×'),
  );
}

/** 界面状态：正在改名的任务、输入框中正在输入的内容、改名的错误 */
export type View = Readonly<{ editingId: string | null; draft: string; renameError: string | null }>;

export const NOT_EDITING: View = { editingId: null, draft: '', renameError: null };

function renderEditing(task: Task, view: View): HTMLLIElement {
  const field = document.createElement('input');
  field.name = 'title';
  field.autocomplete = 'off';
  field.defaultValue = view.draft;
  const form = el('form', { class: 'rename', novalidate: '' }, el('label', {}, '新的标题 ', field));
  if (view.renameError !== null) {
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', `rename-error-${task.id}`);
    form.append(el('p', { class: 'error', role: 'alert', id: `rename-error-${task.id}` }, view.renameError));
  }
  form.append(el('button', { type: 'submit' }, '保存'), el('button', { type: 'button', 'data-action': 'cancel' }, '取消'));
  return el('li', { class: 'task editing', 'data-id': task.id }, form, ...tagList(task));
}

function renderTask(task: Task, view: View): HTMLLIElement {
  if (task.id === view.editingId) return renderEditing(task, view);
  return el('li', { class: 'task', 'data-id': task.id }, el('span', { class: 'title' }, task.title), ...tagList(task), actions(task));
}

export function renderBoard(root: HTMLElement, board: Board, view: View = NOT_EDITING): void {
  const columns = columnsOf(board);
  root.replaceChildren(
    ...STATUSES.map((status) => {
      const tasks = columns[status];
      const headingId = `column-${status}`;
      return el(
        'section',
        { class: 'column', 'data-status': status, 'aria-labelledby': headingId },
        el('h2', { id: headingId, tabindex: '-1' }, `${COLUMN_NAMES[status]} `, el('span', { class: 'count' }, String(tasks.length))),
        tasks.length === 0 ? el('p', { class: 'empty' }, '没有任务') : el('ul', {}, ...tasks.map((task) => renderTask(task, view))),
      );
    }),
  );
}
```
```ts file=main.ts
import { reduce, type Action, type Board } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { COLUMN_NAMES, NOT_EDITING, renderBoard, type View } from './render';
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
let view: View = NOT_EDITING;

function render(): void {
  renderBoard(boardRoot, board, view);
}

/** 计算新的状态；有变化时重新渲染 */
function dispatch(action: Action): void {
  const next = reduce(board, action);
  if (next === board) return;
  board = next;
  render();
}

const taskSelector = (id: string) => `li[data-id="${CSS.escape(id)}"]`;

/** 聚焦任务板中符合 selector 的元素；找不到或者是禁用的按钮时返回 false */
function focusIn(selector: string): boolean {
  const target = boardRoot.querySelector(selector);
  if (!(target instanceof HTMLElement) || (target instanceof HTMLButtonElement && target.disabled)) return false;
  target.focus();
  return true;
}

/** 结束改名：回到普通的显示，焦点回到这个任务的“改名”按钮 */
function finishRename(id: string): void {
  view = NOT_EDITING;
  render();
  focusIn(`${taskSelector(id)} [data-action="rename"]`);
}

render();

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
  input.focus();
  if (!parsed.ok) {
    showError(parsed.error);
    return;
  }
  clearError();
  dispatch({ type: 'add', title: parsed.title, tags: parsed.tags, now: Date.now() });
  input.value = '';
  announce.textContent = `已添加：${parsed.title}`;
});

input.addEventListener('input', clearError);

boardRoot.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('button[data-action]');
  const item = button?.closest('li.task');
  if (!(button instanceof HTMLButtonElement) || !(item instanceof HTMLElement)) return;
  const task = board.tasks.find((t) => t.id === item.dataset['id']);
  if (task === undefined) return;
  const name = button.dataset['action'];
  if (name === 'left' || name === 'right') {
    dispatch({ type: 'step', id: task.id, direction: name === 'left' ? -1 : 1 });
    const moved = board.tasks.find((t) => t.id === task.id);
    if (moved !== undefined) announce.textContent = `已移到“${COLUMN_NAMES[moved.status]}”：${task.title}`;
    const other = name === 'left' ? 'right' : 'left';
    if (!focusIn(`${taskSelector(task.id)} [data-action="${name}"]`)) focusIn(`${taskSelector(task.id)} [data-action="${other}"]`);
  } else if (name === 'remove') {
    dispatch({ type: 'remove', id: task.id });
    announce.textContent = `已删除：${task.title}`;
    focusIn(`#column-${task.status}`);
  } else if (name === 'rename') {
    view = { editingId: task.id, draft: task.title, renameError: null };
    render();
    const field = boardRoot.querySelector(`${taskSelector(task.id)} input[name="title"]`);
    if (field instanceof HTMLInputElement) {
      field.focus();
      field.select();
    }
  } else if (name === 'cancel') {
    finishRename(task.id);
  }
});

boardRoot.addEventListener('submit', (event) => {
  const renameForm = event.target;
  if (!(renameForm instanceof HTMLFormElement) || !renameForm.classList.contains('rename')) return;
  event.preventDefault();
  const id = view.editingId;
  const raw = new FormData(renameForm).get('title');
  if (id === null || typeof raw !== 'string') return;
  // 和添加任务时用同一条标题规则
  const parsed = parseTitle(raw);
  if (!parsed.ok) {
    view = { editingId: id, draft: raw, renameError: parsed.error };
    render();
    const again = boardRoot.querySelector(`${taskSelector(id)} input[name="title"]`);
    if (again instanceof HTMLInputElement) again.focus();
    return;
  }
  const before = board;
  board = reduce(board, { type: 'rename', id, title: parsed.title });
  if (board !== before) announce.textContent = `已改名：${parsed.title}`;
  finishRename(id);
});

// 记下正在输入的内容（只更新状态，不重新渲染：重新渲染会换掉输入框，光标的位置也会丢）
boardRoot.addEventListener('input', (event) => {
  if (view.editingId === null || !(event.target instanceof HTMLInputElement) || event.target.name !== 'title') return;
  const field = event.target;
  if (view.renameError !== null) {
    // 用户开始修改时错误提示消失（和添加任务的表单一样）：页面上只有这几处和新的状态不一致，直接改掉
    field.removeAttribute('aria-invalid');
    field.removeAttribute('aria-describedby');
    field.form?.querySelector('p.error')?.remove();
  }
  view = { ...view, draft: field.value, renameError: null };
});

boardRoot.addEventListener('keydown', (event) => {
  // 用输入法组字时按的 Esc 是给输入法的（取消组字），不是取消改名
  if (event.key !== 'Escape' || event.isComposing || view.editingId === null) return;
  if (event.target instanceof Element && event.target.closest('form.rename') !== null) finishRename(view.editingId);
});
```
:::

:::variant{kind=wrong name=no-select fails=tests reason="进入编辑时没有选中文字"}
```ts file=render.ts
import { columnsOf, STATUSES, type Board, type Task } from './board';
import { el } from './dom';

export const COLUMN_NAMES = { todo: '待办', doing: '进行中', done: '已完成' } as const;

function actionButton(action: 'left' | 'right' | 'rename' | 'remove', label: string, icon: string, disabled = false): HTMLButtonElement {
  const button = el('button', { type: 'button', 'data-action': action, 'aria-label': label }, el('span', { 'aria-hidden': 'true' }, icon));
  button.disabled = disabled;
  return button;
}

function tagList(task: Task): HTMLUListElement[] {
  return task.tags.length === 0 ? [] : [el('ul', { class: 'tags', 'aria-label': '标签' }, ...task.tags.map((tag) => el('li', {}, `#${tag}`)))];
}

function actions(task: Task): HTMLDivElement {
  const position = STATUSES.indexOf(task.status);
  return el(
    'div',
    { class: 'actions' },
    actionButton('left', `左移：${task.title}`, '←', position === 0),
    actionButton('right', `右移：${task.title}`, '→', position === STATUSES.length - 1),
    actionButton('rename', `改名：${task.title}`, '✎'),
    actionButton('remove', `删除：${task.title}`, '×'),
  );
}

/** 界面状态：正在改名的任务、输入框中正在输入的内容、改名的错误 */
export type View = Readonly<{ editingId: string | null; draft: string; renameError: string | null }>;

export const NOT_EDITING: View = { editingId: null, draft: '', renameError: null };

function renderEditing(task: Task, view: View): HTMLLIElement {
  const field = el('input', { name: 'title', autocomplete: 'off' });
  field.value = view.draft;
  const form = el('form', { class: 'rename', novalidate: '' }, el('label', {}, '新的标题 ', field));
  if (view.renameError !== null) {
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', `rename-error-${task.id}`);
    form.append(el('p', { class: 'error', role: 'alert', id: `rename-error-${task.id}` }, view.renameError));
  }
  form.append(el('button', { type: 'submit' }, '保存'), el('button', { type: 'button', 'data-action': 'cancel' }, '取消'));
  return el('li', { class: 'task editing', 'data-id': task.id }, form, ...tagList(task));
}

function renderTask(task: Task, view: View): HTMLLIElement {
  if (task.id === view.editingId) return renderEditing(task, view);
  return el('li', { class: 'task', 'data-id': task.id }, el('span', { class: 'title' }, task.title), ...tagList(task), actions(task));
}

export function renderBoard(root: HTMLElement, board: Board, view: View = NOT_EDITING): void {
  const columns = columnsOf(board);
  root.replaceChildren(
    ...STATUSES.map((status) => {
      const tasks = columns[status];
      const headingId = `column-${status}`;
      return el(
        'section',
        { class: 'column', 'data-status': status, 'aria-labelledby': headingId },
        el('h2', { id: headingId, tabindex: '-1' }, `${COLUMN_NAMES[status]} `, el('span', { class: 'count' }, String(tasks.length))),
        tasks.length === 0 ? el('p', { class: 'empty' }, '没有任务') : el('ul', {}, ...tasks.map((task) => renderTask(task, view))),
      );
    }),
  );
}
```
```ts file=main.ts
import { reduce, type Action, type Board } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { COLUMN_NAMES, NOT_EDITING, renderBoard, type View } from './render';
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
let view: View = NOT_EDITING;

function render(): void {
  renderBoard(boardRoot, board, view);
}

/** 计算新的状态；有变化时重新渲染 */
function dispatch(action: Action): void {
  const next = reduce(board, action);
  if (next === board) return;
  board = next;
  render();
}

const taskSelector = (id: string) => `li[data-id="${CSS.escape(id)}"]`;

/** 聚焦任务板中符合 selector 的元素；找不到或者是禁用的按钮时返回 false */
function focusIn(selector: string): boolean {
  const target = boardRoot.querySelector(selector);
  if (!(target instanceof HTMLElement) || (target instanceof HTMLButtonElement && target.disabled)) return false;
  target.focus();
  return true;
}

/** 结束改名：回到普通的显示，焦点回到这个任务的“改名”按钮 */
function finishRename(id: string): void {
  view = NOT_EDITING;
  render();
  focusIn(`${taskSelector(id)} [data-action="rename"]`);
}

render();

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
  input.focus();
  if (!parsed.ok) {
    showError(parsed.error);
    return;
  }
  clearError();
  dispatch({ type: 'add', title: parsed.title, tags: parsed.tags, now: Date.now() });
  input.value = '';
  announce.textContent = `已添加：${parsed.title}`;
});

input.addEventListener('input', clearError);

boardRoot.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('button[data-action]');
  const item = button?.closest('li.task');
  if (!(button instanceof HTMLButtonElement) || !(item instanceof HTMLElement)) return;
  const task = board.tasks.find((t) => t.id === item.dataset['id']);
  if (task === undefined) return;
  const name = button.dataset['action'];
  if (name === 'left' || name === 'right') {
    dispatch({ type: 'step', id: task.id, direction: name === 'left' ? -1 : 1 });
    const moved = board.tasks.find((t) => t.id === task.id);
    if (moved !== undefined) announce.textContent = `已移到“${COLUMN_NAMES[moved.status]}”：${task.title}`;
    const other = name === 'left' ? 'right' : 'left';
    if (!focusIn(`${taskSelector(task.id)} [data-action="${name}"]`)) focusIn(`${taskSelector(task.id)} [data-action="${other}"]`);
  } else if (name === 'remove') {
    dispatch({ type: 'remove', id: task.id });
    announce.textContent = `已删除：${task.title}`;
    focusIn(`#column-${task.status}`);
  } else if (name === 'rename') {
    view = { editingId: task.id, draft: task.title, renameError: null };
    render();
    const field = boardRoot.querySelector(`${taskSelector(task.id)} input[name="title"]`);
    if (field instanceof HTMLInputElement) {
      field.focus();
    }
  } else if (name === 'cancel') {
    finishRename(task.id);
  }
});

boardRoot.addEventListener('submit', (event) => {
  const renameForm = event.target;
  if (!(renameForm instanceof HTMLFormElement) || !renameForm.classList.contains('rename')) return;
  event.preventDefault();
  const id = view.editingId;
  const field = renameForm.elements.namedItem('title');
  if (id === null || !(field instanceof HTMLInputElement)) return;
  // 和添加任务时用同一条标题规则
  const parsed = parseTitle(field.value);
  if (!parsed.ok) {
    view = { editingId: id, draft: field.value, renameError: parsed.error };
    render();
    const again = boardRoot.querySelector(`${taskSelector(id)} input[name="title"]`);
    if (again instanceof HTMLInputElement) again.focus();
    return;
  }
  const before = board;
  board = reduce(board, { type: 'rename', id, title: parsed.title });
  if (board !== before) announce.textContent = `已改名：${parsed.title}`;
  finishRename(id);
});

// 记下正在输入的内容（只更新状态，不重新渲染：重新渲染会换掉输入框，光标的位置也会丢）
boardRoot.addEventListener('input', (event) => {
  if (view.editingId === null || !(event.target instanceof HTMLInputElement) || event.target.name !== 'title') return;
  const field = event.target;
  if (view.renameError !== null) {
    // 用户开始修改时错误提示消失（和添加任务的表单一样）：页面上只有这几处和新的状态不一致，直接改掉
    field.removeAttribute('aria-invalid');
    field.removeAttribute('aria-describedby');
    field.form?.querySelector('p.error')?.remove();
  }
  view = { ...view, draft: field.value, renameError: null };
});

boardRoot.addEventListener('keydown', (event) => {
  // 用输入法组字时按的 Esc 是给输入法的（取消组字），不是取消改名
  if (event.key !== 'Escape' || event.isComposing || view.editingId === null) return;
  if (event.target instanceof Element && event.target.closest('form.rename') !== null) finishRename(view.editingId);
});
```
:::

:::variant{kind=wrong name=focus-lost fails=tests reason="保存、取消之后焦点没有回到“改名”按钮"}
```ts file=render.ts
import { columnsOf, STATUSES, type Board, type Task } from './board';
import { el } from './dom';

export const COLUMN_NAMES = { todo: '待办', doing: '进行中', done: '已完成' } as const;

function actionButton(action: 'left' | 'right' | 'rename' | 'remove', label: string, icon: string, disabled = false): HTMLButtonElement {
  const button = el('button', { type: 'button', 'data-action': action, 'aria-label': label }, el('span', { 'aria-hidden': 'true' }, icon));
  button.disabled = disabled;
  return button;
}

function tagList(task: Task): HTMLUListElement[] {
  return task.tags.length === 0 ? [] : [el('ul', { class: 'tags', 'aria-label': '标签' }, ...task.tags.map((tag) => el('li', {}, `#${tag}`)))];
}

function actions(task: Task): HTMLDivElement {
  const position = STATUSES.indexOf(task.status);
  return el(
    'div',
    { class: 'actions' },
    actionButton('left', `左移：${task.title}`, '←', position === 0),
    actionButton('right', `右移：${task.title}`, '→', position === STATUSES.length - 1),
    actionButton('rename', `改名：${task.title}`, '✎'),
    actionButton('remove', `删除：${task.title}`, '×'),
  );
}

/** 界面状态：正在改名的任务、输入框中正在输入的内容、改名的错误 */
export type View = Readonly<{ editingId: string | null; draft: string; renameError: string | null }>;

export const NOT_EDITING: View = { editingId: null, draft: '', renameError: null };

function renderEditing(task: Task, view: View): HTMLLIElement {
  const field = el('input', { name: 'title', autocomplete: 'off' });
  field.value = view.draft;
  const form = el('form', { class: 'rename', novalidate: '' }, el('label', {}, '新的标题 ', field));
  if (view.renameError !== null) {
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', `rename-error-${task.id}`);
    form.append(el('p', { class: 'error', role: 'alert', id: `rename-error-${task.id}` }, view.renameError));
  }
  form.append(el('button', { type: 'submit' }, '保存'), el('button', { type: 'button', 'data-action': 'cancel' }, '取消'));
  return el('li', { class: 'task editing', 'data-id': task.id }, form, ...tagList(task));
}

function renderTask(task: Task, view: View): HTMLLIElement {
  if (task.id === view.editingId) return renderEditing(task, view);
  return el('li', { class: 'task', 'data-id': task.id }, el('span', { class: 'title' }, task.title), ...tagList(task), actions(task));
}

export function renderBoard(root: HTMLElement, board: Board, view: View = NOT_EDITING): void {
  const columns = columnsOf(board);
  root.replaceChildren(
    ...STATUSES.map((status) => {
      const tasks = columns[status];
      const headingId = `column-${status}`;
      return el(
        'section',
        { class: 'column', 'data-status': status, 'aria-labelledby': headingId },
        el('h2', { id: headingId, tabindex: '-1' }, `${COLUMN_NAMES[status]} `, el('span', { class: 'count' }, String(tasks.length))),
        tasks.length === 0 ? el('p', { class: 'empty' }, '没有任务') : el('ul', {}, ...tasks.map((task) => renderTask(task, view))),
      );
    }),
  );
}
```
```ts file=main.ts
import { reduce, type Action, type Board } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { COLUMN_NAMES, NOT_EDITING, renderBoard, type View } from './render';
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
let view: View = NOT_EDITING;

function render(): void {
  renderBoard(boardRoot, board, view);
}

/** 计算新的状态；有变化时重新渲染 */
function dispatch(action: Action): void {
  const next = reduce(board, action);
  if (next === board) return;
  board = next;
  render();
}

const taskSelector = (id: string) => `li[data-id="${CSS.escape(id)}"]`;

/** 聚焦任务板中符合 selector 的元素；找不到或者是禁用的按钮时返回 false */
function focusIn(selector: string): boolean {
  const target = boardRoot.querySelector(selector);
  if (!(target instanceof HTMLElement) || (target instanceof HTMLButtonElement && target.disabled)) return false;
  target.focus();
  return true;
}

/** 结束改名：回到普通的显示，焦点回到这个任务的“改名”按钮 */
function finishRename(id: string): void {
  view = NOT_EDITING;
  render();
}

render();

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
  input.focus();
  if (!parsed.ok) {
    showError(parsed.error);
    return;
  }
  clearError();
  dispatch({ type: 'add', title: parsed.title, tags: parsed.tags, now: Date.now() });
  input.value = '';
  announce.textContent = `已添加：${parsed.title}`;
});

input.addEventListener('input', clearError);

boardRoot.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('button[data-action]');
  const item = button?.closest('li.task');
  if (!(button instanceof HTMLButtonElement) || !(item instanceof HTMLElement)) return;
  const task = board.tasks.find((t) => t.id === item.dataset['id']);
  if (task === undefined) return;
  const name = button.dataset['action'];
  if (name === 'left' || name === 'right') {
    dispatch({ type: 'step', id: task.id, direction: name === 'left' ? -1 : 1 });
    const moved = board.tasks.find((t) => t.id === task.id);
    if (moved !== undefined) announce.textContent = `已移到“${COLUMN_NAMES[moved.status]}”：${task.title}`;
    const other = name === 'left' ? 'right' : 'left';
    if (!focusIn(`${taskSelector(task.id)} [data-action="${name}"]`)) focusIn(`${taskSelector(task.id)} [data-action="${other}"]`);
  } else if (name === 'remove') {
    dispatch({ type: 'remove', id: task.id });
    announce.textContent = `已删除：${task.title}`;
    focusIn(`#column-${task.status}`);
  } else if (name === 'rename') {
    view = { editingId: task.id, draft: task.title, renameError: null };
    render();
    const field = boardRoot.querySelector(`${taskSelector(task.id)} input[name="title"]`);
    if (field instanceof HTMLInputElement) {
      field.focus();
      field.select();
    }
  } else if (name === 'cancel') {
    finishRename(task.id);
  }
});

boardRoot.addEventListener('submit', (event) => {
  const renameForm = event.target;
  if (!(renameForm instanceof HTMLFormElement) || !renameForm.classList.contains('rename')) return;
  event.preventDefault();
  const id = view.editingId;
  const field = renameForm.elements.namedItem('title');
  if (id === null || !(field instanceof HTMLInputElement)) return;
  // 和添加任务时用同一条标题规则
  const parsed = parseTitle(field.value);
  if (!parsed.ok) {
    view = { editingId: id, draft: field.value, renameError: parsed.error };
    render();
    const again = boardRoot.querySelector(`${taskSelector(id)} input[name="title"]`);
    if (again instanceof HTMLInputElement) again.focus();
    return;
  }
  const before = board;
  board = reduce(board, { type: 'rename', id, title: parsed.title });
  if (board !== before) announce.textContent = `已改名：${parsed.title}`;
  finishRename(id);
});

// 记下正在输入的内容（只更新状态，不重新渲染：重新渲染会换掉输入框，光标的位置也会丢）
boardRoot.addEventListener('input', (event) => {
  if (view.editingId === null || !(event.target instanceof HTMLInputElement) || event.target.name !== 'title') return;
  const field = event.target;
  if (view.renameError !== null) {
    // 用户开始修改时错误提示消失（和添加任务的表单一样）：页面上只有这几处和新的状态不一致，直接改掉
    field.removeAttribute('aria-invalid');
    field.removeAttribute('aria-describedby');
    field.form?.querySelector('p.error')?.remove();
  }
  view = { ...view, draft: field.value, renameError: null };
});

boardRoot.addEventListener('keydown', (event) => {
  // 用输入法组字时按的 Esc 是给输入法的（取消组字），不是取消改名
  if (event.key !== 'Escape' || event.isComposing || view.editingId === null) return;
  if (event.target instanceof Element && event.target.closest('form.rename') !== null) finishRename(view.editingId);
});
```
:::

:::variant{kind=wrong name=no-prevent-default fails=tests reason="没有阻止改名表单默认的提交"}
```ts file=render.ts
import { columnsOf, STATUSES, type Board, type Task } from './board';
import { el } from './dom';

export const COLUMN_NAMES = { todo: '待办', doing: '进行中', done: '已完成' } as const;

function actionButton(action: 'left' | 'right' | 'rename' | 'remove', label: string, icon: string, disabled = false): HTMLButtonElement {
  const button = el('button', { type: 'button', 'data-action': action, 'aria-label': label }, el('span', { 'aria-hidden': 'true' }, icon));
  button.disabled = disabled;
  return button;
}

function tagList(task: Task): HTMLUListElement[] {
  return task.tags.length === 0 ? [] : [el('ul', { class: 'tags', 'aria-label': '标签' }, ...task.tags.map((tag) => el('li', {}, `#${tag}`)))];
}

function actions(task: Task): HTMLDivElement {
  const position = STATUSES.indexOf(task.status);
  return el(
    'div',
    { class: 'actions' },
    actionButton('left', `左移：${task.title}`, '←', position === 0),
    actionButton('right', `右移：${task.title}`, '→', position === STATUSES.length - 1),
    actionButton('rename', `改名：${task.title}`, '✎'),
    actionButton('remove', `删除：${task.title}`, '×'),
  );
}

/** 界面状态：正在改名的任务、输入框中正在输入的内容、改名的错误 */
export type View = Readonly<{ editingId: string | null; draft: string; renameError: string | null }>;

export const NOT_EDITING: View = { editingId: null, draft: '', renameError: null };

function renderEditing(task: Task, view: View): HTMLLIElement {
  const field = el('input', { name: 'title', autocomplete: 'off' });
  field.value = view.draft;
  const form = el('form', { class: 'rename', novalidate: '' }, el('label', {}, '新的标题 ', field));
  if (view.renameError !== null) {
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', `rename-error-${task.id}`);
    form.append(el('p', { class: 'error', role: 'alert', id: `rename-error-${task.id}` }, view.renameError));
  }
  form.append(el('button', { type: 'submit' }, '保存'), el('button', { type: 'button', 'data-action': 'cancel' }, '取消'));
  return el('li', { class: 'task editing', 'data-id': task.id }, form, ...tagList(task));
}

function renderTask(task: Task, view: View): HTMLLIElement {
  if (task.id === view.editingId) return renderEditing(task, view);
  return el('li', { class: 'task', 'data-id': task.id }, el('span', { class: 'title' }, task.title), ...tagList(task), actions(task));
}

export function renderBoard(root: HTMLElement, board: Board, view: View = NOT_EDITING): void {
  const columns = columnsOf(board);
  root.replaceChildren(
    ...STATUSES.map((status) => {
      const tasks = columns[status];
      const headingId = `column-${status}`;
      return el(
        'section',
        { class: 'column', 'data-status': status, 'aria-labelledby': headingId },
        el('h2', { id: headingId, tabindex: '-1' }, `${COLUMN_NAMES[status]} `, el('span', { class: 'count' }, String(tasks.length))),
        tasks.length === 0 ? el('p', { class: 'empty' }, '没有任务') : el('ul', {}, ...tasks.map((task) => renderTask(task, view))),
      );
    }),
  );
}
```
```ts file=main.ts
import { reduce, type Action, type Board } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { COLUMN_NAMES, NOT_EDITING, renderBoard, type View } from './render';
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
let view: View = NOT_EDITING;

function render(): void {
  renderBoard(boardRoot, board, view);
}

/** 计算新的状态；有变化时重新渲染 */
function dispatch(action: Action): void {
  const next = reduce(board, action);
  if (next === board) return;
  board = next;
  render();
}

const taskSelector = (id: string) => `li[data-id="${CSS.escape(id)}"]`;

/** 聚焦任务板中符合 selector 的元素；找不到或者是禁用的按钮时返回 false */
function focusIn(selector: string): boolean {
  const target = boardRoot.querySelector(selector);
  if (!(target instanceof HTMLElement) || (target instanceof HTMLButtonElement && target.disabled)) return false;
  target.focus();
  return true;
}

/** 结束改名：回到普通的显示，焦点回到这个任务的“改名”按钮 */
function finishRename(id: string): void {
  view = NOT_EDITING;
  render();
  focusIn(`${taskSelector(id)} [data-action="rename"]`);
}

render();

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
  input.focus();
  if (!parsed.ok) {
    showError(parsed.error);
    return;
  }
  clearError();
  dispatch({ type: 'add', title: parsed.title, tags: parsed.tags, now: Date.now() });
  input.value = '';
  announce.textContent = `已添加：${parsed.title}`;
});

input.addEventListener('input', clearError);

boardRoot.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('button[data-action]');
  const item = button?.closest('li.task');
  if (!(button instanceof HTMLButtonElement) || !(item instanceof HTMLElement)) return;
  const task = board.tasks.find((t) => t.id === item.dataset['id']);
  if (task === undefined) return;
  const name = button.dataset['action'];
  if (name === 'left' || name === 'right') {
    dispatch({ type: 'step', id: task.id, direction: name === 'left' ? -1 : 1 });
    const moved = board.tasks.find((t) => t.id === task.id);
    if (moved !== undefined) announce.textContent = `已移到“${COLUMN_NAMES[moved.status]}”：${task.title}`;
    const other = name === 'left' ? 'right' : 'left';
    if (!focusIn(`${taskSelector(task.id)} [data-action="${name}"]`)) focusIn(`${taskSelector(task.id)} [data-action="${other}"]`);
  } else if (name === 'remove') {
    dispatch({ type: 'remove', id: task.id });
    announce.textContent = `已删除：${task.title}`;
    focusIn(`#column-${task.status}`);
  } else if (name === 'rename') {
    view = { editingId: task.id, draft: task.title, renameError: null };
    render();
    const field = boardRoot.querySelector(`${taskSelector(task.id)} input[name="title"]`);
    if (field instanceof HTMLInputElement) {
      field.focus();
      field.select();
    }
  } else if (name === 'cancel') {
    finishRename(task.id);
  }
});

boardRoot.addEventListener('submit', (event) => {
  const renameForm = event.target;
  if (!(renameForm instanceof HTMLFormElement) || !renameForm.classList.contains('rename')) return;
  const id = view.editingId;
  const field = renameForm.elements.namedItem('title');
  if (id === null || !(field instanceof HTMLInputElement)) return;
  // 和添加任务时用同一条标题规则
  const parsed = parseTitle(field.value);
  if (!parsed.ok) {
    view = { editingId: id, draft: field.value, renameError: parsed.error };
    render();
    const again = boardRoot.querySelector(`${taskSelector(id)} input[name="title"]`);
    if (again instanceof HTMLInputElement) again.focus();
    return;
  }
  const before = board;
  board = reduce(board, { type: 'rename', id, title: parsed.title });
  if (board !== before) announce.textContent = `已改名：${parsed.title}`;
  finishRename(id);
});

// 记下正在输入的内容（只更新状态，不重新渲染：重新渲染会换掉输入框，光标的位置也会丢）
boardRoot.addEventListener('input', (event) => {
  if (view.editingId === null || !(event.target instanceof HTMLInputElement) || event.target.name !== 'title') return;
  const field = event.target;
  if (view.renameError !== null) {
    // 用户开始修改时错误提示消失（和添加任务的表单一样）：页面上只有这几处和新的状态不一致，直接改掉
    field.removeAttribute('aria-invalid');
    field.removeAttribute('aria-describedby');
    field.form?.querySelector('p.error')?.remove();
  }
  view = { ...view, draft: field.value, renameError: null };
});

boardRoot.addEventListener('keydown', (event) => {
  // 用输入法组字时按的 Esc 是给输入法的（取消组字），不是取消改名
  if (event.key !== 'Escape' || event.isComposing || view.editingId === null) return;
  if (event.target instanceof Element && event.target.closest('form.rename') !== null) finishRename(view.editingId);
});
```
:::

:::variant{kind=wrong name=no-escape fails=tests reason="没有处理 Esc"}
```ts file=render.ts
import { columnsOf, STATUSES, type Board, type Task } from './board';
import { el } from './dom';

export const COLUMN_NAMES = { todo: '待办', doing: '进行中', done: '已完成' } as const;

function actionButton(action: 'left' | 'right' | 'rename' | 'remove', label: string, icon: string, disabled = false): HTMLButtonElement {
  const button = el('button', { type: 'button', 'data-action': action, 'aria-label': label }, el('span', { 'aria-hidden': 'true' }, icon));
  button.disabled = disabled;
  return button;
}

function tagList(task: Task): HTMLUListElement[] {
  return task.tags.length === 0 ? [] : [el('ul', { class: 'tags', 'aria-label': '标签' }, ...task.tags.map((tag) => el('li', {}, `#${tag}`)))];
}

function actions(task: Task): HTMLDivElement {
  const position = STATUSES.indexOf(task.status);
  return el(
    'div',
    { class: 'actions' },
    actionButton('left', `左移：${task.title}`, '←', position === 0),
    actionButton('right', `右移：${task.title}`, '→', position === STATUSES.length - 1),
    actionButton('rename', `改名：${task.title}`, '✎'),
    actionButton('remove', `删除：${task.title}`, '×'),
  );
}

/** 界面状态：正在改名的任务、输入框中正在输入的内容、改名的错误 */
export type View = Readonly<{ editingId: string | null; draft: string; renameError: string | null }>;

export const NOT_EDITING: View = { editingId: null, draft: '', renameError: null };

function renderEditing(task: Task, view: View): HTMLLIElement {
  const field = el('input', { name: 'title', autocomplete: 'off' });
  field.value = view.draft;
  const form = el('form', { class: 'rename', novalidate: '' }, el('label', {}, '新的标题 ', field));
  if (view.renameError !== null) {
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', `rename-error-${task.id}`);
    form.append(el('p', { class: 'error', role: 'alert', id: `rename-error-${task.id}` }, view.renameError));
  }
  form.append(el('button', { type: 'submit' }, '保存'), el('button', { type: 'button', 'data-action': 'cancel' }, '取消'));
  return el('li', { class: 'task editing', 'data-id': task.id }, form, ...tagList(task));
}

function renderTask(task: Task, view: View): HTMLLIElement {
  if (task.id === view.editingId) return renderEditing(task, view);
  return el('li', { class: 'task', 'data-id': task.id }, el('span', { class: 'title' }, task.title), ...tagList(task), actions(task));
}

export function renderBoard(root: HTMLElement, board: Board, view: View = NOT_EDITING): void {
  const columns = columnsOf(board);
  root.replaceChildren(
    ...STATUSES.map((status) => {
      const tasks = columns[status];
      const headingId = `column-${status}`;
      return el(
        'section',
        { class: 'column', 'data-status': status, 'aria-labelledby': headingId },
        el('h2', { id: headingId, tabindex: '-1' }, `${COLUMN_NAMES[status]} `, el('span', { class: 'count' }, String(tasks.length))),
        tasks.length === 0 ? el('p', { class: 'empty' }, '没有任务') : el('ul', {}, ...tasks.map((task) => renderTask(task, view))),
      );
    }),
  );
}
```
```ts file=main.ts
import { reduce, type Action, type Board } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { COLUMN_NAMES, NOT_EDITING, renderBoard, type View } from './render';
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
let view: View = NOT_EDITING;

function render(): void {
  renderBoard(boardRoot, board, view);
}

/** 计算新的状态；有变化时重新渲染 */
function dispatch(action: Action): void {
  const next = reduce(board, action);
  if (next === board) return;
  board = next;
  render();
}

const taskSelector = (id: string) => `li[data-id="${CSS.escape(id)}"]`;

/** 聚焦任务板中符合 selector 的元素；找不到或者是禁用的按钮时返回 false */
function focusIn(selector: string): boolean {
  const target = boardRoot.querySelector(selector);
  if (!(target instanceof HTMLElement) || (target instanceof HTMLButtonElement && target.disabled)) return false;
  target.focus();
  return true;
}

/** 结束改名：回到普通的显示，焦点回到这个任务的“改名”按钮 */
function finishRename(id: string): void {
  view = NOT_EDITING;
  render();
  focusIn(`${taskSelector(id)} [data-action="rename"]`);
}

render();

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
  input.focus();
  if (!parsed.ok) {
    showError(parsed.error);
    return;
  }
  clearError();
  dispatch({ type: 'add', title: parsed.title, tags: parsed.tags, now: Date.now() });
  input.value = '';
  announce.textContent = `已添加：${parsed.title}`;
});

input.addEventListener('input', clearError);

boardRoot.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('button[data-action]');
  const item = button?.closest('li.task');
  if (!(button instanceof HTMLButtonElement) || !(item instanceof HTMLElement)) return;
  const task = board.tasks.find((t) => t.id === item.dataset['id']);
  if (task === undefined) return;
  const name = button.dataset['action'];
  if (name === 'left' || name === 'right') {
    dispatch({ type: 'step', id: task.id, direction: name === 'left' ? -1 : 1 });
    const moved = board.tasks.find((t) => t.id === task.id);
    if (moved !== undefined) announce.textContent = `已移到“${COLUMN_NAMES[moved.status]}”：${task.title}`;
    const other = name === 'left' ? 'right' : 'left';
    if (!focusIn(`${taskSelector(task.id)} [data-action="${name}"]`)) focusIn(`${taskSelector(task.id)} [data-action="${other}"]`);
  } else if (name === 'remove') {
    dispatch({ type: 'remove', id: task.id });
    announce.textContent = `已删除：${task.title}`;
    focusIn(`#column-${task.status}`);
  } else if (name === 'rename') {
    view = { editingId: task.id, draft: task.title, renameError: null };
    render();
    const field = boardRoot.querySelector(`${taskSelector(task.id)} input[name="title"]`);
    if (field instanceof HTMLInputElement) {
      field.focus();
      field.select();
    }
  } else if (name === 'cancel') {
    finishRename(task.id);
  }
});

boardRoot.addEventListener('submit', (event) => {
  const renameForm = event.target;
  if (!(renameForm instanceof HTMLFormElement) || !renameForm.classList.contains('rename')) return;
  event.preventDefault();
  const id = view.editingId;
  const field = renameForm.elements.namedItem('title');
  if (id === null || !(field instanceof HTMLInputElement)) return;
  // 和添加任务时用同一条标题规则
  const parsed = parseTitle(field.value);
  if (!parsed.ok) {
    view = { editingId: id, draft: field.value, renameError: parsed.error };
    render();
    const again = boardRoot.querySelector(`${taskSelector(id)} input[name="title"]`);
    if (again instanceof HTMLInputElement) again.focus();
    return;
  }
  const before = board;
  board = reduce(board, { type: 'rename', id, title: parsed.title });
  if (board !== before) announce.textContent = `已改名：${parsed.title}`;
  finishRename(id);
});

// 记下正在输入的内容（只更新状态，不重新渲染：重新渲染会换掉输入框，光标的位置也会丢）
boardRoot.addEventListener('input', (event) => {
  if (view.editingId === null || !(event.target instanceof HTMLInputElement) || event.target.name !== 'title') return;
  const field = event.target;
  if (view.renameError !== null) {
    // 用户开始修改时错误提示消失（和添加任务的表单一样）：页面上只有这几处和新的状态不一致，直接改掉
    field.removeAttribute('aria-invalid');
    field.removeAttribute('aria-describedby');
    field.form?.querySelector('p.error')?.remove();
  }
  view = { ...view, draft: field.value, renameError: null };
});

```
:::

:::variant{kind=wrong name=empty-exits fails=tests reason="标题不合法时直接退出了编辑，没有说明原因"}
```ts file=render.ts
import { columnsOf, STATUSES, type Board, type Task } from './board';
import { el } from './dom';

export const COLUMN_NAMES = { todo: '待办', doing: '进行中', done: '已完成' } as const;

function actionButton(action: 'left' | 'right' | 'rename' | 'remove', label: string, icon: string, disabled = false): HTMLButtonElement {
  const button = el('button', { type: 'button', 'data-action': action, 'aria-label': label }, el('span', { 'aria-hidden': 'true' }, icon));
  button.disabled = disabled;
  return button;
}

function tagList(task: Task): HTMLUListElement[] {
  return task.tags.length === 0 ? [] : [el('ul', { class: 'tags', 'aria-label': '标签' }, ...task.tags.map((tag) => el('li', {}, `#${tag}`)))];
}

function actions(task: Task): HTMLDivElement {
  const position = STATUSES.indexOf(task.status);
  return el(
    'div',
    { class: 'actions' },
    actionButton('left', `左移：${task.title}`, '←', position === 0),
    actionButton('right', `右移：${task.title}`, '→', position === STATUSES.length - 1),
    actionButton('rename', `改名：${task.title}`, '✎'),
    actionButton('remove', `删除：${task.title}`, '×'),
  );
}

/** 界面状态：正在改名的任务、输入框中正在输入的内容、改名的错误 */
export type View = Readonly<{ editingId: string | null; draft: string; renameError: string | null }>;

export const NOT_EDITING: View = { editingId: null, draft: '', renameError: null };

function renderEditing(task: Task, view: View): HTMLLIElement {
  const field = el('input', { name: 'title', autocomplete: 'off' });
  field.value = view.draft;
  const form = el('form', { class: 'rename', novalidate: '' }, el('label', {}, '新的标题 ', field));
  if (view.renameError !== null) {
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', `rename-error-${task.id}`);
    form.append(el('p', { class: 'error', role: 'alert', id: `rename-error-${task.id}` }, view.renameError));
  }
  form.append(el('button', { type: 'submit' }, '保存'), el('button', { type: 'button', 'data-action': 'cancel' }, '取消'));
  return el('li', { class: 'task editing', 'data-id': task.id }, form, ...tagList(task));
}

function renderTask(task: Task, view: View): HTMLLIElement {
  if (task.id === view.editingId) return renderEditing(task, view);
  return el('li', { class: 'task', 'data-id': task.id }, el('span', { class: 'title' }, task.title), ...tagList(task), actions(task));
}

export function renderBoard(root: HTMLElement, board: Board, view: View = NOT_EDITING): void {
  const columns = columnsOf(board);
  root.replaceChildren(
    ...STATUSES.map((status) => {
      const tasks = columns[status];
      const headingId = `column-${status}`;
      return el(
        'section',
        { class: 'column', 'data-status': status, 'aria-labelledby': headingId },
        el('h2', { id: headingId, tabindex: '-1' }, `${COLUMN_NAMES[status]} `, el('span', { class: 'count' }, String(tasks.length))),
        tasks.length === 0 ? el('p', { class: 'empty' }, '没有任务') : el('ul', {}, ...tasks.map((task) => renderTask(task, view))),
      );
    }),
  );
}
```
```ts file=main.ts
import { reduce, type Action, type Board } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { COLUMN_NAMES, NOT_EDITING, renderBoard, type View } from './render';
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
let view: View = NOT_EDITING;

function render(): void {
  renderBoard(boardRoot, board, view);
}

/** 计算新的状态；有变化时重新渲染 */
function dispatch(action: Action): void {
  const next = reduce(board, action);
  if (next === board) return;
  board = next;
  render();
}

const taskSelector = (id: string) => `li[data-id="${CSS.escape(id)}"]`;

/** 聚焦任务板中符合 selector 的元素；找不到或者是禁用的按钮时返回 false */
function focusIn(selector: string): boolean {
  const target = boardRoot.querySelector(selector);
  if (!(target instanceof HTMLElement) || (target instanceof HTMLButtonElement && target.disabled)) return false;
  target.focus();
  return true;
}

/** 结束改名：回到普通的显示，焦点回到这个任务的“改名”按钮 */
function finishRename(id: string): void {
  view = NOT_EDITING;
  render();
  focusIn(`${taskSelector(id)} [data-action="rename"]`);
}

render();

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
  input.focus();
  if (!parsed.ok) {
    showError(parsed.error);
    return;
  }
  clearError();
  dispatch({ type: 'add', title: parsed.title, tags: parsed.tags, now: Date.now() });
  input.value = '';
  announce.textContent = `已添加：${parsed.title}`;
});

input.addEventListener('input', clearError);

boardRoot.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('button[data-action]');
  const item = button?.closest('li.task');
  if (!(button instanceof HTMLButtonElement) || !(item instanceof HTMLElement)) return;
  const task = board.tasks.find((t) => t.id === item.dataset['id']);
  if (task === undefined) return;
  const name = button.dataset['action'];
  if (name === 'left' || name === 'right') {
    dispatch({ type: 'step', id: task.id, direction: name === 'left' ? -1 : 1 });
    const moved = board.tasks.find((t) => t.id === task.id);
    if (moved !== undefined) announce.textContent = `已移到“${COLUMN_NAMES[moved.status]}”：${task.title}`;
    const other = name === 'left' ? 'right' : 'left';
    if (!focusIn(`${taskSelector(task.id)} [data-action="${name}"]`)) focusIn(`${taskSelector(task.id)} [data-action="${other}"]`);
  } else if (name === 'remove') {
    dispatch({ type: 'remove', id: task.id });
    announce.textContent = `已删除：${task.title}`;
    focusIn(`#column-${task.status}`);
  } else if (name === 'rename') {
    view = { editingId: task.id, draft: task.title, renameError: null };
    render();
    const field = boardRoot.querySelector(`${taskSelector(task.id)} input[name="title"]`);
    if (field instanceof HTMLInputElement) {
      field.focus();
      field.select();
    }
  } else if (name === 'cancel') {
    finishRename(task.id);
  }
});

boardRoot.addEventListener('submit', (event) => {
  const renameForm = event.target;
  if (!(renameForm instanceof HTMLFormElement) || !renameForm.classList.contains('rename')) return;
  event.preventDefault();
  const id = view.editingId;
  const field = renameForm.elements.namedItem('title');
  if (id === null || !(field instanceof HTMLInputElement)) return;
  // 和添加任务时用同一条标题规则
  const parsed = parseTitle(field.value);
  if (!parsed.ok) {
    finishRename(id);
    return;
  }
  const before = board;
  board = reduce(board, { type: 'rename', id, title: parsed.title });
  if (board !== before) announce.textContent = `已改名：${parsed.title}`;
  finishRename(id);
});

// 记下正在输入的内容（只更新状态，不重新渲染：重新渲染会换掉输入框，光标的位置也会丢）
boardRoot.addEventListener('input', (event) => {
  if (view.editingId === null || !(event.target instanceof HTMLInputElement) || event.target.name !== 'title') return;
  const field = event.target;
  if (view.renameError !== null) {
    // 用户开始修改时错误提示消失（和添加任务的表单一样）：页面上只有这几处和新的状态不一致，直接改掉
    field.removeAttribute('aria-invalid');
    field.removeAttribute('aria-describedby');
    field.form?.querySelector('p.error')?.remove();
  }
  view = { ...view, draft: field.value, renameError: null };
});

boardRoot.addEventListener('keydown', (event) => {
  // 用输入法组字时按的 Esc 是给输入法的（取消组字），不是取消改名
  if (event.key !== 'Escape' || event.isComposing || view.editingId === null) return;
  if (event.target instanceof Element && event.target.closest('form.rename') !== null) finishRename(view.editingId);
});
```
:::

:::variant{kind=wrong name=only-check-empty fails=tests reason="改名时只检查标题不为空，没有用和添加任务时相同的规则（超长的标题也能保存）"}
```ts file=render.ts
import { columnsOf, STATUSES, type Board, type Task } from './board';
import { el } from './dom';

export const COLUMN_NAMES = { todo: '待办', doing: '进行中', done: '已完成' } as const;

function actionButton(action: 'left' | 'right' | 'rename' | 'remove', label: string, icon: string, disabled = false): HTMLButtonElement {
  const button = el('button', { type: 'button', 'data-action': action, 'aria-label': label }, el('span', { 'aria-hidden': 'true' }, icon));
  button.disabled = disabled;
  return button;
}

function tagList(task: Task): HTMLUListElement[] {
  return task.tags.length === 0 ? [] : [el('ul', { class: 'tags', 'aria-label': '标签' }, ...task.tags.map((tag) => el('li', {}, `#${tag}`)))];
}

function actions(task: Task): HTMLDivElement {
  const position = STATUSES.indexOf(task.status);
  return el(
    'div',
    { class: 'actions' },
    actionButton('left', `左移：${task.title}`, '←', position === 0),
    actionButton('right', `右移：${task.title}`, '→', position === STATUSES.length - 1),
    actionButton('rename', `改名：${task.title}`, '✎'),
    actionButton('remove', `删除：${task.title}`, '×'),
  );
}

/** 界面状态：正在改名的任务、输入框中正在输入的内容、改名的错误 */
export type View = Readonly<{ editingId: string | null; draft: string; renameError: string | null }>;

export const NOT_EDITING: View = { editingId: null, draft: '', renameError: null };

function renderEditing(task: Task, view: View): HTMLLIElement {
  const field = el('input', { name: 'title', autocomplete: 'off' });
  field.value = view.draft;
  const form = el('form', { class: 'rename', novalidate: '' }, el('label', {}, '新的标题 ', field));
  if (view.renameError !== null) {
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', `rename-error-${task.id}`);
    form.append(el('p', { class: 'error', role: 'alert', id: `rename-error-${task.id}` }, view.renameError));
  }
  form.append(el('button', { type: 'submit' }, '保存'), el('button', { type: 'button', 'data-action': 'cancel' }, '取消'));
  return el('li', { class: 'task editing', 'data-id': task.id }, form, ...tagList(task));
}

function renderTask(task: Task, view: View): HTMLLIElement {
  if (task.id === view.editingId) return renderEditing(task, view);
  return el('li', { class: 'task', 'data-id': task.id }, el('span', { class: 'title' }, task.title), ...tagList(task), actions(task));
}

export function renderBoard(root: HTMLElement, board: Board, view: View = NOT_EDITING): void {
  const columns = columnsOf(board);
  root.replaceChildren(
    ...STATUSES.map((status) => {
      const tasks = columns[status];
      const headingId = `column-${status}`;
      return el(
        'section',
        { class: 'column', 'data-status': status, 'aria-labelledby': headingId },
        el('h2', { id: headingId, tabindex: '-1' }, `${COLUMN_NAMES[status]} `, el('span', { class: 'count' }, String(tasks.length))),
        tasks.length === 0 ? el('p', { class: 'empty' }, '没有任务') : el('ul', {}, ...tasks.map((task) => renderTask(task, view))),
      );
    }),
  );
}
```
```ts file=main.ts
import { reduce, type Action, type Board } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { COLUMN_NAMES, NOT_EDITING, renderBoard, type View } from './render';
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
let view: View = NOT_EDITING;

function render(): void {
  renderBoard(boardRoot, board, view);
}

/** 计算新的状态；有变化时重新渲染 */
function dispatch(action: Action): void {
  const next = reduce(board, action);
  if (next === board) return;
  board = next;
  render();
}

const taskSelector = (id: string) => `li[data-id="${CSS.escape(id)}"]`;

/** 聚焦任务板中符合 selector 的元素；找不到或者是禁用的按钮时返回 false */
function focusIn(selector: string): boolean {
  const target = boardRoot.querySelector(selector);
  if (!(target instanceof HTMLElement) || (target instanceof HTMLButtonElement && target.disabled)) return false;
  target.focus();
  return true;
}

/** 结束改名：回到普通的显示，焦点回到这个任务的“改名”按钮 */
function finishRename(id: string): void {
  view = NOT_EDITING;
  render();
  focusIn(`${taskSelector(id)} [data-action="rename"]`);
}

render();

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
  input.focus();
  if (!parsed.ok) {
    showError(parsed.error);
    return;
  }
  clearError();
  dispatch({ type: 'add', title: parsed.title, tags: parsed.tags, now: Date.now() });
  input.value = '';
  announce.textContent = `已添加：${parsed.title}`;
});

input.addEventListener('input', clearError);

boardRoot.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('button[data-action]');
  const item = button?.closest('li.task');
  if (!(button instanceof HTMLButtonElement) || !(item instanceof HTMLElement)) return;
  const task = board.tasks.find((t) => t.id === item.dataset['id']);
  if (task === undefined) return;
  const name = button.dataset['action'];
  if (name === 'left' || name === 'right') {
    dispatch({ type: 'step', id: task.id, direction: name === 'left' ? -1 : 1 });
    const moved = board.tasks.find((t) => t.id === task.id);
    if (moved !== undefined) announce.textContent = `已移到“${COLUMN_NAMES[moved.status]}”：${task.title}`;
    const other = name === 'left' ? 'right' : 'left';
    if (!focusIn(`${taskSelector(task.id)} [data-action="${name}"]`)) focusIn(`${taskSelector(task.id)} [data-action="${other}"]`);
  } else if (name === 'remove') {
    dispatch({ type: 'remove', id: task.id });
    announce.textContent = `已删除：${task.title}`;
    focusIn(`#column-${task.status}`);
  } else if (name === 'rename') {
    view = { editingId: task.id, draft: task.title, renameError: null };
    render();
    const field = boardRoot.querySelector(`${taskSelector(task.id)} input[name="title"]`);
    if (field instanceof HTMLInputElement) {
      field.focus();
      field.select();
    }
  } else if (name === 'cancel') {
    finishRename(task.id);
  }
});

boardRoot.addEventListener('submit', (event) => {
  const renameForm = event.target;
  if (!(renameForm instanceof HTMLFormElement) || !renameForm.classList.contains('rename')) return;
  event.preventDefault();
  const id = view.editingId;
  const field = renameForm.elements.namedItem('title');
  if (id === null || !(field instanceof HTMLInputElement)) return;
  const title = field.value.trim();
  if (title === '') {
    view = { editingId: id, draft: field.value, renameError: '标题不能为空' };
    render();
    const again = boardRoot.querySelector(`${taskSelector(id)} input[name="title"]`);
    if (again instanceof HTMLInputElement) again.focus();
    return;
  }
  const before = board;
  board = reduce(board, { type: 'rename', id, title });
  if (board !== before) announce.textContent = `已改名：${title}`;
  finishRename(id);
});

// 记下正在输入的内容（只更新状态，不重新渲染：重新渲染会换掉输入框，光标的位置也会丢）
boardRoot.addEventListener('input', (event) => {
  if (view.editingId === null || !(event.target instanceof HTMLInputElement) || event.target.name !== 'title') return;
  const field = event.target;
  if (view.renameError !== null) {
    // 用户开始修改时错误提示消失（和添加任务的表单一样）：页面上只有这几处和新的状态不一致，直接改掉
    field.removeAttribute('aria-invalid');
    field.removeAttribute('aria-describedby');
    field.form?.querySelector('p.error')?.remove();
  }
  view = { ...view, draft: field.value, renameError: null };
});

boardRoot.addEventListener('keydown', (event) => {
  // 用输入法组字时按的 Esc 是给输入法的（取消组字），不是取消改名
  if (event.key !== 'Escape' || event.isComposing || view.editingId === null) return;
  if (event.target instanceof Element && event.target.closest('form.rename') !== null) finishRename(view.editingId);
});
```
:::

:::variant{kind=wrong name=input-from-title fails=tests reason="渲染时总是用原来的标题填输入框，重新渲染之后用户输入的内容丢了"}
```ts file=render.ts
import { columnsOf, STATUSES, type Board, type Task } from './board';
import { el } from './dom';

export const COLUMN_NAMES = { todo: '待办', doing: '进行中', done: '已完成' } as const;

function actionButton(action: 'left' | 'right' | 'rename' | 'remove', label: string, icon: string, disabled = false): HTMLButtonElement {
  const button = el('button', { type: 'button', 'data-action': action, 'aria-label': label }, el('span', { 'aria-hidden': 'true' }, icon));
  button.disabled = disabled;
  return button;
}

function tagList(task: Task): HTMLUListElement[] {
  return task.tags.length === 0 ? [] : [el('ul', { class: 'tags', 'aria-label': '标签' }, ...task.tags.map((tag) => el('li', {}, `#${tag}`)))];
}

function actions(task: Task): HTMLDivElement {
  const position = STATUSES.indexOf(task.status);
  return el(
    'div',
    { class: 'actions' },
    actionButton('left', `左移：${task.title}`, '←', position === 0),
    actionButton('right', `右移：${task.title}`, '→', position === STATUSES.length - 1),
    actionButton('rename', `改名：${task.title}`, '✎'),
    actionButton('remove', `删除：${task.title}`, '×'),
  );
}

/** 界面状态：正在改名的任务、输入框中正在输入的内容、改名的错误 */
export type View = Readonly<{ editingId: string | null; draft: string; renameError: string | null }>;

export const NOT_EDITING: View = { editingId: null, draft: '', renameError: null };

function renderEditing(task: Task, view: View): HTMLLIElement {
  const field = el('input', { name: 'title', autocomplete: 'off' });
  field.value = task.title;
  const form = el('form', { class: 'rename', novalidate: '' }, el('label', {}, '新的标题 ', field));
  if (view.renameError !== null) {
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', `rename-error-${task.id}`);
    form.append(el('p', { class: 'error', role: 'alert', id: `rename-error-${task.id}` }, view.renameError));
  }
  form.append(el('button', { type: 'submit' }, '保存'), el('button', { type: 'button', 'data-action': 'cancel' }, '取消'));
  return el('li', { class: 'task editing', 'data-id': task.id }, form, ...tagList(task));
}

function renderTask(task: Task, view: View): HTMLLIElement {
  if (task.id === view.editingId) return renderEditing(task, view);
  return el('li', { class: 'task', 'data-id': task.id }, el('span', { class: 'title' }, task.title), ...tagList(task), actions(task));
}

export function renderBoard(root: HTMLElement, board: Board, view: View = NOT_EDITING): void {
  const columns = columnsOf(board);
  root.replaceChildren(
    ...STATUSES.map((status) => {
      const tasks = columns[status];
      const headingId = `column-${status}`;
      return el(
        'section',
        { class: 'column', 'data-status': status, 'aria-labelledby': headingId },
        el('h2', { id: headingId, tabindex: '-1' }, `${COLUMN_NAMES[status]} `, el('span', { class: 'count' }, String(tasks.length))),
        tasks.length === 0 ? el('p', { class: 'empty' }, '没有任务') : el('ul', {}, ...tasks.map((task) => renderTask(task, view))),
      );
    }),
  );
}
```
```ts file=main.ts
import { reduce, type Action, type Board } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { COLUMN_NAMES, NOT_EDITING, renderBoard, type View } from './render';
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
let view: View = NOT_EDITING;

function render(): void {
  renderBoard(boardRoot, board, view);
}

/** 计算新的状态；有变化时重新渲染 */
function dispatch(action: Action): void {
  const next = reduce(board, action);
  if (next === board) return;
  board = next;
  render();
}

const taskSelector = (id: string) => `li[data-id="${CSS.escape(id)}"]`;

/** 聚焦任务板中符合 selector 的元素；找不到或者是禁用的按钮时返回 false */
function focusIn(selector: string): boolean {
  const target = boardRoot.querySelector(selector);
  if (!(target instanceof HTMLElement) || (target instanceof HTMLButtonElement && target.disabled)) return false;
  target.focus();
  return true;
}

/** 结束改名：回到普通的显示，焦点回到这个任务的“改名”按钮 */
function finishRename(id: string): void {
  view = NOT_EDITING;
  render();
  focusIn(`${taskSelector(id)} [data-action="rename"]`);
}

render();

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
  input.focus();
  if (!parsed.ok) {
    showError(parsed.error);
    return;
  }
  clearError();
  dispatch({ type: 'add', title: parsed.title, tags: parsed.tags, now: Date.now() });
  input.value = '';
  announce.textContent = `已添加：${parsed.title}`;
});

input.addEventListener('input', clearError);

boardRoot.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('button[data-action]');
  const item = button?.closest('li.task');
  if (!(button instanceof HTMLButtonElement) || !(item instanceof HTMLElement)) return;
  const task = board.tasks.find((t) => t.id === item.dataset['id']);
  if (task === undefined) return;
  const name = button.dataset['action'];
  if (name === 'left' || name === 'right') {
    dispatch({ type: 'step', id: task.id, direction: name === 'left' ? -1 : 1 });
    const moved = board.tasks.find((t) => t.id === task.id);
    if (moved !== undefined) announce.textContent = `已移到“${COLUMN_NAMES[moved.status]}”：${task.title}`;
    const other = name === 'left' ? 'right' : 'left';
    if (!focusIn(`${taskSelector(task.id)} [data-action="${name}"]`)) focusIn(`${taskSelector(task.id)} [data-action="${other}"]`);
  } else if (name === 'remove') {
    dispatch({ type: 'remove', id: task.id });
    announce.textContent = `已删除：${task.title}`;
    focusIn(`#column-${task.status}`);
  } else if (name === 'rename') {
    view = { editingId: task.id, draft: task.title, renameError: null };
    render();
    const field = boardRoot.querySelector(`${taskSelector(task.id)} input[name="title"]`);
    if (field instanceof HTMLInputElement) {
      field.focus();
      field.select();
    }
  } else if (name === 'cancel') {
    finishRename(task.id);
  }
});

boardRoot.addEventListener('submit', (event) => {
  const renameForm = event.target;
  if (!(renameForm instanceof HTMLFormElement) || !renameForm.classList.contains('rename')) return;
  event.preventDefault();
  const id = view.editingId;
  const field = renameForm.elements.namedItem('title');
  if (id === null || !(field instanceof HTMLInputElement)) return;
  // 和添加任务时用同一条标题规则
  const parsed = parseTitle(field.value);
  if (!parsed.ok) {
    view = { editingId: id, draft: field.value, renameError: parsed.error };
    render();
    const again = boardRoot.querySelector(`${taskSelector(id)} input[name="title"]`);
    if (again instanceof HTMLInputElement) again.focus();
    return;
  }
  const before = board;
  board = reduce(board, { type: 'rename', id, title: parsed.title });
  if (board !== before) announce.textContent = `已改名：${parsed.title}`;
  finishRename(id);
});

// 记下正在输入的内容（只更新状态，不重新渲染：重新渲染会换掉输入框，光标的位置也会丢）
boardRoot.addEventListener('input', (event) => {
  if (view.editingId === null || !(event.target instanceof HTMLInputElement) || event.target.name !== 'title') return;
  const field = event.target;
  if (view.renameError !== null) {
    // 用户开始修改时错误提示消失（和添加任务的表单一样）：页面上只有这几处和新的状态不一致，直接改掉
    field.removeAttribute('aria-invalid');
    field.removeAttribute('aria-describedby');
    field.form?.querySelector('p.error')?.remove();
  }
  view = { ...view, draft: field.value, renameError: null };
});

boardRoot.addEventListener('keydown', (event) => {
  // 用输入法组字时按的 Esc 是给输入法的（取消组字），不是取消改名
  if (event.key !== 'Escape' || event.isComposing || view.editingId === null) return;
  if (event.target instanceof Element && event.target.closest('form.rename') !== null) finishRename(view.editingId);
});
```
:::

:::variant{kind=wrong name=dom-swap fails=tests reason="直接在 DOM 中把任务换成表单，没有记在界面状态中，别的操作重新渲染之后表单消失了"}
```ts file=render.ts
import { columnsOf, STATUSES, type Board, type Task } from './board';
import { el } from './dom';

export const COLUMN_NAMES = { todo: '待办', doing: '进行中', done: '已完成' } as const;

function actionButton(action: 'left' | 'right' | 'rename' | 'remove', label: string, icon: string, disabled = false): HTMLButtonElement {
  const button = el('button', { type: 'button', 'data-action': action, 'aria-label': label }, el('span', { 'aria-hidden': 'true' }, icon));
  button.disabled = disabled;
  return button;
}

function tagList(task: Task): HTMLUListElement[] {
  return task.tags.length === 0 ? [] : [el('ul', { class: 'tags', 'aria-label': '标签' }, ...task.tags.map((tag) => el('li', {}, `#${tag}`)))];
}

function actions(task: Task): HTMLDivElement {
  const position = STATUSES.indexOf(task.status);
  return el(
    'div',
    { class: 'actions' },
    actionButton('left', `左移：${task.title}`, '←', position === 0),
    actionButton('right', `右移：${task.title}`, '→', position === STATUSES.length - 1),
    actionButton('rename', `改名：${task.title}`, '✎'),
    actionButton('remove', `删除：${task.title}`, '×'),
  );
}

function renderTask(task: Task): HTMLLIElement {
  return el('li', { class: 'task', 'data-id': task.id }, el('span', { class: 'title' }, task.title), ...tagList(task), actions(task));
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
        el('h2', { id: headingId, tabindex: '-1' }, `${COLUMN_NAMES[status]} `, el('span', { class: 'count' }, String(tasks.length))),
        tasks.length === 0 ? el('p', { class: 'empty' }, '没有任务') : el('ul', {}, ...tasks.map(renderTask)),
      );
    }),
  );
}
```
```ts file=main.ts
import { reduce, type Action, type Board } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { el } from './dom';
import { COLUMN_NAMES, renderBoard } from './render';
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

function render(): void {
  renderBoard(boardRoot, board);
}

/** 计算新的状态；有变化时重新渲染 */
function dispatch(action: Action): void {
  const next = reduce(board, action);
  if (next === board) return;
  board = next;
  render();
}

const taskSelector = (id: string) => `li[data-id="${CSS.escape(id)}"]`;

/** 聚焦任务板中符合 selector 的元素；找不到或者是禁用的按钮时返回 false */
function focusIn(selector: string): boolean {
  const target = boardRoot.querySelector(selector);
  if (!(target instanceof HTMLElement) || (target instanceof HTMLButtonElement && target.disabled)) return false;
  target.focus();
  return true;
}

function finishRename(id: string): void {
  render();
  focusIn(`${taskSelector(id)} [data-action="rename"]`);
}

render();

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
  input.focus();
  if (!parsed.ok) {
    showError(parsed.error);
    return;
  }
  clearError();
  dispatch({ type: 'add', title: parsed.title, tags: parsed.tags, now: Date.now() });
  input.value = '';
  announce.textContent = `已添加：${parsed.title}`;
});

input.addEventListener('input', clearError);

boardRoot.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('button[data-action]');
  const item = button?.closest('li.task');
  if (!(button instanceof HTMLButtonElement) || !(item instanceof HTMLElement)) return;
  const task = board.tasks.find((t) => t.id === item.dataset['id']);
  if (task === undefined) return;
  const name = button.dataset['action'];
  if (name === 'left' || name === 'right') {
    dispatch({ type: 'step', id: task.id, direction: name === 'left' ? -1 : 1 });
    const moved = board.tasks.find((t) => t.id === task.id);
    if (moved !== undefined) announce.textContent = `已移到“${COLUMN_NAMES[moved.status]}”：${task.title}`;
    const other = name === 'left' ? 'right' : 'left';
    if (!focusIn(`${taskSelector(task.id)} [data-action="${name}"]`)) focusIn(`${taskSelector(task.id)} [data-action="${other}"]`);
  } else if (name === 'remove') {
    dispatch({ type: 'remove', id: task.id });
    announce.textContent = `已删除：${task.title}`;
    focusIn(`#column-${task.status}`);
  } else if (name === 'rename') {
    // 直接在页面上把这个任务换成表单，没有记在状态中
    render();
    const fresh = boardRoot.querySelector(taskSelector(task.id));
    if (!(fresh instanceof HTMLElement)) return;
    const field = el('input', { name: 'title', autocomplete: 'off' });
    field.value = task.title;
    const renameForm = el(
      'form',
      { class: 'rename', novalidate: '' },
      el('label', {}, '新的标题 ', field),
      el('button', { type: 'submit' }, '保存'),
      el('button', { type: 'button', 'data-action': 'cancel' }, '取消'),
    );
    const tags = fresh.querySelector('ul.tags');
    fresh.classList.add('editing');
    fresh.replaceChildren(renameForm, ...(tags === null ? [] : [tags]));
    field.focus();
    field.select();
  } else if (name === 'cancel') {
    finishRename(task.id);
  }
});

boardRoot.addEventListener('submit', (event) => {
  const renameForm = event.target;
  if (!(renameForm instanceof HTMLFormElement) || !renameForm.classList.contains('rename')) return;
  event.preventDefault();
  const item = renameForm.closest('li.task');
  const field = renameForm.elements.namedItem('title');
  const id = item instanceof HTMLElement ? item.dataset['id'] : undefined;
  if (id === undefined || !(field instanceof HTMLInputElement)) return;
  const parsed = parseTitle(field.value);
  if (!parsed.ok) {
    renameForm.querySelector('p.error')?.remove();
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', `rename-error-${id}`);
    renameForm.querySelector('label')?.after(el('p', { class: 'error', role: 'alert', id: `rename-error-${id}` }, parsed.error));
    field.focus();
    return;
  }
  const before = board;
  board = reduce(board, { type: 'rename', id, title: parsed.title });
  if (board !== before) announce.textContent = `已改名：${parsed.title}`;
  finishRename(id);
});

boardRoot.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || event.isComposing || !(event.target instanceof Element)) return;
  const item = event.target.closest('form.rename')?.closest('li.task');
  if (item instanceof HTMLElement && item.dataset['id'] !== undefined) finishRename(item.dataset['id']);
});
```
:::
