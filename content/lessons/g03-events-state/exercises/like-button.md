---
kind: task
title: 可以取消的点赞按钮
---
完成 `LikeButton` 组件：

- 按钮文字为 `赞 N`（未点赞时）或 `已赞 N`（已点赞时），`N` 是当前点赞数，初始为 `initialCount`。
- 点击一次：变为已点赞，点赞数加 1；再点击一次：取消点赞，点赞数减 1，如此反复。
- 按钮的 `aria-pressed` 属性反映是否已点赞（`true` / `false`），让读屏软件也能知道按钮状态。

:::files{role=starter}
```tsx file=LikeButton.tsx
type LikeButtonProps = {
  initialCount: number;
};

export function LikeButton({ initialCount }: LikeButtonProps) {
  const liked = false;
  const count = initialCount;

  return (
    <button type="button" aria-pressed={liked}>
      {liked ? '已赞' : '赞'} {count}
    </button>
  );
}
```
:::

:::files{role=support}
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { LikeButton } from './LikeButton';

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<LikeButton initialCount={10} />);
```
:::

:::files{role=solution}
```tsx file=LikeButton.tsx
import { useState } from 'react';

type LikeButtonProps = {
  initialCount: number;
};

export function LikeButton({ initialCount }: LikeButtonProps) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);

  function handleClick() {
    setCount(liked ? count - 1 : count + 1);
    setLiked(!liked);
  }

  return (
    <button type="button" aria-pressed={liked} onClick={handleClick}>
      {liked ? '已赞' : '赞'} {count}
    </button>
  );
}
```
:::

:::files{role=tests}
```tsx file=LikeButton.test.tsx
import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LikeButton } from './LikeButton';

test('初始未点赞', () => {
  render(<LikeButton initialCount={10} />);
  const button = screen.getByRole('button');
  expect(button).toHaveTextContent(/^赞 10$/);
  expect(button).toHaveAttribute('aria-pressed', 'false');
});

test('点击后已点赞并加 1', async () => {
  const user = userEvent.setup();
  render(<LikeButton initialCount={10} />);
  await user.click(screen.getByRole('button'));
  expect(screen.getByRole('button')).toHaveTextContent(/^已赞 11$/);
  expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
});

test('再次点击取消点赞并减 1，可以反复切换', async () => {
  const user = userEvent.setup();
  render(<LikeButton initialCount={3} />);
  const button = screen.getByRole('button');
  await user.click(button);
  await user.click(button);
  expect(button).toHaveTextContent(/^赞 3$/);
  expect(button).toHaveAttribute('aria-pressed', 'false');
  await user.click(button);
  expect(button).toHaveTextContent(/^已赞 4$/);
});
```
:::

:::hint{level=1}
有两样东西需要在多次渲染之间被记住：是否已点赞、当前点赞数。每样东西用一个 `useState`。
:::

:::hint{level=2}
`const [liked, setLiked] = useState(false)` 与 `const [count, setCount] = useState(initialCount)`；给按钮加 `onClick`，在处理函数里根据**当前的** `liked` 决定加 1 还是减 1，然后把 `liked` 取反。
:::

:::explanation
两个 state 变量分别记住“是否已点赞”和“点赞数”。处理函数里读取的 `liked` 是本次渲染的快照，所以先用它算出新的点赞数、再把它取反，顺序无关紧要。

也可以把 `count` 的计算写成更新函数，或者只存 `liked`、在渲染时用 `initialCount + (liked ? 1 : 0)` 计算出点赞数——后者更简单：能从已有数据算出的值，不必单独存成 state。
:::

:::variant{kind=alt name=derived-count}
```tsx file=LikeButton.tsx
import { useState } from 'react';

type LikeButtonProps = {
  initialCount: number;
};

export function LikeButton({ initialCount }: LikeButtonProps) {
  const [liked, setLiked] = useState(false);
  const count = initialCount + (liked ? 1 : 0);

  return (
    <button type="button" aria-pressed={liked} onClick={() => setLiked((l) => !l)}>
      {liked ? '已赞' : '赞'} {count}
    </button>
  );
}
```
:::

:::variant{kind=wrong name=plain-variables fails=tests reason="用普通变量记录状态：修改后不会重新渲染"}
```tsx file=LikeButton.tsx
type LikeButtonProps = {
  initialCount: number;
};

export function LikeButton({ initialCount }: LikeButtonProps) {
  let liked = false;
  let count = initialCount;

  return (
    <button
      type="button"
      aria-pressed={liked}
      onClick={() => {
        count = liked ? count - 1 : count + 1;
        liked = !liked;
      }}
    >
      {liked ? '已赞' : '赞'} {count}
    </button>
  );
}
```
:::

:::variant{kind=wrong name=only-increments fails=tests reason="取消点赞时没有减 1"}
```tsx file=LikeButton.tsx
import { useState } from 'react';

type LikeButtonProps = {
  initialCount: number;
};

export function LikeButton({ initialCount }: LikeButtonProps) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);

  return (
    <button
      type="button"
      aria-pressed={liked}
      onClick={() => {
        setCount(count + 1);
        setLiked(!liked);
      }}
    >
      {liked ? '已赞' : '赞'} {count}
    </button>
  );
}
```
:::
