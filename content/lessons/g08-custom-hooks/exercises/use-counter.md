---
kind: task
title: useCounter：带上下限的计数器
---
g03 的挑战题写过一个数量步进器。把其中的计数逻辑提取成一个可复用的 Hook：实现 `useCounter({ min, max, initial, step })`，返回一个 `Counter` 对象：

| 字段 | 含义 |
| --- | --- |
| `value` | 当前的值。初始为 `initial`（默认等于 `min`），超出范围时限制到 `min`–`max` 之内 |
| `increment()`、`decrement()` | 增加、减少 `step`（默认 1），结果不超出范围 |
| `reset()` | 回到初始值（同样限制在范围内） |
| `canIncrement`、`canDecrement` | 还能不能增加、减少 |

在同一个事件处理函数中连续调用两次 `increment()`，两次都要生效。`Stepper.tsx`（只读）使用了这个 Hook，可以在预览中试试。

:::files{role=starter}
```ts file=useCounter.ts
import { useState } from 'react';

export type CounterOptions = { min: number; max: number; initial?: number; step?: number };

export type Counter = {
  value: number;
  increment(): void;
  decrement(): void;
  reset(): void;
  canIncrement: boolean;
  canDecrement: boolean;
};

export function useCounter({ min, max, initial = min, step = 1 }: CounterOptions): Counter {
  // TODO：用 useState 保存当前值，返回 Counter 中的各项
  return {
    value: initial,
    increment: () => {},
    decrement: () => {},
    reset: () => {},
    canIncrement: false,
    canDecrement: false,
  };
}
```
:::

:::files{role=support}
```tsx file=Stepper.tsx readonly
import { useCounter } from './useCounter';

export function Stepper() {
  const counter = useCounter({ min: 1, max: 10, initial: 3, step: 2 });
  return (
    <p>
      <button type="button" aria-label="减少" disabled={!counter.canDecrement} onClick={counter.decrement}>
        −
      </button>{' '}
      <output aria-label="数量">{counter.value}</output>{' '}
      <button type="button" aria-label="增加" disabled={!counter.canIncrement} onClick={counter.increment}>
        +
      </button>{' '}
      <button type="button" onClick={counter.reset}>
        重置
      </button>
    </p>
  );
}
```
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { Stepper } from './Stepper';

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<Stepper />);
```
:::

:::files{role=solution}
```ts file=useCounter.ts
import { useState } from 'react';

export type CounterOptions = { min: number; max: number; initial?: number; step?: number };

export type Counter = {
  value: number;
  increment(): void;
  decrement(): void;
  reset(): void;
  canIncrement: boolean;
  canDecrement: boolean;
};

export function useCounter({ min, max, initial = min, step = 1 }: CounterOptions): Counter {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const [value, setValue] = useState(() => clamp(initial));
  return {
    value,
    increment: () => setValue((v) => Math.min(max, v + step)),
    decrement: () => setValue((v) => Math.max(min, v - step)),
    reset: () => setValue(clamp(initial)),
    canIncrement: value < max,
    canDecrement: value > min,
  };
}
```
:::

:::files{role=tests}
```tsx file=useCounter.test.tsx
import { describe, expect, test } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCounter } from './useCounter';
import { Stepper } from './Stepper';

describe('useCounter', () => {
  test('初始值、增加、减少、重置', () => {
    const { result } = renderHook(() => useCounter({ min: 0, max: 10, initial: 4, step: 3 }));
    expect(result.current.value).toBe(4);
    act(() => result.current.increment());
    expect(result.current.value).toBe(7);
    act(() => result.current.decrement());
    act(() => result.current.decrement());
    expect(result.current.value).toBe(1);
    act(() => result.current.reset());
    expect(result.current.value).toBe(4);
  });

  test('不超出范围；到达边界时 canIncrement / canDecrement 为 false', () => {
    const { result } = renderHook(() => useCounter({ min: 0, max: 5, initial: 4, step: 3 }));
    expect(result.current.canIncrement).toBe(true);
    act(() => result.current.increment());
    expect(result.current.value).toBe(5);
    expect(result.current.canIncrement).toBe(false);
    act(() => result.current.decrement());
    act(() => result.current.decrement());
    expect(result.current.value).toBe(0);
    expect(result.current.canDecrement).toBe(false);
    expect(result.current.canIncrement).toBe(true);
  });

  test('默认从 min 开始、步长为 1；超出范围的初始值被限制在范围内', () => {
    expect(renderHook(() => useCounter({ min: 2, max: 9 })).result.current.value).toBe(2);
    expect(renderHook(() => useCounter({ min: 2, max: 9, initial: 50 })).result.current.value).toBe(9);
    expect(renderHook(() => useCounter({ min: 2, max: 9, initial: -1 })).result.current.value).toBe(2);
    expect(renderHook(() => useCounter({ min: -5, max: 5 })).result.current.value).toBe(-5);
    const { result } = renderHook(() => useCounter({ min: 2, max: 9 }));
    act(() => result.current.increment());
    expect(result.current.value).toBe(3);
  });

  test('重置时同样限制在范围内', () => {
    const { result } = renderHook(() => useCounter({ min: 2, max: 9, initial: 50 }));
    act(() => result.current.decrement());
    expect(result.current.value).toBe(8);
    act(() => result.current.reset());
    expect(result.current.value).toBe(9);
  });

  test('同一个事件中连续调用两次，两次都生效', () => {
    const { result } = renderHook(() => useCounter({ min: 0, max: 100, step: 10 }));
    act(() => {
      result.current.increment();
      result.current.increment();
    });
    expect(result.current.value).toBe(20);
  });

  test('每次调用都有自己的 state', () => {
    const first = renderHook(() => useCounter({ min: 0, max: 9 }));
    const second = renderHook(() => useCounter({ min: 0, max: 9 }));
    act(() => first.result.current.increment());
    expect(first.result.current.value).toBe(1);
    expect(second.result.current.value).toBe(0);
  });
});

test('Stepper 组件使用这个 Hook', async () => {
  const user = userEvent.setup();
  render(<Stepper />);
  await user.click(screen.getByRole('button', { name: '增加' }));
  expect(screen.getByRole('status', { name: '数量' })).toHaveTextContent('5');
  await user.click(screen.getByRole('button', { name: '重置' }));
  expect(screen.getByRole('status', { name: '数量' })).toHaveTextContent('3');
});
```
:::

:::hint{level=1}
用 `useState` 保存 `value`，其他的都从它和参数算出来：`canIncrement` 就是 `value < max`。写一个 `clamp(n)` 把数字限制在范围内，初始值和重置都用它。
:::

:::hint{level=2}
连续调用两次都要生效，说明要用**更新函数**（g03）：`setValue((v) => Math.min(max, v + step))`。只写 `setValue(Math.min(max, value + step))`，同一次渲染中的两次调用读到的都是同一个 `value`。
:::

:::explanation
Hook 返回的是一个普通对象：`value` 是 state，`canIncrement`、`canDecrement` 是每次渲染时算出来的值，几个函数则修改 state。组件只管使用它们，不用知道里面是怎么实现的，`Stepper` 的代码因此只剩下界面。

`act()` 告诉 React“这里会更新 state”，React 处理完更新、重新渲染之后，`result.current` 才指向新的返回值。测试中“同一个事件中连续调用两次”就是在一个 `act` 里调用两次：如果用 `value + step`，两次计算都基于同一次渲染的 `value`，结果只加了一次。

`useState(() => clamp(initial))` 传的是一个函数（**惰性初始值**）：它只在第一次渲染时调用。这里的计算很便宜，直接写 `useState(clamp(initial))` 也可以；初始值需要较多计算（例如解析一大段文本）时，惰性初始值可以避免每次渲染都白算一遍。
:::

:::variant{kind=alt name=move-helper}
```ts file=useCounter.ts
import { useState } from 'react';

export type CounterOptions = { min: number; max: number; initial?: number; step?: number };

export type Counter = {
  value: number;
  increment(): void;
  decrement(): void;
  reset(): void;
  canIncrement: boolean;
  canDecrement: boolean;
};

export function useCounter(options: CounterOptions): Counter {
  const { min, max, step = 1 } = options;
  const start = Math.min(max, Math.max(min, options.initial ?? min));
  const [value, setValue] = useState(start);
  const move = (delta: number) => setValue((current) => Math.min(max, Math.max(min, current + delta)));
  return {
    value,
    increment: () => move(step),
    decrement: () => move(-step),
    reset: () => setValue(start),
    canIncrement: value + 1 <= max,
    canDecrement: value - 1 >= min,
  };
}
```
:::

:::variant{kind=wrong name=stale-value fails=tests reason="用当前渲染的 value 计算新值，连续调用两次只生效一次"}
```ts file=useCounter.ts
import { useState } from 'react';

export type CounterOptions = { min: number; max: number; initial?: number; step?: number };

export type Counter = {
  value: number;
  increment(): void;
  decrement(): void;
  reset(): void;
  canIncrement: boolean;
  canDecrement: boolean;
};

export function useCounter({ min, max, initial = min, step = 1 }: CounterOptions): Counter {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const [value, setValue] = useState(() => clamp(initial));
  return {
    value,
    increment: () => setValue(Math.min(max, value + step)),
    decrement: () => setValue(Math.max(min, value - step)),
    reset: () => setValue(clamp(initial)),
    canIncrement: value < max,
    canDecrement: value > min,
  };
}
```
:::

:::variant{kind=wrong name=no-clamp fails=tests reason="没有把初始值限制在范围内"}
```ts file=useCounter.ts
import { useState } from 'react';

export type CounterOptions = { min: number; max: number; initial?: number; step?: number };

export type Counter = {
  value: number;
  increment(): void;
  decrement(): void;
  reset(): void;
  canIncrement: boolean;
  canDecrement: boolean;
};

export function useCounter({ min, max, initial = min, step = 1 }: CounterOptions): Counter {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const [value, setValue] = useState(() => initial);
  return {
    value,
    increment: () => setValue((v) => Math.min(max, v + step)),
    decrement: () => setValue((v) => Math.max(min, v - step)),
    reset: () => setValue(initial),
    canIncrement: value < max,
    canDecrement: value > min,
  };
}
```
:::

:::variant{kind=wrong name=ignore-step fails=tests reason="忽略了 step，每次只变化 1"}
```ts file=useCounter.ts
import { useState } from 'react';

export type CounterOptions = { min: number; max: number; initial?: number; step?: number };

export type Counter = {
  value: number;
  increment(): void;
  decrement(): void;
  reset(): void;
  canIncrement: boolean;
  canDecrement: boolean;
};

export function useCounter({ min, max, initial = min, step = 1 }: CounterOptions): Counter {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const [value, setValue] = useState(() => clamp(initial));
  return {
    value,
    increment: () => setValue((v) => Math.min(max, v + 1)),
    decrement: () => setValue((v) => Math.max(min, v - 1)),
    reset: () => setValue(clamp(initial)),
    canIncrement: value < max,
    canDecrement: value > min,
  };
}
```
:::

:::variant{kind=wrong name=wrong-flags fails=tests reason="到达边界时 canIncrement / canDecrement 仍然为 true"}
```ts file=useCounter.ts
import { useState } from 'react';

export type CounterOptions = { min: number; max: number; initial?: number; step?: number };

export type Counter = {
  value: number;
  increment(): void;
  decrement(): void;
  reset(): void;
  canIncrement: boolean;
  canDecrement: boolean;
};

export function useCounter({ min, max, initial = min, step = 1 }: CounterOptions): Counter {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const [value, setValue] = useState(() => clamp(initial));
  return {
    value,
    increment: () => setValue((v) => Math.min(max, v + step)),
    decrement: () => setValue((v) => Math.max(min, v - step)),
    reset: () => setValue(clamp(initial)),
    canIncrement: value <= max,
    canDecrement: value >= min,
  };
}
```
:::

:::variant{kind=wrong name=reset-unclamped fails=tests reason="重置时直接用了 initial，没有限制在范围内"}
```ts file=useCounter.ts
import { useState } from 'react';

export type CounterOptions = { min: number; max: number; initial?: number; step?: number };

export type Counter = {
  value: number;
  increment(): void;
  decrement(): void;
  reset(): void;
  canIncrement: boolean;
  canDecrement: boolean;
};

export function useCounter({ min, max, initial = min, step = 1 }: CounterOptions): Counter {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const [value, setValue] = useState(() => clamp(initial));
  return {
    value,
    increment: () => setValue((v) => Math.min(max, v + step)),
    decrement: () => setValue((v) => Math.max(min, v - step)),
    reset: () => setValue(initial),
    canIncrement: value < max,
    canDecrement: value > min,
  };
}
```
:::
