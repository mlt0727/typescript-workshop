---
kind: task
title: 修正四个泛型签名
---
`api.ts` 中的四个函数都“能用”，但签名设计得不好。按正文的规则修改（函数的行为不变或按说明补全）：

1. **`logValue(label, value)`**：把 `label: value` 记录到数组 `log` 中（值用 `JSON.stringify`）。它的类型参数 `T` 只出现了一次，去掉它，`value` 改成 `unknown`；
2. **`parseJson(text, isT)`**：原来的 `parseJson<T>(text): T` 让调用方随意指定返回值类型。改成接收一个类型守卫 `isT`：JSON 不合法或者守卫返回 `false` 时返回 `null`，否则返回解析出的值，类型由守卫决定；
3. **`enumValues(values)`**：返回 `{ values, is }`。调用时不写 `as const`，`values` 的类型也要保留字面量（`enumValues(['S', 'M'])` 的 `values` 是 `readonly ['S', 'M']`），`is(x)` 是类型守卫；
4. **`withDefault(allowed, fallback)`**：返回一个函数，输入是 `allowed` 中的一项时返回它，否则返回 `fallback`。`fallback` 必须是 `allowed` 中的一项：`withDefault(['S', 'M'], 'XL')` 要报错。

:::files{role=starter}
```ts file=api.ts
export const log: string[] = [];

export function logValue<T>(label: string, value: T): void {
  log.push(`${label}: ${JSON.stringify(value)}`);
}

export function parseJson<T>(text: string): T {
  return JSON.parse(text);
}

export function enumValues<T extends readonly string[]>(values: T) {
  return { values, is: (x: string) => values.includes(x) };
}

export function withDefault<T extends string>(allowed: readonly T[], fallback: T): (input: string) => T {
  return (input) => allowed.find((a) => a === input) ?? fallback;
}
```
```ts file=main.ts
import { enumValues, log, logValue, parseJson, withDefault } from './api';

const sizes = enumValues(['S', 'M', 'L']);
const size = withDefault(sizes.values, 'M');
logValue('size', size('XL'));
logValue('parsed', parseJson('[1, 2]', Array.isArray));
console.log(log);
```
:::

:::files{role=solution}
```ts file=api.ts
export const log: string[] = [];

export function logValue(label: string, value: unknown): void {
  log.push(`${label}: ${JSON.stringify(value)}`);
}

export function parseJson<T>(text: string, isT: (value: unknown) => value is T): T | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  return isT(value) ? value : null;
}

export function enumValues<const T extends readonly string[]>(values: T) {
  return { values, is: (x: string): x is T[number] => values.includes(x) };
}

export function withDefault<T extends string>(allowed: readonly T[], fallback: NoInfer<T>): (input: string) => T {
  return (input) => allowed.find((a) => a === input) ?? fallback;
}
```
```ts file=main.ts
import { enumValues, log, logValue, parseJson, withDefault } from './api';

const sizes = enumValues(['S', 'M', 'L']);
const size = withDefault(sizes.values, 'M');
logValue('size', size('XL'));
logValue('parsed', parseJson('[1, 2]', Array.isArray));
console.log(log);
```
:::

:::files{role=tests}
```ts file=api.test.ts
import { describe, expect, test } from 'vitest';
import { enumValues, log, logValue, parseJson, withDefault } from './api';

const isNumbers = (v: unknown): v is number[] => Array.isArray(v) && v.every((x) => typeof x === 'number');

describe('logValue', () => {
  test('记录标签与 JSON', () => {
    log.length = 0;
    logValue('a', { x: 1 });
    logValue('b', 'hi');
    expect(log).toEqual(['a: {"x":1}', 'b: "hi"']);
  });
});

describe('parseJson', () => {
  test('守卫通过时返回值，否则返回 null', () => {
    expect(parseJson('[1, 2]', isNumbers)).toEqual([1, 2]);
    expect(parseJson('[1, "2"]', isNumbers)).toBeNull();
    expect(parseJson('不是 JSON', isNumbers)).toBeNull();
  });
});

describe('enumValues', () => {
  test('values 原样返回，is 判断是不是其中之一', () => {
    const sizes = enumValues(['S', 'M', 'L']);
    expect(sizes.values).toEqual(['S', 'M', 'L']);
    expect(sizes.is('M')).toBe(true);
    expect(sizes.is('XL')).toBe(false);
  });
});

describe('withDefault', () => {
  test('是其中一项时返回它，否则返回默认值', () => {
    const size = withDefault(['S', 'M', 'L'], 'M');
    expect(size('L')).toBe('L');
    expect(size('XL')).toBe('M');
    expect(size('')).toBe('M');
  });
});
```
```ts file=api.test-d.ts
import { expectTypeOf } from 'vitest';
import { enumValues, logValue, parseJson, withDefault } from './api';

expectTypeOf(logValue).toEqualTypeOf<(label: string, value: unknown) => void>();

const isNumbers = (v: unknown): v is number[] => Array.isArray(v);
expectTypeOf(parseJson('[1]', isNumbers)).toEqualTypeOf<number[] | null>();
// @ts-expect-error 必须提供验证函数
parseJson('[1]');

const sizes = enumValues(['S', 'M', 'L']);
expectTypeOf(sizes.values).toEqualTypeOf<readonly ['S', 'M', 'L']>();
const raw: string = 'M';
if (sizes.is(raw)) expectTypeOf(raw).toEqualTypeOf<'S' | 'M' | 'L'>();

const size = withDefault(['S', 'M'], 'S');
expectTypeOf(size).returns.toEqualTypeOf<'S' | 'M'>();
// @ts-expect-error 默认值必须是其中一项
withDefault(['S', 'M'], 'XL');
```
:::

:::hint{level=1}
`logValue` 去掉 `<T>`，`value: unknown`。`parseJson` 加一个参数 `isT: (value: unknown) => value is T`，返回值写 `T | null`；`JSON.parse` 的结果先赋给一个 `unknown` 的变量，不合法的 JSON 用 `try/catch` 处理。
:::

:::hint{level=2}
`enumValues` 在类型参数前加上 `const`：`<const T extends readonly string[]>`，`is` 的返回类型写成 `x is T[number]`。`withDefault` 的第二个参数写成 `fallback: NoInfer<T>`，`T` 就只从 `allowed` 推断。
:::

:::explanation
四个修改分别对应正文的四条规则：

- `logValue<T>` 的 `T` 只出现一次，它和 `unknown` 没有区别，去掉之后签名更诚实；
- 原来的 `parseJson<T>(text): T` 能编译，只是因为 `JSON.parse` 返回 `any`，`any` 可以赋给任何类型。调用方写 `parseJson<User>(text)` 时，什么都没有检查。加上守卫参数之后，`T` 有了真正的来源，返回的值也确实被检查过；
- `const T` 让 `['S', 'M', 'L']` 被推断为 `readonly ['S', 'M', 'L']`，`T[number]` 就是 `'S' | 'M' | 'L'`，`is` 能把普通字符串收窄成这几个值之一；
- `NoInfer<T>` 让 `fallback` 只接受已经推断好的 `T`，而不是参与推断。没有它的时候，`'XL'` 会被悄悄加进 `T`，返回值的类型也跟着变宽成 `'S' | 'M' | 'XL'`。

`main.ts` 中 `withDefault(sizes.values, 'M')` 能工作，正是因为 `sizes.values` 保留了字面量：`T` 推断为 `'S' | 'M' | 'L'`，`'M'` 是其中之一。
:::

:::variant{kind=alt name=overload-free-style}
```ts file=api.ts
export const log: string[] = [];

export const logValue = (label: string, value: unknown): void => {
  log.push(label + ': ' + JSON.stringify(value));
};

export function parseJson<T>(text: string, isT: (value: unknown) => value is T): T | null {
  const parsed: { ok: true; value: unknown } | { ok: false } = (() => {
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch {
      return { ok: false };
    }
  })();
  if (!parsed.ok || !isT(parsed.value)) return null;
  return parsed.value;
}

export function enumValues<const T extends readonly string[]>(values: T) {
  const set = new Set<string>(values);
  const is = (x: string): x is T[number] => set.has(x);
  return { values, is };
}

export function withDefault<T extends string>(allowed: readonly T[], fallback: NoInfer<T>) {
  return (input: string): T => {
    for (const value of allowed) if (value === input) return value;
    return fallback;
  };
}
```
:::

:::variant{kind=wrong name=return-only-generic fails=types reason="parseJson 仍然只在返回值中使用类型参数，没有接收验证函数"}
```ts file=api.ts
export const log: string[] = [];

export function logValue(label: string, value: unknown): void {
  log.push(`${label}: ${JSON.stringify(value)}`);
}

export function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function enumValues<const T extends readonly string[]>(values: T) {
  return { values, is: (x: string): x is T[number] => values.includes(x) };
}

export function withDefault<T extends string>(allowed: readonly T[], fallback: NoInfer<T>): (input: string) => T {
  return (input) => allowed.find((a) => a === input) ?? fallback;
}
```
:::

:::variant{kind=wrong name=no-const fails=types reason="enumValues 没有 const 类型参数，values 被推断为 string[]"}
```ts file=api.ts
export const log: string[] = [];

export function logValue(label: string, value: unknown): void {
  log.push(`${label}: ${JSON.stringify(value)}`);
}

export function parseJson<T>(text: string, isT: (value: unknown) => value is T): T | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  return isT(value) ? value : null;
}

export function enumValues<T extends readonly string[]>(values: T) {
  return { values, is: (x: string): x is T[number] => values.includes(x) };
}

export function withDefault<T extends string>(allowed: readonly T[], fallback: NoInfer<T>): (input: string) => T {
  return (input) => allowed.find((a) => a === input) ?? fallback;
}
```
:::

:::variant{kind=wrong name=fallback-infers fails=types reason="fallback 参与了推断，不在列表中的默认值也能通过"}
```ts file=api.ts
export const log: string[] = [];

export function logValue(label: string, value: unknown): void {
  log.push(`${label}: ${JSON.stringify(value)}`);
}

export function parseJson<T>(text: string, isT: (value: unknown) => value is T): T | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  return isT(value) ? value : null;
}

export function enumValues<const T extends readonly string[]>(values: T) {
  return { values, is: (x: string): x is T[number] => values.includes(x) };
}

export function withDefault<T extends string>(allowed: readonly T[], fallback: T): (input: string) => T {
  return (input) => allowed.find((a) => a === input) ?? fallback;
}
```
:::

:::variant{kind=wrong name=ignores-guard fails=tests reason="parseJson 没有调用守卫，不符合的数据也被返回了"}
```ts file=api.ts
export const log: string[] = [];

export function logValue(label: string, value: unknown): void {
  log.push(`${label}: ${JSON.stringify(value)}`);
}

export function parseJson<T>(text: string, isT: (value: unknown) => value is T): T | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function enumValues<const T extends readonly string[]>(values: T) {
  return { values, is: (x: string): x is T[number] => values.includes(x) };
}

export function withDefault<T extends string>(allowed: readonly T[], fallback: NoInfer<T>): (input: string) => T {
  return (input) => allowed.find((a) => a === input) ?? fallback;
}
```
:::
