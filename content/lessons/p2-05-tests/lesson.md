---
version: 1
mode: react
estimatedMinutes: 55
review: ai-draft
problem: 项目面板的功能都有了，接下来要保证以后修改它时不会悄悄地弄坏什么。前面的每个里程碑都有平台写好的测试；这一次由你来写。测试不是越多越好：要知道每一条规则在哪一层测最合适，测试要稳定（不依赖真实的网络和时间），还要能发现真正的错误。这一课用“变异体”衡量测试写得够不够：平台准备了故意写错的实现，你的测试要把它们都找出来。最后介绍怎样用 Playwright 在真正的浏览器中走一遍主要的流程。
objectives:
  - 按“规则、组件、流程”把测试分到单元测试、组件测试、端到端测试三层，知道每一层测什么
  - 为纯函数写能发现边界错误的测试：空值、空白、大小写、并列时的顺序、默认值
  - 在组件测试中控制网络：每个测试一个新的模拟服务器，数请求，制造失败
  - 写不依赖时机的异步断言：用 findBy、waitFor 等待，并能证明某个状态出现在服务器回应之前
  - 用变异测试的思路检查测试本身，知道 StrykerJS 这样的工具
references:
  - title: Async Methods — Testing Library
    url: https://testing-library.com/docs/dom-testing-library/api-async/
    checked: 2026-10-21
  - title: About Queries（查询的优先级）— Testing Library
    url: https://testing-library.com/docs/queries/about/#priority
    checked: 2026-10-21
  - title: Mock APIs — Playwright
    url: https://playwright.dev/docs/mock
    checked: 2026-10-21
  - title: Web server — Playwright
    url: https://playwright.dev/docs/test-webserver
    checked: 2026-10-21
  - title: Introduction — StrykerJS
    url: https://stryker-mutator.io/docs/stryker-js/introduction/
    checked: 2026-10-21
---

## 要做什么

给项目面板补上测试：

1. 每一条业务规则都有单元测试，包括容易出错的边界：没有截止日期、只有空白的搜索词、大小写、并列时的顺序、地址中的默认值；
2. 每个页面的每一种状态都有组件测试：加载中、加载失败、成功；修改时的乐观更新、失败时的恢复、防止重复提交、错误显示的位置；
3. 主要的流程有一个端到端测试：在真正的浏览器中打开构建好的网站，从列表进入详情，勾选、添加任务；
4. 测试稳定：不依赖真实的服务器，不依赖“今天”是哪一天，在任何电脑上、运行任何次数结果都一样。

## 测什么，在哪一层测

| | 单元测试 | 组件测试 | 端到端测试 |
| --- | --- | --- | --- |
| 测什么 | 纯函数：`summarize`、`update`、`listProjects`、`validateProject`、`request` | 页面和路由：用户看到什么、点了之后发生什么 | 整个应用：构建好的网站在真正的浏览器中 |
| 运行在 | Node 或浏览器，毫秒级 | jsdom 或浏览器，每个测试几百毫秒 | 一个或几个真正的浏览器，每个测试几秒 |
| 外部依赖 | 没有 | 模拟的服务器、内存中的路由 | 模拟或真正的服务器 |
| 数量 | 多：每条规则、每个边界 | 中：每个页面的每种状态 | 少：几条主要的流程 |

规则的细节放在最下层测：“没有截止日期的项目排在最后”用 `listProjects` 测，十几个测试一瞬间就跑完；如果在页面上测，每一条都要渲染页面、点下拉框、读列表。组件测试只需要确认页面**用了**这些函数，并且把每种状态都显示对了。端到端测试再少一些，只确认各部分组装在一起能工作：构建、路由、资源路径（i02）这些问题，只有它能发现。

## 测试写得够不够：变异测试

测试全部通过，只说明代码没有违反你写下的那些断言。“覆盖率 100%”也只说明每一行都运行过，不说明运行的结果被检查过：一个没有任何 `expect` 的测试，也能让覆盖率达到 100%。

更直接的办法是反过来问：**如果代码写错了，测试能发现吗？** 故意把实现改错一处（把 `<` 换成 `<=`、删掉一个 `trim()`、去掉一个检查），这样的版本叫**变异体**（mutant）。运行测试：有测试失败，这个变异体就被“杀死”了；全部通过，说明测试漏掉了这种错误。

这一课的两个练习就是这样判分的：你的测试先要在正确的实现上全部通过，然后平台把实现换成一个个变异体，每一个都要被至少一个测试发现。真实的项目中，[StrykerJS](https://stryker-mutator.io/docs/stryker-js/introduction/) 这样的工具会自动生成变异体（它支持 Vitest），报告有多少没有被发现。

写测试时可以先问几个问题，变异体通常就藏在这些地方：

- **边界**：空数组、`null`、空字符串、只有空白、今天（是“之前”还是“之前或当天”）；
- **大小写和格式**：`Lin` 和 `lin`、`Active` 和 `active`；
- **顺序**：并列的项按什么排，结果会不会依赖输入的顺序；
- **默认值**：和默认值相同时，是不是真的被省略了。

测试数据选得不好，错误的实现也能通过。下面的两个排序函数都有一处错误：

:::playground{#weak-data mode=ts}
```ts file=main.ts
type Item = { name: string; due: string };
const byName = (a: Item, b: Item) => a.name.localeCompare(b.name, 'zh-CN');
/** 错误：截止日期相同时没有按名称排序 */
const byDueOnly = (a: Item, b: Item) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0);
/** 错误：按码元而不是拼音比较名称 */
const byCodeUnits = (a: Item, b: Item) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

const names = (items: Item[]) => items.map((i) => i.name).join(' ');
const sameDay: Item[] = [{ name: '安全检查', due: '2026-11-15' }, { name: '官网改版', due: '2026-11-15' }];
console.log(names(sameDay.toSorted(byDueOnly)), '|', names(sameDay.toReversed().toSorted(byDueOnly)));

const lucky: Item[] = [{ name: '数据迁移', due: '' }, { name: '官网改版', due: '' }];
const telling: Item[] = [{ name: '培训课程', due: '' }, { name: '安全检查', due: '' }];
console.log(names(lucky.toSorted(byCodeUnits)), '|', names(lucky.toSorted(byName)));
console.log(names(telling.toSorted(byCodeUnits)), '|', names(telling.toSorted(byName)));
```
- 第 10 行：输入已经是“安全检查、官网改版”时，没有按名称排序的 `byDueOnly` 也给出了正确的顺序（`toSorted` 是稳定的，保持原来的顺序）；把输入反过来，错误才显现出来；
- 第 14 行：“数据迁移”“官网改版”的码元顺序碰巧和拼音顺序一样，测试发现不了 `byCodeUnits` 的错误；
- 第 15 行：“培训课程”“安全检查”的两种顺序正好相反。测试数据要选能**区分**正确和错误的那一组。
:::

::exercise{#test-query}

## 组件测试：控制网络和时间

p2-04 的页面通过 `fetch` 和服务器通信。组件测试中不用真正的服务器，而是在每个测试开始时创建一个新的模拟服务器，用 `vi.spyOn(globalThis, 'fetch')` 替换 `fetch`：

```tsx
async function open(path: string) {
  const server = createFakeServer(PROJECTS, 200); // 每个请求 200 毫秒
  vi.spyOn(globalThis, 'fetch').mockImplementation(server.fetch);
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
  await screen.findByRole('heading', { level: 1 });
  return { server, user: userEvent.setup() };
}
```

- **每个测试一个新的服务器**：上一个测试添加的任务不会出现在下一个测试中，测试之间互不影响，可以按任意顺序运行。测试结束时，平台（以及配置了 `restoreMocks` 的 Vitest）会把 `fetch` 恢复原样；
- **`server.requests`**：服务器收到的每个请求。“空的任务不发请求”“连点两次只发一个请求”都要靠它检查，界面上看不出来；
- **`server.offline = true`**：让之后的请求连接失败，测试“加载失败时可以重试”“连接失败时恢复原来的状态”。

### 等待，而不是假设时机

点击之后，界面不一定在 `user.click` 返回时就已经更新了：请求要等服务器回应；即使不需要等服务器，React Router 也在 transition 中更新状态（g13），实测在 WebKit 中，提交之后按钮变成不可用、复选框显示新的值，都比 Chromium 晚一点才渲染出来。所以：

- 等待会出现的元素用 `await screen.findBy…`；
- 等待一个条件成立用 `await waitFor(() => { expect(…) })`：它反复运行回调，直到其中的断言都通过，或者超时（默认 1 秒）；
- 不要用 `setTimeout` 等一个固定的时间：在慢的电脑上不够，在快的电脑上浪费。

有一种情况比较特别：要证明“服务器回应**之前**”界面就变了（乐观更新）。只等复选框变成勾选是不够的：没有乐观更新的实现，等服务器回应之后也会勾选。要在同一个 `waitFor` 中同时检查一个“服务器还没有回应”的标志，例如进度还没有变：

```ts
await user.click(screen.getByRole('checkbox', { name: '设计稿' }));
await waitFor(() => {
  expect(screen.getByRole('checkbox', { name: '设计稿' })).toBeChecked();
  expect(screen.getByText(/进度：1\/3/)).toBeInTheDocument(); // 服务器还没有回应
});
```

模拟服务器的延迟（200 毫秒）给了这个窗口足够的时间。

### 查找元素的方式就是用户感知的方式

和 g15 一样，用角色和名字查找元素：`getByRole('checkbox', { name: '设计稿' })`、`getByLabelText('新任务')`、`getByRole('alert')`。测试因此同时检查了可访问性：如果复选框没有和任务名称关联，测试就找不到它。错误显示的位置也可以这样检查：任务的错误在这个任务的 `<li>` 里面（`expect(li).toContainElement(alert)`）；输入框的错误是它的可访问描述（`toHaveAccessibleDescription`）。

## 端到端测试

组件测试中的路由、服务器都是模拟的，构建（f02、f12）、部署（i02）、真实的地址这些环节，只有在真正的浏览器中打开构建好的网站才能检查。这个网站的测试运行在浏览器中，不能再启动另一个浏览器，所以这一部分要在自己的电脑上做（f09 讲过怎样安装和运行 Playwright）。

`playwright.config.ts` 中用 `webServer` 先构建，再用 `vite preview` 提供构建好的网站：

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:4173' },
  webServer: { command: 'npm run build && npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173' },
});
```

还没有真正的服务器时，用 `page.route` 拦截 `/api/` 的请求（f09）。下面假设前几个里程碑的页面已经组装成一个应用（列表页来自 p2-02，详情页来自 p2-04），测试从列表进入详情，勾选一个任务：

```ts
import { expect, test } from '@playwright/test';

const project = { id: 'p1', name: '官网改版', owner: '小林', status: 'active', dueDate: '2026-11-15', tasks: [{ id: 't2', title: '设计稿', done: false }] };

test('从列表进入详情，勾选一个任务', async ({ page }) => {
  await page.route('**/api/projects/p1', (route) => route.fulfill({ json: project }));
  await page.route('**/api/projects/p1/tasks/t2', (route) => route.fulfill({ json: { ...project.tasks[0], done: true } }));

  await page.goto('/projects?status=active');
  await page.getByRole('link', { name: '官网改版' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('官网改版');
  await page.getByRole('checkbox', { name: '设计稿' }).check();
  await expect(page.getByRole('checkbox', { name: '设计稿' })).toBeChecked();
});
```

几点说明：

- Playwright 的 `expect(locator)` 会自动重试，直到条件成立或超时（f09），所以这里不需要 `waitFor`；
- `page.goto('/projects?status=active')` 直接打开一个深层的地址：这正是部署之后最容易出问题的地方（i02 的回退）。用 `vite preview` 时它能工作，但不代表部署之后也能工作，所以 p2-06 会在部署之后再检查一遍；
- 端到端测试慢，也更容易因为环境的原因失败。只为最重要的几条流程写，规则的细节留给单元测试。

## 编程挑战

为 p2-04 的任务页面写组件测试。

::exercise{#test-task-actions}

::quiz

## 常见错误

- **在页面上测规则的每一个细节**：慢，而且一处界面的改动会让很多测试失败。规则在单元测试中测，页面只测每种状态。
- **测试之间共享数据**：上一个测试添加的任务出现在下一个测试中，单独运行一个测试时结果却不同。每个测试创建自己的服务器和数据。
- **用固定的时间等待**：`setTimeout(…, 500)` 在慢的电脑上不够。用 `findBy` 和 `waitFor` 等待条件成立。
- **只等结果，不检查时机**：乐观更新的测试只等复选框被勾选，没有乐观更新的实现也能通过。同时检查“服务器还没有回应”。
- **只测成功的情况**：失败、空的输入、连点两次，这些才是最容易出错的地方。
- **以为覆盖率高就够了**：覆盖率只说明代码运行过。想想“如果这里写错了，哪个测试会失败”。

## 下一步

最后一个里程碑：p2-06 把项目面板部署成一个静态网站，生成需要的回退规则，并在部署之后自动检查。
