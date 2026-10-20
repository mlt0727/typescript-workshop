---
kind: task
title: 修好只导入类型的 import
---
`registry.ts` 维护一张“格式化函数”的表；`plugins.ts` 在**被加载时**向表中注册三个函数（`upper`、`reverse`、`trim`），并导出它们的名字组成的类型 `PluginName`。这两个文件是只读的。

`app.ts` 在开启了 `verbatimModuleSyntax` 的配置下有两个 TS1484 错误。只修改 `app.ts` 开头的 `import`，让它通过类型检查，并且 `pipeline` 能正常工作（不要修改 `pipeline` 的签名和实现，也不要在 `app.ts` 中自己注册格式化函数）。

:::files{role=support}
```ts file=registry.ts readonly
export type Formatter = (text: string) => string;

const formatters = new Map<string, Formatter>();

export function register(name: string, formatter: Formatter): void {
  formatters.set(name, formatter);
}

export function format(name: string, text: string): string {
  const formatter = formatters.get(name);
  if (formatter === undefined) throw new Error(`没有注册格式化函数：${name}`);
  return formatter(text);
}
```
```ts file=plugins.ts readonly
import { register } from './registry';

/** 这个模块注册的格式化函数的名字 */
export type PluginName = 'upper' | 'reverse' | 'trim';

// 副作用：模块被加载时注册三个格式化函数
register('upper', (text) => text.toUpperCase());
register('reverse', (text) => [...text].reverse().join(''));
register('trim', (text) => text.trim());
```
```ts file=main.ts readonly
import { pipeline } from './app';

console.log(pipeline(['trim', 'reverse', 'upper'])('  stressed  '));
```
:::

:::files{role=starter}
```ts file=app.ts
import { format, Formatter } from './registry';
import { PluginName } from './plugins';

/** 依次应用几个格式化函数 */
export function pipeline(names: readonly PluginName[]): Formatter {
  return (text) => names.reduce((result, name) => format(name, result), text);
}
```
:::

:::files{role=solution}
```ts file=app.ts
import { format, type Formatter } from './registry';
// 不能写 import type：那样整行会被去掉，plugins.ts 不会被加载，三个函数也就没有注册
import { type PluginName } from './plugins';

/** 依次应用几个格式化函数 */
export function pipeline(names: readonly PluginName[]): Formatter {
  return (text) => names.reduce((result, name) => format(name, result), text);
}
```
:::

:::files{role=tests}
```ts file=app.test.ts
import { expect, test } from 'vitest';
import { pipeline } from './app';

test('依次应用格式化函数', () => {
  expect(pipeline(['trim', 'upper'])('  vite  ')).toBe('VITE');
  expect(pipeline(['reverse'])('abc')).toBe('cba');
  expect(pipeline(['trim', 'reverse', 'upper'])('  stressed  ')).toBe('DESSERTS');
});

test('没有格式化函数时原样返回', () => {
  expect(pipeline([])('原样')).toBe('原样');
});
```
```ts file=app.test-d.ts
import { expectTypeOf } from 'vitest';
import { pipeline } from './app';
import type { PluginName } from './plugins';
import type { Formatter } from './registry';

expectTypeOf(pipeline).parameter(0).toEqualTypeOf<readonly PluginName[]>();
expectTypeOf(pipeline(['upper'])).toEqualTypeOf<Formatter>();
// @ts-expect-error 没有这个格式化函数
pipeline(['shout']);
```
:::

:::hint{level=1}
`Formatter` 和 `PluginName` 都只用作类型，要标记 `type`；`format` 是在运行时调用的函数，不能标记。有两种写法：整句 `import type { … }`，或者只在名字前面写 `type`：`import { type … }`。两种写法在输出的 JavaScript 中不一样，正文的表格列出了区别。
:::

:::hint{level=2}
`app.ts` 是唯一加载 `plugins.ts` 的地方，而 `plugins.ts` 的注册是**加载时的副作用**。写成 `import type { PluginName } from './plugins'` 时整行被去掉，`plugins.ts` 根本不会执行。写成 `import { type PluginName } from './plugins'`，输出中留下 `import {} from './plugins'`；或者 `import type` 之外另加一行 `import './plugins'`。
:::

:::explanation
两个 TS1484 的原因相同：`verbatimModuleSyntax` 要求只用于类型的导入写出 `type`，这样转译工具不需要看其他文件，就知道哪些导入可以去掉。

`registry.ts` 的那一行怎么写都可以，因为 `format` 本身就让这个模块一定会被加载。`plugins.ts` 的那一行才是关键：`app.ts` 只用到了它的**类型**，却依赖它的**副作用**（加载时注册格式化函数）。

- `import type { PluginName } from './plugins'`：类型检查通过，但这一行在输出中完全消失，`plugins.ts` 不会被加载，运行时 `format('upper', …)` 抛出“没有注册格式化函数”；
- `import { type PluginName } from './plugins'`：输出中留下 `import {} from './plugins'`，模块被加载，副作用发生。

依赖副作用时，更清楚的写法是把它单独写出来：`import './plugins';`，再用 `import type` 导入类型。读代码的人一眼就能看出“这里需要加载这个模块”。

更好的设计是让依赖显式化（例如导出一个 `registerDefaultPlugins()` 函数，由入口调用），而不是依靠导入的副作用。但很多库（样式、polyfill、插件）就是靠导入的副作用工作的，所以要知道这两种 `type` 写法的区别。
:::

:::variant{kind=alt name=explicit-side-effect}
```ts file=app.ts
import type { Formatter } from './registry';
import type { PluginName } from './plugins';
import { format } from './registry';
// 依赖 plugins.ts 加载时的注册
import './plugins';

/** 依次应用几个格式化函数 */
export function pipeline(names: readonly PluginName[]): Formatter {
  return (text) => names.reduce((result, name) => format(name, result), text);
}
```
:::

:::variant{kind=wrong name=import-type-plugins fails=tests reason="用 import type 导入 plugins：整行被去掉，plugins.ts 没有加载，格式化函数没有注册"}
```ts file=app.ts
import { format, type Formatter } from './registry';
import type { PluginName } from './plugins';

/** 依次应用几个格式化函数 */
export function pipeline(names: readonly PluginName[]): Formatter {
  return (text) => names.reduce((result, name) => format(name, result), text);
}
```
:::

:::variant{kind=wrong name=import-type-value fails=types reason="把运行时要调用的 format 也写进了 import type（TS1361）"}
```ts file=app.ts
import type { format, Formatter } from './registry';
import { type PluginName } from './plugins';

/** 依次应用几个格式化函数 */
export function pipeline(names: readonly PluginName[]): Formatter {
  return (text) => names.reduce((result, name) => format(name, result), text);
}
```
:::

:::variant{kind=wrong name=drop-the-type fails=types reason="为了绕开错误把 PluginName 换成了 string：不存在的名字也能通过检查"}
```ts file=app.ts
import { format, type Formatter } from './registry';
import './plugins';

/** 依次应用几个格式化函数 */
export function pipeline(names: readonly string[]): Formatter {
  return (text) => names.reduce((result, name) => format(name, result), text);
}
```
:::
