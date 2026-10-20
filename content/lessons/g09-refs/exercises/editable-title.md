---
kind: challenge
title: 可以就地编辑的标题
---
`EditableTitle` 显示一个标题和“编辑标题”按钮，点击后变成一个输入框。起始代码的功能是对的，但焦点没有管理：点了“编辑标题”，还要再点一次输入框才能输入；保存之后，焦点随着被移除的输入框一起丢失了。用 ref 完成焦点管理：

1. 点“编辑标题”：进入编辑状态，输入框的内容是当前标题，**焦点移到输入框，并选中全部文字**；
2. 保存（按回车或点“保存”）：内容去掉首尾空白之后
   - 为空：不保存，留在编辑状态，焦点留在输入框；
   - 和原标题相同：不调用 `onRename`，直接退出；
   - 否则调用 `onRename(新标题)` 并退出；
3. 取消（按 Esc 或点“取消”）：不保存，退出；
4. 每次退出编辑状态，**焦点都回到“编辑标题”按钮**；
5. 第一次渲染时不要移动焦点。

:::files{role=starter}
```tsx file=EditableTitle.tsx
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';

type EditableTitleProps = { title: string; onRename: (title: string) => void };

export function EditableTitle({ title, onRename }: EditableTitleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  // TODO：进入编辑时把焦点移到输入框并选中文字；保存、取消之后把焦点还给“编辑标题”按钮
  function save() {
    const text = draft.trim();
    if (text !== '' && text !== title) onRename(text);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div>
        <h2>{title}</h2>
        <button
          type="button"
          onClick={() => {
            setDraft(title);
            setEditing(true);
          }}
        >
          编辑标题
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label>
        新标题
        <input value={draft} onChange={(e) => setDraft(e.currentTarget.value)} />
      </label>
      <button type="submit">保存</button>
      <button type="button" onClick={() => setEditing(false)}>
        取消
      </button>
    </form>
  );
}
```
:::

:::files{role=support}
```tsx file=main.tsx readonly
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { EditableTitle } from './EditableTitle';

function App() {
  const [title, setTitle] = useState('第三季度计划');
  return <EditableTitle title={title} onRename={setTitle} />;
}

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<App />);
```
:::

:::files{role=solution}
```tsx file=EditableTitle.tsx
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';

type EditableTitleProps = { title: string; onRename: (title: string) => void };

export function EditableTitle({ title, onRename }: EditableTitleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);

  function startEditing() {
    flushSync(() => {
      setDraft(title);
      setEditing(true);
    });
    inputRef.current?.focus();
    inputRef.current?.select();
  }

  function finish() {
    flushSync(() => setEditing(false));
    editButtonRef.current?.focus();
  }

  function save() {
    const text = draft.trim();
    if (text === '') {
      inputRef.current?.focus();
      return;
    }
    if (text !== title) onRename(text);
    finish();
  }

  if (!editing) {
    return (
      <div>
        <h2>{title}</h2>
        <button type="button" ref={editButtonRef} onClick={startEditing}>
          编辑标题
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label>
        新标题
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') finish();
          }}
        />
      </label>
      <button type="submit">保存</button>
      <button type="button" onClick={finish}>
        取消
      </button>
    </form>
  );
}
```
:::

:::files{role=tests}
```tsx file=EditableTitle.test.tsx
import { useState } from 'react';
import { expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditableTitle } from './EditableTitle';

function Harness({ initial, onRename }: { initial: string; onRename: (title: string) => void }) {
  const [title, setTitle] = useState(initial);
  return (
    <EditableTitle
      title={title}
      onRename={(next) => {
        onRename(next);
        setTitle(next);
      }}
    />
  );
}

function setup(initial = '第三季度计划') {
  const onRename = vi.fn();
  render(<Harness initial={initial} onRename={onRename} />);
  return { onRename, user: userEvent.setup() };
}

const editButton = () => screen.getByRole('button', { name: '编辑标题' });
const input = () => screen.getByLabelText('新标题');

test('一开始只显示标题，没有元素获得焦点', () => {
  setup();
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('第三季度计划');
  expect(document.activeElement).toBe(document.body);
});

test('点“编辑标题”：焦点移到输入框，文字全部选中', async () => {
  const { user } = setup();
  await user.click(editButton());
  const field = input();
  expect(field).toHaveFocus();
  expect(field).toHaveValue('第三季度计划');
  if (!(field instanceof HTMLInputElement)) throw new Error('应该是输入框');
  expect([field.selectionStart, field.selectionEnd]).toEqual([0, '第三季度计划'.length]);
});

test('输入新标题后按回车：保存，回到显示状态，焦点回到“编辑标题”', async () => {
  const { user, onRename } = setup();
  await user.click(editButton());
  await user.keyboard('  第四季度计划 {Enter}');
  expect(onRename).toHaveBeenCalledWith('第四季度计划');
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('第四季度计划');
  expect(editButton()).toHaveFocus();
});

test('Esc 或“取消”：不保存，焦点回到“编辑标题”', async () => {
  const { user, onRename } = setup();
  await user.click(editButton());
  await user.keyboard('随便写写{Escape}');
  expect(editButton()).toHaveFocus();
  await user.click(editButton());
  await user.keyboard('又写了一些');
  await user.click(screen.getByRole('button', { name: '取消' }));
  expect(editButton()).toHaveFocus();
  expect(onRename).not.toHaveBeenCalled();
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('第三季度计划');
});

test('标题为空时不保存，留在编辑状态；没有改动时直接退出', async () => {
  const { user, onRename } = setup();
  await user.click(editButton());
  await user.clear(input());
  await user.click(screen.getByRole('button', { name: '保存' }));
  expect(input()).toHaveFocus();
  expect(onRename).not.toHaveBeenCalled();
  await user.type(input(), '第三季度计划{Enter}');
  expect(onRename).not.toHaveBeenCalled();
  expect(editButton()).toHaveFocus();
});

test('两个实例：焦点在各自的元素之间移动', async () => {
  const user = userEvent.setup();
  render(
    <>
      <section aria-label="甲">
        <EditableTitle title="甲" onRename={() => {}} />
      </section>
      <section aria-label="乙">
        <EditableTitle title="乙" onRename={() => {}} />
      </section>
    </>,
  );
  const second = screen.getByRole('region', { name: '乙' });
  await user.click(within(second).getByRole('button', { name: '编辑标题' }));
  expect(within(second).getByLabelText('新标题')).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(within(second).getByRole('button', { name: '编辑标题' })).toHaveFocus();
});
```
:::

:::hint{level=1}
需要两个 ref：输入框一个，“编辑标题”按钮一个。难点在于时机：点击“编辑标题”时，输入框还不存在；退出编辑时，按钮也还不存在。它们要等下一次渲染才出现。
:::

:::hint{level=2}
用 `flushSync(() => { setDraft(title); setEditing(true); })` 让 React 立刻完成渲染，之后 `inputRef.current?.focus()` 和 `select()` 就能找到输入框。退出时同理：`flushSync(() => setEditing(false))`，然后 `editButtonRef.current?.focus()`。把“退出”写成一个函数 `finish()`，保存和取消都调用它。
:::

:::explanation
这道题的核心是**时机**。设置 state 只是安排一次渲染；在同一个事件处理函数中，新的元素还不存在，`inputRef.current` 仍然是 `null`。`flushSync` 让 React 同步完成渲染，返回之后 ref 已经指向新的元素。

为什么不在输入框上写 `ref={(node) => { node?.focus(); node?.select(); }}`？这个箭头函数每次渲染都是一个新函数，React 每次渲染都会重新调用它：每输入一个字，文字就被重新选中一次，下一个字会替换掉已经输入的内容（一个错误解就是这样写的）。`autoFocus` 能解决“聚焦”，但做不到“选中文字”，也解决不了“焦点回到按钮”。

焦点管理是可访问性的重要部分（g02、e07）：用户的操作让一块内容消失时，要把焦点放到一个合理的位置，否则键盘和读屏用户就“掉”到了页面的开头。这里的合理位置，是用户最初点击的那个按钮。
:::

:::variant{kind=alt name=mode-union}
```tsx file=EditableTitle.tsx
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';

type EditableTitleProps = { title: string; onRename: (title: string) => void };

type Mode = { kind: 'view' } | { kind: 'edit'; draft: string };

export function EditableTitle({ title, onRename }: EditableTitleProps) {
  const [mode, setMode] = useState<Mode>({ kind: 'view' });
  const fieldRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const open = () => {
    flushSync(() => setMode({ kind: 'edit', draft: title }));
    fieldRef.current?.select();
    fieldRef.current?.focus();
  };

  const close = () => {
    flushSync(() => setMode({ kind: 'view' }));
    triggerRef.current?.focus();
  };

  if (mode.kind === 'view') {
    return (
      <div>
        <h2>{title}</h2>
        <button type="button" ref={triggerRef} onClick={open}>
          编辑标题
        </button>
      </div>
    );
  }

  const commit = () => {
    const next = mode.draft.trim();
    if (!next) {
      fieldRef.current?.focus();
      return;
    }
    if (next !== title) onRename(next);
    close();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') close();
      }}
    >
      <label>
        新标题
        <input ref={fieldRef} value={mode.draft} onChange={(e) => setMode({ kind: 'edit', draft: e.currentTarget.value })} />
      </label>
      <button type="submit">保存</button>
      <button type="button" onClick={close}>
        取消
      </button>
    </form>
  );
}
```
:::

:::variant{kind=wrong name=no-flush-sync fails=tests reason="没有用 flushSync，聚焦时输入框还没有渲染出来"}
```tsx file=EditableTitle.tsx
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';

type EditableTitleProps = { title: string; onRename: (title: string) => void };

export function EditableTitle({ title, onRename }: EditableTitleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);

  function startEditing() {
    setDraft(title);
    setEditing(true);
    inputRef.current?.focus();
    inputRef.current?.select();
  }

  function finish() {
    flushSync(() => setEditing(false));
    editButtonRef.current?.focus();
  }

  function save() {
    const text = draft.trim();
    if (text === '') {
      inputRef.current?.focus();
      return;
    }
    if (text !== title) onRename(text);
    finish();
  }

  if (!editing) {
    return (
      <div>
        <h2>{title}</h2>
        <button type="button" ref={editButtonRef} onClick={startEditing}>
          编辑标题
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label>
        新标题
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') finish();
          }}
        />
      </label>
      <button type="submit">保存</button>
      <button type="button" onClick={finish}>
        取消
      </button>
    </form>
  );
}
```
:::

:::variant{kind=wrong name=inline-ref-callback fails=tests reason="在每次渲染都会重新调用的 ref 回调中选中文字，输入时已输入的文字被替换"}
```tsx file=EditableTitle.tsx
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';

type EditableTitleProps = { title: string; onRename: (title: string) => void };

export function EditableTitle({ title, onRename }: EditableTitleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);

  function startEditing() {
    setDraft(title);
    setEditing(true);
  }

  function finish() {
    flushSync(() => setEditing(false));
    editButtonRef.current?.focus();
  }

  function save() {
    const text = draft.trim();
    if (text === '') {
      inputRef.current?.focus();
      return;
    }
    if (text !== title) onRename(text);
    finish();
  }

  if (!editing) {
    return (
      <div>
        <h2>{title}</h2>
        <button type="button" ref={editButtonRef} onClick={startEditing}>
          编辑标题
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label>
        新标题
        <input
          ref={(node) => {
            node?.focus();
            node?.select();
          }}
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') finish();
          }}
        />
      </label>
      <button type="submit">保存</button>
      <button type="button" onClick={finish}>
        取消
      </button>
    </form>
  );
}
```
:::

:::variant{kind=wrong name=no-return-focus fails=tests reason="退出编辑之后没有把焦点还给“编辑标题”按钮"}
```tsx file=EditableTitle.tsx
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';

type EditableTitleProps = { title: string; onRename: (title: string) => void };

export function EditableTitle({ title, onRename }: EditableTitleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);

  function startEditing() {
    flushSync(() => {
      setDraft(title);
      setEditing(true);
    });
    inputRef.current?.focus();
    inputRef.current?.select();
  }

  function finish() {
    setEditing(false);
  }

  function save() {
    const text = draft.trim();
    if (text === '') {
      inputRef.current?.focus();
      return;
    }
    if (text !== title) onRename(text);
    finish();
  }

  if (!editing) {
    return (
      <div>
        <h2>{title}</h2>
        <button type="button" ref={editButtonRef} onClick={startEditing}>
          编辑标题
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label>
        新标题
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') finish();
          }}
        />
      </label>
      <button type="submit">保存</button>
      <button type="button" onClick={finish}>
        取消
      </button>
    </form>
  );
}
```
:::

:::variant{kind=wrong name=rename-unchanged fails=tests reason="标题没有改动时也调用了 onRename"}
```tsx file=EditableTitle.tsx
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';

type EditableTitleProps = { title: string; onRename: (title: string) => void };

export function EditableTitle({ title, onRename }: EditableTitleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);

  function startEditing() {
    flushSync(() => {
      setDraft(title);
      setEditing(true);
    });
    inputRef.current?.focus();
    inputRef.current?.select();
  }

  function finish() {
    flushSync(() => setEditing(false));
    editButtonRef.current?.focus();
  }

  function save() {
    const text = draft.trim();
    if (text === '') {
      inputRef.current?.focus();
      return;
    }
    if (text === title) onRename(text);
    if (text !== title) onRename(text);
    finish();
  }

  if (!editing) {
    return (
      <div>
        <h2>{title}</h2>
        <button type="button" ref={editButtonRef} onClick={startEditing}>
          编辑标题
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label>
        新标题
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') finish();
          }}
        />
      </label>
      <button type="submit">保存</button>
      <button type="button" onClick={finish}>
        取消
      </button>
    </form>
  );
}
```
:::
