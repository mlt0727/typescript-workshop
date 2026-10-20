---
kind: challenge
title: 带版本迁移的设置存储
---
设置保存在存储的 `settings` 键下。第一版程序保存的格式是 `{ "darkMode": true }`（没有版本号）；新版本改成了：

```json
{ "version": 2, "theme": "dark", "fontSize": 18, "lastOpened": "2026-10-20T08:00:00.000Z" }
```

实现两个函数（`storage` 的类型与小任务相同）：

**`loadSettings(storage)`** 返回 `Settings`：

1. 没有保存过、内容不是合法的 JSON、或者存储不可用：返回默认设置；
2. **第 2 版**（`version` 为 `2`）：`theme` 必须是 `'light'`、`'dark'`、`'system'` 之一，`fontSize` 必须是 10 到 32 之间的整数，`lastOpened` 是 `null` 或者能解析成有效日期的字符串（返回时转换成 `Date`）。任何一项不合格，就返回默认设置；
3. **第 1 版**（普通对象、没有 `version`，`darkMode` 是布尔值）：迁移成 `theme: darkMode ? 'dark' : 'light'`，`fontSize` 和 `lastOpened` 用默认值；并且**立即把迁移后的结果按第 2 版的格式写回**存储，下次就不用再迁移；
4. 其他任何情况（包括未知的版本号）：返回默认设置。

**`saveSettings(storage, settings)`** 按第 2 版的格式保存（日期保存为 ISO 字符串）；写入失败时忽略。

默认设置是 `{ theme: 'system', fontSize: 16, lastOpened: null }`。每次返回默认设置时都返回一个**新对象**，调用方修改它不能影响下一次的结果。

:::files{role=support}
```ts file=storage.ts readonly
export type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};
```
:::

:::files{role=starter}
```ts file=settings.ts
import type { KeyValueStorage } from './storage';

export type Theme = 'light' | 'dark' | 'system';
export type Settings = { theme: Theme; fontSize: number; lastOpened: Date | null };

export function defaultSettings(): Settings {
  return { theme: 'system', fontSize: 16, lastOpened: null };
}

export function loadSettings(storage: KeyValueStorage): Settings {
  return defaultSettings();
}

export function saveSettings(storage: KeyValueStorage, settings: Settings): void {}
```
:::

:::files{role=solution}
```ts file=settings.ts
import type { KeyValueStorage } from './storage';

export type Theme = 'light' | 'dark' | 'system';
export type Settings = { theme: Theme; fontSize: number; lastOpened: Date | null };

const KEY = 'settings';

export function defaultSettings(): Settings {
  return { theme: 'system', fontSize: 16, lastOpened: null };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}

function parseV2(data: Record<string, unknown>): Settings | null {
  const { theme, fontSize, lastOpened } = data;
  if (!isTheme(theme)) return null;
  if (typeof fontSize !== 'number' || !Number.isInteger(fontSize) || fontSize < 10 || fontSize > 32) return null;
  if (lastOpened === null) return { theme, fontSize, lastOpened: null };
  if (typeof lastOpened !== 'string') return null;
  const date = new Date(lastOpened);
  if (Number.isNaN(date.getTime())) return null;
  return { theme, fontSize, lastOpened: date };
}

export function saveSettings(storage: KeyValueStorage, settings: Settings): void {
  const stored = {
    version: 2,
    theme: settings.theme,
    fontSize: settings.fontSize,
    lastOpened: settings.lastOpened?.toISOString() ?? null,
  };
  try {
    storage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // 写入失败时忽略
  }
}

export function loadSettings(storage: KeyValueStorage): Settings {
  let data: unknown;
  try {
    const raw = storage.getItem(KEY);
    if (raw === null) return defaultSettings();
    data = JSON.parse(raw);
  } catch {
    return defaultSettings();
  }
  if (!isRecord(data)) return defaultSettings();

  if (data.version === 2) {
    return parseV2(data) ?? defaultSettings();
  }
  if (data.version === undefined && typeof data.darkMode === 'boolean') {
    const migrated: Settings = { ...defaultSettings(), theme: data.darkMode ? 'dark' : 'light' };
    saveSettings(storage, migrated);
    return migrated;
  }
  return defaultSettings();
}
```
:::

:::files{role=tests}
```ts file=settings.test.ts
import { describe, expect, test } from 'vitest';
import { defaultSettings, loadSettings, saveSettings } from './settings';
import type { KeyValueStorage } from './storage';

function memoryStorage(settings?: string) {
  const data = new Map<string, string>();
  if (settings !== undefined) data.set('settings', settings);
  const storage: KeyValueStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
  return { storage, data };
}

describe('loadSettings', () => {
  test('没有保存过时返回默认设置', () => {
    expect(loadSettings(memoryStorage().storage)).toEqual(defaultSettings());
  });

  test('读取第 2 版，日期转换成 Date', () => {
    const { storage } = memoryStorage('{"version":2,"theme":"dark","fontSize":18,"lastOpened":"2026-10-20T08:00:00.000Z"}');
    const settings = loadSettings(storage);
    expect(settings.theme).toBe('dark');
    expect(settings.fontSize).toBe(18);
    expect(settings.lastOpened).toBeInstanceOf(Date);
    expect(settings.lastOpened?.toISOString()).toBe('2026-10-20T08:00:00.000Z');
    expect(loadSettings(memoryStorage('{"version":2,"theme":"light","fontSize":10,"lastOpened":null}').storage).lastOpened).toBeNull();
  });

  test('第 2 版中任何一项不合格都返回默认设置', () => {
    for (const bad of [
      '{"version":2,"theme":"blue","fontSize":18,"lastOpened":null}',
      '{"version":2,"theme":"dark","fontSize":9,"lastOpened":null}',
      '{"version":2,"theme":"dark","fontSize":16.5,"lastOpened":null}',
      '{"version":2,"theme":"dark","fontSize":16,"lastOpened":"昨天"}',
      '{"version":2,"theme":"dark","fontSize":16}',
    ]) {
      expect(loadSettings(memoryStorage(bad).storage), bad).toEqual(defaultSettings());
    }
  });

  test('第 1 版迁移成第 2 版，并写回存储', () => {
    const { storage, data } = memoryStorage('{"darkMode":true}');
    expect(loadSettings(storage)).toEqual({ theme: 'dark', fontSize: 16, lastOpened: null });
    const stored: unknown = JSON.parse(data.get('settings') ?? 'null');
    expect(stored).toEqual({ version: 2, theme: 'dark', fontSize: 16, lastOpened: null });
    expect(loadSettings(memoryStorage('{"darkMode":false}').storage).theme).toBe('light');
  });

  test('第 1 版格式不对、未知版本、损坏的内容都返回默认设置', () => {
    for (const bad of ['{"darkMode":"yes"}', '{"version":3,"theme":"dark","fontSize":18,"lastOpened":null}', '{"version":2', '[]', '"dark"']) {
      expect(loadSettings(memoryStorage(bad).storage), bad).toEqual(defaultSettings());
    }
  });

  test('存储不可用时返回默认设置', () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new DOMException('不可用', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('不可用', 'SecurityError');
      },
      removeItem: () => {},
    };
    expect(loadSettings(broken)).toEqual(defaultSettings());
    expect(() => saveSettings(broken, defaultSettings())).not.toThrow();
  });

  test('每次返回的默认设置都是新对象', () => {
    const { storage } = memoryStorage();
    const first = loadSettings(storage);
    first.theme = 'dark';
    expect(loadSettings(storage).theme).toBe('system');
  });
});

describe('saveSettings', () => {
  test('按第 2 版格式保存，读回来相同', () => {
    const { storage, data } = memoryStorage();
    const settings = { theme: 'light' as const, fontSize: 20, lastOpened: new Date('2026-01-02T03:04:05.000Z') };
    saveSettings(storage, settings);
    expect(JSON.parse(data.get('settings') ?? 'null')).toEqual({
      version: 2,
      theme: 'light',
      fontSize: 20,
      lastOpened: '2026-01-02T03:04:05.000Z',
    });
    expect(loadSettings(storage)).toEqual(settings);
  });
});
```
:::

:::hint{level=1}
先读取并解析（放在 `try/catch` 里），确认结果是普通对象。然后按 `version` 分情况：是 `2` 就验证各个字段；没有 `version` 并且 `darkMode` 是布尔值，就是第 1 版，迁移；其他情况返回默认设置。
:::

:::hint{level=2}
日期：`lastOpened` 是 `null` 就保持 `null`；是字符串就 `new Date(...)`，再用 `Number.isNaN(date.getTime())` 检查。迁移之后调用 `saveSettings` 写回。保存时用 `settings.lastOpened?.toISOString() ?? null` 把日期变回字符串。默认设置用一个函数每次返回新对象。
:::

:::explanation
保存在用户浏览器中的数据，比程序活得更久。新版本上线时，老用户的浏览器里仍然是第 1 版的数据；如果新代码只认识第 2 版，这些用户一打开页面就丢失了设置，甚至直接报错。

版本号让读取代码能分辨数据的格式：

- **当前版本**：验证后使用；
- **已知的旧版本**：迁移成当前格式，并写回存储，迁移只发生一次；
- **无法识别**（未来的版本、损坏的数据）：退回默认值，而不是猜测它的含义。

日期需要两次转换：保存时 `toISOString()` 变成字符串，读取时 `new Date(...)` 变回日期并验证。JSON 本身不会替你做这件事（本课第二节）。

默认设置用函数 `defaultSettings()` 每次返回一个新对象：如果返回同一个对象，调用方修改了它（`settings.theme = 'dark'`），下一次读取到的“默认设置”也就变了。
:::

:::variant{kind=alt name=migrations-table}
```ts file=settings.ts
import type { KeyValueStorage } from './storage';

export type Theme = 'light' | 'dark' | 'system';
export type Settings = { theme: Theme; fontSize: number; lastOpened: Date | null };

export function defaultSettings(): Settings {
  return { theme: 'system', fontSize: 16, lastOpened: null };
}

type StoredV2 = { version: 2; theme: Theme; fontSize: number; lastOpened: string | null };

const THEMES: readonly unknown[] = ['light', 'dark', 'system'];
const isTheme = (v: unknown): v is Theme => THEMES.includes(v);

function toV2(data: unknown): StoredV2 | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const version = 'version' in data ? data.version : undefined;
  if (version === undefined) {
    const darkMode = 'darkMode' in data ? data.darkMode : undefined;
    return typeof darkMode === 'boolean' ? { version: 2, theme: darkMode ? 'dark' : 'light', fontSize: 16, lastOpened: null } : null;
  }
  if (version !== 2) return null;
  const theme = 'theme' in data ? data.theme : undefined;
  const fontSize = 'fontSize' in data ? data.fontSize : undefined;
  const lastOpened = 'lastOpened' in data ? data.lastOpened : undefined;
  if (!isTheme(theme) || typeof fontSize !== 'number' || !Number.isInteger(fontSize) || fontSize < 10 || fontSize > 32) return null;
  if (lastOpened !== null && typeof lastOpened !== 'string') return null;
  return { version: 2, theme, fontSize, lastOpened };
}

export function saveSettings(storage: KeyValueStorage, s: Settings): void {
  try {
    const stored: StoredV2 = { version: 2, theme: s.theme, fontSize: s.fontSize, lastOpened: s.lastOpened ? s.lastOpened.toISOString() : null };
    storage.setItem('settings', JSON.stringify(stored));
  } catch {
    // 忽略
  }
}

export function loadSettings(storage: KeyValueStorage): Settings {
  let raw: string | null;
  let data: unknown;
  try {
    raw = storage.getItem('settings');
    data = raw === null ? null : JSON.parse(raw);
  } catch {
    return defaultSettings();
  }
  const v2 = toV2(data);
  if (v2 === null) return defaultSettings();
  const date = v2.lastOpened === null ? null : new Date(v2.lastOpened);
  if (date !== null && Number.isNaN(date.getTime())) return defaultSettings();
  const settings: Settings = { theme: v2.theme, fontSize: v2.fontSize, lastOpened: date };
  const wasOld = typeof data === 'object' && data !== null && !('version' in data);
  if (wasOld) saveSettings(storage, settings);
  return settings;
}
```
:::

:::variant{kind=wrong name=no-migration fails=tests reason="不认识第 1 版的数据，老用户的设置丢失了"}
```ts file=settings.ts
import type { KeyValueStorage } from './storage';

export type Theme = 'light' | 'dark' | 'system';
export type Settings = { theme: Theme; fontSize: number; lastOpened: Date | null };

export function defaultSettings(): Settings {
  return { theme: 'system', fontSize: 16, lastOpened: null };
}

export function saveSettings(storage: KeyValueStorage, settings: Settings): void {
  try {
    storage.setItem('settings', JSON.stringify({ version: 2, ...settings, lastOpened: settings.lastOpened?.toISOString() ?? null }));
  } catch {
    // 忽略
  }
}

export function loadSettings(storage: KeyValueStorage): Settings {
  try {
    const raw = storage.getItem('settings');
    const data: unknown = raw === null ? null : JSON.parse(raw);
    if (typeof data !== 'object' || data === null || !('version' in data) || data.version !== 2) return defaultSettings();
    const theme = 'theme' in data ? data.theme : undefined;
    const fontSize = 'fontSize' in data ? data.fontSize : undefined;
    const lastOpened = 'lastOpened' in data ? data.lastOpened : undefined;
    if (theme !== 'light' && theme !== 'dark' && theme !== 'system') return defaultSettings();
    if (typeof fontSize !== 'number' || !Number.isInteger(fontSize) || fontSize < 10 || fontSize > 32) return defaultSettings();
    if (lastOpened === null) return { theme, fontSize, lastOpened: null };
    if (typeof lastOpened !== 'string' || Number.isNaN(new Date(lastOpened).getTime())) return defaultSettings();
    return { theme, fontSize, lastOpened: new Date(lastOpened) };
  } catch {
    return defaultSettings();
  }
}
```
:::

:::variant{kind=wrong name=no-write-back fails=tests reason="迁移了第 1 版的数据，但没有写回存储"}
```ts file=settings.ts
import type { KeyValueStorage } from './storage';

export type Theme = 'light' | 'dark' | 'system';
export type Settings = { theme: Theme; fontSize: number; lastOpened: Date | null };

export function defaultSettings(): Settings {
  return { theme: 'system', fontSize: 16, lastOpened: null };
}

export function saveSettings(storage: KeyValueStorage, settings: Settings): void {
  try {
    storage.setItem('settings', JSON.stringify({ version: 2, ...settings, lastOpened: settings.lastOpened?.toISOString() ?? null }));
  } catch {
    // 忽略
  }
}

export function loadSettings(storage: KeyValueStorage): Settings {
  try {
    const raw = storage.getItem('settings');
    const data: unknown = raw === null ? null : JSON.parse(raw);
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return defaultSettings();
    if (!('version' in data)) {
      const darkMode = 'darkMode' in data ? data.darkMode : undefined;
      if (typeof darkMode !== 'boolean') return defaultSettings();
      return { ...defaultSettings(), theme: darkMode ? 'dark' : 'light' };
    }
    if (data.version !== 2) return defaultSettings();
    const theme = 'theme' in data ? data.theme : undefined;
    const fontSize = 'fontSize' in data ? data.fontSize : undefined;
    const lastOpened = 'lastOpened' in data ? data.lastOpened : undefined;
    if (theme !== 'light' && theme !== 'dark' && theme !== 'system') return defaultSettings();
    if (typeof fontSize !== 'number' || !Number.isInteger(fontSize) || fontSize < 10 || fontSize > 32) return defaultSettings();
    if (lastOpened === null) return { theme, fontSize, lastOpened: null };
    if (typeof lastOpened !== 'string' || Number.isNaN(new Date(lastOpened).getTime())) return defaultSettings();
    return { theme, fontSize, lastOpened: new Date(lastOpened) };
  } catch {
    return defaultSettings();
  }
}
```
:::

:::variant{kind=wrong name=any-version fails=tests reason="没有检查版本号，未知版本的数据也被当作第 2 版读取"}
```ts file=settings.ts
import type { KeyValueStorage } from './storage';

export type Theme = 'light' | 'dark' | 'system';
export type Settings = { theme: Theme; fontSize: number; lastOpened: Date | null };

export function defaultSettings(): Settings {
  return { theme: 'system', fontSize: 16, lastOpened: null };
}

export function saveSettings(storage: KeyValueStorage, settings: Settings): void {
  try {
    storage.setItem('settings', JSON.stringify({ version: 2, ...settings, lastOpened: settings.lastOpened?.toISOString() ?? null }));
  } catch {
    // 忽略
  }
}

export function loadSettings(storage: KeyValueStorage): Settings {
  try {
    const raw = storage.getItem('settings');
    const data: unknown = raw === null ? null : JSON.parse(raw);
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return defaultSettings();
    if (!('version' in data)) {
      const darkMode = 'darkMode' in data ? data.darkMode : undefined;
      if (typeof darkMode !== 'boolean') return defaultSettings();
      const migrated: Settings = { ...defaultSettings(), theme: darkMode ? 'dark' : 'light' };
      saveSettings(storage, migrated);
      return migrated;
    }
    const theme = 'theme' in data ? data.theme : undefined;
    const fontSize = 'fontSize' in data ? data.fontSize : undefined;
    const lastOpened = 'lastOpened' in data ? data.lastOpened : undefined;
    if (theme !== 'light' && theme !== 'dark' && theme !== 'system') return defaultSettings();
    if (typeof fontSize !== 'number' || !Number.isInteger(fontSize) || fontSize < 10 || fontSize > 32) return defaultSettings();
    if (lastOpened === null) return { theme, fontSize, lastOpened: null };
    if (typeof lastOpened !== 'string' || Number.isNaN(new Date(lastOpened).getTime())) return defaultSettings();
    return { theme, fontSize, lastOpened: new Date(lastOpened) };
  } catch {
    return defaultSettings();
  }
}
```
:::

:::variant{kind=wrong name=date-not-checked fails=tests reason="没有检查日期是否有效"}
```ts file=settings.ts
import type { KeyValueStorage } from './storage';

export type Theme = 'light' | 'dark' | 'system';
export type Settings = { theme: Theme; fontSize: number; lastOpened: Date | null };

export function defaultSettings(): Settings {
  return { theme: 'system', fontSize: 16, lastOpened: null };
}

export function saveSettings(storage: KeyValueStorage, settings: Settings): void {
  try {
    storage.setItem('settings', JSON.stringify({ version: 2, ...settings, lastOpened: settings.lastOpened?.toISOString() ?? null }));
  } catch {
    // 忽略
  }
}

export function loadSettings(storage: KeyValueStorage): Settings {
  try {
    const raw = storage.getItem('settings');
    const data: unknown = raw === null ? null : JSON.parse(raw);
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return defaultSettings();
    if (!('version' in data)) {
      const darkMode = 'darkMode' in data ? data.darkMode : undefined;
      if (typeof darkMode !== 'boolean') return defaultSettings();
      const migrated: Settings = { ...defaultSettings(), theme: darkMode ? 'dark' : 'light' };
      saveSettings(storage, migrated);
      return migrated;
    }
    if (data.version !== 2) return defaultSettings();
    const theme = 'theme' in data ? data.theme : undefined;
    const fontSize = 'fontSize' in data ? data.fontSize : undefined;
    const lastOpened = 'lastOpened' in data ? data.lastOpened : undefined;
    if (theme !== 'light' && theme !== 'dark' && theme !== 'system') return defaultSettings();
    if (typeof fontSize !== 'number' || !Number.isInteger(fontSize) || fontSize < 10 || fontSize > 32) return defaultSettings();
    return { theme, fontSize, lastOpened: typeof lastOpened === 'string' ? new Date(lastOpened) : null };
  } catch {
    return defaultSettings();
  }
}
```
:::
