---
kind: challenge
title: 计算优惠价
---
商城的价格用“分”作单位的整数保存（避免小数误差，下一课会讲原因）。实现 `couponPrice(price, isMember)`，返回最终价格（单位：分）：

1. 原价 `price` **大于或等于** 10000（100 元）时，减去 1500（15 元）；否则不减；
2. 如果 `isMember` 为 `true`，在第 1 步结果的基础上打九折（乘以 `0.9`），再用 `Math.round` 四舍五入到整数分；
3. 返回结果。

例如 `couponPrice(12000, false)` 返回 `10500`，`couponPrice(12000, true)` 返回 `9450`。

起始代码的参数没有类型。补上类型注解：`price` 是 `number`，`isMember` 是 `boolean`，返回值是 `number`。

:::files{role=starter}
```ts file=price.ts
export function couponPrice(price, isMember) {
  return price;
}

console.log(couponPrice(12000, false), couponPrice(12000, true));
```
:::

:::files{role=solution}
```ts file=price.ts
const THRESHOLD = 10000;
const DISCOUNT = 1500;
const MEMBER_RATE = 0.9;

export function couponPrice(price: number, isMember: boolean): number {
  let result = price;
  if (price >= THRESHOLD) {
    result = result - DISCOUNT;
  }
  if (isMember) {
    result = Math.round(result * MEMBER_RATE);
  }
  return result;
}

console.log(couponPrice(12000, false), couponPrice(12000, true));
```
:::

:::files{role=tests}
```ts file=price.test.ts
import { describe, expect, test } from 'vitest';
import { couponPrice } from './price';

describe('非会员', () => {
  test('满 100 元减 15 元', () => {
    expect(couponPrice(12000, false)).toBe(10500);
  });

  test('正好 100 元也能减', () => {
    expect(couponPrice(10000, false)).toBe(8500);
  });

  test('不满 100 元不减', () => {
    expect(couponPrice(9999, false)).toBe(9999);
    expect(couponPrice(0, false)).toBe(0);
  });
});

describe('会员', () => {
  test('先减再打九折', () => {
    expect(couponPrice(12000, true)).toBe(9450);
    expect(couponPrice(10000, true)).toBe(7650);
  });

  test('不满 100 元也打九折', () => {
    expect(couponPrice(2000, true)).toBe(1800);
  });

  test('四舍五入到整数分', () => {
    expect(couponPrice(1234, true)).toBe(1111);
    expect(couponPrice(9999, true)).toBe(8999);
  });
});
```
```ts file=price.test-d.ts
import { expectTypeOf } from 'vitest';
import { couponPrice } from './price';

expectTypeOf(couponPrice).toEqualTypeOf<(price: number, isMember: boolean) => number>();
```
:::

:::hint{level=1}
先给两个参数写上类型注解，TS7006 错误就会消失。然后用一个 `let` 变量保存“当前价格”，按规则一步步修改它。
:::

:::hint{level=2}
`let result = price;`，接着 `if (price >= 10000) { result = result - 1500; }`，再 `if (isMember) { result = Math.round(result * 0.9); }`，最后返回 `result`。注意顺序：先减，再打折。
:::

:::explanation
参数必须写类型注解：TypeScript 不会根据调用处推断参数类型，没有注解时参数是隐式的 `any`，在严格模式下报 TS7006。返回类型 `number` 可以由 TypeScript 推断出来，这里写出来是为了固定“返回值是数字”这个约定，防止以后的修改意外返回别的类型。注意类型只能表达“是 `number`”，表达不了“是整数”，整数要靠 `Math.round` 来保证。

`result` 会在两个 `if` 里被重新赋值，所以用 `let`；门槛、减免金额和折扣率不会变，用 `const` 并起一个有意义的名字，比直接在代码里写 `10000`、`1500` 更容易读，也更容易修改。

用整数“分”保存金额是常见做法：`0.1 + 0.2` 在 JavaScript 里并不精确等于 `0.3`（下一课会解释），而整数运算在 ±2⁵³ 以内是精确的。乘以 `0.9` 会产生小数，所以要用 `Math.round` 回到整数分。
:::

:::variant{kind=alt name=const-steps}
```ts file=price.ts
export function couponPrice(price: number, isMember: boolean): number {
  const afterCoupon = price >= 10000 ? price - 1500 : price;
  if (!isMember) {
    return afterCoupon;
  }
  return Math.round(afterCoupon * 0.9);
}
```
:::

:::variant{kind=wrong name=member-first fails=tests reason="先打九折再减 15 元，顺序反了"}
```ts file=price.ts
export function couponPrice(price: number, isMember: boolean): number {
  let result = price;
  if (isMember) {
    result = Math.round(result * 0.9);
  }
  if (price >= 10000) {
    result = result - 1500;
  }
  return result;
}
```
:::

:::variant{kind=wrong name=strict-threshold fails=tests reason="用了 >，正好 100 元时没有减"}
```ts file=price.ts
export function couponPrice(price: number, isMember: boolean): number {
  let result = price;
  if (price > 10000) {
    result = result - 1500;
  }
  if (isMember) {
    result = Math.round(result * 0.9);
  }
  return result;
}
```
:::

:::variant{kind=wrong name=floor fails=tests reason="用 Math.floor 直接舍去小数，不是四舍五入"}
```ts file=price.ts
export function couponPrice(price: number, isMember: boolean): number {
  let result = price;
  if (price >= 10000) {
    result = result - 1500;
  }
  if (isMember) {
    result = Math.floor(result * 0.9);
  }
  return result;
}
```
:::

:::variant{kind=wrong name=any-params fails=rules reason="用 any 消除了 TS7006，但也关闭了类型检查"}
```ts file=price.ts
export function couponPrice(price: any, isMember: any): number {
  let result = price;
  if (price >= 10000) {
    result = result - 1500;
  }
  if (isMember) {
    result = Math.round(result * 0.9);
  }
  return result;
}
```
:::

:::variant{kind=wrong name=string-member fails=types reason="isMember 的类型写成了 string"}
```ts file=price.ts
export function couponPrice(price: number, isMember: string): number {
  let result = price;
  if (price >= 10000) {
    result = result - 1500;
  }
  if (isMember === 'true') {
    result = Math.round(result * 0.9);
  }
  return result;
}
```
:::
