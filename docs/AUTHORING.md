# 课程编写指南

本指南说明如何新增或修改一节课，以及一节课怎样才能从“规划中”变成“已发布”。现有的三节代表课（`content/lessons/a08-optional-chaining-nullish`、`d07-events`、`g03-events-state`）是可以照抄结构的完整范例。

## 1. 在课程图谱中登记

`content/curriculum.yaml` 是唯一的课程目录来源。每个课时一行：

```yaml
- { id: a09-control-flow, title: 条件与循环的快速迁移, status: planned, prerequisites: [a07-truthy-falsy] }
```

- `id`：小写字母、数字、连字符；也是 `content/lessons/<id>/` 的目录名与网址 `/learn/<id>`。
- `status`：`planned`（只有标题，不可进入）→ `draft`（有内容，标“草稿”，不计入已发布）→ `published`。
- `prerequisites`：先修课 id。不允许出现环；已发布的非代表课，其先修课也必须已发布。

## 2. 课时文件结构

```
content/lessons/<id>/
  lesson.md            正文：frontmatter + Markdown + 指令块
  quiz.yaml            2–4 道测验
  exercises/<ex>.md    每个小任务或挑战一个文件
  fixtures/<name>.json 可选：模拟网络请求的响应（练习里的 fetch 都是模拟的）
```

`fixtures/<name>.json` 是一个数组，每项描述一个模拟响应：`url`（相对地址以 `https://app.example` 为基准，可以用 `*` 通配）、`method`（默认 GET）、`status`、`statusText`、`headers`、`body`（JSON 值会被序列化并加上 `content-type: application/json`；字符串原样返回）、`delayMs`（多久之后响应头到达）、`bodyDelayMs`（响应头到达之后，响应体再过多久才传输完；期间中止请求，读取响应体会以中止原因失败）、`networkError`（`fetch` 以 `TypeError` 拒绝）。没有匹配的请求同样以网络错误失败，并在输出中提示。

### lesson.md 的 frontmatter

```yaml
---
version: 1                 # 起始代码有实质修改时加 1
mode: ts                   # ts | dom | react：本课示例与练习的默认运行模式
estimatedMinutes: 30
review: ai-draft           # ai-draft | self-reviewed | reviewed（AI 起草的内容不得标 reviewed）
problem: 一句话说明本课解决的实际问题
objectives:
  - 可检验的学习目标
references:                # 至少一条，写明检查日期；涉及版本的 API 写 note
  - title: Optional chaining (?.) — MDN
    url: https://developer.mozilla.org/...
    checked: 2026-10-20
compiler:                  # 可选：覆盖默认编译选项时必须写 note 说明原因（会显示给学习者）
  overrides: { noUncheckedIndexedAccess: false }
  note: 本课演示关闭该选项时的行为
representative: true       # 可选：先于先修课编写的代表案例
---
```

### 正文中的指令块

**可运行示例**（讲解后紧跟示例）：

````markdown
:::playground{#crash expect="18048@main.ts:11" run=error}
```ts file=main.ts
console.log(ada.profile.nickname);
```
这里写“观察什么”的说明（代码块之外的内容都会显示在“观察”区域）。
:::
````

- `#id`：本课内唯一。
- 代码块的 meta 写 `file=文件名`；可加 `hidden`（不显示）或 `readonly`（只读）。
- `expect="码@文件:行, …"`：示例**故意**包含的类型错误，验证时必须完全一致（不多也不少）。
- `run=ok|error|skip`：运行预期。`error` 表示故意演示运行时错误；`skip` 用于需要手动停止的演示（例如死循环）。
- `mode=dom|react|ts`：覆盖本课默认模式。`fixtures=name`：使用 `fixtures/name.json` 模拟网络。
- `options="exactOptionalPropertyTypes=true, noUncheckedIndexedAccess=false" note="…"`：只为这个示例覆盖编译选项（例如对比开启、关闭某个选项时的诊断），选项只能是 `src/compiler/config.ts` 中 `OVERRIDABLE_OPTIONS` 列出的那些，必须写 `note` 说明原因（会显示在示例上方）。
- DOM 模式需要 `index.html`（用 `<script type="module" src="./main.ts">` 指定入口，用 `<link rel="stylesheet" href="./style.css">` 引用样式）；React 模式的入口是 `main.tsx`。

**引用练习与测验**：`::exercise{#get-city}`（对应 `exercises/get-city.md`）、`::quiz`。

### 练习文件 exercises/<id>.md

````markdown
---
kind: task            # task（小任务）| challenge（编程挑战）
title: 安全地读取收货城市
# 可选：mode、entry、tests（默认有 *.test.ts 就运行）、timeoutMs、perTestTimeoutMs、fixtures、
#      forbid / allow（规则：any、type-assertion、non-null-assertion、ts-directive、var，默认全部禁止）、
#      expect（要求出现的诊断）、wrongNotApplicable（错误解确实不适用时说明原因）
---
题目说明（规格要清楚到能写出测试）。

:::files{role=starter}       起始代码（学生可编辑的全部文件）
:::files{role=solution}      参考解（只能包含起始文件中存在的文件）
:::files{role=tests}         *.test.ts(x) 行为测试；*.test-d.ts 只做类型测试
:::files{role=support}       可选：平台提供的文件（如 index.html、main.tsx），加 readonly 显示为只读
:::hint{level=1}             方向提示
:::hint{level=2}             更具体的提示
:::explanation               参考解的解释
:::variant{kind=alt name=...}                         另一种正确写法（必须通过）
:::variant{kind=wrong name=... fails=tests reason="..."}  常见错误解（必须在 fails 声明的那一步失败）
````

测试使用平台内置的 Vitest 兼容子集（`import { test, expect, describe, vi } from 'vitest'`，可用的 API 见 `sandbox/types/vitest.d.ts`），以及 `@testing-library/dom`、`@testing-library/react`、`@testing-library/user-event`。类型测试用 `expectTypeOf` 或 `// @ts-expect-error`。

DOM 模式的测试：每个测试开始前，平台会把页面恢复成 `index.html` 的初始状态并重新运行学生的入口文件。纯 HTML/CSS 的页面（`index.html` 里没有 module script，也没有 `main.ts`）不运行任何脚本，适合 HTML 语义与 CSS 布局的练习：学生文件就是 `index.html`/`style.css`，测试用角色查询（`getByRole`）检查结构，用 `toHaveStyle` 检查计算后的样式。测试页面运行在一个 1024×768 的隐藏 iframe 中；需要别的宽度（例如检查媒体查询）时，在测试里 `import { page } from 'vitest/browser'` 并 `await page.viewport(375, 667)`（与 Vitest 4 浏览器模式的 API 相同），每个测试开始前视口会恢复默认尺寸。布局可以用 `getBoundingClientRect()` 比较元素之间的相对位置（同一行、上下排列），不要断言具体的像素宽度。React 模式的测试：在测试里 `render(<组件 />)`，每个测试后自动 `cleanup()`。

### 测验 quiz.yaml

```yaml
- id: predict-or-nullish
  type: single          # single | multiple
  prompt: |
    下面的代码输出什么？
  options:
    - text: "`[ 10, 0, '' ]`"
      correct: true
      explain: 每个选项都要有解释，选错时显示原因。
```

**含有冒号加空格（`: `）的文字必须用引号包起来**，否则 YAML 会解析失败（构建脚本会指出具体行）。

**标签和泛型要写成行内代码**：正文、练习说明和测验中的 `<input>`、`<T>`、`Ref<HTMLInputElement>`、`<ChatRoom … />` 必须放进反引号。没有反引号时它们是 Markdown 中的“原始 HTML”：构建时平台会把它们当作文字显示（否则浏览器会把它们当成标签吞掉），`content:check` 会报告出来（已发布的课时是错误）。

## 3. 编写原则（发布验收会检查其中能自动检查的部分）

- 先写“解决什么问题”，再写短段落讲解；多数课至少两次“讲解 → 示例/小任务”循环；不为凑模板制造重复内容。
- 与 Python/Java/C++ 的对比要准确；简化处说明边界。
- 依据官方资料（TypeScript Handbook、MDN、react.dev、Vite、Next.js 文档）编写，不复制付费教程，不凭记忆写版本相关 API。
- 不未讲先考：练习需要的语法必须已经讲过或明确属于先修课。
- 挑战题型要混合：补全、修错、类型设计、从小规格实现。
- 每个练习：起始代码不能通过；至少 2 个针对教学目标的错误解被拒绝；至少 1 个不同写法的正确解能通过；不能只靠比较源码字符串判题。
- 示例输出以 Node.js 的 `console.log` 格式为准（平台的纯 TS 模式输出与之一致）。
- 正文中引用行号时，在修改代码后重新核对。

### 跨浏览器注意事项（Chromium 与 WebKit 的实测差异）

学习者可能用 Safari 或 iPhone（iOS 上所有浏览器都是 WebKit）。练习的测试必须在两种引擎中都成立：

- **焦点**：WebKit 不允许跨源 iframe（本平台的沙箱）用脚本移动焦点。测试运行时平台会自动改用“模拟焦点”：`document.activeElement`、focus/blur 事件、Testing Library 的输入与 Tab、`:focus`/`:focus-visible`/`:focus-within` 的计算样式都与真实焦点一致；但 `element.matches(':focus')` 这类选择器查询得不到模拟的焦点，测试中改用 `toHaveFocus()` 或 `document.activeElement`。
- **地址**：WebKit 不允许沙箱文档用 `pushState`/`replaceState` 修改**路径**（只能改查询参数和 `#` 片段）。DOM 测试和示例中不要修改路径；路由类练习把历史记录作为参数注入（见 e10 的 `RouterHistory`）。沙箱中越界的 `history.back()` 会被平台忽略并提示。不透明来源的 iframe 中浏览器自身的后退、前进会重新加载页面（Chromium 后退到加载时的那条记录、WebKit 任意两条记录之间都是如此，已实测），所以平台在本页面自己的条目之间模拟 `back`/`forward`/`go`：在下一个任务中恢复地址和 `history.state`，触发 `popstate`（只有片段不同时再触发 `hashchange`）。测试中后退之后要等待（`findBy…`/`waitFor`），不能立即断言。
- **`response.json()` 的错误**：Safari 中解析失败时是 `name` 为 `'SyntaxError'` 的 `DOMException`，不是 `SyntaxError`。测试用 `toMatchObject({ name: 'SyntaxError' })`，不要用 `toBeInstanceOf(SyntaxError)`；`JSON.parse` 在所有浏览器中都抛出 `SyntaxError`。
- **像素**：行内元素的盒子高度取决于字体，不同引擎会差 1 像素左右；比较文字盒子的位置时，容差至少 2px。
- **排序**：`localeCompare(…, 'zh-CN')` 把汉字（按拼音）排在拉丁字母前面，写期望值前先实际运行一次。
- **导航是异步的**：React Router 的导航在 transition 中完成，点击链接之后页面不会立刻更新（Chromium 中常常“碰巧”已经更新了，WebKit 中则没有）。断言导航之后的内容用 `findBy…` 或 `waitFor`；直接导航用 `await act(() => router.navigate(…))`。

### React Router（React 模式）

React 模式提供 `react-router` 与 `react-router/dom`（与平台本身使用的版本相同，见 `package.json`）：

- 学生文件导出路由配置（`routes: RouteObject[]`）；`main.tsx` 用 `createHashRouter(routes)` 渲染预览（沙箱中不能修改路径，见上面的“地址”）；测试用 `createMemoryRouter(routes, { initialEntries, initialIndex })` 加上 `react-router/dom` 的 `RouterProvider`，用 `router.state.location` 检查地址；
- 直接绑定在查询参数上的输入框，修改时要传 `{ replace: true, flushSync: true }`：默认的 transition 会让输入框先退回旧的值，快速输入（包括测试中的 `user.type`）会丢字；
- 测试中检查链接不能让整页跳转时，在 `window` 上注册一个 `click` 监听器，记录 `event.defaultPrevented` 并调用 `preventDefault()`（见 g13 的 `app-routes`），否则真实的跳转会中断测试。

### 测试 API 的细节

- `toHaveTextContent('')` 与 jest-dom 一致：只有内容为空才通过。检查“提示消失了”时更推荐 `not.toHaveTextContent('已保存')` 或 `toBeEmptyDOMElement()`；
- 统计渲染次数时用 `<Profiler onRender>`（开发版的 React 每次提交都会调用它，见 g12），不要在组件的渲染过程中计数。
- 模拟的 `localStorage`、`sessionStorage` 在每个测试开始前清空。要测试“保存之后刷新页面，数据还在”，在测试中写入或操作之后调用 `await page.reload()`（`import { page } from 'vitest/browser'`，平台扩展，只能用于 DOM 模式）：页面恢复成初始内容，入口文件重新执行，地址和存储中的数据保留。要从一份特定的存储数据开始，先 `localStorage.setItem(…)`，再 `await page.reload()`。
- 模拟存储失败（例如存储空间已满）时监视原型：`vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('…', 'QuotaExceededError'); })`。和真实的浏览器、jsdom 一样，`localStorage` 实例上的方法不能直接替换，平台的 `vi.spyOn(localStorage, 'setItem')` 会报错并给出这个写法。

## 4. 验证与发布流程

```bash
npm run content:check                    # 构建课程 + 静态检查
npm run build                            # 生产构建
CONTENT_LESSONS=a09-control-flow npm run content:verify   # 浏览器内运行全部示例与变体（Chromium，写入验证记录）
CONTENT_LESSONS=a09-control-flow npm run content:verify:webkit   # 同样的检查在 WebKit 中运行（只报告，不写记录）
npm run content:links                    # 可选：检查参考链接
```

验证运行在开发服务器上：运行期间不要执行 `content:build` 或修改 `src/`、`sandbox/` 中的文件，否则页面会重新加载，验证中断。

1. 状态先设为 `draft`，修到 `content:verify` 和 `content:verify:webkit` 全部通过、`content:check` 没有提醒。
2. 做一次独立的二次审查（准确性、测验答案、未讲先考、中文表述），记录在 `docs/STATUS.md`。
3. 把状态改为 `published`，再次运行 `content:check`（会核对验证记录与当前源文件哈希一致）。
4. 课文修改后验证记录会过期，`content:check` 会报错，需要重新 `content:verify`。
