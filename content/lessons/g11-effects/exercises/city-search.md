---
kind: challenge
title: 带防抖的城市搜索
fixtures: cities
---
`CitySearch` 的界面已经写好：它根据 `result` 显示“正在搜索…”、建议列表、“没有匹配的城市”或错误。你要写的是那个 Effect：

1. 搜索词是输入框的内容去掉首尾空白；为空时不请求；
2. 搜索词变化后，等待 **300 毫秒**没有新的输入，才请求 `/api/cities?q=搜索词`（用 `encodeURIComponent` 编码）；连续输入只请求最后一次；
3. 响应必须是字符串数组，成功时 `setResult({ query, cities })`；状态码不是 2xx、数据格式不对、网络失败时 `setResult({ query, error: true })`；
4. 搜索词变化或组件消失时，**取消**还没到时间的计时器，并**中止**正在进行的请求；被中止的请求不算失败。

界面只显示与当前搜索词对应的结果（`result.query === query`），所以不需要在 Effect 中重置 `result`。模拟的服务器中，“广”的响应要 800 毫秒，其他的都很快。

:::files{role=starter}
```tsx file=CitySearch.tsx
import { useEffect, useState } from 'react';

const DELAY = 300;

type Result = { query: string; cities: readonly string[] } | { query: string; error: true };

function isCityList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === 'string');
}

export function CitySearch() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const query = text.trim();

  // TODO：输入停止 300 毫秒后请求；查询变化或组件消失时取消计时器和请求

  const current = result !== null && result.query === query ? result : null;

  return (
    <div>
      <label>
        搜索城市 <input value={text} onChange={(e) => setText(e.currentTarget.value)} />
      </label>
      {query === '' ? null : current === null ? (
        <p role="status">正在搜索…</p>
      ) : 'error' in current ? (
        <p role="alert">搜索失败，请重试</p>
      ) : current.cities.length === 0 ? (
        <p>没有匹配的城市</p>
      ) : (
        <ul aria-label="建议">
          {current.cities.map((city) => (
            <li key={city}>{city}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```
:::

:::files{role=support}
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { CitySearch } from './CitySearch';

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<CitySearch />);
```
:::

:::files{role=solution}
```tsx file=CitySearch.tsx
import { useEffect, useState } from 'react';

const DELAY = 300;

type Result = { query: string; cities: readonly string[] } | { query: string; error: true };

function isCityList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === 'string');
}

export function CitySearch() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const query = text.trim();

  useEffect(() => {
    if (query === '') return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/cities?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`状态码 ${response.status}`);
        const data: unknown = await response.json();
        if (!isCityList(data)) throw new Error('数据格式不正确');
        setResult({ query, cities: data });
      } catch {
        if (!controller.signal.aborted) setResult({ query, error: true });
      }
    }, DELAY);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const current = result !== null && result.query === query ? result : null;

  return (
    <div>
      <label>
        搜索城市 <input value={text} onChange={(e) => setText(e.currentTarget.value)} />
      </label>
      {query === '' ? null : current === null ? (
        <p role="status">正在搜索…</p>
      ) : 'error' in current ? (
        <p role="alert">搜索失败，请重试</p>
      ) : current.cities.length === 0 ? (
        <p>没有匹配的城市</p>
      ) : (
        <ul aria-label="建议">
          {current.cities.map((city) => (
            <li key={city}>{city}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```
:::

:::files{role=tests}
```tsx file=CitySearch.test.tsx
import { expect, test, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CitySearch } from './CitySearch';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const input = () => screen.getByLabelText('搜索城市');
const suggestions = () => within(screen.getByRole('list', { name: '建议' })).getAllByRole('listitem').map((li) => li.textContent);

test('输入停止 300 毫秒后才请求，连续输入只请求一次', async () => {
  const fetchSpy = vi.spyOn(window, 'fetch');
  const user = userEvent.setup();
  render(<CitySearch />);
  await user.type(input(), '上海');
  expect(screen.getByRole('status')).toHaveTextContent('正在搜索…');
  await wait(150);
  expect(fetchSpy).not.toHaveBeenCalled();
  await waitFor(() => expect(suggestions()).toEqual(['上海']));
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  const [url] = fetchSpy.mock.calls[0] ?? [];
  expect(String(url)).toContain(`q=${encodeURIComponent('上海')}`);
});

test('清空输入时什么都不显示，也不请求', async () => {
  const fetchSpy = vi.spyOn(window, 'fetch');
  const user = userEvent.setup();
  render(<CitySearch />);
  await user.type(input(), '  ');
  await wait(400);
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(screen.queryByRole('status')).toBeNull();
});

test('慢的旧请求被中止，不会覆盖新的结果', async () => {
  const fetchSpy = vi.spyOn(window, 'fetch');
  const user = userEvent.setup();
  render(<CitySearch />);
  await user.type(input(), '广');
  await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
  await user.clear(input());
  await user.type(input(), '深');
  await waitFor(() => expect(suggestions()).toEqual(['深圳']));
  const firstSignal = fetchSpy.mock.calls[0]?.[1]?.signal;
  expect(firstSignal?.aborted).toBe(true);
  await wait(900);
  expect(suggestions()).toEqual(['深圳']);
});

test('没有结果和失败', async () => {
  const user = userEvent.setup();
  render(<CitySearch />);
  await user.type(input(), '雪');
  expect(await screen.findByText('没有匹配的城市')).toBeInTheDocument();
  await user.clear(input());
  await user.type(input(), '错');
  expect(await screen.findByRole('alert')).toHaveTextContent('搜索失败，请重试');
});

test('组件消失时取消正在进行的请求', async () => {
  const fetchSpy = vi.spyOn(window, 'fetch');
  const user = userEvent.setup();
  const { unmount } = render(<CitySearch />);
  await user.type(input(), '广');
  await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
  unmount();
  expect(fetchSpy.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
});
```
:::

:::hint{level=1}
一个 Effect，依赖是 `[query]`。在 Effect 中：搜索词为空就直接返回；否则创建一个 `AbortController`，用 `setTimeout` 延迟 300 毫秒发请求。清理函数中 `clearTimeout` 并且 `controller.abort()`。
:::

:::hint{level=2}
`setTimeout` 的回调可以是 async 函数：在里面 `await fetch(url, { signal: controller.signal })`，检查 `response.ok`，再用 `isCityList` 验证 `response.json()` 的结果。`catch` 中先判断 `controller.signal.aborted`：是我们自己中止的，就什么都不做。
:::

:::explanation
防抖、取消和竞态，这三个问题 e01 和 e08 都讲过；在 React 中，它们都由**同一个清理函数**解决：

- 用户每输入一个字，`query` 变化，React 先运行上一次 Effect 的清理函数：还没到时间的计时器被清除，就实现了防抖；
- 已经发出的请求被中止，它的结果永远不会被设置，就避免了“后发先至”；
- 组件消失时，清理函数同样会运行，不会有请求在后台继续，也不会去更新一个已经不在页面上的组件。

界面显示什么，是在渲染时从 `result` 和当前的 `query` 算出来的：结果对应的不是当前的搜索词，就显示“正在搜索…”。这样 Effect 只在请求完成时设置 state，不需要在一开始同步地重置它（下一课会讲为什么要尽量避免在 Effect 中同步地设置 state）。
:::

:::variant{kind=alt name=helper-function}
```tsx file=CitySearch.tsx
import { useEffect, useState } from 'react';

const DELAY = 300;

type Result = { query: string; cities: readonly string[] } | { query: string; error: true };

function isCityList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === 'string');
}

async function searchCities(query: string, signal: AbortSignal): Promise<Result> {
  const response = await fetch(`/api/cities?${new URLSearchParams({ q: query }).toString().replace(/\+/g, '%20')}`, { signal });
  if (!response.ok) return { query, error: true };
  const data: unknown = await response.json().catch(() => null);
  return isCityList(data) ? { query, cities: data } : { query, error: true };
}

export function CitySearch() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const query = text.trim();

  useEffect(() => {
    if (!query) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchCities(query, controller.signal).then(setResult, () => {
        if (!controller.signal.aborted) setResult({ query, error: true });
      });
    }, DELAY);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const current = result?.query === query ? result : null;

  return (
    <div>
      <label>
        搜索城市 <input value={text} onChange={(e) => setText(e.currentTarget.value)} />
      </label>
      {query === '' ? null : current === null ? (
        <p role="status">正在搜索…</p>
      ) : 'error' in current ? (
        <p role="alert">搜索失败，请重试</p>
      ) : current.cities.length === 0 ? (
        <p>没有匹配的城市</p>
      ) : (
        <ul aria-label="建议">
          {current.cities.map((city) => (
            <li key={city}>{city}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```
:::

:::variant{kind=wrong name=no-debounce fails=tests reason="没有防抖，每输入一个字就请求一次"}
```tsx file=CitySearch.tsx
import { useEffect, useState } from 'react';

const DELAY = 300;

type Result = { query: string; cities: readonly string[] } | { query: string; error: true };

function isCityList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === 'string');
}

export function CitySearch() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const query = text.trim();

  useEffect(() => {
    if (query === '') return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/cities?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`状态码 ${response.status}`);
        const data: unknown = await response.json();
        if (!isCityList(data)) throw new Error('数据格式不正确');
        setResult({ query, cities: data });
      } catch {
        if (!controller.signal.aborted) setResult({ query, error: true });
      }
    }
    void load();
    return () => controller.abort();
  }, [query]);

  const current = result !== null && result.query === query ? result : null;

  return (
    <div>
      <label>
        搜索城市 <input value={text} onChange={(e) => setText(e.currentTarget.value)} />
      </label>
      {query === '' ? null : current === null ? (
        <p role="status">正在搜索…</p>
      ) : 'error' in current ? (
        <p role="alert">搜索失败，请重试</p>
      ) : current.cities.length === 0 ? (
        <p>没有匹配的城市</p>
      ) : (
        <ul aria-label="建议">
          {current.cities.map((city) => (
            <li key={city}>{city}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```
:::

:::variant{kind=wrong name=no-abort fails=tests reason="没有中止旧的请求，组件消失后请求仍在进行"}
```tsx file=CitySearch.tsx
import { useEffect, useState } from 'react';

const DELAY = 300;

type Result = { query: string; cities: readonly string[] } | { query: string; error: true };

function isCityList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === 'string');
}

export function CitySearch() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const query = text.trim();

  useEffect(() => {
    if (query === '') return;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/cities?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error(`状态码 ${response.status}`);
        const data: unknown = await response.json();
        if (!isCityList(data)) throw new Error('数据格式不正确');
        setResult({ query, cities: data });
      } catch {
        setResult({ query, error: true });
      }
    }, DELAY);
    return () => window.clearTimeout(timer);
  }, [query]);

  const current = result !== null && result.query === query ? result : null;

  return (
    <div>
      <label>
        搜索城市 <input value={text} onChange={(e) => setText(e.currentTarget.value)} />
      </label>
      {query === '' ? null : current === null ? (
        <p role="status">正在搜索…</p>
      ) : 'error' in current ? (
        <p role="alert">搜索失败，请重试</p>
      ) : current.cities.length === 0 ? (
        <p>没有匹配的城市</p>
      ) : (
        <ul aria-label="建议">
          {current.cities.map((city) => (
            <li key={city}>{city}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```
:::

:::variant{kind=wrong name=no-clear-timer fails=tests reason="没有清除计时器，连续输入时每个字都发出了请求"}
```tsx file=CitySearch.tsx
import { useEffect, useState } from 'react';

const DELAY = 300;

type Result = { query: string; cities: readonly string[] } | { query: string; error: true };

function isCityList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === 'string');
}

export function CitySearch() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const query = text.trim();

  useEffect(() => {
    if (query === '') return;
    const controller = new AbortController();
    window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/cities?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`状态码 ${response.status}`);
        const data: unknown = await response.json();
        if (!isCityList(data)) throw new Error('数据格式不正确');
        setResult({ query, cities: data });
      } catch {
        if (!controller.signal.aborted) setResult({ query, error: true });
      }
    }, DELAY);
    return () => controller.abort();
  }, [query]);

  const current = result !== null && result.query === query ? result : null;

  return (
    <div>
      <label>
        搜索城市 <input value={text} onChange={(e) => setText(e.currentTarget.value)} />
      </label>
      {query === '' ? null : current === null ? (
        <p role="status">正在搜索…</p>
      ) : 'error' in current ? (
        <p role="alert">搜索失败，请重试</p>
      ) : current.cities.length === 0 ? (
        <p>没有匹配的城市</p>
      ) : (
        <ul aria-label="建议">
          {current.cities.map((city) => (
            <li key={city}>{city}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```
:::
