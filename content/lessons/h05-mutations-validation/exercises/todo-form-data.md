---
kind: task
title: 校验表单数据
---
在 `todo-form.ts` 中实现 `parseTodoForm(form)`：Server Function 收到的 `FormData` 可能来自页面上的表单，也可能是任何人直接发来的请求，每个值都要检查。规则：

1. **标题** `title`：`form.get('title')` 是文件时报错“标题必须是文本”；去掉首尾的空白之后为空（或者没有这个字段）时报错“请填写标题”；超过 100 个字符时报错“标题最多 100 个字”。字符数按码点算（`[...title].length`，一个表情算一个）；
2. **优先级** `priority`：没有这个字段或者是空字符串时是 `'normal'`；否则必须**正好**是 `'low'`、`'normal'`、`'high'` 之一（不去空白、区分大小写），不是时（包括文件）报错“优先级只能是 low、normal 或 high”；
3. **截止日期** `due`：没有这个字段，或者去掉首尾的空白之后为空时是 `null`；否则去掉空白之后必须是 `YYYY-MM-DD` 格式、并且是**真正存在**的日期（`2026-02-30` 不是），不是时（包括文件）报错“截止日期的格式是 YYYY-MM-DD”；
4. **标签** `tags`：同名的多个字段（`form.getAll('tags')`）。有文件时报错“标签必须是文本”；否则每个去掉首尾的空白，丢掉空的和重复的（保留第一次出现的顺序），超过 5 个时报错“最多 5 个标签”；
5. **完成** `done`：`form.get('done')` 正好是 `'on'` 时为 `true`，否则为 `false`（复选框选中时浏览器发送 `on`，没有选中时根本不发送这个字段）；
6. 单值的字段出现多次时只看第一个（`form.get` 的行为）。有任何错误时返回 `{ ok: false, errors }`，`errors` 中**只有**出错的字段，一次报告所有的错误；没有错误时返回 `{ ok: true, value }`，`value` 中**只有**上面这五个字段：表单中其他的字段（例如 `id`、`ownerId`）一律不要。

:::files{role=starter}
```ts file=todo-form.ts
export type Priority = 'low' | 'normal' | 'high';
export type TodoInput = Readonly<{ title: string; priority: Priority; due: string | null; tags: readonly string[]; done: boolean }>;
export type Field = 'title' | 'priority' | 'due' | 'tags';
export type ParseResult = { ok: true; value: TodoInput } | { ok: false; errors: Partial<Record<Field, string>> };

/** 校验来自表单的数据：FormData 中的每个值都可能是任何字符串，也可能是一个文件 */
export function parseTodoForm(form: FormData): ParseResult {
  // TODO
  return { ok: false, errors: {} };
}
```
```ts file=main.ts
import { parseTodoForm } from './todo-form';

// 一个正常的提交
const normal = new FormData();
normal.append('title', '  写周报 ');
normal.append('priority', 'high');
normal.append('due', '2026-10-31');
normal.append('tags', '工作');
normal.append('tags', '工作');
normal.append('done', 'on');
console.log(parseTodoForm(normal));

// 不经过页面、直接发来的请求：什么都可能有
const crafted = new FormData();
crafted.append('title', new File(['x'], 'x.txt'));
crafted.append('priority', 'urgent');
crafted.append('due', '2026-02-30');
crafted.append('ownerId', 'someone-else');
console.log(parseTodoForm(crafted));
```
:::

:::files{role=solution}
```ts file=todo-form.ts
export type Priority = 'low' | 'normal' | 'high';
export type TodoInput = Readonly<{ title: string; priority: Priority; due: string | null; tags: readonly string[]; done: boolean }>;
export type Field = 'title' | 'priority' | 'due' | 'tags';
export type ParseResult = { ok: true; value: TodoInput } | { ok: false; errors: Partial<Record<Field, string>> };

const PRIORITIES: readonly string[] = ['low', 'normal', 'high'];
const isPriority = (value: string): value is Priority => PRIORITIES.includes(value);

/** 只接受真正存在的日期：2026-02-30 这样的日期会被“进位”到 3 月，读回来就不一样了 */
function isCalendarDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  // setUTCFullYear 不会把 0 到 99 年当作 1900 到 1999 年（Date.UTC 会）
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** 校验来自表单的数据：FormData 中的每个值都可能是任何字符串，也可能是一个文件 */
export function parseTodoForm(form: FormData): ParseResult {
  const errors: Partial<Record<Field, string>> = {};

  const rawTitle = form.get('title');
  const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
  if (rawTitle instanceof File) errors.title = '标题必须是文本';
  else if (title === '') errors.title = '请填写标题';
  else if ([...title].length > 100) errors.title = '标题最多 100 个字';

  const rawPriority = form.get('priority') ?? '';
  let priority: Priority = 'normal';
  if (typeof rawPriority !== 'string' || (rawPriority !== '' && !isPriority(rawPriority))) {
    errors.priority = '优先级只能是 low、normal 或 high';
  } else if (rawPriority !== '') {
    priority = rawPriority;
  }

  const rawDue = form.get('due') ?? '';
  let due: string | null = null;
  if (typeof rawDue !== 'string') errors.due = '截止日期的格式是 YYYY-MM-DD';
  else if (rawDue.trim() !== '') {
    if (isCalendarDate(rawDue.trim())) due = rawDue.trim();
    else errors.due = '截止日期的格式是 YYYY-MM-DD';
  }

  const tags: string[] = [];
  for (const rawTag of form.getAll('tags')) {
    if (typeof rawTag !== 'string') {
      errors.tags = '标签必须是文本';
      continue;
    }
    const tag = rawTag.trim();
    if (tag !== '' && !tags.includes(tag)) tags.push(tag);
  }
  if (errors.tags === undefined && tags.length > 5) errors.tags = '最多 5 个标签';

  // 复选框选中时浏览器发送 on，没有选中时根本不发送
  const done = form.get('done') === 'on';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  // 只取认识的字段：客户端多发的 id、ownerId 不会进入结果
  return { ok: true, value: { title, priority, due, tags, done } };
}
```
```ts file=main.ts
import { parseTodoForm } from './todo-form';

// 一个正常的提交
const normal = new FormData();
normal.append('title', '  写周报 ');
normal.append('priority', 'high');
normal.append('due', '2026-10-31');
normal.append('tags', '工作');
normal.append('tags', '工作');
normal.append('done', 'on');
console.log(parseTodoForm(normal));

// 不经过页面、直接发来的请求：什么都可能有
const crafted = new FormData();
crafted.append('title', new File(['x'], 'x.txt'));
crafted.append('priority', 'urgent');
crafted.append('due', '2026-02-30');
crafted.append('ownerId', 'someone-else');
console.log(parseTodoForm(crafted));
```
:::

:::files{role=tests}
```ts file=todo-form.test.ts
import { describe, expect, test } from 'vitest';
import { parseTodoForm } from './todo-form';

/** 像浏览器那样构造表单数据：同一个名字可以出现多次 */
function form(entries: readonly (readonly [string, string | File])[]): FormData {
  const data = new FormData();
  for (const [name, value] of entries) data.append(name, value);
  return data;
}

const file = () => new File(['x'], 'evil.txt', { type: 'text/plain' });

describe('parseTodoForm', () => {
  test('最少的字段：标题；其他的取默认值', () => {
    expect(parseTodoForm(form([['title', '买牛奶']]))).toStrictEqual({
      ok: true,
      value: { title: '买牛奶', priority: 'normal', due: null, tags: [], done: false },
    });
  });

  test('所有的字段；去掉首尾的空白', () => {
    const data = form([
      ['title', '  写周报  '],
      ['priority', 'high'],
      ['due', ' 2026-10-31 '],
      ['tags', '工作'],
      ['tags', ' 每周 '],
      ['done', 'on'],
    ]);
    expect(parseTodoForm(data)).toStrictEqual({
      ok: true,
      value: { title: '写周报', priority: 'high', due: '2026-10-31', tags: ['工作', '每周'], done: true },
    });
  });

  test('标题：必须有，最多 100 个字（按字符数，不按 UTF-16 码元）', () => {
    expect(parseTodoForm(form([]))).toStrictEqual({ ok: false, errors: { title: '请填写标题' } });
    expect(parseTodoForm(form([['title', '   ']]))).toStrictEqual({ ok: false, errors: { title: '请填写标题' } });
    expect(parseTodoForm(form([['title', '字'.repeat(101)]]))).toStrictEqual({ ok: false, errors: { title: '标题最多 100 个字' } });
    expect(parseTodoForm(form([['title', '😀'.repeat(100)]])).ok).toBe(true);
  });

  test('客户端可以发送任何东西：文件不是文本', () => {
    expect(parseTodoForm(form([['title', file()]]))).toStrictEqual({ ok: false, errors: { title: '标题必须是文本' } });
    expect(parseTodoForm(form([['title', 'a'], ['priority', file()], ['due', file()], ['tags', file()]]))).toStrictEqual({
      ok: false,
      errors: { priority: '优先级只能是 low、normal 或 high', due: '截止日期的格式是 YYYY-MM-DD', tags: '标签必须是文本' },
    });
  });

  test('优先级：空的时候是 normal，其他的值必须正好是三个之一', () => {
    expect(parseTodoForm(form([['title', 'a'], ['priority', '']]))).toMatchObject({ ok: true, value: { priority: 'normal' } });
    for (const bad of ['urgent', 'High', ' high']) {
      expect(parseTodoForm(form([['title', 'a'], ['priority', bad]])), bad).toStrictEqual({ ok: false, errors: { priority: '优先级只能是 low、normal 或 high' } });
    }
  });

  test('截止日期：必须是真正存在的日期', () => {
    expect(parseTodoForm(form([['title', 'a'], ['due', '']]))).toMatchObject({ ok: true, value: { due: null } });
    expect(parseTodoForm(form([['title', 'a'], ['due', '2028-02-29']]))).toMatchObject({ ok: true, value: { due: '2028-02-29' } });
    for (const bad of ['2026-02-30', '2026-13-01', '2026-2-3', '10/31/2026', '2026-10-31T00:00']) {
      expect(parseTodoForm(form([['title', 'a'], ['due', bad]])), bad).toStrictEqual({ ok: false, errors: { due: '截止日期的格式是 YYYY-MM-DD' } });
    }
  });

  test('标签：同名的多个字段，去掉空的和重复的，最多 5 个', () => {
    const tags = (...values: string[]) => parseTodoForm(form([['title', 'a'], ...values.map((v) => ['tags', v] as const)]));
    expect(tags('a', '', ' a ', 'b')).toMatchObject({ ok: true, value: { tags: ['a', 'b'] } });
    expect(tags('1', '2', '3', '4', '5', '5', ' ')).toMatchObject({ ok: true, value: { tags: ['1', '2', '3', '4', '5'] } });
    expect(tags('1', '2', '3', '4', '5', '6')).toStrictEqual({ ok: false, errors: { tags: '最多 5 个标签' } });
  });

  test('复选框：只有值是 on 才算选中', () => {
    expect(parseTodoForm(form([['title', 'a'], ['done', 'on']]))).toMatchObject({ ok: true, value: { done: true } });
    expect(parseTodoForm(form([['title', 'a'], ['done', 'false']]))).toMatchObject({ ok: true, value: { done: false } });
  });

  test('一次报告所有的错误', () => {
    expect(parseTodoForm(form([['priority', 'x'], ['due', 'tomorrow']]))).toStrictEqual({
      ok: false,
      errors: { title: '请填写标题', priority: '优先级只能是 low、normal 或 high', due: '截止日期的格式是 YYYY-MM-DD' },
    });
  });

  test('不认识的字段不会进入结果：ownerId 应该来自登录的用户，而不是表单', () => {
    const result = parseTodoForm(form([['title', 'a'], ['ownerId', 'someone-else'], ['id', '42']]));
    expect(result).toStrictEqual({ ok: true, value: { title: 'a', priority: 'normal', due: null, tags: [], done: false } });
  });

  test('同名的单值字段：只看第一个', () => {
    expect(parseTodoForm(form([['title', '第一个'], ['title', '第二个']]))).toMatchObject({ ok: true, value: { title: '第一个' } });
  });
});
```
:::

:::hint{level=1}
`form.get(name)` 的类型是 `FormDataEntryValue | null`，也就是 `string | File | null`：先用 `typeof value === 'string'` 收窄，再处理文本；`value instanceof File` 判断文件。每个字段的错误写进同一个 `errors` 对象，最后看它是不是空的。
:::

:::hint{level=2}
日期先用 `/^(\d{4})-(\d{2})-(\d{2})$/` 取出年月日，再构造这一天的日期并读回来：`2026-02-30` 会被“进位”成 3 月 2 日，读回来的月和日就对不上了。构造时用 `setUTCFullYear(year, month - 1, day)`，避免时区和“0 到 99 年”的特殊处理。标签用 `includes` 或者 `Set` 去重。
:::

:::explanation
Server Function 的参数不是“页面上的表单交给你的数据”，而是“一个 HTTP 请求的请求体”。正文中实测：不经过页面、直接用 curl 发送同样的请求，函数照样运行。所以每个值都要按“任何人都可能发来任何东西”来检查：值可能缺少，可能是一个文件，可能是一个不在选项中的字符串，同名的字段可能出现很多次。

`value` 只包含认识的字段，这一点和校验同样重要。把 `Object.fromEntries(formData)` 整个交给数据库是一个常见的漏洞（批量赋值，mass assignment）：攻击者在表单中加一个 `ownerId` 或者 `role` 字段，就能修改本来不该由他决定的数据。谁拥有这条待办，应该来自登录的会话，而不是表单。

真实的项目中常用 Zod 这样的库写校验的规则，但 `FormData` 这一层的处理（`get` 与 `getAll`、文件、复选框）仍然要自己想清楚。e06 讲过运行时校验的一般做法，这里只是多了 `FormData` 的这些特点。

替代解为每个字段写一个小的检查函数，返回 `{ value }` 或者 `{ error }`，最后再组合起来。
:::

:::variant{kind=alt name=field-checks}
```ts file=todo-form.ts
export type Priority = 'low' | 'normal' | 'high';
export type TodoInput = Readonly<{ title: string; priority: Priority; due: string | null; tags: readonly string[]; done: boolean }>;
export type Field = 'title' | 'priority' | 'due' | 'tags';
export type ParseResult = { ok: true; value: TodoInput } | { ok: false; errors: Partial<Record<Field, string>> };

/** 每个字段一个小函数：成功时返回值，失败时返回错误信息 */
type Check<T> = (form: FormData) => { value: T } | { error: string };

/** 把 FormData 中的值变成去掉首尾空白的文本；文件、缺少的字段分别处理 */
const text = (value: FormDataEntryValue | null): string | null | File => (typeof value === 'string' ? value.trim() : value);

const checkTitle: Check<string> = (form) => {
  const value = text(form.get('title'));
  if (value instanceof File) return { error: '标题必须是文本' };
  if (value === null || value === '') return { error: '请填写标题' };
  return Array.from(value).length > 100 ? { error: '标题最多 100 个字' } : { value };
};

const checkPriority: Check<Priority> = (form) => {
  const value = form.get('priority');
  if (value === null || value === '') return { value: 'normal' };
  if (value === 'low' || value === 'normal' || value === 'high') return { value };
  return { error: '优先级只能是 low、normal 或 high' };
};

const checkDue: Check<string | null> = (form) => {
  const value = text(form.get('due'));
  if (value === null || value === '') return { value: null };
  if (value instanceof File || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { error: '截止日期的格式是 YYYY-MM-DD' };
  // 用 toISOString 往回转：不存在的日期（例如 2 月 30 日）转回来的结果不一样
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? { value } : { error: '截止日期的格式是 YYYY-MM-DD' };
};

const checkTags: Check<string[]> = (form) => {
  const values = form.getAll('tags');
  if (values.some((value) => typeof value !== 'string')) return { error: '标签必须是文本' };
  const tags = [...new Set(values.map((value) => text(value)).filter((tag): tag is string => typeof tag === 'string' && tag !== ''))];
  return tags.length > 5 ? { error: '最多 5 个标签' } : { value: tags };
};

/** 校验来自表单的数据：FormData 中的每个值都可能是任何字符串，也可能是一个文件 */
export function parseTodoForm(form: FormData): ParseResult {
  const title = checkTitle(form);
  const priority = checkPriority(form);
  const due = checkDue(form);
  const tags = checkTags(form);
  const errors: Partial<Record<Field, string>> = {};
  if ('error' in title) errors.title = title.error;
  if ('error' in priority) errors.priority = priority.error;
  if ('error' in due) errors.due = due.error;
  if ('error' in tags) errors.tags = tags.error;
  if ('error' in title || 'error' in priority || 'error' in due || 'error' in tags) return { ok: false, errors };
  return { ok: true, value: { title: title.value, priority: priority.value, due: due.value, tags: tags.value, done: form.get('done') === 'on' } };
}
```
:::

:::variant{kind=wrong name=no-trim fails=tests reason="标题没有去掉首尾的空白：只有空格的标题也通过了"}
```ts file=todo-form.ts
export type Priority = 'low' | 'normal' | 'high';
export type TodoInput = Readonly<{ title: string; priority: Priority; due: string | null; tags: readonly string[]; done: boolean }>;
export type Field = 'title' | 'priority' | 'due' | 'tags';
export type ParseResult = { ok: true; value: TodoInput } | { ok: false; errors: Partial<Record<Field, string>> };

const PRIORITIES: readonly string[] = ['low', 'normal', 'high'];
const isPriority = (value: string): value is Priority => PRIORITIES.includes(value);

/** 只接受真正存在的日期：2026-02-30 这样的日期会被“进位”到 3 月，读回来就不一样了 */
function isCalendarDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  // setUTCFullYear 不会把 0 到 99 年当作 1900 到 1999 年（Date.UTC 会）
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** 校验来自表单的数据：FormData 中的每个值都可能是任何字符串，也可能是一个文件 */
export function parseTodoForm(form: FormData): ParseResult {
  const errors: Partial<Record<Field, string>> = {};

  const rawTitle = form.get('title');
  const title = typeof rawTitle === 'string' ? rawTitle : '';
  if (rawTitle instanceof File) errors.title = '标题必须是文本';
  else if (title === '') errors.title = '请填写标题';
  else if ([...title].length > 100) errors.title = '标题最多 100 个字';

  const rawPriority = form.get('priority') ?? '';
  let priority: Priority = 'normal';
  if (typeof rawPriority !== 'string' || (rawPriority !== '' && !isPriority(rawPriority))) {
    errors.priority = '优先级只能是 low、normal 或 high';
  } else if (rawPriority !== '') {
    priority = rawPriority;
  }

  const rawDue = form.get('due') ?? '';
  let due: string | null = null;
  if (typeof rawDue !== 'string') errors.due = '截止日期的格式是 YYYY-MM-DD';
  else if (rawDue.trim() !== '') {
    if (isCalendarDate(rawDue.trim())) due = rawDue.trim();
    else errors.due = '截止日期的格式是 YYYY-MM-DD';
  }

  const tags: string[] = [];
  for (const rawTag of form.getAll('tags')) {
    if (typeof rawTag !== 'string') {
      errors.tags = '标签必须是文本';
      continue;
    }
    const tag = rawTag.trim();
    if (tag !== '' && !tags.includes(tag)) tags.push(tag);
  }
  if (errors.tags === undefined && tags.length > 5) errors.tags = '最多 5 个标签';

  // 复选框选中时浏览器发送 on，没有选中时根本不发送
  const done = form.get('done') === 'on';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  // 只取认识的字段：客户端多发的 id、ownerId 不会进入结果
  return { ok: true, value: { title, priority, due, tags, done } };
}
```
:::

:::variant{kind=wrong name=utf16-length fails=tests reason="用 length 数字数：一个表情占两个 UTF-16 码元，100 个表情的标题被拒绝了"}
```ts file=todo-form.ts
export type Priority = 'low' | 'normal' | 'high';
export type TodoInput = Readonly<{ title: string; priority: Priority; due: string | null; tags: readonly string[]; done: boolean }>;
export type Field = 'title' | 'priority' | 'due' | 'tags';
export type ParseResult = { ok: true; value: TodoInput } | { ok: false; errors: Partial<Record<Field, string>> };

const PRIORITIES: readonly string[] = ['low', 'normal', 'high'];
const isPriority = (value: string): value is Priority => PRIORITIES.includes(value);

/** 只接受真正存在的日期：2026-02-30 这样的日期会被“进位”到 3 月，读回来就不一样了 */
function isCalendarDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  // setUTCFullYear 不会把 0 到 99 年当作 1900 到 1999 年（Date.UTC 会）
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** 校验来自表单的数据：FormData 中的每个值都可能是任何字符串，也可能是一个文件 */
export function parseTodoForm(form: FormData): ParseResult {
  const errors: Partial<Record<Field, string>> = {};

  const rawTitle = form.get('title');
  const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
  if (rawTitle instanceof File) errors.title = '标题必须是文本';
  else if (title === '') errors.title = '请填写标题';
  else if (title.length > 100) errors.title = '标题最多 100 个字';

  const rawPriority = form.get('priority') ?? '';
  let priority: Priority = 'normal';
  if (typeof rawPriority !== 'string' || (rawPriority !== '' && !isPriority(rawPriority))) {
    errors.priority = '优先级只能是 low、normal 或 high';
  } else if (rawPriority !== '') {
    priority = rawPriority;
  }

  const rawDue = form.get('due') ?? '';
  let due: string | null = null;
  if (typeof rawDue !== 'string') errors.due = '截止日期的格式是 YYYY-MM-DD';
  else if (rawDue.trim() !== '') {
    if (isCalendarDate(rawDue.trim())) due = rawDue.trim();
    else errors.due = '截止日期的格式是 YYYY-MM-DD';
  }

  const tags: string[] = [];
  for (const rawTag of form.getAll('tags')) {
    if (typeof rawTag !== 'string') {
      errors.tags = '标签必须是文本';
      continue;
    }
    const tag = rawTag.trim();
    if (tag !== '' && !tags.includes(tag)) tags.push(tag);
  }
  if (errors.tags === undefined && tags.length > 5) errors.tags = '最多 5 个标签';

  // 复选框选中时浏览器发送 on，没有选中时根本不发送
  const done = form.get('done') === 'on';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  // 只取认识的字段：客户端多发的 id、ownerId 不会进入结果
  return { ok: true, value: { title, priority, due, tags, done } };
}
```
:::

:::variant{kind=wrong name=string-coercion fails=tests reason="用 String() 把值变成文本：上传的文件变成了标题 '[object File]'"}
```ts file=todo-form.ts
export type Priority = 'low' | 'normal' | 'high';
export type TodoInput = Readonly<{ title: string; priority: Priority; due: string | null; tags: readonly string[]; done: boolean }>;
export type Field = 'title' | 'priority' | 'due' | 'tags';
export type ParseResult = { ok: true; value: TodoInput } | { ok: false; errors: Partial<Record<Field, string>> };

const PRIORITIES: readonly string[] = ['low', 'normal', 'high'];
const isPriority = (value: string): value is Priority => PRIORITIES.includes(value);

/** 只接受真正存在的日期：2026-02-30 这样的日期会被“进位”到 3 月，读回来就不一样了 */
function isCalendarDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  // setUTCFullYear 不会把 0 到 99 年当作 1900 到 1999 年（Date.UTC 会）
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** 校验来自表单的数据：FormData 中的每个值都可能是任何字符串，也可能是一个文件 */
export function parseTodoForm(form: FormData): ParseResult {
  const errors: Partial<Record<Field, string>> = {};

  const rawTitle = form.get('title');
  const title = String(rawTitle ?? '').trim();
  if (title === '') errors.title = '请填写标题';
  else if ([...title].length > 100) errors.title = '标题最多 100 个字';

  const rawPriority = form.get('priority') ?? '';
  let priority: Priority = 'normal';
  if (typeof rawPriority !== 'string' || (rawPriority !== '' && !isPriority(rawPriority))) {
    errors.priority = '优先级只能是 low、normal 或 high';
  } else if (rawPriority !== '') {
    priority = rawPriority;
  }

  const rawDue = form.get('due') ?? '';
  let due: string | null = null;
  if (typeof rawDue !== 'string') errors.due = '截止日期的格式是 YYYY-MM-DD';
  else if (rawDue.trim() !== '') {
    if (isCalendarDate(rawDue.trim())) due = rawDue.trim();
    else errors.due = '截止日期的格式是 YYYY-MM-DD';
  }

  const tags: string[] = [];
  for (const rawTag of form.getAll('tags')) {
    if (typeof rawTag !== 'string') {
      errors.tags = '标签必须是文本';
      continue;
    }
    const tag = rawTag.trim();
    if (tag !== '' && !tags.includes(tag)) tags.push(tag);
  }
  if (errors.tags === undefined && tags.length > 5) errors.tags = '最多 5 个标签';

  // 复选框选中时浏览器发送 on，没有选中时根本不发送
  const done = form.get('done') === 'on';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  // 只取认识的字段：客户端多发的 id、ownerId 不会进入结果
  return { ok: true, value: { title, priority, due, tags, done } };
}
```
:::

:::variant{kind=wrong name=regex-only-date fails=tests reason="日期只检查了格式：2026-02-30 这样不存在的日期也通过了"}
```ts file=todo-form.ts
export type Priority = 'low' | 'normal' | 'high';
export type TodoInput = Readonly<{ title: string; priority: Priority; due: string | null; tags: readonly string[]; done: boolean }>;
export type Field = 'title' | 'priority' | 'due' | 'tags';
export type ParseResult = { ok: true; value: TodoInput } | { ok: false; errors: Partial<Record<Field, string>> };

const PRIORITIES: readonly string[] = ['low', 'normal', 'high'];
const isPriority = (value: string): value is Priority => PRIORITIES.includes(value);

/** 只接受真正存在的日期：2026-02-30 这样的日期会被“进位”到 3 月，读回来就不一样了 */
function isCalendarDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  // setUTCFullYear 不会把 0 到 99 年当作 1900 到 1999 年（Date.UTC 会）
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** 校验来自表单的数据：FormData 中的每个值都可能是任何字符串，也可能是一个文件 */
export function parseTodoForm(form: FormData): ParseResult {
  const errors: Partial<Record<Field, string>> = {};

  const rawTitle = form.get('title');
  const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
  if (rawTitle instanceof File) errors.title = '标题必须是文本';
  else if (title === '') errors.title = '请填写标题';
  else if ([...title].length > 100) errors.title = '标题最多 100 个字';

  const rawPriority = form.get('priority') ?? '';
  let priority: Priority = 'normal';
  if (typeof rawPriority !== 'string' || (rawPriority !== '' && !isPriority(rawPriority))) {
    errors.priority = '优先级只能是 low、normal 或 high';
  } else if (rawPriority !== '') {
    priority = rawPriority;
  }

  const rawDue = form.get('due') ?? '';
  let due: string | null = null;
  if (typeof rawDue !== 'string') errors.due = '截止日期的格式是 YYYY-MM-DD';
  else if (rawDue.trim() !== '') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDue.trim())) due = rawDue.trim();
    else errors.due = '截止日期的格式是 YYYY-MM-DD';
  }

  const tags: string[] = [];
  for (const rawTag of form.getAll('tags')) {
    if (typeof rawTag !== 'string') {
      errors.tags = '标签必须是文本';
      continue;
    }
    const tag = rawTag.trim();
    if (tag !== '' && !tags.includes(tag)) tags.push(tag);
  }
  if (errors.tags === undefined && tags.length > 5) errors.tags = '最多 5 个标签';

  // 复选框选中时浏览器发送 on，没有选中时根本不发送
  const done = form.get('done') === 'on';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  // 只取认识的字段：客户端多发的 id、ownerId 不会进入结果
  return { ok: true, value: { title, priority, due, tags, done } };
}
```
:::

:::variant{kind=wrong name=first-tag-only fails=tests reason="用 get 读取标签：同名的字段只读到了第一个"}
```ts file=todo-form.ts
export type Priority = 'low' | 'normal' | 'high';
export type TodoInput = Readonly<{ title: string; priority: Priority; due: string | null; tags: readonly string[]; done: boolean }>;
export type Field = 'title' | 'priority' | 'due' | 'tags';
export type ParseResult = { ok: true; value: TodoInput } | { ok: false; errors: Partial<Record<Field, string>> };

const PRIORITIES: readonly string[] = ['low', 'normal', 'high'];
const isPriority = (value: string): value is Priority => PRIORITIES.includes(value);

/** 只接受真正存在的日期：2026-02-30 这样的日期会被“进位”到 3 月，读回来就不一样了 */
function isCalendarDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  // setUTCFullYear 不会把 0 到 99 年当作 1900 到 1999 年（Date.UTC 会）
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** 校验来自表单的数据：FormData 中的每个值都可能是任何字符串，也可能是一个文件 */
export function parseTodoForm(form: FormData): ParseResult {
  const errors: Partial<Record<Field, string>> = {};

  const rawTitle = form.get('title');
  const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
  if (rawTitle instanceof File) errors.title = '标题必须是文本';
  else if (title === '') errors.title = '请填写标题';
  else if ([...title].length > 100) errors.title = '标题最多 100 个字';

  const rawPriority = form.get('priority') ?? '';
  let priority: Priority = 'normal';
  if (typeof rawPriority !== 'string' || (rawPriority !== '' && !isPriority(rawPriority))) {
    errors.priority = '优先级只能是 low、normal 或 high';
  } else if (rawPriority !== '') {
    priority = rawPriority;
  }

  const rawDue = form.get('due') ?? '';
  let due: string | null = null;
  if (typeof rawDue !== 'string') errors.due = '截止日期的格式是 YYYY-MM-DD';
  else if (rawDue.trim() !== '') {
    if (isCalendarDate(rawDue.trim())) due = rawDue.trim();
    else errors.due = '截止日期的格式是 YYYY-MM-DD';
  }

  const tags: string[] = [];
  for (const rawTag of [form.get('tags') ?? '']) {
    if (typeof rawTag !== 'string') {
      errors.tags = '标签必须是文本';
      continue;
    }
    const tag = rawTag.trim();
    if (tag !== '' && !tags.includes(tag)) tags.push(tag);
  }
  if (errors.tags === undefined && tags.length > 5) errors.tags = '最多 5 个标签';

  // 复选框选中时浏览器发送 on，没有选中时根本不发送
  const done = form.get('done') === 'on';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  // 只取认识的字段：客户端多发的 id、ownerId 不会进入结果
  return { ok: true, value: { title, priority, due, tags, done } };
}
```
:::

:::variant{kind=wrong name=all-fields fails=tests reason="把表单中的所有字段都放进了结果：客户端多发的 ownerId 也被带进了数据（批量赋值）"}
```ts file=todo-form.ts
export type Priority = 'low' | 'normal' | 'high';
export type TodoInput = Readonly<{ title: string; priority: Priority; due: string | null; tags: readonly string[]; done: boolean }>;
export type Field = 'title' | 'priority' | 'due' | 'tags';
export type ParseResult = { ok: true; value: TodoInput } | { ok: false; errors: Partial<Record<Field, string>> };

const PRIORITIES: readonly string[] = ['low', 'normal', 'high'];
const isPriority = (value: string): value is Priority => PRIORITIES.includes(value);

/** 只接受真正存在的日期：2026-02-30 这样的日期会被“进位”到 3 月，读回来就不一样了 */
function isCalendarDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  // setUTCFullYear 不会把 0 到 99 年当作 1900 到 1999 年（Date.UTC 会）
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** 校验来自表单的数据：FormData 中的每个值都可能是任何字符串，也可能是一个文件 */
export function parseTodoForm(form: FormData): ParseResult {
  const errors: Partial<Record<Field, string>> = {};

  const rawTitle = form.get('title');
  const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
  if (rawTitle instanceof File) errors.title = '标题必须是文本';
  else if (title === '') errors.title = '请填写标题';
  else if ([...title].length > 100) errors.title = '标题最多 100 个字';

  const rawPriority = form.get('priority') ?? '';
  let priority: Priority = 'normal';
  if (typeof rawPriority !== 'string' || (rawPriority !== '' && !isPriority(rawPriority))) {
    errors.priority = '优先级只能是 low、normal 或 high';
  } else if (rawPriority !== '') {
    priority = rawPriority;
  }

  const rawDue = form.get('due') ?? '';
  let due: string | null = null;
  if (typeof rawDue !== 'string') errors.due = '截止日期的格式是 YYYY-MM-DD';
  else if (rawDue.trim() !== '') {
    if (isCalendarDate(rawDue.trim())) due = rawDue.trim();
    else errors.due = '截止日期的格式是 YYYY-MM-DD';
  }

  const tags: string[] = [];
  for (const rawTag of form.getAll('tags')) {
    if (typeof rawTag !== 'string') {
      errors.tags = '标签必须是文本';
      continue;
    }
    const tag = rawTag.trim();
    if (tag !== '' && !tags.includes(tag)) tags.push(tag);
  }
  if (errors.tags === undefined && tags.length > 5) errors.tags = '最多 5 个标签';

  // 复选框选中时浏览器发送 on，没有选中时根本不发送
  const done = form.get('done') === 'on';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  // 只取认识的字段：客户端多发的 id、ownerId 不会进入结果
  return { ok: true, value: { ...Object.fromEntries(form), title, priority, due, tags, done } };
}
```
:::

:::variant{kind=wrong name=has-done fails=tests reason="用 has 判断复选框：客户端发来 done=false 也被当成了选中"}
```ts file=todo-form.ts
export type Priority = 'low' | 'normal' | 'high';
export type TodoInput = Readonly<{ title: string; priority: Priority; due: string | null; tags: readonly string[]; done: boolean }>;
export type Field = 'title' | 'priority' | 'due' | 'tags';
export type ParseResult = { ok: true; value: TodoInput } | { ok: false; errors: Partial<Record<Field, string>> };

const PRIORITIES: readonly string[] = ['low', 'normal', 'high'];
const isPriority = (value: string): value is Priority => PRIORITIES.includes(value);

/** 只接受真正存在的日期：2026-02-30 这样的日期会被“进位”到 3 月，读回来就不一样了 */
function isCalendarDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  // setUTCFullYear 不会把 0 到 99 年当作 1900 到 1999 年（Date.UTC 会）
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** 校验来自表单的数据：FormData 中的每个值都可能是任何字符串，也可能是一个文件 */
export function parseTodoForm(form: FormData): ParseResult {
  const errors: Partial<Record<Field, string>> = {};

  const rawTitle = form.get('title');
  const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
  if (rawTitle instanceof File) errors.title = '标题必须是文本';
  else if (title === '') errors.title = '请填写标题';
  else if ([...title].length > 100) errors.title = '标题最多 100 个字';

  const rawPriority = form.get('priority') ?? '';
  let priority: Priority = 'normal';
  if (typeof rawPriority !== 'string' || (rawPriority !== '' && !isPriority(rawPriority))) {
    errors.priority = '优先级只能是 low、normal 或 high';
  } else if (rawPriority !== '') {
    priority = rawPriority;
  }

  const rawDue = form.get('due') ?? '';
  let due: string | null = null;
  if (typeof rawDue !== 'string') errors.due = '截止日期的格式是 YYYY-MM-DD';
  else if (rawDue.trim() !== '') {
    if (isCalendarDate(rawDue.trim())) due = rawDue.trim();
    else errors.due = '截止日期的格式是 YYYY-MM-DD';
  }

  const tags: string[] = [];
  for (const rawTag of form.getAll('tags')) {
    if (typeof rawTag !== 'string') {
      errors.tags = '标签必须是文本';
      continue;
    }
    const tag = rawTag.trim();
    if (tag !== '' && !tags.includes(tag)) tags.push(tag);
  }
  if (errors.tags === undefined && tags.length > 5) errors.tags = '最多 5 个标签';

  // 复选框选中时浏览器发送 on，没有选中时根本不发送
  const done = form.has('done');

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  // 只取认识的字段：客户端多发的 id、ownerId 不会进入结果
  return { ok: true, value: { title, priority, due, tags, done } };
}
```
:::

