---
kind: task
title: 修好配送天数的 switch
---
`deliveryDays(region)` 返回发往某个地区需要的配送天数：

| 地区 | 天数 |
| --- | --- |
| `华东` | 1 |
| `华北`、`华南` | 2 |
| `西北`、`西南` | 4 |
| 其他 | `null`（不支持配送） |

起始代码的 `switch` 有贯穿问题，TypeScript 报了 TS7029。修好它。

:::files{role=starter}
```ts file=delivery.ts
export function deliveryDays(region: string): number | null {
  let days: number | null = null;
  switch (region) {
    case '华东':
      days = 1;
    case '华北':
    case '华南':
      days = 2;
      break;
    case '西北':
    case '西南':
      days = 4;
    default:
      days = null;
  }
  return days;
}

console.log(deliveryDays('华东'), deliveryDays('西南'), deliveryDays('火星'));
```
:::

:::files{role=solution}
```ts file=delivery.ts
export function deliveryDays(region: string): number | null {
  let days: number | null = null;
  switch (region) {
    case '华东':
      days = 1;
      break;
    case '华北':
    case '华南':
      days = 2;
      break;
    case '西北':
    case '西南':
      days = 4;
      break;
    default:
      days = null;
  }
  return days;
}

console.log(deliveryDays('华东'), deliveryDays('西南'), deliveryDays('火星'));
```
:::

:::files{role=tests}
```ts file=delivery.test.ts
import { expect, test } from 'vitest';
import { deliveryDays } from './delivery';

test.each([
  ['华东', 1],
  ['华北', 2],
  ['华南', 2],
  ['西北', 4],
  ['西南', 4],
])('%s 需要 %i 天', (region, days) => {
  expect(deliveryDays(region)).toBe(days);
});

test('不支持的地区返回 null', () => {
  expect(deliveryDays('火星')).toBeNull();
  expect(deliveryDays('')).toBeNull();
});
```
:::

:::hint{level=1}
TS7029 指出了哪两个 `case` 会贯穿到下一个？运行一下，看看 `华东` 和 `西南` 得到了什么。
:::

:::hint{level=2}
在 `days = 1;` 和 `days = 4;` 后面各加一个 `break;`。也可以把每个 `case` 改成直接 `return`。
:::

:::explanation
`case '华东'` 执行 `days = 1` 后没有 `break`，继续执行了下面的 `days = 2`；`case '西南'` 执行 `days = 4` 后贯穿到 `default`，又被改成了 `null`。TypeScript 的 `noFallthroughCasesInSwitch` 在这两处都报了 TS7029。

`case '华北':` 和 `case '西北':` 是空的 `case`，它们叠在下一个 `case` 上表示“同样处理”，不会报错。

在函数里，每个分支直接 `return` 往往更简洁，也就不存在忘写 `break` 的问题，见另一种写法。
:::

:::variant{kind=alt name=returns}
```ts file=delivery.ts
export function deliveryDays(region: string): number | null {
  switch (region) {
    case '华东':
      return 1;
    case '华北':
    case '华南':
      return 2;
    case '西北':
    case '西南':
      return 4;
    default:
      return null;
  }
}
```
:::

:::variant{kind=wrong name=fix-first-only fails=types reason="只修了第一处贯穿，西南仍然贯穿到 default"}
```ts file=delivery.ts
export function deliveryDays(region: string): number | null {
  let days: number | null = null;
  switch (region) {
    case '华东':
      days = 1;
      break;
    case '华北':
    case '华南':
      days = 2;
      break;
    case '西北':
    case '西南':
      days = 4;
    default:
      days = null;
  }
  return days;
}
```
:::

:::variant{kind=wrong name=default-zero fails=tests reason="不支持的地区返回了 0，而不是 null"}
```ts file=delivery.ts
export function deliveryDays(region: string): number | null {
  switch (region) {
    case '华东':
      return 1;
    case '华北':
    case '华南':
      return 2;
    case '西北':
    case '西南':
      return 4;
    default:
      return 0;
  }
}
```
:::
