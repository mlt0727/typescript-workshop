---
kind: task
title: 筛选条件与查询参数互相转换
mode: ts
---
列表页的筛选条件要保存在地址的查询参数中。实现两个函数：

**`parseFilters(search)`**：`search` 是 `location.search` 这样的字符串（可能以 `?` 开头，也可能为空），返回 `Filters`：

- `q`：参数 `q` 的值去掉首尾空白；没有时为 `''`；
- `status`：参数 `status` 是 `'all'`、`'active'`、`'done'` 之一时取它，否则为 `'all'`；
- `page`：参数 `page` 只由数字 0–9 组成（所以一定是整数，`010` 按 10 处理）并且不小于 1 时，转换成数字，否则为 `1`。

**`toSearch(filters)`**：生成查询字符串。只包含**不是默认值**的参数（默认值是 `q: ''`、`status: 'all'`、`page: 1`），按 `q`、`status`、`page` 的顺序；`q` 先去掉首尾空白。全部是默认值时返回空字符串 `''`，否则以 `?` 开头。特殊字符要正确编码（用 `URLSearchParams`）。

:::files{role=starter}
```ts file=filters.ts
export type Status = 'all' | 'active' | 'done';
export type Filters = { q: string; status: Status; page: number };

export function parseFilters(search: string): Filters {
  return { q: '', status: 'all', page: 1 };
}

export function toSearch(filters: Filters): string {
  return `?q=${filters.q}&status=${filters.status}&page=${filters.page}`;
}
```
:::

:::files{role=solution}
```ts file=filters.ts
export type Status = 'all' | 'active' | 'done';
export type Filters = { q: string; status: Status; page: number };

function isStatus(value: string | null): value is Status {
  return value === 'all' || value === 'active' || value === 'done';
}

export function parseFilters(search: string): Filters {
  const params = new URLSearchParams(search);
  const status = params.get('status');
  const pageText = params.get('page') ?? '';
  const page = /^\d+$/.test(pageText) ? Number(pageText) : 1;
  return {
    q: (params.get('q') ?? '').trim(),
    status: isStatus(status) ? status : 'all',
    page: page >= 1 ? page : 1,
  };
}

export function toSearch(filters: Filters): string {
  const params = new URLSearchParams();
  const q = filters.q.trim();
  if (q !== '') params.set('q', q);
  if (filters.status !== 'all') params.set('status', filters.status);
  if (filters.page !== 1) params.set('page', String(filters.page));
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
}
```
:::

:::files{role=tests}
```ts file=filters.test.ts
import { describe, expect, test } from 'vitest';
import { parseFilters, toSearch, type Filters } from './filters';

describe('parseFilters', () => {
  test('空字符串得到默认值', () => {
    expect(parseFilters('')).toEqual({ q: '', status: 'all', page: 1 });
  });

  test('读取各个参数，有没有开头的 ? 都可以', () => {
    expect(parseFilters('?q=%20ts%20&status=done&page=3')).toEqual({ q: 'ts', status: 'done', page: 3 });
    expect(parseFilters('status=active')).toEqual({ q: '', status: 'active', page: 1 });
  });

  test('解码：+ 表示空格，%26 表示 &', () => {
    expect(parseFilters('?q=TypeScript+%26+React').q).toBe('TypeScript & React');
  });

  test('不合法的 status 和 page 退回默认值', () => {
    for (const page of ['0', '-2', '1.5', 'abc', '']) {
      expect(parseFilters(`?page=${page}`).page, `page=${page}`).toBe(1);
    }
    expect(parseFilters('?page=010').page).toBe(10);
    expect(parseFilters('?status=deleted').status).toBe('all');
  });
});

describe('toSearch', () => {
  test('全部是默认值时返回空字符串', () => {
    expect(toSearch({ q: '  ', status: 'all', page: 1 })).toBe('');
  });

  test('写入的搜索词也去掉了首尾空白', () => {
    expect(toSearch({ q: ' ts ', status: 'all', page: 1 })).toBe('?q=ts');
  });

  test('只包含非默认的参数，按 q、status、page 的顺序', () => {
    expect(toSearch({ q: 'ts', status: 'all', page: 2 })).toBe('?q=ts&page=2');
    expect(toSearch({ q: '', status: 'done', page: 1 })).toBe('?status=done');
    expect(toSearch({ q: 'dom', status: 'active', page: 4 })).toBe('?q=dom&status=active&page=4');
  });

  test('特殊字符被正确编码', () => {
    expect(toSearch({ q: 'C++ & 入门', status: 'all', page: 1 })).toBe('?q=C%2B%2B+%26+%E5%85%A5%E9%97%A8');
  });

  test('来回转换不丢信息', () => {
    const cases: Filters[] = [
      { q: 'a&b=c', status: 'active', page: 7 },
      { q: '', status: 'done', page: 1 },
      { q: '中文 搜索', status: 'all', page: 12 },
    ];
    for (const filters of cases) {
      expect(parseFilters(toSearch(filters))).toEqual(filters);
    }
  });
});
```
:::

:::hint{level=1}
两个方向都交给 `URLSearchParams`：`new URLSearchParams(search)` 解析（开头的 `?` 会被忽略，`+` 和 `%xx` 会被解码）；`new URLSearchParams()` 加上 `set(...)`，再 `toString()` 生成（特殊字符会被编码）。
:::

:::hint{level=2}
页码：`/^\d+$/.test(text)` 确认只有数字，再 `Number(text)`，最后检查不小于 1。生成时，只 `set` 与默认值不同的参数；`params.toString()` 为空就返回 `''`，否则前面加上 `?`。
:::

:::explanation
地址中的查询参数和其他外部数据一样，可能是任何值：用户可以手动修改地址栏，旧链接可能带着已经不存在的选项。所以 `parseFilters` 对每个参数都做了验证，不合法就退回默认值，而不是让页面出错（e06 的思路）。

`toSearch` 省略默认值，让地址保持简短：`/list` 和 `/list?status=all&page=1` 表示同样的内容，前者更干净，分享出去也更好看。固定参数的顺序，同样的筛选条件总是生成同样的地址。

两个方向都用 `URLSearchParams`，编码和解码的规则天然一致：`C++ & 入门` 会被编码成 `C%2B%2B+%26+%E5%85%A5%E9%97%A8`（`+` 本身被编码，空格变成 `+`），解析时再还原。手工拼接字符串时，`&` 会被当作参数的分隔符，`+` 会变成空格。
:::

:::variant{kind=alt name=entries-array}
```ts file=filters.ts
export type Status = 'all' | 'active' | 'done';
export type Filters = { q: string; status: Status; page: number };

export function parseFilters(search: string): Filters {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const statusText = params.get('status') ?? 'all';
  const status: Status = statusText === 'active' || statusText === 'done' ? statusText : 'all';
  const pageText = params.get('page');
  const page = pageText !== null && /^\d+$/.test(pageText) && Number(pageText) >= 1 ? Number(pageText) : 1;
  return { q: params.get('q')?.trim() ?? '', status, page };
}

export function toSearch(filters: Filters): string {
  const entries: [string, string][] = [];
  if (filters.q.trim()) entries.push(['q', filters.q.trim()]);
  if (filters.status !== 'all') entries.push(['status', filters.status]);
  if (filters.page !== 1) entries.push(['page', String(filters.page)]);
  return entries.length === 0 ? '' : `?${new URLSearchParams(entries)}`;
}
```
:::

:::variant{kind=wrong name=string-concat fails=tests reason="手工拼接查询字符串，特殊字符没有编码"}
```ts file=filters.ts
export type Status = 'all' | 'active' | 'done';
export type Filters = { q: string; status: Status; page: number };

export function parseFilters(search: string): Filters {
  const params = new URLSearchParams(search);
  const status = params.get('status');
  const pageText = params.get('page') ?? '';
  const page = /^\d+$/.test(pageText) ? Number(pageText) : 1;
  return {
    q: (params.get('q') ?? '').trim(),
    status: status === 'active' || status === 'done' ? status : 'all',
    page: page >= 1 ? page : 1,
  };
}

export function toSearch(filters: Filters): string {
  const parts: string[] = [];
  const q = filters.q.trim();
  if (q !== '') parts.push(`q=${q}`);
  if (filters.status !== 'all') parts.push(`status=${filters.status}`);
  if (filters.page !== 1) parts.push(`page=${filters.page}`);
  return parts.length === 0 ? '' : `?${parts.join('&')}`;
}
```
:::

:::variant{kind=wrong name=keep-defaults fails=tests reason="默认值也写进了地址"}
```ts file=filters.ts
export type Status = 'all' | 'active' | 'done';
export type Filters = { q: string; status: Status; page: number };

export function parseFilters(search: string): Filters {
  const params = new URLSearchParams(search);
  const status = params.get('status');
  const pageText = params.get('page') ?? '';
  const page = /^\d+$/.test(pageText) ? Number(pageText) : 1;
  return {
    q: (params.get('q') ?? '').trim(),
    status: status === 'active' || status === 'done' ? status : 'all',
    page: page >= 1 ? page : 1,
  };
}

export function toSearch(filters: Filters): string {
  const params = new URLSearchParams({ q: filters.q.trim(), status: filters.status, page: String(filters.page) });
  return `?${params}`;
}
```
:::

:::variant{kind=wrong name=loose-page fails=tests reason="页码直接用 Number 转换，没有检查格式和范围"}
```ts file=filters.ts
export type Status = 'all' | 'active' | 'done';
export type Filters = { q: string; status: Status; page: number };

export function parseFilters(search: string): Filters {
  const params = new URLSearchParams(search);
  const status = params.get('status');
  return {
    q: (params.get('q') ?? '').trim(),
    status: status === 'active' || status === 'done' ? status : 'all',
    page: Number(params.get('page') ?? '1') || 1,
  };
}

export function toSearch(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.q.trim() !== '') params.set('q', filters.q.trim());
  if (filters.status !== 'all') params.set('status', filters.status);
  if (filters.page !== 1) params.set('page', String(filters.page));
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
}
```
:::
