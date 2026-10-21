---
version: 1
mode: dom
estimatedMinutes: 55
review: self-reviewed
problem: 单元测试和组件测试都通过了，部署之后用户却打不开页面：构建配置错了，路由刷新返回 404，接口地址写错了，Safari 中某个 API 不支持。这些问题只有在真实的浏览器中、对真实构建出的网站走一遍完整的流程才能发现。端到端测试就是做这件事的：启动网站，打开浏览器，像用户一样点击、输入，检查看到的结果。这一课在本机用 Playwright 为 f02 的项目写端到端测试，理解“自动等待”为什么让测试既稳定又不需要 sleep；在这个网站上，用同样的思路为一个多步骤的流程写测试，并实现一个“自动重试直到成功”的等待函数。
objectives:
  - 说明单元测试、组件测试与端到端测试各自能发现的问题，以及端到端测试的成本
  - 在本机安装 Playwright，配置 webServer、baseURL 和多个浏览器，运行并读懂失败的输出
  - 用 page.getByRole 等定位器和 expect(locator) 的断言编写测试，理解操作与断言的自动等待
  - 用 UI 模式、trace 排查失败的测试，用 page.route 模拟网络请求
references:
  - title: Installation — Playwright
    url: https://playwright.dev/docs/intro
    checked: 2026-10-20
  - title: Locators — Playwright
    url: https://playwright.dev/docs/locators
    checked: 2026-10-20
  - title: Auto-waiting — Playwright
    url: https://playwright.dev/docs/actionability
    checked: 2026-10-20
  - title: Assertions — Playwright
    url: https://playwright.dev/docs/test-assertions
    checked: 2026-10-20
  - title: Web server — Playwright
    url: https://playwright.dev/docs/test-webserver
    checked: 2026-10-20
  - title: Mock APIs — Playwright
    url: https://playwright.dev/docs/mock
    checked: 2026-10-20
---

## 三种测试，各管一段

| | 单元测试（f06） | 组件 / DOM 测试（f08） | 端到端测试（这一课） |
| --- | --- | --- | --- |
| 测什么 | 一个函数 | 一个组件或页面片段 | 整个网站的一条用户流程 |
| 运行在 | Node.js | jsdom（模拟的 DOM） | 真实的浏览器，打开真实的网站 |
| 能发现 | 逻辑错误、边界 | 交互、可访问性、渲染 | 构建与配置、路由、网络、浏览器差异、模块之间的衔接 |
| 速度 | 毫秒 | 几十毫秒 | 秒 |
| 失败时 | 直接指出哪个函数 | 指出哪个组件 | 只知道“这条流程坏了”，要再排查 |

端到端测试最接近用户，但也最慢、最难定位问题。所以通常的做法是：大量的单元测试和组件测试覆盖细节，少量的端到端测试覆盖最重要的几条流程（注册、登录、下单、提交表单），确认各部分接在一起之后仍然能用。这个网站自己就有一组用 Playwright 写的端到端测试，在 Chromium 和 WebKit 中运行，检查从打开课程到判题的完整过程。

## 在本机运行 Playwright

[Playwright](https://playwright.dev/) 能驱动 Chromium、Firefox 和 WebKit（Safari 的引擎）。编写本课时的版本是 1.64.1。

1. 在 f02 的 `my-app` 中运行 `npm init playwright@latest`。它会询问用 TypeScript 还是 JavaScript、测试放在哪个文件夹、是否添加 GitHub Actions 的配置（f12）、是否下载浏览器；按默认选择即可。它也可以分成两步做：`npm install --save-dev @playwright/test`，然后 `npx playwright install` 下载浏览器；
2. 修改 `playwright.config.ts`（下面是本机实际使用的配置）：

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

- `webServer`：运行测试之前先执行 `npm run dev` 启动网站，等 `url` 能访问了再开始；开发时如果已经开着开发服务器，就直接用它（`reuseExistingServer`）。在持续集成中更好的做法是测试**构建后的网站**：`command` 写成 `npm run build && npm run preview`，`url` 换成预览服务器的地址（默认端口 4173），这样构建本身的问题也能被发现；
- `baseURL`：测试中写 `page.goto('/')` 就够了；
- `projects`：每个项目是一种浏览器，同一组测试在每个浏览器中各运行一遍。

3. 写测试 `e2e/counter.spec.ts`：

```ts
import { expect, test } from '@playwright/test';

test('点击按钮，计数加一', async ({ page }) => {
  await page.goto('/');
  const button = page.getByRole('button', { name: /Count is/ });
  await expect(button).toHaveText('Count is 0');
  await button.click();
  await button.click();
  await expect(button).toHaveText('Count is 2');
});
```

4. `npx playwright test`：两个浏览器中各运行一遍，实际输出是 `4 passed (3.8s)`（还有一个检查标题的测试）。

## 定位器与自动等待

`page.getByRole('button', { name: /Count is/ })` 和 f08 的 Testing Library 几乎一样，同样推荐按角色和名字定位。不同之处在于它返回的是**定位器**（locator），而不是元素：定位器只是一个“怎样找到元素”的描述，每次使用时才去页面上查找。所以页面重新渲染、元素被替换之后，同一个定位器仍然能找到新的元素。

真实的浏览器中，一切都是异步的：点击之后页面要更新，请求要返回，动画要结束。Playwright 用两种**自动等待**处理它：

- **操作之前等待**：`click()` 会等元素出现、可见、稳定（不在动画中）、可以接收点击、没有被禁用，再点击；
- **断言会重试**：`await expect(button).toHaveText('Count is 2')` 会反复检查，直到文字变成 `Count is 2`，或者超时（默认 5 秒）才失败。

把期望值故意改成 `Count is 3`，实际得到的失败输出（节选）：

```text
    Error: expect(locator).toHaveText(expected) failed

    Locator:  getByRole('button', { name: /Count is/ })
    Expected: "Count is 3"
    Received: "Count is 2"
    Timeout:  5000ms

    Call log:
      - Expect "toHaveText" getByRole('button', { name: /Count is/ }) with timeout 5000ms
      - waiting for getByRole('button', { name: /Count is/ })
        14 × locator resolved to <button id="counter" type="button" class="counter">Count is 2</button>
           - unexpected value "Count is 2"
```

`14 ×` 说明在 5 秒中它检查了 14 次，每次都是 `Count is 2`。正因为断言会重试，测试中**不需要** `page.waitForTimeout(1000)` 这样的固定等待：固定等待要么太短（机器慢时测试失败），要么太长（白白浪费时间）。注意 `expect(locator).toHaveText(…)` 这种“网页优先”的断言会重试，而 `expect(await locator.textContent()).toBe(…)` 只检查一次，不会重试。

下面的示例用普通的代码模拟“断言重试”：文字在 120 毫秒之后才变化，只检查一次的写法失败，重试的写法成功。

:::playground{#retry-assert}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <button type="button">保存</button>
    <p role="status"></p>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=main.ts
const button = document.querySelector('button');
const status = document.querySelector('[role="status"]');
if (!button || !status) throw new Error('结构不完整');

button.addEventListener('click', () => {
  status.textContent = '保存中…';
  setTimeout(() => (status.textContent = '已保存'), 120);
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 反复检查，直到 check 返回 true 或者超时 */
async function eventually(check: () => boolean, timeout = 1000, interval = 50): Promise<boolean> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (check()) return true;
    await sleep(interval);
  }
  return check();
}

button.click();
console.log('只检查一次：', status.textContent === '已保存');
console.log('重试直到成功：', await eventually(() => status.textContent === '已保存'));
```
- 第 23 行在点击之后立刻检查，这时文字还是“保存中…”。
- `eventually` 每 50 毫秒检查一次，第 4 次检查（也就是第 3 次重试）时文字已经变成了“已保存”。Playwright 的断言、Testing Library 的 `findBy…` 和 `waitFor` 都是这样工作的。下面的编程挑战会把它写成一个完整的函数。
:::

## 排查失败的测试与模拟网络

- `npx playwright test --ui`：UI 模式，可以单独运行某个测试，逐步查看每一个操作前后的页面；
- `npx playwright test --headed`：显示浏览器窗口；`--debug` 逐步执行；
- **trace**：配置中的 `trace: 'retain-on-failure'` 为每个测试记录完整的过程（每一步的截图、DOM、网络请求、控制台），只保留失败的那些。`npx playwright show-report` 打开报告，点开 trace 就能“回放”失败的那一次。`npm init playwright` 生成的模板用的是 `trace: 'on-first-retry'` 加上 `retries: process.env.CI ? 2 : 0`：只在重试时记录，所以本机（不重试）不会生成 trace，要么加上 `--retries=1`，要么像这里一样用 `retain-on-failure`；
- **模拟网络**：测试不应该依赖真实的后端是否正常。`page.route` 拦截请求并返回准备好的数据：

```ts
await page.route('**/api/users', (route) => route.fulfill({ json: [{ id: 1, name: 'Ada' }] }));
await page.goto('/users');
await expect(page.getByRole('listitem')).toHaveText(['Ada']);
```

也可以用 `route.fulfill({ status: 500 })` 测试接口失败时页面的表现（e07 的“失败状态”）。

## 在这个网站上练习

这个网站的测试运行在浏览器中，无法再启动另一个浏览器，所以下面的小任务用 f08 的 Testing Library 写一个**流程测试**：像端到端测试一样，从第一步走到最后一步，检查每一步用户看到的内容。写法与 Playwright 非常接近：

| Playwright | Testing Library |
| --- | --- |
| `page.getByRole('button', { name: '下一步' })` | `screen.getByRole('button', { name: '下一步' })` |
| `await locator.click()`、`await locator.fill('a@b.co')` | `await user.click(元素)`、`await user.type(元素, 'a@b.co')` |
| `await expect(locator).toHaveText('…')`（自动重试） | `expect(元素).toHaveTextContent('…')`；会延后出现的用 `await screen.findBy…` |
| `await expect(locator).toBeFocused()` | `expect(元素).toHaveFocus()` |

::exercise{#test-signup-flow}

## 编程挑战

::exercise{#poll}

::quiz

## 常见错误

- **用固定的等待**（`waitForTimeout`、`sleep`）：要么不够长，要么浪费时间。用会重试的断言等待“结果出现”。
- **对一次性读取的值做断言**：`expect(await locator.textContent()).toBe(…)` 不会重试。用 `await expect(locator).toHaveText(…)`。
- **端到端测试依赖真实的后端和数据**：数据一变测试就失败。用 `page.route` 模拟，或者为测试准备专门的数据。
- **用端到端测试覆盖所有细节**：慢，而且失败时难以定位。细节交给单元测试和组件测试，端到端测试只走关键的流程。
- **只在开发服务器上运行**：构建、`base`、路由回退（f02）的问题只在构建后的网站上出现。持续集成中测试 `npm run preview` 提供的网站。
