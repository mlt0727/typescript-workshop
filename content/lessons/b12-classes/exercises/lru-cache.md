---
kind: challenge
title: 最近最少使用缓存
---
实现一个容量有限的缓存类 `LruCache`（Least Recently Used，最近最少使用）。键和值都是字符串。

- `new LruCache(capacity)`：`capacity` 必须是正整数，否则抛出 `RangeError`。
- `set(key, value)`：写入或更新。写入后如果条目数超过容量，删除**最久没有被使用**的条目。
- `get(key)`：返回值，不存在时返回 `undefined`。读取到的条目算作“刚刚使用过”。
- `has(key)`：是否存在。只是查询，**不算**使用。
- `size`：getter，当前条目数。
- `keys()`：返回所有键组成的新数组，按从“最久没用”到“最近使用”的顺序排列。

“使用”指 `get` 读到了值，或者 `set` 写入（包括更新已有的键）。内部数据要用 `#` 私有字段保存。

提示：a18 讲过，`Map` 按插入顺序遍历。删除一个键再重新 `set`，它就排到了最后。

:::files{role=starter}
```ts file=lru.ts
export class LruCache {
  // 在这里实现
}
```
:::

:::files{role=solution}
```ts file=lru.ts
export class LruCache {
  readonly capacity: number;
  #entries = new Map<string, string>();

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError(`容量必须是正整数：${capacity}`);
    }
    this.capacity = capacity;
  }

  get size(): number {
    return this.#entries.size;
  }

  has(key: string): boolean {
    return this.#entries.has(key);
  }

  get(key: string): string | undefined {
    const value = this.#entries.get(key);
    if (value === undefined) {
      return undefined;
    }
    this.#entries.delete(key);
    this.#entries.set(key, value);
    return value;
  }

  set(key: string, value: string): void {
    this.#entries.delete(key);
    this.#entries.set(key, value);
    if (this.#entries.size > this.capacity) {
      const oldest = this.#entries.keys().next();
      if (!oldest.done) {
        this.#entries.delete(oldest.value);
      }
    }
  }

  keys(): string[] {
    return [...this.#entries.keys()];
  }
}
```
:::

:::files{role=tests}
```ts file=lru.test.ts
import { describe, expect, test } from 'vitest';
import { LruCache } from './lru';

describe('LruCache', () => {
  test('容量必须是正整数', () => {
    expect(() => new LruCache(0)).toThrow(RangeError);
    expect(() => new LruCache(-1)).toThrow(RangeError);
    expect(() => new LruCache(1.5)).toThrow(RangeError);
    expect(new LruCache(1).size).toBe(0);
  });

  test('超过容量时删除最久没用的', () => {
    const cache = new LruCache(2);
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    expect(cache.keys()).toEqual(['b', 'c']);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(2);
  });

  test('get 会刷新使用顺序', () => {
    const cache = new LruCache(2);
    cache.set('a', '1');
    cache.set('b', '2');
    expect(cache.get('a')).toBe('1');
    cache.set('c', '3');
    expect(cache.keys()).toEqual(['a', 'c']);
  });

  test('has 不算使用', () => {
    const cache = new LruCache(2);
    cache.set('a', '1');
    cache.set('b', '2');
    expect(cache.has('a')).toBe(true);
    cache.set('c', '3');
    expect(cache.has('a')).toBe(false);
  });

  test('更新已有的键也算使用，不增加条目数', () => {
    const cache = new LruCache(2);
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('a', '10');
    expect(cache.size).toBe(2);
    cache.set('c', '3');
    expect(cache.keys()).toEqual(['a', 'c']);
    expect(cache.get('a')).toBe('10');
  });

  test('值可以是空字符串', () => {
    const cache = new LruCache(1);
    cache.set('empty', '');
    expect(cache.get('empty')).toBe('');
    expect(cache.has('empty')).toBe(true);
  });

  test('keys 返回新数组', () => {
    const cache = new LruCache(3);
    cache.set('a', '1');
    const keys = cache.keys();
    keys.push('x');
    expect(cache.keys()).toEqual(['a']);
  });

  test('内部数据是私有的', () => {
    const cache = new LruCache(2);
    cache.set('a', '1');
    expect(Object.values(cache).some((value) => value instanceof Map)).toBe(false);
  });
});
```
:::

:::hint{level=1}
用一个 `#entries = new Map<string, string>()` 保存数据。`Map` 的遍历顺序就是插入顺序，所以只要保证“每次使用时把这个键移到最后”，第一个键就是最久没用的。
:::

:::hint{level=2}
“移到最后”的做法：先 `delete(key)`，再 `set(key, value)`。淘汰时取第一个键：`this.#entries.keys().next()` 返回 `{ value, done }`。注意 `get` 判断“不存在”要用 `=== undefined`，不能用真假检查——值可能是空字符串。
:::

:::explanation
LRU 缓存需要两种能力：按键快速查找，以及记住使用的先后顺序。`Map` 同时提供了这两点：查找是 `get`，顺序是插入顺序。每次使用时删除再重新插入，这个键就移到了末尾；超过容量时，删除第一个键，也就是最久没用的那个。

`#entries` 是私有字段，外部无法绕过 `get`/`set` 修改数据，所以“使用顺序”始终由类自己维护。`keys()` 返回展开得到的新数组，调用方修改它不会影响缓存（a11）。

`keys().next()` 是迭代器的接口：它返回 `{ value, done }`。在 `done` 为 `false` 时，`value` 才是有效的键——TypeScript 也会根据 `done` 收窄 `value` 的类型（可辨识联合，b09）。
:::

:::variant{kind=alt name=first-key-loop}
```ts file=lru.ts
export class LruCache {
  readonly capacity: number;
  #map: Map<string, string> = new Map();

  constructor(capacity: number) {
    if (!(Number.isInteger(capacity) && capacity > 0)) throw new RangeError('容量无效');
    this.capacity = capacity;
  }

  get size(): number {
    return this.#map.size;
  }

  has(key: string): boolean {
    return this.#map.has(key);
  }

  #touch(key: string, value: string): void {
    this.#map.delete(key);
    this.#map.set(key, value);
  }

  get(key: string): string | undefined {
    if (!this.#map.has(key)) return undefined;
    const value = this.#map.get(key) ?? '';
    this.#touch(key, value);
    return value;
  }

  set(key: string, value: string): void {
    this.#touch(key, value);
    for (const oldest of this.#map.keys()) {
      if (this.#map.size <= this.capacity) break;
      this.#map.delete(oldest);
    }
  }

  keys(): string[] {
    return Array.from(this.#map.keys());
  }
}
```
:::

:::variant{kind=wrong name=get-not-refresh fails=tests reason="get 没有刷新使用顺序"}
```ts file=lru.ts
export class LruCache {
  readonly capacity: number;
  #entries = new Map<string, string>();

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) throw new RangeError('容量无效');
    this.capacity = capacity;
  }

  get size(): number {
    return this.#entries.size;
  }

  has(key: string): boolean {
    return this.#entries.has(key);
  }

  get(key: string): string | undefined {
    return this.#entries.get(key);
  }

  set(key: string, value: string): void {
    this.#entries.delete(key);
    this.#entries.set(key, value);
    if (this.#entries.size > this.capacity) {
      const oldest = this.#entries.keys().next();
      if (!oldest.done) this.#entries.delete(oldest.value);
    }
  }

  keys(): string[] {
    return [...this.#entries.keys()];
  }
}
```
:::

:::variant{kind=wrong name=update-keeps-position fails=tests reason="更新已有的键时直接 set，没有移到最后"}
```ts file=lru.ts
export class LruCache {
  readonly capacity: number;
  #entries = new Map<string, string>();

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) throw new RangeError('容量无效');
    this.capacity = capacity;
  }

  get size(): number {
    return this.#entries.size;
  }

  has(key: string): boolean {
    return this.#entries.has(key);
  }

  get(key: string): string | undefined {
    const value = this.#entries.get(key);
    if (value === undefined) return undefined;
    this.#entries.delete(key);
    this.#entries.set(key, value);
    return value;
  }

  set(key: string, value: string): void {
    this.#entries.set(key, value);
    if (this.#entries.size > this.capacity) {
      const oldest = this.#entries.keys().next();
      if (!oldest.done) this.#entries.delete(oldest.value);
    }
  }

  keys(): string[] {
    return [...this.#entries.keys()];
  }
}
```
:::

:::variant{kind=wrong name=truthy-get fails=tests reason="用真假检查判断是否存在，空字符串值被当成不存在"}
```ts file=lru.ts
export class LruCache {
  readonly capacity: number;
  #entries = new Map<string, string>();

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) throw new RangeError('容量无效');
    this.capacity = capacity;
  }

  get size(): number {
    return this.#entries.size;
  }

  has(key: string): boolean {
    return this.#entries.has(key);
  }

  get(key: string): string | undefined {
    const value = this.#entries.get(key);
    if (!value) return undefined;
    this.#entries.delete(key);
    this.#entries.set(key, value);
    return value;
  }

  set(key: string, value: string): void {
    this.#entries.delete(key);
    this.#entries.set(key, value);
    if (this.#entries.size > this.capacity) {
      const oldest = this.#entries.keys().next();
      if (!oldest.done) this.#entries.delete(oldest.value);
    }
  }

  keys(): string[] {
    return [...this.#entries.keys()];
  }
}
```
:::

:::variant{kind=wrong name=public-map fails=tests reason="数据保存在公开字段里，外部可以绕过 get/set 修改"}
```ts file=lru.ts
export class LruCache {
  readonly capacity: number;
  entries = new Map<string, string>();

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) throw new RangeError('容量无效');
    this.capacity = capacity;
  }

  get size(): number {
    return this.entries.size;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  get(key: string): string | undefined {
    const value = this.entries.get(key);
    if (value === undefined) return undefined;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(key: string, value: string): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    if (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next();
      if (!oldest.done) this.entries.delete(oldest.value);
    }
  }

  keys(): string[] {
    return [...this.entries.keys()];
  }
}
```
:::

:::variant{kind=wrong name=ts-private fails=tests reason="用 TypeScript 的 private 保存数据，运行时仍然是普通属性"}
```ts file=lru.ts
export class LruCache {
  readonly capacity: number;
  private entries = new Map<string, string>();

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) throw new RangeError('容量无效');
    this.capacity = capacity;
  }

  get size(): number {
    return this.entries.size;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  get(key: string): string | undefined {
    const value = this.entries.get(key);
    if (value === undefined) return undefined;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(key: string, value: string): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    if (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next();
      if (!oldest.done) this.entries.delete(oldest.value);
    }
  }

  keys(): string[] {
    return [...this.entries.keys()];
  }
}
```
:::
