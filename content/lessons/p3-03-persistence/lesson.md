---
version: 1
mode: ts
estimatedMinutes: 60
review: ai-draft
problem: p3-02 的接口已经能用了，但数据在内存中：服务器重启就没了；同时运行两个实例（多数部署都会这样做）时，每个实例有自己的一份数据，实测在一个实例上改了名称，另一个实例读到的还是旧的。这一课把存储换成 SQLite，并且只换存储：接口的代码一行都不用改。要解决的问题有四个：表怎么设计，表结构以后怎样修改（迁移），怎样一次读出一个项目和它的所有任务，以及怎样证明新的存储和旧的行为一样（测试）。结果都在实测的 Next.js 16.4.2 项目（Node.js 24.13 的 node:sqlite）中确认过。
objectives:
  - 为项目和任务设计两张表，用 NOT NULL、CHECK、外键和 UNIQUE 让数据库替你检查；知道 SQLite 用 0 和 1 保存布尔值
  - 用按编号执行、记录在 schema_migrations 中的迁移修改表结构，发现修改过的、多出来的和排错位置的迁移
  - 用一条 LEFT JOIN 读出项目和任务，避免 N+1 查询，并把行还原成嵌套的对象
  - "写一组同时运行在内存和 SQLite 两种实现上的合同测试，用 :memory: 数据库测试接口"
references:
  - title: SQLite（node:sqlite）— Node.js v24 文档
    url: https://nodejs.org/docs/latest-v24.x/api/sqlite.html
    checked: 2026-10-21
    note: DatabaseSync 的 enableForeignKeyConstraints 选项默认是 true
  - title: SQLite Foreign Key Support
    url: https://www.sqlite.org/foreignkeys.html
    checked: 2026-10-21
  - title: SQLite — Datatypes（没有单独的布尔类型）
    url: https://www.sqlite.org/datatype3.html
    checked: 2026-10-21
  - title: UPSERT — SQLite
    url: https://www.sqlite.org/lang_upsert.html
    checked: 2026-10-21
---

## 要做什么

这个里程碑的验收条件：

1. 服务器重启之后，数据还在；
2. 同一个数据库上运行的几个服务器实例看到的是同一份数据，并发的修改仍然由版本号挡住（p3-02 的 412）；
3. SQLite 的存储实现 p3-02 中的 `ProjectStore` 接口（`get`、`list`、`replace`），接口的处理函数不用改；
4. 同一组测试在内存和 SQLite 两种实现上都通过；
5. 服务器启动时自动执行还没有执行的迁移；代码和数据库的表结构对不上时，拒绝启动。

先看看内存中的存储有什么问题。实测项目用同一份构建启动两个实例（端口 3012 和 3013），在 3012 上修改项目的名称（200），再从 3013 读取：名称还是原来的“官网改版”。两个进程各有一份内存。下面的结果都来自 2026-10-21 在本机运行的实测项目。

## 两张表

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('planning', 'active', 'done')),
  due_date TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects (id),
  title TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE (project_id, position)
);
CREATE INDEX tasks_by_project ON tasks (project_id);
```

- 一个项目有多个任务，所以任务是另一张表，用 `project_id` 指向它的项目（**外键**），而不是把任务的数组存成一段 JSON：这样才能按任务查询、修改一个任务，数据库也能检查每个任务都有它的项目；
- 列名用 `snake_case`（SQL 的习惯），代码中用驼峰，读写时转换；时间和日期用 ISO 格式的文字（h07、p3-01）；
- 约束让数据库替你检查，就算程序有 bug 也写不进去。实测：插入 `done` 是 2 的任务，抛出 `CHECK constraint failed: done IN (0, 1)`；把状态改成 `'archived'`，抛出 `CHECK constraint failed: status IN (…)`，`errcode` 都是 275（`SQLITE_CONSTRAINT_CHECK`）；插入一个 `project_id` 不存在的任务，抛出 `FOREIGN KEY constraint failed`，`errcode` 是 787。

两个和 SQLite 有关的细节：

- **外键默认不检查**：这是 SQLite 本身为了兼容旧的数据库做的选择，每个连接都要执行 `PRAGMA foreign_keys = ON`。但实测 `node:sqlite` 的 `DatabaseSync` 默认已经打开了（`PRAGMA foreign_keys` 是 1，它的选项 `enableForeignKeyConstraints` 默认是 `true`）；传入 `{ enableForeignKeyConstraints: false }` 时，那个没有项目的任务就插进去了。实测项目的代码中仍然写了 `PRAGMA foreign_keys = ON`，不依赖默认值；
- **没有布尔类型**：`done` 保存的是 0 和 1，读出来是数字：实测 `typeof row.done` 是 `'number'`。读出来的行还是**没有原型的对象**（`Object.getPrototypeOf(row) === null`），在 Node.js 中打印出来是 `[Object: null prototype] { … }`。所以读出来的行不要直接当作 `StoredProject` 使用，而是逐个字段转换成新的对象（练习二）。

## 迁移：修改表结构的方法

表结构不是一次就定下来的：以后要加一列、加一个索引、拆一张表。生产环境的数据库中已经有数据，不能删掉重建，只能一步一步地修改。**迁移**就是这些步骤：

- 每个迁移是一段 SQL，有一个编号，例如 `0001_create_projects`、`0002_create_tasks`，按编号的顺序执行；
- 数据库中的 `schema_migrations` 表记录执行过哪些迁移，以及当时的**校验和**；
- 服务器启动时，比较代码中的迁移和这张表，执行还没有执行的迁移，每个迁移和它的记录在同一个事务中：失败时一起撤销；
- 执行过的迁移**永远不再修改**：要改表结构，就加一个新的迁移。

为什么要校验和？如果有人改了一个已经执行过的迁移，例如给 `0001` 中的表加了一列，新建的数据库（开发者的电脑、测试）中有这一列，已经存在的数据库（生产环境）中却没有，两边从此不一样，而且没有任何提示。校验和让这种修改在启动时就被发现。校验和对任何改动都敏感，哪怕只是一个空白：

:::playground{#checksums}
```ts file=main.ts
import { checksum } from './checksum';

const original = 'CREATE TABLE tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL)';
const reformatted = 'CREATE TABLE tasks (\n  id TEXT PRIMARY KEY,\n  title TEXT NOT NULL\n)';
const withColumn = 'CREATE TABLE tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, done INTEGER)';

console.log(checksum(original), checksum(original));
console.log(checksum(reformatted), checksum(withColumn));
```
```ts file=checksum.ts readonly
/** 迁移文件内容的校验和：32 位的 FNV-1a，写成 8 位十六进制。改动任何一个字符（包括空白）结果都会变 */
export function checksum(text: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
```
- 第 7 行：同一段 SQL 的校验和总是一样；
- 第 8 行：只是换了格式，或者加了一列，校验和都不一样了。
:::

实测项目启动时执行了两个迁移，`schema_migrations` 中记下了 `0001_create_projects` 和 `0002_create_tasks` 的校验和；再启动一次，没有要执行的迁移。在 `0001` 的末尾加一个换行再启动：拒绝，`迁移 0001_create_projects 在执行之后被修改过`；用只有 `0001` 的旧代码连接这个数据库：拒绝，`数据库中有代码中没有的迁移：0002_create_tasks`。后一种情况在**回滚**时最常见：新版本执行了迁移，出了问题又部署回旧版本，数据库却回不去了（i03）。

::exercise{#plan-migrations}

## 一次读出项目和它的任务

读取一个项目，最直接的写法是两条查询：先读项目，再读它的任务。读取所有的项目时，这就变成了 1 条查询读项目，再为**每个项目**查一次任务，叫 **N+1 查询**。实测 500 个项目、每个 10 个任务（一个文件中的 SQLite 数据库）：

| 写法 | 查询的次数 | 每次读取的时间 |
| --- | --- | --- |
| N+1 | 501 | 约 21 毫秒 |
| 一条 `LEFT JOIN` | 1 | 约 3.4 毫秒 |

SQLite 在同一个进程中，一次查询很便宜，差别还不算大。换成通过网络访问的数据库（部署时多半如此，i03），每次查询都要等一个来回，几毫秒到几十毫秒，501 次就是几秒钟。所以实测项目用一条查询读出所有的数据：

```sql
SELECT p.*, t.id AS task_id, t.title AS task_title, t.done AS task_done, t.position AS task_position,
  t.created_at AS task_created_at, t.deleted_at AS task_deleted_at
FROM projects p LEFT JOIN tasks t ON t.project_id = p.id
ORDER BY p.created_at, p.id, t.position
```

结果是“平”的：每个任务一行，项目的列在每一行中重复；`LEFT JOIN` 让没有任务的项目也有一行，任务的列都是 `NULL`。代码要把这些行还原成嵌套的 `StoredProject`，同时把 0 和 1 换成布尔值。数据库中的数据不对（例如 `done` 是 2）时，这不是用户的错误，而是程序或者数据出了问题，所以**抛出**错误（接口返回 500），而不是像 p2-01 的业务规则那样返回一个结果。

::exercise{#join-rows}

## 写入：一个事务

`replace(next, expectedVersion)` 在一个事务中做两件事：

```ts
return transaction(db, () => {
  // 检查版本和修改在同一条语句中（h07）
  const { changes } = update.run(next.name, next.owner, /* … */ next.id, expectedVersion);
  if (changes === 0) return false; // 版本对不上，或者没有这个项目
  for (const task of next.tasks) upsertTask.run(task.id, next.id, task.title, task.done ? 1 : 0 /* … */);
  return true;
});
```

- `UPDATE projects SET …, version = ? WHERE id = ? AND version = ?`：版本对不上时，`changes` 是 0，什么都没有改（h07）；
- 任务用 **upsert**：`INSERT … ON CONFLICT (id) DO UPDATE SET …`，新的任务插入，已有的任务更新。任务从不真正删除（软删除只是设置 `deleted_at`），所以不用处理“少了的任务”；
- `transaction` 是 h07 中的 `BEGIN`、`COMMIT`、出错时 `ROLLBACK`：更新了项目、写任务时失败（例如 `position` 重复），项目的修改也一起撤销。

`DatabaseSync` 是同步的：一个进程中，一次 `replace` 从开始到结束不会有别的代码插进来。但几个进程共用一个数据库文件时，还是要靠 `WHERE version = ?`。实测两个实例共用一个 SQLite 文件：在 3012 上修改之后，3013 读到了新的名称和 `"v2"`；两个实例几乎同时收到基于 `"v2"` 的修改，一个返回 200，另一个返回 412。停掉服务器再启动，数据都还在。

## 测试：同一组测试，两种实现

`ProjectStore` 有两种实现了：p3-02 中内存的，和这一课的 SQLite。接口的处理函数依赖的是“它们的行为一样”。这件事可以写成测试：同一组测试，对每种实现各运行一遍，叫**合同测试**（contract test）：

```ts
const implementations: [string, (initial: StoredProject[]) => ProjectStore][] = [
  ['内存', (initial) => createMemoryStore(initial)],
  ['SQLite', (initial) => {
    const store = createSqliteStore(new DatabaseSync(':memory:'));
    for (const p of initial) store.insert(p);
    return store;
  }],
];

for (const [name, create] of implementations) {
  describe(`ProjectStore（${name}）`, () => {
    test('读取：没有这个项目是 null；有的话和保存的一样（任务按 position 排序）', async () => { /* … */ });
    test('列表：按创建的时间排序', async () => { /* … */ });
    test('替换：版本对上时写入，任务的增加、修改、软删除都保存下来', async () => { /* … */ });
    test('替换：版本对不上时什么都不写入', async () => { /* … */ });
    test('两个请求都基于版本 1：只有一个成功', async () => { /* … */ });
  });
}
```

`':memory:'` 是一个只在内存中的 SQLite 数据库：每个测试一个新的，速度快，互不影响，也不用清理。实测第一次运行，10 个测试中有 2 个失败，失败的都是**内存**的实现：p3-02 的内存存储原样返回保存的顺序，任务没有按 `position` 排序，列表也没有按创建的时间排序；SQLite 的实现因为 SQL 中写了 `ORDER BY`，都通过了。接口返回的数据没有受影响（`toProjectDto` 自己排了序），但这正是合同测试要发现的东西：两种实现在一个没有人注意的地方不一样。给内存的实现加上排序之后，全部通过。

接口本身也用真正的 SQLite 测试：`beforeEach` 中创建一个新的 `:memory:` 数据库，放入示例的项目，再用 p3-02 的方法造一个 `Request` 调用 `addTask`、`patchProject`，检查响应和数据库中的数据。实测项目中这些测试（加上合同测试和上面的实测）一共 14 个，用 Vitest 运行不到半秒。

::quiz

## 常见错误

- **把任务的数组存成 JSON 文本**：查询、修改一个任务都要读写整个项目，数据库也没法检查它。用两张表和外键。
- **依赖外键的默认值**：SQLite 本身默认不检查外键。明确地执行 `PRAGMA foreign_keys = ON`。
- **把读出来的行直接当作对象使用**：`done` 是数字，行没有原型，列名是 `snake_case`。逐个字段转换。
- **修改已经执行过的迁移**：新的数据库和旧的数据库从此不一样。加一个新的迁移；用校验和发现这种修改。
- **为每个项目查一次任务（N+1）**：通过网络访问数据库时，几百次查询就是几秒钟。用一条 `JOIN`。
- **只在内存的实现上测试**：两种实现的差别要等到上线才发现。同一组测试在两种实现上都运行。

## 下一步

项目 3 的服务器完成了：接口、校验、并发、持久化和测试。i03 把它部署出去：部署平台上 SQLite 的文件能不能保存，环境变量怎样设置，日志写什么，出了问题怎样回滚（以及迁移让回滚变难的地方）。
