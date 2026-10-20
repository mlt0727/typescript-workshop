---
kind: task
title: 为 chunk 写测试
grading: tests
---
`chunk.ts`（只读）中是一个已经写好的函数：

- `chunk(items, size)` 把数组按 `size` 个一组分开，返回组的数组；最后一组可以不满；空数组得到空数组；
- `size` 必须是正整数，否则抛出 `RangeError`；
- 不修改传入的数组。

在 `chunk.test.ts` 中为它写测试。判题时，你的测试先要在 `chunk.ts` 上全部通过；然后平台会换上几个故意写错的 `chunk.ts`，每一个都要被你的测试发现（至少有一个测试失败）。起始代码中的一个测试能发现其中的一个，其余的需要你补上。

:::files{role=support}
```ts file=chunk.ts readonly
/** 把数组按 size 个一组分开；最后一组可以不满。不修改传入的数组 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new RangeError(`size 必须是正整数：${size}`);
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}
```
:::

:::files{role=starter}
```ts file=chunk.test.ts
import { describe, expect, test } from 'vitest';
import { chunk } from './chunk';

describe('chunk', () => {
  test('按 size 个一组分开', () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });
});
```
:::

:::files{role=solution}
```ts file=chunk.test.ts
import { describe, expect, test } from 'vitest';
import { chunk } from './chunk';

describe('chunk', () => {
  test('按 size 个一组分开', () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });

  test('最后一组可以不满', () => {
    expect(chunk(['a', 'b', 'c', 'd', 'e'], 2)).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
  });

  test('size 大于长度时只有一组', () => {
    expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
  });

  test('空数组得到空数组', () => {
    expect(chunk([], 3)).toEqual([]);
  });

  test('不修改传入的数组', () => {
    const items = [1, 2, 3];
    chunk(items, 2);
    expect(items).toEqual([1, 2, 3]);
  });

  test.each([0, -1, 1.5, Number.NaN])('size 为 %s 时抛出 RangeError', (size) => {
    expect(() => chunk([1, 2, 3], size)).toThrow(RangeError);
  });
});
```
:::

:::mutant{name=drops-last hint="最后一组不满时被丢掉了：需要一个长度不是 size 整数倍的例子"}
```ts file=chunk.ts
/** 把数组按 size 个一组分开；最后一组可以不满。不修改传入的数组 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new RangeError(`size 必须是正整数：${size}`);
  const chunks: T[][] = [];
  for (let i = 0; i + size <= items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}
```
:::

:::mutant{name=short-chunks hint="每一组少了一个元素：需要检查每一组的内容"}
```ts file=chunk.ts
/** 把数组按 size 个一组分开；最后一组可以不满。不修改传入的数组 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new RangeError(`size 必须是正整数：${size}`);
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size - 1));
  return chunks;
}
```
:::

:::mutant{name=returns-empty hint="size 无效时没有抛出 RangeError，而是返回了空数组：需要测试 size 为 0 或负数"}
```ts file=chunk.ts
/** 把数组按 size 个一组分开；最后一组可以不满。不修改传入的数组 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}
```
:::

:::mutant{name=accepts-fractions hint="size 是小数（例如 1.5）或 NaN 时没有报错：“正整数”包括“整数”这一半"}
```ts file=chunk.ts
/** 把数组按 size 个一组分开；最后一组可以不满。不修改传入的数组 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) throw new RangeError(`size 必须是正整数：${size}`);
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}
```
:::

:::mutant{name=empty-gives-one-group hint="空数组得到的是 [[]]（一个空的组），而不是 []：需要测试空数组"}
```ts file=chunk.ts
/** 把数组按 size 个一组分开；最后一组可以不满。不修改传入的数组 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new RangeError(`size 必须是正整数：${size}`);
  const chunks: T[][] = [];
  let i = 0;
  do {
    chunks.push(items.slice(i, i + size));
    i += size;
  } while (i < items.length);
  return chunks;
}
```
:::

:::mutant{name=mutates-input hint="把传入的数组清空了（用 splice 一组一组地取出）：需要检查调用之后原数组不变"}
```ts file=chunk.ts
/** 把数组按 size 个一组分开；最后一组可以不满。不修改传入的数组 */
export function chunk<T>(items: T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new RangeError(`size 必须是正整数：${size}`);
  const chunks: T[][] = [];
  while (items.length > 0) chunks.push(items.splice(0, size));
  return chunks;
}
```
:::

:::hint{level=1}
对照规格中的每一句话写测试：“最后一组可以不满”需要一个长度不能被 `size` 整除的例子；“空数组得到空数组”；“必须是正整数”包括了非正数和非整数两种情况；“不修改传入的数组”需要在调用之后检查原来的数组。
:::

:::hint{level=2}
检查异常要传函数：`expect(() => chunk([1, 2, 3], 0)).toThrow(RangeError)`。几个无效的 `size` 可以用 `test.each([0, -1, 1.5, Number.NaN])` 一次写完。检查“不修改”：先把数组存进一个变量，调用 `chunk` 之后用 `toEqual` 比较它和原来的内容。
:::

:::explanation
一组足够的测试，基本上就是把规格逐句翻译成例子：

| 规格 | 测试 | 发现的错误实现 |
| --- | --- | --- |
| 按 size 个一组 | `[1, 2, 3, 4]`、2 | 每组少一个元素 |
| 最后一组可以不满 | 5 个元素、2 | 丢掉最后一组 |
| 空数组得到空数组 | `[]` | 得到 `[[]]` |
| 必须是正整数 | 0、-1、1.5、`NaN` | 返回空数组、接受小数 |
| 不修改传入的数组 | 调用后检查原数组 | 用 `splice` 取出 |

注意“必须是正整数”这一句包含两个条件：只测试 0 的话，“只检查 `size < 1`”的实现也能通过，小数 `1.5` 才能把它区分出来。这就是“边界”与“无效输入”要分开想的原因。

“不修改传入的数组”是一种“没有发生的事”，不专门检查就永远发现不了。被测的函数签名是 `readonly T[]`，在类型上已经禁止了修改；但测试检查的是运行时的行为，即使有人把签名改了，测试仍然有效。
:::

:::variant{kind=alt name=table-and-loop}
```ts file=chunk.test.ts
import { expect, test } from 'vitest';
import { chunk } from './chunk';

const cases: [items: number[], size: number, expected: number[][]][] = [
  [[1, 2, 3, 4, 5, 6, 7], 3, [[1, 2, 3], [4, 5, 6], [7]]],
  [[1, 2, 3], 1, [[1], [2], [3]]],
  [[1, 2, 3], 3, [[1, 2, 3]]],
  [[], 2, []],
];

test.each(cases)('chunk(%j, %d)', (items, size, expected) => {
  const copy = [...items];
  expect(chunk(items, size)).toStrictEqual(expected);
  expect(items).toStrictEqual(copy);
});

test('无效的 size', () => {
  for (const size of [0, -2, 2.5, Number.NaN, Infinity]) {
    expect(() => chunk(['x'], size), String(size)).toThrow(RangeError);
  }
});
```
:::

:::variant{kind=wrong name=no-fractions-no-empty fails=mutants misses=accepts-fractions,empty-gives-one-group,mutates-input reason="只测试了正常值、最后不满的一组和 size 为 0：小数、空数组、是否修改原数组都没有测试"}
```ts file=chunk.test.ts
import { describe, expect, test } from 'vitest';
import { chunk } from './chunk';

describe('chunk', () => {
  test('按 size 个一组分开，最后一组可以不满', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  test('size 为 0 时抛出 RangeError', () => {
    expect(() => chunk([1, 2, 3], 0)).toThrow(RangeError);
  });
});
```
:::

:::variant{kind=wrong name=throw-without-function fails=tests reason="expect(chunk([1], 0)).toThrow()：chunk 在 expect 之前就抛出了，测试本身失败"}
```ts file=chunk.test.ts
import { describe, expect, test } from 'vitest';
import { chunk } from './chunk';

describe('chunk', () => {
  test('最后一组可以不满', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  test('size 无效时抛出 RangeError', () => {
    expect(chunk([1, 2, 3], 0)).toThrow(RangeError);
  });
});
```
:::

:::variant{kind=wrong name=tobe-arrays fails=tests reason="用 toBe 比较数组：内容相同也不是同一个数组，测试在正确的实现上就失败了"}
```ts file=chunk.test.ts
import { describe, expect, test } from 'vitest';
import { chunk } from './chunk';

describe('chunk', () => {
  test('按 size 个一组分开', () => {
    expect(chunk([1, 2, 3, 4], 2)).toBe([[1, 2], [3, 4]]);
  });
});
```
:::
