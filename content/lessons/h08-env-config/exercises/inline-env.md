---
kind: challenge
title: 构建时替换环境变量
---
`next build` 会把代码中的 `process.env.NEXT_PUBLIC_…` 换成构建时的值。在 `inline-env.ts` 中实现 `inlinePublicEnv(code, env, target)` 来模拟这件事（规则来自文档，并按正文中的实测做了补充）：

1. **找出访问**：独立的 `process.env`，后面可以跟着 `.NAME`，或者用字符串字面量的下标 `['NAME']` / `["NAME"]`（方括号和引号之间可以有空白）。“独立”是指 `process` 的前一个字符不是字母、数字、`_`、`$` 或 `.`，`env` 的后一个字符不是字母、数字、`_` 或 `$`。代码中的字符串和注释里不会出现 `process.env`；
2. **`NEXT_PUBLIC_` 开头、并且 `env` 中有值的变量**：不管 `target` 是什么，都换成 `JSON.stringify(值)`；
3. **其他的变量**（包括 `env` 中没有值的 `NEXT_PUBLIC_` 变量）：`target` 是 `'server'` 时保留原样（服务器在运行时读取）；`'browser'` 时换成 `undefined`；
4. **只有 `process.env` 本身**（后面不是上面两种写法，例如 `process.env[name]`、解构）：`'server'` 时保留原样；`'browser'` 时换成 `({})`，并计数；
5. 返回 `{ code, inlined, dynamic }`：替换之后的代码；第 2 条中被替换的变量的名字，按名字排序、不重复；第 4 条中替换的次数。

第 3、4 条中浏览器的部分是一个简化：真实的 Next.js 不改这些代码，而是在浏览器中提供一个 `process` 的替身，它的 `env` 是一个空的对象，所以读到的同样是 `undefined`。练习中直接写出读到的结果，更容易检查。

:::files{role=starter}
```ts file=inline-env.ts
export type Target = 'browser' | 'server';

export type InlineResult = Readonly<{
  code: string;
  /** 被替换成构建时的值的 NEXT_PUBLIC_ 变量，按名字排序，不重复 */
  inlined: string[];
  /** 浏览器的代码中，被换成空对象的 process.env（动态的读取） */
  dynamic: number;
}>;

/** 模拟 next build 对 process.env 的处理 */
export function inlinePublicEnv(code: string, env: Readonly<Record<string, string | undefined>>, target: Target): InlineResult {
  // TODO
  return { code, inlined: [], dynamic: 0 };
}
```
```ts file=main.ts readonly
import { inlinePublicEnv } from './inline-env';

const source = `
const analytics = process.env.NEXT_PUBLIC_ANALYTICS_ID;
const db = process.env.DATABASE_URL;
const name = 'NEXT_PUBLIC_' + 'ANALYTICS_ID';
const dynamic = process.env[name];
`;
const env = { NEXT_PUBLIC_ANALYTICS_ID: 'G-12345', DATABASE_URL: 'postgres://app:secret@db/app' };

for (const target of ['browser', 'server'] as const) {
  const { code, inlined, dynamic } = inlinePublicEnv(source, env, target);
  console.log(`--- ${target}：替换了 ${inlined.join('、')}，动态的读取 ${dynamic} 处${code}`);
}
```
:::

:::files{role=solution}
```ts file=inline-env.ts
export type Target = 'browser' | 'server';

export type InlineResult = Readonly<{
  code: string;
  /** 被替换成构建时的值的 NEXT_PUBLIC_ 变量，按名字排序，不重复 */
  inlined: string[];
  /** 浏览器的代码中，被换成空对象的 process.env（动态的读取） */
  dynamic: number;
}>;

/**
 * process.env 后面跟着 .NAME 或者 ['NAME'] / ["NAME"]；前面不能是标识符的字符或者“.”，
 * 这样 myprocess.env、a.process.env 都不算
 */
const ACCESS = /(?<![\w$.])process\.env(?![\w$])(?:\.([A-Za-z_$][\w$]*)|\[\s*(['"])([A-Za-z_$][\w$]*)\2\s*\])?/g;

/** 模拟 next build 对 process.env 的处理 */
export function inlinePublicEnv(code: string, env: Readonly<Record<string, string | undefined>>, target: Target): InlineResult {
  const inlined = new Set<string>();
  let dynamic = 0;
  const output = code.replace(ACCESS, (whole: string, dotName?: string, _quote?: string, bracketName?: string) => {
    const name = dotName ?? bracketName;
    if (name === undefined) {
      // 只有 process.env 本身：浏览器中它是一个空对象，运行时才确定的名字都读不到
      if (target === 'server') return whole;
      dynamic += 1;
      // 加上括号：({}) 在任何位置都是一个表达式，不会被当成代码块
      return '({})';
    }
    if (name.startsWith('NEXT_PUBLIC_')) {
      const value = env[name];
      if (value !== undefined) {
        inlined.add(name);
        return JSON.stringify(value);
      }
    }
    // 其他的变量，以及构建时没有值的 NEXT_PUBLIC_ 变量：服务器上在运行时读取；浏览器中读不到
    return target === 'server' ? whole : 'undefined';
  });
  return { code: output, inlined: [...inlined].toSorted(), dynamic };
}
```
```ts file=main.ts readonly
import { inlinePublicEnv } from './inline-env';

const source = `
const analytics = process.env.NEXT_PUBLIC_ANALYTICS_ID;
const db = process.env.DATABASE_URL;
const name = 'NEXT_PUBLIC_' + 'ANALYTICS_ID';
const dynamic = process.env[name];
`;
const env = { NEXT_PUBLIC_ANALYTICS_ID: 'G-12345', DATABASE_URL: 'postgres://app:secret@db/app' };

for (const target of ['browser', 'server'] as const) {
  const { code, inlined, dynamic } = inlinePublicEnv(source, env, target);
  console.log(`--- ${target}：替换了 ${inlined.join('、')}，动态的读取 ${dynamic} 处${code}`);
}
```
:::

:::files{role=tests}
```ts file=inline-env.test.ts
import { describe, expect, test } from 'vitest';
import { inlinePublicEnv } from './inline-env';

const ENV = { NEXT_PUBLIC_GREETING: 'hello-from-env', NEXT_PUBLIC_QUOTE: 'say "hi"\n', LAB_SECRET: 'secret-value-7c1d' };

describe('inlinePublicEnv', () => {
  test('浏览器：NEXT_PUBLIC_ 换成构建时的值（JSON 字符串），其他的变量换成 undefined', () => {
    const code = 'setup(process.env.NEXT_PUBLIC_GREETING, process.env.LAB_SECRET);';
    expect(inlinePublicEnv(code, ENV, 'browser')).toStrictEqual({
      code: 'setup("hello-from-env", undefined);',
      inlined: ['NEXT_PUBLIC_GREETING'],
      dynamic: 0,
    });
  });

  test('值中的引号和换行用 JSON 的写法转义；浏览器中，构建时没有值的 NEXT_PUBLIC_ 变量是 undefined，不算被替换', () => {
    const code = 'a(process.env.NEXT_PUBLIC_QUOTE); b(process.env.NEXT_PUBLIC_MISSING);';
    expect(inlinePublicEnv(code, ENV, 'browser')).toStrictEqual({ code: 'a("say \\"hi\\"\\n"); b(undefined);', inlined: ['NEXT_PUBLIC_QUOTE'], dynamic: 0 });
  });

  test('服务器：有值的 NEXT_PUBLIC_ 同样被替换（实测启动时的新值不会生效）；其他的变量和没有值的 NEXT_PUBLIC_ 留到运行时读取', () => {
    const code = 'const url = process.env.DATABASE_URL; const hi = process.env.NEXT_PUBLIC_GREETING; const later = process.env.NEXT_PUBLIC_MISSING; const all = process.env;';
    expect(inlinePublicEnv(code, ENV, 'server')).toStrictEqual({
      code: 'const url = process.env.DATABASE_URL; const hi = "hello-from-env"; const later = process.env.NEXT_PUBLIC_MISSING; const all = process.env;',
      inlined: ['NEXT_PUBLIC_GREETING'],
      dynamic: 0,
    });
  });

  test('字符串字面量的下标和点的写法一样', () => {
    const code = "x(process.env['NEXT_PUBLIC_GREETING'], process.env[\"LAB_SECRET\"], process.env[ 'NEXT_PUBLIC_GREETING' ]);";
    expect(inlinePublicEnv(code, ENV, 'browser')).toStrictEqual({ code: 'x("hello-from-env", undefined, "hello-from-env");', inlined: ['NEXT_PUBLIC_GREETING'], dynamic: 0 });
  });

  test('浏览器中只剩 process.env 本身（动态的读取、解构）：换成 ({})，并且计数', () => {
    const code = 'const v = process.env[name]; const { NEXT_PUBLIC_GREETING } = process.env;';
    expect(inlinePublicEnv(code, ENV, 'browser')).toStrictEqual({
      code: 'const v = ({})[name]; const { NEXT_PUBLIC_GREETING } = ({});',
      inlined: [],
      dynamic: 2,
    });
  });

  test('inlined 按名字排序，同一个变量只出现一次', () => {
    const code = 'f(process.env.NEXT_PUBLIC_Z, process.env.NEXT_PUBLIC_A, process.env.NEXT_PUBLIC_Z, process.env.NEXT_PUBLIC_NONE, process.env.LAB_SECRET);';
    expect(inlinePublicEnv(code, { NEXT_PUBLIC_Z: 'z', NEXT_PUBLIC_A: 'a', LAB_SECRET: 's' }, 'browser').inlined).toStrictEqual(['NEXT_PUBLIC_A', 'NEXT_PUBLIC_Z']);
  });

  test('只认独立的 process.env：更长的名字、对象的属性都不算', () => {
    const code = 'myprocess.env.NEXT_PUBLIC_GREETING; obj.process.env.LAB_SECRET; process.envelope; process.environment.x; $process.env;';
    expect(inlinePublicEnv(code, ENV, 'browser')).toStrictEqual({ code, inlined: [], dynamic: 0 });
  });

  test('替换之后可以继续访问属性', () => {
    expect(inlinePublicEnv('process.env.NEXT_PUBLIC_GREETING.length', ENV, 'browser').code).toBe('"hello-from-env".length');
  });
});
```
:::

:::hint{level=1}
一个正则就能找出所有的访问：`(?<![\w$.])process\.env(?![\w$])` 后面跟一个可选的分组，里面是 `\.名字` 或者 `\[\s*(['"])名字\2\s*\]` 两种写法。注意组号：放进完整的正则之后，第一个“名字”是第 1 组，引号是第 2 组，所以这里用 `\2`。`replace` 的替换函数中，两个“名字”分组都是 `undefined` 时，就是只有 `process.env` 本身。
:::

:::hint{level=2}
用 `(?<!…)`（后行断言）检查前一个字符，`(?!…)`（先行断言）检查后一个字符：它们只检查、不消耗字符，替换时不会把前后的字符也换掉。`inlined` 用一个 `Set` 收集，最后 `[...set].toSorted()`。
:::

:::explanation
“内联”的意思是：构建时把变量的**值**直接写进代码。所以有两个后果，正文中都实测到了：

- 构建之后再修改环境变量，`NEXT_PUBLIC_` 变量不会变。实测用 `NEXT_PUBLIC_GREETING=runtime-value` 启动构建好的服务器，浏览器和服务器的代码中读到的都还是构建时的 `hello-from-env`；只有在服务器上用运行时才确定的名字读取（`process.env[name]`，`name` 来自请求），才读到了新的值；
- 被内联的值就在发给浏览器的 JavaScript 中：实测在 `.next/static/` 的一个代码块中找到了 `hello-from-env`，而没有 `NEXT_PUBLIC_` 前缀的 `LAB_SECRET` 的值不在任何一个代码块中。所以 `NEXT_PUBLIC_` 变量**一定不能**是密钥。

构建时没有值的 `NEXT_PUBLIC_` 变量不会被替换：服务器的代码在运行时读取它，浏览器中读到的是 `undefined`。

浏览器中的 `process.env` 是一个空的对象：实测 `Object.keys(process.env)` 是 `[]`，用 `location.hash` 中的名字读取得到的是 `undefined`。文档说 `const env = process.env; env.NEXT_PUBLIC_X` 和用变量名的 `process.env[name]` 不会被内联，但实测 Next.js 16.4.2（Turbopack）认出了常量的名字和这样的别名，照样替换了。这种“聪明”不应该依赖：只用直接写出的 `process.env.NEXT_PUBLIC_X`，这个练习也只认这种写法（和字符串字面量的下标）。

练习还省略了两个例外：`process.env.NODE_ENV` 也会被替换成构建时的值；`next.config` 的 `env` 选项中列出的变量总是被写进代码，不管有没有前缀（正文中有说明）。

替代解不用一个大正则，而是用 `indexOf` 逐个找出 `process.env`，再看它前后的字符和后面跟着的写法。
:::

:::variant{kind=alt name=index-scan}
```ts file=inline-env.ts
export type Target = 'browser' | 'server';

export type InlineResult = Readonly<{
  code: string;
  /** 被替换成构建时的值的 NEXT_PUBLIC_ 变量，按名字排序，不重复 */
  inlined: string[];
  /** 浏览器的代码中，被换成空对象的 process.env（动态的读取） */
  dynamic: number;
}>;

const NEEDLE = 'process.env';
const isIdentChar = (char: string) => /[\w$]/.test(char);

/** 从 position 开始读一个标识符 */
function identifierAt(code: string, position: number): string {
  const match = /^[A-Za-z_$][\w$]*/.exec(code.slice(position));
  return match?.[0] ?? '';
}

/** 不用一个大正则：逐个找出 process.env，再看它后面跟着什么 */
export function inlinePublicEnv(code: string, env: Readonly<Record<string, string | undefined>>, target: Target): InlineResult {
  const inlined = new Set<string>();
  let dynamic = 0;
  let output = '';
  let from = 0;
  for (let at = code.indexOf(NEEDLE); at !== -1; at = code.indexOf(NEEDLE, at + 1)) {
    const before = code.charAt(at - 1);
    let end = at + NEEDLE.length;
    if (at < from || (at > 0 && (isIdentChar(before) || before === '.')) || isIdentChar(code.charAt(end))) continue;

    let name = '';
    if (code.charAt(end) === '.') {
      name = identifierAt(code, end + 1);
      if (name !== '') end += 1 + name.length;
    } else {
      const bracket = /^\[\s*(['"])([A-Za-z_$][\w$]*)\1\s*\]/.exec(code.slice(end));
      if (bracket !== null) {
        name = bracket[2] ?? '';
        end += bracket[0].length;
      }
    }

    // 构建时有值的 NEXT_PUBLIC_ 变量
    const value = name.startsWith('NEXT_PUBLIC_') ? env[name] : undefined;
    let replacement: string;
    if (name === '') {
      if (target === 'server') continue;
      dynamic += 1;
      replacement = '({})';
    } else if (value !== undefined) {
      inlined.add(name);
      replacement = JSON.stringify(value);
    } else if (target === 'server') {
      continue;
    } else {
      replacement = 'undefined';
    }
    output += code.slice(from, at) + replacement;
    from = end;
  }
  output += code.slice(from);
  return { code: output, inlined: [...inlined].toSorted(), dynamic };
}
```
:::

:::variant{kind=wrong name=server-not-inlined fails=tests reason="服务器的代码中没有替换 NEXT_PUBLIC_：实测服务器上直接写出的 process.env.NEXT_PUBLIC_… 读到的也是构建时的值"}
```ts file=inline-env.ts
export type Target = 'browser' | 'server';

export type InlineResult = Readonly<{
  code: string;
  /** 被替换成构建时的值的 NEXT_PUBLIC_ 变量，按名字排序，不重复 */
  inlined: string[];
  /** 浏览器的代码中，被换成空对象的 process.env（动态的读取） */
  dynamic: number;
}>;

/**
 * process.env 后面跟着 .NAME 或者 ['NAME'] / ["NAME"]；前面不能是标识符的字符或者“.”，
 * 这样 myprocess.env、a.process.env 都不算
 */
const ACCESS = /(?<![\w$.])process\.env(?![\w$])(?:\.([A-Za-z_$][\w$]*)|\[\s*(['"])([A-Za-z_$][\w$]*)\2\s*\])?/g;

/** 模拟 next build 对 process.env 的处理 */
export function inlinePublicEnv(code: string, env: Readonly<Record<string, string | undefined>>, target: Target): InlineResult {
  const inlined = new Set<string>();
  let dynamic = 0;
  const output = code.replace(ACCESS, (whole: string, dotName?: string, _quote?: string, bracketName?: string) => {
    const name = dotName ?? bracketName;
    if (name === undefined) {
      // 只有 process.env 本身：浏览器中它是一个空对象，运行时才确定的名字都读不到
      if (target === 'server') return whole;
      dynamic += 1;
      // 加上括号：({}) 在任何位置都是一个表达式，不会被当成代码块
      return '({})';
    }
    if (name.startsWith('NEXT_PUBLIC_') && target === 'browser') {
      const value = env[name];
      if (value !== undefined) {
        inlined.add(name);
        return JSON.stringify(value);
      }
    }
    // 其他的变量，以及构建时没有值的 NEXT_PUBLIC_ 变量：服务器上在运行时读取；浏览器中读不到
    return target === 'server' ? whole : 'undefined';
  });
  return { code: output, inlined: [...inlined].toSorted(), dynamic };
}
```
:::

:::variant{kind=wrong name=missing-public-replaced fails=tests reason="构建时没有值的 NEXT_PUBLIC_ 变量也被替换了：服务器的代码中它本来要在运行时读取"}
```ts file=inline-env.ts
export type Target = 'browser' | 'server';

export type InlineResult = Readonly<{
  code: string;
  /** 被替换成构建时的值的 NEXT_PUBLIC_ 变量，按名字排序，不重复 */
  inlined: string[];
  /** 浏览器的代码中，被换成空对象的 process.env（动态的读取） */
  dynamic: number;
}>;

/**
 * process.env 后面跟着 .NAME 或者 ['NAME'] / ["NAME"]；前面不能是标识符的字符或者“.”，
 * 这样 myprocess.env、a.process.env 都不算
 */
const ACCESS = /(?<![\w$.])process\.env(?![\w$])(?:\.([A-Za-z_$][\w$]*)|\[\s*(['"])([A-Za-z_$][\w$]*)\2\s*\])?/g;

/** 模拟 next build 对 process.env 的处理 */
export function inlinePublicEnv(code: string, env: Readonly<Record<string, string | undefined>>, target: Target): InlineResult {
  const inlined = new Set<string>();
  let dynamic = 0;
  const output = code.replace(ACCESS, (whole: string, dotName?: string, _quote?: string, bracketName?: string) => {
    const name = dotName ?? bracketName;
    if (name === undefined) {
      // 只有 process.env 本身：浏览器中它是一个空对象，运行时才确定的名字都读不到
      if (target === 'server') return whole;
      dynamic += 1;
      // 加上括号：({}) 在任何位置都是一个表达式，不会被当成代码块
      return '({})';
    }
    if (name.startsWith('NEXT_PUBLIC_')) {
      const value = env[name];
      inlined.add(name);
      return value === undefined ? 'undefined' : JSON.stringify(value);
    }
    // 其他的变量，以及构建时没有值的 NEXT_PUBLIC_ 变量：服务器上在运行时读取；浏览器中读不到
    return target === 'server' ? whole : 'undefined';
  });
  return { code: output, inlined: [...inlined].toSorted(), dynamic };
}
```
:::

:::variant{kind=wrong name=dot-only fails=tests reason="只认 process.env.NAME：process.env['NAME'] 的写法没有被替换"}
```ts file=inline-env.ts
export type Target = 'browser' | 'server';

export type InlineResult = Readonly<{
  code: string;
  /** 被替换成构建时的值的 NEXT_PUBLIC_ 变量，按名字排序，不重复 */
  inlined: string[];
  /** 浏览器的代码中，被换成空对象的 process.env（动态的读取） */
  dynamic: number;
}>;

/**
 * process.env 后面跟着 .NAME 或者 ['NAME'] / ["NAME"]；前面不能是标识符的字符或者“.”，
 * 这样 myprocess.env、a.process.env 都不算
 */
const ACCESS = /(?<![\w$.])process\.env(?![\w$])(?:\.([A-Za-z_$][\w$]*))?()()/g;

/** 模拟 next build 对 process.env 的处理 */
export function inlinePublicEnv(code: string, env: Readonly<Record<string, string | undefined>>, target: Target): InlineResult {
  const inlined = new Set<string>();
  let dynamic = 0;
  const output = code.replace(ACCESS, (whole: string, dotName?: string, _quote?: string, bracketName?: string) => {
    const name = dotName ?? bracketName;
    if (name === undefined) {
      // 只有 process.env 本身：浏览器中它是一个空对象，运行时才确定的名字都读不到
      if (target === 'server') return whole;
      dynamic += 1;
      // 加上括号：({}) 在任何位置都是一个表达式，不会被当成代码块
      return '({})';
    }
    if (name.startsWith('NEXT_PUBLIC_')) {
      const value = env[name];
      if (value !== undefined) {
        inlined.add(name);
        return JSON.stringify(value);
      }
    }
    // 其他的变量，以及构建时没有值的 NEXT_PUBLIC_ 变量：服务器上在运行时读取；浏览器中读不到
    return target === 'server' ? whole : 'undefined';
  });
  return { code: output, inlined: [...inlined].toSorted(), dynamic };
}
```
:::

:::variant{kind=wrong name=raw-value fails=tests reason="把值直接放进代码，没有加引号和转义：值变成了代码"}
```ts file=inline-env.ts
export type Target = 'browser' | 'server';

export type InlineResult = Readonly<{
  code: string;
  /** 被替换成构建时的值的 NEXT_PUBLIC_ 变量，按名字排序，不重复 */
  inlined: string[];
  /** 浏览器的代码中，被换成空对象的 process.env（动态的读取） */
  dynamic: number;
}>;

/**
 * process.env 后面跟着 .NAME 或者 ['NAME'] / ["NAME"]；前面不能是标识符的字符或者“.”，
 * 这样 myprocess.env、a.process.env 都不算
 */
const ACCESS = /(?<![\w$.])process\.env(?![\w$])(?:\.([A-Za-z_$][\w$]*)|\[\s*(['"])([A-Za-z_$][\w$]*)\2\s*\])?/g;

/** 模拟 next build 对 process.env 的处理 */
export function inlinePublicEnv(code: string, env: Readonly<Record<string, string | undefined>>, target: Target): InlineResult {
  const inlined = new Set<string>();
  let dynamic = 0;
  const output = code.replace(ACCESS, (whole: string, dotName?: string, _quote?: string, bracketName?: string) => {
    const name = dotName ?? bracketName;
    if (name === undefined) {
      // 只有 process.env 本身：浏览器中它是一个空对象，运行时才确定的名字都读不到
      if (target === 'server') return whole;
      dynamic += 1;
      // 加上括号：({}) 在任何位置都是一个表达式，不会被当成代码块
      return '({})';
    }
    if (name.startsWith('NEXT_PUBLIC_')) {
      const value = env[name];
      if (value !== undefined) {
        inlined.add(name);
        return value;
      }
    }
    // 其他的变量，以及构建时没有值的 NEXT_PUBLIC_ 变量：服务器上在运行时读取；浏览器中读不到
    return target === 'server' ? whole : 'undefined';
  });
  return { code: output, inlined: [...inlined].toSorted(), dynamic };
}
```
:::

:::variant{kind=wrong name=no-boundary fails=tests reason="没有检查前一个字符：myprocess.env、obj.process.env 也被替换了"}
```ts file=inline-env.ts
export type Target = 'browser' | 'server';

export type InlineResult = Readonly<{
  code: string;
  /** 被替换成构建时的值的 NEXT_PUBLIC_ 变量，按名字排序，不重复 */
  inlined: string[];
  /** 浏览器的代码中，被换成空对象的 process.env（动态的读取） */
  dynamic: number;
}>;

/**
 * process.env 后面跟着 .NAME 或者 ['NAME'] / ["NAME"]；前面不能是标识符的字符或者“.”，
 * 这样 myprocess.env、a.process.env 都不算
 */
const ACCESS = /process\.env(?![\w$])(?:\.([A-Za-z_$][\w$]*)|\[\s*(['"])([A-Za-z_$][\w$]*)\2\s*\])?/g;

/** 模拟 next build 对 process.env 的处理 */
export function inlinePublicEnv(code: string, env: Readonly<Record<string, string | undefined>>, target: Target): InlineResult {
  const inlined = new Set<string>();
  let dynamic = 0;
  const output = code.replace(ACCESS, (whole: string, dotName?: string, _quote?: string, bracketName?: string) => {
    const name = dotName ?? bracketName;
    if (name === undefined) {
      // 只有 process.env 本身：浏览器中它是一个空对象，运行时才确定的名字都读不到
      if (target === 'server') return whole;
      dynamic += 1;
      // 加上括号：({}) 在任何位置都是一个表达式，不会被当成代码块
      return '({})';
    }
    if (name.startsWith('NEXT_PUBLIC_')) {
      const value = env[name];
      if (value !== undefined) {
        inlined.add(name);
        return JSON.stringify(value);
      }
    }
    // 其他的变量，以及构建时没有值的 NEXT_PUBLIC_ 变量：服务器上在运行时读取；浏览器中读不到
    return target === 'server' ? whole : 'undefined';
  });
  return { code: output, inlined: [...inlined].toSorted(), dynamic };
}
```
:::

:::variant{kind=wrong name=bare-on-server fails=tests reason="服务器的代码中也把 process.env 换成了空对象：服务器上运行时的环境变量全都读不到了"}
```ts file=inline-env.ts
export type Target = 'browser' | 'server';

export type InlineResult = Readonly<{
  code: string;
  /** 被替换成构建时的值的 NEXT_PUBLIC_ 变量，按名字排序，不重复 */
  inlined: string[];
  /** 浏览器的代码中，被换成空对象的 process.env（动态的读取） */
  dynamic: number;
}>;

/**
 * process.env 后面跟着 .NAME 或者 ['NAME'] / ["NAME"]；前面不能是标识符的字符或者“.”，
 * 这样 myprocess.env、a.process.env 都不算
 */
const ACCESS = /(?<![\w$.])process\.env(?![\w$])(?:\.([A-Za-z_$][\w$]*)|\[\s*(['"])([A-Za-z_$][\w$]*)\2\s*\])?/g;

/** 模拟 next build 对 process.env 的处理 */
export function inlinePublicEnv(code: string, env: Readonly<Record<string, string | undefined>>, target: Target): InlineResult {
  const inlined = new Set<string>();
  let dynamic = 0;
  const output = code.replace(ACCESS, (whole: string, dotName?: string, _quote?: string, bracketName?: string) => {
    const name = dotName ?? bracketName;
    if (name === undefined) {
      // 只有 process.env 本身：浏览器中它是一个空对象，运行时才确定的名字都读不到
      dynamic += 1;
      // 加上括号：({}) 在任何位置都是一个表达式，不会被当成代码块
      return '({})';
    }
    if (name.startsWith('NEXT_PUBLIC_')) {
      const value = env[name];
      if (value !== undefined) {
        inlined.add(name);
        return JSON.stringify(value);
      }
    }
    // 其他的变量，以及构建时没有值的 NEXT_PUBLIC_ 变量：服务器上在运行时读取；浏览器中读不到
    return target === 'server' ? whole : 'undefined';
  });
  return { code: output, inlined: [...inlined].toSorted(), dynamic };
}
```
:::

:::variant{kind=wrong name=braces-without-parens fails=tests reason="换成没有括号的 {}：在一条语句的开头，它会被当成一个代码块"}
```ts file=inline-env.ts
export type Target = 'browser' | 'server';

export type InlineResult = Readonly<{
  code: string;
  /** 被替换成构建时的值的 NEXT_PUBLIC_ 变量，按名字排序，不重复 */
  inlined: string[];
  /** 浏览器的代码中，被换成空对象的 process.env（动态的读取） */
  dynamic: number;
}>;

/**
 * process.env 后面跟着 .NAME 或者 ['NAME'] / ["NAME"]；前面不能是标识符的字符或者“.”，
 * 这样 myprocess.env、a.process.env 都不算
 */
const ACCESS = /(?<![\w$.])process\.env(?![\w$])(?:\.([A-Za-z_$][\w$]*)|\[\s*(['"])([A-Za-z_$][\w$]*)\2\s*\])?/g;

/** 模拟 next build 对 process.env 的处理 */
export function inlinePublicEnv(code: string, env: Readonly<Record<string, string | undefined>>, target: Target): InlineResult {
  const inlined = new Set<string>();
  let dynamic = 0;
  const output = code.replace(ACCESS, (whole: string, dotName?: string, _quote?: string, bracketName?: string) => {
    const name = dotName ?? bracketName;
    if (name === undefined) {
      // 只有 process.env 本身：浏览器中它是一个空对象，运行时才确定的名字都读不到
      if (target === 'server') return whole;
      dynamic += 1;
      // 加上括号：({}) 在任何位置都是一个表达式，不会被当成代码块
      return '{}';
    }
    if (name.startsWith('NEXT_PUBLIC_')) {
      const value = env[name];
      if (value !== undefined) {
        inlined.add(name);
        return JSON.stringify(value);
      }
    }
    // 其他的变量，以及构建时没有值的 NEXT_PUBLIC_ 变量：服务器上在运行时读取；浏览器中读不到
    return target === 'server' ? whole : 'undefined';
  });
  return { code: output, inlined: [...inlined].toSorted(), dynamic };
}
```
:::

