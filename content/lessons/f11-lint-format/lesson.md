---
version: 1
mode: ts
estimatedMinutes: 50
review: self-reviewed
problem: 代码审查时，一半的意见是“这里少了分号”“缩进不对”“引号统一一下”，真正的问题反而被淹没了；有些 bug 编译器不报错，人也很难一眼看出，例如忘了 await 的 Promise、forEach 中的 async 回调。格式化工具和静态检查工具把这两类事情交给机器：Prettier 统一代码的格式，不再需要讨论；ESLint 按规则找出可能有问题的写法，加上 typescript-eslint 之后还能利用类型信息。这一课在本机配置并运行它们，读懂它们的输出，知道 create-vite 模板中默认的 Oxlint 与 ESLint 的区别；在这个网站上，用代码实现 ESLint 输出的汇总，以及 flat config 的合并规则。
objectives:
  - 区分格式化（Prettier）与静态检查（ESLint、Oxlint）各自负责的事情
  - 在本机配置 ESLint 的 flat config 与 typescript-eslint 的类型感知规则，读懂并修复它报告的问题，知道 --fix 能修什么
  - 用 Prettier 检查和格式化代码，说明 create-vite 的 React 模板中 Oxlint 的作用与局限
  - 理解 flat config 中 files、ignores 与规则合并的方式
references:
  - title: Configuration Files — ESLint
    url: https://eslint.org/docs/latest/use/configure/configuration-files
    checked: 2026-10-20
  - title: Configure Rules（Rule configuration cascade）— ESLint
    url: https://eslint.org/docs/latest/use/configure/rules
    checked: 2026-10-20
  - title: Linting with Type Information — typescript-eslint
    url: https://typescript-eslint.io/getting-started/typed-linting
    checked: 2026-10-20
  - title: Prettier Docs（Why Prettier / Options）
    url: https://prettier.io/docs/why-prettier
    checked: 2026-10-20
  - title: Oxlint — Oxc
    url: https://oxc.rs/docs/guide/usage/linter
    checked: 2026-10-20
---

## 格式化与静态检查

| | 格式化（Prettier） | 静态检查（ESLint、Oxlint） |
| --- | --- | --- |
| 管什么 | 空格、换行、缩进、引号、分号、括号的位置 | 可能的 bug、不推荐的写法（没有处理的 Promise、`==`、未使用的变量……） |
| 会不会改变程序的行为 | 不会 | 自动修复（`--fix`）只做安全的修改；大部分问题要人来改 |
| 要不要配置 | 几乎不用（这就是它的意义：不再讨论格式） | 选择规则集，按项目调整个别规则 |

两者分工，不要互相替代：ESLint 从 8.53 起已经不再维护代码风格类的规则，格式交给 Prettier。

`==` 是一个典型的“编译器不管、但几乎总是错误”的写法（a06）。ESLint 的 `eqeqeq` 规则就是为它准备的：

:::playground{#loose-equality}
```ts file=main.ts
const pairs: [unknown, unknown][] = [
  [0, ''],
  [null, undefined],
  ['1', 1],
  [[], false],
  [' \n', 0],
];
for (const [a, b] of pairs) {
  console.log(JSON.stringify(a), JSON.stringify(b), '==', a == b, '===', a === b);
}
```
- 每一对用 `==` 比较都是 `true`，用 `===` 都是 `false`：`==` 会先把两边转换成同一种类型。
- 这里的值是 `unknown`，所以 TypeScript 不报错；类型明确时，TypeScript 会对 `0 == ''` 这样不可能相等的比较报 TS2367。lint 规则补上了类型检查管不到的地方。
:::

## ESLint 与 typescript-eslint

在 f02 的项目中（或任何一个 TypeScript 项目）：

1. 安装：`npm install --save-dev eslint @eslint/js typescript-eslint`；
2. 在项目根目录创建 `eslint.config.js`（ESLint 9 起的“flat config”，下面是本机实际使用的配置）：

```js
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist'] },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true },
    },
  },
  {
    // eslint.config.js 这样的 .js 文件不在 tsconfig.json 中，不做需要类型信息的检查
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
```

- `js.configs.recommended`：ESLint 自带的推荐规则；`tseslint.configs.recommendedTypeChecked`：typescript-eslint 的推荐规则，包括需要类型信息的规则；
- `projectService: true`：让 typescript-eslint 读取 `tsconfig.json`，用和编辑器一样的方式得到类型信息；
- 最后一项：`eslint .` 也会检查 `eslint.config.js` 本身，而它不在 `tsconfig.json` 的范围内，需要类型信息的规则无法运行。不加这一项时，实测 `eslint .` 报告 `Parsing error: …eslint.config.js was not found by the project service`。`disableTypeChecked` 让这些 `.js` 文件只做不需要类型信息的检查。

3. 在 `package.json` 的 `scripts` 中加上 `"lint": "eslint ."`。对下面这个文件运行 `npm run lint`（编写本课时使用 ESLint 10.13、typescript-eslint 8.72）：

```ts
type User = { id: string; name: string };

async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  return (await response.json()) as User;
}

export function loadAll(ids: string[]): User[] {
  const users: User[] = [];
  ids.forEach(async (id) => {
    users.push(await fetchUser(id));
  });
  return users;
}

export function save(user: User) {
  fetch('/api/users', { method: 'POST', body: JSON.stringify(user) });
  let unused = 1;
  if (user.name == '') console.log('空名字');
}
```

实际的输出（文件的路径和 npm 自己输出的两行已省略）：

```text
  10:15  error  Promise returned in function argument where a void return was expected  @typescript-eslint/no-misused-promises
  17:3   error  Promises must be awaited, end with a call to .catch, end with a call to .then with a rejection handler or be explicitly marked as ignored with the `void` operator  @typescript-eslint/no-floating-promises
  18:7   error  'unused' is never reassigned. Use 'const' instead  prefer-const
  18:7   error  'unused' is assigned a value but never used  @typescript-eslint/no-unused-vars

✖ 4 problems (4 errors, 0 warnings)
  1 error and 0 warnings potentially fixable with the `--fix` option.
```

- 第 10 行：`forEach` 的回调应该返回 `void`，传入的却是返回 Promise 的 `async` 函数，正是 f05 的 bug；
- 第 17 行：`fetch` 返回的 Promise 没有被 `await`，也没有处理失败，请求失败时没有人知道；
- 第 18 行的两条规则：`let` 可以改成 `const`（这一条可以自动修复，`npx eslint --fix src` 会把它改成 `const`），变量也没有被使用；
- 注意 `==` **没有**被报告：`eqeqeq` 不在推荐的规则集中，需要时在配置中加一个对象：`{ rules: { eqeqeq: 'error' } }`。

每条规则的严重程度是 `'off'`（或 `0`）、`'warn'`（`1`）、`'error'`（`2`）。`error` 让 `eslint` 以非零的退出码结束，持续集成（f12）中就会失败。

确实需要例外时，在那一行上面写 `// eslint-disable-next-line 规则名 -- 原因`，并写清楚原因；不要为了让 lint 通过而大面积关闭规则。

## Oxlint：create-vite 模板中的选择

用 create-vite 9.3.1 创建 React 模板（`--template react-ts`）时，`package.json` 中的 `lint` 脚本是 `oxlint`，配置文件 `.oxlintrc.json` 是：

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

（创建时加 `--eslint` 会改用 ESLint。）Oxlint 用 Rust 编写，实现了 ESLint 的大部分常用规则，速度快得多。但它默认不使用类型信息：对上面同一个文件，本机运行 Oxlint 1.89 只报告了未使用的变量，没有发现两个与 Promise 有关的问题。所以：需要类型感知的规则（`no-floating-promises`、`no-misused-promises` 等）时用 ESLint 加 typescript-eslint；只需要快速的基础检查时，Oxlint 是很好的选择。两者也可以同时使用。这个网站自己的仓库用的是 ESLint 加 typescript-eslint。

## Prettier

1. `npm install --save-dev prettier`；
2. `npx prettier --check src/messy.ts`：只检查，不修改。本机对一个格式混乱的文件的实际输出（检查多个文件时，最后一行是 `Code style issues found in 2 files.` 这样的数量）：

```text
Checking formatting...
[warn] src/messy.ts
[warn] Code style issues found in the above file. Run Prettier with --write to fix.
```

3. `npx prettier --write src` 直接改好。`const greeting = (name:string)=>{return "你好，"+name}` 被格式化成：

```ts
const greeting = (name: string) => {
  return "你好，" + name;
};
```

Prettier 的选项很少，常改的只有几个，写在 `.prettierrc.json` 中，例如 `{ "singleQuote": true, "printWidth": 120 }`（单引号、每行最多 120 个字符）。不需要格式化的文件写进 `.prettierignore`。在编辑器中打开“保存时格式化”，就几乎不用再想格式的事了。

## 在持续集成中检查

把检查写成 `package.json` 中的脚本，持续集成（f12）中依次运行：`npm run lint`（ESLint）、`npx prettier --check .`、`npx tsc --noEmit`（或 `tsc -b`）、`npm test`。任何一步失败，这次提交就不能合并。

::exercise{#lint-summary}

## 编程挑战

一个 flat config 是配置对象的数组。对一个文件，ESLint 按顺序找出适用于它的对象，把它们的规则合并起来。下面的挑战实现这个过程，规则与 ESLint 10.13 的实际行为一致。

::exercise{#flat-config}

::quiz

## 常见错误

- **用 ESLint 管格式**：格式交给 Prettier，ESLint 只管可能的问题。
- **只用不需要类型信息的规则**：最有价值的几条（没有处理的 Promise、误用的 Promise）都需要类型信息，要配置 `projectService`。
- **为了通过检查而关闭规则**：先看规则在防止什么问题；确实需要例外时，只在那一行关闭并写明原因。
- **只在自己的电脑上检查**：把 lint、格式检查放进持续集成，才能保证每次合并的代码都符合要求。
- **以为 `--fix` 能修好所有问题**：它只做不会改变行为的修改（例如 `let` 改成 `const`），没有处理的 Promise 这类问题要你决定怎样修。
