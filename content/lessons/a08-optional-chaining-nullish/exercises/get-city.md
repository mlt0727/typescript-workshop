---
kind: task
title: 安全地读取收货城市
---
订单里的 `customer`（顾客）和顾客的 `address`（地址）都可能缺失。修改 `getCity`，让它在**任何一层缺失时返回 `undefined`**，而不是抛出错误。

要求：返回类型保持 `string | undefined`；不要使用非空断言 `!` 或类型断言。

:::files{role=starter}
```ts file=city.ts
export type Order = {
  id: number;
  customer?: {
    name: string;
    address?: {
      city: string;
    };
  };
};

export function getCity(order: Order): string | undefined {
  return order.customer.address.city;
}
```
:::

:::files{role=solution}
```ts file=city.ts
export type Order = {
  id: number;
  customer?: {
    name: string;
    address?: {
      city: string;
    };
  };
};

export function getCity(order: Order): string | undefined {
  return order.customer?.address?.city;
}
```
:::

:::files{role=tests}
```ts file=city.test.ts
import { expect, test } from 'vitest';
import { getCity, type Order } from './city';

test('信息完整时返回城市', () => {
  const order: Order = { id: 1, customer: { name: 'Ada', address: { city: '杭州' } } };
  expect(getCity(order)).toBe('杭州');
});

test('没有顾客时返回 undefined', () => {
  expect(getCity({ id: 2 })).toBeUndefined();
});

test('有顾客但没有地址时返回 undefined', () => {
  expect(getCity({ id: 3, customer: { name: 'Bob' } })).toBeUndefined();
});
```
```ts file=city.test-d.ts
import { expectTypeOf } from 'vitest';
import { getCity } from './city';

expectTypeOf(getCity).returns.toEqualTypeOf<string | undefined>();
```
:::

:::hint{level=1}
链上有两个位置可能是 `undefined`。每一个可能缺失的位置都需要自己的 `?.`。
:::

:::hint{level=2}
`order.customer?.address` 在顾客缺失时会停下；但如果顾客存在、地址缺失，后面的 `.city` 仍然会在 `undefined` 上读取属性。
:::

:::explanation
`order.customer?.address?.city`：任何一个 `?.` 左边是 `undefined` 时，整个表达式立即得到 `undefined`。两个 `?.` 分别保护“顾客缺失”和“地址缺失”两种情况。

也可以写成 `order.customer && order.customer.address && order.customer.address.city`：因为对象总是 truthy，这里 `&&` 与 `?.` 的效果相同，只是更啰嗦。
:::

:::variant{kind=alt name=and-chain}
```ts file=city.ts
export type Order = {
  id: number;
  customer?: {
    name: string;
    address?: {
      city: string;
    };
  };
};

export function getCity(order: Order): string | undefined {
  return order.customer && order.customer.address && order.customer.address.city;
}
```
:::

:::variant{kind=wrong name=only-first-level fails=types reason="只保护了第一层：地址缺失时仍会抛错，TypeScript 也会报 address 可能为 undefined"}
```ts file=city.ts
export type Order = {
  id: number;
  customer?: {
    name: string;
    address?: {
      city: string;
    };
  };
};

export function getCity(order: Order): string | undefined {
  return order.customer?.address.city;
}
```
:::

:::variant{kind=wrong name=non-null fails=rules reason="用非空断言让类型错误消失，运行时仍然崩溃"}
```ts file=city.ts
export type Order = {
  id: number;
  customer?: {
    name: string;
    address?: {
      city: string;
    };
  };
};

export function getCity(order: Order): string | undefined {
  return order.customer!.address!.city;
}
```
:::

:::variant{kind=wrong name=hardcoded fails=tests reason="写死一个城市，只能骗过第一条测试"}
```ts file=city.ts
export type Order = {
  id: number;
  customer?: {
    name: string;
    address?: {
      city: string;
    };
  };
};

export function getCity(order: Order): string | undefined {
  return order.id > 0 ? '杭州' : undefined;
}
```
:::
