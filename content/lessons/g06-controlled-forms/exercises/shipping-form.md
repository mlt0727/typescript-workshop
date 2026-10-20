---
kind: challenge
title: 带校验的收货表单
---
完成 `ShippingForm`。`validate(form)`、`parseQuantity(text)` 和几个常量已经写好，直接使用。

**字段**（都要受控）：收件人、手机号、数量（`type="number"`，state 中存字符串，初始为 `'1'`）、配送方式（两个单选框，初始为标准配送）、备注（多行文本）。

**实时显示**：

- 备注下面的 `<span id="note-count">` 显示 `还可以输入 N 字`（N = 100 − 备注的长度，可以是负数）；
- `<output aria-label="合计">` 显示合计：数量合法时为 `¥` + (单价 × 数量 + 加急的 12 元) 保留两位小数，否则为 `—`。

**提交**（阻止默认行为）：

1. 第一次点“提交订单”之前，不显示任何错误；
2. 校验不通过时不调用 `onSubmit`，把**焦点移到第一个出错的字段**（按收件人、手机号、数量、备注的顺序；字段名也是输入框的 `id`，可以用 `document.getElementById`），并且从此以后（直到提交成功）实时显示错误：每个出错的字段，在输入框后面显示 `<p id="字段名-error" class="error">错误信息</p>`，输入框加上 `aria-invalid="true"` 和 `aria-describedby="字段名-error"`；备注的 `aria-describedby` 始终包含 `note-count`，出错时是 `"note-count note-error"`。字段名就是 `name`、`phone`、`quantity`、`note`；
3. 校验通过时，调用 `onSubmit`，传入整理好的数据：收件人、手机号、备注去掉首尾空白，数量转换成数字；然后把表单恢复成初始状态，并回到“还没有尝试提交”的状态。

:::files{role=starter}
```tsx file=ShippingForm.tsx
import { useState, type SubmitEvent } from 'react';

export type Speed = 'standard' | 'express';
export type ShippingOrder = { name: string; phone: string; quantity: number; speed: Speed; note: string };

type Form = { name: string; phone: string; quantity: string; speed: Speed; note: string };
type Errors = Partial<Record<keyof Form, string>>;

const EMPTY: Form = { name: '', phone: '', quantity: '1', speed: 'standard', note: '' };
const NOTE_LIMIT = 100;
const EXPRESS_FEE = 12;
/** 出错时，焦点移到按这个顺序的第一个出错的字段（字段名也是输入框的 id） */
const FIELD_ORDER = ['name', 'phone', 'quantity', 'note'] as const;

function parseQuantity(text: string): number | null {
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= 1 && n <= 99 ? n : null;
}

export function validate(form: Form): Errors {
  const errors: Errors = {};
  if (form.name.trim() === '') errors.name = '请填写收件人';
  if (!/^1\d{10}$/.test(form.phone.trim())) errors.phone = '请填写 11 位手机号';
  if (parseQuantity(form.quantity) === null) errors.quantity = '数量必须是 1 到 99 之间的整数';
  if (form.note.length > NOTE_LIMIT) errors.note = `备注不能超过 ${NOTE_LIMIT} 字`;
  return errors;
}

type ShippingFormProps = { unitPrice: number; onSubmit: (order: ShippingOrder) => void };

export function ShippingForm({ unitPrice, onSubmit }: ShippingFormProps) {
  // TODO：受控的字段、合计、提交时校验、显示错误、提交成功后重置
  return (
    <form noValidate>
      <div>
        <label htmlFor="name">收件人</label>
        <input id="name" />
      </div>
      <div>
        <label htmlFor="phone">手机号</label>
        <input id="phone" type="tel" />
      </div>
      <div>
        <label htmlFor="quantity">数量</label>
        <input id="quantity" type="number" defaultValue="1" />
      </div>
      <fieldset>
        <legend>配送方式</legend>
        <label>
          <input type="radio" name="speed" defaultChecked /> 标准配送（免费）
        </label>
        <label>
          <input type="radio" name="speed" /> 加急配送（+¥12）
        </label>
      </fieldset>
      <div>
        <label htmlFor="note">备注</label>
        <textarea id="note" />
      </div>
      <button type="submit">提交订单</button>
    </form>
  );
}
```
:::

:::files{role=support}
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { ShippingForm } from './ShippingForm';

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<ShippingForm unitPrice={39} onSubmit={(order) => console.log('提交：', order)} />);
```
:::

:::files{role=solution}
```tsx file=ShippingForm.tsx
import { useState, type SubmitEvent } from 'react';

export type Speed = 'standard' | 'express';
export type ShippingOrder = { name: string; phone: string; quantity: number; speed: Speed; note: string };

type Form = { name: string; phone: string; quantity: string; speed: Speed; note: string };
type Errors = Partial<Record<keyof Form, string>>;

const EMPTY: Form = { name: '', phone: '', quantity: '1', speed: 'standard', note: '' };
const NOTE_LIMIT = 100;
const EXPRESS_FEE = 12;
/** 出错时，焦点移到按这个顺序的第一个出错的字段（字段名也是输入框的 id） */
const FIELD_ORDER = ['name', 'phone', 'quantity', 'note'] as const;

function parseQuantity(text: string): number | null {
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= 1 && n <= 99 ? n : null;
}

export function validate(form: Form): Errors {
  const errors: Errors = {};
  if (form.name.trim() === '') errors.name = '请填写收件人';
  if (!/^1\d{10}$/.test(form.phone.trim())) errors.phone = '请填写 11 位手机号';
  if (parseQuantity(form.quantity) === null) errors.quantity = '数量必须是 1 到 99 之间的整数';
  if (form.note.length > NOTE_LIMIT) errors.note = `备注不能超过 ${NOTE_LIMIT} 字`;
  return errors;
}

type ShippingFormProps = { unitPrice: number; onSubmit: (order: ShippingOrder) => void };

export function ShippingForm({ unitPrice, onSubmit }: ShippingFormProps) {
  const [form, setForm] = useState(EMPTY);
  const [submitted, setSubmitted] = useState(false);

  const errors = submitted ? validate(form) : {};

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** 输入框上与错误相关的属性 */
  function invalidProps(field: keyof Form) {
    const message = errors[field];
    return message === undefined ? {} : { 'aria-invalid': true, 'aria-describedby': `${field}-error` };
  }

  function errorFor(field: keyof Form) {
    const message = errors[field];
    return message === undefined ? null : (
      <p id={`${field}-error`} className="error">
        {message}
      </p>
    );
  }

  const quantity = parseQuantity(form.quantity);
  const total = quantity === null ? '—' : `¥${(unitPrice * quantity + (form.speed === 'express' ? EXPRESS_FEE : 0)).toFixed(2)}`;

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const quantity = parseQuantity(form.quantity);
    const found = validate(form);
    if (Object.keys(found).length > 0 || quantity === null) {
      setSubmitted(true);
      const first = FIELD_ORDER.find((field) => found[field] !== undefined);
      if (first !== undefined) document.getElementById(first)?.focus();
      return;
    }
    onSubmit({ name: form.name.trim(), phone: form.phone.trim(), quantity, speed: form.speed, note: form.note.trim() });
    setForm(EMPTY);
    setSubmitted(false);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="name">收件人</label>
        <input id="name" value={form.name} onChange={(e) => update('name', e.currentTarget.value)} {...invalidProps('name')} />
        {errorFor('name')}
      </div>
      <div>
        <label htmlFor="phone">手机号</label>
        <input id="phone" type="tel" value={form.phone} onChange={(e) => update('phone', e.currentTarget.value)} {...invalidProps('phone')} />
        {errorFor('phone')}
      </div>
      <div>
        <label htmlFor="quantity">数量</label>
        <input id="quantity" type="number" value={form.quantity} onChange={(e) => update('quantity', e.currentTarget.value)} {...invalidProps('quantity')} />
        {errorFor('quantity')}
      </div>
      <fieldset>
        <legend>配送方式</legend>
        <label>
          <input type="radio" name="speed" checked={form.speed === 'standard'} onChange={() => update('speed', 'standard')} /> 标准配送（免费）
        </label>
        <label>
          <input type="radio" name="speed" checked={form.speed === 'express'} onChange={() => update('speed', 'express')} /> 加急配送（+¥12）
        </label>
      </fieldset>
      <div>
        <label htmlFor="note">备注</label>
        <textarea
          id="note"
          value={form.note}
          onChange={(e) => update('note', e.currentTarget.value)}
          aria-invalid={errors.note !== undefined}
          aria-describedby={errors.note === undefined ? 'note-count' : 'note-count note-error'}
        />
        <span id="note-count">还可以输入 {NOTE_LIMIT - form.note.length} 字</span>
        {errorFor('note')}
      </div>
      <p>
        合计：<output aria-label="合计">{total}</output>
      </p>
      <button type="submit">提交订单</button>
    </form>
  );
}
```
:::

:::files{role=tests}
```tsx file=ShippingForm.test.tsx
import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShippingForm, type ShippingOrder } from './ShippingForm';

function setup() {
  const onSubmit = vi.fn<(order: ShippingOrder) => void>();
  render(<ShippingForm unitPrice={39} onSubmit={onSubmit} />);
  const user = userEvent.setup();
  const field = (label: string) => screen.getByLabelText(label);
  const total = () => screen.getByRole('status', { name: '合计' });
  const submit = () => user.click(screen.getByRole('button', { name: '提交订单' }));
  return { onSubmit, user, field, total, submit };
}

function describedBy(el: HTMLElement): string {
  const ids = el.getAttribute('aria-describedby')?.split(' ') ?? [];
  return ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' | ');
}

test('初始状态：没有错误提示，数量为 1，合计按单价计算', () => {
  const { field, total } = setup();
  expect(field('数量')).toHaveValue(1);
  expect(field('标准配送（免费）')).toBeChecked();
  expect(total()).toHaveTextContent('¥39.00');
  expect(screen.getByText('还可以输入 100 字')).toBeInTheDocument();
  expect(document.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0);
  expect(document.querySelectorAll('.error')).toHaveLength(0);
});

test('合计随数量和配送方式变化；数量不合法时显示“—”', async () => {
  const { user, field, total } = setup();
  await user.clear(field('数量'));
  await user.type(field('数量'), '3');
  expect(total()).toHaveTextContent('¥117.00');
  await user.click(field('加急配送（+¥12）'));
  expect(total()).toHaveTextContent('¥129.00');
  await user.clear(field('数量'));
  expect(total()).toHaveTextContent('—');
  await user.type(field('数量'), '100');
  expect(total()).toHaveTextContent('—');
});

test('提交空表单：显示错误并关联到输入框，焦点移到第一个出错的字段，不调用 onSubmit', async () => {
  const { onSubmit, user, field, submit } = setup();
  await submit();
  expect(onSubmit).not.toHaveBeenCalled();
  expect(field('收件人')).toHaveFocus();
  expect(field('收件人')).toHaveAttribute('aria-invalid', 'true');
  expect(describedBy(field('收件人'))).toBe('请填写收件人');
  expect(field('手机号')).toHaveAttribute('aria-invalid', 'true');
  expect(describedBy(field('手机号'))).toBe('请填写 11 位手机号');
  expect(field('数量')).not.toHaveAttribute('aria-invalid', 'true');
  await user.type(field('收件人'), '韩梅梅');
  await submit();
  expect(field('手机号')).toHaveFocus();
});

test('尝试提交之后，错误随输入实时更新', async () => {
  const { user, field, submit } = setup();
  await submit();
  await user.type(field('收件人'), '韩梅梅');
  expect(field('收件人')).not.toHaveAttribute('aria-invalid', 'true');
  expect(screen.queryByText('请填写收件人')).toBeNull();
  await user.type(field('手机号'), '1380013800');
  expect(screen.getByText('请填写 11 位手机号')).toBeInTheDocument();
  await user.type(field('手机号'), '0');
  expect(screen.queryByText('请填写 11 位手机号')).toBeNull();
});

test('备注：剩余字数，超过 100 字时提交报错', async () => {
  const { onSubmit, user, field, submit } = setup();
  await user.type(field('收件人'), '李雷');
  await user.type(field('手机号'), '13800138000');
  await user.click(field('备注'));
  await user.paste('好'.repeat(101));
  expect(screen.getByText('还可以输入 -1 字')).toBeInTheDocument();
  await submit();
  expect(onSubmit).not.toHaveBeenCalled();
  expect(field('备注')).toHaveAttribute('aria-invalid', 'true');
  expect(describedBy(field('备注'))).toBe('还可以输入 -1 字 | 备注不能超过 100 字');
});

test('合法时提交整理好的数据，然后重置表单（包括“还没有尝试提交”的状态）', async () => {
  const { onSubmit, user, field, total, submit } = setup();
  await submit();
  await user.type(field('收件人'), '  韩梅梅 ');
  await user.type(field('手机号'), ' 13800138000 ');
  await user.clear(field('数量'));
  await user.type(field('数量'), '2');
  await user.click(field('加急配送（+¥12）'));
  await user.type(field('备注'), ' 放门口 ');
  await submit();
  expect(onSubmit).toHaveBeenCalledWith({ name: '韩梅梅', phone: '13800138000', quantity: 2, speed: 'express', note: '放门口' });
  expect(field('收件人')).toHaveValue('');
  expect(field('数量')).toHaveValue(1);
  expect(field('标准配送（免费）')).toBeChecked();
  expect(total()).toHaveTextContent('¥39.00');
  expect(document.querySelectorAll('.error'), '重置之后不应该显示错误').toHaveLength(0);
  expect(document.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0);
  await submit();
  expect(screen.getByText('请填写收件人')).toBeInTheDocument();
});
```
:::

:::hint{level=1}
需要两个 state：表单的内容 `form`，以及“是否已经尝试过提交” `submitted`。错误不用存成 state，每次渲染时算出来：`const errors = submitted ? validate(form) : {}`。合计也一样，从 `form` 算出来。
:::

:::hint{level=2}
可以写两个小函数减少重复：`invalidProps(field)` 在没有错误时返回 `{}`，有错误时返回带有 `'aria-invalid': true` 和 `'aria-describedby'`（值为 `字段名-error`）的对象，在输入框上用 `{...invalidProps('name')}` 展开；`errorFor(field)` 返回错误的 `<p>` 或 `null`。单选框：`checked={form.speed === 'express'}`，`onChange={() => update('speed', 'express')}`。
:::

:::explanation
这道题的关键是分清**哪些东西是 state，哪些可以算出来**：

- state：表单的内容、是否尝试过提交。它们只能由用户的操作改变；
- 算出来的：错误、剩余字数、合计。每次渲染时从 state 计算，永远不会和表单的内容不一致。如果把错误也存成 state，每次输入都要记得重新校验、更新它，很容易漏掉一处。

数量在 state 中存成字符串。用户在编辑过程中常常会把输入框清空、再输入新的数字；如果存成数字，`Number('')` 是 0，输入框会立刻显示 0，没法删干净。存成字符串，转换和校验放到计算合计和提交的时候做。（注意 `type="number"` 的输入框会把 `-`、`1e` 这类还没输完的内容报告成空字符串；数量这类只需要整数的字段，也常用 `type="text"` 配合 `inputMode="numeric"`。）`unitPrice * form.quantity` 这样直接用字符串计算，TypeScript 会报错。

提交失败时把焦点移到第一个出错的字段，键盘和读屏用户就能直接从那里开始修改（d09 讲过同样的做法）。这里输入框一直在页面上，用 `id` 找到它就可以；g09 会讲 React 中更常用的方式：ref。

错误信息用 `aria-describedby` 关联到输入框，读屏软件在用户聚焦输入框时会读出“手机号，无效，请填写 11 位手机号”。`aria-invalid` 只在出错时为 `true`。`noValidate` 关闭了浏览器自带的校验气泡，由我们统一显示错误（d09）。
:::

:::variant{kind=alt name=field-component}
```tsx file=ShippingForm.tsx
import { useState, type ReactNode, type SubmitEvent } from 'react';

export type Speed = 'standard' | 'express';
export type ShippingOrder = { name: string; phone: string; quantity: number; speed: Speed; note: string };

type Form = { name: string; phone: string; quantity: string; speed: Speed; note: string };
type Errors = Partial<Record<keyof Form, string>>;

const EMPTY: Form = { name: '', phone: '', quantity: '1', speed: 'standard', note: '' };
const NOTE_LIMIT = 100;
const EXPRESS_FEE = 12;
/** 出错时，焦点移到按这个顺序的第一个出错的字段（字段名也是输入框的 id） */
const FIELD_ORDER = ['name', 'phone', 'quantity', 'note'] as const;

function parseQuantity(text: string): number | null {
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= 1 && n <= 99 ? n : null;
}

export function validate(form: Form): Errors {
  const errors: Errors = {};
  if (form.name.trim() === '') errors.name = '请填写收件人';
  if (!/^1\d{10}$/.test(form.phone.trim())) errors.phone = '请填写 11 位手机号';
  if (parseQuantity(form.quantity) === null) errors.quantity = '数量必须是 1 到 99 之间的整数';
  if (form.note.length > NOTE_LIMIT) errors.note = `备注不能超过 ${NOTE_LIMIT} 字`;
  return errors;
}

type ShippingFormProps = { unitPrice: number; onSubmit: (order: ShippingOrder) => void };

type InvalidProps = { 'aria-invalid'?: boolean; 'aria-describedby'?: string };
type FieldProps = { id: keyof Form; label: string; error: string | undefined; children: (invalid: InvalidProps) => ReactNode };

function Field({ id, label, error, children }: FieldProps) {
  const invalid: InvalidProps = error === undefined ? {} : { 'aria-invalid': true, 'aria-describedby': `${id}-error` };
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      {children(invalid)}
      {error !== undefined && (
        <p id={`${id}-error`} className="error">
          {error}
        </p>
      )}
    </div>
  );
}

export function ShippingForm({ unitPrice, onSubmit }: ShippingFormProps) {
  const [form, setForm] = useState(EMPTY);
  const [tried, setTried] = useState(false);
  const errors: Errors = tried ? validate(form) : {};
  const quantity = parseQuantity(form.quantity);
  const fee = form.speed === 'express' ? EXPRESS_FEE : 0;

  const set = (key: 'name' | 'phone' | 'quantity' | 'note') => (e: { currentTarget: { value: string } }) => {
    const value = e.currentTarget.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  return (
    <form
      noValidate
      onSubmit={(e: SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        const found = validate(form);
        const first = FIELD_ORDER.find((field) => found[field] !== undefined);
        if (first !== undefined || quantity === null) {
          setTried(true);
          if (first !== undefined) document.getElementById(first)?.focus();
          return;
        }
        onSubmit({ name: form.name.trim(), phone: form.phone.trim(), quantity, speed: form.speed, note: form.note.trim() });
        setForm(EMPTY);
        setTried(false);
      }}
    >
      <Field id="name" label="收件人" error={errors.name}>
        {(invalid) => <input id="name" value={form.name} onChange={set('name')} {...invalid} />}
      </Field>
      <Field id="phone" label="手机号" error={errors.phone}>
        {(invalid) => <input id="phone" type="tel" value={form.phone} onChange={set('phone')} {...invalid} />}
      </Field>
      <Field id="quantity" label="数量" error={errors.quantity}>
        {(invalid) => <input id="quantity" type="number" value={form.quantity} onChange={set('quantity')} {...invalid} />}
      </Field>
      <fieldset>
        <legend>配送方式</legend>
        {(['standard', 'express'] as const).map((speed) => (
          <label key={speed}>
            <input type="radio" name="speed" checked={form.speed === speed} onChange={() => setForm((f) => ({ ...f, speed }))} />{' '}
            {speed === 'standard' ? '标准配送（免费）' : '加急配送（+¥12）'}
          </label>
        ))}
      </fieldset>
      <div>
        <label htmlFor="note">备注</label>
        <textarea
          id="note"
          value={form.note}
          onChange={set('note')}
          aria-invalid={errors.note !== undefined}
          aria-describedby={['note-count', ...(errors.note === undefined ? [] : ['note-error'])].join(' ')}
        />
        <span id="note-count">还可以输入 {NOTE_LIMIT - form.note.length} 字</span>
        {errors.note !== undefined && (
          <p id="note-error" className="error">
            {errors.note}
          </p>
        )}
      </div>
      <p>
        合计：<output aria-label="合计">{quantity === null ? '—' : `¥${(unitPrice * quantity + fee).toFixed(2)}`}</output>
      </p>
      <button type="submit">提交订单</button>
    </form>
  );
}
```
:::

:::variant{kind=wrong name=errors-immediately fails=tests reason="还没有提交就显示了错误"}
```tsx file=ShippingForm.tsx
import { useState, type SubmitEvent } from 'react';

export type Speed = 'standard' | 'express';
export type ShippingOrder = { name: string; phone: string; quantity: number; speed: Speed; note: string };

type Form = { name: string; phone: string; quantity: string; speed: Speed; note: string };
type Errors = Partial<Record<keyof Form, string>>;

const EMPTY: Form = { name: '', phone: '', quantity: '1', speed: 'standard', note: '' };
const NOTE_LIMIT = 100;
const EXPRESS_FEE = 12;
/** 出错时，焦点移到按这个顺序的第一个出错的字段（字段名也是输入框的 id） */
const FIELD_ORDER = ['name', 'phone', 'quantity', 'note'] as const;

function parseQuantity(text: string): number | null {
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= 1 && n <= 99 ? n : null;
}

export function validate(form: Form): Errors {
  const errors: Errors = {};
  if (form.name.trim() === '') errors.name = '请填写收件人';
  if (!/^1\d{10}$/.test(form.phone.trim())) errors.phone = '请填写 11 位手机号';
  if (parseQuantity(form.quantity) === null) errors.quantity = '数量必须是 1 到 99 之间的整数';
  if (form.note.length > NOTE_LIMIT) errors.note = `备注不能超过 ${NOTE_LIMIT} 字`;
  return errors;
}

type ShippingFormProps = { unitPrice: number; onSubmit: (order: ShippingOrder) => void };

export function ShippingForm({ unitPrice, onSubmit }: ShippingFormProps) {
  const [form, setForm] = useState(EMPTY);
  const [submitted, setSubmitted] = useState(false);

  const errors = validate(form);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** 输入框上与错误相关的属性 */
  function invalidProps(field: keyof Form) {
    const message = errors[field];
    return message === undefined ? {} : { 'aria-invalid': true, 'aria-describedby': `${field}-error` };
  }

  function errorFor(field: keyof Form) {
    const message = errors[field];
    return message === undefined ? null : (
      <p id={`${field}-error`} className="error">
        {message}
      </p>
    );
  }

  const quantity = parseQuantity(form.quantity);
  const total = quantity === null ? '—' : `¥${(unitPrice * quantity + (form.speed === 'express' ? EXPRESS_FEE : 0)).toFixed(2)}`;

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const quantity = parseQuantity(form.quantity);
    const found = validate(form);
    if (Object.keys(found).length > 0 || quantity === null) {
      setSubmitted(true);
      const first = FIELD_ORDER.find((field) => found[field] !== undefined);
      if (first !== undefined) document.getElementById(first)?.focus();
      return;
    }
    onSubmit({ name: form.name.trim(), phone: form.phone.trim(), quantity, speed: form.speed, note: form.note.trim() });
    setForm(EMPTY);
    setSubmitted(false);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="name">收件人</label>
        <input id="name" value={form.name} onChange={(e) => update('name', e.currentTarget.value)} {...invalidProps('name')} />
        {errorFor('name')}
      </div>
      <div>
        <label htmlFor="phone">手机号</label>
        <input id="phone" type="tel" value={form.phone} onChange={(e) => update('phone', e.currentTarget.value)} {...invalidProps('phone')} />
        {errorFor('phone')}
      </div>
      <div>
        <label htmlFor="quantity">数量</label>
        <input id="quantity" type="number" value={form.quantity} onChange={(e) => update('quantity', e.currentTarget.value)} {...invalidProps('quantity')} />
        {errorFor('quantity')}
      </div>
      <fieldset>
        <legend>配送方式</legend>
        <label>
          <input type="radio" name="speed" checked={form.speed === 'standard'} onChange={() => update('speed', 'standard')} /> 标准配送（免费）
        </label>
        <label>
          <input type="radio" name="speed" checked={form.speed === 'express'} onChange={() => update('speed', 'express')} /> 加急配送（+¥12）
        </label>
      </fieldset>
      <div>
        <label htmlFor="note">备注</label>
        <textarea
          id="note"
          value={form.note}
          onChange={(e) => update('note', e.currentTarget.value)}
          aria-invalid={errors.note !== undefined}
          aria-describedby={errors.note === undefined ? 'note-count' : 'note-count note-error'}
        />
        <span id="note-count">还可以输入 {NOTE_LIMIT - form.note.length} 字</span>
        {errorFor('note')}
      </div>
      <p>
        合计：<output aria-label="合计">{total}</output>
      </p>
      <button type="submit">提交订单</button>
    </form>
  );
}
```
:::

:::variant{kind=wrong name=no-aria fails=tests reason="只设置了 aria-invalid，没有用 aria-describedby 把错误信息关联到输入框"}
```tsx file=ShippingForm.tsx
import { useState, type SubmitEvent } from 'react';

export type Speed = 'standard' | 'express';
export type ShippingOrder = { name: string; phone: string; quantity: number; speed: Speed; note: string };

type Form = { name: string; phone: string; quantity: string; speed: Speed; note: string };
type Errors = Partial<Record<keyof Form, string>>;

const EMPTY: Form = { name: '', phone: '', quantity: '1', speed: 'standard', note: '' };
const NOTE_LIMIT = 100;
const EXPRESS_FEE = 12;
/** 出错时，焦点移到按这个顺序的第一个出错的字段（字段名也是输入框的 id） */
const FIELD_ORDER = ['name', 'phone', 'quantity', 'note'] as const;

function parseQuantity(text: string): number | null {
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= 1 && n <= 99 ? n : null;
}

export function validate(form: Form): Errors {
  const errors: Errors = {};
  if (form.name.trim() === '') errors.name = '请填写收件人';
  if (!/^1\d{10}$/.test(form.phone.trim())) errors.phone = '请填写 11 位手机号';
  if (parseQuantity(form.quantity) === null) errors.quantity = '数量必须是 1 到 99 之间的整数';
  if (form.note.length > NOTE_LIMIT) errors.note = `备注不能超过 ${NOTE_LIMIT} 字`;
  return errors;
}

type ShippingFormProps = { unitPrice: number; onSubmit: (order: ShippingOrder) => void };

export function ShippingForm({ unitPrice, onSubmit }: ShippingFormProps) {
  const [form, setForm] = useState(EMPTY);
  const [submitted, setSubmitted] = useState(false);

  const errors = submitted ? validate(form) : {};

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** 输入框上与错误相关的属性 */
  function invalidProps(field: keyof Form) {
    const message = errors[field];
    return message === undefined ? {} : { 'aria-invalid': true };
  }

  function errorFor(field: keyof Form) {
    const message = errors[field];
    return message === undefined ? null : (
      <p id={`${field}-error`} className="error">
        {message}
      </p>
    );
  }

  const quantity = parseQuantity(form.quantity);
  const total = quantity === null ? '—' : `¥${(unitPrice * quantity + (form.speed === 'express' ? EXPRESS_FEE : 0)).toFixed(2)}`;

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const quantity = parseQuantity(form.quantity);
    const found = validate(form);
    if (Object.keys(found).length > 0 || quantity === null) {
      setSubmitted(true);
      const first = FIELD_ORDER.find((field) => found[field] !== undefined);
      if (first !== undefined) document.getElementById(first)?.focus();
      return;
    }
    onSubmit({ name: form.name.trim(), phone: form.phone.trim(), quantity, speed: form.speed, note: form.note.trim() });
    setForm(EMPTY);
    setSubmitted(false);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="name">收件人</label>
        <input id="name" value={form.name} onChange={(e) => update('name', e.currentTarget.value)} {...invalidProps('name')} />
        {errorFor('name')}
      </div>
      <div>
        <label htmlFor="phone">手机号</label>
        <input id="phone" type="tel" value={form.phone} onChange={(e) => update('phone', e.currentTarget.value)} {...invalidProps('phone')} />
        {errorFor('phone')}
      </div>
      <div>
        <label htmlFor="quantity">数量</label>
        <input id="quantity" type="number" value={form.quantity} onChange={(e) => update('quantity', e.currentTarget.value)} {...invalidProps('quantity')} />
        {errorFor('quantity')}
      </div>
      <fieldset>
        <legend>配送方式</legend>
        <label>
          <input type="radio" name="speed" checked={form.speed === 'standard'} onChange={() => update('speed', 'standard')} /> 标准配送（免费）
        </label>
        <label>
          <input type="radio" name="speed" checked={form.speed === 'express'} onChange={() => update('speed', 'express')} /> 加急配送（+¥12）
        </label>
      </fieldset>
      <div>
        <label htmlFor="note">备注</label>
        <textarea
          id="note"
          value={form.note}
          onChange={(e) => update('note', e.currentTarget.value)}
          aria-invalid={errors.note !== undefined}
          aria-describedby={errors.note === undefined ? 'note-count' : 'note-count note-error'}
        />
        <span id="note-count">还可以输入 {NOTE_LIMIT - form.note.length} 字</span>
        {errorFor('note')}
      </div>
      <p>
        合计：<output aria-label="合计">{total}</output>
      </p>
      <button type="submit">提交订单</button>
    </form>
  );
}
```
:::

:::variant{kind=wrong name=no-reset fails=tests reason="提交成功后没有重置表单"}
```tsx file=ShippingForm.tsx
import { useState, type SubmitEvent } from 'react';

export type Speed = 'standard' | 'express';
export type ShippingOrder = { name: string; phone: string; quantity: number; speed: Speed; note: string };

type Form = { name: string; phone: string; quantity: string; speed: Speed; note: string };
type Errors = Partial<Record<keyof Form, string>>;

const EMPTY: Form = { name: '', phone: '', quantity: '1', speed: 'standard', note: '' };
const NOTE_LIMIT = 100;
const EXPRESS_FEE = 12;
/** 出错时，焦点移到按这个顺序的第一个出错的字段（字段名也是输入框的 id） */
const FIELD_ORDER = ['name', 'phone', 'quantity', 'note'] as const;

function parseQuantity(text: string): number | null {
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= 1 && n <= 99 ? n : null;
}

export function validate(form: Form): Errors {
  const errors: Errors = {};
  if (form.name.trim() === '') errors.name = '请填写收件人';
  if (!/^1\d{10}$/.test(form.phone.trim())) errors.phone = '请填写 11 位手机号';
  if (parseQuantity(form.quantity) === null) errors.quantity = '数量必须是 1 到 99 之间的整数';
  if (form.note.length > NOTE_LIMIT) errors.note = `备注不能超过 ${NOTE_LIMIT} 字`;
  return errors;
}

type ShippingFormProps = { unitPrice: number; onSubmit: (order: ShippingOrder) => void };

export function ShippingForm({ unitPrice, onSubmit }: ShippingFormProps) {
  const [form, setForm] = useState(EMPTY);
  const [submitted, setSubmitted] = useState(false);

  const errors = submitted ? validate(form) : {};

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** 输入框上与错误相关的属性 */
  function invalidProps(field: keyof Form) {
    const message = errors[field];
    return message === undefined ? {} : { 'aria-invalid': true, 'aria-describedby': `${field}-error` };
  }

  function errorFor(field: keyof Form) {
    const message = errors[field];
    return message === undefined ? null : (
      <p id={`${field}-error`} className="error">
        {message}
      </p>
    );
  }

  const quantity = parseQuantity(form.quantity);
  const total = quantity === null ? '—' : `¥${(unitPrice * quantity + (form.speed === 'express' ? EXPRESS_FEE : 0)).toFixed(2)}`;

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const quantity = parseQuantity(form.quantity);
    if (Object.keys(validate(form)).length > 0 || quantity === null) {
      setSubmitted(true);
      return;
    }
    onSubmit({ name: form.name.trim(), phone: form.phone.trim(), quantity, speed: form.speed, note: form.note.trim() });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="name">收件人</label>
        <input id="name" value={form.name} onChange={(e) => update('name', e.currentTarget.value)} {...invalidProps('name')} />
        {errorFor('name')}
      </div>
      <div>
        <label htmlFor="phone">手机号</label>
        <input id="phone" type="tel" value={form.phone} onChange={(e) => update('phone', e.currentTarget.value)} {...invalidProps('phone')} />
        {errorFor('phone')}
      </div>
      <div>
        <label htmlFor="quantity">数量</label>
        <input id="quantity" type="number" value={form.quantity} onChange={(e) => update('quantity', e.currentTarget.value)} {...invalidProps('quantity')} />
        {errorFor('quantity')}
      </div>
      <fieldset>
        <legend>配送方式</legend>
        <label>
          <input type="radio" name="speed" checked={form.speed === 'standard'} onChange={() => update('speed', 'standard')} /> 标准配送（免费）
        </label>
        <label>
          <input type="radio" name="speed" checked={form.speed === 'express'} onChange={() => update('speed', 'express')} /> 加急配送（+¥12）
        </label>
      </fieldset>
      <div>
        <label htmlFor="note">备注</label>
        <textarea
          id="note"
          value={form.note}
          onChange={(e) => update('note', e.currentTarget.value)}
          aria-invalid={errors.note !== undefined}
          aria-describedby={errors.note === undefined ? 'note-count' : 'note-count note-error'}
        />
        <span id="note-count">还可以输入 {NOTE_LIMIT - form.note.length} 字</span>
        {errorFor('note')}
      </div>
      <p>
        合计：<output aria-label="合计">{total}</output>
      </p>
      <button type="submit">提交订单</button>
    </form>
  );
}
```
:::

:::variant{kind=wrong name=keep-submitted fails=tests reason="提交成功后没有回到“还没有尝试提交”的状态，空表单立刻显示了一片错误"}
```tsx file=ShippingForm.tsx
import { useState, type SubmitEvent } from 'react';

export type Speed = 'standard' | 'express';
export type ShippingOrder = { name: string; phone: string; quantity: number; speed: Speed; note: string };

type Form = { name: string; phone: string; quantity: string; speed: Speed; note: string };
type Errors = Partial<Record<keyof Form, string>>;

const EMPTY: Form = { name: '', phone: '', quantity: '1', speed: 'standard', note: '' };
const NOTE_LIMIT = 100;
const EXPRESS_FEE = 12;
/** 出错时，焦点移到按这个顺序的第一个出错的字段（字段名也是输入框的 id） */
const FIELD_ORDER = ['name', 'phone', 'quantity', 'note'] as const;

function parseQuantity(text: string): number | null {
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= 1 && n <= 99 ? n : null;
}

export function validate(form: Form): Errors {
  const errors: Errors = {};
  if (form.name.trim() === '') errors.name = '请填写收件人';
  if (!/^1\d{10}$/.test(form.phone.trim())) errors.phone = '请填写 11 位手机号';
  if (parseQuantity(form.quantity) === null) errors.quantity = '数量必须是 1 到 99 之间的整数';
  if (form.note.length > NOTE_LIMIT) errors.note = `备注不能超过 ${NOTE_LIMIT} 字`;
  return errors;
}

type ShippingFormProps = { unitPrice: number; onSubmit: (order: ShippingOrder) => void };

export function ShippingForm({ unitPrice, onSubmit }: ShippingFormProps) {
  const [form, setForm] = useState(EMPTY);
  const [submitted, setSubmitted] = useState(false);

  const errors = submitted ? validate(form) : {};

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** 输入框上与错误相关的属性 */
  function invalidProps(field: keyof Form) {
    const message = errors[field];
    return message === undefined ? {} : { 'aria-invalid': true, 'aria-describedby': `${field}-error` };
  }

  function errorFor(field: keyof Form) {
    const message = errors[field];
    return message === undefined ? null : (
      <p id={`${field}-error`} className="error">
        {message}
      </p>
    );
  }

  const quantity = parseQuantity(form.quantity);
  const total = quantity === null ? '—' : `¥${(unitPrice * quantity + (form.speed === 'express' ? EXPRESS_FEE : 0)).toFixed(2)}`;

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const quantity = parseQuantity(form.quantity);
    const found = validate(form);
    if (Object.keys(found).length > 0 || quantity === null) {
      setSubmitted(true);
      const first = FIELD_ORDER.find((field) => found[field] !== undefined);
      if (first !== undefined) document.getElementById(first)?.focus();
      return;
    }
    onSubmit({ name: form.name.trim(), phone: form.phone.trim(), quantity, speed: form.speed, note: form.note.trim() });
    setForm(EMPTY);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="name">收件人</label>
        <input id="name" value={form.name} onChange={(e) => update('name', e.currentTarget.value)} {...invalidProps('name')} />
        {errorFor('name')}
      </div>
      <div>
        <label htmlFor="phone">手机号</label>
        <input id="phone" type="tel" value={form.phone} onChange={(e) => update('phone', e.currentTarget.value)} {...invalidProps('phone')} />
        {errorFor('phone')}
      </div>
      <div>
        <label htmlFor="quantity">数量</label>
        <input id="quantity" type="number" value={form.quantity} onChange={(e) => update('quantity', e.currentTarget.value)} {...invalidProps('quantity')} />
        {errorFor('quantity')}
      </div>
      <fieldset>
        <legend>配送方式</legend>
        <label>
          <input type="radio" name="speed" checked={form.speed === 'standard'} onChange={() => update('speed', 'standard')} /> 标准配送（免费）
        </label>
        <label>
          <input type="radio" name="speed" checked={form.speed === 'express'} onChange={() => update('speed', 'express')} /> 加急配送（+¥12）
        </label>
      </fieldset>
      <div>
        <label htmlFor="note">备注</label>
        <textarea
          id="note"
          value={form.note}
          onChange={(e) => update('note', e.currentTarget.value)}
          aria-invalid={errors.note !== undefined}
          aria-describedby={errors.note === undefined ? 'note-count' : 'note-count note-error'}
        />
        <span id="note-count">还可以输入 {NOTE_LIMIT - form.note.length} 字</span>
        {errorFor('note')}
      </div>
      <p>
        合计：<output aria-label="合计">{total}</output>
      </p>
      <button type="submit">提交订单</button>
    </form>
  );
}
```
:::

:::variant{kind=wrong name=no-focus fails=tests reason="提交失败时没有把焦点移到第一个出错的字段"}
```tsx file=ShippingForm.tsx
import { useState, type SubmitEvent } from 'react';

export type Speed = 'standard' | 'express';
export type ShippingOrder = { name: string; phone: string; quantity: number; speed: Speed; note: string };

type Form = { name: string; phone: string; quantity: string; speed: Speed; note: string };
type Errors = Partial<Record<keyof Form, string>>;

const EMPTY: Form = { name: '', phone: '', quantity: '1', speed: 'standard', note: '' };
const NOTE_LIMIT = 100;
const EXPRESS_FEE = 12;
/** 出错时，焦点移到按这个顺序的第一个出错的字段（字段名也是输入框的 id） */
const FIELD_ORDER = ['name', 'phone', 'quantity', 'note'] as const;

function parseQuantity(text: string): number | null {
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= 1 && n <= 99 ? n : null;
}

export function validate(form: Form): Errors {
  const errors: Errors = {};
  if (form.name.trim() === '') errors.name = '请填写收件人';
  if (!/^1\d{10}$/.test(form.phone.trim())) errors.phone = '请填写 11 位手机号';
  if (parseQuantity(form.quantity) === null) errors.quantity = '数量必须是 1 到 99 之间的整数';
  if (form.note.length > NOTE_LIMIT) errors.note = `备注不能超过 ${NOTE_LIMIT} 字`;
  return errors;
}

type ShippingFormProps = { unitPrice: number; onSubmit: (order: ShippingOrder) => void };

export function ShippingForm({ unitPrice, onSubmit }: ShippingFormProps) {
  const [form, setForm] = useState(EMPTY);
  const [submitted, setSubmitted] = useState(false);

  const errors = submitted ? validate(form) : {};

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** 输入框上与错误相关的属性 */
  function invalidProps(field: keyof Form) {
    const message = errors[field];
    return message === undefined ? {} : { 'aria-invalid': true, 'aria-describedby': `${field}-error` };
  }

  function errorFor(field: keyof Form) {
    const message = errors[field];
    return message === undefined ? null : (
      <p id={`${field}-error`} className="error">
        {message}
      </p>
    );
  }

  const quantity = parseQuantity(form.quantity);
  const total = quantity === null ? '—' : `¥${(unitPrice * quantity + (form.speed === 'express' ? EXPRESS_FEE : 0)).toFixed(2)}`;

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const quantity = parseQuantity(form.quantity);
    if (Object.keys(validate(form)).length > 0 || quantity === null) {
      setSubmitted(true);
      return;
    }
    onSubmit({ name: form.name.trim(), phone: form.phone.trim(), quantity, speed: form.speed, note: form.note.trim() });
    setForm(EMPTY);
    setSubmitted(false);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="name">收件人</label>
        <input id="name" value={form.name} onChange={(e) => update('name', e.currentTarget.value)} {...invalidProps('name')} />
        {errorFor('name')}
      </div>
      <div>
        <label htmlFor="phone">手机号</label>
        <input id="phone" type="tel" value={form.phone} onChange={(e) => update('phone', e.currentTarget.value)} {...invalidProps('phone')} />
        {errorFor('phone')}
      </div>
      <div>
        <label htmlFor="quantity">数量</label>
        <input id="quantity" type="number" value={form.quantity} onChange={(e) => update('quantity', e.currentTarget.value)} {...invalidProps('quantity')} />
        {errorFor('quantity')}
      </div>
      <fieldset>
        <legend>配送方式</legend>
        <label>
          <input type="radio" name="speed" checked={form.speed === 'standard'} onChange={() => update('speed', 'standard')} /> 标准配送（免费）
        </label>
        <label>
          <input type="radio" name="speed" checked={form.speed === 'express'} onChange={() => update('speed', 'express')} /> 加急配送（+¥12）
        </label>
      </fieldset>
      <div>
        <label htmlFor="note">备注</label>
        <textarea
          id="note"
          value={form.note}
          onChange={(e) => update('note', e.currentTarget.value)}
          aria-invalid={errors.note !== undefined}
          aria-describedby={errors.note === undefined ? 'note-count' : 'note-count note-error'}
        />
        <span id="note-count">还可以输入 {NOTE_LIMIT - form.note.length} 字</span>
        {errorFor('note')}
      </div>
      <p>
        合计：<output aria-label="合计">{total}</output>
      </p>
      <button type="submit">提交订单</button>
    </form>
  );
}
```
:::

:::variant{kind=wrong name=string-math fails=types reason="直接用字符串形式的数量做乘法"}
```tsx file=ShippingForm.tsx
import { useState, type SubmitEvent } from 'react';

export type Speed = 'standard' | 'express';
export type ShippingOrder = { name: string; phone: string; quantity: number; speed: Speed; note: string };

type Form = { name: string; phone: string; quantity: string; speed: Speed; note: string };
type Errors = Partial<Record<keyof Form, string>>;

const EMPTY: Form = { name: '', phone: '', quantity: '1', speed: 'standard', note: '' };
const NOTE_LIMIT = 100;
const EXPRESS_FEE = 12;
/** 出错时，焦点移到按这个顺序的第一个出错的字段（字段名也是输入框的 id） */
const FIELD_ORDER = ['name', 'phone', 'quantity', 'note'] as const;

function parseQuantity(text: string): number | null {
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= 1 && n <= 99 ? n : null;
}

export function validate(form: Form): Errors {
  const errors: Errors = {};
  if (form.name.trim() === '') errors.name = '请填写收件人';
  if (!/^1\d{10}$/.test(form.phone.trim())) errors.phone = '请填写 11 位手机号';
  if (parseQuantity(form.quantity) === null) errors.quantity = '数量必须是 1 到 99 之间的整数';
  if (form.note.length > NOTE_LIMIT) errors.note = `备注不能超过 ${NOTE_LIMIT} 字`;
  return errors;
}

type ShippingFormProps = { unitPrice: number; onSubmit: (order: ShippingOrder) => void };

export function ShippingForm({ unitPrice, onSubmit }: ShippingFormProps) {
  const [form, setForm] = useState(EMPTY);
  const [submitted, setSubmitted] = useState(false);

  const errors = submitted ? validate(form) : {};

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** 输入框上与错误相关的属性 */
  function invalidProps(field: keyof Form) {
    const message = errors[field];
    return message === undefined ? {} : { 'aria-invalid': true, 'aria-describedby': `${field}-error` };
  }

  function errorFor(field: keyof Form) {
    const message = errors[field];
    return message === undefined ? null : (
      <p id={`${field}-error`} className="error">
        {message}
      </p>
    );
  }

  const quantity = parseQuantity(form.quantity);
  const total = quantity === null ? '—' : `¥${(unitPrice * form.quantity + (form.speed === 'express' ? EXPRESS_FEE : 0)).toFixed(2)}`;

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const quantity = parseQuantity(form.quantity);
    const found = validate(form);
    if (Object.keys(found).length > 0 || quantity === null) {
      setSubmitted(true);
      const first = FIELD_ORDER.find((field) => found[field] !== undefined);
      if (first !== undefined) document.getElementById(first)?.focus();
      return;
    }
    onSubmit({ name: form.name.trim(), phone: form.phone.trim(), quantity, speed: form.speed, note: form.note.trim() });
    setForm(EMPTY);
    setSubmitted(false);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="name">收件人</label>
        <input id="name" value={form.name} onChange={(e) => update('name', e.currentTarget.value)} {...invalidProps('name')} />
        {errorFor('name')}
      </div>
      <div>
        <label htmlFor="phone">手机号</label>
        <input id="phone" type="tel" value={form.phone} onChange={(e) => update('phone', e.currentTarget.value)} {...invalidProps('phone')} />
        {errorFor('phone')}
      </div>
      <div>
        <label htmlFor="quantity">数量</label>
        <input id="quantity" type="number" value={form.quantity} onChange={(e) => update('quantity', e.currentTarget.value)} {...invalidProps('quantity')} />
        {errorFor('quantity')}
      </div>
      <fieldset>
        <legend>配送方式</legend>
        <label>
          <input type="radio" name="speed" checked={form.speed === 'standard'} onChange={() => update('speed', 'standard')} /> 标准配送（免费）
        </label>
        <label>
          <input type="radio" name="speed" checked={form.speed === 'express'} onChange={() => update('speed', 'express')} /> 加急配送（+¥12）
        </label>
      </fieldset>
      <div>
        <label htmlFor="note">备注</label>
        <textarea
          id="note"
          value={form.note}
          onChange={(e) => update('note', e.currentTarget.value)}
          aria-invalid={errors.note !== undefined}
          aria-describedby={errors.note === undefined ? 'note-count' : 'note-count note-error'}
        />
        <span id="note-count">还可以输入 {NOTE_LIMIT - form.note.length} 字</span>
        {errorFor('note')}
      </div>
      <p>
        合计：<output aria-label="合计">{total}</output>
      </p>
      <button type="submit">提交订单</button>
    </form>
  );
}
```
:::

:::variant{kind=wrong name=untrimmed fails=tests reason="提交的数据没有去掉首尾空白"}
```tsx file=ShippingForm.tsx
import { useState, type SubmitEvent } from 'react';

export type Speed = 'standard' | 'express';
export type ShippingOrder = { name: string; phone: string; quantity: number; speed: Speed; note: string };

type Form = { name: string; phone: string; quantity: string; speed: Speed; note: string };
type Errors = Partial<Record<keyof Form, string>>;

const EMPTY: Form = { name: '', phone: '', quantity: '1', speed: 'standard', note: '' };
const NOTE_LIMIT = 100;
const EXPRESS_FEE = 12;
/** 出错时，焦点移到按这个顺序的第一个出错的字段（字段名也是输入框的 id） */
const FIELD_ORDER = ['name', 'phone', 'quantity', 'note'] as const;

function parseQuantity(text: string): number | null {
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= 1 && n <= 99 ? n : null;
}

export function validate(form: Form): Errors {
  const errors: Errors = {};
  if (form.name.trim() === '') errors.name = '请填写收件人';
  if (!/^1\d{10}$/.test(form.phone.trim())) errors.phone = '请填写 11 位手机号';
  if (parseQuantity(form.quantity) === null) errors.quantity = '数量必须是 1 到 99 之间的整数';
  if (form.note.length > NOTE_LIMIT) errors.note = `备注不能超过 ${NOTE_LIMIT} 字`;
  return errors;
}

type ShippingFormProps = { unitPrice: number; onSubmit: (order: ShippingOrder) => void };

export function ShippingForm({ unitPrice, onSubmit }: ShippingFormProps) {
  const [form, setForm] = useState(EMPTY);
  const [submitted, setSubmitted] = useState(false);

  const errors = submitted ? validate(form) : {};

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** 输入框上与错误相关的属性 */
  function invalidProps(field: keyof Form) {
    const message = errors[field];
    return message === undefined ? {} : { 'aria-invalid': true, 'aria-describedby': `${field}-error` };
  }

  function errorFor(field: keyof Form) {
    const message = errors[field];
    return message === undefined ? null : (
      <p id={`${field}-error`} className="error">
        {message}
      </p>
    );
  }

  const quantity = parseQuantity(form.quantity);
  const total = quantity === null ? '—' : `¥${(unitPrice * quantity + (form.speed === 'express' ? EXPRESS_FEE : 0)).toFixed(2)}`;

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const quantity = parseQuantity(form.quantity);
    if (Object.keys(validate(form)).length > 0 || quantity === null) {
      setSubmitted(true);
      return;
    }
    onSubmit({ ...form, quantity });
    setForm(EMPTY);
    setSubmitted(false);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="name">收件人</label>
        <input id="name" value={form.name} onChange={(e) => update('name', e.currentTarget.value)} {...invalidProps('name')} />
        {errorFor('name')}
      </div>
      <div>
        <label htmlFor="phone">手机号</label>
        <input id="phone" type="tel" value={form.phone} onChange={(e) => update('phone', e.currentTarget.value)} {...invalidProps('phone')} />
        {errorFor('phone')}
      </div>
      <div>
        <label htmlFor="quantity">数量</label>
        <input id="quantity" type="number" value={form.quantity} onChange={(e) => update('quantity', e.currentTarget.value)} {...invalidProps('quantity')} />
        {errorFor('quantity')}
      </div>
      <fieldset>
        <legend>配送方式</legend>
        <label>
          <input type="radio" name="speed" checked={form.speed === 'standard'} onChange={() => update('speed', 'standard')} /> 标准配送（免费）
        </label>
        <label>
          <input type="radio" name="speed" checked={form.speed === 'express'} onChange={() => update('speed', 'express')} /> 加急配送（+¥12）
        </label>
      </fieldset>
      <div>
        <label htmlFor="note">备注</label>
        <textarea
          id="note"
          value={form.note}
          onChange={(e) => update('note', e.currentTarget.value)}
          aria-invalid={errors.note !== undefined}
          aria-describedby={errors.note === undefined ? 'note-count' : 'note-count note-error'}
        />
        <span id="note-count">还可以输入 {NOTE_LIMIT - form.note.length} 字</span>
        {errorFor('note')}
      </div>
      <p>
        合计：<output aria-label="合计">{total}</output>
      </p>
      <button type="submit">提交订单</button>
    </form>
  );
}
```
:::
