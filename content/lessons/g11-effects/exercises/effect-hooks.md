---
kind: task
title: 两个常用的 Effect Hook
---
在 `hooks.ts` 中实现两个 Hook：

**`useDocumentTitle(title)`**：组件显示期间，页面标题（`document.title`）是 `title`，`title` 变化时跟着变；组件消失时，恢复成使用这个 Hook 之前的标题。

**`useInterval(callback, delay)`**：

1. 每隔 `delay` 毫秒调用一次 `callback`；`delay` 为 `null` 时不调用（暂停）；`delay` 变化时按新的间隔重新开始；
2. 总是调用**最新的** `callback`。组件每次渲染都会传入一个新的函数，**换函数不能让计时重新开始**；
3. 组件消失之后不再调用。

`Timer.tsx`（只读）是一个使用它们的计时器。注意它的 `useInterval(() => setSeconds(seconds + 1), …)` 要求每次调用的都是最新的回调，否则读到的永远是第一次渲染时的 `seconds`。预览在 iframe 中，看不到页面标题的变化，标题由测试检查。

:::files{role=starter}
```ts file=hooks.ts
import { useEffect, useEffectEvent } from 'react';

/** 组件显示期间把页面标题设为 title；组件消失时恢复原来的标题。 */
export function useDocumentTitle(title: string): void {
  document.title = title;
}

/** 每隔 delay 毫秒调用一次 callback；delay 为 null 时暂停。 */
export function useInterval(callback: () => void, delay: number | null): void {
  // TODO
}
```
:::

:::files{role=support}
```tsx file=Timer.tsx readonly
import { useState } from 'react';
import { useDocumentTitle, useInterval } from './hooks';

export function Timer() {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  useInterval(() => setSeconds(seconds + 1), running ? 1000 : null);
  useDocumentTitle(running ? `⏱ ${seconds} 秒` : '计时器');
  return (
    <p>
      {seconds} 秒{' '}
      <button type="button" onClick={() => setRunning(!running)}>
        {running ? '暂停' : '开始'}
      </button>
    </p>
  );
}
```
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { Timer } from './Timer';

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<Timer />);
```
:::

:::files{role=solution}
```ts file=hooks.ts
import { useEffect, useEffectEvent } from 'react';

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

export function useInterval(callback: () => void, delay: number | null): void {
  const onTick = useEffectEvent(callback);
  useEffect(() => {
    if (delay === null) return;
    const id = window.setInterval(() => onTick(), delay);
    return () => window.clearInterval(id);
  }, [delay]);
}
```
:::

:::files{role=tests}
```tsx file=hooks.test.tsx
import { Component, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import { useDocumentTitle, useInterval } from './hooks';

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? <p>渲染出错了</p> : this.props.children;
  }
}

function Broken(): ReactNode {
  throw new Error('渲染失败');
}

function Titled() {
  useDocumentTitle('不应该出现的标题');
  return null;
}

describe('useDocumentTitle', () => {
  test('设置标题，标题变化时更新，卸载时恢复原来的标题', () => {
    document.title = '原来的标题';
    const { rerender, unmount } = renderHook(({ title }) => useDocumentTitle(title), { initialProps: { title: '第一页' } });
    expect(document.title).toBe('第一页');
    rerender({ title: '第二页' });
    expect(document.title).toBe('第二页');
    unmount();
    expect(document.title).toBe('原来的标题');
  });

  test('渲染没有提交时不修改标题（渲染必须是纯的）', () => {
    document.title = '原来的标题';
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <Boundary>
        <Titled />
        <Broken />
      </Boundary>,
    );
    errors.mockRestore();
    expect(screen.getByText('渲染出错了')).toBeInTheDocument();
    expect(document.title, '组件没有显示出来，标题不应该改变').toBe('原来的标题');
  });

  test('StrictMode 中（React 会额外执行一次“清理、再执行”）结果也正确', () => {
    document.title = '原来的标题';
    const { unmount } = renderHook(() => useDocumentTitle('严格模式'), { reactStrictMode: true });
    expect(document.title).toBe('严格模式');
    unmount();
    expect(document.title).toBe('原来的标题');
  });
});

describe('useInterval', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('每隔 delay 毫秒调用一次', () => {
    const tick = vi.fn();
    renderHook(() => useInterval(tick, 1000));
    act(() => vi.advanceTimersByTime(999));
    expect(tick).toHaveBeenCalledTimes(0);
    act(() => vi.advanceTimersByTime(1));
    expect(tick).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(3000));
    expect(tick).toHaveBeenCalledTimes(4);
  });

  test('总是调用最新的 callback，并且换 callback 不会重新计时', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ cb }) => useInterval(cb, 1000), { initialProps: { cb: first } });
    act(() => vi.advanceTimersByTime(1500));
    rerender({ cb: second });
    act(() => vi.advanceTimersByTime(500));
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  test('delay 为 null 时暂停；改变 delay 按新的间隔重新开始', () => {
    const tick = vi.fn();
    const { rerender } = renderHook(({ delay }) => useInterval(tick, delay), { initialProps: { delay: null as number | null } });
    act(() => vi.advanceTimersByTime(5000));
    expect(tick).not.toHaveBeenCalled();
    rerender({ delay: 200 });
    act(() => vi.advanceTimersByTime(1000));
    expect(tick).toHaveBeenCalledTimes(5);
    rerender({ delay: null });
    act(() => vi.advanceTimersByTime(1000));
    expect(tick).toHaveBeenCalledTimes(5);
  });

  test('delay 从 1000 改成 200 时，按新的间隔计时', () => {
    const tick = vi.fn();
    const { rerender } = renderHook(({ delay }) => useInterval(tick, delay), { initialProps: { delay: 1000 } });
    act(() => vi.advanceTimersByTime(500));
    rerender({ delay: 200 });
    act(() => vi.advanceTimersByTime(1000));
    expect(tick).toHaveBeenCalledTimes(5);
  });

  test('卸载之后不再调用', () => {
    const tick = vi.fn();
    const { unmount } = renderHook(() => useInterval(tick, 100));
    act(() => vi.advanceTimersByTime(250));
    unmount();
    act(() => vi.advanceTimersByTime(1000));
    expect(tick).toHaveBeenCalledTimes(2);
  });
});
```
:::

:::hint{level=1}
`useDocumentTitle`：在 Effect 中先记下 `document.title`，再设置新的标题；清理函数把记下的标题设回去。依赖是 `[title]`。`useInterval`：在 Effect 中 `setInterval`，清理函数 `clearInterval`；`delay` 为 `null` 时直接 `return`。
:::

:::hint{level=2}
最新的 `callback` 又不能放进依赖：用 `const onTick = useEffectEvent(callback)`，在 `setInterval` 中调用 `onTick()`。依赖数组只写 `[delay]`。
:::

:::explanation
`useDocumentTitle` 是 Effect 最典型的形状：**做一件事，并在清理函数中撤销它**。起始代码在渲染时直接设置 `document.title`，这违反了“渲染必须是纯的”：React 可能渲染了一个组件却最终没有把它显示出来（例如兄弟组件出错、渲染被更紧急的更新打断），标题却已经改了。修改外部世界的事都放进 Effect，它只在组件真正显示出来之后才运行。`title` 变化时，React 先运行上一次的清理函数（恢复成更早的标题），再用新的 `title` 执行 Effect；组件消失时只运行清理函数。

`useInterval` 的难点在于 `callback`。调用方通常写一个内联函数，它每次渲染都是新的。把它放进依赖数组，每次渲染都会清除计时器、重新开始计时。在 `Timer` 中，每次 tick 之后才重新渲染，这个问题还不明显；但只要组件渲染得比 `delay` 更频繁（例如用户正在旁边的输入框中打字），计时器就一次也等不到（测试中“换 callback 不会重新计时”检查的就是这一点）；不放进依赖数组（直接在 `setInterval` 中调用第一次传入的 `callback`），用的就永远是第一次渲染时的函数，`Timer` 会一直显示 1 秒。`useEffectEvent` 正是为这种情况设计的：`onTick` 每次调用时都使用最新的 `callback`，而它本身不是依赖。

在 `useEffectEvent` 出现之前，常见的写法是用一个 ref 保存最新的 `callback`（每次渲染后在另一个 Effect 中更新 `ref.current`），替代解就是这样写的。
:::

:::variant{kind=alt name=latest-ref}
```ts file=hooks.ts
import { useEffect, useRef } from 'react';

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const before = document.title;
    document.title = title;
    return () => void (document.title = before);
  }, [title]);
}

export function useInterval(callback: () => void, delay: number | null): void {
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  });
  useEffect(() => {
    if (delay === null) return undefined;
    const id = setInterval(() => latest.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
```
:::

:::variant{kind=wrong name=title-in-render fails=tests reason="在渲染时设置标题，只把恢复放进了 Effect：没有显示出来的组件也改了标题"}
```ts file=hooks.ts
import { useEffect, useEffectEvent, useState } from 'react';

export function useDocumentTitle(title: string): void {
  const [previous] = useState(() => document.title);
  document.title = title;
  useEffect(
    () => () => {
      document.title = previous;
    },
    [previous],
  );
}

export function useInterval(callback: () => void, delay: number | null): void {
  const onTick = useEffectEvent(callback);
  useEffect(() => {
    if (delay === null) return;
    const id = window.setInterval(() => onTick(), delay);
    return () => window.clearInterval(id);
  }, [delay]);
}
```
:::

:::variant{kind=wrong name=null-only-deps fails=tests reason="依赖写成了 delay === null，间隔从 1000 改成 200 时没有重新开始"}
```ts file=hooks.ts
import { useEffect, useEffectEvent } from 'react';

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

export function useInterval(callback: () => void, delay: number | null): void {
  const onTick = useEffectEvent(callback);
  useEffect(() => {
    if (delay === null) return;
    const id = window.setInterval(() => onTick(), delay);
    return () => window.clearInterval(id);
  }, [delay === null]);
}
```
:::

:::variant{kind=wrong name=title-no-restore fails=tests reason="没有在清理函数中恢复原来的标题"}
```ts file=hooks.ts
import { useEffect, useEffectEvent } from 'react';

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

export function useInterval(callback: () => void, delay: number | null): void {
  const onTick = useEffectEvent(callback);
  useEffect(() => {
    if (delay === null) return;
    const id = window.setInterval(() => onTick(), delay);
    return () => window.clearInterval(id);
  }, [delay]);
}
```
:::

:::variant{kind=wrong name=callback-in-deps fails=tests reason="把 callback 放进了依赖：每次换函数都重新计时"}
```ts file=hooks.ts
import { useEffect } from 'react';

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

export function useInterval(callback: () => void, delay: number | null): void {
  useEffect(() => {
    if (delay === null) return;
    const id = window.setInterval(() => callback(), delay);
    return () => window.clearInterval(id);
  }, [callback, delay]);
}
```
:::

:::variant{kind=wrong name=stale-callback fails=tests reason="只用了第一次传入的 callback，之后换的函数不会被调用"}
```ts file=hooks.ts
import { useEffect } from 'react';

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

export function useInterval(callback: () => void, delay: number | null): void {
  useEffect(() => {
    if (delay === null) return;
    const id = window.setInterval(callback, delay);
    return () => window.clearInterval(id);
  }, [delay]);
}
```
:::

:::variant{kind=wrong name=no-clear fails=tests reason="没有清除计时器：暂停、改变间隔、卸载之后它仍在运行"}
```ts file=hooks.ts
import { useEffect, useEffectEvent } from 'react';

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

export function useInterval(callback: () => void, delay: number | null): void {
  const onTick = useEffectEvent(callback);
  useEffect(() => {
    if (delay === null) return;
    window.setInterval(() => onTick(), delay);
  }, [delay]);
}
```
:::
