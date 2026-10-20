---
kind: challenge
title: 图形的草稿与统计
---
`shapes.ts` 中有两种图形组成的可辨识联合 `Shape`。完成：

1. **`DistributiveOmit<T, K>`**：对联合 `T` 的**每个成员**分别去掉键 `K`；
2. **`ShapeDraft`**：新建图形时传入的数据，即每种图形去掉 `id`。`{ kind: 'circle', radius: 2 }` 必须能通过检查，`{ kind: 'circle', width: 2 }` 和带 `id` 的对象必须报错；
3. **`ShapeKind`**：所有图形的 `kind` 组成的联合（从 `Shape` 推导）；**`KindCounts`**：每种 `kind` 都**必须**有一个数字的对象；
4. **`addShape(shapes, draft, nextId)`**：返回在末尾加上新图形的新数组，新图形的 `id` 是 `'s' + nextId`；不修改传入的数组；
5. **`countByKind(shapes)`**：每种图形的个数，没有的种类也要是 `0`；
6. **`area(shape)`**：圆的面积 `Math.PI * radius ** 2`，矩形 `width * height`。

不能使用类型断言。

:::files{role=starter}
```ts file=shapes.ts
export type Circle = { id: string; kind: 'circle'; radius: number };
export type Rect = { id: string; kind: 'rect'; width: number; height: number };
export type Shape = Circle | Rect;

export type DistributiveOmit<T, K extends PropertyKey> = Omit<T, K>;
export type ShapeDraft = Omit<Shape, 'id'>;
export type ShapeKind = string;
export type KindCounts = Partial<Record<ShapeKind, number>>;

export function addShape(shapes: readonly Shape[], draft: ShapeDraft, nextId: number): Shape[] {
  return [...shapes];
}

export function countByKind(shapes: readonly Shape[]): KindCounts {
  return {};
}

export function area(shape: Shape): number {
  return 0;
}
```
```ts file=main.ts
import { addShape, area, countByKind, type Shape } from './shapes';

let shapes: Shape[] = [];
shapes = addShape(shapes, { kind: 'circle', radius: 1 }, 1);
shapes = addShape(shapes, { kind: 'rect', width: 2, height: 3 }, 2);
console.log(shapes, countByKind(shapes), shapes.map(area));
```
:::

:::files{role=solution}
```ts file=shapes.ts
export type Circle = { id: string; kind: 'circle'; radius: number };
export type Rect = { id: string; kind: 'rect'; width: number; height: number };
export type Shape = Circle | Rect;

export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type ShapeDraft = DistributiveOmit<Shape, 'id'>;
export type ShapeKind = Shape['kind'];
export type KindCounts = Record<ShapeKind, number>;

export function addShape(shapes: readonly Shape[], draft: ShapeDraft, nextId: number): Shape[] {
  const shape: Shape = { ...draft, id: `s${nextId}` };
  return [...shapes, shape];
}

export function countByKind(shapes: readonly Shape[]): KindCounts {
  const counts: KindCounts = { circle: 0, rect: 0 };
  for (const shape of shapes) counts[shape.kind] += 1;
  return counts;
}

export function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2;
    case 'rect':
      return shape.width * shape.height;
  }
}
```
```ts file=main.ts
import { addShape, area, countByKind, type Shape } from './shapes';

let shapes: Shape[] = [];
shapes = addShape(shapes, { kind: 'circle', radius: 1 }, 1);
shapes = addShape(shapes, { kind: 'rect', width: 2, height: 3 }, 2);
console.log(shapes, countByKind(shapes), shapes.map(area));
```
:::

:::files{role=tests}
```ts file=shapes.test.ts
import { describe, expect, test } from 'vitest';
import { addShape, area, countByKind, type Shape } from './shapes';

const sample: Shape[] = [
  { id: 's1', kind: 'rect', width: 2, height: 3 },
  { id: 's2', kind: 'rect', width: 1, height: 1 },
];

describe('addShape', () => {
  test('在末尾加上新图形，id 来自 nextId', () => {
    const next = addShape(sample, { kind: 'circle', radius: 2 }, 3);
    expect(next.at(-1)).toEqual({ id: 's3', kind: 'circle', radius: 2 });
    expect(next).toHaveLength(3);
    expect(sample).toHaveLength(2);
  });
});

describe('countByKind', () => {
  test('每种图形的个数，没有的种类是 0', () => {
    expect(countByKind(sample)).toEqual({ circle: 0, rect: 2 });
    expect(countByKind([])).toEqual({ circle: 0, rect: 0 });
  });
});

describe('area', () => {
  test('圆与矩形', () => {
    expect(area({ id: 'a', kind: 'circle', radius: 2 })).toBeCloseTo(12.566, 3);
    expect(area({ id: 'b', kind: 'rect', width: 2, height: 3 })).toBe(6);
  });
});
```
```ts file=shapes.test-d.ts
import { expectTypeOf } from 'vitest';
import type { KindCounts, ShapeDraft, ShapeKind } from './shapes';

expectTypeOf<ShapeKind>().toEqualTypeOf<'circle' | 'rect'>();
expectTypeOf<KindCounts>().toEqualTypeOf<{ circle: number; rect: number }>();

const circle: ShapeDraft = { kind: 'circle', radius: 2 };
const rect: ShapeDraft = { kind: 'rect', width: 2, height: 3 };
// @ts-expect-error 圆没有 width
const wrongField: ShapeDraft = { kind: 'circle', width: 2 };
// @ts-expect-error 草稿中不能有 id
const withId: ShapeDraft = { id: 's1', kind: 'circle', radius: 2 };
// @ts-expect-error 矩形缺少 height
const incomplete: ShapeDraft = { kind: 'rect', width: 2 };
// @ts-expect-error 每种 kind 都必须有计数
const partial: KindCounts = { circle: 1 };
console.log(circle, rect, wrongField, withId, incomplete, partial);
```
:::

:::hint{level=1}
`DistributiveOmit` 用 c04 的分布：`T extends unknown ? Omit<T, K> : never`。`ShapeKind` 是 `Shape['kind']`；`KindCounts` 是 `Record<ShapeKind, number>`，不要 `Partial`。
:::

:::hint{level=2}
`addShape`：``const shape: Shape = { ...draft, id: `s${nextId}` }``。`draft` 是“去掉了 id 的圆”或“去掉了 id 的矩形”，加回 `id` 之后正好是 `Shape` 的某个成员。`countByKind` 从 `{ circle: 0, rect: 0 }` 开始，遍历时 `counts[shape.kind] += 1`。`area` 用 `switch (shape.kind)`，每个分支中 `shape` 被收窄成对应的图形。
:::

:::explanation
起始代码中的 `Omit<Shape, 'id'>` 只剩下 `{ kind: 'circle' | 'rect' }`：`keyof (Circle | Rect)` 只包含两种图形共有的键，`radius`、`width`、`height` 都没了。于是 `{ kind: 'circle', radius: 2 }` 反而因为“多了 `radius`”而报错。`DistributiveOmit` 借助分布，对每种图形分别去掉 `id`，结果仍然是一个可辨识联合，`kind` 和各自的字段保持配对。

`KindCounts` 用 `Record<ShapeKind, number>` 而不是 `Partial<…>`：每种图形都必须有计数，`countByKind` 返回值的每个键都可以直接使用，不需要判断 `undefined`。以后加一种图形 `Triangle`，`ShapeKind` 自动多出 `'triangle'`，`countByKind` 中的初始值 `{ circle: 0, rect: 0 }` 立刻报错（缺少 `triangle`），`area` 的 `switch` 也会因为没有处理新的成员而报错（返回值可能是 `undefined`）。工具类型和可辨识联合配合，让“加一种情况”时编译器指出所有要改的地方。
:::

:::variant{kind=alt name=map-and-reduce}
```ts file=shapes.ts
export type Circle = { id: string; kind: 'circle'; radius: number };
export type Rect = { id: string; kind: 'rect'; width: number; height: number };
export type Shape = Circle | Rect;

export type DistributiveOmit<T, K extends PropertyKey> = T extends T ? Pick<T, Exclude<keyof T, K>> : never;
export type ShapeDraft = DistributiveOmit<Shape, 'id'>;
export type ShapeKind = Shape extends infer S ? (S extends { kind: infer K } ? K : never) : never;
export type KindCounts = { [K in ShapeKind]: number };

export function addShape(shapes: readonly Shape[], draft: ShapeDraft, nextId: number): Shape[] {
  return shapes.concat({ ...draft, id: 's' + nextId });
}

export function countByKind(shapes: readonly Shape[]): KindCounts {
  return shapes.reduce<KindCounts>((counts, shape) => ({ ...counts, [shape.kind]: counts[shape.kind] + 1 }), { circle: 0, rect: 0 });
}

export function area(shape: Shape): number {
  if (shape.kind === 'circle') return Math.PI * shape.radius * shape.radius;
  return shape.width * shape.height;
}
```
:::

:::variant{kind=wrong name=plain-omit fails=types reason="直接对联合用 Omit，各种图形独有的字段都丢了"}
```ts file=shapes.ts
export type Circle = { id: string; kind: 'circle'; radius: number };
export type Rect = { id: string; kind: 'rect'; width: number; height: number };
export type Shape = Circle | Rect;

export type DistributiveOmit<T, K extends PropertyKey> = Omit<T, K>;
export type ShapeDraft = DistributiveOmit<Shape, 'id'>;
export type ShapeKind = Shape['kind'];
export type KindCounts = Record<ShapeKind, number>;

export function addShape(shapes: readonly Shape[], draft: ShapeDraft, nextId: number): Shape[] {
  if (draft.kind === 'circle') return [...shapes, { kind: 'circle', radius: 0, id: `s${nextId}` }];
  return [...shapes, { kind: 'rect', width: 0, height: 0, id: `s${nextId}` }];
}

export function countByKind(shapes: readonly Shape[]): KindCounts {
  const counts: KindCounts = { circle: 0, rect: 0 };
  for (const shape of shapes) counts[shape.kind] += 1;
  return counts;
}

export function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2;
    case 'rect':
      return shape.width * shape.height;
  }
}
```
:::

:::variant{kind=wrong name=assign-not-increment fails=tests reason="计数时写成了赋值 1，而不是加 1"}
```ts file=shapes.ts
export type Circle = { id: string; kind: 'circle'; radius: number };
export type Rect = { id: string; kind: 'rect'; width: number; height: number };
export type Shape = Circle | Rect;

export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type ShapeDraft = DistributiveOmit<Shape, 'id'>;
export type ShapeKind = Shape['kind'];
export type KindCounts = Record<ShapeKind, number>;

export function addShape(shapes: readonly Shape[], draft: ShapeDraft, nextId: number): Shape[] {
  const shape: Shape = { ...draft, id: `s${nextId}` };
  return [...shapes, shape];
}

export function countByKind(shapes: readonly Shape[]): KindCounts {
  const counts: KindCounts = { circle: 0, rect: 0 };
  for (const shape of shapes) counts[shape.kind] = 1;
  return counts;
}

export function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2;
    case 'rect':
      return shape.width * shape.height;
  }
}
```
:::

:::variant{kind=wrong name=optional-counts fails=types reason="KindCounts 用了 Partial，调用方得到的每个计数都可能是 undefined"}
```ts file=shapes.ts
export type Circle = { id: string; kind: 'circle'; radius: number };
export type Rect = { id: string; kind: 'rect'; width: number; height: number };
export type Shape = Circle | Rect;

export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type ShapeDraft = DistributiveOmit<Shape, 'id'>;
export type ShapeKind = Shape['kind'];
export type KindCounts = Partial<Record<ShapeKind, number>>;

export function addShape(shapes: readonly Shape[], draft: ShapeDraft, nextId: number): Shape[] {
  const shape: Shape = { ...draft, id: `s${nextId}` };
  return [...shapes, shape];
}

export function countByKind(shapes: readonly Shape[]): KindCounts {
  const counts: KindCounts = { circle: 0, rect: 0 };
  for (const shape of shapes) counts[shape.kind] = (counts[shape.kind] ?? 0) + 1;
  return counts;
}

export function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2;
    case 'rect':
      return shape.width * shape.height;
  }
}
```
:::

:::variant{kind=wrong name=mutates-array fails=tests reason="addShape 修改了传入的数组"}
```ts file=shapes.ts
export type Circle = { id: string; kind: 'circle'; radius: number };
export type Rect = { id: string; kind: 'rect'; width: number; height: number };
export type Shape = Circle | Rect;

export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type ShapeDraft = DistributiveOmit<Shape, 'id'>;
export type ShapeKind = Shape['kind'];
export type KindCounts = Record<ShapeKind, number>;

export function addShape(shapes: Shape[], draft: ShapeDraft, nextId: number): Shape[] {
  shapes.push({ ...draft, id: `s${nextId}` });
  return shapes;
}

export function countByKind(shapes: readonly Shape[]): KindCounts {
  const counts: KindCounts = { circle: 0, rect: 0 };
  for (const shape of shapes) counts[shape.kind] += 1;
  return counts;
}

export function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2;
    case 'rect':
      return shape.width * shape.height;
  }
}
```
:::
