---
kind: task
title: 修好小票上的类型错误
---
这张小票应该显示“应付 68”（单价 20 × 数量 3 + 运费 8），但它显示的是 `608`。

1. 先点击“运行”，确认输出确实是错的；
2. 看编辑器报出的类型错误，修改**数据**的写法（不要改变量的类型注解），让类型检查通过、`total` 等于 `68`。

:::files{role=starter}
```ts file=receipt.ts
export const price: number = 20;
export const quantity: number = '3';
export const shipping: number = '8';

export const total: number = price * quantity + shipping;

console.log('应付', total);
```
:::

:::files{role=solution}
```ts file=receipt.ts
export const price: number = 20;
export const quantity: number = 3;
export const shipping: number = 8;

export const total: number = price * quantity + shipping;

console.log('应付', total);
```
:::

:::files{role=tests}
```ts file=receipt.test.ts
import { expect, test } from 'vitest';
import { price, quantity, shipping, total } from './receipt';

test('数量和运费是数字', () => {
  expect(typeof quantity).toBe('number');
  expect(typeof shipping).toBe('number');
});

test('总价正确', () => {
  expect(price).toBe(20);
  expect(quantity).toBe(3);
  expect(shipping).toBe(8);
  expect(total).toBe(68);
});
```
```ts file=receipt.test-d.ts
import { expectTypeOf } from 'vitest';
import { quantity, shipping, total } from './receipt';

expectTypeOf(quantity).toEqualTypeOf<number>();
expectTypeOf(shipping).toEqualTypeOf<number>();
expectTypeOf(total).toEqualTypeOf<number>();
```
:::

:::hint{level=1}
编辑器指出了两行有 TS2322 错误：值的类型和声明的类型不一致。引号里的内容是字符串。
:::

:::hint{level=2}
把 `'3'` 和 `'8'` 改成数字 `3` 和 `8`（去掉引号）。
:::

:::explanation
`'3'` 和 `'8'` 是字符串。运行时，`20 * '3'` 被 JavaScript 自动转换成数字乘法，得到 60；但 `60 + '8'` 是字符串拼接，得到 `'608'`。TypeScript 在第 2、3 行就指出了问题：变量声明为 `number`，却赋了字符串。去掉引号后，数据和类型一致，结果也就对了。

也可以用 `Number('3')` 把字符串显式转换成数字——当数据确实来自字符串（例如用户输入）时，这才是正确做法（第 6 课会讲各种转换方式的区别）。
:::

:::variant{kind=alt name=explicit-number}
```ts file=receipt.ts
export const price: number = 20;
export const quantity: number = Number('3');
export const shipping: number = Number('8');

export const total: number = price * quantity + shipping;

console.log('应付', total);
```
:::

:::variant{kind=wrong name=change-annotation fails=types reason="把类型注解改成 string：字符串不能参与乘法，类型检查失败"}
```ts file=receipt.ts
export const price: number = 20;
export const quantity: string = '3';
export const shipping: string = '8';

export const total: number = price * quantity + shipping;

console.log('应付', total);
```
:::

:::variant{kind=wrong name=fix-one-only fails=types reason="只改了一处，运费仍然是字符串"}
```ts file=receipt.ts
export const price: number = 20;
export const quantity: number = 3;
export const shipping: number = '8';

export const total: number = price * quantity + shipping;

console.log('应付', total);
```
:::

:::variant{kind=wrong name=hardcode-total fails=types reason="直接写死结果，原来的类型错误还在"}
```ts file=receipt.ts
export const price: number = 20;
export const quantity: number = '3';
export const shipping: number = '8';

export const total: number = 68;

console.log('应付', total);
```
:::
