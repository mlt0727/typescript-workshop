---
kind: task
title: 新建任务的表单
---
把 `NewTaskForm` 改成受控表单：

1. 三个字段：标题（文本框，初始为空）、优先级（下拉框，初始为“普通” `normal`）、置顶（复选框，初始不勾选），都由 state 控制；
2. 提交时（点“添加”或者在文本框中按回车）阻止浏览器的默认行为；
3. 标题去掉首尾空白之后为空时，不调用 `onAdd`，在标题下面显示 `<p role="alert">请输入标题</p>`；
4. 否则调用 `onAdd({ title, priority, pinned })`（标题去掉首尾空白），然后把三个字段恢复成初始值，并去掉错误提示。

下拉框读到的值是 `string`，要先确认它是 `'low' | 'normal' | 'high'` 之一再保存（不能用类型断言）。

:::files{role=starter}
```tsx file=NewTaskForm.tsx
import type { SubmitEvent } from 'react';

export type Priority = 'low' | 'normal' | 'high';
export type NewTask = { title: string; priority: Priority; pinned: boolean };

export function NewTaskForm({ onAdd }: { onAdd: (task: NewTask) => void }) {
  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    // TODO：用 state 记住三个字段，校验后调用 onAdd，然后清空表单
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="title">标题</label>
      <input id="title" />
      <label htmlFor="priority">优先级</label>
      <select id="priority">
        <option value="low">低</option>
        <option value="normal">普通</option>
        <option value="high">高</option>
      </select>
      <label>
        <input type="checkbox" /> 置顶
      </label>
      <button type="submit">添加</button>
    </form>
  );
}
```
:::

:::files{role=support}
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { NewTaskForm } from './NewTaskForm';

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<NewTaskForm onAdd={(task) => console.log('添加：', task)} />);
```
:::

:::files{role=solution}
```tsx file=NewTaskForm.tsx
import { useState, type ChangeEvent, type SubmitEvent } from 'react';

export type Priority = 'low' | 'normal' | 'high';
export type NewTask = { title: string; priority: Priority; pinned: boolean };

type Form = NewTask;

const EMPTY: Form = { title: '', priority: 'normal', pinned: false };

function isPriority(value: string): value is Priority {
  return value === 'low' || value === 'normal' || value === 'high';
}

export function NewTaskForm({ onAdd }: { onAdd: (task: NewTask) => void }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handlePriority(e: ChangeEvent<HTMLSelectElement>) {
    const value = e.currentTarget.value;
    if (isPriority(value)) update('priority', value);
  }

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const title = form.title.trim();
    if (title === '') {
      setError('请输入标题');
      return;
    }
    onAdd({ ...form, title });
    setForm(EMPTY);
    setError(null);
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="title">标题</label>
      <input id="title" value={form.title} onChange={(e) => update('title', e.currentTarget.value)} />
      {error !== null && <p role="alert">{error}</p>}
      <label htmlFor="priority">优先级</label>
      <select id="priority" value={form.priority} onChange={handlePriority}>
        <option value="low">低</option>
        <option value="normal">普通</option>
        <option value="high">高</option>
      </select>
      <label>
        <input type="checkbox" checked={form.pinned} onChange={(e) => update('pinned', e.currentTarget.checked)} /> 置顶
      </label>
      <button type="submit">添加</button>
    </form>
  );
}
```
:::

:::files{role=tests}
```tsx file=NewTaskForm.test.tsx
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewTaskForm, type NewTask } from './NewTaskForm';

const submits: boolean[] = [];
const recordSubmit = (event: Event) => {
  submits.push(event.defaultPrevented);
  event.preventDefault();
};

beforeEach(() => {
  submits.length = 0;
  window.addEventListener('submit', recordSubmit);
});

afterEach(() => {
  window.removeEventListener('submit', recordSubmit);
});

function setup() {
  const onAdd = vi.fn<(task: NewTask) => void>();
  render(<NewTaskForm onAdd={onAdd} />);
  return {
    onAdd,
    user: userEvent.setup(),
    title: () => screen.getByLabelText('标题'),
    priority: () => screen.getByLabelText('优先级'),
    pinned: () => screen.getByLabelText('置顶'),
  };
}

test('初始状态：空标题、普通优先级、不置顶', () => {
  const { title, priority, pinned } = setup();
  expect(title()).toHaveValue('');
  expect(priority()).toHaveValue('normal');
  expect(pinned()).not.toBeChecked();
});

test('在标题中按回车提交：标题去掉首尾空白，提交后清空表单', async () => {
  const { onAdd, user, title, priority, pinned } = setup();
  await user.type(title(), '  写周报 ');
  await user.selectOptions(priority(), 'high');
  await user.click(pinned());
  await user.type(title(), '{Enter}');
  expect(onAdd).toHaveBeenCalledTimes(1);
  expect(onAdd).toHaveBeenCalledWith({ title: '写周报', priority: 'high', pinned: true });
  expect(submits).toEqual([true]);
  expect(title()).toHaveValue('');
  expect(priority()).toHaveValue('normal');
  expect(pinned()).not.toBeChecked();
});

test('点击“添加”同样提交；复选框可以来回切换', async () => {
  const { onAdd, user, title, pinned } = setup();
  await user.type(title(), '买菜');
  await user.click(pinned());
  await user.click(pinned());
  await user.click(screen.getByRole('button', { name: '添加' }));
  expect(onAdd).toHaveBeenCalledWith({ title: '买菜', priority: 'normal', pinned: false });
});

test('标题为空时显示错误、不提交；改正后提交，错误消失', async () => {
  const { onAdd, user, title } = setup();
  await user.type(title(), '   ');
  await user.click(screen.getByRole('button', { name: '添加' }));
  expect(screen.getByRole('alert')).toHaveTextContent('请输入标题');
  expect(onAdd).not.toHaveBeenCalled();
  expect(submits).toEqual([true]);
  await user.type(title(), '读书{Enter}');
  expect(onAdd).toHaveBeenCalledWith({ title: '读书', priority: 'normal', pinned: false });
  expect(screen.queryByRole('alert')).toBeNull();
});
```
:::

:::hint{level=1}
用一个对象 state 保存三个字段，再用一个 state 保存错误信息（`string | null`）。文本框：`value` + `onChange`；下拉框同样是 `value` + `onChange`；复选框是 `checked` + `onChange`，读取 `e.currentTarget.checked`。
:::

:::hint{level=2}
本课第三个示例中的 `update<K extends keyof Form>(key, value)` 和 `isPriority` 可以直接用。提交函数：`e.preventDefault()`；`const title = form.title.trim()`；为空就 `setError('请输入标题')` 并返回；否则 `onAdd({ ...form, title })`、`setForm(EMPTY)`、`setError(null)`。
:::

:::explanation
受控表单让“表单当前的内容”就是 state：提交时直接读 `form`，提交后 `setForm(EMPTY)` 一行就清空了所有字段，不需要去 DOM 里一个个找输入框。

下拉框的 `value` 是 `string`，而 state 中的 `priority` 是 `Priority`。用 `e.currentTarget.value as Priority` 能让编译通过，但它只是“说服”了编译器：选项的 `value` 写错一个字母，类型系统也不会发现。用类型守卫检查一次，错误的值根本进不了 state（b07、b08）。

复选框的 `value` 属性是它被勾选时提交给服务器的值（默认是 `"on"`），无论是否勾选都不会变；表示“是否勾选”的是 `checked`。

提交事件默认会让浏览器真正地提交表单、刷新页面（本平台的沙箱会拦下它）。测试检查的是 `event.defaultPrevented`。
:::

:::variant{kind=alt name=separate-states}
```tsx file=NewTaskForm.tsx
import { useState, type SubmitEvent } from 'react';

export type Priority = 'low' | 'normal' | 'high';
export type NewTask = { title: string; priority: Priority; pinned: boolean };

const PRIORITIES: readonly Priority[] = ['low', 'normal', 'high'];

export function NewTaskForm({ onAdd }: { onAdd: (task: NewTask) => void }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [pinned, setPinned] = useState(false);
  const [showError, setShowError] = useState(false);

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = title.trim();
    setShowError(text === '');
    if (text === '') return;
    onAdd({ title: text, priority, pinned });
    setTitle('');
    setPriority('normal');
    setPinned(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="title">标题</label>
      <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
      {showError ? <p role="alert">请输入标题</p> : null}
      <label htmlFor="priority">优先级</label>
      <select
        id="priority"
        value={priority}
        onChange={(e) => {
          const found = PRIORITIES.find((p) => p === e.target.value);
          if (found !== undefined) setPriority(found);
        }}
      >
        <option value="low">低</option>
        <option value="normal">普通</option>
        <option value="high">高</option>
      </select>
      <label>
        <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> 置顶
      </label>
      <button type="submit">添加</button>
    </form>
  );
}
```
:::

:::variant{kind=wrong name=no-reset fails=tests reason="提交之后没有清空表单"}
```tsx file=NewTaskForm.tsx
import { useState, type ChangeEvent, type SubmitEvent } from 'react';

export type Priority = 'low' | 'normal' | 'high';
export type NewTask = { title: string; priority: Priority; pinned: boolean };

type Form = NewTask;

const EMPTY: Form = { title: '', priority: 'normal', pinned: false };

function isPriority(value: string): value is Priority {
  return value === 'low' || value === 'normal' || value === 'high';
}

export function NewTaskForm({ onAdd }: { onAdd: (task: NewTask) => void }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handlePriority(e: ChangeEvent<HTMLSelectElement>) {
    const value = e.currentTarget.value;
    if (isPriority(value)) update('priority', value);
  }

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const title = form.title.trim();
    if (title === '') {
      setError('请输入标题');
      return;
    }
    onAdd({ ...form, title });
    setError(null);
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="title">标题</label>
      <input id="title" value={form.title} onChange={(e) => update('title', e.currentTarget.value)} />
      {error !== null && <p role="alert">{error}</p>}
      <label htmlFor="priority">优先级</label>
      <select id="priority" value={form.priority} onChange={handlePriority}>
        <option value="low">低</option>
        <option value="normal">普通</option>
        <option value="high">高</option>
      </select>
      <label>
        <input type="checkbox" checked={form.pinned} onChange={(e) => update('pinned', e.currentTarget.checked)} /> 置顶
      </label>
      <button type="submit">添加</button>
    </form>
  );
}
```
:::

:::variant{kind=wrong name=no-trim fails=tests reason="没有去掉标题首尾的空白，只有空格的标题也被提交了"}
```tsx file=NewTaskForm.tsx
import { useState, type ChangeEvent, type SubmitEvent } from 'react';

export type Priority = 'low' | 'normal' | 'high';
export type NewTask = { title: string; priority: Priority; pinned: boolean };

type Form = NewTask;

const EMPTY: Form = { title: '', priority: 'normal', pinned: false };

function isPriority(value: string): value is Priority {
  return value === 'low' || value === 'normal' || value === 'high';
}

export function NewTaskForm({ onAdd }: { onAdd: (task: NewTask) => void }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handlePriority(e: ChangeEvent<HTMLSelectElement>) {
    const value = e.currentTarget.value;
    if (isPriority(value)) update('priority', value);
  }

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (form.title === '') {
      setError('请输入标题');
      return;
    }
    onAdd(form);
    setForm(EMPTY);
    setError(null);
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="title">标题</label>
      <input id="title" value={form.title} onChange={(e) => update('title', e.currentTarget.value)} />
      {error !== null && <p role="alert">{error}</p>}
      <label htmlFor="priority">优先级</label>
      <select id="priority" value={form.priority} onChange={handlePriority}>
        <option value="low">低</option>
        <option value="normal">普通</option>
        <option value="high">高</option>
      </select>
      <label>
        <input type="checkbox" checked={form.pinned} onChange={(e) => update('pinned', e.currentTarget.checked)} /> 置顶
      </label>
      <button type="submit">添加</button>
    </form>
  );
}
```
:::

:::variant{kind=wrong name=assert-priority fails=rules reason="用类型断言把 string 当成 Priority"}
```tsx file=NewTaskForm.tsx
import { useState, type ChangeEvent, type SubmitEvent } from 'react';

export type Priority = 'low' | 'normal' | 'high';
export type NewTask = { title: string; priority: Priority; pinned: boolean };

type Form = NewTask;

const EMPTY: Form = { title: '', priority: 'normal', pinned: false };

function isPriority(value: string): value is Priority {
  return value === 'low' || value === 'normal' || value === 'high';
}

export function NewTaskForm({ onAdd }: { onAdd: (task: NewTask) => void }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handlePriority(e: ChangeEvent<HTMLSelectElement>) {
    update('priority', e.currentTarget.value as Priority);
  }

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const title = form.title.trim();
    if (title === '') {
      setError('请输入标题');
      return;
    }
    onAdd({ ...form, title });
    setForm(EMPTY);
    setError(null);
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="title">标题</label>
      <input id="title" value={form.title} onChange={(e) => update('title', e.currentTarget.value)} />
      {error !== null && <p role="alert">{error}</p>}
      <label htmlFor="priority">优先级</label>
      <select id="priority" value={form.priority} onChange={handlePriority}>
        <option value="low">低</option>
        <option value="normal">普通</option>
        <option value="high">高</option>
      </select>
      <label>
        <input type="checkbox" checked={form.pinned} onChange={(e) => update('pinned', e.currentTarget.checked)} /> 置顶
      </label>
      <button type="submit">添加</button>
    </form>
  );
}
```
:::

:::variant{kind=wrong name=checkbox-value fails=tests reason="复选框读取了 value 而不是 checked"}
```tsx file=NewTaskForm.tsx
import { useState, type ChangeEvent, type SubmitEvent } from 'react';

export type Priority = 'low' | 'normal' | 'high';
export type NewTask = { title: string; priority: Priority; pinned: boolean };

type Form = NewTask;

const EMPTY: Form = { title: '', priority: 'normal', pinned: false };

function isPriority(value: string): value is Priority {
  return value === 'low' || value === 'normal' || value === 'high';
}

export function NewTaskForm({ onAdd }: { onAdd: (task: NewTask) => void }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handlePriority(e: ChangeEvent<HTMLSelectElement>) {
    const value = e.currentTarget.value;
    if (isPriority(value)) update('priority', value);
  }

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const title = form.title.trim();
    if (title === '') {
      setError('请输入标题');
      return;
    }
    onAdd({ ...form, title });
    setForm(EMPTY);
    setError(null);
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="title">标题</label>
      <input id="title" value={form.title} onChange={(e) => update('title', e.currentTarget.value)} />
      {error !== null && <p role="alert">{error}</p>}
      <label htmlFor="priority">优先级</label>
      <select id="priority" value={form.priority} onChange={handlePriority}>
        <option value="low">低</option>
        <option value="normal">普通</option>
        <option value="high">高</option>
      </select>
      <label>
        <input type="checkbox" checked={form.pinned} onChange={(e) => update('pinned', e.currentTarget.value === 'on')} /> 置顶
      </label>
      <button type="submit">添加</button>
    </form>
  );
}
```
:::

:::variant{kind=wrong name=no-prevent-default fails=tests reason="没有阻止表单的默认提交行为"}
```tsx file=NewTaskForm.tsx
import { useState, type ChangeEvent, type SubmitEvent } from 'react';

export type Priority = 'low' | 'normal' | 'high';
export type NewTask = { title: string; priority: Priority; pinned: boolean };

type Form = NewTask;

const EMPTY: Form = { title: '', priority: 'normal', pinned: false };

function isPriority(value: string): value is Priority {
  return value === 'low' || value === 'normal' || value === 'high';
}

export function NewTaskForm({ onAdd }: { onAdd: (task: NewTask) => void }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handlePriority(e: ChangeEvent<HTMLSelectElement>) {
    const value = e.currentTarget.value;
    if (isPriority(value)) update('priority', value);
  }

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    const title = form.title.trim();
    if (title === '') {
      setError('请输入标题');
      return;
    }
    onAdd({ ...form, title });
    setForm(EMPTY);
    setError(null);
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="title">标题</label>
      <input id="title" value={form.title} onChange={(e) => update('title', e.currentTarget.value)} />
      {error !== null && <p role="alert">{error}</p>}
      <label htmlFor="priority">优先级</label>
      <select id="priority" value={form.priority} onChange={handlePriority}>
        <option value="low">低</option>
        <option value="normal">普通</option>
        <option value="high">高</option>
      </select>
      <label>
        <input type="checkbox" checked={form.pinned} onChange={(e) => update('pinned', e.currentTarget.checked)} /> 置顶
      </label>
      <button type="submit">添加</button>
    </form>
  );
}
```
:::
