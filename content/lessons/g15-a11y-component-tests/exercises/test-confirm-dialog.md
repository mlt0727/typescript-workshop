---
kind: challenge
title: 为确认对话框写可访问性测试
grading: tests
---
`ConfirmButton.tsx`（只读）是一个“点击后弹出确认对话框”的按钮，按 APG 的 Alert Dialog 模式实现：

1. 点击按钮（文字是 `label`）打开 `role="alertdialog"` 的对话框，它的名字是标题 `title`（`aria-labelledby`），说明是 `message`；
2. 打开时焦点移到“取消”按钮上（最不危险的操作）；
3. 点击“取消”或按 Esc：关闭，不调用 `onConfirm`；点击确认按钮（文字是 `confirmLabel`）：调用一次 `onConfirm`，然后关闭；
4. 关闭之后，焦点回到打开对话框的那个按钮上。

在 `ConfirmButton.test.tsx` 中写测试。平台准备了七个错误的版本，有的错在功能上，有的只是焦点或名字不对（用鼠标完全看不出来），你的测试要发现每一个。

:::files{role=support}
```tsx file=ConfirmButton.tsx readonly
import { useEffect, useId, useRef, useState } from 'react';

type ConfirmButtonProps = {
  label: string;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};

export function ConfirmButton({ label, title, message, confirmLabel, onConfirm }: ConfirmButtonProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();

  // 打开时焦点移到最不危险的按钮“取消”上
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    // 关闭后焦点回到打开对话框的按钮
    triggerRef.current?.focus();
  };

  return (
    <>
      <button ref={triggerRef} type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={messageId}
          onKeyDown={(event) => {
            if (event.key === 'Escape') close();
          }}
        >
          <h2 id={titleId}>{title}</h2>
          <p id={messageId}>{message}</p>
          <button ref={cancelRef} type="button" onClick={close}>
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              close();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      )}
    </>
  );
}
```
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { ConfirmButton } from './ConfirmButton';

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(
  <ConfirmButton label="删除项目" title="删除这个项目？" message="删除后无法恢复。" confirmLabel="删除" onConfirm={() => console.log('已删除')} />,
);
```
:::

:::files{role=starter}
```tsx file=ConfirmButton.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { ConfirmButton } from './ConfirmButton';

test('点击后打开对话框', async () => {
  const user = userEvent.setup();
  render(<ConfirmButton label="删除项目" title="删除这个项目？" message="删除后无法恢复。" confirmLabel="删除" onConfirm={() => {}} />);
  await user.click(screen.getByRole('button', { name: '删除项目' }));
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
});
```
:::

:::files{role=solution}
```tsx file=ConfirmButton.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { ConfirmButton } from './ConfirmButton';

function setup() {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  render(<ConfirmButton label="删除项目" title="删除这个项目？" message="删除后无法恢复。" confirmLabel="删除" onConfirm={onConfirm} />);
  const trigger = screen.getByRole('button', { name: '删除项目' });
  return { user, onConfirm, trigger };
}

describe('ConfirmButton', () => {
  test('打开：对话框有名字，焦点在“取消”上', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    expect(screen.getByRole('alertdialog', { name: '删除这个项目？' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消' })).toHaveFocus();
  });

  test('取消：不执行操作，关闭，焦点回到触发按钮', async () => {
    const { user, onConfirm, trigger } = setup();
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  test('确认：执行一次操作，关闭，焦点回到触发按钮', async () => {
    const { user, onConfirm, trigger } = setup();
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: '删除' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  test('Esc 关闭，不执行操作', async () => {
    const { user, onConfirm, trigger } = setup();
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });
});
```
:::

:::mutant{name=no-initial-focus hint="打开时焦点没有移进对话框：键盘用户按 Tab 会回到对话框背后的页面。需要检查打开之后的焦点"}
```tsx file=ConfirmButton.tsx
import { useEffect, useId, useRef, useState } from 'react';

type ConfirmButtonProps = {
  label: string;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};

export function ConfirmButton({ label, title, message, confirmLabel, onConfirm }: ConfirmButtonProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();

  // 打开时焦点移到最不危险的按钮“取消”上
  useEffect(() => {
    if (open) void cancelRef.current;
  }, [open]);

  const close = () => {
    setOpen(false);
    // 关闭后焦点回到打开对话框的按钮
    triggerRef.current?.focus();
  };

  return (
    <>
      <button ref={triggerRef} type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={messageId}
          onKeyDown={(event) => {
            if (event.key === 'Escape') close();
          }}
        >
          <h2 id={titleId}>{title}</h2>
          <p id={messageId}>{message}</p>
          <button ref={cancelRef} type="button" onClick={close}>
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              close();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      )}
    </>
  );
}
```
:::

:::mutant{name=focus-on-confirm hint="打开时焦点放在了“删除”上：误按一次 Enter 就删掉了。焦点应该在最不危险的“取消”上"}
```tsx file=ConfirmButton.tsx
import { useEffect, useId, useRef, useState } from 'react';

type ConfirmButtonProps = {
  label: string;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};

export function ConfirmButton({ label, title, message, confirmLabel, onConfirm }: ConfirmButtonProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();

  // 打开时焦点移到最不危险的按钮“取消”上
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    // 关闭后焦点回到打开对话框的按钮
    triggerRef.current?.focus();
  };

  return (
    <>
      <button ref={triggerRef} type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={messageId}
          onKeyDown={(event) => {
            if (event.key === 'Escape') close();
          }}
        >
          <h2 id={titleId}>{title}</h2>
          <p id={messageId}>{message}</p>
          <button type="button" onClick={close}>
            取消
          </button>
          <button
            ref={cancelRef}
            type="button"
            onClick={() => {
              onConfirm();
              close();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      )}
    </>
  );
}
```
:::

:::mutant{name=no-return-focus hint="关闭之后焦点没有回到“删除项目”按钮：需要检查关闭之后的焦点"}
```tsx file=ConfirmButton.tsx
import { useEffect, useId, useRef, useState } from 'react';

type ConfirmButtonProps = {
  label: string;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};

export function ConfirmButton({ label, title, message, confirmLabel, onConfirm }: ConfirmButtonProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();

  // 打开时焦点移到最不危险的按钮“取消”上
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
  };

  return (
    <>
      <button ref={triggerRef} type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={messageId}
          onKeyDown={(event) => {
            if (event.key === 'Escape') close();
          }}
        >
          <h2 id={titleId}>{title}</h2>
          <p id={messageId}>{message}</p>
          <button ref={cancelRef} type="button" onClick={close}>
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              close();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      )}
    </>
  );
}
```
:::

:::mutant{name=unlabelled hint="对话框没有名字（缺少 aria-labelledby）：读屏软件只读出“对话框”。需要按名字查找对话框"}
```tsx file=ConfirmButton.tsx
import { useEffect, useId, useRef, useState } from 'react';

type ConfirmButtonProps = {
  label: string;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};

export function ConfirmButton({ label, title, message, confirmLabel, onConfirm }: ConfirmButtonProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();

  // 打开时焦点移到最不危险的按钮“取消”上
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    // 关闭后焦点回到打开对话框的按钮
    triggerRef.current?.focus();
  };

  return (
    <>
      <button ref={triggerRef} type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-describedby={messageId}
          onKeyDown={(event) => {
            if (event.key === 'Escape') close();
          }}
        >
          <h2 id={titleId}>{title}</h2>
          <p id={messageId}>{message}</p>
          <button ref={cancelRef} type="button" onClick={close}>
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              close();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      )}
    </>
  );
}
```
:::

:::mutant{name=no-escape hint="按 Esc 不能关闭对话框"}
```tsx file=ConfirmButton.tsx
import { useEffect, useId, useRef, useState } from 'react';

type ConfirmButtonProps = {
  label: string;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};

export function ConfirmButton({ label, title, message, confirmLabel, onConfirm }: ConfirmButtonProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();

  // 打开时焦点移到最不危险的按钮“取消”上
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    // 关闭后焦点回到打开对话框的按钮
    triggerRef.current?.focus();
  };

  return (
    <>
      <button ref={triggerRef} type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={messageId}
        >
          <h2 id={titleId}>{title}</h2>
          <p id={messageId}>{message}</p>
          <button ref={cancelRef} type="button" onClick={close}>
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              close();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      )}
    </>
  );
}
```
:::

:::mutant{name=stays-open hint="确认之后对话框没有关闭"}
```tsx file=ConfirmButton.tsx
import { useEffect, useId, useRef, useState } from 'react';

type ConfirmButtonProps = {
  label: string;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};

export function ConfirmButton({ label, title, message, confirmLabel, onConfirm }: ConfirmButtonProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();

  // 打开时焦点移到最不危险的按钮“取消”上
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    // 关闭后焦点回到打开对话框的按钮
    triggerRef.current?.focus();
  };

  return (
    <>
      <button ref={triggerRef} type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={messageId}
          onKeyDown={(event) => {
            if (event.key === 'Escape') close();
          }}
        >
          <h2 id={titleId}>{title}</h2>
          <p id={messageId}>{message}</p>
          <button ref={cancelRef} type="button" onClick={close}>
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      )}
    </>
  );
}
```
:::

:::mutant{name=cancel-confirms hint="点击“取消”也调用了 onConfirm：需要检查取消时没有执行操作"}
```tsx file=ConfirmButton.tsx
import { useEffect, useId, useRef, useState } from 'react';

type ConfirmButtonProps = {
  label: string;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};

export function ConfirmButton({ label, title, message, confirmLabel, onConfirm }: ConfirmButtonProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();

  // 打开时焦点移到最不危险的按钮“取消”上
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    // 关闭后焦点回到打开对话框的按钮
    triggerRef.current?.focus();
  };

  return (
    <>
      <button ref={triggerRef} type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={messageId}
          onKeyDown={(event) => {
            if (event.key === 'Escape') close();
          }}
        >
          <h2 id={titleId}>{title}</h2>
          <p id={messageId}>{message}</p>
          <button
            ref={cancelRef}
            type="button"
            onClick={() => {
              onConfirm();
              close();
            }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              close();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      )}
    </>
  );
}
```
:::

:::hint{level=1}
对照规格的四条，每条至少一个测试：按**名字**查找对话框（`getByRole('alertdialog', { name: '删除这个项目？' })`）；打开之后 `取消` 按钮 `toHaveFocus()`；取消、Esc、确认三种关闭方式；每种关闭之后检查 `onConfirm` 调用了几次、对话框是否还在（`queryByRole` 加 `toBeNull()`）、焦点是否回到了触发按钮。
:::

:::hint{level=2}
写一个 `setup()` 函数，渲染组件并返回 `user`、`onConfirm`（`vi.fn()`）和触发按钮，每个测试调用一次。Esc 用 `await user.keyboard('{Escape}')`：打开之后焦点在对话框中的“取消”上，按键事件会冒泡到对话框的 `onKeyDown`。
:::

:::explanation
七个错误的版本中，有四个用鼠标完全看不出来：

| 错误 | 只有这样的测试能发现 |
| --- | --- |
| 打开时焦点没有移进来 | 打开之后检查焦点 |
| 焦点放在了“删除”上 | 打开之后检查焦点在“取消”上 |
| 关闭后焦点没有回去 | 关闭之后检查触发按钮的焦点 |
| 按 Esc 不能关闭 | 用键盘操作 |

“对话框没有名字”则会让 `getByRole('alertdialog', { name: … })` 找不到它：按名字查找本身就是一个可访问性的检查。

这些测试把 APG 中模态对话框的要求变成了可以反复运行的检查。以后有人重构这个组件（例如改用原生的 `<dialog>`），只要测试还通过，键盘用户和读屏软件用户的体验就没有被破坏。

注意测试中的 Esc：组件在 `onKeyDown` 中自己处理了它。如果组件依赖原生 `<dialog>` 的 Esc 关闭，user-event 模拟的按键不会触发浏览器的这个默认行为，测试需要换一种方式（例如触发 `cancel` 事件），在真实的浏览器中则可以用 Playwright 按下真正的键盘按键（f09）。
:::

:::variant{kind=alt name=keyboard-flow}
```tsx file=ConfirmButton.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { ConfirmButton } from './ConfirmButton';

test('完整的键盘流程', async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  render(
    <>
      <ConfirmButton label="清空回收站" title="清空回收站？" message="其中的文件将被永久删除。" confirmLabel="清空" onConfirm={onConfirm} />
    </>,
  );
  const trigger = screen.getByRole('button', { name: '清空回收站' });
  trigger.focus();
  await user.keyboard('{Enter}');
  const dialog = screen.getByRole('alertdialog', { name: '清空回收站？' });
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '取消' }));

  await user.keyboard('{Escape}');
  expect(dialog).not.toBeInTheDocument();
  expect(document.activeElement).toBe(trigger);

  await user.keyboard('{Enter}');
  await user.keyboard('{Enter}');
  expect(onConfirm).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(trigger);

  await user.keyboard('{Enter}');
  await user.click(screen.getByRole('button', { name: '清空' }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
```
:::

:::variant{kind=wrong name=mouse-only fails=mutants misses=focus-on-confirm,no-escape,no-initial-focus,no-return-focus reason="只用鼠标测试了“确认”和“取消”：焦点和 Esc 都没有检查"}
```tsx file=ConfirmButton.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { ConfirmButton } from './ConfirmButton';

test('确认与取消', async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  render(<ConfirmButton label="删除项目" title="删除这个项目？" message="删除后无法恢复。" confirmLabel="删除" onConfirm={onConfirm} />);
  await user.click(screen.getByRole('button', { name: '删除项目' }));
  expect(screen.getByRole('alertdialog', { name: '删除这个项目？' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '取消' }));
  expect(onConfirm).not.toHaveBeenCalled();
  expect(screen.queryByRole('alertdialog')).toBeNull();

  await user.click(screen.getByRole('button', { name: '删除项目' }));
  await user.click(screen.getByRole('button', { name: '删除' }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('alertdialog')).toBeNull();
});
```
:::

:::variant{kind=wrong name=expects-confirm-focus fails=tests reason="期望打开时焦点在“删除”上：对于难以撤销的操作，焦点应该在最不危险的按钮上"}
```tsx file=ConfirmButton.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { ConfirmButton } from './ConfirmButton';

test('打开后焦点在确认按钮上', async () => {
  const user = userEvent.setup();
  render(<ConfirmButton label="删除项目" title="删除这个项目？" message="删除后无法恢复。" confirmLabel="删除" onConfirm={() => {}} />);
  await user.click(screen.getByRole('button', { name: '删除项目' }));
  expect(screen.getByRole('button', { name: '删除' })).toHaveFocus();
});
```
:::
