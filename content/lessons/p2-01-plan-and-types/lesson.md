---
version: 1
mode: ts
estimatedMinutes: 50
review: self-reviewed
problem: 第二个项目是一个 React 的项目面板：一个小团队用它管理手上的几个项目，每个项目有负责人、状态、截止日期和一份任务清单。它有多个页面（列表、详情、新建与编辑），数据来自服务器，要处理加载、出错和保存。和项目 1 一样，第一个里程碑不写界面：先把需求整理成验收条件，用类型描述数据，再把“进度怎么算”“什么时候算过期”“哪些修改是允许的”写成纯函数。这次的模型比任务板多了一样东西：业务规则。不是每个修改都允许，不允许时要说明原因。
objectives:
  - 把需求整理成可以检查的验收条件，用类型描述项目、任务和状态
  - 把派生的数据（进度、是否过期、剩余天数）写成纯函数，按日历计算日期之间的天数
  - 用状态转换表描述哪些状态变化是允许的，不允许的修改返回原因而不是抛出异常
  - 把“今天”这样的外部输入作为参数传入，让规则可以测试
references:
  - title: Date.UTC() — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Date/UTC
    checked: 2026-10-20
  - title: Date 的日期时间字符串格式（只有日期时按 UTC 解析）— MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Date#日期时间字符串格式
    checked: 2026-10-20
  - title: Discriminated Unions — TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions
    checked: 2026-10-20
---

## 要做什么

项目面板的需求：

1. 列表页显示所有的项目：名称、负责人、状态（**计划中**、**进行中**、**已完成**）、进度（完成的任务占多少）、截止日期，过期的项目要醒目地标出来；可以按状态（包括“已过期”）筛选、按名称或负责人搜索、按截止日期或名称排序，筛选条件保存在地址中（p2-02）；
2. 详情页显示一个项目的任务清单，可以添加任务、勾选完成、删除任务（p2-02、p2-04）；
3. 可以新建、编辑项目：名称、负责人、截止日期，输入有误时在对应的输入框旁边说明（p2-03）；
4. 数据保存在服务器上：加载时显示“正在加载”，失败时可以重试，保存时防止重复提交（p2-04）；
5. **业务规则**：已完成的项目不能再修改任务；还有任务没完成时，项目不能标记为已完成；计划中的项目要先开始，才能完成。

和项目 1 一样，先把每一条写成**验收条件**：一句可以直接检查对错的话。比如第 5 条：“项目中有 2 个任务没有完成时，把状态改为已完成，失败，原因是‘还有 2 个任务没有完成’。”下面的编程挑战的测试，就是这些验收条件。

## 用类型描述数据

```ts
export const STATUSES = ['planning', 'active', 'done'] as const;
export type ProjectStatus = (typeof STATUSES)[number];

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

几个决定：

- **进度不存**：“完成了几个任务”可以从 `tasks` 算出来，就不要再存一份，否则两者迟早会不一致（g07 的“只存一份”）；
- **截止日期用字符串 `YYYY-MM-DD`**：它表示“日历上的哪一天”，和时间、时区无关。这种格式按字符串比较的顺序就是日期的先后，JSON 中也能原样保存。用 `Date` 对象表示一个日期，反而会引入时区：`new Date(2026, 9, 20)` 是本地时间的零点，换一个时区的用户打开，可能就成了前一天；
- **没有截止日期用 `null`**，而不是空字符串，类型中写清楚“可能没有”。

## 日期之间的天数

“还有几天到期”看起来只是两个日期相减。但用本地时间计算是有坑的：北美在 3 月和 11 月、欧洲在 3 月和 10 月切换夏令时（中国在 1986–1991 年也实行过），那一天只有 23 或 25 个小时，两个本地零点相减再除以 24 小时，就可能得到 1.96 天这样的结果。

:::playground{#days-between}
```ts file=main.ts
const DAY = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' 这一天的 UTC 零点：UTC 没有夏令时，每天都正好 24 小时 */
function utcDay(date: string): number {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

const daysBetween = (from: string, to: string) => (utcDay(to) - utcDay(from)) / DAY;

console.log(daysBetween('2026-10-20', '2026-11-15'));
console.log(daysBetween('2026-12-30', '2027-01-02'));
console.log(daysBetween('2028-02-28', '2028-03-01'), daysBetween('2027-02-28', '2027-03-01'));
console.log(daysBetween('2026-10-20', '2026-10-18'));
console.log('2026-10-19' < '2026-10-20', '2026-09-30' < '2026-10-01');
```
- 第 11–13 行：跨月、跨年都按日历计算；2028 年是闰年，2 月 28 日到 3 月 1 日是 2 天，2027 年是 1 天；
- 第 14 行：截止日期已经过去时是负数；
- 第 15 行：`YYYY-MM-DD` 格式的字符串可以直接比较先后（月、日都是两位数，所以 `'09'` 排在 `'10'` 前面）；
- 两个 UTC 零点相减，正好是一天的毫秒数的整数倍，所以除出来就是整数，不需要取整；
- `Date.UTC` 的月份从 0 开始，所以要减 1。另一个办法是 `Date.parse('2026-10-20')`：只有日期的 ISO 字符串按 UTC 的零点解析（带时间的 `'2026-10-20T00:00'` 却按本地时间解析）。
:::

::exercise{#project-summary}

## 业务规则：哪些修改是允许的

任务板的状态更新函数（p1-01）总会返回一个状态，从不报告失败：找不到任务时原样返回。项目面板不一样：有些修改违反了业务规则，必须拒绝并告诉用户原因。

状态的变化用一张**转换表**描述：

| 现在的状态 | 可以改为 |
| --- | --- |
| 计划中 | 进行中 |
| 进行中 | 计划中、已完成（任务都完成了才行） |
| 已完成 | 进行中（重新打开） |

写成代码就是 `Record<ProjectStatus, readonly ProjectStatus[]>`：类型保证了三种状态都有一行，以后加一种状态时，编译器会提醒你补上它。

不允许的修改**返回**原因，而不是抛出异常：

```ts
type Result = { ok: true; project: Project } | { ok: false; error: string };
```

“还有任务没完成，不能完成项目”是用户每天都会遇到的正常情况，不是程序的错误。返回 `{ ok: false, error }`，调用方用 `if (!result.ok)` 收窄之后显示原因（b09 的可辨识联合）；抛出异常则要求每个调用方都记得 `try`/`catch`，忘了就是一个崩溃的页面。

下面的编程挑战中没有“修改负责人”的动作：它没有额外的规则。p2-03 的表单会一次保存名称、负责人和截止日期。

::exercise{#project-reducer}

::quiz

## 常见错误

- **用本地时间算天数**：遇到夏令时会差一点。按 UTC 计算日历上的日期。
- **用 `Date` 对象存一个“日期”**：它其实是一个时间点，带着时区。只关心哪一天时，用 `YYYY-MM-DD` 字符串。（以后的 JavaScript 有专门表示日历日期的 `Temporal.PlainDate`；本平台的 TypeScript 配置是 ES2025，还不包含它的类型。）
- **在函数里读取“今天”**：`new Date()` 写在函数里面，测试就只能在今天跑。把今天作为参数传进去。
- **把进度存起来**：它可以从任务算出来，存两份迟早不一致。
- **用异常表示违反业务规则**：这是正常的情况，返回失败的原因。
- **没有变化时也返回新的对象**：React 用 `Object.is` 比较新旧的 state（g04），没有变化时返回原来的对象，就不会引起多余的渲染和 Effect。

## 下一步

模型写好了。p2-02 用 React Router 做出列表页和详情页，把筛选条件放进地址中。
