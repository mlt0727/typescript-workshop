import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockFetch } from './local-mock-fetch.ts';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('createMockFetch（导出到本地项目的模拟 fetch）', () => {
  const fetch = createMockFetch([
    { url: '/api/books?q=*', body: [{ id: 1, title: 'TS' }], delayMs: 100 },
    { url: 'https://api.example/text', body: '纯文本', headers: { 'content-type': 'text/plain' } },
    { url: '/api/save', method: 'POST', status: 201, body: { ok: true } },
    { url: '/api/empty', status: 204, body: 'ignored' },
    { url: '/api/down', networkError: true },
    { url: '/api/slow-body', body: { done: true }, bodyDelayMs: 200 },
  ]);

  it('相对地址按 https://app.example 解析，* 匹配任意字符，JSON 自动加上 content-type', async () => {
    vi.useFakeTimers();
    const pending = fetch('/api/books?q=type%20script');
    await vi.advanceTimersByTimeAsync(100);
    const res = await pending;
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(await res.json()).toEqual([{ id: 1, title: 'TS' }]);
  });

  it('字符串原样返回；按方法匹配；204 没有响应体', async () => {
    expect(await (await fetch('https://api.example/text')).text()).toBe('纯文本');
    const saved = await fetch(new Request('https://app.example/api/save', { method: 'POST' }));
    expect(saved.status).toBe(201);
    const empty = await fetch('/api/empty');
    expect(empty.status).toBe(204);
    expect(await empty.text()).toBe('');
  });

  it('没有配置的地址、networkError 都以 TypeError 失败', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(fetch('/api/save')).rejects.toThrow(TypeError);
    await expect(fetch('/nowhere')).rejects.toThrow('Failed to fetch');
    await expect(fetch('/api/down')).rejects.toThrow(TypeError);
  });

  it('等待响应时中止：以中止的原因拒绝', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const pending = fetch('/api/books?q=a', { signal: controller.signal });
    controller.abort(new Error('不要了'));
    await expect(pending).rejects.toThrow('不要了');
    await expect(fetch('/api/books?q=a', { signal: controller.signal })).rejects.toThrow('不要了');
  });

  it('读取响应体时中止：读取以中止的原因失败', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const res = await fetch('/api/slow-body', { signal: controller.signal });
    const reading = res.json();
    controller.abort();
    await expect(reading).rejects.toMatchObject({ name: 'AbortError' });

    const ok = await fetch('/api/slow-body');
    const body = ok.json();
    await vi.advanceTimersByTimeAsync(200);
    expect(await body).toEqual({ done: true });
  });
});
