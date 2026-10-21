---
kind: task
title: 为没有类型的库写声明
mode: dom
---
`legacy-chart` 是一个只有 JavaScript 的旧库，没有自带类型，也没有 `@types` 包。在 `legacy-chart.d.ts` 中用 `declare module 'legacy-chart' { … }` 为它写出声明（这道题只做类型检查）。它的文档：

- **默认导出** `createChart(target, options)`：`target` 是 CSS 选择器（字符串）或者一个 `HTMLElement`；`options` 有必需的 `type`（`'line'` 或 `'bar'`），可选的 `title`（字符串）和 `animate`（布尔值）。返回一个 `Chart`；
- `Chart` 有三个方法：`setData(points)`，参数是 `{ x: number; y: number }` 组成的数组，不会修改这个数组；`on(event, handler)`，`event` 是 `'click'` 时处理函数收到被点击的点，是 `'resize'` 时收到新的宽度和高度，返回一个取消监听的函数；`destroy()`；
- **具名导出** `version`（字符串）和 `themes`（主题名的数组，使用者不应该修改它）；
- 同时导出类型 `Point`、`ChartOptions`、`Chart`，供使用者 `import type`。

起始代码中只有一行简写的声明：TS7016 消失了，但导入的值都是 `any`，而导入**类型**（`import type { ChartOptions }`）则报 TS2709，类型测试全部失败。（这道题用 DOM 模式，因为声明中用到了 `HTMLElement`。）

:::files{role=support}
```html file=index.html readonly
<!doctype html>
<html lang="zh-CN">
  <body>
    <div id="chart"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
:::

:::files{role=starter}
```ts file=legacy-chart.d.ts
// legacy-chart 是一个没有类型的 JavaScript 库。下面这一行让导入不再报 TS7016，但导入的值都是 any，也无法导入类型
declare module 'legacy-chart';
```
```ts file=main.ts
import type { ChartOptions } from 'legacy-chart';

// 只导入类型：import type 在运行时整行被去掉，所以这个文件可以运行
const options: ChartOptions = { type: 'line', title: '访问量' };
console.log(options);
```
:::

:::files{role=solution}
```ts file=legacy-chart.d.ts
declare module 'legacy-chart' {
  export interface Point {
    x: number;
    y: number;
  }

  export interface ChartOptions {
    type: 'line' | 'bar';
    title?: string;
    animate?: boolean;
  }

  export interface Chart {
    setData(points: readonly Point[]): void;
    /** 返回取消监听的函数 */
    on(event: 'click', handler: (point: Point) => void): () => void;
    on(event: 'resize', handler: (width: number, height: number) => void): () => void;
    destroy(): void;
  }

  export default function createChart(target: string | HTMLElement, options: ChartOptions): Chart;
  export const version: string;
  export const themes: readonly string[];
}
```
```ts file=main.ts
import type { ChartOptions } from 'legacy-chart';

// 只导入类型：import type 在运行时整行被去掉，所以这个文件可以运行
const options: ChartOptions = { type: 'line', title: '访问量' };
console.log(options);
```
:::

:::files{role=tests}
```ts file=legacy-chart.test-d.ts
import { expectTypeOf } from 'vitest';
import createChart, { themes, version, type Chart, type ChartOptions, type Point } from 'legacy-chart';

declare const element: HTMLElement;

const chart = createChart('#chart', { type: 'line' });
expectTypeOf(chart).toEqualTypeOf<Chart>();
expectTypeOf(createChart(element, { type: 'bar', title: '销量', animate: false })).toEqualTypeOf<Chart>();
expectTypeOf<ChartOptions['type']>().toEqualTypeOf<'line' | 'bar'>();
expectTypeOf(version).toEqualTypeOf<string>();
expectTypeOf(themes).toEqualTypeOf<readonly string[]>();

chart.setData([{ x: 1, y: 2 }]);
// 库不会修改传入的数组：只读的数组也能传进去
const frozen: readonly Point[] = [{ x: 1, y: 2 }];
chart.setData(frozen);
// @ts-expect-error 点的坐标是数字
chart.setData([{ x: '1', y: 2 }]);
expectTypeOf<ChartOptions>().toEqualTypeOf<{ type: 'line' | 'bar'; title?: string; animate?: boolean }>();
const off = chart.on('click', (point) => {
  expectTypeOf(point).toEqualTypeOf<Point>();
});
expectTypeOf(off).toEqualTypeOf<() => void>();
const offResize = chart.on('resize', (width, height) => {
  expectTypeOf(width).toEqualTypeOf<number>();
  expectTypeOf(height).toEqualTypeOf<number>();
});
expectTypeOf(offResize).toEqualTypeOf<() => void>();
expectTypeOf(chart.destroy).returns.toEqualTypeOf<void>();

// @ts-expect-error type 只能是 line 或 bar
createChart('#chart', { type: 'pie' });
// @ts-expect-error 缺少 type
createChart('#chart', {});
// @ts-expect-error target 是选择器或元素
createChart(42, { type: 'line' });
// @ts-expect-error 没有 hover 事件
chart.on('hover', () => {});
// @ts-expect-error click 的处理函数收到的是一个点
chart.on('click', (width: number) => width);
// @ts-expect-error themes 是只读的
themes.push('dark');
```
:::

:::hint{level=1}
在 `declare module 'legacy-chart' { … }` 中，像写普通模块一样写 `export interface`、`export const`、`export default function`，只是不写实现：函数只有签名，常量只有类型。先写 `Point`、`ChartOptions`、`Chart` 三个接口，再写导出的函数和常量。
:::

:::hint{level=2}
`on` 有两种不同的参数组合，用**重载**（b11）表示：在接口中写两个同名的方法签名，一个是 `on(event: 'click', handler: (point: Point) => void): () => void`，另一个是 `'resize'` 的。“不应该修改”的数组用 `readonly string[]`。
:::

:::explanation
声明文件是对一个库的**描述**，TypeScript 完全相信它：写了 `version: string`，就不会再去检查库中是否真的有这个导出。所以写声明时要对照库的文档和源码，只写确实存在的东西。

这道题用到了几种前面讲过的类型工具：

- **重载**描述 `on`：事件名不同，处理函数的参数也不同。写成一个接受任意字符串的签名，`hover` 这样拼错的事件名就发现不了了；
- **可选属性**描述可以省略的选项；
- **`readonly` 数组**描述“不应该修改”：库返回的是内部的数组，调用方 `push` 一下就改坏了库的状态，声明中写成只读，编译器就会阻止它。

默认导出与具名导出要和库实际的导出方式一致，这对应的是运行时的行为。声明写成具名导出时，`import createChart from 'legacy-chart'` 这一行本身不报错（得到的是整个模块），调用 `createChart(…)` 时报 TS2349（这个表达式不能调用）。反过来，如果库实际是具名导出而声明写成了默认导出，类型检查能通过，运行时却会出错：ES 模块的库在加载时就报 `does not provide an export named 'default'`；CommonJS 的库，默认导入得到的是整个 `module.exports` 对象，调用它同样失败。

写好的声明可以放在项目中的 `src/types/` 之类的文件夹里；如果这个库还有别人在用，可以把它贡献给 DefinitelyTyped，以 `@types/legacy-chart` 发布。
:::

:::variant{kind=alt name=type-aliases}
```ts file=legacy-chart.d.ts
declare module 'legacy-chart' {
  type Point = { x: number; y: number };
  type ChartOptions = { type: 'line' | 'bar'; title?: string; animate?: boolean };
  type Chart = {
    setData: (points: readonly Point[]) => void;
    on: {
      (event: 'click', handler: (point: Point) => void): () => void;
      (event: 'resize', handler: (width: number, height: number) => void): () => void;
    };
    destroy: () => void;
  };

  function createChart(target: string | HTMLElement, options: ChartOptions): Chart;
  export default createChart;
  export type { Chart, ChartOptions, Point };
  export const version: string;
  export const themes: readonly string[];
}
```
:::

:::variant{kind=wrong name=named-export fails=types reason="把 createChart 写成了具名导出：文档中它是默认导出，默认导入得到的是整个模块，调用 createChart(…) 时报 TS2349"}
```ts file=legacy-chart.d.ts
declare module 'legacy-chart' {
  export interface Point {
    x: number;
    y: number;
  }

  export interface ChartOptions {
    type: 'line' | 'bar';
    title?: string;
    animate?: boolean;
  }

  export interface Chart {
    setData(points: readonly Point[]): void;
    /** 返回取消监听的函数 */
    on(event: 'click', handler: (point: Point) => void): () => void;
    on(event: 'resize', handler: (width: number, height: number) => void): () => void;
    destroy(): void;
  }

  export function createChart(target: string | HTMLElement, options: ChartOptions): Chart;
  export const version: string;
  export const themes: readonly string[];
}
```
:::

:::variant{kind=wrong name=required-options fails=types reason="title、animate 写成了必需的：只传 type 的调用通不过"}
```ts file=legacy-chart.d.ts
declare module 'legacy-chart' {
  export interface Point {
    x: number;
    y: number;
  }

  export interface ChartOptions {
    type: 'line' | 'bar';
    title: string;
    animate: boolean;
  }

  export interface Chart {
    setData(points: readonly Point[]): void;
    /** 返回取消监听的函数 */
    on(event: 'click', handler: (point: Point) => void): () => void;
    on(event: 'resize', handler: (width: number, height: number) => void): () => void;
    destroy(): void;
  }

  export default function createChart(target: string | HTMLElement, options: ChartOptions): Chart;
  export const version: string;
  export const themes: readonly string[];
}
```
:::

:::variant{kind=wrong name=loose-events fails=types reason="on 接受任意的事件名：hover 这样不存在的事件也能通过检查"}
```ts file=legacy-chart.d.ts
declare module 'legacy-chart' {
  export interface Point {
    x: number;
    y: number;
  }

  export interface ChartOptions {
    type: 'line' | 'bar';
    title?: string;
    animate?: boolean;
  }

  export interface Chart {
    setData(points: readonly Point[]): void;
    /** 返回取消监听的函数 */
    on(event: string, handler: (...args: never[]) => void): () => void;
    destroy(): void;
  }

  export default function createChart(target: string | HTMLElement, options: ChartOptions): Chart;
  export const version: string;
  export const themes: readonly string[];
}
```
:::

:::variant{kind=wrong name=mutable-themes fails=types reason="themes 写成了 string[]：调用方可以 push，修改库内部的数组"}
```ts file=legacy-chart.d.ts
declare module 'legacy-chart' {
  export interface Point {
    x: number;
    y: number;
  }

  export interface ChartOptions {
    type: 'line' | 'bar';
    title?: string;
    animate?: boolean;
  }

  export interface Chart {
    setData(points: readonly Point[]): void;
    /** 返回取消监听的函数 */
    on(event: 'click', handler: (point: Point) => void): () => void;
    on(event: 'resize', handler: (width: number, height: number) => void): () => void;
    destroy(): void;
  }

  export default function createChart(target: string | HTMLElement, options: ChartOptions): Chart;
  export const version: string;
  export const themes: string[];
}
```
:::

:::variant{kind=wrong name=shorthand fails=types reason="只写了简写的声明：一切都是 any，expectTypeOf 和 @ts-expect-error 都会报错"}
```ts file=legacy-chart.d.ts
// legacy-chart 是一个没有类型的 JavaScript 库。下面这一行让导入不再报 TS7016，但导入的值都是 any，也无法导入类型
declare module 'legacy-chart';
```
:::
