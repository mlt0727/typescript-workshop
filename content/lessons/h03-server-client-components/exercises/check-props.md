---
kind: task
title: 检查传给客户端组件的 props
---
在 `serializable.ts` 中实现 `checkProps(props)`：在把 `props` 从服务端组件传给客户端组件之前，找出所有传不过去、或者传过去会变样的值。规则来自 React 文档中的可序列化类型列表和正文中实测的 Next.js 16.4.2：

1. **报告的问题**：`{ path, kind }`。`kind` 是下面四种之一：
   - `'function'`：函数（类本身也是函数）；
   - `'symbol'`：没有用 `Symbol.for` 注册的 symbol（`Symbol.keyFor` 返回 `undefined`）；
   - `'null-prototype'`：原型是 `null` 的对象（例如 `Object.create(null)`）；
   - `'class-instance'`：原型不是 `Object.prototype` 的其他对象，下面第 2、3 条列出的数组、`Set`、`Map` 和内置类型除外。`URL`、`Error`、正则这样的内置类型也算（正文中讲了它们传过去之后的样子）；
2. **继续往里检查**：普通对象（原型是 `Object.prototype`）检查它的每个属性（`Object.entries` 的顺序）；数组检查每个元素；`Set` 按 `[...set]` 的顺序检查每个元素；`Map` 按 `[...map]` 的顺序检查每个条目，先检查键，再检查值。报告了问题的值，不再检查它里面；
3. **不用检查的值**：字符串、数字、bigint、布尔值、`null`、`undefined`、用 `Symbol.for` 注册的 symbol，以及 `Date`、`Promise`、`ArrayBuffer` 和它的各种视图（`Uint8Array`、`DataView` 等，`ArrayBuffer.isView` 为 `true`），这些内置类型不往里检查；
4. **路径**：顶层的属性就是属性名；对象的属性加上 `.名字`，数组和 `Set` 的元素加上 `[i]`，`Map` 的第 i 个条目的键加上 `[i][0]`、值加上 `[i][1]`。例如 `items[1].onClick`、`handlers[0][1]`；
5. 按深度优先的顺序返回**所有**的问题。值中没有循环引用。

:::files{role=starter}
```ts file=serializable.ts
export type ProblemKind = 'function' | 'symbol' | 'class-instance' | 'null-prototype';
export type Problem = Readonly<{ path: string; kind: ProblemKind }>;

/** 检查从服务端组件传给客户端组件的 props，按深度优先的顺序返回所有的问题 */
export function checkProps(props: Readonly<Record<string, unknown>>): Problem[] {
  // TODO
  return [];
}
```
```ts file=main.ts
import { checkProps } from './serializable';

class Money {
  readonly cents: number;
  constructor(cents: number) {
    this.cents = cents;
  }
}

const props = {
  title: '订单',
  createdAt: new Date('2026-10-21T00:00:00Z'),
  lines: [{ sku: 'a1', price: new Money(990) }],
  onSelect: (id: string) => console.log(id),
};

console.log(checkProps(props));
```
:::

:::files{role=solution}
```ts file=serializable.ts
export type ProblemKind = 'function' | 'symbol' | 'class-instance' | 'null-prototype';
export type Problem = Readonly<{ path: string; kind: ProblemKind }>;

/** 可以传过去、不再往里检查的内置类型 */
function isOpaqueBuiltin(value: object): boolean {
  return value instanceof Date || value instanceof Promise || value instanceof ArrayBuffer || ArrayBuffer.isView(value);
}

function check(value: unknown, path: string, problems: Problem[]): void {
  if (typeof value === 'function') {
    problems.push({ path, kind: 'function' });
    return;
  }
  if (typeof value === 'symbol') {
    // 只有用 Symbol.for 注册过的 symbol 才能在另一边找回来
    if (Symbol.keyFor(value) === undefined) problems.push({ path, kind: 'symbol' });
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => check(item, `${path}[${i}]`, problems));
    return;
  }
  if (value instanceof Set) {
    [...value].forEach((item, i) => check(item, `${path}[${i}]`, problems));
    return;
  }
  if (value instanceof Map) {
    [...value].forEach(([key, item], i) => {
      check(key, `${path}[${i}][0]`, problems);
      check(item, `${path}[${i}][1]`, problems);
    });
    return;
  }
  if (isOpaqueBuiltin(value)) return;
  const proto: unknown = Object.getPrototypeOf(value);
  if (proto === null) {
    problems.push({ path, kind: 'null-prototype' });
    return;
  }
  if (proto !== Object.prototype) {
    problems.push({ path, kind: 'class-instance' });
    return;
  }
  for (const [key, item] of Object.entries(value)) check(item, `${path}.${key}`, problems);
}

/** 检查从服务端组件传给客户端组件的 props，按深度优先的顺序返回所有的问题 */
export function checkProps(props: Readonly<Record<string, unknown>>): Problem[] {
  const problems: Problem[] = [];
  for (const [key, value] of Object.entries(props)) check(value, key, problems);
  return problems;
}
```
```ts file=main.ts
import { checkProps } from './serializable';

class Money {
  readonly cents: number;
  constructor(cents: number) {
    this.cents = cents;
  }
}

const props = {
  title: '订单',
  createdAt: new Date('2026-10-21T00:00:00Z'),
  lines: [{ sku: 'a1', price: new Money(990) }],
  onSelect: (id: string) => console.log(id),
};

console.log(checkProps(props));
```
:::

:::files{role=tests}
```ts file=serializable.test.ts
import { describe, expect, test } from 'vitest';
import { checkProps } from './serializable';

class Money {
  readonly cents: number;
  constructor(cents: number) {
    this.cents = cents;
  }
}

describe('checkProps', () => {
  test('可以传过去的值：没有问题', () => {
    expect(
      checkProps({
        title: '标题',
        count: 3,
        big: BigInt(10),
        done: false,
        none: null,
        missing: undefined,
        tag: Symbol.for('lab'),
        when: new Date('2026-10-21T00:00:00Z'),
        items: [{ id: 't1', done: false }],
        tags: new Map([['a', 1]]),
        ids: new Set(['x']),
        bytes: new Uint8Array([1, 2]),
        view: new DataView(new ArrayBuffer(2)),
        ints: new Int32Array([1]),
        floats: new Float64Array([1.5]),
        buffer: new ArrayBuffer(4),
        later: Promise.resolve('ok'),
      }),
    ).toStrictEqual([]);
  });

  test('函数不能传，类本身也是函数', () => {
    expect(checkProps({ onPick: () => {}, Money })).toStrictEqual([
      { path: 'onPick', kind: 'function' },
      { path: 'Money', kind: 'function' },
    ]);
  });

  test('没有用 Symbol.for 注册的 symbol', () => {
    expect(checkProps({ a: Symbol('local'), b: Symbol.for('global') })).toStrictEqual([{ path: 'a', kind: 'symbol' }]);
  });

  test('类的实例、没有原型的对象', () => {
    expect(checkProps({ price: new Money(5), dict: Object.create(null), pattern: /ab+c/, link: new URL('https://example.com/a'), err: new Error('x') })).toStrictEqual([
      { path: 'price', kind: 'class-instance' },
      { path: 'dict', kind: 'null-prototype' },
      { path: 'pattern', kind: 'class-instance' },
      { path: 'link', kind: 'class-instance' },
      { path: 'err', kind: 'class-instance' },
    ]);
  });

  test('报告了一个对象之后，不再检查它里面', () => {
    const withHandler = new (class Widget {
      onClick = () => {};
    })();
    const dict: Record<string, unknown> = Object.create(null);
    dict['fn'] = () => {};
    expect(checkProps({ withHandler, dict })).toStrictEqual([
      { path: 'withHandler', kind: 'class-instance' },
      { path: 'dict', kind: 'null-prototype' },
    ]);
  });

  test('嵌套的对象和数组：路径中的 . 和 [i]', () => {
    expect(checkProps({ user: { name: 'a', format: () => '' }, items: [1, { done: true, onClick: () => {} }] })).toStrictEqual([
      { path: 'user.format', kind: 'function' },
      { path: 'items[1].onClick', kind: 'function' },
    ]);
  });

  test('Map 的每个条目先检查键，再检查值', () => {
    expect(checkProps({ m: new Map<unknown, unknown>([[Symbol('k'), () => 1]]) })).toStrictEqual([
      { path: 'm[0][0]', kind: 'symbol' },
      { path: 'm[0][1]', kind: 'function' },
    ]);
  });

  test('Map 和 Set 里面也要检查', () => {
    const handlers = new Map<unknown, unknown>([
      ['k', () => 1],
      [Symbol('key'), 2],
    ]);
    const set = new Set<unknown>([1, new Money(1)]);
    expect(checkProps({ handlers, set })).toStrictEqual([
      { path: 'handlers[0][1]', kind: 'function' },
      { path: 'handlers[1][0]', kind: 'symbol' },
      { path: 'set[1]', kind: 'class-instance' },
    ]);
  });

  test('按深度优先的顺序报告所有的问题', () => {
    expect(checkProps({ a: { b: [() => 1, { c: Symbol('x') }], d: new Money(1) }, e: () => 2 })).toStrictEqual([
      { path: 'a.b[0]', kind: 'function' },
      { path: 'a.b[1].c', kind: 'symbol' },
      { path: 'a.d', kind: 'class-instance' },
      { path: 'e', kind: 'function' },
    ]);
  });
});
```
:::

:::hint{level=1}
写一个递归的函数 `check(value, path, problems)`，按顺序判断：`typeof value` 是 `'function'`、`'symbol'`；不是对象（或者是 `null`）时直接返回；然后依次是数组、`Set`、`Map`、不用往里检查的内置类型；最后用 `Object.getPrototypeOf(value)` 区分普通对象、没有原型的对象和其他的对象。
:::

:::hint{level=2}
`Set` 和 `Map` 先展开成数组：`[...value].forEach((item, i) => …)`，`Map` 展开之后每一项是 `[key, item]`。普通对象用 `for (const [key, item] of Object.entries(value))`，路径是 `` `${path}.${key}` ``。所有的问题都 `push` 进同一个数组，最后返回它。
:::

:::explanation
props 从服务器到浏览器，要先变成一段数据（RSC Payload）再还原。能还原的只有“数据”：基本类型、普通对象和数组，以及 React 认识的几种内置类型。函数是代码，不是数据；类的实例虽然看起来是数据，但它的方法在原型上，原型不会跟着传过去，另一边得到的只能是一个普通对象，所以 React 直接拒绝。

判断“普通对象”要看原型，而不是 `typeof` 或 `constructor`：`typeof` 对所有的对象都是 `'object'`；`Object.create(null)` 没有 `constructor`，用它判断会把“没有原型”报告成“类的实例”。

TypeScript 的类型在这里帮不上全部的忙：类型描述的是形状，不是原型（b02）。一个 `Money` 的实例可以赋给 `{ cents: number }` 类型的变量，类型检查不会报错，运行时它仍然是 `Money` 的实例。这种检查只能在运行时做，或者交给 Next.js 在构建和渲染时报告。

替代解让每一层返回自己的问题数组，用 `flatMap` 拼起来，不需要一个共享的数组。
:::

:::variant{kind=alt name=flat-map}
```ts file=serializable.ts
export type ProblemKind = 'function' | 'symbol' | 'class-instance' | 'null-prototype';
export type Problem = Readonly<{ path: string; kind: ProblemKind }>;

/** 一个值中所有的问题：每一层返回自己的数组，用 flatMap 拼起来 */
function problemsOf(value: unknown, path: string): Problem[] {
  if (typeof value === 'function') return [{ path, kind: 'function' }];
  if (typeof value === 'symbol') return Symbol.keyFor(value) === undefined ? [{ path, kind: 'symbol' }] : [];
  if (typeof value !== 'object' || value === null) return [];
  if (Array.isArray(value) || value instanceof Set) {
    return [...value].flatMap((item: unknown, i) => problemsOf(item, `${path}[${i}]`));
  }
  if (value instanceof Map) {
    return [...value].flatMap(([key, item]: [unknown, unknown], i) => [...problemsOf(key, `${path}[${i}][0]`), ...problemsOf(item, `${path}[${i}][1]`)]);
  }
  if (value instanceof Date || value instanceof Promise || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return [];
  const proto: unknown = Object.getPrototypeOf(value);
  if (proto === null) return [{ path, kind: 'null-prototype' }];
  if (proto !== Object.prototype) return [{ path, kind: 'class-instance' }];
  return Object.entries(value).flatMap(([key, item]: [string, unknown]) => problemsOf(item, `${path}.${key}`));
}

/** 检查从服务端组件传给客户端组件的 props，按深度优先的顺序返回所有的问题 */
export function checkProps(props: Readonly<Record<string, unknown>>): Problem[] {
  return Object.entries(props).flatMap(([key, value]) => problemsOf(value, key));
}
```
:::

:::variant{kind=wrong name=objects-are-fine fails=tests reason="只检查函数和 symbol：类的实例被当成了普通对象，它的原型在另一边就没有了"}
```ts file=serializable.ts
export type ProblemKind = 'function' | 'symbol' | 'class-instance' | 'null-prototype';
export type Problem = Readonly<{ path: string; kind: ProblemKind }>;

/** 可以传过去、不再往里检查的内置类型 */
function isOpaqueBuiltin(value: object): boolean {
  return value instanceof Date || value instanceof Promise || value instanceof ArrayBuffer || ArrayBuffer.isView(value);
}

function check(value: unknown, path: string, problems: Problem[]): void {
  if (typeof value === 'function') {
    problems.push({ path, kind: 'function' });
    return;
  }
  if (typeof value === 'symbol') {
    // 只有用 Symbol.for 注册过的 symbol 才能在另一边找回来
    if (Symbol.keyFor(value) === undefined) problems.push({ path, kind: 'symbol' });
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => check(item, `${path}[${i}]`, problems));
    return;
  }
  if (value instanceof Set) {
    [...value].forEach((item, i) => check(item, `${path}[${i}]`, problems));
    return;
  }
  if (value instanceof Map) {
    [...value].forEach(([key, item], i) => {
      check(key, `${path}[${i}][0]`, problems);
      check(item, `${path}[${i}][1]`, problems);
    });
    return;
  }
  if (isOpaqueBuiltin(value)) return;
  for (const [key, item] of Object.entries(value)) check(item, `${path}.${key}`, problems);
}

/** 检查从服务端组件传给客户端组件的 props，按深度优先的顺序返回所有的问题 */
export function checkProps(props: Readonly<Record<string, unknown>>): Problem[] {
  const problems: Problem[] = [];
  for (const [key, value] of Object.entries(props)) check(value, key, problems);
  return problems;
}
```
:::

:::variant{kind=wrong name=constructor-check fails=tests reason="用 constructor 判断普通对象：没有原型的对象被报告成了类的实例"}
```ts file=serializable.ts
export type ProblemKind = 'function' | 'symbol' | 'class-instance' | 'null-prototype';
export type Problem = Readonly<{ path: string; kind: ProblemKind }>;

/** 可以传过去、不再往里检查的内置类型 */
function isOpaqueBuiltin(value: object): boolean {
  return value instanceof Date || value instanceof Promise || value instanceof ArrayBuffer || ArrayBuffer.isView(value);
}

function check(value: unknown, path: string, problems: Problem[]): void {
  if (typeof value === 'function') {
    problems.push({ path, kind: 'function' });
    return;
  }
  if (typeof value === 'symbol') {
    // 只有用 Symbol.for 注册过的 symbol 才能在另一边找回来
    if (Symbol.keyFor(value) === undefined) problems.push({ path, kind: 'symbol' });
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => check(item, `${path}[${i}]`, problems));
    return;
  }
  if (value instanceof Set) {
    [...value].forEach((item, i) => check(item, `${path}[${i}]`, problems));
    return;
  }
  if (value instanceof Map) {
    [...value].forEach(([key, item], i) => {
      check(key, `${path}[${i}][0]`, problems);
      check(item, `${path}[${i}][1]`, problems);
    });
    return;
  }
  if (isOpaqueBuiltin(value)) return;
  if (value.constructor !== Object) {
    problems.push({ path, kind: 'class-instance' });
    return;
  }
  for (const [key, item] of Object.entries(value)) check(item, `${path}.${key}`, problems);
}

/** 检查从服务端组件传给客户端组件的 props，按深度优先的顺序返回所有的问题 */
export function checkProps(props: Readonly<Record<string, unknown>>): Problem[] {
  const problems: Problem[] = [];
  for (const [key, value] of Object.entries(props)) check(value, key, problems);
  return problems;
}
```
:::

:::variant{kind=wrong name=all-symbols fails=tests reason="所有的 symbol 都报告：用 Symbol.for 注册的 symbol 可以传过去"}
```ts file=serializable.ts
export type ProblemKind = 'function' | 'symbol' | 'class-instance' | 'null-prototype';
export type Problem = Readonly<{ path: string; kind: ProblemKind }>;

/** 可以传过去、不再往里检查的内置类型 */
function isOpaqueBuiltin(value: object): boolean {
  return value instanceof Date || value instanceof Promise || value instanceof ArrayBuffer || ArrayBuffer.isView(value);
}

function check(value: unknown, path: string, problems: Problem[]): void {
  if (typeof value === 'function') {
    problems.push({ path, kind: 'function' });
    return;
  }
  if (typeof value === 'symbol') {
    // 只有用 Symbol.for 注册过的 symbol 才能在另一边找回来
    problems.push({ path, kind: 'symbol' });
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => check(item, `${path}[${i}]`, problems));
    return;
  }
  if (value instanceof Set) {
    [...value].forEach((item, i) => check(item, `${path}[${i}]`, problems));
    return;
  }
  if (value instanceof Map) {
    [...value].forEach(([key, item], i) => {
      check(key, `${path}[${i}][0]`, problems);
      check(item, `${path}[${i}][1]`, problems);
    });
    return;
  }
  if (isOpaqueBuiltin(value)) return;
  const proto: unknown = Object.getPrototypeOf(value);
  if (proto === null) {
    problems.push({ path, kind: 'null-prototype' });
    return;
  }
  if (proto !== Object.prototype) {
    problems.push({ path, kind: 'class-instance' });
    return;
  }
  for (const [key, item] of Object.entries(value)) check(item, `${path}.${key}`, problems);
}

/** 检查从服务端组件传给客户端组件的 props，按深度优先的顺序返回所有的问题 */
export function checkProps(props: Readonly<Record<string, unknown>>): Problem[] {
  const problems: Problem[] = [];
  for (const [key, value] of Object.entries(props)) check(value, key, problems);
  return problems;
}
```
:::

:::variant{kind=wrong name=skip-collections fails=tests reason="没有检查 Map 和 Set 里面的值：里面的函数照样会让渲染失败"}
```ts file=serializable.ts
export type ProblemKind = 'function' | 'symbol' | 'class-instance' | 'null-prototype';
export type Problem = Readonly<{ path: string; kind: ProblemKind }>;

/** 可以传过去、不再往里检查的内置类型 */
function isOpaqueBuiltin(value: object): boolean {
  return value instanceof Date || value instanceof Promise || value instanceof ArrayBuffer || ArrayBuffer.isView(value);
}

function check(value: unknown, path: string, problems: Problem[]): void {
  if (typeof value === 'function') {
    problems.push({ path, kind: 'function' });
    return;
  }
  if (typeof value === 'symbol') {
    // 只有用 Symbol.for 注册过的 symbol 才能在另一边找回来
    if (Symbol.keyFor(value) === undefined) problems.push({ path, kind: 'symbol' });
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => check(item, `${path}[${i}]`, problems));
    return;
  }
  if (value instanceof Set) return;
  if (value instanceof Map) return;
  if (isOpaqueBuiltin(value)) return;
  const proto: unknown = Object.getPrototypeOf(value);
  if (proto === null) {
    problems.push({ path, kind: 'null-prototype' });
    return;
  }
  if (proto !== Object.prototype) {
    problems.push({ path, kind: 'class-instance' });
    return;
  }
  for (const [key, item] of Object.entries(value)) check(item, `${path}.${key}`, problems);
}

/** 检查从服务端组件传给客户端组件的 props，按深度优先的顺序返回所有的问题 */
export function checkProps(props: Readonly<Record<string, unknown>>): Problem[] {
  const problems: Problem[] = [];
  for (const [key, value] of Object.entries(props)) check(value, key, problems);
  return problems;
}
```
:::

:::variant{kind=wrong name=date-not-allowed fails=tests reason="忘了 Date：Date 可以传过去，另一边收到的仍然是 Date"}
```ts file=serializable.ts
export type ProblemKind = 'function' | 'symbol' | 'class-instance' | 'null-prototype';
export type Problem = Readonly<{ path: string; kind: ProblemKind }>;

/** 可以传过去、不再往里检查的内置类型 */
function isOpaqueBuiltin(value: object): boolean {
  return value instanceof Promise || value instanceof ArrayBuffer || ArrayBuffer.isView(value);
}

function check(value: unknown, path: string, problems: Problem[]): void {
  if (typeof value === 'function') {
    problems.push({ path, kind: 'function' });
    return;
  }
  if (typeof value === 'symbol') {
    // 只有用 Symbol.for 注册过的 symbol 才能在另一边找回来
    if (Symbol.keyFor(value) === undefined) problems.push({ path, kind: 'symbol' });
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => check(item, `${path}[${i}]`, problems));
    return;
  }
  if (value instanceof Set) {
    [...value].forEach((item, i) => check(item, `${path}[${i}]`, problems));
    return;
  }
  if (value instanceof Map) {
    [...value].forEach(([key, item], i) => {
      check(key, `${path}[${i}][0]`, problems);
      check(item, `${path}[${i}][1]`, problems);
    });
    return;
  }
  if (isOpaqueBuiltin(value)) return;
  const proto: unknown = Object.getPrototypeOf(value);
  if (proto === null) {
    problems.push({ path, kind: 'null-prototype' });
    return;
  }
  if (proto !== Object.prototype) {
    problems.push({ path, kind: 'class-instance' });
    return;
  }
  for (const [key, item] of Object.entries(value)) check(item, `${path}.${key}`, problems);
}

/** 检查从服务端组件传给客户端组件的 props，按深度优先的顺序返回所有的问题 */
export function checkProps(props: Readonly<Record<string, unknown>>): Problem[] {
  const problems: Problem[] = [];
  for (const [key, value] of Object.entries(props)) check(value, key, problems);
  return problems;
}
```
:::

:::variant{kind=wrong name=error-allowed fails=tests reason="把 Error 当作可以直接传的值：浏览器中收到的 Error 已经没有原来的信息了"}
```ts file=serializable.ts
export type ProblemKind = 'function' | 'symbol' | 'class-instance' | 'null-prototype';
export type Problem = Readonly<{ path: string; kind: ProblemKind }>;

/** 可以传过去、不再往里检查的内置类型 */
function isOpaqueBuiltin(value: object): boolean {
  return value instanceof Error || value instanceof Date || value instanceof Promise || value instanceof ArrayBuffer || ArrayBuffer.isView(value);
}

function check(value: unknown, path: string, problems: Problem[]): void {
  if (typeof value === 'function') {
    problems.push({ path, kind: 'function' });
    return;
  }
  if (typeof value === 'symbol') {
    // 只有用 Symbol.for 注册过的 symbol 才能在另一边找回来
    if (Symbol.keyFor(value) === undefined) problems.push({ path, kind: 'symbol' });
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => check(item, `${path}[${i}]`, problems));
    return;
  }
  if (value instanceof Set) {
    [...value].forEach((item, i) => check(item, `${path}[${i}]`, problems));
    return;
  }
  if (value instanceof Map) {
    [...value].forEach(([key, item], i) => {
      check(key, `${path}[${i}][0]`, problems);
      check(item, `${path}[${i}][1]`, problems);
    });
    return;
  }
  if (isOpaqueBuiltin(value)) return;
  const proto: unknown = Object.getPrototypeOf(value);
  if (proto === null) {
    problems.push({ path, kind: 'null-prototype' });
    return;
  }
  if (proto !== Object.prototype) {
    problems.push({ path, kind: 'class-instance' });
    return;
  }
  for (const [key, item] of Object.entries(value)) check(item, `${path}.${key}`, problems);
}

/** 检查从服务端组件传给客户端组件的 props，按深度优先的顺序返回所有的问题 */
export function checkProps(props: Readonly<Record<string, unknown>>): Problem[] {
  const problems: Problem[] = [];
  for (const [key, value] of Object.entries(props)) check(value, key, problems);
  return problems;
}
```
:::

:::variant{kind=wrong name=stop-at-first fails=tests reason="只报告第一个问题：要一个一个地修、一次一次地构建"}
```ts file=serializable.ts
export type ProblemKind = 'function' | 'symbol' | 'class-instance' | 'null-prototype';
export type Problem = Readonly<{ path: string; kind: ProblemKind }>;

/** 可以传过去、不再往里检查的内置类型 */
function isOpaqueBuiltin(value: object): boolean {
  return value instanceof Date || value instanceof Promise || value instanceof ArrayBuffer || ArrayBuffer.isView(value);
}

function check(value: unknown, path: string, problems: Problem[]): void {
  if (typeof value === 'function') {
    problems.push({ path, kind: 'function' });
    return;
  }
  if (typeof value === 'symbol') {
    // 只有用 Symbol.for 注册过的 symbol 才能在另一边找回来
    if (Symbol.keyFor(value) === undefined) problems.push({ path, kind: 'symbol' });
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => check(item, `${path}[${i}]`, problems));
    return;
  }
  if (value instanceof Set) {
    [...value].forEach((item, i) => check(item, `${path}[${i}]`, problems));
    return;
  }
  if (value instanceof Map) {
    [...value].forEach(([key, item], i) => {
      check(key, `${path}[${i}][0]`, problems);
      check(item, `${path}[${i}][1]`, problems);
    });
    return;
  }
  if (isOpaqueBuiltin(value)) return;
  const proto: unknown = Object.getPrototypeOf(value);
  if (proto === null) {
    problems.push({ path, kind: 'null-prototype' });
    return;
  }
  if (proto !== Object.prototype) {
    problems.push({ path, kind: 'class-instance' });
    return;
  }
  for (const [key, item] of Object.entries(value)) check(item, `${path}.${key}`, problems);
}

/** 检查从服务端组件传给客户端组件的 props，按深度优先的顺序返回所有的问题 */
export function checkProps(props: Readonly<Record<string, unknown>>): Problem[] {
  const problems: Problem[] = [];
  for (const [key, value] of Object.entries(props)) check(value, key, problems);
  return problems.slice(0, 1);
}
```
:::

