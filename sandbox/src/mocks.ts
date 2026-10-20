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

const BODY_METHODS = ['arrayBuffer', 'blob', 'bytes', 'formData', 'json', 'text'] as const;

/**
 * 按 Fetch 规范，请求被中止后读取响应体以中止原因拒绝；但 Chromium 读取出错的 JS 流时
 * 一律给出 TypeError: Failed to fetch。这里让读取方法在信号已中止时改为以中止原因拒绝。
 */
function withAbortReason(res: Response, signal: AbortSignal | undefined): Response {
  if (!signal) return res;
  for (const name of BODY_METHODS) {
    const original: unknown = Reflect.get(res, name);
    if (typeof original !== 'function') continue;
    Object.defineProperty(res, name, {
      configurable: true,
      writable: true,
      value: (...args: unknown[]) =>
        Promise.resolve(Reflect.apply(original, res, args)).catch((err: unknown) => {
          throw signal.aborted ? abortError(signal) : err;
        }),
    });
  }
  return res;
}

/** 过 ms 毫秒才传输完的响应体；期间请求被中止时，读取响应体以中止原因失败（与真实的 fetch 一致）。 */
function delayedBody(text: string, ms: number, signal: AbortSignal | undefined): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  let id: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const detach = () => {
    if (onAbort) signal?.removeEventListener('abort', onAbort);
  };
  return new ReadableStream<Uint8Array>({
    start(controller) {
      if (signal) {
        onAbort = () => {
          clearTimeout(id);
          controller.error(abortError(signal));
        };
        signal.addEventListener('abort', onAbort, { once: true });
      }
      id = setTimeout(() => {
        detach();
        controller.enqueue(bytes);
        controller.close();
      }, ms);
    },
    cancel() {
      clearTimeout(id);
      detach();
    },
  });
}

/**
 * 确定性的模拟 fetch：只根据课程提供的 fixtures 返回真实的 Response 对象。
 * 支持 AbortSignal、延迟（使用当前全局 setTimeout，可配合 vi.useFakeTimers）、响应体延迟与网络失败。
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
      const init = { status, statusText: fixture.statusText ?? '', headers };
      if (body !== null && fixture.bodyDelayMs) {
        return withAbortReason(new Response(delayedBody(body, fixture.bodyDelayMs, signal), init), signal);
      }
      return new Response(body, init);
    } finally {
      track?.end();
    }
  };
}

type StorageState = { data: Map<string, string>; use: () => void };

const storageStates = new WeakMap<object, StorageState>();
const constructToken = Symbol('MemoryStorage');

function stateOf(storage: unknown): StorageState {
  const state = typeof storage === 'object' && storage !== null ? storageStates.get(storage) : undefined;
  if (state === undefined) throw new TypeError('Illegal invocation');
  return state;
}

/**
 * 沙箱中的 Storage 类（安装为 window.Storage）。和浏览器一样，方法在原型上，
 * 所以测试可以用 vi.spyOn(Storage.prototype, 'setItem') 监视或模拟 localStorage、sessionStorage 的方法。
 */
export class MemoryStorage {
  constructor(token?: symbol) {
    if (token !== constructToken) throw new TypeError('Illegal constructor');
  }
  get length(): number {
    const s = stateOf(this);
    s.use();
    return s.data.size;
  }
  key(index: number): string | null {
    const s = stateOf(this);
    s.use();
    return [...s.data.keys()][index] ?? null;
  }
  getItem(key: string): string | null {
    const s = stateOf(this);
    s.use();
    return s.data.get(String(key)) ?? null;
  }
  setItem(key: string, value: unknown): void {
    const s = stateOf(this);
    s.use();
    s.data.set(String(key), String(value));
  }
  removeItem(key: string): void {
    const s = stateOf(this);
    s.use();
    s.data.delete(String(key));
  }
  clear(): void {
    const s = stateOf(this);
    s.use();
    s.data.clear();
  }
  get [Symbol.toStringTag](): string {
    return 'Storage';
  }
}

/** 内存版 Storage，行为与 Web Storage 一致（值都会被转成字符串；也可以像普通属性一样读写条目）。 */
export function createMemoryStorage(name: SimulatedFeature, onUse: (f: SimulatedFeature) => void): Storage {
  const target = new MemoryStorage(constructToken);
  const state: StorageState = { data: new Map<string, string>(), use: () => onUse(name) };
  const { data } = state;
  const storage = new Proxy(target, {
    get(t, prop, receiver) {
      if (typeof prop === 'symbol' || prop in t) return Reflect.get(t, prop, receiver);
      onUse(name);
      return data.get(prop) ?? undefined;
    },
    set(t, prop, value) {
      if (typeof prop === 'symbol' || prop in t) return false;
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
  });
  storageStates.set(target, state);
  storageStates.set(storage, state);
  return storage as unknown as Storage;
}
