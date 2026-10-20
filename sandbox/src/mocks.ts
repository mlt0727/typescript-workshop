import type { FetchFixture } from '../../src/shared/sandbox-protocol.ts';

export type SimulatedFeature = 'fetch' | 'localStorage' | 'sessionStorage' | 'alert';

/** 相对 URL 以这个虚构地址为基准解析（沙箱页面本身是不透明来源，没有可用的基准）。 */
export const MOCK_ORIGIN = 'https://app.example';

function matchUrl(pattern: string, url: string): boolean {
  const abs = new URL(pattern, MOCK_ORIGIN).href;
  if (!pattern.includes('*')) return abs === url;
  const re = new RegExp(`^${abs.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
  return re.test(url);
}

function abortError(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('This operation was aborted', 'AbortError');
}

/**
 * 确定性的模拟 fetch：只根据课程提供的 fixtures 返回真实的 Response 对象。
 * 支持 AbortSignal、延迟（使用当前全局 setTimeout，可配合 vi.useFakeTimers）与网络失败。
 */
export function createMockFetch(
  fixtures: readonly FetchFixture[],
  onUse: (f: SimulatedFeature) => void,
  log: (text: string) => void,
  track?: { start(): void; end(): void },
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    onUse('fetch');
    const req = input instanceof Request ? input : undefined;
    const rawUrl = req ? req.url : input instanceof URL ? input.href : String(input);
    const url = new URL(rawUrl, MOCK_ORIGIN).href;
    const method = (init?.method ?? req?.method ?? 'GET').toUpperCase();
    const signal = init?.signal ?? req?.signal ?? undefined;
    if (signal?.aborted) throw abortError(signal);

    const fixture = fixtures.find((f) => (f.method ?? 'GET').toUpperCase() === method && matchUrl(f.url, url));
    track?.start();
    try {
      if (!fixture) {
        log(`[模拟网络] 没有为 ${method} ${url} 配置模拟响应，fetch 以网络错误失败。`);
        throw new TypeError('Failed to fetch');
      }
      if (fixture.delayMs) {
        await new Promise<void>((resolve, reject) => {
          const id = setTimeout(resolve, fixture.delayMs);
          signal?.addEventListener(
            'abort',
            () => {
              clearTimeout(id);
              reject(abortError(signal));
            },
            { once: true },
          );
        });
      }
      if (signal?.aborted) throw abortError(signal);
      if (fixture.networkError) throw new TypeError('Failed to fetch');
      const status = fixture.status ?? 200;
      const headers = new Headers(fixture.headers);
      let body: string | null = null;
      if (fixture.body !== undefined) {
        if (typeof fixture.body === 'string') {
          body = fixture.body;
        } else {
          body = JSON.stringify(fixture.body);
          if (!headers.has('content-type')) headers.set('content-type', 'application/json');
        }
      }
      if (status === 204 || status === 205 || status === 304) body = null;
      return new Response(body, { status, statusText: fixture.statusText ?? '', headers });
    } finally {
      track?.end();
    }
  };
}

/** 内存版 Storage，行为与 Web Storage 一致（值都会被转成字符串）。 */
export function createMemoryStorage(name: SimulatedFeature, onUse: (f: SimulatedFeature) => void): Storage {
  const data = new Map<string, string>();
  const api = {
    get length() {
      onUse(name);
      return data.size;
    },
    key(i: number) {
      onUse(name);
      return [...data.keys()][i] ?? null;
    },
    getItem(key: string) {
      onUse(name);
      return data.get(String(key)) ?? null;
    },
    setItem(key: string, value: unknown) {
      onUse(name);
      data.set(String(key), String(value));
    },
    removeItem(key: string) {
      onUse(name);
      data.delete(String(key));
    },
    clear() {
      onUse(name);
      data.clear();
    },
  };
  return new Proxy(api, {
    get(target, prop, receiver) {
      if (typeof prop === 'symbol' || prop in target) return Reflect.get(target, prop, receiver);
      onUse(name);
      return data.get(prop) ?? undefined;
    },
    set(target, prop, value) {
      if (typeof prop === 'symbol' || prop in target) return false;
      onUse(name);
      data.set(prop, String(value));
      return true;
    },
    deleteProperty(_t, prop) {
      if (typeof prop === 'string') data.delete(prop);
      return true;
    },
    ownKeys() {
      return [...data.keys()];
    },
    getOwnPropertyDescriptor(_t, prop) {
      if (typeof prop === 'string' && data.has(prop)) {
        return { value: data.get(prop), writable: true, enumerable: true, configurable: true };
      }
      return undefined;
    },
  }) as unknown as Storage;
}
