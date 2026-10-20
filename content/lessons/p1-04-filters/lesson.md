---
version: 1
mode: dom
estimatedMinutes: 50
review: ai-draft
problem: 任务多了就需要筛选：只看标题里有“周报”的，只看带“#家”标签的。筛选条件要保存在地址中：刷新页面、按后退、把链接发给自己的另一台设备，看到的都是同一个视图（e10）。这一个里程碑先写筛选的纯函数（从地址解析、生成查询字符串、判断任务是否符合），再把它接到页面上：搜索框、可以点击的标签、“清除筛选”，以及后退和前进。
objectives:
  - 把筛选条件建模成一个类型，写出解析、生成查询参数与筛选任务的纯函数（e06、e10）
  - 把地址作为筛选条件的唯一来源：页面打开、后退、前进时都从地址读取，界面跟着它变化
  - 区分 pushState 与 replaceState：连续的输入替换当前记录，一次明确的操作新增记录
  - 筛选时告诉用户“显示了几个、一共几个”，空列说明“没有符合条件的任务”
references:
  - title: URLSearchParams — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/API/URLSearchParams
    checked: 2026-10-20
  - title: History.pushState() — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/API/History/pushState
    checked: 2026-10-20
  - title: Window：popstate 事件 — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/API/Window/popstate_event
    checked: 2026-10-20
  - title: String.prototype.toLocaleLowerCase() — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/String/toLocaleLowerCase
    checked: 2026-10-20
---

## 筛选条件是数据

筛选条件只有两项：一段文字 `q`（标题中包含它的任务），和一个标签 `tag`（带有这个标签的任务）。把它们写成一个类型：

```ts
export type Filters = Readonly<{ q: string; tag: string | null }>;
```

`tag` 用 `null` 表示“不按标签筛选”，而不是空字符串：“没有”和“空的标签”是两回事，类型中区分开，用的时候就不会混淆（a05）。

筛选条件和任务板的数据是分开的：任务板保存在本地（下一个里程碑），筛选条件保存在**地址**中。它们一起决定页面显示什么：

```
渲染的内容 = renderBoard(filterBoard(board, filters), …)
```

筛选只是从任务板算出“要显示的任务”，不修改任务板本身（g12 讲过的派生数据，在原生 DOM 中同样适用）。

## 地址是唯一的来源

e10 把筛选条件放进了查询参数。这一次要特别注意的是：**地址是筛选条件唯一的来源**。

- 页面打开时，从 `location.search` 解析出筛选条件，同时填进搜索框；
- 用户改变条件时，先更新地址，再按地址渲染；
- 用户按后退、前进时（`popstate` 事件），重新从地址解析，搜索框也跟着改回去。

如果另外用一个变量保存“当前的筛选条件”，而它又没有在每一种情况下都和地址同步，就会出现“地址是一个样子，页面是另一个样子”的问题。最简单的办法是不保存：每次需要时都从地址读取。

:::playground{#url-state}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <label for="q">筛选</label> <input id="q" type="search" />
    <button type="button" id="work">只看 #工作</button>
    <p id="where"></p>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=main.ts
function need<T extends Element>(selector: string, type: { new (): T; prototype: T }): T {
  const node = document.querySelector(selector);
  if (!(node instanceof type)) throw new Error(`页面缺少 ${selector}`);
  return node;
}

const input = need('#q', HTMLInputElement);
const work = need('#work', HTMLButtonElement);
const where = need('#where', HTMLParagraphElement);

function setParam(name: string, value: string | null, mode: 'push' | 'replace'): void {
  const url = new URL(location.href);
  if (value === null || value === '') url.searchParams.delete(name);
  else url.searchParams.set(name, value);
  if (mode === 'push') history.pushState(null, '', url);
  else history.replaceState(null, '', url);
  show();
}

function show(): void {
  const params = new URLSearchParams(location.search);
  input.value = params.get('q') ?? '';
  where.textContent = `地址中的查询参数：${location.search || '（没有）'}`;
}

input.addEventListener('input', () => setParam('q', input.value, 'replace'));
work.addEventListener('click', () => setParam('tag', '工作', 'push'));
window.addEventListener('popstate', show);
show();
```
- 在输入框中输入几个字：地址随之变化，但每个字都是 `replaceState`，没有新增历史记录。
- 点“只看 #工作”：`pushState` 新增了一条记录。打开控制台运行 `history.back()`，地址回到点击之前的样子，`popstate` 触发了 `show()`，输入框也跟着变了。
- 开头的 `need` 和前几个里程碑中的 `byId` 一样：找到元素并检查它的类型，返回值的类型就是检查过的类型，后面的函数中可以直接使用（如果在顶层用 `if … throw` 收窄，函数声明中是看不到这个收窄的，因为函数可能在检查之前就被调用）。
- `new URL(location.href)` 加上 `url.searchParams` 修改参数，中文、空格、`&` 都会被正确编码；只改查询参数，不改路径（沙箱中不能修改路径，e10）。
:::

## 让用户知道正在筛选

筛选之后，有些任务暂时看不见了。用户（特别是看不到页面的用户）需要知道这一点：在页面上写一句“显示 2 / 共 5 个任务”，放在 `role="status"` 的区域中，条件变化时读屏软件会读出它；没有任何任务符合条件的列，显示“没有符合条件的任务”，而不是“没有任务”，否则用户会以为任务被删了。“清除筛选”按钮让用户一步回到全部任务。

标签也可以点击：点一下任务上的 `#家`，就只看带这个标签的任务，再点一下取消。这样的按钮用 `aria-pressed` 表示“正在按这个标签筛选”。

::exercise{#filter-model}

## 编程挑战

::exercise{#url-filters}

::quiz

## 常见错误

- **另外保存一份筛选条件，没有和地址同步**：后退之后，地址和页面不一致。从地址读取。
- **输入时每个字都 `pushState`**：后退一次只删一个字。输入时 `replaceState`。
- **`popstate` 时只重新渲染任务，没有更新搜索框**：搜索框里的文字和实际的筛选条件不一样。
- **用空字符串表示“没有标签”**：和一个真的空标签混在一起。用 `null`。
- **筛选时还显示“没有任务”**：用户会以为任务丢了。说明是“没有符合条件的任务”，并给出“显示 / 共”的数量。

## 下一步

最后一个页面上的里程碑：把任务板保存到浏览器中，下次打开时恢复；读取时验证数据，遇到损坏的数据或者旧版本的格式，也不能让应用崩溃。
