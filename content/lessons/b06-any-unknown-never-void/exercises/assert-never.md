---
kind: challenge
title: 不会漏掉的单位换算
---
长度单位只有四种：`type Unit = 'mm' | 'cm' | 'm' | 'km'`。实现：

1. **`assertNever(value)`**：参数类型是 `never`，返回类型也是 `never`。它在运行时抛出 `Error`，`message` 为 `` `未处理的值：${String(value)}` ``。它的作用是放在 `switch` 的 `default` 分支里做穷尽检查：如果以后给 `Unit` 加了新单位却忘了处理，`default` 里的值就不再是 `never`，TypeScript 会报错。
2. **`toMillimeters(value, unit)`**：把某个单位的数值换算成毫米。用 `switch` 处理四种单位，`default` 分支调用 `assertNever`。
3. **`convert(value, from, to)`**：把 `from` 单位的数值换算成 `to` 单位。例如 `convert(250, 'cm', 'm')` 得到 `2.5`。

换算关系：1 cm = 10 mm，1 m = 1000 mm，1 km = 1000 m。

:::files{role=starter}
```ts file=units.ts
export type Unit = 'mm' | 'cm' | 'm' | 'km';

export function assertNever(value: never): never {
  // 在这里实现
}

export function toMillimeters(value: number, unit: Unit): number {
  switch (unit) {
    case 'mm':
      return value;
    case 'cm':
      return value * 10;
    default:
      return value;
  }
}

export function convert(value: number, from: Unit, to: Unit): number {
  return toMillimeters(value, from);
}
```
:::

:::files{role=solution}
```ts file=units.ts
export type Unit = 'mm' | 'cm' | 'm' | 'km';

export function assertNever(value: never): never {
  throw new Error(`未处理的值：${String(value)}`);
}

export function toMillimeters(value: number, unit: Unit): number {
  switch (unit) {
    case 'mm':
      return value;
    case 'cm':
      return value * 10;
    case 'm':
      return value * 1000;
    case 'km':
      return value * 1_000_000;
    default:
      return assertNever(unit);
  }
}

export function convert(value: number, from: Unit, to: Unit): number {
  return toMillimeters(value, from) / toMillimeters(1, to);
}
```
:::

:::files{role=tests}
```ts file=units.test.ts
import { describe, expect, test } from 'vitest';
import { assertNever, convert, toMillimeters } from './units';

describe('toMillimeters', () => {
  test.each([
    [5, 'mm', 5],
    [3, 'cm', 30],
    [2, 'm', 2000],
    [1.5, 'km', 1500000],
  ] as const)('%d %s = %d mm', (value, unit, expected) => {
    expect(toMillimeters(value, unit)).toBe(expected);
  });
});

describe('convert', () => {
  test('各种组合', () => {
    expect(convert(250, 'cm', 'm')).toBe(2.5);
    expect(convert(1500, 'mm', 'm')).toBe(1.5);
    expect(convert(2, 'km', 'cm')).toBe(200000);
    expect(convert(7, 'm', 'm')).toBe(7);
    expect(convert(3, 'km', 'm')).toBe(3000);
  });
});

describe('assertNever', () => {
  test('运行时抛出错误并说明是哪个值', () => {
    expect(() => assertNever('inch' as never)).toThrow('未处理的值：inch');
  });
});
```
```ts file=units.test-d.ts
import { expectTypeOf } from 'vitest';
import { assertNever } from './units';

expectTypeOf(assertNever).parameter(0).toEqualTypeOf<never>();
// 返回类型必须是 never：只有返回 never 的函数才能赋给这个函数类型
const neverReturning: (value: never) => never = assertNever;
console.log(typeof neverReturning);

// @ts-expect-error 普通的字符串不能传给 never 参数
assertNever('mm');
```
:::

:::hint{level=1}
`assertNever` 的函数体只需要一行 `throw`：抛出错误的函数永远不会正常返回，正好符合返回类型 `never`。`toMillimeters` 的 `default` 分支现在会悄悄返回错误的结果，要补齐 `'m'` 和 `'km'`，再把 `default` 改成 `return assertNever(unit);`。
:::

:::hint{level=2}
四个 `case` 都处理之后，`default` 里的 `unit` 类型是 `never`，所以 `assertNever(unit)` 能通过类型检查。`convert` 可以先换算成毫米，再除以“1 个目标单位是多少毫米”：`toMillimeters(value, from) / toMillimeters(1, to)`。
:::

:::explanation
起始代码的 `default: return value;` 是一个隐患：漏掉的 `'m'` 和 `'km'` 会悄悄返回错误的结果，TypeScript 也不会提醒。

改成 `default: return assertNever(unit);` 后，情况就不同了：只有当所有单位都已处理、`unit` 在 `default` 里变成 `never` 时，这一行才能通过类型检查。以后有人给 `Unit` 加上 `'inch'`，这一行就会报错，直接指出需要补充的位置。万一运行时真的来了一个意料之外的值（例如来自未经校验的外部数据），`assertNever` 也会抛出清楚的错误，而不是返回错误的数字。

`1_000_000` 中的下划线是数字分隔符，只为了好读，和 `1000000` 完全相同。
:::

:::variant{kind=alt name=lookup-table}
```ts file=units.ts
export type Unit = 'mm' | 'cm' | 'm' | 'km';

export function assertNever(value: never): never {
  throw new Error(`未处理的值：${String(value)}`);
}

const MM_PER_UNIT: Record<Unit, number> = { mm: 1, cm: 10, m: 1000, km: 1_000_000 };

export function toMillimeters(value: number, unit: Unit): number {
  return value * MM_PER_UNIT[unit];
}

export function convert(value: number, from: Unit, to: Unit): number {
  return (value * MM_PER_UNIT[from]) / MM_PER_UNIT[to];
}
```
:::

:::variant{kind=wrong name=missing-case fails=types reason="漏掉了 km，default 里的值不是 never"}
```ts file=units.ts
export type Unit = 'mm' | 'cm' | 'm' | 'km';

export function assertNever(value: never): never {
  throw new Error(`未处理的值：${String(value)}`);
}

export function toMillimeters(value: number, unit: Unit): number {
  switch (unit) {
    case 'mm':
      return value;
    case 'cm':
      return value * 10;
    case 'm':
      return value * 1000;
    default:
      return assertNever(unit);
  }
}

export function convert(value: number, from: Unit, to: Unit): number {
  return toMillimeters(value, from) / toMillimeters(1, to);
}
```
:::

:::variant{kind=wrong name=string-param fails=types reason="assertNever 的参数写成了 string，失去了穷尽检查的作用"}
```ts file=units.ts
export type Unit = 'mm' | 'cm' | 'm' | 'km';

export function assertNever(value: string): never {
  throw new Error(`未处理的值：${value}`);
}

export function toMillimeters(value: number, unit: Unit): number {
  switch (unit) {
    case 'mm':
      return value;
    case 'cm':
      return value * 10;
    case 'm':
      return value * 1000;
    case 'km':
      return value * 1_000_000;
    default:
      return assertNever(unit);
  }
}

export function convert(value: number, from: Unit, to: Unit): number {
  return toMillimeters(value, from) / toMillimeters(1, to);
}
```
:::

:::variant{kind=wrong name=wrong-direction fails=tests reason="换算方向反了，乘除颠倒"}
```ts file=units.ts
export type Unit = 'mm' | 'cm' | 'm' | 'km';

export function assertNever(value: never): never {
  throw new Error(`未处理的值：${String(value)}`);
}

export function toMillimeters(value: number, unit: Unit): number {
  switch (unit) {
    case 'mm':
      return value;
    case 'cm':
      return value * 10;
    case 'm':
      return value * 1000;
    case 'km':
      return value * 1_000_000;
    default:
      return assertNever(unit);
  }
}

export function convert(value: number, from: Unit, to: Unit): number {
  return toMillimeters(value, to) / toMillimeters(1, from);
}
```
:::
