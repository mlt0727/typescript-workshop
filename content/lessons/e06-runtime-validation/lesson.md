---
version: 1
mode: ts
estimatedMinutes: 40
review: ai-draft
problem: TypeScript 的类型在编译后就消失了（a02）。服务器返回的 JSON、localStorage 中保存的数据、URL 中的参数，在运行时可能是任何样子：字段缺失、类型不对、多出意料之外的内容。上一课把它们标成了 unknown，这一课把 unknown 变成可以放心使用的类型：在数据进入程序的地方验证一次，给出指向具体位置的错误信息，之后的代码就只和类型明确的数据打交道。
objectives:
  - 知道哪些数据来自程序之外、必须在运行时验证
  - 写出“解析函数”：输入 unknown，输出类型明确的值或具体的错误信息
  - 验证嵌套的对象和数组，在错误信息中给出出错的路径；处理可选字段与 null
  - 了解 Zod 这类校验库如何用一份定义同时得到运行时检查和静态类型
references:
  - title: Narrowing — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
    checked: 2026-10-20
  - title: Parse, don't validate — Alexis King
    url: https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/
    checked: 2026-10-20
  - title: Zod
    url: https://zod.dev/
    checked: 2026-10-20
---

## 哪些数据需要验证

TypeScript 只能检查你自己写的代码。从程序**外部**进来的数据，它在编译期一无所知：

- `fetch` 得到的 JSON（服务器可能改了接口、返回了错误页面、或者被中间人篡改）；
- `localStorage` 中保存的数据（可能是旧版本程序写的，也可能被用户手动改过）；
- URL 中的查询参数、表单输入、`postMessage` 收到的消息；
- 第三方库返回的 `any`。

这些数据在类型上应该是 `unknown`（e05），在第一次使用之前验证。验证一次之后，程序内部就可以完全信任类型，不必到处防御。

## 从“判断”到“解析”

b08 的类型守卫 `isPoint(value): value is Point` 只能回答“是”或“不是”。数据不合格时，你通常还想知道**哪里**不合格，以便记录日志或提示用户。所以更常用的形式是**解析函数**：输入 `unknown`，返回“成功的值”或“错误信息”（d09 用过同样的形式解析表单）：

```ts
type Result<T> = { ok: true; value: T } | { ok: false; error: string };
```

解析时有一个常用的小工具：判断一个值是不是普通对象。检查之后，就能用任意字符串作键读取它的属性（得到的都是 `unknown`）：

```ts
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
```

:::playground{#parse-user fixtures=users}
```ts file=main.ts
type User = { id: number; name: string; email: string };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseUser(value: unknown): Result<User> {
  if (!isRecord(value)) return { ok: false, error: '用户应该是对象' };
  const { id, name, email } = value;
  if (typeof id !== 'number' || !Number.isInteger(id)) return { ok: false, error: 'id 应该是整数' };
  if (typeof name !== 'string') return { ok: false, error: 'name 应该是字符串' };
  if (typeof email !== 'string') return { ok: false, error: 'email 应该是字符串' };
  return { ok: true, value: { id, name, email } };
}

for (const id of [1, 2, 3]) {
  const data: unknown = await (await fetch(`/api/users/${id}`)).json();
  const result = parseUser(data);
  if (result.ok) {
    console.log(`用户 ${id}：`, result.value);
  } else {
    console.log(`用户 ${id} 的数据有问题：${result.error}`);
  }
}
```
- 第 10 行：从 `Record<string, unknown>` 中解构出的三个变量都是 `unknown`，第 11–13 行逐个检查后收窄。
- 第 14 行：返回的是**新对象**，只包含已知的三个字段。服务器多返回的 `isAdmin` 没有混进来：类型里没有声明的数据，就不应该悄悄地流进程序。
- 用户 2 的 `id` 是字符串 `"2"`，在第 11 行被发现。如果没有验证，`id + 1` 会得到 `"21"`，错误要很久之后才会暴露。
:::

## 嵌套的数据与错误路径

数据嵌套时，错误信息要指出**位置**，例如 `items[2].price`，否则面对一个很大的 JSON 很难找到问题。做法是把路径作为参数传给下一层的检查函数，或者在检查数组的每一项时把下标拼进信息里。需要一次报告**所有**问题时（例如在开发工具中显示），把错误收集到数组里，而不是遇到第一个就返回。

检查数组时有一个陷阱：`Array.isArray(value)` 会把 `unknown` 收窄成 `any[]`，取出的元素是 `any`，TypeScript 不再要求你检查。遍历时把元素重新标注为 `unknown`，例如 `items.forEach((item: unknown, index) => …)`，才能保持检查的严格。

## 可选字段、null 与日期

- **可选字段**：JSON 中可能干脆没有这个键。`value.nickname === undefined` 表示没有；有的话再检查类型。注意不要用真假检查，`0`、`''` 都是合法的值；
- **null**：JSON 有 `null` 但没有 `undefined`。服务器用 `null` 表示“没有”时，类型就写成 `string | null`，并单独检查；
- **日期**：JSON 中没有日期类型，日期通常是 ISO 格式的字符串，例如 `"2026-10-20T08:00:00Z"`。解析时转换成 `Date`，并用 `Number.isNaN(date.getTime())` 检查是否有效。

:::playground{#optional-and-dates}
```ts file=main.ts
type Meetup = { title: string; startsAt: Date; location: string | null; capacity?: number };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseMeetup(value: unknown): Result<Meetup> {
  if (!isRecord(value)) return { ok: false, error: '应该是对象' };
  const { title, startsAt, location, capacity } = value;
  if (typeof title !== 'string') return { ok: false, error: 'title 应该是字符串' };
  if (typeof startsAt !== 'string') return { ok: false, error: 'startsAt 应该是日期字符串' };
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return { ok: false, error: 'startsAt 不是有效的日期' };
  if (location !== null && typeof location !== 'string') return { ok: false, error: 'location 应该是字符串或 null' };
  if (capacity !== undefined && typeof capacity !== 'number') return { ok: false, error: 'capacity 应该是数字' };
  const meetup: Meetup = { title, startsAt: date, location };
  if (capacity !== undefined) meetup.capacity = capacity;
  return { ok: true, value: meetup };
}

console.log(parseMeetup(JSON.parse('{ "title": "分享会", "startsAt": "2026-11-01T10:00:00Z", "location": null, "capacity": 0 }')));
console.log(parseMeetup(JSON.parse('{ "title": "分享会", "startsAt": "下周一", "location": "A 厅" }')));
```
- 第 14 行：`new Date('下周一')` 不会抛出错误，而是得到一个无效的日期，要用 `getTime()` 是否为 `NaN` 来判断。
- 第 16 行：`capacity` 是可选的，没有时为 `undefined`。第一个例子的 `capacity` 是 `0`，用 `!== undefined` 判断才不会把它当成“没有”。
- 第 18 行：只有存在时才设置 `capacity`，结果中不会出现值为 `undefined` 的键。
:::

## 用校验库

手写解析函数清楚直接，但字段一多就很冗长，而且类型（`type User`）和验证代码要分别维护，改了一处容易忘了另一处。实际项目中常用 **Zod** 这类校验库：只写一份“模式”（schema），同时得到运行时检查和静态类型。

```ts
import { z } from 'zod';

const User = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.email(),
});
type User = z.infer<typeof User>; // { id: number; name: string; email: string }

const result = User.safeParse(data);
if (result.success) {
  result.data; // User
} else {
  console.log(result.error.issues); // 每个问题都带有路径和说明
}
```

本平台只提供课程需要的几个依赖，不能安装 npm 包，所以上面的代码不能在这里运行；F 阶段的本地项目中可以使用。本课程平台本身就用 Zod 验证页面与沙箱之间传递的每一条消息。

::exercise{#parse-product}

## 编程挑战

::exercise{#parse-order}

::quiz

## 常见错误

- **`const user = data as User`**：断言不做任何检查。用解析函数。
- **在程序各处零散地检查**：在数据进入的边界验证一次，之后只使用验证过的数据。
- **把整个输入对象原样返回**：多余的、甚至恶意的字段也跟着进了程序。只复制已知的字段。
- **用真假检查可选字段**：`0`、`''`、`false` 会被当作“没有”。用 `=== undefined`。
- **`new Date(text)` 之后不检查**：无效的日期不会抛出错误。

## 下一步

下一课把请求、验证和界面结合起来：显示加载中、空数据和失败三种状态。
