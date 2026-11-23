---
kind: challenge
title: 按键名返回不同类型的设置
---
浏览器里用来创建页面元素的函数 `document.createElement`，返回类型取决于传入的字符串：`createElement('img')` 返回 `HTMLImageElement`（图片元素），`createElement('a')` 返回 `HTMLAnchorElement`（链接元素）。这一题用重载写一个同样风格的设置存储。

设置有三项：

```ts
type Settings = { theme: 'light' | 'dark'; fontSize: number; language: string };
type SettingKey = 'theme' | 'fontSize' | 'language';
```

改写起始代码里的 `createSettings(initial: Settings)`（现在的 `get`、`set` 没有重载，`set` 还是空的），让它返回一个对象，带有两个函数：

- `get(key)`：用重载描述三种调用：`get('theme')` 返回 `'light' | 'dark'`，`get('fontSize')` 返回 `number`，`get('language')` 返回 `string`。
- `set(key, value)`：同样用重载，值的类型必须与键对应（`set('fontSize', '16')` 应当报类型错误）。

`set` 还要在运行时检查值，不合法时抛出 `RangeError`，原来的设置保持不变：

- `theme`：只能是 `'light'` 或 `'dark'`。重载签名已经限制了它的类型，但类型只在编译时起作用（a02），运行时仍然可能收到别的值。
- `fontSize`：必须是 8 到 72 之间的整数（包括 8 和 72）。
- `language`：去掉首尾空格后不能为空；合法时保存**去掉首尾空格后**的值。

`createSettings` 要复制一份 `initial`，之后对 `initial` 的修改不影响设置存储，`set` 也不修改 `initial`。

提示：对象里的函数要有重载，可以先在 `createSettings` 内部用 `function` 声明带重载的 `get` 和 `set`，再把它们放进返回的对象里。`set` 的实现签名要接受三种值，`value` 的类型比较宽（例如 `string | number`），保存之前要用 `typeof` 或 `===` 收窄；和前面的练习一样，不要用类型断言 `as`。

:::files{role=starter}
```ts file=settings.ts
export type Settings = { theme: 'light' | 'dark'; fontSize: number; language: string };
export type SettingKey = 'theme' | 'fontSize' | 'language';

export function createSettings(initial: Settings) {
  const current = initial;
  return {
    get: (key: SettingKey) => current[key],
    set: (key: SettingKey, value: string | number) => {},
  };
}
```
:::

:::files{role=solution}
```ts file=settings.ts
export type Settings = { theme: 'light' | 'dark'; fontSize: number; language: string };
export type SettingKey = 'theme' | 'fontSize' | 'language';

export function createSettings(initial: Settings) {
  const current: Settings = { ...initial };

  function get(key: 'theme'): 'light' | 'dark';
  function get(key: 'fontSize'): number;
  function get(key: 'language'): string;
  function get(key: SettingKey): string | number {
    return current[key];
  }

  function set(key: 'theme', value: 'light' | 'dark'): void;
  function set(key: 'fontSize', value: number): void;
  function set(key: 'language', value: string): void;
  function set(key: SettingKey, value: string | number): void {
    if (key === 'fontSize') {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 8 || value > 72) {
        throw new RangeError('fontSize 必须是 8–72 的整数');
      }
      current.fontSize = value;
    } else if (key === 'language') {
      if (typeof value !== 'string' || value.trim() === '') {
        throw new RangeError('language 不能为空');
      }
      current.language = value.trim();
    } else {
      if (value !== 'light' && value !== 'dark') {
        throw new RangeError('theme 只能是 light 或 dark');
      }
      current.theme = value;
    }
  }

  return { get, set };
}
```
:::

:::files{role=tests}
```ts file=settings.test.ts
import { describe, expect, test } from 'vitest';
import { createSettings } from './settings';

function sample() {
  return { theme: 'light' as const, fontSize: 14, language: 'zh-CN' };
}

describe('createSettings', () => {
  test('读取初始值', () => {
    const s = createSettings(sample());
    expect(s.get('theme')).toBe('light');
    expect(s.get('fontSize')).toBe(14);
    expect(s.get('language')).toBe('zh-CN');
  });

  test('修改设置', () => {
    const s = createSettings(sample());
    s.set('theme', 'dark');
    s.set('fontSize', 18);
    s.set('language', ' en ');
    expect(s.get('theme')).toBe('dark');
    expect(s.get('fontSize')).toBe(18);
    expect(s.get('language')).toBe('en');
  });

  test('非法的值抛出 RangeError，并保持原值', () => {
    const s = createSettings(sample());
    expect(() => s.set('fontSize', 7)).toThrow(RangeError);
    expect(() => s.set('fontSize', 73)).toThrow(RangeError);
    expect(() => s.set('fontSize', 12.5)).toThrow(RangeError);
    expect(() => s.set('language', '   ')).toThrow(RangeError);
    expect(s.get('fontSize')).toBe(14);
    expect(s.get('language')).toBe('zh-CN');
  });

  test('非法的主题也抛出 RangeError', () => {
    const s = createSettings(sample());
    // @ts-expect-error 故意传入类型不对的值，检查运行时校验
    expect(() => s.set('theme', 'blue')).toThrow(RangeError);
    expect(s.get('theme')).toBe('light');
  });

  test('与 initial 互不影响', () => {
    const initial = sample();
    const s = createSettings(initial);
    s.set('fontSize', 20);
    expect(initial.fontSize).toBe(14);
    initial.language = 'fr';
    expect(s.get('language')).toBe('zh-CN');
  });
});
```
```ts file=settings.test-d.ts
import { expectTypeOf } from 'vitest';
import { createSettings } from './settings';

const s = createSettings({ theme: 'light', fontSize: 14, language: 'zh-CN' });
expectTypeOf(s.get('theme')).toEqualTypeOf<'light' | 'dark'>();
expectTypeOf(s.get('fontSize')).toEqualTypeOf<number>();
expectTypeOf(s.get('language')).toEqualTypeOf<string>();

// @ts-expect-error 字号必须是数字
s.set('fontSize', '16');
// @ts-expect-error 主题只能是 light 或 dark
s.set('theme', 'blue');
// @ts-expect-error 没有这个设置
s.get('color');
```
:::

:::hint{level=1}
在 `createSettings` 内部写 `function get(key: 'theme'): 'light' | 'dark';` 等三个重载签名，再写一个实现签名 `function get(key: SettingKey): string | number { … }`。`set` 同理，每个签名把键和值的类型配对。最后 `return { get, set };`。
:::

:::hint{level=2}
`set` 的实现签名可以写成 `(key: SettingKey, value: string | number): void`，里面先判断 `key`，再用 `typeof value` 检查值。实现签名不对外可见，它的宽松不会影响调用方——调用方只能按重载签名调用。别忘了 `const current: Settings = { ...initial };` 复制一份。
:::

:::explanation
`get` 的三个重载签名把“键”和“返回类型”一一对应起来：调用方传 `'fontSize'` 就得到 `number`，不需要收窄。`set` 的重载签名则把键和值的类型配对，`set('fontSize', '16')` 找不到匹配的签名，在编译期就被拒绝。

实现签名里看不到重载签名的配对关系：`key === 'fontSize'` 成立时，TypeScript 并不知道 `value` 一定是数字，它仍然是 `string | number`，直接赋值会报 TS2322。所以每个分支都先用 `typeof` 或 `===` 把 `value` 收窄再保存，这些判断同时也是运行时检查的一部分。

为什么还要在运行时检查？类型只能保证“是数字”，保证不了“是 8 到 72 之间的整数”；另外，来自外部的数据（例如 `JSON.parse` 的结果）可以绕过类型检查。

浏览器的 `createElement`（按标签名决定返回类型）和 `addEventListener`（按事件名决定回调收到的事件类型）效果和这里类似；不过 TypeScript 自带的浏览器类型声明（lib.dom）实际用的是 b15 将要学的泛型写法。b15 学了泛型约束后，可以用 `get<K extends SettingKey>(key: K): Settings[K]` 一个签名表达同样的意思，不需要逐个列出。
:::

:::variant{kind=alt name=switch-based}
```ts file=settings.ts
export type Settings = { theme: 'light' | 'dark'; fontSize: number; language: string };
export type SettingKey = 'theme' | 'fontSize' | 'language';

export function createSettings(initial: Settings) {
  let current: Settings = { theme: initial.theme, fontSize: initial.fontSize, language: initial.language };

  function get(key: 'theme'): 'light' | 'dark';
  function get(key: 'fontSize'): number;
  function get(key: 'language'): string;
  function get(key: SettingKey) {
    switch (key) {
      case 'theme':
        return current.theme;
      case 'fontSize':
        return current.fontSize;
      case 'language':
        return current.language;
    }
  }

  function set(key: 'theme', value: 'light' | 'dark'): void;
  function set(key: 'fontSize', value: number): void;
  function set(key: 'language', value: string): void;
  function set(key: SettingKey, value: unknown): void {
    if (key === 'theme') {
      if (value !== 'light' && value !== 'dark') throw new RangeError('theme 无效');
      current = { ...current, theme: value };
    } else if (key === 'fontSize' && typeof value === 'number') {
      if (!Number.isInteger(value) || value < 8 || value > 72) throw new RangeError('fontSize 超出范围');
      current = { ...current, fontSize: value };
    } else if (key === 'language' && typeof value === 'string') {
      const language = value.trim();
      if (language === '') throw new RangeError('language 不能为空');
      current = { ...current, language };
    }
  }

  return { get, set };
}
```
:::

:::variant{kind=wrong name=union-return fails=types reason="get 只有一个签名，返回类型是三者的联合"}
```ts file=settings.ts
export type Settings = { theme: 'light' | 'dark'; fontSize: number; language: string };
export type SettingKey = 'theme' | 'fontSize' | 'language';

export function createSettings(initial: Settings) {
  const current: Settings = { ...initial };
  function get(key: SettingKey): string | number {
    return current[key];
  }
  function set(key: 'theme', value: 'light' | 'dark'): void;
  function set(key: 'fontSize', value: number): void;
  function set(key: 'language', value: string): void;
  function set(key: SettingKey, value: string | number): void {
    if (key === 'fontSize') {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 8 || value > 72) throw new RangeError('fontSize');
      current.fontSize = value;
    } else if (key === 'language') {
      if (typeof value !== 'string' || value.trim() === '') throw new RangeError('language');
      current.language = value.trim();
    } else if (value === 'light' || value === 'dark') {
      current.theme = value;
    }
  }
  return { get, set };
}
```
:::

:::variant{kind=wrong name=loose-set fails=types reason="set 没有重载，任何键都能配任何值"}
```ts file=settings.ts
export type Settings = { theme: 'light' | 'dark'; fontSize: number; language: string };
export type SettingKey = 'theme' | 'fontSize' | 'language';

export function createSettings(initial: Settings) {
  const current: Settings = { ...initial };
  function get(key: 'theme'): 'light' | 'dark';
  function get(key: 'fontSize'): number;
  function get(key: 'language'): string;
  function get(key: SettingKey): string | number {
    return current[key];
  }
  function set(key: SettingKey, value: string | number): void {
    if (key === 'fontSize') {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 8 || value > 72) throw new RangeError('fontSize');
      current.fontSize = value;
    } else if (key === 'language') {
      if (typeof value !== 'string' || value.trim() === '') throw new RangeError('language');
      current.language = value.trim();
    } else if (value === 'light' || value === 'dark') {
      current.theme = value;
    }
  }
  return { get, set };
}
```
:::

:::variant{kind=wrong name=no-copy fails=tests reason="直接使用了 initial，修改会互相影响"}
```ts file=settings.ts
export type Settings = { theme: 'light' | 'dark'; fontSize: number; language: string };
export type SettingKey = 'theme' | 'fontSize' | 'language';

export function createSettings(initial: Settings) {
  const current = initial;
  function get(key: 'theme'): 'light' | 'dark';
  function get(key: 'fontSize'): number;
  function get(key: 'language'): string;
  function get(key: SettingKey): string | number {
    return current[key];
  }
  function set(key: 'theme', value: 'light' | 'dark'): void;
  function set(key: 'fontSize', value: number): void;
  function set(key: 'language', value: string): void;
  function set(key: SettingKey, value: string | number): void {
    if (key === 'fontSize') {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 8 || value > 72) throw new RangeError('fontSize');
      current.fontSize = value;
    } else if (key === 'language') {
      if (typeof value !== 'string' || value.trim() === '') throw new RangeError('language');
      current.language = value.trim();
    } else if (value === 'light' || value === 'dark') {
      current.theme = value;
    }
  }
  return { get, set };
}
```
:::

:::variant{kind=wrong name=no-range-check fails=tests reason="没有在运行时检查字号范围"}
```ts file=settings.ts
export type Settings = { theme: 'light' | 'dark'; fontSize: number; language: string };
export type SettingKey = 'theme' | 'fontSize' | 'language';

export function createSettings(initial: Settings) {
  const current: Settings = { ...initial };
  function get(key: 'theme'): 'light' | 'dark';
  function get(key: 'fontSize'): number;
  function get(key: 'language'): string;
  function get(key: SettingKey): string | number {
    return current[key];
  }
  function set(key: 'theme', value: 'light' | 'dark'): void;
  function set(key: 'fontSize', value: number): void;
  function set(key: 'language', value: string): void;
  function set(key: SettingKey, value: string | number): void {
    if (key === 'fontSize' && typeof value === 'number') {
      current.fontSize = value;
    } else if (key === 'language' && typeof value === 'string') {
      current.language = value.trim();
    } else if (value === 'light' || value === 'dark') {
      current.theme = value;
    }
  }
  return { get, set };
}
```
:::
