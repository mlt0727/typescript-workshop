---
kind: challenge
title: 地址中的筛选条件
---
把筛选接到页面上。`filters.ts` 是小任务的参考解；`render.ts`（只读）已经更新：标签变成了按钮（`data-action="tag"`、`data-tag="标签"`，正在按它筛选时 `aria-pressed="true"`），`renderBoard(root, board, view, filters)` 多接收一个 `filters`，用来标出按下的标签，并在筛选时把空列的说明换成“没有符合条件的任务”。

在 `main.ts` 中：

1. **地址是唯一的来源**：渲染时从 `location.search` 解析筛选条件，用 `filterBoard` 得到要显示的任务；`#filter-summary` 中写“共 4 个任务”，筛选时写“显示 1 / 共 4 个任务”；
2. 页面打开时、后退前进（`popstate`）时，按地址渲染，并把搜索框的内容改成地址中的 `q`；
3. 在搜索框中输入：更新 `q`，用 **`replaceState`** 修改地址，然后渲染（焦点留在搜索框，搜索框中的内容由用户控制，渲染时不要改它，否则地址中去掉了首尾空白的 `q` 会让用户打不出空格）；提交搜索的表单（在搜索框中按回车）时什么都不做；
4. 点标签：按这个标签筛选，已经在按它筛选时取消；用 **`pushState`** 新增一条记录；焦点留在被点击的那个标签按钮上；
5. “清除筛选”：去掉所有条件，用 `pushState`（没有在筛选时不新增记录），清空搜索框，焦点回到搜索框；
6. 添加或改名的任务不符合当前的筛选条件时，它不会显示：在 `#announce` 的文字后面加上“（不符合当前的筛选条件，没有显示）”（例如“已添加：写代码（不符合当前的筛选条件，没有显示）”）；改名之后任务被隐藏时，“改名”按钮也不在了，焦点放到搜索框；
7. 修改地址时只改查询参数：`const url = new URL(location.href); url.search = toSearch(filters);`。

:::files{role=starter}
```ts file=main.ts
import { reduce, type Action, type Board } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { filterBoard, isFiltering, NO_FILTERS, parseFilters, toSearch, type Filters } from './filters';
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
const filterForm = byId('filter-form', HTMLFormElement);
const filterInput = byId('filter-q', HTMLInputElement);
const clearButton = byId('clear-filters', HTMLButtonElement);
const summary = byId('filter-summary', HTMLParagraphElement);

let board: Board = SAMPLE;
let view: View = NOT_EDITING;

function render(): void {
  // TODO：按地址中的筛选条件渲染（filterBoard），并在 summary 中写出数量
  renderBoard(boardRoot, board, view, NO_FILTERS);
  summary.textContent = '';
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

// TODO：搜索框、“清除筛选”、标签按钮（data-action="tag"）、后退与前进；被筛选隐藏的任务在播报中说明
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
      <form id="filter-form" role="search" aria-label="筛选任务">
        <label for="filter-q">筛选</label>
        <input id="filter-q" type="search" autocomplete="off" />
        <button type="button" id="clear-filters">清除筛选</button>
      </form>
      <p id="filter-summary" role="status"></p>
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
.tags button { border: none; background: #e5e7eb; border-radius: 999px; padding: 0 0.5rem; cursor: pointer; }
.tags button[aria-pressed='true'] { background: #1d4ed8; color: #fff; }
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
```ts file=filters.ts readonly
import type { Board, Task } from './board';

export type Filters = Readonly<{ q: string; tag: string | null }>;

export const NO_FILTERS: Filters = { q: '', tag: null };

/** 从 location.search 这样的字符串中解析筛选条件 */
export function parseFilters(search: string): Filters {
  const params = new URLSearchParams(search);
  const q = (params.get('q') ?? '').trim();
  const tag = (params.get('tag') ?? '').trim();
  return { q, tag: tag === '' ? null : tag };
}

/** 生成查询字符串：只包含有效的条件，按 q、tag 的顺序；没有条件时返回空字符串 */
export function toSearch(filters: Filters): string {
  const params = new URLSearchParams();
  const q = filters.q.trim();
  if (q !== '') params.set('q', q);
  if (filters.tag !== null) params.set('tag', filters.tag);
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
}

export function isFiltering(filters: Filters): boolean {
  return filters.q.trim() !== '' || filters.tag !== null;
}

/** 标题包含 q（不区分英文大小写），并且带有 tag 这个标签 */
export function matchesFilters(task: Task, filters: Filters): boolean {
  const q = filters.q.trim().toLowerCase();
  if (q !== '' && !task.title.toLowerCase().includes(q)) return false;
  return filters.tag === null || task.tags.includes(filters.tag);
}

/** 只保留符合条件的任务；没有任何条件时返回原来的 board */
export function filterBoard(board: Board, filters: Filters): Board {
  if (!isFiltering(filters)) return board;
  return { ...board, tasks: board.tasks.filter((task) => matchesFilters(task, filters)) };
}
```
```ts file=render.ts readonly
import { columnsOf, STATUSES, type Board, type Task } from './board';
import { el } from './dom';
import { isFiltering, NO_FILTERS, type Filters } from './filters';

export const COLUMN_NAMES = { todo: '待办', doing: '进行中', done: '已完成' } as const;

/** 界面状态：正在改名的任务、输入框中正在输入的内容、改名的错误 */
export type View = Readonly<{ editingId: string | null; draft: string; renameError: string | null }>;

export const NOT_EDITING: View = { editingId: null, draft: '', renameError: null };

function actionButton(action: 'left' | 'right' | 'rename' | 'remove', label: string, icon: string, disabled = false): HTMLButtonElement {
  const button = el('button', { type: 'button', 'data-action': action, 'aria-label': label }, el('span', { 'aria-hidden': 'true' }, icon));
  button.disabled = disabled;
  return button;
}

/** 标签是按钮：点击后只看带这个标签的任务；正在按它筛选时 aria-pressed="true" */
function tagList(task: Task, filters: Filters): HTMLUListElement[] {
  if (task.tags.length === 0) return [];
  return [
    el(
      'ul',
      { class: 'tags', 'aria-label': '标签' },
      ...task.tags.map((tag) =>
        el('li', {}, el('button', { type: 'button', 'data-action': 'tag', 'data-tag': tag, 'aria-pressed': String(filters.tag === tag) }, `#${tag}`)),
      ),
    ),
  ];
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

function renderEditing(task: Task, view: View, filters: Filters): HTMLLIElement {
  const field = el('input', { name: 'title', autocomplete: 'off' });
  field.value = view.draft;
  const form = el('form', { class: 'rename', novalidate: '' }, el('label', {}, '新的标题 ', field));
  if (view.renameError !== null) {
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', `rename-error-${task.id}`);
    form.append(el('p', { class: 'error', role: 'alert', id: `rename-error-${task.id}` }, view.renameError));
  }
  form.append(el('button', { type: 'submit' }, '保存'), el('button', { type: 'button', 'data-action': 'cancel' }, '取消'));
  return el('li', { class: 'task editing', 'data-id': task.id }, form, ...tagList(task, filters));
}

function renderTask(task: Task, view: View, filters: Filters): HTMLLIElement {
  if (task.id === view.editingId) return renderEditing(task, view, filters);
  return el('li', { class: 'task', 'data-id': task.id }, el('span', { class: 'title' }, task.title), ...tagList(task, filters), actions(task));
}

/**
 * 渲染任务板。board 是已经筛选过的任务板；filters 用来标出正在筛选的标签，
 * 并在筛选时把空列的说明换成“没有符合条件的任务”。
 */
export function renderBoard(root: HTMLElement, board: Board, view: View = NOT_EDITING, filters: Filters = NO_FILTERS): void {
  const columns = columnsOf(board);
  const emptyText = isFiltering(filters) ? '没有符合条件的任务' : '没有任务';
  root.replaceChildren(
    ...STATUSES.map((status) => {
      const tasks = columns[status];
      const headingId = `column-${status}`;
      return el(
        'section',
        { class: 'column', 'data-status': status, 'aria-labelledby': headingId },
        el('h2', { id: headingId, tabindex: '-1' }, `${COLUMN_NAMES[status]} `, el('span', { class: 'count' }, String(tasks.length))),
        tasks.length === 0 ? el('p', { class: 'empty' }, emptyText) : el('ul', {}, ...tasks.map((task) => renderTask(task, view, filters))),
      );
    }),
  );
}
```
```ts file=sample.ts readonly
import type { Board } from './board';

/** 页面打开时的示例数据（下一个里程碑会从本地存储中读取） */
export const SAMPLE: Board = {
  tasks: [
    { id: 't1', title: '写周报', tags: ['工作'], status: 'todo', createdAt: 1 },
    { id: 't2', title: '修自行车', tags: ['家'], status: 'doing', createdAt: 2 },
    { id: 't3', title: '买牛奶', tags: ['家'], status: 'done', createdAt: 3 },
    { id: 't4', title: 'Read the TS Handbook', tags: ['学习', '工作'], status: 'todo', createdAt: 4 },
  ],
  nextId: 5,
};
```
:::

:::files{role=solution}
```ts file=main.ts
import { reduce, type Action, type Board, type Task } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { filterBoard, isFiltering, matchesFilters, NO_FILTERS, parseFilters, toSearch, type Filters } from './filters';
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
const filterForm = byId('filter-form', HTMLFormElement);
const filterInput = byId('filter-q', HTMLInputElement);
const clearButton = byId('clear-filters', HTMLButtonElement);
const summary = byId('filter-summary', HTMLParagraphElement);

let board: Board = SAMPLE;
let view: View = NOT_EDITING;

/** 筛选条件只从地址中读取：地址是它唯一的来源 */
const currentFilters = (): Filters => parseFilters(location.search);

function render(): void {
  const filters = currentFilters();
  const visible = filterBoard(board, filters);
  renderBoard(boardRoot, visible, view, filters);
  summary.textContent = isFiltering(filters) ? `显示 ${visible.tasks.length} / 共 ${board.tasks.length} 个任务` : `共 ${board.tasks.length} 个任务`;
}

/** 改变筛选条件：先更新地址，再按地址渲染 */
function setFilters(filters: Filters, mode: 'push' | 'replace'): void {
  const url = new URL(location.href);
  url.search = toSearch(filters);
  if (mode === 'push') history.pushState(null, '', url);
  else history.replaceState(null, '', url);
  render();
}

/** 任务不符合当前的筛选条件时，在播报中说明它没有显示 */
function hiddenNote(task: Task): string {
  return matchesFilters(task, currentFilters()) ? '' : '（不符合当前的筛选条件，没有显示）';
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
  // 改名之后不再符合筛选条件时，任务被隐藏了：焦点放到搜索框
  if (!focusIn(`${taskSelector(id)} [data-action="rename"]`)) filterInput.focus();
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
  const added = board.tasks.at(-1);
  announce.textContent = `已添加：${parsed.title}${added === undefined ? '' : hiddenNote(added)}`;
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
  } else if (name === 'tag') {
    const tag = button.dataset['tag'];
    if (tag === undefined) return;
    const filters = currentFilters();
    setFilters({ ...filters, tag: filters.tag === tag ? null : tag }, 'push');
    focusIn(`${taskSelector(task.id)} [data-action="tag"][data-tag="${CSS.escape(tag)}"]`);
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
  const renamed = board.tasks.find((t) => t.id === id);
  if (board !== before && renamed !== undefined) announce.textContent = `已改名：${parsed.title}${hiddenNote(renamed)}`;
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

filterInput.value = currentFilters().q;
filterInput.addEventListener('input', () => setFilters({ ...currentFilters(), q: filterInput.value }, 'replace'));
filterForm.addEventListener('submit', (event) => event.preventDefault());
clearButton.addEventListener('click', () => {
  filterInput.value = '';
  // 没有筛选时不新增一条相同的记录
  if (isFiltering(currentFilters())) setFilters(NO_FILTERS, 'push');
  filterInput.focus();
});
window.addEventListener('popstate', () => {
  filterInput.value = currentFilters().q;
  render();
});
```
:::

:::files{role=tests}
```ts file=filters.test.ts
import { afterEach, expect, test, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { page } from 'vitest/browser';

afterEach(() => {
  vi.restoreAllMocks();
});

const params = () => Object.fromEntries(new URLSearchParams(location.search));
const summary = () => document.getElementById('filter-summary');
const search = () => screen.getByLabelText('筛选');
const visibleTitles = () => [...document.querySelectorAll('#board li.task .title')].map((n) => n.textContent);
const tagButton = (taskTitle: string, tag: string) => {
  const item = [...document.querySelectorAll('#board li.task')].find((li) => li.querySelector('.title')?.textContent === taskTitle);
  if (!(item instanceof HTMLElement)) throw new Error(`找不到任务 ${taskTitle}`);
  return within(item).getByRole('button', { name: `#${tag}` });
};

test('没有筛选时显示全部任务和总数', () => {
  expect(visibleTitles()).toHaveLength(4);
  expect(summary()).toHaveTextContent(/^共 4 个任务$/);
  expect(search()).toHaveValue('');
  expect(location.search).toBe('');
});

test('打开页面时按地址中的筛选条件显示', async () => {
  history.replaceState(null, '', '?q=%E5%91%A8%E6%8A%A5&tag=%E5%B7%A5%E4%BD%9C');
  await page.reload();
  expect(visibleTitles()).toEqual(['写周报']);
  expect(search()).toHaveValue('周报');
  expect(tagButton('写周报', '工作')).toHaveAttribute('aria-pressed', 'true');
  expect(summary()).toHaveTextContent('显示 1 / 共 4 个任务');
});

test('输入时按标题筛选（不区分大小写），用 replaceState 更新地址', async () => {
  const push = vi.spyOn(history, 'pushState');
  const replace = vi.spyOn(history, 'replaceState');
  const user = userEvent.setup();
  await user.type(search(), 'ts');
  expect(visibleTitles()).toEqual(['Read the TS Handbook']);
  expect(params()).toEqual({ q: 'ts' });
  expect(summary()).toHaveTextContent('显示 1 / 共 4 个任务');
  expect(push, '输入时不应该新增历史记录').not.toHaveBeenCalled();
  expect(replace).toHaveBeenCalled();
  expect(search()).toHaveFocus();
});

test('搜索框中可以输入空格；按回车不会提交表单', async () => {
  const prevented: boolean[] = [];
  document.addEventListener('submit', (event) => prevented.push(event.defaultPrevented));
  const user = userEvent.setup();
  await user.type(search(), 'read the');
  expect(search(), '地址中的 q 去掉了首尾空白，但不能因此改掉搜索框中正在输入的内容').toHaveValue('read the');
  expect(params()).toEqual({ q: 'read the' });
  expect(visibleTitles()).toEqual(['Read the TS Handbook']);
  await user.keyboard('{Enter}');
  expect(prevented).toEqual([true]);
  expect(visibleTitles()).toEqual(['Read the TS Handbook']);
});

test('点标签：只看带这个标签的任务，新增一条历史记录；再点一次取消', async () => {
  const push = vi.spyOn(history, 'pushState');
  const user = userEvent.setup();
  await user.click(tagButton('修自行车', '家'));
  expect(visibleTitles().toSorted()).toEqual(['买牛奶', '修自行车'].toSorted());
  expect(params()).toEqual({ tag: '家' });
  expect(push).toHaveBeenCalledTimes(1);
  expect(tagButton('修自行车', '家')).toHaveAttribute('aria-pressed', 'true');
  expect(tagButton('修自行车', '家')).toHaveFocus();
  expect(screen.getByRole('region', { name: '待办 0' })).toHaveTextContent('没有符合条件的任务');
  await user.click(tagButton('修自行车', '家'));
  expect(params()).toEqual({});
  expect(visibleTitles()).toHaveLength(4);
  expect(tagButton('修自行车', '家')).toHaveAttribute('aria-pressed', 'false');
});

test('文字和标签可以同时使用', async () => {
  const user = userEvent.setup();
  await user.click(tagButton('写周报', '工作'));
  expect(visibleTitles().toSorted()).toEqual(['Read the TS Handbook', '写周报'].toSorted());
  await user.type(search(), '周报');
  expect(visibleTitles()).toEqual(['写周报']);
  expect(params()).toEqual({ q: '周报', tag: '工作' });
  expect(summary()).toHaveTextContent('显示 1 / 共 4 个任务');
});

test('清除筛选：显示全部，新增一条历史记录，焦点回到搜索框；没有筛选时不新增记录', async () => {
  const user = userEvent.setup();
  await user.type(search(), '牛奶');
  await user.click(tagButton('买牛奶', '家'));
  const push = vi.spyOn(history, 'pushState');
  await user.click(screen.getByRole('button', { name: '清除筛选' }));
  expect(visibleTitles()).toHaveLength(4);
  expect(location.search).toBe('');
  expect(push).toHaveBeenCalledTimes(1);
  expect(search()).toHaveValue('');
  expect(search()).toHaveFocus();
  await user.click(screen.getByRole('button', { name: '清除筛选' }));
  expect(push, '没有筛选时不应该新增记录').toHaveBeenCalledTimes(1);
  expect(search()).toHaveFocus();
});

test('后退：按地址恢复筛选条件，搜索框也跟着改回去', async () => {
  const user = userEvent.setup();
  await user.type(search(), 'read');
  await user.click(tagButton('Read the TS Handbook', '学习'));
  expect(params()).toEqual({ q: 'read', tag: '学习' });
  history.back();
  await waitFor(() => expect(params()).toEqual({ q: 'read' }));
  await waitFor(() => expect(tagButton('Read the TS Handbook', '学习')).toHaveAttribute('aria-pressed', 'false'));
  expect(search()).toHaveValue('read');
});

test('地址被外部改变（例如前进到另一个地址）时，界面跟着地址', async () => {
  history.pushState(null, '', '?q=%E5%91%A8%E6%8A%A5&tag=%E5%B7%A5%E4%BD%9C');
  window.dispatchEvent(new PopStateEvent('popstate'));
  await waitFor(() => expect(visibleTitles()).toEqual(['写周报']));
  expect(search()).toHaveValue('周报');
  expect(tagButton('写周报', '工作')).toHaveAttribute('aria-pressed', 'true');
});

test('筛选时添加的任务按条件决定是否显示；总数随之变化', async () => {
  const user = userEvent.setup();
  await user.click(tagButton('买牛奶', '家'));
  await user.type(screen.getByLabelText('新任务'), '倒垃圾 #家{Enter}');
  await user.type(screen.getByLabelText('新任务'), '写代码{Enter}');
  expect(visibleTitles()).toContain('倒垃圾');
  expect(visibleTitles()).not.toContain('写代码');
  expect(summary()).toHaveTextContent('显示 3 / 共 6 个任务');
  expect(document.getElementById('announce'), '新任务被筛选隐藏时要说明').toHaveTextContent('已添加：写代码（不符合当前的筛选条件，没有显示）');
});

test('改名之后不再符合筛选条件：播报中说明，焦点放到搜索框', async () => {
  const user = userEvent.setup();
  await user.type(search(), '周报');
  await user.click(screen.getByRole('button', { name: '改名：写周报' }));
  await user.keyboard('写月报{Enter}');
  expect(visibleTitles()).toEqual([]);
  expect(document.getElementById('announce')).toHaveTextContent('已改名：写月报（不符合当前的筛选条件，没有显示）');
  expect(search()).toHaveFocus();
});

test('改名时在搜索框中输入，正在编辑的内容不会丢', async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '改名：写周报' }));
  await user.keyboard('写月报');
  await user.type(search(), '写');
  const field = screen.getByRole('textbox', { name: '新的标题' });
  expect(field).toHaveValue('写月报');
  await user.click(field);
  await user.keyboard('{Enter}');
  expect(visibleTitles()).toEqual(['写月报']);
});
```
:::

:::hint{level=1}
写一个 `currentFilters()`，每次都返回 `parseFilters(location.search)`，不要另外保存筛选条件。`render()` 中先算 `filterBoard(board, currentFilters())`，再交给 `renderBoard`。写一个 `setFilters(filters, mode)`：修改地址（`pushState` 或 `replaceState`），然后 `render()`。
:::

:::hint{level=2}
标签按钮在任务板中，所以在已有的 `click` 委托中加一个 `name === 'tag'` 的分支，用 `button.dataset['tag']` 取得标签。`window.addEventListener('popstate', …)` 中先把 `filterInput.value` 改成 `currentFilters().q`，再 `render()`。页面打开时同样要设置一次搜索框的内容。
:::

:::explanation
这道题最重要的一点，是**不保存筛选条件**：`currentFilters()` 每次都从地址中读取。于是“地址是什么，页面就显示什么”在任何情况下都成立：打开页面、输入、点标签、清除、后退、前进，甚至别的代码直接修改了地址再触发 `popstate`（后退和外部修改地址的两个测试），界面都对得上。如果用一个变量保存筛选条件，就要在每一个改变地址的地方都记得同步它，漏掉一处（比如 `popstate`），后退之后页面就和地址不一致了。

`pushState` 和 `replaceState` 的选择和 e10、g13 一样：输入是一个连续的过程，替换当前的记录；点标签、清除是一次明确的操作，新增记录，后退才能回到之前的视图。

搜索框是一个例外的“界面状态”：它的内容在输入时由用户控制，只有地址从外部改变时（页面打开、`popstate`）才需要把它改成地址中的值。常见的错误写法是在 `render()` 中每次都写 `filterInput.value = currentFilters().q`，看起来更符合“地址是唯一的来源”，但 `toSearch` 去掉了首尾空白：输入 `read ` 之后搜索框立刻变回 `read`，词与词之间的空格永远打不出来。搜索框不在被重新渲染的任务板中，所以输入时焦点也不会丢失。

筛选还会让任务“消失”：添加的任务、改名之后的任务不符合条件时不会显示。看得见页面的用户会注意到计数变了，读屏用户则只能从播报中得知，所以播报要说明“没有显示”；改名后任务被隐藏，焦点无处可回，就放到造成隐藏的搜索框上，用户可以在那里修改条件。

筛选时，`#filter-summary` 说明“显示几个、一共几个”，空列说明“没有符合条件的任务”：看不到页面的用户也知道还有任务被隐藏了，而不是以为任务被删了。
:::

:::variant{kind=alt name=address-object}
```ts file=main.ts
import { reduce, type Action, type Board, type Task } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { filterBoard, isFiltering, matchesFilters, NO_FILTERS, parseFilters, toSearch, type Filters } from './filters';
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
const filterForm = byId('filter-form', HTMLFormElement);
const filterInput = byId('filter-q', HTMLInputElement);
const clearButton = byId('clear-filters', HTMLButtonElement);
const summary = byId('filter-summary', HTMLParagraphElement);

let board: Board = SAMPLE;
let view: View = NOT_EDITING;

/** 地址：读取和写入筛选条件的唯一地方 */
const address = {
  read: (): Filters => parseFilters(location.search),
  write(filters: Filters, replace: boolean): void {
    const url = new URL(location.href);
    url.search = toSearch(filters);
    history[replace ? 'replaceState' : 'pushState'](null, '', url);
  },
};
const currentFilters = address.read;

function render(): void {
  const filters = currentFilters();
  const visible = filterBoard(board, filters);
  renderBoard(boardRoot, visible, view, filters);
  summary.textContent = isFiltering(filters) ? `显示 ${visible.tasks.length} / 共 ${board.tasks.length} 个任务` : `共 ${board.tasks.length} 个任务`;
}

/** 改变筛选条件：先更新地址，再按地址渲染 */
function setFilters(filters: Filters, mode: 'push' | 'replace'): void {
  address.write(filters, mode === 'replace');
  render();
}

const toggleTag = (filters: Filters, tag: string): Filters => ({ ...filters, tag: filters.tag === tag ? null : tag });

/** 任务不符合当前的筛选条件时，在播报中说明它没有显示 */
function hiddenNote(task: Task): string {
  return matchesFilters(task, currentFilters()) ? '' : '（不符合当前的筛选条件，没有显示）';
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
  // 改名之后不再符合筛选条件时，任务被隐藏了：焦点放到搜索框
  if (!focusIn(`${taskSelector(id)} [data-action="rename"]`)) filterInput.focus();
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
  const added = board.tasks.at(-1);
  announce.textContent = `已添加：${parsed.title}${added === undefined ? '' : hiddenNote(added)}`;
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
  const renamed = board.tasks.find((t) => t.id === id);
  if (board !== before && renamed !== undefined) announce.textContent = `已改名：${parsed.title}${hiddenNote(renamed)}`;
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

// 标签按钮：单独的一个委托监听器
boardRoot.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('button[data-action="tag"]');
  if (!(button instanceof HTMLButtonElement)) return;
  const tag = button.getAttribute('data-tag');
  const id = button.closest('li.task')?.getAttribute('data-id');
  if (tag === null || id === null || id === undefined) return;
  setFilters(toggleTag(address.read(), tag), 'push');
  const again = boardRoot.querySelector(`li[data-id="${CSS.escape(id)}"] button[data-tag="${CSS.escape(tag)}"]`);
  if (again instanceof HTMLButtonElement) again.focus();
});

function syncFromAddress(): void {
  filterInput.value = address.read().q;
  render();
}
syncFromAddress();
window.addEventListener('popstate', syncFromAddress);
filterInput.addEventListener('input', () => setFilters({ ...address.read(), q: filterInput.value }, 'replace'));
filterForm.addEventListener('submit', (event) => event.preventDefault());
clearButton.addEventListener('click', () => {
  filterInput.value = '';
  if (isFiltering(address.read())) setFilters(NO_FILTERS, 'push');
  filterInput.focus();
});
```
:::

:::variant{kind=wrong name=push-while-typing fails=tests reason="输入时用了 pushState，每个字都新增一条历史记录"}
```ts file=main.ts
import { reduce, type Action, type Board, type Task } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { filterBoard, isFiltering, matchesFilters, NO_FILTERS, parseFilters, toSearch, type Filters } from './filters';
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
const filterForm = byId('filter-form', HTMLFormElement);
const filterInput = byId('filter-q', HTMLInputElement);
const clearButton = byId('clear-filters', HTMLButtonElement);
const summary = byId('filter-summary', HTMLParagraphElement);

let board: Board = SAMPLE;
let view: View = NOT_EDITING;

/** 筛选条件只从地址中读取：地址是它唯一的来源 */
const currentFilters = (): Filters => parseFilters(location.search);

function render(): void {
  const filters = currentFilters();
  const visible = filterBoard(board, filters);
  renderBoard(boardRoot, visible, view, filters);
  summary.textContent = isFiltering(filters) ? `显示 ${visible.tasks.length} / 共 ${board.tasks.length} 个任务` : `共 ${board.tasks.length} 个任务`;
}

/** 改变筛选条件：先更新地址，再按地址渲染 */
function setFilters(filters: Filters, mode: 'push' | 'replace'): void {
  const url = new URL(location.href);
  url.search = toSearch(filters);
  if (mode === 'push') history.pushState(null, '', url);
  else history.replaceState(null, '', url);
  render();
}

/** 任务不符合当前的筛选条件时，在播报中说明它没有显示 */
function hiddenNote(task: Task): string {
  return matchesFilters(task, currentFilters()) ? '' : '（不符合当前的筛选条件，没有显示）';
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
  // 改名之后不再符合筛选条件时，任务被隐藏了：焦点放到搜索框
  if (!focusIn(`${taskSelector(id)} [data-action="rename"]`)) filterInput.focus();
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
  const added = board.tasks.at(-1);
  announce.textContent = `已添加：${parsed.title}${added === undefined ? '' : hiddenNote(added)}`;
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
  } else if (name === 'tag') {
    const tag = button.dataset['tag'];
    if (tag === undefined) return;
    const filters = currentFilters();
    setFilters({ ...filters, tag: filters.tag === tag ? null : tag }, 'push');
    focusIn(`${taskSelector(task.id)} [data-action="tag"][data-tag="${CSS.escape(tag)}"]`);
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
  const renamed = board.tasks.find((t) => t.id === id);
  if (board !== before && renamed !== undefined) announce.textContent = `已改名：${parsed.title}${hiddenNote(renamed)}`;
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

filterInput.value = currentFilters().q;
filterInput.addEventListener('input', () => setFilters({ ...currentFilters(), q: filterInput.value }, 'push'));
filterForm.addEventListener('submit', (event) => event.preventDefault());
clearButton.addEventListener('click', () => {
  filterInput.value = '';
  // 没有筛选时不新增一条相同的记录
  if (isFiltering(currentFilters())) setFilters(NO_FILTERS, 'push');
  filterInput.focus();
});
window.addEventListener('popstate', () => {
  filterInput.value = currentFilters().q;
  render();
});
```
:::

:::variant{kind=wrong name=no-popstate fails=tests reason="没有处理 popstate，后退之后页面没有跟着地址变化"}
```ts file=main.ts
import { reduce, type Action, type Board, type Task } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { filterBoard, isFiltering, matchesFilters, NO_FILTERS, parseFilters, toSearch, type Filters } from './filters';
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
const filterForm = byId('filter-form', HTMLFormElement);
const filterInput = byId('filter-q', HTMLInputElement);
const clearButton = byId('clear-filters', HTMLButtonElement);
const summary = byId('filter-summary', HTMLParagraphElement);

let board: Board = SAMPLE;
let view: View = NOT_EDITING;

/** 筛选条件只从地址中读取：地址是它唯一的来源 */
const currentFilters = (): Filters => parseFilters(location.search);

function render(): void {
  const filters = currentFilters();
  const visible = filterBoard(board, filters);
  renderBoard(boardRoot, visible, view, filters);
  summary.textContent = isFiltering(filters) ? `显示 ${visible.tasks.length} / 共 ${board.tasks.length} 个任务` : `共 ${board.tasks.length} 个任务`;
}

/** 改变筛选条件：先更新地址，再按地址渲染 */
function setFilters(filters: Filters, mode: 'push' | 'replace'): void {
  const url = new URL(location.href);
  url.search = toSearch(filters);
  if (mode === 'push') history.pushState(null, '', url);
  else history.replaceState(null, '', url);
  render();
}

/** 任务不符合当前的筛选条件时，在播报中说明它没有显示 */
function hiddenNote(task: Task): string {
  return matchesFilters(task, currentFilters()) ? '' : '（不符合当前的筛选条件，没有显示）';
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
  // 改名之后不再符合筛选条件时，任务被隐藏了：焦点放到搜索框
  if (!focusIn(`${taskSelector(id)} [data-action="rename"]`)) filterInput.focus();
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
  const added = board.tasks.at(-1);
  announce.textContent = `已添加：${parsed.title}${added === undefined ? '' : hiddenNote(added)}`;
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
  } else if (name === 'tag') {
    const tag = button.dataset['tag'];
    if (tag === undefined) return;
    const filters = currentFilters();
    setFilters({ ...filters, tag: filters.tag === tag ? null : tag }, 'push');
    focusIn(`${taskSelector(task.id)} [data-action="tag"][data-tag="${CSS.escape(tag)}"]`);
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
  const renamed = board.tasks.find((t) => t.id === id);
  if (board !== before && renamed !== undefined) announce.textContent = `已改名：${parsed.title}${hiddenNote(renamed)}`;
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

filterInput.value = currentFilters().q;
filterInput.addEventListener('input', () => setFilters({ ...currentFilters(), q: filterInput.value }, 'replace'));
filterForm.addEventListener('submit', (event) => event.preventDefault());
clearButton.addEventListener('click', () => {
  filterInput.value = '';
  // 没有筛选时不新增一条相同的记录
  if (isFiltering(currentFilters())) setFilters(NO_FILTERS, 'push');
  filterInput.focus();
});
```
:::

:::variant{kind=wrong name=stale-search-box fails=tests reason="popstate 时只重新渲染了任务，搜索框中还是旧的文字"}
```ts file=main.ts
import { reduce, type Action, type Board, type Task } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { filterBoard, isFiltering, matchesFilters, NO_FILTERS, parseFilters, toSearch, type Filters } from './filters';
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
const filterForm = byId('filter-form', HTMLFormElement);
const filterInput = byId('filter-q', HTMLInputElement);
const clearButton = byId('clear-filters', HTMLButtonElement);
const summary = byId('filter-summary', HTMLParagraphElement);

let board: Board = SAMPLE;
let view: View = NOT_EDITING;

/** 筛选条件只从地址中读取：地址是它唯一的来源 */
const currentFilters = (): Filters => parseFilters(location.search);

function render(): void {
  const filters = currentFilters();
  const visible = filterBoard(board, filters);
  renderBoard(boardRoot, visible, view, filters);
  summary.textContent = isFiltering(filters) ? `显示 ${visible.tasks.length} / 共 ${board.tasks.length} 个任务` : `共 ${board.tasks.length} 个任务`;
}

/** 改变筛选条件：先更新地址，再按地址渲染 */
function setFilters(filters: Filters, mode: 'push' | 'replace'): void {
  const url = new URL(location.href);
  url.search = toSearch(filters);
  if (mode === 'push') history.pushState(null, '', url);
  else history.replaceState(null, '', url);
  render();
}

/** 任务不符合当前的筛选条件时，在播报中说明它没有显示 */
function hiddenNote(task: Task): string {
  return matchesFilters(task, currentFilters()) ? '' : '（不符合当前的筛选条件，没有显示）';
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
  // 改名之后不再符合筛选条件时，任务被隐藏了：焦点放到搜索框
  if (!focusIn(`${taskSelector(id)} [data-action="rename"]`)) filterInput.focus();
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
  const added = board.tasks.at(-1);
  announce.textContent = `已添加：${parsed.title}${added === undefined ? '' : hiddenNote(added)}`;
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
  } else if (name === 'tag') {
    const tag = button.dataset['tag'];
    if (tag === undefined) return;
    const filters = currentFilters();
    setFilters({ ...filters, tag: filters.tag === tag ? null : tag }, 'push');
    focusIn(`${taskSelector(task.id)} [data-action="tag"][data-tag="${CSS.escape(tag)}"]`);
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
  const renamed = board.tasks.find((t) => t.id === id);
  if (board !== before && renamed !== undefined) announce.textContent = `已改名：${parsed.title}${hiddenNote(renamed)}`;
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

filterInput.value = currentFilters().q;
filterInput.addEventListener('input', () => setFilters({ ...currentFilters(), q: filterInput.value }, 'replace'));
filterForm.addEventListener('submit', (event) => event.preventDefault());
clearButton.addEventListener('click', () => {
  filterInput.value = '';
  // 没有筛选时不新增一条相同的记录
  if (isFiltering(currentFilters())) setFilters(NO_FILTERS, 'push');
  filterInput.focus();
});
window.addEventListener('popstate', () => {
  render();
});
```
:::

:::variant{kind=wrong name=stored-filters fails=tests reason="另外保存了一份筛选条件，地址从外部改变时它没有跟着变"}
```ts file=main.ts
import { reduce, type Action, type Board, type Task } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { filterBoard, isFiltering, matchesFilters, NO_FILTERS, parseFilters, toSearch, type Filters } from './filters';
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
const filterForm = byId('filter-form', HTMLFormElement);
const filterInput = byId('filter-q', HTMLInputElement);
const clearButton = byId('clear-filters', HTMLButtonElement);
const summary = byId('filter-summary', HTMLParagraphElement);

let board: Board = SAMPLE;
let view: View = NOT_EDITING;

/** 筛选条件只从地址中读取：地址是它唯一的来源 */
let stored: Filters = parseFilters(location.search);
const currentFilters = (): Filters => stored;

function render(): void {
  const filters = currentFilters();
  const visible = filterBoard(board, filters);
  renderBoard(boardRoot, visible, view, filters);
  summary.textContent = isFiltering(filters) ? `显示 ${visible.tasks.length} / 共 ${board.tasks.length} 个任务` : `共 ${board.tasks.length} 个任务`;
}

/** 改变筛选条件：先更新地址，再按地址渲染 */
function setFilters(filters: Filters, mode: 'push' | 'replace'): void {
  const url = new URL(location.href);
  stored = filters;
  url.search = toSearch(filters);
  if (mode === 'push') history.pushState(null, '', url);
  else history.replaceState(null, '', url);
  render();
}

/** 任务不符合当前的筛选条件时，在播报中说明它没有显示 */
function hiddenNote(task: Task): string {
  return matchesFilters(task, currentFilters()) ? '' : '（不符合当前的筛选条件，没有显示）';
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
  // 改名之后不再符合筛选条件时，任务被隐藏了：焦点放到搜索框
  if (!focusIn(`${taskSelector(id)} [data-action="rename"]`)) filterInput.focus();
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
  const added = board.tasks.at(-1);
  announce.textContent = `已添加：${parsed.title}${added === undefined ? '' : hiddenNote(added)}`;
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
  } else if (name === 'tag') {
    const tag = button.dataset['tag'];
    if (tag === undefined) return;
    const filters = currentFilters();
    setFilters({ ...filters, tag: filters.tag === tag ? null : tag }, 'push');
    focusIn(`${taskSelector(task.id)} [data-action="tag"][data-tag="${CSS.escape(tag)}"]`);
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
  const renamed = board.tasks.find((t) => t.id === id);
  if (board !== before && renamed !== undefined) announce.textContent = `已改名：${parsed.title}${hiddenNote(renamed)}`;
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

filterInput.value = currentFilters().q;
filterInput.addEventListener('input', () => setFilters({ ...currentFilters(), q: filterInput.value }, 'replace'));
filterForm.addEventListener('submit', (event) => event.preventDefault());
clearButton.addEventListener('click', () => {
  filterInput.value = '';
  // 没有筛选时不新增一条相同的记录
  if (isFiltering(currentFilters())) setFilters(NO_FILTERS, 'push');
  filterInput.focus();
});
window.addEventListener('popstate', () => {
  filterInput.value = currentFilters().q;
  render();
});
```
:::

:::variant{kind=wrong name=summary-without-total fails=tests reason="筛选时只写了显示的个数，没有说明一共有几个"}
```ts file=main.ts
import { reduce, type Action, type Board, type Task } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { filterBoard, isFiltering, matchesFilters, NO_FILTERS, parseFilters, toSearch, type Filters } from './filters';
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
const filterForm = byId('filter-form', HTMLFormElement);
const filterInput = byId('filter-q', HTMLInputElement);
const clearButton = byId('clear-filters', HTMLButtonElement);
const summary = byId('filter-summary', HTMLParagraphElement);

let board: Board = SAMPLE;
let view: View = NOT_EDITING;

/** 筛选条件只从地址中读取：地址是它唯一的来源 */
const currentFilters = (): Filters => parseFilters(location.search);

function render(): void {
  const filters = currentFilters();
  const visible = filterBoard(board, filters);
  renderBoard(boardRoot, visible, view, filters);
  summary.textContent = `共 ${visible.tasks.length} 个任务`;
}

/** 改变筛选条件：先更新地址，再按地址渲染 */
function setFilters(filters: Filters, mode: 'push' | 'replace'): void {
  const url = new URL(location.href);
  url.search = toSearch(filters);
  if (mode === 'push') history.pushState(null, '', url);
  else history.replaceState(null, '', url);
  render();
}

/** 任务不符合当前的筛选条件时，在播报中说明它没有显示 */
function hiddenNote(task: Task): string {
  return matchesFilters(task, currentFilters()) ? '' : '（不符合当前的筛选条件，没有显示）';
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
  // 改名之后不再符合筛选条件时，任务被隐藏了：焦点放到搜索框
  if (!focusIn(`${taskSelector(id)} [data-action="rename"]`)) filterInput.focus();
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
  const added = board.tasks.at(-1);
  announce.textContent = `已添加：${parsed.title}${added === undefined ? '' : hiddenNote(added)}`;
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
  } else if (name === 'tag') {
    const tag = button.dataset['tag'];
    if (tag === undefined) return;
    const filters = currentFilters();
    setFilters({ ...filters, tag: filters.tag === tag ? null : tag }, 'push');
    focusIn(`${taskSelector(task.id)} [data-action="tag"][data-tag="${CSS.escape(tag)}"]`);
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
  const renamed = board.tasks.find((t) => t.id === id);
  if (board !== before && renamed !== undefined) announce.textContent = `已改名：${parsed.title}${hiddenNote(renamed)}`;
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

filterInput.value = currentFilters().q;
filterInput.addEventListener('input', () => setFilters({ ...currentFilters(), q: filterInput.value }, 'replace'));
filterForm.addEventListener('submit', (event) => event.preventDefault());
clearButton.addEventListener('click', () => {
  filterInput.value = '';
  // 没有筛选时不新增一条相同的记录
  if (isFiltering(currentFilters())) setFilters(NO_FILTERS, 'push');
  filterInput.focus();
});
window.addEventListener('popstate', () => {
  filterInput.value = currentFilters().q;
  render();
});
```
:::

:::variant{kind=wrong name=search-box-from-address fails=tests reason="每次渲染都用地址中的 q 覆盖搜索框，去掉了首尾空白，打不出空格"}
```ts file=main.ts
import { reduce, type Action, type Board, type Task } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { filterBoard, isFiltering, matchesFilters, NO_FILTERS, parseFilters, toSearch, type Filters } from './filters';
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
const filterForm = byId('filter-form', HTMLFormElement);
const filterInput = byId('filter-q', HTMLInputElement);
const clearButton = byId('clear-filters', HTMLButtonElement);
const summary = byId('filter-summary', HTMLParagraphElement);

let board: Board = SAMPLE;
let view: View = NOT_EDITING;

/** 筛选条件只从地址中读取：地址是它唯一的来源 */
const currentFilters = (): Filters => parseFilters(location.search);

function render(): void {
  const filters = currentFilters();
  const visible = filterBoard(board, filters);
  renderBoard(boardRoot, visible, view, filters);
  filterInput.value = filters.q;
  summary.textContent = isFiltering(filters) ? `显示 ${visible.tasks.length} / 共 ${board.tasks.length} 个任务` : `共 ${board.tasks.length} 个任务`;
}

/** 改变筛选条件：先更新地址，再按地址渲染 */
function setFilters(filters: Filters, mode: 'push' | 'replace'): void {
  const url = new URL(location.href);
  url.search = toSearch(filters);
  if (mode === 'push') history.pushState(null, '', url);
  else history.replaceState(null, '', url);
  render();
}

/** 任务不符合当前的筛选条件时，在播报中说明它没有显示 */
function hiddenNote(task: Task): string {
  return matchesFilters(task, currentFilters()) ? '' : '（不符合当前的筛选条件，没有显示）';
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
  // 改名之后不再符合筛选条件时，任务被隐藏了：焦点放到搜索框
  if (!focusIn(`${taskSelector(id)} [data-action="rename"]`)) filterInput.focus();
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
  const added = board.tasks.at(-1);
  announce.textContent = `已添加：${parsed.title}${added === undefined ? '' : hiddenNote(added)}`;
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
  } else if (name === 'tag') {
    const tag = button.dataset['tag'];
    if (tag === undefined) return;
    const filters = currentFilters();
    setFilters({ ...filters, tag: filters.tag === tag ? null : tag }, 'push');
    focusIn(`${taskSelector(task.id)} [data-action="tag"][data-tag="${CSS.escape(tag)}"]`);
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
  const renamed = board.tasks.find((t) => t.id === id);
  if (board !== before && renamed !== undefined) announce.textContent = `已改名：${parsed.title}${hiddenNote(renamed)}`;
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

filterInput.value = currentFilters().q;
filterInput.addEventListener('input', () => setFilters({ ...currentFilters(), q: filterInput.value }, 'replace'));
filterForm.addEventListener('submit', (event) => event.preventDefault());
clearButton.addEventListener('click', () => {
  filterInput.value = '';
  // 没有筛选时不新增一条相同的记录
  if (isFiltering(currentFilters())) setFilters(NO_FILTERS, 'push');
  filterInput.focus();
});
window.addEventListener('popstate', () => {
  filterInput.value = currentFilters().q;
  render();
});
```
:::

:::variant{kind=wrong name=silent-when-hidden fails=tests reason="添加、改名的任务被筛选隐藏时没有说明"}
```ts file=main.ts
import { reduce, type Action, type Board, type Task } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { filterBoard, isFiltering, matchesFilters, NO_FILTERS, parseFilters, toSearch, type Filters } from './filters';
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
const filterForm = byId('filter-form', HTMLFormElement);
const filterInput = byId('filter-q', HTMLInputElement);
const clearButton = byId('clear-filters', HTMLButtonElement);
const summary = byId('filter-summary', HTMLParagraphElement);

let board: Board = SAMPLE;
let view: View = NOT_EDITING;

/** 筛选条件只从地址中读取：地址是它唯一的来源 */
const currentFilters = (): Filters => parseFilters(location.search);

function render(): void {
  const filters = currentFilters();
  const visible = filterBoard(board, filters);
  renderBoard(boardRoot, visible, view, filters);
  summary.textContent = isFiltering(filters) ? `显示 ${visible.tasks.length} / 共 ${board.tasks.length} 个任务` : `共 ${board.tasks.length} 个任务`;
}

/** 改变筛选条件：先更新地址，再按地址渲染 */
function setFilters(filters: Filters, mode: 'push' | 'replace'): void {
  const url = new URL(location.href);
  url.search = toSearch(filters);
  if (mode === 'push') history.pushState(null, '', url);
  else history.replaceState(null, '', url);
  render();
}

/** 任务不符合当前的筛选条件时，在播报中说明它没有显示 */
function hiddenNote(task: Task): string {
  return matchesFilters(task, NO_FILTERS) ? '' : '（不符合当前的筛选条件，没有显示）';
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
  // 改名之后不再符合筛选条件时，任务被隐藏了：焦点放到搜索框
  if (!focusIn(`${taskSelector(id)} [data-action="rename"]`)) filterInput.focus();
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
  const added = board.tasks.at(-1);
  announce.textContent = `已添加：${parsed.title}${added === undefined ? '' : hiddenNote(added)}`;
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
  } else if (name === 'tag') {
    const tag = button.dataset['tag'];
    if (tag === undefined) return;
    const filters = currentFilters();
    setFilters({ ...filters, tag: filters.tag === tag ? null : tag }, 'push');
    focusIn(`${taskSelector(task.id)} [data-action="tag"][data-tag="${CSS.escape(tag)}"]`);
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
  const renamed = board.tasks.find((t) => t.id === id);
  if (board !== before && renamed !== undefined) announce.textContent = `已改名：${parsed.title}${hiddenNote(renamed)}`;
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

filterInput.value = currentFilters().q;
filterInput.addEventListener('input', () => setFilters({ ...currentFilters(), q: filterInput.value }, 'replace'));
filterForm.addEventListener('submit', (event) => event.preventDefault());
clearButton.addEventListener('click', () => {
  filterInput.value = '';
  // 没有筛选时不新增一条相同的记录
  if (isFiltering(currentFilters())) setFilters(NO_FILTERS, 'push');
  filterInput.focus();
});
window.addEventListener('popstate', () => {
  filterInput.value = currentFilters().q;
  render();
});
```
:::
