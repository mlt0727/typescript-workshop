---
kind: task
title: 给商品和购物车项定义类型
---
`shop.ts` 中的两个函数用到了 `Product` 和 `CartItem` 两个类型，但它们还没有定义，TypeScript 报错找不到名字。定义并**导出**这两个类型：

- `Product`：`id`（字符串）、`name`（字符串）、`price`（数字，单位为分）；
- `CartItem`：`product`（一个 `Product`）、`quantity`（数字）。

用 `type` 还是 `interface` 都可以。

:::files{role=starter}
```ts file=shop.ts
export function lineTotal(item: CartItem): number {
  return item.product.price * item.quantity;
}

export function cartTotal(items: CartItem[]): number {
  let total = 0;
  for (const item of items) {
    total += lineTotal(item);
  }
  return total;
}
```
:::

:::files{role=solution}
```ts file=shop.ts
export interface Product {
  id: string;
  name: string;
  price: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export function lineTotal(item: CartItem): number {
  return item.product.price * item.quantity;
}

export function cartTotal(items: CartItem[]): number {
  let total = 0;
  for (const item of items) {
    total += lineTotal(item);
  }
  return total;
}
```
:::

:::files{role=tests}
```ts file=shop.test.ts
import { expect, test } from 'vitest';
import { cartTotal, lineTotal } from './shop';

const pen = { id: 'p1', name: '钢笔', price: 1500 };
const ink = { id: 'p2', name: '墨水', price: 800 };

test('单项小计', () => {
  expect(lineTotal({ product: pen, quantity: 2 })).toBe(3000);
});

test('购物车总价', () => {
  expect(
    cartTotal([
      { product: pen, quantity: 1 },
      { product: ink, quantity: 3 },
    ]),
  ).toBe(3900);
  expect(cartTotal([])).toBe(0);
});
```
```ts file=shop.test-d.ts
import { expectTypeOf } from 'vitest';
import type { CartItem, Product } from './shop';

expectTypeOf<Product>().toEqualTypeOf<{ id: string; name: string; price: number }>();
expectTypeOf<CartItem>().toEqualTypeOf<{ product: Product; quantity: number }>();
```
:::

:::hint{level=1}
在文件开头写 `export interface Product { … }` 和 `export interface CartItem { … }`（或者用 `export type Product = { … };`）。`CartItem` 的 `product` 属性的类型直接写 `Product`。
:::

:::hint{level=2}
```ts
export interface Product {
  id: string;
  name: string;
  price: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
```
:::

:::explanation
类型也可以导出，其他文件用 `import type` 导入（a19）。`CartItem` 的 `product` 属性直接使用了 `Product`：类型可以互相引用，组合出更复杂的形状。

用 `type` 写也完全正确：`export type Product = { id: string; name: string; price: number };`。对象形状用哪种写法，按团队习惯即可。
:::

:::variant{kind=alt name=type-aliases}
```ts file=shop.ts
export type Product = { id: string; name: string; price: number };
export type CartItem = { product: Product; quantity: number };

export function lineTotal(item: CartItem): number {
  return item.product.price * item.quantity;
}

export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + lineTotal(item), 0);
}
```
:::

:::variant{kind=wrong name=not-exported fails=types reason="定义了类型但没有导出，其他文件无法使用"}
```ts file=shop.ts
interface Product {
  id: string;
  name: string;
  price: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export function lineTotal(item: CartItem): number {
  return item.product.price * item.quantity;
}

export function cartTotal(items: CartItem[]): number {
  let total = 0;
  for (const item of items) {
    total += lineTotal(item);
  }
  return total;
}
```
:::

:::variant{kind=wrong name=price-string fails=types reason="price 的类型写成了 string"}
```ts file=shop.ts
export interface Product {
  id: string;
  name: string;
  price: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export function lineTotal(item: CartItem): number {
  return Number(item.product.price) * item.quantity;
}

export function cartTotal(items: CartItem[]): number {
  let total = 0;
  for (const item of items) {
    total += lineTotal(item);
  }
  return total;
}
```
:::
