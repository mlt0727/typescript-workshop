---
kind: task
title: 清空之后，焦点回到输入框
---
起始代码的“清空”按钮清空了内容，但焦点还留在按钮上，并且按钮随即变成不可用（e07 讲过这会让焦点丢失）。用户想重新输入，得先用鼠标点回输入框。用 ref 改进它：

1. 点“清空”时，清空内容，并把焦点移回输入框；
2. 在输入框中按 Esc，同样清空（焦点本来就在输入框中）；
3. 页面上有多个 `SearchBox` 时，焦点要回到**被清空的那一个**。

提交的行为（去掉空白、为空时不搜索）已经写好，保持不变。

注意：Chrome 和 Safari 中，`type="search"` 的输入框自带“按 Esc 清空”，所以在预览中起始代码看起来已经支持 Esc。Firefox 没有这个行为，测试中模拟的按键也不会触发它，所以要自己处理。

:::files{role=starter}
```tsx file=SearchBox.tsx
import { useState } from 'react';

export function SearchBox({ onSearch }: { onSearch: (query: string) => void }) {
  const [query, setQuery] = useState('');

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const text = query.trim();
        if (text !== '') onSearch(text);
      }}
    >
      <label>
        搜索
        <input type="search" value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
      </label>
      <button type="button" disabled={query === ''} onClick={() => setQuery('')}>
        清空
      </button>
      <button type="submit">查找</button>
    </form>
  );
}
```
:::

:::files{role=support}
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { SearchBox } from './SearchBox';

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<SearchBox onSearch={(q) => console.log('搜索：', q)} />);
```
:::

:::files{role=solution}
```tsx file=SearchBox.tsx
import { useRef, useState } from 'react';

export function SearchBox({ onSearch }: { onSearch: (query: string) => void }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function clear() {
    setQuery('');
    inputRef.current?.focus();
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const text = query.trim();
        if (text !== '') onSearch(text);
      }}
    >
      <label>
        搜索
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') clear();
          }}
        />
      </label>
      <button type="button" disabled={query === ''} onClick={clear}>
        清空
      </button>
      <button type="submit">查找</button>
    </form>
  );
}
```
:::

:::files{role=tests}
```tsx file=SearchBox.test.tsx
import { expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBox } from './SearchBox';

test('点“清空”：清空内容，焦点回到输入框，“清空”变为不可用', async () => {
  const user = userEvent.setup();
  render(<SearchBox onSearch={() => {}} />);
  const input = screen.getByLabelText('搜索');
  await user.type(input, 'react');
  await user.click(screen.getByRole('button', { name: '清空' }));
  expect(input).toHaveValue('');
  expect(input).toHaveFocus();
  expect(screen.getByRole('button', { name: '清空' })).toBeDisabled();
});

test('用键盘操作“清空”（Tab 过去，按回车），焦点同样回到输入框', async () => {
  const user = userEvent.setup();
  render(<SearchBox onSearch={() => {}} />);
  const input = screen.getByLabelText('搜索');
  await user.type(input, 'react');
  await user.tab();
  expect(screen.getByRole('button', { name: '清空' })).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(input).toHaveValue('');
  expect(input).toHaveFocus();
});

test('在输入框中按 Esc 也会清空，焦点留在输入框', async () => {
  const user = userEvent.setup();
  render(<SearchBox onSearch={() => {}} />);
  const input = screen.getByLabelText('搜索');
  await user.type(input, 'hooks{Escape}');
  expect(input).toHaveValue('');
  expect(input).toHaveFocus();
});

test('提交时搜索去掉空白后的内容；为空时不搜索', async () => {
  const user = userEvent.setup();
  const onSearch = vi.fn();
  render(<SearchBox onSearch={onSearch} />);
  await user.type(screen.getByLabelText('搜索'), '   {Enter}');
  expect(onSearch).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText('搜索'), ' ref {Enter}');
  expect(onSearch).toHaveBeenCalledWith('ref');
});

test('页面上有两个搜索框时，焦点回到被清空的那一个', async () => {
  const user = userEvent.setup();
  render(
    <>
      <SearchBox onSearch={() => {}} />
      <SearchBox onSearch={() => {}} />
    </>,
  );
  const [, second] = screen.getAllByRole('search');
  if (second === undefined) throw new Error('应该有两个搜索框');
  const input = within(second).getByLabelText('搜索');
  await user.type(input, 'abc');
  await user.click(within(second).getByRole('button', { name: '清空' }));
  expect(input).toHaveFocus();
});
```
:::

:::hint{level=1}
`const inputRef = useRef<HTMLInputElement>(null)`，`<input ref={inputRef} …>`。写一个 `clear()` 函数，“清空”按钮和 Esc 键都调用它。
:::

:::hint{level=2}
`clear()` 中先 `setQuery('')`，再 `inputRef.current?.focus()`。这里不需要 `flushSync`：输入框一直都在页面上，不用等下一次渲染。Esc 用 `onKeyDown` 检查 `e.key === 'Escape'`。
:::

:::explanation
焦点是 React 不管理的浏览器状态，所以要通过 ref 拿到 DOM 元素，调用 `focus()`。

为什么不用 `document.querySelector('input[type=search]')`？它在整个页面中查找，有两个搜索框时找到的永远是第一个。ref 属于组件的每一个实例，最后一个测试检查的正是这一点。

另一种“取巧”的写法是给“清空”按钮加上 `onMouseDown={(e) => e.preventDefault()}`：鼠标按下时焦点就不会离开输入框。但用键盘的用户是先按 Tab 把焦点移到按钮、再按回车的，焦点早已离开输入框，按钮被禁用之后焦点照样丢失。第二个测试检查的就是键盘的操作路径。这也是 React 中尽量不用全局 DOM 查询的原因：组件可能被渲染很多次。

“清空”按钮在清空之后变成不可用。因为在它被禁用之前，焦点已经移到了输入框，焦点不会丢失。
:::

:::variant{kind=alt name=focus-first}
```tsx file=SearchBox.tsx
import { useRef, useState, type KeyboardEvent } from 'react';

export function SearchBox({ onSearch }: { onSearch: (query: string) => void }) {
  const [query, setQuery] = useState('');
  const field = useRef<HTMLInputElement | null>(null);

  const reset = () => {
    field.current?.focus();
    setQuery('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      reset();
    }
  };

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (query.trim()) onSearch(query.trim());
      }}
    >
      <label>
        搜索
        <input ref={field} type="search" value={query} onChange={(e) => setQuery(e.currentTarget.value)} onKeyDown={onKeyDown} />
      </label>
      <button type="button" disabled={!query} onClick={reset}>
        清空
      </button>
      <button type="submit">查找</button>
    </form>
  );
}
```
:::

:::variant{kind=wrong name=no-focus fails=tests reason="清空之后没有把焦点移回输入框"}
```tsx file=SearchBox.tsx
import { useRef, useState } from 'react';

export function SearchBox({ onSearch }: { onSearch: (query: string) => void }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function clear() {
    setQuery('');
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const text = query.trim();
        if (text !== '') onSearch(text);
      }}
    >
      <label>
        搜索
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') clear();
          }}
        />
      </label>
      <button type="button" disabled={query === ''} onClick={clear}>
        清空
      </button>
      <button type="submit">查找</button>
    </form>
  );
}
```
:::

:::variant{kind=wrong name=prevent-mousedown fails=tests reason="阻止了按钮的 mousedown，鼠标点击时焦点没有离开输入框；但用键盘操作“清空”时焦点仍然丢失"}
```tsx file=SearchBox.tsx
import { useState } from 'react';

export function SearchBox({ onSearch }: { onSearch: (query: string) => void }) {
  const [query, setQuery] = useState('');

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const text = query.trim();
        if (text !== '') onSearch(text);
      }}
    >
      <label>
        搜索
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuery('');
          }}
        />
      </label>
      <button type="button" disabled={query === ''} onMouseDown={(e) => e.preventDefault()} onClick={() => setQuery('')}>
        清空
      </button>
      <button type="submit">查找</button>
    </form>
  );
}
```
:::

:::variant{kind=wrong name=global-query fails=tests reason="用 document.querySelector 在整个页面中查找，有两个搜索框时找错了"}
```tsx file=SearchBox.tsx
import { useState } from 'react';

export function SearchBox({ onSearch }: { onSearch: (query: string) => void }) {
  const [query, setQuery] = useState('');

  function clear() {
    setQuery('');
    const input = document.querySelector('input[type=search]');
    if (input instanceof HTMLInputElement) input.focus();
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const text = query.trim();
        if (text !== '') onSearch(text);
      }}
    >
      <label>
        搜索
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') clear();
          }}
        />
      </label>
      <button type="button" disabled={query === ''} onClick={clear}>
        清空
      </button>
      <button type="submit">查找</button>
    </form>
  );
}
```
:::
