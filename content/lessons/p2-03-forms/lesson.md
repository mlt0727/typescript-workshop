---
version: 1
mode: react
estimatedMinutes: 55
review: ai-draft
problem: 项目面板要能新建和编辑项目。表单本身在 d09、g06 中写过：受控的输入框、校验函数、出错时显示信息并把焦点移到第一个错误上。真实的应用中还有几个问题：新建和编辑用同一个表单，但规则不完全一样（编辑时项目和自己同名不算重名，已经过期的截止日期可以保持不变）；日期字符串要检查是不是真实的日期；用户改了一半就点了别的链接、按了“后退”或者关掉了标签页，修改会悄悄丢失。这一课把这些都处理好。
objectives:
  - 区分表单中的数据（都是字符串）和校验之后的数据，用一个纯函数完成转换和校验，一次返回所有字段的错误
  - 让校验规则依赖上下文（今天、已有的项目、正在编辑的项目），新建和编辑共用一个函数和一个表单组件
  - 用格式检查加“转换回去再比较”验证日期字符串，知道 Date.parse 在不同引擎中的结果不同
  - 从初始值和当前值算出“是否有未保存的修改”，用 useBlocker 拦截站内导航，用 beforeunload 提醒刷新和关闭
  - 理解拦截函数在渲染之后才更新，保存成功时用 ref 放行接下来的导航
references:
  - title: useBlocker — React Router API
    url: https://reactrouter.com/api/hooks/useBlocker
    checked: 2026-10-20
  - title: Window：beforeunload 事件 — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/API/Window/beforeunload_event
    checked: 2026-10-20
  - title: '<input type="date"> — MDN'
    url: https://developer.mozilla.org/zh-CN/docs/Web/HTML/Reference/Elements/input/date
    checked: 2026-10-20
  - title: Date.parse() — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Date/parse
    checked: 2026-10-20
  - title: 用 key 重置所有的 state — React
    url: https://zh-hans.react.dev/learn/you-might-not-need-an-effect#resetting-all-state-when-a-prop-changes
    checked: 2026-10-20
---

## 要做什么

p2-01 需求的第 3 条：可以新建、编辑项目，输入有误时在对应的输入框旁边说明。写成验收条件：

1. `/projects/new` 是空的表单，按钮是“创建项目”；`/projects/p1/edit` 的表单填好了项目原来的值，按钮是“保存修改”；
2. 名称和负责人必须填写（只有空白也不行）；名称最多 40 个字符，不能和**别的**项目重名（不区分大小写）；
3. 截止日期可以不填；填了就必须是真实存在的日期，并且不能早于今天。例外：编辑一个已经过期的项目，截止日期保持不变时可以保存；
4. 第一次提交之前不显示错误；提交时有错误，就显示所有的错误，焦点移到第一个错误上；之后错误随输入更新；
5. 保存成功之后转到项目的详情页；
6. 有没保存的修改时，点击站内的链接或者按“后退”，先询问用户；刷新、关闭标签页时，浏览器也要提醒。

## 表单的数据和项目的数据

表单中的值和项目中的值不是同一种东西：

```ts
/** 表单中的值：输入框给出的都是字符串，没有填写的截止日期是 '' */
type ProjectDraft = Readonly<{ name: string; owner: string; dueDate: string }>;

/** 校验通过之后的数据：去掉了首尾空白，没有截止日期是 null */
type ProjectInput = Readonly<{ name: string; owner: string; dueDate: string | null }>;
```

`ProjectDraft` 是用户正在输入的内容，可能是空的、多了空格、格式不对；`ProjectInput` 是可以放进 `Project` 的数据。两者之间只有一条路：`validateProject(draft, context)`，返回成功的数据，或者每个字段的错误（d09 讲过这种“解析”的写法）：

```ts
type FieldErrors = Partial<Record<keyof ProjectDraft, string>>;
type Validation = { ok: true; value: ProjectInput } | { ok: false; errors: FieldErrors };
```

`FieldErrors` 的键来自 `keyof ProjectDraft`：以后给表单加一个字段，错误的类型自动跟着变；写错字段名（`errors.nmae`）是类型错误。

反方向是 `toDraft(project)`：编辑时，表单的初始值来自项目（`null` 的截止日期变成 `''`）；新建时传入 `null`，得到空的表单。

## 规则依赖上下文

“名称不能重名”“截止日期不能早于今天”都不能只看表单本身：

- 要知道**已有的项目**，才能检查重名；
- 要知道**今天**是哪一天。和 p2-01 一样，把它作为参数传进来，测试才能固定日期；
- 要知道**正在编辑的是哪个项目**：编辑“官网改版”时，名称还是“官网改版”，这不是重名；一个已经过期的项目，只是改了负责人，不应该因为截止日期在过去而保存不了。

所以校验函数的第二个参数是一个上下文：

```ts
type ValidationContext = Readonly<{ today: string; projects: readonly Project[]; original: Project | null }>;
```

新建和编辑用同一个函数，区别只在 `original` 是不是 `null`。

## 日期字符串

`<input type="date">` 的 `value` 只会是 `''` 或者一个有效的 `YYYY-MM-DD`：浏览器保证了这一点。但校验函数不只用在这个表单里，数据也可能来自旧的记录、导入的文件、以后的服务器（p3），所以它自己要检查。

检查“是不是有效的日期”，`Date.parse` 看起来最省事，但它靠不住：

:::playground{#parse-dates mode=ts}
```ts file=main.ts
for (const text of ['2026-02-28', '2026-02-30', '2026-13-01', '2026-1-5', '2026/10/30']) {
  const time = Date.parse(text);
  console.log(text, Number.isNaN(time) ? 'NaN' : new Date(time).toISOString());
}

/** 是 YYYY-MM-DD 格式，并且是日历上真实存在的一天 */
function isCalendarDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

console.log(['2026-02-28', '2026-02-30', '2028-02-29', '2027-02-29', '2026-1-5'].map(isCalendarDate));
```
- 第 1–4 行的结果在不同的浏览器中不一样。在 Chromium 中，`'2026-02-30'` 被“进位”成 3 月 2 日；在 WebKit 中它是 `NaN`。`'2026-1-5'`、`'2026/10/30'` 不是标准的格式，两者都按各自的规则当作本地时间解析成功了（输出的 UTC 时间随时区不同）。只有 `'2026-13-01'` 在两者中都是 `NaN`；
- `isCalendarDate` 不依赖这些差别：先用正则确定格式，再把它当作 UTC 零点转换成 `Date`，再转换回字符串。真实的日期转换回来不变；`2026-02-30` 在 Chromium 中变成 `2026-03-02`，在 WebKit 中是无效的日期，两种情况都被拒绝；
- 2028 年是闰年，所以 `2028-02-29` 是有效的，`2027-02-29` 不是。
:::

日期的先后仍然可以直接比较字符串（p2-01）：`dueDate < today`。

::exercise{#validate-project}

## 新建和编辑共用一个表单

表单组件 `ProjectForm` 接收 `original`：新建时是 `null`。它的 state 是一个 `ProjectDraft`，初始值是 `toDraft(original)`；提交时调用 `validateProject`。错误的显示方式和 g06 一样：

- 用一个 `submitted` 记住“是否尝试过提交”，之前不显示错误；
- 有错误的输入框加上 `aria-invalid` 和指向错误信息的 `aria-describedby`；
- 提交失败时，按字段的顺序找到第一个错误，把焦点移过去。

编辑页渲染表单时加上 `key={project.id}`：从一个项目的编辑页直接去另一个项目的编辑页时，路由组件不会重新创建，`useState` 的初始值只在第一次渲染时使用，表单会继续显示上一个项目的内容。换一个 `key`，React 就创建一个新的表单（g12）。

## 有没有未保存的修改

“有修改”不需要一个单独的 state。它可以从现有的数据算出来（g07、g12）：

```ts
const initial = toDraft(original);
const dirty = FIELDS.some((f) => draft[f.key] !== initial[f.key]);
```

如果用一个 `dirty` 标记，在 `onChange` 中设置为 `true`，那么用户改了一个字又删掉，标记仍然是 `true`，离开时会被问一个毫无必要的问题。

## 离开之前提醒

离开一个页面有两种情况，处理方法不同。

**站内的导航**（点击 `Link`、“后退”“前进”）由 React Router 处理，`useBlocker` 可以拦截它：

```tsx
const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);

{blocker.state === 'blocked' && (
  <div role="alertdialog" aria-labelledby="leave-title" aria-describedby="leave-desc">
    <h2 id="leave-title">离开这个页面？</h2>
    <p id="leave-desc">还有没保存的修改，离开之后它们会丢失。</p>
    <button type="button" autoFocus onClick={() => blocker.reset()}>继续编辑</button>
    <button type="button" onClick={() => blocker.proceed()}>离开</button>
  </div>
)}
```

- 每次导航之前，React Router 调用这个函数，返回 `true` 就拦下来，`blocker.state` 变成 `'blocked'`。这里只在路径改变时拦截，只改查询参数不算离开；
- `blocker` 是一个可辨识联合（b09）：只有 `state` 是 `'blocked'` 时，它才有 `proceed`（继续去原来要去的地方）和 `reset`（留下）。在其他状态下调用它们是类型错误；
- 询问用的是页面中的元素，而不是 `window.confirm()`：后者会阻塞整个页面，样式和文字也无法控制。`autoFocus` 把焦点放在“继续编辑”上：用键盘的用户马上就能回答，默认的选择也是不会丢失数据的那一个。

**离开整个页面**（刷新、关闭标签页、在地址栏输入别的网址）不经过 React Router，要用浏览器的 `beforeunload` 事件。在它的处理函数中调用 `preventDefault()`，浏览器就会弹出自己的确认框（文字由浏览器决定，页面无法修改；更旧的浏览器还要求设置已经废弃的 `returnValue`）。浏览器只在用户和页面有过交互之后才会弹出它。MDN 建议**只在有未保存的修改时**才监听这个事件：在 Firefox 中，有 `beforeunload` 监听器的页面不能进入往返缓存（bfcache），“后退”回来时要重新加载。这正是 Effect 的用途，和一个外部系统（浏览器的窗口）同步（g11）：

```ts
useEffect(() => {
  if (!dirty) return;
  const warn = (e: BeforeUnloadEvent) => e.preventDefault();
  window.addEventListener('beforeunload', warn);
  return () => window.removeEventListener('beforeunload', warn);
}, [dirty]);
```

### 保存之后不要拦截

保存成功之后，页面调用 `navigate(…)` 转到详情页。这时表单中的值和初始值仍然不同，`dirty` 是 `true`，这次导航也会被拦下来，用户刚保存完就被问“确定要离开吗”。

在提交时 `setSaved(true)`，再在拦截函数中检查它，并不能解决问题：`setSaved` 只是安排一次新的渲染，而 `onSave` 中的 `navigate` 在同一个事件处理函数中**立刻**执行。React Router 在 Effect 中更新拦截函数，这时用的还是上一次渲染时的那一个，它看到的 `saved` 仍然是 `false`。

需要的是一个“立刻生效、不需要渲染”的值：ref（g09）。

```ts
const saving = useRef(false);
const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !saving.current && currentLocation.pathname !== nextLocation.pathname);

// 提交成功时
saving.current = true;
onSave(result.value);
```

拦截函数在导航时才被调用，那时读到的 `saving.current` 已经是 `true`。注意 ref 只在事件处理函数和这类回调中读写，不在渲染时读取。

## 编程挑战

::exercise{#project-form}

::quiz

## 常见错误

- **校验时不传正在编辑的项目**：项目和自己“重名”，过期的项目改什么都保存不了。
- **用 `Date.parse` 检查日期**：有的引擎会把 2 月 30 日进位成 3 月，有的会接受 `2026-1-5` 这样的非标准格式。先检查格式，再转换回去比较。
- **只返回第一个错误**：用户改好一个，提交，又出现下一个。一次把所有的错误都告诉用户。
- **用一个标记记录“改过”**：改回原来的值之后仍然被拦截。从初始值和当前值算出来。
- **一直监听 `beforeunload`**：没有修改时也弹出确认框，还会影响 Firefox 的往返缓存。只在有修改时监听。
- **用 state 放行保存之后的导航**：拦截函数在渲染之后才更新，同一个事件中的导航仍然被拦截。用 ref。
- **切换项目时表单不更新**：给表单加上 `key`。

## 下一步

现在的项目只保存在内存中，刷新页面就没了。p2-04 把数据放到服务器上：加载时显示“正在加载”，失败时可以重试，保存时防止重复提交，服务器返回的错误也要显示在表单中。
