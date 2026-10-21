---
version: 1
mode: ts
estimatedMinutes: 50
review: self-reviewed
problem: f06 的测试检查的是运行时的行为。可是对一个泛型函数或者工具类型来说，“类型对不对”本身就是功能：pick(user, ['name']) 的返回值类型应该只有 name；传入不存在的键应该在编译期报错；某次重构让返回值悄悄变成了 any，运行时的测试一个也不会失败，调用方却失去了全部检查。这一课学会写类型测试：用 expectTypeOf 断言类型完全相等，用 @ts-expect-error 断言某段代码不能通过编译，并知道这两种写法各自的陷阱。
objectives:
  - 说明类型测试的用途：保护泛型函数、工具类型和公开 API 的类型，发现悄悄出现的 any
  - 用 expectTypeOf 的 toEqualTypeOf、toExtend、parameter、returns、toBeCallableWith 等断言类型
  - 用 @ts-expect-error 断言“不能通过编译”，并避免它被别的错误满足
  - 在本机用 vitest --typecheck 运行类型测试，读懂失败的输出
references:
  - title: Testing Types — Vitest
    url: https://vitest.dev/guide/testing-types
    checked: 2026-10-20
  - title: expectTypeOf — Vitest API
    url: https://vitest.dev/api/expect-typeof
    checked: 2026-10-20
  - title: expect-type — GitHub
    url: https://github.com/mmkal/expect-type
    checked: 2026-10-20
  - title: TypeScript 3.9（// @ts-expect-error Comments）— TypeScript
    url: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-9.html
    checked: 2026-10-20
---

## 为什么要测试类型

前面很多练习中都有 `*.test-d.ts` 文件，它们就是类型测试：不运行，只做类型检查。什么时候值得自己写？

- **泛型函数和工具类型**：例如 b15 中带 `K extends keyof T` 约束的函数，c06 的 `DistributiveOmit`，c05 从路径中取出参数名的 `Params`，它们的“输出”就是类型，运行时的测试检查不到；
- **公开的 API**：别人会依赖你的类型。一次重构让返回值从 `User` 变成了 `User | undefined`，调用方的代码就会报错；
- **防止 `any` 悄悄出现**（c10）：返回值变成 `any` 时，运行时什么都不会变，但调用方失去了所有检查。普通的赋值检查也发现不了它，因为 `any` 可以赋值给任何类型。

## expectTypeOf

`expectTypeOf`（来自 [expect-type](https://github.com/mmkal/expect-type) 库，Vitest 从 `vitest` 中重新导出）的用法和 `expect` 相似，但断言的是类型。它在运行时什么也不做，错误由 TypeScript 在编译时报告：

```ts
import { expectTypeOf } from 'vitest';
import { pick } from './pick';

const user = { id: 1, name: 'Ada', admin: true };

expectTypeOf(pick(user, ['id', 'name'])).toEqualTypeOf<{ id: number; name: string }>();
expectTypeOf(pick).parameter(1).toEqualTypeOf<readonly ('id' | 'name' | 'admin')[]>(); // 类型错误！见下文
expectTypeOf(pick).returns.not.toBeAny();
```

| 写法 | 含义 |
| --- | --- |
| `expectTypeOf(x).toEqualTypeOf<T>()` | 类型**完全**相等。多一个属性、少一个属性、`any` 都不行 |
| `expectTypeOf(x).toExtend<T>()` | 能赋值给 `T`（可以有多余的属性） |
| `expectTypeOf(x).toMatchObjectType<T>()` | 列出的属性完全相等，其余的属性不管 |
| `expectTypeOf<T>()` | 不需要值，直接检查一个类型：`expectTypeOf<Pick<User, 'id'>>().toEqualTypeOf<{ id: number }>()` |
| `.parameter(0)`、`.parameters`、`.returns` | 函数的第一个参数、参数元组、返回值 |
| `.resolves`、`.items` | Promise 完成时的值、数组元素 |
| `.toBeCallableWith(…)` | 能用这些参数调用 |
| `.not`、`.toBeAny()`、`.toBeNever()` | 取反；是不是 `any`、`never` |

上面第二行是一个有用的“错误”：`pick` 是泛型函数，`.parameter(1)` 看到的不是某一次调用，而是把类型参数换成**约束**之后的签名：`T` 成了 `object`，`K` 成了 `keyof object`，也就是 `never`，所以第二个参数的类型是 `readonly never[]`（实际检查得到的）。检查泛型函数在某次调用中的类型，要像第一行那样检查一次具体调用的结果。

**`toEqualTypeOf` 还是 `toExtend`？** 默认用 `toEqualTypeOf`。`toExtend` 只检查“能不能赋值”，返回值多了不该有的属性、或者变成了 `any`，它都会通过。（旧版本中的 `toMatchTypeOf` 从 expect-type 1.2 起已不推荐使用，改用 `toExtend` 或 `toMatchObjectType`。）

`assertType<T>(value)` 是更简单的写法，只检查 `value` 能不能赋值给 `T`，同样拦不住 `any`。

## @ts-expect-error：断言“不能通过编译”

“传入不存在的键要报错”这样的规格，用 `// @ts-expect-error` 测试：它让 TypeScript **期望**下一行有错误。下一行确实有错误时，错误被消除；下一行没有错误时，这条注释本身报 TS2578（“未使用的 @ts-expect-error 指令”）。所以它正好是一个“这里必须报错”的断言：

:::playground{#expect-error expect="2578@main.ts:12"}
```ts file=main.ts
function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const result: Partial<Pick<T, K>> = {};
  for (const key of keys) result[key] = obj[key];
  return result as Pick<T, K>; // 循环结束后每个键都有值；c10 讲过的“关在函数里”的断言
}

const user = { id: 1, name: 'Ada', admin: true };

// @ts-expect-error 没有这个键
pick(user, ['email']);

// @ts-expect-error 这一行其实没有错误
pick(user, ['name']);
```
- 第 9 行的注释被第 10 行的错误“用掉”了，没有报错。
- 第 12 行的注释下面没有错误，于是它自己报 TS2578：断言失败。真实的类型测试中，这表示“本应报错的代码通过了编译”，也就是类型变宽了。
:::

`@ts-expect-error` 有一个陷阱：**任何**错误都能满足它。

```ts
// @ts-expect-error 应该报错：没有这个键
pick(usr, ['email']); // usr 拼错了：报错的原因是“找不到 usr”，测试照样通过
```

所以：让被检查的那一行尽可能短，只包含要测试的那一个错误；在注释中写明期望的是什么错误；改动类型之后，看一眼这些行是不是还因为原来的原因报错。也不要用 `@ts-ignore` 代替它：`@ts-ignore` 在没有错误时也不会报告，什么都测试不了。

## 在自己的电脑上运行

类型测试的文件名以 `.test-d.ts` 结尾，Vitest 用 `--typecheck` 选项运行它们（会先提示这是一个实验性的功能）。Vitest 要求类型测试也写在 `test()` 中，否则报告“没有找到测试”；这个网站的练习中可以直接写在顶层。在 f06 的项目中写一个 `pick.ts` 和 `pick.test-d.ts`，其中一个断言故意写错：

```ts
import { describe, expectTypeOf, test } from 'vitest';
import { pick } from './pick.ts';

const user = { id: 1, name: 'Ada', admin: true };

describe('pick 的类型', () => {
  test('结果只有选出的键', () => {
    expectTypeOf(pick(user, ['id', 'name'])).toEqualTypeOf<{ id: number; name: string }>();
  });

  test('键的类型不变', () => {
    expectTypeOf(pick(user, ['id'])).toEqualTypeOf<{ id: string }>();
  });
});
```

运行 `npx vitest --typecheck --run`，实际的输出（节选）：

```text
 FAIL  src/pick.test-d.ts:11 > pick 的类型 > 键的类型不变
TypeCheckError: Type '{ id string; }' does not satisfy the constraint '{ id "Expected string, Actual number"; }'.
  Types of property 'id' are incompatible.
    Type 'string' is not assignable to type '"Expected string, Actual number"'.
 ❯ src/pick.test-d.ts:12:52
```

expect-type 的错误信息是用类型“拼”出来的：在出错的属性上写着期望的和实际的类型（编辑器和 `tsc` 中显示为 `Expected: string, Actual: number`）。编辑器中能直接看到同样的红线，不运行 Vitest 也可以。

::exercise{#test-pick-types}

## 编程挑战

::exercise{#test-href}

::quiz

## 常见错误

- **用 `toExtend` 或 `assertType` 检查返回值**：`any` 和多余的属性都能通过。检查“就是这个类型”用 `toEqualTypeOf`。
- **在泛型函数上直接检查 `.parameter`、`.returns`**：得到的是没有代入类型参数的签名。检查一次具体调用的结果。
- **`@ts-expect-error` 被别的错误满足**：拼错一个变量名，测试照样“通过”。被检查的行要短，只包含要测试的错误。
- **用 `@ts-ignore` 写“应该报错”的测试**：它在没有错误时不报告，什么也测不出来。
- **只写“能通过编译”的测试**：类型测试同样要检查“不能通过编译”的情况：不存在的键、缺少的参数、错误的参数类型。
