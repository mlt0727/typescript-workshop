---
version: 1
mode: ts
estimatedMinutes: 55
review: ai-draft
problem: h05 的待办保存在服务器进程的内存中，服务器一重启就没了；部署到无服务器平台上，每个请求还可能落在不同的实例上，彼此看不到对方的数据。要让数据留下来，就要把它写到进程之外：一个文件，或者一个数据库。每一种都有自己的陷阱：几个请求同时读写同一个文件会互相覆盖，写到一半时读的人会读到残缺的内容；数据库能解决这些问题，但也要正确地使用它的约束、参数和事务。另外还有一个和存在哪里无关的问题：两个人同时修改同一条数据时，后提交的人会悄悄覆盖前一个人的修改。这一课在本机实测这些问题，然后实现两个可以移植的部分：带版本号的仓库（乐观并发），和一个排队、原子写入的 JSON 文件存储。
objectives:
  - 说出内存、本地文件、数据库各自适合的场景，以及在无服务器平台上的限制
  - 知道并发的“读出、修改、写回”会丢失更新，用排队解决单个进程中的问题
  - 用“写临时文件再 rename”原子地替换文件，处理 Windows 上 rename 暂时失败的情况
  - 使用数据库的约束、参数化的查询和事务，知道它们分别防止了什么
  - 用版本号实现乐观并发，冲突时返回 409 和当前的数据
references:
  - title: SQLite（node:sqlite）— Node.js v24 文档
    url: https://nodejs.org/docs/latest-v24.x/api/sqlite.html
    checked: 2026-10-21
    note: 实测使用 Node.js 24.13.0；node:sqlite 在这个版本中仍会打印 ExperimentalWarning
  - title: fs.rename — Node.js v24 文档
    url: https://nodejs.org/docs/latest-v24.x/api/fs.html#fspromisesrenameoldpath-newpath
    checked: 2026-10-21
  - title: Runtimes（File system support）— Vercel
    url: https://vercel.com/docs/functions/runtimes
    checked: 2026-10-21
  - title: Optimistic concurrency control — Wikipedia
    url: https://en.wikipedia.org/wiki/Optimistic_concurrency_control
    checked: 2026-10-21
---

## 要做什么

h05 的待办保存在一个模块级的数组中。这一课把数据搬到进程之外：

1. 内存、文件、数据库各自适合什么，在无服务器平台上有什么限制；
2. 用文件保存数据时的两个陷阱：丢失更新、读到写了一半的文件（练习二）；
3. 数据库的约束、参数和事务；
4. 两个人同时修改同一条数据：乐观并发（练习一）。

下面的结果来自 2026-10-21 在本机（Windows，Node.js 24.13）的实测：一部分在 h01 创建的 Next.js 16.4.2 项目中，一部分是直接运行的 Node.js 脚本。

## 内存：最简单，也最容易丢

模块级的变量在服务器进程中只有一份，所有的请求共用它，读写都很快。但实测：用 h05 的页面添加一条待办，列表中有了它；**重启**生产服务器之后再打开，列表是空的。另外：

- 部署到无服务器平台（例如 Vercel）时，同一时间可能有多个函数实例在运行，每个实例有自己的内存，一个实例中添加的数据另一个实例看不到；实例也随时可能被回收；
- 开发服务器修改代码之后会重新加载模块，模块级的变量也会被重置。

所以内存只适合缓存（丢了可以重新算出来的东西，h04），不适合保存数据。

## 文件：一台服务器上的简单办法

只有一台服务器、数据量不大时，一个 JSON 文件就够了。这个网站的同步功能在本地开发时就是这样保存数据的（`.data/sync.json`）。但有两个陷阱，下面用一个 Node.js 脚本实测：

```ts
async function increment() {
  const data = JSON.parse(await readFile('counter.json', 'utf8'));
  data.count += 1;
  await writeFile('counter.json', JSON.stringify(data));
}
```

- **丢失更新**：同时调用 20 次 `increment()`，文件中的 `count` 最后是 **1**。20 个调用都先读到了 0，各自加一，各自写回 1。把调用排成一队（前一个完成之后后一个才开始）之后，结果是 20；
- **读到写了一半的文件**：一边用 `writeFile` 覆盖一个约 8.6 MB 的 JSON 文件，一边同时读取它，两次实测中 50 次读取分别有 45 次和 50 次读到了不完整的 JSON，`JSON.parse` 失败；
- 先把新内容写到一个临时文件，再用 `rename` 把它换到原来的名字：同样的 50 次读取，**一次也没有**读到不完整的内容。但在 Windows 上，`rename` 的目标文件正被读取时，10 次中有 1 到 2 次失败，错误是 `EPERM`；稍后再试就能成功。

下面用一个模拟的“文件”在浏览器中重现第一个问题（每次读写都随机等几毫秒，像真的磁盘一样）：

:::playground{#lost-update}
```ts file=main.ts
let stored = JSON.stringify({ count: 0 });
const wait = () => new Promise((resolve) => setTimeout(resolve, Math.random() * 5));
const readFile = async () => {
  await wait();
  return stored;
};
const writeFile = async (text: string) => {
  await wait();
  stored = text;
};

async function increment() {
  const data: { count: number } = JSON.parse(await readFile());
  data.count += 1;
  await writeFile(JSON.stringify(data));
}

await Promise.all(Array.from({ length: 20 }, () => increment()));
console.log('同时修改 20 次：', JSON.parse(stored).count);

stored = JSON.stringify({ count: 0 });
let queue: Promise<unknown> = Promise.resolve();
const queued = () => (queue = queue.then(increment));
await Promise.all(Array.from({ length: 20 }, () => queued()));
console.log('排队修改 20 次：', JSON.parse(stored).count);
```
- 第 19 行：每次运行的结果可能不同，但几乎不会是 20：很多次 `increment` 读到的是同一个旧值；
- 第 23 行：每次 `then` 都接在上一次的后面，下一次读取一定在上一次写入之后。
:::

在 Linux 和 macOS 上，`rename` 可以替换一个正被读取的文件（读的人继续读旧的内容），不会有这个错误；这一点没有在本机实测。

文件存储还有两个不能绕过的限制：排队只在**一个进程**中有效，两个进程写同一个文件仍然会互相覆盖；无服务器平台上的文件系统通常不能用来保存数据，Vercel 的文档写明函数的文件系统是只读的，只有 `/tmp` 可以写（最多 500 MB），而且不会在实例之间共享、也不会长期保留。

::exercise{#json-store}

## 数据库：约束、参数和事务

数据库替你解决了文件存储的大部分问题：多个连接同时读写不会互相破坏，写入是原子的，还能只读取需要的那几行。只有一台服务器的项目可以用 SQLite（一个文件就是一个数据库），Node.js 自带了 `node:sqlite`；部署到无服务器平台的项目要用一个通过网络访问的数据库，这个网站的同步功能在部署环境中用的就是托管的 Postgres（Neon）。

实测项目中一个 Route Handler 使用 `node:sqlite`：

```ts
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync(':memory:');
db.exec('CREATE TABLE todos (id INTEGER PRIMARY KEY, title TEXT NOT NULL UNIQUE, version INTEGER NOT NULL DEFAULT 1)');
const insert = db.prepare('INSERT INTO todos (title) VALUES (?)');
insert.run('买牛奶');
```

实测的结果：

- 构建时类型检查报错：`Cannot find module 'node:sqlite'`。create-next-app 安装的 `@types/node` 是 `^20`（20.19），那时还没有这个模块；换成 `@types/node@24` 之后通过。运行时，服务器打印了 `ExperimentalWarning: SQLite is an experimental feature`：在 Node.js 24.13 中它还是实验性的功能；
- **约束**：再插入一次“买牛奶”，抛出 `UNIQUE constraint failed: todos.title`（`code` 是 `ERR_SQLITE_ERROR`，`errcode` 是 2067）。“标题不能重复”这样的规则写在数据库中，就算两个请求同时检查、都以为没有重复，也只有一个能写进去；
- **参数**：用参数插入标题 `x'); DROP TABLE todos; --`，它被当作普通的文字保存了下来，表还在，有 2 行。SQL 和数据分开传给数据库，数据永远不会被当成 SQL 执行；把用户的输入拼进 SQL 字符串就会有 SQL 注入的问题；
- **事务**：`BEGIN` 之后插入一条新的待办，再插入一条重名的（失败），`ROLLBACK`：第一条也没有留下，表中仍然是 2 行。几步操作要么全部完成，要么全部不做。

## 两个人同时修改：乐观并发

即使存储本身没有问题，还有一种覆盖和存在哪里无关：Alice 和 Bob 打开了同一条待办（都是第 1 版），Alice 改了标题，Bob 勾选了完成。Bob 提交时带着的是旧的标题，如果服务器只是“保存他提交的内容”，Alice 的修改就没了。

**乐观并发**给每条数据一个版本号，修改时带上“我是基于第几版改的”，用一条 SQL 同时检查和修改：

```sql
UPDATE todos SET title = ?, version = version + 1 WHERE id = ? AND version = ?
```

实测：第一次用版本 1 修改，`changes` 是 1，版本变成 2；第二次仍然用版本 1，`changes` 是 **0**，什么也没有改。程序看到 0，就知道数据已经被别人改过了：在 HTTP 接口中返回 409（h06）和当前的数据，由用户决定怎么办。检查和修改在同一条语句中完成，中间不会有别的请求插进来。这个网站的同步功能也是这样做的：推送时带上 `baseRevision`，和服务器上的 `revision` 不一致就返回 409 和当前的文档。

::exercise{#todo-repo}

::quiz

## 常见错误

- **用模块级的变量保存数据**：重启、部署、多个实例都会让它丢失（实测重启之后列表是空的）。
- **同时“读出、修改、写回”同一个文件**：实测 20 次只留下了 1 次。至少要排队；多个进程时用数据库。
- **直接覆盖正在被读的文件**：读的人会读到不完整的内容。先写临时文件，再 `rename`。
- **文件损坏时当作没有数据**：下一次写入会把它覆盖掉。抛出错误，让人来处理。
- **把用户的输入拼进 SQL**：用参数。
- **只在程序中检查“不能重复”**：两个请求可能同时通过检查。在数据库中加上 UNIQUE 约束。
- **修改时不带版本**：后提交的人会悄悄覆盖前一个人的修改。

## 下一步

h08 讲环境变量与配置：数据库的地址和密钥放在哪里，哪些配置会被打包进浏览器的代码，怎样在启动时检查它们。
