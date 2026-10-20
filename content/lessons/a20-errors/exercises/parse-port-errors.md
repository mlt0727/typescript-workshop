---
kind: challenge
title: 带说明的配置错误
---
a02 的挑战里，读不到合法端口时返回默认值。这一次换一种设计：端口是必填的，配置有问题时要**抛出错误**，并说明原因。实现两个函数：

**`parsePort(text)`**：`text` 是 JSON 配置文本。

- 不是合法的 JSON：抛出 `Error`，`message` 为 `'配置不是合法的 JSON'`，并把 `JSON.parse` 抛出的原始错误放在 `cause` 中；
- 是合法的 JSON，但解析结果不是对象（例如 `'42'`、`'null'`、`'"x"'`、`'[1]'`）：抛出 `TypeError`，`message` 为 `'配置必须是一个对象'`；
- 是对象，但 `port` 不是 1 到 65535 之间的整数（包括缺失）：抛出 `RangeError`，`message` 为 `` `端口无效：${String(port)}` ``，例如 `'端口无效：70000'`、`'端口无效：undefined'`；
- 否则返回端口号。

**`portOrNull(text)`**：调用 `parsePort`；成功时返回端口号，抛出任何错误时返回 `null`。

提示：判断“是对象”可以用 `typeof value === 'object' && value !== null && !Array.isArray(value)`（a02 讲过 `typeof null` 和数组的特殊情况）；读取属性时，把解析结果先放进类型为 `{ port?: unknown }` 的变量里。

:::files{role=starter}
```ts file=port.ts
export function parsePort(text: string): number {
  const config = JSON.parse(text);
  return config.port;
}

export function portOrNull(text: string): number | null {
  return parsePort(text);
}
```
:::

:::files{role=solution}
```ts file=port.ts
export function parsePort(text: string): number {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error('配置不是合法的 JSON', { cause: err });
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new TypeError('配置必须是一个对象');
  }

  const config: { port?: unknown } = data;
  const port = config.port;
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RangeError(`端口无效：${String(port)}`);
  }
  return port;
}

export function portOrNull(text: string): number | null {
  try {
    return parsePort(text);
  } catch {
    return null;
  }
}
```
:::

:::files{role=tests}
```ts file=port.test.ts
import { describe, expect, test } from 'vitest';
import { parsePort, portOrNull } from './port';

describe('parsePort', () => {
  test('合法的配置', () => {
    expect(parsePort('{ "port": 8080 }')).toBe(8080);
    expect(parsePort('{ "port": 1, "host": "x" }')).toBe(1);
  });

  test('不是合法的 JSON，保留原始错误', () => {
    expect(() => parsePort('{ port: 8080 }')).toThrow('配置不是合法的 JSON');
    let caught: unknown;
    try {
      parsePort('{');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    if (caught instanceof Error) {
      expect(caught.cause).toBeInstanceOf(SyntaxError);
    }
  });

  test.each([['42'], ['null'], ['"x"'], ['[1]']])('%s 不是对象', (text) => {
    expect(() => parsePort(text)).toThrow(TypeError);
    expect(() => parsePort(text)).toThrow('配置必须是一个对象');
  });

  test.each([
    ['{ "port": 70000 }', '端口无效：70000'],
    ['{ "port": "8080" }', '端口无效：8080'],
    ['{ "port": 0 }', '端口无效：0'],
    ['{ "port": 80.5 }', '端口无效：80.5'],
    ['{}', '端口无效：undefined'],
    ['{ "port": null }', '端口无效：null'],
  ])('%s 的端口无效', (text, message) => {
    expect(() => parsePort(text)).toThrow(RangeError);
    expect(() => parsePort(text)).toThrow(message);
  });
});

describe('portOrNull', () => {
  test('成功时返回端口', () => {
    expect(portOrNull('{ "port": 3000 }')).toBe(3000);
  });

  test('任何错误都返回 null', () => {
    expect(portOrNull('{')).toBeNull();
    expect(portOrNull('[]')).toBeNull();
    expect(portOrNull('{ "port": -1 }')).toBeNull();
  });
});
```
```ts file=port.test-d.ts
import { expectTypeOf } from 'vitest';
import { parsePort, portOrNull } from './port';

expectTypeOf(parsePort).toEqualTypeOf<(text: string) => number>();
expectTypeOf(portOrNull).toEqualTypeOf<(text: string) => number | null>();
```
:::

:::hint{level=1}
分三步检查，每一步失败就抛出对应的错误：先用 `try/catch` 包住 `JSON.parse`；再检查结果是不是对象；最后检查 `port`。`portOrNull` 用 `try/catch` 调用 `parsePort`。
:::

:::hint{level=2}
把解析结果存进 `let data: unknown;`（`JSON.parse` 返回 `any`，存进 `unknown` 变量后就必须先检查才能用）。对象检查通过后，`const config: { port?: unknown } = data;` 就可以读取 `config.port` 了。端口检查与 a02 相同：`typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535` 时抛出 `RangeError`。
:::

:::explanation
`try/catch` 只包住可能抛出 `SyntaxError` 的 `JSON.parse` 这一行，在 `catch` 里抛出新的 `Error` 并通过 `cause` 保留原始错误。范围更大的 `try` 会把后面主动抛出的 `TypeError`、`RangeError` 也捕获并错误地包装起来。

把解析结果存进 `unknown` 变量，是比直接使用 `any` 更安全的做法：TypeScript 会强迫你在使用前检查。`typeof data !== 'object' || data === null || Array.isArray(data)` 排除了所有不是普通对象的情况，之后 `data` 被收窄为 `object`，可以赋给 `{ port?: unknown }`。B 阶段会系统地讲 `unknown` 和收窄，E 阶段会介绍专门的运行时校验工具。

`portOrNull` 用不带变量的 `catch { … }`：它只关心“有没有出错”，不需要错误对象。这是“把异常转换成 `null`”的常见写法，让调用方按 a05 的方式处理。
:::

:::variant{kind=alt name=in-operator}
```ts file=port.ts
function invalidPort(port: unknown): never {
  throw new RangeError(`端口无效：${String(port)}`);
}

export function parsePort(text: string): number {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (cause) {
    throw new Error('配置不是合法的 JSON', { cause: cause });
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new TypeError('配置必须是一个对象');
  }
  const port = 'port' in data ? data.port : undefined;
  if (typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535) {
    return port;
  }
  return invalidPort(port);
}

export function portOrNull(text: string): number | null {
  let port: number | null = null;
  try {
    port = parsePort(text);
  } catch {
    // 配置有问题时按“没有端口”处理
  }
  return port;
}
```
:::

:::variant{kind=wrong name=no-cause fails=tests reason="包装错误时没有保留原始错误"}
```ts file=port.ts
export function parsePort(text: string): number {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('配置不是合法的 JSON');
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new TypeError('配置必须是一个对象');
  }
  const config: { port?: unknown } = data;
  const port = config.port;
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RangeError(`端口无效：${String(port)}`);
  }
  return port;
}

export function portOrNull(text: string): number | null {
  try {
    return parsePort(text);
  } catch {
    return null;
  }
}
```
:::

:::variant{kind=wrong name=wide-try fails=tests reason="try 包住了所有检查，TypeError 和 RangeError 也被包装成了“不是合法的 JSON”"}
```ts file=port.ts
export function parsePort(text: string): number {
  try {
    const data: unknown = JSON.parse(text);
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      throw new TypeError('配置必须是一个对象');
    }
    const config: { port?: unknown } = data;
    const port = config.port;
    if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
      throw new RangeError(`端口无效：${String(port)}`);
    }
    return port;
  } catch (err) {
    throw new Error('配置不是合法的 JSON', { cause: err });
  }
}

export function portOrNull(text: string): number | null {
  try {
    return parsePort(text);
  } catch {
    return null;
  }
}
```
:::

:::variant{kind=wrong name=array-is-object fails=tests reason="没有排除数组，[1] 被当成了对象"}
```ts file=port.ts
export function parsePort(text: string): number {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error('配置不是合法的 JSON', { cause: err });
  }
  if (typeof data !== 'object' || data === null) {
    throw new TypeError('配置必须是一个对象');
  }
  const config: { port?: unknown } = data;
  const port = config.port;
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RangeError(`端口无效：${String(port)}`);
  }
  return port;
}

export function portOrNull(text: string): number | null {
  try {
    return parsePort(text);
  } catch {
    return null;
  }
}
```
:::

:::variant{kind=wrong name=unknown-message fails=types reason="在 catch 里直接读取 unknown 的属性"}
```ts file=port.ts
export function parsePort(text: string): number {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error(`配置不是合法的 JSON：${err.message}`, { cause: err });
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new TypeError('配置必须是一个对象');
  }
  const config: { port?: unknown } = data;
  const port = config.port;
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RangeError(`端口无效：${String(port)}`);
  }
  return port;
}

export function portOrNull(text: string): number | null {
  try {
    return parsePort(text);
  } catch {
    return null;
  }
}
```
:::
