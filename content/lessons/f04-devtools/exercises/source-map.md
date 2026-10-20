---
kind: challenge
title: 解码 source map
---
在 `sourcemap.ts` 中实现 source map 的解码与查找（规则见正文“source map”一节，也就是 ECMA-426 规范中的 `mappings`）：

**`decodeVlq(text)`**：把一串 Base64 VLQ 字符解码成数的数组。每个字符在 `A`–`Z`、`a`–`z`、`0`–`9`、`+`、`/` 中的位置（0–63）是它的值；值的最高位（32）表示这个数还没有结束，低 5 位是数据，先出现的是低位；拼出的数的最低位是符号（1 为负），其余是绝对值。遇到不在这 64 个字符中的字符，或者字符串在一个数的中间结束了，抛出 `Error`。

**`decodeMappings(mappings)`**：用 `;` 分成生成代码的每一行（空字符串就是没有段的一行），每行用 `,` 分成段，每段用 `decodeVlq` 解码，必须是 1、4 或 5 个数，否则抛出 `Error`。然后把相对值换成绝对值：**生成的列号**相对于同一行中的上一段（每行从 0 开始）；**其余四个数**相对于整个 `mappings` 中上一次出现的同一个数（初始为 0，不随行重新开始）。

**`originalPositionFor(map, line, column)`**：`line` 是生成代码中的行号（从 1 开始），`column` 是列号（从 0 开始，和 DevTools、`@jridgewell/trace-mapping` 的约定一样）。在这一行中找**生成的列号不超过 `column` 的最后一段**；没有这样的段、这一段只有 1 个数、行号超出范围时返回 `null`。否则返回 `{ source, line, column, name }`：`source` 是 `map.sources` 中对应的文件名，`line` 是源文件中的行号**加一**，`column` 是源文件中的列号，`name` 是 `map.names` 中的名字（这一段没有第 5 个数时为 `null`）。

测试中的期望值都来自 npm 上的 `@jridgewell/sourcemap-codec` 和 `@jridgewell/trace-mapping`（Vite 等工具使用的库）对同样输入的实际输出。

:::files{role=starter}
```ts file=sourcemap.ts
export type SourceMap = { version: 3; sources: string[]; names: string[]; mappings: string };
/** 一段：1、4 或 5 个数（都是绝对值，从 0 开始）：生成的列号、源文件下标、源文件行号、源文件列号、名字下标 */
export type Segment = [number] | [number, number, number, number] | [number, number, number, number, number];
export type OriginalPosition = { source: string; line: number; column: number; name: string | null };

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function decodeVlq(text: string): number[] {
  return [...text].map((char) => BASE64.indexOf(char));
}

export function decodeMappings(mappings: string): Segment[][] {
  return [];
}

export function originalPositionFor(map: SourceMap, line: number, column: number): OriginalPosition | null {
  return null;
}
```
```ts file=main.ts
import { decodeMappings, decodeVlq, originalPositionFor, type SourceMap } from './sourcemap';

console.log(decodeVlq('A'), decodeVlq('D'), decodeVlq('gB'), decodeVlq('SAA4B'));

// Vite 开发服务器返回的 counter.ts 的 source map（只保留了前三行）
const map: SourceMap = {
  version: 3,
  sources: ['counter.ts'],
  names: [],
  mappings: 'AAAA,OAAO,SAAS,aAAa,SAA4B;CACvD,IAAI,UAAU;CACd,MAAM,cAAc,UAAkB',
};
console.log(decodeMappings(map.mappings));
console.log(originalPositionFor(map, 2, 5));
```
:::

:::files{role=solution}
```ts file=sourcemap.ts
export type SourceMap = { version: 3; sources: string[]; names: string[]; mappings: string };
/** 一段：1、4 或 5 个数（都是绝对值，从 0 开始）：生成的列号、源文件下标、源文件行号、源文件列号、名字下标 */
export type Segment = [number] | [number, number, number, number] | [number, number, number, number, number];
export type OriginalPosition = { source: string; line: number; column: number; name: string | null };

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function decodeVlq(text: string): number[] {
  const values: number[] = [];
  let value = 0;
  let shift = 0;
  let pending = false;
  for (const char of text) {
    const digit = BASE64.indexOf(char);
    if (digit === -1) throw new Error(`不是 Base64 字符：${char}`);
    value += (digit & 31) * 2 ** shift; // 低 5 位是数据，先出现的是低位
    if (digit & 32) {
      // 最高位为 1：这个数还没有结束
      shift += 5;
      pending = true;
      continue;
    }
    // 最低位是符号，其余是绝对值
    const magnitude = Math.floor(value / 2);
    values.push(value % 2 === 1 ? -magnitude : magnitude);
    value = 0;
    shift = 0;
    pending = false;
  }
  if (pending) throw new Error(`不完整的 VLQ：${text}`);
  return values;
}

export function decodeMappings(mappings: string): Segment[][] {
  // 除了生成的列号（每行重新开始），其余的值在整个 mappings 中累加
  let source = 0;
  let originalLine = 0;
  let originalColumn = 0;
  let name = 0;
  return mappings.split(';').map((line) => {
    if (line === '') return [];
    let column = 0;
    return line.split(',').map((text): Segment => {
      const values = decodeVlq(text);
      if (values.length !== 1 && values.length !== 4 && values.length !== 5) throw new Error(`一段应该有 1、4 或 5 个数：${text}`);
      const [dColumn = 0, dSource = 0, dLine = 0, dOriginalColumn = 0, dName = 0] = values;
      column += dColumn;
      if (values.length === 1) return [column];
      source += dSource;
      originalLine += dLine;
      originalColumn += dOriginalColumn;
      if (values.length === 4) return [column, source, originalLine, originalColumn];
      name += dName;
      return [column, source, originalLine, originalColumn, name];
    });
  });
}

export function originalPositionFor(map: SourceMap, line: number, column: number): OriginalPosition | null {
  const segments = decodeMappings(map.mappings)[line - 1];
  if (segments === undefined) return null;
  // 生成的列号不超过 column 的最后一段
  let found: Segment | undefined;
  for (const segment of segments) {
    if (segment[0] > column) break;
    found = segment;
  }
  if (found === undefined || found.length === 1) return null;
  const [, sourceIndex, originalLine, originalColumn, nameIndex] = found;
  const source = map.sources[sourceIndex];
  if (source === undefined) return null;
  const name = nameIndex === undefined ? null : (map.names[nameIndex] ?? null);
  return { source, line: originalLine + 1, column: originalColumn, name };
}
```
```ts file=main.ts
import { decodeMappings, decodeVlq, originalPositionFor, type SourceMap } from './sourcemap';

console.log(decodeVlq('A'), decodeVlq('D'), decodeVlq('gB'), decodeVlq('SAA4B'));

// Vite 开发服务器返回的 counter.ts 的 source map（只保留了前三行）
const map: SourceMap = {
  version: 3,
  sources: ['counter.ts'],
  names: [],
  mappings: 'AAAA,OAAO,SAAS,aAAa,SAA4B;CACvD,IAAI,UAAU;CACd,MAAM,cAAc,UAAkB',
};
console.log(decodeMappings(map.mappings));
console.log(originalPositionFor(map, 2, 5));
```
:::

:::files{role=tests}
```ts file=sourcemap.test.ts
import { describe, expect, test } from 'vitest';
import { decodeMappings, decodeVlq, originalPositionFor, type SourceMap } from './sourcemap';

// Vite 8.3.4 开发服务器为 counter.ts 生成的 source map（实际抓取），期望值来自 @jridgewell/sourcemap-codec 与 trace-mapping
const counterMap: SourceMap = {
  version: 3,
  sources: ['counter.ts'],
  names: [],
  mappings:
    'AAAA,OAAO,SAAS,aAAa,SAA4B;CACvD,IAAI,UAAU;CACd,MAAM,cAAc,UAAkB;EACpC,UAAU;EACV,QAAQ,YAAY,YAAY;CAClC;CACA,QAAQ,iBAAiB,eAAe,WAAW,UAAU,CAAC,CAAC;CAC/D,WAAW,CAAC;AACd',
};

const namedMap: SourceMap = { version: 3, sources: ['a.ts', 'b.ts'], names: ['greet', 'name'], mappings: 'AAAAA,MAASC;;EAGPD,QCHF' };
const sparseMap: SourceMap = { version: 3, sources: ['x.ts'], names: [], mappings: 'A,KAAA,IAEI;GAGH,K' };

describe('decodeVlq', () => {
  test('单个数', () => {
    const cases: [string, number][] = [['A', 0], ['C', 1], ['D', -1], ['e', 15], ['gB', 16], ['hB', -16], ['+B', 31], ['gC', 32], ['w+B', 1000], ['x+B', -1000], ['gkxH', 123456]];
    for (const [text, value] of cases) expect(decodeVlq(text), text).toEqual([value]);
  });

  test('一段中的几个数', () => {
    expect(decodeVlq('AAAA')).toEqual([0, 0, 0, 0]);
    expect(decodeVlq('SAA4B')).toEqual([9, 0, 0, 28]);
    expect(decodeVlq('EAGPD')).toEqual([2, 0, 3, -7, -1]);
    expect(decodeVlq('')).toEqual([]);
  });

  test('无效的输入抛出错误', () => {
    expect(() => decodeVlq('g')).toThrow();
    expect(() => decodeVlq('AAg')).toThrow();
    expect(() => decodeVlq('A!')).toThrow();
    expect(() => decodeVlq('A=')).toThrow();
  });
});

describe('decodeMappings', () => {
  test('Vite 生成的 source map', () => {
    expect(decodeMappings(counterMap.mappings)).toEqual([
      [[0, 0, 0, 0], [7, 0, 0, 7], [16, 0, 0, 16], [29, 0, 0, 29], [38, 0, 0, 57]],
      [[1, 0, 1, 2], [5, 0, 1, 6], [15, 0, 1, 16]],
      [[1, 0, 2, 2], [7, 0, 2, 8], [21, 0, 2, 22], [31, 0, 2, 40]],
      [[2, 0, 3, 4], [12, 0, 3, 14]],
      [[2, 0, 4, 4], [10, 0, 4, 12], [22, 0, 4, 24], [34, 0, 4, 36]],
      [[1, 0, 5, 2]],
      [[1, 0, 6, 2], [9, 0, 6, 10], [26, 0, 6, 27], [41, 0, 6, 42], [52, 0, 6, 53], [62, 0, 6, 63], [63, 0, 6, 64], [64, 0, 6, 65]],
      [[1, 0, 7, 2], [12, 0, 7, 13], [13, 0, 7, 14]],
      [[0, 0, 8, 0]],
    ]);
  });

  test('名字、多个源文件、空行', () => {
    expect(decodeMappings(namedMap.mappings)).toEqual([[[0, 0, 0, 0, 0], [6, 0, 0, 9, 1]], [], [[2, 0, 3, 2, 0], [10, 1, 0, 0]]]);
  });

  test('只有 1 个数的段', () => {
    expect(decodeMappings(sparseMap.mappings)).toEqual([[[0], [5, 0, 0, 0], [9, 0, 2, 4]], [[3, 0, 5, 1], [8]]]);
  });

  test('空的 mappings 与连续的分号', () => {
    expect(decodeMappings('')).toEqual([[]]);
    expect(decodeMappings(';')).toEqual([[], []]);
    expect(decodeMappings('AAAA;;;AAAA')).toEqual([[[0, 0, 0, 0]], [], [], [[0, 0, 0, 0]]]);
  });

  test('长度不对的段抛出错误', () => {
    expect(() => decodeMappings('AA')).toThrow();
    expect(() => decodeMappings('AAAA,AAA')).toThrow();
  });
});

describe('originalPositionFor（行从 1 开始，列从 0 开始）', () => {
  test('Vite 的 source map', () => {
    const cases: [number, number, number, number][] = [
      [1, 0, 1, 0], [1, 7, 1, 7], [1, 16, 1, 16], [1, 30, 1, 29], [2, 1, 2, 2], [2, 5, 2, 6],
      [4, 2, 4, 4], [5, 12, 5, 12], [7, 40, 7, 27], [8, 1, 8, 2], [9, 0, 9, 0], [9, 5, 9, 0], [1, 100, 1, 57],
    ];
    for (const [line, column, originalLine, originalColumn] of cases) {
      expect(originalPositionFor(counterMap, line, column), `${line}:${column}`).toEqual({ source: 'counter.ts', line: originalLine, column: originalColumn, name: null });
    }
  });

  test('超出范围时是 null', () => {
    expect(originalPositionFor(counterMap, 20, 0)).toBeNull();
    expect(originalPositionFor(counterMap, 0, 0)).toBeNull();
  });

  test('名字与多个源文件', () => {
    expect(originalPositionFor(namedMap, 1, 5)).toEqual({ source: 'a.ts', line: 1, column: 0, name: 'greet' });
    expect(originalPositionFor(namedMap, 1, 6)).toEqual({ source: 'a.ts', line: 1, column: 9, name: 'name' });
    expect(originalPositionFor(namedMap, 3, 9)).toEqual({ source: 'a.ts', line: 4, column: 2, name: 'greet' });
    expect(originalPositionFor(namedMap, 3, 50)).toEqual({ source: 'b.ts', line: 1, column: 0, name: null });
    expect(originalPositionFor(namedMap, 2, 0)).toBeNull();
    expect(originalPositionFor(namedMap, 3, 1)).toBeNull();
  });

  test('落在只有 1 个数的段上时是 null', () => {
    expect(originalPositionFor(sparseMap, 1, 4)).toBeNull();
    expect(originalPositionFor(sparseMap, 1, 8)).toEqual({ source: 'x.ts', line: 1, column: 0, name: null });
    expect(originalPositionFor(sparseMap, 1, 9)).toEqual({ source: 'x.ts', line: 3, column: 4, name: null });
    expect(originalPositionFor(sparseMap, 2, 7)).toEqual({ source: 'x.ts', line: 6, column: 1, name: null });
    expect(originalPositionFor(sparseMap, 2, 30)).toBeNull();
  });
});
```
```ts file=sourcemap.test-d.ts
import { expectTypeOf } from 'vitest';
import { decodeMappings, type Segment } from './sourcemap';

expectTypeOf(decodeMappings('AAAA')).toEqualTypeOf<Segment[][]>();
const ok: Segment[] = [[0], [1, 0, 0, 0], [2, 0, 0, 0, 0]];
// @ts-expect-error 一段不能只有 2 个数
const wrong: Segment = [0, 1];
console.log(ok, wrong);
```
:::

:::hint{level=1}
`decodeVlq`：用 `BASE64.indexOf(char)` 得到每个字符的值 `digit`。`digit & 31` 是数据，`digit & 32` 不为 0 表示还没结束。用 `value += (digit & 31) * 2 ** shift` 累加（`shift` 每次加 5），一个数结束时：`value % 2 === 1` 是负数，绝对值是 `Math.floor(value / 2)`。循环结束时如果还有没结束的数，抛出错误。
:::

:::hint{level=2}
`decodeMappings`：在最外层声明四个累加的变量（源文件、行、列、名字），在每一行的回调中声明 `column = 0`。把 `decodeVlq` 的结果解构成 `[dColumn = 0, dSource = 0, …]`，先检查长度，再按长度返回 1、4 或 5 个数的元组。`originalPositionFor`：取出 `decodeMappings(…)[line - 1]`，遍历这一行的段，遇到列号大于 `column` 的就停下，记住上一段。`found.length === 1` 的判断会把元组的联合类型收窄。
:::

:::explanation
source map 用两层压缩让 `mappings` 尽可能短：

1. **相对值**：生成的代码中，同一行的各段从左到右排列，列号的差值很小；源文件的位置大多也只比上一段前进一点。所以存的是差值，大部分是 0 或很小的数；
2. **VLQ**：小的数只要一个字符。5 位数据能表示 -15 到 15（最低位是符号），超出时用最高位表示“后面还有”，再接一个字符。`SAA4B` 中的 `4B` 就是两个字符组成的 28。

规则中最容易弄错的是“哪些值每行重新开始”：只有生成的列号。源文件的行号、列号是在**整个文件**中延续的，所以第 2 行的 `CACvD` 中，源文件的行号是在上一行的基础上加 1。

查找时用“不超过 `column` 的最后一段”：一段表示“从这个位置开始，直到下一段之前，都对应源文件中的这个位置”，所以 `counter.ts` 生成代码第 1 行的第 30 列落在从第 29 列开始的那一段中。只有 1 个数的段表示“从这里开始没有对应的源码”（例如打包工具加入的辅助代码）。

类型上，`Segment` 是三种长度的元组的联合，判断 `found.length === 1` 之后 TypeScript 知道它是 4 或 5 个数的元组，解构出的 `nameIndex` 的类型是 `number | undefined`。

真实的工具会先解码一次、把结果缓存起来，并用二分查找定位一段；`@jridgewell/trace-mapping` 就是这样做的。DevTools 用同样的数据把断点、堆栈中的位置换成 TypeScript 源文件中的位置。
:::

:::variant{kind=alt name=bitwise-and-state}
```ts file=sourcemap.ts
export type SourceMap = { version: 3; sources: string[]; names: string[]; mappings: string };
/** 一段：1、4 或 5 个数（都是绝对值，从 0 开始）：生成的列号、源文件下标、源文件行号、源文件列号、名字下标 */
export type Segment = [number] | [number, number, number, number] | [number, number, number, number, number];
export type OriginalPosition = { source: string; line: number; column: number; name: string | null };

const DIGITS = new Map([...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'].map((char, index) => [char, index]));

export function decodeVlq(text: string): number[] {
  const result: number[] = [];
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < text.length; i++) {
    const digit = DIGITS.get(text.charAt(i));
    if (digit === undefined) throw new Error('无效的字符');
    acc |= (digit & 0b11111) << bits;
    bits += 5;
    if ((digit & 0b100000) === 0) {
      result.push(acc & 1 ? -(acc >>> 1) : acc >>> 1);
      acc = 0;
      bits = 0;
    } else if (i === text.length - 1) {
      throw new Error('VLQ 在一个数的中间结束了');
    }
  }
  return result;
}

function toSegment(values: number[], state: number[]): Segment {
  // state：[生成的列号, 源文件, 行, 列, 名字]，累加后就是绝对值
  values.forEach((delta, i) => {
    state[i] = (state[i] ?? 0) + delta;
  });
  const [a = 0, b = 0, c = 0, d = 0, e = 0] = state;
  switch (values.length) {
    case 1:
      return [a];
    case 4:
      return [a, b, c, d];
    case 5:
      return [a, b, c, d, e];
    default:
      throw new Error('段的长度不对');
  }
}

export function decodeMappings(mappings: string): Segment[][] {
  const state = [0, 0, 0, 0, 0];
  const lines: Segment[][] = [];
  for (const line of mappings.split(';')) {
    state[0] = 0;
    lines.push(line === '' ? [] : line.split(',').map((text) => toSegment(decodeVlq(text), state)));
  }
  return lines;
}

export function originalPositionFor(map: SourceMap, line: number, column: number): OriginalPosition | null {
  const segments = decodeMappings(map.mappings)[line - 1] ?? [];
  const candidates = segments.filter((segment) => segment[0] <= column);
  const segment = candidates.at(-1);
  if (segment === undefined || segment.length === 1) return null;
  const source = map.sources[segment[1]];
  if (source === undefined) return null;
  return {
    source,
    line: segment[2] + 1,
    column: segment[3],
    name: segment.length === 5 ? (map.names[segment[4]] ?? null) : null,
  };
}
```
:::

:::variant{kind=wrong name=one-char-one-value fails=tests reason="没有处理“后面还有”的那一位：每个字符都被当成了一个数，gB 解成了两个数"}
```ts file=sourcemap.ts
export type SourceMap = { version: 3; sources: string[]; names: string[]; mappings: string };
/** 一段：1、4 或 5 个数（都是绝对值，从 0 开始）：生成的列号、源文件下标、源文件行号、源文件列号、名字下标 */
export type Segment = [number] | [number, number, number, number] | [number, number, number, number, number];
export type OriginalPosition = { source: string; line: number; column: number; name: string | null };

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function decodeVlq(text: string): number[] {
  const values: number[] = [];
  let value = 0;
  let shift = 0;
  let pending = false;
  for (const char of text) {
    const digit = BASE64.indexOf(char);
    if (digit === -1) throw new Error(`不是 Base64 字符：${char}`);
    value += (digit & 31) * 2 ** shift; // 低 5 位是数据，先出现的是低位
    // 最低位是符号，其余是绝对值
    const magnitude = Math.floor(value / 2);
    values.push(value % 2 === 1 ? -magnitude : magnitude);
    value = 0;
    shift = 0;
    pending = false;
  }
  if (pending) throw new Error(`不完整的 VLQ：${text}`);
  return values;
}

export function decodeMappings(mappings: string): Segment[][] {
  // 除了生成的列号（每行重新开始），其余的值在整个 mappings 中累加
  let source = 0;
  let originalLine = 0;
  let originalColumn = 0;
  let name = 0;
  return mappings.split(';').map((line) => {
    if (line === '') return [];
    let column = 0;
    return line.split(',').map((text): Segment => {
      const values = decodeVlq(text);
      if (values.length !== 1 && values.length !== 4 && values.length !== 5) throw new Error(`一段应该有 1、4 或 5 个数：${text}`);
      const [dColumn = 0, dSource = 0, dLine = 0, dOriginalColumn = 0, dName = 0] = values;
      column += dColumn;
      if (values.length === 1) return [column];
      source += dSource;
      originalLine += dLine;
      originalColumn += dOriginalColumn;
      if (values.length === 4) return [column, source, originalLine, originalColumn];
      name += dName;
      return [column, source, originalLine, originalColumn, name];
    });
  });
}

export function originalPositionFor(map: SourceMap, line: number, column: number): OriginalPosition | null {
  const segments = decodeMappings(map.mappings)[line - 1];
  if (segments === undefined) return null;
  // 生成的列号不超过 column 的最后一段
  let found: Segment | undefined;
  for (const segment of segments) {
    if (segment[0] > column) break;
    found = segment;
  }
  if (found === undefined || found.length === 1) return null;
  const [, sourceIndex, originalLine, originalColumn, nameIndex] = found;
  const source = map.sources[sourceIndex];
  if (source === undefined) return null;
  const name = nameIndex === undefined ? null : (map.names[nameIndex] ?? null);
  return { source, line: originalLine + 1, column: originalColumn, name };
}
```
:::

:::variant{kind=wrong name=no-sign fails=tests reason="忘了最低位是符号：D 解成了 1，负的相对值都变成了正数"}
```ts file=sourcemap.ts
export type SourceMap = { version: 3; sources: string[]; names: string[]; mappings: string };
/** 一段：1、4 或 5 个数（都是绝对值，从 0 开始）：生成的列号、源文件下标、源文件行号、源文件列号、名字下标 */
export type Segment = [number] | [number, number, number, number] | [number, number, number, number, number];
export type OriginalPosition = { source: string; line: number; column: number; name: string | null };

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function decodeVlq(text: string): number[] {
  const values: number[] = [];
  let value = 0;
  let shift = 0;
  let pending = false;
  for (const char of text) {
    const digit = BASE64.indexOf(char);
    if (digit === -1) throw new Error(`不是 Base64 字符：${char}`);
    value += (digit & 31) * 2 ** shift; // 低 5 位是数据，先出现的是低位
    if (digit & 32) {
      // 最高位为 1：这个数还没有结束
      shift += 5;
      pending = true;
      continue;
    }
    // 最低位是符号，其余是绝对值
    values.push(Math.floor(value / 2));
    value = 0;
    shift = 0;
    pending = false;
  }
  if (pending) throw new Error(`不完整的 VLQ：${text}`);
  return values;
}

export function decodeMappings(mappings: string): Segment[][] {
  // 除了生成的列号（每行重新开始），其余的值在整个 mappings 中累加
  let source = 0;
  let originalLine = 0;
  let originalColumn = 0;
  let name = 0;
  return mappings.split(';').map((line) => {
    if (line === '') return [];
    let column = 0;
    return line.split(',').map((text): Segment => {
      const values = decodeVlq(text);
      if (values.length !== 1 && values.length !== 4 && values.length !== 5) throw new Error(`一段应该有 1、4 或 5 个数：${text}`);
      const [dColumn = 0, dSource = 0, dLine = 0, dOriginalColumn = 0, dName = 0] = values;
      column += dColumn;
      if (values.length === 1) return [column];
      source += dSource;
      originalLine += dLine;
      originalColumn += dOriginalColumn;
      if (values.length === 4) return [column, source, originalLine, originalColumn];
      name += dName;
      return [column, source, originalLine, originalColumn, name];
    });
  });
}

export function originalPositionFor(map: SourceMap, line: number, column: number): OriginalPosition | null {
  const segments = decodeMappings(map.mappings)[line - 1];
  if (segments === undefined) return null;
  // 生成的列号不超过 column 的最后一段
  let found: Segment | undefined;
  for (const segment of segments) {
    if (segment[0] > column) break;
    found = segment;
  }
  if (found === undefined || found.length === 1) return null;
  const [, sourceIndex, originalLine, originalColumn, nameIndex] = found;
  const source = map.sources[sourceIndex];
  if (source === undefined) return null;
  const name = nameIndex === undefined ? null : (map.names[nameIndex] ?? null);
  return { source, line: originalLine + 1, column: originalColumn, name };
}
```
:::

:::variant{kind=wrong name=reset-everything fails=tests reason="每一行都把所有的值重新从 0 开始累加：只有生成的列号应该这样"}
```ts file=sourcemap.ts
export type SourceMap = { version: 3; sources: string[]; names: string[]; mappings: string };
/** 一段：1、4 或 5 个数（都是绝对值，从 0 开始）：生成的列号、源文件下标、源文件行号、源文件列号、名字下标 */
export type Segment = [number] | [number, number, number, number] | [number, number, number, number, number];
export type OriginalPosition = { source: string; line: number; column: number; name: string | null };

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function decodeVlq(text: string): number[] {
  const values: number[] = [];
  let value = 0;
  let shift = 0;
  let pending = false;
  for (const char of text) {
    const digit = BASE64.indexOf(char);
    if (digit === -1) throw new Error(`不是 Base64 字符：${char}`);
    value += (digit & 31) * 2 ** shift; // 低 5 位是数据，先出现的是低位
    if (digit & 32) {
      // 最高位为 1：这个数还没有结束
      shift += 5;
      pending = true;
      continue;
    }
    // 最低位是符号，其余是绝对值
    const magnitude = Math.floor(value / 2);
    values.push(value % 2 === 1 ? -magnitude : magnitude);
    value = 0;
    shift = 0;
    pending = false;
  }
  if (pending) throw new Error(`不完整的 VLQ：${text}`);
  return values;
}

export function decodeMappings(mappings: string): Segment[][] {
  // 除了生成的列号（每行重新开始），其余的值在整个 mappings 中累加
  return mappings.split(';').map((line) => {
    if (line === '') return [];
    let column = 0;
    let source = 0;
    let originalLine = 0;
    let originalColumn = 0;
    let name = 0;
    return line.split(',').map((text): Segment => {
      const values = decodeVlq(text);
      if (values.length !== 1 && values.length !== 4 && values.length !== 5) throw new Error(`一段应该有 1、4 或 5 个数：${text}`);
      const [dColumn = 0, dSource = 0, dLine = 0, dOriginalColumn = 0, dName = 0] = values;
      column += dColumn;
      if (values.length === 1) return [column];
      source += dSource;
      originalLine += dLine;
      originalColumn += dOriginalColumn;
      if (values.length === 4) return [column, source, originalLine, originalColumn];
      name += dName;
      return [column, source, originalLine, originalColumn, name];
    });
  });
}

export function originalPositionFor(map: SourceMap, line: number, column: number): OriginalPosition | null {
  const segments = decodeMappings(map.mappings)[line - 1];
  if (segments === undefined) return null;
  // 生成的列号不超过 column 的最后一段
  let found: Segment | undefined;
  for (const segment of segments) {
    if (segment[0] > column) break;
    found = segment;
  }
  if (found === undefined || found.length === 1) return null;
  const [, sourceIndex, originalLine, originalColumn, nameIndex] = found;
  const source = map.sources[sourceIndex];
  if (source === undefined) return null;
  const name = nameIndex === undefined ? null : (map.names[nameIndex] ?? null);
  return { source, line: originalLine + 1, column: originalColumn, name };
}
```
:::

:::variant{kind=wrong name=column-not-reset fails=tests reason="生成的列号没有在每一行重新开始"}
```ts file=sourcemap.ts
export type SourceMap = { version: 3; sources: string[]; names: string[]; mappings: string };
/** 一段：1、4 或 5 个数（都是绝对值，从 0 开始）：生成的列号、源文件下标、源文件行号、源文件列号、名字下标 */
export type Segment = [number] | [number, number, number, number] | [number, number, number, number, number];
export type OriginalPosition = { source: string; line: number; column: number; name: string | null };

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function decodeVlq(text: string): number[] {
  const values: number[] = [];
  let value = 0;
  let shift = 0;
  let pending = false;
  for (const char of text) {
    const digit = BASE64.indexOf(char);
    if (digit === -1) throw new Error(`不是 Base64 字符：${char}`);
    value += (digit & 31) * 2 ** shift; // 低 5 位是数据，先出现的是低位
    if (digit & 32) {
      // 最高位为 1：这个数还没有结束
      shift += 5;
      pending = true;
      continue;
    }
    // 最低位是符号，其余是绝对值
    const magnitude = Math.floor(value / 2);
    values.push(value % 2 === 1 ? -magnitude : magnitude);
    value = 0;
    shift = 0;
    pending = false;
  }
  if (pending) throw new Error(`不完整的 VLQ：${text}`);
  return values;
}

export function decodeMappings(mappings: string): Segment[][] {
  // 除了生成的列号（每行重新开始），其余的值在整个 mappings 中累加
  let source = 0;
  let originalLine = 0;
  let originalColumn = 0;
  let name = 0;
  let column = 0;
  return mappings.split(';').map((line) => {
    if (line === '') return [];
    return line.split(',').map((text): Segment => {
      const values = decodeVlq(text);
      if (values.length !== 1 && values.length !== 4 && values.length !== 5) throw new Error(`一段应该有 1、4 或 5 个数：${text}`);
      const [dColumn = 0, dSource = 0, dLine = 0, dOriginalColumn = 0, dName = 0] = values;
      column += dColumn;
      if (values.length === 1) return [column];
      source += dSource;
      originalLine += dLine;
      originalColumn += dOriginalColumn;
      if (values.length === 4) return [column, source, originalLine, originalColumn];
      name += dName;
      return [column, source, originalLine, originalColumn, name];
    });
  });
}

export function originalPositionFor(map: SourceMap, line: number, column: number): OriginalPosition | null {
  const segments = decodeMappings(map.mappings)[line - 1];
  if (segments === undefined) return null;
  // 生成的列号不超过 column 的最后一段
  let found: Segment | undefined;
  for (const segment of segments) {
    if (segment[0] > column) break;
    found = segment;
  }
  if (found === undefined || found.length === 1) return null;
  const [, sourceIndex, originalLine, originalColumn, nameIndex] = found;
  const source = map.sources[sourceIndex];
  if (source === undefined) return null;
  const name = nameIndex === undefined ? null : (map.names[nameIndex] ?? null);
  return { source, line: originalLine + 1, column: originalColumn, name };
}
```
:::

:::variant{kind=wrong name=exact-column-only fails=tests reason="只接受列号正好相等的段：落在两段之间的位置找不到"}
```ts file=sourcemap.ts
export type SourceMap = { version: 3; sources: string[]; names: string[]; mappings: string };
/** 一段：1、4 或 5 个数（都是绝对值，从 0 开始）：生成的列号、源文件下标、源文件行号、源文件列号、名字下标 */
export type Segment = [number] | [number, number, number, number] | [number, number, number, number, number];
export type OriginalPosition = { source: string; line: number; column: number; name: string | null };

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function decodeVlq(text: string): number[] {
  const values: number[] = [];
  let value = 0;
  let shift = 0;
  let pending = false;
  for (const char of text) {
    const digit = BASE64.indexOf(char);
    if (digit === -1) throw new Error(`不是 Base64 字符：${char}`);
    value += (digit & 31) * 2 ** shift; // 低 5 位是数据，先出现的是低位
    if (digit & 32) {
      // 最高位为 1：这个数还没有结束
      shift += 5;
      pending = true;
      continue;
    }
    // 最低位是符号，其余是绝对值
    const magnitude = Math.floor(value / 2);
    values.push(value % 2 === 1 ? -magnitude : magnitude);
    value = 0;
    shift = 0;
    pending = false;
  }
  if (pending) throw new Error(`不完整的 VLQ：${text}`);
  return values;
}

export function decodeMappings(mappings: string): Segment[][] {
  // 除了生成的列号（每行重新开始），其余的值在整个 mappings 中累加
  let source = 0;
  let originalLine = 0;
  let originalColumn = 0;
  let name = 0;
  return mappings.split(';').map((line) => {
    if (line === '') return [];
    let column = 0;
    return line.split(',').map((text): Segment => {
      const values = decodeVlq(text);
      if (values.length !== 1 && values.length !== 4 && values.length !== 5) throw new Error(`一段应该有 1、4 或 5 个数：${text}`);
      const [dColumn = 0, dSource = 0, dLine = 0, dOriginalColumn = 0, dName = 0] = values;
      column += dColumn;
      if (values.length === 1) return [column];
      source += dSource;
      originalLine += dLine;
      originalColumn += dOriginalColumn;
      if (values.length === 4) return [column, source, originalLine, originalColumn];
      name += dName;
      return [column, source, originalLine, originalColumn, name];
    });
  });
}

export function originalPositionFor(map: SourceMap, line: number, column: number): OriginalPosition | null {
  const segments = decodeMappings(map.mappings)[line - 1];
  if (segments === undefined) return null;
  // 生成的列号不超过 column 的最后一段
  const found = segments.find((segment) => segment[0] === column);
  if (found === undefined || found.length === 1) return null;
  const [, sourceIndex, originalLine, originalColumn, nameIndex] = found;
  const source = map.sources[sourceIndex];
  if (source === undefined) return null;
  const name = nameIndex === undefined ? null : (map.names[nameIndex] ?? null);
  return { source, line: originalLine + 1, column: originalColumn, name };
}
```
:::

:::variant{kind=wrong name=zero-based-line fails=tests reason="返回的行号没有加一：源文件的行号是从 0 开始存的，显示时从 1 开始"}
```ts file=sourcemap.ts
export type SourceMap = { version: 3; sources: string[]; names: string[]; mappings: string };
/** 一段：1、4 或 5 个数（都是绝对值，从 0 开始）：生成的列号、源文件下标、源文件行号、源文件列号、名字下标 */
export type Segment = [number] | [number, number, number, number] | [number, number, number, number, number];
export type OriginalPosition = { source: string; line: number; column: number; name: string | null };

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function decodeVlq(text: string): number[] {
  const values: number[] = [];
  let value = 0;
  let shift = 0;
  let pending = false;
  for (const char of text) {
    const digit = BASE64.indexOf(char);
    if (digit === -1) throw new Error(`不是 Base64 字符：${char}`);
    value += (digit & 31) * 2 ** shift; // 低 5 位是数据，先出现的是低位
    if (digit & 32) {
      // 最高位为 1：这个数还没有结束
      shift += 5;
      pending = true;
      continue;
    }
    // 最低位是符号，其余是绝对值
    const magnitude = Math.floor(value / 2);
    values.push(value % 2 === 1 ? -magnitude : magnitude);
    value = 0;
    shift = 0;
    pending = false;
  }
  if (pending) throw new Error(`不完整的 VLQ：${text}`);
  return values;
}

export function decodeMappings(mappings: string): Segment[][] {
  // 除了生成的列号（每行重新开始），其余的值在整个 mappings 中累加
  let source = 0;
  let originalLine = 0;
  let originalColumn = 0;
  let name = 0;
  return mappings.split(';').map((line) => {
    if (line === '') return [];
    let column = 0;
    return line.split(',').map((text): Segment => {
      const values = decodeVlq(text);
      if (values.length !== 1 && values.length !== 4 && values.length !== 5) throw new Error(`一段应该有 1、4 或 5 个数：${text}`);
      const [dColumn = 0, dSource = 0, dLine = 0, dOriginalColumn = 0, dName = 0] = values;
      column += dColumn;
      if (values.length === 1) return [column];
      source += dSource;
      originalLine += dLine;
      originalColumn += dOriginalColumn;
      if (values.length === 4) return [column, source, originalLine, originalColumn];
      name += dName;
      return [column, source, originalLine, originalColumn, name];
    });
  });
}

export function originalPositionFor(map: SourceMap, line: number, column: number): OriginalPosition | null {
  const segments = decodeMappings(map.mappings)[line - 1];
  if (segments === undefined) return null;
  // 生成的列号不超过 column 的最后一段
  let found: Segment | undefined;
  for (const segment of segments) {
    if (segment[0] > column) break;
    found = segment;
  }
  if (found === undefined || found.length === 1) return null;
  const [, sourceIndex, originalLine, originalColumn, nameIndex] = found;
  const source = map.sources[sourceIndex];
  if (source === undefined) return null;
  const name = nameIndex === undefined ? null : (map.names[nameIndex] ?? null);
  return { source, line: originalLine, column: originalColumn, name };
}
```
:::
