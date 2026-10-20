---
kind: task
title: 主题的 Context
---
`theme.tsx` 中的 `ThemeToggle` 和 `Panel` 已经写好，它们通过 `useTheme()` 读取主题。完成剩下的部分：

1. 创建一个 Context，**默认值是 `null`**；
2. `ThemeProvider` 用 state 保存主题（初始值来自 `initial`，默认 `'light'`），把 `{ theme, toggle }` 提供给子树；`toggle` 在浅色和深色之间切换；
3. `useTheme()` 返回最近的 Provider 提供的值，类型是 `ThemeValue`（不含 `null`）；在 Provider 之外调用时抛出错误 `useTheme 必须在 <ThemeProvider> 中使用`。

:::files{role=starter}
```tsx file=theme.tsx
import { createContext, useContext, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';
export type ThemeValue = { theme: Theme; toggle: () => void };

// TODO：创建 Context、实现 ThemeProvider 和 useTheme
export function ThemeProvider({ initial = 'light', children }: { initial?: Theme; children: ReactNode }) {
  return <>{children}</>;
}

export function useTheme(): ThemeValue {
  return { theme: 'light', toggle: () => {} };
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" onClick={toggle}>
      {theme === 'light' ? '切换到深色' : '切换到浅色'}
    </button>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <section className={`panel panel-${theme}`} aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
```
:::

:::files{role=support}
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { Panel, ThemeProvider, ThemeToggle } from './theme';

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(
  <ThemeProvider>
    <ThemeToggle />
    <Panel title="今日待办">三件事</Panel>
    <Panel title="通知">没有新通知</Panel>
  </ThemeProvider>,
);
```
:::

:::files{role=solution}
```tsx file=theme.tsx
import { createContext, useContext, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';
export type ThemeValue = { theme: Theme; toggle: () => void };

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ initial = 'light', children }: { initial?: Theme; children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const toggle = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  return <ThemeContext value={{ theme, toggle }}>{children}</ThemeContext>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (value === null) throw new Error('useTheme 必须在 <ThemeProvider> 中使用');
  return value;
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" onClick={toggle}>
      {theme === 'light' ? '切换到深色' : '切换到浅色'}
    </button>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <section className={`panel panel-${theme}`} aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
```
:::

:::files{role=tests}
```tsx file=theme.test.tsx
import { expect, test } from 'vitest';
import { render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Panel, ThemeProvider, ThemeToggle, useTheme } from './theme';

const panel = (name: string) => screen.getByRole('region', { name });

test('切换主题时，Provider 中所有的面板一起变化', async () => {
  const user = userEvent.setup();
  render(
    <ThemeProvider>
      <ThemeToggle />
      <Panel title="甲">一</Panel>
      <div>
        <Panel title="乙">二</Panel>
      </div>
    </ThemeProvider>,
  );
  expect(panel('甲')).toHaveClass('panel', 'panel-light');
  expect(panel('乙')).toHaveClass('panel-light');
  await user.click(screen.getByRole('button', { name: '切换到深色' }));
  expect(panel('甲')).toHaveClass('panel-dark');
  expect(panel('乙')).toHaveClass('panel-dark');
  expect(screen.getByRole('button', { name: '切换到浅色' })).toBeInTheDocument();
});

test('initial 决定初始主题', () => {
  render(
    <ThemeProvider initial="dark">
      <Panel title="甲">一</Panel>
    </ThemeProvider>,
  );
  expect(panel('甲')).toHaveClass('panel-dark');
});

test('两个 Provider 互不影响', async () => {
  const user = userEvent.setup();
  render(
    <>
      <section aria-label="左">
        <ThemeProvider>
          <ThemeToggle />
          <Panel title="左面板">一</Panel>
        </ThemeProvider>
      </section>
      <section aria-label="右">
        <ThemeProvider>
          <ThemeToggle />
          <Panel title="右面板">二</Panel>
        </ThemeProvider>
      </section>
    </>,
  );
  await user.click(within(panel('左')).getByRole('button', { name: '切换到深色' }));
  expect(panel('左面板')).toHaveClass('panel-dark');
  expect(panel('右面板')).toHaveClass('panel-light');
});

test('在 Provider 之外使用 useTheme 立即报错', () => {
  expect(() => renderHook(() => useTheme())).toThrow('useTheme 必须在 <ThemeProvider> 中使用');
});
```
```tsx file=theme.test-d.tsx
import { expectTypeOf } from 'vitest';
import { useTheme, type ThemeValue } from './theme';

// useTheme 的返回值不包含 null，使用者不必再检查
expectTypeOf(useTheme).returns.toEqualTypeOf<ThemeValue>();
```
:::

:::hint{level=1}
`const ThemeContext = createContext<ThemeValue | null>(null)`。`ThemeProvider` 中 `useState<Theme>(initial)`，然后 `<ThemeContext value={{ theme, toggle }}>{children}</ThemeContext>`。
:::

:::hint{level=2}
`useTheme`：`const value = useContext(ThemeContext)`，`value === null` 时 `throw new Error(…)`，否则返回 `value`。检查之后 `value` 的类型就收窄成了 `ThemeValue`。
:::

:::explanation
默认值写成 `null` 并在 Hook 中检查，有两个好处：忘了放 Provider 时，错误在第一次渲染时就出现，信息直接说明了原因；而且 `useTheme` 的返回类型不含 `null`，每个使用者都不用再写一遍检查。

如果默认值写成 `{ theme: 'light', toggle: () => {} }`，没有 Provider 时组件照样能显示，只是按钮点了没有反应。这种“悄悄失效”的错误最难发现。

每个 `ThemeProvider` 都有自己的 state，所以两个 Provider 互不影响；`useTheme` 找的是**最近的**那一个。
:::

:::variant{kind=alt name=use-and-provider}
```tsx file=theme.tsx
import { createContext, use, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';
export type ThemeValue = { theme: Theme; toggle: () => void };

const ThemeContext = createContext<ThemeValue | null>(null);
ThemeContext.displayName = 'ThemeContext';

export function ThemeProvider(props: { initial?: Theme; children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(props.initial ?? 'light');
  const value: ThemeValue = { theme, toggle: () => setTheme(theme === 'light' ? 'dark' : 'light') };
  return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = use(ThemeContext);
  if (!value) {
    throw new Error('useTheme 必须在 <ThemeProvider> 中使用');
  }
  return value;
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" onClick={toggle}>
      {theme === 'light' ? '切换到深色' : '切换到浅色'}
    </button>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <section className={`panel panel-${theme}`} aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
```
:::

:::variant{kind=wrong name=silent-default fails=tests reason="默认值是一个“能用”的对象，忘了放 Provider 时不会报错，按钮只是悄悄失效"}
```tsx file=theme.tsx
import { createContext, useContext, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';
export type ThemeValue = { theme: Theme; toggle: () => void };

const ThemeContext = createContext<ThemeValue>({ theme: 'light', toggle: () => {} });

export function ThemeProvider({ initial = 'light', children }: { initial?: Theme; children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const toggle = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  return <ThemeContext value={{ theme, toggle }}>{children}</ThemeContext>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" onClick={toggle}>
      {theme === 'light' ? '切换到深色' : '切换到浅色'}
    </button>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <section className={`panel panel-${theme}`} aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
```
:::

:::variant{kind=wrong name=ignore-initial fails=tests reason="忽略了 initial"}
```tsx file=theme.tsx
import { createContext, useContext, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';
export type ThemeValue = { theme: Theme; toggle: () => void };

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ initial = 'light', children }: { initial?: Theme; children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const toggle = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  return <ThemeContext value={{ theme, toggle }}>{children}</ThemeContext>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (value === null) throw new Error('useTheme 必须在 <ThemeProvider> 中使用');
  return value;
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" onClick={toggle}>
      {theme === 'light' ? '切换到深色' : '切换到浅色'}
    </button>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <section className={`panel panel-${theme}`} aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
```
:::

:::variant{kind=wrong name=nullable-hook fails=types reason="useTheme 的返回类型包含 null，使用者都要自己检查"}
```tsx file=theme.tsx
import { createContext, useContext, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';
export type ThemeValue = { theme: Theme; toggle: () => void };

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ initial = 'light', children }: { initial?: Theme; children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const toggle = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  return <ThemeContext value={{ theme, toggle }}>{children}</ThemeContext>;
}

export function useTheme(): ThemeValue | null {
  return useContext(ThemeContext);
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" onClick={toggle}>
      {theme === 'light' ? '切换到深色' : '切换到浅色'}
    </button>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <section className={`panel panel-${theme}`} aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
```
:::
