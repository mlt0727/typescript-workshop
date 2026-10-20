---
version: 1
mode: react
estimatedMinutes: 45
review: self-reviewed
problem: 两个组件需要同一份数据时，最常见的错误是各存一份：手风琴里每个面板自己记着是否展开，结果“只能展开一个”的规则没处实现；列表记着选中的对象，修改了数据之后，详情里显示的还是旧的那份。这一课讲怎样决定 state 放在哪里：把共享的 state 提升到最近的共同父组件，让子组件变成“受控”的；怎样选择 state 的结构，避免重复和矛盾；以及用 children 组合组件，减少层层传递 props。
objectives:
  - 把多个组件共享的 state 提升到最近的共同父组件，用 props 传下数据和回调
  - 区分受控组件与非受控组件，写出 value + onChange 形式的受控组件
  - 选择 state 的结构：能算出来的不另存，存 id 而不是对象的副本，避免互相矛盾的 state
  - 用 children 组合组件以减少层层传递 props；用泛型和 NoInfer 写类型安全的受控组件
references:
  - title: Sharing State Between Components — React
    url: https://react.dev/learn/sharing-state-between-components
    checked: 2026-10-20
  - title: Choosing the State Structure — React
    url: https://react.dev/learn/choosing-the-state-structure
    checked: 2026-10-20
  - title: Thinking in React — React
    url: https://react.dev/learn/thinking-in-react
    checked: 2026-10-20
  - title: TypeScript 5.4（NoInfer）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-4.html
    checked: 2026-10-20
---

## 两份 state，各管各的

下面的手风琴想做到“同时只展开一个面板”，但每个面板都用自己的 state 记住是否展开：

:::playground{#separate-state}
```tsx file=App.tsx
import { useState, type ReactNode } from 'react';

function Panel({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section>
      <h3>
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
          {title}
        </button>
      </h3>
      {open && <div>{children}</div>}
    </section>
  );
}

export function App() {
  return (
    <>
      <Panel title="如何退货？">七天内可以无理由退货。</Panel>
      <Panel title="多久发货？">付款后 48 小时内发货。</Panel>
    </>
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
- 两个面板可以同时展开：每个 `Panel` 只知道自己的 `open`，不知道另一个面板的状态，也就没法在展开自己时收起别人。
:::

## 把 state 提升到共同的父组件

解决办法是**状态提升**（lifting state up）：找到需要这份数据的所有组件，在它们**最近的共同父组件**中保存 state，再通过 props 把数据和修改数据的函数传下去。子组件不再自己保存这份 state，而是完全由父组件控制：

:::playground{#lifted-state}
```tsx file=App.tsx
import { useState, type ReactNode } from 'react';

type PanelProps = {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
};

function Panel({ title, isOpen, onToggle, children }: PanelProps) {
  return (
    <section>
      <h3>
        <button type="button" aria-expanded={isOpen} onClick={onToggle}>
          {title}
        </button>
      </h3>
      {isOpen && <div>{children}</div>}
    </section>
  );
}

export function App() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const toggle = (index: number) => setOpenIndex(openIndex === index ? null : index);
  return (
    <>
      <Panel title="如何退货？" isOpen={openIndex === 0} onToggle={() => toggle(0)}>
        七天内可以无理由退货。
      </Panel>
      <Panel title="多久发货？" isOpen={openIndex === 1} onToggle={() => toggle(1)}>
        付款后 48 小时内发货。
      </Panel>
    </>
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
- 第 24 行：“哪个面板展开”只存一份，放在 `App` 里。`number | null` 表示“第几个展开，或者都不展开”，“同时展开两个”根本表示不出来。
- 第 10–21 行：`Panel` 不再有 state，它显示什么完全由 props 决定：这样的组件叫**受控组件**。它只负责在按钮被点击时调用 `onToggle`，至于点击之后发生什么，由父组件决定（g02 讲过的回调 props）。
- 第 25 行：再点一次已经展开的面板，就收起它。
:::

**受控与非受控**：自己保存 state 的组件（第一个例子中的 `Panel`）是**非受控**的，使用起来简单，但父组件影响不了它；由 props 决定的组件是**受控**的，更灵活，但父组件要负责保存 state。g06 的受控输入框是同样的道理：`<input value onChange>` 就是一个受控组件。写可复用的组件时，常见的约定就是这一对 props：`value`（当前的值）和 `onChange`（值应该变成什么）。

## state 应该是什么样子

决定了 state 放在哪里，还要决定它的**结构**。几条经验：

- **能从已有数据算出来的，不要另存**：筛选后的列表、合计、错误信息，都在渲染时计算（g05、g06）。另存一份，就要时刻保证两份一致；
- **不要存数据的副本，存它的 id**：选中的项存 `selectedId`，需要时从列表中找出来。存对象的副本，列表中的数据被修改之后，副本还是旧的；
- **避免互相矛盾的 state**：几个布尔值能组合出“不可能”的情况时，改用一个联合类型（e07 的加载状态、上面的 `openIndex`）；
- **一起变化的放在一起**：例如鼠标位置的 `x` 和 `y`，放进一个对象。

:::playground{#selected-copy}
```tsx file=App.tsx
import { useState } from 'react';

type Item = { id: number; title: string };

const initialItems: readonly Item[] = [
  { id: 1, title: '读完 g07' },
  { id: 2, title: '写练习' },
];

export function App() {
  const [items, setItems] = useState(initialItems);
  const [selectedCopy, setSelectedCopy] = useState<Item | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = items.find((item) => item.id === selectedId) ?? null;

  function rename(id: number) {
    setItems(items.map((item) => (item.id === id ? { ...item, title: `${item.title}（已修改）` } : item)));
  }

  return (
    <div>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.title}{' '}
            <button
              type="button"
              onClick={() => {
                setSelectedCopy(item);
                setSelectedId(item.id);
              }}
            >
              选中
            </button>{' '}
            <button type="button" onClick={() => rename(item.id)}>
              改名
            </button>
          </li>
        ))}
      </ul>
      <p>存副本：{selectedCopy?.title ?? '（未选中）'}</p>
      <p>存 id：{selected?.title ?? '（未选中）'}</p>
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
- 先“选中”第一项，再点它的“改名”：存 id 的那一行跟着变了，存副本的那一行还是旧标题。
- 第 14 行：`selected` 是在渲染时从 `items` 和 `selectedId` 算出来的，永远是最新的数据。
:::

## 用组合减少层层传递

state 提升之后，数据有时要穿过好几层组件才能到达用到它的地方，中间的组件只是“转手”（这叫 **prop drilling**）。在求助于 Context（g10）之前，先试试**组合**：让中间的组件接收 `children` 或者其他的 JSX props，由上层直接把内容“插”进去：

```tsx
// 中间的 Layout 不需要知道 user，只负责摆放
<Layout header={<UserMenu user={user} />} sidebar={<Nav />}>
  <Profile user={user} />
</Layout>
```

`Layout` 的 props 是 `header: ReactNode`、`sidebar: ReactNode` 和 `children: ReactNode`。`user` 从 `App` 直接传给了真正需要它的组件，不经过 `Layout`。

## 泛型的受控组件

可复用的受控组件常常需要泛型（b14）：一个“分段选择器”的选项可能是 `'day' | 'week'`，也可能是别的字符串。我们希望 `onChange` 收到的参数恰好是选项值的联合类型，`value` 也只能是其中之一：

```tsx
type Option<T extends string> = { value: T; label: string };

type SegmentedProps<T extends string> = {
  options: readonly Option<T>[];
  value: NoInfer<T>;
  onChange: (value: NoInfer<T>) => void;
};
```

`T` 应该从 `options` 推断出来。如果不加 `NoInfer`，TypeScript 也会根据 `value` 推断 `T`：写错成 `value="year"`，`T` 就被放宽成了 `'day' | 'week' | 'year'`，错误被悄悄接受了。`NoInfer<T>`（TypeScript 5.4 加入）告诉编译器“不要从这里推断 `T`”，于是 `value="year"` 会报错。挑战题会实现这个组件。

::exercise{#faq}

## 编程挑战

::exercise{#segmented-control}

::quiz

## 常见错误

- **两个组件各存一份相同的数据**：它们迟早会不一致。提升到共同的父组件，只存一份。
- **把能算出来的值存成 state**：筛选结果、合计、是否全部完成，都在渲染时计算。
- **选中项存成对象的副本**：数据修改后副本不会更新。存 id。
- **子组件把 props 复制进自己的 state**：`useState(props.value)` 只在第一次渲染时读取 props，之后父组件传入新值，子组件也看不到。要么做成受控组件直接使用 props，要么明确地把它当作“初始值”（命名为 `initialValue`）。
- **为了避免传递 props 立刻使用 Context**：先考虑组合（`children` 和 JSX props）。

## 下一步

下一课讲自定义 Hook：把组件中带 state 的逻辑提取出来，在多个组件之间复用。
