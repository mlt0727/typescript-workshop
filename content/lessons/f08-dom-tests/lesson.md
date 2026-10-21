---
version: 1
mode: dom
estimatedMinutes: 60
review: self-reviewed
problem: 页面上的功能，最终是由用户的点击和输入来使用的：找到“保存”按钮，在“名字”输入框中打字，看到“已保存”的提示。如果测试直接读取组件内部的变量、按 class 名去找元素，重构一次 CSS 或者换一种状态管理，测试就会大面积失败，而真正的 bug（例如按钮没有可访问的名字，读屏软件的用户找不到它）却发现不了。这一课用 Testing Library 像用户一样测试页面：按角色和名字查找元素，用 user-event 模拟真实的输入，用 jest-dom 的匹配器检查用户能感知到的结果。
objectives:
  - 按 Testing Library 推荐的优先级查找元素（getByRole 加 name、getByLabelText……），区分 getBy、queryBy、findBy
  - 用 user-event 模拟点击、输入、键盘操作，用 jest-dom 的匹配器检查文字、状态、可访问的名字与焦点
  - 测试用户能看到的行为而不是实现细节，处理异步出现的内容
  - 在本机为 Vitest 配置 jsdom 环境和 jest-dom，运行 DOM 测试
references:
  - title: Guiding Principles — Testing Library
    url: https://testing-library.com/docs/guiding-principles
    checked: 2026-10-20
  - title: About Queries（Priority）— Testing Library
    url: https://testing-library.com/docs/queries/about
    checked: 2026-10-20
  - title: user-event v14 — Testing Library
    url: https://testing-library.com/docs/user-event/intro
    checked: 2026-10-20
  - title: jest-dom — GitHub
    url: https://github.com/testing-library/jest-dom
    checked: 2026-10-20
  - title: Test Environment — Vitest
    url: https://vitest.dev/guide/environment
    checked: 2026-10-20
---

## 像用户一样测试

Testing Library 的指导原则只有一句话：测试越接近软件被使用的方式，就越能给你信心。用户不知道你的元素有什么 class、组件内部的 state 叫什么名字；他们看到的是按钮上的文字、输入框旁边的标签、出现的提示。读屏软件的用户“看到”的则是**可访问性树**：每个元素的角色（按钮、文本框、复选框……）和名字（d04 讲过）。

所以 Testing Library 推荐按这个顺序查找元素：

1. `getByRole('button', { name: '保存' })`：角色加可访问的名字，最接近用户和读屏软件的视角，**首选**；
2. `getByLabelText('名字')`：表单控件，按它的标签找；
3. `getByPlaceholderText`、`getByText`、`getByDisplayValue`：没有合适的角色时；
4. `getByAltText`、`getByTitle`；
5. `getByTestId`：最后的手段，用户看不到 `data-testid`。

按角色查找还顺便测试了可访问性：如果按钮是一个没有文字的图标，`getByRole('button', { name: '删除' })` 就找不到它，测试失败，提醒你加上 `aria-label`。

## get、query、find

| 前缀 | 找不到时 | 找到多个时 | 用途 |
| --- | --- | --- | --- |
| `getBy…` | 抛出错误 | 抛出错误 | 元素应该已经存在 |
| `queryBy…` | 返回 `null` | 抛出错误 | 检查元素**不存在**：`expect(screen.queryByRole('alert')).toBeNull()` |
| `findBy…` | 等待，超时（默认 1000 毫秒）后拒绝 | 拒绝 | 元素会在之后出现（请求完成、计时器到期），要 `await` |
| `getAllBy…` 等 | | 返回数组 | 一组元素，例如列表中的每一项 |

`getBy…` 找不到元素时，错误信息会列出页面上所有可访问的元素和它们的名字。下面是本机运行时实际得到的（节选）：

```text
TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "保存"

Here are the accessible roles:

  button:

  Name "问好":
  <button
    type="button"
  />

  textbox:

  Name "名字":
  <input
    aria-label="名字"
  />
```

读这份列表，通常一眼就能看出是名字写错了，还是元素根本没有这个角色。`screen` 代表整个 `document.body`；只在某个区域中查找时用 `within(元素)`，例如 `within(screen.getByRole('list')).getAllByRole('listitem')`。

## user-event 与 jest-dom

`@testing-library/user-event` 模拟真实的用户操作：`user.type(输入框, '你好')` 会依次触发焦点、每个字符的键盘事件和 `input` 事件，和用户真的在键盘上打字一样；点击被禁用的按钮不会触发 `click` 事件，元素的 CSS 是 `pointer-events: none` 时 `user.click` 会直接报错，这些都和真实的浏览器一致。

```ts
const user = userEvent.setup(); // 每个测试开始时创建
await user.type(screen.getByRole('textbox', { name: '名字' }), 'Ada');
await user.click(screen.getByRole('button', { name: '问好' }));
await user.keyboard('{Enter}');
await user.tab(); // 按 Tab 键移动焦点
```

每个操作都要 `await`。`@testing-library/jest-dom` 提供了检查“用户能感知到的结果”的匹配器：

| 匹配器 | 检查 |
| --- | --- |
| `toBeInTheDocument()`、`toBeVisible()` | 在页面中；用户能看见（没有被 `hidden`、`display: none` 隐藏） |
| `toHaveTextContent('已保存')` | 文字（默认是“包含”，要完全相等用正则 `/^已保存$/`） |
| `toHaveValue('Ada')`、`toBeChecked()` | 表单控件的值、复选框的状态 |
| `toBeDisabled()`、`toBeEnabled()` | 是否禁用 |
| `toHaveAccessibleName('删除 TypeScript')` | 可访问的名字 |
| `toHaveFocus()` | 是否有焦点 |
| `toHaveAttribute('aria-invalid', 'true')` | 属性 |

下面这个示例是一个小组件和它的测试的雏形。它不运行测试，只运行页面：在预览中输入、点击，然后想一想，每一个你在预览中做的检查，在测试中应该写成哪一句。

:::playground{#greeting}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <div id="app"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=main.ts
const root = document.getElementById('app');
if (!root) throw new Error('缺少 #app');

root.innerHTML = `
  <label>名字 <input name="name" /></label>
  <button type="button">问好</button>
  <p role="status"></p>
`;
const input = root.querySelector('input');
const button = root.querySelector('button');
const status = root.querySelector('p');
if (!input || !button || !status) throw new Error('结构不完整');

button.addEventListener('click', () => {
  const name = input.value.trim();
  status.textContent = name === '' ? '请先输入名字' : `你好，${name}`;
});
```
- 找输入框：它有标签“名字”，所以是 `screen.getByRole('textbox', { name: '名字' })`（或 `getByLabelText('名字')`）；找按钮：`getByRole('button', { name: '问好' })`；提示：`getByRole('status')`。
- “输入 Ada 后点问好，看到你好，Ada”：`await user.type(…, 'Ada')`、`await user.click(…)`、`expect(status).toHaveTextContent('你好，Ada')`。
- 别忘了“没有输入时”的情况，以及前后的空白（` Ada `）。
:::

## 测试行为，而不是实现

无论页面是直接操作 DOM 写的，还是用 React 这样的框架写的（G 阶段），测试的都是用户能看到的行为：

- 不要读取代码内部的变量、不要按 class 名去找元素；用户点了按钮之后，检查页面上出现了什么；
- 换一种实现（用模板字符串一次生成整个列表，或者改写成 React 组件），只要页面上的角色、名字和行为不变，测试就应该仍然通过；
- 异步出现的内容用 `findBy…` 或 `waitFor` 等待。

React 组件的测试在 g15 中讲：`@testing-library/react` 的 `render(<组件 />)` 把组件渲染进页面，之后的查找和操作与本课完全一样。

## 在自己的电脑上运行

Vitest 默认在 Node.js 环境中运行测试，那里没有 `document`。DOM 测试需要一个模拟的浏览器环境，最常用的是 jsdom：

1. 安装：`npm install --save-dev jsdom @testing-library/dom @testing-library/user-event @testing-library/jest-dom`；
2. 在项目根目录创建 `vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setup-tests.ts'],
  },
});
```

3. `src/setup-tests.ts` 中只有一行：`import '@testing-library/jest-dom/vitest';`，它在每个测试文件之前运行，注册 jest-dom 的匹配器；
4. 写一个测试（例如把上面示例的逻辑放进一个 `mountGreeting(root)` 函数，在 `beforeEach` 中设置 `document.body.innerHTML` 并调用它），运行 `npx vitest run`。

这个网站上每道练习的“下载本地项目”按钮生成的就是这样配置好的项目：`setup-tests.ts` 还会在每个测试开始前把页面恢复成 `index.html` 的初始状态并重新运行 `main.ts`，和网站上一样。

jsdom 是用 JavaScript 实现的浏览器 DOM，不做页面布局（元素的尺寸都是 0），也不完全支持 CSS。需要真实浏览器的行为时，Vitest 还有“浏览器模式”，或者用下一课的 Playwright。这个网站的测试运行在你的浏览器中真实的页面上，所以布局和样式都是真的。

::exercise{#test-char-counter}

## 编程挑战

::exercise{#test-tag-input}

::quiz

## 常见错误

- **按 class 或标签名查找元素**：`container.querySelector('.btn-primary')` 在改样式时就会失效，也测不出可访问性的问题。用 `getByRole` 加 `name`。
- **用 `getBy…` 检查元素不存在**：找不到时它直接抛出错误。用 `queryBy…` 加 `toBeNull()` 或 `not.toBeInTheDocument()`。
- **异步出现的内容用 `getBy…`**：请求还没完成，元素还不存在。用 `findBy…`（并且 `await`）。
- **user-event 的操作没有 `await`**：后面的断言在操作完成之前就执行了。
- **测试组件的内部状态**：用户看不到 state。检查页面上的结果。
- **`toHaveTextContent('5')` 以为是完全相等**：它检查的是“包含”，`'15'` 也能通过。需要完全相等时用正则 `/^5$/`。
