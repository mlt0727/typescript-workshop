---
version: 1
mode: dom
estimatedMinutes: 40
review: self-reviewed
problem: 请求数据需要时间，也可能失败，还可能成功但什么都没有。一个只考虑“成功”的界面，在网络慢时一片空白，出错时毫无反应，用户不知道发生了什么，只好反复点击。这一课把一次请求的生命周期建模成可辨识联合：等待、加载中、失败、成功（包括“结果为空”），并为每一种状态给出清楚、可访问的界面。
objectives:
  - 用可辨识联合描述请求的状态，避免用多个布尔值表示状态带来的“不可能的组合”
  - 为加载中、失败、空结果、成功分别渲染界面，并用穷尽检查保证每种状态都处理了
  - 把请求、验证和状态更新串成一个流程，区分网络错误、HTTP 错误和数据格式错误
  - 让状态变化对辅助技术可见：role="status"、role="alert"、aria-busy，以及加载期间防止重复提交
references:
  - title: Discriminated unions（Narrowing）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions
    checked: 2026-10-20
  - title: ARIA live regions — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions
    checked: 2026-10-20
  - title: aria-busy — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-busy
    checked: 2026-10-20
---

## 一次请求的几种状态

一次请求从发出到结束，界面要经历几种状态：还没开始、加载中、失败、成功。成功时又分为“有数据”和“结果为空”两种情况，界面上通常要区别对待。

一种常见但容易出错的写法是用几个独立的变量：

```ts
let isLoading = false;
let error: string | null = null;
let books: Book[] | null = null;
```

三个变量可以组合出 8 种情况，其中很多是**不可能**或者**说不清**的：`isLoading` 为 `true`、同时 `error` 也有值，是该显示加载中还是错误？每次修改都要记得同时重置另外两个，漏掉一个就会出现奇怪的界面。

用可辨识联合（b09）描述，每种状态只带它需要的数据，不可能的组合根本写不出来：

```ts
type LoadState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };
```

渲染时用 `switch (state.status)` 分别处理，并加上穷尽检查：以后增加一种状态而忘了渲染它，TypeScript 会报错。

## 让状态变化被感知

视觉上，加载中可以显示一个转圈的图标；但屏幕阅读器用户看不到它，也看不到结果出现在了页面的某个角落。几个工具：

- **`role="status"`**：这个元素的内容变化时，屏幕阅读器会在不打断用户的情况下读出来，适合“正在加载…”“找到 2 本书”。这个元素要**一直在页面上**（写在 HTML 里），之后只改变它的文字：新插入的状态元素很可能不会被读出（d09 讲过）；
- **`role="alert"`**：内容会被立即读出，适合错误信息，新插入的 alert 通常也会被读出；
- **`aria-busy="true"`**：告诉辅助技术这块区域正在更新，等它变回 `false` 再读取内容。只把它放在结果区域上，状态提示要放在这块区域之外，否则“正在加载…”也会被推迟；
- **防止重复提交**：加载期间，“搜索”按钮应该显示为不可用，并且忽略再次提交。直接设置 `disabled` 有个问题：正获得焦点的按钮被禁用后，焦点会离开它（`document.activeElement` 变成 `<body>`），焦点指示消失，读屏软件也可能失去上下文。所以这里用 `aria-disabled="true"`：读屏软件会读出“不可用”，焦点保留在按钮上；代码里再检查状态，忽略加载期间的提交（下一课还会讲取消旧请求的办法）。

另外，失败时要给出**下一步**：说明出了什么问题，并提供“重试”按钮，而不是只显示一句“出错了”。

:::playground{#states fixtures=books}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <form id="search">
      <label for="topic">主题</label>
      <select id="topic">
        <option value="typescript">TypeScript（成功）</option>
        <option value="cobol">COBOL（结果为空）</option>
        <option value="broken">服务器出错</option>
        <option value="offline">网络断开</option>
      </select>
      <button>搜索</button>
    </form>
    <p id="status" role="status"></p>
    <section id="results"></section>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```css file=style.css
[aria-busy='true'] { opacity: 0.6; }
[aria-disabled='true'] { opacity: 0.6; cursor: not-allowed; }
.error { color: #b00020; }
```
```ts file=main.ts
type Book = { id: number; title: string };
type LoadState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

const form = document.querySelector('#search');
const topic = document.querySelector('#topic');
const statusLine = document.querySelector('#status');
const results = document.querySelector('#results');
const button = form?.querySelector('button');
if (!(form instanceof HTMLFormElement) || !(topic instanceof HTMLSelectElement) || !(statusLine instanceof HTMLElement) || !(results instanceof HTMLElement) || !button) {
  throw new Error('页面结构不完整');
}

let state: LoadState<Book[]> = { status: 'idle' };

const isBook = (value: unknown): value is Book =>
  typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'number' && 'title' in value && typeof value.title === 'string';

const render = (): void => {
  results.setAttribute('aria-busy', String(state.status === 'loading'));
  button.setAttribute('aria-disabled', String(state.status === 'loading'));
  switch (state.status) {
    case 'idle':
      statusLine.textContent = '';
      results.replaceChildren(Object.assign(document.createElement('p'), { textContent: '选择一个主题，然后点“搜索”。' }));
      break;
    case 'loading':
      statusLine.textContent = '正在加载…';
      break;
    case 'error': {
      statusLine.textContent = '';
      const alert = Object.assign(document.createElement('p'), { textContent: `加载失败：${state.message}`, className: 'error' });
      alert.setAttribute('role', 'alert');
      results.replaceChildren(alert);
      break;
    }
    case 'success': {
      statusLine.textContent = state.data.length === 0 ? '没有找到相关的书。' : `找到 ${state.data.length} 本书`;
      const list = document.createElement('ul');
      list.append(...state.data.map((book) => Object.assign(document.createElement('li'), { textContent: book.title })));
      results.replaceChildren(...(state.data.length === 0 ? [] : [list]));
      break;
    }
    default: {
      const unreachable: never = state;
      throw new Error(`未处理的状态：${JSON.stringify(unreachable)}`);
    }
  }
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (state.status === 'loading') return;
  state = { status: 'loading' };
  render();
  try {
    const response = await fetch(`/api/books?topic=${encodeURIComponent(topic.value)}`);
    if (!response.ok) throw new Error(`服务器返回 ${response.status}`);
    const data: unknown = await response.json();
    state = { status: 'success', data: Array.isArray(data) ? data.filter(isBook) : [] };
  } catch (err) {
    state = { status: 'error', message: err instanceof Error ? err.message : String(err) };
  }
  render();
});

render();
```
- 依次选择四个主题并搜索：每次都先看到“正在加载…”（上一次的结果变淡，按钮显示为不可用），然后是列表、空结果提示或错误信息。加载期间再点“搜索”不会有反应。
- 第 2–6 行：状态的类型。第 22–52 行的 `render` 为每种状态更新界面，`default` 分支是穷尽检查。
- 第 23–24 行：`aria-busy` 只设在 `#results` 上（`#status` 是一直在页面上的 `role="status"` 元素，写在 HTML 里、位于 `#results` 之外，只改变它的文字）；按钮用 `aria-disabled` 标记为不可用，焦点不会丢失。
- 第 54–68 行：一次加载的完整流程：先进入 `loading` 并渲染，然后等待结果，无论成功还是失败，最后都更新状态并再渲染一次。第 56 行忽略加载期间的重复提交。
- 选“网络断开”时，界面显示的是原始的 `Failed to fetch`（这是 Chrome 和本平台模拟器的文字，Firefox 是 `NetworkError when attempting to fetch resource.`，Safari 是 `Load failed`）：这对用户没有意义，下一节讲怎样把它翻译成有用的提示。第 19–20 行的验证也很简单，练习中会用 e06 的方法逐项验证并给出明确的错误。
:::

## 区分失败的原因

“加载失败”对用户帮助不大。e05 讲过，失败有几种不同的原因，给出的建议也不同：

| 原因 | 判断方式 | 给用户的提示 |
| --- | --- | --- |
| 网络断开 | `fetch` 被拒绝（`TypeError`） | 网络连接失败，请检查网络后重试 |
| 服务器出错 | `response.ok` 为 `false`，5xx | 服务器暂时出了问题，请稍后重试 |
| 请求有问题 | 4xx，例如 404 | 根据具体情况说明，例如“找不到这本书” |
| 数据格式不对 | 解析或验证失败（e06） | 数据格式不正确（同时记录日志，这通常是程序的 bug） |

挑战题会实现这样的区分。

::exercise{#load-state-render}

## 编程挑战

::exercise{#book-search}

::quiz

## 常见错误

- **用多个布尔值表示状态**：会出现“既在加载又出错”的组合。用可辨识联合。
- **只处理成功**：网络慢时界面空白，出错时没有任何反应。
- **把“结果为空”当作成功的列表直接渲染**：用户看到一片空白，不知道是没有结果还是还没加载完。
- **加载中不防止重复提交**：用户重复点击，发出多个请求，结果可能乱序到达（下一课）。用 `aria-disabled` 标记按钮，并在代码里忽略重复的提交。
- **每次渲染都新插入一个 `role="status"` 元素**：很可能不会被读出。把它写在 HTML 里，只改变文字。
- **错误只显示“出错了”**：说明原因，并提供重试的方式。

## 下一步

下一课处理更棘手的情况：请求还没回来用户就切换了主题，旧的结果晚到了一步，覆盖了新的结果。用 `AbortController` 取消过时的请求。
