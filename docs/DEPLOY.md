# 部署说明

本文记录 TypeScript 工坊自身的部署方式。课程中“部署你自己的网站”的教学内容见 I 阶段的 i01–i03。

## 当前线上部署（2026-10-27）

| 项 | 值 |
|---|---|
| 网址 | https://typescript-workshop-jade.vercel.app |
| 托管 | Vercel Hobby（免费计划），项目 `typescript-workshop` |
| 函数区域 | `iad1`（美国东部，华盛顿特区），在 `vercel.json` 的 `regions` 中设置 |
| 数据库 | Neon Postgres 免费计划，项目 `typescript-workshop-us`，区域 `aws-us-east-1`（美国东部，弗吉尼亚北部），表 `tsw_sync` |
| 源码 | https://github.com/mlt0727/typescript-workshop（`main` 分支） |

> 免费计划的额度与条款可能变化，本项目不保证任何云服务永久免费。
> 函数和数据库要放在同一个地区：同步的每次读写都要查询数据库，跨洋往返会让每个请求都变慢。

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

项目最初是通过 Vercel REST API 以“GitHub 源 + 指定提交”的方式创建并部署的。之后在 Vercel 控制台中连接了 `mlt0727/typescript-workshop` 仓库：现在每次推送到 `main` 都会自动部署到生产环境（2026-10-20 查看部署列表，每个部署都对应一个推送的提交）。

## 部署后如何验证

```bash
# 1. API 是否在线、同步与 AI 是否已配置
curl https://typescript-workshop-jade.vercel.app/api/health
# 期望：{"ok":true,"sync":true,"ai":false}（配置了 ANTHROPIC_API_KEY 时 ai 为 true）
# 它只说明变量设置了，不连接数据库；数据库能不能用，要在设置页实际同步一次

# 函数运行的区域：X-Vercel-Id 的第二段
curl -sI https://typescript-workshop-jade.vercel.app/api/health | grep -i x-vercel-id
# 期望：iad1::iad1::…

# 2. 未带密码访问同步接口应被拒绝
curl -i https://typescript-workshop-jade.vercel.app/api/sync
# 期望：HTTP 401

# 3. 深层路由刷新、安全响应头
curl -sI https://typescript-workshop-jade.vercel.app/learn/a08-optional-chaining-nullish | grep -i content-security-policy
curl -sI https://typescript-workshop-jade.vercel.app/sandbox/index.html | grep -i content-security-policy
```

在浏览器中：打开任一课 → 示例显示“类型检查通过” → 点击“运行”看到输出 → React 课的预览中点击按钮界面会更新 → 设置页输入同步密码后显示“已同步”。

仓库中的 `.debug/` 不提交；作者用 Playwright 写的线上冒烟脚本做了上述检查，结果记录在 `docs/STATUS.md`。

## 更换区域（2026-10-21 至 10-27 实际做过一次：新加坡 → 美国东部）

1. 在 Neon 新建一个项目，区域选和函数相同的地区；建表 `tsw_sync`（第一次请求时也会自动创建），把旧库中的行复制过去（只有一行，`id = 'main'`）。
2. `vercel.json` 的 `regions` 改为对应的 Vercel 区域，推送。
3. Vercel → Settings → Environment Variables：把 `DATABASE_URL` 换成新项目的连接串（Production 与 Preview），然后在 Deployments 中重新部署最新的生产部署（环境变量只在新的部署中生效）。
4. 用上面的方法验证，在设置页同步一次，确认新库有访问、旧库没有访问之后，再在 Neon 控制台删除旧项目（Settings → Delete project）。确认框写着不可撤销，但实测删除的项目会出现在可恢复列表中，7 天内可以用 `neon projects recover <项目 id>` 或 API 恢复。

## 回滚

- Vercel 控制台 → 项目 → Deployments，选择之前一个状态为 Ready 的生产部署 → “Promote to Production”（或 “Instant Rollback”）。静态资源与函数会一起回到那次部署的版本。
- 回滚不会改动数据库里的同步数据。同步文档的格式带有 `schemaVersion`，较旧的前端会拒绝无法识别的新格式，而不是覆盖它。
- 如果需要撤销代码，在 Git 中 `git revert <提交>` 后推送并重新部署，保留历史记录。

## 日志

- Vercel 控制台 → 项目 → Logs：查看 `/api` 函数的运行日志。`api/index.ts` 把出错的请求写成一行 JSON（`server/log.ts`：只有方法、路径和错误的名字、信息、`cause`；数据库连接串、其中的密码、同步密码的哈希和 API 密钥换成 `[REDACTED]`），问 AI 的回答中途出错也会记一行。写到标准错误，按级别筛选时是 error。Hobby 计划的运行日志只保存 1 小时。
- 前端没有接入第三方监控或统计；浏览器中的错误只出现在开发者工具控制台。
