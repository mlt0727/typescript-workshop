---
kind: challenge
title: 为标签输入框写测试
grading: tests
---
`tag-input.ts`（只读）中的 `mountTagInput(root, options)` 在 `root` 中创建一个标签输入框。规格：

1. 输入框的标签是“标签”。按 Enter 时，把输入的文字去掉首尾空白后作为一个新标签（只有空白时不添加），然后清空输入框；
2. 已经有同一个标签（**不区分大小写**）时不添加，输入框保留文字，`role="status"` 中显示 `已经有“输入的文字”了`；
3. 已添加的标签在名为“已添加的标签”的列表中，每个标签后面有一个删除按钮，可访问的名字是 `删除 标签名`，点击删除这一个标签；
4. 输入框为空时按 Backspace，删除最后一个标签；输入框中有文字时，Backspace 只删除文字；
5. 标签数达到 `max`（默认 5）时禁用输入框，状态区域显示 `最多 N 个标签`；
6. 每次标签变化，调用 `onChange(新的标签数组)`。

在 `tag-input.test.ts` 中写测试。`test-utils.ts`（只读）中的 `render(options)` 清空页面上的 `#app`，在其中挂载一个新的标签输入框（每个测试开始前，页面会恢复成 `index.html` 的初始状态，`main.ts` 也会重新运行，`render` 把它挂载的那个清除掉），作用相当于 React 测试中的 `render(<组件 />)`（g15）。平台准备了十一个错误的版本，你的测试要发现每一个。
:::files{role=support}
```html file=index.html readonly
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>标签输入框</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=main.ts readonly
import { mountTagInput } from './tag-input';

const app = document.getElementById('app');
if (app === null) throw new Error('页面缺少 #app');
mountTagInput(app, { initialTags: ['TypeScript'], onChange: (tags) => console.log(tags) });
```
```ts file=tag-input.ts readonly
export type TagInputOptions = {
  initialTags?: readonly string[];
  max?: number;
  onChange?: (tags: string[]) => void;
};

let nextId = 0;

/** 在 root 中创建一个标签输入框 */
export function mountTagInput(root: HTMLElement, { initialTags = [], max = 5, onChange }: TagInputOptions = {}): void {
  let tags = [...initialTags];
  let message = '';
  nextId += 1;

  const label = document.createElement('label');
  label.htmlFor = `tag-input-${nextId}`;
  label.textContent = '标签';
  const list = document.createElement('ul');
  list.setAttribute('aria-label', '已添加的标签');
  const input = document.createElement('input');
  input.id = label.htmlFor;
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  root.append(label, list, input, status);

  const render = () => {
    list.replaceChildren(
      ...tags.map((tag) => {
        const item = document.createElement('li');
        const text = document.createElement('span');
        text.textContent = tag;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.setAttribute('aria-label', `删除 ${tag}`);
        remove.textContent = '×';
        remove.addEventListener('click', () => update(tags.filter((t) => t !== tag)));
        item.append(text, remove);
        return item;
      }),
    );
    const full = tags.length >= max;
    input.disabled = full;
    status.textContent = full ? `最多 ${max} 个标签` : message;
  };

  const update = (next: string[]) => {
    tags = next;
    render();
    onChange?.([...next]);
  };

  input.addEventListener('input', () => {
    message = '';
    render();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const tag = input.value.trim();
      if (tag === '') return;
      if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
        message = `已经有“${tag}”了`;
        render();
        return;
      }
      input.value = '';
      message = '';
      update([...tags, tag]);
    } else if (event.key === 'Backspace' && input.value === '' && tags.length > 0) {
      update(tags.slice(0, -1));
    }
  });
  render();
}
```
```ts file=test-utils.ts readonly
import { mountTagInput, type TagInputOptions } from './tag-input';

/** 清空页面上的 #app（main.ts 挂载的那个也一起清除），在其中挂载一个新的标签输入框 */
export function render(options: TagInputOptions = {}): void {
  const app = document.getElementById('app');
  if (app === null) throw new Error('页面缺少 #app');
  app.replaceChildren();
  mountTagInput(app, options);
}
```
:::

:::files{role=starter}
```ts file=tag-input.test.ts
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { render } from './test-utils';

test('按 Enter 添加标签', async () => {
  const user = userEvent.setup();
  render();
  await user.type(screen.getByRole('textbox', { name: '标签' }), 'Vite{Enter}');
  const list = screen.getByRole('list', { name: '已添加的标签' });
  expect(within(list).getAllByRole('listitem')).toHaveLength(1);
});
```
:::

:::files{role=solution}
```ts file=tag-input.test.ts
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { render } from './test-utils';

const input = () => screen.getByRole('textbox', { name: '标签' });
const tagTexts = () =>
  within(screen.getByRole('list', { name: '已添加的标签' }))
    .queryAllByRole('listitem')
    .map((item) => item.querySelector('span')?.textContent);

describe('标签输入框', () => {
  test('按 Enter 添加去掉空白的标签，清空输入框，通知 onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render({ onChange });
    await user.type(input(), '  Vite {Enter}');
    expect(tagTexts()).toEqual(['Vite']);
    expect(input()).toHaveValue('');
    expect(onChange).toHaveBeenLastCalledWith(['Vite']);
  });

  test('只有空白时不添加', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render({ onChange });
    await user.type(input(), '   {Enter}');
    expect(tagTexts()).toEqual([]);
    expect(onChange).not.toHaveBeenCalled();
  });

  test('重复的标签（不区分大小写）不添加，输入框保留文字，并给出提示', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render({ initialTags: ['TypeScript'], onChange });
    await user.type(input(), 'typescript{Enter}');
    expect(tagTexts()).toEqual(['TypeScript']);
    expect(input()).toHaveValue('typescript');
    expect(screen.getByRole('status')).toHaveTextContent('已经有“typescript”了');
    await user.clear(input());
    await user.type(input(), ' TypeScript {Enter}');
    expect(tagTexts()).toEqual(['TypeScript']);
    expect(onChange).not.toHaveBeenCalled();
  });

  test('删除按钮删除对应的标签', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render({ initialTags: ['React', 'Vite', 'Vitest'], onChange });
    await user.click(screen.getByRole('button', { name: '删除 Vite' }));
    expect(tagTexts()).toEqual(['React', 'Vitest']);
    expect(onChange).toHaveBeenLastCalledWith(['React', 'Vitest']);
  });

  test('输入框为空时 Backspace 删除最后一个标签；有文字时只删除文字', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render({ initialTags: ['React', 'Vite'], onChange });
    await user.type(input(), 'ab{Backspace}');
    expect(input()).toHaveValue('a');
    expect(tagTexts()).toEqual(['React', 'Vite']);
    await user.keyboard('{Backspace}{Backspace}');
    expect(input()).toHaveValue('');
    expect(tagTexts()).toEqual(['React']);
    expect(onChange).toHaveBeenLastCalledWith(['React']);
  });

  test('达到上限时禁用输入框并提示', () => {
    render({ initialTags: ['a', 'b'], max: 2 });
    expect(input()).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('最多 2 个标签');
  });
});
```
:::

:::mutant{name=case-sensitive hint="判断重复时区分了大小写：已经有 TypeScript 时还能添加 typescript"}
```ts file=tag-input.ts
export type TagInputOptions = {
  initialTags?: readonly string[];
  max?: number;
  onChange?: (tags: string[]) => void;
};

let nextId = 0;

/** 在 root 中创建一个标签输入框 */
export function mountTagInput(root: HTMLElement, { initialTags = [], max = 5, onChange }: TagInputOptions = {}): void {
  let tags = [...initialTags];
  let message = '';
  nextId += 1;

  const label = document.createElement('label');
  label.htmlFor = `tag-input-${nextId}`;
  label.textContent = '标签';
  const list = document.createElement('ul');
  list.setAttribute('aria-label', '已添加的标签');
  const input = document.createElement('input');
  input.id = label.htmlFor;
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  root.append(label, list, input, status);

  const render = () => {
    list.replaceChildren(
      ...tags.map((tag) => {
        const item = document.createElement('li');
        const text = document.createElement('span');
        text.textContent = tag;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.setAttribute('aria-label', `删除 ${tag}`);
        remove.textContent = '×';
        remove.addEventListener('click', () => update(tags.filter((t) => t !== tag)));
        item.append(text, remove);
        return item;
      }),
    );
    const full = tags.length >= max;
    input.disabled = full;
    status.textContent = full ? `最多 ${max} 个标签` : message;
  };

  const update = (next: string[]) => {
    tags = next;
    render();
    onChange?.([...next]);
  };

  input.addEventListener('input', () => {
    message = '';
    render();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const tag = input.value.trim();
      if (tag === '') return;
      if (tags.includes(tag)) {
        message = `已经有“${tag}”了`;
        render();
        return;
      }
      input.value = '';
      message = '';
      update([...tags, tag]);
    } else if (event.key === 'Backspace' && input.value === '' && tags.length > 0) {
      update(tags.slice(0, -1));
    }
  });
  render();
}
```
:::

:::mutant{name=no-trim hint="没有去掉首尾空白：onChange 收到的是带空格的标签，带空格的重复标签也能加进去"}
```ts file=tag-input.ts
export type TagInputOptions = {
  initialTags?: readonly string[];
  max?: number;
  onChange?: (tags: string[]) => void;
};

let nextId = 0;

/** 在 root 中创建一个标签输入框 */
export function mountTagInput(root: HTMLElement, { initialTags = [], max = 5, onChange }: TagInputOptions = {}): void {
  let tags = [...initialTags];
  let message = '';
  nextId += 1;

  const label = document.createElement('label');
  label.htmlFor = `tag-input-${nextId}`;
  label.textContent = '标签';
  const list = document.createElement('ul');
  list.setAttribute('aria-label', '已添加的标签');
  const input = document.createElement('input');
  input.id = label.htmlFor;
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  root.append(label, list, input, status);

  const render = () => {
    list.replaceChildren(
      ...tags.map((tag) => {
        const item = document.createElement('li');
        const text = document.createElement('span');
        text.textContent = tag;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.setAttribute('aria-label', `删除 ${tag}`);
        remove.textContent = '×';
        remove.addEventListener('click', () => update(tags.filter((t) => t !== tag)));
        item.append(text, remove);
        return item;
      }),
    );
    const full = tags.length >= max;
    input.disabled = full;
    status.textContent = full ? `最多 ${max} 个标签` : message;
  };

  const update = (next: string[]) => {
    tags = next;
    render();
    onChange?.([...next]);
  };

  input.addEventListener('input', () => {
    message = '';
    render();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const tag = input.value;
      if (tag.trim() === '') return;
      if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
        message = `已经有“${tag}”了`;
        render();
        return;
      }
      input.value = '';
      message = '';
      update([...tags, tag]);
    } else if (event.key === 'Backspace' && input.value === '' && tags.length > 0) {
      update(tags.slice(0, -1));
    }
  });
  render();
}
```
:::

:::mutant{name=adds-blank hint="只有空白时也添加了一个空的标签：需要测试只输入空白再按 Enter"}
```ts file=tag-input.ts
export type TagInputOptions = {
  initialTags?: readonly string[];
  max?: number;
  onChange?: (tags: string[]) => void;
};

let nextId = 0;

/** 在 root 中创建一个标签输入框 */
export function mountTagInput(root: HTMLElement, { initialTags = [], max = 5, onChange }: TagInputOptions = {}): void {
  let tags = [...initialTags];
  let message = '';
  nextId += 1;

  const label = document.createElement('label');
  label.htmlFor = `tag-input-${nextId}`;
  label.textContent = '标签';
  const list = document.createElement('ul');
  list.setAttribute('aria-label', '已添加的标签');
  const input = document.createElement('input');
  input.id = label.htmlFor;
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  root.append(label, list, input, status);

  const render = () => {
    list.replaceChildren(
      ...tags.map((tag) => {
        const item = document.createElement('li');
        const text = document.createElement('span');
        text.textContent = tag;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.setAttribute('aria-label', `删除 ${tag}`);
        remove.textContent = '×';
        remove.addEventListener('click', () => update(tags.filter((t) => t !== tag)));
        item.append(text, remove);
        return item;
      }),
    );
    const full = tags.length >= max;
    input.disabled = full;
    status.textContent = full ? `最多 ${max} 个标签` : message;
  };

  const update = (next: string[]) => {
    tags = next;
    render();
    onChange?.([...next]);
  };

  input.addEventListener('input', () => {
    message = '';
    render();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const tag = input.value.trim();
      if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
        message = `已经有“${tag}”了`;
        render();
        return;
      }
      input.value = '';
      message = '';
      update([...tags, tag]);
    } else if (event.key === 'Backspace' && input.value === '' && tags.length > 0) {
      update(tags.slice(0, -1));
    }
  });
  render();
}
```
:::

:::mutant{name=backspace-always hint="输入框中有文字时按 Backspace 也删掉了最后一个标签：只有输入框为空时才应该这样"}
```ts file=tag-input.ts
export type TagInputOptions = {
  initialTags?: readonly string[];
  max?: number;
  onChange?: (tags: string[]) => void;
};

let nextId = 0;

/** 在 root 中创建一个标签输入框 */
export function mountTagInput(root: HTMLElement, { initialTags = [], max = 5, onChange }: TagInputOptions = {}): void {
  let tags = [...initialTags];
  let message = '';
  nextId += 1;

  const label = document.createElement('label');
  label.htmlFor = `tag-input-${nextId}`;
  label.textContent = '标签';
  const list = document.createElement('ul');
  list.setAttribute('aria-label', '已添加的标签');
  const input = document.createElement('input');
  input.id = label.htmlFor;
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  root.append(label, list, input, status);

  const render = () => {
    list.replaceChildren(
      ...tags.map((tag) => {
        const item = document.createElement('li');
        const text = document.createElement('span');
        text.textContent = tag;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.setAttribute('aria-label', `删除 ${tag}`);
        remove.textContent = '×';
        remove.addEventListener('click', () => update(tags.filter((t) => t !== tag)));
        item.append(text, remove);
        return item;
      }),
    );
    const full = tags.length >= max;
    input.disabled = full;
    status.textContent = full ? `最多 ${max} 个标签` : message;
  };

  const update = (next: string[]) => {
    tags = next;
    render();
    onChange?.([...next]);
  };

  input.addEventListener('input', () => {
    message = '';
    render();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const tag = input.value.trim();
      if (tag === '') return;
      if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
        message = `已经有“${tag}”了`;
        render();
        return;
      }
      input.value = '';
      message = '';
      update([...tags, tag]);
    } else if (event.key === 'Backspace' && tags.length > 0) {
      update(tags.slice(0, -1));
    }
  });
  render();
}
```
:::

:::mutant{name=removes-last hint="点击某个标签的删除按钮，删掉的总是最后一个：需要删除一个不在最后的标签"}
```ts file=tag-input.ts
export type TagInputOptions = {
  initialTags?: readonly string[];
  max?: number;
  onChange?: (tags: string[]) => void;
};

let nextId = 0;

/** 在 root 中创建一个标签输入框 */
export function mountTagInput(root: HTMLElement, { initialTags = [], max = 5, onChange }: TagInputOptions = {}): void {
  let tags = [...initialTags];
  let message = '';
  nextId += 1;

  const label = document.createElement('label');
  label.htmlFor = `tag-input-${nextId}`;
  label.textContent = '标签';
  const list = document.createElement('ul');
  list.setAttribute('aria-label', '已添加的标签');
  const input = document.createElement('input');
  input.id = label.htmlFor;
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  root.append(label, list, input, status);

  const render = () => {
    list.replaceChildren(
      ...tags.map((tag) => {
        const item = document.createElement('li');
        const text = document.createElement('span');
        text.textContent = tag;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.setAttribute('aria-label', `删除 ${tag}`);
        remove.textContent = '×';
        remove.addEventListener('click', () => update(tags.slice(0, -1)));
        item.append(text, remove);
        return item;
      }),
    );
    const full = tags.length >= max;
    input.disabled = full;
    status.textContent = full ? `最多 ${max} 个标签` : message;
  };

  const update = (next: string[]) => {
    tags = next;
    render();
    onChange?.([...next]);
  };

  input.addEventListener('input', () => {
    message = '';
    render();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const tag = input.value.trim();
      if (tag === '') return;
      if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
        message = `已经有“${tag}”了`;
        render();
        return;
      }
      input.value = '';
      message = '';
      update([...tags, tag]);
    } else if (event.key === 'Backspace' && input.value === '' && tags.length > 0) {
      update(tags.slice(0, -1));
    }
  });
  render();
}
```
:::

:::mutant{name=remove-no-onchange hint="点击删除按钮时页面更新了，却没有调用 onChange：需要检查删除之后 onChange 收到的数组"}
```ts file=tag-input.ts
export type TagInputOptions = {
  initialTags?: readonly string[];
  max?: number;
  onChange?: (tags: string[]) => void;
};

let nextId = 0;

/** 在 root 中创建一个标签输入框 */
export function mountTagInput(root: HTMLElement, { initialTags = [], max = 5, onChange }: TagInputOptions = {}): void {
  let tags = [...initialTags];
  let message = '';
  nextId += 1;

  const label = document.createElement('label');
  label.htmlFor = `tag-input-${nextId}`;
  label.textContent = '标签';
  const list = document.createElement('ul');
  list.setAttribute('aria-label', '已添加的标签');
  const input = document.createElement('input');
  input.id = label.htmlFor;
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  root.append(label, list, input, status);

  const render = () => {
    list.replaceChildren(
      ...tags.map((tag) => {
        const item = document.createElement('li');
        const text = document.createElement('span');
        text.textContent = tag;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.setAttribute('aria-label', `删除 ${tag}`);
        remove.textContent = '×';
        remove.addEventListener('click', () => {
          tags = tags.filter((t) => t !== tag);
          render();
        });
        item.append(text, remove);
        return item;
      }),
    );
    const full = tags.length >= max;
    input.disabled = full;
    status.textContent = full ? `最多 ${max} 个标签` : message;
  };

  const update = (next: string[]) => {
    tags = next;
    render();
    onChange?.([...next]);
  };

  input.addEventListener('input', () => {
    message = '';
    render();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const tag = input.value.trim();
      if (tag === '') return;
      if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
        message = `已经有“${tag}”了`;
        render();
        return;
      }
      input.value = '';
      message = '';
      update([...tags, tag]);
    } else if (event.key === 'Backspace' && input.value === '' && tags.length > 0) {
      update(tags.slice(0, -1));
    }
  });
  render();
}
```
:::

:::mutant{name=unnamed-remove hint="删除按钮没有可访问的名字：读屏软件只读出“×”，不知道删除的是哪一个"}
```ts file=tag-input.ts
export type TagInputOptions = {
  initialTags?: readonly string[];
  max?: number;
  onChange?: (tags: string[]) => void;
};

let nextId = 0;

/** 在 root 中创建一个标签输入框 */
export function mountTagInput(root: HTMLElement, { initialTags = [], max = 5, onChange }: TagInputOptions = {}): void {
  let tags = [...initialTags];
  let message = '';
  nextId += 1;

  const label = document.createElement('label');
  label.htmlFor = `tag-input-${nextId}`;
  label.textContent = '标签';
  const list = document.createElement('ul');
  list.setAttribute('aria-label', '已添加的标签');
  const input = document.createElement('input');
  input.id = label.htmlFor;
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  root.append(label, list, input, status);

  const render = () => {
    list.replaceChildren(
      ...tags.map((tag) => {
        const item = document.createElement('li');
        const text = document.createElement('span');
        text.textContent = tag;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = '×';
        remove.addEventListener('click', () => update(tags.filter((t) => t !== tag)));
        item.append(text, remove);
        return item;
      }),
    );
    const full = tags.length >= max;
    input.disabled = full;
    status.textContent = full ? `最多 ${max} 个标签` : message;
  };

  const update = (next: string[]) => {
    tags = next;
    render();
    onChange?.([...next]);
  };

  input.addEventListener('input', () => {
    message = '';
    render();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const tag = input.value.trim();
      if (tag === '') return;
      if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
        message = `已经有“${tag}”了`;
        render();
        return;
      }
      input.value = '';
      message = '';
      update([...tags, tag]);
    } else if (event.key === 'Backspace' && input.value === '' && tags.length > 0) {
      update(tags.slice(0, -1));
    }
  });
  render();
}
```
:::

:::mutant{name=duplicate-no-message hint="重复的标签没有添加，但也没有任何提示：需要检查状态区域中的文字"}
```ts file=tag-input.ts
export type TagInputOptions = {
  initialTags?: readonly string[];
  max?: number;
  onChange?: (tags: string[]) => void;
};

let nextId = 0;

/** 在 root 中创建一个标签输入框 */
export function mountTagInput(root: HTMLElement, { initialTags = [], max = 5, onChange }: TagInputOptions = {}): void {
  let tags = [...initialTags];
  let message = '';
  nextId += 1;

  const label = document.createElement('label');
  label.htmlFor = `tag-input-${nextId}`;
  label.textContent = '标签';
  const list = document.createElement('ul');
  list.setAttribute('aria-label', '已添加的标签');
  const input = document.createElement('input');
  input.id = label.htmlFor;
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  root.append(label, list, input, status);

  const render = () => {
    list.replaceChildren(
      ...tags.map((tag) => {
        const item = document.createElement('li');
        const text = document.createElement('span');
        text.textContent = tag;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.setAttribute('aria-label', `删除 ${tag}`);
        remove.textContent = '×';
        remove.addEventListener('click', () => update(tags.filter((t) => t !== tag)));
        item.append(text, remove);
        return item;
      }),
    );
    const full = tags.length >= max;
    input.disabled = full;
    status.textContent = full ? `最多 ${max} 个标签` : message;
  };

  const update = (next: string[]) => {
    tags = next;
    render();
    onChange?.([...next]);
  };

  input.addEventListener('input', () => {
    message = '';
    render();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const tag = input.value.trim();
      if (tag === '') return;
      if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
        render();
        return;
      }
      input.value = '';
      message = '';
      update([...tags, tag]);
    } else if (event.key === 'Backspace' && input.value === '' && tags.length > 0) {
      update(tags.slice(0, -1));
    }
  });
  render();
}
```
:::

:::mutant{name=duplicate-clears hint="重复时清空了输入框：用户没法修改刚才输入的文字。需要检查重复之后输入框中的文字还在"}
```ts file=tag-input.ts
export type TagInputOptions = {
  initialTags?: readonly string[];
  max?: number;
  onChange?: (tags: string[]) => void;
};

let nextId = 0;

/** 在 root 中创建一个标签输入框 */
export function mountTagInput(root: HTMLElement, { initialTags = [], max = 5, onChange }: TagInputOptions = {}): void {
  let tags = [...initialTags];
  let message = '';
  nextId += 1;

  const label = document.createElement('label');
  label.htmlFor = `tag-input-${nextId}`;
  label.textContent = '标签';
  const list = document.createElement('ul');
  list.setAttribute('aria-label', '已添加的标签');
  const input = document.createElement('input');
  input.id = label.htmlFor;
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  root.append(label, list, input, status);

  const render = () => {
    list.replaceChildren(
      ...tags.map((tag) => {
        const item = document.createElement('li');
        const text = document.createElement('span');
        text.textContent = tag;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.setAttribute('aria-label', `删除 ${tag}`);
        remove.textContent = '×';
        remove.addEventListener('click', () => update(tags.filter((t) => t !== tag)));
        item.append(text, remove);
        return item;
      }),
    );
    const full = tags.length >= max;
    input.disabled = full;
    status.textContent = full ? `最多 ${max} 个标签` : message;
  };

  const update = (next: string[]) => {
    tags = next;
    render();
    onChange?.([...next]);
  };

  input.addEventListener('input', () => {
    message = '';
    render();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const tag = input.value.trim();
      if (tag === '') return;
      if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
        input.value = '';
        message = `已经有“${tag}”了`;
        render();
        return;
      }
      input.value = '';
      message = '';
      update([...tags, tag]);
    } else if (event.key === 'Backspace' && input.value === '' && tags.length > 0) {
      update(tags.slice(0, -1));
    }
  });
  render();
}
```
:::

:::mutant{name=no-max hint="达到上限之后仍然可以输入：需要用 max 个初始标签检查输入框被禁用"}
```ts file=tag-input.ts
export type TagInputOptions = {
  initialTags?: readonly string[];
  max?: number;
  onChange?: (tags: string[]) => void;
};

let nextId = 0;

/** 在 root 中创建一个标签输入框 */
export function mountTagInput(root: HTMLElement, { initialTags = [], max = 5, onChange }: TagInputOptions = {}): void {
  let tags = [...initialTags];
  let message = '';
  nextId += 1;

  const label = document.createElement('label');
  label.htmlFor = `tag-input-${nextId}`;
  label.textContent = '标签';
  const list = document.createElement('ul');
  list.setAttribute('aria-label', '已添加的标签');
  const input = document.createElement('input');
  input.id = label.htmlFor;
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  root.append(label, list, input, status);

  const render = () => {
    list.replaceChildren(
      ...tags.map((tag) => {
        const item = document.createElement('li');
        const text = document.createElement('span');
        text.textContent = tag;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.setAttribute('aria-label', `删除 ${tag}`);
        remove.textContent = '×';
        remove.addEventListener('click', () => update(tags.filter((t) => t !== tag)));
        item.append(text, remove);
        return item;
      }),
    );
    const full = false;
    input.disabled = full;
    status.textContent = full ? `最多 ${max} 个标签` : message;
  };

  const update = (next: string[]) => {
    tags = next;
    render();
    onChange?.([...next]);
  };

  input.addEventListener('input', () => {
    message = '';
    render();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const tag = input.value.trim();
      if (tag === '') return;
      if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
        message = `已经有“${tag}”了`;
        render();
        return;
      }
      input.value = '';
      message = '';
      update([...tags, tag]);
    } else if (event.key === 'Backspace' && input.value === '' && tags.length > 0) {
      update(tags.slice(0, -1));
    }
  });
  render();
}
```
:::

:::mutant{name=keeps-draft hint="添加之后输入框没有清空"}
```ts file=tag-input.ts
export type TagInputOptions = {
  initialTags?: readonly string[];
  max?: number;
  onChange?: (tags: string[]) => void;
};

let nextId = 0;

/** 在 root 中创建一个标签输入框 */
export function mountTagInput(root: HTMLElement, { initialTags = [], max = 5, onChange }: TagInputOptions = {}): void {
  let tags = [...initialTags];
  let message = '';
  nextId += 1;

  const label = document.createElement('label');
  label.htmlFor = `tag-input-${nextId}`;
  label.textContent = '标签';
  const list = document.createElement('ul');
  list.setAttribute('aria-label', '已添加的标签');
  const input = document.createElement('input');
  input.id = label.htmlFor;
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  root.append(label, list, input, status);

  const render = () => {
    list.replaceChildren(
      ...tags.map((tag) => {
        const item = document.createElement('li');
        const text = document.createElement('span');
        text.textContent = tag;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.setAttribute('aria-label', `删除 ${tag}`);
        remove.textContent = '×';
        remove.addEventListener('click', () => update(tags.filter((t) => t !== tag)));
        item.append(text, remove);
        return item;
      }),
    );
    const full = tags.length >= max;
    input.disabled = full;
    status.textContent = full ? `最多 ${max} 个标签` : message;
  };

  const update = (next: string[]) => {
    tags = next;
    render();
    onChange?.([...next]);
  };

  input.addEventListener('input', () => {
    message = '';
    render();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const tag = input.value.trim();
      if (tag === '') return;
      if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
        message = `已经有“${tag}”了`;
        render();
        return;
      }
      message = '';
      update([...tags, tag]);
    } else if (event.key === 'Backspace' && input.value === '' && tags.length > 0) {
      update(tags.slice(0, -1));
    }
  });
  render();
}
```
:::

:::hint{level=1}
规格的每一条至少一个测试。用 `user.type(输入框, 'Vite{Enter}')` 输入并按 Enter，`{Backspace}` 是退格键；`vi.fn()` 作为 `onChange` 传给 `render({ onChange })`，用 `toHaveBeenLastCalledWith([…])` 检查它收到的数组，这样也能发现“没有去掉空白”。“不添加”也要检查：只输入空白、输入重复的标签之后，`onChange` 都不应该被调用。
:::

:::hint{level=2}
“删除对应的标签”要用三个初始标签，删除中间的那个，否则“总是删除最后一个”的错误版本也能通过；删除之后同样检查 `onChange`。Backspace 要测试两种情况：先输入 `ab{Backspace}`，检查输入框是 `a`、标签没变；再按两次 Backspace，第二次才删除最后一个标签。重复的情况要检查三件事：标签没有增加、输入框中的文字还在、状态区域中有提示。检查上限时直接传入 `max` 个初始标签。
:::

:::explanation
这道题中，有几个错误的版本在“典型的用法”中完全正常，只有特定的输入才能发现：

| 错误 | 需要的输入或检查 |
| --- | --- |
| 区分大小写 | 已有 `TypeScript`，再输入 `typescript` |
| 不去空白、只有空白也添加 | 输入 `'  Vite '`、只输入空白，检查标签和 `onChange` 收到的值 |
| 有文字时 Backspace 也删标签 | 输入框中有文字时按 Backspace |
| 总是删除最后一个 | 删除一个不在最后的标签 |
| 删除时不通知 | 删除之后检查 `onChange` |
| 重复时没有提示、清空了输入框 | 输入重复的标签之后检查状态区域和输入框 |
| 添加后没清空 | 添加之后检查输入框的值 |

`onChange` 的模拟函数在这里很有用：它检查的是组件交给外部的数据，而不只是页面的样子。`'  Vite '` 和 `'Vite'` 在渲染出来的页面上看不出区别（HTML 会合并空白），`toHaveTextContent`、`getByText` 默认也会把空白规范化；`textContent` 和 `onChange` 收到的数组则保留了原样，参考解的 `tagTexts()` 读的就是 `textContent`。

“删除按钮没有名字”的版本，视觉上完全一样（按钮上都是 ×），只是读屏软件读不出删除的是哪一个。`getByRole('button', { name: '删除 Vite' })` 同时测试了功能和可访问性。

测试中没有读取 `mountTagInput` 内部的变量，也没有按 class 名查找元素：如果把实现改成用模板字符串一次生成整个列表，或者改成 React 组件（g15），只要页面上的角色、名字和行为不变，这些测试的写法都不需要改变。
:::

:::variant{kind=alt name=setup-helper}
```ts file=tag-input.test.ts
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { render } from './test-utils';
import type { TagInputOptions } from './tag-input';

function setup(options: TagInputOptions = {}) {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render({ ...options, onChange });
  return { user, onChange, field: screen.getByLabelText('标签') };
}

test('添加：去掉空白、清空输入框；只有空白时不添加', async () => {
  const { user, onChange, field } = setup();
  await user.type(field, ' 前端 {Enter}');
  expect(onChange.mock.calls).toEqual([[['前端']]]);
  expect(field).toHaveValue('');
  await user.type(field, '  {Enter}');
  expect(onChange).toHaveBeenCalledTimes(1);
});

test('不区分大小写的重复：不添加、保留文字、提示', async () => {
  const { user, onChange, field } = setup({ initialTags: ['Vue'] });
  await user.type(field, 'VUE{Enter}');
  expect(field).toHaveValue('VUE');
  expect(screen.getByRole('status')).toHaveTextContent('已经有“VUE”了');
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

:::variant{kind=wrong name=visible-paths-only fails=mutants misses=case-sensitive,no-trim,adds-blank,backspace-always,remove-no-onchange,duplicate-no-message,duplicate-clears,keeps-draft reason="只测试了添加、删除和上限：空白、大小写、Backspace、重复时的提示、添加后的输入框、删除时的 onChange 都没有检查"}
```ts file=tag-input.test.ts
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { render } from './test-utils';

const items = () => within(screen.getByRole('list', { name: '已添加的标签' })).queryAllByRole('listitem');

test('添加', async () => {
  const user = userEvent.setup();
  render();
  await user.type(screen.getByRole('textbox', { name: '标签' }), 'Vite{Enter}');
  expect(items()).toHaveLength(1);
  expect(items()[0]).toHaveTextContent('Vite');
});

test('删除', async () => {
  const user = userEvent.setup();
  render({ initialTags: ['A', 'B'] });
  await user.click(screen.getByRole('button', { name: '删除 A' }));
  expect(items()).toHaveLength(1);
  expect(items()[0]).toHaveTextContent('B');
});

test('上限', () => {
  render({ initialTags: ['1', '2', '3', '4', '5'] });
  expect(screen.getByRole('textbox', { name: '标签' })).toBeDisabled();
});
```
:::

:::variant{kind=wrong name=wrong-backspace-expectation fails=tests reason="期望有文字时 Backspace 也删除最后一个标签：规格中只有输入框为空时才删除标签"}
```ts file=tag-input.test.ts
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { render } from './test-utils';

test('Backspace 删除最后一个标签', async () => {
  const user = userEvent.setup();
  render({ initialTags: ['React', 'Vite'] });
  await user.type(screen.getByRole('textbox', { name: '标签' }), 'a{Backspace}');
  expect(within(screen.getByRole('list', { name: '已添加的标签' })).getAllByRole('listitem')).toHaveLength(1);
});
```
:::
