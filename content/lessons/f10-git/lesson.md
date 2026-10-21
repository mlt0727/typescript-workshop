---
version: 1
mode: ts
estimatedMinutes: 55
review: self-reviewed
problem: 改坏了想回到昨天的版本、两个人同时改了同一个文件、上线之后发现 bug 想知道是哪一次修改引入的，这些都需要版本控制。Git 是现在几乎所有项目使用的版本控制工具，也是 GitHub、持续集成（f12）和部署平台（Vercel 等）的基础。这一课建立 Git 的基本模型（工作区、暂存区、提交、分支），在本机走一遍提交、分支、合并、解决冲突、推送的完整流程，学会安全地撤销修改；并用代码解析 git status 的输出、实现 .gitignore 的匹配规则，把“Git 认为哪些文件变了、哪些文件被忽略”弄清楚。
objectives:
  - 说出工作区、暂存区、提交、分支、HEAD 的含义，用 status、add、commit、log、diff 完成日常的提交
  - 创建分支、合并分支，读懂并解决合并冲突；用远程仓库推送和拉取
  - 区分 restore、revert、reset 等撤销方式，知道哪些操作会丢失工作、哪些对已推送的提交是安全的
  - 读懂 git status 的状态码和 .gitignore 的规则（*、**、/、!、目录）
references:
  - title: Pro Git（第二版，中文）
    url: https://git-scm.com/book/zh/v2
    checked: 2026-10-20
  - title: git-status（Short Format）— Git
    url: https://git-scm.com/docs/git-status
    checked: 2026-10-20
  - title: gitignore — Git
    url: https://git-scm.com/docs/gitignore
    checked: 2026-10-20
  - title: git-restore — Git
    url: https://git-scm.com/docs/git-restore
    checked: 2026-10-20
  - title: About pull requests — GitHub Docs
    url: https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests
    checked: 2026-10-20
---

## Git 的模型

Git 管理的是项目在一个个时刻的**快照**：

- **工作区**：你正在编辑的文件，就是普通的文件夹；
- **暂存区**（index）：下一次提交要包含的内容。`git add` 把工作区中的修改放进暂存区，所以一次提交可以只包含部分修改；
- **提交**（commit）：暂存区内容的一个快照，加上作者、时间、说明，以及指向上一次提交的链接。每个提交有一个哈希值（例如 `7432bda`）作为名字；
- **分支**（branch）：一个指向某个提交的、会移动的名字。在 `main` 分支上提交时，`main` 就前进到新的提交；
- **HEAD**：“你现在在哪里”，通常指向当前的分支。

## 在自己的电脑上做一遍

先安装 Git（Windows 上从 [git-scm.com](https://git-scm.com/) 下载，macOS 上运行 `git --version` 会提示安装），然后设置一次你的名字和邮箱（会写进每个提交）：

1. `git config --global user.name "你的名字"`、`git config --global user.email "你的邮箱"`；
2. `git config --global init.defaultBranch main`：新仓库的默认分支叫 `main`；
3. 建议 `git config --global core.quotepath false`：这个选项在所有系统上默认都是 `true`，`git status` 中的中文文件名会显示成 `"\346\227\247.txt"` 这样的转义（下面的小任务会处理这种格式）；
4. `git config --global pull.rebase false`：本地和远程都有了新的提交时，`git pull` 用合并的方式把它们合在一起。不设置的话，Git 2.45（编写本课时使用的版本）在这种情况下直接报错 `fatal: Need to specify how to reconcile divergent branches.`，要你先选择合并还是变基（本课只讲合并）。

用 f02 的 `my-app` 练习（它已经有 `.gitignore`）：

| 命令 | 作用 |
| --- | --- |
| `git init` | 把当前文件夹变成一个仓库（创建 `.git` 文件夹） |
| `git status`（`-s` 是简短格式） | 哪些文件改了、哪些已暂存、哪些没有被跟踪 |
| `git add 文件`、`git add .` | 把修改放进暂存区 |
| `git diff`、`git diff --staged` | 工作区与暂存区的差别；暂存区与上一次提交的差别 |
| `git commit -m "说明"` | 提交暂存区的内容 |
| `git log --oneline --graph` | 提交历史 |

`git status --short` 每行两个字符的状态码，第一个是**暂存区**，第二个是**工作区**。编写本课时用 Git 2.45 实际得到的一组输出：

```text
M  a.txt
 M b.txt
MM c.txt
D  d.txt
R  old-name.txt -> new-name.txt
A  new.txt
?? logs/
?? untracked.txt
```

`a.txt` 修改后已暂存；`b.txt` 修改了还没暂存；`c.txt` 暂存之后又改了一次（两处都有修改）；`d.txt` 被删除并已暂存；`old-name.txt` 被重命名；`new.txt` 是新加的；`??` 表示没有被跟踪（Git 还不管它）。没有被跟踪的文件夹只显示文件夹的名字 `logs/`。

文件名中有空格、非 ASCII 字符（例如中文）或者其他特殊字符时，`git status` 会把它放在双引号中，并用 C 语言的写法转义。实际看到的是 `R  "\346\227\247.txt" -> "\346\226\260 \346\226\207\344\273\266.txt"`：每个 `\ooo` 是一个用八进制写出的字节，几个字节合起来是一个 UTF-8 编码的字符。

:::playground{#octal-escapes}
```ts file=main.ts
const bytes = new Uint8Array([0o346, 0o227, 0o247]);
console.log(new TextDecoder().decode(bytes));

const encoded = [...new TextEncoder().encode('新 文件')].map((b) => (b < 0x80 ? String.fromCharCode(b) : `\\${b.toString(8)}`));
console.log(encoded.join(''));
```
- 第 1、2 行：三个字节 `346`、`227`、`247`（八进制）按 UTF-8 解码是“旧”。
- 第 4 行反过来：`TextEncoder` 把字符串编码成 UTF-8 字节，ASCII 字符（包括空格）原样保留，其余的写成 `\ooo`，得到的正是 Git 输出中的样子。下面的小任务要把这种写法还原成文件名。
:::

**提交说明**写“做了什么、为什么”，第一行简短（例如 `修复分页：第 1 页从第 0 条开始`）。一次提交只做一件事，以后回看、撤销都容易。

## .gitignore：不该提交的文件

`node_modules`（f01）、构建结果 `dist`、编辑器的配置、含有密钥的 `.env`（e13 会讲），都不应该进入仓库。在 `.gitignore` 中写上它们的规则，Git 就不再把它们列为“没有被跟踪”。规则的要点（下面的编程挑战会实现它们）：

- 每行一条规则；空行和 `#` 开头的行被忽略；
- `*.log`：没有 `/` 的规则匹配**任何一层**的文件名或文件夹名；
- `/dist`、`doc/*.txt`：开头或中间有 `/` 的规则从仓库根目录（`.gitignore` 所在的位置）开始匹配；
- `logs/`：结尾的 `/` 表示只匹配文件夹；
- `*` 匹配除 `/` 以外的任意字符，`?` 匹配一个字符，`[abc]` 匹配其中一个；`**/` 匹配任意层的文件夹，结尾的 `/**` 匹配文件夹中的所有内容；
- `!` 开头表示**重新包含**；后面的规则覆盖前面的；
- 但是：**如果一个文件夹被忽略了，其中的文件无法再被重新包含**（Git 根本不会进入这个文件夹）。所以 `logs/` 加上 `!logs/keep.txt` 不起作用，要写成 `logs/*` 加上 `!logs/keep.txt`。

`.gitignore` 只影响**没有被跟踪**的文件。已经提交过的文件，加进 `.gitignore` 之后仍然会被跟踪，要先 `git rm --cached 文件` 把它从仓库中移除（文件本身保留）。如果密钥已经提交并推送了，从历史中删除它并不够，必须立即**作废这个密钥**，换一个新的。

::exercise{#parse-status}

## 分支与合并

在分支上开发新功能，不影响 `main`；完成之后再合并回来：

1. `git switch -c feature/title`：创建并切换到新分支（旧的写法是 `git checkout -b`）；
2. 修改、提交；
3. `git switch main`，然后 `git merge feature/title`。

两个分支修改了同一个文件的同一处时，合并会产生**冲突**。本机实际制造的一个冲突：

```text
$ git merge feature
Auto-merging README.md
CONFLICT (content): Merge conflict in README.md
Automatic merge failed; fix conflicts and then commit the result.
```

这时 `git status --short` 显示 `UU README.md`（两边都修改了），文件中是：

```text
<<<<<<< HEAD
标题：TS 工坊
=======
标题：TypeScript 练习场
>>>>>>> feature
作者：Ada
```

`<<<<<<< HEAD` 到 `=======` 之间是当前分支（`main`）的内容，`=======` 到 `>>>>>>> feature` 之间是要合并进来的分支的内容。解决冲突就是编辑这个文件，留下最终想要的内容，删掉三行标记，然后 `git add README.md`、`git commit`。不确定时可以 `git merge --abort`，回到合并之前的状态。

## 远程仓库与拉取请求

在 GitHub 上创建一个空的仓库，然后：

- `git remote add origin 仓库的地址`：记住远程仓库，名字叫 `origin`；
- `git push -u origin main`：把本地的 `main` 推送上去，`-u` 让以后直接 `git push` 就行；
- `git pull`：取回远程的新提交并合并到当前分支（设置了 `pull.rebase false` 时，相当于 `git fetch` 加 `git merge`，见上面的第 4 步）。

团队协作时通常不直接推送到 `main`：在分支上提交，推送分支，在 GitHub 上创建**拉取请求**（pull request，PR），别人审查代码、持续集成运行测试（f12）都通过之后再合并。

## 撤销：哪些安全，哪些会丢东西

| 想做的事 | 命令 | 注意 |
| --- | --- | --- |
| 放弃工作区中对某个文件的修改 | `git restore 文件` | 没有提交过的修改**找不回来** |
| 取消暂存（修改保留在工作区） | `git restore --staged 文件` | 安全 |
| 修改最后一次提交（说明或内容） | `git commit --amend` | 只用于**还没有推送**的提交 |
| 撤销一个已经推送的提交 | `git revert 提交` | 安全：新建一个“反向”的提交，不改写历史 |
| 回到某个提交，丢弃之后的一切 | `git reset --hard 提交` | 危险：工作区和之后的提交都会丢失 |

规则很简单：**已经推送的提交不要改写**（`amend`、`reset`、`rebase`），别人可能已经基于它们工作了；改写之后还要强制推送（`push --force`），会覆盖别人的提交。要撤销已推送的修改，用 `revert`。

f05 讲过二分法排错。`git bisect` 把它用在提交历史上：告诉 Git 一个“好的”提交和一个“坏的”提交，它每次切换到中间的一个，你测试之后告诉它好或坏，几次之后就找到了引入 bug 的那个提交。

## 编程挑战

::exercise{#gitignore}

::quiz

## 常见错误

- **把 `node_modules`、`dist`、`.env` 提交进仓库**：先写好 `.gitignore`。已经提交的用 `git rm --cached` 移除；密钥要作废。
- **以为 `logs/` 加 `!logs/keep.txt` 能保留一个文件**：被忽略的文件夹中的文件无法重新包含，写 `logs/*`。
- **一次提交包含好几件不相关的修改**：以后无法单独撤销其中一件。用 `git add 文件` 分开提交。
- **改写已经推送的历史**：用 `git revert` 撤销已推送的提交。
- **遇到冲突就慌**：冲突只是“两边都改了同一处，请你决定”。读懂标记，留下想要的内容，`git add` 后提交；或者 `git merge --abort`。
- **没有提交就 `git restore` 或 `reset --hard`**：没有提交过的修改无法恢复。不确定时先 `git stash` 或者提交到一个临时分支。
