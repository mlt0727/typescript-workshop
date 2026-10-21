---
kind: task
title: 读懂 .env 文件
---
在 `env-files.ts` 中实现 `resolveEnv(files, mode, processEnv)`，模拟 Next.js 读取 `.env*` 文件（规则来自随包的文档和正文中的实测）。`files` 是文件名到内容的映射，`mode` 是 `NODE_ENV`，`processEnv` 是启动时已经有的环境变量。

1. **查找的顺序**（先找到的生效）：`processEnv`、`.env.${mode}.local`、`.env.local`、`.env.${mode}`、`.env`。`mode` 是 `'test'` 时**不读** `.env.local`。不存在的文件跳过；
2. **解析**每一行（`\n` 或 `\r\n` 分隔）：去掉首尾的空白之后，空行和 `#` 开头的行跳过；格式是 `KEY=VALUE`，`=` 两边可以有空白，`KEY` 由字母、数字、下划线组成，不以数字开头；不符合格式的行忽略；
3. **值**：
   - 用双引号括起来：去掉引号，其中的 `\n`（反斜杠加 n 两个字符）换成换行，**要**展开；
   - 用单引号括起来：去掉引号，原样使用，**不**展开；
   - 没有引号：如果有“空格加 #”，从那里开始是注释，去掉；再去掉首尾的空白，**要**展开；
4. **展开**：`$NAME` 和 `${NAME}` 换成变量 `NAME` 最终的**原始**值（按第 1 条的顺序找到的那个值，没有被展开过的）；哪里都没有时是空字符串。`\$` 换成一个 `$`。展开只做一层；来自 `processEnv` 的值原样使用，不展开；
5. 返回 `{ env, source }`：只包含在某个被读取的文件中出现过的变量。`env` 是最终的值，`source` 是它来自哪个文件，来自 `processEnv` 时是 `'process.env'`。

:::files{role=starter}
```ts file=env-files.ts
export type Mode = 'development' | 'production' | 'test';

export type Resolved = Readonly<{
  env: Readonly<Record<string, string>>;
  /** 每个变量的值来自哪里：文件名，或者 'process.env' */
  source: Readonly<Record<string, string>>;
}>;

/** 按 Next.js 的顺序合并 .env 文件，再展开 $NAME 和 ${NAME} */
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

type Raw = { value: string; expand: boolean };

/** 解析一个 .env 文件：KEY=VALUE，空行和 # 开头的行跳过，不合格式的行忽略 */
function parse(text: string): Map<string, Raw> {
  const result = new Map<string, Raw>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (match === null) continue;
    const [, key = '', rest = ''] = match;
    if (rest.length >= 2 && rest.startsWith('"') && rest.endsWith('"')) {
      result.set(key, { value: rest.slice(1, -1).replaceAll('\\n', '\n'), expand: true });
    } else if (rest.length >= 2 && rest.startsWith("'") && rest.endsWith("'")) {
      result.set(key, { value: rest.slice(1, -1), expand: false });
    } else {
      // 没有引号：“ #”之后是注释
      const comment = rest.indexOf(' #');
      result.set(key, { value: (comment === -1 ? rest : rest.slice(0, comment)).trim(), expand: true });
    }
  }
  return result;
}

/** 按 Next.js 的顺序合并 .env 文件，再展开 $NAME 和 ${NAME} */
export function resolveEnv(files: Readonly<Record<string, string>>, mode: Mode, processEnv: Readonly<Record<string, string | undefined>>): Resolved {
  const raw = new Map<string, Raw>();
  const source: Record<string, string> = {};
  // 从低到高地覆盖：高优先级的文件最后写入
  for (const name of filesFor(mode).toReversed()) {
    const text = files[name];
    if (text === undefined) continue;
    for (const [key, value] of parse(text)) {
      raw.set(key, value);
      source[key] = name;
    }
  }
  for (const key of raw.keys()) {
    const fromProcess = processEnv[key];
    if (fromProcess !== undefined) {
      raw.set(key, { value: fromProcess, expand: false });
      source[key] = 'process.env';
    }
  }

  // 展开只做一层：$NAME 换成 NAME 最终的原始值（不再展开它里面的 $）
  const lookup = (name: string) => processEnv[name] ?? raw.get(name)?.value ?? '';
  const env: Record<string, string> = {};
  for (const [key, { value, expand }] of raw) {
    env[key] = expand
      ? value.replace(/\\\$|\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (all, braced?: string, bare?: string) => {
          const name = braced ?? bare;
          return name === undefined ? '$' : lookup(name);
        })
      : value;
  }
  return { env, source };
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

/** 正文中实测项目的几个文件（只保留了相关的行） */
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
    const text = '\n# 注释\n  A = 1  \nB=\nnot a line\n1BAD=x\nC=a=b\n';
    expect(resolveEnv({ '.env': text }, 'production', {}).env).toStrictEqual({ A: '1', B: '', C: 'a=b' });
  });

  test('引号：双引号中的 \\n 是换行；单引号中的内容原样保留，不展开', () => {
    const text = 'USER=nextjs\nKEY="line1\\nline2"\nQ="hi $USER # not a comment"\nS=\'$USER is literal\'\nU=value # 注释\nH=a#b\n';
    expect(resolveEnv({ '.env': text }, 'production', {}).env).toStrictEqual({
      USER: 'nextjs',
      KEY: 'line1\nline2',
      Q: 'hi nextjs # not a comment',
      S: '$USER is literal',
      U: 'value',
      H: 'a#b',
    });
  });

  test('展开：$NAME 和 ${NAME}，用的是最终的值；不存在的是空字符串；\\$ 是 $', () => {
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

  test('展开只做一层；来自 process.env 的值原样使用', () => {
    const files = { '.env': 'A=$B\nB=$C\nC=end\nD=$A\n' };
    expect(resolveEnv(files, 'production', { C: '$NOT_EXPANDED' }).env).toStrictEqual({ A: '$C', B: '$NOT_EXPANDED', C: '$NOT_EXPANDED', D: '$B' });
  });

  test('只包含文件中出现过的变量', () => {
    expect(resolveEnv({ '.env': 'A=1\n' }, 'production', { PATH: '/usr/bin', A: '2' }).env).toStrictEqual({ A: '2' });
  });
});
```
:::

:::hint{level=1}
分两步：先按优先级合并出每个变量的原始值（记下它来自哪个文件、要不要展开），再逐个展开。合并时可以从优先级最低的文件开始，高优先级的文件后写入、覆盖前面的值。
:::

:::hint{level=2}
一行用 `/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/` 匹配。展开用 `replace` 和一个有三个分支的正则：`\\\$`（转义的 `$`）、`\$\{(名字)\}`、`\$(名字)`，在替换函数中看是哪个分组匹配了。
:::

:::explanation
这些规则看起来琐碎，但每一条都对应一个真实的需求。`.env` 中是所有人共用的默认值，可以提交到仓库；`.env.local` 是每个人自己电脑上的设置（例如本地数据库的地址），不提交；`.env.production` 是生产环境的默认值。`process.env` 优先于所有的文件：部署平台上设置的变量一定生效，同一份构建可以用不同的变量运行。测试时不读 `.env.local`，是为了让每个人运行测试的结果都一样。

正文中实测项目的结果和这些规则一致：同一个变量写在四个文件中，生产环境中生效的是 `.env.production.local`；`.env.local` 胜过 `.env.production`；启动时设置的 `LAB_PROCESS` 胜过 `.env`；`https://x.com/$LAB_USER` 被展开了，`\$5` 变成了 `$5`。

真实的实现（`@next/env` 使用的 dotenv 和 dotenv-expand）还处理了更多的情况，例如跨越多行的引号、递归的展开；这个练习只做其中最常用的部分。

替代解按文档描述的方向，从优先级最高的文件开始找，一个变量第一次被找到之后就不再看后面的文件。
:::

:::variant{kind=alt name=first-found-wins}
```ts file=env-files.ts
export type Mode = 'development' | 'production' | 'test';

export type Resolved = Readonly<{
  env: Readonly<Record<string, string>>;
  /** 每个变量的值来自哪里：文件名，或者 'process.env' */
  source: Readonly<Record<string, string>>;
}>;

type Entry = { value: string; expand: boolean; from: string };

/** 一行 KEY=VALUE 的值：返回值本身，以及要不要展开 */
function readValue(rest: string): { value: string; expand: boolean } {
  const quote = rest.charAt(0);
  if (rest.length >= 2 && (quote === '"' || quote === "'") && rest.endsWith(quote)) {
    const inner = rest.slice(1, -1);
    return quote === '"' ? { value: inner.split('\\n').join('\n'), expand: true } : { value: inner, expand: false };
  }
  return { value: rest.split(' #')[0]?.trim() ?? '', expand: true };
}

/** 从高到低依次查找，第一次找到的生效（文档中描述的顺序） */
export function resolveEnv(files: Readonly<Record<string, string>>, mode: Mode, processEnv: Readonly<Record<string, string | undefined>>): Resolved {
  const order = ['process.env', `.env.${mode}.local`, ...(mode === 'test' ? [] : ['.env.local']), `.env.${mode}`, '.env'];
  const entries = new Map<string, Entry>();
  const seenKeys = new Set<string>();
  for (const name of order.slice(1)) {
    for (const line of (files[name] ?? '').split(/\r?\n/).map((l) => l.trim())) {
      const at = line.indexOf('=');
      const key = line.slice(0, at).trim();
      if (line.startsWith('#') || at < 1 || !/^[A-Za-z_]\w*$/.test(key)) continue;
      seenKeys.add(key);
      // 已经从更高优先级的文件中得到了这个变量：跳过
      if (entries.has(key)) continue;
      entries.set(key, { ...readValue(line.slice(at + 1).trim()), from: name });
    }
  }
  for (const key of seenKeys) {
    const fromProcess = processEnv[key];
    if (fromProcess !== undefined) entries.set(key, { value: fromProcess, expand: false, from: 'process.env' });
  }

  const original = (name: string) => processEnv[name] ?? entries.get(name)?.value ?? '';
  const expand = (value: string) =>
    value.replace(/\\\$|\$(?:\{(\w+)\}|(\w+))/g, (token: string, braced: string | undefined, bare: string | undefined) => (token === '\\$' ? '$' : original(braced ?? bare ?? '')));

  const env: Record<string, string> = {};
  const source: Record<string, string> = {};
  for (const [key, entry] of entries) {
    env[key] = entry.expand ? expand(entry.value) : entry.value;
    source[key] = entry.from;
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

type Raw = { value: string; expand: boolean };

/** 解析一个 .env 文件：KEY=VALUE，空行和 # 开头的行跳过，不合格式的行忽略 */
function parse(text: string): Map<string, Raw> {
  const result = new Map<string, Raw>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (match === null) continue;
    const [, key = '', rest = ''] = match;
    if (rest.length >= 2 && rest.startsWith('"') && rest.endsWith('"')) {
      result.set(key, { value: rest.slice(1, -1).replaceAll('\\n', '\n'), expand: true });
    } else if (rest.length >= 2 && rest.startsWith("'") && rest.endsWith("'")) {
      result.set(key, { value: rest.slice(1, -1), expand: false });
    } else {
      // 没有引号：“ #”之后是注释
      const comment = rest.indexOf(' #');
      result.set(key, { value: (comment === -1 ? rest : rest.slice(0, comment)).trim(), expand: true });
    }
  }
  return result;
}

/** 按 Next.js 的顺序合并 .env 文件，再展开 $NAME 和 ${NAME} */
export function resolveEnv(files: Readonly<Record<string, string>>, mode: Mode, processEnv: Readonly<Record<string, string | undefined>>): Resolved {
  const raw = new Map<string, Raw>();
  const source: Record<string, string> = {};
  // 从低到高地覆盖：高优先级的文件最后写入
  for (const name of filesFor(mode).toReversed()) {
    const text = files[name];
    if (text === undefined) continue;
    for (const [key, value] of parse(text)) {
      raw.set(key, value);
      source[key] = name;
    }
  }
  for (const key of raw.keys()) {
    const fromProcess = processEnv[key];
    if (fromProcess !== undefined) {
      raw.set(key, { value: fromProcess, expand: false });
      source[key] = 'process.env';
    }
  }

  // 展开只做一层：$NAME 换成 NAME 最终的原始值（不再展开它里面的 $）
  const lookup = (name: string) => processEnv[name] ?? raw.get(name)?.value ?? '';
  const env: Record<string, string> = {};
  for (const [key, { value, expand }] of raw) {
    env[key] = expand
      ? value.replace(/\\\$|\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (all, braced?: string, bare?: string) => {
          const name = braced ?? bare;
          return name === undefined ? '$' : lookup(name);
        })
      : value;
  }
  return { env, source };
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

type Raw = { value: string; expand: boolean };

/** 解析一个 .env 文件：KEY=VALUE，空行和 # 开头的行跳过，不合格式的行忽略 */
function parse(text: string): Map<string, Raw> {
  const result = new Map<string, Raw>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (match === null) continue;
    const [, key = '', rest = ''] = match;
    if (rest.length >= 2 && rest.startsWith('"') && rest.endsWith('"')) {
      result.set(key, { value: rest.slice(1, -1).replaceAll('\\n', '\n'), expand: true });
    } else if (rest.length >= 2 && rest.startsWith("'") && rest.endsWith("'")) {
      result.set(key, { value: rest.slice(1, -1), expand: false });
    } else {
      // 没有引号：“ #”之后是注释
      const comment = rest.indexOf(' #');
      result.set(key, { value: (comment === -1 ? rest : rest.slice(0, comment)).trim(), expand: true });
    }
  }
  return result;
}

/** 按 Next.js 的顺序合并 .env 文件，再展开 $NAME 和 ${NAME} */
export function resolveEnv(files: Readonly<Record<string, string>>, mode: Mode, processEnv: Readonly<Record<string, string | undefined>>): Resolved {
  const raw = new Map<string, Raw>();
  const source: Record<string, string> = {};
  // 从低到高地覆盖：高优先级的文件最后写入
  for (const name of filesFor(mode).toReversed()) {
    const text = files[name];
    if (text === undefined) continue;
    for (const [key, value] of parse(text)) {
      raw.set(key, value);
      source[key] = name;
    }
  }
  for (const key of raw.keys()) {
    const fromProcess = processEnv[key];
    if (fromProcess !== undefined) {
      raw.set(key, { value: fromProcess, expand: false });
      source[key] = 'process.env';
    }
  }

  // 展开只做一层：$NAME 换成 NAME 最终的原始值（不再展开它里面的 $）
  const lookup = (name: string) => processEnv[name] ?? raw.get(name)?.value ?? '';
  const env: Record<string, string> = {};
  for (const [key, { value, expand }] of raw) {
    env[key] = expand
      ? value.replace(/\\\$|\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (all, braced?: string, bare?: string) => {
          const name = braced ?? bare;
          return name === undefined ? '$' : lookup(name);
        })
      : value;
  }
  return { env, source };
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

type Raw = { value: string; expand: boolean };

/** 解析一个 .env 文件：KEY=VALUE，空行和 # 开头的行跳过，不合格式的行忽略 */
function parse(text: string): Map<string, Raw> {
  const result = new Map<string, Raw>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (match === null) continue;
    const [, key = '', rest = ''] = match;
    if (rest.length >= 2 && rest.startsWith('"') && rest.endsWith('"')) {
      result.set(key, { value: rest.slice(1, -1).replaceAll('\\n', '\n'), expand: true });
    } else if (rest.length >= 2 && rest.startsWith("'") && rest.endsWith("'")) {
      result.set(key, { value: rest.slice(1, -1), expand: false });
    } else {
      // 没有引号：“ #”之后是注释
      const comment = rest.indexOf(' #');
      result.set(key, { value: (comment === -1 ? rest : rest.slice(0, comment)).trim(), expand: true });
    }
  }
  return result;
}

/** 按 Next.js 的顺序合并 .env 文件，再展开 $NAME 和 ${NAME} */
export function resolveEnv(files: Readonly<Record<string, string>>, mode: Mode, processEnv: Readonly<Record<string, string | undefined>>): Resolved {
  const raw = new Map<string, Raw>();
  const source: Record<string, string> = {};
  // 从低到高地覆盖：高优先级的文件最后写入
  for (const name of filesFor(mode).toReversed()) {
    const text = files[name];
    if (text === undefined) continue;
    for (const [key, value] of parse(text)) {
      raw.set(key, value);
      source[key] = name;
    }
  }

  // 展开只做一层：$NAME 换成 NAME 最终的原始值（不再展开它里面的 $）
  const lookup = (name: string) => processEnv[name] ?? raw.get(name)?.value ?? '';
  const env: Record<string, string> = {};
  for (const [key, { value, expand }] of raw) {
    env[key] = expand
      ? value.replace(/\\\$|\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (all, braced?: string, bare?: string) => {
          const name = braced ?? bare;
          return name === undefined ? '$' : lookup(name);
        })
      : value;
  }
  return { env, source };
}
```
:::

:::variant{kind=wrong name=expand-single-quotes fails=tests reason="单引号中的内容也展开了：'$USER is literal' 本来就是想要一个 $"}
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

type Raw = { value: string; expand: boolean };

/** 解析一个 .env 文件：KEY=VALUE，空行和 # 开头的行跳过，不合格式的行忽略 */
function parse(text: string): Map<string, Raw> {
  const result = new Map<string, Raw>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (match === null) continue;
    const [, key = '', rest = ''] = match;
    if (rest.length >= 2 && rest.startsWith('"') && rest.endsWith('"')) {
      result.set(key, { value: rest.slice(1, -1).replaceAll('\\n', '\n'), expand: true });
    } else if (rest.length >= 2 && rest.startsWith("'") && rest.endsWith("'")) {
      result.set(key, { value: rest.slice(1, -1), expand: true });
    } else {
      // 没有引号：“ #”之后是注释
      const comment = rest.indexOf(' #');
      result.set(key, { value: (comment === -1 ? rest : rest.slice(0, comment)).trim(), expand: true });
    }
  }
  return result;
}

/** 按 Next.js 的顺序合并 .env 文件，再展开 $NAME 和 ${NAME} */
export function resolveEnv(files: Readonly<Record<string, string>>, mode: Mode, processEnv: Readonly<Record<string, string | undefined>>): Resolved {
  const raw = new Map<string, Raw>();
  const source: Record<string, string> = {};
  // 从低到高地覆盖：高优先级的文件最后写入
  for (const name of filesFor(mode).toReversed()) {
    const text = files[name];
    if (text === undefined) continue;
    for (const [key, value] of parse(text)) {
      raw.set(key, value);
      source[key] = name;
    }
  }
  for (const key of raw.keys()) {
    const fromProcess = processEnv[key];
    if (fromProcess !== undefined) {
      raw.set(key, { value: fromProcess, expand: false });
      source[key] = 'process.env';
    }
  }

  // 展开只做一层：$NAME 换成 NAME 最终的原始值（不再展开它里面的 $）
  const lookup = (name: string) => processEnv[name] ?? raw.get(name)?.value ?? '';
  const env: Record<string, string> = {};
  for (const [key, { value, expand }] of raw) {
    env[key] = expand
      ? value.replace(/\\\$|\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (all, braced?: string, bare?: string) => {
          const name = braced ?? bare;
          return name === undefined ? '$' : lookup(name);
        })
      : value;
  }
  return { env, source };
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

type Raw = { value: string; expand: boolean };

/** 解析一个 .env 文件：KEY=VALUE，空行和 # 开头的行跳过，不合格式的行忽略 */
function parse(text: string): Map<string, Raw> {
  const result = new Map<string, Raw>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (match === null) continue;
    const [, key = '', rest = ''] = match;
    if (rest.length >= 2 && rest.startsWith('"') && rest.endsWith('"')) {
      result.set(key, { value: rest.slice(1, -1).replaceAll('\\n', '\n'), expand: true });
    } else if (rest.length >= 2 && rest.startsWith("'") && rest.endsWith("'")) {
      result.set(key, { value: rest.slice(1, -1), expand: false });
    } else {
      // 没有引号：“ #”之后是注释
      const comment = rest.indexOf(' #');
      result.set(key, { value: (comment === -1 ? rest : rest.slice(0, comment)).trim(), expand: true });
    }
  }
  return result;
}

/** 按 Next.js 的顺序合并 .env 文件，再展开 $NAME 和 ${NAME} */
export function resolveEnv(files: Readonly<Record<string, string>>, mode: Mode, processEnv: Readonly<Record<string, string | undefined>>): Resolved {
  const raw = new Map<string, Raw>();
  const source: Record<string, string> = {};
  // 从低到高地覆盖：高优先级的文件最后写入
  for (const name of filesFor(mode).toReversed()) {
    const text = files[name];
    if (text === undefined) continue;
    for (const [key, value] of parse(text)) {
      raw.set(key, value);
      source[key] = name;
    }
  }
  for (const key of raw.keys()) {
    const fromProcess = processEnv[key];
    if (fromProcess !== undefined) {
      raw.set(key, { value: fromProcess, expand: false });
      source[key] = 'process.env';
    }
  }

  // 展开只做一层：$NAME 换成 NAME 最终的原始值（不再展开它里面的 $）
  const lookup = (name: string) => processEnv[name] ?? raw.get(name)?.value ?? '';
  const env: Record<string, string> = {};
  for (const [key, { value, expand }] of raw) {
    env[key] = expand
      ? value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (all, braced?: string, bare?: string) => {
          const name = braced ?? bare;
          return name === undefined ? '$' : lookup(name);
        })
      : value;
  }
  return { env, source };
}
```
:::

:::variant{kind=wrong name=keep-inline-comment fails=tests reason="没有去掉“ #”之后的注释：值中多了一段注释"}
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

type Raw = { value: string; expand: boolean };

/** 解析一个 .env 文件：KEY=VALUE，空行和 # 开头的行跳过，不合格式的行忽略 */
function parse(text: string): Map<string, Raw> {
  const result = new Map<string, Raw>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (match === null) continue;
    const [, key = '', rest = ''] = match;
    if (rest.length >= 2 && rest.startsWith('"') && rest.endsWith('"')) {
      result.set(key, { value: rest.slice(1, -1).replaceAll('\\n', '\n'), expand: true });
    } else if (rest.length >= 2 && rest.startsWith("'") && rest.endsWith("'")) {
      result.set(key, { value: rest.slice(1, -1), expand: false });
    } else {
      // 没有引号：“ #”之后是注释
      result.set(key, { value: rest, expand: true });
    }
  }
  return result;
}

/** 按 Next.js 的顺序合并 .env 文件，再展开 $NAME 和 ${NAME} */
export function resolveEnv(files: Readonly<Record<string, string>>, mode: Mode, processEnv: Readonly<Record<string, string | undefined>>): Resolved {
  const raw = new Map<string, Raw>();
  const source: Record<string, string> = {};
  // 从低到高地覆盖：高优先级的文件最后写入
  for (const name of filesFor(mode).toReversed()) {
    const text = files[name];
    if (text === undefined) continue;
    for (const [key, value] of parse(text)) {
      raw.set(key, value);
      source[key] = name;
    }
  }
  for (const key of raw.keys()) {
    const fromProcess = processEnv[key];
    if (fromProcess !== undefined) {
      raw.set(key, { value: fromProcess, expand: false });
      source[key] = 'process.env';
    }
  }

  // 展开只做一层：$NAME 换成 NAME 最终的原始值（不再展开它里面的 $）
  const lookup = (name: string) => processEnv[name] ?? raw.get(name)?.value ?? '';
  const env: Record<string, string> = {};
  for (const [key, { value, expand }] of raw) {
    env[key] = expand
      ? value.replace(/\\\$|\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (all, braced?: string, bare?: string) => {
          const name = braced ?? bare;
          return name === undefined ? '$' : lookup(name);
        })
      : value;
  }
  return { env, source };
}
```
:::

