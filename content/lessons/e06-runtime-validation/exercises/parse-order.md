---
kind: challenge
title: 带错误路径的订单解析
---
实现 `parseOrder(json)`：输入是一段 JSON **文本**，输出订单或者**所有**问题的列表。每条错误信息都以出错的位置开头：

1. `JSON.parse` 失败：只返回一条错误 `不是合法的 JSON`；
2. 顶层不是普通对象：只返回一条错误 `订单应该是对象`；
3. 否则依次检查下面各项，**收集所有**错误（不要遇到第一个就停）：

| 位置 | 规则 | 错误信息 |
| --- | --- | --- |
| `id` | 非空字符串 | `id 应该是非空字符串` |
| `items` | 数组 | `items 应该是数组` |
| `items` | 不能为空 | `items 不能为空` |
| `items[i]` | 普通对象 | `items[i] 应该是对象` |
| `items[i].sku` | 非空字符串 | `items[i].sku 应该是非空字符串` |
| `items[i].qty` | 正整数 | `items[i].qty 应该是正整数` |
| `items[i].price` | 有限的数字，不小于 0 | `items[i].price 应该是不小于 0 的数字` |
| `note` | 可以不存在；存在时是字符串 | `note 应该是字符串` |

其中 `i` 是下标，例如 `items[1].qty 应该是正整数`。某一项不是对象时，不再检查它的字段。错误的顺序：`id`、`items`（各项按下标顺序，每项按 `sku`、`qty`、`price`）、`note`。

成功时返回只包含已知字段的新对象；`note` 不存在时，结果中也不要有这个键。

:::files{role=starter}
```ts file=order.ts
export type OrderItem = { sku: string; qty: number; price: number };
export type Order = { id: string; items: OrderItem[]; note?: string };
export type ParseResult = { ok: true; value: Order } | { ok: false; errors: string[] };

export function parseOrder(json: string): ParseResult {
  const data: unknown = JSON.parse(json);
  return { ok: false, errors: ['尚未实现'] };
}
```
:::

:::files{role=solution}
```ts file=order.ts
export type OrderItem = { sku: string; qty: number; price: number };
export type Order = { id: string; items: OrderItem[]; note?: string };
export type ParseResult = { ok: true; value: Order } | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseItem(value: unknown, path: string, errors: string[]): OrderItem | undefined {
  if (!isRecord(value)) {
    errors.push(`${path} 应该是对象`);
    return undefined;
  }
  const { sku, qty, price } = value;
  const before = errors.length;
  if (typeof sku !== 'string' || sku === '') errors.push(`${path}.sku 应该是非空字符串`);
  if (typeof qty !== 'number' || !Number.isInteger(qty) || qty <= 0) errors.push(`${path}.qty 应该是正整数`);
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) errors.push(`${path}.price 应该是不小于 0 的数字`);
  if (errors.length > before || typeof sku !== 'string' || typeof qty !== 'number' || typeof price !== 'number') {
    return undefined;
  }
  return { sku, qty, price };
}

export function parseOrder(json: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, errors: ['不是合法的 JSON'] };
  }
  if (!isRecord(data)) return { ok: false, errors: ['订单应该是对象'] };

  const errors: string[] = [];
  const { id, items, note } = data;

  if (typeof id !== 'string' || id === '') errors.push('id 应该是非空字符串');

  const parsedItems: OrderItem[] = [];
  if (!Array.isArray(items)) {
    errors.push('items 应该是数组');
  } else if (items.length === 0) {
    errors.push('items 不能为空');
  } else {
    items.forEach((item: unknown, index) => {
      const parsed = parseItem(item, `items[${index}]`, errors);
      if (parsed) parsedItems.push(parsed);
    });
  }

  if (note !== undefined && typeof note !== 'string') errors.push('note 应该是字符串');

  if (errors.length > 0 || typeof id !== 'string') return { ok: false, errors };
  const order: Order = { id, items: parsedItems };
  if (typeof note === 'string') order.note = note;
  return { ok: true, value: order };
}
```
:::

:::files{role=tests}
```ts file=order.test.ts
import { describe, expect, test } from 'vitest';
import { parseOrder } from './order';

const valid = {
  id: 'o-1',
  items: [
    { sku: 'pen', qty: 2, price: 3.5, color: 'red' },
    { sku: 'book', qty: 1, price: 0 },
  ],
  note: '周末送达',
  internal: 'ignore me',
};

function errors(value: unknown): string[] {
  const result = parseOrder(JSON.stringify(value));
  return result.ok ? [] : result.errors;
}

describe('parseOrder', () => {
  test('合法的订单：只保留已知字段', () => {
    expect(parseOrder(JSON.stringify(valid))).toEqual({
      ok: true,
      value: {
        id: 'o-1',
        items: [
          { sku: 'pen', qty: 2, price: 3.5 },
          { sku: 'book', qty: 1, price: 0 },
        ],
        note: '周末送达',
      },
    });
    const result = parseOrder(JSON.stringify({ id: 'o-2', items: [{ sku: 'a', qty: 1, price: 1 }] }));
    expect(result.ok && 'note' in result.value).toBe(false);
  });

  test('不是合法的 JSON', () => {
    expect(parseOrder('{ id: 1 ')).toEqual({ ok: false, errors: ['不是合法的 JSON'] });
  });

  test('顶层不是对象', () => {
    expect(errors([valid])).toEqual(['订单应该是对象']);
    expect(errors(null)).toEqual(['订单应该是对象']);
  });

  test('收集所有错误，带有路径', () => {
    expect(
      errors({
        id: '',
        items: [{ sku: 'pen', qty: 0, price: 1 }, 'book', { sku: '', qty: 1.5, price: -2 }],
        note: 5,
      }),
    ).toEqual([
      'id 应该是非空字符串',
      'items[0].qty 应该是正整数',
      'items[1] 应该是对象',
      'items[2].sku 应该是非空字符串',
      'items[2].qty 应该是正整数',
      'items[2].price 应该是不小于 0 的数字',
      'note 应该是字符串',
    ]);
  });

  test('items 不是数组或为空', () => {
    expect(errors({ id: 'o', items: {} })).toEqual(['items 应该是数组']);
    expect(errors({ id: 'o', items: [] })).toEqual(['items 不能为空']);
    expect(errors({ id: 'o' })).toEqual(['items 应该是数组']);
  });

  test('note 为 null 也不合法', () => {
    expect(errors({ id: 'o', items: [{ sku: 'a', qty: 1, price: 1 }], note: null })).toEqual(['note 应该是字符串']);
  });
});
```
:::

:::hint{level=1}
先用 `try/catch` 包住 `JSON.parse`。然后准备一个 `const errors: string[] = []`，每发现一个问题就 `push` 一条，最后看它是否为空。检查数组的每一项时，把路径 `items[${index}]` 传给一个专门解析单项的函数，让它把自己的错误也加进同一个数组。
:::

:::hint{level=2}
单项的解析函数可以写成 `parseItem(value: unknown, path: string, errors: string[]): OrderItem | undefined`：不是对象就记一条 `${path} 应该是对象` 并返回 `undefined`；否则分别检查三个字段，有问题就记录，全部合格才返回新对象。正整数：`Number.isInteger(qty) && qty > 0`。
:::

:::explanation
和小任务相比，这里多了两件事：

- **收集所有错误**：不在第一个问题处返回，而是把错误放进数组，检查完全部字段再决定结果。这适合给开发者看的诊断信息，或者一次性提示用户所有需要修改的地方；
- **错误路径**：嵌套数据中，只说“qty 应该是正整数”是不够的，要说清楚是哪一项。把当前路径作为参数传给检查下一层的函数，错误信息就能精确地指向 `items[2].qty`。校验库（例如 Zod）报告的每个问题也都带有这样的路径。

`JSON.parse` 失败会抛出 `SyntaxError`，这是数据进入程序时的第一道关口，要单独捕获并转换成解析结果，而不是让异常飞出去。

`parseItem` 在字段都合格之后才构造 `OrderItem`：最后那个 `typeof` 判断看起来和前面的检查重复，但它让 TypeScript 在 `return` 处确实知道三个变量的类型。也可以像小任务那样，每个字段检查失败就提前返回，代价是同一项只能报告一个错误。
:::

:::variant{kind=alt name=path-functions}
```ts file=order.ts
export type OrderItem = { sku: string; qty: number; price: number };
export type Order = { id: string; items: OrderItem[]; note?: string };
export type ParseResult = { ok: true; value: Order } | { ok: false; errors: string[] };

type Check<T> = { value: T } | { problems: string[] };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function item(v: unknown, path: string): Check<OrderItem> {
  if (!isObject(v)) return { problems: [`${path} 应该是对象`] };
  const problems: string[] = [];
  const sku = typeof v.sku === 'string' && v.sku !== '' ? v.sku : undefined;
  const qty = typeof v.qty === 'number' && Number.isInteger(v.qty) && v.qty > 0 ? v.qty : undefined;
  const price = typeof v.price === 'number' && Number.isFinite(v.price) && v.price >= 0 ? v.price : undefined;
  if (sku === undefined) problems.push(`${path}.sku 应该是非空字符串`);
  if (qty === undefined) problems.push(`${path}.qty 应该是正整数`);
  if (price === undefined) problems.push(`${path}.price 应该是不小于 0 的数字`);
  if (sku === undefined || qty === undefined || price === undefined) return { problems };
  return { value: { sku, qty, price } };
}

export function parseOrder(json: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, errors: ['不是合法的 JSON'] };
  }
  if (!isObject(data)) return { ok: false, errors: ['订单应该是对象'] };
  const errors: string[] = [];
  const id = typeof data.id === 'string' && data.id !== '' ? data.id : undefined;
  if (id === undefined) errors.push('id 应该是非空字符串');
  const items: OrderItem[] = [];
  if (!Array.isArray(data.items)) errors.push('items 应该是数组');
  else if (data.items.length === 0) errors.push('items 不能为空');
  else {
    data.items.forEach((raw: unknown, i) => {
      const checked = item(raw, `items[${i}]`);
      if ('value' in checked) items.push(checked.value);
      else errors.push(...checked.problems);
    });
  }
  if ('note' in data && typeof data.note !== 'string') errors.push('note 应该是字符串');
  if (id === undefined || errors.length > 0) return { ok: false, errors };
  return { ok: true, value: typeof data.note === 'string' ? { id, items, note: data.note } : { id, items } };
}
```
:::

:::variant{kind=wrong name=first-error-only fails=tests reason="遇到第一个错误就返回，没有收集所有错误"}
```ts file=order.ts
export type OrderItem = { sku: string; qty: number; price: number };
export type Order = { id: string; items: OrderItem[]; note?: string };
export type ParseResult = { ok: true; value: Order } | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseOrder(json: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, errors: ['不是合法的 JSON'] };
  }
  if (!isRecord(data)) return { ok: false, errors: ['订单应该是对象'] };
  const { id, items, note } = data;
  if (typeof id !== 'string' || id === '') return { ok: false, errors: ['id 应该是非空字符串'] };
  if (!Array.isArray(items)) return { ok: false, errors: ['items 应该是数组'] };
  if (items.length === 0) return { ok: false, errors: ['items 不能为空'] };
  const parsed: OrderItem[] = [];
  for (const [i, item] of items.entries()) {
    const value: unknown = item;
    if (!isRecord(value)) return { ok: false, errors: [`items[${i}] 应该是对象`] };
    const { sku, qty, price } = value;
    if (typeof sku !== 'string' || sku === '') return { ok: false, errors: [`items[${i}].sku 应该是非空字符串`] };
    if (typeof qty !== 'number' || !Number.isInteger(qty) || qty <= 0) return { ok: false, errors: [`items[${i}].qty 应该是正整数`] };
    if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) return { ok: false, errors: [`items[${i}].price 应该是不小于 0 的数字`] };
    parsed.push({ sku, qty, price });
  }
  if (note !== undefined && typeof note !== 'string') return { ok: false, errors: ['note 应该是字符串'] };
  const order: Order = { id, items: parsed };
  if (typeof note === 'string') order.note = note;
  return { ok: true, value: order };
}
```
:::

:::variant{kind=wrong name=uncaught-json fails=tests reason="没有捕获 JSON.parse 的错误，异常直接抛了出去"}
```ts file=order.ts
export type OrderItem = { sku: string; qty: number; price: number };
export type Order = { id: string; items: OrderItem[]; note?: string };
export type ParseResult = { ok: true; value: Order } | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseOrder(json: string): ParseResult {
  const data: unknown = JSON.parse(json);
  if (!isRecord(data)) return { ok: false, errors: ['订单应该是对象'] };
  const errors: string[] = [];
  const { id, items, note } = data;
  if (typeof id !== 'string' || id === '') errors.push('id 应该是非空字符串');
  const parsed: OrderItem[] = [];
  if (!Array.isArray(items)) errors.push('items 应该是数组');
  else if (items.length === 0) errors.push('items 不能为空');
  else {
    items.forEach((item: unknown, i) => {
      if (!isRecord(item)) {
        errors.push(`items[${i}] 应该是对象`);
        return;
      }
      const { sku, qty, price } = item;
      let ok = true;
      if (typeof sku !== 'string' || sku === '') { errors.push(`items[${i}].sku 应该是非空字符串`); ok = false; }
      if (typeof qty !== 'number' || !Number.isInteger(qty) || qty <= 0) { errors.push(`items[${i}].qty 应该是正整数`); ok = false; }
      if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) { errors.push(`items[${i}].price 应该是不小于 0 的数字`); ok = false; }
      if (ok && typeof sku === 'string' && typeof qty === 'number' && typeof price === 'number') parsed.push({ sku, qty, price });
    });
  }
  if (note !== undefined && typeof note !== 'string') errors.push('note 应该是字符串');
  if (errors.length > 0 || typeof id !== 'string') return { ok: false, errors };
  const order: Order = { id, items: parsed };
  if (typeof note === 'string') order.note = note;
  return { ok: true, value: order };
}
```
:::

:::variant{kind=wrong name=no-paths fails=tests reason="错误信息没有带上下标路径"}
```ts file=order.ts
export type OrderItem = { sku: string; qty: number; price: number };
export type Order = { id: string; items: OrderItem[]; note?: string };
export type ParseResult = { ok: true; value: Order } | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseOrder(json: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, errors: ['不是合法的 JSON'] };
  }
  if (!isRecord(data)) return { ok: false, errors: ['订单应该是对象'] };
  const errors: string[] = [];
  const { id, items, note } = data;
  if (typeof id !== 'string' || id === '') errors.push('id 应该是非空字符串');
  const parsed: OrderItem[] = [];
  if (!Array.isArray(items)) errors.push('items 应该是数组');
  else if (items.length === 0) errors.push('items 不能为空');
  else {
    for (const item of items) {
      const value: unknown = item;
      if (!isRecord(value)) {
        errors.push('items 中的一项应该是对象');
        continue;
      }
      const { sku, qty, price } = value;
      if (typeof sku !== 'string' || sku === '') errors.push('sku 应该是非空字符串');
      if (typeof qty !== 'number' || !Number.isInteger(qty) || qty <= 0) errors.push('qty 应该是正整数');
      if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) errors.push('price 应该是不小于 0 的数字');
      if (typeof sku === 'string' && sku !== '' && typeof qty === 'number' && typeof price === 'number') parsed.push({ sku, qty, price });
    }
  }
  if (note !== undefined && typeof note !== 'string') errors.push('note 应该是字符串');
  if (errors.length > 0 || typeof id !== 'string') return { ok: false, errors };
  const order: Order = { id, items: parsed };
  if (typeof note === 'string') order.note = note;
  return { ok: true, value: order };
}
```
:::

:::variant{kind=wrong name=keep-extra-fields fails=tests reason="把输入中的整个对象放进了结果，多余的字段也被保留"}
```ts file=order.ts
export type OrderItem = { sku: string; qty: number; price: number };
export type Order = { id: string; items: OrderItem[]; note?: string };
export type ParseResult = { ok: true; value: Order } | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isItem(value: unknown): value is OrderItem {
  return (
    isRecord(value) &&
    typeof value.sku === 'string' && value.sku !== '' &&
    typeof value.qty === 'number' && Number.isInteger(value.qty) && value.qty > 0 &&
    typeof value.price === 'number' && Number.isFinite(value.price) && value.price >= 0
  );
}

export function parseOrder(json: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, errors: ['不是合法的 JSON'] };
  }
  if (!isRecord(data)) return { ok: false, errors: ['订单应该是对象'] };
  const errors: string[] = [];
  const { id, items, note } = data;
  if (typeof id !== 'string' || id === '') errors.push('id 应该是非空字符串');
  const parsed: OrderItem[] = [];
  if (!Array.isArray(items)) errors.push('items 应该是数组');
  else if (items.length === 0) errors.push('items 不能为空');
  else {
    items.forEach((item: unknown, i) => {
      if (!isRecord(item)) {
        errors.push(`items[${i}] 应该是对象`);
        return;
      }
      if (typeof item.sku !== 'string' || item.sku === '') errors.push(`items[${i}].sku 应该是非空字符串`);
      if (typeof item.qty !== 'number' || !Number.isInteger(item.qty) || item.qty <= 0) errors.push(`items[${i}].qty 应该是正整数`);
      if (typeof item.price !== 'number' || !Number.isFinite(item.price) || item.price < 0) errors.push(`items[${i}].price 应该是不小于 0 的数字`);
      if (isItem(item)) parsed.push(item);
    });
  }
  if (note !== undefined && typeof note !== 'string') errors.push('note 应该是字符串');
  if (errors.length > 0 || typeof id !== 'string') return { ok: false, errors };
  const order: Order = { id, items: parsed };
  if (typeof note === 'string') order.note = note;
  return { ok: true, value: order };
}
```
:::
