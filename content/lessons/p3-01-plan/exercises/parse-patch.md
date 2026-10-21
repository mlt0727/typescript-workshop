---
kind: challenge
title: 检查 PATCH 请求体
---
在 `patch.ts` 中实现 `parseProjectPatch(body)`：检查 `PATCH /api/projects/:projectId` 的请求体（`request.json()` 的结果，所以是 `unknown`），返回可以安全使用的 `ProjectPatch`，或者每个字段的错误。

1. `body` 不是一个对象（`null`、数组、字符串、数字……）：`{ ok: false, errors: { body: '请求体必须是一个 JSON 对象' } }`；
2. 可以修改的字段只有 `name`、`owner`、`dueDate`、`status`。其他的每一个字段 `key` 都是一个错误：`errors[key] = '不能修改这个字段'`。字段的名字来自客户端，可能是 `__proto__` 或者 `constructor`，这时 `errors` 中也要有这个字段（用 `Object.keys(errors)` 能看到）；
3. 四个字段一个都没有出现时，加上 `body: '没有要修改的字段'`；
4. 出现了的字段逐个检查（没有出现的不检查，也不出现在 `patch` 中）：
   - `name`：必须是字符串（否则 `'名称必须是字符串'`）；去掉首尾的空白之后不能为空（`'名称不能为空'`），不能超过 60 个字符（`'名称不能超过 60 个字符'`）。字符数按码位计算：一个表情符号是一个字符。`patch` 中是去掉空白之后的值；
   - `owner`：同上，`'负责人…'`，最多 30 个字符；
   - `dueDate`：`null`（清除截止日期），或者一个 `YYYY-MM-DD` 格式、日历上有这一天的日期；否则 `'截止日期必须是 YYYY-MM-DD 格式的日期，或者 null'`；
   - `status`：`'planning'`、`'active'`、`'done'` 之一，否则 `'状态必须是 planning、active、done 之一'`（状态能不能这样变，p3-02 再检查）；
5. 所有的错误一起报告。有任何错误时返回 `{ ok: false, errors }`，否则返回 `{ ok: true, patch }`。

:::files{role=support}
```ts file=model.ts readonly
/** 项目的三种状态：计划中、进行中、已完成（和项目 2 一样） */
export const STATUSES = ['planning', 'active', 'done'] as const;
export type ProjectStatus = (typeof STATUSES)[number];

export const STATUS_NAMES: Readonly<Record<ProjectStatus, string>> = { planning: '计划中', active: '进行中', done: '已完成' };

/** 发给客户端的数据：和项目 2 的 Project 一样，多了 version 和 updatedAt */
export type TaskDto = Readonly<{ id: string; title: string; done: boolean }>;
export type ProjectDto = Readonly<{
  id: string;
  name: string;
  owner: string;
  status: ProjectStatus;
  /** 截止日期，格式是 YYYY-MM-DD；没有截止日期时是 null */
  dueDate: string | null;
  tasks: readonly TaskDto[];
  /** 每次修改加 1，用来发现并发的修改（p3-02） */
  version: number;
  updatedAt: string;
}>;

/** 服务器保存的数据：有一些字段从不发给客户端 */
export type StoredTask = Readonly<{
  id: string;
  title: string;
  done: boolean;
  /** 任务在清单中的顺序，从小到大 */
  position: number;
  createdAt: string;
  /** 删除的时间；没有删除时是 null（软删除） */
  deletedAt: string | null;
}>;

export type StoredProject = Readonly<{
  id: string;
  name: string;
  owner: string;
  /** 负责人的邮箱：只用来发通知，不公开 */
  ownerEmail: string;
  status: ProjectStatus;
  dueDate: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  tasks: readonly StoredTask[];
}>;
```
:::

:::files{role=starter}
```ts file=patch.ts
import { STATUSES, type ProjectStatus } from './model';

/** 修改一个项目时可以改的字段：没有出现的字段不改；dueDate 是 null 表示清除截止日期 */
export type ProjectPatch = Readonly<{ name?: string; owner?: string; dueDate?: string | null; status?: ProjectStatus }>;

export type PatchResult = { ok: true; patch: ProjectPatch } | { ok: false; errors: Readonly<Record<string, string>> };

/** 检查客户端发来的 PATCH 请求体：它来自网络，什么都可能有 */
export function parseProjectPatch(body: unknown): PatchResult {
  // TODO
  return { ok: true, patch: {} };
}
```
```ts file=main.ts readonly
import { parseProjectPatch } from './patch';

const bodies = [
  '{"name":"  官网改版（二期） ","dueDate":null}',
  '{"name":"","status":"archived","version":1}',
  '{"__proto__":{"isAdmin":true}}',
  '[]',
];
for (const json of bodies) console.log(json, '→', parseProjectPatch(JSON.parse(json)));
```
:::

:::files{role=solution}
```ts file=patch.ts
import { STATUSES, type ProjectStatus } from './model';

/** 修改一个项目时可以改的字段：没有出现的字段不改；dueDate 是 null 表示清除截止日期 */
export type ProjectPatch = Readonly<{ name?: string; owner?: string; dueDate?: string | null; status?: ProjectStatus }>;

export type PatchResult = { ok: true; patch: ProjectPatch } | { ok: false; errors: Readonly<Record<string, string>> };

const ALLOWED: readonly string[] = ['name', 'owner', 'dueDate', 'status'];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** YYYY-MM-DD，并且日历上有这一天（2026-02-30 不算） */
function isDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) return false;
  const [year = 0, month = 0, day = 0] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** 名称、负责人：去掉首尾的空白之后，1 到 max 个字符（按码位数） */
function parseText(value: unknown, label: string, max: number): { value: string } | { error: string } {
  if (typeof value !== 'string') return { error: `${label}必须是字符串` };
  const text = value.trim();
  if (text === '') return { error: `${label}不能为空` };
  if ([...text].length > max) return { error: `${label}不能超过 ${max} 个字符` };
  return { value: text };
}

/** 检查客户端发来的 PATCH 请求体：它来自网络，什么都可能有 */
export function parseProjectPatch(body: unknown): PatchResult {
  if (!isRecord(body)) return { ok: false, errors: { body: '请求体必须是一个 JSON 对象' } };
  // 用 Map 收集错误：字段的名字来自客户端，可能是 __proto__
  const errors = new Map<string, string>();
  const patch: { name?: string; owner?: string; dueDate?: string | null; status?: ProjectStatus } = {};

  for (const key of Object.keys(body)) {
    if (!ALLOWED.includes(key)) errors.set(key, '不能修改这个字段');
  }
  if (!ALLOWED.some((key) => Object.hasOwn(body, key))) errors.set('body', '没有要修改的字段');

  if (Object.hasOwn(body, 'name')) {
    const result = parseText(body['name'], '名称', 60);
    if ('error' in result) errors.set('name', result.error);
    else patch.name = result.value;
  }
  if (Object.hasOwn(body, 'owner')) {
    const result = parseText(body['owner'], '负责人', 30);
    if ('error' in result) errors.set('owner', result.error);
    else patch.owner = result.value;
  }
  if (Object.hasOwn(body, 'dueDate')) {
    const value = body['dueDate'];
    if (value === null || (typeof value === 'string' && isDate(value))) patch.dueDate = value;
    else errors.set('dueDate', '截止日期必须是 YYYY-MM-DD 格式的日期，或者 null');
  }
  if (Object.hasOwn(body, 'status')) {
    const status = STATUSES.find((s) => s === body['status']);
    if (status === undefined) errors.set('status', '状态必须是 planning、active、done 之一');
    else patch.status = status;
  }

  return errors.size > 0 ? { ok: false, errors: Object.fromEntries(errors) } : { ok: true, patch };
}
```
```ts file=main.ts readonly
import { parseProjectPatch } from './patch';

const bodies = [
  '{"name":"  官网改版（二期） ","dueDate":null}',
  '{"name":"","status":"archived","version":1}',
  '{"__proto__":{"isAdmin":true}}',
  '[]',
];
for (const json of bodies) console.log(json, '→', parseProjectPatch(JSON.parse(json)));
```
:::

:::files{role=tests}
```ts file=patch.test.ts
import { describe, expect, test } from 'vitest';
import { parseProjectPatch } from './patch';

/** 请求体都是 JSON.parse 的结果，和服务器上 request.json() 得到的一样 */
const parse = (json: string) => parseProjectPatch(JSON.parse(json));

describe('parseProjectPatch', () => {
  test('请求体不是对象', () => {
    for (const json of ['null', '[]', '"name"', '42', 'true']) {
      expect(parse(json), json).toStrictEqual({ ok: false, errors: { body: '请求体必须是一个 JSON 对象' } });
    }
  });

  test('合法的修改：去掉首尾的空白；没有出现的字段不在 patch 中', () => {
    expect(parse('{"name":"  官网改版（二期） ","status":"active"}')).toStrictEqual({ ok: true, patch: { name: '官网改版（二期）', status: 'active' } });
    expect(parse('{"owner":"李雷","dueDate":"2026-12-31"}')).toStrictEqual({ ok: true, patch: { owner: '李雷', dueDate: '2026-12-31' } });
  });

  test('dueDate 是 null：清除截止日期', () => {
    expect(parse('{"dueDate":null}')).toStrictEqual({ ok: true, patch: { dueDate: null } });
  });

  test('名称和负责人：必须是字符串，不能为空，长度按字符数', () => {
    expect(parse('{"name":null}')).toStrictEqual({ ok: false, errors: { name: '名称必须是字符串' } });
    expect(parse('{"owner":7}')).toStrictEqual({ ok: false, errors: { owner: '负责人必须是字符串' } });
    expect(parse('{"name":"   "}')).toStrictEqual({ ok: false, errors: { name: '名称不能为空' } });
    expect(parseProjectPatch({ name: '项'.repeat(61) })).toStrictEqual({ ok: false, errors: { name: '名称不能超过 60 个字符' } });
    expect(parseProjectPatch({ owner: 'x'.repeat(31) })).toStrictEqual({ ok: false, errors: { owner: '负责人不能超过 30 个字符' } });
    // 正好 60 个字符可以；一个表情符号是一个字符（虽然 .length 是 2）
    expect(parseProjectPatch({ name: '项'.repeat(60) }).ok).toBe(true);
    expect(parseProjectPatch({ name: '🚀'.repeat(60) })).toStrictEqual({ ok: true, patch: { name: '🚀'.repeat(60) } });
  });

  test('截止日期：YYYY-MM-DD，并且日历上有这一天', () => {
    for (const value of ['2026-2-3', '2026-02-30', '2026-13-01', '2026-02-29', '', '2026/02/03', '2026-02-03T00:00:00Z', 20261021]) {
      expect(parseProjectPatch({ dueDate: value }), String(value)).toStrictEqual({ ok: false, errors: { dueDate: '截止日期必须是 YYYY-MM-DD 格式的日期，或者 null' } });
    }
    expect(parseProjectPatch({ dueDate: '2028-02-29' })).toStrictEqual({ ok: true, patch: { dueDate: '2028-02-29' } });
  });

  test('状态：只能是三种之一（状态能不能这样变，p3-02 再检查）', () => {
    for (const value of ['archived', 'Active', null, 1]) {
      expect(parseProjectPatch({ status: value }), String(value)).toStrictEqual({ ok: false, errors: { status: '状态必须是 planning、active、done 之一' } });
    }
  });

  test('不能修改的字段：每一个都报错，即使其他的字段都合法', () => {
    expect(parse('{"name":"新名称","version":1,"id":"p9","ownerEmail":"evil@example.com","tasks":[]}')).toStrictEqual({
      ok: false,
      errors: { version: '不能修改这个字段', id: '不能修改这个字段', ownerEmail: '不能修改这个字段', tasks: '不能修改这个字段' },
    });
  });

  test('字段的名字是 __proto__ 或者 constructor 时也一样', () => {
    const result = parse('{"name":"新名称","__proto__":{"isAdmin":true},"constructor":1}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).toSorted()).toStrictEqual(['__proto__', 'constructor']);
      expect(Object.getPrototypeOf(result.errors)).toBe(Object.prototype);
    }
  });

  test('所有的错误一起报告', () => {
    expect(parse('{"name":"","owner":1,"status":"x","dueDate":"明天"}')).toStrictEqual({
      ok: false,
      errors: {
        name: '名称不能为空',
        owner: '负责人必须是字符串',
        status: '状态必须是 planning、active、done 之一',
        dueDate: '截止日期必须是 YYYY-MM-DD 格式的日期，或者 null',
      },
    });
  });

  test('没有要修改的字段', () => {
    expect(parse('{}')).toStrictEqual({ ok: false, errors: { body: '没有要修改的字段' } });
    expect(parse('{"id":"p1"}')).toStrictEqual({ ok: false, errors: { id: '不能修改这个字段', body: '没有要修改的字段' } });
  });
});
```
:::

:::hint{level=1}
先用一个类型守卫确认 `body` 是普通的对象（`typeof`、`!== null`、`!Array.isArray`）。用 `Object.keys(body)` 找出不认识的字段；判断一个字段有没有出现用 `Object.hasOwn(body, 'dueDate')`，它和“值是 `undefined`”不一样。
:::

:::hint{level=2}
错误先收集在一个 `Map<string, string>` 中，最后用 `Object.fromEntries` 变成对象：它用“定义”的方式创建字段，`__proto__` 也会成为一个普通的字段；而 `errors['__proto__'] = …` 是赋值，改的是原型。日期的检查：用正则取出年、月、日，`new Date(Date.UTC(年, 月 - 1, 日))`，再看取回来的年、月、日是不是原样（2 月 30 日会变成 3 月 2 日）。
:::

:::explanation
服务器收到的请求体是 `unknown`：它可能不是对象，字段的类型可能不对，可能多出任何字段。所以检查分三层：形状（是不是对象）、白名单（只认四个字段）、每个字段的值。

不认识的字段报错而不是忽略，是一个选择：忽略也安全（它们不会被使用），但客户端的 bug 会被掩盖，例如客户端想修改 `version`，服务器悄悄忽略了，客户端却以为修改成功了。

`Object.fromEntries` 和 `Map` 是处理“键来自外部”的稳妥写法。普通的对象有原型，`obj['__proto__'] = value` 走的是原型的 setter，`Object.assign` 也一样（正文的示例中实测它改掉了原型）；`Object.fromEntries`、对象展开、`JSON.parse` 则用“定义”的方式创建字段，不会碰到原型。

`patch` 中只放出现了的字段，`dueDate: null` 和没有 `dueDate` 是两种不同的修改。p3-02 用 `{ ...stored, ...patch }` 合并时，这个区别就是“清除”和“不改”。

替代解为每个字段写一个解析函数（`Parsed<T>` 是成功的值或者错误的信息），遍历请求体的每一个字段，按名字交给对应的函数；日期用 `Date.parse` 解析，再用 `toISOString()` 格式化回来比较。
:::

:::variant{kind=alt name=field-parsers}
```ts file=patch.ts
import { STATUSES, type ProjectStatus } from './model';

export type ProjectPatch = Readonly<{ name?: string; owner?: string; dueDate?: string | null; status?: ProjectStatus }>;

export type PatchResult = { ok: true; patch: ProjectPatch } | { ok: false; errors: Readonly<Record<string, string>> };

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

const text =
  (label: string, max: number) =>
  (value: unknown): Parsed<string> => {
    if (typeof value !== 'string') return fail(`${label}必须是字符串`);
    const trimmed = value.trim();
    if (trimmed === '') return fail(`${label}不能为空`);
    return Array.from(trimmed).length > max ? fail(`${label}不能超过 ${max} 个字符`) : { ok: true, value: trimmed };
  };

function date(value: unknown): Parsed<string | null> {
  if (value === null) return { ok: true, value: null };
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    // 用这一天的 UTC 零点再格式化一次：日期不存在时会“进位”到另一天
    const time = Date.parse(`${value}T00:00:00Z`);
    if (!Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value) return { ok: true, value };
  }
  return fail('截止日期必须是 YYYY-MM-DD 格式的日期，或者 null');
}

function status(value: unknown): Parsed<ProjectStatus> {
  for (const s of STATUSES) if (s === value) return { ok: true, value: s };
  return fail('状态必须是 planning、active、done 之一');
}

/** 每个可以修改的字段一个解析函数：加一个字段只要在这里加一行 */
const FIELDS = { name: text('名称', 60), owner: text('负责人', 30), dueDate: date, status };

export function parseProjectPatch(body: unknown): PatchResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { ok: false, errors: { body: '请求体必须是一个 JSON 对象' } };
  const errors: [string, string][] = [];
  const patch: { name?: string; owner?: string; dueDate?: string | null; status?: ProjectStatus } = {};
  let found = 0;

  for (const [key, value] of Object.entries(body)) {
    if (key === 'name' || key === 'owner') {
      found++;
      const result = FIELDS[key](value);
      if (result.ok) patch[key] = result.value;
      else errors.push([key, result.error]);
    } else if (key === 'dueDate') {
      found++;
      const result = FIELDS.dueDate(value);
      if (result.ok) patch.dueDate = result.value;
      else errors.push([key, result.error]);
    } else if (key === 'status') {
      found++;
      const result = FIELDS.status(value);
      if (result.ok) patch.status = result.value;
      else errors.push([key, result.error]);
    } else {
      errors.push([key, '不能修改这个字段']);
    }
  }
  if (found === 0) errors.push(['body', '没有要修改的字段']);
  return errors.length > 0 ? { ok: false, errors: Object.fromEntries(errors) } : { ok: true, patch };
}
```
:::

:::variant{kind=wrong name=ignore-unknown fails=tests reason="悄悄忽略了不认识的字段：客户端想修改 version 时，以为修改成功了"}
```ts file=patch.ts
import { STATUSES, type ProjectStatus } from './model';

/** 修改一个项目时可以改的字段：没有出现的字段不改；dueDate 是 null 表示清除截止日期 */
export type ProjectPatch = Readonly<{ name?: string; owner?: string; dueDate?: string | null; status?: ProjectStatus }>;

export type PatchResult = { ok: true; patch: ProjectPatch } | { ok: false; errors: Readonly<Record<string, string>> };

const ALLOWED: readonly string[] = ['name', 'owner', 'dueDate', 'status'];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** YYYY-MM-DD，并且日历上有这一天（2026-02-30 不算） */
function isDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) return false;
  const [year = 0, month = 0, day = 0] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** 名称、负责人：去掉首尾的空白之后，1 到 max 个字符（按码位数） */
function parseText(value: unknown, label: string, max: number): { value: string } | { error: string } {
  if (typeof value !== 'string') return { error: `${label}必须是字符串` };
  const text = value.trim();
  if (text === '') return { error: `${label}不能为空` };
  if ([...text].length > max) return { error: `${label}不能超过 ${max} 个字符` };
  return { value: text };
}

/** 检查客户端发来的 PATCH 请求体：它来自网络，什么都可能有 */
export function parseProjectPatch(body: unknown): PatchResult {
  if (!isRecord(body)) return { ok: false, errors: { body: '请求体必须是一个 JSON 对象' } };
  // 用 Map 收集错误：字段的名字来自客户端，可能是 __proto__
  const errors = new Map<string, string>();
  const patch: { name?: string; owner?: string; dueDate?: string | null; status?: ProjectStatus } = {};

  if (!ALLOWED.some((key) => Object.hasOwn(body, key))) errors.set('body', '没有要修改的字段');

  if (Object.hasOwn(body, 'name')) {
    const result = parseText(body['name'], '名称', 60);
    if ('error' in result) errors.set('name', result.error);
    else patch.name = result.value;
  }
  if (Object.hasOwn(body, 'owner')) {
    const result = parseText(body['owner'], '负责人', 30);
    if ('error' in result) errors.set('owner', result.error);
    else patch.owner = result.value;
  }
  if (Object.hasOwn(body, 'dueDate')) {
    const value = body['dueDate'];
    if (value === null || (typeof value === 'string' && isDate(value))) patch.dueDate = value;
    else errors.set('dueDate', '截止日期必须是 YYYY-MM-DD 格式的日期，或者 null');
  }
  if (Object.hasOwn(body, 'status')) {
    const status = STATUSES.find((s) => s === body['status']);
    if (status === undefined) errors.set('status', '状态必须是 planning、active、done 之一');
    else patch.status = status;
  }

  return errors.size > 0 ? { ok: false, errors: Object.fromEntries(errors) } : { ok: true, patch };
}
```
:::

:::variant{kind=wrong name=plain-object-errors fails=tests reason="用赋值把错误放进普通的对象：all[__proto__] = … 不会创建这个字段，客户端看不到是哪个字段错了"}
```ts file=patch.ts
import { STATUSES, type ProjectStatus } from './model';

/** 修改一个项目时可以改的字段：没有出现的字段不改；dueDate 是 null 表示清除截止日期 */
export type ProjectPatch = Readonly<{ name?: string; owner?: string; dueDate?: string | null; status?: ProjectStatus }>;

export type PatchResult = { ok: true; patch: ProjectPatch } | { ok: false; errors: Readonly<Record<string, string>> };

const ALLOWED: readonly string[] = ['name', 'owner', 'dueDate', 'status'];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** YYYY-MM-DD，并且日历上有这一天（2026-02-30 不算） */
function isDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) return false;
  const [year = 0, month = 0, day = 0] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** 名称、负责人：去掉首尾的空白之后，1 到 max 个字符（按码位数） */
function parseText(value: unknown, label: string, max: number): { value: string } | { error: string } {
  if (typeof value !== 'string') return { error: `${label}必须是字符串` };
  const text = value.trim();
  if (text === '') return { error: `${label}不能为空` };
  if ([...text].length > max) return { error: `${label}不能超过 ${max} 个字符` };
  return { value: text };
}

/** 检查客户端发来的 PATCH 请求体：它来自网络，什么都可能有 */
export function parseProjectPatch(body: unknown): PatchResult {
  if (!isRecord(body)) return { ok: false, errors: { body: '请求体必须是一个 JSON 对象' } };
  // 用 Map 收集错误：字段的名字来自客户端，可能是 __proto__
  const errors = new Map<string, string>();
  const patch: { name?: string; owner?: string; dueDate?: string | null; status?: ProjectStatus } = {};

  for (const key of Object.keys(body)) {
    if (!ALLOWED.includes(key)) errors.set(key, '不能修改这个字段');
  }
  if (!ALLOWED.some((key) => Object.hasOwn(body, key))) errors.set('body', '没有要修改的字段');

  if (Object.hasOwn(body, 'name')) {
    const result = parseText(body['name'], '名称', 60);
    if ('error' in result) errors.set('name', result.error);
    else patch.name = result.value;
  }
  if (Object.hasOwn(body, 'owner')) {
    const result = parseText(body['owner'], '负责人', 30);
    if ('error' in result) errors.set('owner', result.error);
    else patch.owner = result.value;
  }
  if (Object.hasOwn(body, 'dueDate')) {
    const value = body['dueDate'];
    if (value === null || (typeof value === 'string' && isDate(value))) patch.dueDate = value;
    else errors.set('dueDate', '截止日期必须是 YYYY-MM-DD 格式的日期，或者 null');
  }
  if (Object.hasOwn(body, 'status')) {
    const status = STATUSES.find((s) => s === body['status']);
    if (status === undefined) errors.set('status', '状态必须是 planning、active、done 之一');
    else patch.status = status;
  }

  return errors.size > 0 ? { ok: false, errors: [...errors].reduce<Record<string, string>>((all, [key, message]) => {
        all[key] = message;
        return all;
      }, {}) } : { ok: true, patch };
}
```
:::

:::variant{kind=wrong name=no-trim fails=tests reason="没有去掉首尾的空白：只有空格的名称被接受了"}
```ts file=patch.ts
import { STATUSES, type ProjectStatus } from './model';

/** 修改一个项目时可以改的字段：没有出现的字段不改；dueDate 是 null 表示清除截止日期 */
export type ProjectPatch = Readonly<{ name?: string; owner?: string; dueDate?: string | null; status?: ProjectStatus }>;

export type PatchResult = { ok: true; patch: ProjectPatch } | { ok: false; errors: Readonly<Record<string, string>> };

const ALLOWED: readonly string[] = ['name', 'owner', 'dueDate', 'status'];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** YYYY-MM-DD，并且日历上有这一天（2026-02-30 不算） */
function isDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) return false;
  const [year = 0, month = 0, day = 0] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** 名称、负责人：去掉首尾的空白之后，1 到 max 个字符（按码位数） */
function parseText(value: unknown, label: string, max: number): { value: string } | { error: string } {
  if (typeof value !== 'string') return { error: `${label}必须是字符串` };
  const text = value;
  if (text === '') return { error: `${label}不能为空` };
  if ([...text].length > max) return { error: `${label}不能超过 ${max} 个字符` };
  return { value: text };
}

/** 检查客户端发来的 PATCH 请求体：它来自网络，什么都可能有 */
export function parseProjectPatch(body: unknown): PatchResult {
  if (!isRecord(body)) return { ok: false, errors: { body: '请求体必须是一个 JSON 对象' } };
  // 用 Map 收集错误：字段的名字来自客户端，可能是 __proto__
  const errors = new Map<string, string>();
  const patch: { name?: string; owner?: string; dueDate?: string | null; status?: ProjectStatus } = {};

  for (const key of Object.keys(body)) {
    if (!ALLOWED.includes(key)) errors.set(key, '不能修改这个字段');
  }
  if (!ALLOWED.some((key) => Object.hasOwn(body, key))) errors.set('body', '没有要修改的字段');

  if (Object.hasOwn(body, 'name')) {
    const result = parseText(body['name'], '名称', 60);
    if ('error' in result) errors.set('name', result.error);
    else patch.name = result.value;
  }
  if (Object.hasOwn(body, 'owner')) {
    const result = parseText(body['owner'], '负责人', 30);
    if ('error' in result) errors.set('owner', result.error);
    else patch.owner = result.value;
  }
  if (Object.hasOwn(body, 'dueDate')) {
    const value = body['dueDate'];
    if (value === null || (typeof value === 'string' && isDate(value))) patch.dueDate = value;
    else errors.set('dueDate', '截止日期必须是 YYYY-MM-DD 格式的日期，或者 null');
  }
  if (Object.hasOwn(body, 'status')) {
    const status = STATUSES.find((s) => s === body['status']);
    if (status === undefined) errors.set('status', '状态必须是 planning、active、done 之一');
    else patch.status = status;
  }

  return errors.size > 0 ? { ok: false, errors: Object.fromEntries(errors) } : { ok: true, patch };
}
```
:::

:::variant{kind=wrong name=utf16-length fails=tests reason="用 .length 数字符：一个表情符号算两个，60 个 🚀 被拒绝了"}
```ts file=patch.ts
import { STATUSES, type ProjectStatus } from './model';

/** 修改一个项目时可以改的字段：没有出现的字段不改；dueDate 是 null 表示清除截止日期 */
export type ProjectPatch = Readonly<{ name?: string; owner?: string; dueDate?: string | null; status?: ProjectStatus }>;

export type PatchResult = { ok: true; patch: ProjectPatch } | { ok: false; errors: Readonly<Record<string, string>> };

const ALLOWED: readonly string[] = ['name', 'owner', 'dueDate', 'status'];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** YYYY-MM-DD，并且日历上有这一天（2026-02-30 不算） */
function isDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) return false;
  const [year = 0, month = 0, day = 0] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** 名称、负责人：去掉首尾的空白之后，1 到 max 个字符（按码位数） */
function parseText(value: unknown, label: string, max: number): { value: string } | { error: string } {
  if (typeof value !== 'string') return { error: `${label}必须是字符串` };
  const text = value.trim();
  if (text === '') return { error: `${label}不能为空` };
  if (text.length > max) return { error: `${label}不能超过 ${max} 个字符` };
  return { value: text };
}

/** 检查客户端发来的 PATCH 请求体：它来自网络，什么都可能有 */
export function parseProjectPatch(body: unknown): PatchResult {
  if (!isRecord(body)) return { ok: false, errors: { body: '请求体必须是一个 JSON 对象' } };
  // 用 Map 收集错误：字段的名字来自客户端，可能是 __proto__
  const errors = new Map<string, string>();
  const patch: { name?: string; owner?: string; dueDate?: string | null; status?: ProjectStatus } = {};

  for (const key of Object.keys(body)) {
    if (!ALLOWED.includes(key)) errors.set(key, '不能修改这个字段');
  }
  if (!ALLOWED.some((key) => Object.hasOwn(body, key))) errors.set('body', '没有要修改的字段');

  if (Object.hasOwn(body, 'name')) {
    const result = parseText(body['name'], '名称', 60);
    if ('error' in result) errors.set('name', result.error);
    else patch.name = result.value;
  }
  if (Object.hasOwn(body, 'owner')) {
    const result = parseText(body['owner'], '负责人', 30);
    if ('error' in result) errors.set('owner', result.error);
    else patch.owner = result.value;
  }
  if (Object.hasOwn(body, 'dueDate')) {
    const value = body['dueDate'];
    if (value === null || (typeof value === 'string' && isDate(value))) patch.dueDate = value;
    else errors.set('dueDate', '截止日期必须是 YYYY-MM-DD 格式的日期，或者 null');
  }
  if (Object.hasOwn(body, 'status')) {
    const status = STATUSES.find((s) => s === body['status']);
    if (status === undefined) errors.set('status', '状态必须是 planning、active、done 之一');
    else patch.status = status;
  }

  return errors.size > 0 ? { ok: false, errors: Object.fromEntries(errors) } : { ok: true, patch };
}
```
:::

:::variant{kind=wrong name=format-only-date fails=tests reason="只检查了日期的格式：2026-02-30 这样不存在的日期被接受了"}
```ts file=patch.ts
import { STATUSES, type ProjectStatus } from './model';

/** 修改一个项目时可以改的字段：没有出现的字段不改；dueDate 是 null 表示清除截止日期 */
export type ProjectPatch = Readonly<{ name?: string; owner?: string; dueDate?: string | null; status?: ProjectStatus }>;

export type PatchResult = { ok: true; patch: ProjectPatch } | { ok: false; errors: Readonly<Record<string, string>> };

const ALLOWED: readonly string[] = ['name', 'owner', 'dueDate', 'status'];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** YYYY-MM-DD，并且日历上有这一天（2026-02-30 不算） */
function isDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) return false;
  const [year = 0, month = 0, day = 0] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** 名称、负责人：去掉首尾的空白之后，1 到 max 个字符（按码位数） */
function parseText(value: unknown, label: string, max: number): { value: string } | { error: string } {
  if (typeof value !== 'string') return { error: `${label}必须是字符串` };
  const text = value.trim();
  if (text === '') return { error: `${label}不能为空` };
  if ([...text].length > max) return { error: `${label}不能超过 ${max} 个字符` };
  return { value: text };
}

/** 检查客户端发来的 PATCH 请求体：它来自网络，什么都可能有 */
export function parseProjectPatch(body: unknown): PatchResult {
  if (!isRecord(body)) return { ok: false, errors: { body: '请求体必须是一个 JSON 对象' } };
  // 用 Map 收集错误：字段的名字来自客户端，可能是 __proto__
  const errors = new Map<string, string>();
  const patch: { name?: string; owner?: string; dueDate?: string | null; status?: ProjectStatus } = {};

  for (const key of Object.keys(body)) {
    if (!ALLOWED.includes(key)) errors.set(key, '不能修改这个字段');
  }
  if (!ALLOWED.some((key) => Object.hasOwn(body, key))) errors.set('body', '没有要修改的字段');

  if (Object.hasOwn(body, 'name')) {
    const result = parseText(body['name'], '名称', 60);
    if ('error' in result) errors.set('name', result.error);
    else patch.name = result.value;
  }
  if (Object.hasOwn(body, 'owner')) {
    const result = parseText(body['owner'], '负责人', 30);
    if ('error' in result) errors.set('owner', result.error);
    else patch.owner = result.value;
  }
  if (Object.hasOwn(body, 'dueDate')) {
    const value = body['dueDate'];
    if (value === null || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))) patch.dueDate = value;
    else errors.set('dueDate', '截止日期必须是 YYYY-MM-DD 格式的日期，或者 null');
  }
  if (Object.hasOwn(body, 'status')) {
    const status = STATUSES.find((s) => s === body['status']);
    if (status === undefined) errors.set('status', '状态必须是 planning、active、done 之一');
    else patch.status = status;
  }

  return errors.size > 0 ? { ok: false, errors: Object.fromEntries(errors) } : { ok: true, patch };
}
```
:::

:::variant{kind=wrong name=null-rejected fails=tests reason="不接受 null：客户端没有办法清除截止日期"}
```ts file=patch.ts
import { STATUSES, type ProjectStatus } from './model';

/** 修改一个项目时可以改的字段：没有出现的字段不改；dueDate 是 null 表示清除截止日期 */
export type ProjectPatch = Readonly<{ name?: string; owner?: string; dueDate?: string | null; status?: ProjectStatus }>;

export type PatchResult = { ok: true; patch: ProjectPatch } | { ok: false; errors: Readonly<Record<string, string>> };

const ALLOWED: readonly string[] = ['name', 'owner', 'dueDate', 'status'];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** YYYY-MM-DD，并且日历上有这一天（2026-02-30 不算） */
function isDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) return false;
  const [year = 0, month = 0, day = 0] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** 名称、负责人：去掉首尾的空白之后，1 到 max 个字符（按码位数） */
function parseText(value: unknown, label: string, max: number): { value: string } | { error: string } {
  if (typeof value !== 'string') return { error: `${label}必须是字符串` };
  const text = value.trim();
  if (text === '') return { error: `${label}不能为空` };
  if ([...text].length > max) return { error: `${label}不能超过 ${max} 个字符` };
  return { value: text };
}

/** 检查客户端发来的 PATCH 请求体：它来自网络，什么都可能有 */
export function parseProjectPatch(body: unknown): PatchResult {
  if (!isRecord(body)) return { ok: false, errors: { body: '请求体必须是一个 JSON 对象' } };
  // 用 Map 收集错误：字段的名字来自客户端，可能是 __proto__
  const errors = new Map<string, string>();
  const patch: { name?: string; owner?: string; dueDate?: string | null; status?: ProjectStatus } = {};

  for (const key of Object.keys(body)) {
    if (!ALLOWED.includes(key)) errors.set(key, '不能修改这个字段');
  }
  if (!ALLOWED.some((key) => Object.hasOwn(body, key))) errors.set('body', '没有要修改的字段');

  if (Object.hasOwn(body, 'name')) {
    const result = parseText(body['name'], '名称', 60);
    if ('error' in result) errors.set('name', result.error);
    else patch.name = result.value;
  }
  if (Object.hasOwn(body, 'owner')) {
    const result = parseText(body['owner'], '负责人', 30);
    if ('error' in result) errors.set('owner', result.error);
    else patch.owner = result.value;
  }
  if (Object.hasOwn(body, 'dueDate')) {
    const value = body['dueDate'];
    if (typeof value === 'string' && isDate(value)) patch.dueDate = value;
    else errors.set('dueDate', '截止日期必须是 YYYY-MM-DD 格式的日期，或者 null');
  }
  if (Object.hasOwn(body, 'status')) {
    const status = STATUSES.find((s) => s === body['status']);
    if (status === undefined) errors.set('status', '状态必须是 planning、active、done 之一');
    else patch.status = status;
  }

  return errors.size > 0 ? { ok: false, errors: Object.fromEntries(errors) } : { ok: true, patch };
}
```
:::

:::variant{kind=wrong name=undefined-field fails=tests reason="没有发来的字段也写进了 patch（值是 undefined）：合并时会把原来的截止日期覆盖掉"}
```ts file=patch.ts
import { STATUSES, type ProjectStatus } from './model';

/** 修改一个项目时可以改的字段：没有出现的字段不改；dueDate 是 null 表示清除截止日期 */
export type ProjectPatch = Readonly<{ name?: string; owner?: string; dueDate?: string | null; status?: ProjectStatus }>;

export type PatchResult = { ok: true; patch: ProjectPatch } | { ok: false; errors: Readonly<Record<string, string>> };

const ALLOWED: readonly string[] = ['name', 'owner', 'dueDate', 'status'];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** YYYY-MM-DD，并且日历上有这一天（2026-02-30 不算） */
function isDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) return false;
  const [year = 0, month = 0, day = 0] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** 名称、负责人：去掉首尾的空白之后，1 到 max 个字符（按码位数） */
function parseText(value: unknown, label: string, max: number): { value: string } | { error: string } {
  if (typeof value !== 'string') return { error: `${label}必须是字符串` };
  const text = value.trim();
  if (text === '') return { error: `${label}不能为空` };
  if ([...text].length > max) return { error: `${label}不能超过 ${max} 个字符` };
  return { value: text };
}

/** 检查客户端发来的 PATCH 请求体：它来自网络，什么都可能有 */
export function parseProjectPatch(body: unknown): PatchResult {
  if (!isRecord(body)) return { ok: false, errors: { body: '请求体必须是一个 JSON 对象' } };
  // 用 Map 收集错误：字段的名字来自客户端，可能是 __proto__
  const errors = new Map<string, string>();
  const patch: { name?: string; owner?: string; dueDate?: string | null; status?: ProjectStatus } = {};

  for (const key of Object.keys(body)) {
    if (!ALLOWED.includes(key)) errors.set(key, '不能修改这个字段');
  }
  if (!ALLOWED.some((key) => Object.hasOwn(body, key))) errors.set('body', '没有要修改的字段');

  if (Object.hasOwn(body, 'name')) {
    const result = parseText(body['name'], '名称', 60);
    if ('error' in result) errors.set('name', result.error);
    else patch.name = result.value;
  }
  if (Object.hasOwn(body, 'owner')) {
    const result = parseText(body['owner'], '负责人', 30);
    if ('error' in result) errors.set('owner', result.error);
    else patch.owner = result.value;
  }
  {
    const value = body['dueDate'];
    if (value === undefined || value === null || (typeof value === 'string' && isDate(value))) patch.dueDate = value;
    else errors.set('dueDate', '截止日期必须是 YYYY-MM-DD 格式的日期，或者 null');
  }
  if (Object.hasOwn(body, 'status')) {
    const status = STATUSES.find((s) => s === body['status']);
    if (status === undefined) errors.set('status', '状态必须是 planning、active、done 之一');
    else patch.status = status;
  }

  return errors.size > 0 ? { ok: false, errors: Object.fromEntries(errors) } : { ok: true, patch };
}
```
:::

