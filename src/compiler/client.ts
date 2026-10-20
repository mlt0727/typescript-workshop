import type { CompilerMethod, CompilerMethods, CompilerRequest, CompilerResponse } from './protocol.ts';

/** 编译器 Worker 客户端。Worker 在第一次需要类型检查时才创建（按需加载约 4 MB 的编译器与类型库）。 */
class CompilerClient {
  private worker: Worker | undefined;
  private nextId = 1;
  private readonly pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private initPromise: Promise<{ tsVersion: string }> | undefined;

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'tsw-compiler' });
      this.worker.addEventListener('message', (ev: MessageEvent<CompilerResponse>) => {
        const p = this.pending.get(ev.data.id);
        if (!p) return;
        this.pending.delete(ev.data.id);
        if (ev.data.ok) p.resolve(ev.data.result);
        else p.reject(new Error(ev.data.error));
      });
      this.worker.addEventListener('error', (ev) => {
        const err = new Error(`编译器 Worker 出错：${ev.message || '未知错误'}`);
        for (const p of this.pending.values()) p.reject(err);
        this.pending.clear();
        this.worker = undefined;
        this.initPromise = undefined;
      });
    }
    return this.worker;
  }

  private rawCall<M extends CompilerMethod>(method: M, params: Parameters<CompilerMethods[M]>[0]): Promise<ReturnType<CompilerMethods[M]>> {
    const worker = this.ensureWorker();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      const req: CompilerRequest<M> = { id, method, params };
      worker.postMessage(req);
    });
  }

  init(): Promise<{ tsVersion: string }> {
    this.initPromise ??= this.rawCall('init', { baseUrl: import.meta.env.BASE_URL });
    return this.initPromise;
  }

  async call<M extends Exclude<CompilerMethod, 'init'>>(method: M, params: Parameters<CompilerMethods[M]>[0]): Promise<ReturnType<CompilerMethods[M]>> {
    await this.init();
    return this.rawCall(method, params);
  }
}

let client: CompilerClient | undefined;

export function getCompiler(): CompilerClient {
  client ??= new CompilerClient();
  return client;
}

export type { CompilerClient };
