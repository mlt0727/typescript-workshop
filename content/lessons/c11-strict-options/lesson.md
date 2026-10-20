---
version: 1
mode: ts
estimatedMinutes: 40
review: self-reviewed
problem: 同样一段代码，换一个 tsconfig 可能从“没有错误”变成十几个错误。这些差别大多来自 strict 系列的编译选项。本课程的所有练习一直在严格的配置下运行，你已经在不知不觉中依赖它们：null 必须先检查，数组下标的结果可能是 undefined，catch 到的值是 unknown。这一课把这些选项摊开来讲：strict 包含哪些检查，TypeScript 6.0 起它为什么默认开启，哪些有用的选项不在 strict 里（noUncheckedIndexedAccess、exactOptionalPropertyTypes 等），以及在一个已有的项目中怎样一步步打开它们。
objectives:
  - 说明 strict 包含的主要检查（noImplicitAny、strictNullChecks、strictFunctionTypes 等）各自防止什么问题
  - 知道 TypeScript 6.0 起 strict 默认开启，以及显式写出它的理由
  - 理解不在 strict 中的 noUncheckedIndexedAccess、exactOptionalPropertyTypes、noPropertyAccessFromIndexSignature、noImplicitOverride 的作用和代价
  - 在开启这些选项后修改代码，使它们通过检查而且行为更正确
references:
  - title: TSConfig Reference（strict）
    url: https://www.typescriptlang.org/tsconfig/#strict
    checked: 2026-10-20
  - title: TSConfig Reference（noUncheckedIndexedAccess）
    url: https://www.typescriptlang.org/tsconfig/#noUncheckedIndexedAccess
    checked: 2026-10-20
  - title: TSConfig Reference（exactOptionalPropertyTypes）
    url: https://www.typescriptlang.org/tsconfig/#exactOptionalPropertyTypes
    checked: 2026-10-20
  - title: Announcing TypeScript 6.0 — TypeScript Blog
    url: https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/
    checked: 2026-10-20
---

## strict 是一组选项

`"strict": true` 不是一个检查，而是一次打开一组检查的开关。其中最重要的几个：

| 选项 | 防止什么 | 典型的诊断 |
| --- | --- | --- |
| `noImplicitAny` | 推断不出类型的地方悄悄变成 `any` | TS7006：参数隐式具有 `any` 类型 |
| `strictNullChecks` | 把可能是 `null`/`undefined` 的值当作确定的值使用 | TS18047、TS2322 |
| `strictFunctionTypes` | 函数类型的参数按错误的方向赋值（c03 讲过逆变） | TS2322 |
| `strictPropertyInitialization` | 类的字段声明了却没有在构造函数中赋值 | TS2564 |
| `useUnknownInCatchVariables` | `catch (e)` 的 `e` 被当作 `any` | TS18046（在 `e` 上读属性） |
| `strictBindCallApply`、`noImplicitThis`、`strictBuiltinIteratorReturn` | `call`/`apply` 的参数、`this` 的类型、内置迭代器 `next()` 的返回值 | |

**TypeScript 6.0 起，`strict` 默认就是 `true`**：不写这个选项，得到的也是严格的检查（以前的版本默认是 `false`）。仍然建议在 `tsconfig.json` 中显式写出 `"strict": true`：读配置的人一眼就能看到，项目也不依赖编译器版本的默认值。

`strict` 的成员会随着 TypeScript 版本变化。升级 TypeScript 之后出现新的错误，往往是 `strict` 里多了一项检查（例如 5.6 加入的 `strictBuiltinIteratorReturn`）。这是有意的：严格的配置意味着“接受以后新增的检查”。以前的成员 `alwaysStrict`（输出的 JavaScript 使用严格模式）在 6.0 中移出了 `strict`：6.0 起所有代码都按严格模式处理，`"alwaysStrict": false` 已被弃用。

## 关掉 strictNullChecks 会怎样

:::playground{#no-null-checks options="strictNullChecks=false" note="这个示例关闭了 strictNullChecks，用来展示没有它时 TypeScript 放过了什么。" run=error}
```ts file=main.ts
type User = { name: string; nickname: string | null };

function findUser(users: User[], name: string): User | undefined {
  return users.find((u) => u.name === name);
}

const users: User[] = [{ name: 'Ada', nickname: null }];
const lin = findUser(users, 'Lin');
console.log(lin.name);
```
- 关闭 `strictNullChecks` 之后，`null` 和 `undefined` 可以赋给任何类型，`User | undefined` 也就等于 `User`。第 9 行没有任何错误，运行时却抛出 `TypeError`：没有找到 `Lin`。
- 把这一节课的设置（默认开启）放回来，第 9 行会报 TS18048：`'lin' is possibly 'undefined'`。这就是本课程所有练习一直在做的检查。
:::

## 不在 strict 里的严格选项

还有一些选项不在 `strict` 中，因为它们会让大量正确的旧代码报错，或者需要更多的书写。本课程的配置开启了其中的 `noUncheckedIndexedAccess`：

- **`noUncheckedIndexedAccess`**：通过下标（`arr[i]`）和索引签名（`record[key]`）读取的值都带上 `| undefined`，数组解构 `const [first] = arr` 也一样。它防止“越界读取”这一类非常常见的错误（a10）。代价是确实存在的值也要检查，所以遍历数组时优先用 `for…of`、`map` 等不经过下标的写法，它们得到的元素不带 `undefined`；
- **`exactOptionalPropertyTypes`**：可选属性 `bio?: string` 表示“可以没有这个属性”，但**不能**显式地写 `bio: undefined`。c06 的补丁问题（显式的 `undefined` 覆盖了原来的值）在这个选项下会被编译器拦住。需要“可以是 `undefined`”时，要明确地写成 `bio?: string | undefined`；
- **`noPropertyAccessFromIndexSignature`**：来自索引签名的属性必须用方括号读取（`stock['apple']` 而不是 `stock.apple`），让“这个键可能不存在”在代码中一目了然；
- **`noImplicitOverride`**：子类覆盖父类的方法时必须写 `override`，父类的方法改名或删除时，子类中失去作用的“覆盖”会报错。

:::playground{#exact-optional expect="2375@main.ts:5" options="exactOptionalPropertyTypes=true" note="这个示例开启了 exactOptionalPropertyTypes，展示它怎样拦住显式的 undefined。"}
```ts file=main.ts
type Profile = { name: string; bio?: string };
type ProfilePatch = { name?: string; bio?: string | null };

const ada: Profile = { name: 'Ada' };
const broken: Profile = { name: 'Ada', bio: undefined };

function applyPatch(profile: Profile, patch: ProfilePatch): Profile {
  const next: Profile = { ...profile };
  if (patch.name !== undefined) next.name = patch.name;
  if (patch.bio === null) delete next.bio;
  else if (patch.bio !== undefined) next.bio = patch.bio;
  return next;
}

console.log(ada, broken, applyPatch({ name: 'Ada', bio: '数学家' }, { bio: null }));
```
- 第 5 行报 TS2375：开启选项之后，`bio?: string` 不接受显式的 `undefined`。
- 第 2 行用 `null` 表示“清除简介”：这样“没有给出”（属性不存在）和“要清除”（`null`）是两种不同的意思，不会混在一起。
- 第 10 行：清除时用 `delete` 删除属性，而不是赋值 `undefined`（那样同样会报错）。
:::

## 在已有的项目中打开它们

一次打开所有的选项，可能得到成百上千个错误。比较稳妥的顺序：

1. 先开 `noImplicitAny`：找出所有没有类型的地方，这一步通常能发现真正的错误；
2. 再开 `strictNullChecks`：它带来的错误最多，也最有价值；
3. 然后是 `strict` 中其余的检查，最后考虑 `noUncheckedIndexedAccess`、`exactOptionalPropertyTypes` 这些更严格的选项；
4. 暂时修不完的地方用 `// @ts-expect-error` 加上原因标出来，而不是关掉选项。它们以后被修好时，编译器会提醒你删除注释（c10）。

新项目则直接从最严格的配置开始，`tsc --init` 生成的配置已经开启了 `strict`，F 阶段的 Vite 项目也是如此。

::exercise{#exact-patch}

## 编程挑战

::exercise{#stricter-report}

::quiz

## 常见错误

- **以为 `strict` 只是一个选项**：它是一组检查，而且会随版本增加。
- **为了消除错误而关掉 `strict`**：错误还在，只是看不见了。逐个修复，修不完的用 `@ts-expect-error` 标出来。
- **开启 `noUncheckedIndexedAccess` 后到处写 `!`**：非空断言让检查失去意义。改用 `for…of`、`find` 加检查，或者先判断 `undefined`。
- **在 `exactOptionalPropertyTypes` 下用赋值 `undefined` 来“删除”属性**：会报错。用 `delete`，或者用解构排除这个属性。
- **以为默认值和显式写出没有区别**：显式写出 `"strict": true` 让配置不依赖编译器的版本。
