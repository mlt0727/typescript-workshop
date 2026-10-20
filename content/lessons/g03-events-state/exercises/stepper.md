---
kind: challenge
title: 数量步进器
---
实现购物车里常见的数量步进器 `Stepper`，props 为 `{ min: number; max: number; initial: number }`（保证 `min ≤ initial ≤ max`）。

界面（测试依赖这些文字与可访问名称，请保持一致）：

- `<output aria-label="数量">` 显示当前数量；
- 文字为 `−` 的按钮，`aria-label="减少"`：数量减 1；
- 文字为 `+` 的按钮，`aria-label="增加"`：数量加 1；
- 文字为 `+5` 的按钮：数量加 5，但**不能超过** `max`（例如 `max` 为 10、当前为 8 时，点击后为 10）；
- 文字为 `重置` 的按钮：回到 `initial`。

规则：数量永远不能小于 `min`、大于 `max`；数量等于 `min` 时“减少”按钮禁用，等于 `max` 时“增加”和 `+5` 按钮禁用。

:::files{role=starter}
```tsx file=Stepper.tsx
import { useState } from 'react';

type StepperProps = {
  min: number;
  max: number;
  initial: number;
};

export function Stepper({ min, max, initial }: StepperProps) {
  const [value, setValue] = useState(initial);

  return (
    <div>
      <output aria-label="数量">{value}</output>
      {/* 在这里添加四个按钮 */}
    </div>
  );
}
```
:::

:::files{role=support}
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { Stepper } from './Stepper';

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<Stepper min={1} max={10} initial={1} />);
```
:::

:::files{role=solution}
```tsx file=Stepper.tsx
import { useState } from 'react';

type StepperProps = {
  min: number;
  max: number;
  initial: number;
};

export function Stepper({ min, max, initial }: StepperProps) {
  const [value, setValue] = useState(initial);

  function change(delta: number) {
    setValue((v) => Math.min(max, Math.max(min, v + delta)));
  }

  return (
    <div>
      <button type="button" aria-label="减少" onClick={() => change(-1)} disabled={value <= min}>
        −
      </button>
      <output aria-label="数量">{value}</output>
      <button type="button" aria-label="增加" onClick={() => change(1)} disabled={value >= max}>
        +
      </button>
      <button type="button" onClick={() => change(5)} disabled={value >= max}>
        +5
      </button>
      <button type="button" onClick={() => setValue(initial)}>
        重置
      </button>
    </div>
  );
}
```
:::

:::files{role=tests}
```tsx file=Stepper.test.tsx
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Stepper } from './Stepper';

const value = () => screen.getByLabelText('数量');
const button = (name: string) => screen.getByRole('button', { name });

describe('Stepper', () => {
  test('显示初始值', () => {
    render(<Stepper min={0} max={10} initial={3} />);
    expect(value()).toHaveTextContent('3');
  });

  test('增加与减少', async () => {
    const user = userEvent.setup();
    render(<Stepper min={0} max={10} initial={3} />);
    await user.click(button('增加'));
    await user.click(button('增加'));
    expect(value()).toHaveTextContent('5');
    await user.click(button('减少'));
    expect(value()).toHaveTextContent('4');
  });

  test('+5 一次加 5，且不超过最大值', async () => {
    const user = userEvent.setup();
    render(<Stepper min={0} max={10} initial={1} />);
    await user.click(button('+5'));
    expect(value()).toHaveTextContent('6');
    await user.click(button('+5'));
    expect(value()).toHaveTextContent('10');
  });

  test('到达边界时禁用相应按钮', async () => {
    const user = userEvent.setup();
    render(<Stepper min={2} max={4} initial={2} />);
    expect(button('减少')).toBeDisabled();
    expect(button('增加')).toBeEnabled();
    await user.click(button('增加'));
    await user.click(button('增加'));
    expect(value()).toHaveTextContent('4');
    expect(button('增加')).toBeDisabled();
    expect(button('+5')).toBeDisabled();
    expect(button('减少')).toBeEnabled();
  });

  test('重置回到初始值', async () => {
    const user = userEvent.setup();
    render(<Stepper min={0} max={20} initial={7} />);
    await user.click(button('+5'));
    await user.click(button('减少'));
    await user.click(button('重置'));
    expect(value()).toHaveTextContent('7');
  });
});
```
:::

:::hint{level=1}
四个按钮都在修改同一个 `value`。先写一个“修改并限制在 `[min, max]` 范围内”的辅助函数，再让每个按钮调用它；按钮是否禁用可以直接从当前 `value` 计算出来。
:::

:::hint{level=2}
`Math.min(max, Math.max(min, v + delta))` 把结果限制在范围内。如果你想把 `+5` 写成连续调用五次 `setValue(value + 1)`，回忆一下“state 是快照”：五次读到的都是同一个 `value`。用更新函数 `setValue((v) => …)` 或者直接一次加 5 再限制范围。
:::

:::explanation
参考答案用一个 `change(delta)` 统一处理加减：`setValue((v) => Math.min(max, Math.max(min, v + delta)))`。用更新函数可以保证即使连续触发多次更新，每次都基于最新值计算。

按钮的 `disabled` 不需要单独的 state：它完全由 `value` 与 `min`/`max` 决定，在渲染时直接计算即可。这是 React 里很重要的原则——**能从已有数据算出来的东西，就不要存成另一个 state**，否则两份数据很容易不一致。
:::

:::variant{kind=alt name=direct-values}
```tsx file=Stepper.tsx
import { useState } from 'react';

type StepperProps = {
  min: number;
  max: number;
  initial: number;
};

export function Stepper({ min, max, initial }: StepperProps) {
  const [value, setValue] = useState(initial);
  const atMin = value === min;
  const atMax = value === max;

  return (
    <div>
      <output aria-label="数量">{value}</output>
      <button type="button" aria-label="减少" disabled={atMin} onClick={() => setValue(value - 1)}>
        −
      </button>
      <button type="button" aria-label="增加" disabled={atMax} onClick={() => setValue(value + 1)}>
        +
      </button>
      <button type="button" disabled={atMax} onClick={() => setValue(value + 5 > max ? max : value + 5)}>
        +5
      </button>
      <button type="button" onClick={() => setValue(initial)}>
        重置
      </button>
    </div>
  );
}
```
:::

:::variant{kind=wrong name=five-snapshots fails=tests reason="+5 写成连续五次 setValue(value + 1)：state 是快照，只加了 1"}
```tsx file=Stepper.tsx
import { useState } from 'react';

type StepperProps = {
  min: number;
  max: number;
  initial: number;
};

export function Stepper({ min, max, initial }: StepperProps) {
  const [value, setValue] = useState(initial);

  function plusFive() {
    for (let i = 0; i < 5; i++) {
      if (value < max) setValue(value + 1);
    }
  }

  return (
    <div>
      <output aria-label="数量">{value}</output>
      <button type="button" aria-label="减少" disabled={value <= min} onClick={() => setValue(value - 1)}>
        −
      </button>
      <button type="button" aria-label="增加" disabled={value >= max} onClick={() => setValue(value + 1)}>
        +
      </button>
      <button type="button" disabled={value >= max} onClick={plusFive}>
        +5
      </button>
      <button type="button" onClick={() => setValue(initial)}>
        重置
      </button>
    </div>
  );
}
```
:::

:::variant{kind=wrong name=no-clamp fails=tests reason="+5 没有限制在 max 以内"}
```tsx file=Stepper.tsx
import { useState } from 'react';

type StepperProps = {
  min: number;
  max: number;
  initial: number;
};

export function Stepper({ min, max, initial }: StepperProps) {
  const [value, setValue] = useState(initial);

  return (
    <div>
      <output aria-label="数量">{value}</output>
      <button type="button" aria-label="减少" disabled={value <= min} onClick={() => setValue(value - 1)}>
        −
      </button>
      <button type="button" aria-label="增加" disabled={value >= max} onClick={() => setValue(value + 1)}>
        +
      </button>
      <button type="button" disabled={value >= max} onClick={() => setValue(value + 5)}>
        +5
      </button>
      <button type="button" onClick={() => setValue(initial)}>
        重置
      </button>
    </div>
  );
}
```
:::

:::variant{kind=wrong name=never-disabled fails=tests reason="到达边界时没有禁用按钮"}
```tsx file=Stepper.tsx
import { useState } from 'react';

type StepperProps = {
  min: number;
  max: number;
  initial: number;
};

export function Stepper({ min, max, initial }: StepperProps) {
  const [value, setValue] = useState(initial);
  const change = (d: number) => setValue((v) => Math.min(max, Math.max(min, v + d)));

  return (
    <div>
      <output aria-label="数量">{value}</output>
      <button type="button" aria-label="减少" onClick={() => change(-1)}>
        −
      </button>
      <button type="button" aria-label="增加" onClick={() => change(1)}>
        +
      </button>
      <button type="button" onClick={() => change(5)}>
        +5
      </button>
      <button type="button" onClick={() => setValue(initial)}>
        重置
      </button>
    </div>
  );
}
```
:::
