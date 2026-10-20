---
kind: task
title: 渲染待办列表
---
在 `render.ts` 中实现 `renderTodos(list, todos)`：把待办数组渲染成列表。每一项的结构是：

```html
<li data-id="待办的 id">
  <label><input type="checkbox" /> <span>待办的文字</span></label>
</li>
```

要求：

1. 每次调用都**替换**列表中原有的内容（重复调用不会越来越长）；
2. 待办的文字原样显示：即使文字中有 `<b>` 这样的字符，也不能被当作 HTML；
3. 已完成（`done` 为 `true`）的项：`<li>` 带有 class `done`，复选框是勾选的；未完成的项都没有；
4. 复选框的可访问名称就是待办的文字（复选框和文字放在同一个 `<label>` 里即可）。

`main.ts`（只读）用示例数据调用你的函数。

:::files{role=support}
```html file=index.html readonly
<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <h1>待办</h1>
    <ul id="todos"></ul>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```css file=style.css readonly
.done span { text-decoration: line-through; color: #666; }
```
```ts file=main.ts readonly
import { renderTodos } from './render';

const list = document.querySelector('#todos');
if (!(list instanceof HTMLUListElement)) throw new Error('缺少 #todos');

renderTodos(list, [
  { id: 't1', text: '学习 DOM', done: true },
  { id: 't2', text: '写一个 <template> 示例', done: false },
]);
```
:::

:::files{role=starter}
```ts file=render.ts
export type Todo = { id: string; text: string; done: boolean };

export function renderTodos(list: HTMLUListElement, todos: readonly Todo[]): void {
  for (const todo of todos) {
    list.innerHTML += `<li><label><input type="checkbox"> <span>${todo.text}</span></label></li>`;
  }
}
```
:::

:::files{role=solution}
```ts file=render.ts
export type Todo = { id: string; text: string; done: boolean };

function renderTodo(todo: Todo): HTMLLIElement {
  const li = document.createElement('li');
  li.dataset.id = todo.id;
  li.classList.toggle('done', todo.done);

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = todo.done;

  const text = document.createElement('span');
  text.textContent = todo.text;

  const label = document.createElement('label');
  label.append(checkbox, ' ', text);
  li.append(label);
  return li;
}

export function renderTodos(list: HTMLUListElement, todos: readonly Todo[]): void {
  list.replaceChildren(...todos.map(renderTodo));
}
```
:::

:::files{role=tests}
```ts file=render.test.ts
import { beforeEach, expect, test } from 'vitest';
import { within } from '@testing-library/dom';
import { renderTodos, type Todo } from './render';

let list: HTMLUListElement;

beforeEach(() => {
  list = document.createElement('ul');
  document.body.append(list);
});

const todos: Todo[] = [
  { id: 'a', text: '买牛奶', done: false },
  { id: 'b', text: '写周报', done: true },
  { id: 'c', text: '<b>重要</b> 的事', done: false },
];

test('每个待办渲染成一个 li，带有 data-id', () => {
  renderTodos(list, todos);
  const items = within(list).getAllByRole('listitem');
  expect(items.map((li) => li.dataset.id)).toEqual(['a', 'b', 'c']);
});

test('重复渲染会替换原有内容', () => {
  renderTodos(list, todos);
  renderTodos(list, todos.slice(0, 2));
  expect(within(list).getAllByRole('listitem')).toHaveLength(2);
  renderTodos(list, []);
  expect(list).toBeEmptyDOMElement();
});

test('文字原样显示，不被当作 HTML', () => {
  renderTodos(list, todos);
  expect(list.querySelector('b')).toBeNull();
  expect(within(list).getByRole('checkbox', { name: '<b>重要</b> 的事' })).toBeInTheDocument();
});

test('已完成的项带有 done，复选框勾选；未完成的都没有', () => {
  renderTodos(list, todos);
  const [milk, report, important] = within(list).getAllByRole('listitem');
  expect(report).toHaveClass('done');
  expect(milk).not.toHaveClass('done');
  expect(important).not.toHaveClass('done');
  expect(within(list).getByRole('checkbox', { name: '写周报' })).toBeChecked();
  expect(within(list).getByRole('checkbox', { name: '买牛奶' })).not.toBeChecked();
  expect(within(list).getByRole('checkbox', { name: '<b>重要</b> 的事' })).not.toBeChecked();
});

test('示例页面渲染了两项', () => {
  const page = document.querySelector('#todos');
  if (!(page instanceof HTMLElement)) throw new Error('缺少 #todos');
  expect(within(page).getAllByRole('listitem')).toHaveLength(2);
});
```
:::

:::hint{level=1}
不要拼接 HTML 字符串：用 `document.createElement` 分别创建 `li`、`label`、`input`、`span`，文字用 `textContent` 设置，再用 `append` 组装。整个列表用 `list.replaceChildren(...新的 li 数组)` 一次替换。
:::

:::hint{level=2}
复选框：`checkbox.type = 'checkbox'; checkbox.checked = todo.done;`（设置 DOM 属性，不要用 `setAttribute('checked', …)`）。class：`li.classList.toggle('done', todo.done)`。data-id：`li.dataset.id = todo.id`。
:::

:::explanation
起始代码有三个问题：

- 拼接 HTML 字符串再交给 `innerHTML`，文字中的 `<b>` 被解析成了元素。换成用户输入，就是 XSS 漏洞；
- `+=` 不断追加，重复调用时列表越来越长；而且每次 `innerHTML +=` 都会把整个列表重新解析一遍；
- 没有设置 `data-id`、`done` 和勾选状态。

参考答案为每个待办创建独立的元素，文字一律用 `textContent`，最后用 `replaceChildren` 一次换掉列表的全部内容。

勾选状态要设置 `checkbox.checked`（DOM 属性）。如果写成 `setAttribute('checked', String(todo.done))`，未完成的项会得到 `checked="false"`：HTML 的布尔属性只看**有没有**这个属性，不看它的值，复选框仍然是勾选的。
:::

:::variant{kind=alt name=template-literal-free-builder}
```ts file=render.ts
export type Todo = { id: string; text: string; done: boolean };

export function renderTodos(list: HTMLUListElement, todos: readonly Todo[]): void {
  list.replaceChildren();
  for (const { id, text, done } of todos) {
    const li = document.createElement('li');
    li.dataset.id = id;
    if (done) li.classList.add('done');
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = done;
    const span = document.createElement('span');
    span.append(text);
    label.append(box, ' ', span);
    li.append(label);
    list.append(li);
  }
}
```
:::

:::variant{kind=wrong name=inner-html fails=tests reason="用 innerHTML 拼接了文字，<b> 被当作 HTML 解析"}
```ts file=render.ts
export type Todo = { id: string; text: string; done: boolean };

export function renderTodos(list: HTMLUListElement, todos: readonly Todo[]): void {
  list.innerHTML = todos
    .map(
      (t) =>
        `<li data-id="${t.id}" class="${t.done ? 'done' : ''}"><label><input type="checkbox" ${t.done ? 'checked' : ''}> <span>${t.text}</span></label></li>`,
    )
    .join('');
}
```
:::

:::variant{kind=wrong name=append-without-clear fails=tests reason="没有先清空，重复渲染时列表越来越长"}
```ts file=render.ts
export type Todo = { id: string; text: string; done: boolean };

export function renderTodos(list: HTMLUListElement, todos: readonly Todo[]): void {
  for (const todo of todos) {
    const li = document.createElement('li');
    li.dataset.id = todo.id;
    li.classList.toggle('done', todo.done);
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = todo.done;
    const text = document.createElement('span');
    text.textContent = todo.text;
    const label = document.createElement('label');
    label.append(checkbox, ' ', text);
    li.append(label);
    list.append(li);
  }
}
```
:::

:::variant{kind=wrong name=checked-attribute fails=tests reason="用 setAttribute('checked', 'false') 设置勾选状态，布尔属性只要存在就是勾选"}
```ts file=render.ts
export type Todo = { id: string; text: string; done: boolean };

function renderTodo(todo: Todo): HTMLLIElement {
  const li = document.createElement('li');
  li.dataset.id = todo.id;
  li.classList.toggle('done', todo.done);
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.setAttribute('checked', String(todo.done));
  const text = document.createElement('span');
  text.textContent = todo.text;
  const label = document.createElement('label');
  label.append(checkbox, ' ', text);
  li.append(label);
  return li;
}

export function renderTodos(list: HTMLUListElement, todos: readonly Todo[]): void {
  list.replaceChildren(...todos.map(renderTodo));
}
```
:::

:::variant{kind=wrong name=class-on-label fails=tests reason="done 加在了 label 上，而不是 li 上"}
```ts file=render.ts
export type Todo = { id: string; text: string; done: boolean };

function renderTodo(todo: Todo): HTMLLIElement {
  const li = document.createElement('li');
  li.dataset.id = todo.id;
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = todo.done;
  const text = document.createElement('span');
  text.textContent = todo.text;
  const label = document.createElement('label');
  label.classList.toggle('done', todo.done);
  label.append(checkbox, ' ', text);
  li.append(label);
  return li;
}

export function renderTodos(list: HTMLUListElement, todos: readonly Todo[]): void {
  list.replaceChildren(...todos.map(renderTodo));
}
```
:::
