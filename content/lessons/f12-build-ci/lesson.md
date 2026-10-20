---
version: 1
mode: ts
estimatedMinutes: 55
review: ai-draft
problem: “在我的电脑上是好的”：你忘了提交一个文件、本机装着别人没有的全局工具、某个测试只在你的时区通过，这些问题都要等到别人拉取代码、或者部署之后才暴露出来。持续集成（CI）让每一次推送和每一个拉取请求都在一台干净的机器上，按同样的步骤安装依赖、检查类型、运行 lint 和测试、构建，任何一步失败就不能合并。这一课把 F 阶段的工具串成一条流水线：用 GitHub Actions 为这个网站自己的仓库配置 CI 并实际运行，理解 job 之间的依赖与条件；再看构建好的网站怎样自动部署到 Vercel。
objectives:
  - 列出发布之前要检查的事项：类型、lint、测试、构建、预览，以及 base、source map、环境变量等构建设置
  - 读懂并编写 GitHub Actions 的工作流：on、jobs、runs-on、steps、uses 与 run、缓存、产物
  - 用 needs 安排 job 的顺序，理解失败与跳过怎样沿着依赖传播，以及 if 中 success()、failure()、always() 的含义
  - 说明 Git 集成的自动部署与预览部署，以及静态网站的路由回退配置
references:
  - title: Workflow syntax for GitHub Actions — GitHub Docs
    url: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
    checked: 2026-10-20
  - title: Evaluate expressions in workflows and actions（Status check functions）— GitHub Docs
    url: https://docs.github.com/en/actions/reference/workflows-and-actions/expressions
    checked: 2026-10-20
  - title: actions/setup-node — GitHub
    url: https://github.com/actions/setup-node
    checked: 2026-10-20
  - title: Building for Production — Vite
    url: https://vite.dev/guide/build
    checked: 2026-10-20
  - title: Git deployments（Vercel for GitHub）— Vercel Docs
    url: https://vercel.com/docs/git/vercel-for-github
    checked: 2026-10-20
---

## 发布之前检查什么

把 F 阶段的每一课排在一起，就是一个项目在发布之前要通过的检查：

| 步骤 | 命令 | 发现什么问题 | 课程 |
| --- | --- | --- | --- |
| 安装依赖 | `npm ci` | 锁文件与 `package.json` 不一致；装到的版本和本机不同 | f01 |
| 类型检查 | `tsc --noEmit` 或 `tsc -b` | 类型错误（Vite 不检查类型） | f02、f03 |
| 静态检查与格式 | `npm run lint`、`prettier --check .` | 可能的 bug、不统一的格式 | f11 |
| 单元与组件测试 | `npm test` | 逻辑与交互的错误 | f06–f08 |
| 构建 | `npm run build` | 构建配置、导入路径的错误 | f02 |
| 端到端测试 | `npx playwright test` | 构建后的网站中的流程问题 | f09 |

构建的设置也要在发布之前确认：部署在子路径时的 `base`（f02）、是否生成与公开 source map（f04）、哪些环境变量会被打包进前端代码（e13 会讲，这是最容易泄露密钥的地方）。

## GitHub Actions

GitHub Actions 是 GitHub 自带的 CI。在仓库中添加 `.github/workflows/` 文件夹下的 YAML 文件，GitHub 就会在指定的事件发生时，启动一台新的虚拟机运行它。下面是这个网站自己的仓库中实际使用的工作流（`.github/workflows/ci.yml`）：

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    name: 类型检查、lint、单元测试、构建
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      # 生成类型库、课程数据与沙箱运行时（typecheck 需要其中的生成文件）
      - run: npm run prepare:assets
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - run: npm run content:check
      - run: npm run build
      - uses: actions/upload-artifact@v7
        with:
          name: dist
          path: dist
          retention-days: 7

  e2e:
    name: 端到端测试（Chromium）
    needs: check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - run: npx playwright test --project=e2e
      - uses: actions/upload-artifact@v7
        if: failure()
        with:
          name: playwright-traces
          path: test-results
          retention-days: 7
```

- `on`：什么时候运行。这里是推送到 `main`，以及任何拉取请求；
- `jobs`：一个或多个 job。每个 job 在一台**新的**虚拟机上运行（`runs-on: ubuntu-latest`），job 之间不共享文件；
- `steps`：一个 job 中依次执行的步骤，任何一步失败（退出码不为 0），后面的步骤就不再执行，这个 job 失败。`run` 执行一条命令；`uses` 使用别人写好的 action：`actions/checkout` 取出代码，`actions/setup-node` 安装指定版本的 Node.js，`cache: npm` 缓存 npm 下载的包（以锁文件的内容为键），`actions/upload-artifact` 把文件保存为这次运行的**产物**，可以在网页上下载；
- `@v7` 是 action 的主版本（编写本课时 checkout、setup-node、upload-artifact 的最新版本都是 v7）。写主版本可以自动得到修复，又不会遇到不兼容的修改；要求更严格时可以写完整的提交哈希。

## job 的顺序：needs 与 if

没有 `needs` 的 job **同时**开始。`e2e` 写了 `needs: check`，所以它等 `check` 成功之后才开始：类型或单元测试都没通过，就没必要再花几分钟跑端到端测试了。

失败会沿着依赖传播：GitHub 的文档写明，一个 job 失败或者被跳过时，所有 `needs` 它的 job 都会被跳过，除非这些 job 用条件表达式让自己继续运行。`if` 中可以用这几个状态函数：

| 写法 | 什么时候运行 |
| --- | --- |
| 不写（相当于 `success()`） | 依赖的 job 都成功了 |
| `failure()` | 有祖先 job（依赖的依赖也算）失败了。适合“失败时发通知”“失败时上传日志” |
| `always()` | 无论如何都运行（官方文档建议多数情况下改用 `!cancelled()`：工作流被取消时不运行） |

在 step 上也能用同样的条件：上面 `e2e` 的最后一步 `if: failure()`，只在前面某一步失败时才上传 Playwright 的 trace（f09），平时不浪费存储空间。

`strategy.matrix` 可以让同一个 job 用不同的参数各运行一遍，例如在两个 Node.js 版本上测试：

```yaml
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [22, 24]
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm test
```

job 能同时运行，所以整个工作流的耗时不是所有 job 的耗时之和，而是**最长的那条依赖链**（关键路径）：

:::playground{#critical-path}
```ts file=main.ts
type Job = { minutes: number; needs: string[] };

const jobs: Record<string, Job> = {
  lint: { minutes: 1, needs: [] },
  typecheck: { minutes: 1, needs: [] },
  test: { minutes: 2, needs: [] },
  build: { minutes: 1, needs: ['lint', 'typecheck', 'test'] },
  e2e: { minutes: 3, needs: ['build'] },
};

const finish = new Map<string, number>();
function finishOf(name: string): number {
  const known = finish.get(name);
  if (known !== undefined) return known;
  const job = jobs[name];
  if (!job) throw new Error(`没有 ${name}`);
  // 依赖中最晚完成的那个结束之后，这个 job 才开始
  const start = Math.max(0, ...job.needs.map(finishOf));
  finish.set(name, start + job.minutes);
  return start + job.minutes;
}

for (const name of Object.keys(jobs)) console.log(name.padEnd(10), `第 ${finishOf(name)} 分钟结束`);
const sum = Object.values(jobs).reduce((total, job) => total + job.minutes, 0);
console.log('依次运行：', sum, '分钟；并行运行：', Math.max(...finish.values()), '分钟');
```
- `lint`、`typecheck`、`test` 同时开始，`build` 要等最慢的 `test` 结束（第 2 分钟）。
- 把 `test` 改成 5 分钟再运行：总耗时变成 9 分钟，`lint` 和 `typecheck` 再快也没有用。缩短关键路径上的 job，才能让反馈更快。
:::

下面的小任务按照 `needs` 计算哪些 job 可以同时运行；编程挑战则模拟一次运行的结果：哪些 job 成功、失败、被跳过。

::exercise{#plan-jobs}

## 实际运行的结果

2026-10-20 把上面的工作流推送到这个网站的仓库之后，GitHub Actions 上第一次实际运行（提交 `c73dd6f`）的结果：

| job | 步骤与耗时 | 结论 |
| --- | --- | --- |
| 类型检查、lint、单元测试、构建 | `npm ci` 8 秒（安装 402 个包）、`prepare:assets` 8 秒、`typecheck` 8 秒、`lint` 5 秒、`npm test` 4 秒、`content:check` 8 秒、`build` 18 秒；整个 job 约 70 秒 | 成功 |
| 端到端测试（Chromium） | 在上一个 job 结束之后才开始；安装 Chromium 22 秒、构建 19 秒、46 个端到端测试 1.1 分钟；整个 job 约 2 分钟 | 成功 |

- `e2e` 中的 `setup-node` 输出了 `Cache restored successfully`：第一个 job 结束时保存的 npm 缓存被第二个 job 复用了；
- 因为没有失败，`e2e` 最后那个 `if: failure()` 的上传步骤显示为 skipped。

在 GitHub 的仓库设置中，可以把 CI 设为合并拉取请求的**必需检查**（branch protection / rulesets）：检查没有通过，拉取请求就不能合并。

## 自动部署

这个网站部署在 Vercel 上，仓库已经和 Vercel 的项目关联：每次推送到 `main`，Vercel 自动拉取代码、运行 `npm run build`，把 `dist` 发布为正式版本；每个拉取请求还会得到一个单独的**预览部署**，有自己的网址，合并之前就能在真实的环境中看到效果。

静态网站的路由回退（f02 的挑战）在这里是一份配置。这个网站的 `vercel.json` 中有：

```json
"rewrites": [
  { "source": "/api/:path*", "destination": "/api" },
  { "source": "/learn/:lessonId", "destination": "/index.html" },
  { "source": "/settings", "destination": "/index.html" }
]
```

`/learn/f12-build-ci` 这样的地址在 `dist` 中并没有对应的文件，重写规则让服务器返回 `index.html`，由前端的路由显示对应的课程。带哈希的 `/assets/` 文件则配置了长期缓存的响应头。

CI 和部署的分工：CI 回答“这次修改能不能合并”，部署平台负责“把合并后的代码发布出去”。部署平台自己也会构建一次，所以构建失败的版本不会上线；但只有 CI 才会运行测试。

## 编程挑战

::exercise{#run-workflow}

::quiz

## 常见错误

- **CI 中用 `npm install`**：可能修改锁文件、装到别的版本（f01）。用 `npm ci`。
- **以为 job 之间共享文件**：每个 job 都在新的虚拟机上运行，要用的文件要重新生成，或者用产物传递。
- **所有检查放在一个很长的 job 中，或者完全没有顺序**：快的检查（类型、lint、单元测试）放在前面，慢的端到端测试用 `needs` 排在后面，失败得越早，反馈越快。
- **用 `always()` 运行“取出代码”这类关键步骤**：工作流被取消时也会运行，可能一直挂起。多数情况下用 `!cancelled()`。
- **把密钥写进工作流文件**：用仓库的 Secrets（`${{ secrets.名字 }}`），日志中也会自动遮盖。
- **只有部署，没有 CI**：部署平台只会构建，不会运行测试和 lint。
