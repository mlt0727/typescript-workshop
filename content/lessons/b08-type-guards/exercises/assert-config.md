---
kind: challenge
title: 用断言函数校验配置
---
服务启动时读取配置，配置有错就应该立刻停止并说明原因。实现断言函数 `assertConfig(value)`，返回类型为 `asserts value is Config`：

```ts
type Config = { name: string; port: number; tags: string[] };
```

按顺序检查，第一个不满足的条件抛出对应的错误：

| 条件 | 错误 |
| --- | --- |
| 是对象（不是 `null`，也不是数组） | `TypeError('配置必须是对象')` |
| `name` 是去掉空格后不为空的字符串 | `TypeError('name 必须是非空字符串')` |
| `port` 是 1 到 65535 的整数 | `RangeError('port 必须是 1–65535 的整数')`（为了简化，类型不是数字时也抛出这个错误） |
| `tags` 是数组，并且每个元素都是字符串 | `TypeError('tags 必须是字符串数组')` |

再实现 `loadConfig(json)`：解析 JSON，调用 `assertConfig`，返回一个**只包含** `name`、`port`、`tags` 的新对象（`name` 去掉首尾空格）。

:::files{role=starter}
```ts file=config.ts
export type Config = { name: string; port: number; tags: string[] };

export function assertConfig(value: unknown): boolean {
  return typeof value === 'object';
}

export function loadConfig(json: string): Config {
  const data = JSON.parse(json);
  assertConfig(data);
  return data;
}
```
:::

:::files{role=solution}
```ts file=config.ts
export type Config = { name: string; port: number; tags: string[] };

export function assertConfig(value: unknown): asserts value is Config {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('配置必须是对象');
  }
  const name = 'name' in value ? value.name : undefined;
  if (typeof name !== 'string' || name.trim() === '') {
    throw new TypeError('name 必须是非空字符串');
  }
  const port = 'port' in value ? value.port : undefined;
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RangeError('port 必须是 1–65535 的整数');
  }
  const tags = 'tags' in value ? value.tags : undefined;
  if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === 'string')) {
    throw new TypeError('tags 必须是字符串数组');
  }
}

export function loadConfig(json: string): Config {
  const data: unknown = JSON.parse(json);
  assertConfig(data);
  return { name: data.name.trim(), port: data.port, tags: [...data.tags] };
}
```
:::

:::files{role=tests}
```ts file=config.test.ts
import { describe, expect, test } from 'vitest';
import { assertConfig, loadConfig } from './config';

const good = { name: ' api ', port: 8080, tags: ['prod'] };

describe('assertConfig', () => {
  test('合法的配置不抛出错误', () => {
    expect(() => assertConfig(good)).not.toThrow();
    expect(() => assertConfig({ name: 'x', port: 1, tags: [] })).not.toThrow();
  });

  test.each([[null], [[]], ['config'], [42]])('%o 不是对象', (value) => {
    expect(() => assertConfig(value)).toThrow(TypeError);
    expect(() => assertConfig(value)).toThrow('配置必须是对象');
  });

  test('name', () => {
    expect(() => assertConfig({ ...good, name: '   ' })).toThrow('name 必须是非空字符串');
    expect(() => assertConfig({ port: 80, tags: [] })).toThrow('name 必须是非空字符串');
    expect(() => assertConfig({ ...good, name: 1 })).toThrow(TypeError);
  });

  test('port', () => {
    for (const port of [0, 65536, 80.5, '80', null]) {
      expect(() => assertConfig({ ...good, port: port })).toThrow(RangeError);
    }
  });

  test('tags', () => {
    expect(() => assertConfig({ ...good, tags: 'prod' })).toThrow('tags 必须是字符串数组');
    expect(() => assertConfig({ ...good, tags: ['a', 1] })).toThrow('tags 必须是字符串数组');
    expect(() => assertConfig({ name: 'x', port: 1 })).toThrow('tags 必须是字符串数组');
  });

  test('按顺序报告第一个错误', () => {
    expect(() => assertConfig({ name: '', port: 0, tags: 1 })).toThrow('name 必须是非空字符串');
  });
});

describe('loadConfig', () => {
  test('返回整理后的新对象', () => {
    expect(loadConfig('{ "name": " api ", "port": 8080, "tags": ["prod"], "secret": "x" }')).toEqual({
      name: 'api',
      port: 8080,
      tags: ['prod'],
    });
  });

  test('配置错误时抛出', () => {
    expect(() => loadConfig('{ "name": "api", "port": 99999, "tags": [] }')).toThrow(RangeError);
  });
});
```
```ts file=config.test-d.ts
import { expectTypeOf } from 'vitest';
import { assertConfig, type Config } from './config';

declare const value: unknown;
assertConfig(value);
expectTypeOf(value).toEqualTypeOf<Config>();
```
:::

:::hint{level=1}
返回类型写成 `asserts value is Config`，函数体里逐项检查，不满足就 `throw`，全部通过就什么也不返回。读取属性前先用 `'name' in value` 之类的检查（b07）；`tags` 的每个元素可以用 `every` 检查。
:::

:::hint{level=2}
先排除非对象：`typeof value !== 'object' || value === null || Array.isArray(value)`。然后 `const name = 'name' in value ? value.name : undefined;`，`name` 的类型是 `unknown`，再用 `typeof` 检查。`loadConfig` 里把 `JSON.parse` 的结果放进 `unknown` 变量，调用 `assertConfig(data)` 之后，`data` 就是 `Config` 了。
:::

:::explanation
断言函数的返回类型 `asserts value is Config` 表示：如果函数正常返回，`value` 就是 `Config`。所以 `loadConfig` 里调用 `assertConfig(data)` 之后，TypeScript 把 `data` 从 `unknown` 收窄成了 `Config`，可以直接读取 `data.name`、`data.tags`。

和类型守卫一样，TypeScript 相信断言函数的实现：如果漏掉了对 `tags` 元素的检查，类型检查照样通过，但 `['a', 1]` 会混进来——测试才能发现。

起始代码有两个问题：返回 `boolean` 的普通函数不会收窄任何东西；`loadConfig` 把 `JSON.parse` 的 `any` 直接返回，配置里多余的 `secret` 字段也被原样交了出去（b02）。参考答案把结果放进 `unknown` 变量，断言之后再明确地挑出需要的字段。
:::

:::variant{kind=alt name=helper-guards}
```ts file=config.ts
export type Config = { name: string; port: number; tags: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function assertConfig(value: unknown): asserts value is Config {
  if (!isRecord(value)) throw new TypeError('配置必须是对象');
  const { name, port, tags } = value;
  if (typeof name !== 'string' || name.trim().length === 0) throw new TypeError('name 必须是非空字符串');
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RangeError('port 必须是 1–65535 的整数');
  }
  if (!isStringArray(tags)) throw new TypeError('tags 必须是字符串数组');
}

export function loadConfig(json: string): Config {
  const parsed: unknown = JSON.parse(json);
  assertConfig(parsed);
  const { name, port, tags } = parsed;
  return { name: name.trim(), port, tags: tags.slice() };
}
```
:::

:::variant{kind=wrong name=boolean-function fails=types reason="返回 boolean 的函数不会收窄，loadConfig 中的 data 仍然是 unknown"}
```ts file=config.ts
export type Config = { name: string; port: number; tags: string[] };

export function assertConfig(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError('配置必须是对象');
  const name = 'name' in value ? value.name : undefined;
  if (typeof name !== 'string' || name.trim() === '') throw new TypeError('name 必须是非空字符串');
  const port = 'port' in value ? value.port : undefined;
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RangeError('port 必须是 1–65535 的整数');
  }
  const tags = 'tags' in value ? value.tags : undefined;
  if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === 'string')) throw new TypeError('tags 必须是字符串数组');
  return true;
}

export function loadConfig(json: string): Config {
  const data: unknown = JSON.parse(json);
  assertConfig(data);
  return { name: data.name.trim(), port: data.port, tags: [...data.tags] };
}
```
:::

:::variant{kind=wrong name=skip-tag-items fails=tests reason="只检查了 tags 是数组，没有检查每个元素"}
```ts file=config.ts
export type Config = { name: string; port: number; tags: string[] };

export function assertConfig(value: unknown): asserts value is Config {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError('配置必须是对象');
  const name = 'name' in value ? value.name : undefined;
  if (typeof name !== 'string' || name.trim() === '') throw new TypeError('name 必须是非空字符串');
  const port = 'port' in value ? value.port : undefined;
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RangeError('port 必须是 1–65535 的整数');
  }
  const tags = 'tags' in value ? value.tags : undefined;
  if (!Array.isArray(tags)) throw new TypeError('tags 必须是字符串数组');
}

export function loadConfig(json: string): Config {
  const data: unknown = JSON.parse(json);
  assertConfig(data);
  return { name: data.name.trim(), port: data.port, tags: [...data.tags] };
}
```
:::

:::variant{kind=wrong name=return-raw fails=tests reason="loadConfig 直接返回了解析结果，多余字段和首尾空格都没有处理"}
```ts file=config.ts
export type Config = { name: string; port: number; tags: string[] };

export function assertConfig(value: unknown): asserts value is Config {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError('配置必须是对象');
  const name = 'name' in value ? value.name : undefined;
  if (typeof name !== 'string' || name.trim() === '') throw new TypeError('name 必须是非空字符串');
  const port = 'port' in value ? value.port : undefined;
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RangeError('port 必须是 1–65535 的整数');
  }
  const tags = 'tags' in value ? value.tags : undefined;
  if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === 'string')) throw new TypeError('tags 必须是字符串数组');
}

export function loadConfig(json: string): Config {
  const data: unknown = JSON.parse(json);
  assertConfig(data);
  return data;
}
```
:::
