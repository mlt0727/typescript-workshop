---
kind: task
title: 可复用的数据加载 Hook
fixtures: users
timeoutMs: 15000
---
实现 `useJson.ts` 中的 `useJson(url, parse)`，返回 `{ state, reload }`，`state` 的类型是 `RemoteData<T>`：

1. `url` 为 `null` 时是 `{ status: 'idle' }`，不发请求，`reload()` 也什么都不做；
2. 否则请求 `url`（`fetch(url, { signal })`，传入中止信号），完成之前是 `{ status: 'loading' }`（换回最近一次已有结果的地址时，可以先显示那个结果）；
3. 成功时是 `{ status: 'success', data: parse(响应的 JSON) }`；
4. 失败时是 `{ status: 'error', message }`：状态码不是 2xx 时 `message` 是“服务器返回了 500”这样的文字；`parse` 抛出错误、网络失败时，用错误的 `message`；
5. `url` 变化时中止旧的请求；**被中止的请求不算失败**，它的结果也不能出现；
6. `reload()` 重新请求当前的地址，期间回到 `loading`；
7. 调用方传入内联的 `parse` 函数（每次渲染都是新的）时，不能因此重新请求；
8. 不要在 Effect 中同步地设置“加载中”：一次成功的加载只应该提交两次（组件出现时一次，结果到达时一次）；重试、换地址时也一样：操作本身一次，结果到达时一次；
9. `url` 变成 `null` 时，中止正在进行的请求，回到 `idle`；每次都使用最新传入的 `parse`。

`UserList.tsx`（只读）使用了这个 Hook，可以在预览中试试。

:::files{role=starter}
```ts file=useJson.ts
import { useEffect, useState } from 'react';

export type RemoteData<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

type Outcome<T> = Extract<RemoteData<T>, { status: 'error' } | { status: 'success' }>;

/**
 * 请求 url 并用 parse 验证结果；url 为 null 时不请求。
 * 现在它只能显示“加载中”。
 */
export function useJson<T>(url: string | null, parse: (value: unknown) => T): { state: RemoteData<T>; reload: () => void } {
  const [state, setState] = useState<RemoteData<T>>({ status: 'loading' });
  useEffect(() => {
    // TODO：请求 url，处理成功、失败、中止
  }, [url]);
  return { state, reload: () => {} };
}
```
:::

:::files{role=support}
```tsx file=UserList.tsx readonly
import { useJson } from './useJson';

export type User = { id: number; name: string };

export function parseUsers(value: unknown): User[] {
  if (!Array.isArray(value)) throw new Error('数据格式不正确');
  return value.map((item: unknown) => {
    if (typeof item === 'object' && item !== null && 'id' in item && 'name' in item && typeof item.id === 'number' && typeof item.name === 'string') {
      return { id: item.id, name: item.name };
    }
    throw new Error('数据格式不正确');
  });
}

export function UserList({ url }: { url: string | null }) {
  const { state, reload } = useJson(url, parseUsers);
  return (
    <>
      <p role="status">{state.status === 'loading' ? '正在加载…' : ''}</p>
      {state.status === 'error' && (
        <div role="alert">
          加载失败：{state.message}{' '}
          <button type="button" onClick={reload}>
            重试
          </button>
        </div>
      )}
      {state.status === 'success' && (
        <ul aria-label="用户">
          {state.data.map((user) => (
            <li key={user.id}>{user.name}</li>
          ))}
        </ul>
      )}
    </>
  );
}
```
```tsx file=main.tsx readonly
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { UserList } from './UserList';

const SOURCES = ['/api/users', '/api/users/slow', '/api/users/broken', '/api/users/bad'];

function App() {
  const [url, setUrl] = useState<string | null>(null);
  return (
    <>
      <p>
        {SOURCES.map((s) => (
          <button key={s} type="button" aria-pressed={s === url} onClick={() => setUrl(s)}>
            {s}
          </button>
        ))}
      </p>
      <UserList url={url} />
    </>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<App />);
```
:::

:::files{role=solution}
```ts file=useJson.ts
import { useEffect, useEffectEvent, useState } from 'react';

export type RemoteData<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

type Outcome<T> = Extract<RemoteData<T>, { status: 'error' } | { status: 'success' }>;

export function useJson<T>(url: string | null, parse: (value: unknown) => T): { state: RemoteData<T>; reload: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ url: string; attempt: number; outcome: Outcome<T> } | null>(null);
  const parseLatest = useEffectEvent(parse);

  useEffect(() => {
    if (url === null) return;
    const controller = new AbortController();
    const settle = (outcome: Outcome<T>) => setResult({ url, attempt, outcome });
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`服务器返回了 ${response.status}`);
        settle({ status: 'success', data: parseLatest(await response.json()) });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        settle({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      });
    return () => controller.abort();
  }, [url, attempt]);

  let state: RemoteData<T> = { status: 'idle' };
  if (url !== null) state = result !== null && result.url === url && result.attempt === attempt ? result.outcome : { status: 'loading' };

  return {
    state,
    reload() {
      if (url !== null) setAttempt((n) => n + 1);
    },
  };
}
```
:::

:::files{role=tests}
```tsx file=useJson.test.tsx
import { Profiler } from 'react';
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { useJson } from './useJson';
import { parseUsers, UserList } from './UserList';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const USERS = [
  { id: 1, name: '韩梅梅' },
  { id: 2, name: '李雷' },
];

afterEach(() => {
  vi.restoreAllMocks();
});

test('url 为 null：idle，不发请求；reload 也什么都不做', () => {
  const fetchSpy = vi.spyOn(window, 'fetch');
  const { result } = renderHook(() => useJson(null, parseUsers));
  expect(result.current.state).toEqual({ status: 'idle' });
  act(() => result.current.reload());
  expect(result.current.state).toEqual({ status: 'idle' });
  expect(fetchSpy).not.toHaveBeenCalled();
});

test('先是 loading，然后是 success；请求带着中止信号', async () => {
  const fetchSpy = vi.spyOn(window, 'fetch');
  const { result } = renderHook(() => useJson('/api/users', parseUsers));
  expect(result.current.state).toEqual({ status: 'loading' });
  await waitFor(() => expect(result.current.state).toEqual({ status: 'success', data: USERS }));
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  expect(fetchSpy.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
});

test('失败：状态码不是 2xx、数据格式不对、网络失败', async () => {
  const broken = renderHook(() => useJson('/api/users/broken', parseUsers));
  await waitFor(() => expect(broken.result.current.state).toEqual({ status: 'error', message: '服务器返回了 500' }));
  const bad = renderHook(() => useJson('/api/users/bad', parseUsers));
  await waitFor(() => expect(bad.result.current.state).toEqual({ status: 'error', message: '数据格式不正确' }));
  vi.spyOn(window, 'fetch').mockImplementationOnce(() => Promise.reject(new TypeError('网络连接失败')));
  const offline = renderHook(() => useJson('/api/users', parseUsers));
  await waitFor(() => expect(offline.result.current.state).toEqual({ status: 'error', message: '网络连接失败' }));
});

test('重试：重新请求当前的地址，期间显示加载中', async () => {
  const fetchSpy = vi.spyOn(window, 'fetch').mockImplementationOnce(() => Promise.reject(new TypeError('网络连接失败')));
  const user = userEvent.setup();
  render(<UserList url="/api/users" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('加载失败：网络连接失败');
  await user.click(screen.getByRole('button', { name: '重试' }));
  expect(screen.getByRole('status')).toHaveTextContent('正在加载…');
  expect(screen.queryByRole('alert')).toBeNull();
  const list = await screen.findByRole('list', { name: '用户' });
  expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['韩梅梅', '李雷']);
  expect(fetchSpy).toHaveBeenCalledTimes(2);
});

test('url 变化：中止旧的请求；被中止的请求不算失败，旧的结果也不会出现', async () => {
  const fetchSpy = vi.spyOn(window, 'fetch');
  const { result, rerender } = renderHook(({ url }) => useJson(url, parseUsers), { initialProps: { url: '/api/users/slow' } });
  rerender({ url: '/api/users' });
  expect(fetchSpy.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  await wait(30);
  rerender({ url: '/api/users/slow' });
  expect(result.current.state, '换回来时应该重新加载，而不是显示上一次被中止的请求的“失败”').toEqual({ status: 'loading' });
  rerender({ url: '/api/users' });
  await waitFor(() => expect(result.current.state).toEqual({ status: 'success', data: USERS }));
  await wait(900);
  expect(result.current.state, '被中止的慢请求的结果不能出现').toEqual({ status: 'success', data: USERS });
});

test('传入内联的 parse 函数也不会重复请求', async () => {
  const fetchSpy = vi.spyOn(window, 'fetch');
  function Inline() {
    const { state } = useJson('/api/users', (value) => parseUsers(value));
    return <p>{state.status}</p>;
  }
  render(<Inline />);
  expect(await screen.findByText('success')).toBeInTheDocument();
  await wait(300);
  expect(fetchSpy, '每次渲染的 parse 都是新函数，不能因此重新请求').toHaveBeenCalledTimes(1);
});

test('url 变成 null：中止请求，回到 idle', () => {
  const fetchSpy = vi.spyOn(window, 'fetch');
  const { result, rerender } = renderHook(({ url }: { url: string | null }) => useJson(url, parseUsers), { initialProps: { url: '/api/users/slow' as string | null } });
  rerender({ url: null });
  expect(result.current.state).toEqual({ status: 'idle' });
  expect(fetchSpy.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
});

test('使用最新传入的 parse', async () => {
  const { result, rerender } = renderHook(({ parse }: { parse: (value: unknown) => string }) => useJson('/api/users', parse), {
    initialProps: { parse: () => '第一次传入的 parse' },
  });
  rerender({ parse: () => '最新的 parse' });
  await waitFor(() => expect(result.current.state).toEqual({ status: 'success', data: '最新的 parse' }));
});

test('一次成功的加载只提交两次：出现时一次，结果到达时一次', async () => {
  const commits: string[] = [];
  render(
    <Profiler id="list" onRender={(_id, phase) => commits.push(phase)}>
      <UserList url="/api/users" />
    </Profiler>,
  );
  await screen.findByRole('list', { name: '用户' });
  expect(commits, '不要在 Effect 中同步地设置“加载中”：根据结果属于哪一次请求，在渲染时推出来').toEqual(['mount', 'update']);
});

test('重试、换地址时也只多提交两次：操作本身一次，结果到达时一次', async () => {
  const commits: string[] = [];
  const tree = (url: string) => (
    <Profiler id="list" onRender={(_id, phase) => commits.push(phase)}>
      <UserList url={url} />
    </Profiler>
  );
  const user = userEvent.setup();
  const { rerender } = render(tree('/api/users/broken'));
  await screen.findByRole('alert');
  commits.length = 0;
  await user.click(screen.getByRole('button', { name: '重试' }));
  await screen.findByRole('alert');
  await wait(50);
  expect(commits, '重试时多提交了：不要在 Effect 中设置“加载中”').toEqual(['update', 'update']);
  commits.length = 0;
  rerender(tree('/api/users'));
  await screen.findByRole('list', { name: '用户' });
  expect(commits, '换地址时多提交了：不要在 Effect 中设置“加载中”').toEqual(['update', 'update']);
});
```
:::

:::hint{level=1}
按本课示例的思路：state 中记住“最近一次的结果属于哪个地址、第几次尝试”（`{ url, attempt, outcome }`），渲染时比较它和当前的 `url`、`attempt`，不一致就是 `loading`。`reload` 只是让 `attempt` 加 1。
:::

:::hint{level=2}
Effect 的依赖是 `[url, attempt]`；`url === null` 时直接返回。用 `const parseLatest = useEffectEvent(parse)`，在 Effect 中调用 `parseLatest(…)`，`parse` 就不用写进依赖。`catch` 中先检查 `controller.signal.aborted`，是自己中止的就什么都不做；清理函数中 `controller.abort()`。
:::

:::explanation
这个 Hook 的每一个细节都对应前面讲过的一个问题：

- **状态的形状**（e07、b09）：可辨识联合让“成功时才有 `data`、失败时才有 `message`”由类型保证；
- **加载中是推出来的**（g11、g12）：如果在 Effect 一开始 `setState({ status: 'loading' })`，每次请求都会多一次渲染，而且地址变化后的第一次渲染中，state 还停留在上一个地址的结果上。即使写成“已经是加载中就不设置”，重试和换地址时仍然多一次（最后一个测试检查的就是这些情况）。记住结果属于哪一次请求，渲染时一比较就知道是不是加载中，最后一个测试检查的就是这一点；
- **取消与竞态**（e08）：清理函数中止过时的请求，`catch` 中识别出“这是我们自己中止的”。如果把被中止的请求当成失败，它的错误结果会记在旧的地址上，用户换回这个地址时，就会立刻看到一个并没有发生的“失败”（第五个测试）；
- **最新的回调**（g11）：`parse` 写进依赖数组，调用方一写内联函数，每次渲染都会重新请求：请求完成、更新 state、重新渲染、新的 `parse`、又一次请求……`useEffectEvent` 让 Effect 读到最新的 `parse`，又不把它当成依赖。

替代解用了另一组写法：用 ref 保存最新的 `parse`（`useEffectEvent` 出现之前的常见做法），用 async 函数加上 `try/catch`，结果的“归属”用一个字符串表示。
:::

:::variant{kind=alt name=ref-and-async}
```ts file=useJson.ts
import { useEffect, useRef, useState } from 'react';

export type RemoteData<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

type Outcome<T> = Extract<RemoteData<T>, { status: 'error' } | { status: 'success' }>;

export function useJson<T>(url: string | null, parse: (value: unknown) => T): { state: RemoteData<T>; reload: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<{ key: string; outcome: Outcome<T> } | null>(null);
  const latestParse = useRef(parse);
  useEffect(() => {
    latestParse.current = parse;
  });

  const key = url === null ? null : `${attempt} ${url}`;

  useEffect(() => {
    if (url === null) return undefined;
    const requestKey = `${attempt} ${url}`;
    const controller = new AbortController();
    async function load(target: string) {
      try {
        const response = await fetch(target, { signal: controller.signal });
        if (!response.ok) throw new Error(`服务器返回了 ${response.status}`);
        const json: unknown = await response.json();
        setSettled({ key: requestKey, outcome: { status: 'success', data: latestParse.current(json) } });
      } catch (error) {
        if (!controller.signal.aborted) {
          setSettled({ key: requestKey, outcome: { status: 'error', message: error instanceof Error ? error.message : String(error) } });
        }
      }
    }
    void load(url);
    return () => controller.abort();
  }, [url, attempt]);

  const state: RemoteData<T> = key === null ? { status: 'idle' } : settled?.key === key ? settled.outcome : { status: 'loading' };
  return {
    state,
    reload() {
      if (url !== null) setAttempt((n) => n + 1);
    },
  };
}
```
:::

:::variant{kind=wrong name=parse-in-deps fails=tests reason="把 parse 写进了依赖数组，调用方传入内联函数时每次渲染都重新请求"}
```ts file=useJson.ts
import { useEffect, useState } from 'react';

export type RemoteData<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

type Outcome<T> = Extract<RemoteData<T>, { status: 'error' } | { status: 'success' }>;

export function useJson<T>(url: string | null, parse: (value: unknown) => T): { state: RemoteData<T>; reload: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ url: string; attempt: number; outcome: Outcome<T> } | null>(null);

  useEffect(() => {
    if (url === null) return;
    const controller = new AbortController();
    const settle = (outcome: Outcome<T>) => setResult({ url, attempt, outcome });
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`服务器返回了 ${response.status}`);
        settle({ status: 'success', data: parse(await response.json()) });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        settle({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      });
    return () => controller.abort();
  }, [url, attempt, parse]);

  let state: RemoteData<T> = { status: 'idle' };
  if (url !== null) state = result !== null && result.url === url && result.attempt === attempt ? result.outcome : { status: 'loading' };

  return {
    state,
    reload() {
      if (url !== null) setAttempt((n) => n + 1);
    },
  };
}
```
:::

:::variant{kind=wrong name=abort-as-error fails=tests reason="被中止的请求也记成了失败，换回旧的地址时立刻显示错误"}
```ts file=useJson.ts
import { useEffect, useEffectEvent, useState } from 'react';

export type RemoteData<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

type Outcome<T> = Extract<RemoteData<T>, { status: 'error' } | { status: 'success' }>;

export function useJson<T>(url: string | null, parse: (value: unknown) => T): { state: RemoteData<T>; reload: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ url: string; attempt: number; outcome: Outcome<T> } | null>(null);
  const parseLatest = useEffectEvent(parse);

  useEffect(() => {
    if (url === null) return;
    const controller = new AbortController();
    const settle = (outcome: Outcome<T>) => setResult({ url, attempt, outcome });
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`服务器返回了 ${response.status}`);
        settle({ status: 'success', data: parseLatest(await response.json()) });
      })
      .catch((error: unknown) => {
        settle({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      });
    return () => controller.abort();
  }, [url, attempt]);

  let state: RemoteData<T> = { status: 'idle' };
  if (url !== null) state = result !== null && result.url === url && result.attempt === attempt ? result.outcome : { status: 'loading' };

  return {
    state,
    reload() {
      if (url !== null) setAttempt((n) => n + 1);
    },
  };
}
```
:::

:::variant{kind=wrong name=ignore-status fails=tests reason="没有检查 response.ok，服务器出错时报告成了“数据格式不正确”"}
```ts file=useJson.ts
import { useEffect, useEffectEvent, useState } from 'react';

export type RemoteData<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

type Outcome<T> = Extract<RemoteData<T>, { status: 'error' } | { status: 'success' }>;

export function useJson<T>(url: string | null, parse: (value: unknown) => T): { state: RemoteData<T>; reload: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ url: string; attempt: number; outcome: Outcome<T> } | null>(null);
  const parseLatest = useEffectEvent(parse);

  useEffect(() => {
    if (url === null) return;
    const controller = new AbortController();
    const settle = (outcome: Outcome<T>) => setResult({ url, attempt, outcome });
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        settle({ status: 'success', data: parseLatest(await response.json()) });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        settle({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      });
    return () => controller.abort();
  }, [url, attempt]);

  let state: RemoteData<T> = { status: 'idle' };
  if (url !== null) state = result !== null && result.url === url && result.attempt === attempt ? result.outcome : { status: 'loading' };

  return {
    state,
    reload() {
      if (url !== null) setAttempt((n) => n + 1);
    },
  };
}
```
:::

:::variant{kind=wrong name=no-signal fails=tests reason="没有把中止信号传给 fetch，旧的请求没有被真正取消"}
```ts file=useJson.ts
import { useEffect, useEffectEvent, useState } from 'react';

export type RemoteData<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

type Outcome<T> = Extract<RemoteData<T>, { status: 'error' } | { status: 'success' }>;

export function useJson<T>(url: string | null, parse: (value: unknown) => T): { state: RemoteData<T>; reload: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ url: string; attempt: number; outcome: Outcome<T> } | null>(null);
  const parseLatest = useEffectEvent(parse);

  useEffect(() => {
    if (url === null) return;
    const controller = new AbortController();
    const settle = (outcome: Outcome<T>) => setResult({ url, attempt, outcome });
    fetch(url)
      .then(async (response) => {
        if (!response.ok) throw new Error(`服务器返回了 ${response.status}`);
        settle({ status: 'success', data: parseLatest(await response.json()) });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        settle({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      });
    return () => controller.abort();
  }, [url, attempt]);

  let state: RemoteData<T> = { status: 'idle' };
  if (url !== null) state = result !== null && result.url === url && result.attempt === attempt ? result.outcome : { status: 'loading' };

  return {
    state,
    reload() {
      if (url !== null) setAttempt((n) => n + 1);
    },
  };
}
```
:::

:::variant{kind=wrong name=sync-loading fails=tests reason="在 Effect 中同步地设置“加载中”，每次加载都多一次渲染"}
```ts file=useJson.ts
import { useEffect, useEffectEvent, useState } from 'react';

export type RemoteData<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

type Outcome<T> = Extract<RemoteData<T>, { status: 'error' } | { status: 'success' }>;

export function useJson<T>(url: string | null, parse: (value: unknown) => T): { state: RemoteData<T>; reload: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<RemoteData<T>>(url === null ? { status: 'idle' } : { status: 'loading' });
  const parseLatest = useEffectEvent(parse);

  useEffect(() => {
    if (url === null) {
      setState({ status: 'idle' });
      return;
    }
    setState({ status: 'loading' });
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`服务器返回了 ${response.status}`);
        setState({ status: 'success', data: parseLatest(await response.json()) });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      });
    return () => controller.abort();
  }, [url, attempt]);

  return { state, reload: () => setAttempt((n) => n + 1) };
}
```
:::

:::variant{kind=wrong name=guarded-sync-loading fails=tests reason="在 Effect 中设置“加载中”时先判断是否已经是加载中，挂载时没有多余的渲染，但重试、换地址时仍然多一次"}
```ts file=useJson.ts
import { useEffect, useEffectEvent, useState } from 'react';

export type RemoteData<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

type Outcome<T> = Extract<RemoteData<T>, { status: 'error' } | { status: 'success' }>;

export function useJson<T>(url: string | null, parse: (value: unknown) => T): { state: RemoteData<T>; reload: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<RemoteData<T>>(url === null ? { status: 'idle' } : { status: 'loading' });
  const parseLatest = useEffectEvent(parse);

  useEffect(() => {
    if (url === null) {
      setState({ status: 'idle' });
      return;
    }
    setState((current) => (current.status === 'loading' ? current : { status: 'loading' }));
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`服务器返回了 ${response.status}`);
        setState({ status: 'success', data: parseLatest(await response.json()) });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      });
    return () => controller.abort();
  }, [url, attempt]);

  return { state, reload: () => setAttempt((n) => n + 1) };
}
```
:::

:::variant{kind=wrong name=stale-parse fails=tests reason="ref 只保存了第一次传入的 parse，之后没有更新"}
```ts file=useJson.ts
import { useEffect, useRef, useState } from 'react';

export type RemoteData<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

type Outcome<T> = Extract<RemoteData<T>, { status: 'error' } | { status: 'success' }>;

export function useJson<T>(url: string | null, parse: (value: unknown) => T): { state: RemoteData<T>; reload: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<{ key: string; outcome: Outcome<T> } | null>(null);
  const latestParse = useRef(parse);

  const key = url === null ? null : `${attempt} ${url}`;

  useEffect(() => {
    if (url === null) return undefined;
    const requestKey = `${attempt} ${url}`;
    const controller = new AbortController();
    async function load(target: string) {
      try {
        const response = await fetch(target, { signal: controller.signal });
        if (!response.ok) throw new Error(`服务器返回了 ${response.status}`);
        const json: unknown = await response.json();
        setSettled({ key: requestKey, outcome: { status: 'success', data: latestParse.current(json) } });
      } catch (error) {
        if (!controller.signal.aborted) {
          setSettled({ key: requestKey, outcome: { status: 'error', message: error instanceof Error ? error.message : String(error) } });
        }
      }
    }
    void load(url);
    return () => controller.abort();
  }, [url, attempt]);

  const state: RemoteData<T> = key === null ? { status: 'idle' } : settled?.key === key ? settled.outcome : { status: 'loading' };
  return {
    state,
    reload() {
      if (url !== null) setAttempt((n) => n + 1);
    },
  };
}
```
:::
