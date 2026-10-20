---
kind: challenge
title: 泛型的分段选择器
---
`SegmentedControl` 用来在几个选项中选一个（例如“今天 / 本周 / 本月”），它是一组单选框：`<fieldset>` 中的 `<legend>` 是这一组的名字，每个选项是一个包着 `<input type="radio">` 的 `<label>`。同一组的单选框共用一个由 `useId()` 生成的 `name`。起始代码中它自己记着选中的值，`ReportPanel` 不知道用户选了什么，标题也就没法跟着变。

**`SegmentedControl.tsx`**：保留这个结构，改成**泛型的受控组件**。

- 类型：`Option<T extends string> = { value: T; label: string }`；props 是 `label`、`options: readonly Option<T>[]`、`value` 和 `onChange`。`T` 只从 `options` 推断：`value` 必须是选项的值之一，`onChange` 收到的参数类型恰好是选项值的联合类型（用 `NoInfer`）；
- `value` 对应的单选框选中（`checked`）；
- 用户选中另一个选项时（点击或者方向键）调用 `onChange(选项的值)`；点击已经选中的选项什么都不做。组件自己不保存 state。

**`ReportPanel.tsx`**：保存时间范围（`'day' | 'week' | 'month'`，默认 `'week'`）和指标（`'sales' | 'orders'`，默认 `'sales'`）：

- 标题 `<h2>` 是“时间范围的文字 + 的 + 指标的文字”，例如“本周的销售额”“本月的订单数”；
- 两个 `SegmentedControl` 的 `label` 分别是“时间范围”和“指标”；
- “恢复默认”按钮把两者都恢复成默认值；已经是默认值时禁用。

:::files{role=starter}
```tsx file=SegmentedControl.tsx
import { useId, useState } from 'react';

export type Option = { value: string; label: string };

type SegmentedControlProps = {
  label: string;
  options: readonly Option[];
};

/** 现在它自己记着选中的值，父组件不知道选了什么。改成泛型的受控组件。 */
export function SegmentedControl({ label, options }: SegmentedControlProps) {
  const name = useId();
  const [value, setValue] = useState(options[0]?.value);
  return (
    <fieldset className="segmented">
      <legend>{label}</legend>
      {options.map((option) => (
        <label key={option.value}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => setValue(option.value)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
```
```tsx file=ReportPanel.tsx
import { SegmentedControl, type Option } from './SegmentedControl';

const PERIODS: readonly Option[] = [
  { value: 'day', label: '今天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
];
const METRICS: readonly Option[] = [
  { value: 'sales', label: '销售额' },
  { value: 'orders', label: '订单数' },
];

export function ReportPanel() {
  // TODO：在这里保存时间范围和指标，标题随之变化；“恢复默认”
  return (
    <section>
      <h2>本周的销售额</h2>
      <SegmentedControl label="时间范围" options={PERIODS} />
      <SegmentedControl label="指标" options={METRICS} />
      <button type="button">恢复默认</button>
    </section>
  );
}
```
:::

:::files{role=support}
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { ReportPanel } from './ReportPanel';

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<ReportPanel />);
```
:::

:::files{role=solution}
```tsx file=SegmentedControl.tsx
import { useId } from 'react';

export type Option<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  label: string;
  options: readonly Option<T>[];
  value: NoInfer<T>;
  onChange: (value: NoInfer<T>) => void;
};

export function SegmentedControl<T extends string>({ label, options, value, onChange }: SegmentedControlProps<T>) {
  const name = useId();
  return (
    <fieldset className="segmented">
      <legend>{label}</legend>
      {options.map((option) => (
        <label key={option.value}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
```
```tsx file=ReportPanel.tsx
import { useState } from 'react';
import { SegmentedControl, type Option } from './SegmentedControl';

type Period = 'day' | 'week' | 'month';
type Metric = 'sales' | 'orders';

const PERIODS: readonly Option<Period>[] = [
  { value: 'day', label: '今天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
];
const METRICS: readonly Option<Metric>[] = [
  { value: 'sales', label: '销售额' },
  { value: 'orders', label: '订单数' },
];

const labelOf = <T extends string>(options: readonly Option<T>[], value: T): string =>
  options.find((option) => option.value === value)?.label ?? value;

export function ReportPanel() {
  const [period, setPeriod] = useState<Period>('week');
  const [metric, setMetric] = useState<Metric>('sales');
  const isDefault = period === 'week' && metric === 'sales';

  return (
    <section>
      <h2>
        {labelOf(PERIODS, period)}的{labelOf(METRICS, metric)}
      </h2>
      <SegmentedControl label="时间范围" options={PERIODS} value={period} onChange={setPeriod} />
      <SegmentedControl label="指标" options={METRICS} value={metric} onChange={setMetric} />
      <button
        type="button"
        disabled={isDefault}
        onClick={() => {
          setPeriod('week');
          setMetric('sales');
        }}
      >
        恢复默认
      </button>
    </section>
  );
}
```
:::

:::files{role=tests}
```tsx file=report.test.tsx
import { describe, expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SegmentedControl } from './SegmentedControl';
import { ReportPanel } from './ReportPanel';

const sizes = [
  { value: 's', label: '小' },
  { value: 'm', label: '中' },
  { value: 'l', label: '大' },
] as const;

function radioNames(group: HTMLElement): (string | null)[] {
  return within(group)
    .getAllByRole('radio')
    .map((radio) => radio.getAttribute('name'));
}

describe('SegmentedControl', () => {
  test('是一组单选框：fieldset 和 legend 给出组名，按 value 显示选中的选项', () => {
    render(<SegmentedControl label="尺寸" options={sizes} value="m" onChange={() => {}} />);
    const group = screen.getByRole('group', { name: '尺寸' });
    expect(group.tagName).toBe('FIELDSET');
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((radio) => radio instanceof HTMLInputElement && radio.checked)).toEqual([false, true, false]);
    expect(within(group).getByRole('radio', { name: '小' })).toHaveAttribute('value', 's');
    const [first, ...rest] = radioNames(group);
    expect(first, '同一组的单选框要有相同的 name').toBeTruthy();
    expect(rest).toEqual([first, first]);
  });

  test('选择时只通知父组件，自己不改变选中项；点击已选中的不通知', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SegmentedControl label="尺寸" options={sizes} value="m" onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: '大' }));
    expect(onChange).toHaveBeenCalledWith('l');
    expect(screen.getByRole('radio', { name: '大' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: '中' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: '中' }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  test('可以用方向键选择', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SegmentedControl label="尺寸" options={sizes} value="m" onChange={onChange} />);
    screen.getByRole('radio', { name: '中' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('l');
  });
});

describe('ReportPanel', () => {
  const heading = () => screen.getByRole('heading', { level: 2 });
  const option = (group: string, name: string) => within(screen.getByRole('group', { name: group })).getByRole('radio', { name });

  test('默认是本周的销售额，“恢复默认”不可用', () => {
    render(<ReportPanel />);
    expect(heading()).toHaveTextContent(/^本周的销售额$/);
    expect(option('时间范围', '本周')).toBeChecked();
    expect(option('指标', '销售额')).toBeChecked();
    expect(screen.getByRole('button', { name: '恢复默认' })).toBeDisabled();
  });

  test('两个选择器的单选框属于不同的组（name 不同）', () => {
    render(<ReportPanel />);
    const [period] = radioNames(screen.getByRole('group', { name: '时间范围' }));
    const [metric] = radioNames(screen.getByRole('group', { name: '指标' }));
    expect(period).not.toBe(metric);
  });

  test('两个选择器的值都由 ReportPanel 保存，标题随之变化', async () => {
    const user = userEvent.setup();
    render(<ReportPanel />);
    await user.click(option('时间范围', '本月'));
    expect(heading()).toHaveTextContent(/^本月的销售额$/);
    expect(option('时间范围', '本月')).toBeChecked();
    expect(option('时间范围', '本周')).not.toBeChecked();
    await user.click(option('指标', '订单数'));
    expect(heading()).toHaveTextContent(/^本月的订单数$/);
    expect(option('指标', '订单数')).toBeChecked();
    expect(option('时间范围', '本月'), '选择指标不应该影响时间范围').toBeChecked();
  });

  test('恢复默认', async () => {
    const user = userEvent.setup();
    render(<ReportPanel />);
    await user.click(option('时间范围', '今天'));
    await user.click(option('指标', '订单数'));
    await user.click(screen.getByRole('button', { name: '恢复默认' }));
    expect(heading()).toHaveTextContent(/^本周的销售额$/);
    expect(option('时间范围', '本周')).toBeChecked();
    expect(option('指标', '销售额')).toBeChecked();
    expect(option('指标', '订单数')).not.toBeChecked();
    expect(screen.getByRole('button', { name: '恢复默认' })).toBeDisabled();
  });
});
```
```tsx file=report.test-d.tsx
import { expectTypeOf } from 'vitest';
import { SegmentedControl } from './SegmentedControl';

const periods = [
  { value: 'day', label: '今天' },
  { value: 'week', label: '本周' },
] as const;

// @ts-expect-error value 必须是选项中的一个
const wrongValue = <SegmentedControl label="x" options={periods} value="year" onChange={() => {}} />;

const ok = (
  <SegmentedControl
    label="x"
    options={periods}
    value="day"
    onChange={(value) => {
      expectTypeOf(value).toEqualTypeOf<'day' | 'week'>();
    }}
  />
);

// @ts-expect-error onChange 接收的是选项的值，不能声明成更窄的类型
const narrowHandler = <SegmentedControl label="x" options={periods} value="day" onChange={(value: 'day') => console.log(value)} />;

console.log(wrongValue, ok, narrowHandler);
```
:::

:::hint{level=1}
`function SegmentedControl<T extends string>({ label, options, value, onChange }: SegmentedControlProps<T>)`，props 类型中 `value: NoInfer<T>`、`onChange: (value: NoInfer<T>) => void`。单选框写成 `checked={option.value === value}`、`onChange={() => onChange(option.value)}`（g06）。`ReportPanel` 中用两个 `useState`，把值和设置函数分别传给两个选择器。
:::

:::hint{level=2}
选项数组可以写成 `const PERIODS: readonly Option<Period>[] = [...]`。设置函数可以直接作为 `onChange` 传下去：`onChange={setPeriod}`。标题中的文字用 `options.find((o) => o.value === value)?.label` 查出来。
:::

:::explanation
**状态提升**：选中的值现在只存在 `ReportPanel` 中，标题、两个选择器、“恢复默认”的禁用状态都从这两个 state 得到，不可能不一致。`SegmentedControl` 什么都不记，它显示 `value`，用户选择时通过 `onChange` 告诉父组件“应该变成什么”，这和 `<input value onChange>` 是一样的约定。父组件没有更新 `value` 时，React 会把单选框恢复成 `value` 对应的状态，所以测试中点击“大”之后，选中的仍然是“中”。

**泛型**：`SegmentedControl` 不知道选项具体是什么，但它保证 `value` 和 `onChange` 的类型与 `options` 一致。`ReportPanel` 中可以直接写 `onChange={setPeriod}`：`setPeriod` 接收 `Period`，`onChange` 传出的也正是 `Period`。

**`NoInfer`**：如果 props 写成 `value: T`，TypeScript 会同时根据 `options` 和 `value` 推断 `T`。把 `value` 写错成 `"year"`，`T` 就被推断成 `'day' | 'week' | 'year'`，错误被悄悄地接受了。`NoInfer<T>` 让 `T` 只从 `options` 推断，`value` 和 `onChange` 只是“使用” `T`，写错的值就会报错。类型测试中的第一个检查就是这个。

**为什么用单选框，而不是一排按钮？** “几个选项中选一个”正是单选框的含义，原生的单选框自带很多行为：`<fieldset>` 和 `<legend>` 给这一组起了名字，读屏软件会告诉用户这是一组互斥的选项、当前选中的是哪一个；Tab 键在这一组上只停一次，用方向键在选项之间移动并选中；点击已经选中的单选框不会触发 `change`，所以 `onChange` 只在值真的变化时才被调用。外观可以完全用 CSS 改成分段按钮的样子。用 `<button aria-pressed>` 也能做出来，但 `aria-pressed` 表示每个按钮各自“按下 / 弹起”，读屏软件不会说明它们是互斥的，方向键的行为也要自己实现。

**为什么 `name` 用 `useId()`？** 浏览器按 `name` 给单选框分组，`name` 相同的单选框只能选中一个。如果 `name` 写死成一个常量，“时间范围”和“指标”两个选择器就成了同一组，选了“订单数”，“本月”就被取消了。`useId()` 为每个组件实例生成一个在多次渲染之间保持不变的唯一 id。
:::

:::variant{kind=alt name=interface-props}
```tsx file=SegmentedControl.tsx
import { useId } from 'react';

export interface Option<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  options: ReadonlyArray<Option<T>>;
  value: NoInfer<T>;
  onChange: (value: NoInfer<T>) => void;
}

export function SegmentedControl<T extends string>(props: SegmentedControlProps<T>) {
  const id = useId();
  return (
    <fieldset>
      <legend>{props.label}</legend>
      {props.options.map(({ value, label }, index) => (
        <span key={value}>
          <input
            id={`${id}-${index}`}
            type="radio"
            name={id}
            value={value}
            checked={value === props.value}
            onChange={(event) => {
              if (event.currentTarget.checked) props.onChange(value);
            }}
          />
          <label htmlFor={`${id}-${index}`}>{label}</label>
        </span>
      ))}
    </fieldset>
  );
}
```
```tsx file=ReportPanel.tsx
import { useState } from 'react';
import { SegmentedControl, type Option } from './SegmentedControl';

type Period = 'day' | 'week' | 'month';
type Metric = 'sales' | 'orders';

const PERIODS: readonly Option<Period>[] = [
  { value: 'day', label: '今天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
];
const METRICS: readonly Option<Metric>[] = [
  { value: 'sales', label: '销售额' },
  { value: 'orders', label: '订单数' },
];

const labelOf = <T extends string>(options: readonly Option<T>[], value: T): string =>
  options.find((option) => option.value === value)?.label ?? value;

export function ReportPanel() {
  const [period, setPeriod] = useState<Period>('week');
  const [metric, setMetric] = useState<Metric>('sales');
  const isDefault = period === 'week' && metric === 'sales';

  return (
    <section>
      <h2>
        {labelOf(PERIODS, period)}的{labelOf(METRICS, metric)}
      </h2>
      <SegmentedControl label="时间范围" options={PERIODS} value={period} onChange={setPeriod} />
      <SegmentedControl label="指标" options={METRICS} value={metric} onChange={setMetric} />
      <button
        type="button"
        disabled={isDefault}
        onClick={() => {
          setPeriod('week');
          setMetric('sales');
        }}
      >
        恢复默认
      </button>
    </section>
  );
}
```
:::

:::variant{kind=wrong name=no-noinfer fails=types reason="没有用 NoInfer，写错的 value 让 T 被放宽了"}
```tsx file=SegmentedControl.tsx
import { useId } from 'react';

export type Option<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({ label, options, value, onChange }: SegmentedControlProps<T>) {
  const name = useId();
  return (
    <fieldset className="segmented">
      <legend>{label}</legend>
      {options.map((option) => (
        <label key={option.value}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
```
```tsx file=ReportPanel.tsx
import { useState } from 'react';
import { SegmentedControl, type Option } from './SegmentedControl';

type Period = 'day' | 'week' | 'month';
type Metric = 'sales' | 'orders';

const PERIODS: readonly Option<Period>[] = [
  { value: 'day', label: '今天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
];
const METRICS: readonly Option<Metric>[] = [
  { value: 'sales', label: '销售额' },
  { value: 'orders', label: '订单数' },
];

const labelOf = <T extends string>(options: readonly Option<T>[], value: T): string =>
  options.find((option) => option.value === value)?.label ?? value;

export function ReportPanel() {
  const [period, setPeriod] = useState<Period>('week');
  const [metric, setMetric] = useState<Metric>('sales');
  const isDefault = period === 'week' && metric === 'sales';

  return (
    <section>
      <h2>
        {labelOf(PERIODS, period)}的{labelOf(METRICS, metric)}
      </h2>
      <SegmentedControl label="时间范围" options={PERIODS} value={period} onChange={setPeriod} />
      <SegmentedControl label="指标" options={METRICS} value={metric} onChange={setMetric} />
      <button
        type="button"
        disabled={isDefault}
        onClick={() => {
          setPeriod('week');
          setMetric('sales');
        }}
      >
        恢复默认
      </button>
    </section>
  );
}
```
:::

:::variant{kind=wrong name=string-options fails=types reason="不是泛型，onChange 收到的只是 string"}
```tsx file=SegmentedControl.tsx
import { useId } from 'react';

export type Option<T extends string = string> = { value: T; label: string };

type SegmentedControlProps = {
  label: string;
  options: readonly Option[];
  value: string;
  onChange: (value: string) => void;
};

export function SegmentedControl({ label, options, value, onChange }: SegmentedControlProps) {
  const name = useId();
  return (
    <fieldset className="segmented">
      <legend>{label}</legend>
      {options.map((option) => (
        <label key={option.value}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
```
```tsx file=ReportPanel.tsx
import { useState } from 'react';
import { SegmentedControl, type Option } from './SegmentedControl';

type Period = 'day' | 'week' | 'month';
type Metric = 'sales' | 'orders';

const PERIODS: readonly Option<Period>[] = [
  { value: 'day', label: '今天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
];
const METRICS: readonly Option<Metric>[] = [
  { value: 'sales', label: '销售额' },
  { value: 'orders', label: '订单数' },
];

const labelOf = <T extends string>(options: readonly Option<T>[], value: T): string =>
  options.find((option) => option.value === value)?.label ?? value;

export function ReportPanel() {
  const [period, setPeriod] = useState<Period>('week');
  const [metric, setMetric] = useState<Metric>('sales');
  const isDefault = period === 'week' && metric === 'sales';

  return (
    <section>
      <h2>
        {labelOf(PERIODS, period)}的{labelOf(METRICS, metric)}
      </h2>
      <SegmentedControl label="时间范围" options={PERIODS} value={period} onChange={setPeriod} />
      <SegmentedControl label="指标" options={METRICS} value={metric} onChange={setMetric} />
      <button
        type="button"
        disabled={isDefault}
        onClick={() => {
          setPeriod('week');
          setMetric('sales');
        }}
      >
        恢复默认
      </button>
    </section>
  );
}
```
:::

:::variant{kind=wrong name=toggle-buttons fails=tests reason="用一排 aria-pressed 按钮代替单选框，读屏软件不知道它们是互斥的一组"}
```tsx file=SegmentedControl.tsx
export type Option<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  label: string;
  options: readonly Option<T>[];
  value: NoInfer<T>;
  onChange: (value: NoInfer<T>) => void;
};

export function SegmentedControl<T extends string>({ label, options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => {
            if (option.value !== value) onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
```
```tsx file=ReportPanel.tsx
import { useState } from 'react';
import { SegmentedControl, type Option } from './SegmentedControl';

type Period = 'day' | 'week' | 'month';
type Metric = 'sales' | 'orders';

const PERIODS: readonly Option<Period>[] = [
  { value: 'day', label: '今天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
];
const METRICS: readonly Option<Metric>[] = [
  { value: 'sales', label: '销售额' },
  { value: 'orders', label: '订单数' },
];

const labelOf = <T extends string>(options: readonly Option<T>[], value: T): string =>
  options.find((option) => option.value === value)?.label ?? value;

export function ReportPanel() {
  const [period, setPeriod] = useState<Period>('week');
  const [metric, setMetric] = useState<Metric>('sales');
  const isDefault = period === 'week' && metric === 'sales';

  return (
    <section>
      <h2>
        {labelOf(PERIODS, period)}的{labelOf(METRICS, metric)}
      </h2>
      <SegmentedControl label="时间范围" options={PERIODS} value={period} onChange={setPeriod} />
      <SegmentedControl label="指标" options={METRICS} value={metric} onChange={setMetric} />
      <button
        type="button"
        disabled={isDefault}
        onClick={() => {
          setPeriod('week');
          setMetric('sales');
        }}
      >
        恢复默认
      </button>
    </section>
  );
}
```
:::

:::variant{kind=wrong name=notify-on-click fails=tests reason="用 onClick 代替 onChange，点击已经选中的选项也调用了 onChange"}
```tsx file=SegmentedControl.tsx
import { useId } from 'react';

export type Option<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  label: string;
  options: readonly Option<T>[];
  value: NoInfer<T>;
  onChange: (value: NoInfer<T>) => void;
};

export function SegmentedControl<T extends string>({ label, options, value, onChange }: SegmentedControlProps<T>) {
  const name = useId();
  return (
    <fieldset className="segmented">
      <legend>{label}</legend>
      {options.map((option) => (
        <label key={option.value}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            readOnly
            onClick={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
```
```tsx file=ReportPanel.tsx
import { useState } from 'react';
import { SegmentedControl, type Option } from './SegmentedControl';

type Period = 'day' | 'week' | 'month';
type Metric = 'sales' | 'orders';

const PERIODS: readonly Option<Period>[] = [
  { value: 'day', label: '今天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
];
const METRICS: readonly Option<Metric>[] = [
  { value: 'sales', label: '销售额' },
  { value: 'orders', label: '订单数' },
];

const labelOf = <T extends string>(options: readonly Option<T>[], value: T): string =>
  options.find((option) => option.value === value)?.label ?? value;

export function ReportPanel() {
  const [period, setPeriod] = useState<Period>('week');
  const [metric, setMetric] = useState<Metric>('sales');
  const isDefault = period === 'week' && metric === 'sales';

  return (
    <section>
      <h2>
        {labelOf(PERIODS, period)}的{labelOf(METRICS, metric)}
      </h2>
      <SegmentedControl label="时间范围" options={PERIODS} value={period} onChange={setPeriod} />
      <SegmentedControl label="指标" options={METRICS} value={metric} onChange={setMetric} />
      <button
        type="button"
        disabled={isDefault}
        onClick={() => {
          setPeriod('week');
          setMetric('sales');
        }}
      >
        恢复默认
      </button>
    </section>
  );
}
```
:::

:::variant{kind=wrong name=method-syntax fails=types reason="onChange 写成了方法语法，参数按双向检查，更窄的处理函数也被接受了"}
```tsx file=SegmentedControl.tsx
import { useId } from 'react';

export interface Option<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  options: ReadonlyArray<Option<T>>;
  value: NoInfer<T>;
  onChange(value: NoInfer<T>): void;
}

export function SegmentedControl<T extends string>(props: SegmentedControlProps<T>) {
  const id = useId();
  return (
    <fieldset>
      <legend>{props.label}</legend>
      {props.options.map(({ value, label }, index) => (
        <span key={value}>
          <input
            id={`${id}-${index}`}
            type="radio"
            name={id}
            value={value}
            checked={value === props.value}
            onChange={(event) => {
              if (event.currentTarget.checked) props.onChange(value);
            }}
          />
          <label htmlFor={`${id}-${index}`}>{label}</label>
        </span>
      ))}
    </fieldset>
  );
}
```
```tsx file=ReportPanel.tsx
import { useState } from 'react';
import { SegmentedControl, type Option } from './SegmentedControl';

type Period = 'day' | 'week' | 'month';
type Metric = 'sales' | 'orders';

const PERIODS: readonly Option<Period>[] = [
  { value: 'day', label: '今天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
];
const METRICS: readonly Option<Metric>[] = [
  { value: 'sales', label: '销售额' },
  { value: 'orders', label: '订单数' },
];

const labelOf = <T extends string>(options: readonly Option<T>[], value: T): string =>
  options.find((option) => option.value === value)?.label ?? value;

export function ReportPanel() {
  const [period, setPeriod] = useState<Period>('week');
  const [metric, setMetric] = useState<Metric>('sales');
  const isDefault = period === 'week' && metric === 'sales';

  return (
    <section>
      <h2>
        {labelOf(PERIODS, period)}的{labelOf(METRICS, metric)}
      </h2>
      <SegmentedControl label="时间范围" options={PERIODS} value={period} onChange={setPeriod} />
      <SegmentedControl label="指标" options={METRICS} value={metric} onChange={setMetric} />
      <button
        type="button"
        disabled={isDefault}
        onClick={() => {
          setPeriod('week');
          setMetric('sales');
        }}
      >
        恢复默认
      </button>
    </section>
  );
}
```
:::

:::variant{kind=wrong name=shared-name fails=tests reason="name 写死成了常量，两个选择器成了同一组单选框"}
```tsx file=SegmentedControl.tsx
export type Option<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  label: string;
  options: readonly Option<T>[];
  value: NoInfer<T>;
  onChange: (value: NoInfer<T>) => void;
};

export function SegmentedControl<T extends string>({ label, options, value, onChange }: SegmentedControlProps<T>) {
  const name = 'segmented';
  return (
    <fieldset className="segmented">
      <legend>{label}</legend>
      {options.map((option) => (
        <label key={option.value}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
```
```tsx file=ReportPanel.tsx
import { useState } from 'react';
import { SegmentedControl, type Option } from './SegmentedControl';

type Period = 'day' | 'week' | 'month';
type Metric = 'sales' | 'orders';

const PERIODS: readonly Option<Period>[] = [
  { value: 'day', label: '今天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
];
const METRICS: readonly Option<Metric>[] = [
  { value: 'sales', label: '销售额' },
  { value: 'orders', label: '订单数' },
];

const labelOf = <T extends string>(options: readonly Option<T>[], value: T): string =>
  options.find((option) => option.value === value)?.label ?? value;

export function ReportPanel() {
  const [period, setPeriod] = useState<Period>('week');
  const [metric, setMetric] = useState<Metric>('sales');
  const isDefault = period === 'week' && metric === 'sales';

  return (
    <section>
      <h2>
        {labelOf(PERIODS, period)}的{labelOf(METRICS, metric)}
      </h2>
      <SegmentedControl label="时间范围" options={PERIODS} value={period} onChange={setPeriod} />
      <SegmentedControl label="指标" options={METRICS} value={metric} onChange={setMetric} />
      <button
        type="button"
        disabled={isDefault}
        onClick={() => {
          setPeriod('week');
          setMetric('sales');
        }}
      >
        恢复默认
      </button>
    </section>
  );
}
```
:::

:::variant{kind=wrong name=local-copy fails=tests reason="把 value 复制进了自己的 state，父组件恢复默认值之后选择器不跟着变"}
```tsx file=SegmentedControl.tsx
import { useId, useState } from 'react';

export type Option<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  label: string;
  options: readonly Option<T>[];
  value: NoInfer<T>;
  onChange: (value: NoInfer<T>) => void;
};

export function SegmentedControl<T extends string>({ label, options, value, onChange }: SegmentedControlProps<T>) {
  const name = useId();
  const [selected, setSelected] = useState(value);
  return (
    <fieldset className="segmented">
      <legend>{label}</legend>
      {options.map((option) => (
        <label key={option.value}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === selected}
            onChange={() => {
              setSelected(option.value);
              onChange(option.value);
            }}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
```
```tsx file=ReportPanel.tsx
import { useState } from 'react';
import { SegmentedControl, type Option } from './SegmentedControl';

type Period = 'day' | 'week' | 'month';
type Metric = 'sales' | 'orders';

const PERIODS: readonly Option<Period>[] = [
  { value: 'day', label: '今天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
];
const METRICS: readonly Option<Metric>[] = [
  { value: 'sales', label: '销售额' },
  { value: 'orders', label: '订单数' },
];

const labelOf = <T extends string>(options: readonly Option<T>[], value: T): string =>
  options.find((option) => option.value === value)?.label ?? value;

export function ReportPanel() {
  const [period, setPeriod] = useState<Period>('week');
  const [metric, setMetric] = useState<Metric>('sales');
  const isDefault = period === 'week' && metric === 'sales';

  return (
    <section>
      <h2>
        {labelOf(PERIODS, period)}的{labelOf(METRICS, metric)}
      </h2>
      <SegmentedControl label="时间范围" options={PERIODS} value={period} onChange={setPeriod} />
      <SegmentedControl label="指标" options={METRICS} value={metric} onChange={setMetric} />
      <button
        type="button"
        disabled={isDefault}
        onClick={() => {
          setPeriod('week');
          setMetric('sales');
        }}
      >
        恢复默认
      </button>
    </section>
  );
}
```
:::
