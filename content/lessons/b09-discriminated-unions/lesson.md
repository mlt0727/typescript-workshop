---
version: 1
mode: ts
estimatedMinutes: 40
review: ai-draft
problem: 一个请求可能处于“加载中”“成功”“失败”三种状态，成功时有数据，失败时有错误信息。用一个带很多可选属性的对象来表示，会出现“既有数据又有错误”这种不可能的组合，每次使用都得猜哪些属性有值。可辨识联合给每种情况一个标签，让 TypeScript 精确知道当前是哪一种、有哪些属性；配合穷尽检查，新增一种情况时编译器会指出所有需要修改的地方。
objectives:
  - 用一个共同的字面量属性（标签）组成可辨识联合，用 switch 或 if 按标签收窄
  - 用可辨识联合代替一堆可选属性，消除不可能的状态
  - 用 never 做穷尽检查，让新增的情况在编译期被发现
  - "用 { ok: true; … } | { ok: false; … } 表示可能失败的结果"
references:
  - title: Narrowing（Discriminated unions、Exhaustiveness checking）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
    checked: 2026-10-20
  - title: TypeScript 4.6 Release Notes（Control-Flow Analysis for Destructured Discriminated Unions）
    url: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-6.html
    checked: 2026-10-20
---

## 给每种情况一个标签

**可辨识联合**（discriminated union）是若干对象类型的联合，它们都有一个**同名、类型为不同字面量**的属性（常叫 `kind`、`type` 或 `status`），称为**判别属性**。检查这个属性，TypeScript 就能确定是哪一种，进而知道有哪些其他属性。

:::playground{#shapes expect="2339@main.ts:15"}
```ts file=main.ts
type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'rect'; width: number; height: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2;
    case 'rect':
      return shape.width * shape.height;
  }
}

function radiusOf(shape: Shape): number {
  return shape.radius;
}

console.log(area({ kind: 'rect', width: 3, height: 4 }), area({ kind: 'circle', radius: 1 }));
```
- 第 1 行开头的 `|` 只是为了排版整齐，可以省略。
- 第 8 行：在 `case 'circle'` 里，`shape` 被收窄成圆形，可以读取 `radius`。
- 第 15 行：没有检查 `kind`，`shape` 可能是矩形，矩形没有 `radius`，报 TS2339。
- 两个 `case` 覆盖了所有情况，函数不需要额外的 `return`（b04 的练习见过）。
:::

判别属性必须是**字面量类型**（例如 `'circle'`）。写成 `kind: string` 就无法区分，TypeScript 也不会收窄。

## 消除不可能的状态

对比两种表示请求状态的方式：

:::playground{#states}
```ts file=main.ts
type LooseState = {
  loading: boolean;
  data?: string[];
  error?: string;
};
const confusing: LooseState = { loading: true, data: ['a'], error: '超时' };

type RequestState =
  | { status: 'loading' }
  | { status: 'success'; data: string[] }
  | { status: 'error'; error: string };

function render(state: RequestState): string {
  if (state.status === 'loading') {
    return '加载中…';
  }
  if (state.status === 'error') {
    return `出错：${state.error}`;
  }
  return `共 ${state.data.length} 条`;
}

console.log(confusing, render({ status: 'success', data: ['a', 'b'] }), render({ status: 'error', error: '超时' }));
```
- 第 6 行：`LooseState` 允许“正在加载、已有数据、又出了错”同时成立——这在业务上没有意义，但类型挡不住。使用它的代码每次都要猜。
- `RequestState` 只允许三种合法的组合：`data` 只在成功时存在，`error` 只在失败时存在。
- 第 20 行：前两种情况都返回了，剩下的只能是 `success`，可以直接读取 `data`。
:::

## 穷尽检查

b06 介绍过用 `never` 做穷尽检查。在可辨识联合上它最有用：以后给联合新增一种情况时，所有忘了处理它的 `switch` 都会报错。

:::playground{#exhaustive expect="2345@main.ts:17"}
```ts file=main.ts
type Payment =
  | { method: 'cash' }
  | { method: 'card'; last4: string }
  | { method: 'wechat'; openId: string };

function assertNever(value: never): never {
  throw new Error(`未处理的情况：${JSON.stringify(value)}`);
}

function describe(payment: Payment): string {
  switch (payment.method) {
    case 'cash':
      return '现金';
    case 'card':
      return `银行卡（尾号 ${payment.last4}）`;
    default:
      return assertNever(payment);
  }
}

console.log(describe({ method: 'card', last4: '1234' }));
```
- 假设 `wechat` 是刚加进 `Payment` 的新支付方式。`describe` 还没有处理它，所以 `default` 分支里的 `payment` 是微信支付的类型而不是 `never`，第 17 行报 TS2345。
- 在第 15 行后面加上 `case 'wechat': return '微信支付';`，错误消失。
- 如果 `default` 写的是 `return '其他';`，新增的情况会被悄悄当成“其他”，编译器什么也不会说。
:::

## 表示“可能失败”的结果

a05 用 `null` 表示失败，但 `null` 说不出**为什么**失败。判别属性也可以是布尔值：`{ ok: true; value: … } | { ok: false; error: … }` 是表示“成功时有值、失败时有原因”的常见写法。和抛出错误（a20）相比，它把失败写进了返回类型，调用方不检查 `ok` 就拿不到值。

:::playground{#result}
```ts file=main.ts
type ParseResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

function parseQuantity(text: string): ParseResult {
  const trimmed = text.trim();
  if (trimmed === '') {
    return { ok: false, error: '没有填写数量' };
  }
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value <= 0) {
    return { ok: false, error: `“${trimmed}”不是正整数` };
  }
  return { ok: true, value: value };
}

for (const input of ['3', '', '2.5']) {
  const result = parseQuantity(input);
  if (result.ok) {
    console.log('数量', result.value);
  } else {
    console.log('错误', result.error);
  }
}
```
- 第 19 行检查 `result.ok` 之后，`if` 分支里可以读取 `value`，`else` 分支里可以读取 `error`。
- B 阶段的泛型（b14）学完后，可以把它写成通用的 `Result<T, E>`。
:::

::exercise{#shape-perimeter}

## 编程挑战

::exercise{#request-reducer}

::quiz

## 常见错误

- **判别属性写成了 `string`**：必须是字面量类型才能收窄。
- **用一堆可选属性表示几种互斥的状态**：改用可辨识联合。
- **`switch` 里写了 `default: return …` 兜底**：新增情况时编译器不再提醒你。用 `assertNever` 代替。
- **不检查判别属性就读取某种情况特有的属性**：TS2339。

## 下一步

下一课讲函数类型与回调：如何描述“接收一个函数作为参数”的函数，以及回调参数的类型推断规则。
