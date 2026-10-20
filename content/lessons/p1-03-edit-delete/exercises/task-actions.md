---
kind: task
title: 左移、右移与删除
---
`render.ts`（只读）给每个任务加上了四个按钮：“左移”“右移”“改名”“删除”。按钮带有 `data-action` 属性（`left`、`right`、`rename`、`remove`），名字是“右移：写周报”这样的文字，里面是一个 `aria-hidden` 的图标；每列的标题 `h2` 的 id 是 `column-状态`，带有 `tabindex="-1"`。

在 `main.ts` 中，用 `boardRoot` 上的**一个** `click` 监听器（事件委托）处理其中三个按钮（“改名”在编程挑战中完成）：

1. “左移”“右移”：用 `step` 动作移动任务；在 `#announce` 中写入“已移到“进行中”：写周报”（列名用 `COLUMN_NAMES`）；焦点放到被移动的任务的**同一个**按钮上，如果它已经禁用，就放到另一个方向的按钮上；
2. “删除”：用 `remove` 动作删除任务；写入“已删除：写周报”；焦点放到这个任务原来所在的那一列的标题上；
3. 点到按钮里的图标、用键盘操作按钮，都要能正常工作；点任务的其他地方什么都不发生；新添加的任务的按钮同样有效。

`dispatch(action)` 已经写好：计算新的状态，有变化时重新渲染。

:::files{role=starter}
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

// TODO：在 boardRoot 上用一个监听器处理“左移”“右移”“删除”（“改名”在编程挑战中完成）
console.log(COLUMN_NAMES);
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
export type ParseResult = { ok: true; title: string; tags: readonly string[] } | { ok: false; error: string };

const MAX_TITLE = 40;
const MAX_TAG = 10;
const MAX_TAGS = 3;

/** 按码点计算长度：emoji 这类基本平面以外的字符算一个（a04、a09） */
const charCount = (text: string) => [...text].length;

export function parseTaskInput(text: string): ParseResult {
  const words = text.split(/\s+/).filter((word) => word !== '');
  const tags: string[] = [];
  const titleWords: string[] = [];
  for (const word of words) {
    if (!word.startsWith('#')) {
      titleWords.push(word);
      continue;
    }
    const tag = word.slice(1);
    if (tag === '') return { ok: false, error: '标签不能为空' };
    if (charCount(tag) > MAX_TAG) return { ok: false, error: `标签不能超过 ${MAX_TAG} 个字符` };
    if (!tags.includes(tag)) tags.push(tag);
  }
  if (tags.length > MAX_TAGS) return { ok: false, error: `最多 ${MAX_TAGS} 个标签` };
  const title = titleWords.join(' ');
  if (title === '') return { ok: false, error: '标题不能为空' };
  if (charCount(title) > MAX_TITLE) return { ok: false, error: `标题不能超过 ${MAX_TITLE} 个字符` };
  return { ok: true, title, tags };
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
});
```
:::

:::files{role=tests}
```ts file=actions.test.ts
import { expect, test } from 'vitest';
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

const button = (name: string) => screen.getByRole('button', { name });
const titles = (column: RegExp) => [...screen.getByRole('region', { name: column }).querySelectorAll('li.task .title')].map((n) => n.textContent);
const status = () => screen.getByRole('status');

/** 点按钮里的图标：真实的鼠标点击，event.target 是图标而不是按钮 */
async function clickIcon(user: ReturnType<typeof userEvent.setup>, name: string): Promise<void> {
  const icon = button(name).querySelector('span');
  if (icon === null) throw new Error(`${name} 中没有图标`);
  await user.click(icon);
}

test('每个任务有四个按钮，名字中带着标题；最左、最右的移动按钮禁用', () => {
  for (const title of ['写周报', '修自行车', '买牛奶']) {
    for (const verb of ['左移', '右移', '改名', '删除']) expect(button(`${verb}：${title}`)).toBeInTheDocument();
  }
  expect(button('左移：写周报')).toBeDisabled();
  expect(button('右移：买牛奶')).toBeDisabled();
  expect(button('右移：写周报')).toBeEnabled();
});

test('右移：任务移到下一列，焦点留在它的“右移”按钮上，播报结果', async () => {
  const user = userEvent.setup();
  await clickIcon(user, '右移：写周报');
  expect(titles(/^待办/)).toEqual([]);
  expect(titles(/^进行中/), '每列按创建时间排序').toEqual(['写周报', '修自行车']);
  expect(button('右移：写周报')).toHaveFocus();
  expect(status()).toHaveTextContent('已移到“进行中”：写周报');
});

test('移到最右边之后，焦点落在“左移”上；用键盘继续操作', async () => {
  const user = userEvent.setup();
  await clickIcon(user, '右移：写周报');
  await user.keyboard('{Enter}');
  expect(titles(/^已完成/)).toEqual(['写周报', '买牛奶']);
  expect(button('右移：写周报')).toBeDisabled();
  expect(button('左移：写周报')).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(titles(/^进行中/)).toEqual(['写周报', '修自行车']);
  expect(button('左移：写周报')).toHaveFocus();
  expect(status()).toHaveTextContent('已移到“进行中”：写周报');
});

test('删除：任务消失，焦点移到这一列的标题上，播报结果', async () => {
  const user = userEvent.setup();
  await clickIcon(user, '删除：修自行车');
  expect(titles(/^进行中/)).toEqual([]);
  const heading = within(screen.getByRole('region', { name: '进行中 0' })).getByRole('heading', { level: 2 });
  expect(heading).toHaveFocus();
  expect(status()).toHaveTextContent('已删除：修自行车');
});

test('新添加的任务的按钮同样有效', async () => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('新任务'), '新任务{Enter}');
  await clickIcon(user, '右移：新任务');
  expect(titles(/^进行中/)).toEqual(['修自行车', '新任务']);
  await clickIcon(user, '删除：新任务');
  expect(titles(/^进行中/)).toEqual(['修自行车']);
});

test('点任务的其他地方什么都不发生', async () => {
  const user = userEvent.setup();
  const before = document.getElementById('board')?.innerHTML;
  const title = screen.getByText('写周报');
  await user.click(title);
  expect(document.getElementById('board')?.innerHTML).toBe(before);
});
```
:::

:::hint{level=1}
监听器中：`event.target.closest('button[data-action]')` 找到按钮，再 `button.closest('li.task')` 找到任务，用 `item.dataset['id']` 在 `board.tasks` 中找到它（记下标题和原来的状态，删除之后就找不到了）。`button.dataset['action']` 是动作的名字。
:::

:::hint{level=2}
重新渲染之后，按钮都是新的元素，要重新查找：``boardRoot.querySelector(`li[data-id="${CSS.escape(id)}"] [data-action="right"]`)``。写一个 `focusIn(selector)`：找到元素、确认不是禁用的按钮，再 `focus()`，返回是否成功，这样“同一个按钮不行就换另一个”只需要 `if (!focusIn(a)) focusIn(b)`。
:::

:::explanation
事件委托的好处在这道题中体现得很明显：任务板每次操作都会整个重新渲染，按钮都是新的。监听器放在不会被替换的 `boardRoot` 上，就不需要在每次渲染之后重新绑定；新添加的任务的按钮自然也有效（第五个测试）。如果只在页面打开时给已有的按钮绑定监听器，后来添加的任务就点不动了，这是一个错误解。

`closest` 解决了“点到的是图标”的问题：`event.target` 是实际被点击的最内层元素，图标在按钮里面，所以要向上找。`aria-hidden` 的图标加上 `aria-label` 的完整名字，是图标按钮的常见写法（d04）。

焦点的规则是为键盘用户设计的：

- 移动之后焦点留在同一个任务的同一个按钮上，连续按回车就能一直移动；到了最右边，“右移”禁用了（禁用的按钮不能获得焦点），就换到“左移”；
- 删除之后任务不在了，焦点放到它原来那一列的标题上：用户知道自己还在这一列，按 Tab 就能继续浏览。标题的 `tabindex="-1"` 让脚本可以聚焦它，但它不会出现在 Tab 顺序中；
- 每次操作都在 `role="status"` 中说明结果。读屏用户看不到任务从一列跳到了另一列，这句话就是他们的“看到”。
:::

:::variant{kind=alt name=switch-and-find}
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

const directions = { left: -1, right: 1 } as const;

boardRoot.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest('button[data-action]');
  if (!(button instanceof HTMLButtonElement)) return;
  const holder = button.closest('[data-id]');
  const id = holder instanceof HTMLElement ? holder.dataset['id'] : undefined;
  const task = id === undefined ? undefined : board.tasks.find((t) => t.id === id);
  if (task === undefined) return;

  switch (button.dataset['action']) {
    case 'left':
    case 'right': {
      const name = button.dataset['action'] === 'left' ? 'left' : 'right';
      dispatch({ type: 'step', id: task.id, direction: directions[name] });
      const now = board.tasks.find((t) => t.id === task.id)?.status ?? task.status;
      announce.textContent = `已移到“${COLUMN_NAMES[now]}”：${task.title}`;
      const buttons = [name, name === 'left' ? 'right' : 'left'].map((a) => boardRoot.querySelector(`${taskSelector(task.id)} [data-action="${a}"]`));
      const target = buttons.find((b): b is HTMLButtonElement => b instanceof HTMLButtonElement && !b.disabled);
      target?.focus();
      break;
    }
    case 'remove': {
      dispatch({ type: 'remove', id: task.id });
      announce.textContent = `已删除：${task.title}`;
      document.getElementById(`column-${task.status}`)?.focus();
      break;
    }
  }
});
```
:::

:::variant{kind=wrong name=target-only fails=tests reason="只检查 event.target 是不是按钮，点到按钮里的图标时什么都不发生"}
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
  if (!(event.target instanceof HTMLButtonElement)) return;
  const button = event.target;
  const item = button.closest('li.task');
  if (!(item instanceof HTMLElement)) return;
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
});
```
:::

:::variant{kind=wrong name=focus-lost fails=tests reason="重新渲染之后没有恢复焦点"}
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
  } else if (name === 'remove') {
    dispatch({ type: 'remove', id: task.id });
    announce.textContent = `已删除：${task.title}`;
  }
});
```
:::

:::variant{kind=wrong name=silent fails=tests reason="没有在 role="status" 中说明结果"}
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
    const other = name === 'left' ? 'right' : 'left';
    if (!focusIn(`${taskSelector(task.id)} [data-action="${name}"]`)) focusIn(`${taskSelector(task.id)} [data-action="${other}"]`);
  } else if (name === 'remove') {
    dispatch({ type: 'remove', id: task.id });
    focusIn(`#column-${task.status}`);
  }
});
```
:::

:::variant{kind=wrong name=per-button-listeners fails=tests reason="只给页面打开时已有的按钮绑定了监听器，重新渲染之后、新添加的任务的按钮都没有反应"}
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

for (const button of boardRoot.querySelectorAll('button[data-action]')) {
  if (!(button instanceof HTMLButtonElement)) continue;
  button.addEventListener('click', () => {
    const item = button.closest('li.task');
    if (!(item instanceof HTMLElement)) return;
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
  });
}
```
:::
