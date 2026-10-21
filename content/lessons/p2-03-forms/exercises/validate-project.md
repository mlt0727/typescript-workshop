---
kind: task
mode: ts
title: 项目表单的校验
---
在 `form.ts` 中实现 `validateProject(draft, context)`（类型和 `toDraft` 已经写好；`model.ts`、`data.ts` 只读）。`context` 中是今天的日期 `today`、已有的全部项目 `projects`，以及正在编辑的项目 `original`（新建时是 `null`）。

1. **名称**：去掉首尾空白之后
   - 为空：`'请输入项目名称'`；
   - 超过 `NAME_MAX_LENGTH`（40）个字符（按 `length` 计算）：`'项目名称不能超过 40 个字符'`；
   - 和**另一个**项目的名称相同（不区分大小写）：`'已经有一个叫“数据迁移”的项目'`，引号中是那个项目原来的名称。正在编辑的项目和自己同名不算；
2. **负责人**：去掉首尾空白之后为空：`'请输入负责人'`；
3. **截止日期**：`''` 表示没有截止日期。否则
   - 不是 `YYYY-MM-DD` 格式，或者不是日历上真实存在的一天：`'请输入有效的日期'`；
   - 早于 `today`：`'截止日期不能早于今天'`。例外：编辑时截止日期和 `original` 原来的相同，就允许；
4. 有错误时返回 `{ ok: false, errors }`，`errors` 中是**所有**出错的字段，没有错误的字段不出现；
5. 都没有问题时返回 `{ ok: true, value }`：名称和负责人去掉首尾空白，没有截止日期时是 `null`。

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
```ts file=data.ts readonly
import type { Project } from './model';

/** 这个里程碑还没有服务器（p2-04 再从服务器加载）：项目数据先写在这里 */
export const PROJECTS: readonly Project[] = [
  {
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
  },
  {
    id: 'p2',
    name: '数据迁移',
    owner: '阿明',
    status: 'active',
    dueDate: '2026-10-12',
    tasks: [
      { id: 't1', title: '备份旧库', done: true },
      { id: 't2', title: '迁移脚本', done: false },
    ],
  },
  { id: 'p3', name: '季度报告', owner: 'Lin', status: 'done', dueDate: '2026-09-30', tasks: [{ id: 't1', title: '汇总数据', done: true }] },
  { id: 'p4', name: '招聘计划', owner: '小林', status: 'planning', dueDate: null, tasks: [] },
  {
    id: 'p5',
    name: '安全检查',
    owner: '老周',
    status: 'planning',
    dueDate: '2026-11-15',
    tasks: [{ id: 't1', title: '列出依赖', done: false }],
  },
  {
    id: 'p6',
    name: '培训课程',
    owner: '阿明',
    status: 'active',
    dueDate: '2026-10-20',
    tasks: [
      { id: 't1', title: '准备讲义', done: true },
      { id: 't2', title: '预约会议室', done: true },
      { id: 't3', title: '发通知', done: false },
    ],
  },
];

/** 为了让页面和测试的结果确定，“今天”固定为这一天（真实的应用中用当天的日期） */
export const TODAY = '2026-10-20';
```
:::

:::files{role=starter}
```ts file=form.ts
import type { Project } from './model';

/** 表单中的值：输入框给出的都是字符串，没有填写的截止日期是 '' */
export type ProjectDraft = Readonly<{ name: string; owner: string; dueDate: string }>;

/** 校验通过之后的数据：去掉了首尾空白，没有截止日期是 null */
export type ProjectInput = Readonly<{ name: string; owner: string; dueDate: string | null }>;

/** 每个字段的错误信息；没有错误的字段不出现 */
export type FieldErrors = Partial<Record<keyof ProjectDraft, string>>;

export type Validation = { ok: true; value: ProjectInput } | { ok: false; errors: FieldErrors };

export type ValidationContext = Readonly<{
  /** 今天，YYYY-MM-DD */
  today: string;
  /** 已有的全部项目，用来检查重名 */
  projects: readonly Project[];
  /** 正在编辑的项目；新建时是 null */
  original: Project | null;
}>;

export const NAME_MAX_LENGTH = 40;

/** 表单的初始值：编辑时来自项目，新建时都是空的（已经写好） */
export function toDraft(project: Project | null): ProjectDraft {
  return { name: project?.name ?? '', owner: project?.owner ?? '', dueDate: project?.dueDate ?? '' };
}

export function validateProject(draft: ProjectDraft, context: ValidationContext): Validation {
  // TODO：检查三个字段，返回所有的错误；都没有问题时返回整理好的数据
  return { ok: true, value: { name: draft.name, owner: draft.owner, dueDate: draft.dueDate === '' ? null : draft.dueDate } };
}
```
```ts file=main.ts
import { PROJECTS, TODAY } from './data';
import { validateProject } from './form';

const p2 = PROJECTS.find((p) => p.id === 'p2') ?? null;

console.log(validateProject({ name: ' 季度复盘 ', owner: '阿明', dueDate: '' }, { today: TODAY, projects: PROJECTS, original: null }));
console.log(validateProject({ name: '数据迁移', owner: ' ', dueDate: '2026-02-30' }, { today: TODAY, projects: PROJECTS, original: null }));
// 编辑已经过期的“数据迁移”，什么也不改
console.log(validateProject({ name: '数据迁移', owner: '阿明', dueDate: '2026-10-12' }, { today: TODAY, projects: PROJECTS, original: p2 }));
```
:::

:::files{role=solution}
```ts file=form.ts
import type { Project } from './model';

/** 表单中的值：输入框给出的都是字符串，没有填写的截止日期是 '' */
export type ProjectDraft = Readonly<{ name: string; owner: string; dueDate: string }>;

/** 校验通过之后的数据：去掉了首尾空白，没有截止日期是 null */
export type ProjectInput = Readonly<{ name: string; owner: string; dueDate: string | null }>;

/** 每个字段的错误信息；没有错误的字段不出现 */
export type FieldErrors = Partial<Record<keyof ProjectDraft, string>>;

export type Validation = { ok: true; value: ProjectInput } | { ok: false; errors: FieldErrors };

export type ValidationContext = Readonly<{
  /** 今天，YYYY-MM-DD */
  today: string;
  /** 已有的全部项目，用来检查重名 */
  projects: readonly Project[];
  /** 正在编辑的项目；新建时是 null */
  original: Project | null;
}>;

export const NAME_MAX_LENGTH = 40;

/** 表单的初始值：编辑时来自项目，新建时都是空的 */
export function toDraft(project: Project | null): ProjectDraft {
  return { name: project?.name ?? '', owner: project?.owner ?? '', dueDate: project?.dueDate ?? '' };
}

/** 是 YYYY-MM-DD 格式，并且是日历上真实存在的一天 */
function isCalendarDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  // 2026-02-30 会被“进位”成 3 月 2 日：转换回字符串之后和原来不同
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

export function validateProject(draft: ProjectDraft, context: ValidationContext): Validation {
  const { today, projects, original } = context;
  const name = draft.name.trim();
  const owner = draft.owner.trim();
  const dueDate = draft.dueDate === '' ? null : draft.dueDate;
  const errors: FieldErrors = {};

  if (name === '') {
    errors.name = '请输入项目名称';
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = `项目名称不能超过 ${NAME_MAX_LENGTH} 个字符`;
  } else {
    // 编辑时，项目和它自己同名不算重名
    const same = projects.find((p) => p.id !== original?.id && p.name.toLowerCase() === name.toLowerCase());
    if (same !== undefined) errors.name = `已经有一个叫“${same.name}”的项目`;
  }

  if (owner === '') errors.owner = '请输入负责人';

  if (dueDate !== null) {
    if (!isCalendarDate(dueDate)) {
      errors.dueDate = '请输入有效的日期';
    } else if (dueDate < today && dueDate !== original?.dueDate) {
      // 已经过期的项目，保持原来的截止日期不变是允许的
      errors.dueDate = '截止日期不能早于今天';
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, owner, dueDate } };
}
```
```ts file=main.ts
import { PROJECTS, TODAY } from './data';
import { validateProject } from './form';

const p2 = PROJECTS.find((p) => p.id === 'p2') ?? null;

console.log(validateProject({ name: ' 季度复盘 ', owner: '阿明', dueDate: '' }, { today: TODAY, projects: PROJECTS, original: null }));
console.log(validateProject({ name: '数据迁移', owner: ' ', dueDate: '2026-02-30' }, { today: TODAY, projects: PROJECTS, original: null }));
// 编辑已经过期的“数据迁移”，什么也不改
console.log(validateProject({ name: '数据迁移', owner: '阿明', dueDate: '2026-10-12' }, { today: TODAY, projects: PROJECTS, original: p2 }));
```
:::

:::files{role=tests}
```ts file=form.test.ts
import { describe, expect, test } from 'vitest';
import type { Project } from './model';
import { toDraft, validateProject, type ProjectDraft, type ValidationContext } from './form';

const TODAY = '2026-10-20';

function project(id: string, name: string, dueDate: string | null = null): Project {
  return { id, name, owner: '小林', status: 'active', dueDate, tasks: [] };
}

const PROJECTS = [project('p1', '官网改版', '2026-11-15'), project('p2', '数据迁移', '2026-10-12'), project('p3', 'Website')];
const P1 = PROJECTS[0] ?? project('?', '?');
const P2 = PROJECTS[1] ?? project('?', '?');

const creating: ValidationContext = { today: TODAY, projects: PROJECTS, original: null };
const editing = (original: Project): ValidationContext => ({ today: TODAY, projects: PROJECTS, original });
const draft = (changes: Partial<ProjectDraft>): ProjectDraft => ({ name: '季度报告', owner: '阿明', dueDate: '', ...changes });

describe('通过校验', () => {
  test('去掉首尾空白，没有截止日期时是 null', () => {
    expect(validateProject(draft({ name: '  季度报告 ', owner: ' 阿明 ' }), creating)).toStrictEqual({
      ok: true,
      value: { name: '季度报告', owner: '阿明', dueDate: null },
    });
  });

  test('截止日期是今天或以后', () => {
    for (const dueDate of [TODAY, '2026-10-21', '2028-02-29', '2027-01-01']) {
      expect(validateProject(draft({ dueDate }), creating), dueDate).toStrictEqual({ ok: true, value: { name: '季度报告', owner: '阿明', dueDate } });
    }
  });

  test('名称正好 40 个字符', () => {
    expect(validateProject(draft({ name: '项'.repeat(40) }), creating).ok).toBe(true);
  });
});

describe('名称和负责人', () => {
  test('没有填写：同时返回两个错误', () => {
    expect(validateProject({ name: '', owner: '', dueDate: '' }, creating)).toStrictEqual({
      ok: false,
      errors: { name: '请输入项目名称', owner: '请输入负责人' },
    });
  });

  test('只有空白也算没有填写', () => {
    expect(validateProject(draft({ name: '   ', owner: '\t' }), creating)).toStrictEqual({
      ok: false,
      errors: { name: '请输入项目名称', owner: '请输入负责人' },
    });
  });

  test('名称超过 40 个字符', () => {
    expect(validateProject(draft({ name: '项'.repeat(41) }), creating)).toStrictEqual({ ok: false, errors: { name: '项目名称不能超过 40 个字符' } });
    expect(validateProject(draft({ name: ` ${'项'.repeat(40)} ` }), creating).ok, '先去掉首尾空白再计算长度').toBe(true);
  });

  test('和已有的项目重名（去掉空白，不区分大小写）', () => {
    expect(validateProject(draft({ name: ' 数据迁移 ' }), creating)).toStrictEqual({ ok: false, errors: { name: '已经有一个叫“数据迁移”的项目' } });
    expect(validateProject(draft({ name: 'WEBSITE' }), creating)).toStrictEqual({ ok: false, errors: { name: '已经有一个叫“Website”的项目' } });
  });

  test('编辑时保留自己的名称不算重名，改成别的项目的名称算', () => {
    expect(validateProject(toDraft(P1), editing(P1)).ok).toBe(true);
    expect(validateProject({ ...toDraft(P1), name: 'website' }, editing(P1))).toStrictEqual({ ok: false, errors: { name: '已经有一个叫“Website”的项目' } });
  });
});

describe('截止日期', () => {
  test('不是有效的日期', () => {
    for (const dueDate of ['2026-02-30', '2027-02-29', '2026-13-01', '2026-00-10', '2026-1-5', '2026/10/30', 'tomorrow', '2026-10-30T00:00']) {
      expect(validateProject(draft({ dueDate }), creating), dueDate).toStrictEqual({ ok: false, errors: { dueDate: '请输入有效的日期' } });
    }
  });

  test('新建时不能早于今天', () => {
    expect(validateProject(draft({ dueDate: '2026-10-19' }), creating)).toStrictEqual({ ok: false, errors: { dueDate: '截止日期不能早于今天' } });
  });

  test('编辑已经过期的项目：截止日期不变可以保存；改成另一个过去的日期不行', () => {
    expect(validateProject(toDraft(P2), editing(P2))).toStrictEqual({ ok: true, value: { name: '数据迁移', owner: '小林', dueDate: '2026-10-12' } });
    expect(validateProject({ ...toDraft(P2), dueDate: '2026-10-13' }, editing(P2))).toStrictEqual({ ok: false, errors: { dueDate: '截止日期不能早于今天' } });
    expect(validateProject({ ...toDraft(P1), dueDate: '2026-10-12' }, editing(P1)), '别的项目的过去日期也不行').toStrictEqual({
      ok: false,
      errors: { dueDate: '截止日期不能早于今天' },
    });
  });

  test('三个字段的错误同时返回', () => {
    expect(validateProject({ name: '官网改版', owner: ' ', dueDate: '2026-09-31' }, creating)).toStrictEqual({
      ok: false,
      errors: { name: '已经有一个叫“官网改版”的项目', owner: '请输入负责人', dueDate: '请输入有效的日期' },
    });
  });
});
```
:::

:::hint{level=1}
先 `const errors: FieldErrors = {}`，每发现一个问题就写入一个字段（`errors.name = …`），最后用 `Object.keys(errors).length > 0` 判断有没有错误。重名：`projects.find((p) => p.id !== original?.id && p.name.toLowerCase() === name.toLowerCase())`。
:::

:::hint{level=2}
日期：先用 `/^\d{4}-\d{2}-\d{2}$/` 检查格式，再 `` new Date(`${text}T00:00:00Z`) ``，用 `toISOString().slice(0, 10)` 转换回字符串，和原来的比较（无效的日期得到 `NaN`，要先排除，否则 `toISOString` 会抛出异常）。“早于今天”直接比较字符串；例外的条件是 `dueDate !== original?.dueDate`：新建时 `original?.dueDate` 是 `undefined`，不会等于任何日期。
:::

:::explanation
校验函数一次检查所有字段，把所有的错误都返回。只返回第一个错误，用户就要改一个、提交一次、再看到下一个。

重名的检查要排除正在编辑的项目：`p.id !== original?.id`。新建时 `original` 是 `null`，`original?.id` 是 `undefined`，不等于任何项目的 `id`，所以所有项目都参与比较。截止日期的例外也用了同一个技巧：`dueDate !== original?.dueDate`。

日期的检查分两步：正则保证了格式，“转换成 `Date` 再转换回字符串”保证了这一天真的存在。只用 `Date.parse` 不行：它在 Chromium 中把 `2026-02-30` 进位成 3 月 2 日，在两个引擎中都接受 `2026-1-5`。只用正则也不行：`2026-02-30`、`2026-13-01` 的格式都是对的。

`errors` 的类型 `Partial<Record<keyof ProjectDraft, string>>` 让 `errors.name = …` 这样的写入受到检查：字段名写错就是类型错误。

替代解把每个字段的检查写成一个返回 `string | undefined` 的函数，最后用 `Object.entries` 和 `filter` 去掉没有错误的字段；日期用 `setUTCFullYear` 设置年、月、日，再比较它们（`Date.UTC` 会把 0–99 年当作 1900 年以后）。
:::

:::variant{kind=alt name=per-field-functions}
```ts file=form.ts
import type { Project } from './model';

/** 表单中的值：输入框给出的都是字符串，没有填写的截止日期是 '' */
export type ProjectDraft = Readonly<{ name: string; owner: string; dueDate: string }>;

/** 校验通过之后的数据：去掉了首尾空白，没有截止日期是 null */
export type ProjectInput = Readonly<{ name: string; owner: string; dueDate: string | null }>;

/** 每个字段的错误信息；没有错误的字段不出现 */
export type FieldErrors = Partial<Record<keyof ProjectDraft, string>>;

export type Validation = { ok: true; value: ProjectInput } | { ok: false; errors: FieldErrors };

export type ValidationContext = Readonly<{
  /** 今天，YYYY-MM-DD */
  today: string;
  /** 已有的全部项目，用来检查重名 */
  projects: readonly Project[];
  /** 正在编辑的项目；新建时是 null */
  original: Project | null;
}>;

export const NAME_MAX_LENGTH = 40;

/** 表单的初始值：编辑时来自项目，新建时都是空的（已经写好） */
export function toDraft(project: Project | null): ProjectDraft {
  return { name: project?.name ?? '', owner: project?.owner ?? '', dueDate: project?.dueDate ?? '' };
}

/** 构造这一天，再比较年、月、日是否和输入的一样（用 setUTCFullYear：Date.UTC 会把 0–99 年当作 1900 年以后） */
function isCalendarDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function nameError(name: string, { projects, original }: ValidationContext): string | undefined {
  if (name === '') return '请输入项目名称';
  if (name.length > NAME_MAX_LENGTH) return `项目名称不能超过 ${NAME_MAX_LENGTH} 个字符`;
  const key = name.toLowerCase();
  const same = projects.filter((p) => p.id !== original?.id).find((p) => p.name.toLowerCase() === key);
  return same && `已经有一个叫“${same.name}”的项目`;
}

function dueDateError(dueDate: string, { today, original }: ValidationContext): string | undefined {
  if (dueDate === '') return undefined;
  if (!isCalendarDate(dueDate)) return '请输入有效的日期';
  const unchanged = original !== null && original.dueDate === dueDate;
  return dueDate < today && !unchanged ? '截止日期不能早于今天' : undefined;
}

export function validateProject(draft: ProjectDraft, context: ValidationContext): Validation {
  const name = draft.name.trim();
  const owner = draft.owner.trim();
  const found = {
    name: nameError(name, context),
    owner: owner === '' ? '请输入负责人' : undefined,
    dueDate: dueDateError(draft.dueDate, context),
  };
  // 去掉值为 undefined 的字段，只留下真正的错误
  const errors: FieldErrors = Object.fromEntries(Object.entries(found).filter(([, message]) => message !== undefined));
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, owner, dueDate: draft.dueDate || null } };
}
```
:::

:::variant{kind=wrong name=no-self fails=tests reason="检查重名时没有排除正在编辑的项目：项目和自己“重名”"}
```ts file=form.ts
import type { Project } from './model';

/** 表单中的值：输入框给出的都是字符串，没有填写的截止日期是 '' */
export type ProjectDraft = Readonly<{ name: string; owner: string; dueDate: string }>;

/** 校验通过之后的数据：去掉了首尾空白，没有截止日期是 null */
export type ProjectInput = Readonly<{ name: string; owner: string; dueDate: string | null }>;

/** 每个字段的错误信息；没有错误的字段不出现 */
export type FieldErrors = Partial<Record<keyof ProjectDraft, string>>;

export type Validation = { ok: true; value: ProjectInput } | { ok: false; errors: FieldErrors };

export type ValidationContext = Readonly<{
  /** 今天，YYYY-MM-DD */
  today: string;
  /** 已有的全部项目，用来检查重名 */
  projects: readonly Project[];
  /** 正在编辑的项目；新建时是 null */
  original: Project | null;
}>;

export const NAME_MAX_LENGTH = 40;

/** 表单的初始值：编辑时来自项目，新建时都是空的 */
export function toDraft(project: Project | null): ProjectDraft {
  return { name: project?.name ?? '', owner: project?.owner ?? '', dueDate: project?.dueDate ?? '' };
}

/** 是 YYYY-MM-DD 格式，并且是日历上真实存在的一天 */
function isCalendarDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  // 2026-02-30 会被“进位”成 3 月 2 日：转换回字符串之后和原来不同
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

export function validateProject(draft: ProjectDraft, context: ValidationContext): Validation {
  const { today, projects, original } = context;
  const name = draft.name.trim();
  const owner = draft.owner.trim();
  const dueDate = draft.dueDate === '' ? null : draft.dueDate;
  const errors: FieldErrors = {};

  if (name === '') {
    errors.name = '请输入项目名称';
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = `项目名称不能超过 ${NAME_MAX_LENGTH} 个字符`;
  } else {
    // 编辑时，项目和它自己同名不算重名
    const same = projects.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (same !== undefined) errors.name = `已经有一个叫“${same.name}”的项目`;
  }

  if (owner === '') errors.owner = '请输入负责人';

  if (dueDate !== null) {
    if (!isCalendarDate(dueDate)) {
      errors.dueDate = '请输入有效的日期';
    } else if (dueDate < today && dueDate !== original?.dueDate) {
      // 已经过期的项目，保持原来的截止日期不变是允许的
      errors.dueDate = '截止日期不能早于今天';
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, owner, dueDate } };
}
```
:::

:::variant{kind=wrong name=case-sensitive fails=tests reason="重名的比较区分大小写：WEBSITE 和 Website 被当作两个名称"}
```ts file=form.ts
import type { Project } from './model';

/** 表单中的值：输入框给出的都是字符串，没有填写的截止日期是 '' */
export type ProjectDraft = Readonly<{ name: string; owner: string; dueDate: string }>;

/** 校验通过之后的数据：去掉了首尾空白，没有截止日期是 null */
export type ProjectInput = Readonly<{ name: string; owner: string; dueDate: string | null }>;

/** 每个字段的错误信息；没有错误的字段不出现 */
export type FieldErrors = Partial<Record<keyof ProjectDraft, string>>;

export type Validation = { ok: true; value: ProjectInput } | { ok: false; errors: FieldErrors };

export type ValidationContext = Readonly<{
  /** 今天，YYYY-MM-DD */
  today: string;
  /** 已有的全部项目，用来检查重名 */
  projects: readonly Project[];
  /** 正在编辑的项目；新建时是 null */
  original: Project | null;
}>;

export const NAME_MAX_LENGTH = 40;

/** 表单的初始值：编辑时来自项目，新建时都是空的 */
export function toDraft(project: Project | null): ProjectDraft {
  return { name: project?.name ?? '', owner: project?.owner ?? '', dueDate: project?.dueDate ?? '' };
}

/** 是 YYYY-MM-DD 格式，并且是日历上真实存在的一天 */
function isCalendarDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  // 2026-02-30 会被“进位”成 3 月 2 日：转换回字符串之后和原来不同
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

export function validateProject(draft: ProjectDraft, context: ValidationContext): Validation {
  const { today, projects, original } = context;
  const name = draft.name.trim();
  const owner = draft.owner.trim();
  const dueDate = draft.dueDate === '' ? null : draft.dueDate;
  const errors: FieldErrors = {};

  if (name === '') {
    errors.name = '请输入项目名称';
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = `项目名称不能超过 ${NAME_MAX_LENGTH} 个字符`;
  } else {
    // 编辑时，项目和它自己同名不算重名
    const same = projects.find((p) => p.id !== original?.id && p.name === name);
    if (same !== undefined) errors.name = `已经有一个叫“${same.name}”的项目`;
  }

  if (owner === '') errors.owner = '请输入负责人';

  if (dueDate !== null) {
    if (!isCalendarDate(dueDate)) {
      errors.dueDate = '请输入有效的日期';
    } else if (dueDate < today && dueDate !== original?.dueDate) {
      // 已经过期的项目，保持原来的截止日期不变是允许的
      errors.dueDate = '截止日期不能早于今天';
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, owner, dueDate } };
}
```
:::

:::variant{kind=wrong name=first-only fails=tests reason="名称为空时立刻返回：其他字段的错误没有一起报告"}
```ts file=form.ts
import type { Project } from './model';

/** 表单中的值：输入框给出的都是字符串，没有填写的截止日期是 '' */
export type ProjectDraft = Readonly<{ name: string; owner: string; dueDate: string }>;

/** 校验通过之后的数据：去掉了首尾空白，没有截止日期是 null */
export type ProjectInput = Readonly<{ name: string; owner: string; dueDate: string | null }>;

/** 每个字段的错误信息；没有错误的字段不出现 */
export type FieldErrors = Partial<Record<keyof ProjectDraft, string>>;

export type Validation = { ok: true; value: ProjectInput } | { ok: false; errors: FieldErrors };

export type ValidationContext = Readonly<{
  /** 今天，YYYY-MM-DD */
  today: string;
  /** 已有的全部项目，用来检查重名 */
  projects: readonly Project[];
  /** 正在编辑的项目；新建时是 null */
  original: Project | null;
}>;

export const NAME_MAX_LENGTH = 40;

/** 表单的初始值：编辑时来自项目，新建时都是空的 */
export function toDraft(project: Project | null): ProjectDraft {
  return { name: project?.name ?? '', owner: project?.owner ?? '', dueDate: project?.dueDate ?? '' };
}

/** 是 YYYY-MM-DD 格式，并且是日历上真实存在的一天 */
function isCalendarDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  // 2026-02-30 会被“进位”成 3 月 2 日：转换回字符串之后和原来不同
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

export function validateProject(draft: ProjectDraft, context: ValidationContext): Validation {
  const { today, projects, original } = context;
  const name = draft.name.trim();
  const owner = draft.owner.trim();
  const dueDate = draft.dueDate === '' ? null : draft.dueDate;
  const errors: FieldErrors = {};

  if (name === '') {
    return { ok: false, errors: { name: '请输入项目名称' } };
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = `项目名称不能超过 ${NAME_MAX_LENGTH} 个字符`;
  } else {
    // 编辑时，项目和它自己同名不算重名
    const same = projects.find((p) => p.id !== original?.id && p.name.toLowerCase() === name.toLowerCase());
    if (same !== undefined) errors.name = `已经有一个叫“${same.name}”的项目`;
  }

  if (owner === '') errors.owner = '请输入负责人';

  if (dueDate !== null) {
    if (!isCalendarDate(dueDate)) {
      errors.dueDate = '请输入有效的日期';
    } else if (dueDate < today && dueDate !== original?.dueDate) {
      // 已经过期的项目，保持原来的截止日期不变是允许的
      errors.dueDate = '截止日期不能早于今天';
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, owner, dueDate } };
}
```
:::

:::variant{kind=wrong name=date-parse fails=tests reason="用 Date.parse 检查日期：2026-1-5 这样的非标准格式也被接受"}
```ts file=form.ts
import type { Project } from './model';

/** 表单中的值：输入框给出的都是字符串，没有填写的截止日期是 '' */
export type ProjectDraft = Readonly<{ name: string; owner: string; dueDate: string }>;

/** 校验通过之后的数据：去掉了首尾空白，没有截止日期是 null */
export type ProjectInput = Readonly<{ name: string; owner: string; dueDate: string | null }>;

/** 每个字段的错误信息；没有错误的字段不出现 */
export type FieldErrors = Partial<Record<keyof ProjectDraft, string>>;

export type Validation = { ok: true; value: ProjectInput } | { ok: false; errors: FieldErrors };

export type ValidationContext = Readonly<{
  /** 今天，YYYY-MM-DD */
  today: string;
  /** 已有的全部项目，用来检查重名 */
  projects: readonly Project[];
  /** 正在编辑的项目；新建时是 null */
  original: Project | null;
}>;

export const NAME_MAX_LENGTH = 40;

/** 表单的初始值：编辑时来自项目，新建时都是空的 */
export function toDraft(project: Project | null): ProjectDraft {
  return { name: project?.name ?? '', owner: project?.owner ?? '', dueDate: project?.dueDate ?? '' };
}

/** 是 YYYY-MM-DD 格式，并且是日历上真实存在的一天 */
function isCalendarDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  // 2026-02-30 会被“进位”成 3 月 2 日：转换回字符串之后和原来不同
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

export function validateProject(draft: ProjectDraft, context: ValidationContext): Validation {
  const { today, projects, original } = context;
  const name = draft.name.trim();
  const owner = draft.owner.trim();
  const dueDate = draft.dueDate === '' ? null : draft.dueDate;
  const errors: FieldErrors = {};

  if (name === '') {
    errors.name = '请输入项目名称';
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = `项目名称不能超过 ${NAME_MAX_LENGTH} 个字符`;
  } else {
    // 编辑时，项目和它自己同名不算重名
    const same = projects.find((p) => p.id !== original?.id && p.name.toLowerCase() === name.toLowerCase());
    if (same !== undefined) errors.name = `已经有一个叫“${same.name}”的项目`;
  }

  if (owner === '') errors.owner = '请输入负责人';

  if (dueDate !== null) {
    if (Number.isNaN(Date.parse(dueDate))) {
      errors.dueDate = '请输入有效的日期';
    } else if (dueDate < today && dueDate !== original?.dueDate) {
      // 已经过期的项目，保持原来的截止日期不变是允许的
      errors.dueDate = '截止日期不能早于今天';
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, owner, dueDate } };
}
```
:::

:::variant{kind=wrong name=past-always fails=tests reason="过去的截止日期一律拒绝：已经过期的项目改什么都保存不了"}
```ts file=form.ts
import type { Project } from './model';

/** 表单中的值：输入框给出的都是字符串，没有填写的截止日期是 '' */
export type ProjectDraft = Readonly<{ name: string; owner: string; dueDate: string }>;

/** 校验通过之后的数据：去掉了首尾空白，没有截止日期是 null */
export type ProjectInput = Readonly<{ name: string; owner: string; dueDate: string | null }>;

/** 每个字段的错误信息；没有错误的字段不出现 */
export type FieldErrors = Partial<Record<keyof ProjectDraft, string>>;

export type Validation = { ok: true; value: ProjectInput } | { ok: false; errors: FieldErrors };

export type ValidationContext = Readonly<{
  /** 今天，YYYY-MM-DD */
  today: string;
  /** 已有的全部项目，用来检查重名 */
  projects: readonly Project[];
  /** 正在编辑的项目；新建时是 null */
  original: Project | null;
}>;

export const NAME_MAX_LENGTH = 40;

/** 表单的初始值：编辑时来自项目，新建时都是空的 */
export function toDraft(project: Project | null): ProjectDraft {
  return { name: project?.name ?? '', owner: project?.owner ?? '', dueDate: project?.dueDate ?? '' };
}

/** 是 YYYY-MM-DD 格式，并且是日历上真实存在的一天 */
function isCalendarDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  // 2026-02-30 会被“进位”成 3 月 2 日：转换回字符串之后和原来不同
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

export function validateProject(draft: ProjectDraft, context: ValidationContext): Validation {
  const { today, projects, original } = context;
  const name = draft.name.trim();
  const owner = draft.owner.trim();
  const dueDate = draft.dueDate === '' ? null : draft.dueDate;
  const errors: FieldErrors = {};

  if (name === '') {
    errors.name = '请输入项目名称';
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = `项目名称不能超过 ${NAME_MAX_LENGTH} 个字符`;
  } else {
    // 编辑时，项目和它自己同名不算重名
    const same = projects.find((p) => p.id !== original?.id && p.name.toLowerCase() === name.toLowerCase());
    if (same !== undefined) errors.name = `已经有一个叫“${same.name}”的项目`;
  }

  if (owner === '') errors.owner = '请输入负责人';

  if (dueDate !== null) {
    if (!isCalendarDate(dueDate)) {
      errors.dueDate = '请输入有效的日期';
    } else if (dueDate < today) {
      // 已经过期的项目，保持原来的截止日期不变是允许的
      errors.dueDate = '截止日期不能早于今天';
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, owner, dueDate } };
}
```
:::

