---
kind: task
title: 解析注册表单
mode: ts
---
实现 `parseSignup(data)`：把注册表单的 `FormData` 解析成类型明确的数据，或者每个字段的错误信息。规则如下（所有错误都要收集，不要遇到第一个就返回）：

| 字段 | 规则（按顺序检查，每个字段只报告第一条不满足的） | 错误信息 |
| --- | --- | --- |
| `name` | 去掉首尾空白后不能为空 | `请填写昵称` |
|  | 最多 20 个字符 | `昵称最多 20 个字符` |
| `email` | 去掉首尾空白后不能为空 | `请填写邮箱` |
|  | 符合 `^[^\s@]+@[^\s@]+\.[^\s@]+$` | `邮箱格式不正确` |
| `age` | 去掉首尾空白后不能为空 | `请填写年龄` |
|  | 只能包含数字 0–9 | `年龄必须是整数` |
|  | 在 13 到 120 之间（包含两端） | `年龄必须在 13 到 120 之间` |
| `password` | 至少 8 个字符（**不**去掉空白） | `密码至少 8 个字符` |
| `confirm` | 与 `password` 完全相同 | `两次输入的密码不一致` |

“字符”按字符串的 `length` 计算（和 HTML 的 `maxlength` 一样，一个 emoji 可能算 2 个）。成功时 `value` 中是去掉首尾空白的 `name`、`email`，数字类型的 `age`，以及原样的 `password`。字段的值不是字符串（例如是文件）或者不存在时，当作空字符串处理。

:::files{role=starter}
```ts file=parse.ts
export type SignupData = { name: string; email: string; age: number; password: string };
export type Field = keyof SignupData | 'confirm';
export type ParseResult =
  | { ok: true; value: SignupData }
  | { ok: false; errors: Partial<Record<Field, string>> };

export function parseSignup(data: FormData): ParseResult {
  return {
    ok: true,
    value: {
      name: String(data.get('name')),
      email: String(data.get('email')),
      age: Number(data.get('age')),
      password: String(data.get('password')),
    },
  };
}
```
:::

:::files{role=solution}
```ts file=parse.ts
export type SignupData = { name: string; email: string; age: number; password: string };
export type Field = keyof SignupData | 'confirm';
export type ParseResult =
  | { ok: true; value: SignupData }
  | { ok: false; errors: Partial<Record<Field, string>> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function raw(data: FormData, name: Field): string {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}

export function parseSignup(data: FormData): ParseResult {
  const errors: Partial<Record<Field, string>> = {};

  const name = raw(data, 'name').trim();
  if (name === '') errors.name = '请填写昵称';
  else if (name.length > 20) errors.name = '昵称最多 20 个字符';

  const email = raw(data, 'email').trim();
  if (email === '') errors.email = '请填写邮箱';
  else if (!EMAIL.test(email)) errors.email = '邮箱格式不正确';

  const ageText = raw(data, 'age').trim();
  const age = Number(ageText);
  if (ageText === '') errors.age = '请填写年龄';
  else if (!/^\d+$/.test(ageText)) errors.age = '年龄必须是整数';
  else if (age < 13 || age > 120) errors.age = '年龄必须在 13 到 120 之间';

  const password = raw(data, 'password');
  if (password.length < 8) errors.password = '密码至少 8 个字符';
  if (raw(data, 'confirm') !== password) errors.confirm = '两次输入的密码不一致';

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: { name, email, age, password } };
}
```
:::

:::files{role=tests}
```ts file=parse.test.ts
import { describe, expect, test } from 'vitest';
import { parseSignup } from './parse';

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

const valid = { name: '  Ada  ', email: ' ada@example.com ', age: ' 36 ', password: 'correct horse', confirm: 'correct horse' };

function errorsOf(fields: Record<string, string>) {
  const result = parseSignup(form(fields));
  return result.ok ? {} : result.errors;
}

describe('parseSignup', () => {
  test('合法的输入：去掉空白、年龄转换成数字', () => {
    expect(parseSignup(form(valid))).toEqual({
      ok: true,
      value: { name: 'Ada', email: 'ada@example.com', age: 36, password: 'correct horse' },
    });
  });

  test('昵称', () => {
    expect(errorsOf({ ...valid, name: '   ' })).toEqual({ name: '请填写昵称' });
    expect(errorsOf({ ...valid, name: 'a'.repeat(21) })).toEqual({ name: '昵称最多 20 个字符' });
    expect(errorsOf({ ...valid, name: ` ${'a'.repeat(20)} ` })).toEqual({});
  });

  test('邮箱', () => {
    expect(errorsOf({ ...valid, email: '' })).toEqual({ email: '请填写邮箱' });
    expect(errorsOf({ ...valid, email: 'ada@example' })).toEqual({ email: '邮箱格式不正确' });
    expect(errorsOf({ ...valid, email: 'a da@example.com' })).toEqual({ email: '邮箱格式不正确' });
  });

  test('年龄：空、不是整数、超出范围', () => {
    expect(errorsOf({ ...valid, age: '' })).toEqual({ age: '请填写年龄' });
    for (const bad of ['18.5', 'abc', '1e2', '-20', '0x10']) {
      expect(errorsOf({ ...valid, age: bad }), `年龄 ${bad}`).toEqual({ age: '年龄必须是整数' });
    }
    expect(errorsOf({ ...valid, age: '12' })).toEqual({ age: '年龄必须在 13 到 120 之间' });
    expect(errorsOf({ ...valid, age: '121' })).toEqual({ age: '年龄必须在 13 到 120 之间' });
    expect(errorsOf({ ...valid, age: '13' })).toEqual({});
    expect(errorsOf({ ...valid, age: '120' })).toEqual({});
  });

  test('密码与确认密码', () => {
    expect(errorsOf({ ...valid, password: 'short', confirm: 'short' })).toEqual({ password: '密码至少 8 个字符' });
    expect(errorsOf({ ...valid, confirm: 'correct horse ' })).toEqual({ confirm: '两次输入的密码不一致' });
    expect(errorsOf({ ...valid, password: '        ', confirm: '        ' })).toEqual({});
  });

  test('收集所有字段的错误', () => {
    expect(errorsOf({})).toEqual({
      name: '请填写昵称',
      email: '请填写邮箱',
      age: '请填写年龄',
      password: '密码至少 8 个字符',
    });
  });

  test('不是字符串的值当作空字符串', () => {
    const data = form({ ...valid });
    data.set('name', new File(['x'], 'name.txt'));
    const result = parseSignup(data);
    expect(result.ok ? {} : result.errors).toEqual({ name: '请填写昵称' });
  });
});
```
```ts file=parse.test-d.ts
import { expectTypeOf } from 'vitest';
import { parseSignup, type SignupData } from './parse';

const result = parseSignup(new FormData());
if (result.ok) {
  expectTypeOf(result.value).toEqualTypeOf<SignupData>();
} else {
  expectTypeOf(result.errors.age).toEqualTypeOf<string | undefined>();
}
```
:::

:::hint{level=1}
先写一个小函数 `raw(data, name)`：`data.get(name)` 是字符串就返回它，否则返回 `''`。然后对每个字段按顺序检查，把错误信息写进 `const errors: Partial<Record<Field, string>> = {}`，最后看 `errors` 里有没有内容。
:::

:::hint{level=2}
年龄先检查空字符串，再用正则 `/^\d+$/` 检查“只有数字”，最后才 `Number(...)` 并检查范围——直接 `Number('')` 会得到 `0`，`Number('1e2')` 会得到 `100`，都会绕过检查。`Object.keys(errors).length > 0` 时返回 `{ ok: false, errors }`。
:::

:::explanation
解析函数是表单与程序其他部分之间的**边界**：进来的是类型不确定的 `FormDataEntryValue | null`，出去的要么是类型明确、已经验证过的 `SignupData`，要么是错误列表。之后的代码只需要检查 `result.ok`，不必再关心某个值是不是文件、是不是空字符串、能不能转换成数字。

年龄的检查顺序很重要：`Number` 的转换规则很宽松，`Number('')` 是 `0`，`Number(' 18 ')` 是 `18`，`Number('1e2')` 是 `100`，`Number('0x10')` 是 `16`。先用正则确认格式，再转换，才能得到预期的结果。

起始代码用 `String(data.get(...))`：值是 `null` 时得到字符串 `"null"`，是文件时得到 `"[object File]"`，这些都会被当作“已经填写”。
:::

:::variant{kind=alt name=rule-table}
```ts file=parse.ts
export type SignupData = { name: string; email: string; age: number; password: string };
export type Field = keyof SignupData | 'confirm';
export type ParseResult =
  | { ok: true; value: SignupData }
  | { ok: false; errors: Partial<Record<Field, string>> };

type Rule = [test: (value: string) => boolean, message: string];

function firstError(value: string, rules: readonly Rule[]): string | undefined {
  return rules.find(([ok]) => !ok(value))?.[1];
}

function field(data: FormData, name: Field): string {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}

export function parseSignup(data: FormData): ParseResult {
  const name = field(data, 'name').trim();
  const email = field(data, 'email').trim();
  const ageText = field(data, 'age').trim();
  const password = field(data, 'password');
  const confirm = field(data, 'confirm');

  const found: [Field, string | undefined][] = [
    ['name', firstError(name, [[(v) => v !== '', '请填写昵称'], [(v) => v.length <= 20, '昵称最多 20 个字符']])],
    ['email', firstError(email, [[(v) => v !== '', '请填写邮箱'], [(v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), '邮箱格式不正确']])],
    [
      'age',
      firstError(ageText, [
        [(v) => v !== '', '请填写年龄'],
        [(v) => /^\d+$/.test(v), '年龄必须是整数'],
        [(v) => Number(v) >= 13 && Number(v) <= 120, '年龄必须在 13 到 120 之间'],
      ]),
    ],
    ['password', firstError(password, [[(v) => v.length >= 8, '密码至少 8 个字符']])],
    ['confirm', firstError(confirm, [[(v) => v === password, '两次输入的密码不一致']])],
  ];

  const errors: Partial<Record<Field, string>> = {};
  for (const [key, message] of found) {
    if (message !== undefined) errors[key] = message;
  }
  return Object.keys(errors).length === 0
    ? { ok: true, value: { name, email, age: Number(ageText), password } }
    : { ok: false, errors };
}
```
:::

:::variant{kind=wrong name=first-error-only fails=tests reason="遇到第一个错误就返回，没有收集所有字段的错误"}
```ts file=parse.ts
export type SignupData = { name: string; email: string; age: number; password: string };
export type Field = keyof SignupData | 'confirm';
export type ParseResult =
  | { ok: true; value: SignupData }
  | { ok: false; errors: Partial<Record<Field, string>> };

function raw(data: FormData, name: Field): string {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}

export function parseSignup(data: FormData): ParseResult {
  const name = raw(data, 'name').trim();
  if (name === '') return { ok: false, errors: { name: '请填写昵称' } };
  if (name.length > 20) return { ok: false, errors: { name: '昵称最多 20 个字符' } };
  const email = raw(data, 'email').trim();
  if (email === '') return { ok: false, errors: { email: '请填写邮箱' } };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, errors: { email: '邮箱格式不正确' } };
  const ageText = raw(data, 'age').trim();
  if (ageText === '') return { ok: false, errors: { age: '请填写年龄' } };
  if (!/^\d+$/.test(ageText)) return { ok: false, errors: { age: '年龄必须是整数' } };
  const age = Number(ageText);
  if (age < 13 || age > 120) return { ok: false, errors: { age: '年龄必须在 13 到 120 之间' } };
  const password = raw(data, 'password');
  if (password.length < 8) return { ok: false, errors: { password: '密码至少 8 个字符' } };
  if (raw(data, 'confirm') !== password) return { ok: false, errors: { confirm: '两次输入的密码不一致' } };
  return { ok: true, value: { name, email, age, password } };
}
```
:::

:::variant{kind=wrong name=number-before-format fails=tests reason="先用 Number 转换再判断，空字符串变成 0，1e2 变成 100"}
```ts file=parse.ts
export type SignupData = { name: string; email: string; age: number; password: string };
export type Field = keyof SignupData | 'confirm';
export type ParseResult =
  | { ok: true; value: SignupData }
  | { ok: false; errors: Partial<Record<Field, string>> };

function raw(data: FormData, name: Field): string {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}

export function parseSignup(data: FormData): ParseResult {
  const errors: Partial<Record<Field, string>> = {};
  const name = raw(data, 'name').trim();
  if (name === '') errors.name = '请填写昵称';
  else if (name.length > 20) errors.name = '昵称最多 20 个字符';
  const email = raw(data, 'email').trim();
  if (email === '') errors.email = '请填写邮箱';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = '邮箱格式不正确';
  const age = Number(raw(data, 'age'));
  if (!Number.isInteger(age)) errors.age = '年龄必须是整数';
  else if (age < 13 || age > 120) errors.age = '年龄必须在 13 到 120 之间';
  const password = raw(data, 'password');
  if (password.length < 8) errors.password = '密码至少 8 个字符';
  if (raw(data, 'confirm') !== password) errors.confirm = '两次输入的密码不一致';
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value: { name, email, age, password } };
}
```
:::

:::variant{kind=wrong name=string-conversion fails=tests reason="用 String() 转换，null 变成 'null'、文件变成 '[object File]'"}
```ts file=parse.ts
export type SignupData = { name: string; email: string; age: number; password: string };
export type Field = keyof SignupData | 'confirm';
export type ParseResult =
  | { ok: true; value: SignupData }
  | { ok: false; errors: Partial<Record<Field, string>> };

export function parseSignup(data: FormData): ParseResult {
  const errors: Partial<Record<Field, string>> = {};
  const name = String(data.get('name')).trim();
  if (name === '') errors.name = '请填写昵称';
  else if (name.length > 20) errors.name = '昵称最多 20 个字符';
  const email = String(data.get('email')).trim();
  if (email === '') errors.email = '请填写邮箱';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = '邮箱格式不正确';
  const ageText = String(data.get('age')).trim();
  if (ageText === '') errors.age = '请填写年龄';
  else if (!/^\d+$/.test(ageText)) errors.age = '年龄必须是整数';
  else if (Number(ageText) < 13 || Number(ageText) > 120) errors.age = '年龄必须在 13 到 120 之间';
  const password = String(data.get('password'));
  if (password.length < 8) errors.password = '密码至少 8 个字符';
  if (String(data.get('confirm')) !== password) errors.confirm = '两次输入的密码不一致';
  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, value: { name, email, age: Number(ageText), password } };
}
```
:::

:::variant{kind=wrong name=loose-result-type fails=types reason="结果没有用可辨识联合，检查 ok 之后 TypeScript 无法知道 value 一定存在"}
```ts file=parse.ts
export type SignupData = { name: string; email: string; age: number; password: string };
export type Field = keyof SignupData | 'confirm';
export type ParseResult = { ok: boolean; value?: SignupData; errors: Partial<Record<Field, string>> };

function raw(data: FormData, name: Field): string {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}

export function parseSignup(data: FormData): ParseResult {
  const errors: Partial<Record<Field, string>> = {};
  const name = raw(data, 'name').trim();
  if (name === '') errors.name = '请填写昵称';
  else if (name.length > 20) errors.name = '昵称最多 20 个字符';
  const email = raw(data, 'email').trim();
  if (email === '') errors.email = '请填写邮箱';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = '邮箱格式不正确';
  const ageText = raw(data, 'age').trim();
  if (ageText === '') errors.age = '请填写年龄';
  else if (!/^\d+$/.test(ageText)) errors.age = '年龄必须是整数';
  else if (Number(ageText) < 13 || Number(ageText) > 120) errors.age = '年龄必须在 13 到 120 之间';
  const password = raw(data, 'password');
  if (password.length < 8) errors.password = '密码至少 8 个字符';
  if (raw(data, 'confirm') !== password) errors.confirm = '两次输入的密码不一致';
  const ok = Object.keys(errors).length === 0;
  return { ok, value: ok ? { name, email, age: Number(ageText), password } : undefined, errors };
}
```
:::
