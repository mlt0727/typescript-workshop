---
kind: task
title: 为 pick 写类型测试
grading: tests
allow: [ts-directive]
---
`pick.ts`（只读）中是 c06 见过的 `pick(obj, keys)`：从对象中取出指定的键组成新对象。它的**类型**规格是：

1. 返回值的类型正好是选出的那几个键（`pick(user, ['id', 'name'])` 是 `{ id: number; name: string }`），不是 `any`，也没有别的属性；
2. 原来可选的属性仍然是可选的；
3. `keys` 可以是只读数组（例如 `as const` 得到的）；
4. `keys` 中只能是 `obj` 的键，否则编译错误；`obj` 必须是对象，否则编译错误。

在 `pick.test-d.ts` 中写类型测试。平台准备了六个“类型写错了”的 `pick.ts`（运行时的行为都一样），你的测试要发现每一个：要么某个 `expectTypeOf` 报错，要么某个 `@ts-expect-error` 下面没有了错误。

:::files{role=support}
```ts file=pick.ts readonly
/** 从对象中取出指定的键，组成一个新对象 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const result: Partial<Pick<T, K>> = {};
  for (const key of keys) result[key] = obj[key];
  return result as Pick<T, K>;
}
```
:::

:::files{role=starter}
```ts file=pick.test-d.ts
import { expectTypeOf } from 'vitest';
import { pick } from './pick';

const user = { id: 1, name: 'Ada', admin: true };

expectTypeOf(pick(user, ['id', 'name'])).toExtend<{ id: number; name: string }>();
```
:::

:::files{role=solution}
```ts file=pick.test-d.ts
import { expectTypeOf } from 'vitest';
import { pick } from './pick';

const user = { id: 1, name: 'Ada', admin: true };
type Profile = { nickname: string; bio?: string };
declare const profile: Profile;

// 返回值正好是选出的键：不是 any，没有多余的属性，也不是可选的
expectTypeOf(pick(user, ['id', 'name'])).toEqualTypeOf<{ id: number; name: string }>();
// 可选的属性仍然是可选的
expectTypeOf(pick(profile, ['bio'])).toEqualTypeOf<{ bio?: string }>();
// 键可以来自只读的数组
const keys = ['admin'] as const;
expectTypeOf(pick(user, keys)).toEqualTypeOf<{ admin: boolean }>();

// @ts-expect-error 没有这个键
pick(user, ['email']);
// @ts-expect-error 只能从对象中取
pick(42, []);
```
:::

:::mutant{name=returns-any hint="返回值的类型是 any：调用方失去了全部检查。toExtend 和 assertType 都发现不了它，要用 toEqualTypeOf"}
```ts file=pick.ts
/** 从对象中取出指定的键，组成一个新对象 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): any {
  const result: Partial<Pick<T, K>> = {};
  for (const key of keys) result[key] = obj[key];
  return result;
}
```
:::

:::mutant{name=returns-partial hint="返回值的每个属性都成了可选的"}
```ts file=pick.ts
/** 从对象中取出指定的键，组成一个新对象 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Partial<Pick<T, K>> {
  const result: Partial<Pick<T, K>> = {};
  for (const key of keys) result[key] = obj[key];
  return result;
}
```
:::

:::mutant{name=returns-whole hint="返回值的类型是整个 T：没有选出的属性也出现在类型中。要检查类型“正好是”选出的那几个键"}
```ts file=pick.ts
/** 从对象中取出指定的键，组成一个新对象 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): T {
  const result: Partial<Pick<T, K>> = {};
  for (const key of keys) result[key] = obj[key];
  return result as T;
}
```
:::

:::mutant{name=loose-keys hint="键可以是任意的字符串：pick(user, ['email']) 也能通过编译。需要一个“不存在的键应该报错”的测试"}
```ts file=pick.ts
/** 从对象中取出指定的键，组成一个新对象 */
export function pick<T extends object, K extends PropertyKey>(obj: T, keys: readonly K[]): Pick<T, Extract<K, keyof T>> {
  const source: Record<PropertyKey, unknown> = Object.fromEntries(Object.entries(obj));
  const result: Record<PropertyKey, unknown> = {};
  for (const key of keys) if (key in source) result[key] = source[key];
  return result as Pick<T, Extract<K, keyof T>>;
}
```
:::

:::mutant{name=any-input hint="第一个参数没有限制为对象：pick(42, []) 也能通过编译"}
```ts file=pick.ts
/** 从对象中取出指定的键，组成一个新对象 */
export function pick<T, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const result: Partial<Pick<T, K>> = {};
  for (const key of keys) result[key] = obj[key];
  return result as Pick<T, K>;
}
```
:::

:::mutant{name=required-optional hint="可选的属性变成了必需的：Pick 会保留 ? 修饰符，这个版本用 Required 去掉了它"}
```ts file=pick.ts
/** 从对象中取出指定的键，组成一个新对象 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Required<Pick<T, K>> {
  const result: Partial<Pick<T, K>> = {};
  for (const key of keys) result[key] = obj[key];
  return result as Required<Pick<T, K>>;
}
```
:::

:::hint{level=1}
起始代码用的是 `toExtend`：它只检查“能不能赋值”，`any` 和多出属性的对象都能通过。把它换成 `toEqualTypeOf`，再按规格逐条补上：一个有可选属性的类型（可以用 `declare const profile: { nickname: string; bio?: string }` 得到一个这种类型的值，不需要真的创建它）、一个 `as const` 的键数组。
:::

:::hint{level=2}
第 4 条用 `@ts-expect-error`：`pick(user, ['email'])` 和 `pick(42, [])` 两行各自上面写一条。被检查的行只写这一个调用，避免别的错误满足了这条注释。
:::

:::explanation
六个错误的版本运行时完全一样，只有类型不同，所以只有类型测试能发现它们：

| 错误的类型 | 发现它的测试 |
| --- | --- |
| 返回 `any` | `toEqualTypeOf`（`toExtend` 会通过） |
| 返回整个 `T` | `toEqualTypeOf`（多了 `admin`） |
| 每个属性都可选 | `toEqualTypeOf` 或 `toExtend` |
| 可选的属性变成必需的 | 有可选属性的类型 + `toEqualTypeOf` |
| 键可以是任意字符串 | `@ts-expect-error` 加上不存在的键 |
| 第一个参数不限制为对象 | `@ts-expect-error` 加上 `pick(42, [])` |

两类断言互相补充：`toEqualTypeOf` 检查“能通过编译的调用，类型是对的”，`@ts-expect-error` 检查“不该通过编译的调用，确实不能通过”。只写前一类，类型变宽了也发现不了；只写后一类，返回值变成 `any` 也发现不了。

`declare const profile: Profile` 是类型测试中常用的技巧：只需要一个这种类型的值来做类型检查，测试从来不会运行，所以不需要真的创建它。
:::

:::variant{kind=alt name=describe-blocks}
```ts file=pick.test-d.ts
import { describe, expectTypeOf, test } from 'vitest';
import { pick } from './pick';

type Book = { title: string; year: number; isbn?: string; tags: string[] };
declare const book: Book;

describe('pick 的类型', () => {
  test('只有选出的键，类型不变', () => {
    const picked = pick(book, ['title', 'tags']);
    expectTypeOf(picked).not.toBeAny();
    expectTypeOf(picked).toEqualTypeOf<Pick<Book, 'title' | 'tags'>>();
    expectTypeOf(pick(book, ['isbn'])).toEqualTypeOf<Pick<Book, 'isbn'>>();
  });

  test('不允许的调用', () => {
    // @ts-expect-error 不存在的键
    pick(book, ['author']);
    // @ts-expect-error 不是对象
    pick('book', ['length']);
  });
});
```
:::

:::variant{kind=wrong name=uses-toextend fails=mutants misses=returns-any,returns-whole,required-optional reason="用 toExtend 检查返回值：any、多出的属性、去掉了可选的属性，都“能赋值”"}
```ts file=pick.test-d.ts
import { expectTypeOf } from 'vitest';
import { pick } from './pick';

const user = { id: 1, name: 'Ada', admin: true };
type Profile = { nickname: string; bio?: string };
declare const profile: Profile;

expectTypeOf(pick(user, ['id', 'name'])).toExtend<{ id: number; name: string }>();
expectTypeOf(pick(profile, ['bio'])).toExtend<{ bio?: string }>();

// @ts-expect-error 没有这个键
pick(user, ['email']);
// @ts-expect-error 只能从对象中取
pick(42, []);
```
:::

:::variant{kind=wrong name=ts-ignore fails=mutants misses=loose-keys,any-input reason="用 @ts-ignore 写“应该报错”的测试：没有错误时它也不报告，什么都测不出来"}
```ts file=pick.test-d.ts
import { expectTypeOf } from 'vitest';
import { pick } from './pick';

const user = { id: 1, name: 'Ada', admin: true };
type Profile = { nickname: string; bio?: string };
declare const profile: Profile;

expectTypeOf(pick(user, ['id', 'name'])).toEqualTypeOf<{ id: number; name: string }>();
expectTypeOf(pick(profile, ['bio'])).toEqualTypeOf<{ bio?: string }>();

// @ts-ignore 没有这个键
pick(user, ['email']);
// @ts-ignore 只能从对象中取
pick(42, []);
```
:::

:::variant{kind=wrong name=wrong-expectation fails=types reason="期望写错了：id 的类型是 number，不是 string，测试在正确的实现上就不能通过编译"}
```ts file=pick.test-d.ts
import { expectTypeOf } from 'vitest';
import { pick } from './pick';

const user = { id: 1, name: 'Ada', admin: true };

expectTypeOf(pick(user, ['id'])).toEqualTypeOf<{ id: string }>();
// @ts-expect-error 没有这个键
pick(user, ['email']);
```
:::
