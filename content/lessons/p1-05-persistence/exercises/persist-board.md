---
kind: challenge
title: 保存与恢复任务板
mode: dom
---
把任务板保存到 localStorage 中。`storage.ts` 是小任务的参考解（`STORAGE_KEY` 是 `taskboard`，`BACKUP_KEY` 是 `taskboard:backup`）；`index.html` 中多了一个 `#storage-warning`（`role="alert"`，默认隐藏）。在 `main.ts` 中：

1. **打开页面时**读取 `localStorage` 中的 `taskboard`：
   - 还没有保存过（`null`）：显示示例数据 `SAMPLE`，不保存；
   - 读取成功：使用读到的任务板；如果是从旧版本转换来的（`migrated`），先把原来的字符串备份到 `taskboard:backup`，再用新格式保存一次，并在 `#announce` 中写入“已把旧版本的数据转换成新的格式。”；
   - 读取失败：先把原来的字符串保存到 `taskboard:backup`，再从空的任务板（`EMPTY_BOARD`）开始；在 `#storage-warning` 中显示“保存的数据无法读取（错误的原因），已从空的任务板开始。原来的数据保存在 taskboard:backup 中。”并让它显示出来。在用户修改任务板之前，**不要覆盖** `taskboard` 中原来的内容；
   - 备份失败（`setItem` 抛出异常）：原来的数据只剩 `taskboard` 中的这一份，之后**不再保存**；提示中说明“这次的修改不会被保存”；
   - 访问 `localStorage` 本身就抛出异常（用户阻止了网站存储数据时会这样）：显示示例数据，提示“无法访问浏览器的存储，这次的修改不会被保存。”，之后不再尝试保存；
2. **每次任务板变化之后**（添加、移动、删除、改名）用 `serializeBoard` 保存；没有变化时不保存；
3. 保存时 `setItem` 抛出异常（存储空间满了）：在 `#storage-warning` 中显示以“保存失败”开头的说明，刚才的操作照常完成；下一次保存成功时隐藏提示（读取失败的提示也一样）；
4. 只保存任务板：正在改名的任务、筛选条件都不保存。

测试中会先写入一些数据，再用 `page.reload()` 模拟刷新页面（入口文件重新执行，存储中的数据保留）；用 `vi.spyOn(Storage.prototype, 'setItem')`、`vi.spyOn(Storage.prototype, 'getItem')` 模拟存储空间已满、存储无法访问。

:::files{role=starter}
```ts file=main.ts
import { reduce, type Action, type Board, type Task } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { filterBoard, isFiltering, matchesFilters, NO_FILTERS, parseFilters, toSearch, type Filters } from './filters';
import { COLUMN_NAMES, NOT_EDITING, renderBoard, type View } from './render';
import { SAMPLE } from './sample';
import { BACKUP_KEY, EMPTY_BOARD, loadBoard, serializeBoard, STORAGE_KEY } from './storage';

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
const storageWarning = byId('storage-warning', HTMLParagraphElement);

// TODO：从 localStorage 中读取（loadBoard），每次任务板变化之后保存（serializeBoard）
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
      <p id="storage-warning" class="error" role="alert" hidden></p>
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
```ts file=storage.ts readonly
import { STATUSES, type Board, type Status, type Task } from './board';
import { parseTitle } from './parse';

export const STORAGE_KEY = 'taskboard';
export const BACKUP_KEY = 'taskboard:backup';
export const EMPTY_BOARD: Board = { tasks: [], nextId: 1 };

export type LoadResult = { ok: true; board: Board; migrated: boolean } | { ok: false; error: string };

/** 按第 2 版的格式保存 */
export function serializeBoard(board: Board): string {
  return JSON.stringify({ version: 2, board });
}

const fail = (error: string): LoadResult => ({ ok: false, error });
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isStatus = (value: unknown): value is Status => STATUSES.some((s) => s === value);
const charCount = (text: string) => [...text].length;
const ID = /^t[1-9]\d*$/;
const idNumber = (id: string) => Number(id.slice(1));

/** 标题要符合添加任务时的规则（parseTitle），并且已经是整理过的样子 */
function isTitle(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = parseTitle(value);
  return parsed.ok && parsed.title === value;
}

/** 验证第 2 版中的一个任务；只取出认识的字段，组成新的对象 */
function parseTask(value: unknown): Task | null {
  if (!isObject(value)) return null;
  const { id, title, tags, status, createdAt } = value;
  if (typeof id !== 'string' || !ID.test(id) || !isTitle(title)) return null;
  if (!Array.isArray(tags) || tags.length > 3) return null;
  // Array.isArray 把 unknown 收窄成 any[]：先赋给 readonly unknown[]，元素才是 unknown（e06）
  const items: readonly unknown[] = tags;
  const cleanTags: string[] = [];
  for (const tag of items) {
    if (typeof tag !== 'string' || tag === '' || /\s/.test(tag) || charCount(tag) > 10 || cleanTags.includes(tag)) return null;
    cleanTags.push(tag);
  }
  if (!isStatus(status) || typeof createdAt !== 'number' || !Number.isFinite(createdAt)) return null;
  return { id, title, tags: cleanTags, status, createdAt };
}

/** 检查整个任务板：编号不能重复，nextId 是大于所有编号的正整数 */
function finish(tasks: Task[], nextId: unknown, migrated: boolean): LoadResult {
  const seen = new Set<string>();
  for (const task of tasks) {
    if (seen.has(task.id)) return fail(`任务的编号重复：${task.id}`);
    seen.add(task.id);
  }
  if (typeof nextId !== 'number' || !Number.isSafeInteger(nextId) || nextId < 1 || tasks.some((t) => idNumber(t.id) >= nextId)) {
    return fail('nextId 不正确');
  }
  return { ok: true, board: { tasks, nextId }, migrated };
}

function parseV2(data: Record<string, unknown>): LoadResult {
  const board = data['board'];
  if (!isObject(board) || !Array.isArray(board['tasks'])) return fail('数据的格式不正确');
  const items: readonly unknown[] = board['tasks'];
  const tasks: Task[] = [];
  for (const [index, item] of items.entries()) {
    const task = parseTask(item);
    if (task === null) return fail(`第 ${index + 1} 个任务的数据不正确`);
    tasks.push(task);
  }
  return finish(tasks, board['nextId'], false);
}

/** 第 1 版：{ version: 1, todos: [{ id: 数字, text, done }] }，转换成第 2 版的任务板 */
function migrateV1(data: Record<string, unknown>): LoadResult {
  const todos = data['todos'];
  if (!Array.isArray(todos)) return fail('数据的格式不正确');
  const items: readonly unknown[] = todos;
  const tasks: Task[] = [];
  let maxId = 0;
  for (const [index, item] of items.entries()) {
    const bad = fail(`第 ${index + 1} 个待办的数据不正确`);
    if (!isObject(item)) return bad;
    const { id, text, done } = item;
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) return bad;
    if (typeof text !== 'string' || typeof done !== 'boolean') return bad;
    // 按添加任务时的规则整理空白；太长时只保留前 40 个字符，再去掉末尾的空白
    const words = text.split(/\s+/).filter((word) => word !== '').join(' ');
    const title = [...words].slice(0, 40).join('').trimEnd();
    if (title === '') return bad;
    tasks.push({ id: `t${id}`, title, tags: [], status: done ? 'done' : 'todo', createdAt: index });
    maxId = Math.max(maxId, id);
  }
  return finish(tasks, maxId + 1, true);
}

/** 读取 localStorage 中保存的字符串（null 表示还没有保存过） */
export function loadBoard(raw: string | null): LoadResult {
  if (raw === null) return { ok: true, board: EMPTY_BOARD, migrated: false };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return fail('JSON 格式不正确');
  }
  if (!isObject(data)) return fail('数据的格式不正确');
  if (data['version'] === 1) return migrateV1(data);
  if (data['version'] === 2) return parseV2(data);
  return fail(`不支持的版本：${String(data['version'])}`);
}
```
```ts file=sample.ts readonly
import type { Board } from './board';

/** 第一次打开（存储中还没有数据）时显示的示例数据 */
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
import { BACKUP_KEY, EMPTY_BOARD, loadBoard, serializeBoard, STORAGE_KEY } from './storage';

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
const storageWarning = byId('storage-warning', HTMLParagraphElement);

function showStorageWarning(message: string | null): void {
  storageWarning.textContent = message ?? '';
  storageWarning.hidden = message === null;
}

/** 无法访问存储、或者无法备份原来的数据时，不再保存（以免覆盖唯一的一份原始数据） */
let canSave = true;

/** 保存任务板；失败时提示，但不影响刚才的操作 */
function save(next: Board): void {
  if (!canSave) return;
  try {
    localStorage.setItem(STORAGE_KEY, serializeBoard(next));
    showStorageWarning(null);
  } catch {
    showStorageWarning('保存失败：浏览器的存储空间可能已满，刷新之后最近的修改会丢失。');
  }
}

/** 把原来的字符串备份到 BACKUP_KEY；失败时不再保存 */
function backup(raw: string): boolean {
  try {
    localStorage.setItem(BACKUP_KEY, raw);
    return true;
  } catch {
    canSave = false;
    return false;
  }
}

/** 第一次打开时显示示例数据；读取失败时备份原来的数据，从空的任务板开始 */
function initialBoard(): Board {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // 用户阻止了网站存储数据时，访问 localStorage 就会抛出异常
    canSave = false;
    showStorageWarning('无法访问浏览器的存储，这次的修改不会被保存。');
    return SAMPLE;
  }
  if (raw === null) return SAMPLE;
  const loaded = loadBoard(raw);
  if (!loaded.ok) {
    const where = backup(raw) ? `原来的数据保存在 ${BACKUP_KEY} 中。` : '备份原来的数据也失败了，为了不覆盖它，这次的修改不会被保存。';
    showStorageWarning(`保存的数据无法读取（${loaded.error}），已从空的任务板开始。${where}`);
    return EMPTY_BOARD;
  }
  if (loaded.migrated) {
    // 先备份旧版本的数据，再用新的格式保存
    if (backup(raw)) {
      save(loaded.board);
      announce.textContent = '已把旧版本的数据转换成新的格式。';
    } else {
      showStorageWarning('无法备份旧版本的数据，为了不覆盖它，这次的修改不会被保存。');
    }
  }
  return loaded.board;
}

let board: Board = initialBoard();
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
  save(board);
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
  if (board !== before) save(board);
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
```ts file=persist.test.ts
import { afterEach, expect, test, vi } from 'vitest';
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { page } from 'vitest/browser';

afterEach(() => {
  vi.restoreAllMocks();
});

const titles = () => [...document.querySelectorAll('#board li.task .title')].map((n) => n.textContent);
const column = (name: RegExp) => [...screen.getByRole('region', { name }).querySelectorAll('li.task .title')].map((n) => n.textContent);
const stored = (): unknown => JSON.parse(localStorage.getItem('taskboard') ?? 'null');
const warning = () => document.getElementById('storage-warning');

async function addTask(text: string): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('新任务'), `${text}{Enter}`);
}

test('第一次打开：显示示例数据，还没有保存任何东西', () => {
  expect(titles()).toHaveLength(4);
  expect(localStorage.getItem('taskboard')).toBeNull();
  expect(warning()).not.toBeVisible();
});

test('添加之后按第 2 版的格式保存；刷新之后还在', async () => {
  await addTask('倒垃圾 #家');
  expect(stored()).toMatchObject({ version: 2, board: { nextId: 6 } });
  await page.reload();
  expect(titles()).toContain('倒垃圾');
  expect(titles()).toHaveLength(5);
});

test('移动、改名、删除都会保存', async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '右移：写周报' }));
  await user.click(screen.getByRole('button', { name: '删除：买牛奶' }));
  await user.click(screen.getByRole('button', { name: '改名：修自行车' }));
  await user.keyboard('修好自行车{Enter}');
  await page.reload();
  expect(column(/^进行中/)).toEqual(['写周报', '修好自行车']);
  expect(column(/^已完成/)).toEqual([]);
});

test('旧版本的数据：先备份，转换之后显示，并用新的格式保存', async () => {
  const old = JSON.stringify({ version: 1, todos: [{ id: 2, text: '交房租', done: false }, { id: 5, text: '体检', done: true }] });
  localStorage.setItem('taskboard', old);
  await page.reload();
  expect(localStorage.getItem('taskboard:backup')).toBe(old);
  expect(column(/^待办/)).toEqual(['交房租']);
  expect(column(/^已完成/)).toEqual(['体检']);
  expect(stored()).toMatchObject({ version: 2, board: { nextId: 6 } });
  expect(document.getElementById('announce')).toHaveTextContent('已把旧版本的数据转换成新的格式。');
  expect(warning()).not.toBeVisible();
});

test('保存的数据无法读取：从空的任务板开始，备份原来的数据，提示用户', async () => {
  localStorage.setItem('taskboard', '{"version":2,"board":坏掉了');
  await page.reload();
  expect(titles()).toEqual([]);
  expect(screen.getByRole('alert')).toHaveTextContent('JSON 格式不正确');
  expect(screen.getByRole('alert')).toHaveTextContent('taskboard:backup');
  expect(localStorage.getItem('taskboard:backup')).toBe('{"version":2,"board":坏掉了');
  expect(localStorage.getItem('taskboard'), '在用户修改之前，不要覆盖原来的数据').toBe('{"version":2,"board":坏掉了');
  await addTask('重新开始');
  expect(stored()).toMatchObject({ version: 2 });
  expect(localStorage.getItem('taskboard:backup')).toBe('{"version":2,"board":坏掉了');
  expect(warning()).not.toBeVisible();
});

test('结构不对的数据同样说明原因', async () => {
  localStorage.setItem('taskboard', JSON.stringify({ version: 2, board: { tasks: [{ id: 't1', title: '写周报', tags: [], status: 'archived', createdAt: 1 }], nextId: 2 } }));
  await page.reload();
  expect(screen.getByRole('alert')).toHaveTextContent('第 1 个任务的数据不正确');
  expect(titles()).toEqual([]);
});

test('保存失败：提示用户，操作照常完成；下一次保存成功后提示消失', async () => {
  // 和真实的浏览器一样，Storage 的方法在原型上：监视 Storage.prototype，而不是替换 localStorage.setItem
  const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('存储空间已满', 'QuotaExceededError');
  });
  await addTask('很重要的任务');
  expect(titles()).toContain('很重要的任务');
  expect(screen.getByRole('alert')).toHaveTextContent(/^保存失败/);
  setItem.mockRestore();
  await addTask('另一个任务');
  expect(warning()).not.toBeVisible();
  expect(JSON.stringify(stored())).toContain('很重要的任务');
});

test('备份也失败时：说明原因，之后不再写入（以免覆盖原来的数据）', async () => {
  localStorage.setItem('taskboard', '坏掉的数据');
  const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('存储空间已满', 'QuotaExceededError');
  });
  await page.reload();
  expect(screen.getByRole('alert')).toHaveTextContent('这次的修改不会被保存');
  const attempts = setItem.mock.calls.length;
  await addTask('新任务');
  expect(titles()).toEqual(['新任务']);
  expect(setItem.mock.calls.length, '备份失败之后不应该再尝试写入').toBe(attempts);
  expect(screen.getByRole('alert')).toHaveTextContent('这次的修改不会被保存');
  setItem.mockRestore();
  expect(localStorage.getItem('taskboard')).toBe('坏掉的数据');
});

test('迁移旧版本的数据时备份失败：不覆盖旧的数据，说明原因', async () => {
  const old = JSON.stringify({ version: 1, todos: [{ id: 1, text: '交房租', done: false }] });
  localStorage.setItem('taskboard', old);
  const original = Storage.prototype.setItem;
  // 只有新增备份的键失败；覆盖已有的键仍然成功
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
    if (key === 'taskboard:backup') throw new DOMException('存储空间已满', 'QuotaExceededError');
    original.call(this, key, value);
  });
  await page.reload();
  expect(column(/^待办/)).toEqual(['交房租']);
  expect(screen.getByRole('alert')).toHaveTextContent('这次的修改不会被保存');
  await addTask('新任务');
  expect(localStorage.getItem('taskboard'), '第 1 版的数据没有备份，不能被覆盖').toBe(old);
});

test('无法访问存储（用户阻止了网站存储数据）：照常启动，说明原因，不再尝试保存', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  });
  const setItem = vi.spyOn(Storage.prototype, 'setItem');
  await page.reload();
  expect(screen.getByRole('alert')).toHaveTextContent('无法访问浏览器的存储');
  expect(titles()).toHaveLength(4);
  await addTask('照常工作');
  expect(titles()).toContain('照常工作');
  expect(setItem).not.toHaveBeenCalled();
});

test('任务板没有变化时不保存', async () => {
  const setItem = vi.spyOn(Storage.prototype, 'setItem');
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '改名：写周报' }));
  await user.keyboard('{Enter}');
  await user.click(screen.getByRole('button', { name: '改名：写周报' }));
  await user.keyboard('  写周报  {Enter}');
  expect(setItem, '标题整理之后和原来的相同，任务板没有变化').not.toHaveBeenCalled();
});

test('由 emoji 组成的标题保存之后，刷新时仍能读取', async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '改名：写周报' }));
  await user.keyboard('😀'.repeat(40) + '{Enter}');
  await page.reload();
  expect(titles()).toContain('😀'.repeat(40));
  expect(warning()).not.toBeVisible();
});

test('只保存任务板：改名中的状态、筛选条件都不保存', async () => {
  const user = userEvent.setup();
  await addTask('写测试 #工作');
  await user.click(within(screen.getByRole('region', { name: /^待办/ })).getAllByRole('button', { name: '#工作' })[0] ?? document.body);
  await user.click(screen.getByRole('button', { name: '改名：写测试' }));
  const saved = stored();
  expect(saved !== null && typeof saved === 'object' ? Object.keys(saved).toSorted() : []).toEqual(['board', 'version']);
  await page.reload();
  expect(screen.queryByRole('textbox', { name: '新的标题' })).toBeNull();
});
```
:::

:::hint{level=1}
把 `let board = SAMPLE` 换成一个 `initialBoard()` 函数的结果：读取（`getItem` 也要放在 `try` 中）、调用 `loadBoard`，按几种情况处理。写一个 `save(board)`：`try { localStorage.setItem(…) } catch { 提示 }`；再用一个 `canSave` 变量记下“还能不能保存”。
:::

:::hint{level=2}
任务板只在两个地方变化：`dispatch` 和改名的 `submit` 处理函数（它直接调用了 `reduce`）。在这两个地方、确认任务板真的变了之后调用 `save`。读取失败时只写 `taskboard:backup`，不要写 `taskboard`：等用户第一次修改任务板时，`save` 自然会写入新的数据。备份写成一个返回 `boolean` 的 `backup(raw)`，失败时把 `canSave` 设为 `false`；`save` 开头检查 `canSave`。
:::

:::explanation
保存和读取的代码不多，难点都在“出了问题怎么办”：

- **读取失败不是应用崩溃的理由**：`loadBoard` 已经把所有的坏情况变成了 `{ ok: false }`，这里只需要决定接下来怎么做：从空的任务板开始，并告诉用户；
- **不要丢掉用户的数据**：备份之后再提示，并且在用户真正修改任务板之前不覆盖原来的键。如果一读取失败就用空的任务板保存一次，用户原来的数据就永远没了。备份本身也可能失败：这时原来的数据只剩一份，宁可这次的修改不保存，也不要覆盖它。迁移旧版本的数据也是一次覆盖，同样先备份；
- **存储可能根本无法访问**：用户在浏览器中阻止网站存储数据时，访问 `localStorage` 就会抛出 `SecurityError`。读取也要放在 `try` 中，否则应用一打开就崩溃了；
- **保存失败不影响操作**：`setItem` 抛出异常时，如果没有捕获，`dispatch` 在保存这一步就中断了，任务板不会重新渲染，用户会以为“添加”坏了。捕获异常、提示原因，操作照常完成；
- **迁移之后立刻保存**：下次打开时读到的就是新格式，不用再转换；
- **只保存数据**：`serializeBoard` 只序列化 `board`；改名的状态在 `view` 中，筛选条件在地址中，它们都不进入存储。

这五个里程碑一起完成了一个小而完整的应用：模型是纯函数，界面从状态渲染，事件委托处理所有的操作，地址保存“正在看什么”，本地存储保存“用户的数据”，每一层都可以单独测试。
:::

:::variant{kind=alt name=persistence-object}
```ts file=main.ts
import { reduce, type Action, type Board, type Task } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { filterBoard, isFiltering, matchesFilters, NO_FILTERS, parseFilters, toSearch, type Filters } from './filters';
import { COLUMN_NAMES, NOT_EDITING, renderBoard, type View } from './render';
import { SAMPLE } from './sample';
import { BACKUP_KEY, EMPTY_BOARD, loadBoard, serializeBoard, STORAGE_KEY } from './storage';

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
const storageWarning = byId('storage-warning', HTMLParagraphElement);

const persistence = { canSave: true };

const warn = (message: string | null): void => {
  storageWarning.hidden = message === null;
  storageWarning.textContent = message ?? '';
};

function tryWrite(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function save(next: Board): void {
  if (!persistence.canSave) return;
  if (tryWrite(STORAGE_KEY, serializeBoard(next))) warn(null);
  else warn('保存失败：存储空间可能已满，刷新之后最近的修改会丢失。');
}

/** 读取保存的字符串；存储无法访问时返回 undefined */
function readSaved(): string | null | undefined {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return undefined;
  }
}

function initialBoard(): Board {
  const raw = readSaved();
  if (raw === undefined) {
    persistence.canSave = false;
    warn('无法访问浏览器的存储，这次的修改不会被保存。');
    return SAMPLE;
  }
  if (raw === null) return SAMPLE;
  const loaded = loadBoard(raw);
  const needsBackup = !loaded.ok || loaded.migrated;
  const backedUp = needsBackup ? tryWrite(BACKUP_KEY, raw) : true;
  if (!backedUp) persistence.canSave = false;
  if (!loaded.ok) {
    warn(
      backedUp
        ? `保存的数据无法读取（${loaded.error}），已从空的任务板开始。原来的数据保存在 ${BACKUP_KEY} 中。`
        : `保存的数据无法读取（${loaded.error}），备份也失败了，这次的修改不会被保存。`,
    );
    return EMPTY_BOARD;
  }
  if (loaded.migrated && backedUp) {
    save(loaded.board);
    announce.textContent = '已把旧版本的数据转换成新的格式。';
  } else if (loaded.migrated) {
    warn('无法备份旧版本的数据，这次的修改不会被保存。');
  }
  return loaded.board;
}

let board: Board = initialBoard();
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
  save(board);
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
  if (board !== before) save(board);
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

:::variant{kind=wrong name=no-backup fails=tests reason="读取失败时没有备份原来的数据"}
```ts file=main.ts
import { reduce, type Action, type Board, type Task } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { filterBoard, isFiltering, matchesFilters, NO_FILTERS, parseFilters, toSearch, type Filters } from './filters';
import { COLUMN_NAMES, NOT_EDITING, renderBoard, type View } from './render';
import { SAMPLE } from './sample';
import { BACKUP_KEY, EMPTY_BOARD, loadBoard, serializeBoard, STORAGE_KEY } from './storage';

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
const storageWarning = byId('storage-warning', HTMLParagraphElement);

function showStorageWarning(message: string | null): void {
  storageWarning.textContent = message ?? '';
  storageWarning.hidden = message === null;
}

/** 无法访问存储、或者无法备份原来的数据时，不再保存（以免覆盖唯一的一份原始数据） */
let canSave = true;

/** 保存任务板；失败时提示，但不影响刚才的操作 */
function save(next: Board): void {
  if (!canSave) return;
  try {
    localStorage.setItem(STORAGE_KEY, serializeBoard(next));
    showStorageWarning(null);
  } catch {
    showStorageWarning('保存失败：浏览器的存储空间可能已满，刷新之后最近的修改会丢失。');
  }
}

/** 把原来的字符串备份到 BACKUP_KEY；失败时不再保存 */
function backup(raw: string): boolean {
  try {
    localStorage.setItem(BACKUP_KEY, raw);
    return true;
  } catch {
    canSave = false;
    return false;
  }
}

/** 第一次打开时显示示例数据；读取失败时备份原来的数据，从空的任务板开始 */
function initialBoard(): Board {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // 用户阻止了网站存储数据时，访问 localStorage 就会抛出异常
    canSave = false;
    showStorageWarning('无法访问浏览器的存储，这次的修改不会被保存。');
    return SAMPLE;
  }
  if (raw === null) return SAMPLE;
  const loaded = loadBoard(raw);
  if (!loaded.ok) {
    const where = `原来的数据保存在 ${BACKUP_KEY} 中。`;
    showStorageWarning(`保存的数据无法读取（${loaded.error}），已从空的任务板开始。${where}`);
    return EMPTY_BOARD;
  }
  if (loaded.migrated) {
    // 先备份旧版本的数据，再用新的格式保存
    if (backup(raw)) {
      save(loaded.board);
      announce.textContent = '已把旧版本的数据转换成新的格式。';
    } else {
      showStorageWarning('无法备份旧版本的数据，为了不覆盖它，这次的修改不会被保存。');
    }
  }
  return loaded.board;
}

let board: Board = initialBoard();
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
  save(board);
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
  if (board !== before) save(board);
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

:::variant{kind=wrong name=overwrite-on-failure fails=tests reason="读取失败时立刻用空的任务板覆盖了原来的数据"}
```ts file=main.ts
import { reduce, type Action, type Board, type Task } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { filterBoard, isFiltering, matchesFilters, NO_FILTERS, parseFilters, toSearch, type Filters } from './filters';
import { COLUMN_NAMES, NOT_EDITING, renderBoard, type View } from './render';
import { SAMPLE } from './sample';
import { BACKUP_KEY, EMPTY_BOARD, loadBoard, serializeBoard, STORAGE_KEY } from './storage';

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
const storageWarning = byId('storage-warning', HTMLParagraphElement);

function showStorageWarning(message: string | null): void {
  storageWarning.textContent = message ?? '';
  storageWarning.hidden = message === null;
}

/** 无法访问存储、或者无法备份原来的数据时，不再保存（以免覆盖唯一的一份原始数据） */
let canSave = true;

/** 保存任务板；失败时提示，但不影响刚才的操作 */
function save(next: Board): void {
  if (!canSave) return;
  try {
    localStorage.setItem(STORAGE_KEY, serializeBoard(next));
    showStorageWarning(null);
  } catch {
    showStorageWarning('保存失败：浏览器的存储空间可能已满，刷新之后最近的修改会丢失。');
  }
}

/** 把原来的字符串备份到 BACKUP_KEY；失败时不再保存 */
function backup(raw: string): boolean {
  try {
    localStorage.setItem(BACKUP_KEY, raw);
    return true;
  } catch {
    canSave = false;
    return false;
  }
}

/** 第一次打开时显示示例数据；读取失败时备份原来的数据，从空的任务板开始 */
function initialBoard(): Board {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // 用户阻止了网站存储数据时，访问 localStorage 就会抛出异常
    canSave = false;
    showStorageWarning('无法访问浏览器的存储，这次的修改不会被保存。');
    return SAMPLE;
  }
  if (raw === null) return SAMPLE;
  const loaded = loadBoard(raw);
  if (!loaded.ok) {
    localStorage.setItem(STORAGE_KEY, serializeBoard(EMPTY_BOARD));
    const where = backup(raw) ? `原来的数据保存在 ${BACKUP_KEY} 中。` : '备份原来的数据也失败了，为了不覆盖它，这次的修改不会被保存。';
    showStorageWarning(`保存的数据无法读取（${loaded.error}），已从空的任务板开始。${where}`);
    return EMPTY_BOARD;
  }
  if (loaded.migrated) {
    // 先备份旧版本的数据，再用新的格式保存
    if (backup(raw)) {
      save(loaded.board);
      announce.textContent = '已把旧版本的数据转换成新的格式。';
    } else {
      showStorageWarning('无法备份旧版本的数据，为了不覆盖它，这次的修改不会被保存。');
    }
  }
  return loaded.board;
}

let board: Board = initialBoard();
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
  save(board);
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
  if (board !== before) save(board);
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

:::variant{kind=wrong name=rename-not-saved fails=tests reason="改名时没有保存"}
```ts file=main.ts
import { reduce, type Action, type Board, type Task } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { filterBoard, isFiltering, matchesFilters, NO_FILTERS, parseFilters, toSearch, type Filters } from './filters';
import { COLUMN_NAMES, NOT_EDITING, renderBoard, type View } from './render';
import { SAMPLE } from './sample';
import { BACKUP_KEY, EMPTY_BOARD, loadBoard, serializeBoard, STORAGE_KEY } from './storage';

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
const storageWarning = byId('storage-warning', HTMLParagraphElement);

function showStorageWarning(message: string | null): void {
  storageWarning.textContent = message ?? '';
  storageWarning.hidden = message === null;
}

/** 无法访问存储、或者无法备份原来的数据时，不再保存（以免覆盖唯一的一份原始数据） */
let canSave = true;

/** 保存任务板；失败时提示，但不影响刚才的操作 */
function save(next: Board): void {
  if (!canSave) return;
  try {
    localStorage.setItem(STORAGE_KEY, serializeBoard(next));
    showStorageWarning(null);
  } catch {
    showStorageWarning('保存失败：浏览器的存储空间可能已满，刷新之后最近的修改会丢失。');
  }
}

/** 把原来的字符串备份到 BACKUP_KEY；失败时不再保存 */
function backup(raw: string): boolean {
  try {
    localStorage.setItem(BACKUP_KEY, raw);
    return true;
  } catch {
    canSave = false;
    return false;
  }
}

/** 第一次打开时显示示例数据；读取失败时备份原来的数据，从空的任务板开始 */
function initialBoard(): Board {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // 用户阻止了网站存储数据时，访问 localStorage 就会抛出异常
    canSave = false;
    showStorageWarning('无法访问浏览器的存储，这次的修改不会被保存。');
    return SAMPLE;
  }
  if (raw === null) return SAMPLE;
  const loaded = loadBoard(raw);
  if (!loaded.ok) {
    const where = backup(raw) ? `原来的数据保存在 ${BACKUP_KEY} 中。` : '备份原来的数据也失败了，为了不覆盖它，这次的修改不会被保存。';
    showStorageWarning(`保存的数据无法读取（${loaded.error}），已从空的任务板开始。${where}`);
    return EMPTY_BOARD;
  }
  if (loaded.migrated) {
    // 先备份旧版本的数据，再用新的格式保存
    if (backup(raw)) {
      save(loaded.board);
      announce.textContent = '已把旧版本的数据转换成新的格式。';
    } else {
      showStorageWarning('无法备份旧版本的数据，为了不覆盖它，这次的修改不会被保存。');
    }
  }
  return loaded.board;
}

let board: Board = initialBoard();
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
  save(board);
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

:::variant{kind=wrong name=quota-breaks-action fails=tests reason="没有捕获 setItem 的异常，存储满了时添加任务也失败了"}
```ts file=main.ts
import { reduce, type Action, type Board, type Task } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { filterBoard, isFiltering, matchesFilters, NO_FILTERS, parseFilters, toSearch, type Filters } from './filters';
import { COLUMN_NAMES, NOT_EDITING, renderBoard, type View } from './render';
import { SAMPLE } from './sample';
import { BACKUP_KEY, EMPTY_BOARD, loadBoard, serializeBoard, STORAGE_KEY } from './storage';

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
const storageWarning = byId('storage-warning', HTMLParagraphElement);

function showStorageWarning(message: string | null): void {
  storageWarning.textContent = message ?? '';
  storageWarning.hidden = message === null;
}

/** 无法访问存储、或者无法备份原来的数据时，不再保存（以免覆盖唯一的一份原始数据） */
let canSave = true;

/** 保存任务板；失败时提示，但不影响刚才的操作 */
function save(next: Board): void {
  if (!canSave) return;
  localStorage.setItem(STORAGE_KEY, serializeBoard(next));
  showStorageWarning(null);
}

/** 把原来的字符串备份到 BACKUP_KEY；失败时不再保存 */
function backup(raw: string): boolean {
  try {
    localStorage.setItem(BACKUP_KEY, raw);
    return true;
  } catch {
    canSave = false;
    return false;
  }
}

/** 第一次打开时显示示例数据；读取失败时备份原来的数据，从空的任务板开始 */
function initialBoard(): Board {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // 用户阻止了网站存储数据时，访问 localStorage 就会抛出异常
    canSave = false;
    showStorageWarning('无法访问浏览器的存储，这次的修改不会被保存。');
    return SAMPLE;
  }
  if (raw === null) return SAMPLE;
  const loaded = loadBoard(raw);
  if (!loaded.ok) {
    const where = backup(raw) ? `原来的数据保存在 ${BACKUP_KEY} 中。` : '备份原来的数据也失败了，为了不覆盖它，这次的修改不会被保存。';
    showStorageWarning(`保存的数据无法读取（${loaded.error}），已从空的任务板开始。${where}`);
    return EMPTY_BOARD;
  }
  if (loaded.migrated) {
    // 先备份旧版本的数据，再用新的格式保存
    if (backup(raw)) {
      save(loaded.board);
      announce.textContent = '已把旧版本的数据转换成新的格式。';
    } else {
      showStorageWarning('无法备份旧版本的数据，为了不覆盖它，这次的修改不会被保存。');
    }
  }
  return loaded.board;
}

let board: Board = initialBoard();
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
  save(board);
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
  if (board !== before) save(board);
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

:::variant{kind=wrong name=save-view-state fails=tests reason="把界面状态也保存了进去"}
```ts file=main.ts
import { reduce, type Action, type Board, type Task } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { filterBoard, isFiltering, matchesFilters, NO_FILTERS, parseFilters, toSearch, type Filters } from './filters';
import { COLUMN_NAMES, NOT_EDITING, renderBoard, type View } from './render';
import { SAMPLE } from './sample';
import { BACKUP_KEY, EMPTY_BOARD, loadBoard, serializeBoard, STORAGE_KEY } from './storage';

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
const storageWarning = byId('storage-warning', HTMLParagraphElement);

function showStorageWarning(message: string | null): void {
  storageWarning.textContent = message ?? '';
  storageWarning.hidden = message === null;
}

/** 无法访问存储、或者无法备份原来的数据时，不再保存（以免覆盖唯一的一份原始数据） */
let canSave = true;

/** 保存任务板；失败时提示，但不影响刚才的操作 */
function save(next: Board): void {
  if (!canSave) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, board: next, view }));
    showStorageWarning(null);
  } catch {
    showStorageWarning('保存失败：浏览器的存储空间可能已满，刷新之后最近的修改会丢失。');
  }
}

/** 把原来的字符串备份到 BACKUP_KEY；失败时不再保存 */
function backup(raw: string): boolean {
  try {
    localStorage.setItem(BACKUP_KEY, raw);
    return true;
  } catch {
    canSave = false;
    return false;
  }
}

/** 第一次打开时显示示例数据；读取失败时备份原来的数据，从空的任务板开始 */
function initialBoard(): Board {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // 用户阻止了网站存储数据时，访问 localStorage 就会抛出异常
    canSave = false;
    showStorageWarning('无法访问浏览器的存储，这次的修改不会被保存。');
    return SAMPLE;
  }
  if (raw === null) return SAMPLE;
  const loaded = loadBoard(raw);
  if (!loaded.ok) {
    const where = backup(raw) ? `原来的数据保存在 ${BACKUP_KEY} 中。` : '备份原来的数据也失败了，为了不覆盖它，这次的修改不会被保存。';
    showStorageWarning(`保存的数据无法读取（${loaded.error}），已从空的任务板开始。${where}`);
    return EMPTY_BOARD;
  }
  if (loaded.migrated) {
    // 先备份旧版本的数据，再用新的格式保存
    if (backup(raw)) {
      save(loaded.board);
      announce.textContent = '已把旧版本的数据转换成新的格式。';
    } else {
      showStorageWarning('无法备份旧版本的数据，为了不覆盖它，这次的修改不会被保存。');
    }
  }
  return loaded.board;
}

let board: Board = initialBoard();
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
  save(board);
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
  if (board !== before) save(board);
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

:::variant{kind=wrong name=save-after-backup-failed fails=tests reason="备份失败之后仍然保存，原来唯一的一份数据会被覆盖"}
```ts file=main.ts
import { reduce, type Action, type Board, type Task } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { filterBoard, isFiltering, matchesFilters, NO_FILTERS, parseFilters, toSearch, type Filters } from './filters';
import { COLUMN_NAMES, NOT_EDITING, renderBoard, type View } from './render';
import { SAMPLE } from './sample';
import { BACKUP_KEY, EMPTY_BOARD, loadBoard, serializeBoard, STORAGE_KEY } from './storage';

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
const storageWarning = byId('storage-warning', HTMLParagraphElement);

function showStorageWarning(message: string | null): void {
  storageWarning.textContent = message ?? '';
  storageWarning.hidden = message === null;
}

/** 无法访问存储、或者无法备份原来的数据时，不再保存（以免覆盖唯一的一份原始数据） */
let canSave = true;

/** 保存任务板；失败时提示，但不影响刚才的操作 */
function save(next: Board): void {
  if (!canSave) return;
  try {
    localStorage.setItem(STORAGE_KEY, serializeBoard(next));
    showStorageWarning(null);
  } catch {
    showStorageWarning('保存失败：浏览器的存储空间可能已满，刷新之后最近的修改会丢失。');
  }
}

/** 把原来的字符串备份到 BACKUP_KEY；失败时不再保存 */
function backup(raw: string): boolean {
  try {
    localStorage.setItem(BACKUP_KEY, raw);
    return true;
  } catch {
    return false;
  }
}

/** 第一次打开时显示示例数据；读取失败时备份原来的数据，从空的任务板开始 */
function initialBoard(): Board {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // 用户阻止了网站存储数据时，访问 localStorage 就会抛出异常
    canSave = false;
    showStorageWarning('无法访问浏览器的存储，这次的修改不会被保存。');
    return SAMPLE;
  }
  if (raw === null) return SAMPLE;
  const loaded = loadBoard(raw);
  if (!loaded.ok) {
    const where = backup(raw) ? `原来的数据保存在 ${BACKUP_KEY} 中。` : '备份原来的数据也失败了，为了不覆盖它，这次的修改不会被保存。';
    showStorageWarning(`保存的数据无法读取（${loaded.error}），已从空的任务板开始。${where}`);
    return EMPTY_BOARD;
  }
  if (loaded.migrated) {
    // 先备份旧版本的数据，再用新的格式保存
    if (backup(raw)) {
      save(loaded.board);
      announce.textContent = '已把旧版本的数据转换成新的格式。';
    } else {
      showStorageWarning('无法备份旧版本的数据，为了不覆盖它，这次的修改不会被保存。');
    }
  }
  return loaded.board;
}

let board: Board = initialBoard();
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
  save(board);
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
  if (board !== before) save(board);
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

:::variant{kind=wrong name=migrate-without-backup fails=tests reason="迁移旧版本的数据时没有先备份就覆盖了它"}
```ts file=main.ts
import { reduce, type Action, type Board, type Task } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { filterBoard, isFiltering, matchesFilters, NO_FILTERS, parseFilters, toSearch, type Filters } from './filters';
import { COLUMN_NAMES, NOT_EDITING, renderBoard, type View } from './render';
import { SAMPLE } from './sample';
import { BACKUP_KEY, EMPTY_BOARD, loadBoard, serializeBoard, STORAGE_KEY } from './storage';

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
const storageWarning = byId('storage-warning', HTMLParagraphElement);

function showStorageWarning(message: string | null): void {
  storageWarning.textContent = message ?? '';
  storageWarning.hidden = message === null;
}

/** 无法访问存储、或者无法备份原来的数据时，不再保存（以免覆盖唯一的一份原始数据） */
let canSave = true;

/** 保存任务板；失败时提示，但不影响刚才的操作 */
function save(next: Board): void {
  if (!canSave) return;
  try {
    localStorage.setItem(STORAGE_KEY, serializeBoard(next));
    showStorageWarning(null);
  } catch {
    showStorageWarning('保存失败：浏览器的存储空间可能已满，刷新之后最近的修改会丢失。');
  }
}

/** 把原来的字符串备份到 BACKUP_KEY；失败时不再保存 */
function backup(raw: string): boolean {
  try {
    localStorage.setItem(BACKUP_KEY, raw);
    return true;
  } catch {
    canSave = false;
    return false;
  }
}

/** 第一次打开时显示示例数据；读取失败时备份原来的数据，从空的任务板开始 */
function initialBoard(): Board {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // 用户阻止了网站存储数据时，访问 localStorage 就会抛出异常
    canSave = false;
    showStorageWarning('无法访问浏览器的存储，这次的修改不会被保存。');
    return SAMPLE;
  }
  if (raw === null) return SAMPLE;
  const loaded = loadBoard(raw);
  if (!loaded.ok) {
    const where = backup(raw) ? `原来的数据保存在 ${BACKUP_KEY} 中。` : '备份原来的数据也失败了，为了不覆盖它，这次的修改不会被保存。';
    showStorageWarning(`保存的数据无法读取（${loaded.error}），已从空的任务板开始。${where}`);
    return EMPTY_BOARD;
  }
  if (loaded.migrated) {
    // 先备份旧版本的数据，再用新的格式保存
    if (raw !== '') {
      save(loaded.board);
      announce.textContent = '已把旧版本的数据转换成新的格式。';
    } else {
      showStorageWarning('无法备份旧版本的数据，为了不覆盖它，这次的修改不会被保存。');
    }
  }
  return loaded.board;
}

let board: Board = initialBoard();
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
  save(board);
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
  if (board !== before) save(board);
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

:::variant{kind=wrong name=crash-when-storage-blocked fails=tests reason="读取时没有处理异常，存储无法访问时应用无法启动"}
```ts file=main.ts
import { reduce, type Action, type Board, type Task } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { filterBoard, isFiltering, matchesFilters, NO_FILTERS, parseFilters, toSearch, type Filters } from './filters';
import { COLUMN_NAMES, NOT_EDITING, renderBoard, type View } from './render';
import { SAMPLE } from './sample';
import { BACKUP_KEY, EMPTY_BOARD, loadBoard, serializeBoard, STORAGE_KEY } from './storage';

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
const storageWarning = byId('storage-warning', HTMLParagraphElement);

function showStorageWarning(message: string | null): void {
  storageWarning.textContent = message ?? '';
  storageWarning.hidden = message === null;
}

/** 无法访问存储、或者无法备份原来的数据时，不再保存（以免覆盖唯一的一份原始数据） */
let canSave = true;

/** 保存任务板；失败时提示，但不影响刚才的操作 */
function save(next: Board): void {
  if (!canSave) return;
  try {
    localStorage.setItem(STORAGE_KEY, serializeBoard(next));
    showStorageWarning(null);
  } catch {
    showStorageWarning('保存失败：浏览器的存储空间可能已满，刷新之后最近的修改会丢失。');
  }
}

/** 把原来的字符串备份到 BACKUP_KEY；失败时不再保存 */
function backup(raw: string): boolean {
  try {
    localStorage.setItem(BACKUP_KEY, raw);
    return true;
  } catch {
    canSave = false;
    return false;
  }
}

/** 第一次打开时显示示例数据；读取失败时备份原来的数据，从空的任务板开始 */
function initialBoard(): Board {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return SAMPLE;
  const loaded = loadBoard(raw);
  if (!loaded.ok) {
    const where = backup(raw) ? `原来的数据保存在 ${BACKUP_KEY} 中。` : '备份原来的数据也失败了，为了不覆盖它，这次的修改不会被保存。';
    showStorageWarning(`保存的数据无法读取（${loaded.error}），已从空的任务板开始。${where}`);
    return EMPTY_BOARD;
  }
  if (loaded.migrated) {
    // 先备份旧版本的数据，再用新的格式保存
    if (backup(raw)) {
      save(loaded.board);
      announce.textContent = '已把旧版本的数据转换成新的格式。';
    } else {
      showStorageWarning('无法备份旧版本的数据，为了不覆盖它，这次的修改不会被保存。');
    }
  }
  return loaded.board;
}

let board: Board = initialBoard();
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
  save(board);
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
  if (board !== before) save(board);
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
