---
kind: challenge
title: 结果类型的工具函数
---
把 b09 的结果类型写成泛型，再实现一组工具函数。类型已经给出：

```ts
type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };
```

实现以下泛型函数（类型参数要准确，测试会检查推断出的类型）：

| 函数 | 作用 |
| --- | --- |
| `ok(value)` | 返回 `{ ok: true, value }`，类型为 `Result<T, never>` |
| `err(error)` | 返回 `{ ok: false, error }`，类型为 `Result<never, E>` |
| `map(result, fn)` | 成功时用 `fn` 转换值，返回新的成功结果；失败时返回失败结果（错误不变，不调用 `fn`）。类型：`Result<T, E>` → `Result<U, E>` |
| `unwrapOr(result, fallback)` | 成功时返回值，失败时返回 `fallback`。返回类型为 `T` |
| `all(results)` | 全部成功时返回 `ok(所有值组成的数组)`；否则返回**第一个**失败结果（错误相同）。类型：`readonly Result<T, E>[]` → `Result<T[], E>` |

:::files{role=starter}
```ts file=result.ts
export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };

export function ok(value: unknown) {
  return { ok: true, value };
}
```
:::

:::files{role=solution}
```ts file=result.ts
export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback;
}

export function all<T, E>(results: readonly Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) {
      return result;
    }
    values.push(result.value);
  }
  return ok(values);
}
```
:::

:::files{role=tests}
```ts file=result.test.ts
import { describe, expect, test } from 'vitest';
import { all, err, map, ok, unwrapOr, type Result } from './result';

function parse(text: string): Result<number> {
  const n = Number(text);
  return Number.isNaN(n) ? err(`无效：${text}`) : ok(n);
}

describe('ok / err', () => {
  test('构造结果', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
    expect(err('坏了')).toEqual({ ok: false, error: '坏了' });
  });
});

describe('map', () => {
  test('成功时转换值', () => {
    expect(map(parse('21'), (n) => n * 2)).toEqual({ ok: true, value: 42 });
  });

  test('失败时原样返回', () => {
    const failed = parse('x');
    let called = false;
    const result = map(failed, (n) => {
      called = true;
      return n * 2;
    });
    expect(result).toEqual({ ok: false, error: '无效：x' });
    expect(called).toBe(false);
  });
});

describe('unwrapOr', () => {
  test('成功与失败', () => {
    expect(unwrapOr(parse('5'), 0)).toBe(5);
    expect(unwrapOr(parse('?'), 0)).toBe(0);
  });
});

describe('all', () => {
  test('全部成功', () => {
    expect(all(['1', '2', '3'].map(parse))).toEqual({ ok: true, value: [1, 2, 3] });
    expect(all([])).toEqual({ ok: true, value: [] });
  });

  test('返回第一个失败', () => {
    expect(all(['1', 'a', 'b'].map(parse))).toEqual({ ok: false, error: '无效：a' });
  });
});
```
```ts file=result.test-d.ts
import { expectTypeOf } from 'vitest';
import { all, err, map, ok, unwrapOr, type Result } from './result';

expectTypeOf(ok(1)).toEqualTypeOf<Result<number, never>>();
expectTypeOf(err(new Error('x'))).toEqualTypeOf<Result<never, Error>>();

declare const parsed: Result<number>;
expectTypeOf(map(parsed, (n) => String(n))).toEqualTypeOf<Result<string, string>>();
expectTypeOf(unwrapOr(parsed, 0)).toEqualTypeOf<number>();
expectTypeOf(all([parsed, parsed])).toEqualTypeOf<Result<number[], string>>();

map(parsed, (n) => {
  expectTypeOf(n).toEqualTypeOf<number>();
  return n;
});
```
:::

:::hint{level=1}
每个函数先想清楚有哪些类型在变化：`ok` 只有值的类型 `T`；`map` 有原来的值类型 `T`、新的值类型 `U` 和错误类型 `E`。把它们都声明成类型参数，并在参数和返回值里使用。
:::

:::hint{level=2}
`map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E>`：成功时 `return ok(fn(result.value))`，失败时直接 `return result`——失败结果的类型是 `{ ok: false; error: E }`，它同时也是 `Result<U, E>` 的成员。`all` 遍历时遇到失败就返回它，最后 `return ok(values)`。
:::

:::explanation
类型参数在这里起到“搬运类型”的作用：`map` 拿到 `Result<number, string>` 和一个 `(n: number) => string` 的函数，返回 `Result<string, string>`——错误类型 `E` 原封不动地被带到了结果里，值类型从 `T` 变成了 `U`。

`ok` 返回 `Result<T, never>`：成功的结果不可能有错误，`never` 表示“这里没有任何可能的值”。`never` 可以赋给任何类型，所以 `ok(n)` 可以直接作为 `Result<number, string>` 返回（参见测试里的 `parse`）。同理，`err` 返回 `Result<never, E>`。

失败时直接 `return result` 不需要复制或转换：在 `result.ok` 为 `false` 的分支里，它的类型是 `{ ok: false; error: E }`，不依赖 `T`，所以也是 `Result<U, E>` 的合法值。
:::

:::variant{kind=alt name=explicit-objects}
```ts file=result.ts
export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };

export function ok<TValue>(value: TValue): Result<TValue, never> {
  return { ok: true, value: value };
}

export function err<TError>(error: TError): Result<never, TError> {
  return { ok: false, error: error };
}

export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true, value: fn(result.value) };
}

export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  if (result.ok) return result.value;
  return fallback;
}

export function all<T, E>(results: readonly Result<T, E>[]): Result<T[], E> {
  const firstError = results.find((r) => !r.ok);
  if (firstError !== undefined && !firstError.ok) {
    return { ok: false, error: firstError.error };
  }
  return { ok: true, value: results.flatMap((r) => (r.ok ? [r.value] : [])) };
}
```
:::

:::variant{kind=wrong name=unknown-values fails=types reason="用 unknown 代替类型参数，调用方拿到的值失去了类型"}
```ts file=result.ts
export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };

export function ok(value: unknown): Result<unknown, never> {
  return { ok: true, value };
}

export function err(error: unknown): Result<never, unknown> {
  return { ok: false, error };
}

export function map(result: Result<unknown, unknown>, fn: (value: unknown) => unknown): Result<unknown, unknown> {
  return result.ok ? ok(fn(result.value)) : result;
}

export function unwrapOr(result: Result<unknown, unknown>, fallback: unknown): unknown {
  return result.ok ? result.value : fallback;
}

export function all(results: readonly Result<unknown, unknown>[]): Result<unknown[], unknown> {
  const values: unknown[] = [];
  for (const result of results) {
    if (!result.ok) return result;
    values.push(result.value);
  }
  return ok(values);
}
```
:::

:::variant{kind=wrong name=last-error fails=tests reason="all 返回了最后一个失败结果"}
```ts file=result.ts
export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback;
}

export function all<T, E>(results: readonly Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  let failure: Result<T[], E> | null = null;
  for (const result of results) {
    if (result.ok) values.push(result.value);
    else failure = result;
  }
  return failure ?? ok(values);
}
```
:::

:::variant{kind=wrong name=same-type-map fails=types reason="map 没有引入新的类型参数 U，只能把值转换成同一种类型"}
```ts file=result.ts
export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function map<T, E>(result: Result<T, E>, fn: (value: T) => T): Result<T, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback;
}

export function all<T, E>(results: readonly Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) return result;
    values.push(result.value);
  }
  return ok(values);
}
```
:::
