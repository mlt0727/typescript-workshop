---
kind: task
title: 方法里的回调
---
`priceList.withTax()` 应该返回每个价格加上税之后的新数组：`价格 × (1 + taxRate)`，再用 `Math.round` 取整。例如税率 `0.1` 时，`[100, 250]` 得到 `[110, 275]`。

起始代码在 `map` 里用了普通函数作为回调，TypeScript 报了 TS2683。修好它，让 `withTax` 使用对象自己的 `taxRate`（测试会修改 `taxRate`，所以不能把税率写死）。

:::files{role=starter}
```ts file=prices.ts
export const priceList = {
  prices: [100, 250],
  taxRate: 0.1,
  withTax() {
    return this.prices.map(function (price) {
      return Math.round(price * (1 + this.taxRate));
    });
  },
};

console.log(priceList.withTax());
```
:::

:::files{role=solution}
```ts file=prices.ts
export const priceList = {
  prices: [100, 250],
  taxRate: 0.1,
  withTax() {
    return this.prices.map((price) => Math.round(price * (1 + this.taxRate)));
  },
};

console.log(priceList.withTax());
```
:::

:::files{role=tests}
```ts file=prices.test.ts
import { afterEach, expect, test } from 'vitest';
import { priceList } from './prices';

afterEach(() => {
  priceList.prices = [100, 250];
  priceList.taxRate = 0.1;
});

test('默认税率', () => {
  expect(priceList.withTax()).toEqual([110, 275]);
});

test('使用对象当前的税率和价格', () => {
  priceList.taxRate = 0.2;
  priceList.prices = [10, 99];
  expect(priceList.withTax()).toEqual([12, 119]);
});

test('不修改原价格数组', () => {
  priceList.withTax();
  expect(priceList.prices).toEqual([100, 250]);
});
```
:::

:::hint{level=1}
普通函数作为回调时有自己的 `this`，它不是 `priceList`。哪种函数没有自己的 `this`，会直接使用外层方法的 `this`？
:::

:::hint{level=2}
把 `function (price) { … }` 改成箭头函数 `(price) => Math.round(price * (1 + this.taxRate))`。
:::

:::explanation
`map` 调用回调时不会提供 `this`，所以普通函数回调里的 `this` 是 `undefined`，TypeScript 也无法确定它的类型（TS2683）。

箭头函数没有自己的 `this`，它使用定义位置外层的 `this`，也就是 `withTax` 方法的 `this`。通过 `priceList.withTax()` 调用时，那正是 `priceList`。

另一种写法是先把需要的值取出来：`const rate = this.taxRate;`，回调里只用 `rate`，回调就完全不依赖 `this` 了。
:::

:::variant{kind=alt name=capture-rate}
```ts file=prices.ts
export const priceList = {
  prices: [100, 250],
  taxRate: 0.1,
  withTax() {
    const rate = this.taxRate;
    return this.prices.map(function (price) {
      return Math.round(price * (1 + rate));
    });
  },
};
```
:::

:::variant{kind=wrong name=arrow-method fails=types reason="把 withTax 本身改成了箭头函数，它的 this 来自模块顶层"}
```ts file=prices.ts
export const priceList = {
  prices: [100, 250],
  taxRate: 0.1,
  withTax: () => {
    return this.prices.map((price: number) => Math.round(price * (1 + this.taxRate)));
  },
};
```
:::

:::variant{kind=wrong name=hardcoded-rate fails=tests reason="把税率写死成 0.1，没有使用对象的 taxRate"}
```ts file=prices.ts
export const priceList = {
  prices: [100, 250],
  taxRate: 0.1,
  withTax() {
    return this.prices.map((price) => Math.round(price * 1.1));
  },
};
```
:::
