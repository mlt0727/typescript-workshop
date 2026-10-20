---
kind: task
title: 按 needs 安排 job 的批次
---
在 `plan.ts` 中实现 `planJobs(jobs)`：`jobs` 是工作流中的 job（键是 job 的名字，顺序就是文件中定义的顺序），每个 job 的 `needs` 是一个名字或者名字的数组。假设每个 job 花的时间相同，返回它们运行的批次：

1. 没有 `needs` 的 job 在第一批（下标 0）；
2. 一个 job 的批次，是它依赖的 job 中**最晚的那一批**再加一；
3. 每一批中的 job 按它们在 `jobs` 中定义的顺序排列（依赖可以定义在后面）；
4. `needs` 中有不存在的 job 时抛出 `Error`，信息中包含“不存在”；有循环依赖（包括依赖自己）时抛出 `Error`，信息中包含“循环依赖”。

:::files{role=starter}
```ts file=plan.ts
export type Job = { needs?: string | string[] };

/** 返回若干批 job：同一批中的 job 可以同时运行 */
export function planJobs(jobs: Record<string, Job>): string[][] {
  return [Object.keys(jobs)];
}
```
```ts file=main.ts
import { planJobs } from './plan';

const jobs = {
  lint: {},
  typecheck: {},
  test: {},
  build: { needs: ['lint', 'typecheck', 'test'] },
  e2e: { needs: 'build' },
  deploy: { needs: ['build', 'e2e'] },
};

planJobs(jobs).forEach((stage, i) => console.log(`第 ${i + 1} 批：${stage.join('、')}`));
```
:::

:::files{role=solution}
```ts file=plan.ts
export type Job = { needs?: string | string[] };

export function needsOf(job: Job): string[] {
  return job.needs === undefined ? [] : typeof job.needs === 'string' ? [job.needs] : job.needs;
}

/** 返回若干批 job：同一批中的 job 可以同时运行 */
export function planJobs(jobs: Record<string, Job>): string[][] {
  const levels = new Map<string, number>();
  const visiting = new Set<string>();

  // 一个 job 的批次 = 它依赖的 job 中最晚的那一批 + 1；没有依赖时是第 0 批
  const levelOf = (name: string): number => {
    const known = levels.get(name);
    if (known !== undefined) return known;
    if (visiting.has(name)) throw new Error(`循环依赖：${[...visiting, name].join(' → ')}`);
    const job = jobs[name];
    if (job === undefined) throw new Error(`不存在的 job：${name}`);
    visiting.add(name);
    let level = 0;
    for (const need of needsOf(job)) {
      if (!(need in jobs)) throw new Error(`${name} 依赖了不存在的 job：${need}`);
      level = Math.max(level, levelOf(need) + 1);
    }
    visiting.delete(name);
    levels.set(name, level);
    return level;
  };

  const stages: string[][] = [];
  for (const name of Object.keys(jobs)) {
    const level = levelOf(name);
    (stages[level] ??= []).push(name);
  }
  // 按定义的顺序遍历，所以每一批中的 job 保持它们在文件中的顺序
  return stages.map((stage) => stage.toSorted((a, b) => Object.keys(jobs).indexOf(a) - Object.keys(jobs).indexOf(b)));
}
```
```ts file=main.ts
import { planJobs } from './plan';

const jobs = {
  lint: {},
  typecheck: {},
  test: {},
  build: { needs: ['lint', 'typecheck', 'test'] },
  e2e: { needs: 'build' },
  deploy: { needs: ['build', 'e2e'] },
};

planJobs(jobs).forEach((stage, i) => console.log(`第 ${i + 1} 批：${stage.join('、')}`));
```
:::

:::files{role=tests}
```ts file=plan.test.ts
import { describe, expect, test } from 'vitest';
import { planJobs } from './plan';

describe('planJobs', () => {
  test('没有 needs 的 job 在第一批同时运行', () => {
    expect(planJobs({ lint: {}, typecheck: {}, test: {} })).toEqual([['lint', 'typecheck', 'test']]);
  });

  test('needs 可以是字符串或数组', () => {
    expect(
      planJobs({
        lint: {},
        test: {},
        build: { needs: ['lint', 'test'] },
        e2e: { needs: 'build' },
        deploy: { needs: ['build', 'e2e'] },
      }),
    ).toEqual([['lint', 'test'], ['build'], ['e2e'], ['deploy']]);
  });

  test('批次由最晚的那个依赖决定', () => {
    expect(planJobs({ a: {}, b: { needs: 'a' }, c: { needs: 'a' }, d: { needs: ['b'] }, e: { needs: ['a', 'd'] } })).toEqual([['a'], ['b', 'c'], ['d'], ['e']]);
  });

  test('同一批中保持定义的顺序（依赖写在后面也一样）', () => {
    expect(planJobs({ zeta: {}, alpha: {}, mid: { needs: 'zeta' } })).toEqual([['zeta', 'alpha'], ['mid']]);
    expect(planJobs({ deploy: { needs: 'build' }, build: {} })).toEqual([['build'], ['deploy']]);
  });

  test('重复的依赖、没有 job', () => {
    expect(planJobs({ a: {}, b: { needs: ['a', 'a'] } })).toEqual([['a'], ['b']]);
    expect(planJobs({})).toEqual([]);
  });

  test('不存在的依赖抛出错误', () => {
    expect(() => planJobs({ build: { needs: 'lint' } })).toThrow('不存在');
  });

  test('循环依赖抛出错误（而不是无限递归）', () => {
    expect(() => planJobs({ a: { needs: 'b' }, b: { needs: 'a' } })).toThrow('循环依赖');
    expect(() => planJobs({ a: { needs: 'a' } })).toThrow('循环依赖');
    expect(() => planJobs({ x: {}, a: { needs: ['x', 'c'] }, b: { needs: 'a' }, c: { needs: 'b' } })).toThrow('循环依赖');
  });
});
```
:::

:::hint{level=1}
先写 `needsOf(job)`，把 `undefined`、字符串、数组统一成数组。然后用递归计算每个 job 的批次：`levelOf(name)` 等于 `needsOf(job)` 中每个依赖的 `levelOf(依赖) + 1` 的最大值，没有依赖时是 0。用一个 `Map` 记住算过的结果。
:::

:::hint{level=2}
检测循环：递归时用一个 `Set` 记录“正在计算的 job”，进入时加入，算完后删除。如果在计算的过程中又遇到了正在计算的 job，就说明有循环。最后按 `Object.keys(jobs)` 的顺序把每个 job 放进对应的批次，顺序自然就是定义的顺序。
:::

:::explanation
这就是对依赖图做**拓扑排序**，并且按“层”分组。工作流、构建工具（例如 TypeScript 的项目引用 `tsc -b`）、包管理器安装依赖时，都要解决同样的问题：谁必须先完成，谁可以同时进行。

两种常见的写法：参考解用递归加记忆（批次 = 最晚的依赖 + 1），替代解用 Kahn 算法（每一轮取出所有依赖都已完成的 job）。两者都要处理循环：递归的写法用“正在计算”的集合发现循环；Kahn 算法在某一轮取不出任何 job 时就知道有循环。没有检查循环的递归会一直调用下去，最后得到一个“调用栈溢出”的错误，完全看不出原因。

真实的 GitHub Actions 中，job 的耗时各不相同，一个 job 只要它的依赖都完成了就立即开始，不会等“同一批”的其他 job；这里的批次是“每个 job 耗时相同”时的情况，正好说明了哪些 job 之间没有先后关系。
:::

:::variant{kind=alt name=kahn}
```ts file=plan.ts
export type Job = { needs?: string | string[] };

export function planJobs(jobs: Record<string, Job>): string[][] {
  const names = Object.keys(jobs);
  const needs = new Map(names.map((name) => {
    const raw = jobs[name]?.needs;
    return [name, new Set(raw === undefined ? [] : Array.isArray(raw) ? raw : [raw])] as const;
  }));
  for (const [name, deps] of needs) {
    for (const dep of deps) if (!needs.has(dep)) throw new Error(`${name} 依赖了不存在的 job ${dep}`);
  }
  // Kahn 算法：每一轮取出所有依赖都已完成的 job
  const done = new Set<string>();
  const stages: string[][] = [];
  while (done.size < names.length) {
    const ready = names.filter((name) => !done.has(name) && [...(needs.get(name) ?? [])].every((dep) => done.has(dep)));
    if (ready.length === 0) throw new Error('存在循环依赖');
    for (const name of ready) done.add(name);
    stages.push(ready);
  }
  return stages;
}
```
:::

:::variant{kind=wrong name=sorted-by-name fails=tests reason="每一批按名字排序：应该保持 job 在文件中定义的顺序"}
```ts file=plan.ts
export type Job = { needs?: string | string[] };

export function needsOf(job: Job): string[] {
  return job.needs === undefined ? [] : typeof job.needs === 'string' ? [job.needs] : job.needs;
}

/** 返回若干批 job：同一批中的 job 可以同时运行 */
export function planJobs(jobs: Record<string, Job>): string[][] {
  const levels = new Map<string, number>();
  const visiting = new Set<string>();

  // 一个 job 的批次 = 它依赖的 job 中最晚的那一批 + 1；没有依赖时是第 0 批
  const levelOf = (name: string): number => {
    const known = levels.get(name);
    if (known !== undefined) return known;
    if (visiting.has(name)) throw new Error(`循环依赖：${[...visiting, name].join(' → ')}`);
    const job = jobs[name];
    if (job === undefined) throw new Error(`不存在的 job：${name}`);
    visiting.add(name);
    let level = 0;
    for (const need of needsOf(job)) {
      if (!(need in jobs)) throw new Error(`${name} 依赖了不存在的 job：${need}`);
      level = Math.max(level, levelOf(need) + 1);
    }
    visiting.delete(name);
    levels.set(name, level);
    return level;
  };

  const stages: string[][] = [];
  for (const name of Object.keys(jobs)) {
    const level = levelOf(name);
    (stages[level] ??= []).push(name);
  }
  // 按定义的顺序遍历，所以每一批中的 job 保持它们在文件中的顺序
  return stages.map((stage) => stage.toSorted());
}
```
:::

:::variant{kind=wrong name=earliest-dependency fails=tests reason="批次由最早的依赖决定：e 依赖 a 和 d，要等 d 完成，不能和 b 同时开始"}
```ts file=plan.ts
export type Job = { needs?: string | string[] };

export function needsOf(job: Job): string[] {
  return job.needs === undefined ? [] : typeof job.needs === 'string' ? [job.needs] : job.needs;
}

/** 返回若干批 job：同一批中的 job 可以同时运行 */
export function planJobs(jobs: Record<string, Job>): string[][] {
  const levels = new Map<string, number>();
  const visiting = new Set<string>();

  // 一个 job 的批次 = 它依赖的 job 中最晚的那一批 + 1；没有依赖时是第 0 批
  const levelOf = (name: string): number => {
    const known = levels.get(name);
    if (known !== undefined) return known;
    if (visiting.has(name)) throw new Error(`循环依赖：${[...visiting, name].join(' → ')}`);
    const job = jobs[name];
    if (job === undefined) throw new Error(`不存在的 job：${name}`);
    visiting.add(name);
    let level = Infinity;
    for (const need of needsOf(job)) {
      if (!(need in jobs)) throw new Error(`${name} 依赖了不存在的 job：${need}`);
      level = Math.min(level, levelOf(need) + 1);
    }
    if (level === Infinity) level = 0;
    visiting.delete(name);
    levels.set(name, level);
    return level;
  };

  const stages: string[][] = [];
  for (const name of Object.keys(jobs)) {
    const level = levelOf(name);
    (stages[level] ??= []).push(name);
  }
  // 按定义的顺序遍历，所以每一批中的 job 保持它们在文件中的顺序
  return stages.map((stage) => stage.toSorted((a, b) => Object.keys(jobs).indexOf(a) - Object.keys(jobs).indexOf(b)));
}
```
:::

:::variant{kind=wrong name=no-cycle-check fails=tests reason="没有检查循环依赖：遇到 a → b → a 时无限递归，最后是“调用栈溢出”，而不是清楚的错误"}
```ts file=plan.ts
export type Job = { needs?: string | string[] };

export function needsOf(job: Job): string[] {
  return job.needs === undefined ? [] : typeof job.needs === 'string' ? [job.needs] : job.needs;
}

/** 返回若干批 job：同一批中的 job 可以同时运行 */
export function planJobs(jobs: Record<string, Job>): string[][] {
  const levels = new Map<string, number>();
  const visiting = new Set<string>();

  // 一个 job 的批次 = 它依赖的 job 中最晚的那一批 + 1；没有依赖时是第 0 批
  const levelOf = (name: string): number => {
    const known = levels.get(name);
    if (known !== undefined) return known;
    const job = jobs[name];
    if (job === undefined) throw new Error(`不存在的 job：${name}`);
    visiting.add(name);
    let level = 0;
    for (const need of needsOf(job)) {
      if (!(need in jobs)) throw new Error(`${name} 依赖了不存在的 job：${need}`);
      level = Math.max(level, levelOf(need) + 1);
    }
    visiting.delete(name);
    levels.set(name, level);
    return level;
  };

  const stages: string[][] = [];
  for (const name of Object.keys(jobs)) {
    const level = levelOf(name);
    (stages[level] ??= []).push(name);
  }
  // 按定义的顺序遍历，所以每一批中的 job 保持它们在文件中的顺序
  return stages.map((stage) => stage.toSorted((a, b) => Object.keys(jobs).indexOf(a) - Object.keys(jobs).indexOf(b)));
}
```
:::

:::variant{kind=wrong name=string-needs-as-list fails=tests reason="把字符串的 needs 当成了数组来遍历：needs: 'build' 变成了 b、u、i、l、d 五个依赖"}
```ts file=plan.ts
export type Job = { needs?: string | string[] };

export function needsOf(job: Job): string[] {
  return job.needs === undefined ? [] : [...job.needs];
}

/** 返回若干批 job：同一批中的 job 可以同时运行 */
export function planJobs(jobs: Record<string, Job>): string[][] {
  const levels = new Map<string, number>();
  const visiting = new Set<string>();

  // 一个 job 的批次 = 它依赖的 job 中最晚的那一批 + 1；没有依赖时是第 0 批
  const levelOf = (name: string): number => {
    const known = levels.get(name);
    if (known !== undefined) return known;
    if (visiting.has(name)) throw new Error(`循环依赖：${[...visiting, name].join(' → ')}`);
    const job = jobs[name];
    if (job === undefined) throw new Error(`不存在的 job：${name}`);
    visiting.add(name);
    let level = 0;
    for (const need of needsOf(job)) {
      if (!(need in jobs)) throw new Error(`${name} 依赖了不存在的 job：${need}`);
      level = Math.max(level, levelOf(need) + 1);
    }
    visiting.delete(name);
    levels.set(name, level);
    return level;
  };

  const stages: string[][] = [];
  for (const name of Object.keys(jobs)) {
    const level = levelOf(name);
    (stages[level] ??= []).push(name);
  }
  // 按定义的顺序遍历，所以每一批中的 job 保持它们在文件中的顺序
  return stages.map((stage) => stage.toSorted((a, b) => Object.keys(jobs).indexOf(a) - Object.keys(jobs).indexOf(b)));
}
```
:::

:::variant{kind=wrong name=ignore-unknown fails=tests reason="忽略了不存在的依赖：拼错的 job 名字会让 job 在错误的时机运行，而不是报错"}
```ts file=plan.ts
export type Job = { needs?: string | string[] };

export function needsOf(job: Job): string[] {
  return job.needs === undefined ? [] : typeof job.needs === 'string' ? [job.needs] : job.needs;
}

/** 返回若干批 job：同一批中的 job 可以同时运行 */
export function planJobs(jobs: Record<string, Job>): string[][] {
  const levels = new Map<string, number>();
  const visiting = new Set<string>();

  // 一个 job 的批次 = 它依赖的 job 中最晚的那一批 + 1；没有依赖时是第 0 批
  const levelOf = (name: string): number => {
    const known = levels.get(name);
    if (known !== undefined) return known;
    if (visiting.has(name)) throw new Error(`循环依赖：${[...visiting, name].join(' → ')}`);
    const job = jobs[name];
    if (job === undefined) throw new Error(`不存在的 job：${name}`);
    visiting.add(name);
    let level = 0;
    for (const need of needsOf(job)) {
      if (!(need in jobs)) continue;
      level = Math.max(level, levelOf(need) + 1);
    }
    visiting.delete(name);
    levels.set(name, level);
    return level;
  };

  const stages: string[][] = [];
  for (const name of Object.keys(jobs)) {
    const level = levelOf(name);
    (stages[level] ??= []).push(name);
  }
  // 按定义的顺序遍历，所以每一批中的 job 保持它们在文件中的顺序
  return stages.map((stage) => stage.toSorted((a, b) => Object.keys(jobs).indexOf(a) - Object.keys(jobs).indexOf(b)));
}
```
:::
