---
kind: challenge
title: 把订单的 DTO 解析成领域模型
---
服务器返回的订单是 `OrderDto` 的格式（下划线字段名、ISO 字符串日期、大写状态）。在 `orders.ts` 中把它转换成程序内部使用的 `Order`，以及反过来。`ids.ts`（只读）是小任务的参考解，另外多了一个 `centsFrom(value)`：`value` 是非负安全整数时返回 `Cents`，否则返回 `null`。

**`parseOrder(input)`**：`input` 是 `unknown`。不是普通对象（`null`、数组、字符串……）时返回 `{ ok: false, errors: ['订单必须是对象'] }`。否则**按下面的顺序检查每一个字段，收集全部错误**；没有错误时返回 `{ ok: true, order }`：

| 字段 | 要求 | 错误信息 |
| --- | --- | --- |
| `id` | 字符串，且 `parseOrderId` 成功 | `id 格式不正确` |
| `customer_id` | 字符串，且 `parseUserId` 成功 | `customer_id 格式不正确` |
| `created_at` | 有效的时间（见下） | `created_at 不是有效的时间` |
| `total_cents` | 数字，且 `centsFrom` 成功 | `total_cents 必须是非负整数` |
| `status` | `'PENDING'`、`'PAID'`、`'REFUNDED'` 之一 | `status 不正确` |
| `refunded_at` | `REFUNDED` 时必须是有效的时间；其他状态时必须没有或者是 `null` | `refunded_at 不是有效的时间` / `只有已退款的订单才有 refunded_at` |
| `note` | 没有、`null` 或者字符串 | `note 必须是字符串` |

- **有效的时间**：字符串，格式是 `YYYY-MM-DDTHH:mm:ss`，可选 1 到 3 位的毫秒（`.123`），**必须带时区**（`Z` 或 `+08:00` 这样的偏移）；并且 `new Date(…)` 得到的不是无效日期；
- 转换后的 `Order`：`createdAt`、`refundedAt` 是 `Date`；`status` 是可辨识联合 `{ kind: 'pending' }`、`{ kind: 'paid' }` 或 `{ kind: 'refunded'; refundedAt }`；`note` 去掉首尾空白，没有、`null` 或者去掉空白后为空时都是 `null`；输入中多余的字段不出现在结果中。

**`toDto(order)`**：转换回 `OrderDto`。日期用 `toISOString()`；`refunded_at` 只在已退款时出现；`note` 原样（可能是 `null`）。`parseOrder(toDto(order))` 应该得到和 `order` 相同的订单。

不能使用类型断言。

:::files{role=starter}
```ts file=orders.ts
import type { Cents, OrderId, UserId } from './ids';

export type OrderDto = {
  id: string;
  customer_id: string;
  created_at: string;
  total_cents: number;
  status: 'PENDING' | 'PAID' | 'REFUNDED';
  refunded_at?: string | null;
  note?: string | null;
};

export type OrderStatus = { kind: 'pending' } | { kind: 'paid' } | { kind: 'refunded'; refundedAt: Date };

export type Order = Readonly<{
  id: OrderId;
  customerId: UserId;
  createdAt: Date;
  total: Cents;
  status: OrderStatus;
  note: string | null;
}>;

export type ParseResult = { ok: true; order: Order } | { ok: false; errors: string[] };

export function parseOrder(input: unknown): ParseResult {
  return { ok: false, errors: ['还没有实现'] };
}

export function toDto(order: Order): OrderDto {
  return {
    id: order.id,
    customer_id: order.customerId,
    created_at: '',
    total_cents: order.total,
    status: 'PENDING',
  };
}
```
```ts file=main.ts
import { parseOrder, toDto } from './orders';

const result = parseOrder(JSON.parse('{"id":"o_8f2k1x","customer_id":"u_7a9c3d","created_at":"2026-10-20T08:30:00Z","total_cents":12990,"status":"PAID","note":" 加急 ","extra":1}'));
if (result.ok) console.log(result.order, toDto(result.order));
else console.log(result.errors);
```
:::

:::files{role=support}
```ts file=ids.ts readonly
declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type UserId = Brand<string, 'UserId'>;
export type OrderId = Brand<string, 'OrderId'>;
export type Cents = Brand<number, 'Cents'>;

function isUserId(text: string): text is UserId {
  return /^u_[a-z0-9]{6}$/.test(text);
}

function isOrderId(text: string): text is OrderId {
  return /^o_[a-z0-9]{6}$/.test(text);
}

function isCents(value: number): value is Cents {
  return Number.isSafeInteger(value) && value >= 0;
}

export function parseUserId(text: string): UserId | null {
  return isUserId(text) ? text : null;
}

export function parseOrderId(text: string): OrderId | null {
  return isOrderId(text) ? text : null;
}

export function centsFrom(value: number): Cents | null {
  return isCents(value) ? value : null;
}
```
:::

:::files{role=solution}
```ts file=orders.ts
import { centsFrom, parseOrderId, parseUserId, type Cents, type OrderId, type UserId } from './ids';

export type OrderDto = {
  id: string;
  customer_id: string;
  created_at: string;
  total_cents: number;
  status: 'PENDING' | 'PAID' | 'REFUNDED';
  refunded_at?: string | null;
  note?: string | null;
};

export type OrderStatus = { kind: 'pending' } | { kind: 'paid' } | { kind: 'refunded'; refundedAt: Date };

export type Order = Readonly<{
  id: OrderId;
  customerId: UserId;
  createdAt: Date;
  total: Cents;
  status: OrderStatus;
  note: string | null;
}>;

export type ParseResult = { ok: true; order: Order } | { ok: false; errors: string[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

function parseTime(value: unknown): Date | null {
  if (typeof value !== 'string' || !ISO_TIME.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseOrder(input: unknown): ParseResult {
  if (!isRecord(input)) return { ok: false, errors: ['订单必须是对象'] };
  const errors: string[] = [];

  const rawId = input['id'];
  const id = typeof rawId === 'string' ? parseOrderId(rawId) : null;
  if (id === null) errors.push('id 格式不正确');

  const rawCustomer = input['customer_id'];
  const customerId = typeof rawCustomer === 'string' ? parseUserId(rawCustomer) : null;
  if (customerId === null) errors.push('customer_id 格式不正确');

  const createdAt = parseTime(input['created_at']);
  if (createdAt === null) errors.push('created_at 不是有效的时间');

  const rawTotal = input['total_cents'];
  const total = typeof rawTotal === 'number' ? centsFrom(rawTotal) : null;
  if (total === null) errors.push('total_cents 必须是非负整数');

  const rawStatus = input['status'];
  const rawRefunded = input['refunded_at'];
  let status: OrderStatus | null = null;
  if (rawStatus === 'PENDING' || rawStatus === 'PAID') {
    if (rawRefunded !== undefined && rawRefunded !== null) errors.push('只有已退款的订单才有 refunded_at');
    else status = rawStatus === 'PENDING' ? { kind: 'pending' } : { kind: 'paid' };
  } else if (rawStatus === 'REFUNDED') {
    const refundedAt = parseTime(rawRefunded);
    if (refundedAt === null) errors.push('refunded_at 不是有效的时间');
    else status = { kind: 'refunded', refundedAt };
  } else {
    errors.push('status 不正确');
  }

  const rawNote = input['note'];
  let note: string | null = null;
  if (typeof rawNote === 'string') note = rawNote.trim() === '' ? null : rawNote.trim();
  else if (rawNote !== undefined && rawNote !== null) errors.push('note 必须是字符串');

  if (errors.length > 0 || id === null || customerId === null || createdAt === null || total === null || status === null) {
    return { ok: false, errors };
  }
  return { ok: true, order: { id, customerId, createdAt, total, status, note } };
}

const STATUS_TO_DTO = { pending: 'PENDING', paid: 'PAID', refunded: 'REFUNDED' } as const;

export function toDto(order: Order): OrderDto {
  const dto: OrderDto = {
    id: order.id,
    customer_id: order.customerId,
    created_at: order.createdAt.toISOString(),
    total_cents: order.total,
    status: STATUS_TO_DTO[order.status.kind],
    note: order.note,
  };
  if (order.status.kind === 'refunded') dto.refunded_at = order.status.refundedAt.toISOString();
  return dto;
}
```
```ts file=main.ts
import { parseOrder, toDto } from './orders';

const result = parseOrder(JSON.parse('{"id":"o_8f2k1x","customer_id":"u_7a9c3d","created_at":"2026-10-20T08:30:00Z","total_cents":12990,"status":"PAID","note":" 加急 ","extra":1}'));
if (result.ok) console.log(result.order, toDto(result.order));
else console.log(result.errors);
```
:::

:::files{role=tests}
```ts file=orders.test.ts
import { describe, expect, test } from 'vitest';
import { parseOrder, toDto } from './orders';

const valid = {
  id: 'o_8f2k1x',
  customer_id: 'u_7a9c3d',
  created_at: '2026-10-20T08:30:00Z',
  total_cents: 12990,
  status: 'PAID',
  note: null,
};

describe('parseOrder：成功', () => {
  test('转换成领域模型，多余的字段不出现', () => {
    expect(parseOrder({ ...valid, extra: 1, note: ' 加急 ' })).toEqual({
      ok: true,
      order: {
        id: 'o_8f2k1x',
        customerId: 'u_7a9c3d',
        createdAt: new Date('2026-10-20T08:30:00Z'),
        total: 12990,
        status: { kind: 'paid' },
        note: '加急',
      },
    });
  });

  test('已退款的订单带着退款时间；时区偏移与毫秒', () => {
    const result = parseOrder({ ...valid, status: 'REFUNDED', refunded_at: '2026-10-21T09:00:00.250+08:00' });
    expect(result).toMatchObject({ ok: true, order: { status: { kind: 'refunded', refundedAt: new Date('2026-10-21T01:00:00.250Z') } } });
  });

  test('note：没有、null、只有空白时都是 null', () => {
    const { note: _omit, ...withoutNote } = valid;
    for (const input of [withoutNote, { ...valid, note: null }, { ...valid, note: '   ' }]) {
      expect(parseOrder(input)).toMatchObject({ ok: true, order: { note: null } });
    }
    expect(parseOrder({ ...valid, status: 'PENDING' })).toMatchObject({ ok: true, order: { status: { kind: 'pending' } } });
  });
});

describe('parseOrder：失败', () => {
  test('不是普通对象', () => {
    for (const input of [null, [], 'o_8f2k1x', 42]) {
      expect(parseOrder(input)).toEqual({ ok: false, errors: ['订单必须是对象'] });
    }
  });

  test('收集全部错误，按字段的顺序', () => {
    expect(parseOrder({ id: 'x', customer_id: 1, created_at: '昨天', total_cents: -5, status: 'paid', note: 7 })).toEqual({
      ok: false,
      errors: ['id 格式不正确', 'customer_id 格式不正确', 'created_at 不是有效的时间', 'total_cents 必须是非负整数', 'status 不正确', 'note 必须是字符串'],
    });
    expect(parseOrder({})).toEqual({
      ok: false,
      errors: ['id 格式不正确', 'customer_id 格式不正确', 'created_at 不是有效的时间', 'total_cents 必须是非负整数', 'status 不正确'],
    });
  });

  test('时间必须是带时区的完整格式，并且有效', () => {
    for (const created_at of ['2026-10-20', '2026-10-20T08:30:00', '2026-10-20 08:30:00Z', '2026-13-01T00:00:00Z', '2026-10-20T08:30:00.1234Z']) {
      expect(parseOrder({ ...valid, created_at }), created_at).toEqual({ ok: false, errors: ['created_at 不是有效的时间'] });
    }
  });

  test('金额必须是非负的安全整数', () => {
    for (const total_cents of [1.5, -1, '12990', Number.MAX_SAFE_INTEGER + 1]) {
      expect(parseOrder({ ...valid, total_cents }), String(total_cents)).toEqual({ ok: false, errors: ['total_cents 必须是非负整数'] });
    }
  });

  test('refunded_at 与状态', () => {
    expect(parseOrder({ ...valid, status: 'REFUNDED' })).toEqual({ ok: false, errors: ['refunded_at 不是有效的时间'] });
    expect(parseOrder({ ...valid, refunded_at: '2026-10-21T09:00:00Z' })).toEqual({ ok: false, errors: ['只有已退款的订单才有 refunded_at'] });
    expect(parseOrder({ ...valid, refunded_at: null })).toMatchObject({ ok: true });
  });
});

describe('toDto', () => {
  test('转换回线上的格式，可以再解析回来', () => {
    const parsed = parseOrder({ ...valid, status: 'REFUNDED', refunded_at: '2026-10-21T01:00:00Z', note: '加急' });
    if (!parsed.ok) throw new Error(parsed.errors.join('；'));
    const dto = toDto(parsed.order);
    expect(dto).toEqual({
      id: 'o_8f2k1x',
      customer_id: 'u_7a9c3d',
      created_at: '2026-10-20T08:30:00.000Z',
      total_cents: 12990,
      status: 'REFUNDED',
      refunded_at: '2026-10-21T01:00:00.000Z',
      note: '加急',
    });
    expect(parseOrder(dto)).toEqual(parsed);
  });

  test('没有退款时没有 refunded_at', () => {
    const parsed = parseOrder(valid);
    if (!parsed.ok) throw new Error(parsed.errors.join('；'));
    expect('refunded_at' in toDto(parsed.order)).toBe(false);
  });
});
```
```ts file=orders.test-d.ts
import { expectTypeOf } from 'vitest';
import type { OrderId } from './ids';
import { parseOrder, type Order, type OrderStatus } from './orders';

const result = parseOrder({});
if (result.ok) {
  expectTypeOf(result.order.id).toEqualTypeOf<OrderId>();
  expectTypeOf(result.order.createdAt).toEqualTypeOf<Date>();
  // @ts-expect-error 解析出的订单是只读的
  result.order.note = '改了';
} else {
  expectTypeOf(result.errors).toEqualTypeOf<string[]>();
}

declare const status: OrderStatus;
if (status.kind === 'refunded') expectTypeOf(status.refundedAt).toEqualTypeOf<Date>();
// @ts-expect-error 只有已退款的状态才有退款时间
const wrong: OrderStatus = { kind: 'paid', refundedAt: new Date() };
declare const order: Order;
console.log(wrong, order);
```
:::

:::hint{level=1}
先写一个类型守卫 `isRecord(value): value is Record<string, unknown>`（排除 `null` 和数组），通过之后就可以用 `input['id']` 读取每个字段（类型是 `unknown`）。每个字段解析成一个“结果或 `null`”的变量，失败时把错误信息 `push` 进数组，**不要提前返回**。最后检查：没有错误、并且每个变量都不是 `null` 时，才组成 `Order`。
:::

:::hint{level=2}
时间：先用正则 `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/` 检查格式，再 `new Date(value)`，`Number.isNaN(date.getTime())` 表示无效。状态按 `rawStatus` 分三种情况，`REFUNDED` 时解析 `refunded_at`，其他两种时检查它是 `undefined` 或 `null`。`toDto` 中，状态的转换可以用一张 `{ pending: 'PENDING', … } as const` 的表；`refunded_at` 在已退款时才加到对象上。
:::

:::explanation
`parseOrder` 是这一课的“边界函数”：它的输入是 `unknown`，输出要么是完全转换好的 `Order`，要么是全部的错误。之后的代码拿到的 `Order` 有这样的保证：id 都检查过格式（品牌类型），时间都是有效的 `Date`，退款时间只在已退款时存在（可辨识联合），备注是整理过的字符串或者 `null`。这些保证都写在类型里，不需要在使用的地方重复检查。

几个设计上的选择：

- **收集全部错误**：每个字段都检查，错误放进数组，最后再决定成功还是失败。服务器的数据有好几处问题时，一次就能看到全部；
- **“有效的时间”有两层**：正则限制格式（必须带时区，否则同一个字符串在不同时区的电脑上会被解析成不同的时刻），`getTime()` 排除像 13 月这样的无效日期（`02-30` 这种“月份中不存在的日子”会被顺延，本题不要求处理，正文讲过）。`new Date('昨天')` 不会抛出异常，只会得到无效日期，所以必须检查；
- **规范化**：`note` 的“没有”有三种写法（缺字段、`null`、空白字符串），在边界上统一成 `null`，内部只需要处理一种情况；
- **只取出认识的字段**：逐个字段构造 `Order`，输入中多余的 `extra` 自然不会出现在结果中（p1-05 也是这样做的）。

`toDto` 是反方向的边界：领域模型发回服务器之前转换成线上的格式。往返测试 `parseOrder(toDto(order))` 保证两个方向一致。
:::

:::variant{kind=alt name=field-steps}
```ts file=orders.ts
import { centsFrom, parseOrderId, parseUserId, type Cents, type OrderId, type UserId } from './ids';

export type OrderDto = {
  id: string;
  customer_id: string;
  created_at: string;
  total_cents: number;
  status: 'PENDING' | 'PAID' | 'REFUNDED';
  refunded_at?: string | null;
  note?: string | null;
};

export type OrderStatus = { kind: 'pending' } | { kind: 'paid' } | { kind: 'refunded'; refundedAt: Date };

export type Order = Readonly<{
  id: OrderId;
  customerId: UserId;
  createdAt: Date;
  total: Cents;
  status: OrderStatus;
  note: string | null;
}>;

export type ParseResult = { ok: true; order: Order } | { ok: false; errors: string[] };

type Step<T> = { value: T } | { error: string };

function time(value: unknown, error: string): Step<Date> {
  if (typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{1,3})?(Z|[+-]\d\d:\d\d)$/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.valueOf())) return { value: date };
  }
  return { error };
}

function text<T>(value: unknown, parse: (s: string) => T | null, error: string): Step<T> {
  const parsed = typeof value === 'string' ? parse(value) : null;
  return parsed === null ? { error } : { value: parsed };
}

export function parseOrder(input: unknown): ParseResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return { ok: false, errors: ['订单必须是对象'] };
  const get = (key: string): unknown => (Object.hasOwn(input, key) ? Reflect.get(input, key) : undefined);

  const id = text(get('id'), parseOrderId, 'id 格式不正确');
  const customerId = text(get('customer_id'), parseUserId, 'customer_id 格式不正确');
  const createdAt = time(get('created_at'), 'created_at 不是有效的时间');
  const rawTotal = get('total_cents');
  const totalValue = typeof rawTotal === 'number' ? centsFrom(rawTotal) : null;
  const total: Step<Cents> = totalValue === null ? { error: 'total_cents 必须是非负整数' } : { value: totalValue };

  const rawStatus = get('status');
  const rawRefunded = get('refunded_at');
  let status: Step<OrderStatus>;
  if (rawStatus === 'REFUNDED') {
    const refunded = time(rawRefunded, 'refunded_at 不是有效的时间');
    status = 'error' in refunded ? refunded : { value: { kind: 'refunded', refundedAt: refunded.value } };
  } else if (rawStatus === 'PENDING' || rawStatus === 'PAID') {
    status =
      rawRefunded == null
        ? { value: rawStatus === 'PAID' ? { kind: 'paid' } : { kind: 'pending' } }
        : { error: '只有已退款的订单才有 refunded_at' };
  } else {
    status = { error: 'status 不正确' };
  }

  const rawNote = get('note');
  const note: Step<string | null> =
    rawNote == null ? { value: null } : typeof rawNote === 'string' ? { value: rawNote.trim() || null } : { error: 'note 必须是字符串' };

  const steps = [id, customerId, createdAt, total, status, note];
  const errors = steps.flatMap((step) => ('error' in step ? [step.error] : []));
  if ('error' in id || 'error' in customerId || 'error' in createdAt || 'error' in total || 'error' in status || 'error' in note) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    order: { id: id.value, customerId: customerId.value, createdAt: createdAt.value, total: total.value, status: status.value, note: note.value },
  };
}

export function toDto(order: Order): OrderDto {
  const { status } = order;
  return {
    id: order.id,
    customer_id: order.customerId,
    created_at: order.createdAt.toISOString(),
    total_cents: order.total,
    status: status.kind === 'refunded' ? 'REFUNDED' : status.kind === 'paid' ? 'PAID' : 'PENDING',
    ...(status.kind === 'refunded' ? { refunded_at: status.refundedAt.toISOString() } : {}),
    note: order.note,
  };
}
```
:::

:::variant{kind=wrong name=validate-only fails=rules reason="只检查不转换，最后用 as 把原始数据当作 Order"}
```ts file=orders.ts
import { centsFrom, parseOrderId, parseUserId, type Cents, type OrderId, type UserId } from './ids';

export type OrderDto = {
  id: string;
  customer_id: string;
  created_at: string;
  total_cents: number;
  status: 'PENDING' | 'PAID' | 'REFUNDED';
  refunded_at?: string | null;
  note?: string | null;
};

export type OrderStatus = { kind: 'pending' } | { kind: 'paid' } | { kind: 'refunded'; refundedAt: Date };

export type Order = Readonly<{
  id: OrderId;
  customerId: UserId;
  createdAt: Date;
  total: Cents;
  status: OrderStatus;
  note: string | null;
}>;

export type ParseResult = { ok: true; order: Order } | { ok: false; errors: string[] };

export function parseOrder(input: unknown): ParseResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return { ok: false, errors: ['订单必须是对象'] };
  const dto = input as OrderDto;
  const errors: string[] = [];
  if (parseOrderId(String(dto.id)) === null) errors.push('id 格式不正确');
  if (parseUserId(String(dto.customer_id)) === null) errors.push('customer_id 格式不正确');
  if (Number.isNaN(new Date(dto.created_at).getTime())) errors.push('created_at 不是有效的时间');
  if (centsFrom(Number(dto.total_cents)) === null) errors.push('total_cents 必须是非负整数');
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, order: dto as unknown as Order };
}

export function toDto(order: Order): OrderDto {
  return order as unknown as OrderDto;
}
```
:::

:::variant{kind=wrong name=first-error-only fails=tests reason="遇到第一个错误就返回，没有收集全部的错误"}
```ts file=orders.ts
import { centsFrom, parseOrderId, parseUserId, type Cents, type OrderId, type UserId } from './ids';

export type OrderDto = {
  id: string;
  customer_id: string;
  created_at: string;
  total_cents: number;
  status: 'PENDING' | 'PAID' | 'REFUNDED';
  refunded_at?: string | null;
  note?: string | null;
};

export type OrderStatus = { kind: 'pending' } | { kind: 'paid' } | { kind: 'refunded'; refundedAt: Date };

export type Order = Readonly<{
  id: OrderId;
  customerId: UserId;
  createdAt: Date;
  total: Cents;
  status: OrderStatus;
  note: string | null;
}>;

export type ParseResult = { ok: true; order: Order } | { ok: false; errors: string[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

function parseTime(value: unknown): Date | null {
  if (typeof value !== 'string' || !ISO_TIME.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const fail = (error: string): ParseResult => ({ ok: false, errors: [error] });

export function parseOrder(input: unknown): ParseResult {
  if (!isRecord(input)) return fail('订单必须是对象');
  const rawId = input['id'];
  const id = typeof rawId === 'string' ? parseOrderId(rawId) : null;
  if (id === null) return fail('id 格式不正确');
  const rawCustomer = input['customer_id'];
  const customerId = typeof rawCustomer === 'string' ? parseUserId(rawCustomer) : null;
  if (customerId === null) return fail('customer_id 格式不正确');
  const createdAt = parseTime(input['created_at']);
  if (createdAt === null) return fail('created_at 不是有效的时间');
  const rawTotal = input['total_cents'];
  const total = typeof rawTotal === 'number' ? centsFrom(rawTotal) : null;
  if (total === null) return fail('total_cents 必须是非负整数');
  const rawStatus = input['status'];
  const rawRefunded = input['refunded_at'];
  let status: OrderStatus;
  if (rawStatus === 'PENDING' || rawStatus === 'PAID') {
    if (rawRefunded !== undefined && rawRefunded !== null) return fail('只有已退款的订单才有 refunded_at');
    status = rawStatus === 'PENDING' ? { kind: 'pending' } : { kind: 'paid' };
  } else if (rawStatus === 'REFUNDED') {
    const refundedAt = parseTime(rawRefunded);
    if (refundedAt === null) return fail('refunded_at 不是有效的时间');
    status = { kind: 'refunded', refundedAt };
  } else {
    return fail('status 不正确');
  }
  const rawNote = input['note'];
  let note: string | null = null;
  if (typeof rawNote === 'string') note = rawNote.trim() === '' ? null : rawNote.trim();
  else if (rawNote !== undefined && rawNote !== null) return fail('note 必须是字符串');
  return { ok: true, order: { id, customerId, createdAt, total, status, note } };
}

const STATUS_TO_DTO = { pending: 'PENDING', paid: 'PAID', refunded: 'REFUNDED' } as const;

export function toDto(order: Order): OrderDto {
  const dto: OrderDto = {
    id: order.id,
    customer_id: order.customerId,
    created_at: order.createdAt.toISOString(),
    total_cents: order.total,
    status: STATUS_TO_DTO[order.status.kind],
    note: order.note,
  };
  if (order.status.kind === 'refunded') dto.refunded_at = order.status.refundedAt.toISOString();
  return dto;
}
```
:::

:::variant{kind=wrong name=trusts-date fails=tests reason="只用 new Date 检查时间，没有要求格式和时区，也没有排除无效日期"}
```ts file=orders.ts
import { centsFrom, parseOrderId, parseUserId, type Cents, type OrderId, type UserId } from './ids';

export type OrderDto = {
  id: string;
  customer_id: string;
  created_at: string;
  total_cents: number;
  status: 'PENDING' | 'PAID' | 'REFUNDED';
  refunded_at?: string | null;
  note?: string | null;
};

export type OrderStatus = { kind: 'pending' } | { kind: 'paid' } | { kind: 'refunded'; refundedAt: Date };

export type Order = Readonly<{
  id: OrderId;
  customerId: UserId;
  createdAt: Date;
  total: Cents;
  status: OrderStatus;
  note: string | null;
}>;

export type ParseResult = { ok: true; order: Order } | { ok: false; errors: string[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function parseTime(value: unknown): Date | null {
  return typeof value === 'string' ? new Date(value) : null;
}

export function parseOrder(input: unknown): ParseResult {
  if (!isRecord(input)) return { ok: false, errors: ['订单必须是对象'] };
  const errors: string[] = [];

  const rawId = input['id'];
  const id = typeof rawId === 'string' ? parseOrderId(rawId) : null;
  if (id === null) errors.push('id 格式不正确');

  const rawCustomer = input['customer_id'];
  const customerId = typeof rawCustomer === 'string' ? parseUserId(rawCustomer) : null;
  if (customerId === null) errors.push('customer_id 格式不正确');

  const createdAt = parseTime(input['created_at']);
  if (createdAt === null) errors.push('created_at 不是有效的时间');

  const rawTotal = input['total_cents'];
  const total = typeof rawTotal === 'number' ? centsFrom(rawTotal) : null;
  if (total === null) errors.push('total_cents 必须是非负整数');

  const rawStatus = input['status'];
  const rawRefunded = input['refunded_at'];
  let status: OrderStatus | null = null;
  if (rawStatus === 'PENDING' || rawStatus === 'PAID') {
    if (rawRefunded !== undefined && rawRefunded !== null) errors.push('只有已退款的订单才有 refunded_at');
    else status = rawStatus === 'PENDING' ? { kind: 'pending' } : { kind: 'paid' };
  } else if (rawStatus === 'REFUNDED') {
    const refundedAt = parseTime(rawRefunded);
    if (refundedAt === null) errors.push('refunded_at 不是有效的时间');
    else status = { kind: 'refunded', refundedAt };
  } else {
    errors.push('status 不正确');
  }

  const rawNote = input['note'];
  let note: string | null = null;
  if (typeof rawNote === 'string') note = rawNote.trim() === '' ? null : rawNote.trim();
  else if (rawNote !== undefined && rawNote !== null) errors.push('note 必须是字符串');

  if (errors.length > 0 || id === null || customerId === null || createdAt === null || total === null || status === null) {
    return { ok: false, errors };
  }
  return { ok: true, order: { id, customerId, createdAt, total, status, note } };
}

const STATUS_TO_DTO = { pending: 'PENDING', paid: 'PAID', refunded: 'REFUNDED' } as const;

export function toDto(order: Order): OrderDto {
  const dto: OrderDto = {
    id: order.id,
    customer_id: order.customerId,
    created_at: order.createdAt.toISOString(),
    total_cents: order.total,
    status: STATUS_TO_DTO[order.status.kind],
    note: order.note,
  };
  if (order.status.kind === 'refunded') dto.refunded_at = order.status.refundedAt.toISOString();
  return dto;
}
```
:::

:::variant{kind=wrong name=note-not-normalized fails=tests reason="note 没有去掉空白，只有空白的备注没有变成 null"}
```ts file=orders.ts
import { centsFrom, parseOrderId, parseUserId, type Cents, type OrderId, type UserId } from './ids';

export type OrderDto = {
  id: string;
  customer_id: string;
  created_at: string;
  total_cents: number;
  status: 'PENDING' | 'PAID' | 'REFUNDED';
  refunded_at?: string | null;
  note?: string | null;
};

export type OrderStatus = { kind: 'pending' } | { kind: 'paid' } | { kind: 'refunded'; refundedAt: Date };

export type Order = Readonly<{
  id: OrderId;
  customerId: UserId;
  createdAt: Date;
  total: Cents;
  status: OrderStatus;
  note: string | null;
}>;

export type ParseResult = { ok: true; order: Order } | { ok: false; errors: string[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

function parseTime(value: unknown): Date | null {
  if (typeof value !== 'string' || !ISO_TIME.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseOrder(input: unknown): ParseResult {
  if (!isRecord(input)) return { ok: false, errors: ['订单必须是对象'] };
  const errors: string[] = [];

  const rawId = input['id'];
  const id = typeof rawId === 'string' ? parseOrderId(rawId) : null;
  if (id === null) errors.push('id 格式不正确');

  const rawCustomer = input['customer_id'];
  const customerId = typeof rawCustomer === 'string' ? parseUserId(rawCustomer) : null;
  if (customerId === null) errors.push('customer_id 格式不正确');

  const createdAt = parseTime(input['created_at']);
  if (createdAt === null) errors.push('created_at 不是有效的时间');

  const rawTotal = input['total_cents'];
  const total = typeof rawTotal === 'number' ? centsFrom(rawTotal) : null;
  if (total === null) errors.push('total_cents 必须是非负整数');

  const rawStatus = input['status'];
  const rawRefunded = input['refunded_at'];
  let status: OrderStatus | null = null;
  if (rawStatus === 'PENDING' || rawStatus === 'PAID') {
    if (rawRefunded !== undefined && rawRefunded !== null) errors.push('只有已退款的订单才有 refunded_at');
    else status = rawStatus === 'PENDING' ? { kind: 'pending' } : { kind: 'paid' };
  } else if (rawStatus === 'REFUNDED') {
    const refundedAt = parseTime(rawRefunded);
    if (refundedAt === null) errors.push('refunded_at 不是有效的时间');
    else status = { kind: 'refunded', refundedAt };
  } else {
    errors.push('status 不正确');
  }

  const rawNote = input['note'];
  let note: string | null = null;
  if (typeof rawNote === 'string') note = rawNote;
  else if (rawNote !== undefined && rawNote !== null) errors.push('note 必须是字符串');

  if (errors.length > 0 || id === null || customerId === null || createdAt === null || total === null || status === null) {
    return { ok: false, errors };
  }
  return { ok: true, order: { id, customerId, createdAt, total, status, note } };
}

const STATUS_TO_DTO = { pending: 'PENDING', paid: 'PAID', refunded: 'REFUNDED' } as const;

export function toDto(order: Order): OrderDto {
  const dto: OrderDto = {
    id: order.id,
    customer_id: order.customerId,
    created_at: order.createdAt.toISOString(),
    total_cents: order.total,
    status: STATUS_TO_DTO[order.status.kind],
    note: order.note,
  };
  if (order.status.kind === 'refunded') dto.refunded_at = order.status.refundedAt.toISOString();
  return dto;
}
```
:::
