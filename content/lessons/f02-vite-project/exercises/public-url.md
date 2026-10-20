---
kind: task
title: 拼接 public 文件的地址
---
在 `urls.ts` 中实现 `publicUrl(base, path)`：`base` 是 `import.meta.env.BASE_URL` 的值，`path` 是 `public` 文件夹中某个文件的路径（可以带 `?查询` 和 `#片段`），返回在页面中引用它的地址。

1. `base` 可能是 `/`、`/repo/`、漏写了结尾斜杠的 `/repo`、相对路径 `./`、空字符串（与 `./` 相同），也可能是完整的网址，例如 `https://cdn.example.com/app/`；
2. `path` 开头的 `/` 可有可无（都表示 `public` 的根）。结果中 `base` 与 `path` 之间**正好有一个** `/`；
3. `path` 为空时，返回以 `/` 结尾的 `base` 本身（`base` 为空时是 `./`）；
4. `path` 已经是一个完整的地址时原样返回：以 `协议:` 开头（例如 `https:`、`data:`、`mailto:`；协议是一个字母后面跟着字母、数字、`+`、`-`、`.`），或者以 `//` 开头。

:::files{role=starter}
```ts file=urls.ts
export function publicUrl(base: string, path: string): string {
  return base + path;
}
```
```ts file=main.ts
import { publicUrl } from './urls';

for (const base of ['/', '/repo/', '/repo', './', '', 'https://cdn.example.com/app/']) {
  console.log(JSON.stringify(base), publicUrl(base, '/icons.svg#github-icon'));
}
console.log(publicUrl('/repo/', 'https://example.com/logo.png'));
```
:::

:::files{role=solution}
```ts file=urls.ts
/** 以“协议:”开头，或者以 // 开头（协议相对地址） */
const ABSOLUTE = /^(?:[a-z][a-z\d+\-.]*:|\/\/)/i;

export function publicUrl(base: string, path: string): string {
  if (ABSOLUTE.test(path)) return path;
  const root = base === '' ? './' : base;
  const head = root.endsWith('/') ? root : `${root}/`;
  const tail = path.startsWith('/') ? path.slice(1) : path;
  return head + tail;
}
```
```ts file=main.ts
import { publicUrl } from './urls';

for (const base of ['/', '/repo/', '/repo', './', '', 'https://cdn.example.com/app/']) {
  console.log(JSON.stringify(base), publicUrl(base, '/icons.svg#github-icon'));
}
console.log(publicUrl('/repo/', 'https://example.com/logo.png'));
```
:::

:::files{role=tests}
```ts file=urls.test.ts
import { describe, expect, test } from 'vitest';
import { publicUrl } from './urls';

describe('publicUrl', () => {
  test('根路径', () => {
    expect(publicUrl('/', 'icons.svg')).toBe('/icons.svg');
    expect(publicUrl('/', '/icons.svg#github-icon')).toBe('/icons.svg#github-icon');
  });

  test('子路径：有没有结尾的斜杠都一样', () => {
    expect(publicUrl('/repo/', 'icons.svg')).toBe('/repo/icons.svg');
    expect(publicUrl('/repo/', '/icons.svg')).toBe('/repo/icons.svg');
    expect(publicUrl('/repo', 'icons.svg')).toBe('/repo/icons.svg');
    expect(publicUrl('/repo', '/img/a.png?v=2')).toBe('/repo/img/a.png?v=2');
  });

  test('相对的 base', () => {
    expect(publicUrl('./', '/favicon.svg')).toBe('./favicon.svg');
    expect(publicUrl('', 'favicon.svg')).toBe('./favicon.svg');
  });

  test('完整网址的 base', () => {
    expect(publicUrl('https://cdn.example.com/app/', '/img/a.png?v=2')).toBe('https://cdn.example.com/app/img/a.png?v=2');
    expect(publicUrl('https://cdn.example.com/app', 'img/a.png')).toBe('https://cdn.example.com/app/img/a.png');
  });

  test('path 为空时返回 base 本身', () => {
    expect(publicUrl('/repo', '')).toBe('/repo/');
    expect(publicUrl('/', '')).toBe('/');
    expect(publicUrl('', '')).toBe('./');
    expect(publicUrl('/repo/', '/')).toBe('/repo/');
  });

  test('已经是完整地址的 path 原样返回', () => {
    for (const path of ['https://example.com/logo.png', 'HTTP://example.com/a', 'data:image/svg+xml,%3csvg%3e', 'mailto:me@example.com', '//cdn.example.com/x.png', 'web+app:open']) {
      expect(publicUrl('/repo/', path), path).toBe(path);
    }
  });

  test('只是看起来像协议的路径不算完整地址', () => {
    expect(publicUrl('/repo/', 'docs/a:b.txt')).toBe('/repo/docs/a:b.txt');
    expect(publicUrl('/repo/', '1st:file.txt')).toBe('/repo/1st:file.txt');
  });
});
```
:::

:::hint{level=1}
先处理第 4 条：用正则 `/^(?:[a-z][a-z\d+\-.]*:|\/\/)/i` 判断 `path` 是不是完整的地址。然后分别整理两边：`base` 为空时换成 `'./'`，不以 `/` 结尾就补上；`path` 以 `/` 开头就去掉这一个字符。最后直接相连。
:::

:::hint{level=2}
`'docs/a:b.txt'` 中也有冒号，但冒号前面的 `docs/a` 里有 `/`，不符合“协议”的写法；`'1st:file.txt'` 的第一个字符是数字，也不是协议。正则开头的 `^` 和“第一个字符必须是字母”正好排除了这两种情况。
:::

:::explanation
地址拼接的错误往往在开发时看不出来：开发服务器的 `base` 是 `/`，`'/' + 'icons.svg'` 碰巧是对的；部署到子路径之后才出现 `/repoicons.svg` 或 `/repo//icons.svg`。把拼接写成一个函数，并且用测试覆盖 `base` 的每一种写法，问题就不会等到部署之后才发现。

参考解先把两边**规范化**（`base` 一定以 `/` 结尾，`path` 一定不以 `/` 开头），再直接相连，这样不需要分四种情况讨论。

完整地址的判断依据是 URL 标准中“协议”（scheme）的写法：一个字母，后面是字母、数字、`+`、`-`、`.`，然后是冒号。`//cdn.example.com/x.png` 是“协议相对地址”，浏览器会用当前页面的协议访问另一个主机，所以也不能加上 `base`。

为什么不用 `new URL(path, base)`？它要求第二个参数是完整的网址，`new URL('icons.svg', '/repo/')` 会抛出 `TypeError`；而且即使 `base` 是完整网址，`new URL('/icons.svg', 'https://cdn.example.com/app/')` 也会得到 `https://cdn.example.com/icons.svg`，以 `/` 开头的路径会丢掉 `app/`。
:::

:::variant{kind=alt name=strip-slashes}
```ts file=urls.ts
export function publicUrl(base: string, path: string): string {
  if (path.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(path)) return path;
  let prefix = base || './';
  if (!prefix.endsWith('/')) prefix += '/';
  let rest = path;
  if (rest.startsWith('/')) rest = rest.substring(1);
  return `${prefix}${rest}`;
}
```
:::

:::variant{kind=wrong name=concat fails=tests reason="直接相连：/repo 加上 icons.svg 得到 /repoicons.svg，/repo/ 加上 /icons.svg 得到两个斜杠"}
```ts file=urls.ts
export function publicUrl(base: string, path: string): string {
  if (path.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(path)) return path;
  return (base || './') + path;
}
```
:::

:::variant{kind=wrong name=prefix-absolute-urls fails=tests reason="没有判断完整的地址，给 https://… 也加上了 base"}
```ts file=urls.ts
export function publicUrl(base: string, path: string): string {
  const root = base === '' ? './' : base;
  const head = root.endsWith('/') ? root : `${root}/`;
  const tail = path.startsWith('/') ? path.slice(1) : path;
  return head + tail;
}
```
:::

:::variant{kind=wrong name=any-colon fails=tests reason="只要有冒号就当成完整地址：docs/a:b.txt 没有加上 base"}
```ts file=urls.ts
export function publicUrl(base: string, path: string): string {
  if (path.startsWith('//') || path.includes(':')) return path;
  const root = base === '' ? './' : base;
  const head = root.endsWith('/') ? root : `${root}/`;
  const tail = path.startsWith('/') ? path.slice(1) : path;
  return head + tail;
}
```
:::

:::variant{kind=wrong name=empty-base-root fails=tests reason="把空的 base 当成了根路径 /，而 Vite 中空的 base 表示相对路径"}
```ts file=urls.ts
export function publicUrl(base: string, path: string): string {
  if (path.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(path)) return path;
  const head = base.endsWith('/') ? base : `${base}/`;
  const tail = path.startsWith('/') ? path.slice(1) : path;
  return head + tail;
}
```
:::
