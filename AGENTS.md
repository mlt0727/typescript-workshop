# AGENTS.md — 项目规则

TypeScript 工坊：中文交互式 TypeScript 学习平台（React 19 + Vite 8 静态前端 + 两个可选的 Vercel Function）。
规格见 `docs/SPEC.md`，进度见 `docs/STATUS.md`，计划见 `docs/PLAN.md`，课程编写见 `docs/AUTHORING.md`。

## 必须遵守

- **TypeScript 锁定 6.0.3**：浏览器内编译器需要 JS 版编译器 API，TS 7（Go 原生版）没有。不要升级到 `typescript@7`。改版本需同时改 `src/compiler/config.ts` 的 `TS_VERSION` 并重跑 `content:verify`。
- **编辑器诊断、提交判题、课程验证必须使用同一份配置**：只在 `src/compiler/config.ts` 修改编译选项。
- **平台代码永远不执行学生代码**：禁止在主页面或服务器中使用 `eval` / `new Function` / 动态执行学生代码（ESLint 已禁止）。学生代码只在 `sandbox/` 运行时里（不透明来源 iframe / Worker）执行。
- 沙箱 iframe 的 `sandbox` 属性只能是 `allow-scripts allow-forms`，不得加入 `allow-same-origin`、`allow-popups`、`allow-top-navigation`。主页面只通过专属 `MessageChannel` 接收消息，所有消息用 `src/shared/sandbox-protocol.ts` 的 schema 校验。
- 课程内容只来自仓库里的 `content/`，构建时处理。进度导入/同步数据只当作数据，经 `src/storage/schema.ts` 校验，从不渲染为 HTML、从不执行。
- 课时状态（`content/curriculum.yaml`）：只有通过 `content:verify` 且 `content:check` 无错误的课时才能标为 `published`。AI 起草的课时 `review` 必须是 `ai-draft` 或 `self-reviewed`，不得自行标为 `reviewed`。
- 不在仓库里提交任何密钥：`.env*`、`.secrets/`、`.data/` 已忽略。

## 目录

| 目录 | 内容 |
|---|---|
| `content/` | `curriculum.yaml`（完整课程图谱）、`lessons/<id>/`（`lesson.md`、`quiz.yaml`、`exercises/*.md`、`fixtures/*.json`）、`verification.json`（浏览器验证记录） |
| `src/compiler/` | 编译器 Worker 与核心（`core/` 与环境无关，Node 测试也直接使用） |
| `src/runner/` | 沙箱宿主；`src/judge/` 判题；`src/storage/` 进度存储；`src/features/` 界面 |
| `sandbox/` | 沙箱运行时源码（`npm run build:sandbox` 输出到 `public/sandbox/`）；`sandbox/types/vitest.d.ts` 是练习测试 API 的类型 |
| `server/`、`api/` | 同步与问 AI（Web 标准 `Request → Response`；本地开发由 `server/dev-plugin.ts` 挂到 Vite） |
| `scripts/` | `build-types.ts`、`build-content.ts`、`check-content.ts`、`build-sandbox.ts`、`new-sync-password.ts` |
| `tests/e2e/`、`tests/content/` | Playwright 端到端测试、课程验证 |
| `src/generated/`、`public/sandbox/`、`public/tsw-types/` | 生成物，不要手改，已被忽略 |

## 命令（均已在 Windows + Node 24.13 上实际运行过）

```bash
npm install
npx playwright install chromium webkit   # 浏览器测试需要
npm run dev            # 开发服务器 http://localhost:5173（含本地 /api）
npm run typecheck      # tsc -b（app / sandbox / node / test 四个项目）
npm run lint
npm test               # Vitest：node 与 jsdom 两个项目
npm run content:check  # 构建课程 + 发布验收静态检查
npm run build          # 生产构建（content:verify 与 test:e2e 依赖它）
npm run content:verify # 浏览器内验证全部课程（CONTENT_LESSONS=id1,id2 只验证部分）
npm run test:e2e       # 端到端测试（生产预览；E2E_DEV=1 用开发服务器）
```

在 Git Bash 中向 Playwright 脚本传以 `/` 开头的 URL 路径时，设置 `MSYS_NO_PATHCONV=1`。

## 代码风格

- 中文注释与界面文案；标识符用英文。
- 应用代码 import 使用 `.ts`/`.tsx` 扩展名；**被 `server/`/`api/` 引用的文件**（如 `src/storage/schema.ts`、`transfer.ts`）之间用 `.js` 扩展名，以便 Vercel 的 Node ESM 运行。
- React 组件不要在 effect 中同步 `setState`（ESLint react-hooks 规则会拦截），用派生状态或“渲染期间根据新值调整状态”。
