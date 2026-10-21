---
kind: task
title: 解析错误的堆栈
---
在 `stack.ts` 中实现两个函数，把浏览器给出的 `error.stack` 解析成结构化的数据（错误监控工具做的第一步就是这个）。格式以正文中 Chromium 和 Safari 实际输出的堆栈为准。

**`parseStackLine(text)`**：解析堆栈中的一行，返回 `{ fn, url, line, column }`，不是调用栈中的一层时返回 `null`。先去掉首尾空白，然后：

1. **Chromium 格式**，以 `at ` 开头：
   - 去掉 `at ` 之后，如果开头是 `async `，也去掉；
   - 形如 `名字 (位置)` 时，`fn` 是括号前面的全部文字（例如 `new Point`、`Object.method`）；否则整个就是位置，`fn` 是 `null`；
2. **Safari 格式**，含有 `@`：第一个 `@` 前面是名字，后面是位置（地址中也可能有 `@`，例如 Vite 的 `/@vite/client`）。名字开头的 `async ` 也去掉（Safari 中 `await` 之后的那一层同样带 `async `）。名字为空、或者是 `module code`、`global code`（Safari 用它们表示顶层）时，`fn` 是 `null`；
3. **位置**的格式是 `地址:行:列`，行和列是末尾的两个数字（地址中也有冒号，例如 `http://`、`C:\`）。位置不是这种格式（`<anonymous>`、`[native code]`）时整行返回 `null`；
4. 两种格式都不是（错误信息那一行、空行）时返回 `null`。

**`parseStack(stack)`**：按换行切分，解析每一行，只保留解析成功的。

:::files{role=starter}
```ts file=stack.ts
export type StackFrame = { fn: string | null; url: string; line: number; column: number };

export function parseStackLine(text: string): StackFrame | null {
  const [url = '', line = '0', column = '0'] = text.trim().split(':');
  return { fn: null, url, line: Number(line), column: Number(column) };
}

export function parseStack(stack: string): StackFrame[] {
  return [];
}
```
```ts file=main.ts
import { parseStack } from './stack';

function add(a: number, b: number): number {
  if (Number.isNaN(a + b)) throw new Error('不是数字');
  return a + b;
}

try {
  add(1, Number('x'));
} catch (error) {
  if (error instanceof Error) console.log(parseStack(error.stack ?? ''));
}
```
:::

:::files{role=solution}
```ts file=stack.ts
export type StackFrame = { fn: string | null; url: string; line: number; column: number };

/** 地址:行:列；行和列是末尾的两个数字（地址本身也可能含有冒号） */
function parseLocation(location: string): Omit<StackFrame, 'fn'> | null {
  const match = /^(.+):(\d+):(\d+)$/.exec(location);
  if (match === null) return null; // <anonymous>、[native code] 等
  const [, url = '', line = '', column = ''] = match;
  return { url, line: Number(line), column: Number(column) };
}

/** Safari 用它们表示模块或脚本的顶层 */
const TOP_LEVEL = new Set(['', 'module code', 'global code']);

export function parseStackLine(text: string): StackFrame | null {
  const line = text.trim();

  // Chromium：at 函数名 (位置) 或 at 位置
  if (line.startsWith('at ')) {
    const rest = line.slice(3).replace(/^async /, '');
    const named = /^(.*) \((.*)\)$/.exec(rest);
    const fn = named ? (named[1] ?? null) : null;
    const location = parseLocation(named ? (named[2] ?? '') : rest);
    return location && { fn, ...location };
  }

  // Safari：函数名@位置。位置中也可能有 @（例如 Vite 的 /@vite/client），所以按第一个 @ 分开
  const at = line.indexOf('@');
  if (at === -1) return null;
  const name = line.slice(0, at).replace(/^async /, '');
  const location = parseLocation(line.slice(at + 1));
  return location && { fn: TOP_LEVEL.has(name) ? null : name, ...location };
}

export function parseStack(stack: string): StackFrame[] {
  return stack.split('\n').flatMap((text) => {
    const frame = parseStackLine(text);
    return frame === null ? [] : [frame];
  });
}
```
```ts file=main.ts
import { parseStack } from './stack';

function add(a: number, b: number): number {
  if (Number.isNaN(a + b)) throw new Error('不是数字');
  return a + b;
}

try {
  add(1, Number('x'));
} catch (error) {
  if (error instanceof Error) console.log(parseStack(error.stack ?? ''));
}
```
:::

:::files{role=tests}
```ts file=stack.test.ts
import { describe, expect, test } from 'vitest';
import { parseStack, parseStackLine } from './stack';

// 用 Chromium 和 WebKit 实际运行同一段代码得到的 error.stack
const chromium = [
  'Error: in map',
  '    at inMap (http://localhost:5398/src/main.js:12:45)',
  '    at Array.map (<anonymous>)',
  '    at http://localhost:5398/src/main.js:12:15',
].join('\n');
const webkit = ['inMap@http://localhost:5398/src/main.js:12:54', 'map@[native code]', 'module code@http://localhost:5398/src/main.js:12:18'].join('\n');

describe('parseStackLine：Chromium', () => {
  test('有名字的函数', () => {
    expect(parseStackLine('    at add (http://localhost:5398/src/main.js:2:29)')).toEqual({ fn: 'add', url: 'http://localhost:5398/src/main.js', line: 2, column: 29 });
  });

  test('构造函数、方法、async', () => {
    expect(parseStackLine('    at new Point (http://localhost:5398/src/main.js:3:44)')).toMatchObject({ fn: 'new Point', line: 3, column: 44 });
    expect(parseStackLine('    at Object.method (http://localhost:5398/src/main.js:4:33)')).toMatchObject({ fn: 'Object.method' });
    expect(parseStackLine('    at async loadUser (http://localhost:5173/src/api.ts:12:5)')).toEqual({ fn: 'loadUser', url: 'http://localhost:5173/src/api.ts', line: 12, column: 5 });
  });

  test('没有名字：只有位置', () => {
    expect(parseStackLine('    at http://localhost:5398/src/main.js:8:10')).toEqual({ fn: null, url: 'http://localhost:5398/src/main.js', line: 8, column: 10 });
    expect(parseStackLine('    at async http://localhost:5398/src/main.js:14:10')).toEqual({ fn: null, url: 'http://localhost:5398/src/main.js', line: 14, column: 10 });
  });

  test('Node.js 的路径', () => {
    expect(parseStackLine('    at add (C:\\Users\\ada\\app\\math.js:2:29)')).toEqual({ fn: 'add', url: 'C:\\Users\\ada\\app\\math.js', line: 2, column: 29 });
    expect(parseStackLine('    at ModuleJob.run (node:internal/modules/esm/module_job:371:25)')).toMatchObject({ fn: 'ModuleJob.run', url: 'node:internal/modules/esm/module_job', line: 371 });
  });

  test('不是调用栈的一层时返回 null', () => {
    for (const text of ['Error: in map', '    at Array.map (<anonymous>)', '', '   ', 'TypeError: x is not a function']) {
      expect(parseStackLine(text), JSON.stringify(text)).toBeNull();
    }
  });
});

describe('parseStackLine：Safari', () => {
  test('函数名@位置', () => {
    expect(parseStackLine('add@http://localhost:5398/src/main.js:2:38')).toEqual({ fn: 'add', url: 'http://localhost:5398/src/main.js', line: 2, column: 38 });
    expect(parseStackLine('Point@http://localhost:5398/src/main.js:3:53')).toMatchObject({ fn: 'Point', line: 3 });
  });

  test('await 之后的一层：去掉 async', () => {
    expect(parseStackLine('async loadUser@http://localhost:5398/src/main.js:4:40')).toEqual({ fn: 'loadUser', url: 'http://localhost:5398/src/main.js', line: 4, column: 40 });
  });

  test('顶层与匿名函数没有名字', () => {
    expect(parseStackLine('module code@http://localhost:5398/src/main.js:8:13')).toEqual({ fn: null, url: 'http://localhost:5398/src/main.js', line: 8, column: 13 });
    expect(parseStackLine('global code@http://localhost:5398/legacy.js:1:7')).toMatchObject({ fn: null, line: 1 });
    expect(parseStackLine('@http://localhost:5398/src/main.js:6:30')).toMatchObject({ fn: null, line: 6, column: 30 });
  });

  test('地址中的 @', () => {
    expect(parseStackLine('connect@http://localhost:5173/@vite/client:802:21')).toEqual({ fn: 'connect', url: 'http://localhost:5173/@vite/client', line: 802, column: 21 });
    expect(parseStackLine('@http://localhost:5173/@fs/C:/app/src/main.ts:3:9')).toEqual({ fn: null, url: 'http://localhost:5173/@fs/C:/app/src/main.ts', line: 3, column: 9 });
  });

  test('内置函数返回 null', () => {
    expect(parseStackLine('map@[native code]')).toBeNull();
  });
});

describe('parseStack', () => {
  test('Chromium：跳过错误信息和内置函数', () => {
    expect(parseStack(chromium)).toEqual([
      { fn: 'inMap', url: 'http://localhost:5398/src/main.js', line: 12, column: 45 },
      { fn: null, url: 'http://localhost:5398/src/main.js', line: 12, column: 15 },
    ]);
  });

  test('Safari', () => {
    expect(parseStack(webkit)).toEqual([
      { fn: 'inMap', url: 'http://localhost:5398/src/main.js', line: 12, column: 54 },
      { fn: null, url: 'http://localhost:5398/src/main.js', line: 12, column: 18 },
    ]);
  });

  test('空的堆栈', () => {
    expect(parseStack('')).toEqual([]);
  });
});
```
:::

:::hint{level=1}
先写一个 `parseLocation(location)`，用正则 `/^(.+):(\d+):(\d+)$/`：`.+` 是贪婪的，会尽量多地匹配，于是最后两个 `:数字` 留给了行和列，地址中的冒号都归入 `.+`。然后在 `parseStackLine` 中分两种格式，取出名字和位置的文字，再交给 `parseLocation`。
:::

:::hint{level=2}
Chromium 的 `名字 (位置)` 可以用 `/^(.*) \((.*)\)$/` 判断；不匹配时整个都是位置。Safari 用 `indexOf('@')`（第一个），不要用 `split('@')`，否则地址中的 `@` 也会被切开。`parseStack` 可以用 `flatMap`：解析成功返回 `[frame]`，失败返回 `[]`。
:::

:::explanation
堆栈的格式没有标准，每个浏览器各不相同，所以 Sentry 这类错误监控工具要先按浏览器解析，再用 source map（下面的编程挑战）把位置换成源文件的位置。

几个容易出错的地方：

- **地址中的冒号**：`http://localhost:5173/src/main.ts:12:5` 中有三个冒号，按冒号切分得到的是 `http`、`//localhost`、`5173/src/main.ts`。从末尾匹配“两个数字”才对，正则中贪婪的 `.+` 正好做到了这一点；
- **地址中的 `@`**：Vite 开发服务器的地址 `/@vite/client`、`/@fs/…` 中有 `@`。Safari 格式中函数名不会含有 `@`，所以按**第一个** `@` 分开是安全的；
- **没有位置的层**：`Array.map (<anonymous>)`、`map@[native code]` 是浏览器内置的函数，没有源文件可以对应，直接跳过；
- **不同的名字**：Chromium 的 `new Point`、`Object.method`，Safari 只有 `Point`、`method`。这里保留原样，不尝试统一。

返回 `null` 表示“这一行不是调用栈中的一层”，`parseStack` 用 `flatMap` 把它们去掉，结果的类型是 `StackFrame[]`，不含 `null`。
:::

:::variant{kind=alt name=two-regexes}
```ts file=stack.ts
export type StackFrame = { fn: string | null; url: string; line: number; column: number };

const CHROMIUM = /^at (?:async )?(?:(.*) \((.+):(\d+):(\d+)\)|(.+):(\d+):(\d+))$/;
const SAFARI = /^(?:async )?([^@]*)@(.+):(\d+):(\d+)$/;

function frame(fn: string | undefined, url: string | undefined, line: string | undefined, column: string | undefined): StackFrame | null {
  if (url === undefined || line === undefined || column === undefined) return null;
  const name = fn === undefined || fn === '' || fn === 'module code' || fn === 'global code' ? null : fn;
  return { fn: name, url, line: parseInt(line, 10), column: parseInt(column, 10) };
}

export function parseStackLine(text: string): StackFrame | null {
  const line = text.trim();
  const c = CHROMIUM.exec(line);
  if (c) return c[2] !== undefined ? frame(c[1], c[2], c[3], c[4]) : frame(undefined, c[5], c[6], c[7]);
  if (line.startsWith('at ')) return null;
  const s = SAFARI.exec(line);
  return s ? frame(s[1], s[2], s[3], s[4]) : null;
}

export function parseStack(stack: string): StackFrame[] {
  const frames: StackFrame[] = [];
  for (const text of stack.split('\n')) {
    const parsed = parseStackLine(text);
    if (parsed) frames.push(parsed);
  }
  return frames;
}
```
:::

:::variant{kind=wrong name=split-on-colons fails=tests reason="按冒号切分位置：http://localhost:5173/… 中的冒号让地址、行、列都错了"}
```ts file=stack.ts
export type StackFrame = { fn: string | null; url: string; line: number; column: number };

/** 地址:行:列；行和列是末尾的两个数字（地址本身也可能含有冒号） */
function parseLocation(location: string): Omit<StackFrame, 'fn'> | null {
  const [url = '', line = '', column = ''] = location.split(':');
  if (line === '' || column === '') return null;
  return { url, line: Number(line), column: Number(column) };
}

/** Safari 用它们表示模块或脚本的顶层 */
const TOP_LEVEL = new Set(['', 'module code', 'global code']);

export function parseStackLine(text: string): StackFrame | null {
  const line = text.trim();

  // Chromium：at 函数名 (位置) 或 at 位置
  if (line.startsWith('at ')) {
    const rest = line.slice(3).replace(/^async /, '');
    const named = /^(.*) \((.*)\)$/.exec(rest);
    const fn = named ? (named[1] ?? null) : null;
    const location = parseLocation(named ? (named[2] ?? '') : rest);
    return location && { fn, ...location };
  }

  // Safari：函数名@位置。位置中也可能有 @（例如 Vite 的 /@vite/client），所以按第一个 @ 分开
  const at = line.indexOf('@');
  if (at === -1) return null;
  const name = line.slice(0, at).replace(/^async /, '');
  const location = parseLocation(line.slice(at + 1));
  return location && { fn: TOP_LEVEL.has(name) ? null : name, ...location };
}

export function parseStack(stack: string): StackFrame[] {
  return stack.split('\n').flatMap((text) => {
    const frame = parseStackLine(text);
    return frame === null ? [] : [frame];
  });
}
```
:::

:::variant{kind=wrong name=chromium-only fails=tests reason="只认识 Chromium 的格式：Safari 的堆栈一层也没有解析出来"}
```ts file=stack.ts
export type StackFrame = { fn: string | null; url: string; line: number; column: number };

/** 地址:行:列；行和列是末尾的两个数字（地址本身也可能含有冒号） */
function parseLocation(location: string): Omit<StackFrame, 'fn'> | null {
  const match = /^(.+):(\d+):(\d+)$/.exec(location);
  if (match === null) return null; // <anonymous>、[native code] 等
  const [, url = '', line = '', column = ''] = match;
  return { url, line: Number(line), column: Number(column) };
}

/** Safari 用它们表示模块或脚本的顶层 */
const TOP_LEVEL = new Set(['', 'module code', 'global code']);

export function parseStackLine(text: string): StackFrame | null {
  const line = text.trim();

  // Chromium：at 函数名 (位置) 或 at 位置
  if (line.startsWith('at ')) {
    const rest = line.slice(3).replace(/^async /, '');
    const named = /^(.*) \((.*)\)$/.exec(rest);
    const fn = named ? (named[1] ?? null) : null;
    const location = parseLocation(named ? (named[2] ?? '') : rest);
    return location && { fn, ...location };
  }

  return null;
}

export function parseStack(stack: string): StackFrame[] {
  return stack.split('\n').flatMap((text) => {
    const frame = parseStackLine(text);
    return frame === null ? [] : [frame];
  });
}
```
:::

:::variant{kind=wrong name=keeps-async fails=tests reason="保留了 async 前缀：函数名成了 async loadUser，地址也可能被当成了函数名"}
```ts file=stack.ts
export type StackFrame = { fn: string | null; url: string; line: number; column: number };

/** 地址:行:列；行和列是末尾的两个数字（地址本身也可能含有冒号） */
function parseLocation(location: string): Omit<StackFrame, 'fn'> | null {
  const match = /^(.+):(\d+):(\d+)$/.exec(location);
  if (match === null) return null; // <anonymous>、[native code] 等
  const [, url = '', line = '', column = ''] = match;
  return { url, line: Number(line), column: Number(column) };
}

/** Safari 用它们表示模块或脚本的顶层 */
const TOP_LEVEL = new Set(['', 'module code', 'global code']);

export function parseStackLine(text: string): StackFrame | null {
  const line = text.trim();

  // Chromium：at 函数名 (位置) 或 at 位置
  if (line.startsWith('at ')) {
    const rest = line.slice(3);
    const named = /^(.*) \((.*)\)$/.exec(rest);
    const fn = named ? (named[1] ?? null) : null;
    const location = parseLocation(named ? (named[2] ?? '') : rest);
    return location && { fn, ...location };
  }

  // Safari：函数名@位置。位置中也可能有 @（例如 Vite 的 /@vite/client），所以按第一个 @ 分开
  const at = line.indexOf('@');
  if (at === -1) return null;
  const name = line.slice(0, at);
  const location = parseLocation(line.slice(at + 1));
  return location && { fn: TOP_LEVEL.has(name) ? null : name, ...location };
}

export function parseStack(stack: string): StackFrame[] {
  return stack.split('\n').flatMap((text) => {
    const frame = parseStackLine(text);
    return frame === null ? [] : [frame];
  });
}
```
:::

:::variant{kind=wrong name=last-at fails=tests reason="按最后一个 @ 分开：Vite 开发服务器的地址 /@vite/client 中的 @ 被当成了分隔符"}
```ts file=stack.ts
export type StackFrame = { fn: string | null; url: string; line: number; column: number };

/** 地址:行:列；行和列是末尾的两个数字（地址本身也可能含有冒号） */
function parseLocation(location: string): Omit<StackFrame, 'fn'> | null {
  const match = /^(.+):(\d+):(\d+)$/.exec(location);
  if (match === null) return null; // <anonymous>、[native code] 等
  const [, url = '', line = '', column = ''] = match;
  return { url, line: Number(line), column: Number(column) };
}

/** Safari 用它们表示模块或脚本的顶层 */
const TOP_LEVEL = new Set(['', 'module code', 'global code']);

export function parseStackLine(text: string): StackFrame | null {
  const line = text.trim();

  // Chromium：at 函数名 (位置) 或 at 位置
  if (line.startsWith('at ')) {
    const rest = line.slice(3).replace(/^async /, '');
    const named = /^(.*) \((.*)\)$/.exec(rest);
    const fn = named ? (named[1] ?? null) : null;
    const location = parseLocation(named ? (named[2] ?? '') : rest);
    return location && { fn, ...location };
  }

  // Safari：函数名@位置。位置中也可能有 @（例如 Vite 的 /@vite/client），所以按第一个 @ 分开
  const at = line.lastIndexOf('@');
  if (at === -1) return null;
  const name = line.slice(0, at).replace(/^async /, '');
  const location = parseLocation(line.slice(at + 1));
  return location && { fn: TOP_LEVEL.has(name) ? null : name, ...location };
}

export function parseStack(stack: string): StackFrame[] {
  return stack.split('\n').flatMap((text) => {
    const frame = parseStackLine(text);
    return frame === null ? [] : [frame];
  });
}
```
:::

:::variant{kind=wrong name=module-code-as-name fails=tests reason="把 Safari 的 module code 当成了函数名"}
```ts file=stack.ts
export type StackFrame = { fn: string | null; url: string; line: number; column: number };

/** 地址:行:列；行和列是末尾的两个数字（地址本身也可能含有冒号） */
function parseLocation(location: string): Omit<StackFrame, 'fn'> | null {
  const match = /^(.+):(\d+):(\d+)$/.exec(location);
  if (match === null) return null; // <anonymous>、[native code] 等
  const [, url = '', line = '', column = ''] = match;
  return { url, line: Number(line), column: Number(column) };
}

/** Safari 用它们表示模块或脚本的顶层 */
const TOP_LEVEL = new Set(['']);

export function parseStackLine(text: string): StackFrame | null {
  const line = text.trim();

  // Chromium：at 函数名 (位置) 或 at 位置
  if (line.startsWith('at ')) {
    const rest = line.slice(3).replace(/^async /, '');
    const named = /^(.*) \((.*)\)$/.exec(rest);
    const fn = named ? (named[1] ?? null) : null;
    const location = parseLocation(named ? (named[2] ?? '') : rest);
    return location && { fn, ...location };
  }

  // Safari：函数名@位置。位置中也可能有 @（例如 Vite 的 /@vite/client），所以按第一个 @ 分开
  const at = line.indexOf('@');
  if (at === -1) return null;
  const name = line.slice(0, at).replace(/^async /, '');
  const location = parseLocation(line.slice(at + 1));
  return location && { fn: TOP_LEVEL.has(name) ? null : name, ...location };
}

export function parseStack(stack: string): StackFrame[] {
  return stack.split('\n').flatMap((text) => {
    const frame = parseStackLine(text);
    return frame === null ? [] : [frame];
  });
}
```
:::
