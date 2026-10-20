---
version: 1
mode: ts
estimatedMinutes: 35
review: self-reviewed
problem: 有时你比 TypeScript 知道得多，或者希望它推断得更精确。TypeScript 提供了三个看起来相似、作用却完全不同的工具：as 类型断言让编译器“相信你”（不做运行时检查，编译期的检查也很宽松）；as const 让值保持最精确的字面量类型并变成只读；satisfies 检查值是否符合某个类型，同时保留值本身更精确的类型。本课程的练习一直禁止 as，这一课解释原因，也介绍两个安全得多的替代品。
objectives:
  - 知道类型断言 as 不做任何运行时检查，理解 TS2352 和“双重断言”的危险
  - 用 as const 得到只读的字面量类型，并用 typeof 从值推导出类型
  - 用 satisfies 检查对象是否符合类型，同时保留更精确的推断结果
  - 判断类型注解、satisfies、as const、as 各自适合的场合
references:
  - title: Everyday Types（Type Assertions、Literal Inference）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
    checked: 2026-10-20
  - title: TypeScript 4.9 Release Notes（The satisfies Operator）
    url: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html
    checked: 2026-10-20
  - title: Typeof Type Operator — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/typeof-types.html
    checked: 2026-10-20
---

## 类型断言 as：相信我

`值 as 类型` 告诉 TypeScript：“把它当作这个类型”。编译期只做一个很宽松的检查：大致是要求其中一个类型能赋值给另一个，否则报 TS2352。所以 `'hello' as number` 会报错，而 `{ path: '/' } as Route` 即使缺了 `auth` 也不报错（`Route` 能赋值给 `{ path: string }`）。它**不生成任何运行时代码**，也不检查值是否真的是这个类型——和 b08 中写错的类型守卫一样，错误被推迟到了运行时。

TS2352 也能被绕过：先断言成 `unknown` 再断言成任何类型（“双重断言”）。看到 `as unknown as` 时要格外警惕。

旧代码里还能看到尖括号写法 `<number>value`，它和 `as` 等价。它不能用在 .tsx 文件里（和 JSX 冲突），开启 `erasableSyntaxOnly`（下一课）时也会报 TS1294，所以现在统一写 `as`。

:::playground{#assertion expect="2352@main.ts:6" run=error}
```ts file=main.ts
const raw: unknown = JSON.parse('{ "name": "Ada" }');
const user = raw as { name: string; age: number };
console.log(user.name);
console.log(user.age.toFixed(1));

const count = 'hello' as number;
const forced = 'hello' as unknown as number;
console.log(count, forced);
```
- 第 2 行：TypeScript 相信了断言，`user.age` 的类型是 `number`。运行一下：第 4 行抛出 `TypeError`，因为 `age` 根本不存在。
- 第 6 行：字符串和数字毫无关系，报 TS2352。
- 第 7 行：双重断言绕过了检查，`forced` 的类型是 `number`，实际是字符串。
:::

**为什么练习禁止 `as`？** 因为几乎所有“需要 `as`”的场合，都有更安全的写法：用 b07 的收窄、b08 的类型守卫，或者把类型注解写对。`as` 合理的用途很少，例如在测试代码中构造特殊的值，或者你确实比编译器知道得多、并且无法用检查来证明（这种情况应该写注释说明理由）。`as const`（下面讲）虽然名为 const 断言（const assertion），但它不会把值当成别的类型，只让推断更精确，所以判题规则放行它。

## as const：最精确的只读类型

在字面量后面加 `as const`：

- 字符串、数字变成字面量类型（不再拓宽成 `string`、`number`，b04）；
- 对象的所有属性变成 `readonly`；
- 数组变成只读元组。

这些效果是**深层**的：嵌套的对象字面量、数组字面量也一样。但它只影响表达式里直接写出的字面量：通过变量引用进来的值（例如 `{ tags } as const` 中的 `tags` 数组）仍然是原来的类型。

它常和 **`typeof` 类型运算符**一起使用：在**类型的位置**写 `typeof 变量名`，得到这个变量的类型（a02 提到过，这和运行时的 `typeof` 不是一回事）。于是可以从一份常量数据推导出类型，数据和类型永远一致。

:::playground{#as-const expect="2540@main.ts:10"}
```ts file=main.ts
const COLORS = ['red', 'green', 'blue'] as const;
type Color = (typeof COLORS)[number];

const CONFIG = { mode: 'dark', retries: 3 } as const;

function paint(color: Color): string {
  return `涂成 ${color}`;
}
console.log(paint('green'), COLORS.length, CONFIG.mode);
CONFIG.retries = 4;
```
- 把鼠标停在 `COLORS` 上：`readonly ["red", "green", "blue"]`。
- 第 2 行：`(typeof COLORS)[number]` 取出元组所有元素的类型，得到 `"red" | "green" | "blue"`。以后在数组里加一种颜色，`Color` 自动跟着变。
- 第 10 行：`as const` 让属性变成了只读，报 TS2540。
:::

## satisfies：检查，同时保留精确的类型

写类型注解 `const x: T = …` 时，`x` 的类型**就是** `T`，值本身更精确的信息被丢掉了。`表达式 satisfies T`（TypeScript 4.9）检查表达式是否符合 `T`，但不会把 `x` 的类型换成 `T`：类型仍然由表达式本身推断。

推断时会**参考** `T`：`T` 中是字面量联合（包括 `boolean`，它就是 `true | false`）的位置，推断结果会保留字面量，而不是拓宽。b04 中 `{ align: 'left' }` 被拓宽成 `{ align: string }` 的问题，写成 `{ align: 'left' } satisfies { align: Align }` 就解决了：`align` 的类型是 `'left'`。

:::playground{#satisfies expect="2322@main.ts:13, 2339@main.ts:16"}
```ts file=main.ts
type Route = { path: string; auth: boolean };

const annotated: Record<string, Route> = {
  home: { path: '/', auth: false },
  profile: { path: '/me', auth: true },
};

const checked = {
  home: { path: '/', auth: false },
  profile: { path: '/me', auth: true },
} satisfies Record<string, Route>;

const typo = { home: { path: '/', auth: 'no' } } satisfies Record<string, Route>;

console.log(annotated.missing?.path);
console.log(checked.missing);
console.log(checked.profile.path, typo);
```
- 把鼠标停在 `annotated` 和 `checked` 上对比：前者是 `Record<string, Route>`，任何键都“存在”，第 15 行访问不存在的 `missing` 不报错（只能靠 `?.` 保护）；后者保留了具体的键 `home`、`profile`，而且两个 `auth` 分别是 `false` 和 `true`：`Route` 中 `auth` 是 `boolean`，推断时参考了它，保留了字面量。
- 第 13 行：`auth` 写成了字符串，`satisfies` 照样检查出来，报 TS2322。
- 第 16 行：`checked` 只有 `home` 和 `profile`，访问 `missing` 报 TS2339。拼错的键在编译期就被发现了。
:::

## 怎么选

| 写法 | 作用 | 适合 |
| --- | --- | --- |
| `const x: T = …` | 检查，并把 `x` 的类型定为 `T` | 函数参数、返回值、需要“就是这个类型”的变量 |
| `… satisfies T` | 检查，类型仍由表达式推断（参考 `T` 保留字面量） | 配置对象、查找表 |
| `… as const` | 不检查，推断为只读字面量 | 常量数据、从值推导类型 |
| `… as T` | 只做很宽松的编译期检查，强行当作 `T` | 极少数无法用检查证明的情况（写注释） |

`satisfies` 和 `as const` 可以一起用：`{ … } as const satisfies T`，既精确又经过检查。

::exercise{#status-list}

## 编程挑战

::exercise{#route-table}

::quiz

## 常见错误

- **用 `as` 让报错消失**：错误被推迟到运行时。用收窄或类型守卫。
- **用 `as unknown as T` 绕过 TS2352**：几乎总是在掩盖问题。
- **给配置对象写宽泛的注解**：`Record<string, T>` 会丢掉具体的键，用 `satisfies`。
- **以为 `as const` 会冻结对象**：它只在类型上是只读的，运行时需要 `Object.freeze`（b03）。注意 `Object.freeze` 是浅的，而 `as const` 的只读是深的。

## 下一步

下一课是 B 阶段的最后一课：枚举，以及为什么现代 TypeScript 推荐用字面量联合和 `as const` 对象代替它。
