---
kind: challenge
mode: react
title: 用 useActionState 提交表单
timeoutMs: 30000
---
在 `todo-form.tsx` 中完成 `TodoForm`。`action` 是一个 Server Function（这里用普通的异步函数代替）：它收到上一次的状态和表单数据，返回新的状态（类型在只读的 `state.ts` 中）。要求：

1. 用 `useActionState(action, initialState)` 连接表单：`<form action={…}>`，表单的可访问名称是“新建待办”。两个输入框：标签是“标题”（`name="title"`）和“截止日期”（`name="due"`，`type="date"`）；一个提交按钮；
2. **提交期间**：按钮 `disabled`，文字是“保存中…”；其他时候文字是“保存”；
3. **显示的值**：两个输入框都不受控，`defaultValue` 是 `state.values` 中对应的值。React 在 action 完成之后会**重置表单**，输入框回到 `defaultValue`：这样出错时显示的是 action 返回的值（通常就是用户提交的值），保存成功时被清空；
4. **字段错误**：`state.errors` 中有某个字段的错误时，这个输入框加上 `aria-invalid="true"`，`aria-describedby` 指向显示这条错误信息的元素；没有错误时不加这两个属性，也不显示错误信息；
5. **焦点**：状态变成 `'error'` 时，焦点移到第一个出错的字段（标题在前，截止日期在后）；
6. **消息**：一个 `role="status"` 的元素一直存在，内容是 `state.message`。

`main.tsx` 中的预览用一个等 600 毫秒的函数模拟服务器：标题为空、或者截止日期早于 2026 年时返回错误。

:::files{role=starter}
```tsx file=todo-form.tsx
import type { SaveAction } from './state';

export function TodoForm({ action }: { action: SaveAction }) {
  // TODO：用 useActionState 连接 action，显示字段错误、提交中的状态和消息
  void action;
  return (
    <form aria-label="新建待办" onSubmit={(event) => event.preventDefault()}>
      <label>
        标题
        <input name="title" />
      </label>
      <label>
        截止日期
        <input name="due" type="date" />
      </label>
      <button type="submit">保存</button>
    </form>
  );
}
```
```ts file=state.ts readonly
/** Server Function 返回给表单的状态：useActionState 把它交给下一次调用，也用它渲染表单 */
export type FormState = Readonly<{
  status: 'idle' | 'error' | 'saved';
  message: string;
  errors: Readonly<Partial<Record<'title' | 'due', string>>>;
  /** 表单中应该显示的值：出错时是用户提交的值，保存成功时是空的 */
  values: Readonly<{ title: string; due: string }>;
}>;

export type SaveAction = (previous: FormState, formData: FormData) => Promise<FormState>;

export const initialState: FormState = { status: 'idle', message: '', errors: {}, values: { title: '', due: '' } };
```
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import type { SaveAction } from './state';
import { TodoForm } from './todo-form';

// 这个预览没有服务器：用一个等待 600 毫秒的函数代替 Server Function
const saveTodo: SaveAction = async (_previous, formData) => {
  await new Promise((resolve) => setTimeout(resolve, 600));
  const title = String(formData.get('title') ?? '');
  const due = String(formData.get('due') ?? '');
  const errors: { title?: string; due?: string } = {};
  if (title.trim() === '') errors.title = '请填写标题';
  if (due !== '' && due < '2026-01-01') errors.due = '截止日期不能早于 2026 年';
  if (errors.title !== undefined || errors.due !== undefined) {
    return { status: 'error', message: '请检查标红的字段', errors, values: { title, due } };
  }
  return { status: 'saved', message: `已保存：${title.trim()}`, errors: {}, values: { title: '', due: '' } };
};

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<TodoForm action={saveTodo} />);
```
:::

:::files{role=solution}
```tsx file=todo-form.tsx
import { useActionState, useEffect, useId, useRef } from 'react';
import { initialState, type SaveAction } from './state';

export function TodoForm({ action }: { action: SaveAction }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const id = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const dueRef = useRef<HTMLInputElement>(null);
  const { errors, values } = state;

  // 出错之后，焦点移到第一个出错的字段
  useEffect(() => {
    if (state.status !== 'error') return;
    if (state.errors.title !== undefined) titleRef.current?.focus();
    else if (state.errors.due !== undefined) dueRef.current?.focus();
  }, [state]);

  return (
    <form action={formAction} aria-label="新建待办">
      <label>
        标题
        {/* 提交之后 React 会重置表单，输入框回到 defaultValue：用返回的值，用户输入的内容才不会丢 */}
        <input
          ref={titleRef}
          name="title"
          defaultValue={values.title}
          aria-invalid={errors.title !== undefined ? true : undefined}
          aria-describedby={errors.title !== undefined ? `${id}-title` : undefined}
        />
      </label>
      {errors.title !== undefined && <p id={`${id}-title`}>{errors.title}</p>}
      <label>
        截止日期
        <input
          ref={dueRef}
          name="due"
          type="date"
          defaultValue={values.due}
          aria-invalid={errors.due !== undefined ? true : undefined}
          aria-describedby={errors.due !== undefined ? `${id}-due` : undefined}
        />
      </label>
      {errors.due !== undefined && <p id={`${id}-due`}>{errors.due}</p>}
      <button type="submit" disabled={pending}>
        {pending ? '保存中…' : '保存'}
      </button>
      <p role="status">{state.message}</p>
    </form>
  );
}
```
:::

:::files{role=tests}
```tsx file=todo-form.test.tsx
import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TodoForm } from './todo-form';
import { initialState, type FormState, type SaveAction } from './state';

/** 一个由测试决定什么时候完成的 Promise */
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const titleInput = () => screen.getByRole('textbox', { name: '标题' });
const dueInput = () => screen.getByLabelText('截止日期');
const saveButton = () => screen.getByRole('button', { name: /^保存/ });

const saved = (message: string): FormState => ({ status: 'saved', message, errors: {}, values: { title: '', due: '' } });
const failed = (errors: FormState['errors'], values: FormState['values']): FormState => ({ status: 'error', message: '请检查标红的字段', errors, values });

function setup(action: SaveAction) {
  render(<TodoForm action={action} />);
  return userEvent.setup();
}

describe('TodoForm', () => {
  test('一开始：空的表单，没有错误，按钮可用', () => {
    setup(vi.fn(async () => initialState));
    expect(screen.getByRole('form', { name: '新建待办' })).toBeInTheDocument();
    expect(titleInput()).toHaveValue('');
    expect(titleInput()).not.toHaveAttribute('aria-invalid');
    expect(dueInput()).toHaveAttribute('type', 'date');
    expect(saveButton()).toHaveTextContent('保存');
    expect(saveButton()).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent(/^$/);
  });

  test('提交时把上一次的状态和表单数据交给 action', async () => {
    const action = vi.fn(async (_previous: FormState, formData: FormData) => saved(`已保存：${String(formData.get('title'))}`));
    const user = setup(action);
    await user.type(titleInput(), '买牛奶');
    fireEvent.change(dueInput(), { target: { value: '2026-10-31' } });
    await user.click(saveButton());
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('已保存：买牛奶'));
    const [previous, formData] = action.mock.calls[0] ?? [];
    expect(previous).toStrictEqual(initialState);
    expect(formData?.get('title')).toBe('买牛奶');
    expect(formData?.get('due')).toBe('2026-10-31');

    await user.type(titleInput(), '写周报');
    await user.click(saveButton());
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    expect(action.mock.calls[1]?.[0]).toStrictEqual(saved('已保存：买牛奶'));
  });

  test('提交期间按钮不可用，文字是“保存中…”', async () => {
    const pending = deferred<FormState>();
    const user = setup(() => pending.promise);
    await user.type(titleInput(), 'a');
    await user.click(saveButton());
    await waitFor(() => expect(saveButton()).toBeDisabled());
    expect(saveButton()).toHaveTextContent('保存中…');
    pending.resolve(saved('已保存：a'));
    await waitFor(() => expect(saveButton()).toBeEnabled());
    expect(saveButton()).toHaveTextContent(/^保存$/);
  });

  test('字段错误：标红、说明错误、焦点移到出错的字段，输入的内容保留', async () => {
    const long = '很长的标题'.repeat(30);
    const user = setup(async () => failed({ title: '标题最多 100 个字' }, { title: long, due: '2026-10-31' }));
    await user.click(titleInput());
    await user.paste(long);
    fireEvent.change(dueInput(), { target: { value: '2026-10-31' } });
    await user.click(saveButton());
    await waitFor(() => expect(titleInput()).toHaveAttribute('aria-invalid', 'true'));
    expect(titleInput()).toHaveAccessibleDescription('标题最多 100 个字');
    await waitFor(() => expect(titleInput()).toHaveFocus());
    expect(titleInput()).toHaveValue(long);
    expect(dueInput()).toHaveValue('2026-10-31');
    expect(dueInput()).not.toHaveAttribute('aria-invalid');
    expect(screen.getByRole('status')).toHaveTextContent('请检查标红的字段');
  });

  test('显示的是 action 返回的值：React 在提交之后会重置表单', async () => {
    const user = setup(async () => failed({ due: '截止日期不能早于今天' }, { title: '服务器整理过的标题', due: '2020-01-01' }));
    await user.type(titleInput(), '  原来的标题  ');
    await user.click(saveButton());
    await waitFor(() => expect(titleInput()).toHaveValue('服务器整理过的标题'));
    expect(dueInput()).toHaveValue('2020-01-01');
  });

  test('只有截止日期出错：焦点移到截止日期，标题不标红', async () => {
    const user = setup(async () => failed({ due: '截止日期不能早于今天' }, { title: '买牛奶', due: '2020-01-01' }));
    await user.type(titleInput(), '买牛奶');
    await user.click(saveButton());
    await waitFor(() => expect(dueInput()).toHaveFocus());
    expect(dueInput()).toHaveAttribute('aria-invalid', 'true');
    expect(dueInput()).toHaveAccessibleDescription('截止日期不能早于今天');
    expect(titleInput()).not.toHaveAttribute('aria-invalid');
  });

  test('保存成功：清空表单，错误消失，显示消息', async () => {
    const results = [failed({ title: '请填写标题' }, { title: '', due: '' }), saved('已保存：买牛奶')];
    const user = setup(async () => results.shift() ?? initialState);
    await user.click(saveButton());
    await waitFor(() => expect(titleInput()).toHaveAttribute('aria-invalid', 'true'));
    await user.type(titleInput(), '买牛奶');
    await user.click(saveButton());
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('已保存：买牛奶'));
    expect(titleInput()).toHaveValue('');
    expect(titleInput()).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText('请填写标题')).not.toBeInTheDocument();
  });
});
```
:::

:::hint{level=1}
`const [state, formAction, pending] = useActionState(action, initialState)`，把 `formAction` 交给 `<form action>`。`state.errors.title` 有值时渲染一个带 `id` 的 `<p>`，输入框的 `aria-describedby` 就是这个 `id`（用 `useId()` 生成，避免一个页面中有两个表单时重复）。
:::

:::hint{level=2}
焦点放在 effect 中：`useEffect(() => { if (state.status === 'error') … }, [state])`，用两个 `useRef` 拿到输入框。每次 action 完成都会得到一个新的 `state` 对象，即使两次的错误相同，effect 也会再运行一次。
:::

:::explanation
`useActionState` 把“提交 → 等待 → 结果”这件事交给了 React：`pending` 是提交中的状态，`state` 是 action 最近一次返回的值，下一次调用 action 时它又作为第一个参数传回去。和 p2-04 的 `useFetcher` 一样，它让表单在没有 JavaScript 时也能工作：表单是一个真正的 `<form>`，正文中实测，服务端组件中的这种表单不运行 JavaScript 也能提交。

最容易出错的是第 3 条。React 19 在 action 完成之后会重置表单，正文中实测：没有 `defaultValue` 的输入框在出错之后被清空了，用户要重新输入一遍。解决的办法不是改成受控的输入框，而是让 action 把需要显示的值放进返回的状态，再作为 `defaultValue`：出错时显示用户提交的值，保存成功时显示空的。服务器也可以借这个机会返回整理过的值（例如去掉了首尾的空白）。

错误的可访问性和 g15、p2-03 中的一样：`aria-invalid` 让输入框被读作“无效”，`aria-describedby` 让它的说明就是错误信息，焦点移过去，用户马上知道要改哪里。一直存在的 `role="status"` 区域保证屏幕阅读器能听到“已保存”。

替代解把“标签、输入框、错误信息”抽成一个 `Field` 组件，每个字段自己生成错误信息的 `id`。
:::

:::variant{kind=alt name=field-component}
```tsx file=todo-form.tsx
import { useActionState, useEffect, useId, useRef, type Ref } from 'react';
import { initialState, type SaveAction } from './state';

/** 一个带标签和错误信息的输入框 */
function Field(props: { label: string; name: string; type?: string; defaultValue: string; error: string | undefined; inputRef: Ref<HTMLInputElement> }) {
  const errorId = useId();
  const invalid = props.error !== undefined;
  return (
    <div>
      <label>
        {props.label}
        <input
          ref={props.inputRef}
          name={props.name}
          type={props.type ?? 'text'}
          defaultValue={props.defaultValue}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
        />
      </label>
      {invalid && <p id={errorId}>{props.error}</p>}
    </div>
  );
}

export function TodoForm({ action }: { action: SaveAction }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const titleRef = useRef<HTMLInputElement>(null);
  const dueRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.status !== 'error') return;
    // 按字段在表单中的顺序找第一个出错的
    const first = [
      { error: state.errors.title, ref: titleRef },
      { error: state.errors.due, ref: dueRef },
    ].find((field) => field.error !== undefined);
    first?.ref.current?.focus();
  }, [state]);

  return (
    <form action={formAction} aria-label="新建待办">
      <Field label="标题" name="title" defaultValue={state.values.title} error={state.errors.title} inputRef={titleRef} />
      <Field label="截止日期" name="due" type="date" defaultValue={state.values.due} error={state.errors.due} inputRef={dueRef} />
      <button type="submit" disabled={pending}>
        {pending ? '保存中…' : '保存'}
      </button>
      <p role="status">{state.message}</p>
    </form>
  );
}
```
:::

:::variant{kind=wrong name=no-default-value fails=tests reason="输入框没有用 state.values 作为 defaultValue：React 在提交之后重置了表单，用户输入的内容丢了"}
```tsx file=todo-form.tsx
import { useActionState, useEffect, useId, useRef } from 'react';
import { initialState, type SaveAction } from './state';

export function TodoForm({ action }: { action: SaveAction }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const id = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const dueRef = useRef<HTMLInputElement>(null);
  const { errors, values } = state;

  // 出错之后，焦点移到第一个出错的字段
  useEffect(() => {
    if (state.status !== 'error') return;
    if (state.errors.title !== undefined) titleRef.current?.focus();
    else if (state.errors.due !== undefined) dueRef.current?.focus();
  }, [state]);

  return (
    <form action={formAction} aria-label="新建待办">
      <label>
        标题
        {/* 提交之后 React 会重置表单，输入框回到 defaultValue：用返回的值，用户输入的内容才不会丢 */}
        <input
          ref={titleRef}
          name="title"
          aria-invalid={errors.title !== undefined ? true : undefined}
          aria-describedby={errors.title !== undefined ? `${id}-title` : undefined}
        />
      </label>
      {errors.title !== undefined && <p id={`${id}-title`}>{errors.title}</p>}
      <label>
        截止日期
        <input
          ref={dueRef}
          name="due"
          type="date"
          aria-invalid={errors.due !== undefined ? true : undefined}
          aria-describedby={errors.due !== undefined ? `${id}-due` : undefined}
        />
      </label>
      {errors.due !== undefined && <p id={`${id}-due`}>{errors.due}</p>}
      <button type="submit" disabled={pending}>
        {pending ? '保存中…' : '保存'}
      </button>
      <p role="status">{state.message}</p>
    </form>
  );
}
```
:::

:::variant{kind=wrong name=no-describedby fails=tests reason="错误信息没有用 aria-describedby 和输入框关联：屏幕阅读器的用户不知道哪里错了"}
```tsx file=todo-form.tsx
import { useActionState, useEffect, useId, useRef } from 'react';
import { initialState, type SaveAction } from './state';

export function TodoForm({ action }: { action: SaveAction }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const id = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const dueRef = useRef<HTMLInputElement>(null);
  const { errors, values } = state;

  // 出错之后，焦点移到第一个出错的字段
  useEffect(() => {
    if (state.status !== 'error') return;
    if (state.errors.title !== undefined) titleRef.current?.focus();
    else if (state.errors.due !== undefined) dueRef.current?.focus();
  }, [state]);

  return (
    <form action={formAction} aria-label="新建待办">
      <label>
        标题
        {/* 提交之后 React 会重置表单，输入框回到 defaultValue：用返回的值，用户输入的内容才不会丢 */}
        <input
          ref={titleRef}
          name="title"
          defaultValue={values.title}
          aria-invalid={errors.title !== undefined ? true : undefined}
        />
      </label>
      {errors.title !== undefined && <p id={`${id}-title`}>{errors.title}</p>}
      <label>
        截止日期
        <input
          ref={dueRef}
          name="due"
          type="date"
          defaultValue={values.due}
          aria-invalid={errors.due !== undefined ? true : undefined}
        />
      </label>
      {errors.due !== undefined && <p id={`${id}-due`}>{errors.due}</p>}
      <button type="submit" disabled={pending}>
        {pending ? '保存中…' : '保存'}
      </button>
      <p role="status">{state.message}</p>
    </form>
  );
}
```
:::

:::variant{kind=wrong name=enabled-while-pending fails=tests reason="提交期间按钮仍然可用：用户可以连着提交好几次"}
```tsx file=todo-form.tsx
import { useActionState, useEffect, useId, useRef } from 'react';
import { initialState, type SaveAction } from './state';

export function TodoForm({ action }: { action: SaveAction }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const id = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const dueRef = useRef<HTMLInputElement>(null);
  const { errors, values } = state;

  // 出错之后，焦点移到第一个出错的字段
  useEffect(() => {
    if (state.status !== 'error') return;
    if (state.errors.title !== undefined) titleRef.current?.focus();
    else if (state.errors.due !== undefined) dueRef.current?.focus();
  }, [state]);

  return (
    <form action={formAction} aria-label="新建待办">
      <label>
        标题
        {/* 提交之后 React 会重置表单，输入框回到 defaultValue：用返回的值，用户输入的内容才不会丢 */}
        <input
          ref={titleRef}
          name="title"
          defaultValue={values.title}
          aria-invalid={errors.title !== undefined ? true : undefined}
          aria-describedby={errors.title !== undefined ? `${id}-title` : undefined}
        />
      </label>
      {errors.title !== undefined && <p id={`${id}-title`}>{errors.title}</p>}
      <label>
        截止日期
        <input
          ref={dueRef}
          name="due"
          type="date"
          defaultValue={values.due}
          aria-invalid={errors.due !== undefined ? true : undefined}
          aria-describedby={errors.due !== undefined ? `${id}-due` : undefined}
        />
      </label>
      {errors.due !== undefined && <p id={`${id}-due`}>{errors.due}</p>}
      <button type="submit">
        {pending ? '保存中…' : '保存'}
      </button>
      <p role="status">{state.message}</p>
    </form>
  );
}
```
:::

:::variant{kind=wrong name=focus-title-always fails=tests reason="出错时总是把焦点移到标题：只有截止日期出错时，焦点去了一个没有错的字段"}
```tsx file=todo-form.tsx
import { useActionState, useEffect, useId, useRef } from 'react';
import { initialState, type SaveAction } from './state';

export function TodoForm({ action }: { action: SaveAction }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const id = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const dueRef = useRef<HTMLInputElement>(null);
  const { errors, values } = state;

  // 出错之后，焦点移到第一个出错的字段
  useEffect(() => {
    if (state.status !== 'error') return;
    titleRef.current?.focus();
  }, [state]);

  return (
    <form action={formAction} aria-label="新建待办">
      <label>
        标题
        {/* 提交之后 React 会重置表单，输入框回到 defaultValue：用返回的值，用户输入的内容才不会丢 */}
        <input
          ref={titleRef}
          name="title"
          defaultValue={values.title}
          aria-invalid={errors.title !== undefined ? true : undefined}
          aria-describedby={errors.title !== undefined ? `${id}-title` : undefined}
        />
      </label>
      {errors.title !== undefined && <p id={`${id}-title`}>{errors.title}</p>}
      <label>
        截止日期
        <input
          ref={dueRef}
          name="due"
          type="date"
          defaultValue={values.due}
          aria-invalid={errors.due !== undefined ? true : undefined}
          aria-describedby={errors.due !== undefined ? `${id}-due` : undefined}
        />
      </label>
      {errors.due !== undefined && <p id={`${id}-due`}>{errors.due}</p>}
      <button type="submit" disabled={pending}>
        {pending ? '保存中…' : '保存'}
      </button>
      <p role="status">{state.message}</p>
    </form>
  );
}
```
:::

:::variant{kind=wrong name=status-on-error-only fails=tests reason="只在出错时显示状态：保存成功的消息没有显示，屏幕阅读器也听不到"}
```tsx file=todo-form.tsx
import { useActionState, useEffect, useId, useRef } from 'react';
import { initialState, type SaveAction } from './state';

export function TodoForm({ action }: { action: SaveAction }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const id = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const dueRef = useRef<HTMLInputElement>(null);
  const { errors, values } = state;

  // 出错之后，焦点移到第一个出错的字段
  useEffect(() => {
    if (state.status !== 'error') return;
    if (state.errors.title !== undefined) titleRef.current?.focus();
    else if (state.errors.due !== undefined) dueRef.current?.focus();
  }, [state]);

  return (
    <form action={formAction} aria-label="新建待办">
      <label>
        标题
        {/* 提交之后 React 会重置表单，输入框回到 defaultValue：用返回的值，用户输入的内容才不会丢 */}
        <input
          ref={titleRef}
          name="title"
          defaultValue={values.title}
          aria-invalid={errors.title !== undefined ? true : undefined}
          aria-describedby={errors.title !== undefined ? `${id}-title` : undefined}
        />
      </label>
      {errors.title !== undefined && <p id={`${id}-title`}>{errors.title}</p>}
      <label>
        截止日期
        <input
          ref={dueRef}
          name="due"
          type="date"
          defaultValue={values.due}
          aria-invalid={errors.due !== undefined ? true : undefined}
          aria-describedby={errors.due !== undefined ? `${id}-due` : undefined}
        />
      </label>
      {errors.due !== undefined && <p id={`${id}-due`}>{errors.due}</p>}
      <button type="submit" disabled={pending}>
        {pending ? '保存中…' : '保存'}
      </button>
      {state.status === 'error' && <p role="status">{state.message}</p>}
    </form>
  );
}
```
:::

