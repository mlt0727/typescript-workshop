// 模拟的 fetch：与 TypeScript 工坊沙箱中的行为相同，只根据 fixtures.ts 中的模拟响应返回真实的 Response。
// 这个文件会原样复制到下载的本地项目中，所以不能 import 其他文件。
// 支持 AbortSignal、延迟（使用调用时的全局 setTimeout，可以配合 vi.useFakeTimers）、响应体延迟与网络失败。

export interface FetchFixture {
  /** 完整地址或相对地址（相对 https://app.example 解析）；可以用 * 匹配任意字符 */
  url: string;
  method?: string;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  /** 字符串原样返回；其他值转成 JSON，并加上 content-type: application/json */
  body?: unknown;
  /** 过多少毫秒才收到响应 */
  delayMs?: number;
  /** 收到响应后，再过多少毫秒响应体才传输完 */
  bodyDelayMs?: number;
  /** 以网络错误失败（TypeError: Failed to fetch） */
  networkError?: boolean;
}

/** 相对地址以这个虚构的地址为基准解析（与网站上相同） */
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

/** 请求被中止后，读取响应体以中止原因拒绝（与 Fetch 规范一致） */
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

/** 过 ms 毫秒才传输完的响应体；期间请求被中止时，读取响应体以中止原因失败 */
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

export function createMockFetch(fixtures: readonly FetchFixture[]): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : undefined;
    const rawUrl = req ? req.url : input instanceof URL ? input.href : String(input);
    const url = new URL(rawUrl, MOCK_ORIGIN).href;
    const method = (init?.method ?? req?.method ?? 'GET').toUpperCase();
    const signal = init?.signal ?? req?.signal ?? undefined;
    if (signal?.aborted) throw abortError(signal);

    const fixture = fixtures.find((f) => (f.method ?? 'GET').toUpperCase() === method && matchUrl(f.url, url));
    if (!fixture) {
      console.warn(`[模拟网络] 没有为 ${method} ${url} 配置模拟响应，fetch 以网络错误失败。`);
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
    const responseInit = { status, statusText: fixture.statusText ?? '', headers };
    if (body !== null && fixture.bodyDelayMs) {
      return withAbortReason(new Response(delayedBody(body, fixture.bodyDelayMs, signal), responseInit), signal);
    }
    return new Response(body, responseInit);
  };
}
