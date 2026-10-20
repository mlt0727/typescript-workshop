---
version: 1
mode: react
estimatedMinutes: 40
review: ai-draft
problem: state 是数字、字符串时，设置一个新值很自然。state 是对象或数组时，很多人会写 `todos.push(item); setTodos(todos)`，结果界面纹丝不动；或者界面更新了，旧的数据却被悄悄改掉。原因是 React 靠“是不是同一个对象”来判断 state 有没有变化。这一课讲为什么要把对象和数组 state 当作只读的，怎样用展开语法和不修改原数组的方法创建新值，以及怎样让 TypeScript 帮你阻止意外的修改。
objectives:
  - 理解 React 用 Object.is 比较新旧 state，修改原对象再设置回去不会触发渲染
  - 用展开语法更新对象，包括嵌套的对象；未改变的部分保持原样
  - 用 map、filter、展开以及 toSorted、toSpliced、with 等方法创建新数组，不用 push、splice、sort 修改原数组
  - 用 readonly 数组类型和 Readonly 让 TypeScript 在编译时阻止修改
references:
  - title: Updating Objects in State — React
    url: https://react.dev/learn/updating-objects-in-state
    checked: 2026-10-20
  - title: Updating Arrays in State — React
    url: https://react.dev/learn/updating-arrays-in-state
    checked: 2026-10-20
  - title: Array.prototype.toSorted() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSorted
    checked: 2026-10-20
  - title: Object.is() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is
    checked: 2026-10-20
---

## 修改原对象，React 看不到

调用 `setX(新值)` 时，React 用 `Object.is(旧值, 新值)` 比较两者。对象和数组比较的是**引用**（a11）：如果你修改了原来的数组，再把**同一个数组**交给 `setX`，在 React 看来什么都没有变，它会跳过这次渲染。

:::playground{#mutation-bug}
```tsx file=App.tsx
import { useState } from 'react';

export function App() {
  const [tags, setTags] = useState(['TypeScript']);

  function addWrong() {
    tags.push('React');
    setTags(tags);
    console.log('数组已经被改成了', tags, '，但界面没有更新');
  }

  function addRight() {
    setTags([...tags, 'Vite']);
  }

  return (
    <div>
      <p>标签：{tags.join('、')}</p>
      <button type="button" onClick={addWrong}>
        push 后设置（错误）
      </button>{' '}
      <button type="button" onClick={addRight}>
        创建新数组（正确）
      </button>
    </div>
  );
}
```
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<App />);
```
- 先点左边的按钮：控制台显示数组已经变了，界面却没有任何变化。
- 再点右边的按钮：界面一下子出现了好几个标签，包括之前 push 进去的 `React`。之前的修改并没有消失，只是 React 不知道。这种“时有时无”的更新，是修改 state 最麻烦的后果。
- 第 13 行：`[...tags, 'Vite']` 创建了一个**新数组**，React 比较时发现引用变了，就会重新渲染。
:::

除了不渲染，修改 state 还会带来更隐蔽的问题：上一次渲染的快照（g03）、传给子组件的 props、保存起来用于“撤销”的历史记录，都指向同一个对象，改一处就全都变了。所以规则很简单：**把 state 中的对象和数组当作只读的**，需要变化时，创建一个新的。

## 更新对象

用展开语法（a12）复制原对象，再覆盖要改的属性。嵌套的对象要**逐层**复制：只复制外层，里面的对象仍然是原来那个。

```tsx
type Profile = { name: string; address: { city: string; street: string } };

// 改名字
setProfile({ ...profile, name: '韩梅梅' });

// 改城市：外层和 address 都要复制
setProfile({ ...profile, address: { ...profile.address, city: '上海' } });
```

这样得到的新对象中，**没有改变的部分仍然是原来的对象**（第一行中的 `address` 还是同一个）。这不是缺点，而是优点：复制的东西少，而且之后可以用引用是否相同，快速判断某一部分有没有变化（g12）。

新值依赖旧值，或者在一个事件中连续更新时，同样可以用更新函数：`setProfile((p) => ({ ...p, name }))`。注意箭头函数直接返回对象时，要用圆括号把对象包起来。

## 更新数组

常用的数组操作，都有一个**不修改原数组**的写法：

| 想做的事 | 会修改原数组（不要用） | 返回新数组（推荐） |
| --- | --- | --- |
| 在末尾 / 开头添加 | `push`、`unshift` | `[...arr, x]`、`[x, ...arr]` |
| 删除 | `splice`、`pop`、`shift` | `filter`、`toSpliced(i, 1)` |
| 修改某一项 | `arr[i] = x` | `map`、`with(i, x)` |
| 在中间插入 | `splice(i, 0, x)` | `toSpliced(i, 0, x)` |
| 排序 / 反转 | `sort`、`reverse` | `toSorted`、`toReversed` |

`toSorted`、`toReversed`、`toSpliced`、`with` 是 ES2023 加入的方法，现代浏览器都已支持。在它们出现之前，常见的写法是先复制再排序：`[...arr].sort(…)`。

修改数组中的某个**对象**时，要同时创建新数组和新对象：

```tsx
setTodos(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
```

`map` 返回新数组；被改的那一项换成新对象，其他项原样保留。

## 让 TypeScript 阻止修改

规则靠记忆很容易忘，交给类型检查更可靠。把 state 的类型写成**只读**的：

- `readonly Todo[]`（或 `ReadonlyArray<Todo>`）：没有 `push`、`splice`、`sort` 这些方法，也不能 `arr[i] = x`；
- `Readonly<Todo>`：对象的属性都变成只读的，`todo.done = true` 会报错（只作用于一层，嵌套的对象需要分别处理）。

:::playground{#readonly-state}
```tsx file=App.tsx
import { useState } from 'react';

type Todo = Readonly<{ id: number; title: string; done: boolean }>;

const initialTodos: readonly Todo[] = [
  { id: 1, title: '写练习', done: false },
  { id: 2, title: '读完 g04', done: false },
];

export function App() {
  const [todos, setTodos] = useState(initialTodos);

  function toggle(id: number) {
    setTodos(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  function sortByTitle() {
    setTodos(todos.toSorted((a, b) => a.title.localeCompare(b.title, 'zh-CN')));
  }

  const first = todos[0];
  return (
    <div>
      <p>
        {todos.map((t) => `${t.done ? '✓' : '○'} ${t.title}`).join('；')}
      </p>
      {first !== undefined && (
        <button type="button" onClick={() => toggle(first.id)}>
          切换第一项
        </button>
      )}{' '}
      <button type="button" onClick={sortByTitle}>
        按标题排序
      </button>
    </div>
  );
}
```
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<App />);
```
- 第 11 行：state 的类型从初始值推断，是 `readonly Todo[]`。
- 在 `toggle` 中加一行 `todos.push({ id: 3, title: 'x', done: false });`，或者 `first.done = true;`：TypeScript 都会报错。
- 第 18 行用 `toSorted` 返回排好序的新数组（`localeCompare` 的 `'zh-CN'` 按拼音排序，“读”排在“写”前面）。改成 `todos.sort(…)` 试试：只读数组上没有 `sort` 方法。
- 列表的渲染下一课再讲，这里先把它拼成一行文字。
:::

`readonly` 只存在于类型检查中，不会让对象在运行时真的不可修改（`Object.freeze` 才会）。它的作用是让“意外修改 state”在编译时就被发现，而且没有运行时开销。

**深层嵌套的数据**：如果 state 嵌套得很深，逐层展开会很繁琐。可以考虑把数据“拍平”（例如用 id 互相引用），或者使用 Immer 这类库，它允许你用“修改”的写法，自动生成新对象。`structuredClone` 能深拷贝整个对象，但它会复制所有没有变化的部分，通常没有必要。

::exercise{#todo-helpers}

## 编程挑战

::exercise{#settings-panel}

::quiz

## 常见错误

- **`arr.push(x); setArr(arr)`**：同一个数组，React 不会重新渲染。用 `setArr([...arr, x])`。
- **只复制外层对象**：`{ ...user }` 之后修改 `user.address.city`，改的还是原来的 address。嵌套的对象要逐层展开。
- **`arr.sort()` 排序 state**：`sort` 会修改原数组。用 `toSorted`，或者 `[...arr].sort()`。
- **箭头函数返回对象忘了圆括号**：`(p) => { ...p, name }` 是语法错误，应写成 `(p) => ({ ...p, name })`。
- **为了“保险”深拷贝整个 state**：没有必要，而且会让“没有变化的部分”也变成新对象。

## 下一步

下一课讲列表渲染：用 `map` 把数组变成一组元素，以及为什么每一项都需要一个稳定的 `key`。
