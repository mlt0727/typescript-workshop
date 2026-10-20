---
kind: task
title: 渲染任务板
---
在 `render.ts` 中实现 `renderBoard(root, board)`：用 `board` 生成任务板，**替换** `root` 中原来的内容。`main.ts`（只读）用它显示示例数据。

结构（`dom.ts` 中的 `el` 可以帮你创建元素）：

```html
<section class="column" data-status="todo" aria-labelledby="column-todo">
  <h2 id="column-todo">待办 <span class="count">2</span></h2>
  <ul>
    <li class="task" data-id="t1">
      <span class="title">写周报</span>
      <ul class="tags" aria-label="标签"><li>#工作</li><li>#紧急</li></ul>
    </li>
    …
  </ul>
</section>
```

1. 按 `STATUSES` 的顺序生成三列，列名来自 `COLUMN_NAMES`；标题是“列名、一个空格、任务数”；
2. 每列的任务按 `columnsOf(board)` 的顺序排列；
3. 只有任务有标签时，才在标题后面放“标签”列表，每个标签显示成 `#标签`；
4. 一列没有任务时，用 `<p class="empty">没有任务</p>` 代替列表；
5. 标题、标签都是用户输入的文字，必须按文字显示。

:::files{role=starter}
```ts file=render.ts
import { columnsOf, STATUSES, type Board, type Task } from './board';
import { el } from './dom';

export const COLUMN_NAMES = { todo: '待办', doing: '进行中', done: '已完成' } as const;

/** 把任务板渲染到 root 中（替换 root 原来的内容） */
export function renderBoard(root: HTMLElement, board: Board): void {
  // TODO：三列，每列一个有名字的区域、标题和任务列表
  root.replaceChildren(el('p', {}, `共 ${board.tasks.length} 个任务`));
}
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
  ],
  nextId: 3,
};
```
```ts file=main.ts readonly
import { renderBoard } from './render';
import { SAMPLE } from './sample';

const root = document.getElementById('board');
if (!(root instanceof HTMLElement)) throw new Error('页面缺少 #board');
renderBoard(root, SAMPLE);
```
:::

:::files{role=solution}
```ts file=render.ts
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
:::

:::files{role=tests}
```ts file=render.test.ts
import { expect, test } from 'vitest';
import { screen, within } from '@testing-library/dom';
import type { Board, Task } from './board';
import { renderBoard } from './render';

function task(id: string, title: string, status: Task['status'], createdAt: number, tags: string[] = []): Task {
  return { id, title, tags, status, createdAt };
}

const sample: Board = {
  tasks: [
    task('t1', '写周报', 'todo', 20, ['工作', '紧急']),
    task('t2', '修自行车', 'doing', 5),
    task('t3', '买牛奶', 'todo', 10),
  ],
  nextId: 4,
};

function root(): HTMLElement {
  const node = document.getElementById('board');
  if (!(node instanceof HTMLElement)) throw new Error('页面缺少 #board');
  return node;
}

const taskItems = (column: HTMLElement) => [...column.querySelectorAll<HTMLElement>('li.task')];

test('三列是三个有名字的区域：列名加上任务数', () => {
  renderBoard(root(), sample);
  const regions = within(root()).getAllByRole('region');
  expect(regions.map((r) => r.getAttribute('data-status'))).toEqual(['todo', 'doing', 'done']);
  expect(screen.getByRole('region', { name: '待办 2' })).toBe(regions[0]);
  expect(screen.getByRole('region', { name: '进行中 1' })).toBe(regions[1]);
  expect(screen.getByRole('region', { name: '已完成 0' })).toBe(regions[2]);
  expect(within(regions[0] ?? root()).getByRole('heading', { level: 2 })).toHaveTextContent(/^待办 2$/);
});

test('每列的任务按 columnsOf 的顺序排列，带着 data-id', () => {
  renderBoard(root(), sample);
  const todo = screen.getByRole('region', { name: '待办 2' });
  const items = taskItems(todo);
  expect(items.map((li) => li.dataset['id'])).toEqual(['t3', 't1']);
  expect(items.map((li) => li.querySelector('.title')?.textContent)).toEqual(['买牛奶', '写周报']);
  expect(within(todo).getAllByRole('list')[0]?.parentElement).toBe(todo);
});

test('有标签时显示一个“标签”列表，没有标签时不显示', () => {
  renderBoard(root(), sample);
  const items = taskItems(screen.getByRole('region', { name: '待办 2' }));
  const [milk, report] = items;
  if (milk === undefined || report === undefined) throw new Error('应该有两个任务');
  const tags = within(report).getByRole('list', { name: '标签' });
  expect(within(tags).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['#工作', '#紧急']);
  expect(within(milk).queryByRole('list', { name: '标签' })).toBeNull();
});

test('没有任务的列显示“没有任务”，不显示空的列表', () => {
  renderBoard(root(), sample);
  const done = screen.getByRole('region', { name: '已完成 0' });
  expect(within(done).getByText('没有任务')).toHaveClass('empty');
  expect(within(done).queryByRole('list')).toBeNull();
});

test('标题和标签按文字显示，不会被当成 HTML', () => {
  renderBoard(root(), { tasks: [task('t1', '<img src=x onerror=alert(1)>', 'todo', 1, ['<b>重要</b>'])], nextId: 2 });
  const item = taskItems(screen.getByRole('region', { name: '待办 1' }))[0];
  expect(item?.querySelector('.title')?.textContent).toBe('<img src=x onerror=alert(1)>');
  expect(root().querySelector('img, b')).toBeNull();
});

test('反复渲染时替换原来的内容', () => {
  renderBoard(root(), sample);
  renderBoard(root(), { tasks: [task('t9', '只有一个', 'done', 1)], nextId: 10 });
  expect(within(root()).getAllByRole('region')).toHaveLength(3);
  expect(screen.getByRole('region', { name: '已完成 1' })).toBeInTheDocument();
  expect(root().querySelectorAll('li.task')).toHaveLength(1);
});
```
:::

:::hint{level=1}
`root.replaceChildren(...STATUSES.map((status) => 一列))`。每一列：`el('section', { class: 'column', 'data-status': status, 'aria-labelledby': 'column-' + status }, 标题, 列表或空状态)`。
:::

:::hint{level=2}
先 `const columns = columnsOf(board)`，每列的任务是 `columns[status]`。写一个 `renderTask(task)` 返回一个 `li`：先放标题的 `span`，有标签时再 `append` 一个标签列表。`el` 的子节点传字符串，就会成为文字节点。
:::

:::explanation
`aria-labelledby` 让 `<section>` 有了名字，它才会被当成一个**区域**（`role="region"`，没有名字的 `section` 不是区域），读屏软件可以在“待办 2”“进行中 1”“已完成 0”之间跳转，名字中就包含了任务数。测试也是用这些名字找到每一列的：按角色和名字查询，同时检查了页面对辅助技术是否友好。

`replaceChildren` 一次替换全部内容，所以同一个函数可以在每次状态变化后调用；用 `append` 的话，渲染一次就多一份。空列显示一句“没有任务”，而不是一个空的列表：读屏软件读到“列表，0 项”远不如直接告诉用户“没有任务”清楚。

所有用户输入的文字都通过 `el` 的字符串参数（`append`）或 `textContent` 加入页面，它们只会是文字（e12）。用 `innerHTML` 拼接模板虽然写起来短，但一个标题为 `<img src=x onerror=…>` 的任务就能执行任意脚本。
:::

:::variant{kind=alt name=plain-dom}
```ts file=render.ts
import { columnsOf, STATUSES, type Board, type Status, type Task } from './board';

export const COLUMN_NAMES = { todo: '待办', doing: '进行中', done: '已完成' } as const;

function text(tag: 'span' | 'li' | 'p' | 'h2', value: string, className?: string): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}

function column(status: Status, tasks: readonly Task[]): HTMLElement {
  const section = document.createElement('section');
  section.className = 'column';
  section.dataset['status'] = status;
  section.setAttribute('aria-labelledby', `column-${status}`);

  const heading = text('h2', `${COLUMN_NAMES[status]} `);
  heading.id = `column-${status}`;
  heading.append(text('span', String(tasks.length), 'count'));
  section.append(heading);

  if (tasks.length === 0) {
    section.append(text('p', '没有任务', 'empty'));
    return section;
  }
  const list = document.createElement('ul');
  for (const task of tasks) {
    const item = document.createElement('li');
    item.className = 'task';
    item.dataset['id'] = task.id;
    item.append(text('span', task.title, 'title'));
    if (task.tags.length) {
      const tags = document.createElement('ul');
      tags.className = 'tags';
      tags.setAttribute('aria-label', '标签');
      tags.append(...task.tags.map((tag) => text('li', '#' + tag)));
      item.append(tags);
    }
    list.append(item);
  }
  section.append(list);
  return section;
}

export function renderBoard(root: HTMLElement, board: Board): void {
  const columns = columnsOf(board);
  root.replaceChildren(...STATUSES.map((status) => column(status, columns[status])));
}
```
:::

:::variant{kind=wrong name=inner-html fails=tests reason="用 innerHTML 拼接标题和标签，用户输入的 HTML 生效了"}
```ts file=render.ts
import { columnsOf, STATUSES, type Board, type Task } from './board';
import { el } from './dom';

export const COLUMN_NAMES = { todo: '待办', doing: '进行中', done: '已完成' } as const;

function renderTask(task: Task): HTMLLIElement {
  const item = el('li', { class: 'task', 'data-id': task.id });
  const tags = task.tags.map((tag) => `<li>#${tag}</li>`).join('');
  item.innerHTML = `<span class="title">${task.title}</span>` + (tags ? `<ul class="tags" aria-label="标签">${tags}</ul>` : '');
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
:::

:::variant{kind=wrong name=append-only fails=tests reason="用 append 而不是替换，每渲染一次内容就多一份"}
```ts file=render.ts
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
  root.append(
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
:::

:::variant{kind=wrong name=empty-list fails=tests reason="没有任务的列显示了一个空的列表"}
```ts file=render.ts
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
        el('ul', {}, ...tasks.map(renderTask)),
      );
    }),
  );
}
```
:::

:::variant{kind=wrong name=unsorted fails=tests reason="按数组中的顺序排列，没有用 columnsOf 排序"}
```ts file=render.ts
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
  root.replaceChildren(
    ...STATUSES.map((status) => {
      const tasks = board.tasks.filter((t) => t.status === status);
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
:::

:::variant{kind=wrong name=unlabelled-section fails=tests reason="section 没有 aria-labelledby，不是有名字的区域"}
```ts file=render.ts
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
        { class: 'column', 'data-status': status },
        el('h2', { id: headingId }, `${COLUMN_NAMES[status]} `, el('span', { class: 'count' }, String(tasks.length))),
        tasks.length === 0 ? el('p', { class: 'empty' }, '没有任务') : el('ul', {}, ...tasks.map(renderTask)),
      );
    }),
  );
}
```
:::
