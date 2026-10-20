---
kind: task
title: 去掉 any
---
`cart.ts` 中的两个函数都用了 `any`。去掉所有的 `any`（也不能用类型断言），改成 `unknown` 加检查：`JSON.parse` 的结果要放进一个**明确写着 `unknown` 类型**的变量。（`let data; data = JSON.parse(json);` 这样不写类型的变量也是 `any`，判题的规则检查发现不了它，测试也可能通过，但这正是本课要避免的写法。）按下面的规则处理不合法的输入：

1. **`sumPrices(json)`**：`json` 是购物车的 JSON 字符串，格式是 `{ "items": [{ "price": 单价, "quantity": 数量 }, …] }`。返回 `单价 × 数量` 的总和。下面这些情况返回 `null`：JSON 不合法；不是对象或者没有 `items` 数组；某一项不是对象；`price` 不是有限的非负数；`quantity` 不是正整数。空的 `items` 返回 `0`；
2. **`errorMessage(error)`**：从 `catch` 到的任何值中取出错误信息：`Error` 的实例返回它的 `message`；字符串原样返回；带有字符串类型 `message` 属性的对象返回这个属性；其他情况返回 `'未知错误'`。

:::files{role=starter}
```ts file=cart.ts
export function sumPrices(json: string): number | null {
  const data: any = JSON.parse(json);
  return data.items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
}

export function errorMessage(error: any): string {
  return error.message;
}
```
```ts file=main.ts
import { errorMessage, sumPrices } from './cart';

console.log(sumPrices('{"items":[{"price":12.5,"quantity":2},{"price":3,"quantity":1}]}'));
console.log(sumPrices('{"items":[{"price":"12.5","quantity":2}]}'));
try {
  JSON.parse('{');
} catch (error) {
  console.log(errorMessage(error));
}
```
:::

:::files{role=solution}
```ts file=cart.ts
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function sumPrices(json: string): number | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isRecord(data) || !Array.isArray(data['items'])) return null;
  const items: readonly unknown[] = data['items'];
  let total = 0;
  for (const item of items) {
    if (!isRecord(item)) return null;
    const { price, quantity } = item;
    if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) return null;
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) return null;
    total += price * quantity;
  }
  return total;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (isRecord(error) && typeof error['message'] === 'string') return error['message'];
  return '未知错误';
}
```
```ts file=main.ts
import { errorMessage, sumPrices } from './cart';

console.log(sumPrices('{"items":[{"price":12.5,"quantity":2},{"price":3,"quantity":1}]}'));
console.log(sumPrices('{"items":[{"price":"12.5","quantity":2}]}'));
try {
  JSON.parse('{');
} catch (error) {
  console.log(errorMessage(error));
}
```
:::

:::files{role=tests}
```ts file=cart.test.ts
import { describe, expect, test } from 'vitest';
import { errorMessage, sumPrices } from './cart';

describe('sumPrices', () => {
  test('单价乘以数量的总和', () => {
    expect(sumPrices('{"items":[{"price":12.5,"quantity":2},{"price":3,"quantity":1}]}')).toBe(28);
    expect(sumPrices('{"items":[]}')).toBe(0);
    expect(sumPrices('{"items":[{"price":0,"quantity":3}]}')).toBe(0);
  });

  test('不合法的输入返回 null', () => {
    const bad = [
      '不是 JSON',
      'null',
      '[]',
      '{}',
      '{"items":{}}',
      '{"items":[1]}',
      '{"items":[null]}',
      '{"items":[{"price":"12.5","quantity":2}]}',
      '{"items":[{"price":-1,"quantity":2}]}',
      '{"items":[{"price":1,"quantity":0}]}',
      '{"items":[{"price":1,"quantity":1.5}]}',
      '{"items":[{"price":1}]}',
      '{"items":[{"price":1e999,"quantity":1}]}',
    ];
    for (const json of bad) expect(sumPrices(json), json).toBeNull();
  });
});

describe('errorMessage', () => {
  test('取出错误信息', () => {
    expect(errorMessage(new Error('网络错误'))).toBe('网络错误');
    expect(errorMessage(new TypeError('类型错误'))).toBe('类型错误');
    expect(errorMessage('出错了')).toBe('出错了');
    expect(errorMessage({ message: '对象中的信息' })).toBe('对象中的信息');
  });

  test('其他情况返回未知错误', () => {
    for (const value of [null, undefined, 42, { message: 1 }, [], {}]) {
      expect(errorMessage(value), String(value)).toBe('未知错误');
    }
  });
});
```
```ts file=cart.test-d.ts
import { expectTypeOf } from 'vitest';
import { errorMessage, sumPrices } from './cart';

expectTypeOf(sumPrices).toEqualTypeOf<(json: string) => number | null>();
expectTypeOf(errorMessage).parameter(0).toEqualTypeOf<unknown>();
expectTypeOf(errorMessage).returns.toEqualTypeOf<string>();
```
:::

:::hint{level=1}
`JSON.parse` 的结果先赋给 `let data: unknown`，用 `try/catch` 处理不合法的 JSON。写一个类型守卫 `isRecord(value): value is Record<string, unknown>`，排除 `null` 和数组；`Array.isArray(data['items'])` 之后，把它赋给 `readonly unknown[]`，每一项都是 `unknown`，逐项检查。
:::

:::hint{level=2}
每一项：`isRecord(item)`，再取出 `price`、`quantity`，用 `typeof` 和 `Number.isFinite`、`Number.isInteger` 检查。`errorMessage` 依次判断：`error instanceof Error`、`typeof error === 'string'`、`isRecord(error) && typeof error['message'] === 'string'`。
:::

:::explanation
起始代码中的 `any` 有两个来源：一个是写出来的 `data: any`、`item: any`、`error: any`，另一个是即使不写也会出现的：`JSON.parse` 本身就返回 `any`。改写的关键是在 `any` 进入的地方立刻把它变成 `unknown`：`let data: unknown`。之后每用一步都要先检查，TypeScript 会拦下所有没检查就使用的地方。

`Array.isArray(data['items'])` 收窄出来的是 `any[]`，又一个悄悄进来的 `any`。把它赋给 `readonly unknown[]`，元素才回到 `unknown`（p1-05 也这样做过）。

`errorMessage` 的参数是 `unknown`，因为 `catch` 到的东西本来就可能是任何值：`throw '出错了'`、`throw { message: … }` 都是合法的 JavaScript。`instanceof Error` 涵盖了 `Error` 和它的子类（`TypeError`、`RangeError`……）。

`1e999` 在 JSON 中是合法的数字，解析出来是 `Infinity`，所以要用 `Number.isFinite` 检查，`typeof` 判断不出来。
:::

:::variant{kind=alt name=parse-helpers}
```ts file=cart.ts
type Item = { price: number; quantity: number };

function hasKey<K extends string>(value: unknown, key: K): value is Record<K, unknown> {
  return typeof value === 'object' && value !== null && key in value;
}

function toItem(value: unknown): Item | null {
  if (!hasKey(value, 'price') || !hasKey(value, 'quantity')) return null;
  const { price, quantity } = value;
  if (typeof price !== 'number' || !(price >= 0) || price === Infinity) return null;
  if (typeof quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity <= 0) return null;
  return { price, quantity };
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

export function sumPrices(json: string): number | null {
  const data = safeParse(json);
  if (!hasKey(data, 'items') || Array.isArray(data) || !Array.isArray(data.items)) return null;
  const list: readonly unknown[] = data.items;
  const items = list.map(toItem);
  let total = 0;
  for (const item of items) {
    if (item === null) return null;
    total += item.price * item.quantity;
  }
  return total;
}

export function errorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (hasKey(error, 'message') && !Array.isArray(error) && typeof error.message === 'string') return error.message;
  return '未知错误';
}
```
:::

:::variant{kind=wrong name=keeps-any fails=rules reason="仍然用 any 描述解析出来的数据"}
```ts file=cart.ts
export function sumPrices(json: string): number | null {
  let data: any;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null || !Array.isArray(data.items)) return null;
  let total = 0;
  for (const item of data.items) {
    if (typeof item !== 'object' || item === null) return null;
    if (typeof item.price !== 'number' || !Number.isFinite(item.price) || item.price < 0) return null;
    if (!Number.isInteger(item.quantity) || item.quantity < 1) return null;
    total += item.price * item.quantity;
  }
  return total;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '未知错误';
}
```
:::

:::variant{kind=wrong name=trusts-shape fails=tests reason="只检查了 items 是数组，没有逐项检查 price 和 quantity"}
```ts file=cart.ts
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function sumPrices(json: string): number | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isRecord(data) || !Array.isArray(data['items'])) return null;
  const items: readonly unknown[] = data['items'];
  let total = 0;
  for (const item of items) {
    if (!isRecord(item)) return null;
    total += Number(item['price']) * Number(item['quantity']);
  }
  return total;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (isRecord(error) && typeof error['message'] === 'string') return error['message'];
  return '未知错误';
}
```
:::

:::variant{kind=wrong name=assume-error fails=rules reason="把 catch 到的值断言成 Error"}
```ts file=cart.ts
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function sumPrices(json: string): number | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isRecord(data) || !Array.isArray(data['items'])) return null;
  const items: readonly unknown[] = data['items'];
  let total = 0;
  for (const item of items) {
    if (!isRecord(item)) return null;
    const { price, quantity } = item;
    if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) return null;
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) return null;
    total += price * quantity;
  }
  return total;
}

export function errorMessage(error: unknown): string {
  return (error as Error).message ?? '未知错误';
}
```
:::

:::variant{kind=wrong name=no-finite-check fails=tests reason="没有检查 price 是不是有限的数字，Infinity 也被接受了"}
```ts file=cart.ts
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function sumPrices(json: string): number | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isRecord(data) || !Array.isArray(data['items'])) return null;
  const items: readonly unknown[] = data['items'];
  let total = 0;
  for (const item of items) {
    if (!isRecord(item)) return null;
    const { price, quantity } = item;
    if (typeof price !== 'number' || price < 0) return null;
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) return null;
    total += price * quantity;
  }
  return total;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (isRecord(error) && typeof error['message'] === 'string') return error['message'];
  return '未知错误';
}
```
:::
