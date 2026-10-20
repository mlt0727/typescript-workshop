---
version: 1
mode: dom
estimatedMinutes: 45
review: ai-draft
problem: 页面稍微复杂一点，直接在事件监听器里修改 DOM 就会出问题：勾选一项待办时，要同时更新这一项的样式、“剩余几项”的计数、“清除已完成”按钮是否可用，漏掉任何一处，界面就前后矛盾。更可靠的做法是把“界面应该是什么样”保存在一个状态对象里，事件只负责更新状态，再由一个渲染函数根据状态更新整个界面。这正是 React 等框架的核心思路，这一课用原生 TypeScript 把它做出来。
objectives:
  - 用一个类型明确的状态对象作为唯一的数据来源，派生数据在渲染时计算而不是另外保存
  - 写一个根据状态更新界面的 render 函数，事件处理只负责改变状态
  - 用不可变的方式更新状态，并用“动作”的可辨识联合描述所有可能的改变
  - 利用不可变状态实现撤销等功能，并为后面学习 React 做好准备
references:
  - title: Discriminated unions（Narrowing）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions
    checked: 2026-10-20
  - title: Thinking in React — React
    url: https://react.dev/learn/thinking-in-react
    checked: 2026-10-20
  - title: Extracting State Logic into a Reducer — React
    url: https://react.dev/learn/extracting-state-logic-into-a-reducer
    checked: 2026-10-20
---

## 状态是唯一的数据来源

下面的计数器有一个“加一”按钮、一个显示数字的地方，还有一个在数字达到 5 时出现的提示。如果在点击监听器里直接改这三处，每增加一个依赖这个数字的地方，都要记得去改监听器。

换一种写法：

1. 用一个**状态**变量保存数据本身（这里只有 `count`）；
2. 写一个 `render()`，根据状态设置界面上**所有**相关的部分；
3. 事件只修改状态，然后调用 `render()`。

界面上的一切都由状态推导出来，就不可能出现“数字是 5、提示却没出现”这样的矛盾。

:::playground{#counter}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <button type="button" id="inc">加一</button>
    <button type="button" id="reset">归零</button>
    <p>当前：<output id="count"></output></p>
    <p id="hint" hidden>已经达到 5 了！</p>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=main.ts
const inc = document.querySelector('#inc');
const reset = document.querySelector('#reset');
const output = document.querySelector('#count');
const hint = document.querySelector('#hint');
if (!(inc instanceof HTMLButtonElement) || !(reset instanceof HTMLButtonElement) || !(output instanceof HTMLOutputElement) || !(hint instanceof HTMLElement)) {
  throw new Error('页面结构不完整');
}

let count = 0;

const render = (): void => {
  output.textContent = String(count);
  hint.hidden = count < 5;
  reset.disabled = count === 0;
};

inc.addEventListener('click', () => {
  count++;
  render();
});
reset.addEventListener('click', () => {
  count = 0;
  render();
});

render();
```
- 第 11–15 行：`render` 设置了三处界面，它们都只依赖 `count`。
- 第 17–24 行：两个监听器都只做两件事：改变状态、调用 `render`。
- 第 26 行：页面加载时先渲染一次，初始界面同样由状态决定。
:::

**派生数据不要另外保存。** “剩余几项”可以从待办列表算出来，就不要再存一个 `remaining` 变量：多一份数据，就多一个可能与原数据不一致的地方。在 `render` 里计算它。

## 用类型描述状态和动作

状态复杂之后，先把它的类型写出来：

```ts
type Todo = { readonly id: number; readonly text: string; readonly done: boolean };
type Filter = 'all' | 'active' | 'done';
type State = { readonly todos: readonly Todo[]; readonly filter: Filter };
```

再把“状态可以怎样改变”列成一个**动作**的可辨识联合（b09），由一个函数根据动作计算新状态：

```ts
type Action =
  | { type: 'add'; text: string }
  | { type: 'toggle'; id: number }
  | { type: 'set-filter'; filter: Filter };

function update(state: State, action: Action): State {
  switch (action.type) {
    case 'add': …
    case 'toggle': …
    case 'set-filter': …
  }
}
```

这样，所有改变状态的逻辑都集中在 `update` 里；它不碰 DOM，很容易测试。以后增加一种动作，TypeScript 的穷尽检查会提醒你在 `switch` 中处理它。React 的 `useReducer` 用的正是这种写法（G 阶段）。

## 不可变的更新

`update` 不修改传进来的状态，而是**返回一个新的状态**：

```ts
case 'toggle':
  return {
    ...state,
    todos: state.todos.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t)),
  };
```

展开运算符（a12）复制了外层对象，`map` 生成了新数组，被切换的那一项是新对象，其他项保持原来的对象。这样做的好处：

- 旧状态保持不变，保存下来就能实现**撤销**；
- 判断“有没有变化”只需要比较引用：`next === state` 说明什么都没变，不需要重新渲染；
- `readonly` 让 TypeScript 帮你检查：写成 `state.todos.push(…)` 会直接报错。

:::playground{#mini-todos}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <div role="group" aria-label="筛选" id="filters">
      <button type="button" data-filter="all">全部</button>
      <button type="button" data-filter="active">未完成</button>
      <button type="button" data-filter="done">已完成</button>
    </div>
    <ul id="list"></ul>
    <p id="remaining"></p>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```css file=style.css
[aria-pressed='true'] { font-weight: bold; text-decoration: underline; }
.done { text-decoration: line-through; color: #666; }
```
```ts file=main.ts
type Todo = { readonly id: number; readonly text: string; readonly done: boolean };
type Filter = 'all' | 'active' | 'done';
type State = { readonly todos: readonly Todo[]; readonly filter: Filter };
type Action = { type: 'toggle'; id: number } | { type: 'set-filter'; filter: Filter };

function update(state: State, action: Action): State {
  switch (action.type) {
    case 'toggle':
      return { ...state, todos: state.todos.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t)) };
    case 'set-filter':
      return { ...state, filter: action.filter };
  }
}

function isFilter(value: string | undefined): value is Filter {
  return value === 'all' || value === 'active' || value === 'done';
}

let state: State = {
  todos: [
    { id: 1, text: '学习 DOM', done: true },
    { id: 2, text: '写状态与渲染', done: false },
    { id: 3, text: '开始项目 1', done: false },
  ],
  filter: 'all',
};

const list = document.querySelector('#list');
const filters = document.querySelector('#filters');
const remaining = document.querySelector('#remaining');
if (!(list instanceof HTMLUListElement) || !(filters instanceof HTMLElement) || !(remaining instanceof HTMLElement)) {
  throw new Error('页面结构不完整');
}

const render = (): void => {
  const visible = state.todos.filter((t) => state.filter === 'all' || t.done === (state.filter === 'done'));
  list.replaceChildren(
    ...visible.map((todo) => {
      const li = document.createElement('li');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = todo.done;
      box.dataset.id = String(todo.id);
      const label = document.createElement('label');
      label.append(box, ' ', todo.text);
      li.classList.toggle('done', todo.done);
      li.append(label);
      return li;
    }),
  );
  for (const button of filters.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.filter === state.filter));
  }
  remaining.textContent = `剩余 ${state.todos.filter((t) => !t.done).length} 项`;
};

const dispatch = (action: Action): void => {
  state = update(state, action);
  console.log(action.type, JSON.stringify(state.todos.map((t) => t.done)));
  render();
};

list.addEventListener('change', (event) => {
  if (event.target instanceof HTMLInputElement) dispatch({ type: 'toggle', id: Number(event.target.dataset.id) });
});
filters.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('button') : null;
  const filter = button?.dataset.filter;
  if (isFilter(filter)) dispatch({ type: 'set-filter', filter });
});

render();
```
- 勾选几项、切换筛选，观察输出：每个动作都产生一个新状态，界面完全由它决定。
- 第 36 行的“可见的待办”和第 54 行的“剩余几项”都是派生数据，每次渲染时计算。
- 第 57–61 行：`dispatch` 是唯一修改状态的地方。
- 第 63–70 行：事件委托（d08）把用户操作翻译成动作，监听器里没有任何直接修改界面的代码。
- 第 15–17 行的 `isFilter` 是 b08 的类型守卫：`dataset.filter` 是 `string | undefined`，要确认它是合法的筛选值。
:::

## 什么时候需要框架

上面的 `render` 每次都重建整个列表，几十项时完全没问题；数据量大、或者列表里有输入框需要保留焦点时，就要像 d06 的挑战那样复用节点。手工做这些工作很繁琐，React 等框架替你完成了“根据状态高效地更新 DOM”这一步：你只需要写出“状态 → 界面”的描述。理解了这一课的模式，学习 G 阶段的 React 会轻松得多。

::exercise{#todo-reducer}

## 编程挑战

::exercise{#todo-app}

::quiz

## 常见错误

- **在多个监听器里分别修改界面**：迟早会漏掉一处。事件只改状态，界面交给 `render`。
- **把派生数据也存进状态**：`remaining` 和 `todos` 可能不一致。在渲染时计算。
- **直接修改状态对象**：`state.todos.push(…)` 之后，旧状态也被改了，无法撤销，也无法通过比较引用判断变化。返回新对象。
- **忘了页面加载时先 `render()` 一次**：初始界面和状态对不上。

## 下一步

D 阶段到这里结束。接下来可以开始项目 1（原生 TypeScript 任务板），把 D 阶段的内容综合起来；或者继续 E 阶段的后半部分：`fetch` 与 JSON。
