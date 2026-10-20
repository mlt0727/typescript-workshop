---
kind: challenge
title: 为 React 标签输入组件写测试
mode: react
grading: tests
---
`TagInput.tsx`（只读）是一个标签输入组件。规格：

1. 输入框的标签是“标签”。按 Enter 时，把输入的文字去掉首尾空白后作为一个新标签（空白不添加），然后清空输入框；
2. 已经有同一个标签（**不区分大小写**）时不添加，输入框保留文字，`role="status"` 中显示 `已经有“输入的文字”了`；
3. 已添加的标签在名为“已添加的标签”的列表中，每个标签后面有一个删除按钮，可访问的名字是 `删除 标签名`，点击删除这一个标签；
4. 输入框为空时按 Backspace，删除最后一个标签；输入框中有文字时，Backspace 只删除文字；
5. 标签数达到 `max`（默认 5）时禁用输入框，状态区域显示 `最多 N 个标签`；
6. 每次标签变化，调用 `onChange(新的标签数组)`。

在 `TagInput.test.tsx` 中写测试（React 模式：`render(<TagInput … />)`，每个测试之后会自动清理）。平台准备了七个错误的版本，你的测试要发现每一个。

:::files{role=support}
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { TagInput } from './TagInput';

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<TagInput initialTags={['TypeScript']} onChange={(tags) => console.log(tags)} />);
```
```tsx file=TagInput.tsx readonly
import { useId, useState, type KeyboardEvent } from 'react';

type TagInputProps = {
  initialTags?: readonly string[];
  max?: number;
  onChange?: (tags: string[]) => void;
};

export function TagInput({ initialTags = [], max = 5, onChange }: TagInputProps) {
  const [tags, setTags] = useState<string[]>([...initialTags]);
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('');
  const inputId = useId();
  const full = tags.length >= max;

  const update = (next: string[]) => {
    setTags(next);
    onChange?.(next);
  };

  const add = () => {
    const tag = draft.trim();
    if (tag === '') return;
    if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setMessage(`已经有“${tag}”了`);
      return;
    }
    update([...tags, tag]);
    setDraft('');
    setMessage('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      add();
    } else if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
      update(tags.slice(0, -1));
    }
  };

  return (
    <div>
      <label htmlFor={inputId}>标签</label>
      <ul aria-label="已添加的标签">
        {tags.map((tag) => (
          <li key={tag}>
            <span>{tag}</span>
            <button type="button" aria-label={`删除 ${tag}`} onClick={() => update(tags.filter((t) => t !== tag))}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <input
        id={inputId}
        value={draft}
        disabled={full}
        onChange={(event) => {
          setDraft(event.target.value);
          setMessage('');
        }}
        onKeyDown={onKeyDown}
      />
      <p role="status">{full ? `最多 ${max} 个标签` : message}</p>
    </div>
  );
}
```
:::

:::files{role=starter}
```tsx file=TagInput.test.tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { TagInput } from './TagInput';

test('按 Enter 添加标签', async () => {
  const user = userEvent.setup();
  render(<TagInput />);
  await user.type(screen.getByRole('textbox', { name: '标签' }), 'Vite{Enter}');
  const list = screen.getByRole('list', { name: '已添加的标签' });
  expect(within(list).getAllByRole('listitem')).toHaveLength(1);
});
```
:::

:::files{role=solution}
```tsx file=TagInput.test.tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { TagInput } from './TagInput';

const input = () => screen.getByRole('textbox', { name: '标签' });
const tagTexts = () =>
  within(screen.getByRole('list', { name: '已添加的标签' }))
    .queryAllByRole('listitem')
    .map((item) => item.querySelector('span')?.textContent);

describe('TagInput', () => {
  test('按 Enter 添加去掉空白的标签，清空输入框，通知 onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagInput onChange={onChange} />);
    await user.type(input(), '  Vite {Enter}');
    expect(tagTexts()).toEqual(['Vite']);
    expect(input()).toHaveValue('');
    expect(onChange).toHaveBeenLastCalledWith(['Vite']);
  });

  test('重复的标签（不区分大小写）不添加，并给出提示', async () => {
    const user = userEvent.setup();
    render(<TagInput initialTags={['TypeScript']} />);
    await user.type(input(), 'typescript{Enter}');
    expect(tagTexts()).toEqual(['TypeScript']);
    expect(screen.getByRole('status')).toHaveTextContent('已经有“typescript”了');
    await user.clear(input());
    await user.type(input(), ' TypeScript {Enter}');
    expect(tagTexts()).toEqual(['TypeScript']);
  });

  test('删除按钮删除对应的标签', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagInput initialTags={['React', 'Vite', 'Vitest']} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: '删除 Vite' }));
    expect(tagTexts()).toEqual(['React', 'Vitest']);
    expect(onChange).toHaveBeenLastCalledWith(['React', 'Vitest']);
  });

  test('输入框为空时 Backspace 删除最后一个标签；有文字时只删除文字', async () => {
    const user = userEvent.setup();
    render(<TagInput initialTags={['React', 'Vite']} />);
    await user.type(input(), 'ab{Backspace}');
    expect(input()).toHaveValue('a');
    expect(tagTexts()).toEqual(['React', 'Vite']);
    await user.keyboard('{Backspace}{Backspace}');
    expect(input()).toHaveValue('');
    expect(tagTexts()).toEqual(['React']);
  });

  test('达到上限时禁用输入框并提示', () => {
    render(<TagInput initialTags={['a', 'b']} max={2} />);
    expect(input()).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('最多 2 个标签');
  });
});
```
:::

:::mutant{name=case-sensitive hint="判断重复时区分了大小写：已经有 TypeScript 时还能添加 typescript"}
```tsx file=TagInput.tsx
import { useId, useState, type KeyboardEvent } from 'react';

type TagInputProps = {
  initialTags?: readonly string[];
  max?: number;
  onChange?: (tags: string[]) => void;
};

export function TagInput({ initialTags = [], max = 5, onChange }: TagInputProps) {
  const [tags, setTags] = useState<string[]>([...initialTags]);
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('');
  const inputId = useId();
  const full = tags.length >= max;

  const update = (next: string[]) => {
    setTags(next);
    onChange?.(next);
  };

  const add = () => {
    const tag = draft.trim();
    if (tag === '') return;
    if (tags.includes(tag)) {
      setMessage(`已经有“${tag}”了`);
      return;
    }
    update([...tags, tag]);
    setDraft('');
    setMessage('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      add();
    } else if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
      update(tags.slice(0, -1));
    }
  };

  return (
    <div>
      <label htmlFor={inputId}>标签</label>
      <ul aria-label="已添加的标签">
        {tags.map((tag) => (
          <li key={tag}>
            <span>{tag}</span>
            <button type="button" aria-label={`删除 ${tag}`} onClick={() => update(tags.filter((t) => t !== tag))}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <input
        id={inputId}
        value={draft}
        disabled={full}
        onChange={(event) => {
          setDraft(event.target.value);
          setMessage('');
        }}
        onKeyDown={onKeyDown}
      />
      <p role="status">{full ? `最多 ${max} 个标签` : message}</p>
    </div>
  );
}
```
:::

:::mutant{name=no-trim hint="没有去掉首尾空白：onChange 收到的是带空格的标签，带空格的重复标签也能加进去"}
```tsx file=TagInput.tsx
import { useId, useState, type KeyboardEvent } from 'react';

type TagInputProps = {
  initialTags?: readonly string[];
  max?: number;
  onChange?: (tags: string[]) => void;
};

export function TagInput({ initialTags = [], max = 5, onChange }: TagInputProps) {
  const [tags, setTags] = useState<string[]>([...initialTags]);
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('');
  const inputId = useId();
  const full = tags.length >= max;

  const update = (next: string[]) => {
    setTags(next);
    onChange?.(next);
  };

  const add = () => {
    const tag = draft;
    if (tag.trim() === '') return;
    if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setMessage(`已经有“${tag}”了`);
      return;
    }
    update([...tags, tag]);
    setDraft('');
    setMessage('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      add();
    } else if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
      update(tags.slice(0, -1));
    }
  };

  return (
    <div>
      <label htmlFor={inputId}>标签</label>
      <ul aria-label="已添加的标签">
        {tags.map((tag) => (
          <li key={tag}>
            <span>{tag}</span>
            <button type="button" aria-label={`删除 ${tag}`} onClick={() => update(tags.filter((t) => t !== tag))}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <input
        id={inputId}
        value={draft}
        disabled={full}
        onChange={(event) => {
          setDraft(event.target.value);
          setMessage('');
        }}
        onKeyDown={onKeyDown}
      />
      <p role="status">{full ? `最多 ${max} 个标签` : message}</p>
    </div>
  );
}
```
:::

:::mutant{name=backspace-always hint="输入框中有文字时按 Backspace 也删掉了最后一个标签：只有输入框为空时才应该这样"}
```tsx file=TagInput.tsx
import { useId, useState, type KeyboardEvent } from 'react';

type TagInputProps = {
  initialTags?: readonly string[];
  max?: number;
  onChange?: (tags: string[]) => void;
};

export function TagInput({ initialTags = [], max = 5, onChange }: TagInputProps) {
  const [tags, setTags] = useState<string[]>([...initialTags]);
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('');
  const inputId = useId();
  const full = tags.length >= max;

  const update = (next: string[]) => {
    setTags(next);
    onChange?.(next);
  };

  const add = () => {
    const tag = draft.trim();
    if (tag === '') return;
    if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setMessage(`已经有“${tag}”了`);
      return;
    }
    update([...tags, tag]);
    setDraft('');
    setMessage('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      add();
    } else if (event.key === 'Backspace' && tags.length > 0) {
      update(tags.slice(0, -1));
    }
  };

  return (
    <div>
      <label htmlFor={inputId}>标签</label>
      <ul aria-label="已添加的标签">
        {tags.map((tag) => (
          <li key={tag}>
            <span>{tag}</span>
            <button type="button" aria-label={`删除 ${tag}`} onClick={() => update(tags.filter((t) => t !== tag))}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <input
        id={inputId}
        value={draft}
        disabled={full}
        onChange={(event) => {
          setDraft(event.target.value);
          setMessage('');
        }}
        onKeyDown={onKeyDown}
      />
      <p role="status">{full ? `最多 ${max} 个标签` : message}</p>
    </div>
  );
}
```
:::

:::mutant{name=removes-last hint="点击某个标签的删除按钮，删掉的总是最后一个：需要删除一个不在最后的标签"}
```tsx file=TagInput.tsx
import { useId, useState, type KeyboardEvent } from 'react';

type TagInputProps = {
  initialTags?: readonly string[];
  max?: number;
  onChange?: (tags: string[]) => void;
};

export function TagInput({ initialTags = [], max = 5, onChange }: TagInputProps) {
  const [tags, setTags] = useState<string[]>([...initialTags]);
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('');
  const inputId = useId();
  const full = tags.length >= max;

  const update = (next: string[]) => {
    setTags(next);
    onChange?.(next);
  };

  const add = () => {
    const tag = draft.trim();
    if (tag === '') return;
    if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setMessage(`已经有“${tag}”了`);
      return;
    }
    update([...tags, tag]);
    setDraft('');
    setMessage('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      add();
    } else if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
      update(tags.slice(0, -1));
    }
  };

  return (
    <div>
      <label htmlFor={inputId}>标签</label>
      <ul aria-label="已添加的标签">
        {tags.map((tag) => (
          <li key={tag}>
            <span>{tag}</span>
            <button type="button" aria-label={`删除 ${tag}`} onClick={() => update(tags.slice(0, -1))}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <input
        id={inputId}
        value={draft}
        disabled={full}
        onChange={(event) => {
          setDraft(event.target.value);
          setMessage('');
        }}
        onKeyDown={onKeyDown}
      />
      <p role="status">{full ? `最多 ${max} 个标签` : message}</p>
    </div>
  );
}
```
:::

:::mutant{name=unnamed-remove hint="删除按钮没有可访问的名字：读屏软件只读出“×”，不知道删除的是哪一个"}
```tsx file=TagInput.tsx
import { useId, useState, type KeyboardEvent } from 'react';

type TagInputProps = {
  initialTags?: readonly string[];
  max?: number;
  onChange?: (tags: string[]) => void;
};

export function TagInput({ initialTags = [], max = 5, onChange }: TagInputProps) {
  const [tags, setTags] = useState<string[]>([...initialTags]);
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('');
  const inputId = useId();
  const full = tags.length >= max;

  const update = (next: string[]) => {
    setTags(next);
    onChange?.(next);
  };

  const add = () => {
    const tag = draft.trim();
    if (tag === '') return;
    if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setMessage(`已经有“${tag}”了`);
      return;
    }
    update([...tags, tag]);
    setDraft('');
    setMessage('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      add();
    } else if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
      update(tags.slice(0, -1));
    }
  };

  return (
    <div>
      <label htmlFor={inputId}>标签</label>
      <ul aria-label="已添加的标签">
        {tags.map((tag) => (
          <li key={tag}>
            <span>{tag}</span>
            <button type="button" onClick={() => update(tags.filter((t) => t !== tag))}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <input
        id={inputId}
        value={draft}
        disabled={full}
        onChange={(event) => {
          setDraft(event.target.value);
          setMessage('');
        }}
        onKeyDown={onKeyDown}
      />
      <p role="status">{full ? `最多 ${max} 个标签` : message}</p>
    </div>
  );
}
```
:::

:::mutant{name=no-max hint="达到上限之后仍然可以输入：需要用 max 个初始标签检查输入框被禁用"}
```tsx file=TagInput.tsx
import { useId, useState, type KeyboardEvent } from 'react';

type TagInputProps = {
  initialTags?: readonly string[];
  max?: number;
  onChange?: (tags: string[]) => void;
};

export function TagInput({ initialTags = [], max = 5, onChange }: TagInputProps) {
  const [tags, setTags] = useState<string[]>([...initialTags]);
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('');
  const inputId = useId();
  const full = false;

  const update = (next: string[]) => {
    setTags(next);
    onChange?.(next);
  };

  const add = () => {
    const tag = draft.trim();
    if (tag === '') return;
    if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setMessage(`已经有“${tag}”了`);
      return;
    }
    update([...tags, tag]);
    setDraft('');
    setMessage('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      add();
    } else if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
      update(tags.slice(0, -1));
    }
  };

  return (
    <div>
      <label htmlFor={inputId}>标签</label>
      <ul aria-label="已添加的标签">
        {tags.map((tag) => (
          <li key={tag}>
            <span>{tag}</span>
            <button type="button" aria-label={`删除 ${tag}`} onClick={() => update(tags.filter((t) => t !== tag))}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <input
        id={inputId}
        value={draft}
        disabled={full}
        onChange={(event) => {
          setDraft(event.target.value);
          setMessage('');
        }}
        onKeyDown={onKeyDown}
      />
      <p role="status">{full ? `最多 ${max} 个标签` : message}</p>
    </div>
  );
}
```
:::

:::mutant{name=keeps-draft hint="添加之后输入框没有清空"}
```tsx file=TagInput.tsx
import { useId, useState, type KeyboardEvent } from 'react';

type TagInputProps = {
  initialTags?: readonly string[];
  max?: number;
  onChange?: (tags: string[]) => void;
};

export function TagInput({ initialTags = [], max = 5, onChange }: TagInputProps) {
  const [tags, setTags] = useState<string[]>([...initialTags]);
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('');
  const inputId = useId();
  const full = tags.length >= max;

  const update = (next: string[]) => {
    setTags(next);
    onChange?.(next);
  };

  const add = () => {
    const tag = draft.trim();
    if (tag === '') return;
    if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setMessage(`已经有“${tag}”了`);
      return;
    }
    update([...tags, tag]);
    setMessage('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      add();
    } else if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
      update(tags.slice(0, -1));
    }
  };

  return (
    <div>
      <label htmlFor={inputId}>标签</label>
      <ul aria-label="已添加的标签">
        {tags.map((tag) => (
          <li key={tag}>
            <span>{tag}</span>
            <button type="button" aria-label={`删除 ${tag}`} onClick={() => update(tags.filter((t) => t !== tag))}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <input
        id={inputId}
        value={draft}
        disabled={full}
        onChange={(event) => {
          setDraft(event.target.value);
          setMessage('');
        }}
        onKeyDown={onKeyDown}
      />
      <p role="status">{full ? `最多 ${max} 个标签` : message}</p>
    </div>
  );
}
```
:::

:::hint{level=1}
规格的每一条至少一个测试。用 `user.type(输入框, 'Vite{Enter}')` 输入并按 Enter，`{Backspace}` 是退格键；`vi.fn()` 作为 `onChange`，用 `toHaveBeenLastCalledWith([…])` 检查它收到的数组，这样也能发现“没有去掉空白”。
:::

:::hint{level=2}
“删除对应的标签”要用三个初始标签，删除中间的那个，否则“总是删除最后一个”的错误版本也能通过。Backspace 要测试两种情况：先输入 `ab{Backspace}`，检查输入框是 `a`、标签没变；再按两次 Backspace，第二次才删除最后一个标签。检查上限时直接传入 `max` 个初始标签。
:::

:::explanation
这道题中，有几个错误的版本在“典型的用法”中完全正常，只有特定的输入才能发现：

| 错误 | 需要的输入 |
| --- | --- |
| 区分大小写 | 已有 `TypeScript`，再输入 `typescript` |
| 不去空白 | 输入 `'  Vite '`，检查 `onChange` 收到的值 |
| 有文字时 Backspace 也删标签 | 输入框中有文字时按 Backspace |
| 总是删除最后一个 | 删除一个不在最后的标签 |
| 添加后没清空 | 添加之后检查输入框的值 |

`onChange` 的模拟函数在这里很有用：页面上显示的标签文字经过了 HTML 的空白处理，看不出 `'  Vite '` 和 `'Vite'` 的区别；`onChange` 收到的数组则是组件交给外部的真实数据。

“删除按钮没有名字”的版本，视觉上完全一样（按钮上都是 ×），只是读屏软件读不出删除的是哪一个。`getByRole('button', { name: '删除 Vite' })` 同时测试了功能和可访问性。

测试中没有读取组件的 state，也没有调用组件内部的函数：如果把实现改成 `useReducer`，或者把列表拆成子组件，这些测试都不需要修改。
:::

:::variant{kind=alt name=setup-helper}
```tsx file=TagInput.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { TagInput } from './TagInput';

function setup(props: Parameters<typeof TagInput>[0] = {}) {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(<TagInput {...props} onChange={onChange} />);
  return { user, onChange, field: screen.getByLabelText('标签') };
}

test('添加：去掉空白、清空输入框', async () => {
  const { user, onChange, field } = setup();
  await user.type(field, ' 前端 {Enter}');
  expect(onChange.mock.calls).toEqual([[['前端']]]);
  expect(field).toHaveValue('');
});

test('不区分大小写的重复', async () => {
  const { user, onChange, field } = setup({ initialTags: ['Vue'] });
  await user.type(field, 'VUE{Enter}');
  await user.clear(field);
  await user.type(field, ' vue {Enter}');
  expect(onChange).not.toHaveBeenCalled();
});

test('删除指定的标签与 Backspace', async () => {
  const { user, onChange, field } = setup({ initialTags: ['x', 'y', 'z'] });
  await user.click(screen.getByRole('button', { name: '删除 x' }));
  expect(onChange).toHaveBeenLastCalledWith(['y', 'z']);
  await user.type(field, 'q{Backspace}');
  expect(onChange).toHaveBeenCalledTimes(1);
  await user.keyboard('{Backspace}');
  expect(onChange).toHaveBeenLastCalledWith(['y']);
});

test('上限', () => {
  const { field } = setup({ initialTags: ['1', '2', '3', '4', '5'] });
  expect(field).toBeDisabled();
});
```
:::

:::variant{kind=wrong name=visible-paths-only fails=mutants misses=backspace-always,case-sensitive,keeps-draft,no-trim reason="只测试了添加、删除和上限：空白、大小写、Backspace、添加后的输入框都没有检查"}
```tsx file=TagInput.test.tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { TagInput } from './TagInput';

const items = () => within(screen.getByRole('list', { name: '已添加的标签' })).queryAllByRole('listitem');

test('添加', async () => {
  const user = userEvent.setup();
  render(<TagInput />);
  await user.type(screen.getByRole('textbox', { name: '标签' }), 'Vite{Enter}');
  expect(items()).toHaveLength(1);
  expect(items()[0]).toHaveTextContent('Vite');
});

test('删除', async () => {
  const user = userEvent.setup();
  render(<TagInput initialTags={['A', 'B']} />);
  await user.click(screen.getByRole('button', { name: '删除 A' }));
  expect(items()).toHaveLength(1);
  expect(items()[0]).toHaveTextContent('B');
});

test('上限', () => {
  render(<TagInput initialTags={['1', '2', '3', '4', '5']} />);
  expect(screen.getByRole('textbox', { name: '标签' })).toBeDisabled();
});
```
:::

:::variant{kind=wrong name=wrong-backspace-expectation fails=tests reason="期望有文字时 Backspace 也删除最后一个标签：规格中只有输入框为空时才删除标签"}
```tsx file=TagInput.test.tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { TagInput } from './TagInput';

test('Backspace 删除最后一个标签', async () => {
  const user = userEvent.setup();
  render(<TagInput initialTags={['React', 'Vite']} />);
  await user.type(screen.getByRole('textbox', { name: '标签' }), 'a{Backspace}');
  expect(within(screen.getByRole('list', { name: '已添加的标签' })).getAllByRole('listitem')).toHaveLength(1);
});
```
:::
