---
version: 1
mode: react
estimatedMinutes: 50
review: ai-draft
problem: 组件的渲染必须是纯计算：根据 props 和 state 算出 JSX。可是有些事情不在 React 的管辖范围内：修改页面标题、监听窗口的尺寸、订阅网络状态、发起请求、启动计时器。它们要在组件显示出来之后进行，在组件消失或者数据变化时停止。Effect 就是用来“让组件与外部系统保持同步”的工具。这一课讲 useEffect 的执行时机、依赖数组、清理函数，在 Effect 中请求数据时怎样避免竞态，以及 React 19.2 加入的 useEffectEvent。
objectives:
  - 理解 Effect 的作用是与外部系统同步，它在渲染提交到页面之后执行
  - 正确地写出依赖数组：Effect 中用到的每一个响应式的值都要列出；理解 [] 与省略依赖的区别
  - 用清理函数撤销 Effect 做的事（移除监听器、清除计时器、中止请求），知道开发模式下 Effect 会被多执行一次
  - 在 Effect 中请求数据时用 AbortController 避免竞态；用 useEffectEvent 读取最新的 props 而不触发 Effect 重新执行
references:
  - title: Synchronizing with Effects — React
    url: https://react.dev/learn/synchronizing-with-effects
    checked: 2026-10-20
  - title: Lifecycle of Reactive Effects — React
    url: https://react.dev/learn/lifecycle-of-reactive-effects
    checked: 2026-10-20
  - title: Separating Events from Effects — React
    url: https://react.dev/learn/separating-events-from-effects
    checked: 2026-10-20
  - title: useEffect — React
    url: https://react.dev/reference/react/useEffect
    checked: 2026-10-20
  - title: useEffectEvent — React
    url: https://react.dev/reference/react/useEffectEvent
    checked: 2026-10-20
    note: 本平台使用 React 19.3；useEffectEvent 从 React 19.2 起是稳定的 API
---

## 渲染之外的事情

React 对组件有一个要求：**渲染必须是纯的**（g02），同样的 props 和 state 总是得到同样的 JSX，渲染过程中不修改任何外部的东西。那么修改 `document.title`、给 `window` 添加监听器这类事情放在哪里？

- 由用户的某个操作引起的（点击“保存”之后发请求），放在**事件处理函数**里；
- 由“组件显示在页面上”这件事本身引起的（只要这个组件在，就要监听窗口尺寸），放在 **Effect** 里。

`useEffect(setup, dependencies)` 中的 `setup` 在**渲染的结果提交到页面之后**执行。它可以返回一个**清理函数**：组件从页面上移除时，或者 Effect 因为依赖变化要重新执行之前，React 先调用清理函数。

:::playground{#setup-cleanup}
```tsx file=App.tsx
import { useEffect, useState } from 'react';

function WindowWidth() {
  const [width, setWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    console.log('开始监听 resize');
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => {
      console.log('停止监听 resize');
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return <p>窗口宽度：{width}px（拖动预览区右下角改变它）</p>;
}

export function App() {
  const [show, setShow] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setShow(!show)}>
        {show ? '隐藏' : '显示'}
      </button>
      {show && <WindowWidth />}
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
- 第 6–14 行：Effect 添加监听器，返回的清理函数移除它。点“隐藏”，控制台打印“停止监听”；再点“显示”，又重新开始。
- 第 14 行的 `[]` 表示这个 Effect 不依赖任何会变化的值：只在组件出现时执行一次，在组件消失时清理。
- 如果没有清理函数，每次显示组件都会多加一个监听器，隐藏之后它们仍然在运行，还会去更新一个已经不在页面上的组件。
:::

**关于开发模式：** 用 `<StrictMode>` 包住应用时（Vite 等脚手架生成的项目默认如此），React 在开发环境中会让每个组件**挂载、卸载、再挂载**一次，于是 Effect 执行、清理、再执行。这是故意的：如果你的 Effect 少了清理，这样一来问题立刻就会暴露出来。生产环境中不会这样。本平台的预览没有使用 `StrictMode`。

## 依赖数组

React 用依赖数组决定**什么时候重新同步**：

| 写法 | 什么时候执行 |
| --- | --- |
| `useEffect(fn, [a, b])` | 第一次渲染之后，以及之后 `a` 或 `b` 变化（`Object.is` 比较）的每一次渲染之后 |
| `useEffect(fn, [])` | 只在第一次渲染之后 |
| `useEffect(fn)`（省略） | 每一次渲染之后 |

规则只有一条：**Effect 中用到的每一个响应式的值（props、state、以及由它们算出的值）都必须出现在依赖数组中**。漏写依赖，Effect 用的就是第一次渲染时的旧值，这种错误很难发现。实际项目中由 ESLint 的 `react-hooks/exhaustive-deps` 规则检查。不要为了“让 Effect 少执行几次”而删掉依赖；需要的是改写代码，让 Effect 真的不需要这个值。

`useEffect` 的类型也会帮你：setup 只能返回 `undefined` 或者一个清理函数，所以 `useEffect(async () => { … })` 会被 TypeScript 拒绝（async 函数返回的是 Promise）。在 Effect 里定义一个 async 函数再调用它。

## 在 Effect 中请求数据：竞态

一个根据 `userId` 显示用户的组件，`userId` 变化时要重新请求。这和 e08 的“后发先至”是同一个问题：先选用户 1（服务器很慢），马上又选用户 2（很快），用户 1 的响应后到，覆盖了正确的结果。清理函数正好可以解决它：依赖变化时，React 先清理上一次的 Effect，在那里中止旧的请求。

:::playground{#fetch-effect fixtures=users}
```tsx file=App.tsx
import { useEffect, useState } from 'react';

type User = { id: number; name: string };

function isUser(value: unknown): value is User {
  return typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'number' && 'name' in value && typeof value.name === 'string';
}

function Profile({ userId }: { userId: number }) {
  const [loaded, setLoaded] = useState<User | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/users/${userId}`, { signal: controller.signal });
        const data: unknown = await response.json();
        if (isUser(data)) setLoaded(data);
      } catch (err) {
        if (!controller.signal.aborted) console.error(err);
      }
    }
    void load();
    return () => controller.abort();
  }, [userId]);

  const user = loaded?.id === userId ? loaded : null;
  return <p>{user === null ? '加载中…' : `用户 ${user.id}：${user.name}`}</p>;
}

export function App() {
  const [userId, setUserId] = useState(1);
  return (
    <>
      {[1, 2, 3].map((id) => (
        <button key={id} type="button" aria-pressed={id === userId} onClick={() => setUserId(id)}>
          用户 {id}
        </button>
      ))}
      <Profile userId={userId} />
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
- 模拟的服务器上，用户 1 要 900 毫秒，用户 2 只要 200 毫秒。运行之后马上点“用户 2”：最终显示的是用户 2。
- 第 24 行：`userId` 变化时，React 先调用上一次的清理函数，中止用户 1 的请求，再用新的 `userId` 执行 Effect。
- 第 14–23 行：Effect 本身不能是 async 函数，所以在里面定义 `load` 再调用（`void` 表示有意不等待它，e07）。
- 第 20 行：被我们中止的请求不是错误，不必报告（e08）。
- 第 27 行：已经加载的用户不是当前的 `userId` 时，显示“加载中…”。这个值在渲染时算出来，不需要在 Effect 中先 `setLoaded(null)`（在 Effect 中同步地设置 state 会多一次渲染，下一课会讲）。
- 把第 24 行改成 `return () => {};` 再试：运行后马上点“用户 2”，先显示了李雷；0.9 秒后，没有被中止的用户 1 的响应才到达，覆盖了已经加载好的数据，界面又变回“加载中…”。
:::

在 Effect 中请求数据是可行的，但完整地处理加载、错误、缓存、重试要写很多代码。实际项目中通常交给框架（例如 Next.js 的服务端组件，H 阶段）或者数据请求库。g14 会把这一节扩展成一个完整的数据加载 Hook。

## 读取最新的值，但不重新同步

有时 Effect 需要读取某个值的**最新**内容，却不希望这个值的变化让 Effect 重新执行。例如聊天室的连接只应该在 `roomId` 变化时重建，但连接成功时要用当前的主题显示一条通知；把 `theme` 列进依赖，切换主题就会断线重连。

React 19.2 起，`useEffectEvent` 解决这个问题：它返回一个函数，这个函数里读到的永远是最新的 props 和 state，而它本身**不是**依赖：

```tsx
const onConnected = useEffectEvent(() => {
  showNotification('已连接', theme); // 总是最新的 theme
});

useEffect(() => {
  const connection = createConnection(roomId);
  connection.on('connected', () => onConnected());
  connection.connect();
  return () => connection.disconnect();
}, [roomId]); // 不需要 theme，也不需要 onConnected
```

Effect Event 只能在 Effect 内部调用，不要把它传给其他组件，也不要在渲染时调用。挑战题会用它读取最新的回调 props。

::exercise{#effect-hooks}

## 编程挑战

::exercise{#city-search}

::quiz

## 常见错误

- **在渲染过程中修改外部的东西**：例如直接在组件函数体里改 `document.title`。放进 Effect。
- **漏写依赖**：Effect 用的是旧值。每个用到的响应式的值都要列出。
- **添加监听器、启动计时器却不清理**：组件消失之后它们仍在运行。
- **把 async 函数直接传给 `useEffect`**：在 Effect 内部定义 async 函数再调用。
- **请求数据时不处理竞态**：在清理函数中中止请求（或者用一个标记忽略过时的结果）。
- **用 Effect 处理本该在事件处理函数中完成的事**：例如“点击提交后发送请求”应该写在 `onSubmit` 中（下一课）。

## 下一步

下一课讲什么时候**不需要** Effect：很多看起来需要 Effect 的场景，其实应该在渲染时计算，或者放在事件处理函数里；以及 memo、useMemo、useCallback 这些性能工具的正确用法。
