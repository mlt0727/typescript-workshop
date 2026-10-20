---
kind: challenge
title: 可以结束的投票卡片
---
完成一个投票卡片（页面结构见只读的 `index.html`）：

1. 点击三个选项按钮之一，该选项票数加 1，并把 `#result` 的文字更新为固定顺序的汇总，例如：`TypeScript 2 · JavaScript 0 · Python 1`。每个按钮的 `data-option` 属性给出选项名。
2. 选项按钮里有一个 `<span>` 图标。**点击图标也必须算作给这个按钮投票。**
3. 点击 `#close`（结束投票）后：之后再点选项按钮不再计票；`#result` 末尾追加 `（已结束）`，例如 `TypeScript 2 · JavaScript 0 · Python 1（已结束）`；`#close` 按钮变为禁用。
4. 页面加载后 `#result` 立即显示 `TypeScript 0 · JavaScript 0 · Python 0`。

不使用 `any`、类型断言或非空断言。

:::files{role=support}
```html file=index.html readonly
<!doctype html>
<html lang="zh-CN">
  <body>
    <section id="poll" aria-label="你最想先学哪门语言？">
      <button type="button" data-option="TypeScript"><span class="icon">🟦</span> TypeScript</button>
      <button type="button" data-option="JavaScript"><span class="icon">🟨</span> JavaScript</button>
      <button type="button" data-option="Python"><span class="icon">🐍</span> Python</button>
    </section>
    <p id="result" role="status"></p>
    <button id="close" type="button">结束投票</button>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
:::

:::files{role=starter}
```ts file=main.ts
const OPTIONS = ['TypeScript', 'JavaScript', 'Python'];

// 提示：可以用 document.querySelectorAll('#poll button') 取得所有选项按钮
```
:::

:::files{role=solution}
```ts file=main.ts
const OPTIONS = ['TypeScript', 'JavaScript', 'Python'];

const result = document.querySelector('#result');
const closeButton = document.querySelector('#close');
if (!(result instanceof HTMLParagraphElement) || !(closeButton instanceof HTMLButtonElement)) {
  throw new Error('页面结构不完整');
}

const votes = new Map<string, number>();
for (const option of OPTIONS) votes.set(option, 0);

function render(closed: boolean): string {
  const summary = OPTIONS.map((o) => `${o} ${votes.get(o) ?? 0}`).join(' · ');
  return closed ? `${summary}（已结束）` : summary;
}

const controller = new AbortController();

for (const button of document.querySelectorAll('#poll button')) {
  if (!(button instanceof HTMLButtonElement)) continue;
  button.addEventListener(
    'click',
    () => {
      const option = button.dataset.option;
      if (option === undefined) return;
      votes.set(option, (votes.get(option) ?? 0) + 1);
      result.textContent = render(false);
    },
    { signal: controller.signal },
  );
}

closeButton.addEventListener('click', () => {
  controller.abort();
  closeButton.disabled = true;
  result.textContent = render(true);
});

result.textContent = render(false);
```
:::

:::files{role=tests}
```ts file=poll.test.ts
import { expect, test } from 'vitest';
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

const result = () => screen.getByRole('status');
const option = (name: string) => screen.getByRole('button', { name: new RegExp(name) });

test('页面加载后显示初始汇总', () => {
  expect(result()).toHaveTextContent('TypeScript 0 · JavaScript 0 · Python 0');
});

test('点击选项按钮计票', async () => {
  const user = userEvent.setup();
  await user.click(option('TypeScript'));
  await user.click(option('TypeScript'));
  await user.click(option('Python'));
  expect(result()).toHaveTextContent('TypeScript 2 · JavaScript 0 · Python 1');
});

test('点击按钮里的图标同样计票', async () => {
  const user = userEvent.setup();
  const icon = option('JavaScript').querySelector('.icon');
  if (!(icon instanceof HTMLElement)) throw new Error('找不到图标');
  await user.click(icon);
  expect(result()).toHaveTextContent('TypeScript 0 · JavaScript 1 · Python 0');
});

test('结束后不再计票，并显示已结束、禁用结束按钮', async () => {
  const user = userEvent.setup();
  await user.click(option('Python'));
  await user.click(screen.getByRole('button', { name: '结束投票' }));
  await user.click(option('Python'));
  await user.click(option('TypeScript'));
  expect(result()).toHaveTextContent('TypeScript 0 · JavaScript 0 · Python 1（已结束）');
  expect(screen.getByRole('button', { name: '结束投票' })).toBeDisabled();
});

test('每个选项只有一个监听器（一次点击只加一票）', async () => {
  const user = userEvent.setup();
  await user.click(option('JavaScript'));
  expect(result()).toHaveTextContent('JavaScript 1');
});
```
:::

:::hint{level=1}
如果给每个选项按钮单独挂监听器，监听器里可以直接使用那个按钮变量（或 `currentTarget`），无论点中的是按钮文字还是图标，都知道是哪个选项。“结束后不再计票”可以通过移除这些监听器来实现。
:::

:::hint{level=2}
用 `for...of` 遍历 `document.querySelectorAll('#poll button')`，先用 `instanceof HTMLButtonElement` 收窄，再读 `button.dataset.option`。创建一个 `AbortController`，给每个选项监听器传 `{ signal: controller.signal }`；点击“结束投票”时调用 `controller.abort()`。票数可以存在 `Map<string, number>` 里。
:::

:::explanation
关键点有三个：

1. **用监听器所在的按钮，而不是 `event.target`**：点击图标时 `target` 是 `<span>`，它没有 `data-option`。参考答案在循环里给每个按钮单独注册监听器，监听器通过闭包直接使用 `button`，这与使用 `event.currentTarget` 等价。
2. **用 signal 统一移除**：所有选项监听器共享一个 `AbortController` 的 `signal`，结束投票时一次 `abort()` 全部移除。
3. **类型收窄而不是断言**：`querySelectorAll` 返回的元素类型是 `Element`，用 `instanceof HTMLButtonElement` 收窄后才能读 `dataset` 与设置 `disabled`。

另一种可行写法是只在 `#poll` 上挂一个监听器，用 `event.target` 加 `closest('button')` 找到按钮——这就是下一课的“事件委托”。
:::

:::variant{kind=alt name=delegation-with-closest}
```ts file=main.ts
const OPTIONS = ['TypeScript', 'JavaScript', 'Python'];

const poll = document.querySelector('#poll');
const result = document.querySelector('#result');
const closeButton = document.querySelector('#close');
if (!(poll instanceof HTMLElement) || !(result instanceof HTMLParagraphElement) || !(closeButton instanceof HTMLButtonElement)) {
  throw new Error('页面结构不完整');
}

const votes: Record<string, number> = { TypeScript: 0, JavaScript: 0, Python: 0 };
let closed = false;

function summary(): string {
  return OPTIONS.map((o) => `${o} ${votes[o] ?? 0}`).join(' · ');
}

poll.addEventListener('click', (event) => {
  if (closed || !(event.target instanceof Element)) return;
  const button = event.target.closest('button');
  const option = button?.dataset.option;
  if (option === undefined || !(option in votes)) return;
  votes[option] = (votes[option] ?? 0) + 1;
  result.textContent = summary();
});

closeButton.addEventListener('click', () => {
  closed = true;
  closeButton.disabled = true;
  result.textContent = `${summary()}（已结束）`;
});

result.textContent = summary();
```
:::

:::variant{kind=wrong name=uses-target fails=tests reason="读取 event.target 的 data-option：点中图标时 target 是 span，票投不进去"}
```ts file=main.ts
const OPTIONS = ['TypeScript', 'JavaScript', 'Python'];

const result = document.querySelector('#result');
const closeButton = document.querySelector('#close');
if (!(result instanceof HTMLParagraphElement) || !(closeButton instanceof HTMLButtonElement)) {
  throw new Error('页面结构不完整');
}

const votes = new Map<string, number>(OPTIONS.map((o) => [o, 0]));
const render = (closed: boolean) =>
  OPTIONS.map((o) => `${o} ${votes.get(o) ?? 0}`).join(' · ') + (closed ? '（已结束）' : '');
const controller = new AbortController();

for (const button of document.querySelectorAll('#poll button')) {
  button.addEventListener(
    'click',
    (event) => {
      if (!(event.target instanceof HTMLElement)) return;
      const option = event.target.dataset.option;
      if (option === undefined) return;
      votes.set(option, (votes.get(option) ?? 0) + 1);
      result.textContent = render(false);
    },
    { signal: controller.signal },
  );
}

closeButton.addEventListener('click', () => {
  controller.abort();
  closeButton.disabled = true;
  result.textContent = render(true);
});

result.textContent = render(false);
```
:::

:::variant{kind=wrong name=close-only-disables fails=tests reason="结束后只禁用了按钮，没有移除计票监听器"}
```ts file=main.ts
const OPTIONS = ['TypeScript', 'JavaScript', 'Python'];

const result = document.querySelector('#result');
const closeButton = document.querySelector('#close');
if (!(result instanceof HTMLParagraphElement) || !(closeButton instanceof HTMLButtonElement)) {
  throw new Error('页面结构不完整');
}

const votes = new Map<string, number>(OPTIONS.map((o) => [o, 0]));
const render = (closed: boolean) =>
  OPTIONS.map((o) => `${o} ${votes.get(o) ?? 0}`).join(' · ') + (closed ? '（已结束）' : '');

for (const button of document.querySelectorAll('#poll button')) {
  if (!(button instanceof HTMLButtonElement)) continue;
  button.addEventListener('click', () => {
    const option = button.dataset.option;
    if (option === undefined) return;
    votes.set(option, (votes.get(option) ?? 0) + 1);
    result.textContent = render(false);
  });
}

closeButton.addEventListener('click', () => {
  closeButton.disabled = true;
  result.textContent = render(true);
});

result.textContent = render(false);
```
:::

:::variant{kind=wrong name=asserted-elements fails=rules reason="用 as 断言元素类型，而不是用 instanceof 收窄"}
```ts file=main.ts
const OPTIONS = ['TypeScript', 'JavaScript', 'Python'];

const result = document.querySelector('#result') as HTMLParagraphElement;
const closeButton = document.querySelector('#close') as HTMLButtonElement;

const votes = new Map<string, number>(OPTIONS.map((o) => [o, 0]));
const render = (closed: boolean) =>
  OPTIONS.map((o) => `${o} ${votes.get(o) ?? 0}`).join(' · ') + (closed ? '（已结束）' : '');
const controller = new AbortController();

for (const button of document.querySelectorAll<HTMLButtonElement>('#poll button')) {
  button.addEventListener(
    'click',
    () => {
      const option = button.dataset.option;
      if (option === undefined) return;
      votes.set(option, (votes.get(option) ?? 0) + 1);
      result.textContent = render(false);
    },
    { signal: controller.signal },
  );
}

closeButton.addEventListener('click', () => {
  controller.abort();
  closeButton.disabled = true;
  result.textContent = render(true);
});

result.textContent = render(false);
```
:::
