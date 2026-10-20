---
kind: task
title: 品牌类型：id 与金额
---
在 `ids.ts` 中，用正文的 `Brand` 写出三个品牌类型，并实现创建与使用它们的函数。品牌类型的值只能通过这里的函数得到（不能使用类型断言）：

1. **`UserId`**、**`OrderId`**：都是品牌化的 `string`；**`Cents`**：品牌化的 `number`，表示以分为单位的非负安全整数；
2. **`parseUserId(text)`**：`text` 完全符合 `u_` 加 6 个小写字母或数字时返回 `UserId`，否则返回 `null`（不去掉空白）；**`parseOrderId(text)`** 同理，前缀是 `o_`；
3. **`parseYuan(text)`**：把“元”的字符串解析成 `Cents`：整数部分是一个或多个数字，可选的小数部分是 `.` 加 1 到 2 位数字（`'12.34'` 是 1234，`'12'` 是 1200，`'0.5'` 是 50）；其他格式（负数、科学计数法、多于两位小数、空白）都返回 `null`。**不要用浮点数乘法**（`Number('1.1') * 100` 不是 110）；
4. **`addCents(a, b)`**：两个金额相加，结果超出安全整数范围时抛出 `RangeError`；
5. **`formatCents(cents)`**：格式化为 `¥元.分`，分总是两位：1234 是 `'¥12.34'`，5 是 `'¥0.05'`。

:::files{role=starter}
```ts file=ids.ts
declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type UserId = string;
export type OrderId = string;
export type Cents = number;

export function parseUserId(text: string): UserId | null {
  return text;
}

export function parseOrderId(text: string): OrderId | null {
  return text;
}

export function parseYuan(text: string): Cents | null {
  return Math.round(Number(text) * 100);
}

export function addCents(a: Cents, b: Cents): Cents {
  return a + b;
}

export function formatCents(cents: Cents): string {
  return `¥${cents / 100}`;
}
```
```ts file=main.ts
import { addCents, formatCents, parseOrderId, parseYuan } from './ids';

const id = parseOrderId('o_8f2k1x');
const price = parseYuan('12.9');
const shipping = parseYuan('0.05');
if (id !== null && price !== null && shipping !== null) {
  console.log(id, formatCents(addCents(price, shipping)));
}
```
:::

:::files{role=solution}
```ts file=ids.ts
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

export function parseYuan(text: string): Cents | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (match === null) return null;
  const [, yuan = '', fen = ''] = match;
  const total = Number(yuan) * 100 + Number(fen.padEnd(2, '0'));
  return isCents(total) ? total : null;
}

export function addCents(a: Cents, b: Cents): Cents {
  const sum = a + b;
  if (!isCents(sum)) throw new RangeError('金额超出了范围');
  return sum;
}

export function formatCents(cents: Cents): string {
  const yuan = Math.trunc(cents / 100);
  const fen = String(cents % 100).padStart(2, '0');
  return `¥${yuan}.${fen}`;
}
```
```ts file=main.ts
import { addCents, formatCents, parseOrderId, parseYuan } from './ids';

const id = parseOrderId('o_8f2k1x');
const price = parseYuan('12.9');
const shipping = parseYuan('0.05');
if (id !== null && price !== null && shipping !== null) {
  console.log(id, formatCents(addCents(price, shipping)));
}
```
:::

:::files{role=tests}
```ts file=ids.test.ts
import { describe, expect, test } from 'vitest';
import { addCents, formatCents, parseOrderId, parseUserId, parseYuan } from './ids';

describe('parseUserId 与 parseOrderId', () => {
  test('完全符合格式时返回原来的字符串', () => {
    expect(parseUserId('u_7a9c3d')).toBe('u_7a9c3d');
    expect(parseOrderId('o_8f2k1x')).toBe('o_8f2k1x');
  });

  test('前缀不对、长度不对、大写、有空白时返回 null', () => {
    for (const bad of ['o_7a9c3d', 'u_7a9c3', 'u_7a9c3d4', 'u_7A9C3D', ' u_7a9c3d', 'u_7a9c3d ', '']) {
      expect(parseUserId(bad), bad).toBeNull();
    }
    expect(parseOrderId('u_8f2k1x')).toBeNull();
  });
});

describe('parseYuan', () => {
  test('元的字符串转换成分', () => {
    expect(parseYuan('12.34')).toBe(1234);
    expect(parseYuan('12')).toBe(1200);
    expect(parseYuan('0.5')).toBe(50);
    expect(parseYuan('0.05')).toBe(5);
    expect(parseYuan('1.1')).toBe(110);
    expect(parseYuan('19.99')).toBe(1999);
    expect(parseYuan('007.10')).toBe(710);
  });

  test('其他格式返回 null', () => {
    for (const bad of ['', '-1', '1e3', '12.345', '12.', '.5', ' 12', '12 ', '1,000', 'abc', '99999999999999999']) {
      expect(parseYuan(bad), bad).toBeNull();
    }
  });
});

describe('addCents 与 formatCents', () => {
  test('相加与格式化', () => {
    const a = parseYuan('12.9');
    const b = parseYuan('0.05');
    if (a === null || b === null) throw new Error('解析失败');
    expect(addCents(a, b)).toBe(1295);
    expect(formatCents(addCents(a, b))).toBe('¥12.95');
  });

  test('分总是两位', () => {
    for (const [text, shown] of [['0.05', '¥0.05'], ['5', '¥5.00'], ['0', '¥0.00'], ['1234.5', '¥1234.50']]) {
      const cents = parseYuan(text ?? '');
      if (cents === null) throw new Error(`解析失败：${text}`);
      expect(formatCents(cents)).toBe(shown);
    }
  });

  test('超出安全整数范围时抛出 RangeError', () => {
    const big = parseYuan('90000000000000');
    if (big === null) throw new Error('解析失败');
    expect(() => addCents(big, big)).toThrow(RangeError);
  });
});
```
```ts file=ids.test-d.ts
import { expectTypeOf } from 'vitest';
import { addCents, parseOrderId, parseUserId, parseYuan, type Cents, type OrderId, type UserId } from './ids';

expectTypeOf(parseUserId('x')).toEqualTypeOf<UserId | null>();
expectTypeOf(parseYuan('1')).toEqualTypeOf<Cents | null>();

declare function loadOrder(id: OrderId): void;
declare const userId: UserId;
declare const orderId: OrderId;
loadOrder(orderId);
// @ts-expect-error 用户 id 不能当作订单 id
loadOrder(userId);
// @ts-expect-error 未经检查的字符串不能当作订单 id
loadOrder('o_8f2k1x');
// @ts-expect-error 普通数字不能当作金额
addCents(100, 200);

const asText: string = orderId;
declare const cents: Cents;
const asNumber: number = addCents(cents, cents);
console.log(asText, asNumber);
```
:::

:::hint{level=1}
三个品牌类型：`Brand<string, 'UserId'>`、`Brand<string, 'OrderId'>`、`Brand<number, 'Cents'>`。为每一个写一个类型守卫（例如 `function isOrderId(text: string): text is OrderId`），里面写真正的检查；`parseOrderId` 只需要 `isOrderId(text) ? text : null`。
:::

:::hint{level=2}
`parseYuan` 用正则 `/^(\d+)(?:\.(\d{1,2}))?$/` 分别取出元和分，分不足两位时 `padEnd(2, '0')`（`'5'` 是 50 分），再 `元 * 100 + 分`：两部分都是整数，不会有浮点误差。结果用 `isCents` 检查（太大的数会超出安全整数范围）。`formatCents` 中，分用 `String(cents % 100).padStart(2, '0')`。
:::

:::explanation
品牌类型让“检查过”成为类型的一部分：`OrderId` 的值只能来自 `isOrderId` 返回 `true` 的分支，所以拿到 `OrderId` 就等于知道格式是对的。用户 id 不能传给需要订单 id 的函数，普通数字也不能直接当作金额相加。但品牌类型仍然可以当作 `string`、`number` 使用，日志、比较、序列化都不受影响。

`parseYuan` 不用浮点数乘法，是因为二进制浮点数无法精确表示大多数小数：`Number('1.1') * 100` 是 `110.00000000000001`，四舍五入能掩盖一部分问题，但仍然会接受 `'1e3'`、`'12.345'` 这样的输入。按字符串拆成两个整数再组合，结果是精确的，格式也被正则严格限制。

`addCents` 的结果是普通的 `number`（运算会去掉品牌），所以要再经过 `isCents` 才能作为 `Cents` 返回。这次检查也顺带发现了超出安全整数范围的情况。
:::

:::variant{kind=alt name=string-arithmetic}
```ts file=ids.ts
declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type UserId = Brand<string, 'UserId'>;
export type OrderId = Brand<string, 'OrderId'>;
export type Cents = Brand<number, 'Cents'>;

const idGuard =
  <B extends UserId | OrderId>(prefix: string) =>
  (text: string): text is B =>
    text.length === prefix.length + 6 && text.startsWith(prefix) && /^[a-z0-9]{6}$/.test(text.slice(prefix.length));

const isUserId = idGuard<UserId>('u_');
const isOrderId = idGuard<OrderId>('o_');

const isCents = (value: number): value is Cents => Number.isSafeInteger(value) && value >= 0;

export const parseUserId = (text: string): UserId | null => (isUserId(text) ? text : null);
export const parseOrderId = (text: string): OrderId | null => (isOrderId(text) ? text : null);

export function parseYuan(text: string): Cents | null {
  const [yuan, fen = '', ...rest] = text.split('.');
  if (yuan === undefined || rest.length > 0 || !/^\d+$/.test(yuan)) return null;
  if (text.includes('.') && !/^\d{1,2}$/.test(fen)) return null;
  const total = Number(yuan + fen.padEnd(2, '0'));
  return isCents(total) ? total : null;
}

export function addCents(a: Cents, b: Cents): Cents {
  const sum = a + b;
  if (isCents(sum)) return sum;
  throw new RangeError('金额超出了范围');
}

export function formatCents(cents: Cents): string {
  const digits = String(cents).padStart(3, '0');
  return `¥${digits.slice(0, -2)}.${digits.slice(-2)}`;
}
```
:::

:::variant{kind=wrong name=plain-aliases fails=types reason="UserId、OrderId 只是 string 的别名，可以互相混用"}
```ts file=ids.ts
declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type UserId = string;
export type OrderId = string;
export type Cents = number;

export function parseUserId(text: string): UserId | null {
  return /^u_[a-z0-9]{6}$/.test(text) ? text : null;
}

export function parseOrderId(text: string): OrderId | null {
  return /^o_[a-z0-9]{6}$/.test(text) ? text : null;
}

export function parseYuan(text: string): Cents | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (match === null) return null;
  const [, yuan = '', fen = ''] = match;
  const total = Number(yuan) * 100 + Number(fen.padEnd(2, '0'));
  return Number.isSafeInteger(total) ? total : null;
}

export function addCents(a: Cents, b: Cents): Cents {
  const sum = a + b;
  if (!Number.isSafeInteger(sum)) throw new RangeError('金额超出了范围');
  return sum;
}

export function formatCents(cents: Cents): string {
  const yuan = Math.trunc(cents / 100);
  const fen = String(cents % 100).padStart(2, '0');
  return `¥${yuan}.${fen}`;
}
```
:::

:::variant{kind=wrong name=float-math fails=tests reason="用浮点数乘法解析，接受了科学计数法和三位小数"}
```ts file=ids.ts
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

export function parseYuan(text: string): Cents | null {
  if (text.trim() === '') return null;
  const total = Math.round(Number(text) * 100);
  return isCents(total) ? total : null;
}

export function addCents(a: Cents, b: Cents): Cents {
  const sum = a + b;
  if (!isCents(sum)) throw new RangeError('金额超出了范围');
  return sum;
}

export function formatCents(cents: Cents): string {
  const yuan = Math.trunc(cents / 100);
  const fen = String(cents % 100).padStart(2, '0');
  return `¥${yuan}.${fen}`;
}
```
:::

:::variant{kind=wrong name=assert-brand fails=rules reason="用 as 直接把字符串当作品牌类型，绕过了检查"}
```ts file=ids.ts
declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type UserId = Brand<string, 'UserId'>;
export type OrderId = Brand<string, 'OrderId'>;
export type Cents = Brand<number, 'Cents'>;

export function parseUserId(text: string): UserId | null {
  return /^u_[a-z0-9]{6}$/.test(text) ? (text as UserId) : null;
}

export function parseOrderId(text: string): OrderId | null {
  return /^o_[a-z0-9]{6}$/.test(text) ? (text as OrderId) : null;
}

export function parseYuan(text: string): Cents | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (match === null) return null;
  const [, yuan = '', fen = ''] = match;
  const total = Number(yuan) * 100 + Number(fen.padEnd(2, '0'));
  return Number.isSafeInteger(total) ? (total as Cents) : null;
}

export function addCents(a: Cents, b: Cents): Cents {
  const sum = a + b;
  if (!Number.isSafeInteger(sum)) throw new RangeError('金额超出了范围');
  return sum as Cents;
}

export function formatCents(cents: Cents): string {
  const yuan = Math.trunc(cents / 100);
  const fen = String(cents % 100).padStart(2, '0');
  return `¥${yuan}.${fen}`;
}
```
:::

:::variant{kind=wrong name=fen-not-padded fails=tests reason="格式化时分没有补足两位，5 分显示成了 ¥0.5"}
```ts file=ids.ts
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

export function parseYuan(text: string): Cents | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (match === null) return null;
  const [, yuan = '', fen = ''] = match;
  const total = Number(yuan) * 100 + Number(fen.padEnd(2, '0'));
  return isCents(total) ? total : null;
}

export function addCents(a: Cents, b: Cents): Cents {
  const sum = a + b;
  if (!isCents(sum)) throw new RangeError('金额超出了范围');
  return sum;
}

export function formatCents(cents: Cents): string {
  return `¥${Math.trunc(cents / 100)}.${cents % 100}`;
}
```
:::
