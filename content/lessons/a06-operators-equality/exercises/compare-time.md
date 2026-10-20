---
kind: challenge
title: 比较两个时间
---
时间以文字给出，格式是 `小时:分钟`：分钟总是两位，小时可能是一位或两位（`'9:30'` 和 `'09:30'` 都可能出现，表示同一时间）。小时范围 0–23。

实现 `compareTime(a, b)`，规则与 Java 的 `compareTo` 相同：

- `a` 早于 `b` 时返回**负数**；
- 两者是同一时间时返回 `0`；
- `a` 晚于 `b` 时返回**正数**。

例如 `compareTime('9:30', '10:00')` 返回负数，`compareTime('09:30', '9:30')` 返回 `0`。

提示：分钟总是最后两个字符，可以用 a04 学过的 `slice(-2)` 取出；小时是冒号之前的部分，即 `slice(0, -3)`。

:::files{role=starter}
```ts file=time.ts
export function compareTime(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

console.log(compareTime('9:30', '10:00'));
```
:::

:::files{role=solution}
```ts file=time.ts
function toMinutes(time: string): number {
  const hours = Number(time.slice(0, -3));
  const minutes = Number(time.slice(-2));
  return hours * 60 + minutes;
}

export function compareTime(a: string, b: string): number {
  return toMinutes(a) - toMinutes(b);
}

console.log(compareTime('9:30', '10:00'));
```
:::

:::files{role=tests}
```ts file=time.test.ts
import { describe, expect, test } from 'vitest';
import { compareTime } from './time';

describe('compareTime', () => {
  test('一位数小时与两位数小时比较', () => {
    expect(compareTime('9:30', '10:00')).toBeLessThan(0);
    expect(compareTime('10:00', '9:30')).toBeGreaterThan(0);
  });

  test('补零与不补零表示同一时间', () => {
    expect(compareTime('09:30', '9:30')).toBe(0);
    expect(compareTime('0:05', '00:05')).toBe(0);
  });

  test('小时相同时比较分钟', () => {
    expect(compareTime('12:05', '12:50')).toBeLessThan(0);
    expect(compareTime('12:50', '12:05')).toBeGreaterThan(0);
  });

  test('一天的两端', () => {
    expect(compareTime('0:00', '23:59')).toBeLessThan(0);
    expect(compareTime('23:59', '23:59')).toBe(0);
  });
});
```
:::

:::hint{level=1}
起始代码直接比较字符串，按字典序 `'9'` 大于 `'1'`，所以 `'9:30'` 被认为晚于 `'10:00'`。要先把时间转换成数字再比较。
:::

:::hint{level=2}
写一个辅助函数把时间转换成“从 0 点开始的分钟数”：`Number(time.slice(0, -3)) * 60 + Number(time.slice(-2))`。然后 `compareTime` 返回两者的差。
:::

:::explanation
字符串比较按字符逐个进行：`'9:30'` 和 `'10:00'` 比较第一个字符，`'9'` 大于 `'1'`，于是得出了错误的结论。`'09:30'` 和 `'9:30'` 也因为文字不同而不相等。

把时间转换成从 0 点开始的分钟数后，比较就变成了普通的数字比较。返回 `toMinutes(a) - toMinutes(b)` 正好满足“早于为负、相同为 0、晚于为正”。

`slice(0, -3)` 去掉最后 3 个字符（冒号和两位分钟），剩下的就是小时，无论它是一位还是两位。`Number('09')` 是 `9`，前导零不影响数值。

另一种思路是先用 `padStart(5, '0')` 把时间补成固定的 `HH:MM` 格式再比较字符串：长度相同、每一位都补齐之后，字典序正好和时间先后一致。日期 `'2026-10-20'` 这类固定宽度的格式也可以这样比较。
:::

:::variant{kind=alt name=hhmm-number}
```ts file=time.ts
export function compareTime(a: string, b: string): number {
  const valueA = Number(a.slice(0, -3)) * 100 + Number(a.slice(-2));
  const valueB = Number(b.slice(0, -3)) * 100 + Number(b.slice(-2));
  if (valueA === valueB) {
    return 0;
  }
  return valueA < valueB ? -1 : 1;
}
```
:::

:::variant{kind=alt name=pad-compare}
```ts file=time.ts
export function compareTime(a: string, b: string): number {
  const fullA = a.padStart(5, '0');
  const fullB = b.padStart(5, '0');
  if (fullA === fullB) {
    return 0;
  }
  return fullA < fullB ? -1 : 1;
}
```
:::

:::variant{kind=wrong name=hours-only fails=tests reason="只比较了小时，忽略了分钟"}
```ts file=time.ts
export function compareTime(a: string, b: string): number {
  return Number(a.slice(0, -3)) - Number(b.slice(0, -3));
}
```
:::

:::variant{kind=wrong name=fixed-hours fails=tests reason="固定取前两个字符作为小时，'9:30' 取到 '9:'，转换成 NaN"}
```ts file=time.ts
function toMinutes(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(-2));
}

export function compareTime(a: string, b: string): number {
  return toMinutes(a) - toMinutes(b);
}
```
:::

:::variant{kind=wrong name=concat-strings fails=tests reason="拼接出来的仍然是字符串，按字典序比较 '930' 和 '1000'"}
```ts file=time.ts
export function compareTime(a: string, b: string): number {
  const valueA = a.slice(0, -3) + a.slice(-2);
  const valueB = b.slice(0, -3) + b.slice(-2);
  if (valueA === valueB) {
    return 0;
  }
  return valueA < valueB ? -1 : 1;
}
```
:::
