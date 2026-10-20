---
kind: challenge
title: 访问记录统计
---
网站的访问记录是 `{ user: string; page: string }` 的数组，按时间先后排列。同一个用户可能多次访问同一个页面。实现三个函数：

- `uniqueVisitors(visits)`：有多少个**不同的**用户。
- `pagesByUser(visits)`：返回 `Map<string, string[]>`：每个用户访问过的**不同**页面，按该用户第一次访问的先后排列；Map 中用户的顺序是用户第一次出现的顺序。
- `commonPages(visits, a, b)`：用户 `a` 和用户 `b` **都**访问过的页面，按 `localeCompare` 排序后返回数组；任一用户没有记录时返回空数组。

都不能修改传入的数组。

:::files{role=starter}
```ts file=visits.ts
type Visit = { user: string; page: string };

export function uniqueVisitors(visits: readonly Visit[]): number {
  return visits.length;
}

export function pagesByUser(visits: readonly Visit[]): Map<string, string[]> {
  return new Map();
}

export function commonPages(visits: readonly Visit[], a: string, b: string): string[] {
  return [];
}
```
:::

:::files{role=solution}
```ts file=visits.ts
type Visit = { user: string; page: string };

export function uniqueVisitors(visits: readonly Visit[]): number {
  return new Set(visits.map((v) => v.user)).size;
}

export function pagesByUser(visits: readonly Visit[]): Map<string, string[]> {
  const pages = new Map<string, Set<string>>();
  for (const { user, page } of visits) {
    const seen = pages.get(user) ?? new Set<string>();
    seen.add(page);
    pages.set(user, seen);
  }
  const result = new Map<string, string[]>();
  for (const [user, seen] of pages) {
    result.set(user, [...seen]);
  }
  return result;
}

export function commonPages(visits: readonly Visit[], a: string, b: string): string[] {
  const byUser = pagesByUser(visits);
  const pagesA = new Set(byUser.get(a) ?? []);
  const pagesB = new Set(byUser.get(b) ?? []);
  return [...pagesA.intersection(pagesB)].toSorted((x, y) => x.localeCompare(y));
}
```
:::

:::files{role=tests}
```ts file=visits.test.ts
import { describe, expect, test } from 'vitest';
import { commonPages, pagesByUser, uniqueVisitors } from './visits';

const visits = [
  { user: 'ada', page: '/home' },
  { user: 'bob', page: '/pricing' },
  { user: 'ada', page: '/docs' },
  { user: 'ada', page: '/home' },
  { user: 'bob', page: '/docs' },
  { user: 'cy', page: '/home' },
  { user: 'bob', page: '/home' },
];

describe('uniqueVisitors', () => {
  test('不同用户的数量', () => {
    expect(uniqueVisitors(visits)).toBe(3);
  });

  test('没有记录', () => {
    expect(uniqueVisitors([])).toBe(0);
  });
});

describe('pagesByUser', () => {
  test('每个用户的不同页面，保持首次访问的顺序', () => {
    expect([...pagesByUser(visits)]).toEqual([
      ['ada', ['/home', '/docs']],
      ['bob', ['/pricing', '/docs', '/home']],
      ['cy', ['/home']],
    ]);
  });
});

describe('commonPages', () => {
  test('两人都访问过的页面，排序后返回', () => {
    expect(commonPages(visits, 'ada', 'bob')).toEqual(['/docs', '/home']);
    expect(commonPages(visits, 'bob', 'cy')).toEqual(['/home']);
  });

  test('没有记录的用户', () => {
    expect(commonPages(visits, 'ada', 'nobody')).toEqual([]);
  });
});

test('不修改传入的数组', () => {
  const copy = structuredClone(visits);
  uniqueVisitors(visits);
  pagesByUser(visits);
  commonPages(visits, 'ada', 'bob');
  expect(visits).toEqual(copy);
});
```
:::

:::hint{level=1}
不同用户的数量：把所有用户名放进一个 `Set`，看它的 `size`。每个用户的不同页面：用一个 `Map`，键是用户名，值是这个用户访问过的页面（用 `Set` 去重，最后再转成数组）。共同页面：两个用户的页面集合求交集。
:::

:::hint{level=2}
`pagesByUser` 里，`const seen = pages.get(user) ?? new Set<string>(); seen.add(page); pages.set(user, seen);`。`commonPages` 可以复用 `pagesByUser`，然后 `new Set(列表 ?? []).intersection(另一个集合)`，再展开成数组并用 `toSorted((x, y) => x.localeCompare(y))` 排序。
:::

:::explanation
三个函数都建立在“用合适的集合表达问题”上：

- “不同的用户”就是用户名的 Set，大小即答案。
- “每个用户的不同页面”需要按用户分组（Map）并在组内去重（Set）。Set 保持插入顺序，所以转成数组后正好是首次访问的顺序。
- “都访问过”就是交集。

`pages.get(user) ?? new Set<string>()` 处理了第一次遇到某个用户的情况。Set 是对象，`seen.add(page)` 修改的就是 Map 里保存的那一个（a11 的引用），最后的 `pages.set` 只在新建时才是必要的，写上也没有坏处。

交集的结果顺序取决于集合内部的实现细节，规格要求排序，所以最后用 `toSorted` 排一次。
:::

:::variant{kind=alt name=arrays-and-includes}
```ts file=visits.ts
type Visit = { user: string; page: string };

export function uniqueVisitors(visits: readonly Visit[]): number {
  const users: string[] = [];
  for (const v of visits) {
    if (!users.includes(v.user)) users.push(v.user);
  }
  return users.length;
}

export function pagesByUser(visits: readonly Visit[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const v of visits) {
    const list = result.get(v.user);
    if (list === undefined) {
      result.set(v.user, [v.page]);
    } else if (!list.includes(v.page)) {
      list.push(v.page);
    }
  }
  return result;
}

export function commonPages(visits: readonly Visit[], a: string, b: string): string[] {
  const byUser = pagesByUser(visits);
  const pagesB = byUser.get(b) ?? [];
  return (byUser.get(a) ?? []).filter((p) => pagesB.includes(p)).toSorted((x, y) => x.localeCompare(y));
}
```
:::

:::variant{kind=wrong name=count-visits fails=tests reason="统计的是访问次数，不是不同用户的数量"}
```ts file=visits.ts
type Visit = { user: string; page: string };

export function uniqueVisitors(visits: readonly Visit[]): number {
  return visits.length;
}

export function pagesByUser(visits: readonly Visit[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const v of visits) {
    const list = result.get(v.user) ?? [];
    if (!list.includes(v.page)) list.push(v.page);
    result.set(v.user, list);
  }
  return result;
}

export function commonPages(visits: readonly Visit[], a: string, b: string): string[] {
  const byUser = pagesByUser(visits);
  const pagesB = byUser.get(b) ?? [];
  return (byUser.get(a) ?? []).filter((p) => pagesB.includes(p)).toSorted((x, y) => x.localeCompare(y));
}
```
:::

:::variant{kind=wrong name=no-dedupe fails=tests reason="没有对每个用户的页面去重"}
```ts file=visits.ts
type Visit = { user: string; page: string };

export function uniqueVisitors(visits: readonly Visit[]): number {
  return new Set(visits.map((v) => v.user)).size;
}

export function pagesByUser(visits: readonly Visit[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const v of visits) {
    result.set(v.user, [...(result.get(v.user) ?? []), v.page]);
  }
  return result;
}

export function commonPages(visits: readonly Visit[], a: string, b: string): string[] {
  const byUser = pagesByUser(visits);
  const pagesB = new Set(byUser.get(b) ?? []);
  return [...new Set(byUser.get(a) ?? []).intersection(pagesB)].toSorted((x, y) => x.localeCompare(y));
}
```
:::

:::variant{kind=wrong name=union-instead fails=tests reason="求的是并集，不是交集"}
```ts file=visits.ts
type Visit = { user: string; page: string };

export function uniqueVisitors(visits: readonly Visit[]): number {
  return new Set(visits.map((v) => v.user)).size;
}

export function pagesByUser(visits: readonly Visit[]): Map<string, string[]> {
  const pages = new Map<string, Set<string>>();
  for (const { user, page } of visits) {
    const seen = pages.get(user) ?? new Set<string>();
    seen.add(page);
    pages.set(user, seen);
  }
  const result = new Map<string, string[]>();
  for (const [user, seen] of pages) {
    result.set(user, [...seen]);
  }
  return result;
}

export function commonPages(visits: readonly Visit[], a: string, b: string): string[] {
  const byUser = pagesByUser(visits);
  const pagesA = new Set(byUser.get(a) ?? []);
  const pagesB = new Set(byUser.get(b) ?? []);
  return [...pagesA.union(pagesB)].toSorted((x, y) => x.localeCompare(y));
}
```
:::
