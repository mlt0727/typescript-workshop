---
kind: task
title: 删掉多余的 Effect
---
`ContactEditor.tsx` 中的联系人编辑器能用，但用了三个 Effect：一个计算全名，一个在切换联系人时重置输入框，一个在“已提交”的标记变化后保存。它们让每次输入、每次切换都多渲染一次，而且第二次点“保存”时什么都不会发生。去掉所有的 Effect，保持下面的行为：

1. 全名是“姓”和“名”去掉首尾空白后连在一起（例如“张三”），随输入实时变化；
2. 在 `ContactPage` 中切换联系人时，输入框直接显示新联系人的姓名，“已保存”的提示消失，之前没有保存的修改被丢弃；
3. 每次提交（点“保存”或者在输入框中按回车）都调用一次 `onSave({ id, firstName, lastName })`，姓名去掉首尾空白，然后显示“已保存”；没有修改时再提交一次，也要再保存一次；
4. 保存之后，再修改任何一个输入框，“已保存”消失。

测试会用 React 的 `<Profiler>` 组件统计每次操作“提交到页面”的次数（开发版的 React 每次提交都会调用它的 `onRender`）：打开页面、输入一个字、切换联系人、保存，都应该只提交**一次**。

:::files{role=starter}
```tsx file=ContactEditor.tsx
import { useEffect, useState } from 'react';

export type Contact = { id: string; firstName: string; lastName: string };

type EditorProps = { contact: Contact; onSave: (contact: Contact) => void };

export function ContactEditor({ contact, onSave }: EditorProps) {
  const [firstName, setFirstName] = useState(contact.firstName);
  const [lastName, setLastName] = useState(contact.lastName);
  const [fullName, setFullName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saved, setSaved] = useState(false);

  // 姓名变化时，更新全名
  useEffect(() => {
    setFullName(`${lastName.trim()}${firstName.trim()}`);
  }, [firstName, lastName]);

  // 换了一个联系人时，把输入框和提示恢复成这个联系人的
  useEffect(() => {
    setFirstName(contact.firstName);
    setLastName(contact.lastName);
    setSaved(false);
  }, [contact.id]);

  // 提交之后保存
  useEffect(() => {
    if (!submitted) return;
    onSave({ id: contact.id, firstName: firstName.trim(), lastName: lastName.trim() });
    setSaved(true);
  }, [submitted]);

  function edit(setter: (value: string) => void, value: string) {
    setter(value);
    setSaved(false);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
      }}
    >
      <label>
        姓 <input value={lastName} onChange={(e) => edit(setLastName, e.currentTarget.value)} />
      </label>
      <label>
        名 <input value={firstName} onChange={(e) => edit(setFirstName, e.currentTarget.value)} />
      </label>
      <p>全名：{fullName}</p>
      <button type="submit">保存</button>
      <p role="status">{saved ? '已保存' : ''}</p>
    </form>
  );
}

export function ContactPage({ contacts, onSave }: { contacts: readonly Contact[]; onSave: (contact: Contact) => void }) {
  const [selectedId, setSelectedId] = useState(contacts[0]?.id);
  const selected = contacts.find((c) => c.id === selectedId);
  return (
    <div>
      <nav aria-label="联系人">
        {contacts.map((c) => (
          <button key={c.id} type="button" aria-pressed={c.id === selectedId} onClick={() => setSelectedId(c.id)}>
            {c.lastName}
            {c.firstName}
          </button>
        ))}
      </nav>
      {selected && <ContactEditor contact={selected} onSave={onSave} />}
    </div>
  );
}
```
:::

:::files{role=support}
```tsx file=main.tsx readonly
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ContactPage, type Contact } from './ContactEditor';

function App() {
  const [contacts, setContacts] = useState<readonly Contact[]>([
    { id: 'a', firstName: '三', lastName: '张' },
    { id: 'b', firstName: '梅梅', lastName: '韩' },
  ]);
  return (
    <ContactPage
      contacts={contacts}
      onSave={(contact) => {
        console.log('保存：', contact);
        setContacts((list) => list.map((c) => (c.id === contact.id ? contact : c)));
      }}
    />
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<App />);
```
:::

:::files{role=solution}
```tsx file=ContactEditor.tsx
import { useState } from 'react';

export type Contact = { id: string; firstName: string; lastName: string };

type EditorProps = { contact: Contact; onSave: (contact: Contact) => void };

export function ContactEditor({ contact, onSave }: EditorProps) {
  const [firstName, setFirstName] = useState(contact.firstName);
  const [lastName, setLastName] = useState(contact.lastName);
  const [saved, setSaved] = useState(false);
  const fullName = `${lastName.trim()}${firstName.trim()}`;

  function edit(setter: (value: string) => void, value: string) {
    setter(value);
    setSaved(false);
  }

  function save() {
    onSave({ id: contact.id, firstName: firstName.trim(), lastName: lastName.trim() });
    setSaved(true);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label>
        姓 <input value={lastName} onChange={(e) => edit(setLastName, e.currentTarget.value)} />
      </label>
      <label>
        名 <input value={firstName} onChange={(e) => edit(setFirstName, e.currentTarget.value)} />
      </label>
      <p>全名：{fullName}</p>
      <button type="submit">保存</button>
      <p role="status">{saved ? '已保存' : ''}</p>
    </form>
  );
}

export function ContactPage({ contacts, onSave }: { contacts: readonly Contact[]; onSave: (contact: Contact) => void }) {
  const [selectedId, setSelectedId] = useState(contacts[0]?.id);
  const selected = contacts.find((c) => c.id === selectedId);
  return (
    <div>
      <nav aria-label="联系人">
        {contacts.map((c) => (
          <button key={c.id} type="button" aria-pressed={c.id === selectedId} onClick={() => setSelectedId(c.id)}>
            {c.lastName}
            {c.firstName}
          </button>
        ))}
      </nav>
      {selected && <ContactEditor key={selected.id} contact={selected} onSave={onSave} />}
    </div>
  );
}
```
:::

:::files{role=tests}
```tsx file=ContactEditor.test.tsx
import { Profiler, useState } from 'react';
import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContactPage, type Contact } from './ContactEditor';

const people: readonly Contact[] = [
  { id: 'a', firstName: '三', lastName: '张' },
  { id: 'b', firstName: '梅梅', lastName: '韩' },
];

/** 渲染联系人页面；commits 记录每一次提交到页面（Profiler 的 onRender），用来发现多余的渲染 */
function setup() {
  const onSave = vi.fn<(contact: Contact) => void>();
  const commits: string[] = [];
  function Harness() {
    const [contacts, setContacts] = useState(people);
    return (
      <Profiler id="page" onRender={(_id, phase) => commits.push(phase)}>
        <ContactPage
          contacts={contacts}
          onSave={(contact) => {
            onSave(contact);
            setContacts((list) => list.map((c) => (c.id === contact.id ? contact : c)));
          }}
        />
      </Profiler>
    );
  }
  render(<Harness />);
  return { onSave, commits, user: userEvent.setup() };
}

const lastName = () => screen.getByLabelText('姓');
const firstName = () => screen.getByLabelText('名');
const fullName = () => screen.getByText(/^全名：/);
const status = () => screen.getByRole('status');

test('打开时显示第一个联系人和全名，只提交一次', () => {
  const { commits } = setup();
  expect(lastName()).toHaveValue('张');
  expect(firstName()).toHaveValue('三');
  expect(fullName()).toHaveTextContent(/^全名：张三$/);
  expect(commits, '打开页面时多渲染了一次：全名应该在渲染时计算').toEqual(['mount']);
});

test('输入时全名同步变化，每输入一个字只提交一次', async () => {
  const { commits, user } = setup();
  await user.type(firstName(), '丰');
  commits.length = 0;
  await user.keyboard('!');
  expect(fullName()).toHaveTextContent(/^全名：张三丰!$/);
  expect(commits, '输入一个字时多提交了一次：全名应该在渲染时计算，不要存进 state 再用 Effect 同步').toHaveLength(1);
});

test('切换联系人：直接显示新联系人的姓名，没有多余的渲染；未保存的修改被丢弃', async () => {
  const { commits, user } = setup();
  await user.type(firstName(), '丰');
  commits.length = 0;
  await user.click(screen.getByRole('button', { name: '韩梅梅' }));
  expect(lastName()).toHaveValue('韩');
  expect(firstName()).toHaveValue('梅梅');
  expect(fullName()).toHaveTextContent(/^全名：韩梅梅$/);
  expect(commits, '切换联系人时应该只渲染一次（先显示旧的姓名、再在 Effect 中重置，会多一次）').toHaveLength(1);
  await user.click(screen.getByRole('button', { name: '张三' }));
  expect(firstName()).toHaveValue('三');
});

test('每次提交都保存一次（去掉首尾空白），并显示“已保存”', async () => {
  const { onSave, commits, user } = setup();
  await user.clear(firstName());
  await user.type(firstName(), '  三丰  ');
  expect(fullName(), '全名由去掉首尾空白的姓和名组成').toHaveTextContent(/^全名：张三丰$/);
  commits.length = 0;
  await user.click(screen.getByRole('button', { name: '保存' }));
  expect(onSave).toHaveBeenLastCalledWith({ id: 'a', firstName: '三丰', lastName: '张' });
  expect(status()).toHaveTextContent('已保存');
  expect(commits, '保存时应该只渲染一次').toHaveLength(1);
  await user.click(screen.getByRole('button', { name: '保存' }));
  expect(onSave, '没有修改，再点一次“保存”也要保存').toHaveBeenCalledTimes(2);
});

test('保存之后再修改，“已保存”消失；按回车也能保存', async () => {
  const { onSave, user } = setup();
  await user.click(screen.getByRole('button', { name: '保存' }));
  expect(status()).toHaveTextContent('已保存');
  await user.type(lastName(), '{Backspace}李');
  expect(status()).not.toHaveTextContent('已保存');
  await user.keyboard('{Enter}');
  expect(onSave).toHaveBeenLastCalledWith({ id: 'a', firstName: '三', lastName: '李' });
  expect(status()).toHaveTextContent('已保存');
  await user.type(firstName(), '丰');
  expect(status(), '修改“名”之后，“已保存”也要消失').not.toHaveTextContent('已保存');
});

test('切换联系人时，“已保存”的提示不会带到另一个联系人', async () => {
  const { user } = setup();
  await user.click(screen.getByRole('button', { name: '保存' }));
  expect(status()).toHaveTextContent('已保存');
  await user.click(screen.getByRole('button', { name: '韩梅梅' }));
  expect(status()).not.toHaveTextContent('已保存');
});
```
:::

:::hint{level=1}
三个 Effect 分别对应本课的三种情况：全名能在渲染时算出来；切换联系人等于“换了一个编辑器”，可以用 `key`；保存是用户点“保存”引起的，写在提交的处理函数里。
:::

:::hint{level=2}
`const fullName = \`${lastName.trim()}${firstName.trim()}\`;`。在 `ContactPage` 中写 `<ContactEditor key={selected.id} … />`，然后删掉重置用的 Effect。`onSubmit` 中直接调用一个 `save()`：先 `onSave(…)`，再 `setSaved(true)`；`submitted` 这个 state 就不需要了。
:::

:::explanation
三个 Effect 对应三种常见的误用：

- **派生数据**：全名完全由两个输入框的内容决定。存进 state 再用 Effect 同步，每次输入都先用旧的全名渲染一次，Effect 执行之后再渲染一次。直接在渲染时计算，一次就对；
- **props 变化时重置 state**：切换联系人，相当于换了一个全新的编辑器。`key={selected.id}` 让 React 在 id 变化时创建新的 `ContactEditor`，所有的 state 都从这个联系人的数据重新初始化。用 Effect 重置，会先用上一个联系人的姓名渲染一次；
- **用标记加 Effect 处理用户操作**：保存是用户点“保存”引起的，应该写在 `onSubmit` 中。用 `submitted` 标记触发 Effect，第二次提交时标记已经是 `true`，Effect 不会再执行；保存和“已保存”的提示也被拆成了两次渲染。

去掉这些 Effect 之后，代码更短，行为也更容易预测：每个 state 只在用户的操作中被修改（`saved` 在修改输入框和保存时各改一次），修改的原因一目了然。

另一种同样能通过测试的写法，是把全名存进 state，在两个输入框的 `onChange` 中同步更新它。它没有多余的渲染，但仍然是一份多余的 state：每个修改姓名的地方都要记得同时更新全名。能算出来的，就不要存。

另一种重置的写法见替代解：在渲染期间比较 `contact.id` 和上一次的 id，不同时直接调整 state。它同样只提交一次，但需要额外保存“上一次的 id”，所以能用 `key` 时优先用 `key`。
:::

:::variant{kind=alt name=adjust-during-render}
```tsx file=ContactEditor.tsx
import { useState } from 'react';

export type Contact = { id: string; firstName: string; lastName: string };

type EditorProps = { contact: Contact; onSave: (contact: Contact) => void };

type Draft = { firstName: string; lastName: string; saved: boolean };

const draftOf = (contact: Contact): Draft => ({ firstName: contact.firstName, lastName: contact.lastName, saved: false });

export function ContactEditor({ contact, onSave }: EditorProps) {
  const [draft, setDraft] = useState(() => draftOf(contact));
  const [editingId, setEditingId] = useState(contact.id);

  // 渲染期间发现换了联系人：立刻调整 state，React 会在提交之前重新渲染
  if (contact.id !== editingId) {
    setEditingId(contact.id);
    setDraft(draftOf(contact));
  }

  const { firstName, lastName, saved } = draft;
  const fullName = [lastName, firstName].map((part) => part.trim()).join('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ id: contact.id, firstName: firstName.trim(), lastName: lastName.trim() });
        setDraft({ ...draft, saved: true });
      }}
    >
      <label>
        姓 <input value={lastName} onChange={(e) => setDraft({ ...draft, lastName: e.currentTarget.value, saved: false })} />
      </label>
      <label>
        名 <input value={firstName} onChange={(e) => setDraft({ ...draft, firstName: e.currentTarget.value, saved: false })} />
      </label>
      <p>全名：{fullName}</p>
      <button type="submit">保存</button>
      <p role="status">{saved ? '已保存' : ''}</p>
    </form>
  );
}

export function ContactPage({ contacts, onSave }: { contacts: readonly Contact[]; onSave: (contact: Contact) => void }) {
  const [selectedId, setSelectedId] = useState(contacts[0]?.id);
  const selected = contacts.find((c) => c.id === selectedId);
  return (
    <div>
      <nav aria-label="联系人">
        {contacts.map((c) => (
          <button key={c.id} type="button" aria-pressed={c.id === selectedId} onClick={() => setSelectedId(c.id)}>
            {c.lastName}
            {c.firstName}
          </button>
        ))}
      </nav>
      {selected && <ContactEditor contact={selected} onSave={onSave} />}
    </div>
  );
}
```
:::

:::variant{kind=wrong name=derived-in-effect fails=tests reason="全名仍然存在 state 中、用 Effect 同步，每次输入都多渲染一次"}
```tsx file=ContactEditor.tsx
import { useEffect, useState } from 'react';

export type Contact = { id: string; firstName: string; lastName: string };

type EditorProps = { contact: Contact; onSave: (contact: Contact) => void };

export function ContactEditor({ contact, onSave }: EditorProps) {
  const [firstName, setFirstName] = useState(contact.firstName);
  const [lastName, setLastName] = useState(contact.lastName);
  const [saved, setSaved] = useState(false);
  const [fullName, setFullName] = useState('');
  useEffect(() => {
    setFullName(`${lastName.trim()}${firstName.trim()}`);
  }, [firstName, lastName]);

  function edit(setter: (value: string) => void, value: string) {
    setter(value);
    setSaved(false);
  }

  function save() {
    onSave({ id: contact.id, firstName: firstName.trim(), lastName: lastName.trim() });
    setSaved(true);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label>
        姓 <input value={lastName} onChange={(e) => edit(setLastName, e.currentTarget.value)} />
      </label>
      <label>
        名 <input value={firstName} onChange={(e) => edit(setFirstName, e.currentTarget.value)} />
      </label>
      <p>全名：{fullName}</p>
      <button type="submit">保存</button>
      <p role="status">{saved ? '已保存' : ''}</p>
    </form>
  );
}

export function ContactPage({ contacts, onSave }: { contacts: readonly Contact[]; onSave: (contact: Contact) => void }) {
  const [selectedId, setSelectedId] = useState(contacts[0]?.id);
  const selected = contacts.find((c) => c.id === selectedId);
  return (
    <div>
      <nav aria-label="联系人">
        {contacts.map((c) => (
          <button key={c.id} type="button" aria-pressed={c.id === selectedId} onClick={() => setSelectedId(c.id)}>
            {c.lastName}
            {c.firstName}
          </button>
        ))}
      </nav>
      {selected && <ContactEditor key={selected.id} contact={selected} onSave={onSave} />}
    </div>
  );
}
```
:::

:::variant{kind=wrong name=reset-in-effect fails=tests reason="切换联系人时用 Effect 重置输入框，先用旧的姓名渲染了一次"}
```tsx file=ContactEditor.tsx
import { useEffect, useState } from 'react';

export type Contact = { id: string; firstName: string; lastName: string };

type EditorProps = { contact: Contact; onSave: (contact: Contact) => void };

export function ContactEditor({ contact, onSave }: EditorProps) {
  const [firstName, setFirstName] = useState(contact.firstName);
  const [lastName, setLastName] = useState(contact.lastName);
  const [saved, setSaved] = useState(false);
  const fullName = `${lastName.trim()}${firstName.trim()}`;

  useEffect(() => {
    setFirstName(contact.firstName);
    setLastName(contact.lastName);
    setSaved(false);
  }, [contact.id]);

  function edit(setter: (value: string) => void, value: string) {
    setter(value);
    setSaved(false);
  }

  function save() {
    onSave({ id: contact.id, firstName: firstName.trim(), lastName: lastName.trim() });
    setSaved(true);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label>
        姓 <input value={lastName} onChange={(e) => edit(setLastName, e.currentTarget.value)} />
      </label>
      <label>
        名 <input value={firstName} onChange={(e) => edit(setFirstName, e.currentTarget.value)} />
      </label>
      <p>全名：{fullName}</p>
      <button type="submit">保存</button>
      <p role="status">{saved ? '已保存' : ''}</p>
    </form>
  );
}

export function ContactPage({ contacts, onSave }: { contacts: readonly Contact[]; onSave: (contact: Contact) => void }) {
  const [selectedId, setSelectedId] = useState(contacts[0]?.id);
  const selected = contacts.find((c) => c.id === selectedId);
  return (
    <div>
      <nav aria-label="联系人">
        {contacts.map((c) => (
          <button key={c.id} type="button" aria-pressed={c.id === selectedId} onClick={() => setSelectedId(c.id)}>
            {c.lastName}
            {c.firstName}
          </button>
        ))}
      </nav>
      {selected && <ContactEditor contact={selected} onSave={onSave} />}
    </div>
  );
}
```
:::

:::variant{kind=wrong name=save-in-effect fails=tests reason="用 submitted 标记加 Effect 保存，第二次提交时没有保存"}
```tsx file=ContactEditor.tsx
import { useEffect, useState } from 'react';

export type Contact = { id: string; firstName: string; lastName: string };

type EditorProps = { contact: Contact; onSave: (contact: Contact) => void };

export function ContactEditor({ contact, onSave }: EditorProps) {
  const [firstName, setFirstName] = useState(contact.firstName);
  const [lastName, setLastName] = useState(contact.lastName);
  const [saved, setSaved] = useState(false);
  const fullName = `${lastName.trim()}${firstName.trim()}`;

  function edit(setter: (value: string) => void, value: string) {
    setter(value);
    setSaved(false);
  }

  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (!submitted) return;
    onSave({ id: contact.id, firstName: firstName.trim(), lastName: lastName.trim() });
    setSaved(true);
  }, [submitted]);

  function save() {
    setSubmitted(true);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label>
        姓 <input value={lastName} onChange={(e) => edit(setLastName, e.currentTarget.value)} />
      </label>
      <label>
        名 <input value={firstName} onChange={(e) => edit(setFirstName, e.currentTarget.value)} />
      </label>
      <p>全名：{fullName}</p>
      <button type="submit">保存</button>
      <p role="status">{saved ? '已保存' : ''}</p>
    </form>
  );
}

export function ContactPage({ contacts, onSave }: { contacts: readonly Contact[]; onSave: (contact: Contact) => void }) {
  const [selectedId, setSelectedId] = useState(contacts[0]?.id);
  const selected = contacts.find((c) => c.id === selectedId);
  return (
    <div>
      <nav aria-label="联系人">
        {contacts.map((c) => (
          <button key={c.id} type="button" aria-pressed={c.id === selectedId} onClick={() => setSelectedId(c.id)}>
            {c.lastName}
            {c.firstName}
          </button>
        ))}
      </nav>
      {selected && <ContactEditor key={selected.id} contact={selected} onSave={onSave} />}
    </div>
  );
}
```
:::

:::variant{kind=wrong name=no-key fails=tests reason="删掉了重置用的 Effect，却没有加 key，切换联系人后输入框里还是上一个人的姓名"}
```tsx file=ContactEditor.tsx
import { useState } from 'react';

export type Contact = { id: string; firstName: string; lastName: string };

type EditorProps = { contact: Contact; onSave: (contact: Contact) => void };

export function ContactEditor({ contact, onSave }: EditorProps) {
  const [firstName, setFirstName] = useState(contact.firstName);
  const [lastName, setLastName] = useState(contact.lastName);
  const [saved, setSaved] = useState(false);
  const fullName = `${lastName.trim()}${firstName.trim()}`;

  function edit(setter: (value: string) => void, value: string) {
    setter(value);
    setSaved(false);
  }

  function save() {
    onSave({ id: contact.id, firstName: firstName.trim(), lastName: lastName.trim() });
    setSaved(true);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label>
        姓 <input value={lastName} onChange={(e) => edit(setLastName, e.currentTarget.value)} />
      </label>
      <label>
        名 <input value={firstName} onChange={(e) => edit(setFirstName, e.currentTarget.value)} />
      </label>
      <p>全名：{fullName}</p>
      <button type="submit">保存</button>
      <p role="status">{saved ? '已保存' : ''}</p>
    </form>
  );
}

export function ContactPage({ contacts, onSave }: { contacts: readonly Contact[]; onSave: (contact: Contact) => void }) {
  const [selectedId, setSelectedId] = useState(contacts[0]?.id);
  const selected = contacts.find((c) => c.id === selectedId);
  return (
    <div>
      <nav aria-label="联系人">
        {contacts.map((c) => (
          <button key={c.id} type="button" aria-pressed={c.id === selectedId} onClick={() => setSelectedId(c.id)}>
            {c.lastName}
            {c.firstName}
          </button>
        ))}
      </nav>
      {selected && <ContactEditor contact={selected} onSave={onSave} />}
    </div>
  );
}
```
:::
