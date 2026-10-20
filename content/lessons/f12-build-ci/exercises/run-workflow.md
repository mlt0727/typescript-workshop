---
kind: challenge
title: 模拟一次工作流的运行结果
---
在 `workflow.ts` 中实现 `runWorkflow(jobs, outcomes)`：给定工作流中的 job（`needs` 与 `if`），以及每个 job **如果运行**会得到的结果（`outcomes` 中没有写的视为 `'success'`），计算每个 job 最终的状态：`'success'`、`'failure'` 或 `'skipped'`。

规则（按 GitHub 文档：一个 job 失败或被跳过时，需要它的 job 都会被跳过，除非用条件表达式让它继续；`failure()` 在任何祖先 job 失败时为真）：

1. 一个 job 的**祖先**是它的依赖、依赖的依赖……；要先确定所有祖先的状态，再决定这个 job；
2. 按 `if` 决定是否运行（没有写 `if` 时是 `'success()'`）：
   - `'success()'`：所有祖先的状态都是 `'success'`；
   - `'failure()'`：至少一个祖先的状态是 `'failure'`；
   - `'always()'`：总是运行；
3. 运行的 job，状态是 `outcomes` 中它的结果；不运行的 job 是 `'skipped'`；
4. 返回的对象按 `jobs` 中定义的顺序列出每个 job 的状态。依赖可以定义在后面；不存在的依赖、循环依赖时抛出 `Error`。

关于第 2 条中的 `success()`：GitHub 的文档只明确写了 `failure()` 检查所有祖先；`success()` 这里同样按所有祖先计算，与社区中实际遇到的“上游失败后，即使中间的 job 用 `always()` 成功了，下游仍被跳过”的情况一致。实际的工作流中，遇到这种依赖链最好显式检查 `needs.<job>.result`。

:::files{role=starter}
```ts file=workflow.ts
export type Condition = 'success()' | 'failure()' | 'always()';
export type Job = { needs?: string | string[]; if?: Condition };
export type Outcome = 'success' | 'failure';
export type Status = 'success' | 'failure' | 'skipped';

export function runWorkflow(jobs: Record<string, Job>, outcomes: Record<string, Outcome>): Record<string, Status> {
  const statuses: Record<string, Status> = {};
  for (const name of Object.keys(jobs)) statuses[name] = outcomes[name] ?? 'success';
  return statuses;
}
```
```ts file=main.ts
import { runWorkflow } from './workflow';

const jobs = {
  lint: {},
  test: {},
  build: { needs: ['lint', 'test'] },
  deploy: { needs: 'build' },
  notify: { needs: 'deploy', if: 'failure()' as const },
  report: { needs: 'test', if: 'always()' as const },
};

console.log(runWorkflow(jobs, {}));
console.log(runWorkflow(jobs, { lint: 'failure' }));
```
:::

:::files{role=solution}
```ts file=workflow.ts
export type Condition = 'success()' | 'failure()' | 'always()';
export type Job = { needs?: string | string[]; if?: Condition };
export type Outcome = 'success' | 'failure';
export type Status = 'success' | 'failure' | 'skipped';

const needsOf = (job: Job): string[] => (job.needs === undefined ? [] : typeof job.needs === 'string' ? [job.needs] : job.needs);

export function runWorkflow(jobs: Record<string, Job>, outcomes: Record<string, Outcome>): Record<string, Status> {
  const statuses = new Map<string, Status>();
  const ancestors = new Map<string, Set<string>>();
  const visiting = new Set<string>();

  /** 一个 job 的所有祖先（依赖、依赖的依赖……） */
  const ancestorsOf = (name: string): Set<string> => {
    const known = ancestors.get(name);
    if (known) return known;
    if (visiting.has(name)) throw new Error(`循环依赖：${name}`);
    const job = jobs[name];
    if (job === undefined) throw new Error(`不存在的 job：${name}`);
    visiting.add(name);
    const result = new Set<string>();
    for (const need of needsOf(job)) {
      if (!(need in jobs)) throw new Error(`${name} 依赖了不存在的 job：${need}`);
      result.add(need);
      for (const a of ancestorsOf(need)) result.add(a);
    }
    visiting.delete(name);
    ancestors.set(name, result);
    return result;
  };

  /** 依赖都有了结果之后，才决定这个 job 的状态 */
  const statusOf = (name: string): Status => {
    const known = statuses.get(name);
    if (known) return known;
    const job = jobs[name];
    if (job === undefined) throw new Error(`不存在的 job：${name}`);
    const before = [...ancestorsOf(name)].map(statusOf);
    const condition = job.if ?? 'success()';
    const runs =
      condition === 'always()' ? true : condition === 'failure()' ? before.includes('failure') : before.every((s) => s === 'success');
    const status: Status = runs ? (outcomes[name] ?? 'success') : 'skipped';
    statuses.set(name, status);
    return status;
  };

  const result: Record<string, Status> = {};
  for (const name of Object.keys(jobs)) result[name] = statusOf(name);
  return result;
}
```
```ts file=main.ts
import { runWorkflow } from './workflow';

const jobs = {
  lint: {},
  test: {},
  build: { needs: ['lint', 'test'] },
  deploy: { needs: 'build' },
  notify: { needs: 'deploy', if: 'failure()' as const },
  report: { needs: 'test', if: 'always()' as const },
};

console.log(runWorkflow(jobs, {}));
console.log(runWorkflow(jobs, { lint: 'failure' }));
```
:::

:::files{role=tests}
```ts file=workflow.test.ts
import { describe, expect, test } from 'vitest';
import { runWorkflow, type Job } from './workflow';

const pipeline: Record<string, Job> = {
  lint: {},
  test: {},
  build: { needs: ['lint', 'test'] },
  deploy: { needs: 'build' },
  notify: { needs: 'deploy', if: 'failure()' },
  report: { needs: 'test', if: 'always()' },
};

describe('runWorkflow', () => {
  test('全部成功：failure() 的 job 被跳过', () => {
    expect(runWorkflow(pipeline, {})).toEqual({
      lint: 'success',
      test: 'success',
      build: 'success',
      deploy: 'success',
      notify: 'skipped',
      report: 'success',
    });
  });

  test('失败沿着依赖传播：依赖失败或被跳过的 job 被跳过', () => {
    expect(runWorkflow(pipeline, { lint: 'failure' })).toEqual({
      lint: 'failure',
      test: 'success',
      build: 'skipped',
      deploy: 'skipped',
      notify: 'success',
      report: 'success',
    });
  });

  test('failure() 看的是所有祖先：notify 的直接依赖 deploy 是被跳过，而不是失败', () => {
    expect(runWorkflow(pipeline, { test: 'failure' })).toMatchObject({ build: 'skipped', deploy: 'skipped', notify: 'success', report: 'success' });
  });

  test('always() 的 job 总会运行，它自己也可能失败', () => {
    expect(runWorkflow(pipeline, { test: 'failure', report: 'failure' })).toMatchObject({ report: 'failure' });
  });

  test('没有依赖的 failure() job：没有祖先失败，所以被跳过', () => {
    expect(runWorkflow({ cleanup: { if: 'failure()' }, build: {} }, {})).toEqual({ cleanup: 'skipped', build: 'success' });
  });

  test('互不依赖的 job 互不影响', () => {
    expect(runWorkflow({ a: {}, b: {}, c: { needs: 'b' } }, { a: 'failure' })).toEqual({ a: 'failure', b: 'success', c: 'success' });
  });

  test('success() 看的也是所有祖先：中间的 always() 成功了，下游仍然被跳过', () => {
    const jobs: Record<string, Job> = { a: {}, b: { needs: 'a', if: 'always()' }, c: { needs: 'b' } };
    expect(runWorkflow(jobs, { a: 'failure' })).toEqual({ a: 'failure', b: 'success', c: 'skipped' });
  });

  test('被跳过的祖先同样让下游跳过', () => {
    const jobs: Record<string, Job> = { check: { if: 'failure()' }, after: { needs: 'check' }, last: { needs: 'after', if: 'always()' } };
    expect(runWorkflow(jobs, {})).toEqual({ check: 'skipped', after: 'skipped', last: 'success' });
  });

  test('依赖可以定义在后面；不存在的依赖和循环依赖抛出错误', () => {
    expect(runWorkflow({ deploy: { needs: 'build' }, build: {} }, { build: 'failure' })).toEqual({ deploy: 'skipped', build: 'failure' });
    expect(() => runWorkflow({ a: { needs: 'nope' } }, {})).toThrow();
    expect(() => runWorkflow({ a: { needs: 'b' }, b: { needs: 'a' } }, {})).toThrow();
  });
});
```
:::

:::hint{level=1}
分两步：先写 `ancestorsOf(name)`，递归地收集所有祖先（用 `Map` 记住结果，用一个“正在计算”的 `Set` 发现循环）；再写 `statusOf(name)`：先对每个祖先调用 `statusOf`（这样依赖定义在后面也没关系），再按 `if` 决定是否运行。
:::

:::hint{level=2}
三种条件：`before` 是所有祖先的状态的数组，`success()` 是 `before.every((s) => s === 'success')`（没有祖先时为真），`failure()` 是 `before.includes('failure')`（没有祖先时为假），`always()` 直接为真。运行时状态是 `outcomes[name] ?? 'success'`。
:::

:::explanation
这道题把 CI 中最容易让人困惑的地方变成了明确的规则：

- **跳过会传播**：`lint` 失败，`build` 被跳过，依赖 `build` 的 `deploy` 也被跳过。被跳过不是成功，下游同样不运行；
- **`failure()` 看所有祖先**：`notify` 只依赖 `deploy`，而 `deploy` 是“被跳过”而不是“失败”。如果只看直接的依赖，失败通知就永远发不出去了。GitHub 的文档专门说明了这一点；
- **`always()` 只决定“运行”**：它运行之后照样可能失败，结果由它自己决定；
- **中间的 `always()` 不能“洗白”上游的失败**：`a` 失败，`b`（`always()`）运行并成功，依赖 `b` 的 `c` 仍然被跳过。这在真实的工作流中常常让人意外，所以在依赖链中间用了 `always()` 时，下游最好写出明确的条件，例如 `if: ${{ !cancelled() && needs.b.result == 'success' }}`。

实现上，`statusOf` 是一个带记忆的递归：要知道一个 job 的状态，先求出所有祖先的状态。这保证了“依赖定义在后面”时也能得到正确的结果；按定义顺序逐个计算的写法，会在依赖还没有结果的时候就做出判断。
:::

:::variant{kind=alt name=rounds}
```ts file=workflow.ts
export type Condition = 'success()' | 'failure()' | 'always()';
export type Job = { needs?: string | string[]; if?: Condition };
export type Outcome = 'success' | 'failure';
export type Status = 'success' | 'failure' | 'skipped';

function listNeeds(job: Job | undefined): string[] {
  const needs = job?.needs;
  if (needs === undefined) return [];
  return Array.isArray(needs) ? [...needs] : [needs];
}

export function runWorkflow(jobs: Record<string, Job>, outcomes: Record<string, Outcome>): Record<string, Status> {
  const names = Object.keys(jobs);
  for (const name of names) {
    for (const need of listNeeds(jobs[name])) if (!names.includes(need)) throw new Error(`${name}：没有 ${need}`);
  }
  // 按依赖的顺序：每一轮处理依赖都已有结果的 job
  const status = new Map<string, Status>();
  const ancestry = new Map<string, string[]>();
  while (status.size < names.length) {
    const ready = names.filter((n) => !status.has(n) && listNeeds(jobs[n]).every((d) => status.has(d)));
    if (ready.length === 0) throw new Error('循环依赖');
    for (const name of ready) {
      const direct = listNeeds(jobs[name]);
      const all = [...new Set(direct.flatMap((d) => [d, ...(ancestry.get(d) ?? [])]))];
      ancestry.set(name, all);
      const results = all.map((n) => status.get(n));
      let run: boolean;
      switch (jobs[name]?.if ?? 'success()') {
        case 'always()':
          run = true;
          break;
        case 'failure()':
          run = results.some((r) => r === 'failure');
          break;
        default:
          run = results.every((r) => r === 'success');
      }
      status.set(name, run ? (outcomes[name] ?? 'success') : 'skipped');
    }
  }
  return Object.fromEntries(names.map((n) => [n, status.get(n) ?? 'skipped']));
}
```
:::

:::variant{kind=wrong name=success-direct-only fails=tests reason="success() 只看了直接的依赖：中间的 always() job 成功之后，下游就运行了，而上游已经失败"}
```ts file=workflow.ts
export type Condition = 'success()' | 'failure()' | 'always()';
export type Job = { needs?: string | string[]; if?: Condition };
export type Outcome = 'success' | 'failure';
export type Status = 'success' | 'failure' | 'skipped';

const needsOf = (job: Job): string[] => (job.needs === undefined ? [] : typeof job.needs === 'string' ? [job.needs] : job.needs);

export function runWorkflow(jobs: Record<string, Job>, outcomes: Record<string, Outcome>): Record<string, Status> {
  const statuses = new Map<string, Status>();
  const ancestors = new Map<string, Set<string>>();
  const visiting = new Set<string>();

  /** 一个 job 的所有祖先（依赖、依赖的依赖……） */
  const ancestorsOf = (name: string): Set<string> => {
    const known = ancestors.get(name);
    if (known) return known;
    if (visiting.has(name)) throw new Error(`循环依赖：${name}`);
    const job = jobs[name];
    if (job === undefined) throw new Error(`不存在的 job：${name}`);
    visiting.add(name);
    const result = new Set<string>();
    for (const need of needsOf(job)) {
      if (!(need in jobs)) throw new Error(`${name} 依赖了不存在的 job：${need}`);
      result.add(need);
      for (const a of ancestorsOf(need)) result.add(a);
    }
    visiting.delete(name);
    ancestors.set(name, result);
    return result;
  };

  /** 依赖都有了结果之后，才决定这个 job 的状态 */
  const statusOf = (name: string): Status => {
    const known = statuses.get(name);
    if (known) return known;
    const job = jobs[name];
    if (job === undefined) throw new Error(`不存在的 job：${name}`);
    const before = [...ancestorsOf(name)].map(statusOf);
    const condition = job.if ?? 'success()';
    const direct = needsOf(job).map(statusOf);
    const runs =
      condition === 'always()' ? true : condition === 'failure()' ? before.includes('failure') : direct.every((s) => s === 'success');
    const status: Status = runs ? (outcomes[name] ?? 'success') : 'skipped';
    statuses.set(name, status);
    return status;
  };

  const result: Record<string, Status> = {};
  for (const name of Object.keys(jobs)) result[name] = statusOf(name);
  return result;
}
```
:::

:::variant{kind=wrong name=failure-direct-only fails=tests reason="failure() 只看了直接的依赖：deploy 是被跳过而不是失败，notify 就没有运行"}
```ts file=workflow.ts
export type Condition = 'success()' | 'failure()' | 'always()';
export type Job = { needs?: string | string[]; if?: Condition };
export type Outcome = 'success' | 'failure';
export type Status = 'success' | 'failure' | 'skipped';

const needsOf = (job: Job): string[] => (job.needs === undefined ? [] : typeof job.needs === 'string' ? [job.needs] : job.needs);

export function runWorkflow(jobs: Record<string, Job>, outcomes: Record<string, Outcome>): Record<string, Status> {
  const statuses = new Map<string, Status>();
  const ancestors = new Map<string, Set<string>>();
  const visiting = new Set<string>();

  /** 一个 job 的所有祖先（依赖、依赖的依赖……） */
  const ancestorsOf = (name: string): Set<string> => {
    const known = ancestors.get(name);
    if (known) return known;
    if (visiting.has(name)) throw new Error(`循环依赖：${name}`);
    const job = jobs[name];
    if (job === undefined) throw new Error(`不存在的 job：${name}`);
    visiting.add(name);
    const result = new Set<string>();
    for (const need of needsOf(job)) {
      if (!(need in jobs)) throw new Error(`${name} 依赖了不存在的 job：${need}`);
      result.add(need);
      for (const a of ancestorsOf(need)) result.add(a);
    }
    visiting.delete(name);
    ancestors.set(name, result);
    return result;
  };

  /** 依赖都有了结果之后，才决定这个 job 的状态 */
  const statusOf = (name: string): Status => {
    const known = statuses.get(name);
    if (known) return known;
    const job = jobs[name];
    if (job === undefined) throw new Error(`不存在的 job：${name}`);
    const before = [...ancestorsOf(name)].map(statusOf);
    const condition = job.if ?? 'success()';
    const direct = needsOf(job).map(statusOf);
    const runs =
      condition === 'always()' ? true : condition === 'failure()' ? direct.includes('failure') : before.every((s) => s === 'success');
    const status: Status = runs ? (outcomes[name] ?? 'success') : 'skipped';
    statuses.set(name, status);
    return status;
  };

  const result: Record<string, Status> = {};
  for (const name of Object.keys(jobs)) result[name] = statusOf(name);
  return result;
}
```
:::

:::variant{kind=wrong name=skipped-is-fine fails=tests reason="把被跳过的依赖当成了成功：依赖被跳过时，下游也应该被跳过"}
```ts file=workflow.ts
export type Condition = 'success()' | 'failure()' | 'always()';
export type Job = { needs?: string | string[]; if?: Condition };
export type Outcome = 'success' | 'failure';
export type Status = 'success' | 'failure' | 'skipped';

const needsOf = (job: Job): string[] => (job.needs === undefined ? [] : typeof job.needs === 'string' ? [job.needs] : job.needs);

export function runWorkflow(jobs: Record<string, Job>, outcomes: Record<string, Outcome>): Record<string, Status> {
  const statuses = new Map<string, Status>();
  const ancestors = new Map<string, Set<string>>();
  const visiting = new Set<string>();

  /** 一个 job 的所有祖先（依赖、依赖的依赖……） */
  const ancestorsOf = (name: string): Set<string> => {
    const known = ancestors.get(name);
    if (known) return known;
    if (visiting.has(name)) throw new Error(`循环依赖：${name}`);
    const job = jobs[name];
    if (job === undefined) throw new Error(`不存在的 job：${name}`);
    visiting.add(name);
    const result = new Set<string>();
    for (const need of needsOf(job)) {
      if (!(need in jobs)) throw new Error(`${name} 依赖了不存在的 job：${need}`);
      result.add(need);
      for (const a of ancestorsOf(need)) result.add(a);
    }
    visiting.delete(name);
    ancestors.set(name, result);
    return result;
  };

  /** 依赖都有了结果之后，才决定这个 job 的状态 */
  const statusOf = (name: string): Status => {
    const known = statuses.get(name);
    if (known) return known;
    const job = jobs[name];
    if (job === undefined) throw new Error(`不存在的 job：${name}`);
    const before = [...ancestorsOf(name)].map(statusOf);
    const condition = job.if ?? 'success()';
    const runs =
      condition === 'always()' ? true : condition === 'failure()' ? before.includes('failure') : before.every((s) => s !== 'failure');
    const status: Status = runs ? (outcomes[name] ?? 'success') : 'skipped';
    statuses.set(name, status);
    return status;
  };

  const result: Record<string, Status> = {};
  for (const name of Object.keys(jobs)) result[name] = statusOf(name);
  return result;
}
```
:::

:::variant{kind=wrong name=always-succeeds fails=tests reason="always() 的 job 总是记为成功：它会运行，但运行的结果仍然由它自己决定"}
```ts file=workflow.ts
export type Condition = 'success()' | 'failure()' | 'always()';
export type Job = { needs?: string | string[]; if?: Condition };
export type Outcome = 'success' | 'failure';
export type Status = 'success' | 'failure' | 'skipped';

const needsOf = (job: Job): string[] => (job.needs === undefined ? [] : typeof job.needs === 'string' ? [job.needs] : job.needs);

export function runWorkflow(jobs: Record<string, Job>, outcomes: Record<string, Outcome>): Record<string, Status> {
  const statuses = new Map<string, Status>();
  const ancestors = new Map<string, Set<string>>();
  const visiting = new Set<string>();

  /** 一个 job 的所有祖先（依赖、依赖的依赖……） */
  const ancestorsOf = (name: string): Set<string> => {
    const known = ancestors.get(name);
    if (known) return known;
    if (visiting.has(name)) throw new Error(`循环依赖：${name}`);
    const job = jobs[name];
    if (job === undefined) throw new Error(`不存在的 job：${name}`);
    visiting.add(name);
    const result = new Set<string>();
    for (const need of needsOf(job)) {
      if (!(need in jobs)) throw new Error(`${name} 依赖了不存在的 job：${need}`);
      result.add(need);
      for (const a of ancestorsOf(need)) result.add(a);
    }
    visiting.delete(name);
    ancestors.set(name, result);
    return result;
  };

  /** 依赖都有了结果之后，才决定这个 job 的状态 */
  const statusOf = (name: string): Status => {
    const known = statuses.get(name);
    if (known) return known;
    const job = jobs[name];
    if (job === undefined) throw new Error(`不存在的 job：${name}`);
    const before = [...ancestorsOf(name)].map(statusOf);
    const condition = job.if ?? 'success()';
    const runs =
      condition === 'always()' ? true : condition === 'failure()' ? before.includes('failure') : before.every((s) => s === 'success');
    const status: Status = condition === 'always()' ? 'success' : runs ? (outcomes[name] ?? 'success') : 'skipped';
    statuses.set(name, status);
    return status;
  };

  const result: Record<string, Status> = {};
  for (const name of Object.keys(jobs)) result[name] = statusOf(name);
  return result;
}
```
:::

:::variant{kind=wrong name=definition-order fails=tests reason="按定义的顺序计算状态，没有先计算依赖：依赖定义在后面时，读到的还不是它的结果"}
```ts file=workflow.ts
export type Condition = 'success()' | 'failure()' | 'always()';
export type Job = { needs?: string | string[]; if?: Condition };
export type Outcome = 'success' | 'failure';
export type Status = 'success' | 'failure' | 'skipped';

const needsOf = (job: Job): string[] => (job.needs === undefined ? [] : typeof job.needs === 'string' ? [job.needs] : job.needs);

export function runWorkflow(jobs: Record<string, Job>, outcomes: Record<string, Outcome>): Record<string, Status> {
  const statuses: Record<string, Status> = {};
  const ancestors: Record<string, string[]> = {};
  for (const [name, job] of Object.entries(jobs)) {
    for (const need of needsOf(job)) if (!(need in jobs)) throw new Error(`${name} 依赖了不存在的 job：${need}`);
    const all = needsOf(job).flatMap((need) => [need, ...(ancestors[need] ?? [])]);
    if (all.includes(name)) throw new Error('循环依赖');
    ancestors[name] = all;
    const before = all.map((n) => statuses[n] ?? 'success');
    const condition = job.if ?? 'success()';
    const runs = condition === 'always()' ? true : condition === 'failure()' ? before.includes('failure') : before.every((s) => s === 'success');
    statuses[name] = runs ? (outcomes[name] ?? 'success') : 'skipped';
  }
  for (const [name, job] of Object.entries(jobs)) {
    for (const need of needsOf(job)) if (needsOf(jobs[need] ?? {}).includes(name)) throw new Error('循环依赖');
  }
  return statuses;
}
```
:::
