---
kind: challenge
title: 可访问的错误提示
---
注册表单带有 `novalidate`，浏览器不再显示提示气泡，错误由你来显示。`parse.ts`（只读）提供了小任务中的 `parseSignup`。在 `main.ts` 中实现：

1. **提交时**：阻止默认行为，用 `parseSignup(new FormData(form))` 解析。
2. **有错误时**，对五个字段（`name`、`email`、`age`、`password`、`confirm`，按这个顺序）：
   - 有错误的字段：错误信息写进 `#字段-error`（例如 `#email-error`），输入框设置 `aria-invalid="true"`；
   - 没有错误的字段：清空 `#字段-error`，并移除输入框的 `aria-invalid`；
   - 把焦点移到**第一个**有错误的输入框；
   - `#status` 显示 `有 N 处需要修改`（N 是错误的个数）。
3. **成功时**：清除所有错误（同上），`#status` 显示 `注册成功：昵称`，然后重置表单。
4. **边改边清**：用户在一个**当前有错误**的输入框里输入时，立即清除这个字段的错误信息和 `aria-invalid`（其他字段不变）。

输入框与错误信息之间的 `aria-describedby` 关联已经写在 HTML 里了。

:::files{role=support}
```html file=index.html readonly
<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <form id="signup" novalidate>
      <p>
        <label for="name">昵称</label>
        <input id="name" name="name" aria-describedby="name-error" />
        <span class="error" id="name-error"></span>
      </p>
      <p>
        <label for="email">邮箱</label>
        <input id="email" name="email" type="email" aria-describedby="email-error" />
        <span class="error" id="email-error"></span>
      </p>
      <p>
        <label for="age">年龄</label>
        <input id="age" name="age" inputmode="numeric" aria-describedby="age-error" />
        <span class="error" id="age-error"></span>
      </p>
      <p>
        <label for="password">密码</label>
        <input id="password" name="password" type="password" aria-describedby="password-error" />
        <span class="error" id="password-error"></span>
      </p>
      <p>
        <label for="confirm">确认密码</label>
        <input id="confirm" name="confirm" type="password" aria-describedby="confirm-error" />
        <span class="error" id="confirm-error"></span>
      </p>
      <button type="submit">注册</button>
    </form>
    <p id="status" role="status"></p>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```css file=style.css readonly
.error { color: #b00020; margin-left: 8px; }
[aria-invalid='true'] { border: 2px solid #b00020; }
```
```ts file=parse.ts readonly
export type SignupData = { name: string; email: string; age: number; password: string };
export type Field = keyof SignupData | 'confirm';
export type ParseResult =
  | { ok: true; value: SignupData }
  | { ok: false; errors: Partial<Record<Field, string>> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function raw(data: FormData, name: Field): string {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}

export function parseSignup(data: FormData): ParseResult {
  const errors: Partial<Record<Field, string>> = {};
  const name = raw(data, 'name').trim();
  if (name === '') errors.name = '请填写昵称';
  else if (name.length > 20) errors.name = '昵称最多 20 个字符';
  const email = raw(data, 'email').trim();
  if (email === '') errors.email = '请填写邮箱';
  else if (!EMAIL.test(email)) errors.email = '邮箱格式不正确';
  const ageText = raw(data, 'age').trim();
  const age = Number(ageText);
  if (ageText === '') errors.age = '请填写年龄';
  else if (!/^\d+$/.test(ageText)) errors.age = '年龄必须是整数';
  else if (age < 13 || age > 120) errors.age = '年龄必须在 13 到 120 之间';
  const password = raw(data, 'password');
  if (password.length < 8) errors.password = '密码至少 8 个字符';
  if (raw(data, 'confirm') !== password) errors.confirm = '两次输入的密码不一致';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, email, age, password } };
}
```
:::

:::files{role=starter}
```ts file=main.ts
import { parseSignup, type Field } from './parse';

const FIELDS: readonly Field[] = ['name', 'email', 'age', 'password', 'confirm'];

const form = document.querySelector('#signup');
const status = document.querySelector('#status');
if (!(form instanceof HTMLFormElement) || !(status instanceof HTMLElement)) {
  throw new Error('页面结构不完整');
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const result = parseSignup(new FormData(form));
  // TODO：显示或清除错误、移动焦点、更新 #status
});
```
:::

:::files{role=solution}
```ts file=main.ts
import { parseSignup, type Field } from './parse';

const FIELDS: readonly Field[] = ['name', 'email', 'age', 'password', 'confirm'];

const form = document.querySelector('#signup');
const status = document.querySelector('#status');
if (!(form instanceof HTMLFormElement) || !(status instanceof HTMLElement)) {
  throw new Error('页面结构不完整');
}

const parts = (field: Field): { input: HTMLInputElement; message: HTMLElement } => {
  const input = document.getElementById(field);
  const message = document.getElementById(`${field}-error`);
  if (!(input instanceof HTMLInputElement) || message === null) {
    throw new Error(`缺少 #${field} 或 #${field}-error`);
  }
  return { input, message };
};

const showError = (field: Field, text: string | undefined): void => {
  const { input, message } = parts(field);
  message.textContent = text ?? '';
  if (text === undefined) input.removeAttribute('aria-invalid');
  else input.setAttribute('aria-invalid', 'true');
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const result = parseSignup(new FormData(form));

  if (result.ok) {
    for (const field of FIELDS) showError(field, undefined);
    status.textContent = `注册成功：${result.value.name}`;
    form.reset();
    return;
  }

  const invalid = FIELDS.filter((field) => result.errors[field] !== undefined);
  for (const field of FIELDS) showError(field, result.errors[field]);
  const first = invalid[0];
  if (first !== undefined) parts(first).input.focus();
  status.textContent = `有 ${invalid.length} 处需要修改`;
});

form.addEventListener('input', (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.getAttribute('aria-invalid') !== 'true') return;
  const field = FIELDS.find((f) => f === input.name);
  if (field !== undefined) showError(field, undefined);
});
```
:::

:::files{role=tests}
```ts file=errors.test.ts
import { expect, test } from 'vitest';
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

function field(label: string): HTMLElement {
  return screen.getByLabelText(label);
}

function errorText(id: string): string {
  return document.getElementById(`${id}-error`)?.textContent ?? '';
}

async function submit() {
  await userEvent.setup().click(screen.getByRole('button', { name: '注册' }));
}

test('提交空表单：显示错误、标记无效、聚焦第一个错误、更新状态', async () => {
  const prevented: boolean[] = [];
  const form = document.querySelector('form');
  form?.addEventListener('submit', (event) => prevented.push(event.defaultPrevented));
  await submit();
  expect(prevented).toEqual([true]);
  expect(errorText('name')).toBe('请填写昵称');
  expect(errorText('age')).toBe('请填写年龄');
  expect(errorText('confirm')).toBe('');
  expect(field('昵称')).toHaveAttribute('aria-invalid', 'true');
  expect(field('确认密码')).not.toHaveAttribute('aria-invalid');
  expect(field('昵称')).toHaveFocus();
  expect(screen.getByRole('status')).toHaveTextContent('有 4 处需要修改');
});

test('改正部分字段后再提交：清除已改正的错误，焦点移到下一个错误', async () => {
  const user = userEvent.setup();
  await submit();
  await user.type(field('昵称'), 'Ada');
  await user.type(field('邮箱'), 'ada@example.com');
  await submit();
  expect(errorText('name')).toBe('');
  expect(field('昵称')).not.toHaveAttribute('aria-invalid');
  expect(field('年龄')).toHaveFocus();
  expect(screen.getByRole('status')).toHaveTextContent('有 2 处需要修改');
});

test('没有修改的字段变得合法时，再次提交会清除它过时的错误', async () => {
  const user = userEvent.setup();
  await user.type(field('昵称'), 'Ada');
  await user.type(field('邮箱'), 'ada@example.com');
  await user.type(field('年龄'), '36');
  await user.type(field('密码'), 'correct horse');
  await user.type(field('确认密码'), 'correct horsf');
  await submit();
  expect(errorText('confirm')).toBe('两次输入的密码不一致');
  await user.clear(field('密码'));
  await user.type(field('密码'), 'correct horsf');
  await user.clear(field('年龄'));
  await submit();
  // 这次提交仍然失败（年龄没填），但确认密码已经合法：它过时的错误要被清除
  expect(errorText('age')).toBe('请填写年龄');
  expect(errorText('confirm')).toBe('');
  expect(field('确认密码')).not.toHaveAttribute('aria-invalid');
  expect(screen.getByRole('status')).toHaveTextContent('有 1 处需要修改');
});

test('在有错误的输入框里输入时，立即清除这个字段的错误', async () => {
  const user = userEvent.setup();
  await submit();
  await user.type(field('邮箱'), 'a');
  expect(errorText('email')).toBe('');
  expect(field('邮箱')).not.toHaveAttribute('aria-invalid');
  expect(errorText('name')).toBe('请填写昵称');
  expect(field('昵称')).toHaveAttribute('aria-invalid', 'true');
});

test('成功：清除错误、显示成功状态、重置表单', async () => {
  const user = userEvent.setup();
  await user.type(field('昵称'), 'Ada');
  await user.type(field('邮箱'), 'ada@example.com');
  await user.type(field('年龄'), '36');
  await user.type(field('密码'), 'correct horse');
  await user.type(field('确认密码'), 'correct hors');
  await submit();
  expect(errorText('confirm')).toBe('两次输入的密码不一致');
  expect(field('确认密码')).toHaveFocus();
  await user.type(field('确认密码'), 'e');
  await submit();
  expect(screen.getByRole('status')).toHaveTextContent('注册成功：Ada');
  expect(document.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0);
  expect(field('昵称')).toHaveValue('');
});
```
:::

:::hint{level=1}
写两个小工具：`parts(field)` 返回这个字段的输入框和错误元素（在里面做好 `instanceof` 检查）；`showError(field, text)` 在 `text` 为 `undefined` 时清除、否则显示错误。提交时对五个字段都调用一次 `showError(field, result.errors[field])`。如果辅助函数要用到文件开头收窄过的变量（例如 `form`、`status`），就用箭头函数（函数表达式）定义它，函数声明里不保留收窄。
:::

:::hint{level=2}
第一个错误：`FIELDS.filter((f) => result.errors[f] !== undefined)` 得到有错误的字段（顺序与 `FIELDS` 一致），取第一个并 `focus()`。边改边清：在 `form` 上监听 `input` 事件（它会冒泡），`event.target` 收窄成 `HTMLInputElement` 并且 `aria-invalid` 为 `'true'` 时，用它的 `name` 找到字段并清除错误。
:::

:::explanation
数据的解析（`parseSignup`）和错误的显示（`main.ts`）分开之后，各自都很简单：解析函数只关心规则，显示代码只关心“这个字段有没有错误、错误是什么”。

每次提交都要处理**所有**字段，而不仅是有错误的：上次报错、这次已经改正的字段需要清除，否则旧的错误会一直留着。

几个可访问性的细节：

- `aria-invalid="true"` 让屏幕阅读器读出“无效”，`aria-describedby` 让它读出错误信息；改正后要**移除** `aria-invalid`，而不是保留一个过时的状态；
- 提交失败后把焦点移到第一个错误上，用户不用自己去找；
- `#status` 是 `role="status"` 的元素，内容变化时屏幕阅读器会读出来，不需要移动焦点。

“边改边清”用了 d08 的事件委托：`input` 事件会冒泡，在表单上监听一次就覆盖了所有输入框。只清除当前有错误的字段，不在用户输入的过程中添加新的错误，避免用户还没输完就被打断；新的错误在下一次提交时才显示。
:::

:::variant{kind=alt name=map-of-elements}
```ts file=main.ts
import { parseSignup, type Field } from './parse';

const FIELDS: readonly Field[] = ['name', 'email', 'age', 'password', 'confirm'];

const form = document.querySelector('#signup');
const status = document.querySelector('#status');
if (!(form instanceof HTMLFormElement) || !(status instanceof HTMLElement)) {
  throw new Error('页面结构不完整');
}

const elements = new Map<string, { input: HTMLInputElement; message: HTMLElement }>();
for (const field of FIELDS) {
  const input = form.querySelector(`#${field}`);
  const message = form.querySelector(`#${field}-error`);
  if (!(input instanceof HTMLInputElement) || !(message instanceof HTMLElement)) throw new Error(`缺少 ${field}`);
  elements.set(field, { input, message });
}

const render = (errors: Partial<Record<Field, string>>): void => {
  for (const field of FIELDS) {
    const entry = elements.get(field);
    if (!entry) continue;
    const text = errors[field];
    entry.message.textContent = text ?? '';
    if (text === undefined) entry.input.removeAttribute('aria-invalid');
    else entry.input.setAttribute('aria-invalid', 'true');
  }
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const result = parseSignup(new FormData(form));
  if (result.ok) {
    render({});
    status.textContent = `注册成功：${result.value.name}`;
    form.reset();
    return;
  }
  render(result.errors);
  const firstField = FIELDS.find((f) => result.errors[f]);
  if (firstField) elements.get(firstField)?.input.focus();
  status.textContent = `有 ${Object.keys(result.errors).length} 处需要修改`;
});

form.addEventListener('input', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || target.getAttribute('aria-invalid') !== 'true') return;
  const entry = elements.get(target.name);
  if (!entry) return;
  entry.message.textContent = '';
  entry.input.removeAttribute('aria-invalid');
});
```
:::

:::variant{kind=wrong name=only-set-errors fails=tests reason="只显示新的错误，没有清除已经改正的字段"}
```ts file=main.ts
import { parseSignup, type Field } from './parse';

const FIELDS: readonly Field[] = ['name', 'email', 'age', 'password', 'confirm'];

const form = document.querySelector('#signup');
const status = document.querySelector('#status');
if (!(form instanceof HTMLFormElement) || !(status instanceof HTMLElement)) {
  throw new Error('页面结构不完整');
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const result = parseSignup(new FormData(form));
  if (result.ok) {
    status.textContent = `注册成功：${result.value.name}`;
    form.reset();
    return;
  }
  let count = 0;
  let focused = false;
  for (const field of FIELDS) {
    const text = result.errors[field];
    const input = document.getElementById(field);
    const message = document.getElementById(`${field}-error`);
    if (text === undefined || !(input instanceof HTMLInputElement) || !message) continue;
    count++;
    message.textContent = text;
    input.setAttribute('aria-invalid', 'true');
    if (!focused) {
      input.focus();
      focused = true;
    }
  }
  status.textContent = `有 ${count} 处需要修改`;
});

form.addEventListener('input', (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.getAttribute('aria-invalid') !== 'true') return;
  input.removeAttribute('aria-invalid');
  const message = document.getElementById(`${input.name}-error`);
  if (message) message.textContent = '';
});
```
:::

:::variant{kind=wrong name=no-focus fails=tests reason="提交失败后没有把焦点移到第一个错误"}
```ts file=main.ts
import { parseSignup, type Field } from './parse';

const FIELDS: readonly Field[] = ['name', 'email', 'age', 'password', 'confirm'];

const form = document.querySelector('#signup');
const status = document.querySelector('#status');
if (!(form instanceof HTMLFormElement) || !(status instanceof HTMLElement)) {
  throw new Error('页面结构不完整');
}

const showError = (field: Field, text: string | undefined): void => {
  const input = document.getElementById(field);
  const message = document.getElementById(`${field}-error`);
  if (!(input instanceof HTMLInputElement) || !message) return;
  message.textContent = text ?? '';
  if (text === undefined) input.removeAttribute('aria-invalid');
  else input.setAttribute('aria-invalid', 'true');
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const result = parseSignup(new FormData(form));
  if (result.ok) {
    for (const field of FIELDS) showError(field, undefined);
    status.textContent = `注册成功：${result.value.name}`;
    form.reset();
    return;
  }
  for (const field of FIELDS) showError(field, result.errors[field]);
  status.textContent = `有 ${Object.keys(result.errors).length} 处需要修改`;
});

form.addEventListener('input', (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.getAttribute('aria-invalid') !== 'true') return;
  const field = FIELDS.find((f) => f === input.name);
  if (field !== undefined) showError(field, undefined);
});
```
:::

:::variant{kind=wrong name=never-remove-invalid fails=tests reason="改正后没有移除 aria-invalid，输入时也没有清除错误"}
```ts file=main.ts
import { parseSignup, type Field } from './parse';

const FIELDS: readonly Field[] = ['name', 'email', 'age', 'password', 'confirm'];

const form = document.querySelector('#signup');
const status = document.querySelector('#status');
if (!(form instanceof HTMLFormElement) || !(status instanceof HTMLElement)) {
  throw new Error('页面结构不完整');
}

const showError = (field: Field, text: string | undefined): void => {
  const input = document.getElementById(field);
  const message = document.getElementById(`${field}-error`);
  if (!(input instanceof HTMLInputElement) || !message) return;
  message.textContent = text ?? '';
  if (text !== undefined) input.setAttribute('aria-invalid', 'true');
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const result = parseSignup(new FormData(form));
  if (result.ok) {
    for (const field of FIELDS) showError(field, undefined);
    status.textContent = `注册成功：${result.value.name}`;
    form.reset();
    return;
  }
  const invalid = FIELDS.filter((field) => result.errors[field] !== undefined);
  for (const field of FIELDS) showError(field, result.errors[field]);
  const first = invalid[0];
  if (first !== undefined) document.getElementById(first)?.focus();
  status.textContent = `有 ${invalid.length} 处需要修改`;
});
```
:::
