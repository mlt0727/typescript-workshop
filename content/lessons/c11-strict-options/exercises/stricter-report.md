---
kind: challenge
title: 让库存报表通过更严格的检查
compiler:
  overrides: { exactOptionalPropertyTypes: true, noPropertyAccessFromIndexSignature: true, noImplicitOverride: true }
  note: 本题在课程的默认配置之上，额外开启了 exactOptionalPropertyTypes、noPropertyAccessFromIndexSignature 和 noImplicitOverride。
---
`stock.ts` 是在宽松的配置下写成的。本题在课程的配置（`strict`、`noUncheckedIndexedAccess`）之上又开启了三个选项，它现在有好几处类型错误，其中有的错误背后正是真实的 bug。修改它，让它通过检查，并且符合下面的规格（不能使用类型断言和非空断言 `!`）：

1. **`restock(stock, sku, amount)`**：返回新的库存，`sku` 的数量加上 `amount`（可以是负数）。库存中还没有这个 `sku` 时从 0 开始。结果小于 0 时抛出 `RangeError`，`message` 是 `库存不足：sku`；
2. **`report(stock, lowThreshold)`**：`total` 是所有数量之和，`skus` 是种类数；`top` 是数量最多的 `sku`（数量相同时取字母顺序在前的那个），**库存为空时没有 `top` 这个属性**；`low` 是数量小于 `lowThreshold` 的 `sku`，按字母顺序排列；
3. **`Formatter`** 的 `format(report)` 返回 `共 N 件，M 种`；**`CsvFormatter`** 继承它，`format` 返回两行：`total,skus,top` 和对应的值（没有 `top` 时为空）；
4. **`describeApples(stock)`**：返回 `苹果：N 件`，`N` 是 `apple` 的数量，没有时是 0。

:::files{role=starter}
```ts file=stock.ts
export type Stock = { [sku: string]: number };
export type Report = { total: number; skus: number; top?: string; low: string[] };

export function restock(stock: Stock, sku: string, amount: number): Stock {
  return { ...stock, [sku]: stock[sku] + amount };
}

export function report(stock: Stock, lowThreshold: number): Report {
  const skus = Object.keys(stock).sort();
  let total = 0;
  let top: string | undefined = undefined;
  for (const sku of skus) {
    total += stock[sku];
    if (top === undefined || stock[sku] > stock[top]) top = sku;
  }
  return { total, skus: skus.length, top, low: skus.filter((sku) => stock[sku] < lowThreshold) };
}

export class Formatter {
  format(report: Report): string {
    return `共 ${report.total} 件，${report.skus} 种`;
  }
}

export class CsvFormatter extends Formatter {
  format(report: Report): string {
    return `total,skus,top\n${report.total},${report.skus},${report.top}`;
  }
}

export function describeApples(stock: Stock): string {
  return `苹果：${stock.apple} 件`;
}
```
```ts file=main.ts
import { CsvFormatter, describeApples, Formatter, report, restock } from './stock';

let stock = restock({}, 'apple', 3);
stock = restock(stock, 'pear', 1);
const r = report(stock, 2);
console.log(r, new Formatter().format(r));
console.log(new CsvFormatter().format(r));
console.log(describeApples(stock), describeApples({}));
```
:::

:::files{role=solution}
```ts file=stock.ts
export type Stock = { [sku: string]: number };
export type Report = { total: number; skus: number; top?: string; low: string[] };

export function restock(stock: Stock, sku: string, amount: number): Stock {
  const next = (stock[sku] ?? 0) + amount;
  if (next < 0) throw new RangeError(`库存不足：${sku}`);
  return { ...stock, [sku]: next };
}

export function report(stock: Stock, lowThreshold: number): Report {
  const entries = Object.entries(stock).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  let total = 0;
  let top: [string, number] | undefined;
  for (const [sku, qty] of entries) {
    total += qty;
    if (top === undefined || qty > top[1]) top = [sku, qty];
  }
  const low = entries.filter(([, qty]) => qty < lowThreshold).map(([sku]) => sku);
  const result: Report = { total, skus: entries.length, low };
  if (top !== undefined) result.top = top[0];
  return result;
}

export class Formatter {
  format(report: Report): string {
    return `共 ${report.total} 件，${report.skus} 种`;
  }
}

export class CsvFormatter extends Formatter {
  override format(report: Report): string {
    return `total,skus,top\n${report.total},${report.skus},${report.top ?? ''}`;
  }
}

export function describeApples(stock: Stock): string {
  return `苹果：${stock['apple'] ?? 0} 件`;
}
```
```ts file=main.ts
import { CsvFormatter, describeApples, Formatter, report, restock } from './stock';

let stock = restock({}, 'apple', 3);
stock = restock(stock, 'pear', 1);
const r = report(stock, 2);
console.log(r, new Formatter().format(r));
console.log(new CsvFormatter().format(r));
console.log(describeApples(stock), describeApples({}));
```
:::

:::files{role=tests}
```ts file=stock.test.ts
import { describe, expect, test } from 'vitest';
import { CsvFormatter, describeApples, Formatter, report, restock } from './stock';

describe('restock', () => {
  test('新的 sku 从 0 开始；已有的累加；返回新对象', () => {
    const empty = {};
    const s1 = restock(empty, 'apple', 3);
    expect(s1).toEqual({ apple: 3 });
    expect(empty).toEqual({});
    expect(restock(s1, 'apple', -1)).toEqual({ apple: 2 });
    expect(restock({ apple: 1 }, 'apple', -1)).toEqual({ apple: 0 });
  });

  test('结果小于 0 时抛出 RangeError', () => {
    expect(() => restock({ apple: 1 }, 'apple', -2)).toThrow(RangeError);
    expect(() => restock({}, 'pear', -1)).toThrow('库存不足：pear');
  });
});

describe('report', () => {
  test('合计、种类、最多的、偏少的', () => {
    expect(report({ pear: 1, apple: 5, kiwi: 0 }, 2)).toEqual({ total: 6, skus: 3, top: 'apple', low: ['kiwi', 'pear'] });
  });

  test('数量相同时取字母顺序在前的', () => {
    expect(report({ pear: 4, apple: 4, fig: 4 }, 0).top).toBe('apple');
  });

  test('正好等于阈值的不算偏少', () => {
    expect(report({ apple: 2, pear: 1, kiwi: 3 }, 2).low).toEqual(['pear']);
  });

  test('库存为空时没有 top 属性', () => {
    const r = report({}, 1);
    expect(r).toEqual({ total: 0, skus: 0, low: [] });
    expect('top' in r).toBe(false);
  });
});

describe('Formatter', () => {
  test('普通格式与 CSV', () => {
    const r = report({ apple: 3, pear: 1 }, 2);
    expect(new Formatter().format(r)).toBe('共 4 件，2 种');
    expect(new CsvFormatter().format(r)).toBe('total,skus,top\n4,2,apple');
    expect(new CsvFormatter().format(report({}, 1))).toBe('total,skus,top\n0,0,');
  });
});

describe('describeApples', () => {
  test('没有苹果时是 0', () => {
    expect(describeApples({ apple: 3 })).toBe('苹果：3 件');
    expect(describeApples({ pear: 1 })).toBe('苹果：0 件');
  });
});
```
```ts file=stock.test-d.ts
import { expectTypeOf } from 'vitest';
import { CsvFormatter, Formatter, report, type Report } from './stock';

expectTypeOf(report({}, 1)).toEqualTypeOf<Report>();
const formatter: Formatter = new CsvFormatter();
expectTypeOf(formatter.format).returns.toEqualTypeOf<string>();
// @ts-expect-error 开启 exactOptionalPropertyTypes 后，top 不能显式地写成 undefined
const explicit: Report = { total: 0, skus: 0, low: [], top: undefined };
console.log(explicit);
```
:::

:::hint{level=1}
先看编辑器报出的每个错误：`stock[sku]` 的类型是 `number | undefined`（新的 `sku` 确实不存在，起始代码会算出 `NaN`）；`top` 显式地写成了 `undefined`；`stock.apple` 要写成 `stock['apple']`；子类覆盖的方法要写 `override`。
:::

:::hint{level=2}
用 `Object.entries(stock)` 同时拿到 `sku` 和数量，就不需要再用下标读取。`report` 中先建一个没有 `top` 的结果对象，找到了最多的 `sku` 之后再加上 `result.top = …`。排序比较字符串时可以写 `a < b ? -1 : a > b ? 1 : 0`。
:::

:::explanation
这几个选项报出的错误，有的只是写法问题，有的背后是真实的 bug：

- `noUncheckedIndexedAccess`：`stock[sku] + amount` 中 `stock[sku]` 可能是 `undefined`，这正是起始代码中“新的 `sku` 得到 `NaN`”的原因。改成 `(stock[sku] ?? 0) + amount` 同时修好了 bug；`report` 改用 `Object.entries`，遍历时每个数量都是确定的 `number`，不需要检查；
- `exactOptionalPropertyTypes`：`{ …, top }` 在库存为空时会写出 `top: undefined`，`'top' in r` 是 `true`。先建对象、找到时再加属性，结果中就真的“没有”这一项；
- `noPropertyAccessFromIndexSignature`：`stock.apple` 看起来像一个一定存在的属性，`stock['apple']` 则提醒读代码的人这是一次查找，结果可能是 `undefined`，于是 `?? 0` 也就自然地写上了（起始代码会输出“苹果：undefined 件”）；
- `noImplicitOverride`：`override` 说明“我在覆盖父类的方法”。以后父类的 `format` 改了名字，子类的这个方法会报错，而不是悄悄地变成一个新方法，让多态失效。

用 `!` 让这些错误消失（`stock[sku]! + amount`）能通过检查，却保留了 bug，所以本题禁止它。
:::

:::variant{kind=alt name=reduce-and-maps}
```ts file=stock.ts
export type Stock = { [sku: string]: number };
export type Report = { total: number; skus: number; top?: string; low: string[] };

export function restock(stock: Stock, sku: string, amount: number): Stock {
  const current = sku in stock ? stock[sku] : 0;
  const next = (current ?? 0) + amount;
  if (next < 0) throw new RangeError('库存不足：' + sku);
  return Object.assign({}, stock, { [sku]: next });
}

export function report(stock: Stock, lowThreshold: number): Report {
  const skus = Object.keys(stock).toSorted();
  const quantities = new Map(Object.entries(stock));
  const qty = (sku: string) => quantities.get(sku) ?? 0;
  const total = skus.reduce((sum, sku) => sum + qty(sku), 0);
  const top = skus.reduce<string | null>((best, sku) => (best === null || qty(sku) > qty(best) ? sku : best), null);
  const base = { total, skus: skus.length, low: skus.filter((sku) => qty(sku) < lowThreshold) };
  return top === null ? base : { ...base, top };
}

export class Formatter {
  format(report: Report): string {
    return `共 ${report.total} 件，${report.skus} 种`;
  }
}

export class CsvFormatter extends Formatter {
  override format(report: Report): string {
    return ['total,skus,top', [report.total, report.skus, report.top ?? ''].join(',')].join('\n');
  }
}

export function describeApples(stock: Stock): string {
  const apples = stock['apple'];
  return `苹果：${apples === undefined ? 0 : apples} 件`;
}
```
:::

:::variant{kind=wrong name=non-null-assertions fails=rules reason="用非空断言 ! 让错误消失，新的 sku 仍然得到 NaN"}
```ts file=stock.ts
export type Stock = { [sku: string]: number };
export type Report = { total: number; skus: number; top?: string; low: string[] };

export function restock(stock: Stock, sku: string, amount: number): Stock {
  const next = stock[sku]! + amount;
  if (next < 0) throw new RangeError(`库存不足：${sku}`);
  return { ...stock, [sku]: next };
}

export function report(stock: Stock, lowThreshold: number): Report {
  const skus = Object.keys(stock).sort();
  let total = 0;
  let top: string | undefined;
  for (const sku of skus) {
    total += stock[sku]!;
    if (top === undefined || stock[sku]! > stock[top]!) top = sku;
  }
  const result: Report = { total, skus: skus.length, low: skus.filter((sku) => stock[sku]! < lowThreshold) };
  if (top !== undefined) result.top = top;
  return result;
}

export class Formatter {
  format(report: Report): string {
    return `共 ${report.total} 件，${report.skus} 种`;
  }
}

export class CsvFormatter extends Formatter {
  override format(report: Report): string {
    return `total,skus,top\n${report.total},${report.skus},${report.top ?? ''}`;
  }
}

export function describeApples(stock: Stock): string {
  return `苹果：${stock['apple'] ?? 0} 件`;
}
```
:::

:::variant{kind=wrong name=explicit-undefined-top fails=types reason="库存为空时显式地写出了 top: undefined"}
```ts file=stock.ts
export type Stock = { [sku: string]: number };
export type Report = { total: number; skus: number; top?: string; low: string[] };

export function restock(stock: Stock, sku: string, amount: number): Stock {
  const next = (stock[sku] ?? 0) + amount;
  if (next < 0) throw new RangeError(`库存不足：${sku}`);
  return { ...stock, [sku]: next };
}

export function report(stock: Stock, lowThreshold: number): Report {
  const entries = Object.entries(stock).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  let total = 0;
  let top: [string, number] | undefined;
  for (const [sku, qty] of entries) {
    total += qty;
    if (top === undefined || qty > top[1]) top = [sku, qty];
  }
  const low = entries.filter(([, qty]) => qty < lowThreshold).map(([sku]) => sku);
  return { total, skus: entries.length, low, top: top?.[0] };
}

export class Formatter {
  format(report: Report): string {
    return `共 ${report.total} 件，${report.skus} 种`;
  }
}

export class CsvFormatter extends Formatter {
  override format(report: Report): string {
    return `total,skus,top\n${report.total},${report.skus},${report.top ?? ''}`;
  }
}

export function describeApples(stock: Stock): string {
  return `苹果：${stock['apple'] ?? 0} 件`;
}
```
:::

:::variant{kind=wrong name=missing-override fails=types reason="子类覆盖 format 时没有写 override"}
```ts file=stock.ts
export type Stock = { [sku: string]: number };
export type Report = { total: number; skus: number; top?: string; low: string[] };

export function restock(stock: Stock, sku: string, amount: number): Stock {
  const next = (stock[sku] ?? 0) + amount;
  if (next < 0) throw new RangeError(`库存不足：${sku}`);
  return { ...stock, [sku]: next };
}

export function report(stock: Stock, lowThreshold: number): Report {
  const entries = Object.entries(stock).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  let total = 0;
  let top: [string, number] | undefined;
  for (const [sku, qty] of entries) {
    total += qty;
    if (top === undefined || qty > top[1]) top = [sku, qty];
  }
  const low = entries.filter(([, qty]) => qty < lowThreshold).map(([sku]) => sku);
  const result: Report = { total, skus: entries.length, low };
  if (top !== undefined) result.top = top[0];
  return result;
}

export class Formatter {
  format(report: Report): string {
    return `共 ${report.total} 件，${report.skus} 种`;
  }
}

export class CsvFormatter extends Formatter {
  format(report: Report): string {
    return `total,skus,top\n${report.total},${report.skus},${report.top ?? ''}`;
  }
}

export function describeApples(stock: Stock): string {
  return `苹果：${stock['apple'] ?? 0} 件`;
}
```
:::

:::variant{kind=wrong name=tie-by-last fails=tests reason="数量相同时取了最后一个，而不是字母顺序在前的"}
```ts file=stock.ts
export type Stock = { [sku: string]: number };
export type Report = { total: number; skus: number; top?: string; low: string[] };

export function restock(stock: Stock, sku: string, amount: number): Stock {
  const next = (stock[sku] ?? 0) + amount;
  if (next < 0) throw new RangeError(`库存不足：${sku}`);
  return { ...stock, [sku]: next };
}

export function report(stock: Stock, lowThreshold: number): Report {
  const entries = Object.entries(stock).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  let total = 0;
  let top: [string, number] | undefined;
  for (const [sku, qty] of entries) {
    total += qty;
    if (top === undefined || qty >= top[1]) top = [sku, qty];
  }
  const low = entries.filter(([, qty]) => qty < lowThreshold).map(([sku]) => sku);
  const result: Report = { total, skus: entries.length, low };
  if (top !== undefined) result.top = top[0];
  return result;
}

export class Formatter {
  format(report: Report): string {
    return `共 ${report.total} 件，${report.skus} 种`;
  }
}

export class CsvFormatter extends Formatter {
  override format(report: Report): string {
    return `total,skus,top\n${report.total},${report.skus},${report.top ?? ''}`;
  }
}

export function describeApples(stock: Stock): string {
  return `苹果：${stock['apple'] ?? 0} 件`;
}
```
:::
