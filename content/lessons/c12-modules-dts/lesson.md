---
version: 1
mode: ts
estimatedMinutes: 50
review: self-reviewed
problem: 你用 npm 装了一个只有 JavaScript 的旧库，import 它时 TypeScript 报 TS7016，说找不到它的类型声明；Vite 项目中 import logo from './logo.svg' 却能通过检查，类型是 string；某个插件说“在你的项目中声明这个接口，就能得到类型提示”。这些背后都是声明文件（.d.ts）：只有类型、没有实现的 TypeScript 文件。这一课讲清楚 .d.ts 是什么、TypeScript 从哪里找到一个包的类型、怎样为没有类型的库写声明、全局声明与模块扩充（module augmentation）的写法，以及怎样从自己的代码生成 .d.ts。
objectives:
  - 说明 .d.ts 的作用，读懂 tsc --declaration 生成的声明文件
  - 知道 TypeScript 从包自己的 types、@types 包中寻找类型，并为没有类型的库编写 declare module 声明
  - 区分全局声明（脚本形式的 .d.ts、declare global）与模块声明，写出 Window 扩展、全局常量、通配模块的声明
  - 用模块扩充（declare module './模块'）为已有的接口增加成员，理解它在插件类库中的用途
references:
  - title: Declaration Files — Introduction — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/declaration-files/introduction.html
    checked: 2026-10-20
  - title: Modules .d.ts（Module Augmentation）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/declaration-merging.html#module-augmentation
    checked: 2026-10-20
  - title: isolatedDeclarations — TSConfig Reference
    url: https://www.typescriptlang.org/tsconfig/#isolatedDeclarations
    checked: 2026-10-20
  - title: Client Types（vite/client）— Vite
    url: https://vite.dev/guide/features#client-types
    checked: 2026-10-20
  - title: DefinitelyTyped — GitHub
    url: https://github.com/DefinitelyTyped/DefinitelyTyped
    checked: 2026-10-20
---

## 只有类型的文件

一个 `.ts` 文件既有类型又有实现。发布到 npm 的包通常是编译好的 JavaScript，使用它的人还需要知道类型，于是另外附上一个 **`.d.ts` 声明文件**：只有类型，没有实现。用 `tsc --declaration --emitDeclarationOnly` 编译下面的 `geometry.ts`：

```ts
export type Point = { x: number; y: number };
export function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
export const origin: Point = { x: 0, y: 0 };
const secret = 42;
export class Polygon {
  #points: Point[] = [];
  add(p: Point) { this.#points.push(p); return this; }
  get size() { return this.#points.length + secret * 0; }
}
```

TypeScript 6.0.3 实际生成的 `geometry.d.ts`：

```ts
export type Point = {
    x: number;
    y: number;
};
export declare function distance(a: Point, b: Point): number;
export declare const origin: Point;
export declare class Polygon {
    #private;
    add(p: Point): this;
    get size(): number;
}
```

- 函数体、变量的值都没有了，只剩签名；推断出的返回值类型（`number`、`this`）被写了出来；
- `declare` 表示“这个东西存在，实现在别处”；
- 没有导出的 `secret` 不出现；私有字段只剩下一个 `#private` 标记。

（TypeScript 6.0 起，当前文件夹中有 `tsconfig.json` 时，在命令行上直接写文件名会报 TS5112，要加 `--ignoreConfig`，或者把选项写进 `tsconfig.json`。）

更新的选项 `isolatedDeclarations`（TypeScript 5.5 起）要求导出的函数、方法、访问器都写出类型，这样构建工具不需要做类型推断，就能逐个文件地生成 `.d.ts`。对上面的文件实际得到 TS9007（函数需要写返回值类型）、TS9008（方法）和 TS9009（访问器）。

## TypeScript 从哪里找到一个包的类型

`import { format } from 'date-fns'` 时，TypeScript 依次查找：

1. **包自己的类型**：`package.json` 中的 `types`（或者 `exports` 中的 `types` 条件）指向的 `.d.ts`。现在的大多数包都自带类型；
2. **`@types` 包**：社区在 [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) 中为没有自带类型的包编写声明，以 `@types/包名` 发布，例如 `npm install --save-dev @types/lodash`；
3. 都没有：`strict` 下报 TS7016（找不到模块的声明文件，c10）。

这时你可以自己写一个声明文件，例如 `src/types/legacy-chart.d.ts`：

```ts
declare module 'legacy-chart' {
  export interface Point { x: number; y: number }
  export function createChart(target: string, points: readonly Point[]): { destroy(): void };
  export const version: string;
}
```

`declare module '包名' { … }` 描述这个包导出的内容，写在项目包含的任意一个 `.d.ts` 中即可（`tsconfig.json` 的 `include` 要包含它）。只写一行 `declare module 'legacy-chart';`（没有花括号）也能消除 TS7016，但从这个包导入的一切都是 `any`（c10），只适合作为临时的办法。

:::playground{#ambient-module run=skip}
```ts file=types.d.ts
declare module 'legacy-chart' {
  export interface Point { x: number; y: number }
  export function createChart(target: string, points: readonly Point[]): { destroy(): void };
  export const version: string;
}

declare module 'untyped-lib';
```
```ts file=main.ts
import { createChart, version } from 'legacy-chart';
import whatever from 'untyped-lib';

const chart = createChart('#chart', [{ x: 1, y: 2 }]);
chart.destroy();
console.log(version.toUpperCase());

whatever.anything.goes();
```
- 这个示例只看类型，不要运行：`legacy-chart` 和 `untyped-lib` 只存在于声明中，没有可以运行的实现。
- 把鼠标停在 `createChart`、`chart` 上，看到的是声明中写的类型；把第 4 行的 `y: 2` 改成 `y: '2'` 会报错。
- `whatever` 来自只有一行的简写声明，它的类型是 `any`：第 8 行随便写什么都不报错。（把鼠标停在 `whatever` 上，显示的是 `module "untyped-lib"`；写一行 `const w = whatever;`，再停在 `w` 上，就能看到 `any`。）
:::

## 全局声明

一个 `.d.ts` 文件中如果**没有**顶层的 `import`/`export`，它是“脚本”，其中的声明都是**全局**的：

```ts
// src/globals.d.ts
declare const __APP_VERSION__: string;

interface Window {
  appConfig: { apiBase: string };
}
```

- `declare const __APP_VERSION__`：配合 Vite 的 `define` 选项（构建时把 `__APP_VERSION__` 替换成一个值），告诉 TypeScript 这个全局常量的类型；
- `interface Window { … }`：接口会**合并**（b01 讲过的声明合并），这里给浏览器内置的 `Window` 加上一个属性，`window.appConfig.apiBase` 就有了类型。

在一个**模块**中（有 `import`/`export` 的文件，或者开启了 `moduleDetection: "force"` 的普通 `.ts` 文件）要写成 `declare global { … }`：

```ts
declare global {
  interface Window {
    appConfig: { apiBase: string };
  }
}
export {};
```

`vite/client`（f02、f03 中 `types` 选项引入的那个）正是这样一组全局声明。它的源码中有：

```ts
declare module '*.svg' {
  const src: string
  export default src
}
```

`'*.svg'` 是一个**通配模块**声明：任何以 `.svg` 结尾的导入，默认导出都是 `string`。`declare module '*.css' {}` 则让 `import './style.css'` 能通过检查。

## 模块扩充

`declare module` 后面写的如果是一个**已经存在**的模块（包名，或者 `'./bus'` 这样的相对路径），并且写在一个模块文件中，它就不是“声明一个新模块”，而是**扩充**这个模块：其中的接口与原来的接口合并。

```ts
// bus.ts
export interface AppEvents {}
export function emit<K extends keyof AppEvents>(type: K, payload: AppEvents[K]): void { /* … */ }

// cart.ts
import { emit } from './bus';

declare module './bus' {
  interface AppEvents {
    'cart:add': { sku: string };
  }
}

emit('cart:add', { sku: 'a' }); // ✓
emit('cart:add', { sku: 1 }); // TS2322
```

`bus.ts` 不需要知道有哪些事件，每个模块在自己的文件中把自己的事件加进 `AppEvents`。很多类库用这种方式让使用者扩展类型，例如 Vue 的 `ComponentCustomProperties`、Pinia 的插件。（Express 的 `Request` 用的是另一种写法：`declare global { namespace Express { interface Request { … } } }`，扩充的是全局的命名空间。）下面的编程挑战就是这样一个事件总线。

## 在这个网站上

练习中的 `.d.ts` 文件会参与类型检查，但不会被运行：声明中的模块并没有实现，导入它们的代码运行时会找不到模块。所以下面的小任务只做类型检查。

::exercise{#declare-legacy}

## 编程挑战

::exercise{#augment-events}

::quiz

## 常见错误

- **用 `declare module '包名';` 了事**：一切都是 `any`，等于关掉了检查。至少写出用到的那几个函数的类型。
- **在模块中直接写 `interface Window`**：模块中的声明是局部的，不会和全局的 `Window` 合并。用 `declare global { … }`，或者放进一个没有 `import`/`export` 的 `.d.ts`。
- **在全局的 `.d.ts` 中写了 `import`**：整个文件变成了模块，其中原来的全局声明全部失效。需要导入类型时用 `import('./x').Type` 这种写法，或者改成 `declare global`。
- **声明与实现不一致**：`.d.ts` 只是一个“承诺”，TypeScript 不会检查实现是否真的如此。自己写的声明要和库的文档、源码对照。
- **扩充写错了地方**：`declare module './bus'` 中的路径写错时，TypeScript 报 TS2664（找不到要扩充的模块），这还容易发现。更隐蔽的是把这段扩充写进一个没有 `import`/`export` 的 `.d.ts`：在那里，`declare module './bus' { … }` 是在声明一个新的模块，不报任何错误，`AppEvents` 也没有任何变化。模块扩充要写在模块文件中（文件中有 `import` 或 `export`）。
