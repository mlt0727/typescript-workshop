---
version: 1
mode: ts
estimatedMinutes: 40
review: self-reviewed
problem: any 是 TypeScript 的“关闭检查”开关：一个值的类型是 any，对它做什么都不报错，而且它会传染，any 赋给别的变量、取出的属性、调用的结果，统统还是 any。麻烦在于 any 常常不是你写的：JSON.parse、response.json()、Function 类型、没有类型声明的旧库、Array.isArray 的收窄，都会悄悄地把 any 带进来。双重断言 as unknown as 则是另一种“关掉检查”。这一课学会识别 any 从哪里来，在它进入的地方用 unknown 把它挡住，用验证代替断言，并知道少数确实需要断言的场合该怎样把它关进笼子里。
objectives:
  - 识别 any 的常见来源（JSON.parse、response.json()、Function、无类型的库、Array.isArray），理解它的传染性
  - 在 any 进入程序的地方把它赋给 unknown，再用类型守卫或解析函数得到确定的类型
  - 区分 @ts-expect-error 与 @ts-ignore，知道双重断言什么时候是警报
  - 把无法避免的不安全代码隔离在一个小函数里，对外只暴露有类型、经过检查的接口
references:
  - title: Everyday Types（any、noImplicitAny）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#any
    checked: 2026-10-20
  - title: TypeScript 4.4 Release Notes（useUnknownInCatchVariables）
    url: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-4.html
    checked: 2026-10-20
  - title: no-unsafe-member-access — typescript-eslint
    url: https://typescript-eslint.io/rules/no-unsafe-member-access/
    checked: 2026-10-20
---

## any 会传染

`noImplicitAny`（`strict` 的一部分）会拦下“没写类型、推断不出来”的参数，但拦不住**库函数返回的 any**：

:::playground{#contagious expect="18046@main.ts:7" run=error}
```ts file=main.ts
const data = JSON.parse('{"user": null}');
const settings = data.settings;
const label: string = settings?.theme ?? 'light';
console.log(label);

const safe: unknown = JSON.parse('{"user": null}');
console.log(safe.user);

console.log(data.user.name.toUpperCase());
```
- 第 1–3 行：`JSON.parse` 返回 `any`，于是 `data`、`settings` 都是 `any`，第 3 行把它赋给 `string` 也不报错，即使运行时它可能是一个数字。
- 第 7 行报 TS18046：同样的数据，赋给 `unknown` 之后，任何属性访问都要先检查。
- 第 9 行能通过检查，运行时却抛出 `TypeError`（`data.user` 是 `null`）。这就是 `any` 的代价：错误被推迟到了运行时，而且离原因很远。
:::

常见的 `any` 来源：

| 来源 | 怎样挡住 |
| --- | --- |
| `JSON.parse(text)` | `const value: unknown = JSON.parse(text)`，再验证（e06） |
| `await response.json()` | 同上：赋给 `unknown` |
| `Function` 类型的值，调用结果是 `any` | 写出具体的函数类型，例如 `(x: number) => string` |
| 没有类型声明的库（`strict` 下导入它先报 TS7016；为了消除这个错误写一行 `declare module '库名';`，导入的一切就都成了 `any`） | 在一个小的包装模块里把结果赋给 `unknown` 并验证（编程挑战）；或者写出真正的类型声明（c12） |
| `Array.isArray(x)` 把 `unknown` 收窄成 `any[]` | 赋给 `readonly unknown[]`（p1-05） |

`catch (error)` 的 `error` 在 `strict` 下是 `unknown`（`useUnknownInCatchVariables`，TypeScript 4.4 起），不是 `any`：抛出的不一定是 `Error`，也可能是字符串或者任何值，读 `error.message` 之前要先检查 `error instanceof Error`。

这个平台的规则检查会拦下**写出来的** `any`，但拦不住从库函数中流进来的 `any`，也拦不住没有写类型的变量：`let data; data = JSON.parse(text);` 中的 `data` 同样是 `any`。专门的工具是 typescript-eslint 的 `no-unsafe-*` 系列规则（`no-unsafe-member-access`、`no-unsafe-assignment` 等），它们会标出所有使用了 `any` 值的地方，F 阶段配置 ESLint 时会用到。

## 双重断言与注释指令

`as` 只允许在“有重叠”的类型之间断言，`'hello' as number` 报 TS2352。`'hello' as unknown as number` 却能通过：先断言成 `unknown`（任何类型都能），再从 `unknown` 断言成任何类型。代码里看到 `as unknown as`，几乎总是意味着“类型不对，但我想让它通过”。

注释指令也是同样的“开关”：

- `// @ts-ignore`：忽略下一行的错误，**没有错误时也不报告**，问题修好以后它还会一直留着，悄悄地掩盖以后出现的新错误；
- `// @ts-expect-error`：同样忽略下一行的错误，但下一行**没有错误时会报 TS2578**，提醒你删掉它。类型测试中故意写出错误时用它（本课程的类型测试一直这样做）。

在正常的代码中，两者都应该很少出现；如果确实需要，选 `@ts-expect-error`，并在后面写上原因。

## 无法避免时：把它关进笼子里

少数情况下断言确实无法避免，例如测试中构造一个只实现了部分方法的替身对象，或者某个库的类型声明本身有错误。这时：

1. 把断言放在**一个**小函数里，函数的参数和返回值都有准确的类型；
2. 在函数里尽可能做运行时检查，让断言“名副其实”；
3. 写注释说明为什么需要它。

调用方只看到一个有类型的函数，`any` 和断言都不会扩散出去。编程挑战中包装一个“没有类型的旧库”，就是这样做的：库返回的值一进来就赋给 `unknown`，经过解析之后才交出去。

::exercise{#remove-any}

## 编程挑战

::exercise{#typed-facade}

::quiz

## 常见错误

- **以为没写 `any` 就没有 `any`**：`JSON.parse`、`response.json()` 的结果都是 `any`。在入口处赋给 `unknown`。
- **用 `as` 把 `JSON.parse` 的结果当作某个类型**：和 `any` 一样没有检查。验证之后再使用。
- **用 `@ts-ignore` 让错误消失**：它会一直留着，掩盖以后的问题。需要时用 `@ts-expect-error` 并写明原因。
- **到处写 `as unknown as`**：双重断言是“类型不对”的警报。找出类型不对的原因，或者把它隔离在一个有类型的小函数里。
- **`catch (error)` 之后直接读 `error.message`**：抛出的不一定是 `Error`。先用 `instanceof Error` 收窄。
