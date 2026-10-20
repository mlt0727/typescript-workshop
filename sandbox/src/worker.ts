/// <reference lib="webworker" />
/**
 * 纯 TypeScript 模式的执行环境：一个由沙箱 iframe 创建的专用 Worker（来源同样是不透明的 null）。
 * 每次运行都使用新的 Worker；超时或停止时由 iframe 调用 terminate() 真正中断，包括同步死循环。
 */
import type { FetchFixture, LogEntry, TestResult } from '../../src/shared/sandbox-protocol.ts';
import { captureConsole, LogSink } from './console-capture.ts';
import { formatUncaught, locate, registerModules, serializeError } from './errors.ts';
import { getDeps, linkBundle } from './linker.ts';
import { createMockFetch, type SimulatedFeature } from './mocks.ts';
import { TestCollector } from './testing/runner.ts';

declare const self: DedicatedWorkerGlobalScope;

export type WorkerCommand =
  | { type: 'run'; bundle: Parameters<typeof linkBundle>[0]; fixtures?: FetchFixture[] }
  | {
      type: 'test';
      bundle: Parameters<typeof linkBundle>[0];
      testEntries: string[];
      perTestTimeoutMs: number;
      fixtures?: FetchFixture[];
    };

export type WorkerMessage =
  | { type: 'logs'; entries: LogEntry[] }
  | { type: 'status'; status: 'running' | 'done' | 'error'; error?: ReturnType<typeof serializeError>; note?: string; simulated?: SimulatedFeature[] }
  | { type: 'test-result'; result: TestResult }
  | { type: 'tests-done'; error?: ReturnType<typeof serializeError> };

const post = (m: WorkerMessage) => self.postMessage({ __tsw: true, ...m });

const realSetTimeout = self.setTimeout.bind(self);
const realClearTimeout = self.clearTimeout.bind(self);
const realSetInterval = self.setInterval.bind(self);
const realClearInterval = self.clearInterval.bind(self);

const activeTimeouts = new Set<number>();
const activeIntervals = new Set<number>();
let pendingFetches = 0;
const simulated = new Set<SimulatedFeature>();
let finished = false;

function installTimerTracking() {
  self.setTimeout = ((handler: TimerHandler, ms?: number, ...args: unknown[]) => {
    if (typeof handler !== 'function') throw new TypeError('不支持字符串形式的计时器回调');
    const id: number = realSetTimeout(() => {
      activeTimeouts.delete(id);
      (handler as (...a: unknown[]) => void)(...args);
    }, ms);
    activeTimeouts.add(id);
    return id;
  }) as typeof self.setTimeout;
  self.clearTimeout = ((id?: number) => {
    if (id !== undefined) activeTimeouts.delete(id);
    realClearTimeout(id);
  }) as typeof self.clearTimeout;
  self.setInterval = ((handler: TimerHandler, ms?: number, ...args: unknown[]) => {
    if (typeof handler !== 'function') throw new TypeError('不支持字符串形式的计时器回调');
    const id = realSetInterval(handler, ms, ...args);
    activeIntervals.add(id);
    return id;
  }) as typeof self.setInterval;
  self.clearInterval = ((id?: number) => {
    if (id !== undefined) activeIntervals.delete(id);
    realClearInterval(id);
  }) as typeof self.clearInterval;
}

function setup(fixtures: FetchFixture[] | undefined) {
  const sink = new LogSink((entries) => post({ type: 'logs', entries }), { immediate: true });
  captureConsole(sink);
  installTimerTracking();
  const fetchImpl = createMockFetch(
    fixtures ?? [],
    (f) => simulated.add(f),
    (text) => sink.push('system', text),
    {
      start: () => pendingFetches++,
      end: () => pendingFetches--,
    },
  );
  Object.defineProperty(self, 'fetch', { value: fetchImpl, configurable: true, writable: true });
  return sink;
}

function finish(sink: LogSink, m: Extract<WorkerMessage, { type: 'status' }>) {
  if (finished) return;
  finished = true;
  sink.flush();
  post({ ...m, simulated: [...simulated] });
}

const sleep = (ms: number) => new Promise<void>((r) => realSetTimeout(r, ms));

async function run(cmd: Extract<WorkerCommand, { type: 'run' }>) {
  const sink = setup(cmd.fixtures);
  self.addEventListener('error', (ev) => {
    ev.preventDefault();
    sink.push('error', formatUncaught('Uncaught ', ev.error ?? ev.message));
    finish(sink, { type: 'status', status: 'error', error: serializeError(ev.error ?? new Error(ev.message)) });
  });
  self.addEventListener('unhandledrejection', (ev) => {
    ev.preventDefault();
    sink.push('error', formatUncaught('未处理的 Promise 拒绝（Unhandled promise rejection）：', ev.reason));
    finish(sink, { type: 'status', status: 'error', error: serializeError(ev.reason) });
  });

  let settled = false;
  let failed: unknown;
  try {
    const graph = linkBundle(cmd.bundle, { entries: cmd.bundle.entries, css: 'unsupported' });
    registerModules(graph.urlToModule);
    const entryUrl = graph.urls.get(cmd.bundle.entries[0] ?? '');
    if (!entryUrl) throw new Error('没有可运行的入口文件');
    post({ type: 'status', status: 'running' });
    import(/* @vite-ignore */ entryUrl).then(
      () => {
        settled = true;
      },
      (err: unknown) => {
        settled = true;
        failed = err ?? new Error('模块执行失败');
      },
    );
  } catch (err) {
    sink.push('error', formatUncaught('', err));
    finish(sink, { type: 'status', status: 'error', error: serializeError(err) });
    return;
  }

  // 像 Node.js 一样：入口执行完、且没有待触发的计时器/请求时，运行才算结束。
  let quiet = 0;
  let reportedIntervals = false;
  while (!finished) {
    await sleep(15);
    if (finished) return;
    if (settled && failed !== undefined) {
      sink.push('error', formatUncaught('Uncaught ', failed));
      finish(sink, { type: 'status', status: 'error', error: serializeError(failed) });
      return;
    }
    const busy = activeTimeouts.size > 0 || pendingFetches > 0;
    if (activeIntervals.size > 0 && !busy && settled && !reportedIntervals) {
      reportedIntervals = true;
      sink.flush();
      post({ type: 'status', status: 'running', note: `仍有 ${activeIntervals.size} 个 setInterval 在运行，点击“停止”结束。` });
    }
    if (busy || activeIntervals.size > 0) {
      quiet = 0;
      continue;
    }
    quiet++;
    if (quiet < 3) continue;
    if (settled) {
      finish(sink, { type: 'status', status: 'done' });
    } else {
      const msg =
        '顶层 await 等待的 Promise 永远不会完成：已经没有计时器或请求能让它继续。（Node.js 会提示 "unsettled top-level await" 并以退出码 13 结束）';
      sink.push('error', msg);
      finish(sink, { type: 'status', status: 'error', error: { name: 'UnsettledTopLevelAwait', message: msg } });
    }
    return;
  }
}

async function test(cmd: Extract<WorkerCommand, { type: 'test' }>) {
  const sink = setup(cmd.fixtures);
  const collector = new TestCollector();
  getDeps().vitest = collector.api();
  self.addEventListener('unhandledrejection', (ev) => {
    ev.preventDefault();
    sink.push('error', formatUncaught('测试期间出现未处理的 Promise 拒绝：', ev.reason));
  });
  try {
    const graph = linkBundle(cmd.bundle, { entries: cmd.testEntries, css: 'unsupported' });
    registerModules(graph.urlToModule);
    for (const entry of cmd.testEntries) {
      const url = graph.urls.get(entry);
      if (!url) throw new Error(`找不到测试文件 ${entry}`);
      await import(/* @vite-ignore */ url);
    }
    if (collector.size === 0) throw new Error('测试文件中没有任何测试');
    await collector.run({ locate }, cmd.perTestTimeoutMs, (result) => post({ type: 'test-result', result }));
    sink.flush();
    post({ type: 'tests-done' });
  } catch (err) {
    sink.push('error', formatUncaught('加载测试失败：', err));
    sink.flush();
    post({ type: 'tests-done', error: serializeError(err) });
  }
}

let started = false;
self.addEventListener('message', (ev: MessageEvent<WorkerCommand>) => {
  // 每个 Worker 只执行一条命令；学生代码运行后再收到的消息一律忽略
  if (started) return;
  started = true;
  const cmd = ev.data;
  if (cmd.type === 'run') void run(cmd);
  else if (cmd.type === 'test') void test(cmd);
});
