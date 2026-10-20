---
kind: challenge
title: 成绩单
---
后端返回的学生数据长这样：

```json
{ "id": 7, "name": "Ada", "scores": { "数学": 95, "物理": 88 } }
```

`scores` 的键是科目名，事先不知道有哪些科目，不同学生的科目也可能不同。

1. 定义并导出 `interface Student`，准确描述上面的形状（`scores` 用索引签名或 `Record`）。
2. 实现 `bestSubject(student)`：返回分数最高的科目名；并列时取在 `scores` 中**先出现**的那个；没有任何科目时返回 `null`。
3. 实现 `subjectAverage(students, subject)`：所有**有这门科目**的学生在这门科目上的平均分；没有学生有这门科目时返回 `null`。

:::files{role=starter}
```ts file=students.ts
export interface Student {
  // 在这里描述学生数据的形状
}

export function bestSubject(student: Student): string | null {
  return null;
}

export function subjectAverage(students: Student[], subject: string): number | null {
  return null;
}
```
:::

:::files{role=solution}
```ts file=students.ts
export interface Student {
  id: number;
  name: string;
  scores: Record<string, number>;
}

export function bestSubject(student: Student): string | null {
  let best: string | null = null;
  let bestScore = -Infinity;
  for (const [subject, score] of Object.entries(student.scores)) {
    if (score > bestScore) {
      best = subject;
      bestScore = score;
    }
  }
  return best;
}

export function subjectAverage(students: Student[], subject: string): number | null {
  let total = 0;
  let count = 0;
  for (const student of students) {
    const score = student.scores[subject];
    if (score !== undefined) {
      total += score;
      count++;
    }
  }
  return count === 0 ? null : total / count;
}
```
:::

:::files{role=tests}
```ts file=students.test.ts
import { describe, expect, test } from 'vitest';
import { bestSubject, subjectAverage } from './students';

const ada = { id: 1, name: 'Ada', scores: { 数学: 95, 物理: 88 } };
const grace = { id: 2, name: 'Grace', scores: { 物理: 92, 英语: 70 } };
const alan = { id: 3, name: 'Alan', scores: {} };

describe('bestSubject', () => {
  test('分数最高的科目', () => {
    expect(bestSubject(ada)).toBe('数学');
    expect(bestSubject(grace)).toBe('物理');
  });

  test('并列时取先出现的', () => {
    expect(bestSubject({ id: 4, name: 'T', scores: { 语文: 80, 数学: 90, 化学: 90 } })).toBe('数学');
  });

  test('没有科目', () => {
    expect(bestSubject(alan)).toBeNull();
  });

  test('0 分也是分数', () => {
    expect(bestSubject({ id: 5, name: 'Z', scores: { 体育: 0 } })).toBe('体育');
  });
});

describe('subjectAverage', () => {
  test('只统计有这门科目的学生', () => {
    expect(subjectAverage([ada, grace, alan], '物理')).toBe(90);
    expect(subjectAverage([ada, grace, alan], '数学')).toBe(95);
  });

  test('没有人有这门科目', () => {
    expect(subjectAverage([ada, grace], '历史')).toBeNull();
    expect(subjectAverage([], '数学')).toBeNull();
  });

  test('0 分计入平均', () => {
    const zero = { id: 6, name: 'Z', scores: { 数学: 0 } };
    expect(subjectAverage([ada, zero], '数学')).toBe(47.5);
  });
});
```
```ts file=students.test-d.ts
import { expectTypeOf } from 'vitest';
import type { Student } from './students';

expectTypeOf<Student>().toEqualTypeOf<{ id: number; name: string; scores: Record<string, number> }>();
expectTypeOf<Student['scores']>().toEqualTypeOf<{ [subject: string]: number }>();
```
:::

:::hint{level=1}
`scores` 的类型是 `Record<string, number>`（或 `{ [subject: string]: number }`）。找最高分可以遍历 `Object.entries(student.scores)`；读取某个学生的某门科目用 `student.scores[subject]`，它的类型是 `number | undefined`。
:::

:::hint{level=2}
`bestSubject`：初始 `best = null`、`bestScore = -Infinity`，遍历时只在 `score > bestScore`（严格大于）时更新，这样并列时保留先出现的。`subjectAverage`：`const score = student.scores[subject]; if (score !== undefined) { … }`。注意用 `!== undefined` 而不是真假检查，0 分也要计入。
:::

:::explanation
`Record<string, number>` 和 `{ [subject: string]: number }` 是同一个类型，表示“任意字符串键，值都是数字”。它准确描述了“科目事先不知道”的数据。

开启 `noUncheckedIndexedAccess` 后，`student.scores[subject]` 的类型是 `number | undefined`，TypeScript 强迫你处理“没有这门科目”的情况——这正是规格里要排除的学生。判断要用 `!== undefined`：用真假检查的话，0 分会被误当成“没有这门科目”（a07）。

`Object.entries` 返回的键值对只包含真实存在的键，值的类型是 `number`，不需要检查 `undefined`。普通对象的字符串键按插入顺序遍历（非负整数形式的键除外，例如 `'2'`、`'10'`，它们会按数值排在最前面——科目名不会遇到这种情况）。
:::

:::variant{kind=alt name=entries-reduce}
```ts file=students.ts
export interface Student {
  id: number;
  name: string;
  scores: { [subject: string]: number };
}

export function bestSubject(student: Student): string | null {
  const entries = Object.entries(student.scores);
  const first = entries[0];
  if (first === undefined) {
    return null;
  }
  return entries.reduce((best, entry) => (entry[1] > best[1] ? entry : best), first)[0];
}

export function subjectAverage(students: Student[], subject: string): number | null {
  const scores: number[] = [];
  for (const s of students) {
    const score = s.scores[subject];
    if (score !== undefined) scores.push(score);
  }
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}
```
:::

:::variant{kind=wrong name=truthy-score fails=tests reason="用真假检查判断有没有这门科目，0 分被忽略"}
```ts file=students.ts
export interface Student {
  id: number;
  name: string;
  scores: Record<string, number>;
}

export function bestSubject(student: Student): string | null {
  let best: string | null = null;
  let bestScore = -Infinity;
  for (const [subject, score] of Object.entries(student.scores)) {
    if (score > bestScore) {
      best = subject;
      bestScore = score;
    }
  }
  return best;
}

export function subjectAverage(students: Student[], subject: string): number | null {
  let total = 0;
  let count = 0;
  for (const student of students) {
    const score = student.scores[subject];
    if (score) {
      total += score;
      count++;
    }
  }
  return count === 0 ? null : total / count;
}
```
:::

:::variant{kind=wrong name=tie-last fails=tests reason="用 >= 比较，并列时取了后出现的科目"}
```ts file=students.ts
export interface Student {
  id: number;
  name: string;
  scores: Record<string, number>;
}

export function bestSubject(student: Student): string | null {
  let best: string | null = null;
  let bestScore = -Infinity;
  for (const [subject, score] of Object.entries(student.scores)) {
    if (score >= bestScore) {
      best = subject;
      bestScore = score;
    }
  }
  return best;
}

export function subjectAverage(students: Student[], subject: string): number | null {
  let total = 0;
  let count = 0;
  for (const student of students) {
    const score = student.scores[subject];
    if (score !== undefined) {
      total += score;
      count++;
    }
  }
  return count === 0 ? null : total / count;
}
```
:::

:::variant{kind=wrong name=fixed-subjects fails=types reason="把科目写成了固定的属性，不能描述任意科目"}
```ts file=students.ts
export interface Student {
  id: number;
  name: string;
  scores: { 数学: number; 物理: number };
}

export function bestSubject(student: Student): string | null {
  return student.scores.数学 >= student.scores.物理 ? '数学' : '物理';
}

export function subjectAverage(students: Student[], subject: string): number | null {
  if (students.length === 0) return null;
  let total = 0;
  for (const s of students) {
    total += subject === '数学' ? s.scores.数学 : s.scores.物理;
  }
  return total / students.length;
}
```
:::

:::variant{kind=wrong name=divide-all fails=tests reason="用全部学生的人数做除数"}
```ts file=students.ts
export interface Student {
  id: number;
  name: string;
  scores: Record<string, number>;
}

export function bestSubject(student: Student): string | null {
  let best: string | null = null;
  let bestScore = -Infinity;
  for (const [subject, score] of Object.entries(student.scores)) {
    if (score > bestScore) {
      best = subject;
      bestScore = score;
    }
  }
  return best;
}

export function subjectAverage(students: Student[], subject: string): number | null {
  let total = 0;
  let found = false;
  for (const student of students) {
    const score = student.scores[subject];
    if (score !== undefined) {
      total += score;
      found = true;
    }
  }
  return found ? total / students.length : null;
}
```
:::
