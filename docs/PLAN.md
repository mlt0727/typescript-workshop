# 实施计划

里程碑按依赖排序；每个里程碑完成后运行对应检查并更新 [STATUS.md](STATUS.md)。`[x]` 表示已完成且已验证，`[~]` 表示部分完成。

## M0 规格与环境（无依赖）

- [x] 检查目录、Git、Node/npm、gh、浏览器
- [x] 核实关键依赖版本、许可证、TS 7 与 6.0 的关系
- [x] 沙箱可行性实验（Chromium、WebKit）
- [x] docs/SPEC.md、PLAN.md、CURRICULUM.md、STATUS.md、AGENTS.md

## M1 最小完整学习闭环（依赖 M0）

平台：
- [x] 项目骨架：Vite + React + TS 配置、ESLint、Prettier、Vitest、Playwright
- [x] 课程内容管线：`content/` → zod schema 校验 → `src/generated/`（目录 + 每课 JSON 按需加载）
- [x] 编译器 Worker：TS 6.0.3、lib/依赖 `.d.ts` 自托管、诊断、补全、悬停、转译、AST 规则、循环保护转换器
- [x] 沙箱运行时：模块链接、ts/dom/react 三种模式、测试框架、模拟 fetch/localStorage、Testing Library
- [x] 沙箱宿主：iframe 生命周期、MessageChannel 协议、schema 校验、运行编号、超时、看门狗、停止
- [x] 判题：快照哈希、类型诊断、预期诊断、类型测试、行为测试、规则检查、中文诊断解释
- [x] 编辑器：CodeMirror 6、多文件标签、诊断/补全/悬停、浅深色
- [x] 课页：步骤渲染、示例、小任务、挑战、提示三级展开、答案、测验、参考资料
- [x] 存储：IndexedDB 草稿与进度、内容版本识别（不静默覆盖草稿）、存储失败提示
- [x] 进度导出/导入（schema、大小上限、版本检查）
- [x] 首页“继续学习/课程路线”、目录搜索、先修提醒、已发布/规划数量
- [x] 代表课：纯 TS（a08）、DOM（d07）、React（g03）——已发布，标注为代表案例
- [x] 测试：单元测试、e2e（核心验收清单）、课程验证（浏览器内跑全部变体）
- [ ] “课程更新后草稿处理”的专门 e2e

## M2 同步、AI、部署（依赖 M1；学习者追加要求）

- [x] `server/`：同步处理器（密码哈希校验、CAS、大小上限）、存储接口（Neon / 文件 / 内存）
- [x] `/api/sync`、`/api/ai`、`/api/health` + 单元测试
- [x] 客户端同步：拉取、合并、推送、冲突重试、离线、状态显示（本地 e2e 验证）
- [~] “问 AI”面板（已实现；等待学习者提供 API 密钥后做真实调用验证）
- [x] 生成同步密码，Neon 数据库，Vercel 项目与环境变量
- [x] 推送 GitHub、部署 Vercel、线上验证（深层路由、Worker、类型库、沙箱、同步接口）
- [ ] Vercel 项目与 GitHub 的自动部署关联（需要学习者在控制台操作，见 STATUS）

## M3 TypeScript 主线（依赖 M1）

- [x] A 阶段全部课时（共同语法）：a01–a20 已发布
- [ ] B 阶段全部课时（日常 TypeScript）：b01–b06 草稿已通过浏览器验证，待独立审查；b07–b17 未开始
- [ ] E1–E4（事件循环、Promise、async/await、组合方法）
- [ ] 每课：至少 1 挑战 + 2–4 测验 + ≥2 错误解 + ≥1 替代正确解，全部通过 `content:verify`
- [~] 独立二次审查（审查轮）并记录结果：A 阶段三轮审查（a01–a07、a09–a13、a14–a20）已完成并按意见修订，记录见 STATUS

## M4 浏览器与 React 项目主线（依赖 M3）

- [ ] D 阶段（HTML/CSS/DOM）
- [ ] E5–E13（fetch、校验、加载状态、取消与竞态、存储、URL、CORS、XSS、密钥边界）
- [ ] F 阶段（工程化、测试、调试、Git、构建与 CI），配本地实验项目
- [ ] G 阶段（React + TS）
- [ ] 项目 1（原生 TS 任务板）全部里程碑 + 导出
- [ ] 项目 2（React 项目管理面板）全部里程碑 + 导出
- [ ] 静态部署实验（本地生产构建、路由刷新、资源路径）

## M5 进阶与全栈（依赖 M4）

- [ ] C 阶段（进阶类型）
- [ ] H 阶段 Next.js 本地实验（核实当前稳定版文档）
- [ ] 项目 3（Next.js 基础全栈扩展）
- [ ] 服务端部署边界、日志与回滚

## 每阶段固定检查

`npm run typecheck` · `npm run lint` · `npm test` · `npm run content:check` · `npm run build` · `npm run content:verify` · `npm run test:e2e` · 浏览器人工检查（桌面 + 窄屏）
