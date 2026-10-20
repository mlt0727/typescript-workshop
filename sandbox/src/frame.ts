/**
 * 沙箱 iframe 的入口（以经典脚本加载，不需要 CORS）。
 *
 * - iframe 设置 sandbox="allow-scripts allow-forms"、没有 allow-same-origin：来源是不透明的 null，
 *   无法读取主应用的存储、cookie 或 DOM；页面 CSP 禁止网络请求与远程脚本。
 * - 只接受来自 window.parent 的第一条合法 init 消息，此后只通过其中携带的 MessagePort 通信。
 */
import * as TLDom from '@testing-library/dom';
import * as UserEvent from '@testing-library/user-event';
import {
  hostToSandboxSchema,
  initMessageSchema,
  LIMITS,
  PROTOCOL_VERSION,
  VIEWPORT_LIMITS,
  type HostToSandbox,
  type SandboxToHost,
  type TestResult,
} from '../../src/shared/sandbox-protocol.ts';
import { captureConsole, LogSink } from './console-capture.ts';
import { formatUncaught, locate, registerModules, serializeError } from './errors.ts';
import { getDeps, linkBundle } from './linker.ts';
import { enableFocusEmulation, focusEmulationUsed, focusIsBlocked, resetFocusEmulation } from './focus-emulation.ts';
import { installHistoryGuard } from './history-guard.ts';
import { createMemoryStorage, createMockFetch, type SimulatedFeature } from './mocks.ts';
import { applyPage, installLoopGuard, installTracking, listenUntracked, untracked } from './page.ts';
import { TestCollector } from './testing/runner.ts';
import { realTimers } from './testing/timers.ts';
import TsWorker from './worker.ts?worker&inline';
import type { WorkerMessage } from './worker.ts';

const deps = getDeps();
deps['@testing-library/dom'] = TLDom;
/** 让测试库第一次使用时注册的 document 监听器不被每个测试前的清理移除（见 page.ts 的 untracked） */
function untrackedApi<T extends object>(api: T): T {
  return new Proxy(api, {
    get(target, prop, receiver) {
      const value: unknown = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? (...args: unknown[]) => untracked(() => Reflect.apply(value, target, args)) : value;
    },
  });
}
deps['@testing-library/user-event'] = { ...UserEvent, default: untrackedApi(UserEvent.default), userEvent: untrackedApi(UserEvent.userEvent) };

// —— vitest/browser：测试中调整视口，与 Vitest 浏览器模式的 page.viewport(width, height) 相同 ——
let testRunId: string | undefined;
let viewportResolve: (() => void) | undefined;
let currentViewport: { width: number; height: number } = { width: VIEWPORT_LIMITS.defaultWidth, height: VIEWPORT_LIMITS.defaultHeight };

async function setViewport(width: number, height: number): Promise<void> {
  const runId = testRunId;
  if (runId === undefined) throw new Error('page.viewport() 只能在 DOM / React 模式的测试中使用');
  const ok = (n: number) => Number.isInteger(n) && n >= VIEWPORT_LIMITS.min && n <= VIEWPORT_LIMITS.max;
  if (!ok(width) || !ok(height)) {
    throw new RangeError(`page.viewport() 的宽和高必须是 ${VIEWPORT_LIMITS.min}–${VIEWPORT_LIMITS.max} 之间的整数`);
  }
  if (viewportResolve) throw new Error('上一次 page.viewport() 还没有完成，请先 await 它');
  await new Promise<void>((resolve) => {
    viewportResolve = resolve;
    send({ type: 'viewport', runId, width, height });
  });
  currentViewport = { width, height };
  // 宿主调整 iframe 尺寸后，浏览器要到下一次布局才更新 innerWidth 与媒体查询
  const deadline = performance.now() + 2000;
  while ((window.innerWidth !== width || window.innerHeight !== height) && performance.now() < deadline) {
    await new Promise<void>((resolve) => realTimers.setTimeout(resolve, 10));
  }
}
deps['vitest/browser'] = { page: { viewport: setViewport } };

let port: MessagePort | null = null;

function send(msg: SandboxToHost) {
  port?.postMessage(msg);
}

const runtimeBase = (() => {
  const s = document.currentScript;
  return s instanceof HTMLScriptElement ? s.src : location.href;
})();

window.addEventListener('message', function onInit(ev: MessageEvent) {
  if (port || ev.source !== window.parent || ev.ports.length !== 1) return;
  const parsed = initMessageSchema.safeParse(ev.data);
  if (!parsed.success) return;
  window.removeEventListener('message', onInit);
  port = ev.ports[0]!;
  port.onmessage = (m: MessageEvent) => {
    const cmd = hostToSandboxSchema.safeParse(m.data);
    if (!cmd.success) return; // 结构不合法的消息直接丢弃
    void handle(cmd.data);
  };
  Promise.all(
    parsed.data.runtimes.map((r) =>
      new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = new URL(`${r}-runtime.js`, runtimeBase).href;
        script.dataset.tswKeep = '';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`无法加载 ${r} 运行时`));
        document.head.append(script);
      }),
    ),
  ).then(
    () => send({ type: 'ready', sessionId: parsed.data.sessionId, protocol: PROTOCOL_VERSION }),
    // 运行时加载失败也要回应，具体错误会在运行时表现为“平台未提供模块”
    () => send({ type: 'ready', sessionId: parsed.data.sessionId, protocol: PROTOCOL_VERSION }),
  );
});

// —————————————————— 纯 TS 模式：每次运行一个新 Worker ——————————————————

const workers = new Map<string, { worker: Worker; timer: number }>();

function stopWorker(runId: string) {
  const w = workers.get(runId);
  if (!w) return false;
  realTimers.clearTimeout(w.timer);
  w.worker.terminate();
  workers.delete(runId);
  return true;
}

function runInWorker(cmd: Extract<HostToSandbox, { type: 'run' | 'test' }>) {
  const worker = new TsWorker();
  const results: TestResult[] = [];
  const isTest = cmd.type === 'test';
  const timer = realTimers.setTimeout(() => {
    if (!stopWorker(cmd.runId)) return;
    const note = `运行超过 ${cmd.timeoutMs / 1000} 秒，Worker 已被终止（可能存在死循环或永不结束的等待）。`;
    if (isTest) {
      send({
        type: 'tests',
        runId: cmd.runId,
        results,
        error: { name: 'Timeout', message: `测试${note}` },
      });
    } else {
      send({ type: 'status', runId: cmd.runId, status: 'timeout', note });
    }
  }, cmd.timeoutMs) as unknown as number;
  workers.set(cmd.runId, { worker, timer });

  worker.onmessage = (ev: MessageEvent<WorkerMessage & { __tsw?: boolean }>) => {
    const m = ev.data;
    if (!m || m.__tsw !== true || !workers.has(cmd.runId)) return;
    switch (m.type) {
      case 'logs':
        send({ type: 'logs', runId: cmd.runId, entries: m.entries });
        break;
      case 'status':
        send({ type: 'status', runId: cmd.runId, status: m.status, error: m.error, note: m.note, simulated: m.simulated });
        if (m.status !== 'running') stopWorker(cmd.runId);
        break;
      case 'test-result':
        results.push(m.result);
        break;
      case 'tests-done':
        send({ type: 'tests', runId: cmd.runId, results, error: m.error });
        stopWorker(cmd.runId);
        break;
    }
  };
  worker.onerror = (ev) => {
    ev.preventDefault();
    if (!stopWorker(cmd.runId)) return;
    const error = { name: 'WorkerError', message: ev.message || 'Worker 运行出错' };
    if (isTest) send({ type: 'tests', runId: cmd.runId, results, error });
    else send({ type: 'status', runId: cmd.runId, status: 'error', error });
  };
  if (cmd.type === 'run') {
    worker.postMessage({ type: 'run', bundle: cmd.bundle, fixtures: cmd.fixtures });
  } else {
    worker.postMessage({
      type: 'test',
      bundle: cmd.bundle,
      testEntries: cmd.testEntries,
      perTestTimeoutMs: cmd.perTestTimeoutMs,
      fixtures: cmd.fixtures,
    });
  }
}

// —————————————————— DOM / React 模式：在本 iframe 中运行（每次运行使用新 iframe）——————————————————

let pageUsed = false;
const simulated = new Set<SimulatedFeature>();

function installPageEnvironment(runId: string, fixtures: Parameters<typeof createMockFetch>[0]) {
  installTracking();
  installLoopGuard();
  const sink = new LogSink((entries) => send({ type: 'logs', runId, entries }));
  captureConsole(sink);
  installHistoryGuard((t) => sink.push('system', t));
  const onUse = (f: SimulatedFeature) => simulated.add(f);
  Object.defineProperty(window, 'fetch', {
    value: createMockFetch(fixtures, onUse, (t) => sink.push('system', t)),
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, 'localStorage', { value: createMemoryStorage('localStorage', onUse), configurable: true });
  Object.defineProperty(window, 'sessionStorage', { value: createMemoryStorage('sessionStorage', onUse), configurable: true });
  const notice = (name: string) => (message?: unknown) => {
    onUse('alert');
    sink.push('system', `[${name}] ${String(message ?? '')}（沙箱中不弹出对话框）`);
    return name === 'confirm' ? false : name === 'prompt' ? null : undefined;
  };
  window.alert = notice('alert') as typeof window.alert;
  window.confirm = notice('confirm') as typeof window.confirm;
  window.prompt = notice('prompt') as typeof window.prompt;
  listenUntracked(document, 'securitypolicyviolation', (e) => {
    if (e.violatedDirective.startsWith('form-action')) {
      sink.push('error', '表单提交被沙箱拦截：页面试图跳转。处理 submit 事件时通常需要调用 event.preventDefault()。');
    } else if (e.violatedDirective.startsWith('connect-src')) {
      sink.push('error', `网络请求被拦截：${e.blockedURI}（练习中的网络请求都由平台模拟）。`);
    }
  });
  window.addEventListener('error', (ev) => {
    sink.push('error', formatUncaught('Uncaught ', ev.error ?? ev.message));
  });
  window.addEventListener('unhandledrejection', (ev) => {
    sink.push('error', formatUncaught('未处理的 Promise 拒绝（Unhandled promise rejection）：', ev.reason));
  });
  return sink;
}

async function runPage(cmd: Extract<HostToSandbox, { type: 'run' }>) {
  if (pageUsed) return send({ type: 'status', runId: cmd.runId, status: 'error', error: { name: 'SandboxReused', message: '此沙箱已经运行过代码，请重新创建。' } });
  pageUsed = true;
  const mode = cmd.mode === 'react' ? 'react' : 'dom';
  const sink = installPageEnvironment(cmd.runId, cmd.fixtures ?? []);
  try {
    const page = applyPage(cmd.page);
    for (const w of page.warnings) sink.push('system', w);
    const entry = page.entryFromHtml ? `file:${page.entryFromHtml}` : cmd.bundle.entries[0];
    if (entry === undefined) {
      // 纯 HTML/CSS 页面：没有要运行的脚本，只显示页面
      send({ type: 'status', runId: cmd.runId, status: 'running' });
    } else {
      if (!cmd.bundle.modules.some((m) => m.id === entry)) throw new Error(`找不到入口模块 ${entry}`);
      if (mode === 'dom' && !page.entryFromHtml) sink.push('system', 'index.html 中没有 <script type="module" src="…">，将直接运行入口文件。');
      const graph = linkBundle(cmd.bundle, { entries: [entry], css: 'inject' });
      registerModules(graph.urlToModule);
      send({ type: 'status', runId: cmd.runId, status: 'running' });
      await import(/* @vite-ignore */ graph.urls.get(entry)!);
    }
    document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
    sink.flush();
    send({ type: 'status', runId: cmd.runId, status: 'done', simulated: [...simulated] });
  } catch (err) {
    sink.push('error', formatUncaught('Uncaught ', err));
    sink.flush();
    send({ type: 'status', runId: cmd.runId, status: 'error', error: serializeError(err), simulated: [...simulated] });
  }
}

const FOCUS_NOTE =
  '（这个浏览器不允许沙箱中的脚本移动焦点，平台在测试中模拟了焦点。依赖 :focus、:focus-visible 样式的检查在这里无法通过；如果确认代码正确，可以换用 Chrome、Edge 或 Firefox 再试。）';

function withFocusNote(r: TestResult): TestResult {
  if (r.error === undefined) return r;
  return { ...r, error: { ...r.error, message: `${r.error.message}\n${FOCUS_NOTE}`.slice(0, LIMITS.maxLogEntryChars) } };
}

async function testPage(cmd: Extract<HostToSandbox, { type: 'test' }>) {
  if (pageUsed) return;
  pageUsed = true;
  const mode = cmd.mode === 'react' ? 'react' : 'dom';
  const sink = installPageEnvironment(cmd.runId, cmd.fixtures ?? []);
  const results: TestResult[] = [];
  const overall = realTimers.setTimeout(() => {
    send({ type: 'tests', runId: cmd.runId, results, error: { name: 'Timeout', message: `测试运行超过 ${cmd.timeoutMs / 1000} 秒，已停止。` } });
    port = null;
  }, cmd.timeoutMs);
  try {
    const page = applyPage(cmd.page);
    // WebKit 不允许沙箱中的脚本移动焦点：测试中改用模拟的焦点（见 focus-emulation.ts）
    const emulateFocus = focusIsBlocked();
    if (emulateFocus) enableFocusEmulation();
    testRunId = cmd.runId;
    const studentEntries = cmd.bundle.entries.filter((e) => !cmd.testEntries.includes(e));
    const collector = new TestCollector();
    deps.vitest = collector.api();
    const testGraph = linkBundle(cmd.bundle, { entries: cmd.testEntries, css: 'inject' });
    registerModules(testGraph.urlToModule);
    for (const t of cmd.testEntries) await import(/* @vite-ignore */ testGraph.urls.get(t)!);
    if (collector.size === 0) throw new Error('测试文件中没有任何测试');

    const rtl = deps['@testing-library/react'] as { cleanup?: () => void } | undefined;
    await collector.run(
      {
        locate,
        beforeEach: async () => {
          if (currentViewport.width !== VIEWPORT_LIMITS.defaultWidth || currentViewport.height !== VIEWPORT_LIMITS.defaultHeight) {
            await setViewport(VIEWPORT_LIMITS.defaultWidth, VIEWPORT_LIMITS.defaultHeight);
          }
          page.reset();
          resetFocusEmulation();
          simulated.clear();
          if (mode === 'dom' && studentEntries.length > 0) {
            // 每个测试前重新执行学生代码：使用新的 blob URL 得到全新的模块实例
            const g = linkBundle(cmd.bundle, { entries: studentEntries, css: 'inject' });
            registerModules(g.urlToModule);
            for (const e of studentEntries) await import(/* @vite-ignore */ g.urls.get(e)!);
            document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
          }
        },
        afterEach: async () => {
          rtl?.cleanup?.();
        },
      },
      cmd.perTestTimeoutMs,
      (r) => results.push(emulateFocus && r.status === 'fail' && focusEmulationUsed() ? withFocusNote(r) : r),
    );
    sink.flush();
    realTimers.clearTimeout(overall);
    send({ type: 'tests', runId: cmd.runId, results });
  } catch (err) {
    sink.push('error', formatUncaught('加载测试失败：', err));
    sink.flush();
    realTimers.clearTimeout(overall);
    send({ type: 'tests', runId: cmd.runId, results, error: serializeError(err) });
  }
}

async function handle(cmd: HostToSandbox) {
  switch (cmd.type) {
    case 'ping':
      send({ type: 'pong', nonce: cmd.nonce });
      return;
    case 'stop':
      if (stopWorker(cmd.runId)) send({ type: 'status', runId: cmd.runId, status: 'stopped' });
      return;
    case 'viewport-done':
      if (cmd.runId === testRunId) {
        viewportResolve?.();
        viewportResolve = undefined;
      }
      return;
    case 'run':
      if (cmd.mode === 'ts') runInWorker(cmd);
      else await runPage(cmd);
      return;
    case 'test':
      if (cmd.mode === 'ts') runInWorker(cmd);
      else await testPage(cmd);
      return;
  }
}
