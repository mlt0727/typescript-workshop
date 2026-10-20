---
kind: challenge
title: 从字段定义推导表单的值
---
`schema.ts` 中已经定义了表单字段的描述 `Field`：

```ts
type Field =
  | { kind: 'text' }
  | { kind: 'number'; min?: number; max?: number }
  | { kind: 'checkbox' }
  | { kind: 'select'; options: readonly string[] };
```

完成：

1. **`ValueOf<F>`**：一个字段的值的类型。文本是 `string`，数字是 `number`，复选框是 `boolean`，下拉框是它的选项之一（`options` 是 `['free', 'pro']` 时就是 `'free' | 'pro'`）；
2. **`FormValues<S>`**：一组字段（对象，键是字段名）对应的值的类型，每个键的值是 `ValueOf<该字段>`；
3. **`SIGNUP`**：注册表单的字段：`email`（文本）、`age`（数字，最小 0，最大 150）、`plan`（下拉框，选项 `'free'`、`'pro'`）、`agree`（复选框）。要让它**既被检查**符合 `Record<string, Field>`，**又保留**每个字段的字面量类型（下拉框的选项要精确到 `'free' | 'pro'`）；导出 `type SignupValues = FormValues<typeof SIGNUP>`；
4. **`parseValue(field, raw)`**：把表单中读到的字符串 `raw` 按字段的类型解析，不合法时返回 `null`：
   - 文本：去掉首尾空白；
   - 数字：去掉首尾空白后为空、不是有限的数字、小于 `min` 或大于 `max` 时为 `null`，否则是这个数字；
   - 复选框：`raw` 是 `'on'` 时为 `true`，否则为 `false`（浏览器提交勾选的复选框时，值默认是 `'on'`）；
   - 下拉框：`raw` 是选项之一时就是它，否则为 `null`。

不能使用类型断言（`as const` 不是类型断言，可以使用）。

:::files{role=starter}
```ts file=schema.ts
export type Field =
  | { kind: 'text' }
  | { kind: 'number'; min?: number; max?: number }
  | { kind: 'checkbox' }
  | { kind: 'select'; options: readonly string[] };

export type ValueOf<F> = unknown;
export type FormValues<S> = Record<string, unknown>;

export const SIGNUP: Record<string, Field> = {
  email: { kind: 'text' },
};

export type SignupValues = FormValues<typeof SIGNUP>;

export function parseValue(field: Field, raw: string): string | number | boolean | null {
  return raw;
}
```
```ts file=main.ts
import { parseValue, SIGNUP, type SignupValues } from './schema';

const values: SignupValues = { email: 'ada@example.com', age: 36, plan: 'pro', agree: true };
console.log(values);
console.log(parseValue(SIGNUP.age, ' 200 '), parseValue(SIGNUP.plan, 'pro'), parseValue(SIGNUP.agree, 'on'));
```
:::

:::files{role=solution}
```ts file=schema.ts
export type Field =
  | { kind: 'text' }
  | { kind: 'number'; min?: number; max?: number }
  | { kind: 'checkbox' }
  | { kind: 'select'; options: readonly string[] };

export type ValueOf<F> = F extends { kind: 'text' }
  ? string
  : F extends { kind: 'number' }
    ? number
    : F extends { kind: 'checkbox' }
      ? boolean
      : F extends { kind: 'select'; options: readonly (infer O)[] }
        ? O
        : never;

export type FormValues<S> = { [K in keyof S]: ValueOf<S[K]> };

export const SIGNUP = {
  email: { kind: 'text' },
  age: { kind: 'number', min: 0, max: 150 },
  plan: { kind: 'select', options: ['free', 'pro'] },
  agree: { kind: 'checkbox' },
} as const satisfies Record<string, Field>;

export type SignupValues = FormValues<typeof SIGNUP>;

export function parseValue(field: Field, raw: string): string | number | boolean | null {
  switch (field.kind) {
    case 'text':
      return raw.trim();
    case 'number': {
      const text = raw.trim();
      const value = Number(text);
      if (text === '' || !Number.isFinite(value)) return null;
      if (field.min !== undefined && value < field.min) return null;
      if (field.max !== undefined && value > field.max) return null;
      return value;
    }
    case 'checkbox':
      return raw === 'on';
    case 'select':
      return field.options.includes(raw) ? raw : null;
  }
}
```
```ts file=main.ts
import { parseValue, SIGNUP, type SignupValues } from './schema';

const values: SignupValues = { email: 'ada@example.com', age: 36, plan: 'pro', agree: true };
console.log(values);
console.log(parseValue(SIGNUP.age, ' 200 '), parseValue(SIGNUP.plan, 'pro'), parseValue(SIGNUP.agree, 'on'));
```
:::

:::files{role=tests}
```ts file=schema.test.ts
import { describe, expect, test } from 'vitest';
import { parseValue, SIGNUP } from './schema';

describe('SIGNUP', () => {
  test('四个字段', () => {
    expect(SIGNUP).toEqual({
      email: { kind: 'text' },
      age: { kind: 'number', min: 0, max: 150 },
      plan: { kind: 'select', options: ['free', 'pro'] },
      agree: { kind: 'checkbox' },
    });
  });
});

describe('parseValue', () => {
  test('文本：去掉首尾空白', () => {
    expect(parseValue({ kind: 'text' }, '  ada@example.com ')).toBe('ada@example.com');
    expect(parseValue({ kind: 'text' }, '   ')).toBe('');
  });

  test('数字：范围与不合法的输入', () => {
    const age = { kind: 'number', min: 0, max: 150 } as const;
    expect(parseValue(age, ' 36 ')).toBe(36);
    expect(parseValue(age, '0')).toBe(0);
    expect(parseValue(age, '150')).toBe(150);
    expect(parseValue(age, '151')).toBeNull();
    expect(parseValue(age, '-1')).toBeNull();
    expect(parseValue(age, '')).toBeNull();
    expect(parseValue(age, '  ')).toBeNull();
    expect(parseValue(age, 'abc')).toBeNull();
    expect(parseValue(age, 'Infinity')).toBeNull();
    expect(parseValue({ kind: 'number' }, '-1e3')).toBe(-1000);
  });

  test('复选框：只有 on 是 true', () => {
    expect(parseValue({ kind: 'checkbox' }, 'on')).toBe(true);
    expect(parseValue({ kind: 'checkbox' }, '')).toBe(false);
    expect(parseValue({ kind: 'checkbox' }, 'true')).toBe(false);
  });

  test('下拉框：必须是选项之一', () => {
    const plan = { kind: 'select', options: ['free', 'pro'] } as const;
    expect(parseValue(plan, 'pro')).toBe('pro');
    expect(parseValue(plan, 'enterprise')).toBeNull();
    expect(parseValue(plan, ' pro')).toBeNull();
  });
});
```
```ts file=schema.test-d.ts
import { expectTypeOf } from 'vitest';
import type { SignupValues, ValueOf } from './schema';

expectTypeOf<ValueOf<{ kind: 'text' }>>().toEqualTypeOf<string>();
expectTypeOf<ValueOf<{ kind: 'number'; min: 0 }>>().toEqualTypeOf<number>();
expectTypeOf<ValueOf<{ kind: 'checkbox' }>>().toEqualTypeOf<boolean>();
expectTypeOf<ValueOf<{ kind: 'select'; options: readonly ['a', 'b', 'c'] }>>().toEqualTypeOf<'a' | 'b' | 'c'>();
expectTypeOf<ValueOf<{ kind: 'select'; options: readonly string[] }>>().toEqualTypeOf<string>();
expectTypeOf<ValueOf<{ kind: 'date' }>>().toEqualTypeOf<never>();

expectTypeOf<SignupValues>().toEqualTypeOf<{
  readonly email: string;
  readonly age: number;
  readonly plan: 'free' | 'pro';
  readonly agree: boolean;
}>();

// @ts-expect-error plan 只能是 'free' 或 'pro'
const wrongPlan: SignupValues = { email: '', age: 1, plan: 'gold', agree: false };
// @ts-expect-error 少了 agree
const missing: SignupValues = { email: '', age: 1, plan: 'free' };
console.log(wrongPlan, missing);
```
:::

:::hint{level=1}
`ValueOf<F>` 是四个条件串起来：`F extends { kind: 'text' } ? string : F extends { kind: 'number' } ? number : …`。下拉框的分支用 `infer` 取出选项的类型：`F extends { kind: 'select'; options: readonly (infer O)[] } ? O : never`。`FormValues<S>` 是一个映射类型：`{ [K in keyof S]: ValueOf<S[K]> }`。
:::

:::hint{level=2}
`SIGNUP` 写成 `{ … } as const satisfies Record<string, Field>`：`as const` 保留 `'text'`、`'free'` 这些字面量（以及元组），`satisfies` 检查它符合 `Field`，又不改变推断出的类型（b16）。如果写成类型注解 `: Record<string, Field>`，具体的字段名和选项就都丢了。`parseValue` 用 `switch (field.kind)`，每个分支中 `field` 被收窄成对应的成员（b09）。
:::

:::explanation
这道题把三课的内容连在了一起：

- `as const satisfies Record<string, Field>`（b16）：`SIGNUP` 被检查过，同时保留了最精确的类型，`typeof SIGNUP` 中 `plan.options` 是 `readonly ['free', 'pro']`。`satisfies` 这一半是测试检查不了的：只写 `as const`、字段又都写对了的时候，类型完全一样；它的作用是在你写错字段时（例如 `kind: 'txt'`）当场报错，而不是在用到 `SIGNUP` 的地方报出一个难懂的错误；
- 映射类型（c02）：`FormValues` 遍历每个字段；`SIGNUP` 的属性因为 `as const` 都是只读的，同态映射把 `readonly` 也保留了下来；
- 条件类型与 `infer`（本课）：按 `kind` 决定值的类型，下拉框再从 `options` 中取出选项的联合。

于是 `SignupValues` 完全由 `SIGNUP` 推导出来：加一个字段、改一个选项，值的类型自动跟着变，`plan: 'gold'` 这样的错误在编译期就能发现。

条件的**顺序**很重要：最具体的条件写在前面，或者像这里一样让每个条件互不重叠（每个分支检查不同的 `kind`）。如果第一个条件写成 `F extends { kind: string } ? string : …`，所有字段都会落进这个分支。

`parseValue` 的返回值写的是普通的联合 `string | number | boolean | null`，而不是 `ValueOf<F>`：正文讲过，把条件类型作为泛型函数的返回值，实现中的 `return` 无法通过检查。类型推导和运行时解析各做各的事，`switch (field.kind)` 中每个分支的收窄让实现保持类型安全。

`Number('')` 和 `Number('  ')` 都是 `0`，所以要先检查去掉空白后是否为空；`Number('Infinity')` 是 `Infinity`，用 `Number.isFinite` 排除。
:::

:::variant{kind=alt name=lookup-table}
```ts file=schema.ts
export type Field =
  | { kind: 'text' }
  | { kind: 'number'; min?: number; max?: number }
  | { kind: 'checkbox' }
  | { kind: 'select'; options: readonly string[] };

type Simple = { text: string; number: number; checkbox: boolean };

export type ValueOf<F> = F extends { kind: 'select'; options: readonly (infer O)[] }
  ? O
  : F extends { kind: infer K extends keyof Simple }
    ? Simple[K]
    : never;

export type FormValues<S> = { [K in keyof S]: ValueOf<S[K]> };

export const SIGNUP = {
  email: { kind: 'text' },
  age: { kind: 'number', min: 0, max: 150 },
  plan: { kind: 'select', options: ['free', 'pro'] },
  agree: { kind: 'checkbox' },
} as const satisfies Record<string, Field>;

export type SignupValues = FormValues<typeof SIGNUP>;

function parseNumber(raw: string, min = -Infinity, max = Infinity): number | null {
  if (!/\S/.test(raw)) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= min && value <= max ? value : null;
}

export function parseValue(field: Field, raw: string): string | number | boolean | null {
  if (field.kind === 'text') return raw.trim();
  if (field.kind === 'number') return parseNumber(raw, field.min, field.max);
  if (field.kind === 'checkbox') return raw === 'on';
  return field.options.find((option) => option === raw) ?? null;
}
```
:::

:::variant{kind=wrong name=general-first fails=types reason="最宽泛的条件写在最前面，所有字段的值都成了 string"}
```ts file=schema.ts
export type Field =
  | { kind: 'text' }
  | { kind: 'number'; min?: number; max?: number }
  | { kind: 'checkbox' }
  | { kind: 'select'; options: readonly string[] };

export type ValueOf<F> = F extends { kind: string }
  ? string
  : F extends { kind: 'number' }
    ? number
    : F extends { kind: 'checkbox' }
      ? boolean
      : F extends { kind: 'select'; options: readonly (infer O)[] }
        ? O
        : never;

export type FormValues<S> = { [K in keyof S]: ValueOf<S[K]> };

export const SIGNUP = {
  email: { kind: 'text' },
  age: { kind: 'number', min: 0, max: 150 },
  plan: { kind: 'select', options: ['free', 'pro'] },
  agree: { kind: 'checkbox' },
} as const satisfies Record<string, Field>;

export type SignupValues = FormValues<typeof SIGNUP>;

export function parseValue(field: Field, raw: string): string | number | boolean | null {
  switch (field.kind) {
    case 'text':
      return raw.trim();
    case 'number': {
      const text = raw.trim();
      const value = Number(text);
      if (text === '' || !Number.isFinite(value)) return null;
      if (field.min !== undefined && value < field.min) return null;
      if (field.max !== undefined && value > field.max) return null;
      return value;
    }
    case 'checkbox':
      return raw === 'on';
    case 'select':
      return field.options.includes(raw) ? raw : null;
  }
}
```
:::

:::variant{kind=wrong name=annotated-schema fails=types reason="用类型注解代替 satisfies，字段名和选项都丢了"}
```ts file=schema.ts
export type Field =
  | { kind: 'text' }
  | { kind: 'number'; min?: number; max?: number }
  | { kind: 'checkbox' }
  | { kind: 'select'; options: readonly string[] };

export type ValueOf<F> = F extends { kind: 'text' }
  ? string
  : F extends { kind: 'number' }
    ? number
    : F extends { kind: 'checkbox' }
      ? boolean
      : F extends { kind: 'select'; options: readonly (infer O)[] }
        ? O
        : never;

export type FormValues<S> = { [K in keyof S]: ValueOf<S[K]> };

export const SIGNUP: Record<string, Field> = {
  email: { kind: 'text' },
  age: { kind: 'number', min: 0, max: 150 },
  plan: { kind: 'select', options: ['free', 'pro'] },
  agree: { kind: 'checkbox' },
};

export type SignupValues = FormValues<typeof SIGNUP>;

export function parseValue(field: Field, raw: string): string | number | boolean | null {
  switch (field.kind) {
    case 'text':
      return raw.trim();
    case 'number': {
      const text = raw.trim();
      const value = Number(text);
      if (text === '' || !Number.isFinite(value)) return null;
      if (field.min !== undefined && value < field.min) return null;
      if (field.max !== undefined && value > field.max) return null;
      return value;
    }
    case 'checkbox':
      return raw === 'on';
    case 'select':
      return field.options.includes(raw) ? raw : null;
  }
}
```
:::

:::variant{kind=wrong name=empty-is-zero fails=tests reason="没有检查空字符串，Number('') 是 0，空输入被当成了 0"}
```ts file=schema.ts
export type Field =
  | { kind: 'text' }
  | { kind: 'number'; min?: number; max?: number }
  | { kind: 'checkbox' }
  | { kind: 'select'; options: readonly string[] };

export type ValueOf<F> = F extends { kind: 'text' }
  ? string
  : F extends { kind: 'number' }
    ? number
    : F extends { kind: 'checkbox' }
      ? boolean
      : F extends { kind: 'select'; options: readonly (infer O)[] }
        ? O
        : never;

export type FormValues<S> = { [K in keyof S]: ValueOf<S[K]> };

export const SIGNUP = {
  email: { kind: 'text' },
  age: { kind: 'number', min: 0, max: 150 },
  plan: { kind: 'select', options: ['free', 'pro'] },
  agree: { kind: 'checkbox' },
} as const satisfies Record<string, Field>;

export type SignupValues = FormValues<typeof SIGNUP>;

export function parseValue(field: Field, raw: string): string | number | boolean | null {
  switch (field.kind) {
    case 'text':
      return raw.trim();
    case 'number': {
      const value = Number(raw);
      if (!Number.isFinite(value)) return null;
      if (field.min !== undefined && value < field.min) return null;
      if (field.max !== undefined && value > field.max) return null;
      return value;
    }
    case 'checkbox':
      return raw === 'on';
    case 'select':
      return field.options.includes(raw) ? raw : null;
  }
}
```
:::

:::variant{kind=wrong name=select-unchecked fails=tests reason="下拉框没有检查是不是选项之一"}
```ts file=schema.ts
export type Field =
  | { kind: 'text' }
  | { kind: 'number'; min?: number; max?: number }
  | { kind: 'checkbox' }
  | { kind: 'select'; options: readonly string[] };

export type ValueOf<F> = F extends { kind: 'text' }
  ? string
  : F extends { kind: 'number' }
    ? number
    : F extends { kind: 'checkbox' }
      ? boolean
      : F extends { kind: 'select'; options: readonly (infer O)[] }
        ? O
        : never;

export type FormValues<S> = { [K in keyof S]: ValueOf<S[K]> };

export const SIGNUP = {
  email: { kind: 'text' },
  age: { kind: 'number', min: 0, max: 150 },
  plan: { kind: 'select', options: ['free', 'pro'] },
  agree: { kind: 'checkbox' },
} as const satisfies Record<string, Field>;

export type SignupValues = FormValues<typeof SIGNUP>;

export function parseValue(field: Field, raw: string): string | number | boolean | null {
  switch (field.kind) {
    case 'text':
      return raw.trim();
    case 'number': {
      const text = raw.trim();
      const value = Number(text);
      if (text === '' || !Number.isFinite(value)) return null;
      if (field.min !== undefined && value < field.min) return null;
      if (field.max !== undefined && value > field.max) return null;
      return value;
    }
    case 'checkbox':
      return raw === 'on';
    case 'select':
      return raw.trim() === '' ? null : raw;
  }
}
```
:::
