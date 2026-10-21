---
version: 1
mode: react
estimatedMinutes: 55
review: ai-draft
problem: 项目面板的第二个里程碑做出两个页面：项目列表和项目详情。列表可以按状态筛选、搜索、排序，这些条件保存在地址中，刷新、后退、分享链接都不会丢；点进一个项目再返回，筛选条件还在。g13 已经讲过 React Router 的路由配置、路径参数和查询参数，这一课把它们用在一个真实的应用里，并解决几个具体的问题：地址怎样设计，地址中的值怎样读出和生成，中文名称怎样排序，从详情页怎样回到“刚才那个列表”，以及根地址怎样转到列表页。
objectives:
  - 按“哪个资源放在路径中，怎样查看放在查询参数中”设计页面的地址，让同一个页面只有一种地址
  - 把读取和生成查询参数集中在一对函数中，用允许的值的列表验证地址中的值
  - 用 localeCompare 或 Intl.Collator 按拼音排序中文，把没有值的项排在最后，并用第二个条件让顺序确定
  - 用 Link 的 state 在导航时传递数据，把类型为 any 的 location.state 当作 unknown 检查
  - 用 loader 返回 replace(…) 转向另一个地址，并且不在历史记录中留下转向前的地址
references:
  - title: Link — React Router API（state、replace、relative）
    url: https://reactrouter.com/api/components/Link
    checked: 2026-10-20
  - title: replace — React Router API
    url: https://reactrouter.com/api/utils/replace
    checked: 2026-10-20
  - title: Navigate — React Router API
    url: https://reactrouter.com/api/components/Navigate
    checked: 2026-10-20
  - title: useSearchParams — React Router API
    url: https://reactrouter.com/api/hooks/useSearchParams
    checked: 2026-10-20
  - title: History.state — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/API/History/state
    checked: 2026-10-20
  - title: Intl.Collator — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator
    checked: 2026-10-20
  - title: URLSearchParams — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/API/URLSearchParams
    checked: 2026-10-20
---

## 要做什么

p2-01 的需求中，这个里程碑负责第 1 条和第 2 条的“查看”部分（添加、勾选任务在 p2-04 做）。写成验收条件：

1. 打开 `/`，转到 `/projects`；转向之后按“后退”，回到进入 `/` 之前的页面，而不是又被转回来；
2. 列表页显示项目的名称、负责人、状态、进度、截止日期，过期的项目标出“已过期”；
3. 可以按状态（全部、计划中、进行中、已完成、已过期）筛选，按名称或负责人搜索，按截止日期或名称排序；
4. 筛选条件保存在地址中：刷新、后退、前进、把链接发给别人，看到的列表都一样；
5. 点击一个项目进入详情页，显示负责人、状态、进度、截止日期（还有几天、今天到期、已过期几天）和任务；
6. 从详情页“返回项目列表”，回到进入详情页之前的那个列表，筛选条件还在；
7. 地址中的值不对（不认识的状态、不存在的项目），页面不出错，给出合理的结果。

## 地址的设计

| 地址 | 页面 |
| --- | --- |
| `/` | 转到 `/projects` |
| `/projects` | 全部项目，按截止日期排序 |
| `/projects?status=active&q=林&sort=name` | 进行中的、名称或负责人包含“林”的项目，按名称排序 |
| `/projects/p2` | 项目 p2 的详情 |
| 其他 | 页面不存在 |

一条简单的规则：**“看哪一个”放在路径中，“怎样看”放在查询参数中**。项目编号决定了显示的是哪个资源，没有它这个页面就不存在，所以是路径的一部分（`useParams`）。筛选、搜索、排序只是查看同一份数据的不同方式，都可以省略，省略时有默认值，所以是查询参数（`useSearchParams`）。

还有一个细节：`/projects` 和 `/projects?status=all&sort=due` 显示的是同一个列表。让应用**只生成一种写法**，和默认值相同的条件不写进地址。这样地址更短，同一个列表的两个链接可以直接比较是否相同，浏览器的历史记录、统计工具中也不会出现同一个页面的几种写法。

## 读出和生成查询参数

和 e10、p1-04 一样，把“地址中的字符串”和“程序中的数据”之间的转换集中在一对函数中：

- `parseFilters(params)`：从 `URLSearchParams` 读出 `Filters`。`params.get(…)` 返回 `string | null`，地址是用户可以随便修改的，所以每个值都要检查：只接受允许的值，其他的（包括缺少）用默认值；
- `toSearchParams(filters)`：反过来，从 `Filters` 生成 `URLSearchParams`，跳过和默认值相同的条件。

组件只和 `Filters` 打交道，不直接读写字符串。允许的值写成 `as const` 的数组，类型从数组中得到（b16）：

```ts
export const SORTS = ['due', 'name'] as const;
export type Sort = (typeof SORTS)[number]; // 'due' | 'name'
```

检查一个字符串是不是其中之一，第一反应是 `SORTS.includes(value)`。但它是一个类型错误（TS2345）：只读元组的 `includes` 只接受 `'due' | 'name'` 类型的参数，而 `value` 是 `string | null`。即使绕过这个错误，`includes` 返回的也只是 `boolean`，不会把 `value` 收窄为 `Sort`，后面还得再断言一次。`find` 正好合适：

```ts
const sort: Sort = SORTS.find((s) => s === value) ?? 'due';
```

`find` 返回的是数组中的元素本身，类型是 `Sort | undefined`；找不到时用默认值。

:::playground{#url-params mode=ts}
```ts file=main.ts
const SORTS = ['due', 'name'] as const;
type Sort = (typeof SORTS)[number];

function parseSort(params: URLSearchParams): Sort {
  const value = params.get('sort');
  return SORTS.find((s) => s === value) ?? 'due';
}

console.log(parseSort(new URLSearchParams('sort=name')), parseSort(new URLSearchParams('sort=NAME')), parseSort(new URLSearchParams('')));

const params = new URLSearchParams();
params.set('q', '小林 & 阿明');
params.set('status', 'active');
console.log(params.toString());
console.log(new URLSearchParams(params.toString()).get('q'));
console.log(new URLSearchParams('q=a+b%2Bc').get('q'), new URLSearchParams('q=').get('q'), new URLSearchParams('').get('q'));
console.log(new URLSearchParams().toString() === '');
```
- 第 9 行：只有 `'name'` 被接受，大小写不同也是不认识的值；
- 第 14 行：`toString()` 会编码中文、空格（编码成 `+`）和 `&`，所以搜索词中有 `&` 也不会把参数拆开。读回来时（第 15 行）得到原来的字符串；
- 第 16 行：`+` 读出来是空格，`%2B` 才是加号；`q=` 得到空字符串，没有 `q` 得到 `null`。`parseFilters` 把两者都当作“没有搜索词”；
- 第 17 行：所有条件都是默认值时，查询字符串是空的，地址就是 `/projects`。
:::

## 排序：中文名称与空值

按名称排序，最直接的写法是 `a.name < b.name`，或者不带比较函数的 `sort()`。它们比较的是 UTF-16 码元，对中文来说就是 Unicode 中汉字的编号顺序，用户看起来是乱的。`localeCompare` 按某种语言的规则比较，`'zh-CN'` 的规则是按拼音：

:::playground{#collation mode=ts}
```ts file=main.ts
const names = ['官网改版', '数据迁移', '季度报告', '招聘计划', '安全检查', '培训课程'];

console.log(names.toSorted().join(' '));
console.log(names.toSorted((a, b) => a.localeCompare(b, 'zh-CN')).join(' '));

// 要比较很多次时，先创建一个 Collator，反复使用它的 compare
const collator = new Intl.Collator('zh-CN');
console.log(names.toSorted(collator.compare).join(' '));

console.log(['b', 'B', 'a', 'A'].toSorted().join(' '), ['b', 'B', 'a', 'A'].toSorted(collator.compare).join(' '));
```
- 第 3 行是汉字的编号顺序，第 4、8 行按拼音：ān、guān、jì、péi、shù、zhāo；
- 第 8 行：`collator.compare` 可以直接作为比较函数传给 `toSorted`（它已经绑定在 `collator` 上，不需要 `bind`）；
- 第 10 行：英文字母也不再是“大写全在前面”。
:::

`localeCompare` 和 `Intl.Collator` 的结果依赖运行环境中的语言数据。本课的顺序在 Chromium、WebKit 和 Node 24 中测量过，结果相同；Firefox 没有测量。

按截止日期排序时还有两个问题：

- **没有截止日期的项目排在哪里**：`null` 不能和字符串比较大小，要单独处理。没有截止日期的项目不紧急，排在最后。如果写成 `(a.dueDate ?? '') < (b.dueDate ?? '')`，空字符串比任何日期都小，它们就排到了最前面；
- **日期相同的项目怎样排**：`toSorted` 是稳定的排序，比较结果相同的项保持原来的顺序。但“原来的顺序”是数据碰巧的顺序（比如服务器返回的顺序），换一次数据就可能变。用名称作为第二个条件，顺序就完全由数据本身决定，测试也能写出确定的结果。

::exercise{#project-query}

## 从列表到详情，再回来

用户筛选出“进行中”的项目，点进其中一个，看完之后点“返回项目列表”。如果这个链接是 `to="/projects"`，筛选条件就丢了，用户要重新选一遍。几种办法：

- **浏览器的“后退”**：从列表进来时没问题。但如果用户是从别人发来的链接直接打开详情页的，“后退”会离开这个网站。页面上的“返回”链接不应该依赖用户是怎样进来的；
- **把列表的条件也放进详情页的地址**，如 `/projects/p2?from=status%3Dactive`：地址变长了，分享出去的详情页链接也带着和它无关的东西；
- **随导航保存一份数据**：`Link` 的 `state` 属性。

```tsx
// 列表页：进入详情页时，带上列表页当时的查询字符串
const { search } = useLocation();
<Link to={`/projects/${project.id}`} state={{ listSearch: search }}>{project.name}</Link>

// 详情页：读出来，拼回列表页的地址
const location = useLocation();
<Link to={{ pathname: '/projects', search: listSearchOf(location.state) }}>返回项目列表</Link>
```

`state` 保存在浏览器的 `history.state` 中，属于历史记录中的这一条。它不出现在地址中，所以不会被分享出去；但刷新页面、从别的页面“后退”回来时它还在，在新标签页中打开同一个地址时则没有（Chromium 与 WebKit 中实测）。

`useLocation().state` 的类型是 `any`。它可能是 `null`（直接打开的详情页），也可能是旧版本的应用写进去的、格式不同的数据：部署了新版本之后，用户历史记录中的那些条目还带着旧的 `state`。所以和 `JSON.parse` 的结果、`fetch` 得到的数据一样（c10、e06），把它当作 `unknown`，检查之后再用：

```ts
function listSearchOf(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'listSearch' in state && typeof state.listSearch === 'string') {
    return state.listSearch;
  }
  return '';
}
```

参数写成 `unknown`，传入 `any` 也可以，但函数里面就必须先检查。如果直接写 `location.state?.listSearch ?? ''`，类型检查不会报错（`any` 关闭了检查），而 `state` 是 `{ listSearch: 42 }` 时，React Router 在生成链接地址时会对数字调用字符串的方法，整个页面就出错了。

## 根地址：转到列表页

打开 `/` 时转到 `/projects`。转向的时机最好是在渲染之前：路由的 `loader` 函数在导航到这个路由时、渲染之前运行（g14 会详细讲它加载数据的用法），它可以返回一个“转向”的响应：

```ts
import { replace } from 'react-router';

{ index: true, loader: () => replace('/projects') }
```

为什么是 `replace` 而不是 `redirect`？两者都转到另一个地址，区别在历史记录：

- `redirect('/projects')`：新增一条历史记录。历史记录变成“之前的页面 → `/` → `/projects`”。用户按“后退”回到 `/`，又被转到 `/projects`，怎么也退不出去；
- `replace('/projects')`：用 `/projects` **替换** `/` 这一条，历史记录是“之前的页面 → `/projects`”，“后退”正常。

在组件中也可以用 `<Navigate to="/projects" replace />` 转向，同样要加上 `replace`。但它要先渲染、再在 Effect 中跳转，React Router 的文档也建议尽量不用这个组件。

## 编程挑战

把这些组合起来：路由配置、列表页、详情页。筛选、搜索、排序用你在第一个练习中写的 `query.ts`（已经提供）。

::exercise{#project-pages}

::quiz

## 常见错误

- **把筛选条件复制进 state**：`useState(() => parseFilters(searchParams))` 只在第一次渲染时读取地址，之后“后退”“前进”改变了地址，界面却不变。每次渲染都从地址读取。
- **直接相信地址中的值**：`params.get('status') as StatusFilter` 让编译器闭嘴，却没有检查。地址可以被随意修改，用允许的值的列表检查。
- **在地址中写入默认值**：同一个列表有了几种地址。只在条件和默认值不同时才写入。
- **按码元排序中文**：`sort()`、`<` 比较的是编号，不是拼音。用 `localeCompare(…, 'zh-CN')` 或 `Intl.Collator`。
- **直接使用 `location.state`**：它的类型是 `any`，可能是 `null`，也可能是旧的格式。当作 `unknown` 检查。
- **转向时新增历史记录**：`redirect` 或没有 `replace` 的 `<Navigate>` 让用户退不出去。根地址转向用 `replace`。

## 下一步

现在可以查看项目了。p2-03 做新建、编辑项目的表单：校验输入，把错误显示在对应的输入框旁边，并且让屏幕阅读器的用户也能知道哪里出了错。
