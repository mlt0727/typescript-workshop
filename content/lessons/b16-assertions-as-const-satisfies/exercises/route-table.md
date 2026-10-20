---
kind: challenge
title: 路由表
---
网站的路由集中写在一张表里。要求：表中每一项都必须符合 `Route` 类型；同时，路由名称的类型要从表中推导出来——写错名称（例如 `'profle'`）应该在编译期报错。

```ts
type Route = { path: string; auth: boolean };
```

1. 定义并导出 `ROUTES`，包含三条路由：`home`（`'/'`，不需要登录）、`profile`（`'/users/:id'`，需要登录）、`comment`（`'/posts/:postId/comments/:commentId'`，不需要登录）。用 `satisfies` 检查它符合 `Record<string, Route>`。
2. 导出 `type RouteName`：`ROUTES` 的键（结果应为 `'home' | 'profile' | 'comment'`）。
3. 实现 `buildPath(name, params)`：把路径中以 `:` 开头的段替换成 `params` 中同名的值（用 `encodeURIComponent` 编码）；缺少某个参数时抛出 `Error`，`message` 为 `` `缺少参数：${参数名}` ``。多余的参数忽略。`params` 默认为空对象。
4. 实现 `requiresAuth(name)`：返回这条路由是否需要登录。

例如 `buildPath('profile', { id: '42' })` 得到 `'/users/42'`。

:::files{role=starter}
```ts file=routes.ts
export type Route = { path: string; auth: boolean };

export const ROUTES: Record<string, Route> = {
  home: { path: '/', auth: false },
};

export type RouteName = keyof typeof ROUTES;

export function buildPath(name: RouteName, params: Record<string, string> = {}): string {
  return ROUTES[name]?.path ?? '';
}
```
:::

:::files{role=solution}
```ts file=routes.ts
export type Route = { path: string; auth: boolean };

export const ROUTES = {
  home: { path: '/', auth: false },
  profile: { path: '/users/:id', auth: true },
  comment: { path: '/posts/:postId/comments/:commentId', auth: false },
} satisfies Record<string, Route>;

export type RouteName = keyof typeof ROUTES;

export function buildPath(name: RouteName, params: Record<string, string> = {}): string {
  return ROUTES[name].path
    .split('/')
    .map((segment) => {
      if (!segment.startsWith(':')) {
        return segment;
      }
      const key = segment.slice(1);
      const value = params[key];
      if (value === undefined) {
        throw new Error(`缺少参数：${key}`);
      }
      return encodeURIComponent(value);
    })
    .join('/');
}

export function requiresAuth(name: RouteName): boolean {
  return ROUTES[name].auth;
}
```
:::

:::files{role=tests}
```ts file=routes.test.ts
import { describe, expect, test } from 'vitest';
import { ROUTES, buildPath, requiresAuth } from './routes';

describe('ROUTES', () => {
  test('三条路由', () => {
    expect(ROUTES).toEqual({
      home: { path: '/', auth: false },
      profile: { path: '/users/:id', auth: true },
      comment: { path: '/posts/:postId/comments/:commentId', auth: false },
    });
  });
});

describe('buildPath', () => {
  test('没有参数的路由', () => {
    expect(buildPath('home')).toBe('/');
  });

  test('替换参数', () => {
    expect(buildPath('profile', { id: '42' })).toBe('/users/42');
    expect(buildPath('comment', { postId: '7', commentId: '3' })).toBe('/posts/7/comments/3');
  });

  test('编码参数，忽略多余的参数', () => {
    expect(buildPath('profile', { id: 'a b/c', extra: 'x' })).toBe('/users/a%20b%2Fc');
  });

  test('缺少参数时抛出', () => {
    expect(() => buildPath('comment', { postId: '7' })).toThrow('缺少参数：commentId');
    expect(() => buildPath('profile')).toThrow('缺少参数：id');
  });
});

describe('requiresAuth', () => {
  test('是否需要登录', () => {
    expect(requiresAuth('profile')).toBe(true);
    expect(requiresAuth('home')).toBe(false);
  });
});
```
```ts file=routes.test-d.ts
import { expectTypeOf } from 'vitest';
import { buildPath, type RouteName } from './routes';

expectTypeOf<RouteName>().toEqualTypeOf<'home' | 'profile' | 'comment'>();

// @ts-expect-error 拼错的路由名称应该在编译期被发现
buildPath('profle', { id: '1' });
```
:::

:::hint{level=1}
起始代码给 `ROUTES` 写了类型注解 `Record<string, Route>`，于是 `keyof typeof ROUTES` 变成了 `string`，任何名字都能传入。把注解换成 `satisfies Record<string, Route>`，具体的键就保留下来了。
:::

:::hint{level=2}
`buildPath`：`ROUTES[name].path.split('/')`，对每一段判断 `startsWith(':')`，是参数就用 `params[segment.slice(1)]` 替换（注意它的类型是 `string | undefined`，缺少时抛出），最后 `join('/')`。因为 `RouteName` 是三个具体的键，`ROUTES[name]` 一定存在，不需要 `?.`。
:::

:::explanation
起始代码的问题在于类型注解“太宽”：写成 `const ROUTES: Record<string, Route>` 之后，TypeScript 只记得“这是一个字符串到 `Route` 的映射”，具体有哪些键全都丢了。于是 `RouteName` 是 `string`，`'profle'` 这样的拼写错误要到运行时才暴露；`ROUTES[name]` 的类型还是 `Route | undefined`（`noUncheckedIndexedAccess`），每次都得检查。

`satisfies Record<string, Route>` 只做检查：每一项都必须是合法的 `Route`（写错 `auth` 的类型会报错），而 `ROUTES` 自身的类型保留了三个具体的键。`keyof typeof ROUTES` 于是是 `'home' | 'profile' | 'comment'`，`ROUTES[name]` 也一定存在。

`params[key]` 来自 `Record<string, string>`，类型是 `string | undefined`：缺少参数正是规格要处理的情况。`encodeURIComponent` 把空格、`/` 等字符编码，避免参数值破坏路径结构（E 阶段讲 URL 时会再遇到）。
:::

:::variant{kind=alt name=as-const-satisfies}
```ts file=routes.ts
export type Route = { path: string; auth: boolean };

export const ROUTES = {
  home: { path: '/', auth: false },
  profile: { path: '/users/:id', auth: true },
  comment: { path: '/posts/:postId/comments/:commentId', auth: false },
} as const satisfies Record<string, Route>;

export type RouteName = keyof typeof ROUTES;

export function buildPath(name: RouteName, params: Record<string, string> = {}): string {
  const parts: string[] = [];
  for (const segment of ROUTES[name].path.split('/')) {
    if (segment.startsWith(':')) {
      const value = params[segment.slice(1)];
      if (value === undefined) throw new Error(`缺少参数：${segment.slice(1)}`);
      parts.push(encodeURIComponent(value));
    } else {
      parts.push(segment);
    }
  }
  return parts.join('/');
}

export function requiresAuth(name: RouteName): boolean {
  return ROUTES[name].auth;
}
```
:::

:::variant{kind=wrong name=annotation-widens fails=types reason="用类型注解代替 satisfies，路由名称变成了 string"}
```ts file=routes.ts
export type Route = { path: string; auth: boolean };

export const ROUTES: Record<string, Route> = {
  home: { path: '/', auth: false },
  profile: { path: '/users/:id', auth: true },
  comment: { path: '/posts/:postId/comments/:commentId', auth: false },
};

export type RouteName = keyof typeof ROUTES;

export function buildPath(name: RouteName, params: Record<string, string> = {}): string {
  const route = ROUTES[name];
  if (route === undefined) throw new Error('没有这条路由');
  return route.path
    .split('/')
    .map((s) => {
      if (!s.startsWith(':')) return s;
      const value = params[s.slice(1)];
      if (value === undefined) throw new Error(`缺少参数：${s.slice(1)}`);
      return encodeURIComponent(value);
    })
    .join('/');
}

export function requiresAuth(name: RouteName): boolean {
  return ROUTES[name]?.auth ?? false;
}
```
:::

:::variant{kind=wrong name=assertion-table fails=rules reason="用 as 断言路由表的类型，绕过了检查"}
```ts file=routes.ts
export type Route = { path: string; auth: boolean };

export const ROUTES = {
  home: { path: '/', auth: false },
  profile: { path: '/users/:id', auth: true },
  comment: { path: '/posts/:postId/comments/:commentId', auth: false },
} as { home: Route; profile: Route; comment: Route };

export type RouteName = keyof typeof ROUTES;

export function buildPath(name: RouteName, params: Record<string, string> = {}): string {
  return ROUTES[name].path
    .split('/')
    .map((s) => {
      if (!s.startsWith(':')) return s;
      const value = params[s.slice(1)];
      if (value === undefined) throw new Error(`缺少参数：${s.slice(1)}`);
      return encodeURIComponent(value);
    })
    .join('/');
}

export function requiresAuth(name: RouteName): boolean {
  return ROUTES[name].auth;
}
```
:::

:::variant{kind=wrong name=no-encoding fails=tests reason="没有对参数值编码"}
```ts file=routes.ts
export type Route = { path: string; auth: boolean };

export const ROUTES = {
  home: { path: '/', auth: false },
  profile: { path: '/users/:id', auth: true },
  comment: { path: '/posts/:postId/comments/:commentId', auth: false },
} satisfies Record<string, Route>;

export type RouteName = keyof typeof ROUTES;

export function buildPath(name: RouteName, params: Record<string, string> = {}): string {
  return ROUTES[name].path
    .split('/')
    .map((s) => {
      if (!s.startsWith(':')) return s;
      const value = params[s.slice(1)];
      if (value === undefined) throw new Error(`缺少参数：${s.slice(1)}`);
      return value;
    })
    .join('/');
}

export function requiresAuth(name: RouteName): boolean {
  return ROUTES[name].auth;
}
```
:::
