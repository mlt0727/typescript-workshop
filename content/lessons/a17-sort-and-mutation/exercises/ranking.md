---
kind: challenge
title: 比赛排名
---
每位选手的成绩是 `{ name: string; score: number; seconds: number }`（得分越高越好，用时越短越好）。实现 `ranking(players)`，返回排名文字数组，格式为 `'名次. 名字'`。

排序规则：

1. 得分高的在前；
2. 得分相同时，用时短的在前；
3. 得分和用时都相同时，按名字 `localeCompare` 的顺序排列。

名次规则：得分和用时**都相同**的选手名次相同；下一位的名次跳过并列的人数（即 1、2、2、4 式排名）。

例如 Ada（90 分，30 秒）、Bob（95 分，40 秒）、Cy（90 分，30 秒）、Dan（90 分，35 秒）的结果是：

```ts
['1. Bob', '2. Ada', '2. Cy', '4. Dan']
```

参数是只读数组，不能修改它。

:::files{role=starter}
```ts file=ranking.ts
type Player = { name: string; score: number; seconds: number };

export function ranking(players: readonly Player[]): string[] {
  return players.map((p, i) => `${i + 1}. ${p.name}`);
}
```
:::

:::files{role=solution}
```ts file=ranking.ts
type Player = { name: string; score: number; seconds: number };

function compare(a: Player, b: Player): number {
  if (a.score !== b.score) {
    return b.score - a.score;
  }
  if (a.seconds !== b.seconds) {
    return a.seconds - b.seconds;
  }
  return a.name.localeCompare(b.name);
}

export function ranking(players: readonly Player[]): string[] {
  const sorted = players.toSorted(compare);
  const lines: string[] = [];
  let rank = 0;
  let previous: Player | undefined = undefined;

  sorted.forEach((player, index) => {
    const tied = previous !== undefined && previous.score === player.score && previous.seconds === player.seconds;
    if (!tied) {
      rank = index + 1;
    }
    lines.push(`${rank}. ${player.name}`);
    previous = player;
  });

  return lines;
}
```
:::

:::files{role=tests}
```ts file=ranking.test.ts
import { describe, expect, test } from 'vitest';
import { ranking } from './ranking';

describe('ranking', () => {
  test('题目中的例子', () => {
    expect(
      ranking([
        { name: 'Ada', score: 90, seconds: 30 },
        { name: 'Bob', score: 95, seconds: 40 },
        { name: 'Cy', score: 90, seconds: 30 },
        { name: 'Dan', score: 90, seconds: 35 },
      ]),
    ).toEqual(['1. Bob', '2. Ada', '2. Cy', '4. Dan']);
  });

  test('得分相同比用时', () => {
    expect(
      ranking([
        { name: 'Slow', score: 80, seconds: 50 },
        { name: 'Fast', score: 80, seconds: 20 },
      ]),
    ).toEqual(['1. Fast', '2. Slow']);
  });

  test('并列时名字排序，名次相同', () => {
    expect(
      ranking([
        { name: 'Eve', score: 70, seconds: 10 },
        { name: 'Ann', score: 70, seconds: 10 },
      ]),
    ).toEqual(['1. Ann', '1. Eve']);
  });

  test('多组并列', () => {
    expect(
      ranking([
        { name: 'A', score: 10, seconds: 1 },
        { name: 'B', score: 10, seconds: 1 },
        { name: 'C', score: 5, seconds: 1 },
        { name: 'D', score: 5, seconds: 1 },
        { name: 'E', score: 1, seconds: 1 },
      ]),
    ).toEqual(['1. A', '1. B', '3. C', '3. D', '5. E']);
  });

  test('得分为两位和三位数时按数值比较', () => {
    expect(
      ranking([
        { name: 'Low', score: 9, seconds: 1 },
        { name: 'High', score: 100, seconds: 1 },
      ]),
    ).toEqual(['1. High', '2. Low']);
  });

  test('空数组', () => {
    expect(ranking([])).toEqual([]);
  });

  test('不修改传入的数组', () => {
    const players = [
      { name: 'B', score: 1, seconds: 1 },
      { name: 'A', score: 2, seconds: 1 },
    ];
    ranking(players);
    expect(players.map((p) => p.name)).toEqual(['B', 'A']);
  });
});
```
:::

:::hint{level=1}
分两步：先用 `toSorted` 按三个条件排序（写一个比较函数，前一个条件相等时再比较下一个）；再遍历排好序的数组计算名次。
:::

:::hint{level=2}
计算名次时记住上一位选手：如果和上一位得分、用时都相同，沿用上一位的名次；否则名次等于“当前下标 + 1”（这就自动跳过了并列的人数）。
:::

:::explanation
比较函数按优先级依次比较：得分不同就按得分降序（`b.score - a.score`）；得分相同再按用时升序；都相同再比较名字。每一步只在前一个条件“相等”时才进入，这是多条件排序的通用写法。

1、2、2、4 式名次的关键是：并列时沿用上一位的名次，不并列时名次是**下标 + 1**，而不是“上一个名次 + 1”。后者会得到 1、2、2、3 式的名次。

使用 `toSorted` 而不是 `sort`，既不修改调用方的数组，也满足参数的 `readonly` 类型。
:::

:::variant{kind=alt name=for-loop}
```ts file=ranking.ts
type Player = { name: string; score: number; seconds: number };

export function ranking(players: readonly Player[]): string[] {
  const sorted = [...players].sort(
    (a, b) => b.score - a.score || a.seconds - b.seconds || a.name.localeCompare(b.name),
  );
  const lines: string[] = [];
  let rank = 1;
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const before = sorted[i - 1];
    if (current === undefined) {
      continue;
    }
    if (before !== undefined && (before.score !== current.score || before.seconds !== current.seconds)) {
      rank = i + 1;
    }
    lines.push(`${rank}. ${current.name}`);
  }
  return lines;
}
```
:::

:::variant{kind=wrong name=dense-rank fails=tests reason="名次按“上一个名次 + 1”计算，得到 1、2、2、3"}
```ts file=ranking.ts
type Player = { name: string; score: number; seconds: number };

export function ranking(players: readonly Player[]): string[] {
  const sorted = players.toSorted(
    (a, b) => b.score - a.score || a.seconds - b.seconds || a.name.localeCompare(b.name),
  );
  const lines: string[] = [];
  let rank = 0;
  let previous: Player | undefined = undefined;
  for (const p of sorted) {
    if (previous === undefined || previous.score !== p.score || previous.seconds !== p.seconds) {
      rank++;
    }
    lines.push(`${rank}. ${p.name}`);
    previous = p;
  }
  return lines;
}
```
:::

:::variant{kind=wrong name=ignore-seconds fails=tests reason="得分相同时没有比较用时"}
```ts file=ranking.ts
type Player = { name: string; score: number; seconds: number };

export function ranking(players: readonly Player[]): string[] {
  const sorted = players.toSorted((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const lines: string[] = [];
  let rank = 0;
  sorted.forEach((p, i) => {
    const before = sorted[i - 1];
    if (before === undefined || before.score !== p.score) {
      rank = i + 1;
    }
    lines.push(`${rank}. ${p.name}`);
  });
  return lines;
}
```
:::

:::variant{kind=wrong name=sort-mutates fails=types reason="对只读数组调用了 sort"}
```ts file=ranking.ts
type Player = { name: string; score: number; seconds: number };

export function ranking(players: readonly Player[]): string[] {
  const sorted = players.sort(
    (a: Player, b: Player) => b.score - a.score || a.seconds - b.seconds || a.name.localeCompare(b.name),
  );
  return sorted.map((p: Player, i: number) => `${i + 1}. ${p.name}`);
}
```
:::

:::variant{kind=wrong name=default-sort-score fails=tests reason="把得分转成字符串比较，100 排在了 9 后面"}
```ts file=ranking.ts
type Player = { name: string; score: number; seconds: number };

export function ranking(players: readonly Player[]): string[] {
  const sorted = players.toSorted((a, b) => {
    const byScore = String(b.score).localeCompare(String(a.score));
    if (byScore !== 0) return byScore;
    if (a.seconds !== b.seconds) return a.seconds - b.seconds;
    return a.name.localeCompare(b.name);
  });
  const lines: string[] = [];
  let rank = 0;
  sorted.forEach((p, i) => {
    const before = sorted[i - 1];
    if (before === undefined || before.score !== p.score || before.seconds !== p.seconds) rank = i + 1;
    lines.push(`${rank}. ${p.name}`);
  });
  return lines;
}
```
:::
