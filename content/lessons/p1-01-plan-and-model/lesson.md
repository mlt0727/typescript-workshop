---
version: 1
mode: ts
estimatedMinutes: 45
review: self-reviewed
problem: 前面的课程都是一个个独立的练习。从这一课开始，用五个里程碑做一个完整的小应用：一个原生 TypeScript 的任务板，任务分成“待办、进行中、已完成”三列，可以添加、带标签、移动、改名、删除、筛选，筛选条件保存在地址中，数据保存在本地并在读取时验证。第一个里程碑不写界面，先把需求变成类型和纯函数：解析用户输入的一行文字，以及描述整个任务板如何变化的状态更新函数。模型写对了，后面的界面只是把它显示出来。
objectives:
  - 把需求整理成验收条件，再用类型表达数据模型：状态用联合类型，不可变的只读结构
  - 写出把一行输入解析成标题和标签的函数，用可辨识联合返回成功或失败的原因
  - 用可辨识联合描述“动作”，写出纯的状态更新函数：不修改原数据，没有变化时返回原对象，用 never 做穷尽检查
  - 把时间这类外部输入作为参数传入，让模型可以测试
references:
  - title: Narrowing — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
    checked: 2026-10-20
  - title: Object Types（readonly 属性）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/objects.html#readonly-properties
    checked: 2026-10-20
  - title: String.prototype.split() — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/String/split
    checked: 2026-10-20
---

## 要做什么

任务板的需求，先用日常的话写下来：

1. 任务分成三列：**待办**、**进行中**、**已完成**；新任务进入“待办”；
2. 在一个输入框里写一行文字添加任务，例如 `写周报 #工作 #紧急`：`#` 开头的词是标签，其余的是标题；
3. 任务可以移到相邻的列，可以改名、删除；
4. 可以按文字和标签筛选，筛选条件保存在地址中，刷新、后退之后还在；
5. 数据保存在浏览器中，再次打开时恢复；保存的数据损坏或者是旧版本的格式时，不能让应用崩溃。

接下来把它们变成可以检查的**验收条件**，例如“标题去掉首尾空白之后不能为空”“标签最多 3 个”“把已完成的任务再往右移，什么都不发生”。这些条件会直接变成测试。五个里程碑分别完成：数据模型（本课）、渲染与添加、编辑与删除、筛选与地址、保存与验证。最后一个里程碑（p1-06）把它整理成一个本地的 Vite 工程，加上测试并导出。

## 用类型描述数据

```ts
export type Status = 'todo' | 'doing' | 'done';

export type Task = Readonly<{
  id: string;
  title: string;
  tags: readonly string[];
  status: Status;
  createdAt: number;
}>;

export type Board = Readonly<{ tasks: readonly Task[]; nextId: number }>;
```

几个设计决定：

- **状态用一个联合类型**，而不是 `done: boolean` 加 `doing: boolean`：两个布尔值能组合出“既在进行中又已完成”这种不存在的状态（b09、e07）。以后要加第四列，只需要扩展联合类型，编译器会指出所有没有处理新状态的地方；
- **id 用字符串**（`t1`、`t2`），由 `nextId` 生成。不用数组长度：删除之后再添加，长度会重复；也不用随机数：测试中无法预测；
- **全部只读**：任务板的每一次变化都返回一个新的 `Board`（g04、d10），之后的渲染、撤销、保存都可以靠 `===` 判断有没有变化；
- **`createdAt` 由调用方传入**：模型中不直接调用 `Date.now()`。时间是一个“外部输入”，作为参数传进来，测试就能用固定的值。

## 动作与状态更新函数

任务板的每一种变化都写成一个“动作”，用 `type` 区分（b09 的可辨识联合）：

:::playground{#board-model}
```ts file=board.ts
export type Status = 'todo' | 'doing' | 'done';
export type Task = Readonly<{ id: string; title: string; tags: readonly string[]; status: Status; createdAt: number }>;
export type Board = Readonly<{ tasks: readonly Task[]; nextId: number }>;

export type Action =
  | { type: 'add'; title: string; tags: readonly string[]; now: number }
  | { type: 'remove'; id: string };

export function reduce(board: Board, action: Action): Board {
  switch (action.type) {
    case 'add': {
      const task: Task = { id: `t${board.nextId}`, title: action.title, tags: action.tags, status: 'todo', createdAt: action.now };
      return { tasks: [...board.tasks, task], nextId: board.nextId + 1 };
    }
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
```
```ts file=main.ts
import { reduce, type Board } from './board';

const empty: Board = { tasks: [], nextId: 1 };
const one = reduce(empty, { type: 'add', title: '写周报', tags: ['工作'], now: 1000 });
const two = reduce(one, { type: 'add', title: '修自行车', tags: [], now: 2000 });
console.log(two.tasks.map((t) => `${t.id} ${t.title}`));

const same = reduce(two, { type: 'remove', id: 't99' });
console.log('删除不存在的任务，返回原来的对象：', same === two);

const removed = reduce(two, { type: 'remove', id: 't1' });
const three = reduce(removed, { type: 'add', title: '买牛奶', tags: [], now: 3000 });
console.log(three.tasks.map((t) => t.id));
```
- 第 9–24 行：`switch` 按 `action.type` 收窄，每个 `case` 中 TypeScript 都知道 `action` 有哪些属性。`default` 中把 `action` 赋给 `never` 类型的变量（b06）：所有的情况都处理了，`action` 就是 `never`；以后给 `Action` 加一个成员而忘了处理它，这一行就会报错。在 `Action` 中加一项 `| { type: 'clear' }` 试试。
- 删除不存在的任务时返回**原来的** `board`：调用方用 `===` 就知道什么都没有变，不必重新渲染、也不必保存。
- 删除 `t1` 之后再添加，新任务是 `t3`，不会和已有的 `t2` 重复：id 来自不断增加的 `nextId`，而不是数组的长度。
:::

## 解析一行输入

“写周报 #工作 #紧急”这样的输入要拆成标题和标签。解析可能失败（只写了标签、标题太长……），失败时界面要显示原因，所以返回值也用一个可辨识联合，而不是抛出异常：

```ts
type ParseResult = { ok: true; title: string; tags: readonly string[] } | { ok: false; error: string };
```

调用方必须先检查 `ok`，才能读到 `title` 或者 `error`，不会忘记处理失败的情况。这和 e06 的验证函数是同一个思路：在数据进入程序的地方检查一次，之后的代码只和类型明确的数据打交道。

标题的规则（不能为空、不超过 40 个字符）单独写成一个 `parseTitle`：以后改名时也要用同样的规则，读取保存的数据时也会按它检查。一条规则只写在一处，几个地方才不会互相矛盾。

::exercise{#parse-input}

## 编程挑战

::exercise{#board-reducer}

::quiz

## 常见错误

- **用几个布尔值表示状态**：会出现不可能的组合。用联合类型。
- **用数组长度或随机数生成 id**：删除后会重复，或者无法测试。用一个只增不减的计数器。
- **在模型中直接调用 `Date.now()`、读取页面**：模型就和环境绑在了一起，没法单独测试。把它们作为参数传入。
- **没有变化时也返回新对象**：调用方无法用 `===` 判断有没有变化，会做多余的渲染和保存。
- **`switch` 没有穷尽检查**：新增动作之后忘了处理，编译器也不会提醒。在 `default` 中赋值给 `never`。

## 下一步

下一个里程碑把任务板显示到页面上：三列、每列的任务卡片，以及添加任务的表单和错误提示。
