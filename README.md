# TypeScript 工坊

免费开源的中文交互式 TypeScript 学习平台：**短篇讲解 → 讲解下方直接改代码、运行 → 立即动手的小任务 → 下一个知识点 → 编程挑战与小测验**。

- 浏览器内运行真实的 **TypeScript 6.0.3** 编译器做类型检查（编辑器诊断、提交判题与课程验证使用同一版本、同一配置）。
- 三种运行模式：**纯 TypeScript**（Web Worker）、**网页 DOM**（沙箱 iframe 预览）、**React 19**（沙箱 iframe 预览 + 组件测试）。
- 判题区分“运行过 / 类型正确 / 行为测试通过 / 已查看答案”，提交时冻结快照，代码一改旧结果即失效。
- 进度与草稿保存在本机浏览器（IndexedDB）；可选用一个同步密码在多台设备间同步；可选接入 Claude 做“问 AI”答疑。
- 学生代码只在不透明来源（`sandbox` 无 `allow-same-origin`）的 iframe / Worker 中运行，配合 CSP 禁止联网与远程脚本。

> 当前进度、已验证的内容与未完成事项见 [docs/STATUS.md](docs/STATUS.md)；课程图谱见 [docs/CURRICULUM.md](docs/CURRICULUM.md)（会如实显示“已发布 / 草稿 / 规划中”）。

## 环境要求

| 工具 | 版本 |
|---|---|
| Node.js | 22.22 或更高（开发与验证使用 24.13） |
| npm | 11（随 Node 安装） |
| 浏览器 | 近期版本的 Chrome / Edge / Safari（已在 Chromium 152 与 WebKit 上自动化测试；Firefox 在本机无法启动 Playwright，尚未验证） |

首次安装依赖与（可选的）下载测试浏览器需要联网；之后本地开发、类型检查与运行练习都不依赖任何 CDN。本项目**没有**实现离线缓存（PWA），关闭网络后刷新页面无法加载。

## 快速开始

```bash
npm install
npm run dev
```

打开 http://localhost:5173 。`npm run dev` 会先生成类型库、课程数据与沙箱运行时，再启动 Vite 开发服务器（同时监听沙箱运行时的改动）。

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发服务器（含本地 `/api`：同步数据写到 `.data/sync.json`） |
| `npm run build` | 生产构建到 `dist/`（类型库 → 课程 → 沙箱运行时 → 类型检查 → Vite 构建） |
| `npm run preview` | 本地预览生产构建（使用与 `vercel.json` 相同的 CSP 与路由规则；不含 `/api`） |
| `npm run typecheck` | 整个仓库的类型检查（应用 / 沙箱 / Node 脚本 / 测试四个项目） |
| `npm run lint` | ESLint |
| `npm test` | Vitest 单元测试（编译器核心、输出格式化与 Node 对照、存储合并与导入、服务端接口） |
| `npm run content:check` | 构建课程并做发布验收的静态检查 |
| `npm run content:verify` | 在真实浏览器中运行全部示例与练习变体（需先 `npm run build`） |
| `npm run content:links` | 检查课文参考链接是否可访问 |
| `npm run test:e2e` | Playwright 端到端测试（针对生产构建；`E2E_DEV=1` 时使用开发服务器） |

首次运行浏览器测试前安装浏览器：`npx playwright install chromium webkit`。

## 跨设备同步（可选）

本地学习不需要任何账号。若部署在 Vercel 上并希望多台设备共享进度：

1. 准备一个 Postgres 数据库（作者使用 Neon 免费套餐；任何支持 `@neondatabase/serverless` HTTP 驱动的 Neon 数据库均可）。表会在第一次请求时自动创建（`tsw_sync`）。
2. 生成同步密码与它的哈希：

   ```bash
   npx tsx scripts/new-sync-password.ts
   ```

   脚本会打印一个高强度随机密码（只显示一次，请自己保存）和对应的 SHA-256 哈希。
3. 在 Vercel 项目中设置环境变量：`SYNC_PASSWORD_HASH`（上一步的哈希）、`DATABASE_URL`（数据库连接串），然后重新部署。
4. 在每台设备上打开“设置 → 跨设备同步”，输入同步密码。

服务器只保存密码的哈希。这是**单人使用**的简易方案，不是多用户账号体系。合并规则：学习记录只增不减（曾通过、已读、曾答对取并集），草稿等会变化的数据取较新的一份。

本地开发时，把 `SYNC_PASSWORD_HASH=...` 写进 `.env.local`（已被 `.gitignore` 忽略）即可在 `npm run dev` 中测试同步。

## 启用“问 AI”（可选）

学习不依赖 AI。部署者如果想在练习旁使用“问 AI”：

1. 在 Vercel 项目中添加环境变量 `ANTHROPIC_API_KEY`（你的 Anthropic API 密钥）。可选：`AI_MODEL`（默认 `claude-opus-5-5`）、`AI_EFFORT`（`low` / `medium` / `high`，默认 `medium`）。
2. 重新部署。按钮只在服务器已配置密钥时出现，调用需要同步密码（防止他人消耗你的额度）。

密钥只存在服务器上，浏览器永远拿不到。请求会附带当前讲解、代码、类型错误与运行输出；默认先给思路而不是完整答案。API 按用量计费，费用由密钥所有者承担。

## 自托管与部署

- **Vercel（作者使用的方式）**：仓库根目录的 `vercel.json` 已配置构建命令、`/api` 函数、SPA 路由与安全响应头。把仓库导入 Vercel 即可；同步与 AI 的环境变量见上文。
- **任意静态主机**：`npm run build` 后部署 `dist/`。需要：（1）把 `/learn/*` 与 `/settings` 重写到 `/index.html`；（2）为页面设置与 `vercel.json` 等价的 CSP（`/sandbox/` 下使用沙箱专用的 CSP）。静态主机上没有 `/api`，同步与问 AI 会显示为不可用，其余功能完整。
- 部署步骤与回滚的详细说明见 [docs/DEPLOY.md](docs/DEPLOY.md)。

## 项目结构

```
content/            课程源（curriculum.yaml、课时 Markdown、练习、测验）与浏览器验证记录
docs/               规格、计划、课程图谱、进度、部署与课程编写指南
src/compiler/       TS 6.0.3 编译器 Worker（虚拟项目、诊断、AST 规则、运行用转译）
src/runner/         沙箱宿主（iframe 生命周期、MessageChannel 协议、超时与看门狗）
src/judge/          判题编排与中文诊断解释
src/storage/        IndexedDB 进度、导入导出、合并
src/features/       课程目录、课页、示例/练习工作区、测验、设置、同步、问 AI
sandbox/            沙箱运行时（模块链接、Node 风格输出、测试框架、模拟 fetch/Storage）
server/、api/       同步与 AI 的服务端（Vercel Function）
scripts/            类型库打包、课程构建与检查、沙箱构建
tests/              Playwright 端到端测试与课程验证
```

## 编写课程

见 [docs/AUTHORING.md](docs/AUTHORING.md)：课时格式、示例与练习的指令语法、发布验收清单。

## 许可证

- 平台代码与课程中的示例代码：[MIT](LICENSE)
- 原创课文：[CC BY 4.0](LICENSE-CONTENT.md)
- 第三方组件：见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
