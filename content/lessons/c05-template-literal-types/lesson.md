---
version: 1
mode: ts
estimatedMinutes: 45
review: ai-draft
problem: '很多“字符串”其实是有结构的：路由 /users/:id 里藏着参数名，事件处理函数的属性名是 on 加上首字母大写的事件名，CSS 的长度是数字加单位，颜色是 # 开头的十六进制。模板字面量类型把 JavaScript 的模板字符串搬到了类型层面：它可以拼出新的字符串字面量类型，可以在映射类型中给键改名，配合 infer 还能从字符串中“解析”出一部分。这一课学会它的实际用途，例如让 buildPath(''/users/:id'', { id }) 少传参数时在编译期报错，同时知道它的边界：一旦字符串不是字面量，这些检查就都不起作用了。'
objectives:
  - 写出模板字面量类型，理解它遇到联合类型时会生成所有的组合
  - 使用 Capitalize、Uppercase 等内置的字符串工具类型，并在映射类型中用 as 给键改名或过滤键
  - 用 infer 和递归从字符串字面量类型中取出一部分，例如路由中的参数名
  - 知道模板字面量类型只对字面量有效，以及运行时仍然需要真正的检查
references:
  - title: Template Literal Types — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html
    checked: 2026-10-20
  - title: Mapped Types（Key Remapping via as）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/mapped-types.html#key-remapping-via-as
    checked: 2026-10-20
---

## 在类型层面拼字符串

```ts
type Size = 'sm' | 'lg';
type Color = 'red' | 'blue';
type ButtonClass = `btn-${Size}-${Color}`; // 'btn-sm-red' | 'btn-sm-blue' | 'btn-lg-red' | 'btn-lg-blue'
```

模板中的位置放进联合类型时，会生成所有的组合。组合的数量是各部分数量的乘积，几个大的联合放在一起很容易产生成千上万个成员，要注意。

模板中也可以放 `string`、`number` 这样的宽类型，表示“这一部分可以是任何字符串、任何数字”：`` `#${string}` `` 是所有以 `#` 开头的字符串，`` `${number}px` `` 是 `'12px'`、`'0.5px'` 这样的字符串（`'apx'` 不行）。

TypeScript 内置了四个字符串工具类型：`Uppercase`、`Lowercase`、`Capitalize`（首字母大写）、`Uncapitalize`。它们由编译器直接实现，只能作用在字符串字面量（或它们的联合）上。

## 在映射类型中给键改名

映射类型可以在键的后面写 `as 新的键`（TypeScript 4.1 起）。新的键常常用模板字面量类型拼出来；如果新的键是 `never`，这个属性就被去掉了：

:::playground{#remap}
```ts file=main.ts
type User = { name: string; age: number; save(): void };

type Getters<T> = { [K in keyof T as `get${Capitalize<K & string>}`]: () => T[K] };
type DataOnly<T> = { [K in keyof T as T[K] extends (...args: never[]) => unknown ? never : K]: T[K] };
type EventProp<E extends string> = `on${Capitalize<E>}`;

type UserData = DataOnly<User>; // { name: string; age: number }
type UserGetters = Getters<UserData>; // { getName: () => string; getAge: () => number }
type Props = EventProp<'click' | 'keyDown'>; // 'onClick' | 'onKeyDown'

const getters: UserGetters = { getName: () => 'Ada', getAge: () => 36 };
const prop: Props = 'onKeyDown';
console.log(getters.getName(), getters.getAge(), prop);
```
- 第 3 行的 `K & string`：`keyof T` 可能包含 `number` 和 `symbol` 键，`Capitalize` 只接受字符串，`& string` 只保留字符串键（其他的变成 `never`）。
- 第 4 行：值是函数的键被映射成 `never`，于是 `save` 被去掉了。`as` 中可以写任何条件类型。
- 把第 11 行的 `getAge` 拼错成 `getage`，会报错：键的名字也是检查的一部分。
:::

## 从字符串中取出一部分

`infer` 也能用在模板字面量类型里，按模式“拆开”字符串。例如取出路由中的参数名：

```ts
type Params<P extends string> = P extends `${string}:${infer Name}/${infer Rest}`
  ? Name | Params<`/${Rest}`>
  : P extends `${string}:${infer Name}`
    ? Name
    : never;

type A = Params<'/users/:id'>; // 'id'
type B = Params<'/posts/:postId/comments/:commentId'>; // 'postId' | 'commentId'
type C = Params<'/about'>; // never
```

第一个分支匹配“某个 `:` 之后到下一个 `/` 之前”的一段，取出参数名，再对剩下的部分**递归**；第二个分支处理最后一个参数。`infer` 在模板中默认尽量少地匹配，所以 `${infer Name}/` 取到的是第一个 `/` 之前的部分。

有了 `Params`，函数的参数就可以由路由字符串决定：

:::playground{#build-path expect="2345@main.ts:16" run=error}
```ts file=main.ts
type Params<P extends string> = P extends `${string}:${infer Name}/${infer Rest}`
  ? Name | Params<`/${Rest}`>
  : P extends `${string}:${infer Name}`
    ? Name
    : never;

function buildPath<R extends string>(route: R, params: Record<Params<R>, string>): string {
  const lookup: Record<string, string | undefined> = params;
  return route.replace(/:(\w+)/g, (_match, name: string) => {
    const value = lookup[name];
    if (value === undefined) throw new Error(`缺少参数：${name}`);
    return encodeURIComponent(value);
  });
}

console.log(buildPath('/posts/:postId/comments/:commentId', { postId: '7' }));
console.log(buildPath('/users/:id', { id: 'a b' }));

const route: string = '/users/:id';
console.log(buildPath(route, {}));
```
- 第 16 行报 TS2345：少了 `commentId`。`R` 被推断成字面量类型 `'/posts/:postId/comments/:commentId'`，`Params<R>` 算出了两个参数名。如果仍然运行，第 11 行的检查会抛出“缺少参数：commentId”；删掉第 16 行再运行，看看后面两行的输出。
- 第 8 行：`Record<Params<R>, string>` 可以赋值给 `Record<string, string | undefined>`，之后就能用运行时得到的 `name` 查找。运行时的检查（第 11 行）仍然要写，类型只能保证“写在代码里的字面量”是对的。
- 第 19、20 行：`route` 的类型是 `string`，不再是字面量，`Params<string>` 是 `never`，`Record<never, string>` 是空对象，**任何参数对象都能通过检查**，运行时才抛出“缺少参数”。模板字面量类型的检查只对字面量有效。
:::

## 边界在哪里

模板字面量类型是“编译期的字符串解析器”，很有表现力，但要清楚它的边界：

- 只对**字面量**有效：字符串来自用户输入、`fetch`、拼接得到的 `string` 时，检查全部失效，运行时的验证（e06）一个也不能少；
- 类型可能很复杂：递归的类型有深度限制，太长的字符串、太多的组合会让编辑器变慢，甚至报错“类型实例化过深”；
- 能用简单的写法就别用它：如果路由是一张固定的表，b16 的 `satisfies` 加一个参数对象常常就够了。

::exercise{#string-types}

## 编程挑战

::exercise{#typed-routes}

::quiz

## 常见错误

- **把几个大的联合放进一个模板**：组合数量是乘积，很快就会爆炸。
- **`Capitalize<keyof T>`**：`keyof T` 可能包含 `number`、`symbol`，要写 `Capitalize<K & string>`。
- **以为类型检查了运行时的字符串**：`string` 类型的值经过模板字面量类型时，检查都不起作用；外部输入照样要验证。
- **只靠类型、不写运行时检查**：`buildPath(route as any, {})` 或者 `string` 类型的路由都能绕过类型，运行时的“缺少参数”检查仍然要有。
- **递归类型没有终止的分支**：每个递归的条件类型都要有一个不再递归的分支（这里是 `never`）。
