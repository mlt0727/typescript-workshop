---
kind: challenge
title: 考试成绩汇总
---
每个学生的记录是 `{ name: string; score: number | null }`，`score` 为 `null` 表示缺考。实现 `summarize(records)`，返回：

- `taken`：参加考试（`score` 不是 `null`）的人数；
- `average`：参加考试的人的平均分；没有人参加时为 `null`；
- `best`：最高分学生的名字；有多人并列最高时取**最先出现**的那个；没有人参加时为 `null`；
- `failed`：不及格（分数低于 60）的学生名字，保持原来的顺序。缺考的学生不算不及格。

不能修改传入的数组。

:::files{role=starter}
```ts file=exam.ts
type Entry = { name: string; score: number | null };
type Summary = { taken: number; average: number | null; best: string | null; failed: string[] };

export function summarize(records: Entry[]): Summary {
  return { taken: 0, average: null, best: null, failed: [] };
}
```
:::

:::files{role=solution}
```ts file=exam.ts
type Entry = { name: string; score: number | null };
type Summary = { taken: number; average: number | null; best: string | null; failed: string[] };

export function summarize(records: Entry[]): Summary {
  const scored: { name: string; score: number }[] = [];
  for (const { name, score } of records) {
    if (score !== null) {
      scored.push({ name: name, score: score });
    }
  }

  const total = scored.reduce((sum, r) => sum + r.score, 0);
  const average = scored.length === 0 ? null : total / scored.length;

  let best: { name: string; score: number } | null = null;
  for (const r of scored) {
    if (best === null || r.score > best.score) {
      best = r;
    }
  }

  const failed = scored.filter((r) => r.score < 60).map((r) => r.name);

  return { taken: scored.length, average: average, best: best === null ? null : best.name, failed: failed };
}
```
:::

:::files{role=tests}
```ts file=exam.test.ts
import { describe, expect, test } from 'vitest';
import { summarize } from './exam';

describe('summarize', () => {
  test('普通情况', () => {
    const result = summarize([
      { name: 'Ada', score: 90 },
      { name: 'Grace', score: 55 },
      { name: 'Linus', score: null },
      { name: 'Alan', score: 71 },
    ]);
    expect(result).toEqual({ taken: 3, average: 72, best: 'Ada', failed: ['Grace'] });
  });

  test('缺考不计入平均分，也不算不及格', () => {
    const result = summarize([
      { name: 'A', score: null },
      { name: 'B', score: 80 },
    ]);
    expect(result).toEqual({ taken: 1, average: 80, best: 'B', failed: [] });
  });

  test('没有人参加考试', () => {
    expect(summarize([{ name: 'A', score: null }])).toEqual({
      taken: 0,
      average: null,
      best: null,
      failed: [],
    });
    expect(summarize([])).toEqual({ taken: 0, average: null, best: null, failed: [] });
  });

  test('并列最高分取最先出现的', () => {
    const result = summarize([
      { name: 'A', score: 70 },
      { name: 'B', score: 95 },
      { name: 'C', score: 95 },
    ]);
    expect(result.best).toBe('B');
  });

  test('0 分是有效成绩', () => {
    const result = summarize([
      { name: 'A', score: 0 },
      { name: 'B', score: 0 },
    ]);
    expect(result).toEqual({ taken: 2, average: 0, best: 'A', failed: ['A', 'B'] });
  });

  test('60 分及格', () => {
    expect(summarize([{ name: 'A', score: 60 }]).failed).toEqual([]);
  });

  test('不修改传入的数组', () => {
    const records = [
      { name: 'A', score: 50 },
      { name: 'B', score: null },
    ];
    summarize(records);
    expect(records).toEqual([
      { name: 'A', score: 50 },
      { name: 'B', score: null },
    ]);
  });
});
```
:::

:::hint{level=1}
先得到参加考试的记录，后面三项都基于它计算。注意 0 分是有效成绩，判断缺考要用 `=== null`，不要用真假检查。
:::

:::hint{level=2}
先用 `for...of` 把 `score !== null` 的记录整理成元素类型为 `{ name: string; score: number }` 的新数组，后面就不用再处理 `null`。平均分：用 `reduce` 求和（初始值 `0`），人数为 0 时返回 `null`。最高分：遍历时只在“严格大于”当前最高分时才替换，这样并列时保留先出现的。不及格：`filter` 出分数小于 60 的，再 `map` 出名字。
:::

:::explanation
参考答案先把参加考试的记录整理成一个新数组 `scored`，它的元素类型是 `{ name: string; score: number }`：在 `if (score !== null)` 的分支里，`score` 已经被收窄成 `number`。之后的平均分、最高分、不及格名单都在这个“已经排除了缺考”的数组上计算，不再需要处理 `null`。

为什么不直接用 `records.filter((r) => r.score !== null)`？TypeScript 能收窄 `filter` 后的**元素本身**（例如 `(number | null)[]` 变成 `number[]`），却不会收窄元素的**属性**：结果的类型仍然是 `{ name: string; score: number | null }[]`。用 `?? 0` 之类的写法绕过去虽然能通过检查，却把“这里不可能是 null”的假设藏进了一个看起来有意义的默认值里——而这道题的要点恰恰是 0 分是有效成绩。

并列时取最先出现的，关键在于比较用 `>` 而不是 `>=`。缺考和 0 分要区分开：`score === null` 才是缺考；用 `!r.score` 判断，0 分的学生就被当成了缺考。另外，JavaScript 中 `null < 60` 的结果是 `true`（`null` 被转换成 0），TypeScript 会阻止你直接这样比较。
:::

:::variant{kind=alt name=single-loop}
```ts file=exam.ts
type Entry = { name: string; score: number | null };
type Summary = { taken: number; average: number | null; best: string | null; failed: string[] };

export function summarize(records: Entry[]): Summary {
  let taken = 0;
  let total = 0;
  let best: { name: string; score: number } | null = null;
  const failed: string[] = [];

  for (const { name, score } of records) {
    if (score === null) {
      continue;
    }
    taken++;
    total += score;
    if (best === null || score > best.score) {
      best = { name: name, score: score };
    }
    if (score < 60) {
      failed.push(name);
    }
  }

  return {
    taken: taken,
    average: taken === 0 ? null : total / taken,
    best: best === null ? null : best.name,
    failed: failed,
  };
}
```
:::

:::variant{kind=wrong name=truthy-score fails=tests reason="用真假检查判断缺考，0 分被当成了缺考"}
```ts file=exam.ts
type Entry = { name: string; score: number | null };
type Summary = { taken: number; average: number | null; best: string | null; failed: string[] };

export function summarize(records: Entry[]): Summary {
  const scored: { name: string; score: number }[] = [];
  for (const r of records) {
    if (r.score) {
      scored.push({ name: r.name, score: r.score });
    }
  }
  const total = scored.reduce((sum, r) => sum + r.score, 0);
  let best: { name: string; score: number } | null = null;
  for (const r of scored) {
    if (best === null || r.score > best.score) best = r;
  }
  return {
    taken: scored.length,
    average: scored.length === 0 ? null : total / scored.length,
    best: best === null ? null : best.name,
    failed: scored.filter((r) => r.score < 60).map((r) => r.name),
  };
}
```
:::

:::variant{kind=wrong name=tie-last fails=tests reason="用 >= 比较，并列时取了最后出现的"}
```ts file=exam.ts
type Entry = { name: string; score: number | null };
type Summary = { taken: number; average: number | null; best: string | null; failed: string[] };

export function summarize(records: Entry[]): Summary {
  const scored: { name: string; score: number }[] = [];
  for (const r of records) {
    if (r.score !== null) {
      scored.push({ name: r.name, score: r.score });
    }
  }
  const total = scored.reduce((sum, r) => sum + r.score, 0);
  let best: { name: string; score: number } | null = null;
  for (const r of scored) {
    if (best === null || r.score >= best.score) best = r;
  }
  return {
    taken: scored.length,
    average: scored.length === 0 ? null : total / scored.length,
    best: best === null ? null : best.name,
    failed: scored.filter((r) => r.score < 60).map((r) => r.name),
  };
}
```
:::

:::variant{kind=wrong name=null-as-zero fails=tests reason="把缺考当成 0 分计入了平均分"}
```ts file=exam.ts
type Entry = { name: string; score: number | null };
type Summary = { taken: number; average: number | null; best: string | null; failed: string[] };

export function summarize(records: Entry[]): Summary {
  const taken = records.filter((r) => r.score !== null);
  const total = records.reduce((sum, r) => sum + (r.score ?? 0), 0);
  let best: Entry | undefined = undefined;
  for (const r of taken) {
    if (best === undefined || (r.score ?? 0) > (best.score ?? 0)) best = r;
  }
  return {
    taken: taken.length,
    average: taken.length === 0 ? null : total / records.length,
    best: best?.name ?? null,
    failed: taken.filter((r) => r.score !== null && r.score < 60).map((r) => r.name),
  };
}
```
:::

:::variant{kind=wrong name=compare-null fails=types reason="没有排除 null 就和 60 比较"}
```ts file=exam.ts
type Entry = { name: string; score: number | null };
type Summary = { taken: number; average: number | null; best: string | null; failed: string[] };

export function summarize(records: Entry[]): Summary {
  const taken = records.filter((r) => r.score !== null);
  const total = taken.reduce((sum, r) => sum + (r.score ?? 0), 0);
  let best: Entry | undefined = undefined;
  for (const r of taken) {
    if (best === undefined || (r.score ?? 0) > (best.score ?? 0)) best = r;
  }
  return {
    taken: taken.length,
    average: taken.length === 0 ? null : total / taken.length,
    best: best?.name ?? null,
    failed: records.filter((r) => r.score < 60).map((r) => r.name),
  };
}
```
:::
