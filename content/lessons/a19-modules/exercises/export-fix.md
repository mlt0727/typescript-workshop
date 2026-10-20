---
kind: task
title: 修好两个文件之间的导入
---
`money.ts` 定义了金额类型和格式化函数，`cart.ts` 使用它们计算购物车总价。`cart.ts` 的 `cartTotalText` 返回总价文字，例如 `'¥12.50'`。

起始代码的逻辑是对的，但两个文件之间的导入导出有问题，TypeScript 报了错。修好它（两个文件都可能需要修改）。

:::files{role=starter}
```ts file=cart.ts
import { Money, formatMoney } from './money';

export function cartTotalText(items: Money[]): string {
  let cents = 0;
  for (const item of items) {
    cents += item.cents;
  }
  return formatMoney({ cents: cents });
}
```
```ts file=money.ts
type Money = { cents: number };

function formatMoney(money: Money): string {
  const yuan = Math.floor(money.cents / 100);
  const fen = String(money.cents % 100).padStart(2, '0');
  return `¥${yuan}.${fen}`;
}
```
:::

:::files{role=solution}
```ts file=cart.ts
import { formatMoney, type Money } from './money';

export function cartTotalText(items: Money[]): string {
  let cents = 0;
  for (const item of items) {
    cents += item.cents;
  }
  return formatMoney({ cents: cents });
}
```
```ts file=money.ts
export type Money = { cents: number };

export function formatMoney(money: Money): string {
  const yuan = Math.floor(money.cents / 100);
  const fen = String(money.cents % 100).padStart(2, '0');
  return `¥${yuan}.${fen}`;
}
```
:::

:::files{role=tests}
```ts file=cart.test.ts
import { expect, test } from 'vitest';
import { cartTotalText } from './cart';
import { formatMoney } from './money';

test('购物车总价', () => {
  expect(cartTotalText([{ cents: 1000 }, { cents: 250 }])).toBe('¥12.50');
});

test('空购物车', () => {
  expect(cartTotalText([])).toBe('¥0.00');
});

test('money.ts 导出了 formatMoney', () => {
  expect(formatMoney({ cents: 5 })).toBe('¥0.05');
});
```
```ts file=cart.test-d.ts
import { expectTypeOf } from 'vitest';
import type { Money } from './money';

expectTypeOf<Money>().toEqualTypeOf<{ cents: number }>();
```
:::

:::hint{level=1}
先看 `money.ts`：哪些声明需要被别的文件使用？然后看 `cart.ts` 的导入：`Money` 只被用作类型。
:::

:::hint{level=2}
在 `money.ts` 的 `type Money` 和 `function formatMoney` 前面加 `export`。`cart.ts` 的导入改成 `import { formatMoney, type Money } from './money';`（或者拆成两行，其中一行是 `import type { Money } from './money';`）。
:::

:::explanation
模块里的声明默认只在本文件可见，`money.ts` 需要 `export` 才能让 `cart.ts` 和测试文件导入。

`Money` 只出现在类型注解里，开启 `verbatimModuleSyntax` 时必须标明 `type`。编译后，`type Money` 的导入被删除，`formatMoney` 的导入保留下来，运行时只会去找真实存在的函数。
:::

:::variant{kind=alt name=separate-import-type}
```ts file=cart.ts
import type { Money } from './money';
import { formatMoney } from './money';

export function cartTotalText(items: Money[]): string {
  const cents = items.reduce((sum, item) => sum + item.cents, 0);
  return formatMoney({ cents: cents });
}
```
```ts file=money.ts
export type Money = { cents: number };

export function formatMoney(money: Money): string {
  const yuan = Math.floor(money.cents / 100);
  const fen = String(money.cents % 100).padStart(2, '0');
  return `¥${yuan}.${fen}`;
}
```
:::

:::variant{kind=wrong name=missing-type-keyword fails=types reason="导出了，但导入类型时没有写 type"}
```ts file=cart.ts
import { Money, formatMoney } from './money';

export function cartTotalText(items: Money[]): string {
  let cents = 0;
  for (const item of items) {
    cents += item.cents;
  }
  return formatMoney({ cents: cents });
}
```
```ts file=money.ts
export type Money = { cents: number };

export function formatMoney(money: Money): string {
  const yuan = Math.floor(money.cents / 100);
  const fen = String(money.cents % 100).padStart(2, '0');
  return `¥${yuan}.${fen}`;
}
```
:::

:::variant{kind=wrong name=only-function-exported fails=types reason="只导出了函数，没有导出类型"}
```ts file=cart.ts
import { formatMoney, type Money } from './money';

export function cartTotalText(items: Money[]): string {
  let cents = 0;
  for (const item of items) {
    cents += item.cents;
  }
  return formatMoney({ cents: cents });
}
```
```ts file=money.ts
type Money = { cents: number };

export function formatMoney(money: Money): string {
  const yuan = Math.floor(money.cents / 100);
  const fen = String(money.cents % 100).padStart(2, '0');
  return `¥${yuan}.${fen}`;
}
```
:::
