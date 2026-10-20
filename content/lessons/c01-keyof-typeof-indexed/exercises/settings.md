---
kind: challenge
title: 从默认值推导设置的类型
---
`settings.ts` 中已经有一份默认设置 `DEFAULTS`。所有的类型都要从它推导出来：以后在 `DEFAULTS` 中加一项，类型、标签表的检查都会跟着变化，不需要另外修改类型。

1. 导出 `type Settings`（`DEFAULTS` 的类型）、`type SettingKey`（所有设置项的名字组成的联合类型）；
2. 导出 `LABELS`：每个设置项的中文名称（`theme` 是“主题”，`fontSize` 是“字号”，`showHints` 是“显示提示”，`language` 是“语言”）。给它加上类型注解 `Record<SettingKey, string>`，这样少写一项或者写错名字都会报错；
3. **`setSetting(settings, key, value)`**：返回一个新的设置对象，`key` 改成 `value`，不修改传入的对象。`value` 的类型必须和这一项的类型一致：`setSetting(s, 'fontSize', '18')` 要在编译期报错；
4. **`isSettingKey(key)`**：类型守卫，判断一个字符串是不是设置项的名字。只认 `DEFAULTS` **自己的**属性：`'toString'` 不是设置项；
5. **`changedKeys(settings)`**：和默认值不同的设置项，按 `DEFAULTS` 中的顺序返回，类型是 `SettingKey[]`。

不能使用类型断言（`as`）。

:::files{role=starter}
```ts file=settings.ts
export const DEFAULTS = {
  theme: 'light',
  fontSize: 16,
  showHints: true,
  language: 'zh-CN',
};

export type Settings = { theme: string; fontSize: number; showHints: boolean };
export type SettingKey = string;

export const LABELS = { theme: '主题', fontSize: '字号' };

export function setSetting(settings: Settings, key: SettingKey, value: unknown): Settings {
  return settings;
}

export function isSettingKey(key: string): boolean {
  return key in DEFAULTS;
}

export function changedKeys(settings: Settings): SettingKey[] {
  return [];
}
```
```ts file=main.ts
import { changedKeys, DEFAULTS, LABELS, setSetting } from './settings';

const mine = setSetting(setSetting(DEFAULTS, 'fontSize', 18), 'theme', 'dark');
for (const key of changedKeys(mine)) {
  console.log(`${LABELS[key]}：${String(DEFAULTS[key])} → ${String(mine[key])}`);
}
```
:::

:::files{role=solution}
```ts file=settings.ts
export const DEFAULTS = {
  theme: 'light',
  fontSize: 16,
  showHints: true,
  language: 'zh-CN',
};

export type Settings = typeof DEFAULTS;
export type SettingKey = keyof Settings;

export const LABELS: Record<SettingKey, string> = {
  theme: '主题',
  fontSize: '字号',
  showHints: '显示提示',
  language: '语言',
};

export function setSetting<K extends SettingKey>(settings: Settings, key: K, value: Settings[K]): Settings {
  return { ...settings, [key]: value };
}

export function isSettingKey(key: string): key is SettingKey {
  return Object.hasOwn(DEFAULTS, key);
}

export function changedKeys(settings: Settings): SettingKey[] {
  return Object.keys(DEFAULTS)
    .filter(isSettingKey)
    .filter((key) => settings[key] !== DEFAULTS[key]);
}
```
```ts file=main.ts
import { changedKeys, DEFAULTS, LABELS, setSetting } from './settings';

const mine = setSetting(setSetting(DEFAULTS, 'fontSize', 18), 'theme', 'dark');
for (const key of changedKeys(mine)) {
  console.log(`${LABELS[key]}：${String(DEFAULTS[key])} → ${String(mine[key])}`);
}
```
:::

:::files{role=tests}
```ts file=settings.test.ts
import { describe, expect, test } from 'vitest';
import { changedKeys, DEFAULTS, isSettingKey, LABELS, setSetting } from './settings';

describe('LABELS', () => {
  test('每个设置项都有中文名称', () => {
    expect(LABELS).toEqual({ theme: '主题', fontSize: '字号', showHints: '显示提示', language: '语言' });
  });
});

describe('setSetting', () => {
  test('返回新的对象，只改这一项', () => {
    const before = { ...DEFAULTS };
    const after = setSetting(before, 'showHints', false);
    expect(after).toEqual({ ...DEFAULTS, showHints: false });
    expect(after).not.toBe(before);
    expect(before).toEqual(DEFAULTS);
  });
});

describe('isSettingKey', () => {
  test('只认 DEFAULTS 自己的属性', () => {
    expect(['theme', 'fontSize', 'showHints', 'language'].every(isSettingKey)).toBe(true);
    expect(isSettingKey('colour')).toBe(false);
    expect(isSettingKey('toString')).toBe(false);
    expect(isSettingKey('constructor')).toBe(false);
    expect(isSettingKey('')).toBe(false);
  });
});

describe('changedKeys', () => {
  test('没有修改时是空数组', () => {
    expect(changedKeys({ ...DEFAULTS })).toEqual([]);
  });

  test('按 DEFAULTS 中的顺序返回修改过的项', () => {
    const changed = { ...DEFAULTS, language: 'en', theme: 'dark', fontSize: 16 };
    expect(changedKeys(changed)).toEqual(['theme', 'language']);
  });

  test('改回默认值之后不再算修改', () => {
    const s = setSetting(setSetting(DEFAULTS, 'showHints', false), 'showHints', true);
    expect(changedKeys(s)).toEqual([]);
  });
});
```
```ts file=settings.test-d.ts
import { expectTypeOf } from 'vitest';
import { changedKeys, DEFAULTS, isSettingKey, setSetting, type SettingKey, type Settings } from './settings';

expectTypeOf<SettingKey>().toEqualTypeOf<'theme' | 'fontSize' | 'showHints' | 'language'>();
expectTypeOf<Settings>().toEqualTypeOf<{ theme: string; fontSize: number; showHints: boolean; language: string }>();
expectTypeOf(changedKeys).returns.toEqualTypeOf<SettingKey[]>();

setSetting(DEFAULTS, 'fontSize', 18);
setSetting(DEFAULTS, 'showHints', false);
// @ts-expect-error 值的类型和这一项不一致
setSetting(DEFAULTS, 'fontSize', '18');
// @ts-expect-error 值的类型和这一项不一致
setSetting(DEFAULTS, 'theme', true);
// @ts-expect-error 不存在的设置项
setSetting(DEFAULTS, 'colour', 'red');

const raw: string = 'theme';
if (isSettingKey(raw)) {
  expectTypeOf(raw).toEqualTypeOf<SettingKey>();
}
```
:::

:::hint{level=1}
`type Settings = typeof DEFAULTS`，`type SettingKey = keyof Settings`。`setSetting` 需要一个类型参数 `K extends SettingKey`，值的类型写成 `Settings[K]`；返回 `{ ...settings, [key]: value }`。
:::

:::hint{level=2}
`isSettingKey` 的返回类型写成 `key is SettingKey`，用 `Object.hasOwn(DEFAULTS, key)` 判断（`in` 会把原型链上的 `toString` 也算进去）。`changedKeys`：`Object.keys(DEFAULTS)` 是 `string[]`，先 `.filter(isSettingKey)`，类型守卫让结果变成 `SettingKey[]`，再筛选出和默认值不同的项。
:::

:::explanation
起始代码中有三处“类型和数据各说各话”：`Settings` 是手写的，漏了 `language`；`SettingKey` 是 `string`，什么名字都能传；`LABELS` 少了两项也没有人发现。从 `DEFAULTS` 推导之后，它们都有了唯一的来源：

- `Record<SettingKey, string>` 要求**每一个**键都有标签，在 `DEFAULTS` 中加一项而忘了加标签，这里就会报错；
- `setSetting` 的 `K` 把键和值“连”在一起：传 `'fontSize'` 时，`value` 的类型就是 `Settings['fontSize']`，也就是 `number`。

`isSettingKey` 是一个类型守卫（b08）：返回 `true` 时，TypeScript 把参数收窄成 `SettingKey`。`Object.keys(DEFAULTS).filter(isSettingKey)` 利用了数组 `filter` 的一个重载：传入类型守卫时，结果数组的元素类型就是守卫的类型，于是得到 `SettingKey[]`，不需要 `as`。为什么 `Object.keys` 本身是 `string[]`，见本课正文。

一个要知道的限制：`K` 被推断成**联合类型**时，检查会变宽。例如 `key` 的类型是 `'theme' | 'fontSize'`，那么 `value` 的类型就是 `string | number`，`setSetting(s, key, 16)` 能通过检查，即使 `key` 实际上是 `'theme'`。TypeScript 无法知道运行时具体是哪一个键，把每一项分开处理（例如 `switch`）才能完全安全。
:::

:::variant{kind=alt name=loop-over-keys}
```ts file=settings.ts
export const DEFAULTS = {
  theme: 'light',
  fontSize: 16,
  showHints: true,
  language: 'zh-CN',
};

export type Settings = typeof DEFAULTS;
export type SettingKey = keyof typeof DEFAULTS;

export const LABELS = {
  theme: '主题',
  fontSize: '字号',
  showHints: '显示提示',
  language: '语言',
} satisfies Record<SettingKey, string>;

export function setSetting<K extends SettingKey>(settings: Settings, key: K, value: Settings[K]): Settings {
  const next = { ...settings };
  next[key] = value;
  return next;
}

export function isSettingKey(key: string): key is SettingKey {
  return Object.prototype.hasOwnProperty.call(DEFAULTS, key);
}

export function changedKeys(settings: Settings): SettingKey[] {
  const result: SettingKey[] = [];
  for (const key in DEFAULTS) {
    if (isSettingKey(key) && settings[key] !== DEFAULTS[key]) result.push(key);
  }
  return result;
}
```
:::

:::variant{kind=wrong name=in-operator fails=tests reason="用 in 判断，原型链上的 toString 也被当成了设置项"}
```ts file=settings.ts
export const DEFAULTS = {
  theme: 'light',
  fontSize: 16,
  showHints: true,
  language: 'zh-CN',
};

export type Settings = typeof DEFAULTS;
export type SettingKey = keyof Settings;

export const LABELS: Record<SettingKey, string> = {
  theme: '主题',
  fontSize: '字号',
  showHints: '显示提示',
  language: '语言',
};

export function setSetting<K extends SettingKey>(settings: Settings, key: K, value: Settings[K]): Settings {
  return { ...settings, [key]: value };
}

export function isSettingKey(key: string): key is SettingKey {
  return key in DEFAULTS;
}

export function changedKeys(settings: Settings): SettingKey[] {
  return Object.keys(DEFAULTS)
    .filter(isSettingKey)
    .filter((key) => settings[key] !== DEFAULTS[key]);
}
```
:::

:::variant{kind=wrong name=value-any-setting fails=types reason="值的类型写成所有设置项的值的联合，字号也能设成字符串"}
```ts file=settings.ts
export const DEFAULTS = {
  theme: 'light',
  fontSize: 16,
  showHints: true,
  language: 'zh-CN',
};

export type Settings = typeof DEFAULTS;
export type SettingKey = keyof Settings;

export const LABELS: Record<SettingKey, string> = {
  theme: '主题',
  fontSize: '字号',
  showHints: '显示提示',
  language: '语言',
};

export function setSetting(settings: Settings, key: SettingKey, value: Settings[SettingKey]): Settings {
  return { ...settings, [key]: value };
}

export function isSettingKey(key: string): key is SettingKey {
  return Object.hasOwn(DEFAULTS, key);
}

export function changedKeys(settings: Settings): SettingKey[] {
  return Object.keys(DEFAULTS)
    .filter(isSettingKey)
    .filter((key) => settings[key] !== DEFAULTS[key]);
}
```
:::

:::variant{kind=wrong name=assert-keys fails=rules reason="用 as 把 Object.keys 的结果硬转成 SettingKey[]"}
```ts file=settings.ts
export const DEFAULTS = {
  theme: 'light',
  fontSize: 16,
  showHints: true,
  language: 'zh-CN',
};

export type Settings = typeof DEFAULTS;
export type SettingKey = keyof Settings;

export const LABELS: Record<SettingKey, string> = {
  theme: '主题',
  fontSize: '字号',
  showHints: '显示提示',
  language: '语言',
};

export function setSetting<K extends SettingKey>(settings: Settings, key: K, value: Settings[K]): Settings {
  return { ...settings, [key]: value };
}

export function isSettingKey(key: string): key is SettingKey {
  return Object.hasOwn(DEFAULTS, key);
}

export function changedKeys(settings: Settings): SettingKey[] {
  const keys = Object.keys(DEFAULTS) as SettingKey[];
  return keys.filter((key) => settings[key] !== DEFAULTS[key]);
}
```
:::

:::variant{kind=wrong name=mutate fails=tests reason="直接修改了传入的设置对象"}
```ts file=settings.ts
export const DEFAULTS = {
  theme: 'light',
  fontSize: 16,
  showHints: true,
  language: 'zh-CN',
};

export type Settings = typeof DEFAULTS;
export type SettingKey = keyof Settings;

export const LABELS: Record<SettingKey, string> = {
  theme: '主题',
  fontSize: '字号',
  showHints: '显示提示',
  language: '语言',
};

export function setSetting<K extends SettingKey>(settings: Settings, key: K, value: Settings[K]): Settings {
  settings[key] = value;
  return settings;
}

export function isSettingKey(key: string): key is SettingKey {
  return Object.hasOwn(DEFAULTS, key);
}

export function changedKeys(settings: Settings): SettingKey[] {
  return Object.keys(DEFAULTS)
    .filter(isSettingKey)
    .filter((key) => settings[key] !== DEFAULTS[key]);
}
```
:::
