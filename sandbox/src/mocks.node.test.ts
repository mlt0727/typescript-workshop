import { describe, expect, test } from 'vitest';
import { createMemoryStorage, createMockFetch, MemoryStorage } from './mocks.ts';
import { restoreAllMocks, spyOn } from './testing/mock.ts';

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

describe('createMemoryStorage', () => {
  test('与 Web Storage 一致：值转成字符串，条目也可以像属性一样读写', () => {
    const used = new Set<string>();
    const storage = createMemoryStorage('localStorage', (f) => used.add(f));
    storage.setItem('n', String(1));
    storage.setItem('obj', { a: 1 } as unknown as string);
    expect(storage.getItem('n')).toBe('1');
    expect(storage.getItem('obj')).toBe('[object Object]');
    expect(storage.getItem('missing')).toBeNull();
    storage['x'] = 'y';
    expect(storage.getItem('x')).toBe('y');
    expect(Object.keys(storage)).toEqual(['n', 'obj', 'x']);
    expect(storage.length).toBe(3);
    expect(storage.key(0)).toBe('n');
    storage.removeItem('n');
    storage.clear();
    expect(storage.length).toBe(0);
    expect([...used]).toEqual(['localStorage']);
  });

  test('方法在原型上：instanceof、toString 与浏览器一致；不能直接构造', () => {
    const storage = createMemoryStorage('sessionStorage', () => {});
    expect(storage).toBeInstanceOf(MemoryStorage);
    expect(Object.prototype.toString.call(storage)).toBe('[object Storage]');
    expect(Object.hasOwn(storage, 'setItem')).toBe(false);
    expect(() => new MemoryStorage()).toThrow(TypeError);
    const { getItem } = storage;
    expect(() => getItem('a')).toThrow(TypeError);
  });

  test('平台的 vi.spyOn：监视 Storage.prototype 上的方法；直接替换实例的方法会得到说明', () => {
    const a = createMemoryStorage('localStorage', () => {});
    const b = createMemoryStorage('sessionStorage', () => {});
    try {
      const spy = spyOn(MemoryStorage.prototype as unknown as Record<PropertyKey, unknown>, 'setItem');
      a.setItem('k', 'v');
      b.setItem('k', 'w');
      expect(spy.mock.calls).toEqual([
        ['k', 'v'],
        ['k', 'w'],
      ]);
      expect(a.getItem('k')).toBe('v');
      expect(b.getItem('k')).toBe('w');
      spy.mockImplementation(() => {
        throw new Error('满了');
      });
      expect(() => a.setItem('k', 'x')).toThrow('满了');
      spy.mockRestore();
      a.setItem('k', 'z');
      expect(a.getItem('k')).toBe('z');
      expect(() => spyOn(a as unknown as Record<PropertyKey, unknown>, 'setItem')).toThrow(/Storage\.prototype/);
    } finally {
      restoreAllMocks();
    }
  });

  test('平台的 vi.spyOn 用调用时的 this 调用原来的函数', () => {
    class Counter {
      n = 0;
      inc() {
        this.n += 1;
        return this.n;
      }
    }
    const c = new Counter();
    try {
      const spy = spyOn(Counter.prototype as unknown as Record<PropertyKey, unknown>, 'inc');
      expect(c.inc()).toBe(1);
      expect(spy.mock.calls).toEqual([[]]);
      expect(c.n).toBe(1);
    } finally {
      restoreAllMocks();
    }
  });
});
