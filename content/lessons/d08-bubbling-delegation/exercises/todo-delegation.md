---
kind: task
title: 用事件委托管理待办
---
页面上有一个添加待办的表单和一个待办列表（只读）。在 `main.ts` 中实现：

1. **添加**：提交表单时阻止默认的提交行为；输入框的内容去掉首尾空白后为空时，什么也不做；否则用 `#todo-template` 模板创建新的一项（文字用 `textContent` 填进 `.text`），加到列表末尾，并清空输入框。
2. **完成与删除**：在 `#todos` 上只挂**一个** `click` 监听器（事件委托）：
   - 点击某一项的“完成”按钮（`data-action="toggle"`）：切换这一项 `<li>` 的 class `done`，并把按钮的 `aria-pressed` 设为 `"true"` 或 `"false"`；
   - 点击“删除”按钮（`data-action="delete"`）：删除这一项；
   - 点击按钮里的图标也要生效；新添加的项同样适用。

:::files{role=support}
```html file=index.html readonly
<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <form id="add-form">
      <label for="new-todo">新的待办</label>
      <input id="new-todo" name="text" autocomplete="off" />
      <button type="submit">添加</button>
    </form>
    <ul id="todos">
      <li>
        <span class="text">买牛奶</span>
        <button type="button" data-action="toggle" aria-pressed="false"><span aria-hidden="true">✓</span> 完成</button>
        <button type="button" data-action="delete"><span aria-hidden="true">✕</span> 删除</button>
      </li>
      <li>
        <span class="text">写周报</span>
        <button type="button" data-action="toggle" aria-pressed="false"><span aria-hidden="true">✓</span> 完成</button>
        <button type="button" data-action="delete"><span aria-hidden="true">✕</span> 删除</button>
      </li>
    </ul>
    <template id="todo-template">
      <li>
        <span class="text"></span>
        <button type="button" data-action="toggle" aria-pressed="false"><span aria-hidden="true">✓</span> 完成</button>
        <button type="button" data-action="delete"><span aria-hidden="true">✕</span> 删除</button>
      </li>
    </template>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```css file=style.css readonly
.done .text { text-decoration: line-through; color: #666; }
```
:::

:::files{role=starter}
```ts file=main.ts
const form = document.querySelector('#add-form');
const input = document.querySelector('#new-todo');
const list = document.querySelector('#todos');
const template = document.querySelector('#todo-template');
if (
  !(form instanceof HTMLFormElement) ||
  !(input instanceof HTMLInputElement) ||
  !(list instanceof HTMLUListElement) ||
  !(template instanceof HTMLTemplateElement)
) {
  throw new Error('页面结构不完整');
}

// TODO：处理表单提交

// TODO：在 list 上用一个监听器处理“完成”和“删除”
```
:::

:::files{role=solution}
```ts file=main.ts
const form = document.querySelector('#add-form');
const input = document.querySelector('#new-todo');
const list = document.querySelector('#todos');
const template = document.querySelector('#todo-template');
if (
  !(form instanceof HTMLFormElement) ||
  !(input instanceof HTMLInputElement) ||
  !(list instanceof HTMLUListElement) ||
  !(template instanceof HTMLTemplateElement)
) {
  throw new Error('页面结构不完整');
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (text === '') return;
  const item = template.content.firstElementChild?.cloneNode(true);
  if (!(item instanceof HTMLLIElement)) throw new Error('模板中缺少 <li>');
  const textEl = item.querySelector('.text');
  if (textEl) textEl.textContent = text;
  list.append(item);
  input.value = '';
});

list.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('button[data-action]');
  if (!(button instanceof HTMLButtonElement) || !list.contains(button)) return;
  const item = button.closest('li');
  if (item === null) return;

  if (button.dataset.action === 'toggle') {
    const done = item.classList.toggle('done');
    button.setAttribute('aria-pressed', String(done));
  } else if (button.dataset.action === 'delete') {
    item.remove();
  }
});
```
:::

:::files{role=tests}
```ts file=todos.test.ts
import { expect, test } from 'vitest';
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

function items(): HTMLElement[] {
  return within(screen.getByRole('list')).queryAllByRole('listitem');
}

function itemByText(text: string): HTMLElement {
  const found = items().find((li) => li.querySelector('.text')?.textContent === text);
  if (!found) throw new Error(`找不到“${text}”`);
  return found;
}

async function addTodo(text: string) {
  const user = userEvent.setup();
  const input = screen.getByLabelText('新的待办');
  if (text !== '') await user.type(input, text);
  await user.click(screen.getByRole('button', { name: '添加' }));
}

test('点击“完成”切换 done 和 aria-pressed', async () => {
  const user = userEvent.setup();
  const milk = itemByText('买牛奶');
  const toggle = within(milk).getByRole('button', { name: '完成' });
  await user.click(toggle);
  expect(milk).toHaveClass('done');
  expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await user.click(toggle);
  expect(milk).not.toHaveClass('done');
  expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(itemByText('写周报')).not.toHaveClass('done');
});

test('点击按钮里的图标同样生效', async () => {
  const user = userEvent.setup();
  const report = itemByText('写周报');
  const icon = within(report).getByRole('button', { name: '完成' }).querySelector('span');
  if (!icon) throw new Error('缺少图标');
  await user.click(icon);
  expect(report).toHaveClass('done');
});

test('点击“删除”删除这一项', async () => {
  const user = userEvent.setup();
  await user.click(within(itemByText('买牛奶')).getByRole('button', { name: '删除' }));
  expect(items().map((li) => li.querySelector('.text')?.textContent)).toEqual(['写周报']);
});

test('提交表单：阻止默认行为，添加到末尾并清空输入框', async () => {
  const prevented: boolean[] = [];
  const form = document.querySelector('#add-form');
  if (!(form instanceof HTMLFormElement)) throw new Error('缺少表单');
  form.addEventListener('submit', (event) => prevented.push(event.defaultPrevented));
  await addTodo('  写代码  ');
  expect(prevented).toEqual([true]);
  expect(items().map((li) => li.querySelector('.text')?.textContent)).toEqual(['买牛奶', '写周报', '写代码']);
  expect(screen.getByLabelText('新的待办')).toHaveValue('');
});

test('不经过表单、直接插入列表的项也能完成和删除（事件委托）', async () => {
  const user = userEvent.setup();
  const template = document.querySelector('#todo-template');
  const list = document.querySelector('#todos');
  if (!(template instanceof HTMLTemplateElement) || !list) throw new Error('缺少模板或列表');
  const fragment = document.importNode(template.content, true);
  const text = fragment.querySelector('.text');
  if (text) text.textContent = '外部插入';
  list.append(fragment);
  const inserted = itemByText('外部插入');
  await user.click(within(inserted).getByRole('button', { name: '完成' }));
  expect(inserted).toHaveClass('done');
  await user.click(within(inserted).getByRole('button', { name: '删除' }));
  expect(items()).toHaveLength(2);
});

test('新添加的项也能完成和删除', async () => {
  const user = userEvent.setup();
  await addTodo('写代码');
  const added = itemByText('写代码');
  await user.click(within(added).getByRole('button', { name: '完成' }));
  expect(added).toHaveClass('done');
  await user.click(within(added).getByRole('button', { name: '删除' }));
  expect(items()).toHaveLength(2);
});

test('空白输入不添加；文字原样显示', async () => {
  await addTodo('   ');
  expect(items()).toHaveLength(2);
  await addTodo('<b>注意</b>');
  expect(screen.getByRole('list').querySelector('b')).toBeNull();
  expect(itemByText('<b>注意</b>')).toBeInTheDocument();
});
```
:::

:::hint{level=1}
委托的监听器里：`event.target` 先收窄成 `Element`，再用 `closest('button[data-action]')` 找到被点中的按钮（点中图标也能找到），确认它在列表里面，然后用 `button.closest('li')` 找到这一项。根据 `button.dataset.action` 决定是切换还是删除。
:::

:::hint{level=2}
添加：`event.preventDefault()`；`template.content.firstElementChild?.cloneNode(true)` 复制模板中的 `<li>`，用 `instanceof HTMLLIElement` 收窄后，把文字填进 `.text`，`list.append` 它。切换：`const done = item.classList.toggle('done')`（返回切换后的状态），再 `button.setAttribute('aria-pressed', String(done))`。
:::

:::explanation
所有“完成”和“删除”按钮共用 `#todos` 上的一个监听器。新添加的项不需要任何额外的代码就能工作：它们的点击事件同样冒泡到 `#todos`。

监听器里的三步检查缺一不可：`event.target` 可能是按钮里的 `<span>`，所以要用 `closest` 向上找；`closest` 可能找到容器外面的按钮，所以要用 `contains` 确认；找到的按钮要收窄成 `HTMLButtonElement` 才能读取 `dataset`。

`classList.toggle` 返回切换之后的状态（`true` 表示现在有这个 class），正好用来设置 `aria-pressed`，屏幕阅读器会读出“完成，切换按钮，已按下”。

如果想把“创建一项”抽成辅助函数，要注意一个细节：在文件开头的检查之后，用函数**表达式**（例如箭头函数 `const createItem = (text: string) => { … }`）定义它，就可以直接使用已经收窄的 `template`；改用 `function createItem() { … }` **声明**，TypeScript 会认为 `template` 仍然是检查之前的类型 `Element | null`（既可能是 `null`，也没有 `content` 属性）。函数声明会被提升到文件开头，可能在检查之前就被调用，所以 TypeScript 不把检查的结果带进去。

表单的 `submit` 监听器必须调用 `preventDefault()`：否则浏览器会提交表单并跳转页面（本平台的沙箱会拦截跳转并报告），测试中检查了 `event.defaultPrevented`。用 `<template>` 复制结构，比一行行 `createElement` 更容易和 HTML 保持一致。
:::

:::variant{kind=alt name=switch-on-action}
```ts file=main.ts
const form = document.querySelector('#add-form');
const input = document.querySelector('#new-todo');
const list = document.querySelector('#todos');
const template = document.querySelector('#todo-template');
if (
  !(form instanceof HTMLFormElement) ||
  !(input instanceof HTMLInputElement) ||
  !(list instanceof HTMLUListElement) ||
  !(template instanceof HTMLTemplateElement)
) {
  throw new Error('页面结构不完整');
}

const createItem = (text: string): HTMLLIElement => {
  const fragment = template.content.cloneNode(true);
  if (!(fragment instanceof DocumentFragment)) throw new Error('模板无效');
  const li = fragment.querySelector('li');
  const span = fragment.querySelector('.text');
  if (!li || !span) throw new Error('模板无效');
  span.textContent = text;
  return li;
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(form).get('text');
  const text = typeof data === 'string' ? data.trim() : '';
  if (text) {
    list.append(createItem(text));
    form.reset();
  }
});

list.addEventListener('click', ({ target }) => {
  const button = target instanceof Element ? target.closest('button') : null;
  const item = button?.closest('li');
  if (!button || !item || !list.contains(item)) return;
  switch (button.dataset.action) {
    case 'toggle':
      button.setAttribute('aria-pressed', String(item.classList.toggle('done')));
      break;
    case 'delete':
      item.remove();
      break;
  }
});
```
:::

:::variant{kind=wrong name=per-button-listeners fails=tests reason="页面加载时给每个按钮单独挂监听器，新添加的项没有监听器"}
```ts file=main.ts
const form = document.querySelector('#add-form');
const input = document.querySelector('#new-todo');
const list = document.querySelector('#todos');
const template = document.querySelector('#todo-template');
if (
  !(form instanceof HTMLFormElement) ||
  !(input instanceof HTMLInputElement) ||
  !(list instanceof HTMLUListElement) ||
  !(template instanceof HTMLTemplateElement)
) {
  throw new Error('页面结构不完整');
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (text === '') return;
  const item = template.content.firstElementChild?.cloneNode(true);
  if (!(item instanceof HTMLLIElement)) throw new Error('模板中缺少 <li>');
  const textEl = item.querySelector('.text');
  if (textEl) textEl.textContent = text;
  list.append(item);
  input.value = '';
});

for (const button of list.querySelectorAll('button')) {
  button.addEventListener('click', () => {
    const item = button.closest('li');
    if (!item) return;
    if (button.dataset.action === 'toggle') {
      button.setAttribute('aria-pressed', String(item.classList.toggle('done')));
    } else {
      item.remove();
    }
  });
}
```
:::

:::variant{kind=wrong name=target-without-closest fails=tests reason="直接用 event.target 判断按钮，点中按钮里的图标时不生效"}
```ts file=main.ts
const form = document.querySelector('#add-form');
const input = document.querySelector('#new-todo');
const list = document.querySelector('#todos');
const template = document.querySelector('#todo-template');
if (
  !(form instanceof HTMLFormElement) ||
  !(input instanceof HTMLInputElement) ||
  !(list instanceof HTMLUListElement) ||
  !(template instanceof HTMLTemplateElement)
) {
  throw new Error('页面结构不完整');
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (text === '') return;
  const item = template.content.firstElementChild?.cloneNode(true);
  if (!(item instanceof HTMLLIElement)) throw new Error('模板中缺少 <li>');
  const textEl = item.querySelector('.text');
  if (textEl) textEl.textContent = text;
  list.append(item);
  input.value = '';
});

list.addEventListener('click', (event) => {
  const button = event.target;
  if (!(button instanceof HTMLButtonElement)) return;
  const item = button.closest('li');
  if (item === null) return;
  if (button.dataset.action === 'toggle') {
    button.setAttribute('aria-pressed', String(item.classList.toggle('done')));
  } else if (button.dataset.action === 'delete') {
    item.remove();
  }
});
```
:::

:::variant{kind=wrong name=no-prevent-default fails=tests reason="提交表单时没有阻止默认行为"}
```ts file=main.ts
const form = document.querySelector('#add-form');
const input = document.querySelector('#new-todo');
const list = document.querySelector('#todos');
const template = document.querySelector('#todo-template');
if (
  !(form instanceof HTMLFormElement) ||
  !(input instanceof HTMLInputElement) ||
  !(list instanceof HTMLUListElement) ||
  !(template instanceof HTMLTemplateElement)
) {
  throw new Error('页面结构不完整');
}

form.addEventListener('submit', () => {
  const text = input.value.trim();
  if (text === '') return;
  const item = template.content.firstElementChild?.cloneNode(true);
  if (!(item instanceof HTMLLIElement)) throw new Error('模板中缺少 <li>');
  const textEl = item.querySelector('.text');
  if (textEl) textEl.textContent = text;
  list.append(item);
  input.value = '';
});

list.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('button[data-action]');
  if (!(button instanceof HTMLButtonElement) || !list.contains(button)) return;
  const item = button.closest('li');
  if (item === null) return;
  if (button.dataset.action === 'toggle') {
    button.setAttribute('aria-pressed', String(item.classList.toggle('done')));
  } else if (button.dataset.action === 'delete') {
    item.remove();
  }
});
```
:::

:::variant{kind=wrong name=toggle-without-aria fails=tests reason="切换了 done，但没有更新 aria-pressed"}
```ts file=main.ts
const form = document.querySelector('#add-form');
const input = document.querySelector('#new-todo');
const list = document.querySelector('#todos');
const template = document.querySelector('#todo-template');
if (
  !(form instanceof HTMLFormElement) ||
  !(input instanceof HTMLInputElement) ||
  !(list instanceof HTMLUListElement) ||
  !(template instanceof HTMLTemplateElement)
) {
  throw new Error('页面结构不完整');
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (text === '') return;
  const item = template.content.firstElementChild?.cloneNode(true);
  if (!(item instanceof HTMLLIElement)) throw new Error('模板中缺少 <li>');
  const textEl = item.querySelector('.text');
  if (textEl) textEl.textContent = text;
  list.append(item);
  input.value = '';
});

list.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('button[data-action]');
  if (!(button instanceof HTMLButtonElement) || !list.contains(button)) return;
  const item = button.closest('li');
  if (item === null) return;
  if (button.dataset.action === 'toggle') item.classList.toggle('done');
  else if (button.dataset.action === 'delete') item.remove();
});
```
:::
