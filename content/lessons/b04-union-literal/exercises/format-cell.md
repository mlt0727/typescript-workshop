---
kind: challenge
title: 表格单元格
---
表格的单元格可能是字符串、数字、布尔值或 `null`（空）。定义并导出两个类型，再实现 `formatCell(value)`：

- `CellValue`：`string | number | boolean | null`；
- `Align`：`'left' | 'right' | 'center'`；
- `formatCell(value)` 返回 `{ text: string; align: Align }`：

| 值 | text | align |
| --- | --- | --- |
| 字符串 | 去掉首尾空格后的字符串 | `'left'` |
| 数字 | `String(value)`；`NaN` 显示为 `'—'` | `'right'` |
| `true` / `false` | `'是'` / `'否'` | `'center'` |
| `null` | `'—'` | `'center'` |

另外实现 `formatRow(values)`：把一行单元格的 `text` 用 `' | '` 连接起来，例如 `formatRow(['Ada', 36, true])` 得到 `'Ada | 36 | 是'`。

:::files{role=starter}
```ts file=cell.ts
export function formatCell(value) {
  const result = { text: String(value), align: 'left' };
  return result;
}

export function formatRow(values) {
  return values.map(formatCell).join(' | ');
}
```
:::

:::files{role=solution}
```ts file=cell.ts
export type CellValue = string | number | boolean | null;
export type Align = 'left' | 'right' | 'center';

export function formatCell(value: CellValue): { text: string; align: Align } {
  if (value === null) {
    return { text: '—', align: 'center' };
  }
  if (typeof value === 'boolean') {
    return { text: value ? '是' : '否', align: 'center' };
  }
  if (typeof value === 'number') {
    return { text: Number.isNaN(value) ? '—' : String(value), align: 'right' };
  }
  return { text: value.trim(), align: 'left' };
}

export function formatRow(values: readonly CellValue[]): string {
  return values.map((value) => formatCell(value).text).join(' | ');
}
```
:::

:::files{role=tests}
```ts file=cell.test.ts
import { describe, expect, test } from 'vitest';
import { formatCell, formatRow } from './cell';

describe('formatCell', () => {
  test('字符串', () => {
    expect(formatCell('  Ada ')).toEqual({ text: 'Ada', align: 'left' });
    expect(formatCell('')).toEqual({ text: '', align: 'left' });
  });

  test('数字', () => {
    expect(formatCell(36)).toEqual({ text: '36', align: 'right' });
    expect(formatCell(0)).toEqual({ text: '0', align: 'right' });
    expect(formatCell(-1.5)).toEqual({ text: '-1.5', align: 'right' });
    expect(formatCell(Number.NaN)).toEqual({ text: '—', align: 'right' });
  });

  test('布尔值', () => {
    expect(formatCell(true)).toEqual({ text: '是', align: 'center' });
    expect(formatCell(false)).toEqual({ text: '否', align: 'center' });
  });

  test('空值', () => {
    expect(formatCell(null)).toEqual({ text: '—', align: 'center' });
  });
});

describe('formatRow', () => {
  test('连接一行', () => {
    expect(formatRow(['Ada', 36, true])).toBe('Ada | 36 | 是');
    expect(formatRow([null, ' x ', 0, false])).toBe('— | x | 0 | 否');
    expect(formatRow([])).toBe('');
  });
});
```
```ts file=cell.test-d.ts
import { expectTypeOf } from 'vitest';
import { formatCell, formatRow, type Align, type CellValue } from './cell';

expectTypeOf<CellValue>().toEqualTypeOf<string | number | boolean | null>();
expectTypeOf<Align>().toEqualTypeOf<'left' | 'right' | 'center'>();
expectTypeOf(formatCell).returns.toEqualTypeOf<{ text: string; align: Align }>();
expectTypeOf(formatRow).toBeCallableWith(['a', 1, true, null]);

// @ts-expect-error undefined 不是合法的单元格
formatCell(undefined);
```
:::

:::hint{level=1}
先写出两个类型和函数签名。函数体里按类型逐个收窄：`value === null`、`typeof value === 'boolean'`、`typeof value === 'number'`，最后剩下的就是字符串。
:::

:::hint{level=2}
每个分支直接 `return { text: …, align: 'center' }`：对象字面量直接出现在声明了返回类型的 `return` 中，`'center'` 会按 `Align` 检查，不会被拓宽成 `string`。如果先写 `const result = { text, align: 'left' }` 再返回，`align` 已经被拓宽成 `string`，就会报错——除非给 `result` 写上类型注解。
:::

:::explanation
`CellValue` 是四种类型的联合，函数用 `=== null` 和 `typeof` 依次收窄，每个分支里 `value` 的类型都是确定的：`toFixed`、`trim` 这类方法只在对应的分支里可用。

起始代码的 `const result = { text: …, align: 'left' }` 有一个典型问题：对象属性会被拓宽成 `string`，`result` 的类型是 `{ text: string; align: string }`，不能作为 `{ text: string; align: Align }` 返回。直接在 `return` 语句中写对象字面量，或者给变量写上类型注解，都能让 TypeScript 按 `Align` 检查它。

`formatRow` 的参数用了 `readonly CellValue[]`：函数不需要修改数组，只读类型同时能接收普通数组和只读数组。
:::

:::variant{kind=alt name=annotated-result}
```ts file=cell.ts
export type CellValue = string | number | boolean | null;
export type Align = 'left' | 'right' | 'center';

type Cell = { text: string; align: Align };

export function formatCell(value: CellValue): Cell {
  let cell: Cell;
  switch (typeof value) {
    case 'string':
      cell = { text: value.trim(), align: 'left' };
      break;
    case 'number':
      cell = { text: Number.isNaN(value) ? '—' : `${value}`, align: 'right' };
      break;
    case 'boolean':
      cell = { text: value ? '是' : '否', align: 'center' };
      break;
    default:
      cell = { text: '—', align: 'center' };
  }
  return cell;
}

export function formatRow(values: CellValue[]): string {
  const texts: string[] = [];
  for (const v of values) texts.push(formatCell(v).text);
  return texts.join(' | ');
}
```
:::

:::variant{kind=wrong name=widened-align fails=types reason="先把结果放进没有注解的变量，align 被拓宽成 string"}
```ts file=cell.ts
export type CellValue = string | number | boolean | null;
export type Align = 'left' | 'right' | 'center';

export function formatCell(value: CellValue): { text: string; align: Align } {
  const result = { text: '—', align: 'center' };
  if (typeof value === 'string') {
    result.text = value.trim();
    result.align = 'left';
  } else if (typeof value === 'number') {
    result.text = Number.isNaN(value) ? '—' : String(value);
    result.align = 'right';
  } else if (typeof value === 'boolean') {
    result.text = value ? '是' : '否';
  }
  return result;
}

export function formatRow(values: readonly CellValue[]): string {
  return values.map((value) => formatCell(value).text).join(' | ');
}
```
:::

:::variant{kind=wrong name=truthy-bool fails=tests reason="用真假检查区分类型，空字符串和 0 被当成了 false"}
```ts file=cell.ts
export type CellValue = string | number | boolean | null;
export type Align = 'left' | 'right' | 'center';

export function formatCell(value: CellValue): { text: string; align: Align } {
  if (value === null) return { text: '—', align: 'center' };
  if (!value || value === true) return { text: value ? '是' : '否', align: 'center' };
  if (typeof value === 'number') return { text: Number.isNaN(value) ? '—' : String(value), align: 'right' };
  return { text: value.trim(), align: 'left' };
}

export function formatRow(values: readonly CellValue[]): string {
  return values.map((value) => formatCell(value).text).join(' | ');
}
```
:::

:::variant{kind=wrong name=nan-as-text fails=tests reason="没有特殊处理 NaN"}
```ts file=cell.ts
export type CellValue = string | number | boolean | null;
export type Align = 'left' | 'right' | 'center';

export function formatCell(value: CellValue): { text: string; align: Align } {
  if (value === null) return { text: '—', align: 'center' };
  if (typeof value === 'boolean') return { text: value ? '是' : '否', align: 'center' };
  if (typeof value === 'number') return { text: String(value), align: 'right' };
  return { text: value.trim(), align: 'left' };
}

export function formatRow(values: readonly CellValue[]): string {
  return values.map((value) => formatCell(value).text).join(' | ');
}
```
:::
