# 项目状态

最后更新：2026-10-20。本文件如实记录已完成、已验证与未完成的内容；“未验证”的项目会明确标出。

## 概览

| 方面 | 状态 |
|---|---|
| 平台功能（M1） | ✅ 最小完整学习闭环已实现并通过自动化测试 |
| 同步 / 问 AI / 部署（M2） | ✅ 同步与部署已上线并验证；问 AI 已实现，**未配置密钥，未做线上调用验证** |
| 课程编写 | ⚠ 已发布 **3 / 126** 节（三节均为提前编写的“代表案例”）；其余 123 节为规划中 |
| 课程审核 | ⚠ 3 节：浏览器自动验证 + 一轮独立 AI 审查 + 按意见修正（`self-reviewed`）；**没有人工审核** |
| 项目实验（I 阶段） | ⬜ 未开始 |
| Next.js 实验（H 阶段） | ⬜ 未开始 |

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
| 判题：类型 / 规则（AST）/ 行为三类检查，快照哈希，编辑后结果失效 | ✅ | e2e |
| 规则：any、类型断言（含泛型 querySelector）、非空断言、@ts-ignore/@ts-nocheck/@ts-expect-error | ✅ | 单元测试 |
| 沙箱隔离：不透明来源、CSP 禁网络与远程脚本、专属 MessageChannel、schema 校验、伪造消息无效 | ✅ | e2e（Chromium、WebKit） |
| 课页：讲解/示例/小任务/挑战/三级提示/答案确认/测验解释/参考资料/上一课下一课/先修提醒 | ✅ | e2e |
| 进度：IndexedDB 草稿与状态、刷新恢复、继续学习、导出/导入（合并或替换，非法文件拒绝且不破坏数据） | ✅ | e2e、单元测试 |
| 课程更新后草稿不被静默覆盖（提示“保留我的代码 / 改用新版”） | ✅ 已实现 | ⚠ 尚无专门的 e2e |
| 跨设备同步（单用户密码、乐观并发、可交换的合并、重置跟随） | ✅ | 单元测试；本地 e2e（两个浏览器上下文）；线上 API 读写验证 |
| 问 AI（服务端代理 Claude，`claude-opus-5-5`，流式，默认先给思路） | ✅ 已实现 | ⚠ 未配置 API 密钥，未做真实调用；接口鉴权与未配置时的降级有单元测试 |
| 浅色/深色、字号、可折叠目录、窄屏抽屉、目录搜索 | ✅ | e2e（手机/平板/桌面无横向溢出） |
| 课程内容管线与发布验收（`content:check`、`content:verify`、链接检查） | ✅ | 实际运行 |

## 已运行的检查（2026-10-20，Windows 11，Node 24.13）

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | 通过 |
| `npm run lint` | 通过 |
| `npm test` | 4 个文件、92 项全部通过 |
| `npm run content:check` | 已发布 3、错误 0、提醒 0 |
| `npm run content:links` | 14 个参考链接全部可访问 |
| `npm run content:verify` | a08：29/29，d07：20/20，g03：17/17 |
| `npm run build` | 通过；全新克隆后 `npm ci && npm run build` 也通过 |
| `npm run test:e2e`（Chromium，生产预览，含 CSP） | 33 项全部通过 |
| `npx playwright test --project=e2e-webkit`（管线与安全） | 18 项全部通过 |
| `npx playwright test -c playwright.sync.config.ts` | 2 项全部通过 |
| 线上冒烟（Playwright + curl） | 首页/深层路由/CSP 头/类型检查/运行/判题/React 预览正常；`/api/health` 显示同步已配置；同步接口 401/200/409 行为正确 |

**未验证**：Firefox（本机 Playwright 无法启动 Firefox：`spawn UNKNOWN`）；真实移动设备（只做了视口模拟）；问 AI 的真实模型调用；中国大陆网络下访问 `*.vercel.app` 的可用性。

## 已知限制与安全边界

- 沙箱 iframe 与主页面在测试的浏览器中**同一线程**：DOM/React 模式依靠插入循环体的时间型保护（1.5 秒）中止同步死循环；不经过循环的长时间同步计算（例如灾难性回溯的正则）仍可能卡住标签页，需要关闭页面。纯 TS 模式在 Worker 中运行，`terminate()` 已验证能中断死循环。
- 平台面向自学，**不防作弊**：测试与答案都在客户端；学生代码与测试框架运行在同一个沙箱中，理论上可以篡改测试结果（只会欺骗自己）。
- 练习中的 `fetch`、`localStorage`/`sessionStorage`、`alert` 都是**模拟**的（界面会标注）；真实行为需要在本地项目中验证（相关课程尚未编写）。
- 只支持平台提供的依赖（react、react-dom、Testing Library、vitest 子集），不支持安装任意 npm 包；不支持循环导入。
- `console.log(promise)` 无法显示 Promise 状态（显示 `Promise { <unknown> }`）；`%o` 不显示隐藏属性。
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

## 阻塞与需要你处理的事项

1. **问 AI 的密钥**：在 Vercel 项目 → Settings → Environment Variables 添加 `ANTHROPIC_API_KEY`（可选 `AI_MODEL`），然后重新部署。
2. **推送自动部署**：本次使用的 Vercel 连接器对你账号的团队作用域只有部分权限（无法读取构建日志、无法建立 Git 关联）。项目目前通过 API 按提交部署；如需推送后自动部署，请在 Vercel 控制台 → 项目 → Settings → Git 连接仓库。
3. 若在中国大陆访问 `*.vercel.app` 不稳定，可以绑定自己的域名。

## 下一步（按计划顺序）

1. M3：按先修顺序编写 A 阶段（共同语法）与 B 阶段（日常 TypeScript）及 E1–E4，每课通过 `content:verify`、独立审查后再发布。
2. 为“课程更新后草稿处理”补充 e2e。
3. M4：D、E5–E13、F、G 阶段与项目 1、项目 2，以及静态部署实验。
4. M5：C 阶段、Next.js 本地实验、项目 3、服务端部署说明。
