---
kind: task
title: 把 any 换成 unknown
---
`readTheme(json)` 从 JSON 文本中读取主题设置：解析结果是对象并且 `theme` 是 `'light'` 或 `'dark'` 时返回它，其他情况都返回 `'light'`。

起始代码用了 `any`，判题规则不允许。把 `config` 的类型改成 `unknown`，然后补上必要的检查，让类型检查和测试都通过。

:::files{role=starter}
```ts file=theme.ts
export type Theme = 'light' | 'dark';

export function readTheme(json: string): Theme {
  const config: any = JSON.parse(json);
  return config.theme;
}
```
:::

:::files{role=solution}
```ts file=theme.ts
export type Theme = 'light' | 'dark';

export function readTheme(json: string): Theme {
  const config: unknown = JSON.parse(json);
  if (typeof config !== 'object' || config === null) {
    return 'light';
  }
  const theme = 'theme' in config ? config.theme : undefined;
  return theme === 'dark' || theme === 'light' ? theme : 'light';
}
```
:::

:::files{role=tests}
```ts file=theme.test.ts
import { expect, test } from 'vitest';
import { readTheme } from './theme';

test('合法的主题', () => {
  expect(readTheme('{ "theme": "dark" }')).toBe('dark');
  expect(readTheme('{ "theme": "light", "size": 14 }')).toBe('light');
});

test('不合法的主题回到 light', () => {
  expect(readTheme('{ "theme": "blue" }')).toBe('light');
  expect(readTheme('{ "theme": 1 }')).toBe('light');
  expect(readTheme('{}')).toBe('light');
});

test('不是对象', () => {
  expect(readTheme('null')).toBe('light');
  expect(readTheme('"dark"')).toBe('light');
  expect(readTheme('42')).toBe('light');
});
```
:::

:::hint{level=1}
把 `any` 改成 `unknown` 后，`config.theme` 会报错：必须先证明 `config` 是对象。然后再检查 `theme` 的值是不是两个合法值之一。
:::

:::hint{level=2}
`if (typeof config !== 'object' || config === null) return 'light';`。之后用 `'theme' in config` 判断属性是否存在（`in` 检查之后可以读取 `config.theme`，它的类型是 `unknown`）。最后 `theme === 'dark' || theme === 'light'` 把它收窄成 `Theme`。
:::

:::explanation
`any` 让起始代码通过了类型检查，却会把 `'blue'`、`1`、`undefined` 原样返回，违反了返回类型 `Theme` 的承诺。换成 `unknown` 后，TypeScript 强迫你逐步证明：先是对象（`typeof … === 'object'` 并排除 `null`），再是有 `theme` 属性（`in` 运算符，b07 详讲），最后值是两个合法字面量之一（相等检查把 `unknown` 收窄成 `'dark' | 'light'`）。

每一步检查都对应一种真实可能出现的坏数据。`unknown` 的作用就是让你不能跳过它们。
:::

:::variant{kind=alt name=record-cast-free}
```ts file=theme.ts
export type Theme = 'light' | 'dark';

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

export function readTheme(json: string): Theme {
  const config: unknown = JSON.parse(json);
  if (config !== null && typeof config === 'object' && 'theme' in config && isTheme(config.theme)) {
    return config.theme;
  }
  return 'light';
}
```
:::

:::variant{kind=wrong name=keep-any fails=rules reason="仍然使用 any"}
```ts file=theme.ts
export type Theme = 'light' | 'dark';

export function readTheme(json: string): Theme {
  const config: any = JSON.parse(json);
  return config?.theme === 'dark' ? 'dark' : 'light';
}
```
:::

:::variant{kind=wrong name=no-object-check fails=types reason="没有先证明 config 是对象就读取属性"}
```ts file=theme.ts
export type Theme = 'light' | 'dark';

export function readTheme(json: string): Theme {
  const config: unknown = JSON.parse(json);
  const theme = config.theme;
  return theme === 'dark' ? 'dark' : 'light';
}
```
:::

:::variant{kind=wrong name=string-check-only fails=types reason="只检查了是字符串，string 不能当作 Theme 返回"}
```ts file=theme.ts
export type Theme = 'light' | 'dark';

export function readTheme(json: string): Theme {
  const config: unknown = JSON.parse(json);
  if (typeof config !== 'object' || config === null || !('theme' in config)) {
    return 'light';
  }
  const theme = config.theme;
  if (typeof theme === 'string') {
    return theme;
  }
  return 'light';
}
```
:::
