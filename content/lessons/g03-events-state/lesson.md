---
version: 1
mode: react
representative: true
estimatedMinutes: 35
review: ai-draft
problem: 组件需要“记住”用户的操作（计数、开关、输入），并在数据变化时更新界面。普通变量做不到这一点；用 state 时又容易被“state 是快照”这一规则绊倒。
objectives:
  - 在 JSX 中绑定事件处理函数：传入函数本身，而不是调用它的结果
  - 用 useState 声明 state，理解“设置 state → 重新渲染”
  - 理解 state 快照：同一个事件处理函数里多次 setCount(count + 1) 只加一次，需要时使用更新函数
  - 让 TypeScript 正确推断 state 与事件类型，在需要时显式写出（联合类型、提取出的事件处理函数）
references:
  - title: Responding to Events — React
    url: https://react.dev/learn/responding-to-events
    checked: 2026-10-20
  - title: "State: A Component's Memory — React"
    url: https://react.dev/learn/state-a-components-memory
    checked: 2026-10-20
  - title: State as a Snapshot — React
    url: https://react.dev/learn/state-as-a-snapshot
    checked: 2026-10-20
  - title: Queueing a Series of State Updates — React
    url: https://react.dev/learn/queueing-a-series-of-state-updates
    checked: 2026-10-20
  - title: Using TypeScript — React
    url: https://react.dev/learn/typescript
    checked: 2026-10-20
    note: 本平台使用 React 19.3 与 @types/react 19.3
---

## 普通变量为什么不够

在 React 里，组件就是一个返回 JSX 的函数。每次需要更新界面时，React 会**重新调用**这个函数（称为一次**渲染**，render）。所以组件函数里的普通局部变量每次渲染都从头创建；而且修改它不会通知 React 重新渲染。

`useState` 声明一个 **state 变量**：React 会在多次渲染之间记住它的值；调用它返回的设置函数会安排一次重新渲染。

:::playground{#plain-vs-state}
```tsx file=App.tsx
import { useState } from 'react';

export function App() {
  let plain = 0;
  const [count, setCount] = useState(0);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          plain++;
          console.log('plain =', plain);
        }}
      >
        普通变量 +1（显示 {plain}）
      </button>{' '}
      <button type="button" onClick={() => setCount(count + 1)}>
        state +1（显示 {count}）
      </button>
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
- 先多点几次左边按钮：控制台里的 `plain` 在增加，但按钮上显示的始终是 0——没有发生重新渲染。
- 再点右边按钮：界面更新了；之后再点左边按钮，`plain` 又从 1 开始，因为新的一次渲染重新执行了 `let plain = 0`。
- 把鼠标停在 `count` 上：`useState(0)` 让 TypeScript 推断出 `number`。
:::

注意 `onClick={() => setCount(count + 1)}` 传的是**一个函数**。如果写成 `onClick={setCount(count + 1)}`，`setCount` 会在渲染时立刻执行，而不是在点击时——这是初学者最常见的错误之一。

::exercise{#like-button}

## state 是一张快照

设置 state 只影响**下一次**渲染。在当前这次渲染的事件处理函数里，`count` 的值是固定的。所以连续写三次 `setCount(count + 1)`，相当于三次 `setCount(0 + 1)`。

如果新值依赖旧值，传入一个**更新函数**（updater function）：`setCount((c) => c + 1)`。React 会把这些函数排队，依次用最新的值去计算。

:::playground{#snapshot}
```tsx file=App.tsx
import { useState } from 'react';

export function App() {
  const [count, setCount] = useState(0);

  function addThreeWithValue() {
    setCount(count + 1);
    setCount(count + 1);
    setCount(count + 1);
    console.log('处理函数里读到的 count：', count);
  }

  function addThreeWithUpdater() {
    setCount((c) => c + 1);
    setCount((c) => c + 1);
    setCount((c) => c + 1);
  }

  return (
    <div>
      <p>count = {count}</p>
      <button type="button" onClick={addThreeWithValue}>
        +3（直接用 count）
      </button>{' '}
      <button type="button" onClick={addThreeWithUpdater}>
        +3（更新函数）
      </button>
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
- 左边按钮每次只加 1，控制台打印的是**点击前**的值；右边按钮每次加 3。
- 这和 Python/Java 里“给变量赋值后立刻能读到新值”的直觉不同：`setCount` 不是赋值，而是请求 React 在下一次渲染时使用新值。
:::

## 让 TypeScript 帮你检查事件与 state

**state 的类型**：`useState` 根据初始值推断类型。如果 state 可以取几种值，用类型参数写出联合类型，例如 `useState<'idle' | 'saving' | 'saved'>('idle')`；否则 TypeScript 会推断成宽泛的 `string`，拼错状态名也发现不了。

**事件的类型**：内联写的处理函数，参数类型会自动推断。把处理函数提取出来时需要显式写出类型，它们来自 `react` 包，例如 `ChangeEvent<HTMLInputElement>`。和上一章的原生 DOM 不同，React 事件的 `currentTarget` 已经带有元素类型，可以直接读取 `value`。

:::playground{#typed-events}
```tsx file=App.tsx
import { useState, type ChangeEvent } from 'react';

type Status = 'idle' | 'saving' | 'saved';

export function App() {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setName(event.currentTarget.value);
    setStatus('idle');
  }

  function handleSave() {
    setStatus('saving');
    setTimeout(() => setStatus('saved'), 500);
  }

  return (
    <div>
      <label>
        昵称 <input value={name} onChange={handleChange} />
      </label>{' '}
      <button type="button" onClick={handleSave} disabled={name === '' || status === 'saving'}>
        保存
      </button>
      <p>状态：{status}</p>
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
- 把第 16 行的 `'saved'` 改成 `'done'`：TypeScript 立即报错，因为 `'done'` 不在 `Status` 联合类型里。再试着把第 7 行的 `<Status>` 删掉，看看为什么这个错误就消失了。
- 把鼠标停在 `handleChange` 的 `event.currentTarget` 上：类型是 `EventTarget & HTMLInputElement`。
:::

## 编程挑战

::exercise{#stepper}

::quiz

## 常见错误

- **`onClick={doSomething()}`**：在渲染时就调用了函数。应传函数本身 `onClick={doSomething}`，或包一层 `onClick={() => doSomething(1)}`。
- **设置 state 后立刻读取，期待得到新值**：state 是当前渲染的快照；新值要到下一次渲染才看得到。
- **新值依赖旧值却直接用变量**：连续更新或在异步回调里更新时，用 `setX((x) => …)`。
- **直接修改 state**：`count++` 或修改 state 里的对象/数组都不会触发重新渲染（对象和数组的不可变更新在下一课讲）。
- **`useState(null)` 之后无法设置字符串**：TypeScript 会推断出 `null` 类型；需要写成 `useState<string | null>(null)`。

## 下一步

下一课讲不可变更新：当 state 是对象或数组时，如何创建新值而不是修改旧值。
