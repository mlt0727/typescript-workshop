---
kind: task
title: 订单报表
---
订单的类型是 `{ id: string; amount: number; paid: boolean }`（`amount` 单位为分）。实现三个函数：

- `paidTotal(orders)`：已付款订单的金额总和；没有订单时为 `0`。
- `unpaidIds(orders)`：未付款订单的 `id` 数组，保持原来的顺序。
- `findLarge(orders, min)`：第一个金额**大于或等于** `min` 的订单；没有时返回 `undefined`。

三个函数都不能修改传入的数组。

:::files{role=starter}
```ts file=report.ts
type Order = { id: string; amount: number; paid: boolean };

export function paidTotal(orders: Order[]): number {
  return orders.reduce((sum, o) => sum + o.amount);
}

export function unpaidIds(orders: Order[]): string[] {
  return orders.filter((o) => o.paid).map((o) => o.id);
}

export function findLarge(orders: Order[], min: number): Order | undefined {
  return orders.filter((o) => o.amount > min)[0];
}
```
:::

:::files{role=solution}
```ts file=report.ts
type Order = { id: string; amount: number; paid: boolean };

export function paidTotal(orders: Order[]): number {
  return orders.filter((o) => o.paid).reduce((sum, o) => sum + o.amount, 0);
}

export function unpaidIds(orders: Order[]): string[] {
  return orders.filter((o) => !o.paid).map((o) => o.id);
}

export function findLarge(orders: Order[], min: number): Order | undefined {
  return orders.find((o) => o.amount >= min);
}
```
:::

:::files{role=tests}
```ts file=report.test.ts
import { describe, expect, test } from 'vitest';
import { findLarge, paidTotal, unpaidIds } from './report';

const orders = [
  { id: 'A1', amount: 3000, paid: true },
  { id: 'A2', amount: 5000, paid: false },
  { id: 'A3', amount: 2000, paid: true },
  { id: 'A4', amount: 8000, paid: false },
];

describe('paidTotal', () => {
  test('只统计已付款的订单', () => {
    expect(paidTotal(orders)).toBe(5000);
  });

  test('没有订单时为 0', () => {
    expect(paidTotal([])).toBe(0);
  });

  test('没有已付款订单时为 0', () => {
    expect(paidTotal([{ id: 'B1', amount: 100, paid: false }])).toBe(0);
  });
});

describe('unpaidIds', () => {
  test('未付款订单的 id，保持顺序', () => {
    expect(unpaidIds(orders)).toEqual(['A2', 'A4']);
  });
});

describe('findLarge', () => {
  test('第一个满足条件的订单', () => {
    expect(findLarge(orders, 4000)).toEqual({ id: 'A2', amount: 5000, paid: false });
  });

  test('正好等于 min 也算', () => {
    expect(findLarge(orders, 8000)?.id).toBe('A4');
  });

  test('找不到时返回 undefined', () => {
    expect(findLarge(orders, 10000)).toBeUndefined();
  });
});

test('不修改传入的数组', () => {
  const copy = structuredClone(orders);
  paidTotal(orders);
  unpaidIds(orders);
  findLarge(orders, 0);
  expect(orders).toEqual(copy);
});
```
:::

:::hint{level=1}
起始代码有三处错误：`reduce` 的累计方式和初始值、`filter` 的条件、查找时的比较。逐个对照规格检查，并运行看看。
:::

:::hint{level=2}
`paidTotal`：先 `filter((o) => o.paid)`，再 `reduce((sum, o) => sum + o.amount, 0)`。`unpaidIds`：条件是 `!o.paid`。`findLarge`：用 `find`，条件是 `o.amount >= min`。
:::

:::explanation
`reduce` 没有初始值时，会把第一个**订单对象**当成初始累计值，于是 `sum + o.amount` 变成了“对象 + 数字”，TypeScript 报错；空数组时还会抛出 `TypeError`。提供初始值 `0` 后，累计值从数字开始，类型也就对了。

`filter((o) => o.paid)` 留下的是已付款订单，未付款要用 `!o.paid`。

`filter(...)[0]` 能找到第一个满足条件的元素，但它会遍历整个数组并创建一个新数组，而且在本平台它的类型同样是 `Order | undefined`。`find` 直接表达了“找第一个”，找到就停止。
:::

:::variant{kind=alt name=loops}
```ts file=report.ts
type Order = { id: string; amount: number; paid: boolean };

export function paidTotal(orders: Order[]): number {
  let total = 0;
  for (const o of orders) {
    if (o.paid) {
      total += o.amount;
    }
  }
  return total;
}

export function unpaidIds(orders: Order[]): string[] {
  const ids: string[] = [];
  for (const o of orders) {
    if (!o.paid) {
      ids.push(o.id);
    }
  }
  return ids;
}

export function findLarge(orders: Order[], min: number): Order | undefined {
  for (const o of orders) {
    if (o.amount >= min) {
      return o;
    }
  }
  return undefined;
}
```
:::

:::variant{kind=wrong name=sum-all fails=tests reason="没有先筛选已付款的订单"}
```ts file=report.ts
type Order = { id: string; amount: number; paid: boolean };

export function paidTotal(orders: Order[]): number {
  return orders.reduce((sum, o) => sum + o.amount, 0);
}

export function unpaidIds(orders: Order[]): string[] {
  return orders.filter((o) => !o.paid).map((o) => o.id);
}

export function findLarge(orders: Order[], min: number): Order | undefined {
  return orders.find((o) => o.amount >= min);
}
```
:::

:::variant{kind=wrong name=strict-greater fails=tests reason="用了 >，金额正好等于 min 的订单没有被找到"}
```ts file=report.ts
type Order = { id: string; amount: number; paid: boolean };

export function paidTotal(orders: Order[]): number {
  return orders.filter((o) => o.paid).reduce((sum, o) => sum + o.amount, 0);
}

export function unpaidIds(orders: Order[]): string[] {
  return orders.filter((o) => !o.paid).map((o) => o.id);
}

export function findLarge(orders: Order[], min: number): Order | undefined {
  return orders.find((o) => o.amount > min);
}
```
:::

:::variant{kind=wrong name=no-initial fails=tests reason="reduce 没有初始值，没有已付款订单时抛出 TypeError"}
```ts file=report.ts
type Order = { id: string; amount: number; paid: boolean };

export function paidTotal(orders: Order[]): number {
  return orders.filter((o) => o.paid).map((o) => o.amount).reduce((sum, a) => sum + a);
}

export function unpaidIds(orders: Order[]): string[] {
  return orders.filter((o) => !o.paid).map((o) => o.id);
}

export function findLarge(orders: Order[], min: number): Order | undefined {
  return orders.find((o) => o.amount >= min);
}
```
:::
