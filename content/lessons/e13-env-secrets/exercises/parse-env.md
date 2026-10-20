---
kind: task
title: 启动时验证配置
---
在 `env.ts` 中实现 `parseEnv(env)`：`env` 就是 `import.meta.env`（变量名 → 字符串），把它验证并转换成应用使用的 `AppConfig`。**所有的值先去掉首尾空白，空字符串当作没有设置。**

1. `VITE_API_BASE`：必需，必须是 `http:` 或 `https:` 的完整网址，转换成 `URL`。没有设置时错误是 `VITE_API_BASE 是必需的`，格式不对时是 `VITE_API_BASE 必须是 http 或 https 的完整网址`；
2. `VITE_TIMEOUT_MS`：可选，默认 5000；设置了的话必须只由数字组成，并且在 100 到 60000 之间（包括两端），否则错误是 `VITE_TIMEOUT_MS 必须是 100 到 60000 之间的整数`；
3. `VITE_FEATURES`：可选，用逗号分隔的功能名，每个去掉空白，忽略空的，结果放进一个 `Set`；每个名字必须是小写字母开头、只有小写字母、数字和 `-`，否则对每个无效的名字给出错误 `VITE_FEATURES 中有无效的名字：名字`；
4. `VITE_SENTRY_DSN`：可选，没有设置时是 `null`；
5. **密钥检查**：任何以 `VITE_` 开头、名字中含有 `SECRET`、`PASSWORD` 或 `PRIVATE`（不区分大小写）的变量，都给出错误 `名字 看起来是密钥，不应该以 VITE_ 开头（会被打包进前端代码）`，按变量名排序（用 `toSorted()` 的默认顺序）。

有任何错误时返回 `{ ok: false, errors }`，错误的顺序是 1、2、3、5；全部检查完再返回，不要遇到第一个错误就停下。

:::files{role=starter}
```ts file=env.ts
export type AppConfig = {
  apiBase: URL;
  timeoutMs: number;
  features: ReadonlySet<string>;
  sentryDsn: string | null;
};

export type EnvResult = { ok: true; config: AppConfig } | { ok: false; errors: string[] };

export function parseEnv(env: Readonly<Record<string, string | undefined>>): EnvResult {
  return {
    ok: true,
    config: {
      apiBase: new URL(env['VITE_API_BASE'] ?? 'http://localhost'),
      timeoutMs: Number(env['VITE_TIMEOUT_MS']),
      features: new Set((env['VITE_FEATURES'] ?? '').split(',')),
      sentryDsn: env['VITE_SENTRY_DSN'] ?? null,
    },
  };
}
```
```ts file=main.ts
import { parseEnv } from './env';

// 真实的项目中这里是 import.meta.env；这个网站上没有 Vite，所以直接写出来
const result = parseEnv({
  VITE_API_BASE: 'https://api.example.com/v1/',
  VITE_TIMEOUT_MS: '8000',
  VITE_FEATURES: 'dark-mode, beta-search',
  VITE_STRIPE_SECRET_KEY: 'sk_test_x',
});
if (result.ok) console.log(result.config);
else console.log(result.errors.join('\n'));
```
:::

:::files{role=solution}
```ts file=env.ts
export type AppConfig = {
  apiBase: URL;
  timeoutMs: number;
  features: ReadonlySet<string>;
  sentryDsn: string | null;
};

export type EnvResult = { ok: true; config: AppConfig } | { ok: false; errors: string[] };

const SECRET_WORDS = /SECRET|PASSWORD|PRIVATE/i;
const FEATURE_NAME = /^[a-z][a-z0-9-]*$/;

/** 空字符串和只有空白都当作没有设置 */
function read(env: Readonly<Record<string, string | undefined>>, name: string): string | null {
  const value = env[name]?.trim();
  return value === undefined || value === '' ? null : value;
}

function parseApiBase(raw: string | null, errors: string[]): URL | null {
  if (raw === null) {
    errors.push('VITE_API_BASE 是必需的');
    return null;
  }
  if (URL.canParse(raw)) {
    const url = new URL(raw);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url;
  }
  errors.push('VITE_API_BASE 必须是 http 或 https 的完整网址');
  return null;
}

function parseTimeout(raw: string | null, errors: string[]): number {
  if (raw === null) return 5000;
  const value = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  if (value >= 100 && value <= 60000) return value;
  errors.push('VITE_TIMEOUT_MS 必须是 100 到 60000 之间的整数');
  return 5000;
}

function parseFeatures(raw: string | null, errors: string[]): Set<string> {
  const names = (raw ?? '').split(',').map((name) => name.trim()).filter((name) => name !== '');
  for (const name of names) {
    if (!FEATURE_NAME.test(name)) errors.push(`VITE_FEATURES 中有无效的名字：${name}`);
  }
  return new Set(names);
}

export function parseEnv(env: Readonly<Record<string, string | undefined>>): EnvResult {
  const errors: string[] = [];
  const apiBase = parseApiBase(read(env, 'VITE_API_BASE'), errors);
  const timeoutMs = parseTimeout(read(env, 'VITE_TIMEOUT_MS'), errors);
  const features = parseFeatures(read(env, 'VITE_FEATURES'), errors);
  // 名字像密钥的 VITE_ 变量：它们会被打包进前端代码
  for (const name of Object.keys(env).toSorted()) {
    if (name.startsWith('VITE_') && SECRET_WORDS.test(name)) {
      errors.push(`${name} 看起来是密钥，不应该以 VITE_ 开头（会被打包进前端代码）`);
    }
  }
  if (errors.length > 0 || apiBase === null) return { ok: false, errors };
  return { ok: true, config: { apiBase, timeoutMs, features, sentryDsn: read(env, 'VITE_SENTRY_DSN') } };
}
```
```ts file=main.ts
import { parseEnv } from './env';

// 真实的项目中这里是 import.meta.env；这个网站上没有 Vite，所以直接写出来
const result = parseEnv({
  VITE_API_BASE: 'https://api.example.com/v1/',
  VITE_TIMEOUT_MS: '8000',
  VITE_FEATURES: 'dark-mode, beta-search',
  VITE_STRIPE_SECRET_KEY: 'sk_test_x',
});
if (result.ok) console.log(result.config);
else console.log(result.errors.join('\n'));
```
:::

:::files{role=tests}
```ts file=env.test.ts
import { describe, expect, test } from 'vitest';
import { parseEnv } from './env';

const base = { VITE_API_BASE: 'https://api.example.com/v1/' };

describe('parseEnv：成功', () => {
  test('默认值', () => {
    const result = parseEnv(base);
    if (!result.ok) throw new Error(result.errors.join('；'));
    expect(result.config.apiBase.href).toBe('https://api.example.com/v1/');
    expect(result.config.timeoutMs).toBe(5000);
    expect([...result.config.features]).toEqual([]);
    expect(result.config.sentryDsn).toBeNull();
  });

  test('全部设置；去掉空白，忽略空的名字', () => {
    const result = parseEnv({ ...base, VITE_TIMEOUT_MS: ' 8000 ', VITE_FEATURES: ' dark-mode, ,beta-search,dark-mode ', VITE_SENTRY_DSN: 'https://abc@o1.ingest.sentry.io/2' });
    if (!result.ok) throw new Error(result.errors.join('；'));
    expect(result.config.timeoutMs).toBe(8000);
    expect([...result.config.features]).toEqual(['dark-mode', 'beta-search']);
    expect(result.config.sentryDsn).toBe('https://abc@o1.ingest.sentry.io/2');
  });

  test('空字符串和只有空白都当作没有设置', () => {
    const result = parseEnv({ ...base, VITE_TIMEOUT_MS: '', VITE_SENTRY_DSN: '   ' });
    expect(result).toMatchObject({ ok: true, config: { timeoutMs: 5000, sentryDsn: null } });
  });

  test('边界：100 和 60000 都可以', () => {
    expect(parseEnv({ ...base, VITE_TIMEOUT_MS: '100' })).toMatchObject({ ok: true, config: { timeoutMs: 100 } });
    expect(parseEnv({ ...base, VITE_TIMEOUT_MS: '60000' })).toMatchObject({ ok: true, config: { timeoutMs: 60000 } });
  });
});

describe('parseEnv：错误', () => {
  test('缺少接口地址', () => {
    expect(parseEnv({})).toEqual({ ok: false, errors: ['VITE_API_BASE 是必需的'] });
    expect(parseEnv({ VITE_API_BASE: '  ' })).toEqual({ ok: false, errors: ['VITE_API_BASE 是必需的'] });
  });

  test('接口地址必须是 http 或 https 的完整网址', () => {
    for (const value of ['/api', 'api.example.com', 'ftp://files.example.com', 'javascript:alert(1)']) {
      expect(parseEnv({ VITE_API_BASE: value }), value).toEqual({ ok: false, errors: ['VITE_API_BASE 必须是 http 或 https 的完整网址'] });
    }
  });

  test('超时必须是范围内的整数', () => {
    for (const value of ['99', '60001', '1e3', '1000.5', '-500', 'abc', '0x100']) {
      expect(parseEnv({ ...base, VITE_TIMEOUT_MS: value }), value).toEqual({ ok: false, errors: ['VITE_TIMEOUT_MS 必须是 100 到 60000 之间的整数'] });
    }
  });

  test('功能名只能是小写字母开头的字母、数字和 -', () => {
    expect(parseEnv({ ...base, VITE_FEATURES: 'ok, Bad, 9lives' })).toEqual({
      ok: false,
      errors: ['VITE_FEATURES 中有无效的名字：Bad', 'VITE_FEATURES 中有无效的名字：9lives'],
    });
  });

  test('名字像密钥的 VITE_ 变量（不分大小写），按名字排序', () => {
    expect(parseEnv({ ...base, VITE_STRIPE_SECRET_KEY: 'x', VITE_db_password: 'y', SECRET_TOKEN: 'z', VITE_PUBLIC_KEY: 'pk' })).toEqual({
      ok: false,
      errors: ['VITE_STRIPE_SECRET_KEY 看起来是密钥，不应该以 VITE_ 开头（会被打包进前端代码）', 'VITE_db_password 看起来是密钥，不应该以 VITE_ 开头（会被打包进前端代码）'],
    });
  });

  test('收集全部错误，按顺序', () => {
    expect(parseEnv({ VITE_API_BASE: 'nope', VITE_TIMEOUT_MS: '5', VITE_FEATURES: 'X', VITE_PRIVATE_KEY: 'k' })).toEqual({
      ok: false,
      errors: [
        'VITE_API_BASE 必须是 http 或 https 的完整网址',
        'VITE_TIMEOUT_MS 必须是 100 到 60000 之间的整数',
        'VITE_FEATURES 中有无效的名字：X',
        'VITE_PRIVATE_KEY 看起来是密钥，不应该以 VITE_ 开头（会被打包进前端代码）',
      ],
    });
  });
});
```
:::

:::hint{level=1}
先写一个 `read(env, name)`：取出值、`trim()`，空字符串返回 `null`。然后每个变量一个小函数，把错误 `push` 进同一个数组。网址可以用 `URL.canParse(raw)` 判断能否解析，再检查 `url.protocol` 是不是 `'http:'` 或 `'https:'`。
:::

:::hint{level=2}
超时先用 `/^\d+$/` 检查“只有数字”，再比较范围：`Number('1e3')` 是 1000，`Number('0x100')` 是 256，只用 `Number` 会把它们当成合法的值。密钥检查用 `Object.keys(env).toSorted()` 遍历，正则 `/SECRET|PASSWORD|PRIVATE/i` 的 `i` 表示不区分大小写。
:::

:::explanation
启动时验证配置是一种“让错误尽早出现”的做法：部署时忘了设置 `VITE_API_BASE`，用户打开页面就能看到一条清楚的错误（或者监控中出现一条告警），而不是等到某个请求发往 `undefined/users` 时才莫名其妙地失败。e06 讲过的运行时验证，同样适用于配置。

几个细节：

- **只接受完整的 `http`/`https` 网址**：`/api` 这样的相对路径会被当成当前网站下的路径，`javascript:` 则是一个安全问题（e12）；
- **严格地解析数字**：环境变量都是字符串，`Number()` 接受的写法太多（`1e3`、`0x100`、前后的空白），配置中出现这些多半是写错了；
- **密钥检查**：这是对正文中“不要把密钥放进 `VITE_` 变量”的自动提醒。它只能发现名字可疑的变量，`VITE_STRIPE_KEY` 这样名字正常、但值是私密密钥 `sk_…` 的情况，需要下面的编程挑战中那种按值的检查；
- **收集全部错误**：部署平台上修改一次环境变量、再部署一次，往往要好几分钟。一次列出全部的问题，可以一次改好。

真实的项目中可以用 zod 这类库写同样的验证（e06），思路完全相同。
:::

:::variant{kind=alt name=try-and-parse}
```ts file=env.ts
export type AppConfig = {
  apiBase: URL;
  timeoutMs: number;
  features: ReadonlySet<string>;
  sentryDsn: string | null;
};

export type EnvResult = { ok: true; config: AppConfig } | { ok: false; errors: string[] };

export function parseEnv(env: Readonly<Record<string, string | undefined>>): EnvResult {
  const errors: string[] = [];
  const get = (name: string) => {
    const value = (env[name] ?? '').trim();
    return value.length > 0 ? value : undefined;
  };

  let apiBase: URL | undefined;
  const rawBase = get('VITE_API_BASE');
  if (rawBase === undefined) errors.push('VITE_API_BASE 是必需的');
  else {
    try {
      const url = new URL(rawBase);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('协议不对');
      apiBase = url;
    } catch {
      errors.push('VITE_API_BASE 必须是 http 或 https 的完整网址');
    }
  }

  let timeoutMs = 5000;
  const rawTimeout = get('VITE_TIMEOUT_MS');
  if (rawTimeout !== undefined) {
    const n = Number.parseInt(rawTimeout, 10);
    if (String(n) === rawTimeout && n >= 100 && n <= 60000) timeoutMs = n;
    else errors.push('VITE_TIMEOUT_MS 必须是 100 到 60000 之间的整数');
  }

  const features = new Set<string>();
  for (const part of (get('VITE_FEATURES') ?? '').split(',')) {
    const name = part.trim();
    if (name === '') continue;
    if (/^[a-z][a-z0-9-]*$/.test(name)) features.add(name);
    else errors.push(`VITE_FEATURES 中有无效的名字：${name}`);
  }

  const suspicious = Object.keys(env).filter((name) => name.startsWith('VITE_') && /secret|password|private/i.test(name)).sort();
  for (const name of suspicious) errors.push(`${name} 看起来是密钥，不应该以 VITE_ 开头（会被打包进前端代码）`);

  if (errors.length > 0 || apiBase === undefined) return { ok: false, errors };
  return { ok: true, config: { apiBase, timeoutMs, features, sentryDsn: get('VITE_SENTRY_DSN') ?? null } };
}
```
:::

:::variant{kind=wrong name=number-is-enough fails=tests reason="用 Number() 检查超时：1e3、0x100 这样的写法也被接受了"}
```ts file=env.ts
export type AppConfig = {
  apiBase: URL;
  timeoutMs: number;
  features: ReadonlySet<string>;
  sentryDsn: string | null;
};

export type EnvResult = { ok: true; config: AppConfig } | { ok: false; errors: string[] };

const SECRET_WORDS = /SECRET|PASSWORD|PRIVATE/i;
const FEATURE_NAME = /^[a-z][a-z0-9-]*$/;

/** 空字符串和只有空白都当作没有设置 */
function read(env: Readonly<Record<string, string | undefined>>, name: string): string | null {
  const value = env[name]?.trim();
  return value === undefined || value === '' ? null : value;
}

function parseApiBase(raw: string | null, errors: string[]): URL | null {
  if (raw === null) {
    errors.push('VITE_API_BASE 是必需的');
    return null;
  }
  if (URL.canParse(raw)) {
    const url = new URL(raw);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url;
  }
  errors.push('VITE_API_BASE 必须是 http 或 https 的完整网址');
  return null;
}

function parseTimeout(raw: string | null, errors: string[]): number {
  if (raw === null) return 5000;
  const value = Number(raw);
  if (Number.isInteger(value) && value >= 100 && value <= 60000) return value;
  errors.push('VITE_TIMEOUT_MS 必须是 100 到 60000 之间的整数');
  return 5000;
}

function parseFeatures(raw: string | null, errors: string[]): Set<string> {
  const names = (raw ?? '').split(',').map((name) => name.trim()).filter((name) => name !== '');
  for (const name of names) {
    if (!FEATURE_NAME.test(name)) errors.push(`VITE_FEATURES 中有无效的名字：${name}`);
  }
  return new Set(names);
}

export function parseEnv(env: Readonly<Record<string, string | undefined>>): EnvResult {
  const errors: string[] = [];
  const apiBase = parseApiBase(read(env, 'VITE_API_BASE'), errors);
  const timeoutMs = parseTimeout(read(env, 'VITE_TIMEOUT_MS'), errors);
  const features = parseFeatures(read(env, 'VITE_FEATURES'), errors);
  // 名字像密钥的 VITE_ 变量：它们会被打包进前端代码
  for (const name of Object.keys(env).toSorted()) {
    if (name.startsWith('VITE_') && SECRET_WORDS.test(name)) {
      errors.push(`${name} 看起来是密钥，不应该以 VITE_ 开头（会被打包进前端代码）`);
    }
  }
  if (errors.length > 0 || apiBase === null) return { ok: false, errors };
  return { ok: true, config: { apiBase, timeoutMs, features, sentryDsn: read(env, 'VITE_SENTRY_DSN') } };
}
```
:::

:::variant{kind=wrong name=any-protocol fails=tests reason="只检查能不能解析成 URL：ftp: 和 javascript: 也被当成了接口地址"}
```ts file=env.ts
export type AppConfig = {
  apiBase: URL;
  timeoutMs: number;
  features: ReadonlySet<string>;
  sentryDsn: string | null;
};

export type EnvResult = { ok: true; config: AppConfig } | { ok: false; errors: string[] };

const SECRET_WORDS = /SECRET|PASSWORD|PRIVATE/i;
const FEATURE_NAME = /^[a-z][a-z0-9-]*$/;

/** 空字符串和只有空白都当作没有设置 */
function read(env: Readonly<Record<string, string | undefined>>, name: string): string | null {
  const value = env[name]?.trim();
  return value === undefined || value === '' ? null : value;
}

function parseApiBase(raw: string | null, errors: string[]): URL | null {
  if (raw === null) {
    errors.push('VITE_API_BASE 是必需的');
    return null;
  }
  if (URL.canParse(raw)) {
    const url = new URL(raw);
    return url;
  }
  errors.push('VITE_API_BASE 必须是 http 或 https 的完整网址');
  return null;
}

function parseTimeout(raw: string | null, errors: string[]): number {
  if (raw === null) return 5000;
  const value = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  if (value >= 100 && value <= 60000) return value;
  errors.push('VITE_TIMEOUT_MS 必须是 100 到 60000 之间的整数');
  return 5000;
}

function parseFeatures(raw: string | null, errors: string[]): Set<string> {
  const names = (raw ?? '').split(',').map((name) => name.trim()).filter((name) => name !== '');
  for (const name of names) {
    if (!FEATURE_NAME.test(name)) errors.push(`VITE_FEATURES 中有无效的名字：${name}`);
  }
  return new Set(names);
}

export function parseEnv(env: Readonly<Record<string, string | undefined>>): EnvResult {
  const errors: string[] = [];
  const apiBase = parseApiBase(read(env, 'VITE_API_BASE'), errors);
  const timeoutMs = parseTimeout(read(env, 'VITE_TIMEOUT_MS'), errors);
  const features = parseFeatures(read(env, 'VITE_FEATURES'), errors);
  // 名字像密钥的 VITE_ 变量：它们会被打包进前端代码
  for (const name of Object.keys(env).toSorted()) {
    if (name.startsWith('VITE_') && SECRET_WORDS.test(name)) {
      errors.push(`${name} 看起来是密钥，不应该以 VITE_ 开头（会被打包进前端代码）`);
    }
  }
  if (errors.length > 0 || apiBase === null) return { ok: false, errors };
  return { ok: true, config: { apiBase, timeoutMs, features, sentryDsn: read(env, 'VITE_SENTRY_DSN') } };
}
```
:::

:::variant{kind=wrong name=case-sensitive-secret fails=tests reason="检查密钥的名字时区分了大小写：VITE_db_password 没有被发现"}
```ts file=env.ts
export type AppConfig = {
  apiBase: URL;
  timeoutMs: number;
  features: ReadonlySet<string>;
  sentryDsn: string | null;
};

export type EnvResult = { ok: true; config: AppConfig } | { ok: false; errors: string[] };

const SECRET_WORDS = /SECRET|PASSWORD|PRIVATE/;
const FEATURE_NAME = /^[a-z][a-z0-9-]*$/;

/** 空字符串和只有空白都当作没有设置 */
function read(env: Readonly<Record<string, string | undefined>>, name: string): string | null {
  const value = env[name]?.trim();
  return value === undefined || value === '' ? null : value;
}

function parseApiBase(raw: string | null, errors: string[]): URL | null {
  if (raw === null) {
    errors.push('VITE_API_BASE 是必需的');
    return null;
  }
  if (URL.canParse(raw)) {
    const url = new URL(raw);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url;
  }
  errors.push('VITE_API_BASE 必须是 http 或 https 的完整网址');
  return null;
}

function parseTimeout(raw: string | null, errors: string[]): number {
  if (raw === null) return 5000;
  const value = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  if (value >= 100 && value <= 60000) return value;
  errors.push('VITE_TIMEOUT_MS 必须是 100 到 60000 之间的整数');
  return 5000;
}

function parseFeatures(raw: string | null, errors: string[]): Set<string> {
  const names = (raw ?? '').split(',').map((name) => name.trim()).filter((name) => name !== '');
  for (const name of names) {
    if (!FEATURE_NAME.test(name)) errors.push(`VITE_FEATURES 中有无效的名字：${name}`);
  }
  return new Set(names);
}

export function parseEnv(env: Readonly<Record<string, string | undefined>>): EnvResult {
  const errors: string[] = [];
  const apiBase = parseApiBase(read(env, 'VITE_API_BASE'), errors);
  const timeoutMs = parseTimeout(read(env, 'VITE_TIMEOUT_MS'), errors);
  const features = parseFeatures(read(env, 'VITE_FEATURES'), errors);
  // 名字像密钥的 VITE_ 变量：它们会被打包进前端代码
  for (const name of Object.keys(env).toSorted()) {
    if (name.startsWith('VITE_') && SECRET_WORDS.test(name)) {
      errors.push(`${name} 看起来是密钥，不应该以 VITE_ 开头（会被打包进前端代码）`);
    }
  }
  if (errors.length > 0 || apiBase === null) return { ok: false, errors };
  return { ok: true, config: { apiBase, timeoutMs, features, sentryDsn: read(env, 'VITE_SENTRY_DSN') } };
}
```
:::

:::variant{kind=wrong name=blank-is-value fails=tests reason="没有把空白当作“没有设置”：VITE_TIMEOUT_MS 为空字符串时报错，而不是使用默认值"}
```ts file=env.ts
export type AppConfig = {
  apiBase: URL;
  timeoutMs: number;
  features: ReadonlySet<string>;
  sentryDsn: string | null;
};

export type EnvResult = { ok: true; config: AppConfig } | { ok: false; errors: string[] };

const SECRET_WORDS = /SECRET|PASSWORD|PRIVATE/i;
const FEATURE_NAME = /^[a-z][a-z0-9-]*$/;

/** 空字符串和只有空白都当作没有设置 */
function read(env: Readonly<Record<string, string | undefined>>, name: string): string | null {
  const value = env[name];
  return value === undefined ? null : value.trim();
}

function parseApiBase(raw: string | null, errors: string[]): URL | null {
  if (raw === null) {
    errors.push('VITE_API_BASE 是必需的');
    return null;
  }
  if (URL.canParse(raw)) {
    const url = new URL(raw);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url;
  }
  errors.push('VITE_API_BASE 必须是 http 或 https 的完整网址');
  return null;
}

function parseTimeout(raw: string | null, errors: string[]): number {
  if (raw === null) return 5000;
  const value = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  if (value >= 100 && value <= 60000) return value;
  errors.push('VITE_TIMEOUT_MS 必须是 100 到 60000 之间的整数');
  return 5000;
}

function parseFeatures(raw: string | null, errors: string[]): Set<string> {
  const names = (raw ?? '').split(',').map((name) => name.trim()).filter((name) => name !== '');
  for (const name of names) {
    if (!FEATURE_NAME.test(name)) errors.push(`VITE_FEATURES 中有无效的名字：${name}`);
  }
  return new Set(names);
}

export function parseEnv(env: Readonly<Record<string, string | undefined>>): EnvResult {
  const errors: string[] = [];
  const apiBase = parseApiBase(read(env, 'VITE_API_BASE'), errors);
  const timeoutMs = parseTimeout(read(env, 'VITE_TIMEOUT_MS'), errors);
  const features = parseFeatures(read(env, 'VITE_FEATURES'), errors);
  // 名字像密钥的 VITE_ 变量：它们会被打包进前端代码
  for (const name of Object.keys(env).toSorted()) {
    if (name.startsWith('VITE_') && SECRET_WORDS.test(name)) {
      errors.push(`${name} 看起来是密钥，不应该以 VITE_ 开头（会被打包进前端代码）`);
    }
  }
  if (errors.length > 0 || apiBase === null) return { ok: false, errors };
  return { ok: true, config: { apiBase, timeoutMs, features, sentryDsn: read(env, 'VITE_SENTRY_DSN') } };
}
```
:::

:::variant{kind=wrong name=stop-at-first fails=tests reason="遇到第一个错误就返回：部署时要改好几次才能知道所有的问题"}
```ts file=env.ts
export type AppConfig = {
  apiBase: URL;
  timeoutMs: number;
  features: ReadonlySet<string>;
  sentryDsn: string | null;
};

export type EnvResult = { ok: true; config: AppConfig } | { ok: false; errors: string[] };

const SECRET_WORDS = /SECRET|PASSWORD|PRIVATE/i;
const FEATURE_NAME = /^[a-z][a-z0-9-]*$/;

/** 空字符串和只有空白都当作没有设置 */
function read(env: Readonly<Record<string, string | undefined>>, name: string): string | null {
  const value = env[name]?.trim();
  return value === undefined || value === '' ? null : value;
}

function parseApiBase(raw: string | null, errors: string[]): URL | null {
  if (raw === null) {
    errors.push('VITE_API_BASE 是必需的');
    return null;
  }
  if (URL.canParse(raw)) {
    const url = new URL(raw);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url;
  }
  errors.push('VITE_API_BASE 必须是 http 或 https 的完整网址');
  return null;
}

function parseTimeout(raw: string | null, errors: string[]): number {
  if (raw === null) return 5000;
  const value = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  if (value >= 100 && value <= 60000) return value;
  errors.push('VITE_TIMEOUT_MS 必须是 100 到 60000 之间的整数');
  return 5000;
}

function parseFeatures(raw: string | null, errors: string[]): Set<string> {
  const names = (raw ?? '').split(',').map((name) => name.trim()).filter((name) => name !== '');
  for (const name of names) {
    if (!FEATURE_NAME.test(name)) errors.push(`VITE_FEATURES 中有无效的名字：${name}`);
  }
  return new Set(names);
}

export function parseEnv(env: Readonly<Record<string, string | undefined>>): EnvResult {
  const errors: string[] = [];
  const apiBase = parseApiBase(read(env, 'VITE_API_BASE'), errors);
  if (apiBase === null) return { ok: false, errors };
  const timeoutMs = parseTimeout(read(env, 'VITE_TIMEOUT_MS'), errors);
  const features = parseFeatures(read(env, 'VITE_FEATURES'), errors);
  // 名字像密钥的 VITE_ 变量：它们会被打包进前端代码
  for (const name of Object.keys(env).toSorted()) {
    if (name.startsWith('VITE_') && SECRET_WORDS.test(name)) {
      errors.push(`${name} 看起来是密钥，不应该以 VITE_ 开头（会被打包进前端代码）`);
    }
  }
  if (errors.length > 0 || apiBase === null) return { ok: false, errors };
  return { ok: true, config: { apiBase, timeoutMs, features, sentryDsn: read(env, 'VITE_SENTRY_DSN') } };
}
```
:::
