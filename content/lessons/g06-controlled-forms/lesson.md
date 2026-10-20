---
version: 1
mode: react
estimatedMinutes: 45
review: self-reviewed
problem: 表单要能校验输入、根据输入实时显示提示、提交后清空，有时还要根据一个字段决定另一个字段能不能用。如果输入框里的内容只存在于 DOM 中，这些事情都要先去 DOM 里把值读出来（d09 的做法）。React 更常用的方式是“受控组件”：输入框显示的值来自 state，每次输入都更新 state。这一课讲文本框、多行文本、下拉框、复选框、单选框的受控写法，事件对象的类型，以及提交、校验与重置。
objectives:
  - 用 value / checked 与 onChange 把输入控件和 state 绑定，理解 React 的 onChange 在每次输入时触发
  - 为输入、下拉框、复选框、单选框和多行文本写出正确的受控写法与事件类型（ChangeEvent、SubmitEvent）
  - 用一个对象 state 管理多个字段，用泛型函数类型安全地更新某个字段
  - 在提交时校验、显示可访问的错误信息，提交成功后重置表单；知道非受控表单与 React 19 表单 action 的存在
references:
  - title: "<input> — React"
    url: https://react.dev/reference/react-dom/components/input
    checked: 2026-10-20
  - title: "<select> — React"
    url: https://react.dev/reference/react-dom/components/select
    checked: 2026-10-20
  - title: "<form> — React"
    url: https://react.dev/reference/react-dom/components/form
    checked: 2026-10-20
  - title: Reacting to Input with State — React
    url: https://react.dev/learn/reacting-to-input-with-state
    checked: 2026-10-20
    note: 本平台使用 React 19.3 与 @types/react 19.3
---

## 受控输入框

把输入框的 `value` 设置成一个 state，并在 `onChange` 中更新这个 state，输入框就成了**受控**的：它显示什么，完全由 state 决定。

```tsx
const [name, setName] = useState('');
<input value={name} onChange={(e) => setName(e.currentTarget.value)} />;
```

数据的流向是一个圈：用户输入 → `onChange` → `setName` → 重新渲染 → 输入框显示新的 `name`。这样，任何时候 `name` 都是输入框中的内容，可以直接用它计算提示、决定按钮是否可用，而不用去 DOM 中读取。

两个和原生 DOM 不同的地方：

- React 的 `onChange` 在**每次输入**时都会触发（相当于原生的 `input` 事件），而不是像原生的 `change` 事件那样等到失去焦点（d07）；
- 只设置 `value` 而不提供 `onChange`，输入框就成了只读的：用户怎么输入都不会变，React 还会在控制台给出警告。

:::playground{#controlled-input}
```tsx file=App.tsx
import { useState } from 'react';

const MAX = 20;

export function App() {
  const [nickname, setNickname] = useState('');
  const left = MAX - nickname.length;

  return (
    <div>
      <label htmlFor="nickname">昵称</label>{' '}
      <input id="nickname" value={nickname} maxLength={MAX} onChange={(e) => setNickname(e.currentTarget.value)} />
      <p>还可以输入 {left} 个字</p>
      <p>预览：{nickname.trim() === '' ? '（未填写）' : `你好，${nickname.trim()}！`}</p>
      <button type="button" disabled={nickname === ''} onClick={() => setNickname('')}>
        清空
      </button>
    </div>
  );
}
```
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<App />);
```
- 输入时，剩余字数和预览同时更新：它们都是从 `nickname` 算出来的（第 7、13–14 行），不需要另外的 state。
- 第 15 行：“清空”只需要 `setNickname('')`，输入框跟着变空。在非受控的写法中，你得找到 DOM 元素去改它的 `value`。
- 把第 12 行的 `onChange={…}` 删掉再运行：输入框无法输入，控制台出现警告。
:::

## 不同的控件

| 控件 | 绑定的属性 | 在 onChange 中读取 |
| --- | --- | --- |
| `<input>`（文本、邮箱、数字……） | `value` | `e.currentTarget.value`（总是字符串） |
| `<textarea>` | `value`（不是子元素） | `e.currentTarget.value` |
| `<select>` | `value`（写在 `<select>` 上，不是 `<option selected>`） | `e.currentTarget.value` |
| `<input type="checkbox">` | `checked` | `e.currentTarget.checked` |
| `<input type="radio">` | `checked={当前值 === 这个选项}` | 选中时设置成这个选项的值 |

几点说明：

- **数字**：`<input type="number">` 的 `value` 仍然是字符串。state 也存成字符串，用户才能自由地删改（例如先删成空的，再输入新的数字；存成数字的话，`Number('')` 是 0，输入框没法清空）；提交或计算时再转换、校验。只需要整数的字段，也常用 `type="text"` 加 `inputMode="numeric"`，避免浏览器对 `-`、`e` 这类字符的特殊处理。
- **下拉框的值是 `string`**：如果 state 是联合类型（例如 `'low' | 'normal' | 'high'`），要先检查读到的值属于这个联合，再设置（b07 的类型守卫）。
- **事件的类型**：处理函数单独写出来时，输入控件用 `ChangeEvent<HTMLInputElement>`（`HTMLSelectElement`、`HTMLTextAreaElement` 同理），表单提交用 `SubmitEvent<HTMLFormElement>`，都从 `react` 导入。很多旧资料中的 `FormEvent`，在较新的 `@types/react` 19（本平台是 19.3）中已经被标为过时。注意 DOM 中也有一个全局的 `SubmitEvent` 类型：忘了从 `react` 导入时，TypeScript 会报告 “Type 'SubmitEvent' is not generic”。

## 一个对象管理多个字段

字段多时，可以把它们放进一个对象 state 中。更新某个字段时，用一个泛型函数保证“键”和“值的类型”对得上：

:::playground{#form-object}
```tsx file=App.tsx
import { useState, type ChangeEvent, type SubmitEvent } from 'react';

type Priority = 'low' | 'normal' | 'high';
type TaskForm = { title: string; priority: Priority; notes: string; pinned: boolean };

const EMPTY: TaskForm = { title: '', priority: 'normal', notes: '', pinned: false };

function isPriority(value: string): value is Priority {
  return value === 'low' || value === 'normal' || value === 'high';
}

export function App() {
  const [form, setForm] = useState(EMPTY);

  function update<K extends keyof TaskForm>(key: K, value: TaskForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handlePriority(e: ChangeEvent<HTMLSelectElement>) {
    const value = e.currentTarget.value;
    if (isPriority(value)) update('priority', value);
  }

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    console.log('提交：', { ...form, title: form.title.trim() });
    setForm(EMPTY);
  }

  return (
    <form onSubmit={handleSubmit}>
      <p>
        <label htmlFor="title">标题</label> <input id="title" value={form.title} onChange={(e) => update('title', e.currentTarget.value)} />
      </p>
      <p>
        <label htmlFor="priority">优先级</label>{' '}
        <select id="priority" value={form.priority} onChange={handlePriority}>
          <option value="low">低</option>
          <option value="normal">普通</option>
          <option value="high">高</option>
        </select>
      </p>
      <p>
        <label htmlFor="notes">备注</label>
        <br />
        <textarea id="notes" rows={3} value={form.notes} onChange={(e) => update('notes', e.currentTarget.value)} />
      </p>
      <p>
        <label>
          <input type="checkbox" checked={form.pinned} onChange={(e) => update('pinned', e.currentTarget.checked)} /> 置顶
        </label>
      </p>
      <button type="submit" disabled={form.title.trim() === ''}>
        添加
      </button>
    </form>
  );
}
```
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<App />);
```
- 第 15–17 行：`update('pinned', 'yes')` 会报错，因为 `TaskForm['pinned']` 是 `boolean`。泛型参数 `K` 把“键”和“值的类型”联系在了一起（b14）。
- 第 19–22 行：下拉框读到的是 `string`，经过 `isPriority` 收窄之后，才能设置给 `Priority` 类型的字段。
- 第 24–28 行：提交时先 `preventDefault()`，阻止浏览器真的提交表单、刷新页面（d09）；处理完之后，`setForm(EMPTY)` 一次性清空所有字段。
- 填好表单后按回车或点“添加”，看控制台的输出。
:::

## 校验与错误信息

校验的思路和 d09 一样：写一个**纯函数**，输入表单数据，输出每个字段的错误。不同的是，现在错误也可以从 state 算出来，直接在 JSX 中显示：

```tsx
const errors = validate(form); // { title?: string; email?: string }
<input id="email" aria-invalid={errors.email !== undefined} aria-describedby={errors.email !== undefined ? 'email-error' : undefined} … />
{errors.email !== undefined && <p id="email-error">{errors.email}</p>}
```

常见的做法是：用户第一次点提交之前不显示错误（还没开始填写就满屏红字很不友好）；点过提交之后，错误随输入实时更新。用一个 `submitted` 布尔 state 记住“是否尝试过提交”就够了。挑战题会完整地实现这些。

## 非受控表单与表单 action

受控并不是唯一的写法。如果不需要在输入过程中做任何事，也可以只给输入框设置 `name` 和 `defaultValue`（初始值），提交时用 `new FormData(e.currentTarget)` 一次性读取所有字段，这叫**非受控**表单。React 19 还允许把一个函数传给 `<form action={…}>`，提交时 React 会用 `FormData` 调用它，完成后自动重置非受控的字段。它在服务端渲染的框架中（H 阶段）特别有用。

本课程的练习使用受控的写法：它让“表单的当前内容”成为普通的 state，校验、联动、测试都更直接。

::exercise{#new-task-form}

## 编程挑战

::exercise{#shipping-form}

::quiz

## 常见错误

- **只写 `value` 不写 `onChange`**：输入框变成只读的。
- **state 的初始值是 `undefined`**：输入框先是非受控、后来变成受控，React 会警告。文本框的初始值用 `''`。
- **数字输入框的 state 用 `number`**：用户无法把输入框清空。存字符串，提交时再转换。
- **复选框读取 `value`**：复选框要用 `checked` 和 `e.currentTarget.checked`。
- **忘了 `e.preventDefault()`**：浏览器真的提交表单，页面刷新，state 全部丢失。

## 下一步

下一课讲状态提升：几个组件需要同一份数据时，state 应该放在哪里。
