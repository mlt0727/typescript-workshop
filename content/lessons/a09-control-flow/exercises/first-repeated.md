---
kind: challenge
title: 第一个重复出现的字符
---
实现 `firstRepeated(text)`：从左往右读，返回**第一个“之前已经出现过”的字符**；没有重复时返回 `null`。

- 例如 `'abcb'` 读到第二个 `b` 时发现重复，返回 `'b'`；`'abba'` 也返回 `'b'`（第二个 `b` 比第二个 `a` 先出现）；
- 区分大小写：`'aA'` 没有重复；
- “字符”按 `for...of` 的单位（Unicode 码点）计算：😀 这样单个码点的 emoji 也算一个字符，`'😀a😀'` 返回 `'😀'`。

提示：可以用一个字符串 `seen` 记录读过的字符，用 a04 学过的 `seen.includes(ch)` 判断是否读过。

:::files{role=starter}
```ts file=repeat.ts
export function firstRepeated(text: string): string | null {
  return null;
}

console.log(firstRepeated('abcb'), firstRepeated('abc'));
```
:::

:::files{role=solution}
```ts file=repeat.ts
export function firstRepeated(text: string): string | null {
  let seen = '';
  for (const ch of text) {
    if (seen.includes(ch)) {
      return ch;
    }
    seen += ch;
  }
  return null;
}

console.log(firstRepeated('abcb'), firstRepeated('abc'));
```
:::

:::files{role=tests}
```ts file=repeat.test.ts
import { describe, expect, test } from 'vitest';
import { firstRepeated } from './repeat';

describe('firstRepeated', () => {
  test('找到第一个重复的字符', () => {
    expect(firstRepeated('abcb')).toBe('b');
    expect(firstRepeated('hello')).toBe('l');
    expect(firstRepeated('你好你')).toBe('你');
  });

  test('按“第二次出现”的先后，而不是第一次出现的先后', () => {
    expect(firstRepeated('abba')).toBe('b');
  });

  test('没有重复时返回 null', () => {
    expect(firstRepeated('abc')).toBeNull();
    expect(firstRepeated('')).toBeNull();
    expect(firstRepeated('aA')).toBeNull();
  });

  test('单个码点的 emoji 算一个字符', () => {
    expect(firstRepeated('😀a😀')).toBe('😀');
    expect(firstRepeated('😀😃')).toBeNull();
  });
});
```
:::

:::hint{level=1}
用 `for...of` 逐个读取字符。每读到一个字符，先检查它是否已经读过；读过就立即返回，没读过就把它记下来。
:::

:::hint{level=2}
`let seen = '';`，循环体里 `if (seen.includes(ch)) { return ch; }`，然后 `seen += ch;`。循环结束都没有返回，说明没有重复，返回 `null`。
:::

:::explanation
`for...of` 按码点遍历字符串，😀 不会被拆成两半。循环中先检查、再记录：顺序反过来的话，每个字符都会在记录之后立刻“发现自己”。

找到重复时直接 `return ch`，循环随之结束，不需要 `break`。

用下标循环 `text.charAt(i)` 会得到半个 emoji：`'😀😃'` 的两个 emoji 的前半部分编码相同，会被误判为重复。

后面学到 a18 的 `Set` 后，`seen` 可以换成 `Set`，判断是否读过会更快、也更清楚。
:::

:::variant{kind=alt name=single-exit}
```ts file=repeat.ts
export function firstRepeated(text: string): string | null {
  let seen = '';
  let answer: string | null = null;
  for (const ch of text) {
    if (answer === null && seen.includes(ch)) {
      answer = ch;
    }
    seen += ch;
  }
  return answer;
}
```
:::

:::variant{kind=wrong name=index-loop fails=tests reason="按下标遍历，😀 被拆成两半"}
```ts file=repeat.ts
export function firstRepeated(text: string): string | null {
  let seen = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (seen.includes(ch)) {
      return ch;
    }
    seen += ch;
  }
  return null;
}
```
:::

:::variant{kind=wrong name=for-in fails=types reason="TypeScript 不允许对 string 使用 for...in（TS2407）；即使能运行，得到的也是下标字符串"}
```ts file=repeat.ts
export function firstRepeated(text: string): string | null {
  let seen = '';
  for (const ch in text) {
    if (seen.includes(ch)) {
      return ch;
    }
    seen += ch;
  }
  return null;
}
```
:::

:::variant{kind=wrong name=record-first fails=tests reason="先记录再检查，每个字符都会发现自己"}
```ts file=repeat.ts
export function firstRepeated(text: string): string | null {
  let seen = '';
  for (const ch of text) {
    seen += ch;
    if (seen.includes(ch)) {
      return ch;
    }
  }
  return null;
}
```
:::

:::variant{kind=wrong name=empty-string fails=tests reason="没有重复时返回了空字符串，而不是 null"}
```ts file=repeat.ts
export function firstRepeated(text: string): string | null {
  let seen = '';
  for (const ch of text) {
    if (seen.includes(ch)) {
      return ch;
    }
    seen += ch;
  }
  return '';
}
```
:::
