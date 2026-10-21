---
kind: challenge
title: GitHub Pages 的 404 跳转
---
在 `redirect.ts` 中实现 GitHub Pages 上单页应用的 404 跳转。`base` 是应用所在的路径，以 `/` 开头和结尾（例如 `'/shop/'`，部署在网站的根上时是 `'/'`）。

1. `redirectTarget(current, base)`：在 `404.html` 中运行，`current` 是访问者打开的地址。
   - `current.pathname` 不以 `base` 开头：返回 `null`（不是这个应用的地址）；
   - 否则返回 `base` 加上查询参数 `p`：值是 `pathname` 去掉开头的 `base` 之后，再接上 `search` 和 `hash`。用 `URLSearchParams` 生成查询字符串，`&`、`?`、`#` 都要正确地编码；
2. `restoredPath(current, base)`：在 `index.html` 中运行。
   - 地址中没有参数 `p`：返回 `null`（这是正常的访问）；
   - 否则把 `base` 和 `p` 的值连起来，用 `new URL(…, current.origin)` 解析。结果和 `current` 不是同一个网站（`origin` 不同），或者 `pathname` 不以 `base` 开头：返回 `null`；
   - 否则返回解析结果的 `pathname + search + hash`，交给 `history.replaceState`。

来回一趟（`redirectTarget` 的结果交给 `restoredPath`），应该得到和原来完全相同的地址。

:::files{role=starter}
```ts file=redirect.ts
/** 查询参数的名字：404.html 把原来的地址放在这里交给 index.html */
export const PARAM = 'p';

/**
 * 在 404.html 中运行：GitHub Pages 找不到 current 这个地址的文件。
 * 返回要转去的地址：应用的首页 base，加上 ?p=原来的地址（相对于 base 的部分，包括查询和片段）。
 * current 不在 base 之下时返回 null（那不是这个应用的地址，显示普通的 404）。
 */
export function redirectTarget(current: URL, base: string): string | null {
  // TODO
  return null;
}

/**
 * 在 index.html 中运行：如果地址是 404.html 转过来的，返回要恢复的地址（路径 + 查询 + 片段），
 * 由调用方交给 history.replaceState；不是转过来的，或者恢复出来的地址不安全，返回 null。
 */
export function restoredPath(current: URL, base: string): string | null {
  // TODO
  return null;
}
```
```ts file=main.ts
import { redirectTarget, restoredPath } from './redirect';

const origin = 'https://user.github.io';
const base = '/shop/';

// 404.html 中：访问者打开的是一个深层的地址
const target = redirectTarget(new URL('/shop/projects/p1?status=active#tasks', origin), base);
console.log('转到', target);

// index.html 中：恢复原来的地址
if (target !== null) console.log('恢复为', restoredPath(new URL(target, origin), base));
console.log('别人构造的链接', restoredPath(new URL('/shop/?p=..%2F..%2Fevil', origin), base));
```
:::

:::files{role=solution}
```ts file=redirect.ts
/** 查询参数的名字：404.html 把原来的地址放在这里交给 index.html */
export const PARAM = 'p';

/**
 * 在 404.html 中运行：GitHub Pages 找不到 current 这个地址的文件。
 * 返回要转去的地址：应用的首页 base，加上 ?p=原来的地址（相对于 base 的部分，包括查询和片段）。
 * current 不在 base 之下时返回 null（那不是这个应用的地址，显示普通的 404）。
 */
export function redirectTarget(current: URL, base: string): string | null {
  if (!current.pathname.startsWith(base)) return null;
  const rest = current.pathname.slice(base.length) + current.search + current.hash;
  return `${base}?${new URLSearchParams({ [PARAM]: rest })}`;
}

/**
 * 在 index.html 中运行：如果地址是 404.html 转过来的，返回要恢复的地址（路径 + 查询 + 片段），
 * 由调用方交给 history.replaceState；不是转过来的，或者恢复出来的地址不安全，返回 null。
 */
export function restoredPath(current: URL, base: string): string | null {
  const rest = current.searchParams.get(PARAM);
  if (rest === null) return null;
  // 交给 URL 解析：它会处理 ..、反斜杠、//主机名 这些写法，解析之后再检查
  const target = new URL(base + rest, current.origin);
  if (target.origin !== current.origin || !target.pathname.startsWith(base)) return null;
  return target.pathname + target.search + target.hash;
}
```
```ts file=main.ts
import { redirectTarget, restoredPath } from './redirect';

const origin = 'https://user.github.io';
const base = '/shop/';

// 404.html 中：访问者打开的是一个深层的地址
const target = redirectTarget(new URL('/shop/projects/p1?status=active#tasks', origin), base);
console.log('转到', target);

// index.html 中：恢复原来的地址
if (target !== null) console.log('恢复为', restoredPath(new URL(target, origin), base));
console.log('别人构造的链接', restoredPath(new URL('/shop/?p=..%2F..%2Fevil', origin), base));
```
:::

:::files{role=tests}
```ts file=redirect.test.ts
import { describe, expect, test } from 'vitest';
import { redirectTarget, restoredPath } from './redirect';

const ORIGIN = 'https://user.github.io';
const at = (path: string) => new URL(path, ORIGIN);

/** 完整地走一遍：404.html 转向，index.html 恢复 */
function roundTrip(path: string, base: string): string | null {
  const target = redirectTarget(at(path), base);
  return target === null ? null : restoredPath(at(target), base);
}

describe('redirectTarget：404.html 中', () => {
  test('转到应用的首页，原来的地址放在查询参数 p 中', () => {
    const target = redirectTarget(at('/shop/projects/p1'), '/shop/');
    expect(target?.startsWith('/shop/?')).toBe(true);
    expect(new URL(target ?? '', ORIGIN).searchParams.get('p')).toBe('projects/p1');
  });

  test('查询参数和片段也一起带上，并且正确地编码', () => {
    const target = redirectTarget(at('/shop/projects?status=active&q=a+b#list'), '/shop/');
    expect(new URL(target ?? '', ORIGIN).searchParams.get('p')).toBe('projects?status=active&q=a+b#list');
    expect(new URL(target ?? '', ORIGIN).searchParams.size, '原来的 & 不能把参数拆开').toBe(1);
  });

  test('不在应用之下的地址：null（显示普通的 404）', () => {
    expect(redirectTarget(at('/other/page'), '/shop/')).toBeNull();
    expect(redirectTarget(at('/shopping'), '/shop/')).toBeNull();
  });
});

describe('restoredPath：index.html 中', () => {
  test('不是转过来的：null', () => {
    expect(restoredPath(at('/shop/'), '/shop/')).toBeNull();
    expect(restoredPath(at('/shop/?status=done'), '/shop/')).toBeNull();
  });

  test('恢复路径、查询和片段', () => {
    expect(restoredPath(at('/shop/?p=projects%2Fp1%3Fx%3D1%23top'), '/shop/')).toBe('/shop/projects/p1?x=1#top');
    expect(restoredPath(at('/?p=projects'), '/')).toBe('/projects');
    expect(restoredPath(at('/shop/?p='), '/shop/')).toBe('/shop/');
  });

  test('来回一趟，地址完全不变', () => {
    for (const [path, base] of [
      ['/shop/projects/p1', '/shop/'],
      ['/shop/projects?status=active&q=a+b&sort=name#list', '/shop/'],
      ['/shop/projects/%E5%AE%98%E7%BD%91', '/shop/'],
      ['/projects/p1/edit?from=%2Fprojects%3Fq%3D1', '/'],
      ['/a%26b/c', '/'],
    ] as const) {
      expect(roundTrip(path, base), path).toBe(path);
    }
  });
});

describe('restoredPath：不安全的地址', () => {
  test('其他网站的地址：null', () => {
    expect(restoredPath(at('/?p=%2Fevil.example%2Fsteal'), '/'), '//evil.example 是另一个网站').toBeNull();
    expect(restoredPath(at('/?p=%5Cevil.example'), '/'), '/\\evil.example 也会被当作 //evil.example').toBeNull();
  });

  test('离开应用所在的路径：null', () => {
    expect(restoredPath(at('/shop/?p=..%2Fadmin'), '/shop/')).toBeNull();
    expect(restoredPath(at('/shop/?p=%2e%2e%2Fadmin'), '/shop/'), '%2e%2e 也是 ..').toBeNull();
  });

  test('看起来像网址、其实只是应用中的一个路径：可以', () => {
    expect(restoredPath(at('/shop/?p=https%3A%2F%2Fevil.example'), '/shop/')).toBe('/shop/https://evil.example');
  });
});
```
:::

:::hint{level=1}
`redirectTarget`：`` `${base}?${new URLSearchParams({ p: rest })}` ``，`URLSearchParams` 转换成字符串时会编码。`restoredPath`：`current.searchParams.get('p')` 是 `null` 时不是转过来的。
:::

:::hint{level=2}
`const target = new URL(base + rest, current.origin)`，然后检查 `target.origin === current.origin` 和 `target.pathname.startsWith(base)`，都满足时返回 `target.pathname + target.search + target.hash`。不要在解析之前检查字符串：`\`、`%2e%2e` 这样的写法要解析之后才知道它们的意思。
:::

:::explanation
这两个函数分别运行在两个页面中：`404.html` 只做一件事，把访问者要去的地址带到首页；首页在创建路由之前恢复地址。真实的 `404.html` 中大约是这样：

```html
<script>
  const target = redirectTarget(new URL(location.href), '/shop/');
  if (target !== null) location.replace(target);
</script>
```

`location.replace` 不会在历史记录中留下 404 的那一页，“后退”时不会又回到它。首页中则是 `const path = restoredPath(new URL(location.href), '/shop/'); if (path !== null) history.replaceState(null, '', path);`，然后再创建路由。

编码要交给 `URLSearchParams`：手工拼接 `?p=` 加原来的地址，原来地址中的 `&` 会把参数拆开，`#` 之后的部分根本不会出现在查询参数中。

检查要在解析之后：`restoredPath` 收到的 `p` 可以是任何人构造的。`//evil.example`、`/\evil.example` 解析出来是另一个网站，`../admin`、`%2e%2e/admin` 解析出来离开了应用的路径；用字符串规则检查，总会漏掉某一种写法（错误解 `string-check` 只检查了开头的 `/`）。让 `URL` 按浏览器的规则解析，再检查 `origin` 和 `pathname`，只有两条规则，而且它们检查的正是我们关心的东西。

替代解用 `encodeURIComponent` 编码，解析时用 `try`/`catch` 防止 `URL` 抛出异常。
:::

:::variant{kind=alt name=encode-uri-component}
```ts file=redirect.ts
/** 查询参数的名字：404.html 把原来的地址放在这里交给 index.html */
export const PARAM = 'p';

export function redirectTarget(current: URL, base: string): string | null {
  const { pathname, search, hash } = current;
  if (!pathname.startsWith(base)) return null;
  // encodeURIComponent 编码 / ? # & 这些在查询参数中有特殊意义的字符
  return `${base}?${PARAM}=${encodeURIComponent(pathname.slice(base.length) + search + hash)}`;
}

export function restoredPath(current: URL, base: string): string | null {
  if (!current.searchParams.has(PARAM)) return null;
  const rest = current.searchParams.get(PARAM) ?? '';
  let target: URL;
  try {
    // 和 404.html 中相反：把 base 和原来的地址连起来，再交给 URL 解析
    target = new URL(`${base}${rest}`, current.origin);
  } catch {
    return null;
  }
  // 解析之后才能判断：同一个网站，并且仍然在应用所在的路径之下
  const sameSite = target.origin === current.origin;
  const insideApp = target.pathname === base || target.pathname.startsWith(base);
  return sameSite && insideApp ? `${target.pathname}${target.search}${target.hash}` : null;
}
```
```ts file=main.ts
import { redirectTarget, restoredPath } from './redirect';

const origin = 'https://user.github.io';
const base = '/shop/';

// 404.html 中：访问者打开的是一个深层的地址
const target = redirectTarget(new URL('/shop/projects/p1?status=active#tasks', origin), base);
console.log('转到', target);

// index.html 中：恢复原来的地址
if (target !== null) console.log('恢复为', restoredPath(new URL(target, origin), base));
console.log('别人构造的链接', restoredPath(new URL('/shop/?p=..%2F..%2Fevil', origin), base));
```
:::

:::variant{kind=wrong name=no-check fails=tests reason="直接使用 p：别人构造的链接可以把访问者带到另一个网站（开放重定向）"}
```ts file=redirect.ts
/** 查询参数的名字：404.html 把原来的地址放在这里交给 index.html */
export const PARAM = 'p';

/**
 * 在 404.html 中运行：GitHub Pages 找不到 current 这个地址的文件。
 * 返回要转去的地址：应用的首页 base，加上 ?p=原来的地址（相对于 base 的部分，包括查询和片段）。
 * current 不在 base 之下时返回 null（那不是这个应用的地址，显示普通的 404）。
 */
export function redirectTarget(current: URL, base: string): string | null {
  if (!current.pathname.startsWith(base)) return null;
  const rest = current.pathname.slice(base.length) + current.search + current.hash;
  return `${base}?${new URLSearchParams({ [PARAM]: rest })}`;
}

/**
 * 在 index.html 中运行：如果地址是 404.html 转过来的，返回要恢复的地址（路径 + 查询 + 片段），
 * 由调用方交给 history.replaceState；不是转过来的，或者恢复出来的地址不安全，返回 null。
 */
export function restoredPath(current: URL, base: string): string | null {
  const rest = current.searchParams.get(PARAM);
  if (rest === null) return null;
  // 交给 URL 解析：它会处理 ..、反斜杠、//主机名 这些写法，解析之后再检查
  return base + rest;
}
```
```ts file=main.ts
import { redirectTarget, restoredPath } from './redirect';

const origin = 'https://user.github.io';
const base = '/shop/';

// 404.html 中：访问者打开的是一个深层的地址
const target = redirectTarget(new URL('/shop/projects/p1?status=active#tasks', origin), base);
console.log('转到', target);

// index.html 中：恢复原来的地址
if (target !== null) console.log('恢复为', restoredPath(new URL(target, origin), base));
console.log('别人构造的链接', restoredPath(new URL('/shop/?p=..%2F..%2Fevil', origin), base));
```
:::

:::variant{kind=wrong name=string-check fails=tests reason="只用字符串检查开头的 /：反斜杠和 .. 的写法都漏掉了"}
```ts file=redirect.ts
/** 查询参数的名字：404.html 把原来的地址放在这里交给 index.html */
export const PARAM = 'p';

/**
 * 在 404.html 中运行：GitHub Pages 找不到 current 这个地址的文件。
 * 返回要转去的地址：应用的首页 base，加上 ?p=原来的地址（相对于 base 的部分，包括查询和片段）。
 * current 不在 base 之下时返回 null（那不是这个应用的地址，显示普通的 404）。
 */
export function redirectTarget(current: URL, base: string): string | null {
  if (!current.pathname.startsWith(base)) return null;
  const rest = current.pathname.slice(base.length) + current.search + current.hash;
  return `${base}?${new URLSearchParams({ [PARAM]: rest })}`;
}

/**
 * 在 index.html 中运行：如果地址是 404.html 转过来的，返回要恢复的地址（路径 + 查询 + 片段），
 * 由调用方交给 history.replaceState；不是转过来的，或者恢复出来的地址不安全，返回 null。
 */
export function restoredPath(current: URL, base: string): string | null {
  const rest = current.searchParams.get(PARAM);
  if (rest === null) return null;
  // 交给 URL 解析：它会处理 ..、反斜杠、//主机名 这些写法，解析之后再检查
  // 只看字符串：不以 / 开头就不会变成 //别的网站
  if (rest.startsWith('/')) return null;
  return base + rest;
}
```
```ts file=main.ts
import { redirectTarget, restoredPath } from './redirect';

const origin = 'https://user.github.io';
const base = '/shop/';

// 404.html 中：访问者打开的是一个深层的地址
const target = redirectTarget(new URL('/shop/projects/p1?status=active#tasks', origin), base);
console.log('转到', target);

// index.html 中：恢复原来的地址
if (target !== null) console.log('恢复为', restoredPath(new URL(target, origin), base));
console.log('别人构造的链接', restoredPath(new URL('/shop/?p=..%2F..%2Fevil', origin), base));
```
:::

:::variant{kind=wrong name=no-hash fails=tests reason="没有带上 hash：跳转之后，地址中 # 之后的部分丢了"}
```ts file=redirect.ts
/** 查询参数的名字：404.html 把原来的地址放在这里交给 index.html */
export const PARAM = 'p';

/**
 * 在 404.html 中运行：GitHub Pages 找不到 current 这个地址的文件。
 * 返回要转去的地址：应用的首页 base，加上 ?p=原来的地址（相对于 base 的部分，包括查询和片段）。
 * current 不在 base 之下时返回 null（那不是这个应用的地址，显示普通的 404）。
 */
export function redirectTarget(current: URL, base: string): string | null {
  if (!current.pathname.startsWith(base)) return null;
  const rest = current.pathname.slice(base.length) + current.search;
  return `${base}?${new URLSearchParams({ [PARAM]: rest })}`;
}

/**
 * 在 index.html 中运行：如果地址是 404.html 转过来的，返回要恢复的地址（路径 + 查询 + 片段），
 * 由调用方交给 history.replaceState；不是转过来的，或者恢复出来的地址不安全，返回 null。
 */
export function restoredPath(current: URL, base: string): string | null {
  const rest = current.searchParams.get(PARAM);
  if (rest === null) return null;
  // 交给 URL 解析：它会处理 ..、反斜杠、//主机名 这些写法，解析之后再检查
  const target = new URL(base + rest, current.origin);
  if (target.origin !== current.origin || !target.pathname.startsWith(base)) return null;
  return target.pathname + target.search + target.hash;
}
```
```ts file=main.ts
import { redirectTarget, restoredPath } from './redirect';

const origin = 'https://user.github.io';
const base = '/shop/';

// 404.html 中：访问者打开的是一个深层的地址
const target = redirectTarget(new URL('/shop/projects/p1?status=active#tasks', origin), base);
console.log('转到', target);

// index.html 中：恢复原来的地址
if (target !== null) console.log('恢复为', restoredPath(new URL(target, origin), base));
console.log('别人构造的链接', restoredPath(new URL('/shop/?p=..%2F..%2Fevil', origin), base));
```
:::

:::variant{kind=wrong name=no-encode fails=tests reason="手工拼接查询字符串：原来地址中的 & 把参数拆开了"}
```ts file=redirect.ts
/** 查询参数的名字：404.html 把原来的地址放在这里交给 index.html */
export const PARAM = 'p';

/**
 * 在 404.html 中运行：GitHub Pages 找不到 current 这个地址的文件。
 * 返回要转去的地址：应用的首页 base，加上 ?p=原来的地址（相对于 base 的部分，包括查询和片段）。
 * current 不在 base 之下时返回 null（那不是这个应用的地址，显示普通的 404）。
 */
export function redirectTarget(current: URL, base: string): string | null {
  if (!current.pathname.startsWith(base)) return null;
  const rest = current.pathname.slice(base.length) + current.search + current.hash;
  return `${base}?${PARAM}=${rest}`;
}

/**
 * 在 index.html 中运行：如果地址是 404.html 转过来的，返回要恢复的地址（路径 + 查询 + 片段），
 * 由调用方交给 history.replaceState；不是转过来的，或者恢复出来的地址不安全，返回 null。
 */
export function restoredPath(current: URL, base: string): string | null {
  const rest = current.searchParams.get(PARAM);
  if (rest === null) return null;
  // 交给 URL 解析：它会处理 ..、反斜杠、//主机名 这些写法，解析之后再检查
  const target = new URL(base + rest, current.origin);
  if (target.origin !== current.origin || !target.pathname.startsWith(base)) return null;
  return target.pathname + target.search + target.hash;
}
```
```ts file=main.ts
import { redirectTarget, restoredPath } from './redirect';

const origin = 'https://user.github.io';
const base = '/shop/';

// 404.html 中：访问者打开的是一个深层的地址
const target = redirectTarget(new URL('/shop/projects/p1?status=active#tasks', origin), base);
console.log('转到', target);

// index.html 中：恢复原来的地址
if (target !== null) console.log('恢复为', restoredPath(new URL(target, origin), base));
console.log('别人构造的链接', restoredPath(new URL('/shop/?p=..%2F..%2Fevil', origin), base));
```
:::

