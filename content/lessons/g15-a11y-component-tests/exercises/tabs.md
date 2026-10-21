---
kind: task
title: 可以用键盘操作的标签页
---
起始的 `Tabs` 组件用鼠标可以切换，但没有任何角色，也不能用键盘操作。按 WAI-ARIA APG 的标签页模式（自动激活）重写它：

1. 容器 `role="tablist"`，名字是 `label`；每个标签页是 `role="tab"` 的按钮，文字是 `tab.label`；每个面板 `role="tabpanel"`，`tabIndex={0}`；
2. 选中的标签页 `aria-selected="true"`，其他的为 `"false"`；标签页的 `aria-controls` 是它的面板的 `id`，面板的 `aria-labelledby` 是它的标签页的 `id`（页面上有两个 `Tabs` 时，`id` 也不能重复，例如用 `useId()` 加上标签页的 `id` 组成）；
3. 只显示选中的面板，其他的用 `hidden` 隐藏（或者不渲染）；
4. **roving tabindex**：选中的标签页 `tabIndex={0}`，其他的 `-1`；
5. 一开始选中 `initialId` 对应的标签页，没有或者不存在时选中第一个；点击标签页时选中它；
6. 焦点在某个标签页上时：右方向键到下一个、左方向键到上一个（在两端循环），Home 到第一个，End 到最后一个。焦点移到哪个标签页，就同时选中它。这几个键要 `preventDefault()`，避免页面滚动。

:::files{role=starter}
```tsx file=Tabs.tsx
import { useState, type ReactNode } from 'react';

export type TabItem = { id: string; label: string; content: ReactNode };

type TabsProps = { label: string; tabs: readonly TabItem[]; initialId?: string };

export function Tabs({ label, tabs, initialId }: TabsProps) {
  const [selectedId, setSelectedId] = useState(initialId ?? tabs[0]?.id);
  return (
    <div>
      <div>
        {tabs.map((tab) => (
          <button key={tab.id} type="button" onClick={() => setSelectedId(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (tab.id === selectedId ? <div key={tab.id}>{tab.content}</div> : null))}
    </div>
  );
}
```
:::

:::files{role=support}
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { Tabs } from './Tabs';

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(
  <Tabs
    label="账户设置"
    tabs={[
      { id: 'profile', label: '个人资料', content: <p>头像与昵称</p> },
      { id: 'security', label: '安全', content: <p>密码与两步验证</p> },
      { id: 'billing', label: '账单', content: <p>付款方式</p> },
    ]}
  />,
);
```
:::

:::files{role=solution}
```tsx file=Tabs.tsx
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export type TabItem = { id: string; label: string; content: ReactNode };

type TabsProps = { label: string; tabs: readonly TabItem[]; initialId?: string };

/** 方向键、Home、End 对应的目标下标；其他按键返回 null */
function targetIndex(key: string, index: number, count: number): number | null {
  switch (key) {
    case 'ArrowRight':
      return (index + 1) % count;
    case 'ArrowLeft':
      return (index - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

export function Tabs({ label, tabs, initialId }: TabsProps) {
  const [selectedId, setSelectedId] = useState(() => (tabs.some((tab) => tab.id === initialId) ? initialId : tabs[0]?.id));
  const baseId = useId();
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = tabs[targetIndex(event.key, index, tabs.length) ?? -1];
    if (target === undefined) return;
    event.preventDefault();
    // 自动激活：焦点移到哪个标签页，就显示哪个面板
    setSelectedId(target.id);
    tabRefs.current.get(target.id)?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label={label}>
        {tabs.map((tab, index) => {
          const selected = tab.id === selectedId;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                if (element) tabRefs.current.set(tab.id, element);
                else tabRefs.current.delete(tab.id);
              }}
              id={`${baseId}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              // roving tabindex：只有选中的标签页在 Tab 的顺序中
              tabIndex={selected ? 0 : -1}
              onClick={() => setSelectedId(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`${baseId}-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          tabIndex={0}
          hidden={tab.id !== selectedId}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
```
:::

:::files{role=tests}
```tsx file=Tabs.test.tsx
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { Tabs, type TabItem } from './Tabs';

const tabs: TabItem[] = [
  { id: 'profile', label: '个人资料', content: <p>头像与昵称</p> },
  { id: 'security', label: '安全', content: <p>密码与两步验证</p> },
  { id: 'billing', label: '账单', content: <p>付款方式</p> },
];

const allTabs = () => within(screen.getByRole('tablist', { name: '账户设置' })).getAllByRole('tab');
const tabNamed = (name: string) => screen.getByRole('tab', { name });

describe('Tabs：角色、名字与状态', () => {
  test('tablist 有名字；选中的标签页与它的面板互相关联', () => {
    render(<Tabs label="账户设置" tabs={tabs} />);
    expect(allTabs().map((tab) => tab.textContent)).toEqual(['个人资料', '安全', '账单']);
    expect(allTabs().map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveTextContent('头像与昵称');
    expect(panel).toHaveAccessibleName('个人资料');
    expect(tabNamed('个人资料')).toHaveAttribute('aria-controls', panel.id);
  });

  test('只有选中的标签页在 Tab 的顺序中（roving tabindex）', () => {
    render(<Tabs label="账户设置" tabs={tabs} initialId="security" />);
    expect(allTabs().map((tab) => tab.tabIndex)).toEqual([-1, 0, -1]);
  });

  test('页面上有两个 Tabs 时 id 不重复；面板的 aria-labelledby 指向它自己的标签页', () => {
    render(
      <>
        <Tabs label="账户设置" tabs={tabs} />
        <Tabs label="团队设置" tabs={tabs} initialId="billing" />
      </>,
    );
    const ids = screen.getAllByRole('tab').map((tab) => tab.id);
    expect(ids.every((id) => id !== '')).toBe(true);
    expect(new Set(ids).size).toBe(6);
    for (const panel of screen.getAllByRole('tabpanel')) {
      const tab = document.getElementById(panel.getAttribute('aria-labelledby') ?? '');
      expect(tab).toHaveAttribute('aria-controls', panel.id);
      expect(tab).toHaveAttribute('aria-selected', 'true');
    }
  });

  test('initialId 不存在时选中第一个', () => {
    render(<Tabs label="账户设置" tabs={tabs} initialId="nope" />);
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('个人资料');
  });
});

describe('Tabs：操作', () => {
  test('点击切换面板', async () => {
    const user = userEvent.setup();
    render(<Tabs label="账户设置" tabs={tabs} />);
    await user.click(tabNamed('账单'));
    expect(tabNamed('账单')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('付款方式');
    expect(allTabs().map((tab) => tab.tabIndex)).toEqual([-1, -1, 0]);
  });

  test('按 Tab 进入时焦点在选中的标签页上，再按 Tab 到面板', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">之前</button>
        <Tabs label="账户设置" tabs={tabs} initialId="security" />
      </>,
    );
    await user.click(screen.getByRole('button', { name: '之前' }));
    await user.tab();
    expect(tabNamed('安全')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('tabpanel')).toHaveFocus();
  });

  test('方向键在两端循环，Home 与 End；焦点移动的同时切换面板', async () => {
    const user = userEvent.setup();
    render(<Tabs label="账户设置" tabs={tabs} />);
    await user.click(tabNamed('个人资料'));
    await user.keyboard('{ArrowRight}');
    expect(tabNamed('安全')).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('密码与两步验证');
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(tabNamed('账单')).toHaveFocus();
    expect(tabNamed('账单')).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowRight}');
    expect(tabNamed('个人资料')).toHaveFocus();
    await user.keyboard('{End}');
    expect(tabNamed('账单')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(tabNamed('个人资料')).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('头像与昵称');
  });

  test('方向键、Home、End 阻止默认的行为（页面滚动）', () => {
    render(<Tabs label="账户设置" tabs={tabs} />);
    for (const key of ['ArrowRight', 'ArrowLeft', 'End', 'Home']) {
      // dispatchEvent 的返回值：默认行为被阻止时是 false
      expect(fireEvent.keyDown(screen.getByRole('tab', { selected: true }), { key }), key).toBe(false);
    }
  });
});
```
:::

:::hint{level=1}
先把结构和属性写对（第 1–5 条）：`role`、`aria-selected`、`aria-controls`、`aria-labelledby`、`tabIndex`、`hidden`，它们都由同一个 `selectedId` 决定。`id` 可以写成 `` `${baseId}-tab-${tab.id}` `` 和 `` `${baseId}-panel-${tab.id}` ``，其中 `baseId = useId()`。
:::

:::hint{level=2}
键盘：给每个标签页加 `onKeyDown`，根据 `event.key` 算出目标的下标（`(index + 1) % tabs.length` 实现循环），然后 `setSelectedId` 并把焦点移过去。要能 `focus()` 另一个按钮，就需要它的引用：用 `useRef(new Map<string, HTMLButtonElement>())` 保存，在 `ref` 回调中放进去（g09 讲过 ref 回调）。
:::

:::explanation
标签页是一个典型的“复合组件”：一组标签页在 Tab 的顺序中只占**一个**位置，组内用方向键移动。这样，键盘用户按一次 Tab 就能越过整组标签页到达内容，而不用把每个标签页都走一遍。roving tabindex 正是为此：`tabIndex` 为 0 的那一个随着选中而“移动”。

所有的属性都从同一个 `selectedId` 算出来：`aria-selected`、`tabIndex`、`hidden`。这保证了视觉、键盘、读屏软件看到的状态永远一致，是 g07 中“单一数据来源”的原则在可访问性上的体现。

`aria-controls` 与 `aria-labelledby` 把标签页和面板双向关联起来：读屏软件进入面板时会读出“个人资料，标签页面板”。测试中 `toHaveAccessibleName('个人资料')` 检查的就是这个关联。

APG 中还有“手动激活”的标签页：方向键只移动焦点，按 Enter 或空格才切换面板。切换面板的代价很大时（例如要发请求），手动激活更合适。
:::

:::variant{kind=alt name=index-state}
```tsx file=Tabs.tsx
import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';

export type TabItem = { id: string; label: string; content: ReactNode };

type TabsProps = { label: string; tabs: readonly TabItem[]; initialId?: string };

export function Tabs({ label, tabs, initialId }: TabsProps) {
  const start = Math.max(0, tabs.findIndex((tab) => tab.id === initialId));
  const [active, setActive] = useState(start);
  const prefix = useId();

  function move(event: KeyboardEvent<HTMLDivElement>) {
    const keys: Record<string, (i: number) => number> = {
      ArrowRight: (i) => (i + 1) % tabs.length,
      ArrowLeft: (i) => (i + tabs.length - 1) % tabs.length,
      Home: () => 0,
      End: () => tabs.length - 1,
    };
    const step = keys[event.key];
    if (!step) return;
    event.preventDefault();
    const next = step(active);
    setActive(next);
    // 按钮都在 tablist 中，按顺序取第 next 个
    const button = event.currentTarget.querySelectorAll('[role="tab"]').item(next);
    if (button instanceof HTMLElement) button.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label={label} onKeyDown={move}>
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${prefix}t${i}`}
            aria-controls={`${prefix}p${i}`}
            aria-selected={i === active}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) =>
        i === active ? (
          <section key={tab.id} id={`${prefix}p${i}`} role="tabpanel" aria-labelledby={`${prefix}t${i}`} tabIndex={0}>
            {tab.content}
          </section>
        ) : null,
      )}
    </div>
  );
}
```
:::

:::variant{kind=wrong name=all-tabbable fails=tests reason="每个标签页都可以用 Tab 到达：按 Tab 进入时停在了第一个，而不是选中的那一个"}
```tsx file=Tabs.tsx
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export type TabItem = { id: string; label: string; content: ReactNode };

type TabsProps = { label: string; tabs: readonly TabItem[]; initialId?: string };

/** 方向键、Home、End 对应的目标下标；其他按键返回 null */
function targetIndex(key: string, index: number, count: number): number | null {
  switch (key) {
    case 'ArrowRight':
      return (index + 1) % count;
    case 'ArrowLeft':
      return (index - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

export function Tabs({ label, tabs, initialId }: TabsProps) {
  const [selectedId, setSelectedId] = useState(() => (tabs.some((tab) => tab.id === initialId) ? initialId : tabs[0]?.id));
  const baseId = useId();
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = tabs[targetIndex(event.key, index, tabs.length) ?? -1];
    if (target === undefined) return;
    event.preventDefault();
    // 自动激活：焦点移到哪个标签页，就显示哪个面板
    setSelectedId(target.id);
    tabRefs.current.get(target.id)?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label={label}>
        {tabs.map((tab, index) => {
          const selected = tab.id === selectedId;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                if (element) tabRefs.current.set(tab.id, element);
                else tabRefs.current.delete(tab.id);
              }}
              id={`${baseId}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              // roving tabindex：只有选中的标签页在 Tab 的顺序中
              tabIndex={0}
              onClick={() => setSelectedId(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`${baseId}-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          tabIndex={0}
          hidden={tab.id !== selectedId}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
```
:::

:::variant{kind=wrong name=no-wrap fails=tests reason="方向键在两端停住了：在第一个上按左方向键应该到最后一个"}
```tsx file=Tabs.tsx
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export type TabItem = { id: string; label: string; content: ReactNode };

type TabsProps = { label: string; tabs: readonly TabItem[]; initialId?: string };

/** 方向键、Home、End 对应的目标下标；其他按键返回 null */
function targetIndex(key: string, index: number, count: number): number | null {
  switch (key) {
    case 'ArrowRight':
      return Math.min(index + 1, count - 1);
    case 'ArrowLeft':
      return Math.max(index - 1, 0);
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

export function Tabs({ label, tabs, initialId }: TabsProps) {
  const [selectedId, setSelectedId] = useState(() => (tabs.some((tab) => tab.id === initialId) ? initialId : tabs[0]?.id));
  const baseId = useId();
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = tabs[targetIndex(event.key, index, tabs.length) ?? -1];
    if (target === undefined) return;
    event.preventDefault();
    // 自动激活：焦点移到哪个标签页，就显示哪个面板
    setSelectedId(target.id);
    tabRefs.current.get(target.id)?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label={label}>
        {tabs.map((tab, index) => {
          const selected = tab.id === selectedId;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                if (element) tabRefs.current.set(tab.id, element);
                else tabRefs.current.delete(tab.id);
              }}
              id={`${baseId}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              // roving tabindex：只有选中的标签页在 Tab 的顺序中
              tabIndex={selected ? 0 : -1}
              onClick={() => setSelectedId(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`${baseId}-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          tabIndex={0}
          hidden={tab.id !== selectedId}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
```
:::

:::variant{kind=wrong name=focus-stays fails=tests reason="方向键只切换了面板，焦点没有移动：再按一次方向键，还是从原来的位置算起"}
```tsx file=Tabs.tsx
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export type TabItem = { id: string; label: string; content: ReactNode };

type TabsProps = { label: string; tabs: readonly TabItem[]; initialId?: string };

/** 方向键、Home、End 对应的目标下标；其他按键返回 null */
function targetIndex(key: string, index: number, count: number): number | null {
  switch (key) {
    case 'ArrowRight':
      return (index + 1) % count;
    case 'ArrowLeft':
      return (index - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

export function Tabs({ label, tabs, initialId }: TabsProps) {
  const [selectedId, setSelectedId] = useState(() => (tabs.some((tab) => tab.id === initialId) ? initialId : tabs[0]?.id));
  const baseId = useId();
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = tabs[targetIndex(event.key, index, tabs.length) ?? -1];
    if (target === undefined) return;
    event.preventDefault();
    // 自动激活：焦点移到哪个标签页，就显示哪个面板
    setSelectedId(target.id);
  };

  return (
    <div>
      <div role="tablist" aria-label={label}>
        {tabs.map((tab, index) => {
          const selected = tab.id === selectedId;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                if (element) tabRefs.current.set(tab.id, element);
                else tabRefs.current.delete(tab.id);
              }}
              id={`${baseId}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              // roving tabindex：只有选中的标签页在 Tab 的顺序中
              tabIndex={selected ? 0 : -1}
              onClick={() => setSelectedId(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`${baseId}-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          tabIndex={0}
          hidden={tab.id !== selectedId}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
```
:::

:::variant{kind=wrong name=panels-visible fails=tests reason="其他的面板没有隐藏：页面上同时有三个 tabpanel"}
```tsx file=Tabs.tsx
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export type TabItem = { id: string; label: string; content: ReactNode };

type TabsProps = { label: string; tabs: readonly TabItem[]; initialId?: string };

/** 方向键、Home、End 对应的目标下标；其他按键返回 null */
function targetIndex(key: string, index: number, count: number): number | null {
  switch (key) {
    case 'ArrowRight':
      return (index + 1) % count;
    case 'ArrowLeft':
      return (index - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

export function Tabs({ label, tabs, initialId }: TabsProps) {
  const [selectedId, setSelectedId] = useState(() => (tabs.some((tab) => tab.id === initialId) ? initialId : tabs[0]?.id));
  const baseId = useId();
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = tabs[targetIndex(event.key, index, tabs.length) ?? -1];
    if (target === undefined) return;
    event.preventDefault();
    // 自动激活：焦点移到哪个标签页，就显示哪个面板
    setSelectedId(target.id);
    tabRefs.current.get(target.id)?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label={label}>
        {tabs.map((tab, index) => {
          const selected = tab.id === selectedId;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                if (element) tabRefs.current.set(tab.id, element);
                else tabRefs.current.delete(tab.id);
              }}
              id={`${baseId}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              // roving tabindex：只有选中的标签页在 Tab 的顺序中
              tabIndex={selected ? 0 : -1}
              onClick={() => setSelectedId(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`${baseId}-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          tabIndex={0}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
```
:::

:::variant{kind=wrong name=no-selected-state fails=tests reason="没有 aria-selected：视觉上切换了，读屏软件却不知道选中的是哪一个"}
```tsx file=Tabs.tsx
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export type TabItem = { id: string; label: string; content: ReactNode };

type TabsProps = { label: string; tabs: readonly TabItem[]; initialId?: string };

/** 方向键、Home、End 对应的目标下标；其他按键返回 null */
function targetIndex(key: string, index: number, count: number): number | null {
  switch (key) {
    case 'ArrowRight':
      return (index + 1) % count;
    case 'ArrowLeft':
      return (index - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

export function Tabs({ label, tabs, initialId }: TabsProps) {
  const [selectedId, setSelectedId] = useState(() => (tabs.some((tab) => tab.id === initialId) ? initialId : tabs[0]?.id));
  const baseId = useId();
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = tabs[targetIndex(event.key, index, tabs.length) ?? -1];
    if (target === undefined) return;
    event.preventDefault();
    // 自动激活：焦点移到哪个标签页，就显示哪个面板
    setSelectedId(target.id);
    tabRefs.current.get(target.id)?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label={label}>
        {tabs.map((tab, index) => {
          const selected = tab.id === selectedId;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                if (element) tabRefs.current.set(tab.id, element);
                else tabRefs.current.delete(tab.id);
              }}
              id={`${baseId}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-controls={`${baseId}-panel-${tab.id}`}
              // roving tabindex：只有选中的标签页在 Tab 的顺序中
              tabIndex={selected ? 0 : -1}
              onClick={() => setSelectedId(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`${baseId}-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          tabIndex={0}
          hidden={tab.id !== selectedId}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
```
:::
