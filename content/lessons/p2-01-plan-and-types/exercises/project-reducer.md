---
kind: challenge
title: 带业务规则的项目更新
---
在 `project.ts` 中实现 `update(project, action)`：按动作更新项目，返回 `{ ok: true, project }`；动作违反规则时返回 `{ ok: false, error }`。**不修改**传入的项目；没有任何变化时返回**原来的那个对象**。

- `rename`：去掉首尾空白，不能为空（`名称不能为空`），不超过 60 个字符（按码点计算，即 `[...name].length`，常见的 emoji 算一个；`名称不能超过 60 个字符`）；
- `setDueDate`：`null` 表示清除；否则必须是 `YYYY-MM-DD` 格式、并且日历上真实存在的一天（`2026-02-29` 不存在），否则是 `日期格式不正确`；
- `addTask`：去掉首尾空白，不能为空（`任务不能为空`），不超过 80 个字符（`任务不能超过 80 个字符`）；`id` 已经存在时是 `任务的编号重复`；新任务没有完成，放在最后；
- `toggleTask`：切换这个任务的完成状态；`removeTask`：删除这个任务。找不到 `taskId` 时是 `没有这个任务`；
- **已完成的项目**不能添加、切换、删除任务（`已完成的项目不能修改任务`），但可以改名、改截止日期；
- `setStatus`：允许的变化是计划中 → 进行中、进行中 → 计划中、进行中 → 已完成、已完成 → 进行中。其他的变化是 `不能从“已完成”改为“计划中”` 这样的错误（用 `STATUS_NAMES` 中的中文名称）。改为已完成时，所有的任务都要已经完成（没有任务也可以），否则是 `还有 2 个任务没有完成`；改为现在的状态不算变化。

检查的顺序：修改任务的动作（添加、切换、删除）**先**检查项目是否已完成（已完成的项目中添加一个空的任务，错误是“已完成的项目不能修改任务”）；`addTask` 接着依次检查任务为空、太长、编号重复；`setStatus` 先检查转换表，再检查未完成的任务。

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
```ts file=project.ts
import type { Project, ProjectStatus } from './model';

export type Action =
  | { type: 'rename'; name: string }
  | { type: 'setDueDate'; dueDate: string | null }
  | { type: 'addTask'; id: string; title: string }
  | { type: 'toggleTask'; taskId: string }
  | { type: 'removeTask'; taskId: string }
  | { type: 'setStatus'; status: ProjectStatus };

export type Result = { ok: true; project: Project } | { ok: false; error: string };

/**
 * 按业务规则更新项目。动作不允许时返回失败的原因；没有任何变化时返回原来的 project（同一个对象）。
 */
export function update(project: Project, action: Action): Result {
  if (action.type === 'rename') return { ok: true, project: { ...project, name: action.name } };
  return { ok: true, project };
}
```
```ts file=main.ts
import { update } from './project';
import { SAMPLE } from './sample';

console.log(update(SAMPLE, { type: 'setStatus', status: 'done' }));
console.log(update(SAMPLE, { type: 'addTask', id: 't4', title: ' 上线 ' }));
```
:::

:::files{role=solution}
```ts file=project.ts
import { STATUS_NAMES, type Project, type ProjectStatus } from './model';

export type Action =
  | { type: 'rename'; name: string }
  | { type: 'setDueDate'; dueDate: string | null }
  | { type: 'addTask'; id: string; title: string }
  | { type: 'toggleTask'; taskId: string }
  | { type: 'removeTask'; taskId: string }
  | { type: 'setStatus'; status: ProjectStatus };

export type Result = { ok: true; project: Project } | { ok: false; error: string };

const ok = (project: Project): Result => ({ ok: true, project });
const fail = (error: string): Result => ({ ok: false, error });
const charCount = (text: string) => [...text].length;

/** 'YYYY-MM-DD'，并且是日历上真实存在的一天 */
function isDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) return false;
  const [, year = '', month = '', day = ''] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day);
}

/** 允许的状态变化（相同的状态不算变化） */
const TRANSITIONS: Readonly<Record<ProjectStatus, readonly ProjectStatus[]>> = {
  planning: ['active'],
  active: ['planning', 'done'],
  done: ['active'],
};

/**
 * 按业务规则更新项目。动作不允许时返回失败的原因；没有任何变化时返回原来的 project（同一个对象）。
 */
export function update(project: Project, action: Action): Result {
  const locked = project.status === 'done';
  switch (action.type) {
    case 'rename': {
      const name = action.name.trim();
      if (name === '') return fail('名称不能为空');
      if (charCount(name) > 60) return fail('名称不能超过 60 个字符');
      return ok(name === project.name ? project : { ...project, name });
    }
    case 'setDueDate': {
      if (action.dueDate !== null && !isDate(action.dueDate)) return fail('日期格式不正确');
      return ok(action.dueDate === project.dueDate ? project : { ...project, dueDate: action.dueDate });
    }
    case 'addTask': {
      if (locked) return fail('已完成的项目不能修改任务');
      const title = action.title.trim();
      if (title === '') return fail('任务不能为空');
      if (charCount(title) > 80) return fail('任务不能超过 80 个字符');
      if (project.tasks.some((t) => t.id === action.id)) return fail('任务的编号重复');
      return ok({ ...project, tasks: [...project.tasks, { id: action.id, title, done: false }] });
    }
    case 'toggleTask':
    case 'removeTask': {
      if (locked) return fail('已完成的项目不能修改任务');
      const index = project.tasks.findIndex((t) => t.id === action.taskId);
      const task = project.tasks[index];
      if (task === undefined) return fail('没有这个任务');
      const tasks = action.type === 'toggleTask' ? project.tasks.with(index, { ...task, done: !task.done }) : project.tasks.toSpliced(index, 1);
      return ok({ ...project, tasks });
    }
    case 'setStatus': {
      if (action.status === project.status) return ok(project);
      if (!TRANSITIONS[project.status].includes(action.status)) return fail(`不能从“${STATUS_NAMES[project.status]}”改为“${STATUS_NAMES[action.status]}”`);
      if (action.status === 'done') {
        const left = project.tasks.filter((t) => !t.done).length;
        if (left > 0) return fail(`还有 ${left} 个任务没有完成`);
      }
      return ok({ ...project, status: action.status });
    }
    default: {
      const unhandled: never = action;
      throw new Error(`未知的动作：${JSON.stringify(unhandled)}`);
    }
  }
}
```
```ts file=main.ts
import { update } from './project';
import { SAMPLE } from './sample';

console.log(update(SAMPLE, { type: 'setStatus', status: 'done' }));
console.log(update(SAMPLE, { type: 'addTask', id: 't4', title: ' 上线 ' }));
```
:::

:::files{role=tests}
```ts file=project.test.ts
import { describe, expect, test } from 'vitest';
import type { Project, Task } from './model';
import { update } from './project';

const task = (id: string, done: boolean): Task => ({ id, title: `任务 ${id}`, done });
const base: Project = {
  id: 'p1',
  name: '官网改版',
  owner: '小林',
  status: 'active',
  dueDate: '2026-11-15',
  tasks: [task('a', true), task('b', false)],
};
const with_ = (more: Partial<Project>): Project => ({ ...base, ...more });
const okProject = (result: ReturnType<typeof update>) => {
  if (!result.ok) throw new Error(`期望成功，实际失败：${result.error}`);
  return result.project;
};

describe('名称与截止日期', () => {
  test('改名：去掉首尾空白，1 到 60 个字符', () => {
    expect(okProject(update(base, { type: 'rename', name: '  新官网 ' })).name).toBe('新官网');
    expect(update(base, { type: 'rename', name: '   ' })).toEqual({ ok: false, error: '名称不能为空' });
    expect(update(base, { type: 'rename', name: '字'.repeat(61) })).toEqual({ ok: false, error: '名称不能超过 60 个字符' });
    expect(okProject(update(base, { type: 'rename', name: '😀'.repeat(60) })).name).toBe('😀'.repeat(60));
  });

  test('截止日期：YYYY-MM-DD 并且真实存在，可以清除', () => {
    expect(okProject(update(base, { type: 'setDueDate', dueDate: '2028-02-29' })).dueDate).toBe('2028-02-29');
    expect(okProject(update(base, { type: 'setDueDate', dueDate: null })).dueDate).toBeNull();
    for (const dueDate of ['2026-02-29', '2026-13-01', '2026-11-31', '2026-1-5', '2026/11/15', '']) {
      expect(update(base, { type: 'setDueDate', dueDate }), dueDate).toEqual({ ok: false, error: '日期格式不正确' });
    }
  });

  test('已完成的项目也可以改名、改截止日期', () => {
    const done = with_({ status: 'done', tasks: [task('a', true)] });
    expect(okProject(update(done, { type: 'rename', name: '归档' })).name).toBe('归档');
    expect(okProject(update(done, { type: 'setDueDate', dueDate: null })).dueDate).toBeNull();
  });
});

describe('任务', () => {
  test('添加：去掉空白，没有完成，放在最后；不修改原来的项目', () => {
    const next = okProject(update(base, { type: 'addTask', id: 'c', title: ' 写文案 ' }));
    expect(next.tasks).toEqual([...base.tasks, { id: 'c', title: '写文案', done: false }]);
    expect(base.tasks).toHaveLength(2);
  });

  test('添加时的检查', () => {
    expect(update(base, { type: 'addTask', id: 'c', title: ' ' })).toEqual({ ok: false, error: '任务不能为空' });
    expect(update(base, { type: 'addTask', id: 'c', title: '字'.repeat(81) })).toEqual({ ok: false, error: '任务不能超过 80 个字符' });
    expect(update(base, { type: 'addTask', id: 'a', title: '重复' })).toEqual({ ok: false, error: '任务的编号重复' });
    expect(okProject(update(base, { type: 'addTask', id: 'c', title: '😀'.repeat(80) })).tasks.at(-1)?.title, '按码点计算长度').toBe('😀'.repeat(80));
  });

  test('检查的顺序', () => {
    const done = with_({ status: 'done', tasks: [task('a', true)] });
    expect(update(done, { type: 'addTask', id: 'b', title: ' ' })).toEqual({ ok: false, error: '已完成的项目不能修改任务' });
    expect(update(done, { type: 'toggleTask', taskId: 'x' })).toEqual({ ok: false, error: '已完成的项目不能修改任务' });
    expect(update(base, { type: 'addTask', id: 'a', title: ' ' })).toEqual({ ok: false, error: '任务不能为空' });
    expect(update(base, { type: 'addTask', id: 'a', title: '字'.repeat(81) })).toEqual({ ok: false, error: '任务不能超过 80 个字符' });
    expect(update(with_({ status: 'planning' }), { type: 'setStatus', status: 'done' })).toEqual({ ok: false, error: '不能从“计划中”改为“已完成”' });
  });

  test('切换完成状态、删除；找不到时失败', () => {
    expect(okProject(update(base, { type: 'toggleTask', taskId: 'b' })).tasks).toEqual([task('a', true), task('b', true)]);
    expect(okProject(update(base, { type: 'toggleTask', taskId: 'a' })).tasks).toEqual([task('a', false), task('b', false)]);
    expect(okProject(update(base, { type: 'removeTask', taskId: 'a' })).tasks).toEqual([task('b', false)]);
    expect(update(base, { type: 'toggleTask', taskId: 'x' })).toEqual({ ok: false, error: '没有这个任务' });
    expect(update(base, { type: 'removeTask', taskId: 'x' })).toEqual({ ok: false, error: '没有这个任务' });
  });

  test('已完成的项目不能修改任务', () => {
    const done = with_({ status: 'done', tasks: [task('a', true)] });
    for (const action of [
      { type: 'addTask', id: 'b', title: '补充' },
      { type: 'toggleTask', taskId: 'a' },
      { type: 'removeTask', taskId: 'a' },
    ] as const) {
      expect(update(done, action), action.type).toEqual({ ok: false, error: '已完成的项目不能修改任务' });
    }
  });
});

describe('状态', () => {
  test('允许的变化：计划中 ⇄ 进行中，进行中 → 已完成，已完成 → 进行中', () => {
    expect(okProject(update(with_({ status: 'planning' }), { type: 'setStatus', status: 'active' })).status).toBe('active');
    expect(okProject(update(base, { type: 'setStatus', status: 'planning' })).status).toBe('planning');
    expect(okProject(update(with_({ status: 'done' }), { type: 'setStatus', status: 'active' })).status).toBe('active');
  });

  test('不允许的变化', () => {
    expect(update(with_({ status: 'planning', tasks: [] }), { type: 'setStatus', status: 'done' })).toEqual({ ok: false, error: '不能从“计划中”改为“已完成”' });
    expect(update(with_({ status: 'done' }), { type: 'setStatus', status: 'planning' })).toEqual({ ok: false, error: '不能从“已完成”改为“计划中”' });
  });

  test('还有没完成的任务时不能完成项目', () => {
    expect(update(base, { type: 'setStatus', status: 'done' })).toEqual({ ok: false, error: '还有 1 个任务没有完成' });
    const three = with_({ tasks: [task('a', false), task('b', false), task('c', true)] });
    expect(update(three, { type: 'setStatus', status: 'done' })).toEqual({ ok: false, error: '还有 2 个任务没有完成' });
    expect(okProject(update(with_({ tasks: [task('a', true)] }), { type: 'setStatus', status: 'done' })).status).toBe('done');
    expect(okProject(update(with_({ tasks: [] }), { type: 'setStatus', status: 'done' })).status).toBe('done');
  });
});

describe('没有变化时返回原来的对象', () => {
  test('同样的名称、日期、状态', () => {
    for (const action of [
      { type: 'rename', name: ' 官网改版 ' },
      { type: 'setDueDate', dueDate: '2026-11-15' },
      { type: 'setStatus', status: 'active' },
    ] as const) {
      expect(okProject(update(base, action)), action.type).toBe(base);
    }
    const done = with_({ status: 'done' });
    expect(okProject(update(done, { type: 'setStatus', status: 'done' }))).toBe(done);
  });
});
```
:::

:::hint{level=1}
用 `switch (action.type)`，每个分支先做检查，有问题就 `return { ok: false, error }`，最后返回新的项目；`default` 分支用 `never` 做穷尽检查（p1-01）。状态的规则写成一张表：`const TRANSITIONS: Record<ProjectStatus, readonly ProjectStatus[]> = { planning: ['active'], … }`。
:::

:::hint{level=2}
真实存在的日期：先用正则检查格式，再用 `new Date(Date.UTC(年, 月 - 1, 日))` 创建，检查它的 `getUTCFullYear()`、`getUTCMonth()`、`getUTCDate()` 是否和输入的一样（2 月 30 日会变成 3 月 2 日）。修改任务的数组用不修改原数组的方法：`[...tasks, 新任务]`、`tasks.with(i, 新的任务)`、`tasks.toSpliced(i, 1)`（a17）。“没有变化”：名称、日期和原来的相同，或者状态没有变，直接返回 `project`。
:::

:::explanation
这道题的测试就是需求中的验收条件。每一个规则都对应一个测试，规则写错了，测试的名字就说明了是哪一条。

三个设计上的选择：

- **返回结果，而不是抛出异常**：“还有任务没完成”是用户每天都会遇到的情况。返回 `Result` 之后，界面用 `if (!result.ok)` 就能拿到要显示的原因，TypeScript 也保证了只有在 `ok` 为 `true` 时才能读取 `project`；
- **转换表**：状态之间能怎样变化，一张表就看清楚了；类型 `Record<ProjectStatus, …>` 保证每种状态都有一行。“改为已完成时任务都要完成”是表之外的另一条规则，单独检查；
- **没有变化时返回原对象**：React 用 `Object.is` 比较新旧的 state（g04）。改名改成同样的名字时返回原来的对象，界面就不会多渲染一次，依赖这个项目的 Effect 也不会重新运行。

“已完成的项目不能修改任务”这条规则放在最前面检查：它比“任务不能为空”更根本，用户看到的应该是这一条。规格中写明了检查的顺序，测试才能确定错误是哪一个。
:::

:::variant{kind=alt name=if-chains}
```ts file=project.ts
import { STATUS_NAMES, type Project, type ProjectStatus, type Task } from './model';

export type Action =
  | { type: 'rename'; name: string }
  | { type: 'setDueDate'; dueDate: string | null }
  | { type: 'addTask'; id: string; title: string }
  | { type: 'toggleTask'; taskId: string }
  | { type: 'removeTask'; taskId: string }
  | { type: 'setStatus'; status: ProjectStatus };

export type Result = { ok: true; project: Project } | { ok: false; error: string };

/** 检查一段文字：返回整理之后的文字，或者错误 */
function text(value: string, what: string, max: number): { value: string } | { error: string } {
  const trimmed = value.trim();
  if (trimmed === '') return { error: `${what}不能为空` };
  if (Array.from(trimmed).length > max) return { error: `${what}不能超过 ${max} 个字符` };
  return { value: trimmed };
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  // 只有日期的 ISO 字符串按 UTC 解析。2026-02-30 在 Chromium 中会进位成 3 月 2 日（转回字符串就不一样了），
  // 在 WebKit（Safari）中是 NaN：下面一行把两种情况都排除了
  const time = Date.parse(value);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}

const CAN_GO: Record<ProjectStatus, ReadonlySet<ProjectStatus>> = {
  planning: new Set(['active']),
  active: new Set(['planning', 'done']),
  done: new Set(['active']),
};

export function update(project: Project, action: Action): Result {
  const fail = (error: string): Result => ({ ok: false, error });
  const done = (next: Project): Result => ({ ok: true, project: next });

  if (action.type === 'rename') {
    const name = text(action.name, '名称', 60);
    if ('error' in name) return fail(name.error);
    // 只在有变化时才创建新的对象
    return done(name.value === project.name ? project : { ...project, name: name.value });
  }
  if (action.type === 'setDueDate') {
    if (action.dueDate !== null && !validDate(action.dueDate)) return fail('日期格式不正确');
    return done(action.dueDate === project.dueDate ? project : { ...project, dueDate: action.dueDate });
  }
  if (action.type === 'setStatus') {
    const from = project.status;
    const to = action.status;
    if (from === to) return done(project);
    if (!CAN_GO[from].has(to)) return fail(`不能从“${STATUS_NAMES[from]}”改为“${STATUS_NAMES[to]}”`);
    const left = project.tasks.reduce((n, t) => (t.done ? n : n + 1), 0);
    if (to === 'done' && left > 0) return fail(`还有 ${left} 个任务没有完成`);
    return done({ ...project, status: to });
  }

  // 剩下的都是修改任务的动作
  if (project.status === 'done') return fail('已完成的项目不能修改任务');
  let tasks: readonly Task[];
  if (action.type === 'addTask') {
    const title = text(action.title, '任务', 80);
    if ('error' in title) return fail(title.error);
    if (project.tasks.some((t) => t.id === action.id)) return fail('任务的编号重复');
    tasks = [...project.tasks, { id: action.id, title: title.value, done: false }];
  } else {
    if (!project.tasks.some((t) => t.id === action.taskId)) return fail('没有这个任务');
    tasks =
      action.type === 'toggleTask'
        ? project.tasks.map((t) => (t.id === action.taskId ? { ...t, done: !t.done } : t))
        : project.tasks.filter((t) => t.id !== action.taskId);
  }
  return done({ ...project, tasks });
}
```
```ts file=main.ts
import { update } from './project';
import { SAMPLE } from './sample';

console.log(update(SAMPLE, { type: 'setStatus', status: 'done' }));
console.log(update(SAMPLE, { type: 'addTask', id: 't4', title: ' 上线 ' }));
```
:::

:::variant{kind=wrong name=mutate fails=rules reason="用类型断言去掉 readonly，直接往原来的数组中添加任务：调用方手里的项目也被改了，React 也发现不了变化"}
```ts file=project.ts
import { STATUS_NAMES, type Project, type ProjectStatus, type Task } from './model';

export type Action =
  | { type: 'rename'; name: string }
  | { type: 'setDueDate'; dueDate: string | null }
  | { type: 'addTask'; id: string; title: string }
  | { type: 'toggleTask'; taskId: string }
  | { type: 'removeTask'; taskId: string }
  | { type: 'setStatus'; status: ProjectStatus };

export type Result = { ok: true; project: Project } | { ok: false; error: string };

const ok = (project: Project): Result => ({ ok: true, project });
const fail = (error: string): Result => ({ ok: false, error });
const charCount = (text: string) => [...text].length;

/** 'YYYY-MM-DD'，并且是日历上真实存在的一天 */
function isDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) return false;
  const [, year = '', month = '', day = ''] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day);
}

/** 允许的状态变化（相同的状态不算变化） */
const TRANSITIONS: Readonly<Record<ProjectStatus, readonly ProjectStatus[]>> = {
  planning: ['active'],
  active: ['planning', 'done'],
  done: ['active'],
};

/**
 * 按业务规则更新项目。动作不允许时返回失败的原因；没有任何变化时返回原来的 project（同一个对象）。
 */
export function update(project: Project, action: Action): Result {
  const locked = project.status === 'done';
  switch (action.type) {
    case 'rename': {
      const name = action.name.trim();
      if (name === '') return fail('名称不能为空');
      if (charCount(name) > 60) return fail('名称不能超过 60 个字符');
      return ok(name === project.name ? project : { ...project, name });
    }
    case 'setDueDate': {
      if (action.dueDate !== null && !isDate(action.dueDate)) return fail('日期格式不正确');
      return ok(action.dueDate === project.dueDate ? project : { ...project, dueDate: action.dueDate });
    }
    case 'addTask': {
      if (locked) return fail('已完成的项目不能修改任务');
      const title = action.title.trim();
      if (title === '') return fail('任务不能为空');
      if (charCount(title) > 80) return fail('任务不能超过 80 个字符');
      if (project.tasks.some((t) => t.id === action.id)) return fail('任务的编号重复');
      const tasks = project.tasks as Task[];
      tasks.push({ id: action.id, title, done: false });
      return ok(project);
    }
    case 'toggleTask':
    case 'removeTask': {
      if (locked) return fail('已完成的项目不能修改任务');
      const index = project.tasks.findIndex((t) => t.id === action.taskId);
      const task = project.tasks[index];
      if (task === undefined) return fail('没有这个任务');
      const tasks = action.type === 'toggleTask' ? project.tasks.with(index, { ...task, done: !task.done }) : project.tasks.toSpliced(index, 1);
      return ok({ ...project, tasks });
    }
    case 'setStatus': {
      if (action.status === project.status) return ok(project);
      if (!TRANSITIONS[project.status].includes(action.status)) return fail(`不能从“${STATUS_NAMES[project.status]}”改为“${STATUS_NAMES[action.status]}”`);
      if (action.status === 'done') {
        const left = project.tasks.filter((t) => !t.done).length;
        if (left > 0) return fail(`还有 ${left} 个任务没有完成`);
      }
      return ok({ ...project, status: action.status });
    }
    default: {
      const unhandled: never = action;
      throw new Error(`未知的动作：${JSON.stringify(unhandled)}`);
    }
  }
}
```
```ts file=main.ts
import { update } from './project';
import { SAMPLE } from './sample';

console.log(update(SAMPLE, { type: 'setStatus', status: 'done' }));
console.log(update(SAMPLE, { type: 'addTask', id: 't4', title: ' 上线 ' }));
```
:::

:::variant{kind=wrong name=ignore-open-tasks fails=tests reason="完成项目时没有检查任务：还有任务没完成的项目也被标记为已完成"}
```ts file=project.ts
import { STATUS_NAMES, type Project, type ProjectStatus } from './model';

export type Action =
  | { type: 'rename'; name: string }
  | { type: 'setDueDate'; dueDate: string | null }
  | { type: 'addTask'; id: string; title: string }
  | { type: 'toggleTask'; taskId: string }
  | { type: 'removeTask'; taskId: string }
  | { type: 'setStatus'; status: ProjectStatus };

export type Result = { ok: true; project: Project } | { ok: false; error: string };

const ok = (project: Project): Result => ({ ok: true, project });
const fail = (error: string): Result => ({ ok: false, error });
const charCount = (text: string) => [...text].length;

/** 'YYYY-MM-DD'，并且是日历上真实存在的一天 */
function isDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) return false;
  const [, year = '', month = '', day = ''] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day);
}

/** 允许的状态变化（相同的状态不算变化） */
const TRANSITIONS: Readonly<Record<ProjectStatus, readonly ProjectStatus[]>> = {
  planning: ['active'],
  active: ['planning', 'done'],
  done: ['active'],
};

/**
 * 按业务规则更新项目。动作不允许时返回失败的原因；没有任何变化时返回原来的 project（同一个对象）。
 */
export function update(project: Project, action: Action): Result {
  const locked = project.status === 'done';
  switch (action.type) {
    case 'rename': {
      const name = action.name.trim();
      if (name === '') return fail('名称不能为空');
      if (charCount(name) > 60) return fail('名称不能超过 60 个字符');
      return ok(name === project.name ? project : { ...project, name });
    }
    case 'setDueDate': {
      if (action.dueDate !== null && !isDate(action.dueDate)) return fail('日期格式不正确');
      return ok(action.dueDate === project.dueDate ? project : { ...project, dueDate: action.dueDate });
    }
    case 'addTask': {
      if (locked) return fail('已完成的项目不能修改任务');
      const title = action.title.trim();
      if (title === '') return fail('任务不能为空');
      if (charCount(title) > 80) return fail('任务不能超过 80 个字符');
      if (project.tasks.some((t) => t.id === action.id)) return fail('任务的编号重复');
      return ok({ ...project, tasks: [...project.tasks, { id: action.id, title, done: false }] });
    }
    case 'toggleTask':
    case 'removeTask': {
      if (locked) return fail('已完成的项目不能修改任务');
      const index = project.tasks.findIndex((t) => t.id === action.taskId);
      const task = project.tasks[index];
      if (task === undefined) return fail('没有这个任务');
      const tasks = action.type === 'toggleTask' ? project.tasks.with(index, { ...task, done: !task.done }) : project.tasks.toSpliced(index, 1);
      return ok({ ...project, tasks });
    }
    case 'setStatus': {
      if (action.status === project.status) return ok(project);
      if (!TRANSITIONS[project.status].includes(action.status)) return fail(`不能从“${STATUS_NAMES[project.status]}”改为“${STATUS_NAMES[action.status]}”`);
      if (action.status === 'done') {
      }
      return ok({ ...project, status: action.status });
    }
    default: {
      const unhandled: never = action;
      throw new Error(`未知的动作：${JSON.stringify(unhandled)}`);
    }
  }
}
```
```ts file=main.ts
import { update } from './project';
import { SAMPLE } from './sample';

console.log(update(SAMPLE, { type: 'setStatus', status: 'done' }));
console.log(update(SAMPLE, { type: 'addTask', id: 't4', title: ' 上线 ' }));
```
:::

:::variant{kind=wrong name=any-transition fails=tests reason="没有检查状态的转换：计划中的项目可以直接完成，已完成的可以退回计划中"}
```ts file=project.ts
import { STATUS_NAMES, type Project, type ProjectStatus } from './model';

export type Action =
  | { type: 'rename'; name: string }
  | { type: 'setDueDate'; dueDate: string | null }
  | { type: 'addTask'; id: string; title: string }
  | { type: 'toggleTask'; taskId: string }
  | { type: 'removeTask'; taskId: string }
  | { type: 'setStatus'; status: ProjectStatus };

export type Result = { ok: true; project: Project } | { ok: false; error: string };

const ok = (project: Project): Result => ({ ok: true, project });
const fail = (error: string): Result => ({ ok: false, error });
const charCount = (text: string) => [...text].length;

/** 'YYYY-MM-DD'，并且是日历上真实存在的一天 */
function isDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) return false;
  const [, year = '', month = '', day = ''] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day);
}

/** 允许的状态变化（相同的状态不算变化） */
const TRANSITIONS: Readonly<Record<ProjectStatus, readonly ProjectStatus[]>> = {
  planning: ['active'],
  active: ['planning', 'done'],
  done: ['active'],
};

/**
 * 按业务规则更新项目。动作不允许时返回失败的原因；没有任何变化时返回原来的 project（同一个对象）。
 */
export function update(project: Project, action: Action): Result {
  const locked = project.status === 'done';
  switch (action.type) {
    case 'rename': {
      const name = action.name.trim();
      if (name === '') return fail('名称不能为空');
      if (charCount(name) > 60) return fail('名称不能超过 60 个字符');
      return ok(name === project.name ? project : { ...project, name });
    }
    case 'setDueDate': {
      if (action.dueDate !== null && !isDate(action.dueDate)) return fail('日期格式不正确');
      return ok(action.dueDate === project.dueDate ? project : { ...project, dueDate: action.dueDate });
    }
    case 'addTask': {
      if (locked) return fail('已完成的项目不能修改任务');
      const title = action.title.trim();
      if (title === '') return fail('任务不能为空');
      if (charCount(title) > 80) return fail('任务不能超过 80 个字符');
      if (project.tasks.some((t) => t.id === action.id)) return fail('任务的编号重复');
      return ok({ ...project, tasks: [...project.tasks, { id: action.id, title, done: false }] });
    }
    case 'toggleTask':
    case 'removeTask': {
      if (locked) return fail('已完成的项目不能修改任务');
      const index = project.tasks.findIndex((t) => t.id === action.taskId);
      const task = project.tasks[index];
      if (task === undefined) return fail('没有这个任务');
      const tasks = action.type === 'toggleTask' ? project.tasks.with(index, { ...task, done: !task.done }) : project.tasks.toSpliced(index, 1);
      return ok({ ...project, tasks });
    }
    case 'setStatus': {
      if (action.status === project.status) return ok(project);
      if (action.status === 'done') {
        const left = project.tasks.filter((t) => !t.done).length;
        if (left > 0) return fail(`还有 ${left} 个任务没有完成`);
      }
      return ok({ ...project, status: action.status });
    }
    default: {
      const unhandled: never = action;
      throw new Error(`未知的动作：${JSON.stringify(unhandled)}`);
    }
  }
}
```
```ts file=main.ts
import { update } from './project';
import { SAMPLE } from './sample';

console.log(update(SAMPLE, { type: 'setStatus', status: 'done' }));
console.log(update(SAMPLE, { type: 'addTask', id: 't4', title: ' 上线 ' }));
```
:::

:::variant{kind=wrong name=done-unlocked fails=tests reason="已完成的项目仍然可以修改任务"}
```ts file=project.ts
import { STATUS_NAMES, type Project, type ProjectStatus } from './model';

export type Action =
  | { type: 'rename'; name: string }
  | { type: 'setDueDate'; dueDate: string | null }
  | { type: 'addTask'; id: string; title: string }
  | { type: 'toggleTask'; taskId: string }
  | { type: 'removeTask'; taskId: string }
  | { type: 'setStatus'; status: ProjectStatus };

export type Result = { ok: true; project: Project } | { ok: false; error: string };

const ok = (project: Project): Result => ({ ok: true, project });
const fail = (error: string): Result => ({ ok: false, error });
const charCount = (text: string) => [...text].length;

/** 'YYYY-MM-DD'，并且是日历上真实存在的一天 */
function isDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) return false;
  const [, year = '', month = '', day = ''] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day);
}

/** 允许的状态变化（相同的状态不算变化） */
const TRANSITIONS: Readonly<Record<ProjectStatus, readonly ProjectStatus[]>> = {
  planning: ['active'],
  active: ['planning', 'done'],
  done: ['active'],
};

/**
 * 按业务规则更新项目。动作不允许时返回失败的原因；没有任何变化时返回原来的 project（同一个对象）。
 */
export function update(project: Project, action: Action): Result {
  const locked = false;
  switch (action.type) {
    case 'rename': {
      const name = action.name.trim();
      if (name === '') return fail('名称不能为空');
      if (charCount(name) > 60) return fail('名称不能超过 60 个字符');
      return ok(name === project.name ? project : { ...project, name });
    }
    case 'setDueDate': {
      if (action.dueDate !== null && !isDate(action.dueDate)) return fail('日期格式不正确');
      return ok(action.dueDate === project.dueDate ? project : { ...project, dueDate: action.dueDate });
    }
    case 'addTask': {
      if (locked) return fail('已完成的项目不能修改任务');
      const title = action.title.trim();
      if (title === '') return fail('任务不能为空');
      if (charCount(title) > 80) return fail('任务不能超过 80 个字符');
      if (project.tasks.some((t) => t.id === action.id)) return fail('任务的编号重复');
      return ok({ ...project, tasks: [...project.tasks, { id: action.id, title, done: false }] });
    }
    case 'toggleTask':
    case 'removeTask': {
      if (locked) return fail('已完成的项目不能修改任务');
      const index = project.tasks.findIndex((t) => t.id === action.taskId);
      const task = project.tasks[index];
      if (task === undefined) return fail('没有这个任务');
      const tasks = action.type === 'toggleTask' ? project.tasks.with(index, { ...task, done: !task.done }) : project.tasks.toSpliced(index, 1);
      return ok({ ...project, tasks });
    }
    case 'setStatus': {
      if (action.status === project.status) return ok(project);
      if (!TRANSITIONS[project.status].includes(action.status)) return fail(`不能从“${STATUS_NAMES[project.status]}”改为“${STATUS_NAMES[action.status]}”`);
      if (action.status === 'done') {
        const left = project.tasks.filter((t) => !t.done).length;
        if (left > 0) return fail(`还有 ${left} 个任务没有完成`);
      }
      return ok({ ...project, status: action.status });
    }
    default: {
      const unhandled: never = action;
      throw new Error(`未知的动作：${JSON.stringify(unhandled)}`);
    }
  }
}
```
```ts file=main.ts
import { update } from './project';
import { SAMPLE } from './sample';

console.log(update(SAMPLE, { type: 'setStatus', status: 'done' }));
console.log(update(SAMPLE, { type: 'addTask', id: 't4', title: ' 上线 ' }));
```
:::

:::variant{kind=wrong name=always-new fails=tests reason="没有变化时也返回了新的对象：React 会认为项目变了，多渲染一次"}
```ts file=project.ts
import { STATUS_NAMES, type Project, type ProjectStatus } from './model';

export type Action =
  | { type: 'rename'; name: string }
  | { type: 'setDueDate'; dueDate: string | null }
  | { type: 'addTask'; id: string; title: string }
  | { type: 'toggleTask'; taskId: string }
  | { type: 'removeTask'; taskId: string }
  | { type: 'setStatus'; status: ProjectStatus };

export type Result = { ok: true; project: Project } | { ok: false; error: string };

const ok = (project: Project): Result => ({ ok: true, project });
const fail = (error: string): Result => ({ ok: false, error });
const charCount = (text: string) => [...text].length;

/** 'YYYY-MM-DD'，并且是日历上真实存在的一天 */
function isDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) return false;
  const [, year = '', month = '', day = ''] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day);
}

/** 允许的状态变化（相同的状态不算变化） */
const TRANSITIONS: Readonly<Record<ProjectStatus, readonly ProjectStatus[]>> = {
  planning: ['active'],
  active: ['planning', 'done'],
  done: ['active'],
};

/**
 * 按业务规则更新项目。动作不允许时返回失败的原因；没有任何变化时返回原来的 project（同一个对象）。
 */
export function update(project: Project, action: Action): Result {
  const locked = project.status === 'done';
  switch (action.type) {
    case 'rename': {
      const name = action.name.trim();
      if (name === '') return fail('名称不能为空');
      if (charCount(name) > 60) return fail('名称不能超过 60 个字符');
      return ok({ ...project, name });
    }
    case 'setDueDate': {
      if (action.dueDate !== null && !isDate(action.dueDate)) return fail('日期格式不正确');
      return ok(action.dueDate === project.dueDate ? project : { ...project, dueDate: action.dueDate });
    }
    case 'addTask': {
      if (locked) return fail('已完成的项目不能修改任务');
      const title = action.title.trim();
      if (title === '') return fail('任务不能为空');
      if (charCount(title) > 80) return fail('任务不能超过 80 个字符');
      if (project.tasks.some((t) => t.id === action.id)) return fail('任务的编号重复');
      return ok({ ...project, tasks: [...project.tasks, { id: action.id, title, done: false }] });
    }
    case 'toggleTask':
    case 'removeTask': {
      if (locked) return fail('已完成的项目不能修改任务');
      const index = project.tasks.findIndex((t) => t.id === action.taskId);
      const task = project.tasks[index];
      if (task === undefined) return fail('没有这个任务');
      const tasks = action.type === 'toggleTask' ? project.tasks.with(index, { ...task, done: !task.done }) : project.tasks.toSpliced(index, 1);
      return ok({ ...project, tasks });
    }
    case 'setStatus': {
      if (action.status === project.status) return ok({ ...project });
      if (!TRANSITIONS[project.status].includes(action.status)) return fail(`不能从“${STATUS_NAMES[project.status]}”改为“${STATUS_NAMES[action.status]}”`);
      if (action.status === 'done') {
        const left = project.tasks.filter((t) => !t.done).length;
        if (left > 0) return fail(`还有 ${left} 个任务没有完成`);
      }
      return ok({ ...project, status: action.status });
    }
    default: {
      const unhandled: never = action;
      throw new Error(`未知的动作：${JSON.stringify(unhandled)}`);
    }
  }
}
```
```ts file=main.ts
import { update } from './project';
import { SAMPLE } from './sample';

console.log(update(SAMPLE, { type: 'setStatus', status: 'done' }));
console.log(update(SAMPLE, { type: 'addTask', id: 't4', title: ' 上线 ' }));
```
:::
