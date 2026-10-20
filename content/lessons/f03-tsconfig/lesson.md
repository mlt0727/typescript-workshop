---
version: 1
mode: ts
estimatedMinutes: 55
review: ai-draft
problem: 同一段 TypeScript，在 Vite 项目里能运行，放进 Node.js 项目就报“找不到模块”；import 一个类型，构建后浏览器却报“没有导出名为 User 的成员”；tsconfig.json 里十几个选项，复制来复制去，不知道哪些是必要的。这一课逐项读懂 Vite 模板的 tsconfig.json，讲清 verbatimModuleSyntax 与 import type 在运行时的区别，以及 moduleResolution 为 bundler 和 nodenext 时，import 路径的写法为什么不同。
objectives:
  - 读懂 tsconfig.json 的结构（include、compilerOptions），说出 lib、types、module、moduleResolution、noEmit 等选项的作用
  - 说明 verbatimModuleSyntax 下 import type、import { type X } 与普通 import 在输出的 JavaScript 中的区别
  - 区分 moduleResolution 为 bundler 与 nodenext 时相对导入的规则，知道 nodenext 中为什么写 .js 扩展名
  - 在本机用 tsc --showConfig 查看实际生效的配置，用 Node.js 直接运行 .ts 文件
references:
  - title: TSConfig Reference — TypeScript
    url: https://www.typescriptlang.org/tsconfig/
    checked: 2026-10-20
  - title: Modules — Theory（Module resolution）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/modules/theory.html
    checked: 2026-10-20
  - title: Modules — Choosing Compiler Options — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html
    checked: 2026-10-20
  - title: Running TypeScript Natively — Node.js
    url: https://nodejs.org/en/learn/typescript/run-natively
    checked: 2026-10-20
---

## tsconfig.json 是做什么的

在项目文件夹中运行 `tsc`（不带文件名），它会找到 `tsconfig.json`，按其中的设置检查项目。编辑器（VS Code 等）也读同一个文件，所以编辑器中显示的错误和 `tsc` 报告的一致。它的结构很简单：

```json
{
  "compilerOptions": { "strict": true, "noEmit": true },
  "include": ["src"]
}
```

- `include`：哪些文件属于这个项目（`src` 表示 `src` 文件夹下的所有 `.ts`/`.tsx` 文件）；
- `compilerOptions`：怎样检查、要不要输出、输出成什么样。

没有写的选项取默认值，而默认值会随 TypeScript 版本变化（c11 讲过，6.0 起 `strict` 默认开启）。想看实际生效的完整配置，运行 `npx tsc --showConfig`。

## 逐项读 Vite 模板的配置

f02 用 create-vite 创建的项目中，`tsconfig.json` 是这样的（create-vite 9.3.1）：

```json
{
  "compilerOptions": {
    "target": "es2023",
    "module": "esnext",
    "lib": ["ES2023", "DOM"],
    "types": ["vite/client"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

（模板中还有一项 `allowArbitraryExtensions`，与这一课关系不大，这里省略。）按作用分组：

| 选项 | 作用 |
| --- | --- |
| `noEmit` | 只检查，不输出 JavaScript。输出由 Vite 负责（f02）。所以 `target` 在这里影响很小，真正决定输出语法的是 Vite 的 `build.target` |
| `lib` | 代码中可以使用哪些**内置 API 的类型**。`ES2023` 有 `toSorted`，没有 ES2024 的 `Promise.withResolvers`（用了会报 TS2550，并提示把 `lib` 改成 `es2024`）；`DOM` 提供 `document`、`window`，连 `console` 也在其中。`lib` 只影响类型检查，不会给旧浏览器补上这些 API |
| `types` | 自动包含哪些全局类型包。TypeScript 6.0 起默认是 `[]`（什么都不自动包含）；这里只包含 `vite/client`（f02 讲过，让 `import './style.css'` 能通过检查）。即使装了 `@types/node`，浏览器代码中的 `process` 也会报错，这正是想要的 |
| `module`、`moduleResolution` | 输出什么样的模块、怎样根据 `import` 的路径找到文件。`bundler` 表示“由打包工具负责”，规则见下文 |
| `allowImportingTsExtensions` | 允许 `import './counter.ts'` 这样写出 `.ts` 扩展名（模板的 `main.ts` 就是这样写的）；只能和 `noEmit` 一起用 |
| `verbatimModuleSyntax` | 每个 `import`/`export` 原样保留到输出中，只有标记了 `type` 的才去掉（见下一节）。它同时隐含了 `isolatedModules`：每个文件都必须能单独转译 |
| `erasableSyntaxOnly` | 只允许“去掉类型就是 JavaScript”的语法，禁止 `enum`、`namespace`、参数属性（b17） |
| `moduleDetection: "force"` | 每个文件都当作模块，即使里面没有 `import`/`export` |
| `skipLibCheck` | 不检查 `node_modules` 中的 `.d.ts` 文件（它们之间的冲突不是你的问题，还能加快检查） |
| `noUnusedLocals` 等 | 类似 lint 的检查：未使用的变量和参数、`switch` 中漏写的 `break` |

`strict` 没有写：TypeScript 6.0 起默认就是开启的。这个网站的练习使用的配置与这份模板大体一致，区别是：`lib` 是 `ES2025`；额外开启了 `noUncheckedIndexedAccess`（c11）；没有开启 `noUnusedLocals`、`noUnusedParameters`，因为教学示例中常常有暂时没用到的变量。

## verbatimModuleSyntax 与 import type

Vite（f02）和这个网站一样，**一次只转译一个文件**。转译 `main.ts` 时，它看不到 `types.ts`，不知道 `import { User } from './types'` 中的 `User` 是类型还是值。`verbatimModuleSyntax` 给出了简单的规则：没有标记 `type` 的导入**原样保留**；只用于类型的导入必须写出来。否则会发生下面的事：

:::playground{#import-type expect="1484@main.ts:1" run=error}
```ts file=types.ts
export type User = { name: string; admin: boolean };

export function greet(user: User): string {
  return `你好，${user.name}`;
}
```
```ts file=main.ts
import { User, greet } from './types';

const ada: User = { name: 'Ada', admin: true };
console.log(greet(ada));
```
- 第 1 行报 TS1484：`User` 是类型，在 `verbatimModuleSyntax` 下必须用只导入类型的写法。
- 运行也失败了：`import { User, greet }` 被原样保留，而运行时的 `types.ts` 中没有 `User` 这个导出（类型已经被去掉），浏览器在连接模块时就报错。
- 改成 `import { type User, greet } from './types';`，或者分成两行 `import type { User } from './types';` 和 `import { greet } from './types';`，错误和运行失败都消失了。点“查看 JS”看输出。
:::

三种写法在输出中的区别（用 TypeScript 6.0.3 的 `transpileModule` 实际转译得到）：

| 写法 | 开启 `verbatimModuleSyntax` 时的输出 |
| --- | --- |
| `import type { A } from './a';` | 整行去掉 |
| `import { type B } from './b';` | `import {} from './b';`：**模块仍然会被加载和执行** |
| `import { type C, c } from './c';` | `import { c } from './c';` |

第二行的区别很重要：如果 `./b` 在被加载时有**副作用**（注册插件、添加全局样式、初始化配置），`import type` 会让这个副作用消失，而 `import { type B }` 保留它。下面的小任务就是这种情况。（关闭 `verbatimModuleSyntax` 时，`import { type B } from './b'` 会被整行去掉，这也是这个选项要消除的不确定性之一。）

导出也一样：重新导出一个类型写成 `export type { User } from './types'`。

::exercise{#fix-imports}

## 模块解析：bundler 与 nodenext

`import { add } from './math'` 中的 `'./math'` 叫**模块说明符**。TypeScript 要根据它找到文件，才能检查 `add` 的类型；运行时，浏览器、打包工具或 Node.js 也要根据它找到文件。`moduleResolution` 告诉 TypeScript：**运行时是谁来找**，按谁的规则检查。

- `bundler`：由 Vite 这样的打包工具找。打包工具很宽容：可以省略扩展名，可以导入文件夹（找其中的 `index.ts`）；
- `nodenext`：由 Node.js 找。Node.js 的 ES 模块只按写出的路径找文件，**不会补扩展名**，也不会去找文件夹中的 `index`。

用 TypeScript 6.0.3 实际检查得到的结果（`src` 中有 `util.ts`、`view.tsx`、`lib/index.ts`，`package.json` 中有 `"type": "module"`）：

| 从 `src/main.ts` 导入 | `bundler` | `nodenext` |
| --- | --- | --- |
| `'./util'` | ✅ 找到 `util.ts` | ❌ TS2835：相对导入需要写出扩展名，你是想写 `'./util.js'` 吗？ |
| `'./util.js'` | ✅ 找到 `util.ts` | ✅ 找到 `util.ts` |
| `'./view.js'`、`'./view.jsx'` | ✅ 找到 `view.tsx` | ✅ 找到 `view.tsx` |
| `'./util.ts'` | 需要 `allowImportingTsExtensions`，否则 TS5097 | 同左 |
| `'./lib'`、`'./lib/'` | ✅ 找到 `lib/index.ts` | ❌ TS2834：需要写出扩展名 |
| `'./lib/index.js'` | ✅ | ✅ |
| `'./missing.js'` | ❌ TS2307：找不到模块 | ❌ TS2307 |

为什么在 `nodenext` 中要写 `.js`，而文件明明是 `.ts`？因为 TypeScript **不改写** `import` 中的路径：`tsc` 把 `main.ts` 编译成 `main.js` 时，`import './util.js'` 原样保留，运行时 Node.js 找的是编译出的 `util.js`。所以在源代码中就写运行时的路径，TypeScript 检查时再把 `.js` 对应回 `util.ts`。

还有一种情况：Node.js 现在可以**直接运行 `.ts` 文件**（只去掉类型，不做检查）。编写本课时使用的 Node.js 24.13 中，`node main.ts` 直接就能运行；这时运行时找的是 `.ts` 文件，`import './math.js'` 反而会报 `ERR_MODULE_NOT_FOUND`，必须写 `import './math.ts'`。TypeScript 中对应的配置是 `"module": "nodenext"`、`"allowImportingTsExtensions": true`、`"noEmit": true`，再加上 `"erasableSyntaxOnly": true`：Node.js 只会去掉类型，遇到 `enum` 时报 `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`。

选择的原则：**谁运行代码，就按谁的规则配置**。浏览器项目（经过 Vite）用 `bundler`；直接用 Node.js 运行或者发布给 Node.js 使用的包，用 `nodenext`。

## 在自己的电脑上做一遍

1. 在 f02 创建的 `my-app` 中运行 `npx tsc --showConfig`，看看哪些选项是默认值填进去的；
2. 在 `main.ts` 中写一行 `Promise.withResolvers<number>()`，运行 `npx tsc`：报 TS2550。把 `lib` 中的 `ES2023` 改成 `ES2024`，错误消失；
3. 新建一个文件夹，`npm init -y` 之后把 `package.json` 中的 `"type"` 改成 `"module"`。写 `math.ts`（导出一个带类型注解的 `add`）和 `main.ts`（`import { add } from './math.ts'`），运行 `node main.ts`；再把导入改成 `'./math.js'` 或 `'./math'`，看 Node.js 报出的错误；
4. 在这个文件夹中 `npm install --save-dev typescript@6.0.3`，写一个 `tsconfig.json`：`module` 为 `nodenext`，打开 `allowImportingTsExtensions`、`noEmit`、`erasableSyntaxOnly`、`verbatimModuleSyntax`，运行 `npx tsc` 检查。

## 编程挑战

::exercise{#resolve-import}

::quiz

## 常见错误

- **只用于类型的导入没有写 `type`**：在 `verbatimModuleSyntax` 下是 TS1484；在没有这个选项的旧项目中，换一个只转译单个文件的工具就可能在运行时出错。
- **用 `import type` 导入一个有副作用的模块**：整行被去掉，副作用也没了。需要副作用时写 `import { type X }`，或者另加一行 `import './plugins'`。
- **在 Node.js 项目中省略扩展名**：TS2835。按运行方式写 `.js`（运行编译后的代码）或 `.ts`（Node.js 直接运行）。
- **为了让 `process` 能用，在浏览器项目的 `types` 中加上 `node`**：浏览器中没有 `process`，这只会把运行时错误藏起来。前端读取配置用 `import.meta.env`（e13）。
- **以为改了 `lib` 就能在旧浏览器中使用新 API**：`lib` 只影响类型检查，运行时有没有这个 API 取决于浏览器。
