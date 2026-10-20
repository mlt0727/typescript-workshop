---
kind: challenge
title: 分组显示
---
页面要把一列名字按每行 `size` 个显示。实现 `chunk(items, size)`：把数组按顺序切成若干组，每组 `size` 个元素，最后一组可以不足 `size` 个。

- `chunk(['a', 'b', 'c', 'd', 'e'], 2)` 返回 `[['a', 'b'], ['c', 'd'], ['e']]`；
- 正好分完时，末尾不能多出空组：`chunk(['a', 'b', 'c', 'd'], 2)` 返回 `[['a', 'b'], ['c', 'd']]`；
- 空数组返回空数组 `[]`；
- **不能修改传入的数组**（调用方还要继续使用它）。

`size` 一定是正整数。返回类型 `string[][]` 表示“元素是 `string[]` 的数组”。

:::files{role=starter}
```ts file=chunk.ts
export function chunk(items: string[], size: number): string[][] {
  const result: string[][] = [];
  return result;
}

console.log(chunk(['a', 'b', 'c', 'd', 'e'], 2));
```
:::

:::files{role=solution}
```ts file=chunk.ts
export function chunk(items: string[], size: number): string[][] {
  const result: string[][] = [];
  for (let start = 0; start < items.length; start += size) {
    result.push(items.slice(start, start + size));
  }
  return result;
}

console.log(chunk(['a', 'b', 'c', 'd', 'e'], 2));
```
:::

:::files{role=tests}
```ts file=chunk.test.ts
import { describe, expect, test } from 'vitest';
import { chunk } from './chunk';

describe('chunk', () => {
  test('最后一组不足 size 个', () => {
    expect(chunk(['a', 'b', 'c', 'd', 'e'], 2)).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
  });

  test('正好分完时没有空组', () => {
    expect(chunk(['a', 'b', 'c', 'd'], 2)).toEqual([['a', 'b'], ['c', 'd']]);
  });

  test('size 大于数组长度', () => {
    expect(chunk(['a', 'b'], 5)).toEqual([['a', 'b']]);
  });

  test('size 为 1', () => {
    expect(chunk(['a', 'b', 'c'], 1)).toEqual([['a'], ['b'], ['c']]);
  });

  test('空数组', () => {
    expect(chunk([], 3)).toEqual([]);
  });

  test('不修改传入的数组', () => {
    const names = ['Ada', 'Grace', 'Linus'];
    chunk(names, 2);
    expect(names).toEqual(['Ada', 'Grace', 'Linus']);
  });
});
```
```ts file=chunk.test-d.ts
import { expectTypeOf } from 'vitest';
import { chunk } from './chunk';

expectTypeOf(chunk).toEqualTypeOf<(items: string[], size: number) => string[][]>();
```
:::

:::hint{level=1}
每一组的起点是 `0`、`size`、`2 * size`……用经典 `for` 循环让起点每次增加 `size`，用 `slice` 取出这一组。`slice` 的结束位置超出数组长度时会自动截断。
:::

:::hint{level=2}
`for (let start = 0; start < items.length; start += size) { result.push(items.slice(start, start + size)); }`。注意循环条件是 `<` 而不是 `<=`，否则正好分完时会多出一个空组。
:::

:::explanation
`slice(start, start + size)` 返回一段新数组，不修改原数组；当 `start + size` 超过长度时，它只返回到末尾为止，所以最后一组自然不足 `size` 个，不需要特殊处理。

循环条件用 `start < items.length`：最后一个合法起点是最后一个元素的下标。写成 `<=` 时，长度正好是 `size` 的倍数会多执行一轮，`slice` 返回空数组。

用 `splice` 也能切出一组，但它会**从原数组中删除**这些元素，调用方的数组就被清空了。

逐个元素用下标 `items[j]` 构造每一组也可以，但开启 `noUncheckedIndexedAccess` 后，`items[j]` 的类型是 `string | undefined`，需要先检查再 `push`。
:::

:::variant{kind=alt name=accumulate}
```ts file=chunk.ts
export function chunk(items: string[], size: number): string[][] {
  const result: string[][] = [];
  let group: string[] = [];
  for (const item of items) {
    group.push(item);
    if (group.length === size) {
      result.push(group);
      group = [];
    }
  }
  if (group.length > 0) {
    result.push(group);
  }
  return result;
}
```
:::

:::variant{kind=wrong name=splice-mutates fails=tests reason="用 splice 切分，清空了调用方的数组"}
```ts file=chunk.ts
export function chunk(items: string[], size: number): string[][] {
  const result: string[][] = [];
  while (items.length > 0) {
    result.push(items.splice(0, size));
  }
  return result;
}
```
:::

:::variant{kind=wrong name=extra-empty-group fails=tests reason="循环条件用了 <=，正好分完时多出一个空组"}
```ts file=chunk.ts
export function chunk(items: string[], size: number): string[][] {
  const result: string[][] = [];
  for (let start = 0; start <= items.length; start += size) {
    result.push(items.slice(start, start + size));
  }
  return result;
}
```
:::

:::variant{kind=wrong name=drop-remainder fails=tests reason="只保留了满 size 个的组，丢掉了最后不足的一组"}
```ts file=chunk.ts
export function chunk(items: string[], size: number): string[][] {
  const result: string[][] = [];
  for (let start = 0; start + size <= items.length; start += size) {
    result.push(items.slice(start, start + size));
  }
  return result;
}
```
:::

:::variant{kind=wrong name=unchecked-index fails=types reason="items[j] 的类型是 string | undefined，没有检查就放进 string[]"}
```ts file=chunk.ts
export function chunk(items: string[], size: number): string[][] {
  const result: string[][] = [];
  for (let start = 0; start < items.length; start += size) {
    const group: string[] = [];
    for (let j = start; j < start + size && j < items.length; j++) {
      group.push(items[j]);
    }
    result.push(group);
  }
  return result;
}
```
:::
