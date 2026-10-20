---
version: 1
mode: react
estimatedMinutes: 35
review: ai-draft
problem: 界面上的列表几乎都来自数组：待办事项、搜索结果、评论。在 React 中把数组变成一组元素只需要一个 map，但每一项都需要一个 key。很多人用数组下标或者随机数凑合，平时看不出问题，直到删除、排序之后，一行的展开状态、输入框里的文字跑到了另一行。这一课讲怎样渲染列表、key 的作用，以及怎样选择一个正确的 key。
objectives:
  - 用 map 把数组渲染成元素，配合 filter、toSorted 显示筛选和排序后的结果，并处理空列表
  - 理解 key 的作用：React 用它在多次渲染之间对应同一项，从而保留每一项的 state 和 DOM
  - 选择稳定、唯一的 key（数据的 id），知道下标和随机数为什么不行
  - 给 Fragment 设置 key，知道 key 不会作为 prop 传给组件
references:
  - title: Rendering Lists — React
    url: https://react.dev/learn/rendering-lists
    checked: 2026-10-20
  - title: Preserving and Resetting State — React
    url: https://react.dev/learn/preserving-and-resetting-state
    checked: 2026-10-20
  - title: Fragment — React
    url: https://react.dev/reference/react/Fragment
    checked: 2026-10-20
---

## 用 map 渲染列表

JSX 的花括号中可以放一个**元素组成的数组**，React 会依次渲染它们。所以把数据变成列表，就是把数组 `map` 成元素：

:::playground{#map-list}
```tsx file=App.tsx
type Book = { id: string; title: string; year: number };

const books: readonly Book[] = [
  { id: 'b3', title: 'TypeScript 编程', year: 2019 },
  { id: 'b1', title: 'JavaScript 高级程序设计', year: 2020 },
  { id: 'b2', title: '深入浅出 React', year: 2024 },
];

export function App() {
  const recent = books.filter((b) => b.year >= 2020).toSorted((a, b) => b.year - a.year);
  return (
    <>
      <h2>全部（{books.length}）</h2>
      <ul>
        {books.map((book) => (
          <li key={book.id}>
            {book.title}（{book.year}）
          </li>
        ))}
      </ul>
      <h2>2020 年以后</h2>
      {recent.length === 0 ? (
        <p>没有符合条件的书。</p>
      ) : (
        <ol>
          {recent.map((book) => (
            <li key={book.id}>{book.title}</li>
          ))}
        </ol>
      )}
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
- 第 15–19 行：`map` 为每本书返回一个 `<li>`，每个 `<li>` 带有 `key`。
- 第 10 行：先 `filter`、再 `toSorted`，得到要显示的新数组（g04），原来的 `books` 不变。筛选和排序的结果直接在渲染时算出来，不需要另外存一份 state。
- 第 22–30 行：列表为空时显示一句说明，而不是一个空的 `<ol>`（e07 讲过空状态）。
- 把第 16 行的 `key={book.id}` 删掉再运行：页面看起来一样，但控制台出现了警告 “Each child in a list should have a unique "key" prop”。
:::

## key 是做什么的

每次渲染，组件都返回一组新的元素。React 要把它们和上一次渲染的结果**对应起来**：哪一项是原来的、哪一项是新增的、哪一项被删除了，然后只更新变化的部分。没有额外的信息时，它只能按**位置**对应：第 1 个对第 1 个，第 2 个对第 2 个。

`key` 就是你告诉 React 的“这一项是谁”。key 相同，React 就认为是同一项：保留它的 DOM 元素，以及它内部组件的 **state**；key 消失，就销毁；出现新的 key，就新建。

所以 key 选错的后果，往往不是“显示错了”，而是“**state 跟错了人**”：

:::playground{#index-key-bug}
```tsx file=App.tsx
import { useState } from 'react';

type Task = { id: number; title: string };

function TaskRow({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? '▼' : '▶'} {title}
      </button>
      {open && <p>“{title}”的详细说明……</p>}
    </li>
  );
}

const initialTasks: readonly Task[] = [
  { id: 1, title: '买菜' },
  { id: 2, title: '写周报' },
  { id: 3, title: '修自行车' },
];

export function App() {
  const [tasks, setTasks] = useState(initialTasks);
  const removeFirst = () => setTasks(tasks.slice(1));
  const reset = () => setTasks(initialTasks);
  return (
    <>
      <button type="button" onClick={removeFirst}>删除第一项</button>{' '}
      <button type="button" onClick={reset}>恢复</button>
      <h3>key 用下标</h3>
      <ul>
        {tasks.map((task, index) => (
          <TaskRow key={index} title={task.title} />
        ))}
      </ul>
      <h3>key 用 id</h3>
      <ul>
        {tasks.map((task) => (
          <TaskRow key={task.id} title={task.title} />
        ))}
      </ul>
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
- 在两个列表中都展开“写周报”，然后点“删除第一项”。
- 用 id 作 key 的列表：“写周报”仍然是展开的。用下标作 key 的列表：展开的变成了“修自行车”。因为删除之后，“写周报”的下标从 1 变成了 0，React 以为下标 1 的那一项（原来的“写周报”，带着 `open: true`）还在，只是标题变成了“修自行车”。
:::

## 怎样选择 key

- **用数据本身的 id**：数据库的主键、服务器返回的 `id`、本地生成数据时（例如新增一条待办）同时生成的 id（`crypto.randomUUID()`，或者一个递增的计数器）。
- key 只需要在**同一个列表的兄弟元素之间**唯一，不同列表可以重复。
- 不要在渲染时生成 key：`key={Math.random()}` 或 `key={crypto.randomUUID()}` 每次渲染都不一样，React 会以为所有项都是新的，每次都销毁重建，state 全部丢失，性能也很差。
- **下标**只在列表永远不会重新排序、筛选、在中间插入或删除时才安全。只要有一种情况可能发生，就用 id。
- 一项需要渲染成多个并列的元素时（例如 `<dt>` 和 `<dd>`），用带 key 的 `<Fragment key={item.id}>`。简写的 `<>` 不能写 key。

另外，`key` 是给 React 用的，**不会**作为 prop 传给组件：`TaskRow` 的参数里读不到 `key`。组件需要 id 时，另外传一个 prop，例如 `<TaskRow key={task.id} id={task.id} />`。

在 TypeScript 中，`key` 的类型是 `React.Key`，也就是 `string | number | bigint`。

::exercise{#contact-list}

## 编程挑战

::exercise{#playlist}

::quiz

## 常见错误

- **忘了写 key**：控制台警告。更重要的是，列表变化时 state 可能跟错了项。
- **用下标作 key，同时又会删除、排序**：state 和输入内容会错位。用数据的 id。
- **在渲染时生成随机的 key**：每次渲染都重建所有项，state 丢失。
- **把 key 写在了内层元素上**：key 要写在 `map` 直接返回的那个元素上。
- **在组件里读取 `props.key`**：读不到，需要的话另外传一个 prop。

## 下一步

下一课讲受控表单：让输入框的内容也成为 state，从而可以校验、重置和提交。
