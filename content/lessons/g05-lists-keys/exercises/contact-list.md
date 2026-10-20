---
kind: task
title: 可以筛选的联系人列表
---
完成 `ContactList`，它接收联系人数组 `contacts` 和搜索词 `query`：

1. 只显示名字中包含搜索词的联系人：搜索词去掉首尾空白，比较时不区分英文的大小写；
2. 按名字排序：`a.name.localeCompare(b.name, 'zh-CN')`（这条规则中，汉字按拼音排序，并且排在英文字母前面）；
3. 有结果时渲染：

```html
<p>共 2 人</p>
<ul aria-label="联系人">
  <li><strong>王芳</strong> <span>138-0000-0001</span></li>
  …
</ul>
```

4. 没有任何联系人时只渲染 `<p>还没有联系人</p>`；有联系人、但没有匹配的结果时只渲染 `<p>没有找到“搜索词”</p>`（去掉空白之后的搜索词）。

注意：名字可能重复，`contacts` 不能被修改。

:::files{role=starter}
```tsx file=ContactList.tsx
export type Contact = { id: string; name: string; phone: string };

type ContactListProps = {
  contacts: readonly Contact[];
  query: string;
};

export function ContactList({ contacts, query }: ContactListProps) {
  // TODO：筛选、排序、渲染列表与空状态
  return <ul aria-label="联系人"></ul>;
}
```
:::

:::files{role=support}
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { ContactList, type Contact } from './ContactList';

const contacts: Contact[] = [
  { id: 'c1', name: '王芳', phone: '138-0000-0001' },
  { id: 'c2', name: 'Alice', phone: '138-0000-0002' },
  { id: 'c3', name: '李雷', phone: '138-0000-0003' },
  { id: 'c4', name: '王芳', phone: '138-0000-0004' },
];

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(
  <>
    <h2>全部</h2>
    <ContactList contacts={contacts} query="" />
    <h2>搜索“王”</h2>
    <ContactList contacts={contacts} query="王" />
  </>,
);
```
:::

:::files{role=solution}
```tsx file=ContactList.tsx
export type Contact = { id: string; name: string; phone: string };

type ContactListProps = {
  contacts: readonly Contact[];
  query: string;
};

export function ContactList({ contacts, query }: ContactListProps) {
  const text = query.trim();
  const visible = contacts.toSorted((a, b) => a.name.localeCompare(b.name, 'zh-CN')).filter((contact) => contact.name.toLowerCase().includes(text.toLowerCase()));

  if (contacts.length === 0) return <p>还没有联系人</p>;
  if (visible.length === 0) return <p>没有找到“{text}”</p>;

  return (
    <>
      <p>共 {visible.length} 人</p>
      <ul aria-label="联系人">
        {visible.map((contact) => (
          <li key={contact.id}>
            <strong>{contact.name}</strong> <span>{contact.phone}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
```
:::

:::files{role=tests}
```tsx file=ContactList.test.tsx
import { afterEach, expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ContactList, type Contact } from './ContactList';

const contacts: readonly Contact[] = Object.freeze([
  { id: 'c1', name: '王芳', phone: '138-0000-0001' },
  { id: 'c2', name: 'bob', phone: '138-0000-0002' },
  { id: 'c3', name: '李雷', phone: '138-0000-0003' },
  { id: 'c4', name: '王芳', phone: '138-0000-0004' },
  { id: 'c5', name: 'Alice', phone: '138-0000-0005' },
]);

function names(): string[] {
  return within(screen.getByRole('list', { name: '联系人' }))
    .getAllByRole('listitem')
    .map((li) => li.querySelector('strong')?.textContent ?? '');
}

afterEach(() => {
  vi.restoreAllMocks();
});

test('按名字排序显示全部联系人；每一项都有唯一的 key（没有 React 警告）', () => {
  const errors = vi.spyOn(console, 'error');
  render(<ContactList contacts={contacts} query="" />);
  expect(names()).toEqual(['李雷', '王芳', '王芳', 'Alice', 'bob']);
  expect(screen.getByText('共 5 人')).toBeInTheDocument();
  const keyWarnings = errors.mock.calls.filter((args) => args.join(' ').includes('key'));
  expect(keyWarnings, '控制台出现了关于 key 的警告').toEqual([]);
});

test('电话显示在名字后面', () => {
  render(<ContactList contacts={contacts} query="李" />);
  const item = within(screen.getByRole('list', { name: '联系人' })).getByRole('listitem');
  expect(item).toHaveTextContent('李雷 138-0000-0003');
});

test('按名字筛选：不区分大小写，忽略首尾空白', () => {
  const { rerender } = render(<ContactList contacts={contacts} query=" 王 " />);
  expect(names()).toEqual(['王芳', '王芳']);
  expect(screen.getByText('共 2 人')).toBeInTheDocument();
  rerender(<ContactList contacts={contacts} query="ALI" />);
  expect(names()).toEqual(['Alice']);
});

test('空状态', () => {
  const { rerender } = render(<ContactList contacts={contacts} query=" 赵 " />);
  expect(screen.getByText('没有找到“赵”')).toBeInTheDocument();
  expect(screen.queryByRole('list')).toBeNull();
  rerender(<ContactList contacts={[]} query="" />);
  expect(screen.getByText('还没有联系人')).toBeInTheDocument();
  expect(screen.queryByRole('list')).toBeNull();
});
```
:::

:::hint{level=1}
先算出要显示的数组：`contacts.toSorted(…).filter(…)`，然后根据情况返回空状态或者列表。列表用 `visible.map((contact) => <li key={…}>…</li>)`。
:::

:::hint{level=2}
key 用 `contact.id`：名字可能重复，不能作为 key。大小写：比较 `contact.name.toLowerCase()` 和 `text.toLowerCase()`。`<strong>` 和 `<span>` 之间的空格可以直接写在 JSX 中：`<strong>{contact.name}</strong> <span>{contact.phone}</span>`。
:::

:::explanation
筛选和排序的结果没有存成 state，而是每次渲染时从 props 算出来。这样它们永远和 props 保持一致，不会出现“联系人更新了，搜索结果还是旧的”的情况。能从已有数据算出的东西，就不要另存一份（g07 会再讲）。

两个“王芳”说明了为什么 key 要用 id：名字作 key 时出现了两个相同的 key，React 会在控制台警告 “Encountered two children with the same key”，而且这两项在更新时可能被弄混。

`contacts` 是 `readonly Contact[]`，直接调用 `sort` 会编译失败，所以排序要用 `toSorted`（g04）。测试还冻结了这个数组，在运行时也不允许修改。
:::

:::variant{kind=alt name=copy-then-sort}
```tsx file=ContactList.tsx
export type Contact = { id: string; name: string; phone: string };

type ContactListProps = {
  contacts: readonly Contact[];
  query: string;
};

const byName = (a: Contact, b: Contact) => a.name.localeCompare(b.name, 'zh-CN');

export function ContactList({ contacts, query }: ContactListProps) {
  const needle = query.trim().toLowerCase();
  const visible = [...contacts].filter((c) => c.name.toLowerCase().indexOf(needle) !== -1).sort(byName);

  let content;
  if (contacts.length === 0) {
    content = <p>还没有联系人</p>;
  } else if (visible.length === 0) {
    content = <p>没有找到“{query.trim()}”</p>;
  } else {
    const items = visible.map((c) => (
      <li key={c.id}>
        <strong>{c.name}</strong> <span>{c.phone}</span>
      </li>
    ));
    content = (
      <>
        <p>共 {items.length} 人</p>
        <ul aria-label="联系人">{items}</ul>
      </>
    );
  }
  return content;
}
```
:::

:::variant{kind=wrong name=no-key fails=tests reason="列表项没有 key"}
```tsx file=ContactList.tsx
export type Contact = { id: string; name: string; phone: string };

type ContactListProps = {
  contacts: readonly Contact[];
  query: string;
};

export function ContactList({ contacts, query }: ContactListProps) {
  const text = query.trim();
  const visible = contacts.toSorted((a, b) => a.name.localeCompare(b.name, 'zh-CN')).filter((contact) => contact.name.toLowerCase().includes(text.toLowerCase()));

  if (contacts.length === 0) return <p>还没有联系人</p>;
  if (visible.length === 0) return <p>没有找到“{text}”</p>;

  return (
    <>
      <p>共 {visible.length} 人</p>
      <ul aria-label="联系人">
        {visible.map((contact) => (
          <li>
            <strong>{contact.name}</strong> <span>{contact.phone}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
```
:::

:::variant{kind=wrong name=name-as-key fails=tests reason="用名字作 key，重名时 key 重复"}
```tsx file=ContactList.tsx
export type Contact = { id: string; name: string; phone: string };

type ContactListProps = {
  contacts: readonly Contact[];
  query: string;
};

export function ContactList({ contacts, query }: ContactListProps) {
  const text = query.trim();
  const visible = contacts.toSorted((a, b) => a.name.localeCompare(b.name, 'zh-CN')).filter((contact) => contact.name.toLowerCase().includes(text.toLowerCase()));

  if (contacts.length === 0) return <p>还没有联系人</p>;
  if (visible.length === 0) return <p>没有找到“{text}”</p>;

  return (
    <>
      <p>共 {visible.length} 人</p>
      <ul aria-label="联系人">
        {visible.map((contact) => (
          <li key={contact.name}>
            <strong>{contact.name}</strong> <span>{contact.phone}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
```
:::

:::variant{kind=wrong name=unsorted fails=tests reason="忘了按名字排序"}
```tsx file=ContactList.tsx
export type Contact = { id: string; name: string; phone: string };

type ContactListProps = {
  contacts: readonly Contact[];
  query: string;
};

export function ContactList({ contacts, query }: ContactListProps) {
  const text = query.trim();
  const visible = contacts.filter((contact) => contact.name.toLowerCase().includes(text.toLowerCase()));

  if (contacts.length === 0) return <p>还没有联系人</p>;
  if (visible.length === 0) return <p>没有找到“{text}”</p>;

  return (
    <>
      <p>共 {visible.length} 人</p>
      <ul aria-label="联系人">
        {visible.map((contact) => (
          <li key={contact.id}>
            <strong>{contact.name}</strong> <span>{contact.phone}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
```
:::

:::variant{kind=wrong name=no-trim fails=tests reason="搜索词没有去掉首尾空白"}
```tsx file=ContactList.tsx
export type Contact = { id: string; name: string; phone: string };

type ContactListProps = {
  contacts: readonly Contact[];
  query: string;
};

export function ContactList({ contacts, query }: ContactListProps) {
  const text = query;
  const visible = contacts.toSorted((a, b) => a.name.localeCompare(b.name, 'zh-CN')).filter((contact) => contact.name.toLowerCase().includes(text.toLowerCase()));

  if (contacts.length === 0) return <p>还没有联系人</p>;
  if (visible.length === 0) return <p>没有找到“{text}”</p>;

  return (
    <>
      <p>共 {visible.length} 人</p>
      <ul aria-label="联系人">
        {visible.map((contact) => (
          <li key={contact.id}>
            <strong>{contact.name}</strong> <span>{contact.phone}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
```
:::

:::variant{kind=wrong name=case-sensitive fails=tests reason="比较时区分了大小写"}
```tsx file=ContactList.tsx
export type Contact = { id: string; name: string; phone: string };

type ContactListProps = {
  contacts: readonly Contact[];
  query: string;
};

export function ContactList({ contacts, query }: ContactListProps) {
  const text = query.trim();
  const visible = contacts.toSorted((a, b) => a.name.localeCompare(b.name, 'zh-CN')).filter((contact) => contact.name.includes(text));

  if (contacts.length === 0) return <p>还没有联系人</p>;
  if (visible.length === 0) return <p>没有找到“{text}”</p>;

  return (
    <>
      <p>共 {visible.length} 人</p>
      <ul aria-label="联系人">
        {visible.map((contact) => (
          <li key={contact.id}>
            <strong>{contact.name}</strong> <span>{contact.phone}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
```
:::
