---
kind: task
title: 匹配路径模式
---
在 `pattern.ts` 中实现 `matchPattern(pattern, pathname)`：判断路径 `pathname`（以 `/` 开头，不含查询参数）是否匹配 vercel.json 中 `source` 的写法，匹配时返回参数，不匹配时返回 `null`。只需要支持其中的一个子集：

1. 模式和路径都按 `/` 分成段（开头的 `/` 之后）。普通的段必须与路径中对应的段**完全相同**（区分大小写）；
2. `:名字` 匹配正好一段，这一段不能为空，参数的值就是这一段的原文（不解码，`%2F` 就是三个字符）；
3. 最后一段可以是 `:名字*`：匹配剩下的零段或多段，每一段都不能为空，参数的值是这些段用 `/` 连起来（零段时是空字符串）；
4. 最后一段可以是 `(.*)`：匹配剩下的一切（可以为空，也可以含有 `/`），参数名是 `'0'`；
5. 段的数量必须对上：结尾多一个斜杠（`/settings/` 对 `/settings`）、多一段、少一段都不匹配。模式 `/` 只匹配路径 `/`。

这些规则与这个网站在 Vercel 上实测的结果一致，也与 path-to-regexp 6.3.0 在 `strict: true`、`sensitive: true` 时的结果一致（它对 `:名字*` 返回数组，这里连成了字符串）。

:::files{role=starter}
```ts file=pattern.ts
/** 匹配得到的参数：参数名 → 匹配到的文字 */
export type Params = Record<string, string>;

/**
 * 判断路径 pathname 是否匹配模式 pattern（vercel.json 中 source 的写法的一个子集）。
 * 匹配时返回参数，不匹配时返回 null。
 */
export function matchPattern(pattern: string, pathname: string): Params | null {
  return pattern === pathname ? {} : null;
}
```
```ts file=main.ts
import { matchPattern } from './pattern';

for (const [pattern, path] of [
  ['/learn/:lessonId', '/learn/a01-where-ts-runs'],
  ['/api/:path*', '/api/sync'],
  ['/(.*)', '/projects/42'],
  ['/settings', '/settings/'],
] as const) {
  console.log(pattern.padEnd(18), path.padEnd(26), matchPattern(pattern, path));
}
```
:::

:::files{role=solution}
```ts file=pattern.ts
/** 匹配得到的参数：参数名 → 匹配到的文字 */
export type Params = Record<string, string>;

/**
 * 判断路径 pathname 是否匹配模式 pattern（vercel.json 中 source 的写法的一个子集）。
 * 匹配时返回参数，不匹配时返回 null。
 */
export function matchPattern(pattern: string, pathname: string): Params | null {
  if (pattern === '/') return pathname === '/' ? {} : null;
  const parts = pattern.split('/').slice(1);
  const segments = pathname.split('/').slice(1);
  const params: Params = {};
  for (const [i, part] of parts.entries()) {
    const last = i === parts.length - 1;
    const rest = segments.slice(i);
    if (last && part === '(.*)') {
      // 剩下的全部（可以为空，可以含有 /）
      params['0'] = rest.join('/');
      return params;
    }
    if (last && part.startsWith(':') && part.endsWith('*')) {
      // 零段或多段，每一段都不能为空
      if (rest.includes('')) return null;
      params[part.slice(1, -1)] = rest.join('/');
      return params;
    }
    const segment = segments[i];
    if (segment === undefined || segment === '') return null;
    if (part.startsWith(':')) params[part.slice(1)] = segment;
    else if (part !== segment) return null;
  }
  return segments.length === parts.length ? params : null;
}
```
```ts file=main.ts
import { matchPattern } from './pattern';

for (const [pattern, path] of [
  ['/learn/:lessonId', '/learn/a01-where-ts-runs'],
  ['/api/:path*', '/api/sync'],
  ['/(.*)', '/projects/42'],
  ['/settings', '/settings/'],
] as const) {
  console.log(pattern.padEnd(18), path.padEnd(26), matchPattern(pattern, path));
}
```
:::

:::files{role=tests}
```ts file=pattern.test.ts
import { describe, expect, test } from 'vitest';
import { matchPattern } from './pattern';

describe('matchPattern', () => {
  test('固定的路径：整段相同才匹配', () => {
    expect(matchPattern('/settings', '/settings')).toEqual({});
    expect(matchPattern('/', '/')).toEqual({});
    expect(matchPattern('/', '/settings')).toBeNull();
    expect(matchPattern('/settings', '/settings/x')).toBeNull();
    expect(matchPattern('/settings', '/setting')).toBeNull();
  });

  test('区分大小写；结尾的 / 不能多也不能少（与本站在 Vercel 上实测的一致）', () => {
    expect(matchPattern('/settings', '/Settings')).toBeNull();
    expect(matchPattern('/settings', '/settings/')).toBeNull();
    expect(matchPattern('/learn/:lessonId', '/learn/a01/')).toBeNull();
    expect(matchPattern('/learn/:lessonId', '/Learn/a01')).toBeNull();
  });

  test(':名字 匹配正好一段，不能为空', () => {
    expect(matchPattern('/learn/:lessonId', '/learn/a01-where-ts-runs')).toEqual({ lessonId: 'a01-where-ts-runs' });
    expect(matchPattern('/resize/:width/:height', '/resize/800/600')).toEqual({ width: '800', height: '600' });
    expect(matchPattern('/a/:x/b', '/a/1/b')).toEqual({ x: '1' });
    expect(matchPattern('/learn/:lessonId', '/learn/')).toBeNull();
    expect(matchPattern('/learn/:lessonId', '/learn')).toBeNull();
    expect(matchPattern('/learn/:lessonId', '/learn/a/b')).toBeNull();
    expect(matchPattern('/resize/:width/:height', '/resize/800')).toBeNull();
  });

  test('参数不解码：%2F 只是三个普通的字符', () => {
    expect(matchPattern('/docs/:slug', '/docs/a%2Fb')).toEqual({ slug: 'a%2Fb' });
    expect(matchPattern('/docs/:slug', '/docs/a.b')).toEqual({ slug: 'a.b' });
  });

  test('结尾的 :名字* 匹配零段或多段，用 / 连起来', () => {
    expect(matchPattern('/api/:path*', '/api/sync')).toEqual({ path: 'sync' });
    expect(matchPattern('/api/:path*', '/api/a/b/c')).toEqual({ path: 'a/b/c' });
    expect(matchPattern('/api/:path*', '/api')).toEqual({ path: '' });
    expect(matchPattern('/blog/:year/:slug*', '/blog/2026/x/y')).toEqual({ year: '2026', slug: 'x/y' });
    expect(matchPattern('/api/:path*', '/apix')).toBeNull();
    expect(matchPattern('/api/:path*', '/api/')).toBeNull();
    expect(matchPattern('/api/:path*', '/api/a//b')).toBeNull();
  });

  test('结尾的 (.*) 匹配剩下的一切，参数名是 0', () => {
    expect(matchPattern('/(.*)', '/')).toEqual({ '0': '' });
    expect(matchPattern('/(.*)', '/learn/a01')).toEqual({ '0': 'learn/a01' });
    expect(matchPattern('/(.*)', '/x/')).toEqual({ '0': 'x/' });
    expect(matchPattern('/assets/(.*)', '/assets/index-wktXvZw9.js')).toEqual({ '0': 'index-wktXvZw9.js' });
  });
});
```
```ts file=pattern.test-d.ts
import { expectTypeOf } from 'vitest';
import { matchPattern, type Params } from './pattern';

expectTypeOf(matchPattern).returns.toEqualTypeOf<Params | null>();
expectTypeOf<Params>().toEqualTypeOf<Record<string, string>>();
```
:::

:::hint{level=1}
`pattern.split('/').slice(1)` 和 `pathname.split('/').slice(1)` 得到两组段（`'/settings/'` 分出来是 `['settings', '']`，最后的空字符串正好表示“多了一个斜杠”）。逐段比较：普通的段用 `===`，`:名字` 记下参数；遇到最后一段是 `:名字*` 或 `(.*)` 时，用 `segments.slice(i)` 取出剩下的段，处理完直接返回。循环结束后检查两边的段数是否相同。
:::

:::hint{level=2}
“段不能为空”要在两个地方检查：`:名字` 对应的那一段，以及 `:名字*` 取出的每一段（`rest.includes('')`），这样 `/learn/`、`/api/`、`/api/a//b` 都不匹配。`(.*)` 不检查，它要能匹配 `/` 和 `x/`。模式 `/` 是一个特殊情况，单独处理最简单。
:::

:::explanation
路径模式是一个很小的“语言”：每种写法匹配什么，规则要写得清清楚楚。这道题的几条规则，每一条都对应一个实际的坑：

- **区分大小写、结尾的斜杠**：用户手动输入、或者别的网站链接过来的地址，可能是 `/Settings`、`/settings/`。实测 Vercel 对它们都返回 404。直接使用 path-to-regexp 时要注意，它的默认值是不区分大小写、允许结尾多一个斜杠（`sensitive: false`、`strict: false`），和 Vercel 不同；
- **`:名字` 不匹配空的一段**：`/learn/` 不应该被当成 `lessonId` 为空的课程页面；
- **`:名字*` 可以是零段**：`/api/:path*` 同时匹配 `/api` 和 `/api/sync`，所以一条规则就能把整个 `/api` 交给函数；
- **`(.*)` 匹配一切**：单页应用的回退规则 `/(.*)` 靠它匹配所有的路径，包括 `/`。

参考解逐段比较，替代解把模式翻译成一个正则（`:名字` 变成 `([^/]+)`，`:名字*` 变成 `((?:/[^/]+)*)`）。这正是 path-to-regexp 的做法，它的名字就是 “path to RegExp”。两种写法都对照过 path-to-regexp 6.3.0 的结果。
:::

:::variant{kind=alt name=compile-regexp}
```ts file=pattern.ts
/** 匹配得到的参数：参数名 → 匹配到的文字 */
export type Params = Record<string, string>;

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 把模式翻译成正则：每一段变成正则的一部分，参数名按顺序记下来 */
function compile(pattern: string): { regex: RegExp; names: string[] } {
  const names: string[] = [];
  let source = '';
  const parts = pattern.split('/').slice(1);
  parts.forEach((part, i) => {
    const last = i === parts.length - 1;
    if (last && part === '(.*)') {
      names.push('0');
      source += '/(.*)';
    } else if (last && part.startsWith(':') && part.endsWith('*')) {
      names.push(part.slice(1, -1));
      source += '((?:/[^/]+)*)';
    } else if (part.startsWith(':')) {
      names.push(part.slice(1));
      source += '/([^/]+)';
    } else {
      source += `/${escapeRegExp(part)}`;
    }
  });
  return { regex: new RegExp(`^${source}$`), names };
}

export function matchPattern(pattern: string, pathname: string): Params | null {
  const { regex, names } = compile(pattern);
  const match = regex.exec(pathname);
  if (match === null) return null;
  const params: Params = {};
  names.forEach((name, i) => {
    const value = match[i + 1] ?? '';
    // :名字* 匹配到的是“/a/b”，去掉开头的 /
    params[name] = value.startsWith('/') && name !== '0' ? value.slice(1) : value;
  });
  return params;
}
```
```ts file=main.ts
import { matchPattern } from './pattern';

for (const [pattern, path] of [
  ['/learn/:lessonId', '/learn/a01-where-ts-runs'],
  ['/api/:path*', '/api/sync'],
  ['/(.*)', '/projects/42'],
  ['/settings', '/settings/'],
] as const) {
  console.log(pattern.padEnd(18), path.padEnd(26), matchPattern(pattern, path));
}
```
:::

:::variant{kind=wrong name=case-insensitive fails=tests reason="比较时不区分大小写：/Settings 也匹配了 /settings，而 Vercel 对它返回 404"}
```ts file=pattern.ts
/** 匹配得到的参数：参数名 → 匹配到的文字 */
export type Params = Record<string, string>;

/**
 * 判断路径 pathname 是否匹配模式 pattern（vercel.json 中 source 的写法的一个子集）。
 * 匹配时返回参数，不匹配时返回 null。
 */
export function matchPattern(pattern: string, pathname: string): Params | null {
  if (pattern === '/') return pathname === '/' ? {} : null;
  const parts = pattern.split('/').slice(1);
  const segments = pathname.split('/').slice(1);
  const params: Params = {};
  for (const [i, part] of parts.entries()) {
    const last = i === parts.length - 1;
    const rest = segments.slice(i);
    if (last && part === '(.*)') {
      // 剩下的全部（可以为空，可以含有 /）
      params['0'] = rest.join('/');
      return params;
    }
    if (last && part.startsWith(':') && part.endsWith('*')) {
      // 零段或多段，每一段都不能为空
      if (rest.includes('')) return null;
      params[part.slice(1, -1)] = rest.join('/');
      return params;
    }
    const segment = segments[i];
    if (segment === undefined || segment === '') return null;
    if (part.startsWith(':')) params[part.slice(1)] = segment;
    else if (part.toLowerCase() !== segment.toLowerCase()) return null;
  }
  return segments.length === parts.length ? params : null;
}
```
```ts file=main.ts
import { matchPattern } from './pattern';

for (const [pattern, path] of [
  ['/learn/:lessonId', '/learn/a01-where-ts-runs'],
  ['/api/:path*', '/api/sync'],
  ['/(.*)', '/projects/42'],
  ['/settings', '/settings/'],
] as const) {
  console.log(pattern.padEnd(18), path.padEnd(26), matchPattern(pattern, path));
}
```
:::

:::variant{kind=wrong name=trailing-slash fails=tests reason="先去掉了结尾的斜杠：/settings/ 也匹配了 /settings，而 Vercel 对它返回 404"}
```ts file=pattern.ts
/** 匹配得到的参数：参数名 → 匹配到的文字 */
export type Params = Record<string, string>;

/**
 * 判断路径 pathname 是否匹配模式 pattern（vercel.json 中 source 的写法的一个子集）。
 * 匹配时返回参数，不匹配时返回 null。
 */
export function matchPattern(pattern: string, pathname: string): Params | null {
  if (pattern === '/') return pathname === '/' ? {} : null;
  const parts = pattern.split('/').slice(1);
  // 去掉结尾的 /，让 /settings/ 也能匹配
  const segments = (pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname).split('/').slice(1);
  const params: Params = {};
  for (const [i, part] of parts.entries()) {
    const last = i === parts.length - 1;
    const rest = segments.slice(i);
    if (last && part === '(.*)') {
      // 剩下的全部（可以为空，可以含有 /）
      params['0'] = rest.join('/');
      return params;
    }
    if (last && part.startsWith(':') && part.endsWith('*')) {
      // 零段或多段，每一段都不能为空
      if (rest.includes('')) return null;
      params[part.slice(1, -1)] = rest.join('/');
      return params;
    }
    const segment = segments[i];
    if (segment === undefined || segment === '') return null;
    if (part.startsWith(':')) params[part.slice(1)] = segment;
    else if (part !== segment) return null;
  }
  return segments.length === parts.length ? params : null;
}
```
```ts file=main.ts
import { matchPattern } from './pattern';

for (const [pattern, path] of [
  ['/learn/:lessonId', '/learn/a01-where-ts-runs'],
  ['/api/:path*', '/api/sync'],
  ['/(.*)', '/projects/42'],
  ['/settings', '/settings/'],
] as const) {
  console.log(pattern.padEnd(18), path.padEnd(26), matchPattern(pattern, path));
}
```
:::

:::variant{kind=wrong name=star-needs-one fails=tests reason=":名字* 至少要一段：/api 没有匹配 /api/:path*"}
```ts file=pattern.ts
/** 匹配得到的参数：参数名 → 匹配到的文字 */
export type Params = Record<string, string>;

/**
 * 判断路径 pathname 是否匹配模式 pattern（vercel.json 中 source 的写法的一个子集）。
 * 匹配时返回参数，不匹配时返回 null。
 */
export function matchPattern(pattern: string, pathname: string): Params | null {
  if (pattern === '/') return pathname === '/' ? {} : null;
  const parts = pattern.split('/').slice(1);
  const segments = pathname.split('/').slice(1);
  const params: Params = {};
  for (const [i, part] of parts.entries()) {
    const last = i === parts.length - 1;
    const rest = segments.slice(i);
    if (last && part === '(.*)') {
      // 剩下的全部（可以为空，可以含有 /）
      params['0'] = rest.join('/');
      return params;
    }
    if (last && part.startsWith(':') && part.endsWith('*')) {
      // 零段或多段，每一段都不能为空
      if (rest.length === 0 || rest.includes('')) return null;
      params[part.slice(1, -1)] = rest.join('/');
      return params;
    }
    const segment = segments[i];
    if (segment === undefined || segment === '') return null;
    if (part.startsWith(':')) params[part.slice(1)] = segment;
    else if (part !== segment) return null;
  }
  return segments.length === parts.length ? params : null;
}
```
```ts file=main.ts
import { matchPattern } from './pattern';

for (const [pattern, path] of [
  ['/learn/:lessonId', '/learn/a01-where-ts-runs'],
  ['/api/:path*', '/api/sync'],
  ['/(.*)', '/projects/42'],
  ['/settings', '/settings/'],
] as const) {
  console.log(pattern.padEnd(18), path.padEnd(26), matchPattern(pattern, path));
}
```
:::
