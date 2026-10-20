# 部署说明

本文记录 TypeScript 工坊自身的部署方式。课程中“部署你自己的网站”的教学内容另见课程 I 阶段（规划中）。

## 当前线上部署（2026-10-20）

| 项 | 值 |
|---|---|
| 网址 | https://typescript-workshop-jade.vercel.app |
| 托管 | Vercel Hobby（免费计划），项目 `typescript-workshop` |
| 函数区域 | `sin1`（新加坡） |
| 数据库 | Neon Postgres 免费计划，项目 `typescript-workshop`，区域 `aws-ap-southeast-1`（新加坡），表 `tsw_sync` |
| 源码 | https://github.com/mlt0727/typescript-workshop（`main` 分支） |

> 免费计划的额度与条款可能变化，本项目不保证任何云服务永久免费。
> `*.vercel.app` 域名在部分地区（包括中国大陆的部分网络）可能无法访问或较慢；如遇此情况可以绑定自己的域名，或在本地运行（见 README）。

## 环境变量

| 变量 | 必需 | 说明 |
|---|---|---|
| `SYNC_PASSWORD_HASH` | 同步需要 | 同步密码的 SHA-256 哈希（`npx tsx scripts/new-sync-password.ts` 生成）。服务器不保存密码本身。 |
| `DATABASE_URL` | 同步需要 | Neon Postgres 连接串。在 Vercel 中设为 Sensitive（不可回读）。 |
| `ANTHROPIC_API_KEY` | 可选 | 启用“问 AI”。不设置时按钮不出现。 |
| `AI_MODEL` | 可选 | 默认 `claude-opus-5-5`。 |
| `AI_EFFORT` | 可选 | `low` / `medium` / `high`，默认 `medium`。 |

修改环境变量后需要**重新部署**才会生效（已经运行的部署使用创建时的变量）。

## 部署步骤

### 方式 A：Vercel 控制台（推荐给自托管的读者）

1. 在 Vercel 导入 GitHub 仓库。框架选择 Vite；构建命令、输出目录、重写与响应头都由仓库根目录的 `vercel.json` 提供。
2. Settings → Environment Variables 中加入上表的变量（Production 与 Preview）。
3. 部署。之后每次推送到 `main` 会自动部署（需要仓库与项目已关联）。

### 方式 B：本仓库作者实际使用的方式

由于本次会话使用的 Vercel 连接器没有该账号团队作用域的完整权限，项目是通过 Vercel REST API 以“GitHub 源 + 指定提交”方式创建并部署的，**没有**建立自动部署的 Git 关联。要启用推送自动部署，可在 Vercel 控制台 → 项目 → Settings → Git 中连接 `mlt0727/typescript-workshop` 仓库。

## 部署后如何验证

```bash
# 1. API 是否在线、同步与 AI 是否已配置
curl https://typescript-workshop-jade.vercel.app/api/health
# 期望：{"ok":true,"sync":true,"ai":false}（配置了 ANTHROPIC_API_KEY 时 ai 为 true）

# 2. 未带密码访问同步接口应被拒绝
curl -i https://typescript-workshop-jade.vercel.app/api/sync
# 期望：HTTP 401

# 3. 深层路由刷新、安全响应头
curl -sI https://typescript-workshop-jade.vercel.app/learn/a08-optional-chaining-nullish | grep -i content-security-policy
curl -sI https://typescript-workshop-jade.vercel.app/sandbox/index.html | grep -i content-security-policy
```

在浏览器中：打开任一课 → 示例显示“类型检查通过” → 点击“运行”看到输出 → React 课的预览中点击按钮界面会更新 → 设置页输入同步密码后显示“已同步”。

仓库中的 `.debug/` 不提交；作者用 Playwright 写的线上冒烟脚本做了上述检查，结果记录在 `docs/STATUS.md`。

## 回滚

- Vercel 控制台 → 项目 → Deployments，选择之前一个状态为 Ready 的生产部署 → “Promote to Production”（或 “Instant Rollback”）。静态资源与函数会一起回到那次部署的版本。
- 回滚不会改动数据库里的同步数据。同步文档的格式带有 `schemaVersion`，较旧的前端会拒绝无法识别的新格式，而不是覆盖它。
- 如果需要撤销代码，在 Git 中 `git revert <提交>` 后推送并重新部署，保留历史记录。

## 日志

- Vercel 控制台 → 项目 → Logs：查看 `/api` 函数的运行日志（`api/index.ts` 会记录未捕获的错误）。
- 前端没有接入第三方监控或统计；浏览器中的错误只出现在开发者工具控制台。
