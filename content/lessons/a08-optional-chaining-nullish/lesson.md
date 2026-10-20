---
version: 1
mode: ts
representative: true
estimatedMinutes: 30
review: ai-draft
problem: 读取可能缺失的嵌套数据时，直接访问会在中途遇到 undefined 而抛出 TypeError；用 || 设默认值又会把 0、空字符串和 false 这些“有意义的值”也替换掉。
objectives:
  - 用 ?. 安全地读取可能为 null 或 undefined 的属性、下标与方法，并理解它的短路行为
  - 区分 ?? 与 ||：准确说出哪些值会触发默认值
  - 读懂 TypeScript 对 ?. 和 ?? 结果的类型推断（例如 string | undefined）
  - 知道 ?? 不能与 || 或 && 不加括号混用，会用 ??= 补默认值
references:
  - title: Optional chaining (?.) — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining
    checked: 2026-10-20
  - title: Nullish coalescing operator (??) — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing
    checked: 2026-10-20
  - title: Nullish coalescing assignment (??=) — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing_assignment
    checked: 2026-10-20
  - title: TypeScript 3.7 Release Notes：Optional Chaining 与 Nullish Coalescing
    url: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html
    checked: 2026-10-20
    note: 这两个运算符最早在 TS 3.7 中支持，现已是标准 JavaScript（ES2020）
---

## 问题：数据不一定完整

从接口或配置文件读到的对象，经常有些字段“可能没有”。在 TypeScript 里，属性名后的 `?` 表示**可选属性**（optional property）：它的值可能是声明的类型，也可能是 `undefined`。

和 Python 对比：访问不存在的字典键 `d['k']` 会抛 `KeyError`；而 JavaScript 访问对象上不存在的属性**不会报错**，只是得到 `undefined`。真正报错的是下一步——在 `undefined` 上继续读属性。

下面的代码故意写错了。先别运行，看看编辑器给出的类型错误；然后再运行，看看运行时发生了什么。

:::playground{#crash expect="18048@main.ts:11" run=error}
```ts file=main.ts
type User = {
  name: string;
  profile?: {
    nickname?: string;
  };
};

const ada: User = { name: 'Ada' };

console.log('开始读取');
console.log(ada.profile.nickname);
console.log('这一行不会执行');
```
- TypeScript 在**编译期**就指出 `ada.profile` 可能是 `undefined`（TS18048）。
- 但类型检查不会阻止代码运行：类型被擦除后，JavaScript 照常执行，在第 11 行抛出 `TypeError`（Chrome 中的提示是 `Cannot read properties of undefined (reading 'nickname')`，其他浏览器措辞不同），第 12 行没有机会执行。
:::

## `?.`：遇到 null / undefined 就停下

**可选链**（optional chaining）运算符 `?.` 的规则只有一条：如果 `?.` 左边的值是 `null` 或 `undefined`，整个表达式立即结束，结果为 `undefined`；否则照常继续访问。它有三种写法：

| 写法 | 含义 |
|---|---|
| `obj?.prop` | 读取属性 |
| `obj?.[expr]` | 用表达式读取属性或数组下标 |
| `fn?.(args)` | 调用一个可能不存在的函数 |

:::playground{#forms}
```ts file=main.ts
type User = {
  name: string;
  profile?: { nickname?: string };
  tags?: string[];
  greet?: () => string;
};

const ada: User = { name: 'Ada', tags: ['math'] };
const bob: User = { name: 'Bob', profile: { nickname: 'bobby' }, greet: () => 'hi' };

console.log(ada.profile?.nickname);
console.log(bob.profile?.nickname);
console.log(ada.tags?.[0]);
console.log(bob.tags?.[0]);
console.log(ada.greet?.());
console.log(bob.greet?.());

const nick = ada.profile?.nickname;
console.log(typeof nick);
```
- 把鼠标停在第 18 行的 `nick` 上：TypeScript 推断它的类型是 `string | undefined`。用了 `?.` 之后，结果“可能是 undefined”这一点被写进了类型里，后面使用 `nick` 时你仍然要处理这种情况。
- 试着把第 11 行的 `?.` 改回 `.`，看看错误提示怎样出现、又怎样消失。
:::

**短路**（short-circuit）意味着：一旦在某个 `?.` 处停下，这条链后面的**所有**访问和函数调用都不会执行。所以 `a?.b.c` 在 `a` 为 `undefined` 时不会因为 `.c` 而出错。注意 `?.` 只关心 `null` 和 `undefined`：左边是 `0`、`''` 或 `false` 时，访问会照常继续。

::exercise{#get-city}

## `??` 与 `||`：什么算“没有值”

给缺失的值一个默认值，常见写法有两种：

- `a || b`：`a` 为 **falsy** 时取 `b`。falsy 值包括 `false`、`0`、`-0`、`0n`、`''`、`null`、`undefined`、`NaN`。
- `a ?? b`：只有 `a` 为 `null` 或 `undefined` 时取 `b`。这个运算符叫**空值合并**（nullish coalescing）。

如果 `0`、空字符串或 `false` 是合法的数据（比如“音量为 0”“标题故意留空”“关闭静音”），用 `||` 就会把它们错误地换成默认值。

:::playground{#or-vs-nullish}
```ts file=main.ts
type Settings = {
  volume?: number;
  title?: string;
  muted?: boolean;
};

const saved: Settings = { volume: 0, title: '', muted: false };

console.log('|| 的结果：', {
  volume: saved.volume || 50,
  title: saved.title || '未命名',
  muted: saved.muted || true,
});

console.log('?? 的结果：', {
  volume: saved.volume ?? 50,
  title: saved.title ?? '未命名',
  muted: saved.muted ?? true,
});

const empty: Settings = {};
console.log('字段缺失时：', { volume: empty.volume ?? 50, title: empty.title ?? '未命名' });
```
- 第一行输出里，用户保存的 `0`、`''`、`false` 全被替换了；第二行原样保留。只有字段真正缺失时，`??` 才会使用默认值。
- 这两种写法在 TypeScript 看来**都没有类型错误**：选错运算符是逻辑错误，类型系统抓不到，只能靠理解和测试。
:::

这不意味着 `||` 永远是错的。如果业务规则就是“空字符串也算没填”（比如显示名为空时显示默认名），`||` 恰好表达了这个意思。关键是先想清楚：**哪些值算缺失**。

::exercise{#with-defaults}

## 混用规则与 `??=`

`??` 不能直接和 `||` 或 `&&` 写在同一个表达式里，必须用括号说明先算哪一部分，否则是语法错误：

:::playground{#mixing expect="5076@main.ts:2" run=error}
```ts file=main.ts
function pick(a: string | undefined, b: string | undefined): string {
  return a || b ?? '默认';
}

console.log(pick(undefined, 'B'));
```
- TypeScript 报 TS5076，运行时 JavaScript 引擎也会以 `SyntaxError` 拒绝这个文件，所以连第 5 行都执行不到。
- 改成 `(a || b) ?? '默认'` 或 `a || (b ?? '默认')` 再运行。两种括号的含义不同，想一想 `pick('', undefined)` 在两种写法下分别返回什么。
:::

给对象的属性补默认值时，可以用**空值合并赋值** `??=`：`x ??= y` 只在 `x` 为 `null` 或 `undefined` 时才把 `y` 赋给 `x`。

:::playground{#nullish-assign}
```ts file=main.ts
type Options = { retries?: number; label?: string };

const opts: Options = { label: '' };
opts.retries ??= 3;
opts.label ??= '默认标签';

console.log(opts);
```
`label` 原本是空字符串，不是 `null` 或 `undefined`，所以保持不变；`retries` 缺失，被补上了 `3`。同理还有 `||=` 和 `&&=`，规则分别与 `||`、`&&` 一致。
:::

## 编程挑战

::exercise{#format-profile}

::quiz

## 常见错误

- **只在一处加 `?.`**：`a?.b.c` 在 `a` 为 `undefined` 时没问题，但如果 `a` 存在而 `a.b` 缺失，`.c` 仍会抛错——每一个可能缺失的位置都需要自己的 `?.`。TypeScript 的类型检查会帮你找到这些位置。
- **用 `||` 设默认值吞掉了 0 和空字符串**：先确认 falsy 值在业务里是否有意义。
- **用非空断言 `!` 让报错消失**：`ada.profile!.nickname` 只是告诉编译器“相信我”，运行时照样会崩溃。
- **以为 `?.` 能检查“是不是函数”**：`fn?.()` 只在 `fn` 为 `null`/`undefined` 时跳过；如果 `fn` 是个数字，仍然抛 `TypeError`。

## 下一步

下一课会系统地迁移条件与循环语法，并用类型收窄（narrowing）把 `string | undefined` 这样的类型安全地“缩小”成 `string`。
