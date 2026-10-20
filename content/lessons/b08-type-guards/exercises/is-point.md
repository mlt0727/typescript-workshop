---
kind: task
title: 筛选合法的坐标点
---
`parsePoints(json)` 解析一段 JSON 文本，返回其中所有合法的点：

- 文本解析结果不是数组时，返回空数组；
- 数组中只保留 `x` 和 `y` 都是数字的对象（可以有其他属性），其他元素丢弃；
- 返回的每个点只包含 `x` 和 `y` 两个属性。

起始代码的 `isPoint` 返回 `boolean`，所以 `filter` 之后 TypeScript 仍然不知道元素是 `Point`。把它改成类型守卫，并确认它检查了承诺的每一项。

:::files{role=starter}
```ts file=points.ts
export type Point = { x: number; y: number };

export function isPoint(value: unknown): boolean {
  return typeof value === 'object' && value !== null;
}

export function parsePoints(json: string): Point[] {
  const data: unknown = JSON.parse(json);
  if (!Array.isArray(data)) {
    return [];
  }
  return data.filter(isPoint).map((p) => ({ x: p.x, y: p.y }));
}
```
:::

:::files{role=solution}
```ts file=points.ts
export type Point = { x: number; y: number };

export function isPoint(value: unknown): value is Point {
  return (
    typeof value === 'object' &&
    value !== null &&
    'x' in value &&
    typeof value.x === 'number' &&
    'y' in value &&
    typeof value.y === 'number'
  );
}

export function parsePoints(json: string): Point[] {
  const data: unknown = JSON.parse(json);
  if (!Array.isArray(data)) {
    return [];
  }
  return data.filter(isPoint).map((p) => ({ x: p.x, y: p.y }));
}
```
:::

:::files{role=tests}
```ts file=points.test.ts
import { describe, expect, test } from 'vitest';
import { isPoint, parsePoints } from './points';

describe('isPoint', () => {
  test('合法的点', () => {
    expect(isPoint({ x: 1, y: 2 })).toBe(true);
    expect(isPoint({ x: 0, y: -3, label: 'A' })).toBe(true);
  });

  test.each([[null], [{ x: 1 }], [{ x: '1', y: 2 }], [[1, 2]], ['1,2'], [{ y: 2, z: 3 }]])('%o 不是点', (value) => {
    expect(isPoint(value)).toBe(false);
  });
});

describe('parsePoints', () => {
  test('只保留合法的点，并且只保留 x 和 y', () => {
    expect(parsePoints('[{ "x": 1, "y": 2, "label": "A" }, { "x": "3" }, null, { "x": 5, "y": 6 }]')).toEqual([
      { x: 1, y: 2 },
      { x: 5, y: 6 },
    ]);
  });

  test('不是数组时返回空数组', () => {
    expect(parsePoints('{ "x": 1, "y": 2 }')).toEqual([]);
    expect(parsePoints('null')).toEqual([]);
  });
});
```
```ts file=points.test-d.ts
import { expectTypeOf } from 'vitest';
import { isPoint, type Point } from './points';

declare const value: unknown;
if (isPoint(value)) {
  expectTypeOf(value).toEqualTypeOf<Point>();
}
```
:::

:::hint{level=1}
返回类型改成 `value is Point`。然后补齐检查：不只是“是对象”，还要有 `x` 和 `y`，并且都是数字。b07 讲过，`'x' in value` 之后就可以读取 `value.x`（类型是 `unknown`）。
:::

:::hint{level=2}
`typeof value === 'object' && value !== null && 'x' in value && typeof value.x === 'number' && 'y' in value && typeof value.y === 'number'`。
:::

:::explanation
返回类型 `value is Point` 告诉 TypeScript：这个函数返回 `true` 时，参数就是 `Point`。于是 `data.filter(isPoint)` 的结果是 `Point[]`，后面的 `map` 里 `p.x`、`p.y` 都是 `number`。

还要注意一个细节：`Array.isArray` 会把 `unknown` 收窄成 `any[]`，元素是 `any`，所以即使守卫写成返回 `boolean`，后面的 `p.x` 也不会报错——`any` 让检查失效了（类型测试会发现守卫没有起作用）。尽快用守卫把 `any` 元素变成具体的类型，是处理这类数据的好习惯。

起始代码的检查只确认了“是对象”。如果只把返回类型改成守卫、不补齐检查，类型检查会通过，但 `{ "x": "3" }` 这样的元素会被当成点留下来——TypeScript 完全相信守卫的实现，测试才能发现这个问题。
:::

:::variant{kind=alt name=record-check}
```ts file=points.ts
export type Point = { x: number; y: number };

function hasNumber(obj: object, key: string): boolean {
  return key in obj && typeof Reflect.get(obj, key) === 'number';
}

export function isPoint(value: unknown): value is Point {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return hasNumber(value, 'x') && hasNumber(value, 'y');
}

export function parsePoints(json: string): Point[] {
  const data: unknown = JSON.parse(json);
  const points: Point[] = [];
  if (Array.isArray(data)) {
    for (const item of data) {
      if (isPoint(item)) points.push({ x: item.x, y: item.y });
    }
  }
  return points;
}
```
:::

:::variant{kind=wrong name=boolean-return fails=types reason="返回类型仍然是 boolean，filter 之后没有收窄"}
```ts file=points.ts
export type Point = { x: number; y: number };

export function isPoint(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'x' in value &&
    typeof value.x === 'number' &&
    'y' in value &&
    typeof value.y === 'number'
  );
}

export function parsePoints(json: string): Point[] {
  const data: unknown = JSON.parse(json);
  if (!Array.isArray(data)) {
    return [];
  }
  return data.filter(isPoint).map((p) => ({ x: p.x, y: p.y }));
}
```
:::

:::variant{kind=wrong name=lying-guard fails=tests reason="守卫只检查了“是对象”，没有检查 x 和 y"}
```ts file=points.ts
export type Point = { x: number; y: number };

export function isPoint(value: unknown): value is Point {
  return typeof value === 'object' && value !== null;
}

export function parsePoints(json: string): Point[] {
  const data: unknown = JSON.parse(json);
  if (!Array.isArray(data)) {
    return [];
  }
  return data.filter(isPoint).map((p) => ({ x: p.x, y: p.y }));
}
```
:::

:::variant{kind=wrong name=keep-extra fails=tests reason="直接返回了原对象，多余的属性被保留"}
```ts file=points.ts
export type Point = { x: number; y: number };

export function isPoint(value: unknown): value is Point {
  return (
    typeof value === 'object' &&
    value !== null &&
    'x' in value &&
    typeof value.x === 'number' &&
    'y' in value &&
    typeof value.y === 'number'
  );
}

export function parsePoints(json: string): Point[] {
  const data: unknown = JSON.parse(json);
  if (!Array.isArray(data)) {
    return [];
  }
  return data.filter(isPoint);
}
```
:::
