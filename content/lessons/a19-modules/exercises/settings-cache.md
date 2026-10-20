---
kind: challenge
title: 只解析一次的设置
---
`settings.ts`（只读）提供了设置的类型 `Settings` 和设置文本 `RAW_SETTINGS`。在 `load.ts` 中实现三个函数：

- `loadSettings()`：第一次调用时用 `JSON.parse` 解析 `RAW_SETTINGS` 并缓存结果；之后的调用**直接返回同一个对象**，不再解析。
- `parseCount()`：返回到目前为止实际调用 `JSON.parse` 的次数（供测试检查）。
- `resetSettings()`：清除缓存，下一次 `loadSettings()` 会重新解析；`parseCount()` 继续累加，不清零。

缓存要放在模块顶层，这样无论哪个文件导入 `load.ts`，用到的都是同一份缓存。（这里的设置文本由程序自己提供，可以信任；来自外部的数据需要运行时校验，见 a02 和 E 阶段。）

:::files{role=support}
```ts file=settings.ts readonly
export type Settings = { theme: string; fontSize: number };

export const RAW_SETTINGS = '{ "theme": "dark", "fontSize": 16 }';
```
:::

:::files{role=starter}
```ts file=load.ts
import { Settings, RAW_SETTINGS } from './settings';

let count = 0;

export function loadSettings(): Settings {
  count++;
  return JSON.parse(RAW_SETTINGS);
}

export function parseCount(): number {
  return count;
}

export function resetSettings(): void {}
```
:::

:::files{role=solution}
```ts file=load.ts
import { RAW_SETTINGS, type Settings } from './settings';

let cached: Settings | null = null;
let count = 0;

export function loadSettings(): Settings {
  if (cached === null) {
    const parsed: Settings = JSON.parse(RAW_SETTINGS);
    count++;
    cached = parsed;
  }
  return cached;
}

export function parseCount(): number {
  return count;
}

export function resetSettings(): void {
  cached = null;
}
```
:::

:::files{role=tests}
```ts file=load.test.ts
import { expect, test } from 'vitest';
import { loadSettings, parseCount, resetSettings } from './load';

test('解析出正确的设置', () => {
  expect(loadSettings()).toEqual({ theme: 'dark', fontSize: 16 });
});

test('之后的调用返回同一个对象，不再解析', () => {
  const first = loadSettings();
  const second = loadSettings();
  expect(second).toBe(first);
  expect(parseCount()).toBe(1);
});

test('reset 之后重新解析，次数继续累加', () => {
  const before = loadSettings();
  resetSettings();
  const after = loadSettings();
  expect(after).not.toBe(before);
  expect(after).toEqual({ theme: 'dark', fontSize: 16 });
  expect(parseCount()).toBe(2);
  expect(loadSettings()).toBe(after);
  expect(parseCount()).toBe(2);
});
```
```ts file=load.test-d.ts
import { expectTypeOf } from 'vitest';
import { loadSettings } from './load';
import type { Settings } from './settings';

expectTypeOf(loadSettings).returns.toEqualTypeOf<Settings>();
```
:::

:::hint{level=1}
在模块顶层增加一个变量保存缓存，类型是 `Settings | null`（`null` 表示还没有缓存）。`loadSettings` 只在缓存为 `null` 时解析。别忘了 TypeScript 报的导入错误。
:::

:::hint{level=2}
`let cached: Settings | null = null;`。`loadSettings` 里：`if (cached === null) { const parsed: Settings = JSON.parse(RAW_SETTINGS); count++; cached = parsed; } return cached;`。先赋给带类型注解的 `parsed` 再存入 `cached`，是因为直接把 `JSON.parse` 的结果（`any`）赋给 `cached` 时，TypeScript 不会因此认为它已经不是 `null` 了。`resetSettings` 把 `cached` 设回 `null`。
:::

:::explanation
模块只执行一次，所以模块顶层的 `cached` 和 `count` 在整个程序里只有一份：测试文件、其他模块导入 `load.ts` 时用到的是同一个缓存。如果把缓存变量写在 `loadSettings` **函数内部**，每次调用都会重新创建它，缓存就失去了意义。

TypeScript 的一个细节：把 `any` 类型的值赋给 `Settings | null` 变量后，TypeScript 只知道它“是声明的类型 `Settings | null`”，不会收窄成 `Settings`，于是 `return cached` 报错。先赋给带注解的 `const parsed: Settings`，再赋给 `cached`，它就被收窄成 `Settings` 了。

`Settings` 只用作类型，导入时要标明 `type`（`verbatimModuleSyntax`）。外部模块不能直接修改 `cached`：它没有被导出，即使导出了，导入方也不能给它重新赋值。
:::

:::variant{kind=alt name=undefined-sentinel}
```ts file=load.ts
import type { Settings } from './settings';
import { RAW_SETTINGS } from './settings';

let cached: Settings | undefined;
let parses = 0;

function parse(): Settings {
  parses += 1;
  return JSON.parse(RAW_SETTINGS);
}

export function loadSettings(): Settings {
  cached ??= parse();
  return cached;
}

export function parseCount(): number {
  return parses;
}

export function resetSettings(): void {
  cached = undefined;
}
```
:::

:::variant{kind=wrong name=parse-every-time fails=tests reason="每次调用都重新解析"}
```ts file=load.ts
import { RAW_SETTINGS, type Settings } from './settings';

let count = 0;

export function loadSettings(): Settings {
  count++;
  const parsed: Settings = JSON.parse(RAW_SETTINGS);
  return parsed;
}

export function parseCount(): number {
  return count;
}

export function resetSettings(): void {}
```
:::

:::variant{kind=wrong name=local-cache fails=tests reason="缓存变量写在函数内部，每次调用都重新创建"}
```ts file=load.ts
import { RAW_SETTINGS, type Settings } from './settings';

let count = 0;

export function loadSettings(): Settings {
  let cached: Settings | null = null;
  if (cached === null) {
    const parsed: Settings = JSON.parse(RAW_SETTINGS);
    count++;
    cached = parsed;
  }
  return cached;
}

export function parseCount(): number {
  return count;
}

export function resetSettings(): void {}
```
:::

:::variant{kind=wrong name=reset-noop fails=tests reason="resetSettings 没有清除缓存"}
```ts file=load.ts
import { RAW_SETTINGS, type Settings } from './settings';

let cached: Settings | null = null;
let count = 0;

export function loadSettings(): Settings {
  if (cached === null) {
    const parsed: Settings = JSON.parse(RAW_SETTINGS);
    count++;
    cached = parsed;
  }
  return cached;
}

export function parseCount(): number {
  return count;
}

export function resetSettings(): void {}
```
:::

:::variant{kind=wrong name=value-import-of-type fails=types reason="导入类型时没有写 type"}
```ts file=load.ts
import { RAW_SETTINGS, Settings } from './settings';

let cached: Settings | null = null;
let count = 0;

export function loadSettings(): Settings {
  if (cached === null) {
    const parsed: Settings = JSON.parse(RAW_SETTINGS);
    count++;
    cached = parsed;
  }
  return cached;
}

export function parseCount(): number {
  return count;
}

export function resetSettings(): void {
  cached = null;
}
```
:::
