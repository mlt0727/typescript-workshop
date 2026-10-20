---
kind: challenge
title: 把“分”显示成人民币金额
---
账单里的金额以“分”为单位的整数保存。实现 `formatYuan(cents)`，返回给用户看的金额文字：

- 以 `¥` 开头，元和分之间用 `.` 分隔，分总是两位；
- 负数（退款）在 `¥` **前面**加 `-`，例如 `-350` 显示为 `'-¥3.50'`；
- `0` 显示为 `'¥0.00'`。

例如：`formatYuan(1205)` 返回 `'¥12.05'`，`formatYuan(5)` 返回 `'¥0.05'`，`formatYuan(123456)` 返回 `'¥1234.56'`（不需要千位分隔符）。传入的 `cents` 一定是整数。

:::files{role=starter}
```ts file=money.ts
export function formatYuan(cents: number): string {
  return '¥' + cents / 100;
}

console.log(formatYuan(1205), formatYuan(1250), formatYuan(-350));
```
:::

:::files{role=solution}
```ts file=money.ts
export function formatYuan(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const yuan = Math.floor(abs / 100);
  const fen = abs % 100;
  return `${sign}¥${yuan}.${String(fen).padStart(2, '0')}`;
}

console.log(formatYuan(1205), formatYuan(1250), formatYuan(-350));
```
:::

:::files{role=tests}
```ts file=money.test.ts
import { describe, expect, test } from 'vitest';
import { formatYuan } from './money';

describe('formatYuan', () => {
  test('分总是两位', () => {
    expect(formatYuan(1205)).toBe('¥12.05');
    expect(formatYuan(1250)).toBe('¥12.50');
    expect(formatYuan(1200)).toBe('¥12.00');
  });

  test('不足 1 元', () => {
    expect(formatYuan(5)).toBe('¥0.05');
    expect(formatYuan(99)).toBe('¥0.99');
  });

  test('零', () => {
    expect(formatYuan(0)).toBe('¥0.00');
  });

  test('较大的金额不加分隔符', () => {
    expect(formatYuan(123456)).toBe('¥1234.56');
  });

  test('负数的符号在 ¥ 前面', () => {
    expect(formatYuan(-350)).toBe('-¥3.50');
    expect(formatYuan(-5)).toBe('-¥0.05');
    expect(formatYuan(-123456)).toBe('-¥1234.56');
  });
});
```
:::

:::hint{level=1}
先把问题拆开：符号单独处理，剩下的部分用绝对值（`Math.abs`）计算元和分。分不足两位要补零。
:::

:::hint{level=2}
`const sign = cents < 0 ? '-' : '';`（`条件 ? 值1 : 值2` 与 Java/C++ 相同），然后对 `Math.abs(cents)` 用 `Math.floor(… / 100)` 求元、`% 100` 求分，分用 `String(fen).padStart(2, '0')` 补零，最后用模板字符串拼接 `` `${sign}¥${yuan}.${…}` ``。
:::

:::explanation
起始代码有两个问题：`1250 / 100` 是 `12.5`，数字转字符串时不会保留末尾的 `0`；负数的 `-` 出现在 `¥` 后面。

参考答案先取出符号，再只对绝对值做整数运算：`Math.floor(abs / 100)` 是元，`abs % 100` 是分，这两步都是精确的整数运算。分用 `padStart` 补成两位。

如果直接对负数计算，`Math.floor(-350 / 100)` 是 `-4`，`-350 % 100` 是 `-50`，结果会完全错误——这就是要先取绝对值的原因。

另一种写法是 `(abs / 100).toFixed(2)`：对整数分来说结果正确，因为 `toFixed` 会把最接近的浮点数四舍五入到两位小数。
:::

:::variant{kind=alt name=to-fixed}
```ts file=money.ts
export function formatYuan(cents: number): string {
  const text = '¥' + (Math.abs(cents) / 100).toFixed(2);
  if (cents < 0) {
    return '-' + text;
  }
  return text;
}
```
:::

:::variant{kind=wrong name=no-pad fails=tests reason="分没有补零，1205 显示成 ¥12.5"}
```ts file=money.ts
export function formatYuan(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}¥${Math.floor(abs / 100)}.${abs % 100}`;
}
```
:::

:::variant{kind=wrong name=sign-after-symbol fails=tests reason="负号放在了 ¥ 后面"}
```ts file=money.ts
export function formatYuan(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}
```
:::

:::variant{kind=wrong name=no-abs fails=tests reason="对负数直接取整和取余，结果错误"}
```ts file=money.ts
export function formatYuan(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const yuan = Math.floor(cents / 100);
  const fen = cents % 100;
  return `${sign}¥${yuan}.${String(fen).padStart(2, '0')}`;
}
```
:::
