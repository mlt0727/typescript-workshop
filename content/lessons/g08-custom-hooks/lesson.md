---
version: 1
mode: react
estimatedMinutes: 40
review: self-reviewed
problem: 几个组件里出现了几乎一样的代码：一个开关的 state 加上切换函数，一个带上下限的计数器，一个带校验的输入框。复制粘贴的逻辑改一处就要改好几处。React 中复用“带 state 的逻辑”的方式是自定义 Hook：把 useState 和相关的函数提取到一个以 use 开头的函数里。这一课讲怎样写自定义 Hook、Hook 必须遵守的规则、怎样给 Hook 的返回值写出好用的类型，以及怎样单独测试一个 Hook。
objectives:
  - 把组件中带 state 的逻辑提取成以 use 开头的自定义 Hook，理解它复用的是逻辑而不是 state
  - 遵守 Hook 的规则：只在组件或 Hook 的顶层调用，不放进条件、循环和普通函数中
  - 为 Hook 的返回值选择合适的形式（元组加 as const，或对象），写出泛型 Hook
  - 用 renderHook 和 act 单独测试一个 Hook
references:
  - title: Reusing Logic with Custom Hooks — React
    url: https://react.dev/learn/reusing-logic-with-custom-hooks
    checked: 2026-10-20
  - title: Rules of Hooks — React
    url: https://react.dev/reference/rules/rules-of-hooks
    checked: 2026-10-20
  - title: renderHook — React Testing Library
    url: https://testing-library.com/docs/react-testing-library/api#renderhook
    checked: 2026-10-20
---

## 提取一个 Hook

下面两个按钮各自需要一个“开/关”的 state 和切换函数。把这部分提取出来，就是一个**自定义 Hook**：一个名字以 `use` 开头、内部调用了其他 Hook 的普通函数。

:::playground{#use-toggle}
```tsx file=App.tsx
import { useState } from 'react';

function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  const toggle = () => setOn((value) => !value);
  return [on, toggle] as const;
}

function MuteButton() {
  const [muted, toggleMuted] = useToggle();
  return (
    <button type="button" aria-pressed={muted} onClick={toggleMuted}>
      <span aria-hidden="true">{muted ? '🔇' : '🔈'}</span> 静音
    </button>
  );
}

function ThemeSwitch() {
  const [dark, toggleDark] = useToggle(true);
  return (
    <button type="button" aria-pressed={dark} onClick={toggleDark}>
      <span aria-hidden="true">{dark ? '●' : '○'}</span> 深色模式
    </button>
  );
}

export function App() {
  return (
    <p>
      <MuteButton /> <ThemeSwitch /> <MuteButton />
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
- 第 3–7 行：`useToggle` 就是一个普通的函数，里面调用了 `useState`。
- 点两个“静音”按钮：它们互不影响。自定义 Hook 复用的是**逻辑**，每次调用都有**自己的** state，就像每个组件调用 `useState` 都得到自己的 state 一样。需要共享 state 时，还是要提升到共同的父组件（g07）。
- 第 6 行的 `as const`：把鼠标停在 `useToggle` 上。去掉 `as const` 再看，返回类型变成了 `(boolean | (() => void))[]`，解构出的 `muted` 就不能直接当布尔值用了。
- 按钮的文字始终是“静音”“深色模式”，状态由 `aria-pressed` 表达：读屏软件会读出“静音，切换按钮，已按下”。图标放在 `aria-hidden="true"` 中，只给眼睛看。如果文字也随状态变成“已静音”，状态就被读了两遍，而且用户分不清按下去是“静音”还是“取消静音”。
:::

## Hook 的规则

React 靠**调用的顺序**区分同一个组件中的多个 Hook：第一次 `useState` 对应第一个 state，第二次对应第二个……每次渲染的顺序必须完全相同。由此有两条规则：

1. **只在顶层调用 Hook**：不要放在 `if`、循环、提前 `return` 之后，也不要放在事件处理函数等普通函数里；
2. **只在 React 函数中调用 Hook**：组件，或者其他自定义 Hook。

自定义 Hook 的名字必须以 `use` 开头：这是给人和工具（ESLint 的 `react-hooks` 插件）看的信号，说明这个函数里有 Hook，要遵守上面的规则。反过来，一个函数里没有调用任何 Hook，就不要给它起 `use` 开头的名字，它只是一个普通的工具函数。

需要“有条件地”使用 state 时，把条件放在 Hook **里面**，或者放在使用它的值的地方，而不是包住 Hook 的调用。

## 返回值的形式与类型

- **元组**（`[value, setter]`）：调用方可以自由命名，适合只返回两三样东西的 Hook，例如 `useToggle`。记得写 `as const`，或者写出返回类型 `[boolean, () => void]`，否则 TypeScript 会推断出一个元素类型是联合类型的数组；
- **对象**：返回的东西多了，用对象更清楚，调用方按名字取用，也方便以后增加字段，例如 `{ value, increment, decrement, canIncrement }`。

Hook 也可以是泛型的（b14）。下面的 `useList<T>` 管理一个列表，`T` 由初始值推断出来（或者像 `useList<Tag>(…)` 这样写出来），返回的 `add(item: T)` 只接受这种元素：

:::playground{#use-list}
```tsx file=App.tsx
import { useState } from 'react';

function useList<T>(initial: readonly T[]) {
  const [items, setItems] = useState(initial);
  return {
    items,
    add: (item: T) => setItems((current) => [...current, item]),
    removeAt: (index: number) => setItems((current) => current.toSpliced(index, 1)),
  };
}

type Tag = { id: number; label: string };

export function App() {
  const tags = useList<Tag>([{ id: 1, label: 'TypeScript' }]);
  const numbers = useList([1, 2, 3]);
  return (
    <>
      <p>
        {tags.items.map((tag, index) => (
          <button key={tag.id} type="button" onClick={() => tags.removeAt(index)}>
            删除“{tag.label}”
          </button>
        ))}
      </p>
      <button type="button" onClick={() => tags.add({ id: Date.now(), label: `标签 ${tags.items.length + 1}` })}>
        添加标签
      </button>
      <p>数字：{numbers.items.join('、')}</p>
      <button type="button" onClick={() => numbers.add(numbers.items.length + 1)}>
        添加数字
      </button>
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
- 把鼠标停在 `numbers` 上：`T` 被推断为 `number`，`numbers.add` 的参数类型是 `number`。试着写 `numbers.add('4')` 或者 `tags.add({ id: 2 })`，都会报错。
- `useList` 没有写返回类型，TypeScript 从返回的对象推断出来：返回对象时不需要 `as const`，每个属性都有自己的类型。
:::

## 单独测试一个 Hook

测试组件时，我们渲染组件、操作界面。测试一个 Hook 时，不必为它专门写一个组件：React Testing Library 的 `renderHook` 在一个临时的组件中调用它，`result.current` 是最近一次渲染时 Hook 的返回值。改变 state 的调用要包在 `act()` 中，它保证 React 处理完更新之后，测试再继续往下：

```tsx
import { act, renderHook } from '@testing-library/react';

const { result } = renderHook(() => useToggle());
expect(result.current[0]).toBe(false);
act(() => result.current[1]());
expect(result.current[0]).toBe(true);
```

注意每次都从 `result.current` 读取：它会指向最新一次渲染的返回值。提前把 `result.current[0]` 存进变量，存的就是那一刻的快照（g03）。

::exercise{#use-counter}

## 编程挑战

::exercise{#use-undo}

::quiz

## 常见错误

- **以为调用同一个 Hook 的组件共享 state**：每次调用都是独立的。共享要靠状态提升或 Context。
- **在条件或循环中调用 Hook**：调用顺序一变，state 就会对错号。
- **返回元组却不写 `as const`**：解构出来的每一项都是联合类型。
- **没有调用 Hook 的函数也以 `use` 开头**：会误导读者和检查工具。
- **测试中读取了过时的 `result.current`**：每次断言前重新读取。

## 下一步

下一课讲 ref：在不触发渲染的情况下记住一个值，以及直接访问 DOM 元素的正确场合。
