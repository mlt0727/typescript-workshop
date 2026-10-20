---
kind: challenge
title: 由路由字符串推导参数
---
在 `routes.ts` 中实现一个小的路由工具，参数名全部从路由字符串推导出来：

1. **`Params<R>`**：路由 `R` 中所有以 `:` 开头的段的名字组成的联合，没有参数时是 `never`。例如 `Params<'/posts/:postId/comments/:commentId'>` 是 `'postId' | 'commentId'`；
2. **`buildPath(route, params)`**：`params` 的类型是 `Record<Params<R>, string>`，少传、多传、写错参数名都要在编译期报错。把每个 `:名字` 换成对应的值（用 `encodeURIComponent` 编码）；运行时缺少某个参数（例如路由不是字面量的时候）抛出 `Error`，`message` 是 `缺少参数：名字`；
3. **`matchPath(route, path)`**：判断路径是否匹配路由，匹配时返回参数对象（类型 `Record<Params<R>, string>`，值用 `decodeURIComponent` 解码），否则返回 `null`。规则：按 `/` 切分后段数相同；普通的段必须完全相同；参数段不能是空的；解码失败（例如 `%E0%A4%A`）时也返回 `null`；
4. **`ROUTES`** 是一张命名的路由表（已经给出），**`link(name, params)`** 按名字生成路径，参数的类型同样由这条路由决定：`link('comment', { postId: '7' })` 要报错。

不能使用类型断言（`as const` 可以使用）。

:::files{role=starter}
```ts file=routes.ts
export const ROUTES = {
  home: '/',
  user: '/users/:id',
  comment: '/posts/:postId/comments/:commentId',
} as const;

export type RouteName = keyof typeof ROUTES;

export type Params<R extends string> = string;

export function buildPath(route: string, params: Record<string, string>): string {
  return route;
}

export function matchPath(route: string, path: string): Record<string, string> | null {
  return null;
}

export function link(name: RouteName, params: Record<string, string>): string {
  return buildPath(ROUTES[name], params);
}
```
```ts file=main.ts
import { buildPath, link, matchPath } from './routes';

console.log(buildPath('/users/:id', { id: 'a b' }));
console.log(link('comment', { postId: '7', commentId: '3' }));
console.log(matchPath('/posts/:postId/comments/:commentId', '/posts/7/comments/3'));
console.log(matchPath('/users/:id', '/posts/7'));
```
:::

:::files{role=solution}
```ts file=routes.ts
export const ROUTES = {
  home: '/',
  user: '/users/:id',
  comment: '/posts/:postId/comments/:commentId',
} as const;

export type RouteName = keyof typeof ROUTES;

export type Params<R extends string> = R extends `${string}:${infer Name}/${infer Rest}`
  ? Name | Params<`/${Rest}`>
  : R extends `${string}:${infer Name}`
    ? Name
    : never;

export function buildPath<R extends string>(route: R, params: Record<Params<R>, string>): string {
  const lookup: Record<string, string | undefined> = params;
  return route
    .split('/')
    .map((segment) => {
      if (!segment.startsWith(':')) return segment;
      const name = segment.slice(1);
      const value = lookup[name];
      if (value === undefined) throw new Error(`缺少参数：${name}`);
      return encodeURIComponent(value);
    })
    .join('/');
}

export function matchPath<R extends string>(route: R, path: string): Record<Params<R>, string> | null {
  const routeParts = route.split('/');
  const pathParts = path.split('/');
  if (routeParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (const [index, part] of routeParts.entries()) {
    const actual = pathParts[index] ?? '';
    if (!part.startsWith(':')) {
      if (part !== actual) return null;
      continue;
    }
    if (actual === '') return null;
    try {
      params[part.slice(1)] = decodeURIComponent(actual);
    } catch {
      return null;
    }
  }
  return params;
}

export function link<N extends RouteName>(name: N, params: Record<Params<(typeof ROUTES)[N]>, string>): string {
  return buildPath(ROUTES[name], params);
}
```
```ts file=main.ts
import { buildPath, link, matchPath } from './routes';

console.log(buildPath('/users/:id', { id: 'a b' }));
console.log(link('comment', { postId: '7', commentId: '3' }));
console.log(matchPath('/posts/:postId/comments/:commentId', '/posts/7/comments/3'));
console.log(matchPath('/users/:id', '/posts/7'));
```
:::

:::files{role=tests}
```ts file=routes.test.ts
import { describe, expect, test } from 'vitest';
import { buildPath, link, matchPath } from './routes';

describe('buildPath', () => {
  test('替换参数并编码', () => {
    expect(buildPath('/users/:id', { id: '42' })).toBe('/users/42');
    expect(buildPath('/posts/:postId/comments/:commentId', { postId: '7', commentId: '3' })).toBe('/posts/7/comments/3');
    expect(buildPath('/users/:id', { id: 'a b/c' })).toBe('/users/a%20b%2Fc');
    expect(buildPath('/about', {})).toBe('/about');
  });

  test('路由不是字面量时，运行时检查缺少的参数', () => {
    const route: string = '/users/:id';
    expect(() => buildPath(route, {})).toThrow('缺少参数：id');
  });
});

describe('matchPath', () => {
  test('匹配时返回解码后的参数', () => {
    expect(matchPath('/posts/:postId/comments/:commentId', '/posts/7/comments/3')).toEqual({ postId: '7', commentId: '3' });
    expect(matchPath('/users/:id', '/users/a%20b')).toEqual({ id: 'a b' });
    expect(matchPath('/about', '/about')).toEqual({});
  });

  test('不匹配时返回 null', () => {
    expect(matchPath('/users/:id', '/posts/7')).toBeNull();
    expect(matchPath('/users/:id', '/users')).toBeNull();
    expect(matchPath('/users/:id', '/users/7/edit')).toBeNull();
    expect(matchPath('/users/:id', '/users/')).toBeNull();
    expect(matchPath('/users/:id', '/users/%E0%A4%A')).toBeNull();
  });
});

describe('link', () => {
  test('按名字生成路径', () => {
    expect(link('home', {})).toBe('/');
    expect(link('user', { id: 'u1' })).toBe('/users/u1');
    expect(link('comment', { postId: '7', commentId: '3' })).toBe('/posts/7/comments/3');
  });
});
```
```ts file=routes.test-d.ts
import { expectTypeOf } from 'vitest';
import { buildPath, link, matchPath, type Params } from './routes';

expectTypeOf<Params<'/users/:id'>>().toEqualTypeOf<'id'>();
expectTypeOf<Params<'/posts/:postId/comments/:commentId'>>().toEqualTypeOf<'postId' | 'commentId'>();
expectTypeOf<Params<'/a/:x/b/:y/c'>>().toEqualTypeOf<'x' | 'y'>();
expectTypeOf<Params<'/about'>>().toEqualTypeOf<never>();

expectTypeOf(matchPath('/users/:id', '/users/1')).toEqualTypeOf<Record<'id', string> | null>();

// @ts-expect-error 少了 commentId
buildPath('/posts/:postId/comments/:commentId', { postId: '7' });
// @ts-expect-error 参数名写错
buildPath('/users/:id', { userId: '1' });
// @ts-expect-error 多了参数
buildPath('/users/:id', { id: '1', extra: '2' });
// @ts-expect-error 少了 commentId
link('comment', { postId: '7' });
// @ts-expect-error 不存在的路由名
link('profile', {});
```
:::

:::hint{level=1}
`Params` 照着正文写：第一个分支匹配 `` `${string}:${infer Name}/${infer Rest}` ``，取出 `Name`，再对 `` `/${Rest}` `` 递归；第二个分支匹配最后一个参数；都不匹配时是 `never`。`buildPath`、`matchPath` 都对路由泛型：`<R extends string>(route: R, …)`。
:::

:::hint{level=2}
`Record<Params<R>, string>` 可以赋值给 `Record<string, string | undefined>`，之后用运行时的名字查找。`matchPath` 中先建一个 `const params: Record<string, string> = {}`，逐段比较、填入，最后返回它（它可以赋值给返回类型）。`link` 的参数类型写成 `Record<Params<(typeof ROUTES)[N]>, string>`，函数体直接 `buildPath(ROUTES[name], params)`。`decodeURIComponent` 遇到不完整的 `%` 序列会抛出 `URIError`，用 `try/catch` 接住。
:::

:::explanation
`Params` 是一个递归的条件类型：每次取出第一个参数名，再处理剩下的部分，直到没有 `:` 为止。`buildPath` 对路由泛型之后，`R` 被推断成调用处的字面量，参数对象的键就被精确地算了出来。

两点需要清楚地认识到：

- **类型只检查字面量**。`route` 的类型是 `string` 时，`Params<string>` 是 `never`，参数对象可以是任何东西，所以 `buildPath` 中运行时的“缺少参数”检查必须保留（第二个测试）；
- **`matchPath` 的返回类型是“承诺”而不是检查**。`params` 的类型是 `Record<string, string>`，TypeScript 允许把它赋值给 `Record<Params<R>, string>`，但不会检查每个参数都确实填了。真正保证这一点的是实现本身：段数相同、每个参数段都填入了值，以及覆盖这些情况的测试。

`link` 展示了类型的“传递”：`ROUTES` 用 `as const` 保留了每条路由的字面量，`(typeof ROUTES)[N]` 取出名字为 `N` 的那一条，再交给 `Params`，于是按名字生成链接时同样能检查参数。
:::

:::variant{kind=alt name=regex-based}
```ts file=routes.ts
export const ROUTES = {
  home: '/',
  user: '/users/:id',
  comment: '/posts/:postId/comments/:commentId',
} as const;

export type RouteName = keyof typeof ROUTES;

type Segments<S extends string> = S extends `${infer Head}/${infer Tail}` ? Head | Segments<Tail> : S;
export type Params<R extends string> = Segments<R> extends infer Part ? (Part extends `:${infer Name}` ? Name : never) : never;

export function buildPath<R extends string>(route: R, params: Record<Params<R>, string>): string {
  const values = new Map<string, string>(Object.entries(params));
  return route.replace(/:([^/]+)/g, (_match, name: string) => {
    const value = values.get(name);
    if (value === undefined) throw new Error(`缺少参数：${name}`);
    return encodeURIComponent(value);
  });
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function matchPath<R extends string>(route: R, path: string): Record<Params<R>, string> | null {
  const names: string[] = [];
  const pattern = route
    .split('/')
    .map((part) => {
      if (!part.startsWith(':')) return escapeRegExp(part);
      names.push(part.slice(1));
      return '([^/]+)';
    })
    .join('/');
  const match = new RegExp(`^${pattern}$`).exec(path);
  if (match === null) return null;
  const result: Record<string, string> = {};
  for (const [i, name] of names.entries()) {
    const raw = match[i + 1];
    if (raw === undefined) return null;
    try {
      result[name] = decodeURIComponent(raw);
    } catch {
      return null;
    }
  }
  return result;
}

export function link<N extends RouteName>(name: N, params: Record<Params<(typeof ROUTES)[N]>, string>): string {
  return buildPath(ROUTES[name], params);
}
```
:::

:::variant{kind=wrong name=string-params fails=types reason="参数对象的类型是 Record<string, string>，少传、写错参数名都不会报错"}
```ts file=routes.ts
export const ROUTES = {
  home: '/',
  user: '/users/:id',
  comment: '/posts/:postId/comments/:commentId',
} as const;

export type RouteName = keyof typeof ROUTES;

export type Params<R extends string> = R extends `${string}:${infer Name}/${infer Rest}`
  ? Name | Params<`/${Rest}`>
  : R extends `${string}:${infer Name}`
    ? Name
    : never;

export function buildPath(route: string, params: Record<string, string>): string {
  return route
    .split('/')
    .map((segment) => {
      if (!segment.startsWith(':')) return segment;
      const name = segment.slice(1);
      const value = params[name];
      if (value === undefined) throw new Error(`缺少参数：${name}`);
      return encodeURIComponent(value);
    })
    .join('/');
}

export function matchPath<R extends string>(route: R, path: string): Record<Params<R>, string> | null {
  const routeParts = route.split('/');
  const pathParts = path.split('/');
  if (routeParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (const [index, part] of routeParts.entries()) {
    const actual = pathParts[index] ?? '';
    if (!part.startsWith(':')) {
      if (part !== actual) return null;
      continue;
    }
    if (actual === '') return null;
    try {
      params[part.slice(1)] = decodeURIComponent(actual);
    } catch {
      return null;
    }
  }
  return params;
}

export function link(name: RouteName, params: Record<string, string>): string {
  return buildPath(ROUTES[name], params);
}
```
:::

:::variant{kind=wrong name=only-first-param fails=types reason="Params 没有递归，只取出了第一个参数"}
```ts file=routes.ts
export const ROUTES = {
  home: '/',
  user: '/users/:id',
  comment: '/posts/:postId/comments/:commentId',
} as const;

export type RouteName = keyof typeof ROUTES;

export type Params<R extends string> = R extends `${string}:${infer Name}/${string}`
  ? Name
  : R extends `${string}:${infer Name}`
    ? Name
    : never;

export function buildPath<R extends string>(route: R, params: Record<Params<R>, string>): string {
  const lookup: Record<string, string | undefined> = params;
  return route
    .split('/')
    .map((segment) => {
      if (!segment.startsWith(':')) return segment;
      const name = segment.slice(1);
      const value = lookup[name];
      if (value === undefined) throw new Error(`缺少参数：${name}`);
      return encodeURIComponent(value);
    })
    .join('/');
}

export function matchPath<R extends string>(route: R, path: string): Record<Params<R>, string> | null {
  const routeParts = route.split('/');
  const pathParts = path.split('/');
  if (routeParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (const [index, part] of routeParts.entries()) {
    const actual = pathParts[index] ?? '';
    if (!part.startsWith(':')) {
      if (part !== actual) return null;
      continue;
    }
    if (actual === '') return null;
    try {
      params[part.slice(1)] = decodeURIComponent(actual);
    } catch {
      return null;
    }
  }
  return params;
}

export function link<N extends RouteName>(name: N, params: Record<Params<(typeof ROUTES)[N]>, string>): string {
  return buildPath(ROUTES[name], params);
}
```
:::

:::variant{kind=wrong name=no-decode-guard fails=tests reason="没有接住 decodeURIComponent 的异常，不完整的 % 序列让 matchPath 抛出了错误"}
```ts file=routes.ts
export const ROUTES = {
  home: '/',
  user: '/users/:id',
  comment: '/posts/:postId/comments/:commentId',
} as const;

export type RouteName = keyof typeof ROUTES;

export type Params<R extends string> = R extends `${string}:${infer Name}/${infer Rest}`
  ? Name | Params<`/${Rest}`>
  : R extends `${string}:${infer Name}`
    ? Name
    : never;

export function buildPath<R extends string>(route: R, params: Record<Params<R>, string>): string {
  const lookup: Record<string, string | undefined> = params;
  return route
    .split('/')
    .map((segment) => {
      if (!segment.startsWith(':')) return segment;
      const name = segment.slice(1);
      const value = lookup[name];
      if (value === undefined) throw new Error(`缺少参数：${name}`);
      return encodeURIComponent(value);
    })
    .join('/');
}

export function matchPath<R extends string>(route: R, path: string): Record<Params<R>, string> | null {
  const routeParts = route.split('/');
  const pathParts = path.split('/');
  if (routeParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (const [index, part] of routeParts.entries()) {
    const actual = pathParts[index] ?? '';
    if (!part.startsWith(':')) {
      if (part !== actual) return null;
      continue;
    }
    if (actual === '') return null;
    params[part.slice(1)] = decodeURIComponent(actual);
  }
  return params;
}

export function link<N extends RouteName>(name: N, params: Record<Params<(typeof ROUTES)[N]>, string>): string {
  return buildPath(ROUTES[name], params);
}
```
:::

:::variant{kind=wrong name=empty-segment-ok fails=tests reason="参数段是空的也算匹配"}
```ts file=routes.ts
export const ROUTES = {
  home: '/',
  user: '/users/:id',
  comment: '/posts/:postId/comments/:commentId',
} as const;

export type RouteName = keyof typeof ROUTES;

export type Params<R extends string> = R extends `${string}:${infer Name}/${infer Rest}`
  ? Name | Params<`/${Rest}`>
  : R extends `${string}:${infer Name}`
    ? Name
    : never;

export function buildPath<R extends string>(route: R, params: Record<Params<R>, string>): string {
  const lookup: Record<string, string | undefined> = params;
  return route
    .split('/')
    .map((segment) => {
      if (!segment.startsWith(':')) return segment;
      const name = segment.slice(1);
      const value = lookup[name];
      if (value === undefined) throw new Error(`缺少参数：${name}`);
      return encodeURIComponent(value);
    })
    .join('/');
}

export function matchPath<R extends string>(route: R, path: string): Record<Params<R>, string> | null {
  const routeParts = route.split('/');
  const pathParts = path.split('/');
  if (routeParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (const [index, part] of routeParts.entries()) {
    const actual = pathParts[index] ?? '';
    if (!part.startsWith(':')) {
      if (part !== actual) return null;
      continue;
    }
    try {
      params[part.slice(1)] = decodeURIComponent(actual);
    } catch {
      return null;
    }
  }
  return params;
}

export function link<N extends RouteName>(name: N, params: Record<Params<(typeof ROUTES)[N]>, string>): string {
  return buildPath(ROUTES[name], params);
}
```
:::
