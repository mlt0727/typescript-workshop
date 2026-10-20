---
kind: task
title: 属性名与 CSS 长度
---
在 `strings.ts` 中：

1. **`EventProp<E>`**：事件名对应的属性名，`'click'` 是 `'onClick'`，`'keyDown'` 是 `'onKeyDown'`（`on` 加上首字母大写的事件名）；
2. **`Setters<T>`**：为 `T` 的每个**字符串**键 `k` 生成一个 `set` 加首字母大写的 `k` 的方法，参数是这个属性的类型，返回 `void`。数字键、symbol 键不生成；
3. **`DataKeys<T>`**：`T` 中值**不是函数**的键组成的联合；
4. **`CssLength`**：数字加上单位 `px`、`rem` 或 `%` 的字符串，例如 `'12px'`、`'1.5rem'`、`'-2px'`、`'50%'`；
5. **`isCssLength(value)`**：运行时的类型守卫，判断一个字符串是不是 `CssLength`。运行时只接受：可选的负号、整数部分、可选的小数部分（`.` 加数字），紧接着单位，前后没有空白。

:::files{role=starter}
```ts file=strings.ts
export type EventProp<E extends string> = string;
export type Setters<T> = Record<string, (value: unknown) => void>;
export type DataKeys<T> = keyof T;
export type CssLength = string;

export function isCssLength(value: string): value is CssLength {
  return value.endsWith('px');
}
```
```ts file=main.ts
import { isCssLength, type EventProp } from './strings';

const prop: EventProp<'click'> = 'onClick';
for (const raw of ['12px', '1.5rem', '50%', 'px', '12 px']) {
  console.log(raw, isCssLength(raw));
}
console.log(prop);
```
:::

:::files{role=solution}
```ts file=strings.ts
export type EventProp<E extends string> = `on${Capitalize<E>}`;
export type Setters<T> = { [K in keyof T as `set${Capitalize<K & string>}`]: (value: T[K]) => void };
export type DataKeys<T> = { [K in keyof T]: T[K] extends (...args: never[]) => unknown ? never : K }[keyof T];
export type CssLength = `${number}${'px' | 'rem' | '%'}`;

export function isCssLength(value: string): value is CssLength {
  return /^-?\d+(\.\d+)?(px|rem|%)$/.test(value);
}
```
```ts file=main.ts
import { isCssLength, type EventProp } from './strings';

const prop: EventProp<'click'> = 'onClick';
for (const raw of ['12px', '1.5rem', '50%', 'px', '12 px']) {
  console.log(raw, isCssLength(raw));
}
console.log(prop);
```
:::

:::files{role=tests}
```ts file=strings.test.ts
import { describe, expect, test } from 'vitest';
import { isCssLength } from './strings';

describe('isCssLength', () => {
  test('数字加单位', () => {
    for (const ok of ['12px', '0px', '1.5rem', '-2px', '50%', '100.25%']) expect(isCssLength(ok), ok).toBe(true);
  });

  test('缺少数字、单位不对、有空白、格式不完整', () => {
    for (const bad of ['px', '12', '12em', '12 px', ' 12px', '12px ', '1.px', '.5rem', '--1px', '12pxx', '']) {
      expect(isCssLength(bad), bad).toBe(false);
    }
  });
});
```
```ts file=strings.test-d.ts
import { expectTypeOf } from 'vitest';
import { isCssLength, type CssLength, type DataKeys, type EventProp, type Setters } from './strings';

expectTypeOf<EventProp<'click'>>().toEqualTypeOf<'onClick'>();
expectTypeOf<EventProp<'click' | 'keyDown'>>().toEqualTypeOf<'onClick' | 'onKeyDown'>();

type Profile = { name: string; age: number; 0: boolean; save(): void };
expectTypeOf<Setters<Pick<Profile, 'name' | 'age' | 0>>>().toEqualTypeOf<{
  setName: (value: string) => void;
  setAge: (value: number) => void;
}>();
expectTypeOf<DataKeys<Profile>>().toEqualTypeOf<'name' | 'age' | 0>();

const a: CssLength = '12px';
const b: CssLength = '1.5rem';
const c: CssLength = '-2%';
// @ts-expect-error 缺少数字
const d: CssLength = 'px';
// @ts-expect-error 单位不对
const e: CssLength = '12em';
console.log(a, b, c, d, e);

const raw: string = '3rem';
if (isCssLength(raw)) expectTypeOf(raw).toEqualTypeOf<CssLength>();
```
:::

:::hint{level=1}
`EventProp` 是 `` `on${Capitalize<E>}` ``；`CssLength` 是 `` `${number}${'px' | 'rem' | '%'}` ``。`Setters` 是一个映射类型，用 `as` 给键改名：`[K in keyof T as `set${Capitalize<K & string>}`]`。
:::

:::hint{level=2}
`K & string` 让数字键、symbol 键变成 `never`，改名之后它们就被去掉了。`DataKeys` 先映射出“值是函数时为 `never`，否则为键本身”的对象，再用 `[keyof T]` 取出所有的值。`isCssLength` 用正则表达式，记得写 `^` 和 `$`，否则 `' 12px'` 也会匹配。
:::

:::explanation
模板字面量类型让“有结构的字符串”有了类型：`CssLength` 只接受数字加单位，`'12em'` 在编译期就会报错。但它只管**写在代码里的字面量**。用户输入的字符串是 `string`，要在运行时用 `isCssLength` 检查，检查通过之后类型守卫才把它收窄成 `CssLength`。

运行时的规则比类型更严格是可以的，反过来不行：类型守卫返回 `true` 时，这个值必须真的符合 `CssLength`。`${number}` 接受所有 JavaScript 能解析成数字的写法（例如 `'1e3px'`），而这里的正则只接受最常见的写法，所以守卫是“保守”的：它说是，就一定是。

`Capitalize<K & string>` 中的 `& string` 不能省略：`keyof T` 可能包含数字键和 symbol 键，`Capitalize` 只接受字符串，直接写 `Capitalize<K>` 会报 TS2344。
:::

:::variant{kind=alt name=helpers}
```ts file=strings.ts
type Cap<S> = S extends string ? Capitalize<S> : never;

export type EventProp<E extends string> = `on${Cap<E>}`;
export type Setters<T> = { [K in keyof T as K extends string ? `set${Cap<K>}` : never]: (value: T[K]) => void };
export type DataKeys<T> = keyof { [K in keyof T as T[K] extends (...args: never[]) => unknown ? never : K]: T[K] };
export type CssLength = `${number}px` | `${number}rem` | `${number}%`;

const UNITS = ['px', 'rem', '%'];

export function isCssLength(value: string): value is CssLength {
  const unit = UNITS.find((u) => value.endsWith(u));
  if (unit === undefined) return false;
  const number = value.slice(0, -unit.length);
  return /^-?[0-9]+(?:\.[0-9]+)?$/.test(number);
}
```
:::

:::variant{kind=wrong name=no-anchors fails=tests reason="正则表达式没有写 ^ 和 $，带空白和多余字符的字符串也匹配了"}
```ts file=strings.ts
export type EventProp<E extends string> = `on${Capitalize<E>}`;
export type Setters<T> = { [K in keyof T as `set${Capitalize<K & string>}`]: (value: T[K]) => void };
export type DataKeys<T> = { [K in keyof T]: T[K] extends (...args: never[]) => unknown ? never : K }[keyof T];
export type CssLength = `${number}${'px' | 'rem' | '%'}`;

export function isCssLength(value: string): value is CssLength {
  return /-?\d+(\.\d+)?(px|rem|%)/.test(value);
}
```
:::

:::variant{kind=wrong name=keeps-functions fails=types reason="DataKeys 没有去掉值是函数的键"}
```ts file=strings.ts
export type EventProp<E extends string> = `on${Capitalize<E>}`;
export type Setters<T> = { [K in keyof T as `set${Capitalize<K & string>}`]: (value: T[K]) => void };
export type DataKeys<T> = { [K in keyof T]: T[K] extends (...args: never[]) => unknown ? K : K }[keyof T];
export type CssLength = `${number}${'px' | 'rem' | '%'}`;

export function isCssLength(value: string): value is CssLength {
  return /^-?\d+(\.\d+)?(px|rem|%)$/.test(value);
}
```
:::

:::variant{kind=wrong name=setter-any-value fails=types reason="setter 的参数是 unknown，没有和属性的类型对应"}
```ts file=strings.ts
export type EventProp<E extends string> = `on${Capitalize<E>}`;
export type Setters<T> = { [K in keyof T as `set${Capitalize<K & string>}`]: (value: unknown) => void };
export type DataKeys<T> = { [K in keyof T]: T[K] extends (...args: never[]) => unknown ? never : K }[keyof T];
export type CssLength = `${number}${'px' | 'rem' | '%'}`;

export function isCssLength(value: string): value is CssLength {
  return /^-?\d+(\.\d+)?(px|rem|%)$/.test(value);
}
```
:::
