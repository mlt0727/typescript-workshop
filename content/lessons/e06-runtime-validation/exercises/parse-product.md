---
kind: task
title: 解析商品数据
---
实现 `parseProduct(value)`：把来自服务器的 `unknown` 解析成 `Product`。按下面的顺序检查，遇到第一个问题就返回对应的错误：

| 检查 | 错误信息 |
| --- | --- |
| 是普通对象（不是 `null`、不是数组） | `商品应该是对象` |
| `id` 是非空字符串 | `id 应该是非空字符串` |
| `name` 是字符串 | `name 应该是字符串` |
| `price` 是有限的数字，并且不小于 0 | `price 应该是不小于 0 的数字` |
| `tags` 是数组，每一项都是字符串 | `tags 应该是字符串数组` |
| `discount` 可以不存在；存在时是 0 到 1 之间（包含两端）的数字 | `discount 应该是 0 到 1 之间的数字` |

成功时返回一个**新对象**，只包含上面这些字段；`discount` 不存在时，结果中也不要有这个键。

:::files{role=starter}
```ts file=product.ts
export type Product = { id: string; name: string; price: number; tags: string[]; discount?: number };
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseProduct(value: unknown): Result<Product> {
  return { ok: false, error: '尚未实现' };
}
```
:::

:::files{role=solution}
```ts file=product.ts
export type Product = { id: string; name: string; price: number; tags: string[]; discount?: number };
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function parseProduct(value: unknown): Result<Product> {
  if (!isRecord(value)) return { ok: false, error: '商品应该是对象' };
  const { id, name, price, tags, discount } = value;
  if (typeof id !== 'string' || id === '') return { ok: false, error: 'id 应该是非空字符串' };
  if (typeof name !== 'string') return { ok: false, error: 'name 应该是字符串' };
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
    return { ok: false, error: 'price 应该是不小于 0 的数字' };
  }
  if (!isStringArray(tags)) return { ok: false, error: 'tags 应该是字符串数组' };
  if (discount !== undefined && (typeof discount !== 'number' || !(discount >= 0 && discount <= 1))) {
    return { ok: false, error: 'discount 应该是 0 到 1 之间的数字' };
  }

  const product: Product = { id, name, price, tags: [...tags] };
  if (discount !== undefined) product.discount = discount;
  return { ok: true, value: product };
}
```
:::

:::files{role=tests}
```ts file=product.test.ts
import { describe, expect, test } from 'vitest';
import { parseProduct } from './product';

const good = { id: 'p1', name: '笔记本', price: 12.5, tags: ['文具', '纸'] };

function errorOf(value: unknown): string | undefined {
  const result = parseProduct(value);
  return result.ok ? undefined : result.error;
}

describe('parseProduct', () => {
  test('合法的数据', () => {
    expect(parseProduct(good)).toEqual({ ok: true, value: good });
    expect(parseProduct({ ...good, discount: 0 })).toEqual({ ok: true, value: { ...good, discount: 0 } });
  });

  test('结果是只包含已知字段的新对象', () => {
    const input = { ...good, isAdmin: true, __proto_hack: 1 };
    const result = parseProduct(input);
    if (!result.ok) throw new Error(result.error);
    expect(result.value).toEqual(good);
    expect(result.value).not.toBe(input);
    expect('discount' in result.value).toBe(false);
  });

  test('不是对象', () => {
    for (const bad of [null, 'p1', 42, ['p1']]) {
      expect(errorOf(bad)).toBe('商品应该是对象');
    }
  });

  test('id 与 name', () => {
    expect(errorOf({ ...good, id: '' })).toBe('id 应该是非空字符串');
    expect(errorOf({ ...good, id: 1 })).toBe('id 应该是非空字符串');
    expect(errorOf({ ...good, name: undefined })).toBe('name 应该是字符串');
  });

  test('price 必须是不小于 0 的有限数字', () => {
    for (const bad of ['12', -1, Number.NaN, Number.POSITIVE_INFINITY, null]) {
      expect(errorOf({ ...good, price: bad }), `price = ${String(bad)}`).toBe('price 应该是不小于 0 的数字');
    }
    expect(errorOf({ ...good, price: 0 })).toBeUndefined();
  });

  test('tags 必须是字符串数组', () => {
    expect(errorOf({ ...good, tags: '文具' })).toBe('tags 应该是字符串数组');
    expect(errorOf({ ...good, tags: ['文具', 3] })).toBe('tags 应该是字符串数组');
    expect(errorOf({ ...good, tags: [] })).toBeUndefined();
  });

  test('discount 可选，存在时在 0 到 1 之间', () => {
    expect(errorOf({ ...good, discount: 1.5 })).toBe('discount 应该是 0 到 1 之间的数字');
    expect(errorOf({ ...good, discount: '0.5' })).toBe('discount 应该是 0 到 1 之间的数字');
    expect(errorOf({ ...good, discount: Number.NaN })).toBe('discount 应该是 0 到 1 之间的数字');
    expect(errorOf({ ...good, discount: 1 })).toBeUndefined();
  });

  test('按顺序报告第一个问题', () => {
    expect(errorOf({ id: '', name: 1, price: -1 })).toBe('id 应该是非空字符串');
  });
});
```
:::

:::hint{level=1}
先写两个小工具：`isRecord(value): value is Record<string, unknown>`（对象、非 `null`、非数组），`isStringArray(value): value is string[]`（`Array.isArray` 并且 `every` 项都是字符串）。然后从对象中解构出各个字段，它们都是 `unknown`，逐个检查。
:::

:::hint{level=2}
价格用 `typeof price === 'number' && Number.isFinite(price) && price >= 0`：`NaN` 和 `Infinity` 的 `typeof` 也是 `'number'`。可选的 `discount` 用 `discount !== undefined` 判断是否存在，不要用真假检查（`0` 是合法的折扣）。最后创建新对象，只在 `discount` 存在时才设置它。
:::

:::explanation
解析函数把 `unknown` 一步步收窄：`isRecord` 之后可以读取任意属性（类型都是 `unknown`），每个字段的检查又把它收窄成具体的类型，最后组装出一个 `Product`，整个过程不需要任何断言。

几个容易漏掉的地方：

- `typeof NaN === 'number'`，`Infinity` 也是。“是数字”通常还要求 `Number.isFinite`；
- `Array.isArray` 只说明是数组，元素可能是任何东西，要逐项检查；
- 返回新对象而不是输入本身：输入中多余的字段（这里的 `isAdmin`）不会进入程序，调用方之后修改结果也不会影响原始数据；`tags` 同样复制了一份。

`discount` 的检查写成 `!(discount >= 0 && discount <= 1)`，而不是 `discount < 0 || discount > 1`：后者对 `NaN` 返回 `false`，会把 `NaN` 放过去。
:::

:::variant{kind=alt name=check-list}
```ts file=product.ts
export type Product = { id: string; name: string; price: number; tags: string[]; discount?: number };
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const fail = (error: string): Result<Product> => ({ ok: false, error });

export function parseProduct(value: unknown): Result<Product> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return fail('商品应该是对象');
  const id = 'id' in value ? value.id : undefined;
  const name = 'name' in value ? value.name : undefined;
  const price = 'price' in value ? value.price : undefined;
  const tags = 'tags' in value ? value.tags : undefined;
  const discount = 'discount' in value ? value.discount : undefined;
  if (typeof id !== 'string' || id.length === 0) return fail('id 应该是非空字符串');
  if (typeof name !== 'string') return fail('name 应该是字符串');
  if (typeof price !== 'number' || !(price >= 0 && price < Infinity)) return fail('price 应该是不小于 0 的数字');
  if (!Array.isArray(tags)) return fail('tags 应该是字符串数组');
  const tagList: string[] = [];
  for (const tag of tags) {
    if (typeof tag !== 'string') return fail('tags 应该是字符串数组');
    tagList.push(tag);
  }
  if (discount === undefined) return { ok: true, value: { id, name, price, tags: tagList } };
  if (typeof discount !== 'number' || !(discount >= 0 && discount <= 1)) return fail('discount 应该是 0 到 1 之间的数字');
  return { ok: true, value: { id, name, price, tags: tagList, discount } };
}
```
:::

:::variant{kind=wrong name=typeof-number-only fails=tests reason="只检查了 typeof price === 'number'，NaN 和 Infinity 被放了过去"}
```ts file=product.ts
export type Product = { id: string; name: string; price: number; tags: string[]; discount?: number };
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseProduct(value: unknown): Result<Product> {
  if (!isRecord(value)) return { ok: false, error: '商品应该是对象' };
  const { id, name, price, tags, discount } = value;
  if (typeof id !== 'string' || id === '') return { ok: false, error: 'id 应该是非空字符串' };
  if (typeof name !== 'string') return { ok: false, error: 'name 应该是字符串' };
  if (typeof price !== 'number' || price < 0) return { ok: false, error: 'price 应该是不小于 0 的数字' };
  if (!Array.isArray(tags) || !tags.every((t) => typeof t === 'string')) return { ok: false, error: 'tags 应该是字符串数组' };
  if (discount !== undefined && (typeof discount !== 'number' || !(discount >= 0 && discount <= 1))) {
    return { ok: false, error: 'discount 应该是 0 到 1 之间的数字' };
  }
  const product: Product = { id, name, price, tags: tags.filter((t) => typeof t === 'string') };
  if (discount !== undefined) product.discount = discount;
  return { ok: true, value: product };
}
```
:::

:::variant{kind=wrong name=array-without-items fails=tests reason="只检查了 tags 是数组，没有检查每一项"}
```ts file=product.ts
export type Product = { id: string; name: string; price: number; tags: string[]; discount?: number };
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseProduct(value: unknown): Result<Product> {
  if (!isRecord(value)) return { ok: false, error: '商品应该是对象' };
  const { id, name, price, tags, discount } = value;
  if (typeof id !== 'string' || id === '') return { ok: false, error: 'id 应该是非空字符串' };
  if (typeof name !== 'string') return { ok: false, error: 'name 应该是字符串' };
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) return { ok: false, error: 'price 应该是不小于 0 的数字' };
  if (!Array.isArray(tags)) return { ok: false, error: 'tags 应该是字符串数组' };
  if (discount !== undefined && (typeof discount !== 'number' || !(discount >= 0 && discount <= 1))) {
    return { ok: false, error: 'discount 应该是 0 到 1 之间的数字' };
  }
  const product: Product = { id, name, price, tags: tags.map((t) => String(t)) };
  if (discount !== undefined) product.discount = discount;
  return { ok: true, value: product };
}
```
:::

:::variant{kind=wrong name=return-input fails=tests reason="检查通过后直接返回了输入对象，多余的字段也跟着进来了"}
```ts file=product.ts
export type Product = { id: string; name: string; price: number; tags: string[]; discount?: number };
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function isProduct(value: unknown): value is Product {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const v: Record<string, unknown> = { ...value };
  return (
    typeof v.id === 'string' && v.id !== '' && typeof v.name === 'string' &&
    typeof v.price === 'number' && Number.isFinite(v.price) && v.price >= 0 &&
    Array.isArray(v.tags) && v.tags.every((t) => typeof t === 'string') &&
    (v.discount === undefined || (typeof v.discount === 'number' && v.discount >= 0 && v.discount <= 1))
  );
}

export function parseProduct(value: unknown): Result<Product> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { ok: false, error: '商品应该是对象' };
  const v: Record<string, unknown> = { ...value };
  if (typeof v.id !== 'string' || v.id === '') return { ok: false, error: 'id 应该是非空字符串' };
  if (typeof v.name !== 'string') return { ok: false, error: 'name 应该是字符串' };
  if (typeof v.price !== 'number' || !Number.isFinite(v.price) || v.price < 0) return { ok: false, error: 'price 应该是不小于 0 的数字' };
  if (!Array.isArray(v.tags) || !v.tags.every((t) => typeof t === 'string')) return { ok: false, error: 'tags 应该是字符串数组' };
  if (!isProduct(value)) return { ok: false, error: 'discount 应该是 0 到 1 之间的数字' };
  return { ok: true, value };
}
```
:::

:::variant{kind=wrong name=truthy-discount fails=tests reason="用真假检查可选字段，折扣 0 被当成了“没有”"}
```ts file=product.ts
export type Product = { id: string; name: string; price: number; tags: string[]; discount?: number };
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseProduct(value: unknown): Result<Product> {
  if (!isRecord(value)) return { ok: false, error: '商品应该是对象' };
  const { id, name, price, tags, discount } = value;
  if (typeof id !== 'string' || id === '') return { ok: false, error: 'id 应该是非空字符串' };
  if (typeof name !== 'string') return { ok: false, error: 'name 应该是字符串' };
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) return { ok: false, error: 'price 应该是不小于 0 的数字' };
  if (!Array.isArray(tags) || !tags.every((t) => typeof t === 'string')) return { ok: false, error: 'tags 应该是字符串数组' };
  const product: Product = { id, name, price, tags: tags.filter((t) => typeof t === 'string') };
  if (discount) {
    if (typeof discount !== 'number' || discount > 1) return { ok: false, error: 'discount 应该是 0 到 1 之间的数字' };
    product.discount = discount;
  }
  return { ok: true, value: product };
}
```
:::
