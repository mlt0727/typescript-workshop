import type { RunBundle } from '../compiler/core/types.ts';
import type { RunMode } from '../compiler/config.ts';
import { LIMITS } from '../shared/limits.ts';
import type { FetchFixture, LogEntry, RunStatus, SerializedError, TestResult } from '../shared/sandbox-protocol.ts';
import { randomId, SandboxFrame } from './frame.ts';

export interface PageInput {
  html?: string;
  css: Record<string, string>;
}

export interface RunCallbacks {
  onLogs(entries: LogEntry[]): void;
  onStatus(update: { status: RunStatus; error?: SerializedError; note?: string; simulated?: string[] }): void;
}

export interface RunHandle {
  runId: string;
  stop(): void;
  /** 运行结束（done/error/timeout/stopped）时 resolve */
  finished: Promise<RunStatus>;
}

export interface TestOutcome {
  results: TestResult[];
  error?: SerializedError;
  logs: LogEntry[];
}

let sharedTsFrame: SandboxFrame | undefined;

/** 纯 TS 模式共用一个隐藏沙箱 iframe；每次运行在其中创建新的 Worker。 */
function tsFrame(): SandboxFrame {
  if (!sharedTsFrame || sharedTsFrame.isDead) {
    sharedTsFrame = new SandboxFrame({ runtimes: [], title: 'TypeScript 运行沙箱' });
  }
  return sharedTsFrame;
}

/** 测试或关闭页面时调用：销毁共享沙箱 */
export function disposeSharedFrames() {
  sharedTsFrame?.kill();
  sharedTsFrame = undefined;
}

function limitLogs(onLogs: (e: LogEntry[]) => void) {
  let count = 0;
  let cut = false;
  return (entries: LogEntry[]) => {
    if (cut) return;
    const allowed = entries.slice(0, Math.max(0, LIMITS.maxLogEntries + 1 - count));
    count += allowed.length;
    if (allowed.length < entries.length) {
      cut = true;
      allowed.push({ level: 'system', text: '输出过多，已截断。', t: allowed.at(-1)?.t ?? 0 });
    }
    if (allowed.length) onLogs(allowed);
  };
}

const TERMINAL: RunStatus[] = ['done', 'error', 'timeout', 'stopped'];

export interface RunOptions {
  mode: RunMode;
  bundle: RunBundle;
  timeoutMs: number;
  fixtures?: FetchFixture[];
  page?: PageInput;
  /** DOM/React 模式：预览 iframe 的容器 */
  container?: HTMLElement;
}

/**
 * 运行示例代码。
 * - ts：在共享隐藏沙箱的新 Worker 中运行；停止 = terminate()。
 * - dom/react：在 container 中创建新的可见沙箱 iframe；停止 = 移除 iframe。
 */
/** 仍在运行（或预览仍然存活）的运行编号；用于测试“切课后资源被清理” */
const activeRuns = new Set<string>();

export function activeRunCount(): number {
  return activeRuns.size;
}

export function startRun(opts: RunOptions, cb: RunCallbacks): RunHandle & { frame?: SandboxFrame } {
  const runId = randomId();
  activeRuns.add(runId);
  const isPage = opts.mode !== 'ts';
  const frame = isPage
    ? new SandboxFrame({ container: opts.container, runtimes: opts.mode === 'react' ? ['react'] : [], title: '网页预览（沙箱）' })
    : tsFrame();
  const onLogs = limitLogs(cb.onLogs);
  let settle!: (s: RunStatus) => void;
  const finished = new Promise<RunStatus>((r) => (settle = r));
  let done = false;
  let watchdog: number | undefined;

  const finish = (status: RunStatus, error?: SerializedError, note?: string, simulated?: string[]) => {
    if (done) return;
    done = true;
    activeRuns.delete(runId);
    window.clearTimeout(watchdog);
    unsubscribe();
    offDeath();
    cb.onStatus({ status, error, note, simulated });
    settle(status);
  };

  const unsubscribe = frame.onMessage((m) => {
    if (!('runId' in m) || m.runId !== runId || done) return; // 丢弃其他运行或过期的消息
    if (m.type === 'logs') onLogs(m.entries);
    else if (m.type === 'status') {
      if (TERMINAL.includes(m.status)) {
        // DOM/React 页面运行完入口后仍保持可交互，日志继续通过同一 runId 到达
        if (isPage && m.status === 'done') {
          cb.onStatus({ status: 'done', note: m.note, simulated: m.simulated });
          window.clearTimeout(watchdog);
          return;
        }
        finish(m.status, m.error, m.note, m.simulated);
      } else {
        cb.onStatus({ status: m.status, note: m.note, simulated: m.simulated });
      }
    }
  });
  const offDeath = frame.onDeath((reason) => finish('stopped', undefined, reason));

  frame.ready.then(
    () => {
      if (done) return;
      frame.send({ type: 'run', runId, mode: opts.mode, bundle: opts.bundle, page: opts.page, timeoutMs: opts.timeoutMs, fixtures: opts.fixtures });
      // 看门狗：沙箱若完全无响应（例如被同步死循环卡住），超时后直接移除 iframe
      watchdog = window.setTimeout(() => {
        if (done) return;
        if (isPage) {
          frame.kill('预览长时间没有完成，已关闭沙箱。');
        } else {
          frame.kill('沙箱无响应，已重建。');
          finish('timeout', undefined, `运行超过 ${opts.timeoutMs / 1000} 秒没有结束，已终止。`);
        }
      }, opts.timeoutMs + 3000);
    },
    (err: Error) => finish('error', { name: 'SandboxError', message: err.message }),
  );

  return {
    runId,
    frame: isPage ? frame : undefined,
    finished,
    stop() {
      if (done) return;
      if (isPage) {
        frame.kill('已停止');
      } else {
        try {
          frame.send({ type: 'stop', runId });
        } catch {
          finish('stopped');
        }
        // 若沙箱没有确认停止，1 秒后直接重建共享沙箱
        window.setTimeout(() => {
          if (!done) {
            frame.kill('已停止');
          }
        }, 1000);
      }
    },
  };
}

export interface TestRunOptions {
  mode: RunMode;
  bundle: RunBundle;
  testEntries: string[];
  page?: PageInput;
  timeoutMs: number;
  perTestTimeoutMs: number;
  fixtures?: FetchFixture[];
}

/** 运行行为测试。DOM/React 模式使用一次性的隐藏沙箱，与可见预览互不影响。 */
export function runTests(opts: TestRunOptions): Promise<TestOutcome> {
  const runId = randomId();
  const isPage = opts.mode !== 'ts';
  const frame = isPage
    ? new SandboxFrame({ runtimes: opts.mode === 'react' ? ['react'] : [], title: '测试沙箱' })
    : tsFrame();
  const logs: LogEntry[] = [];
  const onLogs = limitLogs((e) => logs.push(...e));

  return new Promise<TestOutcome>((resolve) => {
    let done = false;
    let watchdog: number | undefined;
    const finish = (outcome: Omit<TestOutcome, 'logs'>) => {
      if (done) return;
      done = true;
      window.clearTimeout(watchdog);
      unsubscribe();
      offDeath();
      if (isPage) frame.kill('测试结束');
      resolve({ ...outcome, logs });
    };
    const unsubscribe = frame.onMessage((m) => {
      if (!('runId' in m) || m.runId !== runId) return;
      if (m.type === 'logs') onLogs(m.entries);
      else if (m.type === 'tests') finish({ results: m.results, error: m.error });
      else if (m.type === 'viewport' && isPage) {
        frame.resize(m.width, m.height);
        frame.send({ type: 'viewport-done', runId });
      }
    });
    const offDeath = frame.onDeath((reason) => finish({ results: [], error: { name: 'SandboxClosed', message: reason } }));
    frame.ready.then(
      () => {
        if (done) return;
        frame.send({
          type: 'test',
          runId,
          mode: opts.mode,
          bundle: opts.bundle,
          testEntries: opts.testEntries,
          page: opts.page,
          timeoutMs: opts.timeoutMs,
          perTestTimeoutMs: opts.perTestTimeoutMs,
          fixtures: opts.fixtures,
        });
        watchdog = window.setTimeout(() => {
          frame.kill('测试长时间没有完成');
          finish({ results: [], error: { name: 'Timeout', message: `测试超过 ${opts.timeoutMs / 1000} 秒没有完成（可能存在死循环），已关闭沙箱。` } });
        }, opts.timeoutMs + 3000);
      },
      (err: Error) => finish({ results: [], error: { name: 'SandboxError', message: err.message } }),
    );
  });
}
