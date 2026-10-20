---
kind: challenge
title: 不要相信配置文件里的端口
---
`readPort(json)` 从一段 JSON 配置文本中读取端口号。起始代码“相信”了类型注解，结果在配置写错时会返回错误类型的值。

修改 `readPort`，按下面的规则返回端口：

- 配置对象的 `port` 字段是**数字**、是**整数**、并且在 **1 到 65535** 之间（含两端）时，返回它；
- 其他所有情况（字段缺失、是字符串 `"8080"`、是小数、超出范围、是 `null`……）都返回默认端口 `3000`。

说明：传入的 `json` 一定是合法的 JSON 对象文本（例如 `'{ "port": 8080 }'`）；判断整数可以用 `Number.isInteger(x)`。返回类型是 `number`，并且**实际返回的值也必须是数字**。

:::files{role=starter}
```ts file=config.ts
type Config = { port: number };

export function readPort(json: string): number {
  const config: Config = JSON.parse(json);
  return config.port;
}

console.log(readPort('{ "port": 8080 }'));
console.log(readPort('{ "port": "8080" }'));
```
:::

:::files{role=solution}
```ts file=config.ts
const DEFAULT_PORT = 3000;

export function readPort(json: string): number {
  const config = JSON.parse(json);
  const port = config.port;
  if (typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535) {
    return port;
  }
  return DEFAULT_PORT;
}

console.log(readPort('{ "port": 8080 }'));
console.log(readPort('{ "port": "8080" }'));
```
:::

:::files{role=tests}
```ts file=config.test.ts
import { describe, expect, test } from 'vitest';
import { readPort } from './config';

describe('readPort', () => {
  test('合法端口原样返回', () => {
    expect(readPort('{ "port": 8080 }')).toBe(8080);
    expect(readPort('{ "port": 1 }')).toBe(1);
    expect(readPort('{ "port": 65535 }')).toBe(65535);
  });

  test.each([
    ['字段缺失', '{}'],
    ['字符串形式的数字', '{ "port": "8080" }'],
    ['小数', '{ "port": 80.5 }'],
    ['0', '{ "port": 0 }'],
    ['超出范围', '{ "port": 70000 }'],
    ['负数', '{ "port": -1 }'],
    ['null', '{ "port": null }'],
    ['布尔值', '{ "port": true }'],
  ])('%s 时返回默认端口', (_name, json) => {
    expect(readPort(json)).toBe(3000);
  });

  test('返回值确实是数字', () => {
    expect(typeof readPort('{ "port": "8080" }')).toBe('number');
  });
});
```
```ts file=config.test-d.ts
import { expectTypeOf } from 'vitest';
import { readPort } from './config';

expectTypeOf(readPort).toEqualTypeOf<(json: string) => number>();
```
:::

:::hint{level=1}
类型注解 `config: Config` 不会检查任何东西。真正的检查要在运行时做：先取出 `port`，再用 `typeof` 等手段确认它满足全部条件，否则返回默认值。
:::

:::hint{level=2}
条件可以写成一个 `if`：`typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535`。注意顺序：先确认是数字，再做数值比较。不要用 `Number(port)` 转换——规则要求字符串 `"8080"` 也返回默认值。
:::

:::explanation
起始代码的问题是“把类型注解当成了检查”：`JSON.parse` 返回 `any`，TypeScript 无条件接受 `config: Config` 这个声明，于是 `readPort('{ "port": "8080" }')` 实际返回了字符串 `'8080'`，尽管函数签名写着返回 `number`。

参考答案在运行时逐项检查：`typeof port === 'number'` 排除了字符串、`null`、布尔值和字段缺失（`undefined`）；`Number.isInteger` 排除小数；最后检查范围。只有全部通过才返回 `port`。

这里的 `config` 和 `port` 其实都是 `any`（来自 `JSON.parse`），`typeof port === 'number'` 这个检查把 `port` 收窄成了 `number`。本平台的规则只禁止**显式写出** `any`；B 阶段会学习更安全的 `unknown`，它要求先检查才能使用。

参考答案没有再写 `Config` 类型：对来自外部的数据，在检查之前声称它是什么类型都没有意义。E 阶段会学习更系统的运行时校验方法。
:::

:::variant{kind=alt name=early-returns}
```ts file=config.ts
export function readPort(json: string): number {
  const port = JSON.parse(json).port;
  if (typeof port !== 'number') return 3000;
  if (!Number.isInteger(port)) return 3000;
  if (port < 1 || port > 65535) return 3000;
  return port;
}
```
:::

:::variant{kind=wrong name=trust-annotation fails=tests reason="仍然相信类型注解，没有运行时检查"}
```ts file=config.ts
type Config = { port: number };

export function readPort(json: string): number {
  const config: Config = JSON.parse(json);
  if (config.port >= 1 && config.port <= 65535) {
    return config.port;
  }
  return 3000;
}
```
:::

:::variant{kind=wrong name=coerce-string fails=tests reason="用 Number() 把字符串 \"8080\" 也转换成了端口"}
```ts file=config.ts
export function readPort(json: string): number {
  const port = Number(JSON.parse(json).port);
  if (Number.isInteger(port) && port >= 1 && port <= 65535) {
    return port;
  }
  return 3000;
}
```
:::

:::variant{kind=wrong name=no-range fails=tests reason="只检查了类型，没有检查范围"}
```ts file=config.ts
export function readPort(json: string): number {
  const port = JSON.parse(json).port;
  if (typeof port === 'number' && Number.isInteger(port)) {
    return port;
  }
  return 3000;
}
```
:::
