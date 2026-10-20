---
kind: challenge
title: 读取年龄输入框
---
表单里的年龄输入框给你的是一段文字。实现两个函数：

**`parseAge(text)`**：把文字转换成年龄，类型是 `number | null`。

- 先去掉首尾空格；
- 去掉空格后是空字符串时，返回 `null`（用户没填）；
- 转换结果不是数字、不是整数、小于 0 或大于 150 时，返回 `null`；
- 其他情况返回转换后的数字。例如 `parseAge(' 42 ')` 返回 `42`。

**`ageLabel(text)`**：调用 `parseAge`，返回给用户看的文字：有效时返回 `'42 岁'` 这样的文字，无效或没填时返回 `'年龄无效'`。

提示：`Number(text)` 转换失败得到 `NaN`；`Number('')` 是 `0`；判断整数用 `Number.isInteger`（它对 `NaN` 返回 `false`）。

:::files{role=starter}
```ts file=age.ts
export function parseAge(text: string): number | null {
  return Number(text);
}

export function ageLabel(text: string): string {
  return `${parseAge(text)} 岁`;
}

console.log(ageLabel(' 42 '), ageLabel(''), ageLabel('abc'));
```
:::

:::files{role=solution}
```ts file=age.ts
export function parseAge(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') {
    return null;
  }
  const age = Number(trimmed);
  if (!Number.isInteger(age) || age < 0 || age > 150) {
    return null;
  }
  return age;
}

export function ageLabel(text: string): string {
  const age = parseAge(text);
  if (age === null) {
    return '年龄无效';
  }
  return `${age} 岁`;
}

console.log(ageLabel(' 42 '), ageLabel(''), ageLabel('abc'));
```
:::

:::files{role=tests}
```ts file=age.test.ts
import { describe, expect, test } from 'vitest';
import { ageLabel, parseAge } from './age';

describe('parseAge', () => {
  test('有效年龄', () => {
    expect(parseAge('42')).toBe(42);
    expect(parseAge(' 7 ')).toBe(7);
    expect(parseAge('0')).toBe(0);
    expect(parseAge('150')).toBe(150);
  });

  test('没填时返回 null', () => {
    expect(parseAge('')).toBeNull();
    expect(parseAge('   ')).toBeNull();
  });

  test.each([['abc'], ['12岁'], ['3.5'], ['-1'], ['151']])('%s 返回 null', (text) => {
    expect(parseAge(text)).toBeNull();
  });
});

describe('ageLabel', () => {
  test('有效时显示岁数', () => {
    expect(ageLabel(' 42 ')).toBe('42 岁');
    expect(ageLabel('0')).toBe('0 岁');
  });

  test('无效或没填时显示提示', () => {
    expect(ageLabel('')).toBe('年龄无效');
    expect(ageLabel('abc')).toBe('年龄无效');
    expect(ageLabel('200')).toBe('年龄无效');
  });
});
```
```ts file=age.test-d.ts
import { expectTypeOf } from 'vitest';
import { ageLabel, parseAge } from './age';

expectTypeOf(parseAge).toEqualTypeOf<(text: string) => number | null>();
expectTypeOf(ageLabel).toEqualTypeOf<(text: string) => string>();
```
:::

:::hint{level=1}
`parseAge` 按规格一条条检查，任何一条不满足就 `return null`。`ageLabel` 拿到 `parseAge` 的结果后，先判断是不是 `null`，再拼文字。
:::

:::hint{level=2}
`parseAge`：`const trimmed = text.trim();`，空字符串时返回 `null`；`const age = Number(trimmed);`，然后 `if (!Number.isInteger(age) || age < 0 || age > 150) return null;`。`ageLabel`：`if (age === null) return '年龄无效';`。（`!`、`||` 的含义与 Java/C++ 相同。）
:::

:::explanation
`parseAge` 的返回类型 `number | null` 把“可能失败”写进了类型里。`ageLabel` 如果忘了检查，TypeScript 不一定会报错（模板字符串可以放任何值），但测试会发现它显示了 `'null 岁'`。在更常见的用法里，例如 `age + 1` 或 `age.toFixed()`，TypeScript 会直接报“可能是 null”。

为什么不用 `NaN` 表示失败？`NaN` 的类型也是 `number`，调用方拿到后 TypeScript 不会提醒任何检查。`null` 不同，它让失败的情况在类型上可见。

`Number('')` 是 `0`，所以必须先单独处理空字符串，否则“没填”会被当成 0 岁。`Number.isInteger` 同时排除了 `NaN`、`Infinity` 和小数。
:::

:::variant{kind=alt name=nested-checks}
```ts file=age.ts
export function parseAge(text: string): number | null {
  const trimmed = text.trim();
  const age = Number(trimmed);
  if (trimmed !== '' && Number.isInteger(age) && age >= 0 && age <= 150) {
    return age;
  }
  return null;
}

export function ageLabel(text: string): string {
  const age = parseAge(text);
  return age === null ? '年龄无效' : `${age} 岁`;
}
```
:::

:::variant{kind=wrong name=nan-for-failure fails=tests reason="用 NaN 表示失败，而不是 null"}
```ts file=age.ts
export function parseAge(text: string): number | null {
  const age = Number(text.trim());
  if (text.trim() === '' || !Number.isInteger(age) || age < 0 || age > 150) {
    return NaN;
  }
  return age;
}

export function ageLabel(text: string): string {
  const age = parseAge(text);
  if (age === null || Number.isNaN(age)) {
    return '年龄无效';
  }
  return `${age} 岁`;
}
```
:::

:::variant{kind=wrong name=empty-is-zero fails=tests reason="没有单独处理空字符串，Number('') 是 0"}
```ts file=age.ts
export function parseAge(text: string): number | null {
  const age = Number(text.trim());
  if (!Number.isInteger(age) || age < 0 || age > 150) {
    return null;
  }
  return age;
}

export function ageLabel(text: string): string {
  const age = parseAge(text);
  if (age === null) {
    return '年龄无效';
  }
  return `${age} 岁`;
}
```
:::

:::variant{kind=wrong name=label-no-check fails=tests reason="ageLabel 没有检查 null，显示了 'null 岁'"}
```ts file=age.ts
export function parseAge(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') {
    return null;
  }
  const age = Number(trimmed);
  if (!Number.isInteger(age) || age < 0 || age > 150) {
    return null;
  }
  return age;
}

export function ageLabel(text: string): string {
  return `${parseAge(text)} 岁`;
}
```
:::

:::variant{kind=wrong name=return-undefined fails=types reason="返回了 undefined，与声明的 number | null 不符"}
```ts file=age.ts
export function parseAge(text: string): number | null {
  const trimmed = text.trim();
  const age = Number(trimmed);
  if (trimmed === '' || !Number.isInteger(age) || age < 0 || age > 150) {
    return undefined;
  }
  return age;
}

export function ageLabel(text: string): string {
  const age = parseAge(text);
  if (age === null) {
    return '年龄无效';
  }
  return `${age} 岁`;
}
```
:::
