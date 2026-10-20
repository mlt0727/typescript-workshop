---
kind: task
title: 同时只展开一个的问答列表
---
起始代码中，每个 `FaqItem` 自己记着是否展开，所以几个问题可以同时展开。把它改成**同时只展开一个**：

1. `FaqItem` 改成受控组件：props 增加 `isOpen: boolean` 和 `onToggle: () => void`，自己不再保存 state；
2. `FaqList` 保存“哪一个展开了”（一开始都收起），点击一个问题时展开它、收起其他的；再点一次已经展开的问题，把它收起；
3. 结构按照无障碍的手风琴模式：问题是标题中的按钮，`id` 为 `faq-button-{id}`，带有 `aria-expanded`，并用 `aria-controls` 指向答案；答案是 `<div id="faq-panel-{id}" role="region" aria-labelledby="faq-button-{id}">`，**一直在页面中**，收起时加上 `hidden` 属性。

:::files{role=starter}
```tsx file=Faq.tsx
import { useState } from 'react';

export type Faq = { id: string; question: string; answer: string };

type FaqItemProps = {
  id: string;
  question: string;
  answer: string;
};

export function FaqItem({ id, question, answer }: FaqItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <section>
      <h3>
        <button type="button" id={`faq-button-${id}`} aria-expanded={isOpen} onClick={() => setIsOpen(!isOpen)}>
          {question}
        </button>
      </h3>
      {isOpen && <div>{answer}</div>}
    </section>
  );
}

export function FaqList({ items }: { items: readonly Faq[] }) {
  return (
    <div>
      {items.map((item) => (
        <FaqItem key={item.id} id={item.id} question={item.question} answer={item.answer} />
      ))}
    </div>
  );
}
```
:::

:::files{role=support}
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { FaqList, type Faq } from './Faq';

const items: Faq[] = [
  { id: 'return', question: '如何退货？', answer: '七天内可以无理由退货。' },
  { id: 'ship', question: '多久发货？', answer: '付款后 48 小时内发货。' },
  { id: 'invoice', question: '可以开发票吗？', answer: '可以，在订单详情中申请。' },
];

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<FaqList items={items} />);
```
:::

:::files{role=solution}
```tsx file=Faq.tsx
import { useState } from 'react';

export type Faq = { id: string; question: string; answer: string };

type FaqItemProps = {
  id: string;
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
};

export function FaqItem({ id, question, answer, isOpen, onToggle }: FaqItemProps) {
  return (
    <section>
      <h3>
        <button type="button" id={`faq-button-${id}`} aria-expanded={isOpen} aria-controls={`faq-panel-${id}`} onClick={onToggle}>
          {question}
        </button>
      </h3>
      <div id={`faq-panel-${id}`} role="region" aria-labelledby={`faq-button-${id}`} hidden={!isOpen}>
        {answer}
      </div>
    </section>
  );
}

export function FaqList({ items }: { items: readonly Faq[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const toggle = (id: string) => setOpenId(openId === id ? null : id);
  return (
    <div>
      {items.map((item) => (
        <FaqItem key={item.id} id={item.id} question={item.question} answer={item.answer} isOpen={openId === item.id} onToggle={() => toggle(item.id)} />
      ))}
    </div>
  );
}
```
:::

:::files{role=tests}
```tsx file=Faq.test.tsx
import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FaqList, type Faq } from './Faq';

const items: Faq[] = [
  { id: 'return', question: '如何退货？', answer: '七天内可以无理由退货。' },
  { id: 'ship', question: '多久发货？', answer: '付款后 48 小时内发货。' },
  { id: 'invoice', question: '可以开发票吗？', answer: '可以，在订单详情中申请。' },
];

const button = (name: string) => screen.getByRole('button', { name });

function panelOf(name: string): HTMLElement {
  const id = button(name).getAttribute('aria-controls');
  const panel = id === null ? null : document.getElementById(id);
  if (panel === null) throw new Error(`“${name}”的 aria-controls 没有指向一个存在的元素`);
  return panel;
}

test('一开始都是收起的；答案在页面中，但被隐藏', () => {
  render(<FaqList items={items} />);
  for (const item of items) {
    expect(button(item.question)).toHaveAttribute('aria-expanded', 'false');
    expect(panelOf(item.question)).toHaveTextContent(item.answer);
    expect(panelOf(item.question)).not.toBeVisible();
  }
});

test('同时只展开一个', async () => {
  const user = userEvent.setup();
  render(<FaqList items={items} />);
  await user.click(button('如何退货？'));
  expect(button('如何退货？')).toHaveAttribute('aria-expanded', 'true');
  expect(panelOf('如何退货？')).toBeVisible();
  await user.click(button('多久发货？'));
  expect(button('多久发货？')).toHaveAttribute('aria-expanded', 'true');
  expect(panelOf('多久发货？')).toBeVisible();
  expect(button('如何退货？')).toHaveAttribute('aria-expanded', 'false');
  expect(panelOf('如何退货？')).not.toBeVisible();
});

test('再点一次已经展开的问题，把它收起', async () => {
  const user = userEvent.setup();
  render(<FaqList items={items} />);
  await user.click(button('可以开发票吗？'));
  await user.click(button('可以开发票吗？'));
  expect(button('可以开发票吗？')).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryAllByRole('region')).toHaveLength(0);
});

test('展开的答案是一个以问题命名的区域', async () => {
  const user = userEvent.setup();
  render(<FaqList items={items} />);
  await user.click(button('多久发货？'));
  expect(screen.getByRole('region', { name: '多久发货？' })).toHaveTextContent('付款后 48 小时内发货。');
});
```
```tsx file=Faq.test-d.tsx
import { FaqItem } from './Faq';

// @ts-expect-error FaqItem 是受控组件：必须由父组件传入 isOpen 和 onToggle
const uncontrolled = <FaqItem id="a" question="问题" answer="答案" />;
const controlled = <FaqItem id="a" question="问题" answer="答案" isOpen={false} onToggle={() => {}} />;

console.log(uncontrolled, controlled);
```
:::

:::hint{level=1}
“哪一个展开了”只需要一个值：`useState<string | null>(null)`，存展开的那一项的 `id`，`null` 表示都收起。每个 `FaqItem` 的 `isOpen` 就是 `openId === item.id`。
:::

:::hint{level=2}
`onToggle={() => setOpenId(openId === item.id ? null : item.id)}`。答案的 `<div>` 一直渲染，用 `hidden={!isOpen}` 控制是否显示，这样 `aria-controls` 指向的元素始终存在。
:::

:::explanation
把 state 从每个 `FaqItem` 提升到 `FaqList` 之后，“同时只展开一个”这条规则就有了一个负责的地方：`openId` 只有一个值，不可能同时等于两个 id。规则不是靠代码“维护”出来的，而是 state 的结构本身就保证了它（g04 讲过的“让错误的状态表示不出来”）。

`FaqItem` 变成了受控组件：它不再自己决定是否展开，只负责显示 `isOpen` 并在点击时调用 `onToggle`。类型测试检查的正是这个“接口”：漏传 `isOpen` 就编译不过。

答案一直留在页面中、用 `hidden` 隐藏，而不是 `{isOpen && …}`：这样按钮的 `aria-controls` 始终指向一个存在的元素（WAI-ARIA 的手风琴模式就是这样写的）；`hidden` 的元素不会显示，也不会被读屏软件读到。
:::

:::variant{kind=wrong name=set-of-open fails=tests reason="提升了 state，但用集合记录展开的项，几个问题可以同时展开"}
```tsx file=Faq.tsx
import { useState } from 'react';

export type Faq = { id: string; question: string; answer: string };

type FaqItemProps = {
  id: string;
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
};

export function FaqItem({ id, question, answer, isOpen, onToggle }: FaqItemProps) {
  return (
    <section>
      <h3>
        <button type="button" id={`faq-button-${id}`} aria-expanded={isOpen} aria-controls={`faq-panel-${id}`} onClick={onToggle}>
          {question}
        </button>
      </h3>
      <div id={`faq-panel-${id}`} role="region" aria-labelledby={`faq-button-${id}`} hidden={!isOpen}>
        {answer}
      </div>
    </section>
  );
}

export function FaqList({ items }: { items: readonly Faq[] }) {
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) => {
    const next = new Set(openIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpenIds(next);
  };
  return (
    <div>
      {items.map((item) => (
        <FaqItem key={item.id} id={item.id} question={item.question} answer={item.answer} isOpen={openIds.has(item.id)} onToggle={() => toggle(item.id)} />
      ))}
    </div>
  );
}
```
:::

:::variant{kind=wrong name=no-collapse fails=tests reason="再点一次已经展开的问题时没有收起"}
```tsx file=Faq.tsx
import { useState } from 'react';

export type Faq = { id: string; question: string; answer: string };

type FaqItemProps = {
  id: string;
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
};

export function FaqItem({ id, question, answer, isOpen, onToggle }: FaqItemProps) {
  return (
    <section>
      <h3>
        <button type="button" id={`faq-button-${id}`} aria-expanded={isOpen} aria-controls={`faq-panel-${id}`} onClick={onToggle}>
          {question}
        </button>
      </h3>
      <div id={`faq-panel-${id}`} role="region" aria-labelledby={`faq-button-${id}`} hidden={!isOpen}>
        {answer}
      </div>
    </section>
  );
}

export function FaqList({ items }: { items: readonly Faq[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const toggle = (id: string) => setOpenId(id);
  return (
    <div>
      {items.map((item) => (
        <FaqItem key={item.id} id={item.id} question={item.question} answer={item.answer} isOpen={openId === item.id} onToggle={() => toggle(item.id)} />
      ))}
    </div>
  );
}
```
:::

:::variant{kind=wrong name=conditional-panel fails=tests reason="收起时把答案从页面中移除，aria-controls 指向了不存在的元素"}
```tsx file=Faq.tsx
import { useState } from 'react';

export type Faq = { id: string; question: string; answer: string };

type FaqItemProps = {
  id: string;
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
};

export function FaqItem({ id, question, answer, isOpen, onToggle }: FaqItemProps) {
  return (
    <section>
      <h3>
        <button type="button" id={`faq-button-${id}`} aria-expanded={isOpen} aria-controls={`faq-panel-${id}`} onClick={onToggle}>
          {question}
        </button>
      </h3>
      {isOpen && (
        <div id={`faq-panel-${id}`} role="region" aria-labelledby={`faq-button-${id}`}>
          {answer}
        </div>
      )}
    </section>
  );
}

export function FaqList({ items }: { items: readonly Faq[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const toggle = (id: string) => setOpenId(openId === id ? null : id);
  return (
    <div>
      {items.map((item) => (
        <FaqItem key={item.id} id={item.id} question={item.question} answer={item.answer} isOpen={openId === item.id} onToggle={() => toggle(item.id)} />
      ))}
    </div>
  );
}
```
:::
