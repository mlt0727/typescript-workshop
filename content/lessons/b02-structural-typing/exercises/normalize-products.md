---
kind: challenge
title: 整理接口返回的商品数据
---
商品接口返回的数据字段名是下划线风格，还带着前端不应该看到的成本价：

```ts
interface RawProduct {
  product_id: string;
  display_name: string;
  price_cents: number;
  internal_cost: number;
  tags?: string[];
}
```

前端使用的类型是：

```ts
interface Product {
  id: string;
  name: string;
  price: number;
  tags: string[];
}
```

实现 `normalizeProducts(raw)`，把 `RawProduct[]` 转换成 `Product[]`：

- `product_id` → `id`，`display_name` → `name`，`price_cents` → `price`；
- `tags` 缺失时为空数组；存在时要**复制**一份（结果不能和原数据共享数组）；
- 结果对象**只能**有 `id`、`name`、`price`、`tags` 四个属性（`internal_cost` 等其他字段都不能出现）；
- `price_cents` 不是大于或等于 0 的整数的商品，视为数据错误，跳过；
- 同一个 `product_id` 出现多次时，只保留第一次出现的那个（跳过的错误数据不算“出现过”）；
- 不能修改传入的数据，结果保持原来的顺序。

:::files{role=starter}
```ts file=products.ts
export interface RawProduct {
  product_id: string;
  display_name: string;
  price_cents: number;
  internal_cost: number;
  tags?: string[];
}

export interface Product {
  id: string;
  name: string;
  price: number;
  tags: string[];
}

export function normalizeProducts(raw: readonly RawProduct[]): Product[] {
  return [];
}
```
:::

:::files{role=solution}
```ts file=products.ts
export interface RawProduct {
  product_id: string;
  display_name: string;
  price_cents: number;
  internal_cost: number;
  tags?: string[];
}

export interface Product {
  id: string;
  name: string;
  price: number;
  tags: string[];
}

export function normalizeProducts(raw: readonly RawProduct[]): Product[] {
  const seen = new Set<string>();
  const result: Product[] = [];
  for (const item of raw) {
    if (!Number.isInteger(item.price_cents) || item.price_cents < 0) {
      continue;
    }
    if (seen.has(item.product_id)) {
      continue;
    }
    seen.add(item.product_id);
    result.push({
      id: item.product_id,
      name: item.display_name,
      price: item.price_cents,
      tags: [...(item.tags ?? [])],
    });
  }
  return result;
}
```
:::

:::files{role=tests}
```ts file=products.test.ts
import { describe, expect, test } from 'vitest';
import { normalizeProducts, type RawProduct } from './products';

const pen: RawProduct = { product_id: 'p1', display_name: '钢笔', price_cents: 1500, internal_cost: 600, tags: ['文具'] };
const ink: RawProduct = { product_id: 'p2', display_name: '墨水', price_cents: 800, internal_cost: 200 };

describe('normalizeProducts', () => {
  test('字段改名，tags 缺失时为空数组', () => {
    expect(normalizeProducts([pen, ink])).toEqual([
      { id: 'p1', name: '钢笔', price: 1500, tags: ['文具'] },
      { id: 'p2', name: '墨水', price: 800, tags: [] },
    ]);
  });

  test('结果只有四个属性', () => {
    const extra = { ...pen, supplier: '某工厂' };
    for (const product of normalizeProducts([extra, ink])) {
      expect(Object.keys(product).toSorted()).toEqual(['id', 'name', 'price', 'tags']);
    }
  });

  test('复制 tags 数组', () => {
    const [product] = normalizeProducts([pen]);
    expect(product?.tags).not.toBe(pen.tags);
    product?.tags.push('新标签');
    expect(pen.tags).toEqual(['文具']);
  });

  test('跳过价格无效的商品', () => {
    const bad1: RawProduct = { ...ink, product_id: 'x1', price_cents: -1 };
    const bad2: RawProduct = { ...ink, product_id: 'x2', price_cents: 9.5 };
    const free: RawProduct = { ...ink, product_id: 'x3', price_cents: 0 };
    expect(normalizeProducts([bad1, bad2, free]).map((p) => p.id)).toEqual(['x3']);
  });

  test('重复的 id 只保留第一个', () => {
    const again: RawProduct = { ...pen, display_name: '钢笔（重复）' };
    expect(normalizeProducts([pen, ink, again]).map((p) => p.name)).toEqual(['钢笔', '墨水']);
  });

  test('被跳过的错误数据不占用 id', () => {
    const broken: RawProduct = { ...pen, price_cents: -5 };
    expect(normalizeProducts([broken, pen]).map((p) => p.price)).toEqual([1500]);
  });

  test('不修改传入的数据', () => {
    const input = [pen, ink];
    normalizeProducts(input);
    expect(input).toEqual([pen, ink]);
    expect(pen).toEqual({ product_id: 'p1', display_name: '钢笔', price_cents: 1500, internal_cost: 600, tags: ['文具'] });
  });
});
```
:::

:::hint{level=1}
不要从原对象复制（展开会带上所有字段），而是对每个商品**新建**一个只有四个属性的对象。用一个 `Set` 记录已经收下的 id（a18）。
:::

:::hint{level=2}
遍历时先检查价格（`Number.isInteger(item.price_cents) && item.price_cents >= 0`），不合格就 `continue`；再检查 id 是否已经在 `Set` 里。都通过后 `result.push({ id: item.product_id, name: item.display_name, price: item.price_cents, tags: [...(item.tags ?? [])] })`，并把 id 加入 `Set`。
:::

:::explanation
测试里的 `extra` 比 `RawProduct` 多了一个 `supplier` 字段，它仍然可以作为 `RawProduct` 传入（结构化类型）。所以“结果只有四个属性”只能靠**明确地新建对象**来保证：`{ id: …, name: …, price: …, tags: … }`。任何形式的 `{ ...item, … }` 都会把 `internal_cost` 和 `supplier` 一起带出去，而 TypeScript 不会报错：多余属性检查只检查对象字面量里**显式写出**的属性，通过 `...item` 展开进来的属性不在检查范围内；展开后的对象又拥有 `Product` 要求的全部属性。

`[...(item.tags ?? [])]`：`tags` 缺失时得到 `[]`，存在时复制一份新数组。

先检查价格、再检查重复，保证了“错误数据不占用 id”：只有真正收下的商品才会被记入 `Set`。
:::

:::variant{kind=alt name=filter-map}
```ts file=products.ts
export interface RawProduct {
  product_id: string;
  display_name: string;
  price_cents: number;
  internal_cost: number;
  tags?: string[];
}

export interface Product {
  id: string;
  name: string;
  price: number;
  tags: string[];
}

function toProduct({ product_id, display_name, price_cents, tags }: RawProduct): Product {
  return { id: product_id, name: display_name, price: price_cents, tags: tags === undefined ? [] : tags.slice() };
}

export function normalizeProducts(raw: readonly RawProduct[]): Product[] {
  const valid = raw.filter((r) => Number.isInteger(r.price_cents) && r.price_cents >= 0);
  const firstIndex = new Map<string, number>();
  valid.forEach((r, i) => {
    if (!firstIndex.has(r.product_id)) firstIndex.set(r.product_id, i);
  });
  return valid.filter((r, i) => firstIndex.get(r.product_id) === i).map(toProduct);
}
```
:::

:::variant{kind=wrong name=spread-raw fails=tests reason="用展开构造结果，internal_cost 等字段被带了出去"}
```ts file=products.ts
export interface RawProduct {
  product_id: string;
  display_name: string;
  price_cents: number;
  internal_cost: number;
  tags?: string[];
}

export interface Product {
  id: string;
  name: string;
  price: number;
  tags: string[];
}

export function normalizeProducts(raw: readonly RawProduct[]): Product[] {
  const seen = new Set<string>();
  const result: Product[] = [];
  for (const item of raw) {
    if (!Number.isInteger(item.price_cents) || item.price_cents < 0 || seen.has(item.product_id)) continue;
    seen.add(item.product_id);
    result.push({ ...item, id: item.product_id, name: item.display_name, price: item.price_cents, tags: [...(item.tags ?? [])] });
  }
  return result;
}
```
:::

:::variant{kind=wrong name=shared-tags fails=tests reason="直接使用原来的 tags 数组，没有复制"}
```ts file=products.ts
export interface RawProduct {
  product_id: string;
  display_name: string;
  price_cents: number;
  internal_cost: number;
  tags?: string[];
}

export interface Product {
  id: string;
  name: string;
  price: number;
  tags: string[];
}

export function normalizeProducts(raw: readonly RawProduct[]): Product[] {
  const seen = new Set<string>();
  const result: Product[] = [];
  for (const item of raw) {
    if (!Number.isInteger(item.price_cents) || item.price_cents < 0 || seen.has(item.product_id)) continue;
    seen.add(item.product_id);
    result.push({ id: item.product_id, name: item.display_name, price: item.price_cents, tags: item.tags ?? [] });
  }
  return result;
}
```
:::

:::variant{kind=wrong name=dedupe-before-validate fails=tests reason="先记录 id 再检查价格，错误数据占用了 id"}
```ts file=products.ts
export interface RawProduct {
  product_id: string;
  display_name: string;
  price_cents: number;
  internal_cost: number;
  tags?: string[];
}

export interface Product {
  id: string;
  name: string;
  price: number;
  tags: string[];
}

export function normalizeProducts(raw: readonly RawProduct[]): Product[] {
  const seen = new Set<string>();
  const result: Product[] = [];
  for (const item of raw) {
    if (seen.has(item.product_id)) continue;
    seen.add(item.product_id);
    if (!Number.isInteger(item.price_cents) || item.price_cents < 0) continue;
    result.push({ id: item.product_id, name: item.display_name, price: item.price_cents, tags: [...(item.tags ?? [])] });
  }
  return result;
}
```
:::
