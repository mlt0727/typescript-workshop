---
kind: task
title: 要执行哪些迁移
---
在 `migrate.ts` 中实现 `planMigrations(available, applied)`：服务器启动时比较代码中的迁移（`available`）和数据库的 `schema_migrations` 表中的记录（`applied`），决定要执行哪些迁移。校验和用只读的 `checksum.ts` 中的 `checksum(sql)` 计算。

按顺序检查，遇到第一个问题就返回 `{ ok: false, error }`：

1. `available` 中有两个迁移的 `id` 相同：`迁移的编号重复：{id}`；
2. `applied` 中有 `available` 中没有的 `id`（数据库比代码新）：`数据库中有代码中没有的迁移：{id}`；
3. `applied` 中的某个迁移，`checksum(代码中的 sql)` 和记录的 `checksum` 不同：`迁移 {id} 在执行之后被修改过`；
4. 有一个还没有执行的迁移，它的 `id` 排在已经执行的最后一个迁移的前面：`迁移 {id} 排在已经执行的 {最后一个执行过的 id} 前面`；

同一种问题有几个时，报告 `id` 排在最前面的那个。`id` 按字符串比较（`<`），和文件名的排序一样。都没有问题时返回 `{ ok: true, pending }`：还没有执行的迁移，按 `id` 排序（不管 `available` 中的顺序）。不要修改传入的数组。

:::files{role=support}
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
:::

:::files{role=starter}
```ts file=migrate.ts
import { checksum } from './checksum';

/** 代码中的一个迁移：id 是文件名，例如 '0002_add_tasks'，按字符串的顺序执行 */
export type Migration = Readonly<{ id: string; sql: string }>;

/** 数据库的 schema_migrations 表中的一行：已经执行过的迁移，以及当时的校验和 */
export type Applied = Readonly<{ id: string; checksum: string }>;

export type MigrationPlan = { ok: true; pending: readonly Migration[] } | { ok: false; error: string };

/** 比较代码中的迁移和数据库中的记录，决定要执行哪些；有任何不一致就拒绝启动 */
export function planMigrations(available: readonly Migration[], applied: readonly Applied[]): MigrationPlan {
  // TODO
  return { ok: true, pending: available };
}
```
```ts file=main.ts readonly
import { checksum } from './checksum';
import { planMigrations, type Migration } from './migrate';

const migrations: Migration[] = [
  { id: '0002_create_tasks', sql: 'CREATE TABLE tasks (id TEXT PRIMARY KEY, project_id TEXT NOT NULL)' },
  { id: '0001_create_projects', sql: 'CREATE TABLE projects (id TEXT PRIMARY KEY)' },
  { id: '0003_add_due_date', sql: 'ALTER TABLE projects ADD COLUMN due_date TEXT' },
];
const record = (m: Migration) => ({ id: m.id, checksum: checksum(m.sql) });
const [m2, m1] = migrations;

console.log('新的数据库：', planMigrations(migrations, []));
if (m1 !== undefined && m2 !== undefined) {
  console.log('执行过两个：', planMigrations(migrations, [record(m1), record(m2)]));
  console.log('改过 0001：', planMigrations([{ ...m1, sql: `${m1.sql} ` }, m2], [record(m1)]));
}
```
:::

:::files{role=solution}
```ts file=migrate.ts
import { checksum } from './checksum';

/** 代码中的一个迁移：id 是文件名，例如 '0002_add_tasks'，按字符串的顺序执行 */
export type Migration = Readonly<{ id: string; sql: string }>;

/** 数据库的 schema_migrations 表中的一行：已经执行过的迁移，以及当时的校验和 */
export type Applied = Readonly<{ id: string; checksum: string }>;

export type MigrationPlan = { ok: true; pending: readonly Migration[] } | { ok: false; error: string };

/** 比较代码中的迁移和数据库中的记录，决定要执行哪些；有任何不一致就拒绝启动 */
export function planMigrations(available: readonly Migration[], applied: readonly Applied[]): MigrationPlan {
  const sorted = available.toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const byId = new Map<string, Migration>();
  for (const migration of sorted) {
    if (byId.has(migration.id)) return { ok: false, error: `迁移的编号重复：${migration.id}` };
    byId.set(migration.id, migration);
  }

  const done = applied.toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  // 数据库比代码新：多半是部署了旧的代码（例如回滚），先报告这个
  const unknown = done.find((record) => !byId.has(record.id));
  if (unknown !== undefined) return { ok: false, error: `数据库中有代码中没有的迁移：${unknown.id}` };
  for (const record of done) {
    const migration = byId.get(record.id);
    if (migration !== undefined && checksum(migration.sql) !== record.checksum) return { ok: false, error: `迁移 ${record.id} 在执行之后被修改过` };
  }

  const appliedIds = new Set(done.map((record) => record.id));
  const pending = sorted.filter((migration) => !appliedIds.has(migration.id));
  const last = done.at(-1);
  const early = last === undefined ? undefined : pending.find((migration) => migration.id < last.id);
  if (early !== undefined && last !== undefined) return { ok: false, error: `迁移 ${early.id} 排在已经执行的 ${last.id} 前面` };
  return { ok: true, pending };
}
```
```ts file=main.ts readonly
import { checksum } from './checksum';
import { planMigrations, type Migration } from './migrate';

const migrations: Migration[] = [
  { id: '0002_create_tasks', sql: 'CREATE TABLE tasks (id TEXT PRIMARY KEY, project_id TEXT NOT NULL)' },
  { id: '0001_create_projects', sql: 'CREATE TABLE projects (id TEXT PRIMARY KEY)' },
  { id: '0003_add_due_date', sql: 'ALTER TABLE projects ADD COLUMN due_date TEXT' },
];
const record = (m: Migration) => ({ id: m.id, checksum: checksum(m.sql) });
const [m2, m1] = migrations;

console.log('新的数据库：', planMigrations(migrations, []));
if (m1 !== undefined && m2 !== undefined) {
  console.log('执行过两个：', planMigrations(migrations, [record(m1), record(m2)]));
  console.log('改过 0001：', planMigrations([{ ...m1, sql: `${m1.sql} ` }, m2], [record(m1)]));
}
```
:::

:::files{role=tests}
```ts file=migrate.test.ts
import { describe, expect, test } from 'vitest';
import { checksum } from './checksum';
import { planMigrations, type Applied, type Migration } from './migrate';

const M1: Migration = { id: '0001_create_projects', sql: 'CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL)' };
const M2: Migration = { id: '0002_create_tasks', sql: 'CREATE TABLE tasks (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects (id))' };
const M3: Migration = { id: '0003_add_due_date', sql: 'ALTER TABLE projects ADD COLUMN due_date TEXT' };

const record = (migration: Migration): Applied => ({ id: migration.id, checksum: checksum(migration.sql) });

describe('planMigrations', () => {
  test('新的数据库：全部按编号的顺序执行，不管传进来的顺序', () => {
    expect(planMigrations([M3, M1, M2], [])).toStrictEqual({ ok: true, pending: [M1, M2, M3] });
  });

  test('执行过一部分：只执行剩下的', () => {
    expect(planMigrations([M1, M2, M3], [record(M1), record(M2)])).toStrictEqual({ ok: true, pending: [M3] });
    expect(planMigrations([M1, M2, M3], [record(M2), record(M1), record(M3)])).toStrictEqual({ ok: true, pending: [] });
  });

  test('编号重复：拒绝', () => {
    const copy: Migration = { id: M2.id, sql: 'SELECT 1' };
    expect(planMigrations([M1, M2, copy], [])).toStrictEqual({ ok: false, error: '迁移的编号重复：0002_create_tasks' });
  });

  test('数据库中有代码中没有的迁移：数据库比代码新，拒绝启动', () => {
    expect(planMigrations([M1, M2], [record(M1), record(M2), record(M3)])).toStrictEqual({ ok: false, error: '数据库中有代码中没有的迁移：0003_add_due_date' });
  });

  test('执行过的迁移被修改了（哪怕只是空白）：拒绝', () => {
    const edited: Migration = { ...M2, sql: `${M2.sql} ` };
    expect(planMigrations([M1, edited, M3], [record(M1), record(M2)])).toStrictEqual({ ok: false, error: '迁移 0002_create_tasks 在执行之后被修改过' });
    // 还没有执行的迁移可以随便改
    expect(planMigrations([M1, M2, { ...M3, sql: 'ALTER TABLE projects ADD COLUMN due TEXT' }], [record(M1), record(M2)]).ok).toBe(true);
  });

  test('新加的迁移排在已经执行的前面：拒绝（例如两个分支各加了一个迁移）', () => {
    const late: Migration = { id: '0002_add_owner', sql: 'ALTER TABLE projects ADD COLUMN owner TEXT' };
    expect(planMigrations([M1, late, M2, M3], [record(M1), record(M2)])).toStrictEqual({ ok: false, error: '迁移 0002_add_owner 排在已经执行的 0002_create_tasks 前面' });
  });

  test('有几个问题时，报告按编号排在最前面的那个；顺序是：重复、多出来的、修改过的、排错位置的', () => {
    const editedM1: Migration = { ...M1, sql: 'CREATE TABLE projects (id TEXT)' };
    expect(planMigrations([editedM1, M2], [record(M1), record(M2), record(M3)])).toStrictEqual({ ok: false, error: '数据库中有代码中没有的迁移：0003_add_due_date' });
    expect(planMigrations([editedM1, { ...M2, sql: 'x' }], [record(M2), record(M1)])).toStrictEqual({ ok: false, error: '迁移 0001_create_projects 在执行之后被修改过' });
  });

  test('编号按字符串比较：0010 排在 0009 后面，9 排在 10 后面', () => {
    const a: Migration = { id: '0009_a', sql: 'a' };
    const b: Migration = { id: '0010_b', sql: 'b' };
    expect(planMigrations([b, a], [])).toStrictEqual({ ok: true, pending: [a, b] });
    // 没有补零的编号：'10_b' < '9_a'，所以编号要写成固定的位数
    const nine: Migration = { id: '9_a', sql: 'a' };
    const ten: Migration = { id: '10_b', sql: 'b' };
    expect(planMigrations([nine, ten], [])).toStrictEqual({ ok: true, pending: [ten, nine] });
  });

  test('不修改传入的数组', () => {
    const available = [M2, M1];
    const applied = [record(M2)];
    planMigrations(available, applied);
    expect(available).toStrictEqual([M2, M1]);
    expect(applied).toStrictEqual([record(M2)]);
  });
});
```
:::

:::hint{level=1}
先把两个数组复制一份并按 `id` 排序（`toSorted`），后面的“排在最前面的那个”就自然满足了。用一个 `Map<string, Migration>` 按 `id` 找代码中的迁移，放入时发现已经有了就是重复。
:::

:::hint{level=2}
还没有执行的迁移：从排好序的 `available` 中去掉 `applied` 中有的。第 4 条：取已经执行的最后一个 `id`（排序之后的最后一个），看还没有执行的迁移中有没有 `id` 比它小的。字符串之间可以直接用 `<` 比较。
:::

:::explanation
四种拒绝都是“代码和数据库对不上”，继续启动只会让问题更难发现：

- **编号重复**：两个人在不同的分支上都加了 `0003_…`，合并之后只有一个会被执行；
- **数据库比代码新**：多半是部署了旧的代码，例如新版本出了问题，又回滚到了旧版本，而新版本已经执行了迁移。旧的代码不知道新的表结构，可能读错或者写坏数据。这是 i03 要讨论的“回滚为什么难”；
- **执行过的迁移被修改了**：新建的数据库按修改之后的 SQL 建表，已经存在的数据库不会再执行它，两边从此不一样；
- **新的迁移排在已经执行的前面**：同样是两个分支各加了一个迁移，在一个数据库中先执行了 `0003_b`，另一个中先执行了 `0003_a`，顺序不同，结果可能也不同。

编号按字符串排序，所以要写成固定的位数：`0009` 排在 `0010` 前面，`9` 却排在 `10` 后面（测试中有这个例子）。

替代解用 `sort()` 排序 `id`，用相邻的两个 `id` 相同找出重复，用 `Set` 和 `filter` 算出还没有执行的迁移。
:::

:::variant{kind=alt name=sets}
```ts file=migrate.ts
import { checksum } from './checksum';

export type Migration = Readonly<{ id: string; sql: string }>;

export type Applied = Readonly<{ id: string; checksum: string }>;

export type MigrationPlan = { ok: true; pending: readonly Migration[] } | { ok: false; error: string };

const fail = (error: string): MigrationPlan => ({ ok: false, error });

export function planMigrations(available: readonly Migration[], applied: readonly Applied[]): MigrationPlan {
  // 字符串的 sort() 按 UTF-16 编码单元比较，和 < 的结果一样
  const ids = available.map((migration) => migration.id).sort();
  const duplicate = ids.find((id, index) => index > 0 && ids[index - 1] === id);
  if (duplicate !== undefined) return fail(`迁移的编号重复：${duplicate}`);

  const code = new Map(available.map((migration) => [migration.id, migration]));
  const recorded = new Map(applied.map((record) => [record.id, record.checksum]));
  const recordedIds = [...recorded.keys()].sort();

  const extra = recordedIds.find((id) => !code.has(id));
  if (extra !== undefined) return fail(`数据库中有代码中没有的迁移：${extra}`);
  const changed = recordedIds.find((id) => checksum(code.get(id)?.sql ?? '') !== recorded.get(id));
  if (changed !== undefined) return fail(`迁移 ${changed} 在执行之后被修改过`);

  const pending: Migration[] = [];
  for (const id of ids) {
    const migration = code.get(id);
    if (migration !== undefined && !recorded.has(id)) pending.push(migration);
  }
  const lastApplied = recordedIds.at(-1);
  const misplaced = lastApplied === undefined ? undefined : pending.find((migration) => migration.id < lastApplied);
  if (misplaced !== undefined && lastApplied !== undefined) return fail(`迁移 ${misplaced.id} 排在已经执行的 ${lastApplied} 前面`);
  return { ok: true, pending };
}
```
:::

:::variant{kind=wrong name=no-checksum fails=tests reason="没有比较校验和：修改过的迁移不会再执行，新的数据库和旧的数据库从此不一样"}
```ts file=migrate.ts
import { checksum } from './checksum';

/** 代码中的一个迁移：id 是文件名，例如 '0002_add_tasks'，按字符串的顺序执行 */
export type Migration = Readonly<{ id: string; sql: string }>;

/** 数据库的 schema_migrations 表中的一行：已经执行过的迁移，以及当时的校验和 */
export type Applied = Readonly<{ id: string; checksum: string }>;

export type MigrationPlan = { ok: true; pending: readonly Migration[] } | { ok: false; error: string };

/** 比较代码中的迁移和数据库中的记录，决定要执行哪些；有任何不一致就拒绝启动 */
export function planMigrations(available: readonly Migration[], applied: readonly Applied[]): MigrationPlan {
  const sorted = available.toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const byId = new Map<string, Migration>();
  for (const migration of sorted) {
    if (byId.has(migration.id)) return { ok: false, error: `迁移的编号重复：${migration.id}` };
    byId.set(migration.id, migration);
  }

  const done = applied.toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  // 数据库比代码新：多半是部署了旧的代码（例如回滚），先报告这个
  const unknown = done.find((record) => !byId.has(record.id));
  if (unknown !== undefined) return { ok: false, error: `数据库中有代码中没有的迁移：${unknown.id}` };

  const appliedIds = new Set(done.map((record) => record.id));
  const pending = sorted.filter((migration) => !appliedIds.has(migration.id));
  const last = done.at(-1);
  const early = last === undefined ? undefined : pending.find((migration) => migration.id < last.id);
  if (early !== undefined && last !== undefined) return { ok: false, error: `迁移 ${early.id} 排在已经执行的 ${last.id} 前面` };
  return { ok: true, pending };
}
```
:::

:::variant{kind=wrong name=input-order fails=tests reason="按传进来的顺序执行：读取文件的顺序没有保证，迁移可能在它依赖的表之前执行"}
```ts file=migrate.ts
import { checksum } from './checksum';

/** 代码中的一个迁移：id 是文件名，例如 '0002_add_tasks'，按字符串的顺序执行 */
export type Migration = Readonly<{ id: string; sql: string }>;

/** 数据库的 schema_migrations 表中的一行：已经执行过的迁移，以及当时的校验和 */
export type Applied = Readonly<{ id: string; checksum: string }>;

export type MigrationPlan = { ok: true; pending: readonly Migration[] } | { ok: false; error: string };

/** 比较代码中的迁移和数据库中的记录，决定要执行哪些；有任何不一致就拒绝启动 */
export function planMigrations(available: readonly Migration[], applied: readonly Applied[]): MigrationPlan {
  const sorted = available.toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const byId = new Map<string, Migration>();
  for (const migration of sorted) {
    if (byId.has(migration.id)) return { ok: false, error: `迁移的编号重复：${migration.id}` };
    byId.set(migration.id, migration);
  }

  const done = applied.toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  // 数据库比代码新：多半是部署了旧的代码（例如回滚），先报告这个
  const unknown = done.find((record) => !byId.has(record.id));
  if (unknown !== undefined) return { ok: false, error: `数据库中有代码中没有的迁移：${unknown.id}` };
  for (const record of done) {
    const migration = byId.get(record.id);
    if (migration !== undefined && checksum(migration.sql) !== record.checksum) return { ok: false, error: `迁移 ${record.id} 在执行之后被修改过` };
  }

  const appliedIds = new Set(done.map((record) => record.id));
  const pending = available.filter((migration) => !appliedIds.has(migration.id));
  const last = done.at(-1);
  const early = last === undefined ? undefined : pending.find((migration) => migration.id < last.id);
  if (early !== undefined && last !== undefined) return { ok: false, error: `迁移 ${early.id} 排在已经执行的 ${last.id} 前面` };
  return { ok: true, pending };
}
```
:::

:::variant{kind=wrong name=unknown-ignored fails=tests reason="忽略了数据库中多出来的迁移：旧的代码在新的表结构上运行（例如回滚之后）"}
```ts file=migrate.ts
import { checksum } from './checksum';

/** 代码中的一个迁移：id 是文件名，例如 '0002_add_tasks'，按字符串的顺序执行 */
export type Migration = Readonly<{ id: string; sql: string }>;

/** 数据库的 schema_migrations 表中的一行：已经执行过的迁移，以及当时的校验和 */
export type Applied = Readonly<{ id: string; checksum: string }>;

export type MigrationPlan = { ok: true; pending: readonly Migration[] } | { ok: false; error: string };

/** 比较代码中的迁移和数据库中的记录，决定要执行哪些；有任何不一致就拒绝启动 */
export function planMigrations(available: readonly Migration[], applied: readonly Applied[]): MigrationPlan {
  const sorted = available.toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const byId = new Map<string, Migration>();
  for (const migration of sorted) {
    if (byId.has(migration.id)) return { ok: false, error: `迁移的编号重复：${migration.id}` };
    byId.set(migration.id, migration);
  }

  const done = applied.toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  // 数据库比代码新：多半是部署了旧的代码（例如回滚），先报告这个
  for (const record of done) {
    const migration = byId.get(record.id);
    if (migration !== undefined && checksum(migration.sql) !== record.checksum) return { ok: false, error: `迁移 ${record.id} 在执行之后被修改过` };
  }

  const appliedIds = new Set(done.map((record) => record.id));
  const pending = sorted.filter((migration) => !appliedIds.has(migration.id));
  const last = done.at(-1);
  const early = last === undefined ? undefined : pending.find((migration) => migration.id < last.id);
  if (early !== undefined && last !== undefined) return { ok: false, error: `迁移 ${early.id} 排在已经执行的 ${last.id} 前面` };
  return { ok: true, pending };
}
```
:::

:::variant{kind=wrong name=no-order-check fails=tests reason="没有检查新的迁移是不是排在已经执行的后面：两个分支各加的迁移，在不同的数据库中执行的顺序不一样"}
```ts file=migrate.ts
import { checksum } from './checksum';

/** 代码中的一个迁移：id 是文件名，例如 '0002_add_tasks'，按字符串的顺序执行 */
export type Migration = Readonly<{ id: string; sql: string }>;

/** 数据库的 schema_migrations 表中的一行：已经执行过的迁移，以及当时的校验和 */
export type Applied = Readonly<{ id: string; checksum: string }>;

export type MigrationPlan = { ok: true; pending: readonly Migration[] } | { ok: false; error: string };

/** 比较代码中的迁移和数据库中的记录，决定要执行哪些；有任何不一致就拒绝启动 */
export function planMigrations(available: readonly Migration[], applied: readonly Applied[]): MigrationPlan {
  const sorted = available.toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const byId = new Map<string, Migration>();
  for (const migration of sorted) {
    if (byId.has(migration.id)) return { ok: false, error: `迁移的编号重复：${migration.id}` };
    byId.set(migration.id, migration);
  }

  const done = applied.toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  // 数据库比代码新：多半是部署了旧的代码（例如回滚），先报告这个
  const unknown = done.find((record) => !byId.has(record.id));
  if (unknown !== undefined) return { ok: false, error: `数据库中有代码中没有的迁移：${unknown.id}` };
  for (const record of done) {
    const migration = byId.get(record.id);
    if (migration !== undefined && checksum(migration.sql) !== record.checksum) return { ok: false, error: `迁移 ${record.id} 在执行之后被修改过` };
  }

  const appliedIds = new Set(done.map((record) => record.id));
  const pending = sorted.filter((migration) => !appliedIds.has(migration.id));
  const last = done.at(-1);
  const early = last === undefined ? undefined : pending.find((migration) => migration.id < last.id);
  return { ok: true, pending };
}
```
:::

:::variant{kind=wrong name=modified-first fails=tests reason="先报告修改过的迁移：真正的问题是数据库比代码新，报告的却是另一件事"}
```ts file=migrate.ts
import { checksum } from './checksum';

/** 代码中的一个迁移：id 是文件名，例如 '0002_add_tasks'，按字符串的顺序执行 */
export type Migration = Readonly<{ id: string; sql: string }>;

/** 数据库的 schema_migrations 表中的一行：已经执行过的迁移，以及当时的校验和 */
export type Applied = Readonly<{ id: string; checksum: string }>;

export type MigrationPlan = { ok: true; pending: readonly Migration[] } | { ok: false; error: string };

/** 比较代码中的迁移和数据库中的记录，决定要执行哪些；有任何不一致就拒绝启动 */
export function planMigrations(available: readonly Migration[], applied: readonly Applied[]): MigrationPlan {
  const sorted = available.toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const byId = new Map<string, Migration>();
  for (const migration of sorted) {
    if (byId.has(migration.id)) return { ok: false, error: `迁移的编号重复：${migration.id}` };
    byId.set(migration.id, migration);
  }

  const done = applied.toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  // 数据库比代码新：多半是部署了旧的代码（例如回滚），先报告这个
  for (const record of done) {
    const migration = byId.get(record.id);
    if (migration !== undefined && checksum(migration.sql) !== record.checksum) return { ok: false, error: `迁移 ${record.id} 在执行之后被修改过` };
  }

  const unknown = done.find((record) => !byId.has(record.id));
  if (unknown !== undefined) return { ok: false, error: `数据库中有代码中没有的迁移：${unknown.id}` };

  const appliedIds = new Set(done.map((record) => record.id));
  const pending = sorted.filter((migration) => !appliedIds.has(migration.id));
  const last = done.at(-1);
  const early = last === undefined ? undefined : pending.find((migration) => migration.id < last.id);
  if (early !== undefined && last !== undefined) return { ok: false, error: `迁移 ${early.id} 排在已经执行的 ${last.id} 前面` };
  return { ok: true, pending };
}
```
:::

:::variant{kind=wrong name=duplicate-ignored fails=tests reason="没有检查重复的编号：两个同名的迁移只有一个会被执行"}
```ts file=migrate.ts
import { checksum } from './checksum';

/** 代码中的一个迁移：id 是文件名，例如 '0002_add_tasks'，按字符串的顺序执行 */
export type Migration = Readonly<{ id: string; sql: string }>;

/** 数据库的 schema_migrations 表中的一行：已经执行过的迁移，以及当时的校验和 */
export type Applied = Readonly<{ id: string; checksum: string }>;

export type MigrationPlan = { ok: true; pending: readonly Migration[] } | { ok: false; error: string };

/** 比较代码中的迁移和数据库中的记录，决定要执行哪些；有任何不一致就拒绝启动 */
export function planMigrations(available: readonly Migration[], applied: readonly Applied[]): MigrationPlan {
  const sorted = available.toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const byId = new Map<string, Migration>();
  for (const migration of sorted) {
    byId.set(migration.id, migration);
  }

  const done = applied.toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  // 数据库比代码新：多半是部署了旧的代码（例如回滚），先报告这个
  const unknown = done.find((record) => !byId.has(record.id));
  if (unknown !== undefined) return { ok: false, error: `数据库中有代码中没有的迁移：${unknown.id}` };
  for (const record of done) {
    const migration = byId.get(record.id);
    if (migration !== undefined && checksum(migration.sql) !== record.checksum) return { ok: false, error: `迁移 ${record.id} 在执行之后被修改过` };
  }

  const appliedIds = new Set(done.map((record) => record.id));
  const pending = sorted.filter((migration) => !appliedIds.has(migration.id));
  const last = done.at(-1);
  const early = last === undefined ? undefined : pending.find((migration) => migration.id < last.id);
  if (early !== undefined && last !== undefined) return { ok: false, error: `迁移 ${early.id} 排在已经执行的 ${last.id} 前面` };
  return { ok: true, pending };
}
```
:::

