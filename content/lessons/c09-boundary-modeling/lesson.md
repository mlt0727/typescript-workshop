---
version: 1
mode: ts
estimatedMinutes: 50
review: ai-draft
problem: 程序的“边界”是数据进出的地方：服务器返回的 JSON、表单、本地存储、URL。边界上的数据格式由别人决定，字段名是 created_at，日期是字符串，金额是以分为单位的整数，状态是 'PAID' 这样的大写字符串，可能缺字段，也可能多字段。程序内部则希望用自己的类型：createdAt 是 Date，金额不会和普通数字混用，用户 id 不会被当成订单 id 传错。这一课学会把“线上格式”和“领域模型”分成两种类型，在边界上一次性地解析和转换（而不只是检查），并用品牌类型区分那些结构相同、含义不同的值。
objectives:
  - 区分边界上的数据格式（DTO）与程序内部的领域类型，在边界上把前者解析、转换成后者
  - 用“解析而不只是验证”的方式写边界函数：返回转换后的值或者全部的错误，而不是布尔值
  - 用品牌类型区分结构相同、含义不同的值（用户 id 与订单 id、以分为单位的金额），并通过类型守卫创建它们
  - 在领域模型中用可辨识联合、只读和 null 表达约束，让不合法的状态无法表示
references:
  - title: Parse, don't validate — Alexis King
    url: https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/
    checked: 2026-10-20
  - title: Type Compatibility（结构化类型）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/type-compatibility.html
    checked: 2026-10-20
  - title: Date.parse()（日期时间字符串格式）— MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Date/parse
    checked: 2026-10-20
---

## 两种类型：线上的格式与领域模型

服务器返回的订单可能是这样的：

```json
{ "id": "o_8f2k1x", "customer_id": "u_7a9c3d", "created_at": "2026-10-20T08:30:00Z", "total_cents": 12990, "status": "PAID", "note": null }
```

它的格式由服务器决定：下划线的字段名、字符串形式的日期、大写的状态。如果程序到处直接使用这种格式，`order.created_at.slice(0, 10)` 这样的代码会散落在各处，服务器一改字段名，所有地方都要改。

更好的做法是定义两种类型：

| | 线上的格式（DTO） | 领域模型 |
| --- | --- | --- |
| 来源 | 服务器、表单、存储决定 | 程序自己决定 |
| 字段名 | `customer_id` | `customerId` |
| 日期 | ISO 字符串 | `Date` |
| 金额 | 整数（分） | 品牌类型 `Cents` |
| 状态 | `'PAID'` | `'paid'`，或者可辨识联合 |

**在边界上**写一个函数，把 `unknown` 解析成领域模型，之后的代码只使用领域模型。e06 的运行时校验就是这件事的前一半；这一课补上后一半：校验通过之后**同时完成转换**，并且把转换后的结果交出去。

## 解析，而不只是验证

“验证”函数返回 `boolean`：`isValidOrder(data)` 说“没问题”之后，调用方手里的仍然是那个原始的、类型是 `unknown` 的数据，还得用断言当成 `Order` 来用，日期也还是字符串。

“解析”函数返回**新的、类型更精确的值**，或者失败的原因：

```ts
function parseOrder(input: unknown): { ok: true; order: Order } | { ok: false; errors: string[] }
```

解析成功就得到 `Order`，它的每个字段都经过了检查和转换；失败则得到所有的错误（而不只是第一个，方便排查）。检查过的信息保存在类型里，后面的代码不会再重复检查，也不会忘记检查。

## 品牌类型：结构相同，含义不同

用户 id 和订单 id 都是字符串。TypeScript 是结构化类型的（b02），`type UserId = string` 只是给 `string` 起了个别名，`loadOrder(userId)` 照样能通过检查。**品牌类型**给类型加上一个只存在于类型中的标记，让两个结构相同的类型互不兼容：

:::playground{#brands expect="2345@main.ts:19, 2345@main.ts:20"}
```ts file=main.ts
declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

type UserId = Brand<string, 'UserId'>;
type OrderId = Brand<string, 'OrderId'>;

function isOrderId(value: string): value is OrderId {
  return /^o_[a-z0-9]{6}$/.test(value);
}

function describeOrder(id: OrderId): string {
  return `订单 ${id}`;
}

const raw: string = 'o_8f2k1x';
if (isOrderId(raw)) console.log(describeOrder(raw));

function mistakes(someUser: UserId): void {
  describeOrder(someUser);
  describeOrder('o_8f2k1x');
}
```
- 第 1–2 行：`unique symbol` 是一个独一无二的符号类型，`declare` 表示它只存在于类型中，运行时什么也不生成。`Brand<string, 'OrderId'>` 是“带着 `OrderId` 标记的字符串”，运行时仍然是普通的字符串。
- 第 7–9 行：品牌类型的值只能通过**类型守卫**（或者断言）得到。守卫中写真正的检查，于是“是 `OrderId`”就意味着“格式检查过了”。
- 第 19、20 行报 TS2345：用户 id 不能当作订单 id，未经检查的字符串字面量也不行（`mistakes` 不会被调用，只用来展示这两个错误）。
- 品牌类型仍然可以当作 `string` 使用（拼接、比较、`JSON.stringify` 都正常），只是反过来，普通字符串不能当作品牌类型。
:::

金额也是同样的道理：`type Cents = Brand<number, 'Cents'>` 让“以分为单位的整数”和普通数字区分开。注意两个 `Cents` 相加，结果是普通的 `number`：运算会去掉品牌，要得到新的 `Cents`，得再经过一次检查。

## 让不合法的状态无法表示

领域模型的类型应该尽量让不合法的数据写不出来（b09、e07）：

- 用**可辨识联合**代替“几个布尔值 + 几个可选字段”：已退款的订单才有退款时间，写成 `{ kind: 'refunded'; refundedAt: Date }`，而不是 `refundedAt?: Date` 加上一个 `status`；
- 用 `null` 明确表示“没有”，而不是有时缺字段、有时 `null`、有时空字符串：边界上把这几种都统一成 `null`；
- 用 `Readonly` 表示解析出的数据不应该被修改；要修改就产生新的对象。

日期要特别小心：`new Date('昨天')` 不会抛出异常，而是得到一个“无效日期”，`getTime()` 返回 `NaN`。只接受明确的格式（例如带时区的 ISO 8601），再检查 `Number.isNaN(date.getTime())`。

::exercise{#branded-ids}

## 编程挑战

::exercise{#parse-order}

::quiz

## 常见错误

- **在整个程序里直接使用服务器的数据格式**：字段名、日期格式的变化会波及所有地方。在边界上转换成自己的类型。
- **校验函数只返回 `boolean`**：调用方仍然拿着 `unknown`，最后还是要断言。返回解析后的值。
- **只报告第一个错误**：排查一份有好几处问题的数据时要来回好几次。收集全部的错误。
- **用 `type UserId = string` 区分 id**：别名不会阻止混用。用品牌类型，并通过类型守卫创建。
- **相信 `new Date(text)` 一定有效**：无效的字符串得到的是无效日期，不会抛出异常。检查 `getTime()` 是不是 `NaN`。
