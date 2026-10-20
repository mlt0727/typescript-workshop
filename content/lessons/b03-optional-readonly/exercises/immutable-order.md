---
kind: challenge
title: 不可变的订单
---
订单对象会被界面的多个部分同时引用，所以它必须是**不可变**的：任何修改都返回一个新订单，原订单保持不变。

1. 修改起始代码中的两个类型，让 TypeScript 在类型层面禁止修改：`OrderItem` 和 `Order` 的所有属性都是 `readonly`，`items` 是只读数组 `readonly OrderItem[]`。
2. 修改三个函数，让它们不再修改传入的订单，而是返回新订单：
   - `addItem(order, sku, quantity)`：`quantity` 必须是正整数，否则抛出 `RangeError`；订单已取消时抛出 `Error('订单已取消')`；已有相同 `sku` 时把数量加到那一项上（位置不变），否则添加到末尾。
   - `removeItem(order, sku)`：去掉该 `sku` 的项；没有这一项时，返回一个内容相同的新订单。
   - `cancelOrder(order)`：返回 `cancelled` 为 `true` 的新订单。

:::files{role=starter}
```ts file=order.ts
export interface OrderItem {
  sku: string;
  quantity: number;
}

export interface Order {
  id: string;
  cancelled: boolean;
  items: OrderItem[];
}

export function addItem(order: Order, sku: string, quantity: number): Order {
  const existing = order.items.find((item) => item.sku === sku);
  if (existing) {
    existing.quantity += quantity;
  } else {
    order.items.push({ sku, quantity });
  }
  return order;
}

export function removeItem(order: Order, sku: string): Order {
  const index = order.items.findIndex((item) => item.sku === sku);
  if (index >= 0) {
    order.items.splice(index, 1);
  }
  return order;
}

export function cancelOrder(order: Order): Order {
  order.cancelled = true;
  return order;
}
```
:::

:::files{role=solution}
```ts file=order.ts
export interface OrderItem {
  readonly sku: string;
  readonly quantity: number;
}

export interface Order {
  readonly id: string;
  readonly cancelled: boolean;
  readonly items: readonly OrderItem[];
}

export function addItem(order: Order, sku: string, quantity: number): Order {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new RangeError(`数量无效：${quantity}`);
  }
  if (order.cancelled) {
    throw new Error('订单已取消');
  }
  const exists = order.items.some((item) => item.sku === sku);
  const items = exists
    ? order.items.map((item) => (item.sku === sku ? { sku: sku, quantity: item.quantity + quantity } : item))
    : [...order.items, { sku: sku, quantity: quantity }];
  return { ...order, items: items };
}

export function removeItem(order: Order, sku: string): Order {
  return { ...order, items: order.items.filter((item) => item.sku !== sku) };
}

export function cancelOrder(order: Order): Order {
  return { ...order, cancelled: true };
}
```
:::

:::files{role=tests}
```ts file=order.test.ts
import { describe, expect, test } from 'vitest';
import { addItem, cancelOrder, removeItem, type Order } from './order';

function sample(): Order {
  return { id: 'A1', cancelled: false, items: [{ sku: 'pen', quantity: 1 }, { sku: 'ink', quantity: 2 }] };
}

describe('addItem', () => {
  test('添加新商品到末尾', () => {
    expect(addItem(sample(), 'pad', 3).items).toEqual([
      { sku: 'pen', quantity: 1 },
      { sku: 'ink', quantity: 2 },
      { sku: 'pad', quantity: 3 },
    ]);
  });

  test('已有商品时累加数量，位置不变', () => {
    expect(addItem(sample(), 'pen', 4).items).toEqual([
      { sku: 'pen', quantity: 5 },
      { sku: 'ink', quantity: 2 },
    ]);
  });

  test('不修改原订单和原来的商品项', () => {
    const order = sample();
    const firstItem = order.items[0];
    const result = addItem(order, 'pen', 4);
    expect(order).toEqual(sample());
    expect(firstItem).toEqual({ sku: 'pen', quantity: 1 });
    expect(result).not.toBe(order);
    expect(result.items).not.toBe(order.items);
  });

  test('数量必须是正整数', () => {
    expect(() => addItem(sample(), 'pen', 0)).toThrow(RangeError);
    expect(() => addItem(sample(), 'pen', -1)).toThrow(RangeError);
    expect(() => addItem(sample(), 'pen', 1.5)).toThrow(RangeError);
  });

  test('已取消的订单不能添加', () => {
    expect(() => addItem(cancelOrder(sample()), 'pen', 1)).toThrow('订单已取消');
  });
});

describe('removeItem', () => {
  test('去掉指定商品', () => {
    expect(removeItem(sample(), 'pen').items).toEqual([{ sku: 'ink', quantity: 2 }]);
  });

  test('不存在时返回内容相同的新订单', () => {
    const order = sample();
    const result = removeItem(order, 'nothing');
    expect(result).toEqual(order);
    expect(result).not.toBe(order);
  });

  test('不修改原订单', () => {
    const order = sample();
    removeItem(order, 'pen');
    expect(order.items).toHaveLength(2);
  });
});

describe('cancelOrder', () => {
  test('返回已取消的新订单', () => {
    const order = sample();
    const result = cancelOrder(order);
    expect(result.cancelled).toBe(true);
    expect(order.cancelled).toBe(false);
    expect(result.items).toEqual(order.items);
  });
});
```
```ts file=order.test-d.ts
import { expectTypeOf } from 'vitest';
import type { Order, OrderItem } from './order';

expectTypeOf<OrderItem>().toEqualTypeOf<{ readonly sku: string; readonly quantity: number }>();
expectTypeOf<Order['items']>().toEqualTypeOf<readonly OrderItem[]>();
expectTypeOf<Order>().toEqualTypeOf<{
  readonly id: string;
  readonly cancelled: boolean;
  readonly items: readonly OrderItem[];
}>();
```
:::

:::hint{level=1}
先改类型：给每个属性加 `readonly`，`items` 改成 `readonly OrderItem[]`。改完后，起始代码里所有修改订单的地方都会报错——它们正是需要重写的地方。
:::

:::hint{level=2}
用 a11、a16、a17 学过的不修改原数据的写法：`{ ...order, cancelled: true }`；`order.items.filter(…)`；累加数量用 `order.items.map((item) => item.sku === sku ? { sku, quantity: item.quantity + quantity } : item)`；添加用 `[...order.items, { sku, quantity }]`。
:::

:::explanation
把属性和数组都标成只读后，TypeScript 会拒绝所有直接修改：`existing.quantity += …`、`order.items.push(…)`、`order.cancelled = true` 都会报错。类型帮你找出了所有需要改写的位置。

改写的关键是“复制被修改的那一层”：订单对象用展开复制；`items` 用 `map`、`filter` 或展开得到新数组；被修改的那一个商品项用新对象替换，其他商品项原样复用（它们没变，共享是安全的，因为它们也是只读的）。

这正是 React 等框架更新状态时的写法（G 阶段）。只读类型让“不小心修改了共享数据”从运行时的隐蔽 bug 变成了编译错误。
:::

:::variant{kind=alt name=findIndex-with}
```ts file=order.ts
export interface OrderItem {
  readonly sku: string;
  readonly quantity: number;
}

export interface Order {
  readonly id: string;
  readonly cancelled: boolean;
  readonly items: readonly OrderItem[];
}

export function addItem(order: Order, sku: string, quantity: number): Order {
  if (!(Number.isInteger(quantity) && quantity > 0)) throw new RangeError('数量必须是正整数');
  if (order.cancelled) throw new Error('订单已取消');
  const index = order.items.findIndex((item) => item.sku === sku);
  const current = order.items[index];
  const items =
    current === undefined
      ? order.items.concat({ sku, quantity })
      : order.items.with(index, { sku, quantity: current.quantity + quantity });
  return { id: order.id, cancelled: order.cancelled, items };
}

export function removeItem(order: Order, sku: string): Order {
  return { id: order.id, cancelled: order.cancelled, items: order.items.filter((i) => i.sku !== sku) };
}

export function cancelOrder(order: Order): Order {
  return { id: order.id, cancelled: true, items: order.items };
}
```
:::

:::variant{kind=wrong name=mutable-types fails=types reason="没有把类型改成只读"}
```ts file=order.ts
export interface OrderItem {
  sku: string;
  quantity: number;
}

export interface Order {
  id: string;
  cancelled: boolean;
  items: OrderItem[];
}

export function addItem(order: Order, sku: string, quantity: number): Order {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new RangeError('数量无效');
  if (order.cancelled) throw new Error('订单已取消');
  const exists = order.items.some((item) => item.sku === sku);
  const items = exists
    ? order.items.map((item) => (item.sku === sku ? { sku, quantity: item.quantity + quantity } : item))
    : [...order.items, { sku, quantity }];
  return { ...order, items };
}

export function removeItem(order: Order, sku: string): Order {
  return { ...order, items: order.items.filter((item) => item.sku !== sku) };
}

export function cancelOrder(order: Order): Order {
  return { ...order, cancelled: true };
}
```
:::

:::variant{kind=wrong name=shallow-item-mutation fails=types reason="复制了订单，却直接修改了共享的商品项"}
```ts file=order.ts
export interface OrderItem {
  readonly sku: string;
  readonly quantity: number;
}

export interface Order {
  readonly id: string;
  readonly cancelled: boolean;
  readonly items: readonly OrderItem[];
}

export function addItem(order: Order, sku: string, quantity: number): Order {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new RangeError('数量无效');
  if (order.cancelled) throw new Error('订单已取消');
  const existing = order.items.find((item) => item.sku === sku);
  if (existing) {
    existing.quantity += quantity;
    return { ...order };
  }
  return { ...order, items: [...order.items, { sku, quantity }] };
}

export function removeItem(order: Order, sku: string): Order {
  return { ...order, items: order.items.filter((item) => item.sku !== sku) };
}

export function cancelOrder(order: Order): Order {
  return { ...order, cancelled: true };
}
```
:::

:::variant{kind=wrong name=no-cancel-check fails=tests reason="没有检查订单是否已取消"}
```ts file=order.ts
export interface OrderItem {
  readonly sku: string;
  readonly quantity: number;
}

export interface Order {
  readonly id: string;
  readonly cancelled: boolean;
  readonly items: readonly OrderItem[];
}

export function addItem(order: Order, sku: string, quantity: number): Order {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new RangeError('数量无效');
  const exists = order.items.some((item) => item.sku === sku);
  const items = exists
    ? order.items.map((item) => (item.sku === sku ? { sku, quantity: item.quantity + quantity } : item))
    : [...order.items, { sku, quantity }];
  return { ...order, items };
}

export function removeItem(order: Order, sku: string): Order {
  return { ...order, items: order.items.filter((item) => item.sku !== sku) };
}

export function cancelOrder(order: Order): Order {
  return { ...order, cancelled: true };
}
```
:::
