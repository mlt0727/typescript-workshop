---
kind: task
title: 按字段校验表单
---
在 `validate.ts` 中：

1. 导出两个映射类型：`Validators<T>`，每个字段**可以**有一个校验函数，参数是这个字段的值（类型与字段一致），返回错误信息或 `null`；`Errors<T>`，每个字段**可以**有一条错误信息（`string`）；
2. 实现 **`validateForm(values, validators)`**：对每一个提供了的校验函数，用对应字段的值调用它；返回所有的错误，没有错误的字段不出现在结果中（不是值为 `undefined`，而是没有这个属性）；
3. 实现 **`hasErrors(errors)`**：有没有任何错误。

调用时，校验函数的参数不需要写类型：`validateForm({ age: 16 }, { age: (v) => … })` 中 `v` 应该被推断为 `number`。不能使用类型断言。

:::files{role=starter}
```ts file=validate.ts
export type Validators<T> = Record<string, (value: unknown) => string | null>;
export type Errors<T> = Record<string, string>;

export function validateForm<T>(values: T, validators: Validators<T>): Errors<T> {
  return {};
}

export function hasErrors<T>(errors: Errors<T>): boolean {
  return false;
}
```
```ts file=main.ts
import { hasErrors, validateForm } from './validate';

const errors = validateForm(
  { email: 'ada.example.com', age: 16, agree: true },
  {
    email: (value) => (value.includes('@') ? null : '邮箱格式不正确'),
    age: (value) => (value >= 18 ? null : '需要年满 18 岁'),
  },
);
console.log(errors, hasErrors(errors));
```
:::

:::files{role=solution}
```ts file=validate.ts
export type Validators<T> = { [K in keyof T]?: (value: T[K]) => string | null };
export type Errors<T> = { [K in keyof T]?: string };

export function validateForm<T>(values: T, validators: Validators<T>): Errors<T> {
  const errors: Errors<T> = {};
  for (const key in validators) {
    const check = validators[key];
    if (check === undefined) continue;
    const message = check(values[key]);
    if (message !== null) errors[key] = message;
  }
  return errors;
}

export function hasErrors<T>(errors: Errors<T>): boolean {
  return Object.keys(errors).length > 0;
}
```
```ts file=main.ts
import { hasErrors, validateForm } from './validate';

const errors = validateForm(
  { email: 'ada.example.com', age: 16, agree: true },
  {
    email: (value) => (value.includes('@') ? null : '邮箱格式不正确'),
    age: (value) => (value >= 18 ? null : '需要年满 18 岁'),
  },
);
console.log(errors, hasErrors(errors));
```
:::

:::files{role=tests}
```ts file=validate.test.ts
import { describe, expect, test } from 'vitest';
import { hasErrors, validateForm } from './validate';

const values = { email: 'ada.example.com', age: 16, nickname: 'Ada' };

describe('validateForm', () => {
  test('收集每个字段的错误', () => {
    const errors = validateForm(values, {
      email: (v) => (v.includes('@') ? null : '邮箱格式不正确'),
      age: (v) => (v >= 18 ? null : '需要年满 18 岁'),
    });
    expect(errors).toEqual({ email: '邮箱格式不正确', age: '需要年满 18 岁' });
  });

  test('没有错误的字段不出现在结果中', () => {
    const errors = validateForm(values, {
      email: () => null,
      age: (v) => (v >= 18 ? null : '需要年满 18 岁'),
    });
    expect(Object.keys(errors)).toEqual(['age']);
  });

  test('只调用提供了的校验函数，每个调用一次，参数是对应字段的值', () => {
    const calls: unknown[] = [];
    validateForm(values, {
      nickname: (v) => {
        calls.push(v);
        return null;
      },
    });
    expect(calls).toEqual(['Ada']);
  });

  test('空字符串也是一条错误信息', () => {
    expect(validateForm(values, { nickname: () => '' })).toEqual({ nickname: '' });
  });
});

describe('hasErrors', () => {
  test('有没有任何错误', () => {
    expect(hasErrors({})).toBe(false);
    expect(hasErrors({ age: '需要年满 18 岁' })).toBe(true);
  });
});
```
```ts file=validate.test-d.ts
import { expectTypeOf } from 'vitest';
import { validateForm, type Errors, type Validators } from './validate';

type Form = { email: string; age: number };

expectTypeOf<Validators<Form>>().toEqualTypeOf<{
  email?: (value: string) => string | null;
  age?: (value: number) => string | null;
}>();
expectTypeOf<Errors<Form>>().toEqualTypeOf<{ email?: string; age?: string }>();

validateForm({ email: '', age: 1 }, {
  age: (v) => {
    expectTypeOf(v).toEqualTypeOf<number>();
    return null;
  },
});
// @ts-expect-error 不存在的字段
validateForm({ email: '', age: 1 }, { emial: () => null });
// @ts-expect-error 校验函数的参数类型与字段不一致
validateForm({ email: '', age: 1 }, { age: (v: string) => v });
```
:::

:::hint{level=1}
`Validators<T>` 写成 `{ [K in keyof T]?: (value: T[K]) => string | null }`，`Errors<T>` 写成 `{ [K in keyof T]?: string }`。属性都是可选的，所以 `const errors: Errors<T> = {}` 是合法的起点。
:::

:::hint{level=2}
用 `for (const key in validators)` 遍历提供了的校验函数：`validators[key]` 可能是 `undefined`（属性可选），先检查；然后 `check(values[key])`，结果不是 `null` 就写进 `errors[key]`。`hasErrors` 用 `Object.keys(errors).length > 0`。
:::

:::explanation
起始代码用 `Record<string, …>` 描述校验函数：任何字符串都可以作为键，参数都是 `unknown`。于是 `value.includes('@')` 报错，而写错字段名 `emial` 反倒不会报错，正好和我们想要的相反。

映射类型把 `Validators<T>` 和 `T` 的键一一对应起来，并让每个函数的参数类型是 `T[K]`。调用 `validateForm(values, validators)` 时，`T` 从第一个参数推断出来，第二个参数的类型随之确定，所以校验函数的参数不需要写类型，写错字段名会报“对象字面量只能指定已知属性”。

实现中最关键的一行是 `check(values[key])`：`check` 来自 `validators[key]`，参数类型是 `T[typeof key]`；`values[key]` 的类型也是 `T[typeof key]`。同一个 `key` 把两边连在一起，所以不需要断言。

“没有错误的字段不出现”这条规则让 `Object.keys(errors).length` 就能判断有没有错误；如果写成 `errors[key] = message ?? undefined`，对象里会留下值为 `undefined` 的属性，`hasErrors` 就会误报。
:::

:::variant{kind=alt name=entries-loop}
```ts file=validate.ts
export type Validators<T> = { [K in keyof T]?: (value: T[K]) => string | null };
export type Errors<T> = { [K in keyof T]?: string };

export function validateForm<T>(values: T, validators: Validators<T>): Errors<T> {
  const errors: Errors<T> = {};
  for (const key in values) {
    const message = validators[key]?.(values[key]) ?? null;
    if (message === null) continue;
    errors[key] = message;
  }
  return errors;
}

export function hasErrors<T>(errors: Errors<T>): boolean {
  for (const key in errors) {
    if (Object.hasOwn(errors, key)) return true;
  }
  return false;
}
```
:::

:::variant{kind=wrong name=unknown-values fails=types reason="校验函数的参数写成 unknown，调用方得不到字段的类型"}
```ts file=validate.ts
export type Validators<T> = { [K in keyof T]?: (value: unknown) => string | null };
export type Errors<T> = { [K in keyof T]?: string };

export function validateForm<T>(values: T, validators: Validators<T>): Errors<T> {
  const errors: Errors<T> = {};
  for (const key in validators) {
    const check = validators[key];
    if (check === undefined) continue;
    const message = check(values[key]);
    if (message !== null) errors[key] = message;
  }
  return errors;
}

export function hasErrors<T>(errors: Errors<T>): boolean {
  return Object.keys(errors).length > 0;
}
```
:::

:::variant{kind=wrong name=keeps-undefined fails=tests reason="没有错误的字段也写进了结果（值为 undefined）"}
```ts file=validate.ts
export type Validators<T> = { [K in keyof T]?: (value: T[K]) => string | null };
export type Errors<T> = { [K in keyof T]?: string };

export function validateForm<T>(values: T, validators: Validators<T>): Errors<T> {
  const errors: Errors<T> = {};
  for (const key in validators) {
    const check = validators[key];
    if (check === undefined) continue;
    errors[key] = check(values[key]) ?? undefined;
  }
  return errors;
}

export function hasErrors<T>(errors: Errors<T>): boolean {
  return Object.keys(errors).length > 0;
}
```
:::

:::variant{kind=wrong name=first-error-only fails=tests reason="遇到第一个错误就返回，后面的字段没有校验"}
```ts file=validate.ts
export type Validators<T> = { [K in keyof T]?: (value: T[K]) => string | null };
export type Errors<T> = { [K in keyof T]?: string };

export function validateForm<T>(values: T, validators: Validators<T>): Errors<T> {
  const errors: Errors<T> = {};
  for (const key in validators) {
    const check = validators[key];
    if (check === undefined) continue;
    const message = check(values[key]);
    if (message !== null) {
      errors[key] = message;
      return errors;
    }
  }
  return errors;
}

export function hasErrors<T>(errors: Errors<T>): boolean {
  return Object.keys(errors).length > 0;
}
```
:::

:::variant{kind=wrong name=truthy-message fails=tests reason="用 if (message) 判断，空字符串的错误信息被丢掉了"}
```ts file=validate.ts
export type Validators<T> = { [K in keyof T]?: (value: T[K]) => string | null };
export type Errors<T> = { [K in keyof T]?: string };

export function validateForm<T>(values: T, validators: Validators<T>): Errors<T> {
  const errors: Errors<T> = {};
  for (const key in validators) {
    const check = validators[key];
    if (check === undefined) continue;
    const message = check(values[key]);
    if (message) errors[key] = message;
  }
  return errors;
}

export function hasErrors<T>(errors: Errors<T>): boolean {
  return Object.keys(errors).length > 0;
}
```
:::
