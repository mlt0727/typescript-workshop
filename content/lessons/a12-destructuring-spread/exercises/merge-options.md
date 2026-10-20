---
kind: challenge
title: 合并编辑器设置
---
编辑器有一份默认设置，用户可以只修改其中几项。实现 `mergeOptions(defaults, overrides)`，返回合并后的**新**设置对象：

- `overrides` 中提供了的值覆盖默认值，**包括 `0`、`false` 和空字符串**；
- `overrides` 中没有提供、或者值为 `undefined` 的项，保留默认值（用户界面在“恢复默认”时会把某项设成 `undefined`）；
- 不能修改 `defaults` 和 `overrides`。

设置只有三项：`theme`（字符串）、`fontSize`（数字）、`autosave`（布尔值）。

:::files{role=starter}
```ts file=options.ts
export function mergeOptions(
  defaults: { theme: string; fontSize: number; autosave: boolean },
  overrides: { theme?: string; fontSize?: number; autosave?: boolean },
): { theme: string; fontSize: number; autosave: boolean } {
  return { ...defaults, ...overrides };
}

const defaults = { theme: 'light', fontSize: 14, autosave: true };
console.log(mergeOptions(defaults, { theme: undefined, autosave: false }));
```
:::

:::files{role=solution}
```ts file=options.ts
export function mergeOptions(
  defaults: { theme: string; fontSize: number; autosave: boolean },
  overrides: { theme?: string; fontSize?: number; autosave?: boolean },
): { theme: string; fontSize: number; autosave: boolean } {
  const {
    theme = defaults.theme,
    fontSize = defaults.fontSize,
    autosave = defaults.autosave,
  } = overrides;
  return { theme: theme, fontSize: fontSize, autosave: autosave };
}

const defaults = { theme: 'light', fontSize: 14, autosave: true };
console.log(mergeOptions(defaults, { theme: undefined, autosave: false }));
```
:::

:::files{role=tests}
```ts file=options.test.ts
import { describe, expect, test } from 'vitest';
import { mergeOptions } from './options';

const defaults = { theme: 'light', fontSize: 14, autosave: true };

describe('mergeOptions', () => {
  test('没有覆盖时等于默认值', () => {
    expect(mergeOptions(defaults, {})).toEqual({ theme: 'light', fontSize: 14, autosave: true });
  });

  test('提供的值覆盖默认值', () => {
    expect(mergeOptions(defaults, { theme: 'dark', fontSize: 18 })).toEqual({
      theme: 'dark',
      fontSize: 18,
      autosave: true,
    });
  });

  test('0、false 和空字符串也是有效的覆盖', () => {
    expect(mergeOptions(defaults, { theme: '', fontSize: 0, autosave: false })).toEqual({
      theme: '',
      fontSize: 0,
      autosave: false,
    });
  });

  test('值为 undefined 时保留默认值', () => {
    expect(mergeOptions(defaults, { theme: undefined, fontSize: undefined, autosave: false })).toEqual({
      theme: 'light',
      fontSize: 14,
      autosave: false,
    });
  });

  test('返回新对象，不修改参数', () => {
    const base = { theme: 'light', fontSize: 14, autosave: true };
    const changes = { fontSize: 20 };
    const result = mergeOptions(base, changes);
    expect(result).not.toBe(base);
    expect(base).toEqual({ theme: 'light', fontSize: 14, autosave: true });
    expect(changes).toEqual({ fontSize: 20 });
  });
});
```
:::

:::hint{level=1}
运行起始代码：`{ ...defaults, ...overrides }` 把 `theme: undefined` 也展开了进去，覆盖了默认值。需要一种“只在 `undefined` 时才用默认值”的写法——这一课学过一种，a08 学过另一种。
:::

:::hint{level=2}
解构默认值正好只在 `undefined` 时生效：`const { theme = defaults.theme, fontSize = defaults.fontSize, autosave = defaults.autosave } = overrides;`，再用这三个变量组成新对象。也可以对每一项写 `overrides.theme ?? defaults.theme`。
:::

:::explanation
`{ ...defaults, ...overrides }` 看起来正确，TypeScript 也不报错（它推断出的类型里 `theme` 是 `string`），但对象展开会复制 `overrides` 自己的**所有**属性，包括值为 `undefined` 的属性。于是“恢复默认”反而把设置变成了 `undefined`。

解构默认值只在值为 `undefined` 时生效：没有提供的项和值为 `undefined` 的项都会得到默认值，而 `0`、`false`、`''` 会被保留。

不能用 `||`：`fontSize || defaults.fontSize` 会把用户设置的 `0`、`false`、`''` 都换回默认值。

这个问题在实际项目里很常见。TypeScript 的 `exactOptionalPropertyTypes` 选项可以在类型层面禁止给可选属性显式赋 `undefined`，但这里的规格明确允许 `undefined`，所以要在代码里处理。
:::

:::variant{kind=alt name=nullish-each}
```ts file=options.ts
export function mergeOptions(
  defaults: { theme: string; fontSize: number; autosave: boolean },
  overrides: { theme?: string; fontSize?: number; autosave?: boolean },
): { theme: string; fontSize: number; autosave: boolean } {
  return {
    theme: overrides.theme ?? defaults.theme,
    fontSize: overrides.fontSize ?? defaults.fontSize,
    autosave: overrides.autosave ?? defaults.autosave,
  };
}
```
:::

:::variant{kind=wrong name=reversed-spread fails=tests reason="展开顺序写反了，默认值覆盖了用户的设置"}
```ts file=options.ts
export function mergeOptions(
  defaults: { theme: string; fontSize: number; autosave: boolean },
  overrides: { theme?: string; fontSize?: number; autosave?: boolean },
): { theme: string; fontSize: number; autosave: boolean } {
  return { ...overrides, ...defaults };
}
```
:::

:::variant{kind=wrong name=or-each fails=tests reason="用 || 合并，0、false 和空字符串被换回了默认值"}
```ts file=options.ts
export function mergeOptions(
  defaults: { theme: string; fontSize: number; autosave: boolean },
  overrides: { theme?: string; fontSize?: number; autosave?: boolean },
): { theme: string; fontSize: number; autosave: boolean } {
  return {
    theme: overrides.theme || defaults.theme,
    fontSize: overrides.fontSize || defaults.fontSize,
    autosave: overrides.autosave || defaults.autosave,
  };
}
```
:::

:::variant{kind=wrong name=mutate-defaults fails=tests reason="直接修改了 defaults 并把它返回"}
```ts file=options.ts
export function mergeOptions(
  defaults: { theme: string; fontSize: number; autosave: boolean },
  overrides: { theme?: string; fontSize?: number; autosave?: boolean },
): { theme: string; fontSize: number; autosave: boolean } {
  if (overrides.theme !== undefined) defaults.theme = overrides.theme;
  if (overrides.fontSize !== undefined) defaults.fontSize = overrides.fontSize;
  if (overrides.autosave !== undefined) defaults.autosave = overrides.autosave;
  return defaults;
}
```
:::
