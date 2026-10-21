---
kind: challenge
title: 为带类型的路径函数写测试
grading: tests
allow: [ts-directive]
---
`href.ts`（只读）用 c05 的模板字面量类型实现了一个“带类型的路径”函数：

- `href('/users/:id/posts/:postId', { id: 'ada', postId: 7 })` 返回 `'/users/ada/posts/7'`：把每个 `:名字` 替换成参数的值，值用 `encodeURIComponent` 编码；
- 类型上，`ParamNames<P>` 从路径模式中取出参数名（例子中是 `'id' | 'postId'`）。第二个参数必须**正好**包含这些参数（不能少、不能多、名字不能写错），值是字符串或数字；
- 没有参数的路径（`href('/about')`）不需要、也不接受第二个参数；返回值的类型是 `string`。

在 `href.test.ts` 中写运行时的测试，在 `href.test-d.ts` 中写类型测试。平台准备了十个错误的版本：有的错在运行时的行为，有的错在类型，你的两组测试合起来要发现每一个。

:::files{role=support}
```ts file=href.ts readonly
/** 路径模式中的参数名：'/users/:id/posts/:postId' 中是 'id' | 'postId' */
export type ParamNames<P extends string> = P extends `${string}:${infer Name}/${infer Rest}`
  ? Name | ParamNames<`/${Rest}`>
  : P extends `${string}:${infer Name}`
    ? Name
    : never;

export type Params<P extends string> = { [K in ParamNames<P>]: string | number };

/** 没有参数的模式不接受第二个参数 */
export function href<P extends string>(pattern: P, ...args: [ParamNames<P>] extends [never] ? [] : [params: Params<P>]): string;
export function href(pattern: string, ...args: unknown[]): string {
  const first = args[0];
  const params: Record<string, unknown> = typeof first === 'object' && first !== null ? { ...first } : {};
  return pattern.replace(/:(\w+)/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`缺少参数 ${name}`);
    return encodeURIComponent(String(value));
  });
}
```
:::

:::files{role=starter}
```ts file=href.test.ts
import { describe, expect, test } from 'vitest';
import { href } from './href';

describe('href', () => {
  test('替换参数', () => {
    expect(href('/users/:id', { id: 42 })).toBe('/users/42');
  });
});
```
```ts file=href.test-d.ts
import { expectTypeOf } from 'vitest';
import { href, type ParamNames } from './href';

// 在这里写类型测试
```
:::

:::files{role=solution}
```ts file=href.test.ts
import { describe, expect, test } from 'vitest';
import { href } from './href';

describe('href', () => {
  test('替换参数', () => {
    expect(href('/users/:id', { id: 42 })).toBe('/users/42');
    expect(href('/users/:id/posts/:postId', { id: 'ada', postId: 7 })).toBe('/users/ada/posts/7');
  });

  test('参数值被编码', () => {
    expect(href('/search/:q', { q: 'a b/c?' })).toBe('/search/a%20b%2Fc%3F');
  });

  test('没有参数的路径原样返回', () => {
    expect(href('/about')).toBe('/about');
  });
});
```
```ts file=href.test-d.ts
import { expectTypeOf } from 'vitest';
import { href, type ParamNames } from './href';

expectTypeOf<ParamNames<'/users/:id/posts/:postId'>>().toEqualTypeOf<'id' | 'postId'>();
expectTypeOf<ParamNames<'/about'>>().toBeNever();
expectTypeOf(href('/users/:id', { id: 1 })).toEqualTypeOf<string>();

// @ts-expect-error 缺少 postId
href('/users/:id/posts/:postId', { id: 1 });
// @ts-expect-error 多了一个参数
href('/users/:id', { id: 1, page: 2 });
// @ts-expect-error 参数名拼错了
href('/users/:id', { ID: 1 });
// @ts-expect-error 参数值只能是字符串或数字
href('/users/:id', { id: true });
// @ts-expect-error 没有参数的路径不接受第二个参数
href('/about', {});
```
:::

:::mutant{name=no-encoding hint="参数值没有编码：空格、/、? 原样出现在路径中。需要一个含有特殊字符的值"}
```ts file=href.ts
/** 路径模式中的参数名：'/users/:id/posts/:postId' 中是 'id' | 'postId' */
export type ParamNames<P extends string> = P extends `${string}:${infer Name}/${infer Rest}`
  ? Name | ParamNames<`/${Rest}`>
  : P extends `${string}:${infer Name}`
    ? Name
    : never;

export type Params<P extends string> = { [K in ParamNames<P>]: string | number };

/** 没有参数的模式不接受第二个参数 */
export function href<P extends string>(pattern: P, ...args: [ParamNames<P>] extends [never] ? [] : [params: Params<P>]): string;
export function href(pattern: string, ...args: unknown[]): string {
  const first = args[0];
  const params: Record<string, unknown> = typeof first === 'object' && first !== null ? { ...first } : {};
  return pattern.replace(/:(\w+)/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`缺少参数 ${name}`);
    return String(value);
  });
}
```
:::

:::mutant{name=first-only hint="只替换了第一个参数：需要一个有两个参数的路径"}
```ts file=href.ts
/** 路径模式中的参数名：'/users/:id/posts/:postId' 中是 'id' | 'postId' */
export type ParamNames<P extends string> = P extends `${string}:${infer Name}/${infer Rest}`
  ? Name | ParamNames<`/${Rest}`>
  : P extends `${string}:${infer Name}`
    ? Name
    : never;

export type Params<P extends string> = { [K in ParamNames<P>]: string | number };

/** 没有参数的模式不接受第二个参数 */
export function href<P extends string>(pattern: P, ...args: [ParamNames<P>] extends [never] ? [] : [params: Params<P>]): string;
export function href(pattern: string, ...args: unknown[]): string {
  const first = args[0];
  const params: Record<string, unknown> = typeof first === 'object' && first !== null ? { ...first } : {};
  return pattern.replace(/:(\w+)/, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`缺少参数 ${name}`);
    return encodeURIComponent(String(value));
  });
}
```
:::

:::mutant{name=optional-params hint="参数都成了可选的：少写一个参数也能通过编译"}
```ts file=href.ts
/** 路径模式中的参数名：'/users/:id/posts/:postId' 中是 'id' | 'postId' */
export type ParamNames<P extends string> = P extends `${string}:${infer Name}/${infer Rest}`
  ? Name | ParamNames<`/${Rest}`>
  : P extends `${string}:${infer Name}`
    ? Name
    : never;

export type Params<P extends string> = { [K in ParamNames<P>]?: string | number };

/** 没有参数的模式不接受第二个参数 */
export function href<P extends string>(pattern: P, ...args: [ParamNames<P>] extends [never] ? [] : [params: Params<P>]): string;
export function href(pattern: string, ...args: unknown[]): string {
  const first = args[0];
  const params: Record<string, unknown> = typeof first === 'object' && first !== null ? { ...first } : {};
  return pattern.replace(/:(\w+)/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`缺少参数 ${name}`);
    return encodeURIComponent(String(value));
  });
}
```
:::

:::mutant{name=record-params hint="参数的类型是 Record<string, …>：参数名写错、多写、少写都不报错"}
```ts file=href.ts
/** 路径模式中的参数名：'/users/:id/posts/:postId' 中是 'id' | 'postId' */
export type ParamNames<P extends string> = P extends `${string}:${infer Name}/${infer Rest}`
  ? Name | ParamNames<`/${Rest}`>
  : P extends `${string}:${infer Name}`
    ? Name
    : never;

export type Params<P extends string> = Record<string, string | number>;

/** 没有参数的模式不接受第二个参数 */
export function href<P extends string>(pattern: P, ...args: [ParamNames<P>] extends [never] ? [] : [params: Params<P>]): string;
export function href(pattern: string, ...args: unknown[]): string {
  const first = args[0];
  const params: Record<string, unknown> = typeof first === 'object' && first !== null ? { ...first } : {};
  return pattern.replace(/:(\w+)/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`缺少参数 ${name}`);
    return encodeURIComponent(String(value));
  });
}
```
:::

:::mutant{name=always-params hint="没有参数的路径也必须传一个对象：href('/about') 不能通过编译。需要一个“没有参数也能调用”的测试"}
```ts file=href.ts
/** 路径模式中的参数名：'/users/:id/posts/:postId' 中是 'id' | 'postId' */
export type ParamNames<P extends string> = P extends `${string}:${infer Name}/${infer Rest}`
  ? Name | ParamNames<`/${Rest}`>
  : P extends `${string}:${infer Name}`
    ? Name
    : never;

export type Params<P extends string> = { [K in ParamNames<P>]: string | number };

/** 没有参数的模式不接受第二个参数 */
export function href<P extends string>(pattern: P, ...args: [params: Params<P>]): string;
export function href(pattern: string, ...args: unknown[]): string {
  const first = args[0];
  const params: Record<string, unknown> = typeof first === 'object' && first !== null ? { ...first } : {};
  return pattern.replace(/:(\w+)/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`缺少参数 ${name}`);
    return encodeURIComponent(String(value));
  });
}
```
:::

:::mutant{name=greedy-name hint="参数名把后面的路径也吞了进去：ParamNames 得到的是 'id/posts/:postId'。需要检查有两个参数时的参数名"}
```ts file=href.ts
type Names<P extends string> = P extends `${string}:${infer Name}/${infer Rest}`
  ? Name | Names<`/${Rest}`>
  : P extends `${string}:${infer Name}`
    ? Name
    : never;

/** 路径模式中的参数名（写错了：第一个参数名把后面的路径也吞了进去） */
export type ParamNames<P extends string> = P extends `${string}:${infer Name}` ? Name : never;

export type Params<P extends string> = { [K in Names<P>]: string | number };

/** 没有参数的模式不接受第二个参数 */
export function href<P extends string>(pattern: P, ...args: [Names<P>] extends [never] ? [] : [params: Params<P>]): string;
export function href(pattern: string, ...args: unknown[]): string {
  const first = args[0];
  const params: Record<string, unknown> = typeof first === 'object' && first !== null ? { ...first } : {};
  return pattern.replace(/:(\w+)/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`缺少参数 ${name}`);
    return encodeURIComponent(String(value));
  });
}
```
:::

:::mutant{name=returns-any hint="返回值的类型是 any"}
```ts file=href.ts
/** 路径模式中的参数名：'/users/:id/posts/:postId' 中是 'id' | 'postId' */
export type ParamNames<P extends string> = P extends `${string}:${infer Name}/${infer Rest}`
  ? Name | ParamNames<`/${Rest}`>
  : P extends `${string}:${infer Name}`
    ? Name
    : never;

export type Params<P extends string> = { [K in ParamNames<P>]: string | number };

/** 没有参数的模式不接受第二个参数 */
export function href<P extends string>(pattern: P, ...args: [ParamNames<P>] extends [never] ? [] : [params: Params<P>]): any;
export function href(pattern: string, ...args: unknown[]): string {
  const first = args[0];
  const params: Record<string, unknown> = typeof first === 'object' && first !== null ? { ...first } : {};
  return pattern.replace(/:(\w+)/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`缺少参数 ${name}`);
    return encodeURIComponent(String(value));
  });
}
```
:::

:::mutant{name=unknown-values hint="参数值的类型是 unknown：true、对象也能传进去。需要一个“值只能是字符串或数字”的测试"}
```ts file=href.ts
/** 路径模式中的参数名：'/users/:id/posts/:postId' 中是 'id' | 'postId' */
export type ParamNames<P extends string> = P extends `${string}:${infer Name}/${infer Rest}`
  ? Name | ParamNames<`/${Rest}`>
  : P extends `${string}:${infer Name}`
    ? Name
    : never;

export type Params<P extends string> = { [K in ParamNames<P>]: unknown };

/** 没有参数的模式不接受第二个参数 */
export function href<P extends string>(pattern: P, ...args: [ParamNames<P>] extends [never] ? [] : [params: Params<P>]): string;
export function href(pattern: string, ...args: unknown[]): string {
  const first = args[0];
  const params: Record<string, unknown> = typeof first === 'object' && first !== null ? { ...first } : {};
  return pattern.replace(/:(\w+)/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`缺少参数 ${name}`);
    return encodeURIComponent(String(value));
  });
}
```
:::

:::mutant{name=extra-keys hint="可以多传参数：第二个参数的类型是 Params<P> & Record<string, string | number>。需要一个“多了参数应该报错”的测试"}
```ts file=href.ts
/** 路径模式中的参数名：'/users/:id/posts/:postId' 中是 'id' | 'postId' */
export type ParamNames<P extends string> = P extends `${string}:${infer Name}/${infer Rest}`
  ? Name | ParamNames<`/${Rest}`>
  : P extends `${string}:${infer Name}`
    ? Name
    : never;

export type Params<P extends string> = { [K in ParamNames<P>]: string | number };

/** 没有参数的模式不接受第二个参数 */
export function href<P extends string>(pattern: P, ...args: [ParamNames<P>] extends [never] ? [] : [params: Params<P> & Record<string, string | number>]): string;
export function href(pattern: string, ...args: unknown[]): string {
  const first = args[0];
  const params: Record<string, unknown> = typeof first === 'object' && first !== null ? { ...first } : {};
  return pattern.replace(/:(\w+)/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`缺少参数 ${name}`);
    return encodeURIComponent(String(value));
  });
}
```
:::

:::mutant{name=no-params-accepts-object hint="没有参数的路径也接受第二个参数（{} 也能传进去）。需要一个“没有参数的路径不接受第二个参数”的测试"}
```ts file=href.ts
/** 路径模式中的参数名：'/users/:id/posts/:postId' 中是 'id' | 'postId' */
export type ParamNames<P extends string> = P extends `${string}:${infer Name}/${infer Rest}`
  ? Name | ParamNames<`/${Rest}`>
  : P extends `${string}:${infer Name}`
    ? Name
    : never;

export type Params<P extends string> = { [K in ParamNames<P>]: string | number };

/** 没有参数的模式不接受第二个参数 */
export function href<P extends string>(pattern: P, ...args: [ParamNames<P>] extends [never] ? [params?: object] : [params: Params<P>]): string;
export function href(pattern: string, ...args: unknown[]): string {
  const first = args[0];
  const params: Record<string, unknown> = typeof first === 'object' && first !== null ? { ...first } : {};
  return pattern.replace(/:(\w+)/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`缺少参数 ${name}`);
    return encodeURIComponent(String(value));
  });
}
```
:::

:::hint{level=1}
先分清哪些规格只能在运行时检查（替换了每个参数、值被编码），哪些只能在类型上检查（参数不能少、不能多、名字不能错、没有参数时不接受第二个参数、返回 `string`）。运行时的测试需要一个有两个参数的路径和一个含有空格或 `/` 的值。
:::

:::hint{level=2}
类型测试中：`expectTypeOf<ParamNames<'/users/:id/posts/:postId'>>().toEqualTypeOf<'id' | 'postId'>()` 检查参数名；`expectTypeOf<ParamNames<'/about'>>().toBeNever()`；每一种“不能通过编译”的调用各写一行，上面加 `@ts-expect-error`。别忘了 `href('/about')` 这个“应该能通过编译”的调用，它可以写在运行时的测试中。
:::

:::explanation
这道题中的错误分成两类，各自只有一种测试能发现：

- **运行时的错误**（没有编码、只替换了第一个参数）：类型完全正确，只有运行时的测试能发现；
- **类型的错误**（参数可选、参数是 `Record`、值是 `unknown`、可以多传参数、没有参数的路径也接受对象、返回 `any`、导出的 `ParamNames` 写错）：运行时的结果都对，只有类型测试能发现。“没有参数也要传对象”的版本比较特别：它让 `href('/about')` 不能通过编译，所以只要测试中有这样一次调用（运行时的测试中就有），类型检查就会发现它。

“参数名取错”的版本中，`href` 自己用的类型是对的，只有导出的 `ParamNames` 得到了 `'id/posts/:postId'`：所有的调用都能通过编译，只有直接检查 `ParamNames` 的类型测试能发现它。它提醒我们：类型层面的逻辑和运行时的逻辑一样会写错，导出的工具类型本身就值得测试。用 `expectTypeOf<…>()` 可以直接检查一个类型，不需要任何值。

“多了一个参数”能被发现，是因为对象字面量的**多余属性检查**（b02）：参数的类型是 `{ id: string | number }` 时，`{ id: 1, page: 2 }` 报错；变成 `Record<string, …>`，或者与 `Record<string, …>` 交叉之后，任何键都允许。

写这类“带类型的 API”时，类型测试和运行时测试同样重要：使用者依赖的不只是返回的字符串，还有编辑器中的提示和错误。
:::

:::variant{kind=alt name=table-and-describe}
```ts file=href.test.ts
import { expect, test } from 'vitest';
import { href } from './href';

test('替换并编码参数', () => {
  expect(href('/users/:id', { id: 'a&b' })).toBe('/users/a%26b');
  expect(href('/teams/:team/members/:member', { team: 3, member: '张三' })).toBe('/teams/3/members/%E5%BC%A0%E4%B8%89');
});

test('没有参数', () => {
  expect(href('/settings/profile')).toBe('/settings/profile');
});
```
```ts file=href.test-d.ts
import { expectTypeOf, test } from 'vitest';
import { href, type ParamNames } from './href';

test('参数名', () => {
  expectTypeOf<ParamNames<'/a/:x/b/:y/c/:z'>>().toEqualTypeOf<'x' | 'y' | 'z'>();
  expectTypeOf<ParamNames<'/static'>>().toEqualTypeOf<never>();
});

test('调用', () => {
  expectTypeOf(href('/static')).toEqualTypeOf<string>();
  // @ts-expect-error 少了 y
  href('/a/:x/b/:y', { x: 1 });
  // @ts-expect-error 多余的 z
  href('/a/:x', { x: 1, z: 2 });
  // @ts-expect-error 不需要参数
  href('/static', { x: 1 });
  // @ts-expect-error 写错了名字
  href('/a/:x', { X: 1 });
  // @ts-expect-error 值只能是字符串或数字
  href('/a/:x', { x: null });
});
```
:::

:::variant{kind=wrong name=runtime-only fails=mutants misses=optional-params,record-params,greedy-name,returns-any,unknown-values,extra-keys,no-params-accepts-object reason="只写了运行时的测试：参数变成可选、参数名不检查、值是 unknown、可以多传参数、导出的 ParamNames 写错、返回 any，运行时都发现不了"}
```ts file=href.test.ts
import { describe, expect, test } from 'vitest';
import { href } from './href';

describe('href', () => {
  test('替换参数', () => {
    expect(href('/users/:id', { id: 42 })).toBe('/users/42');
    expect(href('/users/:id/posts/:postId', { id: 'ada', postId: 7 })).toBe('/users/ada/posts/7');
  });

  test('参数值被编码', () => {
    expect(href('/search/:q', { q: 'a b/c?' })).toBe('/search/a%20b%2Fc%3F');
  });

  test('没有参数的路径原样返回', () => {
    expect(href('/about')).toBe('/about');
  });
});
```
```ts file=href.test-d.ts
import { expectTypeOf } from 'vitest';
import { href, type ParamNames } from './href';

// 在这里写类型测试
```
:::

:::variant{kind=wrong name=types-only fails=mutants misses=no-encoding,first-only reason="类型测试写全了，运行时只测了一个参数的简单情况：编码和多个参数的替换没有检查"}
```ts file=href.test.ts
import { describe, expect, test } from 'vitest';
import { href } from './href';

describe('href', () => {
  test('替换参数', () => {
    expect(href('/users/:id', { id: 42 })).toBe('/users/42');
  });
});
```
```ts file=href.test-d.ts
import { expectTypeOf } from 'vitest';
import { href, type ParamNames } from './href';

expectTypeOf<ParamNames<'/users/:id/posts/:postId'>>().toEqualTypeOf<'id' | 'postId'>();
expectTypeOf<ParamNames<'/about'>>().toBeNever();
expectTypeOf(href('/users/:id', { id: 1 })).toEqualTypeOf<string>();

// @ts-expect-error 缺少 postId
href('/users/:id/posts/:postId', { id: 1 });
// @ts-expect-error 多了一个参数
href('/users/:id', { id: 1, page: 2 });
// @ts-expect-error 参数名拼错了
href('/users/:id', { ID: 1 });
// @ts-expect-error 参数值只能是字符串或数字
href('/users/:id', { id: true });
// @ts-expect-error 没有参数的路径不接受第二个参数
href('/about', {});
```
:::

:::variant{kind=wrong name=unencoded-expectation fails=tests reason="期望参数值原样出现在路径中：a b/c? 放进路径会被当成多个路径段和查询参数"}
```ts file=href.test.ts
import { describe, expect, test } from 'vitest';
import { href } from './href';

describe('href', () => {
  test('替换参数', () => {
    expect(href('/users/:id', { id: 42 })).toBe('/users/42');
    expect(href('/users/:id/posts/:postId', { id: 'ada', postId: 7 })).toBe('/users/ada/posts/7');
  });

  test('参数值被编码', () => {
    expect(href('/search/:q', { q: 'a b/c?' })).toBe('/search/a b/c?');
  });

  test('没有参数的路径原样返回', () => {
    expect(href('/about')).toBe('/about');
  });
});
```
```ts file=href.test-d.ts
import { expectTypeOf } from 'vitest';
import { href, type ParamNames } from './href';

expectTypeOf<ParamNames<'/users/:id/posts/:postId'>>().toEqualTypeOf<'id' | 'postId'>();
expectTypeOf<ParamNames<'/about'>>().toBeNever();
expectTypeOf(href('/users/:id', { id: 1 })).toEqualTypeOf<string>();

// @ts-expect-error 缺少 postId
href('/users/:id/posts/:postId', { id: 1 });
// @ts-expect-error 多了一个参数
href('/users/:id', { id: 1, page: 2 });
// @ts-expect-error 参数名拼错了
href('/users/:id', { ID: 1 });
// @ts-expect-error 参数值只能是字符串或数字
href('/users/:id', { id: true });
// @ts-expect-error 没有参数的路径不接受第二个参数
href('/about', {});
```
:::
