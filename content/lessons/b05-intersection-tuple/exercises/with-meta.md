---
kind: task
title: 保存后的草稿
---
草稿的类型是 `Draft`。保存之后，它会多出 `id` 和 `savedAt` 两个属性。

1. 定义并导出 `Saved`：`Draft` 加上 `{ id: number; savedAt: string }`。用交叉类型 `&` 写（用 `interface … extends Draft` 也可以）。
2. 实现 `save(draft, id, now)`：返回一个新的 `Saved` 对象，`savedAt` 的值是参数 `now`。不能修改传入的草稿。

:::files{role=starter}
```ts file=draft.ts
export type Draft = { title: string; body: string };

export function save(draft: Draft, id: number, now: string): Saved {
  return draft;
}
```
:::

:::files{role=solution}
```ts file=draft.ts
export type Draft = { title: string; body: string };

export type Saved = Draft & { id: number; savedAt: string };

export function save(draft: Draft, id: number, now: string): Saved {
  return { ...draft, id: id, savedAt: now };
}
```
:::

:::files{role=tests}
```ts file=draft.test.ts
import { expect, test } from 'vitest';
import { save } from './draft';

test('保存后带有 id 和时间', () => {
  const draft = { title: '你好', body: '第一篇' };
  expect(save(draft, 7, '2026-10-20T08:00:00Z')).toEqual({
    title: '你好',
    body: '第一篇',
    id: 7,
    savedAt: '2026-10-20T08:00:00Z',
  });
});

test('不修改草稿', () => {
  const draft = { title: 'a', body: 'b' };
  const saved = save(draft, 1, 't');
  expect(draft).toEqual({ title: 'a', body: 'b' });
  expect(saved).not.toBe(draft);
});
```
```ts file=draft.test-d.ts
import { expectTypeOf } from 'vitest';
import type { Draft, Saved } from './draft';

expectTypeOf<Saved>().branded.toEqualTypeOf<{ title: string; body: string; id: number; savedAt: string }>();
expectTypeOf<Saved>().toExtend<Draft>();
```
:::

:::hint{level=1}
`export type Saved = Draft & { … };`。返回值要同时拥有草稿的属性和新的两个属性。
:::

:::hint{level=2}
`return { ...draft, id: id, savedAt: now };`：展开复制草稿的属性，再加上新属性。
:::

:::explanation
`Draft & { id: number; savedAt: string }` 表示“草稿的全部属性，再加上 `id` 和 `savedAt`”。`Saved` 仍然可以当作 `Draft` 使用（它拥有 `Draft` 的全部属性）。

`{ ...draft, id, savedAt: now }` 创建了一个新对象，原草稿不变。起始代码先报找不到 `Saved`（TS2304）；定义了 `Saved` 之后如果仍然直接返回 `draft`，缺少两个属性，TypeScript 同样会报错。

类型测试里的 `.branded` 让比较时把交叉类型展开再比较，否则 `A & B` 和写在一起的对象类型会被认为“写法不同”。
:::

:::variant{kind=alt name=interface-extends}
```ts file=draft.ts
export type Draft = { title: string; body: string };

export interface Saved extends Draft {
  id: number;
  savedAt: string;
}

export function save(draft: Draft, id: number, now: string): Saved {
  return { title: draft.title, body: draft.body, id, savedAt: now };
}
```
:::

:::variant{kind=wrong name=union-instead fails=types reason="把 & 写成了 |，联合类型只要求满足其中一边"}
```ts file=draft.ts
export type Draft = { title: string; body: string };

export type Saved = Draft | { id: number; savedAt: string };

export function save(draft: Draft, id: number, now: string): Saved {
  return { ...draft, id: id, savedAt: now };
}
```
:::

:::variant{kind=wrong name=mutate-draft fails=tests reason="用 Object.assign 修改了传入的草稿"}
```ts file=draft.ts
export type Draft = { title: string; body: string };

export type Saved = Draft & { id: number; savedAt: string };

export function save(draft: Draft, id: number, now: string): Saved {
  return Object.assign(draft, { id: id, savedAt: now });
}
```
:::
