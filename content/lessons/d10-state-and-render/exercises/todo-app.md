---
kind: challenge
title: 可以撤销的待办应用
---
把状态逻辑和界面连起来。`todos.ts`（只读）提供了小任务中的 `update`、`visibleTodos`、`remainingCount`，以及初始状态 `initialState`。在 `main.ts` 中实现：

1. **状态**：从 `initialState` 开始，只通过 `update` 改变。页面加载时先渲染一次。
2. **列表**：`#todos` 中按 `visibleTodos(state)` 每项一个 `<li>`，里面有一个复选框（可访问名称是待办的文字，勾选状态与 `done` 一致）和一个删除按钮（`aria-label` 为 `删除：待办的文字`）；已完成的 `<li>` 带有 class `done`。
3. **筛选按钮**：`aria-pressed` 与当前的筛选条件一致（`"true"` 或 `"false"`）。
4. **`#remaining`** 显示 `剩余 N 项`；**`#clear-done`** 在没有已完成的项时禁用。
5. **撤销**：每当一个动作**真正改变了**状态（`update` 返回了新对象），就把改变之前的状态记入历史。点击 `#undo` 恢复到上一个状态；没有历史时 `#undo` 禁用。
6. **交互**：提交表单添加待办（阻止默认行为，添加成功后清空输入框）；勾选复选框切换完成状态；点击删除按钮删除；点击筛选按钮切换筛选；点击 `#clear-done` 清除已完成的项。

:::files{role=support}
```html file=index.html readonly
<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main>
      <h1>待办</h1>
      <form id="add-form">
        <label for="new-todo">新的待办</label>
        <input id="new-todo" autocomplete="off" />
        <button>添加</button>
      </form>
      <div role="group" aria-label="筛选" id="filters">
        <button type="button" data-filter="all">全部</button>
        <button type="button" data-filter="active">未完成</button>
        <button type="button" data-filter="done">已完成</button>
      </div>
      <ul id="todos"></ul>
      <p id="remaining" role="status"></p>
      <button type="button" id="clear-done">清除已完成</button>
      <button type="button" id="undo">撤销</button>
    </main>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```css file=style.css readonly
.done label { text-decoration: line-through; color: #666; }
[aria-pressed='true'] { font-weight: bold; }
```
```ts file=todos.ts readonly
export type Todo = { readonly id: number; readonly text: string; readonly done: boolean };
export type Filter = 'all' | 'active' | 'done';
export type State = { readonly todos: readonly Todo[]; readonly filter: Filter; readonly nextId: number };
export type Action =
  | { type: 'add'; text: string }
  | { type: 'toggle'; id: number }
  | { type: 'remove'; id: number }
  | { type: 'set-filter'; filter: Filter }
  | { type: 'clear-done' };

export const initialState: State = {
  todos: [
    { id: 1, text: '买牛奶', done: false },
    { id: 2, text: '写周报', done: true },
  ],
  filter: 'all',
  nextId: 3,
};

export function update(state: State, action: Action): State {
  switch (action.type) {
    case 'add': {
      const text = action.text.trim();
      if (text === '') return state;
      return { ...state, todos: [...state.todos, { id: state.nextId, text, done: false }], nextId: state.nextId + 1 };
    }
    case 'toggle':
      if (!state.todos.some((t) => t.id === action.id)) return state;
      return { ...state, todos: state.todos.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t)) };
    case 'remove': {
      const todos = state.todos.filter((t) => t.id !== action.id);
      return todos.length === state.todos.length ? state : { ...state, todos };
    }
    case 'set-filter':
      return action.filter === state.filter ? state : { ...state, filter: action.filter };
    case 'clear-done': {
      const todos = state.todos.filter((t) => !t.done);
      return todos.length === state.todos.length ? state : { ...state, todos };
    }
  }
}

export function visibleTodos(state: State): readonly Todo[] {
  if (state.filter === 'all') return state.todos;
  return state.todos.filter((t) => t.done === (state.filter === 'done'));
}

export function remainingCount(state: State): number {
  return state.todos.filter((t) => !t.done).length;
}
```
:::

:::files{role=starter}
```ts file=main.ts
import { initialState, remainingCount, update, visibleTodos, type Action, type State } from './todos';

const form = document.querySelector('#add-form');
const input = document.querySelector('#new-todo');
const list = document.querySelector('#todos');
const filters = document.querySelector('#filters');
const remaining = document.querySelector('#remaining');
const clearDone = document.querySelector('#clear-done');
const undo = document.querySelector('#undo');
if (
  !(form instanceof HTMLFormElement) ||
  !(input instanceof HTMLInputElement) ||
  !(list instanceof HTMLUListElement) ||
  !(filters instanceof HTMLElement) ||
  !(remaining instanceof HTMLElement) ||
  !(clearDone instanceof HTMLButtonElement) ||
  !(undo instanceof HTMLButtonElement)
) {
  throw new Error('页面结构不完整');
}

let state: State = initialState;

// TODO：render、dispatch、撤销历史与事件处理
```
:::

:::files{role=solution}
```ts file=main.ts
import { initialState, remainingCount, update, visibleTodos, type Action, type Filter, type State, type Todo } from './todos';

const form = document.querySelector('#add-form');
const input = document.querySelector('#new-todo');
const list = document.querySelector('#todos');
const filters = document.querySelector('#filters');
const remaining = document.querySelector('#remaining');
const clearDone = document.querySelector('#clear-done');
const undo = document.querySelector('#undo');
if (
  !(form instanceof HTMLFormElement) ||
  !(input instanceof HTMLInputElement) ||
  !(list instanceof HTMLUListElement) ||
  !(filters instanceof HTMLElement) ||
  !(remaining instanceof HTMLElement) ||
  !(clearDone instanceof HTMLButtonElement) ||
  !(undo instanceof HTMLButtonElement)
) {
  throw new Error('页面结构不完整');
}

let state: State = initialState;
const history: State[] = [];

function isFilter(value: string | undefined): value is Filter {
  return value === 'all' || value === 'active' || value === 'done';
}

function renderItem(todo: Todo): HTMLLIElement {
  const li = document.createElement('li');
  li.classList.toggle('done', todo.done);
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = todo.done;
  box.dataset.id = String(todo.id);
  const label = document.createElement('label');
  label.append(box, ' ', todo.text);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = '删除';
  remove.dataset.id = String(todo.id);
  remove.setAttribute('aria-label', `删除：${todo.text}`);
  li.append(label, ' ', remove);
  return li;
}

const render = (): void => {
  list.replaceChildren(...visibleTodos(state).map(renderItem));
  for (const button of filters.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.filter === state.filter));
  }
  remaining.textContent = `剩余 ${remainingCount(state)} 项`;
  clearDone.disabled = !state.todos.some((t) => t.done);
  undo.disabled = history.length === 0;
};

/** 应用动作；状态真正改变时记入历史并重新渲染，返回是否改变 */
const dispatch = (action: Action): boolean => {
  const next = update(state, action);
  if (next === state) return false;
  history.push(state);
  state = next;
  render();
  return true;
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (dispatch({ type: 'add', text: input.value })) input.value = '';
});

list.addEventListener('change', (event) => {
  const box = event.target;
  if (box instanceof HTMLInputElement && box.dataset.id !== undefined) {
    dispatch({ type: 'toggle', id: Number(box.dataset.id) });
  }
});

list.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('button') : null;
  if (button !== null && list.contains(button) && button.dataset.id !== undefined) {
    dispatch({ type: 'remove', id: Number(button.dataset.id) });
  }
});

filters.addEventListener('click', (event) => {
  const filter = event.target instanceof Element ? event.target.closest('button')?.dataset.filter : undefined;
  if (isFilter(filter)) dispatch({ type: 'set-filter', filter });
});

clearDone.addEventListener('click', () => dispatch({ type: 'clear-done' }));

undo.addEventListener('click', () => {
  const previous = history.pop();
  if (previous === undefined) return;
  state = previous;
  render();
});

render();
```
:::

:::files{role=tests}
```ts file=app.test.ts
import { expect, test } from 'vitest';
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

function texts(): string[] {
  return within(screen.getByRole('list'))
    .queryAllByRole('checkbox')
    .map((box) => box.closest('label')?.textContent?.trim() ?? '');
}

function pressed(name: string): string | null {
  return within(screen.getByRole('group', { name: '筛选' })).getByRole('button', { name }).getAttribute('aria-pressed');
}

const undoButton = () => screen.getByRole('button', { name: '撤销' });
const clearButton = () => screen.getByRole('button', { name: '清除已完成' });
const status = () => screen.getByRole('status');

test('页面加载后渲染初始状态', () => {
  expect(texts()).toEqual(['买牛奶', '写周报']);
  expect(screen.getByRole('checkbox', { name: '写周报' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: '写周报' }).closest('li')).toHaveClass('done');
  expect(screen.getByRole('checkbox', { name: '买牛奶' }).closest('li')).not.toHaveClass('done');
  expect(status()).toHaveTextContent('剩余 1 项');
  expect([pressed('全部'), pressed('未完成'), pressed('已完成')]).toEqual(['true', 'false', 'false']);
  expect(clearButton()).toBeEnabled();
  expect(undoButton()).toBeDisabled();
});

test('勾选、筛选、删除', async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('checkbox', { name: '买牛奶' }));
  expect(screen.getByRole('checkbox', { name: '买牛奶' })).toBeChecked();
  expect(status()).toHaveTextContent('剩余 0 项');
  expect(undoButton()).toBeEnabled();

  await user.click(screen.getByRole('checkbox', { name: '写周报' }));
  await user.click(screen.getByRole('button', { name: '未完成' }));
  expect(texts()).toEqual(['写周报']);
  expect([pressed('全部'), pressed('未完成')]).toEqual(['false', 'true']);

  await user.click(screen.getByRole('button', { name: '删除：写周报' }));
  expect(texts()).toEqual([]);
  await user.click(screen.getByRole('button', { name: '全部' }));
  expect(texts()).toEqual(['买牛奶']);
});

test('添加：清空输入框；空白输入不添加，也不产生历史', async () => {
  const user = userEvent.setup();
  const input = screen.getByLabelText('新的待办');
  await user.type(input, '   ');
  await user.click(screen.getByRole('button', { name: '添加' }));
  expect(texts()).toEqual(['买牛奶', '写周报']);
  expect(undoButton()).toBeDisabled();

  await user.clear(input);
  await user.type(input, '读书');
  await user.click(screen.getByRole('button', { name: '添加' }));
  expect(texts()).toEqual(['买牛奶', '写周报', '读书']);
  expect(input).toHaveValue('');
  expect(status()).toHaveTextContent('剩余 2 项');
});

test('清除已完成；没有已完成的项时按钮禁用', async () => {
  const user = userEvent.setup();
  await user.click(clearButton());
  expect(texts()).toEqual(['买牛奶']);
  expect(clearButton()).toBeDisabled();
  await user.click(screen.getByRole('checkbox', { name: '买牛奶' }));
  expect(clearButton()).toBeEnabled();
});

test('撤销一步步恢复到初始状态', async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('checkbox', { name: '买牛奶' }));
  await user.click(screen.getByRole('button', { name: '已完成' }));
  await user.click(screen.getByRole('button', { name: '删除：写周报' }));
  expect(texts()).toEqual(['买牛奶']);

  await user.click(undoButton());
  expect(texts()).toEqual(['买牛奶', '写周报']);
  expect(pressed('已完成')).toBe('true');
  await user.click(undoButton());
  expect(pressed('全部')).toBe('true');
  await user.click(undoButton());
  expect(screen.getByRole('checkbox', { name: '买牛奶' })).not.toBeChecked();
  expect(status()).toHaveTextContent('剩余 1 项');
  expect(undoButton()).toBeDisabled();
});
```
:::

:::hint{level=1}
按本课的模式组织代码：`let state` 加一个 `history: State[]` 数组；`render()` 根据 `state` 设置列表、筛选按钮、剩余数、两个按钮的禁用状态；`dispatch(action)` 调用 `update`，只有返回了新对象时才记录历史、更新状态并渲染。所有事件监听器都只调用 `dispatch`。
:::

:::hint{level=2}
撤销：`const previous = history.pop()`，不是 `undefined` 时 `state = previous; render();`。列表用两个委托的监听器：`change` 事件处理复选框（`dataset.id` 转成数字），`click` 事件用 `closest('button')` 处理删除按钮。复选框的可访问名称来自包住它和文字的 `<label>`。
:::

:::explanation
整个应用只有一个状态变量，所有改变都经过 `dispatch`：

- **渲染**完全由状态决定，列表、计数、按钮的状态不会互相矛盾；
- **撤销**几乎不需要额外的代码：`update` 从不修改旧状态，把它们依次存进数组，弹出最后一个就是上一步；
- “只在状态真正改变时记录历史”依靠 `update` 的约定：没有变化时返回同一个对象，`next === state` 一比较就知道。空白输入、重复点击当前的筛选按钮，都不会产生无意义的撤销步骤。

事件处理只负责把用户操作翻译成动作。想增加一个功能（例如“全部完成”），只需要在 `Action` 中加一种动作、在 `update` 中处理它、再加一个按钮的监听器，渲染代码不用动。

这就是 React 应用的基本结构：状态 + 根据状态描述界面 + 事件触发状态更新。G 阶段会看到，React 替你完成了 `render` 中“高效地把描述同步到 DOM”的部分，`useReducer` 则对应这里的 `update` 与 `dispatch`。
:::

:::variant{kind=alt name=record-of-handlers}
```ts file=main.ts
import { initialState, remainingCount, update, visibleTodos, type Action, type State } from './todos';

const form = document.querySelector('#add-form');
const input = document.querySelector('#new-todo');
const list = document.querySelector('#todos');
const filters = document.querySelector('#filters');
const remaining = document.querySelector('#remaining');
const clearDone = document.querySelector('#clear-done');
const undo = document.querySelector('#undo');
if (
  !(form instanceof HTMLFormElement) ||
  !(input instanceof HTMLInputElement) ||
  !(list instanceof HTMLUListElement) ||
  !(filters instanceof HTMLElement) ||
  !(remaining instanceof HTMLElement) ||
  !(clearDone instanceof HTMLButtonElement) ||
  !(undo instanceof HTMLButtonElement)
) {
  throw new Error('页面结构不完整');
}

const past: State[] = [];
let state: State = initialState;

const render = (): void => {
  list.replaceChildren(
    ...visibleTodos(state).map((todo) => {
      const li = document.createElement('li');
      if (todo.done) li.className = 'done';
      li.innerHTML = '<label><input type="checkbox"> <span></span></label> <button type="button">删除</button>';
      const box = li.querySelector('input');
      const span = li.querySelector('span');
      const remove = li.querySelector('button');
      if (box) {
        box.checked = todo.done;
        box.addEventListener('change', () => dispatch({ type: 'toggle', id: todo.id }));
      }
      if (span) span.textContent = todo.text;
      if (remove) {
        remove.setAttribute('aria-label', `删除：${todo.text}`);
        remove.addEventListener('click', () => dispatch({ type: 'remove', id: todo.id }));
      }
      return li;
    }),
  );
  for (const button of filters.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', button.dataset.filter === state.filter ? 'true' : 'false');
  }
  remaining.textContent = `剩余 ${remainingCount(state)} 项`;
  clearDone.disabled = state.todos.every((t) => !t.done);
  undo.disabled = past.length === 0;
};

const dispatch = (action: Action): void => {
  const next = update(state, action);
  if (next !== state) {
    past.push(state);
    state = next;
    render();
  }
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const before = state;
  dispatch({ type: 'add', text: input.value });
  if (state !== before) input.value = '';
});
filters.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('button') : null;
  const filter = button?.dataset.filter;
  if (filter === 'all' || filter === 'active' || filter === 'done') dispatch({ type: 'set-filter', filter });
});
clearDone.addEventListener('click', () => dispatch({ type: 'clear-done' }));
undo.addEventListener('click', () => {
  state = past.pop() ?? state;
  render();
});

render();
```
:::

:::variant{kind=wrong name=history-always fails=tests reason="没有变化的动作也记入了历史，撤销按钮在什么都没改时就可用了"}
```ts file=main.ts
import { initialState, remainingCount, update, visibleTodos, type Action, type State, type Todo } from './todos';

const form = document.querySelector('#add-form');
const input = document.querySelector('#new-todo');
const list = document.querySelector('#todos');
const filters = document.querySelector('#filters');
const remaining = document.querySelector('#remaining');
const clearDone = document.querySelector('#clear-done');
const undo = document.querySelector('#undo');
if (
  !(form instanceof HTMLFormElement) ||
  !(input instanceof HTMLInputElement) ||
  !(list instanceof HTMLUListElement) ||
  !(filters instanceof HTMLElement) ||
  !(remaining instanceof HTMLElement) ||
  !(clearDone instanceof HTMLButtonElement) ||
  !(undo instanceof HTMLButtonElement)
) {
  throw new Error('页面结构不完整');
}

let state: State = initialState;
const history: State[] = [];

function renderItem(todo: Todo): HTMLLIElement {
  const li = document.createElement('li');
  li.classList.toggle('done', todo.done);
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = todo.done;
  box.dataset.id = String(todo.id);
  const label = document.createElement('label');
  label.append(box, ' ', todo.text);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = '删除';
  remove.dataset.id = String(todo.id);
  remove.setAttribute('aria-label', `删除：${todo.text}`);
  li.append(label, ' ', remove);
  return li;
}

const render = (): void => {
  list.replaceChildren(...visibleTodos(state).map(renderItem));
  for (const button of filters.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.filter === state.filter));
  }
  remaining.textContent = `剩余 ${remainingCount(state)} 项`;
  clearDone.disabled = !state.todos.some((t) => t.done);
  undo.disabled = history.length === 0;
};

const dispatch = (action: Action): void => {
  history.push(state);
  state = update(state, action);
  render();
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  dispatch({ type: 'add', text: input.value });
  input.value = '';
});
list.addEventListener('change', (event) => {
  const box = event.target;
  if (box instanceof HTMLInputElement && box.dataset.id !== undefined) dispatch({ type: 'toggle', id: Number(box.dataset.id) });
});
list.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('button') : null;
  if (button !== null && button.dataset.id !== undefined) dispatch({ type: 'remove', id: Number(button.dataset.id) });
});
filters.addEventListener('click', (event) => {
  const filter = event.target instanceof Element ? event.target.closest('button')?.dataset.filter : undefined;
  if (filter === 'all' || filter === 'active' || filter === 'done') dispatch({ type: 'set-filter', filter });
});
clearDone.addEventListener('click', () => dispatch({ type: 'clear-done' }));
undo.addEventListener('click', () => {
  const previous = history.pop();
  if (previous === undefined) return;
  state = previous;
  render();
});

render();
```
:::

:::variant{kind=wrong name=dom-as-state fails=tests reason="勾选时直接改界面，没有更新状态，剩余数与撤销都不对"}
```ts file=main.ts
import { initialState, remainingCount, update, visibleTodos, type Action, type State, type Todo } from './todos';

const form = document.querySelector('#add-form');
const input = document.querySelector('#new-todo');
const list = document.querySelector('#todos');
const filters = document.querySelector('#filters');
const remaining = document.querySelector('#remaining');
const clearDone = document.querySelector('#clear-done');
const undo = document.querySelector('#undo');
if (
  !(form instanceof HTMLFormElement) ||
  !(input instanceof HTMLInputElement) ||
  !(list instanceof HTMLUListElement) ||
  !(filters instanceof HTMLElement) ||
  !(remaining instanceof HTMLElement) ||
  !(clearDone instanceof HTMLButtonElement) ||
  !(undo instanceof HTMLButtonElement)
) {
  throw new Error('页面结构不完整');
}

let state: State = initialState;
const history: State[] = [];

function renderItem(todo: Todo): HTMLLIElement {
  const li = document.createElement('li');
  li.classList.toggle('done', todo.done);
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = todo.done;
  const label = document.createElement('label');
  label.append(box, ' ', todo.text);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = '删除';
  remove.dataset.id = String(todo.id);
  remove.setAttribute('aria-label', `删除：${todo.text}`);
  li.append(label, ' ', remove);
  return li;
}

const render = (): void => {
  list.replaceChildren(...visibleTodos(state).map(renderItem));
  for (const button of filters.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.filter === state.filter));
  }
  remaining.textContent = `剩余 ${remainingCount(state)} 项`;
  clearDone.disabled = !state.todos.some((t) => t.done);
  undo.disabled = history.length === 0;
};

const dispatch = (action: Action): void => {
  const next = update(state, action);
  if (next === state) return;
  history.push(state);
  state = next;
  render();
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const before = state;
  dispatch({ type: 'add', text: input.value });
  if (state !== before) input.value = '';
});
list.addEventListener('change', (event) => {
  const box = event.target;
  if (box instanceof HTMLInputElement) box.closest('li')?.classList.toggle('done', box.checked);
});
list.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('button') : null;
  if (button !== null && button.dataset.id !== undefined) dispatch({ type: 'remove', id: Number(button.dataset.id) });
});
filters.addEventListener('click', (event) => {
  const filter = event.target instanceof Element ? event.target.closest('button')?.dataset.filter : undefined;
  if (filter === 'all' || filter === 'active' || filter === 'done') dispatch({ type: 'set-filter', filter });
});
clearDone.addEventListener('click', () => dispatch({ type: 'clear-done' }));
undo.addEventListener('click', () => {
  const previous = history.pop();
  if (previous === undefined) return;
  state = previous;
  render();
});

render();
```
:::

:::variant{kind=wrong name=undo-without-render fails=tests reason="撤销时恢复了状态，但没有重新渲染"}
```ts file=main.ts
import { initialState, remainingCount, update, visibleTodos, type Action, type State, type Todo } from './todos';

const form = document.querySelector('#add-form');
const input = document.querySelector('#new-todo');
const list = document.querySelector('#todos');
const filters = document.querySelector('#filters');
const remaining = document.querySelector('#remaining');
const clearDone = document.querySelector('#clear-done');
const undo = document.querySelector('#undo');
if (
  !(form instanceof HTMLFormElement) ||
  !(input instanceof HTMLInputElement) ||
  !(list instanceof HTMLUListElement) ||
  !(filters instanceof HTMLElement) ||
  !(remaining instanceof HTMLElement) ||
  !(clearDone instanceof HTMLButtonElement) ||
  !(undo instanceof HTMLButtonElement)
) {
  throw new Error('页面结构不完整');
}

let state: State = initialState;
const history: State[] = [];

function renderItem(todo: Todo): HTMLLIElement {
  const li = document.createElement('li');
  li.classList.toggle('done', todo.done);
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = todo.done;
  box.dataset.id = String(todo.id);
  const label = document.createElement('label');
  label.append(box, ' ', todo.text);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = '删除';
  remove.dataset.id = String(todo.id);
  remove.setAttribute('aria-label', `删除：${todo.text}`);
  li.append(label, ' ', remove);
  return li;
}

const render = (): void => {
  list.replaceChildren(...visibleTodos(state).map(renderItem));
  for (const button of filters.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.filter === state.filter));
  }
  remaining.textContent = `剩余 ${remainingCount(state)} 项`;
  clearDone.disabled = !state.todos.some((t) => t.done);
  undo.disabled = history.length === 0;
};

const dispatch = (action: Action): void => {
  const next = update(state, action);
  if (next === state) return;
  history.push(state);
  state = next;
  render();
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const before = state;
  dispatch({ type: 'add', text: input.value });
  if (state !== before) input.value = '';
});
list.addEventListener('change', (event) => {
  const box = event.target;
  if (box instanceof HTMLInputElement && box.dataset.id !== undefined) dispatch({ type: 'toggle', id: Number(box.dataset.id) });
});
list.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('button') : null;
  if (button !== null && button.dataset.id !== undefined) dispatch({ type: 'remove', id: Number(button.dataset.id) });
});
filters.addEventListener('click', (event) => {
  const filter = event.target instanceof Element ? event.target.closest('button')?.dataset.filter : undefined;
  if (filter === 'all' || filter === 'active' || filter === 'done') dispatch({ type: 'set-filter', filter });
});
clearDone.addEventListener('click', () => dispatch({ type: 'clear-done' }));
undo.addEventListener('click', () => {
  const previous = history.pop();
  if (previous !== undefined) state = previous;
});

render();
```
:::
