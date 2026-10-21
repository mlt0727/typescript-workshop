---
kind: challenge
title: 一行日志
---
在 `log.ts` 中实现 `formatLog(entry, options)`：把一条日志变成**一行** JSON 字符串。它会被用在出错的时候，所以无论传进来什么都不能抛出错误。

1. 字段的顺序：`time`（`options.time`）、`level`、`message`，然后是 `entry.fields` 中的字段（按原来的顺序）。`fields` 中名为 `time`、`level`、`message` 的字段忽略；名为 `__proto__` 的字段也要照样写出来；
2. **按名字隐藏**：名字（不分大小写）中含有 `password`、`secret`、`token`、`authorization`、`cookie`、`apikey`、`api_key` 的字段，不管值是什么，都换成字符串 `[REDACTED]`。在任何深度都是：嵌套的对象中、数组中的对象中；
3. **按值隐藏**：`options.secrets` 中至少有 8 个字符的每一个值，出现在任何字符串中（包括 `message`、错误的信息）都换成 `[REDACTED]`。长的先替换；
4. **截断**：替换之后，超过 500 个字符（按码点）的字符串只保留前 500 个，后面加上 `…（共 N 个字符）`，N 是替换之后、截断之前的字符数；
5. 其他的值：
   - 错误（`instanceof Error`）：只有 `name`、`message`，有 `cause` 时再加上处理过的 `cause`（同样的规则）；
   - `Date`：`toISOString()` 的结果，无效的日期是 `'Invalid Date'`；`bigint`：十进制的字符串；
   - `undefined`、函数、`symbol`：对象中的去掉，数组中的变成 `null`（和 `JSON.stringify` 一样）；
   - 循环引用（一个对象出现在它自己的里面）：`'[Circular]'`。同一个对象在不同的地方出现两次不算循环。

:::files{role=starter}
```ts file=log.ts
export type Level = 'debug' | 'info' | 'warn' | 'error';

export type LogEntry = Readonly<{ level: Level; message: string; fields?: Readonly<Record<string, unknown>> }>;

export type LogOptions = Readonly<{
  /** 记录的时间，ISO 格式 */
  time: string;
  /** 不能出现在日志中的值，例如数据库的密码、API 密钥 */
  secrets: readonly string[];
}>;

/** 把一条日志变成一行 JSON：去掉密钥，截断太长的字符串，不会抛出错误 */
export function formatLog(entry: LogEntry, options: LogOptions): string {
  // TODO
  return JSON.stringify({ time: options.time, level: entry.level, message: entry.message, ...entry.fields });
}
```
```ts file=main.ts readonly
import { formatLog } from './log';

const DATABASE_URL = 'postgres://app:s3cr3t-pass@db.example.com/app';
const error = new Error(`connect failed: ${DATABASE_URL}`, { cause: new TypeError('fetch failed') });
const line = formatLog(
  {
    level: 'error',
    message: 'PATCH /api/projects/p1 500',
    fields: { requestId: 'req-000042', headers: { authorization: 'Bearer abc', accept: 'application/json' }, error },
  },
  { time: new Date().toISOString(), secrets: [DATABASE_URL] },
);
console.log(line);
```
:::

:::files{role=solution}
```ts file=log.ts
export type Level = 'debug' | 'info' | 'warn' | 'error';

export type LogEntry = Readonly<{ level: Level; message: string; fields?: Readonly<Record<string, unknown>> }>;

export type LogOptions = Readonly<{
  /** 记录的时间，ISO 格式 */
  time: string;
  /** 不能出现在日志中的值，例如数据库的密码、API 密钥 */
  secrets: readonly string[];
}>;

const REDACTED = '[REDACTED]';
const SENSITIVE = ['password', 'secret', 'token', 'authorization', 'cookie', 'apikey', 'api_key'];
const RESERVED = new Set(['time', 'level', 'message']);
const MAX_LENGTH = 500;

const isSensitive = (key: string) => SENSITIVE.some((word) => key.toLowerCase().includes(word));

/** 把一条日志变成一行 JSON：去掉密钥，截断太长的字符串，不会抛出错误 */
export function formatLog(entry: LogEntry, options: LogOptions): string {
  // 先替换长的：一个密钥包含另一个时，不会只替换掉一半
  const hidden = options.secrets.filter((secret) => secret.length >= 8).toSorted((a, b) => b.length - a.length);

  const scrub = (text: string): string => {
    let result = text;
    for (const secret of hidden) result = result.replaceAll(secret, REDACTED);
    // 先替换密钥再截断：截断的地方正好落在密钥中间时，也不会漏出一半
    const chars = [...result];
    return chars.length > MAX_LENGTH ? `${chars.slice(0, MAX_LENGTH).join('')}…（共 ${chars.length} 个字符）` : result;
  };

  // 正在处理的对象（从根到当前的路径上的）：再遇到它就是循环引用
  const ancestors = new Set<object>();

  const clean = (value: unknown): unknown => {
    if (typeof value === 'string') return scrub(value);
    if (typeof value === 'bigint') return value.toString();
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value !== 'object') return undefined; // undefined、函数、symbol：和 JSON.stringify 一样去掉
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
    if (ancestors.has(value)) return '[Circular]';
    ancestors.add(value);
    try {
      if (value instanceof Error) {
        const error: [string, unknown][] = [
          ['name', scrub(value.name)],
          ['message', scrub(value.message)],
        ];
        if (value.cause !== undefined) error.push(['cause', clean(value.cause)]);
        return Object.fromEntries(error);
      }
      if (Array.isArray(value)) return value.map((item) => clean(item) ?? null);
      return Object.fromEntries(cleanEntries(Object.entries(value)));
    } finally {
      ancestors.delete(value);
    }
  };

  const cleanEntries = (entries: [string, unknown][]): [string, unknown][] =>
    entries.flatMap(([key, value]): [string, unknown][] => {
      if (isSensitive(key)) return [[key, REDACTED]];
      const cleaned = clean(value);
      return cleaned === undefined ? [] : [[key, cleaned]];
    });

  const fields = Object.entries(entry.fields ?? {}).filter(([key]) => !RESERVED.has(key));
  // Object.fromEntries 定义字段：名为 __proto__ 的字段也只是一个普通的字段（p3-01）
  const line = Object.fromEntries<unknown>([['time', options.time], ['level', entry.level], ['message', scrub(entry.message)], ...cleanEntries(fields)]);
  return JSON.stringify(line);
}
```
```ts file=main.ts readonly
import { formatLog } from './log';

const DATABASE_URL = 'postgres://app:s3cr3t-pass@db.example.com/app';
const error = new Error(`connect failed: ${DATABASE_URL}`, { cause: new TypeError('fetch failed') });
const line = formatLog(
  {
    level: 'error',
    message: 'PATCH /api/projects/p1 500',
    fields: { requestId: 'req-000042', headers: { authorization: 'Bearer abc', accept: 'application/json' }, error },
  },
  { time: new Date().toISOString(), secrets: [DATABASE_URL] },
);
console.log(line);
```
:::

:::files{role=tests}
```ts file=log.test.ts
import { describe, expect, test } from 'vitest';
import { formatLog, type LogEntry } from './log';

const TIME = '2026-10-21T10:00:00.000Z';
const SECRET = 'postgres://app:s3cr3t-pass@db.example.com/app';
const line = (entry: LogEntry, secrets: readonly string[] = [SECRET]) => formatLog(entry, { time: TIME, secrets });
const parse = (entry: LogEntry, secrets?: readonly string[]): unknown => JSON.parse(line(entry, secrets));

describe('formatLog', () => {
  test('一行 JSON：time、level、message 在前，然后是其他的字段', () => {
    const text = line({ level: 'info', message: 'PATCH /api/projects/p1 200', fields: { status: 200, durationMs: 12, ok: true, note: null } });
    expect(text).toBe('{"time":"2026-10-21T10:00:00.000Z","level":"info","message":"PATCH /api/projects/p1 200","status":200,"durationMs":12,"ok":true,"note":null}');
  });

  test('多行的信息也只占一行', () => {
    expect(line({ level: 'error', message: '第一行\n第二行' }).includes('\n')).toBe(false);
  });

  test('fields 不能覆盖 time、level、message', () => {
    expect(parse({ level: 'info', message: '真的', fields: { time: 'x', level: 'debug', message: '假的', user: 'u1' } })).toStrictEqual({ time: TIME, level: 'info', message: '真的', user: 'u1' });
  });

  test('名字像密码、令牌的字段：值换成 [REDACTED]，包括嵌套的对象和数组中的', () => {
    const fields = {
      password: 'hunter2',
      headers: { Authorization: 'Bearer abc', cookie: 'session=xyz', accept: 'application/json' },
      users: [{ name: '王芳', apiKey: 'k-1' }, { name: '李雷', API_KEY: 'k-2' }],
      resetToken: { value: 'tok' },
      dbSecret: 1,
    };
    expect(parse({ level: 'info', message: 'm', fields })).toStrictEqual({
      time: TIME,
      level: 'info',
      message: 'm',
      password: '[REDACTED]',
      headers: { Authorization: '[REDACTED]', cookie: '[REDACTED]', accept: 'application/json' },
      users: [{ name: '王芳', apiKey: '[REDACTED]' }, { name: '李雷', API_KEY: '[REDACTED]' }],
      resetToken: '[REDACTED]',
      dbSecret: '[REDACTED]',
    });
  });

  test('密钥的值出现在任何字符串中都被替换：信息、字段、错误的信息', () => {
    const error = new Error(`connect failed: ${SECRET}`);
    const text = line({ level: 'error', message: `cannot open ${SECRET}`, fields: { url: SECRET, nested: [`x ${SECRET} y`], error } });
    expect(text.includes('s3cr3t-pass')).toBe(false);
    expect(JSON.parse(text)).toMatchObject({
      message: 'cannot open [REDACTED]',
      url: '[REDACTED]',
      nested: ['x [REDACTED] y'],
      error: { name: 'Error', message: 'connect failed: [REDACTED]' },
    });
  });

  test('少于 8 个字符的“密钥”不替换（否则 a、the 这样的词都没了）；长的先替换', () => {
    expect(parse({ level: 'info', message: 'abc value abcdefgh abcdefgh-12345' }, ['abc', 'abcdefgh', 'abcdefgh-12345'])).toMatchObject({
      message: 'abc value [REDACTED] [REDACTED]',
    });
  });

  test('错误：只有 name、message 和 cause（没有 stack）', () => {
    const cause = new TypeError('fetch failed');
    const error = new Error('保存失败', { cause });
    expect(parse({ level: 'error', message: 'm', fields: { error } })).toStrictEqual({
      time: TIME,
      level: 'error',
      message: 'm',
      error: { name: 'Error', message: '保存失败', cause: { name: 'TypeError', message: 'fetch failed' } },
    });
  });

  test('太长的字符串：按码点截断到 500 个，后面注明原来的长度', () => {
    const long = '字'.repeat(600);
    expect(parse({ level: 'info', message: long })).toMatchObject({ message: `${'字'.repeat(500)}…（共 600 个字符）` });
    const emoji = '🚀'.repeat(500);
    expect(parse({ level: 'info', message: emoji })).toMatchObject({ message: emoji });
  });

  test('先替换密钥再截断：密钥跨过截断的位置时也不会漏出一部分', () => {
    const message = `${'x'.repeat(495)}${SECRET}`;
    const text = line({ level: 'info', message });
    expect(text.includes('postgres://')).toBe(false);
    expect(text.includes('postg')).toBe(false);
  });

  test('其他的值：Date 是 ISO 字符串，bigint 是字符串，undefined 和函数去掉，数组中的 undefined 是 null', () => {
    expect(
      parse({
        level: 'debug',
        message: 'm',
        fields: { at: new Date(Date.UTC(2026, 9, 21)), bad: new Date(Number.NaN), big: BigInt(10) ** BigInt(20), gone: undefined, fn: () => 1, list: [1, undefined, 3] },
      }),
    ).toStrictEqual({ time: TIME, level: 'debug', message: 'm', at: '2026-10-21T00:00:00.000Z', bad: 'Invalid Date', big: '100000000000000000000', list: [1, null, 3] });
  });

  test('循环引用：换成 [Circular]，不抛出错误；同一个对象出现两次不算循环', () => {
    const node: { name: string; self?: unknown } = { name: 'a' };
    node.self = node;
    const shared = { id: 1 };
    expect(parse({ level: 'info', message: 'm', fields: { node, pair: [shared, shared] } })).toStrictEqual({
      time: TIME,
      level: 'info',
      message: 'm',
      node: { name: 'a', self: '[Circular]' },
      pair: [{ id: 1 }, { id: 1 }],
    });
    const error = new Error('自己是自己的原因');
    error.cause = error;
    expect(parse({ level: 'error', message: 'm', fields: { error } })).toMatchObject({ error: { message: '自己是自己的原因', cause: '[Circular]' } });
  });

  test('字段名是 __proto__ 时也照样写出来', () => {
    const fields: Record<string, unknown> = JSON.parse('{"__proto__":{"isAdmin":true}}');
    expect(line({ level: 'info', message: 'm', fields })).toBe('{"time":"2026-10-21T10:00:00.000Z","level":"info","message":"m","__proto__":{"isAdmin":true}}');
  });
});
```
:::

:::hint{level=1}
写一个递归的函数 `clean(value: unknown): unknown`，按 `typeof` 和 `instanceof` 分情况处理，返回可以交给 `JSON.stringify` 的值；对象和字段的列表都用 `Object.fromEntries` 组成（p3-01：键来自外部时，不要用赋值）。字符串的处理（替换密钥、截断）写成另一个函数 `scrub`。
:::

:::hint{level=2}
循环引用：用一个 `Set` 记下“从根到当前”路径上的对象，进入一个对象之前放进去，处理完之后（`finally`）拿出来；当前的对象已经在路径上，就是循环。只放不拿，就会把出现过两次的对象也当成循环。按码点截断：`[...text]` 得到码点的数组。
:::

:::explanation
日志是给人和工具读的，而且读的人比你想的多：同事、运维、日志平台、几个月之后的你。所以写进去之前要处理三件事：

- **密钥**：按名字隐藏挡住了 `password: '…'` 这样的字段，按值隐藏挡住了藏在错误信息中的连接字符串（正文中实测 Next.js 把它原样打印了出来）。两种都需要：错误的信息没有字段名，而一个叫 `password` 的字段的值，你事先并不知道；
- **大小**：一个巨大的请求体或者 HTML 页面可以让一行日志有几兆，日志平台通常按量收费，也有单行长度的限制；
- **形状**：错误对象直接交给 `JSON.stringify` 得到 `{}`（正文的示例），循环引用会让它抛出错误，`bigint` 也会（p3-01）。写日志本身抛出错误时，原来的错误就没人知道了。

替换和截断的顺序很重要：先截断的话，截断的位置可能正好落在一个密钥的中间，前半个密钥就留了下来。

这里没有记录调用栈（`stack`）。它对调试很有用，但很长；而且构建之后的代码中，文件和行号已经变了样（正文中实测是 `…\server\chunks\_0vj2gv73mjph5._.js:1:113`），要配合 source map 才有意义。需要的话，通常交给专门的错误追踪服务。

替代解把这一次格式化的状态（要隐藏的值、路径上的对象）放在一个类中，用 `switch (typeof value)` 分派，路径用一个数组。
:::

:::variant{kind=alt name=cleaner-class}
```ts file=log.ts
export type Level = 'debug' | 'info' | 'warn' | 'error';

export type LogEntry = Readonly<{ level: Level; message: string; fields?: Readonly<Record<string, unknown>> }>;

export type LogOptions = Readonly<{ time: string; secrets: readonly string[] }>;

const SENSITIVE = /password|secret|token|authorization|cookie|apikey|api_key/i;

/** 用一个类保存这一次格式化需要的状态：要隐藏的值，以及正在处理的对象 */
class Cleaner {
  private readonly path: object[] = [];
  private readonly hidden: string[];

  constructor(secrets: readonly string[]) {
    this.hidden = secrets.filter((secret) => secret.length >= 8).sort((a, b) => b.length - a.length);
  }

  text(value: string): string {
    const replaced = this.hidden.reduce((text, secret) => text.split(secret).join('[REDACTED]'), value);
    const chars = Array.from(replaced);
    if (chars.length <= 500) return replaced;
    return `${chars.slice(0, 500).join('')}…（共 ${chars.length} 个字符）`;
  }

  value(value: unknown): unknown {
    switch (typeof value) {
      case 'string':
        return this.text(value);
      case 'bigint':
        return String(value);
      case 'number':
      case 'boolean':
        return value;
      case 'object':
        return value === null ? null : this.object(value);
      default:
        return undefined;
    }
  }

  object(value: object): unknown {
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : 'Invalid Date';
    if (this.path.includes(value)) return '[Circular]';
    this.path.push(value);
    let result: unknown;
    if (value instanceof Error) {
      const pairs: [string, unknown][] = [['name', this.text(value.name)], ['message', this.text(value.message)]];
      if ('cause' in value && value.cause !== undefined) pairs.push(['cause', this.value(value.cause)]);
      result = Object.fromEntries(pairs);
    } else if (Array.isArray(value)) {
      result = value.map((item: unknown) => {
        const cleaned = this.value(item);
        return cleaned === undefined ? null : cleaned;
      });
    } else {
      result = Object.fromEntries(this.pairs(Object.entries(value)));
    }
    this.path.pop();
    return result;
  }

  pairs(entries: [string, unknown][]): [string, unknown][] {
    const out: [string, unknown][] = [];
    for (const [key, item] of entries) {
      if (SENSITIVE.test(key)) {
        out.push([key, '[REDACTED]']);
        continue;
      }
      const cleaned = this.value(item);
      if (cleaned !== undefined) out.push([key, cleaned]);
    }
    return out;
  }
}

export function formatLog(entry: LogEntry, options: LogOptions): string {
  const cleaner = new Cleaner(options.secrets);
  const fields = Object.entries(entry.fields ?? {}).filter(([key]) => key !== 'time' && key !== 'level' && key !== 'message');
  const head: [string, unknown][] = [['time', options.time], ['level', entry.level], ['message', cleaner.text(entry.message)]];
  return JSON.stringify(Object.fromEntries(head.concat(cleaner.pairs(fields))));
}
```
:::

:::variant{kind=wrong name=no-key-redaction fails=tests reason="只按值替换密钥：名叫 password、authorization 的字段原样写进了日志"}
```ts file=log.ts
export type Level = 'debug' | 'info' | 'warn' | 'error';

export type LogEntry = Readonly<{ level: Level; message: string; fields?: Readonly<Record<string, unknown>> }>;

export type LogOptions = Readonly<{
  /** 记录的时间，ISO 格式 */
  time: string;
  /** 不能出现在日志中的值，例如数据库的密码、API 密钥 */
  secrets: readonly string[];
}>;

const REDACTED = '[REDACTED]';
const SENSITIVE = ['password', 'secret', 'token', 'authorization', 'cookie', 'apikey', 'api_key'];
const RESERVED = new Set(['time', 'level', 'message']);
const MAX_LENGTH = 500;

const isSensitive = (key: string) => SENSITIVE.some((word) => key.toLowerCase().includes(word));

/** 把一条日志变成一行 JSON：去掉密钥，截断太长的字符串，不会抛出错误 */
export function formatLog(entry: LogEntry, options: LogOptions): string {
  // 先替换长的：一个密钥包含另一个时，不会只替换掉一半
  const hidden = options.secrets.filter((secret) => secret.length >= 8).toSorted((a, b) => b.length - a.length);

  const scrub = (text: string): string => {
    let result = text;
    for (const secret of hidden) result = result.replaceAll(secret, REDACTED);
    // 先替换密钥再截断：截断的地方正好落在密钥中间时，也不会漏出一半
    const chars = [...result];
    return chars.length > MAX_LENGTH ? `${chars.slice(0, MAX_LENGTH).join('')}…（共 ${chars.length} 个字符）` : result;
  };

  // 正在处理的对象（从根到当前的路径上的）：再遇到它就是循环引用
  const ancestors = new Set<object>();

  const clean = (value: unknown): unknown => {
    if (typeof value === 'string') return scrub(value);
    if (typeof value === 'bigint') return value.toString();
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value !== 'object') return undefined; // undefined、函数、symbol：和 JSON.stringify 一样去掉
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
    if (ancestors.has(value)) return '[Circular]';
    ancestors.add(value);
    try {
      if (value instanceof Error) {
        const error: [string, unknown][] = [
          ['name', scrub(value.name)],
          ['message', scrub(value.message)],
        ];
        if (value.cause !== undefined) error.push(['cause', clean(value.cause)]);
        return Object.fromEntries(error);
      }
      if (Array.isArray(value)) return value.map((item) => clean(item) ?? null);
      return Object.fromEntries(cleanEntries(Object.entries(value)));
    } finally {
      ancestors.delete(value);
    }
  };

  const cleanEntries = (entries: [string, unknown][]): [string, unknown][] =>
    entries.flatMap(([key, value]): [string, unknown][] => {
      const cleaned = clean(value);
      return cleaned === undefined ? [] : [[key, cleaned]];
    });

  const fields = Object.entries(entry.fields ?? {}).filter(([key]) => !RESERVED.has(key));
  // Object.fromEntries 定义字段：名为 __proto__ 的字段也只是一个普通的字段（p3-01）
  const line = Object.fromEntries<unknown>([['time', options.time], ['level', entry.level], ['message', scrub(entry.message)], ...cleanEntries(fields)]);
  return JSON.stringify(line);
}
```
:::

:::variant{kind=wrong name=short-secrets fails=tests reason="很短的值也当作密钥替换：日志中的 abc 这样的字都被换掉了"}
```ts file=log.ts
export type Level = 'debug' | 'info' | 'warn' | 'error';

export type LogEntry = Readonly<{ level: Level; message: string; fields?: Readonly<Record<string, unknown>> }>;

export type LogOptions = Readonly<{
  /** 记录的时间，ISO 格式 */
  time: string;
  /** 不能出现在日志中的值，例如数据库的密码、API 密钥 */
  secrets: readonly string[];
}>;

const REDACTED = '[REDACTED]';
const SENSITIVE = ['password', 'secret', 'token', 'authorization', 'cookie', 'apikey', 'api_key'];
const RESERVED = new Set(['time', 'level', 'message']);
const MAX_LENGTH = 500;

const isSensitive = (key: string) => SENSITIVE.some((word) => key.toLowerCase().includes(word));

/** 把一条日志变成一行 JSON：去掉密钥，截断太长的字符串，不会抛出错误 */
export function formatLog(entry: LogEntry, options: LogOptions): string {
  // 先替换长的：一个密钥包含另一个时，不会只替换掉一半
  const hidden = options.secrets.filter((secret) => secret.length > 0).toSorted((a, b) => b.length - a.length);

  const scrub = (text: string): string => {
    let result = text;
    for (const secret of hidden) result = result.replaceAll(secret, REDACTED);
    // 先替换密钥再截断：截断的地方正好落在密钥中间时，也不会漏出一半
    const chars = [...result];
    return chars.length > MAX_LENGTH ? `${chars.slice(0, MAX_LENGTH).join('')}…（共 ${chars.length} 个字符）` : result;
  };

  // 正在处理的对象（从根到当前的路径上的）：再遇到它就是循环引用
  const ancestors = new Set<object>();

  const clean = (value: unknown): unknown => {
    if (typeof value === 'string') return scrub(value);
    if (typeof value === 'bigint') return value.toString();
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value !== 'object') return undefined; // undefined、函数、symbol：和 JSON.stringify 一样去掉
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
    if (ancestors.has(value)) return '[Circular]';
    ancestors.add(value);
    try {
      if (value instanceof Error) {
        const error: [string, unknown][] = [
          ['name', scrub(value.name)],
          ['message', scrub(value.message)],
        ];
        if (value.cause !== undefined) error.push(['cause', clean(value.cause)]);
        return Object.fromEntries(error);
      }
      if (Array.isArray(value)) return value.map((item) => clean(item) ?? null);
      return Object.fromEntries(cleanEntries(Object.entries(value)));
    } finally {
      ancestors.delete(value);
    }
  };

  const cleanEntries = (entries: [string, unknown][]): [string, unknown][] =>
    entries.flatMap(([key, value]): [string, unknown][] => {
      if (isSensitive(key)) return [[key, REDACTED]];
      const cleaned = clean(value);
      return cleaned === undefined ? [] : [[key, cleaned]];
    });

  const fields = Object.entries(entry.fields ?? {}).filter(([key]) => !RESERVED.has(key));
  // Object.fromEntries 定义字段：名为 __proto__ 的字段也只是一个普通的字段（p3-01）
  const line = Object.fromEntries<unknown>([['time', options.time], ['level', entry.level], ['message', scrub(entry.message)], ...cleanEntries(fields)]);
  return JSON.stringify(line);
}
```
:::

:::variant{kind=wrong name=short-first fails=tests reason="先替换短的密钥：一个密钥包含另一个时，长的那个只被替换了一半"}
```ts file=log.ts
export type Level = 'debug' | 'info' | 'warn' | 'error';

export type LogEntry = Readonly<{ level: Level; message: string; fields?: Readonly<Record<string, unknown>> }>;

export type LogOptions = Readonly<{
  /** 记录的时间，ISO 格式 */
  time: string;
  /** 不能出现在日志中的值，例如数据库的密码、API 密钥 */
  secrets: readonly string[];
}>;

const REDACTED = '[REDACTED]';
const SENSITIVE = ['password', 'secret', 'token', 'authorization', 'cookie', 'apikey', 'api_key'];
const RESERVED = new Set(['time', 'level', 'message']);
const MAX_LENGTH = 500;

const isSensitive = (key: string) => SENSITIVE.some((word) => key.toLowerCase().includes(word));

/** 把一条日志变成一行 JSON：去掉密钥，截断太长的字符串，不会抛出错误 */
export function formatLog(entry: LogEntry, options: LogOptions): string {
  // 先替换长的：一个密钥包含另一个时，不会只替换掉一半
  const hidden = options.secrets.filter((secret) => secret.length >= 8).toSorted((a, b) => a.length - b.length);

  const scrub = (text: string): string => {
    let result = text;
    for (const secret of hidden) result = result.replaceAll(secret, REDACTED);
    // 先替换密钥再截断：截断的地方正好落在密钥中间时，也不会漏出一半
    const chars = [...result];
    return chars.length > MAX_LENGTH ? `${chars.slice(0, MAX_LENGTH).join('')}…（共 ${chars.length} 个字符）` : result;
  };

  // 正在处理的对象（从根到当前的路径上的）：再遇到它就是循环引用
  const ancestors = new Set<object>();

  const clean = (value: unknown): unknown => {
    if (typeof value === 'string') return scrub(value);
    if (typeof value === 'bigint') return value.toString();
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value !== 'object') return undefined; // undefined、函数、symbol：和 JSON.stringify 一样去掉
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
    if (ancestors.has(value)) return '[Circular]';
    ancestors.add(value);
    try {
      if (value instanceof Error) {
        const error: [string, unknown][] = [
          ['name', scrub(value.name)],
          ['message', scrub(value.message)],
        ];
        if (value.cause !== undefined) error.push(['cause', clean(value.cause)]);
        return Object.fromEntries(error);
      }
      if (Array.isArray(value)) return value.map((item) => clean(item) ?? null);
      return Object.fromEntries(cleanEntries(Object.entries(value)));
    } finally {
      ancestors.delete(value);
    }
  };

  const cleanEntries = (entries: [string, unknown][]): [string, unknown][] =>
    entries.flatMap(([key, value]): [string, unknown][] => {
      if (isSensitive(key)) return [[key, REDACTED]];
      const cleaned = clean(value);
      return cleaned === undefined ? [] : [[key, cleaned]];
    });

  const fields = Object.entries(entry.fields ?? {}).filter(([key]) => !RESERVED.has(key));
  // Object.fromEntries 定义字段：名为 __proto__ 的字段也只是一个普通的字段（p3-01）
  const line = Object.fromEntries<unknown>([['time', options.time], ['level', entry.level], ['message', scrub(entry.message)], ...cleanEntries(fields)]);
  return JSON.stringify(line);
}
```
:::

:::variant{kind=wrong name=truncate-first fails=tests reason="先截断再替换：截断的地方落在密钥中间时，前半个密钥留在了日志中"}
```ts file=log.ts
export type Level = 'debug' | 'info' | 'warn' | 'error';

export type LogEntry = Readonly<{ level: Level; message: string; fields?: Readonly<Record<string, unknown>> }>;

export type LogOptions = Readonly<{
  /** 记录的时间，ISO 格式 */
  time: string;
  /** 不能出现在日志中的值，例如数据库的密码、API 密钥 */
  secrets: readonly string[];
}>;

const REDACTED = '[REDACTED]';
const SENSITIVE = ['password', 'secret', 'token', 'authorization', 'cookie', 'apikey', 'api_key'];
const RESERVED = new Set(['time', 'level', 'message']);
const MAX_LENGTH = 500;

const isSensitive = (key: string) => SENSITIVE.some((word) => key.toLowerCase().includes(word));

/** 把一条日志变成一行 JSON：去掉密钥，截断太长的字符串，不会抛出错误 */
export function formatLog(entry: LogEntry, options: LogOptions): string {
  // 先替换长的：一个密钥包含另一个时，不会只替换掉一半
  const hidden = options.secrets.filter((secret) => secret.length >= 8).toSorted((a, b) => b.length - a.length);

  const scrub = (text: string): string => {
    const chars = [...text];
    let result = chars.length > MAX_LENGTH ? `${chars.slice(0, MAX_LENGTH).join('')}…（共 ${chars.length} 个字符）` : text;
    for (const secret of hidden) result = result.replaceAll(secret, REDACTED);
    return result;
  };

  // 正在处理的对象（从根到当前的路径上的）：再遇到它就是循环引用
  const ancestors = new Set<object>();

  const clean = (value: unknown): unknown => {
    if (typeof value === 'string') return scrub(value);
    if (typeof value === 'bigint') return value.toString();
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value !== 'object') return undefined; // undefined、函数、symbol：和 JSON.stringify 一样去掉
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
    if (ancestors.has(value)) return '[Circular]';
    ancestors.add(value);
    try {
      if (value instanceof Error) {
        const error: [string, unknown][] = [
          ['name', scrub(value.name)],
          ['message', scrub(value.message)],
        ];
        if (value.cause !== undefined) error.push(['cause', clean(value.cause)]);
        return Object.fromEntries(error);
      }
      if (Array.isArray(value)) return value.map((item) => clean(item) ?? null);
      return Object.fromEntries(cleanEntries(Object.entries(value)));
    } finally {
      ancestors.delete(value);
    }
  };

  const cleanEntries = (entries: [string, unknown][]): [string, unknown][] =>
    entries.flatMap(([key, value]): [string, unknown][] => {
      if (isSensitive(key)) return [[key, REDACTED]];
      const cleaned = clean(value);
      return cleaned === undefined ? [] : [[key, cleaned]];
    });

  const fields = Object.entries(entry.fields ?? {}).filter(([key]) => !RESERVED.has(key));
  // Object.fromEntries 定义字段：名为 __proto__ 的字段也只是一个普通的字段（p3-01）
  const line = Object.fromEntries<unknown>([['time', options.time], ['level', entry.level], ['message', scrub(entry.message)], ...cleanEntries(fields)]);
  return JSON.stringify(line);
}
```
:::

:::variant{kind=wrong name=no-cycle-check fails=tests reason="没有处理循环引用：一个指向自己的对象让写日志本身抛出了错误"}
```ts file=log.ts
export type Level = 'debug' | 'info' | 'warn' | 'error';

export type LogEntry = Readonly<{ level: Level; message: string; fields?: Readonly<Record<string, unknown>> }>;

export type LogOptions = Readonly<{
  /** 记录的时间，ISO 格式 */
  time: string;
  /** 不能出现在日志中的值，例如数据库的密码、API 密钥 */
  secrets: readonly string[];
}>;

const REDACTED = '[REDACTED]';
const SENSITIVE = ['password', 'secret', 'token', 'authorization', 'cookie', 'apikey', 'api_key'];
const RESERVED = new Set(['time', 'level', 'message']);
const MAX_LENGTH = 500;

const isSensitive = (key: string) => SENSITIVE.some((word) => key.toLowerCase().includes(word));

/** 把一条日志变成一行 JSON：去掉密钥，截断太长的字符串，不会抛出错误 */
export function formatLog(entry: LogEntry, options: LogOptions): string {
  // 先替换长的：一个密钥包含另一个时，不会只替换掉一半
  const hidden = options.secrets.filter((secret) => secret.length >= 8).toSorted((a, b) => b.length - a.length);

  const scrub = (text: string): string => {
    let result = text;
    for (const secret of hidden) result = result.replaceAll(secret, REDACTED);
    // 先替换密钥再截断：截断的地方正好落在密钥中间时，也不会漏出一半
    const chars = [...result];
    return chars.length > MAX_LENGTH ? `${chars.slice(0, MAX_LENGTH).join('')}…（共 ${chars.length} 个字符）` : result;
  };

  // 正在处理的对象（从根到当前的路径上的）：再遇到它就是循环引用
  const ancestors = new Set<object>();

  const clean = (value: unknown): unknown => {
    if (typeof value === 'string') return scrub(value);
    if (typeof value === 'bigint') return value.toString();
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value !== 'object') return undefined; // undefined、函数、symbol：和 JSON.stringify 一样去掉
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
    ancestors.add(value);
    try {
      if (value instanceof Error) {
        const error: [string, unknown][] = [
          ['name', scrub(value.name)],
          ['message', scrub(value.message)],
        ];
        if (value.cause !== undefined) error.push(['cause', clean(value.cause)]);
        return Object.fromEntries(error);
      }
      if (Array.isArray(value)) return value.map((item) => clean(item) ?? null);
      return Object.fromEntries(cleanEntries(Object.entries(value)));
    } finally {
      ancestors.delete(value);
    }
  };

  const cleanEntries = (entries: [string, unknown][]): [string, unknown][] =>
    entries.flatMap(([key, value]): [string, unknown][] => {
      if (isSensitive(key)) return [[key, REDACTED]];
      const cleaned = clean(value);
      return cleaned === undefined ? [] : [[key, cleaned]];
    });

  const fields = Object.entries(entry.fields ?? {}).filter(([key]) => !RESERVED.has(key));
  // Object.fromEntries 定义字段：名为 __proto__ 的字段也只是一个普通的字段（p3-01）
  const line = Object.fromEntries<unknown>([['time', options.time], ['level', entry.level], ['message', scrub(entry.message)], ...cleanEntries(fields)]);
  return JSON.stringify(line);
}
```
:::

:::variant{kind=wrong name=seen-not-path fails=tests reason="把出现过的对象都当成了循环：同一个对象出现两次时，第二次被写成了 [Circular]"}
```ts file=log.ts
export type Level = 'debug' | 'info' | 'warn' | 'error';

export type LogEntry = Readonly<{ level: Level; message: string; fields?: Readonly<Record<string, unknown>> }>;

export type LogOptions = Readonly<{
  /** 记录的时间，ISO 格式 */
  time: string;
  /** 不能出现在日志中的值，例如数据库的密码、API 密钥 */
  secrets: readonly string[];
}>;

const REDACTED = '[REDACTED]';
const SENSITIVE = ['password', 'secret', 'token', 'authorization', 'cookie', 'apikey', 'api_key'];
const RESERVED = new Set(['time', 'level', 'message']);
const MAX_LENGTH = 500;

const isSensitive = (key: string) => SENSITIVE.some((word) => key.toLowerCase().includes(word));

/** 把一条日志变成一行 JSON：去掉密钥，截断太长的字符串，不会抛出错误 */
export function formatLog(entry: LogEntry, options: LogOptions): string {
  // 先替换长的：一个密钥包含另一个时，不会只替换掉一半
  const hidden = options.secrets.filter((secret) => secret.length >= 8).toSorted((a, b) => b.length - a.length);

  const scrub = (text: string): string => {
    let result = text;
    for (const secret of hidden) result = result.replaceAll(secret, REDACTED);
    // 先替换密钥再截断：截断的地方正好落在密钥中间时，也不会漏出一半
    const chars = [...result];
    return chars.length > MAX_LENGTH ? `${chars.slice(0, MAX_LENGTH).join('')}…（共 ${chars.length} 个字符）` : result;
  };

  // 正在处理的对象（从根到当前的路径上的）：再遇到它就是循环引用
  const ancestors = new Set<object>();

  const clean = (value: unknown): unknown => {
    if (typeof value === 'string') return scrub(value);
    if (typeof value === 'bigint') return value.toString();
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value !== 'object') return undefined; // undefined、函数、symbol：和 JSON.stringify 一样去掉
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
    if (ancestors.has(value)) return '[Circular]';
    ancestors.add(value);
    try {
      if (value instanceof Error) {
        const error: [string, unknown][] = [
          ['name', scrub(value.name)],
          ['message', scrub(value.message)],
        ];
        if (value.cause !== undefined) error.push(['cause', clean(value.cause)]);
        return Object.fromEntries(error);
      }
      if (Array.isArray(value)) return value.map((item) => clean(item) ?? null);
      return Object.fromEntries(cleanEntries(Object.entries(value)));
    } finally {
    }
  };

  const cleanEntries = (entries: [string, unknown][]): [string, unknown][] =>
    entries.flatMap(([key, value]): [string, unknown][] => {
      if (isSensitive(key)) return [[key, REDACTED]];
      const cleaned = clean(value);
      return cleaned === undefined ? [] : [[key, cleaned]];
    });

  const fields = Object.entries(entry.fields ?? {}).filter(([key]) => !RESERVED.has(key));
  // Object.fromEntries 定义字段：名为 __proto__ 的字段也只是一个普通的字段（p3-01）
  const line = Object.fromEntries<unknown>([['time', options.time], ['level', entry.level], ['message', scrub(entry.message)], ...cleanEntries(fields)]);
  return JSON.stringify(line);
}
```
:::

:::variant{kind=wrong name=fields-override fails=tests reason="fields 可以覆盖 time、level、message：一条错误的日志可以被写成 info"}
```ts file=log.ts
export type Level = 'debug' | 'info' | 'warn' | 'error';

export type LogEntry = Readonly<{ level: Level; message: string; fields?: Readonly<Record<string, unknown>> }>;

export type LogOptions = Readonly<{
  /** 记录的时间，ISO 格式 */
  time: string;
  /** 不能出现在日志中的值，例如数据库的密码、API 密钥 */
  secrets: readonly string[];
}>;

const REDACTED = '[REDACTED]';
const SENSITIVE = ['password', 'secret', 'token', 'authorization', 'cookie', 'apikey', 'api_key'];
const RESERVED = new Set(['time', 'level', 'message']);
const MAX_LENGTH = 500;

const isSensitive = (key: string) => SENSITIVE.some((word) => key.toLowerCase().includes(word));

/** 把一条日志变成一行 JSON：去掉密钥，截断太长的字符串，不会抛出错误 */
export function formatLog(entry: LogEntry, options: LogOptions): string {
  // 先替换长的：一个密钥包含另一个时，不会只替换掉一半
  const hidden = options.secrets.filter((secret) => secret.length >= 8).toSorted((a, b) => b.length - a.length);

  const scrub = (text: string): string => {
    let result = text;
    for (const secret of hidden) result = result.replaceAll(secret, REDACTED);
    // 先替换密钥再截断：截断的地方正好落在密钥中间时，也不会漏出一半
    const chars = [...result];
    return chars.length > MAX_LENGTH ? `${chars.slice(0, MAX_LENGTH).join('')}…（共 ${chars.length} 个字符）` : result;
  };

  // 正在处理的对象（从根到当前的路径上的）：再遇到它就是循环引用
  const ancestors = new Set<object>();

  const clean = (value: unknown): unknown => {
    if (typeof value === 'string') return scrub(value);
    if (typeof value === 'bigint') return value.toString();
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value !== 'object') return undefined; // undefined、函数、symbol：和 JSON.stringify 一样去掉
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
    if (ancestors.has(value)) return '[Circular]';
    ancestors.add(value);
    try {
      if (value instanceof Error) {
        const error: [string, unknown][] = [
          ['name', scrub(value.name)],
          ['message', scrub(value.message)],
        ];
        if (value.cause !== undefined) error.push(['cause', clean(value.cause)]);
        return Object.fromEntries(error);
      }
      if (Array.isArray(value)) return value.map((item) => clean(item) ?? null);
      return Object.fromEntries(cleanEntries(Object.entries(value)));
    } finally {
      ancestors.delete(value);
    }
  };

  const cleanEntries = (entries: [string, unknown][]): [string, unknown][] =>
    entries.flatMap(([key, value]): [string, unknown][] => {
      if (isSensitive(key)) return [[key, REDACTED]];
      const cleaned = clean(value);
      return cleaned === undefined ? [] : [[key, cleaned]];
    });

  const fields = Object.entries(entry.fields ?? {});
  // Object.fromEntries 定义字段：名为 __proto__ 的字段也只是一个普通的字段（p3-01）
  const line = Object.fromEntries<unknown>([['time', options.time], ['level', entry.level], ['message', scrub(entry.message)], ...cleanEntries(fields)]);
  return JSON.stringify(line);
}
```
:::

:::variant{kind=wrong name=assign-line fails=tests reason="用赋值组成这一行：名为 __proto__ 的字段丢了（p3-01）"}
```ts file=log.ts
export type Level = 'debug' | 'info' | 'warn' | 'error';

export type LogEntry = Readonly<{ level: Level; message: string; fields?: Readonly<Record<string, unknown>> }>;

export type LogOptions = Readonly<{
  /** 记录的时间，ISO 格式 */
  time: string;
  /** 不能出现在日志中的值，例如数据库的密码、API 密钥 */
  secrets: readonly string[];
}>;

const REDACTED = '[REDACTED]';
const SENSITIVE = ['password', 'secret', 'token', 'authorization', 'cookie', 'apikey', 'api_key'];
const RESERVED = new Set(['time', 'level', 'message']);
const MAX_LENGTH = 500;

const isSensitive = (key: string) => SENSITIVE.some((word) => key.toLowerCase().includes(word));

/** 把一条日志变成一行 JSON：去掉密钥，截断太长的字符串，不会抛出错误 */
export function formatLog(entry: LogEntry, options: LogOptions): string {
  // 先替换长的：一个密钥包含另一个时，不会只替换掉一半
  const hidden = options.secrets.filter((secret) => secret.length >= 8).toSorted((a, b) => b.length - a.length);

  const scrub = (text: string): string => {
    let result = text;
    for (const secret of hidden) result = result.replaceAll(secret, REDACTED);
    // 先替换密钥再截断：截断的地方正好落在密钥中间时，也不会漏出一半
    const chars = [...result];
    return chars.length > MAX_LENGTH ? `${chars.slice(0, MAX_LENGTH).join('')}…（共 ${chars.length} 个字符）` : result;
  };

  // 正在处理的对象（从根到当前的路径上的）：再遇到它就是循环引用
  const ancestors = new Set<object>();

  const clean = (value: unknown): unknown => {
    if (typeof value === 'string') return scrub(value);
    if (typeof value === 'bigint') return value.toString();
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value !== 'object') return undefined; // undefined、函数、symbol：和 JSON.stringify 一样去掉
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
    if (ancestors.has(value)) return '[Circular]';
    ancestors.add(value);
    try {
      if (value instanceof Error) {
        const error: [string, unknown][] = [
          ['name', scrub(value.name)],
          ['message', scrub(value.message)],
        ];
        if (value.cause !== undefined) error.push(['cause', clean(value.cause)]);
        return Object.fromEntries(error);
      }
      if (Array.isArray(value)) return value.map((item) => clean(item) ?? null);
      return Object.fromEntries(cleanEntries(Object.entries(value)));
    } finally {
      ancestors.delete(value);
    }
  };

  const cleanEntries = (entries: [string, unknown][]): [string, unknown][] =>
    entries.flatMap(([key, value]): [string, unknown][] => {
      if (isSensitive(key)) return [[key, REDACTED]];
      const cleaned = clean(value);
      return cleaned === undefined ? [] : [[key, cleaned]];
    });

  const fields = Object.entries(entry.fields ?? {}).filter(([key]) => !RESERVED.has(key));
  // Object.fromEntries 定义字段：名为 __proto__ 的字段也只是一个普通的字段（p3-01）
  const line: Record<string, unknown> = { time: options.time, level: entry.level, message: scrub(entry.message) };
  for (const [key, value] of cleanEntries(fields)) line[key] = value;
  return JSON.stringify(line);
}
```
:::

