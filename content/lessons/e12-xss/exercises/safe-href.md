---
kind: task
title: 只放行安全的链接
mode: ts
---
用户可以在个人资料中填写“个人主页”。实现 `safeHref(input, base)`，决定这个地址能不能放进 `<a href>`：

1. 去掉首尾空白之后是空字符串，返回 `null`；
2. 以 `base`（当前页面的地址）为基准解析 `input`，相对地址也可以；解析失败返回 `null`；
3. 解析出的协议是 `http:`、`https:`、`mailto:` 之一时，返回**解析之后**的完整地址（`url.href`）；其他协议一律返回 `null`。

:::files{role=starter}
```ts file=links.ts
export function safeHref(input: string, base: string): string | null {
  if (input.startsWith('javascript:')) return null;
  return input;
}
```
:::

:::files{role=solution}
```ts file=links.ts
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export function safeHref(input: string, base: string): string | null {
  const text = input.trim();
  if (text === '') return null;
  const url = URL.parse(text, base);
  if (url === null || !SAFE_PROTOCOLS.has(url.protocol)) return null;
  return url.href;
}
```
:::

:::files{role=tests}
```ts file=links.test.ts
import { describe, expect, test } from 'vitest';
import { safeHref } from './links';

const base = 'https://app.example/profile/42';

describe('safeHref', () => {
  test('放行 http、https、mailto，返回解析之后的地址', () => {
    expect(safeHref('https://developer.mozilla.org/', base)).toBe('https://developer.mozilla.org/');
    expect(safeHref('  HTTPS://Example.COM/a b  ', base)).toBe('https://example.com/a%20b');
    expect(safeHref('http://blog.example', base)).toBe('http://blog.example/');
    expect(safeHref('mailto:hi@example.com', base)).toBe('mailto:hi@example.com');
  });

  test('相对地址以 base 为基准', () => {
    expect(safeHref('/docs?page=2', base)).toBe('https://app.example/docs?page=2');
    expect(safeHref('../settings', base)).toBe('https://app.example/settings');
    expect(safeHref('help/javascript:intro', base)).toBe('https://app.example/profile/help/javascript:intro');
  });

  test('拒绝 javascript: 的各种变形', () => {
    for (const input of ['javascript:alert(1)', 'JavaScript:alert(1)', '  javascript:alert(1)', 'java\nscript:alert(1)', 'java\tscript:alert(1)', '\u0001javascript:alert(1)']) {
      expect(safeHref(input, base), JSON.stringify(input)).toBeNull();
    }
  });

  test('拒绝其他协议', () => {
    for (const input of [
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'ftp://files.example/a',
      'blob:https://app.example/5f1c',
      'about:blank',
      'tel:10086',
    ]) {
      expect(safeHref(input, base), input).toBeNull();
    }
  });

  test('空白和无法解析的地址', () => {
    expect(safeHref('', base)).toBeNull();
    expect(safeHref('   ', base)).toBeNull();
    expect(safeHref('https://', base)).toBeNull();
    expect(safeHref('http://[::1', base)).toBeNull();
  });
});
```
:::

:::hint{level=1}
不要检查字符串“像不像”某种攻击，而是先让浏览器的 URL 解析器把它变成一个 `URL` 对象，再检查它的 `protocol`。`URL.parse(地址, 基准地址)` 解析失败时返回 `null`。
:::

:::hint{level=2}
把允许的协议放进 `Set`：`new Set(['http:', 'https:', 'mailto:'])`，注意 `protocol` 带着冒号。最后返回 `url.href`，而不是 `input`。
:::

:::explanation
起始代码用的是**黑名单**：只拦截以 `javascript:` 开头的字符串。可浏览器解析地址时会先做规范化：协议不区分大小写，首尾的空白和控制字符会被去掉，地址中间的换行和制表符也会被删掉。所以 `JavaScript:alert(1)`、`java⏎script:alert(1)` 在浏览器眼里都是 `javascript:`，黑名单拦不住；`data:` 这样的协议它根本没有考虑。

**白名单**反过来：只允许少数已知安全的协议，其他的一律拒绝。用 `URL` 解析，检查的就是浏览器真正会使用的协议，各种变形在解析时已经被规范化了。

返回 `url.href` 而不是原始输入，保证“检查的”和“使用的”是同一个值，也顺便得到了规范化的地址（编码过的空格、小写的域名）。相对地址以当前页面为基准解析，所以 `help/javascript:intro` 是一个普通的站内路径，不会被误判。

`URL.parse` 是较新的静态方法（2024 年起各主流浏览器都已支持），解析失败时返回 `null`；需要兼容更旧的浏览器时，可以用 `try { new URL(…) } catch { … }`。
:::

:::variant{kind=alt name=try-catch}
```ts file=links.ts
export function safeHref(input: string, base: string): string | null {
  if (input.trim().length === 0) return null;
  let url: URL;
  try {
    url = new URL(input, base);
  } catch {
    return null;
  }
  switch (url.protocol) {
    case 'http:':
    case 'https:':
    case 'mailto:':
      return url.href;
    default:
      return null;
  }
}
```
:::

:::variant{kind=wrong name=blacklist fails=tests reason="用黑名单拦截 javascript:，大小写、空白、换行的变形和其他协议都能通过"}
```ts file=links.ts
export function safeHref(input: string, base: string): string | null {
  const text = input.trim();
  if (text === '' || text.toLowerCase().startsWith('javascript:')) return null;
  return URL.parse(text, base)?.href ?? null;
}
```
:::

:::variant{kind=wrong name=regex-prefix fails=tests reason="用正则检查原文的开头，相对地址被拒绝，返回的也不是解析之后的地址"}
```ts file=links.ts
export function safeHref(input: string, base: string): string | null {
  const text = input.trim();
  return /^(https?|mailto):/i.test(text) ? text : null;
}
```
:::

:::variant{kind=wrong name=substring-check fails=tests reason="检查原文中是否包含 javascript:，误伤了普通的站内路径"}
```ts file=links.ts
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export function safeHref(input: string, base: string): string | null {
  const text = input.trim();
  if (text === '' || text.toLowerCase().includes('javascript:')) return null;
  const url = URL.parse(text, base);
  return url !== null && SAFE_PROTOCOLS.has(url.protocol) ? url.href : null;
}
```
:::

:::variant{kind=wrong name=return-input fails=tests reason="检查了协议，但返回的是原始输入而不是解析之后的地址"}
```ts file=links.ts
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export function safeHref(input: string, base: string): string | null {
  const text = input.trim();
  if (text === '') return null;
  const url = URL.parse(text, base);
  return url !== null && SAFE_PROTOCOLS.has(url.protocol) ? text : null;
}
```
:::
