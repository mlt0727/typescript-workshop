---
kind: task
title: 带默认值和回调的用户卡片
---
完成 `UserCard` 组件，它接受这些 props：

| prop | 类型 | 说明 |
| --- | --- | --- |
| `name` | `string` | 必填 |
| `role` | `string` | 可选，默认 `'成员'` |
| `online` | `boolean` | 可选，默认 `false` |
| `onMessage` | `(name: string) => void` | 可选 |

渲染：

```html
<article class="user-card">
  <h3>名字</h3>
  <p>角色</p>
  <p class="status online">在线</p>   <!-- 离线时：<p class="status">离线</p> -->
  <button type="button">发消息</button>   <!-- 只有传了 onMessage 才显示 -->
</article>
```

点击“发消息”时，用这张卡片的名字调用 `onMessage`。

:::files{role=starter}
```tsx file=UserCard.tsx
export function UserCard() {
  return (
    <article className="user-card">
      <h3>名字</h3>
    </article>
  );
}
```
:::

:::files{role=support}
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { UserCard } from './UserCard';

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(
  <>
    <UserCard name="韩梅梅" role="设计师" online onMessage={(name) => console.log(`给 ${name} 发消息`)} />
    <UserCard name="王五" />
  </>,
);
```
:::

:::files{role=solution}
```tsx file=UserCard.tsx
type UserCardProps = {
  name: string;
  role?: string;
  online?: boolean;
  onMessage?: (name: string) => void;
};

export function UserCard({ name, role = '成员', online = false, onMessage }: UserCardProps) {
  return (
    <article className="user-card">
      <h3>{name}</h3>
      <p>{role}</p>
      <p className={online ? 'status online' : 'status'}>{online ? '在线' : '离线'}</p>
      {onMessage !== undefined && (
        <button type="button" onClick={() => onMessage(name)}>
          发消息
        </button>
      )}
    </article>
  );
}
```
:::

:::files{role=tests}
```tsx file=UserCard.test.tsx
import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserCard } from './UserCard';

test('只传 name 时使用默认值，没有发消息按钮', () => {
  const { container } = render(<UserCard name="王五" />);
  expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(/^王五$/);
  expect(screen.getByText('成员')).toBeInTheDocument();
  const status = screen.getByText('离线');
  expect(status.className).toBe('status');
  expect(screen.queryByRole('button')).toBeNull();
  expect(container.querySelector('article.user-card')?.children).toHaveLength(3);
});

test('传入所有的 props', () => {
  render(<UserCard name="韩梅梅" role="设计师" online onMessage={() => {}} />);
  expect(screen.getByText('设计师')).toBeInTheDocument();
  expect(screen.getByText('在线').className).toBe('status online');
  expect(screen.getByRole('button', { name: '发消息' })).toHaveAttribute('type', 'button');
});

test('点击“发消息”时用名字调用 onMessage', async () => {
  const onMessage = vi.fn();
  render(
    <>
      <UserCard name="韩梅梅" onMessage={onMessage} />
      <UserCard name="李雷" onMessage={onMessage} />
    </>,
  );
  const [first, second] = screen.getAllByRole('button', { name: '发消息' });
  const user = userEvent.setup();
  if (first === undefined || second === undefined) throw new Error('应该有两个按钮');
  await user.click(second);
  await user.click(first);
  expect(onMessage.mock.calls).toEqual([['李雷'], ['韩梅梅']]);
});
```
```tsx file=UserCard.test-d.tsx
import { UserCard } from './UserCard';

// @ts-expect-error 缺少必填的 name
const missingName = <UserCard />;
// @ts-expect-error online 必须是布尔值
const wrongOnline = <UserCard name="王五" online="yes" />;
// @ts-expect-error onMessage 收到的是名字（字符串）
const wrongCallback = <UserCard name="王五" onMessage={(id: number) => console.log(id)} />;
const ok = <UserCard name="王五" role="组长" online onMessage={(name) => console.log(name.toUpperCase())} />;

console.log(missingName, wrongOnline, wrongCallback, ok);
```
:::

:::hint{level=1}
先写出 `type UserCardProps = { … }`，可选的 props 加 `?`。组件的参数写成解构：`function UserCard({ name, role = '成员', online = false, onMessage }: UserCardProps)`。
:::

:::hint{level=2}
按钮只在 `onMessage !== undefined` 时渲染：`{onMessage !== undefined && <button …>}`。点击时要传入名字，所以写 `onClick={() => onMessage(name)}`，而不是 `onClick={onMessage}`。
:::

:::explanation
`onClick={onMessage}` 是一个容易犯的错误：React 调用点击处理函数时，传入的是**事件对象**，而 `onMessage` 想要的是名字。TypeScript 会在这里报错（事件对象不能赋给 `string` 类型的参数）。包一层箭头函数 `() => onMessage(name)`，决定传什么的就是你自己。

用解构的默认值，函数体中的 `role` 是 `string`，`online` 是 `boolean`，不再需要到处写 `?? '成员'`。注意默认值只在值为 `undefined` 时生效：`role=""` 会显示空字符串，这是使用者明确传入的值。

类型测试检查的是组件的“接口”：使用者漏写 `name`、把 `online` 写成字符串、回调的参数类型不对，都应该在编译时就被发现。这正是给 props 写类型的意义：组件的使用说明由编译器来执行。
:::

:::variant{kind=alt name=props-object}
```tsx file=UserCard.tsx
interface UserCardProps {
  name: string;
  role?: string;
  online?: boolean;
  onMessage?: (name: string) => void;
}

export function UserCard(props: UserCardProps) {
  const role = props.role ?? '成员';
  const online = props.online === true;
  const { onMessage } = props;
  let action = null;
  if (onMessage) {
    action = (
      <button type="button" onClick={() => onMessage(props.name)}>
        发消息
      </button>
    );
  }
  return (
    <article className="user-card">
      <h3>{props.name}</h3>
      <p>{role}</p>
      <p className={'status' + (online ? ' online' : '')}>{online ? '在线' : '离线'}</p>
      {action}
    </article>
  );
}
```
:::

:::variant{kind=wrong name=no-defaults fails=tests reason="没有给 role 设置默认值"}
```tsx file=UserCard.tsx
type UserCardProps = {
  name: string;
  role?: string;
  online?: boolean;
  onMessage?: (name: string) => void;
};

export function UserCard({ name, role, online, onMessage }: UserCardProps) {
  return (
    <article className="user-card">
      <h3>{name}</h3>
      <p>{role}</p>
      <p className={online ? 'status online' : 'status'}>{online ? '在线' : '离线'}</p>
      {onMessage !== undefined && (
        <button type="button" onClick={() => onMessage(name)}>
          发消息
        </button>
      )}
    </article>
  );
}
```
:::

:::variant{kind=wrong name=all-required fails=types reason="所有的 props 都写成了必填"}
```tsx file=UserCard.tsx
type UserCardProps = {
  name: string;
  role: string;
  online: boolean;
  onMessage: (name: string) => void;
};

export function UserCard({ name, role, online, onMessage }: UserCardProps) {
  return (
    <article className="user-card">
      <h3>{name}</h3>
      <p>{role}</p>
      <p className={online ? 'status online' : 'status'}>{online ? '在线' : '离线'}</p>
      <button type="button" onClick={() => onMessage(name)}>
        发消息
      </button>
    </article>
  );
}
```
:::

:::variant{kind=wrong name=pass-handler-directly fails=types reason="onClick={onMessage}：React 传入的是事件对象，不是名字"}
```tsx file=UserCard.tsx
type UserCardProps = {
  name: string;
  role?: string;
  online?: boolean;
  onMessage?: (name: string) => void;
};

export function UserCard({ name, role = '成员', online = false, onMessage }: UserCardProps) {
  return (
    <article className="user-card">
      <h3>{name}</h3>
      <p>{role}</p>
      <p className={online ? 'status online' : 'status'}>{online ? '在线' : '离线'}</p>
      {onMessage !== undefined && (
        <button type="button" onClick={onMessage}>
          发消息
        </button>
      )}
    </article>
  );
}
```
:::

:::variant{kind=wrong name=always-button fails=tests reason="没有传 onMessage 时也显示了发消息按钮"}
```tsx file=UserCard.tsx
type UserCardProps = {
  name: string;
  role?: string;
  online?: boolean;
  onMessage?: (name: string) => void;
};

export function UserCard({ name, role = '成员', online = false, onMessage }: UserCardProps) {
  return (
    <article className="user-card">
      <h3>{name}</h3>
      <p>{role}</p>
      <p className={online ? 'status online' : 'status'}>{online ? '在线' : '离线'}</p>
      <button type="button" onClick={() => onMessage?.(name)}>
        发消息
      </button>
    </article>
  );
}
```
:::
