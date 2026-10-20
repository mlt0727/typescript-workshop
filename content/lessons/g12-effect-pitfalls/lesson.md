---
version: 1
mode: react
estimatedMinutes: 50
review: ai-draft
problem: 上一课讲了 Effect 的用法。Effect 很好用，所以也很容易被滥用：用它把 props 复制进 state、计算派生的数据、在 state 变化之后通知父组件、等“已提交”的标记变成 true 再发请求。这样的代码每次都多渲染一遍，先用过时的数据渲染一次，逻辑也分散在好几个地方。这一课讲哪些场景其实不需要 Effect（渲染时计算、用 key 重置、放进事件处理函数），以及 memo、useMemo、useCallback 这些性能工具的作用、正确用法和使用时机，最后介绍会自动完成这些优化的 React Compiler。
objectives:
  - 识别不需要 Effect 的场景：能从 props 和 state 算出来的值在渲染时计算；用 key 重置组件的 state；由用户操作引起的逻辑放进事件处理函数
  - 理解在 Effect 中同步地 setState 的代价：多一次渲染，并且先用过时的数据渲染了一次
  - 理解 memo 用 Object.is 逐个比较 props，用 useCallback、useMemo 保持引用不变；知道它们是优化而不是保证
  - 先测量、优先调整结构，再考虑记忆化；了解 React Compiler 会自动完成记忆化
references:
  - title: You Might Not Need an Effect — React
    url: https://react.dev/learn/you-might-not-need-an-effect
    checked: 2026-10-20
  - title: memo — React
    url: https://react.dev/reference/react/memo
    checked: 2026-10-20
  - title: useMemo — React
    url: https://react.dev/reference/react/useMemo
    checked: 2026-10-20
  - title: useCallback — React
    url: https://react.dev/reference/react/useCallback
    checked: 2026-10-20
  - title: "<Profiler> — React"
    url: https://react.dev/reference/react/Profiler
    checked: 2026-10-20
  - title: set-state-in-effect — eslint-plugin-react-hooks
    url: https://react.dev/reference/eslint-plugin-react-hooks/lints/set-state-in-effect
    checked: 2026-10-20
  - title: Introduction — React Compiler
    url: https://react.dev/learn/react-compiler/introduction
    checked: 2026-10-20
  - title: React Compiler v1.0 — React Blog
    url: https://react.dev/blog/2025/10/07/react-compiler-1
    checked: 2026-10-20
    note: 2025 年 10 月 7 日发布 1.0；本平台没有启用编译器
---

## 你可能不需要 Effect

Effect 是 React 的“逃生口”：它用来让组件与**外部系统**保持同步（g11）。如果这件事不涉及任何外部系统，多半就不需要 Effect。最常见的两类误用是：

- **为了渲染而转换数据**：例如根据筛选词算出要显示的列表，再存进 state；
- **处理用户的操作**：例如等某个标记变化之后再发请求、再通知父组件。

### 能算出来的，就在渲染时计算

下面两个组件显示同样的筛选结果，一个用 Effect 把结果存进 state，一个在渲染时直接计算。打开控制台，在输入框中**粘贴**一个“香”字（用拼音输入法打字时，组字过程中的每个字母也会触发一次渲染，只看选定“香”之后的几行）：

:::playground{#derived-state}
```tsx file=App.tsx
import { useEffect, useState } from 'react';

const FRUITS = ['苹果', '香蕉', '橙子', '葡萄', '芒果'];

function WithEffect({ query }: { query: string }) {
  const [visible, setVisible] = useState<readonly string[]>(FRUITS);
  useEffect(() => {
    setVisible(FRUITS.filter((fruit) => fruit.includes(query)));
  }, [query]);
  console.log(`Effect 版渲染：“${query}”，${visible.length} 项`);
  return <p>Effect 版：{visible.join('、') || '（没有）'}</p>;
}

function Derived({ query }: { query: string }) {
  const visible = FRUITS.filter((fruit) => fruit.includes(query));
  console.log(`计算版渲染：“${query}”，${visible.length} 项`);
  return <p>计算版：{visible.join('、') || '（没有）'}</p>;
}

export function App() {
  const [query, setQuery] = useState('');
  return (
    <>
      <label>
        筛选 <input value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
      </label>
      <WithEffect query={query} />
      <Derived query={query} />
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
- 粘贴“香”之后，Effect 版打印了两次：第一次渲染用的还是**上一次的**结果（这里是 5 项），等 Effect 执行、`setVisible` 之后，才又渲染一次得到 1 项。计算版只渲染一次，而且一开始就是对的。
- 刚打开页面时，Effect 版也渲染了两次：`filter` 返回的是一个新数组，即使内容相同，`setVisible` 也会再触发一次渲染。
- Effect 版还多了一份 state：`visible` 和 `query` 必须靠 Effect 保持一致，而计算版根本不存在“不一致”的可能。
:::

规则很简单：**能从 props 和 state 算出来的值，不要存进 state，在渲染时计算**（g07：能算出来的，就不另存）。在 Effect 中同步地调用 `setState`，几乎总是这种问题的信号。eslint-plugin-react-hooks 7 的推荐规则中有一条 `set-state-in-effect`，专门检查这种写法。

### 计算很慢时：useMemo

在渲染时计算，会不会太慢？绝大多数计算都很快：除非要创建或遍历成千上万个对象，否则不必担心。确实慢的时候，用 `useMemo` 把结果**缓存**起来：

```tsx
import { useMemo } from 'react';

const visibleTodos = useMemo(() => filterTodos(todos, tab), [todos, tab]);
```

第一次渲染时照常计算；之后只要依赖（`todos` 和 `tab`）都没有变化（用 `Object.is` 比较），就直接返回上一次的结果。几点注意：

- **先测量**：把计算放在 `console.time('筛选')` 和 `console.timeEnd('筛选')` 之间，操作一下界面。累计在 1 毫秒左右或者更多，才值得考虑缓存。开发模式比生产模式慢，测量要用生产构建；
- `useMemo` 不会让第一次渲染变快，它只在之后的渲染中跳过重复的计算；
- 传给 `useMemo` 的函数必须是纯的；它是一种**缓存**，不是保证：React 在某些情况下可能丢弃缓存、重新计算，代码的正确性不能依赖它。

### props 变化时重置 state：用 key

一个显示用户资料的组件，里面有一个评论框。切换到另一个用户时，评论框应该清空。用 Effect 写是这样的：

```tsx
function Profile({ userId }: { userId: string }) {
  const [comment, setComment] = useState('');
  useEffect(() => {
    setComment(''); // ❌ 先用旧的评论渲染一次，再清空
  }, [userId]);
  // …
}
```

更好的办法是告诉 React：这是**另一个**用户的资料，应该是一个全新的组件。g05 讲过，key 决定了组件的身份：

```tsx
function ProfilePage({ userId }: { userId: string }) {
  return <Profile key={userId} userId={userId} />;
}
```

`userId` 变了，`key` 跟着变，React 销毁旧的 `Profile`、创建新的，它和它的子组件中的所有 state 都回到初始值，不需要任何 Effect。

如果只想在 props 变化时**调整一部分** state，先看看能不能换一种 state 的结构：例如“选中的项”存它的 `id`，再在渲染时用 `id` 找出这一项（g07），列表变化之后自然就对了。实在需要时，可以在渲染期间根据新的 props 直接调整 state：

```tsx
const [prevItems, setPrevItems] = useState(items);
if (items !== prevItems) {
  setPrevItems(items);
  setSelection(null);
}
```

在渲染期间调用 `setState` 时，React 会丢掉这次的结果，**立刻**用新的 state 重新渲染这个组件，在提交到页面之前就完成了，子组件不会看到过时的值。这种写法只能更新组件**自己**的 state，并且要用条件防止无限循环。大多数组件都用不到它。

### 由用户操作引起的事：放进事件处理函数

决定一段代码放在哪里，问一个问题：**它为什么要运行？**

- 因为用户做了某件事（点了“注册”、勾选了一项）：放进**事件处理函数**；
- 因为组件显示在了页面上（打开页面就要记录一次访问、开始监听窗口尺寸）：放进 **Effect**。

例如注册表单：提交时发送注册请求，这是用户点“提交”引起的，写在 `onSubmit` 中；表单显示出来时上报一次访问统计，这是“显示”本身引起的，写在 Effect 中。如果把“注册”也写成 Effect（“`submitted` 变成 `true` 时发请求”），逻辑就和引起它的操作分开了，而且很容易出错：再提交一次时 `submitted` 已经是 `true`，Effect 不会再执行。

**通知父组件**也是同样的道理。下面两个开关都在状态变化时通知父组件：

:::playground{#notify-parent}
```tsx file=App.tsx
import { useEffect, useState } from 'react';

type ToggleProps = { label: string; onChange: (on: boolean) => void };

function ToggleWithEffect({ label, onChange }: ToggleProps) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    onChange(on);
  }, [on, onChange]);
  return (
    <button type="button" aria-pressed={on} onClick={() => setOn(!on)}>
      {label}
    </button>
  );
}

function Toggle({ label, onChange }: ToggleProps) {
  const [on, setOn] = useState(false);
  function toggle() {
    const next = !on;
    setOn(next);
    onChange(next);
  }
  return (
    <button type="button" aria-pressed={on} onClick={toggle}>
      {label}
    </button>
  );
}

const report = (name: string) => (on: boolean) => console.log(`${name}通知父组件：${on ? '开' : '关'}`);

export function App() {
  return (
    <p>
      <ToggleWithEffect label="Effect 版" onChange={report('Effect 版')} /> <Toggle label="事件版" onChange={report('事件版')} />
    </p>
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
- 刚打开页面，还什么都没点，控制台中就有了一条“Effect 版通知父组件：关”：Effect 在组件出现时就执行了。
- 第 7–9 行的 Effect 依赖 `onChange`。这里的 `App` 从不重新渲染，所以还看不出问题；如果父组件每次渲染都传入一个新的函数，Effect 版在父组件每次渲染之后都会再通知一次。父组件如果在 `onChange` 里写入的 state 每次都是新的值（例如往一个数组里追加一条记录），就会陷入“渲染、通知、更新、再渲染”的循环；即使不循环，也多了一轮渲染。
- 事件版在同一个事件处理函数中更新自己的 state 并通知父组件，React 把两处的更新合并成一次渲染。
:::

还有一种常见的写法是 **Effect 链**：一个 Effect 设置 state，触发另一个 Effect，再设置别的 state……每一环都多一次渲染，逻辑也很难追踪。能在渲染时算出来的就在渲染时算，需要随用户操作一起改变的几项 state，在同一个事件处理函数中一起设置。

### 什么时候仍然需要 Effect

与外部系统保持同步，仍然是 Effect 的本职工作（g11）：订阅浏览器事件、计时器、操作不受 React 管理的组件、因为“组件显示出来了”而请求数据（记得清理，g14 会把它整理成一个完整的数据加载 Hook）。订阅外部的数据源时，React 还提供了专门的 `useSyncExternalStore`。真实项目中请求数据，通常交给框架或数据请求库，它们还处理了缓存、重试等问题。

## 性能工具：memo、useCallback、useMemo

默认情况下，一个组件重新渲染时，它的所有子组件也会重新渲染。这通常没有问题：渲染只是调用组件函数、得到新的 JSX，React 比较之后只更新真正变化的 DOM。只有当某个组件的渲染确实很慢、又经常在 props 没有变化时被重新渲染，才需要优化。

`memo(组件)` 返回一个“记住了上一次渲染”的组件：父组件重新渲染时，如果传给它的**每一个 prop** 都和上一次相同（用 `Object.is` 比较），React 就跳过它。它自己的 state 或者它读取的 Context 变化时，它仍然会重新渲染。

问题在于“相同”是按引用比较的：父组件每次渲染时写的 `() => …`、`{ … }`、`[ … ]` 都是新的值，`memo` 就失效了。`useCallback(函数, 依赖)` 让函数在依赖不变时保持同一个引用，`useMemo` 对其他的值做同样的事。打开控制台试试：

:::playground{#memo-rows}
```tsx file=App.tsx
import { memo, useCallback, useState } from 'react';

type Item = { id: number; title: string; done: boolean };

const Row = memo(function Row({ item, onToggle }: { item: Item; onToggle: (id: number) => void }) {
  console.log(`渲染第 ${item.id} 行`);
  return (
    <li>
      <label>
        <input type="checkbox" checked={item.done} onChange={() => onToggle(item.id)} /> {item.title}
      </label>
    </li>
  );
});

export function App() {
  const [items, setItems] = useState<readonly Item[]>([
    { id: 1, title: '写周报', done: false },
    { id: 2, title: '修自行车', done: false },
    { id: 3, title: '买牛奶', done: true },
  ]);
  const [note, setNote] = useState('');

  const toggle = useCallback((id: number) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
  }, []);

  return (
    <>
      <label>
        备注 <input value={note} onChange={(e) => setNote(e.currentTarget.value)} />
      </label>
      <ul>
        {items.map((item) => (
          <Row key={item.id} item={item} onToggle={toggle} />
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
- 一开始打印了三行。在“备注”中输入：`App` 每次都重新渲染，三行却都没有再打印，因为它们的 `item` 和 `onToggle` 都和上一次相同，`memo` 跳过了它们。
- 勾选“修自行车”：只打印了“渲染第 2 行”。`map` 只替换了被修改的那一项，其他两项还是原来的对象（g04 讲过，没有改变的部分仍然是原来的对象，这里就用上了）。
- 把第 24–26 行改成普通的函数 `const toggle = (id: number) => { setItems(…); };`：每输入一个字，三行都会重新渲染，因为每次渲染都创建了一个新函数。去掉第 5 行的 `memo(…)`，效果也一样：`memo` 和稳定的 props 缺一不可。
- `useCallback` 的依赖是 `[]`：函数中用的是更新函数 `setItems((current) => …)`，不需要读取 `items`。如果直接读取 `items`，就要把它写进依赖，每次修改之后函数又变了，所有的行又都要重新渲染。
:::

传给 `memo` 组件的对象和数组用 `useMemo` 保持不变；Provider 的 `value` 也可以用 `useMemo` 包起来，避免 Provider 每次重新渲染都让所有使用者重新渲染（g10）。另一个办法是把经常变化的数据和不常变化的数据（例如“当前用户”和“正在输入的草稿”）拆成两个 Context，只读取不常变化的那个的组件，就不会因为草稿而重新渲染。

几点要记住：

- **它们是优化，不是保证**：React 仍然可能重新渲染一个 `memo` 组件。去掉所有的 `memo`、`useMemo`、`useCallback`，代码的行为必须完全一样，只是慢一些；
- `memo` 的第二个参数可以自定义比较函数，但它必须比较**所有**的 props，包括函数。漏掉 `onToggle` 之类的回调，组件就会一直使用旧的回调，读到旧的 state；
- 一个 prop 每次都是新的（例如内联的箭头函数），整个 `memo` 就白做了。

### 什么时候值得用

- **先找到真正慢的地方**：React DevTools 的 Profiler 能显示每次提交中每个组件渲染了多久。开发模式下的耗时偏大，只适合比较相对的快慢；要测准确的时间，需要开启了 profiling 的生产构建；
- **优先调整结构**：把经常变化的 state 放到真正用它的小组件中（上面的“备注”可以是一个自己保存输入内容的组件，`App` 就不会重新渲染了）；把内容作为 `children` 传进去；去掉不必要的 Effect；
- `memo` 最适合**交互细碎、频繁更新**的界面（拖拽、逐字输入时的大列表），而且只在“经常用相同的 props 重新渲染，并且渲染很慢”时才有收益。整页切换这类粗粒度的更新通常用不到。

## React Compiler

手写这些记忆化既繁琐又容易出错（漏一个依赖、多一个内联函数就失效）。**React Compiler** 是 React 团队发布的构建工具（2025 年 10 月发布 1.0），它在构建时分析组件，自动加上相当于 `memo`、`useMemo`、`useCallback` 的缓存，通常不比手写的差，很多时候更精确（例如在提前 `return` 之后也能缓存，手写的 Hook 做不到）。

- 新项目启用编译器后，通常不需要再手写它们；`useMemo`、`useCallback` 仍然可以作为“逃生口”，在需要精确控制时使用（例如一个值被用作 Effect 的依赖）。已有代码中的手写记忆化可以保留，删除之前要仔细测试；
- 编译器的前提是代码遵守 React 的规则：渲染是纯的、不修改 props 和 state、Hook 只在顶层调用。这正是前面几课一直在练习的。即使不用编译器，eslint-plugin-react-hooks 7 的推荐规则也会检查这些问题；
- 本平台的预览和练习**没有启用**编译器（代码只经过 TypeScript 编译），所以上面示例中 `memo` 的效果看得到，练习中也要手写。理解它们在做什么，读旧代码、排查性能问题时都用得上。

::exercise{#remove-effects}

## 编程挑战

::exercise{#memo-list}

::quiz

## 常见错误

- **把能算出来的值存进 state，再用 Effect 同步**：多一次渲染，还会先显示过时的数据。在渲染时计算，慢的计算用 `useMemo`。
- **用 Effect 在 props 变化时重置 state**：用 `key` 让 React 创建一个新的组件。
- **用“标记”加 Effect 处理用户的操作**：发请求、通知父组件，都在事件处理函数中直接做。
- **给 `memo` 组件传内联的函数或对象**：每次都是新的引用，`memo` 失效。用 `useCallback`、`useMemo`，或者调整结构。
- **`useCallback` 中读取 state 却不写进依赖**：函数里一直是旧的值。用更新函数，或者把它写进依赖。
- **到处加 `memo`、`useMemo`**：代码更难读，收益却不确定。先测量。

## 下一步

下一课用 React Router 组织多个页面：路由的配置、链接、路径参数，以及 e10 讲过的那些问题在 React 中是怎样解决的。
