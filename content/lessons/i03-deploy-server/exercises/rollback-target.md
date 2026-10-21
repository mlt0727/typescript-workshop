---
kind: task
title: 回滚到哪一个部署
---
在 `rollback.ts` 中实现两个函数。数据库的 `schema_migrations` 中记着执行过的迁移，以及每个迁移是否**兼容**（`compatible`：之前版本的代码在执行了它之后还能运行，例如只加了一个可以为空的列）。

**`checkSchema(known, applied)`**：一个部署的代码（它认识的迁移是 `known`）能不能在这个数据库上运行。

1. 找出 `applied` 中 `known` 没有的迁移，按 `id` 的字符串顺序（`<`）排列；
2. 其中有不兼容的：`{ ok: false, error: '数据库中有不兼容的迁移：{id}' }`，`id` 是排在最前面的那个不兼容的迁移；
3. 否则 `{ ok: true, warnings }`，`warnings` 是每个多出来的迁移一条：`数据库中有代码中没有的迁移：{id}（兼容）`，按 `id` 排列。代码认识的迁移，不管兼容与否都没有关系。

**`pickRollbackTarget(deployments, currentId, applied)`**：从现在的部署往前，找一个可以回滚到的部署。

1. 没有 `id` 是 `currentId` 的部署：`{ ok: false, reason: '没有这个部署：{currentId}' }`；
2. 候选：`target` 是 `'production'`、`state` 是 `'READY'`、`createdAt` 早于现在的部署的部署（`createdAt` 都是同样格式的 UTC 时间，可以直接比较字符串），按 `createdAt` 从新到旧；没有候选：`{ ok: false, reason: '没有可以回滚到的生产部署' }`；
3. 按顺序用 `checkSchema(候选的 migrations, applied)` 检查，返回第一个可以运行的：`{ ok: true, target, warnings }`；
4. 都不能运行：`{ ok: false, reason: '没有能在现在的数据库上运行的部署（{最新的候选的 error}），只能向前修复' }`。

:::files{role=starter}
```ts file=rollback.ts
/** schema_migrations 中的一行：执行过的迁移，以及它是否和之前版本的代码兼容（只做扩展） */
export type AppliedMigration = Readonly<{ id: string; compatible: boolean }>;

export type Deployment = Readonly<{
  id: string;
  /** ISO 格式的时间 */
  createdAt: string;
  state: 'READY' | 'ERROR' | 'CANCELED';
  target: 'production' | 'preview';
  /** 这个部署的代码中有的迁移 */
  migrations: readonly string[];
}>;

export type SchemaCheck = { ok: true; warnings: readonly string[] } | { ok: false; error: string };

export type RollbackPlan = { ok: true; target: Deployment; warnings: readonly string[] } | { ok: false; reason: string };

/** 一个部署的代码能不能在这个数据库上运行：p3-03 的“数据库比代码新”的检查，放宽到兼容的迁移 */
export function checkSchema(known: readonly string[], applied: readonly AppliedMigration[]): SchemaCheck {
  // TODO
  return { ok: true, warnings: [] };
}

/** 从现在的生产部署往前找：第一个能在现在的数据库上运行的生产部署 */
export function pickRollbackTarget(deployments: readonly Deployment[], currentId: string, applied: readonly AppliedMigration[]): RollbackPlan {
  // TODO
  return { ok: false, reason: '' };
}
```
```ts file=main.ts readonly
import { pickRollbackTarget, type AppliedMigration, type Deployment } from './rollback';

const migrations = ['0001_create_projects', '0002_create_tasks'];
const deployments: Deployment[] = [
  { id: 'dpl_a', createdAt: '2026-10-01T00:00:00.000Z', state: 'READY', target: 'production', migrations },
  { id: 'dpl_b', createdAt: '2026-10-05T00:00:00.000Z', state: 'READY', target: 'production', migrations: [...migrations, '0003_add_owner_id'] },
  { id: 'dpl_c', createdAt: '2026-10-09T00:00:00.000Z', state: 'READY', target: 'production', migrations: [...migrations, '0003_add_owner_id', '0004_drop_owner'] },
];
const applied: AppliedMigration[] = [
  { id: '0001_create_projects', compatible: false },
  { id: '0002_create_tasks', compatible: false },
  { id: '0003_add_owner_id', compatible: true },
];

console.log('执行了 0003 之后从 dpl_b 回滚：', pickRollbackTarget(deployments, 'dpl_b', applied));
console.log('执行了 0004 之后从 dpl_c 回滚：', pickRollbackTarget(deployments, 'dpl_c', [...applied, { id: '0004_drop_owner', compatible: false }]));
```
:::

:::files{role=solution}
```ts file=rollback.ts
/** schema_migrations 中的一行：执行过的迁移，以及它是否和之前版本的代码兼容（只做扩展） */
export type AppliedMigration = Readonly<{ id: string; compatible: boolean }>;

export type Deployment = Readonly<{
  id: string;
  /** ISO 格式的时间 */
  createdAt: string;
  state: 'READY' | 'ERROR' | 'CANCELED';
  target: 'production' | 'preview';
  /** 这个部署的代码中有的迁移 */
  migrations: readonly string[];
}>;

export type SchemaCheck = { ok: true; warnings: readonly string[] } | { ok: false; error: string };

export type RollbackPlan = { ok: true; target: Deployment; warnings: readonly string[] } | { ok: false; reason: string };

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** 一个部署的代码能不能在这个数据库上运行：p3-03 的“数据库比代码新”的检查，放宽到兼容的迁移 */
export function checkSchema(known: readonly string[], applied: readonly AppliedMigration[]): SchemaCheck {
  const codeKnows = new Set(known);
  const unknown = applied.filter((migration) => !codeKnows.has(migration.id)).toSorted(byId);
  const breaking = unknown.find((migration) => !migration.compatible);
  if (breaking !== undefined) return { ok: false, error: `数据库中有不兼容的迁移：${breaking.id}` };
  return { ok: true, warnings: unknown.map((migration) => `数据库中有代码中没有的迁移：${migration.id}（兼容）`) };
}

/** 从现在的生产部署往前找：第一个能在现在的数据库上运行的生产部署 */
export function pickRollbackTarget(deployments: readonly Deployment[], currentId: string, applied: readonly AppliedMigration[]): RollbackPlan {
  const current = deployments.find((deployment) => deployment.id === currentId);
  if (current === undefined) return { ok: false, reason: `没有这个部署：${currentId}` };

  const candidates = deployments
    .filter((deployment) => deployment.target === 'production' && deployment.state === 'READY' && deployment.createdAt < current.createdAt)
    .toSorted((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  const [newest] = candidates;
  if (newest === undefined) return { ok: false, reason: '没有可以回滚到的生产部署' };

  for (const candidate of candidates) {
    const check = checkSchema(candidate.migrations, applied);
    if (check.ok) return { ok: true, target: candidate, warnings: check.warnings };
  }
  // 越旧的部署认识的迁移越少：最新的那个都不行，就只能向前修复
  const first = checkSchema(newest.migrations, applied);
  return { ok: false, reason: `没有能在现在的数据库上运行的部署（${first.ok ? '' : first.error}），只能向前修复` };
}
```
```ts file=main.ts readonly
import { pickRollbackTarget, type AppliedMigration, type Deployment } from './rollback';

const migrations = ['0001_create_projects', '0002_create_tasks'];
const deployments: Deployment[] = [
  { id: 'dpl_a', createdAt: '2026-10-01T00:00:00.000Z', state: 'READY', target: 'production', migrations },
  { id: 'dpl_b', createdAt: '2026-10-05T00:00:00.000Z', state: 'READY', target: 'production', migrations: [...migrations, '0003_add_owner_id'] },
  { id: 'dpl_c', createdAt: '2026-10-09T00:00:00.000Z', state: 'READY', target: 'production', migrations: [...migrations, '0003_add_owner_id', '0004_drop_owner'] },
];
const applied: AppliedMigration[] = [
  { id: '0001_create_projects', compatible: false },
  { id: '0002_create_tasks', compatible: false },
  { id: '0003_add_owner_id', compatible: true },
];

console.log('执行了 0003 之后从 dpl_b 回滚：', pickRollbackTarget(deployments, 'dpl_b', applied));
console.log('执行了 0004 之后从 dpl_c 回滚：', pickRollbackTarget(deployments, 'dpl_c', [...applied, { id: '0004_drop_owner', compatible: false }]));
```
:::

:::files{role=tests}
```ts file=rollback.test.ts
import { describe, expect, test } from 'vitest';
import { checkSchema, pickRollbackTarget, type AppliedMigration, type Deployment } from './rollback';

const M1: AppliedMigration = { id: '0001_create_projects', compatible: false };
const M2: AppliedMigration = { id: '0002_create_tasks', compatible: false };
/** 加一列 owner_id，可以为空：旧的代码不知道它，照样能运行 */
const M3: AppliedMigration = { id: '0003_add_owner_id', compatible: true };
/** 删除 owner 列：还在读写 owner 的代码不能运行 */
const M4: AppliedMigration = { id: '0004_drop_owner', compatible: false };

const deployment = (id: string, createdAt: string, migrations: readonly string[], extra: Partial<Deployment> = {}): Deployment => ({
  id,
  createdAt: `2026-10-${createdAt}T00:00:00.000Z`,
  state: 'READY',
  target: 'production',
  migrations,
  ...extra,
});

const D1 = deployment('dpl_1', '01', ['0001_create_projects', '0002_create_tasks']);
const D2 = deployment('dpl_2', '05', ['0001_create_projects', '0002_create_tasks', '0003_add_owner_id']);
const D3 = deployment('dpl_3', '09', ['0001_create_projects', '0002_create_tasks', '0003_add_owner_id', '0004_drop_owner']);

describe('checkSchema', () => {
  test('代码认识数据库中所有的迁移：可以运行，没有警告', () => {
    expect(checkSchema(D2.migrations, [M1, M2, M3])).toStrictEqual({ ok: true, warnings: [] });
  });

  test('代码中没有的迁移都是兼容的：可以运行，每个都给出一条警告', () => {
    const extra: AppliedMigration = { id: '0005_add_tags', compatible: true };
    expect(checkSchema(D1.migrations, [extra, M1, M3, M2])).toStrictEqual({
      ok: true,
      warnings: ['数据库中有代码中没有的迁移：0003_add_owner_id（兼容）', '数据库中有代码中没有的迁移：0005_add_tags（兼容）'],
    });
  });

  test('有一个不兼容的：不能运行，报告编号最前面的那个', () => {
    const later: AppliedMigration = { id: '0005_rename_status', compatible: false };
    expect(checkSchema(D1.migrations, [M1, M2, M3, later, M4])).toStrictEqual({ ok: false, error: '数据库中有不兼容的迁移：0004_drop_owner' });
  });

  test('代码认识的迁移即使不兼容也没有关系：它就是为那个表结构写的', () => {
    expect(checkSchema(D3.migrations, [M1, M2, M3, M4])).toStrictEqual({ ok: true, warnings: [] });
  });
});

describe('pickRollbackTarget', () => {
  test('回滚到上一个生产部署；数据库多出来的兼容迁移变成警告', () => {
    expect(pickRollbackTarget([D1, D2], 'dpl_2', [M1, M2, M3])).toStrictEqual({
      ok: true,
      target: D1,
      warnings: ['数据库中有代码中没有的迁移：0003_add_owner_id（兼容）'],
    });
  });

  test('跳过失败的、取消的、预览的部署，以及比现在的部署更新的部署', () => {
    const failed = deployment('dpl_failed', '07', D2.migrations, { state: 'ERROR' });
    const canceled = deployment('dpl_canceled', '08', D2.migrations, { state: 'CANCELED' });
    const preview = deployment('dpl_preview', '08', D2.migrations, { target: 'preview' });
    const newer = deployment('dpl_newer', '10', D2.migrations);
    const plan = pickRollbackTarget([newer, D3, preview, failed, canceled, D2, D1], 'dpl_3', [M1, M2, M3]);
    expect(plan).toMatchObject({ ok: true, target: { id: 'dpl_2' } });
  });

  test('传进来的顺序不影响结果：按创建的时间从新到旧找', () => {
    expect(pickRollbackTarget([D1, D3, D2], 'dpl_3', [M1, M2, M3])).toMatchObject({ ok: true, target: { id: 'dpl_2' } });
  });

  test('上一个部署不能在现在的数据库上运行时，继续往前找；都不行就只能向前修复', () => {
    // D3 执行了不兼容的 0004：D2 和 D1 都还在读写 owner 列
    expect(pickRollbackTarget([D1, D2, D3], 'dpl_3', [M1, M2, M3, M4])).toStrictEqual({
      ok: false,
      reason: '没有能在现在的数据库上运行的部署（数据库中有不兼容的迁移：0004_drop_owner），只能向前修复',
    });
  });

  test('只有更旧的部署能运行时，选它', () => {
    // 一个特殊的部署：它的代码中有 0003 和 0004 之外的另一套迁移
    const odd = deployment('dpl_odd', '07', ['0001_create_projects', '0002_create_tasks', '0099_other']);
    const withM4 = deployment('dpl_m4', '03', ['0001_create_projects', '0002_create_tasks', '0003_add_owner_id', '0004_drop_owner']);
    expect(pickRollbackTarget([withM4, odd, D3], 'dpl_3', [M1, M2, M3, M4])).toMatchObject({ ok: true, target: { id: 'dpl_m4' }, warnings: [] });
  });

  test('没有更早的生产部署；没有这个部署', () => {
    expect(pickRollbackTarget([D1], 'dpl_1', [M1, M2])).toStrictEqual({ ok: false, reason: '没有可以回滚到的生产部署' });
    expect(pickRollbackTarget([D1], 'dpl_9', [M1, M2])).toStrictEqual({ ok: false, reason: '没有这个部署：dpl_9' });
  });
});
```
:::

:::hint{level=1}
`checkSchema`：把 `known` 放进一个 `Set`，用 `filter` 找出它没有的迁移，排好序之后用 `find` 找第一个 `compatible` 是 `false` 的。
:::

:::hint{level=2}
`pickRollbackTarget`：`filter` 出候选，`toSorted` 按 `createdAt` 从新到旧，`for…of` 逐个检查，可以运行就 `return`。循环结束之后再对最新的那个候选调用一次 `checkSchema`，取出它的 `error` 放进说明中。
:::

:::explanation
这是 p3-03 中“数据库比代码新就拒绝”的放宽版本：拒绝的理由是旧的代码不知道新的表结构，但如果新的迁移只是加了东西（一张新的表、一个可以为空的新列），旧的代码根本用不到它们，照样能运行。所以每个迁移要写明它是否兼容，执行时记进 `schema_migrations`，判断的依据就从“有没有多出来的迁移”变成了“有没有多出来的**不兼容**的迁移”。

先扩展、后收缩（正文）就是为了让大多数迁移都是兼容的：只有最后的收缩（删除旧的列）是不兼容的，它要等到确定不会再回滚到还用着旧的列的版本之后才做。

找回滚的目标时只看生产环境中成功的部署：预览部署可能是一个没有合并的分支上的代码，失败的部署根本没有完成构建。从新到旧找，是为了尽量少丢掉中间的修复；最新的候选不能运行时继续往前找，通常也不会成功（越旧的代码认识的迁移越少），但部署之间的关系不一定这么简单。都不行时，回滚就不是办法了，只能向前修复：尽快发布一个修好的新版本。

替代解把 `applied` 复制一份按 `id` 排序，逐个检查，遇到第一个不兼容的就返回；时间用 `Date.parse` 转换成数字之后比较。
:::

:::variant{kind=alt name=sorted-scan}
```ts file=rollback.ts
export type AppliedMigration = Readonly<{ id: string; compatible: boolean }>;

export type Deployment = Readonly<{
  id: string;
  createdAt: string;
  state: 'READY' | 'ERROR' | 'CANCELED';
  target: 'production' | 'preview';
  migrations: readonly string[];
}>;

export type SchemaCheck = { ok: true; warnings: readonly string[] } | { ok: false; error: string };

export type RollbackPlan = { ok: true; target: Deployment; warnings: readonly string[] } | { ok: false; reason: string };

export function checkSchema(known: readonly string[], applied: readonly AppliedMigration[]): SchemaCheck {
  const warnings: string[] = [];
  // 按编号排序之后逐个看：遇到第一个不兼容的就停下
  for (const migration of [...applied].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    if (known.includes(migration.id)) continue;
    if (!migration.compatible) return { ok: false, error: `数据库中有不兼容的迁移：${migration.id}` };
    warnings.push(`数据库中有代码中没有的迁移：${migration.id}（兼容）`);
  }
  return { ok: true, warnings };
}

export function pickRollbackTarget(deployments: readonly Deployment[], currentId: string, applied: readonly AppliedMigration[]): RollbackPlan {
  const current = deployments.find(({ id }) => id === currentId);
  if (!current) return { ok: false, reason: `没有这个部署：${currentId}` };
  const before = Date.parse(current.createdAt);
  const candidates = deployments
    .filter((d) => d.target === 'production' && d.state === 'READY' && Date.parse(d.createdAt) < before)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  if (candidates.length === 0) return { ok: false, reason: '没有可以回滚到的生产部署' };

  let firstError = '';
  for (const candidate of candidates) {
    const check = checkSchema(candidate.migrations, applied);
    if (check.ok) return { ok: true, target: candidate, warnings: check.warnings };
    firstError ||= check.error;
  }
  return { ok: false, reason: `没有能在现在的数据库上运行的部署（${firstError}），只能向前修复` };
}
```
:::

:::variant{kind=wrong name=strict-unknown fails=tests reason="数据库中有任何代码中没有的迁移都拒绝（p3-03 原来的规则）：只加了一列，也不能回滚了"}
```ts file=rollback.ts
/** schema_migrations 中的一行：执行过的迁移，以及它是否和之前版本的代码兼容（只做扩展） */
export type AppliedMigration = Readonly<{ id: string; compatible: boolean }>;

export type Deployment = Readonly<{
  id: string;
  /** ISO 格式的时间 */
  createdAt: string;
  state: 'READY' | 'ERROR' | 'CANCELED';
  target: 'production' | 'preview';
  /** 这个部署的代码中有的迁移 */
  migrations: readonly string[];
}>;

export type SchemaCheck = { ok: true; warnings: readonly string[] } | { ok: false; error: string };

export type RollbackPlan = { ok: true; target: Deployment; warnings: readonly string[] } | { ok: false; reason: string };

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** 一个部署的代码能不能在这个数据库上运行：p3-03 的“数据库比代码新”的检查，放宽到兼容的迁移 */
export function checkSchema(known: readonly string[], applied: readonly AppliedMigration[]): SchemaCheck {
  const codeKnows = new Set(known);
  const unknown = applied.filter((migration) => !codeKnows.has(migration.id)).toSorted(byId);
  const breaking = unknown[0];
  if (breaking !== undefined) return { ok: false, error: `数据库中有不兼容的迁移：${breaking.id}` };
  return { ok: true, warnings: unknown.map((migration) => `数据库中有代码中没有的迁移：${migration.id}（兼容）`) };
}

/** 从现在的生产部署往前找：第一个能在现在的数据库上运行的生产部署 */
export function pickRollbackTarget(deployments: readonly Deployment[], currentId: string, applied: readonly AppliedMigration[]): RollbackPlan {
  const current = deployments.find((deployment) => deployment.id === currentId);
  if (current === undefined) return { ok: false, reason: `没有这个部署：${currentId}` };

  const candidates = deployments
    .filter((deployment) => deployment.target === 'production' && deployment.state === 'READY' && deployment.createdAt < current.createdAt)
    .toSorted((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  const [newest] = candidates;
  if (newest === undefined) return { ok: false, reason: '没有可以回滚到的生产部署' };

  for (const candidate of candidates) {
    const check = checkSchema(candidate.migrations, applied);
    if (check.ok) return { ok: true, target: candidate, warnings: check.warnings };
  }
  // 越旧的部署认识的迁移越少：最新的那个都不行，就只能向前修复
  const first = checkSchema(newest.migrations, applied);
  return { ok: false, reason: `没有能在现在的数据库上运行的部署（${first.ok ? '' : first.error}），只能向前修复` };
}
```
:::

:::variant{kind=wrong name=ignore-unknown fails=tests reason="完全不看数据库中多出来的迁移：回滚到了一个在新的表结构上会出错的版本"}
```ts file=rollback.ts
/** schema_migrations 中的一行：执行过的迁移，以及它是否和之前版本的代码兼容（只做扩展） */
export type AppliedMigration = Readonly<{ id: string; compatible: boolean }>;

export type Deployment = Readonly<{
  id: string;
  /** ISO 格式的时间 */
  createdAt: string;
  state: 'READY' | 'ERROR' | 'CANCELED';
  target: 'production' | 'preview';
  /** 这个部署的代码中有的迁移 */
  migrations: readonly string[];
}>;

export type SchemaCheck = { ok: true; warnings: readonly string[] } | { ok: false; error: string };

export type RollbackPlan = { ok: true; target: Deployment; warnings: readonly string[] } | { ok: false; reason: string };

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** 一个部署的代码能不能在这个数据库上运行：p3-03 的“数据库比代码新”的检查，放宽到兼容的迁移 */
export function checkSchema(known: readonly string[], applied: readonly AppliedMigration[]): SchemaCheck {
  const codeKnows = new Set(known);
  const unknown = applied.filter((migration) => !codeKnows.has(migration.id)).toSorted(byId);
  return { ok: true, warnings: unknown.map((migration) => `数据库中有代码中没有的迁移：${migration.id}（兼容）`) };
}

/** 从现在的生产部署往前找：第一个能在现在的数据库上运行的生产部署 */
export function pickRollbackTarget(deployments: readonly Deployment[], currentId: string, applied: readonly AppliedMigration[]): RollbackPlan {
  const current = deployments.find((deployment) => deployment.id === currentId);
  if (current === undefined) return { ok: false, reason: `没有这个部署：${currentId}` };

  const candidates = deployments
    .filter((deployment) => deployment.target === 'production' && deployment.state === 'READY' && deployment.createdAt < current.createdAt)
    .toSorted((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  const [newest] = candidates;
  if (newest === undefined) return { ok: false, reason: '没有可以回滚到的生产部署' };

  for (const candidate of candidates) {
    const check = checkSchema(candidate.migrations, applied);
    if (check.ok) return { ok: true, target: candidate, warnings: check.warnings };
  }
  // 越旧的部署认识的迁移越少：最新的那个都不行，就只能向前修复
  const first = checkSchema(newest.migrations, applied);
  return { ok: false, reason: `没有能在现在的数据库上运行的部署（${first.ok ? '' : first.error}），只能向前修复` };
}
```
:::

:::variant{kind=wrong name=include-preview fails=tests reason="把预览部署也当成回滚的目标：它可能是一个没有合并的分支上的代码"}
```ts file=rollback.ts
/** schema_migrations 中的一行：执行过的迁移，以及它是否和之前版本的代码兼容（只做扩展） */
export type AppliedMigration = Readonly<{ id: string; compatible: boolean }>;

export type Deployment = Readonly<{
  id: string;
  /** ISO 格式的时间 */
  createdAt: string;
  state: 'READY' | 'ERROR' | 'CANCELED';
  target: 'production' | 'preview';
  /** 这个部署的代码中有的迁移 */
  migrations: readonly string[];
}>;

export type SchemaCheck = { ok: true; warnings: readonly string[] } | { ok: false; error: string };

export type RollbackPlan = { ok: true; target: Deployment; warnings: readonly string[] } | { ok: false; reason: string };

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** 一个部署的代码能不能在这个数据库上运行：p3-03 的“数据库比代码新”的检查，放宽到兼容的迁移 */
export function checkSchema(known: readonly string[], applied: readonly AppliedMigration[]): SchemaCheck {
  const codeKnows = new Set(known);
  const unknown = applied.filter((migration) => !codeKnows.has(migration.id)).toSorted(byId);
  const breaking = unknown.find((migration) => !migration.compatible);
  if (breaking !== undefined) return { ok: false, error: `数据库中有不兼容的迁移：${breaking.id}` };
  return { ok: true, warnings: unknown.map((migration) => `数据库中有代码中没有的迁移：${migration.id}（兼容）`) };
}

/** 从现在的生产部署往前找：第一个能在现在的数据库上运行的生产部署 */
export function pickRollbackTarget(deployments: readonly Deployment[], currentId: string, applied: readonly AppliedMigration[]): RollbackPlan {
  const current = deployments.find((deployment) => deployment.id === currentId);
  if (current === undefined) return { ok: false, reason: `没有这个部署：${currentId}` };

  const candidates = deployments
    .filter((deployment) => deployment.state === 'READY' && deployment.createdAt < current.createdAt)
    .toSorted((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  const [newest] = candidates;
  if (newest === undefined) return { ok: false, reason: '没有可以回滚到的生产部署' };

  for (const candidate of candidates) {
    const check = checkSchema(candidate.migrations, applied);
    if (check.ok) return { ok: true, target: candidate, warnings: check.warnings };
  }
  // 越旧的部署认识的迁移越少：最新的那个都不行，就只能向前修复
  const first = checkSchema(newest.migrations, applied);
  return { ok: false, reason: `没有能在现在的数据库上运行的部署（${first.ok ? '' : first.error}），只能向前修复` };
}
```
:::

:::variant{kind=wrong name=include-failed fails=tests reason="把构建失败的部署也当成回滚的目标"}
```ts file=rollback.ts
/** schema_migrations 中的一行：执行过的迁移，以及它是否和之前版本的代码兼容（只做扩展） */
export type AppliedMigration = Readonly<{ id: string; compatible: boolean }>;

export type Deployment = Readonly<{
  id: string;
  /** ISO 格式的时间 */
  createdAt: string;
  state: 'READY' | 'ERROR' | 'CANCELED';
  target: 'production' | 'preview';
  /** 这个部署的代码中有的迁移 */
  migrations: readonly string[];
}>;

export type SchemaCheck = { ok: true; warnings: readonly string[] } | { ok: false; error: string };

export type RollbackPlan = { ok: true; target: Deployment; warnings: readonly string[] } | { ok: false; reason: string };

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** 一个部署的代码能不能在这个数据库上运行：p3-03 的“数据库比代码新”的检查，放宽到兼容的迁移 */
export function checkSchema(known: readonly string[], applied: readonly AppliedMigration[]): SchemaCheck {
  const codeKnows = new Set(known);
  const unknown = applied.filter((migration) => !codeKnows.has(migration.id)).toSorted(byId);
  const breaking = unknown.find((migration) => !migration.compatible);
  if (breaking !== undefined) return { ok: false, error: `数据库中有不兼容的迁移：${breaking.id}` };
  return { ok: true, warnings: unknown.map((migration) => `数据库中有代码中没有的迁移：${migration.id}（兼容）`) };
}

/** 从现在的生产部署往前找：第一个能在现在的数据库上运行的生产部署 */
export function pickRollbackTarget(deployments: readonly Deployment[], currentId: string, applied: readonly AppliedMigration[]): RollbackPlan {
  const current = deployments.find((deployment) => deployment.id === currentId);
  if (current === undefined) return { ok: false, reason: `没有这个部署：${currentId}` };

  const candidates = deployments
    .filter((deployment) => deployment.target === 'production' && deployment.state !== 'CANCELED' && deployment.createdAt < current.createdAt)
    .toSorted((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  const [newest] = candidates;
  if (newest === undefined) return { ok: false, reason: '没有可以回滚到的生产部署' };

  for (const candidate of candidates) {
    const check = checkSchema(candidate.migrations, applied);
    if (check.ok) return { ok: true, target: candidate, warnings: check.warnings };
  }
  // 越旧的部署认识的迁移越少：最新的那个都不行，就只能向前修复
  const first = checkSchema(newest.migrations, applied);
  return { ok: false, reason: `没有能在现在的数据库上运行的部署（${first.ok ? '' : first.error}），只能向前修复` };
}
```
:::

:::variant{kind=wrong name=oldest-first fails=tests reason="从最旧的部署开始找：回滚到了一个旧得多的版本，丢掉了中间所有的修复"}
```ts file=rollback.ts
/** schema_migrations 中的一行：执行过的迁移，以及它是否和之前版本的代码兼容（只做扩展） */
export type AppliedMigration = Readonly<{ id: string; compatible: boolean }>;

export type Deployment = Readonly<{
  id: string;
  /** ISO 格式的时间 */
  createdAt: string;
  state: 'READY' | 'ERROR' | 'CANCELED';
  target: 'production' | 'preview';
  /** 这个部署的代码中有的迁移 */
  migrations: readonly string[];
}>;

export type SchemaCheck = { ok: true; warnings: readonly string[] } | { ok: false; error: string };

export type RollbackPlan = { ok: true; target: Deployment; warnings: readonly string[] } | { ok: false; reason: string };

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** 一个部署的代码能不能在这个数据库上运行：p3-03 的“数据库比代码新”的检查，放宽到兼容的迁移 */
export function checkSchema(known: readonly string[], applied: readonly AppliedMigration[]): SchemaCheck {
  const codeKnows = new Set(known);
  const unknown = applied.filter((migration) => !codeKnows.has(migration.id)).toSorted(byId);
  const breaking = unknown.find((migration) => !migration.compatible);
  if (breaking !== undefined) return { ok: false, error: `数据库中有不兼容的迁移：${breaking.id}` };
  return { ok: true, warnings: unknown.map((migration) => `数据库中有代码中没有的迁移：${migration.id}（兼容）`) };
}

/** 从现在的生产部署往前找：第一个能在现在的数据库上运行的生产部署 */
export function pickRollbackTarget(deployments: readonly Deployment[], currentId: string, applied: readonly AppliedMigration[]): RollbackPlan {
  const current = deployments.find((deployment) => deployment.id === currentId);
  if (current === undefined) return { ok: false, reason: `没有这个部署：${currentId}` };

  const candidates = deployments
    .filter((deployment) => deployment.target === 'production' && deployment.state === 'READY' && deployment.createdAt < current.createdAt)
    .toSorted((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  const [newest] = candidates;
  if (newest === undefined) return { ok: false, reason: '没有可以回滚到的生产部署' };

  for (const candidate of candidates) {
    const check = checkSchema(candidate.migrations, applied);
    if (check.ok) return { ok: true, target: candidate, warnings: check.warnings };
  }
  // 越旧的部署认识的迁移越少：最新的那个都不行，就只能向前修复
  const first = checkSchema(newest.migrations, applied);
  return { ok: false, reason: `没有能在现在的数据库上运行的部署（${first.ok ? '' : first.error}），只能向前修复` };
}
```
:::

:::variant{kind=wrong name=only-previous fails=tests reason="只看紧挨着的上一个部署：它不能运行时没有继续往前找"}
```ts file=rollback.ts
/** schema_migrations 中的一行：执行过的迁移，以及它是否和之前版本的代码兼容（只做扩展） */
export type AppliedMigration = Readonly<{ id: string; compatible: boolean }>;

export type Deployment = Readonly<{
  id: string;
  /** ISO 格式的时间 */
  createdAt: string;
  state: 'READY' | 'ERROR' | 'CANCELED';
  target: 'production' | 'preview';
  /** 这个部署的代码中有的迁移 */
  migrations: readonly string[];
}>;

export type SchemaCheck = { ok: true; warnings: readonly string[] } | { ok: false; error: string };

export type RollbackPlan = { ok: true; target: Deployment; warnings: readonly string[] } | { ok: false; reason: string };

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** 一个部署的代码能不能在这个数据库上运行：p3-03 的“数据库比代码新”的检查，放宽到兼容的迁移 */
export function checkSchema(known: readonly string[], applied: readonly AppliedMigration[]): SchemaCheck {
  const codeKnows = new Set(known);
  const unknown = applied.filter((migration) => !codeKnows.has(migration.id)).toSorted(byId);
  const breaking = unknown.find((migration) => !migration.compatible);
  if (breaking !== undefined) return { ok: false, error: `数据库中有不兼容的迁移：${breaking.id}` };
  return { ok: true, warnings: unknown.map((migration) => `数据库中有代码中没有的迁移：${migration.id}（兼容）`) };
}

/** 从现在的生产部署往前找：第一个能在现在的数据库上运行的生产部署 */
export function pickRollbackTarget(deployments: readonly Deployment[], currentId: string, applied: readonly AppliedMigration[]): RollbackPlan {
  const current = deployments.find((deployment) => deployment.id === currentId);
  if (current === undefined) return { ok: false, reason: `没有这个部署：${currentId}` };

  const candidates = deployments
    .filter((deployment) => deployment.target === 'production' && deployment.state === 'READY' && deployment.createdAt < current.createdAt)
    .toSorted((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  const [newest] = candidates;
  if (newest === undefined) return { ok: false, reason: '没有可以回滚到的生产部署' };

  const check = checkSchema(newest.migrations, applied);
  if (check.ok) return { ok: true, target: newest, warnings: check.warnings };
  // 越旧的部署认识的迁移越少：最新的那个都不行，就只能向前修复
  const first = checkSchema(newest.migrations, applied);
  return { ok: false, reason: `没有能在现在的数据库上运行的部署（${first.ok ? '' : first.error}），只能向前修复` };
}
```
:::

