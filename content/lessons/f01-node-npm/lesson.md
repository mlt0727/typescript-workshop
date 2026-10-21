---
version: 1
mode: ts
estimatedMinutes: 50
review: self-reviewed
problem: 到目前为止，所有代码都运行在这个网站的沙箱里。真实的项目在你自己的电脑上：用 Node.js 运行构建工具和测试，用 npm 安装别人写好的包。打开一个项目，最先看到的就是 package.json 和 package-lock.json，它们决定了项目依赖哪些包、能接受哪些版本、npm run dev 实际执行什么。这一课讲清楚 Node.js 和浏览器的区别、package.json 中常用的字段、语义化版本与 ^、~ 这些范围的准确含义，以及锁文件为什么要提交、npm install 和 npm ci 有什么不同。最后在自己的电脑上做一遍。
objectives:
  - 说明 Node.js 与浏览器作为 JavaScript 运行环境的区别，知道为什么前端项目也需要 Node.js
  - 读懂 package.json 中的 name、version、type、scripts、dependencies、devDependencies、engines
  - 准确解释语义化版本，以及 ^、~、>=、|| 这些版本范围（包括 0.x 版本的特殊规则）
  - 知道锁文件的作用，区分 npm install 与 npm ci，并在本机创建一个项目、安装依赖、运行脚本
references:
  - title: package.json — npm Docs
    url: https://docs.npmjs.com/cli/v11/configuring-npm/package-json
    checked: 2026-10-20
  - title: package-lock.json — npm Docs
    url: https://docs.npmjs.com/cli/v11/configuring-npm/package-lock-json
    checked: 2026-10-20
  - title: npm ci — npm Docs
    url: https://docs.npmjs.com/cli/v11/commands/npm-ci
    checked: 2026-10-20
  - title: Semantic Versioning 2.0.0
    url: https://semver.org/lang/zh-CN/
    checked: 2026-10-20
  - title: node-semver（Advanced Range Syntax）— GitHub
    url: https://github.com/npm/node-semver#advanced-range-syntax
    checked: 2026-10-20
---

## Node.js：浏览器之外的 JavaScript

Node.js 是一个在浏览器之外运行 JavaScript 的程序。它和 Chrome 使用同一个 JavaScript 引擎（V8），但提供的“周边”完全不同：

| | 浏览器 | Node.js |
| --- | --- | --- |
| 有什么 | `document`、`window`、DOM 事件、`localStorage` | 文件系统（`node:fs`）、路径（`node:path`）、进程信息（`process`）、网络服务器 |
| 没有什么 | 不能直接读写本机的文件 | 没有 `document`、`window` |
| 主要用途 | 运行网页 | 运行工具（构建、测试、格式化）和服务器 |

即使最终的网站只在浏览器中运行，开发时也需要 Node.js：TypeScript 编译器、Vite、Vitest、ESLint 都是用 JavaScript 写的命令行工具，它们在 Node.js 上运行（a01 讲过 TS 代码运行在哪里）。

Node.js 有“长期支持”（LTS）版本，适合大多数项目。本课程的仓库要求 Node.js 22.22 或更高，编写时使用的是 Node.js 24。安装 Node.js 时会一起安装 **npm**：它是包管理器，从 [npm 仓库](https://www.npmjs.com/) 下载别人发布的包。

## package.json：项目的说明书

每个 Node.js 项目的根目录都有一个 `package.json`。一个 Vite 项目的 `package.json` 大致是这样（F 阶段后面会创建它）：

```json
{
  "name": "my-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "typescript": "~6.0.3",
    "vite": "^8.3.4"
  }
}
```

| 字段 | 含义 |
| --- | --- |
| `name`、`version` | 包的名字和版本。发布到 npm 时必需；`"private": true` 防止误发布 |
| `type` | `"module"`：项目中的 `.js` 文件按 ES 模块（`import`/`export`，a19）处理；`"commonjs"`：按 CommonJS（`require`）处理。不写时也按 CommonJS 处理，只是 Node.js 22.7（以及 20.19）起遇到含有 `import`/`export` 的文件会改按 ES 模块重新解析并给出警告，所以最好明确写出 |
| `scripts` | 命令的别名：`npm run build` 执行 `tsc && vite build`。运行时 `node_modules/.bin` 会被加入 `PATH`，所以能直接写 `vite`、`tsc` |
| `dependencies` | 运行时需要的包（例如 React） |
| `devDependencies` | 只在开发、构建、测试时需要的包（例如 TypeScript、Vite、Vitest） |
| `engines` | 需要的 Node.js 版本，例如 `{ "node": ">=22.22.0" }` |

对于构建成静态文件的前端项目，`dependencies` 和 `devDependencies` 的区别没有那么大（所有的包最后都会被打包进构建结果，或者完全不需要），但按“运行时是否需要”区分，能让读的人一眼看出项目的结构。

## 语义化版本与版本范围

npm 上的包都使用**语义化版本**（semver）：`主版本.次版本.修订号`，例如 `8.3.4`。

- **修订号**（PATCH）：修复 bug，不改变用法；
- **次版本**（MINOR）：增加新功能，旧的用法仍然可用；
- **主版本**（MAJOR）：有不兼容的修改，升级可能需要改代码；
- 主版本是 0 时（`0.y.z`），表示还在初期开发，**任何修改都可能不兼容**；
- 版本后面可以带**预发布标签**：`2.0.0-rc.1`，它排在 `2.0.0` 之前。

`package.json` 中写的通常不是一个版本，而是一个**范围**：

| 写法 | 含义 | 例子 |
| --- | --- | --- |
| `1.2.3` 或 `=1.2.3` | 恰好这个版本 | |
| `^1.2.3` | 不改变最左边非零的那一位 | `>=1.2.3 <2.0.0` |
| `^0.2.3` | 同上：主版本是 0，就不改变次版本 | `>=0.2.3 <0.3.0` |
| `^0.0.3` | 同上：前两位都是 0，只能是这一个版本 | `>=0.0.3 <0.0.4` |
| `~1.2.3` | 只允许修订号变化 | `>=1.2.3 <1.3.0` |
| `>=1.2.0 <1.5.0` | 空格分隔的条件**同时**成立 | |
| `^1.0.0 \|\| ^3.0.0` | `\|\|` 分隔的条件**满足一组**即可 | |
| `*` | 任何版本 | |

开头那个 Vite 模板给 TypeScript 用的是 `~6.0.3`：TypeScript 的次版本也可能增加新的检查（升级后出现新的类型错误），所以只接受修订号的更新；Vite 用的是 `^8.3.4`。

`npm install vite` 默认在 `package.json` 中写入 `^当前最新版本`。即使你指定了版本（`npm install typescript@6.0.3`），写入的也是 `^6.0.3`；需要固定版本时加 `--save-exact`（简写 `-E`）。

预发布版本有一条特殊规则：带预发布标签的版本，只有在范围中某个条件**本身写的就是同一个 `主.次.修订` 的预发布版本**时，才可能满足它。所以 `1.2.3-beta.1` 不满足 `^1.2.0`（否则一个稳定版的范围会意外地装上测试版），而满足 `^1.2.3-beta.0`。

:::playground{#ranges}
```ts file=main.ts
type Version = [major: number, minor: number, patch: number];

const parse = (text: string): Version => {
  const [major = 0, minor = 0, patch = 0] = text.split('.').map(Number);
  return [major, minor, patch];
};

/** ^ 的上限：最左边非零的那一位加一 */
function caretUpper([major, minor, patch]: Version): Version {
  if (major > 0) return [major + 1, 0, 0];
  if (minor > 0) return [0, minor + 1, 0];
  return [0, 0, patch + 1];
}

for (const base of ['1.2.3', '0.2.3', '0.0.3']) {
  console.log(`^${base}`, '→', `>=${base} <${caretUpper(parse(base)).join('.')}`);
}
```
- 第 10–12 行就是 `^` 的规则：主版本不为 0 时，次版本、修订号可以变；主版本为 0 时，只允许修订号变；前两位都是 0 时，什么都不能变。
- 为什么 0.x 要更严格？因为语义化版本规定 0.x 期间任何修改都可能不兼容，`0.2.x` 到 `0.3.0` 就像 `1.x` 到 `2.0.0` 一样。
:::

## 锁文件：让每个人装到同样的版本

`^8.3.4` 允许装 `8.3.4`、`8.4.0`、`8.9.1`……今天装和下个月装，得到的版本可能不同；依赖的依赖更是如此。`package-lock.json` 记录了**整棵依赖树中每个包实际安装的版本**、下载地址和完整性校验（`integrity`），所以：

- **锁文件要提交到 Git**，`node_modules` 不要提交（它可以随时重新生成，而且很大）；
- `npm install`：按 `package.json` 安装。锁文件中的版本仍然满足范围时就用锁文件中的版本；`package.json` 改了范围、或者安装了新的包，会更新锁文件；
- `npm ci`：**严格按照锁文件**安装。它先删除整个 `node_modules`；如果 `package.json` 和锁文件不一致，直接报错，而不会修改锁文件。持续集成（f12）和部署时用它，保证装到的和你本机测试过的一模一样。

`npx 命令` 运行项目中安装的包提供的命令（`node_modules/.bin` 中的），例如 `npx tsc --version`；项目中没有这个包时，npx 会询问是否临时下载。

## 在自己的电脑上做一遍

下面的步骤在 Windows、macOS、Linux 上都一样（命令在终端中运行，Windows 可以用 PowerShell）。输出是编写本课时实际运行得到的，你看到的版本号可能更新。

1. 安装 Node.js 的 LTS 版本（[nodejs.org](https://nodejs.org/)），然后检查：`node --version`、`npm --version`（编写时是 `v24.13.0` 和 `11.6.2`）；
2. 新建一个文件夹并初始化：`mkdir f01-lab`、`cd f01-lab`、`npm init -y`。生成的 `package.json` 中，npm 11 会写入 `"type": "commonjs"`；
3. 安装一个开发依赖：`npm install --save-dev typescript@6.0.3`。打开 `package.json`，`devDependencies` 中是 `"typescript": "^6.0.3"`；文件夹中多了 `node_modules` 和 `package-lock.json`（`"lockfileVersion": 3`）；
4. 运行它提供的命令：`npx tsc --version`，输出 `Version 6.0.3`；
5. 在 `package.json` 的 `scripts` 中加一行 `"check": "tsc --version"`，然后 `npm run check`；
6. 删除 `node_modules`，运行 `npm ci`：它按锁文件重新安装了同样的版本。

## 练习之前：JavaScript 的正则表达式

F 阶段的几个练习要解析版本号、地址、错误信息这类文本，会用到正则表达式。语法和 Python 的 `re`、Java 的 `Pattern` 基本相同，这里只列出 JavaScript 中的写法和 TypeScript 中需要注意的地方：

:::playground{#regex}
```ts file=main.ts
const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;

console.log(VERSION.test('1.2.3'), VERSION.test('v1.2.3'));

const m = VERSION.exec('10.20.30');
if (m !== null) {
  const [, major, minor] = m;
  console.log(m[0], major, minor, m.index);
}
console.log(VERSION.exec('1.2'));

const named = /^(?<op>>=|<=|>|<|=)?(?<version>.+)$/.exec('>=1.2.3');
console.log(named?.groups?.['op'], named?.groups?.['version']);

console.log(/^(?:0|[1-9]\d*)$/.test('01'), /^[a-z]+$/i.test('Beta'));
console.log('a1b22c333'.match(/\d+/g));
console.log([...'x=1, y=22'.matchAll(/(\w)=(\d+)/g)].map((r) => `${r[1]}:${r[2]}`));
console.log('<b>粗</b><b>体</b>'.match(/<b>.*<\/b>/)?.[0], '<b>粗</b><b>体</b>'.match(/<b>.*?<\/b>/)?.[0]);
console.log('2026-10-20'.replace(/(\d+)-(\d+)-(\d+)/, '$3/$2/$1'));
```
- 正则写在两个 `/` 之间，后面可以跟标志：`i` 不区分大小写，`g` 找出所有匹配（`match` 返回所有匹配的字符串，`matchAll` 逐个返回带分组的结果）。`^`、`$` 是开头和结尾：不写它们时，`/\d+/` 在 `'v1.2.3'` 中也能找到；
- `re.test(s)` 只回答“有没有匹配”；`re.exec(s)` 没有匹配时返回 **`null`**，有匹配时返回一个数组：`[0]` 是整个匹配，`[1]`、`[2]`…… 是各个分组，`index` 是匹配开始的位置。所以第 5 行的结果要先和 `null` 比较；
- 开启 `noUncheckedIndexedAccess`（本课程的配置）时，`m[1]` 和解构出来的 `major` 的类型是 `string | undefined`，用之前还要处理 `undefined`（只有 `m[0]` 是 `string`）；
- `(?:…)` 只分组、不捕获；`(?<名字>…)` 是命名分组，结果在 `groups` 中（第 12 行）；
- 重复的次数：`*` 零次或多次，`+` 一次或多次，`?` 零次或一次，`{3}` 正好 3 次，`{3,}` 至少 3 次，`{1,3}` 1 到 3 次。`\d` 是数字，`\w` 是字母、数字或 `_`，`\s` 是空白。`\b` 是“单词边界”：它不匹配任何字符，只要求一边是 `\w` 中的字符、另一边不是（或者是开头、结尾），`/\bcat\b/` 不会在 `concatenate` 中找到 `cat`；
- `*`、`+` 默认是贪婪的，尽量多匹配；后面加 `?`（`.*?`）变成尽量少匹配，第 18 行的两个结果说明了区别；
- `replace` 的替换文字中，`$1`、`$2` 是对应的分组。正则中的 `/` 要写成 `\/`。
:::

::exercise{#compare-versions}

## 编程挑战

::exercise{#satisfies}

::quiz

## 常见错误

- **把 `node_modules` 提交到 Git**：又大又和平台有关。提交 `package.json` 和锁文件，`node_modules` 写进 `.gitignore`。
- **不提交锁文件**：每个人、每次部署装到的版本都可能不同，“我这里没问题”就无从谈起。
- **以为 `^0.2.3` 允许升级到 `0.3.0`**：`^` 不改变最左边非零的那一位。`^0.2.3` 只允许修订号变化（小于 `0.3.0`），`^0.0.3` 连修订号也不能变（小于 `0.0.4`）。
- **在持续集成中用 `npm install`**：它可能修改锁文件、装到别的版本。用 `npm ci`。
- **用字符串比较版本号**：`'1.10.0' < '1.9.0'` 是 `true`。要按数字逐段比较。
