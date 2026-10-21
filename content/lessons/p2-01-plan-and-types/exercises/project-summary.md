---
kind: task
title: 项目的进度与截止日期
---
在 `summary.ts` 中实现 `summarize(project, today)`，算出列表页上要显示的数据（`model.ts`、`sample.ts` 只读）：

1. `done`、`total`：完成的任务数和任务总数；
2. `percent`：完成的百分比，**向下取整**（3 个完成了 2 个是 66）；没有任务时是 0；
3. `daysLeft`：从 `today` 到截止日期还有几天，按**日历**计算（当天是 0，过期时是负数）；没有截止日期时是 `null`；
4. `overdue`：项目还没有完成（状态不是 `'done'`），并且截止日期在今天**之前**（截止日期当天不算过期）。

`today` 和截止日期都是 `YYYY-MM-DD` 格式，可以认为它们都是正确的日期。

:::files{role=support}
```ts file=model.ts readonly
/** 项目的三种状态：计划中、进行中、已完成 */
export const STATUSES = ['planning', 'active', 'done'] as const;
export type ProjectStatus = (typeof STATUSES)[number];

export const STATUS_NAMES: Readonly<Record<ProjectStatus, string>> = { planning: '计划中', active: '进行中', done: '已完成' };

export type Task = Readonly<{ id: string; title: string; done: boolean }>;

export type Project = Readonly<{
  id: string;
  name: string;
  owner: string;
  status: ProjectStatus;
  /** 截止日期，格式是 YYYY-MM-DD；没有截止日期时是 null */
  dueDate: string | null;
  tasks: readonly Task[];
}>;
```
```ts file=sample.ts readonly
import type { Project } from './model';

export const SAMPLE: Project = {
  id: 'p1',
  name: '官网改版',
  owner: '小林',
  status: 'active',
  dueDate: '2026-11-15',
  tasks: [
    { id: 't1', title: '整理需求', done: true },
    { id: 't2', title: '设计稿', done: false },
    { id: 't3', title: '写文案', done: false },
  ],
};
```
:::

:::files{role=starter}
```ts file=summary.ts
import type { Project } from './model';

export type Summary = Readonly<{
  done: number;
  total: number;
  /** 完成的百分比，向下取整；没有任务时是 0 */
  percent: number;
  /** 还没有完成，并且截止日期在今天之前 */
  overdue: boolean;
  /** 从今天到截止日期还有几天（过期时是负数）；没有截止日期时是 null */
  daysLeft: number | null;
}>;

/** today 和 project.dueDate 都是 'YYYY-MM-DD' */
export function summarize(project: Project, today: string): Summary {
  const done = project.tasks.filter((t) => t.done).length;
  return { done, total: project.tasks.length, percent: 0, overdue: false, daysLeft: null };
}
```
```ts file=main.ts
import { SAMPLE } from './sample';
import { summarize } from './summary';

console.log(summarize(SAMPLE, '2026-10-20'));
console.log(summarize({ ...SAMPLE, dueDate: '2026-10-18' }, '2026-10-20'));
```
:::

:::files{role=solution}
```ts file=summary.ts
import type { Project } from './model';

export type Summary = Readonly<{
  done: number;
  total: number;
  /** 完成的百分比，向下取整；没有任务时是 0 */
  percent: number;
  /** 还没有完成，并且截止日期在今天之前 */
  overdue: boolean;
  /** 从今天到截止日期还有几天（过期时是负数）；没有截止日期时是 null */
  daysLeft: number | null;
}>;

const DAY = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' 这一天的 UTC 零点（毫秒）：按 UTC 计算，不受时区和夏令时的影响 */
function utcDay(date: string): number {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

/** today 和 project.dueDate 都是 'YYYY-MM-DD' */
export function summarize(project: Project, today: string): Summary {
  const total = project.tasks.length;
  const done = project.tasks.filter((t) => t.done).length;
  const percent = total === 0 ? 0 : Math.floor((done / total) * 100);
  const daysLeft = project.dueDate === null ? null : Math.round((utcDay(project.dueDate) - utcDay(today)) / DAY);
  const overdue = project.status !== 'done' && daysLeft !== null && daysLeft < 0;
  return { done, total, percent, overdue, daysLeft };
}
```
```ts file=main.ts
import { SAMPLE } from './sample';
import { summarize } from './summary';

console.log(summarize(SAMPLE, '2026-10-20'));
console.log(summarize({ ...SAMPLE, dueDate: '2026-10-18' }, '2026-10-20'));
```
:::

:::files{role=tests}
```ts file=summary.test.ts
import { describe, expect, test } from 'vitest';
import type { Project, Task } from './model';
import { summarize } from './summary';

const task = (id: string, done: boolean): Task => ({ id, title: `任务 ${id}`, done });
const project = (more: Partial<Project> = {}): Project => ({
  id: 'p1',
  name: '官网改版',
  owner: '小林',
  status: 'active',
  dueDate: '2026-11-15',
  tasks: [task('a', true), task('b', false), task('c', false)],
  ...more,
});

describe('summarize', () => {
  test('完成的数量、总数和百分比（向下取整）', () => {
    expect(summarize(project(), '2026-10-20')).toMatchObject({ done: 1, total: 3, percent: 33 });
    expect(summarize(project({ tasks: [task('a', true), task('b', true), task('c', false)] }), '2026-10-20')).toMatchObject({ percent: 66 });
    expect(summarize(project({ tasks: [task('a', true)] }), '2026-10-20')).toMatchObject({ done: 1, total: 1, percent: 100 });
  });

  test('没有任务时百分比是 0', () => {
    expect(summarize(project({ tasks: [] }), '2026-10-20')).toMatchObject({ done: 0, total: 0, percent: 0 });
  });

  test('还有几天：当天是 0，过期是负数，没有截止日期是 null', () => {
    expect(summarize(project(), '2026-10-20').daysLeft).toBe(26);
    expect(summarize(project({ dueDate: '2026-10-20' }), '2026-10-20').daysLeft).toBe(0);
    expect(summarize(project({ dueDate: '2026-10-18' }), '2026-10-20').daysLeft).toBe(-2);
    expect(summarize(project({ dueDate: null }), '2026-10-20').daysLeft).toBeNull();
  });

  test('跨月、跨年、闰年都按日历计算', () => {
    expect(summarize(project({ dueDate: '2027-01-02' }), '2026-12-30').daysLeft).toBe(3);
    expect(summarize(project({ dueDate: '2028-03-01' }), '2028-02-28').daysLeft).toBe(2);
    expect(summarize(project({ dueDate: '2027-03-01' }), '2027-02-28').daysLeft).toBe(1);
    // 很多地区在 3 月、11 月切换夏令时，这一天只有 23 或 25 个小时；按日历计算不受影响
    expect(summarize(project({ dueDate: '2026-11-02' }), '2026-10-31').daysLeft).toBe(2);
    expect(summarize(project({ dueDate: '2027-03-15' }), '2027-03-13').daysLeft).toBe(2);
  });

  test('过期：没有完成，并且截止日期在今天之前（当天不算）', () => {
    expect(summarize(project({ dueDate: '2026-10-19' }), '2026-10-20').overdue).toBe(true);
    expect(summarize(project({ dueDate: '2026-10-20' }), '2026-10-20').overdue).toBe(false);
    expect(summarize(project({ dueDate: '2026-10-19', status: 'done' }), '2026-10-20').overdue).toBe(false);
    expect(summarize(project({ dueDate: '2026-10-19', status: 'planning' }), '2026-10-20').overdue).toBe(true);
    expect(summarize(project({ dueDate: null }), '2026-10-20').overdue).toBe(false);
  });
});
```
:::

:::hint{level=1}
百分比用 `Math.floor(done / total * 100)`，`total` 为 0 时单独处理（0 / 0 是 `NaN`）。天数可以用正文示例中的 `utcDay`：把 `'2026-10-20'` 分成年、月、日，交给 `Date.UTC(年, 月 - 1, 日)`，两天相减再除以一天的毫秒数。
:::

:::hint{level=2}
过期的条件有三个：状态不是 `'done'`、有截止日期、`daysLeft < 0`。注意是 `< 0` 而不是 `<= 0`：截止日期当天还没有过期。也可以直接比较字符串：`dueDate < today`。
:::

:::explanation
这几个值都是从 `project` 和 `today` **算出来**的，所以写成一个纯函数，而不是存在项目里。列表页、详情页都调用它，结果总是一致的。

`today` 作为参数传进来，测试就可以指定任意一天，包括闰年和夏令时切换的那几天。如果在函数中写 `new Date()`，测试只能在“今天”运行，结果每天都可能不同。

计算天数时用 UTC：UTC 没有夏令时，每天都正好 24 小时，两天的 UTC 零点相减一定是 24 小时的整数倍。用本地时间的零点相减，在切换夏令时的那一天会多出或者少了一个小时。测试中有两个这样的日子（2026 年 11 月 1 日前后、2027 年 3 月 14 日前后，美国等地区在这两天切换）；在没有夏令时的地区运行，本地时间的写法也能通过，但换一个地区的用户就可能出错。

百分比向下取整也是一个有意的决定：只完成了 99.6% 的项目不应该显示为 100%。
:::

:::variant{kind=alt name=date-parse}
```ts file=summary.ts
import type { Project } from './model';

export type Summary = Readonly<{
  done: number;
  total: number;
  /** 完成的百分比，向下取整；没有任务时是 0 */
  percent: number;
  /** 还没有完成，并且截止日期在今天之前 */
  overdue: boolean;
  /** 从今天到截止日期还有几天（过期时是负数）；没有截止日期时是 null */
  daysLeft: number | null;
}>;

export function summarize({ tasks, status, dueDate }: Project, today: string): Summary {
  let done = 0;
  for (const task of tasks) if (task.done) done++;
  // 只有日期的 ISO 字符串（'2026-10-20'）按 UTC 的零点解析，两天之间正好相差整数个 24 小时
  const daysLeft = dueDate === null ? null : (Date.parse(dueDate) - Date.parse(today)) / 86_400_000;
  return {
    done,
    total: tasks.length,
    percent: tasks.length > 0 ? Math.floor((100 * done) / tasks.length) : 0,
    // 'YYYY-MM-DD' 按字符串比较，顺序和日期的先后一样
    overdue: status !== 'done' && dueDate !== null && dueDate < today,
    daysLeft,
  };
}
```
```ts file=main.ts
import { SAMPLE } from './sample';
import { summarize } from './summary';

console.log(summarize(SAMPLE, '2026-10-20'));
console.log(summarize({ ...SAMPLE, dueDate: '2026-10-18' }, '2026-10-20'));
```
:::

:::variant{kind=wrong name=rounded fails=tests reason="百分比四舍五入：3 个完成了 2 个显示为 67%，完成了 99.6% 的项目会显示为 100%"}
```ts file=summary.ts
import type { Project } from './model';

export type Summary = Readonly<{
  done: number;
  total: number;
  /** 完成的百分比，向下取整；没有任务时是 0 */
  percent: number;
  /** 还没有完成，并且截止日期在今天之前 */
  overdue: boolean;
  /** 从今天到截止日期还有几天（过期时是负数）；没有截止日期时是 null */
  daysLeft: number | null;
}>;

const DAY = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' 这一天的 UTC 零点（毫秒）：按 UTC 计算，不受时区和夏令时的影响 */
function utcDay(date: string): number {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

/** today 和 project.dueDate 都是 'YYYY-MM-DD' */
export function summarize(project: Project, today: string): Summary {
  const total = project.tasks.length;
  const done = project.tasks.filter((t) => t.done).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const daysLeft = project.dueDate === null ? null : Math.round((utcDay(project.dueDate) - utcDay(today)) / DAY);
  const overdue = project.status !== 'done' && daysLeft !== null && daysLeft < 0;
  return { done, total, percent, overdue, daysLeft };
}
```
```ts file=main.ts
import { SAMPLE } from './sample';
import { summarize } from './summary';

console.log(summarize(SAMPLE, '2026-10-20'));
console.log(summarize({ ...SAMPLE, dueDate: '2026-10-18' }, '2026-10-20'));
```
:::

:::variant{kind=wrong name=due-today-overdue fails=tests reason="截止日期当天也算过期了：应该是截止日期在今天之前"}
```ts file=summary.ts
import type { Project } from './model';

export type Summary = Readonly<{
  done: number;
  total: number;
  /** 完成的百分比，向下取整；没有任务时是 0 */
  percent: number;
  /** 还没有完成，并且截止日期在今天之前 */
  overdue: boolean;
  /** 从今天到截止日期还有几天（过期时是负数）；没有截止日期时是 null */
  daysLeft: number | null;
}>;

const DAY = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' 这一天的 UTC 零点（毫秒）：按 UTC 计算，不受时区和夏令时的影响 */
function utcDay(date: string): number {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

/** today 和 project.dueDate 都是 'YYYY-MM-DD' */
export function summarize(project: Project, today: string): Summary {
  const total = project.tasks.length;
  const done = project.tasks.filter((t) => t.done).length;
  const percent = total === 0 ? 0 : Math.floor((done / total) * 100);
  const daysLeft = project.dueDate === null ? null : Math.round((utcDay(project.dueDate) - utcDay(today)) / DAY);
  const overdue = project.status !== 'done' && daysLeft !== null && daysLeft <= 0;
  return { done, total, percent, overdue, daysLeft };
}
```
```ts file=main.ts
import { SAMPLE } from './sample';
import { summarize } from './summary';

console.log(summarize(SAMPLE, '2026-10-20'));
console.log(summarize({ ...SAMPLE, dueDate: '2026-10-18' }, '2026-10-20'));
```
:::

:::variant{kind=wrong name=done-overdue fails=tests reason="已完成的项目也算过期了：完成之后截止日期就不再重要"}
```ts file=summary.ts
import type { Project } from './model';

export type Summary = Readonly<{
  done: number;
  total: number;
  /** 完成的百分比，向下取整；没有任务时是 0 */
  percent: number;
  /** 还没有完成，并且截止日期在今天之前 */
  overdue: boolean;
  /** 从今天到截止日期还有几天（过期时是负数）；没有截止日期时是 null */
  daysLeft: number | null;
}>;

const DAY = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' 这一天的 UTC 零点（毫秒）：按 UTC 计算，不受时区和夏令时的影响 */
function utcDay(date: string): number {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

/** today 和 project.dueDate 都是 'YYYY-MM-DD' */
export function summarize(project: Project, today: string): Summary {
  const total = project.tasks.length;
  const done = project.tasks.filter((t) => t.done).length;
  const percent = total === 0 ? 0 : Math.floor((done / total) * 100);
  const daysLeft = project.dueDate === null ? null : Math.round((utcDay(project.dueDate) - utcDay(today)) / DAY);
  const overdue = daysLeft !== null && daysLeft < 0;
  return { done, total, percent, overdue, daysLeft };
}
```
```ts file=main.ts
import { SAMPLE } from './sample';
import { summarize } from './summary';

console.log(summarize(SAMPLE, '2026-10-20'));
console.log(summarize({ ...SAMPLE, dueDate: '2026-10-18' }, '2026-10-20'));
```
:::

:::variant{kind=wrong name=nan-percent fails=tests reason="没有处理任务数为 0 的情况：0 / 0 是 NaN，百分比显示为 NaN"}
```ts file=summary.ts
import type { Project } from './model';

export type Summary = Readonly<{
  done: number;
  total: number;
  /** 完成的百分比，向下取整；没有任务时是 0 */
  percent: number;
  /** 还没有完成，并且截止日期在今天之前 */
  overdue: boolean;
  /** 从今天到截止日期还有几天（过期时是负数）；没有截止日期时是 null */
  daysLeft: number | null;
}>;

const DAY = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' 这一天的 UTC 零点（毫秒）：按 UTC 计算，不受时区和夏令时的影响 */
function utcDay(date: string): number {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

/** today 和 project.dueDate 都是 'YYYY-MM-DD' */
export function summarize(project: Project, today: string): Summary {
  const total = project.tasks.length;
  const done = project.tasks.filter((t) => t.done).length;
  const percent = Math.floor((done / total) * 100);
  const daysLeft = project.dueDate === null ? null : Math.round((utcDay(project.dueDate) - utcDay(today)) / DAY);
  const overdue = project.status !== 'done' && daysLeft !== null && daysLeft < 0;
  return { done, total, percent, overdue, daysLeft };
}
```
```ts file=main.ts
import { SAMPLE } from './sample';
import { summarize } from './summary';

console.log(summarize(SAMPLE, '2026-10-20'));
console.log(summarize({ ...SAMPLE, dueDate: '2026-10-18' }, '2026-10-20'));
```
:::
