---
kind: task
title: 把任务板导出成 Markdown
mode: ts
---
在 `markdown.ts` 中实现 `boardToMarkdown(board)`，返回下面这种格式的文本（`board.ts`、`sample.ts` 只读，是前几个里程碑中的代码）：

```md
# 任务板

## 待办（2）

- 写周报 #工作
- Read the TS Handbook #学习 #工作

## 进行中（1）

- 修自行车 #家

## 已完成（1）

- 买牛奶 #家
```

1. 第一行是 `# 任务板`；
2. 然后按待办、进行中、已完成的顺序写出三列：空一行，`## 列名（任务数）`，再空一行，然后每个任务一行：`- 标题`，后面依次是每个标签 ` #标签`。没有任务的列写一行 `（没有任务）`；
3. 每一列中任务的顺序与任务板上显示的相同（`board.ts` 的 `columnsOf`：按创建时间，时间相同时按编号中的数字）；
4. 标题和标签中的 `\`、`` ` ``、`*`、`_`、`[`、`]`、`<`、`>`、`#` 前面加上一个反斜杠；
5. 整段文本以一个换行结尾。

:::files{role=support}
```ts file=board.ts readonly
export const STATUSES = ['todo', 'doing', 'done'] as const;
export type Status = (typeof STATUSES)[number];

export type Task = Readonly<{ id: string; title: string; tags: readonly string[]; status: Status; createdAt: number }>;
export type Board = Readonly<{ tasks: readonly Task[]; nextId: number }>;

export type Action =
  | { type: 'add'; title: string; tags: readonly string[]; now: number }
  | { type: 'rename'; id: string; title: string }
  | { type: 'step'; id: string; direction: -1 | 1 }
  | { type: 'remove'; id: string };

/** 用 change 计算出新的任务；找不到、或者 change 返回原来的任务时，返回原来的 board */
function updateTask(board: Board, id: string, change: (task: Task) => Task): Board {
  const index = board.tasks.findIndex((t) => t.id === id);
  const task = board.tasks[index];
  if (task === undefined) return board;
  const next = change(task);
  return next === task ? board : { ...board, tasks: board.tasks.with(index, next) };
}

export function reduce(board: Board, action: Action): Board {
  switch (action.type) {
    case 'add': {
      const task: Task = { id: `t${board.nextId}`, title: action.title, tags: action.tags, status: 'todo', createdAt: action.now };
      return { tasks: [...board.tasks, task], nextId: board.nextId + 1 };
    }
    case 'rename': {
      const title = action.title.trim();
      return updateTask(board, action.id, (task) => (title === '' || title === task.title ? task : { ...task, title }));
    }
    case 'step':
      return updateTask(board, action.id, (task) => {
        const next = STATUSES[STATUSES.indexOf(task.status) + action.direction];
        return next === undefined ? task : { ...task, status: next };
      });
    case 'remove': {
      const tasks = board.tasks.filter((t) => t.id !== action.id);
      return tasks.length === board.tasks.length ? board : { ...board, tasks };
    }
    default: {
      const unhandled: never = action;
      throw new Error(`未知的动作：${JSON.stringify(unhandled)}`);
    }
  }
}

const idNumber = (task: Task) => Number(task.id.slice(1));

/** 按状态分成三列；每列按创建时间排序，时间相同时按 id 中的数字排序 */
export function columnsOf(board: Board): Readonly<Record<Status, readonly Task[]>> {
  const sorted = board.tasks.toSorted((a, b) => a.createdAt - b.createdAt || idNumber(a) - idNumber(b));
  return {
    todo: sorted.filter((t) => t.status === 'todo'),
    doing: sorted.filter((t) => t.status === 'doing'),
    done: sorted.filter((t) => t.status === 'done'),
  };
}
```
```ts file=sample.ts readonly
import type { Board } from './board';

/** 第一次打开（存储中还没有数据）时显示的示例数据 */
export const SAMPLE: Board = {
  tasks: [
    { id: 't1', title: '写周报', tags: ['工作'], status: 'todo', createdAt: 1 },
    { id: 't2', title: '修自行车', tags: ['家'], status: 'doing', createdAt: 2 },
    { id: 't3', title: '买牛奶', tags: ['家'], status: 'done', createdAt: 3 },
    { id: 't4', title: 'Read the TS Handbook', tags: ['学习', '工作'], status: 'todo', createdAt: 4 },
  ],
  nextId: 5,
};
```
:::

:::files{role=starter}
```ts file=markdown.ts
import { columnsOf, STATUSES, type Board } from './board';

const NAMES = { todo: '待办', doing: '进行中', done: '已完成' } as const;

/** 把任务板导出为 Markdown */
export function boardToMarkdown(board: Board): string {
  const lines = ['# 任务板'];
  for (const task of board.tasks) lines.push(`- ${task.title}`);
  return lines.join('\n');
}
```
```ts file=main.ts
import { boardToMarkdown } from './markdown';
import { SAMPLE } from './sample';

console.log(boardToMarkdown(SAMPLE));
```
:::

:::files{role=solution}
```ts file=markdown.ts
import { columnsOf, STATUSES, type Board, type Task } from './board';

const NAMES = { todo: '待办', doing: '进行中', done: '已完成' } as const;

/** 在 Markdown 中有特殊含义的字符前面加上反斜杠（CommonMark 的反斜杠转义） */
function escape(text: string): string {
  return text.replace(/[\\`*_[\]<>#]/g, '\\$&');
}

/** 一个任务一行：标题，然后是每个标签 */
function line(task: Task): string {
  return `- ${[escape(task.title), ...task.tags.map((tag) => `#${escape(tag)}`)].join(' ')}`;
}

/** 把任务板导出为 Markdown：三列依次排列，每列的任务顺序与任务板上相同 */
export function boardToMarkdown(board: Board): string {
  const columns = columnsOf(board);
  const lines = ['# 任务板'];
  for (const status of STATUSES) {
    const tasks = columns[status];
    lines.push('', `## ${NAMES[status]}（${tasks.length}）`, '');
    if (tasks.length === 0) lines.push('（没有任务）');
    else lines.push(...tasks.map(line));
  }
  return `${lines.join('\n')}\n`;
}
```
```ts file=main.ts
import { boardToMarkdown } from './markdown';
import { SAMPLE } from './sample';

console.log(boardToMarkdown(SAMPLE));
```
:::

:::files{role=tests}
```ts file=markdown.test.ts
import { describe, expect, test } from 'vitest';
import type { Board, Task } from './board';
import { boardToMarkdown } from './markdown';
import { SAMPLE } from './sample';

const boardOf = (...tasks: Task[]): Board => ({ tasks, nextId: 100 });
const task = (id: string, title: string, createdAt: number, more: Partial<Task> = {}): Task => ({ id, title, tags: [], status: 'todo', createdAt, ...more });

describe('boardToMarkdown', () => {
  test('示例数据：三列依次排列，标题后面是标签', () => {
    expect(boardToMarkdown(SAMPLE)).toBe(
      [
        '# 任务板',
        '',
        '## 待办（2）',
        '',
        '- 写周报 #工作',
        '- Read the TS Handbook #学习 #工作',
        '',
        '## 进行中（1）',
        '',
        '- 修自行车 #家',
        '',
        '## 已完成（1）',
        '',
        '- 买牛奶 #家',
        '',
      ].join('\n'),
    );
  });

  test('空的任务板：每一列都写出“（没有任务）”', () => {
    expect(boardToMarkdown({ tasks: [], nextId: 1 })).toBe(
      ['# 任务板', '', '## 待办（0）', '', '（没有任务）', '', '## 进行中（0）', '', '（没有任务）', '', '## 已完成（0）', '', '（没有任务）', ''].join('\n'),
    );
  });

  test('只有一列有任务时，其他列仍然写出来', () => {
    const markdown = boardToMarkdown(boardOf(task('t1', '收尾', 1, { status: 'done' })));
    expect(markdown).toContain('## 待办（0）\n\n（没有任务）\n\n## 进行中（0）\n\n（没有任务）\n\n## 已完成（1）\n\n- 收尾\n');
  });

  test('任务的顺序与任务板上相同：按创建时间，时间相同时按编号中的数字', () => {
    const markdown = boardToMarkdown(boardOf(task('t10', '后建的', 5), task('t2', '先建的', 1), task('t9', '同时建的', 5)));
    expect(markdown).toContain('## 待办（3）\n\n- 先建的\n- 同时建的\n- 后建的\n');
  });

  test('转义 Markdown 的特殊字符；标签保持原来的顺序', () => {
    const markdown = boardToMarkdown(boardOf(task('t1', '**重要** <b> a_b [链接](x) `代码` C:\\temp #1', 1, { status: 'doing', tags: ['c#', '_x'] })));
    expect(markdown).toContain('- \\*\\*重要\\*\\* \\<b\\> a\\_b \\[链接\\](x) \\`代码\\` C:\\\\temp \\#1 #c\\# #\\_x\n');
  });

  test('结尾正好是一个换行', () => {
    const markdown = boardToMarkdown(SAMPLE);
    expect(markdown.endsWith('- 买牛奶 #家\n')).toBe(true);
    expect(markdown.endsWith('\n\n')).toBe(false);
  });
});
```
```ts file=markdown.test-d.ts
import { expectTypeOf } from 'vitest';
import type { Board } from './board';
import { boardToMarkdown } from './markdown';

expectTypeOf(boardToMarkdown).parameter(0).toEqualTypeOf<Board>();
expectTypeOf(boardToMarkdown).returns.toEqualTypeOf<string>();
```
:::

:::hint{level=1}
用一个数组收集每一行，最后 `lines.join('\n')` 再加上一个 `'\n'`。三列的顺序用 `STATUSES`，每列的任务用 `columnsOf(board)[status]`，不要自己按 `board.tasks` 的顺序筛选。每一列先 `push` 空行、`## 列名（数量）`、空行，再 `push` 任务的行。
:::

:::hint{level=2}
转义可以用一个正则一次完成：`text.replace(/[\\`*_[\]<>#]/g, '\\$&')`。字符类中的 `\\` 是反斜杠本身，`\]` 是右方括号；替换文字中的 `$&` 表示匹配到的那个字符，前面的 `\\` 在字符串中就是一个反斜杠。标签也要转义：标签 `c#` 写成 `#c\#`。
:::

:::explanation
导出的格式要**固定**：同样的任务板总是得到同样的文本。所以每个细节都有规定：列的顺序、空行的位置、没有任务时写什么、结尾的换行。测试也因此可以直接比较整段文本。

任务的顺序用 `columnsOf`，而不是 `board.tasks` 中的顺序：用户看到的是任务板上的顺序，导出的文档应该和它一致。`board.tasks` 的顺序取决于任务是怎么加进来的（导入的文件中可能是任何顺序）。

转义保证了标题“原样”出现在导出的文档中：`**重要**` 在 Markdown 中是粗体，转义成 `\*\*重要\*\*` 之后显示的仍然是两个星号。CommonMark 规定任何 ASCII 标点符号都可以这样转义，所以转义得多一点也没有关系，少了才有问题。`#` 本身在行中间并不特殊，转义它是为了让导出的每一行中，只有标签是以 `#` 开头的：标题“修 #3 号 bug”导出为 `- 修 \#3 号 bug`。

返回值是一个字符串，而不是直接下载：生成内容和保存文件分开，`boardToMarkdown` 是一个纯函数，可以在 Node.js 中直接测试；下载交给编程挑战中的另一个函数。
:::

:::variant{kind=alt name=map-sections}
```ts file=markdown.ts
import { columnsOf, STATUSES, type Board } from './board';

const NAMES = { todo: '待办', doing: '进行中', done: '已完成' } as const;
const SPECIAL = new Set(['\\', '`', '*', '_', '[', ']', '<', '>', '#']);

const escape = (text: string) => [...text].map((ch) => (SPECIAL.has(ch) ? `\\${ch}` : ch)).join('');

export function boardToMarkdown(board: Board): string {
  const columns = columnsOf(board);
  const sections = STATUSES.map((status) => {
    const tasks = columns[status];
    const body = tasks.length === 0 ? '（没有任务）' : tasks.map((t) => `- ${escape(t.title)}${t.tags.map((tag) => ` #${escape(tag)}`).join('')}`).join('\n');
    return `## ${NAMES[status]}（${tasks.length}）\n\n${body}\n`;
  });
  return `# 任务板\n\n${sections.join('\n')}`;
}
```
```ts file=main.ts
import { boardToMarkdown } from './markdown';
import { SAMPLE } from './sample';

console.log(boardToMarkdown(SAMPLE));
```
:::

:::variant{kind=wrong name=no-escape fails=tests reason="没有转义：标题中的 **重要** 在导出的文档中变成了粗体，[链接](x) 变成了链接"}
```ts file=markdown.ts
import { columnsOf, STATUSES, type Board, type Task } from './board';

const NAMES = { todo: '待办', doing: '进行中', done: '已完成' } as const;

function line(task: Task): string {
  return `- ${[task.title, ...task.tags.map((tag) => `#${tag}`)].join(' ')}`;
}

export function boardToMarkdown(board: Board): string {
  const columns = columnsOf(board);
  const lines = ['# 任务板'];
  for (const status of STATUSES) {
    const tasks = columns[status];
    lines.push('', `## ${NAMES[status]}（${tasks.length}）`, '');
    if (tasks.length === 0) lines.push('（没有任务）');
    else lines.push(...tasks.map(line));
  }
  return `${lines.join('\n')}\n`;
}
```
```ts file=main.ts
import { boardToMarkdown } from './markdown';
import { SAMPLE } from './sample';

console.log(boardToMarkdown(SAMPLE));
```
:::

:::variant{kind=wrong name=array-order fails=tests reason="按 board.tasks 中的顺序列出任务，而不是任务板上显示的顺序（按创建时间排序）"}
```ts file=markdown.ts
import { STATUSES, type Board, type Task } from './board';

const NAMES = { todo: '待办', doing: '进行中', done: '已完成' } as const;

function escape(text: string): string {
  return text.replace(/[\\`*_[\]<>#]/g, '\\$&');
}

function line(task: Task): string {
  return `- ${[escape(task.title), ...task.tags.map((tag) => `#${escape(tag)}`)].join(' ')}`;
}

export function boardToMarkdown(board: Board): string {
  const lines = ['# 任务板'];
  for (const status of STATUSES) {
    // 按数组中的顺序，而不是任务板上显示的顺序
    const tasks = board.tasks.filter((t) => t.status === status);
    lines.push('', `## ${NAMES[status]}（${tasks.length}）`, '');
    if (tasks.length === 0) lines.push('（没有任务）');
    else lines.push(...tasks.map(line));
  }
  return `${lines.join('\n')}\n`;
}
```
```ts file=main.ts
import { boardToMarkdown } from './markdown';
import { SAMPLE } from './sample';

console.log(boardToMarkdown(SAMPLE));
```
:::

:::variant{kind=wrong name=skip-empty fails=tests reason="跳过了没有任务的列：导出的文档中少了一列，格式不再固定"}
```ts file=markdown.ts
import { columnsOf, STATUSES, type Board, type Task } from './board';

const NAMES = { todo: '待办', doing: '进行中', done: '已完成' } as const;

function escape(text: string): string {
  return text.replace(/[\\`*_[\]<>#]/g, '\\$&');
}

function line(task: Task): string {
  return `- ${[escape(task.title), ...task.tags.map((tag) => `#${escape(tag)}`)].join(' ')}`;
}

export function boardToMarkdown(board: Board): string {
  const columns = columnsOf(board);
  const lines = ['# 任务板'];
  for (const status of STATUSES) {
    const tasks = columns[status];
    // 空的列直接跳过
    if (tasks.length === 0) continue;
    lines.push('', `## ${NAMES[status]}（${tasks.length}）`, '', ...tasks.map(line));
  }
  return `${lines.join('\n')}\n`;
}
```
```ts file=main.ts
import { boardToMarkdown } from './markdown';
import { SAMPLE } from './sample';

console.log(boardToMarkdown(SAMPLE));
```
:::
