---
kind: challenge
title: 导入与导出任务板
---
任务板的页面中多了一个“导入与导出”区域（见 `index.html`）。`main.ts`（只读）调用 `transfer.ts` 中的 `setupTransfer(options)`，把当前的任务板、替换任务板的方法和这几个元素交给它。在 `transfer.ts` 中实现：

1. **导出 JSON**：点击“导出 JSON”时，生成一个内容为 `serializeBoard(当前的任务板)`、类型为 `application/json` 的文件，下载为 `taskboard.json`。状态区域显示 `已导出 N 个任务（taskboard.json）`；
2. **导出 Markdown**：内容为 `boardToMarkdown(当前的任务板)`（小任务的参考解，在 `markdown.ts` 中），类型 `text/markdown`，文件名 `taskboard.md`，状态区域显示 `已导出 N 个任务（taskboard.md）`；
3. **下载的方法**：`URL.createObjectURL` 得到地址，创建一个 `<a>`，设置 `href` 和 `download`，调用它的 `click()`；之后用 `URL.revokeObjectURL` 释放这个地址（可以在 `click()` 之后立即释放，也可以用 `setTimeout` 稍后释放）；
4. **导入**：用户在“导入 JSON 文件”中选择了文件（`change` 事件）之后：
   - 没有选择文件时什么也不做；
   - 文件大于 `MAX_IMPORT_BYTES`（1 MB）时显示 `导入失败：文件太大（最多 1 MB）`，**不读取**它的内容；
   - 否则读取文本，用 `loadBoard` 验证。失败时显示 `导入失败：原因`（`loadBoard` 给出的原因），任务板不变；
   - 成功时用 `window.confirm` 询问 `用文件中的 N 个任务替换当前的任务板吗？`。确认后调用 `replaceBoard`，显示 `已导入 N 个任务`，转换过旧版本的数据时后面再加上 `（已从旧版本的格式转换）`；取消时显示 `已取消导入`，任务板不变；
5. 每次选择文件之后都清空输入框的 `value`，这样再次选择同一个文件也能导入。

这个网站的预览不允许下载文件（见正文），测试会拦截 `createObjectURL` 和链接的 `click()`，检查生成的文件。下载到本机（“下载本地项目”）运行时，可以真的下载和导入。

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
      <section aria-labelledby="transfer-title">
        <h2 id="transfer-title">导入与导出</h2>
        <button type="button" id="export-json">导出 JSON</button>
        <button type="button" id="export-markdown">导出 Markdown</button>
        <label for="import-file">导入 JSON 文件</label>
        <input id="import-file" type="file" accept=".json,application/json" />
        <p id="transfer-status" role="status"></p>
      </section>
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
section[aria-labelledby="transfer-title"] { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
```
```ts file=main.ts readonly
import { reduce, type Action, type Board, type Task } from './board';
import { parseTaskInput, parseTitle } from './parse';
import { filterBoard, isFiltering, matchesFilters, NO_FILTERS, parseFilters, toSearch, type Filters } from './filters';
import { COLUMN_NAMES, NOT_EDITING, renderBoard, type View } from './render';
import { SAMPLE } from './sample';
import { BACKUP_KEY, EMPTY_BOARD, loadBoard, serializeBoard, STORAGE_KEY } from './storage';
import { setupTransfer } from './transfer';

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

// p1-06：导入与导出（transfer.ts）
setupTransfer({
  getBoard: () => board,
  replaceBoard: (next) => {
    board = next;
    view = NOT_EDITING;
    save(board);
    render();
  },
  exportJsonButton: byId('export-json', HTMLButtonElement),
  exportMarkdownButton: byId('export-markdown', HTMLButtonElement),
  importInput: byId('import-file', HTMLInputElement),
  status: byId('transfer-status', HTMLParagraphElement),
});

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
    if (typeof tag !== 'string' || tag === '' || charCount(tag) > 10 || cleanTags.includes(tag)) return null;
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
```ts file=markdown.ts readonly
import { columnsOf, STATUSES, type Board, type Task } from './board';

const NAMES = { todo: '待办', doing: '进行中', done: '已完成' } as const;

/** 在 Markdown 中有特殊含义的字符前面加上反斜杠（CommonMark 的反斜杠转义） */
function escape(text: string): string {
  return text.replace(/[\\`*_[\]<>#]/g, '\\$&');
}

/** 一个任务一行：标题，然后是每个标签 */
function line(task: Task): string {
  return `- ${[escape(task.title), ...task.tags.map((tag) => `#${escape(tag)}`)].join(' ')}`;
}

/** 把任务板导出为 Markdown：三列依次排列，每列的任务顺序与任务板上相同 */
export function boardToMarkdown(board: Board): string {
  const columns = columnsOf(board);
  const lines = ['# 任务板'];
  for (const status of STATUSES) {
    const tasks = columns[status];
    lines.push('', `## ${NAMES[status]}（${tasks.length}）`, '');
    if (tasks.length === 0) lines.push('（没有任务）');
    else lines.push(...tasks.map(line));
  }
  return `${lines.join('\n')}\n`;
}
```
:::

:::files{role=starter}
```ts file=transfer.ts
import type { Board } from './board';
import { boardToMarkdown } from './markdown';
import { loadBoard, serializeBoard } from './storage';

export type TransferOptions = {
  /** 当前的任务板 */
  getBoard: () => Board;
  /** 用导入的任务板替换当前的：同时保存，并重新渲染 */
  replaceBoard: (board: Board) => void;
  exportJsonButton: HTMLButtonElement;
  exportMarkdownButton: HTMLButtonElement;
  importInput: HTMLInputElement;
  /** 显示结果的状态区域 */
  status: HTMLElement;
};

/** 导入的文件最大 1 MB */
export const MAX_IMPORT_BYTES = 1024 * 1024;

export function setupTransfer(options: TransferOptions): void {
  // 在这里实现导出和导入
}
```
:::

:::files{role=solution}
```ts file=transfer.ts
import type { Board } from './board';
import { boardToMarkdown } from './markdown';
import { loadBoard, serializeBoard } from './storage';

export type TransferOptions = {
  /** 当前的任务板 */
  getBoard: () => Board;
  /** 用导入的任务板替换当前的：同时保存，并重新渲染 */
  replaceBoard: (board: Board) => void;
  exportJsonButton: HTMLButtonElement;
  exportMarkdownButton: HTMLButtonElement;
  importInput: HTMLInputElement;
  /** 显示结果的状态区域 */
  status: HTMLElement;
};

/** 导入的文件最大 1 MB */
export const MAX_IMPORT_BYTES = 1024 * 1024;

/** 让浏览器把 blob 保存为文件 filename */
function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // 在下一个任务中释放：这时这一次点击引起的下载已经开始了
  setTimeout(() => URL.revokeObjectURL(url));
}

export function setupTransfer({ getBoard, replaceBoard, exportJsonButton, exportMarkdownButton, importInput, status }: TransferOptions): void {
  const exportAs = (text: string, type: string, filename: string) => {
    download(new Blob([text], { type }), filename);
    status.textContent = `已导出 ${getBoard().tasks.length} 个任务（${filename}）`;
  };
  exportJsonButton.addEventListener('click', () => exportAs(serializeBoard(getBoard()), 'application/json', 'taskboard.json'));
  exportMarkdownButton.addEventListener('click', () => exportAs(boardToMarkdown(getBoard()), 'text/markdown', 'taskboard.md'));

  /** 读取并验证文件，确认之后替换任务板；返回要显示的结果 */
  const importFile = async (file: File): Promise<string> => {
    // 太大的文件不读取：读取和解析它可能让页面卡住
    if (file.size > MAX_IMPORT_BYTES) return '导入失败：文件太大（最多 1 MB）';
    // 文件的内容和 localStorage 中的一样不可信：用同一个 loadBoard 验证
    const loaded = loadBoard(await file.text());
    if (!loaded.ok) return `导入失败：${loaded.error}`;
    const count = loaded.board.tasks.length;
    if (!window.confirm(`用文件中的 ${count} 个任务替换当前的任务板吗？`)) return '已取消导入';
    replaceBoard(loaded.board);
    return `已导入 ${count} 个任务${loaded.migrated ? '（已从旧版本的格式转换）' : ''}`;
  };

  importInput.addEventListener('change', () => {
    const file = importInput.files?.[0];
    // 清空输入框：再次选择同一个文件时也会触发 change（file 已经取出来了，仍然可以读取）
    importInput.value = '';
    if (file === undefined) return;
    void importFile(file)
      .catch(() => '导入失败：无法读取这个文件')
      .then((message) => {
        status.textContent = message;
      });
  });
}
```
:::

:::files{role=tests}
```ts file=transfer.test.ts
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import type { Board } from './board';
import { boardToMarkdown } from './markdown';
import { SAMPLE } from './sample';
import { loadBoard, serializeBoard, STORAGE_KEY } from './storage';

/** 拦截下载：记下生成的文件和点击的链接，不真的下载 */
function captureDownloads() {
  const files: Blob[] = [];
  const links: { href: string; download: string }[] = [];
  vi.spyOn(URL, 'createObjectURL').mockImplementation((object: unknown) => {
    if (object instanceof Blob) files.push(object);
    return `blob:test/${files.length}`;
  });
  const revoked = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    links.push({ href: this.href, download: this.download });
  });
  return { files, links, revoked };
}

const jsonFile = (text: string, name = 'board.json') => new File([text], name, { type: 'application/json' });
const importInput = () => screen.getByLabelText('导入 JSON 文件');
/** 任务板上的任务：每个任务都有一个“删除：标题”按钮 */
const titles = () => screen.queryAllByRole('button', { name: /^删除：/ }).map((button) => button.getAttribute('aria-label')?.slice(3));
const nextTask = () => new Promise((resolve) => setTimeout(resolve));

const IMPORTED: Board = { tasks: [{ id: 't1', title: '从文件来的', tags: ['导入'], status: 'doing', createdAt: 1 }], nextId: 2 };

describe('导出', () => {
  test('导出 JSON：内容、类型和文件名；状态中说明导出了几个任务', async () => {
    const { files, links } = captureDownloads();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '导出 JSON' }));
    expect(links).toEqual([{ href: 'blob:test/1', download: 'taskboard.json' }]);
    expect(files).toHaveLength(1);
    expect(files[0]?.type).toBe('application/json');
    expect(await files[0]?.text()).toBe(serializeBoard(SAMPLE));
    expect(screen.getByText('已导出 4 个任务（taskboard.json）')).toBeVisible();
  });

  test('导出 Markdown：内容、类型和文件名', async () => {
    const { files, links } = captureDownloads();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '导出 Markdown' }));
    expect(links).toEqual([{ href: 'blob:test/1', download: 'taskboard.md' }]);
    expect(files[0]?.type).toBe('text/markdown');
    expect(await files[0]?.text()).toBe(boardToMarkdown(SAMPLE));
    expect(screen.getByText('已导出 4 个任务（taskboard.md）')).toBeVisible();
  });

  test('导出的是当前的任务板；下载之后释放 object URL', async () => {
    const { files, revoked } = captureDownloads();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('新任务'), '买面包 #家{Enter}');
    await user.click(screen.getByRole('button', { name: '导出 JSON' }));
    const loaded = loadBoard((await files[0]?.text()) ?? null);
    expect(loaded.ok && loaded.board.tasks.map((t) => t.title)).toEqual(['写周报', '修自行车', '买牛奶', 'Read the TS Handbook', '买面包']);
    expect(screen.getByText('已导出 5 个任务（taskboard.json）')).toBeVisible();
    await nextTask();
    expect(revoked).toHaveBeenCalledWith('blob:test/1');
  });
});

describe('导入', () => {
  test('确认之后替换任务板并保存；状态中说明导入了几个任务', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    await user.upload(importInput(), jsonFile(serializeBoard(IMPORTED)));
    expect(await screen.findByText('已导入 1 个任务')).toBeVisible();
    expect(confirm).toHaveBeenCalledWith('用文件中的 1 个任务替换当前的任务板吗？');
    expect(titles()).toEqual(['从文件来的']);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(serializeBoard(IMPORTED));
  });

  test('旧版本的数据：转换之后导入，并说明', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    await user.upload(importInput(), jsonFile(JSON.stringify({ version: 1, todos: [{ id: 3, text: '旧的待办', done: true }] })));
    expect(await screen.findByText('已导入 1 个任务（已从旧版本的格式转换）')).toBeVisible();
    expect(titles()).toEqual(['旧的待办']);
  });

  test('取消：任务板不变，也不保存', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    await user.upload(importInput(), jsonFile(serializeBoard(IMPORTED)));
    expect(await screen.findByText('已取消导入')).toBeVisible();
    expect(titles()).toEqual(['写周报', 'Read the TS Handbook', '修自行车', '买牛奶']);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  test('无效的文件：说明原因，不询问、不替换', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    await user.upload(importInput(), jsonFile('这不是 JSON'));
    expect(await screen.findByText('导入失败：JSON 格式不正确')).toBeVisible();
    await user.upload(importInput(), jsonFile(JSON.stringify({ version: 2, board: { tasks: [{ id: 't1' }], nextId: 2 } })));
    expect(await screen.findByText('导入失败：第 1 个任务的数据不正确')).toBeVisible();
    expect(confirm).not.toHaveBeenCalled();
    expect(titles()).toHaveLength(4);
  });

  test('超过 1 MB 的文件不读取；正好 1 MB 可以导入', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    const big = jsonFile(' '.repeat(1024 * 1024 + 1));
    const read = vi.spyOn(big, 'text');
    await user.upload(importInput(), big);
    expect(await screen.findByText('导入失败：文件太大（最多 1 MB）')).toBeVisible();
    expect(read).not.toHaveBeenCalled();

    // JSON 允许末尾有空白：补到正好 1 MB（按字节计算）
    const text = serializeBoard(IMPORTED);
    await user.upload(importInput(), jsonFile(text + ' '.repeat(1024 * 1024 - new Blob([text]).size)));
    expect(await screen.findByText('已导入 1 个任务')).toBeVisible();
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  test('导入之后清空输入框：同一个文件可以再选一次', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    const file = jsonFile(serializeBoard(IMPORTED));
    await user.upload(importInput(), file);
    expect(await screen.findByText('已取消导入')).toBeVisible();
    expect(importInput()).toHaveProperty('value', '');
    confirm.mockReturnValue(true);
    await user.upload(importInput(), file);
    expect(await screen.findByText('已导入 1 个任务')).toBeVisible();
    expect(confirm).toHaveBeenCalledTimes(2);
  });
});
```
:::

:::hint{level=1}
先写一个 `download(blob, filename)`：`createObjectURL`、创建 `<a>`、设置 `href` 和 `download`、`click()`、释放地址。两个导出按钮都调用它，只是内容、类型和文件名不同。导入写成一个 `async` 函数，读取文件用 `await file.text()`；`change` 的监听器中先取出 `importInput.files?.[0]`，再清空 `value`。
:::

:::hint{level=2}
导入的步骤按顺序检查，每一步失败都直接返回要显示的文字：先看 `file.size`（在读取之前），再 `loadBoard(await file.text())`，再 `window.confirm(…)`。把它写成返回字符串的 `async` 函数，监听器中 `void importFile(file).then((message) => { status.textContent = message; })`，就不会忘记在某个分支中显示结果。数量用 `loaded.board.tasks.length`。
:::

:::explanation
导出和导入是同一件事的两面：导出时数据离开应用，变成用户手中的一个文件；导入时一个**来历不明**的文件进入应用。

导出要注意的是资源：`createObjectURL` 让 Blob 留在内存中，直到页面关闭或者 `revokeObjectURL`。参考解在下一个任务中释放（`setTimeout`），这时这一次点击引起的下载已经开始了；替代解在 `click()` 之后立即释放，在现在的浏览器中也能正常下载。

导入要注意的是信任：

- **大小**：在读取之前检查。`file.size` 不需要读取文件就能得到；一个几百 MB 的文件被 `text()` 读进内存、再交给 `JSON.parse`，页面可能卡住很久；
- **内容**：和 p1-05 读取 localStorage 一样，用 `loadBoard` 验证。同一个函数处理了旧版本的转换和各种坏数据，导入不需要自己再写一遍规则。这就是 p1-05 把读取写成纯函数 `string | null → LoadResult` 的好处；
- **确认**：导入会替换所有的任务，而且没有“撤销”。在验证**之后**再问用户：先告诉他文件中有几个任务，他才能判断这是不是想要的文件；坏文件则直接说明原因，没有必要询问；
- **清空输入框**：用户取消之后可能会再选一次同一个文件。不清空的话，输入框的值没有变化，`change` 事件不会触发。

`replaceBoard` 由 `main.ts` 提供：替换数据的同时保存、重新渲染，并退出正在进行的改名。`transfer.ts` 不需要知道这些细节，只依赖 `TransferOptions` 中的几个函数和元素，所以测试也可以直接在页面上进行。
:::

:::variant{kind=alt name=format-table}
```ts file=transfer.ts
import type { Board } from './board';
import { boardToMarkdown } from './markdown';
import { loadBoard, serializeBoard } from './storage';

export type TransferOptions = {
  /** 当前的任务板 */
  getBoard: () => Board;
  /** 用导入的任务板替换当前的：同时保存，并重新渲染 */
  replaceBoard: (board: Board) => void;
  exportJsonButton: HTMLButtonElement;
  exportMarkdownButton: HTMLButtonElement;
  importInput: HTMLInputElement;
  /** 显示结果的状态区域 */
  status: HTMLElement;
};

/** 导入的文件最大 1 MB */
export const MAX_IMPORT_BYTES = 1024 * 1024;

const FORMATS = {
  json: { type: 'application/json', filename: 'taskboard.json', write: serializeBoard },
  markdown: { type: 'text/markdown', filename: 'taskboard.md', write: boardToMarkdown },
} as const;

export function setupTransfer(options: TransferOptions): void {
  const say = (text: string) => {
    options.status.textContent = text;
  };

  for (const [button, format] of [
    [options.exportJsonButton, FORMATS.json],
    [options.exportMarkdownButton, FORMATS.markdown],
  ] as const) {
    button.addEventListener('click', () => {
      const board = options.getBoard();
      const url = URL.createObjectURL(new Blob([format.write(board)], { type: format.type }));
      const link = Object.assign(document.createElement('a'), { href: url, download: format.filename });
      link.click();
      URL.revokeObjectURL(url);
      say(`已导出 ${board.tasks.length} 个任务（${format.filename}）`);
    });
  }

  options.importInput.addEventListener('change', async () => {
    const file = options.importInput.files?.item(0) ?? null;
    options.importInput.value = '';
    if (file === null) return;
    if (file.size > MAX_IMPORT_BYTES) {
      say('导入失败：文件太大（最多 1 MB）');
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      say('导入失败：无法读取这个文件');
      return;
    }
    const result = loadBoard(text);
    if (!result.ok) {
      say(`导入失败：${result.error}`);
      return;
    }
    const n = result.board.tasks.length;
    if (window.confirm(`用文件中的 ${n} 个任务替换当前的任务板吗？`)) {
      options.replaceBoard(result.board);
      say(`已导入 ${n} 个任务` + (result.migrated ? '（已从旧版本的格式转换）' : ''));
    } else {
      say('已取消导入');
    }
  });
}
```
:::

:::variant{kind=wrong name=skips-confirm fails=tests reason="没有询问就替换了任务板：用户选错了文件时，所有的任务都没了"}
```ts file=transfer.ts
import type { Board } from './board';
import { boardToMarkdown } from './markdown';
import { loadBoard, serializeBoard } from './storage';

export type TransferOptions = {
  /** 当前的任务板 */
  getBoard: () => Board;
  /** 用导入的任务板替换当前的：同时保存，并重新渲染 */
  replaceBoard: (board: Board) => void;
  exportJsonButton: HTMLButtonElement;
  exportMarkdownButton: HTMLButtonElement;
  importInput: HTMLInputElement;
  /** 显示结果的状态区域 */
  status: HTMLElement;
};

/** 导入的文件最大 1 MB */
export const MAX_IMPORT_BYTES = 1024 * 1024;

/** 让浏览器把 blob 保存为文件 filename */
function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // 在下一个任务中释放：这时这一次点击引起的下载已经开始了
  setTimeout(() => URL.revokeObjectURL(url));
}

export function setupTransfer({ getBoard, replaceBoard, exportJsonButton, exportMarkdownButton, importInput, status }: TransferOptions): void {
  const exportAs = (text: string, type: string, filename: string) => {
    download(new Blob([text], { type }), filename);
    status.textContent = `已导出 ${getBoard().tasks.length} 个任务（${filename}）`;
  };
  exportJsonButton.addEventListener('click', () => exportAs(serializeBoard(getBoard()), 'application/json', 'taskboard.json'));
  exportMarkdownButton.addEventListener('click', () => exportAs(boardToMarkdown(getBoard()), 'text/markdown', 'taskboard.md'));

  /** 读取并验证文件，确认之后替换任务板；返回要显示的结果 */
  const importFile = async (file: File): Promise<string> => {
    // 太大的文件不读取：读取和解析它可能让页面卡住
    if (file.size > MAX_IMPORT_BYTES) return '导入失败：文件太大（最多 1 MB）';
    // 文件的内容和 localStorage 中的一样不可信：用同一个 loadBoard 验证
    const loaded = loadBoard(await file.text());
    if (!loaded.ok) return `导入失败：${loaded.error}`;
    const count = loaded.board.tasks.length;
    replaceBoard(loaded.board);
    return `已导入 ${count} 个任务${loaded.migrated ? '（已从旧版本的格式转换）' : ''}`;
  };

  importInput.addEventListener('change', () => {
    const file = importInput.files?.[0];
    // 清空输入框：再次选择同一个文件时也会触发 change（file 已经取出来了，仍然可以读取）
    importInput.value = '';
    if (file === undefined) return;
    void importFile(file)
      .catch(() => '导入失败：无法读取这个文件')
      .then((message) => {
        status.textContent = message;
      });
  });
}
```
:::

:::variant{kind=wrong name=no-reset fails=tests reason="没有清空输入框：再次选择同一个文件时不会触发 change，看起来像是导入没有反应"}
```ts file=transfer.ts
import type { Board } from './board';
import { boardToMarkdown } from './markdown';
import { loadBoard, serializeBoard } from './storage';

export type TransferOptions = {
  /** 当前的任务板 */
  getBoard: () => Board;
  /** 用导入的任务板替换当前的：同时保存，并重新渲染 */
  replaceBoard: (board: Board) => void;
  exportJsonButton: HTMLButtonElement;
  exportMarkdownButton: HTMLButtonElement;
  importInput: HTMLInputElement;
  /** 显示结果的状态区域 */
  status: HTMLElement;
};

/** 导入的文件最大 1 MB */
export const MAX_IMPORT_BYTES = 1024 * 1024;

/** 让浏览器把 blob 保存为文件 filename */
function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // 在下一个任务中释放：这时这一次点击引起的下载已经开始了
  setTimeout(() => URL.revokeObjectURL(url));
}

export function setupTransfer({ getBoard, replaceBoard, exportJsonButton, exportMarkdownButton, importInput, status }: TransferOptions): void {
  const exportAs = (text: string, type: string, filename: string) => {
    download(new Blob([text], { type }), filename);
    status.textContent = `已导出 ${getBoard().tasks.length} 个任务（${filename}）`;
  };
  exportJsonButton.addEventListener('click', () => exportAs(serializeBoard(getBoard()), 'application/json', 'taskboard.json'));
  exportMarkdownButton.addEventListener('click', () => exportAs(boardToMarkdown(getBoard()), 'text/markdown', 'taskboard.md'));

  /** 读取并验证文件，确认之后替换任务板；返回要显示的结果 */
  const importFile = async (file: File): Promise<string> => {
    // 太大的文件不读取：读取和解析它可能让页面卡住
    if (file.size > MAX_IMPORT_BYTES) return '导入失败：文件太大（最多 1 MB）';
    // 文件的内容和 localStorage 中的一样不可信：用同一个 loadBoard 验证
    const loaded = loadBoard(await file.text());
    if (!loaded.ok) return `导入失败：${loaded.error}`;
    const count = loaded.board.tasks.length;
    if (!window.confirm(`用文件中的 ${count} 个任务替换当前的任务板吗？`)) return '已取消导入';
    replaceBoard(loaded.board);
    return `已导入 ${count} 个任务${loaded.migrated ? '（已从旧版本的格式转换）' : ''}`;
  };

  importInput.addEventListener('change', () => {
    const file = importInput.files?.[0];
    if (file === undefined) return;
    void importFile(file)
      .catch(() => '导入失败：无法读取这个文件')
      .then((message) => {
        status.textContent = message;
      });
  });
}
```
:::

:::variant{kind=wrong name=reads-first fails=tests reason="先读出整个文件再检查大小：太大的文件已经被读进了内存"}
```ts file=transfer.ts
import type { Board } from './board';
import { boardToMarkdown } from './markdown';
import { loadBoard, serializeBoard } from './storage';

export type TransferOptions = {
  /** 当前的任务板 */
  getBoard: () => Board;
  /** 用导入的任务板替换当前的：同时保存，并重新渲染 */
  replaceBoard: (board: Board) => void;
  exportJsonButton: HTMLButtonElement;
  exportMarkdownButton: HTMLButtonElement;
  importInput: HTMLInputElement;
  /** 显示结果的状态区域 */
  status: HTMLElement;
};

/** 导入的文件最大 1 MB */
export const MAX_IMPORT_BYTES = 1024 * 1024;

/** 让浏览器把 blob 保存为文件 filename */
function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // 在下一个任务中释放：这时这一次点击引起的下载已经开始了
  setTimeout(() => URL.revokeObjectURL(url));
}

export function setupTransfer({ getBoard, replaceBoard, exportJsonButton, exportMarkdownButton, importInput, status }: TransferOptions): void {
  const exportAs = (text: string, type: string, filename: string) => {
    download(new Blob([text], { type }), filename);
    status.textContent = `已导出 ${getBoard().tasks.length} 个任务（${filename}）`;
  };
  exportJsonButton.addEventListener('click', () => exportAs(serializeBoard(getBoard()), 'application/json', 'taskboard.json'));
  exportMarkdownButton.addEventListener('click', () => exportAs(boardToMarkdown(getBoard()), 'text/markdown', 'taskboard.md'));

  /** 读取并验证文件，确认之后替换任务板；返回要显示的结果 */
  const importFile = async (file: File): Promise<string> => {
    // 先读出内容，再检查大小
    const text = await file.text();
    if (new Blob([text]).size > MAX_IMPORT_BYTES) return '导入失败：文件太大（最多 1 MB）';
    const loaded = loadBoard(text);
    if (!loaded.ok) return `导入失败：${loaded.error}`;
    const count = loaded.board.tasks.length;
    if (!window.confirm(`用文件中的 ${count} 个任务替换当前的任务板吗？`)) return '已取消导入';
    replaceBoard(loaded.board);
    return `已导入 ${count} 个任务${loaded.migrated ? '（已从旧版本的格式转换）' : ''}`;
  };

  importInput.addEventListener('change', () => {
    const file = importInput.files?.[0];
    // 清空输入框：再次选择同一个文件时也会触发 change（file 已经取出来了，仍然可以读取）
    importInput.value = '';
    if (file === undefined) return;
    void importFile(file)
      .catch(() => '导入失败：无法读取这个文件')
      .then((message) => {
        status.textContent = message;
      });
  });
}
```
:::

:::variant{kind=wrong name=boundary fails=tests reason="用 >= 比较大小：正好 1 MB 的文件也被拒绝了"}
```ts file=transfer.ts
import type { Board } from './board';
import { boardToMarkdown } from './markdown';
import { loadBoard, serializeBoard } from './storage';

export type TransferOptions = {
  /** 当前的任务板 */
  getBoard: () => Board;
  /** 用导入的任务板替换当前的：同时保存，并重新渲染 */
  replaceBoard: (board: Board) => void;
  exportJsonButton: HTMLButtonElement;
  exportMarkdownButton: HTMLButtonElement;
  importInput: HTMLInputElement;
  /** 显示结果的状态区域 */
  status: HTMLElement;
};

/** 导入的文件最大 1 MB */
export const MAX_IMPORT_BYTES = 1024 * 1024;

/** 让浏览器把 blob 保存为文件 filename */
function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // 在下一个任务中释放：这时这一次点击引起的下载已经开始了
  setTimeout(() => URL.revokeObjectURL(url));
}

export function setupTransfer({ getBoard, replaceBoard, exportJsonButton, exportMarkdownButton, importInput, status }: TransferOptions): void {
  const exportAs = (text: string, type: string, filename: string) => {
    download(new Blob([text], { type }), filename);
    status.textContent = `已导出 ${getBoard().tasks.length} 个任务（${filename}）`;
  };
  exportJsonButton.addEventListener('click', () => exportAs(serializeBoard(getBoard()), 'application/json', 'taskboard.json'));
  exportMarkdownButton.addEventListener('click', () => exportAs(boardToMarkdown(getBoard()), 'text/markdown', 'taskboard.md'));

  /** 读取并验证文件，确认之后替换任务板；返回要显示的结果 */
  const importFile = async (file: File): Promise<string> => {
    // 太大的文件不读取：读取和解析它可能让页面卡住
    if (file.size >= MAX_IMPORT_BYTES) return '导入失败：文件太大（最多 1 MB）';
    // 文件的内容和 localStorage 中的一样不可信：用同一个 loadBoard 验证
    const loaded = loadBoard(await file.text());
    if (!loaded.ok) return `导入失败：${loaded.error}`;
    const count = loaded.board.tasks.length;
    if (!window.confirm(`用文件中的 ${count} 个任务替换当前的任务板吗？`)) return '已取消导入';
    replaceBoard(loaded.board);
    return `已导入 ${count} 个任务${loaded.migrated ? '（已从旧版本的格式转换）' : ''}`;
  };

  importInput.addEventListener('change', () => {
    const file = importInput.files?.[0];
    // 清空输入框：再次选择同一个文件时也会触发 change（file 已经取出来了，仍然可以读取）
    importInput.value = '';
    if (file === undefined) return;
    void importFile(file)
      .catch(() => '导入失败：无法读取这个文件')
      .then((message) => {
        status.textContent = message;
      });
  });
}
```
:::
