---
kind: challenge
title: 泛型的 LRU 缓存
---
实现一个“最近最少使用”（LRU）缓存类 `LruCache<K, V>`：容量满了以后，再放入新的项，就淘汰最久没有被使用的那一项。

**类型**：类型参数有默认值 `K = string`、`V = unknown`。构造参数是 `{ maxSize: number; onEvict?: (key: K, value: V) => void }`，提供了 `onEvict` 时，`K`、`V` 可以从它的参数类型推断出来。不能使用 `any` 和类型断言。

**行为**：

1. `maxSize` 必须是正整数，否则构造时抛出 `RangeError`；
2. `set(key, value)`：放入或更新；这一项成为“最近使用的”。放入后项数超过 `maxSize` 时，淘汰最久没有使用的一项，并调用 `onEvict(被淘汰的键, 值)`。返回 `this`，可以链式调用；
3. `get(key)`：返回值，没有时返回 `undefined`；**取到的项成为最近使用的**；
4. `has(key)`：是否存在，**不**改变使用顺序；`delete(key)`：删除并返回是否删除了，不调用 `onEvict`；`size`：当前的项数（只读属性）；
5. `keys()`：所有的键，从最久没有使用的到最近使用的；
6. 值本身可以是 `undefined`（例如 `LruCache<string, number | undefined>`）：这样的项同样存在、同样会因为 `get` 而成为最近使用的。

:::files{role=starter}
```ts file=cache.ts
export type CacheOptions<K, V> = { maxSize: number; onEvict?: (key: K, value: V) => void };

export class LruCache {
  constructor(options: { maxSize: number }) {}

  get size(): number {
    return 0;
  }

  has(key: string): boolean {
    return false;
  }

  get(key: string): unknown {
    return undefined;
  }

  set(key: string, value: unknown): void {}

  delete(key: string): boolean {
    return false;
  }

  keys(): string[] {
    return [];
  }
}
```
```ts file=main.ts
import { LruCache } from './cache';

const cache = new LruCache<string, number>({
  maxSize: 2,
  onEvict: (key, value) => console.log('淘汰', key, value),
});
cache.set('a', 1).set('b', 2);
cache.get('a');
cache.set('c', 3);
console.log(cache.keys(), cache.size);
```
:::

:::files{role=solution}
```ts file=cache.ts
export type CacheOptions<K, V> = { maxSize: number; onEvict?: (key: K, value: V) => void };

export class LruCache<K = string, V = unknown> {
  // 值包在对象里：这样 get 能区分“没有这一项”和“值是 undefined”
  #entries = new Map<K, { value: V }>();
  readonly #maxSize: number;
  readonly #onEvict: ((key: K, value: V) => void) | undefined;

  constructor(options: CacheOptions<K, V>) {
    if (!Number.isInteger(options.maxSize) || options.maxSize < 1) {
      throw new RangeError('maxSize 必须是正整数');
    }
    this.#maxSize = options.maxSize;
    this.#onEvict = options.onEvict;
  }

  get size(): number {
    return this.#entries.size;
  }

  has(key: K): boolean {
    return this.#entries.has(key);
  }

  get(key: K): V | undefined {
    const entry = this.#entries.get(key);
    if (entry === undefined) return undefined;
    // Map 按插入顺序遍历：删除再插入，这一项就移到了最后（最近使用）
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): this {
    this.#entries.delete(key);
    this.#entries.set(key, { value });
    if (this.#entries.size > this.#maxSize) {
      const oldest = this.#entries.entries().next();
      if (!oldest.done) {
        const [oldKey, oldEntry] = oldest.value;
        this.#entries.delete(oldKey);
        this.#onEvict?.(oldKey, oldEntry.value);
      }
    }
    return this;
  }

  delete(key: K): boolean {
    return this.#entries.delete(key);
  }

  keys(): K[] {
    return [...this.#entries.keys()];
  }
}
```
```ts file=main.ts
import { LruCache } from './cache';

const cache = new LruCache<string, number>({
  maxSize: 2,
  onEvict: (key, value) => console.log('淘汰', key, value),
});
cache.set('a', 1).set('b', 2);
cache.get('a');
cache.set('c', 3);
console.log(cache.keys(), cache.size);
```
:::

:::files{role=tests}
```ts file=cache.test.ts
import { describe, expect, test } from 'vitest';
import { LruCache } from './cache';

describe('LruCache', () => {
  test('放入、取出、项数', () => {
    const cache = new LruCache<string, number>({ maxSize: 3 });
    cache.set('a', 1).set('b', 2);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('x')).toBeUndefined();
    expect(cache.size).toBe(2);
  });

  test('满了以后淘汰最久没有使用的，get 会更新使用顺序', () => {
    const evicted: [string, number][] = [];
    const cache = new LruCache<string, number>({ maxSize: 2, onEvict: (k, v) => evicted.push([k, v]) });
    cache.set('a', 1).set('b', 2);
    cache.get('a');
    cache.set('c', 3);
    expect(cache.keys()).toEqual(['a', 'c']);
    expect(evicted).toEqual([['b', 2]]);
  });

  test('更新已有的键：值改变、成为最近使用的，不淘汰', () => {
    const evicted: string[] = [];
    const cache = new LruCache<string, number>({ maxSize: 2, onEvict: (k) => evicted.push(k) });
    cache.set('a', 1).set('b', 2).set('a', 10);
    expect(cache.keys()).toEqual(['b', 'a']);
    expect(cache.get('a')).toBe(10);
    expect(evicted).toEqual([]);
  });

  test('has 不改变使用顺序；delete 不调用 onEvict', () => {
    const evicted: string[] = [];
    const cache = new LruCache<string, number>({ maxSize: 2, onEvict: (k) => evicted.push(k) });
    cache.set('a', 1).set('b', 2);
    expect(cache.has('a')).toBe(true);
    cache.set('c', 3);
    expect(cache.keys()).toEqual(['b', 'c']);
    expect(cache.delete('b')).toBe(true);
    expect(cache.delete('b')).toBe(false);
    expect(evicted).toEqual(['a']);
  });

  test('值是 undefined 的项同样存在，也会因为 get 成为最近使用的', () => {
    const cache = new LruCache<string, number | undefined>({ maxSize: 2 });
    cache.set('a', undefined).set('b', 1);
    expect(cache.has('a')).toBe(true);
    expect(cache.get('a')).toBeUndefined();
    cache.set('c', 2);
    expect(cache.keys()).toEqual(['a', 'c']);
  });

  test('maxSize 必须是正整数', () => {
    expect(() => new LruCache({ maxSize: 0 })).toThrow(RangeError);
    expect(() => new LruCache({ maxSize: 1.5 })).toThrow(RangeError);
    expect(() => new LruCache({ maxSize: 1 })).not.toThrow();
  });
});
```
```ts file=cache.test-d.ts
import { expectTypeOf } from 'vitest';
import { LruCache } from './cache';

expectTypeOf(new LruCache({ maxSize: 2 })).toEqualTypeOf<LruCache<string, unknown>>();
expectTypeOf(new LruCache({ maxSize: 2, onEvict: (key: number, value: { id: string }) => {} })).toEqualTypeOf<
  LruCache<number, { id: string }>
>();

const cache = new LruCache<string, number>({ maxSize: 2 });
expectTypeOf(cache.get('a')).toEqualTypeOf<number | undefined>();
expectTypeOf(cache.keys()).toEqualTypeOf<string[]>();
expectTypeOf(cache.set('a', 1).set('b', 2)).toEqualTypeOf<LruCache<string, number>>();
expectTypeOf(cache.size).toEqualTypeOf<number>();
// @ts-expect-error 值的类型不对
cache.set('a', '1');
// @ts-expect-error 键的类型不对
cache.get(1);
// @ts-expect-error size 是只读的
cache.size = 3;
```
:::

:::hint{level=1}
类声明写成 `class LruCache<K = string, V = unknown>`，构造参数的类型是 `CacheOptions<K, V>`。内部用一个 `Map` 保存：`Map` 按插入顺序遍历，“删除再插入”就能把一项移到最后，于是第一项永远是最久没有使用的。
:::

:::hint{level=2}
值包成 `{ value: V }` 再放进 `Map`：`get` 时 `entry === undefined` 才表示没有这一项，值本身是 `undefined` 也能正确处理。淘汰时取 `this.#entries.entries().next()`，`done` 为 `false` 时它的 `value` 就是 `[最久的键, 项]`。`set` 的返回类型写 `this`；`size` 写成 `get size()`，没有 setter 就是只读的。
:::

:::explanation
这道题的类型设计对应正文的规则四：

- 空的缓存 `new LruCache({ maxSize: 2 })` 没有任何推断来源，类型参数就取默认值 `LruCache<string, unknown>`。真正使用时，调用方写出 `LruCache<string, User>`；
- 提供了 `onEvict` 并写出参数类型时，`K`、`V` 从回调的参数推断出来，不需要再写一遍；
- `set` 返回 `this`，链式调用保留了具体的类型（`LruCache<string, number>`），而不是退化成某个基类。

实现上的两个细节：

- **用 `Map` 的插入顺序记录“使用顺序”**：每次使用一项时把它删除再插入，它就到了最后；第一项永远是最久没有使用的。这样 `get`、`set` 都是常数时间；
- **把值包在对象里**：如果直接存 `V`，`Map.get` 返回 `undefined` 时分不清是“没有这一项”还是“值就是 `undefined`”。很多人会写 `if (value === undefined) return undefined`，结果值为 `undefined` 的项永远不会被更新使用顺序（最后一个测试）。包一层 `{ value }` 之后，`entry === undefined` 才表示没有，而且不需要任何断言。

`#entries`、`#maxSize` 是 JavaScript 的私有字段（b12），运行时也无法从外部访问。
:::

:::variant{kind=alt name=has-then-get}
```ts file=cache.ts
export type CacheOptions<K, V> = { maxSize: number; onEvict?: (key: K, value: V) => void };

export class LruCache<K = string, V = unknown> {
  private readonly order: K[] = [];
  private readonly values = new Map<K, [V]>();
  private readonly options: CacheOptions<K, V>;

  constructor(options: CacheOptions<K, V>) {
    if (!(options.maxSize >= 1 && Number.isSafeInteger(options.maxSize))) throw new RangeError('maxSize 必须是正整数');
    this.options = options;
  }

  get size(): number {
    return this.values.size;
  }

  has(key: K): boolean {
    return this.values.has(key);
  }

  private touch(key: K): void {
    const index = this.order.indexOf(key);
    if (index !== -1) this.order.splice(index, 1);
    this.order.push(key);
  }

  get(key: K): V | undefined {
    const boxed = this.values.get(key);
    if (!boxed) return undefined;
    this.touch(key);
    return boxed[0];
  }

  set(key: K, value: V): this {
    this.values.set(key, [value]);
    this.touch(key);
    while (this.order.length > this.options.maxSize) {
      const oldest = this.order.shift();
      if (oldest === undefined) break;
      const boxed = this.values.get(oldest);
      this.values.delete(oldest);
      if (boxed) this.options.onEvict?.(oldest, boxed[0]);
    }
    return this;
  }

  delete(key: K): boolean {
    const index = this.order.indexOf(key);
    if (index !== -1) this.order.splice(index, 1);
    return this.values.delete(key);
  }

  keys(): K[] {
    return [...this.order];
  }
}
```
:::

:::variant{kind=wrong name=evicts-newest fails=tests reason="淘汰的是最近放入的项，而不是最久没有使用的"}
```ts file=cache.ts
export type CacheOptions<K, V> = { maxSize: number; onEvict?: (key: K, value: V) => void };

export class LruCache<K = string, V = unknown> {
  #entries = new Map<K, { value: V }>();
  readonly #maxSize: number;
  readonly #onEvict: ((key: K, value: V) => void) | undefined;

  constructor(options: CacheOptions<K, V>) {
    if (!Number.isInteger(options.maxSize) || options.maxSize < 1) {
      throw new RangeError('maxSize 必须是正整数');
    }
    this.#maxSize = options.maxSize;
    this.#onEvict = options.onEvict;
  }

  get size(): number {
    return this.#entries.size;
  }

  has(key: K): boolean {
    return this.#entries.has(key);
  }

  get(key: K): V | undefined {
    const entry = this.#entries.get(key);
    if (entry === undefined) return undefined;
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): this {
    this.#entries.delete(key);
    if (this.#entries.size >= this.#maxSize) {
      const newest = [...this.#entries].at(-1);
      if (newest !== undefined) {
        this.#entries.delete(newest[0]);
        this.#onEvict?.(newest[0], newest[1].value);
      }
    }
    this.#entries.set(key, { value });
    return this;
  }

  delete(key: K): boolean {
    return this.#entries.delete(key);
  }

  keys(): K[] {
    return [...this.#entries.keys()];
  }
}
```
:::

:::variant{kind=wrong name=get-no-refresh fails=tests reason="get 没有更新使用顺序，刚用过的项也被淘汰了"}
```ts file=cache.ts
export type CacheOptions<K, V> = { maxSize: number; onEvict?: (key: K, value: V) => void };

export class LruCache<K = string, V = unknown> {
  #entries = new Map<K, { value: V }>();
  readonly #maxSize: number;
  readonly #onEvict: ((key: K, value: V) => void) | undefined;

  constructor(options: CacheOptions<K, V>) {
    if (!Number.isInteger(options.maxSize) || options.maxSize < 1) {
      throw new RangeError('maxSize 必须是正整数');
    }
    this.#maxSize = options.maxSize;
    this.#onEvict = options.onEvict;
  }

  get size(): number {
    return this.#entries.size;
  }

  has(key: K): boolean {
    return this.#entries.has(key);
  }

  get(key: K): V | undefined {
    return this.#entries.get(key)?.value;
  }

  set(key: K, value: V): this {
    this.#entries.delete(key);
    this.#entries.set(key, { value });
    if (this.#entries.size > this.#maxSize) {
      const oldest = this.#entries.entries().next();
      if (!oldest.done) {
        const [oldKey, oldEntry] = oldest.value;
        this.#entries.delete(oldKey);
        this.#onEvict?.(oldKey, oldEntry.value);
      }
    }
    return this;
  }

  delete(key: K): boolean {
    return this.#entries.delete(key);
  }

  keys(): K[] {
    return [...this.#entries.keys()];
  }
}
```
:::

:::variant{kind=wrong name=undefined-means-missing fails=tests reason="直接存值，get 把 undefined 当作没有，值为 undefined 的项不会更新使用顺序"}
```ts file=cache.ts
export type CacheOptions<K, V> = { maxSize: number; onEvict?: (key: K, value: V) => void };

export class LruCache<K = string, V = unknown> {
  #entries = new Map<K, V>();
  readonly #maxSize: number;
  readonly #onEvict: ((key: K, value: V) => void) | undefined;

  constructor(options: CacheOptions<K, V>) {
    if (!Number.isInteger(options.maxSize) || options.maxSize < 1) {
      throw new RangeError('maxSize 必须是正整数');
    }
    this.#maxSize = options.maxSize;
    this.#onEvict = options.onEvict;
  }

  get size(): number {
    return this.#entries.size;
  }

  has(key: K): boolean {
    return this.#entries.has(key);
  }

  get(key: K): V | undefined {
    const value = this.#entries.get(key);
    if (value === undefined) return undefined;
    this.#entries.delete(key);
    this.#entries.set(key, value);
    return value;
  }

  set(key: K, value: V): this {
    this.#entries.delete(key);
    this.#entries.set(key, value);
    if (this.#entries.size > this.#maxSize) {
      const oldest = this.#entries.entries().next();
      if (!oldest.done) {
        const [oldKey, oldValue] = oldest.value;
        this.#entries.delete(oldKey);
        this.#onEvict?.(oldKey, oldValue);
      }
    }
    return this;
  }

  delete(key: K): boolean {
    return this.#entries.delete(key);
  }

  keys(): K[] {
    return [...this.#entries.keys()];
  }
}
```
:::

:::variant{kind=wrong name=any-values fails=rules reason="值的类型默认是 any，取出的值失去了检查"}
```ts file=cache.ts
export type CacheOptions<K, V> = { maxSize: number; onEvict?: (key: K, value: V) => void };

export class LruCache<K = string, V = any> {
  #entries = new Map<K, { value: V }>();
  readonly #maxSize: number;
  readonly #onEvict: ((key: K, value: V) => void) | undefined;

  constructor(options: CacheOptions<K, V>) {
    if (!Number.isInteger(options.maxSize) || options.maxSize < 1) {
      throw new RangeError('maxSize 必须是正整数');
    }
    this.#maxSize = options.maxSize;
    this.#onEvict = options.onEvict;
  }

  get size(): number {
    return this.#entries.size;
  }

  has(key: K): boolean {
    return this.#entries.has(key);
  }

  get(key: K): V | undefined {
    const entry = this.#entries.get(key);
    if (entry === undefined) return undefined;
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): this {
    this.#entries.delete(key);
    this.#entries.set(key, { value });
    if (this.#entries.size > this.#maxSize) {
      const oldest = this.#entries.entries().next();
      if (!oldest.done) {
        const [oldKey, oldEntry] = oldest.value;
        this.#entries.delete(oldKey);
        this.#onEvict?.(oldKey, oldEntry.value);
      }
    }
    return this;
  }

  delete(key: K): boolean {
    return this.#entries.delete(key);
  }

  keys(): K[] {
    return [...this.#entries.keys()];
  }
}
```
:::
