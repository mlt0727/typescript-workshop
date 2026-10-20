---
version: 1
mode: ts
estimatedMinutes: 45
review: ai-draft
problem: 很多类型其实已经“写”在函数里了：一个 async 函数 loadUser 返回什么样的用户对象，它接收哪些参数，都由它的实现决定。再另外手写一个 User 类型，两者迟早不一致。ReturnType、Parameters、Awaited 能从函数的类型中取出返回值、参数列表和 Promise 完成时的值。这一课学会使用它们，知道它们遇到重载和泛型函数时的局限，并学会写“包装函数”（重试、缓存、日志）时最好的做法：用泛型的剩余参数让包装后的函数保留原来的参数和返回值类型。
objectives:
  - 用 ReturnType、Parameters、Awaited（以及 ConstructorParameters、InstanceType）从已有的函数和类中取出类型
  - 知道函数有多个重载时这些工具只看最后一个签名，泛型函数的类型参数会变成约束
  - '用泛型剩余参数 <A extends unknown[], R>(fn: (...args: A) => R) 写出保留参数与返回值类型的包装函数'
  - 写出重试、缓存这类异步包装函数，并正确处理并发调用和失败
references:
  - title: Utility Types（ReturnType、Parameters、Awaited）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/utility-types.html
    checked: 2026-10-20
  - title: TypeScript 4.5 Release Notes（The Awaited Type and Promise Improvements）
    url: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-5.html
    checked: 2026-10-20
  - title: TypeScript 4.0 Release Notes（Variadic Tuple Types）
    url: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-0.html
    checked: 2026-10-20
---

## 从函数中取出类型

```ts
async function loadUser(id: string, options?: { includePosts: boolean }) {
  return { id, name: 'Ada', posts: options?.includePosts ? ['p1'] : [] };
}

type User = Awaited<ReturnType<typeof loadUser>>; // { id: string; name: string; posts: string[] }
type LoadArgs = Parameters<typeof loadUser>; // [id: string, options?: { includePosts: boolean }]
type LoadOptions = NonNullable<Parameters<typeof loadUser>[1]>; // { includePosts: boolean }
```

| 工具 | 取出什么 |
| --- | --- |
| `ReturnType<F>` | 函数类型 `F` 的返回值类型 |
| `Parameters<F>` | 参数列表组成的元组（带着参数名，可选参数仍然是可选的） |
| `Awaited<T>` | Promise 完成时的值，**递归**地取到底：`Awaited<Promise<Promise<number>>>` 是 `number` |
| `ConstructorParameters<C>`、`InstanceType<C>` | 类的构造函数的参数、`new` 出来的实例的类型 |

注意要写 `typeof loadUser`：这些工具接收的是**类型**，`loadUser` 是一个值。`Awaited` 是 c03 里 `Unwrap` 的完整版本：它会一直取到不是 thenable 为止，作用在联合上时会分布，`Awaited<number | Promise<string>>` 是 `number | string`。`await` 表达式的类型、`Promise.all` 的结果，用的都是它。

## 两个局限：重载与泛型

:::playground{#limits}
```ts file=main.ts
function parse(text: string): number;
function parse(value: number): string;
function parse(input: string | number): number | string {
  return typeof input === 'string' ? Number(input) : String(input);
}

function first<T>(items: readonly T[]): T | undefined {
  return items[0];
}

type ParseResult = ReturnType<typeof parse>; // string：只看最后一个重载
type ParseArgs = Parameters<typeof parse>; // [value: number]
type FirstResult = ReturnType<typeof first>; // unknown：T 变成了它的约束

const a: ParseResult = parse(1);
const b: FirstResult = first(['x']);
console.log(a, b);
```
- 第 11、12 行：函数有多个重载签名时，`ReturnType`、`Parameters` 只取**最后一个**重载（这里是接收 `number` 的那个），而不是所有重载的联合。对重载函数使用它们之前要想清楚。
- 第 13 行：泛型函数的类型参数没有具体的值，`T` 被替换成它的约束（没写约束就是 `unknown`）。要得到某个具体调用的返回值类型，就直接用那次调用的结果。
:::

## 包装函数：用泛型的剩余参数

重试、缓存、记录日志、计时，这些“包装函数”接收一个函数，返回一个参数和返回值都相同的新函数。很多人会这样写：

```ts
function withLog<F extends (...args: any[]) => any>(fn: F): (...args: Parameters<F>) => ReturnType<F> { … }
```

它能用，但到处是 `any`，实现中调用 `fn(...args)` 时也得不到真正的检查。更好的写法是让 TypeScript 分别推断**参数元组** `A` 和**返回值** `R`（可变参数元组，TypeScript 4.0 起）：

:::playground{#wrapper}
```ts file=main.ts
function withLog<A extends unknown[], R>(name: string, fn: (...args: A) => R): (...args: A) => R {
  return (...args) => {
    const result = fn(...args);
    console.log(`${name}(${args.map((a) => JSON.stringify(a)).join(', ')}) →`, result);
    return result;
  };
}

function add(a: number, b: number): number {
  return a + b;
}

const loggedAdd = withLog('add', add);
const sum: number = loggedAdd(2, 3);
console.log(sum);
```
- 第 1 行：`A extends unknown[]` 是参数元组，`R` 是返回值。传入 `add` 时，`A` 被推断为 `[a: number, b: number]`，`R` 为 `number`。
- 第 13 行：`loggedAdd` 的类型是 `(a: number, b: number) => number`，连参数名都保留了下来；`loggedAdd('2', 3)` 会报错。
- 没有 `any`，也不需要 `Parameters`、`ReturnType`。只有在**拿不到函数本身**、只有它的类型时，才需要那两个工具。
:::

异步的包装函数同理，把签名写成 `fn: (...args: A) => Promise<R>`，返回 `(...args: A) => Promise<R>`。编程挑战要写两个：失败时自动重试的 `withRetry`，以及把同样参数的请求合并、只发一次的 `memoizeAsync`。后者有两个容易出错的地方：缓存的应该是 **Promise** 本身（这样并发的两次调用共享同一个请求），以及失败的 Promise 不能一直留在缓存里。

::exercise{#derive-from-functions}

## 编程挑战

::exercise{#async-wrappers}

::quiz

## 常见错误

- **写 `ReturnType<loadUser>`**：`loadUser` 是值，要写 `ReturnType<typeof loadUser>`。
- **忘了 `Awaited`**：async 函数的 `ReturnType` 是 `Promise<…>`，要得到里面的值再套一层 `Awaited`。
- **对重载函数用 `ReturnType`**：只得到最后一个重载的返回值。
- **包装函数写成 `F extends (...args: any[]) => any`**：`any` 让实现失去检查。用 `<A extends unknown[], R>`。
- **缓存异步结果时缓存“值”而不是 Promise**：两次并发调用会各发一次请求；缓存 Promise 并在失败时删除。
