---
kind: task
title: 读懂 .env 文件
---
在 `env-files.ts` 中实现 `resolveEnv(files, mode, processEnv)`，模拟 Next.js 读取 `.env*` 文件。`files` 是文件名到内容的映射，`mode` 是 `NODE_ENV`，`processEnv` 是启动时已经有的环境变量。规则来自随包的文档，测试中每一个期望的结果都用 Next.js 16.4.2 的加载器（`@next/env`）实际运行过。

1. **优先级**（从高到低）：`processEnv`、`.env.${mode}.local`、`.env.local`、`.env.${mode}`、`.env`。`mode` 是 `'test'` 时**不读** `.env.local`；不存在的文件跳过。`processEnv` 中有值的变量用它的值（空字符串也算有值，`undefined` 等于没有设置）；否则用优先级最高的、写了这个变量的文件中的值；
2. **解析**每一行（`\n` 或 `\r\n` 分隔）：去掉首尾的空白之后，空行和 `#` 开头的行跳过；格式是 `KEY=VALUE`，`=` 两边可以有空白，`KEY` 由字母、数字、下划线组成，不以数字开头；不符合格式的行忽略。同一个文件中同一个变量出现多次时，**后面的**生效；
3. **值**：
   - 用双引号或单引号括起来：去掉引号，引号后面还可以有空白和 `#` 开头的注释。双引号中的 `\n`（反斜杠加 n 两个字符）换成换行，单引号中的不换；
   - 没有引号：从**第一个** `#` 开始是注释，去掉；再去掉首尾的空白；
4. **展开**：文件中的每一个值（不管有没有引号）中的 `$NAME` 和 `${NAME}`（`NAME` 由字母、数字、下划线组成）换成变量 `NAME` 的值，`\$` 换成一个 `$`。`NAME` 的值按这个顺序找：`processEnv`；优先级更高的文件中已经确定的值；**当前这个文件**中的值（它如果也含有 `$`，先展开它）；都没有时是空字符串。也就是说，文件按优先级从高到低一个一个地处理，优先级更高的文件**看不到**只在更低的文件中定义的变量。测试中没有循环的引用；
5. 返回 `{ env, source }`：只包含在某个被读取的文件中出现过的变量。`env` 是最终的值，`source` 是它来自哪个文件，来自 `processEnv` 时是 `'process.env'`。

:::files{role=starter}
```ts file=env-files.ts
export type Mode = 'development' | 'production' | 'test';

export type Resolved = Readonly<{
  env: Readonly<Record<string, string>>;
  /** 每个变量的值来自哪里：文件名，或者 'process.env' */
  source: Readonly<Record<string, string>>;
}>;

/** 按 Next.js 的方式读取 .env 文件：从优先级最高的文件开始，一个文件一个文件地确定变量的值 */
export function resolveEnv(files: Readonly<Record<string, string>>, mode: Mode, processEnv: Readonly<Record<string, string | undefined>>): Resolved {
  // TODO
  return { env: {}, source: {} };
}
```
```ts file=main.ts
import { resolveEnv } from './env-files';

const files = {
  '.env': 'DB_HOST=localhost\nDATABASE_URL=postgres://app@$DB_HOST/app\nNEXT_PUBLIC_SITE=example.com\n',
  '.env.local': 'DB_HOST=127.0.0.1 # 我自己电脑上的数据库\n',
  '.env.production': 'DB_HOST=db.internal\n',
};

for (const mode of ['development', 'production', 'test'] as const) {
  console.log(mode, resolveEnv(files, mode, {}));
}
console.log('部署平台设置了 DB_HOST：', resolveEnv(files, 'production', { DB_HOST: 'db.prod' }).env);
```
:::

:::files{role=solution}
```ts file=env-files.ts
export type Mode = 'development' | 'production' | 'test';

export type Resolved = Readonly<{
  env: Readonly<Record<string, string>>;
  /** 每个变量的值来自哪里：文件名，或者 'process.env' */
  source: Readonly<Record<string, string>>;
}>;

/** 从高到低的优先级：先找到的生效 */
function filesFor(mode: Mode): string[] {
  return mode === 'test' ? ['.env.test.local', '.env.test', '.env'] : [`.env.${mode}.local`, '.env.local', `.env.${mode}`, '.env'];
}

const LINE = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;
/** 引号括起来的值，后面还可以有注释 */
const QUOTED = /^(["'])(.*?)\1\s*(?:#.*)?$/;
const REFERENCE = /\\\$|\$\{(\w+)\}|\$(\w+)/g;

/** 解析一个 .env 文件：空行和 # 开头的行跳过，不合格式的行忽略；同一个变量出现多次时，后面的生效 */
function parse(text: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = LINE.exec(line);
    if (match === null) continue;
    const [, key = '', rest = ''] = match;
    const quoted = QUOTED.exec(rest);
    let value: string;
    if (quoted === null) {
      // 没有引号：第一个 # 之后都是注释
      value = (rest.split('#')[0] ?? '').trim();
    } else {
      const [, quote, inner = ''] = quoted;
      value = quote === '"' ? inner.replaceAll('\\n', '\n') : inner;
    }
    result.set(key, value);
  }
  return result;
}

/** 按 Next.js 的方式读取 .env 文件：从优先级最高的文件开始，一个文件一个文件地确定变量的值 */
export function resolveEnv(files: Readonly<Record<string, string>>, mode: Mode, processEnv: Readonly<Record<string, string | undefined>>): Resolved {
  const env = new Map<string, string>();
  const source = new Map<string, string>();

  for (const name of filesFor(mode)) {
    const text = files[name];
    if (text === undefined) continue;
    const raw = parse(text);
    // 被引用的变量：process.env、优先级更高的文件（已经确定的值）、本文件（先展开它）
    const lookup = (key: string): string => processEnv[key] ?? env.get(key) ?? expand(raw.get(key) ?? '');
    const expand = (value: string): string =>
      value.replace(REFERENCE, (all, braced?: string, bare?: string) => {
        const key = braced ?? bare;
        return key === undefined ? '$' : lookup(key);
      });

    for (const [key, value] of raw) {
      if (env.has(key)) continue;
      const fromProcess = processEnv[key];
      env.set(key, fromProcess ?? expand(value));
      source.set(key, fromProcess === undefined ? name : 'process.env');
    }
  }
  return { env: Object.fromEntries(env), source: Object.fromEntries(source) };
}
```
```ts file=main.ts
import { resolveEnv } from './env-files';

const files = {
  '.env': 'DB_HOST=localhost\nDATABASE_URL=postgres://app@$DB_HOST/app\nNEXT_PUBLIC_SITE=example.com\n',
  '.env.local': 'DB_HOST=127.0.0.1 # 我自己电脑上的数据库\n',
  '.env.production': 'DB_HOST=db.internal\n',
};

for (const mode of ['development', 'production', 'test'] as const) {
  console.log(mode, resolveEnv(files, mode, {}));
}
console.log('部署平台设置了 DB_HOST：', resolveEnv(files, 'production', { DB_HOST: 'db.prod' }).env);
```
:::

:::files{role=tests}
```ts file=env-files.test.ts
import { describe, expect, test } from 'vitest';
import { resolveEnv } from './env-files';

/** 正文中实测项目的几个文件（只保留了相关的行）。下面每个测试的期望值都和 @next/env 16.4.2 的实际结果一致 */
const FILES = {
  '.env': 'LAB_SOURCE=.env\nLAB_C=.env\nLAB_PROCESS=.env\nLAB_USER=nextjs\nLAB_URL=https://x.com/$LAB_USER\nLAB_PRICE=\\$5\n',
  '.env.local': 'LAB_SOURCE=.env.local\nLAB_B=.env.local\n',
  '.env.production': 'LAB_SOURCE=.env.production\nLAB_B=.env.production\nLAB_C=.env.production\n',
  '.env.production.local': 'LAB_SOURCE=.env.production.local\n',
  '.env.development': 'LAB_SOURCE=.env.development\nLAB_DEV=yes\n',
};

describe('resolveEnv', () => {
  test('生产环境：实测的结果', () => {
    const { env, source } = resolveEnv(FILES, 'production', { LAB_PROCESS: 'from-process' });
    expect(env).toStrictEqual({
      LAB_SOURCE: '.env.production.local',
      LAB_C: '.env.production',
      LAB_PROCESS: 'from-process',
      LAB_USER: 'nextjs',
      LAB_URL: 'https://x.com/nextjs',
      LAB_PRICE: '$5',
      LAB_B: '.env.local',
    });
    expect(source).toStrictEqual({
      LAB_SOURCE: '.env.production.local',
      LAB_C: '.env.production',
      LAB_PROCESS: 'process.env',
      LAB_USER: '.env',
      LAB_URL: '.env',
      LAB_PRICE: '.env',
      LAB_B: '.env.local',
    });
  });

  test('开发环境：读 .env.development，不读 .env.production', () => {
    const { env } = resolveEnv(FILES, 'development', {});
    expect(env['LAB_SOURCE']).toBe('.env.local');
    expect(env['LAB_DEV']).toBe('yes');
    expect(env['LAB_C']).toBe('.env');
  });

  test('测试环境：不读 .env.local，读 .env.test 和 .env.test.local', () => {
    const files = { ...FILES, '.env.test': 'LAB_SOURCE=.env.test\nLAB_T=test\n', '.env.test.local': 'LAB_T=test.local\n' };
    const { env, source } = resolveEnv(files, 'test', {});
    expect(env['LAB_SOURCE']).toBe('.env.test');
    expect(env['LAB_T']).toBe('test.local');
    expect(env['LAB_B']).toBeUndefined();
    expect(source['LAB_T']).toBe('.env.test.local');
  });

  test('解析：空行、注释、空白、不合格式的行', () => {
    const text = '\n# 注释\n  A = 1  \nB=\nnot a line\nC=a=b\n';
    expect(resolveEnv({ '.env': text }, 'production', {}).env).toStrictEqual({ A: '1', B: '', C: 'a=b' });
  });

  test('同一个文件中出现两次：后面的生效', () => {
    expect(resolveEnv({ '.env': 'A=1\nB=$A\nA=2\n' }, 'production', {}).env).toStrictEqual({ A: '2', B: '2' });
  });

  test('引号和注释：没有引号时第一个 # 之后是注释；双引号中的 \\n 是换行，单引号中的不是；两种引号中的 $ 都展开', () => {
    const text = [
      'USER=nextjs',
      'KEY="line1\\nline2"',
      'Q="hi $USER # not a comment"',
      "S='$USER too'",
      "T='a\\nb'",
      'U=value # 注释',
      'H=a#b',
      'P="a#b"',
      'R="abc" # 注释',
    ].join('\n');
    expect(resolveEnv({ '.env': text }, 'production', {}).env).toStrictEqual({
      USER: 'nextjs',
      KEY: 'line1\nline2',
      Q: 'hi nextjs # not a comment',
      S: 'nextjs too',
      T: 'a\\nb',
      U: 'value',
      H: 'a',
      P: 'a#b',
      R: 'abc',
    });
  });

  test('展开：$NAME 和 ${NAME}；不存在的是空字符串；\\$ 是 $', () => {
    const files = {
      '.env': 'HOST=localhost\nURL=http://${HOST}:$PORT/db\nMISSING=[$NOPE]\nPRICE=\\$10\n',
      '.env.local': 'HOST=db.local\n',
    };
    expect(resolveEnv(files, 'production', { PORT: '5432' }).env).toStrictEqual({
      HOST: 'db.local',
      URL: 'http://db.local:5432/db',
      MISSING: '[]',
      PRICE: '$10',
    });
  });

  test('展开时 process.env 中的值优先', () => {
    const { env, source } = resolveEnv({ '.env': 'HOST=localhost\nURL=http://$HOST\n' }, 'production', { HOST: 'db.prod' });
    expect(env).toStrictEqual({ HOST: 'db.prod', URL: 'http://db.prod' });
    expect(source).toStrictEqual({ HOST: 'process.env', URL: '.env' });
  });

  test('展开是递归的：被引用的变量中的 $ 也要展开', () => {
    expect(resolveEnv({ '.env': 'A=$B\nB=$C\nC=end\nD=${A}!\n' }, 'production', {}).env).toStrictEqual({ A: 'end', B: 'end', C: 'end', D: 'end!' });
  });

  test('一个文件一个文件地处理：优先级更高的文件看不到只在更低的文件中定义的变量', () => {
    const files = {
      '.env': 'DB_HOST=localhost\nGREETING=hi $WHO\n',
      '.env.local': 'WHO=me\nDATABASE_URL=postgres://app@$DB_HOST/app\n',
    };
    expect(resolveEnv(files, 'production', {}).env).toStrictEqual({
      WHO: 'me',
      DATABASE_URL: 'postgres://app@/app',
      DB_HOST: 'localhost',
      GREETING: 'hi me',
    });
  });

  test('processEnv 中的空字符串是设置了；undefined 等于没有设置', () => {
    const { env, source } = resolveEnv({ '.env': 'A=1\nB=2\n' }, 'production', { A: '', B: undefined });
    expect(env).toStrictEqual({ A: '', B: '2' });
    expect(source).toStrictEqual({ A: 'process.env', B: '.env' });
  });

  test('只包含文件中出现过的变量', () => {
    expect(resolveEnv({ '.env': 'A=1\n' }, 'production', { PATH: '/usr/bin', A: '2' }).env).toStrictEqual({ A: '2' });
  });
});
```
:::

:::hint{level=1}
从优先级最高的文件开始，一个文件一个文件地处理：先把文件解析成一个 `Map`（同名的变量后面的覆盖前面的），再逐个确定其中还没有确定的变量。一个变量第一次出现时就确定了它的值，之后的文件不再改它。
:::

:::hint{level=2}
一行用 `/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/` 匹配；引号括起来的值用 `/^(["'])(.*?)\1\s*(?:#.*)?$/`。展开用 `replace` 和一个有三个分支的正则：`\\\$`、`\$\{(\w+)\}`、`\$(\w+)`。查找被引用的变量写成一个函数 `lookup(name)`：先 `processEnv`，再已经确定的值，最后是本文件中的值，对它再调用一次展开（递归）。
:::

:::explanation
这些规则看起来琐碎，但每一条都对应一个真实的需求。`.env` 中是默认值；`.env.local` 是每个人自己电脑上的设置（例如本地数据库的地址）；`.env.production` 是生产环境的默认值。`process.env` 优先于所有的文件，部署平台上设置的变量胜过文件中的。测试时不读 `.env.local`，是为了让每个人运行测试的结果都一样。注意这个顺序和 e13 中的 Vite **不一样**：Vite 中 `.env.production` 胜过 `.env.local`，Next.js 中正好相反。

正文中实测项目的结果和这些规则一致：同一个变量写在四个文件中，生产环境中生效的是 `.env.production.local`；`.env.local` 胜过 `.env.production`；启动时设置的 `LAB_PROCESS` 胜过 `.env`；`https://x.com/$LAB_USER` 被展开了，`\$5` 变成了 `$5`。

几条和直觉不同的规则，正文的“常见错误”中都有：没有引号时 `a#b` 读到的是 `a`；单引号不能阻止展开（这和 shell 不同）；优先级高的文件引用只写在 `.env` 中的变量，得到的是空字符串。

真实的实现（`@next/env` 使用的 dotenv 和 dotenv-expand）还处理了更多的情况，测试中都没有出现：跨越多行的引号；`export A=1` 这样的写法和 `B.C`、`D-E`、`1BAD` 这样的名字；双引号中的 `\r`；`${X:-默认值}`。它的展开是从右向左一段一段地替换文本，所以还有几个奇怪的边界情况，例如被引用的变量的值中有 `\$` 得到的 `$` 时，这个 `$` 会被再展开一次。练习还简化了一点：真实的加载器中，如果 `processEnv` 中的变量也写在了某个文件中，它的值也会被展开一次，部署平台上设置的 `pa$$word` 会变成 `pa$`（正文的常见错误中有这个例子）；练习中 `processEnv` 的值原样使用，测试中也没有这种情况。

替代解不用正则解析一行，而是用 `indexOf` 找 `=`、引号和 `#`；展开时把本文件中展开过的值记在一个 `Map` 中，同一个变量只展开一次。
:::

:::variant{kind=alt name=index-parse}
```ts file=env-files.ts
export type Mode = 'development' | 'production' | 'test';

export type Resolved = Readonly<{
  env: Readonly<Record<string, string>>;
  /** 每个变量的值来自哪里：文件名，或者 'process.env' */
  source: Readonly<Record<string, string>>;
}>;

/** 一行 KEY=VALUE 中 = 之后的部分：返回值本身 */
function readValue(rest: string): string {
  const quote = rest.charAt(0);
  if (quote === '"' || quote === "'") {
    const end = rest.indexOf(quote, 1);
    const after = rest.slice(end + 1).trim();
    // 有配对的引号，并且后面没有东西或者只有注释
    if (end > 0 && (after === '' || after.startsWith('#'))) {
      const inner = rest.slice(1, end);
      return quote === '"' ? inner.split('\\n').join('\n') : inner;
    }
  }
  const hash = rest.indexOf('#');
  return (hash === -1 ? rest : rest.slice(0, hash)).trim();
}

function parse(text: string): Map<string, string> {
  const entries = new Map<string, string>();
  for (const line of text.split(/\r?\n/).map((l) => l.trim())) {
    const at = line.indexOf('=');
    const key = line.slice(0, at).trim();
    if (line.startsWith('#') || at < 1 || !/^[A-Za-z_]\w*$/.test(key)) continue;
    entries.set(key, readValue(line.slice(at + 1).trim()));
  }
  return entries;
}

export function resolveEnv(files: Readonly<Record<string, string>>, mode: Mode, processEnv: Readonly<Record<string, string | undefined>>): Resolved {
  const order = [`.env.${mode}.local`, ...(mode === 'test' ? [] : ['.env.local']), `.env.${mode}`, '.env'];
  const env: Record<string, string> = {};
  const source: Record<string, string> = {};
  // 已经确定的值：先放入 process.env 中的，之后每处理完一个文件就加入它的变量
  const known = new Map<string, string>();
  for (const [key, value] of Object.entries(processEnv)) if (value !== undefined) known.set(key, value);

  for (const name of order) {
    const text = files[name];
    if (text === undefined) continue;
    const entries = parse(text);
    const expanded = new Map<string, string>();
    const resolve = (key: string): string => {
      const fixed = known.get(key) ?? expanded.get(key);
      if (fixed !== undefined) return fixed;
      const value = expand(entries.get(key) ?? '');
      if (entries.has(key)) expanded.set(key, value);
      return value;
    };
    const expand = (value: string): string =>
      value.replace(/\\\$|\$(?:\{(\w+)\}|(\w+))/g, (token: string, braced: string | undefined, bare: string | undefined) => (token === '\\$' ? '$' : resolve(braced ?? bare ?? '')));

    for (const key of entries.keys()) {
      if (Object.hasOwn(env, key)) continue;
      env[key] = resolve(key);
      source[key] = processEnv[key] === undefined ? name : 'process.env';
    }
    for (const key of entries.keys()) known.set(key, env[key] ?? '');
  }
  return { env, source };
}
```
:::

:::variant{kind=wrong name=local-before-mode-local fails=tests reason="把 .env.local 放在 .env.production.local 前面：只针对生产环境的本地设置被覆盖了"}
```ts file=env-files.ts
export type Mode = 'development' | 'production' | 'test';

export type Resolved = Readonly<{
  env: Readonly<Record<string, string>>;
  /** 每个变量的值来自哪里：文件名，或者 'process.env' */
  source: Readonly<Record<string, string>>;
}>;

/** 从高到低的优先级：先找到的生效 */
function filesFor(mode: Mode): string[] {
  return mode === 'test' ? ['.env.test.local', '.env.test', '.env'] : ['.env.local', `.env.${mode}.local`, `.env.${mode}`, '.env'];
}

const LINE = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;
/** 引号括起来的值，后面还可以有注释 */
const QUOTED = /^(["'])(.*?)\1\s*(?:#.*)?$/;
const REFERENCE = /\\\$|\$\{(\w+)\}|\$(\w+)/g;

/** 解析一个 .env 文件：空行和 # 开头的行跳过，不合格式的行忽略；同一个变量出现多次时，后面的生效 */
function parse(text: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = LINE.exec(line);
    if (match === null) continue;
    const [, key = '', rest = ''] = match;
    const quoted = QUOTED.exec(rest);
    let value: string;
    if (quoted === null) {
      // 没有引号：第一个 # 之后都是注释
      value = (rest.split('#')[0] ?? '').trim();
    } else {
      const [, quote, inner = ''] = quoted;
      value = quote === '"' ? inner.replaceAll('\\n', '\n') : inner;
    }
    result.set(key, value);
  }
  return result;
}

/** 按 Next.js 的方式读取 .env 文件：从优先级最高的文件开始，一个文件一个文件地确定变量的值 */
export function resolveEnv(files: Readonly<Record<string, string>>, mode: Mode, processEnv: Readonly<Record<string, string | undefined>>): Resolved {
  const env = new Map<string, string>();
  const source = new Map<string, string>();

  for (const name of filesFor(mode)) {
    const text = files[name];
    if (text === undefined) continue;
    const raw = parse(text);
    // 被引用的变量：process.env、优先级更高的文件（已经确定的值）、本文件（先展开它）
    const lookup = (key: string): string => processEnv[key] ?? env.get(key) ?? expand(raw.get(key) ?? '');
    const expand = (value: string): string =>
      value.replace(REFERENCE, (all, braced?: string, bare?: string) => {
        const key = braced ?? bare;
        return key === undefined ? '$' : lookup(key);
      });

    for (const [key, value] of raw) {
      if (env.has(key)) continue;
      const fromProcess = processEnv[key];
      env.set(key, fromProcess ?? expand(value));
      source.set(key, fromProcess === undefined ? name : 'process.env');
    }
  }
  return { env: Object.fromEntries(env), source: Object.fromEntries(source) };
}
```
:::

:::variant{kind=wrong name=local-in-test fails=tests reason="测试环境也读了 .env.local：每个人的测试结果可能不一样"}
```ts file=env-files.ts
export type Mode = 'development' | 'production' | 'test';

export type Resolved = Readonly<{
  env: Readonly<Record<string, string>>;
  /** 每个变量的值来自哪里：文件名，或者 'process.env' */
  source: Readonly<Record<string, string>>;
}>;

/** 从高到低的优先级：先找到的生效 */
function filesFor(mode: Mode): string[] {
  return [`.env.${mode}.local`, '.env.local', `.env.${mode}`, '.env'];
}

const LINE = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;
/** 引号括起来的值，后面还可以有注释 */
const QUOTED = /^(["'])(.*?)\1\s*(?:#.*)?$/;
const REFERENCE = /\\\$|\$\{(\w+)\}|\$(\w+)/g;

/** 解析一个 .env 文件：空行和 # 开头的行跳过，不合格式的行忽略；同一个变量出现多次时，后面的生效 */
function parse(text: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = LINE.exec(line);
    if (match === null) continue;
    const [, key = '', rest = ''] = match;
    const quoted = QUOTED.exec(rest);
    let value: string;
    if (quoted === null) {
      // 没有引号：第一个 # 之后都是注释
      value = (rest.split('#')[0] ?? '').trim();
    } else {
      const [, quote, inner = ''] = quoted;
      value = quote === '"' ? inner.replaceAll('\\n', '\n') : inner;
    }
    result.set(key, value);
  }
  return result;
}

/** 按 Next.js 的方式读取 .env 文件：从优先级最高的文件开始，一个文件一个文件地确定变量的值 */
export function resolveEnv(files: Readonly<Record<string, string>>, mode: Mode, processEnv: Readonly<Record<string, string | undefined>>): Resolved {
  const env = new Map<string, string>();
  const source = new Map<string, string>();

  for (const name of filesFor(mode)) {
    const text = files[name];
    if (text === undefined) continue;
    const raw = parse(text);
    // 被引用的变量：process.env、优先级更高的文件（已经确定的值）、本文件（先展开它）
    const lookup = (key: string): string => processEnv[key] ?? env.get(key) ?? expand(raw.get(key) ?? '');
    const expand = (value: string): string =>
      value.replace(REFERENCE, (all, braced?: string, bare?: string) => {
        const key = braced ?? bare;
        return key === undefined ? '$' : lookup(key);
      });

    for (const [key, value] of raw) {
      if (env.has(key)) continue;
      const fromProcess = processEnv[key];
      env.set(key, fromProcess ?? expand(value));
      source.set(key, fromProcess === undefined ? name : 'process.env');
    }
  }
  return { env: Object.fromEntries(env), source: Object.fromEntries(source) };
}
```
:::

:::variant{kind=wrong name=files-over-process fails=tests reason="文件中的值覆盖了 process.env：部署平台上设置的变量不起作用了"}
```ts file=env-files.ts
export type Mode = 'development' | 'production' | 'test';

export type Resolved = Readonly<{
  env: Readonly<Record<string, string>>;
  /** 每个变量的值来自哪里：文件名，或者 'process.env' */
  source: Readonly<Record<string, string>>;
}>;

/** 从高到低的优先级：先找到的生效 */
function filesFor(mode: Mode): string[] {
  return mode === 'test' ? ['.env.test.local', '.env.test', '.env'] : [`.env.${mode}.local`, '.env.local', `.env.${mode}`, '.env'];
}

const LINE = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;
/** 引号括起来的值，后面还可以有注释 */
const QUOTED = /^(["'])(.*?)\1\s*(?:#.*)?$/;
const REFERENCE = /\\\$|\$\{(\w+)\}|\$(\w+)/g;

/** 解析一个 .env 文件：空行和 # 开头的行跳过，不合格式的行忽略；同一个变量出现多次时，后面的生效 */
function parse(text: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = LINE.exec(line);
    if (match === null) continue;
    const [, key = '', rest = ''] = match;
    const quoted = QUOTED.exec(rest);
    let value: string;
    if (quoted === null) {
      // 没有引号：第一个 # 之后都是注释
      value = (rest.split('#')[0] ?? '').trim();
    } else {
      const [, quote, inner = ''] = quoted;
      value = quote === '"' ? inner.replaceAll('\\n', '\n') : inner;
    }
    result.set(key, value);
  }
  return result;
}

/** 按 Next.js 的方式读取 .env 文件：从优先级最高的文件开始，一个文件一个文件地确定变量的值 */
export function resolveEnv(files: Readonly<Record<string, string>>, mode: Mode, processEnv: Readonly<Record<string, string | undefined>>): Resolved {
  const env = new Map<string, string>();
  const source = new Map<string, string>();

  for (const name of filesFor(mode)) {
    const text = files[name];
    if (text === undefined) continue;
    const raw = parse(text);
    // 被引用的变量：process.env、优先级更高的文件（已经确定的值）、本文件（先展开它）
    const lookup = (key: string): string => processEnv[key] ?? env.get(key) ?? expand(raw.get(key) ?? '');
    const expand = (value: string): string =>
      value.replace(REFERENCE, (all, braced?: string, bare?: string) => {
        const key = braced ?? bare;
        return key === undefined ? '$' : lookup(key);
      });

    for (const [key, value] of raw) {
      if (env.has(key)) continue;
      const fromProcess = processEnv[key];
      env.set(key, expand(value));
      source.set(key, name);
    }
  }
  return { env: Object.fromEntries(env), source: Object.fromEntries(source) };
}
```
:::

:::variant{kind=wrong name=undefined-is-set fails=tests reason="把值是 undefined 的变量当成了已经设置：process.env.X 是 undefined 就是没有设置"}
```ts file=env-files.ts
export type Mode = 'development' | 'production' | 'test';

export type Resolved = Readonly<{
  env: Readonly<Record<string, string>>;
  /** 每个变量的值来自哪里：文件名，或者 'process.env' */
  source: Readonly<Record<string, string>>;
}>;

/** 从高到低的优先级：先找到的生效 */
function filesFor(mode: Mode): string[] {
  return mode === 'test' ? ['.env.test.local', '.env.test', '.env'] : [`.env.${mode}.local`, '.env.local', `.env.${mode}`, '.env'];
}

const LINE = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;
/** 引号括起来的值，后面还可以有注释 */
const QUOTED = /^(["'])(.*?)\1\s*(?:#.*)?$/;
const REFERENCE = /\\\$|\$\{(\w+)\}|\$(\w+)/g;

/** 解析一个 .env 文件：空行和 # 开头的行跳过，不合格式的行忽略；同一个变量出现多次时，后面的生效 */
function parse(text: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = LINE.exec(line);
    if (match === null) continue;
    const [, key = '', rest = ''] = match;
    const quoted = QUOTED.exec(rest);
    let value: string;
    if (quoted === null) {
      // 没有引号：第一个 # 之后都是注释
      value = (rest.split('#')[0] ?? '').trim();
    } else {
      const [, quote, inner = ''] = quoted;
      value = quote === '"' ? inner.replaceAll('\\n', '\n') : inner;
    }
    result.set(key, value);
  }
  return result;
}

/** 按 Next.js 的方式读取 .env 文件：从优先级最高的文件开始，一个文件一个文件地确定变量的值 */
export function resolveEnv(files: Readonly<Record<string, string>>, mode: Mode, processEnv: Readonly<Record<string, string | undefined>>): Resolved {
  const env = new Map<string, string>();
  const source = new Map<string, string>();

  for (const name of filesFor(mode)) {
    const text = files[name];
    if (text === undefined) continue;
    const raw = parse(text);
    // 被引用的变量：process.env、优先级更高的文件（已经确定的值）、本文件（先展开它）
    const lookup = (key: string): string => processEnv[key] ?? env.get(key) ?? expand(raw.get(key) ?? '');
    const expand = (value: string): string =>
      value.replace(REFERENCE, (all, braced?: string, bare?: string) => {
        const key = braced ?? bare;
        return key === undefined ? '$' : lookup(key);
      });

    for (const [key, value] of raw) {
      if (env.has(key)) continue;
      const fromProcess = processEnv[key];
      env.set(key, key in processEnv ? (fromProcess ?? '') : expand(value));
      source.set(key, key in processEnv ? 'process.env' : name);
    }
  }
  return { env: Object.fromEntries(env), source: Object.fromEntries(source) };
}
```
:::

:::variant{kind=wrong name=single-quotes-literal fails=tests reason="以为单引号能挡住展开（shell 中是这样）：实测 Next.js 中单引号里的 $USER 照样被展开"}
```ts file=env-files.ts
export type Mode = 'development' | 'production' | 'test';

export type Resolved = Readonly<{
  env: Readonly<Record<string, string>>;
  /** 每个变量的值来自哪里：文件名，或者 'process.env' */
  source: Readonly<Record<string, string>>;
}>;

/** 从高到低的优先级：先找到的生效 */
function filesFor(mode: Mode): string[] {
  return mode === 'test' ? ['.env.test.local', '.env.test', '.env'] : [`.env.${mode}.local`, '.env.local', `.env.${mode}`, '.env'];
}

const LINE = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;
/** 引号括起来的值，后面还可以有注释 */
const QUOTED = /^(["'])(.*?)\1\s*(?:#.*)?$/;
const REFERENCE = /\\\$|\$\{(\w+)\}|\$(\w+)/g;

/** 解析一个 .env 文件：空行和 # 开头的行跳过，不合格式的行忽略；同一个变量出现多次时，后面的生效 */
function parse(text: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = LINE.exec(line);
    if (match === null) continue;
    const [, key = '', rest = ''] = match;
    const quoted = QUOTED.exec(rest);
    let value: string;
    if (quoted === null) {
      // 没有引号：第一个 # 之后都是注释
      value = (rest.split('#')[0] ?? '').trim();
    } else {
      const [, quote, inner = ''] = quoted;
      value = quote === '"' ? inner.replaceAll('\\n', '\n') : inner.replaceAll('$', '\\$');
    }
    result.set(key, value);
  }
  return result;
}

/** 按 Next.js 的方式读取 .env 文件：从优先级最高的文件开始，一个文件一个文件地确定变量的值 */
export function resolveEnv(files: Readonly<Record<string, string>>, mode: Mode, processEnv: Readonly<Record<string, string | undefined>>): Resolved {
  const env = new Map<string, string>();
  const source = new Map<string, string>();

  for (const name of filesFor(mode)) {
    const text = files[name];
    if (text === undefined) continue;
    const raw = parse(text);
    // 被引用的变量：process.env、优先级更高的文件（已经确定的值）、本文件（先展开它）
    const lookup = (key: string): string => processEnv[key] ?? env.get(key) ?? expand(raw.get(key) ?? '');
    const expand = (value: string): string =>
      value.replace(REFERENCE, (all, braced?: string, bare?: string) => {
        const key = braced ?? bare;
        return key === undefined ? '$' : lookup(key);
      });

    for (const [key, value] of raw) {
      if (env.has(key)) continue;
      const fromProcess = processEnv[key];
      env.set(key, fromProcess ?? expand(value));
      source.set(key, fromProcess === undefined ? name : 'process.env');
    }
  }
  return { env: Object.fromEntries(env), source: Object.fromEntries(source) };
}
```
:::

:::variant{kind=wrong name=hash-needs-space fails=tests reason="只把空格加 # 当作注释：实测 H=a#b 读到的是 a，值中有 # 时要加引号"}
```ts file=env-files.ts
export type Mode = 'development' | 'production' | 'test';

export type Resolved = Readonly<{
  env: Readonly<Record<string, string>>;
  /** 每个变量的值来自哪里：文件名，或者 'process.env' */
  source: Readonly<Record<string, string>>;
}>;

/** 从高到低的优先级：先找到的生效 */
function filesFor(mode: Mode): string[] {
  return mode === 'test' ? ['.env.test.local', '.env.test', '.env'] : [`.env.${mode}.local`, '.env.local', `.env.${mode}`, '.env'];
}

const LINE = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;
/** 引号括起来的值，后面还可以有注释 */
const QUOTED = /^(["'])(.*?)\1\s*(?:#.*)?$/;
const REFERENCE = /\\\$|\$\{(\w+)\}|\$(\w+)/g;

/** 解析一个 .env 文件：空行和 # 开头的行跳过，不合格式的行忽略；同一个变量出现多次时，后面的生效 */
function parse(text: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = LINE.exec(line);
    if (match === null) continue;
    const [, key = '', rest = ''] = match;
    const quoted = QUOTED.exec(rest);
    let value: string;
    if (quoted === null) {
      // 没有引号：第一个 # 之后都是注释
      value = (rest.split(' #')[0] ?? '').trim();
    } else {
      const [, quote, inner = ''] = quoted;
      value = quote === '"' ? inner.replaceAll('\\n', '\n') : inner;
    }
    result.set(key, value);
  }
  return result;
}

/** 按 Next.js 的方式读取 .env 文件：从优先级最高的文件开始，一个文件一个文件地确定变量的值 */
export function resolveEnv(files: Readonly<Record<string, string>>, mode: Mode, processEnv: Readonly<Record<string, string | undefined>>): Resolved {
  const env = new Map<string, string>();
  const source = new Map<string, string>();

  for (const name of filesFor(mode)) {
    const text = files[name];
    if (text === undefined) continue;
    const raw = parse(text);
    // 被引用的变量：process.env、优先级更高的文件（已经确定的值）、本文件（先展开它）
    const lookup = (key: string): string => processEnv[key] ?? env.get(key) ?? expand(raw.get(key) ?? '');
    const expand = (value: string): string =>
      value.replace(REFERENCE, (all, braced?: string, bare?: string) => {
        const key = braced ?? bare;
        return key === undefined ? '$' : lookup(key);
      });

    for (const [key, value] of raw) {
      if (env.has(key)) continue;
      const fromProcess = processEnv[key];
      env.set(key, fromProcess ?? expand(value));
      source.set(key, fromProcess === undefined ? name : 'process.env');
    }
  }
  return { env: Object.fromEntries(env), source: Object.fromEntries(source) };
}
```
:::

:::variant{kind=wrong name=duplicate-first-wins fails=tests reason="同一个文件中同名的变量取了第一个：dotenv 中是后面的生效"}
```ts file=env-files.ts
export type Mode = 'development' | 'production' | 'test';

export type Resolved = Readonly<{
  env: Readonly<Record<string, string>>;
  /** 每个变量的值来自哪里：文件名，或者 'process.env' */
  source: Readonly<Record<string, string>>;
}>;

/** 从高到低的优先级：先找到的生效 */
function filesFor(mode: Mode): string[] {
  return mode === 'test' ? ['.env.test.local', '.env.test', '.env'] : [`.env.${mode}.local`, '.env.local', `.env.${mode}`, '.env'];
}

const LINE = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;
/** 引号括起来的值，后面还可以有注释 */
const QUOTED = /^(["'])(.*?)\1\s*(?:#.*)?$/;
const REFERENCE = /\\\$|\$\{(\w+)\}|\$(\w+)/g;

/** 解析一个 .env 文件：空行和 # 开头的行跳过，不合格式的行忽略；同一个变量出现多次时，后面的生效 */
function parse(text: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = LINE.exec(line);
    if (match === null) continue;
    const [, key = '', rest = ''] = match;
    const quoted = QUOTED.exec(rest);
    let value: string;
    if (quoted === null) {
      // 没有引号：第一个 # 之后都是注释
      value = (rest.split('#')[0] ?? '').trim();
    } else {
      const [, quote, inner = ''] = quoted;
      value = quote === '"' ? inner.replaceAll('\\n', '\n') : inner;
    }
    if (!result.has(key)) result.set(key, value);
  }
  return result;
}

/** 按 Next.js 的方式读取 .env 文件：从优先级最高的文件开始，一个文件一个文件地确定变量的值 */
export function resolveEnv(files: Readonly<Record<string, string>>, mode: Mode, processEnv: Readonly<Record<string, string | undefined>>): Resolved {
  const env = new Map<string, string>();
  const source = new Map<string, string>();

  for (const name of filesFor(mode)) {
    const text = files[name];
    if (text === undefined) continue;
    const raw = parse(text);
    // 被引用的变量：process.env、优先级更高的文件（已经确定的值）、本文件（先展开它）
    const lookup = (key: string): string => processEnv[key] ?? env.get(key) ?? expand(raw.get(key) ?? '');
    const expand = (value: string): string =>
      value.replace(REFERENCE, (all, braced?: string, bare?: string) => {
        const key = braced ?? bare;
        return key === undefined ? '$' : lookup(key);
      });

    for (const [key, value] of raw) {
      if (env.has(key)) continue;
      const fromProcess = processEnv[key];
      env.set(key, fromProcess ?? expand(value));
      source.set(key, fromProcess === undefined ? name : 'process.env');
    }
  }
  return { env: Object.fromEntries(env), source: Object.fromEntries(source) };
}
```
:::

:::variant{kind=wrong name=no-escape fails=tests reason="不认 \$：想写一个真正的 $ 时没有办法"}
```ts file=env-files.ts
export type Mode = 'development' | 'production' | 'test';

export type Resolved = Readonly<{
  env: Readonly<Record<string, string>>;
  /** 每个变量的值来自哪里：文件名，或者 'process.env' */
  source: Readonly<Record<string, string>>;
}>;

/** 从高到低的优先级：先找到的生效 */
function filesFor(mode: Mode): string[] {
  return mode === 'test' ? ['.env.test.local', '.env.test', '.env'] : [`.env.${mode}.local`, '.env.local', `.env.${mode}`, '.env'];
}

const LINE = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;
/** 引号括起来的值，后面还可以有注释 */
const QUOTED = /^(["'])(.*?)\1\s*(?:#.*)?$/;
const REFERENCE = /\$\{(\w+)\}|\$(\w+)/g;

/** 解析一个 .env 文件：空行和 # 开头的行跳过，不合格式的行忽略；同一个变量出现多次时，后面的生效 */
function parse(text: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = LINE.exec(line);
    if (match === null) continue;
    const [, key = '', rest = ''] = match;
    const quoted = QUOTED.exec(rest);
    let value: string;
    if (quoted === null) {
      // 没有引号：第一个 # 之后都是注释
      value = (rest.split('#')[0] ?? '').trim();
    } else {
      const [, quote, inner = ''] = quoted;
      value = quote === '"' ? inner.replaceAll('\\n', '\n') : inner;
    }
    result.set(key, value);
  }
  return result;
}

/** 按 Next.js 的方式读取 .env 文件：从优先级最高的文件开始，一个文件一个文件地确定变量的值 */
export function resolveEnv(files: Readonly<Record<string, string>>, mode: Mode, processEnv: Readonly<Record<string, string | undefined>>): Resolved {
  const env = new Map<string, string>();
  const source = new Map<string, string>();

  for (const name of filesFor(mode)) {
    const text = files[name];
    if (text === undefined) continue;
    const raw = parse(text);
    // 被引用的变量：process.env、优先级更高的文件（已经确定的值）、本文件（先展开它）
    const lookup = (key: string): string => processEnv[key] ?? env.get(key) ?? expand(raw.get(key) ?? '');
    const expand = (value: string): string =>
      value.replace(REFERENCE, (all, braced?: string, bare?: string) => {
        const key = braced ?? bare;
        return key === undefined ? '$' : lookup(key);
      });

    for (const [key, value] of raw) {
      if (env.has(key)) continue;
      const fromProcess = processEnv[key];
      env.set(key, fromProcess ?? expand(value));
      source.set(key, fromProcess === undefined ? name : 'process.env');
    }
  }
  return { env: Object.fromEntries(env), source: Object.fromEntries(source) };
}
```
:::

:::variant{kind=wrong name=own-file-first fails=tests reason="展开时先用了本文件中的值：部署平台或者优先级更高的文件中的 HOST 没有用上"}
```ts file=env-files.ts
export type Mode = 'development' | 'production' | 'test';

export type Resolved = Readonly<{
  env: Readonly<Record<string, string>>;
  /** 每个变量的值来自哪里：文件名，或者 'process.env' */
  source: Readonly<Record<string, string>>;
}>;

/** 从高到低的优先级：先找到的生效 */
function filesFor(mode: Mode): string[] {
  return mode === 'test' ? ['.env.test.local', '.env.test', '.env'] : [`.env.${mode}.local`, '.env.local', `.env.${mode}`, '.env'];
}

const LINE = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;
/** 引号括起来的值，后面还可以有注释 */
const QUOTED = /^(["'])(.*?)\1\s*(?:#.*)?$/;
const REFERENCE = /\\\$|\$\{(\w+)\}|\$(\w+)/g;

/** 解析一个 .env 文件：空行和 # 开头的行跳过，不合格式的行忽略；同一个变量出现多次时，后面的生效 */
function parse(text: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = LINE.exec(line);
    if (match === null) continue;
    const [, key = '', rest = ''] = match;
    const quoted = QUOTED.exec(rest);
    let value: string;
    if (quoted === null) {
      // 没有引号：第一个 # 之后都是注释
      value = (rest.split('#')[0] ?? '').trim();
    } else {
      const [, quote, inner = ''] = quoted;
      value = quote === '"' ? inner.replaceAll('\\n', '\n') : inner;
    }
    result.set(key, value);
  }
  return result;
}

/** 按 Next.js 的方式读取 .env 文件：从优先级最高的文件开始，一个文件一个文件地确定变量的值 */
export function resolveEnv(files: Readonly<Record<string, string>>, mode: Mode, processEnv: Readonly<Record<string, string | undefined>>): Resolved {
  const env = new Map<string, string>();
  const source = new Map<string, string>();

  for (const name of filesFor(mode)) {
    const text = files[name];
    if (text === undefined) continue;
    const raw = parse(text);
    // 被引用的变量：process.env、优先级更高的文件（已经确定的值）、本文件（先展开它）
    const lookup = (key: string): string => (raw.has(key) ? expand(raw.get(key) ?? '') : (processEnv[key] ?? env.get(key) ?? ''));
    const expand = (value: string): string =>
      value.replace(REFERENCE, (all, braced?: string, bare?: string) => {
        const key = braced ?? bare;
        return key === undefined ? '$' : lookup(key);
      });

    for (const [key, value] of raw) {
      if (env.has(key)) continue;
      const fromProcess = processEnv[key];
      env.set(key, fromProcess ?? expand(value));
      source.set(key, fromProcess === undefined ? name : 'process.env');
    }
  }
  return { env: Object.fromEntries(env), source: Object.fromEntries(source) };
}
```
:::

:::variant{kind=wrong name=no-recursion fails=tests reason="被引用的变量没有先展开：A=$B、B=$C 时 A 得到的是 $C"}
```ts file=env-files.ts
export type Mode = 'development' | 'production' | 'test';

export type Resolved = Readonly<{
  env: Readonly<Record<string, string>>;
  /** 每个变量的值来自哪里：文件名，或者 'process.env' */
  source: Readonly<Record<string, string>>;
}>;

/** 从高到低的优先级：先找到的生效 */
function filesFor(mode: Mode): string[] {
  return mode === 'test' ? ['.env.test.local', '.env.test', '.env'] : [`.env.${mode}.local`, '.env.local', `.env.${mode}`, '.env'];
}

const LINE = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;
/** 引号括起来的值，后面还可以有注释 */
const QUOTED = /^(["'])(.*?)\1\s*(?:#.*)?$/;
const REFERENCE = /\\\$|\$\{(\w+)\}|\$(\w+)/g;

/** 解析一个 .env 文件：空行和 # 开头的行跳过，不合格式的行忽略；同一个变量出现多次时，后面的生效 */
function parse(text: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = LINE.exec(line);
    if (match === null) continue;
    const [, key = '', rest = ''] = match;
    const quoted = QUOTED.exec(rest);
    let value: string;
    if (quoted === null) {
      // 没有引号：第一个 # 之后都是注释
      value = (rest.split('#')[0] ?? '').trim();
    } else {
      const [, quote, inner = ''] = quoted;
      value = quote === '"' ? inner.replaceAll('\\n', '\n') : inner;
    }
    result.set(key, value);
  }
  return result;
}

/** 按 Next.js 的方式读取 .env 文件：从优先级最高的文件开始，一个文件一个文件地确定变量的值 */
export function resolveEnv(files: Readonly<Record<string, string>>, mode: Mode, processEnv: Readonly<Record<string, string | undefined>>): Resolved {
  const env = new Map<string, string>();
  const source = new Map<string, string>();

  for (const name of filesFor(mode)) {
    const text = files[name];
    if (text === undefined) continue;
    const raw = parse(text);
    // 被引用的变量：process.env、优先级更高的文件（已经确定的值）、本文件（先展开它）
    const lookup = (key: string): string => processEnv[key] ?? env.get(key) ?? raw.get(key) ?? '';
    const expand = (value: string): string =>
      value.replace(REFERENCE, (all, braced?: string, bare?: string) => {
        const key = braced ?? bare;
        return key === undefined ? '$' : lookup(key);
      });

    for (const [key, value] of raw) {
      if (env.has(key)) continue;
      const fromProcess = processEnv[key];
      env.set(key, fromProcess ?? expand(value));
      source.set(key, fromProcess === undefined ? name : 'process.env');
    }
  }
  return { env: Object.fromEntries(env), source: Object.fromEntries(source) };
}
```
:::

