---
kind: task
title: 订单状态只能是这四种
---
订单状态只有四种：`'pending'`（待付款）、`'paid'`（已付款）、`'shipped'`（已发货）、`'cancelled'`（已取消）。

1. 定义并导出类型 `OrderStatus`，它只包含这四个值。
2. 把 `statusLabel` 的参数类型改成 `OrderStatus`，这样传入其他字符串时 TypeScript 会报错；同时去掉不再需要的“未知”分支。

| 状态 | 返回值 |
| --- | --- |
| `'pending'` | `'待付款'` |
| `'paid'` | `'已付款'` |
| `'shipped'` | `'已发货'` |
| `'cancelled'` | `'已取消'` |

:::files{role=starter}
```ts file=status.ts
export function statusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return '待付款';
    case 'paid':
      return '已付款';
    case 'shiped':
      return '已发货';
    case 'cancelled':
      return '已取消';
    default:
      return '未知';
  }
}
```
:::

:::files{role=solution}
```ts file=status.ts
export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'cancelled';

export function statusLabel(status: OrderStatus): string {
  switch (status) {
    case 'pending':
      return '待付款';
    case 'paid':
      return '已付款';
    case 'shipped':
      return '已发货';
    case 'cancelled':
      return '已取消';
  }
}
```
:::

:::files{role=tests}
```ts file=status.test.ts
import { expect, test } from 'vitest';
import { statusLabel } from './status';

test.each([
  ['pending', '待付款'],
  ['paid', '已付款'],
  ['shipped', '已发货'],
  ['cancelled', '已取消'],
] as const)('%s → %s', (status, label) => {
  expect(statusLabel(status)).toBe(label);
});
```
```ts file=status.test-d.ts
import { expectTypeOf } from 'vitest';
import { statusLabel, type OrderStatus } from './status';

expectTypeOf<OrderStatus>().toEqualTypeOf<'pending' | 'paid' | 'shipped' | 'cancelled'>();
expectTypeOf(statusLabel).parameter(0).toEqualTypeOf<OrderStatus>();

// @ts-expect-error 不在四种状态中的字符串应该被拒绝
statusLabel('closed');
```
:::

:::hint{level=1}
`export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'cancelled';`，然后把参数类型改成它。改完以后，TypeScript 会指出起始代码里一个拼写错误的 `case`。
:::

:::hint{level=2}
把参数类型改成 `OrderStatus` 后，`case 'shiped'` 会报错（这个值不可能出现），改成 `'shipped'`。四种情况都 `return` 了，`default` 分支就可以删掉：TypeScript 知道 `switch` 已经覆盖了所有可能，函数不会走到末尾。
:::

:::explanation
参数是 `string` 时，`case 'shiped'` 这样的拼写错误不会被发现，`'shipped'` 会落到 `default` 返回“未知”。把参数改成字面量联合后，TypeScript 知道 `status` 只可能是四个值之一：拼错的 `case` 立刻报错（它和 `OrderStatus` 没有交集），调用时传入别的字符串也会报错。

四个 `case` 都返回后，TypeScript 能判断 `switch` 之后的代码不可达，所以不需要 `default`，也不会报“函数缺少返回语句”。b09 会讲如何利用这一点做**穷尽检查**：以后给 `OrderStatus` 增加一个新状态时，让 TypeScript 指出所有忘了处理它的地方。

测试中的 `as const` 让数组里的字符串保持字面量类型，b16 会讲。
:::

:::variant{kind=alt name=record-lookup}
```ts file=status.ts
export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'cancelled';

const LABELS: Record<OrderStatus, string> = {
  pending: '待付款',
  paid: '已付款',
  shipped: '已发货',
  cancelled: '已取消',
};

export function statusLabel(status: OrderStatus): string {
  return LABELS[status];
}
```
:::

:::variant{kind=wrong name=string-param fails=types reason="参数仍然是 string，任意字符串都能传入"}
```ts file=status.ts
export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'cancelled';

export function statusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return '待付款';
    case 'paid':
      return '已付款';
    case 'shipped':
      return '已发货';
    case 'cancelled':
      return '已取消';
    default:
      return '未知';
  }
}
```
:::

:::variant{kind=wrong name=missing-case fails=types reason="漏掉了 cancelled，函数可能走到末尾而没有返回值"}
```ts file=status.ts
export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'cancelled';

export function statusLabel(status: OrderStatus): string {
  switch (status) {
    case 'pending':
      return '待付款';
    case 'paid':
      return '已付款';
    case 'shipped':
      return '已发货';
  }
}
```
:::
