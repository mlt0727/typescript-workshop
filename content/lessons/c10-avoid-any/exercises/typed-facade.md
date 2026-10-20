---
kind: challenge
title: 给没有类型的旧库加一层外壳
---
`legacy.ts`（只读）模拟一个没有类型声明的旧库：它导出的 `legacyStorage` 是 `any`，`read(key)` 返回以前保存的任何东西（可能是旧版本的格式、被手工改坏的数据，或者 `null`）。在 `settings.ts` 中写一层“外壳”，让程序的其他部分只和有类型、经过检查的接口打交道：

1. **`parseSettings(value)`**：`value` 是 `unknown`，逐个字段检查，不合法的字段用默认值代替（其他合法的字段保留）：
   - `theme`：`'light'` 或 `'dark'`；
   - `fontSize`：12 到 24 之间的整数；
   - `recent`：数组，只保留其中的字符串，最多保留前 5 个；不是数组时为 `[]`；
   - `value` 不是普通对象时，所有字段都用默认值。
   返回的总是一个**新的**对象（`recent` 也是新的数组），修改它不能影响 `DEFAULT_SETTINGS`；
2. **`loadSettings()`**：从 `legacyStorage.read('settings')` 读取并解析；**`saveSettings(settings)`**：用 `legacyStorage.write('settings', settings)` 保存；
3. **`addRecent(settings, path)`**：返回新的设置，`path` 放在 `recent` 的最前面，去掉重复的旧记录，最多保留 5 个。

不能写 `any`，也不能使用类型断言。注意：规则检查只能拦下**写出来的** `any`，`legacyStorage.read(…)` 返回的 `any` 需要你自己挡住。

:::files{role=starter}
```ts file=settings.ts
import { legacyStorage } from './legacy';

export type Theme = 'light' | 'dark';
export type Settings = { theme: Theme; fontSize: number; recent: string[] };

export const DEFAULT_SETTINGS: Settings = { theme: 'light', fontSize: 16, recent: [] };

export function parseSettings(value: unknown): Settings {
  return DEFAULT_SETTINGS;
}

export function loadSettings(): Settings {
  return legacyStorage.read('settings') ?? DEFAULT_SETTINGS;
}

export function saveSettings(settings: Settings): void {
  legacyStorage.write('settings', settings);
}

export function addRecent(settings: Settings, path: string): Settings {
  return settings;
}
```
```ts file=main.ts
import { legacyStorage } from './legacy';
import { addRecent, loadSettings, saveSettings } from './settings';

legacyStorage.write('settings', { theme: 'blue', fontSize: 18, recent: ['/a', 42, '/b'] });
const settings = addRecent(loadSettings(), '/c');
saveSettings(settings);
console.log(loadSettings());
```
:::

:::files{role=support}
```ts file=legacy.ts readonly
// 模拟一个没有类型声明的旧库：它的值在 TypeScript 看来都是 any。
// 真实的项目中，这样的库通常是没有 .d.ts 的 JavaScript 文件。
const store = new Map<string, string>();

export const legacyStorage: any = {
  read(key: string) {
    const raw = store.get(key);
    return raw === undefined ? null : JSON.parse(raw);
  },
  write(key: string, value: unknown) {
    store.set(key, JSON.stringify(value));
  },
  clear() {
    store.clear();
  },
};
```
:::

:::files{role=solution}
```ts file=settings.ts
import { legacyStorage } from './legacy';

export type Theme = 'light' | 'dark';
export type Settings = { theme: Theme; fontSize: number; recent: string[] };

export const DEFAULT_SETTINGS: Settings = { theme: 'light', fontSize: 16, recent: [] };

const MAX_RECENT = 5;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark';

export function parseSettings(value: unknown): Settings {
  const source: Record<string, unknown> = isRecord(value) ? value : {};
  const { theme, fontSize, recent } = source;
  const list: readonly unknown[] = Array.isArray(recent) ? recent : [];
  return {
    theme: isTheme(theme) ? theme : DEFAULT_SETTINGS.theme,
    fontSize: typeof fontSize === 'number' && Number.isInteger(fontSize) && fontSize >= 12 && fontSize <= 24 ? fontSize : DEFAULT_SETTINGS.fontSize,
    recent: list.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT),
  };
}

export function loadSettings(): Settings {
  // 旧库返回的是 any：一进来就交给 unknown，经过解析才交出去
  const raw: unknown = legacyStorage.read('settings');
  return parseSettings(raw);
}

export function saveSettings(settings: Settings): void {
  legacyStorage.write('settings', settings);
}

export function addRecent(settings: Settings, path: string): Settings {
  const recent = [path, ...settings.recent.filter((item) => item !== path)].slice(0, MAX_RECENT);
  return { ...settings, recent };
}
```
```ts file=main.ts
import { legacyStorage } from './legacy';
import { addRecent, loadSettings, saveSettings } from './settings';

legacyStorage.write('settings', { theme: 'blue', fontSize: 18, recent: ['/a', 42, '/b'] });
const settings = addRecent(loadSettings(), '/c');
saveSettings(settings);
console.log(loadSettings());
```
:::

:::files{role=tests}
```ts file=settings.test.ts
import { beforeEach, describe, expect, test } from 'vitest';
import { legacyStorage } from './legacy';
import { addRecent, DEFAULT_SETTINGS, loadSettings, parseSettings, saveSettings } from './settings';

beforeEach(() => {
  legacyStorage.clear();
});

describe('loadSettings', () => {
  test('没有保存过：默认设置', () => {
    expect(loadSettings()).toEqual({ theme: 'light', fontSize: 16, recent: [] });
  });

  test('保存之后读回来', () => {
    saveSettings({ theme: 'dark', fontSize: 20, recent: ['/a'] });
    expect(loadSettings()).toEqual({ theme: 'dark', fontSize: 20, recent: ['/a'] });
  });

  test('不合法的字段用默认值，合法的保留', () => {
    legacyStorage.write('settings', { theme: 'blue', fontSize: 18, recent: ['/a', 42, null, '/b'] });
    expect(loadSettings()).toEqual({ theme: 'light', fontSize: 18, recent: ['/a', '/b'] });
  });

  test('完全不对的数据：全部默认', () => {
    for (const bad of ['settings', 42, [1, 2], { theme: null, fontSize: '16', recent: 'x' }]) {
      legacyStorage.write('settings', bad);
      expect(loadSettings(), JSON.stringify(bad)).toEqual({ theme: 'light', fontSize: 16, recent: [] });
    }
  });

  test('多余的字段不会被带进来', () => {
    legacyStorage.write('settings', { theme: 'dark', fontSize: 16, recent: [], debug: true });
    expect(Object.keys(loadSettings()).toSorted()).toEqual(['fontSize', 'recent', 'theme']);
  });
});

describe('parseSettings', () => {
  test('字号的范围与整数', () => {
    expect(parseSettings({ fontSize: 12 }).fontSize).toBe(12);
    expect(parseSettings({ fontSize: 24 }).fontSize).toBe(24);
    for (const fontSize of [11, 25, 16.5, Number.NaN]) expect(parseSettings({ fontSize }).fontSize).toBe(16);
  });

  test('最近打开的最多保留前 5 个字符串', () => {
    expect(parseSettings({ recent: ['1', '2', '3', '4', '5', '6', '7'] }).recent).toEqual(['1', '2', '3', '4', '5']);
  });

  test('返回新的对象，修改它不影响默认设置', () => {
    const settings = parseSettings(null);
    settings.recent.push('/x');
    settings.theme = 'dark';
    expect(DEFAULT_SETTINGS).toEqual({ theme: 'light', fontSize: 16, recent: [] });
    expect(parseSettings(null).recent).toEqual([]);
  });
});

describe('addRecent', () => {
  test('放在最前面，去掉重复，最多 5 个', () => {
    let s = parseSettings(null);
    for (const path of ['/1', '/2', '/3', '/4', '/5', '/6']) s = addRecent(s, path);
    expect(s.recent).toEqual(['/6', '/5', '/4', '/3', '/2']);
    expect(addRecent(s, '/4').recent).toEqual(['/4', '/6', '/5', '/3', '/2']);
  });

  test('返回新的设置，不修改原来的', () => {
    const before = { theme: 'light' as const, fontSize: 16, recent: ['/a'] };
    const after = addRecent(before, '/b');
    expect(before.recent).toEqual(['/a']);
    expect(after.recent).toEqual(['/b', '/a']);
  });
});
```
```ts file=settings.test-d.ts
import { expectTypeOf } from 'vitest';
import { loadSettings, parseSettings, type Settings } from './settings';

expectTypeOf(loadSettings).returns.toEqualTypeOf<Settings>();
expectTypeOf(parseSettings).parameter(0).toEqualTypeOf<unknown>();
expectTypeOf(loadSettings().recent).toEqualTypeOf<string[]>();
```
:::

:::hint{level=1}
在 `loadSettings` 中写 `const raw: unknown = legacyStorage.read('settings')`：`any` 赋给 `unknown` 之后，任何使用都要先检查。真正的检查放在 `parseSettings` 中，它和旧库无关，可以单独测试。
:::

:::hint{level=2}
`parseSettings`：先用 `isRecord` 判断，不是对象时用一个空对象 `{}` 代替，这样后面统一处理。每个字段单独检查，不合法就用 `DEFAULT_SETTINGS` 中的值。`recent` 用 `Array.isArray` 之后赋给 `readonly unknown[]`，再 `filter((item): item is string => typeof item === 'string')`，最后 `slice(0, 5)`：`filter`、`slice` 都返回新数组，所以也不会和默认设置共用同一个数组。
:::

:::explanation
起始代码的 `loadSettings` 能通过类型检查和规则检查，却是这道题最大的问题：`legacyStorage.read('settings')` 返回 `any`，`any ?? DEFAULT_SETTINGS` 还是 `any`，赋给返回类型 `Settings` 不会报错。于是 `{ theme: 'blue', recent: [42] }` 这样的数据原封不动地进入了程序，类型却说它是 `Settings`。它没有写出任何 `any`，规则检查发现不了。

“外壳”的做法是：旧库的值一进来就赋给 `unknown`，这一步之后 TypeScript 重新开始检查；`parseSettings` 把 `unknown` 解析成真正的 `Settings`。程序的其他部分只调用 `loadSettings`、`saveSettings`，它们的类型都是准确的，旧库的 `any` 被关在了 `settings.ts` 这一个文件里。

逐字段地回退到默认值，而不是“一个字段不对就整个丢弃”，是设置这类数据的常见选择：用户改坏了一项，其他的设置仍然保留。p1-05 的任务板则相反，数据损坏时整个备份并提示，因为任务是用户的数据，悄悄丢掉一部分是不能接受的。

返回新的对象和新的数组，避免了一个隐蔽的问题：如果不合法时直接返回 `DEFAULT_SETTINGS`，调用方修改返回的设置（例如往 `recent` 里 `push`）就会改掉默认值本身。
:::

:::variant{kind=alt name=defaults-copy}
```ts file=settings.ts
import { legacyStorage } from './legacy';

export type Theme = 'light' | 'dark';
export type Settings = { theme: Theme; fontSize: number; recent: string[] };

export const DEFAULT_SETTINGS: Settings = { theme: 'light', fontSize: 16, recent: [] };

function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? Reflect.get(value, key) : undefined;
}

export function parseSettings(value: unknown): Settings {
  const result: Settings = { ...DEFAULT_SETTINGS, recent: [] };
  const theme = field(value, 'theme');
  if (theme === 'light' || theme === 'dark') result.theme = theme;
  const fontSize = field(value, 'fontSize');
  if (typeof fontSize === 'number' && Number.isSafeInteger(fontSize) && fontSize >= 12 && fontSize <= 24) result.fontSize = fontSize;
  const recent = field(value, 'recent');
  if (Array.isArray(recent)) {
    for (const item of recent) {
      const entry: unknown = item;
      if (typeof entry === 'string' && result.recent.length < 5) result.recent.push(entry);
    }
  }
  return result;
}

export function loadSettings(): Settings {
  const stored: unknown = legacyStorage.read('settings');
  return parseSettings(stored);
}

export function saveSettings(settings: Settings): void {
  legacyStorage.write('settings', settings);
}

export function addRecent(settings: Settings, path: string): Settings {
  const recent = settings.recent.filter((item) => item !== path);
  recent.unshift(path);
  recent.length = Math.min(recent.length, 5);
  return { ...settings, recent };
}
```
:::

:::variant{kind=wrong name=trusts-legacy fails=tests reason="直接返回旧库的 any，没有任何检查（规则检查发现不了）"}
```ts file=settings.ts
import { legacyStorage } from './legacy';

export type Theme = 'light' | 'dark';
export type Settings = { theme: Theme; fontSize: number; recent: string[] };

export const DEFAULT_SETTINGS: Settings = { theme: 'light', fontSize: 16, recent: [] };

const MAX_RECENT = 5;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark';

export function parseSettings(value: unknown): Settings {
  const source: Record<string, unknown> = isRecord(value) ? value : {};
  const { theme, fontSize, recent } = source;
  const list: readonly unknown[] = Array.isArray(recent) ? recent : [];
  return {
    theme: isTheme(theme) ? theme : DEFAULT_SETTINGS.theme,
    fontSize: typeof fontSize === 'number' && Number.isInteger(fontSize) && fontSize >= 12 && fontSize <= 24 ? fontSize : DEFAULT_SETTINGS.fontSize,
    recent: list.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT),
  };
}

export function loadSettings(): Settings {
  return legacyStorage.read('settings') ?? parseSettings(null);
}

export function saveSettings(settings: Settings): void {
  legacyStorage.write('settings', settings);
}

export function addRecent(settings: Settings, path: string): Settings {
  const recent = [path, ...settings.recent.filter((item) => item !== path)].slice(0, MAX_RECENT);
  return { ...settings, recent };
}
```
:::

:::variant{kind=wrong name=assert-settings fails=rules reason="用 as 把旧库的数据当作 Settings"}
```ts file=settings.ts
import { legacyStorage } from './legacy';

export type Theme = 'light' | 'dark';
export type Settings = { theme: Theme; fontSize: number; recent: string[] };

export const DEFAULT_SETTINGS: Settings = { theme: 'light', fontSize: 16, recent: [] };

export function parseSettings(value: unknown): Settings {
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_SETTINGS, recent: [] };
  return { ...DEFAULT_SETTINGS, ...(value as Partial<Settings>) };
}

export function loadSettings(): Settings {
  const raw: unknown = legacyStorage.read('settings');
  return parseSettings(raw);
}

export function saveSettings(settings: Settings): void {
  legacyStorage.write('settings', settings);
}

export function addRecent(settings: Settings, path: string): Settings {
  const recent = [path, ...settings.recent.filter((item) => item !== path)].slice(0, 5);
  return { ...settings, recent };
}
```
:::

:::variant{kind=wrong name=shared-default fails=tests reason="不合法时直接返回 DEFAULT_SETTINGS 本身，调用方修改返回值会改掉默认设置"}
```ts file=settings.ts
import { legacyStorage } from './legacy';

export type Theme = 'light' | 'dark';
export type Settings = { theme: Theme; fontSize: number; recent: string[] };

export const DEFAULT_SETTINGS: Settings = { theme: 'light', fontSize: 16, recent: [] };

const MAX_RECENT = 5;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark';

export function parseSettings(value: unknown): Settings {
  if (!isRecord(value)) return DEFAULT_SETTINGS;
  const { theme, fontSize, recent } = value;
  const list: readonly unknown[] = Array.isArray(recent) ? recent : [];
  return {
    theme: isTheme(theme) ? theme : DEFAULT_SETTINGS.theme,
    fontSize: typeof fontSize === 'number' && Number.isInteger(fontSize) && fontSize >= 12 && fontSize <= 24 ? fontSize : DEFAULT_SETTINGS.fontSize,
    recent: list.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT),
  };
}

export function loadSettings(): Settings {
  const raw: unknown = legacyStorage.read('settings');
  return parseSettings(raw);
}

export function saveSettings(settings: Settings): void {
  legacyStorage.write('settings', settings);
}

export function addRecent(settings: Settings, path: string): Settings {
  const recent = [path, ...settings.recent.filter((item) => item !== path)].slice(0, MAX_RECENT);
  return { ...settings, recent };
}
```
:::

:::variant{kind=wrong name=recent-unfiltered fails=tests reason="recent 只检查了是数组，非字符串的项也被保留了"}
```ts file=settings.ts
import { legacyStorage } from './legacy';

export type Theme = 'light' | 'dark';
export type Settings = { theme: Theme; fontSize: number; recent: string[] };

export const DEFAULT_SETTINGS: Settings = { theme: 'light', fontSize: 16, recent: [] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark';

export function parseSettings(value: unknown): Settings {
  const source: Record<string, unknown> = isRecord(value) ? value : {};
  const { theme, fontSize, recent } = source;
  return {
    theme: isTheme(theme) ? theme : DEFAULT_SETTINGS.theme,
    fontSize: typeof fontSize === 'number' && Number.isInteger(fontSize) && fontSize >= 12 && fontSize <= 24 ? fontSize : DEFAULT_SETTINGS.fontSize,
    recent: Array.isArray(recent) ? recent.slice(0, 5) : [],
  };
}

export function loadSettings(): Settings {
  const raw: unknown = legacyStorage.read('settings');
  return parseSettings(raw);
}

export function saveSettings(settings: Settings): void {
  legacyStorage.write('settings', settings);
}

export function addRecent(settings: Settings, path: string): Settings {
  const recent = [path, ...settings.recent.filter((item) => item !== path)].slice(0, 5);
  return { ...settings, recent };
}
```
:::
