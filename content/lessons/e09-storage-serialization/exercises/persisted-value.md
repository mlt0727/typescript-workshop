---
kind: task
title: 可靠的持久化值
---
实现 `createPersisted(storage, key, parse, fallback)`，返回一个对象，用来读写保存在 `storage` 中 `key` 下的一个值：

- `load()`：读取并返回这个值。以下任何一种情况都返回 `fallback`：没有保存过（`getItem` 返回 `null`）、内容不是合法的 JSON、`parse` 返回 `null`（格式不对）、`getItem` 本身抛出错误；
- `save(value)`：用 `JSON.stringify` 保存，成功返回 `true`；`setItem` 抛出错误（例如空间不足）时返回 `false`，不要把错误抛出去；
- `clear()`：删除这个键，出错时忽略。

`storage` 参数只要求有 `getItem`、`setItem`、`removeItem` 三个方法（真正的 `localStorage` 就满足，这是 b02 的结构化类型）。把它作为参数传入，测试就能用一个会抛出错误的假存储检查各种失败的情况。

`parse` 负责验证：它接收 `JSON.parse` 的结果（`unknown`），合格时返回值，不合格时返回 `null`。

:::files{role=starter}
```ts file=persisted.ts
export type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type Persisted<T> = { load(): T; save(value: T): boolean; clear(): void };

export function createPersisted<T>(
  storage: KeyValueStorage,
  key: string,
  parse: (value: unknown) => T | null,
  fallback: T,
): Persisted<T> {
  return {
    load: () => JSON.parse(storage.getItem(key) ?? 'null') ?? fallback,
    save: (value) => {
      storage.setItem(key, JSON.stringify(value));
      return true;
    },
    clear: () => storage.removeItem(key),
  };
}
```
:::

:::files{role=solution}
```ts file=persisted.ts
export type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type Persisted<T> = { load(): T; save(value: T): boolean; clear(): void };

export function createPersisted<T>(
  storage: KeyValueStorage,
  key: string,
  parse: (value: unknown) => T | null,
  fallback: T,
): Persisted<T> {
  return {
    load() {
      try {
        const raw = storage.getItem(key);
        if (raw === null) return fallback;
        const data: unknown = JSON.parse(raw);
        return parse(data) ?? fallback;
      } catch {
        return fallback;
      }
    },
    save(value) {
      try {
        storage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    clear() {
      try {
        storage.removeItem(key);
      } catch {
        // 删除失败时无事可做
      }
    },
  };
}
```
:::

:::files{role=tests}
```ts file=persisted.test.ts
import { describe, expect, test } from 'vitest';
import { createPersisted, type KeyValueStorage } from './persisted';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

const brokenStorage: KeyValueStorage = {
  getItem: () => {
    throw new DOMException('存储不可用', 'SecurityError');
  },
  setItem: () => {
    throw new DOMException('空间不足', 'QuotaExceededError');
  },
  removeItem: () => {
    throw new DOMException('存储不可用', 'SecurityError');
  },
};

function parseNumbers(value: unknown): number[] | null {
  return Array.isArray(value) && value.every((n) => typeof n === 'number') ? value : null;
}

describe('createPersisted', () => {
  test('保存后读取', () => {
    const storage = memoryStorage();
    const scores = createPersisted(storage, 'scores', parseNumbers, []);
    expect(scores.load()).toEqual([]);
    expect(scores.save([90, 85])).toBe(true);
    expect(storage.data.get('scores')).toBe('[90,85]');
    expect(scores.load()).toEqual([90, 85]);
  });

  test('内容损坏或格式不对时返回默认值', () => {
    const fallback = [0];
    expect(createPersisted(memoryStorage({ scores: '[90, 85' }), 'scores', parseNumbers, fallback).load()).toBe(fallback);
    expect(createPersisted(memoryStorage({ scores: '["90"]' }), 'scores', parseNumbers, fallback).load()).toBe(fallback);
    expect(createPersisted(memoryStorage({ scores: 'null' }), 'scores', parseNumbers, fallback).load()).toBe(fallback);
  });

  test('存储不可用时：读取返回默认值，保存返回 false，删除不抛出错误', () => {
    const scores = createPersisted(brokenStorage, 'scores', parseNumbers, [1]);
    expect(scores.load()).toEqual([1]);
    expect(scores.save([2])).toBe(false);
    expect(() => scores.clear()).not.toThrow();
  });

  test('clear 删除这个键', () => {
    const storage = memoryStorage({ scores: '[1]', other: '"x"' });
    createPersisted(storage, 'scores', parseNumbers, []).clear();
    expect([...storage.data.keys()]).toEqual(['other']);
  });

  test('使用传入的 key，不影响其他键', () => {
    const storage = memoryStorage({ scores: '[1]' });
    const muted = createPersisted(storage, 'muted', (v) => (typeof v === 'boolean' ? v : null), false);
    expect(muted.save(true)).toBe(true);
    expect(storage.data.get('muted')).toBe('true');
    expect(storage.data.get('scores')).toBe('[1]');
    muted.clear();
    expect([...storage.data.keys()]).toEqual(['scores']);
  });

  test('保存的值是 false、0、空字符串时也能原样读回', () => {
    const storage = memoryStorage({ muted: 'false', count: '0', note: '""' });
    expect(createPersisted(storage, 'muted', (v) => (typeof v === 'boolean' ? v : null), true).load()).toBe(false);
    expect(createPersisted(storage, 'count', (v) => (typeof v === 'number' ? v : null), 10).load()).toBe(0);
    expect(createPersisted(storage, 'note', (v) => (typeof v === 'string' ? v : null), '默认').load()).toBe('');
  });
});
```
```ts file=persisted.test-d.ts
import { expectTypeOf } from 'vitest';
import { createPersisted, type KeyValueStorage } from './persisted';

declare const storage: KeyValueStorage;
type Theme = 'light' | 'dark';
const parseTheme = (v: unknown): Theme | null => (v === 'light' || v === 'dark' ? v : null);
const theme = createPersisted(storage, 'theme', parseTheme, 'light');
expectTypeOf(theme.load()).toEqualTypeOf<'light' | 'dark'>();

// 真正的 localStorage（Storage 类型）满足这个结构
declare const browserStorage: Storage;
const fromBrowser: KeyValueStorage = browserStorage;
console.log(fromBrowser);
```
:::

:::hint{level=1}
`load` 中可能出错的地方有三个：`getItem` 本身、`JSON.parse`、内容的格式。把整个读取过程放进一个 `try/catch`，`catch` 中返回 `fallback`；格式交给 `parse` 判断，它返回 `null` 时同样返回 `fallback`。
:::

:::hint{level=2}
`const raw = storage.getItem(key); if (raw === null) return fallback; const data: unknown = JSON.parse(raw); return parse(data) ?? fallback;`。`save` 和 `clear` 也各自包一个 `try/catch`。
:::

:::explanation
存储中的数据随时可能缺失、损坏，或者来自旧版本的程序；存储本身也可能不可用（隐私模式、空间不足）。`createPersisted` 把这些情况都集中处理掉：调用方只会得到一个合格的值，或者默认值，不需要在每个使用的地方写防御代码。

起始代码的三个问题：`JSON.parse` 遇到损坏的内容会抛出异常；结果没有经过验证，`["90"]` 这样的数据也会被返回；`JSON.parse` 返回的是 `any`，类型检查完全没起作用。

`save` 返回布尔值而不是抛出错误：保存失败通常不应该让整个操作中断，但调用方可能想提示用户“设置没能保存”。

类型参数 `T` 从 `parse` 的返回类型推断出来，测试中的 `theme` 是 `'light' | 'dark'`。参数类型 `KeyValueStorage` 只描述需要的三个方法，真正的 `localStorage`（`Storage` 类型）结构上满足它，测试中的假存储也满足它。
:::

:::variant{kind=alt name=helper-functions}
```ts file=persisted.ts
export type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type Persisted<T> = { load(): T; save(value: T): boolean; clear(): void };

function attempt<R>(action: () => R, onError: R): R {
  try {
    return action();
  } catch {
    return onError;
  }
}

export function createPersisted<T>(
  storage: KeyValueStorage,
  key: string,
  parse: (value: unknown) => T | null,
  fallback: T,
): Persisted<T> {
  const read = (): T => {
    const raw = storage.getItem(key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    const value = parse(parsed);
    return value === null ? fallback : value;
  };
  return {
    load: () => attempt(read, fallback),
    save: (value) =>
      attempt(() => {
        storage.setItem(key, JSON.stringify(value));
        return true;
      }, false),
    clear: () => attempt(() => storage.removeItem(key), undefined),
  };
}
```
:::

:::variant{kind=wrong name=no-try fails=tests reason="没有捕获 JSON.parse 和存储的错误"}
```ts file=persisted.ts
export type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type Persisted<T> = { load(): T; save(value: T): boolean; clear(): void };

export function createPersisted<T>(
  storage: KeyValueStorage,
  key: string,
  parse: (value: unknown) => T | null,
  fallback: T,
): Persisted<T> {
  return {
    load() {
      const raw = storage.getItem(key);
      if (raw === null) return fallback;
      const data: unknown = JSON.parse(raw);
      return parse(data) ?? fallback;
    },
    save(value) {
      storage.setItem(key, JSON.stringify(value));
      return true;
    },
    clear() {
      storage.removeItem(key);
    },
  };
}
```
:::

:::variant{kind=wrong name=skip-validation fails=tests reason="没有调用 parse 验证，格式不对的数据也被返回"}
```ts file=persisted.ts
export type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type Persisted<T> = { load(): T; save(value: T): boolean; clear(): void };

export function createPersisted<T>(
  storage: KeyValueStorage,
  key: string,
  parse: (value: unknown) => T | null,
  fallback: T,
): Persisted<T> {
  const isT = (value: unknown): value is T => value !== null && value !== undefined && parse !== undefined;
  return {
    load() {
      try {
        const raw = storage.getItem(key);
        const data: unknown = raw === null ? null : JSON.parse(raw);
        return isT(data) ? data : fallback;
      } catch {
        return fallback;
      }
    },
    save(value) {
      try {
        storage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    clear() {
      try {
        storage.removeItem(key);
      } catch {
        // 忽略
      }
    },
  };
}
```
:::

:::variant{kind=wrong name=save-throws fails=tests reason="保存失败时把错误抛了出去，而不是返回 false"}
```ts file=persisted.ts
export type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type Persisted<T> = { load(): T; save(value: T): boolean; clear(): void };

export function createPersisted<T>(
  storage: KeyValueStorage,
  key: string,
  parse: (value: unknown) => T | null,
  fallback: T,
): Persisted<T> {
  return {
    load() {
      try {
        const raw = storage.getItem(key);
        if (raw === null) return fallback;
        const data: unknown = JSON.parse(raw);
        return parse(data) ?? fallback;
      } catch {
        return fallback;
      }
    },
    save(value) {
      storage.setItem(key, JSON.stringify(value));
      return true;
    },
    clear() {
      try {
        storage.removeItem(key);
      } catch {
        // 忽略
      }
    },
  };
}
```
:::
