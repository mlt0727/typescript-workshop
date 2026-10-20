---
kind: challenge
title: 设置面板
---
完成 `SettingsPanel`。它用 `initial` 作为 state 的初始值，用户可以修改设置，点“保存”时把当前的设置交给 `onSave`。设置对象有一层嵌套：

```ts
{ theme: 'light' | 'dark'; fontSize: number; notifications: { email: boolean; push: boolean } }
```

界面（测试依赖这些文字和可访问名称）：

1. `<p>主题：浅色</p>`（或“深色”）和一个“切换主题”按钮；
2. `<output aria-label="字号">` 显示字号；“缩小字号”和“放大字号”两个按钮，每次变化 2，范围是 12 到 24，到达边界时对应的按钮禁用；
3. “邮件通知”“推送通知”两个开关按钮，用 `aria-pressed` 表示是否开启，点击时切换；
4. “保存”按钮：用当前的设置调用 `onSave`；
5. “撤销修改”按钮：回到 `initial`。当前的设置**就是** `initial` 这个对象时（还没有修改过，或者刚刚撤销），按钮禁用。

所有的更新都要创建新对象，**不能修改** `initial`；只改了字号时，`notifications` 应该仍然是原来的对象。

:::files{role=starter}
```tsx file=SettingsPanel.tsx
import { useState } from 'react';

export type Settings = Readonly<{
  theme: 'light' | 'dark';
  fontSize: number;
  notifications: Readonly<{ email: boolean; push: boolean }>;
}>;

type SettingsPanelProps = {
  initial: Settings;
  onSave: (settings: Settings) => void;
};

export function SettingsPanel({ initial, onSave }: SettingsPanelProps) {
  const [settings, setSettings] = useState(initial);

  // TODO：切换主题、调整字号、切换两种通知、保存、撤销修改
  return (
    <section aria-label="设置">
      <p>主题：{settings.theme === 'dark' ? '深色' : '浅色'}</p>
      <p>
        字号：<output aria-label="字号">{settings.fontSize}</output>
      </p>
    </section>
  );
}
```
:::

:::files{role=support}
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { SettingsPanel, type Settings } from './SettingsPanel';

const saved: Settings = { theme: 'light', fontSize: 16, notifications: { email: true, push: false } };

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(
  <SettingsPanel initial={saved} onSave={(settings) => console.log('保存：', settings, '原来的对象没有变：', saved)} />,
);
```
:::

:::files{role=solution}
```tsx file=SettingsPanel.tsx
import { useState } from 'react';

export type Settings = Readonly<{
  theme: 'light' | 'dark';
  fontSize: number;
  notifications: Readonly<{ email: boolean; push: boolean }>;
}>;

type SettingsPanelProps = {
  initial: Settings;
  onSave: (settings: Settings) => void;
};

export function SettingsPanel({ initial, onSave }: SettingsPanelProps) {
  const [settings, setSettings] = useState(initial);

  function toggleTheme() {
    setSettings({ ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' });
  }

  function changeFontSize(delta: number) {
    setSettings({ ...settings, fontSize: Math.min(24, Math.max(12, settings.fontSize + delta)) });
  }

  function toggleNotification(channel: 'email' | 'push') {
    setSettings({
      ...settings,
      notifications: { ...settings.notifications, [channel]: !settings.notifications[channel] },
    });
  }

  return (
    <section aria-label="设置">
      <p>主题：{settings.theme === 'dark' ? '深色' : '浅色'}</p>
      <button type="button" onClick={toggleTheme}>
        切换主题
      </button>
      <p>
        字号：<output aria-label="字号">{settings.fontSize}</output>
      </p>
      <button type="button" disabled={settings.fontSize <= 12} onClick={() => changeFontSize(-2)}>
        缩小字号
      </button>
      <button type="button" disabled={settings.fontSize >= 24} onClick={() => changeFontSize(2)}>
        放大字号
      </button>
      <p>通知：</p>
      <button type="button" aria-pressed={settings.notifications.email} onClick={() => toggleNotification('email')}>
        邮件通知
      </button>
      <button type="button" aria-pressed={settings.notifications.push} onClick={() => toggleNotification('push')}>
        推送通知
      </button>
      <p>
        <button type="button" onClick={() => onSave(settings)}>
          保存
        </button>
        <button type="button" disabled={settings === initial} onClick={() => setSettings(initial)}>
          撤销修改
        </button>
      </p>
    </section>
  );
}
```
:::

:::files{role=tests}
```tsx file=SettingsPanel.test.tsx
import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsPanel, type Settings } from './SettingsPanel';

function initialSettings(): Settings {
  return Object.freeze({
    theme: 'light',
    fontSize: 16,
    notifications: Object.freeze({ email: true, push: false }),
  });
}

function setup() {
  const initial = initialSettings();
  const onSave = vi.fn<(settings: Settings) => void>();
  render(<SettingsPanel initial={initial} onSave={onSave} />);
  return { initial, onSave, user: userEvent.setup() };
}

function lastSaved(onSave: { mock: { calls: [Settings][] } }): Settings {
  const call = onSave.mock.calls.at(-1);
  if (call === undefined) throw new Error('onSave 没有被调用');
  return call[0];
}

test('切换主题', async () => {
  const { user } = setup();
  await user.click(screen.getByRole('button', { name: '切换主题' }));
  expect(screen.getByText('主题：深色')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '切换主题' }));
  expect(screen.getByText('主题：浅色')).toBeInTheDocument();
});

test('字号每次变化 2，范围 12–24，到达边界时按钮禁用', async () => {
  const { user } = setup();
  const bigger = screen.getByRole('button', { name: '放大字号' });
  for (let i = 0; i < 4; i++) await user.click(bigger);
  expect(screen.getByRole('status', { name: '字号' })).toHaveTextContent('24');
  expect(bigger).toBeDisabled();
  const smaller = screen.getByRole('button', { name: '缩小字号' });
  await user.click(smaller);
  expect(screen.getByRole('status', { name: '字号' })).toHaveTextContent('22');
  for (let i = 0; i < 5; i++) await user.click(smaller);
  expect(screen.getByRole('status', { name: '字号' })).toHaveTextContent('12');
  expect(smaller).toBeDisabled();
});

test('两种通知可以分别切换', async () => {
  const { user } = setup();
  const email = screen.getByRole('button', { name: '邮件通知' });
  const push = screen.getByRole('button', { name: '推送通知' });
  expect(email).toHaveAttribute('aria-pressed', 'true');
  expect(push).toHaveAttribute('aria-pressed', 'false');
  await user.click(push);
  await user.click(email);
  expect(email).toHaveAttribute('aria-pressed', 'false');
  expect(push).toHaveAttribute('aria-pressed', 'true');
});

test('保存时交出新对象，原来的设置没有被修改', async () => {
  const { initial, onSave, user } = setup();
  await user.click(screen.getByRole('button', { name: '放大字号' }));
  await user.click(screen.getByRole('button', { name: '推送通知' }));
  await user.click(screen.getByRole('button', { name: '保存' }));
  const saved = lastSaved(onSave);
  expect(saved).toEqual({ theme: 'light', fontSize: 18, notifications: { email: true, push: true } });
  expect(saved).not.toBe(initial);
  expect(saved.notifications).not.toBe(initial.notifications);
  expect(initial).toEqual({ theme: 'light', fontSize: 16, notifications: { email: true, push: false } });
});

test('只改了字号时，通知设置仍是原来的对象', async () => {
  const { initial, onSave, user } = setup();
  await user.click(screen.getByRole('button', { name: '缩小字号' }));
  await user.click(screen.getByRole('button', { name: '保存' }));
  expect(lastSaved(onSave).notifications).toBe(initial.notifications);
});

test('撤销修改：回到初始设置；没有修改时不可用', async () => {
  const { initial, onSave, user } = setup();
  const undo = screen.getByRole('button', { name: '撤销修改' });
  expect(undo).toBeDisabled();
  await user.click(screen.getByRole('button', { name: '切换主题' }));
  await user.click(screen.getByRole('button', { name: '邮件通知' }));
  expect(undo).toBeEnabled();
  await user.click(undo);
  expect(screen.getByText('主题：浅色')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '邮件通知' })).toHaveAttribute('aria-pressed', 'true');
  expect(undo).toBeDisabled();
  await user.click(screen.getByRole('button', { name: '保存' }));
  expect(lastSaved(onSave)).toBe(initial);
});
```
:::

:::hint{level=1}
每个按钮对应一次 `setSettings({ ...settings, 要改的属性 })`。改通知时有两层：外层对象和 `notifications` 都要展开：`{ ...settings, notifications: { ...settings.notifications, push: !settings.notifications.push } }`。
:::

:::hint{level=2}
两种通知的处理几乎一样，可以写成一个函数 `toggleNotification(channel: 'email' | 'push')`，用计算属性名 `[channel]` 指定要改的键。“撤销修改”的禁用条件就是 `settings === initial`：只要发生过修改，`settings` 就是一个新对象。
:::

:::explanation
这道题的关键在“撤销修改”。因为从来没有修改过 `initial`，它始终保存着最初的设置，撤销只需要 `setSettings(initial)`。如果某处直接修改了 state（例如 `settings.fontSize += 2`），`initial` 也会一起被改掉（它们是同一个对象），撤销就失效了，而且界面根本不会更新。

`settings === initial` 能够判断“有没有修改过”，也是因为每次修改都创建新对象：引用变了，就说明发生过修改。这种“用引用判断变化”的方式，React 在很多地方都在用。

展开只复制一层。改通知时，如果只写 `{ ...settings }` 再去改 `notifications.push`，改的仍然是原来的 `notifications` 对象（测试冻结了它，会直接报错）。反过来，只改字号时不需要碰 `notifications`，新设置会继续使用原来的那个对象，测试检查的正是这一点。

类型中的 `Readonly<…>` 让这些错误在编译时就能发现：`settings.fontSize += 2` 和 `settings.notifications.push = true` 都会报错。
:::

:::variant{kind=alt name=updater-and-patch}
```tsx file=SettingsPanel.tsx
import { useState } from 'react';

export type Settings = Readonly<{
  theme: 'light' | 'dark';
  fontSize: number;
  notifications: Readonly<{ email: boolean; push: boolean }>;
}>;

type SettingsPanelProps = {
  initial: Settings;
  onSave: (settings: Settings) => void;
};

type Channel = keyof Settings['notifications'];

const clamp = (n: number) => Math.min(24, Math.max(12, n));

export function SettingsPanel({ initial, onSave }: SettingsPanelProps) {
  const [settings, setSettings] = useState(initial);
  const { theme, fontSize, notifications } = settings;

  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));
  const toggle = (channel: Channel) =>
    setSettings((s) => ({ ...s, notifications: { ...s.notifications, [channel]: !s.notifications[channel] } }));

  return (
    <section aria-label="设置">
      <p>主题：{theme === 'dark' ? '深色' : '浅色'}</p>
      <button type="button" onClick={() => update({ theme: theme === 'dark' ? 'light' : 'dark' })}>
        切换主题
      </button>
      <p>
        字号：<output aria-label="字号">{fontSize}</output>
      </p>
      <button type="button" disabled={fontSize === 12} onClick={() => update({ fontSize: clamp(fontSize - 2) })}>
        缩小字号
      </button>
      <button type="button" disabled={fontSize === 24} onClick={() => update({ fontSize: clamp(fontSize + 2) })}>
        放大字号
      </button>
      <p>通知：</p>
      {(['email', 'push'] as const).map((channel) => (
        <button key={channel} type="button" aria-pressed={notifications[channel]} onClick={() => toggle(channel)}>
          {channel === 'email' ? '邮件通知' : '推送通知'}
        </button>
      ))}
      <p>
        <button type="button" onClick={() => onSave(settings)}>
          保存
        </button>
        <button type="button" disabled={settings === initial} onClick={() => setSettings(initial)}>
          撤销修改
        </button>
      </p>
    </section>
  );
}
```
:::

:::variant{kind=wrong name=mutate-nested fails=types reason="修改了 notifications 对象本身"}
```tsx file=SettingsPanel.tsx
import { useState } from 'react';

export type Settings = Readonly<{
  theme: 'light' | 'dark';
  fontSize: number;
  notifications: Readonly<{ email: boolean; push: boolean }>;
}>;

type SettingsPanelProps = {
  initial: Settings;
  onSave: (settings: Settings) => void;
};

export function SettingsPanel({ initial, onSave }: SettingsPanelProps) {
  const [settings, setSettings] = useState(initial);

  function toggleTheme() {
    setSettings({ ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' });
  }

  function changeFontSize(delta: number) {
    setSettings({ ...settings, fontSize: Math.min(24, Math.max(12, settings.fontSize + delta)) });
  }

  function toggleNotification(channel: 'email' | 'push') {
    settings.notifications[channel] = !settings.notifications[channel];
    setSettings({ ...settings });
  }

  return (
    <section aria-label="设置">
      <p>主题：{settings.theme === 'dark' ? '深色' : '浅色'}</p>
      <button type="button" onClick={toggleTheme}>
        切换主题
      </button>
      <p>
        字号：<output aria-label="字号">{settings.fontSize}</output>
      </p>
      <button type="button" disabled={settings.fontSize <= 12} onClick={() => changeFontSize(-2)}>
        缩小字号
      </button>
      <button type="button" disabled={settings.fontSize >= 24} onClick={() => changeFontSize(2)}>
        放大字号
      </button>
      <p>通知：</p>
      <button type="button" aria-pressed={settings.notifications.email} onClick={() => toggleNotification('email')}>
        邮件通知
      </button>
      <button type="button" aria-pressed={settings.notifications.push} onClick={() => toggleNotification('push')}>
        推送通知
      </button>
      <p>
        <button type="button" onClick={() => onSave(settings)}>
          保存
        </button>
        <button type="button" disabled={settings === initial} onClick={() => setSettings(initial)}>
          撤销修改
        </button>
      </p>
    </section>
  );
}
```
:::

:::variant{kind=wrong name=clone-on-every-change fails=tests reason="每次修改都深拷贝，只改字号时 notifications 也被换掉了"}
```tsx file=SettingsPanel.tsx
import { useState } from 'react';

export type Settings = Readonly<{
  theme: 'light' | 'dark';
  fontSize: number;
  notifications: Readonly<{ email: boolean; push: boolean }>;
}>;

type SettingsPanelProps = {
  initial: Settings;
  onSave: (settings: Settings) => void;
};

export function SettingsPanel({ initial, onSave }: SettingsPanelProps) {
  const [settings, setSettings] = useState(initial);

  function toggleTheme() {
    setSettings({ ...structuredClone(settings), theme: settings.theme === 'dark' ? 'light' : 'dark' });
  }

  function changeFontSize(delta: number) {
    setSettings({ ...structuredClone(settings), fontSize: Math.min(24, Math.max(12, settings.fontSize + delta)) });
  }

  function toggleNotification(channel: 'email' | 'push') {
    setSettings({
      ...settings,
      notifications: { ...settings.notifications, [channel]: !settings.notifications[channel] },
    });
  }

  return (
    <section aria-label="设置">
      <p>主题：{settings.theme === 'dark' ? '深色' : '浅色'}</p>
      <button type="button" onClick={toggleTheme}>
        切换主题
      </button>
      <p>
        字号：<output aria-label="字号">{settings.fontSize}</output>
      </p>
      <button type="button" disabled={settings.fontSize <= 12} onClick={() => changeFontSize(-2)}>
        缩小字号
      </button>
      <button type="button" disabled={settings.fontSize >= 24} onClick={() => changeFontSize(2)}>
        放大字号
      </button>
      <p>通知：</p>
      <button type="button" aria-pressed={settings.notifications.email} onClick={() => toggleNotification('email')}>
        邮件通知
      </button>
      <button type="button" aria-pressed={settings.notifications.push} onClick={() => toggleNotification('push')}>
        推送通知
      </button>
      <p>
        <button type="button" onClick={() => onSave(settings)}>
          保存
        </button>
        <button type="button" disabled={settings === initial} onClick={() => setSettings(initial)}>
          撤销修改
        </button>
      </p>
    </section>
  );
}
```
:::

:::variant{kind=wrong name=undo-with-copy fails=tests reason="撤销时复制了 initial，撤销后按钮仍然可用"}
```tsx file=SettingsPanel.tsx
import { useState } from 'react';

export type Settings = Readonly<{
  theme: 'light' | 'dark';
  fontSize: number;
  notifications: Readonly<{ email: boolean; push: boolean }>;
}>;

type SettingsPanelProps = {
  initial: Settings;
  onSave: (settings: Settings) => void;
};

export function SettingsPanel({ initial, onSave }: SettingsPanelProps) {
  const [settings, setSettings] = useState(initial);

  function toggleTheme() {
    setSettings({ ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' });
  }

  function changeFontSize(delta: number) {
    setSettings({ ...settings, fontSize: Math.min(24, Math.max(12, settings.fontSize + delta)) });
  }

  function toggleNotification(channel: 'email' | 'push') {
    setSettings({
      ...settings,
      notifications: { ...settings.notifications, [channel]: !settings.notifications[channel] },
    });
  }

  return (
    <section aria-label="设置">
      <p>主题：{settings.theme === 'dark' ? '深色' : '浅色'}</p>
      <button type="button" onClick={toggleTheme}>
        切换主题
      </button>
      <p>
        字号：<output aria-label="字号">{settings.fontSize}</output>
      </p>
      <button type="button" disabled={settings.fontSize <= 12} onClick={() => changeFontSize(-2)}>
        缩小字号
      </button>
      <button type="button" disabled={settings.fontSize >= 24} onClick={() => changeFontSize(2)}>
        放大字号
      </button>
      <p>通知：</p>
      <button type="button" aria-pressed={settings.notifications.email} onClick={() => toggleNotification('email')}>
        邮件通知
      </button>
      <button type="button" aria-pressed={settings.notifications.push} onClick={() => toggleNotification('push')}>
        推送通知
      </button>
      <p>
        <button type="button" onClick={() => onSave(settings)}>
          保存
        </button>
        <button type="button" disabled={settings === initial} onClick={() => setSettings({ ...initial })}>
          撤销修改
        </button>
      </p>
    </section>
  );
}
```
:::

:::variant{kind=wrong name=jump-to-limit fails=tests reason="点一次就把字号设成了上限或下限"}
```tsx file=SettingsPanel.tsx
import { useState } from 'react';

export type Settings = Readonly<{
  theme: 'light' | 'dark';
  fontSize: number;
  notifications: Readonly<{ email: boolean; push: boolean }>;
}>;

type SettingsPanelProps = {
  initial: Settings;
  onSave: (settings: Settings) => void;
};

export function SettingsPanel({ initial, onSave }: SettingsPanelProps) {
  const [settings, setSettings] = useState(initial);

  function toggleTheme() {
    setSettings({ ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' });
  }

  function changeFontSize(delta: number) {
    setSettings({ ...settings, fontSize: delta > 0 ? 24 : 12 });
  }

  function toggleNotification(channel: 'email' | 'push') {
    setSettings({
      ...settings,
      notifications: { ...settings.notifications, [channel]: !settings.notifications[channel] },
    });
  }

  return (
    <section aria-label="设置">
      <p>主题：{settings.theme === 'dark' ? '深色' : '浅色'}</p>
      <button type="button" onClick={toggleTheme}>
        切换主题
      </button>
      <p>
        字号：<output aria-label="字号">{settings.fontSize}</output>
      </p>
      <button type="button" disabled={settings.fontSize <= 12} onClick={() => changeFontSize(-2)}>
        缩小字号
      </button>
      <button type="button" disabled={settings.fontSize >= 24} onClick={() => changeFontSize(2)}>
        放大字号
      </button>
      <p>通知：</p>
      <button type="button" aria-pressed={settings.notifications.email} onClick={() => toggleNotification('email')}>
        邮件通知
      </button>
      <button type="button" aria-pressed={settings.notifications.push} onClick={() => toggleNotification('push')}>
        推送通知
      </button>
      <p>
        <button type="button" onClick={() => onSave(settings)}>
          保存
        </button>
        <button type="button" disabled={settings === initial} onClick={() => setSettings(initial)}>
          撤销修改
        </button>
      </p>
    </section>
  );
}
```
:::
