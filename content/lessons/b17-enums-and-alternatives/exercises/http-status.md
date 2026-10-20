---
kind: challenge
title: HTTP 状态码表
---
不用 `enum`，实现一张 HTTP 状态码表，以及配套的查询函数。

1. 导出常量对象 `HttpStatus`（`as const`）：`OK: 200`、`Created: 201`、`BadRequest: 400`、`NotFound: 404`、`ServerError: 500`。
2. 导出类型 `HttpStatus`：所有状态码数字的联合（`200 | 201 | 400 | 404 | 500`）。
3. 导出类型 `StatusName`：所有名称的联合（`'OK' | 'Created' | …`）。
4. `isHttpStatus(code: number): code is HttpStatus`：`code` 是表中的状态码时返回 `true`。
5. `statusName(code: HttpStatus): StatusName`：根据状态码返回名称（相当于枚举的反向映射）。
6. `category(code: HttpStatus): 'success' | 'client-error' | 'server-error'`：2xx 为 `'success'`，4xx 为 `'client-error'`，5xx 为 `'server-error'`。用 `switch` 列出每一个状态码，并用穷尽检查保证以后新增状态码时不会漏掉。

不允许使用 `enum` 和 `as` 类型断言（`as const` 除外）。

:::files{role=starter}
```ts file=http.ts
export const HttpStatus = {
  OK: 200,
  NotFound: 404,
};

export type HttpStatus = number;
```
:::

:::files{role=solution}
```ts file=http.ts
export const HttpStatus = {
  OK: 200,
  Created: 201,
  BadRequest: 400,
  NotFound: 404,
  ServerError: 500,
} as const;

export type StatusName = keyof typeof HttpStatus;
export type HttpStatus = (typeof HttpStatus)[StatusName];

const NAMES: readonly StatusName[] = ['OK', 'Created', 'BadRequest', 'NotFound', 'ServerError'];

function assertNever(value: never): never {
  throw new Error(`未处理的状态码：${String(value)}`);
}

export function isHttpStatus(code: number): code is HttpStatus {
  return NAMES.some((name) => HttpStatus[name] === code);
}

export function statusName(code: HttpStatus): StatusName {
  const name = NAMES.find((n) => HttpStatus[n] === code);
  if (name === undefined) {
    throw new Error(`未知的状态码：${code}`);
  }
  return name;
}

export function category(code: HttpStatus): 'success' | 'client-error' | 'server-error' {
  switch (code) {
    case HttpStatus.OK:
    case HttpStatus.Created:
      return 'success';
    case HttpStatus.BadRequest:
    case HttpStatus.NotFound:
      return 'client-error';
    case HttpStatus.ServerError:
      return 'server-error';
    default:
      return assertNever(code);
  }
}
```
:::

:::files{role=tests}
```ts file=http.test.ts
import { describe, expect, test } from 'vitest';
import { HttpStatus, category, isHttpStatus, statusName } from './http';

describe('HttpStatus', () => {
  test('状态码表', () => {
    expect(HttpStatus).toEqual({ OK: 200, Created: 201, BadRequest: 400, NotFound: 404, ServerError: 500 });
  });

  test('isHttpStatus', () => {
    expect(isHttpStatus(404)).toBe(true);
    expect(isHttpStatus(201)).toBe(true);
    expect(isHttpStatus(418)).toBe(false);
  });

  test('statusName 反向查找', () => {
    expect(statusName(200)).toBe('OK');
    expect(statusName(HttpStatus.ServerError)).toBe('ServerError');
  });

  test('category', () => {
    expect(category(201)).toBe('success');
    expect(category(400)).toBe('client-error');
    expect(category(404)).toBe('client-error');
    expect(category(500)).toBe('server-error');
  });
});
```
```ts file=http.test-d.ts
import { expectTypeOf } from 'vitest';
import { isHttpStatus, statusName, type HttpStatus, type StatusName } from './http';

expectTypeOf<HttpStatus>().toEqualTypeOf<200 | 201 | 400 | 404 | 500>();
expectTypeOf<StatusName>().toEqualTypeOf<'OK' | 'Created' | 'BadRequest' | 'NotFound' | 'ServerError'>();

declare const code: number;
if (isHttpStatus(code)) {
  expectTypeOf(statusName(code)).toEqualTypeOf<StatusName>();
}

// @ts-expect-error 418 不在表中
statusName(418);
```
:::

:::hint{level=1}
`StatusName` 是 `keyof typeof HttpStatus`，`HttpStatus`（类型）是 `(typeof HttpStatus)[StatusName]`。反向查找需要遍历名称：`Object.keys` 返回的是 `string[]`（b02），不能直接用来索引，所以自己写一个 `readonly StatusName[]` 的名称数组。
:::

:::hint{level=2}
`isHttpStatus` 和 `statusName` 都可以遍历名称数组：`NAMES.some((name) => HttpStatus[name] === code)`、`NAMES.find(…)`。`category` 的 `switch` 用 `case HttpStatus.OK:` 这样的写法，`default` 里调用 `assertNever(code)`（b06、b09）。
:::

:::explanation
`as const` 对象同时提供了“运行时的表”和“类型的来源”：`keyof typeof HttpStatus` 是名称的联合，`(typeof HttpStatus)[StatusName]` 是状态码的联合。表里新增一行，两个类型自动更新。

反向映射是枚举少数真正有用的特性之一。这里用一个类型为 `readonly StatusName[]` 的名称数组实现：`Object.keys(HttpStatus)` 的类型是 `string[]`，用它索引 `HttpStatus` 会报错，而写断言又是规则不允许的。名称数组的类型注解保证了里面只能放合法的名称（拼错会报错）；漏写一个名称时测试会发现。

`category` 的穷尽检查保证：以后在表里加入 `204` 这样的新状态码，`switch` 没有处理它时，`assertNever(code)` 会在编译期报错。
:::

:::variant{kind=alt name=entries-loop}
```ts file=http.ts
export const HttpStatus = {
  OK: 200,
  Created: 201,
  BadRequest: 400,
  NotFound: 404,
  ServerError: 500,
} as const;

export type StatusName = keyof typeof HttpStatus;
export type HttpStatus = (typeof HttpStatus)[StatusName];

function isStatusName(key: string): key is StatusName {
  return key in HttpStatus;
}

export function isHttpStatus(code: number): code is HttpStatus {
  return Object.values(HttpStatus).some((value) => value === code);
}

export function statusName(code: HttpStatus): StatusName {
  for (const [name, value] of Object.entries(HttpStatus)) {
    if (value === code && isStatusName(name)) return name;
  }
  throw new Error(`未知的状态码：${code}`);
}

export function category(code: HttpStatus): 'success' | 'client-error' | 'server-error' {
  switch (code) {
    case 200:
    case 201:
      return 'success';
    case 400:
    case 404:
      return 'client-error';
    case 500:
      return 'server-error';
    default: {
      const unreachable: never = code;
      throw new Error(`未处理：${String(unreachable)}`);
    }
  }
}
```
:::

:::variant{kind=wrong name=use-enum fails=types reason="使用了 enum，erasableSyntaxOnly 不允许"}
```ts file=http.ts
export enum HttpStatus {
  OK = 200,
  Created = 201,
  BadRequest = 400,
  NotFound = 404,
  ServerError = 500,
}

export type StatusName = keyof typeof HttpStatus;

export function isHttpStatus(code: number): code is HttpStatus {
  return code in HttpStatus;
}

export function statusName(code: HttpStatus): StatusName {
  return HttpStatus[code] as StatusName;
}

export function category(code: HttpStatus): 'success' | 'client-error' | 'server-error' {
  if (code < 300) return 'success';
  if (code < 500) return 'client-error';
  return 'server-error';
}
```
:::

:::variant{kind=wrong name=number-type fails=types reason="HttpStatus 类型写成了 number，任何数字都能传入"}
```ts file=http.ts
export const HttpStatus = {
  OK: 200,
  Created: 201,
  BadRequest: 400,
  NotFound: 404,
  ServerError: 500,
} as const;

export type StatusName = keyof typeof HttpStatus;
export type HttpStatus = number;

const NAMES: readonly StatusName[] = ['OK', 'Created', 'BadRequest', 'NotFound', 'ServerError'];

export function isHttpStatus(code: number): code is HttpStatus {
  return NAMES.some((name) => HttpStatus[name] === code);
}

export function statusName(code: HttpStatus): StatusName {
  const name = NAMES.find((n) => HttpStatus[n] === code);
  if (name === undefined) throw new Error(`未知的状态码：${code}`);
  return name;
}

export function category(code: HttpStatus): 'success' | 'client-error' | 'server-error' {
  if (code < 300) return 'success';
  if (code < 500) return 'client-error';
  return 'server-error';
}
```
:::

:::variant{kind=wrong name=missing-name fails=tests reason="名称数组漏掉了一个状态码，反向查找失败"}
```ts file=http.ts
export const HttpStatus = {
  OK: 200,
  Created: 201,
  BadRequest: 400,
  NotFound: 404,
  ServerError: 500,
} as const;

export type StatusName = keyof typeof HttpStatus;
export type HttpStatus = (typeof HttpStatus)[StatusName];

const NAMES: readonly StatusName[] = ['OK', 'BadRequest', 'NotFound', 'ServerError'];

function assertNever(value: never): never {
  throw new Error(`未处理的状态码：${String(value)}`);
}

export function isHttpStatus(code: number): code is HttpStatus {
  return NAMES.some((name) => HttpStatus[name] === code);
}

export function statusName(code: HttpStatus): StatusName {
  const name = NAMES.find((n) => HttpStatus[n] === code);
  if (name === undefined) throw new Error(`未知的状态码：${code}`);
  return name;
}

export function category(code: HttpStatus): 'success' | 'client-error' | 'server-error' {
  switch (code) {
    case HttpStatus.OK:
    case HttpStatus.Created:
      return 'success';
    case HttpStatus.BadRequest:
    case HttpStatus.NotFound:
      return 'client-error';
    case HttpStatus.ServerError:
      return 'server-error';
    default:
      return assertNever(code);
  }
}
```
:::
