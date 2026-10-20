---
kind: task
title: 在 exactOptionalPropertyTypes 下修改联系人
compiler:
  overrides: { exactOptionalPropertyTypes: true }
  note: 本题额外开启了 exactOptionalPropertyTypes：可选属性不能显式地写成 undefined。
---
本题开启了 `exactOptionalPropertyTypes`。联系人的 `email`、`phone` 是可选的：没有就是**没有这个属性**，而不是值为 `undefined`。在 `contacts.ts` 中实现：

1. **`applyContactPatch(contact, patch)`**：返回新的联系人，不修改传入的对象。补丁中某一项：没有给出时不变；是字符串时改成它；是 `null` 时**删除**这一项（结果中没有这个属性）。`name` 只能修改，不能删除；
2. **`fromForm(form)`**：表单的三个输入框都是字符串，去掉首尾空白之后：`name` 原样使用；`email`、`phone` 为空字符串时结果中**没有**这个属性。

:::files{role=starter}
```ts file=contacts.ts
export type Contact = { name: string; email?: string; phone?: string };
export type ContactPatch = { name?: string; email?: string | null; phone?: string | null };
export type ContactForm = { name: string; email: string; phone: string };

export function applyContactPatch(contact: Contact, patch: ContactPatch): Contact {
  return { ...contact, ...patch };
}

export function fromForm(form: ContactForm): Contact {
  return { name: form.name, email: form.email || undefined, phone: form.phone || undefined };
}
```
```ts file=main.ts
import { applyContactPatch, fromForm } from './contacts';

const ada = fromForm({ name: ' Ada ', email: 'ada@example.com', phone: '  ' });
console.log(ada, 'phone' in ada);
console.log(applyContactPatch(ada, { email: null, phone: '123' }));
```
:::

:::files{role=solution}
```ts file=contacts.ts
export type Contact = { name: string; email?: string; phone?: string };
export type ContactPatch = { name?: string; email?: string | null; phone?: string | null };
export type ContactForm = { name: string; email: string; phone: string };

export function applyContactPatch(contact: Contact, patch: ContactPatch): Contact {
  const next: Contact = { ...contact };
  if (patch.name !== undefined) next.name = patch.name;
  if (patch.email === null) delete next.email;
  else if (patch.email !== undefined) next.email = patch.email;
  if (patch.phone === null) delete next.phone;
  else if (patch.phone !== undefined) next.phone = patch.phone;
  return next;
}

export function fromForm(form: ContactForm): Contact {
  const contact: Contact = { name: form.name.trim() };
  const email = form.email.trim();
  const phone = form.phone.trim();
  if (email !== '') contact.email = email;
  if (phone !== '') contact.phone = phone;
  return contact;
}
```
```ts file=main.ts
import { applyContactPatch, fromForm } from './contacts';

const ada = fromForm({ name: ' Ada ', email: 'ada@example.com', phone: '  ' });
console.log(ada, 'phone' in ada);
console.log(applyContactPatch(ada, { email: null, phone: '123' }));
```
:::

:::files{role=tests}
```ts file=contacts.test.ts
import { describe, expect, test } from 'vitest';
import { applyContactPatch, fromForm, type Contact } from './contacts';

const ada: Contact = { name: 'Ada', email: 'ada@example.com', phone: '123' };

describe('applyContactPatch', () => {
  test('修改给出的字段，没有给出的不变', () => {
    expect(applyContactPatch(ada, { email: 'ada@new.example' })).toEqual({ name: 'Ada', email: 'ada@new.example', phone: '123' });
    expect(applyContactPatch(ada, { name: 'Ada L.' }).name).toBe('Ada L.');
    expect(applyContactPatch(ada, {})).toEqual(ada);
  });

  test('null 删除这一项：结果中没有这个属性', () => {
    const next = applyContactPatch(ada, { email: null });
    expect('email' in next).toBe(false);
    expect(Object.keys(next).toSorted()).toEqual(['name', 'phone']);
  });

  test('不修改传入的对象', () => {
    const before: Contact = { ...ada };
    const next = applyContactPatch(before, { phone: null, email: 'x@y.z' });
    expect(before).toEqual(ada);
    expect(next).not.toBe(before);
  });
});

describe('fromForm', () => {
  test('去掉空白；空的可选项不出现', () => {
    const contact = fromForm({ name: ' Ada ', email: ' ada@example.com ', phone: '   ' });
    expect(contact).toEqual({ name: 'Ada', email: 'ada@example.com' });
    expect('phone' in contact).toBe(false);
    expect(Object.keys(fromForm({ name: 'Lin', email: '', phone: '' }))).toEqual(['name']);
  });
});
```
```ts file=contacts.test-d.ts
import { expectTypeOf } from 'vitest';
import { applyContactPatch, type Contact } from './contacts';

// @ts-expect-error 开启 exactOptionalPropertyTypes 后，可选属性不能显式地写成 undefined
const explicit: Contact = { name: 'Ada', email: undefined };
const absent: Contact = { name: 'Ada' };
expectTypeOf(applyContactPatch(absent, { email: null })).toEqualTypeOf<Contact>();
// @ts-expect-error 名字不能删除
applyContactPatch(absent, { name: null });
console.log(explicit);
```
:::

:::hint{level=1}
不能再用 `{ ...contact, ...patch }`：补丁中的 `null` 会被复制进去，而 `Contact` 的 `email` 不接受 `null`。先复制一份 `const next: Contact = { ...contact }`，再对每一项分三种情况处理：`undefined`（不变）、`null`（删除）、字符串（修改）。
:::

:::hint{level=2}
删除属性用 `delete next.email`；在这个选项下，赋值 `next.email = undefined` 会报错。`fromForm` 先建一个只有 `name` 的对象，`email`、`phone` 不为空时再加上去：`if (email !== '') contact.email = email;`。
:::

:::explanation
`exactOptionalPropertyTypes` 把可选属性的两种意思分开了：`email?: string` 只表示“可以没有这个属性”，不再包括“有这个属性，值是 `undefined`”。起始代码中的两种写法都因此报错：

- `{ ...contact, ...patch }` 会把补丁中的 `null` 复制进联系人；
- `email: form.email || undefined` 显式地写出了 `undefined`。

这个区别在运行时是真实存在的：`'email' in contact`、`Object.keys(contact)`、`JSON.stringify(contact)`（它会省略值为 `undefined` 的属性，但 `in` 和 `Object.keys` 不会），都能区分“没有”和“值是 `undefined`”。开启这个选项之后，类型和运行时的行为对上了。

补丁中用 `null` 表示“删除”，`undefined`（没有给出）表示“不变”：三种意思各有各的写法，不会混在一起（c06 的问题就来自这两种意思被混用）。
:::

:::variant{kind=alt name=set-or-delete}
```ts file=contacts.ts
export type Contact = { name: string; email?: string; phone?: string };
export type ContactPatch = { name?: string; email?: string | null; phone?: string | null };
export type ContactForm = { name: string; email: string; phone: string };

type OptionalKey = 'email' | 'phone';

/** value 为 undefined 时删除这一项，否则设置它 */
function setOrDelete(contact: Contact, key: OptionalKey, value: string | undefined): Contact {
  const next: Contact = { ...contact };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

export function applyContactPatch(contact: Contact, patch: ContactPatch): Contact {
  let next: Contact = { ...contact, name: patch.name ?? contact.name };
  for (const key of ['email', 'phone'] as const) {
    const change = patch[key];
    if (change !== undefined) next = setOrDelete(next, key, change ?? undefined);
  }
  return next;
}

export function fromForm(form: ContactForm): Contact {
  let contact: Contact = { name: form.name.trim() };
  for (const key of ['email', 'phone'] as const) {
    const value = form[key].trim();
    contact = setOrDelete(contact, key, value === '' ? undefined : value);
  }
  return contact;
}
```
:::

:::variant{kind=wrong name=assign-undefined fails=types reason="用赋值 undefined 来“删除”属性，在这个选项下不允许"}
```ts file=contacts.ts
export type Contact = { name: string; email?: string; phone?: string };
export type ContactPatch = { name?: string; email?: string | null; phone?: string | null };
export type ContactForm = { name: string; email: string; phone: string };

export function applyContactPatch(contact: Contact, patch: ContactPatch): Contact {
  const next: Contact = { ...contact };
  if (patch.name !== undefined) next.name = patch.name;
  if (patch.email !== undefined) next.email = patch.email ?? undefined;
  if (patch.phone !== undefined) next.phone = patch.phone ?? undefined;
  return next;
}

export function fromForm(form: ContactForm): Contact {
  const contact: Contact = { name: form.name.trim() };
  const email = form.email.trim();
  const phone = form.phone.trim();
  if (email !== '') contact.email = email;
  if (phone !== '') contact.phone = phone;
  return contact;
}
```
:::

:::variant{kind=wrong name=explicit-undefined-form fails=types reason="表单中空的可选项写成了 undefined，而不是省略这个属性"}
```ts file=contacts.ts
export type Contact = { name: string; email?: string; phone?: string };
export type ContactPatch = { name?: string; email?: string | null; phone?: string | null };
export type ContactForm = { name: string; email: string; phone: string };

export function applyContactPatch(contact: Contact, patch: ContactPatch): Contact {
  const next: Contact = { ...contact };
  if (patch.name !== undefined) next.name = patch.name;
  if (patch.email === null) delete next.email;
  else if (patch.email !== undefined) next.email = patch.email;
  if (patch.phone === null) delete next.phone;
  else if (patch.phone !== undefined) next.phone = patch.phone;
  return next;
}

export function fromForm(form: ContactForm): Contact {
  return {
    name: form.name.trim(),
    email: form.email.trim() || undefined,
    phone: form.phone.trim() || undefined,
  };
}
```
:::

:::variant{kind=wrong name=null-ignored fails=tests reason="补丁中的 null 被当作“不变”，没有删除这一项"}
```ts file=contacts.ts
export type Contact = { name: string; email?: string; phone?: string };
export type ContactPatch = { name?: string; email?: string | null; phone?: string | null };
export type ContactForm = { name: string; email: string; phone: string };

export function applyContactPatch(contact: Contact, patch: ContactPatch): Contact {
  const next: Contact = { ...contact };
  if (patch.name !== undefined) next.name = patch.name;
  if (typeof patch.email === 'string') next.email = patch.email;
  if (typeof patch.phone === 'string') next.phone = patch.phone;
  return next;
}

export function fromForm(form: ContactForm): Contact {
  const contact: Contact = { name: form.name.trim() };
  const email = form.email.trim();
  const phone = form.phone.trim();
  if (email !== '') contact.email = email;
  if (phone !== '') contact.phone = phone;
  return contact;
}
```
:::

:::variant{kind=wrong name=no-trim fails=tests reason="没有去掉空白，只有空格的输入框也成了一项"}
```ts file=contacts.ts
export type Contact = { name: string; email?: string; phone?: string };
export type ContactPatch = { name?: string; email?: string | null; phone?: string | null };
export type ContactForm = { name: string; email: string; phone: string };

export function applyContactPatch(contact: Contact, patch: ContactPatch): Contact {
  const next: Contact = { ...contact };
  if (patch.name !== undefined) next.name = patch.name;
  if (patch.email === null) delete next.email;
  else if (patch.email !== undefined) next.email = patch.email;
  if (patch.phone === null) delete next.phone;
  else if (patch.phone !== undefined) next.phone = patch.phone;
  return next;
}

export function fromForm(form: ContactForm): Contact {
  const contact: Contact = { name: form.name };
  if (form.email !== '') contact.email = form.email;
  if (form.phone !== '') contact.phone = form.phone;
  return contact;
}
```
:::
