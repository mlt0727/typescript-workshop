---
version: 1
mode: react
estimatedMinutes: 40
review: ai-draft
problem: 有些数据几乎整个应用都要用：当前的主题、登录的用户、界面语言。按 g07 的做法把它们一层层传下去，中间的每个组件都要接收、再转手，代码又长又脆弱。Context 让上层组件把数据“提供”给下面的整棵子树，任何深度的组件都可以直接读取。这一课讲 createContext、Provider 和 useContext 的用法，怎样用 TypeScript 写出“忘了放 Provider 就立刻报错”的 Context，以及 Context 适合和不适合的场合。
objectives:
  - 用 createContext 创建 Context，用 Provider 提供值，用 useContext 读取最近的 Provider 的值
  - 把 state 和修改它的函数一起放进 Context，写出 Provider 组件与配套的自定义 Hook
  - 用 null 作为默认值并在 Hook 中检查，让“缺少 Provider”在开发时立即暴露，同时得到不含 null 的类型
  - 判断什么时候该用 Context、什么时候用 props 或组合；知道 Context 的值变化时哪些组件会重新渲染
references:
  - title: Passing Data Deeply with Context — React
    url: https://react.dev/learn/passing-data-deeply-with-context
    checked: 2026-10-20
  - title: Scaling Up with Reducer and Context — React
    url: https://react.dev/learn/scaling-up-with-reducer-and-context
    checked: 2026-10-20
  - title: useContext — React
    url: https://react.dev/reference/react/useContext
    checked: 2026-10-20
  - title: use — React
    url: https://react.dev/reference/react/use
    checked: 2026-10-20
---

## 提供与读取

使用 Context 分三步：

1. **创建**：`const ThemeContext = createContext<Theme>('light')`，参数是**默认值**：组件上方没有任何 Provider 时，读到的就是它；
2. **提供**：在上层组件中用 `<ThemeContext value={theme}>…</ThemeContext>` 包住一棵子树（React 19 的写法；旧版本写作 `<ThemeContext.Provider value={…}>`，两者等价）；
3. **读取**：子树中任何深度的组件调用 `useContext(ThemeContext)`，得到**离它最近**的那个 Provider 的 `value`。

:::playground{#basic-context}
```tsx file=App.tsx
import { createContext, useContext, useState } from 'react';

type Theme = 'light' | 'dark';
const ThemeContext = createContext<Theme>('light');

function Badge() {
  const theme = useContext(ThemeContext);
  return <span className={`badge badge-${theme}`}>当前主题：{theme}</span>;
}

function Card({ title }: { title: string }) {
  return (
    <section>
      <h3>{title}</h3>
      <Badge />
    </section>
  );
}

export function App() {
  const [theme, setTheme] = useState<Theme>('dark');
  return (
    <>
      <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
        切换主题
      </button>
      <ThemeContext value={theme}>
        <Card title="外层卡片" />
        <ThemeContext value="light">
          <Card title="内层强制使用浅色" />
        </ThemeContext>
      </ThemeContext>
      <Card title="Provider 之外的卡片" />
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
- `Card` 完全不知道主题，`Badge` 直接读到了它：数据跳过了中间的组件。
- 第 29–31 行：内层的 Provider 覆盖了外层的值，它里面的 `Badge` 总是浅色。
- 第 33 行：Provider 之外的 `Badge` 读到的是默认值 `'light'`。
- 点“切换主题”：Provider 的 `value` 变了，所有读取它的组件都会重新渲染。
:::

## 把 state 和操作一起提供

实际使用中，Context 里通常放一个 state 以及修改它的函数，由一个专门的 **Provider 组件**负责保存 state。再配一个自定义 Hook（g08），使用者只需要调用这个 Hook。

默认值怎么写？大多数这样的 Context 在没有 Provider 时没有合理的值（`toggle` 能做什么呢？）。常见的做法是用 `null` 作为默认值，在 Hook 里检查：

:::playground{#provider-hook}
```tsx file=App.tsx
import { createContext, useContext, useState, type ReactNode } from 'react';

type User = { name: string };
type AuthValue = { user: User | null; signIn: (name: string) => void; signOut: () => void };

const AuthContext = createContext<AuthValue | null>(null);

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const value: AuthValue = {
    user,
    signIn: (name) => setUser({ name }),
    signOut: () => setUser(null),
  };
  return <AuthContext value={value}>{children}</AuthContext>;
}

function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (value === null) throw new Error('useAuth 必须在 <AuthProvider> 中使用');
  return value;
}

function Header() {
  const { user, signOut } = useAuth();
  if (user === null) return <p>未登录</p>;
  return (
    <p>
      你好，{user.name}{' '}
      <button type="button" onClick={signOut}>
        退出
      </button>
    </p>
  );
}

function SignInButton() {
  const { user, signIn } = useAuth();
  return (
    <button type="button" disabled={user !== null} onClick={() => signIn('韩梅梅')}>
      以韩梅梅的身份登录
    </button>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Header />
      <SignInButton />
    </AuthProvider>
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
- 第 6 行：默认值是 `null`，所以 Context 的类型是 `AuthValue | null`。
- 第 18–22 行：`useAuth` 检查之后返回的类型是 `AuthValue`，使用者不必再处理 `null`。忘了放 `<AuthProvider>` 时，错误信息直接告诉你缺了什么，而不是在某个地方读到 `undefined`。
- `Header` 和 `SignInButton` 是兄弟组件，它们通过同一个 Provider 共享登录状态，这正是 g07 的“状态提升”，只是数据不再需要一层层传递。
- 把 `<AuthProvider>` 去掉再运行，看看错误信息。
:::

React 19 还提供了 `use(Context)`，作用和 `useContext` 一样，但它可以写在 `if` 之后（这是 `use` 的特殊之处，其他 Hook 不行）。日常使用 `useContext` 即可。

## 什么时候用 Context

Context 方便，但它让数据流变得不那么明显：读一个组件的代码，看不出它的数据从哪里来；组件也只能在对应的 Provider 里面使用。所以：

- **先试 props 和组合**（g07）：只隔了一两层，直接传 props；中间的组件只是转手，试试把 JSX 作为 `children` 传进去；
- **适合 Context 的**：整棵树都要用的“环境”数据，例如主题、语言、当前用户、路由；或者一组紧密合作的组件（例如表格和它的行、选项卡和它的面板）共享的状态；
- **Context 不是状态管理的替代品**：它只负责“传递”，state 仍然由某个组件保存。

**重新渲染**：Provider 的 `value` 变化时（用 `Object.is` 比较），所有读取它的组件都会重新渲染。上面的 `AuthProvider` 每次渲染都创建一个新的 `value` 对象，所以它每次重新渲染，所有使用者也都会重新渲染。大多数情况下这没有问题；确实影响性能时，可以用 `useMemo` 保持 `value` 不变，或者把经常变化和不常变化的数据拆成两个 Context（g12）。

::exercise{#theme-context}

## 编程挑战

::exercise{#cart-context}

::quiz

## 常见错误

- **忘了放 Provider**：读到默认值，程序悄悄出错。用 `null` 默认值加检查的 Hook，让它立即报错。
- **在 Provider 所在的组件里读取它**：`useContext` 找的是**上方**最近的 Provider，同一个组件中写的 Provider 对它自己无效。
- **为了少传一两层 props 就用 Context**：先考虑 props 和组合。
- **把所有状态塞进一个巨大的 Context**：任何一项变化，所有使用者都会重新渲染。按用途拆分。
- **以为 Context 能“管理”状态**：state 仍然在 Provider 组件中，Context 只负责把它送下去。

## 下一步

下一课讲 Effect：让组件与外部系统（计时器、网络、浏览器 API）保持同步，以及依赖和清理。
