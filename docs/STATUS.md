# 项目状态

最后更新：2026-10-21。本文件如实记录已完成、已验证与未完成的内容；“未验证”的项目会明确标出。

## 概览

| 方面 | 状态 |
|---|---|
| 平台功能（M1） | ✅ 最小完整学习闭环已实现并通过自动化测试 |
| 同步 / 问 AI / 部署（M2） | ✅ 同步与部署已上线并验证；问 AI 已实现，**未配置密钥，未做线上调用验证** |
| 课程编写 | ⚠ 已发布 **116 / 126** 节：A 20、B 17、C 12、D 10、E 13、F 12、G 15 节（这七个阶段全部完成），H 阶段 3 节（h01–h03），I 阶段 14 节（项目 1、项目 2 全部里程碑，i01、i02）；草稿 1 节（h04，已通过两个浏览器的验证，独立审查进行中）；规划中 9 节：h05–h09、项目 3（p3-01–p3-03）、i03 |
| 课程审核 | ⚠ 已发布的 116 节：浏览器自动验证 + 独立 AI 审查 + 按意见修正（`self-reviewed`）；**没有人工审核** |
| 项目实验（I 阶段） | ⚠ 项目 1、项目 2 已完成；项目 3（全栈）和 i03（服务端部署）未开始 |
| Next.js 实验（H 阶段） | ⚠ 在本机用 create-next-app 16.4.2 创建的实验项目中实测（构建、生产服务器、浏览器），结果写在 h01–h04 的课文中；实验项目本身**不在仓库中** |

线上地址：https://typescript-workshop-jade.vercel.app　源码：https://github.com/mlt0727/typescript-workshop

## 平台功能

| 功能 | 状态 | 验证方式 |
|---|---|---|
| 浏览器内 TS 6.0.3 类型检查（编辑器诊断 = 判题 = 课程验证同一配置） | ✅ | 单元测试 12 项；e2e |
| 自托管类型库（ES2025、DOM、WebWorker、React 19.3、Testing Library、Vitest 子集、expect-type） | ✅ | 生产构建与线上加载 |
| CodeMirror 6 编辑器：多文件、诊断、补全、悬停、中文诊断解释、Esc+Tab 离开编辑器 | ✅ | e2e（补全/悬停为人工抽查） |
| 纯 TS 模式（Worker）：多文件、顶层 await、计时器结束才算完成、未决 TLA 检测、停止/超时可中断死循环 | ✅ | e2e（Chromium、WebKit） |
| 输出格式与 Node.js `util.inspect`/`util.format` 一致 | ✅ | 60 项与 Node 对照的单元测试 |
| DOM 模式：真实网页预览、每个测试前恢复页面、循环保护 | ✅ | e2e |
| React 模式：React 19.3 开发版、RTL 组件测试、真实预览交互 | ✅ | e2e |
| React 模式提供 React Router 8.5（`react-router`、`react-router/dom`，与 React 打包在同一个运行时中，开发版构建；类型在 React 类型组中） | ✅ | g13 课程验证（Chromium、WebKit）：内存路由、哈希路由预览、`NavLink`、查询参数 |
| 判题：类型 / 规则（AST）/ 行为三类检查，快照哈希，编辑后结果失效 | ✅ | e2e |
| 规则：any、类型断言（含泛型 querySelector）、非空断言、@ts-ignore/@ts-nocheck/@ts-expect-error、var | ✅ | 单元测试 |
| 纯 HTML/CSS 页面（没有脚本时只显示页面）；DOM 断言 `toContainElement`、`toHaveStyle`（计算样式） | ✅ | e2e |
| 测试中的 `page.viewport()`（`vitest/browser`，与 Vitest 4 浏览器模式同名）；测试 iframe 默认 1024×768，每个测试前恢复 | ✅ | e2e（Chromium、WebKit） |
| 示例“查看 JS”：显示与运行时相同设置转译出的 JavaScript | ✅ | e2e |
| Safari/WebKit：沙箱中越界的 `history.back()` 被忽略（WebKit 中会让课程页面后退）；修改路径时的 `SecurityError` 给出中文说明 | ✅ | e2e（Chromium、WebKit） |
| Safari/WebKit：测试中的“模拟焦点”（WebKit 禁止跨源 iframe 用脚本移动焦点）：`activeElement`、焦点事件、`:focus`/`:focus-visible`/`:focus-within` 样式、元素移除后失去焦点 | ✅ | e2e（Chromium、WebKit）；D、E、G 阶段全部课程在 WebKit 中验证通过 |
| 测试 iframe 留在视口内（透明、在内容之下）：避免 WebKit 把屏幕外跨源 iframe 的计时器节流到每秒一次 | ✅ | WebKit 实测（输入 10 个字符从 12.7 秒降到 0.1 秒） |
| 测试库（user-event、React）在 document 上注册的监听器在测试之间保留；学生代码的监听器每个测试前清除 | ✅ | e2e（受控输入框在每个测试中都能输入） |
| 模拟 fetch：`bodyDelayMs`（响应头先到、响应体随后到达），期间中止时读取响应体以中止原因失败 | ✅ | 单元测试 6 项；e08 课程验证 |
| 运行错误信息把内部模块地址映射回文件名（例如 `./geometry.ts`） | ✅ | e2e |
| 沙箱隔离：不透明来源、CSP 禁网络与远程脚本、专属 MessageChannel、schema 校验、伪造消息无效 | ✅ | e2e（Chromium、WebKit） |
| 课页：讲解/示例/小任务/挑战/三级提示/答案确认/测验解释/参考资料/上一课下一课/先修提醒 | ✅ | e2e |
| 进度：IndexedDB 草稿与状态、刷新恢复、继续学习、导出/导入（合并或替换，非法文件拒绝且不破坏数据） | ✅ | e2e、单元测试 |
| 课程更新后草稿不被静默覆盖（提示“保留我的代码 / 改用新版”） | ✅ 已实现 | ⚠ 尚无专门的 e2e |
| 跨设备同步（单用户密码、乐观并发、可交换的合并、重置跟随） | ✅ | 单元测试；本地 e2e（两个浏览器上下文）；线上 API 读写验证 |
| 问 AI（服务端代理 Claude，`claude-opus-5-5`，流式，默认先给思路） | ✅ 已实现 | ⚠ 未配置 API 密钥，未做真实调用；接口鉴权与未配置时的降级有单元测试 |
| 浅色/深色、字号、可折叠目录、窄屏抽屉、目录搜索 | ✅ | e2e（手机/平板/桌面无横向溢出） |
| 课程内容管线与发布验收（`content:check`、`content:verify`、`content:verify:webkit`、链接检查） | ✅ | 实际运行 |
| 课程 Markdown 中作者写的原始 HTML（例如没有加反引号的 `<T>`）当作文字显示，`content:check` 报告为错误 | ✅ | 单元测试 3 项；全部课程的检查 |
| 测试 API 的 `toHaveTextContent('')` 与 jest-dom 一致（只有内容为空才通过） | ✅ | 单元测试 2 项 |
| 课程验证：声明“在测试中失败”的错误解必须能通过类型与规则检查（否则它是因为一个无关的错误被拒绝的） | ✅ | 全部课程的验证记录中没有违反的错误解；g14 中新写的测试有类型错误时被它发现 |
| 测试中模拟刷新页面：`page.reload()`（平台扩展，DOM 模式）重新执行入口文件，保留地址与模拟的存储；每个测试开始前清空 `localStorage`/`sessionStorage` | ✅ | e2e（Chromium、WebKit）；p1-05 的挑战使用它 |
| 模拟的 `Storage`：方法在原型上（`localStorage instanceof Storage`），可以 `vi.spyOn(Storage.prototype, 'setItem')` 模拟存储已满；直接替换实例的方法时报错并给出写法。`vi.spyOn` 用调用时的 `this` 调用原函数（与 Vitest 一致） | ✅ | 单元测试 4 项 |
| 示例级的编译选项：`:::playground{options="strictNullChecks=false" note="…"}` 只为一个示例覆盖 `OVERRIDABLE_OPTIONS` 中的选项，示例上方显示原因；练习的 frontmatter `compiler.overrides` 同理 | ✅ | c11 课程验证（Chromium、WebKit）；构建时检查选项名与必填的说明 |
| 学生写测试的练习（`grading: tests`）：学生的测试先要在正确的实现上通过，再对每个故意写错的实现（`:::mutant`，至少 2 个）重新编译和运行，类型测试报错或任一测试失败才算“发现”；结果面板列出漏掉的错误实现及其提示。课程验证中错误的测试用 `fails=tests`（在正确的实现上失败）或 `fails=mutants misses=…`（必须正好漏掉声明的那几个） | ✅ | e2e（Chromium、WebKit）：行为测试与类型测试分别发现错误实现、测试本身有错时不检查错误实现 |
| 沙箱中的 `history.back/forward/go`：在本页面自己的条目之间模拟完成（异步；恢复地址与 `history.state`，触发 `popstate`，只有片段不同时再触发 `hashchange`）。修复前，后退之后页面会被浏览器重新加载（Chromium 后退到加载时的条目、WebKit 任意条目之间，已实测），之后的测试被“页面被导航离开”中止 | ✅ | e2e（Chromium、WebKit）；e10、g13、p1-04 在 WebKit 中重新验证 |

## 已运行的检查（2026-10-20，Windows 11，Node 24.13）

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | 通过 |
| `npm run lint` | 通过 |
| `npm test` | 8 个文件、112 项全部通过 |
| `npm run content:check` | 已发布 116、草稿 1、规划 9、错误 0、提醒 0（2026-10-21） |
| `npm run content:links` | 235 个参考链接全部可访问 |
| `npm run content:verify`（Chromium） | 平台修改（模拟存储、`vi.spyOn`、历史记录）后全部重新验证通过；第 19 轮修改后 p1-01–p1-05 再次通过并发布；第 20 轮修改后 c01–c11 通过并发布（共 89 节），f01 草稿通过；验证记录与当前源文件一致（每节 15–29 项检查：示例的诊断与运行结果、参考解、替代解、错误解、起始代码） |
| `npm run content:verify:webkit` | 平台修改后全部重新验证通过（11.8 分钟）；第 19 轮修改后 p1-01–p1-05 再次通过；c01–c11、f01 通过 |
| `npm run build` | 通过 |
| `npx playwright test --project=e2e --project=e2e-webkit`（生产预览，含 CSP） | 71 项全部通过（新增“学生写测试”的判题测试，在两个引擎中运行） |

**未验证**：Firefox（本机 Playwright 无法启动 Firefox：`spawn UNKNOWN`）；真实的 Safari 和 iPhone（WebKit 的结果来自 Playwright 的 WebKit 构建）；真实移动设备（只做了视口模拟）；问 AI 的真实模型调用；中国大陆网络下访问 `*.vercel.app` 的可用性。

## 课程审查记录

每一轮由独立的 AI 审稿代理只读审查（可实际运行代码核实），报告“错误 / 误导 / 建议”，再由编写方逐条修改、重新做浏览器验证后发布。**这些都不是人工审核。**

| 轮次 | 范围 | 发现 | 处理 |
|---|---|---|---|
| 1 | a08、d07、g03（代表课） | 若干事件类型、措辞与测试边界问题 | 全部修改后发布 |
| 2 | a01–a07 | 无硬性错误；3 处需改（tsc 用法、“查看 JS”多出的 `export {}`、一处自相矛盾的解释），若干简化未说明边界 | 全部修改；平台同时修正“查看 JS”的输出 |
| 3 | a09–a13 | 2 处错误（默认参数位置、解释与替代解不一致），5 处误导（组合 emoji、对象当字典、模块中重复声明函数等） | 全部修改 |
| 4 | a14–a20 | 2 处错误（`splice` 的返回值、Set 判断方法返回布尔值），4 处误导（`setTimeout`/事件监听器中的 `this`、两种“严格模式”、`has` 不收窄 `get`、交集顺序） | 全部修改；调整了 a09、a18 的先修关系 |
| 5 | b01–b06 | 跨文件 interface 不合并、展开属性不做多余属性检查、any 不能赋给 never、function 声明的 never 需显式标注等；若干规格不完整 | 全部修改后发布 |
| 6 | b07–b10 | 行号错误与替代解缺少穷尽检查；TS 5.4 回调收窄、TS2775、TS 5.5 推断类型守卫的准确条件；方法写法的双向检查 | 全部修改后发布 |
| 7 | b11–b14 | 规格补全；Java 重载与泛型擦除的对比；override 与 noImplicitOverride 的分工；泛型字面量推断的真实规则 | 全部修改后发布 |
| 8 | b15–b17 | 3 处错误（把 esbuild/Vite 说成只擦除类型；一个错误解的说明与代码不符；悬停 keyof 别名不会展开），3 处误导（satisfies “不改变推断”、“as const 不是断言”、用展开构造泛型返回值）；一个练习针对教学目标的错误解不足 | 全部修改后发布；顺带修正 a02 的一处课程引用 |
| 9 | e01–e04 | 1 处错误（Promise `catch` 回调参数实为 `any` 而非 `unknown`）；4 处测试漏洞（防抖、failAfter、超时时刻、结果顺序）；“同步执行到第一个 await”未讲先考；缺少 `return await` 讲解；若干行号与先修关系 | 全部修改后发布；补充测试与对应的错误解 |
| 10–11 | d01–d10 | 语义（aside 的作用域、article 不是地标、search 元素）、placeholder 与可访问名称；多处测试漏洞（委托、失败时清除字段、阻止默认提交、按钮位置等）；对比度测试改用 canvas 换算颜色；d06 复用节点保留焦点；d08 中键与修饰键 | 全部修改后发布 |
| 12 | e05–e08 | 2 处错误（e08 参考解在读取响应体时超时抛错类型不对；“请求完成后 abort 不受影响”说法相反）；e07 每次新插入 `role="status"`、状态提示放在 `aria-busy` 区域中；多处测试漏洞（Promise.race 不中止请求、404/非 JSON/逐项验证、网络失败退避）；e06 日期只检查 NaN；e05 补讲 `encodeURIComponent` | 全部修改；平台新增响应体延迟的模拟；e05、e06 发布 |
| 18 | g14 | 没有事实错误（审查方对照 react-router 8.5 源码和 React 19.3 实测）。测试漏洞：“已经是加载中就不设置”的写法只在挂载时没有多余的渲染，重试、换地址时仍然多一次；书单的 loader 没有测试验证与中止信号；`/books/01`；url 变成 `null`；ref 中过时的 `parse`；一个错误解不是因为它写的原因失败；“一格缓存”、`HydrateFallback` 的范围、`useLoaderData<typeof loader>` 不做检查、React 中的错误边界写法等说明不完整 | 全部修改；补充对应的测试与错误解；模拟服务器增加通配的 404；g14 发布 |
| 17 | g13 | API 的说法与 react-router 8.5 源码一致（审查方逐条核对）；测试漏洞：把排序留在组件 state 中、修改时丢掉其他查询参数、`/products/0205`、404 页没有导航、翻页“链接”没有真实地址；一个替代解接受小数页码（`?page=1.5`）；页面上有两个列表时一种正确写法被误拒；`..` 按路由层级回退在并列路由中会回到首页；`flushSync` 的说明不完整（光标跳到末尾；有 loader 时无效）；从 `react-router` 导入的 `RouterProvider` 不支持 `flushSync` | 全部修改；测试改为解析链接的地址、比较参数集合；补充 `relative="path"`、`createRoutesStub` 与两个 API 参考链接；g13 发布 |
| 19 | p1-01–p1-05 | 1 处跨课的数据丢失：改名不限制标题长度，存储验证却要求不超过 40 个字符，刷新后整个任务板被判为损坏。改名表单重新渲染时丢掉用户的输入；p1-01 的检查顺序与参考解不一致、只读类型测试实际检查不到只读；多处测试漏洞（错误文字只隐藏不清空、打开页面时读取地址、搜索框打不出空格、存储中按编码单元计算长度、`1e999`、`nextId` 为 0）；访问 `localStorage` 本身可能抛出 `SecurityError`、备份失败与迁移时不备份会丢数据；焦点丢失后果、隐私模式、null 与空字符串的说法不准确 | 全部修改：新增 `parseTitle` 统一标题规则，界面状态增加 `draft`，补充测试与 13 个针对性的错误解；复查（第二轮）结论为可以发布，其中 5 条小建议也已修改；两个浏览器验证后发布 p1-01–p1-05 |
| 20 | c01–c11 | 5 处与 TS 6.0 实际行为不符的说法（审查方用 tsc 6.0.3 实测）：同态映射类型（`Partial`、`Readonly`、`Required`）遇到联合会分布、只有 `Pick`/`Omit` 不分布；`alwaysStrict` 在 6.0 中已移出 `strict`；`Uppercase<string>` 是合法的模式类型；`NonNullable<unknown>` 是 `{}`；c02 讲解中 `indexOf(handler)` 删掉的是第一次注册。另有 `JSON.stringify` 能区分“没有属性”的错误说法、“泛型剩余参数”的版本（3.0 而非 4.0）。测试漏洞：键的书写顺序、h-g-h 注册后取消、`hasErrors({ nickname: '' })`、`withRetry` 不等待 `delay`、库存正好为 0 与正好等于阈值、传入完整 `User` 时旧 `id` 覆盖新 `id`；c06 缺少 c04 先修 | 全部修改；c02 参考解改为每次注册包一层，旧写法作为错误解；补充对应的测试与错误解；测试检查不了的要求（注解、`satisfies`、不能手写、隐式 any）在题面或讲解中说明；两个浏览器验证后发布 c01–c11 |
| 16 | g12 | 2 处平台问题：测验文字中没有加反引号的 JSX（`<ChatRoom … />`）被浏览器当成标签吞掉，**已发布的 g01、g06、g07、g09 的测验中也有同样的问题**（`<h2>`、`<option>`、`<T>`、`Ref<HTMLInputElement>` 不显示）；平台的 `toHaveTextContent('')` 永远通过，两处“提示消失”的测试实际没有检查。测试漏洞：筛选时重新排序、全名不去空白；Profiler 的测量说明、父组件循环的条件、拼音输入法下的观察结果；在渲染中计数与“渲染必须是纯的”冲突 | 全部修改；平台把 Markdown 中的原始 HTML 当作文字显示并在 `content:check` 中报错，`toHaveTextContent('')` 改为与 jest-dom 一致；四节已发布课的测验修正后重新验证；行的渲染次数改用 `<Profiler>` 统计；g12 发布 |
| 15 | g08–g11 | 2 处规格与测试不一致或缺少测试：g10 `setQuantity` 对不在购物车中的商品的行为没有写进规格；g11 没有测试“被中止的请求不算失败”（不检查 `aborted` 的写法退格后会立刻显示失败）；多处测试漏洞（重置不限制范围、重做到 `undefined`、只阻止 `mousedown` 的焦点写法、再次编辑时的草稿、单向切换主题、不验证响应格式、渲染时设置标题、只依赖 `delay === null`）；一条提示把学生引向 `at(-1)` 的陷阱；错误的课程引用与预览尺寸说明；切换按钮文字随状态变化；g11 缺少 e08 先修 | 全部修改；g08 新增泛型 Hook 示例，g09 补讲 ref 回调的清理与类型，g11 搜索状态改为常驻的 `role="status"` 区域；补充对应的错误解；4 节在 Chromium 与 WebKit 中验证后发布 |
| 14 | g01、g02、g04–g07，复查 e10 的路由题 | g04 两处测试漏洞（toggle 写成只能取消、字号一步跳到边界）与“标题不变时返回原数组”；g05 播放列表缺少同名歌曲，`key={title}` 能通过；g07 分段选择器用 `aria-pressed` 按钮表达“多选一”，FAQ 解释引用了错误的课程；e10 路由在页面刚打开时就移动焦点、没有测试链接内的子元素、`createMemoryRouter` 的用途描述不准确；g01、g02、g06 的措辞、悬停类型说明与测试补充 | 全部修改；g07 分段选择器改为原生单选框（`fieldset` + `legend`，`name` 由 `useId()` 生成）；补充对应的错误解；7 节发布 |
| 13 | e09–e12，复查 e07 | **Safari 中沙箱的 `history.back()` 会让课程页面后退**、e10 路由题在 Safari 中无法完成（平台问题）；e12 测试没有覆盖协议白名单（黑名单解法能生成 `javascript:` 链接）；e10 路由题多处漏洞（XSS、修饰键、丢失查询参数）；e09 测验解释错误、日期验证与 e06 矛盾；e11 cookie 动机与 `Vary` 范围；e07 测试依赖计时 | 全部修改；平台新增历史记录保护、WebKit 焦点模拟、WebKit 课程验证；e10 路由题重新设计（待审查）；e07–e09、e11、e12 发布 |

## 已知限制与安全边界

- 沙箱 iframe 与主页面在测试的浏览器中**同一线程**：DOM/React 模式依靠插入循环体的时间型保护（1.5 秒）中止同步死循环；不经过循环的长时间同步计算（例如灾难性回溯的正则）仍可能卡住标签页，需要关闭页面。纯 TS 模式在 Worker 中运行，`terminate()` 已验证能中断死循环。
- 平台面向自学，**不防作弊**：测试与答案都在客户端；学生代码与测试框架运行在同一个沙箱中，理论上可以篡改测试结果（只会欺骗自己）。
- 练习中的 `fetch`、`localStorage`/`sessionStorage`、`alert` 都是**模拟**的（界面会标注）；真实行为需要在本地项目中验证（相关课程尚未编写）。
- 只支持平台提供的依赖（react、react-dom、Testing Library、vitest 子集），不支持安装任意 npm 包；不支持循环导入。
- `console.log(promise)` 无法显示 Promise 状态（显示 `Promise { <unknown> }`）；`%o` 不显示隐藏属性。
- Safari/WebKit 中，测试运行时的焦点是模拟的：`element.matches(':focus')` 这类选择器查询得不到模拟的焦点（`toHaveFocus()`、`document.activeElement` 和计算样式没有问题）。可见的预览中，脚本移动焦点（例如路由把焦点移到标题）在 Safari 中不起作用，这是浏览器对跨源 iframe 的限制。
- Safari/WebKit 中，沙箱页面不能用 `pushState` 修改路径（只能改查询参数和 `#` 片段）；`response.json()` 解析失败时是名为 `SyntaxError` 的 `DOMException`（课程中已说明）。
- 同步是单用户方案：同步密码保存在设备的 localStorage 中；任何拿到密码的人都能读写进度。
- 没有离线缓存（PWA）。

## 决策记录

| 决策 | 理由 |
|---|---|
| TypeScript 锁定 6.0.3 | npm `latest` 已是 7.0.2（Go 原生版），官方说明 7.0 不提供编程 API；浏览器内编译器需要 JS 版。7.0 与 6.0 类型检查行为对齐。 |
| CodeMirror 6 而非 Monaco | 移动端可用、体积小；补全/悬停/诊断全部来自同一个 TS 6.0.3 Worker，避免编辑器与判题版本不一致。 |
| 不用 esbuild-wasm | 运行用的 JS 由同一 TS 逐文件转译，沙箱用 blob URL 链接 ES 模块（支持顶层 await），减少一个数 MB 的依赖。 |
| 沙箱：同站点但不透明来源（`sandbox="allow-scripts allow-forms"`） | 不需要额外域名；实测无法访问主应用存储/DOM/cookie。需要 `allow-forms` 才会触发 submit 事件；表单真正跳转被 CSP `form-action 'none'` 拦截。 |
| 纯 TS 的 Worker 由沙箱 iframe 内部创建 | Worker 继承不透明来源与 CSP，无法访问主应用 IndexedDB，也无法联网。 |
| 沙箱运行时为经典脚本 IIFE，Worker 内联 | 不透明来源加载模块脚本需要 CORS；WebKit 不允许沙箱 Worker `importScripts` 自托管脚本。 |
| 控制台输出对齐 Node.js | 课文中的预期输出以 Node 为准，学习者本地运行时看到的一致。 |
| 跨设备同步：Vercel Function + Neon（新加坡） | 学习者要求跨设备；单用户密码；离中国大陆较近；本地优先、离线可用。 |
| 问 AI：服务端调用 `@anthropic-ai/sdk`，默认 `claude-opus-5-5`，开启服务端 refusal fallback（`fallbacks: "default"`） | 密钥不进浏览器；按 Anthropic 官方用法；模型可用 `AI_MODEL` 更换。 |
| 课程审核状态 | AI 起草的内容最高只标 `self-reviewed`（经过明确的二次检查），不冒称人工审核。 |
| React Router 打包进 React 运行时 | g13 需要真实的 React Router。平台本身已经依赖 react-router 8.5，和 React 打包在一起可以共用同一个 React 实例；代价是 React 运行时从约 612 KB 增加到约 815 KB（gzip 约 231 KB），React 类型组从约 1.1 MB 增加到约 1.5 MB。沙箱中不能修改路径，课程预览用 `createHashRouter`，测试用 `createMemoryRouter`。 |

## 阻塞与需要你处理的事项

1. **部署**：2026-10-20 已在 Vercel 控制台把项目和 GitHub 仓库 `mlt0727/typescript-workshop` 关联，之后每次推送到 `main` 都会自动部署（Vercel 连接器对团队作用域仍返回 403，部署状态通过访问线上站点核对）。
2. **问 AI 的密钥**：在 Vercel 项目 → Settings → Environment Variables 添加 `ANTHROPIC_API_KEY`（可选 `AI_MODEL`），然后重新部署。
3. 若在中国大陆访问 `*.vercel.app` 不稳定，可以绑定自己的域名。

## 下一步（按计划顺序）

1. h04：根据正在进行的独立审查修改，然后发布。
2. h05–h09（数据写入与校验、服务端错误、持久化、环境变量、认证的安全边界），每节同样：本机 Next.js 实测、两个浏览器验证、独立审查、修改、发布。h05 已开始（实验项目中已实测：无 JavaScript 的表单提交、Origin 检查、提交之后表单重置），练习尚未完成。
3. 项目 3（p3-01–p3-03）与 i03（服务端部署）。
4. 收尾：为“课程更新后草稿处理”补充 e2e；全部课程在两个浏览器中重新验证；typecheck、lint、单元测试、构建、e2e 全部重跑；更新本文件中的自动化检查表（表中的全量验证记录仍是 89 节时的结果，之后每节课都单独在两个浏览器中验证过，但还没有重新做全量验证）。
