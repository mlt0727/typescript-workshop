---
kind: challenge
title: 体温换算与分类
---
实现两个函数并导出：

1. `toFahrenheit(celsius: number): number`：把摄氏度换算成华氏度，公式 `F = C × 9 / 5 + 32`。
2. `classify(celsius: number): string`：按下表返回分类（单位：摄氏度）：

| 范围 | 返回值 |
|---|---|
| 低于 35.0 | `'体温过低'` |
| 35.0 及以上、低于 37.3 | `'正常'` |
| 37.3 及以上 | `'发热'` |

要求：参数和返回值都写出类型注解；不使用 `any`。浮点数计算可能有微小误差（例如 `37 × 9 / 5 + 32` 得到 `98.60000000000001`），测试会允许这种误差，你不需要处理。

:::files{role=starter}
```ts file=temperature.ts
// 在这里实现 toFahrenheit 和 classify，并用 export 导出

console.log(toFahrenheit(37), classify(37));
```
:::

:::files{role=solution}
```ts file=temperature.ts
export function toFahrenheit(celsius: number): number {
  return celsius * 9 / 5 + 32;
}

export function classify(celsius: number): string {
  if (celsius < 35) {
    return '体温过低';
  } else if (celsius < 37.3) {
    return '正常';
  } else {
    return '发热';
  }
}

console.log(toFahrenheit(37), classify(37));
```
:::

:::files{role=tests}
```ts file=temperature.test.ts
import { describe, expect, test } from 'vitest';
import { classify, toFahrenheit } from './temperature';

describe('toFahrenheit', () => {
  test.each([
    [0, 32],
    [100, 212],
    [-40, -40],
    [37, 98.6],
    [36.5, 97.7],
  ])('%s°C 是 %s°F', (c, f) => {
    expect(toFahrenheit(c)).toBeCloseTo(f, 6);
  });
});

describe('classify', () => {
  test.each([
    [34.9, '体温过低'],
    [35, '正常'],
    [36.6, '正常'],
    [37.2, '正常'],
    [37.3, '发热'],
    [39.5, '发热'],
  ])('%s°C → %s', (c, expected) => {
    expect(classify(c)).toBe(expected);
  });
});
```
```ts file=temperature.test-d.ts
import { expectTypeOf } from 'vitest';
import { classify, toFahrenheit } from './temperature';

expectTypeOf(toFahrenheit).toEqualTypeOf<(celsius: number) => number>();
expectTypeOf(classify).toEqualTypeOf<(celsius: number) => string>();
```
:::

:::hint{level=1}
参考本课“先认识函数的写法”中的示例：`function 名字(参数: 类型): 返回类型 { … }`，前面加 `export` 才能被测试导入。分类时注意边界值 35.0、37.2、37.3 分别属于哪一类。
:::

:::hint{level=2}
`toFahrenheit` 只有一行：`return celsius * 9 / 5 + 32;`。`classify` 用 `if (celsius < 35) … else if (celsius < 37.3) … else …`：小于 37.3 的都算正常，37.3 本身是发热。
:::

:::explanation
`toFahrenheit` 直接按公式计算。`classify` 从低到高依次判断：先排除低于 35 的情况，再判断是否低于 37.3，剩下的就是发热。用“小于下一档的起点”来写条件，可以避免在 37.2 和 37.3 之间留下空隙（例如体温 37.25 也会被归为正常）。

类型注解让 TypeScript 帮你检查：如果不小心让 `classify` 返回数字，或把字符串传给 `toFahrenheit`，编辑器会立即报错。类型测试文件（`*.test-d.ts`）还检查了两个函数的签名必须完全符合要求。
:::

:::variant{kind=alt name=ternary-and-factor}
```ts file=temperature.ts
export function toFahrenheit(celsius: number): number {
  return celsius * 1.8 + 32;
}

export function classify(celsius: number): string {
  return celsius < 35 ? '体温过低' : celsius >= 37.3 ? '发热' : '正常';
}
```
:::

:::variant{kind=wrong name=forgot-offset fails=tests reason="公式漏了 + 32"}
```ts file=temperature.ts
export function toFahrenheit(celsius: number): number {
  return celsius * 9 / 5;
}

export function classify(celsius: number): string {
  if (celsius < 35) {
    return '体温过低';
  } else if (celsius < 37.3) {
    return '正常';
  } else {
    return '发热';
  }
}
```
:::

:::variant{kind=wrong name=boundary fails=tests reason="边界写错：37.3 被归为正常"}
```ts file=temperature.ts
export function toFahrenheit(celsius: number): number {
  return celsius * 9 / 5 + 32;
}

export function classify(celsius: number): string {
  if (celsius < 35) {
    return '体温过低';
  } else if (celsius <= 37.3) {
    return '正常';
  } else {
    return '发热';
  }
}
```
:::

:::variant{kind=wrong name=any-param fails=rules reason="参数用 any，类型检查形同虚设"}
```ts file=temperature.ts
export function toFahrenheit(celsius: any): number {
  return celsius * 9 / 5 + 32;
}

export function classify(celsius: number): string {
  if (celsius < 35) {
    return '体温过低';
  } else if (celsius < 37.3) {
    return '正常';
  } else {
    return '发热';
  }
}
```
:::
