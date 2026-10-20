---
kind: task
title: 批量检查链接
---
`checkAll(urls, check)` 检查一组链接。`check(url)` 是一个异步函数（测试会传入假的实现）：链接可用时兑现，不可用时被拒绝。

起始代码用了 `Promise.all`，只要有一个链接不可用，整个检查就失败了。改写它：

1. 所有检查**同时**开始；
2. 返回 `{ ok, failed }`：`ok` 是可用链接的数组；`failed` 是 `{ url, message }` 的数组，`message` 是拒绝原因：原因是 `Error` 时取它的 `message`，否则用 `String(原因)`；
3. `ok` 和 `failed` 中的顺序都和 `urls` 一致；
4. `checkAll` 本身不会被拒绝。

:::files{role=starter}
```ts file=links.ts
export type Failure = { url: string; message: string };
export type Report = { ok: string[]; failed: Failure[] };

export async function checkAll(urls: readonly string[], check: (url: string) => Promise<void>): Promise<Report> {
  await Promise.all(urls.map((url) => check(url)));
  return { ok: [...urls], failed: [] };
}
```
:::

:::files{role=solution}
```ts file=links.ts
export type Failure = { url: string; message: string };
export type Report = { ok: string[]; failed: Failure[] };

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export async function checkAll(urls: readonly string[], check: (url: string) => Promise<void>): Promise<Report> {
  const results = await Promise.allSettled(urls.map((url) => check(url)));
  const report: Report = { ok: [], failed: [] };
  urls.forEach((url, index) => {
    const result = results[index];
    if (result === undefined) {
      return;
    }
    if (result.status === 'fulfilled') {
      report.ok.push(url);
    } else {
      report.failed.push({ url: url, message: messageOf(result.reason) });
    }
  });
  return report;
}
```
:::

:::files{role=tests}
```ts file=links.test.ts
import { describe, expect, test, vi } from 'vitest';
import { checkAll } from './links';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fakeCheck(url: string): Promise<void> {
  await sleep(url.length);
  if (url.includes('404')) throw new Error(`404：${url}`);
  if (url.includes('timeout')) throw 'timeout';
}

describe('checkAll', () => {
  test('分别列出可用和不可用的链接，顺序与输入一致', async () => {
    // 检查耗时与链接长度成正比：完成的先后和输入顺序不同
    const report = await checkAll(['/c-longer', '/404-b', '/a', '/timeout', '/404'], fakeCheck);
    expect(report).toEqual({
      ok: ['/c-longer', '/a'],
      failed: [
        { url: '/404-b', message: '404：/404-b' },
        { url: '/timeout', message: 'timeout' },
        { url: '/404', message: '404：/404' },
      ],
    });
  });

  test('所有检查同时开始', async () => {
    const check = vi.fn(fakeCheck);
    const pending = checkAll(['/a', '/b', '/c'], check);
    expect(check).toHaveBeenCalledTimes(3);
    await pending;
  });

  test('全部不可用时也不会被拒绝', async () => {
    await expect(checkAll(['/404'], fakeCheck)).resolves.toEqual({
      ok: [],
      failed: [{ url: '/404', message: '404：/404' }],
    });
  });

  test('空数组', async () => {
    await expect(checkAll([], fakeCheck)).resolves.toEqual({ ok: [], failed: [] });
  });
});
```
:::

:::hint{level=1}
把 `Promise.all` 换成 `Promise.allSettled`：它从不被拒绝，结果数组中的每一项都告诉你对应的检查是成功还是失败。
:::

:::hint{level=2}
结果和 `urls` 一一对应。遍历 `urls`，用下标取出对应的结果（在 `noUncheckedIndexedAccess` 下它可能是 `undefined`，先检查一下），再用 `result.status === 'fulfilled'` 区分两种情况。失败的原因在 `result.reason` 中，把它交给一个参数类型是 `unknown` 的辅助函数处理。
:::

:::explanation
`Promise.allSettled` 等所有检查都完成，并且从不被拒绝，正好符合“部分失败也要继续，并且要知道哪些失败了”的需求。`urls.map((url) => check(url))` 一次性启动了所有检查，所以它们是同时进行的。

结果数组和 `urls` 的顺序一致，所以按下标配对就能知道每个结果属于哪个链接。`results[index]` 的类型带有 `undefined`（a10 的 `noUncheckedIndexedAccess`），两个数组长度相同，这个检查只是让类型检查通过。

`result.reason` 在标准库中的类型是 `any`。把它传给参数类型为 `unknown` 的 `messageOf`，函数内部就必须先检查再使用。注意测试中有一个检查抛出了字符串 `'timeout'` 而不是 `Error`：JavaScript 允许抛出任何值（a20），所以不能假设原因一定有 `message`。
:::

:::variant{kind=alt name=map-to-outcome}
```ts file=links.ts
export type Failure = { url: string; message: string };
export type Report = { ok: string[]; failed: Failure[] };

export async function checkAll(urls: readonly string[], check: (url: string) => Promise<void>): Promise<Report> {
  const outcomes = await Promise.all(
    urls.map(async (url) => {
      try {
        await check(url);
        return { url, message: null };
      } catch (err) {
        return { url, message: err instanceof Error ? err.message : String(err) };
      }
    }),
  );
  const failed: Failure[] = [];
  for (const outcome of outcomes) {
    if (outcome.message !== null) failed.push({ url: outcome.url, message: outcome.message });
  }
  return { ok: outcomes.filter((o) => o.message === null).map((o) => o.url), failed };
}
```
:::

:::variant{kind=wrong name=all-with-catch fails=tests reason="仍然用 Promise.all，第一个失败之后就不知道其他链接的结果了"}
```ts file=links.ts
export type Failure = { url: string; message: string };
export type Report = { ok: string[]; failed: Failure[] };

export async function checkAll(urls: readonly string[], check: (url: string) => Promise<void>): Promise<Report> {
  try {
    await Promise.all(urls.map((url) => check(url)));
    return { ok: [...urls], failed: [] };
  } catch (err) {
    return { ok: [], failed: [{ url: urls[0] ?? '', message: err instanceof Error ? err.message : String(err) }] };
  }
}
```
:::

:::variant{kind=wrong name=serial fails=tests reason="一个一个地检查，没有同时开始"}
```ts file=links.ts
export type Failure = { url: string; message: string };
export type Report = { ok: string[]; failed: Failure[] };

export async function checkAll(urls: readonly string[], check: (url: string) => Promise<void>): Promise<Report> {
  const report: Report = { ok: [], failed: [] };
  for (const url of urls) {
    try {
      await check(url);
      report.ok.push(url);
    } catch (err) {
      report.failed.push({ url, message: err instanceof Error ? err.message : String(err) });
    }
  }
  return report;
}
```
:::

:::variant{kind=wrong name=string-reason fails=tests reason="对 Error 也用了 String，消息前面多了 Error："}
```ts file=links.ts
export type Failure = { url: string; message: string };
export type Report = { ok: string[]; failed: Failure[] };

export async function checkAll(urls: readonly string[], check: (url: string) => Promise<void>): Promise<Report> {
  const results = await Promise.allSettled(urls.map((url) => check(url)));
  const report: Report = { ok: [], failed: [] };
  urls.forEach((url, index) => {
    const result = results[index];
    if (result === undefined) return;
    if (result.status === 'fulfilled') report.ok.push(url);
    else report.failed.push({ url, message: String(result.reason) });
  });
  return report;
}
```
:::

:::variant{kind=wrong name=missing-await fails=types reason="忘了 await，results 是 Promise 而不是结果数组"}
```ts file=links.ts
export type Failure = { url: string; message: string };
export type Report = { ok: string[]; failed: Failure[] };

export async function checkAll(urls: readonly string[], check: (url: string) => Promise<void>): Promise<Report> {
  const results = Promise.allSettled(urls.map((url) => check(url)));
  const report: Report = { ok: [], failed: [] };
  urls.forEach((url, index) => {
    const result = results[index];
    if (result === undefined) return;
    if (result.status === 'fulfilled') report.ok.push(url);
    else report.failed.push({ url, message: String(result.reason) });
  });
  return report;
}
```
:::
