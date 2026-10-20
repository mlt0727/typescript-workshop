---
kind: task
title: 从页面读取设置
---
页面上有一个设置表单（只读）。在 `settings.ts` 中实现 `readSettings()`，从页面读取当前的设置：

| 字段 | 来源 |
| --- | --- |
| `nickname` | `#nickname` 输入框的值，去掉首尾空白 |
| `volume` | `#volume` 滑块的值，**数字** |
| `muted` | `#muted` 复选框是否勾选 |
| `theme` | `#theme` 下拉选择的值 |
| `topics` | `#topics` **里面**被勾选的复选框的 `value`，按页面中的顺序 |

如果 `#nickname`、`#volume`、`#muted`、`#theme`、`#topics` 中任何一个不存在，或者不是预期的元素类型（前三个是 `<input>`，`#theme` 是 `<select>`），抛出一个 `Error`，消息中包含这个选择器（例如 `#volume`）。

起始代码用断言让编译器闭嘴：判题规则会拒绝它，元素缺失时它也会在别处莫名其妙地出错。`main.ts`（只读）在点击“显示设置”时调用你的函数。

:::files{role=support}
```html file=index.html readonly
<!doctype html>
<html lang="zh-CN">
  <body>
    <form id="settings">
      <p><label for="nickname">昵称</label> <input id="nickname" value="Ada" /></p>
      <p><label for="volume">音量</label> <input id="volume" type="range" min="0" max="100" value="60" /></p>
      <p><label><input id="muted" type="checkbox" /> 静音</label></p>
      <p>
        <label for="theme">主题</label>
        <select id="theme">
          <option value="light">浅色</option>
          <option value="dark" selected>深色</option>
        </select>
      </p>
      <fieldset id="topics">
        <legend>感兴趣的主题</legend>
        <label><input type="checkbox" value="types" checked /> 类型</label>
        <label><input type="checkbox" value="dom" /> DOM</label>
        <label><input type="checkbox" value="async" checked /> 异步</label>
      </fieldset>
    </form>
    <button type="button" id="show">显示设置</button>
    <pre id="output"></pre>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=main.ts readonly
import { readSettings } from './settings';

const show = document.querySelector('#show');
const output = document.querySelector('#output');
if (!(show instanceof HTMLButtonElement) || !(output instanceof HTMLPreElement)) {
  throw new Error('页面结构不完整');
}

show.addEventListener('click', () => {
  output.textContent = JSON.stringify(readSettings(), null, 2);
});
```
:::

:::files{role=starter}
```ts file=settings.ts
export type Settings = {
  nickname: string;
  volume: number;
  muted: boolean;
  theme: string;
  topics: string[];
};

export function readSettings(): Settings {
  const nickname = document.querySelector<HTMLInputElement>('#nickname')!;
  const volume = document.querySelector('#volume') as HTMLInputElement;
  const muted = document.querySelector('#muted') as HTMLInputElement;
  const theme = document.querySelector('#theme') as HTMLSelectElement;
  return {
    nickname: nickname.value,
    volume: Number(volume.value),
    muted: muted.checked,
    theme: theme.value,
    topics: [],
  };
}
```
:::

:::files{role=solution}
```ts file=settings.ts
export type Settings = {
  nickname: string;
  volume: number;
  muted: boolean;
  theme: string;
  topics: string[];
};

function input(selector: string): HTMLInputElement {
  const el = document.querySelector(selector);
  if (!(el instanceof HTMLInputElement)) {
    throw new Error(`找不到输入框 ${selector}`);
  }
  return el;
}

export function readSettings(): Settings {
  const theme = document.querySelector('#theme');
  if (!(theme instanceof HTMLSelectElement)) {
    throw new Error('找不到下拉选择 #theme');
  }
  const topicsBox = document.querySelector('#topics');
  if (topicsBox === null) {
    throw new Error('找不到 #topics');
  }

  const topics: string[] = [];
  for (const box of topicsBox.querySelectorAll('input[type="checkbox"]')) {
    if (box instanceof HTMLInputElement && box.checked) {
      topics.push(box.value);
    }
  }

  return {
    nickname: input('#nickname').value.trim(),
    volume: input('#volume').valueAsNumber,
    muted: input('#muted').checked,
    theme: theme.value,
    topics: topics,
  };
}
```
:::

:::files{role=tests}
```ts file=settings.test.ts
import { expect, test } from 'vitest';
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { readSettings } from './settings';

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`测试页面缺少 #${id}`);
  return el;
}

test('读取默认值', () => {
  expect(readSettings()).toEqual({ nickname: 'Ada', volume: 60, muted: false, theme: 'dark', topics: ['types', 'async'] });
});

test('读取用户修改后的值', async () => {
  const user = userEvent.setup();
  const nickname = screen.getByLabelText('昵称');
  await user.clear(nickname);
  await user.type(nickname, '  Grace  ');
  const volume = byId('volume');
  if (volume instanceof HTMLInputElement) volume.value = '25';
  await user.click(screen.getByLabelText('静音'));
  await user.selectOptions(screen.getByLabelText('主题'), 'light');
  await user.click(screen.getByLabelText('DOM'));
  await user.click(screen.getByLabelText('类型'));
  expect(readSettings()).toEqual({ nickname: 'Grace', volume: 25, muted: true, theme: 'light', topics: ['dom', 'async'] });
});

test('只读取 #topics 里面的复选框', async () => {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText('静音'));
  const outside = document.createElement('input');
  outside.type = 'checkbox';
  outside.value = 'outside';
  outside.checked = true;
  document.body.append(outside);
  expect(readSettings().topics).toEqual(['types', 'async']);
});

test.each([['volume'], ['theme'], ['topics'], ['nickname']])('#%s 不存在时抛出错误，并指出选择器', (id) => {
  byId(id).remove();
  expect(() => readSettings()).toThrow(`#${id}`);
});

test('元素类型不对时抛出错误', () => {
  const span = document.createElement('span');
  span.id = 'muted';
  byId('muted').replaceWith(span);
  expect(() => readSettings()).toThrow('#muted');
});

test('“显示设置”按钮显示结果', async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '显示设置' }));
  expect(byId('output')).toHaveTextContent('"theme": "dark"');
});
```
:::

:::hint{level=1}
每个元素都先查询、再用 `instanceof` 检查：`#nickname`、`#volume`、`#muted` 用 `HTMLInputElement`，`#theme` 用 `HTMLSelectElement`。三个输入框的检查一模一样，可以写一个小函数 `input(selector)`，在检查失败时抛出带选择器的错误。
:::

:::hint{level=2}
主题标签：先找到 `#topics`，再用 `topicsBox.querySelectorAll('input[type="checkbox"]')` **只在它里面**查找，逐个收窄并检查 `checked`。滑块的数字用 `valueAsNumber`（或者 `Number(value)`）。
:::

:::explanation
`instanceof` 一次排除了两种情况：元素不存在（`null instanceof HTMLInputElement` 是 `false`）和元素类型不对。检查之后，TypeScript 知道它是 `HTMLInputElement`，`.value`、`.checked`、`.valueAsNumber` 都可以放心使用。把重复的检查写成 `input(selector)` 这样的小函数，错误消息里带上选择器，出问题时一眼就能看出是哪个元素。

起始代码的三种写法（泛型参数、`as`、`!`）都只是告诉编译器“相信我”。测试里删掉 `#volume` 之后，起始代码会在读取 `volume.value` 时抛出 `TypeError: Cannot read properties of null`，完全看不出是哪个元素出了问题。

`topicsBox.querySelectorAll(…)` 只在 `#topics` 内部查找。如果写成 `document.querySelectorAll('input[type="checkbox"]:checked')`，“静音”复选框以及页面上其他的复选框也会被算进去。`querySelectorAll` 的选择器不是标签名，所以每个元素都是 `Element`，同样需要收窄。
:::

:::variant{kind=alt name=get-element-by-id-and-checked-selector}
```ts file=settings.ts
export type Settings = {
  nickname: string;
  volume: number;
  muted: boolean;
  theme: string;
  topics: string[];
};

function inputById(id: string): HTMLInputElement {
  const el = document.getElementById(id);
  if (el instanceof HTMLInputElement) return el;
  throw new Error(`#${id} 不存在或不是 <input>`);
}

export function readSettings(): Settings {
  const theme = document.getElementById('theme');
  const topicsBox = document.getElementById('topics');
  if (!(theme instanceof HTMLSelectElement)) throw new Error('#theme 不存在或不是 <select>');
  if (!topicsBox) throw new Error('#topics 不存在');
  return {
    nickname: inputById('nickname').value.trim(),
    volume: Number(inputById('volume').value),
    muted: inputById('muted').checked,
    theme: theme.value,
    topics: [...topicsBox.querySelectorAll('input:checked')].flatMap((el) => (el instanceof HTMLInputElement ? [el.value] : [])),
  };
}
```
:::

:::variant{kind=wrong name=document-wide-checkboxes fails=tests reason="在整个页面里找勾选的复选框，把“静音”和 #topics 外面的复选框也算了进去"}
```ts file=settings.ts
export type Settings = {
  nickname: string;
  volume: number;
  muted: boolean;
  theme: string;
  topics: string[];
};

function input(selector: string): HTMLInputElement {
  const el = document.querySelector(selector);
  if (!(el instanceof HTMLInputElement)) throw new Error(`找不到输入框 ${selector}`);
  return el;
}

export function readSettings(): Settings {
  const theme = document.querySelector('#theme');
  if (!(theme instanceof HTMLSelectElement)) throw new Error('找不到下拉选择 #theme');
  if (document.querySelector('#topics') === null) throw new Error('找不到 #topics');
  const topics: string[] = [];
  for (const box of document.querySelectorAll('input[type="checkbox"]')) {
    if (box instanceof HTMLInputElement && box.checked) topics.push(box.value);
  }
  return {
    nickname: input('#nickname').value.trim(),
    volume: input('#volume').valueAsNumber,
    muted: input('#muted').checked,
    theme: theme.value,
    topics,
  };
}
```
:::

:::variant{kind=wrong name=null-check-only fails=types reason="只检查了 null，没有收窄成具体的元素类型，读取 value、checked 时类型报错"}
```ts file=settings.ts
export type Settings = {
  nickname: string;
  volume: number;
  muted: boolean;
  theme: string;
  topics: string[];
};

function element(selector: string): Element {
  const el = document.querySelector(selector);
  if (el === null) throw new Error(`找不到 ${selector}`);
  return el;
}

export function readSettings(): Settings {
  const topics: string[] = [];
  for (const box of element('#topics').querySelectorAll('input:checked')) {
    if (box instanceof HTMLInputElement) topics.push(box.value);
  }
  return {
    nickname: element('#nickname').value.trim(),
    volume: element('#volume').valueAsNumber,
    muted: element('#muted').checked,
    theme: element('#theme').value,
    topics,
  };
}
```
:::

:::variant{kind=wrong name=silent-defaults fails=tests reason="元素缺失时悄悄使用了默认值，而不是报错"}
```ts file=settings.ts
export type Settings = {
  nickname: string;
  volume: number;
  muted: boolean;
  theme: string;
  topics: string[];
};

function input(selector: string): HTMLInputElement | null {
  const el = document.querySelector(selector);
  return el instanceof HTMLInputElement ? el : null;
}

export function readSettings(): Settings {
  const theme = document.querySelector('#theme');
  const topics: string[] = [];
  for (const box of document.querySelectorAll('#topics input:checked')) {
    if (box instanceof HTMLInputElement) topics.push(box.value);
  }
  return {
    nickname: input('#nickname')?.value.trim() ?? '',
    volume: input('#volume')?.valueAsNumber ?? 50,
    muted: input('#muted')?.checked ?? false,
    theme: theme instanceof HTMLSelectElement ? theme.value : 'light',
    topics,
  };
}
```
:::

:::variant{kind=wrong name=volume-as-string fails=types reason="音量直接用了字符串 value，类型与 Settings 不符"}
```ts file=settings.ts
export type Settings = {
  nickname: string;
  volume: number;
  muted: boolean;
  theme: string;
  topics: string[];
};

function input(selector: string): HTMLInputElement {
  const el = document.querySelector(selector);
  if (!(el instanceof HTMLInputElement)) throw new Error(`找不到输入框 ${selector}`);
  return el;
}

export function readSettings(): Settings {
  const theme = document.querySelector('#theme');
  if (!(theme instanceof HTMLSelectElement)) throw new Error('找不到下拉选择 #theme');
  const topicsBox = document.querySelector('#topics');
  if (topicsBox === null) throw new Error('找不到 #topics');
  const topics: string[] = [];
  for (const box of topicsBox.querySelectorAll('input:checked')) {
    if (box instanceof HTMLInputElement) topics.push(box.value);
  }
  return {
    nickname: input('#nickname').value.trim(),
    volume: input('#volume').value,
    muted: input('#muted').checked,
    theme: theme.value,
    topics,
  };
}
```
:::
