---
version: 1
mode: react
estimatedMinutes: 40
review: self-reviewed
problem: 有些东西需要在多次渲染之间记住，却不应该显示在界面上：计时器的编号、上一次请求的控制器。还有些时候必须直接操作 DOM：点击“编辑”之后把焦点移到输入框，把新加的一项滚动到可见的位置。React 为这两种情况提供了 ref。它是一个可以随时修改、但修改了不会触发渲染的“盒子”。这一课讲 useRef 的两种用法、在 React 19 中把 ref 传给自己的组件，以及什么时候不该用 ref。
objectives:
  - 用 useRef 保存不参与渲染的值（例如计时器编号），区分 ref 与 state
  - 用 ref 访问 DOM 元素，完成聚焦、选中文字、滚动等 React 不直接负责的操作
  - 知道 state 更新后 DOM 要到下一次渲染才会变化，需要立即操作新的 DOM 时使用 flushSync
  - 在 React 19 中把 ref 作为普通的 prop 传给函数组件；知道 ref 回调和不该使用 ref 的场合
references:
  - title: Referencing Values with Refs — React
    url: https://react.dev/learn/referencing-values-with-refs
    checked: 2026-10-20
  - title: Manipulating the DOM with Refs — React
    url: https://react.dev/learn/manipulating-the-dom-with-refs
    checked: 2026-10-20
  - title: useRef — React
    url: https://react.dev/reference/react/useRef
    checked: 2026-10-20
  - title: React 19（ref as a prop）— React Blog
    url: https://react.dev/blog/2024/12/05/react-19
    checked: 2026-10-20
---

## ref：不触发渲染的“盒子”

`useRef(初始值)` 返回一个对象 `{ current: 初始值 }`。在组件的整个生命周期里，React 每次渲染都返回**同一个**对象；你可以随时修改 `ref.current`，但修改它**不会**触发重新渲染。

和 state 对比：

| | state | ref |
| --- | --- | --- |
| 修改后 | 触发重新渲染 | 不触发 |
| 读取 | 当前渲染的快照（g03） | 总是最新的值 |
| 适合 | 要显示在界面上的数据 | 计时器编号、DOM 元素等“幕后”的东西 |

一个常见的用法是保存计时器的编号：开始时记下 `setInterval` 返回的编号，停止时用它来清除。编号本身不显示在界面上，用不着 state：

:::playground{#timer-ref}
```tsx file=App.tsx
import { useRef, useState } from 'react';

export function App() {
  const [seconds, setSeconds] = useState(0);
  const timer = useRef<number | null>(null);

  function start() {
    if (timer.current !== null) return;
    timer.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
  }

  function stop() {
    if (timer.current === null) return;
    window.clearInterval(timer.current);
    timer.current = null;
  }

  return (
    <p>
      已经过去 {seconds} 秒{' '}
      <button type="button" onClick={start}>
        开始
      </button>{' '}
      <button type="button" onClick={stop}>
        停止
      </button>
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
- 第 5 行：`useRef<number | null>(null)` 的类型是 `RefObject<number | null>`，`current` 一开始是 `null`。
- 第 8 行：已经在计时就不再开一个，否则连点两次“开始”会有两个计时器，“停止”只能清除其中一个。
- 如果把编号存在普通的局部变量里，下一次渲染时它就被重新初始化了（g03）；存在 state 里，每次修改都会多一次没有必要的渲染。
- 这个示例还缺一件事：组件被移除时，计时器仍在运行。在组件被移除时做清理，要用 Effect（g11）。
:::

两条规则：**不要在渲染过程中读写 `ref.current`**（只在事件处理函数和 Effect 中使用），也**不要用 ref 代替要显示的数据**。渲染时读取 ref，界面就可能和 ref 的值不一致，因为修改 ref 不会触发渲染。唯一的例外是**惰性初始化**：`if (ref.current === null) ref.current = new Player();`，它只在第一次渲染时赋值，之后每次渲染的结果都一样。

## 用 ref 访问 DOM

把 ref 交给 JSX 元素的 `ref` 属性，React 创建 DOM 元素之后会把它放进 `ref.current`，元素被移除时再设回 `null`：

```tsx
const inputRef = useRef<HTMLInputElement>(null); // RefObject<HTMLInputElement | null>
<input ref={inputRef} />;
// 在事件处理函数中：
inputRef.current?.focus();
```

用 ref 操作 DOM，适合那些 React **不负责**的事：聚焦、选中文字、滚动、测量尺寸、调用浏览器的 API（例如播放视频）。React 负责的事（元素的内容、属性、增删）仍然交给 state 和 JSX：如果你用 ref 直接删掉了一个 React 渲染的元素，React 下一次更新时就会出错。

## 时机：state 更新后，DOM 要到下一次渲染才变

设置 state 不会立刻改变 DOM（g03）。所以“点击‘编辑’之后显示输入框，并把焦点移进去”这样写不行：

```tsx
function startEditing() {
  setEditing(true);
  inputRef.current?.focus(); // 这时输入框还没有渲染出来，inputRef.current 是 null
}
```

需要在 state 更新之后立刻操作新的 DOM 时，用 `react-dom` 的 `flushSync` 包住状态更新：它让 React **同步地**完成这次渲染，之后的代码就能看到新的 DOM：

:::playground{#flush-sync}
```tsx file=App.tsx
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';

export function App() {
  const [items, setItems] = useState(['第 1 项', '第 2 项', '第 3 项']);
  const listRef = useRef<HTMLUListElement>(null);

  function add() {
    flushSync(() => setItems((list) => [...list, `第 ${list.length + 1} 项`]));
    const last = listRef.current?.lastElementChild;
    if (last instanceof HTMLElement) {
      last.scrollIntoView({ block: 'nearest' });
      console.log('新的一项已经在 DOM 中：', last.textContent);
    }
  }

  return (
    <div>
      <button type="button" onClick={add}>
        添加一项
      </button>
      <ul ref={listRef} style={{ height: 100, overflow: 'auto' }}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
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
- 第 9 行：`flushSync` 返回时，新的 `<li>` 已经在 DOM 中了，第 10 行就能找到它并滚动到可见的位置。
- 去掉 `flushSync`，只保留里面的 `setItems(...)`：控制台打印的变成了**上一项**，列表也总是差一项才滚到底。
- `flushSync` 会打断 React 的批量更新，只在确实需要的地方使用。
:::

## 把 ref 传给自己的组件

在 React 19 中，函数组件可以像接收普通 prop 一样接收 `ref`，再把它交给内部的 DOM 元素，类型写成 `Ref<HTMLInputElement>`：

```tsx
import type { Ref } from 'react';

function TextField({ label, ref }: { label: string; ref?: Ref<HTMLInputElement> }) {
  return (
    <label>
      {label} <input ref={ref} />
    </label>
  );
}
// 使用者：<TextField label="邮箱" ref={emailRef} />
```

在旧版本的 React 中，这需要用 `forwardRef` 包装组件，旧代码和资料中经常能看到它。g02 中用 `ComponentProps<'button'>` 写的 `Button`，它的 props 里已经包含了 `ref`，展开 `{...rest}` 时就一起传下去了。

`ref` 属性也可以是一个函数（**ref 回调**）：React 在元素挂载时用元素调用它，元素移除时用 `null` 调用它。在 React 19 中，它还可以返回一个清理函数：返回了清理函数时，元素移除时 React 调用清理函数，不再用 `null` 调用回调。需要给列表中的每一项都保存一个元素时（例如“滚动到第 N 项”），ref 回调配合一个 `Map` 比为每一项准备一个 `useRef` 更方便：

```tsx
const items = useRef(new Map<string, HTMLLIElement>());
// …
<li
  key={todo.id}
  ref={(node) => {
    if (node) items.current.set(todo.id, node);
    return () => {
      items.current.delete(todo.id);
    };
  }}
>
```

两点要注意：

- 写在 JSX 中的箭头函数每次渲染都是一个新函数，React 发现回调变了，就会先清理旧的（调用清理函数，或者用 `null` 调用旧回调），再用元素调用新的。所以 ref 回调里只做“登记”这类重复执行也没关系的事，不要在里面聚焦、选中文字（挑战题会遇到这个问题）；
- 在 React 19 的类型中，ref 回调只能返回清理函数或者什么都不返回。`ref={(node) => (current = node)}` 这种简写会返回赋值的结果，TypeScript 会报错，要写成带花括号的函数体。

## 不该用 ref 的时候

- 要显示的数据：用 state；
- 能用 props 和 state 表达的交互：例如“打开对话框”应该是 state，而不是用 ref 去调用子组件的 `open()` 方法；
- 修改 React 渲染出的内容：交给 JSX。

ref 是 React 的“逃生口”：它让你走出 React 的数据流，直接接触外部的世界。用得越少，组件越容易理解。

::exercise{#search-box}

## 编程挑战

::exercise{#editable-title}

::quiz

## 常见错误

- **用 ref 保存要显示的数据**：修改它不会触发渲染，界面不会更新。
- **在渲染中读写 `ref.current`**：结果不可预测。只在事件处理函数和 Effect 中使用。
- **设置 state 之后立刻操作新的 DOM**：DOM 还没有更新。用 `flushSync`，或者在新元素上使用 ref 回调。
- **用 ref 删改 React 渲染的元素**：会和 React 的更新冲突。
- **在 React 19 中仍然到处写 `forwardRef`**：函数组件可以直接接收 `ref` prop。

## 下一步

下一课讲 Context：把数据“广播”给深层的组件，以及它适合和不适合的场合。
