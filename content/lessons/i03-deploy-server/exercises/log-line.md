---
kind: challenge
title: 一行日志
---
在 `log.ts` 中实现 `formatLog(entry, options)`：把一条日志变成**一行** JSON 字符串，h06 的包装函数中的 `deps.log` 就可以用它写日志。它会被用在出错的时候，所以无论传进来什么都不能抛出错误。

1. 字段的顺序：`time`（`options.time`）、`level`、`message`，然后是 `entry.fields` 中的字段（按原来的顺序）。`fields` 中名为 `time`、`level`、`message` 的字段忽略；名为 `__proto__` 的字段也要照样写出来（在任何深度）；
2. **按名字隐藏**：名字变成小写、去掉 `-` 和 `_` 之后含有 `password`、`secret`、`token`、`authorization`、`cookie`、`apikey`、`session` 的字段，不管值是什么，都换成字符串 `[REDACTED]`。在任何深度都是：嵌套的对象中、数组中的对象中；
3. **按值隐藏**：`options.secrets` 中至少有 8 个字符的每一个值，出现在任何字符串中（包括 `message`、错误的 `name` 和 `message`、字段的**名字**）都换成 `[REDACTED]`。长的先替换；
4. **截断**：替换之后，超过 500 个字符（按码点）的字符串只保留前 500 个，后面加上 `…（共 N 个字符）`，N 是替换之后、截断之前的码点数；
5. **大小**：数组只保留前 50 项，多出来时最后加上一项 `…（共 N 项）`；对象只保留前 50 个字段，多出来时最后加上字段 `…`，值是 `（共 N 个字段）`；嵌套超过 20 层的值换成 `[Too deep]`；
6. 其他的值：
   - 错误（`instanceof Error`）：只有 `name`、`message`（都转换成字符串），`cause` 不是 `undefined` 时再加上处理过的 `cause`；
   - `Date`：`toISOString()` 的结果，无效的日期是 `'Invalid Date'`；`bigint`：十进制的字符串；其他有 `toJSON` 方法的对象（例如 `URL`）：处理它的返回值；
   - `undefined`、函数、`symbol`：对象中的去掉，数组中的变成 `null`（和 `JSON.stringify` 一样）；
   - 循环引用（一个对象出现在它自己的里面）：`'[Circular]'`。同一个对象在不同的地方出现两次不算循环；
   - 读取时抛出错误的对象（例如会抛出错误的 getter、被撤销的 `Proxy`）：`'[Unreadable]'`，其他的字段照常写出。

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

/** 把一条日志变成一行 JSON：去掉密钥，限制大小；不管传进来什么都不抛出错误 */
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
    fields: { requestId: 'req-000042', headers: { authorization: 'Bearer abc', 'x-api-key': 'k1', accept: 'application/json' }, error },
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
/** 字段的名字去掉 - 和 _、变成小写之后，含有这些词就隐藏 */
const SENSITIVE = ['password', 'secret', 'token', 'authorization', 'cookie', 'apikey', 'session'];
const RESERVED = new Set(['time', 'level', 'message']);
const MAX_LENGTH = 500;
const MAX_ENTRIES = 50;
const MAX_DEPTH = 20;

const isSensitive = (key: string) => {
  const normalized = key.toLowerCase().replaceAll('-', '').replaceAll('_', '');
  return SENSITIVE.some((word) => normalized.includes(word));
};

/** 把一条日志变成一行 JSON：去掉密钥，限制大小；不管传进来什么都不抛出错误 */
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

  const clean = (value: unknown, depth: number): unknown => {
    if (typeof value === 'string') return scrub(value);
    if (typeof value === 'bigint') return value.toString();
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value !== 'object') return undefined; // undefined、函数、symbol：和 JSON.stringify 一样去掉
    if (depth > MAX_DEPTH) return '[Too deep]';
    if (ancestors.has(value)) return '[Circular]';
    ancestors.add(value);
    try {
      return cleanObject(value, depth);
    } catch {
      // 读取属性时抛出错误的对象（getter、Proxy 等）
      return '[Unreadable]';
    } finally {
      ancestors.delete(value);
    }
  };

  const cleanObject = (value: object, depth: number): unknown => {
    if (value instanceof Error) {
      const error: [string, unknown][] = [
        ['name', scrub(String(value.name))],
        ['message', scrub(String(value.message))],
      ];
      if (value.cause !== undefined) error.push(['cause', clean(value.cause, depth + 1)]);
      return Object.fromEntries(error);
    }
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
    // 有 toJSON 的对象（例如 URL）：和 JSON.stringify 一样用它的结果
    const toJSON: unknown = Reflect.get(value, 'toJSON');
    if (typeof toJSON === 'function') return clean(Reflect.apply(toJSON, value, []), depth + 1);
    if (Array.isArray(value)) {
      const items: unknown[] = value.slice(0, MAX_ENTRIES).map((item) => clean(item, depth + 1) ?? null);
      if (value.length > MAX_ENTRIES) items.push(`…（共 ${value.length} 项）`);
      return items;
    }
    const entries = Object.entries(value);
    const cleaned = cleanEntries(entries.slice(0, MAX_ENTRIES), depth + 1);
    if (entries.length > MAX_ENTRIES) cleaned.push(['…', `（共 ${entries.length} 个字段）`]);
    return Object.fromEntries(cleaned);
  };

  const cleanEntries = (entries: [string, unknown][], depth: number): [string, unknown][] =>
    entries.flatMap(([key, value]): [string, unknown][] => {
      // 字段的名字也可能含有密钥
      if (isSensitive(key)) return [[scrub(key), REDACTED]];
      const cleaned = clean(value, depth);
      return cleaned === undefined ? [] : [[scrub(key), cleaned]];
    });

  try {
    const fields = Object.entries(entry.fields ?? {}).filter(([key]) => !RESERVED.has(key));
    // Object.fromEntries 定义字段：名为 __proto__ 的字段也只是一个普通的字段（p3-01）
    const line = Object.fromEntries<unknown>([['time', options.time], ['level', entry.level], ['message', scrub(String(entry.message))], ...cleanEntries(fields, 0)]);
    return JSON.stringify(line);
  } catch {
    // 最后的退路：字段本身都读不出来时，至少留下这一行
    return JSON.stringify({ time: options.time, level: entry.level, message: scrub(String(entry.message)), fields: '[Unreadable]' });
  }
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
    fields: { requestId: 'req-000042', headers: { authorization: 'Bearer abc', 'x-api-key': 'k1', accept: 'application/json' }, error },
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

  test('字段名是 __proto__ 时也照样写出来，嵌套的也一样', () => {
    const fields: Record<string, unknown> = JSON.parse('{"__proto__":{"isAdmin":true},"inner":{"__proto__":1}}');
    expect(line({ level: 'info', message: 'm', fields })).toBe('{"time":"2026-10-21T10:00:00.000Z","level":"info","message":"m","__proto__":{"isAdmin":true},"inner":{"__proto__":1}}');
  });
});

describe('formatLog：更多的输入', () => {
  test('互相引用、数组包含自己：[Circular]；同一个错误出现两次不算循环', () => {
    const a: Record<string, unknown> = { name: 'a' };
    const b: Record<string, unknown> = { name: 'b', a };
    a['b'] = b;
    const list: unknown[] = [1];
    list.push(list);
    const error = new Error('e');
    expect(parse({ level: 'info', message: 'm', fields: { a, list, twice: [error, error] } })).toMatchObject({
      a: { name: 'a', b: { name: 'b', a: '[Circular]' } },
      list: [1, '[Circular]'],
      twice: [{ name: 'Error', message: 'e' }, { name: 'Error', message: 'e' }],
    });
  });

  test('截断按码点：600 个 🚀 留下 500 个，注明共 600 个字符', () => {
    expect(parse({ level: 'info', message: '🚀'.repeat(600) })).toMatchObject({ message: `${'🚀'.repeat(500)}…（共 600 个字符）` });
  });

  test('正好 8 个字符的密钥要替换，7 个的不替换', () => {
    expect(parse({ level: 'info', message: 'a1234567 b1234567x' }, ['a1234567', 'b123456'])).toMatchObject({ message: '[REDACTED] b1234567x' });
  });

  test('错误的 name、字段的名字中的密钥也要替换', () => {
    const error = new Error('boom');
    error.name = `DbError(${SECRET})`;
    const text = line({ level: 'error', message: 'm', fields: { error, [`url:${SECRET}`]: 1 } });
    expect(text.includes('s3cr3t-pass')).toBe(false);
  });

  test('symbol：对象中的去掉，数组中的变成 null；cause 是 0 也要写出来', () => {
    expect(parse({ level: 'info', message: 'm', fields: { s: Symbol('x'), list: [Symbol('y')], error: new Error('e', { cause: 0 }) } })).toStrictEqual({
      time: TIME,
      level: 'info',
      message: 'm',
      list: [null],
      error: { name: 'Error', message: 'e', cause: 0 },
    });
  });

  test('更多名字像密钥的字段：x-api-key、sessionId', () => {
    expect(parse({ level: 'info', message: 'm', fields: { headers: { 'x-api-key': 'k', accept: '*/*' }, sessionId: 's1' } })).toMatchObject({
      headers: { 'x-api-key': '[REDACTED]', accept: '*/*' },
      sessionId: '[REDACTED]',
    });
  });

  test('读取时抛出错误的对象：[Unreadable]，不影响其他的字段', () => {
    const broken = {
      get value(): unknown {
        throw new Error('getter failed');
      },
    };
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    expect(parse({ level: 'info', message: 'm', fields: { broken, proxy, ok: 1 } })).toStrictEqual({ time: TIME, level: 'info', message: 'm', broken: '[Unreadable]', proxy: '[Unreadable]', ok: 1 });
  });

  test('嵌套得很深：不抛出错误，深处换成 [Too deep]', () => {
    let deep: unknown = 'leaf';
    for (let i = 0; i < 10_000; i++) deep = { next: deep };
    const text = line({ level: 'info', message: 'm', fields: { deep } });
    expect(text.includes('[Too deep]')).toBe(true);
    expect(text.includes('leaf')).toBe(false);
  });

  test('有 toJSON 的对象用它的结果：URL 是地址的字符串', () => {
    class Masked {
      toJSON() {
        return '***';
      }
    }
    expect(parse({ level: 'info', message: 'm', fields: { url: new URL('https://example.com/a?b=1'), key: new Masked() } })).toMatchObject({
      url: 'https://example.com/a?b=1',
      key: '***',
    });
  });

  test('很大的数组和对象：只留前 50 项，注明一共有多少', () => {
    const big = Array.from({ length: 200 }, (_, i) => i);
    const wide = Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`k${i}`, i]));
    const result = parse({ level: 'info', message: 'm', fields: { big, wide, bytes: new Uint8Array(2000) } });
    expect(result).toMatchObject({ big: [...big.slice(0, 50), '…（共 200 项）'] });
    expect(Object.keys(Reflect.get(Object(result), 'wide'))).toHaveLength(51);
    expect(Reflect.get(Reflect.get(Object(result), 'wide'), '…')).toBe('（共 80 个字段）');
    expect(Object.keys(Reflect.get(Object(result), 'bytes'))).toHaveLength(51);
  });
});
```
:::

:::hint{level=1}
写一个递归的函数 `clean(value: unknown, depth: number): unknown`，按 `typeof` 和 `instanceof` 分情况处理，返回可以交给 `JSON.stringify` 的值；对象和字段的列表都用 `Object.fromEntries` 组成（p3-01：键来自外部时，不要用赋值）。字符串的处理（替换密钥、截断）写成另一个函数 `scrub`，字段的名字也交给它。
:::

:::hint{level=2}
循环引用：用一个 `Set` 记下“从根到当前”路径上的对象，进入一个对象之前放进去，处理完之后（`finally`）拿出来；当前的对象已经在路径上，就是循环。处理一个对象的代码整个放在 `try` 中，`catch` 时返回 `'[Unreadable]'`。按码点截断：`[...text]` 得到码点的数组。最外层再包一个 `try`，万一还是出错，至少写出 `time`、`level`、`message`。
:::

:::explanation
日志是给人和工具读的，而且读的人比你想的多：同事、运维、日志平台、几个月之后的你。所以写进去之前要处理三件事：

- **密钥**：按名字隐藏挡住了 `password: '…'` 这样的字段，按值隐藏挡住了藏在错误信息中的连接字符串（正文中实测 Next.js 把它原样打印了出来）。两种都需要：错误的信息没有字段名，而一个叫 `password` 的字段的值，你事先并不知道。按值隐藏也有它的局限：少于 8 个字符的值不替换；两个密钥互相重叠时，可能漏出一部分；经过编码的密钥（例如网址中的）匹配不到。所以最好的办法还是不把密钥放进会被记录的东西里；
- **大小**：一个巨大的请求体、一个几万项的数组可以让一行日志有几十万个字符，Vercel 每行最多 256 KB，日志平台也按量收费；
- **形状**：错误对象直接交给 `JSON.stringify` 得到 `{}`（正文的示例），循环引用、`bigint` 会让它抛出错误（p3-01），一个抛出错误的 getter 也会。写日志本身抛出错误时，原来的错误就没人知道了。

替换和截断的顺序很重要：先截断的话，截断的位置可能正好落在一个密钥的中间，前半个密钥就留了下来。

这里没有记录调用栈（`stack`）。它对调试很有用，但很长；而且构建之后的代码中，文件和行号已经变了样（正文中实测是 `…\server\chunks\_0vj2gv73mjph5._.js:1:113`），要配合 source map 才有意义。需要的话，通常交给专门的错误追踪服务。

替代解把这一次格式化的状态（要隐藏的值、路径上的对象）放在一个类中，用 `switch (typeof value)` 分派，路径用一个数组，深度就是路径的长度。
:::

:::variant{kind=alt name=cleaner-class}
```ts file=log.ts
export type Level = 'debug' | 'info' | 'warn' | 'error';

export type LogEntry = Readonly<{ level: Level; message: string; fields?: Readonly<Record<string, unknown>> }>;

export type LogOptions = Readonly<{ time: string; secrets: readonly string[] }>;

const SENSITIVE = /password|secret|token|authorization|cookie|apikey|session/;

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
        return value === null ? null : this.guarded(value);
      default:
        return undefined;
    }
  }

  /** 循环、深度和读取时的错误都在这里处理 */
  guarded(value: object): unknown {
    if (this.path.length >= 21) return '[Too deep]';
    if (this.path.includes(value)) return '[Circular]';
    this.path.push(value);
    try {
      return this.object(value);
    } catch {
      return '[Unreadable]';
    } finally {
      this.path.pop();
    }
  }

  object(value: object): unknown {
    if (value instanceof Error) {
      const pairs: [string, unknown][] = [['name', this.text(`${value.name}`)], ['message', this.text(`${value.message}`)]];
      if ('cause' in value && value.cause !== undefined) pairs.push(['cause', this.value(value.cause)]);
      return Object.fromEntries(pairs);
    }
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : 'Invalid Date';
    if ('toJSON' in value && typeof value.toJSON === 'function') return this.value(value.toJSON());
    if (Array.isArray(value)) {
      const out: unknown[] = [];
      for (const item of value.slice(0, 50)) {
        const cleaned = this.value(item);
        out.push(cleaned === undefined ? null : cleaned);
      }
      return value.length > 50 ? [...out, `…（共 ${value.length} 项）`] : out;
    }
    const entries = Object.entries(value);
    const pairs = this.pairs(entries.slice(0, 50));
    return Object.fromEntries(entries.length > 50 ? [...pairs, ['…', `（共 ${entries.length} 个字段）`]] : pairs);
  }

  pairs(entries: [string, unknown][]): [string, unknown][] {
    const out: [string, unknown][] = [];
    for (const [key, item] of entries) {
      if (SENSITIVE.test(key.toLowerCase().replace(/[-_]/g, ''))) {
        out.push([this.text(key), '[REDACTED]']);
        continue;
      }
      const cleaned = this.value(item);
      if (cleaned !== undefined) out.push([this.text(key), cleaned]);
    }
    return out;
  }
}

export function formatLog(entry: LogEntry, options: LogOptions): string {
  const cleaner = new Cleaner(options.secrets);
  const head: [string, unknown][] = [['time', options.time], ['level', entry.level], ['message', cleaner.text(`${entry.message}`)]];
  try {
    const fields = Object.entries(entry.fields ?? {}).filter(([key]) => key !== 'time' && key !== 'level' && key !== 'message');
    return JSON.stringify(Object.fromEntries(head.concat(cleaner.pairs(fields))));
  } catch {
    return JSON.stringify(Object.fromEntries([...head, ['fields', '[Unreadable]']]));
  }
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
/** 字段的名字去掉 - 和 _、变成小写之后，含有这些词就隐藏 */
const SENSITIVE = ['password', 'secret', 'token', 'authorization', 'cookie', 'apikey', 'session'];
const RESERVED = new Set(['time', 'level', 'message']);
const MAX_LENGTH = 500;
const MAX_ENTRIES = 50;
const MAX_DEPTH = 20;

const isSensitive = (key: string) => {
  const normalized = key.toLowerCase().replaceAll('-', '').replaceAll('_', '');
  return SENSITIVE.some((word) => normalized.includes(word));
};

/** 把一条日志变成一行 JSON：去掉密钥，限制大小；不管传进来什么都不抛出错误 */
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

  const clean = (value: unknown, depth: number): unknown => {
    if (typeof value === 'string') return scrub(value);
    if (typeof value === 'bigint') return value.toString();
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value !== 'object') return undefined; // undefined、函数、symbol：和 JSON.stringify 一样去掉
    if (depth > MAX_DEPTH) return '[Too deep]';
    if (ancestors.has(value)) return '[Circular]';
    ancestors.add(value);
    try {
      return cleanObject(value, depth);
    } catch {
      // 读取属性时抛出错误的对象（getter、Proxy 等）
      return '[Unreadable]';
    } finally {
      ancestors.delete(value);
    }
  };

  const cleanObject = (value: object, depth: number): unknown => {
    if (value instanceof Error) {
      const error: [string, unknown][] = [
        ['name', scrub(String(value.name))],
        ['message', scrub(String(value.message))],
      ];
      if (value.cause !== undefined) error.push(['cause', clean(value.cause, depth + 1)]);
      return Object.fromEntries(error);
    }
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
    // 有 toJSON 的对象（例如 URL）：和 JSON.stringify 一样用它的结果
    const toJSON: unknown = Reflect.get(value, 'toJSON');
    if (typeof toJSON === 'function') return clean(Reflect.apply(toJSON, value, []), depth + 1);
    if (Array.isArray(value)) {
      const items: unknown[] = value.slice(0, MAX_ENTRIES).map((item) => clean(item, depth + 1) ?? null);
      if (value.length > MAX_ENTRIES) items.push(`…（共 ${value.length} 项）`);
      return items;
    }
    const entries = Object.entries(value);
    const cleaned = cleanEntries(entries.slice(0, MAX_ENTRIES), depth + 1);
    if (entries.length > MAX_ENTRIES) cleaned.push(['…', `（共 ${entries.length} 个字段）`]);
    return Object.fromEntries(cleaned);
  };

  const cleanEntries = (entries: [string, unknown][], depth: number): [string, unknown][] =>
    entries.flatMap(([key, value]): [string, unknown][] => {
      // 字段的名字也可能含有密钥
      const cleaned = clean(value, depth);
      return cleaned === undefined ? [] : [[scrub(key), cleaned]];
    });

  try {
    const fields = Object.entries(entry.fields ?? {}).filter(([key]) => !RESERVED.has(key));
    // Object.fromEntries 定义字段：名为 __proto__ 的字段也只是一个普通的字段（p3-01）
    const line = Object.fromEntries<unknown>([['time', options.time], ['level', entry.level], ['message', scrub(String(entry.message))], ...cleanEntries(fields, 0)]);
    return JSON.stringify(line);
  } catch {
    // 最后的退路：字段本身都读不出来时，至少留下这一行
    return JSON.stringify({ time: options.time, level: entry.level, message: scrub(String(entry.message)), fields: '[Unreadable]' });
  }
}
```
:::

:::variant{kind=wrong name=dash-keys fails=tests reason="判断字段名时没有去掉 - 和 _：x-api-key 这样的请求头原样写进了日志"}
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
/** 字段的名字去掉 - 和 _、变成小写之后，含有这些词就隐藏 */
const SENSITIVE = ['password', 'secret', 'token', 'authorization', 'cookie', 'apikey', 'session'];
const RESERVED = new Set(['time', 'level', 'message']);
const MAX_LENGTH = 500;
const MAX_ENTRIES = 50;
const MAX_DEPTH = 20;

const isSensitive = (key: string) => {
  const normalized = key.toLowerCase();
  return SENSITIVE.some((word) => normalized.includes(word));
};

/** 把一条日志变成一行 JSON：去掉密钥，限制大小；不管传进来什么都不抛出错误 */
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

  const clean = (value: unknown, depth: number): unknown => {
    if (typeof value === 'string') return scrub(value);
    if (typeof value === 'bigint') return value.toString();
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value !== 'object') return undefined; // undefined、函数、symbol：和 JSON.stringify 一样去掉
    if (depth > MAX_DEPTH) return '[Too deep]';
    if (ancestors.has(value)) return '[Circular]';
    ancestors.add(value);
    try {
      return cleanObject(value, depth);
    } catch {
      // 读取属性时抛出错误的对象（getter、Proxy 等）
      return '[Unreadable]';
    } finally {
      ancestors.delete(value);
    }
  };

  const cleanObject = (value: object, depth: number): unknown => {
    if (value instanceof Error) {
      const error: [string, unknown][] = [
        ['name', scrub(String(value.name))],
        ['message', scrub(String(value.message))],
      ];
      if (value.cause !== undefined) error.push(['cause', clean(value.cause, depth + 1)]);
      return Object.fromEntries(error);
    }
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
    // 有 toJSON 的对象（例如 URL）：和 JSON.stringify 一样用它的结果
    const toJSON: unknown = Reflect.get(value, 'toJSON');
    if (typeof toJSON === 'function') return clean(Reflect.apply(toJSON, value, []), depth + 1);
    if (Array.isArray(value)) {
      const items: unknown[] = value.slice(0, MAX_ENTRIES).map((item) => clean(item, depth + 1) ?? null);
      if (value.length > MAX_ENTRIES) items.push(`…（共 ${value.length} 项）`);
      return items;
    }
    const entries = Object.entries(value);
    const cleaned = cleanEntries(entries.slice(0, MAX_ENTRIES), depth + 1);
    if (entries.length > MAX_ENTRIES) cleaned.push(['…', `（共 ${entries.length} 个字段）`]);
    return Object.fromEntries(cleaned);
  };

  const cleanEntries = (entries: [string, unknown][], depth: number): [string, unknown][] =>
    entries.flatMap(([key, value]): [string, unknown][] => {
      // 字段的名字也可能含有密钥
      if (isSensitive(key)) return [[scrub(key), REDACTED]];
      const cleaned = clean(value, depth);
      return cleaned === undefined ? [] : [[scrub(key), cleaned]];
    });

  try {
    const fields = Object.entries(entry.fields ?? {}).filter(([key]) => !RESERVED.has(key));
    // Object.fromEntries 定义字段：名为 __proto__ 的字段也只是一个普通的字段（p3-01）
    const line = Object.fromEntries<unknown>([['time', options.time], ['level', entry.level], ['message', scrub(String(entry.message))], ...cleanEntries(fields, 0)]);
    return JSON.stringify(line);
  } catch {
    // 最后的退路：字段本身都读不出来时，至少留下这一行
    return JSON.stringify({ time: options.time, level: entry.level, message: scrub(String(entry.message)), fields: '[Unreadable]' });
  }
}
```
:::

:::variant{kind=wrong name=short-secrets fails=tests reason="很短的值也当作密钥替换：日志中的普通的字也被换掉了"}
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
/** 字段的名字去掉 - 和 _、变成小写之后，含有这些词就隐藏 */
const SENSITIVE = ['password', 'secret', 'token', 'authorization', 'cookie', 'apikey', 'session'];
const RESERVED = new Set(['time', 'level', 'message']);
const MAX_LENGTH = 500;
const MAX_ENTRIES = 50;
const MAX_DEPTH = 20;

const isSensitive = (key: string) => {
  const normalized = key.toLowerCase().replaceAll('-', '').replaceAll('_', '');
  return SENSITIVE.some((word) => normalized.includes(word));
};

/** 把一条日志变成一行 JSON：去掉密钥，限制大小；不管传进来什么都不抛出错误 */
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

  const clean = (value: unknown, depth: number): unknown => {
    if (typeof value === 'string') return scrub(value);
    if (typeof value === 'bigint') return value.toString();
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value !== 'object') return undefined; // undefined、函数、symbol：和 JSON.stringify 一样去掉
    if (depth > MAX_DEPTH) return '[Too deep]';
    if (ancestors.has(value)) return '[Circular]';
    ancestors.add(value);
    try {
      return cleanObject(value, depth);
    } catch {
      // 读取属性时抛出错误的对象（getter、Proxy 等）
      return '[Unreadable]';
    } finally {
      ancestors.delete(value);
    }
  };

  const cleanObject = (value: object, depth: number): unknown => {
    if (value instanceof Error) {
      const error: [string, unknown][] = [
        ['name', scrub(String(value.name))],
        ['message', scrub(String(value.message))],
      ];
      if (value.cause !== undefined) error.push(['cause', clean(value.cause, depth + 1)]);
      return Object.fromEntries(error);
    }
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
    // 有 toJSON 的对象（例如 URL）：和 JSON.stringify 一样用它的结果
    const toJSON: unknown = Reflect.get(value, 'toJSON');
    if (typeof toJSON === 'function') return clean(Reflect.apply(toJSON, value, []), depth + 1);
    if (Array.isArray(value)) {
      const items: unknown[] = value.slice(0, MAX_ENTRIES).map((item) => clean(item, depth + 1) ?? null);
      if (value.length > MAX_ENTRIES) items.push(`…（共 ${value.length} 项）`);
      return items;
    }
    const entries = Object.entries(value);
    const cleaned = cleanEntries(entries.slice(0, MAX_ENTRIES), depth + 1);
    if (entries.length > MAX_ENTRIES) cleaned.push(['…', `（共 ${entries.length} 个字段）`]);
    return Object.fromEntries(cleaned);
  };

  const cleanEntries = (entries: [string, unknown][], depth: number): [string, unknown][] =>
    entries.flatMap(([key, value]): [string, unknown][] => {
      // 字段的名字也可能含有密钥
      if (isSensitive(key)) return [[scrub(key), REDACTED]];
      const cleaned = clean(value, depth);
      return cleaned === undefined ? [] : [[scrub(key), cleaned]];
    });

  try {
    const fields = Object.entries(entry.fields ?? {}).filter(([key]) => !RESERVED.has(key));
    // Object.fromEntries 定义字段：名为 __proto__ 的字段也只是一个普通的字段（p3-01）
    const line = Object.fromEntries<unknown>([['time', options.time], ['level', entry.level], ['message', scrub(String(entry.message))], ...cleanEntries(fields, 0)]);
    return JSON.stringify(line);
  } catch {
    // 最后的退路：字段本身都读不出来时，至少留下这一行
    return JSON.stringify({ time: options.time, level: entry.level, message: scrub(String(entry.message)), fields: '[Unreadable]' });
  }
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
/** 字段的名字去掉 - 和 _、变成小写之后，含有这些词就隐藏 */
const SENSITIVE = ['password', 'secret', 'token', 'authorization', 'cookie', 'apikey', 'session'];
const RESERVED = new Set(['time', 'level', 'message']);
const MAX_LENGTH = 500;
const MAX_ENTRIES = 50;
const MAX_DEPTH = 20;

const isSensitive = (key: string) => {
  const normalized = key.toLowerCase().replaceAll('-', '').replaceAll('_', '');
  return SENSITIVE.some((word) => normalized.includes(word));
};

/** 把一条日志变成一行 JSON：去掉密钥，限制大小；不管传进来什么都不抛出错误 */
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

  const clean = (value: unknown, depth: number): unknown => {
    if (typeof value === 'string') return scrub(value);
    if (typeof value === 'bigint') return value.toString();
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value !== 'object') return undefined; // undefined、函数、symbol：和 JSON.stringify 一样去掉
    if (depth > MAX_DEPTH) return '[Too deep]';
    if (ancestors.has(value)) return '[Circular]';
    ancestors.add(value);
    try {
      return cleanObject(value, depth);
    } catch {
      // 读取属性时抛出错误的对象（getter、Proxy 等）
      return '[Unreadable]';
    } finally {
      ancestors.delete(value);
    }
  };

  const cleanObject = (value: object, depth: number): unknown => {
    if (value instanceof Error) {
      const error: [string, unknown][] = [
        ['name', scrub(String(value.name))],
        ['message', scrub(String(value.message))],
      ];
      if (value.cause !== undefined) error.push(['cause', clean(value.cause, depth + 1)]);
      return Object.fromEntries(error);
    }
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
    // 有 toJSON 的对象（例如 URL）：和 JSON.stringify 一样用它的结果
    const toJSON: unknown = Reflect.get(value, 'toJSON');
    if (typeof toJSON === 'function') return clean(Reflect.apply(toJSON, value, []), depth + 1);
    if (Array.isArray(value)) {
      const items: unknown[] = value.slice(0, MAX_ENTRIES).map((item) => clean(item, depth + 1) ?? null);
      if (value.length > MAX_ENTRIES) items.push(`…（共 ${value.length} 项）`);
      return items;
    }
    const entries = Object.entries(value);
    const cleaned = cleanEntries(entries.slice(0, MAX_ENTRIES), depth + 1);
    if (entries.length > MAX_ENTRIES) cleaned.push(['…', `（共 ${entries.length} 个字段）`]);
    return Object.fromEntries(cleaned);
  };

  const cleanEntries = (entries: [string, unknown][], depth: number): [string, unknown][] =>
    entries.flatMap(([key, value]): [string, unknown][] => {
      // 字段的名字也可能含有密钥
      if (isSensitive(key)) return [[scrub(key), REDACTED]];
      const cleaned = clean(value, depth);
      return cleaned === undefined ? [] : [[scrub(key), cleaned]];
    });

  try {
    const fields = Object.entries(entry.fields ?? {}).filter(([key]) => !RESERVED.has(key));
    // Object.fromEntries 定义字段：名为 __proto__ 的字段也只是一个普通的字段（p3-01）
    const line = Object.fromEntries<unknown>([['time', options.time], ['level', entry.level], ['message', scrub(String(entry.message))], ...cleanEntries(fields, 0)]);
    return JSON.stringify(line);
  } catch {
    // 最后的退路：字段本身都读不出来时，至少留下这一行
    return JSON.stringify({ time: options.time, level: entry.level, message: scrub(String(entry.message)), fields: '[Unreadable]' });
  }
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
/** 字段的名字去掉 - 和 _、变成小写之后，含有这些词就隐藏 */
const SENSITIVE = ['password', 'secret', 'token', 'authorization', 'cookie', 'apikey', 'session'];
const RESERVED = new Set(['time', 'level', 'message']);
const MAX_LENGTH = 500;
const MAX_ENTRIES = 50;
const MAX_DEPTH = 20;

const isSensitive = (key: string) => {
  const normalized = key.toLowerCase().replaceAll('-', '').replaceAll('_', '');
  return SENSITIVE.some((word) => normalized.includes(word));
};

/** 把一条日志变成一行 JSON：去掉密钥，限制大小；不管传进来什么都不抛出错误 */
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

  const clean = (value: unknown, depth: number): unknown => {
    if (typeof value === 'string') return scrub(value);
    if (typeof value === 'bigint') return value.toString();
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value !== 'object') return undefined; // undefined、函数、symbol：和 JSON.stringify 一样去掉
    if (depth > MAX_DEPTH) return '[Too deep]';
    if (ancestors.has(value)) return '[Circular]';
    ancestors.add(value);
    try {
      return cleanObject(value, depth);
    } catch {
      // 读取属性时抛出错误的对象（getter、Proxy 等）
      return '[Unreadable]';
    } finally {
      ancestors.delete(value);
    }
  };

  const cleanObject = (value: object, depth: number): unknown => {
    if (value instanceof Error) {
      const error: [string, unknown][] = [
        ['name', scrub(String(value.name))],
        ['message', scrub(String(value.message))],
      ];
      if (value.cause !== undefined) error.push(['cause', clean(value.cause, depth + 1)]);
      return Object.fromEntries(error);
    }
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
    // 有 toJSON 的对象（例如 URL）：和 JSON.stringify 一样用它的结果
    const toJSON: unknown = Reflect.get(value, 'toJSON');
    if (typeof toJSON === 'function') return clean(Reflect.apply(toJSON, value, []), depth + 1);
    if (Array.isArray(value)) {
      const items: unknown[] = value.slice(0, MAX_ENTRIES).map((item) => clean(item, depth + 1) ?? null);
      if (value.length > MAX_ENTRIES) items.push(`…（共 ${value.length} 项）`);
      return items;
    }
    const entries = Object.entries(value);
    const cleaned = cleanEntries(entries.slice(0, MAX_ENTRIES), depth + 1);
    if (entries.length > MAX_ENTRIES) cleaned.push(['…', `（共 ${entries.length} 个字段）`]);
    return Object.fromEntries(cleaned);
  };

  const cleanEntries = (entries: [string, unknown][], depth: number): [string, unknown][] =>
    entries.flatMap(([key, value]): [string, unknown][] => {
      // 字段的名字也可能含有密钥
      if (isSensitive(key)) return [[scrub(key), REDACTED]];
      const cleaned = clean(value, depth);
      return cleaned === undefined ? [] : [[scrub(key), cleaned]];
    });

  try {
    const fields = Object.entries(entry.fields ?? {}).filter(([key]) => !RESERVED.has(key));
    // Object.fromEntries 定义字段：名为 __proto__ 的字段也只是一个普通的字段（p3-01）
    const line = Object.fromEntries<unknown>([['time', options.time], ['level', entry.level], ['message', scrub(String(entry.message))], ...cleanEntries(fields, 0)]);
    return JSON.stringify(line);
  } catch {
    // 最后的退路：字段本身都读不出来时，至少留下这一行
    return JSON.stringify({ time: options.time, level: entry.level, message: scrub(String(entry.message)), fields: '[Unreadable]' });
  }
}
```
:::

:::variant{kind=wrong name=keys-kept fails=tests reason="字段的名字原样写出：名字中的密钥没有被替换"}
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
/** 字段的名字去掉 - 和 _、变成小写之后，含有这些词就隐藏 */
const SENSITIVE = ['password', 'secret', 'token', 'authorization', 'cookie', 'apikey', 'session'];
const RESERVED = new Set(['time', 'level', 'message']);
const MAX_LENGTH = 500;
const MAX_ENTRIES = 50;
const MAX_DEPTH = 20;

const isSensitive = (key: string) => {
  const normalized = key.toLowerCase().replaceAll('-', '').replaceAll('_', '');
  return SENSITIVE.some((word) => normalized.includes(word));
};

/** 把一条日志变成一行 JSON：去掉密钥，限制大小；不管传进来什么都不抛出错误 */
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

  const clean = (value: unknown, depth: number): unknown => {
    if (typeof value === 'string') return scrub(value);
    if (typeof value === 'bigint') return value.toString();
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value !== 'object') return undefined; // undefined、函数、symbol：和 JSON.stringify 一样去掉
    if (depth > MAX_DEPTH) return '[Too deep]';
    if (ancestors.has(value)) return '[Circular]';
    ancestors.add(value);
    try {
      return cleanObject(value, depth);
    } catch {
      // 读取属性时抛出错误的对象（getter、Proxy 等）
      return '[Unreadable]';
    } finally {
      ancestors.delete(value);
    }
  };

  const cleanObject = (value: object, depth: number): unknown => {
    if (value instanceof Error) {
      const error: [string, unknown][] = [
        ['name', scrub(String(value.name))],
        ['message', scrub(String(value.message))],
      ];
      if (value.cause !== undefined) error.push(['cause', clean(value.cause, depth + 1)]);
      return Object.fromEntries(error);
    }
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
    // 有 toJSON 的对象（例如 URL）：和 JSON.stringify 一样用它的结果
    const toJSON: unknown = Reflect.get(value, 'toJSON');
    if (typeof toJSON === 'function') return clean(Reflect.apply(toJSON, value, []), depth + 1);
    if (Array.isArray(value)) {
      const items: unknown[] = value.slice(0, MAX_ENTRIES).map((item) => clean(item, depth + 1) ?? null);
      if (value.length > MAX_ENTRIES) items.push(`…（共 ${value.length} 项）`);
      return items;
    }
    const entries = Object.entries(value);
    const cleaned = cleanEntries(entries.slice(0, MAX_ENTRIES), depth + 1);
    if (entries.length > MAX_ENTRIES) cleaned.push(['…', `（共 ${entries.length} 个字段）`]);
    return Object.fromEntries(cleaned);
  };

  const cleanEntries = (entries: [string, unknown][], depth: number): [string, unknown][] =>
    entries.flatMap(([key, value]): [string, unknown][] => {
      // 字段的名字也可能含有密钥
      if (isSensitive(key)) return [[scrub(key), REDACTED]];
      const cleaned = clean(value, depth);
      return cleaned === undefined ? [] : [[key, cleaned]];
    });

  try {
    const fields = Object.entries(entry.fields ?? {}).filter(([key]) => !RESERVED.has(key));
    // Object.fromEntries 定义字段：名为 __proto__ 的字段也只是一个普通的字段（p3-01）
    const line = Object.fromEntries<unknown>([['time', options.time], ['level', entry.level], ['message', scrub(String(entry.message))], ...cleanEntries(fields, 0)]);
    return JSON.stringify(line);
  } catch {
    // 最后的退路：字段本身都读不出来时，至少留下这一行
    return JSON.stringify({ time: options.time, level: entry.level, message: scrub(String(entry.message)), fields: '[Unreadable]' });
  }
}
```
:::

:::variant{kind=wrong name=no-cycle-check fails=tests reason="没有处理循环引用：一个指向自己的对象被一层一层地展开，直到深度的上限"}
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
/** 字段的名字去掉 - 和 _、变成小写之后，含有这些词就隐藏 */
const SENSITIVE = ['password', 'secret', 'token', 'authorization', 'cookie', 'apikey', 'session'];
const RESERVED = new Set(['time', 'level', 'message']);
const MAX_LENGTH = 500;
const MAX_ENTRIES = 50;
const MAX_DEPTH = 20;

const isSensitive = (key: string) => {
  const normalized = key.toLowerCase().replaceAll('-', '').replaceAll('_', '');
  return SENSITIVE.some((word) => normalized.includes(word));
};

/** 把一条日志变成一行 JSON：去掉密钥，限制大小；不管传进来什么都不抛出错误 */
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

  const clean = (value: unknown, depth: number): unknown => {
    if (typeof value === 'string') return scrub(value);
    if (typeof value === 'bigint') return value.toString();
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value !== 'object') return undefined; // undefined、函数、symbol：和 JSON.stringify 一样去掉
    if (depth > MAX_DEPTH) return '[Too deep]';
    ancestors.add(value);
    try {
      return cleanObject(value, depth);
    } catch {
      // 读取属性时抛出错误的对象（getter、Proxy 等）
      return '[Unreadable]';
    } finally {
      ancestors.delete(value);
    }
  };

  const cleanObject = (value: object, depth: number): unknown => {
    if (value instanceof Error) {
      const error: [string, unknown][] = [
        ['name', scrub(String(value.name))],
        ['message', scrub(String(value.message))],
      ];
      if (value.cause !== undefined) error.push(['cause', clean(value.cause, depth + 1)]);
      return Object.fromEntries(error);
    }
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
    // 有 toJSON 的对象（例如 URL）：和 JSON.stringify 一样用它的结果
    const toJSON: unknown = Reflect.get(value, 'toJSON');
    if (typeof toJSON === 'function') return clean(Reflect.apply(toJSON, value, []), depth + 1);
    if (Array.isArray(value)) {
      const items: unknown[] = value.slice(0, MAX_ENTRIES).map((item) => clean(item, depth + 1) ?? null);
      if (value.length > MAX_ENTRIES) items.push(`…（共 ${value.length} 项）`);
      return items;
    }
    const entries = Object.entries(value);
    const cleaned = cleanEntries(entries.slice(0, MAX_ENTRIES), depth + 1);
    if (entries.length > MAX_ENTRIES) cleaned.push(['…', `（共 ${entries.length} 个字段）`]);
    return Object.fromEntries(cleaned);
  };

  const cleanEntries = (entries: [string, unknown][], depth: number): [string, unknown][] =>
    entries.flatMap(([key, value]): [string, unknown][] => {
      // 字段的名字也可能含有密钥
      if (isSensitive(key)) return [[scrub(key), REDACTED]];
      const cleaned = clean(value, depth);
      return cleaned === undefined ? [] : [[scrub(key), cleaned]];
    });

  try {
    const fields = Object.entries(entry.fields ?? {}).filter(([key]) => !RESERVED.has(key));
    // Object.fromEntries 定义字段：名为 __proto__ 的字段也只是一个普通的字段（p3-01）
    const line = Object.fromEntries<unknown>([['time', options.time], ['level', entry.level], ['message', scrub(String(entry.message))], ...cleanEntries(fields, 0)]);
    return JSON.stringify(line);
  } catch {
    // 最后的退路：字段本身都读不出来时，至少留下这一行
    return JSON.stringify({ time: options.time, level: entry.level, message: scrub(String(entry.message)), fields: '[Unreadable]' });
  }
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
/** 字段的名字去掉 - 和 _、变成小写之后，含有这些词就隐藏 */
const SENSITIVE = ['password', 'secret', 'token', 'authorization', 'cookie', 'apikey', 'session'];
const RESERVED = new Set(['time', 'level', 'message']);
const MAX_LENGTH = 500;
const MAX_ENTRIES = 50;
const MAX_DEPTH = 20;

const isSensitive = (key: string) => {
  const normalized = key.toLowerCase().replaceAll('-', '').replaceAll('_', '');
  return SENSITIVE.some((word) => normalized.includes(word));
};

/** 把一条日志变成一行 JSON：去掉密钥，限制大小；不管传进来什么都不抛出错误 */
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

  const clean = (value: unknown, depth: number): unknown => {
    if (typeof value === 'string') return scrub(value);
    if (typeof value === 'bigint') return value.toString();
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value !== 'object') return undefined; // undefined、函数、symbol：和 JSON.stringify 一样去掉
    if (depth > MAX_DEPTH) return '[Too deep]';
    if (ancestors.has(value)) return '[Circular]';
    ancestors.add(value);
    try {
      return cleanObject(value, depth);
    } catch {
      // 读取属性时抛出错误的对象（getter、Proxy 等）
      return '[Unreadable]';
    } finally {
    }
  };

  const cleanObject = (value: object, depth: number): unknown => {
    if (value instanceof Error) {
      const error: [string, unknown][] = [
        ['name', scrub(String(value.name))],
        ['message', scrub(String(value.message))],
      ];
      if (value.cause !== undefined) error.push(['cause', clean(value.cause, depth + 1)]);
      return Object.fromEntries(error);
    }
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
    // 有 toJSON 的对象（例如 URL）：和 JSON.stringify 一样用它的结果
    const toJSON: unknown = Reflect.get(value, 'toJSON');
    if (typeof toJSON === 'function') return clean(Reflect.apply(toJSON, value, []), depth + 1);
    if (Array.isArray(value)) {
      const items: unknown[] = value.slice(0, MAX_ENTRIES).map((item) => clean(item, depth + 1) ?? null);
      if (value.length > MAX_ENTRIES) items.push(`…（共 ${value.length} 项）`);
      return items;
    }
    const entries = Object.entries(value);
    const cleaned = cleanEntries(entries.slice(0, MAX_ENTRIES), depth + 1);
    if (entries.length > MAX_ENTRIES) cleaned.push(['…', `（共 ${entries.length} 个字段）`]);
    return Object.fromEntries(cleaned);
  };

  const cleanEntries = (entries: [string, unknown][], depth: number): [string, unknown][] =>
    entries.flatMap(([key, value]): [string, unknown][] => {
      // 字段的名字也可能含有密钥
      if (isSensitive(key)) return [[scrub(key), REDACTED]];
      const cleaned = clean(value, depth);
      return cleaned === undefined ? [] : [[scrub(key), cleaned]];
    });

  try {
    const fields = Object.entries(entry.fields ?? {}).filter(([key]) => !RESERVED.has(key));
    // Object.fromEntries 定义字段：名为 __proto__ 的字段也只是一个普通的字段（p3-01）
    const line = Object.fromEntries<unknown>([['time', options.time], ['level', entry.level], ['message', scrub(String(entry.message))], ...cleanEntries(fields, 0)]);
    return JSON.stringify(line);
  } catch {
    // 最后的退路：字段本身都读不出来时，至少留下这一行
    return JSON.stringify({ time: options.time, level: entry.level, message: scrub(String(entry.message)), fields: '[Unreadable]' });
  }
}
```
:::

:::variant{kind=wrong name=no-guard fails=tests reason="读取对象时没有捕获错误：一个会抛出错误的 getter 让整个对象都读不出来了"}
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
/** 字段的名字去掉 - 和 _、变成小写之后，含有这些词就隐藏 */
const SENSITIVE = ['password', 'secret', 'token', 'authorization', 'cookie', 'apikey', 'session'];
const RESERVED = new Set(['time', 'level', 'message']);
const MAX_LENGTH = 500;
const MAX_ENTRIES = 50;
const MAX_DEPTH = 20;

const isSensitive = (key: string) => {
  const normalized = key.toLowerCase().replaceAll('-', '').replaceAll('_', '');
  return SENSITIVE.some((word) => normalized.includes(word));
};

/** 把一条日志变成一行 JSON：去掉密钥，限制大小；不管传进来什么都不抛出错误 */
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

  const clean = (value: unknown, depth: number): unknown => {
    if (typeof value === 'string') return scrub(value);
    if (typeof value === 'bigint') return value.toString();
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value !== 'object') return undefined; // undefined、函数、symbol：和 JSON.stringify 一样去掉
    if (depth > MAX_DEPTH) return '[Too deep]';
    if (ancestors.has(value)) return '[Circular]';
    ancestors.add(value);
    try {
      return cleanObject(value, depth);
    } finally {
      ancestors.delete(value);
    }
  };

  const cleanObject = (value: object, depth: number): unknown => {
    if (value instanceof Error) {
      const error: [string, unknown][] = [
        ['name', scrub(String(value.name))],
        ['message', scrub(String(value.message))],
      ];
      if (value.cause !== undefined) error.push(['cause', clean(value.cause, depth + 1)]);
      return Object.fromEntries(error);
    }
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
    // 有 toJSON 的对象（例如 URL）：和 JSON.stringify 一样用它的结果
    const toJSON: unknown = Reflect.get(value, 'toJSON');
    if (typeof toJSON === 'function') return clean(Reflect.apply(toJSON, value, []), depth + 1);
    if (Array.isArray(value)) {
      const items: unknown[] = value.slice(0, MAX_ENTRIES).map((item) => clean(item, depth + 1) ?? null);
      if (value.length > MAX_ENTRIES) items.push(`…（共 ${value.length} 项）`);
      return items;
    }
    const entries = Object.entries(value);
    const cleaned = cleanEntries(entries.slice(0, MAX_ENTRIES), depth + 1);
    if (entries.length > MAX_ENTRIES) cleaned.push(['…', `（共 ${entries.length} 个字段）`]);
    return Object.fromEntries(cleaned);
  };

  const cleanEntries = (entries: [string, unknown][], depth: number): [string, unknown][] =>
    entries.flatMap(([key, value]): [string, unknown][] => {
      // 字段的名字也可能含有密钥
      if (isSensitive(key)) return [[scrub(key), REDACTED]];
      const cleaned = clean(value, depth);
      return cleaned === undefined ? [] : [[scrub(key), cleaned]];
    });

  try {
    const fields = Object.entries(entry.fields ?? {}).filter(([key]) => !RESERVED.has(key));
    // Object.fromEntries 定义字段：名为 __proto__ 的字段也只是一个普通的字段（p3-01）
    const line = Object.fromEntries<unknown>([['time', options.time], ['level', entry.level], ['message', scrub(String(entry.message))], ...cleanEntries(fields, 0)]);
    return JSON.stringify(line);
  } catch {
    // 最后的退路：字段本身都读不出来时，至少留下这一行
    return JSON.stringify({ time: options.time, level: entry.level, message: scrub(String(entry.message)), fields: '[Unreadable]' });
  }
}
```
:::

:::variant{kind=wrong name=no-entry-limit fails=tests reason="不限制数组和对象的大小：一个很大的数组让一行日志有几十万个字符"}
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
/** 字段的名字去掉 - 和 _、变成小写之后，含有这些词就隐藏 */
const SENSITIVE = ['password', 'secret', 'token', 'authorization', 'cookie', 'apikey', 'session'];
const RESERVED = new Set(['time', 'level', 'message']);
const MAX_LENGTH = 500;
const MAX_ENTRIES = 50;
const MAX_DEPTH = 20;

const isSensitive = (key: string) => {
  const normalized = key.toLowerCase().replaceAll('-', '').replaceAll('_', '');
  return SENSITIVE.some((word) => normalized.includes(word));
};

/** 把一条日志变成一行 JSON：去掉密钥，限制大小；不管传进来什么都不抛出错误 */
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

  const clean = (value: unknown, depth: number): unknown => {
    if (typeof value === 'string') return scrub(value);
    if (typeof value === 'bigint') return value.toString();
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value !== 'object') return undefined; // undefined、函数、symbol：和 JSON.stringify 一样去掉
    if (depth > MAX_DEPTH) return '[Too deep]';
    if (ancestors.has(value)) return '[Circular]';
    ancestors.add(value);
    try {
      return cleanObject(value, depth);
    } catch {
      // 读取属性时抛出错误的对象（getter、Proxy 等）
      return '[Unreadable]';
    } finally {
      ancestors.delete(value);
    }
  };

  const cleanObject = (value: object, depth: number): unknown => {
    if (value instanceof Error) {
      const error: [string, unknown][] = [
        ['name', scrub(String(value.name))],
        ['message', scrub(String(value.message))],
      ];
      if (value.cause !== undefined) error.push(['cause', clean(value.cause, depth + 1)]);
      return Object.fromEntries(error);
    }
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
    // 有 toJSON 的对象（例如 URL）：和 JSON.stringify 一样用它的结果
    const toJSON: unknown = Reflect.get(value, 'toJSON');
    if (typeof toJSON === 'function') return clean(Reflect.apply(toJSON, value, []), depth + 1);
    if (Array.isArray(value)) {
      const items: unknown[] = value.map((item) => clean(item, depth + 1) ?? null);
      if (value.length > MAX_ENTRIES) items.push(`…（共 ${value.length} 项）`);
      return items;
    }
    const entries = Object.entries(value);
    const cleaned = cleanEntries(entries, depth + 1);
    if (entries.length > MAX_ENTRIES) cleaned.push(['…', `（共 ${entries.length} 个字段）`]);
    return Object.fromEntries(cleaned);
  };

  const cleanEntries = (entries: [string, unknown][], depth: number): [string, unknown][] =>
    entries.flatMap(([key, value]): [string, unknown][] => {
      // 字段的名字也可能含有密钥
      if (isSensitive(key)) return [[scrub(key), REDACTED]];
      const cleaned = clean(value, depth);
      return cleaned === undefined ? [] : [[scrub(key), cleaned]];
    });

  try {
    const fields = Object.entries(entry.fields ?? {}).filter(([key]) => !RESERVED.has(key));
    // Object.fromEntries 定义字段：名为 __proto__ 的字段也只是一个普通的字段（p3-01）
    const line = Object.fromEntries<unknown>([['time', options.time], ['level', entry.level], ['message', scrub(String(entry.message))], ...cleanEntries(fields, 0)]);
    return JSON.stringify(line);
  } catch {
    // 最后的退路：字段本身都读不出来时，至少留下这一行
    return JSON.stringify({ time: options.time, level: entry.level, message: scrub(String(entry.message)), fields: '[Unreadable]' });
  }
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
/** 字段的名字去掉 - 和 _、变成小写之后，含有这些词就隐藏 */
const SENSITIVE = ['password', 'secret', 'token', 'authorization', 'cookie', 'apikey', 'session'];
const RESERVED = new Set(['time', 'level', 'message']);
const MAX_LENGTH = 500;
const MAX_ENTRIES = 50;
const MAX_DEPTH = 20;

const isSensitive = (key: string) => {
  const normalized = key.toLowerCase().replaceAll('-', '').replaceAll('_', '');
  return SENSITIVE.some((word) => normalized.includes(word));
};

/** 把一条日志变成一行 JSON：去掉密钥，限制大小；不管传进来什么都不抛出错误 */
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

  const clean = (value: unknown, depth: number): unknown => {
    if (typeof value === 'string') return scrub(value);
    if (typeof value === 'bigint') return value.toString();
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value !== 'object') return undefined; // undefined、函数、symbol：和 JSON.stringify 一样去掉
    if (depth > MAX_DEPTH) return '[Too deep]';
    if (ancestors.has(value)) return '[Circular]';
    ancestors.add(value);
    try {
      return cleanObject(value, depth);
    } catch {
      // 读取属性时抛出错误的对象（getter、Proxy 等）
      return '[Unreadable]';
    } finally {
      ancestors.delete(value);
    }
  };

  const cleanObject = (value: object, depth: number): unknown => {
    if (value instanceof Error) {
      const error: [string, unknown][] = [
        ['name', scrub(String(value.name))],
        ['message', scrub(String(value.message))],
      ];
      if (value.cause !== undefined) error.push(['cause', clean(value.cause, depth + 1)]);
      return Object.fromEntries(error);
    }
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
    // 有 toJSON 的对象（例如 URL）：和 JSON.stringify 一样用它的结果
    const toJSON: unknown = Reflect.get(value, 'toJSON');
    if (typeof toJSON === 'function') return clean(Reflect.apply(toJSON, value, []), depth + 1);
    if (Array.isArray(value)) {
      const items: unknown[] = value.slice(0, MAX_ENTRIES).map((item) => clean(item, depth + 1) ?? null);
      if (value.length > MAX_ENTRIES) items.push(`…（共 ${value.length} 项）`);
      return items;
    }
    const entries = Object.entries(value);
    const cleaned = cleanEntries(entries.slice(0, MAX_ENTRIES), depth + 1);
    if (entries.length > MAX_ENTRIES) cleaned.push(['…', `（共 ${entries.length} 个字段）`]);
    return Object.fromEntries(cleaned);
  };

  const cleanEntries = (entries: [string, unknown][], depth: number): [string, unknown][] =>
    entries.flatMap(([key, value]): [string, unknown][] => {
      // 字段的名字也可能含有密钥
      if (isSensitive(key)) return [[scrub(key), REDACTED]];
      const cleaned = clean(value, depth);
      return cleaned === undefined ? [] : [[scrub(key), cleaned]];
    });

  try {
    const fields = Object.entries(entry.fields ?? {});
    // Object.fromEntries 定义字段：名为 __proto__ 的字段也只是一个普通的字段（p3-01）
    const line = Object.fromEntries<unknown>([['time', options.time], ['level', entry.level], ['message', scrub(String(entry.message))], ...cleanEntries(fields, 0)]);
    return JSON.stringify(line);
  } catch {
    // 最后的退路：字段本身都读不出来时，至少留下这一行
    return JSON.stringify({ time: options.time, level: entry.level, message: scrub(String(entry.message)), fields: '[Unreadable]' });
  }
}
```
:::

