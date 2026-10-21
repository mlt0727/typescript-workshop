---
kind: task
title: 为留言框写 DOM 测试
mode: dom
grading: tests
---
`comment-box.ts`（只读）实现了一个留言框，页面（`index.html`、`main.ts`，只读）把发表的留言加入“全部留言”列表。它的规格：

1. 输入框的标签是“留言”；下方的提示显示 `还可以输入 N 个字`（N 是 20 减去已输入的字数）；超过 20 个字时显示 `超出 M 个字`，并把输入框标记为无效（`aria-invalid="true"`）；
2. 输入为空、只有空白、或者超出字数时，“发表”按钮被禁用；
3. 点击“发表”：去掉首尾空白后加入列表；输入框清空，焦点回到输入框；`role="status"` 的区域显示“已发表”。

在 `comment-box.test.ts` 中写测试。每个测试开始前，页面会恢复成初始状态并重新运行 `main.ts`，所以测试中直接用 `screen` 查找即可。平台准备了十个错误的版本，你的测试要发现每一个。

:::files{role=support}
```html file=index.html readonly
<!doctype html>
<html lang="zh-CN">
  <body>
    <div id="app"></div>
    <h2>全部留言</h2>
    <ul id="comments" aria-label="全部留言"></ul>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=main.ts readonly
import { mountCommentBox } from './comment-box';

const app = document.getElementById('app');
const list = document.getElementById('comments');
if (!app || !list) throw new Error('页面结构不完整');

mountCommentBox(app, (text) => {
  const item = document.createElement('li');
  item.textContent = text;
  list.append(item);
});
```
```ts file=comment-box.ts readonly
export const MAX = 20;

/** 在 root 中渲染留言框；发表时调用 onSubmit */
export function mountCommentBox(root: HTMLElement, onSubmit: (text: string) => void): void {
  root.innerHTML = `
    <form novalidate>
      <label for="comment">留言</label>
      <textarea id="comment" aria-describedby="comment-hint"></textarea>
      <p id="comment-hint"></p>
      <button type="submit">发表</button>
      <p role="status"></p>
    </form>
  `;
  const form = root.querySelector('form');
  const textarea = root.querySelector('textarea');
  const hint = root.querySelector('#comment-hint');
  const button = root.querySelector('button');
  const status = root.querySelector('[role="status"]');
  if (!form || !textarea || !(hint instanceof HTMLElement) || !button || !(status instanceof HTMLElement)) {
    throw new Error('留言框的结构不完整');
  }

  const update = () => {
    const length = textarea.value.length;
    const over = length > MAX;
    hint.textContent = over ? `超出 ${length - MAX} 个字` : `还可以输入 ${MAX - length} 个字`;
    if (over) textarea.setAttribute('aria-invalid', 'true');
    else textarea.removeAttribute('aria-invalid');
    button.disabled = over || textarea.value.trim() === '';
  };

  textarea.addEventListener('input', () => {
    status.textContent = '';
    update();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (button.disabled) return;
    onSubmit(textarea.value.trim());
    textarea.value = '';
    status.textContent = '已发表';
    update();
    textarea.focus();
  });
  update();
}
```
:::

:::files{role=starter}
```ts file=comment-box.test.ts
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';

test('发表一条留言', async () => {
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: '留言' }), '你好');
  await user.click(screen.getByRole('button', { name: '发表' }));
  const list = screen.getByRole('list', { name: '全部留言' });
  expect(within(list).getByText('你好')).toBeInTheDocument();
});
```
:::

:::files{role=solution}
```ts file=comment-box.test.ts
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';

const box = () => screen.getByRole('textbox', { name: '留言' });
const submit = () => screen.getByRole('button', { name: '发表' });

describe('留言框', () => {
  test('一开始：还可以输入 20 个字，不能发表', () => {
    expect(screen.getByText('还可以输入 20 个字')).toBeInTheDocument();
    expect(submit()).toBeDisabled();
  });

  test('输入时更新剩余的字数', async () => {
    const user = userEvent.setup();
    await user.type(box(), 'abc');
    expect(screen.getByText('还可以输入 17 个字')).toBeInTheDocument();
    expect(submit()).toBeEnabled();
  });

  test('只有空白时不能发表', async () => {
    const user = userEvent.setup();
    await user.type(box(), '   ');
    expect(submit()).toBeDisabled();
  });

  test('超出字数：提示、标记为无效、不能发表', async () => {
    const user = userEvent.setup();
    await user.type(box(), 'x'.repeat(21));
    expect(screen.getByText('超出 1 个字')).toBeInTheDocument();
    expect(box()).toBeInvalid();
    expect(submit()).toBeDisabled();
  });

  test('发表：去掉首尾空白加入列表，清空输入框，焦点回到输入框', async () => {
    const user = userEvent.setup();
    await user.type(box(), '  你好  ');
    await user.click(submit());
    const list = screen.getByRole('list', { name: '全部留言' });
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['你好']);
    expect(box()).toHaveValue('');
    expect(box()).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('已发表');
    expect(submit()).toBeDisabled();
  });
});
```
:::

:::mutant{name=off-by-one hint="剩余的字数多算了一个：一开始显示“还可以输入 21 个字”"}
```ts file=comment-box.ts
export const MAX = 20;

/** 在 root 中渲染留言框；发表时调用 onSubmit */
export function mountCommentBox(root: HTMLElement, onSubmit: (text: string) => void): void {
  root.innerHTML = `
    <form novalidate>
      <label for="comment">留言</label>
      <textarea id="comment" aria-describedby="comment-hint"></textarea>
      <p id="comment-hint"></p>
      <button type="submit">发表</button>
      <p role="status"></p>
    </form>
  `;
  const form = root.querySelector('form');
  const textarea = root.querySelector('textarea');
  const hint = root.querySelector('#comment-hint');
  const button = root.querySelector('button');
  const status = root.querySelector('[role="status"]');
  if (!form || !textarea || !(hint instanceof HTMLElement) || !button || !(status instanceof HTMLElement)) {
    throw new Error('留言框的结构不完整');
  }

  const update = () => {
    const length = textarea.value.length;
    const over = length > MAX;
    hint.textContent = over ? `超出 ${length - MAX} 个字` : `还可以输入 ${MAX - length + 1} 个字`;
    if (over) textarea.setAttribute('aria-invalid', 'true');
    else textarea.removeAttribute('aria-invalid');
    button.disabled = over || textarea.value.trim() === '';
  };

  textarea.addEventListener('input', () => {
    status.textContent = '';
    update();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (button.disabled) return;
    onSubmit(textarea.value.trim());
    textarea.value = '';
    status.textContent = '已发表';
    update();
    textarea.focus();
  });
  update();
}
```
:::

:::mutant{name=allows-over-limit hint="超出字数时按钮仍然可以点击：需要输入超过 20 个字，检查按钮被禁用"}
```ts file=comment-box.ts
export const MAX = 20;

/** 在 root 中渲染留言框；发表时调用 onSubmit */
export function mountCommentBox(root: HTMLElement, onSubmit: (text: string) => void): void {
  root.innerHTML = `
    <form novalidate>
      <label for="comment">留言</label>
      <textarea id="comment" aria-describedby="comment-hint"></textarea>
      <p id="comment-hint"></p>
      <button type="submit">发表</button>
      <p role="status"></p>
    </form>
  `;
  const form = root.querySelector('form');
  const textarea = root.querySelector('textarea');
  const hint = root.querySelector('#comment-hint');
  const button = root.querySelector('button');
  const status = root.querySelector('[role="status"]');
  if (!form || !textarea || !(hint instanceof HTMLElement) || !button || !(status instanceof HTMLElement)) {
    throw new Error('留言框的结构不完整');
  }

  const update = () => {
    const length = textarea.value.length;
    const over = length > MAX;
    hint.textContent = over ? `超出 ${length - MAX} 个字` : `还可以输入 ${MAX - length} 个字`;
    if (over) textarea.setAttribute('aria-invalid', 'true');
    else textarea.removeAttribute('aria-invalid');
    button.disabled = textarea.value.trim() === '';
  };

  textarea.addEventListener('input', () => {
    status.textContent = '';
    update();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (button.disabled) return;
    onSubmit(textarea.value.trim());
    textarea.value = '';
    status.textContent = '已发表';
    update();
    textarea.focus();
  });
  update();
}
```
:::

:::mutant{name=allows-blank hint="只有空格时也能发表：需要只输入空白，检查按钮被禁用"}
```ts file=comment-box.ts
export const MAX = 20;

/** 在 root 中渲染留言框；发表时调用 onSubmit */
export function mountCommentBox(root: HTMLElement, onSubmit: (text: string) => void): void {
  root.innerHTML = `
    <form novalidate>
      <label for="comment">留言</label>
      <textarea id="comment" aria-describedby="comment-hint"></textarea>
      <p id="comment-hint"></p>
      <button type="submit">发表</button>
      <p role="status"></p>
    </form>
  `;
  const form = root.querySelector('form');
  const textarea = root.querySelector('textarea');
  const hint = root.querySelector('#comment-hint');
  const button = root.querySelector('button');
  const status = root.querySelector('[role="status"]');
  if (!form || !textarea || !(hint instanceof HTMLElement) || !button || !(status instanceof HTMLElement)) {
    throw new Error('留言框的结构不完整');
  }

  const update = () => {
    const length = textarea.value.length;
    const over = length > MAX;
    hint.textContent = over ? `超出 ${length - MAX} 个字` : `还可以输入 ${MAX - length} 个字`;
    if (over) textarea.setAttribute('aria-invalid', 'true');
    else textarea.removeAttribute('aria-invalid');
    button.disabled = over || textarea.value === '';
  };

  textarea.addEventListener('input', () => {
    status.textContent = '';
    update();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (button.disabled) return;
    onSubmit(textarea.value.trim());
    textarea.value = '';
    status.textContent = '已发表';
    update();
    textarea.focus();
  });
  update();
}
```
:::

:::mutant{name=not-cleared hint="发表之后输入框没有清空"}
```ts file=comment-box.ts
export const MAX = 20;

/** 在 root 中渲染留言框；发表时调用 onSubmit */
export function mountCommentBox(root: HTMLElement, onSubmit: (text: string) => void): void {
  root.innerHTML = `
    <form novalidate>
      <label for="comment">留言</label>
      <textarea id="comment" aria-describedby="comment-hint"></textarea>
      <p id="comment-hint"></p>
      <button type="submit">发表</button>
      <p role="status"></p>
    </form>
  `;
  const form = root.querySelector('form');
  const textarea = root.querySelector('textarea');
  const hint = root.querySelector('#comment-hint');
  const button = root.querySelector('button');
  const status = root.querySelector('[role="status"]');
  if (!form || !textarea || !(hint instanceof HTMLElement) || !button || !(status instanceof HTMLElement)) {
    throw new Error('留言框的结构不完整');
  }

  const update = () => {
    const length = textarea.value.length;
    const over = length > MAX;
    hint.textContent = over ? `超出 ${length - MAX} 个字` : `还可以输入 ${MAX - length} 个字`;
    if (over) textarea.setAttribute('aria-invalid', 'true');
    else textarea.removeAttribute('aria-invalid');
    button.disabled = over || textarea.value.trim() === '';
  };

  textarea.addEventListener('input', () => {
    status.textContent = '';
    update();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (button.disabled) return;
    onSubmit(textarea.value.trim());
    status.textContent = '已发表';
    update();
    textarea.focus();
  });
  update();
}
```
:::

:::mutant{name=no-aria-invalid hint="超出字数时没有标记 aria-invalid，读屏软件不知道这里有错误：需要检查输入框是否“无效”"}
```ts file=comment-box.ts
export const MAX = 20;

/** 在 root 中渲染留言框；发表时调用 onSubmit */
export function mountCommentBox(root: HTMLElement, onSubmit: (text: string) => void): void {
  root.innerHTML = `
    <form novalidate>
      <label for="comment">留言</label>
      <textarea id="comment" aria-describedby="comment-hint"></textarea>
      <p id="comment-hint"></p>
      <button type="submit">发表</button>
      <p role="status"></p>
    </form>
  `;
  const form = root.querySelector('form');
  const textarea = root.querySelector('textarea');
  const hint = root.querySelector('#comment-hint');
  const button = root.querySelector('button');
  const status = root.querySelector('[role="status"]');
  if (!form || !textarea || !(hint instanceof HTMLElement) || !button || !(status instanceof HTMLElement)) {
    throw new Error('留言框的结构不完整');
  }

  const update = () => {
    const length = textarea.value.length;
    const over = length > MAX;
    hint.textContent = over ? `超出 ${length - MAX} 个字` : `还可以输入 ${MAX - length} 个字`;
    button.disabled = over || textarea.value.trim() === '';
  };

  textarea.addEventListener('input', () => {
    status.textContent = '';
    update();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (button.disabled) return;
    onSubmit(textarea.value.trim());
    textarea.value = '';
    status.textContent = '已发表';
    update();
    textarea.focus();
  });
  update();
}
```
:::

:::mutant{name=label-not-linked hint="标签没有和输入框关联（for 写错了）：输入框没有可访问的名字"}
```ts file=comment-box.ts
export const MAX = 20;

/** 在 root 中渲染留言框；发表时调用 onSubmit */
export function mountCommentBox(root: HTMLElement, onSubmit: (text: string) => void): void {
  root.innerHTML = `
    <form novalidate>
      <label for="comment-box">留言</label>
      <textarea id="comment" aria-describedby="comment-hint"></textarea>
      <p id="comment-hint"></p>
      <button type="submit">发表</button>
      <p role="status"></p>
    </form>
  `;
  const form = root.querySelector('form');
  const textarea = root.querySelector('textarea');
  const hint = root.querySelector('#comment-hint');
  const button = root.querySelector('button');
  const status = root.querySelector('[role="status"]');
  if (!form || !textarea || !(hint instanceof HTMLElement) || !button || !(status instanceof HTMLElement)) {
    throw new Error('留言框的结构不完整');
  }

  const update = () => {
    const length = textarea.value.length;
    const over = length > MAX;
    hint.textContent = over ? `超出 ${length - MAX} 个字` : `还可以输入 ${MAX - length} 个字`;
    if (over) textarea.setAttribute('aria-invalid', 'true');
    else textarea.removeAttribute('aria-invalid');
    button.disabled = over || textarea.value.trim() === '';
  };

  textarea.addEventListener('input', () => {
    status.textContent = '';
    update();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (button.disabled) return;
    onSubmit(textarea.value.trim());
    textarea.value = '';
    status.textContent = '已发表';
    update();
    textarea.focus();
  });
  update();
}
```
:::

:::mutant{name=focus-lost hint="发表之后焦点留在了按钮上，没有回到输入框：需要检查发表之后的焦点"}
```ts file=comment-box.ts
export const MAX = 20;

/** 在 root 中渲染留言框；发表时调用 onSubmit */
export function mountCommentBox(root: HTMLElement, onSubmit: (text: string) => void): void {
  root.innerHTML = `
    <form novalidate>
      <label for="comment">留言</label>
      <textarea id="comment" aria-describedby="comment-hint"></textarea>
      <p id="comment-hint"></p>
      <button type="submit">发表</button>
      <p role="status"></p>
    </form>
  `;
  const form = root.querySelector('form');
  const textarea = root.querySelector('textarea');
  const hint = root.querySelector('#comment-hint');
  const button = root.querySelector('button');
  const status = root.querySelector('[role="status"]');
  if (!form || !textarea || !(hint instanceof HTMLElement) || !button || !(status instanceof HTMLElement)) {
    throw new Error('留言框的结构不完整');
  }

  const update = () => {
    const length = textarea.value.length;
    const over = length > MAX;
    hint.textContent = over ? `超出 ${length - MAX} 个字` : `还可以输入 ${MAX - length} 个字`;
    if (over) textarea.setAttribute('aria-invalid', 'true');
    else textarea.removeAttribute('aria-invalid');
    button.disabled = over || textarea.value.trim() === '';
  };

  textarea.addEventListener('input', () => {
    status.textContent = '';
    update();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (button.disabled) return;
    onSubmit(textarea.value.trim());
    textarea.value = '';
    status.textContent = '已发表';
    update();
  });
  update();
}
```
:::

:::mutant{name=no-trim hint="加入列表的留言没有去掉首尾空白：需要输入前后带空格的文字，检查列表项的 textContent（toHaveTextContent 默认会忽略首尾的空白）"}
```ts file=comment-box.ts
export const MAX = 20;

/** 在 root 中渲染留言框；发表时调用 onSubmit */
export function mountCommentBox(root: HTMLElement, onSubmit: (text: string) => void): void {
  root.innerHTML = `
    <form novalidate>
      <label for="comment">留言</label>
      <textarea id="comment" aria-describedby="comment-hint"></textarea>
      <p id="comment-hint"></p>
      <button type="submit">发表</button>
      <p role="status"></p>
    </form>
  `;
  const form = root.querySelector('form');
  const textarea = root.querySelector('textarea');
  const hint = root.querySelector('#comment-hint');
  const button = root.querySelector('button');
  const status = root.querySelector('[role="status"]');
  if (!form || !textarea || !(hint instanceof HTMLElement) || !button || !(status instanceof HTMLElement)) {
    throw new Error('留言框的结构不完整');
  }

  const update = () => {
    const length = textarea.value.length;
    const over = length > MAX;
    hint.textContent = over ? `超出 ${length - MAX} 个字` : `还可以输入 ${MAX - length} 个字`;
    if (over) textarea.setAttribute('aria-invalid', 'true');
    else textarea.removeAttribute('aria-invalid');
    button.disabled = over || textarea.value.trim() === '';
  };

  textarea.addEventListener('input', () => {
    status.textContent = '';
    update();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (button.disabled) return;
    onSubmit(textarea.value);
    textarea.value = '';
    status.textContent = '已发表';
    update();
    textarea.focus();
  });
  update();
}
```
:::

:::mutant{name=no-status hint="发表之后没有显示“已发表”：需要检查状态区域（role 为 status）中的文字"}
```ts file=comment-box.ts
export const MAX = 20;

/** 在 root 中渲染留言框；发表时调用 onSubmit */
export function mountCommentBox(root: HTMLElement, onSubmit: (text: string) => void): void {
  root.innerHTML = `
    <form novalidate>
      <label for="comment">留言</label>
      <textarea id="comment" aria-describedby="comment-hint"></textarea>
      <p id="comment-hint"></p>
      <button type="submit">发表</button>
      <p role="status"></p>
    </form>
  `;
  const form = root.querySelector('form');
  const textarea = root.querySelector('textarea');
  const hint = root.querySelector('#comment-hint');
  const button = root.querySelector('button');
  const status = root.querySelector('[role="status"]');
  if (!form || !textarea || !(hint instanceof HTMLElement) || !button || !(status instanceof HTMLElement)) {
    throw new Error('留言框的结构不完整');
  }

  const update = () => {
    const length = textarea.value.length;
    const over = length > MAX;
    hint.textContent = over ? `超出 ${length - MAX} 个字` : `还可以输入 ${MAX - length} 个字`;
    if (over) textarea.setAttribute('aria-invalid', 'true');
    else textarea.removeAttribute('aria-invalid');
    button.disabled = over || textarea.value.trim() === '';
  };

  textarea.addEventListener('input', () => {
    status.textContent = '';
    update();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (button.disabled) return;
    onSubmit(textarea.value.trim());
    textarea.value = '';
    update();
    textarea.focus();
  });
  update();
}
```
:::

:::mutant{name=never-submits hint="点击“发表”之后输入框清空了，留言却没有加入列表：需要检查“全部留言”列表"}
```ts file=comment-box.ts
export const MAX = 20;

/** 在 root 中渲染留言框；发表时调用 onSubmit */
export function mountCommentBox(root: HTMLElement, onSubmit: (text: string) => void): void {
  root.innerHTML = `
    <form novalidate>
      <label for="comment">留言</label>
      <textarea id="comment" aria-describedby="comment-hint"></textarea>
      <p id="comment-hint"></p>
      <button type="submit">发表</button>
      <p role="status"></p>
    </form>
  `;
  const form = root.querySelector('form');
  const textarea = root.querySelector('textarea');
  const hint = root.querySelector('#comment-hint');
  const button = root.querySelector('button');
  const status = root.querySelector('[role="status"]');
  if (!form || !textarea || !(hint instanceof HTMLElement) || !button || !(status instanceof HTMLElement)) {
    throw new Error('留言框的结构不完整');
  }

  const update = () => {
    const length = textarea.value.length;
    const over = length > MAX;
    hint.textContent = over ? `超出 ${length - MAX} 个字` : `还可以输入 ${MAX - length} 个字`;
    if (over) textarea.setAttribute('aria-invalid', 'true');
    else textarea.removeAttribute('aria-invalid');
    button.disabled = over || textarea.value.trim() === '';
  };

  textarea.addEventListener('input', () => {
    status.textContent = '';
    update();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (button.disabled) return;
    textarea.value = '';
    status.textContent = '已发表';
    update();
    textarea.focus();
  });
  update();
}
```
:::

:::hint{level=1}
对照规格的每一条写一个测试：一开始的提示和按钮；输入几个字之后的提示；只输入空白；输入 21 个字（`'x'.repeat(21)`）；发表之后的列表（输入前后带空格的文字）、输入框的值、焦点和“已发表”的提示。查找输入框用 `getByRole('textbox', { name: '留言' })`，它同时检查了标签是否正确关联。
:::

:::hint{level=2}
可以写两个小函数 `const box = () => screen.getByRole('textbox', { name: '留言' })`，每次调用都重新查找。用到的匹配器：`toBeDisabled`、`toBeEnabled`、`toBeInvalid`（检查 `aria-invalid`）、`toHaveValue('')`、`toHaveFocus()`。检查列表时，`within(list).getAllByRole('listitem')` 得到每一项，再 `.map((item) => item.textContent)` 比较其中的文字（`textContent` 保留空白）。
:::

:::explanation
十个错误的版本中，有几个是用户在页面上“看得到”的（字数算错、能发表空白、超出了还能发表、发表后没清空、留言没有出现在列表中、没有“已发表”的提示），有一个要仔细检查数据才能发现（没有去掉首尾空白：`toHaveTextContent` 默认会忽略首尾的空白，要比较 `textContent`），还有几个只有特定的用户才会遇到：

- **标签没有关联**：视力正常的用户看到“留言”两个字就在输入框旁边，读屏软件却读不出输入框的名字。`getByRole('textbox', { name: '留言' })` 找不到它，所以几乎所有的测试都会失败，这正是“按角色和名字查找”的价值；
- **没有标记 `aria-invalid`**：提示文字变红了，读屏软件的用户却不知道这里有错误。`toBeInvalid()` 检查的就是这个；
- **焦点没有回到输入框**：键盘用户发表一条之后，想接着输入下一条，却发现焦点停在按钮上。

这些都是 d04 讲过的可访问性要求。测试从用户的角度去写（角色、名字、焦点），自然就覆盖了它们。

测试中只用了 `screen` 查找，没有用任何 class 或 id：如果把提示的 `<p>` 换成 `<span>`、给按钮换个样式，测试都不需要修改。
:::

:::variant{kind=alt name=label-and-keyboard}
```ts file=comment-box.test.ts
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';

test('剩余字数、空白、超出', async () => {
  const user = userEvent.setup();
  const input = screen.getByLabelText('留言');
  const button = screen.getByRole('button', { name: '发表' });
  expect(screen.getByText(/还可以输入 20 个字/)).toBeVisible();

  await user.type(input, ' ');
  expect(button).toBeDisabled();

  await user.clear(input);
  await user.type(input, '一二三四五六七八九十一二三四五六七八九十多');
  expect(screen.getByText('超出 1 个字')).toBeVisible();
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(button).toBeDisabled();

  await user.keyboard('{Backspace}');
  expect(screen.getByText('还可以输入 0 个字')).toBeVisible();
  expect(button).toBeEnabled();
});

test('发表之后', async () => {
  const user = userEvent.setup();
  const input = screen.getByLabelText('留言');
  await user.type(input, ' 第一条  ');
  await user.click(screen.getByRole('button', { name: '发表' }));
  // textContent 保留空白：toHaveTextContent 默认会忽略首尾的空白，发现不了“没有去掉空白”
  expect(screen.getByRole('listitem').textContent).toBe('第一条');
  expect(screen.getByRole('status')).toHaveTextContent('已发表');
  expect(input).toHaveValue('');
  expect(document.activeElement).toBe(input);
});
```
:::

:::variant{kind=wrong name=happy-path-only fails=mutants misses=allows-blank,allows-over-limit,focus-lost,no-aria-invalid,not-cleared,no-trim,no-status reason="只测试了一开始的提示和正常的发表：空白、超出字数、首尾的空白、发表之后的状态都没有检查"}
```ts file=comment-box.test.ts
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';

test('一开始的提示', () => {
  expect(screen.getByText('还可以输入 20 个字')).toBeInTheDocument();
});

test('发表一条留言', async () => {
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: '留言' }), '你好');
  await user.click(screen.getByRole('button', { name: '发表' }));
  expect(within(screen.getByRole('list', { name: '全部留言' })).getByText('你好')).toBeInTheDocument();
});
```
:::

:::variant{kind=wrong name=getby-for-absence fails=tests reason="用 getByText 检查“还没有已发表的提示”：找不到时 getBy 直接抛出错误，要用 queryBy"}
```ts file=comment-box.test.ts
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';

test('一开始没有“已发表”', () => {
  expect(screen.getByText('已发表')).not.toBeInTheDocument();
});

test('发表之后清空', async () => {
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: '留言' }), '你好');
  await user.click(screen.getByRole('button', { name: '发表' }));
  expect(screen.getByRole('textbox', { name: '留言' })).toHaveValue('');
});
```
:::
