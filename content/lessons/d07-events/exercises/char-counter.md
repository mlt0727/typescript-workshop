---
kind: task
title: 实时剩余字数
---
昵称最多 20 个字符。完成 `main.ts`：用户**每输入或删除一个字符**，`#remaining` 都显示剩余字数（`20 - 当前长度`，超出时为负数）；剩余字数小于 0 时，给 `#remaining` 加上 class `over`，回到 0 及以上时去掉它。

页面结构在 `index.html` 中（只读）。不使用 `any`、类型断言或非空断言。

:::files{role=support}
```html file=index.html readonly
<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <label for="nickname">昵称</label>
    <input id="nickname" type="text" autocomplete="off" />
    <p>还可以输入 <span id="remaining">20</span> 个字符</p>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```css file=style.css readonly
.over { color: #b3261e; font-weight: bold; }
```
:::

:::files{role=starter}
```ts file=main.ts
const MAX = 20;

const input = document.querySelector('#nickname');
const remaining = document.querySelector('#remaining');
if (!(input instanceof HTMLInputElement) || !(remaining instanceof HTMLSpanElement)) {
  throw new Error('页面结构不完整');
}

// TODO：监听输入，更新剩余字数与 over 样式
```
:::

:::files{role=solution}
```ts file=main.ts
const MAX = 20;

const input = document.querySelector('#nickname');
const remaining = document.querySelector('#remaining');
if (!(input instanceof HTMLInputElement) || !(remaining instanceof HTMLSpanElement)) {
  throw new Error('页面结构不完整');
}

input.addEventListener('input', () => {
  const left = MAX - input.value.length;
  remaining.textContent = String(left);
  remaining.classList.toggle('over', left < 0);
});
```
:::

:::files{role=tests}
```ts file=page.test.ts
import { expect, test } from 'vitest';
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

function remaining() {
  const el = document.querySelector('#remaining');
  if (!(el instanceof HTMLElement)) throw new Error('找不到 #remaining');
  return el;
}

test('每输入一个字符就更新剩余字数', async () => {
  const user = userEvent.setup();
  const input = screen.getByLabelText('昵称');
  await user.type(input, 'A');
  expect(remaining()).toHaveTextContent('19');
  await user.type(input, 'da');
  expect(remaining()).toHaveTextContent('17');
});

test('删除字符时剩余字数增加', async () => {
  const user = userEvent.setup();
  const input = screen.getByLabelText('昵称');
  await user.type(input, 'TypeScript');
  await user.type(input, '{Backspace}{Backspace}');
  expect(remaining()).toHaveTextContent('12');
});

test('超出上限时显示负数并加上 over', async () => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('昵称'), 'abcdefghijklmnopqrstuv');
  expect(remaining()).toHaveTextContent('-2');
  expect(remaining()).toHaveClass('over');
});

test('回到上限内时去掉 over', async () => {
  const user = userEvent.setup();
  const input = screen.getByLabelText('昵称');
  await user.type(input, 'abcdefghijklmnopqrstuv');
  await user.type(input, '{Backspace}{Backspace}{Backspace}');
  expect(remaining()).toHaveTextContent('1');
  expect(remaining()).not.toHaveClass('over');
});
```
:::

:::hint{level=1}
需要一个**每次内容变化都会触发**的事件。在监听器里，`input` 变量已经被收窄成 `HTMLInputElement`，可以直接读 `input.value`。
:::

:::hint{level=2}
监听 `'input'` 事件；剩余字数是 `MAX - input.value.length`。`classList.toggle(name, force)` 在 `force` 为 `true` 时添加、为 `false` 时移除 class。
:::

:::explanation
`input` 事件在文本框内容每次变化（输入、删除、粘贴）时触发；`change` 事件对文本框来说一般要等失去焦点才触发，不适合实时反馈。

监听器里直接使用外层的 `input` 与 `remaining`：它们是 `const`，并且已经用 `instanceof` 收窄过，TypeScript 在箭头函数里仍然认得它们的具体类型。`classList.toggle('over', left < 0)` 一行同时处理“加上”和“去掉”。
:::

:::variant{kind=alt name=current-target-and-if}
```ts file=main.ts
const MAX = 20;

const input = document.querySelector('#nickname');
const remaining = document.querySelector('#remaining');
if (!(input instanceof HTMLInputElement) || !(remaining instanceof HTMLSpanElement)) {
  throw new Error('页面结构不完整');
}

input.addEventListener('input', (event) => {
  const field = event.currentTarget;
  if (!(field instanceof HTMLInputElement)) return;
  const left = MAX - field.value.length;
  remaining.textContent = `${left}`;
  if (left < 0) {
    remaining.classList.add('over');
  } else {
    remaining.classList.remove('over');
  }
});
```
:::

:::variant{kind=wrong name=change-event fails=tests reason="用 change 事件：输入过程中不触发，无法实时更新"}
```ts file=main.ts
const MAX = 20;

const input = document.querySelector('#nickname');
const remaining = document.querySelector('#remaining');
if (!(input instanceof HTMLInputElement) || !(remaining instanceof HTMLSpanElement)) {
  throw new Error('页面结构不完整');
}

input.addEventListener('change', () => {
  const left = MAX - input.value.length;
  remaining.textContent = String(left);
  remaining.classList.toggle('over', left < 0);
});
```
:::

:::variant{kind=wrong name=never-removes-class fails=tests reason="只会加上 over，回到上限内时没有去掉"}
```ts file=main.ts
const MAX = 20;

const input = document.querySelector('#nickname');
const remaining = document.querySelector('#remaining');
if (!(input instanceof HTMLInputElement) || !(remaining instanceof HTMLSpanElement)) {
  throw new Error('页面结构不完整');
}

input.addEventListener('input', () => {
  const left = MAX - input.value.length;
  remaining.textContent = String(left);
  if (left < 0) remaining.classList.add('over');
});
```
:::

:::variant{kind=wrong name=asserted-target fails=rules reason="用类型断言读取 event.target，而不是收窄"}
```ts file=main.ts
const MAX = 20;

const input = document.querySelector('#nickname');
const remaining = document.querySelector('#remaining');
if (!(input instanceof HTMLInputElement) || !(remaining instanceof HTMLSpanElement)) {
  throw new Error('页面结构不完整');
}

input.addEventListener('input', (event) => {
  const left = MAX - (event.target as HTMLInputElement).value.length;
  remaining.textContent = String(left);
  remaining.classList.toggle('over', left < 0);
});
```
:::
