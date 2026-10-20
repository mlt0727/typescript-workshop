---
version: 1
mode: ts
estimatedMinutes: 40
review: self-reviewed
problem: 一个 User 类型往往会派生出好几个“兄弟”：创建时不需要 id 和 createdAt，修改时每个字段都可以省略，列表中只显示 id 和 name。TypeScript 内置的工具类型 Partial、Required、Readonly、Pick、Omit、Record 正是为这些场合准备的，它们都是 c02 那样的映射类型。这一课学会挑选合适的工具，同时认识它们的几个陷阱：Omit 不检查键名，Partial 的补丁可以把字段“改成” undefined 而类型却毫无察觉，Omit 作用在联合类型上会把各个成员搅在一起。
objectives:
  - 用 Partial、Required、Readonly、Pick、Omit、Record 从一个类型派生出创建、修改、展示等场合需要的类型
  - 知道 Omit 不检查要去掉的键是否存在，以及 Pick 会检查
  - 识别 Partial 补丁中显式的 undefined 带来的问题，并在实现中正确处理
  - 知道 Omit 作用在联合类型上不会分布，并写出分布式的 Omit
references:
  - title: Utility Types — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/utility-types.html
    checked: 2026-10-20
  - title: TypeScript 3.5 Release Notes（The Omit helper type）
    url: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-5.html
    checked: 2026-10-20
---

## 六个常用的工具类型

| 工具 | 含义 | 典型用途 |
| --- | --- | --- |
| `Partial<T>` | 每个属性都可选 | 修改的“补丁”、选项对象 |
| `Required<T>` | 每个属性都必需（同时去掉 `undefined`） | 填好默认值之后的完整配置 |
| `Readonly<T>` | 每个属性都只读（只有一层） | 不应被修改的状态 |
| `Pick<T, K>` | 只保留键 `K` | 列表中显示的摘要 |
| `Omit<T, K>` | 去掉键 `K` | 创建时由服务器生成的字段不用传 |
| `Record<K, V>` | 键是 `K`、值都是 `V` 的对象 | 查找表、按状态分组 |

它们都是映射类型：`Partial<T>` 就是 `{ [P in keyof T]?: T[P] }`，`Pick<T, K extends keyof T>` 是 `{ [P in K]: T[P] }`，`Record<K extends keyof any, T>` 是 `{ [P in K]: T }`，`Omit<T, K>` 是 `Pick<T, Exclude<keyof T, K>>`。读过 c02 和 c04，这些定义都能看懂了。

```ts
type User = { id: string; name: string; email: string; bio?: string; createdAt: Date };

type NewUser = Omit<User, 'id' | 'createdAt'>; // 创建时传入
type UserPatch = Partial<Pick<User, 'name' | 'email' | 'bio'>>; // 修改时传入，只能改这三项
type UserSummary = Pick<User, 'id' | 'name'>; // 列表中显示
```

`Record<'email' | 'sms' | 'push', boolean>` 要求三个键**都**写上；如果只是“可能有其中一些”，用 `Partial<Record<…>>`。

## 陷阱一：Omit 不检查键名

`Pick<User, 'nmae'>` 会报错，因为 `Pick` 的 `K` 约束为 `keyof T`。而 `Omit<User, 'nmae'>` 不会报错：标准库中 `Omit` 的 `K` 只约束为 `keyof any`（任何字符串、数字、symbol），于是拼错的键名被悄悄忽略，`Omit<User, 'nmae'>` 就是 `User` 本身。需要检查时，可以自己包一层：

```ts
type StrictOmit<T, K extends keyof T> = Omit<T, K>;
```

## 陷阱二：Partial 补丁中的 undefined

在默认的配置下（没有开启 `exactOptionalPropertyTypes`，c11 会讲它），可选属性 `name?: string` 的类型是 `string | undefined`，**显式地写 `name: undefined` 也能通过检查**。用展开合并补丁时，问题就出现了：

:::playground{#patch-undefined}
```ts file=main.ts
type User = { id: string; name: string; email: string };
type UserPatch = Partial<Omit<User, 'id'>>;

function applyPatch(user: User, patch: UserPatch): User {
  return { ...user, ...patch };
}

function applyPatchSafely(user: User, patch: UserPatch): User {
  return {
    ...user,
    name: patch.name ?? user.name,
    email: patch.email ?? user.email,
  };
}

const ada: User = { id: 'u1', name: 'Ada', email: 'ada@example.com' };
const patch: UserPatch = { name: undefined, email: 'ada@new.example' };
const broken = applyPatch(ada, patch);
console.log(broken.name, typeof broken.name);
console.log(applyPatchSafely(ada, patch));
```
- 第 5 行：TypeScript 认为 `{ ...user, ...patch }` 的 `name` 是 `string`（它假定可选属性“要么没有，要么是 `string`”），但第 17 行的补丁显式地写了 `name: undefined`，运行后 `broken.name` 是 `undefined`。类型和运行时的值对不上了。
- 第 8–14 行：逐个字段地用 `??` 回退到原来的值（a08），`undefined` 就不会覆盖原来的值。另一种写法是遍历补丁、跳过值为 `undefined` 的字段。
- 补丁来自 `JSON.parse` 时不会出现 `undefined`（JSON 中没有这个值），但来自表单、来自 `{ name: input.value || undefined }` 这类代码时很常见。
:::

## 陷阱三：Omit 不会在联合类型上分布

```ts
type Circle = { id: string; kind: 'circle'; radius: number };
type Square = { id: string; kind: 'square'; size: number };
type Shape = Circle | Square;

type Draft = Omit<Shape, 'id'>; // { kind: 'circle' | 'square' }，radius 和 size 都没了
```

`Omit<T, K>` 的定义是 `Pick<T, Exclude<keyof T, K>>`：其中的 `keyof T` 作用在整个联合上，只得到所有成员**共有**的键（`id`、`kind`），于是 `Omit<Shape, 'id'>` 只剩下 `kind`，`{ kind: 'circle', radius: 1 }` 反而因为多了 `radius` 报错。要对每个成员分别去掉 `id`，用 c04 的分布式条件类型写一个版本：

```ts
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type Draft = DistributiveOmit<Shape, 'id'>; // Omit<Circle, 'id'> | Omit<Square, 'id'>
```

哪些工具类型会对联合的每个成员分别计算？`Partial`、`Required`、`Readonly` 的定义是 `{ [P in keyof T]: … }` 这种**同态映射类型**（遍历的正是 `keyof T`），当 `T` 是类型参数、代入的是联合时，TypeScript 会对每个成员分别映射：`Partial<Shape>` 等于 `Partial<Circle> | Partial<Square>`。`Pick` 和 `Omit` 遍历的是另外给出的键 `K`，不是同态映射，所以不会分布。在可辨识联合上使用工具类型之前，先想一想需要的是“整体”还是“每个成员”。

## 浅层的 Readonly

`Readonly<{ tags: string[] }>` 只让 `tags` 这个属性不能被重新赋值，数组本身仍然可以 `push`。需要“深层只读”时，把数组也写成 `readonly string[]`，或者写一个递归的 `DeepReadonly`（要用到条件类型）。

::exercise{#user-types}

## 编程挑战

::exercise{#shape-drafts}

::quiz

## 常见错误

- **为每个场合手写一个几乎一样的类型**：用工具类型从一个来源派生，字段改了，几个类型一起变。
- **以为 `Omit` 会检查键名**：拼错的键被静默忽略。需要时用 `StrictOmit<T, K extends keyof T>`。
- **`{ ...user, ...patch }` 合并 `Partial` 补丁**：显式的 `undefined` 会覆盖原来的值，而类型不会发现。逐个字段回退，或者跳过 `undefined`。
- **在可辨识联合上直接用 `Omit`**：各个成员被合并成一个，独有的字段都丢了。用分布式的 `Omit`。
- **以为 `Readonly` 是深层的**：嵌套的对象、数组仍然可以修改。
