---
version: 1
mode: ts
estimatedMinutes: 35
review: self-reviewed
problem: 检查“这个 unknown 是不是一个合法的用户对象”往往要写好几行。把它提取成函数之后，问题来了：函数返回 true，TypeScript 并不知道这意味着参数是 User。自定义类型守卫 value is User 和断言函数 asserts value is User 就是用来把“检查的含义”告诉 TypeScript 的。但要小心：TypeScript 会完全相信你写的守卫。
objectives:
  - 写出返回类型为 value is T 的类型守卫，并在 if 和 filter 中使用
  - 知道 TypeScript 5.5 起，满足条件的简单函数会被自动推断为类型守卫
  - 理解类型守卫的实现错了，TypeScript 不会发现，它和类型断言一样“相信你”
  - 写出 asserts value is T 和 asserts condition 断言函数，知道调用时被调用的名字必须有明确的类型注解
references:
  - title: Narrowing（Using type predicates、Assertion functions）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
    checked: 2026-10-20
  - title: TypeScript 3.7 Release Notes（Assertion Functions）
    url: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html
    checked: 2026-10-20
  - title: TypeScript 5.5 Release Notes（Inferred Type Predicates）
    url: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-5.html
    checked: 2026-10-20
---

## 类型守卫：value is T

把检查写进函数后，返回类型写成 `参数名 is 类型`，这个函数就成了**类型守卫**（type guard）：它返回 `true` 时，TypeScript 把参数收窄成该类型；返回 `false` 时，从参数的类型中去掉它。

:::playground{#type-guard expect="2322@main.ts:21"}
```ts file=main.ts
type Point = { x: number; y: number };

function isPoint(value: unknown): value is Point {
  return (
    typeof value === 'object' &&
    value !== null &&
    'x' in value &&
    typeof value.x === 'number' &&
    'y' in value &&
    typeof value.y === 'number'
  );
}

function looksLikePoint(value: unknown): boolean {
  return isPoint(value);
}

const raw: unknown = JSON.parse('[{ "x": 1, "y": 2 }, { "x": "a" }, null]');
const items: unknown[] = Array.isArray(raw) ? raw : [];
const points: Point[] = items.filter(isPoint);
const points2: Point[] = items.filter(looksLikePoint);
console.log(points);
```
- 第 3 行：返回类型 `value is Point` 是关键。函数体里是 b07 学过的普通检查。
- 第 20 行：`filter` 接收类型守卫时，返回的数组类型也随之收窄成 `Point[]`。
- 第 21 行：`looksLikePoint` 做的事情完全相同，但返回类型只是 `boolean`，TypeScript 不知道它的含义，结果仍然是 `unknown[]`，报 TS2322。
:::

TypeScript 5.5 起，没有写返回类型的简单函数（例如 `(x: unknown) => typeof x === 'string'`）会被**自动推断**为类型守卫（a16 中 `filter((n) => n !== null)` 就是这样）。条件是：函数返回 `true` 时能确定参数是某个类型，**返回 `false` 时也能确定参数不是这个类型**。所以 `(x: number | undefined) => x !== undefined` 会被推断，`(x: number | undefined) => !!x` 不会——返回 `false` 时 `x` 也可能是数字 `0`。逻辑稍复杂、或者要在多处复用的检查，还是应该写成有明确返回类型的守卫函数。

## TypeScript 完全相信你的守卫

TypeScript 不会检查守卫的实现是否真的和返回类型相符。一个写错的守卫，和 `as` 类型断言一样危险：类型检查通过，错误推迟到运行时。

:::playground{#lying-guard run=error}
```ts file=main.ts
type User = { name: string };

function isUser(value: unknown): value is User {
  return typeof value === 'object' && value !== null;
}

const data: unknown = JSON.parse('{ "nickname": "Ada" }');
if (isUser(data)) {
  console.log(data.name.toUpperCase());
}
```
- `isUser` 只检查了“是对象”，没有检查 `name`。TypeScript 照样信任它，第 9 行没有任何报错。
- 运行一下：`data.name` 是 `undefined`，抛出 `TypeError`。
- 守卫的实现要检查返回类型里承诺的**每一项**。字段很多时，E 阶段会介绍用 schema 自动生成校验的工具。
:::

## 断言函数：不满足就抛错

有时你不想分支，而是想说“这里必须满足，否则就是程序有 bug”。**断言函数**正是这个意思：它的返回类型写成 `asserts 条件参数` 或 `asserts 参数 is 类型`；函数正常返回，就说明断言成立，之后的代码按断言收窄；不成立时它应该抛出错误。

断言函数有一个限制：调用时，被调用的名字（包括 `obj.fn` 中的 `obj`）必须有**明确的类型注解**，否则在调用处报 TS2775。用 `const check = (…): asserts … => …` 定义时，函数本身写了返回类型，但变量 `check` 的类型是推断出来的，仍然不行。用 `function` 声明最简单。

:::playground{#assertions expect="2775@main.ts:24"}
```ts file=main.ts
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIsString(value: unknown): asserts value is string {
  if (typeof value !== 'string') {
    throw new TypeError(`应该是字符串，实际是 ${typeof value}`);
  }
}

const input: unknown = '  hello ';
assertIsString(input);
console.log(input.trim());

const found: string | undefined = ['a', 'b'].find((s) => s === 'b');
assert(found !== undefined, '必须找到 b');
console.log(found.toUpperCase());

const check = (condition: unknown): asserts condition => {
  if (!condition) throw new Error('断言失败');
};
check(found);
```
- 第 14 行之后，`input` 是 `string`；第 18 行之后，`found` 是 `string`。
- 第 21 行用箭头函数定义了断言函数，但 `check` 这个变量没有明确的类型注解，第 24 行调用它时报 TS2775。把它改成 `function` 声明，或写成 `const check: (condition: unknown) => asserts condition = …`。
:::

**守卫还是断言？** 需要根据结果走不同分支时用类型守卫（`if (isUser(x)) … else …`）；“不满足就是 bug，应该立刻停止”时用断言函数。

::exercise{#is-point}

## 编程挑战

::exercise{#assert-config}

::quiz

## 常见错误

- **返回类型写成 `boolean`**：TypeScript 不知道检查的含义，不会收窄。写成 `value is T`。
- **守卫没有检查承诺的每一项**：TypeScript 不会发现，运行时出错。
- **用箭头函数定义断言函数却不写类型注解**：TS2775。
- **用断言函数处理正常情况**：预料之中的失败用守卫和分支处理，或返回 `null`（a20）。

## 下一步

下一课讲可辨识联合：给对象类型加一个“标签”属性，让 `switch` 能精确地区分它们，再配合 b06 的 `never` 做穷尽检查。
