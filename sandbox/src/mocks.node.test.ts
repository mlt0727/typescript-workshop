import { describe, expect, test } from 'vitest';
import { createMockFetch } from './mocks.ts';

const fixtures = [
  { url: '/api/user', body: { name: 'Ada' } },
  { url: '/api/slow', body: { ok: true }, delayMs: 200 },
  { url: '/api/slow-body', body: { ok: true }, delayMs: 5, bodyDelayMs: 200 },
  { url: '/api/empty', status: 204 },
  { url: '/api/down', networkError: true },
  { method: 'POST', url: '/api/items/*', status: 201, body: 'created' },
];

function setup() {
  const logs: string[] = [];
  const used = new Set<string>();
  const fetchImpl = createMockFetch(fixtures, (f) => used.add(f), (t) => logs.push(t));
  return { fetchImpl, logs, used };
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error('期望被拒绝，实际成功了');
}

describe('createMockFetch', () => {
  test('返回真实的 Response，相对地址以 https://app.example 为基准', async () => {
    const { fetchImpl, used } = setup();
    const res = await fetchImpl('/api/user');
    expect(res).toBeInstanceOf(Response);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(await res.json()).toEqual({ name: 'Ada' });
    expect(await (await fetchImpl('https://app.example/api/user')).json()).toEqual({ name: 'Ada' });
    expect([...used]).toEqual(['fetch']);
  });

  test('方法与通配符', async () => {
    const { fetchImpl } = setup();
    const res = await fetchImpl('/api/items/42', { method: 'post' });
    expect(res.status).toBe(201);
    expect(await res.text()).toBe('created');
  });

  test('204 没有响应体；没有匹配的请求和 networkError 以 TypeError 拒绝', async () => {
    const { fetchImpl, logs } = setup();
    const empty = await fetchImpl('/api/empty');
    expect(empty.status).toBe(204);
    expect(empty.body).toBeNull();
    expect(await rejection(fetchImpl('/api/down'))).toBeInstanceOf(TypeError);
    expect(await rejection(fetchImpl('/api/nothing'))).toBeInstanceOf(TypeError);
    expect(logs.some((t) => t.includes('/api/nothing'))).toBe(true);
  });

  test('等待响应头期间中止：以中止原因拒绝', async () => {
    const { fetchImpl } = setup();
    const controller = new AbortController();
    const reason = new Error('不要了');
    setTimeout(() => controller.abort(reason), 20);
    expect(await rejection(fetchImpl('/api/slow', { signal: controller.signal }))).toBe(reason);
    expect(await rejection(fetchImpl('/api/user', { signal: AbortSignal.abort() }))).toMatchObject({ name: 'AbortError' });
  });

  test('bodyDelayMs：响应头先到，响应体随后才传输完', async () => {
    const { fetchImpl } = setup();
    const start = Date.now();
    const res = await fetchImpl('/api/slow-body');
    expect(Date.now() - start).toBeLessThan(150);
    expect(await res.json()).toEqual({ ok: true });
    expect(Date.now() - start).toBeGreaterThanOrEqual(190);
  });

  test('bodyDelayMs：读取响应体期间中止，读取以中止原因失败', async () => {
    const { fetchImpl } = setup();
    const timeout = AbortSignal.timeout(60);
    const res = await fetchImpl('/api/slow-body', { signal: timeout });
    const err = await rejection(res.json());
    expect(err).toBeInstanceOf(DOMException);
    expect(err).toMatchObject({ name: 'TimeoutError' });
  });
});
